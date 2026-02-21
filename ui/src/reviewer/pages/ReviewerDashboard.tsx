import { useState, useEffect } from "react";
import { reviewerApi } from "../api";
import { stageName } from "../../admin/displayNames";
import { formatDateTime } from "../../lib/fieldLabels";

type Props = {
  onSelectClaim: (claimId: string) => void;
};

const REVIEWER_STAGES = [
  "FNOL_SUBMITTED", "FRONTDESK_DONE", "COVERAGE_DONE", "ASSESSMENT_DONE", "FRAUD_DONE",
  "PENDING_REVIEW", "FINAL_DECISION_DONE", "PAID", "CLOSED_NO_PAY",
];

const EDGE_BASE = "/edge";

export function ReviewerDashboard({ onSelectClaim }: Props) {
  const [claims, setClaims] = useState<any[]>([]);
  const [stageFilter, setStageFilter] = useState("");
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState<{ storage?: string; claimsCount?: number; port?: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const loadClaims = () => {
    setError("");
    const params: Record<string, string> = { limit: "50" };
    if (stageFilter) params.stage = stageFilter;
    reviewerApi.getClaims(params)
      .then((d) => setClaims(d.claims ?? []))
      .catch((e: Error) => setError(e.message));
  };

  const checkDebug = async () => {
    try {
      const res = await fetch(`${EDGE_BASE}/debug`);
      const data = await res.json();
      setDebugInfo(data);
    } catch {
      setDebugInfo({ storage: "error", claimsCount: 0 });
    }
  };

  const seedTestClaim = async () => {
    setSeeding(true);
    setError("");
    try {
      const res = await fetch("/internal/test/seed-reviewed-claim", { method: "POST" });
      if (!res.ok) throw new Error("Seed failed");
      const data = await res.json();
      loadClaims();
      setDebugInfo(null);
    } catch (e: any) {
      setError(e.message || "Seed failed. Ensure API runs with USE_MEMORY_STORAGE=true");
    } finally {
      setSeeding(false);
    }
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
              <td colSpan={5} style={{ padding: "2rem", verticalAlign: "top" }}>
                <div className="reviewer-empty-state">
                  <p className="muted" style={{ marginBottom: "1rem" }}>No claims to review</p>
                  <div className="reviewer-empty-help">
                    <p><strong>Local dev setup:</strong> Run <code>./dev.sh</code> from the project root to start API + UI with matching ports.</p>
                    <p>Or ensure API (PORT=8080) and UI (API_TARGET=http://127.0.0.1:8080) match.</p>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={checkDebug}>
                        Check API
                      </button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={seedTestClaim} disabled={seeding}>
                        {seeding ? "Seeding…" : "Seed test claim"}
                      </button>
                    </div>
                    {debugInfo && (
                      <pre className="muted" style={{ marginTop: "0.5rem", fontSize: "0.75rem", padding: "0.5rem", background: "#f5f5f5", borderRadius: 4 }}>
                        {JSON.stringify(debugInfo, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
