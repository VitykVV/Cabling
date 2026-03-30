import type React from 'react';
import type { OptionGroup, OptionValue, ReferenceData } from '../../shared/types.ts';
import { createId, displayGroupLabel } from '../../shared/utils.ts';
import { addIndexMapping, addOptionValue, updateCableType, updateDriver, updateIndexMapping, updateOptionValue, updateVariant } from '../helpers.ts';

export function DataTab(props: {
  referenceData: ReferenceData;
  optionValuesByGroup: Map<string, OptionValue[]>;
  indexFilterVariant: string;
  onIndexFilterVariantChange: (value: string) => void;
  onReferenceDataChange: React.Dispatch<React.SetStateAction<ReferenceData | null>>;
  onAddOptionGroup: () => void;
  onUpdateOptionGroup: (groupId: string, field: 'code' | 'label' | 'type' | 'isVisibleInConfigurator', value: string | boolean) => void;
  onDeleteOptionGroup: (groupId: string) => void;
  onDeleteCableType: (cableId: string) => void;
  onDeleteIndexMapping: (mappingId: string) => void;
}) {
  const visibleIndexMappings = props.referenceData.indexMappings.filter((mapping) =>
    props.indexFilterVariant === 'all' ? true : mapping.variantCode === props.indexFilterVariant,
  );

  return (
    <div className="stack-lg">
      <section className="card summary-card-grid compact-grid">
        <div className="summary-pill compact-pill"><span>Warianty</span><strong>{props.referenceData.variants.length}</strong></div>
        <div className="summary-pill compact-pill"><span>Grupy zaleznosci</span><strong>{props.referenceData.optionGroups.length}</strong></div>
        <div className="summary-pill compact-pill"><span>Wartosci opcji</span><strong>{props.referenceData.optionValues.length}</strong></div>
        <div className="summary-pill compact-pill"><span>Czynniki dlugosci</span><strong>{props.referenceData.lengthDrivers.length}</strong></div>
        <div className="summary-pill compact-pill"><span>Typy kabli</span><strong>{props.referenceData.cableTypes.length}</strong></div>
        <div className="summary-pill compact-pill"><span>Mapowania index</span><strong>{props.referenceData.indexMappings.length}</strong></div>
      </section>

      <section className="card section-card">
        <div className="section-header compact">
          <div>
            <p className="section-kicker">Zaleznosci</p>
            <h2>Grupy konfiguratora</h2>
          </div>
          <button className="primary-button" onClick={props.onAddOptionGroup}>
            Dodaj grupe zaleznosci
          </button>
        </div>
        <p className="subtle-copy">
          Zmiana kodu grupy aktualizuje warunki regul i zapisane konfiguracje. Usuniecie grupy usuwa tez jej wartosci oraz powiazane warunki w regulach.
        </p>
        <div className="table-wrap">
          <table className="data-table compact-table">
            <thead>
              <tr><th>Kod</th><th>Etykieta</th><th>Typ</th><th>W konfiguratorze</th><th>Liczba opcji</th><th>Akcje</th></tr>
            </thead>
            <tbody>
              {props.referenceData.optionGroups.map((group) => (
                <tr key={group.id}>
                  <td><input className="text-input" value={group.code} onChange={(event) => props.onUpdateOptionGroup(group.id, 'code', event.target.value)} /></td>
                  <td><input className="text-input" value={group.label} onChange={(event) => props.onUpdateOptionGroup(group.id, 'label', event.target.value)} /></td>
                  <td>
                    <select className="select-input" value={group.type} onChange={(event) => props.onUpdateOptionGroup(group.id, 'type', event.target.value)}>
                      <option value="single-select">Lista wyboru</option>
                      <option value="boolean-select">Tak lub nie</option>
                    </select>
                  </td>
                  <td><input type="checkbox" checked={group.isVisibleInConfigurator} onChange={(event) => props.onUpdateOptionGroup(group.id, 'isVisibleInConfigurator', event.target.checked)} /></td>
                  <td>{props.optionValuesByGroup.get(group.code)?.length ?? 0}</td>
                  <td><button className="ghost-button danger" onClick={() => props.onDeleteOptionGroup(group.id)}>Usun</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-header compact">
          <div>
            <p className="section-kicker">Warianty</p>
            <h2>Wymiary L/B/H</h2>
          </div>
          <button className="ghost-button" onClick={() => props.onReferenceDataChange((current) => current ? ({ ...current, variants: [...current.variants, { id: createId('variant'), code: 'BS-C-H-X', lengthMm: 0, widthMm: 0, heightMm: 0, isActive: true }] }) : current)}>
            Dodaj wariant
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Kod</th><th>L [mm]</th><th>B [mm]</th><th>H [mm]</th><th>Aktywny</th></tr>
            </thead>
            <tbody>
              {props.referenceData.variants.map((variant) => (
                <tr key={variant.id}>
                  <td><input className="text-input" value={variant.code} onChange={(event) => updateVariant(props.onReferenceDataChange, variant.id, 'code', event.target.value)} /></td>
                  <td><input className="text-input" type="number" value={variant.lengthMm} onChange={(event) => updateVariant(props.onReferenceDataChange, variant.id, 'lengthMm', Number(event.target.value))} /></td>
                  <td><input className="text-input" type="number" value={variant.widthMm} onChange={(event) => updateVariant(props.onReferenceDataChange, variant.id, 'widthMm', Number(event.target.value))} /></td>
                  <td><input className="text-input" type="number" value={variant.heightMm} onChange={(event) => updateVariant(props.onReferenceDataChange, variant.id, 'heightMm', Number(event.target.value))} /></td>
                  <td><input type="checkbox" checked={variant.isActive} onChange={(event) => updateVariant(props.onReferenceDataChange, variant.id, 'isActive', event.target.checked)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-header compact">
          <div><p className="section-kicker">Wzory</p><h2>Czynniki dlugosci</h2></div>
          <button className="ghost-button" onClick={() => props.onReferenceDataChange((current) => current ? ({ ...current, lengthDrivers: [...current.lengthDrivers, { id: createId('driver'), code: 'nowyCzynnik', label: 'Nowy czynnik', unit: 'mm', expression: '0', isActive: true }] }) : current)}>
            Dodaj czynnik
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Kod</th><th>Nazwa</th><th>Wyrazenie</th><th>Aktywny</th></tr>
            </thead>
            <tbody>
              {props.referenceData.lengthDrivers.map((driver) => (
                <tr key={driver.id}>
                  <td><input className="text-input" value={driver.code} onChange={(event) => updateDriver(props.onReferenceDataChange, driver.id, 'code', event.target.value)} /></td>
                  <td><input className="text-input" value={driver.label} onChange={(event) => updateDriver(props.onReferenceDataChange, driver.id, 'label', event.target.value)} /></td>
                  <td><input className="text-input" value={driver.expression} onChange={(event) => updateDriver(props.onReferenceDataChange, driver.id, 'expression', event.target.value)} /></td>
                  <td><input type="checkbox" checked={driver.isActive} onChange={(event) => updateDriver(props.onReferenceDataChange, driver.id, 'isActive', event.target.checked)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-header compact">
          <div><p className="section-kicker">Typy kabli</p><h2>Slownik kabli</h2></div>
          <button className="ghost-button" onClick={() => props.onReferenceDataChange((current) => current ? ({ ...current, cableTypes: [...current.cableTypes, { id: createId('cable'), code: 'nowy-kabel', label: 'Nowy kabel', isActive: true }] }) : current)}>
            Dodaj typ kabla
          </button>
        </div>
        <p className="subtle-copy">
          Usuniecie typu kabla wyczysci go tez w powiazanych regulach, zeby nie zostawic blednych odwolan.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Kod</th><th>Nazwa</th><th>Aktywny</th><th>Akcje</th></tr>
            </thead>
            <tbody>
              {props.referenceData.cableTypes.map((cable) => (
                <tr key={cable.id}>
                  <td><input className="text-input" value={cable.code} onChange={(event) => updateCableType(props.onReferenceDataChange, cable.id, 'code', event.target.value)} /></td>
                  <td><input className="text-input" value={cable.label} onChange={(event) => updateCableType(props.onReferenceDataChange, cable.id, 'label', event.target.value)} /></td>
                  <td><input type="checkbox" checked={cable.isActive} onChange={(event) => updateCableType(props.onReferenceDataChange, cable.id, 'isActive', event.target.checked)} /></td>
                  <td><button className="ghost-button danger" onClick={() => props.onDeleteCableType(cable.id)}>Usun</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-header compact">
          <div><p className="section-kicker">Opcje</p><h2>Slowniki konfiguratora</h2></div>
        </div>
        <div className="stack-lg">
          {props.referenceData.optionGroups.map((group) => (
            <div key={group.id} className="nested-card">
              <div className="section-header compact slim">
                <div><p className="section-kicker">{formatOptionGroupType(group)}</p><h3>{displayGroupLabel(group.code)}</h3></div>
                <button className="ghost-button" onClick={() => addOptionValue(props.onReferenceDataChange, group.code)}>Dodaj wartosc</button>
              </div>
              <div className="table-wrap">
                <table className="data-table compact-table">
                  <thead>
                    <tr><th>Wartosc</th><th>Etykieta</th><th>Aktywna</th></tr>
                  </thead>
                  <tbody>
                    {(props.optionValuesByGroup.get(group.code) ?? []).map((value) => (
                      <tr key={value.id}>
                        <td><input className="text-input" value={value.value} onChange={(event) => updateOptionValue(props.onReferenceDataChange, value.id, 'value', event.target.value)} /></td>
                        <td><input className="text-input" value={value.label} onChange={(event) => updateOptionValue(props.onReferenceDataChange, value.id, 'label', event.target.value)} /></td>
                        <td><input type="checkbox" checked={value.isActive} onChange={(event) => updateOptionValue(props.onReferenceDataChange, value.id, 'isActive', event.target.checked)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card section-card">
        <div className="section-header compact">
          <div><p className="section-kicker">Index</p><h2>Mapowanie index {'->'} mm</h2></div>
          <div className="inline-actions">
            <select className="select-input compact" value={props.indexFilterVariant} onChange={(event) => props.onIndexFilterVariantChange(event.target.value)}>
              <option value="all">Wszystkie warianty</option>
              {props.referenceData.variants.map((variant) => <option key={variant.id} value={variant.code}>{variant.code}</option>)}
            </select>
            <button className="ghost-button" onClick={() => addIndexMapping(props.onReferenceDataChange, props.referenceData.variants[0]?.code ?? 'BS-C-H-1')}>Dodaj mapowanie</button>
          </div>
        </div>
        <div className="table-wrap tall-table">
          <table className="data-table compact-table">
            <thead>
              <tr><th>Wariant</th><th>Index</th><th>Odleglosc [mm]</th><th>Akcje</th></tr>
            </thead>
            <tbody>
              {visibleIndexMappings.map((mapping) => (
                <tr key={mapping.id}>
                  <td><input className="text-input" value={mapping.variantCode} onChange={(event) => updateIndexMapping(props.onReferenceDataChange, mapping.id, 'variantCode', event.target.value)} /></td>
                  <td><input className="text-input" value={mapping.indexCode} onChange={(event) => updateIndexMapping(props.onReferenceDataChange, mapping.id, 'indexCode', event.target.value)} /></td>
                  <td><input className="text-input" type="number" value={mapping.distanceMm} onChange={(event) => updateIndexMapping(props.onReferenceDataChange, mapping.id, 'distanceMm', Number(event.target.value))} /></td>
                  <td><button className="ghost-button danger" onClick={() => props.onDeleteIndexMapping(mapping.id)}>Usun</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatOptionGroupType(group: OptionGroup) {
  return group.type === 'single-select' ? 'Lista wyboru' : 'Tak lub nie';
}