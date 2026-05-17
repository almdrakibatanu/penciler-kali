import { google } from 'googleapis';
import { createReadStream } from 'node:fs';
import { rawDb, getDb } from '@pk/db';

// ----------------------------------------------------------------------------
// publisher-yt — YouTube Data API v3 resumable upload.
// Channel: https://www.youtube.com/@AMRWorld-gd2sl
//
// One-time setup:
//   1. Google Cloud Console → enable YouTube Data API v3
//   2. Create OAuth 2.0 desktop credentials → YOUTUBE_CLIENT_ID/SECRET
//   3. Run scripts/yt-auth.mjs to obtain a refresh token (one-time browser flow)
//   4. Store the refresh token in YOUTUBE_REFRESH_TOKEN
//   5. Flip YOUTUBE_DRY_RUN=false
// ----------------------------------------------------------------------------

export interface YtUploadInput {
  videoId?: number;
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
  category?: string;       // numeric category id; default 25 = News & Politics
  privacy?: 'public' | 'unlisted' | 'private';
  publishAt?: Date;
  thumbnailPath?: string;
}

export interface YtUploadResult {
  status: 'success' | 'dry_run' | 'failed';
  externalId?: string;
  url?: string;
  message: string;
}

function cfg() {
  return {
    clientId: process.env.YOUTUBE_CLIENT_ID ?? '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN ?? '',
    dryRun: (process.env.YOUTUBE_DRY_RUN ?? 'true') === 'true',
  };
}

export async function uploadVideo(input: YtUploadInput): Promise<YtUploadResult> {
  getDb();
  const c = cfg();
  if (c.dryRun || !c.refreshToken) {
    return record(input, { status: 'dry_run', message: `(dry-run) would upload: ${input.title.slice(0, 80)}` });
  }
  try {
    const auth = new google.auth.OAuth2(c.clientId, c.clientSecret);
    auth.setCredentials({ refresh_token: c.refreshToken });
    const yt = google.youtube({ version: 'v3', auth });
    const res = await yt.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: input.title.slice(0, 100),
          description: input.description.slice(0, 5000),
          tags: (input.tags ?? []).slice(0, 25),
          categoryId: input.category ?? '25',
          defaultLanguage: 'bn',
        },
        status: {
          privacyStatus: input.publishAt ? 'private' : (input.privacy ?? 'public'),
          publishAt: input.publishAt?.toISOString(),
          selfDeclaredMadeForKids: false,
        },
      },
      media: { body: createReadStream(input.filePath) },
    });
    const id = res.data.id ?? undefined;
    if (input.thumbnailPath && id) {
      await yt.thumbnails.set({ videoId: id, media: { body: createReadStream(input.thumbnailPath) } });
    }
    return record(input, {
      status: 'success', externalId: id,
      url: id ? `https://youtube.com/watch?v=${id}` : undefined,
      message: 'ok',
    });
  } catch (e) {
    return record(input, { status: 'failed', message: (e as Error).message });
  }
}

function record(input: YtUploadInput, result: YtUploadResult): YtUploadResult {
  rawDb().prepare(`
    INSERT INTO posts (channel, video_id, external_id, url, status, message, created_at)
    VALUES ('youtube', ?, ?, ?, ?, ?, ?)
  `).run(
    input.videoId ?? null,
    result.externalId ?? null,
    result.url ?? null,
    result.status,
    result.message,
    Date.now(),
  );
  return result;
}
