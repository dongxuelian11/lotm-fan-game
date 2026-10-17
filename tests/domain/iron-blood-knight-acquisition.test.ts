import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  applyIronBloodKnightAcquisition, applyIronBloodKnightCommand, createIronBloodKnightState,
  projectIronBloodKnight, validateIronBloodKnightCommand, validateIronBloodKnightState,
  isIronBloodKnightAcquisitionCommand,
} from '../../src/domain/iron-blood-knight/index.js';
import {
  IRON_BLOOD_KNIGHT_BODY_CHANGE, IRON_BLOOD_KNIGHT_FORMULA_STATUS, IRON_BLOOD_KNIGHT_PRICES,
  IRON_BLOOD_KNIGHT_RITUAL_SOURCE,
} from '../../src/domain/iron-blood-knight/content.js';
import { IRON_BLOOD_KNIGHT_ABILITY_IDS, type IronBloodKnightAcquisitionCommand } from '../../src/domain/iron-blood-knight/types.js';
import { IRON_BLOOD_COHORT_IDS, IRON_BLOOD_TEAM_ACTIVITIES, applyIronBloodTeamCommand, type IronBloodTeamCommand } from '../../src/domain/iron-blood-knight/team.js';

/** Historical female Reaper fixture is migrated intact; later checks/time are explicit unit setup, not natural-play claims. */
function reaper(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/reaper-v0960/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.ironBloodKnight = createIronBloodKnightState();
  s.week = Math.max(s.week, s.reaper.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: IronBloodKnightAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyIronBloodKnightAcquisition(s, command, c); return c;
}
function team(s: SliceState, command: IronBloodTeamCommand) { applyIronBloodTeamCommand(s, command, context(s)); }
function taught(s = reaper()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.ironBloodKnight.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.ironBloodKnight.bottles[index]!.id, confirmed: true, acceptBodyChange: true }) as const;
function qualify(s: SliceState) {
  const first = s.week;
  for (const cohortId of IRON_BLOOD_COHORT_IDS) team(s, { type: 'JOIN_COHORT', cohortId });
  for (const [offset, activity] of IRON_BLOOD_TEAM_ACTIVITIES.entries()) {
    s.week = first + offset + 1;
    for (const cohortId of IRON_BLOOD_COHORT_IDS) team(s, { type: 'TEAM_ACTIVITY', cohortId, activity });
  }
  s.week = first + 4; team(s, { type: 'FULL_EXERCISE' });
  s.week = first + 5; team(s, { type: 'FULL_EXERCISE' }); s.week = first + 6;
  return s;
}
function gathered() { const s = taught(); buy(s); qualify(s); team(s, { type: 'PREPARE_RITE' }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyIronBloodKnightAcquisition(s, command as IronBloodKnightAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Iron Blood Knight S4 real team, original bottles and separately accepted body transition', () => {
  it('creates independent originals and hides the channel before Reaper', () => {
    const s = createSliceRun('iron-blood-hidden', sliceDefaultCreationSelection, 'iron-blood-hidden');
    expect(validateIronBloodKnightState(s)).toBe(true);
    expect(projectIronBloodKnight(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '' });
    expect(projectIronBloodKnight(s).story).toBeUndefined();
    const other = createIronBloodKnightState(); other.bottles[0]!.labourSteps = 5; other.team.members[0]!.health = 50;
    expect(s.ironBloodKnight.bottles[0]!.labourSteps).toBe(0); expect(s.ironBloodKnight.team.members[0]!.health).toBe(100);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action for honest unknown formula plus known30-person rite', () => {
    const s = reaper(), old = structuredClone([s.hunter, s.provoker, s.pyromaniac, s.conspirator, s.reaper]);
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect([s.hunter, s.provoker, s.pyromaniac, s.conspirator, s.reaper]).toEqual(old);
    expect(IRON_BLOOD_KNIGHT_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, rite: 120 });
    expect(IRON_BLOOD_KNIGHT_FORMULA_STATUS).toContain('完整主辅材料'); expect(IRON_BLOOD_KNIGHT_FORMULA_STATUS).toContain('不能替代仪式');
    expect(IRON_BLOOD_KNIGHT_RITUAL_SOURCE).toContain('至少30人'); expect(IRON_BLOOD_KNIGHT_BODY_CHANGE).toContain('所有角色');
    expect(projectIronBloodKnight(s)).toMatchObject({ formulaKnown: false, formula: [], originalGender: null });
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual bottle-specific jobs and800 remaining, without buying team progress', () => {
    const s = taught(), b = s.ironBloodKnight.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98700, 'PLAYER', s.week]);
    expect(s.ironBloodKnight.bottles[1]!.labourSteps).toBe(0);
    expect(s.ironBloodKnight.team.members.every(m => !m.joined && m.experience === 0 && !m.present)).toBe(true);
    expect(validateIronBloodKnightState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one original bottle’s labour', () => {
    const s = taught(), b = s.ironBloodKnight.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const before = s.cash; buy(s); expect(before - s.cash).toBe(6200);
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.ironBloodKnight.bottles[1]!.id });
  });
  it('cannot drink a paid bottle without the actual complete current gathering', () => {
    const s = taught(); buy(s); reject(s, dose(s));
    for (const cohortId of IRON_BLOOD_COHORT_IDS) team(s, { type: 'JOIN_COHORT', cohortId });
    reject(s, dose(s)); expect(s.ironBloodKnight.originalGender).toBeNull();
    expect(s.ironBloodKnight.bottles[0]!.status).toBe('PLAYER');
  });
  it('requires both exact confirmations without consuming or drawing a check', () => {
    const s = gathered();
    for (const command of [
      { type: 'CONSUME', bottleId: dose(s).bottleId, confirmed: true },
      { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: false }, { ...dose(s), bodyChangeAccepted: true },
    ]) { expect(validateIronBloodKnightCommand(command)).toBe(false); reject(s, command); }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 4], [30, 'SUCCESS', 85, 100, 0, 4], [90, 'FAILURE', 75, 85, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 60, 5]] as const)('uses exact four-tier result%s and closes only this actual gathering', (roll, tier, mind, health, pollution, sequence) => {
    const s = gathered(), b = s.ironBloodKnight.bottles[0]!, rite = structuredClone(s.ironBloodKnight.team.rite!);
    const old = structuredClone([s.hunter, s.provoker, s.pyromaniac, s.conspirator, s.reaper]);
    const mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, histories = structuredClone(s.ironBloodKnight.team.members.map(m => m.cohortActivities));
    expect(s.character.gender).toBe('FEMALE'); s.actionsRemaining = 0;
    const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', ritualId: rite.id, ritualParticipantIds: rite.participantIds, ritualArrivalWeek: rite.arrivedWeek, consumedWeek: s.week });
    expect(s.ironBloodKnight.team.rite).toBeNull(); expect(s.ironBloodKnight.team.riteHistory).toHaveLength(1);
    expect(s.ironBloodKnight.team.members.every(m => !m.present && m.location === 'HOME')).toBe(true);
    expect(s.ironBloodKnight.team.members.map(m => m.cohortActivities)).toEqual(histories);
    expect([s.hunter, s.provoker, s.pyromaniac, s.conspirator, s.reaper]).toEqual(old);
    for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(s.ironBloodKnight.originalGender).toBe('FEMALE');
    expect(s.character.gender).toBe(sequence === 4 ? 'MALE' : 'FEMALE');
    if (sequence === 4) {
      expect(s.ironBloodKnight.reaperActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(IRON_BLOOD_KNIGHT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    } else expect(s.progression.acting).toBe(100);
    expect(validateIronBloodKnightState(s)).toBe(true); reject(s, dose(s));
  });
  it.each(['MALE', 'OTHER'])('requires consent but retains original%s body on success', gender => {
    const s = gathered(); s.character.gender = gender; apply(s, dose(s));
    expect(s.ironBloodKnight.originalGender).toBe(gender); expect(s.character.gender).toBe(gender);
    expect(validateIronBloodKnightState(s)).toBe(true);
  });
  it('applies the approved potion-only floor1 without changing the failed body', () => {
    const s = gathered(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.character.gender]).toEqual([1, 1, 'ACTIVE', 5, 'FEMALE']);
    expect(validateIronBloodKnightState(s)).toBe(true);
  });
  it('holds the final paid preparation for zero-action consume, or zero-action cancellation', () => {
    const s = taught(); buy(s); qualify(s); s.actionsRemaining = 1;
    const week = s.week, cash = s.cash; team(s, { type: 'PREPARE_RITE' });
    expect([s.actionsRemaining, s.week, s.cash]).toEqual([0, week, cash - 120]);
    expect(projectIronBloodKnight(s).insideCase).toBe(true);
    applyIronBloodKnightCommand(s, { type: 'LEAVE_RITE' }, context(s));
    expect(s.ironBloodKnight.bottles[0]!.status).toBe('PLAYER'); expect(s.ironBloodKnight.originalGender).toBeNull();
    expect(s.ironBloodKnight.team.riteHistory[0]!.consumedBottleId).toBeNull(); reject(s, dose(s));
    expect(validateIronBloodKnightState(s)).toBe(true);
  });
  it('preserves the original female body after failure, charges reassembly and changes only after later success', () => {
    const s = gathered(); apply(s, dose(s), 90); expect(s.character.gender).toBe('FEMALE');
    const first = structuredClone(s.ironBloodKnight.bottles[0]), histories = structuredClone(s.ironBloodKnight.team.members);
    buy(s, 1); reject(s, dose(s, 1)); const cash = s.cash, ap = s.actionsRemaining;
    team(s, { type: 'PREPARE_RITE' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 120, ap - 1]);
    apply(s, dose(s, 1)); expect(s.character.gender).toBe('MALE'); expect(s.ironBloodKnight.originalGender).toBe('FEMALE');
    expect(s.ironBloodKnight.bottles[0]).toEqual(first); expect(s.ironBloodKnight.team.members).toEqual(histories);
    expect(s.ironBloodKnight.team.riteHistory.map(r => r.id)).toEqual(['IB4-RITE-1', 'IB4-RITE-2']);
    expect(validateIronBloodKnightState(s)).toBe(true);
  });
  it('retains failed originals and waits a real week for a priced fourth bottle', () => {
    const s = taught(); qualify(s);
    for (let n = 0; n < 3; n++) {
      buy(s, n); team(s, { type: 'PREPARE_RITE' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100;
      if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = structuredClone(s.ironBloodKnight.bottles), teamHistory = structuredClone(s.ironBloodKnight.team), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.ironBloodKnight.bottles.slice(0, 3)).toEqual(originals); expect(s.ironBloodKnight.bottles).toHaveLength(6);
    expect(s.ironBloodKnight.bottles[3]).toMatchObject({ id: 'iron-blood-knight-potion-4', status: 'SUPPLIER', labourSteps: 0, acquiredWeek: null });
    expect(s.ironBloodKnight.team).toEqual(teamHistory); expect(s.character.gender).toBe('FEMALE');
    expect(projectIronBloodKnight(s).actions.find(a => a.id === 'buy-iron-blood-knight-potion-4')!.cost).toContain('6200便士');
    expect(validateIronBloodKnightState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks prior digestion, twelve full weeks, health and actual original presence before drawing', () => {
    const s = gathered();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.reaper.promotionWeek; s.reaper.promotionWeek = s.week - 11; reject(s, dose(s)); s.reaper.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.ironBloodKnight.team.members[0]!.present = false; reject(s, dose(s)); s.ironBloodKnight.team.members[0]!.present = true;
    s.week++; reject(s, dose(s));
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'reaper-potion-1' }, { type: 'LEARN_GUIDANCE', grantArmy: true }, { type: 'CONSUME', bottleId: 'iron-blood-knight-potion-1', confirmed: true }])('rejects unknown or nonexact acquisition command%# without mutation', command => {
    expect(validateIronBloodKnightCommand(command)).toBe(false); expect(isIronBloodKnightAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects forged gender, copied bottle/rite identities, history dates and malformed nested records', () => {
    const s = gathered(); apply(s, dose(s));
    const mutations: ((state: SliceState) => void)[] = [
      t => { t.ironBloodKnight.originalGender = null; }, t => { t.character.gender = 'FEMALE'; },
      t => { t.ironBloodKnight.reaperActingAtPromotion = 99; }, t => { t.ironBloodKnight.bottles[0]!.source = 'copied old potion'; },
      t => { t.ironBloodKnight.bottles[0]!.ritualId = 'IB4-RITE-999'; }, t => { t.ironBloodKnight.bottles[0]!.ritualParticipantIds.pop(); },
      t => { t.ironBloodKnight.bottles[0]!.ritualArrivalWeek = t.ironBloodKnight.bottles[0]!.ritualArrivalWeek! - 1; }, t => { t.ironBloodKnight.team.riteHistory[0]!.consumedBottleId = 'reaper-potion-1'; },
      t => { delete t.progression.mastery[IRON_BLOOD_KNIGHT_ABILITY_IDS[0]]; },
      t => { (t.ironBloodKnight as unknown as Record<string, unknown>).team = null; },
      t => { (t.ironBloodKnight as unknown as Record<string, unknown>).life = null; },
    ];
    for (const change of mutations) {
      const t = structuredClone(s); change(t); expect(() => validateIronBloodKnightState(t)).not.toThrow(); expect(validateIronBloodKnightState(t)).toBe(false);
    }
  });
  it('validates persistence after JSON object keys are reordered', () => {
    const s = gathered(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, reorder(value)])) : v;
    expect(validateIronBloodKnightState(reorder(s) as SliceState)).toBe(true);
  });
});
