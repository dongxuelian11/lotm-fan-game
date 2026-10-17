import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applySilentDiscipleAcquisition, createSilentDiscipleState, hasSilentDiscipleLock, isSilentDiscipleAcquisitionCommand, projectSilentDisciple, silentDiscipleAcquisitionBlock, validateSilentDiscipleCommand, validateSilentDiscipleState } from '../../src/domain/silent-disciple/index.js';
import { SILENT_DISCIPLE_CONSUMPTION_RISK, SILENT_DISCIPLE_FORMULA_STATUS, SILENT_DISCIPLE_PRICES, SILENT_DISCIPLE_SOURCE_STATUS } from '../../src/domain/silent-disciple/content.js';
import { SILENT_DISCIPLE_ABILITY_IDS, SILENT_DISCIPLE_PREPARATION_IDS, type SilentDiscipleAcquisitionCommand } from '../../src/domain/silent-disciple/types.js';

const prior = () => JSON.parse(readFileSync('tests/fixtures/puppet-v01340/natural.json', 'utf8'));
const roots = ['prisoner', 'madman', 'werewolf', 'zombie', 'wraith', 'puppet'] as const;
/** Actual407-command baseline; resource/time edits below are isolated unit setup, never natural-play evidence. */
function puppet(): SliceState {
  const s = migrateSliceState(prior().final); s.silentDisciple = createSilentDiscipleState();
  s.week = Math.max(s.week, s.puppet.promotionWeek! + 12); s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 31;
  s.seer.pollution = 0; s.character.coreStats.will = 30; return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: SilentDiscipleAcquisitionCommand, roll = 1) { const c = context(s, roll); applySilentDiscipleAcquisition(s, command, c); return c; }
