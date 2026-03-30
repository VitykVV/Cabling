import type { DataIssue, Severity } from './types.ts';

const GROUP_CODE_ALIASES: Record<string, string> = {
  'Przepustnica na Wyciągu': 'Przepustnica na Wyciagu',
  'Przetwornik ciśnienia went.': 'Przetwornik cisnienia went.',
};

const DISPLAY_LABELS: Record<string, string> = {
  wlk: 'Wlk',
  konfiguracja: 'Konfiguracja',
  Nagrzewnica: 'Nagrzewnica',
  'Wentylator NW': 'Wentylator NW',
  'Wentylator W': 'Wentylator W',
  'Przepustnica na Wyciagu': 'Przepustnica na Wyciągu',
  Recyrkulacja: 'Recyrkulacja',
  'Presostat Filra': 'Presostat Filra',
  'Presostat Wymiennika': 'Presostat Wymiennika',
  'Przetwornik cisnienia went.': 'Przetwornik ciśnienia went.',
  'Złączki wlot nawiewu': 'Złączki wlot nawiewu',
  'Złączki wylot nawiewu': 'Złączki wylot nawiewu',
};

const ISSUE_LABELS: Record<string, string> = {
  'config-rule-disabled-by-reference-output': 'Regula wylaczona na podstawie arkusza',
  'config-rule-overridden-by-workbook-output': 'Regula nadpisana logika z arkusza',
  'driver-cycle': 'Cykliczna zaleznosc czynnika',
  'driver-evaluation-failed': 'Blad obliczania czynnika',
  'duplicate-index-mapping': 'Duplikat mapowania index',
  'duplicate-variant-code': 'Duplikat kodu wariantu',
  'missing-driver': 'Brak czynnika dlugosci',
  'missing-index-coverage': 'Brak pokrycia indexow',
  'missing-variant-index': 'Brak mapowania wariantu i indexu',
  'missing-variant-index-coverage': 'Brak pokrycia indexow wariantu',
  'missing-variant-selection': 'Brak poprawnego wariantu',
  'normalized-option-value': 'Znormalizowana wartosc opcji',
  'rule-without-cable-type': 'Regula bez typu kabla',
  'rule-without-conditions': 'Regula bez warunkow',
  'unknown-cable-type': 'Nieznany typ kabla',
  'unknown-condition-field': 'Nieznane pole warunku',
  'unknown-condition-value': 'Nieznana wartosc warunku',
  'unknown-index-code': 'Nieznany index',
  'unknown-length-driver': 'Nieznany czynnik dlugosci',
  'unsafe-driver-expression': 'Niedozwolone wyrazenie czynnika',
};

const CONTEXT_LABELS: Record<string, string> = {
  cableTypeCode: 'Typ kabla',
  driverCode: 'Czynnik dlugosci',
  element: 'Element',
  error: 'Blad',
  expression: 'Wyrazenie',
  field: 'Pole',
  indexCode: 'Index',
  inferredValues: 'Wartosci wynikowe',
  missing: 'Brakujace indexy',
  missingIndexCodes: 'Brakujace indexy',
  normalized: 'Po normalizacji',
  original: 'Wartosc pierwotna',
  rawValues: 'Wartosci z arkusza',
  ruleId: 'Regula',
  value: 'Wartosc',
  variantCode: 'Wariant',
};

const FAN_GROUP_CODES = new Set(['Wentylator NW', 'Wentylator W']);

export function canonicalGroupCode(code: string) {
  return GROUP_CODE_ALIASES[code] ?? code;
}

export function canonicalOptionValue(groupCode: string, value: string) {
  const canonicalGroup = canonicalGroupCode(groupCode);
  const trimmedValue = value.trim();

  if (FAN_GROUP_CODES.has(canonicalGroup)) {
    return trimmedValue.replace(/^2\s*x\s*/i, '2 x ');
  }

  return trimmedValue;
}

export function normalizeSelections(selections: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(selections).map(([key, value]) => {
      const canonicalGroup = canonicalGroupCode(key);
      return [canonicalGroup, canonicalOptionValue(canonicalGroup, value)];
    }),
  );
}

export function displayGroupLabel(code: string) {
  return DISPLAY_LABELS[canonicalGroupCode(code)] ?? code;
}

export function displayIssueLabel(code: string) {
  return ISSUE_LABELS[code] ?? code;
}

