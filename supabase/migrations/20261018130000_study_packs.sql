-- Lesson metadata, nullable timestamps, and source-linked study packs.
-- Student completion and review live in study_item_states so reprocessing can replace the pack.

alter table public.source_files
  add column lesson_date date,
  add column timezone text not null default 'Australia/Sydney',
  add column unit_code text,
  add column subject text;

alter table public.source_files
  add constraint source_files_timezone_length check (char_length(timezone) between 1 and 64);

alter table public.source_files
  add constraint source_files_unit_code_length check (unit_code is null or char_length(unit_code) <= 40);

alter table public.source_files
  add constraint source_files_subject_length check (subject is null or char_length(subject) <= 120);

alter table public.transcript_segments alter column start_ms drop not null;
alter table public.transcript_segments alter column end_ms drop not null;
alter table public.chunks alter column start_ms drop not null;
alter table public.chunks alter column end_ms drop not null;

alter table public.processing_jobs drop constraint processing_jobs_stage;
alter table public.processing_jobs add constraint processing_jobs_stage check (
  stage in ('parse', 'segment', 'chunk', 'embed', 'extract', 'reconcile', 'study', 'done')
);

create table public.lesson_study_packs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  source_file_id uuid not null unique references public.source_files (id) on delete cascade,
  schema_version text not null,
  pack jsonb not null,
  model text not null,
  prompt_version text not null,
  input_sha text not null,
  processing_ms integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger lesson_study_packs_set_updated_at
before update on public.lesson_study_packs
for each row execute function public.set_updated_at();

create table public.study_item_states (
  course_id uuid not null references public.courses (id) on delete cascade,
  source_file_id uuid not null references public.source_files (id) on delete cascade,
  item_key text not null,
  completion_status text not null default 'todo',
  review_status text not null default 'pending',
  note text,
  updated_at timestamptz not null default now(),
  primary key (source_file_id, item_key),
  constraint study_item_states_completion check (completion_status in ('todo', 'done', 'unknown')),
  constraint study_item_states_review check (review_status in ('pending', 'confirmed', 'corrected', 'dismissed')),
  constraint study_item_states_note_length check (note is null or char_length(note) <= 2000)
);

create trigger study_item_states_set_updated_at
before update on public.study_item_states
for each row execute function public.set_updated_at();

alter table public.lesson_study_packs enable row level security;
alter table public.study_item_states enable row level security;

create policy lesson_study_packs_select on public.lesson_study_packs
for select to authenticated
using (public.is_course_member(course_id));

create policy study_item_states_select on public.study_item_states
for select to authenticated
using (public.is_course_member(course_id));

create policy study_item_states_insert on public.study_item_states
for insert to authenticated
with check (public.is_course_member(course_id));

create policy study_item_states_update on public.study_item_states
for update to authenticated
using (public.is_course_member(course_id))
with check (public.is_course_member(course_id));

create policy study_item_states_delete on public.study_item_states
for delete to authenticated
using (public.is_course_member(course_id));

grant select on public.lesson_study_packs to authenticated;
grant select, insert, update, delete on public.study_item_states to authenticated;

revoke all on public.lesson_study_packs from anon;
revoke all on public.study_item_states from anon;
