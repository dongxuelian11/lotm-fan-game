import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createCatastropheSiteState } from '../../src/domain/catastrophe/resources.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  THUNDER_GOD_CASE_IDS, blockThunderGodLife, createThunderGodLifeState, hasThunderGodLifeLock,
  isThunderGodReusableSite, projectThunderGodLife, thunderGodExpectedOriginals, thunderGodLifeActions,
  thunderGodLifeMasteryGains, thunderGodOriginalSnapshot, validateThunderGodActivityCommand, validateThunderGodLifeState,
  type ThunderGodActivityCommand, type ThunderGodCaseId,
} from '../../src/domain/thunder-god/life.js';
import { catastropheBranchPath, tg, originalCatastrophe, ordinary, promoted, ready, rejectThunderGod, rejectIntent } from './thunder-god-directed-helper.js';

// Genuine migrated599-command source, unchanged original seed and paid public
// progression. No forced roll, resource grant, history rewrite or dead revival.
const GUIDED = 'tyrant.s1.guided-thunder', GUARD = 'tyrant.s1.storm-brace';
const succeeds = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const attempt = (s: SliceState, id: ThunderGodCaseId = s.thunderGod.life.activeCase!) => s.thunderGod.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, ...commands: ThunderGodActivityCommand[]): SliceState {
  for (const command of commands) {
    const count = s.thunderGod.life.journal.length; s = tg(s, command);
    expect(s.thunderGod.life.journal.length).toBe(count + 1);
    expect(validateThunderGodLifeState(s), JSON.stringify(command)).toBe(true); assertValidSliceState(s);
  }
  return s;
}
function enter(s: SliceState, caseId: ThunderGodCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY'): SliceState {
  s = act(ready(s), { type: 'OBSERVE', caseId });
  if (s.thunderGod.life.target.purchasedWeek === null) s = act(ready(s, { cash: 40 }), { type: 'BUY_TARGET' });
  if (s.thunderGod.life.pad.purchasedWeek === null) s = act(ready(s, { cash: 20 }), { type: 'BUY_PAD' });
  s = ready(s, { ap: 1, cash: 10, health: 6, mind: 10, spirituality: 10 });
  return act(s, { type: 'WALK_TO_SITE' }, { type: 'INVITE', caseId, method }, { type: 'READ_SOURCE' },
    { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'TECHNICIAN' },
    { type: method === 'ABILITY' ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'ABILITY' },
    { type: 'AGREE_RETURN' }, { type: 'ENTER_SITE' });
}
function target(s: SliceState): SliceState {
  return act(s, { type: 'PLACE_TARGET' }, { type: 'STEP_BACK' }, { type: 'CLEAR_ADULTS' }, { type: 'OBSERVE_TARGET' });
}
function pad(s: SliceState): SliceState {
  return act(s, { type: 'WEAR_PAD' }, { type: 'CLEAR_ADULTS' }, { type: 'REGISTER_IMPACT' });
}
function finish(s: SliceState, caseId: ThunderGodCaseId): SliceState {
  if (s.thunderGod.life.pending || s.thunderGod.life.target.pulse === 'ARMED' || s.thunderGod.life.pad.registered) s = act(s, { type: 'STOP_PULSE' });
  if (s.thunderGod.life.target.hood === 'CLOSED') s = act(s, { type: 'CLEAR_HOOD' });
  if (s.thunderGod.life.target.location === 'HOLDER') s = act(s, { type: 'RETRIEVE_TARGET' });
  if (s.thunderGod.life.pad.location === 'WORN') s = act(s, { type: 'RETURN_PAD' });
  s = act(s, { type: 'EXIT_SITE' }, { type: 'LEAVE' });
  return act(ready(s), { type: 'REPORT', caseId });
}
function located(s: SliceState): SliceState { return finish(act(target(enter(s, 'located-target')), { type: 'MANUAL_INSPECT' }), 'located-target'); }
function personal(s: SliceState): SliceState { return finish(act(pad(enter(s, 'personal-impact')), { type: 'HAND_RESET' }), 'personal-impact'); }
function obscured(s: SliceState): SliceState {
  return finish(act(target(enter(s, 'obscured-return')), { type: 'CHANGE_CONDITIONS' }, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, { type: 'STOP_PULSE' }, { type: 'CLEAR_HOOD' }, { type: 'RETRIEVE_TARGET' }), 'obscured-return');
}
function expectedCheck(s: SliceState, ability: 'will' | 'perception', bonus = false) {
  const rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
  return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty: 18,
    modifiers: bonus ? [{ source: '同一已定位原靶的有限雷势引导', value: 10 }] : [], roll: rng.nextInt(1, 100) });
}
let locatedCache: SliceState | undefined, personalCache: SliceState | undefined;
const afterLocated = () => structuredClone(locatedCache ??= located(promoted()));
const afterPersonal = () => structuredClone(personalCache ??= personal(afterLocated()));

