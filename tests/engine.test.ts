import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/shared/engine.ts';
import { stripBom } from '../src/shared/utils.ts';
import type { SeedFile } from '../src/shared/types.ts';

const seed = JSON.parse(
  stripBom(fs.readFileSync(path.resolve(process.cwd(), 'data', 'seed.json'), 'utf8')),
) as SeedFile;

test('matches the reference summary from Excel for BS-C-H-2', () => {
  const result = calculate(seed.referenceData, seed.rules, seed.metadata.referenceScenario.selections);
  const summaryMap = new Map(result.summary.map((entry) => [entry.cableType, entry.totalM]));

  for (const expected of seed.metadata.referenceScenario.expectedSummary) {
    assert.ok(summaryMap.has(expected.cableType));
    assert.ok(Math.abs((summaryMap.get(expected.cableType) ?? 0) - expected.totalM) < 0.0001);
  }
});

test('returns warnings and null sums when variant index mappings are missing', () => {
  const selections = {
    ...seed.metadata.referenceScenario.selections,
    wlk: 'BS-C-H-6',
  };
  const result = calculate(seed.referenceData, seed.rules, selections);

  assert.equal(result.issues.some((issue) => issue.code === 'missing-variant-index'), true);
  assert.equal(result.rows.some((row) => row.sumMm === null), true);
});

test('resolves derived drivers for width and height based formulas', () => {
  const rule = seed.rules.find((item) => item.element === 'Czujnik temperatury wyciąg');
  assert.ok(rule);
  const result = calculate(seed.referenceData, [rule], seed.metadata.referenceScenario.selections);
  assert.ok(result.rows[0]);
  assert.ok(Math.abs((result.rows[0].sumM ?? 0) - 2.3075) < 0.0001);
});
