import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const workspaceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('saveState blocks persistence when validation reports critical errors', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cabling-store-'));

  try {
    const dbPath = path.join(tempDir, 'app.db');
    const script = [
      "const { getBootstrapPayload, saveState } = await import('./server/store.ts');",
      'const payload = getBootstrapPayload();',
      'const duplicate = { ...payload.referenceData.indexMappings[0], id: "duplicate-index" };',
      'payload.referenceData.indexMappings.push(duplicate);',
      "payload.referenceData.cableTypes.push({ id: 'test-cable', code: 'test-kabel', label: 'Test kabel', isActive: true });",
      'const result = saveState({ referenceData: payload.referenceData, rules: payload.rules });',
      'const updated = getBootstrapPayload();',
      "console.log(JSON.stringify({ ok: result.ok, errorCount: result.validationIssues.filter((issue) => issue.severity === 'error').length, hasCable: updated.referenceData.cableTypes.some((cable) => cable.code === 'test-kabel') }));",
    ].join('\n');

    const output = execFileSync(process.execPath, ['--experimental-strip-types', '-e', script], {
      cwd: workspaceDir,
      env: {
        ...process.env,
        APP_DB_PATH: dbPath,
      },
      encoding: 'utf8',
    });

    const lastLine = output.trim().split(/\r?\n/).at(-1) ?? '';
    const result = JSON.parse(lastLine) as { ok: boolean; errorCount: number; hasCable: boolean };

    assert.equal(result.ok, false);
    assert.equal(result.hasCable, false);
    assert.equal(result.errorCount, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('saveState persists reference data when validation has only warnings', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cabling-store-'));

  try {
    const dbPath = path.join(tempDir, 'app.db');
    const script = [
      "const { getBootstrapPayload, saveState } = await import('./server/store.ts');",
      'const payload = getBootstrapPayload();',
      "payload.referenceData.cableTypes.push({ id: 'test-cable', code: 'test-kabel', label: 'Test kabel', isActive: true });",
      'const result = saveState({ referenceData: payload.referenceData, rules: payload.rules });',
      'const updated = getBootstrapPayload();',
      "console.log(JSON.stringify({ ok: result.ok, errorCount: result.validationIssues.filter((issue) => issue.severity === 'error').length, warningCount: result.validationIssues.filter((issue) => issue.severity === 'warning').length, hasCable: updated.referenceData.cableTypes.some((cable) => cable.code === 'test-kabel') }));",
    ].join('\n');

    const output = execFileSync(process.execPath, ['--experimental-strip-types', '-e', script], {
      cwd: workspaceDir,
      env: {
        ...process.env,
        APP_DB_PATH: dbPath,
      },
      encoding: 'utf8',
    });

    const lastLine = output.trim().split(/\r?\n/).at(-1) ?? '';
    const result = JSON.parse(lastLine) as { ok: boolean; errorCount: number; warningCount: number; hasCable: boolean };

    assert.equal(result.ok, true);
    assert.equal(result.hasCable, true);
    assert.equal(result.errorCount, 0);
    assert.ok(result.warningCount > 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
