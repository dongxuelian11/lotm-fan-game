import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyLawyerCommand } from '../../src/domain/lawyer/index.js';
import { LAWYER_ABILITY_IDS } from '../../src/domain/lawyer/types.js';
import { applyBarbarianCommand } from '../../src/domain/barbarian/index.js';
import { BARBARIAN_ABILITY_IDS } from '../../src/domain/barbarian/types.js';
import { applyBriberCommand } from '../../src/domain/briber/index.js';
import { BRIBER_ABILITY_IDS } from '../../src/domain/briber/types.js';
import { applyCorruptionBaronCommand, createCorruptionBaronState, projectCorruptionBaron, validateCorruptionBaronCommand, validateCorruptionBaronState } from '../../src/domain/corruption-baron/index.js';
import { applyCorruptionBaronActivity, corruptionBaronActions, corruptionBaronCases, corruptionBaronInside, validateCorruptionBaronLife } from '../../src/domain/corruption-baron/life.js';
import { hasCorruptionBaronDisputeOpponent, settleCorruptionBaronEncounter } from '../../src/domain/corruption-baron/encounter.js';
import { CORRUPTION_BARON_FORMULA_STATUS, CORRUPTION_BARON_SOURCE_STATUS } from '../../src/domain/corruption-baron/content.js';
import { CORRUPTION_BARON_ABILITY_IDS, CORRUPTION_BARON_CASE_IDS, type CorruptionBaronAcquisitionCommand, type CorruptionBaronActivityCommand, type CorruptionBaronCaseId } from '../../src/domain/corruption-baron/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('corruption-baron-stage', sliceDefaultCreationSelection, 'corruption-baron-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.corruptionBaron = createCorruptionBaronState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (s.seer.completedSources.includes(source)) return; s.seer.completedSources.push(source); s.progression.mastery[CORRUPTION_BARON_ABILITY_IDS[0]]! += amount; });
  return { c, award };
}
/** Prior acting is a completed-history fixture; every original bottle is acquired through its real command. */
function briber(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyLawyerCommand(s, { type: 'DISCOVER' }, c); applyLawyerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyLawyerCommand(s, { type: 'BUY_POTION', bottleId: s.lawyer.bottles[0]!.id }, c); applyLawyerCommand(s, { type: 'CONSUME', bottleId: s.lawyer.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyBarbarianCommand(s, { type: 'LEARN_FORMULA' }, c); applyBarbarianCommand(s, { type: 'BUY_MATERIALS', batchId: 'barbarian-batch-1' }, c); applyBarbarianCommand(s, { type: 'BREW', batchId: 'barbarian-batch-1' }, c); applyBarbarianCommand(s, { type: 'CONSUME', bottleId: s.barbarian.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyBriberCommand(s, { type: 'LEARN_FORMULA' }, c); applyBriberCommand(s, { type: 'BUY_MATERIALS', batchId: 'briber-batch-1' }, c); applyBriberCommand(s, { type: 'BREW', batchId: 'briber-batch-1' }, c); applyBriberCommand(s, { type: 'CONSUME', bottleId: s.briber.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...LAWYER_ABILITY_IDS, ...BARBARIAN_ABILITY_IDS, ...BRIBER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  return s;
}
function acquisition(s: SliceState, command: CorruptionBaronAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyCorruptionBaronCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: CorruptionBaronActivityCommand, roll = 1) { const ctx = context(s, roll); applyCorruptionBaronActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = briber()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.corruptionBaron.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.corruptionBaron.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyCorruptionBaronCommand(s, command as CorruptionBaronAcquisitionCommand, ctx.c)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); }
function rejectActivity(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyCorruptionBaronActivity(s, command as CorruptionBaronActivityCommand, ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); }
function begin(s: SliceState, caseId: CorruptionBaronCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: CorruptionBaronCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  activity(s, { type: 'REPORT', caseId });
}
function firstReport() { const s = promoted(); complete(s, 'clause-order'); return s; }

describe('CorruptionBaron independent S6 originals, guidance and promotion', () => {
  it('hides the undiscovered channel and creates no formula or supply', () => {
    const s = ordinary(), other = createCorruptionBaronState();
    expect(validateCorruptionBaronState(s)).toBe(true);
    expect(projectCorruptionBaron(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: { clauseOrder: 'ORIGINAL', marker: 'CRADLED', route: 'READY' } });
    expect(projectCorruptionBaron(s).story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; expect(s.corruptionBaron.bottles[0]!.labourSteps).toBe(0);
    expect(CORRUPTION_BARON_FORMULA_STATUS).toContain('尚未核实'); expect(CORRUPTION_BARON_SOURCE_STATUS).toContain('序列6腐化男爵'); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360p and one AP for guidance, without inventing resources or a complete recipe', () => {
    const s = briber(), cash = s.cash, ap = s.actionsRemaining, oldBriber = structuredClone(s.briber);
    acquisition(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 360, ap - 1]); expect(s.briber).toEqual(oldBriber);
    expect(projectCorruptionBaron(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] }); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' }); expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it('charges five bottle-specific labours then 320p without transfer, refund or partial credit', () => {
    const s = taught(), [first, second] = s.corruptionBaron.bottles, cash = s.cash, ap = s.actionsRemaining;
    for (let n = 0; n < 5; n += 1) acquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    expect(s.cash).toBe(cash); expect(s.actionsRemaining).toBe(ap - 5); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    buy(s); expect(s.cash).toBe(cash - 320); expect(second!.labourSteps).toBe(0); rejectAcquisition(s, { type: 'BUY_POTION', bottleId: first!.id }); expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it('requires actual original, separate confirmation, consumed100 and twelve complete Briber weeks', () => {
    const s = taught(); rejectAcquisition(s, { type: 'CONSUME', bottleId: s.corruptionBaron.bottles[0]!.id, confirmed: true }); buy(s);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: s.corruptionBaron.bottles[0]!.id, confirmed: false });
    s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.corruptionBaron.bottles[0]!.id, confirmed: true }); s.progression.acting = 100;
    s.week -= 1; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.corruptionBaron.bottles[0]!.id, confirmed: true }); s.week += 1;
    acquisition(s, { type: 'CONSUME', bottleId: s.corruptionBaron.bottles[0]!.id, confirmed: true }); expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it.each([{ roll: 1, mind: 95 }, { roll: 30, mind: 90 }])('promotes at roll $roll preserving all original mastery without gifting resources', ({ roll, mind }) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), stats = { ...s.character.coreStats }, spirituality = s.spirituality;
    acquisition(s, { type: 'CONSUME', bottleId: s.corruptionBaron.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toMatchObject({ pathwayId: 'black-emperor', sequence: 6, acting: 0, mastery: { ...old, 'black-emperor.s6.distortion': 0 } });
    expect(s.corruptionBaron).toMatchObject({ promotionWeek: 31, briberActingAtPromotion: 100 }); expect([s.mind, s.spirituality]).toEqual([mind, spirituality]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.corruptionBaron.bottles[1]!.id }); expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it.each([{ roll: 80, mind: 80, health: 90, pollution: 25 }, { roll: 100, mind: 60, health: 80, pollution: 50 }])('keeps failed roll $roll recoverable while spending exactly the selected original', ({ roll, mind, health, pollution }) => {
    const s = prepared(), old = structuredClone(s.progression); acquisition(s, { type: 'CONSUME', bottleId: s.corruptionBaron.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toEqual(old); expect([s.mind, s.health, s.seer.pollution, s.status]).toEqual([mind, health, pollution, 'ACTIVE']); expect(s.corruptionBaron.bottles[0]!.status).toBe('CONSUMED'); expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it('requires all originals to fail, one request AP and the next real week before a paid new batch', () => {
    const s = taught(); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i += 1) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 80); }
    const ap = s.actionsRemaining; acquisition(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' }); expect(s.corruptionBaron.bottles).toHaveLength(6); expect(s.corruptionBaron.bottles[3]!).toMatchObject({ id: 'corruption-baron-potion-4', status: 'SUPPLIER', labourSteps: 0 }); expect(validateCorruptionBaronState(s)).toBe(true);
    const forged = structuredClone(s); forged.corruptionBaron.bottles[3]!.source = forged.corruptionBaron.bottles[0]!.source; expect(validateCorruptionBaronState(forged)).toBe(false);
  });
});

describe('CorruptionBaron courtyard dispute and strict save boundaries', () => {
  it('requires a real report and establishes only the original reachable courtyard opponent', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    complete(s, 'clause-order'); const ap = s.actionsRemaining; activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.combat?.encounterId).toBe('CORRUPTION_BARON_DISPUTE'); expect(hasCorruptionBaronDisputeOpponent(s)).toBe(true); expect(validateCorruptionBaronState(s)).toBe(true);
    const ctx = context(s); settleCorruptionBaronEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect(ctx.award).not.toHaveBeenCalled(); expect(s.combat).toBeNull(); expect(s.corruptionBaron.encounter.status).toBe('RETREATED'); expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it('awards only living effective participation once, without extra acting or healing', () => {
    const s = firstReport(), acting = s.progression.acting; activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [{ actor: 'PLAYER', label: '真实原地打击', selfGain: 1, enemyReduction: 0 }], playerAdvantage: 1, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s), health = s.health, sp = s.spirituality; settleCorruptionBaronEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('corruption-baron-dispute', 25); expect([s.progression.acting, s.health, s.spirituality]).toEqual([acting, health, sp]); expect(validateCorruptionBaronState(s)).toBe(true);
    expect(() => settleCorruptionBaronEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
  });
  it('preserves real death without revival or reward, and gives no award for an empty victory', () => {
    const s = firstReport(); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD'; s.health = 0; const ctx = context(s);
    settleCorruptionBaronEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.health, s.corruptionBaron.encounter.status, s.combat]).toEqual(['DEAD', 0, 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled(); expect(validateCorruptionBaronState(s)).toBe(true);
    const empty = firstReport(); activity(empty, { type: 'ENCOUNTER_FIGHT' }); const other = context(empty);
    settleCorruptionBaronEncounter(empty, 'ENEMY_SURRENDERED', other.c, other.award); expect(other.award).not.toHaveBeenCalled(); expect(validateCorruptionBaronState(empty)).toBe(true);
  });
  it('talk respects refusal and a later voluntary result, with no free acting or mastery', () => {
    const s = firstReport(), before = structuredClone(s.progression); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.corruptionBaron.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.corruptionBaron.encounter.status).toBe('RESOLVED'); expect(s.progression).toEqual(before); expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it('rejects malformed commands before any spending or checks', () => {
    const s = promoted();
    for (const c of [{ type: 'HANDLE_MOON', method: 'FOOD' }, { type: 'OBSERVE', caseId: 'future-spirit' }, { type: 'PREPARE', caseId: 'rolling-marker', method: 'ABILITY', free: true }, { type: 'VERIFY', caseId: 'agreed-route' }, { type: 'COMPOSE' }]) {
      expect(validateCorruptionBaronCommand(c)).toBe(false); rejectActivity(s, c);
    }
    rejectAcquisition(s, { type: 'CONSUME', bottleId: 'briber-potion-1', confirmed: true });
  });
  it('rejects counterfeit practice, acting, duplicated award and original provenance', () => {
    const s = firstReport();
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.corruptionBaron.practice.marker = 'SIDE_POCKET'; },
      v => { v.corruptionBaron.practice.route = 'DIVERTED'; },
      v => { v.progression.acting += 25; },
      v => { v.seer.completedSources.push('corruption-baron-case:clause-order'); },
      v => { v.corruptionBaron.bottles[0]!.source = 'free conjured potion'; },
      v => { (v.corruptionBaron as unknown as Record<string, unknown>).magnify = 10; },
      v => { (v.corruptionBaron as unknown as Record<string, unknown>).practice = []; },
    ];
    for (const mutate of mutations) { const forged = structuredClone(s); mutate(forged); expect(validateCorruptionBaronState(forged)).toBe(false); }
  });
});

