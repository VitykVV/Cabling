import type React from 'react';
import type { DataIssue, OptionValue, ReferenceData, RuleLengthComponent, RuleRecord, SavedConfiguration } from '../shared/types.ts';
import { createId } from '../shared/utils.ts';

export function ensureSelections(referenceData: ReferenceData, currentSelections: Record<string, string>) {
  const nextSelections = { ...currentSelections };

  for (const group of referenceData.optionGroups.filter((item) => item.isVisibleInConfigurator)) {
    const activeOptions = referenceData.optionValues.filter((value) => value.groupCode === group.code && value.isActive);
    const hasCurrentValue = activeOptions.some((value) => value.value === nextSelections[group.code]);

    if (!hasCurrentValue && activeOptions[0]) {
      nextSelections[group.code] = activeOptions[0].value;
    }
  }

  return nextSelections;
}

export function syncSelections(referenceData: ReferenceData, currentSelections: Record<string, string>) {
  const knownGroupCodes = new Set(referenceData.optionGroups.map((group) => group.code));
  const prunedSelections = Object.fromEntries(
    Object.entries(currentSelections).filter(([key]) => knownGroupCodes.has(key)),
  );

  return ensureSelections(referenceData, prunedSelections);
}

export function renameSelectionKey(selections: Record<string, string>, currentKey: string, nextKey: string) {
  if (currentKey === nextKey || !(currentKey in selections)) {
    return selections;
  }

  const nextSelections = { ...selections, [nextKey]: selections[currentKey] };
  delete nextSelections[currentKey];
  return nextSelections;
}

export function omitSelectionKey(selections: Record<string, string>, keyToRemove: string) {
  if (!(keyToRemove in selections)) {
    return selections;
  }

  const nextSelections = { ...selections };
  delete nextSelections[keyToRemove];
  return nextSelections;
}

export function groupOptionValues(optionValues: OptionValue[]) {
  return optionValues.reduce((map, value) => {
    const items = map.get(value.groupCode) ?? [];
    items.push(value);
    map.set(value.groupCode, items);
    return map;
  }, new Map<string, OptionValue[]>());
}

export function dedupeIssues(issues: DataIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.severity}:${issue.code}:${issue.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function upsertLocalConfiguration(configurations: SavedConfiguration[], nextConfiguration: SavedConfiguration) {
  const existing = configurations.find((item) => item.id === nextConfiguration.id);
  if (!existing) {
    return [nextConfiguration, ...configurations];
  }
  return configurations.map((configuration) =>
    configuration.id === nextConfiguration.id ? nextConfiguration : configuration,
  );
}

export function splitInlineValues(value: string) {
  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function changeComponentKind(component: RuleLengthComponent, kind: RuleLengthComponent['kind']): RuleLengthComponent {
  if (kind === component.kind) {
    return component;
  }
  if (kind === 'constant') {
    return { id: component.id, kind, label: component.label, valueMm: 0 };
  }
  if (kind === 'driver') {
    return { id: component.id, kind, label: component.label, driverCode: 'widthHalf' };
  }
  return { id: component.id, kind, label: component.label, indexCode: 'AG' };
}

export function updateVariant(
  setReferenceData: React.Dispatch<React.SetStateAction<ReferenceData | null>>,
  variantId: string,
  field: 'code' | 'lengthMm' | 'widthMm' | 'heightMm' | 'isActive',
  value: string | number | boolean,
) {
  setReferenceData((current) =>
    current
      ? {
          ...current,
          variants: current.variants.map((variant) =>
            variant.id === variantId ? { ...variant, [field]: value } : variant,
          ),
        }
      : current,
  );
}

export function updateDriver(
  setReferenceData: React.Dispatch<React.SetStateAction<ReferenceData | null>>,
  driverId: string,
  field: 'code' | 'label' | 'expression' | 'isActive',
  value: string | boolean,
) {
  setReferenceData((current) =>
    current
      ? {
          ...current,
          lengthDrivers: current.lengthDrivers.map((driver) =>
            driver.id === driverId ? { ...driver, [field]: value } : driver,
          ),
        }
      : current,
  );
}

export function updateCableType(
  setReferenceData: React.Dispatch<React.SetStateAction<ReferenceData | null>>,
  cableId: string,
  field: 'code' | 'label' | 'isActive',
  value: string | boolean,
) {
  setReferenceData((current) =>
    current
      ? {
          ...current,
          cableTypes: current.cableTypes.map((cable) =>
            cable.id === cableId ? { ...cable, [field]: value } : cable,
          ),
        }
      : current,
  );
}

export function updateOptionValue(
  setReferenceData: React.Dispatch<React.SetStateAction<ReferenceData | null>>,
  optionId: string,
  field: 'value' | 'label' | 'isActive',
  value: string | boolean,
) {
  setReferenceData((current) =>
    current
      ? {
          ...current,
          optionValues: current.optionValues.map((option) =>
            option.id === optionId ? { ...option, [field]: value } : option,
          ),
        }
      : current,
  );
}

export function addOptionValue(setReferenceData: React.Dispatch<React.SetStateAction<ReferenceData | null>>, groupCode: string) {
  setReferenceData((current) =>
    current
      ? {
          ...current,
          optionValues: [
            ...current.optionValues,
            {
              id: createId('option'),
              groupCode,
              value: 'Nowa wartosc',
              label: 'Nowa wartosc',
              isActive: true,
            },
          ],
        }
      : current,
  );
}

export function updateIndexMapping(
  setReferenceData: React.Dispatch<React.SetStateAction<ReferenceData | null>>,
  mappingId: string,
  field: 'variantCode' | 'indexCode' | 'distanceMm',
  value: string | number,
) {
  setReferenceData((current) =>
    current
      ? {
          ...current,
          indexMappings: current.indexMappings.map((mapping) =>
            mapping.id === mappingId ? { ...mapping, [field]: value } : mapping,
          ),
        }
      : current,
  );
}

export function addIndexMapping(
  setReferenceData: React.Dispatch<React.SetStateAction<ReferenceData | null>>,
  variantCode: string,
) {
  setReferenceData((current) =>
    current
      ? {
          ...current,
          indexMappings: [
            ...current.indexMappings,
            {
              id: createId('index'),
              variantCode,
              indexCode: 'NEW',
              distanceMm: 0,
            },
          ],
        }
      : current,
  );
}

const RULE_METADATA_CODES = new Set([
  'config-rule-disabled-by-reference-output',
  'config-rule-overridden-by-workbook-output',
]);

export function clearCableTypeFromRules(rules: RuleRecord[], cableTypeCode: string) {
  return rules.map((rule) =>
    rule.cableTypeCode === cableTypeCode
      ? { ...rule, cableTypeCode: null }
      : rule,
  );
}

export function filterRuleContextIssues(issues: DataIssue[]) {
  return issues.filter((issue) => RULE_METADATA_CODES.has(issue.code));
}

export const meterFormatter = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
