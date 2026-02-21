/**
 * Human-friendly label mappings for all internal variable names.
 * Used across all UI surfaces to avoid showing raw field names.
 */

export const FIELD_LABELS: Record<string, string> = {
  // Claim fields
  claim_id: "Claim ID",
  created_at: "Created",
  updated_at: "Last Updated",
  policy_id: "Policy ID",
  full_name: "Full Name",
  phone: "Phone",
  email: "Email",
  address: "Address",
  date_of_loss: "Date of Loss",
  state: "State",
  city: "City",
  description: "Description",
  vin: "VIN",
  year: "Year",
  make: "Make",
  model: "Model",
  stage: "Stage",

  // Front Desk output
  triage_category: "Triage Category",
  missing_items: "Missing Items",
  confidence: "Confidence",

  // Claims Officer output
  coverage_status: "Coverage Status",
  deductible: "Deductible",
  limits: "Coverage Limits",
  denial_reason: "Denial Reason",
  denial_provision_ref: "Denial Provision Reference",
  proof_of_loss_needed: "Proof of Loss Required",

  // Assessor output
  repair_estimate_low: "Repair Estimate (Low)",
  repair_estimate_high: "Repair Estimate (High)",
  total_loss_recommended: "Total Loss Recommended",
  damaged_components: "Damaged Components",
  assessment_notes: "Assessment Notes",
  valuation_method: "Valuation Method",
  actual_cash_value: "Actual Cash Value",
  betterment_deductions: "Betterment Deductions",
  parts_compliance_note: "Parts Compliance Note",
  tax_reimbursement_eligible: "Tax Reimbursement Eligible",
  pricing_sources: "Pricing Sources",

  // Image Analyzer output
  image_descriptions: "Image Descriptions",
  overall_assessment: "Overall Assessment",
  estimated_labor_hours: "Estimated Labor Hours",
  total_loss_indicators: "Total Loss Indicators",

  // Fraud Analyst output
  risk_score: "Risk Score",
  flags: "Risk Flags",
  recommendation: "Recommendation",
  fraud_reporting_deadline: "Fraud Reporting Deadline",

  // Senior Reviewer / Decision output
  final_outcome: "Final Outcome",
  rationale: "Rationale",
  approve_amount_cap: "Approved Amount Cap",
  required_actions: "Required Actions",
  needs_human_review: "Needs Human Review",

  // Finance output
  payment_status: "Payment Status",
  amount: "Amount",
  payee: "Payee",
  ledger_entry_id: "Ledger Entry ID",
  receipt_ref: "Receipt Reference",

  // Compliance sub-fields
  ack_due_at: "Acknowledgement Due",
  accept_deny_due_at: "Accept/Deny Due",
  next_status_update_due_at: "Next Status Update Due",
  payment_due_at: "Payment Due",
  deadlines_met: "Deadlines Met",
  next_required_action: "Next Required Action",
  all_stages_complete: "All Stages Complete",
  estimate_provided: "Estimate Provided",
  accept_deny_deadline: "Accept/Deny Deadline",
  fraud_report_due_at: "Fraud Report Due",

  // Run fields
  run_id: "Run ID",
  agent_id: "Agent",
  status: "Status",
  started_at: "Started",
  ended_at: "Ended",
  duration_ms: "Duration",
  actor_id: "Actor",
  trace_id: "Trace ID",
  prompt_tokens: "Prompt Tokens",
  completion_tokens: "Completion Tokens",
  total_tokens: "Total Tokens",
  output_s3_key: "Output Key",
  error: "Error",
  input_prompt: "Input Prompt",
  output_json: "Output",

  // Assessment-specific
  photos_analyzed: "Photos Analyzed",
  detected_damage: "Detected Damage",
  part: "Part",
  severity: "Severity",
  side: "Side",
  estimate_range: "Estimate Range",
  total_loss: "Total Loss",
  pricing_source: "Pricing Source",
  web_search: "Web Search Evidence",
  citations: "Citations",
};

const VALUATION_METHOD_LABELS: Record<string, string> = {
  local_comps: "Local Comparisons",
  proximate_market_comps: "Proximate Market Comparisons",
  dealer_quotes: "Dealer Quotes",
  industry_source_database: "Industry Source Database",
};

const TRIAGE_LABELS: Record<string, string> = {
  fast_track: "Fast Track",
  standard: "Standard",
  complex: "Complex",
};

const COVERAGE_STATUS_LABELS: Record<string, string> = {
  covered: "Covered",
  denied: "Denied",
  need_more_info: "More Information Needed",
};

const FRAUD_RECOMMENDATION_LABELS: Record<string, string> = {
  normal: "Normal Processing",
  enhanced_review: "Enhanced Review Required",
  siu_referral: "SIU Referral",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  disbursed: "Disbursed",
  held: "Held",
  rejected: "Rejected",
};

const OUTCOME_LABELS: Record<string, string> = {
  approve: "Approved",
  partial: "Partially Approved",
  deny: "Denied",
  escalate: "Escalated",
};

const ENUM_LABEL_MAPS: Record<string, Record<string, string>> = {
  valuation_method: VALUATION_METHOD_LABELS,
  triage_category: TRIAGE_LABELS,
  coverage_status: COVERAGE_STATUS_LABELS,
  recommendation: FRAUD_RECOMMENDATION_LABELS,
  payment_status: PAYMENT_STATUS_LABELS,
  final_outcome: OUTCOME_LABELS,
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";

  const enumMap = ENUM_LABEL_MAPS[key];
  if (enumMap && typeof value === "string") {
    return enumMap[value] ?? value;
  }

  if (typeof value === "boolean") {
    if (key === "total_loss_recommended") return value ? "Yes — Total Loss" : "No";
    if (key === "proof_of_loss_needed") return value ? "Required" : "Not Required";
    if (key === "needs_human_review") return value ? "Yes" : "No";
    if (key === "deadlines_met") return value ? "On Track" : "Overdue";
    if (key === "all_stages_complete") return value ? "Complete" : "Incomplete";
    if (key === "estimate_provided") return value ? "Provided" : "Pending";
    if (key === "tax_reimbursement_eligible") return value ? "Eligible" : "Not Eligible";
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    if (key === "confidence" || key === "risk_score") {
      return key === "risk_score"
        ? `${value}/100`
        : `${(value * 100).toFixed(0)}%`;
    }
    if (
      key === "deductible" || key === "limits" || key === "amount" ||
      key === "approve_amount_cap" || key === "actual_cash_value" ||
      key === "repair_estimate_low" || key === "repair_estimate_high"
    ) {
      return formatCurrency(value);
    }
    if (key === "duration_ms") {
      return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
    }
    return value.toLocaleString();
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    return value.join(", ");
  }

  if (typeof value === "string") {
    if (isIsoDate(value)) return formatDateTime(value);
    return value;
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyRange(low: number, high: number): string {
  return `${formatCurrency(low)} – ${formatCurrency(high)}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})/.test(s);
}
