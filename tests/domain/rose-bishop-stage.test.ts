import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applySecretSupplicantCommand } from '../../src/domain/secret-supplicant/index.js';
import { SECRET_SUPPLICANT_ABILITY_IDS } from '../../src/domain/secret-supplicant/types.js';
import { applyListenerCommand } from '../../src/domain/listener/index.js';
import { LISTENER_ABILITY_IDS } from '../../src/domain/listener/types.js';
import { applyShadowAsceticCommand } from '../../src/domain/shadow-ascetic/index.js';
import { SHADOW_ASCETIC_ABILITY_IDS } from '../../src/domain/shadow-ascetic/types.js';
import { applyRoseBishopCommand, createRoseBishopState, projectRoseBishop, validateRoseBishopCommand, validateRoseBishopState } from '../../src/domain/rose-bishop/index.js';
import { applyRoseBishopActivity, roseBishopActions, roseBishopCases, roseBishopInside, validateRoseBishopLife } from '../../src/domain/rose-bishop/life.js';
import { hasRoseBishopDisputeOpponent, settleRoseBishopEncounter } from '../../src/domain/rose-bishop/encounter.js';
import { ROSE_BISHOP_FORMULA_STATUS, ROSE_BISHOP_SOURCE_STATUS } from '../../src/domain/rose-bishop/content.js';
import { ROSE_BISHOP_ABILITY_IDS, ROSE_BISHOP_CASE_IDS, type RoseBishopAcquisitionCommand, type RoseBishopActivityCommand, type RoseBishopCaseId } from '../../src/domain/rose-bishop/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('rose-bishop-stage', sliceDefaultCreationSelection, 'rose-bishop-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.roseBishop = createRoseBishopState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (s.seer.completedSources.includes(source)) return; s.seer.completedSources.push(source); s.progression.mastery[ROSE_BISHOP_ABILITY_IDS[0]]! += amount; });
  return { c, award };
}
/** Prior acting is a completed-history fixture; every original bottle is acquired through its real command. */
function shadowAscetic(): SliceState {
  const s = ordinary(), c = context(s).c;
  applySecretSupplicantCommand(s, { type: 'DISCOVER' }, c); applySecretSupplicantCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySecretSupplicantCommand(s, { type: 'BUY_POTION', bottleId: s.secretSupplicant.bottles[0]!.id }, c); applySecretSupplicantCommand(s, { type: 'CONSUME', bottleId: s.secretSupplicant.bottles[0]!.id, confirmed: true }, c);
  s.week = 9; s.progression.acting = 100;
  applyListenerCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyListenerCommand(s, { type: 'BUY_POTION', bottleId: s.listener.bottles[0]!.id }, c); applyListenerCommand(s, { type: 'CONSUME', bottleId: s.listener.bottles[0]!.id, confirmed: true }, c);
  s.week = 17; s.progression.acting = 100;
  applyShadowAsceticCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyShadowAsceticCommand(s, { type: 'BUY_POTION', bottleId: s.shadowAscetic.bottles[0]!.id }, c); applyShadowAsceticCommand(s, { type: 'CONSUME', bottleId: s.shadowAscetic.bottles[0]!.id, confirmed: true }, c);
  s.week = 29; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS, ...SHADOW_ASCETIC_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  return s;
}
function acquisition(s: SliceState, command: RoseBishopAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyRoseBishopCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: RoseBishopActivityCommand, roll = 1) { const ctx = context(s, roll); applyRoseBishopActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = shadowAscetic()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.roseBishop.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.roseBishop.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyRoseBishopCommand(s, command as RoseBishopAcquisitionCommand, ctx.c)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); }
function rejectActivity(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyRoseBishopActivity(s, command as RoseBishopActivityCommand, ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); }
function replenish(s: SliceState) { activity(s, { type: 'BUY_RATION' }); const packet = s.roseBishop.reserve.packets.at(-1)!; activity(s, { type: 'TAKE_RATION', packetId: packet.id }); }
function begin(s: SliceState, caseId: RoseBishopCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: RoseBishopCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  if (method === 'ABILITY' && caseId !== 'reserve-lesson' && s.roseBishop.reserve.points < 1) { if (s.roseBishop.reserve.lastPurchaseWeek === s.week) s.week += 1; replenish(s); }
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'REPORT', caseId });
}
function ring() { const s = promoted(); complete(s, 'ring-release'); return s; }

