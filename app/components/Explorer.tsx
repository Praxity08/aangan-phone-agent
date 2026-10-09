"use client";

import { useState } from "react";

export type OutcomeKey = "qualified" | "nurture" | "escalated" | "declined" | "message" | "unclassified";

export interface CallView {
  id: string;
  shortId: string;
  outcome: OutcomeKey;
  date: string;
  time: string;
  when: string;
  hour: number;
  after: boolean;
  caller: string | null;
  location: string | null;
  summary: string | null;
  uncertain: string | null;
  flags: string[];
  details: { k: string; v: string }[];
  transcript: string | null;
  attention: "escalated" | "missed" | null;
}

export const OUTCOME_LABEL: Record<OutcomeKey, string> = {
  qualified: "Qualified",
  nurture: "Later start",
  escalated: "Escalated",
  declined: "Declined",
  message: "Not an enquiry",
  unclassified: "Not classified",
};
const ORDER: OutcomeKey[] = ["qualified", "nurture", "escalated", "declined", "message", "unclassified"];
const SKY = ["#dbe7f2", "#bcd3e8", "#94b6d6", "#6f95bd"];
const hourLabel = (h: number) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`);

interface Props {
  calls: CallView[];
  n: number;
  afterHours: number;
  priceAsked: number;
  funnel: { label: string; value: number }[];
  notForwarded: { label: string; value: number }[];
}

/** Sections 3–6 of the dashboard: they share the outcome filter and the selected call. */
export function Explorer({ calls, n, afterHours, priceAsked, funnel, notForwarded }: Props) {
  const [filter, setFilter] = useState<OutcomeKey | "all">("all");
  const [selId, setSelId] = useState<string | null>(null);

  const count = (k: OutcomeKey) => calls.filter((c) => c.outcome === k).length;
  const listed = calls.filter((c) => filter === "all" || c.outcome === filter);
  const sel = listed.find((c) => c.id === selId) ?? listed[0] ?? null;
  const attention = calls.filter((c) => c.attention);
  const mix = ORDER.map((k) => ({ k, count: count(k) })).filter((x) => x.count);

  const goCalls = () => document.getElementById("calls")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const showOutcome = (k: OutcomeKey) => {
    setFilter(k);
    setSelId(null);
    goCalls();
  };
  const openCall = (id: string) => {
    setFilter("all");
    setSelId(id);
    goCalls();
  };

  return (
    <>
      {attention.length > 0 && (
        <section id="attention" className="card attention">
          <div className="title-row">
            <h2 className="h2">Needs a person</h2>
            <span className="count-pill">{attention.length} open</span>
          </div>
          <div className="att-grid">
            {attention.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`att-card ${c.attention === "escalated" ? "tone-lavender" : "tone-butter"}`}
                onClick={() => openCall(c.id)}
              >
                <div className="top">
                  <span className="reason">{c.attention === "escalated" ? "Existing client · urgent" : "Missed earlier enquiry"}</span>
                  <span className="when">{c.when}</span>
                </div>
                <div className="who">
                  {c.caller ?? "Unknown caller"}
                  <span> · {c.location ?? "—"}</span>
                </div>
                <p className="sum">{c.summary}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <section id="outcomes" className="pair">
        <div className="card">
          <div>
            <h2 className="h2">Where the calls went</h2>
            <p className="sub">{priceAsked} asked for a price and were gently deflected.</p>
          </div>
          <div className="funnel">
            {funnel.map((f, i) => (
              <div className="funnel-row" key={f.label}>
                <div className="top">
                  <span className="lbl">{f.label}</span>
                  <span className="num">
                    {f.value}
                    {i > 0 && n > 0 && <span> · {Math.round((f.value / n) * 100)}%</span>}
                  </span>
                </div>
                <div className="track">
                  <div style={{ width: `${(f.value / Math.max(1, n)) * 100}%`, background: SKY[i] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div>
            <h2 className="h2">Outcome mix</h2>
            <p className="sub">Tap a colour to see those calls.</p>
          </div>
          <div className="mix">
            {mix.map((x) => (
              <button
                key={x.k}
                type="button"
                className={`out-${x.k}`}
                style={{ flexGrow: x.count }}
                title={`${OUTCOME_LABEL[x.k]}: ${x.count}`}
                aria-label={`Show ${OUTCOME_LABEL[x.k].toLowerCase()} calls (${x.count})`}
                onClick={() => showOutcome(x.k)}
              />
            ))}
          </div>
          <div className="legend">
            {mix.map((x) => (
              <span key={x.k} className={`item out-${x.k}`}>
                <span className="sw" />
                {OUTCOME_LABEL[x.k]}
                <span className="n">{x.count}</span>
              </span>
            ))}
          </div>
          {notForwarded.length > 0 && (
            <div className="closed">
              <span>Closed on the call, not sent to a designer</span>
              <div className="pills">
                {notForwarded.map((r) => (
                  <span key={r.label} className="reason-pill">
                    {r.label} · {r.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="rhythm" className="card rhythm">
        <div className="rhythm-head">
          <div>
            <h2 className="h2">The day&apos;s rhythm</h2>
            <p className="sub">
              Each dot is a call. {afterHours} of {n} came while the front desk was closed.
            </p>
          </div>
          <div className="key">
            <span className="k" style={{ background: "#eef4ea", color: "#3f5a3b" }}>
              <i style={{ background: "#7fa476" }} />
              Desk open
            </span>
            <span className="k" style={{ background: "#ebe5f6", color: "#56487d" }}>
              <i style={{ background: "#9886c6" }} />
              After hours
            </span>
          </div>
        </div>
        <div>
          <div className="hours">
            <div className="band" />
            {Array.from({ length: 24 }, (_, h) => {
              const v = calls.filter((c) => c.hour === h).length;
              const open = h >= 10 && h < 19;
              return (
                <div
                  key={h}
                  className="col"
                  style={{ gridColumn: String(h + 1) }}
                  title={`${hourLabel(h)}–${hourLabel((h + 1) % 24)}: ${v} ${v === 1 ? "call" : "calls"}`}
                >
                  {Array.from({ length: v }, (_, i) => (
                    <i key={i} style={{ background: open ? "#7fa476" : "#9886c6" }} />
                  ))}
                </div>
              );
            })}
          </div>
          <div className="axis">
            {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
              <span key={h}>{hourLabel(h)}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="calls" className="calls">
        <div className="calls-head">
          <h2 className="h2">Every call</h2>
          <div className="pills">
            <button type="button" className="chip" aria-pressed={filter === "all"} onClick={() => { setFilter("all"); setSelId(null); }}>
              All<span className="count">{calls.length}</span>
            </button>
            {mix.map((x) => (
              <button
                key={x.k}
                type="button"
                className="chip"
                aria-pressed={filter === x.k}
                onClick={() => { setFilter(x.k); setSelId(null); }}
              >
                {OUTCOME_LABEL[x.k]}
                <span className="count">{x.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="calls-grid">
          <div className="call-list">
            {listed.map((c) => (
              <button
                key={c.id}
                type="button"
                className="call-row"
                aria-current={sel?.id === c.id}
                onClick={() => setSelId(c.id)}
              >
                <div className="d">
                  <b>{c.date}</b>
                  <small className={c.after ? "after" : undefined}>{c.time}</small>
                </div>
                <div className="who">
                  <b>{c.caller ?? "Name not given"}</b>
                  <small>{c.location ?? "Area not given"}</small>
                </div>
                <span className={`out-pill out-${c.outcome}`}>{OUTCOME_LABEL[c.outcome]}</span>
              </button>
            ))}
          </div>

          {sel && (
            <article key={sel.id} className={`brief out-${sel.outcome}`} aria-live="polite">
              <div className="brief-head">
                <div className="meta">
                  <span>Designer brief · {sel.shortId}</span>
                  <span>{sel.when}</span>
                </div>
                <div className="name">{sel.caller ?? "Name not given"}</div>
                <div className="tags">
                  <span className="solid">{OUTCOME_LABEL[sel.outcome]}</span>
                  <span>{sel.location ?? "Area not given"}</span>
                  {sel.flags.map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                </div>
              </div>
              <div className="brief-body">
                <p className="summary">{sel.summary}</p>
                {sel.details.length > 0 && (
                  <div className="tiles">
                    {sel.details.map((d) => (
                      <div className="tile" key={d.k}>
                        <div className="k">{d.k}</div>
                        <div className="v">{d.v}</div>
                      </div>
                    ))}
                  </div>
                )}
                {sel.uncertain && (
                  <div className="unclear">
                    <b>Unclear · </b>
                    {sel.uncertain}
                  </div>
                )}
                {sel.transcript && (
                  <details>
                    <summary>Transcript</summary>
                    <pre>{sel.transcript}</pre>
                  </details>
                )}
              </div>
            </article>
          )}
        </div>
      </section>
    </>
  );
}
