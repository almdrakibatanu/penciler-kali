# PencilerKali.com — Bangla AI News + Video Automation Platform

A complete, self-hosted Bangla news platform that:

- **Collects** news every 10 min from Prothom Alo, Jugantor, Kaler Kantho, Samakal, BD Pratidin, BBC Bangla, Daily Star, TBS, ESPN, Variety, and more (all via free RSS).
- **Rewrites** clustered duplicates into a single original Bangla article using Claude (with prompt caching), tagged + SEO + Facebook caption + thumbnail text.
- **Renders thumbnails** with a built-in Cloudinary clone (`pencil-cloud`) — signed-URL on-the-fly transforms (resize, watermark, OG cards) backed by `sharp`.
- **Generates voice-over** with a built-in ElevenLabs/TTS clone (`pencil-voice`) — Piper, Windows SAPI, eSpeak-NG, or a silent fallback.
- **Builds explainer videos** with a built-in Pictory clone (`pencil-video`) — FFmpeg slideshow with Ken Burns, cross-fades, burned-in Bangla subtitles, end-card.
- **Publishes** to Facebook page `id=100066384905135` and YouTube channel `@AMRWorld-gd2sl`.
- **Runs** behind a built-in durable job queue (`pencil-queue`) — SQLite-backed, no Redis required.

## Project layout

```
pencilerkali/
├── apps/
│   ├── api/             Fastify backend + cron scheduler + CLI
│   └── web/             Next.js 14 + Tailwind frontend
├── packages/
│   ├── db/              SQLite schema (drop-in Postgres ready)
│   ├── pencil-queue/    SQLite-backed durable job queue
│   ├── pencil-cloud/    Cloudinary clone (sharp + signed URLs)
│   ├── pencil-voice/    TTS clone (Piper/SAPI/eSpeak/silent)
│   ├── pencil-video/    Pictory clone (FFmpeg slideshow + subs)
│   ├── news-collector/  RSS + HTML scrapers
│   ├── ai-rewriter/     Claude prompts + MinHash dedupe
│   ├── publisher-fb/    Facebook Graph API
│   └── publisher-yt/    YouTube Data API v3
└── storage/             local CDN files (images, audio, video) + sqlite
```

## Quick start

```powershell
cd pencilerkali
copy .env.example .env
# (fill in ANTHROPIC_API_KEY and Facebook/YouTube tokens later if you want live posts)

npm install                          # installs all workspaces
npm run build                        # builds every package
npm run -w @pk/api seed              # creates db, seeds sources + welcome article
npm run -w @pk/api demo              # one-shot end-to-end demo cycle

# in two terminals:
npm run dev:api                      # http://localhost:4000
npm run dev:web                      # http://localhost:3000
```

## CLI

Every stage is callable individually so you can test in isolation:

```powershell
npm run -w @pk/api cli seed
npm run -w @pk/api cli collect
npm run -w @pk/api cli rewrite -- --limit=3
npm run -w @pk/api cli image
npm run -w @pk/api cli video -- --limit=1
npm run -w @pk/api cli publish-fb
npm run -w @pk/api cli publish-yt
npm run -w @pk/api cli all
```

## Production posting checklist

By default, both publishers run in **dry-run** mode. Flip the env switches only after you have working tokens:

### Facebook (`@PencilerKali` page id 100066384905135)
1. Create an FB app in [developers.facebook.com](https://developers.facebook.com).
2. Add the page as a manageable asset; grant `pages_manage_posts` + `pages_read_engagement`.
3. Exchange the short-lived user token for a long-lived **page** token (`oauth/access_token`).
4. `FACEBOOK_PAGE_ACCESS_TOKEN=<token>` and `FACEBOOK_DRY_RUN=false`.

### YouTube (`@AMRWorld-gd2sl` channel)
1. Google Cloud → enable **YouTube Data API v3** + **OAuth consent screen**.
2. Create **OAuth desktop credentials** → `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`.
3. Run a one-time browser flow to obtain a refresh token → `YOUTUBE_REFRESH_TOKEN`.
4. `YOUTUBE_DRY_RUN=false`.

## Editorial guardrails (built in)

- Bangladesh category: **positive, developmental, environmental, factual accident**. Political content is flagged with `status='politics-review'` and held for manual approval.
- Islamic content: explainer / fair-use only.
- All originals are credited under each article with the source URLs the AI used.
- Every video carries `PencilerKali.com` watermark + burned-in Bangla subtitles.

## License & attribution

Internal project. Bangla news content remains the property of its original publishers; we publish summaries and analysis under fair-use, with full source links on every article.
