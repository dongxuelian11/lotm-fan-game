import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { activeFerrymanChannel, applyFerrymanAcquisition, closeFerrymanOriginalEra, createFerrymanState, ferrymanAcquisitionBlock, hasFerrymanLock, projectFerryman, validateFerrymanCommand, validateFerrymanState } from '../../src/domain/ferryman/index.js';
import { FERRYMAN_FORMULA_STATUS, FERRYMAN_POST_CYCLE_PRICES, FERRYMAN_PRICES, FERRYMAN_SOURCE_STATUS } from '../../src/domain/ferryman/content.js';
import { FERRYMAN_ABILITY_IDS, FERRYMAN_PREPARATION_IDS, type FerrymanAcquisitionCommand } from '../../src/domain/ferryman/types.js';
const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/${name}/natural.json`, 'utf8'));
const original = () => migrateSliceState(fixture('undying-v01260').final);
const post = () => applySliceIntent(migrateSliceState(fixture('long-chapter-v01390').final), { type: 'LONG_CHAPTER', command: { type: 'CONTINUE_FERRYMAN' } });
function context(s: SliceState, roll = 1): SeerContext { return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) }; }
const apply = (s: SliceState, c: FerrymanAcquisitionCommand, roll = 1) => { const ctx = context(s, roll); applyFerrymanAcquisition(s, c, ctx); return ctx; };
/** Explicit directed unit setup, never reported as natural play. Original dates and weeks advance together. */
function unit(postCycle = false) {
  const s = postCycle ? post() : original();
  if (!postCycle) { const weeks = Math.max(0, s.undying.promotionWeek! + 12 - s.week); s.week += weeks; s.date = addGameDays(s.date, weeks * 7); }
  s.cash = 100000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
const channel = (s: SliceState) => activeFerrymanChannel(s)!;
function taught(s = unit()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of FERRYMAN_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = channel(s).bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: channel(s).bottles[index]!.id, confirmed: true }) as const;
function prepared(postCycle = false) { const s = qualify(taught(unit(postCycle))); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, c: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyFerrymanAcquisition(s, c as FerrymanAcquisitionCommand, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }

describe('Ferryman finite original and post-cycle acquisition', () => {
  it('retains the exact separate422 and428-command entry facts', () => {
    const old = fixture('undying-v01260'), later = fixture('long-chapter-v01390');
    expect(old.commands).toHaveLength(422); expect(later.commands).toHaveLength(428);
    expect(original()).toMatchObject({ week: 112, health: 100, mind: 100, spirituality: 102, cash: 674, actionsRemaining: 1, undying: { encounter: { enemy: { status: 'DEAD', weaponLocation: 'YARD' } } } });
    expect(migrateSliceState(later.final)).toMatchObject({ week: 3235, date: { year: 1411, month: 6, day: 26 }, health: 55, mind: 68, spirituality: 104, cash: 194, actionsRemaining: 1, undying: { encounter: { status: 'AVAILABLE', enemy: { health: 100, weaponLocation: 'HAND' } } } });
  });
  it('does not manufacture channels, provider stock or information before actual introduction', () => {
    const s = createSliceRun('ferryman-hidden', sliceDefaultCreationSelection, 'ferryman-hidden');
    expect(s.ferryman.channels).toEqual([]); expect(validateFerrymanState(s)).toBe(true);
    expect(projectFerryman(s)).toMatchObject({ discovered: false, currentChannel: null, channelHistory: [], bottles: [], actions: [], formulaKnown: false, formula: [], resources: null });
    expect(projectFerryman(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const another = createFerrymanState(); expect(another).toEqual(s.ferryman); expect(another.channels).not.toBe(s.ferryman.channels);
  });
  it('charges original500 with actual Lewis and no world, resource or old-person rewrite', () => {
    const s = original(), old = structuredClone(s.undying); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining, s.health, s.spirituality]).toEqual([174, 0, 100, 102]);
    expect(channel(s)).toMatchObject({ id: 'ORIGINAL', provider: { id: 'FR3-LEWIS', ageAtIntroduction: 56 }, introducedWeek: 112, guidancePaid: 500 });
    expect(channel(s).bottles.map(b => b.id)).toEqual([1, 2, 3].map(n => `ferryman-original-potion-${n}`)); expect(s.undying).toEqual(old); expect(validateFerrymanState(s)).toBe(true);
    expect(FERRYMAN_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 }); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires public residence handoff before the real12m post-cycle introduction', () => {
    const blocked = migrateSliceState(fixture('long-chapter-v01390').final); reject(blocked, { type: 'LEARN_GUIDANCE' });
    const s = post(), history = structuredClone(s.longChapter), resources = [s.health, s.mind, s.spirituality]; apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([74, 0]); expect([s.health, s.mind, s.spirituality]).toEqual(resources); expect(s.longChapter).toEqual(history);
    expect(channel(s)).toMatchObject({ id: 'POST_CYCLE', provider: { id: 'FR3-HANNA', ageAtIntroduction: 43 }, introducedWeek: 3235, guidancePaid: 120 });
    expect(channel(s).bottles.map(b => b.id)).toEqual([1, 2, 3].map(n => `ferryman-post-cycle-potion-${n}`));
    expect(s.ferryman.era).toMatchObject({ location: 'RECEPTION', elapsedSeconds: 12, travelledMetres: 12 }); expect(validateFerrymanState(s)).toBe(true);
    expect(FERRYMAN_POST_CYCLE_PRICES).toEqual({ guidance: 120, potion: 1200, labourCredit: 1120, preparation: 20 });
  });
  it('keeps original facts distinct from unknown pureS3 abilities, recipe and ritual', () => {
    expect(FERRYMAN_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实'); expect(FERRYMAN_FORMULA_STATUS).toContain('不复用序列4');
    expect(FERRYMAN_SOURCE_STATUS).toContain('第四部第168章'); expect(FERRYMAN_SOURCE_STATUS).toContain('死亡执政官'); expect(FERRYMAN_SOURCE_STATUS).toContain('序列4不死者阶段'); expect(FERRYMAN_SOURCE_STATUS).toContain('不提供即时战斗复活');
  });
  it.each([false, true])('gives only the matching bottle five labour credits in era%s', later => {
    const s = taught(unit(later)), b = channel(s).bottles[0]!; for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(later ? 80 : 800); expect(b.paidPennies).toBe(later ? 80 : 800);
    expect(channel(s).bottles[1]!.labourSteps).toBe(0); expect(channel(s).preparations).toEqual([]); expect(channel(s).preparedWeek).toBeNull(); reject(s, { type: 'POTION_WORK', bottleId: b.id }); expect(validateFerrymanState(s)).toBe(true);
  });
  it('never partially discounts a bottle', () => {
    const s = taught(), b = channel(s).bottles[0]!; for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id }); const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200); expect(validateFerrymanState(s)).toBe(true);
  });
  it('requires three channel-specific tasks and separate current-week preparation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const taskId of FERRYMAN_PREPARATION_IDS) { apply(s, { type: 'PREPARE_TASK', taskId }); reject(s, { type: 'PREPARE_TASK', taskId }); }
    const cash = s.cash; s.actionsRemaining = 1; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, channel(s).preparedWeek]).toEqual([cash - 120, 0, s.week]); expect(hasFerrymanLock(s)).toBe(true);
    apply(s, { type: 'LEAVE_PREPARATION' }); expect(channel(s).preparationWindows[0]).toMatchObject({ outcome: 'CANCELLED', closedWeek: s.week, bottleId: null }); expect(channel(s).bottles[0]!.status).toBe('PLAYER'); expect(hasFerrymanLock(s)).toBe(false); expect(s.cash).toBe(cash - 120); expect(validateFerrymanState(s)).toBe(true);
  });
  it('rejects malformed confirmation without checking or mutation', () => {
    const s = prepared(); for (const c of [{ ...dose(s), confirmed: false }, { type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), acceptBodyChange: true }, { type: 'POTION_WORK', bottleId: 'undying-potion-1' }]) { expect(validateFerrymanCommand(c)).toBe(false); reject(s, c); }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles directed tier%s without erasing history, healing or altering gender', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), old = structuredClone(s.undying), stats = { ...s.character.coreStats }, mastery = { ...s.progression.mastery }, gender = s.character.gender;
    const ctx = apply(s, dose(s), roll); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality]).toEqual([mind, health, pollution, sequence, 31]);
    expect(channel(s).bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: tier, consumedWeek: s.week, preparationWeek: s.week }); expect(channel(s).preparedWeek).toBeNull(); expect(s.undying).toEqual(old); expect(s.character.gender).toBe(gender);
    for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 3) { expect(s.ferryman.undyingActingAtPromotion).toBe(100); expect(s.ferryman.promotionDate).toEqual(s.date); expect(FERRYMAN_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]); for (const key of ['physique', 'will', 'knowledge', 'perception'] as const) expect(s.character.coreStats[key]).toBe(stats[key] + 1); }
    expect(validateFerrymanState(s)).toBe(true); reject(s, dose(s));
  });
  it('preserves failed bottles and requires a later real week for independent resupply', () => {
    const s = qualify(taught()); for (let i = 0; i < 3; i++) { s.health = 100; s.mind = 100; buy(s, i); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, i), 90); }
    apply(s, { type: 'REQUEST_SUPPLY' }); const failures = structuredClone(channel(s).bottles); reject(s, { type: 'RECEIVE_SUPPLY' }); s.week++; s.date = addGameDays(s.date, 7); apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(channel(s).bottles.slice(0, 3)).toEqual(failures); expect(channel(s).bottles.slice(3).every(b => b.labourSteps === 0 && b.paidPennies === 0 && b.status === 'SUPPLIER')).toBe(true); expect(channel(s).resupply.deliveries).toBe(1); expect(validateFerrymanState(s)).toBe(true);
  });
  it('closes original unconsumed stock as expired while preserving paid labour and ended preparations', () => {
    const s = original(); s.cash = 100000; s.actionsRemaining = 30; apply(s, { type: 'LEARN_GUIDANCE' });
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: channel(s).bottles[0]!.id }); buy(s); apply(s, { type: 'PREPARE_TASK', taskId: 'CHECK_ROUTE' });
    const c = channel(s), cycle = s.undying.lifecycle.expectedCycleDate!, oldBottle = structuredClone(c.bottles[0]); closeFerrymanOriginalEra(s, s.date, cycle);
    expect(c.agreementClosedDate).toEqual(s.date); expect(c.bottles[0]).toEqual({ ...oldBottle, status: 'EXPIRED', expiredDate: cycle }); expect(c.preparations).toHaveLength(1); expect(activeFerrymanChannel(s)).toBeNull();
    const later = post(); later.ferryman = structuredClone(s.ferryman); later.ferryman.era = post().ferryman.era; const cash = later.cash; apply(later, { type: 'LEARN_GUIDANCE' });
    expect(later.cash).toBe(cash); expect(later.actionsRemaining).toBe(0); expect(channel(later).guidancePaid).toBe(0); expect(channel(later).preparations).toEqual([]); expect(channel(later).bottles.every(b => b.labourSteps === 0)).toBe(true); expect(later.ferryman.channels).toHaveLength(2); expect(validateFerrymanState(later)).toBe(true);
    reject(later, { type: 'BUY_POTION', bottleId: oldBottle.id });
  });
  it('refuses live preparation closure, and never turns consumed failure into expiry', () => {
    const s = prepared(), before = structuredClone(s); expect(() => closeFerrymanOriginalEra(s, s.date, s.undying.lifecycle.expectedCycleDate!)).toThrow(); expect(s).toEqual(before);
    apply(s, dose(s), 90); const failed = structuredClone(channel(s).bottles[0]); closeFerrymanOriginalEra(s, s.date, s.undying.lifecycle.expectedCycleDate!); expect(s.ferryman.channels[0]!.bottles[0]).toEqual(failed); expect(failed.status).toBe('CONSUMED');
  });
  it('cancels a pending old request without deleting consumed failures or delivering new stock', () => {
    const s = qualify(taught()); for (let i = 0; i < 3; i++) { s.health = 100; s.mind = 100; buy(s, i); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, i), 90); }
    apply(s, { type: 'REQUEST_SUPPLY' }); const c = channel(s), bottles = structuredClone(c.bottles), requested = c.resupply.requestedWeek;
    closeFerrymanOriginalEra(s, s.date, s.undying.lifecycle.expectedCycleDate!); expect(c.bottles).toEqual(bottles); expect(c.resupply).toMatchObject({ requestedWeek: requested, requestedDate: s.date, cancelledDate: s.date, deliveries: 0 }); expect(activeFerrymanChannel(s)).toBeNull();
  });
  it('rejects forged source identity, stock, price, preparation and promotion metadata', () => {
    const s = prepared(); const mutations: ((x: SliceState) => void)[] = [x => channel(x).provider.id = 'FR3-HANNA', x => channel(x).bottles[0]!.source += 'fake', x => channel(x).bottles[0]!.paidPennies = 0, x => channel(x).preparations[0]!.id = 'old-task', x => channel(x).preparationWindows[0]!.closedWeek = x.week, x => x.ferryman.promotionDate = { ...x.date }, x => channel(x).introducedWeek--];
    for (const change of mutations) { const changed = structuredClone(s); change(changed); expect(validateFerrymanState(changed)).toBe(false); } expect(validateFerrymanState(s)).toBe(true);
  });
  it('cannot consume after ordinary death and floors only guided potion rejection', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100); expect([s.health, s.mind]).toEqual([1, 1]);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead)); expect(ferrymanAcquisitionBlock(dead, { type: 'LEARN_GUIDANCE' })).toContain('普通死亡');
  });
});
