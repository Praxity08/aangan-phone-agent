import { webhookAuthorised } from "@/lib/auth";
import { availableSlots, calConfigured } from "@/lib/integrations/calcom";

const ist = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

/** Tool: the next open consultation slots, as words the agent can read out plus ISO times to book. */
export async function POST(req: Request) {
  if (!webhookAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  if (!calConfigured()) return Response.json({ error: "booking not configured; take their details and say the studio will confirm a time" }, { status: 503 });

  const { from, days = 7 } = (await req.json().catch(() => ({}))) as { from?: string; days?: number };
  const start = from ? new Date(from) : new Date(Date.now() + 24 * 3600 * 1000);
  const end = new Date(start.getTime() + Math.min(days, 21) * 24 * 3600 * 1000);
  const day = (d: Date) => d.toISOString().slice(0, 10);

  const slots = (await availableSlots(day(start), day(end))).slice(0, 6);
  return Response.json({ slots: slots.map((s) => ({ start: s, say: ist(s) })) });
}
