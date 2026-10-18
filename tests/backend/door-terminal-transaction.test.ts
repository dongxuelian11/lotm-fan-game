/** Explicitly controlled fatal branch, NOT a natural campaign outcome.
 * The unchanged 823-command source and the entire paid preparation route use
 * their real history. Only the new promotion draw at cursor 205 is set to 100;
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
import { openDoorRuntimeSession } from '../../src/domain/door/owned-session.js';
import type { DoorCommand } from '../../src/domain/door/types.js';
import { DOOR_CONSUMPTION } from '../../src/domain/door/content.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  authenticDoorSource, assertDoorPublicBoundary, assertUnmodifiedDoorInput,
  doorInheritedHash, doorScenarioHash, installControlledDoorPromotion,
  DOOR_CONTROLLED_CURSOR, DOOR_CONTROLLED_SEED,
} from '../helpers/door-scenario.js';

// Forward every operation to the real strict session. These observations only
// establish when persistence publishes its private head; they grant no authority.
const observed = vi.hoisted(() => ({ opens: 0, prepares: 0, commits: 0, discards: 0,
  heads: [] as (() => { revision: number; status: string })[] }));
vi.mock('../../src/domain/door/owned-session.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/domain/door/owned-session.js')>();
  return { ...actual, openDoorRuntimeSession: (input: unknown) => {
    const session = actual.openDoorRuntimeSession(input);
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
const previousSelection = 'door-terminal-prior-selected-slot';
let seam: ReturnType<typeof installControlledDoorPromotion>;
let source: SliceState, before: SliceState, dead: SliceState;
let fatal: Extract<SliceIntent, { type: 'DOOR' }>;
let terminalProjection: SliceProjection;
let sourceHash: string, beforeHash: string, deadHash: string;
const stores: SqliteSliceStore[] = [], directories: string[] = [], restorers: (() => void)[] = [];

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
  seam = installControlledDoorPromotion(100);
  source = authenticDoorSource(); sourceHash = doorScenarioHash(source);
  const inherited = doorInheritedHash(source);
  const guided = applySliceIntent(source, { type: 'DOOR', command: { type: 'LEARN_GUIDANCE' } });
  const session = openDoorRuntimeSession(guided);
  const commands: DoorCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  // Same real preferred route as the successful scenario, stopping before its
  // first actual consumption. There is no successful branch to graft or edit.
  for (;;) {
    const panel = session.projectDoor(), action = panel.actions.find(item => item.preferredAction);
    if (commands.length > 260 || !action?.enabled)
      throw Error(`Actual fatal preparation route stopped: ${panel.nextStep}`);
    if (action.command.type === 'CONSUME') {
      before = session.snapshot(); fatal = { type: 'DOOR', command: structuredClone(action.command) }; break;
    }
    const draft = session.prepare({ type: 'DOOR', command: action.command }, session.inspect().revision);
    session.commit(draft); commands.push(structuredClone(action.command));
    expect(session.inspect().status).toBe('ACTIVE');
  }
  expect(seam.substituted).toEqual([]);
  expect(before.random).toEqual({ seed: DOOR_CONTROLLED_SEED, cursor: DOOR_CONTROLLED_CURSOR });
  expect(before.progression.sequence).toBe(1);
  expect(before.door.journal.some(event => event.command.type === 'CLINIC')).toBe(false);
  expect(before.door.journal.some(event => event.command.type === 'REST')).toBe(true);
  expect(before.injuries).toEqual([]);
  expect(before.door.journal.some(event => event.command.type === 'STABILIZE_PROMOTION')).toBe(true);
  expect(doorInheritedHash(before)).toBe(inherited);
  beforeHash = doorScenarioHash(before);

  // Independently execute the strict public reducer. Status, body, injuries,
  // original ownership and the central ending all come from this real command.
  dead = applySliceIntent(before, fatal); assertValidSliceState(dead);
  expect(DOOR_CONSUMPTION.greatFailureHealth).toBe(110);
  expect(dead.status).toBe('DEAD'); expect(dead.ending?.kind).toBe('DEATH');
  expect(dead.arc.stage).toBe('ENDED'); expect(dead.revision).toBe(before.revision + 1);
  expect(dead.random).toEqual({ seed: DOOR_CONTROLLED_SEED, cursor: DOOR_CONTROLLED_CURSOR + 1 });
  expect(dead.lastCheck).toMatchObject({ chance: 70, roll: 100, tier: 'GREAT_FAILURE' });
  expect(dead.door.journal.at(-1)!.randomReceipts).toHaveLength(1);
  expect(dead.door.journal.at(-1)!.randomReceipts[0]).toMatchObject({
    cursorBefore: 205, cursorAfter: 206, check: { chance: 70, roll: 100, tier: 'GREAT_FAILURE' },
  });
  expect(dead.health).toBe(0); expect(dead.mind).toBe(0);
  expect(dead.spirituality).toBe(before.spirituality - DOOR_CONSUMPTION.spirituality);
  expect(dead.seer.pollution).toBe(Math.min(100, before.seer.pollution + DOOR_CONSUMPTION.greatFailurePollution));
  expect(dead.injuries.slice(0, before.injuries.length)).toEqual(before.injuries);
  expect(dead.injuries.at(-1)).toMatchObject({ severity: 'HEAVY', acquiredRevision: dead.revision, treatedRevision: null });
  expect(dead.injuries).toHaveLength(before.injuries.length + 1);
  expect(dead.injuryRisk).toBe(before.injuryRisk + 2);
  expect(dead.progression).toEqual(before.progression);
  expect(dead.seer.completedSources).toEqual(before.seer.completedSources);
  expect(dead.door.promotionWeek).toBeNull();
  expect(dead.cash).toBeLessThanOrEqual(before.cash);
  if (dead.week === before.week) expect(dead.cash).toBe(before.cash);
  expect(dead.door.frame!.nowSecond - before.door.frame!.nowSecond).toBe(3600);
  expect(dead.actionsRemaining).toBe(dead.week === before.week ? before.actionsRemaining - 1 : dead.weeklyBudget);
  expect(doorInheritedHash(dead)).toBe(inherited);

  const materials = dead.door.materials!, prepared = before.door.materials!;
  if (fatal.command.type !== 'CONSUME') throw Error('Expected the actual prepared consumption command');
  const compoundId = fatal.command.compoundId;
  const potion = materials.compounds.find(item => item.id === compoundId)!;
  expect(potion).toMatchObject({ status: 'FAILED_LOST', consumedWeek: before.week, recoveredEventId: null });
  expect(materials.settlements.at(-1)).toMatchObject({ compoundId: potion.id, success: false, alive: false });
  expect(materials.batches.find(item => item.id === potion.batchId)).toMatchObject({ status: 'SPENT', uses: 1 });
  expect(materials.characteristics).toHaveLength(3);
  for (const item of materials.characteristics) {
    expect(item.id).toBe(prepared.characteristics.find(entry => entry.originBottleId === item.originBottleId)!.id);
    expect(item).toMatchObject({ holder: 'LOST', location: before.door.frame!.location, compoundId: potion.id });
  }
  expect(materials.characteristics.find(item => item.originBottleId === materials.embodiedOriginalBottleId)?.holder).toBe('LOST');
  expect(materials.uniqueness).toMatchObject({ holder: 'LOST', location: before.door.frame!.location, incumbentActorId: null, custodianActorId: null, compoundId: potion.id });
  expect(dead.door.promotionStability.preparations.at(-1)).toMatchObject({ compoundId, status: 'SPENT', spentEventId: dead.door.journal.at(-1)!.id });
  expect(materials.compounds).toHaveLength(prepared.compounds.length);
  expect(materials.batches.filter(item => item.status === 'SUPPLIER')).toEqual(prepared.batches.filter(item => item.status === 'SUPPLIER'));

  deadHash = doorScenarioHash(dead); terminalProjection = projectSliceState(dead);
  expect(terminalProjection).toMatchObject({ status: 'DEAD', health: 0, mind: 0, canAct: false, maxSpirituality: 120 });
  expect(terminalProjection.door.actions.every(action => !action.enabled)).toBe(true);
  assertDoorPublicBoundary(terminalProjection, dead);
  observed.opens = 0; observed.prepares = 0; observed.commits = 0; observed.discards = 0; observed.heads.length = 0;
}, fullHistoryBudget);

afterEach(() => {
  for (const restore of restorers.splice(0).reverse()) restore();
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  observed.heads.length = 0;
});
afterAll(() => {
  try {
    if (sourceHash) expect(doorScenarioHash(source)).toBe(sourceHash);
    if (beforeHash) expect(doorScenarioHash(before)).toBe(beforeHash);
    if (deadHash) expect(doorScenarioHash(dead)).toBe(deadHash);
    expect(seam.substituted.length).toBeGreaterThan(0);
    expect(seam.substituted.every(draw => draw.cursorBefore === 205 && draw.cursorAfter === 206 && draw.controlled === 100)).toBe(true);
    assertUnmodifiedDoorInput();
  } finally { seam?.restore(); }
}, fullHistoryBudget);

describe('Door actual terminal SQLite transaction with one explicitly controlled fatal draw', () => {
  it.each(['beforeWrite', 'commit'] as const)('rolls back %s after actual death and seal, retries identical RNG, then cold reopens permanently archived', failure => {
    observed.opens = 0; observed.prepares = 0; observed.commits = 0; observed.discards = 0; observed.heads.length = 0;
    const directory = mkdtempSync(join(tmpdir(), 'lotm-door-terminal-')); directories.push(directory);
    const file = join(directory, 'save.sqlite');
    let watch = false, fail = false, staged = 0, commitChecks = 0;
    const intent: SliceEnvelope = { intentId: 'door-controlled-fatal-consumption', runId: before.runId,
      expectedRevision: before.revision, payload: structuredClone(fatal) };
    const intentBytes = stableStringify(intent);
    const store = open(file, () => {
      if (!watch) return;
      expect(observed.heads.at(-1)!()).toMatchObject({ revision: before.revision, status: 'ACTIVE' });
      expect(observed.commits).toBe(0);
      // The actual terminal draft and receipt are already written on this
      // transaction's own connection; the sidecar has also really been flushed.
      expect(doorScenarioHash(store.repository.get(before.runId)!.state)).toBe(deadHash);
      expect(store.repository.receipt(intent.intentId)?.receipt.state).toEqual(terminalProjection);
      expect(JSON.parse(readFileSync(`${file}.sealed`, 'utf8'))).toContain(before.runId);
      staged++;
      if (fail && failure === 'beforeWrite') throw Error('Injected beforeWrite failure after actual Door terminal writes and seal');
    });
    store.repository.transaction(() => {
      store.repository.put({ state: before, updatedAt: importedAt });
      store.repository.selectRun(previousSelection);
    });
    expect(store.repository.ownedHead(before.runId)).toMatchObject({ revision: before.revision, status: 'ACTIVE' });
    const original = persisted(file), originalRow = currentRow(file), opens = observed.opens;
    expect(originalRow.terminal).toBe(0); expect(existsSync(`${file}.sealed`)).toBe(false);

    const exec = DatabaseSync.prototype.exec;
    const spy = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: DatabaseSync, sql: string) {
      if (watch && sql === 'COMMIT') {
        expect(observed.commits).toBe(0);
        expect(observed.heads.at(-1)!()).toMatchObject({ revision: before.revision, status: 'ACTIVE' });
        expect(store.repository.ownedHead(before.runId)).toMatchObject({ revision: before.revision, status: 'ACTIVE' });
        commitChecks++;
        if (fail && failure === 'commit') throw Error('Injected Door terminal COMMIT failure before durability');
      }
      const result = exec.call(this, sql);
      if (watch && sql === 'COMMIT') {
        // Durability precedes publication of the owned domain head.
        expect(observed.commits).toBe(0);
        expect(observed.heads.at(-1)!()).toMatchObject({ revision: before.revision, status: 'ACTIVE' });
        expect(doorScenarioHash(decoded(currentRow(file).current).state)).toBe(deadHash);
      }
      return result;
    });
    restorers.push(() => spy.mockRestore());

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
    expect(decoded(currentRow(file).current).state.random).toEqual({ seed: DOOR_CONTROLLED_SEED, cursor: DOOR_CONTROLLED_CURSOR });

    watch = true; fail = false;
    let receipt: ReturnType<typeof store.submitIntent>;
    try { receipt = store.submitIntent(intent); }
    finally { watch = false; }
    spy.mockRestore();
    const committed = unwrap(receipt);
    expect(committed).toMatchObject({ previousRevision: before.revision, newRevision: dead.revision, replayed: false, committedAt });
    expect(committed.state).toEqual(terminalProjection);
    expect(commitChecks).toBe(failure === 'commit' ? 2 : 1);
    expect(staged).toBe(2); expect(observed.prepares).toBe(2); expect(observed.commits).toBe(1);
    expect(observed.heads.at(-1)!()).toMatchObject({ revision: dead.revision, status: 'DEAD' });
    expect(stableStringify(intent)).toBe(intentBytes);
    expect(store.repository.get(dead.runId)!.state.random).toEqual({ seed: DOOR_CONTROLLED_SEED, cursor: DOOR_CONTROLLED_CURSOR + 1 });
    expect(store.repository.get(dead.runId)!.state.door.journal.at(-1)!.randomReceipts).toEqual(dead.door.journal.at(-1)!.randomReceipts);
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
    const forbidden: SliceIntent[] = [fatal, { type: 'CONTINUE_LIFE' },
      { type: 'DOOR', command: { type: 'MATERIAL', command: { type: 'SEAL_REMAINS', compoundId: dead.door.materials!.compounds.at(-1)!.id } } },
      { type: 'DOOR', command: { type: 'MATERIAL', command: { type: 'RECOVER_SEALED', compoundId: dead.door.materials!.compounds.at(-1)!.id } } },
      { type: 'DOOR', command: { type: 'REST' } }, { type: 'DOOR', command: { type: 'WORK' } },
      { type: 'DOOR', command: { type: 'LEARN_GUIDANCE' } }, { type: 'ACTION', action: 'WORK' }];
    for (const [index, payload] of forbidden.entries()) {
      expect(reopened.submitIntent({ intentId: `door-no-revival-${index}`, runId: dead.runId,
        expectedRevision: dead.revision, payload })).toMatchObject({ ok: false, error: { code: 'ARCHIVED' } });
      expect(reopened.repository.receipt(`door-no-revival-${index}`)).toBeNull();
    }
    expect(persisted(file)).toBe(locked); expect(currentRow(file)).toEqual(terminal);
    expect(reopened.repository.ownedHead(dead.runId)).toMatchObject({ revision: dead.revision, status: 'DEAD' });
    expect(observed.prepares).toBe(2); expect(observed.commits).toBe(1);
    expect(doorScenarioHash(decoded(currentRow(file).current).state)).toBe(deadHash);
    assertDoorPublicBoundary(committed.state, dead); assertUnmodifiedDoorInput();
  }, fullHistoryBudget);
});
