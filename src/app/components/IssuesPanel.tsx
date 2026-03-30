import type { DataIssue } from '../../shared/types.ts';
import { displayContextKey, displayIssueLabel, displayIssueMessage, displayIssueSeverity, formatContextValue } from '../../shared/utils.ts';

export function IssuesPanel({ issues }: { issues: DataIssue[] }) {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const groupedIssues = Array.from(
    issues.reduce((map, issue) => {
      const bucket = map.get(issue.code) ?? { code: issue.code, severity: issue.severity, items: [] as DataIssue[] };
      bucket.items.push(issue);
      if (issue.severity === 'error') {
        bucket.severity = 'error';
      }
      map.set(issue.code, bucket);
      return map;
    }, new Map<string, { code: string; severity: DataIssue['severity']; items: DataIssue[] }>()),
  ).sort((left, right) => {
    if (left[1].severity !== right[1].severity) {
      return left[1].severity === 'error' ? -1 : 1;
    }
    return right[1].items.length - left[1].items.length;
  });

  return (
    <div className="card issues-card">
      <div className="section-header compact">
        <div>
          <p className="section-kicker">Kontrola jakosci</p>
          <h2>Problemy danych</h2>
        </div>
      </div>
      <p className="subtle-copy">Panel pokazuje tylko biezace bledy i ostrzezenia wynikajace z aktualnych danych oraz obliczen.</p>

      <div className="summary-card-grid compact-grid">
        <div className="summary-pill compact-pill"><span>Bledy</span><strong>{errorCount}</strong></div>
        <div className="summary-pill compact-pill"><span>Ostrzezenia</span><strong>{warningCount}</strong></div>
        <div className="summary-pill compact-pill"><span>Kody problemow</span><strong>{groupedIssues.length}</strong></div>
      </div>

      <div className="issues-list grouped-issues-list">
        {groupedIssues.map(([code, group]) => (
          <details key={code} className={group.severity === 'error' ? 'issue-group error' : 'issue-group warning'} open={group.severity === 'error'}>
            <summary>
              <span>{displayIssueLabel(code)}</span>
              <strong>{group.items.length}</strong>
            </summary>
            <div className="stack-md issue-group-body">
              {group.items.map((issue, index) => (
                <div key={`${issue.code}-${index}`} className={issue.severity === 'error' ? 'issue-box error' : 'issue-box warning'}>
                  <strong>{displayIssueSeverity(issue.severity)}</strong>
                  <p>{displayIssueMessage(issue)}</p>
                  {issue.context && <div className="context-row">{formatContext(issue.context)}</div>}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function formatContext(context: Record<string, unknown>) {
  return Object.entries(context).map(([key, value]) => {
    return <span key={key} className="context-chip">{displayContextKey(key)}: {formatContextValue(value)}</span>;
  });
}
