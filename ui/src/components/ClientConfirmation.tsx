import { useState, useEffect, useRef } from "react";
import { getClaim, type Claim } from "../api";
import { stageName } from "../admin/displayNames";

type Props = {
  claimId: string;
  onNewClaim: () => void;
};

const STAGE_PROGRESS: Record<string, { step: number; label: string }> = {
  FNOL_SUBMITTED: { step: 1, label: "Claim received — starting automated review" },
  FRONTDESK_DONE: { step: 2, label: "Initial triage complete" },
  COVERAGE_DONE: { step: 3, label: "Coverage verification complete" },
  ASSESSMENT_DONE: { step: 4, label: "Damage assessment complete" },
  FRAUD_DONE: { step: 5, label: "Fraud analysis complete" },
  PENDING_REVIEW: { step: 6, label: "Automated review complete — awaiting reviewer decision" },
  FINAL_DECISION_DONE: { step: 7, label: "Decision made" },
  PAID: { step: 8, label: "Payment processed" },
  CLOSED_NO_PAY: { step: 7, label: "Claim closed" },
};

const TOTAL_STEPS = 6;

export function ClientConfirmation({ claimId, onNewClaim }: Props) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [polling, setPolling] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      const { claim: c } = await getClaim(claimId);
      setClaim(c);
      const stageInfo = STAGE_PROGRESS[c.stage];
      if (stageInfo && stageInfo.step >= TOTAL_STEPS) {
        setPolling(false);
      }
    } catch {
      // Ignore polling errors
    }
  };

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(() => fetchStatus(), 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [claimId]);

  useEffect(() => {
    if (!polling && intervalRef.current) clearInterval(intervalRef.current);
  }, [polling]);

  const stageInfo = claim ? (STAGE_PROGRESS[claim.stage] ?? { step: 1, label: "Processing" }) : { step: 0, label: "Submitting" };
  const progress = Math.min((stageInfo.step / TOTAL_STEPS) * 100, 100);
  const isComplete = stageInfo.step >= TOTAL_STEPS;
  const isPaid = claim?.stage === "PAID";
  const isDenied = claim?.stage === "CLOSED_NO_PAY";

  return (
    <div className="client-confirmation">
      <div className="confirmation-card">
        <div className="confirmation-icon">
          {isComplete ? (isPaid ? "✓" : isDenied ? "✕" : "⏳") : "⟳"}
        </div>

        <h1 className="confirmation-title">
          {isComplete
            ? isPaid ? "Claim Approved & Paid" : isDenied ? "Claim Closed" : "Claim Under Review"
            : "Processing Your Claim"}
        </h1>

        <p className="confirmation-subtitle">
          {isComplete
            ? "Your claim has been processed through our automated review system."
            : "Our automated system is reviewing your claim. This typically takes 1–2 minutes."}
        </p>

        <div className="confirmation-claim-id">
          <span className="label">Claim Reference</span>
          <span className="value">{claimId}</span>
        </div>

        {!isComplete && (
          <div className="confirmation-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-label">{stageInfo.label}</p>
          </div>
        )}

        {isComplete && claim && (
          <div className="confirmation-status">
            <div className={`status-indicator ${isPaid ? "status-approved" : isDenied ? "status-denied" : "status-review"}`}>
              {stageName(claim.stage)}
            </div>
            {claim.stage === "PENDING_REVIEW" && (
              <p className="confirmation-note">
                Your claim has passed automated checks and is now being reviewed by a senior claims reviewer. 
                You will be contacted with the final decision within 21 business days as required by Ohio law.
              </p>
            )}
          </div>
        )}

        <div className="confirmation-next-steps">
          <h3>What Happens Next</h3>
          <ul>
            <li>Save your claim reference number: <strong>{claimId}</strong></li>
            <li>A reviewer will evaluate all automated findings</li>
            <li>You'll receive notification of the final decision</li>
            <li>Ohio law requires a decision within 21 business days</li>
          </ul>
        </div>

        <div className="confirmation-actions">
          <button className="btn btn-secondary" onClick={onNewClaim}>
            Submit Another Claim
          </button>
        </div>
      </div>
    </div>
  );
}
