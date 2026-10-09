import { timingSafeEqual } from "node:crypto";

/** Vaani Labs must send the shared secret in x-webhook-secret on the webhook and on tool calls. */
export function webhookAuthorised(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const given = req.headers.get("x-webhook-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
