// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import { demoExperiences } from "../src/data";
import { submissionSchema } from "../src/domain";
import {
  publicCandidate,
  publicPayload,
} from "../supabase/functions/_shared/alignment";
const db = new PGlite();
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const original = submissionSchema.parse({
  ...demoExperiences[0],
  contributor_display_name: "Private Person",
});
const candidate = publicCandidate(original);
const hash = "a".repeat(64);
const other = "b".repeat(64);
async function create(id = first, managementHash = hash, input = original) {
  return db.query(
    "select public.create_contribution($1,$2::jsonb,$3::jsonb,$4,true) as result",
    [id, JSON.stringify(input), JSON.stringify(candidate), managementHash],
  );
}
async function approve(id = first, revision = 1) {
  const publicCopy = publicPayload({ ...demoExperiences[0], ...candidate });
  return db.query("select public.approve_publication($1,$2,$3::jsonb)", [
    id,
    revision,
    JSON.stringify(publicCopy),
  ]);
}
beforeAll(async () => {
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  for (const file of [
    "202610190001_initial.sql",
    "202610200001_prd_alignment.sql",
  ]) {
    const sql = await readFile("supabase/migrations/" + file, "utf8");
    await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
  }
}, 30000);
afterAll(async () => {
  await db.close();
});
it("both migrations apply and submissions are private pending records until approved", async () => {
  await create();
  await db.exec("set role anon");
  try {
    expect(
      (await db.query("select * from public.published_experiences")).rows,
    ).toHaveLength(0);
    await expect(db.exec("select * from public.experiences")).rejects.toThrow(
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
  await approve();
  await db.exec("set role anon");
  try {
    const { rows } = await db.query<{ content: Record<string, unknown> }>(
      "select content from public.published_experiences",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].content).not.toHaveProperty("contributor_display_name");
    expect(JSON.stringify(rows)).not.toContain("Private Person");
  } finally {
    await db.exec("reset role");
  }
});
it("public and authenticated roles cannot mutate publications, access originals, contacts, tokens or comments", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    try {
      for (const sql of [
        "select * from public.experiences",
        "select * from public.ai_insights",
        "select * from public.submission_controls",
        "select * from public.submission_versions",
        "select * from public.reminders",
        "select * from public.helpfulness",
        "select * from public.feedback",
        "select * from public.roadmaps",
        "select * from public.roadmap_tasks",
        "delete from public.published_experiences",
        "update public.published_experiences set status='published'",
        "select public.claim_reminders(20)",
        "select public.consume_request('abuse',100)",
      ]) {
        await expect(db.exec(sql)).rejects.toThrow(/permission denied/);
      }
    } finally {
      await db.exec("reset role");
    }
  }
});
it("management checks token scope, request idempotency and optimistic revision", async () => {
  await create();
  expect(
    (await db.query("select * from public.experiences")).rows,
  ).toHaveLength(1);
  await expect(create(first, other)).rejects.toThrow(/token/);
  await expect(
    db.query("select public.manage_contribution($1,$2,'read')", [first, other]),
  ).rejects.toThrow(/token/);
  await create(second, other);
  await expect(
    db.query(
      "select public.manage_contribution($1,$2,'withdraw',null,null,false,1)",
      [second, hash],
    ),
  ).rejects.toThrow(/token/);
  await expect(
    db.query(
      "select public.manage_contribution($1,$2,'withdraw',null,null,false,0)",
      [first, hash],
    ),
  ).rejects.toThrow(/Revision conflict/);
});
it("editing and withdrawal invalidate public copies, preserve original history, and prevent stale reapproval", async () => {
  await db.query(
    "select public.manage_contribution($1,$2,'edit',$3::jsonb,$4::jsonb,true,1)",
    [
      first,
      hash,
      JSON.stringify({ ...original, role_title: "Revised Role" }),
      JSON.stringify({ ...candidate, role_title: "Revised Role" }),
    ],
  );
  expect(
    (
      await db.query("select * from public.published_experiences where id=$1", [
        first,
      ])
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "select * from public.submission_versions where experience_id=$1",
        [first],
      )
    ).rows,
  ).toHaveLength(2);
  await expect(approve(first, 1)).rejects.toThrow(/eligible/);
  await approve(first, 2);
  await db.query(
    "select public.manage_contribution($1,$2,'withdraw',null,null,false,2)",
    [first, hash],
  );
  expect(
    (
      await db.query("select * from public.published_experiences where id=$1", [
        first,
      ])
    ).rows,
  ).toHaveLength(0);
  await expect(approve(first, 3)).rejects.toThrow(/eligible/);
});
it("private saves and unreviewed content cannot be approved", async () => {
  const id = "33333333-3333-4333-8333-333333333333";
  await create(id, "c".repeat(64), { ...original, consent_to_publish: false });
  await expect(approve(id)).rejects.toThrow(/eligible/);
  await expect(
    db.query(
      "select public.create_contribution($1,$2::jsonb,$3::jsonb,$4,false)",
      [
        "44444444-4444-4444-8444-444444444444",
        JSON.stringify(original),
        JSON.stringify(candidate),
        "d".repeat(64),
      ],
    ),
  ).rejects.toThrow(/review/);
});
it("reminder claims are atomic, leased, retried and suppressed on completion or opt-out", async () => {
  const id = "55555555-5555-4555-8555-555555555555";
  await db.query(
    "insert into public.reminders(id,experience_type,end_date,email,consent,management_hash,unsubscribe_hash,next_attempt_at) values($1,'Internship',current_date,'private@example.com',true,$2,$3,now()-interval '1 minute')",
    [id, "e".repeat(64), "f".repeat(64)],
  );
  const firstClaim = await db.query<{ id: string; claim_token: string }>(
    "select * from public.claim_reminders(20)",
  );
  expect(firstClaim.rows).toHaveLength(1);
  expect(
    (await db.query("select * from public.claim_reminders(20)")).rows,
  ).toHaveLength(0);
  await db.query("select public.finish_reminder($1,$2,false,$3)", [
    id,
    firstClaim.rows[0].claim_token,
    "provider unavailable",
  ]);
  expect(
    (await db.query("select status from public.reminders where id=$1", [id]))
      .rows[0],
  ).toEqual({ status: "retry" });
  await db.query(
    "update public.reminders set next_attempt_at=now()-interval '1 minute' where id=$1",
    [id],
  );
  await db.query("select * from public.claim_reminders(20)");
  await db.query(
    "update public.reminders set status='unsubscribed',claim_token=null where id=$1",
    [id],
  );
  expect(
    (await db.query("select * from public.claim_reminders(20)")).rows,
  ).toHaveLength(0);
});
it("a valid reminder capability suppresses dispatch atomically with contribution creation", async () => {
  const r = "66666666-6666-4666-8666-666666666666";
  const rid = "77777777-7777-4777-8777-777777777777";
  await db.query(
    "insert into public.reminders(id,experience_type,end_date,email,consent,management_hash,unsubscribe_hash,next_attempt_at) values($1,'Internship',current_date,'other@example.com',true,$2,$3,now()-interval '1 minute')",
    [r, "1".repeat(64), "2".repeat(64)],
  );
  await db.query(
    "select public.create_contribution($1,$2::jsonb,$3::jsonb,$4,true,$5,$6)",
    [
      rid,
      JSON.stringify(original),
      JSON.stringify(candidate),
      "3".repeat(64),
      r,
      "1".repeat(64),
    ],
  );
  expect(
    (await db.query("select status from public.reminders where id=$1", [r]))
      .rows[0],
  ).toEqual({ status: "completed" });
});
it("backend rate limiting counts atomically and denies over quota", async () => {
  const values = [];
  for (let i = 0; i < 3; i++) {
    const result = await db.query<{ allowed: boolean }>(
      "select public.consume_request('bucket',2) as allowed",
    );
    values.push(result.rows[0].allowed);
  }
  expect(values).toEqual([true, true, false]);
});

