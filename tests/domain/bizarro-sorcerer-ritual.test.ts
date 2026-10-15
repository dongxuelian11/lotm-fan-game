import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { BIZARRO_WITNESS_IDS, bizarroRitualCommandReason, canConsumeBizarroFinale, consumeBizarroFinale,
  createBizarroRitualState, dismissBizarroWitnesses, handleBizarroRitualCommand, hasBizarroRitualLock,
  hasBizarroRitualOpponent, projectBizarroRitual, settleBizarroRitual, validateBizarroRitualCommand,
  validateBizarroRitualState, type BizarroRitualCommand } from '../../src/domain/bizarro-sorcerer/ritual.js';
import type { SliceState } from '../../src/domain/slice/types.js';

/** Bounded domain fixture, DIRECTED_RANDOM_NOT_NATURAL. No production seed,
 * resources, canon quantities or guaranteed natural success are inferred. */
function fixture(): SliceState {
  const s = createSliceRun('bizarro-ritual-test', sliceDefaultCreationSelection, 'bizarro-ritual');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 20;
  s.progression = { pathwayId: 'diviner', sequence: 5, mastery: {}, acting: 100, promotionWeek: 1 };
  s.arc.stage = 'ENDED'; s.world.carrierAlive = false; s.world.carrierCanResist = false;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.cash = 500; s.actionsRemaining = 4;
  s.bizarroSorcerer.ritual = createBizarroRitualState();
  s.bizarroSorcerer.bottles = [{ id: 'bounded-original-bottle', batchId: 'bounded-batch', inputIds: ['1','2','3','4','5','6','7'],
    brewedWeek: 19, status: 'PREPARED', outcome: null, consumedWeek: null, ritualAttemptId: null }];
  return s;
}
function command(s: SliceState, c: BizarroRitualCommand) { const out = handleBizarroRitualCommand(s, c); expect(out.error).toBeUndefined(); return out; }
function assemble(s = fixture(), targetId = 'B4-COPPER-BELL-A') {
  command(s, { type: 'SURVEY_RITUAL', targetId }); command(s, { type: 'PREPARE_STAGE' });
  s.week += 1; s.actionsRemaining = 4; command(s, { type: 'GATHER_WITNESSES' });
  s.magician.lantern.prepared = true; s.magician.lantern.oilSpent += 1;
  return s;
}
function start(s = assemble()) { command(s, { type: 'START_RITUAL', bottleId: 'bounded-original-bottle', confirmed: true }); return s; }
function scripted(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const value = rolls[index++];
    if (value === undefined || value < min || value > max) throw new Error(`Unexpected directed draw ${index}: ${value} / ${min}-${max}`); return value;
  });
}
function kill(s: SliceState) {
  scripted(1, 1, 1, 100, 100, 1, 100);
  const result = resolveSliceCombatRound(s, 'ATTACK'); s.combatHistory.push(structuredClone(result.round));
  expect(result.outcome).toBe('ENEMY_DEAD'); settleBizarroRitual(s, result.outcome); vi.restoreAllMocks();
}
afterEach(() => vi.restoreAllMocks());

