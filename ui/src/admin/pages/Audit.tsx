import { useState } from "react";
import { getAudit } from "../api";

export function Audit() {
  const [events, setEvents] = useState<any[]>([]);
  const [claimId, setClaimId] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    if (!claimId) return;
    const params: Record<string, string> = { claim_id: claimId };
    if (typeFilter) params.event_type = typeFilter;
    getAudit(params).then((d) => setEvents(d.events)).catch((e) => setError(e.message));
  };

  return (
    <div className="admin-audit">
      <h2>Audit Explorer</h2>
      {error && <div className="pipeline-error">{error}</div>}
      <div className="admin-filters">
        <input
          type="text"
          placeholder="Claim ID (required)"
          value={claimId}
          onChange={(e) => setClaimId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="STAGE_STARTED">Stage Started</option>
          <option value="STAGE_COMPLETED">Stage Completed</option>
          <option value="STAGE_ERROR">Stage Error</option>
          <option value="CLAIM_CREATED">Claim Created</option>
          <option value="SCHEMA_VALIDATION_FAILED">Schema Validation Failed</option>
        </select>
        <button className="btn btn-primary" onClick={load}>Search</button>
      </div>
      {events.length > 0 ? (
        <table className="admin-table admin-table-full">
          <thead>
            <tr>
              <th>Time</th>
              <th>Stage</th>
              <th>Type</th>
              <th>Run ID</th>
              <th>Actor</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i}>
                <td>{new Date(e.created_at).toLocaleTimeString()}</td>
                <td>{e.stage}</td>
                <td><span className={`event-type-badge event-type-${e.type?.toLowerCase().replace(/_/g, "-")}`}>{e.type}</span></td>
                <td className="monospace">{e.run_id ? e.run_id.substring(0, 10) + "..." : "—"}</td>
                <td>{e.actor_id ?? "—"}</td>
                <td className="monospace">{e.hash?.substring(0, 8)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Enter a claim ID and click Search to view audit events.</p>
      )}
    </div>
  );
}
