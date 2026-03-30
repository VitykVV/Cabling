import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReferenceData, RuleRecord } from '../src/shared/types.ts';
import { clearCableTypeFromRules, ensureSelections, filterRuleContextIssues, omitSelectionKey, renameSelectionKey, syncSelections } from '../src/app/helpers.ts';

const referenceData: ReferenceData = {
  variants: [],
  indexMappings: [],
  lengthDrivers: [],
  optionGroups: [
    { id: 'group-1', code: 'konfiguracja', label: 'Konfiguracja', type: 'single-select', isVisibleInConfigurator: true },
    { id: 'group-2', code: 'recyrkulacja', label: 'Recyrkulacja', type: 'boolean-select', isVisibleInConfigurator: true },
    { id: 'group-3', code: 'ukryta', label: 'Ukryta', type: 'single-select', isVisibleInConfigurator: false },
  ],
  optionValues: [
    { id: 'option-1', groupCode: 'konfiguracja', value: 'A', label: 'A', isActive: true },
    { id: 'option-2', groupCode: 'konfiguracja', value: 'B', label: 'B', isActive: true },
    { id: 'option-3', groupCode: 'recyrkulacja', value: 'Tak', label: 'Tak', isActive: true },
    { id: 'option-4', groupCode: 'ukryta', value: 'X', label: 'X', isActive: true },
  ],
  cableTypes: [],
};

test('ensureSelections fills missing visible groups with active defaults', () => {
  const next = ensureSelections(referenceData, { konfiguracja: 'B' });

  assert.deepEqual(next, {
    konfiguracja: 'B',
    recyrkulacja: 'Tak',
  });
});

test('syncSelections removes unknown keys and repairs invalid values', () => {
  const next = syncSelections(referenceData, {
    konfiguracja: 'nie-ma-takiej-opcji',
    recyrkulacja: 'Tak',
    staryKlucz: '123',
  });

  assert.deepEqual(next, {
    konfiguracja: 'A',
    recyrkulacja: 'Tak',
  });
});

test('renameSelectionKey moves selected value to a new key', () => {
  const next = renameSelectionKey({ konfiguracja: 'A', recyrkulacja: 'Tak' }, 'konfiguracja', 'nowa-konfiguracja');

  assert.deepEqual(next, {
    'nowa-konfiguracja': 'A',
    recyrkulacja: 'Tak',
  });
});

test('omitSelectionKey removes only the requested key', () => {
  const next = omitSelectionKey({ konfiguracja: 'A', recyrkulacja: 'Tak' }, 'recyrkulacja');

  assert.deepEqual(next, {
    konfiguracja: 'A',
  });
});

test('clearCableTypeFromRules clears cable type code only in matching rules', () => {
  const rules: RuleRecord[] = [
    {
      id: 'rule-1',
      element: 'A',
      categoryCode: 'standard',
      description: '',
      showInReport: true,
      conditions: [],
      lengthComponents: [],
      cableTypeCode: 'YLY',
      notes: '',
      isActive: true,
    },
    {
      id: 'rule-2',
      element: 'B',
      categoryCode: 'standard',
      description: '',
      showInReport: true,
      conditions: [],
      lengthComponents: [],
      cableTypeCode: 'H07V-K',
      notes: '',
      isActive: true,
    },
  ];

  const next = clearCableTypeFromRules(rules, 'YLY');

  assert.equal(next[0]?.cableTypeCode, null);
  assert.equal(next[1]?.cableTypeCode, 'H07V-K');
});

test('filterRuleContextIssues keeps only workbook-driven rule metadata', () => {
  const next = filterRuleContextIssues([
    { severity: 'warning', code: 'config-rule-disabled-by-reference-output', message: 'A' },
    { severity: 'warning', code: 'config-rule-overridden-by-workbook-output', message: 'B' },
    { severity: 'error', code: 'duplicate-index-mapping', message: 'C' },
  ]);

  assert.deepEqual(next.map((issue) => issue.code), [
    'config-rule-disabled-by-reference-output',
    'config-rule-overridden-by-workbook-output',
  ]);
});
