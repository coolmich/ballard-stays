// Unit tests for DB schema, seeding, and runScrapeAll.
// Tests use an in-memory or temp DB by overriding via env.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "balstays-"));
process.env.DB_PATH = join(tmp, "app.db");

const { initDb, getDb, seedListings, listListings, upsertScrapeResult, getAvailabilityCount } = await import("../src/db.mjs");

test("initDb creates tables idempotently", () => {
  initDb();
  initDb(); // second call must not throw
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
  assert.ok(tables.includes("listings"));
  assert.ok(tables.includes("availability"));
  assert.ok(tables.includes("bookings"));
});

test("seedListings inserts the 3 known listings", () => {
  seedListings();
  const rows = listListings();
  assert.equal(rows.length, 3);
  const ids = rows.map(r => r.id).sort();
  assert.deepEqual(ids, ["bamboo", "gateway", "zen"]);
  for (const r of rows) {
    assert.ok(r.airbnb_room_id, `missing room id for ${r.id}`);
    assert.ok(r.airbnb_url.startsWith("https://www.airbnb.com/rooms/"));
  }
});

test("seedListings is idempotent — second call doesn't duplicate", () => {
  seedListings();
  const rows = listListings();
  assert.equal(rows.length, 3);
});

test("upsertScrapeResult writes price + blocked dates and replaces on re-scrape", () => {
  upsertScrapeResult("bamboo", { price_usd: 199, currency: "USD", blocked_dates: ["2026-06-01", "2026-06-02"], scraped_at: "2026-04-28T10:00:00Z" });
  let row = listListings().find(r => r.id === "bamboo");
  assert.equal(row.airbnb_rate_usd, 199);
  assert.equal(row.last_scraped_status, "ok");
  assert.equal(getAvailabilityCount("bamboo", "airbnb"), 2);

  // Second scrape with different blocked dates — old ones for source='airbnb' must be replaced
  upsertScrapeResult("bamboo", { price_usd: 220, currency: "USD", blocked_dates: ["2026-07-01"], scraped_at: "2026-04-28T11:00:00Z" });
  row = listListings().find(r => r.id === "bamboo");
  assert.equal(row.airbnb_rate_usd, 220);
  assert.equal(getAvailabilityCount("bamboo", "airbnb"), 1);
});

test("upsertScrapeResult records errors without overwriting last good price", () => {
  upsertScrapeResult("bamboo", { price_usd: 175, currency: "USD", blocked_dates: [], scraped_at: "2026-04-28T12:00:00Z" });
  upsertScrapeResult("bamboo", { error: "no_price_found", scraped_at: "2026-04-28T13:00:00Z" });
  const row = listListings().find(r => r.id === "bamboo");
  assert.equal(row.airbnb_rate_usd, 175, "last good price should be preserved on failed scrape");
  assert.equal(row.last_scraped_status, "error");
  assert.equal(row.last_scraped_error, "no_price_found");
});

// Cleanup
test("cleanup", () => {
  rmSync(tmp, { recursive: true, force: true });
});
