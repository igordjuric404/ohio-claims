import { useState, useEffect } from "react";
import { reviewerApi } from "../api";
import { stageName } from "../../admin/displayNames";
import { formatDateTime } from "../../lib/fieldLabels";

type Props = {
  onSelectClaim: (claimId: string) => void;
};

const REVIEWER_STAGES = ["PENDING_REVIEW", "FINAL_DECISION_DONE", "PAID", "CLOSED_NO_PAY"];

export function ReviewerDashboard({ onSelectClaim }: Props) {
  const [claims, setClaims] = useState<any[]>([]);
  const [stageFilter, setStageFilter] = useState("");
  const [error, setError] = useState("");

  const loadClaims = () => {
    const params: Record<string, string> = { limit: "50" };
    if (stageFilter) params.stage = stageFilter;
    reviewerApi.getClaims(params)
      .then((d) => setClaims(d.claims ?? []))
      .catch((e: Error) => setError(e.message));
  };

  useEffect(loadClaims, [stageFilter]);

  const pendingCount = claims.filter((c) => c.stage === "PENDING_REVIEW").length;
  const decidedCount = claims.filter((c) => ["FINAL_DECISION_DONE", "PAID", "CLOSED_NO_PAY"].includes(c.stage)).length;

  return (
    <div className="admin-claims">
      <h2>Claims Review Queue</h2>
      {error && <div className="pipeline-error">{error}</div>}

      <div className="admin-stats-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="admin-stat card clickable" onClick={() => setStageFilter("PENDING_REVIEW")}>
          <span className="admin-stat-value">{pendingCount}</span>
          <span className="admin-stat-label">Pending Review</span>
        </div>
        <div className="admin-stat card clickable" onClick={() => setStageFilter("")}>
          <span className="admin-stat-value">{claims.length}</span>
          <span className="admin-stat-label">Total Claims</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{decidedCount}</span>
          <span className="admin-stat-label">Decided</span>
        </div>
      </div>

      <div className="admin-filters">
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">All stages</option>
          {REVIEWER_STAGES.map(s => <option key={s} value={s}>{stageName(s)}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={loadClaims}>Refresh</button>
      </div>

      <table className="admin-table admin-table-full table-fixed">
        <thead>
          <tr>
            <th className="col-id">Claim ID</th>
            <th className="col-policy">Policy</th>
            <th className="col-claimant">Claimant</th>
            <th className="col-stage">Status</th>
            <th className="col-date">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c: any) => (
            <tr key={c.claim_id} onClick={() => onSelectClaim(c.claim_id)} className="clickable">
              <td className="monospace" style={{ fontSize: "0.8rem" }}>{c.claim_id}</td>
              <td>{c.policy_id}</td>
              <td className="cell-ellipsis">{c.claimant?.full_name ?? "—"}</td>
              <td>
                <span className={`status-badge stage-${(c.stage ?? "").toLowerCase().replace(/_/g, "-")}`}>
                  {stageName(c.stage ?? "")}
                </span>
              </td>
              <td>{c.created_at ? formatDateTime(c.created_at) : "—"}</td>
            </tr>
          ))}
          {claims.length === 0 && (
            <tr>
              <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                No claims to review
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
