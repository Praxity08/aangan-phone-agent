import { classifyCall } from "./classify";
import { config, isAfterHours } from "./config";
import { sql } from "./db";
import { createDeal } from "./integrations/hubspot";
import { sendDesignerBrief, sendEscalation } from "./integrations/telegram";
import type { CallRecord, IncomingCall } from "./types";

const unclassified = (reason: string): CallRecord => ({
  call_type: "other",
  outcome: "unclassified",
  decline_reason: null,
  name: null,
  referral: null,
  property: null,
  location: null,
  carpet_area_sqft: null,
  scope: null,
  current_state: null,
  complete_by: null,
  decision_maker: null,
  rented: null,
  budget_volunteered: null,
  asked_about_price: false,
  flags: [],
  uncertain: reason,
  consultation: { type: null, booked_for: null },
  summary: "Not classified yet. Read the transcript.",
});

/**
 * One finished call → classify → store → hand off.
 * Every step after storing is best-effort: a Telegram or HubSpot failure never loses the call.
 */
export async function processCall(call: IncomingCall, source: "live" | "replay" = "live") {
  const db = sql();
  const existing = await db`SELECT id FROM calls WHERE call_id = ${call.call_id}`;
  if (existing.length) return { duplicate: true };

  let record: CallRecord;
  let aiCost = 0;
  let aiTokens = 0;
  try {
    const c = await classifyCall(call.transcript, call.started_at);
    record = c.record;
    aiCost = c.costInr;
    aiTokens = c.inputTokens + c.outputTokens;
  } catch (err) {
    record = unclassified(`Classifier failed: ${(err as Error).message.slice(0, 200)}`);
  }

  const voiceCost = call.voice_cost_inr ?? (call.duration_seconds / 60) * config.voiceInrPerMin;
  const bookedFor = record.consultation.booked_for ? new Date(record.consultation.booked_for) : null;

  await db`
    INSERT INTO calls (
      call_id, source, phone, started_at, answer_seconds, duration_seconds, after_hours,
      call_type, outcome, decline_reason, name, referral, property, location, carpet_area_sqft,
      scope, current_state, complete_by, decision_maker, rented, budget_volunteered,
      asked_about_price, flags, uncertain, consultation_type, consultation_at, booked,
      summary, transcript, voice_cost_inr, ai_cost_inr, ai_tokens
    ) VALUES (
      ${call.call_id}, ${source}, ${call.phone}, ${call.started_at.toISOString()}, ${call.answer_seconds},
      ${call.duration_seconds}, ${isAfterHours(call.started_at)},
      ${record.call_type}, ${record.outcome}, ${record.decline_reason}, ${record.name}, ${record.referral},
      ${record.property}, ${record.location}, ${record.carpet_area_sqft}, ${record.scope}, ${record.current_state},
      ${record.complete_by}, ${record.decision_maker}, ${record.rented}, ${record.budget_volunteered},
      ${record.asked_about_price}, ${record.flags}, ${record.uncertain}, ${record.consultation.type},
      ${bookedFor && !isNaN(bookedFor.getTime()) ? bookedFor.toISOString() : null},
      ${Boolean(record.consultation.booked_for)}, ${record.summary}, ${call.transcript},
      ${voiceCost.toFixed(2)}, ${aiCost.toFixed(4)}, ${aiTokens}
    )`;

  const handoff: Record<string, unknown> = {};
  // Replays are tests: classify and log them, but never message designers or create deals.
  if (source === "replay") return { outcome: record.outcome, handoff: { skipped: "replay" } };

  if (record.outcome === "qualified") {
    try {
      const sent = await sendDesignerBrief(record, call.phone);
      handoff.telegram = sent;
      if ("sent" in sent) await db`UPDATE calls SET telegram_sent = true WHERE call_id = ${call.call_id}`;
    } catch (err) {
      handoff.telegram = { error: (err as Error).message };
    }
    try {
      const deal = await createDeal(record, call.phone);
      handoff.hubspot = deal;
      if ("dealId" in deal) await db`UPDATE calls SET hubspot_deal_id = ${deal.dealId} WHERE call_id = ${call.call_id}`;
    } catch (err) {
      handoff.hubspot = { error: (err as Error).message };
    }
  } else if (record.outcome === "escalated") {
    try {
      const sent = await sendEscalation(record, call.phone);
      handoff.telegram = sent;
      if ("sent" in sent) await db`UPDATE calls SET telegram_sent = true WHERE call_id = ${call.call_id}`;
    } catch (err) {
      handoff.telegram = { error: (err as Error).message };
    }
  }

  return { outcome: record.outcome, handoff };
}
