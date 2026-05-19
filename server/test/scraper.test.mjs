// Integration tests for the Airbnb scraper.
// These hit the real Airbnb site via Playwright. Slow (~30s per listing).
// Run with: npm run test:scraper
import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeListing } from "../src/scraper.mjs";

const LISTINGS = [
  { name: "Bamboo", roomId: "890746600710694659" },
  { name: "Zen", roomId: "1414909835861328832" },
  { name: "Top Floor", roomId: "1451097135219726178" },
];

const TIMEOUT_MS = 120_000;

for (const listing of LISTINGS) {
  test(`scrapes ${listing.name} (${listing.roomId})`, { timeout: TIMEOUT_MS }, async () => {
    const result = await scrapeListing(listing.roomId);
    if (result.error) {
      assert.fail(`scrape failed: ${JSON.stringify(result)}`);
    }
    assert.ok(result.price_usd > 0, `price_usd should be positive, got ${result.price_usd}`);
    assert.ok(result.price_usd < 5000, `price_usd unrealistic high: ${result.price_usd}`);
    assert.equal(result.currency, "USD");
    assert.ok(Array.isArray(result.blocked_dates));
    assert.match(result.scraped_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(result.source_url.includes(listing.roomId));
  });
}

test("scrapeListing handles invalid input without throwing", async () => {
  const result = await scrapeListing("not-a-room-id");
  assert.equal(result.error, "invalid_room_id");
});
