import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { createMagicianState } from '../../src/domain/magician/index.js';
import {
  applyMagicianPractice, isMagicianActivity, magicianActions, magicianPractices,
  settleMagicianEncounter, validateMagicianPractice,
} from '../../src/domain/magician/practice.js';
import { MAGICIAN_ABILITY_IDS, type MagicianActivityCommand } from '../../src/domain/magician/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const IDS = ['lamplit-step', 'air-target', 'consenting-audience', 'shallow-water', 'loose-rope', 'paper-weapon'];

function state(): SliceState {
  const s = createSliceRun('magician-practice', sliceDefaultCreationSelection, 'magician-practice-seed');
  s.magician = createMagicianState(); s.magician.promotionWeek = 20;
  s.activeEvent = null; s.eventQueue = []; s.week = 20; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.progression.pathwayId = 'diviner'; s.progression.sequence = 7; s.progression.acting = 0;
  s.progression.mastery = Object.fromEntries(MAGICIAN_ABILITY_IDS.map(id => [id, 0]));
  s.cash = 200; s.health = 80; s.mind = 100; s.spirituality = 60;
  s.clown.paperStock = 20; s.clown.paperSheets = 10; s.clown.paperSpent = 0;
  return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery['diviner.s7.air-bullet']! += amount;
  });
  return { c, award };
}
function apply(s: SliceState, command: MagicianActivityCommand, roll = 1) {
  const ctx = context(s, roll); applyMagicianPractice(s, command, ctx.c, ctx.award); return ctx;
}
function reject(s: SliceState, command: MagicianActivityCommand) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyMagicianPractice(s, command, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function light(s: SliceState) { apply(s, { type: 'BUY_OIL' }); apply(s, { type: 'PREPARE_LANTERN' }); }
function onePractice(s = state()) { apply(s, { type: 'PRACTICE', practiceId: 'air-target' }); return s; }
function allPractices(s = state()) {
  light(s); for (const practiceId of IDS) apply(s, { type: 'PRACTICE', practiceId }); return s;
}
function round(retreat: SliceCombatRound['retreat'] = 'NONE', effective = true): SliceCombatRound {
  return { round: 1, stance: retreat === 'NONE' ? 'ATTACK' : 'RETREAT', first: 'PLAYER',
    playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'PLAYER', label: '实际空气弹', selfGain: effective ? 30 : 0, enemyReduction: 0 }],
    playerAdvantage: effective ? 30 : 0, enemyAdvantage: 0, winChance: 65,
    winner: retreat === 'NONE' ? 'PLAYER' : 'ENEMY', consequence: '实际结果', consequenceWeights: null, retreat };
}

