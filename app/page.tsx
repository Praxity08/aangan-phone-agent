import { HBars } from "./components/HBars";
import { HourChart } from "./components/HourChart";
import { loadDashboard, PERIODS, SOURCES, sourceCounts, type CallRow, type Period, type Source } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const inr = (v: number, digits = 0) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const OUTCOME: Record<string, { label: string; color: string }> = {
  qualified: { label: "Qualified", color: "var(--good)" },
  declined: { label: "Declined", color: "var(--text-muted)" },
  nurture: { label: "Later start", color: "var(--warning)" },
  escalated: { label: "Escalated", color: "var(--critical)" },
  message: { label: "Not an enquiry", color: "var(--text-muted)" },
  unclassified: { label: "Not classified", color: "var(--warning)" },
};

function Outcome({ c }: { c: CallRow }) {
  const o = OUTCOME[c.outcome] ?? OUTCOME.unclassified;
  return (
    <span className="pill">
      <span className="dot" style={{ background: o.color }} aria-hidden />
      {o.label}
    </span>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!process.env.DATABASE_URL) {
    return (
      <main>
        <h1>Aangan phone agent</h1>
        <p className="note">DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.</p>
      </main>
    );
  }

  const params = await searchParams;
  const counts = await sourceCounts();
  const source = (SOURCES.some((s) => s.id === params.source) ? params.source : counts.live ? "live" : "demo") as Source;
  const period = (PERIODS.some((p) => p.id === params.period) ? params.period : "all") as Period;
  const d = await loadDashboard(source, period);
  const href = (s: Source, p: Period) => `/?source=${s}&period=${p}`;
  const pctWithin = d.answered ? Math.round((d.within5 / d.n) * 100) : 0;

  return (
    <main>
      <h1>Aangan phone agent</h1>
      <p className="sub">Every call to the studio number: what it was, where it went, and what it cost.</p>

      <nav className="filters" aria-label="Filters">
        <div className="seg" role="group" aria-label="Data">
          {SOURCES.map((s) => (
            <a key={s.id} href={href(s.id, period)} aria-current={s.id === source}>
              {s.label}
              <span className="count">{counts[s.id] ?? 0}</span>
            </a>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <a key={p.id} href={href(source, p.id)} aria-current={p.id === period}>
              {p.label}
            </a>
          ))}
        </div>
      </nav>

      {source === "demo" && (
        <p className="note">
          Demo: the 20 phone calls from September 2026, classified by hand against Nikhil&apos;s rubric, shown as if the agent
          had answered them. Voice cost uses {inr(d.cost.voiceRate, 1)}/min, a market benchmark, not a Vaani Labs quote.
        </p>
      )}
      {source === "replay" && (
        <p className="note">Test replays: September transcripts sent through the live pipeline. No designer was messaged and no deal was created.</p>
      )}

      {d.n === 0 ? (
        <p className="note">No calls in this period.</p>
      ) : (
        <>
          <div className="grid hero-row">
            <div className="card">
              <h2>Answered within 5 minutes</h2>
              <div className="hero-value">{pctWithin}%</div>
              <div className="hero-label">
                {d.within5} of {d.n} calls{d.medianAnswer !== null ? ` · median ${d.medianAnswer} s to answer` : ""} · {d.afterHours} outside 10am–7pm
              </div>
              <div className="before">Before the agent: ~48% of enquiries got no response within 48 hours.</div>
            </div>
            <div className="card">
              <div className="tiles">
                <div className="tile">
                  <div className="tile-label">Qualified for a designer</div>
                  <div className="tile-value">{d.qualified}</div>
                  <div className="tile-foot">of {d.enquiries} enquiries</div>
                </div>
                <div className="tile">
                  <div className="tile-label">Consultations booked</div>
                  <div className="tile-value">{d.booked}</div>
                  <div className="tile-foot">on the call</div>
                </div>
                <div className="tile">
                  <div className="tile-label">Pipeline at stake</div>
                  <div className="tile-value">₹{d.pipeline.low}–{d.pipeline.high} L</div>
                  <div className="tile-foot">bookings × ₹8–14 L average</div>
                </div>
                <div className="tile">
                  <div className="tile-label">Cost to run</div>
                  <div className="tile-value">{inr(d.cost.total)}</div>
                  <div className="tile-foot">{d.cost.perQualified !== null ? `${inr(d.cost.perQualified)} per qualified lead` : "no qualified leads"}</div>
                </div>
              </div>
            </div>
          </div>

          <section className="grid two">
            <div className="card">
              <h2>Where the calls went</h2>
              <p className="sub" style={{ marginBottom: 12 }}>
                {d.booked} of {d.n} calls ended with a consultation booked. {d.priceAsked} asked for a price and were deflected.
              </p>
              <HBars data={d.funnel} ramp={["var(--ramp-4)", "var(--ramp-3)", "var(--ramp-2)", "var(--ramp-1)"]} shareOf={d.funnel[0].value} />
            </div>
            <div className="card">
              <h2>Not sent to a designer</h2>
              <p className="sub" style={{ marginBottom: 12 }}>Closed on the call, with the reason, so no designer time is spent.</p>
              <HBars data={d.notForwarded} />
            </div>
          </section>

          <section className="card">
            <h2>Calls by hour of day</h2>
            <p className="sub">
              {d.afterHours} of {d.n} calls came outside front desk hours. The agent answers all of them.
            </p>
            <HourChart data={d.byHour} />
          </section>

          {d.attention.length > 0 && (
            <section className="card">
              <h2>Needs a person</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>When</th><th>Caller</th><th>Status</th><th>What happened</th></tr>
                  </thead>
                  <tbody>
                    {d.attention.map((c) => (
                      <tr key={c.call_id}>
                        <td style={{ whiteSpace: "nowrap" }}>{when(c.started_at)}</td>
                        <td>{c.name ?? c.phone ?? "Unknown"}</td>
                        <td><Outcome c={c} /></td>
                        <td>{c.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="card">
            <h2>What it cost</h2>
            <p className="sub" style={{ marginBottom: 8 }}>
              {inr(d.cost.total)} in this period: {d.cost.perCall !== null ? `${inr(d.cost.perCall, 1)} per call` : ""}
              {d.cost.perQualified !== null ? `, ${inr(d.cost.perQualified)} per qualified lead` : ""}. Fixed costs cover {d.cost.months}{" "}
              {d.cost.months === 1 ? "month" : "months"}.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Item</th><th>Basis</th><th className="num">Cost</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Voice (Vaani Labs)</td>
                    <td className="muted">{Math.round(d.cost.minutes)} min × {inr(d.cost.voiceRate, 1)}/min</td>
                    <td className="num">{inr(d.cost.voice)}</td>
                  </tr>
                  <tr>
                    <td>Call classification (Gemini Flash)</td>
                    <td className="muted">{d.n} calls, logged per call</td>
                    <td className="num">{inr(d.cost.ai, 2)}</td>
                  </tr>
                  {d.cost.fixedRows.map((r) => (
                    <tr key={r.item}>
                      <td>{r.item}</td>
                      <td className="muted">{r.note}</td>
                      <td className="num">{inr(r.amount)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Total</td>
                    <td />
                    <td className="num">{inr(d.cost.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2>Every call</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>When</th><th>Caller</th><th>Where</th><th>Outcome</th><th>Summary</th><th>Handoff</th></tr>
                </thead>
                <tbody>
                  {d.calls.map((c) => (
                    <tr key={c.call_id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {when(c.started_at)}
                        {c.after_hours && <div className="muted" style={{ fontSize: 12 }}>after hours</div>}
                      </td>
                      <td>{c.name ?? <span className="muted">Not given</span>}</td>
                      <td>{c.location ?? <span className="muted">—</span>}</td>
                      <td><Outcome c={c} /></td>
                      <td style={{ minWidth: 280 }}>
                        {c.flags.map((f) => <span key={f} className="flag">{f}</span>)}
                        <div>{c.summary}</div>
                        {c.uncertain && <div className="muted" style={{ fontSize: 12 }}>Unclear: {c.uncertain}</div>}
                        {c.transcript && (
                          <details>
                            <summary>Transcript</summary>
                            <pre>{c.transcript}</pre>
                          </details>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                        {c.outcome === "qualified" || c.outcome === "escalated" ? (
                          <>
                            <div>{c.telegram_sent ? "Telegram sent" : <span className="muted">Telegram not sent</span>}</div>
                            {c.outcome === "qualified" && (
                              <div>{c.hubspot_deal_id ? `HubSpot deal ${c.hubspot_deal_id}` : <span className="muted">No HubSpot deal</span>}</div>
                            )}
                            {c.consultation_at && <div>Consult {when(c.consultation_at)}</div>}
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
