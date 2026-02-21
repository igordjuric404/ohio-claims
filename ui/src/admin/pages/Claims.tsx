import { useState, useEffect } from "react";
import { getClaims, getClaimDetail } from "../api";

export function Claims() {
  const [claims, setClaims] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [stageFilter, setStageFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadClaims = () => {
    const params: Record<string, string> = { limit: "50" };
    if (stageFilter) params.stage = stageFilter;
    if (search) params.search = search;
    getClaims(params).then((d) => setClaims(d.claims)).catch((e) => setError(e.message));
  };

  useEffect(loadClaims, [stageFilter]);

  const handleSelect = async (id: string) => {
    try {
      const detail = await getClaimDetail(id);
      setSelected(detail);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (selected) {
    return (
      <div className="admin-claim-detail">
        <button className="btn btn-secondary" onClick={() => setSelected(null)}>
          ← Back to list
        </button>
        <h2>Claim {selected.claim.claim_id}</h2>
        <div className="admin-detail-grid">
          <div className="card">
            <h3>Details</h3>
            <pre className="admin-json">{JSON.stringify(selected.claim, null, 2)}</pre>
          </div>
          <div className="card">
            <h3>Runs ({selected.runs?.length ?? 0})</h3>
            {(selected.runs ?? []).map((r: any) => (
              <div key={r.run_id} className="admin-run-item">
                <span className={`status-badge status-${(r.status ?? "").toLowerCase()}`}>
                  {r.status}
                </span>
                <span>{r.agent_id}</span>
                <span className="muted">{r.duration_ms}ms</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Events ({selected.events?.length ?? 0})</h3>
            <div className="admin-events-list">
              {(selected.events ?? []).map((e: any, i: number) => (
                <div key={i} className="admin-event-item">
                  <span className="admin-event-type">{e.type}</span>
                  <span className="muted">{e.stage}</span>
                  <span className="muted">{new Date(e.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-claims">
      <h2>Claims Explorer</h2>
      {error && <div className="pipeline-error">{error}</div>}
      <div className="admin-filters">
        <input
          type="text"
          placeholder="Search by claim ID or policy..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadClaims()}
        />
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">All stages</option>
          <option value="FNOL_SUBMITTED">FNOL Submitted</option>
          <option value="FRONTDESK_DONE">Frontdesk Done</option>
          <option value="COVERAGE_DONE">Coverage Done</option>
          <option value="ASSESSMENT_DONE">Assessment Done</option>
          <option value="FRAUD_DONE">Fraud Done</option>
          <option value="FINAL_DECISION_DONE">Final Decision</option>
          <option value="PAID">Paid</option>
          <option value="CLOSED_NO_PAY">Closed No Pay</option>
        </select>
        <button className="btn btn-secondary" onClick={loadClaims}>Refresh</button>
      </div>
      <table className="admin-table admin-table-full">
        <thead>
          <tr>
            <th>Claim ID</th>
            <th>Policy</th>
            <th>Stage</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.claim_id} onClick={() => handleSelect(c.claim_id)} className="clickable">
              <td>{c.claim_id}</td>
              <td>{c.policy_id}</td>
              <td><span className={`status-badge stage-${(c.stage ?? "").toLowerCase().replace(/_/g, "-")}`}>{c.stage}</span></td>
              <td>{new Date(c.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
