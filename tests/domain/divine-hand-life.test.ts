import { describe, expect, it } from 'vitest';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import {
  DIVINE_HAND_CASE_IDS, createDivineHandLifeState, initializeDivineHandLifeState, divineHandOriginalSnapshot, divineHandExpectedOriginals,
  divineHandLifeMasteryGains, hasDivineHandLifeLock, validateDivineHandActivityCommand, validateDivineHandLifeState, blockDivineHandLife,
  divineHandLifeActions, projectDivineHandLife, type DivineHandActivityCommand, type DivineHandCaseId,
} from '../../src/domain/divine-hand/life.js';
import { ae, ordinary, originalGlory, promoted, ready, rejectDivineHand, rejectIntent, gloryNaturalPath } from './divine-hand-directed-helper.js';

// These are directed unit executions of the exact raw173/158 source, whose
// first70 commands remain explicitly directed. No seed/cursor/source rewrite.
const BEAM = 'warrior.s1.beam-stabilize', ARMOR = 'warrior.s1.armor-convergence';
const succeeds = (v: string | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const attempt = (s: SliceState, id: DivineHandCaseId = s.divineHand.life.activeCase!) => s.divineHand.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, ...commands: DivineHandActivityCommand[]): SliceState {
  for (const command of commands) {
    const before = structuredClone(s); s = ae(s, command);
    expect(s.divineHand.life.journal.length).toBe(before.divineHand.life.journal.length + 1);
    expect(validateDivineHandLifeState(s), JSON.stringify(command)).toBe(true); assertValidSliceState(s);
    expect(s.divineHand.sourceHistory).toEqual(before.divineHand.sourceHistory);
    expect(s.glory.life.cases).toEqual(before.glory.life.cases); expect(s.glory.life.journal).toEqual(before.glory.life.journal);
    expect(s.glory.encounter).toEqual(before.glory.encounter); expect(s.silverKnight).toEqual(before.silverKnight);
    for (const key of ['armorSource', 'plates', 'load', 'bridge', 'temper', 'guard'] as const) expect(s.glory.life.site[key]).toEqual(before.glory.life.site[key]);
    expect(s.glory.life.site.armorWorn).toBe(before.glory.life.site.armorWorn);
  }
  return s;
}
function prepare(s: SliceState, caseId: DivineHandCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', lastAp = false): SliceState {
  s = ready(s, { cash: 200, health: 100, mind: 30, spirituality: 30 });
  if (s.glory.life.site.playerEnergy < 9) s = act(s, { type: 'RECOVER_ENERGY' });
  s = act(s, { type: 'OBSERVE', caseId }); s = ready(s, { ap: 1, cash: 200, mind: 30, spirituality: 30 });
  if (lastAp) while (s.actionsRemaining > 1) s = ordinary(s);
  return act(s, { type: 'PREPARE', caseId, method });
}
function enter(s: SliceState, id: DivineHandCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', lastAp = false): SliceState {
  s = act(prepare(s, id, method, lastAp), { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'OPERATOR' }, { type: 'CONSENT', permission: 'PARTICIPANT' });
  if (method === 'ABILITY') s = act(s, { type: 'CONSENT', permission: 'ABILITY' });
  return act(s, { type: 'APPROACH' });
}
function finish(s: SliceState, id: DivineHandCaseId): SliceState {
  if (s.divineHand.life.pending || attempt(s).contact) s = act(s, { type: 'STOP_METHOD' });
  if (s.glory.life.site.pads.worn) s = act(s, { type: 'REMOVE_PAD' });
  s = act(s, { type: 'EXIT_ROOM' }, { type: 'LEAVE' }); return act(ready(s), { type: 'REPORT', caseId: id });
}
let firstCache: SliceState | undefined, secondCache: SliceState | undefined;
const afterFirst = () => structuredClone(firstCache ??= finish(act(enter(promoted(), 'beam-support'), { type: 'ORDINARY_INSPECTION' }), 'beam-support'));
const afterSecond = () => structuredClone(secondCache ??= finish(act(enter(afterFirst(), 'armor-window'), { type: 'ORDINARY_INSPECTION' }), 'armor-window'));
function expected(s: SliceState, command: 'BEAM_STABILIZE' | 'ARMOR_CONVERGENCE' | 'MANUAL_INSPECTION') {
  const ability = command === 'ARMOR_CONVERGENCE' ? 'will' : 'knowledge', rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
  const power = command !== 'MANUAL_INSPECTION', mastery = divineHandLifeMasteryGains(s)[command === 'ARMOR_CONVERGENCE' ? ARMOR : BEAM];
  const helped = command === 'MANUAL_INSPECTION' && s.divineHand.life.pending?.kind === 'BEAM' && projectDivineHandLife(s).pendingUsable;
  return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty: power ? 18 : 16,
    modifiers: power ? [{ source: command === 'BEAM_STABILIZE' ? '接触稳持掌握' : '护甲合势掌握', value: Math.floor(mastery / 10) }]
      : helped ? [{ source: '本人接触原梁进行这一次手动检查', value: 8 }] : [], roll: rng.nextInt(1, 100) });
}

