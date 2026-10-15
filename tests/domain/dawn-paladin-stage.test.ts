import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyWarriorCommand } from '../../src/domain/warrior/index.js';
import { WARRIOR_ABILITY_IDS } from '../../src/domain/warrior/types.js';
import { applyGladiatorCommand } from '../../src/domain/gladiator/index.js';
import { GLADIATOR_ABILITY_IDS } from '../../src/domain/gladiator/types.js';
import { applyWeaponmasterCommand } from '../../src/domain/weaponmaster/index.js';
import { WEAPONMASTER_ABILITY_IDS } from '../../src/domain/weaponmaster/types.js';
import { applyDawnPaladinCommand, createDawnPaladinState, projectDawnPaladin, validateDawnPaladinCommand, validateDawnPaladinState } from '../../src/domain/dawn-paladin/index.js';
import { applyDawnPaladinActivity, dawnPaladinActions, dawnPaladinCases, dawnPaladinInside, validateDawnPaladinLife } from '../../src/domain/dawn-paladin/life.js';
import { settleDawnPaladinEncounter } from '../../src/domain/dawn-paladin/encounter.js';
import { DAWN_PALADIN_FORMULA_STATUS, DAWN_PALADIN_PRICES, DAWN_PALADIN_SOURCE_STATUS } from '../../src/domain/dawn-paladin/content.js';
import { DAWN_PALADIN_ABILITY_IDS, DAWN_PALADIN_CASE_IDS, type DawnPaladinAcquisitionCommand, type DawnPaladinActivityCommand, type DawnPaladinCaseId } from '../../src/domain/dawn-paladin/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('dawnPaladin-domain', sliceDefaultCreationSelection, 'dawnPaladin-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.dawnPaladin = createDawnPaladinState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[DAWN_PALADIN_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function weaponmaster(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyWarriorCommand(s, { type: 'DISCOVER' }, c);
  applyWarriorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyWarriorCommand(s, { type: 'BUY_POTION', bottleId: s.warrior.bottles[0]!.id }, c);
  applyWarriorCommand(s, { type: 'CONSUME', bottleId: s.warrior.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyGladiatorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyGladiatorCommand(s, { type: 'BUY_POTION', bottleId: s.gladiator.bottles[0]!.id }, c);
  applyGladiatorCommand(s, { type: 'CONSUME', bottleId: s.gladiator.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyWeaponmasterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyWeaponmasterCommand(s, { type: 'BUY_POTION', bottleId: s.weaponmaster.bottles[0]!.id }, c);
  applyWeaponmasterCommand(s, { type: 'CONSUME', bottleId: s.weaponmaster.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...WARRIOR_ABILITY_IDS, ...GLADIATOR_ABILITY_IDS, ...WEAPONMASTER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: DawnPaladinAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyDawnPaladinCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: DawnPaladinActivityCommand, roll = 1) { const ctx = context(s, roll); applyDawnPaladinActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = weaponmaster()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.dawnPaladin.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.dawnPaladin.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyDawnPaladinCommand(s, command as DawnPaladinAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyDawnPaladinActivity(s, command as DawnPaladinActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: DawnPaladinCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: DawnPaladinCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId });
  activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'REPORT', caseId });
}
function effectiveRound(s: SliceState) {
  s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'PLAYER', label: '本人对原敌的实际有限攻势', selfGain: 3, enemyReduction: 0 }], playerAdvantage: 3, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
}

describe('DawnPaladin S6 original supply and inherited growth', () => {
  it('starts with independent stock and untouched original practice sources, hiding the future channel', () => {
    const s = ordinary(), p = projectDawnPaladin(s), other = createDawnPaladinState();
    expect(validateDawnPaladinState(s)).toBe(true);
    expect(p).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [] });
    expect(p.story).toBeUndefined(); expect(dawnPaladinCases(s)).toEqual([]);
    expect(p.practice).toMatchObject({ illusionCreated: false, volunteerSpirituality: 20, stormTarget: 'INTACT', swordActive: false, armorActive: false });
    other.bottles[0]!.labourSteps = 5; other.practice.illusionCreated = true;
    expect(s.dawnPaladin.bottles[0]!.labourSteps).toBe(0); expect(s.dawnPaladin.practice.illusionCreated).toBe(false);
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges actual guidance and five corresponding labour actions before a 320-penny original handover', () => {
    const s = weaponmaster(), old = structuredClone([s.warrior, s.gladiator, s.weaponmaster]);
    acquisition(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([19640, 99]); expect([s.warrior, s.gladiator, s.weaponmaster]).toEqual(old);
    const b = s.dawnPaladin.bottles[0]!;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([s.actionsRemaining, b.status]).toEqual([94, 'SUPPLIER']);
    rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([19320, 94, 'PLAYER']);
    expect(DAWN_PALADIN_PRICES).toEqual({ guidance: 360, potion: 3320, labourCredit: 3000 });
    expect(DAWN_PALADIN_FORMULA_STATUS).toContain('尚未核实'); expect(projectDawnPaladin(s).formula).toEqual([]);
    expect(s.dawnPaladin.bottles[1]!.labourSteps).toBe(0); rejectAcquisition(s, { type: 'BUY_POTION', bottleId: b.id });
    expect(validateDawnPaladinState(s)).toBe(true);
  });
  it('does not partially discount or transfer labour and enforces acting100 plus twelve actual S7 weeks at drinking', () => {
    const s = weaponmaster(); s.week = 19; s.progression.acting = 0; taught(s);
    acquisition(s, { type: 'POTION_WORK', bottleId: s.dawnPaladin.bottles[0]!.id }); const cash = s.cash, b = buy(s);
    expect(cash - s.cash).toBe(3320); expect(validateDawnPaladinState(s)).toBe(true);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 30; s.progression.acting = 100; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 31; s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(6);
  });
  it('retains each of the four recoverable drinking outcomes and all prior mastery', () => {
    for (const [roll, tier, mind, health, pollution, sequence] of [[1, 'GREAT_SUCCESS', 95, 100, 0, 6], [30, 'SUCCESS', 90, 100, 0, 6], [85, 'FAILURE', 80, 90, 25, 7], [100, 'GREAT_FAILURE', 60, 80, 50, 7]] as const) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.dawnPaladin.bottles[0]!;
      const ctx = acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(ctx.c.check).toHaveBeenCalledWith('will', 24);
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      if (sequence === 7) expect(s.progression.acting).toBe(100);
      expect(validateDawnPaladinState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('inherits every exact Warrior-family ID and adds only four zero masteries, four +1 stats, without a refill', () => {
    const s = prepared(), old = structuredClone([s.warrior, s.gladiator, s.weaponmaster]), stats = { ...s.character.coreStats };
    acquisition(s, { type: 'CONSUME', bottleId: s.dawnPaladin.bottles[0]!.id, confirmed: true });
    expect([s.warrior, s.gladiator, s.weaponmaster]).toEqual(old); expect(s.dawnPaladin.weaponmasterActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...WARRIOR_ABILITY_IDS, ...GLADIATOR_ABILITY_IDS, ...WEAPONMASTER_ABILITY_IDS, ...DAWN_PALADIN_ABILITY_IDS]);
    expect(DAWN_PALADIN_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0, 0]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(DAWN_PALADIN_SOURCE_STATUS).toContain('序列5');
  });
  it('delivers a new priced batch only in a later real week after three actual failed originals', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.dawnPaladin.bottles); acquisition(s, { type: 'REQUEST_SUPPLY' });
    rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' }); s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.dawnPaladin.bottles.slice(0, 3)).toEqual(originals); expect(s.dawnPaladin.bottles).toHaveLength(6);
    expect(s.dawnPaladin.bottles[3]).toMatchObject({ id: 'dawn-paladin-potion-4', status: 'SUPPLIER', labourSteps: 0 });
    expect(validateDawnPaladinState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects forged command fields, old bottle reuse and invented original sources without mutation', () => {
    for (const command of [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'dawn-paladin-potion-1', confirmed: false }, { type: 'PREPARE', caseId: 'marked-exit', method: 'CONTROL_ALL' }, { type: 'CLOSE', caseId: 'armor-test', returnMethod: 'TELEPORT' }, { type: 'REFLECT', extra: true }]) {
      expect(validateDawnPaladinCommand(command)).toBe(false); rejectAcquisition(prepared(), command); rejectActivity(promoted(), command);
    }
    const s = promoted();
    for (const change of [(t: SliceState) => { t.dawnPaladin.bottles[0]!.source = 'invented'; }, (t: SliceState) => { t.dawnPaladin.weaponmasterActingAtPromotion = 99; }, (t: SliceState) => { delete t.progression.mastery[GLADIATOR_ABILITY_IDS[0]]; }]) { const t = structuredClone(s); change(t); expect(validateDawnPaladinState(t)).toBe(false); }
  });
});

describe('DawnPaladin original empty-courtyard dispute', () => {
  it('requires one report, no prepared or open contact, and spends one action on actual arrival', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'marked-exit');
    begin(s, 'cleared-storm'); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); activity(s, { type: 'PERFORM', caseId: 'cleared-storm' });
    rejectActivity(s, { type: 'ENCOUNTER_TALK' }); activity(s, { type: 'CLOSE', caseId: 'cleared-storm' });
    const ap = s.actionsRemaining, old = structuredClone([s.warrior, s.gladiator, s.weaponmaster, s.dawnPaladin.practice, s.world]);
    const c = activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.combat?.encounterId).toBe('DAWN_PALADIN_DISPUTE');
    expect([s.warrior, s.gladiator, s.weaponmaster, s.dawnPaladin.practice, s.world]).toEqual(old);
    expect(c.c.note).toHaveBeenCalledWith('实际走到原外院并核对现场', expect.stringContaining('罗尔德'));
    expect(validateDawnPaladinState(s)).toBe(true);
  });
  it('keeps refusal until a later week and permits peace without reward or taking the adult original club', () => {
    const s = promoted(); complete(s, 'marked-exit'); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.dawnPaladin.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); s.week += 1;
    const acting = s.progression.acting, cash = s.cash, c = activity(s, { type: 'ENCOUNTER_TALK' });
    expect([s.dawnPaladin.encounter.status, s.progression.acting, s.cash]).toEqual(['RESOLVED', acting, cash]);
    expect(c.award).not.toHaveBeenCalled(); expect(validateDawnPaladinState(s)).toBe(true);
  });
  it('never awards retreat or nominal victory based on participation from an older encounter', () => {
    for (const outcome of ['RETREATED', 'ENEMY_SURRENDERED']) {
      const s = promoted(); complete(s, 'marked-exit'); effectiveRound(s); activity(s, { type: 'ENCOUNTER_FIGHT' });
      const c = context(s); settleDawnPaladinEncounter(s, outcome, c.c, c.award);
      expect(c.award).not.toHaveBeenCalled(); expect(s.combat).toBeNull(); expect(validateDawnPaladinState(s)).toBe(true);
    }
  });
  it('awards exactly once to a living effective participant even when the original enemy dies', () => {
    const s = promoted(); complete(s, 'marked-exit'); activity(s, { type: 'ENCOUNTER_FIGHT' }); effectiveRound(s);
    const c = context(s), acting = s.progression.acting, cash = s.cash;
    settleDawnPaladinEncounter(s, 'ENEMY_DEAD', c.c, c.award);
    expect(c.award).toHaveBeenCalledExactlyOnceWith('dawn-paladin-dispute', 25); expect([s.progression.acting, s.cash]).toEqual([acting, cash]);
    expect(validateDawnPaladinState(s)).toBe(true); expect(() => settleDawnPaladinEncounter(s, 'ENEMY_DEAD', c.c, c.award)).toThrow();
    const forged = structuredClone(s); forged.combatHistory.at(-1)!.moves[0]!.selfGain = 0; expect(validateDawnPaladinState(forged)).toBe(false);
  });
  it('rejects fabricated encounter endings atomically, and preserves actual player death without reward', () => {
    const s = promoted(); complete(s, 'marked-exit'); activity(s, { type: 'ENCOUNTER_FIGHT' }); const c = context(s), before = structuredClone(s);
    expect(() => settleDawnPaladinEncounter(s, 'INVENTED', c.c, c.award)).toThrow(); expect(s).toEqual(before);
    effectiveRound(s); s.status = 'DEAD'; settleDawnPaladinEncounter(s, 'PLAYER_DEAD', c.c, c.award);
    expect([s.status, s.dawnPaladin.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(c.award).not.toHaveBeenCalled();
    expect(validateDawnPaladinState(s)).toBe(true);
  });
});