describe('RoseBishop independent S6 originals, guidance and promotion', () => {
  it('hides the undiscovered channel and creates no formula or supply', () => {
    const s = ordinary(), other = createRoseBishopState();
    expect(validateRoseBishopState(s)).toBe(true);
    expect(projectRoseBishop(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', reserve: { points: 0, packets: [] }, practice: { shape: 'NORMAL' } });
    expect(projectRoseBishop(s).story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; expect(s.roseBishop.bottles[0]!.labourSteps).toBe(0);
    expect(ROSE_BISHOP_FORMULA_STATUS).toContain('尚未核实'); expect(ROSE_BISHOP_SOURCE_STATUS).toContain('第三部第165章'); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360p and one AP for guidance, with no reserve or complete recipe', () => {
    const s = shadowAscetic(), cash = s.cash, ap = s.actionsRemaining, oldShadowAscetic = structuredClone(s.shadowAscetic);
    acquisition(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 360, ap - 1]); expect(s.shadowAscetic).toEqual(oldShadowAscetic);
    expect(projectRoseBishop(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] }); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' }); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('charges five bottle-specific labours then 320p without transfer, refund or partial credit', () => {
    const s = taught(), [first, second] = s.roseBishop.bottles, cash = s.cash, ap = s.actionsRemaining;
    for (let n = 0; n < 5; n += 1) acquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    expect(s.cash).toBe(cash); expect(s.actionsRemaining).toBe(ap - 5); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    buy(s); expect(s.cash).toBe(cash - 320); expect(second!.labourSteps).toBe(0); rejectAcquisition(s, { type: 'BUY_POTION', bottleId: first!.id }); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('requires actual original, separate confirmation, consumed100 and twelve complete ShadowAscetic weeks', () => {
    const s = taught(); rejectAcquisition(s, { type: 'CONSUME', bottleId: s.roseBishop.bottles[0]!.id, confirmed: true }); buy(s);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: s.roseBishop.bottles[0]!.id, confirmed: false });
    s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.roseBishop.bottles[0]!.id, confirmed: true }); s.progression.acting = 100;
    s.week -= 1; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.roseBishop.bottles[0]!.id, confirmed: true }); s.week += 1;
    acquisition(s, { type: 'CONSUME', bottleId: s.roseBishop.bottles[0]!.id, confirmed: true }); expect(validateRoseBishopState(s)).toBe(true);
  });
  it.each([{ roll: 1, mind: 95 }, { roll: 30, mind: 90 }])('promotes at roll $roll preserving all original mastery without gifting reserve', ({ roll, mind }) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), stats = { ...s.character.coreStats }, spirituality = s.spirituality;
    acquisition(s, { type: 'CONSUME', bottleId: s.roseBishop.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toMatchObject({ pathwayId: 'hanged-man', sequence: 6, acting: 0, mastery: { ...old, 'hanged-man.s6.flesh-shaping': 0, 'hanged-man.s6.self-renewal': 0 } });
    expect(s.roseBishop).toMatchObject({ promotionWeek: 29, shadowAsceticActingAtPromotion: 100 }); expect([s.mind, s.spirituality]).toEqual([mind, spirituality]); expect(s.roseBishop.reserve.points).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.roseBishop.bottles[1]!.id }); expect(validateRoseBishopState(s)).toBe(true);
  });
  it.each([{ roll: 80, mind: 80, health: 90, pollution: 25 }, { roll: 100, mind: 60, health: 80, pollution: 50 }])('keeps failed roll $roll recoverable while spending exactly the selected original', ({ roll, mind, health, pollution }) => {
    const s = prepared(), old = structuredClone(s.progression); acquisition(s, { type: 'CONSUME', bottleId: s.roseBishop.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toEqual(old); expect([s.mind, s.health, s.seer.pollution, s.status]).toEqual([mind, health, pollution, 'ACTIVE']); expect(s.roseBishop.bottles[0]!.status).toBe('CONSUMED'); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('requires all originals to fail, one request AP and the next real week before a paid new batch', () => {
    const s = taught(); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i += 1) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 80); }
    const ap = s.actionsRemaining; acquisition(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' }); expect(s.roseBishop.bottles).toHaveLength(6); expect(s.roseBishop.bottles[3]!).toMatchObject({ id: 'rose-bishop-potion-4', status: 'SUPPLIER', labourSteps: 0 }); expect(validateRoseBishopState(s)).toBe(true);
    const forged = structuredClone(s); forged.roseBishop.bottles[3]!.source = forged.roseBishop.bottles[0]!.source; expect(validateRoseBishopState(forged)).toBe(false);
  });
});

