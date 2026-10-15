import { playerText } from '../../src/shared/player-text.js';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { validateMiracleWorkerRoundOutcome } from '../../src/domain/miracle-worker/combat.js';
import { MIRACLE_WORKER_EXIT, MIRACLE_WORKER_SITE, MIRACLE_WORKER_TARGET_ID,
  validateMiracleWorkerEncounter } from '../../src/domain/miracle-worker/encounter.js';
import { createMiracleWorkerRevivalState, openMiracleWorkerRevival, blockMiracleWorkerRevival,
  hasMiracleWorkerRevivalLock, projectMiracleWorkerRevival, validateMiracleWorkerRevivalCommand,
  validateMiracleWorkerRevivalState, MIRACLE_WORKER_REVIVAL_ALLOWANCE, MIRACLE_WORKER_REVIVAL_HEALTH,
  MIRACLE_WORKER_REVIVAL_WINDOW_SECONDS, MIRACLE_WORKER_REBUILD_SECONDS, MIRACLE_WORKER_REBUILD_POINT, MIRACLE_WORKER_REVIVAL_BOUNDARY,
  type MiracleWorkerRevivalCommand } from '../../src/domain/miracle-worker/revival.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

/** DIRECTED, never a claim of natural death/survival or four natural revivals.
 * The fixture starts at the real natural S2 combatStart. Its only setup edit is
 * random.cursor. PLAYER_DEAD, all waits, revival, pickup, departure and final
 * deaths must then be produced by public applySliceIntent commands.
 * This version has one supported original encounter; do not fabricate four
 * distinct deaths or duplicate a source to pretend to exercise all four uses.
 */
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
interface Provenance {
  kind: string; naturalSource: string; changedFields: string[];
  naturalCursor: number; directedCursor: number; naturalResultUnchanged: boolean;
}
const path = 'tests/fixtures/miracle-worker-v01640/directed-revival.json';
const naturalPath = 'tests/fixtures/miracle-worker-v01640/continuation.json';
// Reuse captured boundary states; do not parse the much larger natural boundary
// fixture or retain duplicate top-level pending/revived/exited state trees.
const boundaries = readObjectEntry<Record<string, Boundary>>(path, 'boundaries');
for (const b of Object.values(boundaries)) { b.beforeLast = migrateSliceState(b.beforeLast); b.final = migrateSliceState(b.final); }
const boundary = (key: string): Boundary => {
  const value = boundaries[key];
  if (!value) throw new Error(`Missing directed revival boundary: ${key}`);
  return value;
};
const pending = () => structuredClone(boundary('directed-real-death').final);
const revived = () => structuredClone(boundary('first-revival').final);
const record = (s: SliceState) => s.miracleWorker.revival.records[0]!;
const command = (s: SliceState, type: MiracleWorkerRevivalCommand['type']): MiracleWorkerRevivalCommand =>
  type === 'WAIT_REVIVAL' ? { type, deathId: record(s).id } : { type, deathId: record(s).id, confirmed: true };
const submit = (s: SliceState, c: MiracleWorkerRevivalCommand) =>
  applySliceIntent(s, { type: 'MIRACLE_WORKER', command: c });
const noRandomContext = (): SeerContext => ({
  roll: vi.fn(() => { throw new Error('Revival must not draw random numbers'); }),
  check: vi.fn(() => { throw new Error('Revival must not reroll a check'); }),
  note: vi.fn(),
});
const enemyAndDeath = (s: SliceState) => {
  const e = s.miracleWorker.encounter;
  return { targetId: e.targetId, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus,
    enemyInjuries: e.enemyInjuries, enemyRisk: e.enemyRisk, powerUses: e.powerUses,
    terminal: e.terminal, combatHistory: s.combatHistory, lastCombatRound: s.lastCombatRound };
};
const preservedResources = (s: SliceState) => ({
  mind: s.mind, spirituality: s.spirituality, injuries: s.injuries, risk: s.injuryRisk,
  cash: s.cash, actions: s.actionsRemaining, week: s.week, date: s.date, random: s.random,
  progression: s.progression, seer: s.seer, magician: s.magician,
  life: s.miracleWorker.life, ritual: s.miracleWorker.ritual,
  batches: s.miracleWorker.batches, bottles: s.miracleWorker.bottles,
  ancientScholar: s.ancientScholar, longChapter: s.longChapter,
});

