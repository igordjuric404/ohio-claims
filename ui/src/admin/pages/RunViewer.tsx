import { useState, useEffect, useRef } from "react";
import { getRuns, getRunDetail } from "../api";

function RunEventTimeline({ events }: { events: any[] }) {
  return (
    <div className="run-timeline">
      {events.map((e, i) => (
        <div key={i} className={`run-timeline-item run-timeline-${e.event_type?.replace(/\./g, "-") ?? "unknown"}`}>
          <div className="run-timeline-marker" />
          <div className="run-timeline-content">
            <div className="run-timeline-header">
              <span className="run-timeline-type">{e.event_type}</span>
              <span className="muted">{new Date(e.ts).toLocaleTimeString()}</span>
            </div>
            {e.payload && (
              <pre className="admin-json-sm">{JSON.stringify(e.payload, null, 2)}</pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RunDetail({ runId, onBack }: { runId: string; onBack: () => void }) {
  const [run, setRun] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [live, setLive] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    getRunDetail(runId).then((d) => {
      setRun(d.run);
      setEvents(d.events ?? []);
    });
  }, [runId]);

  const startLive = () => {
    setLive(true);
    const lastSeq = events.length > 0 ? Math.max(...events.map((e) => e.seq ?? 0)) : 0;
    const es = new EventSource(`/api/admin/runs/${runId}/stream?from_seq=${lastSeq}`);
    esRef.current = es;

    es.addEventListener("done", () => {
      es.close();
      setLive(false);
    });

    const handler = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data);
        setEvents((prev) => [...prev, data]);
      } catch {}
    };

    for (const type of ["stage.started", "agent.response", "stage.completed", "stage.failed"]) {
      es.addEventListener(type, handler);
    }

    es.onerror = () => {
      es.close();
      setLive(false);
    };
  };

  useEffect(() => () => esRef.current?.close(), []);

  if (!run) return <p>Loading run...</p>;

  return (
    <div className="admin-run-detail">
      <button className="btn btn-secondary" onClick={onBack}>← Back to list</button>
      <h2>Run {runId.substring(0, 12)}...</h2>
      <div className="admin-stats-grid">
        <div className="admin-stat card">
          <span className={`status-badge status-${run.status?.toLowerCase()}`}>{run.status}</span>
          <span className="admin-stat-label">Status</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{run.agent_id}</span>
          <span className="admin-stat-label">Agent</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{run.duration_ms ?? "—"}ms</span>
          <span className="admin-stat-label">Duration</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{run.usage?.total_tokens ?? "—"}</span>
          <span className="admin-stat-label">Tokens</span>
        </div>
      </div>
      <div className="card">
        <div className="admin-run-detail-header">
          <h3>Run Events</h3>
          {!live && run.status === "RUNNING" && (
            <button className="btn btn-primary" onClick={startLive}>Watch Live</button>
          )}
          {live && <span className="live-indicator">● LIVE</span>}
        </div>
        <RunEventTimeline events={events} />
      </div>
      <details className="card">
        <summary>Raw Run Data</summary>
        <pre className="admin-json">{JSON.stringify(run, null, 2)}</pre>
      </details>
    </div>
  );
}

export function RunViewer() {
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    const params: Record<string, string> = { limit: "50" };
    if (agentFilter) params.agent_id = agentFilter;
    if (statusFilter) params.status = statusFilter;
    getRuns(params).then((d) => setRuns(d.runs));
  };

  useEffect(load, [agentFilter, statusFilter]);

  if (selectedRunId) {
    return <RunDetail runId={selectedRunId} onBack={() => { setSelectedRunId(null); load(); }} />;
  }

  return (
    <div className="admin-runs">
      <h2>Run Viewer</h2>
      <div className="admin-filters">
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
          <option value="">All agents</option>
          {["frontdesk", "claimsofficer", "assessor", "fraudanalyst", "seniorreviewer", "finance"].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="RUNNING">Running</option>
          <option value="SUCCEEDED">Succeeded</option>
          <option value="FAILED">Failed</option>
        </select>
        <button className="btn btn-secondary" onClick={load}>Refresh</button>
      </div>
      <table className="admin-table admin-table-full">
        <thead>
          <tr>
            <th>Run ID</th>
            <th>Agent</th>
            <th>Stage</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Tokens</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.run_id} onClick={() => setSelectedRunId(r.run_id)} className="clickable">
              <td className="monospace">{r.run_id?.substring(0, 12)}...</td>
              <td>{r.agent_id}</td>
              <td>{r.stage}</td>
              <td><span className={`status-badge status-${(r.status ?? "").toLowerCase()}`}>{r.status}</span></td>
              <td>{r.duration_ms ?? "—"}ms</td>
              <td>{r.usage?.total_tokens ?? "—"}</td>
              <td>{r.started_at ? new Date(r.started_at).toLocaleTimeString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
