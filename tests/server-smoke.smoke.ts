import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { calculate } from '../src/shared/engine.ts';
import type { BootstrapPayload, DocumentExportPayload } from '../src/shared/types.ts';

const workspaceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distIndexPath = path.join(workspaceDir, 'dist', 'index.html');

test('server smoke test serves health, bootstrap, static app and xlsx export', { timeout: 30000 }, async (t) => {
  assert.equal(
    fs.existsSync(distIndexPath),
    true,
    'Build output is missing. Run `npm run build` before `npm run test:smoke`.',
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cabling-smoke-'));
  const dbPath = path.join(tempDir, 'app.db');
  const port = 4700 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const logs: string[] = [];

  const child = spawn(process.execPath, ['--experimental-strip-types', 'server/index.ts'], {
    cwd: workspaceDir,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      APP_DB_PATH: dbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));
  child.on('error', (error) => logs.push(String(error)));

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([
        once(child, 'exit'),
        delay(5000),
      ]);
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await waitForServer(`${baseUrl}/health`, child, logs);

  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json() as { ok: boolean; service: string };
  assert.equal(health.ok, true);
  assert.equal(health.service, 'generator-wiazki-kablowej');

  const bootstrapResponse = await fetch(`${baseUrl}/api/bootstrap`);
  assert.equal(bootstrapResponse.status, 200);
  const bootstrap = await bootstrapResponse.json() as BootstrapPayload;
  assert.ok(bootstrap.referenceData.variants.length > 0);
  assert.ok(bootstrap.rules.length > 0);

  const indexResponse = await fetch(baseUrl);
  assert.equal(indexResponse.status, 200);
  assert.match(indexResponse.headers.get('content-type') ?? '', /text\/html/);
  const html = await indexResponse.text();
  assert.match(html, /<div id="root"><\/div>/);

  const calculation = calculate(
    bootstrap.referenceData,
    bootstrap.rules,
    bootstrap.metadata.referenceScenario.selections,
  );

  const exportPayload: DocumentExportPayload = {
    configurationName: 'Smoke test',
    generatedAt: new Date().toISOString(),
    selections: bootstrap.metadata.referenceScenario.selections,
    result: calculation,
    issues: [...bootstrap.validationIssues, ...calculation.issues],
  };

  const exportResponse = await fetch(`${baseUrl}/api/export/xlsx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(exportPayload),
  });

  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get('content-type') ?? '', /spreadsheetml/);
  assert.match(exportResponse.headers.get('content-disposition') ?? '', /\.xlsx/);
  const buffer = await exportResponse.arrayBuffer();
  assert.ok(buffer.byteLength > 0);
});

async function waitForServer(url: string, child: ReturnType<typeof spawn>, logs: string[]) {
  const timeoutAt = Date.now() + 20000;
  let lastError: unknown = null;

  while (Date.now() < timeoutAt) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before becoming ready. Logs:\n${logs.join('')}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status: ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  const details = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error');
  throw new Error(`Server did not become ready in time: ${details}. Logs:\n${logs.join('')}`);
}
