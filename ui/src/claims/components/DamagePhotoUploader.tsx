import { useState, useRef } from "react";

const BASE = "/api";

async function presignDamagePhoto(claimId: string, filename: string, contentType: string) {
  const res = await fetch(`${BASE}/claims/${claimId}/damage-photos/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content_type: contentType }),
  });
  if (!res.ok) throw new Error("Presign failed");
  return res.json() as Promise<{ upload_url: string; key: string }>;
}

async function getDamagePhotos(claimId: string) {
  const res = await fetch(`${BASE}/claims/${claimId}/damage-photos`);
  if (!res.ok) throw new Error("Failed to load photos");
  return res.json() as Promise<{ photos: string[] }>;
}

async function runAssessment(claimId: string) {
  const res = await fetch(`${BASE}/claims/${claimId}/assess`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Assessment failed" }));
    throw new Error(err.error);
  }
  return res.json();
}

export function DamagePhotoUploader({ claimId }: { claimId: string }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPhotos = async () => {
    const { photos: p } = await getDamagePhotos(claimId);
    setPhotos(p);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      for (const file of files) {
        const { upload_url } = await presignDamagePhoto(claimId, file.name, file.type);
        await fetch(upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      }
      await loadPhotos();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAssess = async () => {
    setAssessing(true);
    setError("");
    try {
      const result = await runAssessment(claimId);
      setReport(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAssessing(false);
    }
  };

  return (
    <div className="damage-uploader">
      <h3>Damage Photos & Assessment</h3>
      {error && <div className="pipeline-error">{error}</div>}

      <div className="damage-upload-section">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleUpload}
          style={{ display: "none" }}
        />
        <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading..." : "Upload Damage Photos"}
        </button>
        {photos.length > 0 && (
          <span className="muted">{photos.length} photo(s) uploaded</span>
        )}
      </div>

      {photos.length > 0 && (
        <div className="damage-photos-list">
          {photos.map((key) => (
            <div key={key} className="damage-photo-item">
              <span className="monospace">{key.split("/").pop()}</span>
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && !report && (
        <button className="btn btn-primary" onClick={handleAssess} disabled={assessing}>
          {assessing ? "Analyzing..." : "Run Damage Assessment"}
        </button>
      )}

      {report && (
        <div className="damage-report card">
          <h3>Assessment Report</h3>

          <div className="report-section">
            <h4>Detected Damage</h4>
            <table className="admin-table">
              <thead><tr><th>Part</th><th>Severity</th><th>Side</th><th>Description</th></tr></thead>
              <tbody>
                {(report.detected_damage ?? []).map((d: any, i: number) => (
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

          <div className="report-section">
            <h4>Parts Estimate</h4>
            <table className="admin-table">
              <thead><tr><th>Part</th><th>Qty</th><th>Condition</th><th>Low</th><th>High</th><th>Source</th></tr></thead>
              <tbody>
                {(report.parts ?? []).map((p: any, i: number) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{p.qty}</td>
                    <td>{p.condition_recommendation ?? p.pricing?.condition}</td>
                    <td>${p.pricing?.price_low}</td>
                    <td>${p.pricing?.price_high}</td>
                    <td>
                      {p.pricing?.web_sources ? (
                        <span className="status-badge status-succeeded" style={{ fontSize: "0.6rem" }}>web</span>
                      ) : (
                        <span className="status-badge" style={{ fontSize: "0.6rem", background: "rgba(145,145,141,0.15)", color: "#91918D" }}>simulated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="report-section">
            <h4>Totals</h4>
            <dl className="report-totals">
              <dt>Parts Range</dt><dd>${report.totals?.parts_total_range?.low} – ${report.totals?.parts_total_range?.high}</dd>
              <dt>Labor</dt><dd>${report.totals?.labor_total} ({report.labor_rate?.rate_per_hour}/hr)</dd>
              <dt>Estimate Range</dt><dd><strong>${report.totals?.estimate_range?.low} – ${report.totals?.estimate_range?.high}</strong></dd>
              <dt>ACV</dt><dd>${report.acv?.actual_cash_value}</dd>
              <dt>Total Loss?</dt>
              <dd>
                <span className={`status-badge ${report.total_loss?.recommended ? "status-failed" : "status-succeeded"}`}>
                  {report.total_loss?.recommended ? "YES" : "NO"}
                </span>
                <span className="muted" style={{ marginLeft: "0.5rem" }}>{report.total_loss?.basis}</span>
              </dd>
            </dl>
          </div>

          {/* Web Search Evidence Section */}
          {report.web_search && (report.web_search.citations?.length > 0 || report.web_search.queries?.length > 0) && (
            <div className="report-section">
              <h4>Web Search Evidence</h4>
              <div className="web-search-evidence">
                {report.web_search.queries?.length > 0 && (
                  <div className="ws-block">
                    <span className="ws-label">Search Queries</span>
                    <ul className="ws-queries">
                      {report.web_search.queries.map((q: string, i: number) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.web_search.citations?.length > 0 && (
                  <div className="ws-block">
                    <span className="ws-label">Sources Found ({report.web_search.citations.length})</span>
                    <div className="ws-citations">
                      {report.web_search.citations.map((c: any, i: number) => (
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
                  <span className={`status-badge ${report.web_search.pricing_source === "web_search" ? "status-succeeded" : ""}`}>
                    {report.web_search.pricing_source}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
