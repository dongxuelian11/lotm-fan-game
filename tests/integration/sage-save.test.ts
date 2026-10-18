import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { dose, prepared } from '../domain/sage-directed-helper.js';
import { fileEvidence, inspectSources, parseArguments, verifySageBoundaries } from '../../scripts/play/sage-save.mjs';

const roots: string[] = [];
const runtime = { SqliteSliceStore, assertValidSliceState, projectSliceState, migrateSliceState };
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'lotm-sage-save-verifier-')); roots.push(root);
  const source = join(root, 'source'), output = join(root, 'output'); mkdirSync(source); mkdirSync(output);
  return { root, source, output };
}
function index(source: string, value: unknown) { writeFileSync(join(source, 'boundaries.index.json'), JSON.stringify(value)); }
function options(source: string, output: string, count: number) {
  return parseArguments(['--source-directory', source, '--output-directory', output, '--expected-boundaries', String(count)]);
}
afterEach(() => {
  vi.restoreAllMocks();
  // These directories were created by this test, and can never contain a player save.
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Sage bounded save-verification harness', () => {
  it('keeps the immutable default and accepts exact legacy or named ranges', () => {
    expect.assertions(6);
    expect(parseArguments([])).toMatchObject({ sourceDirectory: 'tests/fixtures/sage-v01780', start: 0, key: 'boundaries' });
    expect(parseArguments(['directed', 'retry', '2', '3'])).toMatchObject({ key: 'directed', tag: 'retry', start: 2, count: 3 });
    expect(parseArguments(['--source-directory', '/tmp/source', '--expected-boundaries', '54', '--start', '0', '--count', '54']))
      .toMatchObject({ sourceDirectory: '/tmp/source', expectedBoundaries: 54, start: 0, count: 54 });
    expect(() => parseArguments(['--count', '0'])).toThrow('Count');
    expect(() => parseArguments(['boundaries', '--key', 'directed'])).toThrow('Do not mix');
    expect(() => parseArguments(['--tag', '../player-save'])).toThrow('Tag');
  });

  it('rejects empty, incomplete, count-mismatched and escaping input sets instead of a vacuous pass', () => {
    expect.assertions(6);
    const { root, source, output } = setup();
    index(source, {});
    expect(() => inspectSources(options(source, output, 1))).toThrow('must not be empty');
    writeFileSync(join(source, 'one.json'), '{}'); index(source, { one: 'one.json' });
    expect(() => inspectSources(options(source, output, 2))).toThrow('Unexpected source boundary count');
    expect(() => inspectSources({ ...options(source, output, 1), start: 1, count: 1 })).toThrow('range');
    expect(() => inspectSources({ ...options(source, output, 1), count: 2 })).toThrow('range');
    writeFileSync(join(root, 'outside.json'), '{}'); index(source, { escape: '../outside.json' });
    expect(() => inspectSources(options(source, output, 1))).toThrow('escapes source');
    expect(readdirSync(output)).toHaveLength(0);
  });

  it('verifies real Sage success/failure intents with exact named versus unique counts and unchanged source bytes', async () => {
    const { source, output } = setup(); vi.spyOn(console, 'log').mockImplementation(() => {});
    const beforeFailure = prepared('FAILURE'), beforeSuccess = prepared('SUCCESS');
    const lastIntent = { type: 'SAGE', command: dose } as const;
    const failure = { beforeLast: beforeFailure, lastIntent, final: applySliceIntent(beforeFailure, lastIntent) };
    const success = { beforeLast: beforeSuccess, lastIntent, final: applySliceIntent(beforeSuccess, lastIntent) };
    expect(failure.final.progression.sequence).toBe(3); expect(success.final.progression.sequence).toBe(2);
    const files = [join(source, 'failure.json'), join(source, 'success.json')];
    writeFileSync(files[0]!, JSON.stringify(failure, null, 1));
    writeFileSync(files[1]!, JSON.stringify(success, null, 1));
    index(source, { failure: 'failure.json', success: 'success.json', sameSuccess: 'success.json' });
    // The verifier fingerprints provenance but must never parse a large natural replay.
    writeFileSync(join(source, 'natural.json'), 'fingerprint only; deliberately not parseable JSON');
    const original = files.map(path => readFileSync(path));
    const result = await verifySageBoundaries(options(source, output, 3), runtime);
    expect(result).toMatchObject({ passed: true, sourceBoundaryCount: 3, expectedBoundaryCount: 3, requestedBoundaryCount: 3,
      boundaries: 3, fullIndexVerified: true, uniqueSourceFiles: 2, uniqueSourceBytes: 2, uniqueFinalStates: 2, terminalBoundaries: 0 });
    expect(result.checks).toHaveLength(3);
    for (const row of result.checks) expect(row.checks).toHaveLength(5);
    expect(result.boundaryBytes).toBe(statSync(files[0]!).size + 2 * statSync(files[1]!).size);
    expect(result.provenance).toHaveLength(1);
    for (const [n, path] of files.entries()) {
      // Native byte equality checks length and contents without expanding each byte into object entries.
      expect(readFileSync(path).equals(original[n]!)).toBe(true);
      expect(fileEvidence(path)).toEqual({ bytes: original[n]!.length, sha256: createHash('sha256').update(original[n]!).digest('hex') });
    }
    expect(new Set(result.checks.map((row: { database: string }) => row.database)).size).toBe(1);
    expect(JSON.parse(readFileSync(join(result.outputDir, 'summary.json'), 'utf8')).boundaries).toBe(3);
  }, 60_000);

  it('records a failed boundary without a success summary and preserves the offending bytes', async () => {
    expect.assertions(5);
    const { source, output } = setup();
    const bytes = '{"beforeLast":null,"lastIntent":null,"final":null}\n';
    writeFileSync(join(source, 'bad.json'), bytes); index(source, { bad: 'bad.json' });
    await expect(verifySageBoundaries(options(source, output, 1), runtime)).rejects.toThrow('Missing beforeLast/lastIntent/final');
    expect(readdirSync(output)).toHaveLength(1);
    const directory = join(output, readdirSync(output)[0]!);
    expect(readdirSync(directory)).toEqual(['failure.json']);
    expect(JSON.parse(readFileSync(join(directory, 'failure.json'), 'utf8')))
      .toMatchObject({ passed: false, failedBoundary: 'bad', verifiedBoundaries: 0, expectedBoundaries: 1 });
    expect(readFileSync(join(source, 'bad.json'), 'utf8')).toBe(bytes);
  });

  it('isolates two terminal sidecars sharing the same source run without poisoning the live verification DB', async () => {
    expect.assertions(8);
    const { source, output } = setup(); vi.spyOn(console, 'log').mockImplementation(() => {});
    // Explicit ordinary-combat UNIT source, not a natural Sage death claim. The selected
    // source cursor precedes this isolated round; no random outcome or saved history is rewritten.
    const beforeLast = createSliceRun('save-terminal-unit', sliceDefaultCreationSelection, 'sage-save-terminal-unit');
    beforeLast.activeEvent = null; beforeLast.eventQueue = []; beforeLast.arc.stage = 'COMBAT';
    beforeLast.health = 1; beforeLast.random.cursor = 2;
    beforeLast.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0,
      enemyStatus: 'RESISTING', lastRound: null };
    const lastIntent = { type: 'COMBAT_ROUND', stance: 'ATTACK' } as const;
    const final = applySliceIntent(beforeLast, lastIntent);
    expect(final.status).toBe('DEAD');
    writeFileSync(join(source, 'death.json'), JSON.stringify({ beforeLast, lastIntent, final }));
    const living = structuredClone(beforeLast); living.health = 100;
    const liveFinal = applySliceIntent(living, lastIntent);
    expect(liveFinal.status).toBe('ACTIVE');
    writeFileSync(join(source, 'living.json'), JSON.stringify({ beforeLast: living, lastIntent, final: liveFinal }));
    index(source, { deathOne: 'death.json', living: 'living.json', deathTwo: 'death.json' });
    const result = await verifySageBoundaries(options(source, output, 3), runtime);
    expect(result).toMatchObject({ passed: true, boundaries: 3, sourceBoundaryCount: 3, terminalBoundaries: 2, uniqueFinalStates: 2 });
    expect(result.checks).toHaveLength(3);
    expect(new Set(result.checks.map((row: { database: string }) => row.database)).size).toBe(3);
    const sealed = readdirSync(result.outputDir).filter(name => name.endsWith('.sealed'));
    expect(sealed).toHaveLength(2);
    for (const filename of sealed) expect(JSON.parse(readFileSync(join(result.outputDir, filename), 'utf8'))).toEqual([beforeLast.runId]);
  }, 10_000);

  it('returns a nonzero CLI exit for each invalid or empty requested source', () => {
    expect.assertions(7);
    const { source, output } = setup(); index(source, {});
    const badArguments = [
      ['--count', '0'],
      ['--source-directory', source, '--output-directory', output, '--expected-boundaries', '1'],
      ['--unknown-option', '1'],
    ];
    expect(badArguments).toHaveLength(3);
    for (const args of badArguments) {
      const child = spawnSync(process.execPath, ['scripts/play/sage-save.mjs', ...args], { encoding: 'utf8' });
      expect(child.status).toBe(1);
      expect(child.stdout).not.toContain('"passed":true');
    }
  });
});
