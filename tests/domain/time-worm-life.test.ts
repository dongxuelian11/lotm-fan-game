import { describe, expect, it } from 'vitest';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { validateFateTrojanSiteState } from '../../src/domain/fate-trojan/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import {
  TIME_WORM_CASE_IDS, createTimeWormLifeState, initializeTimeWormLifeState, timeWormOriginalSnapshot, timeWormExpectedOriginals, timeWormLifeMasteryGains,
  hasTimeWormLifeLock, validateTimeWormActivityCommand, validateTimeWormLifeState, blockTimeWormLife, timeWormLifeActions, projectTimeWormLife,
  type TimeWormActivityCommand, type TimeWormCaseId,
} from '../../src/domain/time-worm/life.js';
import { ae, ordinary, originalFateTrojan, promoted, ready, rejectTimeWorm, rejectIntent, fateTrojanNaturalPath } from './time-worm-directed-helper.js';

// Directed checks use the full raw551 living source through the real migration,
// paid care/work/preparation and original bottles. No seed/cursor is rewritten.
const THEFT = 'error.s1.short-time-theft', RELEASE = 'error.s1.time-release';
const succeeds = (v: string | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const attempt = (s: SliceState, id: TimeWormCaseId = s.timeWorm.life.activeCase!) => s.timeWorm.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, ...commands: TimeWormActivityCommand[]): SliceState {
  for (const command of commands) {
    const before = structuredClone(s); s = ae(s, command);
    expect(s.timeWorm.life.journal.length).toBe(before.timeWorm.life.journal.length + 1);
    expect(validateTimeWormLifeState(s), JSON.stringify(command)).toBe(true); assertValidSliceState(s);
    expect(s.timeWorm.sourceHistory).toEqual(before.timeWorm.sourceHistory);
    expect(s.fateTrojan.life.journal).toEqual(before.fateTrojan.life.journal); expect(s.fateTrojan.life.cases).toEqual(before.fateTrojan.life.cases);
    for (const key of ['cabinet', 'parcel', 'link', 'fate', 'seals'] as const) expect(s.fateTrojan.life.site[key]).toEqual(before.fateTrojan.life.site[key]);
    expect(s.fateTrojan.encounter).toEqual(before.fateTrojan.encounter); expect(s.parasite).toEqual(before.parasite);
  }
  return s;
}
function prepare(s: SliceState, caseId: TimeWormCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', lastAp = false): SliceState {
  s = ready(s, { cash: 200, health: 100, mind: 30, spirituality: 30 });
  if (s.fateTrojan.life.site.playerEnergy < 9) s = act(s, { type: 'RECOVER_ENERGY' });
  s = act(s, { type: 'OBSERVE', caseId }); s = ready(s, { ap: 1, cash: 200, mind: 30, spirituality: 30 });
  if (lastAp) while (s.actionsRemaining > 1) s = ordinary(s);
  return act(s, { type: 'PREPARE', caseId, method });
}
function enter(s: SliceState, caseId: TimeWormCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', lastAp = false): SliceState {
  return act(prepare(s, caseId, method, lastAp), { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'OBSERVER' },
    { type: method === 'ABILITY' ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'ABILITY' }, { type: 'APPROACH' }, { type: 'BASELINE_LOOK' }, { type: 'DECLARE_LOOK' });
}
function finish(s: SliceState, id: TimeWormCaseId): SliceState {
  const a = attempt(s);
  if (a.declaration?.state === 'DELAYED' && s.timeWorm.life.clockSeconds < a.declaration.dueAt) s = act(s, { type: 'WAIT_3' });
  if (['PENDING', 'DELAYED'].includes(attempt(s).declaration?.state ?? '')) s = act(s, { type: 'EXECUTE_LOOK' });
  if (s.timeWorm.life.pending) s = act(s, { type: 'STOP_METHOD' });
  s = act(s, { type: 'EXIT_ROOM' }, { type: 'LEAVE' }); return act(ready(s), { type: 'REPORT', caseId: id });
}
let firstCache: SliceState | undefined, secondCache: SliceState | undefined;
const afterFirst = () => structuredClone(firstCache ??= finish(enter(promoted(), 'delayed-observation'), 'delayed-observation'));
const afterSecond = () => structuredClone(secondCache ??= finish(enter(afterFirst(), 'released-interval'), 'released-interval'));
function expected(s: SliceState, command: 'SHORT_TIME_THEFT' | 'TIME_RELEASE' | 'COMPARE_LABEL') {
  const ability = command === 'SHORT_TIME_THEFT' ? 'perception' : command === 'TIME_RELEASE' ? 'will' : 'knowledge', rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
  const power = command !== 'COMPARE_LABEL', mastery = timeWormLifeMasteryGains(s)[command === 'TIME_RELEASE' ? RELEASE : THEFT];
  const bonus = command === 'COMPARE_LABEL' && s.timeWorm.life.pending?.state === 'RELEASED' && projectTimeWormLife(s).pendingUsable;
  return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty: power ? 18 : 16,
    modifiers: power ? [{ source: command === 'SHORT_TIME_THEFT' ? '短时窃取掌握' : '暂存时段释放掌握', value: Math.floor(mastery / 10) }]
      : bonus ? [{ source: '本次暂存时段用于真实标签比对', value: 8 }] : [], roll: rng.nextInt(1, 100) });
}

