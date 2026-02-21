import { fieldLabel, formatFieldValue, formatCurrency, formatCurrencyRange, formatDateTime, formatDate } from "../lib/fieldLabels";

export { fieldLabel, formatFieldValue, formatCurrency, formatCurrencyRange, formatDateTime, formatDate };

export const AGENT_NAMES: Record<string, string> = {
  frontdesk: "Front Desk",
  claimsofficer: "Claims Officer",
  assessor: "Assessor",
  fraudanalyst: "Fraud Analyst",
  seniorreviewer: "Senior Reviewer",
  finance: "Finance",
  assessor_vision: "Assessor (Vision)",
  image_analyzer: "Image Analyzer",
};

export const STAGE_NAMES: Record<string, string> = {
  FNOL_SUBMITTED: "FNOL Submitted",
  FRONTDESK_DONE: "Front Desk Review",
  COVERAGE_DONE: "Coverage Verified",
  ASSESSMENT_DONE: "Assessment Complete",
  FRAUD_DONE: "Fraud Check Complete",
  PENDING_REVIEW: "Pending Review",
  FINAL_DECISION_DONE: "Decision Made",
  PAID: "Paid",
  CLOSED_NO_PAY: "Closed (No Pay)",
};

export const STATUS_NAMES: Record<string, string> = {
  RUNNING: "Running",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
};

export const EVENT_TYPE_NAMES: Record<string, string> = {
  STAGE_STARTED: "Stage Started",
  STAGE_COMPLETED: "Stage Completed",
  STAGE_ERROR: "Stage Error",
  CLAIM_CREATED: "Claim Created",
  SCHEMA_VALIDATION_FAILED: "Validation Failed",
  REVIEWER_DECISION: "Reviewer Decision",
};

export function agentName(id: string): string {
  return AGENT_NAMES[id] ?? id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function stageName(stage: string): string {
  return STAGE_NAMES[stage] ?? stage.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function statusName(status: string): string {
  return STATUS_NAMES[status] ?? status;
}

export function eventTypeName(type: string): string {
  return EVENT_TYPE_NAMES[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
