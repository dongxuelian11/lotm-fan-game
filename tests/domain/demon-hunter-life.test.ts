import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyDemonHunterCommand, createDemonHunterState, validateDemonHunterState } from '../../src/domain/demon-hunter/index.js';
import { applyDemonHunterActivity, createDemonHunterLifeState, demonHunterActivityReason, demonHunterLifeActions, hasDemonHunterLifeLock, projectDemonHunterLife, validateDemonHunterActivityCommand, validateDemonHunterLife, DEMON_HUNTER_CASE_IDS, type DemonHunterActivityCommand, type DemonHunterCaseId } from '../../src/domain/demon-hunter/life.js';
import type { DemonHunterAbilityId } from '../../src/domain/demon-hunter/types.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((abilityId: DemonHunterAbilityId, amount = 8) => { s.progression.mastery[abilityId] = (s.progression.mastery[abilityId] ?? 0) + amount; });
  return { ctx, award };
}
function oldS5(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/guardian-v01070/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.demonHunter = createDemonHunterState();
  const week = Math.max(s.week, s.guardian.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.perception = 24; s.character.coreStats.knowledge = 24;
  return s;
}
function promoted() {
  const s = oldS5(), c = context(s).ctx;
  applyDemonHunterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyDemonHunterCommand(s, { type: 'BUY_POTION', bottleId: 'demon-hunter-potion-1' }, c);
  applyDemonHunterCommand(s, { type: 'CONSUME', bottleId: 'demon-hunter-potion-1', confirmed: true }, c);
  return s;
}
function act(s: SliceState, command: DemonHunterActivityCommand, roll = 1) {
  const c = context(s, roll); applyDemonHunterActivity(s, command, c.ctx, c.award);
  expect(validateDemonHunterLife(s), `invalid life after ${JSON.stringify(command)}`).toBe(true);
  return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDemonHunterActivity(s, command as DemonHunterActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: DemonHunterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  if (s.demonHunter.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function finish(s: SliceState, caseId: DemonHunterCaseId) {
  if (s.demonHunter.life.probe.location === 'SHARD_CHAMBER') act(s, { type: 'WITHDRAW_PROBE', caseId: 'tailored-coating' });
  if (s.demonHunter.life.player.location === 'SCREEN_END') act(s, { type: 'RETURN_ROUTE', caseId: 'concealed-approach' });
  act(s, { type: 'CLOSE', caseId });
  return act(s, { type: 'REPORT', caseId });
}
function complete(s: SliceState, caseId: DemonHunterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId });
  if (caseId === 'tailored-coating' && method === 'ABILITY') act(s, { type: 'TEST_PROBE', caseId });
  return finish(s, caseId);
}
function reachCoating(s: SliceState) { complete(s, 'sealed-sample'); }
function reachMoth(s: SliceState) { reachCoating(s); complete(s, 'tailored-coating'); }
const nextWeek = (s: SliceState) => { s.week += 1; s.date = addGameWeeks(s.date, 1); };
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(args => args.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.warrior, s.gladiator, s.weaponmaster, s.dawnPaladin, s.guardian, s.combatHistory, s.world, s.town]);
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)]));
  return value;
}

