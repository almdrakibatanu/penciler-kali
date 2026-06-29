# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PencilerKali.com — a self-hosted Bangla news + video automation platform. A cron-driven pipeline
collects news from free RSS feeds, clusters duplicates, rewrites each cluster into one original
Bangla article (with SEO + FB caption + thumbnail), renders explainer videos, and publishes to a
Facebook page and YouTube channel. Everything that would normally be a paid SaaS (Cloudinary, TTS,
Pictory, a job queue) is reimplemented as an in-repo `pencil-*` package so the whole thing runs
locally with zero external infra (SQLite, no Redis).

## Monorepo layout

npm workspaces (`apps/*` + `packages/*`), Node ≥ 20, TypeScript ESM (`"type": "module"`).

- `apps/api` — Fastify backend (`@pk/api`): REST for the web app, the `pencil-cloud` CDN endpoint,
  `/admin` stats/triggers, the cron **scheduler**, and the **CLI**. This is the orchestrator.
- `apps/web` — Next.js 14 App Router + Tailwind (`@pk/web`), server components that fetch the API.
- `packages/db` — SQLite (better-sqlite3 + drizzle) schema + connection.
- `packages/ai-rewriter` — MinHash clustering + the LLM rewrite (the "core brain").
- `packages/news-collector` — RSS/HTML scrapers + the source list.
- `packages/pencil-queue` — SQLite-backed durable job queue (Redis-free).
- `packages/pencil-cloud` — Cloudinary clone: signed-URL `sharp` image transforms.
- `packages/pencil-voice` — TTS clone (Piper / Windows SAPI / eSpeak / silent).
- `packages/pencil-video` — Pictory clone: FFmpeg slideshow + burned-in Bangla subtitles.
- `packages/publisher-fb` / `packages/publisher-yt` — Graph API / YouTube Data API v3 publishers.

## Commands

This is a **Windows / PowerShell** environment.

```powershell
npm install                 # all workspaces
npm run build               # build:packages (ordered) THEN apps/api — see note below
npm run build:web           # Next.js production build (separate from build)
npm run db:init             # create SQLite schema (idempotent)
npm run -w @pk/api seed     # seed sources + welcome article
npm run -w @pk/api demo     # one-shot end-to-end pipeline cycle

npm run dev:api             # tsx watch -> http://localhost:4000 (also starts the scheduler)
npm run dev:web             # next dev   -> http://localhost:3000

npm run -w @pk/web lint     # the ONLY linter in the repo (next lint); no other package lints
```

There are **no tests** in this repo (no test runner, no `*.test.ts`). Don't invent a `npm test`.

**Build ordering matters.** Packages depend on each other's compiled `dist/`, so `build:packages`
builds them in dependency order before `apps/api`. After changing a package, rebuild it (or the
whole `build:packages`) before `npm run start`; in **dev**, `tsx` runs `.ts` sources directly so no
prebuild is needed. The CLI/seed/demo scripts have both a `dist` form (`node apps/api/dist/*.js`,
used by root scripts) and a `tsx src/*.ts` form (used by `@pk/api` scripts) — prefer the `tsx` form
while developing.

### Per-stage CLI

Each pipeline stage is callable in isolation (run via `npm run -w @pk/api cli <stage>` or
`node apps/api/dist/cli.js <stage>`):

```
seed | collect | rewrite | image | video | publish-fb | publish-yt | queue-stats | all
```

Flags use `--key=value`: `rewrite --limit=3`, `video --limit=1`, `image --force=true`
(`--retry-images=true` is an alias — re-validates & upgrades existing/broken hero images).

## Architecture: the pipeline is a status machine over SQLite

The whole system is **stateless stages reading/writing row `status` columns**. Each stage in
[apps/api/src/pipeline.ts](apps/api/src/pipeline.ts) is idempotent and safe to re-run; the
scheduler ([apps/api/src/scheduler.ts](apps/api/src/scheduler.ts)) just chains them on a cron grid,
each wrapped in a per-stage `once()` mutex so a stage never overlaps itself.

```
collect  → raw_items.status: 'new'
rewrite  → clusterUnprocessed(): 'new' → 'clustered'   (MinHash Jaccard ≥ 0.55 merges duplicates)
         → rewriteCluster() + persistArticle(): cluster → articles row, raw_items → 'rewritten'
         → clean drafts auto-publish (status='published'); politics/unsafe → 'flagged' held for review
image    → bestThumbnail(): hero → each source og:image → category stock photo → branded placeholder,
           validating each candidate downloads before accepting it
video    → renders ONLY for category in (kheladhula, islamic) or tag 'hasnat-abdullah'; videos.status
           draft→rendering→ready
publish  → posts rows guard against re-posting; FB and YT each default to DRY-RUN
```