describe('DawnPaladin finite original practice and explicit stopping', () => {
  it('creates only the volunteer original illusion with his own real finite cost, then spends player3 on dawn', () => {
    const s = promoted(); rejectActivity(s, { type: 'PERFORM', caseId: 'marked-exit' });
    expect(dawnPaladinCases(s).every(r => r.observations.length === 0)).toBe(true);
    activity(s, { type: 'OBSERVE', caseId: 'marked-exit' });
    expect(s.dawnPaladin.practice).toMatchObject({ illusionCreated: true, volunteerSpirituality: 18, illusionDispelled: false });
    rejectActivity(s, { type: 'OBSERVE', caseId: 'marked-exit' });
    activity(s, { type: 'PREPARE', caseId: 'marked-exit', method: 'ABILITY' });
    const ap = s.actionsRemaining, spirit = s.spirituality, cash = s.cash;
    const c = activity(s, { type: 'PERFORM', caseId: 'marked-exit' });
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.spirituality, s.actionsRemaining, s.cash]).toEqual([spirit - 3, ap - 1, cash]);
    expect(s.dawnPaladin.practice).toMatchObject({ illusionDispelled: true, volunteerSpirituality: 18, screenRemoved: false });
    expect(dawnPaladinInside(s)).toBe(true); rejectActivity(s, { type: 'REPORT', caseId: 'marked-exit' });
    const facts = structuredClone(s.dawnPaladin.practice); s.actionsRemaining = 0; s.spirituality = 0;
    activity(s, { type: 'CLOSE', caseId: 'marked-exit' });
    expect(s.dawnPaladin.practice).toEqual(facts); expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(validateDawnPaladinState(s)).toBe(true);
  });
  it('keeps a failed dawn cast, requires close and next-week retry, and never creates or refills the source again', () => {
    const s = promoted(); begin(s, 'marked-exit', 'ABILITY'); const spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'marked-exit' }, 100);
    expect([s.spirituality, s.dawnPaladin.practice.volunteerSpirituality, s.dawnPaladin.practice.illusionDispelled]).toEqual([spirit - 3, 18, false]);
    rejectActivity(s, { type: 'OBSERVE', caseId: 'armor-test' });
    activity(s, { type: 'CLOSE', caseId: 'marked-exit' }); rejectActivity(s, { type: 'PREPARE', caseId: 'marked-exit', method: 'ABILITY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'marked-exit', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'marked-exit' });
    expect(s.dawnPaladin.practice.volunteerSpirituality).toBe(18); expect(validateDawnPaladinState(s)).toBe(true);
  });
  it('uses ordinary knowledge10 methods for peaceful100, with actual moved screen and dismantled unique target', () => {
    const s = promoted(), spirit = s.spirituality, cash = s.cash, inventory = structuredClone(s.town), tool = structuredClone(s.warrior.practiceClub);
    for (const caseId of DAWN_PALADIN_CASE_IDS) {
      begin(s, caseId); const c = activity(s, { type: 'PERFORM', caseId });
      expect(c.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10);
      activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'REPORT', caseId });
    }
    activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.cash]).toEqual([100, spirit, cash]);
    expect(s.dawnPaladin.practice).toMatchObject({ illusionDispelled: false, screenRemoved: true, volunteerSpirituality: 18, armorCracked: false, stormTarget: 'DISMANTLED', stormFrameScorched: false, stormSwordDispersed: false, stormArmorCracked: false });
    expect(s.town).toEqual(inventory); expect(s.warrior.practiceClub).toEqual(tool);
    expect(s.progression.mastery[DAWN_PALADIN_ABILITY_IDS[0]]).toBe(24); expect(validateDawnPaladinState(s)).toBe(true);
    rejectActivity(s, { type: 'REFLECT' });
  });
  it('actually forms and cracks armor under the agreed bounded probe, gives no health and closes temporary armor only', () => {
    const s = promoted(); begin(s, 'armor-test', 'ABILITY'); const health = s.health, spirit = s.spirituality;
    const c = activity(s, { type: 'PERFORM', caseId: 'armor-test' });
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith('will', 14);
    expect([s.health, s.spirituality]).toEqual([health, spirit - 3]);
    expect(s.dawnPaladin.practice).toMatchObject({ armorProbePerformed: true, armorCracked: true, armorActive: true });
    expect(s.dawnPaladin.encounter.armorReady).toBe(false); expect(validateDawnPaladinState(s)).toBe(true);
    activity(s, { type: 'CLOSE', caseId: 'armor-test' });
    expect(s.dawnPaladin.practice).toMatchObject({ armorProbePerformed: true, armorCracked: true, armorActive: false });
    activity(s, { type: 'REPORT', caseId: 'armor-test' }); expect(validateDawnPaladinState(s)).toBe(true);
  });
  it('moves the instructor outside only during actual preparation and charges sword3 armor3 storm4 before a finite result', () => {
    const s = promoted(); activity(s, { type: 'OBSERVE', caseId: 'cleared-storm' });
    expect(s.dawnPaladin.practice.instructorOutside).toBe(false);
    activity(s, { type: 'PREPARE', caseId: 'cleared-storm', method: 'ABILITY' });
    expect(s.dawnPaladin.practice).toMatchObject({ instructorOutside: true, stormCleared: true, stormTarget: 'INTACT', swordActive: false, armorActive: false });
    expect(validateDawnPaladinState(s)).toBe(true); s.spirituality = 9;
    rejectActivity(s, { type: 'PERFORM', caseId: 'cleared-storm' }); s.spirituality = 10;
    const ap = s.actionsRemaining, health = s.health, inventory = structuredClone(s.town), c = activity(s, { type: 'PERFORM', caseId: 'cleared-storm' });
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.actionsRemaining, s.spirituality, s.health]).toEqual([ap - 1, 0, health]);
    expect(s.dawnPaladin.practice).toMatchObject({ instructorOutside: true, stormTarget: 'DESTROYED', stormFrameScorched: true, stormSwordDispersed: true, stormArmorCracked: true, swordActive: false, armorActive: true });
    expect(s.town).toEqual(inventory); expect(validateDawnPaladinState(s)).toBe(true);
    activity(s, { type: 'CLOSE', caseId: 'cleared-storm' });
    expect(s.dawnPaladin.practice).toMatchObject({ instructorOutside: false, stormTarget: 'DESTROYED', stormFrameScorched: true, stormSwordDispersed: true, stormArmorCracked: true, armorActive: false });
    activity(s, { type: 'REPORT', caseId: 'cleared-storm' }); rejectActivity(s, { type: 'PERFORM', caseId: 'cleared-storm' });
    expect(validateDawnPaladinState(s)).toBe(true);
  });
  it('failed storm preserves actual cast losses but leaves the original target intact for next-week ordinary dismantling', () => {
    const s = promoted(); begin(s, 'cleared-storm', 'ABILITY'); const spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'cleared-storm' }, 100);
    expect(s.spirituality).toBe(spirit - 10);
    expect(s.dawnPaladin.practice).toMatchObject({ stormTarget: 'INTACT', stormFrameScorched: false, stormSwordDispersed: true, stormArmorCracked: true, armorActive: true });
    expect(validateDawnPaladinState(s)).toBe(true);
    activity(s, { type: 'CLOSE', caseId: 'cleared-storm' }); rejectActivity(s, { type: 'PREPARE', caseId: 'cleared-storm', method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'cleared-storm', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'cleared-storm' });
    activity(s, { type: 'CLOSE', caseId: 'cleared-storm' }); activity(s, { type: 'REPORT', caseId: 'cleared-storm' });
    expect(s.dawnPaladin.practice).toMatchObject({ stormTarget: 'DISMANTLED', stormFrameScorched: false, stormSwordDispersed: true, stormArmorCracked: true });
    expect(validateDawnPaladinState(s)).toBe(true);
  });
  it('can change a prior failed ordinary attempt to an ability next week without pretending the new cast already happened', () => {
    for (const caseId of ['armor-test', 'cleared-storm'] as const) {
      const s = promoted(); begin(s, caseId); activity(s, { type: 'PERFORM', caseId }, 100); activity(s, { type: 'CLOSE', caseId });
      s.week += 1; activity(s, { type: 'PREPARE', caseId, method: 'ABILITY' }); expect(validateDawnPaladinState(s)).toBe(true);
      activity(s, { type: 'PERFORM', caseId }); expect(validateDawnPaladinState(s)).toBe(true);
    }
  });
  it('cancels with zero AP and no free casts, returning the instructor while preserving cleared-source history', () => {
    const s = promoted(); begin(s, 'cleared-storm', 'ABILITY'); s.actionsRemaining = 0; s.spirituality = 0;
    activity(s, { type: 'WITHDRAW', caseId: 'cleared-storm' });
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.dawnPaladin.practice).toMatchObject({ stormCleared: true, instructorOutside: false, stormTarget: 'INTACT', stormSwordDispersed: false, stormArmorCracked: false });
    expect(validateDawnPaladinState(s)).toBe(true);
  });
  it('requires real empty hands for the two-handed sword and provides actual1AP original borrowed-club return', () => {
    const s = promoted(); activity(s, { type: 'OBSERVE', caseId: 'cleared-storm' });
    s.warrior.practiceClub.custodian = 'PLAYER'; s.warrior.practiceClub.location = 'player:hand'; s.warrior.practiceClub.version = 2;
    rejectActivity(s, { type: 'PREPARE', caseId: 'cleared-storm', method: 'ABILITY' });
    const ap = s.actionsRemaining, owner = s.warrior.practiceClub.owner;
    expect(dawnPaladinActions(s).some(a => a.command.type === 'RETURN_TOOL' && a.enabled)).toBe(true);
    activity(s, { type: 'RETURN_TOOL' });
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.warrior.practiceClub).toMatchObject({ owner, custodian: 'MENTOR', location: 'training-rack', version: 3 });
    rejectActivity(s, { type: 'RETURN_TOOL' }); s.town.clubLocation = 'HAND';
    rejectActivity(s, { type: 'PREPARE', caseId: 'cleared-storm', method: 'ABILITY' });
    s.town.clubLocation = 'BAG'; activity(s, { type: 'PREPARE', caseId: 'cleared-storm', method: 'ABILITY' });
    expect(s.dawnPaladin.practice.instructorOutside).toBe(true);
  });
  it('rejects erased volunteer cost, invented source effects, cloned target, missing clearance and open-contact week jumps', () => {
    const s = promoted(); complete(s, 'marked-exit', 'ABILITY'); begin(s, 'cleared-storm', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'cleared-storm' });
    for (const change of [
      (t: SliceState) => { t.dawnPaladin.practice.volunteerSpirituality = 20; },
      (t: SliceState) => { t.dawnPaladin.practice.illusionCreated = false; },
      (t: SliceState) => { t.dawnPaladin.practice.stormTarget = 'INTACT'; },
      (t: SliceState) => { t.dawnPaladin.practice.stormFrameScorched = false; },
      (t: SliceState) => { t.dawnPaladin.practice.instructorOutside = false; },
      (t: SliceState) => { t.dawnPaladin.practice.stormSwordDispersed = false; },
      (t: SliceState) => { t.dawnPaladin.practice.armorActive = false; },
      (t: SliceState) => { t.week += 1; },
      (t: SliceState) => { t.seer.completedSources.push('dawn-paladin-case:marked-exit'); },
    ]) { const t = structuredClone(s); change(t); expect(validateDawnPaladinLife(t)).toBe(false); }
    const fresh = ordinary(); fresh.dawnPaladin.practice.armorCracked = true; expect(validateDawnPaladinState(fresh)).toBe(false);
  });
  it('settlement clears only temporary combat mechanics, keeping actual injury, original practice facts and property', () => {
    const s = promoted(); complete(s, 'armor-test', 'ABILITY'); activity(s, { type: 'ENCOUNTER_FIGHT' }); effectiveRound(s);
    const e = s.dawnPaladin.encounter; e.swordReady = true; e.armorReady = true; e.armorExpiresRound = 2;
    const facts = structuredClone(s.dawnPaladin.practice), tool = structuredClone(s.warrior.practiceClub); s.health = 57;
    const c = context(s); settleDawnPaladinEncounter(s, 'ENEMY_SURRENDERED', c.c, c.award);
    expect(projectDawnPaladin(s).battleEquipment).toEqual({ swordReady: false, swordLostRound: null, armorReady: false, armorExpiresRound: null });
    expect([s.health, s.warrior.practiceClub, s.dawnPaladin.practice]).toEqual([57, tool, facts]);
    expect(c.award).toHaveBeenCalledExactlyOnceWith('dawn-paladin-dispute', 25); expect(validateDawnPaladinState(s)).toBe(true);
  });
});
