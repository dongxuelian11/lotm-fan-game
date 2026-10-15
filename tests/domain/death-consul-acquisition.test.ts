import { createPlaneswalkerState } from '../../src/domain/planeswalker/index.js';
import { createFateTrojanState } from '../../src/domain/fate-trojan/index.js';
import { createGloryState } from '../../src/domain/glory/index.js';
import { createCalamityDemonessState } from '../../src/domain/calamity-demoness/index.js';
import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { activeFerrymanChannel } from '../../src/domain/ferryman/index.js';
import { FERRYMAN_PROVIDERS } from '../../src/domain/ferryman/content.js';
import { applyDeathConsulAcquisition, createDeathConsulState, currentDeathConsulSourceEra,
  deathConsulAcquisitionBlock, DEATH_CONSUL_INHERITED_ABILITY_IDS, hasDeathConsulHistory,
  hasDeathConsulLock, isDeathConsul, isDeathConsulAcquisitionCommand, isDeathConsulAcquisitionStage,
  projectDeathConsul, validateDeathConsulCommand, validateDeathConsulState } from '../../src/domain/death-consul/index.js';
import { DEATH_CONSUL_FORMULA_STATUS, DEATH_CONSUL_PRICES, DEATH_CONSUL_POST_CYCLE_PRICES,
  deathConsulConsumptionRisk, deathConsulPotionSource, deathConsulPrices } from '../../src/domain/death-consul/content.js';
import { DEATH_CONSUL_ABILITY_IDS, DEATH_CONSUL_PREPARATION_IDS,
  type DeathConsulAcquisitionCommand, type DeathConsulSourceEra } from '../../src/domain/death-consul/types.js';

const paths = { POST_CYCLE: 'tests/fixtures/ferryman-v01490/natural.json', ORIGINAL: 'tests/fixtures/ferryman-v01490/original.json' } as const;
const cache = new Map<DeathConsulSourceEra, SliceState>();
/** Read only the final entry once per era. Never allocate the large capture beside its many snapshots. */
function fixture(era: DeathConsulSourceEra = 'POST_CYCLE'): SliceState {
  if (!cache.has(era)) cache.set(era, migrateSliceState(readObjectEntry<unknown>(paths[era], 'final')));
  return structuredClone(cache.get(era)!);
}
const legacyKeys = ['corpsecollector', 'gravedigger', 'spiritmedium', 'spiritGuide', 'gatekeeper', 'undying', 'ferryman', 'longChapter'] as const;
const oldRoots = (s: SliceState) => legacyKeys.map(key => s[key]);
/** Directed acquisition-only setup, not a natural run, actual care, or earned original-era acting evidence. */
function unit(era: DeathConsulSourceEra = 'POST_CYCLE'): SliceState {
  const s = fixture(era), weeks = Math.max(0, s.ferryman.promotionWeek! + 12 - s.week);
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7);
  s.deathConsul = createDeathConsulState(); s.progression.acting = 100;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, c: DeathConsulAcquisitionCommand, roll = 1) {
  const ctx = context(s, roll); applyDeathConsulAcquisition(s, c, ctx); return ctx;
}
function reject(s: SliceState, c: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyDeathConsulAcquisition(s, c as DeathConsulAcquisitionCommand, ctx)).toThrow();
  expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); expect(ctx.note).not.toHaveBeenCalled();
}
function taught(era: DeathConsulSourceEra = 'POST_CYCLE') { const s = unit(era); apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of DEATH_CONSUL_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.deathConsul.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.deathConsul.bottles[index]!.id, confirmed: true }) as const;
function prepared(era: DeathConsulSourceEra = 'POST_CYCLE') { const s = qualify(taught(era)); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }

describe('DeathConsul S2 frozen-era acquisition and seven-stage inheritance', () => {
  it('starts from the unchanged611-command living post-cycle branch with two untreated heavy wounds', () => {
    const old = readObjectEntry<SliceState>(paths.POST_CYCLE, 'final'), s = fixture();
    expect(readObjectEntry<unknown[]>(paths.POST_CYCLE, 'commands')).toHaveLength(611);
    expect(s).toMatchObject({ revision: 612, week: 3260, status: 'ACTIVE', health: 40, mind: 100, spirituality: 108,
      cash: 110, actionsRemaining: 4, injuryRisk: 1, random: { seed: 'corpsecollector-natural-v032', cursor: 192 },
      progression: { pathwayId: 'death', sequence: 3, acting: 100 }, ferryman: { promotionWeek: 3253 } });
    expect(s.injuries).toHaveLength(2); expect(s.injuries.every(i => i.severity === 'HEAVY' && i.treatedRevision === null)).toBe(true);
    expect(s.ferryman.life.reed).toMatchObject({ id: 'FR3-REED', energy: 91, travelMetres: 22 });
    expect(s.undying.encounter).toMatchObject({ status: 'AVAILABLE', enemy: { health: 100, weaponLocation: 'HAND' } });
    expect(oldRoots(s)).toEqual(oldRoots(old)); expect(s.progression).toEqual(old.progression);
    expect(Object.keys(s.progression.mastery)).toHaveLength(15); expect(DEATH_CONSUL_INHERITED_ABILITY_IDS).toHaveLength(15);
    expect(projectDeathConsul(s).digestion).toContain('7/12'); expect(currentDeathConsulSourceEra(s)).toBe('POST_CYCLE');
    expect(validateDeathConsulState(s)).toBe(true); expect(isDeathConsulAcquisitionStage(s)).toBe(true); expect(hasDeathConsulHistory(s)).toBe(false);
    assertValidSliceState(s);
  });
  it('keeps the separate571-command original-era survivor and its dead Owen independent', () => {
    const s = fixture('ORIGINAL'); expect(readObjectEntry<unknown[]>(paths.ORIGINAL, 'commands')).toHaveLength(571);
    expect(s).toMatchObject({ revision: 572, week: 158, status: 'ACTIVE', health: 100,
      progression: { sequence: 3, acting: 0 }, ferryman: { promotionWeek: 157 }, longChapter: { handoff: null } });
    expect(s.undying.encounter.enemy).toMatchObject({ status: 'DEAD', health: 0, weaponLocation: 'YARD' });
    expect(s.ferryman.life.reed).toMatchObject({ energy: 100, travelMetres: 0 });
    expect(currentDeathConsulSourceEra(s)).toBe('ORIGINAL'); expect(projectDeathConsul(s).digestion).toContain('1/12');
    expect(projectDeathConsul(s).prices).toEqual(DEATH_CONSUL_PRICES); assertValidSliceState(s);
  });
  it('creates independent empty acquisition state and hides unavailable pathways and sequences', () => {
    const s = createSliceRun('death-consul-hidden', sliceDefaultCreationSelection, 'death-consul-hidden');
    expect(projectDeathConsul(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false,
      sourceEra: null, sourceLabel: '', prices: null, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], resources: null });
    expect(projectDeathConsul(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createDeathConsulState(); other.bottles[0]!.labourSteps = 5; other.life.site.residual.strength = 1;
    expect(s.deathConsul.bottles[0]!.labourSteps).toBe(0); expect(s.deathConsul.life.site.residual.strength).toBe(3);
    expect(s.deathConsul.life.site.operatorId).toBeNull(); expect(s.deathConsul.life.site.residual.id).toBeNull();
    for (const sequence of [9, 8, 7, 6, 5, 4, 1, 0]) {
      const t = unit(); t.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>;
      expect(projectDeathConsul(t).discovered).toBe(false); reject(t, { type: 'LEARN_GUIDANCE' });
    }
    const t = unit(); t.progression.pathwayId = 'sun'; expect(projectDeathConsul(t).discovered).toBe(false); reject(t, { type: 'LEARN_GUIDANCE' });
  });
  it.each(['ORIGINAL', 'POST_CYCLE'] as const)('freezes%s provider, source week and real era prices at guidance', era => {
    const s = unit(era), old = structuredClone(oldRoots(s)), scene = structuredClone(s.deathConsul.life), prices = deathConsulPrices(era), week = s.week;
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([100000 - prices.guidance, 99]);
    expect(s.deathConsul).toMatchObject({ guidanceKnown: true, sourceEra: era, sourceWeek: week });
    expect(projectDeathConsul(s).sourceLabel).toContain(FERRYMAN_PROVIDERS[era].id);
    expect(projectDeathConsul(s).prices).toEqual(prices);
    expect(s.deathConsul.bottles.map((b, i) => ({ id: b.id, source: b.source, stockedWeek: b.stockedWeek }))).toEqual(
      [1, 2, 3].map(n => ({ id: `death-consul-potion-${n}`, source: deathConsulPotionSource(era, n, week), stockedWeek: week })));
    expect(oldRoots(s)).toEqual(old); expect(s.deathConsul.life).toEqual(scene);
    expect(projectDeathConsul(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(DEATH_CONSUL_FORMULA_STATUS).toContain('没有可供自行调配的完整配方');
    expect(deathConsulConsumptionRisk(era)).toContain(`${prices.preparation}便士`); expect(deathConsulConsumptionRisk(era)).toContain(`${prices.labourBalance}便士`);
    expect(validateDeathConsulState(s)).toBe(true); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('keeps the declared original and post-cycle prices distinct', () => {
    expect(DEATH_CONSUL_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, labourBalance: 800, preparation: 120 });
    expect(DEATH_CONSUL_POST_CYCLE_PRICES).toEqual({ guidance: 120, potion: 1200, labourCredit: 1120, labourBalance: 80, preparation: 20 });
  });
  it.each(['ORIGINAL', 'POST_CYCLE'] as const)('requires five real bottle-specific jobs and remaining balance in%s', era => {
    const s = taught(era), b = s.deathConsul.bottles[0]!, old = structuredClone(oldRoots(s));
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(s.cash).toBe(cash - deathConsulPrices(era).labourBalance);
    expect(b).toMatchObject({ status: 'PLAYER', acquiredWeek: s.week }); expect(s.deathConsul.bottles[1]!.labourSteps).toBe(0);
    expect(s.deathConsul.preparations).toEqual([]); expect(s.deathConsul.preparedWeek).toBeNull(); expect(oldRoots(s)).toEqual(old);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); expect(validateDeathConsulState(s)).toBe(true);
  });
  it.each(['ORIGINAL', 'POST_CYCLE'] as const)('never transfers partial labour, old bottles or unaffordable purchases in%s', era => {
    const s = taught(era), b = s.deathConsul.bottles[0]!, prices = deathConsulPrices(era);
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(prices.potion);
    for (const bottleId of ['ferryman-post-cycle-potion-1', 'ferryman-original-potion-1', 'undying-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
    s.cash = prices.potion - 1; reject(s, { type: 'BUY_POTION', bottleId: s.deathConsul.bottles[1]!.id });
  });
  it.each(['ORIGINAL', 'POST_CYCLE'] as const)('requires three distinct preparations plus paid current-week inspection in%s', era => {
    const s = taught(era); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of DEATH_CONSUL_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.deathConsul.preparations[index]).toEqual({ taskId, completedWeek: s.week }); reject(s, { type: 'PREPARE_TASK', taskId });
      if (index < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    const cash = s.cash, ap = s.actionsRemaining, site = structuredClone(s.deathConsul.life.site);
    apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, s.deathConsul.preparedWeek]).toEqual([cash - deathConsulPrices(era).preparation, ap - 1, s.week]);
    expect(s.deathConsul.life.site).toEqual(site); expect(hasDeathConsulLock(s)).toBe(true);
    for (const c of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), ritual: true }]) {
      expect(validateDeathConsulCommand(c)).toBe(false); reject(s, c);
    }
  });
  it('counts twelve whole weeks from the actual S3 promotion, never the original S9 dose or cycle date', () => {
    const s = qualify(taught()); buy(s); expect(s.ferryman.promotionWeek).toBe(3253); expect(s.progression.promotionWeek).toBe(5);
    s.week = 3260; expect(deathConsulAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('7/12');
    s.week = 3264; reject(s, { type: 'PREPARE_PROMOTION' }); s.week = 3265;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect(s.deathConsul.preparedWeek).toBe(3265);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 2], [30, 'SUCCESS', 85, 100, 0, 2], [90, 'FAILURE', 75, 85, 30, 3], [100, 'GREAT_FAILURE', 55, 75, 60, 3]] as const)
    ('settles directed%s/%s with actual costs and no injury, gender, spirit or historical reset', (roll, tier, mind, health, pollution, sequence) => {
      const s = prepared(), old = structuredClone(oldRoots(s)), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats };
      const injuries = structuredClone(s.injuries), risk = s.injuryRisk, gender = s.character.gender, random = structuredClone(s.random);
      const town = structuredClone(s.town), history = structuredClone(s.combatHistory), sources = [...s.seer.completedSources];
      s.actionsRemaining = 0; const ctx = apply(s, dose(s), roll);
      expect(ctx.check).toHaveBeenCalledExactlyOnceWith('will', 30);
      expect([s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([mind, health, pollution, sequence, 31, 0]);
      expect(s.deathConsul.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: tier, consumedWeek: s.week, preparationWeek: s.week });
      expect(s.deathConsul.preparedWeek).toBeNull(); expect(hasDeathConsulLock(s)).toBe(false);
      expect(oldRoots(s)).toEqual(old); expect(s.injuries).toEqual(injuries); expect(s.injuryRisk).toBe(risk);
      expect(s.character.gender).toBe(gender); expect(s.random).toEqual(random); expect(s.town).toEqual(town);
      expect(s.combatHistory).toEqual(history); expect(s.seer.completedSources).toEqual(sources);
      for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id], id).toBe(value);
      if (sequence === 2) {
        expect(isDeathConsul(s)).toBe(true); expect(hasDeathConsulHistory(s)).toBe(true); expect(isDeathConsulAcquisitionStage(s)).toBe(false);
        expect(s.deathConsul.ferrymanActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
        expect(Object.keys(s.progression.mastery)).toHaveLength(17); expect(DEATH_CONSUL_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
        expect(projectDeathConsul(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
        expect(projectDeathConsul(s).actions.some(a => ['BUY_POTION', 'CONSUME', 'PREPARE_TASK'].includes(a.command.type))).toBe(false);
      } else {
        expect(s.progression.acting).toBe(100); expect(s.character.coreStats).toEqual(stats); expect(Object.keys(s.progression.mastery)).toHaveLength(15);
        expect(s.deathConsul.ferrymanActingAtPromotion).toBeNull(); expect(s.deathConsul.promotionWeek).toBeNull();
      }
      expect(validateDeathConsulState(s)).toBe(true); reject(s, dose(s));
    });
  it('floors only guided potion rejection and leaves ordinary death final', () => {
    const s = prepared(); s.health = 21; s.mind = 41; const injuries = structuredClone(s.injuries), risk = s.injuryRisk;
    apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 3]);
    expect(s.injuries).toEqual(injuries); expect(s.injuryRisk).toBe(risk); expect(validateDeathConsulState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('allows zero-action exit without refund, healing or restoration of preparation', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, bottles = structuredClone(s.deathConsul.bottles); reject(s, dose(s));
    const ctx = apply(s, { type: 'LEAVE_PREPARATION' }); expect(ctx.check).not.toHaveBeenCalled();
    expect([s.cash, s.health, s.mind, s.spirituality, s.actionsRemaining]).toEqual([cash, 1, 1, 31, 0]);
    expect(s.deathConsul.bottles).toEqual(bottles); expect(hasDeathConsulLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); reject(s, dose(s));
  });
  it('rejects provider or frozen-era substitution before another payment or roll', () => {
    for (const mutate of [
      (s: SliceState) => { s.deathConsul.sourceEra = 'ORIGINAL'; },
      (s: SliceState) => { activeFerrymanChannel(s)!.provider.id = FERRYMAN_PROVIDERS.ORIGINAL.id; },
      (s: SliceState) => { activeFerrymanChannel(s)!.provider.name = 'replacement'; },
      (s: SliceState) => { activeFerrymanChannel(s)!.provider.ageAtIntroduction++; },
      (s: SliceState) => { activeFerrymanChannel(s)!.agreementClosedDate = { ...s.date }; },
    ]) { const s = taught(); mutate(s); reject(s, { type: 'BUY_POTION', bottleId: s.deathConsul.bottles[0]!.id }); expect(validateDeathConsulState(s)).toBe(false); }
  });
  it('rejects stale preparation, old scene locks, missing mastery and vitality before a check', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.progression.acting = 99; }, s => { s.ferryman.promotionWeek = s.week - 11; }, s => { s.week++; },
      s => { s.health = 20; }, s => { s.mind = 40; }, s => { s.world.city = 'ELSEWHERE'; },
      s => { s.ferryman.era.location = 'OUTSIDE'; }, s => { s.ferryman.encounter.status = 'READY'; },
      s => { activeFerrymanChannel(s)!.preparedWeek = s.week; },
      s => { delete s.progression.mastery['death.s3.bounded-ferry']; }, s => { s.progression.mastery['death.s1.unearned'] = 0; },
      s => { s.progression.mastery['death.s6.dead-words'] = 501; }, s => { s.progression.mastery['death.s6.dead-words'] = 0.5; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, dose(s)); }
  });
  it.each(['ORIGINAL', 'POST_CYCLE'] as const)('retains three failed originals and waits a real week for paid%s resupply', era => {
    const s = qualify(taught(era));
    for (let index = 0; index < 3; index++) {
      buy(s, index); reject(s, dose(s, index)); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, index), 100);
      // Explicit directed recovery for acquisition validation; this is not public medical evidence.
      s.health = 100; s.mind = 100; if (index < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const failed = structuredClone(s.deathConsul.bottles), ap = s.actionsRemaining, cash = s.cash, old = structuredClone(oldRoots(s));
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); expect(s.cash).toBe(cash);
    expect(s.deathConsul.bottles).toEqual(failed); reject(s, { type: 'RECEIVE_SUPPLY' }); s.week++; s.date = addGameDays(s.date, 7);
    apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.deathConsul.bottles.slice(0, 3)).toEqual(failed); expect(s.deathConsul.bottles).toHaveLength(6);
    expect(s.deathConsul.sourceEra).toBe(era); expect(oldRoots(s)).toEqual(old);
    expect(s.deathConsul.bottles[3]).toMatchObject({ id: 'death-consul-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null,
      source: deathConsulPotionSource(era, 4, s.week) });
    expect(projectDeathConsul(s).actions.find(a => a.id === 'buy-death-consul-potion-4')!.cost).toContain(`${deathConsulPrices(era).potion}便士`);
    expect(validateDeathConsulState(s)).toBe(true); reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' });
    const beforeBuy = s.cash; buy(s, 3); expect(s.cash).toBe(beforeBuy - deathConsulPrices(era).potion); reject(s, dose(s, 3));
    for (const change of [
      (t: SliceState) => { t.deathConsul.bottles[3]!.source = activeFerrymanChannel(t)!.bottles[0]!.source; },
      (t: SliceState) => { t.deathConsul.bottles[4]!.stockedWeek!--; },
      (t: SliceState) => { t.deathConsul.bottles[0]!.consumedWeek = t.week; t.deathConsul.bottles[0]!.preparationWeek = t.week; },
    ]) { const t = structuredClone(s); change(t); expect(validateDeathConsulState(t)).toBe(false); }
  });
  it('strictly rejects malformed commands and invented slots without granting free capabilities', () => {
    for (const c of [null, [], {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'FREE_RITUAL' },
      { type: 'BUY_POTION', bottleId: 'death-consul-potion-0' }, { type: 'BUY_POTION', bottleId: 'death-consul-potion-01' },
      { type: 'BUY_POTION', bottleId: 'death-consul-potion--1' }, { type: 'BUY_POTION', bottleId: 'death-consul-potion-1.5' },
      { type: 'CONSUME', bottleId: 'death-consul-potion-1', confirmed: 1 }, { type: 'CRAFT' }, { type: 'AWAIT_REVIVAL' }]) {
      expect(isDeathConsulAcquisitionCommand(c)).toBe(false); expect(validateDeathConsulCommand(c)).toBe(false);
    }
    reject(taught(), { type: 'BUY_POTION', bottleId: 'death-consul-potion-999' });
  });
  it('strictly rejects extra fields, invalid dates, forged bottles and impossible promotion metadata', () => {
    const base = prepared(); apply(base, dose(base)); expect(validateDeathConsulState(base)).toBe(true);
    const mutations: ((s: SliceState) => void)[] = [
      s => { Object.assign(s.deathConsul, { freeResurrection: true }); }, s => { s.deathConsul.sourceWeek = s.week + 1; },
      s => { s.deathConsul.sourceWeek = s.ferryman.promotionWeek! - 1; }, s => { s.deathConsul.sourceEra = null; },
      s => { s.deathConsul.promotionWeek!--; }, s => { s.deathConsul.ferrymanActingAtPromotion = 99; },
      s => { s.deathConsul.preparedWeek = s.week; }, s => { s.deathConsul.preparations.push({ ...s.deathConsul.preparations[0]! }); },
      s => { s.deathConsul.preparations[0]!.completedWeek = s.week + 1; }, s => { s.deathConsul.bottles[0]!.preparationWeek!--; },
      s => { s.deathConsul.bottles[0]!.source += 'forged'; }, s => { s.deathConsul.bottles[1]!.id = s.deathConsul.bottles[0]!.id; },
      s => { s.deathConsul.bottles[1]!.labourSteps = 6; }, s => { s.deathConsul.bottles[1]!.acquiredWeek = s.week; },
      s => { s.deathConsul.resupply.deliveries = 1; }, s => { s.deathConsul.resupply.requestedWeek = s.week; },
      s => { delete s.progression.mastery['death.s2.pale-flame']; }, s => { s.progression.mastery['death.s2.pale-flame'] = 0.5; },
      s => { s.progression.mastery['death.s1.unearned'] = 0; }, s => { s.progression.acting = 1; },
    ];
    for (const change of mutations) { const s = structuredClone(base); change(s); expect(validateDeathConsulState(s)).toBe(false); }
  });
  it('migrates strict169 state into the current schema by adding only fresh missing roots, without erasing an old field', () => {
    const current = fixture();
    const { deathConsul: _newRoot, planeswalker: _planeswalker, fateTrojan: _fateTrojan, glory: _glory, calamityDemoness: _calamityDemoness, ...rest } = current;
    // Remove all five roots introduced after schema 169; keep every earlier field and the real historical fixture unchanged.
    const old = { ...rest, schemaVersion: 169, contentVersion: 'light-seeker-v169' }, before = structuredClone(old);
    const result = migrateSliceState(old), { deathConsul, planeswalker, fateTrojan, glory, calamityDemoness, ...migrated } = result;
    expect(old).toEqual(before); expect(deathConsul).toEqual(createDeathConsulState());
    expect({ planeswalker, fateTrojan, glory, calamityDemoness }).toEqual({ planeswalker: createPlaneswalkerState(), fateTrojan: createFateTrojanState(), glory: createGloryState(), calamityDemoness: createCalamityDemonessState() });
    expect(migrated).toEqual({ ...old, schemaVersion: 174, contentVersion: 'calamity-demoness-v174' });
    expect(migrateSliceState(result)).toEqual(result); assertValidSliceState(result);
    expect(() => migrateSliceState({ ...old, deathConsul: createDeathConsulState() })).toThrow();
    expect(() => migrateSliceState({ ...old, contentVersion: 'forged' })).toThrow();
    expect(() => migrateSliceState({ ...old, extraAuthority: true })).toThrow();
    const missing = { ...result } as Partial<SliceState>; delete missing.deathConsul;
    expect(() => migrateSliceState(missing)).toThrow();
  });
});