const keys = ['directed-real-death', 'wait-30', 'first-revival', 'real-originals-recovered',
  'ordinary-exit', 'forfeit', 'expiry-wait-1', 'expiry-wait-2', 'expiry-wait-3', 'expiry-wait-4'] as const;

describe('Miracle Worker finite revival: directed actual public death and boundary replay', () => {
  it('starts from the natural S2 combatStart with only the explicitly declared test cursor changed', () => {
    const provenance = readObjectEntry<Provenance>(path, 'provenance');
    const natural = migrateSliceState(readObjectEntry<SliceState>(naturalPath, 'combatStart'));
    const directed = boundary('directed-real-death').beforeLast;
    expect(provenance).toMatchObject({ kind: 'DIRECTED_REAL_COMBAT_DEATH_FROM_NATURAL_S2_START',
      naturalSource: naturalPath, changedFields: ['random.cursor'], naturalResultUnchanged: true });
    expect(natural.random.cursor).toBe(provenance.naturalCursor);
    expect(directed.random.cursor).toBe(provenance.directedCursor);
    expect(directed.random.seed).toBe(natural.random.seed);
    expect(directed.random.cursor).not.toBe(natural.random.cursor);
    expect({ ...directed, random: natural.random }).toEqual(natural);
    expect(directed.status).toBe('ACTIVE');
    expect(directed.health).toBeGreaterThan(0);
    expect(directed.progression).toMatchObject({ pathwayId: 'diviner', sequence: 2 });
    expect(directed.combat?.encounterId).toBe('MIRACLE_WORKER_DISPUTE');
    expect(directed.miracleWorker.revival).toEqual(createMiracleWorkerRevivalState());
    expect(boundary('directed-real-death').lastIntent).toEqual({ type: 'COMBAT_ROUND', stance: 'ATTACK' });
  });

  it.each(keys)('replays %s through the public dispatcher, preserves its input and survives JSON reload', key => {
    const saved = boundary(key), before = structuredClone(saved.beforeLast);
    assertValidSliceState(before);
    const result = applySliceIntent(before, saved.lastIntent);
    expect(before).toEqual(saved.beforeLast);
    expect(result).toEqual(saved.final);
    expect(() => assertValidSliceState(result)).not.toThrow();
    const reloaded: SliceState = JSON.parse(JSON.stringify(result));
    expect(reloaded).toEqual(result);
    expect(() => assertValidSliceState(reloaded)).not.toThrow();
  });

  it('keeps the actual H0 source round, original body, living original enemy and paid resources at death', () => {
    const s = pending(), r = record(s), e = s.miracleWorker.encounter;
    const before = boundary('directed-real-death').beforeLast;
    const round = s.combatHistory[r.sourceHistoryIndex]!, outcome = round.miracleWorkerOutcome!;
    expect(s.status).toBe('REVIVAL_PENDING'); expect(s.health).toBe(0); expect(s.ending).toBeNull();
    expect(s.combat).toBeNull(); expect(hasMiracleWorkerRevivalLock(s)).toBe(true);
    expect(s.combatHistory).toHaveLength(before.combatHistory.length + 1);
    expect(s.combatHistory.slice(0, -1)).toEqual(before.combatHistory);
    expect(s.lastCombatRound).toEqual(round);
    expect(round.winner).toBe('ENEMY'); expect(round.retreat).not.toBe('SUCCESS');
    expect(validateMiracleWorkerRoundOutcome(outcome)).toBe(true);
    expect(outcome).toMatchObject({ continuing: false, playerHealthAfter: 0, ownerAt: MIRACLE_WORKER_SITE,
      playerMindAfter: s.mind, playerSpiritualityAfter: s.spirituality,
      playerInjuriesAfter: s.injuries, playerRiskAfter: s.injuryRisk });
    expect(outcome.source).toMatchObject({ encounterId: 'MIRACLE_WORKER_DISPUTE', targetId: MIRACLE_WORKER_TARGET_ID,
      runId: s.runId, playerSequence: 2, actualOriginalBody: true, bodyId: `${s.runId}:body`, space: MIRACLE_WORKER_SITE });
    expect(r).toMatchObject({ sourceHistoryIndex: s.combatHistory.length - 1, deathRevision: s.revision,
      bodyId: `${s.runId}:body`, deathAt: MIRACLE_WORKER_SITE, siteId: MIRACLE_WORKER_SITE,
      remains: 'PRESENT', elapsedSeconds: 0, waitCount: 0, deadlineSeconds: 120,
      outcome: 'PENDING', resolvedRevision: null, returnAt: null, healthAfter: null });
    expect(e.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', historyIndex: r.sourceHistoryIndex,
      revision: r.deathRevision, playerBodyAt: MIRACLE_WORKER_SITE, playerOriginalsAt: MIRACLE_WORKER_SITE,
      enemyStatus: 'RESISTING', enemyWeaponAt: 'WITH_ENEMY' });
    expect(e.enemyHealth).toBeGreaterThan(0); expect(e.enemySpirituality).toBeLessThan(120);
    expect(e.supplies.paperSpent).toBeGreaterThan(0); expect(e.supplies.oilSpent).toBe(1);
    expect(e.supplies.clubHeld).toBe(false);
    expect(s.random.cursor).toBeGreaterThan(before.random.cursor);
  });
});

