import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as XLSX from 'xlsx';
import { buildReportViewModel, summarizeIssues } from '../src/shared/report.ts';
import type { DocumentExportPayload } from '../src/shared/types.ts';
import { displayGroupLabel, displayIssueLabel, displayIssueMessage, displayIssueSeverity, formatIssueContext } from '../src/shared/utils.ts';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT_MARGIN = 36;
const RIGHT_MARGIN = 36;
const TOP_MARGIN = 36;
const BOTTOM_MARGIN = 34;
const HEADER_HEIGHT = 74;
const FOOTER_HEIGHT = 24;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
const FONT_PATHS = {
  regular: [
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/ARIALUNI.TTF',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
  ],
  bold: [
    'C:/Windows/Fonts/arialbd.ttf',
    'C:/Windows/Fonts/ARIALBD.TTF',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
  ],
};

const COLORS = {
  ink: rgb(0.13, 0.18, 0.24),
  muted: rgb(0.38, 0.45, 0.52),
  border: rgb(0.82, 0.86, 0.9),
  header: rgb(0.07, 0.28, 0.39),
  headerSoft: rgb(0.88, 0.93, 0.96),
  band: rgb(0.95, 0.97, 0.98),
  tableHeader: rgb(0.9, 0.94, 0.96),
  zebra: rgb(0.98, 0.99, 1),
  successFill: rgb(0.91, 0.97, 0.93),
  successText: rgb(0.1, 0.42, 0.22),
  warningFill: rgb(0.99, 0.95, 0.87),
  warningText: rgb(0.58, 0.37, 0.03),
  dangerFill: rgb(0.99, 0.92, 0.92),
  dangerText: rgb(0.62, 0.19, 0.19),
};

