import { useState, useEffect } from "react";
import { reviewerApi } from "../api";
import { stageName, agentName, fieldLabel, formatFieldValue, formatCurrencyRange } from "../../admin/displayNames";
import { formatDateTime } from "../../lib/fieldLabels";

type Props = {
  claimId: string;
  onBack: () => void;
};

const AGENT_ORDER = ["frontdesk", "claimsofficer", "image_analyzer", "assessor", "fraudanalyst"];

type JudgeEvidence = {
  field: string;
  issue: string;
  expected?: string;
};

type JudgeRoundData = {
  round: number;
  agent_id: string;
  verdict: string;
  scores: Record<string, number>;
  bullshit_flags?: string[];
  required_fixes?: string[];
  optional_suggestions?: string[];
  evidence?: JudgeEvidence[];
  confidence?: number;
  meta_verdict?: string;
  meta_override?: string | null;
  meta_judge_quality_score?: number;
  meta_issues?: string[];
  meta_confidence?: number;
};

type JudgePayload = JudgeRoundData & {
  total_rounds?: number;
  rounds?: JudgeRoundData[];
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  frontdesk: "Performs initial triage, checks for missing documentation, and sets compliance deadlines.",
  claimsofficer: "Verifies coverage eligibility, checks policy terms, deductibles, and coverage limits.",
  image_analyzer: "Analyzes uploaded damage photos using AI vision to identify damaged components and severity.",
  assessor: "Researches current parts prices and labor rates, then estimates repair costs.",
  fraudanalyst: "Analyzes claim for fraud indicators, assigns risk score, and recommends further action.",
};

const COMPLIANCE_FIELDS = ["deadlines_met", "next_required_action", "ack_due_at", "accept_deny_deadline", "estimate_provided", "fraud_report_due_at", "all_stages_complete"];

function isComplianceField(key: string): boolean {
  return key === "compliance" || COMPLIANCE_FIELDS.includes(key);
}

function extractUrlAndLabel(source: string): { url: string; label: string } | null {
  const match = source.match(/^(https?:\/\/[^\s]+?)(?:\s+[—–-]\s+(.+))?$/);
  if (!match) return null;
  const url = match[1];
  const title = match[2];
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return { url, label: title || hostname };
  } catch {
    return { url, label: title || url };
  }
}

