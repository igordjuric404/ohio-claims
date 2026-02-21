import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const __dirname = new URL(".", import.meta.url).pathname;
const OUT_DIR = join(__dirname, "outputs");
const REPORT_PATH = join(__dirname, "validation-report.json");

type Issue = {
  severity: "error" | "warning" | "info";
  agent: string;
  field?: string;
  message: string;
};

type TestResult = {
  test_case: string;
  claim_id: string;
  pipeline_duration: string;
  final_stage: string;
  stages_completed: string[];
  errors: string[];
  agents_validated: string[];
  issues: Issue[];
  cross_agent_issues: Issue[];
  score: number;
};

const REQUIRED_STAGES = ["FRONTDESK_DONE", "COVERAGE_DONE", "ASSESSMENT_DONE", "FRAUD_DONE", "PENDING_REVIEW"];

const AGENT_REQUIRED_FIELDS: Record<string, string[]> = {
  frontdesk: ["triage_category", "missing_items", "compliance", "confidence"],
  claimsofficer: ["coverage_status", "proof_of_loss_needed", "compliance", "confidence"],
  assessor: ["repair_estimate_low", "repair_estimate_high", "total_loss_recommended", "tax_reimbursement_eligible", "compliance", "confidence"],
  fraudanalyst: ["risk_score", "flags", "recommendation", "compliance", "confidence"],
};

function validateAgentOutput(agentId: string, output: Record<string, unknown>): Issue[] {
  const issues: Issue[] = [];
  const required = AGENT_REQUIRED_FIELDS[agentId] ?? [];

  for (const field of required) {
    const val = output[field];
    if (val === undefined || val === null) {
      issues.push({ severity: "error", agent: agentId, field, message: `Missing required field: ${field}` });
    } else if (typeof val === "string" && val.trim() === "") {
      issues.push({ severity: "error", agent: agentId, field, message: `Empty string for required field: ${field}` });
    }
  }

  if (agentId === "frontdesk") {
    const cat = output.triage_category as string;
    if (cat && !["fast_track", "standard", "complex"].includes(cat)) {
      issues.push({ severity: "error", agent: agentId, field: "triage_category", message: `Invalid triage_category: ${cat}` });
    }
    const conf = output.confidence as number;
    if (typeof conf === "number" && (conf < 0 || conf > 1)) {
      issues.push({ severity: "error", agent: agentId, field: "confidence", message: `Confidence out of range: ${conf}` });
    }
  }

  if (agentId === "claimsofficer") {
    const status = output.coverage_status as string;
    if (status && !["covered", "denied", "need_more_info"].includes(status)) {
      issues.push({ severity: "error", agent: agentId, field: "coverage_status", message: `Invalid coverage_status: ${status}` });
    }
    const ded = output.deductible as number;
    if (typeof ded === "number" && ded < 0) {
      issues.push({ severity: "error", agent: agentId, field: "deductible", message: `Negative deductible: ${ded}` });
    }
    const conf = output.confidence as number;
    if (typeof conf === "number" && (conf < 0 || conf > 1)) {
      issues.push({ severity: "error", agent: agentId, field: "confidence", message: `Confidence out of range: ${conf}` });
    }
  }

  if (agentId === "assessor") {
    const low = output.repair_estimate_low as number;
    const high = output.repair_estimate_high as number;
    if (typeof low === "number" && typeof high === "number") {
      if (low > high) {
        issues.push({ severity: "error", agent: agentId, field: "repair_estimate", message: `Low estimate (${low}) > high estimate (${high})` });
      }
      if (low < 0 || high < 0) {
        issues.push({ severity: "error", agent: agentId, field: "repair_estimate", message: `Negative estimate: low=${low}, high=${high}` });
      }
      if (high > 200000) {
        issues.push({ severity: "warning", agent: agentId, field: "repair_estimate", message: `Unusually high estimate: $${high}` });
      }
    }
    const sources = output.pricing_sources as string[];
    if (Array.isArray(sources)) {
      if (sources.length === 0) {
        issues.push({ severity: "warning", agent: agentId, field: "pricing_sources", message: "No pricing sources provided" });
      }
      for (const s of sources) {
        if (typeof s === "string" && !s.startsWith("http")) {
          issues.push({ severity: "info", agent: agentId, field: "pricing_sources", message: `Non-URL source: ${s.substring(0, 80)}` });
        }
      }
    }
  }

  if (agentId === "fraudanalyst") {
    const score = output.risk_score as number;
    if (typeof score === "number" && (score < 0 || score > 100)) {
      issues.push({ severity: "error", agent: agentId, field: "risk_score", message: `Score out of [0,100] range: ${score}` });
    }
    const rec = output.recommendation as string;
    if (rec && !["normal", "enhanced_review", "siu_referral"].includes(rec)) {
      issues.push({ severity: "warning", agent: agentId, field: "recommendation", message: `Unexpected recommendation: ${rec}` });
    }
    const flags = output.flags as unknown[];
    if (Array.isArray(flags)) {
      for (const f of flags) {
        if (typeof f !== "string") {
          issues.push({ severity: "error", agent: agentId, field: "flags", message: `Non-string flag: ${typeof f}` });
        }
      }
    }
  }

  // Check compliance sub-object
  const compliance = output.compliance as Record<string, unknown> | undefined;
  if (compliance) {
    if (compliance.deadlines_met === undefined) {
      issues.push({ severity: "warning", agent: agentId, field: "compliance.deadlines_met", message: "Missing deadlines_met in compliance" });
    }
  } else if (required.includes("compliance")) {
    issues.push({ severity: "error", agent: agentId, field: "compliance", message: "Missing compliance object" });
  }

  return issues;
}