describe('Miracle Worker four-use ledger, clock and same-body reconstruction', () => {
  it('starts with four lifetime uses, zero borrowed/pre-spent uses and independent empty records', () => {
    expect(MIRACLE_WORKER_REVIVAL_ALLOWANCE).toBe(4);
    expect(MIRACLE_WORKER_REVIVAL_WINDOW_SECONDS).toBe(120);
    expect(MIRACLE_WORKER_REBUILD_SECONDS).toBe(30);
    expect(MIRACLE_WORKER_REVIVAL_HEALTH).toBe(30);
    const a = createMiracleWorkerRevivalState(), b = createMiracleWorkerRevivalState();
    expect(a).toEqual({ allowance: 4, used: 0, pendingDeathId: null, records: [] });
    expect(a.records).not.toBe(b.records);
    expect(projectMiracleWorkerRevival(pending())).toMatchObject({ allowance: 4, used: 0, remaining: 4 });
  });

  it('spends no use while waiting and keeps the elapsed game clock across reload', () => {
    const s = pending(), next = submit(s, command(s, 'WAIT_REVIVAL'));
    expect(record(next)).toMatchObject({ elapsedSeconds: 30, waitCount: 1, outcome: 'PENDING' });
    expect(next).toMatchObject({ health: 0, status: 'REVIVAL_PENDING', ending: null, revision: s.revision + 1 });
    expect(next.miracleWorker.revival.used).toBe(0);
    expect(enemyAndDeath(next)).toEqual(enemyAndDeath(s));
    expect(preservedResources(next)).toEqual(preservedResources(s));
    expect(next.miracleWorker.encounter.supplies).toEqual(s.miracleWorker.encounter.supplies);
    const reloaded: SliceState = JSON.parse(JSON.stringify(next));
    const again = submit(reloaded, command(reloaded, 'WAIT_REVIVAL'));
    expect(record(again)).toMatchObject({ elapsedSeconds: 60, waitCount: 2 });
    expect(projectMiracleWorkerRevival(reloaded).current?.remainingSeconds).toBe(90);
    expect(projectMiracleWorkerRevival(again).current?.remainingSeconds).toBe(60);
  });

  it('consumes exactly one use for the same body, restores only H30 and never rewrites PLAYER_DEAD', () => {
    const s = boundary('first-revival').beforeLast, next = revived();
    expect(s.mind).toBeGreaterThan(0); expect(s.spirituality).toBeLessThan(120);
    expect(s.injuries.length).toBeGreaterThan(0); expect(s.injuryRisk).toBeGreaterThan(0);
    expect(next.status).toBe('ACTIVE'); expect(next.health).toBe(30); expect(next.ending).toBeNull();
    expect(next.miracleWorker.revival).toMatchObject({ allowance: 4, used: 1, pendingDeathId: null });
    expect(next.miracleWorker.revival.records).toHaveLength(1);
    expect(record(next)).toMatchObject({ id: record(s).id, bodyId: record(s).bodyId,
      outcome: 'REVIVED', remains: 'RECONSTITUTED', elapsedSeconds: 60, waitCount: 1,
      resolvedRevision: next.revision, healthAfter: 30, returnAt: MIRACLE_WORKER_REBUILD_POINT });
    expect(preservedResources(next)).toEqual(preservedResources(s));
    expect(enemyAndDeath(next)).toEqual(enemyAndDeath(s));
    expect(next.miracleWorker.encounter.supplies).toEqual(s.miracleWorker.encounter.supplies);
    expect(next.miracleWorker.encounter).toMatchObject({ status: 'REVIVED', location: MIRACLE_WORKER_SITE,
      originalsRecoveredRevision: null, leftRevision: null, recoverySeconds: 0, exitWalkSeconds: 0,
      revivalReceipt: { deathHistoryIndex: record(s).sourceHistoryIndex, revivalId: record(s).id, revivedRevision: next.revision } });
    expect(projectMiracleWorkerRevival(next)).toMatchObject({ used: 1, remaining: 3, pending: false,
      bodyLocation: MIRACLE_WORKER_REBUILD_POINT, current: null, actions: [] });
  });

  it('requires a separate original-item pickup and an ordinary timed exit without replenishing anything', () => {
    const s = revived(), picked = boundary('real-originals-recovered').final;
    const exited = boundary('ordinary-exit').final;
    expect(picked.miracleWorker.encounter).toMatchObject({ originalsRecoveredRevision: picked.revision,
      recoverySeconds: 10, leftRevision: null, location: MIRACLE_WORKER_SITE });
    expect(picked.miracleWorker.encounter.supplies).toEqual({ ...s.miracleWorker.encounter.supplies, clubHeld: true });
    expect(exited.miracleWorker.encounter).toMatchObject({ location: MIRACLE_WORKER_EXIT,
      leftRevision: exited.revision, recoverySeconds: 10, exitWalkSeconds: 30 });
    expect(exited.miracleWorker.encounter.supplies).toEqual(picked.miracleWorker.encounter.supplies);
    for (const next of [picked, exited]) {
      expect(next.health).toBe(30);
      expect(next.miracleWorker.revival).toEqual(s.miracleWorker.revival);
      expect(preservedResources(next)).toEqual(preservedResources(s));
      expect(enemyAndDeath(next)).toEqual(enemyAndDeath(s));
    }
    expect(projectMiracleWorkerRevival(picked).bodyLocation).toBe(MIRACLE_WORKER_SITE);
    expect(projectMiracleWorkerRevival(exited).bodyLocation).toBe(MIRACLE_WORKER_EXIT);
    for (const state of [picked, exited]) expect(() => applySliceIntent(state,
      { type: 'MIRACLE_WORKER', command: { type: 'ENCOUNTER_RECOVER_ORIGINALS' } })).toThrow();
    expect(() => applySliceIntent(exited, { type: 'MIRACLE_WORKER', command: { type: 'ENCOUNTER_FIGHT' } })).toThrow();
    expect(() => applySliceIntent(exited, { type: 'MIRACLE_WORKER', command: { type: 'ENCOUNTER_LEAVE' } })).toThrow();
  });

  it('allows ordinary departure without pickup and leaves those same unspent originals at the corpse site', () => {
    const s = revived(), next = applySliceIntent(s, { type: 'MIRACLE_WORKER', command: { type: 'ENCOUNTER_LEAVE' } });
    expect(() => assertValidSliceState(next)).not.toThrow();
    expect(next.miracleWorker.encounter).toMatchObject({ location: MIRACLE_WORKER_EXIT,
      originalsRecoveredRevision: null, recoverySeconds: 0, exitWalkSeconds: 30 });
    expect(next.miracleWorker.encounter.supplies).toEqual(s.miracleWorker.encounter.supplies);
    expect(next.miracleWorker.encounter.supplies.clubHeld).toBe(false);
    expect(enemyAndDeath(next)).toEqual(enemyAndDeath(s));
    expect(preservedResources(next)).toEqual(preservedResources(s));
  });

  it('can finish the 30-second rebuild exactly at120 seconds, but four waits cause final expiry', () => {
    const at90 = boundary('expiry-wait-3').final;
    expect(record(at90)).toMatchObject({ elapsedSeconds: 90, waitCount: 3, outcome: 'PENDING' });
    expect(projectMiracleWorkerRevival(at90).current).toMatchObject({ remainingSeconds: 30, canCompleteInTime: true });
    const at120 = submit(at90, command(at90, 'REVIVE_NEARBY'));
    expect(() => assertValidSliceState(at120)).not.toThrow();
    expect(record(at120)).toMatchObject({ elapsedSeconds: 120, waitCount: 3, outcome: 'REVIVED' });
    expect(at120.miracleWorker.revival.used).toBe(1);
    const expired = boundary('expiry-wait-4').final;
    expect(expired.status).toBe('DEAD'); expect(expired.health).toBe(0);
    expect(record(expired)).toMatchObject({ elapsedSeconds: 120, waitCount: 4, outcome: 'EXPIRED' });
    expect(expired.miracleWorker.revival.used).toBe(0);
    expect(() => submit(expired, command(expired, 'REVIVE_NEARBY'))).toThrow();
  });

  it.each(['forfeit', 'expiry-wait-4'] as const)('%s leaves a sealed final death without spending a use or resetting the foe', key => {
    const s = pending(), final = boundary(key).final;
    expect(final).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } });
    expect(final.miracleWorker.revival).toMatchObject({ allowance: 4, used: 0, pendingDeathId: null });
    expect(record(final)).toMatchObject({ remains: 'FINAL', returnAt: null, healthAfter: null });
    expect(final.miracleWorker.encounter).toMatchObject({ status: 'LOST', revivalReceipt: null,
      originalsRecoveredRevision: null, leftRevision: null, location: MIRACLE_WORKER_SITE });
    expect(enemyAndDeath(final)).toEqual(enemyAndDeath(s));
    expect(preservedResources(final)).toEqual(preservedResources(s));
    expect(final.miracleWorker.encounter.supplies).toEqual(s.miracleWorker.encounter.supplies);
    expect(projectMiracleWorkerRevival(final).actions).toEqual([]);
    for (const type of ['REVIVE_NEARBY', 'WAIT_REVIVAL', 'FORFEIT_REVIVAL'] as const) {
      expect(blockMiracleWorkerRevival(final, command(final, type))).not.toBeNull();
      expect(() => submit(final, command(final, type))).toThrow();
    }
    expect(() => openMiracleWorkerRevival(structuredClone(final), noRandomContext())).toThrow();
  });
});

