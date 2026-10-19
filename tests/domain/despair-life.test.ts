import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyDespairCommand, createDespairState, validateDespairState } from '../../src/domain/despair/index.js';
import { applyDespairActivity, createDespairLifeState, despairActivityReason, despairLifeActions, hasDespairLifeLock, projectDespairLife, validateDespairActivityCommand, validateDespairLife, DESPAIR_CASE_IDS, type DespairActivityCommand, type DespairCaseId } from '../../src/domain/despair/life.js';
import type { DespairAbilityId } from '../../src/domain/despair/types.js';

function context(s: SliceState) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 })) };
  const award = vi.fn((id: DespairAbilityId, amount = 8) => { s.progression.mastery[id] = (s.progression.mastery[id] ?? 0) + amount; });
  return { ctx, award };
}
function oldS5(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/pain-v01080/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.despair = createDespairState();
  const week = Math.max(s.week, s.pain.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28;
  return s;
}
function promoted() {
  const s = oldS5(), c = context(s).ctx;
  applyDespairCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyDespairCommand(s, { type: 'BUY_POTION', bottleId: 'despair-potion-1' }, c);
  applyDespairCommand(s, { type: 'CONSUME', bottleId: 'despair-potion-1', confirmed: true }, c);
  return s;
}
function act(s: SliceState, command: DespairActivityCommand) {
  const c = context(s); applyDespairActivity(s, command, c.ctx, c.award);
  expect(validateDespairLife(s), `invalid life after ${JSON.stringify(command)}`).toBe(true);
  expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
  return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDespairActivity(s, command as DespairActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: DespairCaseId) {
  if (s.despair.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
}
function room(s: SliceState) {
  begin(s, 'room-clearance'); act(s, { type: 'PERFORM', caseId: 'room-clearance' }); act(s, { type: 'WALK_OUT', caseId: 'room-clearance' }); act(s, { type: 'CLOSE', caseId: 'room-clearance' }); act(s, { type: 'REPORT', caseId: 'room-clearance' });
}
function scenario(s: SliceState) {
  begin(s, 'stop-and-check'); act(s, { type: 'PERFORM', caseId: 'stop-and-check', plan: 'PAUSE_EXPOSURE' }); act(s, { type: 'CLOSE', caseId: 'stop-and-check' }); act(s, { type: 'REPORT', caseId: 'stop-and-check' });
}
function delivered(s: SliceState) {
  begin(s, 'care-followup'); act(s, { type: 'PERFORM', caseId: 'care-followup' }); act(s, { type: 'RETURN_ROUTE', caseId: 'care-followup' }); act(s, { type: 'CLOSE', caseId: 'care-followup' });
}
const nextWeek = (s: SliceState) => { s.week += 1; s.date = addGameWeeks(s.date, 1); };
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(args => args.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.assassin, s.instigator, s.witch, s.pleasure, s.pain, s.combatHistory, s.world, s.town, s.character]);
function finished() {
  const s = promoted(); room(s); scenario(s); delivered(s); nextWeek(s);
  act(s, { type: 'FOLLOW_UP', caseId: 'care-followup' }); act(s, { type: 'RETURN_ROUTE', caseId: 'care-followup' }); act(s, { type: 'CLOSE', caseId: 'care-followup' }); act(s, { type: 'REPORT', caseId: 'care-followup' }); act(s, { type: 'REFLECT' }); return s;
}
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)]));
  return value;
}

