# Aangan phone agent

The studio phone is answered by a Vaani Labs voice agent, day or night. When a call ends, this app classifies it against Nikhil's rubric, sends qualified enquiries to designers on Telegram with the full brief, creates the HubSpot deal, and logs everything, including what each call cost, for the dashboard.

```
Caller ─▶ Vaani Labs voice agent ──(during call)──▶ /api/tools/lookup-caller · availability · book ─▶ Cal.com
                    │
                    └──(call ends)──▶ /api/vaani/webhook ─▶ Gemini Flash classifies against knowledge/*.md
                                                              ├─▶ Neon: calls table ─▶ dashboard (/)
                                                              ├─▶ qualified → Telegram brief + HubSpot deal
                                                              └─▶ existing client → urgent Telegram to Nikhil
```

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL at minimum
npm run seed                 # loads the 20 September phone calls as demo data
npm run dev                  # dashboard at http://localhost:3000
```

Every integration is optional. With no key set, that step is skipped and the call is still logged.

## What goes where

| File | What it is |
|---|---|
| `knowledge/phone-agent-prompt.md` | The voice agent's system prompt. Paste into Vaani Labs. |
| `knowledge/qualified.md`, `services.md`, `pricing.md` | Nikhil's rules. The classifier reads them on every call: edit these to change behaviour. |
| `lib/vaani.ts` | Maps Vaani's post-call webhook to our call shape. **The one file to adjust once you see a real Vaani payload.** |
| `lib/classify.ts` | Gemini Flash classification, with cost per call from token usage |
| `lib/process-call.ts` | Store → hand off. Telegram or HubSpot failures never lose a call. |
| `lib/integrations/` | Telegram, HubSpot, Cal.com |
| `app/page.tsx`, `lib/metrics.ts` | The dashboard |
| `data/september-*.json` | The 20 September phone calls and their hand classification |

## Setting up each service

1. **Database.** Neon project "Mesa", database `aangan` (tables `calls`, `fixed_costs`). Already created.
2. **Gemini.** Create an API key at aistudio.google.com → `GEMINI_API_KEY`.
3. **Telegram.** Message @BotFather → `/newbot` → `TELEGRAM_BOT_TOKEN`. Add the bot to the designers' group and to a chat with Nikhil; get each chat id (send a message, then open `https://api.telegram.org/bot<token>/getUpdates`).
4. **HubSpot.** Settings → Integrations → Private apps → scopes `crm.objects.contacts.write`, `crm.objects.deals.write` → `HUBSPOT_TOKEN`.
5. **Cal.com.** Create a "Design consultation" event type; Settings → Developer → API keys → `CAL_API_KEY`, the event type id → `CAL_EVENT_TYPE_ID`, and a studio inbox → `CAL_FALLBACK_EMAIL`.
6. **Vaani Labs.**
   - System prompt: `knowledge/phone-agent-prompt.md`
   - Tools (custom functions): the three in section 11 of the prompt, pointing at `https://<your-domain>/api/tools/...`
   - Post-call webhook: `https://<your-domain>/api/vaani/webhook`
   - Send header `x-webhook-secret: <WEBHOOK_SECRET>` on all of them
   - Set `VOICE_INR_PER_MIN` to your contracted rate, and enter any platform fee in `fixed_costs`
7. **Dashboard password.** Set `DASHBOARD_PASSWORD`. People sign in at `/login`; the session lasts 30 days, and changing the password signs everyone out.

## Test the classifier

With `GEMINI_API_KEY` set and `npm run dev` running:

```bash
npm run replay
```

This sends the 19 September transcripts through the real webhook (as source "replay": no Telegram, no HubSpot) and prints how many outcomes match the hand classification.

## Costs on the dashboard

- **Voice:** call minutes × `VOICE_INR_PER_MIN`, or Vaani's own per-call cost if the webhook sends `cost_inr`. The default 5.5 is a market benchmark, not a Vaani quote.
- **AI:** Gemini token usage per call × `GEMINI_*_USD_PER_M` × `USD_TO_INR`.
- **Fixed:** rows in `fixed_costs`, per month. Edit them in Neon's SQL editor.

## Open questions for Nikhil

The agent makes an assumption for each of these (marked **[confirm with Nikhil]** in the prompt):

1. Timeline rule: "site available within 8–10 weeks of the consultation" vs. the front desk booking February/March starts.
2. Minimum commercial size (T18 was declined below 500 sq ft; services.md has no minimum).
3. Pune areas not on the service list (Kharadi, Nanded City).
4. The "clearly too low" budget threshold.
5. Who takes urgent existing-client alerts after hours.
