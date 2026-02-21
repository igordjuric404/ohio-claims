import { useState } from 'react';
import { ClaimForm } from './components/ClaimForm';
import { ClaimView } from './components/ClaimView';
import { AdminApp } from './admin/AdminApp';
import './App.css';

function PublicApp() {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  if (selectedClaimId) {
    return (
      <ClaimView
        claimId={selectedClaimId}
        onBack={() => setSelectedClaimId(null)}
      />
    );
  }

  return <ClaimForm onSuccess={(claimId) => setSelectedClaimId(claimId)} />;
}

function App() {
  const isAdmin = window.location.pathname.startsWith('/admin');
  if (isAdmin) return <AdminApp />;
  return <PublicApp />;
}

export default App;
