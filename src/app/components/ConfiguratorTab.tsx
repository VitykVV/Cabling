import type React from 'react';
import type { CalculationResult, OptionGroup, OptionValue, SavedConfiguration } from '../../shared/types.ts';
import { displayGroupLabel } from '../../shared/utils.ts';
import { meterFormatter } from '../helpers.ts';

export function ConfiguratorTab(props: {
  visibleGroups: OptionGroup[];
  optionValuesByGroup: Map<string, OptionValue[]>;
  selections: Record<string, string>;
  onSelectionChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  configurationName: string;
  onConfigurationNameChange: (value: string) => void;
  savedConfigurations: SavedConfiguration[];
  currentConfigurationId: string | null;
  onLoadConfiguration: (configuration: SavedConfiguration) => void;
  onSaveConfiguration: () => void;
  onDuplicateConfiguration: (configuration: SavedConfiguration) => void;
  onDeleteConfiguration: (id: string) => void;
  calculation: CalculationResult;
}) {
  return (
    <div className="stack-lg">
      <div className="card section-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Wejscie</p>
            <h2>Konfigurator</h2>
          </div>
          <div className="inline-actions">
            <input
              className="text-input compact"
              value={props.configurationName}
              onChange={(event) => props.onConfigurationNameChange(event.target.value)}
              placeholder="Nazwa konfiguracji"
            />
            <button className="primary-button" onClick={props.onSaveConfiguration}>
              Zapisz konfiguracje
            </button>
          </div>
        </div>

        <div className="form-grid">
          {props.visibleGroups.map((group) => {
            const options = props.optionValuesByGroup.get(group.code) ?? [];
            return (
              <label key={group.code} className="field-block">
                <span>{displayGroupLabel(group.code)}</span>
                <select
                  className="select-input"
                  value={props.selections[group.code] ?? ''}
                  onChange={(event) =>
                    props.onSelectionChange((current) => ({
                      ...current,
                      [group.code]: event.target.value,
                    }))
                  }
                >
                  {options.map((option) => (
                    <option key={option.id} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </div>

      <div className="card section-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Zapisane</p>
            <h2>Zapisane konfiguracje</h2>
          </div>
        </div>
        <div className="saved-config-list">
          {props.savedConfigurations.map((configuration) => (
            <div key={configuration.id} className={props.currentConfigurationId === configuration.id ? 'saved-config active' : 'saved-config'}>
              <div>
                <strong>{configuration.name}</strong>
                <p>{Object.values(configuration.selections).slice(0, 3).join(' | ')}</p>
              </div>
              <div className="inline-actions">
                <button className="ghost-button" onClick={() => props.onLoadConfiguration(configuration)}>
                  Wczytaj
                </button>
                <button className="ghost-button" onClick={() => props.onDuplicateConfiguration(configuration)}>
                  Duplikuj
                </button>
                <button className="ghost-button danger" onClick={() => props.onDeleteConfiguration(configuration.id)}>
                  Usun
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card summary-card-grid">
        {props.calculation.summary.map((entry) => (
          <div key={entry.cableType} className="summary-pill">
            <span>{entry.cableType}</span>
            <strong>{meterFormatter.format(entry.totalM)} m</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