To trace the data model, read [packages/db/src/init.ts](packages/db/src/init.ts) — the schema is
bootstrapped from **raw DDL** (`CREATE TABLE IF NOT EXISTS`), **not** drizzle-kit migrations. Tables:
`sources`, `raw_items`, `articles`, `videos`, `jobs` (queue), `posts`, `assets` (CDN), `app_meta`
(kv). Most code queries via **`rawDb()`** (raw better-sqlite3 prepared statements), not the drizzle
ORM — follow that style. SQLite runs in WAL mode; a one-time in-code migration adds a UNIQUE index
on `sources.url`. A `postgres://` `DATABASE_URL` is wired but **not bundled** — it throws.

## Critical gotcha: the rewriter uses Gemini, not Claude

The README, the `ai-rewriter` header comment, and `.env.example` mention **Anthropic/Claude**, but
the actual implementation in [packages/ai-rewriter/src/index.ts](packages/ai-rewriter/src/index.ts)
calls **Google Gemini only** (`GEMINI_API_KEY`, model `gemini-2.5-flash`, REST — no SDK). With no
key it falls back to an offline `stubRewrite` digest so the pipeline still produces visible content
in dev. `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in `.env.example` are currently **unused**. The
`/admin/stats` endpoint and `app_meta` usage counter are Gemini-specific (daily cap
`REWRITE_DAILY_CAP=1200`, a 429 stops the batch and resumes next tick). Don't trust the Anthropic
naming — verify against the code.

## Editorial guardrails (enforced in the rewrite prompt, `POLICY_BN`)

- Bangladesh category is restricted to positive / developmental / environmental / factual-accident
  content. Anything political is forced to `category='politics-review'` + `status='flagged'` and
  **held for manual approval** (never auto-published).
- Islamic content is explainer / fair-use summary only.
- Every article stores the source URLs it was built from; every video carries the
  `PencilerKali.com` watermark.

## pencil-cloud CDN (signed transforms)

Images are served from `apps/api` at `/cdn/raw/:filename` (asset ids are UUIDs — anything else 404s)
and `/cdn/t/:assetId/:token/:sig` for on-the-fly `sharp` transforms; the `:sig` is HMAC-verified
against `PENCIL_CLOUD_SIGNING_SECRET`, so transform URLs must be generated by `pencil-cloud`, not
hand-built. Local files live under `storage/` (also served at `/storage/`).

## Configuration

Copy `.env.example` → `.env`. Everything degrades gracefully when a key is absent: no AI key →
offline stub, no FB/YT token → dry-run, no TTS engine → silent audio, no S3 → local files. Key
switches: `FACEBOOK_DRY_RUN` / `YOUTUBE_DRY_RUN` (default `true` — flip only with working tokens),
`PENCIL_VOICE_ENGINE`, `PENCIL_CLOUD_DRIVER`, the `*_CRON` schedules, and `API_AUTO_SCHEDULER=false`
to run the API without the cron loop (useful when driving stages manually via the CLI).

## Web app notes

Next.js App Router server components fetch the API via `NEXT_PUBLIC_API_BASE` (default
`http://localhost:4000`). [apps/web/src/lib/api.ts](apps/web/src/lib/api.ts) wraps every fetch in a
**safe `fetchJson`** that returns a fallback on any network/non-JSON error — this is load-bearing:
`next build` prerenders pages while the API may be unreachable, and without it the build crashes.
Categories are fixed Bangla slugs: `bangladesh, bidesh, kheladhula, binodon, islamic`.

## Decisions and changes log

This section records deliberate product decisions and non-obvious code changes made during
development. Read this before touching the relevant areas so you don't accidentally revert them.

### Ads — intentionally disabled (do NOT re-add)

All ad components in [apps/web/src/components/Ads.tsx](apps/web/src/components/Ads.tsx) are **null
stubs**. The Adsterra code still exists in `Adsterra.tsx` but is completely inert. All 10 pages that
import from `Ads.tsx` (`Ads`, `TopBanner`, `InlineAd`, `AdRow`, `AdRails`) continue to compile — they
just render nothing. Do not re-add Adsterra or any third-party ad network unless the user explicitly
asks.

### তথ্যসূত্র (sources section) — permanently removed

The sources disclosure block was removed from every article page. Specifically:
- `parseSources()` function deleted from [apps/web/src/app/article/[slug]/page.tsx](apps/web/src/app/article/%5Bslug%5D/page.tsx)
- The `<details>` block showing source links deleted
- Prose references in `about/page.tsx` and `editorial-policy/page.tsx` cleaned up

