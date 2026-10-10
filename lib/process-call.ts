import { classifyCall } from "./classify";
import { config, isAfterHours } from "./config";
import { sql } from "./db";
import { createDeal } from "./integrations/hubspot";
import { sendDesignerBrief, sendEscalation } from "./integrations/telegram";
import type { CallRecord, IncomingCall } from "./types";

type Source = "live" | "replay";

/**
 * Step 1, inside the webhook request: store the call straight away (outcome "pending") so it is never lost
 * and Vaani gets its answer in milliseconds, whatever Gemini is doing.
 */
export async function storeCall(call: IncomingCall, source: Source) {
  const voiceCost = call.voice_cost_inr ?? (call.duration_seconds / 60) * config.voiceInrPerMin;
  const rows = await sql()`
    INSERT INTO calls (
      call_id, source, phone, started_at, answer_seconds, duration_seconds, after_hours,
      call_type, outcome, summary, transcript, voice_cost_inr
    ) VALUES (
      ${call.call_id}, ${source}, ${call.phone}, ${call.started_at.toISOString()}, ${call.answer_seconds},
      ${call.duration_seconds}, ${isAfterHours(call.started_at)},
      'other', 'pending', 'Classifying…', ${call.transcript}, ${voiceCost.toFixed(2)}
    )
    ON CONFLICT (call_id) DO NOTHING
    RETURNING id`;
  return { stored: rows.length > 0 };
}

/**
 * Step 2, after the response: classify the stored call, save the record, then hand off.
 * Every step is best-effort: a Gemini, Telegram or HubSpot failure never loses the call.
 */
export async function classifyAndHandOff(callId: string) {
  const db = sql();
  const [row] = (await db`SELECT source, phone, started_at, transcript FROM calls WHERE call_id = ${callId}`) as {
    source: Source;
    phone: string | null;
    started_at: string;
    transcript: string;
  }[];
  if (!row) return;
  if (!row.transcript?.trim()) {
    await db`UPDATE calls SET outcome = 'unclassified', summary = 'No transcript arrived with this call.',
      uncertain = 'Vaani sent the call without a transcript. Check that the webhook includes it.' WHERE call_id = ${callId}`;
    return;
  }

  let record: CallRecord;
  try {
    const c = await classifyCall(row.transcript, new Date(row.started_at));
    record = c.record;
    const bookedFor = record.consultation.booked_for ? new Date(record.consultation.booked_for) : null;
    await db`
      UPDATE calls SET
        call_type = ${record.call_type}, outcome = ${record.outcome}, decline_reason = ${record.decline_reason},
        name = ${record.name}, referral = ${record.referral}, property = ${record.property}, location = ${record.location},
        carpet_area_sqft = ${record.carpet_area_sqft}, scope = ${record.scope}, current_state = ${record.current_state},
        complete_by = ${record.complete_by}, decision_maker = ${record.decision_maker}, rented = ${record.rented},
        budget_volunteered = ${record.budget_volunteered}, asked_about_price = ${record.asked_about_price},
        flags = ${record.flags}, uncertain = ${record.uncertain}, consultation_type = ${record.consultation.type},
        consultation_at = ${bookedFor && !isNaN(bookedFor.getTime()) ? bookedFor.toISOString() : null},
        booked = ${Boolean(record.consultation.booked_for)}, summary = ${record.summary},
        ai_cost_inr = ${c.costInr.toFixed(4)}, ai_tokens = ${c.inputTokens + c.outputTokens}
      WHERE call_id = ${callId}`;
  } catch (err) {
    await db`
      UPDATE calls SET outcome = 'unclassified', summary = 'Not classified yet. Read the transcript.',
        uncertain = ${`Classifier failed: ${(err as Error).message.slice(0, 300)}`}
      WHERE call_id = ${callId}`;
    return;
  }

  // Replays are tests: classify and log them, but never message designers or create deals.
  if (row.source === "replay") return;

  if (record.outcome === "qualified") {
    try {
      const sent = await sendDesignerBrief(record, row.phone);
      if ("sent" in sent) await db`UPDATE calls SET telegram_sent = true WHERE call_id = ${callId}`;
    } catch (err) {
      console.error("telegram brief failed", callId, (err as Error).message);
    }
    try {
      const deal = await createDeal(record, row.phone);
      if ("dealId" in deal) await db`UPDATE calls SET hubspot_deal_id = ${deal.dealId} WHERE call_id = ${callId}`;
    } catch (err) {
      console.error("hubspot deal failed", callId, (err as Error).message);
    }
  } else if (record.outcome === "escalated") {
    try {
      const sent = await sendEscalation(record, row.phone);
      if ("sent" in sent) await db`UPDATE calls SET telegram_sent = true WHERE call_id = ${callId}`;
    } catch (err) {
      console.error("telegram escalation failed", callId, (err as Error).message);
    }
  }
}
