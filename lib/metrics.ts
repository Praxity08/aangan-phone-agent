import { config } from "./config";
import { sql } from "./db";

export type Source = "demo" | "live" | "replay";
export type Period = "all" | "7d" | "30d" | "month";

export const PERIODS: { id: Period; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "month", label: "This month" },
  { id: "30d", label: "Last 30 days" },
  { id: "7d", label: "Last 7 days" },
];

export const SOURCES: { id: Source; label: string }[] = [
  { id: "live", label: "Live calls" },
  { id: "demo", label: "Demo · September" },
  { id: "replay", label: "Test replays" },
];

function since(period: Period): Date | null {
  const now = new Date();
  if (period === "7d") return new Date(now.getTime() - 7 * 864e5);
  if (period === "30d") return new Date(now.getTime() - 30 * 864e5);
  if (period === "month") {
    const ist = new Date(now.toLocaleString("en-US", { timeZone: config.timeZone }));
    return new Date(`${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-01T00:00:00+05:30`);
  }
  return null;
}

export interface CallRow {
  call_id: string;
  started_at: string;
  phone: string | null;
  name: string | null;
  location: string | null;
  property: string | null;
  call_type: string;
  outcome: string;
  decline_reason: string | null;
  flags: string[];
  summary: string | null;
  uncertain: string | null;
  booked: boolean;
  consultation_at: string | null;
  after_hours: boolean;
  duration_seconds: number | null;
  telegram_sent: boolean;
  hubspot_deal_id: string | null;
  asked_about_price: boolean;
  transcript: string | null;
}

export async function sourceCounts() {
  const rows = (await sql()`SELECT source, count(*)::int AS n FROM calls GROUP BY source`) as { source: Source; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.source, r.n])) as Partial<Record<Source, number>>;
}

export async function loadDashboard(source: Source, period: Period) {
  const db = sql();
  const from = since(period);
  const fromIso = from ? from.toISOString() : "1970-01-01T00:00:00Z";

  const rows = (await db`
    SELECT call_id, started_at, phone, name, location, property, call_type, outcome, decline_reason, flags,
           summary, uncertain, booked, consultation_at, after_hours, duration_seconds, telegram_sent,
           hubspot_deal_id, asked_about_price, transcript, answer_seconds, voice_cost_inr, ai_cost_inr
    FROM calls
    WHERE source = ${source} AND started_at >= ${fromIso}
    ORDER BY started_at DESC`) as (CallRow & { answer_seconds: number | null; voice_cost_inr: string; ai_cost_inr: string })[];
  // The driver returns timestamptz as Date; the page (and client components) want ISO strings.
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  const calls = rows.map((c) => ({ ...c, started_at: iso(c.started_at)!, consultation_at: iso(c.consultation_at) }));

  const n = calls.length;
  const answered = calls.filter((c) => c.answer_seconds !== null);
  const within5 = answered.filter((c) => (c.answer_seconds ?? 0) <= 300).length;
  const answerTimes = answered.map((c) => c.answer_seconds!).sort((a, b) => a - b);
  const medianAnswer = answerTimes.length ? answerTimes[Math.floor(answerTimes.length / 2)] : null;

  const count = (pred: (c: (typeof calls)[number]) => boolean) => calls.filter(pred).length;
  const enquiries = count((c) => c.call_type === "new_enquiry" || c.call_type === "follow_up");
  const qualified = count((c) => c.outcome === "qualified");
  const booked = count((c) => c.outcome === "qualified" && c.booked);
  const afterHours = count((c) => c.after_hours);
  const priceAsked = count((c) => c.asked_about_price);
  const handedOff = count((c) => c.outcome === "qualified" && c.telegram_sent);

  const reasonLabels: Record<string, string> = {
    out_of_scope: "Out of scope",
    out_of_area: "Outside Pune / PCMC",
    advice_only: "Advice only, no execution",
    budget: "Budget clearly too low",
    timeline: "Timeline too short",
  };
  const notForwarded = [
    ...Object.entries(reasonLabels).map(([k, label]) => ({
      label,
      value: count((c) => c.outcome === "declined" && c.decline_reason === k),
    })),
    { label: "Later start (nurture)", value: count((c) => c.outcome === "nurture") },
    { label: "Existing client, escalated", value: count((c) => c.outcome === "escalated") },
    { label: "Not an enquiry", value: count((c) => c.outcome === "message") },
    { label: "Not classified", value: count((c) => c.outcome === "unclassified") },
  ]
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const byHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    value: calls.filter((c) => {
      const hh = Number(
        new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: config.timeZone }).format(new Date(c.started_at)),
      ) % 24;
      return hh === h;
    }).length,
  }));

  // Costs: per-call variable costs, plus fixed monthly costs for every month the period touches.
  const minutes = calls.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / 60;
  const voice = calls.reduce((s, c) => s + Number(c.voice_cost_inr), 0);
  const ai = calls.reduce((s, c) => s + Number(c.ai_cost_inr), 0);
  const istMonth = (d: string) => new Date(d).toLocaleDateString("en-CA", { timeZone: config.timeZone }).slice(0, 7) + "-01";
  const months = [...new Set(calls.map((c) => istMonth(c.started_at)))];
  if (period === "month" && !months.length && from) months.push(new Date(from.getTime() + 864e5).toISOString().slice(0, 7) + "-01");
  const fixedRows = months.length
    ? ((await db`SELECT item, sum(amount_inr)::float AS amount, max(note) AS note, count(*)::int AS months
                 FROM fixed_costs WHERE month = ANY(${months}::date[]) GROUP BY item ORDER BY sum(amount_inr) DESC, item`) as {
        item: string;
        amount: number;
        note: string | null;
        months: number;
      }[])
    : [];
  const fixed = fixedRows.reduce((s, r) => s + r.amount, 0);
  const total = voice + ai + fixed;

  return {
    n,
    answered: answered.length,
    within5,
    medianAnswer,
    afterHours,
    enquiries,
    qualified,
    booked,
    handedOff,
    priceAsked,
    funnel: [
      { label: "Calls answered", value: answered.length },
      { label: "Enquiries", value: enquiries },
      { label: "Qualified", value: qualified },
      { label: "Consultation booked", value: booked },
    ],
    notForwarded,
    byHour,
    cost: {
      minutes,
      voice,
      ai,
      fixedRows,
      fixed,
      total,
      perCall: n ? total / n : null,
      perQualified: qualified ? total / qualified : null,
      months: months.length,
      voiceRate: config.voiceInrPerMin,
    },
    pipeline: { low: booked * config.projectValueLakh.low, high: booked * config.projectValueLakh.high },
    attention: calls.filter(
      (c) => c.outcome === "escalated" || c.outcome === "unclassified" || c.flags.includes("previous enquiry missed"),
    ),
    calls,
  };
}

export type Dashboard = Awaited<ReturnType<typeof loadDashboard>>;
