import { useState } from 'react';
import { ClaimForm } from './components/ClaimForm';
import { ClaimView } from './components/ClaimView';
import './App.css';

function App() {
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

export default App;
