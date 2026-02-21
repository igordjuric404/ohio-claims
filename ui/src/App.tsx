import { useState } from 'react';
import { ClaimForm } from './components/ClaimForm';
import { ClaimView } from './components/ClaimView';
import { AutomaticIntakePage } from './intake/AutomaticIntakePage';
import { AdminApp } from './admin/AdminApp';
import './App.css';

type Tab = 'manual' | 'auto-intake';

function PublicApp() {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('manual');

  if (selectedClaimId) {
    return (
      <ClaimView
        claimId={selectedClaimId}
        onBack={() => setSelectedClaimId(null)}
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
        <ClaimForm onSuccess={(claimId) => setSelectedClaimId(claimId)} />
      ) : (
        <AutomaticIntakePage onClaimCreated={(claimId) => setSelectedClaimId(claimId)} />
      )}
    </div>
  );
}

function App() {
  const isAdmin = window.location.pathname.startsWith('/admin');
  if (isAdmin) return <AdminApp />;
  return <PublicApp />;
}

export default App;
