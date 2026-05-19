import cron from "node-cron";
import { listListings, upsertScrapeResult } from "./db.mjs";
import { scrapeListing } from "./scraper.mjs";

export async function runScrapeAll() {
  const listings = listListings();
  console.log(`[cron] running scrape (${listings.length} listings)`);
  for (const listing of listings) {
    try {
      const result = await scrapeListing(listing.airbnb_room_id);
      upsertScrapeResult(listing.id, result);
      if (result.error) {
        console.log(`[cron] ${listing.id}: error ${result.error}`);
      } else {
        console.log(`[cron] ${listing.id}: ok price=$${result.price_usd} blocked=${result.blocked_dates.length}`);
      }
    } catch (err) {
      console.log(`[cron] ${listing.id}: crash ${err.message}`);
      upsertScrapeResult(listing.id, { error: `crash: ${err.message}`, scraped_at: new Date().toISOString() });
    }
  }
  console.log(`[cron] scrape complete`);
}

export function startCron() {
  // Daily at 04:00 America/Los_Angeles
  cron.schedule(
    "0 4 * * *",
    () => { runScrapeAll().catch((err) => console.error("[cron] run failed:", err)); },
    { timezone: "America/Los_Angeles" }
  );
  console.log("[cron] scheduled daily 04:00 America/Los_Angeles");

  // Kick off an initial scrape async so dev sessions have data — but skip if data is fresh (<1h)
  setTimeout(() => {
    const listings = listListings();
    const stale = listings.some((l) => {
      if (!l.last_scraped_at) return true;
      return Date.now() - new Date(l.last_scraped_at).getTime() > 60 * 60 * 1000;
    });
    if (!stale) {
      console.log("[cron] skipping initial scrape — DB data is fresh (<1h)");
      return;
    }
    runScrapeAll().catch((err) => console.error("[cron] initial scrape failed:", err));
  }, 1000);
}
