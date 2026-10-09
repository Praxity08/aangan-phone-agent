// Test harness: sends each September transcript through the live webhook (Gemini classification included)
// and compares the agent's outcome with the hand-classified one. Needs `npm run dev` running.
// Usage: npm run replay            (all 20)
//        npm run replay -- T02 T13 (some)
import { readFileSync } from "node:fs";

const base = process.env.REPLAY_URL || "http://localhost:3000";
const calls = JSON.parse(readFileSync(new URL("../data/september-phone-calls.json", import.meta.url)));
const expected = JSON.parse(readFileSync(new URL("../data/september-records.json", import.meta.url)));
const only = process.argv.slice(2);
const run = Date.now().toString(36);

let match = 0, total = 0;
for (const c of calls.filter((c) => !only.length || only.includes(c.id))) {
  if (c.id === "T08") continue; // missed call, no transcript
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
  const body = await res.json();
  const want = expected[c.id].outcome;
  const ok = body.outcome === want;
  total++; if (ok) match++;
  console.log(`${ok ? "✓" : "✗"} ${c.id}  expected ${want.padEnd(10)} got ${String(body.outcome ?? body.error).padEnd(12)}`);
}
console.log(`\n${match}/${total} outcomes match the hand classification.`);
