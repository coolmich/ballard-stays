export function fmtDate(d) {
  if (!d) return "";
  if (typeof d === "string") d = new Date(d);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtShort(d) {
  if (!d) return "";
  if (typeof d === "string") d = new Date(d);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtLong(d) {
  if (!d) return "";
  if (typeof d === "string") d = new Date(d);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function serializeQuery(q) {
  if (!q) return null;
  return {
    checkin: q.checkin ? q.checkin.toISOString() : null,
    checkout: q.checkout ? q.checkout.toISOString() : null,
    guests: q.guests || 2,
  };
}

export function deserializeQuery(q) {
  if (!q) return null;
  return {
    checkin: q.checkin ? new Date(q.checkin) : null,
    checkout: q.checkout ? new Date(q.checkout) : null,
    guests: q.guests || 2,
  };
}

const HOSTING_START = new Date(2020, 2, 1); // March 2020
export function yearsHosting(now = new Date()) {
  let y = now.getFullYear() - HOSTING_START.getFullYear();
  const m = now.getMonth() - HOSTING_START.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < HOSTING_START.getDate())) y--;
  return y;
}

// Approximate guest savings vs. Airbnb total (after 15.5% service fee + 16.59% Seattle lodging tax).
// Airbnb total = host_rate × 1.155 × 1.1659.  Direct = host_rate × 1.155 × (1 − d/100).
// Savings ratio = 1 − (1 − d/100) / 1.1659.
export function savingsPct(tweaks) {
  return Math.round((1 - (1 - tweaks.discountPct / 100) / 1.1659) * 100);
}

// 2-night minimum when checkin is Thursday, Friday, or Saturday.
// If user picks a 1-night stay starting on those days, bump checkout +1 day.
// Returns { checkin, checkout, bumped }.
export function enforceWeekendMin(checkin, checkout) {
  if (!checkin || !checkout) return { checkin, checkout, bumped: false };
  const nights = Math.round((checkout - checkin) / 86400000);
  if (nights >= 2) return { checkin, checkout, bumped: false };
  const dow = checkin.getDay();
  if (nights >= 1 && (dow === 4 || dow === 5 || dow === 6)) {
    return { checkin, checkout: new Date(checkin.getTime() + 2 * 86400000), bumped: true };
  }
  return { checkin, checkout, bumped: false };
}
