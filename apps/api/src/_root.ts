import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Resolve and chdir to the monorepo root so all relative paths (DATABASE_URL,
// pencil-cloud rootDir, ffmpeg output) point to the same storage tree no
// matter which workspace npm picks as cwd.
function findRoot(start: string): string {
  let cur = start;
  while (cur !== dirname(cur)) {
    const pkg = resolve(cur, 'package.json');
    if (existsSync(pkg)) {
      try {
        const j = JSON.parse(readFileSync(pkg, 'utf8'));
        if (Array.isArray(j.workspaces)) return cur;
      } catch { /* ignore */ }
    }
    cur = dirname(cur);
  }
  return start;
}

const initCwd = process.env.INIT_CWD ?? process.cwd();
const root = findRoot(initCwd);
process.chdir(root);
export const REPO_ROOT = root;
