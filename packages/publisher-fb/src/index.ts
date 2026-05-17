import { rawDb, getDb } from '@pk/db';

// ----------------------------------------------------------------------------
// publisher-fb — Facebook Graph API auto-poster for the configured page.
// Page: https://www.facebook.com/profile.php?id=100066384905135
//
// Modes:
//   * dry_run (default) — composes the request and logs to posts table but
//                          does NOT call the API. Safe to run without a token.
//   * live              — performs POST /{page-id}/photos or /{page-id}/feed.
//
// Token acquisition (do once, store in .env):
//   1. Create FB app, add the page as a manageable asset
//   2. Get a long-lived Page Access Token (oauth/access_token exchange)
//   3. Put it in FACEBOOK_PAGE_ACCESS_TOKEN
//   4. Set FACEBOOK_DRY_RUN=false to actually publish
// ----------------------------------------------------------------------------

const GRAPH = 'https://graph.facebook.com/v20.0';

export interface FbPostInput {
  articleId?: number;
  message: string;
  link?: string;
  imageUrl?: string;       // public URL — FB will fetch
  videoPath?: string;      // local file for video upload (multipart)
}

export interface FbPostResult {
  status: 'success' | 'dry_run' | 'failed';
  externalId?: string;
  url?: string;
  message: string;
}

function cfg() {
  return {
    pageId: process.env.FACEBOOK_PAGE_ID ?? '100066384905135',
    token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? '',
    dryRun: (process.env.FACEBOOK_DRY_RUN ?? 'true') === 'true',
  };
}

export async function postToPage(input: FbPostInput): Promise<FbPostResult> {
  getDb();
  const c = cfg();
  if (c.dryRun || !c.token) {
    return record(input, { status: 'dry_run', message: `(dry-run) would post: ${input.message.slice(0, 80)}` });
  }
  try {
    let res: { id?: string; post_id?: string; error?: any };
    if (input.videoPath) {
      // Video upload via Resumable Upload API would go here; for simplicity
      // we use the basic /videos endpoint with file_url. If you have a local
      // file, upload it to pencil-cloud first to get a public URL.
      throw new Error('Local video posting requires pencil-cloud public URL; use imageUrl path instead.');
    } else if (input.imageUrl) {
      const url = `${GRAPH}/${c.pageId}/photos`;
      const params = new URLSearchParams({
        url: input.imageUrl,
        message: input.message,
        access_token: c.token,
      });
      if (input.link) params.set('link', input.link);
      res = await (await fetch(url, { method: 'POST', body: params })).json() as any;
    } else {
      const url = `${GRAPH}/${c.pageId}/feed`;
      const params = new URLSearchParams({
        message: input.message,
        access_token: c.token,
      });
      if (input.link) params.set('link', input.link);
      res = await (await fetch(url, { method: 'POST', body: params })).json() as any;
    }
    if (res.error) return record(input, { status: 'failed', message: JSON.stringify(res.error) });
    const id = res.post_id ?? res.id;
    return record(input, {
      status: 'success',
      externalId: id,
      url: id ? `https://facebook.com/${id}` : undefined,
      message: 'ok',
    });
  } catch (e) {
    return record(input, { status: 'failed', message: (e as Error).message });
  }
}

function record(input: FbPostInput, result: FbPostResult): FbPostResult {
  rawDb().prepare(`
    INSERT INTO posts (channel, article_id, external_id, url, status, message, created_at)
    VALUES ('facebook', ?, ?, ?, ?, ?, ?)
  `).run(
    input.articleId ?? null,
    result.externalId ?? null,
    result.url ?? null,
    result.status,
    result.message,
    Date.now(),
  );
  return result;
}
