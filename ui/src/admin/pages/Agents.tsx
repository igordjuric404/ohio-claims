import { useState, useEffect } from "react";
import { getAgents, createAgent, updateAgent } from "../api";

export function Agents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ agent_id: "", display_name: "", model_primary: "google/gemini-2.0-flash-001", enabled: true });
  const [error, setError] = useState("");

  const load = () => {
    getAgents().then((d) => setAgents(d.agents)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

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
    await updateAgent(agentId, { enabled: !enabled });
    load();
  };

  return (
    <div className="admin-agents">
      <div className="admin-agents-header">
        <h2>Agents</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ Add Agent"}
        </button>
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

      <div className="admin-agents-grid">
        {agents.map((a) => (
          <div key={a.agent_id} className={`card admin-agent-card ${a.enabled === false ? "admin-agent-disabled" : ""}`}>
            <div className="admin-agent-header">
              <h3>{a.display_name ?? a.agent_id}</h3>
              <button className={`btn btn-sm ${a.enabled === false ? "btn-primary" : "btn-danger"}`} onClick={() => handleToggle(a.agent_id, a.enabled !== false)}>
                {a.enabled === false ? "Enable" : "Disable"}
              </button>
            </div>
            <dl className="admin-agent-meta">
              <dt>ID</dt><dd className="monospace">{a.agent_id}</dd>
              <dt>Model</dt><dd className="monospace">{a.model_primary ?? "—"}</dd>
              <dt>Updated</dt><dd>{a.updated_at ? new Date(a.updated_at).toLocaleString() : "—"}</dd>
            </dl>
          </div>
        ))}
        {agents.length === 0 && <p className="muted">No agents configured. Seed from the default pipeline agents.</p>}
      </div>
    </div>
  );
}
