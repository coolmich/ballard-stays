// Smoke tests for Task 1 — backend scaffold
// Run with: node --test server/test/smoke.test.mjs
// Assumes `npm run dev` is running in another terminal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BACKEND = "http://localhost:3001";
const FRONTEND = "http://localhost:5173";

test("backend /health returns ok", async () => {
  const res = await fetch(`${BACKEND}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, "ballard-stays-backend");
});

test("vite proxies /api/* to backend", async () => {
  const res = await fetch(`${FRONTEND}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test("sqlite db file is created on disk", () => {
  const dbPath = join(process.cwd(), "server/data/app.db");
  assert.ok(existsSync(dbPath), `expected ${dbPath} to exist`);
});

test("required server source files exist", () => {
  const root = process.cwd();
  for (const f of ["server/src/index.mjs", "server/src/db.mjs", "server/src/scraper.mjs", "server/src/cron.mjs"]) {
    assert.ok(existsSync(join(root, f)), `missing ${f}`);
  }
});
