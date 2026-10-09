import { Explorer, type CallView, type OutcomeKey } from "./components/Explorer";
import { config } from "@/lib/config";
import { loadDashboard, PERIODS, SOURCES, sourceCounts, type CallRow, type Period, type Source } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const TZ = config.timeZone;
const inr = (v: number, digits = 0) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2 Sep" in IST (Intl's en-GB short month now prints "Sept"). */
const day = (iso: string) => {
  const [y, m, dd] = new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  return y ? `${dd} ${MONTHS[m - 1]}` : "";
};
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }).format(new Date(iso))) % 24;

const INDEX = [
  ["Overview", "#overview", "#a9c99f"],
  ["Needs a person", "#attention", "#b4a3db"],
  ["Where calls went", "#outcomes", "#94b6d6"],
  ["Day's rhythm", "#rhythm", "#e6cc7a"],
  ["Every call", "#calls", "#e8b5a8"],
  ["What it cost", "#cost", "#c9c5bb"],
] as const;

const EMPTY_HINT: Record<Source, string> = {
  live: "Live calls appear here once the Vaani Labs number is connected.",
  replay: "Run npm run replay to send the September transcripts through the pipeline.",
  demo: "The September demo calls fall outside this period. Try All time.",
};

/** One stored call → what the list and the designer brief show. */
function toView(c: CallRow): CallView {
  const outcome = (c.outcome in { qualified: 1, nurture: 1, escalated: 1, declined: 1, message: 1 } ? c.outcome : "unclassified") as OutcomeKey;
  const consultPlace = c.consultation_type === "site" ? "Site visit" : c.consultation_type === "studio" ? "Studio" : null;
  const consult =
    consultPlace || c.consultation_at
      ? `${consultPlace ?? "Booked"} · ${c.consultation_at ? `${day(c.consultation_at)}, ${clock(c.consultation_at)}` : "time not set"}`
      : null;
  const dur = c.duration_seconds ?? 0;
  const handoff =
    c.outcome === "qualified"
      ? [c.telegram_sent ? "Telegram sent" : "Telegram not sent", c.hubspot_deal_id ? `HubSpot deal ${c.hubspot_deal_id}` : null].filter(Boolean).join(" · ")
      : c.outcome === "escalated"
        ? c.telegram_sent ? "Urgent Telegram sent" : "Urgent Telegram not sent"
        : null;

  const details: [string, string | null][] = [
    ["Scope", c.scope],
    ["Size", c.carpet_area_sqft ? `${c.carpet_area_sqft.toLocaleString("en-IN")} sq ft` : null],
    ["Complete by", c.complete_by],
    ["Decides", c.decision_maker],
    ["Heard of us", c.referral],
    ["Budget volunteered", c.budget_volunteered],
    ["Consultation", consult],
    ["Call length", dur ? `${Math.floor(dur / 60)} min ${dur % 60} s` : null],
    ["Handoff", handoff],
  ];

  const shortId = c.call_id.replace(/^demo-/, "").replace(/^replay-[^-]+-/, "");
  return {
    id: c.call_id,
    shortId: shortId.length > 10 ? shortId.slice(-8) : shortId,
    outcome,
    date: day(c.started_at),
    time: clock(c.started_at),
    when: `${day(c.started_at)} · ${clock(c.started_at)}`,
    hour: hourOf(c.started_at),
    after: c.after_hours,
    caller: c.name,
    location: c.location,
    summary: c.summary,
    uncertain: c.uncertain,
    flags: c.flags ?? [],
    details: details.filter((d): d is [string, string] => Boolean(d[1])).map(([k, v]) => ({ k, v })),
    transcript: c.transcript,
    attention: c.outcome === "escalated" ? "escalated" : c.flags?.includes("previous enquiry missed") ? "missed" : null,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!process.env.DATABASE_URL) {
    return (
      <div className="shell">
        <main className="main">
          <div className="card empty">
            <div className="orb" />
            <div className="t">Not connected yet</div>
            <p>DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.</p>
          </div>
        </main>
      </div>
    );
  }

  const params = await searchParams;
  const counts = await sourceCounts();
  const source = (SOURCES.some((s) => s.id === params.source) ? params.source : counts.live ? "live" : "demo") as Source;
  const period = (PERIODS.some((p) => p.id === params.period) ? params.period : "all") as Period;
  const d = await loadDashboard(source, period);
  const href = (s: Source, p: Period) => `/?source=${s}&period=${p}`;
  const isDemo = source === "demo";
  const pct = d.n ? Math.round((d.within5 / d.n) * 100) : 0;
  const periodLabel = PERIODS.find((p) => p.id === period)!.label + (isDemo ? " · September 2026" : "");
  const paidFixed = d.cost.fixedRows.filter((r) => r.amount > 0);
  const freeFixed = d.cost.fixedRows.filter((r) => r.amount === 0);

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-logo">
          <img src="/aangan-logo.png" alt="Aangan Interiors" width={132} height={94} />
          <span className="brand-pill">Phone agent</span>
        </div>
        <div className="side-mark">
          <img src="/aangan-mark.png" alt="Aangan Interiors" width={45} height={34} />
          <div>
            <div className="word">AANGAN</div>
            <div className="tag">Phone agent</div>
          </div>
        </div>

        <div className="status">
          <span className="dot" />
          <span className="txt">Answering, day or night</span>
        </div>

        <nav className="side-nav" aria-label="Sections">
          {INDEX.map(([label, anchor, dot]) => (
            <a key={anchor} href={anchor}>
              <span className="dot" style={{ background: dot }} />
              {label}
            </a>
          ))}
        </nav>

        <div className="side-group">
          <span>Data</span>
          <div className="pills">
            {SOURCES.map((s) => (
              <a key={s.id} className="pill-link" href={href(s.id, period)} aria-current={s.id === source}>
                {s.label}
                <span className="count">{counts[s.id] ?? 0}</span>
              </a>
            ))}
          </div>
        </div>
        <div className="side-group">
          <span>Period</span>
          <div className="pills">
            {PERIODS.map((p) => (
              <a key={p.id} className="pill-link" href={href(source, p.id)} aria-current={p.id === period}>
                {p.label}
              </a>
            ))}
          </div>
        </div>

        <div className="side-note">
          Front desk 10am–7pm
          <br />
          Pune city &amp; PCMC
          {process.env.DASHBOARD_PASSWORD && (
            <form method="post" action="/api/logout">
              <button type="submit" className="signout">
                Sign out
              </button>
            </form>
          )}
        </div>
      </aside>

      <main className="main">
        {d.n === 0 ? (
          <div className="card empty">
            <div className="orb" />
            <div className="t">A quiet courtyard</div>
            <p>No calls in this period. {EMPTY_HINT[source]}</p>
          </div>
        ) : (
          <>
            <section id="overview" className="overview">
              <div className="card hero">
                <div className="hero-top">
                  <span className="tag-pill">{periodLabel}</span>
                  {isDemo && <span className="demo-pill">Demo data</span>}
                </div>
                <h1 className="headline">
                  {d.n} calls answered. <span className="soft">{d.qualified} sent to a designer,</span>{" "}
                  <span className="win">{d.booked} consultations booked.</span>
                </h1>
                <div className="compare">
                  <span style={{ color: "#8d9094" }}>Before the agent</span>
                  <div className="bar-row">
                    <div className="bar" style={{ width: "52%", background: "#e8e5dc" }} />
                    <span className="label" style={{ color: "#5b5f63" }}>52% replied within 48 hours</span>
                  </div>
                  <span>With the agent</span>
                  <div className="bar-row">
                    <div className="bar" style={{ flex: 1, background: "#a9c99f" }} />
                    <span className="label">{pct}% within 5 minutes</span>
                  </div>
                </div>
                {isDemo && (
                  <p className="disclaimer">
                    The 20 September calls, classified by hand against Nikhil&apos;s rubric and shown as if the agent had answered them.
                    Voice cost uses {inr(d.cost.voiceRate, 1)}/min, a market benchmark, not a Vaani Labs quote.
                  </p>
                )}
              </div>

              <div className="stats">
                <div className="stat tone-sage">
                  <span className="k">Answered in 5 min</span>
                  <span className="v">{pct}%</span>
                </div>
                <div className="stat tone-sky">
                  <span className="k">Qualified</span>
                  <span className="v">
                    {d.qualified}
                    <small> of {d.enquiries}</small>
                  </span>
                </div>
                <div className="stat tone-lavender">
                  <span className="k">After hours</span>
                  <span className="v">
                    {d.afterHours}
                    <small> calls</small>
                  </span>
                </div>
                <div className="stat tone-butter">
                  <span className="k">Pipeline at stake</span>
                  <span className="v">
                    ₹{d.pipeline.low}–{d.pipeline.high}
                    <small> L</small>
                  </span>
                </div>
                <div className="stat tone-blush">
                  <span className="k">Cost to run</span>
                  <span className="v">{inr(d.cost.total)}</span>
                </div>
              </div>
            </section>

            <Explorer
              calls={d.calls.map(toView)}
              n={d.n}
              afterHours={d.afterHours}
              priceAsked={d.priceAsked}
              funnel={d.funnel}
              notForwarded={d.notForwarded}
            />

            <section id="cost" className="card cost">
              <div>
                <h2 className="h2">What it cost</h2>
                <p>
                  {inr(d.cost.total)} in this period: {d.cost.perCall !== null ? inr(d.cost.perCall, 1) : "—"} per call and{" "}
                  {d.cost.perQualified !== null ? inr(d.cost.perQualified) : "—"} per qualified lead.
                  {paidFixed.length === 0 && " No fixed platform costs have been entered yet."}
                </p>
              </div>
              <div className="lines">
                <div className="line">
                  <span>
                    Voice · Vaani Labs <small>{Math.round(d.cost.minutes)} min × {inr(d.cost.voiceRate, 1)}</small>
                  </span>
                  <span>{inr(d.cost.voice)}</span>
                </div>
                <div className="line">
                  <span>
                    Classification · Gemini Flash <small>{d.n} calls</small>
                  </span>
                  <span>{inr(d.cost.ai, 2)}</span>
                </div>
                {paidFixed.map((r) => (
                  <div className="line" key={r.item}>
                    <span>
                      {r.item}
                      {d.cost.months > 1 && <small> {d.cost.months} months</small>}
                    </span>
                    <span>{inr(r.amount)}</span>
                  </div>
                ))}
                <div className="line total">
                  <span className="lbl">Total</span>
                  <span className="amt">{inr(d.cost.total)}</span>
                </div>
                {freeFixed.length > 0 && (
                  <div className="free">Entered as ₹0: {freeFixed.map((r) => r.item.replace(/ \(.*\)$/, "")).join(", ")}.</div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
