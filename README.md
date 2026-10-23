# Course Memo

Course Memo turns lesson transcripts into source-linked study materials: summaries, tasks, assessment checklists, lab guides, revision cards, and confirmed-deadline calendar exports.

## Local development

1. Copy `.env.example` to `.env.local` and fill in the local Supabase keys and an OpenAI API key.
2. Start Docker and Supabase:

```bash
pnpm supabase:start
pnpm supabase:status
```

3. Run the web app and transcript worker in separate terminals:

```bash
pnpm dev
pnpm jobs:dev
```

Open [http://localhost:3000](http://localhost:3000). The health endpoint is available at `/api/health`.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm test:integration` while local Supabase is running. See `docs/architecture.md` for the data flow and security model.
