-- Original rows and model output become private. No legacy record is republished automatically.
revoke all on public.experiences, public.ai_insights from anon, authenticated;
drop policy "Only consented published experiences are visible" on public.experiences;
drop policy "Insights follow parent visibility" on public.ai_insights;
alter table public.experiences drop constraint experiences_consent_to_publish_check;
alter table public.experiences drop constraint experiences_status_check;
alter table public.experiences add constraint experiences_status_check check(status in ('draft','pending','published','rejected','withdrawn'));
alter table public.experiences add column revision integer not null default 1;
alter table public.experiences add column outcomes text not null default '';
alter table public.experiences add column culture text not null default '';
alter table public.ai_insights add column role_categories jsonb not null default '[]';
alter table public.ai_insights add column industries jsonb not null default '[]';
alter table public.ai_insights add column revision integer not null default 1;

create table public.submission_controls (
 experience_id uuid primary key references public.experiences(id) on delete cascade,
 management_hash text unique check(management_hash ~ '^[a-f0-9]{64}$'),
 original_content jsonb not null, public_candidate jsonb not null,
 privacy_reviewed boolean not null default false
);
create table public.submission_versions (
 experience_id uuid not null references public.experiences(id) on delete cascade,
 revision integer not null, original_content jsonb not null, created_at timestamptz not null default now(),
 primary key(experience_id,revision)
);
create table public.published_experiences (
 id uuid primary key references public.experiences(id) on delete cascade,
 revision integer not null, content jsonb not null,
 status text not null default 'published' check(status='published'), published_at timestamptz not null default now(),
 check(not (content ?| array['email','management_token','management_hash','contributor_display_name','anonymity_preference'])),
 check(content ?& array['role_title','company','responsibilities','tools'])
);
alter table public.submission_controls enable row level security;
alter table public.submission_versions enable row level security;
alter table public.published_experiences enable row level security;
revoke all on public.submission_controls,public.submission_versions,public.published_experiences from anon,authenticated;
grant select on public.published_experiences to anon,authenticated;
create policy "Only approved anonymized copies" on public.published_experiences for select to anon,authenticated using(status='published');
create index published_experiences_tags on public.published_experiences using gin((content->'search_tags'));
create function public.invalidate_publication() returns trigger language plpgsql set search_path='' as $$begin delete from public.published_experiences where id=new.id; if new.revision<>old.revision or not new.consent_to_publish or new.status<>'published' then delete from public.ai_insights where experience_id=new.id; end if; return new; end;$$;
create trigger invalidate_on_original_change after update on public.experiences for each row execute function public.invalidate_publication();

