/**
 * Ohio compliance deadline calculator per OAC 3901-1-54.
 *
 * Key timelines:
 * - 15 calendar days: acknowledge claim receipt
 * - 21 calendar days: accept or deny (after proof of loss)
 * - 45 calendar days: written status update if still pending
 * - 10 business days: tender payment after acceptance
 * - 60 calendar days: fraud report deadline (after proof of loss)
 */

function addCalendarDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addBusinessDays(from: Date, days: number): Date {
  let d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

export function computeDeadlines(claimCreatedAt: Date, proofOfLossReceivedAt?: Date) {
  const ack_due_at = addCalendarDays(claimCreatedAt, 15);

  let accept_deny_due_at: Date | undefined;
  let next_status_update_due_at: Date | undefined;
  let fraud_report_due_at: Date | undefined;

  if (proofOfLossReceivedAt) {
    accept_deny_due_at = addCalendarDays(proofOfLossReceivedAt, 21);
    next_status_update_due_at = addCalendarDays(proofOfLossReceivedAt, 45);
    fraud_report_due_at = addCalendarDays(proofOfLossReceivedAt, 60);
  }

  return {
    ack_due_at: ack_due_at.toISOString(),
    accept_deny_due_at: accept_deny_due_at?.toISOString(),
    next_status_update_due_at: next_status_update_due_at?.toISOString(),
    fraud_report_due_at: fraud_report_due_at?.toISOString(),
  };
}

export function computePaymentDeadline(acceptedAt: Date): string {
  return addBusinessDays(acceptedAt, 10).toISOString();
}

export function isDeadlineMet(deadline: string, now: Date = new Date()): boolean {
  return now <= new Date(deadline);
}
