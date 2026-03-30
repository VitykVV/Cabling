import type {
  CalculationResult,
  CalculationRow,
  DataIssue,
  ReferenceData,
  ResolvedComponent,
  RuleCondition,
  RuleRecord,
  SavedConfiguration,
  SummaryEntry,
  Variant,
} from './types.ts';
import { validateState } from './validation.ts';
import { canonicalGroupCode, canonicalOptionValue, createId, normalizeSelections } from './utils.ts';

interface DriverResolutionContext {
  variant: Variant;
  referenceData: ReferenceData;
  memo: Map<string, number>;
  stack: Set<string>;
}

const IDENTIFIER_PATTERN = /[A-Za-z_][A-Za-z0-9_]*/g;
const SAFE_EXPRESSION_PATTERN = /^[0-9A-Za-z_+\-*/().\s]+$/;

export function calculate(referenceData: ReferenceData, rules: RuleRecord[], selections: Record<string, string>): CalculationResult {
  const issues = validateState(referenceData, rules);
  const canonicalSelections = normalizeSelections(selections);
  const variantCode = canonicalSelections.wlk;
  const variant = referenceData.variants.find((item) => item.code === variantCode);

  if (!variant) {
    return {
      rows: [],
      summary: [],
      issues: [
        ...issues,
        {
          severity: 'error',
          code: 'missing-variant-selection',
          message: 'Wybrany wariant nie istnieje w danych referencyjnych.',
          context: { variantCode },
        },
      ],
    };
  }

  const rows: CalculationRow[] = [];
  const rowIssues: DataIssue[] = [];

  for (const rule of rules) {
    if (!rule.isActive || !isRuleActive(rule.conditions, rule.categoryCode, canonicalSelections)) {
      continue;
    }

    const context: DriverResolutionContext = {
      variant,
      referenceData,
      memo: new Map<string, number>(),
      stack: new Set<string>(),
    };

    const resolvedComponents: ResolvedComponent[] = [];
    const warnings: string[] = [];
    const activatedBy = formatActivation(rule.conditions, canonicalSelections);

    let sumMm = 0;
    let blockingError = false;
    let indexCode: string | null = null;
    let distanceFromPanelMm: number | null = null;

    for (const component of rule.lengthComponents) {
      if (component.kind === 'constant') {
        resolvedComponents.push({
          id: component.id,
          label: component.label,
          kind: component.kind,
          sourceCode: String(component.valueMm),
          valueMm: component.valueMm,
          details: `${component.label}: ${component.valueMm} mm`,
        });
        sumMm += component.valueMm;
        continue;
      }

      if (component.kind === 'driver') {
        const valueMm = resolveDriverValue(component.driverCode, context, rowIssues, rule);
        resolvedComponents.push({
          id: component.id,
          label: component.label,
          kind: component.kind,
          sourceCode: component.driverCode,
          valueMm,
          details: valueMm === null ? `${component.driverCode}: brak wyniku` : `${component.driverCode}: ${valueMm} mm`,
        });

        if (valueMm === null) {
          blockingError = true;
          warnings.push(`Nie udalo sie obliczyc czynnika '${component.driverCode}'.`);
          continue;
        }

        sumMm += valueMm;
        continue;
      }

      indexCode = component.indexCode;
      const mapping = referenceData.indexMappings.find(
        (item) => item.variantCode === variant.code && item.indexCode === component.indexCode,
      );

      if (!mapping) {
        blockingError = true;
        const message = `Brak mapowania dla wariantu '${variant.code}' i indexu '${component.indexCode}'.`;
        warnings.push(message);
        rowIssues.push({
          severity: 'warning',
          code: 'missing-variant-index',
          message,
          context: { variantCode: variant.code, indexCode: component.indexCode, ruleId: rule.id },
        });
        resolvedComponents.push({
          id: component.id,
          label: component.label,
          kind: component.kind,
          sourceCode: component.indexCode,
          valueMm: null,
          details: `${component.indexCode}: brak mapowania`,
        });
        continue;
      }

      distanceFromPanelMm = mapping.distanceMm;
      resolvedComponents.push({
        id: component.id,
        label: component.label,
        kind: component.kind,
        sourceCode: component.indexCode,
        valueMm: mapping.distanceMm,
        details: `${component.indexCode}: ${mapping.distanceMm} mm for ${variant.code}`,
      });
      sumMm += mapping.distanceMm;
    }

    const finalSumMm = blockingError ? null : round(sumMm, 4);
    const finalSumM = finalSumMm === null ? null : round(finalSumMm / 1000, 4);
    const explanation = buildExplanation(rule, variant, resolvedComponents, finalSumMm, activatedBy);

    rows.push({
      lp: rows.length + 1,
      element: rule.element,
      wlk: variant.code,
      cableType: rule.cableTypeCode,
      indexCode,
      distanceFromPanelMm,
      resolvedComponents,
      sumMm: finalSumMm,
      sumM: finalSumM,
      activatedBy,
      explanation,
      warnings,
      showInReport: rule.showInReport,
    });
  }

  return {
    rows,
    summary: buildSummary(rows),
    issues: [...issues, ...rowIssues],
  };
}

