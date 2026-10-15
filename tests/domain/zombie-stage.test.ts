import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyPrisonerCommand } from '../../src/domain/prisoner/index.js';
import { PRISONER_ABILITY_IDS } from '../../src/domain/prisoner/types.js';
import { applyMadmanCommand } from '../../src/domain/madman/index.js';
import { MADMAN_ABILITY_IDS } from '../../src/domain/madman/types.js';
import { applyWerewolfCommand } from '../../src/domain/werewolf/index.js';
import { WEREWOLF_ABILITY_IDS } from '../../src/domain/werewolf/types.js';
import { applyZombieCommand, createZombieState, projectZombie, validateZombieCommand, validateZombieState } from '../../src/domain/zombie/index.js';
import { applyZombieActivity, zombieActions, zombieCases, zombieInside, validateZombieLife, syncZombieMoon } from '../../src/domain/zombie/life.js';
import { hasZombieDisputeOpponent, settleZombieEncounter } from '../../src/domain/zombie/encounter.js';
import { ZOMBIE_FORMULA_STATUS, ZOMBIE_SOURCE_STATUS } from '../../src/domain/zombie/content.js';
import { ZOMBIE_ABILITY_IDS, ZOMBIE_CASE_IDS, type ZombieAcquisitionCommand, type ZombieActivityCommand, type ZombieCaseId } from '../../src/domain/zombie/types.js';
import { WEREWOLF_MOON_EVENTS } from '../../src/domain/werewolf/content.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('zombie-stage', sliceDefaultCreationSelection, 'zombie-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.zombie = createZombieState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (s.seer.completedSources.includes(source)) return; s.seer.completedSources.push(source); s.progression.mastery[ZOMBIE_ABILITY_IDS[0]]! += amount; });
  return { c, award };
}
/** Prior acting is a completed-history fixture; every original bottle is acquired through its real command. */
function werewolf(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyPrisonerCommand(s, { type: 'DISCOVER' }, c); applyPrisonerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyPrisonerCommand(s, { type: 'BUY_POTION', bottleId: s.prisoner.bottles[0]!.id }, c); applyPrisonerCommand(s, { type: 'CONSUME', bottleId: s.prisoner.bottles[0]!.id, confirmed: true }, c);
  s.week = 9; s.progression.acting = 100;
  applyMadmanCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyMadmanCommand(s, { type: 'BUY_POTION', bottleId: s.madman.bottles[0]!.id }, c); applyMadmanCommand(s, { type: 'CONSUME', bottleId: s.madman.bottles[0]!.id, confirmed: true }, c);
  s.week = 17; s.progression.acting = 100;
  applyWerewolfCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyWerewolfCommand(s, { type: 'BUY_POTION', bottleId: s.werewolf.bottles[0]!.id }, c); applyWerewolfCommand(s, { type: 'CONSUME', bottleId: s.werewolf.bottles[0]!.id, confirmed: true }, c);
  s.week = 29; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS, ...WEREWOLF_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  return s;
}
function acquisition(s: SliceState, command: ZombieAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyZombieCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: ZombieActivityCommand, roll = 1) { const ctx = context(s, roll); applyZombieActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = werewolf()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.zombie.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.zombie.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyZombieCommand(s, command as ZombieAcquisitionCommand, ctx.c)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); }
function rejectActivity(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyZombieActivity(s, command as ZombieActivityCommand, ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); }
function begin(s: SliceState, caseId: ZombieCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: ZombieCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  activity(s, { type: 'REPORT', caseId });
}
function firstReport() { const s = promoted(); complete(s, 'narrow-load'); return s; }

