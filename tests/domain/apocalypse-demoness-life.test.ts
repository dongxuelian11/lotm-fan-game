import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import {
  APOCALYPSE_DEMONESS_CASE_IDS, createApocalypseDemonessLifeState, apocalypseDemonessOriginalSnapshot, apocalypseDemonessExpectedOriginals,
  apocalypseDemonessLifeMasteryGains, hasApocalypseDemonessLifeLock, validateApocalypseDemonessActivityCommand, validateApocalypseDemonessLifeState,
  blockApocalypseDemonessLife, apocalypseDemonessLifeActions, projectApocalypseDemonessLife, validApocalypseDemonessOriginals,
  type ApocalypseDemonessActivityCommand, type ApocalypseDemonessCaseId,
} from '../../src/domain/apocalypse-demoness/life.js';
import { ae, ordinary, originalCalamity, originalDemonessRoots, promoted, ready, rejectApocalypseDemoness, rejectIntent, calamityNaturalPath } from './apocalypse-demoness-directed-helper.js';

const CONTAINMENT = 'assassin.s1.pulse-containment', BUFFER = 'assassin.s1.mirror-buffer';
const digest = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');
const succeeds = (v: string | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const attempt = (s: SliceState, id: ApocalypseDemonessCaseId = s.apocalypseDemoness.life.activeCase!) => s.apocalypseDemoness.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, ...commands: ApocalypseDemonessActivityCommand[]): SliceState {
  for (const command of commands) {
    const frozen = digest(originalDemonessRoots(s)), history = digest(s.apocalypseDemoness.sourceHistory), length = s.apocalypseDemoness.life.journal.length;
    s = ae(s, command); expect(s.apocalypseDemoness.life.journal).toHaveLength(length + 1);
    expect(validateApocalypseDemonessLifeState(s), JSON.stringify(command)).toBe(true); assertValidSliceState(s);
    expect(digest(originalDemonessRoots(s))).toBe(frozen); expect(digest(s.apocalypseDemoness.sourceHistory)).toBe(history);
    const source = s.apocalypseDemoness.sourceScene!.originals;
    for (const key of ['mirrorA', 'mirrorB', 'load', 'residue', 'screen', 'plates'] as const) expect(s.apocalypseDemoness.life.site![key]).toEqual(source.site[key]);
    expect(apocalypseDemonessOriginalSnapshot(s).combatPlate).toEqual(source.combatPlate);
  }
  return s;
}
function prepare(s: SliceState, id: ApocalypseDemonessCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', lastAp = false): SliceState {
  s = ready(s, { ap: 2, cash: 300, health: 100, mind: 30, spirituality: 30 });
  const need = id === 'mirror-buffer' ? 13 : 21;
  while (s.apocalypseDemoness.life.site!.playerEnergy < need) s = act(ready(s, { cash: 300 }), { type: 'RECOVER_ENERGY' });
  s = act(s, { type: 'OBSERVE', caseId: id }); s = ready(s, { ap: 1, cash: 300, mind: 30, spirituality: 30 });
  if (lastAp) while (s.actionsRemaining > 1) s = ordinary(s);
  return act(s, { type: 'PREPARE', caseId: id, method });
}
function enter(s: SliceState, id: ApocalypseDemonessCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', lastAp = false): SliceState {
  s = act(prepare(s, id, method, lastAp), { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'OPERATOR' }, { type: 'CONSENT', permission: 'PARTICIPANT' });
  if (method === 'ABILITY') s = act(s, { type: 'CONSENT', permission: 'ABILITY' });
  return act(s, { type: 'APPROACH' });
}
function finish(s: SliceState, id: ApocalypseDemonessCaseId): SliceState {
  if (s.apocalypseDemoness.life.pending) s = act(s, { type: 'STOP_METHOD' });
  if (s.apocalypseDemoness.life.residue?.remaining === 1 && s.apocalypseDemoness.life.residue.location === 'BOX') s = act(s, { type: 'ORDINARY_SEAL' });
  if (attempt(s).plate.status === 'INSTALLED') s = act(s, { type: 'REMOVE_PLATE' });
  s = act(s, { type: 'EXIT_ROOM' }, { type: 'RETURN_PLATE' }, { type: 'LEAVE' });
  return act(ready(s), { type: 'REPORT', caseId: id });
}
const inspect = (s: SliceState) => act(s, { type: 'INSTALL_PLATE' }, { type: 'ORDINARY_INSPECTION' });
let firstCache: SliceState | undefined, secondCache: SliceState | undefined;
const afterFirst = () => structuredClone(firstCache ??= finish(inspect(enter(promoted(), 'pulse-containment')), 'pulse-containment'));
const afterSecond = () => structuredClone(secondCache ??= finish(inspect(enter(afterFirst(), 'mirror-buffer')), 'mirror-buffer'));
function pulseReady(s: SliceState, id: ApocalypseDemonessCaseId = 'pulse-containment', lastAp = false) {
  return act(enter(s, id, 'ABILITY', lastAp), { type: 'BUY_RESIDUE' }, { type: 'RECEIVE_RESIDUE' }, { type: 'INSTALL_PLATE' }, { type: 'START_PULSE' });
}
function loadReady(s: SliceState) {
  return act(enter(s, 'mirror-buffer', 'ABILITY'), { type: 'BUY_LOAD' }, { type: 'RECEIVE_LOAD' }, { type: 'PREPARE_LOAD' }, { type: 'INSTALL_PLATE' });
}
function expected(s: SliceState, type: 'PULSE_CONTAINMENT' | 'MIRROR_BUFFER') {
  const containment = type === 'PULSE_CONTAINMENT', ability = containment ? 'knowledge' : 'will', rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
  const mastery = apocalypseDemonessLifeMasteryGains(s)[containment ? CONTAINMENT : BUFFER];
  return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty: 18,
    modifiers: [{ source: containment ? '脉冲收束掌握' : '镜面缓冲掌握', value: Math.floor(mastery / 10) }], roll: rng.nextInt(1, 100) });
}