export function displayIssueMessage(issue: DataIssue) {
  const element = readContextString(issue, 'element');
  const variantCode = readContextString(issue, 'variantCode');
  const indexCode = readContextString(issue, 'indexCode');
  const driverCode = readContextString(issue, 'driverCode');
  const field = readContextString(issue, 'field');
  const value = readContextString(issue, 'value');
  const cableTypeCode = readContextString(issue, 'cableTypeCode');
  const original = readContextString(issue, 'original');
  const normalized = readContextString(issue, 'normalized');
  const missing = readContextList(issue, 'missing') ?? readContextList(issue, 'missingIndexCodes');

  switch (issue.code) {
    case 'config-rule-disabled-by-reference-output':
      return `Regula '${element ?? 'bez nazwy'}' zostala wylaczona, bo nie wystepuje w wydruku arkusza.`;
    case 'config-rule-overridden-by-workbook-output':
      return `Regula '${element ?? 'bez nazwy'}' korzysta z wartosci konfiguracji wyprowadzonych z wydruku arkusza.`;
    case 'driver-cycle':
      return `Wykryto cykliczna zaleznosc w czynniku '${driverCode ?? 'brak'}'.`;
    case 'driver-evaluation-failed':
      return `Nie udalo sie obliczyc czynnika '${driverCode ?? 'brak'}'.`;
    case 'duplicate-index-mapping':
      return `Powielone mapowanie index dla wariantu '${variantCode ?? 'brak'}' i indexu '${indexCode ?? 'brak'}'.`;
    case 'duplicate-variant-code':
      return `Powielony kod wariantu '${variantCode ?? 'brak'}'.`;
    case 'missing-driver':
      return `Nie znaleziono czynnika dlugosci '${driverCode ?? 'brak'}'.`;
    case 'missing-index-coverage':
    case 'missing-variant-index-coverage':
      return `Wariant '${variantCode ?? 'brak'}' nie ma mapowania dla indexow: ${(missing ?? ['brak']).join(', ')}.`;
    case 'missing-variant-index':
      return `Brak mapowania dla wariantu '${variantCode ?? 'brak'}' i indexu '${indexCode ?? 'brak'}'.`;
    case 'missing-variant-selection':
      return 'Wybrany wariant nie istnieje w danych referencyjnych.';
    case 'normalized-option-value':
      return `Wartosc opcji '${original ?? 'brak'}' zostala znormalizowana do '${normalized ?? 'brak'}'.`;
    case 'rule-without-cable-type':
      return `Regula '${element ?? 'bez nazwy'}' nie ma przypisanego typu kabla i nie wejdzie do podsumowania.`;
    case 'rule-without-conditions':
      return `Regula '${element ?? 'bez nazwy'}' nie ma warunkow aktywacji i pozostanie nieaktywna.`;
    case 'unknown-cable-type':
      return `Regula odwoluje sie do nieznanego typu kabla '${cableTypeCode ?? 'brak'}'.`;
    case 'unknown-condition-field':
      return `Regula odwoluje sie do nieznanego pola '${field ?? 'brak'}'.`;
    case 'unknown-condition-value':
      return `Regula odwoluje sie do nieznanej wartosci '${value ?? 'brak'}' w polu '${field ?? 'brak'}'.`;
    case 'unknown-index-code':
      return `Regula odwoluje sie do nieznanego indexu '${indexCode ?? 'brak'}'.`;
    case 'unknown-length-driver':
      return `Regula odwoluje sie do nieznanego czynnika dlugosci '${driverCode ?? 'brak'}'.`;
    case 'unsafe-driver-expression':
      return `Wyrazenie czynnika '${driverCode ?? 'brak'}' zawiera niedozwolone znaki.`;
    default:
      return issue.message;
  }
}

export function displayIssueSeverity(severity: Severity) {
  return severity === 'error' ? 'BLAD' : 'OSTRZEZENIE';
}

export function displayContextKey(key: string) {
  return CONTEXT_LABELS[key] ?? key;
}

export function formatContextValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return String(value);
}

export function formatIssueContext(context?: Record<string, unknown>) {
  if (!context) {
    return '';
  }
  return Object.entries(context)
    .map(([key, value]) => `${displayContextKey(key)}: ${formatContextValue(value)}`)
    .join(' | ');
}

export function stripBom(text: string) {
  return text.replace(/^\uFEFF/, '');
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function readContextString(issue: DataIssue, key: string) {
  const value = issue.context?.[key];
  return typeof value === 'string' ? value : null;
}

function readContextList(issue: DataIssue, key: string) {
  const value = issue.context?.[key];
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return null;
}
