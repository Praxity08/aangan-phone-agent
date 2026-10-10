import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "./config";
import type { CallRecord } from "./types";

const knowledge = (file: string) => readFileSync(path.join(process.cwd(), "knowledge", file), "utf8");

let systemPrompt: string | null = null;

function buildSystemPrompt() {
  systemPrompt ??= `You classify finished phone calls to Aangan Studio, an interior design studio in Pune.
You read one call transcript and return one JSON record. You never talk to the caller.

Apply Nikhil's rubric exactly. When the rubric and the agent prompt disagree, the rubric wins.
Use the pricing guide ONLY to judge whether a budget the caller volunteered is clearly too low
(below roughly half of the internal minimum for their scope). Never copy any price into the record.

Rules for the record:
- outcome "qualified" only if all five criteria pass, or 4/5 are unclear and noted in "uncertain".
- outcome "nurture" when the only failure is timing and the caller is open to a later start.
- outcome "escalated" ONLY for existing clients: someone whose project with Aangan is already under way
  (they mention their designer, an ongoing project, or work in progress) and who has a complaint or urgent issue.
- A prospective client who enquired before and was never called back is NOT escalated, however frustrated:
  call_type "follow_up", judge them on the five criteria like any new enquiry, and add the flag
  "previous enquiry missed".
- outcome "message" for vendors, job seekers and anything that is not an enquiry.
- decline_reason is set only when outcome is "declined" or "nurture".
- flags: use any of "tight timeline", "check area", "previous enquiry missed", "VIP referral",
  "budget may be tight", "call dropped". Empty array if none.
- summary: two plain sentences a designer reads before calling. No prices.
- Use null for anything the caller did not say. Do not guess.

=== qualified.md (Nikhil's rubric) ===
${knowledge("qualified.md")}

=== services.md ===
${knowledge("services.md")}

=== pricing.md (internal, never quoted) ===
${knowledge("pricing.md")}

=== phone-agent-prompt.md (what the voice agent was told) ===
${knowledge("phone-agent-prompt.md")}`;
  return systemPrompt;
}

const str = { type: "STRING", nullable: true };

const responseSchema = {
  type: "OBJECT",
  properties: {
    call_type: { type: "STRING", enum: ["new_enquiry", "existing_client", "follow_up", "other"] },
    outcome: { type: "STRING", enum: ["qualified", "declined", "escalated", "nurture", "message"] },
    decline_reason: {
      type: "STRING",
      nullable: true,
      enum: ["advice_only", "out_of_area", "timeline", "budget", "out_of_scope"],
    },
    name: str,
    referral: str,
    property: { type: "STRING", nullable: true, enum: ["home", "office"] },
    location: str,
    carpet_area_sqft: { type: "INTEGER", nullable: true },
    scope: str,
    current_state: str,
    complete_by: str,
    decision_maker: str,
    rented: { type: "BOOLEAN", nullable: true },
    budget_volunteered: str,
    asked_about_price: { type: "BOOLEAN" },
    flags: { type: "ARRAY", items: { type: "STRING" } },
    uncertain: str,
    consultation: {
      type: "OBJECT",
      properties: {
        type: { type: "STRING", nullable: true, enum: ["site", "studio"] },
        booked_for: str,
      },
    },
    summary: { type: "STRING" },
  },
  required: ["call_type", "outcome", "asked_about_price", "flags", "summary", "consultation"],
};

export interface Classification {
  record: CallRecord;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
}

export async function classifyCall(transcript: string, startedAt: Date): Promise<Classification> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const when = startedAt.toLocaleString("en-IN", { timeZone: config.timeZone, dateStyle: "full", timeStyle: "short" });
  const request = JSON.stringify({
    systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
    contents: [{ role: "user", parts: [{ text: `Call received ${when} (IST).\n\nTranscript:\n${transcript}` }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema,
      // Sorting a call against a written rubric needs little reasoning; low thinking keeps it fast and cheap.
      thinkingConfig: { thinkingLevel: "low" },
    },
  });

  // Gemini can answer 429/500/503 or take over a minute when Google is under heavy load. Alternate between the
  // main and fallback model, pausing between rounds, for up to ~4 minutes (inside the webhook's 5-minute budget).
  const models = [config.geminiModel, config.geminiFallbackModel];
  const deadline = Date.now() + 230_000;
  const pauses = [0, 5_000, 15_000, 30_000, 45_000, 60_000];
  let res: Response | null = null;
  let lastError = "";
  for (let i = 0; Date.now() < deadline; i++) {
    const wait = pauses[Math.min(i, pauses.length - 1)];
    if (wait) await new Promise((r) => setTimeout(r, Math.min(wait, Math.max(0, deadline - Date.now()))));
    const model = models[i % models.length];
    const timeLeft = deadline - Date.now();
    if (timeLeft < 5_000) break;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: request,
        signal: AbortSignal.timeout(Math.min(120_000, timeLeft)),
      });
    } catch (err) {
      res = null;
      lastError = `${model}: ${(err as Error).message}`;
      continue;
    }
    if (res.ok) break;
    lastError = `${model} ${res.status}: ${(await res.text()).slice(0, 300)}`;
    // Only overload and rate errors are worth retrying; anything else (bad key, bad request) won't fix itself.
    if (![429, 500, 502, 503, 504].includes(res.status)) {
      res = null;
      break;
    }
    res = null;
  }

  if (!res) throw new Error(lastError);
  const body = await res.json();
  const text = body.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const record = JSON.parse(text) as CallRecord;
  record.flags ??= [];
  record.consultation ??= { type: null, booked_for: null };

  const inputTokens = body.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = (body.usageMetadata?.candidatesTokenCount ?? 0) + (body.usageMetadata?.thoughtsTokenCount ?? 0);
  const costUsd = (inputTokens * config.geminiInputUsdPerM + outputTokens * config.geminiOutputUsdPerM) / 1_000_000;

  return { record, inputTokens, outputTokens, costInr: costUsd * config.usdToInr };
}
