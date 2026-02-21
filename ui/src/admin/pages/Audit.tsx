import { useState, useEffect } from "react";
import { getAudit, getClaims } from "../api";
import { stageName, eventTypeName } from "../displayNames";
import { TruncatedValue } from "../components/TruncatedValue";
import { useSort, SortTh } from "../components/SortableHeader";

export function Audit({ onNavigate, initialParams }: {
  onNavigate?: (page: string, params?: Record<string, string>) => void;
  initialParams?: Record<string, string>;
}) {
  const [claims, setClaims] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState(initialParams?.claim_id ?? "");
  const [typeFilter, setTypeFilter] = useState("");
  const [error, setError] = useState("");
  const { sorted, sort, toggle } = useSort(events, "created_at", "asc");

  useEffect(() => {
    getClaims({ limit: "50" }).then((d) => {
      const sorted = (d.claims ?? []).sort((a: any, b: any) => {
        const ta = a.created_at ?? "";
        const tb = b.created_at ?? "";
        return tb.localeCompare(ta);
      });
      setClaims(sorted);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialParams?.claim_id) {
      loadAudit(initialParams.claim_id);
    }
  }, [initialParams?.claim_id]);

  const loadAudit = (claimId: string) => {
    if (!claimId) return;
    setSelectedClaimId(claimId);
    const params: Record<string, string> = { claim_id: claimId };
    if (typeFilter) params.event_type = typeFilter;
    getAudit(params).then((d) => setEvents(d.events)).catch((e) => setError(e.message));
  };

  const handleClaimClick = (claimId: string) => {
    loadAudit(claimId);
  };

  return (
    <div className="admin-audit">
      <h2>Audit Explorer</h2>
      {error && <div className="pipeline-error">{error}</div>}

      <div className="audit-layout">
        <div className="audit-claims-panel card">
          <h3>Claims</h3>
          <div className="audit-claims-list">
            {claims.map((c) => (
              <div
                key={c.claim_id}
                className={`audit-claim-item clickable ${selectedClaimId === c.claim_id ? "audit-claim-active" : ""}`}
                onClick={() => handleClaimClick(c.claim_id)}
              >
                <TruncatedValue value={c.claim_id} maxLen={16} mono />
                <span className={`status-badge stage-${(c.stage ?? "").toLowerCase().replace(/_/g, "-")}`} style={{ fontSize: "0.6rem", whiteSpace: "nowrap" }}>
                  {stageName(c.stage ?? "")}
                </span>
              </div>
            ))}
            {claims.length === 0 && <p className="muted">No claims</p>}
          </div>
        </div>

        <div className="audit-events-panel">
          <div className="admin-filters">
            <input
              type="text"
              placeholder="Claim ID"
              value={selectedClaimId}
              onChange={(e) => setSelectedClaimId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadAudit(selectedClaimId)}
              style={{ maxWidth: "200px" }}
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="STAGE_STARTED">Stage Started</option>
              <option value="STAGE_COMPLETED">Stage Completed</option>
              <option value="STAGE_ERROR">Stage Error</option>
              <option value="CLAIM_CREATED">Claim Created</option>
              <option value="SCHEMA_VALIDATION_FAILED">Validation Failed</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => loadAudit(selectedClaimId)}>Search</button>
          </div>

          {sorted.length > 0 ? (
            <table className="admin-table admin-table-full table-fixed">
              <thead>
                <tr>
                  <SortTh col="created_at" label="Time" sort={sort} onToggle={toggle} className="col-time" />
                  <SortTh col="stage" label="Stage" sort={sort} onToggle={toggle} className="col-stage" />
                  <SortTh col="type" label="Type" sort={sort} onToggle={toggle} className="col-type" />
                  <SortTh col="run_id" label="Run ID" sort={sort} onToggle={toggle} className="col-id" />
                  <SortTh col="actor_id" label="Actor" sort={sort} onToggle={toggle} className="col-actor" />
                  <SortTh col="hash" label="Hash" sort={sort} onToggle={toggle} className="col-hash" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((e: any, i: number) => (
                  <tr key={i} className={e.run_id ? "clickable" : ""} onClick={() => e.run_id && onNavigate?.("runs", { selected: e.run_id })}>
                    <td className="cell-nowrap">{e.created_at ? new Date(e.created_at).toLocaleTimeString() : "—"}</td>
                    <td className="cell-ellipsis">{stageName(e.stage ?? "")}</td>
                    <td><span className={`event-type-badge event-type-${(e.type ?? "").toLowerCase().replace(/_/g, "-")}`}>{eventTypeName(e.type)}</span></td>
                    <td>{e.run_id ? <TruncatedValue value={e.run_id} maxLen={10} mono /> : <span className="muted">—</span>}</td>
                    <td>{e.actor_id ? e.actor_id : <span className="muted">{e.type === "CLAIM_CREATED" ? "claimant" : "system"}</span>}</td>
                    <td>{e.hash ? <TruncatedValue value={e.hash} maxLen={8} mono /> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : selectedClaimId ? (
            <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>No audit events for this claim. Click Search or select a claim from the left panel.</p>
          ) : (
            <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>Select a claim from the left panel to view its audit trail.</p>
          )}
        </div>
      </div>
    </div>
  );
}
