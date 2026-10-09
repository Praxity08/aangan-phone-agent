import { webhookAuthorised } from "@/lib/auth";
import { bookSlot, calConfigured } from "@/lib/integrations/calcom";

/** Tool: book the slot the caller picked. */
export async function POST(req: Request) {
  if (!webhookAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  if (!calConfigured()) return Response.json({ error: "booking not configured" }, { status: 503 });

  const body = (await req.json()) as { start?: string; name?: string; phone?: string; email?: string; notes?: string };
  if (!body.start || !body.name) return Response.json({ error: "start and name are required" }, { status: 400 });

  try {
    const booking = await bookSlot({ start: body.start, name: body.name, phone: body.phone, email: body.email, notes: body.notes });
    return Response.json({ booked: true, ...booking });
  } catch (err) {
    return Response.json({ booked: false, error: (err as Error).message }, { status: 502 });
  }
}
