import { useState, useEffect } from "react";
import { reviewerApi } from "../api";
import { stageName, agentName, fieldLabel, formatFieldValue, formatCurrencyRange } from "../../admin/displayNames";
import { formatDateTime } from "../../lib/fieldLabels";

type Props = {
  claimId: string;
  onBack: () => void;
};

const AGENT_ORDER = ["frontdesk", "claimsofficer", "assessor", "fraudanalyst"];

const AGENT_DESCRIPTIONS: Record<string, string> = {
  frontdesk: "Performs initial triage, checks for missing documentation, and sets compliance deadlines.",
  claimsofficer: "Verifies coverage eligibility, checks policy terms, deductibles, and coverage limits.",
  assessor: "Evaluates vehicle damage, estimates repair costs, and determines if total loss applies.",
  fraudanalyst: "Analyzes claim for fraud indicators, assigns risk score, and recommends further action.",
};

const COMPLIANCE_FIELDS = ["deadlines_met", "next_required_action", "ack_due_at", "accept_deny_deadline", "estimate_provided", "fraud_report_due_at", "all_stages_complete"];

function isComplianceField(key: string): boolean {
  return key === "compliance" || COMPLIANCE_FIELDS.includes(key);
}

function AgentSection({ agentId, data }: { agentId: string; data: { input?: string; output?: any; reasoning?: string } }) {
  const output = data.output;

  const mainFields: [string, unknown][] = [];
  const complianceFields: [string, unknown][] = [];

  if (output && typeof output === "object") {
    for (const [k, v] of Object.entries(output)) {
      if (k === "compliance" && typeof v === "object" && v !== null) {
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

      {/* Damage photos */}
      {photos.length > 0 && (
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
      )}

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