export function createXlsxBuffer(payload: DocumentExportPayload) {
  const report = buildReportViewModel(payload);
  const workbook = XLSX.utils.book_new();
  const grandTotalM = roundMetersValue(report.summary.reduce((sum, entry) => sum + entry.totalM, 0));

  const overviewSheet = XLSX.utils.aoa_to_sheet([
    ['Dokument', report.configurationName || 'Bez nazwy'],
    ['Wariant', report.selections.wlk ?? '-'],
    ['Wygenerowano', report.generatedAt],
    ['Status raportu', report.metrics.readyForExport ? 'Gotowy do wydruku' : 'Wymaga uwagi'],
    ['Lacznie [m]', grandTotalM],
    ['Pozycje raportowe', report.metrics.reportRowCount],
    ['Pozycje ukryte', report.metrics.hiddenRowCount],
    ['Braki danych', report.metrics.unresolvedRowCount],
    ['Wiersze z ostrzezeniami', report.metrics.rowsWithWarningsCount],
    ['Bledy danych', report.metrics.errorCount],
    ['Ostrzezenia danych', report.metrics.warningCount],
  ]);

  const selectionsSheet = XLSX.utils.json_to_sheet(
    Object.entries(report.selections).map(([key, value]) => ({ element: displayGroupLabel(key), wybor: value })),
  );

  const summarySheet = XLSX.utils.json_to_sheet(
    report.summary.map((entry) => ({
      'Typ kabla': entry.cableType,
      'Suma [mm]': entry.totalMm,
      'Suma [m]': roundMetersValue(entry.totalM),
      'Udzial [%]': grandTotalM === 0 ? 0 : roundPercent((entry.totalM / grandTotalM) * 100),
    })),
  );

  const reportRowsSheet = XLSX.utils.json_to_sheet(
    report.reportRows.map((row) => ({
      lp: row.lp,
      element: row.element,
      'typ kabla': row.cableType ?? '',
      'dlugosc [m]': row.sumM === null ? '' : roundMetersValue(row.sumM),
    })),
  );

  const hiddenRowsSheet = XLSX.utils.json_to_sheet(
    report.hiddenRows.map((row) => ({
      lp: row.lp,
      element: row.element,
      'typ kabla': row.cableType ?? '',
      'dlugosc [m]': row.sumM === null ? '' : roundMetersValue(row.sumM),
      powod: 'Pozycja ukryta w regule',
    })),
  );

  const issuesSheet = XLSX.utils.json_to_sheet(
    report.issues.map((issue) => ({
      typ: displayIssueSeverity(issue.severity),
      problem: displayIssueLabel(issue.code),
      opis: displayIssueMessage(issue),
      kontekst: formatIssueContext(issue.context),
    })),
  );

  const issueSummarySheet = XLSX.utils.json_to_sheet(
    summarizeIssues(report.issues).map((issue) => ({ problem: displayIssueLabel(issue.code), liczba: issue.count })),
  );

  overviewSheet['!cols'] = [{ wch: 24 }, { wch: 28 }];
  selectionsSheet['!cols'] = [{ wch: 30 }, { wch: 30 }];
  summarySheet['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  reportRowsSheet['!cols'] = [{ wch: 6 }, { wch: 40 }, { wch: 22 }, { wch: 16 }];
  hiddenRowsSheet['!cols'] = [{ wch: 6 }, { wch: 40 }, { wch: 22 }, { wch: 16 }, { wch: 24 }];
  issuesSheet['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 70 }, { wch: 60 }];
  issueSummarySheet['!cols'] = [{ wch: 34 }, { wch: 10 }];

  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Raport');
  XLSX.utils.book_append_sheet(workbook, selectionsSheet, 'Konfiguracja');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Podsumowanie');
  XLSX.utils.book_append_sheet(workbook, reportRowsSheet, 'Pozycje raportowe');
  if (report.hiddenRows.length > 0) {
    XLSX.utils.book_append_sheet(workbook, hiddenRowsSheet, 'Pozycje ukryte');
  }
  XLSX.utils.book_append_sheet(workbook, issueSummarySheet, 'Kody problemow');
  XLSX.utils.book_append_sheet(workbook, issuesSheet, 'Problemy');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export async function createPdfBytes(payload: DocumentExportPayload) {
  const report = buildReportViewModel(payload);
  const issueSummary = summarizeIssues(report.issues);
  const grandTotalM = report.summary.reduce((sum, entry) => sum + entry.totalM, 0);
  const pdf = await PDFDocument.create();
  const fonts = await loadPdfFonts(pdf);

  const context: PdfContext = {
    pdf,
    fonts,
    report,
    page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    pageNumber: 0,
    y: 0,
  };

  addPage(context);
  drawCover(context, grandTotalM);
  drawConfigurationSection(context);
  drawCableSummarySection(context, grandTotalM);
  drawWireListSection(context);
  drawIssuesSection(context, issueSummary);

  return pdf.save();
}

async function loadPdfFonts(pdf: PDFDocument): Promise<PdfFonts> {
  const regularPath = FONT_PATHS.regular.find((candidate) => fs.existsSync(candidate));
  const boldPath = FONT_PATHS.bold.find((candidate) => fs.existsSync(candidate));

  if (regularPath && boldPath) {
    pdf.registerFontkit(fontkit);
    const regularBytes = fs.readFileSync(path.resolve(regularPath));
    const boldBytes = fs.readFileSync(path.resolve(boldPath));
    return {
      regular: await pdf.embedFont(regularBytes),
      bold: await pdf.embedFont(boldBytes),
      unicode: true,
    };
  }

  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    unicode: false,
  };
}
function addPage(context: PdfContext) {
  context.pageNumber += 1;
  if (context.pageNumber > 1) {
    context.page = context.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  drawPageFrame(context);
  context.y = PAGE_HEIGHT - TOP_MARGIN - HEADER_HEIGHT - 18;
}

function drawPageFrame(context: PdfContext) {
  const variantCode = context.report.selections.wlk ?? '-';
  const statusLabel = context.report.metrics.readyForExport ? 'Gotowy do wydruku' : 'Wymaga uwagi';
  const statusFill = context.report.metrics.readyForExport ? COLORS.successFill : COLORS.warningFill;
  const statusText = context.report.metrics.readyForExport ? COLORS.successText : COLORS.warningText;

  context.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - TOP_MARGIN - HEADER_HEIGHT,
    width: PAGE_WIDTH,
    height: HEADER_HEIGHT,
    color: COLORS.header,
  });

  drawText(context, 'Raport przewodów wiązki kablowej', LEFT_MARGIN, PAGE_HEIGHT - TOP_MARGIN - 24, 19, true, rgb(1, 1, 1));
  drawText(context, context.report.configurationName || 'Bez nazwy', LEFT_MARGIN, PAGE_HEIGHT - TOP_MARGIN - 45, 10, false, rgb(0.86, 0.92, 0.96));
  drawText(context, `Wariant: ${variantCode}`, LEFT_MARGIN, PAGE_HEIGHT - TOP_MARGIN - 59, 10, false, rgb(0.86, 0.92, 0.96));

  context.page.drawRectangle({
    x: PAGE_WIDTH - RIGHT_MARGIN - 150,
    y: PAGE_HEIGHT - TOP_MARGIN - 53,
    width: 150,
    height: 27,
    color: statusFill,
    borderColor: rgb(1, 1, 1),
    borderWidth: 0.8,
  });
  drawText(context, statusLabel, PAGE_WIDTH - RIGHT_MARGIN - 140, PAGE_HEIGHT - TOP_MARGIN - 36, 10, true, statusText);
  drawText(context, formatDateStamp(context.report.generatedAt), PAGE_WIDTH - RIGHT_MARGIN - 140, PAGE_HEIGHT - TOP_MARGIN - 49, 8, false, statusText);

  context.page.drawLine({
    start: { x: LEFT_MARGIN, y: BOTTOM_MARGIN + FOOTER_HEIGHT },
    end: { x: PAGE_WIDTH - RIGHT_MARGIN, y: BOTTOM_MARGIN + FOOTER_HEIGHT },
    thickness: 0.8,
    color: COLORS.border,
  });
  drawText(context, context.report.configurationName || 'Bez nazwy', LEFT_MARGIN, BOTTOM_MARGIN + 9, 8, false, COLORS.muted);
  drawText(context, `Wariant ${variantCode}`, PAGE_WIDTH / 2 - 36, BOTTOM_MARGIN + 9, 8, false, COLORS.muted);
  drawText(context, `Strona ${context.pageNumber}`, PAGE_WIDTH - RIGHT_MARGIN - 46, BOTTOM_MARGIN + 9, 8, false, COLORS.muted);
}

function drawCover(context: PdfContext, grandTotalM: number) {
  const metrics = [
    { label: 'Wariant', value: context.report.selections.wlk ?? '-', fill: COLORS.band, text: COLORS.ink },
    {
      label: 'Status',
      value: context.report.metrics.readyForExport ? 'Gotowy' : 'Do poprawy',
      fill: context.report.metrics.readyForExport ? COLORS.successFill : COLORS.warningFill,
      text: context.report.metrics.readyForExport ? COLORS.successText : COLORS.warningText,
    },
    { label: 'Pozycje', value: String(context.report.metrics.reportRowCount), fill: COLORS.band, text: COLORS.ink },
    { label: 'Łącznie [m]', value: formatMetersValue(grandTotalM), fill: COLORS.band, text: COLORS.ink },
  ];

  const gap = 10;
  const cardWidth = (CONTENT_WIDTH - gap * 3) / 4;
  const cardHeight = 58;
  ensureSpace(context, cardHeight + 24);

  let x = LEFT_MARGIN;
  for (const metric of metrics) {
    context.page.drawRectangle({
      x,
      y: context.y - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: metric.fill,
      borderColor: COLORS.border,
      borderWidth: 0.9,
    });
    drawText(context, metric.label, x + 12, context.y - 18, 8, false, COLORS.muted);
    const lines = wrapPdfText(metric.value, context.fonts.bold, 13, cardWidth - 24, context.fonts.unicode);
    let valueY = context.y - 36;
    for (const line of lines) {
      drawText(context, line, x + 12, valueY, 13, true, metric.text);
      valueY -= 15;
    }
    x += cardWidth + gap;
  }
  context.y -= cardHeight + 18;

  const bannerFill = context.report.metrics.errorCount > 0
    ? COLORS.dangerFill
    : context.report.metrics.unresolvedRowCount > 0 || context.report.metrics.warningCount > 0
      ? COLORS.warningFill
      : COLORS.successFill;
  const bannerText = context.report.metrics.errorCount > 0
    ? COLORS.dangerText
    : context.report.metrics.unresolvedRowCount > 0 || context.report.metrics.warningCount > 0
      ? COLORS.warningText
      : COLORS.successText;
  const bannerTextValue = context.report.metrics.errorCount > 0
    ? `Dokument zawiera ${context.report.metrics.errorCount} bledow danych i ${context.report.metrics.warningCount} ostrzezen.`
    : context.report.metrics.unresolvedRowCount > 0 || context.report.metrics.warningCount > 0
      ? `Dokument wymaga przegladu: brak danych w ${context.report.metrics.unresolvedRowCount} pozycjach.`
      : 'Dokument jest spójny i gotowy do wydruku produkcyjnego.';

  const bannerHeight = measureParagraphHeight(context, bannerTextValue, context.fonts.bold, 10, CONTENT_WIDTH - 32) + 20;
  ensureSpace(context, bannerHeight + 12);
  context.page.drawRectangle({
    x: LEFT_MARGIN,
    y: context.y - bannerHeight,
    width: CONTENT_WIDTH,
    height: bannerHeight,
    color: bannerFill,
    borderColor: COLORS.border,
    borderWidth: 0.9,
  });
  drawParagraph(context, bannerTextValue, LEFT_MARGIN + 14, context.y - 16, CONTENT_WIDTH - 28, 10, true, bannerText);
  context.y -= bannerHeight + 18;
}

function drawConfigurationSection(context: PdfContext) {
  drawSectionTitle(context, 'Konfiguracja wejściowa', 'Zatwierdzone wartości wejściowe dla wariantu i elementów składowych.');

  const entries = Object.entries(context.report.selections).map(([key, value]) => ({
    label: displayGroupLabel(key),
    value,
  }));
  const gap = 12;
  const columnWidth = (CONTENT_WIDTH - gap) / 2;

  for (let index = 0; index < entries.length; index += 2) {
    const rowEntries = entries.slice(index, index + 2);
    const heights = rowEntries.map((entry) => measureInfoTileHeight(context, entry.label, entry.value, columnWidth));
    const rowHeight = Math.max(...heights);
    ensureSpace(context, rowHeight + 10);

    rowEntries.forEach((entry, columnIndex) => {
      const x = LEFT_MARGIN + columnIndex * (columnWidth + gap);
      drawInfoTile(context, x, context.y, columnWidth, rowHeight, entry.label, entry.value);
    });

    context.y -= rowHeight + 10;
  }

  context.y -= 8;
}

function drawCableSummarySection(context: PdfContext, grandTotalM: number) {
  drawSectionTitle(context, 'Podsumowanie typów kabli', 'Zestawienie długości gotowych do zakupu i cięcia.');

  const widths = [250, 130, 143];
  drawTableHeader(context, widths, ['Typ kabla', 'Łącznie [m]', 'Udział [%]']);

  context.report.summary.forEach((entry, index) => {
    drawTableRow(context, widths, [
      entry.cableType,
      formatMetersValue(entry.totalM),
      grandTotalM === 0 ? '0,0' : formatPercentValue((entry.totalM / grandTotalM) * 100),
    ], {
      fill: index % 2 === 0 ? COLORS.zebra : rgb(1, 1, 1),
    });
  });

  if (context.report.summary.length === 0) {
    drawEmptyState(context, 'Brak pozycji do podsumowania.');
  }

  context.y -= 10;
}

function drawWireListSection(context: PdfContext) {
  drawSectionTitle(context, 'Lista przewodów', 'Tabela produkcyjna do przygotowania przewodów bez szczegółów wyliczania.');

  const widths = [36, 260, 140, 87];
  const header = ['Lp', 'Element', 'Typ kabla', 'Długość [m]'];
  drawTableHeader(context, widths, header);

  context.report.reportRows.forEach((row, index) => {
    const fill = row.sumM === null ? COLORS.warningFill : index % 2 === 0 ? COLORS.zebra : rgb(1, 1, 1);
    drawTableRow(context, widths, [
      String(row.lp),
      row.element,
      row.cableType ?? 'brak typu',
      row.sumM === null ? 'brak danych' : formatMetersValue(row.sumM),
    ], {
      fill,
      onPageBreak: () => {
        drawSectionTitle(context, 'Lista przewodów (cd.)');
        drawTableHeader(context, widths, header);
      },
    });
  });

  if (context.report.reportRows.length === 0) {
    drawEmptyState(context, 'Brak pozycji raportowych dla bieżącej konfiguracji.');
  }

  if (context.report.hiddenRows.length > 0) {
    const note = `Poza dokumentem pozostaje ${context.report.hiddenRows.length} aktywnych pozycji oznaczonych jako ukryte w raporcie.`;
    const noteHeight = measureParagraphHeight(context, note, context.fonts.regular, 9, CONTENT_WIDTH - 28) + 18;
    ensureSpace(context, noteHeight + 8);
    context.page.drawRectangle({
      x: LEFT_MARGIN,
      y: context.y - noteHeight,
      width: CONTENT_WIDTH,
      height: noteHeight,
      color: COLORS.band,
      borderColor: COLORS.border,
      borderWidth: 0.9,
    });
    drawParagraph(context, note, LEFT_MARGIN + 14, context.y - 14, CONTENT_WIDTH - 28, 9, false, COLORS.muted);
    context.y -= noteHeight + 12;
  }
}

function drawIssuesSection(context: PdfContext, issueSummary: Array<{ code: string; count: number }>) {
  drawSectionTitle(context, 'Kontrola danych', 'Podsumowanie problemów wpływających na jakość dokumentu.');

  if (issueSummary.length === 0) {
    drawEmptyState(context, 'Brak zarejestrowanych problemów danych.', COLORS.successFill, COLORS.successText);
    return;
  }

  const widths = [140, 293, 90];
  drawTableHeader(context, widths, ['Poziom', 'Problem', 'Liczba']);

  issueSummary.forEach((issue, index) => {
    const source = context.report.issues.filter((item) => item.code === issue.code);
    const hasError = source.some((item) => item.severity === 'error');
    drawTableRow(context, widths, [
      hasError ? 'Błąd' : 'Ostrzeżenie',
      displayIssueLabel(issue.code),
      String(issue.count),
    ], {
      fill: hasError ? COLORS.dangerFill : index % 2 === 0 ? COLORS.zebra : rgb(1, 1, 1),
      onPageBreak: () => {
        drawSectionTitle(context, 'Kontrola danych (cd.)');
        drawTableHeader(context, widths, ['Poziom', 'Problem', 'Liczba']);
      },
    });
  });
}

function drawSectionTitle(context: PdfContext, title: string, subtitle?: string) {
  const subtitleHeight = subtitle ? measureParagraphHeight(context, subtitle, context.fonts.regular, 9, CONTENT_WIDTH) + 4 : 0;
  ensureSpace(context, 28 + subtitleHeight);
  drawText(context, title, LEFT_MARGIN, context.y, 14, true, COLORS.ink);
  context.y -= 16;
  if (subtitle) {
    drawParagraph(context, subtitle, LEFT_MARGIN, context.y, CONTENT_WIDTH, 9, false, COLORS.muted);
    context.y -= subtitleHeight;
  }
  context.page.drawLine({
    start: { x: LEFT_MARGIN, y: context.y },
    end: { x: PAGE_WIDTH - RIGHT_MARGIN, y: context.y },
    thickness: 0.9,
    color: COLORS.border,
  });
  context.y -= 14;
}

function drawInfoTile(context: PdfContext, x: number, topY: number, width: number, height: number, label: string, value: string) {
  context.page.drawRectangle({
    x,
    y: topY - height,
    width,
    height,
    color: rgb(1, 1, 1),
    borderColor: COLORS.border,
    borderWidth: 0.9,
  });
  drawText(context, label, x + 12, topY - 16, 8, false, COLORS.muted);
  drawParagraph(context, value, x + 12, topY - 30, width - 24, 10, true, COLORS.ink);
}

function measureInfoTileHeight(context: PdfContext, label: string, value: string, width: number) {
  return 18 + measureParagraphHeight(context, value, context.fonts.bold, 10, width - 24) + 18;
}

function drawTableHeader(context: PdfContext, widths: number[], cells: string[]) {
  ensureSpace(context, 26);
  drawRowShape(context, widths, 26, COLORS.tableHeader, true);
  drawRowText(context, widths, cells, 26, 9, true);
  context.y -= 26;
}

function drawTableRow(
  context: PdfContext,
  widths: number[],
  cells: string[],
  options?: { fill?: ReturnType<typeof rgb>; onPageBreak?: () => void },
) {
  const rowHeight = measureTableRowHeight(context, widths, cells, 9);
  ensureTableSpace(context, rowHeight, options?.onPageBreak);
  drawRowShape(context, widths, rowHeight, options?.fill ?? rgb(1, 1, 1), false);
  drawRowText(context, widths, cells, rowHeight, 9, false);
  context.y -= rowHeight;
}

function ensureTableSpace(context: PdfContext, rowHeight: number, onPageBreak?: () => void) {
  if (context.y - rowHeight < BOTTOM_MARGIN + FOOTER_HEIGHT + 8) {
    addPage(context);
    onPageBreak?.();
  }
}

function drawRowShape(context: PdfContext, widths: number[], rowHeight: number, fill: ReturnType<typeof rgb>, header: boolean) {
  let x = LEFT_MARGIN;
  widths.forEach((width) => {
    context.page.drawRectangle({
      x,
      y: context.y - rowHeight,
      width,
      height: rowHeight,
      color: fill,
      borderColor: header ? COLORS.headerSoft : COLORS.border,
      borderWidth: 0.75,
    });
    x += width;
  });
}

function drawRowText(context: PdfContext, widths: number[], cells: string[], rowHeight: number, size: number, bold: boolean) {
  let x = LEFT_MARGIN;
  const font = bold ? context.fonts.bold : context.fonts.regular;
  cells.forEach((cell, index) => {
    const isNumeric = index === cells.length - 1 || index === 0;
    const lines = wrapPdfText(cell, font, size, widths[index] - 12, context.fonts.unicode);
    let textY = context.y - 13;
    lines.forEach((line) => {
      const lineWidth = font.widthOfTextAtSize(pdfSafeText(context, line), size);
      const textX = isNumeric && index !== 1 && index !== 2
        ? x + widths[index] - lineWidth - 8
        : x + 6;
      drawText(context, line, textX, textY, size, bold, COLORS.ink);
      textY -= size + 3;
    });
    x += widths[index];
  });
}

function measureTableRowHeight(context: PdfContext, widths: number[], cells: string[], size: number) {
  const lineHeights = cells.map((cell, index) => {
    const font = context.fonts.regular;
    const lines = wrapPdfText(cell, font, size, widths[index] - 12, context.fonts.unicode);
    return lines.length * (size + 3);
  });
  return Math.max(24, Math.max(...lineHeights) + 10);
}

function drawEmptyState(
  context: PdfContext,
  text: string,
  fill: ReturnType<typeof rgb> = COLORS.band,
  textColor: ReturnType<typeof rgb> = COLORS.muted,
) {
  const height = measureParagraphHeight(context, text, context.fonts.regular, 10, CONTENT_WIDTH - 28) + 18;
  ensureSpace(context, height + 8);
  context.page.drawRectangle({
    x: LEFT_MARGIN,
    y: context.y - height,
    width: CONTENT_WIDTH,
    height,
    color: fill,
    borderColor: COLORS.border,
    borderWidth: 0.9,
  });
  drawParagraph(context, text, LEFT_MARGIN + 14, context.y - 14, CONTENT_WIDTH - 28, 10, false, textColor);
  context.y -= height + 10;
}

function ensureSpace(context: PdfContext, height: number) {
  if (context.y - height < BOTTOM_MARGIN + FOOTER_HEIGHT + 8) {
    addPage(context);
  }
}

function drawParagraph(
  context: PdfContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  bold = false,
  color = COLORS.ink,
) {
  const font = bold ? context.fonts.bold : context.fonts.regular;
  const lines = wrapPdfText(text, font, size, maxWidth, context.fonts.unicode);
  let currentY = y;
  lines.forEach((line) => {
    drawText(context, line, x, currentY, size, bold, color);
    currentY -= size + 3;
  });
}

function measureParagraphHeight(
  context: PdfContext,
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const lines = wrapPdfText(text, font, size, maxWidth, context.fonts.unicode);
  return lines.length * (size + 3);
}

function drawText(
  context: PdfContext,
  text: string,
  x: number,
  y: number,
  size: number,
  bold = false,
  color = COLORS.ink,
) {
  context.page.drawText(pdfSafeText(context, text), {
    x,
    y,
    size,
    font: bold ? context.fonts.bold : context.fonts.regular,
    color,
  });
}

function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number, unicode: boolean) {
  const safeText = unicode ? text : stripDiacritics(text);
  const words = safeText.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    lines.push(word);
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function pdfSafeText(context: PdfContext, text: string) {
  return context.fonts.unicode ? text : stripDiacritics(text);
}

function stripDiacritics(text: string) {
  return text
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatDateStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function roundMetersValue(value: number) {
  return Math.round(value * 10) / 10;
}

function formatMetersValue(value: number) {
  return roundMetersValue(value).toFixed(1).replace('.', ',');
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPercentValue(value: number) {
  return roundPercent(value).toFixed(1).replace('.', ',');
}

interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
  unicode: boolean;
}

interface PdfContext {
  pdf: PDFDocument;
  fonts: PdfFonts;
  report: ReturnType<typeof buildReportViewModel>;
  page: PDFPage;
  pageNumber: number;
  y: number;
}



