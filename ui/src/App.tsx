import { useState } from 'react';
import { ClaimForm } from './components/ClaimForm';
import { ClientConfirmation } from './components/ClientConfirmation';
import { AutomaticIntakePage } from './intake/AutomaticIntakePage';
import { AdminApp } from './admin/AdminApp';
import { ReviewerApp } from './reviewer/ReviewerApp';
import { runPipeline } from './api';
import './App.css';

type Tab = 'manual' | 'auto-intake';

function PublicApp() {
  const [submittedClaimId, setSubmittedClaimId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('manual');

  const handleClaimSubmitted = async (claimId: string) => {
    setSubmittedClaimId(claimId);
    try {
      await runPipeline(claimId);
    } catch {
      // Pipeline errors are non-blocking for the client; reviewer will handle
    }
  };

  if (submittedClaimId) {
    return (
      <ClientConfirmation
        claimId={submittedClaimId}
        onNewClaim={() => setSubmittedClaimId(null)}
      />
    );
  }

  return (
    <div>
      <nav className="public-tabs">
        <button
          className={`tab-btn ${tab === 'manual' ? 'active' : ''}`}
          onClick={() => setTab('manual')}
        >
          Manual FNOL
        </button>
        <button
          className={`tab-btn ${tab === 'auto-intake' ? 'active' : ''}`}
          onClick={() => setTab('auto-intake')}
        >
          Automatic Intake
        </button>
      </nav>
      {tab === 'manual' ? (
        <ClaimForm onSuccess={handleClaimSubmitted} />
      ) : (
        <AutomaticIntakePage onClaimCreated={handleClaimSubmitted} />
      )}
    </div>
  );
}

function App() {
  const isAdmin = window.location.pathname.startsWith('/admin');
  const isReviewer = window.location.pathname.startsWith('/reviewer');
  if (isAdmin) return <AdminApp />;
  if (isReviewer) return <ReviewerApp />;
  return <PublicApp />;
}

export default App;
