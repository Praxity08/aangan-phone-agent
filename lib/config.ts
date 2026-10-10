const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : fallback;
};

export const config = {
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  // Used when the main model errors or stalls (Google "high demand"). Its cost is logged at the main model's rates.
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash",
  geminiInputUsdPerM: num(process.env.GEMINI_INPUT_USD_PER_M, 0.75),
  geminiOutputUsdPerM: num(process.env.GEMINI_OUTPUT_USD_PER_M, 3.75),
  usdToInr: num(process.env.USD_TO_INR, 88),
  voiceInrPerMin: num(process.env.VOICE_INR_PER_MIN, 5.6),
  timeZone: "Asia/Kolkata",
  officeOpenHour: 10,
  officeCloseHour: 19,
  // Brief: average project value ₹8–14 lakh.
  projectValueLakh: { low: 8, high: 14 },
};

/** Hour of day (0–23) in IST. */
export function istHour(d: Date) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: config.timeZone }).format(d),
  ) % 24;
}

export function isAfterHours(d: Date) {
  const h = istHour(d);
  return h < config.officeOpenHour || h >= config.officeCloseHour;
}