describe('Divine Hand same original repair-room life', () => {
  it('reads the actual raw173 source and keeps armor60, people35/80/82 and exhausted old load', () => {
    const raw = readObjectEntry<SliceState>(gloryNaturalPath, 'final');
    expect(raw).toMatchObject({ schemaVersion: 173, revision: 600, health: 90, random: { seed: 'warrior-natural-v042', cursor: 475 } });
    expect(originalGlory().glory.life.site).toEqual(raw.glory.life.site);
    const fresh = createSliceRun('divine-hand-hidden', sliceDefaultCreationSelection, 'divine-hand-hidden');
    expect(fresh.divineHand.life).toEqual(createDivineHandLifeState()); expect(divineHandLifeActions(fresh)).toEqual([]); assertValidSliceState(fresh);
    const s = promoted(); expect(s.divineHand.life).toMatchObject({ sourceWeek: s.divineHand.promotionWeek, clockSeconds: 293, elapsedSeconds: 0, playerLocation: 'OUTSIDE', journal: [] });
    expect(divineHandOriginalSnapshot(s)).toEqual({ site: raw.glory.life.site }); expect(divineHandExpectedOriginals(s)).toEqual(divineHandOriginalSnapshot(s));
    expect(s.glory.life.site).toMatchObject({ playerEnergy: 35, celia: { energy: 80 }, evan: { energy: 82 }, armor: { integrity: 60 }, pads: { remaining: 1, consumed: 1, location: 'BENCH' }, load: { remainingLoads: 0, appliedLoads: 1 } });
    expect(s.silverKnight.life.armor.integrity).toBe(65); expect(s.progression.mastery[BEAM]).toBe(0); expect(s.progression.mastery[ARMOR]).toBe(0);
    expect(hasDivineHandLifeLock(s)).toBe(false); expect(validateDivineHandLifeState(s)).toBe(true);
  }, 120_000);

  it('initializes structurally legal actual closed-scene totals rather than stamping the capture numbers', () => {
    const s = promoted(); s.divineHand.life = createDivineHandLifeState();
    const p = structuredClone(s.glory.life.site); p.clockSeconds += 7; p.playerEnergy = 20; p.playerTravelMetres += 4; p.armor!.integrity = 57;
    s.glory.life.site = p; s.divineHand.sourceScene!.originals = { site: structuredClone(p) };
    initializeDivineHandLifeState(s); expect(divineHandOriginalSnapshot(s)).toEqual({ site: p }); expect(s.divineHand.life.clockSeconds).toBe(p.clockSeconds); expect(s.divineHand.life.journal).toEqual([]);
  }, 120_000);

  it('pays real outside recovery without restoring armor, adults or consumables', () => {
    const before = ready(promoted(), { ap: 2, cash: 100 }), site = structuredClone(before.glory.life.site), s = act(before, { type: 'RECOVER_ENERGY' });
    expect(s.actionsRemaining).toBe(before.actionsRemaining - 1); expect(s.cash).toBe(before.cash - 15); expect(s.week).toBe(before.week);
    expect(s.glory.life.site.playerEnergy).toBe(site.playerEnergy + 20); expect(s.glory.life.site.clockSeconds).toBe(site.clockSeconds + 60);
    for (const key of ['celia', 'evan', 'armor', 'load', 'pads', 'plates'] as const) expect(s.glory.life.site[key]).toEqual(site[key]);
    expect(s.health).toBe(before.health); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind);
    rejectDivineHand(prepare(s, 'beam-support'), { type: 'RECOVER_ENERGY' });
  }, 120_000);

  it('finishes three ordinary cases without spending old stock, crossing a bridge or awarding cast mastery', () => {
    let s = finish(act(enter(afterSecond(), 'withdrawn-support'), { type: 'ORDINARY_INSPECTION' }), 'withdrawn-support'); s = act(ready(s), { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(DIVINE_HAND_CASE_IDS.every(id => s.divineHand.life.cases[id].status === 'RESOLVED')).toBe(true);
    expect(divineHandLifeMasteryGains(s)).toEqual({ [BEAM]: 0, [ARMOR]: 0 });
    const source = s.divineHand.sourceScene!.originals.site, site = s.glory.life.site, events = s.divineHand.life.journal;
    expect(site.clockSeconds - source.clockSeconds).toBe(events.reduce((n, e) => n + e.elapsedSeconds, 0));
    expect(site.playerTravelMetres - source.playerTravelMetres).toBe(24); expect(site.celia.travelMetres - source.celia.travelMetres).toBe(24); expect(site.evan.travelMetres - source.evan.travelMetres).toBe(24);
    expect(site.playerEnergy).toBe(source.playerEnergy + events.reduce((n, e) => n + e.playerEnergyRecovered - e.playerEnergySpent, 0));
    expect(site.celia.energy).toBe(source.celia.energy - 24); expect(site.evan.energy).toBe(source.evan.energy - 24);
    for (const key of ['armor', 'pads', 'plates', 'load', 'bridge'] as const) expect(site[key]).toEqual(source[key]);
    expect(events.flatMap(e => e.moves).every(m => m.mode === 'WALK' && m.originalBody && m.metres === m.seconds)).toBe(true);
    expect(hasDivineHandLifeLock(s)).toBe(false); rejectDivineHand(s, { type: 'REFLECT' });
  }, 120_000);

  it('requires fresh separate adult permission and allows a refusal before moving or retrieving old resources', () => {
    let s = prepare(promoted(), 'beam-support', 'ABILITY'); expect(attempt(s).permission).toEqual({ owner: 'UNASKED', operator: 'UNASKED', participant: 'UNASKED', ability: 'UNASKED' });
    rejectDivineHand(s, { type: 'APPROACH' }); rejectDivineHand(s, { type: 'BEAM_STABILIZE' }); rejectDivineHand(s, { type: 'WEAR_PAD' });
    s = act(s, { type: 'CONSENT', permission: 'OWNER' }, { type: 'DECLINE_CONSENT', permission: 'PARTICIPANT' }); rejectDivineHand(s, { type: 'CONSENT', permission: 'PARTICIPANT' });
    const before = structuredClone(s.glory.life.site); s = act(s, { type: 'EXIT_ROOM' }, { type: 'LEAVE' });
    expect(s.glory.life.site.playerTravelMetres).toBe(before.playerTravelMetres); expect(s.glory.life.site.playerEnergy).toBe(before.playerEnergy);
    s = act(ready(s), { type: 'REPORT', caseId: 'beam-support' }); expect(s.progression.mastery[BEAM]).toBe(0);
  }, 120_000);

  it('charges a single actual beam attempt and consumes the finite benefit only on a real manual inspection', () => {
    let s = enter(promoted(), 'beam-support', 'ABILITY'); rejectDivineHand(s, { type: 'BEAM_STABILIZE' });
    s = act(s, { type: 'CONTACT_BEAM' }); const before = structuredClone(s), cast = expected(s, 'BEAM_STABILIZE'); s = act(s, { type: 'BEAM_STABILIZE' });
    expect(s.divineHand.life.journal.at(-1)!.check).toEqual(cast); expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 2);
    expect(s.actionsRemaining).toBe(before.actionsRemaining); expect(s.divineHand.life.clockSeconds).toBe(before.divineHand.life.clockSeconds + 1);
    expect(attempt(s).beam.effects).toBe(0); expect(s.progression.mastery[BEAM]).toBe(0); rejectDivineHand(s, { type: 'BEAM_STABILIZE' });
    if (succeeds(cast.tier)) expect(s.divineHand.life.pending).toMatchObject({ kind: 'BEAM', expiresAt: s.divineHand.life.clockSeconds + 20 });
    else expect(s.divineHand.life.pending).toBeNull();
    const inspection = expected(s, 'MANUAL_INSPECTION'); s = act(s, { type: 'MANUAL_INSPECTION' });
    expect(s.divineHand.life.journal.at(-1)!.check).toEqual(inspection); expect(attempt(s).inspectionBonus).toBe(succeeds(cast.tier) ? 8 : 0);
    expect(attempt(s).beam.effects).toBe(succeeds(cast.tier) ? 1 : 0); expect(s.divineHand.life.pending).toBeNull();
    rejectDivineHand(s, { type: 'MANUAL_INSPECTION' }); s = finish(s, 'beam-support'); expect(s.progression.mastery[BEAM]).toBe(succeeds(cast.tier) ? 8 : 0);
  }, 120_000);

  it('expires finite contact without refunding paid costs or granting later ordinary checks a bonus', () => {
    let s = act(enter(promoted(), 'beam-support', 'ABILITY'), { type: 'CONTACT_BEAM' }, { type: 'BEAM_STABILIZE' });
    const paid = { spirituality: s.spirituality, mind: s.mind };
    if (s.divineHand.life.pending) { s = act(s, { type: 'WAIT_10' }, { type: 'WAIT_10' }); expect(attempt(s).beam.state).toBe('EXPIRED'); }
    s = act(s, { type: 'MANUAL_INSPECTION' }); expect(attempt(s).inspectionBonus).toBe(0); expect(attempt(s).beam.effects).toBe(0);
    expect(s.spirituality).toBe(paid.spirituality); expect(s.mind).toBe(paid.mind); expect(s.divineHand.life.pending).toBeNull();
  }, 120_000);

  it('buys, receives and prepares a distinct finite load before actually consuming the remaining original pad', () => {
    let s = enter(afterFirst(), 'armor-window', 'ABILITY'); const source = structuredClone(s.glory.life.site);
    rejectDivineHand(s, { type: 'APPLY_LOAD' }); rejectDivineHand(s, { type: 'ARMOR_CONVERGENCE' });
    const cash = s.cash; s = act(s, { type: 'BUY_LOAD' }); expect(s.cash).toBe(cash - 30);
    expect(attempt(s).load).toMatchObject({ id: 'DH1-LOAD:armor-window:1', location: 'SUPPLIER', remaining: 1, consumed: 0, arrivedAt: null, preparedAt: null });
    rejectDivineHand(s, { type: 'BUY_LOAD' }); rejectDivineHand(s, { type: 'PREPARE_LOAD' }); rejectDivineHand(s, { type: 'APPLY_LOAD' });
    s = act(s, { type: 'RECEIVE_LOAD' }); expect(attempt(s).load!.arrivedAt).toBe(s.glory.life.site.clockSeconds); rejectDivineHand(s, { type: 'RECEIVE_LOAD' });
    s = act(s, { type: 'PREPARE_LOAD' }, { type: 'WEAR_PAD' }); expect(s.glory.life.site.pads).toMatchObject({ location: 'PLAYER', worn: true, remaining: 1, consumed: 1 });
    const cast = expected(s, 'ARMOR_CONVERGENCE'); s = act(s, { type: 'ARMOR_CONVERGENCE' }); expect(attempt(s).armor.effects).toBe(0);
    const health = s.health, energy = s.glory.life.site.playerEnergy; s = act(s, { type: 'APPLY_LOAD' });
    expect(s.health).toBe(health - (succeeds(cast.tier) ? 3 : 6)); expect(s.glory.life.site.playerEnergy).toBe(energy - 1);
    expect(s.glory.life.site.armor!.integrity).toBe(source.armor!.integrity - 5); expect(s.glory.life.site.pads).toMatchObject({ remaining: 0, consumed: 2 });
    expect(attempt(s).load).toMatchObject({ remaining: 0, consumed: 1, appliedAt: s.glory.life.site.clockSeconds });
    expect(s.glory.life.site.load).toEqual(source.load); expect(s.glory.life.site.plates).toEqual(source.plates); expect(s.silverKnight.life.armor.integrity).toBe(65);
    rejectDivineHand(s, { type: 'APPLY_LOAD' }); rejectDivineHand(s, { type: 'ARMOR_CONVERGENCE' });
    s = finish(s, 'armor-window'); expect(s.progression.mastery[ARMOR]).toBe(succeeds(cast.tier) ? 8 : 0);
    expect(s.glory.life.site.pads).toMatchObject({ location: 'BENCH', worn: false, remaining: 0, consumed: 2 }); expect(s.glory.life.site.armorWorn).toBe(true);
  }, 120_000);

  it('keeps a paid unused new load and original pad when consent is withdrawn, with no automatic refund', () => {
    let s = act(enter(afterFirst(), 'armor-window', 'ABILITY'), { type: 'BUY_LOAD' }, { type: 'RECEIVE_LOAD' }, { type: 'PREPARE_LOAD' }, { type: 'WEAR_PAD' }, { type: 'ARMOR_CONVERGENCE' });
    const before = structuredClone(s); s = act(s, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' });
    expect(s.divineHand.life.pending).toBeNull(); rejectDivineHand(s, { type: 'APPLY_LOAD' }); rejectDivineHand(s, { type: 'CONSENT', permission: 'OWNER' });
    s = act(s, { type: 'ABORT' }); expect(s.cash).toBeLessThanOrEqual(before.cash); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind);
    expect(attempt(s, 'armor-window').load).toEqual(attempt(before).load); expect(attempt(s, 'armor-window').armor.effects).toBe(0);
    expect(s.glory.life.site.pads).toMatchObject({ remaining: 1, consumed: 1, location: 'BENCH', worn: false }); expect(s.glory.life.site.armor!.integrity).toBe(before.glory.life.site.armor!.integrity);
  }, 120_000);

  it('withdraws and physically exits at zeroAP, then settles the ordinary weekly bill without erasing costs', () => {
    let s = act(enter(afterSecond(), 'withdrawn-support', 'ABILITY', true), { type: 'CONTACT_BEAM' }, { type: 'BEAM_STABILIZE' });
    expect(s.actionsRemaining).toBe(0); const paid = structuredClone(s); s = act(s, { type: 'WITHDRAW_CONSENT', permission: 'PARTICIPANT' });
    expect(s.divineHand.life.pending).toBeNull(); expect(attempt(s).contact).toBe(false); rejectDivineHand(s, { type: 'BEAM_STABILIZE' }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const before = structuredClone(s), site = structuredClone(s.glory.life.site); s = act(s, { type: 'ABORT' }); const e = s.divineHand.life.journal.at(-1)!;
    expect(e.before.actions).toBe(0); expect(e.after.actions).toBe(0); expect(e.elapsedSeconds).toBe(12);
    expect([e.playerWalkedMetres, e.celiaWalkedMetres, e.evanWalkedMetres]).toEqual([4, 4, 4]); expect(s.glory.life.site.playerEnergy).toBe(site.playerEnergy - 4);
    expect(s.spirituality).toBe(paid.spirituality); expect(s.mind).toBe(paid.mind);
    const finance = resolveSliceWeeklyFinance({ ...before, pulse: 'BILL' }).state;
    expect(s.week).toBe(before.week + 1); expect(s.actionsRemaining).toBe(before.weeklyBudget); expect(s.cash).toBe(finance.cash); expect(s.debts).toEqual(finance.debts);
    const bad = structuredClone(s); bad.cash++; expect(validateDivineHandLifeState(bad)).toBe(false);
    s = act(ready(s), { type: 'REPORT', caseId: 'withdrawn-support' }); expect(s.progression.mastery[BEAM]).toBe(0);
  }, 120_000);

  it('rejects forged originals, consent, check results, resource provenance, clocks, journal costs and current budgets', () => {
    const s = act(enter(afterFirst(), 'armor-window', 'ABILITY'), { type: 'BUY_LOAD' }, { type: 'RECEIVE_LOAD' }, { type: 'PREPARE_LOAD' }, { type: 'WEAR_PAD' }, { type: 'ARMOR_CONVERGENCE' });
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.glory.life.site.playerEnergy++; }, v => { v.glory.life.site.celia.energy++; }, v => { v.glory.life.site.load.remainingLoads = 1; },
      v => { v.glory.life.site.armor!.integrity++; }, v => { v.glory.life.site.pads.remaining++; }, v => { v.glory.life.site.plates[2]!.charges = 0; },
      v => { v.glory.life.site.clockSeconds--; }, v => { v.glory.life.site.playerTravelMetres++; }, v => { v.glory.life.journal.pop(); },
      v => { v.divineHand.sourceHistory!.glory.life.site.playerEnergy++; }, v => { v.divineHand.life.journal.at(-1)!.before.cash++; },
      v => { v.divineHand.life.journal.at(-1)!.after.spirituality++; }, v => { v.divineHand.life.journal.at(-1)!.randomAfter!++; },
      v => { v.divineHand.life.journal.at(-1)!.finance.weeklyBudget++; }, v => { v.divineHand.life.journal.at(-1)!.source!.contact = true; },
      v => { v.divineHand.life.journal.at(-1)!.revision = v.revision + 1; }, v => { v.divineHand.life.journal.pop(); },
      v => { attempt(v).permission.owner = 'WITHDRAWN'; }, v => { attempt(v).load!.paidPennies = 0 as 30; }, v => { attempt(v).load!.id = 'GL2-LOAD'; },
      v => { attempt(v).load!.arrivedAt = null; }, v => { attempt(v).armor.effects = 1; }, v => { v.cash++; },
      v => { const e = v.divineHand.life.journal.at(-1)!; e.check = { ...e.check!, roll: e.check!.roll % 100 + 1 }; },
    ];
    for (const mutate of mutations) { const bad = structuredClone(s); mutate(bad); expect(validateDivineHandLifeState(bad)).toBe(false); expect(() => assertValidSliceState(bad)).toThrow(); }
    expect(blockDivineHandLife(s, { type: 'ARMOR_CONVERGENCE' })).not.toBeNull();
  }, 120_000);

  it('keeps command shapes exact and exposes a small useful navigation set with free ordinary cleanup', () => {
    for (const c of [{ type: 'BEAM_STABILIZE', target: 'CITY' }, { type: 'CONSENT', permission: 'OLD_PERMISSION' }, { type: 'PREPARE', caseId: 'armor-window', method: 'FREE' },
      { type: 'RECOVER_ENERGY', free: true }, { type: 'REFILL_OLD_LOAD' }, { type: 'REPAIR_ARMOR' }, { type: 'WAIT_10', gainActions: 1 }]) expect(validateDivineHandActivityCommand(c)).toBe(false);
    const s = enter(promoted(), 'beam-support', 'ABILITY'), view = projectDivineHandLife(s);
    expect(view.actions.length).toBeLessThan(12); expect(view.preferredActionId).not.toBeNull(); expect(view.actions.some(a => a.command.type === 'ABORT' && a.enabled && a.cleanup && a.cost.startsWith('0行动'))).toBe(true);
    expect(view.site.playerLocation).toBe('BENCH'); expect(view.site.celia.location).toBe('BENCH'); expect(view.site.evan.location).toBe('BENCH');
    expect(view.site.playerEnergy).toBe(31); expect(view.site.load.remainingLoads).toBe(0); expect(view.site.pads.location).toBe('BENCH'); expect(view.pendingRemainingSeconds).toBe(0);
  }, 120_000);
});