create table public.reminders (
 id uuid primary key, experience_type text not null check(experience_type in ('Internship','Consulting Project','Full-Time','Other')),
 end_date date not null, email text not null check(length(email)<=254), consent boolean not null check(consent),
 management_hash text not null unique check(management_hash ~ '^[a-f0-9]{64}$'), unsubscribe_hash text not null unique check(unsubscribe_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'scheduled' check(status in ('scheduled','processing','retry','sent','unsubscribed','completed','failed')),
 attempts integer not null default 0, next_attempt_at timestamptz not null,
 lease_until timestamptz, claim_token uuid, first_attempt_at timestamptz, sent_at timestamptz, last_error text, created_at timestamptz not null default now()
);
create index reminders_due on public.reminders(status,next_attempt_at);
alter table public.reminders enable row level security;
revoke all on public.reminders from anon,authenticated;
create table public.synthesis_runs(id uuid primary key,source_ids uuid[] not null,created_at timestamptz not null default now());
create table public.helpfulness (
 id uuid primary key, target_type text not null check(target_type in ('experience','synthesis')), target_id uuid not null,
 helpful boolean not null, comment text not null default '' check(length(comment)<=2000), created_at timestamptz not null default now()
);
alter table public.synthesis_runs enable row level security;
alter table public.helpfulness enable row level security;
revoke all on public.synthesis_runs,public.helpfulness from anon,authenticated;

create function public.create_contribution(p_id uuid,p_original jsonb,p_public jsonb,p_hash text,p_reviewed boolean,p_reminder_id uuid default null,p_reminder_hash text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.experiences; c public.submission_controls; inserted boolean;
begin
 if p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid token'; end if;
 if coalesce((p_original->>'consent_to_publish')::boolean,false) and not p_reviewed then raise exception 'Public review is required'; end if;
 insert into public.experiences select (jsonb_populate_record(null::public.experiences,p_original||jsonb_build_object('id',p_id,'revision',1,'status',case when (p_original->>'consent_to_publish')::boolean then 'pending' else 'draft' end,'created_at',now(),'updated_at',now(),'outcomes',coalesce(p_original->>'outcomes',''),'culture',coalesce(p_original->>'culture','')))).* on conflict(id) do nothing returning true into inserted;
 select * into e from public.experiences where id=p_id for update;
 select * into c from public.submission_controls where experience_id=p_id;
 if found then
  if c.management_hash is distinct from p_hash then raise exception 'Invalid management token'; end if;
  return jsonb_build_object('id',p_id,'status',e.status,'revision',e.revision,'duplicate',true);
 end if;
 -- Existing legacy rows cannot be claimed through the public submission endpoint.
 if not coalesce(inserted,false) then raise exception 'Existing contribution requires trusted recovery'; end if;
 insert into public.submission_controls values(p_id,p_hash,p_original,p_public,p_reviewed);
 insert into public.submission_versions(experience_id,revision,original_content) values(p_id,1,p_original);
 if p_reminder_id is not null then update public.reminders set status='completed',lease_until=null,claim_token=null where id=p_reminder_id and (management_hash=p_reminder_hash or unsubscribe_hash=p_reminder_hash) and status<>'unsubscribed'; end if;
 return jsonb_build_object('id',p_id,'status',e.status,'revision',1);
end;$$;

create function public.manage_contribution(p_id uuid,p_hash text,p_action text,p_original jsonb default null,p_public jsonb default null,p_reviewed boolean default false,p_expected_revision integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.experiences; c public.submission_controls; consent boolean;
begin
 select * into e from public.experiences where id=p_id for update;
 select * into c from public.submission_controls where experience_id=p_id and management_hash=p_hash;
 if not found then raise exception 'Invalid management token'; end if;
 if p_action='read' then return jsonb_build_object('id',p_id,'status',e.status,'revision',e.revision,'original',c.original_content,'public_candidate',c.public_candidate,'privacy_reviewed',c.privacy_reviewed); end if;
 if p_expected_revision is distinct from e.revision then raise exception 'Revision conflict; reload before editing'; end if;
 if p_action='withdraw' then
  update public.experiences set status='withdrawn',consent_to_publish=false,revision=revision+1 where id=p_id;
  update public.submission_controls set original_content=jsonb_set(original_content,'{consent_to_publish}','false'),privacy_reviewed=false where experience_id=p_id;
 elsif p_action='edit' then
  consent:=(p_original->>'consent_to_publish')::boolean;
  if consent and not p_reviewed then raise exception 'Public review is required'; end if;
  update public.experiences set status=case when consent then 'pending' else 'draft' end,consent_to_publish=consent,revision=revision+1 where id=p_id;
  update public.submission_controls set original_content=p_original,public_candidate=p_public,privacy_reviewed=p_reviewed where experience_id=p_id;
  insert into public.submission_versions(experience_id,revision,original_content) values(p_id,e.revision+1,p_original);
 else raise exception 'Unknown management operation'; end if;
 return jsonb_build_object('id',p_id,'status',(select status from public.experiences where id=p_id),'revision',e.revision+1);
end;$$;

create function public.approve_publication(p_id uuid,p_revision integer,p_content jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare e public.experiences;
begin
 select * into e from public.experiences where id=p_id for update;
 if not found or e.revision<>p_revision or e.status<>'pending' or not e.consent_to_publish or not exists(select 1 from public.submission_controls where experience_id=p_id and privacy_reviewed) then raise exception 'Not eligible for publication'; end if;
 update public.experiences set status='published' where id=p_id;
 insert into public.published_experiences(id,revision,content) values(p_id,p_revision,p_content);
 return true;
end;$$;

create function public.claim_reminders(p_limit integer default 20) returns setof public.reminders language plpgsql security definer set search_path='' as $$
begin
 update public.reminders set status='failed',lease_until=null,claim_token=null,last_error='Retry window exhausted; manual review required' where status in ('retry','processing') and ((first_attempt_at<now()-interval '23 hours') or (attempts>=3 and lease_until<=now()));
 return query with due as (select id from public.reminders where status in ('scheduled','retry','processing') and next_attempt_at<=now() and attempts<3 and (lease_until is null or lease_until<=now()) order by next_attempt_at for update skip locked limit least(greatest(p_limit,1),20))
 update public.reminders r set status='processing',attempts=r.attempts+1,first_attempt_at=coalesce(r.first_attempt_at,now()),lease_until=now()+interval '5 minutes',claim_token=gen_random_uuid() from due where r.id=due.id returning r.*;
end;$$;
create function public.finish_reminder(p_id uuid,p_claim uuid,p_success boolean,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.reminders set status=case when p_success then 'sent' when attempts>=3 then 'failed' else 'retry' end,sent_at=case when p_success then now() else sent_at end,last_error=p_error,next_attempt_at=now()+interval '15 minutes'*power(2,attempts-1),lease_until=null,claim_token=null where id=p_id and claim_token=p_claim and status='processing';
 return found;
end;$$;

revoke all on function public.create_contribution(uuid,jsonb,jsonb,text,boolean,uuid,text),public.manage_contribution(uuid,text,text,jsonb,jsonb,boolean,integer),public.approve_publication(uuid,integer,jsonb),public.claim_reminders(integer),public.finish_reminder(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.create_contribution(uuid,jsonb,jsonb,text,boolean,uuid,text),public.manage_contribution(uuid,text,text,jsonb,jsonb,boolean,integer),public.approve_publication(uuid,integer,jsonb),public.claim_reminders(integer),public.finish_reminder(uuid,uuid,boolean,text) to service_role;
grant all on public.submission_controls,public.submission_versions,public.published_experiences,public.reminders,public.synthesis_runs,public.helpfulness to service_role;
