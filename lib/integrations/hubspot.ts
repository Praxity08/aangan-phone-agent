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

export const dealName = (name: string | null, property: string | null, location: string | null) =>
  `${name ?? "Phone enquiry"} · ${[property === "office" ? "Office" : "Home", location].filter(Boolean).join(", ")}`;

/** Qualified call → contact + deal at HUBSPOT_DEAL_STAGE. No amount: pricing is set at consultation. */
export async function createDeal(r: CallRecord, phone: string | null) {
  if (!process.env.HUBSPOT_TOKEN) return { skipped: "HUBSPOT_TOKEN not set" as const };

  const contact = await post("contacts", { properties: { firstname: r.name ?? "Phone enquiry", phone: phone ?? "" } });
  const deal = await post("deals", {
    properties: {
      dealname: dealName(r.name, r.property, r.location),
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

/** A corrected caller name: rename the deal and the contact(s) linked to it. */
export async function renameInHubSpot(dealId: string, name: string, property: string | null, location: string | null) {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return "skipped" as const;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const deal = await fetch(`${API}/deals/${dealId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ properties: { dealname: dealName(name, property, location) } }),
  });
  if (!deal.ok) throw new Error(`HubSpot deal ${deal.status}: ${await deal.text()}`);

  const assoc = await fetch(`https://api.hubapi.com/crm/v4/objects/deals/${dealId}/associations/contacts`, { headers });
  if (assoc.ok) {
    const { results = [] } = (await assoc.json()) as { results?: { toObjectId: string | number }[] };
    for (const c of results) {
      await fetch(`${API}/contacts/${c.toObjectId}`, { method: "PATCH", headers, body: JSON.stringify({ properties: { firstname: name } }) });
    }
  }
  return "updated" as const;
}
