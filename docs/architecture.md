# Course Memo — Architecture

Course Memo turns uploaded lesson transcripts into source-linked study materials and a structured course history.

## Principles

1. **Course isolation** — PostgreSQL RLS and server-side membership checks scope every read and write to the signed-in course owner.
2. **Evidence first** — extracted claims keep a verbatim quote and the original timestamp when one exists. Unmatched quotes are discarded.
3. **Immutable source** — the uploaded transcript is retained in private storage; derived records can be rebuilt without changing it.
4. **Untrusted transcripts** — transcript text is model input, never instructions. Extracted commands are displayed but never executed.

## Stack

- Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 4
- Supabase Auth, PostgreSQL, Row Level Security, and private Storage
- OpenAI Responses API with strict structured outputs and `store: false`
- A local worker that claims rows from `processing_jobs`
- Vitest and Playwright

## Data flow

```text
source_files
  → transcript_segments
  → chunks
  → lesson_events
  → course_memory_items + course_memory_versions
  → lesson_study_packs
```

The worker processes each upload through:

```text
segment → chunk → extract → reconcile → study → done
```

- `source_files` points to the original `.vtt` or `.txt` object in private storage.
- `transcript_segments` preserves speaker and timestamp data when available.
- `chunks` groups transcript text for course-memory extraction.
- `lesson_events` stores extracted concepts, tasks, assessments, promises, and corrections.
- reconciliation adds, supersedes, or cancels course-memory items while retaining history.
- `lesson_study_packs` stores the validated overview, tasks, assessments, labs, glossary, troubleshooting, flashcards, and quizzes.
- `study_item_states` stores student completion, review, and notes separately so rebuilds do not erase them.

## Upload flow

```text
POST /api/courses/:courseId/upload
  → verify membership and validate metadata/file
  → reject duplicate SHA-256 content
  → consume the upload rate limit
  → save to private storage
  → create source file and processing job
```

The upload limit is 10 per authenticated user per hour. Files are limited to 5 MB.

## Evidence and model safeguards

- Every source quote must be a whitespace-normalized substring of its cited segment.
- Missing timestamps remain `null`; relative deadlines remain unresolved unless they can be safely derived from the lesson date.
- Conflicting requirements are retained and flagged instead of silently selecting one.
- Student state is overlaid after generation and is never supplied to the model.
- Model logs contain route/model/token metadata, not transcript or prompt text.

## Security boundaries

- Authenticated clients use RLS-protected tables.
- Service-role credentials are used only by server code and the worker.
- Storage objects are private.
- The worker uses the service role to write derived data.
- OpenAI requests disable storage.

## Repository layout

```text
src/app/        pages, server actions, and API routes
src/components/ UI components
src/lib/        validation, Supabase, OpenAI, transcript, memory, and study logic
src/pipeline/   local processing worker
supabase/       local configuration and forward-only migrations
tests/          unit, integration, and browser tests
```

Environment variables are documented in [`.env.example`](../.env.example).
