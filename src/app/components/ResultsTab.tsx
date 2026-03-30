import type { CalculationRow, CalculationResult, DataIssue } from '../../shared/types.ts';
import { buildReportViewModel, formatResolvedComponents, summarizeIssues } from '../../shared/report.ts';
import { displayGroupLabel, displayIssueLabel, displayIssueMessage } from '../../shared/utils.ts';
import { meterFormatter } from '../helpers.ts';

export function ResultsTab(props: {
  configurationName: string;
  calculation: CalculationResult;
  selections: Record<string, string>;
  issues: DataIssue[];
  onExport: (kind: 'pdf' | 'xlsx') => void;
}) {
  const report = buildReportViewModel({
    configurationName: props.configurationName,
    generatedAt: new Date().toISOString(),
    selections: props.selections,
    result: props.calculation,
    issues: props.issues,
  });
  const calculationRows = [...report.reportRows, ...report.hiddenRows].sort((left, right) => left.lp - right.lp);
  const issueSummary = summarizeIssues(report.issues);
  const grandTotalM = report.summary.reduce((sum, entry) => sum + entry.totalM, 0);

  return (
    <div className="stack-lg">
      <div className="card section-card report-shell-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Dokument</p>
            <h2>Raport przewodów</h2>
          </div>
          <div className="inline-actions">
            <button className="ghost-button" onClick={() => props.onExport('xlsx')}>
              Eksport XLSX
            </button>
            <button className="primary-button" onClick={() => props.onExport('pdf')}>
              Eksport PDF
            </button>
          </div>
        </div>

        <div className="report-metric-grid">
          <div className="report-metric-card">
            <span>Wariant</span>
            <strong>{report.selections.wlk ?? '-'}</strong>
          </div>
          <div className={report.metrics.readyForExport ? 'report-metric-card tone-ready' : 'report-metric-card tone-warning'}>
            <span>Status</span>
            <strong>{report.metrics.readyForExport ? 'Gotowy do wydruku' : 'Wymaga uwagi'}</strong>
          </div>
          <div className="report-metric-card">
            <span>Pozycje raportowe</span>
            <strong>{report.metrics.reportRowCount}</strong>
          </div>
          <div className="report-metric-card">
            <span>Łącznie [m]</span>
            <strong>{meterFormatter.format(grandTotalM)}</strong>
          </div>
        </div>

        <div className={report.metrics.readyForExport ? 'report-status-banner success' : 'report-status-banner warning'}>
          <strong>{report.metrics.readyForExport ? 'Dokument jest gotowy do wydruku.' : 'Dokument wymaga przeglądu danych.'}</strong>
          <p>
            {report.metrics.readyForExport
              ? 'Wszystkie pozycje raportowe mają wyliczone długości, a dane nie zawierają błędów blokujących.'
              : `Braki danych: ${report.metrics.unresolvedRowCount}, błędy: ${report.metrics.errorCount}, ostrzeżenia: ${report.metrics.warningCount}.`}
          </p>
        </div>
      </div>

      <div className="report-split-grid">
        <div className="card section-card">
          <div className="section-header compact">
            <div>
              <p className="section-kicker">Wejście</p>
              <h2>Konfiguracja</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table compact-table report-table-soft">
              <thead>
                <tr><th>Element</th><th>Wartość</th></tr>
              </thead>
              <tbody>
                {Object.entries(report.selections).map(([key, value]) => (
                  <tr key={key}>
                    <td><strong>{displayGroupLabel(key)}</strong></td>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card section-card">
          <div className="section-header compact">
            <div>
              <p className="section-kicker">Zestawienie</p>
              <h2>Typy kabli</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table compact-table report-table-soft">
              <thead>
                <tr><th>Typ kabla</th><th>Łącznie [m]</th><th>Udział [%]</th></tr>
              </thead>
              <tbody>
                {report.summary.map((entry) => (
                  <tr key={entry.cableType}>
                    <td>{entry.cableType}</td>
                    <td>{meterFormatter.format(entry.totalM)}</td>
                    <td>{formatShare(entry.totalM, grandTotalM)}</td>
                  </tr>
                ))}
                {report.summary.length === 0 && (
                  <tr>
                    <td colSpan={3}>Brak pozycji do podsumowania.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card section-card">
        <div className="section-header compact">
          <div>
            <p className="section-kicker">Produkcja</p>
            <h2>Lista przewodów</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table report-table report-table-soft">
            <thead>
              <tr>
                <th>Lp</th>
                <th>Element</th>
                <th>Typ kabla</th>
                <th>Długość [m]</th>
              </tr>
            </thead>
            <tbody>
              {report.reportRows.map((row) => (
                <tr key={`${row.lp}-${row.element}`} className={row.sumM === null ? 'row-missing' : ''}>
                  <td>{row.lp}</td>
                  <td>{row.element}</td>
                  <td>{row.cableType ?? 'brak typu'}</td>
                  <td>{row.sumM === null ? 'brak danych' : meterFormatter.format(row.sumM)}</td>
                </tr>
              ))}
              {report.reportRows.length === 0 && (
                <tr>
                  <td colSpan={4}>Brak pozycji raportowych dla bieżącej konfiguracji.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {report.hiddenRows.length > 0 && (
          <p className="subtle-copy report-footnote">
            Poza raportem pozostaje {report.hiddenRows.length} aktywnych pozycji oznaczonych jako ukryte.
          </p>
        )}
      </div>

      <div className="card section-card">
        <div className="section-header compact">
          <div>
            <p className="section-kicker">Wyjasnialnosc</p>
            <h2>Logika obliczen</h2>
          </div>
        </div>
        <div className="logic-list">
          {calculationRows.map((row) => (
            <RowLogicDetails key={`${row.lp}-${row.element}-logic`} row={row} />
          ))}
          {calculationRows.length === 0 && (
            <div className="report-status-banner warning compact-banner">
              <strong>Brak aktywnych pozycji do wyjasnienia.</strong>
              <p>Zmien konfiguracje, aby zobaczyc aktywowane reguly i logike obliczen.</p>
            </div>
          )}
        </div>
      </div>

      <div className="card section-card">
        <div className="section-header compact">
          <div>
            <p className="section-kicker">Kontrola</p>
            <h2>Problemy danych</h2>
          </div>
        </div>
        {issueSummary.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table compact-table report-table-soft">
              <thead>
                <tr><th>Problem</th><th>Liczba</th><th>Opis</th></tr>
              </thead>
              <tbody>
                {issueSummary.map((issue) => {
                  const sample = report.issues.find((item) => item.code === issue.code);
                  return (
                    <tr key={issue.code}>
                      <td>{displayIssueLabel(issue.code)}</td>
                      <td>{issue.count}</td>
                      <td>{sample ? displayIssueMessage(sample) : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="report-status-banner success compact-banner">
            <strong>Brak zarejestrowanych problemów danych.</strong>
            <p>Raport nie zgłasza błędów ani ostrzeżeń dla tej konfiguracji.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RowLogicDetails({ row }: { row: CalculationRow }) {
  return (
    <details className={row.sumM === null ? 'logic-row warning' : 'logic-row'} open={row.sumM === null}>
      <summary className="logic-summary">
        <div>
          <strong>{row.lp}. {row.element}</strong>
          <p>{row.cableType ?? 'brak typu kabla'} | {row.showInReport ? 'pozycja raportowa' : 'pozycja ukryta'}</p>
        </div>
        <span className={row.sumM === null ? 'status-badge warning' : 'status-badge success'}>
          {row.sumM === null ? 'Brak wyniku' : `${meterFormatter.format(row.sumM)} m`}
        </span>
      </summary>

      <div className="logic-grid">
        <div className="logic-block">
          <p className="section-kicker">Aktywacja</p>
          <p>{row.activatedBy.join(' | ')}</p>
        </div>
        <div className="logic-block">
          <p className="section-kicker">Index i dystans</p>
          <strong>{row.indexCode ?? '-'}</strong>
          <p className="subtle-copy">
            {row.distanceFromPanelMm === null
              ? 'Brak mapowania od panelu.'
              : `Odleglosc od panelu: ${row.distanceFromPanelMm} mm`}
          </p>
        </div>
        <div className="logic-block wide">
          <p className="section-kicker">Wyjasnienie</p>
          <p>{row.explanation}</p>
        </div>
        <div className="logic-block wide">
          <p className="section-kicker">Skladniki wzoru</p>
          {row.resolvedComponents.length > 0 ? (
            <div className="logic-component-list">
              {row.resolvedComponents.map((component) => (
                <div key={component.id} className="logic-component">
                  <div className="logic-component-top">
                    <strong>{component.label}</strong>
                    <span>{component.valueMm === null ? 'brak danych' : `${component.valueMm} mm`}</span>
                  </div>
                  <p>{component.details}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>Brak skladnikow do pokazania.</p>
          )}
          {row.resolvedComponents.length > 1 && (
            <p className="subtle-copy logic-footnote">Skrot: {formatResolvedComponents(row)}</p>
          )}
        </div>
        {row.warnings.length > 0 && (
          <div className="logic-block wide warning-block">
            <p className="section-kicker">Ostrzezenia</p>
            <div className="stack-md">
              {row.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function formatShare(value: number, total: number) {
  if (total === 0) {
    return '0,0';
  }
  return (Math.round((value / total) * 1000) / 10).toFixed(1).replace('.', ',');
}
