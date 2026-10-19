import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validateDeathConsulSiteState } from '../../src/domain/death-consul/resources.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import {
  PALE_EMPEROR_CASE_IDS, createPaleEmperorLifeState, initializePaleEmperorLifeState, hasPaleEmperorLifeLock,
  paleEmperorLifeLockedAtRevision, paleEmperorLifeActions, paleEmperorLifeMasteryGains, paleEmperorExpectedOriginals,
  paleEmperorOriginalSnapshot, projectPaleEmperorLife, validatePaleEmperorActivityCommand, validatePaleEmperorLifeState,
  type PaleEmperorActivityCommand, type PaleEmperorCaseId,
} from '../../src/domain/pale-emperor/life.js';
import { originalDeathConsul, originalDeathRoots, promoted, pe, era, ready, ordinary, rejectPaleEmperor, rejectIntent } from './pale-emperor-directed-helper.js';

// The shared helper reads the real815-command source through readObjectEntry
// and migrateSliceState. All earnings, treatment, recovery, potion failures and
// seven-day costs use public commands. No seed or resource replacement.
const QUIETING = 'death.s1.residual-quieting', INTERDICTION = 'death.s1.spiritual-interdiction';
const succeeds = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const attempt = (s: SliceState, id: PaleEmperorCaseId = s.paleEmperor.life.activeCase!) => s.paleEmperor.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, ...commands: PaleEmperorActivityCommand[]): SliceState {
  for (const command of commands) { const length = s.paleEmperor.life.journal.length; s = pe(s, command); expect(s.paleEmperor.life.journal).toHaveLength(length + 1); expect(validatePaleEmperorLifeState(s), JSON.stringify(command)).toBe(true); assertValidSliceState(s); }
  return s;
}
function enter(s: SliceState, caseId: PaleEmperorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY'): SliceState {
  s = ready(s, { ap: 2, cash: s.paleEmperor.life.site ? 10 : 18, mind: 10, spirituality: 16 });
  s = act(s, { type: 'OBSERVE', caseId }, { type: 'WALK_TO_ANNEX' });
  if (s.paleEmperor.life.site!.seals.every(x => x.state === 'SUPPLIER')) s = act(s, { type: 'BUY_SEALS' });
  return act(s, { type: 'INVITE', caseId, method }, { type: 'CONSENT', permission: 'CUSTODIAN' }, { type: method === 'ABILITY' ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'ABILITY' }, { type: 'PREPARE_VESSEL' }, { type: 'OBSERVE_VESSEL' });
}
function finish(s: SliceState, caseId: PaleEmperorCaseId): SliceState {
  s = act(s, { type: 'RETURN_LOAN' }, { type: 'LEAVE' });
  return act(ready(s), { type: 'REPORT', caseId });
}
function quiet(s: SliceState): SliceState { return finish(act(enter(s, 'quiet-lid'), { type: 'ORDINARY_FIT' }, { type: 'RESEAL' }), 'quiet-lid'); }
function guarded(s: SliceState): SliceState { return finish(act(enter(s, 'guarded-carry'), { type: 'SCREENED_CARRY' }, { type: 'ORDINARY_FIT' }, { type: 'RESEAL' }), 'guarded-carry'); }
function withdrawn(s: SliceState): SliceState { return finish(act(enter(s, 'withdrawn-return'), { type: 'WITHDRAW_CONSENT', permission: 'CUSTODIAN' }, { type: 'MANUAL_RETURN' }), 'withdrawn-return'); }
function expectedCheck(s: SliceState, ability: 'will' | 'knowledge') {
  const rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
  return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty: 18, modifiers: [], roll: rng.nextInt(1, 100) });
}
let quietCache: SliceState | undefined, carryCache: SliceState | undefined;
const afterQuiet = () => structuredClone(quietCache ??= quiet(promoted()));
const afterCarry = () => structuredClone(carryCache ??= guarded(afterQuiet()));

