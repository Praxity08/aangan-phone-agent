export type CallType = "new_enquiry" | "existing_client" | "follow_up" | "other";
export type Outcome = "qualified" | "declined" | "escalated" | "nurture" | "message" | "unclassified";
export type DeclineReason = "advice_only" | "out_of_area" | "timeline" | "budget" | "out_of_scope" | null;

/** What the classifier extracts from one call. Mirrors section 10 of phone-agent-prompt.md. */
export interface CallRecord {
  call_type: CallType;
  outcome: Outcome;
  decline_reason: DeclineReason;
  name: string | null;
  referral: string | null;
  property: "home" | "office" | null;
  location: string | null;
  carpet_area_sqft: number | null;
  scope: string | null;
  current_state: string | null;
  complete_by: string | null;
  decision_maker: string | null;
  rented: boolean | null;
  budget_volunteered: string | null;
  asked_about_price: boolean;
  flags: string[];
  uncertain: string | null;
  consultation: { type: "site" | "studio" | null; booked_for: string | null };
  summary: string;
}

/** A finished call as it arrives from the voice platform, after normalising. */
export interface IncomingCall {
  call_id: string;
  phone: string | null;
  started_at: Date;
  answer_seconds: number | null;
  duration_seconds: number;
  transcript: string;
  voice_cost_inr: number | null;
}
