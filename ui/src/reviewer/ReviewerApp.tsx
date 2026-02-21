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
    reviewerApi
      .getMe()
      .then(async (me) => {
        if (me) {
          setAuthenticated(true);
        } else {
          try {
            await reviewerApi.login("");
            setAuthenticated(true);
          } catch {
            setAuthenticated(false);
          }
        }
      })
      .catch(async () => {
        try {
          await reviewerApi.login("");
          setAuthenticated(true);
        } catch {
          setAuthenticated(false);
        }
      });
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
  if (!authenticated) return <div className="admin-loading">Signing in...</div>;

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