export function createEmptySavedConfiguration(): SavedConfiguration {
  const now = new Date().toISOString();
  return {
    id: createId('saved'),
    name: 'Nowa konfiguracja',
    selections: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyRule(): RuleRecord {
  return {
    id: createId('rule'),
    element: 'Nowy element',
    categoryCode: 'niestandardowa',
    description: '',
    showInReport: true,
    conditions: [],
    lengthComponents: [],
    cableTypeCode: null,
    notes: '',
    isActive: true,
  };
}

function isRuleActive(conditions: RuleCondition[], categoryCode: string, selections: Record<string, string>) {
  if (categoryCode === 'standard') {
    return true;
  }
  if (conditions.length === 0) {
    return false;
  }
  return conditions.every((condition) => {
    if (condition.operator !== 'in') {
      return false;
    }

    const fieldCode = canonicalGroupCode(condition.field);
    const selectedValue = selections[fieldCode];
    if (!selectedValue) {
      return false;
    }

    return condition.values
      .map((value) => canonicalOptionValue(fieldCode, value))
      .includes(selectedValue);
  });
}

function formatActivation(conditions: RuleCondition[], selections: Record<string, string>) {
  if (conditions.length === 0) {
    return ['standard'];
  }
  return conditions.map((condition) => {
    const field = canonicalGroupCode(condition.field);
    return `${field}=${selections[field] ?? '(puste)'}`;
  });
}

function resolveDriverValue(
  driverCode: string,
  context: DriverResolutionContext,
  issues: DataIssue[],
  rule: RuleRecord,
): number | null {
  if (context.memo.has(driverCode)) {
    return context.memo.get(driverCode) ?? null;
  }

  if (context.stack.has(driverCode)) {
    issues.push({
      severity: 'error',
      code: 'driver-cycle',
      message: `Wykryto cykliczna zaleznosc w czynniku '${driverCode}'.`,
      context: { driverCode, ruleId: rule.id },
    });
    return null;
  }

  const driver = context.referenceData.lengthDrivers.find((item) => item.code === driverCode && item.isActive);
  if (!driver) {
    issues.push({
      severity: 'error',
      code: 'missing-driver',
      message: `Nie znaleziono czynnika dlugosci '${driverCode}'.`,
      context: { driverCode, ruleId: rule.id },
    });
    return null;
  }

  if (!SAFE_EXPRESSION_PATTERN.test(driver.expression)) {
    issues.push({
      severity: 'error',
      code: 'unsafe-driver-expression',
      message: `Wyrazenie czynnika '${driverCode}' zawiera niedozwolone znaki: '${driver.expression}'.`,
      context: { driverCode, expression: driver.expression },
    });
    return null;
  }

  context.stack.add(driverCode);

  const baseContext: Record<string, number> = {
    lengthMm: context.variant.lengthMm,
    widthMm: context.variant.widthMm,
    heightMm: context.variant.heightMm,
  };

  const identifiers = Array.from(new Set(driver.expression.match(IDENTIFIER_PATTERN) ?? []));
  for (const identifier of identifiers) {
    if (identifier in baseContext) {
      continue;
    }
    const dependency = resolveDriverValue(identifier, context, issues, rule);
    if (dependency === null) {
      context.stack.delete(driverCode);
      return null;
    }
    baseContext[identifier] = dependency;
  }

  try {
    const evaluator = new Function(...Object.keys(baseContext), `return ${driver.expression};`) as (...args: number[]) => number;
    const result = Number(evaluator(...Object.values(baseContext)));
    if (Number.isNaN(result) || !Number.isFinite(result)) {
      throw new Error('Wyrazenie zwrocilo nieprawidlowa wartosc liczbowa.');
    }
    const rounded = round(result, 4);
    context.memo.set(driverCode, rounded);
    context.stack.delete(driverCode);
    return rounded;
  } catch (error) {
    context.stack.delete(driverCode);
    issues.push({
      severity: 'error',
      code: 'driver-evaluation-failed',
      message: `Nie udalo sie obliczyc czynnika '${driverCode}'.`,
      context: { driverCode, expression: driver.expression, error: error instanceof Error ? error.message : String(error) },
    });
    return null;
  }
}

function buildExplanation(
  rule: RuleRecord,
  variant: Variant,
  components: ResolvedComponent[],
  sumMm: number | null,
  activatedBy: string[],
) {
  const componentText = components
    .map((component) => `${component.label}=${component.valueMm === null ? 'brak danych' : `${component.valueMm} mm`}`)
    .join(' + ');

  return [
    `Kategoria: ${rule.categoryCode}`,
    `Aktywacja: ${activatedBy.join(', ')}`,
    `Wariant: ${variant.code}`,
    `Wzor: ${componentText || '0 mm'}`,
    `Wynik: ${sumMm === null ? 'brak danych' : `${sumMm} mm`}`,
  ].join(' | ');
}

function buildSummary(rows: CalculationRow[]): SummaryEntry[] {
  const summaryMap = new Map<string, number>();

  for (const row of rows) {
    if (!row.showInReport || !row.cableType || row.sumMm === null) {
      continue;
    }
    summaryMap.set(row.cableType, (summaryMap.get(row.cableType) ?? 0) + row.sumMm);
  }

  return [...summaryMap.entries()]
    .map(([cableType, totalMm]) => ({
      cableType,
      totalMm: round(totalMm, 4),
      totalM: round(totalMm / 1000, 4),
    }))
    .sort((left, right) => left.cableType.localeCompare(right.cableType));
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}




