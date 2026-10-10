import type { IncomingCall } from "./types";

/**
 * Turns the voice platform's post-call webhook into an IncomingCall.
 *
 * Vaani Labs (seen in production, event "call_postprocessing"):
 *   { event, call_id, timestamp, from, to,
 *     data: { call_id, transcript: string, call_started_at, picked_up_at, call_ended_at,
 *             call_duration: number, phone_number, summary, recording_url, entities, dispositions, … } }
 * Other common shapes are still accepted. This is the ONE place to adjust if Vaani changes its payload;
 * every authorised request is kept in the webhook_log table for comparison.
 */
export function normaliseVaaniPayload(body: Record<string, any>): IncomingCall {
  const call = body.call ?? body.data ?? body;

  const call_id = String(call.call_id ?? call.callId ?? call.id ?? "");
  if (!call_id) throw new Error("payload has no call id");

  const started = new Date(
    call.call_started_at ?? call.started_at ?? call.startedAt ?? call.start_time ?? call.created_at ?? body.timestamp ?? Date.now(),
  );
  const answered = call.picked_up_at ?? call.answered_at ?? call.answeredAt;
  const ended = call.call_ended_at ?? call.ended_at ?? call.endedAt ?? call.end_time;

  const fromTimes = ended ? (new Date(ended).getTime() - started.getTime()) / 1000 : 0;
  const duration_seconds = Number(call.call_duration ?? call.duration_seconds ?? call.duration ?? fromTimes) || fromTimes;
  const answer_seconds = answered ? Math.max(0, (new Date(answered).getTime() - started.getTime()) / 1000) : null;

  const raw = call.transcript ?? call.messages ?? call.conversation ?? "";
  const transcript = Array.isArray(raw)
    ? raw
        .map((m: any) => `${/agent|assistant|bot/i.test(m.role ?? m.speaker ?? "") ? "Agent" : "Caller"}: ${m.text ?? m.content ?? m.message ?? ""}`)
        .join("\n")
    : String(raw);

  const cost = call.cost_inr ?? call.costInr;

  return {
    call_id,
    phone: call.phone_number ?? call.from ?? body.from ?? call.from_number ?? call.caller ?? call.customer_number ?? null,
    started_at: started,
    answer_seconds: answer_seconds === null ? null : Math.round(answer_seconds),
    duration_seconds: Math.round(duration_seconds),
    transcript,
    voice_cost_inr: cost === undefined || cost === null ? null : Number(cost),
  };
}
