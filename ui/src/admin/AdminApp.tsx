import { useState, useEffect } from "react";
import { getMe, logout } from "./api";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Claims } from "./pages/Claims";
import { RunViewer } from "./pages/RunViewer";
import { Agents } from "./pages/Agents";
import { Audit } from "./pages/Audit";
import "./admin.css";

type AdminPage = "overview" | "claims" | "runs" | "agents" | "audit";

const NAV_ITEMS: { key: AdminPage; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "claims", label: "Claims" },
  { key: "runs", label: "Runs" },
  { key: "agents", label: "Agents" },
  { key: "audit", label: "Audit" },
];

export function AdminApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [page, setPage] = useState<AdminPage>("overview");

  useEffect(() => {
    getMe().then((me) => setAuthenticated(!!me)).catch(() => setAuthenticated(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    setAuthenticated(false);
  };

  if (authenticated === null) return <div className="admin-loading">Checking session...</div>;
  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;

  let content: React.ReactNode;
  switch (page) {
    case "claims": content = <Claims />; break;
    case "runs": content = <RunViewer />; break;
    case "agents": content = <Agents />; break;
    case "audit": content = <Audit />; break;
    default: content = <Overview />;
  }

  return (
    <div className="admin-layout">
      <nav className="admin-sidebar">
        <div className="admin-logo">
          <h2>Admin</h2>
          <span className="muted">Ohio Claims</span>
        </div>
        <ul className="admin-nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.key}>
              <button
                className={`admin-nav-btn ${page === item.key ? "active" : ""}`}
                onClick={() => setPage(item.key)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="admin-sidebar-footer">
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </nav>
      <main className="admin-main">
        {content}
      </main>
    </div>
  );
}