describe('Apocalypse Demoness one current original body and finite life cases', () => {
  it('adopts actual currentSite OUTSIDE22/78/407, never the historical ENTRY28/72/217', () => {
    const raw = readObjectEntry<SliceState>(calamityNaturalPath, 'final');
    expect(raw).toMatchObject({ schemaVersion: 174, revision: 586, week: 143, health: 70, random: { seed: 'assassin-natural-v045', cursor: 207 } });
    const old = originalCalamity(); expect(old.schemaVersion).toBe(CURRENT_SCHEMA_VERSION); expect(old.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    const { source: privateSource, ...publicSite } = raw.calamityDemoness.encounter.currentSite!;
    const originalHash = digest(old);
    expect(privateSource).not.toBeNull();
    expect(projectApocalypseDemonessLife(old).site).toEqual(publicSite);
    expect(projectApocalypseDemonessLife(old).site).not.toHaveProperty('source');
    expect(digest(old)).toBe(originalHash);
    expect(projectApocalypseDemonessLife(old).clockSeconds).toBe(407);
    const fresh = createSliceRun('apocalypse-hidden', sliceDefaultCreationSelection, 'apocalypse-hidden');
    expect(fresh.apocalypseDemoness.life).toEqual(createApocalypseDemonessLifeState()); expect(apocalypseDemonessLifeActions(fresh)).toEqual([]); assertValidSliceState(fresh);
    const s = promoted(); expect(s.apocalypseDemoness.life).toMatchObject({ sourceWeek: s.apocalypseDemoness.promotionWeek, clockSeconds: 407, elapsedSeconds: 0, playerLocation: 'OUTSIDE', journal: [] });
    expect(s.apocalypseDemoness.life.site).toEqual(raw.calamityDemoness.encounter.currentSite);
    expect(apocalypseDemonessExpectedOriginals(s)).toEqual(apocalypseDemonessOriginalSnapshot(s));
    expect(s.apocalypseDemoness.life.site).toMatchObject({ playerEnergy: 22, playerTravelMetres: 78, vera: { energy: 92 }, marcus: { energy: 70 }, load: { remainingLoads: 0 }, residue: { status: 'CONSUMED' }, box: { scorched: true, pulses: 1 } });
    expect(s.calamityDemoness.life.site).toMatchObject({ playerLocation: 'ENTRY', playerEnergy: 28, playerTravelMetres: 72, clockSeconds: 217 });
    expect(s.calamityDemoness.encounter.plate?.charges).toBe(3); expect(s.apocalypseDemoness.life.residue).toBeNull(); expect(s.apocalypseDemoness.life.load).toBeNull();
    expect(s.progression.mastery[CONTAINMENT]).toBe(0); expect(s.progression.mastery[BUFFER]).toBe(0); expect(hasApocalypseDemonessLifeLock(s)).toBe(false);
  }, 240_000);

  it('pays outside recovery without restoring adults, old stock, old injuries or current resources', () => {
    const before = ready(promoted(), { ap: 2, cash: 100 }), source = structuredClone(before.apocalypseDemoness.life.site!), s = act(before, { type: 'RECOVER_ENERGY' });
    expect(s.actionsRemaining).toBe(before.actionsRemaining - 1); expect(s.cash).toBe(before.cash - 15); expect(s.week).toBe(before.week);
    expect(s.apocalypseDemoness.life.site!.playerEnergy).toBe(source.playerEnergy + 20); expect(s.apocalypseDemoness.life.site!.clockSeconds).toBe(source.clockSeconds + 60);
    for (const key of ['vera', 'marcus', 'mirrorA', 'mirrorB', 'box', 'load', 'residue', 'plates'] as const) expect(s.apocalypseDemoness.life.site![key]).toEqual(source[key]);
    expect(s.health).toBe(before.health); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind); expect(s.injuries).toEqual(before.injuries);
    rejectApocalypseDemoness(prepare(s, 'pulse-containment'), { type: 'RECOVER_ENERGY' });
  }, 240_000);

  it('completes three honest ordinary cases with finite paid returned plates and no cast mastery', () => {
    let s = finish(inspect(enter(afterSecond(), 'withdrawn-window')), 'withdrawn-window'); s = act(ready(s), { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(APOCALYPSE_DEMONESS_CASE_IDS.every(id => s.apocalypseDemoness.life.cases[id].status === 'RESOLVED')).toBe(true);
    expect(apocalypseDemonessLifeMasteryGains(s)).toEqual({ [CONTAINMENT]: 0, [BUFFER]: 0 });
    const l = s.apocalypseDemoness.life, source = s.apocalypseDemoness.sourceScene!.originals.site, p = l.site!, events = l.journal;
    expect(p.clockSeconds - source.clockSeconds).toBe(events.reduce((n, e) => n + e.elapsedSeconds, 0));
    expect(p.playerTravelMetres - source.playerTravelMetres).toBe(52); expect(p.vera!.travelMetres - source.vera!.travelMetres).toBe(12); expect(p.marcus!.travelMetres - source.marcus!.travelMetres).toBe(12);
    expect(p.playerEnergy).toBe(source.playerEnergy + events.reduce((n, e) => n + e.playerEnergyRecovered - e.playerEnergySpent, 0));
    expect(p.vera!.energy).toBe(source.vera!.energy - 12); expect(p.marcus!.energy).toBe(source.marcus!.energy - 12);
    const plates = APOCALYPSE_DEMONESS_CASE_IDS.map(id => attempt(s, id).plate);
    expect(plates.map(x => x.id)).toEqual(['AD1-PLATE-1', 'AD1-PLATE-2', 'AD1-PLATE-3']);
    expect(plates.every(x => x.paidPennies === 20 && x.status === 'RETURNED' && x.location === 'CUSTODIAN' && x.installedAt !== null && x.removedAt !== null && x.returnedAt !== null)).toBe(true);
    expect(events.flatMap(e => e.moves).every(m => m.mode === 'WALK' && m.originalBody && m.metres === m.seconds)).toBe(true);
    expect(l.residue).toBeNull(); expect(l.load).toBeNull(); expect(hasApocalypseDemonessLifeLock(s)).toBe(false); rejectApocalypseDemoness(s, { type: 'REFLECT' });
  }, 240_000);

  it('requires fresh separate permissions and permits refusal before moving or receiving any source', () => {
    let s = prepare(promoted(), 'pulse-containment', 'ABILITY'); expect(attempt(s).permission).toEqual({ owner: 'UNASKED', operator: 'UNASKED', participant: 'UNASKED', ability: 'UNASKED' });
    rejectApocalypseDemoness(s, { type: 'APPROACH' }); rejectApocalypseDemoness(s, { type: 'PULSE_CONTAINMENT' }); rejectApocalypseDemoness(s, { type: 'INSTALL_PLATE' });
    s = act(s, { type: 'CONSENT', permission: 'OWNER' }, { type: 'DECLINE_CONSENT', permission: 'PARTICIPANT' }); rejectApocalypseDemoness(s, { type: 'CONSENT', permission: 'PARTICIPANT' });
    const p = structuredClone(s.apocalypseDemoness.life.site!); s = act(s, { type: 'EXIT_ROOM' }, { type: 'RETURN_PLATE' }, { type: 'LEAVE' });
    expect(s.apocalypseDemoness.life.site!.playerTravelMetres).toBe(p.playerTravelMetres); expect(s.apocalypseDemoness.life.site!.playerEnergy).toBe(p.playerEnergy);
    expect(s.apocalypseDemoness.life.residue).toBeNull(); s = act(ready(s), { type: 'REPORT', caseId: 'pulse-containment' }); expect(s.progression.mastery[CONTAINMENT]).toBe(0);
  }, 240_000);

  it('purchases and receives one source before one paid check, applying only to the actual pending pulse', () => {
    let s = enter(promoted(), 'pulse-containment', 'ABILITY'); const cash = s.cash;
    rejectApocalypseDemoness(s, { type: 'PULSE_CONTAINMENT' }); rejectApocalypseDemoness(s, { type: 'START_PULSE' });
    s = act(s, { type: 'BUY_RESIDUE' }); expect(s.cash).toBe(cash - 50);
    expect(s.apocalypseDemoness.life.residue).toMatchObject({ id: 'AD1-RESIDUE-1', fictional: true, biological: false, paidPennies: 50, location: 'SUPPLIER', remaining: 1, consumed: 0 });
    rejectApocalypseDemoness(s, { type: 'BUY_RESIDUE' }); rejectApocalypseDemoness(s, { type: 'START_PULSE' });
    s = act(s, { type: 'RECEIVE_RESIDUE' }, { type: 'INSTALL_PLATE' }, { type: 'START_PULSE' }); const before = structuredClone(s), cast = expected(s, 'PULSE_CONTAINMENT');
    s = act(s, { type: 'PULSE_CONTAINMENT' }); expect(s.apocalypseDemoness.life.journal.at(-1)!.check).toEqual(cast);
    expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 2); expect(s.actionsRemaining).toBe(before.actionsRemaining); expect(s.apocalypseDemoness.life.clockSeconds).toBe(before.apocalypseDemoness.life.clockSeconds + 1);
    expect(attempt(s).containment.effects).toBe(0); expect(s.progression.mastery[CONTAINMENT]).toBe(0); rejectApocalypseDemoness(s, { type: 'PULSE_CONTAINMENT' });
    s = act(s, { type: 'APPLY_PULSE' }); expect(s.apocalypseDemoness.life.residue).toMatchObject({ remaining: 0, consumed: 1, pendingAt: null, suppressed: succeeds(cast.tier) ? 1 : 0 });
    expect(attempt(s).plate).toMatchObject({ charges: 0, wear: 5, scorched: true }); expect(attempt(s).containment.effects).toBe(succeeds(cast.tier) ? 1 : 0);
    expect(s.apocalypseDemoness.life.site!.box).toMatchObject({ scorched: true, pulses: 1, pulseSeconds: 10 });
    for (const type of ['APPLY_PULSE', 'START_PULSE', 'BUY_RESIDUE', 'PULSE_CONTAINMENT'] as const) rejectApocalypseDemoness(s, { type });
    s = finish(s, 'pulse-containment'); expect(s.progression.mastery[CONTAINMENT]).toBe(succeeds(cast.tier) ? 8 : 0);
  }, 240_000);

  it('does not turn a successful unopened window into mastery, and ordinary seal remains costly', () => {
    let s = act(pulseReady(promoted()), { type: 'PULSE_CONTAINMENT' }); const paid = { spirituality: s.spirituality, mind: s.mind }, before = structuredClone(s);
    s = act(s, { type: 'STOP_METHOD' }, { type: 'ORDINARY_SEAL' });
    expect(s.apocalypseDemoness.life.residue).toMatchObject({ remaining: 0, consumed: 1, ordinarySealed: true, suppressed: 0 });
    expect(s.apocalypseDemoness.life.clockSeconds).toBe(before.apocalypseDemoness.life.clockSeconds + 5); expect(s.apocalypseDemoness.life.site!.playerEnergy).toBe(before.apocalypseDemoness.life.site!.playerEnergy - 1);
    expect(attempt(s).containment.effects).toBe(0); expect(attempt(s).plate).toMatchObject({ charges: 0, wear: 5, scorched: true });
    expect(s.spirituality).toBe(paid.spirituality); expect(s.mind).toBe(paid.mind); rejectApocalypseDemoness(s, { type: 'ORDINARY_SEAL' });
    s = finish(s, 'pulse-containment'); expect(s.progression.mastery[CONTAINMENT]).toBe(0);
  }, 240_000);

  it('expires or occludes finite windows without refunds, repeated waiting or fabricated effects', () => {
    const start = act(pulseReady(promoted()), { type: 'PULSE_CONTAINMENT' });
    if (start.apocalypseDemoness.life.pending) {
      let timed = act(structuredClone(start), { type: 'WAIT_10' }, { type: 'WAIT_10' }); expect(attempt(timed).containment.state).toBe('EXPIRED');
      rejectApocalypseDemoness(timed, { type: 'WAIT_10' }); timed = act(timed, { type: 'APPLY_PULSE' }); expect(attempt(timed).containment.effects).toBe(0);
      let covered = act(structuredClone(start), { type: 'OCCLUDE_WINDOW' }); expect(covered.apocalypseDemoness.life.pending).toBeNull(); expect(attempt(covered).visibleLine).toBe(false);
      covered = act(covered, { type: 'APPLY_PULSE' }); expect(attempt(covered).containment.effects).toBe(0); expect(covered.spirituality).toBe(start.spirituality); expect(covered.mind).toBe(start.mind);
    } else { expect(attempt(start).containment.state).toBe('FAILED'); rejectApocalypseDemoness(start, { type: 'WAIT_10' }); }
  }, 240_000);

  it('actual movement invalidates a window while reserving a real return to the installed plate', () => {
    let s = act(loadReady(afterFirst()), { type: 'MIRROR_BUFFER' }); const castState = attempt(s).buffer.state, p = structuredClone(s.apocalypseDemoness.life.site!);
    s = act(s, { type: 'WALK', to: 'ENTRY' }); expect(s.apocalypseDemoness.life.pending).toBeNull();
    expect(attempt(s).buffer.state).toBe(castState === 'ACTIVE' ? 'STOPPED' : castState); expect(attempt(s).plate.location).toBe('A');
    expect(s.apocalypseDemoness.life.site!.playerTravelMetres).toBe(p.playerTravelMetres + 4); expect(s.apocalypseDemoness.life.site!.playerEnergy).toBe(p.playerEnergy - 4);
    s = act(s, { type: 'WALK', to: 'A' }, { type: 'APPLY_LOAD' }); expect(attempt(s).buffer.effects).toBe(0); expect(attempt(s).impactDamage).toBe(6);
    s = finish(s, 'mirror-buffer'); expect(attempt(s, 'mirror-buffer').plate.status).toBe('RETURNED');
  }, 240_000);

  it('cannot leave an unconsumed delivered source in the box merely because excess return energy remains', () => {
    let s = act(ready(promoted(), { ap: 2, cash: 300 }), { type: 'RECOVER_ENERGY' });
    s = act(enter(s, 'pulse-containment'), { type: 'BUY_RESIDUE' }, { type: 'RECEIVE_RESIDUE' }, { type: 'INSTALL_PLATE' }, { type: 'ORDINARY_INSPECTION' }, { type: 'REMOVE_PLATE' });
    rejectApocalypseDemoness(s, { type: 'EXIT_ROOM' }); s = act(s, { type: 'ORDINARY_SEAL' });
    expect(s.apocalypseDemoness.life.residue).toMatchObject({ remaining: 1, consumed: 0, location: 'CUSTODIAN', pendingAt: null, ordinarySealed: true });
    s = finish(s, 'pulse-containment'); expect(s.apocalypseDemoness.life.site!.playerLocation).toBe('OUTSIDE');
  }, 240_000);

  it('buys a separate one-impact load and spends new plate charge/wear even on ordinary impact', () => {
    let s = loadReady(afterFirst()); const before = structuredClone(s), cast = expected(s, 'MIRROR_BUFFER');
    expect(s.apocalypseDemoness.life.load).toMatchObject({ id: 'AD1-IMPACT-1', paidPennies: 30, location: 'A', remaining: 1, consumed: 0 });
    rejectApocalypseDemoness(s, { type: 'BUY_LOAD' }); rejectApocalypseDemoness(s, { type: 'RECEIVE_LOAD' }); rejectApocalypseDemoness(s, { type: 'PREPARE_LOAD' });
    s = act(s, { type: 'MIRROR_BUFFER' }); expect(attempt(s).buffer.effects).toBe(0); const health = s.health;
    s = act(s, { type: 'APPLY_LOAD' }); expect(s.health).toBe(health - (succeeds(cast.tier) ? 3 : 6)); expect(s.apocalypseDemoness.life.site!.playerEnergy).toBe(before.apocalypseDemoness.life.site!.playerEnergy - 1);
    expect(s.apocalypseDemoness.life.load).toMatchObject({ remaining: 0, consumed: 1, appliedAt: s.apocalypseDemoness.life.clockSeconds }); expect(attempt(s).plate).toMatchObject({ charges: 0, wear: 5, scorched: false });
    expect(s.apocalypseDemoness.life.site!.load).toEqual(before.apocalypseDemoness.life.site!.load); expect(s.apocalypseDemoness.life.site!.mirrorA).toEqual(before.apocalypseDemoness.life.site!.mirrorA); expect(s.apocalypseDemoness.life.site!.mirrorB).toEqual(before.apocalypseDemoness.life.site!.mirrorB);
    rejectApocalypseDemoness(s, { type: 'APPLY_LOAD' }); s = finish(s, 'mirror-buffer'); expect(s.progression.mastery[BUFFER]).toBe(succeeds(cast.tier) ? 8 : 0);
    let plain = act(loadReady(afterFirst()), { type: 'APPLY_LOAD' }); expect(attempt(plain).impactDamage).toBe(6); expect(attempt(plain).plate.charges).toBe(0); plain = finish(plain, 'mirror-buffer'); expect(plain.progression.mastery[BUFFER]).toBe(0);
  }, 240_000);

  it('keeps unused paid load when consent is withdrawn and never applies damage or gains retroactively', () => {
    let s = act(loadReady(afterFirst()), { type: 'MIRROR_BUFFER' }); const before = structuredClone(s);
    s = act(s, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' }); expect(s.apocalypseDemoness.life.pending).toBeNull(); rejectApocalypseDemoness(s, { type: 'APPLY_LOAD' }); rejectApocalypseDemoness(s, { type: 'CONSENT', permission: 'OWNER' });
    s = act(s, { type: 'ABORT' }); expect(s.apocalypseDemoness.life.load).toEqual(before.apocalypseDemoness.life.load); expect(s.health).toBe(before.health); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind);
    expect(attempt(s, 'mirror-buffer').plate).toMatchObject({ status: 'RETURNED', charges: 1, wear: 0 }); expect(attempt(s, 'mirror-buffer').buffer.effects).toBe(0);
  }, 240_000);

  it('withdraws at zero AP, cleans an actual pending pulse, returns the spent plate and walks before ordinary finance', () => {
    let s = act(pulseReady(afterSecond(), 'withdrawn-window', true), { type: 'PULSE_CONTAINMENT' }); expect(s.actionsRemaining).toBe(0);
    s = act(s, { type: 'WITHDRAW_CONSENT', permission: 'PARTICIPANT' }); expect(s.apocalypseDemoness.life.pending).toBeNull(); expect(s.apocalypseDemoness.life.residue!.pendingAt).not.toBeNull();
    rejectApocalypseDemoness(s, { type: 'PULSE_CONTAINMENT' }); rejectApocalypseDemoness(s, { type: 'APPLY_PULSE' }); rejectApocalypseDemoness(s, { type: 'REMOVE_PLATE' }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const before = structuredClone(s), p = structuredClone(s.apocalypseDemoness.life.site!); s = act(s, { type: 'ABORT' }); const e = s.apocalypseDemoness.life.journal.at(-1)!;
    expect(e.before.actions).toBe(0); expect(e.after.actions).toBe(0); expect(e.elapsedSeconds).toBe(21);
    expect([e.playerWalkedMetres, e.veraWalkedMetres, e.marcusWalkedMetres]).toEqual([10, 2, 2]); expect(s.apocalypseDemoness.life.site!.playerEnergy).toBe(p.playerEnergy - 11);
    expect(s.apocalypseDemoness.life.residue).toMatchObject({ remaining: 0, consumed: 1, pendingAt: null, ordinarySealed: true }); expect(attempt(s, 'withdrawn-window').plate).toMatchObject({ charges: 0, status: 'RETURNED', location: 'CUSTODIAN' });
    expect(attempt(s, 'withdrawn-window').containment.effects).toBe(0); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind);
    const settled = resolveSliceWeeklyFinance({ ...before, pulse: 'BILL' }).state; expect(s.week).toBe(before.week + 1); expect(s.cash).toBe(settled.cash); expect(s.debts).toEqual(settled.debts);
    const bad = structuredClone(s); bad.cash++; expect(validateApocalypseDemonessLifeState(bad)).toBe(false);
  }, 240_000);

  it('recommended flow handles the spent single source without inventing another cast in the withdrawal case', () => {
    let s = promoted();
    for (const id of APOCALYPSE_DEMONESS_CASE_IDS) {
      s = ready(s, { ap: 2, cash: 300, health: 100, mind: 30, spirituality: 30 });
      let safety = 0;
      while (s.apocalypseDemoness.life.cases[id].status !== 'RESOLVED') {
        const view = projectApocalypseDemonessLife(s), choices = view.actions.filter(x => x.preferredAction && x.enabled);
        expect(choices, `${id}:${JSON.stringify(view.currentAttempt)}`).toHaveLength(1);
        const command = choices[0]!.command;
        if (command.type === 'REPORT') s = ready(s);
        s = act(s, command); if (++safety > 60) throw new Error('Finite preferred case did not close.');
      }
    }
    const last = attempt(s, 'withdrawn-window'); expect(last.containment.attempts).toBe(0); expect(last.buffer.attempts).toBe(0); expect(last.ordinarySealed).toBe(true); expect(last.permission.participant).toBe('WITHDRAWN');
    expect(s.apocalypseDemoness.life.residue).toMatchObject({ remaining: 0, consumed: 1 }); expect(last.plate).toMatchObject({ status: 'RETURNED', charges: 1 });
  }, 240_000);

  it('rejects altered source, current body, paid stock, deterministic checks, consent, costs and timestamps', () => {
    const s = act(loadReady(afterFirst()), { type: 'MIRROR_BUFFER' });
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.apocalypseDemoness.life.site!.playerEnergy++; }, v => { v.apocalypseDemoness.life.site!.vera!.energy++; }, v => { v.apocalypseDemoness.life.site!.load.remainingLoads = 1; },
      v => { v.apocalypseDemoness.life.site!.playerLocation = 'OUTSIDE'; }, v => { v.apocalypseDemoness.life.site!.clockSeconds--; }, v => { v.apocalypseDemoness.life.site!.plates[2]!.charges = 0; },
      v => { v.apocalypseDemoness.life.site!.box.scorched = false; }, v => { v.apocalypseDemoness.life.site!.residue!.status = 'CONTAINED'; }, v => { v.apocalypseDemoness.life.site!.mirrorA!.intact = false; },
      v => { v.calamityDemoness.encounter.currentSite!.playerEnergy++; }, v => { v.calamityDemoness.life.site.playerLocation = 'OUTSIDE'; }, v => { v.calamityDemoness.encounter.plate!.charges--; },
      v => { v.apocalypseDemoness.sourceHistory!.calamityDemoness.encounter.enemyHealth--; }, v => { v.apocalypseDemoness.sourceScene!.originals.site.playerEnergy++; },
      v => { v.apocalypseDemoness.life.journal.at(-1)!.before.cash++; }, v => { v.apocalypseDemoness.life.journal.at(-1)!.after.spirituality++; }, v => { v.apocalypseDemoness.life.journal.at(-1)!.randomAfter!++; },
      v => { v.apocalypseDemoness.life.journal.at(-1)!.finance.weeklyBudget++; }, v => { v.apocalypseDemoness.life.journal.at(-1)!.source!.permissionVersion++; }, v => { v.apocalypseDemoness.life.journal.pop(); },
      v => { attempt(v).permission.owner = 'WITHDRAWN'; }, v => { attempt(v).plate.paidPennies = 0 as 20; }, v => { attempt(v).plate.installedAt = null; }, v => { attempt(v).buffer.effects = 1; },
      v => { v.apocalypseDemoness.life.load!.paidPennies = 0 as 30; }, v => { v.apocalypseDemoness.life.load!.arrivedAt = null; }, v => { v.apocalypseDemoness.life.load!.remaining = 0; }, v => { v.cash++; },
      v => { const e = v.apocalypseDemoness.life.journal.at(-1)!; e.check = { ...e.check!, roll: e.check!.roll % 100 + 1 }; },
    ];
    for (const mutate of mutations) { const bad = structuredClone(s); mutate(bad); expect(validateApocalypseDemonessLifeState(bad), mutate.toString()).toBe(false); }
    expect(validApocalypseDemonessOriginals(apocalypseDemonessOriginalSnapshot(s))).toBe(true); expect(blockApocalypseDemonessLife(s, { type: 'MIRROR_BUFFER' })).not.toBeNull();
  }, 240_000);

  it('keeps exact command shapes and exposes simple actionable zero-AP ordinary cleanup', () => {
    for (const c of [{ type: 'PULSE_CONTAINMENT', target: 'CITY' }, { type: 'CONSENT', permission: 'OLD_PERMISSION' }, { type: 'PREPARE', caseId: 'mirror-buffer', method: 'FREE' },
      { type: 'RECOVER_ENERGY', free: true }, { type: 'REFILL_OLD_LOAD' }, { type: 'RESTORE_OLD_RESIDUE' }, { type: 'WAIT_10', gainActions: 1 }, { type: 'WALK', to: 'YARD' }]) expect(validateApocalypseDemonessActivityCommand(c)).toBe(false);
    const s = enter(promoted(), 'pulse-containment', 'ABILITY'), view = projectApocalypseDemonessLife(s);
    expect(view.actions.length).toBeLessThan(12); expect(view.actions.filter(x => x.preferredAction)).toHaveLength(1); expect(view.actions.some(x => x.command.type === 'ABORT' && x.enabled && x.cleanup && x.cost.startsWith('0行动'))).toBe(true);
    expect(view.site).toMatchObject({ playerLocation: 'BOX', playerEnergy: 12, vera: { location: 'ENTRY' }, marcus: { location: 'ENTRY' } }); expect(view.pendingRemainingSeconds).toBe(0);
  }, 240_000);
});