**Never add a তথ্যসূত্র / sources section back to articles.** Source URLs are still stored in the
`articles.source_urls` column for internal use; they just aren't shown to readers.

### Quiet hours — no publishing 1:00–4:59 AM Bangladesh time

`isBdQuietHours()` in [apps/api/src/pipeline.ts](apps/api/src/pipeline.ts) computes BD hour as
`(UTC + 6) % 24` and returns `true` for hours 1–4. Three stages check it:
- `stageRewrite` — articles rewritten during quiet hours are saved as `draft`, not auto-published
- `stagePublishFb` — returns `{ posted: 0 }` immediately
- `stagePublishYt` — returns `{ uploaded: 0 }` immediately

Articles that are held as drafts during quiet hours will auto-publish on the next cron tick after
5 AM BD.

### 10-minute minimum gap between article publishes

`stageRewrite` queries `MAX(published_at)` from the DB at the start of each batch, tracks
`lastPublishMs` in-memory, and only auto-publishes an article if `Date.now() - lastPublishMs >=
minGapMs`. Default is 600,000 ms (10 minutes). Override with `PUBLISH_MIN_GAP_MS` env var.

This means at most one article publishes per pipeline tick in a busy batch; remaining articles
become drafts and publish on subsequent ticks.

### Category assignment — subject matter beats geography (POLICY_BN rule 9)

The AI rewriter (`POLICY_BN` in [packages/ai-rewriter/src/index.ts](packages/ai-rewriter/src/index.ts))
has an explicit rule that subject matter overrides geographic location when assigning a category:

- Entertainment / showbiz / celebrity / film / music / OTT / TV → always `binodon`
- Cricket / football / IPL / BPL / PSL / BBL / Olympics / any sport → always `kheladhula`
- `bidesh` is reserved for international politics, diplomacy, war, disaster, economics only

Without this rule the AI defaults to `bidesh` for anything happening abroad (e.g. Bollywood news,
IPL matches). This is rule 9 in the `POLICY_BN` string — do not remove it.

### Web push notifications (VAPID, self-hosted)

Implemented in [apps/api/src/push.ts](apps/api/src/push.ts). Subscribers are stored in the
`push_subscriptions` table. The push service is completely free — no SaaS. It is **disabled by
default** until VAPID keys are set:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...    # server-only, never commit
VAPID_SUBJECT=mailto:contact@pencilerkali.com
```

Generate keys once with: `node -e "console.log(require('web-push').generateVAPIDKeys())"`

The pipeline sends at most 3 individual notifications per tick; if more than 3 articles publish in
one batch it collapses them into one summary notification to avoid lock-screen spam.

The push notification icon is `/logo` (relative URL resolved by the service worker against the
site origin), which redirects to `/brand/logo.jpg`.

### IndexNow (Bing / Yandex instant indexing)

`pingIndexNow()` is called in `stageRewrite` after each batch. No-op unless both are set in `.env`:

```
INDEXNOW_ENABLED=true
SITE_URL=https://pencilerkali.com
```

### Brand logo — pk_logo.jpg

The real brand logo lives at [apps/web/public/brand/logo.jpg](apps/web/public/brand/logo.jpg).

- **Header**: `<img src="/brand/logo.jpg">` in `layout.tsx` — replaces the old generated "পক" text badge
- **Favicon**: `apps/web/src/app/icon.jpg` — Next.js App Router picks this up automatically
- **`/logo` route**: [apps/web/src/app/logo/route.tsx](apps/web/src/app/logo/route.tsx) does a 301
  redirect to `/brand/logo.jpg`. All existing references (JSON-LD `LOGO_URL`, push notification
  icon, favicon metadata `icons: { icon: '/logo' }`) continue to work without change.

Do not delete `/logo/route.tsx` — it provides backward compatibility for any external URLs
(Google may have cached the JSON-LD logo URL).

### Production deploy commands

```bash
# Full deploy (UI + pipeline changes):
cd /var/www/pencil && git pull && npm run build:web && pm2 restart pk-api pk-web --update-env

# Web-only change (no pipeline.ts touched):
cd /var/www/pencil && git pull && npm run build:web && pm2 restart pk-web --update-env

# API-only change (no Next.js pages touched):
cd /var/www/pencil && git pull && pm2 restart pk-api --update-env
```

**Always use `pm2 restart`, never `pm2 reload`** for `pk-web`. Hot-reload causes 400 chunk-hash
errors when Next.js replaces JS bundles mid-flight.

After changing any `packages/*` package, rebuild before deploying:
```bash
npm run build:packages && npm run build  # then pm2 restart pk-api
```
