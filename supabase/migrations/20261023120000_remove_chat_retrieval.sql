-- Chat was removed from Course Memo, so vector retrieval and chat rate limits
-- no longer have a caller. Keep transcript chunks for course-memory extraction.

drop function if exists public.match_course_chunks(uuid, extensions.vector, integer);
drop index if exists public.chunks_embedding_idx;
alter table public.chunks drop column if exists embedding;

alter table public.processing_jobs drop constraint if exists processing_jobs_stage;
alter table public.processing_jobs add constraint processing_jobs_stage check (
  stage in ('parse', 'segment', 'chunk', 'extract', 'reconcile', 'study', 'done')
);

delete from public.rate_limit_events where action = 'chat';
alter table public.rate_limit_events drop constraint if exists rate_limit_events_action;
alter table public.rate_limit_events add constraint rate_limit_events_action check (action = 'upload');

create or replace function public.consume_rate_limit(target_action text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_count integer;
begin
  if uid is null or target_action <> 'upload' then
    return false;
  end if;

  select count(*) into current_count
  from public.rate_limit_events
  where user_id = uid
    and action = 'upload'
    and created_at > now() - interval '1 hour';

  if current_count >= 10 then
    return false;
  end if;

  insert into public.rate_limit_events (user_id, action)
  values (uid, 'upload');

  return true;
end;
$$;
