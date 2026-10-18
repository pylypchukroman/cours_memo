-- Course Memo schema: courses, transcript archive, memory, and rate limits.
-- Background work is claimed by the in-repo worker via claim_processing_job.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_title_length check (char_length(btrim(title)) between 1 and 200)
);

create table public.course_members (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (course_id, user_id),
  constraint course_members_role_owner check (role = 'owner')
);

create index course_members_user_id_idx on public.course_members (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

create or replace function public.handle_new_course()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.course_members (course_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger courses_add_owner
after insert on public.courses
for each row execute function public.handle_new_course();

create or replace function public.is_course_member(target_course_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_members
    where course_id = target_course_id
      and user_id = auth.uid()
  );
$$;

alter table public.courses enable row level security;
alter table public.course_members enable row level security;

create policy courses_select on public.courses
for select to authenticated
using (created_by = auth.uid() or public.is_course_member(id));

create policy courses_insert on public.courses
for insert to authenticated
with check (created_by = auth.uid());

create policy courses_update on public.courses
for update to authenticated
using (
  exists (
    select 1 from public.course_members
    where course_id = courses.id and user_id = auth.uid() and role = 'owner'
  )
)
with check (created_by = auth.uid());

create policy courses_delete on public.courses
for delete to authenticated
using (
  exists (
    select 1 from public.course_members
    where course_id = courses.id and user_id = auth.uid() and role = 'owner'
  )
);

create policy course_members_select on public.course_members
for select to authenticated
using (public.is_course_member(course_id));

grant select, insert, update, delete on public.courses to authenticated;
grant select on public.course_members to authenticated;
revoke all on public.courses from anon;
revoke all on public.course_members from anon;

-- ---------------------------------------------------------------------------
-- Transcript archive
-- ---------------------------------------------------------------------------

create table public.source_files (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  original_name text not null,
  lesson_title text,
  storage_path text not null unique,
  sha256 text not null,
  byte_size integer not null,
  created_at timestamptz not null default now(),
  constraint source_files_size check (byte_size > 0 and byte_size <= 5242880),
  constraint source_files_sha unique (course_id, sha256)
);

create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references public.source_files (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  ordinal integer not null,
  speaker text,
  text text not null,
  start_ms integer not null,
  end_ms integer not null,
  unique (source_file_id, ordinal)
);

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references public.source_files (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  ordinal integer not null,
  text text not null,
  start_ms integer not null,
  end_ms integer not null,
  token_count integer not null,
  embedding extensions.vector(1536),
  unique (source_file_id, ordinal)
);

create index chunks_course_id_idx on public.chunks (course_id);
create index chunks_embedding_idx on public.chunks using hnsw (embedding extensions.vector_cosine_ops);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  source_file_id uuid not null unique references public.source_files (id) on delete cascade,
  status text not null,
  stage text not null,
  error text,
  attempts integer not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint processing_jobs_status check (status in ('pending', 'running', 'done', 'failed')),
  constraint processing_jobs_stage check (
    stage in ('parse', 'segment', 'chunk', 'embed', 'extract', 'reconcile', 'done')
  )
);

create index processing_jobs_status_created_idx on public.processing_jobs (status, created_at);

create trigger processing_jobs_set_updated_at
before update on public.processing_jobs
for each row execute function public.set_updated_at();

alter table public.source_files enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.chunks enable row level security;
alter table public.processing_jobs enable row level security;

create policy source_files_select on public.source_files
for select to authenticated
using (public.is_course_member(course_id));

create policy transcript_segments_select on public.transcript_segments
for select to authenticated
using (public.is_course_member(course_id));

create policy chunks_select on public.chunks
for select to authenticated
using (public.is_course_member(course_id));

create policy processing_jobs_select on public.processing_jobs
for select to authenticated
using (public.is_course_member(course_id));

grant select on public.source_files to authenticated;
grant select on public.transcript_segments to authenticated;
grant select on public.chunks to authenticated;
grant select on public.processing_jobs to authenticated;

revoke all on public.source_files from anon;
revoke all on public.transcript_segments from anon;
revoke all on public.chunks from anon;
revoke all on public.processing_jobs from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('transcripts', 'transcripts', false, 5242880, array['text/vtt', 'text/plain'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy transcripts_select on storage.objects
for select to authenticated
using (
  bucket_id = 'transcripts'
  and public.is_course_member(((storage.foldername(name))[1])::uuid)
);

create or replace function public.match_course_chunks(
  target_course_id uuid,
  query_embedding extensions.vector(1536),
  match_count integer default 8
)
returns table (
  id uuid,
  source_file_id uuid,
  text text,
  start_ms integer,
  end_ms integer,
  original_name text,
  lesson_title text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    c.source_file_id,
    c.text,
    c.start_ms,
    c.end_ms,
    s.original_name,
    s.lesson_title,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  join public.source_files s on s.id = c.source_file_id
  where c.course_id = target_course_id
    and public.is_course_member(target_course_id)
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_course_chunks(uuid, extensions.vector, integer) from public;
revoke all on function public.match_course_chunks(uuid, extensions.vector, integer) from anon;
grant execute on function public.match_course_chunks(uuid, extensions.vector, integer) to authenticated;

create or replace function public.claim_processing_job()
returns setof public.processing_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  job_id uuid;
begin
  select id into job_id
  from public.processing_jobs
  where status = 'pending'
     or (status = 'running' and locked_at < now() - interval '15 minutes')
  order by created_at
  for update skip locked
  limit 1;

  if job_id is null then
    return;
  end if;

  return query
  update public.processing_jobs
  set
    status = 'running',
    locked_at = now(),
    attempts = attempts + 1,
    updated_at = now(),
    error = null
  where id = job_id
  returning *;
end;
$$;

revoke all on function public.claim_processing_job() from public;
revoke all on function public.claim_processing_job() from anon;
revoke all on function public.claim_processing_job() from authenticated;
grant execute on function public.claim_processing_job() to service_role;

-- ---------------------------------------------------------------------------
-- Course memory
-- ---------------------------------------------------------------------------

create table public.lesson_events (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  source_file_id uuid not null references public.source_files (id) on delete cascade,
  item_type text not null,
  title text not null,
  summary text not null,
  start_ms integer,
  end_ms integer,
  excerpt text not null,
  chunk_id uuid references public.chunks (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lesson_events_item_type check (
    item_type in ('concept', 'task', 'assessment', 'promise', 'correction')
  )
);

create table public.course_memory_items (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  item_type text not null,
  status text not null default 'active',
  title text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  supersedes_item_id uuid references public.course_memory_items (id),
  source_file_id uuid references public.source_files (id) on delete set null,
  chunk_id uuid references public.chunks (id) on delete set null,
  start_ms integer,
  end_ms integer,
  excerpt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_memory_items_item_type check (
    item_type in ('concept', 'task', 'assessment', 'promise', 'correction')
  ),
  constraint course_memory_items_status check (
    status in ('active', 'superseded', 'cancelled')
  )
);

create index course_memory_items_course_status_idx
  on public.course_memory_items (course_id, status, item_type);

create trigger course_memory_items_set_updated_at
before update on public.course_memory_items
for each row execute function public.set_updated_at();

create table public.course_memory_versions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.course_memory_items (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  action text not null,
  snapshot jsonb not null,
  lesson_event_id uuid unique references public.lesson_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint course_memory_versions_action check (action in ('add', 'supersede', 'cancel'))
);

alter table public.lesson_events enable row level security;
alter table public.course_memory_items enable row level security;
alter table public.course_memory_versions enable row level security;

create policy lesson_events_select on public.lesson_events
for select to authenticated
using (public.is_course_member(course_id));

create policy course_memory_items_select on public.course_memory_items
for select to authenticated
using (public.is_course_member(course_id));

create policy course_memory_versions_select on public.course_memory_versions
for select to authenticated
using (public.is_course_member(course_id));

grant select on public.lesson_events to authenticated;
grant select on public.course_memory_items to authenticated;
grant select on public.course_memory_versions to authenticated;

revoke all on public.lesson_events from anon;
revoke all on public.course_memory_items from anon;
revoke all on public.course_memory_versions from anon;

create or replace function public.apply_memory_action(
  p_lesson_event_id uuid,
  p_action text,
  p_target_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.lesson_events;
  new_id uuid;
begin
  if p_action not in ('add', 'supersede', 'cancel') then
    raise exception 'invalid action';
  end if;

  select * into ev from public.lesson_events where id = p_lesson_event_id;
  if not found then
    raise exception 'missing lesson event';
  end if;

  if exists (
    select 1 from public.course_memory_versions where lesson_event_id = p_lesson_event_id
  ) then
    return;
  end if;

  if p_action = 'add' then
    insert into public.course_memory_items (
      course_id, item_type, status, title, summary, metadata,
      source_file_id, chunk_id, start_ms, end_ms, excerpt
    ) values (
      ev.course_id, ev.item_type, 'active', ev.title, ev.summary,
      jsonb_build_object('lesson_event_id', ev.id),
      ev.source_file_id, ev.chunk_id, ev.start_ms, ev.end_ms, ev.excerpt
    ) returning id into new_id;

    insert into public.course_memory_versions (item_id, course_id, action, snapshot, lesson_event_id)
    values (
      new_id,
      ev.course_id,
      'add',
      jsonb_build_object('title', ev.title, 'summary', ev.summary),
      ev.id
    );
    return;
  end if;

  if p_target_item_id is null then
    raise exception 'target required';
  end if;

  if not exists (
    select 1 from public.course_memory_items
    where id = p_target_item_id
      and course_id = ev.course_id
      and status = 'active'
  ) then
    raise exception 'target not active';
  end if;

  if p_action = 'cancel' then
    update public.course_memory_items
    set status = 'cancelled', updated_at = now()
    where id = p_target_item_id;

    insert into public.course_memory_versions (item_id, course_id, action, snapshot, lesson_event_id)
    values (
      p_target_item_id,
      ev.course_id,
      'cancel',
      jsonb_build_object('title', ev.title, 'summary', ev.summary),
      ev.id
    );
    return;
  end if;

  update public.course_memory_items
  set status = 'superseded', updated_at = now()
  where id = p_target_item_id;

  insert into public.course_memory_items (
    course_id, item_type, status, title, summary, metadata,
    supersedes_item_id, source_file_id, chunk_id, start_ms, end_ms, excerpt
  ) values (
    ev.course_id, ev.item_type, 'active', ev.title, ev.summary,
    jsonb_build_object('lesson_event_id', ev.id),
    p_target_item_id, ev.source_file_id, ev.chunk_id, ev.start_ms, ev.end_ms, ev.excerpt
  ) returning id into new_id;

  insert into public.course_memory_versions (item_id, course_id, action, snapshot, lesson_event_id)
  values (
    new_id,
    ev.course_id,
    'supersede',
    jsonb_build_object(
      'title', ev.title,
      'summary', ev.summary,
      'supersedes_item_id', p_target_item_id
    ),
    ev.id
  );
end;
$$;

revoke all on function public.apply_memory_action(uuid, text, uuid) from public;
revoke all on function public.apply_memory_action(uuid, text, uuid) from anon;
revoke all on function public.apply_memory_action(uuid, text, uuid) from authenticated;
grant execute on function public.apply_memory_action(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Rate limits (limits are fixed here so clients cannot raise them)
-- ---------------------------------------------------------------------------

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now(),
  constraint rate_limit_events_action check (action in ('upload', 'chat'))
);

create index rate_limit_events_lookup_idx
  on public.rate_limit_events (user_id, action, created_at);

alter table public.rate_limit_events enable row level security;

revoke all on public.rate_limit_events from anon, authenticated;

create or replace function public.consume_rate_limit(target_action text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  max_count integer;
  current_count integer;
begin
  if uid is null then
    return false;
  end if;

  if target_action = 'upload' then
    max_count := 10;
  elsif target_action = 'chat' then
    max_count := 30;
  else
    return false;
  end if;

  select count(*) into current_count
  from public.rate_limit_events
  where user_id = uid
    and action = target_action
    and created_at > now() - interval '1 hour';

  if current_count >= max_count then
    return false;
  end if;

  insert into public.rate_limit_events (user_id, action)
  values (uid, target_action);

  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text) from public;
revoke all on function public.consume_rate_limit(text) from anon;
grant execute on function public.consume_rate_limit(text) to authenticated;
