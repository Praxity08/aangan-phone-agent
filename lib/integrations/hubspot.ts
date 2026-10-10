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

/** Qualified call → contact + deal at HUBSPOT_DEAL_STAGE. No amount: pricing is set at consultation. */
export async function createDeal(r: CallRecord, phone: string | null) {
  if (!process.env.HUBSPOT_TOKEN) return { skipped: "HUBSPOT_TOKEN not set" as const };

  const contact = await post("contacts", { properties: { firstname: r.name ?? "Phone enquiry", phone: phone ?? "" } });
  const place = [r.property === "office" ? "Office" : "Home", r.location].filter(Boolean).join(", ");
  const deal = await post("deals", {
    properties: {
      dealname: `${r.name ?? "Phone enquiry"} · ${place}`,
      // Stage ids differ per account (Aangan's pipeline: "Lead Captured" = 4420487875).
      pipeline: process.env.HUBSPOT_PIPELINE || "default",
      dealstage: process.env.HUBSPOT_DEAL_STAGE || "appointmentscheduled",
      description: r.summary,
    },
    associations: [
      { to: { id: contact.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] },
    ],
  });
  return { dealId: deal.id };
}
