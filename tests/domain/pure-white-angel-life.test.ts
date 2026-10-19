import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { validateLightSeekerSiteState } from '../../src/domain/light-seeker/resources.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import {
  PURE_WHITE_ANGEL_CASE_IDS, pureWhiteAngelExpectedOriginals, pureWhiteAngelLifeActions, pureWhiteAngelLifeMasteryGains,
  pureWhiteAngelOriginalSnapshot, createPureWhiteAngelLifeState, initializePureWhiteAngelLifeState, hasPureWhiteAngelLifeLock,
  projectPureWhiteAngelLife, validatePureWhiteAngelActivityCommand, validatePureWhiteAngelLifeState,
  type PureWhiteAngelActivityCommand, type PureWhiteAngelCaseId,
} from '../../src/domain/pure-white-angel/life.js';
import { originalLightSeeker, promoted, pw, ready, ordinary, rejectPureWhiteAngel } from './pure-white-angel-directed-helper.js';

// The helper reads the actual729-command source through readObjectEntry and
// migrateSliceState, then performs real discovery, paid care, ordinary recovery,
// work and potion commands. Tests never manufacture a healed source or seek RNG.
const FOCUSED = 'sun.s1.focused-purification', GUARD = 'sun.s1.warm-radiance-guard';
const succeeds = (t: string | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const attempt = (s: SliceState, id: PureWhiteAngelCaseId = s.pureWhiteAngel.life.activeCase!) => s.pureWhiteAngel.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, ...commands: PureWhiteAngelActivityCommand[]): SliceState {
  for (const command of commands) { const length = s.pureWhiteAngel.life.journal.length; s = pw(s, command); expect(s.pureWhiteAngel.life.journal).toHaveLength(length + 1); expect(validatePureWhiteAngelLifeState(s), JSON.stringify(command)).toBe(true); assertValidSliceState(s); }
  return s;
}
function supplies(s: SliceState): SliceState {
  if (s.pureWhiteAngel.life.sample.purchasedWeek === null) s = act(ready(s, { cash: 40 }), { type: 'BUY_SAMPLE' });
  if (s.pureWhiteAngel.life.pad.purchasedWeek === null) s = act(ready(s, { cash: 20 }), { type: 'BUY_PAD' });
  return s;
}
function enterObserved(s: SliceState, caseId: PureWhiteAngelCaseId, method: 'ABILITY' | 'ORDINARY'): SliceState {
  s = ready(s, { cash: 10, mind: 10, spirituality: 16 });
  s = act(s, { type: 'WALK_TO_GALLERY' }, { type: 'INVITE', caseId, method }, { type: 'READ_SOURCE' }, { type: 'ASK_SPIRIT' }, { type: 'ACKNOWLEDGE_REFUSAL' },
    { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'TECHNICIAN' }, { type: method === 'ABILITY' ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'ABILITY' }, { type: 'AGREE_RETURN' });
  if (s.lightSeeker.life.site.operatorLocation !== 'SIDE') s = act(s, { type: 'MOVE_OWNER_SIDE' });
  return act(s, { type: 'MOVE_TECHNICIAN_SIDE' }, { type: 'ENTER_GALLERY' });
}
function enter(s: SliceState, caseId: PureWhiteAngelCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY'): SliceState {
  return enterObserved(supplies(act(ready(s), { type: 'OBSERVE', caseId })), caseId, method);
}
function finish(s: SliceState, caseId: PureWhiteAngelCaseId): SliceState {
  if (s.pureWhiteAngel.life.pending) s = act(s, { type: 'STOP' });
  if (s.lightSeeker.life.site.shutter.state === 'CLOSED') s = act(s, { type: 'OPEN_SHUTTER' });
  if (s.pureWhiteAngel.life.sample.location === 'FAR') s = act(s, { type: 'RETRIEVE_SAMPLE' });
  if (s.pureWhiteAngel.life.pad.location === 'WORN') s = act(s, { type: 'RETRIEVE_PAD' });
  s = act(s, { type: 'EXIT_GALLERY' }, { type: 'LEAVE' });
  return act(ready(s), { type: 'REPORT', caseId });
}
function residue(s: SliceState): SliceState { return finish(act(enter(s, 'residue-trace'), { type: 'PLACE_SAMPLE' }, { type: 'OBSERVE_SAMPLE' }, { type: 'MANUAL_CONTAIN' }), 'residue-trace'); }
function impact(s: SliceState): SliceState { return finish(act(enter(s, 'personal-impact'), { type: 'WEAR_PAD' }, { type: 'DECLARE_IMPACT' }, { type: 'HANDLE_RESET' }), 'personal-impact'); }
function screened(s: SliceState): SliceState { return finish(act(enter(s, 'screened-return'), { type: 'WEAR_PAD' }, { type: 'DECLARE_IMPACT' }, { type: 'CHANGE_CONDITIONS' }, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, { type: 'HANDLE_RESET' }), 'screened-return'); }
function expectedCheck(s: SliceState, ability: 'will' | 'knowledge', bonus = false) {
  const rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
  return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty: 18, modifiers: bonus ? [{ source: '同一已观察残留的有限净光', value: 10 }] : [], roll: rng.nextInt(1, 100) });
}
let residueCache: SliceState | undefined, impactCache: SliceState | undefined;
const afterResidue = () => structuredClone(residueCache ??= residue(promoted()));
const afterImpact = () => structuredClone(impactCache ??= impact(afterResidue()));

