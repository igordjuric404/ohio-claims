type Props = {
  claimId: string;
  onNewClaim: () => void;
};

export function ClientConfirmation({ claimId, onNewClaim }: Props) {
  return (
    <div className="client-confirmation">
      <div className="confirmation-card">
        <h1 className="confirmation-title">Form Submitted for Review</h1>

        <p className="confirmation-subtitle">
          Your claim has been received and is being processed. A reviewer will
          evaluate your submission and you will be contacted with the outcome.
        </p>

        <div className="confirmation-claim-id">
          <span className="label">Claim Reference</span>
          <span className="value">{claimId}</span>
        </div>

        <div className="confirmation-actions">
          <button className="btn btn-secondary" onClick={onNewClaim}>
            Submit Another Claim
          </button>
        </div>
      </div>
    </div>
  );
}
