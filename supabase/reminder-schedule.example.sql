-- OPTIONAL MANUAL SETUP ONLY. Not a migration; no hosted scheduler has been created.
-- Enable pg_cron, pg_net and Supabase Vault through trusted project administration.
-- In Vault, store: echopath_function_url (full HTTPS /functions/v1/echopath URL)
-- and echopath_reminder_cron_secret (same value as the Edge Function secret).
-- Never paste real secrets into version control or public browser tools.
select cron.schedule(
  'echopath-debrief-reminders',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='echopath_function_url'),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='echopath_reminder_cron_secret')
    ),
    body := '{"action":"dispatch-reminders"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);
-- Inspect cron.job / cron.job_run_details and function logs after setting up in your project.
-- To stop: select cron.unschedule('echopath-debrief-reminders');