describe('Pure White Angel original gallery and finite personal practice', () => {
  it('preserves the actual wounded source, original dead Owen, eight roots and current save format', () => {
    const old = originalLightSeeker(), s = promoted(), l = s.pureWhiteAngel.life;
    expect(old.health).toBe(50); expect(old.injuries).toHaveLength(3); expect(old.lightSeeker.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'DEAD', enemyHealth: 0 });
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION); expect(s.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(l.sourceWeek).toBe(s.pureWhiteAngel.promotionWeek); expect(l.journal).toEqual([]); expect(l.playerLocation).toBe('OUTSIDE');
    expect(l.ivan).toMatchObject({ id: 'PW1-IVAN-MERROW', age: 43, present: false, location: 'AWAY', travelMetres: 0 });
    expect(l.sample).toMatchObject({ id: 'PW1-RESIDUE-1', residueUnits: 1, purchasedWeek: null, location: 'SUPPLIER', price: 40 });
    expect(l.pad).toMatchObject({ id: 'PW1-PAD-1', durability: 100, purchasedWeek: null, location: 'SUPPLIER', price: 20 });
    expect(s.lightSeeker).toEqual(old.lightSeeker); expect(pureWhiteAngelExpectedOriginals(s)).toEqual(old.lightSeeker.life.site);
    expect(s.progression.mastery[FOCUSED]).toBe(0); expect(s.progression.mastery[GUARD]).toBe(0);
    for (const [id, value] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(createPureWhiteAngelLifeState().sourceWeek).toBeNull(); expect(hasPureWhiteAngelLifeLock(s)).toBe(false);
  }, 180_000);

  it('admits a locally valid quiescent original gallery without pinning production to fixture stocks', () => {
    // Unit-only admission check: not presented as another earned campaign.
    const s = promoted(), site = structuredClone(s.lightSeeker.life.site);
    site.lamp.oil = 0; site.shutter = { ...site.shutter, state: 'CLOSED', durability: 80, operations: 20 };
    expect(validateLightSeekerSiteState(site)).toBe(true);
    s.lightSeeker.life.site = structuredClone(site); s.pureWhiteAngel.sourceScene!.originals = structuredClone(site);
    s.pureWhiteAngel.life = createPureWhiteAngelLifeState();
    expect(() => initializePureWhiteAngelLifeState(s)).not.toThrow(); expect(s.pureWhiteAngel.life.clockSeconds).toBe(site.elapsedSeconds);
  }, 180_000);

  it('completes all three ordinary cases with one sample, one pad, real original wear and no mastery', () => {
    let s = screened(afterImpact()); s = act(ready(s), { type: 'REFLECT' }); const l = s.pureWhiteAngel.life, old = originalLightSeeker().lightSeeker.life.site;
    expect(PURE_WHITE_ANGEL_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED' && l.cases[id].result === 'ORDINARY')).toBe(true);
    expect(l.journal.reduce((n, e) => n + e.before.cash - e.after.cash, 0)).toBe(90);
    expect(l.journal.reduce((n, e) => n + e.before.actions - e.after.actions, 0)).toBe(12);
    expect(l.journal.every(e => e.check === null && e.randomBefore === null && e.randomAfter === null)).toBe(true);
    expect(l.sample).toMatchObject({ id: 'PW1-RESIDUE-1', residueUnits: 1, contained: true, location: 'PLAYER' });
    expect(l.pad).toMatchObject({ durability: 80, impacts: 0, resets: 2, location: 'PLAYER' });
    expect(l.playerTravelMetres).toBe(66); expect(l.ivan.travelMetres).toBe(102);
    const live = s.lightSeeker.life.site;
    expect(live.playerMetres).toBe(old.playerMetres + 42); expect(live.elapsedSeconds).toBe(old.elapsedSeconds + l.elapsedSeconds);
    expect(live.operatorMetres).toBe(old.operatorMetres); expect(live.operatorEnergy).toBe(old.operatorEnergy - 6); expect(live.operatorLocation).toBe('SIDE');
    expect(live.spiritMetres).toBe(old.spiritMetres); expect(live.spiritEnergy).toBe(96); expect(live.spiritLocation).toBe('SIDE');
    expect(live.shutter).toMatchObject({ state: 'OPEN', durability: old.shutter.durability - 2, operations: old.shutter.operations + 2 });
    for (const key of ['lamp', 'cover', 'screen', 'board', 'light'] as const) expect(live[key]).toEqual(old[key]);
    expect(s.lightSeeker.life.cases).toEqual(originalLightSeeker().lightSeeker.life.cases); expect(s.lightSeeker.life.journal).toEqual(originalLightSeeker().lightSeeker.life.journal);
    expect(l.ivan).toMatchObject({ present: false, location: 'AWAY' }); expect(l.maraPresent).toBe(false); expect(hasPureWhiteAngelLifeLock(s)).toBe(false);
    expect(s.progression.acting).toBe(100); expect(pureWhiteAngelLifeMasteryGains(s)).toEqual({ [FOCUSED]: 0, [GUARD]: 0 });
    rejectPureWhiteAngel(s, { type: 'BUY_SAMPLE' }); rejectPureWhiteAngel(s, { type: 'BUY_PAD' }); rejectPureWhiteAngel(s, { type: 'REFLECT' });
  }, 180_000);

  it('requires three fresh independent permissions and records Reed refusal without forced movement', () => {
    let s = supplies(act(ready(promoted()), { type: 'OBSERVE', caseId: 'residue-trace' }));
    s = act(ready(s, { cash: 10 }), { type: 'WALK_TO_GALLERY' }, { type: 'INVITE', caseId: 'residue-trace', method: 'ABILITY' });
    rejectPureWhiteAngel(s, { type: 'CONSENT', permission: 'OWNER' }); rejectPureWhiteAngel(s, { type: 'ENTER_GALLERY' });
    const original = structuredClone(s.lightSeeker.life.site);
    s = act(s, { type: 'READ_SOURCE' }, { type: 'ASK_SPIRIT' }, { type: 'ACKNOWLEDGE_REFUSAL' }, { type: 'CONSENT', permission: 'OWNER' });
    expect(attempt(s)).toMatchObject({ spiritAnswer: 'DECLINED', refusalAcknowledged: true, permission: { owner: 'GRANTED', technician: 'UNASKED', ability: 'UNASKED' } });
    expect(s.lightSeeker.life.site).toMatchObject({ spiritId: original.spiritId, spiritEnergy: original.spiritEnergy, spiritMetres: original.spiritMetres, spiritLocation: 'SIDE', operatorEnergy: original.operatorEnergy - 2 });
    rejectPureWhiteAngel(s, { type: 'ENTER_GALLERY' }); s = act(s, { type: 'DECLINE_CONSENT', permission: 'TECHNICIAN' });
    rejectPureWhiteAngel(s, { type: 'CONSENT', permission: 'TECHNICIAN' }); rejectPureWhiteAngel(s, { type: 'FOCUSED_PURIFICATION' });
    s = act(s, { type: 'LEAVE' }); s = act(ready(s), { type: 'REPORT', caseId: 'residue-trace' }); expect(s.progression.mastery[FOCUSED]).toBe(0);
  }, 180_000);

  it('separates paid focused window, actual one-unit cleansing and report-only mastery', () => {
    let s = act(enter(promoted(), 'residue-trace', 'ABILITY'), { type: 'PLACE_SAMPLE' }, { type: 'OBSERVE_SAMPLE' });
    const before = structuredClone(s), cast = expectedCheck(s, 'will'); s = act(s, { type: 'FOCUSED_PURIFICATION' });
    expect(s.pureWhiteAngel.life.journal.at(-1)!.check).toEqual(cast); expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 2);
    expect(s.pureWhiteAngel.life.sample.residueUnits).toBe(1); expect(attempt(s).focused.effects).toBe(0); expect(s.progression.mastery[FOCUSED]).toBe(0);
    if (succeeds(cast.tier)) expect(s.pureWhiteAngel.life.pending!.expiresAt - s.pureWhiteAngel.life.pending!.createdAt).toBe(30);
    rejectPureWhiteAngel(s, { type: 'FOCUSED_PURIFICATION' }); const clean = expectedCheck(s, 'will', succeeds(cast.tier)), cursor = s.random.cursor;
    s = act(s, { type: 'CLEANSE_SAMPLE' }); const applied = succeeds(cast.tier) && succeeds(clean.tier);
    expect(s.random.cursor).toBe(cursor + 1); expect(s.pureWhiteAngel.life.journal.at(-1)!.check).toEqual(clean);
    expect(s.pureWhiteAngel.life.sample.residueUnits).toBe(succeeds(clean.tier) ? 0 : 1); expect(attempt(s).focused.effects).toBe(applied ? 1 : 0);
    expect(s.progression.mastery[FOCUSED]).toBe(0); rejectPureWhiteAngel(s, { type: 'CLEANSE_SAMPLE' });
    if (!succeeds(clean.tier)) s = act(s, { type: 'MANUAL_CONTAIN' }); s = finish(s, 'residue-trace');
    expect(s.progression.mastery[FOCUSED]).toBe(applied ? 8 : 0); expect(attempt(s, 'residue-trace').cleanseTier).toBe(clean.tier);
    expect(s.pureWhiteAngel.life.sample.id).toBe('PW1-RESIDUE-1'); rejectPureWhiteAngel(s, { type: 'BUY_SAMPLE' });
  }, 180_000);

  it('expires paid windows without free recast, refills or falsely purified ordinary containment', () => {
    let s = act(enter(promoted(), 'residue-trace', 'ABILITY'), { type: 'PLACE_SAMPLE' }, { type: 'OBSERVE_SAMPLE' }, { type: 'FOCUSED_PURIFICATION' });
    const paid = { mind: s.mind, spirituality: s.spirituality }, time = s.pureWhiteAngel.life.clockSeconds;
    if (s.pureWhiteAngel.life.pending) { s = act(s, { type: 'WAIT_WINDOW' }); expect(s.pureWhiteAngel.life.clockSeconds).toBe(time + 30); expect(attempt(s).focused.state).toBe('EXPIRED'); }
    else expect(attempt(s).focused.state).toBe('FAILED');
    rejectPureWhiteAngel(s, { type: 'FOCUSED_PURIFICATION' }); rejectPureWhiteAngel(s, { type: 'WAIT_WINDOW' });
    s = act(s, { type: 'MANUAL_CONTAIN' }); expect(s.pureWhiteAngel.life.sample).toMatchObject({ residueUnits: 1, contained: true });
    expect(s.mind).toBe(paid.mind); expect(s.spirituality).toBe(paid.spirituality); s = finish(s, 'residue-trace'); expect(s.progression.mastery[FOCUSED]).toBe(0);
  }, 180_000);

  it('applies guard only to one actual personal impact, with unavoidable original pad wear', () => {
    let s = act(enter(afterResidue(), 'personal-impact', 'ABILITY'), { type: 'WEAR_PAD' }, { type: 'DECLARE_IMPACT' });
    const before = structuredClone(s), cast = expectedCheck(s, 'knowledge'); s = act(s, { type: 'WARM_RADIANCE_GUARD' });
    expect(s.pureWhiteAngel.life.journal.at(-1)!.check).toEqual(cast); expect(s.spirituality).toBe(before.spirituality - 6); expect(s.mind).toBe(before.mind - 2);
    expect(s.health).toBe(before.health); expect(s.pureWhiteAngel.life.pad.durability).toBe(100); expect(attempt(s).guard.effects).toBe(0);
    s = act(s, { type: 'RELEASE_IMPACT' }); expect(s.health).toBe(before.health - (succeeds(cast.tier) ? 0 : 5)); expect(s.pureWhiteAngel.life.pad.durability).toBe(90);
    expect(attempt(s).healthPrevented).toBe(succeeds(cast.tier) ? 5 : 0); expect(s.progression.mastery[GUARD]).toBe(0);
    rejectPureWhiteAngel(s, { type: 'RELEASE_IMPACT' }); rejectPureWhiteAngel(s, { type: 'HANDLE_RESET' });
    s = finish(s, 'personal-impact'); expect(s.progression.mastery[GUARD]).toBe(succeeds(cast.tier) ? 8 : 0);
  }, 180_000);

  it('preserves unguarded real health loss and offers ordinary reset without any ability reward', () => {
    let s = act(enter(afterResidue(), 'personal-impact'), { type: 'WEAR_PAD' }, { type: 'DECLARE_IMPACT' });
    const health = s.health; expect(pureWhiteAngelLifeActions(s).find(a => a.command.type === 'RELEASE_IMPACT')?.cost).toContain('健康−5');
    s = act(s, { type: 'RELEASE_IMPACT' }); expect(s.health).toBe(health - 5); expect(s.pureWhiteAngel.life.pad).toMatchObject({ durability: 90, impacts: 1, resets: 0 });
    const beforeExitHealth = s.health; s = act(s, { type: 'RETRIEVE_PAD' }, { type: 'EXIT_GALLERY' }, { type: 'LEAVE' }); expect(s.health).toBe(beforeExitHealth);
    expect(attempt(s, 'personal-impact').guard.effects).toBe(0);
    const reset = act(enter(afterResidue(), 'personal-impact'), { type: 'WEAR_PAD' }, { type: 'DECLARE_IMPACT' }, { type: 'HANDLE_RESET' });
    expect(reset.pureWhiteAngel.life.pad).toMatchObject({ durability: 90, impacts: 0, resets: 1 }); expect(attempt(reset).healthPrevented).toBe(0);
  }, 180_000);

  it('invalidates third-case guard on real original shutter movement, honors withdrawal and never releases impact', () => {
    let s = act(enter(afterImpact(), 'screened-return', 'ABILITY'), { type: 'WEAR_PAD' }, { type: 'DECLARE_IMPACT' }, { type: 'WARM_RADIANCE_GUARD' });
    const before = structuredClone(s), wasPending = s.pureWhiteAngel.life.pending !== null;
    rejectPureWhiteAngel(s, { type: 'FOCUSED_PURIFICATION' }); rejectPureWhiteAngel(s, { type: 'RELEASE_IMPACT' });
    s = act(s, { type: 'CHANGE_CONDITIONS' }); const receipt = s.pureWhiteAngel.life.journal.at(-1)!;
    expect(receipt.ivanWalkedMetres).toBe(24); expect(receipt.elapsedSeconds).toBe(25);
    expect(s.lightSeeker.life.site.shutter).toMatchObject({ state: 'CLOSED', durability: before.lightSeeker.life.site.shutter.durability - 1, operations: before.lightSeeker.life.site.shutter.operations + 1 });
    expect(s.pureWhiteAngel.life.pending).toBeNull(); expect(attempt(s).guard.state).toBe(wasPending ? 'INVALIDATED' : 'FAILED');
    s = act(s, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' }); rejectPureWhiteAngel(s, { type: 'WARM_RADIANCE_GUARD' }); rejectPureWhiteAngel(s, { type: 'CONSENT', permission: 'OWNER' });
    s = act(s, { type: 'HANDLE_RESET' }); expect(s.health).toBe(before.health); expect(s.pureWhiteAngel.life.sample).toEqual(before.pureWhiteAngel.life.sample);
    expect(s.pureWhiteAngel.life.pad.durability).toBe(before.pureWhiteAngel.life.pad.durability - 10);
    s = finish(s, 'screened-return'); expect(attempt(s, 'screened-return').guard.effects).toBe(0); expect(attempt(s, 'screened-return').impactReleased).toBe(false);
    expect(s.progression.mastery[GUARD]).toBe(0); expect(s.lightSeeker.life.site.shutter.state).toBe('OPEN');
  }, 180_000);

  it('performs real zero-AP abort and uses the shared weekly bill/debt transition exactly once', () => {
    let s = supplies(act(ready(promoted()), { type: 'OBSERVE', caseId: 'residue-trace' })); s = ready(s, { cash: 10, mind: 10, spirituality: 16 });
    while (s.actionsRemaining > 1) s = ordinary(s);
    s = enterObserved(s, 'residue-trace', 'ABILITY'); expect(s.actionsRemaining).toBe(0);
    s = act(s, { type: 'PLACE_SAMPLE' }, { type: 'OBSERVE_SAMPLE' }); const before = structuredClone(s);
    s = act(s, { type: 'ABORT' }); const last = s.pureWhiteAngel.life.journal.at(-1)!;
    expect(last.after.actions).toBe(0); expect(last.playerWalkedMetres).toBe(10); expect(last.ivanWalkedMetres).toBe(13);
    expect(s.pureWhiteAngel.life.sample).toMatchObject({ location: 'PLAYER', residueUnits: 1, contained: true }); expect(hasPureWhiteAngelLifeLock(s)).toBe(false);
    const finance = resolveSliceWeeklyFinance({ ...before, pulse: 'BILL', billAmount: 0 });
    expect(s.cash).toBe(finance.state.cash); expect(s.debts).toEqual(finance.state.debts); expect(s.credit).toBe(finance.state.credit);
    expect(s.week).toBe(before.week + (finance.eventId === null ? 1 : 0)); expect(s.spirituality).toBe(before.spirituality); expect(s.health).toBe(before.health);
    expect(s.pureWhiteAngel.life.cases['residue-trace'].status).toBe('PAUSED');
    rejectPureWhiteAngel(s, { type: 'ABORT' }); expect(s.progression.mastery[FOCUSED]).toBe(0);
  }, 180_000);

  it('rejects forged costs, permissions, replayed checks, source mutations, replenishment and hidden healing', () => {
    const s = act(enter(promoted(), 'residue-trace', 'ABILITY'), { type: 'PLACE_SAMPLE' }, { type: 'OBSERVE_SAMPLE' }, { type: 'FOCUSED_PURIFICATION' });
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.lightSeeker.life.site.operatorEnergy += 2; }, v => { v.lightSeeker.life.site.spiritEnergy--; },
      v => { v.lightSeeker.life.site.lamp.oil--; }, v => { v.lightSeeker.life.site.shutter.operations++; },
      v => { v.lightSeeker.life.site.board.read = false; }, v => { v.lightSeeker.life.journal.pop(); },
      v => { v.pureWhiteAngel.life.sample.residueUnits = 0; }, v => { v.pureWhiteAngel.life.pad.durability = 90; },
      v => { v.pureWhiteAngel.life.journal.at(-1)!.after.spirituality++; }, v => { v.pureWhiteAngel.life.journal.at(-1)!.before.cash++; },
      v => { v.pureWhiteAngel.life.journal.at(-1)!.randomAfter!++; }, v => { v.pureWhiteAngel.life.journal.at(-1)!.revision = v.revision + 1; },
      v => { v.pureWhiteAngel.life.journal.at(-1)!.week = v.week + 1; }, v => { v.pureWhiteAngel.life.journal.at(-1)!.check!.roll = 1 + v.pureWhiteAngel.life.journal.at(-1)!.check!.roll % 100; },
      v => { v.pureWhiteAngel.life.clockSeconds++; }, v => { attempt(v).focused.effects = 1; },
      v => { attempt(v).permission.ability = 'DECLINED'; }, v => { v.pureWhiteAngel.life.ivan.travelMetres++; },
      v => { v.pureWhiteAngel.life.journal.pop(); }, v => { v.health--; },
    ];
    for (const mutate of mutations) { const forged = structuredClone(s); mutate(forged); expect(validatePureWhiteAngelLifeState(forged)).toBe(false); expect(() => assertValidSliceState(forged)).toThrow(); }
    expect(validatePureWhiteAngelActivityCommand({ type: 'BUY_SAMPLE', units: 3 })).toBe(false);
    expect(validatePureWhiteAngelActivityCommand({ type: 'CONSENT', permission: 'OLD_PERMISSION' })).toBe(false);
    expect(validatePureWhiteAngelActivityCommand({ type: 'WARM_RADIANCE_GUARD', target: 'REED' })).toBe(false);
    const p = projectPureWhiteAngelLife(s); expect([p.story, p.source, p.environment, ...p.cases.map(c => c.story)].join(' ')).not.toMatch(/原创G|原著序列依据|虚构残留/); expect(p.site).toEqual(pureWhiteAngelOriginalSnapshot(s)); expect(p.sample.residueUnits).toBe(1);
    expect(p.actions.length).toBeLessThan(12); expect(p.actions.some(a => a.command.type === 'ABORT' && a.enabled && a.cleanup)).toBe(true);
  }, 180_000);
});