describe('Magician finite actual-source activities', () => {
  it('separates activities from acquisition and exposes only exact diviner S7 actions', () => {
    for (const type of ['BUY_OIL', 'PREPARE_LANTERN', 'PREPARE_FIGURINE', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT'] as const) expect(isMagicianActivity({ type })).toBe(true);
    expect(isMagicianActivity({ type: 'LEARN_FORMULA' })).toBe(false);
    const s = state(); expect(magicianPractices(s)).toHaveLength(7);
    for (const mutate of [(v: SliceState) => { v.progression.sequence = 8; }, (v: SliceState) => { v.progression.pathwayId = 'hunter'; }]) {
      const v = structuredClone(s); mutate(v);
      expect(magicianActions(v)).toEqual([]); expect(magicianPractices(v)).toEqual([]);
      reject(v, { type: 'BUY_OIL' });
    }
  });

  it('blocks unavailable contexts and absent resources before any mutation', () => {
    for (const mutate of [
      (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.mind = 0; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.actionsRemaining = 0; },
      (s: SliceState) => { s.spirituality = 0; },
    ]) { const s = state(); mutate(s); reject(s, { type: 'PRACTICE', practiceId: 'air-target' }); }
    const s = state(); reject(s, { type: 'PRACTICE', practiceId: 'unknown' });
    reject(s, { type: 'PREPARE_LANTERN' }); reject(s, { type: 'PRACTICE', practiceId: 'lamplit-step' });
    s.clown.paperSheets = 0;
    reject(s, { type: 'PREPARE_FIGURINE' }); reject(s, { type: 'PRACTICE', practiceId: 'paper-weapon' });
  });

  it('purchases actual finite oil for 12 pence and prepares it without spending AP', () => {
    const s = state(), ap = s.actionsRemaining; apply(s, { type: 'BUY_OIL' });
    expect([s.cash, s.actionsRemaining, s.magician.lantern.oilStock, s.magician.lantern.oilHeld]).toEqual([188, ap, 5, 1]);
    expect(s.magician.lantern.prepared).toBe(false);
    apply(s, { type: 'PREPARE_LANTERN' });
    expect([s.actionsRemaining, s.magician.lantern.oilHeld, s.magician.lantern.oilSpent, s.magician.lantern.prepared]).toEqual([ap, 0, 1, true]);
    reject(s, { type: 'PREPARE_LANTERN' }); expect(validateMagicianPractice(s)).toBe(true);
  });

  it('keeps failed preparation costs and replenishes oil only after an actual new week', () => {
    const s = state();
    for (let n = 0; n < 6; n++) apply(s, { type: 'BUY_OIL' });
    expect(s.magician.lantern.oilStock).toBe(0); reject(s, { type: 'BUY_OIL' });
    const before = s.cash; s.week++;
    apply(s, { type: 'BUY_OIL' });
    expect([s.cash, s.magician.lantern.oilStock, s.magician.lantern.oilHeld, s.magician.lantern.deliveries, s.magician.lantern.lastSupplyWeek]).toEqual([before - 12, 5, 7, 1, s.week]);
    expect(validateMagicianPractice(s)).toBe(true);
  });

  it('spends one shared sheet and one AP for each real prepared figure, without growth', () => {
    const s = state(), old = structuredClone(s), ctx = apply(s, { type: 'PREPARE_FIGURINE' });
    expect([s.clown.paperSheets, s.clown.paperSpent, s.actionsRemaining]).toEqual([9, 1, 39]);
    expect([s.magician.figurinesMade, s.magician.figurinesHeld, s.magician.figurinesUsed]).toEqual([1, 1, 0]);
    expect(s.progression).toEqual(old.progression); expect(s.spirituality).toBe(old.spirituality);
    expect(ctx.award).not.toHaveBeenCalled(); expect(ctx.c.check).not.toHaveBeenCalled();
    expect(validateMagicianPractice(s)).toBe(true);
  });

  it('runs six distinct one-AP D14 scenes with 72 finite acting and no invented wound', () => {
    const s = state(); light(s); const oldHealth = s.health;
    for (const practiceId of IDS) {
      const before = s.actionsRemaining, ctx = apply(s, { type: 'PRACTICE', practiceId });
      expect(s.actionsRemaining).toBe(before - 1); expect(ctx.c.check).toHaveBeenCalledTimes(1);
      expect(ctx.c.check).toHaveBeenCalledWith(expect.any(String), 14);
      reject(s, { type: 'PRACTICE', practiceId }); expect(validateMagicianPractice(s)).toBe(true);
    }
    expect(s.progression.acting).toBe(72); expect(s.spirituality).toBe(46);
    expect(s.injuries).toEqual([]); expect(s.health).toBe(oldHealth);
    expect([s.clown.paperSheets, s.clown.paperSpent]).toEqual([9, 1]);
    expect(s.magician.lantern.prepared).toBe(false);
    expect(magicianActions(s).filter(a => a.command.type === 'PRACTICE')).toHaveLength(0);
  });

  it('retains actual failed paper consumption and permits only a later-week retry', () => {
    const s = state(), ctx = apply(s, { type: 'PRACTICE', practiceId: 'paper-weapon' }, 100);
    expect([s.actionsRemaining, s.spirituality, s.clown.paperSheets, s.clown.paperSpent, s.progression.acting]).toEqual([39, 59, 9, 1, 0]);
    expect(ctx.award).not.toHaveBeenCalled(); expect(s.magician.practices).toEqual([]);
    expect(s.magician.practiceAttempts['paper-weapon']).toBe(20);
    expect(magicianPractices(s).find(p => p.id === 'paper-weapon')!.status).toBe('本周未成，下周可重试');
    reject(s, { type: 'PRACTICE', practiceId: 'paper-weapon' });
    s.week++; apply(s, { type: 'PRACTICE', practiceId: 'paper-weapon' });
    expect([s.clown.paperSheets, s.clown.paperSpent, s.progression.acting]).toEqual([8, 2, 12]);
    expect(validateMagicianPractice(s)).toBe(true);
  });

  it('uses two current real lamps and both spell costs, extinguishing even on failure', () => {
    const s = state(); light(s); const ctx = apply(s, { type: 'PRACTICE', practiceId: 'lamplit-step' }, 100);
    expect([s.spirituality, s.magician.lantern.prepared, s.magician.lantern.oilSpent]).toEqual([55, false, 1]);
    expect(ctx.award).not.toHaveBeenCalled(); expect(s.injuries).toEqual([]);
    expect(ctx.c.note).toHaveBeenCalledWith('两盏原灯之间的一步', expect.stringContaining('相距2米'));
    s.week++; reject(s, { type: 'PRACTICE', practiceId: 'lamplit-step' });
    light(s); apply(s, { type: 'PRACTICE', practiceId: 'lamplit-step' });
    expect([s.spirituality, s.magician.lantern.oilSpent, s.magician.lantern.prepared]).toEqual([50, 2, false]);
  });

  it('describes actual water, rope, audience and paper boundaries', () => {
    const p = magicianPractices(state());
    expect(p.find(x => x.id === 'shallow-water')!.story).toContain('水面下1米');
    expect(p.find(x => x.id === 'shallow-water')!.story).toContain('空气管道');
    expect(p.find(x => x.id === 'loose-rope')!.story).toContain('随时解开');
    expect(p.find(x => x.id === 'consenting-audience')!.story).toContain('事先同意');
    expect(p.find(x => x.id === 'paper-weapon')!.story).toContain('实际持有');
  });

  it('transfers an actual own heavy injury once with the same ID and no healing', () => {
    const s = state(); s.injuries = [{ id: 'real-heavy', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 3 }]; s.injuryRisk = 2;
    const before = structuredClone(s), ctx = apply(s, { type: 'TRANSFER_INJURY', injuryId: 'real-heavy' });
    expect(s.injuries).toEqual([{ ...before.injuries[0]!, severity: 'LIGHT' }]);
    expect([s.health, s.injuryRisk, s.spirituality, s.actionsRemaining, s.progression.acting]).toEqual([before.health, 2, 57, 39, 0]);
    expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).toHaveBeenCalledExactlyOnceWith('magician-damage-transfer', 8);
    expect(s.magician.damageTransfers).toEqual(['real-heavy']);
    reject(s, { type: 'TRANSFER_INJURY', injuryId: 'real-heavy' });
    s.injuries = []; expect(validateMagicianPractice(s)).toBe(true);
  });

  it('cannot manufacture a wound, use a light wound or award the same growth for later wounds', () => {
    const s = state(); reject(s, { type: 'TRANSFER_INJURY', injuryId: 'invented' });
    s.injuries = [{ id: 'light', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }];
    reject(s, { type: 'TRANSFER_INJURY', injuryId: 'light' });
    s.injuries[0]!.severity = 'HEAVY'; apply(s, { type: 'TRANSFER_INJURY', injuryId: 'light' });
    s.injuries.push({ id: 'another-real-injury', severity: 'HEAVY', acquiredRevision: 2, treatedRevision: null });
    const ctx = apply(s, { type: 'TRANSFER_INJURY', injuryId: 'another-real-injury' });
    expect(ctx.award).not.toHaveBeenCalled(); expect(s.magician.damageTransfers).toHaveLength(2);
    s.injuries[0]!.severity = 'HEAVY'; reject(s, { type: 'TRANSFER_INJURY', injuryId: 'light' });
  });
});

describe('Magician original street dispute and reflection', () => {
  it('requires actual practice, retries failed talk next week and never transfers original property', () => {
    const s = state(); reject(s, { type: 'ENCOUNTER_TALK' }); reject(s, { type: 'ENCOUNTER_FIGHT' }); onePractice(s);
    const cash = s.cash, town = structuredClone(s.town), archive = structuredClone(s.caseArchive);
    apply(s, { type: 'ENCOUNTER_TALK' }, 100); expect(s.magician.encounter.status).toBe('AVAILABLE');
    expect(s.combat).toBeNull(); reject(s, { type: 'ENCOUNTER_TALK' });
    s.week++; apply(s, { type: 'ENCOUNTER_TALK' });
    expect(s.magician.encounter).toEqual({ status: 'RESOLVED', startHistoryIndex: null, attemptWeek: 21 });
    expect(s.progression.acting).toBe(32); expect(s.cash).toBe(cash); expect(s.town).toEqual(town); expect(s.caseArchive).toEqual(archive);
    reject(s, { type: 'ENCOUNTER_FIGHT' }); expect(validateMagicianPractice(s)).toBe(true);
  });

  it('reaches 100 via six scenes, peaceful resolution and one paid reflection without getting wounded', () => {
    const s = allPractices(); reject(s, { type: 'REFLECT' });
    apply(s, { type: 'ENCOUNTER_TALK' }); const before = s.actionsRemaining;
    apply(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.actionsRemaining, s.magician.reflected]).toEqual([100, before - 1, true]);
    expect(s.injuries).toEqual([]); expect(s.magician.damageTransfers).toEqual([]);
    reject(s, { type: 'REFLECT' }); expect(validateMagicianPractice(s)).toBe(true);
  });

  it('starts the ordinary real encounter from the current history boundary and keeps a prepared lamp', () => {
    const s = onePractice(); s.combatHistory.push(round()); light(s);
    apply(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.magician.encounter).toEqual({ status: 'FIGHTING', attemptWeek: 20, startHistoryIndex: 1 });
    expect(s.combat).toEqual({ encounterId: 'MAGICIAN_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null });
    expect(s.magician.lantern.prepared).toBe(true); expect(validateMagicianPractice(s)).toBe(true);
    reject(s, { type: 'PREPARE_FIGURINE' });
    const old = structuredClone(s), ctx = context(s); settleMagicianEncounter(s, 'CONTINUE', ctx.c, ctx.award);
    expect(s).toEqual(old); expect(ctx.award).not.toHaveBeenCalled();
  });

  it('awards effective actual victory once and closes flame readiness without granting loot', () => {
    const s = onePractice(); light(s); apply(s, { type: 'ENCOUNTER_FIGHT' });
    const cash = s.cash; s.combatHistory.push(round()); s.combat!.enemyStatus = 'SURRENDERED';
    const ctx = context(s); settleMagicianEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect([s.magician.encounter.status, s.combat, s.magician.lantern.prepared, s.progression.acting, s.cash]).toEqual(['RESOLVED', null, false, 32, cash]);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('magician-dispute', 25);
    expect(() => settleMagicianEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
    expect(validateMagicianPractice(s)).toBe(true);
  });

  it('does not use an older unrelated combat for this encounter mastery', () => {
    const s = onePractice(); s.combatHistory.push(round()); apply(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push(round('NONE', false)); s.combat!.enemyStatus = 'SURRENDERED';
    const ctx = context(s); settleMagicianEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).not.toHaveBeenCalled(); expect(s.magician.encounter.status).toBe('RESOLVED');
    expect(validateMagicianPractice(s)).toBe(true);
  });

  it.each(['RETREATED', 'PLAYER_DEAD'] as const)('keeps real %s outcomes, consumption and wounds without growth or reflection', outcome => {
    const s = onePractice(); light(s); apply(s, { type: 'PREPARE_FIGURINE' }); apply(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push(round()); s.injuries.push({ id: 'combat-injury', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null });
    const before = structuredClone(s), ctx = context(s); settleMagicianEncounter(s, outcome, ctx.c, ctx.award);
    if (outcome === 'PLAYER_DEAD') s.status = 'DEAD';
    expect(s.magician.encounter.status).toBe(outcome === 'RETREATED' ? 'RETREATED' : 'LOST');
    expect(s.combat).toBeNull(); expect(s.magician.lantern.prepared).toBe(false);
    expect(s.injuries).toEqual(before.injuries); expect(s.clown).toEqual(before.clown);
    expect(s.progression).toEqual(before.progression); expect(ctx.award).not.toHaveBeenCalled();
    reject(s, { type: 'REFLECT' }); reject(s, { type: 'ENCOUNTER_FIGHT' }); expect(validateMagicianPractice(s)).toBe(true);
  });
});

describe('Magician activity save invariants', () => {
  it('accepts fresh inactive activity state and valid completed finite practice', () => {
    const s = state(); expect(validateMagicianPractice(s)).toBe(true);
    s.progression.sequence = 8; s.magician = createMagicianState(); expect(validateMagicianPractice(s)).toBe(true);
    const completed = allPractices(); apply(completed, { type: 'ENCOUNTER_TALK' }); apply(completed, { type: 'REFLECT' });
    expect(validateMagicianPractice(completed)).toBe(true);
  });

  it('rejects phantom sources, repeated completions, impossible histories and copied consumables', () => {
    const good = allPractices();
    for (const mutate of [
      (s: SliceState) => { s.magician.practices.push('invented'); },
      (s: SliceState) => { s.magician.practices.push('air-target'); },
      (s: SliceState) => { delete s.magician.practiceAttempts['air-target']; },
      (s: SliceState) => { s.magician.practiceAttempts['air-target'] = s.week + 1; },
      (s: SliceState) => { s.magician.practiceAttempts['invented'] = s.week; },
      (s: SliceState) => { s.seer.completedSources = s.seer.completedSources.filter(id => id !== 'magician-practice:air-target'); },
      (s: SliceState) => { s.magician.figurinesHeld = 1; },
      (s: SliceState) => { s.magician.figurinesMade = s.magician.figurinesHeld = s.clown.paperSpent + 1; },
      (s: SliceState) => { s.magician.lantern.oilHeld++; },
      (s: SliceState) => { s.magician.encounter.startHistoryIndex = s.combatHistory.length + 1; },
      (s: SliceState) => { s.magician.encounter.status = 'FIGHTING'; },
      (s: SliceState) => { s.seer.completedSources.push('magician-damage-transfer'); },
      (s: SliceState) => { s.seer.completedSources.push('magician-dispute'); },
      (s: SliceState) => { s.magician.reflected = true; },
    ]) { const s = structuredClone(good); mutate(s); expect(validateMagicianPractice(s)).toBe(false); }
  });

  it('rejects a transferred original that remains heavy, but allows a later normally healed record to disappear', () => {
    const s = state(); s.magician.damageTransfers = ['heavy'];
    s.injuries = [{ id: 'heavy', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    expect(validateMagicianPractice(s)).toBe(false); s.injuries[0]!.severity = 'LIGHT';
    expect(validateMagicianPractice(s)).toBe(true); s.injuries = []; expect(validateMagicianPractice(s)).toBe(true);
    s.magician.damageTransfers.push('heavy'); expect(validateMagicianPractice(s)).toBe(false);
  });
});
