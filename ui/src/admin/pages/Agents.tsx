import { useState, useEffect } from "react";
import { getAgents, createAgent, updateAgent, seedAgents } from "../api";
import { stageName } from "../displayNames";

const STATUS_COLORS: Record<string, string> = {
  idle: "#22c55e",
  working: "#3b82f6",
  disabled: "#666663",
  error: "#ef4444",
};

function AgentStatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#91918D";
  const isWorking = status === "working";
  return (
    <span
      className={`agent-status-dot ${isWorking ? "agent-status-pulse" : ""}`}
      style={{ background: color }}
      title={status}
    />
  );
}

export function Agents({ onNavigate }: { onNavigate?: (page: string, params?: Record<string, string>) => void }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ agent_id: "", display_name: "", model_primary: "google/gemini-2.0-flash-001", enabled: true });
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    try {
      const d = await getAgents();
      setAgents(d.agents);
      if (d.agents.length === 0 && !seeding) {
        setSeeding(true);
        await seedAgents();
        const refreshed = await getAgents();
        setAgents(refreshed.agents);
        setSeeding(false);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAgent(form);
      setShowCreate(false);
      setForm({ agent_id: "", display_name: "", model_primary: "google/gemini-2.0-flash-001", enabled: true });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggle = async (agentId: string, enabled: boolean) => {
    await updateAgent(agentId, { enabled: !enabled, status: !enabled ? "idle" : "disabled" });
    load();
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedAgents();
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSeeding(false);
    }
  };

  const enabledCount = agents.filter(a => a.enabled !== false).length;
  const workingCount = agents.filter(a => a.status === "working").length;

  return (
    <div className="admin-agents">
      <div className="admin-agents-header">
        <div>
          <h2>Agent Pipeline</h2>
          <p className="muted">{enabledCount} active · {workingCount} working · {agents.length} total</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary btn-sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? "Seeding..." : "Re-seed Defaults"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "+ Add Agent"}
          </button>
        </div>
      </div>
      {error && <div className="pipeline-error">{error}</div>}

      {showCreate && (
        <form className="card admin-agent-form" onSubmit={handleCreate}>
          <input placeholder="agent_id" value={form.agent_id} onChange={(e) => setForm({ ...form, agent_id: e.target.value })} required />
          <input placeholder="Display name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          <input placeholder="Model" value={form.model_primary} onChange={(e) => setForm({ ...form, model_primary: e.target.value })} />
          <button type="submit" className="btn btn-primary">Create</button>
        </form>
      )}

      {/* Pipeline visualization */}
      <div className="agent-pipeline-flow">
        {agents
          .filter(a => a.pipeline_stage)
          .sort((a, b) => {
            const order = ["FRONTDESK_DONE", "COVERAGE_DONE", "ASSESSMENT_DONE", "FRAUD_DONE", "FINAL_DECISION_DONE", "PAID"];
            return order.indexOf(a.pipeline_stage) - order.indexOf(b.pipeline_stage);
          })
          .map((a, i, arr) => (
            <div key={a.agent_id} className="agent-pipeline-node-wrapper">
              <div
                className={`agent-pipeline-node card ${a.enabled === false ? "agent-pipeline-disabled" : ""} ${a.status === "working" ? "agent-pipeline-working" : ""}`}
                onClick={() => onNavigate?.("runs", { agent_id: a.agent_id })}
                style={{ cursor: "pointer" }}
              >
                <AgentStatusDot status={a.enabled === false ? "disabled" : (a.status ?? "idle")} />
                <div className="agent-pipeline-info">
                  <strong>{a.display_name ?? a.agent_id}</strong>
                  <span className="muted monospace">{a.agent_id}</span>
                </div>
              </div>
              {i < arr.length - 1 && <span className="agent-pipeline-arrow">→</span>}
            </div>
          ))}
      </div>

      <div className="admin-agents-grid">
        {agents.map((a) => (
          <div key={a.agent_id} className={`card admin-agent-card ${a.enabled === false ? "admin-agent-disabled" : ""}`}>
            <div className="admin-agent-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AgentStatusDot status={a.enabled === false ? "disabled" : (a.status ?? "idle")} />
                <h3>{a.display_name ?? a.agent_id}</h3>
              </div>
              <button className={`btn btn-sm ${a.enabled === false ? "btn-primary" : "btn-danger"}`} onClick={() => handleToggle(a.agent_id, a.enabled !== false)}>
                {a.enabled === false ? "Enable" : "Disable"}
              </button>
            </div>
            {a.description && <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>{a.description}</p>}
            <dl className="admin-agent-meta">
              <dt>ID</dt><dd className="monospace">{a.agent_id}</dd>
              <dt>Stage</dt><dd>{a.pipeline_stage ? stageName(a.pipeline_stage) : "—"}</dd>
              <dt>Model</dt><dd className="monospace">{a.model_primary ?? "—"}</dd>
              <dt>Status</dt><dd>
                <span className={`status-badge status-${(a.enabled === false ? "disabled" : a.status ?? "idle").toLowerCase()}`}>
                  {a.enabled === false ? "disabled" : a.status ?? "idle"}
                </span>
              </dd>
              <dt>Updated</dt><dd>{a.updated_at ? new Date(a.updated_at).toLocaleString() : "—"}</dd>
            </dl>
          </div>
        ))}
        {agents.length === 0 && !seeding && <p className="muted">No agents configured.</p>}
        {seeding && <p className="muted">Seeding pipeline agents...</p>}
      </div>
    </div>
  );
}
