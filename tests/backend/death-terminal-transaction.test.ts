/** Explicitly controlled fatal branch, NOT a natural campaign outcome.
 * The unchanged 1038-command source and the entire paid preparation route use
 * their real history. Only the new promotion draw at cursor490 is set to100;
 * that same declared seam remains installed for strict cold validation. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openDeathRuntimeSession } from '../../src/domain/death/owned-session.js';
import type { DeathCommand } from '../../src/domain/death/types.js';
import { DEATH_CONSUMPTION } from '../../src/domain/death/content.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  authenticDeathSource, assertDeathPublicBoundary, assertUnmodifiedDeathInput,
  deathInheritedHash, deathScenarioHash, installControlledDeathPromotion,
  DEATH_CONTROLLED_CURSOR, DEATH_CONTROLLED_SEED,
} from '../helpers/death-scenario.js';

// Forward every operation to the real strict session. These observations only
// establish when persistence publishes its private head; they grant no authority.
const observed = vi.hoisted(() => ({ opens: 0, prepares: 0, commits: 0, discards: 0,
  heads: [] as (() => { revision: number; status: string })[] }));
vi.mock('../../src/domain/death/owned-session.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/domain/death/owned-session.js')>();
  return { ...actual, openDeathRuntimeSession: (input: unknown) => {
    const session = actual.openDeathRuntimeSession(input);
    observed.opens++; observed.heads.push(() => session.inspect());
    return Object.freeze({ ...session,
      prepare: (...args: Parameters<typeof session.prepare>) => { observed.prepares++; return session.prepare(...args); },
      commit: (...args: Parameters<typeof session.commit>) => { session.commit(...args); observed.commits++; },
      discard: (...args: Parameters<typeof session.discard>) => { session.discard(...args); observed.discards++; },
    });
  } };
});

const fullHistoryBudget = 300_000;
const importedAt = '2026-10-18T08:00:00.000Z', committedAt = '2026-10-18T08:00:01.000Z';
const previousSelection = 'death-terminal-prior-selected-slot';
let seam: ReturnType<typeof installControlledDeathPromotion>;
let source: SliceState, before: SliceState, dead: SliceState;
let fatal: Extract<SliceIntent, { type: 'DEATH' }>;
let terminalProjection: SliceProjection;
let sourceHash: string, beforeHash: string, deadHash: string;
const stores: SqliteSliceStore[] = [], directories: string[] = [];

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}
function open(file: string, beforeWrite?: () => void): SqliteSliceStore {
  const store = new SqliteSliceStore(file, { now: () => committedAt, ...(beforeWrite ? { beforeWrite } : {}) });
  stores.push(store); return store;
}
function close(store: SqliteSliceStore): void { store.close(); stores.splice(stores.indexOf(store), 1); }
function currentRow(file: string) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const row = db.prepare('SELECT current_json, backup_json, terminal FROM slice_runs WHERE id=?').get(before.runId)!;
    return { current: String(row.current_json), backup: String(row.backup_json), terminal: Number(row.terminal) };
  } finally { db.close(); }
}
function decoded(raw: string): StoredSlice { return JSON.parse(JSON.parse(raw).payload) as StoredSlice; }
function fileHash(file: string): string | null {
  return existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null;
}
function persisted(file: string): string {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return stableStringify({
      runs: db.prepare('SELECT * FROM slice_runs ORDER BY id').all(),
      receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
      meta: db.prepare('SELECT * FROM slice_meta ORDER BY key').all(),
      backup: fileHash(`${file}.bak`), sealed: fileHash(`${file}.sealed`),
      files: readdirSync(dirname(file)).sort(),
    });
  } finally { db.close(); }
}

beforeAll(() => {
  seam = installControlledDeathPromotion(100);
  source = authenticDeathSource(); sourceHash = deathScenarioHash(source);
  const inherited = deathInheritedHash(source);
  const guided = applySliceIntent(source, { type: 'DEATH', command: { type: 'LEARN_GUIDANCE' } });
  const session = openDeathRuntimeSession(guided);
  const commands: DeathCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  // Same real preferred route as the successful scenario, stopping before its
  // first actual consumption. There is no successful branch to graft or edit.
  for (;;) {
    const panel = session.projectDeath(), action = panel.actions.find(item => item.preferredAction);
    if (commands.length > 240 || !action?.enabled)
      throw Error(`Actual fatal preparation route stopped: ${panel.nextStep}`);
    if (action.command.type === 'CONSUME') {
      before = session.snapshot(); fatal = { type: 'DEATH', command: structuredClone(action.command) }; break;
    }
    const draft = session.prepare({ type: 'DEATH', command: action.command }, session.inspect().revision);
    session.commit(draft); commands.push(structuredClone(action.command));
    expect(session.inspect().status).toBe('ACTIVE');
  }
  expect(seam.substituted).toEqual([]);
  expect(before.random).toEqual({ seed: DEATH_CONTROLLED_SEED, cursor: DEATH_CONTROLLED_CURSOR });
  expect(before.progression.sequence).toBe(1);
  expect(before.death.journal.some(event => event.command.type === 'CLINIC')).toBe(true);
  expect(before.death.journal.some(event => event.command.type === 'STABILIZE_PROMOTION')).toBe(true);
  expect(deathInheritedHash(before)).toBe(inherited);
  beforeHash = deathScenarioHash(before);

  // Independently execute the strict public reducer. Status, body, injuries,
  // original ownership and the central ending all come from this real command.
  dead = applySliceIntent(before, fatal); assertValidSliceState(dead);
  expect(dead.status).toBe('DEAD'); expect(dead.ending?.kind).toBe('DEATH');
  expect(dead.arc.stage).toBe('ENDED'); expect(dead.revision).toBe(before.revision + 1);
  expect(dead.random).toEqual({ seed: DEATH_CONTROLLED_SEED, cursor: DEATH_CONTROLLED_CURSOR + 1 });
  expect(dead.lastCheck).toMatchObject({ chance: 70, roll: 100, tier: 'GREAT_FAILURE' });
  expect(dead.death.journal.at(-1)!.randomReceipts).toHaveLength(1);
  expect(dead.death.journal.at(-1)!.randomReceipts[0]).toMatchObject({
    cursorBefore: 490, cursorAfter: 491, check: { chance: 70, roll: 100, tier: 'GREAT_FAILURE' },
  });
  expect(dead.health).toBe(0); expect(dead.mind).toBe(0);
  expect(dead.spirituality).toBe(before.spirituality - DEATH_CONSUMPTION.spirituality);
  expect(dead.seer.pollution).toBe(Math.min(100, before.seer.pollution + DEATH_CONSUMPTION.greatFailurePollution));
  expect(dead.injuries.slice(0, before.injuries.length)).toEqual(before.injuries);
  expect(dead.injuries.at(-1)).toMatchObject({ severity: 'HEAVY', acquiredRevision: dead.revision, treatedRevision: null });
  expect(dead.injuries).toHaveLength(before.injuries.length + 1);
  expect(dead.injuryRisk).toBe(before.injuryRisk + 2);
  expect(dead.progression).toEqual(before.progression);
  expect(dead.seer.completedSources).toEqual(before.seer.completedSources);
  expect(dead.death.promotionWeek).toBeNull();
  const expense = dead.death.frame!.economy.expenses - before.death.frame!.economy.expenses;
  expect(dead.cash).toBe(before.cash - expense);
  expect(dead.actionsRemaining).toBe(dead.week === before.week ? before.actionsRemaining - 1 : 0);
  expect(deathInheritedHash(dead)).toBe(inherited);

  const materials = dead.death.materials!, prepared = before.death.materials!;
  if (fatal.command.type !== 'CONSUME') throw Error('Expected the actual prepared consumption command');
  const compoundId = fatal.command.compoundId;
  const potion = materials.compounds.find(item => item.id === compoundId)!;
  expect(potion).toMatchObject({ status: 'FAILED_LOST', consumedWeek: before.week, recoveredEventId: null });
  expect(materials.settlements.at(-1)).toMatchObject({ compoundId: potion.id, success: false, alive: false });
  expect(materials.batches.find(item => item.id === potion.batchId)?.status).toBe('SPENT');
  expect(materials.characteristics).toHaveLength(3);
  for (const item of materials.characteristics) {
    const original = prepared.characteristics.find(entry => entry.id === item.id)!;
    if (item.originBottleId === materials.embodiedOriginalBottleId) expect(item).toEqual(original);
    else expect(item).toMatchObject({ holder: 'LOST', location: before.death.frame!.location, compoundId: potion.id });
  }
  expect(materials.characteristics.find(item => item.originBottleId === materials.embodiedOriginalBottleId)?.holder).toBe('EMBODIED');
  expect(materials.uniqueness).toMatchObject({ holder: 'LOST', incumbentActorId: null, compoundId: potion.id });
  expect(materials.compounds).toHaveLength(prepared.compounds.length);
  expect(materials.batches.filter(item => item.status === 'SUPPLIER')).toEqual(prepared.batches.filter(item => item.status === 'SUPPLIER'));

  deadHash = deathScenarioHash(dead); terminalProjection = projectSliceState(dead);
  expect(terminalProjection).toMatchObject({ status: 'DEAD', health: 0, mind: 0, canAct: false, maxSpirituality: 120 });
  expect(terminalProjection.death.actions.every(action => !action.enabled)).toBe(true);
  assertDeathPublicBoundary(terminalProjection, dead);
  observed.opens = 0; observed.prepares = 0; observed.commits = 0; observed.discards = 0; observed.heads.length = 0;
}, fullHistoryBudget);

afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  observed.heads.length = 0;
});
afterAll(() => {
  try {
    if (sourceHash) expect(deathScenarioHash(source)).toBe(sourceHash);
    if (beforeHash) expect(deathScenarioHash(before)).toBe(beforeHash);
    if (deadHash) expect(deathScenarioHash(dead)).toBe(deadHash);
    expect(seam.substituted.length).toBeGreaterThan(0);
    expect(seam.substituted.every(draw => draw.cursorBefore === 490 && draw.cursorAfter === 491 && draw.controlled === 100)).toBe(true);
    assertUnmodifiedDeathInput();
  } finally { seam?.restore(); }
}, fullHistoryBudget);

describe('Death actual terminal SQLite transaction with one explicitly controlled fatal draw', () => {
  it('rolls back a staged actual death and seal, retries the identical intent, then cold reopens permanently archived', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lotm-death-terminal-')); directories.push(directory);
    const file = join(directory, 'save.sqlite');
    let watch = false, fail = false, staged = 0;
    const intent: SliceEnvelope = { intentId: 'death-controlled-fatal-consumption', runId: before.runId,
      expectedRevision: before.revision, payload: structuredClone(fatal) };
    const intentBytes = stableStringify(intent);
    const store = open(file, () => {
      if (!watch) return;
      expect(observed.heads.at(-1)!()).toMatchObject({ revision: before.revision, status: 'ACTIVE' });
      expect(observed.commits).toBe(0);
      // The actual terminal draft and receipt are already written on this
      // transaction's own connection; the sidecar has also really been flushed.
      expect(deathScenarioHash(store.repository.get(before.runId)!.state)).toBe(deadHash);
      expect(store.repository.receipt(intent.intentId)?.receipt.state).toEqual(terminalProjection);
      expect(JSON.parse(readFileSync(`${file}.sealed`, 'utf8'))).toContain(before.runId);
      staged++;
      if (fail) throw Error('Injected beforeWrite failure after actual Death terminal writes and seal');
    });
    store.repository.transaction(() => {
      store.repository.put({ state: before, updatedAt: importedAt });
      store.repository.selectRun(previousSelection);
    });
    expect(store.repository.ownedHead(before.runId)).toMatchObject({ revision: before.revision, status: 'ACTIVE' });
    const original = persisted(file), originalRow = currentRow(file), opens = observed.opens;
    expect(originalRow.terminal).toBe(0); expect(existsSync(`${file}.sealed`)).toBe(false);

    watch = true; fail = true;
    try { expect(store.submitIntent(intent)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } }); }
    finally { watch = false; }
    expect(staged).toBe(1); expect(observed.prepares).toBe(1); expect(observed.discards).toBe(1);
    expect(observed.commits).toBe(0); expect(observed.opens).toBe(opens);
    expect(persisted(file)).toBe(original); expect(currentRow(file)).toEqual(originalRow);
    expect(decoded(currentRow(file).current).state).toEqual(before);
    expect(store.repository.receipt(intent.intentId)).toBeNull();
    expect(store.repository.activeRun()).toBe(previousSelection);
    expect(store.repository.ownedHead(before.runId)).toMatchObject({ revision: before.revision, status: 'ACTIVE' });
    expect(existsSync(`${file}.sealed`)).toBe(false);

    watch = true; fail = false;
    let receipt: ReturnType<typeof store.submitIntent>;
    try { receipt = store.submitIntent(intent); }
    finally { watch = false; }
    const committed = unwrap(receipt);
    expect(committed).toMatchObject({ previousRevision: before.revision, newRevision: dead.revision, replayed: false, committedAt });
    expect(committed.state).toEqual(terminalProjection);
    expect(staged).toBe(2); expect(observed.prepares).toBe(2); expect(observed.commits).toBe(1);
    expect(observed.heads.at(-1)!()).toMatchObject({ revision: dead.revision, status: 'DEAD' });
    expect(stableStringify(intent)).toBe(intentBytes);
    const terminal = currentRow(file);
    expect(terminal.terminal).toBe(1); expect(terminal.backup).toBe(terminal.current);
    expect(decoded(terminal.current).state).toEqual(dead);
    expect(decoded(terminal.backup).state).toEqual(dead);
    expect(currentRow(`${file}.bak`)).toEqual(terminal);
    expect(JSON.parse(readFileSync(`${file}.sealed`, 'utf8'))).toContain(dead.runId);
    expect(store.repository.activeRun()).toBe(dead.runId);
    expect(unwrap(store.submitIntent(intent))).toEqual({ ...committed, replayed: true });
    expect(currentRow(file)).toEqual(terminal);

    close(store);
    const reopened = open(file);
    expect(unwrap(reopened.loadRun(dead.runId))).toEqual(terminalProjection);
    expect(unwrap(reopened.getBootstrap())).toMatchObject({ activeState: terminalProjection,
      runs: [{ runId: dead.runId, status: 'DEAD', revision: dead.revision }] });
    expect(unwrap(reopened.submitIntent(intent))).toEqual({ ...committed, replayed: true });
    const locked = persisted(file);
    const forbidden: SliceIntent[] = [fatal, { type: 'DEATH', command: { type: 'WORK' } },
      { type: 'DEATH', command: { type: 'LEARN_GUIDANCE' } }, { type: 'ACTION', action: 'WORK' }];
    for (const [index, payload] of forbidden.entries()) {
      expect(reopened.submitIntent({ intentId: `death-no-revival-${index}`, runId: dead.runId,
        expectedRevision: dead.revision, payload })).toMatchObject({ ok: false, error: { code: 'ARCHIVED' } });
      expect(reopened.repository.receipt(`death-no-revival-${index}`)).toBeNull();
    }
    expect(persisted(file)).toBe(locked); expect(currentRow(file)).toEqual(terminal);
    expect(reopened.repository.ownedHead(dead.runId)).toMatchObject({ revision: dead.revision, status: 'DEAD' });
    expect(observed.prepares).toBe(2); expect(observed.commits).toBe(1);
    expect(deathScenarioHash(decoded(currentRow(file).current).state)).toBe(deadHash);
    assertDeathPublicBoundary(committed.state, dead); assertUnmodifiedDeathInput();
  }, fullHistoryBudget);
});