describe('Miracle Worker pending public gate, exact command identity and UI projection', () => {
  const blocked: SliceIntent[] = [
    { type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'REST' },
    { type: 'SET_LIFESTYLE', tier: 'DESTITUTE' }, { type: 'REPAY', amount: 1 },
    { type: 'CANCEL_AID' }, { type: 'CONTINUE_LIFE' },
    { type: 'EVENT_CHOICE', eventInstanceId: 'not-the-death', choiceId: 'LEAVE' },
    { type: 'COMBAT_ROUND', stance: 'RETREAT' },
    { type: 'ANCIENT_SCHOLAR', command: { type: 'REST' } },
    { type: 'LONG_CHAPTER', command: { type: 'AWAIT_REVIVAL' } },
    { type: 'MIRACLE_WORKER', command: { type: 'WORK' } },
    { type: 'MIRACLE_WORKER', command: { type: 'REST' } },
    { type: 'MIRACLE_WORKER', command: { type: 'NEXT_WEEK' } },
    { type: 'MIRACLE_WORKER', command: { type: 'LEARN_FORMULA' } },
    { type: 'MIRACLE_WORKER', command: { type: 'REFLECT' } },
    { type: 'MIRACLE_WORKER', command: { type: 'ENCOUNTER_RECOVER_ORIGINALS' } },
    { type: 'MIRACLE_WORKER', command: { type: 'ENCOUNTER_LEAVE' } },
    { type: 'MIRACLE_WORKER', command: { type: 'ENCOUNTER_FIGHT' } },
  ];
  it.each(blocked.map(intent => [JSON.stringify(intent), intent] as const))('globally blocks %s before any other dispatcher', (_label, intent) => {
    const s = pending(), before = structuredClone(s);
    expect(() => applySliceIntent(s, intent)).toThrow('当前只可');
    expect(s).toEqual(before);
  });

  it('offers exactly the three live pending choices with the actual death id and confirmation fields', () => {
    const s = pending(), before = structuredClone(s), p = projectSliceState(s).miracleWorker;
    const commands = p.revival.actions.map(a => a.command);
    expect(commands).toEqual(['REVIVE_NEARBY', 'WAIT_REVIVAL', 'FORFEIT_REVIVAL'].map(type => command(s, type as MiracleWorkerRevivalCommand['type'])));
    expect(p.revival.actions.every(a => a.enabled && a.reason === null)).toBe(true);
    expect(p.actions.filter(a => a.enabled).map(a => a.command)).toEqual(commands);
    expect(p.revival.current).toMatchObject({ deathId: record(s).id, bodyId: `${s.runId}:body`,
      deathHistoryIndex: record(s).sourceHistoryIndex, deathRevision: s.revision,
      elapsedSeconds: 0, remainingSeconds: 120, reconstructionSeconds: 30, healthAfter: 30,
      mindAfter: s.mind, spiritualityAfter: s.spirituality, existingInjuries: s.injuries.length,
      existingRisk: s.injuryRisk, canCompleteInTime: true });
    expect(p.revival.bodyLocation).toBe(MIRACLE_WORKER_SITE);
    expect(p.revival.source).toContain('4'); expect(MIRACLE_WORKER_REVIVAL_BOUNDARY).toContain('G');
    expect(p.revival.boundary).toBe(playerText(MIRACLE_WORKER_REVIVAL_BOUNDARY)); expect(p.revival.boundary).not.toContain('G');
    for (const text of ['120秒完成窗口', '30秒重组', '1米距离与健康30', '精神/灵性不补', '旧伤、污染、累计风险及真实消耗保留', '不重抽死亡盘', '不改赢原战斗', '不重开敌人', '不从工作台或远处库存取物']) expect(p.revival.boundary).toContain(text);
    expect(p.revival.supportedScope).toContain('其他已开放遭遇尚未接入');
    expect(s).toEqual(before);
  });

  it.each(['REVIVE_NEARBY', 'WAIT_REVIVAL', 'FORFEIT_REVIVAL'] as const)('rejects stale and repeated %s death ids without changing the state', type => {
    const s = pending(), stale = { ...command(s, type), deathId: `${record(s).id}:stale` };
    expect(blockMiracleWorkerRevival(s, stale)).not.toBeNull();
    expect(() => submit(s, stale)).toThrow();
    const resolved = revived(), before = structuredClone(resolved);
    expect(() => submit(resolved, command(resolved, type))).toThrow();
    expect(resolved).toEqual(before);
  });

  it('rejects unconfirmed commands, foreign body/location inputs, synthetic quantities and unknown keys', () => {
    const s = pending(), deathId = record(s).id;
    for (const type of ['REVIVE_NEARBY', 'FORFEIT_REVIVAL'] as const) {
      expect(validateMiracleWorkerRevivalCommand({ type, deathId, confirmed: true })).toBe(true);
      expect(validateMiracleWorkerRevivalCommand({ type, deathId })).toBe(false);
      expect(validateMiracleWorkerRevivalCommand({ type, deathId, confirmed: false })).toBe(false);
    }
    expect(validateMiracleWorkerRevivalCommand({ type: 'WAIT_REVIVAL', deathId })).toBe(true);
    const malformed: unknown[] = [null, [], {}, { type: 'REVIVE' },
      { type: 'WAIT_REVIVAL', deathId, confirmed: true },
      { type: 'WAIT_REVIVAL', deathId: '' }, { type: 'WAIT_REVIVAL', deathId: 'x'.repeat(261) },
      { type: 'REVIVE_NEARBY', deathId, confirmed: true, health: 100 },
      { type: 'REVIVE_NEARBY', deathId, confirmed: true, bodyId: 'new-body' },
      { type: 'REVIVE_NEARBY', deathId, confirmed: true, at: MIRACLE_WORKER_EXIT },
      { type: 'FORFEIT_REVIVAL', deathId, confirmed: true, refund: 1 }];
    for (const value of malformed) {
      expect(validateMiracleWorkerRevivalCommand(value)).toBe(false);
      expect(() => applySliceIntent(s, { type: 'MIRACLE_WORKER', command: value as never })).toThrow();
    }
  });

  it('cannot open from a forged H0 snapshot, a persisted pending source or an old ordinary DEAD run', () => {
    const zeroOnly = structuredClone(boundary('directed-real-death').beforeLast);
    zeroOnly.health = 0;
    const oldDead = structuredClone(boundary('forfeit').final);
    // Negative malformed-state probe, not a fabricated successful death fixture.
    oldDead.miracleWorker.revival = createMiracleWorkerRevivalState();
    for (const s of [zeroOnly, pending(), oldDead]) {
      const before = structuredClone(s), ctx = noRandomContext();
      expect(() => openMiracleWorkerRevival(s, ctx)).toThrow();
      expect(s).toEqual(before); expect(ctx.roll).not.toHaveBeenCalled(); expect(ctx.check).not.toHaveBeenCalled();
    }
  });
});