describe('Demon Hunter finite original-object life cases', () => {
  it('is pristine and hidden before promotion, retaining the Guardian history', () => {
    const old = oldS5(); expect(validateDemonHunterLife(old)).toBe(true);
    expect(demonHunterLifeActions(old)).toEqual([]); expect(projectDemonHunterLife(old)).toEqual({ cases: [], insideCase: false, environment: '', practice: null });
    const s = promoted(); expect(s.demonHunter.life).toEqual(createDemonHunterLifeState()); expect(validateDemonHunterState(s)).toBe(true);
    expect(projectDemonHunterLife(s).cases.map(x => x.id)).toEqual([...DEMON_HUNTER_CASE_IDS]);
    expect(projectDemonHunterLife(s).environment).toContain('原创G');
  });

  it.each([null, {}, { type: 'OBSERVE', caseId: 'unknown' }, { type: 'PREPARE', caseId: 'sealed-sample', method: 'FREE' }, { type: 'PERFORM', caseId: 'sealed-sample', targetId: 'a-person' }, { type: 'TEST_PROBE', caseId: 'sealed-sample' }, { type: 'WITHDRAW_PROBE', caseId: 'concealed-approach' }, { type: 'RETURN_ROUTE', caseId: 'tailored-coating' }, { type: 'RUSTLE', caseId: 'sealed-sample' }, { type: 'REFLECT', acting: 100 }, { type: 'TELEPORT', caseId: 'concealed-approach' }])('rejects malformed or unbounded commands before mutation: %j', command => {
    expect(validateDemonHunterActivityCommand(command)).toBe(false); reject(promoted(), command);
  });

  it('gates the second case on the actual first report and the third on the second', () => {
    const s = promoted(); reject(s, { type: 'OBSERVE', caseId: 'tailored-coating' }); reject(s, { type: 'OBSERVE', caseId: 'concealed-approach' });
    begin(s, 'sealed-sample'); act(s, { type: 'PERFORM', caseId: 'sealed-sample' }); act(s, { type: 'CLOSE', caseId: 'sealed-sample' });
    reject(s, { type: 'OBSERVE', caseId: 'tailored-coating' }); act(s, { type: 'REPORT', caseId: 'sealed-sample' });
    act(s, { type: 'OBSERVE', caseId: 'tailored-coating' }); reject(s, { type: 'OBSERVE', caseId: 'concealed-approach' });
  });

  it('ordinary reports and reflection give finite peaceful100 without fake mastery or effect', () => {
    const s = promoted(), old = originals(s), ap = s.actionsRemaining, cash = s.cash, spirit = s.spirituality, mastery = structuredClone(s.progression.mastery);
    for (const id of DEMON_HUNTER_CASE_IDS) expect(complete(s, id).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(75); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery); expect(originals(s)).toEqual(old);
    expect([s.actionsRemaining, s.cash, s.spirituality]).toEqual([ap - 13, cash - 60, spirit]);
    expect(s.demonHunter.life.samples).toMatchObject({ finding: 'RECORDS_UNCERTAIN', residualStrength: 30, recordCompared: true });
    expect(s.demonHunter.life.reagentKits).toEqual([]); expect(s.demonHunter.life.probe.tests).toBe(0); expect(s.demonHunter.life.player.walks).toBe(0);
    expect(validateDemonHunterState(s)).toBe(true);
    for (const id of DEMON_HUNTER_CASE_IDS) reject(s, { type: 'REPORT', caseId: id }); reject(s, { type: 'REFLECT' });
  });

  it('three ability reports keep distinct actual results and one mastery award per new ability', () => {
    const s = promoted(), old = originals(s), cash = s.cash, spirit = s.spirituality;
    const reports = DEMON_HUNTER_CASE_IDS.map(id => complete(s, id, 'ABILITY')); act(s, { type: 'REFLECT' });
    expect(reports[0]!.award).toHaveBeenCalledExactlyOnceWith('warrior.s4.discern-corruption', 8);
    expect(reports[1]!.award).toHaveBeenCalledExactlyOnceWith('warrior.s4.targeted-preparation', 8);
    expect(reports[2]!.award).toHaveBeenCalledExactlyOnceWith('warrior.s4.veil-intent', 8);
    expect([s.cash, s.spirituality, s.progression.acting]).toEqual([cash - 150, spirit - 10, 100]); expect(originals(s)).toEqual(old);
    expect(s.demonHunter.life.samples.residualStrength).toBe(20); expect(s.demonHunter.life.player.distanceMetres).toBe(4); expect(hasDemonHunterLifeLock(s)).toBe(false);
  });

  it.each(['ABILITY', 'ORDINARY'] as const)('requires the paid physical60p protective kit for %s sample preparation', method => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'sealed-sample' }); s.cash = 59;
    reject(s, { type: 'PREPARE', caseId: 'sealed-sample', method });
    s.cash = 60; act(s, { type: 'PREPARE', caseId: 'sealed-sample', method }); expect(s.cash).toBe(0); expect(s.demonHunter.life.paidProtectionKits).toBe(1);
    expect(hasDemonHunterLifeLock(s)).toBe(false); expect(s.demonHunter.life.samples.shardLid).toBe('CLOSED');
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    act(s, { type: 'WITHDRAW', caseId: 'sealed-sample' }); expect(s.cash).toBe(0); expect(s.demonHunter.life.paidProtectionKits).toBe(1);
  });

  it('opens and relids both original sample cabinets and gives only bounded trace evidence', () => {
    const s = promoted(), old = originals(s); begin(s, 'sealed-sample'); const c = act(s, { type: 'PERFORM', caseId: 'sealed-sample' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('perception', 18); expect(s.demonHunter.life.samples).toMatchObject({ shardId: 'DH4-SHARD-1', sootId: 'DH4-SOOT-1', shardLid: 'OPEN', sootLid: 'OPEN', innerSeals: 'INTACT', finding: 'LIMITED_TRACE' });
    expect(notes(c)).toContain('没有物主身份或完整历史'); reject(s, { type: 'REPORT', caseId: 'sealed-sample' }); expect(hasDemonHunterLifeLock(s)).toBe(true);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; act(s, { type: 'CLOSE', caseId: 'sealed-sample' });
    expect(s.demonHunter.life.samples).toMatchObject({ shardLid: 'CLOSED', sootLid: 'CLOSED', residualStrength: 30 }); expect(hasDemonHunterLifeLock(s)).toBe(false); expect(originals(s)).toEqual(old);
  });

  it('a failed sample check spends actual resources, requires closure, and waits a real week', () => {
    const s = promoted(); begin(s, 'sealed-sample'); const ap = s.actionsRemaining, spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'sealed-sample' }, 100); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 3]);
    expect(s.demonHunter.life.samples.finding).toBe('UNKNOWN'); reject(s, { type: 'REPORT', caseId: 'sealed-sample' });
    act(s, { type: 'CLOSE', caseId: 'sealed-sample' }); reject(s, { type: 'PREPARE', caseId: 'sealed-sample', method: 'ORDINARY' });
    nextWeek(s); complete(s, 'sealed-sample'); expect(s.demonHunter.life.cases['sealed-sample']).toMatchObject({ attempts: 2, closes: 2, status: 'RESOLVED' }); expect(s.demonHunter.life.paidProtectionKits).toBe(2);
  });

  it('paid fictional reagents remain distinct sealed originals until actual performance', () => {
    const s = promoted(); reachCoating(s); const cash = s.cash; begin(s, 'tailored-coating');
    expect(s.cash).toBe(cash - 90); expect(s.demonHunter.life.currentKitId).toBe(1);
    expect(s.demonHunter.life.reagentKits[0]!.doses).toEqual([{ id: 'DH4-REAGENT-1-A', name: '暮星凝露（虚构G）', status: 'SEALED' }, { id: 'DH4-REAGENT-1-B', name: '灰月印脂（虚构G）', status: 'SEALED' }]);
    expect(s.demonHunter.life.probe).toMatchObject({ id: 'DH4-PROBE-1', location: 'RACK', coatingKitId: null, tests: 0 }); expect(s.demonHunter.life.samples.residualStrength).toBe(30);
    reject(s, { type: 'TEST_PROBE', caseId: 'tailored-coating' });
  });

  it('manufacture, insertion, original-probe withdrawal and closure are separate real steps', () => {
    const s = promoted(); reachCoating(s); begin(s, 'tailored-coating'); const spirit = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'tailored-coating' }); expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18); expect(s.spirituality).toBe(spirit - 4);
    expect(s.demonHunter.life.reagentKits[0]).toMatchObject({ coatingProduced: true, coatingUsed: false }); expect(s.demonHunter.life.reagentKits[0]!.doses.every(d => d.status === 'SPENT')).toBe(true);
    expect(s.demonHunter.life.samples.residualStrength).toBe(30); expect(s.demonHunter.life.probe.coatingKitId).toBe(1); reject(s, { type: 'REPORT', caseId: 'tailored-coating' });
    s.actionsRemaining = 0; s.spirituality = 0; s.cash = 0; s.mind = 0;
    act(s, { type: 'TEST_PROBE', caseId: 'tailored-coating' }); expect(s.demonHunter.life.samples.residualStrength).toBe(20); expect(s.demonHunter.life.probe.location).toBe('SHARD_CHAMBER');
    expect(s.demonHunter.life.reagentKits[0]!.coatingUsed).toBe(true); reject(s, { type: 'TEST_PROBE', caseId: 'tailored-coating' }); reject(s, { type: 'CLOSE', caseId: 'tailored-coating' });
    act(s, { type: 'WITHDRAW_PROBE', caseId: 'tailored-coating' }); expect(s.demonHunter.life.samples.shardLid).toBe('CLOSED'); expect(s.demonHunter.life.probe).toMatchObject({ location: 'RACK', tests: 1, withdrawals: 1, coatingKitId: null });
    act(s, { type: 'CLOSE', caseId: 'tailored-coating' }); expect([s.actionsRemaining, s.spirituality, s.cash, s.mind]).toEqual([0, 0, 0, 0]); expect(s.demonHunter.life.samples.residualStrength).toBe(20);
  });

  it('a failed coating consumes both original doses and only a next-week purchase creates new identities', () => {
    const s = promoted(); reachCoating(s); begin(s, 'tailored-coating'); act(s, { type: 'PERFORM', caseId: 'tailored-coating' }, 100);
    expect(s.demonHunter.life.reagentKits[0]).toMatchObject({ coatingProduced: false, coatingUsed: false }); expect(s.demonHunter.life.reagentKits[0]!.doses.every(d => d.status === 'SPENT')).toBe(true);
    expect(s.demonHunter.life.samples.residualStrength).toBe(30); expect(s.demonHunter.life.probe.coatingKitId).toBeNull(); reject(s, { type: 'TEST_PROBE', caseId: 'tailored-coating' });
    act(s, { type: 'CLOSE', caseId: 'tailored-coating' }); reject(s, { type: 'PREPARE', caseId: 'tailored-coating', method: 'ABILITY' });
    nextWeek(s); complete(s, 'tailored-coating', 'ABILITY');
    expect(s.demonHunter.life.reagentKits).toHaveLength(2); expect(s.demonHunter.life.reagentKits[1]!.doses[0].id).toBe('DH4-REAGENT-2-A'); expect(s.demonHunter.life.samples.residualStrength).toBe(20);
    expect(s.demonHunter.life.reagentKits[0]!.coatingProduced).toBe(false); expect(s.demonHunter.life.reagentKits[1]!.coatingUsed).toBe(true);
  });

  it('can discard unperformed paid doses and use the free ordinary second route without refund', () => {
    const s = promoted(); reachCoating(s); begin(s, 'tailored-coating'); const cash = s.cash;
    act(s, { type: 'WITHDRAW', caseId: 'tailored-coating' }); expect(s.cash).toBe(cash); expect(s.demonHunter.life.currentKitId).toBeNull(); expect(s.demonHunter.life.reagentKits[0]!.doses.every(d => d.status === 'DISCARDED')).toBe(true);
    s.cash = 0; s.spirituality = 0; expect(complete(s, 'tailored-coating').award).not.toHaveBeenCalled(); expect(s.demonHunter.life.probe.tests).toBe(0); expect(s.demonHunter.life.samples.residualStrength).toBe(30);
  });

  it('abandoning a successful but untested coating destroys only that coating and defers retry', () => {
    const s = promoted(); reachCoating(s); begin(s, 'tailored-coating'); act(s, { type: 'PERFORM', caseId: 'tailored-coating' });
    act(s, { type: 'CLOSE', caseId: 'tailored-coating' }); expect(s.demonHunter.life.reagentKits[0]).toMatchObject({ coatingProduced: true, coatingUsed: false, coatingDiscarded: true });
    expect(s.demonHunter.life.cases['tailored-coating']).toMatchObject({ status: 'OBSERVED', lastOutcome: 'INTERRUPTED', taskComplete: false }); expect(s.demonHunter.life.samples.residualStrength).toBe(30);
    reject(s, { type: 'REPORT', caseId: 'tailored-coating' }); reject(s, { type: 'PREPARE', caseId: 'tailored-coating', method: 'ORDINARY' });
    nextWeek(s); complete(s, 'tailored-coating'); expect(s.demonHunter.life.samples.residualStrength).toBe(30); expect(s.demonHunter.life.reagentKits[0]!.coatingDiscarded).toBe(true);
  });

  it('uses the original sightglass at the start for the free ordinary moth route', () => {
    const s = promoted(); reachMoth(s); s.cash = 0; s.spirituality = 0;
    begin(s, 'concealed-approach', 'ORDINARY'); const c = act(s, { type: 'PERFORM', caseId: 'concealed-approach' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(notes(c)).toContain('留在实际起点');
    expect(s.demonHunter.life.player).toEqual({ location: 'START_MARK', walks: 0, distanceMetres: 0 }); expect(s.demonHunter.life.moth.intentVeiled).toBe(false);
    reject(s, { type: 'RETURN_ROUTE', caseId: 'concealed-approach' }); expect(finish(s, 'concealed-approach').award).not.toHaveBeenCalled();
  });

  it('actually advances two metres under the screen, then requires the same real return before closure', () => {
    const s = promoted(); reachMoth(s); begin(s, 'concealed-approach'); const spirit = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'concealed-approach' }); expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('will', 18); expect(s.spirituality).toBe(spirit - 3);
    expect(s.demonHunter.life.player).toEqual({ location: 'SCREEN_END', walks: 1, distanceMetres: 2 }); expect(s.demonHunter.life.moth).toMatchObject({ id: 'DH4-MOTH-1', location: 'INSIDE_CAGE', sight: true, hearing: true, intentVeiled: true, alerted: false });
    reject(s, { type: 'CLOSE', caseId: 'concealed-approach' }); reject(s, { type: 'REPORT', caseId: 'concealed-approach' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; s.cash = 0;
    act(s, { type: 'RETURN_ROUTE', caseId: 'concealed-approach' }); expect(s.demonHunter.life.player).toEqual({ location: 'START_MARK', walks: 2, distanceMetres: 4 }); expect(s.demonHunter.life.moth.intentVeiled).toBe(false);
    act(s, { type: 'CLOSE', caseId: 'concealed-approach' }); expect(s.demonHunter.life.moth).toMatchObject({ cover: 'COVERED', covers: 1 }); expect(hasDemonHunterLifeLock(s)).toBe(false);
  });

  it('physical rustling alerts this original moth despite hidden intent and does not teleport on interruption', () => {
    const s = promoted(); reachMoth(s); begin(s, 'concealed-approach'); act(s, { type: 'PERFORM', caseId: 'concealed-approach' });
    act(s, { type: 'RUSTLE', caseId: 'concealed-approach' }); expect(s.demonHunter.life.moth).toMatchObject({ alerted: true, intentVeiled: true, hearing: true, rustles: 1, alerts: 1 });
    expect(s.demonHunter.life.player.location).toBe('SCREEN_END'); expect(s.demonHunter.life.cases['concealed-approach']).toMatchObject({ checkedSuccess: true, taskComplete: false, lastOutcome: 'INTERRUPTED' });
    reject(s, { type: 'RUSTLE', caseId: 'concealed-approach' }); reject(s, { type: 'CLOSE', caseId: 'concealed-approach' });
    act(s, { type: 'RETURN_ROUTE', caseId: 'concealed-approach' }); expect(s.demonHunter.life.moth.alerted).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'concealed-approach' }); expect(s.demonHunter.life.moth.alerted).toBe(false); reject(s, { type: 'REPORT', caseId: 'concealed-approach' });
    reject(s, { type: 'PREPARE', caseId: 'concealed-approach', method: 'ABILITY' }); nextWeek(s); complete(s, 'concealed-approach', 'ABILITY');
    expect(s.demonHunter.life.player.distanceMetres).toBe(8); expect(s.demonHunter.life.moth).toMatchObject({ rustles: 1, alerts: 1, covers: 2 });
  });

  it('failed concealment stays at the actual start, spends spirit and retains alert until the supervisor covers', () => {
    const s = promoted(); reachMoth(s); begin(s, 'concealed-approach'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'concealed-approach' }, 100); expect(s.spirituality).toBe(spirit - 3); expect(s.demonHunter.life.player.walks).toBe(0);
    expect(s.demonHunter.life.moth).toMatchObject({ alerted: true, cover: 'OPEN', intentVeiled: false }); reject(s, { type: 'RETURN_ROUTE', caseId: 'concealed-approach' });
    act(s, { type: 'CLOSE', caseId: 'concealed-approach' }); expect(s.demonHunter.life.moth).toMatchObject({ alerted: false, cover: 'COVERED', alerts: 1 });
    nextWeek(s); complete(s, 'concealed-approach'); expect(s.demonHunter.life.moth.alerts).toBe(1);
  });

  it('projects exact costs, cleanup and original object facts without offering free all-knowing powers', () => {
    const s = promoted(); begin(s, 'sealed-sample');
    expect(demonHunterLifeActions(s).find(a => a.command.type === 'PERFORM')?.cost).toContain('3灵性');
    act(s, { type: 'PERFORM', caseId: 'sealed-sample' });
    const actions = demonHunterLifeActions(s); expect(actions.find(a => a.command.type === 'CLOSE')?.enabled).toBe(true); expect(actions.find(a => a.command.type === 'REPORT')?.enabled).toBe(false);
    const projection = projectDemonHunterLife(s); expect(projection.practice!.samples).toContain('DH4-SHARD-1'); expect(projection.practice!.samples).toContain('DH4-SOOT-1'); expect(projection.practice!.moth).toContain('视力与听力一直存在'); expect(projection.environment).toContain('没有神话形态展示');
  });

  it('resource gating is transactional and exposes an affordable cancellation instead of trapping preparation', () => {
    const s = promoted(); begin(s, 'sealed-sample'); s.spirituality = 2;
    reject(s, { type: 'PERFORM', caseId: 'sealed-sample' }); expect(demonHunterActivityReason(s, { type: 'PERFORM', caseId: 'sealed-sample' })).toContain('3灵性');
    s.actionsRemaining = 0; s.mind = 0; act(s, { type: 'WITHDRAW', caseId: 'sealed-sample' });
    expect(s.demonHunter.life.cases['sealed-sample'].attempts).toBe(0); expect(s.demonHunter.life.paidProtectionKits).toBe(1);
  });

  it('survives ordinary JSON and canonical reordered-key roundtrips at physical action boundaries', () => {
    const s = promoted();
    const roundtrip = () => { for (const data of [JSON.parse(JSON.stringify(s)), JSON.parse(stableStringify(s)), reverseKeys(s)]) expect(validateDemonHunterLife(data as SliceState)).toBe(true); };
    roundtrip(); complete(s, 'sealed-sample', 'ABILITY'); roundtrip(); begin(s, 'tailored-coating'); roundtrip();
    act(s, { type: 'PERFORM', caseId: 'tailored-coating' }); roundtrip(); act(s, { type: 'TEST_PROBE', caseId: 'tailored-coating' }); roundtrip(); finish(s, 'tailored-coating'); roundtrip();
    begin(s, 'concealed-approach'); act(s, { type: 'PERFORM', caseId: 'concealed-approach' }); roundtrip(); act(s, { type: 'RUSTLE', caseId: 'concealed-approach' }); roundtrip();
    act(s, { type: 'RETURN_ROUTE', caseId: 'concealed-approach' }); roundtrip(); act(s, { type: 'CLOSE', caseId: 'concealed-approach' }); roundtrip();
    expect(validateDemonHunterLife(reverseKeys(oldS5()) as SliceState)).toBe(true);
  });

  it.each([
    ['new shard identity', (s: SliceState) => { (s.demonHunter.life.samples as { shardId: string }).shardId = 'OTHER'; }],
    ['unearned strength reduction', (s: SliceState) => { s.demonHunter.life.samples.residualStrength = 20; }],
    ['phantom probe insertion', (s: SliceState) => { s.demonHunter.life.probe.location = 'SHARD_CHAMBER'; }],
    ['phantom two-metre movement', (s: SliceState) => { s.demonHunter.life.player.location = 'SCREEN_END'; }],
    ['free protective kit', (s: SliceState) => { s.demonHunter.life.paidProtectionKits = 1; }],
    ['open moth cover without scene', (s: SliceState) => { s.demonHunter.life.moth.cover = 'OPEN'; }],
    ['silenced moth', (s: SliceState) => { (s.demonHunter.life.moth as { hearing: boolean }).hearing = false; }],
    ['free acting', (s: SliceState) => { s.progression.acting = 25; }],
    ['forged report source', (s: SliceState) => { s.seer.completedSources.push('demon-hunter-case:sealed-sample'); }],
    ['free reflection', (s: SliceState) => { s.demonHunter.life.reflected = true; }],
  ] as const)('rejects impossible persisted facts: %s', (_name, mutate) => { const s = promoted(); mutate(s); expect(validateDemonHunterLife(s)).toBe(false); });

  it('rejects reused original dose identities, restored doses, false target and falsely withdrawn probe', () => {
    const s = promoted(); reachCoating(s); begin(s, 'tailored-coating'); act(s, { type: 'PERFORM', caseId: 'tailored-coating' }); act(s, { type: 'TEST_PROBE', caseId: 'tailored-coating' });
    const badId = structuredClone(s); badId.demonHunter.life.reagentKits[0]!.doses[1].id = 'DH4-REAGENT-1-A'; expect(validateDemonHunterLife(badId)).toBe(false);
    const restored = structuredClone(s); restored.demonHunter.life.reagentKits[0]!.doses.forEach(d => { d.status = 'SEALED'; }); expect(validateDemonHunterLife(restored)).toBe(false);
    const wrong = structuredClone(s); (wrong.demonHunter.life.reagentKits[0]! as { targetId: string }).targetId = 'DH4-CINDER-GUARD'; expect(validateDemonHunterLife(wrong)).toBe(false);
    const returned = structuredClone(s); returned.demonHunter.life.probe.location = 'RACK'; expect(validateDemonHunterLife(returned)).toBe(false);
  });
});
