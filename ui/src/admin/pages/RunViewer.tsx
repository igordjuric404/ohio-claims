import { useState, useEffect, useRef } from "react";
import { getRuns, getRunDetail, getClaimPhotos } from "../api";
import { agentName, stageName, statusName, fieldLabel, formatFieldValue } from "../displayNames";
import { formatCurrencyRange } from "../../lib/fieldLabels";
import { TruncatedValue } from "../components/TruncatedValue";

function formatCost(usage: any): string {
  if (!usage?.cost) return "—";
  return `$${Number(usage.cost).toFixed(6)}`;
}

const SKIP_KEYS = new Set(["repair_estimate_high", "pricing_sources"]);

function extractUrlAndLabel(source: string): { url: string; label: string } | null {
  const match = source.match(/^(https?:\/\/[^\s]+?)(?:\s+[—–-]\s+(.+))?$/);
  if (!match) return null;
  const url = match[1];
  const title = match[2];
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return { url, label: title || hostname };
  } catch {
    return { url, label: title || url };
  }
}

function PricingSourcesCards({ sources }: { sources: string[] }) {
  const links = sources.map(extractUrlAndLabel).filter(Boolean) as { url: string; label: string }[];
  if (links.length === 0) return null;
  return (
    <div className="run-output-card run-output-card-full">
      <dt>Pricing Sources ({links.length})</dt>
      <dd>
        <div className="pricing-sources-list">
          {links.map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="pricing-source-link">
              <span className="pricing-source-favicon">
                <img src={`https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=16`} alt="" width="16" height="16" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </span>
              <span className="pricing-source-label">{link.label}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="pricing-source-external">
                <path d="M3.5 1.5h7v7M10 2L4.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          ))}
        </div>
      </dd>
    </div>
  );
}

function renderOutputCards(obj: Record<string, unknown>) {
  const entries = Object.entries(obj).filter(
    ([k, v]) => v !== null && v !== undefined && v !== "" && !SKIP_KEYS.has(k)
  );
  const cards = entries.map(([k, v]) => {
    let displayValue: React.ReactNode;
    if (k === "repair_estimate_low" && typeof v === "number" && typeof obj.repair_estimate_high === "number") {
      displayValue = formatCurrencyRange(v, obj.repair_estimate_high as number);
    } else if (typeof v === "object") {
      displayValue = <pre className="run-io-pre">{JSON.stringify(v, null, 2)}</pre>;
    } else {
      displayValue = formatFieldValue(k, v);
    }
    const label = k === "repair_estimate_low" && obj.repair_estimate_high != null ? "Repair Estimate Range" : fieldLabel(k);
    return (
      <div key={k} className="run-output-card">
        <dt>{label}</dt>
        <dd>{displayValue}</dd>
      </div>
    );
  });

  const pricingSources = obj.pricing_sources;
  if (Array.isArray(pricingSources) && pricingSources.length > 0) {
    cards.push(<PricingSourcesCards key="pricing_sources" sources={pricingSources as string[]} />);
  }

  return cards;
}

function RunPhotos({ claimId }: { claimId: string }) {
  const [photos, setPhotos] = useState<{ key: string; filename: string; url: string }[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClaimPhotos(claimId)
      .then((d) => setPhotos(d.photos ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [claimId]);

  if (loading) return null;
  if (photos.length === 0) return null;

  return (
    <div className="card run-section">
      <h3>Damage Photos ({photos.length})</h3>
      <div className="damage-photos-grid">
        {photos.map((p) => (
          <div key={p.key} className="damage-photo-thumb" onClick={() => setLightbox(p.url)}>
            <img src={p.url} alt={p.filename} loading="lazy" />
            <div className="photo-filename">{p.filename}</div>
          </div>
        ))}
      </div>
      {lightbox && (
        <div className="damage-photo-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full size" />
        </div>
      )}
    </div>
  );
}

function RunEventTimeline({ events }: { events: any[] }) {
  return (
    <div className="run-timeline">
      {events.map((e, i) => {
        const type = e.event_type ?? "unknown";
        const isInput = type === "agent.input";
        const isOutput = type === "agent.raw_output" || type === "stage.completed";
        const isError = type.includes("failed");
        const isWebSearch = type.startsWith("web_search");

        return (
          <div key={i} className={`run-timeline-item run-timeline-${type.replace(/\./g, "-")}`}>
            <div className={`run-timeline-marker ${isError ? "marker-error" : isOutput ? "marker-success" : isInput ? "marker-info" : isWebSearch ? "marker-info" : ""}`} />
            <div className="run-timeline-content">
              <div className="run-timeline-header">
                <span className={`event-type-badge event-type-${type.replace(/\./g, "-")}`}>{type}</span>
                <span className="muted">{e.ts ? new Date(e.ts).toLocaleTimeString() : ""}</span>
              </div>
              {isInput && e.payload?.prompt && (
                <details className="run-io-section">
                  <summary>Agent Input</summary>
                  <pre className="run-io-pre">{typeof e.payload.prompt === "string" ? e.payload.prompt : JSON.stringify(e.payload.prompt, null, 2)}</pre>
                </details>
              )}
              {isInput && e.payload?.system_prompt && (
                <details className="run-io-section">
                  <summary>System Prompt</summary>
                  <pre className="run-io-pre">{e.payload.system_prompt}</pre>
                </details>
              )}
              {type === "agent.raw_output" && e.payload?.raw_text && (
                <details className="run-io-section" open>
                  <summary>Raw Agent Output</summary>
                  <pre className="run-io-pre">{e.payload.raw_text}</pre>
                </details>
              )}
              {type === "agent.response" && e.payload && (
                <div className="run-event-meta">
                  <span>Model: <code>{e.payload.model}</code></span>
                  {e.payload.usage && (
                    <span>Tokens: {e.payload.usage.total_tokens} ({e.payload.usage.prompt_tokens}→{e.payload.usage.completion_tokens})</span>
                  )}
                  {e.payload.usage && <span>Cost: {formatCost(e.payload.usage)}</span>}
                </div>
              )}
              {type === "stage.completed" && e.payload && (
                <details className="run-io-section" open>
                  <summary>Parsed Output</summary>
                  {typeof e.payload === "object" && !Array.isArray(e.payload) && !e.payload.output_summary ? (
                    <div className="run-output-cards">
                      {renderOutputCards(e.payload)}
                    </div>
                  ) : (
                    <pre className="run-io-pre">{JSON.stringify(e.payload, null, 2)}</pre>
                  )}
                </details>
              )}
              {type === "stage.started" && e.payload && (
                <div className="run-event-meta">
                  <span>Agent: <strong>{agentName(e.payload.agent_id)}</strong></span>
                  <span>Claim: <code>{e.payload.claim_id}</code></span>
                </div>
              )}
              {isError && e.payload && (
                <div className="run-event-error">
                  {e.payload.error ?? JSON.stringify(e.payload)}
                </div>
              )}
              {type === "web_search.completed" && e.payload && (
                <div className="web-search-evidence">
                  {e.payload.citations?.length > 0 && (
                    <div className="ws-block">
                      <span className="ws-label">Sources ({e.payload.citations.length})</span>
                      <div className="ws-citations">
                        {e.payload.citations.map((c: any, ci: number) => (
                          <div key={ci} className="ws-citation">
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="ws-citation-url">{c.title || c.url}</a>
                            {c.content && <p className="ws-citation-excerpt">{c.content}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {e.payload.usage && (
                    <div className="run-event-meta">
                      <span>Model: <code>{e.payload.model}</code></span>
                      {e.payload.usage.total_tokens && <span>Tokens: {e.payload.usage.total_tokens}</span>}
                    </div>
                  )}
                </div>
              )}
              {type === "web_search.failed" && e.payload && (
                <div className="run-event-error">{e.payload.error ?? "Web search failed"}</div>
              )}
              {e.payload?.images_count != null && (
                <div className="run-event-meta">
                  <span>Images analyzed: {e.payload.images_count}</span>
                  {e.payload.image_keys?.map((k: string) => (
                    <span key={k} className="monospace" style={{ fontSize: "0.75rem" }}>{k.split("/").pop()}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {events.length === 0 && <p className="muted">No events recorded for this run</p>}
    </div>
  );
}

function RunDetail({ runId, onBack, onNavigate }: { runId: string; onBack: () => void; onNavigate?: (page: string, params?: Record<string, string>) => void }) {
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
    es.addEventListener("done", () => { es.close(); setLive(false); });
    const handler = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data);
        setEvents((prev) => [...prev, data]);
      } catch {}
    };
    for (const type of ["stage.started", "agent.input", "agent.response", "agent.raw_output", "stage.completed", "stage.failed"]) {
      es.addEventListener(type, handler);
    }
    es.onerror = () => { es.close(); setLive(false); };
  };

  useEffect(() => () => esRef.current?.close(), []);

  if (!run) return <p className="muted">Loading run...</p>;

  return (
    <div className="admin-run-detail">
      <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back to list</button>

      <div className="run-detail-header">
        <div>
          <h2 className="run-detail-title">{agentName(run.agent_id)}</h2>
          <span className="monospace muted" style={{ fontSize: "0.75rem" }}>{runId}</span>
        </div>
        <span className={`status-badge status-${run.status?.toLowerCase()}`}>{statusName(run.status)}</span>
      </div>

      <div className="admin-stats-grid run-detail-stats">
        <div className="admin-stat card">
          <span className="admin-stat-value">{agentName(run.agent_id)}</span>
          <span className="admin-stat-label">Agent</span>
        </div>
        <div className="admin-stat card clickable" onClick={() => onNavigate?.("claims", { selected: run.claim_id })}>
          <span className="admin-stat-value monospace" style={{ fontSize: "0.75rem" }}><TruncatedValue value={run.claim_id} maxLen={16} mono /></span>
          <span className="admin-stat-label">Claim</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{run.duration_ms ?? "—"}ms</span>
          <span className="admin-stat-label">Duration</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{run.usage?.total_tokens ?? "—"}</span>
          <span className="admin-stat-label">Tokens</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{formatCost(run.usage)}</span>
          <span className="admin-stat-label">Cost</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value monospace" style={{ fontSize: "0.7rem" }}>{run.model ?? "—"}</span>
          <span className="admin-stat-label">Model</span>
        </div>
      </div>

      {run.input_prompt && (
        <div className="card run-section">
          <details open>
            <summary><h3 style={{ display: "inline" }}>Input Prompt</h3></summary>
            <pre className="run-io-pre">{run.input_prompt}</pre>
          </details>
        </div>
      )}

      {run.output_json && (
        <div className="card run-section">
          <details open>
            <summary><h3 style={{ display: "inline" }}>Agent Output</h3></summary>
            <div className="run-output-cards">
              {renderOutputCards(run.output_json)}
            </div>
          </details>
        </div>
      )}

      <div className="card run-section">
        <div className="admin-run-detail-header">
          <h3>Run Events ({events.length})</h3>
          {!live && run.status === "RUNNING" && (
            <button className="btn btn-primary btn-sm" onClick={startLive}>Watch Live</button>
          )}
          {live && <span className="live-indicator">● LIVE</span>}
        </div>
        <RunEventTimeline events={events} />
      </div>

      {/* Damage Photos (for assessor_vision runs) */}
      {run.agent_id?.includes("assessor") && run.claim_id && (
        <RunPhotos claimId={run.claim_id} />
      )}

      {/* Web Search Evidence — from output_json or from events */}
      {run.agent_id?.includes("assessor") && (() => {
        const ws = run.output_json?.web_search;
        const wsEvent = events.find((e: any) => e.event_type === "web_search.completed");
        const hasWebSearch = ws || wsEvent;
        if (!hasWebSearch) return null;
        const queries = ws?.queries ?? wsEvent?.payload?.search_queries ?? [];
        const citations = ws?.citations ?? wsEvent?.payload?.citations ?? [];
        const pricingSource = ws?.pricing_source ?? (citations.length > 0 ? "web_search" : "simulated");
        return (
          <div className="card run-section">
            <h3>Web Search Evidence</h3>
            <div className="web-search-evidence">
              {queries.length > 0 && (
                <div className="ws-block">
                  <span className="ws-label">Search Queries</span>
                  <ul className="ws-queries">
                    {queries.map((q: string, i: number) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              {citations.length > 0 && (
                <div className="ws-block">
                  <span className="ws-label">Sources Found ({citations.length})</span>
                  <div className="ws-citations">
                    {citations.map((c: any, i: number) => (
                      <div key={i} className="ws-citation">
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="ws-citation-url">{c.title || c.url}</a>
                        {c.content && <p className="ws-citation-excerpt">{c.content}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="ws-block">
                <span className="ws-label">Pricing Source</span>
                <span className={`status-badge ${pricingSource === "web_search" ? "status-succeeded" : ""}`}>{pricingSource}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Damage Analysis table */}
      {run.agent_id?.includes("assessor") && run.output_json?.detected_damage?.length > 0 && (
        <div className="card run-section">
          <h3>Damage Analysis ({run.output_json.photos_analyzed ?? 0} photos)</h3>
          <table className="admin-table">
            <thead><tr><th>Part</th><th>Severity</th><th>Side</th><th>Description</th></tr></thead>
            <tbody>
              {run.output_json.detected_damage.map((d: any, i: number) => (
                <tr key={i}>
                  <td>{d.part}</td>
                  <td><span className={`status-badge severity-${d.severity}`}>{d.severity}</span></td>
                  <td>{d.side}</td>
                  <td>{d.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="card run-section">
        <summary>Raw Run Data</summary>
        <pre className="admin-json">{JSON.stringify(run, null, 2)}</pre>
      </details>
    </div>
  );
}

type ClaimGroup = {
  claim_id: string;
  runs: any[];
  latest_run_at: string;
  total_duration_ms: number;
  total_tokens: number;
  has_failures: boolean;
};

function groupRunsByClaim(runs: any[]): ClaimGroup[] {
  const groups = new Map<string, ClaimGroup>();
  for (const r of runs) {
    const cid = r.claim_id as string;
    if (!groups.has(cid)) {
      groups.set(cid, {
        claim_id: cid,
        runs: [],
        latest_run_at: "",
        total_duration_ms: 0,
        total_tokens: 0,
        has_failures: false,
      });
    }
    const g = groups.get(cid)!;
    g.runs.push(r);
    if (r.started_at > g.latest_run_at) g.latest_run_at = r.started_at;
    g.total_duration_ms += r.duration_ms ?? 0;
    g.total_tokens += r.usage?.total_tokens ?? 0;
    if (r.status === "FAILED") g.has_failures = true;
  }
  return [...groups.values()].sort((a, b) => b.latest_run_at.localeCompare(a.latest_run_at));
}

function ClaimRunGroup({ group, onSelectRun }: { group: ClaimGroup; onSelectRun: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="claim-run-group">
      <div className="claim-run-group-header clickable" onClick={() => setExpanded(!expanded)}>
        <span className="expand-icon">{expanded ? "▾" : "▸"}</span>
        <span className="monospace" style={{ fontSize: "0.8rem" }}>{group.claim_id}</span>
        <span className="muted">{group.runs.length} run{group.runs.length !== 1 ? "s" : ""}</span>
        <span className="muted">{group.total_duration_ms}ms total</span>
        <span className="muted">{group.total_tokens.toLocaleString()} tokens</span>
        {group.has_failures && <span className="status-badge status-failed">Has Failures</span>}
        <span className="muted" style={{ marginLeft: "auto" }}>
          {group.latest_run_at ? new Date(group.latest_run_at).toLocaleString() : "—"}
        </span>
      </div>
      {expanded && (
        <div className="claim-run-group-runs">
          {group.runs.map((r: any) => (
            <div key={r.run_id} className="claim-run-item clickable" onClick={() => onSelectRun(r.run_id)}>
              <span className={`status-badge status-${(r.status ?? "").toLowerCase()}`}>{statusName(r.status)}</span>
              <span>{agentName(r.agent_id)}</span>
              <span className="muted">{stageName(r.stage)}</span>
              <span className="muted">{r.duration_ms ?? "—"}ms</span>
              <span className="muted">{r.usage?.total_tokens ?? "—"} tok</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RunViewer({ onNavigate, initialParams }: {
  onNavigate?: (page: string, params?: Record<string, string>) => void;
  initialParams?: Record<string, string>;
}) {
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialParams?.selected ?? null);
  const [agentFilter, setAgentFilter] = useState(initialParams?.agent_id ?? "");
  const [statusFilter, setStatusFilter] = useState(initialParams?.status ?? "");

  const load = () => {
    const params: Record<string, string> = { limit: "200" };
    if (agentFilter) params.agent_id = agentFilter;
    if (statusFilter) params.status = statusFilter;
    getRuns(params).then((d) => setRuns(d.runs));
  };

  useEffect(load, [agentFilter, statusFilter]);

  if (selectedRunId) {
    return <RunDetail runId={selectedRunId} onBack={() => { setSelectedRunId(null); load(); }} onNavigate={onNavigate} />;
  }

  const claimGroups = groupRunsByClaim(runs);

  return (
    <div className="admin-runs">
      <h2>Runs by Claim</h2>
      <div className="admin-filters">
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
          <option value="">All agents</option>
          {["frontdesk", "claimsofficer", "assessor", "fraudanalyst", "finance", "assessor_vision"].map((a) => (
            <option key={a} value={a}>{agentName(a)}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="RUNNING">Running</option>
          <option value="SUCCEEDED">Succeeded</option>
          <option value="FAILED">Failed</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
      </div>

      <div className="claim-run-groups">
        {claimGroups.map((g) => (
          <ClaimRunGroup
            key={g.claim_id}
            group={g}
            onSelectRun={(id) => setSelectedRunId(id)}
          />
        ))}
        {claimGroups.length === 0 && (
          <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>No runs found</p>
        )}
      </div>
    </div>
  );
}
