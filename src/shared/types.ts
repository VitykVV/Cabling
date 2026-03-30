export type Severity = 'error' | 'warning';

export interface DataIssue {
  severity: Severity;
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface Variant {
  id: string;
  code: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  isActive: boolean;
}

export interface IndexMapping {
  id: string;
  variantCode: string;
  indexCode: string;
  distanceMm: number;
}

export interface LengthDriver {
  id: string;
  code: string;
  label: string;
  unit: 'mm';
  expression: string;
  isActive: boolean;
  notes?: string;
}

export interface OptionGroup {
  id: string;
  code: string;
  label: string;
  type: 'single-select' | 'boolean-select';
  isVisibleInConfigurator: boolean;
}

export interface OptionValue {
  id: string;
  groupCode: string;
  value: string;
  label: string;
  isActive: boolean;
}

export interface CableType {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
}

export interface ReferenceData {
  variants: Variant[];
  indexMappings: IndexMapping[];
  lengthDrivers: LengthDriver[];
  optionGroups: OptionGroup[];
  optionValues: OptionValue[];
  cableTypes: CableType[];
}

export interface RuleCondition {
  id: string;
  field: string;
  operator: 'in';
  values: string[];
}

export interface IndexDistanceComponent {
  id: string;
  label: string;
  kind: 'index-distance';
  indexCode: string;
}

export interface DriverComponent {
  id: string;
  label: string;
  kind: 'driver';
  driverCode: string;
}

export interface ConstantComponent {
  id: string;
  label: string;
  kind: 'constant';
  valueMm: number;
}

export type RuleLengthComponent = IndexDistanceComponent | DriverComponent | ConstantComponent;

export interface RuleRecord {
  id: string;
  element: string;
  categoryCode: string;
  description: string;
  showInReport: boolean;
  conditions: RuleCondition[];
  lengthComponents: RuleLengthComponent[];
  cableTypeCode: string | null;
  notes: string;
  isActive: boolean;
}

export interface SavedConfiguration {
  id: string;
  name: string;
  selections: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedComponent {
  id: string;
  label: string;
  kind: RuleLengthComponent['kind'];
  sourceCode: string;
  valueMm: number | null;
  details: string;
}

export interface CalculationRow {
  lp: number;
  element: string;
  wlk: string;
  cableType: string | null;
  indexCode: string | null;
  distanceFromPanelMm: number | null;
  resolvedComponents: ResolvedComponent[];
  sumMm: number | null;
  sumM: number | null;
  activatedBy: string[];
  explanation: string;
  warnings: string[];
  showInReport: boolean;
}

export interface SummaryEntry {
  cableType: string;
  totalMm: number;
  totalM: number;
}

export interface CalculationResult {
  rows: CalculationRow[];
  summary: SummaryEntry[];
  issues: DataIssue[];
}

export interface ReferenceScenario {
  selections: Record<string, string>;
  expectedSummary: Array<{ cableType: string; totalM: number }>;
  expectedRows: Array<{ lp: number; element: string; wlk: string; cableType: string; sumM: number }>;
}

export interface SeedMetadata {
  referenceScenario: ReferenceScenario;
  issues: DataIssue[];
}

export interface SeedFile {
  generatedAt: string;
  sourceFile: string;
  referenceData: ReferenceData;
  rules: RuleRecord[];
  savedConfigurations: SavedConfiguration[];
  metadata: SeedMetadata;
}

export interface BootstrapPayload {
  referenceData: ReferenceData;
  rules: RuleRecord[];
  savedConfigurations: SavedConfiguration[];
  metadata: SeedMetadata;
  validationIssues: DataIssue[];
}

export interface AppStatePayload {
  referenceData: ReferenceData;
  rules: RuleRecord[];
}

export interface SaveStateResult {
  ok: boolean;
  validationIssues: DataIssue[];
}

export interface DocumentExportPayload {
  configurationName: string;
  generatedAt: string;
  selections: Record<string, string>;
  result: CalculationResult;
  issues: DataIssue[];
}
