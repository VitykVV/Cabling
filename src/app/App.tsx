import { useEffect, useMemo, useRef, useState } from 'react';
import { calculate } from '../shared/engine.ts';
import type { DataIssue, ReferenceData, RuleRecord, SavedConfiguration, SeedMetadata } from '../shared/types.ts';
import { createId } from '../shared/utils.ts';
import { downloadExport, fetchBootstrap, removeConfiguration, saveConfiguration, saveState } from './api.ts';
import { ConfiguratorTab } from './components/ConfiguratorTab.tsx';
import { DataTab } from './components/DataTab.tsx';
import { IssuesPanel } from './components/IssuesPanel.tsx';
import { ResultsTab } from './components/ResultsTab.tsx';
import { RulesTab } from './components/RulesTab.tsx';
import {
  clearCableTypeFromRules,
  dedupeIssues,
  ensureSelections,
  filterRuleContextIssues,
  groupOptionValues,
  omitSelectionKey,
  renameSelectionKey,
  syncSelections,
  upsertLocalConfiguration,
} from './helpers.ts';

const EMPTY_ISSUES: DataIssue[] = [];
const AUTO_SAVE_DELAY_MS = 900;
const LOCAL_DRAFT_KEY = 'cabling-reference-draft';

type SaveIndicator = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
type SaveMode = 'auto' | 'manual';

