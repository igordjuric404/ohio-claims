import { runAgent, loadSystemPrompt, type AgentCallOptions } from "./client.js";
import * as db from "../storage/index.js";
import type { JudgeOutput, JudgeRound, JudgeReport, JudgeVerdict, MetaJudgeOutput } from "@ohio-claims/shared";

const MAX_REVISION_ROUNDS = 2;

const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "google/gemini-2.0-flash-001";

function extractJson(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  return JSON.parse(cleaned);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max) + "... [truncated]" : s;
}

function buildJudgePrompt(
  agentId: string,
  claimData: unknown,
  producerOutput: unknown,
  reasoning?: string,
): string {
  const parts = [
    `## Producer Agent: ${agentId}`,
    `## Claim Data (Input)\n${JSON.stringify(claimData, null, 2)}`,
    `## Producer Output\n${JSON.stringify(producerOutput, null, 2)}`,
  ];

  if (reasoning) {
    parts.push(`## Producer Reasoning\n${reasoning}`);
  }

  parts.push("Evaluate this output against your rubric. Return ONLY valid JSON matching your output schema.");

  return parts.join("\n\n");
}

function buildMetaJudgePrompt(
  producerOutput: unknown,
  judgeOutput: JudgeOutput,
  claimData: unknown,
): string {
  return [
    `## Producer Output\n${JSON.stringify(producerOutput, null, 2)}`,
    `## Judge Evaluation\n${JSON.stringify(judgeOutput, null, 2)}`,
    `## Claim Data\n${truncate(JSON.stringify(claimData, null, 2), 3000)}`,
    "Audit this judge evaluation. Return ONLY valid JSON matching your output schema.",
  ].join("\n\n");
}

async function callJudge(
  agentId: string,
  claimData: unknown,
  producerOutput: unknown,
  reasoning?: string,
): Promise<JudgeOutput> {
  const prompt = buildJudgePrompt(agentId, claimData, producerOutput, reasoning);
  const systemPrompt = loadSystemPrompt("judge");

  const response = await runAgent("judge", prompt, undefined, {
    model: JUDGE_MODEL,
    enableReasoning: true,
  });

  const parsed = extractJson(response.text) as JudgeOutput;

  if (!parsed.verdict || !parsed.scores) {
    throw new Error("Judge returned invalid structure");
  }

  return parsed;
}

async function callMetaJudge(
  producerOutput: unknown,
  judgeOutput: JudgeOutput,
  claimData: unknown,
): Promise<MetaJudgeOutput> {
  const prompt = buildMetaJudgePrompt(producerOutput, judgeOutput, claimData);
  const systemPrompt = loadSystemPrompt("metajudge");

  const response = await runAgent("metajudge", prompt, undefined, {
    model: JUDGE_MODEL,
  });

  const parsed = extractJson(response.text) as MetaJudgeOutput;
  return parsed;
}

function determineEffectiveVerdict(
  judgeOutput: JudgeOutput,
  metaOutput?: MetaJudgeOutput,
): JudgeVerdict {
  if (metaOutput?.meta_verdict === "override" && metaOutput.override_verdict) {
    return metaOutput.override_verdict;
  }
  return judgeOutput.verdict;
}

export type JudgeStageResult = {
  report: JudgeReport;
  accepted: boolean;
};

export async function judgeProducerOutput(
  agentId: string,
  claimId: string,
  claimData: unknown,
  producerOutput: unknown,
  reasoning?: string,
  runId?: string,
): Promise<JudgeStageResult> {
  const rounds: JudgeRound[] = [];
  let currentOutput = producerOutput;
  let finalVerdict: JudgeVerdict = "fail";
  let finalScores = { groundedness: 0, correctness: 0, completeness: 0, consistency: 0, safety: 0, quality: 0 };

  for (let round = 1; round <= MAX_REVISION_ROUNDS + 1; round++) {
    let judgeOutput: JudgeOutput;
    try {
      judgeOutput = await callJudge(agentId, claimData, currentOutput, reasoning);
    } catch (err: any) {
      judgeOutput = {
        verdict: "pass",
        scores: { groundedness: 3, correctness: 3, completeness: 3, consistency: 3, safety: 3, quality: 3 },
        bullshit_flags: [],
        required_fixes: [],
        optional_suggestions: [`Judge evaluation failed: ${err.message}. Defaulting to pass.`],
        evidence: [],
        confidence: 0.2,
      };
    }

    let metaOutput: MetaJudgeOutput | undefined;
    try {
      metaOutput = await callMetaJudge(currentOutput, judgeOutput, claimData);
    } catch {
      // Meta-judge failure is non-blocking
    }

    const effectiveVerdict = determineEffectiveVerdict(judgeOutput, metaOutput);

    rounds.push({
      round,
      producer_output: currentOutput,
      judge_output: judgeOutput,
      meta_judge_output: metaOutput,
      effective_verdict: effectiveVerdict,
    });

    finalVerdict = effectiveVerdict;
    finalScores = judgeOutput.scores;

    if (runId) {
      await db.putRunEvent({
        run_id: runId,
        seq: 100 + round,
        ts: new Date().toISOString(),
        event_type: "judge.round",
        payload: {
          round,
          agent_id: agentId,
          verdict: effectiveVerdict,
          scores: judgeOutput.scores,
          bullshit_flags: judgeOutput.bullshit_flags,
          required_fixes: judgeOutput.required_fixes,
          optional_suggestions: judgeOutput.optional_suggestions,
          evidence: judgeOutput.evidence,
          confidence: judgeOutput.confidence,
          meta_verdict: metaOutput?.meta_verdict,
          meta_override: metaOutput?.override_verdict,
          meta_judge_quality_score: metaOutput?.judge_quality_score,
          meta_issues: metaOutput?.issues,
          meta_confidence: metaOutput?.confidence,
        },
      });
    }

    if (effectiveVerdict === "pass") break;
    if (round > MAX_REVISION_ROUNDS) break;

    // Don't re-run the producer; the judge report becomes advisory
    // for the human reviewer to evaluate
  }

  const report: JudgeReport = {
    agent_id: agentId,
    rounds,
    final_verdict: finalVerdict,
    final_scores: finalScores,
    total_rounds: rounds.length,
  };

  return { report, accepted: finalVerdict === "pass" };
}
