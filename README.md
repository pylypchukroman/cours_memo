This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Supabase (step 3)

1. Copy `.env.example` to `.env.local`
2. **Cloud:** paste keys from the [Supabase Dashboard](https://supabase.com/dashboard) → Project Settings → API
3. **Local:** start Docker, then:

```bash
pnpm supabase:start
pnpm supabase:status   # copy the URL and keys into .env.local
```

Check the connection:

```bash
pnpm dev
curl http://localhost:3000/api/health
```

VTT processing (a separate process, after a file is uploaded to a course):

```bash
pnpm jobs:dev
```

Expected with a valid `.env.local` and a reachable Supabase:

```json
{ "status": "ok", "app": "course-memo", "supabase": { "configured": true, "reachable": true } }
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
