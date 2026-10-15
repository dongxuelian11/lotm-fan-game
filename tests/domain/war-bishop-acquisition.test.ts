import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyWarBishopAcquisition, applyWarBishopCommand, blockWarBishopTeamCommand, createWarBishopState, hasWarBishopLock, isWarBishopAcquisitionCommand, projectWarBishop, validateWarBishopCommand, validateWarBishopState, warBishopAcquisitionBlock } from '../../src/domain/war-bishop/index.js';
import { WAR_BISHOP_CONSUMPTION_RISK, WAR_BISHOP_FORMULA_STATUS, WAR_BISHOP_PRICES, WAR_BISHOP_SOURCE_STATUS } from '../../src/domain/war-bishop/content.js';
import { WAR_BISHOP_ABILITY_IDS, WAR_BISHOP_PREPARATION_IDS, type WarBishopAcquisitionCommand } from '../../src/domain/war-bishop/types.js';

/** Original living S4 end-state; extra time/resources below are explicit unit setup, never natural-play evidence. */
function knight(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/iron-blood-knight-v01180/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.warBishop = createWarBishopState();
  s.week = Math.max(s.week, s.ironBloodKnight.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: WarBishopAcquisitionCommand, roll = 1) { const c = context(s, roll); applyWarBishopAcquisition(s, command, c); return c; }
function taught(s = knight()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of WAR_BISHOP_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.warBishop.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.warBishop.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyWarBishopAcquisition(s, command as WarBishopAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('War Bishop S3 original bottles and explicitly G professional preparation', () => {
  it('creates independent originals and hides the source before hunter S4', () => {
    const s = createSliceRun('war-bishop-hidden', sliceDefaultCreationSelection, 'war-bishop-hidden');
    expect(validateWarBishopState(s)).toBe(true);
    expect(projectWarBishop(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '', resources: null });
    expect(projectWarBishop(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createWarBishopState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'INSPECT_ROUTE', completedWeek: 1 });
    expect(s.warBishop.bottles[0]!.labourSteps).toBe(0); expect(s.warBishop.preparations).toEqual([]);
  });
  it('does not open this S3 channel for any other pathway or unsupported hunter sequence', () => {
    const s = knight();
    for (const pathwayId of ['diviner', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'sun', 'death', 'door', 'error', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const other = structuredClone(s); other.progression.pathwayId = pathwayId;
      expect(projectWarBishop(other).discovered).toBe(false); expect(projectWarBishop(other).actions).toEqual([]); reject(other, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 0]) { const other = structuredClone(s); other.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectWarBishop(other).discovered).toBe(false); }
  });
  it('keeps the inherited S3 channel read-only for a hunter S1', () => {
    const s = knight(); s.progression.sequence = 1;
    expect(projectWarBishop(s).discovered).toBe(true);
    expect(projectWarBishop(s).actions).toEqual([]);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without inventing a canonical formula, rite or new army', () => {
    const s = knight(), old = structuredClone([s.hunter, s.provoker, s.pyromaniac, s.conspirator, s.reaper, s.ironBloodKnight]);
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect([s.hunter, s.provoker, s.pyromaniac, s.conspirator, s.reaper, s.ironBloodKnight]).toEqual(old);
    expect(WAR_BISHOP_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(WAR_BISHOP_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实');
    expect(WAR_BISHOP_FORMULA_STATUS).toContain('不套用序列0的大陆战争仪式');
    expect(WAR_BISHOP_SOURCE_STATUS).toContain('不凭空生成军队'); expect(WAR_BISHOP_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectWarBishop(s)).toMatchObject({ formulaKnown: false, formula: [], preparations: WAR_BISHOP_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateWarBishopState(s)).toBe(true);
  });
  it('five actual bottle-specific jobs yield only that original800 price, never free preparation', () => {
    const s = taught(), b = s.warBishop.bottles[0]!, originalTeam = structuredClone(s.ironBloodKnight.team);
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98700, 'PLAYER', s.week]);
    expect(s.warBishop.bottles[1]!.labourSteps).toBe(0); expect(s.warBishop.preparations).toEqual([]); expect(s.warBishop.preparedWeek).toBeNull();
    expect(s.ironBloodKnight.team).toEqual(originalTeam); expect(validateWarBishopState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one bottle’s labour', () => {
    const s = taught(), b = s.warBishop.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.warBishop.bottles[1]!.id });
  });
  it('requires three distinct real professional tasks and separate current-week paid preparation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of WAR_BISHOP_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId });
      expect(s.actionsRemaining).toBe(ap - 1); expect(s.warBishop.preparations[index]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId });
      if (index < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.warBishop.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect(hasWarBishopLock(s)).toBe(true); expect(projectWarBishop(s).insideCase).toBe(true); expect(validateWarBishopState(s)).toBe(true);
  });
  it('preserves the last action as a real zero-action confirmation or non-refunding exit', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1;
    const week = s.week, cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 120]); reject(s, { type: 'PREPARE_PROMOTION' });
    applyWarBishopCommand(s, { type: 'LEAVE_PREPARATION' }, context(s));
    expect([s.actionsRemaining, s.cash, s.warBishop.preparedWeek]).toEqual([0, cash - 120, null]);
    expect(s.warBishop.bottles[0]!.status).toBe('PLAYER'); expect(hasWarBishopLock(s)).toBe(false); reject(s, dose(s));
    expect(validateWarBishopState(s)).toBe(true);
  });
  it('requires exact independent confirmation before any result draw', () => {
    const s = prepared();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }]) {
      expect(validateWarBishopCommand(command)).toBe(false); reject(s, command);
    }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles exact tier%s while preserving original S4 history and unique members', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), b = s.warBishop.bottles[0]!, original = structuredClone([s.hunter, s.provoker, s.pyromaniac, s.conspirator, s.reaper, s.ironBloodKnight]);
    const oldMastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender, tasks = structuredClone(s.warBishop.preparations);
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.warBishop.preparedWeek).toBeNull();
    expect([s.hunter, s.provoker, s.pyromaniac, s.conspirator, s.reaper, s.ironBloodKnight]).toEqual(original);
    expect(s.warBishop.preparations).toEqual(tasks); expect(s.character.gender).toBe(gender);
    for (const [id, value] of Object.entries(oldMastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 3) {
      expect(s.warBishop.ironBloodActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(WAR_BISHOP_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
      expect(projectWarBishop(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateWarBishopState(s)).toBe(true); reject(s, dose(s));
  });
  it('floors only guided potion rejection to1 and never reopens a dead run', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    expect(validateWarBishopState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('keeps the failed bottle consumed, requires paid re-preparation, and permits recovery then retry', () => {
    const s = prepared(); apply(s, dose(s), 100);
    const first = structuredClone(s.warBishop.bottles[0]), oldTeam = structuredClone(s.ironBloodKnight.team), tasks = structuredClone(s.warBishop.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100;
    const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 120, ap - 1]); apply(s, dose(s, 1));
    expect(s.warBishop.bottles[0]).toEqual(first); expect(s.ironBloodKnight.team).toEqual(oldTeam); expect(s.warBishop.preparations).toEqual(tasks);
    expect(validateWarBishopState(s)).toBe(true);
  });
  it('retains all failed originals and waits a true week for a new priced batch', () => {
    const s = qualify(taught());
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const originals = structuredClone(s.warBishop.bottles), oldTeam = structuredClone(s.ironBloodKnight.team), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.warBishop.bottles.slice(0, 3)).toEqual(originals); expect(s.warBishop.bottles).toHaveLength(6);
    expect(s.warBishop.bottles[3]).toMatchObject({ id: 'war-bishop-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(s.ironBloodKnight.team).toEqual(oldTeam);
    expect(projectWarBishop(s).actions.find(a => a.id === 'buy-war-bishop-potion-4')!.cost).toContain('6200便士');
    expect(validateWarBishopState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks prior digestion, twelve full weeks, vitality and stale preparation before drawing', () => {
    const s = prepared();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.ironBloodKnight.promotionWeek; s.ironBloodKnight.promotionWeek = s.week - 11; reject(s, dose(s)); s.ironBloodKnight.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateWarBishopState(s)).toBe(false);
    apply(s, { type: 'LEAVE_PREPARATION' }); expect(s.warBishop.preparedWeek).toBeNull();
  });
  it('does not create a new preparation while old scene or original members remain occupied', () => {
    const s = qualify(taught()); buy(s);
    s.ironBloodKnight.life.practice.form = 'STEEL'; reject(s, { type: 'PREPARE_PROMOTION' }); s.ironBloodKnight.life.practice.form = 'HUMAN';
    const m = s.ironBloodKnight.team.members[0]!; m.present = true; m.location = 'YARD'; reject(s, { type: 'PREPARE_PROMOTION' }); m.present = false; m.location = 'HOME';
    s.ironBloodKnight.life.cases['steel-load'].status = 'PREPARED'; reject(s, { type: 'PREPARE_PROMOTION' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'iron-blood-knight-potion-3' }, { type: 'PREPARE_TASK', taskId: 'CONTINENTAL_WAR' }, { type: 'LEARN_GUIDANCE', grantArmy: true }, { type: 'CONSUME', bottleId: 'war-bishop-potion-1', confirmed: false }])('rejects nonexact commands%# without mutation', command => {
    expect(validateWarBishopCommand(command)).toBe(false); expect(isWarBishopAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects malformed shape, copied bottle provenance, duplicate preparation and forged chronology', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.warBishop.ironBloodActingAtPromotion = 99; }, t => { t.warBishop.bottles[0]!.source = 'old S4 bottle'; },
      t => { t.warBishop.bottles[0]!.preparationWeek = t.warBishop.bottles[0]!.preparationWeek! - 1; }, t => { t.warBishop.bottles[1]!.id = t.warBishop.bottles[0]!.id; },
      t => { t.warBishop.preparations[1]!.taskId = t.warBishop.preparations[0]!.taskId; },
      t => { t.warBishop.preparations[0]!.completedWeek = t.week + 1; }, t => { t.warBishop.preparedWeek = t.week; },
      t => { delete t.progression.mastery[WAR_BISHOP_ABILITY_IDS[0]]; },
      t => { (t.warBishop as unknown as Record<string, unknown>).life = null; },
      t => { (t.warBishop as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateWarBishopState(t)).not.toThrow(); expect(validateWarBishopState(t)).toBe(false); }
  });
  it('keeps validation independent of serialized object key order', () => {
    const s = prepared(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, reorder(x)])) : v;
    expect(validateWarBishopState(reorder(s) as SliceState)).toBe(true);
  });

  it('exposes paid original-team rest and true-cross-week recovery after S3 without a hidden old intent', () => {
    const s = prepared(); apply(s, dose(s));
    const before = structuredClone(s.ironBloodKnight.team.members), cash = s.cash, ap = s.actionsRemaining;
    const actions = projectWarBishop(s).actions;
    expect(actions.find(a => a.command.type === 'REST_TEAM')).toMatchObject({ enabled: true, cost: expect.stringContaining('40便士') });
    expect(actions.find(a => a.command.type === 'RECOVER_TEAM')).toMatchObject({ enabled: false });
    applyWarBishopCommand(s, { type: 'REST_TEAM' }, context(s));
    expect([s.cash, s.actionsRemaining, s.ironBloodKnight.team.restRequestedWeek]).toEqual([cash - 40, ap, s.week]);
    expect(s.ironBloodKnight.team.members).toEqual(before);
    const pending = structuredClone(s);
    expect(() => applyWarBishopCommand(s, { type: 'RECOVER_TEAM' }, context(s))).toThrow('真实周'); expect(s).toEqual(pending);
    s.week++; applyWarBishopCommand(s, { type: 'RECOVER_TEAM' }, context(s));
    expect(s.ironBloodKnight.team.restRequestedWeek).toBeNull();
    expect(s.ironBloodKnight.team.members.map(m => [m.health, m.energy, m.location, m.present])).toEqual(before.map(m => [Math.min(100, m.health + 20), Math.min(20, m.energy + 8), 'HOME', false]));
    expect(s.ironBloodKnight.team.members.map(m => [m.id, m.cohortActivities, m.exerciseWeeks])).toEqual(before.map(m => [m.id, m.cohortActivities, m.exerciseWeeks]));
    expect(validateWarBishopState(s)).toBe(true);
  });
  it('blocks original-team recovery during new preparation, case or encounter and rejects extra fields', () => {
    const s = prepared();
    expect(blockWarBishopTeamCommand(s, { type: 'REST_TEAM' })).toContain('收束');
    apply(s, dose(s)); s.warBishop.life.cases['glass-cart'].status = 'PREPARED';
    expect(blockWarBishopTeamCommand(s, { type: 'REST_TEAM' })).toContain('收束');
    s.warBishop.life.cases['glass-cart'].status = 'AVAILABLE'; s.warBishop.encounter.status = 'READY';
    expect(blockWarBishopTeamCommand(s, { type: 'RECOVER_TEAM' })).toContain('收束');
    expect(validateWarBishopCommand({ type: 'REST_TEAM', free: true })).toBe(false);
  });
  it('original-team recovery never resurrects a member at zero health', () => {
    const s = prepared(); apply(s, dose(s)); const m = s.ironBloodKnight.team.members[0]!;
    m.health = 0; m.energy = 0; applyWarBishopCommand(s, { type: 'REST_TEAM' }, context(s)); s.week++;
    applyWarBishopCommand(s, { type: 'RECOVER_TEAM' }, context(s));
    expect([m.health, m.energy, m.present, m.location]).toEqual([0, 0, false, 'HOME']);
  });
  it('returns explicit preparation blockers without consuming the next original bottle', () => {
    const s = qualify(taught()); buy(s); s.cash = 119;
    expect(warBishopAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('120'); reject(s, { type: 'PREPARE_PROMOTION' });
    expect(s.warBishop.bottles[0]!.status).toBe('PLAYER');
  });
});
