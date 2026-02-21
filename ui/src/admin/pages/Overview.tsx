import { useState, useEffect } from "react";
import { getOverview, getClaims, getRuns, cleanupStaleRuns, purgeAllClaims, purgeAllRuns } from "../api";
import { agentName, stageName, statusName } from "../displayNames";

type OverviewData = {
  total_claims: number;
  claims_by_stage: Record<string, number>;
  total_runs: number;
  runs_by_status: Record<string, number>;
  runs_by_agent: Record<string, number>;
  total_tokens: number;
  total_duration_ms: number;
  avg_run_duration_ms: number;
};

export function Overview({ onNavigate }: { onNavigate: (page: string, params?: Record<string, string>) => void }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [recentClaims, setRecentClaims] = useState<any[]>([]);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState("");
  const [purging, setPurging] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState("");

  useEffect(() => {
    getOverview().then(setData).catch((e) => setError(e.message));
    getClaims({ limit: "5" }).then((d) => setRecentClaims(d.claims?.slice(0, 5) ?? [])).catch(() => {});
    getRuns({ limit: "5" }).then((d) => setRecentRuns(d.runs?.slice(0, 5) ?? [])).catch(() => {});
  }, []);

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const result = await cleanupStaleRuns();
      setCleanMsg(result.message);
      const refreshed = await getOverview();
      setData(refreshed);
    } catch (e: any) {
      setCleanMsg(`Error: ${e.message}`);
    } finally {
      setCleaning(false);
    }
  };

  const handlePurge = async () => {
    if (!window.confirm("⚠️ DANGER: This will permanently delete ALL claims, runs, and events. Are you sure?")) return;
    if (!window.confirm("This cannot be undone. Type OK to confirm.")) return;
    setPurging(true);
    setPurgeMsg("");
    try {
      const [claimsRes, runsRes] = await Promise.all([purgeAllClaims(), purgeAllRuns()]);
      setPurgeMsg(`Purged: ${claimsRes.message}. ${runsRes.message}.`);
      const refreshed = await getOverview();
      setData(refreshed);
      setRecentClaims([]);
      setRecentRuns([]);
    } catch (e: any) {
      setPurgeMsg(`Error: ${e.message}`);
    } finally {
      setPurging(false);
    }
  };

  if (error) return <div className="pipeline-error">{error}</div>;
  if (!data) return <p className="muted">Loading dashboard...</p>;

  const runningCount = data.runs_by_status["RUNNING"] ?? 0;
  const totalCost = data.total_tokens * 0.00000015;

  return (
    <div className="admin-overview">
      <div className="overview-header">
        <h2>Dashboard</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {runningCount > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleCleanup} disabled={cleaning}>
              {cleaning ? "Cleaning..." : `Clean ${runningCount} stale run(s)`}
            </button>
          )}
          <button className="btn btn-danger btn-sm" onClick={handlePurge} disabled={purging}>
            {purging ? "Purging..." : "Purge All Data"}
          </button>
        </div>
      </div>
      {cleanMsg && <div className="pipeline-result" style={{ marginBottom: "1rem" }}>{cleanMsg}</div>}
      {purgeMsg && <div className="pipeline-result" style={{ marginBottom: "1rem" }}>{purgeMsg}</div>}

      <div className="admin-stats-grid">
        <div className="admin-stat card clickable" onClick={() => onNavigate("claims")}>
          <span className="admin-stat-value">{data.total_claims}</span>
          <span className="admin-stat-label">Total Claims</span>
        </div>
        <div className="admin-stat card clickable" onClick={() => onNavigate("runs")}>
          <span className="admin-stat-value">{data.total_runs}</span>
          <span className="admin-stat-label">Total Runs</span>
        </div>
        <div className="admin-stat card clickable" onClick={() => onNavigate("agents")}>
          <span className="admin-stat-value">{Object.keys(data.runs_by_agent).length}</span>
          <span className="admin-stat-label">Active Agents</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{data.total_tokens.toLocaleString()}</span>
          <span className="admin-stat-label">Total Tokens</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{data.avg_run_duration_ms}ms</span>
          <span className="admin-stat-label">Avg Duration</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">${totalCost.toFixed(4)}</span>
          <span className="admin-stat-label">Est. Cost</span>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="card">
          <h3>Claims by Stage</h3>
          <table className="admin-table">
            <tbody>
              {Object.entries(data.claims_by_stage).map(([stage, count]) => (
                <tr key={stage} className="clickable" onClick={() => onNavigate("claims", { stage })}>
                  <td>{stageName(stage)}</td>
                  <td className="text-right">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Runs by Agent</h3>
          <table className="admin-table">
            <tbody>
              {Object.entries(data.runs_by_agent).map(([agent, count]) => (
                <tr key={agent} className="clickable" onClick={() => onNavigate("runs", { agent_id: agent })}>
                  <td>{agentName(agent)}</td>
                  <td className="text-right">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Runs by Status</h3>
          <table className="admin-table">
            <tbody>
              {Object.entries(data.runs_by_status).map(([status, count]) => (
                <tr key={status} className="clickable" onClick={() => onNavigate("runs", { status })}>
                  <td>
                    <span className={`status-badge status-${status.toLowerCase()}`}>{statusName(status)}</span>
                  </td>
                  <td className="text-right">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-detail-grid" style={{ marginTop: "1.5rem" }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Recent Claims</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("claims")}>View All →</button>
          </div>
          {recentClaims.length > 0 ? (
            <table className="admin-table">
              <tbody>
                {recentClaims.map((c) => (
                  <tr key={c.claim_id} className="clickable" onClick={() => onNavigate("claims", { selected: c.claim_id })}>
                    <td className="monospace" style={{ fontSize: "0.75rem" }}>{c.claim_id}</td>
                    <td><span className={`status-badge stage-${(c.stage ?? "").toLowerCase().replace(/_/g, "-")}`}>{stageName(c.stage ?? "")}</span></td>
                    <td className="muted">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">No claims yet</p>}
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Recent Runs</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("runs")}>View All →</button>
          </div>
          {recentRuns.length > 0 ? (
            <table className="admin-table">
              <tbody>
                {recentRuns.map((r) => (
                  <tr key={r.run_id} className="clickable" onClick={() => onNavigate("runs", { selected: r.run_id })}>
                    <td>{agentName(r.agent_id)}</td>
                    <td><span className={`status-badge status-${(r.status ?? "").toLowerCase()}`}>{statusName(r.status)}</span></td>
                    <td className="muted">{r.duration_ms ?? "—"}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">No runs yet</p>}
        </div>
      </div>
    </div>
  );
}