const invalidPending: [string, (s: SliceState) => void][] = [
  ['changed allowance', s => { s.miracleWorker.revival.allowance = 5 as 4; }],
  ['negative uses', s => { s.miracleWorker.revival.used = -1; }],
  ['more than four uses', s => { s.miracleWorker.revival.used = 5; }],
  ['invented exhausted ledger', s => { s.miracleWorker.revival.used = 4; }],
  ['use without completed revival', s => { s.miracleWorker.revival.used = 1; }],
  ['duplicate same-death record', s => { s.miracleWorker.revival.records.push(structuredClone(record(s))); }],
  ['unbound pending id', s => { s.miracleWorker.revival.pendingDeathId = null; }],
  ['stale pending id', s => { s.miracleWorker.revival.pendingDeathId += ':stale'; }],
  ['forged body', s => { record(s).bodyId = 'replacement-body'; }],
  ['foreign encounter', s => { record(s).sourceEncounterId = 'ANCIENT_SCHOLAR_DISPUTE' as never; }],
  ['old source history', s => { record(s).sourceHistoryIndex--; }],
  ['stale death revision', s => { record(s).deathRevision--; }],
  ['foreign return point', s => { record(s).returnAt = MIRACLE_WORKER_EXIT as never; }],
  ['health before reconstruction', s => { record(s).healthAfter = 30; }],
  ['invented remains', s => { record(s).remains = 'RECONSTITUTED'; }],
  ['deadline extended', s => { record(s).deadlineSeconds = 121 as 120; }],
  ['clock not backed by wait count', s => { record(s).elapsedSeconds = 30; }],
  ['nonfinite clock', s => { record(s).elapsedSeconds = Number.NaN; }],
  ['wait not backed by clock', s => { record(s).waitCount = 1; }],
  ['pending mind changed', s => { s.mind--; }],
  ['pending spirit refilled', s => { s.spirituality = 120; }],
  ['old injury removed', s => { s.injuries.pop(); }],
  ['risk cleared', s => { s.injuryRisk = 0; }],
  ['record mind diverges from death', s => { record(s).deathMind--; }],
  ['record spirit diverges from death', s => { record(s).deathSpirituality--; }],
  ['record injuries diverge from death', s => { record(s).deathInjuries = []; }],
  ['record risk diverges from death', s => { record(s).deathRisk++; }],
  ['unknown record key', s => { Object.assign(record(s), { borrowedFromSefirahCastle: 3 }); }],
  ['health restored while pending', s => { s.health = 30; }],
  ['ordinary active status bypass', s => { s.status = 'ACTIVE'; }],
  ['new week while pending', s => { s.week++; }],
  ['concurrent combat', s => { s.combat = structuredClone(boundary('directed-real-death').beforeLast.combat); }],
  ['enemy spirit replenished', s => { s.miracleWorker.encounter.enemySpirituality = 120; }],
  ['terminal enemy spirit changed', s => { s.miracleWorker.encounter.terminal!.enemySpirituality = 120; }],
  ['terminal originals teleported', s => { s.miracleWorker.encounter.terminal!.playerOriginalsAt = 'WITH_PLAYER'; }],
  ['terminal enemy weapon stolen', s => { s.miracleWorker.encounter.terminal!.enemyWeaponAt = MIRACLE_WORKER_SITE; }],
  ['terminal death rewritten', s => { s.miracleWorker.encounter.terminal!.outcome = 'RETREATED'; }],
  ['missing original death outcome', s => { delete s.combatHistory[record(s).sourceHistoryIndex]!.miracleWorkerOutcome; }],
  ['unproven earlier source revision', s => { s.combatHistory[record(s).sourceHistoryIndex]!.miracleWorkerOutcome!.source.revision--; }],
  ['nonzero health in actual source', s => { s.combatHistory[record(s).sourceHistoryIndex]!.miracleWorkerOutcome!.playerHealthAfter = 1; }],
];