describe('Bizarro real witnessed ritual and immutable originals', () => {
  it('has exactly three different original bodies/bells/sites and strict typed commands', () => {
    const s = fixture(), r = s.bizarroSorcerer.ritual;
    expect(r.targets).toHaveLength(3); expect(new Set(r.targets.map(t => t.siteId)).size).toBe(3);
    expect(new Set(r.targets.map(t => t.originalBellId)).size).toBe(3);
    expect(r.targets.every(t => t.status === 'UNSURVEYED' && t.terminalBody === null)).toBe(true);
    expect(validateBizarroRitualState(s)).toBe(true);
    expect(validateBizarroRitualCommand({ type: 'START_RITUAL', bottleId: 'x', confirmed: true })).toBe(true);
    expect(validateBizarroRitualCommand({ type: 'START_RITUAL', bottleId: 'x', confirmed: false })).toBe(false);
    expect(validateBizarroRitualCommand({ type: 'CLOSE_RITUAL', actualDeath: true })).toBe(false);
  });
  it('pays real survey/stage costs and cannot count invited adults as arrivals', () => {
    const s = fixture(); command(s, { type: 'SURVEY_RITUAL', targetId: 'B4-COPPER-BELL-A' });
    expect(s.spirituality).toBe(98); expect(s.actionsRemaining).toBe(3);
    command(s, { type: 'PREPARE_STAGE' }); expect(s.cash).toBe(440);
    expect(s.bizarroSorcerer.ritual.witnesses.invitedIds).toHaveLength(36);
    expect(s.bizarroSorcerer.ritual.witnesses.presentIds).toHaveLength(0);
    expect(handleBizarroRitualCommand(s, { type: 'GATHER_WITNESSES' }).error).toContain('下一真实周');
    expect(hasBizarroRitualLock(s)).toBe(false); s.week += 1; s.actionsRemaining = 4;
    command(s, { type: 'GATHER_WITNESSES' }); expect(hasBizarroRitualLock(s)).toBe(true);
    expect(s.bizarroSorcerer.ritual.witnesses.presentIds).toEqual(BIZARRO_WITNESS_IDS);
    expect(validateBizarroRitualState(s)).toBe(true);
  });
  it('starts only with the same original bottle and actual lamp, pays the full show once', () => {
    const s = assemble(); s.magician.lantern.prepared = false; const before = structuredClone(s);
    expect(handleBizarroRitualCommand(s, { type: 'START_RITUAL', bottleId: 'bounded-original-bottle', confirmed: true }).error).toContain('原灯');
    expect(s).toEqual(before); s.magician.lantern.prepared = true;
    expect(handleBizarroRitualCommand(s, { type: 'START_RITUAL', bottleId: 'invented', confirmed: true }).error).toContain('原瓶');
    const sp = s.spirituality; start(s); expect(s.spirituality).toBe(sp - 5);
    expect(s.combat?.enemyHealth).toBe(100); expect(s.bizarroSorcerer.ritual.enemySpirituality).toBe(40);
    expect(s.bizarroSorcerer.ritual.opening).toEqual({ illusionUsed: true, flameJumpUsed: true });
    expect(hasBizarroRitualOpponent(s)).toBe(true); expect(validateBizarroRitualState(s)).toBe(true);
    expect(handleBizarroRitualCommand(s, { type: 'CLOSE_RITUAL' }).error).toContain('战斗');
  });
  it('permits 0AP dispersal before battle, keeping the unchallenged living original', () => {
    const s = assemble(); s.actionsRemaining = 0; command(s, { type: 'CLOSE_RITUAL' });
    expect(s.bizarroSorcerer.ritual.witnesses.presentIds).toHaveLength(0);
    expect(s.bizarroSorcerer.ritual.witnesses.exitedIds).toHaveLength(36);
    expect(s.bizarroSorcerer.ritual.targets[0]?.status).toBe('AVAILABLE');
    expect(s.bizarroSorcerer.ritual.attempts).toHaveLength(0); expect(s.progression.sequence).toBe(5);
  });
  it('opens only actual-death same-scene 0AP finale and consumes that death once', () => {
    const s = start(); s.actionsRemaining = 0; kill(s);
    const r = s.bizarroSorcerer.ritual;
    expect(r.phase).toBe('FINALE'); expect(r.targets[0]?.status).toBe('DEAD');
    expect(r.attempts[0]?.deathWitnessIds).toHaveLength(36);
    expect(canConsumeBizarroFinale(s, 'bounded-original-bottle')).toBe(true);
    expect(canConsumeBizarroFinale(s, 'new-bottle')).toBe(false); expect(validateBizarroRitualState(s)).toBe(true);
    const b = s.bizarroSorcerer.bottles[0]!;
    b.status = 'CONSUMED'; b.outcome = 'FAILURE'; b.consumedWeek = s.week; b.ritualAttemptId = r.attemptId;
    consumeBizarroFinale(s, b.id); expect(r.phase).toBe('CLOSED'); expect(s.progression.sequence).toBe(5);
    expect(canConsumeBizarroFinale(s, b.id)).toBe(false); expect(validateBizarroRitualState(s)).toBe(true);
    expect(r.targets[0]?.terminalBody?.health).toBe(0); expect(r.attempts[0]?.invalidReason).toBeNull();
  });
  it('rejects fake kill flags, duplicated adults, absent history, wrong original and later weeks', () => {
    const valid = start(); kill(valid);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.bizarroSorcerer.ritual.witnesses.presentIds[0] = s.bizarroSorcerer.ritual.witnesses.presentIds[1]!; },
      s => { s.combatHistory[0]!.bizarroOutcome!.enemyHealth = 1; },
      s => { s.bizarroSorcerer.ritual.targets[0]!.terminalBody!.health = 1; },
      s => { s.bizarroSorcerer.ritual.attempts[0]!.opening.illusionUsed = false; },
      s => { s.bizarroSorcerer.ritual.attempts[0]!.playerAttackCount = 0; },
      s => { s.combatHistory = []; }, s => { s.week += 1; },
    ];
    for (const mutate of mutations) { const s = structuredClone(valid); mutate(s); expect(canConsumeBizarroFinale(s, 'bounded-original-bottle')).toBe(false); expect(validateBizarroRitualState(s)).toBe(false); }
  });
  it('accepts exact original kill evidence after a SQLite-style sorted-key JSON round trip', () => {
    const s = start(); kill(s);
    const order = (value: unknown): unknown => Array.isArray(value) ? value.map(order)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, order(v)])) : value;
    const restored = JSON.parse(JSON.stringify(order(s))) as SliceState;
    expect(validateBizarroRitualState(restored)).toBe(true);
    expect(canConsumeBizarroFinale(restored, 'bounded-original-bottle')).toBe(true);
    (restored.bizarroSorcerer.ritual.killEvidence as unknown as Record<string, unknown>).invented = true;
    expect(validateBizarroRitualState(restored)).toBe(false);
  });
  it('does not make later murder a witness when the original audience actually exited', () => {
    const s = start(); s.bizarroSorcerer.ritual.witnesses.viewObstructed = true;
    dismissBizarroWitnesses(s, '实际原布幕遮断看台'); kill(s);
    expect(s.bizarroSorcerer.ritual.phase).toBe('CLOSED'); expect(s.bizarroSorcerer.ritual.attempts[0]?.deathWitnessIds).toEqual([]);
    expect(canConsumeBizarroFinale(s, 'bounded-original-bottle')).toBe(false);
    expect(validateBizarroRitualState(s)).toBe(true);
  });
  it('abandons the finale at 0AP, never reopening it with a new bottle', () => {
    const s = start(); kill(s); s.actionsRemaining = 0; command(s, { type: 'CLOSE_RITUAL' });
    expect(s.bizarroSorcerer.bottles[0]?.status).toBe('PREPARED');
    expect(canConsumeBizarroFinale(s, 'bounded-original-bottle')).toBe(false);
    expect(validateBizarroRitualState(s)).toBe(true);
  });
  it('requires new actual targets, then next-week unverified leads and separate paid survey', () => {
    const s = fixture();
    for (const letter of ['A', 'B', 'C']) {
      assemble(s, `B4-COPPER-BELL-${letter}`); start(s); kill(s); command(s, { type: 'CLOSE_RITUAL' });
      s.week += 1; s.actionsRemaining = 4; s.cash += 60; s.spirituality = 100;
    }
    const originals = structuredClone(s.bizarroSorcerer.ritual.targets);
    expect(handleBizarroRitualCommand(s, { type: 'SURVEY_RITUAL', targetId: originals[0]!.id }).error).toContain('不可再挑战');
    command(s, { type: 'REQUEST_NEW_LEAD' });
    expect(handleBizarroRitualCommand(s, { type: 'RECEIVE_LEAD' }).error).toContain('下一真实周');
    s.week += 1; s.actionsRemaining = 0; command(s, { type: 'RECEIVE_LEAD' });
    const r = s.bizarroSorcerer.ritual; expect(r.targets).toHaveLength(3); expect(r.pendingLead).not.toBeNull();
    expect(r.targets).toEqual(originals); s.actionsRemaining = 1; const sp = s.spirituality;
    command(s, { type: 'SURVEY_RITUAL', targetId: r.pendingLead!.targetId });
    expect(r.targets).toHaveLength(4); expect(r.targets.slice(0, 3)).toEqual(originals);
    expect(s.spirituality).toBe(sp - 2); expect(r.pendingLead).toBeNull(); expect(validateBizarroRitualState(s)).toBe(true);
  });
  it('postpromotion challenge is optional and requires new surveyed original without bottle or rite', () => {
    const s = fixture(); s.progression.sequence = 4; s.bizarroSorcerer.bottles = [];
    expect(bizarroRitualCommandReason(s, { type: 'START_CHALLENGE', targetId: 'B4-COPPER-BELL-B', confirmed: true })).toContain('现场核实');
    command(s, { type: 'SURVEY_RITUAL', targetId: 'B4-COPPER-BELL-B' });
    command(s, { type: 'START_CHALLENGE', targetId: 'B4-COPPER-BELL-B', confirmed: true }); kill(s);
    expect(s.bizarroSorcerer.ritual.mode).toBe('CHALLENGE'); expect(s.bizarroSorcerer.ritual.phase).toBe('CLOSED');
    expect(s.bizarroSorcerer.ritual.attempts[0]?.bottleId).toBeNull(); expect(validateBizarroRitualState(s)).toBe(true);
  });
  it('publishes actual supplies and hides encounter facts before this route is available', () => {
    const s = assemble(); expect(projectBizarroRitual(s).equipment).toContain('原纸人');
    s.progression.sequence = 8; expect(projectBizarroRitual(s).targets).toEqual([]); expect(projectBizarroRitual(s).actions).toEqual([]);
  });
});
