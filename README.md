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

## Deploy to Railway

The repo is preconfigured for Railway with a **persistent Node** setup (not
serverless — agentic runs take minutes). You'll create **one Railway project**
with **three components**: a Postgres database, a **web** service, and a
**worker** service, both deployed from this same repo.

Config files in the repo:

- `railway.json` — web service: builds the app, runs DB migrations + seed in the
  pre-deploy step (`npm run release`), starts `next start`, healthchecks `/login`.
- `railway.worker.json` — worker service: generates the Prisma client and runs
  `npm run worker:prod` (the graphile-worker job runner).
- `prisma/migrations/` — baseline migration applied by `prisma migrate deploy`.

### Steps

1. **Create the project & database**
   - New Project → **Deploy from GitHub repo** (this repo).
   - **+ New → Database → PostgreSQL.**

2. **Web service** (the service created from the repo) — auto-uses `railway.json`.
   Set just **two** variables (Settings → Variables):
     - `DATABASE_URL` → reference the Postgres var: `${{Postgres.DATABASE_URL}}`
     - `SECRETS_KEY` → `openssl rand -base64 32` (**keep stable** — rotating it
       makes stored Gemini/Ghost keys undecryptable)

   Then **Networking → Generate Domain** for the public URL. Everything else has
   safe defaults (see "Optional variables" below).

3. **Worker service**
   - **+ New → GitHub Repo →** select this same repo again.
   - **Settings → Config-as-code / Railway Config File** → set the path to
     `railway.worker.json`. (If you don't see that option, instead set the
     service's **Build Command** to `npm run db:generate` and **Start Command**
     to `npm run worker:prod`.)
   - Set the **same `DATABASE_URL` and `SECRETS_KEY`** as the web service — the
     worker needs `SECRETS_KEY` to decrypt the Gemini/Ghost keys.
   - The worker has **no public domain** and no healthcheck — it's a background
     process.

4. **Deploy.** The web service's pre-deploy step runs `prisma migrate deploy`
   (creates all tables) then seeds the first user (idempotent). Sign in at your
   domain and finish setup in **Settings** (add the Gemini + Ghost keys there).

### Optional variables (defaults shown)

| Variable | Default | Notes |
| --- | --- | --- |
| `AUTH_SECRET` | falls back to `SECRETS_KEY` | session/JWT signing |
| `AUTH_URL` | inferred from request headers | set if you want it explicit |
| `SEED_USER_EMAIL` | `admin@flo.finance` | first login email |
| `SEED_USER_PASSWORD` | `changeme123` | **set this before first deploy** |
| `SEED_USER_NAME` | `Admin` | display name |
| `HERO_IMAGE_DIR` | `storage/hero-images` | set to `/app/storage/hero-images` + attach a Volume to persist hero PNGs across restarts (they're also re-generatable on demand) |

### Notes

- Both services build from the same repo; only the web service runs migrations
  (the worker must not, to avoid races).
- `next start` automatically binds to Railway's injected `PORT`.
- `SECRETS_KEY` must be **identical** across web and worker and must not change,
  or previously-encrypted secrets can't be read.

Render and Fly.io work the same way (web + worker processes against managed
Postgres); only the config-file format differs.
