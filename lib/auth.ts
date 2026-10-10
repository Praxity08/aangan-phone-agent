import { createHmac, timingSafeEqual } from "node:crypto";

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Requests from Vaani Labs are trusted when they carry WEBHOOK_SECRET in one of three ways:
 *  - header `x-webhook-secret: <secret>`
 *  - query `?key=<secret>` (for platforms that can't set headers)
 *  - a signature header (any header named *sign* or *hmac*) holding HMAC-SHA256(secret, body),
 *    hex or base64, optionally `sha256=`/`v1=` prefixed or Stripe-style `t=…,v1=…` (signs `${t}.${body}`).
 *    This is what Vaani's "Signing Secret" field does; pass the raw body to check it.
 */
export function webhookAuthorised(req: Request, rawBody?: string) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  if (same(req.headers.get("x-webhook-secret") ?? "", secret)) return true;
  if (same(new URL(req.url).searchParams.get("key") ?? "", secret)) return true;
  if (rawBody === undefined) return false;

  const sign = (payload: string) => {
    const h = createHmac("sha256", secret).update(payload);
    const digest = h.digest();
    return [digest.toString("hex"), digest.toString("base64")];
  };
  for (const [name, value] of req.headers) {
    if (!/sign|hmac/i.test(name)) continue;
    const parts = value.split(/[,\s]+/).filter(Boolean);
    const t = parts.find((p) => p.startsWith("t="))?.slice(2);
    const expected = [...sign(rawBody), ...(t ? sign(`${t}.${rawBody}`) : [])];
    for (const part of parts) {
      const v = part.replace(/^(sha256|v1)=/i, "");
      if (expected.some((e) => same(v, e) || same(v.toLowerCase(), e))) return true;
    }
  }
  return false;
}

/** Header names (and the values of signature/timestamp headers, which aren't secret) for the webhook log. */
export function headerSummary(req: Request) {
  const out: Record<string, string> = {};
  for (const [name, value] of req.headers) {
    out[name] = /sign|hmac|timestamp|event|user-agent/i.test(name) ? value.slice(0, 200) : "…";
  }
  return out;
}
