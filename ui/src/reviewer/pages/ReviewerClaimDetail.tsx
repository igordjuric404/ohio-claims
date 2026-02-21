import { useState, useEffect } from "react";
import { reviewerApi } from "../api";
import { stageName, agentName, fieldLabel, formatFieldValue, formatCurrencyRange } from "../../admin/displayNames";
import { formatDateTime } from "../../lib/fieldLabels";

type Props = {
  claimId: string;
  onBack: () => void;
};

const AGENT_ORDER = ["frontdesk", "claimsofficer", "image_analyzer", "assessor", "fraudanalyst"];

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

function AgentSection({ agentId, data }: { agentId: string; data: { input?: string; output?: any; reasoning?: string } }) {
  const output = data.output;

  const mainFields: [string, unknown][] = [];
  const complianceFields: [string, unknown][] = [];
  let pricingSources: string[] | null = null;

  if (output && typeof output === "object") {
    for (const [k, v] of Object.entries(output)) {
      if (k === "pricing_sources" && Array.isArray(v) && v.length > 0) {
        pricingSources = v as string[];
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
              <div key={k} className="agent-output-item">
                <span className="output-label">
                  {k === "repair_estimate_low" ? "Repair Estimate Range" : fieldLabel(k)}
                </span>
                <span className="output-value">
                  {k === "repair_estimate_low" && output?.repair_estimate_high != null
                    ? formatCurrencyRange(v as number, output.repair_estimate_high as number)
                    : typeof v === "object" && v !== null
                    ? Array.isArray(v)
                      ? (v as string[]).length > 0 ? (v as string[]).join(", ") : "None"
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

function DecisionPanel({ claimId, currentStage, onDecisionMade }: {
  claimId: string;
  currentStage: string;
  onDecisionMade: () => void;
}) {
  const [decision, setDecision] = useState<"approve" | "deny" | "">("");
  const [rationale, setRationale] = useState("");
  const [amountCap, setAmountCap] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  if (currentStage !== "PENDING_REVIEW") {
    return (
      <div className="decision-panel decision-panel-decided">
        <h3>Decision</h3>
        <div className={`decision-badge ${currentStage === "PAID" ? "decision-approved" : "decision-denied"}`}>
          {stageName(currentStage)}
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
            placeholder="e.g. 15000"
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
      setPhotos(photoData.photos ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [claimId]);

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
            {claim.claimant?.full_name} · {claim.policy_id} · {formatDateTime(claim.created_at)}
          </span>
        </div>
        <span className={`status-badge stage-${(claim.stage ?? "").toLowerCase().replace(/_/g, "-")}`}>
          {stageName(claim.stage)}
        </span>
      </div>

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
          return <AgentSection key={agentId} agentId={agentId} data={data} />;
        })}
      </div>

      {/* Decision panel */}
      <DecisionPanel
        claimId={claimId}
        currentStage={claim.stage}
        onDecisionMade={fetchData}
      />
    </div>
  );
}
