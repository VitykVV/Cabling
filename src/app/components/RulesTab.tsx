import type React from 'react';
import type { CalculationResult, DataIssue, OptionGroup, OptionValue, ReferenceData, RuleCondition, RuleLengthComponent, RuleRecord } from '../../shared/types.ts';
import { createEmptyRule } from '../../shared/engine.ts';
import { createId, displayContextKey, displayGroupLabel, displayIssueLabel, displayIssueMessage, formatContextValue } from '../../shared/utils.ts';
import { meterFormatter } from '../helpers.ts';

type SelectOption = {
  value: string;
  label: string;
};

export function RulesTab(props: {
  rules: RuleRecord[];
  filteredRules: RuleRecord[];
  selectedRule: RuleRecord | null;
  ruleFilter: string;
  onRuleFilterChange: (value: string) => void;
  onSelectRule: (id: string) => void;
  optionGroups: OptionGroup[];
  optionValuesByGroup: Map<string, OptionValue[]>;
  cableTypes: ReferenceData['cableTypes'];
  lengthDrivers: ReferenceData['lengthDrivers'];
  indexCodes: string[];
  issues: DataIssue[];
  onRulesChange: React.Dispatch<React.SetStateAction<RuleRecord[]>>;
  preview: CalculationResult | null;
}) {
  const workbookDrivenCount = props.rules.filter((rule) => hasIssueCode(rule, props.issues, 'config-rule-overridden-by-workbook-output')).length;
  const workbookDisabledCount = props.rules.filter((rule) => hasIssueCode(rule, props.issues, 'config-rule-disabled-by-reference-output')).length;
  const rulesWithoutCableType = props.rules.filter((rule) => rule.cableTypeCode === null).length;
  const selectedRuleIssues = props.selectedRule ? props.issues.filter((issue) => matchesRule(issue, props.selectedRule!)) : [];

  return (
    <div className="rules-layout">
      <div className="card rules-list-card">
        <div className="section-header compact">
          <div>
            <p className="section-kicker">Lista</p>
            <h2>Reguly</h2>
          </div>
          <button
            className="primary-button"
            onClick={() => props.onRulesChange((current) => [createEmptyRule(), ...current])}
          >
            Nowa regula
          </button>
        </div>

        <div className="summary-card-grid compact-grid">
          <div className="summary-pill compact-pill"><span>Aktywne</span><strong>{props.rules.filter((rule) => rule.isActive).length}</strong></div>
          <div className="summary-pill compact-pill"><span>Excel</span><strong>{workbookDrivenCount}</strong></div>
          <div className="summary-pill compact-pill"><span>Wyl. z Excela</span><strong>{workbookDisabledCount}</strong></div>
          <div className="summary-pill compact-pill"><span>Bez typu kabla</span><strong>{rulesWithoutCableType}</strong></div>
        </div>

        <input
          className="text-input"
          value={props.ruleFilter}
          onChange={(event) => props.onRuleFilterChange(event.target.value)}
          placeholder="Filtruj po elemencie lub kategorii"
        />
        <div className="rule-list">
          {props.filteredRules.map((rule) => (
            <button
              key={rule.id}
              className={props.selectedRule?.id === rule.id ? 'rule-list-item active' : 'rule-list-item'}
              onClick={() => props.onSelectRule(rule.id)}
            >
              <div className="rule-list-top">
                <strong>{rule.element}</strong>
                <div className="badge-row">
                  <span className={rule.isActive ? 'status-badge success' : 'status-badge muted'}>{rule.isActive ? 'Aktywna' : 'Wylaczona'}</span>
                  {hasIssueCode(rule, props.issues, 'config-rule-overridden-by-workbook-output') && <span className="status-badge info">Logika z Excela</span>}
                  {hasIssueCode(rule, props.issues, 'config-rule-disabled-by-reference-output') && <span className="status-badge warning">Nie wystepuje w wydruku</span>}
                  {rule.cableTypeCode === null && <span className="status-badge warning">Brak typu kabla</span>}
                </div>
              </div>
              <span>{rule.categoryCode}</span>
              <span className="rule-list-meta">Warunki: {rule.conditions.length} | Skladniki: {rule.lengthComponents.length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card rule-editor-card">
        {props.selectedRule ? (
          <RuleEditor
            rule={props.selectedRule}
            optionGroups={props.optionGroups}
            optionValuesByGroup={props.optionValuesByGroup}
            cableTypes={props.cableTypes}
            lengthDrivers={props.lengthDrivers}
            indexCodes={props.indexCodes}
            issues={selectedRuleIssues}
            onChange={(nextRule) =>
              props.onRulesChange((current) => current.map((rule) => (rule.id === nextRule.id ? nextRule : rule)))
            }
            onDelete={() => props.onRulesChange((current) => current.filter((rule) => rule.id !== props.selectedRule?.id))}
            preview={props.preview}
          />
        ) : (
          <p>Brak wybranej reguly.</p>
        )}
      </div>
    </div>
  );
}

function RuleEditor(props: {
  rule: RuleRecord;
  optionGroups: OptionGroup[];
  optionValuesByGroup: Map<string, OptionValue[]>;
  cableTypes: ReferenceData['cableTypes'];
  lengthDrivers: ReferenceData['lengthDrivers'];
  indexCodes: string[];
  issues: DataIssue[];
  onChange: (rule: RuleRecord) => void;
  onDelete: () => void;
  preview: CalculationResult | null;
}) {
  const previewRow = props.preview?.rows[0] ?? null;
  const categoryOptions = buildCategoryOptions(props.optionGroups, props.rule.categoryCode);
  const cableTypeOptions = ensureCurrentOption(
    props.cableTypes
      .filter((cable) => cable.isActive)
      .map((cable) => ({ value: cable.code, label: cable.label })),
    props.rule.cableTypeCode,
  );
  const driverOptions = props.lengthDrivers.length > 0
    ? ensureCurrentOption(
        props.lengthDrivers
          .filter((driver) => driver.isActive)
          .map((driver) => ({ value: driver.code, label: driver.label })),
        null,
      )
    : [{ value: 'widthHalf', label: 'Brak czynnikow w danych bazowych' }];

  return (
    <div className="stack-lg">
      <div className="section-header compact">
        <div>
          <p className="section-kicker">Edycja</p>
          <h2>{props.rule.element}</h2>
        </div>
        <button className="ghost-button danger" onClick={props.onDelete}>
          Usun regule
        </button>
      </div>

      <div className="form-grid two-columns">
        <label className="field-block">
          <span>Element</span>
          <input className="text-input" value={props.rule.element} onChange={(event) => props.onChange({ ...props.rule, element: event.target.value })} />
        </label>
        <label className="field-block">
          <span>Kategoria</span>
          <select className="select-input" value={props.rule.categoryCode} onChange={(event) => props.onChange({ ...props.rule, categoryCode: event.target.value })}>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="field-block wide">
          <span>Opis</span>
          <textarea className="text-area" value={props.rule.description} onChange={(event) => props.onChange({ ...props.rule, description: event.target.value })} />
        </label>
        <label className="field-block">
          <span>Typ kabla</span>
          <select className="select-input" value={props.rule.cableTypeCode ?? ''} onChange={(event) => props.onChange({ ...props.rule, cableTypeCode: event.target.value || null })}>
            <option value="">Brak</option>
            {cableTypeOptions.map((cable) => (
              <option key={cable.value} value={cable.value}>{cable.label}</option>
            ))}
          </select>
        </label>
        <label className="field-block checkbox-row">
          <input type="checkbox" checked={props.rule.isActive} onChange={(event) => props.onChange({ ...props.rule, isActive: event.target.checked })} />
          <span>Regula aktywna</span>
        </label>
        <label className="field-block checkbox-row">
          <input type="checkbox" checked={props.rule.showInReport} onChange={(event) => props.onChange({ ...props.rule, showInReport: event.target.checked })} />
          <span>Pokazuj w raporcie</span>
        </label>
        <label className="field-block wide">
          <span>Notatki techniczne</span>
          <textarea className="text-area text-area-compact" value={props.rule.notes} onChange={(event) => props.onChange({ ...props.rule, notes: event.target.value })} />
        </label>
      </div>

      {props.issues.length > 0 && (
        <div className="card inset-card">
          <div className="section-header compact slim">
            <div>
              <p className="section-kicker">Kontrola</p>
              <h3>Uwagi do tej reguly</h3>
            </div>
          </div>
          <div className="stack-md">
            {props.issues.map((issue, index) => (
              <div key={`${issue.code}-${index}`} className={issue.severity === 'error' ? 'issue-box error' : 'issue-box warning'}>
                <strong>{displayIssueLabel(issue.code)}</strong>
                <p>{displayIssueMessage(issue)}</p>
                {issue.context && <div className="context-row">{formatContext(issue.context)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card inset-card">
        <div className="section-header compact">
          <div>
            <p className="section-kicker">Warunki</p>
            <h3>Aktywacja</h3>
          </div>
          <button className="ghost-button" onClick={() => props.onChange({ ...props.rule, conditions: [...props.rule.conditions, createDefaultCondition(props.optionGroups, props.optionValuesByGroup)] })} disabled={props.optionGroups.length === 0}>
            Dodaj warunek
          </button>
        </div>
        <p className="subtle-copy">Pole i wartosci wybierasz tylko z danych bazowych. Dla wielu wartosci przytrzymaj Ctrl lub Cmd.</p>
        <div className="stack-md">
          {props.rule.conditions.length === 0 && <p className="subtle-copy">Regula bez warunkow bedzie aktywna tylko wtedy, gdy ma kategorie `standard`.</p>}
          {props.rule.conditions.map((condition) => {
            const fieldOptions = buildFieldOptions(props.optionGroups, condition.field);
            const valueOptions = buildConditionValueOptions(condition.field, props.optionValuesByGroup, condition.values);
            return (
              <div key={condition.id} className="condition-row">
                <select
                  className="select-input"
                  value={condition.field}
                  onChange={(event) => {
                    const nextField = event.target.value;
                    const defaultValues = buildConditionValueOptions(nextField, props.optionValuesByGroup, []).slice(0, 1).map((option) => option.value);
                    updateCondition(props.rule, condition.id, { field: nextField, values: defaultValues }, props.onChange);
                  }}
                >
                  {fieldOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select
                  className="select-input"
                  multiple
                  size={Math.min(6, Math.max(3, valueOptions.length || 3))}
                  value={condition.values}
                  onChange={(event) => updateCondition(props.rule, condition.id, { values: readSelectedValues(event.currentTarget) }, props.onChange)}
                >
                  {valueOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button className="ghost-button danger" onClick={() => props.onChange({ ...props.rule, conditions: props.rule.conditions.filter((item) => item.id !== condition.id) })}>Usun</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card inset-card">
        <div className="section-header compact">
          <div>
            <p className="section-kicker">Dlugosc</p>
            <h3>Skladniki</h3>
          </div>
          <button className="ghost-button" onClick={() => props.onChange({ ...props.rule, lengthComponents: [...props.rule.lengthComponents, { id: createId('component'), kind: 'constant', label: 'Nowy skladnik', valueMm: 0 }] })}>
            Dodaj skladnik
          </button>
        </div>
        <p className="subtle-copy">Czynnik i index sa wybierane z list z danych bazowych. Recznie wpisujesz tylko etykiete skladnika i stala wartosc mm.</p>
        <div className="stack-md">
          {props.rule.lengthComponents.map((component) => {
            const indexOptions = buildIndexOptions(props.indexCodes, component.kind === 'index-distance' ? component.indexCode : null);
            const resolvedDriverOptions = component.kind === 'driver'
              ? ensureCurrentOption(driverOptions, component.driverCode)
              : driverOptions;

            return (
              <div key={component.id} className="component-row">
                <input className="text-input" value={component.label} onChange={(event) => updateComponent(props.rule, component.id, { label: event.target.value }, props.onChange)} />
                <select className="select-input" value={component.kind} onChange={(event) => updateComponent(props.rule, component.id, createComponentForKind(component, event.target.value as RuleLengthComponent['kind'], props.lengthDrivers, props.indexCodes), props.onChange, true)}>
                  <option value="constant">Stala</option>
                  <option value="driver">Czynnik</option>
                  <option value="index-distance">Index</option>
                </select>
                {component.kind === 'constant' && <input className="text-input" type="number" value={component.valueMm} onChange={(event) => updateComponent(props.rule, component.id, { valueMm: Number(event.target.value) }, props.onChange)} />}
                {component.kind === 'driver' && (
                  <select className="select-input" value={component.driverCode} onChange={(event) => updateComponent(props.rule, component.id, { driverCode: event.target.value }, props.onChange)}>
                    {resolvedDriverOptions.map((driver) => <option key={driver.value} value={driver.value}>{driver.label}</option>)}
                  </select>
                )}
                {component.kind === 'index-distance' && (
                  <select className="select-input" value={component.indexCode} onChange={(event) => updateComponent(props.rule, component.id, { indexCode: event.target.value }, props.onChange)}>
                    {indexOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                )}
                <button className="ghost-button danger" onClick={() => props.onChange({ ...props.rule, lengthComponents: props.rule.lengthComponents.filter((item) => item.id !== component.id) })}>Usun</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card inset-card">
        <p className="section-kicker">Podglad reguly</p>
        {previewRow ? (
          <div className="preview-block column">
            <strong>{previewRow.element}</strong>
            <p>{previewRow.explanation}</p>
            <p>Aktywacja: {previewRow.activatedBy.join(' | ')}</p>
            <p>Suma: {previewRow.sumM === null ? 'brak danych' : `${meterFormatter.format(previewRow.sumM)} m`}</p>
            {previewRow.warnings.length > 0 && <p className="warning-copy">Ostrzezenia: {previewRow.warnings.join(' | ')}</p>}
          </div>
        ) : (
          <p>Przy obecnej konfiguracji regula nie jest aktywna.</p>
        )}
      </div>
    </div>
  );
}

function updateCondition(rule: RuleRecord, conditionId: string, patch: Partial<RuleCondition>, onChange: (rule: RuleRecord) => void) {
  onChange({
    ...rule,
    conditions: rule.conditions.map((condition) => (condition.id === conditionId ? { ...condition, ...patch } : condition)),
  });
}

function updateComponent(
  rule: RuleRecord,
  componentId: string,
  patch: Partial<RuleLengthComponent> | RuleLengthComponent,
  onChange: (rule: RuleRecord) => void,
  replace = false,
) {
  onChange({
    ...rule,
    lengthComponents: rule.lengthComponents.map((component) => {
      if (component.id !== componentId) {
        return component;
      }
      if (replace) {
        return patch as RuleLengthComponent;
      }
      return { ...component, ...(patch as Partial<RuleLengthComponent>) } as RuleLengthComponent;
    }),
  });
}

function createDefaultCondition(optionGroups: OptionGroup[], optionValuesByGroup: Map<string, OptionValue[]>) {
  const defaultField = optionGroups[0]?.code ?? 'konfiguracja';
  const defaultValue = buildConditionValueOptions(defaultField, optionValuesByGroup, [])[0]?.value;

  return {
    id: createId('condition'),
    field: defaultField,
    operator: 'in' as const,
    values: defaultValue ? [defaultValue] : [],
  };
}

function createComponentForKind(
  component: RuleLengthComponent,
  kind: RuleLengthComponent['kind'],
  lengthDrivers: ReferenceData['lengthDrivers'],
  indexCodes: string[],
): RuleLengthComponent {
  if (kind === component.kind) {
    return component;
  }

  if (kind === 'constant') {
    return { id: component.id, kind, label: component.label, valueMm: 0 };
  }

  if (kind === 'driver') {
    return {
      id: component.id,
      kind,
      label: component.label,
      driverCode: lengthDrivers.find((driver) => driver.isActive)?.code ?? lengthDrivers[0]?.code ?? 'widthHalf',
    };
  }

  return {
    id: component.id,
    kind,
    label: component.label,
    indexCode: indexCodes[0] ?? 'AG',
  };
}

function buildCategoryOptions(optionGroups: OptionGroup[], currentCategory: string) {
  const options: SelectOption[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'niestandardowa', label: 'Niestandardowa' },
    ...optionGroups.map((group) => ({ value: group.code, label: displayGroupLabel(group.code) })),
  ];

  return ensureCurrentOption(options, currentCategory);
}

function buildFieldOptions(optionGroups: OptionGroup[], currentField: string) {
  return ensureCurrentOption(
    optionGroups.map((group) => ({ value: group.code, label: displayGroupLabel(group.code) })),
    currentField,
  );
}

function buildConditionValueOptions(field: string, optionValuesByGroup: Map<string, OptionValue[]>, currentValues: string[]) {
  const baseOptions = (optionValuesByGroup.get(field) ?? [])
    .filter((option) => option.isActive)
    .map((option) => ({ value: option.value, label: option.label }));

  return ensureCurrentOptions(baseOptions, currentValues);
}

function buildIndexOptions(indexCodes: string[], currentIndexCode: string | null) {
  const baseOptions = indexCodes.map((indexCode) => ({ value: indexCode, label: indexCode }));
  return ensureCurrentOption(baseOptions, currentIndexCode);
}

function ensureCurrentOption(options: SelectOption[], currentValue: string | null) {
  if (!currentValue) {
    return options;
  }
  if (options.some((option) => option.value === currentValue)) {
    return options;
  }
  return [...options, { value: currentValue, label: `${currentValue} (obecna wartosc)` }];
}

function ensureCurrentOptions(options: SelectOption[], currentValues: string[]) {
  const nextOptions = [...options];
  const knownValues = new Set(options.map((option) => option.value));

  for (const value of currentValues) {
    if (knownValues.has(value)) {
      continue;
    }
    nextOptions.push({ value, label: `${value} (obecna wartosc)` });
    knownValues.add(value);
  }

  return nextOptions;
}

function readSelectedValues(select: HTMLSelectElement) {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function matchesRule(issue: DataIssue, rule: RuleRecord) {
  const ruleId = typeof issue.context?.ruleId === 'string' ? issue.context.ruleId : null;
  const element = typeof issue.context?.element === 'string' ? issue.context.element : null;
  return ruleId === rule.id || element === rule.element;
}

function hasIssueCode(rule: RuleRecord, issues: DataIssue[], code: string) {
  return issues.some((issue) => issue.code === code && matchesRule(issue, rule));
}

function formatContext(context: Record<string, unknown>) {
  return Object.entries(context).map(([key, value]) => {
    return <span key={key} className="context-chip">{displayContextKey(key)}: {formatContextValue(value)}</span>;
  });
}