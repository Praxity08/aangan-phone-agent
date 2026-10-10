import type { CallRecord } from "../types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function send(chatId: string, html: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { skipped: "TELEGRAM_BOT_TOKEN not set" };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
  return { sent: true };
}

/** The designer's brief: everything the front desk would have asked, so the first call starts from here. */
export function designerBrief(r: CallRecord, phone: string | null) {
  const line = (label: string, value: string | number | boolean | null | undefined) =>
    value === null || value === undefined || value === "" ? "" : `<b>${label}:</b> ${esc(String(value))}\n`;
  return (
    `<b>New qualified enquiry</b>${r.flags.length ? ` · ${esc(r.flags.join(" · "))}` : ""}\n\n` +
    `${esc(r.summary)}\n\n` +
    line("Name", r.name) +
    line("Phone", phone) +
    line("Referral", r.referral) +
    line("Property", r.property) +
    line("Location", r.location) +
    line("Carpet area", r.carpet_area_sqft ? `${r.carpet_area_sqft} sq ft` : null) +
    line("Scope", r.scope) +
    line("Current state", r.current_state) +
    line("Complete by", r.complete_by) +
    line("Decision-maker", r.decision_maker) +
    line("Rented", r.rented === null ? null : r.rented ? "yes" : "no") +
    line("Budget (volunteered)", r.budget_volunteered) +
    line("Asked about price", r.asked_about_price ? "yes, deflected to consultation" : null) +
    line("Consultation", [r.consultation.type, r.consultation.booked_for].filter(Boolean).join(", ") || null) +
    line("Unclear", r.uncertain)
  );
}

export async function sendDesignerBrief(r: CallRecord, phone: string | null) {
  const chat = process.env.TELEGRAM_DESIGNERS_CHAT_ID;
  if (!chat) return { skipped: "TELEGRAM_DESIGNERS_CHAT_ID not set" };
  return send(chat, designerBrief(r, phone));
}

export async function sendEscalation(r: CallRecord, phone: string | null) {
  const chat = process.env.TELEGRAM_ESCALATION_CHAT_ID;
  if (!chat) return { skipped: "TELEGRAM_ESCALATION_CHAT_ID not set" };
  const html =
    `<b>URGENT · existing client</b>\n\n${esc(r.summary)}\n\n` +
    `<b>Name:</b> ${esc(r.name ?? "unknown")}\n<b>Phone:</b> ${esc(phone ?? "unknown")}\n` +
    `The caller was told a senior person will call back.`;
  return send(chat, html);
}

/** Gemini couldn't classify a live call: still tell the studio a call came in, so no lead is missed. */
export async function sendUnclassifiedNotice(call: { phone: string | null; started_at: string; transcript: string }) {
  const chat = process.env.TELEGRAM_DESIGNERS_CHAT_ID;
  if (!chat) return { skipped: "TELEGRAM_DESIGNERS_CHAT_ID not set" };
  const when = new Date(call.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const excerpt = call.transcript.length > 700 ? `${call.transcript.slice(0, 700)}…` : call.transcript;
  const html =
    `<b>New call · not classified yet</b>\n\n` +
    `<b>Phone:</b> ${esc(call.phone ?? "unknown")}\n<b>When:</b> ${esc(when)}\n\n` +
    `<i>${esc(excerpt)}</i>\n\n` +
    `The AI couldn't classify this call automatically. Read it on the dashboard and use "Retry classification".`;
  return send(chat, html);
}