describe('Time Worm finite original registry life', () => {
  it('migrates the actual raw172 full551 source and initializes its real745/86/9 without gifts', () => {
    const raw = readObjectEntry<SliceState>(fateTrojanNaturalPath, 'final');
    expect(raw.schemaVersion).toBe(172); expect(raw.contentVersion).toBe('fate-trojan-v172'); expect(raw.random).toEqual({ seed: 'marauder-natural-v038', cursor: 361 });
    const original = originalFateTrojan(); expect(original).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    expect(original.fateTrojan.life.site).toEqual(raw.fateTrojan.life.site);
    const fresh = createSliceRun('time-worm-hidden', sliceDefaultCreationSelection, 'time-worm-hidden');
    expect(fresh.timeWorm.life).toEqual(createTimeWormLifeState()); expect(timeWormLifeActions(fresh)).toEqual([]); assertValidSliceState(fresh);
    const s = promoted(); expect(s.timeWorm.life).toMatchObject({ sourceWeek: s.timeWorm.promotionWeek, playerLocation: 'OUTSIDE', clockSeconds: 745, elapsedSeconds: 0, playerTravelMetres: 0, linaTravelMetres: 0, victorTravelMetres: 0, journal: [] });
    expect(timeWormOriginalSnapshot(s)).toEqual({ site: raw.fateTrojan.life.site }); expect(timeWormExpectedOriginals(s)).toEqual(timeWormOriginalSnapshot(s));
    expect(s.fateTrojan.life.site.playerEnergy).toBe(9); expect(hasTimeWormLifeLock(s)).toBe(false); expect(validateTimeWormLifeState(s)).toBe(true);
  }, 120_000);

  it('initializes other structurally legal closed-site totals without imposing the particular capture numbers', () => {
    // Narrow initializer test, explicitly synthetic. This is not presented as
    // a complete replayable save or a replacement natural continuation.
    const s = promoted(); s.timeWorm.life = createTimeWormLifeState();
    const p = structuredClone(s.fateTrojan.life.site); p.clockSeconds += 37; p.playerTravelMetres += 8; p.playerEnergy = 17;
    p.lina.travelMetres += 8; p.lina.energy = 71; p.victor.travelMetres += 4; p.victor.energy = 62; p.seals[0]!.charges = 1;
    expect(validateFateTrojanSiteState(p)).toBe(true); s.fateTrojan.life.site = p; s.timeWorm.sourceScene!.originals = { site: structuredClone(p) };
    initializeTimeWormLifeState(s); expect(timeWormOriginalSnapshot(s)).toEqual({ site: p }); expect(s.timeWorm.life.clockSeconds).toBe(p.clockSeconds);
    expect(s.timeWorm.life.playerTravelMetres).toBe(0); expect(s.timeWorm.life.journal).toEqual([]);
  }, 120_000);

  it('pays actual outside recovery and never automatically restores the two original adults', () => {
    const before = ready(promoted(), { ap: 2, cash: 100 }), site = structuredClone(before.fateTrojan.life.site), s = act(before, { type: 'RECOVER_ENERGY' });
    expect(s.actionsRemaining).toBe(before.actionsRemaining - 1); expect(s.cash).toBe(before.cash - 15); expect(s.week).toBe(before.week);
    expect(s.fateTrojan.life.site.playerEnergy).toBe(site.playerEnergy + 20); expect(s.fateTrojan.life.site.clockSeconds).toBe(site.clockSeconds + 60);
    expect(s.fateTrojan.life.site.playerTravelMetres).toBe(site.playerTravelMetres); expect(s.fateTrojan.life.site.lina).toEqual(site.lina); expect(s.fateTrojan.life.site.victor).toEqual(site.victor);
    expect(s.health).toBe(before.health); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind);
    const inside = prepare(s, 'delayed-observation'); rejectTimeWorm(inside, { type: 'RECOVER_ENERGY' });
  }, 120_000);

  it('finishes three ordinary cases with actual travel, original resources and no unearned mastery', () => {
    let s = finish(enter(afterSecond(), 'withdrawn-delay'), 'withdrawn-delay'); s = act(ready(s), { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(TIME_WORM_CASE_IDS.every(id => s.timeWorm.life.cases[id].status === 'RESOLVED')).toBe(true);
    expect(timeWormLifeMasteryGains(s)).toEqual({ [THEFT]: 0, [RELEASE]: 0 }); expect(s.fateTrojan.life.site).toMatchObject({ playerLocation: 'OUTSIDE', lina: { location: 'OUTSIDE' }, victor: { location: 'OUTSIDE' }, parcel: { location: 'OUTSIDE', quantity: 1, ordinaryMetres: 8 }, fate: { paidToPlayer: 12, escrowPennies: 0 } });
    const source = s.timeWorm.sourceScene!.originals.site, site = s.fateTrojan.life.site, events = s.timeWorm.life.journal;
    expect(site.clockSeconds - source.clockSeconds).toBe(events.reduce((n, e) => n + e.elapsedSeconds, 0));
    expect(site.playerTravelMetres - source.playerTravelMetres).toBe(24); expect(site.lina.travelMetres - source.lina.travelMetres).toBe(24); expect(site.victor.travelMetres).toBe(source.victor.travelMetres);
    expect(site.playerEnergy).toBe(source.playerEnergy + events.reduce((n, e) => n + e.playerEnergyRecovered - e.playerEnergySpent, 0));
    expect(source.lina.energy - site.lina.energy).toBe(27); expect(source.victor.energy - site.victor.energy).toBe(6);
    expect(events.flatMap(e => e.moves).every(m => m.mode === 'WALK' && m.originalBody && m.seconds === m.metres)).toBe(true);
    expect(site.seals).toEqual(source.seals); expect(site.cabinet).toEqual(source.cabinet); expect(site.link).toEqual(source.link); expect(site.fate).toEqual(source.fate);
    expect(hasTimeWormLifeLock(s)).toBe(false); rejectTimeWorm(s, { type: 'REFLECT' });
  }, 120_000);

  it('requires fresh permissions and permits a refusal without moving or obtaining any old resource', () => {
    let s = prepare(promoted(), 'delayed-observation', 'ABILITY'); expect(attempt(s).permission).toEqual({ owner: 'UNASKED', observer: 'UNASKED', ability: 'UNASKED' });
    rejectTimeWorm(s, { type: 'SHORT_TIME_THEFT' }); rejectTimeWorm(s, { type: 'APPROACH' }); rejectTimeWorm(s, { type: 'DECLARE_LOOK' });
    s = act(s, { type: 'CONSENT', permission: 'OWNER' }, { type: 'DECLINE_CONSENT', permission: 'OBSERVER' }); rejectTimeWorm(s, { type: 'CONSENT', permission: 'OBSERVER' });
    const site = structuredClone(s.fateTrojan.life.site); s = act(s, { type: 'EXIT_ROOM' }, { type: 'LEAVE' });
    expect(s.fateTrojan.life.site.playerTravelMetres).toBe(site.playerTravelMetres); expect(s.fateTrojan.life.site.playerEnergy).toBe(site.playerEnergy);
    s = act(ready(s), { type: 'REPORT', caseId: 'delayed-observation' }); expect(s.progression.mastery[THEFT]).toBe(0);
  }, 120_000);

  it('charges one real short-time attempt and records only future delay before the original target executes', () => {
    let s = enter(promoted(), 'delayed-observation', 'ABILITY'); const before = structuredClone(s), check = expected(s, 'SHORT_TIME_THEFT'), declaration = structuredClone(attempt(s).declaration!);
    expect(declaration.state).toBe('PENDING'); s = act(s, { type: 'SHORT_TIME_THEFT' });
    expect(s.timeWorm.life.journal.at(-1)!.check).toEqual(check); expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 2);
    expect(s.timeWorm.life.clockSeconds).toBe(before.timeWorm.life.clockSeconds + 1); expect(s.week).toBe(before.week); expect(s.actionsRemaining).toBe(before.actionsRemaining);
    expect(attempt(s).theft.effects).toBe(0); expect(s.progression.mastery[THEFT]).toBe(0); rejectTimeWorm(s, { type: 'SHORT_TIME_THEFT' }); rejectTimeWorm(s, { type: 'DECLARE_LOOK' });
    if (succeeds(check.tier)) {
      expect(attempt(s).declaration).toMatchObject({ state: 'DELAYED', delayStartedAt: s.timeWorm.life.clockSeconds, dueAt: s.timeWorm.life.clockSeconds + 3, delayedSeconds: 0 });
      rejectTimeWorm(s, { type: 'EXECUTE_LOOK' }); s = act(s, { type: 'WAIT_1' }); expect(attempt(s).declaration!.delayedSeconds).toBe(1); rejectTimeWorm(s, { type: 'EXECUTE_LOOK' });
      s = act(s, { type: 'WAIT_1' }, { type: 'WAIT_1' }); expect(s.timeWorm.life.pending).toBeNull(); expect(attempt(s).theft.effects).toBe(0);
    } else { expect(attempt(s).theft).toMatchObject({ state: 'FAILED', successes: 0, effects: 0 }); expect(s.timeWorm.life.pending).toBeNull(); }
    s = act(s, { type: 'EXECUTE_LOOK' }); expect(attempt(s).declaration!.state).toBe('EXECUTED'); expect(attempt(s).theft.effects).toBe(succeeds(check.tier) ? 1 : 0);
    rejectTimeWorm(s, { type: 'SHORT_TIME_THEFT' }); rejectTimeWorm(s, { type: 'EXECUTE_LOOK' });
    s = finish(s, 'delayed-observation'); expect(s.progression.mastery[THEFT]).toBe(succeeds(check.tier) ? 8 : 0);
  }, 120_000);

  it('releases only its own acquired interval and consumes the aid on a real independent comparison', () => {
    let s = enter(afterFirst(), 'released-interval', 'ABILITY'); rejectTimeWorm(s, { type: 'TIME_RELEASE' }); s = act(s, { type: 'SHORT_TIME_THEFT' });
    if (!s.timeWorm.life.pending) { rejectTimeWorm(s, { type: 'TIME_RELEASE' }); expect(attempt(s).theft.state).toBe('FAILED'); return; }
    const before = structuredClone(s), dueAt = attempt(s).declaration!.dueAt, releaseCheck = expected(s, 'TIME_RELEASE'); s = act(s, { type: 'TIME_RELEASE' });
    expect(s.spirituality).toBe(before.spirituality - 6); expect(s.mind).toBe(before.mind - 2); expect(s.timeWorm.life.journal.at(-1)!.check).toEqual(releaseCheck);
    expect(attempt(s).release.effects).toBe(0); expect(attempt(s).declaration!.dueAt).toBe(dueAt); rejectTimeWorm(s, { type: 'TIME_RELEASE' }); rejectTimeWorm(s, { type: 'EXECUTE_LOOK' });
    const check = expected(s, 'COMPARE_LABEL'), energy = s.fateTrojan.life.site.playerEnergy; s = act(s, { type: 'COMPARE_LABEL' });
    expect(s.timeWorm.life.journal.at(-1)!.check).toEqual(check); expect(s.fateTrojan.life.site.playerEnergy).toBe(energy - 1);
    expect(attempt(s).comparisonAt).toBeLessThan(dueAt); expect(attempt(s).comparisonBonus).toBe(succeeds(releaseCheck.tier) ? 8 : 0);
    expect(attempt(s).release.effects).toBe(succeeds(releaseCheck.tier) ? 1 : 0); expect(attempt(s).declaration!.state).toBe('DELAYED'); expect(attempt(s).declaration!.dueAt).toBe(dueAt);
    expect(s.timeWorm.life.pending).toBeNull(); rejectTimeWorm(s, { type: 'EXECUTE_LOOK' }); rejectTimeWorm(s, { type: 'COMPARE_LABEL' });
    s = finish(s, 'released-interval'); expect(s.progression.mastery[RELEASE]).toBe(succeeds(releaseCheck.tier) ? 8 : 0); expect(s.progression.mastery[THEFT]).toBe(8);
  }, 120_000);

  it('does not apply an aid when the comparison ends exactly at dueAt, and never refunds an expired interval', () => {
    let s = act(enter(afterFirst(), 'released-interval', 'ABILITY'), { type: 'SHORT_TIME_THEFT' });
    if (!s.timeWorm.life.pending) { expect(attempt(s).theft.state).toBe('FAILED'); return; }
    s = act(s, { type: 'TIME_RELEASE' }, { type: 'WAIT_1' }); const paid = { spirituality: s.spirituality, mind: s.mind }, dueAt = attempt(s).declaration!.dueAt;
    expect(projectTimeWormLife(s).pendingUsable).toBe(false); s = act(s, { type: 'COMPARE_LABEL' });
    expect(attempt(s).comparisonAt).toBe(dueAt); expect(attempt(s).comparisonBonus).toBe(0); expect(attempt(s).release.effects).toBe(0);
    expect(s.spirituality).toBe(paid.spirituality); expect(s.mind).toBe(paid.mind); expect(s.timeWorm.life.pending).toBeNull();
    s = act(s, { type: 'EXECUTE_LOOK' }); expect(attempt(s).theft.effects).toBe(1); expect(attempt(s).declaration!.delayedSeconds).toBe(3);
  }, 120_000);

  it('stops only its unused reserve while retaining the target delay and all paid cost', () => {
    let s = act(enter(promoted(), 'delayed-observation', 'ABILITY'), { type: 'SHORT_TIME_THEFT' });
    if (!s.timeWorm.life.pending) { rejectTimeWorm(s, { type: 'STOP_METHOD' }); return; }
    const before = structuredClone(s); s = act(s, { type: 'STOP_METHOD' });
    expect(s.timeWorm.life.pending).toBeNull(); expect(attempt(s).declaration).toEqual(attempt(before).declaration);
    expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind); expect(s.timeWorm.life.clockSeconds).toBe(before.timeWorm.life.clockSeconds);
    rejectTimeWorm(s, { type: 'TIME_RELEASE' }); rejectTimeWorm(s, { type: 'EXECUTE_LOOK' });
    s = act(s, { type: 'WAIT_3' }, { type: 'EXECUTE_LOOK' }); expect(attempt(s).declaration!.delayedSeconds).toBe(3); expect(attempt(s).theft.effects).toBe(1);
  }, 120_000);

  it('withdraws at zeroAP, preserves elapsed time, and closes by real walking and ordinary weekly finance', () => {
    let s = act(enter(afterSecond(), 'withdrawn-delay', 'ABILITY', true), { type: 'SHORT_TIME_THEFT' });
    expect(s.actionsRemaining).toBe(0); if (s.timeWorm.life.pending) s = act(s, { type: 'WAIT_1' });
    const beforeWithdrawal = structuredClone(s); s = act(s, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' });
    expect(s.timeWorm.life.pending).toBeNull(); expect(attempt(s).declaration!.state).toBe('CANCELLED'); expect(attempt(s).declaration!.delayedSeconds).toBe(attempt(beforeWithdrawal).declaration!.delayedSeconds);
    expect(s.timeWorm.life.clockSeconds).toBe(beforeWithdrawal.timeWorm.life.clockSeconds); rejectTimeWorm(s, { type: 'TIME_RELEASE' }); rejectTimeWorm(s, { type: 'EXECUTE_LOOK' }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const before = structuredClone(s), site = structuredClone(s.fateTrojan.life.site); s = act(s, { type: 'ABORT' }); const receipt = s.timeWorm.life.journal.at(-1)!;
    expect(receipt.before.actions).toBe(0); expect(receipt.after.actions).toBe(0); expect(receipt.playerWalkedMetres).toBe(4); expect(receipt.linaWalkedMetres).toBe(4); expect(receipt.elapsedSeconds).toBe(8);
    expect(s.fateTrojan.life.site.playerEnergy).toBe(site.playerEnergy - 4); expect(s.fateTrojan.life.site.lina.energy).toBe(site.lina.energy - 4);
    expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind); expect(s.fateTrojan.life.site.parcel).toEqual(site.parcel);
    const finance = resolveSliceWeeklyFinance({ ...before, pulse: 'BILL' }).state;
    expect(s.week).toBe(before.week + 1); expect(s.actionsRemaining).toBe(before.weeklyBudget); expect(s.cash).toBe(finance.cash); expect(s.debts).toEqual(finance.debts);
    expect(attempt(s, 'withdrawn-delay').theft.effects).toBe(0); expect(attempt(s, 'withdrawn-delay').release.effects).toBe(0);
    const bad = structuredClone(s); bad.cash++; expect(validateTimeWormLifeState(bad)).toBe(false);
    s = act(ready(s), { type: 'REPORT', caseId: 'withdrawn-delay' }); expect(s.progression.mastery[THEFT]).toBe(0);
  }, 120_000);

  it('offers actual waiting after ability withdrawal and executes only after the original remaining delay', () => {
    const root = 'tests/fixtures/time-worm-v01970/';
    const zero = migrateSliceState(readObjectEntry<SliceState>(`${root}boundary-withdrawn-delay-single-paid-short-time-theft-attempt.json`, 'final'));
    const before = migrateSliceState(readObjectEntry<SliceState>(`${root}boundary-withdrawn-delay-withdraw-ability-without-refunding-target-time.json`, 'beforeLast'));
    let s = migrateSliceState(readObjectEntry<SliceState>(`${root}boundary-withdrawn-delay-withdraw-ability-without-refunding-target-time.json`, 'final'));
    for (const value of [zero, before, s]) assertValidSliceState(value);
    const offered = (state: SliceState, type: string) => projectTimeWormLife(state).actions.find(a => a.command.type === type);
    expect(attempt(zero).declaration!.delayedSeconds).toBe(0); expect(projectTimeWormLife(zero).targetRemainingSeconds).toBe(3);
    expect(offered(zero, 'WAIT_1')?.enabled).toBe(true);
    expect(attempt(before).permission.ability).toBe('GRANTED'); expect(projectTimeWormLife(before).targetRemainingSeconds).toBe(2);
    expect(attempt(s).permission.ability).toBe('WITHDRAWN'); expect(attempt(s).permission.owner).toBe('GRANTED');
    expect(s.timeWorm.life.pending).toBeNull(); expect(attempt(s).declaration).toEqual(attempt(before).declaration);
    expect(s.random).toEqual(before.random); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind);
    expect(offered(s, 'WAIT_1')).toMatchObject({ enabled: true, preferredAction: true });
    rejectTimeWorm(s, { type: 'EXECUTE_LOOK' });
    const budget = { week: s.week, actions: s.actionsRemaining, cash: s.cash, S: s.spirituality, M: s.mind, random: s.random };
    s = act(s, { type: 'WAIT_1' }); expect(projectTimeWormLife(s).targetRemainingSeconds).toBe(1);
    expect(offered(s, 'WAIT_1')?.enabled).toBe(true); rejectTimeWorm(s, { type: 'EXECUTE_LOOK' });
    s = act(s, { type: 'WAIT_1' }); expect(projectTimeWormLife(s).targetRemainingSeconds).toBe(0);
    expect(offered(s, 'EXECUTE_LOOK')).toMatchObject({ enabled: true, preferredAction: true });
    expect(offered(s, 'WAIT_1')?.enabled ?? false).toBe(false); rejectTimeWorm(s, { type: 'WAIT_1' });
    s = act(s, { type: 'EXECUTE_LOOK' }); expect(attempt(s).declaration).toMatchObject({ state: 'EXECUTED', delayedSeconds: 3 });
    expect(attempt(s).theft.effects).toBe(1); expect(s.timeWorm.life.pending).toBeNull();
    expect({ week: s.week, actions: s.actionsRemaining, cash: s.cash, S: s.spirituality, M: s.mind, random: s.random }).toEqual(budget);
    expect(offered(s, 'EXIT_ROOM')?.enabled).toBe(true);
  }, 30_000);

  it('replays source identity, declaration, checks, movement, energy, costs and finances and rejects tampering', () => {
    const s = act(enter(promoted(), 'delayed-observation', 'ABILITY'), { type: 'SHORT_TIME_THEFT' });
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.fateTrojan.life.site.playerEnergy++; }, v => { v.fateTrojan.life.site.lina.energy++; }, v => { v.fateTrojan.life.site.parcel.location = 'CABINET'; },
      v => { v.fateTrojan.life.site.playerTravelMetres++; }, v => { v.fateTrojan.life.site.clockSeconds--; }, v => { v.fateTrojan.life.site.fate.paidToPlayer = 0; },
      v => { v.fateTrojan.life.site.seals[2]!.charges = 0; }, v => { v.fateTrojan.life.journal.pop(); }, v => { v.timeWorm.sourceHistory!.fateTrojan.life.site.playerEnergy++; },
      v => { v.timeWorm.life.journal.at(-1)!.before.cash++; }, v => { v.timeWorm.life.journal.at(-1)!.after.spirituality++; }, v => { v.timeWorm.life.journal.at(-1)!.randomAfter!++; },
      v => { v.timeWorm.life.journal.at(-1)!.finance.weeklyBudget++; }, v => { v.timeWorm.life.journal.at(-1)!.source!.declaration!.targetId = 'OTHER' as 'FT2-VICTOR'; },
      v => { v.timeWorm.life.journal.at(-1)!.revision = v.revision + 1; }, v => { v.timeWorm.life.journal.at(-1)!.week = v.week + 1; }, v => { v.timeWorm.life.journal.pop(); },
      v => { v.timeWorm.life.clockSeconds++; }, v => { attempt(v).theft.effects = 1; }, v => { attempt(v).declaration!.dueAt++; }, v => { attempt(v).declaration!.delayedSeconds++; },
      v => { const e = v.timeWorm.life.journal.at(-1)!; e.check = { ...e.check!, roll: e.check!.roll % 100 + 1 }; },
    ];
    for (const mutate of mutations) { const bad = structuredClone(s); mutate(bad); expect(validateTimeWormLifeState(bad)).toBe(false); expect(() => assertValidSliceState(bad)).toThrow(); }
    expect(blockTimeWormLife(s, { type: 'SHORT_TIME_THEFT' })).not.toBeNull();
  }, 120_000);

  it('keeps exact commands, visible elapsed/remaining time and a small preferred action set', () => {
    for (const c of [{ type: 'SHORT_TIME_THEFT', target: 'PAST_ACTION' }, { type: 'CONSENT', permission: 'OLD_PERMISSION' }, { type: 'PREPARE', caseId: 'released-interval', method: 'FREE' },
      { type: 'RECOVER_ENERGY', free: true }, { type: 'REOPEN_CARRY' }, { type: 'BUY_CLOCK' }, { type: 'REWIND' }, { type: 'WAIT_3', gainActions: 1 }]) expect(validateTimeWormActivityCommand(c)).toBe(false);
    const s = enter(promoted(), 'delayed-observation', 'ABILITY'), view = projectTimeWormLife(s);
    expect(view.actions.length).toBeLessThan(12); expect(view.preferredActionId).not.toBeNull(); expect(view.declaration!.state).toBe('PENDING');
    expect(view.actions.some(a => a.command.type === 'ABORT' && a.enabled && a.cleanup && a.cost.startsWith('0行动'))).toBe(true);
    expect(view.pendingRemainingSeconds).toBe(0); expect(view.targetRemainingSeconds).toBe(0); expect(view.site.parcel.location).toBe('OUTSIDE'); expect(view.site.playerLocation).toBe('DESK');
    expect(view.site.lina.location).toBe('DESK'); expect(view.site.victor.location).toBe('OUTSIDE'); expect(view.site.playerEnergy).toBe(5);
  }, 120_000);
});
