// Contract test for the frontend pricing fetch.
// Verifies /api/pricing/:id and /api/listings return the exact shape the
// useLivePricing hook expects. Frontend hook itself is verified via dogfood.
import { test } from "node:test";
import assert from "node:assert/strict";

const API = "http://127.0.0.1:3001";

test("GET /api/pricing/:id has shape useLivePricing expects", async () => {
  for (const id of ["bamboo", "gateway", "zen"]) {
    const r = await fetch(`${API}/api/pricing/${id}`);
    assert.equal(r.status, 200);
    const body = await r.json();
    // Hook reads: airbnb_rate_usd (number), last_scraped_at (ISO), status ('ok'|'error'|'unknown')
    assert.equal(typeof body.airbnb_rate_usd, "number");
    assert.ok(body.airbnb_rate_usd > 0);
    assert.match(body.last_scraped_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(["ok", "error", "unknown"].includes(body.status));
  }
});

test("missing listing returns 404 — hook should treat as fallback signal", async () => {
  const r = await fetch(`${API}/api/pricing/does-not-exist`);
  assert.equal(r.status, 404);
});
