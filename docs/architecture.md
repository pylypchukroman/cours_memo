# Course Memo — Architecture

Студентський AI-помічник з довготривалою пам'яттю курсу. Відповіді формуються **лише** з завантажених VTT-транскриптів із цитуванням уроку та таймкоду.

## Принципи

1. **Context isolation** — AI бачить тільки матеріали вибраного курсу поточного користувача. Ізоляція забезпечується RLS у PostgreSQL, server-side перевіркою membership і фільтрацією retrieval за `course_id`. Промпт сам по собі не izoluye.
2. **Evidence-first** — кожне фактичне твердження має citation (lesson, file, start/end time, excerpt). Без evidence → `insufficient_evidence`.
3. **Immutable archive + structured memory** — сирий транскрипт не перезаписується; структурована пам'ять курсу накопичується з audit trail (`supersedes_item_id`).
4. **No external knowledge** — без web search, без зовнішніх джерел, без «догадок» моделі поза транскриптами.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), TypeScript strict, Tailwind CSS 4, shadcn/ui |
| Auth & DB | Supabase Auth, PostgreSQL, pgvector, RLS |
| Storage | Supabase Storage (private bucket) |
| AI | OpenAI Responses API (`store: false`), Structured Outputs, embeddings |
| Background jobs | Trigger.dev v3 |
| Tests | Vitest (unit/integration), Playwright (e2e) |

## Assumptions (MVP)

- **Auth:** email + password / magic link через Supabase
- **Course ownership:** один owner на курс (`course_members`); sharing пізніше
- **UI language:** українська
- **Schema:** `course_memory_items` замість окремих таблиць `tasks`, `concepts`, … — тип через `item_type` + JSONB `metadata`
- **Raw extraction:** `lesson_events` — immutable output AI per lesson
- **Background jobs:** Trigger.dev для VTT pipeline (parse → embed → extract → reconcile)

## Data layers

### 1. Immutable source archive

```
source_files → transcript_segments → chunks (+ embedding)
```

- Оригінальні VTT у private storage
- Нормалізовані segments (speaker, text, start/end)
- Chunks ~500–800 tokens з overlap для vector search

### 2. Structured Course Memory

```
lesson_events (per lesson, AI extraction)
    ↓ reconcile
course_memory_items (+ course_memory_versions)
```

- Події уроку: concepts, tasks, assessments, promises, corrections, …
- Reconcile: add / supersede / cancel з історією, без silent overwrite

## Request flows

### Upload VTT

```
Client → POST /api/.../upload
  → validate (mime, size, extension)
  → SHA-256 dedup
  → Supabase Storage
  → processing_jobs (pending)
  → Trigger.dev: parse → segments → chunks → embed → extract → reconcile
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

- Private storage bucket; signed URLs з коротким TTL
- Service role key тільки на server / Trigger.dev
- RLS на всіх user-owned таблицях
- Upload: max 5 MB, `.vtt` only
- Rate limiting на upload і chat
- Transcript content = data, not instructions (prompt injection defense)
- Production logs: token usage only, без transcript text і full prompts

## Repository layout

```
src/
  app/           # pages + API routes
  components/    # UI (shadcn + domain)
  lib/           # supabase, openai, vtt, pipeline, memory, chat, retrieval
  trigger/       # Trigger.dev tasks
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

1. **Foundation (steps 1–6):** Next.js, auth, courses, dashboard
2. **Vertical slice (steps 7–14):** VTT upload → embeddings → local chat with citations
3. **Course Memory (steps 15–20):** extraction, reconcile, global queries, full UI, hardening

## Out of scope (MVP)

Teacher dashboard, live recording, video analysis, LMS integrations, payments, mobile app, fine-tuning, complex agent orchestration.