function crossAgentChecks(agentOutputs: Record<string, any>): Issue[] {
  const issues: Issue[] = [];

  const assessor = agentOutputs.assessor?.output;
  const fraudanalyst = agentOutputs.fraudanalyst?.output;
  const claimsofficer = agentOutputs.claimsofficer?.output;

  if (assessor && claimsofficer) {
    const high = assessor.repair_estimate_high as number;
    const limit = claimsofficer.limits as number;
    if (typeof high === "number" && typeof limit === "number" && high > limit) {
      issues.push({ severity: "warning", agent: "cross-agent", message: `Repair estimate ($${high}) exceeds coverage limit ($${limit})` });
    }
  }

  if (assessor && fraudanalyst) {
    const totalLoss = assessor.total_loss_recommended as boolean;
    const fraudScore = fraudanalyst.fraud_risk_score as number;
    if (totalLoss && typeof fraudScore === "number" && fraudScore < 0.3) {
      issues.push({ severity: "info", agent: "cross-agent", message: "Total loss recommended but low fraud risk — consistent" });
    }
  }

  if (assessor) {
    const components = assessor.damaged_components as string[];
    const notes = assessor.assessment_notes as string;
    if (Array.isArray(components) && components.length > 0 && typeof notes === "string") {
      for (const comp of components) {
        if (!notes.toLowerCase().includes(comp.toLowerCase().split(" ")[0])) {
          issues.push({ severity: "info", agent: "cross-agent", field: comp, message: `Component "${comp}" listed but not mentioned in assessment_notes` });
        }
      }
    }
  }

  return issues;
}

function processFile(filename: string): TestResult {
  const raw = JSON.parse(readFileSync(join(OUT_DIR, filename), "utf-8"));
  const pipeline = raw.pipeline_result ?? {};
  const detail = raw.reviewer_detail ?? {};
  const agentOutputs = detail.agent_outputs ?? {};

  const issues: Issue[] = [];
  const agentsValidated: string[] = [];

  // Validate each agent's output
  for (const [agentId, data] of Object.entries(agentOutputs) as [string, any][]) {
    if (!data?.output) {
      issues.push({ severity: "error", agent: agentId, message: "Agent has no output" });
      continue;
    }
    agentsValidated.push(agentId);
    issues.push(...validateAgentOutput(agentId, data.output));
  }

  // Pipeline-level checks
  const stagesCompleted = pipeline.stages_completed ?? [];
  for (const stage of REQUIRED_STAGES) {
    if (!stagesCompleted.includes(stage)) {
      issues.push({ severity: "error", agent: "pipeline", message: `Stage not completed: ${stage}` });
    }
  }

  const crossIssues = crossAgentChecks(agentOutputs);

  const errorCount = issues.filter(i => i.severity === "error").length;
  const warnCount = issues.filter(i => i.severity === "warning").length;
  const score = Math.max(0, 100 - errorCount * 15 - warnCount * 5);

  return {
    test_case: raw.test_case,
    claim_id: raw.claim_id,
    pipeline_duration: raw.pipeline_duration,
    final_stage: pipeline.final_stage ?? "unknown",
    stages_completed: stagesCompleted,
    errors: pipeline.errors ?? [],
    agents_validated: agentsValidated,
    issues,
    cross_agent_issues: crossIssues,
    score,
  };
}

// Main
const files = readdirSync(OUT_DIR).filter(f => f.endsWith(".json"));
const results: TestResult[] = files.map(processFile);

const summary = {
  total_tests: results.length,
  passed: results.filter(r => r.final_stage === "PENDING_REVIEW").length,
  failed: results.filter(r => r.final_stage !== "PENDING_REVIEW").length,
  avg_score: Math.round(results.reduce((s, r) => s + r.score, 0) / results.length),
  results,
};

writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2));
console.log(`\n=== VALIDATION REPORT ===`);
console.log(`Tests: ${summary.total_tests} | Passed: ${summary.passed} | Failed: ${summary.failed} | Avg Score: ${summary.avg_score}/100\n`);

for (const r of results) {
  const status = r.final_stage === "PENDING_REVIEW" ? "✅" : "❌";
  console.log(`${status} ${r.test_case} (${r.pipeline_duration}) — Score: ${r.score}/100`);
  console.log(`   Stage: ${r.final_stage} | Agents: ${r.agents_validated.join(", ") || "none"}`);
  if (r.errors.length > 0) console.log(`   Pipeline Errors: ${r.errors.join("; ")}`);
  const errors = r.issues.filter(i => i.severity === "error");
  const warnings = r.issues.filter(i => i.severity === "warning");
  if (errors.length > 0) console.log(`   Errors (${errors.length}): ${errors.map(e => e.message).join("; ")}`);
  if (warnings.length > 0) console.log(`   Warnings (${warnings.length}): ${warnings.map(w => w.message).join("; ")}`);
  if (r.cross_agent_issues.length > 0) console.log(`   Cross-Agent: ${r.cross_agent_issues.map(c => c.message).join("; ")}`);
  console.log();
}

console.log(`Full report: ${REPORT_PATH}`);
