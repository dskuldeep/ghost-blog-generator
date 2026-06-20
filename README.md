# Flo Blog Generator

AI-powered blog generation and publishing for [Ghost](https://ghost.org). Upload
a list of topics, fine-tune a `.skill` that defines your blog's voice and rules,
and let an **agentic Gemini pipeline** research, draft, self-evaluate, and revise
each post — then publish to Ghost with an auto-generated hero image.

## Features

- **Agentic writer** — outline → grounded web research (Google Search) → draft →
  critic evaluation → revise loop, using Gemini with structured output.
- **Skill playground** — upload/edit a `.skill` (a `SKILL.md` + reference files),
  test it on a sample topic with a live agent log, version it, and download it.
- **Background jobs + live log** — generation runs server-side as tracked jobs;
  the UI streams each step over SSE.
- **Blog editor** — review/edit HTML + metadata, regenerate a minimal modern
  hero image, and push to Ghost as a draft or live post.
- **Encrypted secrets** — Gemini and Ghost keys are AES-256-GCM encrypted at rest.

## Tech stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Postgres + Prisma ·
Auth.js (credentials) · `@google/genai` · graphile-worker · `next/og` (hero
images) · `@tryghost/admin-api`.

## Prerequisites

- Node.js 20+
- A Postgres database. Options:
  - **Docker:** `docker compose up -d` (uses `docker-compose.yml`).
  - **Homebrew:** `brew install postgresql@16 && brew services start postgresql@16`,
    then create a DB and update `DATABASE_URL`.
  - **Hosted:** a free Neon/Supabase Postgres; set `DATABASE_URL` accordingly.
- A [Gemini API key](https://aistudio.google.com/apikey).
- A Ghost site with a **Custom Integration** (Settings → Integrations) to get the
  Admin API URL + key.

## Setup

```bash
# 1. Install deps
npm install

# 2. Configure env
cp .env.example .env
#   - set DATABASE_URL (a .env with local defaults is already provided)
#   - AUTH_SECRET and SECRETS_KEY are pre-generated for local dev; rotate for prod
#   - set SEED_USER_EMAIL / SEED_USER_PASSWORD

# 3. Start Postgres (if using Docker)
docker compose up -d

# 4. Create schema + seed the first user
npm run db:push
npm run db:seed

# 5. Run the app and the worker (two terminals)
npm run dev       # http://localhost:3000
npm run worker    # processes generation jobs
```

> The **worker must be running** for blog generation jobs to execute. The web app
> enqueues jobs; the worker drains them.

## Usage

1. **Sign in** with the seeded user.
2. **Settings** → add your Gemini API key + model and Ghost Admin URL/key. Use
   the **Test connection** buttons. Tune agent behavior and hero image style.
3. **Skill Playground** → upload `examples/blog-writer.skill` (or create a blank
   skill). Edit `SKILL.md` and reference files, **Run test** on a sample topic to
   watch the agent work, then **Save version** / **Download**.
4. **Topics** → paste topics (one per line; optional brief after ` | `), pick the
   skill, and **Generate** (single or all pending).
5. **Runs** → watch the live agent log stream through research/draft/evaluate.
6. **Blogs** → review/edit the draft + metadata, **Generate hero**, then
   **Push to Ghost** as a draft or live post.

## Architecture

```
app/                 Next.js routes (UI + API)
  (app)/             Authenticated panels: topics, runs, blogs, skills, settings
  api/               Route handlers (settings, skills, topics, runs, blogs)
lib/
  agent/             Agentic pipeline: orchestrator, prompts, schemas, llm helpers
  image/hero.tsx     ImageResponse hero image template + storage
  skill.ts           .skill (zip) parse/pack + frontmatter
  run-service.ts     Run lifecycle + event logging (shared by API + worker)
  queue.ts           graphile-worker enqueue
  ghost.ts           Ghost Admin API publish
  crypto.ts          AES-256-GCM secret encryption
worker/index.ts      Background job runner (graphile-worker)
prisma/schema.prisma Data model
examples/            Sample .skill package
```

## Deployment

Deploy to a **persistent Node host** (Railway, Render, Fly.io) rather than
serverless — agentic runs take minutes and would exceed serverless time limits.
Run the web process (`npm run start`) and the worker (`npm run worker`) against a
managed Postgres. Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, and
`SECRETS_KEY` (rotate the dev values). Hero images are written to
`HERO_IMAGE_DIR`; mount a persistent volume there if you want them to survive
restarts (they are also re-generatable on demand).
