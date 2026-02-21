import { useState, useEffect } from 'react';
import { getClaim, runPipeline, type Claim, type ClaimEvent, type PipelineResult } from '../api';
import { Timeline } from './Timeline';
import { DamagePhotoUploader } from '../claims/components/DamagePhotoUploader';
import { stageName } from '../admin/displayNames';
import { formatDateTime } from '../lib/fieldLabels';

type ClaimViewProps = {
  claimId: string;
  onBack: () => void;
};

function canRunPipeline(stage: string): boolean {
  return stage === "FNOL_SUBMITTED";
}

export function ClaimView({ claimId, onBack }: ClaimViewProps) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [events, setEvents] = useState<ClaimEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const fetchClaim = async () => {
    try {
      const { claim: c, events: e } = await getClaim(claimId);
      setClaim(c);
      setEvents(e);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claim');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaim();
  }, [claimId]);

  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineError(null);
    setPipelineResult(null);
    try {
      const result = await runPipeline(claimId);
      setPipelineResult(result);
      await fetchClaim();
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Pipeline failed');
    } finally {
      setPipelineRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="claim-view claim-view--loading">
        <div className="loading-spinner" />
        <p>Loading claim...</p>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="claim-view claim-view--error">
        <button onClick={onBack} className="btn btn-secondary">← Back</button>
        <div className="card card--error">
          <p>{error || 'Claim not found'}</p>
        </div>
      </div>
    );
  }

  const comp = claim.compliance;
  const deadlines = [
    comp.ack_due_at && { label: 'Ack Due', value: comp.ack_due_at },
    comp.accept_deny_due_at && { label: 'Accept/Deny Due', value: comp.accept_deny_due_at },
    comp.next_status_update_due_at && { label: 'Status Update Due', value: comp.next_status_update_due_at },
    comp.payment_due_at && { label: 'Payment Due', value: comp.payment_due_at },
  ].filter(Boolean) as { label: string; value: string }[];

  const showPipelineBtn = canRunPipeline(claim.stage) && !pipelineResult;

  return (
    <div className="claim-view">
      <div className="claim-view-header">
        <button onClick={onBack} className="btn btn-secondary btn-back">← Back</button>
        <h1>Claim {claim.claim_id}</h1>
        <span className={`claim-view-stage claim-view-stage--${claim.stage.toLowerCase().replace(/_/g, '-')}`}>
          {stageName(claim.stage)}
        </span>
      </div>

      <div className="claim-view-grid">
        <section className="card claim-detail">
          <h2>Claim Details</h2>
          <dl className="claim-detail-list">
            <dt>Policy</dt>
            <dd>{claim.policy_id}</dd>
            <dt>Created</dt>
            <dd>{formatDateTime(claim.created_at)}</dd>
            <dt>Claimant</dt>
            <dd>{claim.claimant.full_name}</dd>
            <dt>Phone</dt>
            <dd>{claim.claimant.phone}</dd>
            {claim.claimant.email && (
              <>
                <dt>Email</dt>
                <dd>{claim.claimant.email}</dd>
              </>
            )}
            <dt>Loss Date</dt>
            <dd>{claim.loss.date_of_loss}</dd>
            {claim.loss.city && (
              <>
                <dt>City</dt>
                <dd>{claim.loss.city}</dd>
              </>
            )}
            <dt>Description</dt>
            <dd className="claim-detail-desc">{claim.loss.description || '—'}</dd>
            {(claim.vehicle.year || claim.vehicle.make || claim.vehicle.model) && (
              <>
                <dt>Vehicle</dt>
                <dd>
                  {[claim.vehicle.year, claim.vehicle.make, claim.vehicle.model].filter(Boolean).join(' ')}
                </dd>
              </>
            )}
          </dl>
        </section>

        <section className="card claim-compliance">
          <h2>Compliance Deadlines</h2>
          {deadlines.length > 0 ? (
            <ul className="deadline-list">
              {deadlines.map((d) => (
                <li key={d.label}>
                  <span className="deadline-label">{d.label}</span>
                  <span className="deadline-value">{formatDateTime(d.value)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No deadlines set</p>
          )}
        </section>

        <section className="card claim-pipeline">
          <h2>Pipeline</h2>
          {showPipelineBtn ? (
            <button
              onClick={handleRunPipeline}
              disabled={pipelineRunning}
              className="btn btn-primary btn-pipeline"
            >
              {pipelineRunning ? (
                <>
                  <span className="btn-spinner" />
                  Running...
                </>
              ) : (
                'Run Pipeline'
              )}
            </button>
          ) : !pipelineResult ? (
            <p className="pipeline-completed-msg">
              Pipeline already completed — stage: <strong>{stageName(claim.stage)}</strong>
            </p>
          ) : null}
          {pipelineError && (
            <div className="pipeline-error" role="alert">
              {pipelineError}
            </div>
          )}
          {pipelineResult && (
            <div className="pipeline-result">
              <h3>Results</h3>
              {pipelineResult.errors.length > 0 && (
                <ul className="pipeline-errors">
                  {pipelineResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              <p>
                <strong>Final stage:</strong> {stageName(pipelineResult.final_stage)}
              </p>
              {pipelineResult.stages_completed.length > 0 && (
                <p>
                  <strong>Stages completed:</strong> {pipelineResult.stages_completed.map(s => stageName(s)).join(' → ')}
                </p>
              )}
              {Object.keys(pipelineResult.stage_outputs).length > 0 && (
                <details className="stage-outputs">
                  <summary>Stage outputs</summary>
                  <pre>{JSON.stringify(pipelineResult.stage_outputs, null, 2)}</pre>
                </details>
              )}
            </div>
          )}
        </section>

        <section className="card claim-damage">
          <DamagePhotoUploader claimId={claim.claim_id} />
        </section>

        <section className="card claim-timeline">
          <h2>Audit Timeline</h2>
          <Timeline events={events} />
        </section>
      </div>
    </div>
  );
}