describe('Zombie independent S6 originals, guidance and promotion', () => {
  it('hides the undiscovered channel and creates no formula or supply', () => {
    const s = ordinary(), other = createZombieState();
    expect(validateZombieState(s)).toBe(true);
    expect(projectZombie(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: { body: 'NORMAL', cold: 'NONE', spirit: 'ABSENT' }, moon: { pending: false, summary: '', history: [] } });
    expect(projectZombie(s).story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; expect(s.zombie.bottles[0]!.labourSteps).toBe(0);
    expect(ZOMBIE_FORMULA_STATUS).toContain('尚未核实'); expect(ZOMBIE_SOURCE_STATUS).toContain('第二部第118章'); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360p and one AP for guidance, without inventing resources or a complete recipe', () => {
    const s = werewolf(), cash = s.cash, ap = s.actionsRemaining, oldWerewolf = structuredClone(s.werewolf);
    acquisition(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 360, ap - 1]); expect(s.werewolf).toEqual(oldWerewolf);
    expect(projectZombie(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] }); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' }); expect(validateZombieState(s)).toBe(true);
  });
  it('charges five bottle-specific labours then 320p without transfer, refund or partial credit', () => {
    const s = taught(), [first, second] = s.zombie.bottles, cash = s.cash, ap = s.actionsRemaining;
    for (let n = 0; n < 5; n += 1) acquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    expect(s.cash).toBe(cash); expect(s.actionsRemaining).toBe(ap - 5); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    buy(s); expect(s.cash).toBe(cash - 320); expect(second!.labourSteps).toBe(0); rejectAcquisition(s, { type: 'BUY_POTION', bottleId: first!.id }); expect(validateZombieState(s)).toBe(true);
  });
  it('requires actual original, separate confirmation, consumed100 and twelve complete Werewolf weeks', () => {
    const s = taught(); rejectAcquisition(s, { type: 'CONSUME', bottleId: s.zombie.bottles[0]!.id, confirmed: true }); buy(s);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: s.zombie.bottles[0]!.id, confirmed: false });
    s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.zombie.bottles[0]!.id, confirmed: true }); s.progression.acting = 100;
    s.week -= 1; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.zombie.bottles[0]!.id, confirmed: true }); s.week += 1;
    acquisition(s, { type: 'CONSUME', bottleId: s.zombie.bottles[0]!.id, confirmed: true }); expect(validateZombieState(s)).toBe(true);
  });
  it.each([{ roll: 1, mind: 95 }, { roll: 30, mind: 90 }])('promotes at roll $roll preserving all original mastery without gifting resources', ({ roll, mind }) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), stats = { ...s.character.coreStats }, spirituality = s.spirituality;
    acquisition(s, { type: 'CONSUME', bottleId: s.zombie.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toMatchObject({ pathwayId: 'chained', sequence: 6, acting: 0, mastery: { ...old, 'chained.s6.steel-body': 0, 'chained.s6.death-craft': 0 } });
    expect(s.zombie).toMatchObject({ promotionWeek: 29, werewolfActingAtPromotion: 100 }); expect([s.mind, s.spirituality]).toEqual([mind, spirituality]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.zombie.bottles[1]!.id }); expect(validateZombieState(s)).toBe(true);
  });
  it.each([{ roll: 80, mind: 80, health: 90, pollution: 25 }, { roll: 100, mind: 60, health: 80, pollution: 50 }])('keeps failed roll $roll recoverable while spending exactly the selected original', ({ roll, mind, health, pollution }) => {
    const s = prepared(), old = structuredClone(s.progression); acquisition(s, { type: 'CONSUME', bottleId: s.zombie.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toEqual(old); expect([s.mind, s.health, s.seer.pollution, s.status]).toEqual([mind, health, pollution, 'ACTIVE']); expect(s.zombie.bottles[0]!.status).toBe('CONSUMED'); expect(validateZombieState(s)).toBe(true);
  });
  it('requires all originals to fail, one request AP and the next real week before a paid new batch', () => {
    const s = taught(); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i += 1) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 80); }
    const ap = s.actionsRemaining; acquisition(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' }); expect(s.zombie.bottles).toHaveLength(6); expect(s.zombie.bottles[3]!).toMatchObject({ id: 'zombie-potion-4', status: 'SUPPLIER', labourSteps: 0 }); expect(validateZombieState(s)).toBe(true);
    const forged = structuredClone(s); forged.zombie.bottles[3]!.source = forged.zombie.bottles[0]!.source; expect(validateZombieState(forged)).toBe(false);
  });
});

