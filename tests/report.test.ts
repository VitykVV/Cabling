import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReportViewModel, formatResolvedComponents, summarizeIssues } from '../src/shared/report.ts';
import type { CalculationResult, DocumentExportPayload } from '../src/shared/types.ts';

const calculation: CalculationResult = {
  rows: [
    {
      lp: 1,
      element: 'Element raportowy',
      wlk: 'BS-C-H-2',
      cableType: '3x1mm',
      indexCode: 'AG',
      distanceFromPanelMm: 1520,
      resolvedComponents: [
        { id: 'component-1', label: 'Index AG', kind: 'index-distance', sourceCode: 'AG', valueMm: 1520, details: 'AG: 1520 mm' },
        { id: 'component-2', label: 'Slack', kind: 'constant', sourceCode: '150', valueMm: 150, details: 'Slack: 150 mm' },
      ],
      sumMm: 1670,
      sumM: 1.67,
      activatedBy: ['konfiguracja=Matka'],
      explanation: 'Przykladowa logika',
      warnings: [],
      showInReport: true,
    },
    {
      lp: 2,
      element: 'Element z brakiem',
      wlk: 'BS-C-H-6',
      cableType: '2x1mm',
      indexCode: 'AR',
      distanceFromPanelMm: null,
      resolvedComponents: [],
      sumMm: null,
      sumM: null,
      activatedBy: ['standard'],
      explanation: 'Brak danych',
      warnings: ['Missing mapping'],
      showInReport: true,
    },
    {
      lp: 3,
      element: 'Pozycja ukryta',
      wlk: 'BS-C-H-2',
      cableType: null,
      indexCode: null,
      distanceFromPanelMm: null,
      resolvedComponents: [],
      sumMm: 200,
      sumM: 0.2,
      activatedBy: ['standard'],
      explanation: 'Ukryta pozycja',
      warnings: [],
      showInReport: false,
    },
  ],
  summary: [
    { cableType: '3x1mm', totalMm: 1670, totalM: 1.67 },
  ],
  issues: [],
};

const payload: DocumentExportPayload = {
  configurationName: 'Scenariusz testowy',
  generatedAt: '2026-03-27T12:00:00.000Z',
  selections: { konfiguracja: 'Matka' },
  result: calculation,
  issues: [
    { severity: 'warning', code: 'missing-index-coverage', message: 'Brak coverage' },
    { severity: 'error', code: 'duplicate-index-mapping', message: 'Duplikat indexu' },
    { severity: 'warning', code: 'missing-index-coverage', message: 'Brak coverage 2' },
  ],
};

test('buildReportViewModel splits report rows and computes readiness metrics', () => {
  const report = buildReportViewModel(payload);

  assert.equal(report.reportRows.length, 2);
  assert.equal(report.hiddenRows.length, 1);
  assert.equal(report.metrics.unresolvedRowCount, 1);
  assert.equal(report.metrics.rowsWithWarningsCount, 1);
  assert.equal(report.metrics.errorCount, 1);
  assert.equal(report.metrics.warningCount, 2);
  assert.equal(report.metrics.readyForExport, false);
});

test('formatResolvedComponents renders joined component description', () => {
  const text = formatResolvedComponents(calculation.rows[0]!);
  assert.equal(text, 'Index AG: 1520 mm | Slack: 150 mm');
});

test('summarizeIssues groups identical issue codes', () => {
  const summary = summarizeIssues(payload.issues);
  assert.deepEqual(summary, [
    { code: 'missing-index-coverage', count: 2 },
    { code: 'duplicate-index-mapping', count: 1 },
  ]);
});
