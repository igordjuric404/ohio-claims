import { createRequire } from "node:module";
import { compileSchema } from "../validate.js";
import type {
  FrontDeskOutput,
  ClaimsOfficerOutput,
  AssessorOutput,
  FraudAnalystOutput,
  SeniorReviewerOutput,
  FinanceOutput,
} from "../types.js";

const require = createRequire(import.meta.url);

function loadSchema(agentDir: string) {
  return require(`../../../../openclaw/agents/${agentDir}/OUTPUT_SCHEMA.json`);
}

export const validateFrontDesk = compileSchema<FrontDeskOutput>(loadSchema("frontdesk"));
export const validateClaimsOfficer = compileSchema<ClaimsOfficerOutput>(loadSchema("claimsofficer"));
export const validateAssessor = compileSchema<AssessorOutput>(loadSchema("assessor"));
export const validateFraudAnalyst = compileSchema<FraudAnalystOutput>(loadSchema("fraudanalyst"));
export const validateSeniorReviewer = compileSchema<SeniorReviewerOutput>(loadSchema("seniorreviewer"));
export const validateFinance = compileSchema<FinanceOutput>(loadSchema("finance"));

export const stageValidators: Record<string, (data: unknown) => { ok: boolean; errors?: unknown; data?: unknown }> = {
  FRONTDESK_DONE: validateFrontDesk,
  COVERAGE_DONE: validateClaimsOfficer,
  ASSESSMENT_DONE: validateAssessor,
  FRAUD_DONE: validateFraudAnalyst,
  FINAL_DECISION_DONE: validateSeniorReviewer,
  PAID: validateFinance,
};