describe('Zombie finite original practices and actual cleanup', () => {
  it.each(ZOMBIE_CASE_IDS)('keeps failed %s costs and physical contact until explicit zero-AP cleanup', id => {
    const s = promoted();
    for (const earlier of ZOMBIE_CASE_IDS.slice(0, ZOMBIE_CASE_IDS.indexOf(id))) complete(s, earlier, 'ORDINARY');
    begin(s, id); const ap = s.actionsRemaining, sp = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: id }, 100);
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, sp - 3]);
    expect(s.zombie.cases[id]).toMatchObject({ status: 'OBSERVED', contactOpen: true, outcome: 'NONE' });
    expect(s.zombie.practice).toEqual({ body: id === 'narrow-load' ? 'BRACED' : 'NORMAL', cold: id === 'cold-tray' ? 'ICED' : 'NONE', spirit: id === 'willing-spirit' ? 'PRESENT' : 'ABSENT' });
    expect(validateZombieState(s)).toBe(true); expect(zombieInside(s)).toBe(true);
    rejectActivity(s, { type: 'REPORT', caseId: id }); rejectActivity(s, { type: 'WITHDRAW', caseId: id }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; s.health = 1;
    activity(s, { type: 'CLOSE', caseId: id });
    expect([s.actionsRemaining, s.spirituality, s.health, s.mind]).toEqual([0, 0, 1, 0]);
    expect(s.zombie.practice).toEqual({ body: 'NORMAL', cold: id === 'cold-tray' ? 'THAWED' : 'NONE', spirit: id === 'willing-spirit' ? 'RELEASED' : 'ABSENT' });
    expect(validateZombieState(s)).toBe(true); expect(zombieInside(s)).toBe(false);
    s.actionsRemaining = 10; s.mind = 50;
    rejectActivity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    activity(s, { type: 'PERFORM', caseId: id }); activity(s, { type: 'CLOSE', caseId: id }); activity(s, { type: 'REPORT', caseId: id });
    expect(s.zombie.cases[id]!.closes).toBe(2); expect(validateZombieState(s)).toBe(true);
  });
  it('maintains real thin ice and a contact lock after success until actual thawing and securing', () => {
    const s = firstReport(); begin(s, 'cold-tray'); const sp = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'cold-tray' });
    expect([s.spirituality, s.zombie.practice.cold]).toEqual([sp - 3, 'ICED']);
    expect(zombieCases(s)[1]!.result).toContain('接触仍在'); rejectActivity(s, { type: 'REPORT', caseId: 'cold-tray' });
    const closed = activity(s, { type: 'CLOSE', caseId: 'cold-tray' });
    expect(closed.c.note).toHaveBeenCalledWith('实际结束本次接触', expect.stringContaining('融开本次薄冰'));
    expect(s.zombie.practice.cold).toBe('THAWED'); activity(s, { type: 'REPORT', caseId: 'cold-tray' });
    expect(validateZombieState(s)).toBe(true);
  });
  it('requests only existing willing Hem and corroborates his known crate mark with physical records', () => {
    const s = firstReport(); complete(s, 'cold-tray'); begin(s, 'willing-spirit');
    const done = activity(s, { type: 'PERFORM', caseId: 'willing-spirit' });
    expect(s.zombie.practice.spirit).toBe('PRESENT');
    const notes = JSON.stringify(vi.mocked(done.c.note).mock.calls);
    expect(notes).toContain('原地已经存在'); expect(notes).toContain('本人愿意配合'); expect(notes).toContain('原实物交接记录');
    rejectActivity(s, { type: 'REPORT', caseId: 'willing-spirit' });
    activity(s, { type: 'CLOSE', caseId: 'willing-spirit' });
    expect(s.zombie.practice.spirit).toBe('RELEASED'); activity(s, { type: 'REPORT', caseId: 'willing-spirit' });
    expect(s.zombie.cases['willing-spirit']!.outcome).toBe('MARK_CORROBORATED'); expect(validateZombieState(s)).toBe(true);
  });
  it('offers a truly ordinary zero-spirituality route through all reports and reflection to peace100', () => {
    const s = promoted(); s.spirituality = 0; const ap = s.actionsRemaining;
    for (const id of ZOMBIE_CASE_IDS) complete(s, id, 'ORDINARY');
    activity(s, { type: 'REFLECT' });
    expect([s.actionsRemaining, s.spirituality, s.progression.acting]).toEqual([ap - 13, 0, 100]);
    expect(s.zombie.practice).toEqual({ body: 'NORMAL', cold: 'NONE', spirit: 'ABSENT' });
    expect(zombieCases(s).every(r => r.result!.includes('普通方法'))).toBe(true);
    expect(validateZombieState(s)).toBe(true); rejectActivity(s, { type: 'REFLECT' });
  });
  it('withdraws an unperformed plan without creating an effect or refunding the paid preparation', () => {
    const s = promoted(); begin(s, 'narrow-load'); const ap = s.actionsRemaining, sp = s.spirituality;
    activity(s, { type: 'WITHDRAW', caseId: 'narrow-load' });
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap, sp]);
    expect(s.zombie.cases['narrow-load']).toMatchObject({ status: 'OBSERVED', method: null, contactOpen: false, withdrawals: 1 });
    expect(validateZombieState(s)).toBe(true);
  });
  it('permits a later ability preparation after an earlier ordinary failed test', () => {
    const s = firstReport(); begin(s, 'cold-tray', 'ORDINARY'); activity(s, { type: 'PERFORM', caseId: 'cold-tray' }, 100); activity(s, { type: 'CLOSE', caseId: 'cold-tray' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'cold-tray', method: 'ABILITY' });
    expect(validateZombieState(s)).toBe(true); activity(s, { type: 'PERFORM', caseId: 'cold-tray' }); expect(validateZombieState(s)).toBe(true);
  });
});