export function App() {
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [savedConfigurations, setSavedConfigurations] = useState<SavedConfiguration[]>([]);
  const [metadata, setMetadata] = useState<SeedMetadata | null>(null);
  const [validationIssues, setValidationIssues] = useState<DataIssue[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'configurator' | 'results' | 'rules' | 'data'>('configurator');
  const [configurationName, setConfigurationName] = useState('Scenariusz roboczy');
  const [currentConfigurationId, setCurrentConfigurationId] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [ruleFilter, setRuleFilter] = useState('');
  const [indexFilterVariant, setIndexFilterVariant] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>('idle');

  const latestReferenceDataRef = useRef<ReferenceData | null>(null);
  const latestRulesRef = useRef<RuleRecord[]>([]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedSnapshotRef = useRef('');
  const bootstrapReadyRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef(false);

  useEffect(() => {
    void loadBootstrap();
  }, []);

  useEffect(() => {
    latestReferenceDataRef.current = referenceData;
    latestRulesRef.current = rules;
  }, [referenceData, rules]);

  useEffect(() => {
    if (!referenceData) {
      return;
    }

    setSelections((current) => {
      const next = syncSelections(referenceData, current);
      return areSelectionsEqual(current, next) ? current : next;
    });
  }, [referenceData]);

  useEffect(() => {
    if (!referenceData || loading || !bootstrapReadyRef.current) {
      return;
    }

    const snapshot = serializeAppState(referenceData, rules);
    if (snapshot === lastPersistedSnapshotRef.current) {
      clearLocalDraft();
      return;
    }

    writeLocalDraft(snapshot);
    setSaveIndicator((current) => (current === 'saving' ? current : 'pending'));

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void persistCurrentState('auto');
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [referenceData, rules, loading]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const currentReferenceData = latestReferenceDataRef.current;
      if (!bootstrapReadyRef.current || !currentReferenceData) {
        return;
      }

      const snapshot = serializeAppState(currentReferenceData, latestRulesRef.current);
      if (saveIndicator === 'pending' || saveIndicator === 'saving' || saveIndicator === 'error' || snapshot !== lastPersistedSnapshotRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveIndicator]);

  const optionGroups = referenceData?.optionGroups ?? [];
  const optionValuesByGroup = useMemo(() => groupOptionValues(referenceData?.optionValues ?? []), [referenceData]);
  const visibleGroups = optionGroups.filter((group) => group.isVisibleInConfigurator);
  const indexCodes = useMemo(
    () => [...new Set((referenceData?.indexMappings ?? []).map((mapping) => mapping.indexCode))].sort(),
    [referenceData],
  );

  const calculation = useMemo(() => {
    if (!referenceData) {
      return { rows: [], summary: [], issues: EMPTY_ISSUES };
    }
    return calculate(referenceData, rules, selections);
  }, [referenceData, rules, selections]);

  const liveIssues = useMemo(
    () => dedupeIssues([...validationIssues, ...calculation.issues]),
    [validationIssues, calculation.issues],
  );

  const ruleContextIssues = useMemo(
    () => dedupeIssues([...filterRuleContextIssues(metadata?.issues ?? []), ...liveIssues]),
    [metadata, liveIssues],
  );

  const filteredRules = useMemo(() => {
    const normalized = ruleFilter.trim().toLowerCase();
    if (!normalized) {
      return rules;
    }
    return rules.filter((rule) => `${rule.element} ${rule.categoryCode}`.toLowerCase().includes(normalized));
  }, [rules, ruleFilter]);

  const selectedRule = useMemo(
    () => filteredRules.find((rule) => rule.id === selectedRuleId) ?? filteredRules[0] ?? null,
    [filteredRules, selectedRuleId],
  );

  const selectedRulePreview = useMemo(() => {
    if (!referenceData || !selectedRule) {
      return null;
    }
    return calculate(referenceData, [selectedRule], selections);
  }, [referenceData, selectedRule, selections]);

  useEffect(() => {
    if (selectedRule && selectedRule.id !== selectedRuleId) {
      setSelectedRuleId(selectedRule.id);
    }
  }, [selectedRule, selectedRuleId]);

  async function loadBootstrap() {
    setLoading(true);
    bootstrapReadyRef.current = false;

    try {
      const payload = await fetchBootstrap();
      const persistedSnapshot = serializeAppState(payload.referenceData, payload.rules);
      const localDraft = readLocalDraft();
      const hasDraft = Boolean(localDraft) && localDraft !== persistedSnapshot;
      const draftState = hasDraft ? parseDraftState(localDraft!) : null;
      const effectiveReferenceData = draftState?.referenceData ?? payload.referenceData;
      const effectiveRules = draftState?.rules ?? payload.rules;

      lastPersistedSnapshotRef.current = persistedSnapshot;
      setReferenceData(effectiveReferenceData);
      setRules(effectiveRules);
      setSavedConfigurations(payload.savedConfigurations);
      setMetadata(payload.metadata);
      setValidationIssues(hasDraft ? [] : payload.validationIssues);
      const initialConfiguration = payload.savedConfigurations[0];
      const initialSelections = ensureSelections(effectiveReferenceData, initialConfiguration?.selections ?? payload.metadata.referenceScenario.selections);
      setSelections(initialSelections);
      setConfigurationName(initialConfiguration?.name ?? 'Scenariusz referencyjny');
      setCurrentConfigurationId(initialConfiguration?.id ?? null);
      setSelectedRuleId(effectiveRules[0]?.id ?? null);
      setSaveIndicator(hasDraft ? 'pending' : 'idle');
      setStatusMessage(hasDraft ? 'Przywrocono niezapisane zmiany z przegladarki. Zostana zapisane automatycznie.' : 'Dane zaladowane z lokalnej bazy SQLite.');
    } catch (error) {
      setSaveIndicator('error');
      setStatusMessage(error instanceof Error ? error.message : 'Nie udalo sie zaladowac danych.');
    } finally {
      bootstrapReadyRef.current = true;
      setLoading(false);
    }
  }

  async function persistCurrentState(mode: SaveMode) {
    const currentReferenceData = latestReferenceDataRef.current;
    if (!currentReferenceData) {
      return;
    }

    const currentRules = latestRulesRef.current;
    const snapshot = serializeAppState(currentReferenceData, currentRules);
    if (snapshot === lastPersistedSnapshotRef.current) {
      setSaveIndicator('saved');
      clearLocalDraft();
      return;
    }

    if (saveInFlightRef.current) {
      queuedSaveRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);
    setSaveIndicator('saving');

    try {
      const result = await saveState({ referenceData: currentReferenceData, rules: currentRules });
      setValidationIssues(result.validationIssues);

      if (!result.ok) {
        setSaveIndicator('error');
        setStatusMessage(buildFailedSaveStatusMessage(result.validationIssues));
        return;
      }

      lastPersistedSnapshotRef.current = snapshot;
      clearLocalDraft();
      setSaveIndicator('saved');
      setStatusMessage(buildSaveStatusMessage(mode, result.validationIssues));
    } catch (error) {
      setSaveIndicator('error');
      setStatusMessage(error instanceof Error ? error.message : 'Zapis nie udal sie.');
    } finally {
      setSaving(false);
      saveInFlightRef.current = false;

      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        const nextReferenceData = latestReferenceDataRef.current;
        if (nextReferenceData) {
          const nextSnapshot = serializeAppState(nextReferenceData, latestRulesRef.current);
          if (nextSnapshot !== lastPersistedSnapshotRef.current) {
            void persistCurrentState('auto');
          }
        }
      }
    }
  }

  async function handleSaveState() {
    await persistCurrentState('manual');
  }

  async function handleSaveConfiguration() {
    const now = new Date().toISOString();
    const configuration: SavedConfiguration = {
      id: currentConfigurationId ?? createId('saved'),
      name: configurationName || 'Nowa konfiguracja',
      selections,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const saved = await saveConfiguration(configuration);
      setSavedConfigurations((current) => upsertLocalConfiguration(current, saved));
      setCurrentConfigurationId(saved.id);
      setStatusMessage(`Konfiguracja '${saved.name}' zostala zapisana.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Nie udalo sie zapisac konfiguracji.');
    }
  }

  async function handleDeleteConfiguration(id: string) {
    try {
      await removeConfiguration(id);
      setSavedConfigurations((current) => current.filter((item) => item.id !== id));
      if (currentConfigurationId === id) {
        setCurrentConfigurationId(null);
        setConfigurationName('Scenariusz roboczy');
      }
      setStatusMessage('Konfiguracja zostala usunieta.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Nie udalo sie usunac konfiguracji.');
    }
  }

  async function handleDuplicateConfiguration(configuration: SavedConfiguration) {
    const now = new Date().toISOString();
    const copy: SavedConfiguration = {
      ...configuration,
      id: createId('saved'),
      name: `${configuration.name} kopia`,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await saveConfiguration(copy);
    setSavedConfigurations((current) => upsertLocalConfiguration(current, saved));
    setStatusMessage(`Skopiowano konfiguracje '${configuration.name}'.`);
  }

  async function handleExport(kind: 'pdf' | 'xlsx') {
    try {
      await downloadExport(kind, {
        configurationName,
        generatedAt: new Date().toISOString(),
        selections,
        result: calculation,
        issues: liveIssues,
      });
      setStatusMessage(`Eksport ${kind.toUpperCase()} zostal wygenerowany.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Eksport nie udal sie.');
    }
  }

  function handleAddOptionGroup() {
    if (!referenceData) {
      return;
    }

    const nextIndex = referenceData.optionGroups.length + 1;
    const groupCode = `nowa-zaleznosc-${nextIndex}`;

    setReferenceData((current) =>
      current
        ? {
            ...current,
            optionGroups: [
              ...current.optionGroups,
              {
                id: createId('group'),
                code: groupCode,
                label: `Nowa zaleznosc ${nextIndex}`,
                type: 'single-select',
                isVisibleInConfigurator: true,
              },
            ],
            optionValues: [
              ...current.optionValues,
              {
                id: createId('option'),
                groupCode,
                value: 'Wartosc bazowa',
                label: 'Wartosc bazowa',
                isActive: true,
              },
            ],
          }
        : current,
    );

    setStatusMessage(`Dodano nowa grupe zaleznosci '${groupCode}'.`);
  }

  function handleUpdateOptionGroup(
    groupId: string,
    field: 'code' | 'label' | 'type' | 'isVisibleInConfigurator',
    value: string | boolean,
  ) {
    if (!referenceData) {
      return;
    }

    const currentGroup = referenceData.optionGroups.find((group) => group.id === groupId);
    if (!currentGroup) {
      return;
    }

    if (field === 'code') {
      const nextCode = String(value).trim();
      if (!nextCode || nextCode === currentGroup.code) {
        return;
      }

      if (referenceData.optionGroups.some((group) => group.code === nextCode && group.id !== groupId)) {
        setStatusMessage(`Kod grupy '${nextCode}' juz istnieje. Wybierz inny kod.`);
        return;
      }

      setReferenceData((current) =>
        current
          ? {
              ...current,
              optionGroups: current.optionGroups.map((group) =>
                group.id === groupId ? { ...group, code: nextCode } : group,
              ),
              optionValues: current.optionValues.map((option) =>
                option.groupCode === currentGroup.code ? { ...option, groupCode: nextCode } : option,
              ),
            }
          : current,
      );
      setRules((current) =>
        current.map((rule) => ({
          ...rule,
          categoryCode: rule.categoryCode === currentGroup.code ? nextCode : rule.categoryCode,
          conditions: rule.conditions.map((condition) =>
            condition.field === currentGroup.code ? { ...condition, field: nextCode } : condition,
          ),
        })),
      );
      setSelections((current) => renameSelectionKey(current, currentGroup.code, nextCode));
      setSavedConfigurations((current) =>
        current.map((configuration) => ({
          ...configuration,
          selections: renameSelectionKey(configuration.selections, currentGroup.code, nextCode),
        })),
      );
      setStatusMessage(`Zmieniono kod grupy '${currentGroup.code}' na '${nextCode}'.`);
      return;
    }

    setReferenceData((current) =>
      current
        ? {
            ...current,
            optionGroups: current.optionGroups.map((group) =>
              group.id === groupId ? { ...group, [field]: value } : group,
            ),
          }
        : current,
    );
    setStatusMessage(`Zaktualizowano grupe '${currentGroup.label}'.`);
  }

  function handleDeleteOptionGroup(groupId: string) {
    if (!referenceData) {
      return;
    }

    const currentGroup = referenceData.optionGroups.find((group) => group.id === groupId);
    if (!currentGroup) {
      return;
    }

    setReferenceData((current) =>
      current
        ? {
            ...current,
            optionGroups: current.optionGroups.filter((group) => group.id !== groupId),
            optionValues: current.optionValues.filter((option) => option.groupCode !== currentGroup.code),
          }
        : current,
    );
    setRules((current) =>
      current.map((rule) => ({
        ...rule,
        categoryCode: rule.categoryCode === currentGroup.code ? 'niestandardowa' : rule.categoryCode,
        conditions: rule.conditions.filter((condition) => condition.field !== currentGroup.code),
      })),
    );
    setSelections((current) => omitSelectionKey(current, currentGroup.code));
    setSavedConfigurations((current) =>
      current.map((configuration) => ({
        ...configuration,
        selections: omitSelectionKey(configuration.selections, currentGroup.code),
      })),
    );
    setStatusMessage(`Usunieto grupe '${currentGroup.label}' wraz z jej opcjami i warunkami reguly.`);
  }

  function handleDeleteCableType(cableId: string) {
    if (!referenceData) {
      return;
    }

    const currentCable = referenceData.cableTypes.find((cable) => cable.id === cableId);
    if (!currentCable) {
      return;
    }

    const affectedRules = rules.filter((rule) => rule.cableTypeCode === currentCable.code).length;

    setReferenceData((current) =>
      current
        ? {
            ...current,
            cableTypes: current.cableTypes.filter((cable) => cable.id !== cableId),
          }
        : current,
    );
    setRules((current) => clearCableTypeFromRules(current, currentCable.code));
    setStatusMessage(
      affectedRules > 0
        ? `Usunieto typ kabla '${currentCable.code}'. Wyczyszczono ${affectedRules} powiazanych regul.`
        : `Usunieto typ kabla '${currentCable.code}'.`,
    );
  }

  function handleDeleteIndexMapping(mappingId: string) {
    if (!referenceData) {
      return;
    }

    const currentMapping = referenceData.indexMappings.find((mapping) => mapping.id === mappingId);
    if (!currentMapping) {
      return;
    }

    setReferenceData((current) =>
      current
        ? {
            ...current,
            indexMappings: current.indexMappings.filter((mapping) => mapping.id !== mappingId),
          }
        : current,
    );
    setStatusMessage(`Usunieto mapowanie index '${currentMapping.indexCode}' dla wariantu '${currentMapping.variantCode}'.`);
  }

  if (loading || !referenceData) {
    return (
      <div className="app-shell loading-shell">
        <div className="loading-card">
          <h1>Generator wiazki kablowej</h1>
          <p>Trwa uruchamianie aplikacji i ladowanie danych.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Wiazka kablowa</p>
          <h1>Generator wiazki kablowej</h1>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" onClick={() => void loadBootstrap()}>Odswiez</button>
          <button className="primary-button" onClick={() => void handleSaveState()} disabled={saving}>{saving ? 'Zapisywanie...' : 'Zapisz teraz'}</button>
        </div>
      </header>

      <section className="hero-strip">
        <div><p className="hero-label">Status</p><strong>{statusMessage || 'Brak nowych komunikatow.'}</strong></div>
        <div><p className="hero-label">Zapis danych</p><strong>{formatSaveIndicator(saveIndicator)}</strong></div>
        <div><p className="hero-label">Aktywne warianty</p><strong>{referenceData.variants.filter((variant) => variant.isActive).length}</strong></div>
        <div><p className="hero-label">Reguly</p><strong>{rules.length}</strong></div>
        <div><p className="hero-label">Problemy danych</p><strong>{liveIssues.length}</strong></div>
      </section>

      <nav className="tabbar">
        {[
          ['configurator', 'Konfigurator'],
          ['results', 'Wynik'],
          ['rules', 'Reguly'],
          ['data', 'Dane bazowe'],
        ].map(([key, label]) => (
          <button key={key} className={activeTab === key ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab(key as typeof activeTab)}>{label}</button>
        ))}
      </nav>

      <main className="content-grid">
        <section className="main-panel">
          {activeTab === 'configurator' && <ConfiguratorTab visibleGroups={visibleGroups} optionValuesByGroup={optionValuesByGroup} selections={selections} onSelectionChange={setSelections} configurationName={configurationName} onConfigurationNameChange={setConfigurationName} savedConfigurations={savedConfigurations} currentConfigurationId={currentConfigurationId} onLoadConfiguration={(configuration) => { setSelections(ensureSelections(referenceData, configuration.selections)); setConfigurationName(configuration.name); setCurrentConfigurationId(configuration.id); setStatusMessage(`Wczytano konfiguracje '${configuration.name}'.`); }} onSaveConfiguration={() => void handleSaveConfiguration()} onDuplicateConfiguration={(configuration) => void handleDuplicateConfiguration(configuration)} onDeleteConfiguration={(id) => void handleDeleteConfiguration(id)} calculation={calculation} />}
          {activeTab === 'results' && <ResultsTab configurationName={configurationName} calculation={calculation} selections={selections} issues={liveIssues} onExport={handleExport} />}
          {activeTab === 'rules' && <RulesTab rules={rules} filteredRules={filteredRules} selectedRule={selectedRule} ruleFilter={ruleFilter} onRuleFilterChange={setRuleFilter} onSelectRule={setSelectedRuleId} optionGroups={optionGroups} optionValuesByGroup={optionValuesByGroup} cableTypes={referenceData.cableTypes} lengthDrivers={referenceData.lengthDrivers} indexCodes={indexCodes} issues={ruleContextIssues} onRulesChange={setRules} preview={selectedRulePreview} />}
          {activeTab === 'data' && <DataTab referenceData={referenceData} optionValuesByGroup={optionValuesByGroup} indexFilterVariant={indexFilterVariant} onIndexFilterVariantChange={setIndexFilterVariant} onReferenceDataChange={setReferenceData} onAddOptionGroup={handleAddOptionGroup} onUpdateOptionGroup={handleUpdateOptionGroup} onDeleteOptionGroup={handleDeleteOptionGroup} onDeleteCableType={handleDeleteCableType} onDeleteIndexMapping={handleDeleteIndexMapping} />}
        </section>
        <aside className="side-panel"><IssuesPanel issues={liveIssues} /></aside>
      </main>
    </div>
  );
}

function areSelectionsEqual(left: Record<string, string>, right: Record<string, string>) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([key, value]) => right[key] === value);
}

function serializeAppState(referenceData: ReferenceData, rules: RuleRecord[]) {
  return JSON.stringify({ referenceData, rules });
}

function readLocalDraft() {
  try {
    return window.localStorage.getItem(LOCAL_DRAFT_KEY);
  } catch {
    return null;
  }
}

function writeLocalDraft(snapshot: string) {
  try {
    window.localStorage.setItem(LOCAL_DRAFT_KEY, snapshot);
  } catch {
    // Ignore browser storage errors and keep server-side autosave active.
  }
}

function clearLocalDraft() {
  try {
    window.localStorage.removeItem(LOCAL_DRAFT_KEY);
  } catch {
    // Ignore browser storage errors and keep server-side autosave active.
  }
}

function parseDraftState(snapshot: string) {
  try {
    return JSON.parse(snapshot) as { referenceData: ReferenceData; rules: RuleRecord[] };
  } catch {
    clearLocalDraft();
    return null;
  }
}

function buildSaveStatusMessage(mode: SaveMode, issues: DataIssue[]) {
  const baseMessage = mode === 'auto' ? 'Zmiany danych zostaly zapisane automatycznie.' : 'Stan danych i reguly zostaly zapisane.';
  if (issues.length === 0) {
    return baseMessage;
  }

  return `${baseMessage} Walidacja: ${formatValidationSummary(issues)}.`;
}

function buildFailedSaveStatusMessage(issues: DataIssue[]) {
  if (issues.length === 0) {
    return 'Nie udalo sie zapisac zmian danych.';
  }
  return `Zapis zablokowany przez walidacje: ${formatValidationSummary(issues)}. Popraw bledy krytyczne i sprobuj ponownie.`;
}

function formatValidationSummary(issues: DataIssue[]) {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  return `${errorCount} bledow, ${warningCount} ostrzezen`;
}

function formatSaveIndicator(indicator: SaveIndicator) {
  switch (indicator) {
    case 'pending':
      return 'Oczekuje na zapis';
    case 'saving':
      return 'Zapisywanie';
    case 'saved':
      return 'Zapisano';
    case 'error':
      return 'Blad zapisu';
    default:
      return 'Gotowy';
  }
}


