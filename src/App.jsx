// Ballard Stays, Direct Booking (static, no backend)
import { useEffect, useMemo, useState } from "react";
import { PROPERTIES, NEIGHBORHOOD, TWEAKS_DEFAULTS } from "./data.js";
import { fmtDate, fmtLong, yearsHosting, savingsPct, enforceWeekendMin } from "./utils.js";
import Placeholder from "./Placeholder.jsx";
import Footprint from "./Footprint.jsx";
import MapPanel from "./MapPanel.jsx";
import MobileApp from "./MobileApp.jsx";

const MOBILE_BREAKPOINT = 768;
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

// ---------- ROOT ----------
export default function App() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileApp />;
  return <DesktopApp />;
}

function DesktopApp() {
  const [tweaks, setTweaks] = useState(TWEAKS_DEFAULTS);
  const [route, setRoute] = useState(() => {
    try {
      const r = JSON.parse(localStorage.getItem("bs-route") || '{"page":"home"}');
      const valid = new Set(["home", "property", "request-book", "request-sent"]);
      return valid.has(r?.page) ? r : { page: "home" };
    } catch { return { page: "home" }; }
  });
  const [tweaksOpen, setTweaksOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("bs-route", JSON.stringify(route));
    window.scrollTo(0, 0);
  }, [route]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", tweaks.accent);
    root.style.setProperty("--accent-soft", tweaks.accentSoft);
    root.style.setProperty("--font-display", `"${tweaks.fontDisplay}", Georgia, serif`);
    root.style.setProperty("--font-body", `"${tweaks.fontBody}", -apple-system, BlinkMacSystemFont, sans-serif`);
  }, [tweaks]);

  useEffect(() => {
    const handler = (e) => {
      if (!e.data) return;
      if (e.data.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const updateTweak = (key, value) => {
    setTweaks(t => {
      const next = { ...t, [key]: value };
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [key]: value } }, "*");
      return next;
    });
  };

  const nav = {
    home: () => setRoute({ page: "home" }),
    property: (id) => setRoute({ page: "property", id }),
    requestBook: (id, data = {}) => setRoute({ page: "request-book", id, data }),
    requestSent: (id, data) => setRoute({ page: "request-sent", id, data }),
  };

  return (
    <div className="app" data-screen-label={route.page}>
      <Header tweaks={tweaks} nav={nav} />
      {route.page === "home" && <HomePage tweaks={tweaks} nav={nav} />}
      {route.page === "property" && <PropertyPage id={route.id} tweaks={tweaks} nav={nav} />}
      {route.page === "request-book" && <RequestBookPage id={route.id} initData={route.data} tweaks={tweaks} nav={nav} />}
      {route.page === "request-sent" && <RequestSent route={route} tweaks={tweaks} nav={nav} />}
      <Footer tweaks={tweaks} />
      {tweaksOpen && <TweaksPanel tweaks={tweaks} update={updateTweak} onClose={() => setTweaksOpen(false)} />}
    </div>
  );
}

// ---------- HEADER ----------
function Header({ tweaks, nav }) {
  return (
    <header className="header">
      <div className="wrap header-inner">
        <button className="logo" onClick={nav.home}>
          <span className="logo-mark">◐</span>
          <span className="logo-name">{tweaks.brandName}</span>
        </button>
        <nav className="nav-links">
          <a className="nav-link" href="#how-it-works">How it works</a>
          <a className="nav-link" href="#stays" onClick={(e) => { e.preventDefault(); nav.home(); setTimeout(() => document.getElementById("stays")?.scrollIntoView({ behavior: "smooth" }), 0); }}>Stays</a>
          <button className="nav-link" onClick={() => nav.requestBook(PROPERTIES[0].id)}>Book</button>
        </nav>
      </div>
    </header>
  );
}

// ---------- HOMEPAGE ----------
function HomePage({ tweaks, nav }) {
  return (
    <main>
      <Hero tweaks={tweaks} />
      {tweaks.showSavingsBanner && <HowItWorks tweaks={tweaks} />}
      <StaysGrid tweaks={tweaks} nav={nav} />
      <section id="host" className="section host-section">
        <HostBlock />
      </section>
      <section id="neighborhood" className="section">
        <NeighborhoodBlock />
      </section>
      <FAQ tweaks={tweaks} />
    </main>
  );
}

function Hero({ tweaks }) {
  return (
    <section className="hero hero-lean">
      <div className="hero-photo">
        <img src="/img/topfloor/03.jpg" alt="Ballard townhouse third bedroom" className="hero-img" />
      </div>
      <div className="wrap hero-content">
        <div className="hero-eyebrow">Ballard, Seattle · Est. 2023</div>
        <h1 className="hero-title">
          A modern Ballard townhouse.<br/>
          <em>Three ways to stay.</em>
        </h1>
        <p className="hero-sub">
          One 4-level home a block from Market St. Book a cozy suite, a full floor with a chef kitchen, or the entire townhome, hosted by Mandy, one of Seattle's top-rated Superhosts.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary btn-lg" href="#stays">See the three stays</a>
          <a className="btn btn-ghost btn-lg" href="#how-it-works">How booking direct works</a>
        </div>
      </div>
    </section>
  );
}