describe('Zombie original finite moon episodes replace old curse handling', () => {
  it('does not manufacture a four-week lunar calendar or activate before actual S6', () => {
    const old = werewolf(); old.week = 32; syncZombieMoon(old, context(old).c); expect(old.zombie.moon.pendingWeek).toBeNull();
    const s = promoted(); s.week = 36; syncZombieMoon(s, context(s).c); expect(s.zombie.moon.pendingWeek).toBeNull();
    expect(WEREWOLF_MOON_EVENTS.map(x => x.week)).toEqual([32, 37, 41, 46, 51, 55, 60, 65]);
  });
  it.each([{ method: 'GUARDED' as const, cost: 10 }, { method: 'ALONE' as const, cost: 20 }])('actually passes an episode with $method at zero AP without healing or growth', ({ method, cost }) => {
    const s = firstReport(); s.week = 32; const ctx = context(s); syncZombieMoon(s, ctx.c);
    expect(s.zombie.moon.pendingWeek).toBe(32); expect(zombieInside(s)).toBe(true);
    expect(zombieActions(s).map(a => a.command.type)).toEqual(['HANDLE_MOON', 'HANDLE_MOON']);
    rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); rejectActivity(s, { type: 'OBSERVE', caseId: 'cold-tray' });
    s.actionsRemaining = 0; const before = { health: s.health, mind: s.mind, sp: s.spirituality, acting: s.progression.acting, mastery: { ...s.progression.mastery }, old: structuredClone(s.werewolf.moon) };
    activity(s, { type: 'HANDLE_MOON', method });
    expect([s.actionsRemaining, s.health, s.mind, s.spirituality, s.progression.acting]).toEqual([0, before.health, before.mind - cost, before.sp, before.acting]);
    expect(s.progression.mastery).toEqual(before.mastery); expect(s.werewolf.moon).toEqual(before.old);
    expect(s.zombie.moon).toEqual({ pendingWeek: null, history: [{ week: 32, method, mentalCost: cost }] });
    syncZombieMoon(s, ctx.c); expect(s.zombie.moon.pendingWeek).toBeNull(); expect(validateZombieState(s)).toBe(true);
  });
  it('keeps a handled old S7 episode and never charges its S6 form twice', () => {
    const s = promoted(); s.week = 32; s.werewolf.moon.history.push({ week: 32, method: 'GUARDED', mentalCost: 10 });
    const old = structuredClone(s.werewolf.moon); syncZombieMoon(s, context(s).c);
    expect(s.werewolf.moon).toEqual(old); expect(s.zombie.moon.pendingWeek).toBeNull();
    s.zombie.moon.history.push({ week: 32, method: 'ALONE', mentalCost: 20 }); expect(validateZombieState(s)).toBe(false);
  });
  it('waits for actual contact cleanup before beginning the authored moon episode', () => {
    const s = promoted(); s.week = 32; begin(s, 'narrow-load'); activity(s, { type: 'PERFORM', caseId: 'narrow-load' });
    syncZombieMoon(s, context(s).c); expect(s.zombie.moon.pendingWeek).toBeNull();
    activity(s, { type: 'CLOSE', caseId: 'narrow-load' }); syncZombieMoon(s, context(s).c); expect(s.zombie.moon.pendingWeek).toBe(32);
    expect(validateZombieState(s)).toBe(true);
  });
  it('has no remote Harlan guard and safely spends only remaining mind on actual isolation', () => {
    const s = promoted(); s.week = 37; s.world.city = 'ELSEWHERE'; s.mind = 3; syncZombieMoon(s, context(s).c);
    rejectActivity(s, { type: 'HANDLE_MOON', method: 'GUARDED' }); activity(s, { type: 'HANDLE_MOON', method: 'ALONE' });
    expect(s.mind).toBe(0); expect(s.zombie.moon.history[0]!.mentalCost).toBe(3); expect(validateZombieState(s)).toBe(true);
  });
  it('skips active events, active combat, handled episodes, and post-list extrapolation', () => {
    const s = firstReport(); s.week = 32; activity(s, { type: 'ENCOUNTER_FIGHT' }); syncZombieMoon(s, context(s).c); expect(s.zombie.moon.pendingWeek).toBeNull();
    settleZombieEncounter(s, 'RETREATED', context(s).c, context(s).award); s.week = 68; syncZombieMoon(s, context(s).c); expect(s.zombie.moon.pendingWeek).toBeNull();
    expect(projectZombie(s).moon.summary).toContain('不代表诅咒消失');
  });
});

