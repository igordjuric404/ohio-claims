import { useState, useEffect } from "react";
import { getOverview } from "../api";

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

export function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOverview().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="pipeline-error">{error}</div>;
  if (!data) return <p>Loading...</p>;

  return (
    <div className="admin-overview">
      <h2>Dashboard Overview</h2>
      <div className="admin-stats-grid">
        <div className="admin-stat card">
          <span className="admin-stat-value">{data.total_claims}</span>
          <span className="admin-stat-label">Total Claims</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{data.total_runs}</span>
          <span className="admin-stat-label">Total Runs</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{data.total_tokens.toLocaleString()}</span>
          <span className="admin-stat-label">Total Tokens</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{data.avg_run_duration_ms}ms</span>
          <span className="admin-stat-label">Avg Run Duration</span>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="card">
          <h3>Claims by Stage</h3>
          <table className="admin-table">
            <tbody>
              {Object.entries(data.claims_by_stage).map(([stage, count]) => (
                <tr key={stage}>
                  <td>{stage.replace(/_/g, " ")}</td>
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
                <tr key={agent}>
                  <td>{agent}</td>
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
                <tr key={status}>
                  <td>
                    <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>
                  </td>
                  <td className="text-right">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
