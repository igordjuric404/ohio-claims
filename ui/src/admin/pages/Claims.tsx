import { useState, useEffect } from "react";
import { getClaims, getClaimDetail, getClaimPhotos } from "../api";
import { agentName, stageName, fieldLabel, formatFieldValue } from "../displayNames";
import { TruncatedValue } from "../components/TruncatedValue";
import { useSort, SortTh } from "../components/SortableHeader";

const PIPELINE_STAGES_CORE = [
  "FNOL_SUBMITTED",
  "FRONTDESK_DONE",
  "COVERAGE_DONE",
  "ASSESSMENT_DONE",
  "FRAUD_DONE",
  "PENDING_REVIEW",
  "FINAL_DECISION_DONE",
];

function getVisibleStages(claimStage: string): string[] {
  const stages = [...PIPELINE_STAGES_CORE];
  if (claimStage === "PAID") {
    stages.push("PAID");
  } else if (claimStage === "CLOSED_NO_PAY") {
    stages.push("CLOSED_NO_PAY");
  } else {
    stages.push("PAID");
  }
  return stages;
}

function PhotoGallery({ claimId }: { claimId: string }) {
  const [photos, setPhotos] = useState<{ key: string; filename: string; url: string }[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClaimPhotos(claimId)
      .then((d) => setPhotos(d.photos ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [claimId]);

  if (loading) return <p className="muted">Loading photos...</p>;
  if (photos.length === 0) return <p className="muted">No damage photos uploaded</p>;

  return (
    <>
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
    </>
  );
}

function ClaimDetailView({ claim, runs, events, onBack, onNavigate }: {
  claim: any; runs: any[]; events: any[]; onBack: () => void;
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}) {
  const visibleStages = getVisibleStages(claim.stage);
  const currentIdx = visibleStages.indexOf(claim.stage);

  const srEvent = events.find(
    (e: any) => e.stage === "FINAL_DECISION_DONE" && e.type === "STAGE_COMPLETED"
  );
  const decisionData = srEvent?.data ?? null;

  return (
    <div className="admin-claim-detail">
      <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back to list</button>

      <div className="claim-detail-header">
        <h2>{claim.claim_id}</h2>
        <span className={`status-badge stage-${claim.stage?.toLowerCase().replace(/_/g, "-")}`}>
          {stageName(claim.stage)}
        </span>
      </div>

      <div className="stage-stepper">
        {visibleStages.map((s, i) => {
          const isCurrent = s === claim.stage;
          const isDone = i < currentIdx || (i === currentIdx && (s === "PAID" || s === "CLOSED_NO_PAY"));
          return (
            <div key={s} className={`stage-step ${isDone ? "stage-step-done" : ""} ${isCurrent ? "stage-step-current" : ""}`}>
              <div className="stage-step-dot" />
              <span className="stage-step-label">{stageName(s)}</span>
            </div>
          );
        })}
      </div>

      <div className="admin-detail-grid">
        <div className="card">
          <h3>Claim Details</h3>
          <dl className="claim-kv">
            <dt>Policy</dt><dd>{claim.policy_id}</dd>
            <dt>Created</dt><dd>{claim.created_at ? new Date(claim.created_at).toLocaleString() : "—"}</dd>
            {claim.claimant && <>
              <dt>Claimant</dt><dd>{claim.claimant.full_name}</dd>
              <dt>Phone</dt><dd>{claim.claimant.phone}</dd>
              {claim.claimant.email && <><dt>Email</dt><dd>{claim.claimant.email}</dd></>}
              {claim.claimant.address && <><dt>Address</dt><dd>{claim.claimant.address}</dd></>}
            </>}
            {claim.loss && <>
              <dt>Date of Loss</dt><dd>{claim.loss.date_of_loss}</dd>
              {claim.loss.city && <><dt>City</dt><dd>{claim.loss.city}</dd></>}
              <dt>Description</dt><dd className="claim-desc-wrap">{claim.loss.description || "—"}</dd>
            </>}
            {claim.vehicle && <>
              <dt>Vehicle</dt><dd>{[claim.vehicle.year, claim.vehicle.make, claim.vehicle.model].filter(Boolean).join(" ") || "—"}</dd>
              {claim.vehicle.vin && <><dt>VIN</dt><dd><TruncatedValue value={claim.vehicle.vin} maxLen={24} mono /></dd></>}
            </>}
          </dl>
        </div>

        <div className="card">
          <h3>Decision</h3>
          {decisionData ? (
            <dl className="claim-kv">
              <dt>{fieldLabel("final_outcome")}</dt>
              <dd>
                <span className={`status-badge ${decisionData.final_outcome === "approve" ? "status-succeeded" : "status-failed"}`}>
                  {formatFieldValue("final_outcome", decisionData.final_outcome)}
                </span>
              </dd>
              {decisionData.rationale && <><dt>{fieldLabel("rationale")}</dt><dd className="claim-desc-wrap">{decisionData.rationale}</dd></>}
              {decisionData.approve_amount_cap != null && <><dt>{fieldLabel("approve_amount_cap")}</dt><dd>{formatFieldValue("approve_amount_cap", decisionData.approve_amount_cap)}</dd></>}
              {decisionData.confidence != null && <><dt>{fieldLabel("confidence")}</dt><dd>{formatFieldValue("confidence", decisionData.confidence)}</dd></>}
              {decisionData.needs_human_review != null && <><dt>{fieldLabel("needs_human_review")}</dt><dd>{formatFieldValue("needs_human_review", decisionData.needs_human_review)}</dd></>}
              {decisionData.required_actions?.length > 0 && <><dt>{fieldLabel("required_actions")}</dt><dd>{formatFieldValue("required_actions", decisionData.required_actions)}</dd></>}
            </dl>
          ) : claim.stage === "FNOL_SUBMITTED" ? (
            <p className="muted">Pipeline not yet started</p>
          ) : currentIdx < PIPELINE_STAGES_CORE.indexOf("FINAL_DECISION_DONE") ? (
            <p className="muted">Awaiting review</p>
          ) : (
            <p className="muted">Decision data not available</p>
          )}
        </div>

        <div className="card">
          <h3>Runs ({runs.length})</h3>
          {runs.length > 0 ? (
            <div className="admin-events-list">
              {runs.map((r: any) => (
                <div key={r.run_id} className="admin-run-item clickable" onClick={() => onNavigate?.("runs", { selected: r.run_id })}>
                  <span className={`status-badge status-${(r.status ?? "").toLowerCase()}`}>{r.status}</span>
                  <span>{agentName(r.agent_id)}</span>
                  <span className="muted">{r.duration_ms ?? "—"}ms</span>
                  <span className="muted">{r.usage?.total_tokens ?? "—"} tok</span>
                </div>
              ))}
            </div>
          ) : claim.stage !== "FNOL_SUBMITTED" ? (
            <p className="muted">No runs recorded (claim predates run tracking)</p>
          ) : (
            <p className="muted">No runs yet — start the pipeline</p>
          )}
        </div>

        <div className="card">
          <h3>Damage Photos</h3>
          <PhotoGallery claimId={claim.claim_id} />
        </div>

        <div className="card">
          <h3>Audit Trail ({events.length})</h3>
          <div className="admin-events-list">
            {events.map((e: any, i: number) => (
              <div key={i} className="admin-event-item">
                <span className={`event-type-badge event-type-${e.type?.toLowerCase().replace(/_/g, "-")}`}>{e.type}</span>
                <span className="muted">{stageName(e.stage)}</span>
                <span className="muted">{e.created_at ? new Date(e.created_at).toLocaleTimeString() : "—"}</span>
              </div>
            ))}
            {events.length === 0 && <p className="muted">No events</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Claims({ onNavigate, initialParams }: {
  onNavigate?: (page: string, params?: Record<string, string>) => void;
  initialParams?: Record<string, string>;
}) {
  const [claims, setClaims] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [selectedRuns, setSelectedRuns] = useState<any[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<any[]>([]);
  const [stageFilter, setStageFilter] = useState(initialParams?.stage ?? "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const { sorted, sort, toggle } = useSort(claims, "created_at", "desc");

  const loadClaims = () => {
    const params: Record<string, string> = { limit: "50" };
    if (stageFilter) params.stage = stageFilter;
    if (search) params.search = search;
    getClaims(params).then((d) => setClaims(d.claims)).catch((e) => setError(e.message));
  };

  useEffect(loadClaims, [stageFilter]);

  useEffect(() => {
    if (initialParams?.selected) {
      handleSelect(initialParams.selected);
    }
  }, [initialParams?.selected]);

  const handleSelect = async (id: string) => {
    try {
      const detail = await getClaimDetail(id);
      setSelected(detail.claim);
      setSelectedRuns(detail.runs ?? []);
      setSelectedEvents(detail.events ?? []);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (selected) {
    return (
      <ClaimDetailView
        claim={selected}
        runs={selectedRuns}
        events={selectedEvents}
        onBack={() => { setSelected(null); loadClaims(); }}
        onNavigate={onNavigate}
      />
    );
  }

  const ALL_STAGES = [...PIPELINE_STAGES_CORE, "PAID", "CLOSED_NO_PAY"];

  return (
    <div className="admin-claims">
      <h2>Claims Explorer</h2>
      {error && <div className="pipeline-error">{error}</div>}
      <div className="admin-filters">
        <input
          type="text"
          placeholder="Search claim ID or policy"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadClaims()}
        />
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">All stages</option>
          {ALL_STAGES.map(s => <option key={s} value={s}>{stageName(s)}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={loadClaims}>Refresh</button>
      </div>
      <table className="admin-table admin-table-full table-fixed">
        <thead>
          <tr>
            <SortTh col="claim_id" label="Claim ID" sort={sort} onToggle={toggle} className="col-id" />
            <SortTh col="policy_id" label="Policy" sort={sort} onToggle={toggle} className="col-policy" />
            <SortTh col="claimant_name" label="Claimant" sort={sort} onToggle={toggle} className="col-claimant" />
            <SortTh col="stage" label="Stage" sort={sort} onToggle={toggle} className="col-stage" />
            <SortTh col="created_at" label="Created" sort={sort} onToggle={toggle} className="col-date" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((c: any) => (
            <tr key={c.claim_id} onClick={() => handleSelect(c.claim_id)} className="clickable">
              <td><TruncatedValue value={c.claim_id} maxLen={18} mono /></td>
              <td>{c.policy_id}</td>
              <td className="cell-ellipsis">{c.claimant?.full_name ?? "—"}</td>
              <td><span className={`status-badge stage-${(c.stage ?? "").toLowerCase().replace(/_/g, "-")}`}>{stageName(c.stage ?? "")}</span></td>
              <td>{c.created_at ? new Date(c.created_at).toLocaleString() : "—"}</td>
            </tr>
          ))}
          {claims.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: "2rem" }}>No claims found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
