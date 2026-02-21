import { useState, useEffect, useCallback } from "react";
import { getMe, logout } from "./api";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Claims } from "./pages/Claims";
import { RunViewer } from "./pages/RunViewer";
import { Agents } from "./pages/Agents";
import { Audit } from "./pages/Audit";
import { TestComparison } from "./pages/TestComparison";
import "./admin.css";

type AdminPage = "overview" | "claims" | "runs" | "agents" | "audit" | "tests";

const NAV_ITEMS: { key: AdminPage; label: string; icon: string }[] = [
  { key: "overview", label: "Dashboard", icon: "◉" },
  { key: "claims", label: "Claims", icon: "◈" },
  { key: "runs", label: "Runs", icon: "▶" },
  { key: "agents", label: "Agents", icon: "◎" },
  { key: "audit", label: "Audit", icon: "◇" },
  { key: "tests", label: "Tests", icon: "◆" },
];

function parseHash(): { page: AdminPage; params: Record<string, string> } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash) return { page: "overview", params: {} };
  const [pagePart, queryPart] = hash.split("?");
  const page = (NAV_ITEMS.find(n => n.key === pagePart) ? pagePart : "overview") as AdminPage;
  const params: Record<string, string> = {};
  if (queryPart) {
    new URLSearchParams(queryPart).forEach((v, k) => { params[k] = v; });
  }
  return { page, params };
}

export function AdminApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [page, setPage] = useState<AdminPage>("overview");
  const [pageParams, setPageParams] = useState<Record<string, string>>({});

  useEffect(() => {
    getMe().then((me) => setAuthenticated(!!me)).catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    const initial = parseHash();
    setPage(initial.page);
    setPageParams(initial.params);

    const onHashChange = () => {
      const parsed = parseHash();
      setPage(parsed.page);
      setPageParams(parsed.params);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigateTo = useCallback((target: string, params?: Record<string, string>) => {
    const qs = params && Object.keys(params).length > 0
      ? "?" + new URLSearchParams(params).toString()
      : "";
    window.location.hash = `#/${target}${qs}`;
  }, []);

  const handleLogout = async () => {
    await logout();
    setAuthenticated(false);
  };

  if (authenticated === null) return <div className="admin-loading">Checking session...</div>;
  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;

  let content: React.ReactNode;
  switch (page) {
    case "claims": content = <Claims key={`claims-${JSON.stringify(pageParams)}`} onNavigate={navigateTo} initialParams={pageParams} />; break;
    case "runs": content = <RunViewer key={`runs-${JSON.stringify(pageParams)}`} onNavigate={navigateTo} initialParams={pageParams} />; break;
    case "agents": content = <Agents onNavigate={navigateTo} />; break;
    case "audit": content = <Audit key={`audit-${JSON.stringify(pageParams)}`} onNavigate={navigateTo} initialParams={pageParams} />; break;
    case "tests": content = <TestComparison />; break;
    default: content = <Overview onNavigate={navigateTo} />;
  }

  return (
    <div className="admin-layout">
      <nav className="admin-sidebar">
        <div className="admin-logo">
          <h2>Ohio Claims</h2>
          <span className="muted">Admin Console</span>
        </div>
        <ul className="admin-nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.key}>
              <button
                className={`admin-nav-btn ${page === item.key ? "active" : ""}`}
                onClick={() => navigateTo(item.key)}
              >
                <span className="admin-nav-icon">{item.icon}</span>
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
