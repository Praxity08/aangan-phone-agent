const API = "https://api.cal.com/v2";

function headers(version: string) {
  return { authorization: `Bearer ${process.env.CAL_API_KEY}`, "cal-api-version": version, "content-type": "application/json" };
}

export function calConfigured() {
  return Boolean(process.env.CAL_API_KEY && process.env.CAL_EVENT_TYPE_ID);
}

/** Open consultation slots between two dates (YYYY-MM-DD), in IST. */
export async function availableSlots(start: string, end: string) {
  const q = new URLSearchParams({ eventTypeId: process.env.CAL_EVENT_TYPE_ID!, start, end, timeZone: "Asia/Kolkata" });
  const res = await fetch(`${API}/slots?${q}`, { headers: headers("2024-09-04") });
  if (!res.ok) throw new Error(`Cal.com slots ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { data: Record<string, { start: string }[]> };
  return Object.values(body.data).flat().map((s) => s.start);
}

export async function bookSlot(input: { start: string; name: string; phone?: string; email?: string; notes?: string }) {
  const email = input.email || process.env.CAL_FALLBACK_EMAIL;
  if (!email) throw new Error("No attendee email and CAL_FALLBACK_EMAIL is not set");
  const res = await fetch(`${API}/bookings`, {
    method: "POST",
    headers: headers("2024-08-13"),
    body: JSON.stringify({
      start: new Date(input.start).toISOString(),
      eventTypeId: Number(process.env.CAL_EVENT_TYPE_ID),
      attendee: { name: input.name, email, timeZone: "Asia/Kolkata", ...(input.phone ? { phoneNumber: input.phone } : {}) },
      metadata: { source: "phone-agent", ...(input.notes ? { notes: input.notes.slice(0, 500) } : {}) },
    }),
  });
  if (!res.ok) throw new Error(`Cal.com booking ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { data: { uid: string; start: string } };
  return { uid: body.data.uid, start: body.data.start };
}
