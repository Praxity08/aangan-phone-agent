// Loads the 20 September phone calls as demo data: what the month looks like with the agent answering.
// Safe to re-run (upserts). Usage: npm run seed
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const calls = JSON.parse(readFileSync(new URL("../data/september-phone-calls.json", import.meta.url)));
const records = JSON.parse(readFileSync(new URL("../data/september-records.json", import.meta.url)));

const voiceRate = Number(process.env.VOICE_INR_PER_MIN || 5.5);
const usdToInr = Number(process.env.USD_TO_INR || 88);
const inRate = Number(process.env.GEMINI_INPUT_USD_PER_M || 0.3);
const outRate = Number(process.env.GEMINI_OUTPUT_USD_PER_M || 2.5);
// Typical classification: ~4,500 prompt tokens (rule files + transcript), ~350 output tokens.
const aiTokens = { input: 4500, output: 350 };
const aiCost = ((aiTokens.input * inRate + aiTokens.output * outRate) / 1e6) * usdToInr;

const durations = { T08: 60, T17: 72 + 270 }; // T08: missed, length unknown; T17: dropped call + call back

const istHour = (d) => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(d)) % 24;

for (const c of calls) {
  const r = records[c.id];
  const started = new Date(c.started_at);
  const duration = c.duration_seconds ?? durations[c.id];
  const h = istHour(started);
  await sql`
    INSERT INTO calls (
      call_id, source, phone, started_at, answer_seconds, duration_seconds, after_hours,
      call_type, outcome, decline_reason, name, referral, property, location, carpet_area_sqft,
      scope, current_state, complete_by, decision_maker, rented, budget_volunteered,
      asked_about_price, flags, uncertain, consultation_type, consultation_at, booked,
      summary, transcript, voice_cost_inr, ai_cost_inr, ai_tokens, telegram_sent
    ) VALUES (
      ${"demo-" + c.id}, 'demo', null, ${started.toISOString()}, 3, ${duration}, ${h < 10 || h >= 19},
      ${r.call_type}, ${r.outcome}, ${r.decline_reason}, ${r.name}, ${r.referral}, ${r.property}, ${r.location},
      ${r.carpet_area_sqft}, ${r.scope}, ${r.current_state}, ${r.complete_by}, ${r.decision_maker}, ${r.rented},
      ${r.budget_volunteered}, ${r.asked_about_price}, ${r.flags}, ${r.uncertain}, ${r.consultation.type},
      ${r.consultation.booked_for}, ${Boolean(r.consultation.booked_for)}, ${r.summary}, ${c.transcript},
      ${((duration / 60) * voiceRate).toFixed(2)}, ${aiCost.toFixed(4)}, ${aiTokens.input + aiTokens.output},
      ${r.outcome === "qualified" || r.outcome === "escalated"}
    )
    ON CONFLICT (call_id) DO UPDATE SET
      outcome = EXCLUDED.outcome, decline_reason = EXCLUDED.decline_reason, flags = EXCLUDED.flags,
      summary = EXCLUDED.summary, voice_cost_inr = EXCLUDED.voice_cost_inr, ai_cost_inr = EXCLUDED.ai_cost_inr,
      booked = EXCLUDED.booked, consultation_at = EXCLUDED.consultation_at, after_hours = EXCLUDED.after_hours`;
}

// Fixed monthly costs. Free tiers are listed at ₹0 so the dashboard shows the whole stack.
const fixed = [
  ["Vaani Labs platform fee", 0, "Not quoted yet. Enter the monthly fee from the Vaani contract."],
  ["Vercel Pro (dashboard + API)", 20 * usdToInr, "$20/month. The free Hobby plan is for non-commercial use only."],
  ["Neon Postgres (call log)", 0, "Free plan"],
  ["HubSpot CRM", 0, "Free CRM"],
  ["Cal.com", 0, "Free plan"],
  ["Telegram bot", 0, "Free"],
];
for (const month of ["2026-09-01", "2026-10-01"]) {
  for (const [item, amount, note] of fixed) {
    await sql`INSERT INTO fixed_costs (month, item, amount_inr, note) VALUES (${month}, ${item}, ${amount}, ${note})
              ON CONFLICT (month, item) DO UPDATE SET amount_inr = EXCLUDED.amount_inr, note = EXCLUDED.note`;
  }
}

console.log(`Seeded ${calls.length} demo calls and ${fixed.length} fixed-cost lines for Sep and Oct 2026.`);
