export type IsoDateTime = string;

export type ClaimStage =
  | "FNOL_SUBMITTED"
  | "FRONTDESK_DONE"
  | "COVERAGE_DONE"
  | "ASSESSMENT_DONE"
  | "FRAUD_DONE"
  | "FINAL_DECISION_DONE"
  | "PAID"
  | "CLOSED_NO_PAY";

export const STAGE_ORDER: ClaimStage[] = [
  "FNOL_SUBMITTED",
  "FRONTDESK_DONE",
  "COVERAGE_DONE",
  "ASSESSMENT_DONE",
  "FRAUD_DONE",
  "FINAL_DECISION_DONE",
  "PAID",
  "CLOSED_NO_PAY",
];

export const ALLOWED_TRANSITIONS: Record<ClaimStage, ClaimStage[]> = {
  FNOL_SUBMITTED: ["FRONTDESK_DONE"],
  FRONTDESK_DONE: ["COVERAGE_DONE"],
  COVERAGE_DONE: ["ASSESSMENT_DONE"],
  ASSESSMENT_DONE: ["FRAUD_DONE"],
  FRAUD_DONE: ["FINAL_DECISION_DONE"],
  FINAL_DECISION_DONE: ["PAID", "CLOSED_NO_PAY"],
  PAID: [],
  CLOSED_NO_PAY: [],
};

export type Claim = {
  claim_id: string;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  policy_id: string;
  claimant: {
    full_name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  loss: {
    date_of_loss: string; // YYYY-MM-DD
    state: "OH";
    city?: string;
    description: string;
  };
  vehicle: {
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
  };
  stage: ClaimStage;
  compliance: {
    ack_due_at: IsoDateTime;
    accept_deny_due_at?: IsoDateTime;
    next_status_update_due_at?: IsoDateTime;
    payment_due_at?: IsoDateTime;
  };
  attachments?: string[];
};

export type ClaimEvent = {
  claim_id: string;
  event_sk: string;
  created_at: IsoDateTime;
  stage: string;
  type: string;
  data: unknown;
  prev_hash?: string;
  hash: string;
};

export type FrontDeskOutput = {
  triage_category: "fast_track" | "standard" | "complex";
  missing_items: string[];
  compliance: {
    ack_due_at: string;
    deadlines_met: boolean;
    next_required_action: string;
  };
  confidence: number;
};

export type ClaimsOfficerOutput = {
  coverage_status: "covered" | "denied" | "need_more_info";
  deductible?: number;
  limits?: number;
  denial_reason?: string;
  denial_provision_ref?: string;
  proof_of_loss_needed: boolean;
  compliance: {
    accept_deny_deadline: string;
    deadlines_met: boolean;
    next_required_action: string;
  };
  confidence: number;
};

export type AssessorOutput = {
  repair_estimate_low: number;
  repair_estimate_high: number;
  total_loss_recommended: boolean;
  valuation_method?: "local_comps" | "proximate_market_comps" | "dealer_quotes" | "industry_source_database";
  actual_cash_value?: number;
  betterment_deductions?: string[];
  parts_compliance_note?: string;
  tax_reimbursement_eligible: boolean;
  compliance: {
    estimate_provided: boolean;
    deadlines_met: boolean;
    next_required_action: string;
  };
  confidence: number;
};

export type FraudAnalystOutput = {
  risk_score: number;
  flags: string[];
  recommendation: "normal" | "enhanced_review" | "siu_referral";
  fraud_reporting_deadline?: string;
  compliance: {
    fraud_report_due_at?: string;
    deadlines_met: boolean;
    next_required_action: string;
  };
  confidence: number;
};

export type SeniorReviewerOutput = {
  final_outcome: "approve" | "partial" | "deny" | "escalate";
  rationale: string;
  approve_amount_cap?: number;
  required_actions: string[];
  needs_human_review: boolean;
  compliance: {
    all_stages_complete: boolean;
    deadlines_met: boolean;
    next_required_action: string;
  };
  confidence: number;
};

export type FinanceOutput = {
  payment_status: "disbursed" | "held" | "rejected";
  amount?: number;
  payee?: string;
  ledger_entry_id?: string;
  receipt_ref?: string;
  compliance: {
    payment_due_at?: string;
    deadlines_met: boolean;
    next_required_action: string;
  };
  confidence: number;
};