describe('Pale Emperor finite contemporary annex', () => {
  it('preserves the wounded real source, historical people and all old original objects', () => {
    const source = originalDeathConsul(), s = promoted();
    expect(source).toMatchObject({ health: 20, cash: 34, actionsRemaining: 1, injuryRisk: 6 });
    expect(source.injuries).toHaveLength(4); expect(source.injuries.every(i => i.treatedRevision === null)).toBe(true);
    expect(source.deathConsul.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 80, enemySpirituality: 46, enemyStatus: 'RESISTING' });
    expect(source.undying.encounter).toMatchObject({ status: 'AVAILABLE', enemy: { health: 100, status: 'RESISTING' } });
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION); expect(s.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(originalDeathRoots(s)).toEqual(originalDeathRoots(source));
    expect(paleEmperorOriginalSnapshot(s)).toEqual(source.deathConsul.life.site);
    expect(paleEmperorExpectedOriginals(s)).toEqual(source.deathConsul.life.site);
    expect(s.paleEmperor.life).toMatchObject({ sourceWeek: s.paleEmperor.promotionWeek, site: null, nora: null, playerLocation: 'RECEPTION', visits: 0, journal: [] });
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(s.progression.mastery[QUIETING]).toBe(0); expect(s.progression.mastery[INTERDICTION]).toBe(0);
    expect(hasPaleEmperorLifeLock(s)).toBe(false); expect(createPaleEmperorLifeState().sourceWeek).toBeNull();
  }, 360_000);

  it('admits a legitimate quiescent S2 site without pinning stocks or seed to the capture', () => {
    // Local admission unit only, not another earned campaign.
    const s = promoted(), site = structuredClone(s.deathConsul.life.site);
    site.door.state = 'CLOSED'; site.door.operations++;
    expect(validateDeathConsulSiteState(site)).toBe(true);
    s.deathConsul.life.site = structuredClone(site); s.paleEmperor.sourceScene!.originals = structuredClone(site);
    s.paleEmperor.life = createPaleEmperorLifeState();
    expect(() => initializePaleEmperorLifeState(s)).not.toThrow();
    expect(s.paleEmperor.life.site).toBeNull(); expect(s.paleEmperor.life.nora).toBeNull();
    expect(s.deathConsul.life.site).toEqual(site);
  }, 360_000);

  it('completes three ordinary cases with the same vessel, two paid seals and real return', () => {
    let s = withdrawn(afterCarry()); s = act(ready(s), { type: 'REFLECT' }); const life = s.paleEmperor.life, site = life.site!;
    expect(PALE_EMPEROR_CASE_IDS.every(id => life.cases[id].status === 'RESOLVED' && life.cases[id].result === 'ORDINARY')).toBe(true);
    expect(life.journal.reduce((n, e) => n + e.before.cash - e.after.cash, 0)).toBe(38);
    expect(life.journal.reduce((n, e) => n + e.before.actions - e.after.actions, 0)).toBe(10);
    expect(life.journal.every(e => e.check === null && e.randomBefore === null && e.randomAfter === null)).toBe(true);
    expect(site.vessel).toMatchObject({ id: 'PE1-VESSEL-1', nature: 'NON_SENTIENT_RESIDUAL', quantity: 1, holder: 'ANNEX', location: 'NEAR', agitation: 2, lid: 'CLOSED', seal: 'BROKEN', scuffs: 5, travelledMetres: 8 });
    expect(site.seals).toEqual([1, 2].map((i) => expect.objectContaining({ id: `PE1-SEAL-${i}`, price: 4, state: 'USED' })));
    expect(site.seals.every(x => x.purchasedWeek !== null && x.usedWeek !== null)).toBe(true);
    expect(site.loan).toMatchObject({ custodianId: 'PE1-NORA', terms: 'RETURN_SAME_VESSEL_AND_LID', grants: 3, returns: 3 });
    expect(site.lid).toMatchObject({ id: 'PE1-LID-1', location: 'VESSEL', travelledMetres: 8 });
    expect(site.box).toMatchObject({ location: 'NEAR', closed: true, travelledMetres: 8 });
    expect(site.screen).toMatchObject({ location: 'NEAR', state: 'DEPLOYED', travelledMetres: 8 });
    expect(life.playerTravelMetres).toBe(88); expect(life.nora).toMatchObject({ id: 'PE1-NORA', age: 42, energy: 80, travelMetres: 40, present: false, location: 'AWAY' });
    expect(life.playerLocation).toBe('RECEPTION'); expect(life.pending).toBeNull(); expect(hasPaleEmperorLifeLock(s)).toBe(false);
    expect(s.progression.acting).toBe(100); expect(paleEmperorLifeMasteryGains(s)).toEqual({ [QUIETING]: 0, [INTERDICTION]: 0 });
    expect(originalDeathRoots(s)).toEqual(originalDeathRoots(originalDeathConsul()));
    rejectPaleEmperor(s, { type: 'BUY_SEALS' }); rejectPaleEmperor(s, { type: 'REFLECT' });
    const before = structuredClone(s); s = era(ready(s), 'ERA_WORK');
    expect(s.ferryman.era.works).toBeGreaterThan(before.ferryman.era.works); expect(s.paleEmperor.life).toEqual(before.paleEmperor.life);
  }, 360_000);

  it('introduces people and objects only on arrival and honors current refusal without borrowing', () => {
    let s = act(ready(promoted(), { ap: 2, cash: 18 }), { type: 'OBSERVE', caseId: 'quiet-lid' });
    expect(s.paleEmperor.life.site).toBeNull(); expect(s.paleEmperor.life.nora).toBeNull();
    s = act(s, { type: 'WALK_TO_ANNEX' }, { type: 'BUY_SEALS' }, { type: 'INVITE', caseId: 'quiet-lid', method: 'ABILITY' });
    const site = structuredClone(s.paleEmperor.life.site), cash = s.cash;
    rejectPaleEmperor(s, { type: 'PREPARE_VESSEL' }); rejectPaleEmperor(s, { type: 'RESIDUAL_QUIETING' });
    s = act(s, { type: 'DECLINE_CONSENT', permission: 'CUSTODIAN' });
    rejectPaleEmperor(s, { type: 'CONSENT', permission: 'CUSTODIAN' }); rejectPaleEmperor(s, { type: 'PREPARE_VESSEL' });
    s = act(s, { type: 'ABORT' });
    expect(s.paleEmperor.life.site).toEqual(site); expect(s.cash).toBe(cash); expect(s.paleEmperor.life.cases['quiet-lid'].status).toBe('PAUSED');
    expect(s.paleEmperor.life.nora).toMatchObject({ energy: 96, present: false, location: 'AWAY', travelMetres: 8 });
    expect(s.paleEmperor.life.playerTravelMetres).toBe(24); expect(hasPaleEmperorLifeLock(s)).toBe(false);
    rejectPaleEmperor(s, { type: 'REPORT', caseId: 'quiet-lid' });
    s = act(ready(s, { ap: 2, cash: 10, afterWeek: s.week }), { type: 'WALK_TO_ANNEX' });
    rejectPaleEmperor(s, { type: 'INVITE', caseId: 'quiet-lid', method: 'ABILITY' });
    s = act(s, { type: 'INVITE', caseId: 'quiet-lid', method: 'ORDINARY' }, { type: 'CONSENT', permission: 'CUSTODIAN' }, { type: 'DECLINE_CONSENT', permission: 'ABILITY' }, { type: 'PREPARE_VESSEL' }, { type: 'ORDINARY_FIT' }, { type: 'RESEAL' });
    s = finish(s, 'quiet-lid'); expect(s.progression.mastery[QUIETING]).toBe(0);
  }, 360_000);

  it('separates a paid quieting check, actual fit and a single report reward', () => {
    let s = enter(promoted(), 'quiet-lid', 'ABILITY'); const before = structuredClone(s), check = expectedCheck(s, 'will');
    s = act(s, { type: 'RESIDUAL_QUIETING' });
    expect(s.paleEmperor.life.journal.at(-1)!.check).toEqual(check); expect(s.random.cursor).toBe(before.random.cursor + 1);
    expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 2);
    expect(s.paleEmperor.life.site!.vessel.lid).toBe('OPEN'); expect(attempt(s).quieting.effects).toBe(0); expect(s.progression.mastery[QUIETING]).toBe(0);
    rejectPaleEmperor(s, { type: 'RESIDUAL_QUIETING' });
    if (succeeds(check.tier)) { expect(s.paleEmperor.life.pending!.expiresAt - s.paleEmperor.life.pending!.createdAt).toBe(20); expect(s.paleEmperor.life.site!.vessel.agitation).toBe(0); s = act(s, { type: 'FIT_LID' }); expect(s.paleEmperor.life.journal.at(-1)!.applications).toEqual(['QUIET_LID']); }
    else { expect(attempt(s).quieting.state).toBe('FAILED'); rejectPaleEmperor(s, { type: 'FIT_LID' }); s = act(s, { type: 'ORDINARY_FIT' }); }
    expect(s.paleEmperor.life.site!.vessel.agitation).toBe(2); expect(s.paleEmperor.life.site!.vessel.lid).toBe('CLOSED'); expect(s.progression.mastery[QUIETING]).toBe(0);
    expect(s.paleEmperor.life.site!.seals.filter(x => x.state === 'PLAYER')).toHaveLength(2);
    s = act(s, { type: 'RESEAL' }); s = finish(s, 'quiet-lid');
    expect(s.progression.mastery[QUIETING]).toBe(succeeds(check.tier) ? 8 : 0); expect(attempt(s, 'quiet-lid').quieting.effects).toBe(succeeds(check.tier) ? 1 : 0);
    expect(s.paleEmperor.life.site!.seals.filter(x => x.state === 'USED')).toHaveLength(1);
    rejectPaleEmperor(s, { type: 'REPORT', caseId: 'quiet-lid' });
  }, 360_000);

  it('expires or invalidates the paid window without resetting original agitation, scuffs or seals', () => {
    const opened = act(enter(promoted(), 'quiet-lid', 'ABILITY'), { type: 'RESIDUAL_QUIETING' });
    for (const ending of ['WAIT_WINDOW', 'CLOSE_DOOR', 'DEPLOY_SCREEN', 'WITHDRAW_CONSENT'] as const) {
      let s = structuredClone(opened); const paid = { mind: s.mind, spirituality: s.spirituality }, beforeSite = structuredClone(s.paleEmperor.life.site!);
      if (s.paleEmperor.life.pending) {
        const time = s.paleEmperor.life.clockSeconds;
        s = act(s, ending === 'WITHDRAW_CONSENT' ? { type: ending, permission: 'ABILITY' } : { type: ending });
        expect(attempt(s).quieting.state).toBe(ending === 'WAIT_WINDOW' ? 'EXPIRED' : ending === 'WITHDRAW_CONSENT' ? 'STOPPED' : 'INVALIDATED');
        if (ending === 'WAIT_WINDOW') expect(s.paleEmperor.life.clockSeconds).toBe(time + 20);
      } else expect(attempt(s).quieting.state).toBe('FAILED');
      expect(s.paleEmperor.life.pending).toBeNull(); expect(s.paleEmperor.life.site!.vessel).toEqual({ ...beforeSite.vessel, agitation: 2 });
      rejectPaleEmperor(s, { type: 'FIT_LID' }); rejectPaleEmperor(s, { type: 'RESIDUAL_QUIETING' });
      s = act(s, { type: 'ORDINARY_FIT' }, { type: 'RESEAL' }); s = finish(s, 'quiet-lid');
      expect(s.paleEmperor.life.site!.vessel).toMatchObject({ agitation: 2, lid: 'CLOSED', scuffs: 1 });
      expect(attempt(s, 'quiet-lid').quieting.effects).toBe(0); expect(s.progression.mastery[QUIETING]).toBe(0);
      // No ordinary recovery is needed while inside, and the completed case
      // does not refund the cast. Any later ordinary rest is separately logged.
      const cast = s.paleEmperor.life.journal.find(x => x.command.type === 'RESIDUAL_QUIETING')!;
      expect(cast.after.mind).toBe(paid.mind); expect(cast.after.spirituality).toBe(paid.spirituality);
    }
  }, 360_000);

  it('blocks one actual propagation only during a separate physical carry', () => {
    let s = enter(afterQuiet(), 'guarded-carry', 'ABILITY'); const before = structuredClone(s), check = expectedCheck(s, 'knowledge');
    s = act(s, { type: 'SPIRITUAL_INTERDICTION' });
    expect(s.paleEmperor.life.site!.vessel.location).toBe('NEAR'); expect(attempt(s).interdiction.effects).toBe(0);
    expect(s.spirituality).toBe(before.spirituality - 7); expect(s.mind).toBe(before.mind - 2); expect(s.paleEmperor.life.journal.at(-1)!.check).toEqual(check);
    const energy = s.paleEmperor.life.nora!.energy, metres = s.paleEmperor.life.playerTravelMetres;
    s = act(s, { type: succeeds(check.tier) ? 'CARRY_VESSEL' : 'SCREENED_CARRY' });
    expect(s.paleEmperor.life.site!.vessel).toMatchObject({ id: 'PE1-VESSEL-1', location: 'FAR', travelledMetres: 4, agitation: 2 });
    expect(s.paleEmperor.life.playerTravelMetres).toBe(metres + 4); expect(s.paleEmperor.life.nora!.energy).toBe(energy - 2); expect(s.paleEmperor.life.nora!.location).toBe('FAR');
    expect(attempt(s).interdiction.effects).toBe(succeeds(check.tier) ? 1 : 0); expect(s.progression.mastery[INTERDICTION]).toBe(0);
    rejectPaleEmperor(s, { type: 'CARRY_VESSEL' }); rejectPaleEmperor(s, { type: 'SPIRITUAL_INTERDICTION' });
    s = act(s, { type: 'ORDINARY_FIT' }, { type: 'RESEAL' }); s = finish(s, 'guarded-carry');
    expect(s.paleEmperor.life.site!.vessel.location).toBe('FAR'); expect(s.paleEmperor.life.site!.seals.every(x => x.state === 'USED')).toBe(true);
    expect(s.progression.mastery[INTERDICTION]).toBe(succeeds(check.tier) ? 8 : 0);
  }, 360_000);

  it('withdraws before third-case carry, preserves paid costs and physically returns without a third seal', () => {
    let s = enter(afterCarry(), 'withdrawn-return', 'ABILITY');
    expect(s.paleEmperor.life.playerLocation).toBe('FAR'); expect(s.paleEmperor.life.site!.vessel.location).toBe('FAR');
    s = act(s, { type: 'SPIRITUAL_INTERDICTION' }); const paid = structuredClone(s), pending = s.paleEmperor.life.pending !== null;
    rejectPaleEmperor(s, { type: 'CARRY_VESSEL' });
    s = act(s, { type: 'WITHDRAW_CONSENT', permission: 'CUSTODIAN' });
    expect(s.paleEmperor.life.pending).toBeNull(); expect(attempt(s).interdiction.state).toBe(pending ? 'STOPPED' : 'FAILED');
    rejectPaleEmperor(s, { type: 'CONSENT', permission: 'CUSTODIAN' }); rejectPaleEmperor(s, { type: 'SPIRITUAL_INTERDICTION' }); rejectPaleEmperor(s, { type: 'SCREENED_CARRY' });
    s = act(s, { type: 'MANUAL_RETURN' });
    expect(s.paleEmperor.life.playerTravelMetres).toBe(paid.paleEmperor.life.playerTravelMetres + 4);
    expect(s.paleEmperor.life.site!.vessel).toMatchObject({ location: 'NEAR', agitation: 2, travelledMetres: 8, lid: 'CLOSED' });
    expect(s.paleEmperor.life.nora!.location).toBe('FAR'); expect(s.paleEmperor.life.nora!.energy).toBe(paid.paleEmperor.life.nora!.energy);
    expect(s.spirituality).toBe(paid.spirituality); expect(s.mind).toBe(paid.mind); expect(s.health).toBe(paid.health);
    expect(s.paleEmperor.life.site!.seals).toEqual(paid.paleEmperor.life.site!.seals); expect(attempt(s).interdiction.effects).toBe(0);
    s = finish(s, 'withdrawn-return'); expect(s.progression.mastery[INTERDICTION]).toBe(0); expect(s.paleEmperor.life.nora).toMatchObject({ present: false, location: 'AWAY' });
    expect(originalDeathRoots(s)).toEqual(originalDeathRoots(originalDeathConsul()));
  }, 360_000);

  it('locks real current-era work until zero-AP ordinary cleanup and never advances the week for free', () => {
    let s = ready(promoted(), { ap: 2, cash: 18 }); while (s.actionsRemaining > 2) s = ordinary(s);
    s = enter(s, 'quiet-lid', 'ABILITY'); expect(s.actionsRemaining).toBe(0);
    const before = structuredClone(s), week = s.week, date = structuredClone(s.date);
    rejectIntent(s, { type: 'FERRYMAN', command: { type: 'ERA_WORK' } }); rejectIntent(s, { type: 'FERRYMAN', command: { type: 'ERA_REST' } }); rejectIntent(s, { type: 'FERRYMAN', command: { type: 'ERA_NEXT_WEEK' } });
    expect(paleEmperorLifeLockedAtRevision(s, s.revision)).toBe(true);
    s = act(s, { type: 'ABORT' }); const exit = s.paleEmperor.life.journal.at(-1)!;
    expect(exit.after.actions).toBe(0); expect(exit.playerWalkedMetres).toBe(12); expect(exit.noraWalkedMetres).toBe(4);
    expect(s.week).toBe(week); expect(s.date).toEqual(date); expect(s.ferryman.era).toEqual(before.ferryman.era); expect(s.cash).toBe(before.cash);
    expect(s.health).toBe(before.health); expect(s.mind).toBe(before.mind); expect(s.spirituality).toBe(before.spirituality);
    expect(s.paleEmperor.life.site!.box.closed).toBe(true); expect(s.paleEmperor.life.site!.vessel.holder).toBe('ANNEX'); expect(hasPaleEmperorLifeLock(s)).toBe(false);
    expect(paleEmperorLifeLockedAtRevision(s, s.revision)).toBe(false);
    rejectPaleEmperor(s, { type: 'ABORT' });
  }, 360_000);

  it('rejects forged persons, originals, stocks, costs, movement, conditions, RNG and unearned mastery', () => {
    const s = act(enter(promoted(), 'quiet-lid', 'ABILITY'), { type: 'RESIDUAL_QUIETING' });
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.deathConsul.life.site.operatorEnergy += 2; }, v => { v.deathConsul.life.site.door.operations--; },
      v => { v.deathConsul.life.site.material.remaining = 1; }, v => { v.deathConsul.life.journal.pop(); },
      v => { v.paleEmperor.life.site!.vessel.scuffs++; }, v => { v.paleEmperor.life.site!.seals[0]!.state = 'SUPPLIER'; },
      v => { v.paleEmperor.life.site!.loan.grants++; }, v => { v.paleEmperor.life.site!.vessel.location = 'FAR'; },
      v => { v.paleEmperor.life.nora!.energy += 2; }, v => { v.paleEmperor.life.nora!.travelMetres += 4; },
      v => { v.paleEmperor.life.journal.at(-1)!.after.spirituality++; }, v => { v.paleEmperor.life.journal.at(-1)!.before.cash++; },
      v => { v.paleEmperor.life.journal.at(-1)!.randomAfter!++; }, v => { v.paleEmperor.life.journal.at(-1)!.check!.roll = 1 + v.paleEmperor.life.journal.at(-1)!.check!.roll % 100; },
      v => { v.paleEmperor.life.clockSeconds++; }, v => { v.paleEmperor.life.conditionVersion++; },
      v => { attempt(v).quieting.effects = 1; }, v => { attempt(v).permission.ability = 'DECLINED'; },
      v => { v.paleEmperor.life.journal.pop(); }, v => { v.health--; },
    ];
    for (const mutate of mutations) { const forged = structuredClone(s); mutate(forged); expect(validatePaleEmperorLifeState(forged)).toBe(false); expect(() => assertValidSliceState(forged)).toThrow(); }
    expect(validatePaleEmperorActivityCommand({ type: 'BUY_SEALS', quantity: 3 })).toBe(false);
    expect(validatePaleEmperorActivityCommand({ type: 'CONSENT', permission: 'VERA' })).toBe(false);
    expect(validatePaleEmperorActivityCommand({ type: 'RESIDUAL_QUIETING', target: 'REED' })).toBe(false);
    const projection = projectPaleEmperorLife(s);
    expect([projection.story, projection.source, projection.environment, ...projection.cases.map(c => c.story)].join(' ')).not.toMatch(/原创G|候选|开发|原著序列依据/);
    expect(projection.actions.length).toBeLessThan(12); expect(paleEmperorLifeActions(s).some(a => a.command.type === 'ABORT' && a.enabled && a.cleanup)).toBe(true);
  }, 360_000);
});