function taught(s = puppet()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of SILENT_DISCIPLE_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.silentDisciple.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.silentDisciple.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const original = structuredClone(s), c = context(s);
  expect(() => applySilentDiscipleAcquisition(s, command as SilentDiscipleAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(original); expect(c.check).not.toHaveBeenCalled();
}
function originals(s: SliceState, before: SliceState) { for (const root of roots) expect(s[root]).toEqual(before[root]); }

describe('SilentDisciple3 original bottles and bounded G preparation', () => {
  it('reads the actual407-command W103 baseline without rewriting RNG, original choices or the original six roots', () => {
    const capture = prior(), s = migrateSliceState(capture.final);
    expect(capture.commands).toHaveLength(407); expect(capture.seed).toBe('prisoner-natural-v057');
    expect(s).toMatchObject({ week: 103, status: 'ACTIVE', cash: 900, actionsRemaining: 2, health: 70, mind: 100, spirituality: 115, progression: { sequence: 4, acting: 100 }, random: { seed: 'prisoner-natural-v057', cursor: 192 } });
    expect(s.puppet.promotionWeek).toBe(89);
    expect(s.puppet.encounter).toMatchObject({ targetId: 'PU4-EDRIN-VALE', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 13, form: 'HUMAN', link: 'NONE' });
    expect(s.puppet.encounter.enemyInjuries.map(i => i.severity)).toEqual(['LIGHT', 'HEAVY']);
    expect(s.puppet.encounter.blocks.map(b => [b.id, b.status, b.location])).toEqual([['PU4-BLOCK-1', 'SPENT', 'TARGET_GROUND'], ['PU4-BLOCK-2', 'SPENT', 'TARGET_GROUND'], ['PU4-BLOCK-3', 'READY', 'SOURCE']]);
    originals(s, capture.final); expect(validateSilentDiscipleState(s)).toBe(true); expect(projectSilentDisciple(s).digestion).toContain('14/12');
  });
  it('creates independent originals and hides this source before actual Puppet4', () => {
    const s = createSliceRun('silent-disciple-hidden', sliceDefaultCreationSelection, 'silent-disciple-hidden');
    expect(validateSilentDiscipleState(s)).toBe(true);
    expect(projectSilentDisciple(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null, inheritedTools: '' });
    expect(projectSilentDisciple(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createSilentDiscipleState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'REVIEW_RECORDS', completedWeek: 1 });
    expect(s.silentDisciple.bottles[0]!.labourSteps).toBe(0); expect(s.silentDisciple.preparations).toEqual([]);
  });
  it('does not open this source for another path, an unsupported sequence, or a missing real S4 promotion', () => {
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'sun', 'door', 'warrior', 'error', 'demoness', 'hanged-man', 'hermit', 'abyss', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const s = puppet(); s.progression.pathwayId = pathwayId; expect(projectSilentDisciple(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 2, 1, 0]) { const s = puppet(); s.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectSilentDisciple(s).discovered).toBe(false); }
    const s = puppet(); s.puppet.promotionWeek = null; reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without turning the unknown recipe, ritual or high-level information into facts', () => {
    const s = puppet(), before = structuredClone(s); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); originals(s, before);
    expect(SILENT_DISCIPLE_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    for (const text of ['完整配方与晋升仪式尚未核实', '不把莎伦特定木乃伊推广成通用材料', '古称诅咒之物有直接原核', '哈伦·维斯']) expect(SILENT_DISCIPLE_FORMULA_STATUS).toContain(text);
    for (const text of ['Fifthpart96L183176', 'Sixth86L216695–701', 'Sixth8L202933–937', '不证明零自伤或无限反射', '古代邪物', '神孽', '均为原创G']) expect(SILENT_DISCIPLE_SOURCE_STATUS).toContain(text);
    expect(SILENT_DISCIPLE_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectSilentDisciple(s).formula).toEqual([]); reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateSilentDiscipleState(s)).toBe(true);
  });
  it('five actual jobs reduce only that unique bottle to900 and do not pay for preparations', () => {
    const s = taught(), bottle = s.silentDisciple.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect([bottle.labourSteps, bottle.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]); reject(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s); expect([s.cash, bottle.status, bottle.acquiredWeek]).toEqual([98600, 'PLAYER', s.week]);
    expect(s.silentDisciple.bottles[1]!.labourSteps).toBe(0); expect(s.silentDisciple.preparations).toEqual([]); expect(s.silentDisciple.preparedWeek).toBeNull();
    reject(s, { type: 'BUY_POTION', bottleId: bottle.id }); expect(validateSilentDiscipleState(s)).toBe(true);
  });
  it('does not partially discount jobs, borrow an old original bottle or spend unavailable funds', () => {
    const s = taught(), bottle = s.silentDisciple.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6400);
    s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: s.silentDisciple.bottles[1]!.id });
    for (const bottleId of ['puppet-potion-1', 'wraith-potion-1', 'zombie-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
  });
  it('requires three distinct one-action preparations and a separate current-week140 check', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of SILENT_DISCIPLE_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.silentDisciple.preparations[index]).toEqual({ taskId, completedWeek: s.week }); reject(s, { type: 'PREPARE_TASK', taskId });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, s.silentDisciple.preparedWeek]).toEqual([cash - 140, ap - 1, s.week]);
    expect(hasSilentDiscipleLock(s)).toBe(true); expect(projectSilentDisciple(s).insideCase).toBe(true); expect(validateSilentDiscipleState(s)).toBe(true);
  });
  it('leaves a real zero-action nonrefunding exit after the last preparation action', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1; const cash = s.cash, week = s.week;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 140]);
    reject(s, { type: 'PREPARE_PROMOTION' }); s.health = 1; s.mind = 1; const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, 31, cash - 140, 0]); expect(c.check).not.toHaveBeenCalled();
    expect(s.silentDisciple.preparedWeek).toBeNull(); expect(s.silentDisciple.bottles[0]!.status).toBe('PLAYER'); expect(hasSilentDiscipleLock(s)).toBe(false);
    reject(s, dose(s)); reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateSilentDiscipleState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles roll%s honestly without resource refills or rewriting original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), before = structuredClone(s), bottle = s.silentDisciple.bottles[0]!; s.actionsRemaining = 0;
    const c = apply(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([bottle.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(bottle).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.silentDisciple.preparedWeek).toBeNull();
    originals(s, before); expect(s.character.age).toBe(26); expect(s.character.gender).toBe('FEMALE'); expect(s.random).toEqual(before.random);
    expect(s.combatHistory).toEqual(before.combatHistory); expect(s.injuries).toEqual(before.injuries); expect(s.town).toEqual(before.town);
    expect(s.silentDisciple.life).toEqual(before.silentDisciple.life); expect(s.silentDisciple.encounter).toEqual(before.silentDisciple.encounter);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    if (sequence === 3) {
      expect(s.silentDisciple.puppetActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(before.progression.mastery, id))).toEqual([...SILENT_DISCIPLE_ABILITY_IDS]);
      expect(s.progression.mastery['chained.s3.short-transfiguration']).toBe(0); expect(s.progression.mastery['chained.s3.measured-curse']).toBe(0);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
      expect(projectSilentDisciple(s).inheritedHistory.join(' ')).toContain('PU4-EDRIN-VALE'); expect(projectSilentDisciple(s).inheritedTools).toContain('PU4-BLOCK-1:SPENT/TARGET_GROUND');
      expect(projectSilentDisciple(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateSilentDiscipleState(s)).toBe(true); reject(s, dose(s));
  });
  it('protects only guided potion rejection and never revives a dead body', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead)); expect(validateSilentDiscipleState(s)).toBe(true);
  });
  it('retains failed originals and requires another140 check for recovery and retry', () => {
    const s = prepared(); apply(s, dose(s), 100); const failed = structuredClone(s.silentDisciple.bottles[0]), tasks = structuredClone(s.silentDisciple.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100; const cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 1));
    expect(s.cash).toBe(cash - 140); expect(s.silentDisciple.bottles[0]).toEqual(failed); expect(s.silentDisciple.preparations).toEqual(tasks); expect(validateSilentDiscipleState(s)).toBe(true);
  });
  it('waits an actual next week for three new priced bottles after all current originals fail', () => {
    const s = qualify(taught()); reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const bottles = structuredClone(s.silentDisciple.bottles); apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.silentDisciple.bottles.slice(0, 3)).toEqual(bottles); expect(s.silentDisciple.bottles).toHaveLength(6);
    expect(s.silentDisciple.bottles[3]).toMatchObject({ id: 'silent-disciple-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectSilentDisciple(s).actions.find(a => a.id === 'buy-silent-disciple-potion-4')!.cost).toContain('6400'); expect(validateSilentDiscipleState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('measures twelve full weeks from original PuppetW89, then rejects stale checks and unmet digestion', () => {
    const s = puppet(); s.week = s.puppet.promotionWeek! + 11; qualify(taught(s)); buy(s); const originalPromotion = s.progression.promotionWeek;
    expect(silentDiscipleAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('11/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = s.puppet.promotionWeek! + 12; apply(s, { type: 'PREPARE_PROMOTION' }); expect(s.progression.promotionWeek).toBe(originalPromotion);
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100; s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateSilentDiscipleState(s)).toBe(false); apply(s, { type: 'LEAVE_PREPARATION' });
  });
  it('blocks unfinished old originals and practice without charging', () => {
    const s = qualify(taught()); buy(s);
    const changes: ((state: SliceState) => void)[] = [
      t => { Object.values(t.prisoner.cases)[0]!.holding = true; }, t => { Object.values(t.madman.cases)[0]!.burstOpen = true; },
      t => { Object.values(t.werewolf.cases)[0]!.sceneOpen = true; }, t => { Object.values(t.zombie.cases)[0]!.contactOpen = true; },
      t => { Object.values(t.wraith.cases)[0]!.contactOpen = true; }, t => { Object.values(t.puppet.life.cases)[0]!.contactOpen = true; },
      t => { t.zombie.practice.body = 'BRACED'; }, t => { t.zombie.practice.cold = 'ICED'; }, t => { t.zombie.practice.spirit = 'PRESENT'; },
      t => { t.wraith.practice.form = 'WRAITH'; }, t => { t.wraith.practice.node = 'ALCOVE'; }, t => { t.wraith.practice.host = 'NOLAN'; },
      t => { t.wraith.practice.mirror = 'OPEN'; }, t => { t.wraith.practice.flag = 'RAISED'; }, t => { t.wraith.practice.note = 'WRITTEN'; },
      t => { t.puppet.life.body.form = 'WOOD'; }, t => { t.puppet.life.link.state = 'LINKED'; }, t => { t.puppet.life.link.consented = true; },
      t => { t.puppet.life.token.playerNode = 'FAR'; }, t => { t.puppet.life.token.position = 'PLAYER'; }, t => { t.puppet.life.note.holder = 'PLAYER'; },
      t => { t.puppet.encounter.form = 'WOOD'; }, t => { t.puppet.encounter.link = 'LINKED'; }, t => { t.puppet.encounter.status = 'FIGHTING'; },
      t => { t.wraith.encounter.status = 'FIGHTING'; }, t => { t.wraith.encounter.staggerReady = true; }, t => { t.zombie.encounter.status = 'FIGHTING'; },
      ...(['werewolf', 'zombie', 'wraith'] as const).map(root => (t: SliceState) => { t[root].moon.pendingWeek = t.week; }),
      t => { t.puppet.life.moon.pendingId = 'PU4-MOON-1'; },
      t => { Object.values(t.puppet.life.cases)[0]!.status = 'PREPARED'; },
      ...(['prisoner', 'madman', 'werewolf', 'zombie', 'wraith'] as const).map(root => (t: SliceState) => { Object.values(t[root].cases)[0]!.status = 'PREPARED'; }),
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it('rejects unavailable guidance, foreign locations, no actions and insufficient current preparation funds', () => {
    const s = puppet(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' }); s.cash = 100000; s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0; reject(t, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }); reject(t, { type: 'POTION_WORK', bottleId: t.silentDisciple.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.cash = 139; reject(u, { type: 'PREPARE_PROMOTION' }); u.cash = 140; u.world.city = 'ELSEWHERE'; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'PERMANENT_FORM' }, { type: 'ZERO_COST_REFLECTION' }, { type: 'MUMMY_RITUAL' }, { type: 'SUMMON_BODY' }, { type: 'AUTO_SILENCE' }, { type: 'BUY_POTION', bottleId: 'puppet-potion-1' }, { type: 'PREPARE_TASK', taskId: 'GATHER_BELIEVERS' }, { type: 'LEARN_GUIDANCE', forceConsent: true }, { type: 'CONSUME', bottleId: 'silent-disciple-potion-1', confirmed: false }])('rejects exact unauthorized command shape%# before mutation', command => {
    expect(validateSilentDiscipleCommand(command)).toBe(false); expect(isSilentDiscipleAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects forged chronology, duplicated bottles or tasks, missing mastery and malformed scene data', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.silentDisciple.puppetActingAtPromotion = 99; }, t => { t.silentDisciple.bottles[0]!.source = 'old original'; },
      t => { t.silentDisciple.bottles[0]!.preparationWeek = t.silentDisciple.bottles[0]!.preparationWeek! - 1; }, t => { t.silentDisciple.bottles[1]!.id = t.silentDisciple.bottles[0]!.id; },
      t => { t.silentDisciple.preparations[1]!.taskId = t.silentDisciple.preparations[0]!.taskId; }, t => { t.silentDisciple.preparations[0]!.completedWeek = t.week + 1; },
      t => { t.silentDisciple.preparedWeek = t.week; }, t => { delete t.progression.mastery['chained.s3.short-transfiguration']; },
      t => { (t.silentDisciple as unknown as Record<string, unknown>).life = null; }, t => { (t.silentDisciple as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateSilentDiscipleState(t)).not.toThrow(); expect(validateSilentDiscipleState(t)).toBe(false); }
  });
  it('keeps key order irrelevant and preserves actual prior choices, original objects and surrendered Edrin', () => {
    const s = prepared(), before = structuredClone(s); apply(s, dose(s));
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, reorder(v)])) : value;
    expect(validateSilentDiscipleState(reorder(s) as SliceState)).toBe(true);
    const history = projectSilentDisciple(s).inheritedHistory.join(' ');
    for (const text of ['PU4-EDRIN-VALE', 'SURRENDERED', '健康60/100', '灵性13', '原伤势2处', '旧狼人、活尸、怨魂月相', '原诺兰NOLAN']) expect(history).toContain(text);
    originals(s, before); expect(s.puppet.life.note.holder).toBe('GUIDE'); expect(s.puppet.life.body.form).toBe('HUMAN');
    expect(s.puppet.life.link.state).toBe('RELEASED'); expect(s.puppet.encounter.blocks).toEqual(before.puppet.encounter.blocks);

  });
});