describe('Despair finite ordinary emergency exercises', () => {
  it('is pristine and hidden before promotion, then exposes three distinct original scenes', () => {
    const old = oldS5(); expect(validateDespairLife(old)).toBe(true); expect(despairLifeActions(old)).toEqual([]);
    expect(projectDespairLife(old)).toEqual({ cases: [], insideCase: false, environment: '', practice: null });
    const s = promoted(); expect(s.despair.life).toEqual(createDespairLifeState()); expect(validateDespairState(s)).toBe(true);
    const p = projectDespairLife(s); expect(p.cases.map(c => c.id)).toEqual([...DESPAIR_CASE_IDS]); expect(new Set(p.cases.map(c => c.story)).size).toBe(3);
    expect(p.cases.every(c => c.observations.length === 0)).toBe(true); expect(p.environment).toContain('能力掌握奖励');
    expect(p.practice!.room).toContain('成年拉维妮'); expect(p.practice!.room).toContain('成年玛拉·维尔'); expect(p.practice!.care).toContain('成年联络员伊迪丝·罗恩');
  });

  it.each([null, {}, { type: 'OBSERVE', caseId: 'unknown' }, { type: 'PREPARE', caseId: 'room-clearance', method: 'ABILITY' }, { type: 'PERFORM', caseId: 'room-clearance', route: 'BLOCKED_CORRIDOR' }, { type: 'PERFORM', caseId: 'stop-and-check' }, { type: 'PERFORM', caseId: 'stop-and-check', plan: 'INFECT_VOLUNTEER' }, { type: 'PERFORM', caseId: 'care-followup', cure: true }, { type: 'WALK_OUT', caseId: 'care-followup' }, { type: 'FOLLOW_UP', caseId: 'room-clearance' }, { type: 'RETURN_ROUTE', caseId: 'room-clearance' }, { type: 'REFLECT', acting: 100 }])('rejects unbounded, magical or malformed commands before mutation: %j', command => {
    expect(validateDespairActivityCommand(command)).toBe(false); reject(promoted(), command);
  });

  it('requires the actual preceding report and rejects premature completion', () => {
    const s = promoted(); reject(s, { type: 'OBSERVE', caseId: 'stop-and-check' }); reject(s, { type: 'OBSERVE', caseId: 'care-followup' }); reject(s, { type: 'REFLECT' });
    begin(s, 'room-clearance'); reject(s, { type: 'REPORT', caseId: 'room-clearance' }); reject(s, { type: 'WALK_OUT', caseId: 'room-clearance' });
  });

  it('ordinary reports and real next-week reflection grant exactly100 without mastery, disease or old-history changes', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery), ap = s.actionsRemaining, cash = s.cash, vitals = [s.health, s.mind, s.spirituality, s.seer.pollution];
    room(s); scenario(s); delivered(s); expect(s.progression.acting).toBe(50); nextWeek(s);
    act(s, { type: 'FOLLOW_UP', caseId: 'care-followup' }); act(s, { type: 'RETURN_ROUTE', caseId: 'care-followup' }); act(s, { type: 'CLOSE', caseId: 'care-followup' }); act(s, { type: 'REPORT', caseId: 'care-followup' }); act(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.actionsRemaining, s.cash]).toEqual([100, ap - 14, cash - 40]); expect(s.progression.mastery).toEqual(mastery);
    expect([s.health, s.mind, s.spirituality, s.seer.pollution]).toEqual(vitals); expect(originals(s)).toEqual(old); expect(validateDespairState(s)).toBe(true);
    expect(s.despair.life.player).toEqual({ location: 'OUTER_MARK', roomWalks: 1, careWalks: 4, distanceMetres: 16 });
    for (const caseId of DESPAIR_CASE_IDS) reject(s, { type: 'REPORT', caseId }); reject(s, { type: 'REFLECT' });
  });

  it('uses the original blocked cart and board and distinguishes each actual person’s four-metre walk', () => {
    const s = promoted(); begin(s, 'room-clearance'); const l = s.despair.life;
    expect(l.room).toMatchObject({ cartId: 'DP4-CART-1', cartLocation: 'BLOCKED_CORRIDOR', boardId: 'DP4-BOARD-1', boardLocation: 'CLEAR_EXIT', consented: true });
    expect(l.room.mara).toEqual({ location: 'INNER_MARK', walks: 2, distanceMetres: 8 }); expect(l.player.location).toBe('INNER_MARK'); expect(hasDespairLifeLock(s)).toBe(false);
    act(s, { type: 'PERFORM', caseId: 'room-clearance' }); expect(l.room.raviney).toEqual({ location: 'OUTER_MARK', walks: 1, distanceMetres: 4 }); expect(l.room.mara.distanceMetres).toBe(12);
    expect(l.player.location).toBe('INNER_MARK'); expect(l.player.distanceMetres).toBe(0); expect(hasDespairLifeLock(s)).toBe(true); reject(s, { type: 'CLOSE', caseId: 'room-clearance' });
    s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0; act(s, { type: 'WALK_OUT', caseId: 'room-clearance' }); act(s, { type: 'CLOSE', caseId: 'room-clearance' });
    expect(l.player.distanceMetres).toBe(4); expect(l.room.boardLocation).toBe('RACK'); expect(l.room.cartLocation).toBe('BLOCKED_CORRIDOR'); expect(hasDespairLifeLock(s)).toBe(false);
    s.actionsRemaining = 1; s.mind = 1; const report = act(s, { type: 'REPORT', caseId: 'room-clearance' }); expect(notes(report)).toContain('走过4米'); expect(notes(report)).toContain('走过12米');
  });

  it('withdraws an open room through actual ordinary walks without rewarding completion and can retry', () => {
    const s = promoted(); begin(s, 'room-clearance'); act(s, { type: 'PERFORM', caseId: 'room-clearance' }); s.actionsRemaining = 0;
    act(s, { type: 'WITHDRAW', caseId: 'room-clearance' }); expect(s.despair.life.player.location).toBe('OUTER_MARK'); expect(s.despair.life.player.distanceMetres).toBe(4); expect(s.progression.acting).toBe(0); expect(hasDespairLifeLock(s)).toBe(false);
    expect(s.despair.life.cases['room-clearance']).toMatchObject({ status: 'OBSERVED', attempts: 1, closes: 1, withdrawals: 1, taskComplete: false }); reject(s, { type: 'REPORT', caseId: 'room-clearance' });
    s.actionsRemaining = 10; room(s); expect(s.despair.life.player.distanceMetres).toBe(12); expect(s.despair.life.room.evacuations).toBe(2); expect(s.progression.acting).toBe(25);
  });

  it('canceling staged board preparation retains Mara’s real round trips', () => {
    const s = promoted(); begin(s, 'room-clearance'); s.actionsRemaining = 0; s.mind = 0;
    act(s, { type: 'WITHDRAW', caseId: 'room-clearance' }); expect(s.despair.life.room.mara.distanceMetres).toBe(16); expect(s.despair.life.player.distanceMetres).toBe(0);
    expect(s.despair.life.room.boardLocation).toBe('RACK'); expect(hasDespairLifeLock(s)).toBe(false); expect(s.progression.acting).toBe(0);
  });

  it('actually buys three numbered blank slips, never medical reagents, and preserves paid papers on withdrawal', () => {
    const s = promoted(); room(s); act(s, { type: 'OBSERVE', caseId: 'stop-and-check' }); s.cash = 39;
    reject(s, { type: 'PREPARE', caseId: 'stop-and-check', method: 'ORDINARY' }); s.cash = 40;
    act(s, { type: 'PREPARE', caseId: 'stop-and-check', method: 'ORDINARY' }); expect(s.cash).toBe(0); expect(s.despair.life.scenario.paperBatches[0]!.slips).toEqual([1, 2, 3].map(n => ({ id: `DP4-SLIP-1-${n}`, written: false, location: 'TABLETOP' })));
    s.actionsRemaining = 0; act(s, { type: 'WITHDRAW', caseId: 'stop-and-check' }); expect(s.cash).toBe(0); expect(s.despair.life.scenario.paperBatches[0]!.slips.every(p => !p.written && p.location === 'SUPPLY')).toBe(true); expect(hasDespairLifeLock(s)).toBe(false);
  });

  it('wrong cure choice consumes a real action without harm or completion, then requires a separate correcting command', () => {
    const s = promoted(); room(s); begin(s, 'stop-and-check'); const ap = s.actionsRemaining, health = s.health, mastery = structuredClone(s.progression.mastery);
    act(s, { type: 'PERFORM', caseId: 'stop-and-check', plan: 'DECLARE_ALL_CURED' }); const x = s.despair.life.scenario;
    expect([s.actionsRemaining, s.health, s.progression.acting]).toEqual([ap - 1, health, 25]); expect(s.progression.mastery).toEqual(mastery); expect(x.errors).toBe(1); expect(x.recordSlipId).toBeNull(); expect(x.overlayLocation).toBe('TABLETOP'); reject(s, { type: 'REPORT', caseId: 'stop-and-check' });
    act(s, { type: 'PERFORM', caseId: 'stop-and-check', plan: 'PAUSE_EXPOSURE' }); expect(s.actionsRemaining).toBe(ap - 2); expect(x.overlayLocation).toBe('STORAGE'); expect(x.recordSlipId).toBe('DP4-SLIP-1-1'); expect(x.paperBatches[0]!.slips.map(p => p.written)).toEqual([true, false, false]);
    reject(s, { type: 'REPORT', caseId: 'stop-and-check' }); act(s, { type: 'CLOSE', caseId: 'stop-and-check' }); expect(x.paperBatches[0]!.slips.map(p => p.location)).toEqual(['TRAY', 'SUPPLY', 'SUPPLY']); act(s, { type: 'REPORT', caseId: 'stop-and-check' }); expect(s.progression.acting).toBe(50); expect(x.errors).toBe(1);
  });

  it('can clean up an exhausted wrong-choice attempt and buy distinct replacement blank papers next week', () => {
    const s = promoted(); room(s); begin(s, 'stop-and-check'); s.actionsRemaining = 1;
    act(s, { type: 'PERFORM', caseId: 'stop-and-check', plan: 'DECLARE_ALL_CURED' }); reject(s, { type: 'PERFORM', caseId: 'stop-and-check', plan: 'PAUSE_EXPOSURE' });
    act(s, { type: 'CLOSE', caseId: 'stop-and-check' }); expect(hasDespairLifeLock(s)).toBe(false); expect(s.despair.life.cases['stop-and-check'].status).toBe('OBSERVED'); nextWeek(s); s.actionsRemaining = 10;
    scenario(s); const x = s.despair.life.scenario; expect(x.paperBatches).toHaveLength(2); expect(x.paperBatches[0]!.slips.every(p => !p.written && p.location === 'SUPPLY')).toBe(true); expect(x.recordSlipId).toBe('DP4-SLIP-2-1'); expect(x.errors).toBe(1);
  });

  it('actually hands over and gets back the original folder and original written record, with separate returns', () => {
    const s = promoted(); room(s); scenario(s); const recordId = s.despair.life.scenario.recordSlipId; begin(s, 'care-followup');
    expect(s.despair.life.care).toMatchObject({ recordSlipId: recordId, folderLocation: 'PLAYER', consented: true, handovers: 0 });
    act(s, { type: 'PERFORM', caseId: 'care-followup' }); const l = s.despair.life;
    expect(l.player).toMatchObject({ location: 'CARE_DOORWAY', careWalks: 1, distanceMetres: 7 }); expect(l.care).toMatchObject({ folderId: 'DP4-FOLDER-1', handovers: 1, returns: 1, deliveredWeek: s.week, followUpDueWeek: s.week + 1, recordSlipId: recordId });
    reject(s, { type: 'CLOSE', caseId: 'care-followup' }); reject(s, { type: 'REPORT', caseId: 'care-followup' });
    s.actionsRemaining = 0; act(s, { type: 'RETURN_ROUTE', caseId: 'care-followup' }); act(s, { type: 'CLOSE', caseId: 'care-followup' });
    expect(l.player.distanceMetres).toBe(10); expect(l.care.folderLocation).toBe('RACK'); expect(l.cases['care-followup'].status).toBe('WAITING'); expect(hasDespairLifeLock(s)).toBe(false);
  });

  it('requires a real later week, then a second physical trip, rather than a click pretending to wait or cure', () => {
    const s = promoted(); room(s); scenario(s); delivered(s); const scheduled = s.week + 1;
    reject(s, { type: 'FOLLOW_UP', caseId: 'care-followup' }); expect(despairActivityReason(s, { type: 'FOLLOW_UP', caseId: 'care-followup' })).toContain(`第${scheduled}真实周`);
    nextWeek(s); const ap = s.actionsRemaining; const c = act(s, { type: 'FOLLOW_UP', caseId: 'care-followup' }); expect(s.actionsRemaining).toBe(ap - 1);
    expect(s.despair.life.care).toMatchObject({ followUpWeek: scheduled, handovers: 2, returns: 2, expected: 'NO_AUTOMATIC_CURE', observed: 'FICTIONAL_SYMPTOMS_REMAIN' }); expect(notes(c)).toContain('本人没有疾病');
    reject(s, { type: 'REPORT', caseId: 'care-followup' }); reject(s, { type: 'CLOSE', caseId: 'care-followup' });
    act(s, { type: 'RETURN_ROUTE', caseId: 'care-followup' }); act(s, { type: 'CLOSE', caseId: 'care-followup' }); act(s, { type: 'REPORT', caseId: 'care-followup' }); reject(s, { type: 'FOLLOW_UP', caseId: 'care-followup' });
    expect(s.despair.life.scenario.paperBatches.flatMap(b => b.slips).filter(p => p.written)).toHaveLength(1);
  });

  it('withdrawing at the care door physically returns while preserving the real next-week appointment without rewards', () => {
    const s = promoted(); room(s); scenario(s); begin(s, 'care-followup'); act(s, { type: 'PERFORM', caseId: 'care-followup' }); const due = s.despair.life.care.followUpDueWeek;
    s.actionsRemaining = 0; act(s, { type: 'WITHDRAW', caseId: 'care-followup' }); expect(s.despair.life.player).toMatchObject({ location: 'OUTER_MARK', careWalks: 2 }); expect(s.despair.life.care).toMatchObject({ folderLocation: 'RACK', followUpDueWeek: due, handovers: 1, returns: 1 }); expect(hasDespairLifeLock(s)).toBe(false); expect(s.progression.acting).toBe(50);
    nextWeek(s); s.actionsRemaining = 1; act(s, { type: 'FOLLOW_UP', caseId: 'care-followup' });
  });

  it('public last-action board preparation advances the actual week without erasing safe physical staging', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'room-clearance' }); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, next = applySliceIntent(s, { type: 'DESPAIR', command: { type: 'PREPARE', caseId: 'room-clearance', method: 'ORDINARY' } });
    expect(next.week).toBe(week + 1); expect(next.despair.life.cases['room-clearance'].status).toBe('PREPARED'); expect(next.despair.life.room.boardLocation).toBe('CLEAR_EXIT'); expect(hasDespairLifeLock(next)).toBe(false); expect(validateDespairLife(next)).toBe(true);
  });

  it('public last-action room performance holds the pulse until the actual walk and zero-AP closure', () => {
    const s = promoted(); begin(s, 'room-clearance'); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, performed = applySliceIntent(s, { type: 'DESPAIR', command: { type: 'PERFORM', caseId: 'room-clearance' } });
    expect([performed.week, performed.actionsRemaining]).toEqual([week, 0]); expect(() => applySliceIntent(performed, { type: 'ACTION', action: 'REST' })).toThrow();
    const walked = applySliceIntent(performed, { type: 'DESPAIR', command: { type: 'WALK_OUT', caseId: 'room-clearance' } }); expect(walked.week).toBe(week);
    const closed = applySliceIntent(walked, { type: 'DESPAIR', command: { type: 'CLOSE', caseId: 'room-clearance' } }); expect(closed.week).toBe(week + 1); expect(hasDespairLifeLock(closed)).toBe(false); expect(validateDespairLife(closed)).toBe(true);
  });

  it('public safe waiting permits normal REST to advance a week and make the promised follow-up playable', () => {
    const s = promoted(); room(s); scenario(s); delivered(s); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, rested = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(rested.week).toBe(week + 1); expect(rested.despair.life.cases['care-followup'].status).toBe('WAITING'); expect(hasDespairLifeLock(rested)).toBe(false);
    expect(despairLifeActions(rested).find(a => a.command.type === 'FOLLOW_UP')?.enabled).toBe(true); expect(validateDespairLife(rested)).toBe(true);
  });

  it('projects only actual positions, paper statuses, finite costs and actionable safe-wait information', () => {
    const s = promoted(); room(s); scenario(s); delivered(s); const p = projectDespairLife(s);
    expect(p.insideCase).toBe(false); expect(p.practice!.room).toContain('DP4-CART-1'); expect(p.practice!.scenario).toContain('DP4-CARD-1/DP4-CARD-2/DP4-CARD-3'); expect(p.practice!.cost).toContain('40便士'); expect(p.practice!.cost).toContain('写好1张'); expect(p.practice!.route).toContain('10米'); expect(p.practice!.care).toContain('接收并交回1/1次');
    expect(p.cases[2]!.contactOpen).toContain('不锁住正常休养'); expect(despairLifeActions(s).find(a => a.command.type === 'FOLLOW_UP')).toMatchObject({ enabled: false });
    expect(despairLifeActions(s).every(a => validateDespairActivityCommand(a.command))).toBe(true);
  });

  it('save validation rejects invented original objects, teleporting, duplicated paper, premature visits and reward forgery', () => {
    const base = finished();
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.despair.life.room.cartId = 'COPY' as 'DP4-CART-1'; },
      s => { s.despair.life.room.cartLocation = 'REMOVED' as 'BLOCKED_CORRIDOR'; },
      s => { s.despair.life.room.mara.distanceMetres += 4; },
      s => { s.despair.life.player.distanceMetres = 0; },
      s => { s.despair.life.player.location = 'CARE_DOORWAY'; },
      s => { s.despair.life.scenario.cardIds[2] = 'DP4-CARD-1' as 'DP4-CARD-3'; },
      s => { s.despair.life.scenario.paperBatches[0]!.slips[1].written = true; },
      s => { s.despair.life.scenario.paperBatches[0]!.slips[0].location = 'TRAY'; },
      s => { s.despair.life.care.returns = 0; },
      s => { s.despair.life.care.followUpWeek = s.despair.life.care.deliveredWeek; },
      s => { s.despair.life.care.observed = 'REAL_CURE' as 'NOT_CHECKED'; },
      s => { s.despair.life.care.recordSlipId = 'COPY'; },
      s => { s.seer.completedSources.push('despair-reflection'); },
      s => { s.progression.acting = 75; },
      s => { (s.despair.life as unknown as Record<string, unknown>).plagueMastery = 50; },
    ];
    expect(validateDespairLife(base)).toBe(true);
    for (const mutate of mutations) { const s = structuredClone(base); mutate(s); expect(validateDespairLife(s)).toBe(false); }
    const reordered = reverseKeys(base) as SliceState; expect(stableStringify(reordered)).toBe(stableStringify(base)); expect(validateDespairLife(reordered)).toBe(true);
  });
});
