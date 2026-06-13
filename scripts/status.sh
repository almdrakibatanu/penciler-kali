#!/usr/bin/env bash
#
# PencilerKali status — at a glance:
#   * which AI keys / models are configured, how many requests they made today,
#     and which ones hit their limit (429) or are on cooldown
#   * when the next article will auto-publish to the WEB (rewrite cron)
#   * when the next Facebook post will go out (publish cron)
#
# Usage:
#   bash scripts/status.sh                 # talks to http://localhost:4000
#   bash scripts/status.sh http://host:4000
#   PK_API=http://host:4000 bash scripts/status.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

# Read a single KEY=value from .env (strip CRLF + surrounding quotes); else default.
getenv() {
  local key="$1" def="${2:-}" line val
  if [[ -f "$ENV_FILE" ]]; then
    line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n1 | tr -d '\r' || true)"
    if [[ -n "$line" ]]; then
      val="${line#*=}"
      val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
      printf '%s' "$val"; return
    fi
  fi
  printf '%s' "$def"
}

API_PORT="$(getenv API_PORT 4000)"
API_BASE="${PK_API:-${1:-http://localhost:${API_PORT}}}"

REWRITE_CRON="$(getenv REWRITE_CRON '*/15 * * * *')"
PUBLISH_CRON="$(getenv PUBLISH_CRON '0 */1 * * *')"
COLLECT_CRON="$(getenv COLLECT_CRON '*/10 * * * *')"
FB_DRY="$(getenv FACEBOOK_DRY_RUN true)"
AUTO_SCHED="$(getenv API_AUTO_SCHEDULER true)"

STATS="$(curl -s --max-time 10 "${API_BASE}/admin/stats" || true)"

PK_STATS="$STATS" \
PK_API="$API_BASE" \
PK_REWRITE_CRON="$REWRITE_CRON" \
PK_PUBLISH_CRON="$PUBLISH_CRON" \
PK_COLLECT_CRON="$COLLECT_CRON" \
PK_FB_DRY="$FB_DRY" \
PK_AUTO_SCHED="$AUTO_SCHED" \
node <<'NODE'
const api = process.env.PK_API;
let stats = null;
try { stats = JSON.parse(process.env.PK_STATS || ''); } catch { /* not JSON */ }

const C = { dim:'\x1b[2m', b:'\x1b[1m', g:'\x1b[32m', y:'\x1b[33m', r:'\x1b[31m', c:'\x1b[36m', x:'\x1b[0m' };
const line = (n=58) => console.log(C.dim + '─'.repeat(n) + C.x);
const head = (t) => { console.log('\n' + C.b + t + C.x); };

if (!stats) {
  console.log(`${C.r}Could not reach the API at ${api}/admin/stats${C.x}`);
  console.log(`${C.dim}Is pk-api running? Try:  PK_API=http://localhost:4000 bash scripts/status.sh${C.x}`);
  process.exit(1);
}