it("legacy records cannot be claimed through submit even with future timestamps", async () => {
  const id = "88888888-8888-4888-8888-888888888888";
  await db.query(
    "insert into public.experiences select (jsonb_populate_record(null::public.experiences,$1::jsonb)).*",
    [
      JSON.stringify({
        ...original,
        id,
        status: "published",
        revision: 1,
        outcomes: "",
        culture: "",
        created_at: "2099-01-01T00:00:00Z",
        updated_at: "2099-01-01T00:00:00Z",
      }),
    ],
  );
  await expect(create(id, "8".repeat(64))).rejects.toThrow(/trusted recovery/);
  expect(
    (
      await db.query(
        "select * from public.submission_controls where experience_id=$1",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
});
it("expired final leases and provider idempotency windows terminate safely", async () => {
  for (const [id, attempts, hours] of [
    ["99999999-9999-4999-8999-999999999999", 3, 1],
    ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", 1, 25],
  ] as const) {
    await db.query(
      "insert into public.reminders(id,experience_type,end_date,email,consent,management_hash,unsubscribe_hash,next_attempt_at,status,attempts,first_attempt_at,lease_until) values($1,'Internship',current_date,'test@example.com',true,$2,$3,now()-interval '1 hour','processing',$4,now()-interval '1 hour'*$5,now()-interval '1 minute')",
      [
        id,
        id[0].repeat(64),
        (id[0] === "9" ? "b" : "c").repeat(64),
        attempts,
        hours,
      ],
    );
  }
  expect(
    (await db.query("select * from public.claim_reminders(20)")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "select status from public.reminders where id in ('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
      )
    ).rows,
  ).toEqual([{ status: "failed" }, { status: "failed" }]);
});
