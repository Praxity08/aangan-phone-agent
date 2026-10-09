import type { CallRecord } from "../types";

const API = "https://api.hubapi.com/crm/v3/objects";

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HubSpot ${path} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<{ id: string }>;
}

/** Qualified call → contact + deal at "Appointment scheduled". No amount: pricing is set at consultation. */
export async function createDeal(r: CallRecord, phone: string | null) {
  if (!process.env.HUBSPOT_TOKEN) return { skipped: "HUBSPOT_TOKEN not set" as const };

  const contact = await post("contacts", { properties: { firstname: r.name ?? "Phone enquiry", phone: phone ?? "" } });
  const place = [r.property === "office" ? "Office" : "Home", r.location].filter(Boolean).join(", ");
  const deal = await post("deals", {
    properties: {
      dealname: `${r.name ?? "Phone enquiry"} · ${place}`,
      pipeline: "default",
      dealstage: "appointmentscheduled",
      description: r.summary,
    },
    associations: [
      { to: { id: contact.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] },
    ],
  });
  return { dealId: deal.id };
}
