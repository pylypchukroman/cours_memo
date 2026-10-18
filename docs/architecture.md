# Course Memo — Architecture

A student assistant with long-term course memory. Answers are formed **only** from uploaded VTT transcripts, with a citation to the lesson and timestamp.

## Principles

1. **Context isolation** — the model sees only the selected course for the current user. Isolation comes from PostgreSQL RLS, a server-side membership check, and retrieval filtered by `course_id`. The prompt alone does not isolate context.
2. **Evidence-first** — every factual claim has a citation (lesson, file, start/end time, excerpt). No evidence means `insufficient_evidence`.
3. **Immutable archive + structured memory** — the raw transcript is never overwritten. Structured course memory accumulates with an audit trail (`supersedes_item_id`).
4. **No external knowledge** — no web search, no outside sources, and no guesses beyond the transcripts.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), TypeScript strict, Tailwind CSS 4, shadcn/ui |
| Auth & DB | Supabase Auth, PostgreSQL, pgvector, RLS |
| Storage | Supabase Storage (private bucket) |
| AI | OpenAI Responses API (`store: false`), Structured Outputs, embeddings |
| Background jobs | Postgres `processing_jobs` + worker `pnpm jobs:dev` |
| Tests | Vitest (unit/integration), Playwright (e2e) |

## Assumptions (MVP)

- **Auth:** email + password / magic link via Supabase
- **Course ownership:** one owner per course (`course_members`); sharing later
- **UI language:** English
- **Schema:** `course_memory_items` instead of separate `tasks`, `concepts`, … tables — type via `item_type` plus JSONB `metadata`
- **Raw extraction:** `lesson_events` is the immutable model output per lesson
- **Background jobs:** a `processing_jobs` table and the local worker `pnpm jobs:dev` (parse → embed → extract → reconcile). Trigger.dev is not used.

## Data layers

### 1. Immutable source archive

```
source_files → transcript_segments → chunks (+ embedding)
```

- Original VTT files in private storage
- Normalized segments (speaker, text, start/end)
- Chunks of about 500–800 tokens with overlap for vector search

### 2. Structured course memory

```
lesson_events (per lesson, model extraction)
    ↓ reconcile
course_memory_items (+ course_memory_versions)
```

- Lesson events: concepts, tasks, assessments, promises, corrections, …
- Reconcile: add / supersede / cancel, with history and no silent overwrite

## Request flows

### Upload VTT

```
Client → POST /api/courses/:courseId/upload
  → validate (mime, size, extension)
  → SHA-256 dedup
  → Supabase Storage
  → processing_jobs (pending)
  → pnpm jobs:dev: parse → segments → chunks → embed → extract → reconcile
```

### Chat (local retrieval)

```
Client → POST /api/.../chat
  → verify course membership
  → embed question
  → match_course_chunks(course_id)  [RLS-safe RPC]
  → OpenAI Responses API (chunks only)
  → validate citations server-side
  → stream response
```

### Chat (global query)

```
Classifier → query course_memory_items by type/status
  → attach evidence chunks
  → OpenAI Responses API
  → validate citations
```

## Security

- Private storage bucket; signed URLs with a short TTL
- Service role key only on the server and in the `pnpm jobs:dev` worker
- RLS on every user-owned table
- Upload: max 5 MB, `.vtt` only
- Rate limiting on upload and chat
- Transcript content is data, not instructions (prompt-injection defense)
- Production logs: token usage only, no transcript text and no full prompts

## Repository layout

```
src/
  app/           # pages + API routes
  components/    # UI (shadcn + domain)
  lib/           # supabase, openai, vtt, memory, chat, retrieval
  pipeline/      # worker that claims processing_jobs
supabase/
  migrations/    # schema, RLS, vector functions
tests/
  unit/          # Vitest
  integration/   # Vitest + DB
  e2e/           # Playwright
eval/            # query evaluation dataset
docs/            # architecture (this file)
```

## Environment variables

See [`.env.example`](../.env.example) for the full list.

## Implementation phases

1. **Accounts and courses:** Supabase Auth, `courses` / `course_members`, dashboard
2. **Archive and cited chat:** VTT upload, worker, embeddings, chunk chat with citations
3. **Course memory:** extraction, reconcile, global queries, memory UI
4. **Hardening:** rate limits, citation checks, usage-only logs, eval set, integration tests

## Out of scope (MVP)

Teacher dashboard, live recording, video analysis, LMS integrations, payments, mobile app, fine-tuning, and complex agent orchestration.
