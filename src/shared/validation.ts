import type {
  DataIssue,
  ReferenceData,
  RuleLengthComponent,
  RuleRecord,
} from './types.ts';
import { canonicalGroupCode, canonicalOptionValue } from './utils.ts';

function pushIssue(issues: DataIssue[], issue: DataIssue) {
  issues.push(issue);
}

export function validateState(referenceData: ReferenceData, rules: RuleRecord[]): DataIssue[] {
  const issues: DataIssue[] = [];

  const variantCodes = new Set<string>();
  for (const variant of referenceData.variants) {
    if (variantCodes.has(variant.code)) {
      pushIssue(issues, {
        severity: 'error',
        code: 'duplicate-variant-code',
        message: `Duplicate variant code: ${variant.code}`,
        context: { variantCode: variant.code },
      });
    }
    variantCodes.add(variant.code);
  }

  const indexKeys = new Set<string>();
  for (const mapping of referenceData.indexMappings) {
    const key = `${mapping.variantCode}::${mapping.indexCode}`;
    if (indexKeys.has(key)) {
      pushIssue(issues, {
        severity: 'error',
        code: 'duplicate-index-mapping',
        message: `Duplicate index mapping for ${mapping.variantCode} / ${mapping.indexCode}`,
        context: { variantCode: mapping.variantCode, indexCode: mapping.indexCode },
      });
    }
    indexKeys.add(key);
  }

  const driverCodes = new Set(referenceData.lengthDrivers.map((driver) => driver.code));
  const groupCodes = new Set(referenceData.optionGroups.map((group) => canonicalGroupCode(group.code)));
  const optionMap = new Map<string, Set<string>>();
  for (const value of referenceData.optionValues) {
    const groupCode = canonicalGroupCode(value.groupCode);
    if (!optionMap.has(groupCode)) {
      optionMap.set(groupCode, new Set());
    }
    optionMap.get(groupCode)?.add(canonicalOptionValue(groupCode, value.value));
  }
  const cableCodes = new Set(referenceData.cableTypes.map((cable) => cable.code));

  for (const rule of rules) {
    if (!rule.isActive) {
      continue;
    }

    if (rule.categoryCode !== 'standard' && rule.conditions.length === 0) {
      pushIssue(issues, {
        severity: 'warning',
        code: 'rule-without-conditions',
        message: `Rule '${rule.element}' has no activation conditions and will remain inactive until edited.`,
        context: { ruleId: rule.id, element: rule.element },
      });
    }

    for (const condition of rule.conditions) {
      const fieldCode = canonicalGroupCode(condition.field);
      if (!groupCodes.has(fieldCode)) {
        pushIssue(issues, {
          severity: 'error',
          code: 'unknown-condition-field',
          message: `Rule '${rule.element}' references unknown field '${condition.field}'.`,
          context: { ruleId: rule.id, field: condition.field },
        });
        continue;
      }

      const allowedValues = optionMap.get(fieldCode) ?? new Set<string>();
      for (const value of condition.values) {
        if (!allowedValues.has(canonicalOptionValue(fieldCode, value))) {
          pushIssue(issues, {
            severity: 'error',
            code: 'unknown-condition-value',
            message: `Rule '${rule.element}' references unknown option '${value}' in '${condition.field}'.`,
            context: { ruleId: rule.id, field: condition.field, value },
          });
        }
      }
    }

    if (rule.cableTypeCode && !cableCodes.has(rule.cableTypeCode)) {
      pushIssue(issues, {
        severity: 'error',
        code: 'unknown-cable-type',
        message: `Rule '${rule.element}' references unknown cable type '${rule.cableTypeCode}'.`,
        context: { ruleId: rule.id, cableTypeCode: rule.cableTypeCode },
      });
    }

    if (!rule.cableTypeCode) {
      pushIssue(issues, {
        severity: 'warning',
        code: 'rule-without-cable-type',
        message: `Rule '${rule.element}' does not have a cable type and will be excluded from cable summaries.`,
        context: { ruleId: rule.id, element: rule.element },
      });
    }

    for (const component of rule.lengthComponents) {
      validateComponent(issues, rule, component, driverCodes, referenceData);
    }
  }

  const requiredIndexes = new Set<string>();
  for (const rule of rules) {
    for (const component of rule.lengthComponents) {
      if (component.kind === 'index-distance') {
        requiredIndexes.add(component.indexCode);
      }
    }
  }

  for (const variant of referenceData.variants.filter((item) => item.isActive)) {
    const available = new Set(
      referenceData.indexMappings
        .filter((mapping) => mapping.variantCode === variant.code)
        .map((mapping) => mapping.indexCode),
    );

    const missing = [...requiredIndexes].filter((indexCode) => !available.has(indexCode));
    if (missing.length > 0) {
      pushIssue(issues, {
        severity: 'warning',
        code: 'missing-index-coverage',
        message: `Variant '${variant.code}' is missing index mappings for: ${missing.join(', ')}`,
        context: { variantCode: variant.code, missing },
      });
    }
  }

  return issues;
}

function validateComponent(
  issues: DataIssue[],
  rule: RuleRecord,
  component: RuleLengthComponent,
  driverCodes: Set<string>,
  referenceData: ReferenceData,
) {
  if (component.kind === 'driver' && !driverCodes.has(component.driverCode)) {
    pushIssue(issues, {
      severity: 'error',
      code: 'unknown-length-driver',
      message: `Rule '${rule.element}' references unknown length driver '${component.driverCode}'.`,
      context: { ruleId: rule.id, driverCode: component.driverCode },
    });
  }

  if (component.kind === 'index-distance' && !referenceData.indexMappings.some((mapping) => mapping.indexCode === component.indexCode)) {
    pushIssue(issues, {
      severity: 'error',
      code: 'unknown-index-code',
      message: `Rule '${rule.element}' references unknown index '${component.indexCode}'.`,
      context: { ruleId: rule.id, indexCode: component.indexCode },
    });
  }
}