// ---- cron "next run" (server local time, matching node-cron) -----------------
function parseField(expr, min, max) {
  const set = new Set();
  for (const part of String(expr).split(',')) {
    const [range, stepStr] = part.split('/');
    const step = stepStr ? parseInt(stepStr, 10) : 1;
    let lo, hi;
    if (range === '*') { lo = min; hi = max; }
    else if (range.includes('-')) { const [a, b] = range.split('-'); lo = +a; hi = +b; }
    else { lo = hi = +range; if (stepStr) hi = max; }
    for (let v = lo; v <= hi; v += step) set.add(v);
  }
  return set;
}
function nextRun(cronStr) {
  let f = String(cronStr).trim().split(/\s+/);
  if (f.length === 6) f = f.slice(1);          // drop optional seconds field
  if (f.length !== 5) return null;
  const [mE, hE, domE, monE, dowE] = f;
  const mins = parseField(mE, 0, 59), hrs = parseField(hE, 0, 23);
  const doms = parseField(domE, 1, 31), mons = parseField(monE, 1, 12);
  const dows = parseField(dowE, 0, 7); if (dows.has(7)) dows.add(0);
  const domR = domE !== '*', dowR = dowE !== '*';
  const d = new Date(); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1);
  for (let i = 0; i < 11520; i++) {            // up to 8 days ahead
    const okDom = doms.has(d.getDate()), okDow = dows.has(d.getDay());
    const dayOk = (domR && dowR) ? (okDom || okDow) : (okDom && okDow);
    if (mins.has(d.getMinutes()) && hrs.has(d.getHours()) && mons.has(d.getMonth() + 1) && dayOk) {
      return new Date(d);
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return null;
}
function fmt(d) {
  if (!d) return 'n/a';
  const mins = Math.round((d - Date.now()) / 60000);
  const inStr = mins < 1 ? 'now' : mins < 60 ? `${mins} min` : `${Math.floor(mins/60)}h ${mins%60}m`;
  const bd = d.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
  return `${C.g}in ${inStr}${C.x}  ${C.dim}(${bd} BD time)${C.x}`;
}

// ---- AI engines / keys / models ----------------------------------------------
head('🔑  AI engines — keys, models & today\'s usage');
line();
const g = stats.gemini || {};
console.log(`Gemini keys configured: ${C.b}${g.keysConfigured ?? '?'}${C.x}   articles produced today: ${C.b}${g.articlesToday ?? 0}${C.x} / cap ${g.dailyCap ?? '?'}  (${(g.remaining ?? 0) > 0 ? C.g : C.r}${g.remaining ?? 0} left${C.x})`);
if (g.limitHit) console.log(`${C.r}⚠ Gemini hit a 429 quota error today${C.x}${g.lastQuotaErrorAt ? C.dim + ' (last: ' + new Date(g.lastQuotaErrorAt).toLocaleString('en-GB',{timeZone:'Asia/Dhaka'}) + ' BD)' + C.x : ''}`);

const engines = Array.isArray(stats.engines) ? stats.engines : [];
if (engines.length) {
  console.log('');
  console.log(`${C.dim}provider   model                         req today   429s   status${C.x}`);
  for (const e of engines) {
    const status = e.onCooldown ? `${C.r}COOLDOWN${C.x}` : `${C.g}ok${C.x}`;
    const prov = String(e.provider ?? '').padEnd(9).slice(0, 9);
    const model = String(e.model ?? '').padEnd(28).slice(0, 28);
    const req = String(e.requestsToday ?? 0).padStart(6);
    const errs = String(e.errors429Today ?? 0).padStart(5);
    console.log(`${prov}  ${model}  ${req}     ${errs}   ${status}`);
  }
} else {
  console.log(`${C.dim}(no per-engine stats — only Gemini configured, or older API build)${C.x}`);
}
const groq = stats.groq || {};
if (groq && (groq.requests || groq.errors429)) {
  console.log(`${C.dim}Groq fallback: ${groq.requests ?? 0} req today, ${groq.errors429 ?? 0} 429s${C.x}`);
}
console.log(`${C.dim}Note: Google's free tier doesn't report exact remaining quota — we infer from 429s/cooldown. Free quotas reset at midnight US-Pacific (~1–2 PM Bangladesh).${C.x}`);

// ---- next publish times ------------------------------------------------------
head('🕒  Next publish');
line();
const schedOff = String(process.env.PK_AUTO_SCHED).toLowerCase() === 'false';
if (schedOff) {
  console.log(`${C.r}⚠ API_AUTO_SCHEDULER=false — the cron loop is OFF. Nothing auto-publishes; you're driving stages manually.${C.x}`);
}
console.log(`📰 Web (next rewrite → auto-publish):  ${fmt(nextRun(process.env.PK_REWRITE_CRON))}   ${C.dim}[${process.env.PK_REWRITE_CRON}]${C.x}`);
console.log(`📘 Facebook (next publish run):        ${fmt(nextRun(process.env.PK_PUBLISH_CRON))}   ${C.dim}[${process.env.PK_PUBLISH_CRON}]${C.x}`);
console.log(`${C.dim}   collect feed runs:                ${fmt(nextRun(process.env.PK_COLLECT_CRON))}   [${process.env.PK_COLLECT_CRON}]${C.x}`);

if (String(process.env.PK_FB_DRY).toLowerCase() !== 'false') {
  console.log(`${C.y}⚠ FACEBOOK_DRY_RUN is on — the FB run will simulate, not actually post. Set FACEBOOK_DRY_RUN=false (with a valid token) to post for real.${C.x}`);
}
if ((g.remaining ?? 1) <= 0 || g.limitHit) {
  console.log(`${C.y}⚠ Gemini quota looks exhausted — new articles may not appear at the next rewrite tick until the quota resets (or a fallback engine like Groq picks up).${C.x}`);
}

// ---- content snapshot --------------------------------------------------------
const cnt = stats.counts || {};
head('📊  Content');
line();
console.log(`published articles: ${C.b}${cnt.published ?? '?'}${C.x}   total: ${cnt.articles ?? '?'}   raw items: ${cnt.raw_items ?? '?'}   videos: ${cnt.videos ?? '?'}   posts: ${cnt.posts ?? '?'}`);
console.log('');
NODE
