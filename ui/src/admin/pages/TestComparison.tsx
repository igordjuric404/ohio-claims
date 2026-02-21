import { useState, useEffect } from "react";
import { getTestRuns, getTestRunDetail } from "../api";

type TestResult = {
  case_id: string;
  case_name: string;
  claim_id: string;
  expected_outcome: string;
  actual_outcome: string;
  final_stage: string;
  stages_completed: string[];
  errors: string[];
  match: boolean;
  has_image: boolean;
};

type TestRunSummary = {
  version: string;
  total: number;
  passed: number;
  failed: number;
  errors: number;
  results: TestResult[];
};

function ResultBadge({ match }: { match: boolean }) {
  return (
    <span className={`status-badge ${match ? "status-succeeded" : "status-failed"}`}>
      {match ? "PASS" : "FAIL"}
    </span>
  );
}

function ComparisonView({ runA, runB }: { runA: TestRunSummary; runB: TestRunSummary }) {
  const allCaseIds = Array.from(new Set([
    ...runA.results.map(r => r.case_id),
    ...runB.results.map(r => r.case_id),
  ])).sort();

  const resultsA = new Map(runA.results.map(r => [r.case_id, r]));
  const resultsB = new Map(runB.results.map(r => [r.case_id, r]));

  let matches = 0;
  let diffs = 0;
  for (const id of allCaseIds) {
    const a = resultsA.get(id);
    const b = resultsB.get(id);
    if (a && b && a.actual_outcome === b.actual_outcome && a.match === b.match) {
      matches++;
    } else {
      diffs++;
    }
  }

  const consistency = allCaseIds.length > 0 ? ((matches / allCaseIds.length) * 100).toFixed(1) : "0";

  return (
    <div>
      <div className="admin-stats-grid" style={{ marginBottom: "1rem" }}>
        <div className="admin-stat card">
          <span className="admin-stat-value">{consistency}%</span>
          <span className="admin-stat-label">Consistency</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{matches}</span>
          <span className="admin-stat-label">Matching</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{diffs}</span>
          <span className="admin-stat-label">Different</span>
        </div>
        <div className="admin-stat card">
          <span className="admin-stat-value">{allCaseIds.length}</span>
          <span className="admin-stat-label">Total Cases</span>
        </div>
      </div>

      <table className="admin-table admin-table-full">
        <thead>
          <tr>
            <th>Case</th>
            <th>Name</th>
            <th>Expected</th>
            <th>{runA.version} Outcome</th>
            <th>{runA.version} Match</th>
            <th>{runB.version} Outcome</th>
            <th>{runB.version} Match</th>
            <th>Same?</th>
          </tr>
        </thead>
        <tbody>
          {allCaseIds.map(id => {
            const a = resultsA.get(id);
            const b = resultsB.get(id);
            const same = a && b && a.actual_outcome === b.actual_outcome && a.match === b.match;
            return (
              <tr key={id} className={same ? "" : "comparison-diff-row"}>
                <td className="monospace">{id}</td>
                <td className="cell-ellipsis">{a?.case_name ?? b?.case_name ?? "—"}</td>
                <td>{a?.expected_outcome ?? b?.expected_outcome ?? "—"}</td>
                <td>{a?.actual_outcome ?? "—"}</td>
                <td>{a ? <ResultBadge match={a.match} /> : "—"}</td>
                <td>{b?.actual_outcome ?? "—"}</td>
                <td>{b ? <ResultBadge match={b.match} /> : "—"}</td>
                <td>
                  {same
                    ? <span className="status-badge status-succeeded">Same</span>
                    : <span className="status-badge status-failed">Diff</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TestComparison() {
  const [runs, setRuns] = useState<string[]>([]);
  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");
  const [runA, setRunA] = useState<TestRunSummary | null>(null);
  const [runB, setRunB] = useState<TestRunSummary | null>(null);
  const [_singleView, setSingleView] = useState<TestRunSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getTestRuns()
      .then(d => setRuns(d.versions ?? []))
      .catch(e => setError(e.message));
  }, []);

  const loadRun = async (version: string, target: "A" | "B" | "single") => {
    try {
      const data = await getTestRunDetail(version);
      if (target === "A") { setRunA(data); setSelectedA(version); }
      else if (target === "B") { setRunB(data); setSelectedB(version); }
      else { setSingleView(data); }
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="admin-test-comparison">
      <h2>Test Run Comparison</h2>
      {error && <div className="pipeline-error">{error}</div>}

      {runs.length === 0 ? (
        <p className="muted">No test runs found. Run the test script first: <code>./test-cases/run-tests.sh</code></p>
      ) : (
        <>
          <div className="admin-filters">
            <select value={selectedA} onChange={e => e.target.value && loadRun(e.target.value, "A")}>
              <option value="">Select Run A</option>
              {runs.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <span className="muted">vs</span>
            <select value={selectedB} onChange={e => e.target.value && loadRun(e.target.value, "B")}>
              <option value="">Select Run B</option>
              {runs.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {runA && runB && (
            <ComparisonView runA={runA} runB={runB} />
          )}

          {(runA && !runB) && (
            <div>
              <h3>{runA.version}: {runA.passed}/{runA.total} passed</h3>
              <table className="admin-table admin-table-full">
                <thead>
                  <tr>
                    <th>Case</th><th>Name</th><th>Expected</th><th>Actual</th><th>Stage</th><th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {runA.results.map(r => (
                    <tr key={r.case_id}>
                      <td className="monospace">{r.case_id}</td>
                      <td className="cell-ellipsis">{r.case_name}</td>
                      <td>{r.expected_outcome}</td>
                      <td>{r.actual_outcome}</td>
                      <td>{r.final_stage}</td>
                      <td><ResultBadge match={r.match} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