function HowItWorks({ tweaks }) {
  const HOST_RATE = 100;
  const SERVICE_FEE_PCT = 15.5;
  const SALES_TAX_PCT = 9.59;
  const CONV_TAX_PCT = 7.00;
  const discountPct = tweaks.discountPct;

  const serviceFee  = HOST_RATE * SERVICE_FEE_PCT / 100;
  const preTax      = HOST_RATE + serviceFee;
  const salesTax    = preTax * SALES_TAX_PCT / 100;
  const convTax     = preTax * CONV_TAX_PCT / 100;
  const airbnbTotal = preTax + salesTax + convTax;
  const direct      = preTax * (1 - discountPct / 100);
  const savings     = airbnbTotal - direct;
  const savingsPctVal = (savings / airbnbTotal) * 100;
  const $ = (n) => `$${n.toFixed(2)}`;
  const pct = (n) => `${(n / airbnbTotal * 100).toFixed(2)}%`;

  return (
    <section id="how-it-works" className="section how-section">
      <div className="wrap how-wrap">
        <div className="section-head section-head-left">
          <div className="section-eyebrow">Direct booking · Returning guests</div>
          <h2 className="section-title">No middleman.<br/><em>Just you and your host.</em></h2>
          <p className="section-lede">
            On Airbnb, every <strong>$100</strong> that reaches your host costs you about <strong>${Math.round(airbnbTotal)}</strong>. A <strong>15.5% service fee</strong> stacks on top of the nightly rate, then Seattle's lodging tax stacks on top of <em>that</em>: <strong>{SALES_TAX_PCT}%</strong> combined sales tax plus a <strong>{CONV_TAX_PCT}%</strong> King County Convention &amp; Trade Center tax. Roughly a quarter of every dollar you pay never reaches the home you're staying in.
          </p>
          <p className="section-lede">
            Book direct and we charge <strong>{discountPct}% off the Airbnb pre-tax price</strong>, close to what the host actually nets from Airbnb after their cut. Same money to the host. No tax stacked on a fee. About <strong>{Math.round(savingsPctVal)}% less</strong> for you.
          </p>
        </div>

        <div className="moneyflow" aria-label="Where every dollar goes">
          <div className="moneyflow-head">
            <div className="moneyflow-title">Where every dollar goes</div>
            <div className="moneyflow-sub">Math on a sample <strong>$100</strong> host nightly rate.</div>
          </div>

          <div className="moneyflow-stage">
            <div className="moneyflow-row">
              <div className="moneyflow-row-meta">
                <div className="moneyflow-row-name">Airbnb at checkout</div>
                <div className="moneyflow-row-amount">{$(airbnbTotal)} <span>total</span></div>
              </div>
              <div className="moneyflow-row-bar">
                <div className="moneyflow-row-track">
                  <div className="mfs mfs-host" style={{ width: pct(HOST_RATE) }} tabIndex="0">
                    <span className="mfs-inner">Host's rate · {$(HOST_RATE)}</span>
                    <div className="mfs-popup">
                      <div className="mfs-popup-eyebrow">Host's nightly rate</div>
                      <div className="mfs-popup-val">{$(HOST_RATE)}</div>
                      <div className="mfs-popup-note">What the host charges per night. Set on the listing.</div>
                    </div>
                  </div>
                  <div className="mfs mfs-fee" style={{ width: pct(serviceFee) }} tabIndex="0">
                    <span className="mfs-inner">Airbnb</span>
                    <div className="mfs-popup">
                      <div className="mfs-popup-eyebrow">Airbnb service fee</div>
                      <div className="mfs-popup-val">{$(serviceFee)} <span>· 15.5%</span></div>
                      <div className="mfs-popup-note">Charged on top of the nightly rate. Goes to Airbnb, not the host.</div>
                    </div>
                  </div>
                  <div className="mfs mfs-tax-1" style={{ width: pct(salesTax) }} tabIndex="0">
                    <span className="mfs-inner">{SALES_TAX_PCT}% Sales</span>
                    <div className="mfs-popup">
                      <div className="mfs-popup-eyebrow">WA combined sales tax</div>
                      <div className="mfs-popup-val">{$(salesTax)} <span>· {SALES_TAX_PCT}%</span></div>
                      <div className="mfs-popup-note">State + local sales tax, charged on the Airbnb pre-tax total.</div>
                    </div>
                  </div>
                  <div className="mfs mfs-tax-2" style={{ width: pct(convTax) }} tabIndex="0">
                    <span className="mfs-inner">{CONV_TAX_PCT}% Conv</span>
                    <div className="mfs-popup mfs-popup--right">
                      <div className="mfs-popup-eyebrow">King County Convention &amp; Trade Center tax</div>
                      <div className="mfs-popup-val">{$(convTax)} <span>· {CONV_TAX_PCT}%</span></div>
                      <div className="mfs-popup-note">Tourism tax on Seattle-area lodging, also stacked on the pre-tax total.</div>
                    </div>
                  </div>
                </div>
                <div className="moneyflow-row-foot">
                  <div className="mffoot-item">
                    <span className="mffoot-dot mffoot-dot--fee" aria-hidden="true"></span>
                    <span className="mffoot-text">Airbnb service fee · 15.5%</span>
                    <span className="mffoot-val">{$(serviceFee)}</span>
                  </div>
                  <div className="mffoot-item">
                    <span className="mffoot-dot mffoot-dot--tax-1" aria-hidden="true"></span>
                    <span className="mffoot-text">WA combined sales tax · {SALES_TAX_PCT}%</span>
                    <span className="mffoot-val">{$(salesTax)}</span>
                  </div>
                  <div className="mffoot-item">
                    <span className="mffoot-dot mffoot-dot--tax-2" aria-hidden="true"></span>
                    <span className="mffoot-text">Convention &amp; Trade Center tax · {CONV_TAX_PCT}%</span>
                    <span className="mffoot-val">{$(convTax)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="moneyflow-row moneyflow-row--reference">
              <div className="moneyflow-row-meta">
                <div className="moneyflow-row-name">Airbnb pre-tax</div>
                <div className="moneyflow-row-amount">{$(preTax)} <span>what you see</span></div>
              </div>
              <div className="moneyflow-row-bar">
                <div className="moneyflow-row-track moneyflow-row-track--reference">
                  <div className="mfs mfs-pretax" style={{ width: pct(preTax) }}>
                    <span className="mfs-inner">Reference price · {$(preTax)}</span>
                  </div>
                </div>
                <div className="moneyflow-row-note">
                  ↑ The price Airbnb shows you when picking dates, before tax. We start here and take <strong>{discountPct}% off</strong> → your direct price.
                </div>
              </div>
            </div>

            <div className="moneyflow-row">
              <div className="moneyflow-row-meta">
                <div className="moneyflow-row-name moneyflow-row-name--direct">Book direct</div>
                <div className="moneyflow-row-amount moneyflow-row-amount--direct">{$(direct)} <span>{discountPct}% off pre-tax</span></div>
              </div>
              <div className="moneyflow-row-bar">
                <div className="moneyflow-row-track">
                  <div className="mfs mfs-direct" style={{ width: pct(direct) }} tabIndex="0">
                    <span className="mfs-inner">You pay · {$(direct)}</span>
                    <div className="mfs-popup">
                      <div className="mfs-popup-eyebrow">Your direct price</div>
                      <div className="mfs-popup-val">{$(direct)}</div>
                      <div className="mfs-popup-note">{$(HOST_RATE)} of this goes to the host (same as their nightly rate on Airbnb). The extra {$(Math.max(direct - HOST_RATE, 0))} covers the cost of running this site: hosting, calendar, payment tools.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="moneyflow-takeaways">
            <div className="moneyflow-takeaway">
              <div className="moneyflow-takeaway-eyebrow">You save</div>
              <div className="moneyflow-takeaway-val">{$(savings)}</div>
              <div className="moneyflow-takeaway-note">About <strong>{Math.round(savingsPctVal)}%</strong> off what Airbnb would charge you with tax.</div>
            </div>
            <div className="moneyflow-takeaway">
              <div className="moneyflow-takeaway-eyebrow">Where your {$(direct)} goes</div>
              <div className="moneyflow-takeaway-split">
                <div className="mft-split-item">
                  <div className="mft-split-val">{$(HOST_RATE)}</div>
                  <div className="mft-split-lbl">to the host</div>
                </div>
                <div className="mft-split-plus" aria-hidden="true">+</div>
                <div className="mft-split-item">
                  <div className="mft-split-val">{$(Math.max(direct - HOST_RATE, 0))}</div>
                  <div className="mft-split-lbl">site operations</div>
                </div>
              </div>
              <div className="moneyflow-takeaway-note">The host's <strong>{$(HOST_RATE)}</strong> nightly rate lands in their account, same as on Airbnb. The extra <strong>{$(Math.max(direct - HOST_RATE, 0))}</strong> covers what it costs the host to run this site. No platform cut in the middle.</div>
            </div>
            <div className="moneyflow-takeaway">
              <div className="moneyflow-takeaway-eyebrow">Why the math works</div>
              <div className="moneyflow-takeaway-val moneyflow-takeaway-val--small">{discountPct}% off pre-tax ≈ host's ${HOST_RATE} rate</div>
              <div className="moneyflow-takeaway-note">You skip both lodging taxes: the <strong>{SALES_TAX_PCT}% sales tax</strong> and the <strong>{CONV_TAX_PCT}% Convention &amp; Trade Center tax</strong> that Airbnb stacks on top of the service fee. That's where most of your savings come from.</div>
            </div>
          </div>
        </div>

        <ol className="how-steps">
          <li className="how-step">
            <div className="how-step-num">01</div>
            <div className="how-step-title">Stay with us once on Airbnb</div>
            <p>New guests always start on the platform. It's how we get to know each other. Airbnb handles ID, reviews, and the first deposit of trust. After you check out, you're on our list for next time.</p>
          </li>
          <li className="how-step">
            <div className="how-step-num">02</div>
            <div className="how-step-title">Check Airbnb first, then request here</div>
            <p>Airbnb's calendar is the source of truth: confirm your dates are open there, and note the <em>pre-tax</em> nightly price. Then come back to this site and use the request form. Mandy replies within the hour.</p>
            <div className="how-step-tip">
              <span className="how-step-tip-icon" aria-hidden="true">!</span>
              <span><strong>Please don't mention direct booking inside the Airbnb app.</strong> Airbnb monitors messages and flags hosts who steer guests off-platform, which puts the listing at risk. All direct-booking conversations happen here.</span>
            </div>
          </li>
          <li className="how-step">
            <div className="how-step-num">03</div>
            <div className="how-step-title">Pay host-to-guest</div>
            <p>Mandy sends a Zelle or Venmo request for {discountPct}% off the Airbnb pre-tax price. That's your final number: no service fee, no tax stacked on top. The money goes straight to your host.</p>
          </li>
        </ol>
      </div>
    </section>
  );
}

function StaysGrid({ tweaks, nav }) {
  return (
    <section id="stays" className="section stays-section">
      <div className="wrap">
        <div className="section-head">
          <div className="section-eyebrow">The three stays</div>
          <h2 className="section-title">Pick your footprint of the townhouse.</h2>
          <p className="section-lede">Same address, three configurations. The first and third floors operate as separate suites when the whole home isn't booked.</p>
        </div>
        <div className="stays-grid">
          {PROPERTIES.map((p, i) => (
            <PropertyCard key={p.id} p={p} index={i} tweaks={tweaks} nav={nav} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PropertyCard({ p, index, nav }) {
  const fpCaption =
    p.id === "bamboo"  ? "1st floor" :
    p.id === "gateway" ? "Floors 2,3 + rooftop" :
    p.id === "zen"     ? "Entire home" : "";
  return (
    <article className="pcard" onClick={() => nav.property(p.id)}>
      <div className="pcard-num">0{index + 1}</div>
      <div className="pcard-photo">
        {p.heroImage ? <img src={p.heroImage} alt={p.name} className="pcard-img" /> : <Placeholder label={p.heroPlaceholder} tone="card" />}
        {p.guestFavorite && <div className="pcard-badge">Guest favorite</div>}
        <div className="pcard-fp">
          <Footprint unit={p.id} size="sm" />
          <div className="pcard-fp-caption">{fpCaption}</div>
        </div>
      </div>
      <div className="pcard-body">
        <div className="pcard-meta">{p.type} · Sleeps {p.sleeps}</div>
        <h3 className="pcard-title">{p.name}</h3>
        <div className="pcard-tagline">{p.tagline}</div>

        <div className="pcard-actions">
          <button className="pcard-cta">View stay &amp; request to book →</button>
        </div>
      </div>
    </article>
  );
}

function HostBlock() {
  return (
    <div className="wrap host-wrap">
      <div className="host-photo">
        <img src="/img/host.jpg" alt="Mandy & Jacob" className="host-img" />
      </div>
      <div className="host-text">
        <div className="section-eyebrow">Meet your hosts</div>
        <h2 className="section-title">Mandy & Jacob</h2>
        <p className="host-lede">
          Superhosts · {yearsHosting()} years hosting
        </p>
        <p>
          We met in college in San Diego, moved north through the Bay Area, and fell in love with Seattle summers. We designed this Ballard townhouse to feel minimal and stylish, the kind of place we wished existed when we traveled. On weekends you'll find us at the Ballard Sunday Market, backpacking and climbing in the mountains, biking the nearby trails, running around Green Lake, or rallying on the tennis court.
        </p>
        <p>
          When you book with us directly, you're messaging us, not a platform. We respond within the hour, 100% of the time.
        </p>
        <div className="host-badges">
          <div className="host-badge">Superhost</div>
          <div className="host-badge">Identity verified</div>
          <div className="host-badge">Responds within 1h</div>
        </div>
      </div>
    </div>
  );
}

function NeighborhoodBlock() {
  return (
    <div className="wrap neighborhood-wrap">
      <div className="section-head section-head-left">
        <div className="section-eyebrow">Where you'll be</div>
        <h2 className="section-title">Ballard, Seattle.</h2>
        <p className="section-lede">Historic, walkable, and unmistakably Pacific Northwest. Here's what's around the corner.</p>
      </div>
      <div className="neighborhood-grid">
        <div className="map-panel">
          <MapPanel />
        </div>
        <ul className="neighborhood-list">
          {NEIGHBORHOOD.map((n, i) => (
            <li key={i} className="n-item">
              <div className="n-num">{String(i + 1).padStart(2, '0')}</div>
              <div className="n-main">
                <div className="n-name">{n.name}</div>
                <div className="n-type">{n.type}</div>
              </div>
              <div className="n-dist">{n.dist}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FAQ({ tweaks }) {
  const sp = savingsPct(tweaks);
  const items = [
    ["Why book direct instead of Airbnb?", `Same home, same hosts, same self check-in. On Airbnb a 15.5% service fee stacks on top of the host's nightly rate, then Seattle's lodging tax (9.59% combined sales tax + 7% Convention & Trade Center tax = 16.59%) stacks on top of the fee. Roughly a quarter of your bill never reaches the home. Book direct and we charge ${tweaks.discountPct}% off the Airbnb pre-tax price, close to what the host actually gets per night. You save about ${sp}%, the host nets roughly the same.`],
    ["How does the request work?", "Open the stay you want, pick your dates and guest count, then hit Request to book. You'll land on a request page where you add your name, email, phone, and a short message mentioning your check-in date. Mandy gets it directly and replies within the hour to confirm."],
    ["How do I see if my dates are available?", "We don't sync our calendar here. The source of truth is each stay's Airbnb listing. On the homepage, each property has a “Check this stay's date & rate on Airbnb” link. Click through, confirm your dates are open and note the pre-tax rate, then come back to request direct."],
    ["How do I pay?", `Zelle or Venmo, after Mandy confirms your dates. Once she replies to your request, she sends a payment request for the discounted total: ${tweaks.discountPct}% off the Airbnb pre-tax rate, taxes already included, no extra fees.`],
    ["What about taxes and service fees?", `There aren't any on top of the price Mandy quotes you. The all-in price is ${tweaks.discountPct}% off the Airbnb pre-tax nightly rate, with the required WA short-term rental taxes already included. No Airbnb service fee, no surprises.`],
    ["Can I combine the suites?", "Yes. Book the whole townhome (Sunlit Zen Retreat) for groups up to 6, or request two adjacent suites and we'll coordinate keypad codes so your group has the full home."],
    ["How does check-in work?", "Self check-in with a keypad. We send your code 24 hours before arrival along with a Ballard guidebook with our favorite coffee and dinner spots."],
    ["Is parking included?", "Free, safe street parking right out front. If it's full, there's always a spot one block away. No permits needed."],
    ["What's your cancellation policy?", "Flexible: full refund up to 5 days before check-in, 50% up to 24 hours. Long stays (7+ nights) have a custom policy, just ask."],
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section faq-section">
      <div className="wrap faq-wrap">
        <div className="section-head section-head-left">
          <div className="section-eyebrow">Good to know</div>
          <h2 className="section-title">Frequently asked.</h2>
        </div>
        <div className="faq-list">
          {items.map(([q, a], i) => (
            <div key={i} className={`faq-item ${open === i ? 'open' : ''}`} onClick={() => setOpen(open === i ? -1 : i)}>
              <div className="faq-q">
                <span>{q}</span>
                <span className="faq-toggle">{open === i ? '−' : '+'}</span>
              </div>
              {open === i && <div className="faq-a">{a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- PROPERTY DETAIL ----------
function PropertyPage({ id, tweaks, nav }) {
  const p = PROPERTIES.find(x => x.id === id);
  if (!p) return null;

  return (
    <main className="property-page">
      <div className="wrap">
        <button className="back-link" onClick={nav.home}>← All stays</button>
        <div className="pd-head">
          <div>
            <div className="section-eyebrow">{p.type}</div>
            <h1 className="pd-title">{p.name}</h1>
            <div className="pd-meta">
              <span>{p.sleeps} guests</span>
              <span>·</span>
              <span>{p.bedrooms} BR</span>
              <span>·</span>
              <span>{p.beds} beds</span>
              <span>·</span>
              <span>{p.baths} BA</span>
              <span>·</span>
              <span>Ballard, Seattle</span>
            </div>
          </div>
        </div>

        <Gallery photos={p.photos} />

        <div className="pd-body">
          <div className="pd-main">
            <div className="pd-block">
              <div className="pd-host-row">
                <div className="pd-host-avatar"><Placeholder label="Mandy" tone="avatar" /></div>
                <div>
                  <div className="pd-host-name">Hosted by Mandy</div>
                  <div className="pd-host-meta">Superhost · {yearsHosting()} years hosting · Responds within 1h</div>
                </div>
              </div>
            </div>

            <div className="pd-block">
              <h2 className="pd-section-title">Perfect for</h2>
              <p className="pd-perfect">{p.perfectFor}</p>
            </div>

            <div className="pd-block">
              <h2 className="pd-section-title">About this stay</h2>
              <p>{p.longDesc}</p>
            </div>

            <div className="pd-block">
              <h2 className="pd-section-title">What's included</h2>
              <div className="pd-amenities">
                {p.amenities.map((a, i) => (
                  <div key={i} className="pd-amen">
                    <span className="pd-amen-dot">●</span> {a}
                  </div>
                ))}
              </div>
            </div>

            <div className="pd-block">
              <h2 className="pd-section-title">The space</h2>
              <div className="pd-sleep">
                <div className="pd-sleep-item">
                  <div className="pd-sleep-icon">🛏</div>
                  <div className="pd-sleep-label">{p.bedrooms} bedroom{p.bedrooms !== 1 ? 's' : ''}</div>
                  <div className="pd-sleep-meta">{p.beds} bed{p.beds !== 1 ? 's' : ''}</div>
                </div>
                <div className="pd-sleep-item">
                  <div className="pd-sleep-icon">🚿</div>
                  <div className="pd-sleep-label">{p.baths} bathroom{p.baths !== 1 ? 's' : ''}</div>
                  <div className="pd-sleep-meta">Private</div>
                </div>
                <div className="pd-sleep-item">
                  <div className="pd-sleep-icon">◐</div>
                  <div className="pd-sleep-label">Sleeps {p.sleeps}</div>
                  <div className="pd-sleep-meta">Max guests</div>
                </div>
              </div>
            </div>

            <div className="pd-block">
              <h2 className="pd-section-title">House rules</h2>
              <ul className="pd-rules">
                <li>Check-in after 4:00 PM (self check-in with keypad)</li>
                <li>Checkout before 11:00 AM</li>
                <li>Maximum {p.sleeps} guests</li>
                <li>No parties or events</li>
                <li>No smoking anywhere on the property</li>
                {p.id === "zen" && <li>Pets allowed (let us know)</li>}
              </ul>
            </div>
          </div>

          <aside className="pd-side">
            <RequestWidget p={p} tweaks={tweaks} nav={nav} />
          </aside>
        </div>
      </div>
    </main>
  );
}

// ---------- REQUEST WIDGET (property page sidebar) ----------
function RequestWidget({ p, tweaks, nav }) {
  const [dates, setDates] = useState({ checkin: null, checkout: null });
  const [guests, setGuests] = useState(2);

  const nights = dates.checkin && dates.checkout
    ? Math.max(1, Math.round((dates.checkout - dates.checkin) / 86400000))
    : 0;
  const ready = !!(dates.checkin && dates.checkout);

  return (
    <div className="rw">
      <div className="rw-head">
        <div className="rw-eyebrow">Book direct, save ≈{savingsPct(tweaks)}%</div>
        <div className="rw-title">Send Mandy your dates.</div>
      </div>

      <div className="rw-pricing-pitch">
        <div className="rw-pitch-row">
          <span className="rw-pitch-tag">≈{savingsPct(tweaks)}% less</span>
          <span className="rw-pitch-text">
            We charge <strong>{tweaks.discountPct}% off the Airbnb pre-tax price</strong>, close to what the host nets from Airbnb after their cut. No service fee, no tax stacked on a fee. Roughly <strong>{savingsPct(tweaks)}% less</strong> than what you'd pay Airbnb total with tax.
          </span>
        </div>
        <a className="rw-airbnb-link" href={p.airbnbUrl} target="_blank" rel="noopener">
          <span>Check this stay's date &amp; rate on Airbnb ↗</span>
        </a>
        <div className="rw-pitch-foot">Then come back here with your dates. Pay by Zelle or Venmo after Mandy confirms.</div>
      </div>

      <div className="rw-form">
        <div className="rw-field-group">
          <div className="rw-field-label">When are you coming?</div>
          <CalendarField dates={dates} setDates={setDates} />
          {nights > 0 && (
            <div className="rw-nights">{nights} night{nights > 1 ? "s" : ""} in Ballard</div>
          )}
        </div>

        <div className="rw-field-group">
          <div className="rw-field-label">Guests</div>
          <div className="rw-guests">
            <button onClick={() => setGuests(Math.max(1, guests - 1))} aria-label="Fewer guests">−</button>
            <span>{guests} guest{guests > 1 ? "s" : ""}</span>
            <button onClick={() => setGuests(Math.min(p.sleeps, guests + 1))} aria-label="More guests">+</button>
            <span className="rw-guests-max">Max {p.sleeps}</span>
          </div>
        </div>

        <button
          className="rw-submit"
          onClick={() => ready && nav.requestBook(p.id, { dates, guests })}
          disabled={!ready}
        >
          {ready ? "Request to book →" : "Pick dates to continue"}
        </button>

        <div className="rw-foot">
          Free to ask. You'll add your contact info on the next step. Pay by Zelle or Venmo only after Mandy confirms.
        </div>
      </div>
    </div>
  );
}

// ---------- REQUEST TO BOOK PAGE ----------
function RequestBookPage({ id, initData, tweaks, nav }) {
  const [selectedId, setSelectedId] = useState(id);
  const p = PROPERTIES.find(x => x.id === selectedId) || PROPERTIES[0];
  const coerceDate = (v) => (v ? (v instanceof Date ? v : new Date(v)) : null);
  const [dates, setDates] = useState(() => ({
    checkin: coerceDate(initData?.dates?.checkin),
    checkout: coerceDate(initData?.dates?.checkout),
  }));
  const [guests, setGuests] = useState(initData?.guests || 2);
  // Clamp guests if user picks a smaller-capacity stay
  useEffect(() => { if (guests > p.sleeps) setGuests(p.sleeps); }, [selectedId]);
  const [info, setInfo] = useState({ name: "", email: "", phone: "", payMethod: "zelle", payHandle: "", message: "" });
  const [editDates, setEditDates] = useState(false);
  const [editGuests, setEditGuests] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  if (!p) return null;

  const nights = dates.checkin && dates.checkout
    ? Math.max(1, Math.round((dates.checkout - dates.checkin) / 86400000))
    : 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim());
  const payHandleValid = info.payHandle.trim().length > 0;
  const valid = dates.checkin && dates.checkout && info.name.trim() && emailValid && payHandleValid;

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setSubmitting(true);
    setSubmitError(false);
    const conf = "REQ-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    const payName = info.payMethod === "venmo" ? "Venmo" : "Zelle";
    const title = `${p.name.split(" with")[0]} · ${fmtLong(dates.checkin)} to ${fmtLong(dates.checkout)}`;
    const body =
      `${p.name}\n` +
      `${fmtLong(dates.checkin)} to ${fmtLong(dates.checkout)} · ${nights} night${nights > 1 ? "s" : ""} · ${guests} guest${guests > 1 ? "s" : ""}\n` +
      `\n${info.name} · ${info.email}${info.phone ? ` · ${info.phone}` : ""}\n` +
      `Pay: ${payName} ${info.payHandle}\n` +
      (info.message ? `\n"${info.message}"\n` : "") +
      `\nRequest ${conf}`;
    try {
      const r = await fetch("https://ntfy.sh/mandy-seattle-direct-booking", {
        method: "POST",
        headers: { "Title": title, "Tags": "house,calendar", "Priority": "default" },
        body,
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      nav.requestSent(p.id, { dates, guests, nights, info, conf });
    } catch (err) {
      console.warn("ntfy push failed:", err);
      setSubmitError(true);
      setSubmitting(false);
    }
  };

  return (
    <main className="rbp">
      <div className="wrap rbp-wrap">
        <div className="rbp-head">
          <button className="rbp-back" onClick={() => nav.property(p.id)} aria-label="Back to stay">←</button>
          <h1 className="rbp-title">Request to book</h1>
        </div>

        <div className="rbp-grid">
          <div className="rbp-main">
            <section className="rbp-card">
              <h2 className="rbp-card-title">Choose your stay</h2>
              <div className="rbp-stayselect">
                {PROPERTIES.map(opt => {
                  const fpCap = opt.id === "bamboo" ? "1st floor" : opt.id === "gateway" ? "Floors 2–3 + rooftop" : "Entire home";
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={"rbp-stay-row" + (opt.id === selectedId ? " rbp-stay-row-active" : "")}
                      onClick={() => setSelectedId(opt.id)}
                    >
                      <div className="rbp-stay-row-thumb">
                        {opt.heroImage
                          ? <img src={opt.heroImage} alt="" />
                          : <Placeholder label={opt.heroPlaceholder} tone="summary" />}
                      </div>
                      <div className="rbp-stay-row-text">
                        <div className="rbp-stay-row-name">{opt.name}</div>
                        <div className="rbp-stay-row-meta">{fpCap} · Sleeps {opt.sleeps}</div>
                      </div>
                      <span className="rbp-stay-row-check" aria-hidden="true">✓</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rbp-card">
              <h2 className="rbp-card-title">Your trip</h2>

              <div className="rbp-row">
                <div className="rbp-row-text">
                  <div className="rbp-row-key">Dates</div>
                  <div className="rbp-row-val">
                    {dates.checkin && dates.checkout
                      ? `${fmtLong(dates.checkin)} → ${fmtLong(dates.checkout)} · ${nights} night${nights>1?'s':''}`
                      : <span className="rbp-row-empty">Pick your dates</span>}
                  </div>
                </div>
                <button className="rbp-edit" onClick={() => setEditDates(v => !v)}>
                  {editDates ? "Done" : (dates.checkin && dates.checkout ? "Change" : "Pick dates")}
                </button>
              </div>
              {editDates && (
                <div className="rbp-edit-block">
                  <CalendarField dates={dates} setDates={setDates} />
                </div>
              )}

              <div className="rbp-divider"></div>

              <div className="rbp-row">
                <div className="rbp-row-text">
                  <div className="rbp-row-key">Guests</div>
                  <div className="rbp-row-val">{guests} guest{guests>1?'s':''}</div>
                </div>
                <button className="rbp-edit" onClick={() => setEditGuests(v => !v)}>
                  {editGuests ? "Done" : "Change"}
                </button>
              </div>
              {editGuests && (
                <div className="rbp-edit-block">
                  <div className="rw-guests">
                    <button onClick={() => setGuests(Math.max(1, guests - 1))} aria-label="Fewer guests">−</button>
                    <span>{guests} guest{guests > 1 ? "s" : ""}</span>
                    <button onClick={() => setGuests(Math.min(p.sleeps, guests + 1))} aria-label="More guests">+</button>
                    <span className="rw-guests-max">Max {p.sleeps}</span>
                  </div>
                </div>
              )}
            </section>

            <section className="rbp-card">
              <h2 className="rbp-card-title">Your contact info</h2>
              <p className="rbp-card-sub">Mandy replies within the hour, usually faster.</p>

              <div className="rbp-field">
                <label>Full name</label>
                <input
                  className={touched && !info.name.trim() ? "rbp-input-error" : ""}
                  value={info.name}
                  onChange={e => setInfo({ ...info, name: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>

              <div className="rbp-field-two">
                <div className="rbp-field">
                  <label>Email</label>
                  <input
                    type="email"
                    className={touched && !emailValid ? "rbp-input-error" : ""}
                    value={info.email}
                    onChange={e => setInfo({ ...info, email: e.target.value })}
                    placeholder="jane@email.com"
                  />
                </div>
                <div className="rbp-field">
                  <label>Phone number</label>
                  <input
                    type="tel"
                    value={info.phone}
                    onChange={e => setInfo({ ...info, phone: e.target.value })}
                    placeholder="+1 (555) 555-5555"
                  />
                </div>
              </div>
            </section>

            <section className="rbp-card">
              <h2 className="rbp-card-title">Preferred way to pay</h2>
              <p className="rbp-card-sub">After Mandy confirms your dates, she'll send a payment request through your preferred service. Nothing is charged until you accept it.</p>

              <div className="paypref" role="radiogroup" aria-label="Preferred payment method">
                <button
                  type="button"
                  role="radio"
                  aria-checked={info.payMethod === "zelle"}
                  className={`paypref-option ${info.payMethod === "zelle" ? "paypref-active" : ""}`}
                  onClick={() => setInfo({ ...info, payMethod: "zelle" })}
                >
                  <span className="paypref-top">
                    <span className="paypref-logo paypref-logo--zelle" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M8 5.5h9L9 16.5h8V19H7v-2.5L15 6H8z" fill="#fff" /></svg>
                    </span>
                    <span className="paypref-name">Zelle</span>
                    <span className="paypref-check" aria-hidden="true">✓</span>
                  </span>
                  <span className="paypref-sub">Bank-to-bank · No fees · Built into most US banking apps</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={info.payMethod === "venmo"}
                  className={`paypref-option ${info.payMethod === "venmo" ? "paypref-active" : ""}`}
                  onClick={() => setInfo({ ...info, payMethod: "venmo" })}
                >
                  <span className="paypref-top">
                    <span className="paypref-logo paypref-logo--venmo" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M18.5 3.5c.7 1.1 1 2.3 1 3.9 0 4.8-4.1 11-7.2 14.6H6.4L4 6.5l5.7-.5 1.2 9.8c1.2-1.9 2.6-4.9 2.6-6.9 0-1-.2-1.8-.5-2.4l5.5-3z" fill="#fff" /></svg>
                    </span>
                    <span className="paypref-name">Venmo</span>
                    <span className="paypref-check" aria-hidden="true">✓</span>
                  </span>
                  <span className="paypref-sub">App-based · Instant · Free for friends &amp; family transfers</span>
                </button>
              </div>

              <div className="rbp-field paypref-handle">
                <label>
                  {info.payMethod === "zelle"
                    ? "Your Zelle email or US phone"
                    : "Your Venmo username"}
                </label>
                <input
                  className={touched && !payHandleValid ? "rbp-input-error" : ""}
                  value={info.payHandle}
                  onChange={e => setInfo({ ...info, payHandle: e.target.value })}
                  placeholder={
                    info.payMethod === "zelle"
                      ? "jane@email.com or +1 (555) 555-5555"
                      : "@jane-doe"
                  }
                />
                <div className="rbp-field-hint">
                  {info.payMethod === "zelle"
                    ? "We'll send the Zelle request to this contact after Mandy confirms."
                    : <>Find your username at <code>venmo.com/account/settings</code>. The @ is optional.</>}
                </div>
              </div>
            </section>

            <section className="rbp-card">
              <h2 className="rbp-card-title">Write a message to Mandy</h2>
              <p className="rbp-card-sub">Please mention your <strong>check-in &amp; check-out dates</strong>, what brings you to Seattle, arrival time, and anyone joining (kids, pets, occasions). This helps Mandy confirm faster.</p>
              <div className="rbp-host-row">
                <div className="rbp-host-avatar"><Placeholder label="Mandy" tone="avatar" /></div>
                <div>
                  <div className="rbp-host-name">Mandy</div>
                  <div className="rbp-host-meta">Hosting since 2020</div>
                </div>
              </div>
              <textarea
                className="rbp-textarea"
                value={info.message}
                onChange={e => setInfo({ ...info, message: e.target.value })}
                placeholder={`Hi Mandy, we'd love to book the ${p.name.split(" with")[0]} with check-in on [date] and checkout on [date]. We're a party of ${guests} coming for…`}
                rows={6}
              />
            </section>

            <button
              className="rbp-submit"
              onClick={submit}
              disabled={submitting || !valid}
            >
              {submitting ? "Sending request…" : "Request to book"}
            </button>

            {touched && !valid && (
              <div className="rbp-error">
                {(!dates.checkin || !dates.checkout) && "Please pick your dates. "}
                {!info.name.trim() && "Add your full name. "}
                {!emailValid && "Enter a valid email. "}
                {!payHandleValid && (info.payMethod === "zelle" ? "Add your Zelle email or phone." : "Add your Venmo username.")}
              </div>
            )}

            {submitError && (
              <div className="rbp-error" role="alert">
                <strong>Technical problem sending your request.</strong> Mandy may not get the notification right now. Please tap <em>Request to book</em> again to retry, or in the meantime email <a href="mailto:mandyzhang2400@gmail.com">mandyzhang2400@gmail.com</a> directly with your dates and contact info.
              </div>
            )}

            <div className="rbp-legal">
              By sending this request you agree to Ballard Stays' house rules and cancellation policy. Nothing is charged now. Mandy reviews your dates first and, once confirmed, sends a Zelle or Venmo request for the discounted total.
            </div>
          </div>

          <aside className="rbp-side">
            <div className="rbp-summary">
              <div className="rbp-summary-head">
                <div className="rbp-summary-photo">
                  {p.heroImage
                    ? <img src={p.heroImage} alt={p.name} />
                    : <Placeholder label={p.heroPlaceholder} tone="summary" />}
                </div>
                <div className="rbp-summary-text">
                  <div className="rbp-summary-meta">{p.type}</div>
                  <div className="rbp-summary-name">{p.name}</div>
                  {p.guestFavorite && <div className="rbp-summary-rating"><span className="rbp-summary-fav">★ Guest favorite</span></div>}
                </div>
              </div>

              <div className="rbp-summary-divider"></div>

              <div className="rbp-summary-row">
                <div className="rbp-summary-row-key">Hosted by</div>
                <div className="rbp-summary-row-val">Mandy · Superhost · 1h response</div>
              </div>

              <div className="rbp-summary-row">
                <div className="rbp-summary-row-key">Self check-in</div>
                <div className="rbp-summary-row-val">Keypad code sent 24h before</div>
              </div>

              <div className="rbp-summary-row">
                <div className="rbp-summary-row-key">Payment</div>
                <div className="rbp-summary-row-val">Zelle or Venmo after confirmation</div>
              </div>

              <div className="rbp-summary-row">
                <div className="rbp-summary-row-key">Free to cancel</div>
                <div className="rbp-summary-row-val">Full refund up to 14 days before</div>
              </div>

              <div className="rbp-summary-divider"></div>

              <div className="rbp-deal">
                <div className="rbp-deal-title">Why book direct</div>
                <ul className="rbp-deal-list">
                  <li>
                    <span className="rbp-deal-icon">✕</span>
                    <span>No Airbnb service fee</span>
                  </li>
                  <li>
                    <span className="rbp-deal-icon">✕</span>
                    <span>No Airbnb tax on top</span>
                  </li>
                  <li>
                    <span className="rbp-deal-icon">−{tweaks.discountPct}%</span>
                    <span>Off the Airbnb pre-tax nightly rate</span>
                  </li>
                </ul>
                <div className="rbp-deal-total">
                  <span>Total savings</span>
                  <span className="rbp-deal-total-val">≈{savingsPct(tweaks)}%</span>
                </div>
                <div className="rbp-deal-foot">
                  vs. what you'd pay on Airbnb total with tax.
                </div>
              </div>

              <a className="rbp-airbnb" href={p.airbnbUrl} target="_blank" rel="noopener">
                Re-check the Airbnb rate ↗
              </a>

              <div className="rbp-pay-note">
                <div className="rbp-pay-note-head">
                  <span className="rbp-pay-pill rbp-pay-pill-zelle">Zelle</span>
                  <span className="rbp-pay-pill rbp-pay-pill-venmo">Venmo</span>
                </div>
                <div className="rbp-pay-note-text">
                  Once Mandy confirms your dates, she sends a Zelle or Venmo request for the discounted total. No card, no platform fee.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

// ---------- REQUEST SENT ----------
function RequestSent({ route, tweaks, nav }) {
  const p = PROPERTIES.find(x => x.id === route.id);
  const data = route.data || {};
  const first = (data.info?.name || "").split(" ")[0] || "friend";
  if (!p) return null;
  return (
    <main className="confirm">
      <div className="wrap confirm-wrap">
        <div className="confirm-icon">◐</div>
        <div className="section-eyebrow">Request #{data.conf}</div>
        <h1 className="confirm-title">Got it, {first}.</h1>
        <p className="confirm-sub">
          Your request is on its way to Mandy. She typically replies within the hour with confirmation and a <strong>{data.info?.payMethod === "venmo" ? "Venmo" : "Zelle"}</strong> request at <strong>{tweaks.discountPct}% off the Airbnb pre-tax rate</strong>.
        </p>
        <div className="confirm-card">
          <div className="cc-photo">{p.heroImage ? <img src={p.heroImage} alt={p.name} className="cc-img" /> : <Placeholder label={p.heroPlaceholder} tone="summary" />}</div>
          <div className="cc-body">
            <div className="cc-name">{p.name}</div>
            <div className="cc-dates">
              {fmtLong(data.dates?.checkin)} → {fmtLong(data.dates?.checkout)} · {data.nights} night{data.nights > 1 ? "s" : ""} · {data.guests} guest{data.guests > 1 ? "s" : ""}
            </div>
            <div className="cc-meta">Sent to the host from {data.info?.email}</div>
          </div>
        </div>
        <div className="confirm-next">
          <h3>What happens next</h3>
          <ol>
            <li>Mandy reviews your request against the live Airbnb calendar.</li>
            <li>Within 24 hours, she replies confirming your dates and the discounted total ({tweaks.discountPct}% off the Airbnb pre-tax rate).</li>
            <li>You send payment via <strong>{data.info?.payMethod === "venmo" ? "Venmo" : "Zelle"}</strong> to <code>{data.info?.payHandle || (data.info?.payMethod === "venmo" ? "your Venmo username" : "your Zelle handle")}</code>. No card, no platform fee.</li>
            <li>24 hours before check-in, we send your keypad code and the Ballard guide.</li>
          </ol>
          <p className="confirm-fallback">
            This site is relatively new, so if you don't hear back within 24 hours, please message Mandy directly at <a href="mailto:mandyzhang2400@gmail.com">mandyzhang2400@gmail.com</a>.
          </p>
        </div>
        <div className="confirm-actions">
          <button className="btn btn-primary" onClick={nav.home}>Back to home</button>
          <button className="btn btn-ghost" onClick={() => nav.property(p.id)}>View stay again</button>
        </div>
      </div>
    </main>
  );
}

// ---------- INLINE CALENDAR ----------
function CalendarField({ dates, setDates }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [hover, setHover] = useState(null);
  const [bumpedTo, setBumpedTo] = useState(null);

  const y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthName = month.toLocaleString("default", { month: "long", year: "numeric" });

  // Pre-block day-after-checkin when checkin is Thu/Fri/Sat (no 1-night weekend stay)
  const ciDow = (dates.checkin && !dates.checkout) ? dates.checkin.getDay() : -1;
  const blockedCheckoutTime = (ciDow === 4 || ciDow === 5 || ciDow === 6)
    ? dates.checkin.getTime() + 86400000
    : null;

  const apply = (ci, co) => {
    const result = enforceWeekendMin(ci, co);
    setDates({ checkin: result.checkin, checkout: result.checkout });
    setBumpedTo(result.bumped ? result.checkout : null);
  };

  const onDay = (day) => {
    const d = new Date(y, m, day);
    if (d < today) return;
    if (blockedCheckoutTime !== null && d.getTime() === blockedCheckoutTime) return;
    if (!dates.checkin || (dates.checkin && dates.checkout)) {
      apply(d, null);
    } else if (d <= dates.checkin) {
      apply(d, null);
    } else {
      apply(dates.checkin, d);
    }
  };

  const prevDisabled = y === today.getFullYear() && m === today.getMonth();

  return (
    <div className="rwcal" onClick={(e) => e.stopPropagation()}>
      <div className="rwcal-head">
        <button onClick={() => !prevDisabled && setMonth(new Date(y, m - 1, 1))} disabled={prevDisabled} aria-label="Previous month">‹</button>
        <div className="rwcal-month">{monthName}</div>
        <button onClick={() => setMonth(new Date(y, m + 1, 1))} aria-label="Next month">›</button>
      </div>
      <div className="rwcal-dow">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="rwcal-grid">
        {Array.from({ length: startDay }).map((_, i) => <div key={"b" + i}></div>)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const d = new Date(y, m, day);
          const past = d < today;
          const blocked = blockedCheckoutTime !== null && d.getTime() === blockedCheckoutTime;
          const isStart = dates.checkin && d.getTime() === dates.checkin.getTime();
          const isEnd = dates.checkout && d.getTime() === dates.checkout.getTime();
          let inRange = false;
          if (dates.checkin && dates.checkout) {
            inRange = d > dates.checkin && d < dates.checkout;
          } else if (dates.checkin && hover && !dates.checkout) {
            inRange = d > dates.checkin && d <= hover;
          }
          const cls = ["rwcal-day"];
          if (past || blocked) cls.push("past");
          if (isStart) cls.push("start");
          if (isEnd) cls.push("end");
          if (inRange) cls.push("inrange");
          return (
            <div
              key={day}
              className={cls.join(" ")}
              onClick={() => !(past || blocked) && onDay(day)}
              onMouseEnter={() => !(past || blocked) && setHover(d)}
              onMouseLeave={() => setHover(null)}
            >{day}</div>
          );
        })}
      </div>
      <div className="rwcal-foot">
        We don't sync with Airbnb. Mandy double-checks your dates against the live calendar before confirming.
      </div>
      {bumpedTo ? (
        <div className="date-bump" role="status">
          <span className="date-bump-icon" aria-hidden="true">↗</span>
          <span>Checkout extended to <strong>{fmtLong(bumpedTo)}</strong>, stays starting on a Thursday, Friday, or Saturday require <strong>2 nights minimum</strong>.</span>
        </div>
      ) : (
        <div className="date-rule">
          <span className="date-rule-dot" aria-hidden="true"></span>
          <span><strong>2-night minimum</strong> when check-in is on a Thursday, Friday, or Saturday.</span>
        </div>
      )}
    </div>
  );
}

// ---------- FOOTER ----------
function Footer({ tweaks }) {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="footer-brand">
          <div className="logo-mark">◐</div>
          <div className="logo-name">{tweaks.brandName}</div>
          <div className="footer-note">A Ballard townhouse, hosted by Mandy & Jacob.</div>
        </div>
        <div className="footer-cols">
          <div>
            <div className="footer-col-head">Stays</div>
            {PROPERTIES.map(p => <div key={p.id} className="footer-link">{p.name}</div>)}
          </div>
          <div>
            <div className="footer-col-head">Contact</div>
            <div className="footer-link">hello@ballardstays.com</div>
            <div className="footer-link">Message on Instagram</div>
            <div className="footer-link">Response in under 1h</div>
          </div>
          <div>
            <div className="footer-col-head">Policies</div>
            <div className="footer-link">Cancellation</div>
            <div className="footer-link">House rules</div>
            <div className="footer-link">Privacy</div>
          </div>
        </div>
      </div>
      <div className="wrap footer-legal">
        <div>© 2026 {tweaks.brandName} · Seattle, WA</div>
        <div>Made with care in Ballard.</div>
      </div>
    </footer>
  );
}

// ---------- TWEAKS PANEL ----------
function TweaksPanel({ tweaks, update, onClose }) {
  const presets = [
    { name: "Forest", accent: "#2F4A3A", soft: "#E8EDE3" },
    { name: "Ink", accent: "#1A1A1A", soft: "#F2F1ED" },
    { name: "Terracotta", accent: "#A84F2F", soft: "#F4E8DD" },
    { name: "Cascade", accent: "#2B4A6B", soft: "#E2ECF4" },
    { name: "Rose", accent: "#8C2F4F", soft: "#F4E4E8" },
  ];
  const fontPairs = [
    { d: "Fraunces", b: "Inter", label: "Fraunces + Inter" },
    { d: "Instrument Serif", b: "Inter", label: "Instrument + Inter" },
    { d: "DM Serif Display", b: "DM Sans", label: "DM Serif + DM Sans" },
    { d: "Playfair Display", b: "Lato", label: "Playfair + Lato" },
  ];
  return (
    <div className="tweaks">
      <div className="tweaks-head">
        <div>Tweaks</div>
        <button onClick={onClose}>×</button>
      </div>
      <div className="tweaks-body">
        <div className="tw-group">
          <div className="tw-label">Brand name</div>
          <input value={tweaks.brandName} onChange={e => update("brandName", e.target.value)} />
        </div>
        <div className="tw-group">
          <div className="tw-label">Color palette</div>
          <div className="tw-presets">
            {presets.map(p => (
              <button key={p.name} className="tw-preset" onClick={() => { update("accent", p.accent); update("accentSoft", p.soft); }}>
                <span className="tw-swatch" style={{ background: p.accent }}></span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="tw-group">
          <div className="tw-label">Font pairing</div>
          <div className="tw-fonts">
            {fontPairs.map(f => (
              <button key={f.label} className={`tw-font ${tweaks.fontDisplay === f.d ? 'active' : ''}`}
                onClick={() => { update("fontDisplay", f.d); update("fontBody", f.b); }}>
                <span style={{ fontFamily: `"${f.d}", serif`, fontSize: 18 }}>{f.d}</span>
                <span style={{ fontFamily: `"${f.b}", sans-serif`, fontSize: 12, opacity: .7 }}>{f.b}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="tw-group">
          <div className="tw-label">Direct-book discount ({tweaks.discountPct}%)</div>
          <input type="range" min="0" max="25" step="1" value={tweaks.discountPct} onChange={e => update("discountPct", parseInt(e.target.value))} />
        </div>
        <div className="tw-group">
          <label className="tw-check">
            <input type="checkbox" checked={tweaks.showSavingsBanner} onChange={e => update("showSavingsBanner", e.target.checked)} />
            Show "How direct works" section
          </label>
        </div>
      </div>
    </div>
  );
}

// ---------- GALLERY ----------
function Gallery({ photos }) {
  const [lightboxIdx, setLightboxIdx] = useState(-1);
  const hero = photos[0];
  const rest = photos.slice(1, 5);

  useEffect(() => {
    if (lightboxIdx < 0) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLightboxIdx(-1);
      if (e.key === "ArrowLeft") setLightboxIdx(i => (i - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") setLightboxIdx(i => (i + 1) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, photos.length]);

  const PhotoCell = ({ ph, idx, className }) => (
    <div className={`pd-gallery-cell ${className || ''}`} onClick={() => ph.src && setLightboxIdx(idx)}>
      {ph.src
        ? <img src={ph.src} alt={ph.label} className="pd-gallery-img" />
        : <Placeholder label={ph.label} tone="gallery" />}
    </div>
  );

  return (
    <>
      <div className="pd-gallery">
        <PhotoCell ph={hero} idx={0} className="pd-gallery-main" />
        <div className="pd-gallery-grid">
          {rest.map((ph, i) => (
            <PhotoCell key={i} ph={ph} idx={i + 1} />
          ))}
        </div>
        {photos.length > 5 && (
          <button className="pd-gallery-more" onClick={() => setLightboxIdx(0)}>
            <span>◫</span> Show all {photos.length} photos
          </button>
        )}
      </div>
      {lightboxIdx >= 0 && (
        <div className="lightbox" onClick={() => setLightboxIdx(-1)}>
          <button className="lb-close" onClick={(e) => { e.stopPropagation(); setLightboxIdx(-1); }}>×</button>
          <button className="lb-prev" onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => (i - 1 + photos.length) % photos.length); }}>‹</button>
          <button className="lb-next" onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => (i + 1) % photos.length); }}>›</button>
          <div className="lb-inner" onClick={(e) => e.stopPropagation()}>
            {photos[lightboxIdx].src
              ? <img src={photos[lightboxIdx].src} alt={photos[lightboxIdx].label} className="lb-img" />
              : <div className="lb-placeholder"><Placeholder label={photos[lightboxIdx].label} tone="gallery" /></div>}
            <div className="lb-caption">
              <span className="lb-counter">{lightboxIdx + 1} / {photos.length}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