describe('Thunder God finite original-cove practice', () => {
  it('migrates genuine original evidence without replacing the complete source site or old people', () => {
    const raw = readObjectEntry<SliceState>(catastropheBranchPath, 'beforeLast'), old = originalCatastrophe(), s = promoted(), l = s.thunderGod.life;
    // Independent raw metadata assertion. Source SHA256 and actual602 death are
    // independently checked by the acquisition fixture tests, before migration.
    expect(raw).toMatchObject({ schemaVersion: 168, contentVersion: 'catastrophe-v168', revision: 600, status: 'ACTIVE' });
    expect(old.catastrophe).toEqual(raw.catastrophe);
    expect(l.sourceWeek).toBe(s.thunderGod.promotionWeek); expect(l.journal).toEqual([]);
    expect(l).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 0, keeperPresent: false, clockSeconds: 123,
      finn: { id: 'TG1-FINN-COLE', age: 44, alive: true, health: 100, mind: 100, present: false, location: 'AWAY', travelMetres: 0 },
      target: { id: 'TG1-TARGET-1', owner: 'TG1-FINN-COLE', price: 40, location: 'SUPPLIER', durability: 100, holderOwner: 'TG1-FINN-COLE', hoodOwner: 'TG1-FINN-COLE' },
      pad: { id: 'TG1-PAD-1', price: 20, location: 'SUPPLIER', durability: 100 } });
    expect(s.catastrophe).toEqual(old.catastrophe); expect(s.thunderGod.sourceScene!.originals).toEqual(old.catastrophe.life.site);
    expect(thunderGodExpectedOriginals(s)).toEqual(thunderGodOriginalSnapshot(old)); expect(createThunderGodLifeState().sourceWeek).toBeNull();
    expect(hasThunderGodLifeLock(s)).toBe(false); expect(validateThunderGodLifeState(s)).toBe(true);
  }, 120_000);

  it('accepts reusable original-site capabilities without pinning one historical route’s wear or clock', () => {
    const first = originalCatastrophe().catastrophe.life.site, second = createCatastropheSiteState();
    expect(isThunderGodReusableSite(first)).toBe(true); expect(isThunderGodReusableSite(second)).toBe(true);
    // This is the pure capability validator, not a fabricated game history.
    second.clockSeconds = 235; second.playerTravelMetres = 24; second.keeper.travelMetres = 48; second.keeper.energy = 84;
    second.gate.operations = 8; second.gate.durability = 92; second.wheel.turns = 3; second.wheel.durability = 97;
    expect(isThunderGodReusableSite(second)).toBe(true);
    expect(isThunderGodReusableSite({ ...second, playerPosition: 'PLATFORM' })).toBe(false);
    expect(isThunderGodReusableSite({ ...second, keeper: { ...second.keeper, position: 'EXIT' } })).toBe(true);
    expect(isThunderGodReusableSite({ ...second, water: { ...second.water, bayUnits: 16, channelUnits: 4 } })).toBe(true);
    expect(isThunderGodReusableSite({ ...second, keeper: { ...second.keeper, energy: 100 } })).toBe(false);
  });

  it('completes all ordinary cases with paid originals, real12m walks, finite wear and no mastery', () => {
    let s = obscured(afterPersonal()); s = act(ready(s), { type: 'REFLECT' }); const l = s.thunderGod.life, old = originalCatastrophe();
    expect(THUNDER_GOD_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED' && l.cases[id].result === 'ORDINARY')).toBe(true);
    expect(l.journal.reduce((n, e) => n + e.before.cash - e.after.cash, 0)).toBe(90);
    expect(l.journal.reduce((n, e) => n + e.before.actions - e.after.actions, 0)).toBe(12);
    expect(l.journal.every(e => e.check === null && e.randomBefore === null && e.randomAfter === null)).toBe(true);
    expect(l.playerTravelMetres).toBe(96); expect(l.finn.travelMetres).toBe(60);
    expect(l.target).toMatchObject({ id: 'TG1-TARGET-1', owner: 'PLAYER', location: 'PLAYER', durability: 100, marks: 0, hood: 'OPEN', line: 'CLEAR', pulse: 'STOPPED' });
    expect(l.pad).toMatchObject({ id: 'TG1-PAD-1', owner: 'PLAYER', location: 'PLAYER', durability: 90, impacts: 0, manualResets: 1, registered: false });
    expect(s.catastrophe.life.site).toMatchObject({ clockSeconds: old.catastrophe.life.site.clockSeconds + l.elapsedSeconds, playerPosition: 'EXIT', playerTravelMetres: 108, keeper: { position: 'CONTROL', travelMetres: 72, energy: 85 } });
    for (const key of ['water', 'gate', 'buoy', 'mooring', 'winch', 'wheel'] as const) expect(s.catastrophe.life.site[key]).toEqual(old.catastrophe.life.site[key]);
    expect(s.catastrophe.life.cases).toEqual(old.catastrophe.life.cases); expect(s.catastrophe.life.journal).toEqual(old.catastrophe.life.journal); expect(s.catastrophe.encounter).toEqual(old.catastrophe.encounter);
    expect(s.thunderGod.sourceScene!.originals).toEqual(old.catastrophe.life.site); expect(s.thunderGod.sourceHistory!.catastrophe).toEqual(old.catastrophe);
    expect(l.finn).toMatchObject({ present: false, location: 'AWAY', health: 100, mind: 100 }); expect(l.keeperPresent).toBe(false);
    expect(s.progression.acting).toBe(100); expect(thunderGodLifeMasteryGains(s)).toEqual({ [GUIDED]: 0, [GUARD]: 0 });
    for (const [id, value] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(hasThunderGodLifeLock(s)).toBe(false); rejectThunderGod(s, { type: 'REFLECT' }); rejectThunderGod(s, { type: 'BUY_TARGET' }); rejectThunderGod(s, { type: 'BUY_PAD' });
  }, 120_000);

  it('requires independent current owner, technician and power consent, with refusal and zero-action exit', () => {
    let s = act(ready(promoted()), { type: 'OBSERVE', caseId: 'located-target' });
    s = act(ready(s, { cash: 40 }), { type: 'BUY_TARGET' }); s = act(ready(s, { cash: 20 }), { type: 'BUY_PAD' });
    s = act(ready(s, { cash: 10 }), { type: 'WALK_TO_SITE' }, { type: 'INVITE', caseId: 'located-target', method: 'ABILITY' });
    rejectThunderGod(s, { type: 'ENTER_SITE' }); rejectThunderGod(s, { type: 'CONSENT', permission: 'OWNER' });
    s = act(s, { type: 'READ_SOURCE' }, { type: 'CONSENT', permission: 'OWNER' }, { type: 'DECLINE_CONSENT', permission: 'TECHNICIAN' });
    rejectThunderGod(s, { type: 'CONSENT', permission: 'TECHNICIAN' }); rejectThunderGod(s, { type: 'AGREE_RETURN' }); rejectThunderGod(s, { type: 'GUIDED_THUNDER' });
    const before = structuredClone(s); s = act(s, { type: 'LEAVE' });
    expect(s.thunderGod.life.journal.at(-1)!.after).toEqual(s.thunderGod.life.journal.at(-1)!.before);
    expect(s.catastrophe.life.site.keeper.energy).toBe(before.catastrophe.life.site.keeper.energy);
    expect(s.thunderGod.life.finn).toMatchObject({ present: false, location: 'AWAY', health: 100, mind: 100 });
    s = act(ready(s), { type: 'REPORT', caseId: 'located-target' }); expect(s.progression.mastery[GUIDED]).toBe(0);
  }, 120_000);

  it('separates the paid perception cast from the next will check and actual original target hit', () => {
    let s = enter(promoted(), 'located-target', 'ABILITY'); rejectThunderGod(s, { type: 'GUIDED_THUNDER' });
    s = act(s, { type: 'PLACE_TARGET' }); rejectThunderGod(s, { type: 'GUIDED_THUNDER' });
    s = act(s, { type: 'STEP_BACK' }); rejectThunderGod(s, { type: 'GUIDED_THUNDER' });
    s = act(s, { type: 'CLEAR_ADULTS' }); rejectThunderGod(s, { type: 'GUIDED_THUNDER' });
    s = act(s, { type: 'OBSERVE_TARGET' }); const before = structuredClone(s), cast = expectedCheck(s, 'perception');
    s = act(s, { type: 'GUIDED_THUNDER' }); expect(s.thunderGod.life.journal.at(-1)!.check).toEqual(cast);
    expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 2); expect(s.thunderGod.life.target.durability).toBe(100); expect(attempt(s).guided.effects).toBe(0);
    expect(s.thunderGod.life.journal.at(-1)!.source).toMatchObject({ targetId: 'TG1-TARGET-1', targetPositionMetres: 12, distanceMetres: 6, playerPosition: 'CONTROL', keeperPosition: 'EXIT', finnPosition: 'EXIT', line: 'CLEAR', effectType: 'TARGET' });
    if (succeeds(cast.tier)) expect(s.thunderGod.life.pending!.expiresAt - s.thunderGod.life.pending!.createdAt).toBe(30);
    else expect(attempt(s).guided).toMatchObject({ state: 'FAILED', effects: 0, successes: 0 });
    rejectThunderGod(s, { type: 'GUIDED_THUNDER' }); const discharge = expectedCheck(s, 'will', succeeds(cast.tier));
    s = act(s, { type: 'DISCHARGE_TARGET' }); const applied = succeeds(cast.tier) && succeeds(discharge.tier);
    expect(s.thunderGod.life.journal.at(-1)!.check).toEqual(discharge); expect(s.thunderGod.life.journal.at(-1)!.source!.bonus).toBe(succeeds(cast.tier) ? 10 : 0);
    expect(s.thunderGod.life.target).toMatchObject({ marks: succeeds(discharge.tier) ? 1 : 0, durability: succeeds(discharge.tier) ? 95 : 100, pulse: 'SPENT' });
    expect(attempt(s).guided.effects).toBe(applied ? 1 : 0); expect(s.thunderGod.life.pending).toBeNull(); rejectThunderGod(s, { type: 'DISCHARGE_TARGET' });
    if (!succeeds(discharge.tier)) s = act(s, { type: 'MANUAL_INSPECT' });
    s = finish(s, 'located-target'); expect(s.progression.mastery[GUIDED]).toBe(applied ? 8 : 0); expect(attempt(s, 'located-target').dischargeTier).toBe(discharge.tier);
  }, 120_000);

  it('expires or cancels an unused30second window without refund, remote inspection or mastery', () => {
    let s = act(target(enter(promoted(), 'located-target', 'ABILITY')), { type: 'GUIDED_THUNDER' }); const paid = { spirituality: s.spirituality, mind: s.mind }, clock = s.thunderGod.life.clockSeconds;
    if (s.thunderGod.life.pending) { s = act(s, { type: 'WAIT_WINDOW' }); expect(s.thunderGod.life.clockSeconds).toBe(clock + 30); expect(attempt(s).guided.state).toBe('EXPIRED'); }
    else expect(attempt(s).guided.state).toBe('FAILED');
    rejectThunderGod(s, { type: 'WAIT_WINDOW' }); rejectThunderGod(s, { type: 'GUIDED_THUNDER' });
    const distance = s.thunderGod.life.playerTravelMetres; s = act(s, { type: 'MANUAL_INSPECT' });
    expect(s.thunderGod.life.playerLocation).toBe('TARGET'); expect(s.thunderGod.life.playerTravelMetres).toBe(distance + 6);
    expect(s.spirituality).toBe(paid.spirituality); expect(s.mind).toBe(paid.mind); expect(s.thunderGod.life.target.durability).toBe(100);
    s = finish(s, 'located-target'); expect(s.progression.mastery[GUIDED]).toBe(0);
  }, 120_000);

  it('charges the genuine personal5health impact, never heals it and leaves a safe hand alternative', () => {
    let s = pad(enter(afterLocated(), 'personal-impact', 'ABILITY')); const before = structuredClone(s), cursor = s.random.cursor;
    const action = thunderGodLifeActions(s).find(x => x.command.type === 'RELEASE_IMPACT')!;
    expect(action.enabled).toBe(true); expect(action.cost).toContain('健康−5'); expect(action.cost).toContain('耐久−10');
    s = act(s, { type: 'RELEASE_IMPACT' }); expect(s.health).toBe(before.health - 5); expect(s.random.cursor).toBe(cursor);
    expect(s.thunderGod.life.pad).toMatchObject({ durability: 90, impacts: 1, manualResets: 0, registered: false });
    expect(attempt(s)).toMatchObject({ healthLost: 5, healthPrevented: 0, guard: { effects: 0 } });
    expect(s.thunderGod.life.journal.at(-1)!.source).toMatchObject({ effectType: 'BODY', rawHealthLoss: 5, preventedHealthLoss: 0, targetId: 'TG1-PAD-1' });
    rejectThunderGod(s, { type: 'RELEASE_IMPACT' }); rejectThunderGod(s, { type: 'HAND_RESET' });
    const hurt = s.health; s = act(s, { type: 'RETURN_PAD' }, { type: 'EXIT_SITE' }, { type: 'LEAVE' }); expect(s.health).toBe(hurt);
    expect(s.thunderGod.life.finn.health).toBe(100); expect(s.catastrophe.life.site.keeper.alive).toBe(true);
    expect(s.progression.mastery[GUARD]).toBe(0);
  }, 120_000);

  it('only applies a real guard to the subsequent registered BODY loss and retains failure cost', () => {
    let s = enter(afterLocated(), 'personal-impact', 'ABILITY'); rejectThunderGod(s, { type: 'STORM_BRACE' });
    s = act(s, { type: 'WEAR_PAD' }); rejectThunderGod(s, { type: 'STORM_BRACE' });
    s = act(s, { type: 'CLEAR_ADULTS' }); rejectThunderGod(s, { type: 'STORM_BRACE' });
    s = act(s, { type: 'REGISTER_IMPACT' }); const before = structuredClone(s), cast = expectedCheck(s, 'will');
    s = act(s, { type: 'STORM_BRACE' }); expect(s.thunderGod.life.journal.at(-1)!.check).toEqual(cast);
    expect(s.spirituality).toBe(before.spirituality - 6); expect(s.mind).toBe(before.mind - 2); expect(s.health).toBe(before.health); expect(attempt(s).guard.effects).toBe(0);
    rejectThunderGod(s, { type: 'STORM_BRACE' }); const health = s.health, cursor = s.random.cursor;
    s = act(s, { type: 'RELEASE_IMPACT' }); expect(s.random.cursor).toBe(cursor); expect(s.health).toBe(health - (succeeds(cast.tier) ? 0 : 5));
    expect(attempt(s).guard.effects).toBe(succeeds(cast.tier) ? 1 : 0); expect(attempt(s).healthPrevented).toBe(succeeds(cast.tier) ? 5 : 0);
    expect(s.thunderGod.life.pending).toBeNull(); s = finish(s, 'personal-impact'); expect(s.progression.mastery[GUARD]).toBe(succeeds(cast.tier) ? 8 : 0);
  }, 120_000);

  it('offers the ordinary hand reset after a spent cast and after withdrawal, with real pad wear', () => {
    let s = act(pad(enter(afterLocated(), 'personal-impact', 'ABILITY')), { type: 'STORM_BRACE' });
    const before = structuredClone(s); s = act(s, { type: 'WITHDRAW_CONSENT', permission: 'ABILITY' }); rejectThunderGod(s, { type: 'RELEASE_IMPACT' });
    s = act(s, { type: 'HAND_RESET' }); expect(s.health).toBe(before.health); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind);
    expect(s.thunderGod.life.pad).toMatchObject({ durability: 90, manualResets: 1, impacts: 0 }); expect(attempt(s).guard.effects).toBe(0);
    s = finish(s, 'personal-impact'); expect(s.progression.mastery[GUARD]).toBe(0);
  }, 120_000);

  it('invalidates on real hood movement and withdraws without post-hoc success or disappearing objects', () => {
    let s = act(target(enter(afterPersonal(), 'obscured-return', 'ABILITY')), { type: 'GUIDED_THUNDER' });
    const paid = { spirituality: s.spirituality, mind: s.mind }, hadPending = !!s.thunderGod.life.pending, finnWalk = s.thunderGod.life.finn.travelMetres;
    s = act(s, { type: 'CHANGE_CONDITIONS' }); expect(s.thunderGod.life.finn.travelMetres).toBe(finnWalk + 24);
    expect(s.thunderGod.life.target).toMatchObject({ location: 'HOLDER', hood: 'CLOSED', line: 'OBSCURED' });
    expect(s.thunderGod.life.pending).toBeNull(); expect(attempt(s).guided.state).toBe(hadPending ? 'INVALIDATED' : 'FAILED');
    s = act(s, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' }); rejectThunderGod(s, { type: 'GUIDED_THUNDER' }); rejectThunderGod(s, { type: 'DISCHARGE_TARGET' }); rejectThunderGod(s, { type: 'CONSENT', permission: 'OWNER' });
    rejectThunderGod(s, { type: 'CLEAR_HOOD' }); rejectThunderGod(s, { type: 'RETRIEVE_TARGET' }); rejectThunderGod(s, { type: 'EXIT_SITE' });
    s = act(s, { type: 'STOP_PULSE' }, { type: 'CLEAR_HOOD' }, { type: 'RETRIEVE_TARGET' }); expect(s.thunderGod.life.target).toMatchObject({ location: 'PLAYER', hood: 'OPEN', line: 'CLEAR', marks: 0, durability: 100 });
    expect(s.spirituality).toBe(paid.spirituality); expect(s.mind).toBe(paid.mind); s = finish(s, 'obscured-return');
    expect(s.progression.mastery[GUIDED]).toBe(0); expect(s.thunderGod.life.finn).toMatchObject({ present: false, location: 'AWAY' });
  }, 120_000);

  it('honors technician withdrawal and ordinary abort at every actual target setup boundary', () => {
    let s = enter(promoted(), 'located-target', 'ABILITY'); const states: SliceState[] = [s];
    for (const type of ['PLACE_TARGET', 'STEP_BACK', 'CLEAR_ADULTS', 'OBSERVE_TARGET', 'GUIDED_THUNDER'] as const) { s = act(s, { type }); states.push(s); }
    for (const state of states) {
      const before = structuredClone(state), withdrawn = act(state, { type: 'WITHDRAW_CONSENT', permission: 'TECHNICIAN' });
      rejectThunderGod(withdrawn, { type: 'GUIDED_THUNDER' }); rejectThunderGod(withdrawn, { type: 'DISCHARGE_TARGET' });
      const closed = act(withdrawn, { type: 'ABORT' }), receipt = closed.thunderGod.life.journal.at(-1)!;
      expect(receipt.after).toEqual(receipt.before); expect(closed.health).toBe(before.health); expect(closed.spirituality).toBe(before.spirituality);
      expect(closed.thunderGod.life.target).toMatchObject({ location: 'PLAYER', hood: 'OPEN', durability: before.thunderGod.life.target.durability });
      expect(closed.catastrophe.life.site).toMatchObject({ playerPosition: 'EXIT', keeper: { position: 'CONTROL', energy: before.catastrophe.life.site.keeper.energy } });
      expect(closed.thunderGod.life.finn).toMatchObject({ present: false, location: 'AWAY' }); expect(hasThunderGodLifeLock(closed)).toBe(false);
      expect(closed.thunderGod.life.cases['located-target'].status).toBe('PAUSED');
    }
  }, 120_000);

  it('unlocks the existing weekly finance pulse only after zeroAP physical abort cleanup', () => {
    let s = act(ready(afterPersonal()), { type: 'OBSERVE', caseId: 'obscured-return' }); s = ready(s, { ap: 1, cash: 10, mind: 10, spirituality: 10 });
    while (s.actionsRemaining > 1) s = ordinary(s);
    s = act(s, { type: 'WALK_TO_SITE' }, { type: 'INVITE', caseId: 'obscured-return', method: 'ABILITY' }, { type: 'READ_SOURCE' }, { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'TECHNICIAN' }, { type: 'CONSENT', permission: 'ABILITY' }, { type: 'AGREE_RETURN' }, { type: 'ENTER_SITE' });
    s = act(target(s), { type: 'GUIDED_THUNDER' }, { type: 'CHANGE_CONDITIONS' }, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' });
    expect(s.actionsRemaining).toBe(0); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const before = structuredClone(s), finance = resolveSliceWeeklyFinance({ ...before, pulse: 'BILL' }).state; s = act(s, { type: 'ABORT' });
    expect(s.thunderGod.life.journal.at(-1)!.after.actions).toBe(0); expect(s.week).toBe(before.week + 1); expect(s.actionsRemaining).toBe(before.weeklyBudget);
    expect(s.cash).toBe(finance.cash); expect(s.debts).toEqual(finance.debts); expect(s.health).toBe(before.health); expect(s.spirituality).toBe(before.spirituality);
    expect(s.thunderGod.life.target).toMatchObject({ location: 'PLAYER', hood: 'OPEN', pulse: 'STOPPED' }); expect(s.catastrophe.life.site.keeper.position).toBe('CONTROL');
    expect(hasThunderGodLifeLock(s)).toBe(false); s = act(ready(s), { type: 'REPORT', caseId: 'obscured-return' }); expect(s.progression.mastery[GUIDED]).toBe(0);
  }, 120_000);

  it('rejects forged originals, windows, costs, source observations, rolls and future or missing receipts', () => {
    const s = act(target(enter(promoted(), 'located-target', 'ABILITY')), { type: 'GUIDED_THUNDER' });
    const changes: ((v: SliceState) => void)[] = [
      v => { v.catastrophe.life.site.water.bayUnits++; }, v => { v.catastrophe.life.site.gate.durability++; }, v => { v.catastrophe.life.site.winch.durability++; },
      v => { v.catastrophe.life.site.keeper.energy++; }, v => { v.catastrophe.life.site.keeper.travelMetres += 6; }, v => { v.catastrophe.life.site.playerTravelMetres++; },
      v => { v.catastrophe.life.journal.pop(); }, v => { v.thunderGod.sourceScene!.originals.clockSeconds++; }, v => { v.thunderGod.sourceHistory!.catastrophe.life.site.keeper.energy++; },
      v => { v.thunderGod.life.target.owner = 'TG1-FINN-COLE'; }, v => { v.thunderGod.life.target.durability++; }, v => { v.thunderGod.life.pad.durability++; }, v => { v.thunderGod.life.finn.age = 18 as 44; },
      v => { v.thunderGod.life.finn.location = 'TARGET'; }, v => { v.thunderGod.life.journal.at(-1)!.before.cash++; }, v => { v.thunderGod.life.journal.at(-1)!.after.spirituality++; },
      v => { v.thunderGod.life.journal.at(-1)!.randomAfter!++; }, v => { const e = v.thunderGod.life.journal.at(-1)!; e.check = { ...e.check!, roll: e.check!.roll % 100 + 1 }; },
      v => { v.thunderGod.life.journal.at(-1)!.revision = v.revision + 1; }, v => { v.thunderGod.life.journal.at(-1)!.week = v.week + 1; }, v => { v.thunderGod.life.journal.pop(); },
      v => { v.thunderGod.life.journal.at(-1)!.source!.bonus = 10; }, v => { v.thunderGod.life.clockSeconds++; }, v => { attempt(v).guided.effects = 1; },
      v => { attempt(v).permission.owner = 'WITHDRAWN'; }, v => { attempt(v).observedTargetVersion!++; },
    ];
    if (s.thunderGod.life.pending) changes.push(v => { v.thunderGod.life.pending!.expiresAt++; }, v => { v.thunderGod.life.pending!.targetId = 'SOMEONE-ELSE'; });
    for (const change of changes) { const forged = structuredClone(s); change(forged); expect(validateThunderGodLifeState(forged)).toBe(false); expect(() => assertValidSliceState(forged)).toThrow(); }
    expect(validateThunderGodActivityCommand({ type: 'RELEASE_IMPACT', target: 'NPC' })).toBe(false);
    expect(validateThunderGodActivityCommand({ type: 'CONSENT', permission: 'OLD_PERMISSION' })).toBe(false);
    expect(validateThunderGodActivityCommand({ type: 'BUY_TARGET', price: 0 })).toBe(false);
    expect(blockThunderGodLife(s, { type: 'GUIDED_THUNDER' })).not.toBeNull();
    const projection = projectThunderGodLife(s); expect(projection.site.water).toEqual(originalCatastrophe().catastrophe.life.site.water);
    expect(projection.actions.length).toBeLessThan(12); expect(projection.actions.some(a => a.command.type === 'ABORT' && a.enabled && a.cleanup)).toBe(true);
  }, 120_000);
});