describe('Zombie courtyard dispute and strict save boundaries', () => {
  it('requires a real report and establishes only the original reachable courtyard opponent', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    complete(s, 'narrow-load'); const ap = s.actionsRemaining; activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.combat?.encounterId).toBe('ZOMBIE_DISPUTE'); expect(hasZombieDisputeOpponent(s)).toBe(true); expect(validateZombieState(s)).toBe(true);
    const ctx = context(s); settleZombieEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect(ctx.award).not.toHaveBeenCalled(); expect(s.combat).toBeNull(); expect(s.zombie.encounter.status).toBe('RETREATED'); expect(validateZombieState(s)).toBe(true);
  });
  it('awards only living effective participation once, without extra acting or healing', () => {
    const s = firstReport(), acting = s.progression.acting; activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [{ actor: 'PLAYER', label: '真实原地打击', selfGain: 1, enemyReduction: 0 }], playerAdvantage: 1, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s), health = s.health, sp = s.spirituality; settleZombieEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('zombie-dispute', 25); expect([s.progression.acting, s.health, s.spirituality]).toEqual([acting, health, sp]); expect(validateZombieState(s)).toBe(true);
    expect(() => settleZombieEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
  });
  it('preserves real death without revival or reward, and gives no award for an empty victory', () => {
    const s = firstReport(); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD'; s.health = 0; const ctx = context(s);
    settleZombieEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.health, s.zombie.encounter.status, s.combat]).toEqual(['DEAD', 0, 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled(); expect(validateZombieState(s)).toBe(true);
    const empty = firstReport(); activity(empty, { type: 'ENCOUNTER_FIGHT' }); const other = context(empty);
    settleZombieEncounter(empty, 'ENEMY_SURRENDERED', other.c, other.award); expect(other.award).not.toHaveBeenCalled(); expect(validateZombieState(empty)).toBe(true);
  });
  it('talk respects refusal and a later voluntary result, with no free acting or mastery', () => {
    const s = firstReport(), before = structuredClone(s.progression); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.zombie.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.zombie.encounter.status).toBe('RESOLVED'); expect(s.progression).toEqual(before); expect(validateZombieState(s)).toBe(true);
  });
  it('rejects malformed commands before any spending or checks', () => {
    const s = promoted();
    for (const c of [{ type: 'HANDLE_MOON', method: 'FOOD' }, { type: 'OBSERVE', caseId: 'future-spirit' }, { type: 'PREPARE', caseId: 'cold-tray', method: 'ABILITY', free: true }, { type: 'VERIFY', caseId: 'willing-spirit' }, { type: 'COMPOSE' }]) {
      expect(validateZombieCommand(c)).toBe(false); rejectActivity(s, c);
    }
    rejectAcquisition(s, { type: 'CONSUME', bottleId: 'werewolf-potion-1', confirmed: true });
  });
  it('rejects counterfeit practice, moon, acting, duplicated award and original provenance', () => {
    const s = firstReport();
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.zombie.practice.cold = 'ICED'; },
      v => { v.zombie.practice.spirit = 'PRESENT'; },
      v => { v.zombie.moon.pendingWeek = 30; },
      v => { v.zombie.moon.history.push({ week: 28, method: 'ALONE', mentalCost: 20 }); },
      v => { v.progression.acting += 25; },
      v => { v.seer.completedSources.push('zombie-case:narrow-load'); },
      v => { v.zombie.bottles[0]!.source = 'free conjured potion'; },
      v => { (v.zombie as unknown as Record<string, unknown>).moon = null; },
      v => { (v.zombie as unknown as Record<string, unknown>).practice = []; },
    ];
    for (const mutate of mutations) { const forged = structuredClone(s); mutate(forged); expect(validateZombieState(forged)).toBe(false); }
  });
});
