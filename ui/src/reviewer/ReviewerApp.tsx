import { useState, useEffect, useCallback } from "react";
import { reviewerApi } from "./api";
import { ReviewerDashboard } from "./pages/ReviewerDashboard";
import { ReviewerClaimDetail } from "./pages/ReviewerClaimDetail";
import "../admin/admin.css";

type ReviewerPage = "dashboard" | "claim-detail";

export function ReviewerApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [page, setPage] = useState<ReviewerPage>("dashboard");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  useEffect(() => {
    reviewerApi.getMe().then((me) => setAuthenticated(!!me)).catch(() => setAuthenticated(false));
  }, []);

  const navigateToClaim = useCallback((claimId: string) => {
    setSelectedClaimId(claimId);
    setPage("claim-detail");
  }, []);

  const navigateBack = useCallback(() => {
    setSelectedClaimId(null);
    setPage("dashboard");
  }, []);

  const handleLogout = async () => {
    await reviewerApi.logout();
    setAuthenticated(false);
  };

  if (authenticated === null) return <div className="admin-loading">Checking session...</div>;
  if (!authenticated) return <ReviewerLogin onLogin={() => setAuthenticated(true)} />;

  return (
    <div className="admin-layout">
      <nav className="admin-sidebar">
        <div className="admin-logo">
          <h2>Ohio Claims</h2>
          <span className="muted">Senior Reviewer</span>
        </div>
        <ul className="admin-nav">
          <li>
            <button
              className={`admin-nav-btn ${page === "dashboard" ? "active" : ""}`}
              onClick={navigateBack}
            >
              <span className="admin-nav-icon">◈</span>
              Claims
            </button>
          </li>
        </ul>
        <div className="admin-sidebar-footer">
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </nav>
      <main className="admin-main">
        {page === "claim-detail" && selectedClaimId ? (
          <ReviewerClaimDetail
            claimId={selectedClaimId}
            onBack={navigateBack}
          />
        ) : (
          <ReviewerDashboard onSelectClaim={navigateToClaim} />
        )}
      </main>
    </div>
  );
}

function ReviewerLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await reviewerApi.login(password);
      onLogin();
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <form className="admin-login-form" onSubmit={handleSubmit}>
        <h2>Senior Reviewer</h2>
        <p className="muted">Sign in to review claims</p>
        {error && <div className="pipeline-error">{error}</div>}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
