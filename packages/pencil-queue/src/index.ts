import { rawDb, getDb } from '@pk/db';
import { randomUUID } from 'node:crypto';

// ----------------------------------------------------------------------------
// pencil-queue — a durable, SQLite-backed job queue.
//
// What it gives you (without Redis, BullMQ, or any cloud queue):
//   * enqueue(queueName, payload, opts) — exactly-once persistence
//   * Worker.start({ queue, handler }) — long-poll loop, atomic lease,
//     exponential backoff, retries, dead-letter on max attempts
//   * delayed jobs via runAt, concurrency per worker, graceful shutdown
//
// Why it works without Redis: SQLite in WAL mode handles tens of thousands of
// jobs/sec with row-level transactions; the UPDATE ... RETURNING pattern
// gives us a leak-proof lease in a single statement.
// ----------------------------------------------------------------------------

export interface EnqueueOptions {
  delayMs?: number;
  maxAttempts?: number;
}

export interface JobRow {
  id: number;
  queue: string;
  payload: string;
  attempts: number;
  maxAttempts: number;
}

export type JobHandler<T> = (payload: T, job: JobRow) => Promise<unknown>;

export interface WorkerConfig<T> {
  queue: string;
  handler: JobHandler<T>;
  concurrency?: number;
  pollMs?: number;
  workerId?: string;
}

export function enqueue<T>(queue: string, payload: T, opts: EnqueueOptions = {}): number {
  getDb();
  const sqlite = rawDb();
  const now = Date.now();
  const runAt = now + (opts.delayMs ?? 0);
  const stmt = sqlite.prepare(`
    INSERT INTO jobs (queue, payload, status, attempts, max_attempts, run_at, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    queue,
    JSON.stringify(payload),
    (opts.delayMs ?? 0) > 0 ? 'delayed' : 'pending',
    opts.maxAttempts ?? 3,
    runAt,
    now,
    now,
  );
  return Number(info.lastInsertRowid);
}

export function queueStats(queue?: string): Record<string, number> {
  getDb();
  const sqlite = rawDb();
  const sql = queue
    ? `SELECT status, COUNT(*) as n FROM jobs WHERE queue=? GROUP BY status`
    : `SELECT status, COUNT(*) as n FROM jobs GROUP BY status`;
  const rows = (queue ? sqlite.prepare(sql).all(queue) : sqlite.prepare(sql).all()) as { status: string; n: number }[];
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = r.n;
  return out;
}

function leaseOne(queue: string, workerId: string, now: number): JobRow | null {
  const sqlite = rawDb();
  // Promote delayed → pending if runAt elapsed.
  sqlite.prepare(`UPDATE jobs SET status='pending' WHERE status='delayed' AND queue=? AND run_at<=?`).run(queue, now);
  // Atomic lease via UPDATE ... RETURNING (better-sqlite3 supports RETURNING).
  const row = sqlite.prepare(`
    UPDATE jobs SET status='active', locked_at=?, locked_by=?, attempts=attempts+1, updated_at=?
    WHERE id = (
      SELECT id FROM jobs WHERE queue=? AND status='pending' AND run_at<=? ORDER BY id LIMIT 1
    )
    RETURNING id, queue, payload, attempts, max_attempts as maxAttempts
  `).get(now, workerId, now, queue, now) as JobRow | undefined;
  return row ?? null;
}

function completeJob(id: number, result: unknown): void {
  const sqlite = rawDb();
  sqlite.prepare(`
    UPDATE jobs SET status='done', result=?, locked_at=NULL, locked_by=NULL, updated_at=?
    WHERE id=?
  `).run(JSON.stringify(result ?? null), Date.now(), id);
}

function failJob(job: JobRow, err: Error): void {
  const sqlite = rawDb();
  const now = Date.now();
  if (job.attempts >= job.maxAttempts) {
    sqlite.prepare(`UPDATE jobs SET status='failed', last_error=?, locked_at=NULL, locked_by=NULL, updated_at=? WHERE id=?`)
      .run(err.message + '\n' + (err.stack ?? ''), now, job.id);
  } else {
    // Exponential backoff: 5s, 25s, 125s …
    const backoff = 5_000 * Math.pow(5, job.attempts - 1);
    sqlite.prepare(`
      UPDATE jobs SET status='delayed', run_at=?, last_error=?, locked_at=NULL, locked_by=NULL, updated_at=?
      WHERE id=?
    `).run(now + backoff, err.message, now, job.id);
  }
}

export class Worker<T = unknown> {
  private stopped = false;
  private inFlight = new Set<Promise<void>>();
  constructor(private cfg: WorkerConfig<T>) {}

  async start(): Promise<void> {
    const id = this.cfg.workerId ?? randomUUID().slice(0, 8);
    const concurrency = Math.max(1, this.cfg.concurrency ?? 1);
    const pollMs = this.cfg.pollMs ?? 500;
    while (!this.stopped) {
      while (this.inFlight.size < concurrency) {
        const job = leaseOne(this.cfg.queue, id, Date.now());
        if (!job) break;
        const p = this.run(job).finally(() => this.inFlight.delete(p));
        this.inFlight.add(p);
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
    await Promise.all([...this.inFlight]);
  }

  private async run(job: JobRow): Promise<void> {
    try {
      const payload = JSON.parse(job.payload) as T;
      const result = await this.cfg.handler(payload, job);
      completeJob(job.id, result);
    } catch (e) {
      failJob(job, e instanceof Error ? e : new Error(String(e)));
    }
  }

  stop(): void { this.stopped = true; }
}

// Convenience: run a single tick for tests/CLI demos.
export async function runOnce<T>(queue: string, handler: JobHandler<T>, workerId = 'cli'): Promise<boolean> {
  const job = leaseOne(queue, workerId, Date.now());
  if (!job) return false;
  try {
    const result = await handler(JSON.parse(job.payload) as T, job);
    completeJob(job.id, result);
    return true;
  } catch (e) {
    failJob(job, e instanceof Error ? e : new Error(String(e)));
    return true;
  }
}
