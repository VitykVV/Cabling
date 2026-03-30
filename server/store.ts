import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  AppStatePayload,
  BootstrapPayload,
  ReferenceData,
  RuleRecord,
  SavedConfiguration,
  SeedFile,
  SeedMetadata,
} from '../src/shared/types.ts';
import { validateState } from '../src/shared/validation.ts';
import { stripBom } from '../src/shared/utils.ts';

const seedPath = path.resolve(process.cwd(), 'data', 'seed.json');
const defaultDbPath = path.resolve(process.cwd(), 'data', 'app.db');
const dbPath = path.resolve(process.env.APP_DB_PATH ?? defaultDbPath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS configurations (
    id TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

ensureSeeded();

export function getBootstrapPayload(): BootstrapPayload {
  const referenceData = getDocument<ReferenceData>('referenceData');
  const rules = getDocument<RuleRecord[]>('rules');
  const metadata = getDocument<SeedMetadata>('metadata');
  const savedConfigurations = getConfigurations();
  const validationIssues = validateState(referenceData, rules);

  return {
    referenceData,
    rules,
    savedConfigurations,
    metadata,
    validationIssues,
  };
}

export function saveState(payload: AppStatePayload) {
  const validationIssues = validateState(payload.referenceData, payload.rules);
  const hasBlockingErrors = validationIssues.some((issue) => issue.severity === 'error');

  if (hasBlockingErrors) {
    return {
      ok: false,
      validationIssues,
    };
  }

  setDocument('referenceData', payload.referenceData);
  setDocument('rules', payload.rules);

  return {
    ok: true,
    validationIssues,
  };
}

export function upsertConfiguration(configuration: SavedConfiguration) {
  const statement = db.prepare('INSERT INTO configurations (id, value) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value');
  statement.run(configuration.id, JSON.stringify(configuration));
  return configuration;
}

export function deleteConfiguration(id: string) {
  db.prepare('DELETE FROM configurations WHERE id = ?').run(id);
}

function ensureSeeded() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM documents').get() as { count?: number } | undefined;
  const count = Number(row?.count ?? 0);
  if (count > 0) {
    return;
  }

  const seed = readJsonFile<SeedFile>(seedPath);
  setDocument('referenceData', seed.referenceData);
  setDocument('rules', seed.rules);
  setDocument('metadata', seed.metadata);

  const clearConfigurations = db.prepare('DELETE FROM configurations');
  clearConfigurations.run();
  const insertConfiguration = db.prepare('INSERT INTO configurations (id, value) VALUES (?, ?)');
  for (const configuration of seed.savedConfigurations) {
    insertConfiguration.run(configuration.id, JSON.stringify(configuration));
  }
}

function getDocument<T>(key: string): T {
  const row = db.prepare('SELECT value FROM documents WHERE key = ?').get(key) as { value?: string } | undefined;
  if (!row?.value) {
    throw new Error(`Document '${key}' is missing in SQLite store.`);
  }
  return JSON.parse(row.value) as T;
}

function setDocument(key: string, value: unknown) {
  const statement = db.prepare('INSERT INTO documents (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  statement.run(key, JSON.stringify(value));
}

function getConfigurations() {
  const rows = db.prepare('SELECT value FROM configurations ORDER BY id').all() as Array<{ value: string }>;
  return rows.map((row) => JSON.parse(row.value) as SavedConfiguration);
}

function readJsonFile<T>(filePath: string): T {
  const contents = stripBom(fs.readFileSync(filePath, 'utf8'));
  return JSON.parse(contents) as T;
}