function PricingSourcesPanel({ sources }: { sources: string[] }) {
  const links = sources.map(extractUrlAndLabel).filter(Boolean) as { url: string; label: string }[];
  const nonLinks = sources.filter(s => !extractUrlAndLabel(s));

  if (links.length === 0 && nonLinks.length === 0) return null;

  return (
    <div className="pricing-sources-panel">
      <div className="pricing-sources-header">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="pricing-sources-icon">
          <path d="M6.354 2.146a.5.5 0 010 .708L3.707 5.5H11a4.5 4.5 0 010 9H8a.5.5 0 010-1h3a3.5 3.5 0 000-7H3.707l2.647 2.646a.5.5 0 11-.708.708l-3.5-3.5a.5.5 0 010-.708l3.5-3.5a.5.5 0 01.708 0z" fill="currentColor"/>
        </svg>
        <span>Pricing Sources ({links.length} verified)</span>
      </div>
      <div className="pricing-sources-list">
        {links.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="pricing-source-link"
          >
            <span className="pricing-source-favicon">
              <img
                src={`https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=16`}
                alt=""
                width="16"
                height="16"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </span>
            <span className="pricing-source-label">{link.label}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="pricing-source-external">
              <path d="M3.5 1.5h7v7M10 2L4.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        ))}
      </div>
      {nonLinks.length > 0 && (
        <div className="pricing-sources-notes">
          {nonLinks.map((n, i) => <p key={i} className="pricing-source-note">{n}</p>)}
        </div>
      )}
    </div>
  );
}

function confidenceLevel(value: number): "low" | "mid" | "high" {
  if (value < 0.4) return "low";
  if (value < 0.7) return "mid";
  return "high";
}

function verdictLabel(v: string): string {
  return v === "pass" ? "Verified" : v === "revise" ? "Needs Revision" : "Failed";
}

function verdictCss(v: string): string {
  return v === "pass" ? "judge-pass" : v === "revise" ? "judge-revise" : "judge-fail";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / 5) * 100);
  const cls = value >= 4 ? "score-good" : value >= 2 ? "score-mid" : "score-bad";
  return (
    <div className="judge-score-bar-item">
      <div className="judge-score-bar-label">
        <span>{label}</span>
        <span className={cls}>{value}/5</span>
      </div>
      <div className="judge-score-bar-track">
        <div className={`judge-score-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function JudgeRoundDetail({ round }: { round: JudgeRoundData }) {
  return (
    <div className="judge-round-detail">
      {round.evidence && round.evidence.length > 0 && (
        <div className="judge-evidence-section">
          <h5>Evidence</h5>
          <table className="judge-evidence-table">
            <thead>
              <tr><th>Field</th><th>Finding</th><th>Expected</th></tr>
            </thead>
            <tbody>
              {round.evidence.map((e, i) => (
                <tr key={i}>
                  <td className="monospace">{e.field}</td>
                  <td>{e.issue}</td>
                  <td className="muted">{e.expected ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {round.optional_suggestions && round.optional_suggestions.length > 0 && (
        <div className="judge-suggestions">
          <h5>Suggestions</h5>
          <ul>
            {round.optional_suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      {round.meta_verdict && (
        <div className="judge-meta-section">
          <h5>Meta-Judge Audit</h5>
          <div className="judge-meta-row">
            <span className={`judge-meta-badge ${round.meta_verdict === "affirm" ? "meta-affirm" : "meta-override"}`}>
              {round.meta_verdict === "affirm" ? "Affirmed" : `Override → ${verdictLabel(round.meta_override ?? "")}`}
            </span>
            {round.meta_judge_quality_score != null && (
              <span className="judge-meta-quality">Judge Quality: {round.meta_judge_quality_score}/5</span>
            )}
            {round.meta_confidence != null && (
              <span className="muted">Confidence: {(round.meta_confidence * 100).toFixed(0)}%</span>
            )}
          </div>
          {round.meta_issues && round.meta_issues.length > 0 && (
            <ul className="judge-meta-issues">
              {round.meta_issues.map((iss, i) => <li key={i}>{iss}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function JudgeVerdict({ judge }: { judge: JudgePayload }) {
  const cls = verdictCss(judge.verdict);
  const scores = judge.scores ?? {};
  const scoreValues = Object.values(scores);
  const avgScore = scoreValues.length > 0
    ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)
    : "—";
  const rounds = judge.rounds ?? [judge];
  const hasMultipleRounds = rounds.length > 1;

  return (
    <div className={`judge-verdict-panel ${cls}`}>
      <div className="judge-verdict-header">
        <div className="judge-verdict-left">
          <span className={`judge-verdict-badge ${cls}`}>{verdictLabel(judge.verdict)}</span>
          <span className="judge-avg-score">{avgScore}/5</span>
          {judge.confidence != null && (
            <span className="judge-confidence">{(judge.confidence * 100).toFixed(0)}% confident</span>
          )}
        </div>
        {judge.total_rounds != null && (
          <span className="judge-rounds-count">{judge.total_rounds} round{judge.total_rounds > 1 ? "s" : ""}</span>
        )}
      </div>

      <div className="judge-scores-grid">
        {Object.entries(scores).map(([k, v]) => (
          <ScoreBar key={k} label={k} value={v} />
        ))}
      </div>

      {judge.bullshit_flags && judge.bullshit_flags.length > 0 && (
        <div className="judge-flags">
          <span className="judge-flags-label">Issues Found:</span>
          {judge.bullshit_flags.map((f, i) => (
            <span key={i} className="judge-flag-item">{f}</span>
          ))}
        </div>
      )}

      {judge.required_fixes && judge.required_fixes.length > 0 && (
        <div className="judge-fixes">
          <span className="judge-flags-label">Required Fixes:</span>
          <ul className="judge-fixes-list">
            {judge.required_fixes.map((fix, i) => <li key={i}>{fix}</li>)}
          </ul>
        </div>
      )}

      <JudgeRoundDetail round={rounds[rounds.length - 1]} />

      {hasMultipleRounds && (
        <details className="judge-history">
          <summary>Revision History ({rounds.length} rounds)</summary>
          {rounds.slice(0, -1).reverse().map((r) => (
            <div key={r.round} className="judge-history-round">
              <div className="judge-history-round-header">
                <span className={`judge-verdict-badge-sm ${verdictCss(r.verdict)}`}>
                  Round {r.round}: {verdictLabel(r.verdict)}
                </span>
              </div>
              <JudgeRoundDetail round={r} />
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function AgentSection({ agentId, data, judge }: { agentId: string; data: { input?: string; output?: any; reasoning?: string }; judge?: JudgePayload }) {
  const output = data.output;

  const mainFields: [string, unknown][] = [];
  const complianceFields: [string, unknown][] = [];
  let pricingSources: string[] | null = null;

  if (output && typeof output === "object") {
    for (const [k, v] of Object.entries(output)) {
      if (k === "pricing_sources" && Array.isArray(v) && v.length > 0) {
        pricingSources = v as string[];
      } else if (k === "image_descriptions" || k === "overall_assessment") {
        // Rendered in the DamagePhotosWithDescriptions section
      } else if (k === "compliance" && typeof v === "object" && v !== null) {
        for (const [ck, cv] of Object.entries(v as Record<string, unknown>)) {
          complianceFields.push([ck, cv]);
        }
      } else if (k === "repair_estimate_high") {
        // Displayed as part of repair_estimate_low range
      } else if (!isComplianceField(k)) {
        mainFields.push([k, v]);
      }
    }
  }

  return (
    <section className="reviewer-agent-section">
      <div className="agent-section-header">
        <h3>{agentName(agentId)}</h3>
        <p className="agent-description">{AGENT_DESCRIPTIONS[agentId] ?? ""}</p>
      </div>

      {judge && <JudgeVerdict judge={judge} />}

      {data.reasoning && (
        <div className="agent-reasoning">
          <h4>Reasoning</h4>
          <div className="reasoning-content">{data.reasoning}</div>
        </div>
      )}

      {mainFields.length > 0 && (
        <div className="agent-outputs">
          <h4>Findings</h4>
          <div className="agent-output-grid">
            {mainFields.map(([k, v]) => (
              <div key={k} className={`agent-output-item${k === "confidence" && typeof v === "number" ? ` confidence-${confidenceLevel(v)}` : ""}`}>
                <span className="output-label">
                  {k === "repair_estimate_low" ? "Repair Estimate Range" : fieldLabel(k)}
                </span>
                <span className="output-value">
                  {k === "repair_estimate_low" && output?.repair_estimate_high != null
                    ? formatCurrencyRange(v as number, output.repair_estimate_high as number)
                    : typeof v === "object" && v !== null
                    ? Array.isArray(v)
                      ? v.length > 0
                        ? v.map(item => typeof item === "object" ? JSON.stringify(item) : String(item)).join(", ")
                        : "None"
                      : JSON.stringify(v, null, 2)
                    : formatFieldValue(k, v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pricingSources && <PricingSourcesPanel sources={pricingSources} />}

      {complianceFields.length > 0 && (
        <details className="agent-compliance">
          <summary>Compliance Details</summary>
          <div className="agent-output-grid">
            {complianceFields.map(([k, v]) => (
              <div key={k} className="agent-output-item">
                <span className="output-label">{fieldLabel(k)}</span>
                <span className="output-value">{formatFieldValue(k, v)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {data.input && (
        <details className="agent-input-details">
          <summary>Agent Input</summary>
          <pre className="agent-input-pre">{data.input}</pre>
        </details>
      )}
    </section>
  );
}

const TERMINAL_STAGES = new Set(["PENDING_REVIEW", "FINAL_DECISION_DONE", "PAID", "CLOSED_NO_PAY"]);

function DecisionPanel({ claimId, currentStage, onDecisionMade, assessorRange }: {
  claimId: string;
  currentStage: string;
  onDecisionMade: () => void;
  assessorRange?: string;
}) {
  const [decision, setDecision] = useState<"approve" | "deny" | "">("");
  const [rationale, setRationale] = useState("");
  const [amountCap, setAmountCap] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  const pipelineRunning = !TERMINAL_STAGES.has(currentStage as any);

  if (currentStage === "PAID" || currentStage === "CLOSED_NO_PAY" || currentStage === "FINAL_DECISION_DONE") {
    return (
      <div className="decision-panel decision-panel-decided">
        <h3>Decision</h3>
        <div className={`decision-badge ${currentStage === "PAID" ? "decision-approved" : "decision-denied"}`}>
          {stageName(currentStage)}
        </div>
      </div>
    );
  }

  if (pipelineRunning) {
    return (
      <div className="decision-panel">
        <h3>Current Stage</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span className="spinner" style={{ display: "inline-block", width: 18, height: 18, border: "2.5px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
          <div>
            <div className={`status-badge stage-${currentStage.toLowerCase().replace(/_/g, "-")}`} style={{ display: "inline-block" }}>
              {stageName(currentStage)}
            </div>
            <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
              AI pipeline is processing — this will update automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!decision) return;
    if (!rationale.trim()) {
      setError("Please provide a rationale for your decision.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await reviewerApi.submitDecision(claimId, {
        decision,
        rationale: rationale.trim(),
        approve_amount_cap: amountCap ? Number(amountCap) : undefined,
      });
      setResult(res);
      onDecisionMade();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="decision-panel decision-panel-complete">
        <h3>Decision Submitted</h3>
        <div className={`decision-badge ${result.decision?.final_outcome === "approve" ? "decision-approved" : "decision-denied"}`}>
          {formatFieldValue("final_outcome", result.decision?.final_outcome)}
        </div>
        <p className="muted">Final stage: {stageName(result.final_stage ?? "")}</p>
      </div>
    );
  }

  return (
    <div className="decision-panel">
      <h3>Your Decision</h3>
      <p className="decision-instruction">
        Review all agent findings above, then approve or deny this claim.
      </p>

      {error && <div className="pipeline-error">{error}</div>}

      <div className="decision-buttons">
        <button
          className={`btn decision-btn ${decision === "approve" ? "decision-btn-active-approve" : "btn-secondary"}`}
          onClick={() => setDecision("approve")}
        >
          Approve
        </button>
        <button
          className={`btn decision-btn ${decision === "deny" ? "decision-btn-active-deny" : "btn-secondary"}`}
          onClick={() => setDecision("deny")}
        >
          Deny
        </button>
      </div>

      {decision === "approve" && (
        <div className="form-group" style={{ marginTop: "0.75rem" }}>
          <label>Approved Amount Cap (optional)</label>
          <input
            type="number"
            placeholder={assessorRange ? `e.g. ${assessorRange}` : "e.g. 15000"}
            value={amountCap}
            onChange={(e) => setAmountCap(e.target.value)}
          />
        </div>
      )}

      <div className="form-group" style={{ marginTop: "0.75rem" }}>
        <label>Rationale *</label>
        <textarea
          rows={4}
          placeholder="Explain your reasoning for this decision..."
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
        />
      </div>

      <button
        className="btn btn-primary"
        disabled={!decision || !rationale.trim() || submitting}
        onClick={handleSubmit}
        style={{ marginTop: "0.75rem" }}
      >
        {submitting ? "Submitting..." : `Submit ${decision === "approve" ? "Approval" : decision === "deny" ? "Denial" : "Decision"}`}
      </button>
    </div>
  );
}

type ImageDescription = {
  image_index?: number;
  filename?: string;
  description: string;
  damaged_parts?: string[];
  severity?: string;
};

function DamagePhotosWithDescriptions({
  photos,
  imageDescriptions,
  overallAssessment,
}: {
  photos: { key: string; filename: string; url: string }[];
  imageDescriptions: ImageDescription[];
  overallAssessment?: string;
}) {
  const descByFilename = new Map<string, ImageDescription>();
  const descByIndex = new Map<number, ImageDescription>();
  for (const desc of imageDescriptions) {
    if (desc.filename) descByFilename.set(desc.filename, desc);
    if (desc.image_index != null) descByIndex.set(desc.image_index, desc);
  }

  function getDescription(photo: { filename: string }, index: number): ImageDescription | undefined {
    return descByFilename.get(photo.filename) ?? descByIndex.get(index);
  }

  return (
    <div className="reviewer-photos card">
      <h3>Damage Photos ({photos.length})</h3>
      {overallAssessment && (
        <p className="photo-overall-assessment">{overallAssessment}</p>
      )}
      <div className="damage-photos-described">
        {photos.map((p, i) => {
          const desc = getDescription(p, i);
          return (
            <div key={p.key} className="damage-photo-card">
              <div className="damage-photo-image">
                <img src={p.url} alt={p.filename} loading="lazy" />
              </div>
              {desc ? (
                <div className="damage-photo-desc">
                  <p className="damage-photo-desc-text">{desc.description}</p>
                  {desc.damaged_parts && desc.damaged_parts.length > 0 && (
                    <div className="damage-photo-parts">
                      {desc.damaged_parts.map((part, j) => (
                        <span key={j} className="damage-part-tag">{part}</span>
                      ))}
                    </div>
                  )}
                  {desc.severity && (
                    <span className={`damage-severity-badge severity-${desc.severity}`}>
                      {desc.severity}
                    </span>
                  )}
                </div>
              ) : (
                <div className="damage-photo-desc">
                  <p className="damage-photo-desc-text muted">No AI description available</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewerClaimDetail({ claimId, onBack }: Props) {
  const [claim, setClaim] = useState<any>(null);
  const [agentOutputs, setAgentOutputs] = useState<Record<string, any>>({});
  const [judgeReports, setJudgeReports] = useState<Record<string, JudgePayload>>({});
  const [photos, setPhotos] = useState<{ key: string; filename: string; url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [detail, photoData] = await Promise.all([
        reviewerApi.getClaimDetail(claimId),
        reviewerApi.getClaimPhotos(claimId),
      ]);
      setClaim(detail.claim);
      setAgentOutputs(detail.agent_outputs ?? {});
      setJudgeReports(detail.judge_reports ?? {});
      setPhotos(photoData.photos ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [claimId]);

  useEffect(() => {
    if (!claim) return;
    const stage = claim.stage as string;
    if (stage === "PENDING_REVIEW" || stage === "PAID" || stage === "CLOSED_NO_PAY" || stage === "FINAL_DECISION_DONE") return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [claim?.stage]);

  if (loading) return <p className="muted">Loading claim details...</p>;
  if (error || !claim) return (
    <div>
      <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back</button>
      <div className="pipeline-error" style={{ marginTop: "1rem" }}>{error || "Claim not found"}</div>
    </div>
  );

  return (
    <div className="reviewer-claim-detail">
      <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back to Claims</button>

      <div className="reviewer-claim-header">
        <div>
          <h2>{claim.claim_id}</h2>
          <span className="muted">
            {claim.policy_id} · {formatDateTime(claim.created_at)}
          </span>
        </div>
        <span className={`status-badge stage-${(claim.stage ?? "").toLowerCase().replace(/_/g, "-")}`}>
          {stageName(claim.stage)}
        </span>
      </div>

      {claim.stage !== "PENDING_REVIEW" && claim.stage !== "PAID" && claim.stage !== "CLOSED_NO_PAY" && claim.stage !== "FINAL_DECISION_DONE" && (
        <div className="pipeline-running-banner" style={{ padding: "0.75rem 1rem", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="spinner" style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span>AI pipeline is running — this page will auto-update when each stage completes.</span>
        </div>
      )}

      {/* Claim summary card */}
      <div className="reviewer-claim-summary card">
        <div className="summary-grid">
          <div><span className="output-label">Claimant</span><span className="output-value">{claim.claimant?.full_name}</span></div>
          <div><span className="output-label">Phone</span><span className="output-value">{claim.claimant?.phone}</span></div>
          {claim.claimant?.email && <div><span className="output-label">Email</span><span className="output-value">{claim.claimant.email}</span></div>}
          <div><span className="output-label">Date of Loss</span><span className="output-value">{claim.loss?.date_of_loss}</span></div>
          {claim.loss?.city && <div><span className="output-label">City</span><span className="output-value">{claim.loss.city}</span></div>}
          {claim.vehicle && <div><span className="output-label">Vehicle</span><span className="output-value">{[claim.vehicle.year, claim.vehicle.make, claim.vehicle.model].filter(Boolean).join(" ") || "—"}</span></div>}
        </div>
        {claim.loss?.description && (
          <div className="summary-description">
            <span className="output-label">Description</span>
            <p>{claim.loss.description}</p>
          </div>
        )}
      </div>

      {/* Damage photos with AI descriptions */}
      {photos.length > 0 && (() => {
        const imageAnalyzerOutput = agentOutputs.image_analyzer?.output;
        const imageDescriptions: ImageDescription[] = imageAnalyzerOutput?.image_descriptions ?? [];
        const overallAssessment = imageAnalyzerOutput?.overall_assessment as string | undefined;

        return imageDescriptions.length > 0 ? (
          <DamagePhotosWithDescriptions
            photos={photos}
            imageDescriptions={imageDescriptions}
            overallAssessment={overallAssessment}
          />
        ) : (
          <div className="reviewer-photos card">
            <h3>Damage Photos ({photos.length})</h3>
            <div className="damage-photos-grid">
              {photos.map((p) => (
                <div key={p.key} className="damage-photo-thumb">
                  <img src={p.url} alt={p.filename} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Agent sections */}
      <div className="reviewer-agent-sections">
        {AGENT_ORDER.map((agentId) => {
          const data = agentOutputs[agentId];
          if (!data) return null;
          return <AgentSection key={agentId} agentId={agentId} data={data} judge={judgeReports[agentId]} />;
        })}
      </div>

      {/* Decision panel */}
      <DecisionPanel
        claimId={claimId}
        currentStage={claim.stage}
        onDecisionMade={fetchData}
        assessorRange={(() => {
          const out = agentOutputs.assessor?.output;
          const low = out?.repair_estimate_low;
          const high = out?.repair_estimate_high;
          if (typeof low === "number" && typeof high === "number") {
            return formatCurrencyRange(low, high);
          }
          return undefined;
        })()}
      />
    </div>
  );
}