describe('Miracle Worker revival record integrity and rejected replay mutations', () => {
  it.each(invalidPending)('rejects %s', (_label, mutate) => {
    const bad = pending(); mutate(bad);
    expect(validateMiracleWorkerRevivalState(bad)).toBe(false);
    expect(() => assertValidSliceState(bad)).toThrow();
    const c: MiracleWorkerRevivalCommand = { type: 'REVIVE_NEARBY', deathId: record(bad).id, confirmed: true };
    expect(blockMiracleWorkerRevival(bad, c)).not.toBeNull();
    expect(() => submit(bad, c)).toThrow();
  });

  it('rejects a revived ledger reset, double-spend, duplicate source or fabricated second body', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.miracleWorker.revival.used = 0; },
      s => { s.miracleWorker.revival.used = 2; },
      s => { s.miracleWorker.revival = createMiracleWorkerRevivalState(); },
      s => { s.miracleWorker.revival.records.push(structuredClone(record(s))); },
      s => { record(s).remains = 'PRESENT'; },
      s => { record(s).bodyId += ':second'; },
      s => { record(s).resolvedRevision = record(s).resolvedRevision! - 1; },
      s => { s.miracleWorker.encounter.revivalReceipt!.deathHistoryIndex--; },
      s => { s.miracleWorker.encounter.revivalReceipt!.revivalId += ':other'; },
      s => { s.health = 100; }, s => { s.spirituality = 120; }, s => { s.injuries = []; },
    ];
    for (const mutate of mutations) {
      const bad = revived(); mutate(bad);
      expect(validateMiracleWorkerRevivalState(bad)).toBe(false);
      expect(() => assertValidSliceState(bad)).toThrow();
    }
  });

  it('rejects a saved H0 death whose copied source roll actually selects a nonlethal light injury at H100', () => {
    const bad = pending(), source = bad.combatHistory[record(bad).sourceHistoryIndex]!;
    expect(source.miracleWorkerOutcome!.playerHealthBeforeConsequence).toBe(100);
    expect(source.consequenceWeights!.light).toBeGreaterThanOrEqual(1);
    // Deliberately corrupt BOTH saved copies, so equality with lastCombatRound
    // cannot mask missing causal validation of the real shared outcome wheel.
    source.consequenceRoll = 1;
    bad.lastCombatRound = structuredClone(source);
    expect(validateMiracleWorkerRevivalState(bad)).toBe(false);
    expect(() => assertValidSliceState(bad)).toThrow();
    expect(() => submit(bad, command(bad, 'REVIVE_NEARBY'))).toThrow();
  });

  it('rejects revival-receipt-only forgery without a matching single-use ledger', () => {
    const bad = pending();
    bad.miracleWorker.encounter.revivalReceipt = { deathHistoryIndex: record(bad).sourceHistoryIndex,
      revivedRevision: bad.revision, revivalId: record(bad).id };
    expect(validateMiracleWorkerEncounter(bad)).toBe(false);
    expect(validateMiracleWorkerRevivalState(bad)).toBe(false);
    expect(() => assertValidSliceState(bad)).toThrow();
  });
});