describe('RoseBishop real animal-source supply', () => {
  it('buys one persistent original per week and separately consumes that same original without healing', () => {
    const s = promoted(), cash = s.cash, ap = s.actionsRemaining, sp = s.spirituality;
    s.health = 43; s.mind = 61;
    activity(s, { type: 'BUY_RATION' });
    expect([s.cash, s.actionsRemaining, s.roseBishop.reserve.points]).toEqual([cash - 40, ap - 1, 0]);
    const packet = s.roseBishop.reserve.packets[0]!;
    expect(packet).toEqual({ id: 'rose-bishop-ration-1', acquiredWeek: 29, status: 'HELD', consumedWeek: null });
    rejectActivity(s, { type: 'BUY_RATION' }); rejectActivity(s, { type: 'TAKE_RATION', packetId: 'rose-bishop-ration-2' });
    s.week += 1; expect(packet.status).toBe('HELD'); activity(s, { type: 'TAKE_RATION', packetId: packet.id });
    expect(packet).toMatchObject({ status: 'CONSUMED', consumedWeek: 30 });
    expect([s.actionsRemaining, s.roseBishop.reserve.points, s.health, s.mind, s.spirituality]).toEqual([ap - 2, 1, 43, 61, sp]);
    rejectActivity(s, { type: 'TAKE_RATION', packetId: packet.id }); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('caps reserve at three, keeps extra originals and does not auto-replenish across weeks', () => {
    const s = promoted();
    for (let n = 0; n < 3; n += 1) { replenish(s); s.week += 1; }
    activity(s, { type: 'BUY_RATION' }); const packet = s.roseBishop.reserve.packets.at(-1)!;
    rejectActivity(s, { type: 'TAKE_RATION', packetId: packet.id }); expect(packet.status).toBe('HELD');
    s.roseBishop.reserve.points -= 1; s.week += 2; expect(s.roseBishop.reserve.points).toBe(2);
    activity(s, { type: 'TAKE_RATION', packetId: packet.id }); expect(s.roseBishop.reserve.points).toBe(3); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('rejects malformed commands, reused identity, impossible reserve and unsupported powers', () => {
    for (const c of [{ type: 'BUY_RATION', free: true }, { type: 'TAKE_RATION', packetId: 'human-1' }, { type: 'GRAZE_SOUL' }, { type: 'ENTER_HOST' }, { type: 'CONSUME', bottleId: 'shadow-ascetic-potion-1', confirmed: true }]) expect(validateRoseBishopCommand(c)).toBe(false);
    const s = promoted(); replenish(s); s.week += 1; activity(s, { type: 'BUY_RATION' });
    for (const change of [
      (t: SliceState) => { t.roseBishop.reserve.points = 4; },
      (t: SliceState) => { t.roseBishop.reserve.packets[1]!.id = t.roseBishop.reserve.packets[0]!.id; },
      (t: SliceState) => { t.roseBishop.reserve.packets[0]!.consumedWeek = null; },
      (t: SliceState) => { t.roseBishop.practice.shape = 'SLIM_HAND'; },
    ]) { const bad = structuredClone(s); change(bad); expect(validateRoseBishopState(bad)).toBe(false); }
    expect(validateRoseBishopState(s)).toBe(true);
  });
});

describe('RoseBishop actual self-shaping and peaceful completion', () => {
  it('spends one reserve and three spirituality, changes only own hand and requires actual zero-AP return', () => {
    const s = promoted(); replenish(s); begin(s, 'ring-release'); const ap = s.actionsRemaining, sp = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'ring-release' });
    expect([s.actionsRemaining, s.spirituality, s.roseBishop.reserve.points, s.roseBishop.practice.shape]).toEqual([ap - 1, sp - 3, 0, 'SLIM_HAND']);
    expect(roseBishopInside(s)).toBe(true); expect(validateRoseBishopState(s)).toBe(true);
    rejectActivity(s, { type: 'REPORT', caseId: 'ring-release' }); rejectActivity(s, { type: 'BUY_RATION' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    s.actionsRemaining = 0; activity(s, { type: 'CLOSE', caseId: 'ring-release' });
    expect([s.actionsRemaining, s.roseBishop.practice.shape, roseBishopInside(s)]).toEqual([0, 'NORMAL', false]);
    s.actionsRemaining = 1; activity(s, { type: 'REPORT', caseId: 'ring-release' }); expect(s.progression.acting).toBe(25); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('keeps failed costs and actual altered body until close, then requires a fresh real week', () => {
    const s = promoted(); replenish(s); begin(s, 'ring-release'); const sp = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'ring-release' }, 100);
    expect([s.spirituality, s.roseBishop.reserve.points, s.roseBishop.practice.shape]).toEqual([sp - 3, 0, 'SLIM_HAND']);
    activity(s, { type: 'CLOSE', caseId: 'ring-release' }); rejectActivity(s, { type: 'REPORT', caseId: 'ring-release' }); rejectActivity(s, { type: 'PREPARE', caseId: 'ring-release', method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'ring-release', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'ring-release' }); activity(s, { type: 'CLOSE', caseId: 'ring-release' }); activity(s, { type: 'REPORT', caseId: 'ring-release' });
    expect(s.roseBishop.cases['ring-release']!.closes).toBe(2); expect(s.roseBishop.reserve.points).toBe(0); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('uses the actual small flask with a temporary own-palm shape and restores it before report', () => {
    const s = ring(); s.week += 1; replenish(s); begin(s, 'steady-grip'); activity(s, { type: 'PERFORM', caseId: 'steady-grip' });
    expect(s.roseBishop.practice.shape).toBe('SUPPORT_PALM'); expect(validateRoseBishopState(s)).toBe(true);
    const ctx = activity(s, { type: 'CLOSE', caseId: 'steady-grip' }); expect(ctx.c.note).toHaveBeenCalledWith('实际恢复本人形态并结束接触', expect.stringContaining('放回原支架'));
    activity(s, { type: 'REPORT', caseId: 'steady-grip' }); expect(s.roseBishop.practice.shape).toBe('NORMAL'); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('allows zero-resource ordinary methods and all three reports plus reflection reach peaceful100', () => {
    const s = promoted(), sp = s.spirituality;
    for (const id of ROSE_BISHOP_CASE_IDS) complete(s, id, 'ORDINARY'); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.roseBishop.reserve.points, s.roseBishop.reserve.packetsBought]).toEqual([100, sp, 0, 0]); expect(s.combat).toBeNull();
    for (const id of ROSE_BISHOP_CASE_IDS) rejectActivity(s, { type: 'REPORT', caseId: id }); rejectActivity(s, { type: 'REFLECT' });
    expect(roseBishopCases(s)).toHaveLength(3); expect(validateRoseBishopLife(s)).toBe(true); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('respects the adult’s refusal without taking resources or imposing power, then permits a later discussion', () => {
    const s = promoted(); complete(s, 'ring-release', 'ORDINARY'); complete(s, 'steady-grip', 'ORDINARY'); const before = structuredClone(s.roseBishop.reserve), sp = s.spirituality;
    begin(s, 'reserve-lesson'); const ctx = activity(s, { type: 'PERFORM', caseId: 'reserve-lesson' }, 100);
    expect(ctx.c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('尊重他的拒绝')); expect(s.roseBishop.reserve).toEqual(before); expect(s.spirituality).toBe(sp);
    activity(s, { type: 'CLOSE', caseId: 'reserve-lesson' }); rejectActivity(s, { type: 'REPORT', caseId: 'reserve-lesson' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'reserve-lesson', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'reserve-lesson' }); activity(s, { type: 'CLOSE', caseId: 'reserve-lesson' }); activity(s, { type: 'REPORT', caseId: 'reserve-lesson' }); activity(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(roseBishopActions(s).every(a => a.command.type !== 'REPORT' && a.command.type !== 'REFLECT')).toBe(true); expect(validateRoseBishopState(s)).toBe(true);
  });
});

describe('RoseBishop independent courtyard encounter', () => {
  it('requires an actual report and permits dialogue refusal followed by a later peaceful resolution', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'ring-release', 'ORDINARY'); const acting = s.progression.acting;
    activity(s, { type: 'ENCOUNTER_TALK' }, 100); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' });
    expect([s.roseBishop.encounter.status, s.progression.acting, s.combat]).toEqual(['RESOLVED', acting, null]); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('recognizes only the current living actual opponent with normal body', () => {
    const s = ring(); activity(s, { type: 'ENCOUNTER_FIGHT' }); expect(hasRoseBishopDisputeOpponent(s)).toBe(true);
    const stale = structuredClone(s); stale.week += 1; expect(hasRoseBishopDisputeOpponent(stale)).toBe(false);
    const dead = structuredClone(s); dead.combat!.enemyHealth = 0; expect(hasRoseBishopDisputeOpponent(dead)).toBe(false);
    const altered = structuredClone(s); altered.roseBishop.practice.shape = 'SLIM_HAND'; expect(hasRoseBishopDisputeOpponent(altered)).toBe(false); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('retreats through the original exit without pursuit, refund, healing or reward', () => {
    const s = ring(), reserve = structuredClone(s.roseBishop.reserve); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.health = 43; s.mind = 62; const ctx = context(s);
    settleRoseBishopEncounter(s, 'RETREATED', ctx.c, ctx.award); expect([s.health, s.mind, s.combat, s.roseBishop.encounter.status]).toEqual([43, 62, null, 'RETREATED']); expect(ctx.award).not.toHaveBeenCalled(); expect(s.roseBishop.reserve).toEqual(reserve); expect(validateRoseBishopState(s)).toBe(true);
  });
  it('awards living effective participation exactly once and never adds acting', () => {
    const s = ring(), acting = s.progression.acting; activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [{ actor: 'PLAYER', label: '真实原地打击', selfGain: 1, enemyReduction: 0 }], playerAdvantage: 1, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s); settleRoseBishopEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award); expect(ctx.award).toHaveBeenCalledExactlyOnceWith('rose-bishop-dispute', 25); expect(s.progression.acting).toBe(acting); expect(validateRoseBishopState(s)).toBe(true);
    expect(() => settleRoseBishopEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
  });
  it('preserves actual death with no revival or reward', () => {
    const s = ring(); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD'; const ctx = context(s); settleRoseBishopEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.roseBishop.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled(); expect(validateRoseBishopState(s)).toBe(true);
  });
});
