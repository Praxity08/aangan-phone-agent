// Test harness: sends each September transcript through the webhook (Gemini classification included),
// waits for the background classification, and compares outcomes with the hand classification.
// Replays never message designers or create deals.
// Usage: npm run replay                (against http://localhost:3000)
//        REPLAY_URL=https://… npm run replay -- T02 T13
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const base = process.env.REPLAY_URL || "http://localhost:3000";
const sql = neon(process.env.DATABASE_URL);
const calls = JSON.parse(readFileSync(new URL("../data/september-phone-calls.json", import.meta.url)));
const expected = JSON.parse(readFileSync(new URL("../data/september-records.json", import.meta.url)));
const only = process.argv.slice(2);
const run = Date.now().toString(36);
const gap = Number(process.env.REPLAY_GAP_MS || 0); // space calls out to stay under a free-tier per-minute quota
const todo = calls.filter((c) => c.id !== "T08" && (!only.length || only.includes(c.id))); // T08: missed call, no transcript

for (const c of todo) {
  const res = await fetch(`${base}/api/vaani/webhook?source=replay`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-secret": process.env.WEBHOOK_SECRET || "" },
    body: JSON.stringify({
      call_id: `replay-${run}-${c.id}`,
      from: null,
      started_at: c.started_at,
      answered_at: new Date(new Date(c.started_at).getTime() + 3000).toISOString(),
      duration_seconds: c.duration_seconds ?? 342,
      transcript: c.transcript,
    }),
  });
  if (res.status !== 202) console.log(`! ${c.id} webhook answered ${res.status}: ${(await res.text()).slice(0, 120)}`);
  if (gap) await new Promise((r) => setTimeout(r, gap));
}
console.log(`Sent ${todo.length} calls. Waiting for classification…`);

const deadline = Date.now() + 6 * 60_000;
let rows = [];
while (Date.now() < deadline) {
  rows = await sql`SELECT call_id, outcome, uncertain FROM calls WHERE call_id LIKE ${`replay-${run}-%`}`;
  if (rows.length === todo.length && rows.every((r) => r.outcome !== "pending")) break;
  await new Promise((r) => setTimeout(r, 5000));
}

let match = 0;
for (const c of todo) {
  const r = rows.find((x) => x.call_id === `replay-${run}-${c.id}`);
  const got = r?.outcome ?? "missing";
  const want = expected[c.id].outcome;
  if (got === want) match++;
  const why = got === "unclassified" ? `  (${(r.uncertain ?? "").slice(0, 90)})` : "";
  console.log(`${got === want ? "✓" : "✗"} ${c.id}  expected ${want.padEnd(10)} got ${got}${why}`);
}
console.log(`\n${match}/${todo.length} outcomes match the hand classification.`);
