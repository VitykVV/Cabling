import type { CalculationResult, CalculationRow, DataIssue, DocumentExportPayload } from './types.ts';

export interface ReportMetrics {
  reportRowCount: number;
  hiddenRowCount: number;
  unresolvedRowCount: number;
  rowsWithWarningsCount: number;
  errorCount: number;
  warningCount: number;
  readyForExport: boolean;
}

export interface ReportViewModel {
  generatedAt: string;
  configurationName: string;
  selections: Record<string, string>;
  summary: CalculationResult['summary'];
  reportRows: CalculationRow[];
  hiddenRows: CalculationRow[];
  issues: DataIssue[];
  metrics: ReportMetrics;
}

export function buildReportViewModel(payload: DocumentExportPayload): ReportViewModel {
  const reportRows = payload.result.rows.filter((row) => row.showInReport);
  const hiddenRows = payload.result.rows.filter((row) => !row.showInReport);
  const unresolvedRowCount = reportRows.filter((row) => row.sumMm === null).length;
  const rowsWithWarningsCount = reportRows.filter((row) => row.warnings.length > 0).length;
  const errorCount = payload.issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = payload.issues.filter((issue) => issue.severity === 'warning').length;

  return {
    generatedAt: payload.generatedAt,
    configurationName: payload.configurationName,
    selections: payload.selections,
    summary: payload.result.summary,
    reportRows,
    hiddenRows,
    issues: payload.issues,
    metrics: {
      reportRowCount: reportRows.length,
      hiddenRowCount: hiddenRows.length,
      unresolvedRowCount,
      rowsWithWarningsCount,
      errorCount,
      warningCount,
      readyForExport: unresolvedRowCount === 0 && errorCount === 0,
    },
  };
}

export function formatResolvedComponents(row: CalculationRow) {
  return row.resolvedComponents
    .map((component) => `${component.label}: ${component.valueMm === null ? 'brak' : `${component.valueMm} mm`}`)
    .join(' | ');
}

export function summarizeIssues(issues: DataIssue[]) {
  return Array.from(
    issues.reduce((map, issue) => {
      map.set(issue.code, (map.get(issue.code) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
}
