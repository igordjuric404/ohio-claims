import type { ClaimEvent } from '../api';

type TimelineProps = {
  events: ClaimEvent[];
};

function getEventVariant(type: string): 'completed' | 'started' | 'error' {
  if (/COMPLETED|CLAIM_CREATED/.test(type)) return 'completed';
  if (/STARTED|STAGE_STARTED/.test(type)) return 'started';
  if (/ERROR|FAILED/.test(type)) return 'error';
  return 'started';
}

function formatEventSummary(type: string, data: unknown): string {
  if (typeof data !== 'object' || data === null) return type;

  const d = data as Record<string, unknown>;
  const parts: string[] = [];

  if (d.policy_id) parts.push(`Policy: ${d.policy_id}`);
  if (d.loss_date) parts.push(`Loss: ${d.loss_date}`);
  if (d.coverage_status) parts.push(`Coverage: ${d.coverage_status}`);
  if (d.final_outcome) parts.push(`Outcome: ${d.final_outcome}`);
  if (d.payment_status) parts.push(`Payment: ${d.payment_status}`);
  if (d.error) parts.push(String(d.error));
  if (d.agent) parts.push(`Agent: ${d.agent}`);

  if (parts.length > 0) return parts.join(' · ');
  return type;
}

function formatStage(stage: string): string {
  return stage
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function Timeline({ events }: TimelineProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="timeline timeline-empty">
        <p>No events yet</p>
      </div>
    );
  }

  return (
    <div className="timeline">
      {sorted.map((event, i) => {
        const variant = getEventVariant(event.type);
        const summary = formatEventSummary(event.type, event.data);
        const date = new Date(event.created_at);
        const timeStr = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const dateStr = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        return (
          <div
            key={event.event_sk || i}
            className={`timeline-item timeline-item--${variant}`}
          >
            <div className="timeline-item-marker" />
            <div className="timeline-item-content">
              <div className="timeline-item-header">
                <span className="timeline-item-stage">{formatStage(event.stage)}</span>
                <span className="timeline-item-time">
                  {dateStr} {timeStr}
                </span>
              </div>
              <div className="timeline-item-type">{event.type}</div>
              {summary && <div className="timeline-item-summary">{summary}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
