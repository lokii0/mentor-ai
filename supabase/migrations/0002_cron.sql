-- Hourly push tick (the function itself enforces quiet hours 23–06, the 2 h limit and back-off).
-- Before running: replace <PROJECT_REF> and <CRON_SECRET> (the same value you set as the
-- function secret CRON_SECRET). Run in Supabase → SQL Editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('mentor-push-tick') where exists (select 1 from cron.job where jobname = 'mentor-push-tick');

select cron.schedule(
  'mentor-push-tick',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
