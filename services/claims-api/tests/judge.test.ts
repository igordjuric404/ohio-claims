import { describe, it, expect } from "vitest";
import type { JudgeOutput, JudgeReport, JudgeScores, MetaJudgeOutput } from "@ohio-claims/shared";

describe("Judge types and logic", () => {
  it("JudgeOutput structure is valid", () => {
    const output: JudgeOutput = {
      verdict: "pass",
      scores: { groundedness: 5, correctness: 4, completeness: 4, consistency: 5, safety: 5, quality: 4 },
      bullshit_flags: [],
      required_fixes: [],
      optional_suggestions: ["Minor: could add more detail"],
      evidence: [],
      confidence: 0.9,
    };
    expect(output.verdict).toBe("pass");
    expect(Object.keys(output.scores)).toHaveLength(6);
    expect(output.confidence).toBeGreaterThanOrEqual(0);
    expect(output.confidence).toBeLessThanOrEqual(1);
  });

  it("JudgeOutput with revise verdict includes required_fixes", () => {
    const output: JudgeOutput = {
      verdict: "revise",
      scores: { groundedness: 3, correctness: 2, completeness: 4, consistency: 3, safety: 5, quality: 3 },
      bullshit_flags: ["Repair estimate has no basis in the input data"],
      required_fixes: ["Repair estimate must be derived from damage description"],
      optional_suggestions: [],
      evidence: [{ field: "repair_estimate_low", issue: "Value appears fabricated", expected: "Derived from loss description" }],
      confidence: 0.7,
    };
    expect(output.verdict).toBe("revise");
    expect(output.required_fixes.length).toBeGreaterThan(0);
    expect(output.bullshit_flags.length).toBeGreaterThan(0);
    expect(output.evidence[0].field).toBe("repair_estimate_low");
  });

  it("JudgeReport aggregates multiple rounds", () => {
    const report: JudgeReport = {
      agent_id: "assessor",
      rounds: [
        {
          round: 1,
          producer_output: { repair_estimate_low: 500 },
          judge_output: {
            verdict: "revise",
            scores: { groundedness: 2, correctness: 3, completeness: 3, consistency: 4, safety: 5, quality: 3 },
            bullshit_flags: ["Estimate too low"],
            required_fixes: ["Recalculate with proper parts prices"],
            optional_suggestions: [],
            evidence: [],
            confidence: 0.6,
          },
          effective_verdict: "revise",
        },
        {
          round: 2,
          producer_output: { repair_estimate_low: 1500 },
          judge_output: {
            verdict: "pass",
            scores: { groundedness: 4, correctness: 4, completeness: 4, consistency: 4, safety: 5, quality: 4 },
            bullshit_flags: [],
            required_fixes: [],
            optional_suggestions: [],
            evidence: [],
            confidence: 0.85,
          },
          effective_verdict: "pass",
        },
      ],
      final_verdict: "pass",
      final_scores: { groundedness: 4, correctness: 4, completeness: 4, consistency: 4, safety: 5, quality: 4 },
      total_rounds: 2,
    };
    expect(report.total_rounds).toBe(2);
    expect(report.final_verdict).toBe("pass");
    expect(report.rounds[0].effective_verdict).toBe("revise");
    expect(report.rounds[1].effective_verdict).toBe("pass");
  });

  it("MetaJudgeOutput can override verdict", () => {
    const meta: MetaJudgeOutput = {
      meta_verdict: "override",
      override_verdict: "revise",
      judge_quality_score: 2,
      issues: ["Judge passed output with scores below 4, which violates pass criteria"],
      confidence: 0.8,
    };
    expect(meta.meta_verdict).toBe("override");
    expect(meta.override_verdict).toBe("revise");
    expect(meta.issues.length).toBeGreaterThan(0);
  });

  it("MetaJudgeOutput affirms when judging is fair", () => {
    const meta: MetaJudgeOutput = {
      meta_verdict: "affirm",
      override_verdict: null,
      judge_quality_score: 5,
      issues: [],
      confidence: 0.95,
    };
    expect(meta.meta_verdict).toBe("affirm");
    expect(meta.override_verdict).toBeNull();
  });

  it("JudgeScores all dimensions are 0-5", () => {
    const scores: JudgeScores = {
      groundedness: 0,
      correctness: 5,
      completeness: 3,
      consistency: 2,
      safety: 4,
      quality: 1,
    };
    for (const [, v] of Object.entries(scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});
