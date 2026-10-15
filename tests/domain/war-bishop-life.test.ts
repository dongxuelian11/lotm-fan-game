import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { createWarBishopState } from '../../src/domain/war-bishop/index.js';
import { WAR_BISHOP_ABILITY_IDS } from '../../src/domain/war-bishop/types.js';
import { findIronBloodMember } from '../../src/domain/iron-blood-knight/team.js';
import {
  applyWarBishopActivity, blockWarBishopActivity, blockWarBishopTeamInvite, createWarBishopLifeState,
  hasWarBishopLifeLock, projectWarBishopLife, validateWarBishopActivityCommand, validateWarBishopLife,
  warBishopLifeActions, warBishopTeamReady, WAR_BISHOP_CASE_IDS, WAR_BISHOP_MEMBER_IDS,
  type WarBishopActivityCommand, type WarBishopCaseId,
} from '../../src/domain/war-bishop/life.js';
const old = JSON.parse(readFileSync('tests/fixtures/iron-blood-knight-v01180/natural.json', 'utf8')).final;
const ctx = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Directed S3 unit fixture only: immutable original 423-command S4 final is kept as the member/body authority. */
function ready(): SliceState {
  const s = migrateSliceState(structuredClone(old)); s.warBishop = createWarBishopState();
  s.warBishop.guidanceKnown = true; s.warBishop.promotionWeek = s.week; s.warBishop.ironBloodActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.promotionWeek = s.week;
  for (const id of WAR_BISHOP_ABILITY_IDS) s.progression.mastery[id] = 0;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 10000; s.spirituality = 120; s.health = 100; s.mind = 100;
  s.character.coreStats.knowledge = 30; s.character.coreStats.perception = 30; s.character.coreStats.physique = 30;
  return s;
}
function act(s: SliceState, c: WarBishopActivityCommand, roll = 1) { const context = ctx(s, roll); applyWarBishopActivity(s, c, context); expect(validateWarBishopLife(s)).toBe(true); return context; }
function reject(s: SliceState, c: unknown) { const before = structuredClone(s), context = ctx(s); expect(() => applyWarBishopActivity(s, c as WarBishopActivityCommand, context)).toThrow(); expect(s).toEqual(before); expect(context.check).not.toHaveBeenCalled(); expect(context.roll).not.toHaveBeenCalled(); }
function next(s: SliceState) { s.week++; s.date = addGameWeeks(s.date, 1); }
function begin(s: SliceState, id: WarBishopCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.warBishop.life.cases[id].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId: id });
  act(s, { type: 'PREPARE', caseId: id, method }); act(s, { type: 'INVITE_TEAM', caseId: id }); act(s, { type: 'PERFORM', caseId: id });
  if (method === 'ABILITY') act(s, { type: 'START_LINK' });
}
function close(s: SliceState, id: WarBishopCaseId) {
  if (s.warBishop.life.practice.frame.holder === 'TEAM_FAR') act(s, { type: 'CARRY_BACK' });
  if (id === 'lateral-load' && !s.warBishop.life.cases[id].attempts.at(-1)!.loadReleased) act(s, { type: 'RELEASE_LOAD' });
  if (blockWarBishopActivity(s, { type: 'RETURN_NEAR' }) === null) act(s, { type: 'RETURN_NEAR' });
  act(s, { type: 'RETURN_TOOL' });
  if (s.warBishop.life.practice.linkedMemberIds.length) act(s, { type: 'STOP_LINK' });
  act(s, { type: 'DISMISS_TEAM' }); act(s, { type: 'CLOSE', caseId: id });
}
function complete(s: SliceState, id: WarBishopCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, id, method);
  if (id === 'glass-cart') { act(s, { type: 'CARRY_OUT' }); act(s, { type: 'CARRY_BACK' }); if (method === 'ORDINARY') { act(s, { type: 'CARRY_OUT' }); act(s, { type: 'CARRY_BACK' }); } }
  if (id === 'fork-signals') { if (method === 'ORDINARY') act(s, { type: 'CHECK_SIGNALS' }); act(s, { type: 'PASS_FIRST' }); act(s, { type: 'PASS_SECOND' }); }
  if (id === 'lateral-load') { act(s, { type: 'WARN_LOAD' }); if (method === 'ABILITY') act(s, { type: 'SUPPORT_LOAD' }); }
  close(s, id); act(s, { type: 'REPORT', caseId: id });
}
const totalMastery = (s: SliceState) => Object.values(s.progression.mastery).reduce((n, v) => n + v, 0);

describe('War Bishop original five-member life practice', () => {
  it('starts from the original 30 HOME bodies without healing original 01/02 or reusing the closed invitation', () => {
    const s = ready(); expect(s.ironBloodKnight.team.members).toEqual(old.ironBloodKnight.team.members);
    expect(s.ironBloodKnight.team.members.filter(m => m.present)).toHaveLength(0);
    expect(findIronBloodMember(s, 'IB4-01')!.health).toBe(99); expect(findIronBloodMember(s, 'IB4-02')!.health).toBe(99);
    expect(projectWarBishopLife(s).members.every(m => !m.present && m.node === null)).toBe(true);
    expect(s.warBishop.life).toEqual(createWarBishopLifeState()); expect(validateWarBishopLife(s)).toBe(true);
    expect(validateWarBishopLife(JSON.parse(stableStringify(s)))).toBe(true);
  });
  it('charges the independent real invitation, keeps a single health authority and leaves original tools and skills alone', () => {
    const s = ready(), original = s.ironBloodKnight.team.members[0], historic = structuredClone(s.ironBloodKnight.life.practice), cash = s.cash, ap = s.actionsRemaining;
    act(s, { type: 'OBSERVE', caseId: 'glass-cart' }); act(s, { type: 'PREPARE', caseId: 'glass-cart', method: 'ABILITY' });
    expect(original!.present).toBe(false); reject(s, { type: 'PERFORM', caseId: 'glass-cart' });
    act(s, { type: 'INVITE_TEAM', caseId: 'glass-cart' });
    expect(s.cash).toBe(cash - 40); expect(s.actionsRemaining).toBe(ap - 3); expect(s.ironBloodKnight.team.members[0]).toBe(original);
    expect(s.ironBloodKnight.team.members.filter(m => m.present).map(m => m.id)).toEqual([...WAR_BISHOP_MEMBER_IDS]);
    expect(s.ironBloodKnight.life.practice).toEqual(historic); expect(Object.keys(original!)).not.toContain('mastery');
    reject(s, { type: 'INVITE_TEAM', caseId: 'glass-cart' });
  });
  it.each(['unwilling', 'health', 'energy', 'dead', 'already-away'] as const)('rejects an original member who is %s before spending AP/cash', condition => {
    const s = ready(); act(s, { type: 'OBSERVE', caseId: 'glass-cart' }); act(s, { type: 'PREPARE', caseId: 'glass-cart', method: 'ABILITY' });
    const member = findIronBloodMember(s, 'IB4-03')!;
    if (condition === 'unwilling') member.willing = false;
    if (condition === 'health') member.health = 49;
    if (condition === 'energy') member.energy = 5;
    if (condition === 'dead') member.health = 0;
    if (condition === 'already-away') { member.location = 'YARD'; member.present = true; }
    expect(warBishopTeamReady(s, 'HOME')).toBe(false); reject(s, { type: 'INVITE_TEAM', caseId: 'glass-cart' });
  });
  it('checks current consent and resources again at implementation and link activation', () => {
    const s = ready(); act(s, { type: 'OBSERVE', caseId: 'glass-cart' }); act(s, { type: 'PREPARE', caseId: 'glass-cart', method: 'ABILITY' }); act(s, { type: 'INVITE_TEAM', caseId: 'glass-cart' });
    const member = findIronBloodMember(s, 'IB4-04')!; member.willing = false; reject(s, { type: 'PERFORM', caseId: 'glass-cart' }); member.willing = true;
    act(s, { type: 'PERFORM', caseId: 'glass-cart' }); member.energy = 5; reject(s, { type: 'START_LINK' }); member.energy = 6; s.spirituality = 4; reject(s, { type: 'START_LINK' });
  });
  it('completes glass support with one genuine link, 6 m total travel, original frame return and separate dismissal', () => {
    const s = ready(), sp = s.spirituality, energy = s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy), oldMastery = { ...s.progression.mastery };
    begin(s, 'glass-cart', 'ABILITY'); expect(s.spirituality).toBe(sp - 5); reject(s, { type: 'START_LINK' });
    act(s, { type: 'CARRY_OUT' }); expect(s.warBishop.life.practice.frame).toMatchObject({ id: 'WB3-FRAME-1', holder: 'TEAM_FAR', cargo: 'DELIVERED' });
    reject(s, { type: 'STOP_LINK' }); reject(s, { type: 'RETURN_TOOL' }); reject(s, { type: 'DISMISS_TEAM' }); reject(s, { type: 'CLOSE', caseId: 'glass-cart' });
    act(s, { type: 'CARRY_BACK' }); act(s, { type: 'RETURN_TOOL' }); act(s, { type: 'STOP_LINK' });
    expect(s.ironBloodKnight.team.members.slice(0, 5).every(m => m.present)).toBe(true);
    act(s, { type: 'DISMISS_TEAM' }); act(s, { type: 'CLOSE', caseId: 'glass-cart' }); act(s, { type: 'REPORT', caseId: 'glass-cart' });
    const a = s.warBishop.life.cases['glass-cart'].attempts[0]!;
    expect(a).toMatchObject({ result: 'ABILITY', completedTrips: 1, toolTravelMetres: 6, elapsedSeconds: 35, linkedSeconds: 30, closed: true, dismissed: true });
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual(energy.map(e => e - 4));
    expect(s.progression.mastery['hunter.s3.coordinated-action']).toBe(8); expect(s.progression.mastery['hunter.s3.formation-link']).toBe(0);
    for (const [id, value] of Object.entries(oldMastery)) if (!WAR_BISHOP_ABILITY_IDS.includes(id as typeof WAR_BISHOP_ABILITY_IDS[number])) expect(s.progression.mastery[id]).toBe(value);
    expect(hasWarBishopLifeLock(s)).toBe(false);
  });
  it('requires two real ordinary trips and a total 12 m frame route without mastery or spirit costs', () => {
    const s = ready(), mastery = totalMastery(s), sp = s.spirituality; begin(s, 'glass-cart');
    reject(s, { type: 'START_LINK' }); act(s, { type: 'CARRY_OUT' }); expect(s.warBishop.life.cases['glass-cart'].result).toBe('NONE'); expect(s.warBishop.life.practice.frame.cargo).toBe('HALF');
    act(s, { type: 'CARRY_BACK' }); act(s, { type: 'CARRY_OUT' }); close(s, 'glass-cart'); act(s, { type: 'REPORT', caseId: 'glass-cart' });
    expect(s.warBishop.life.cases['glass-cart'].attempts[0]).toMatchObject({ completedTrips: 2, toolTravelMetres: 12, result: 'ORDINARY' }); expect(s.spirituality).toBe(sp); expect(totalMastery(s)).toBe(mastery);
  });
  it('retains half-delivered original glass across an aborted first trip and never recreates it on retry', () => {
    const s = ready(); begin(s, 'glass-cart'); act(s, { type: 'CARRY_OUT' }); close(s, 'glass-cart');
    expect(s.warBishop.life.practice.frame.cargo).toBe('HALF'); expect(s.warBishop.life.cases['glass-cart'].status).toBe('OBSERVED');
    next(s); begin(s, 'glass-cart'); expect(s.warBishop.life.practice.frame.cargo).toBe('HALF'); act(s, { type: 'CARRY_OUT' }); close(s, 'glass-cart'); act(s, { type: 'REPORT', caseId: 'glass-cart' });
    expect(s.warBishop.life.cases['glass-cart'].attempts[1]).toMatchObject({ initialCargo: 'HALF', completedTrips: 1, toolTravelMetres: 6, result: 'ORDINARY' });
  });
  it('does not silently relink a stopped ability and retains original withdrawal costs', () => {
    const s = ready(); begin(s, 'glass-cart', 'ABILITY'); const sp = s.spirituality; act(s, { type: 'STOP_LINK' }); reject(s, { type: 'START_LINK' }); reject(s, { type: 'CARRY_OUT' }); close(s, 'glass-cart');
    expect(s.spirituality).toBe(sp); expect(s.warBishop.life.cases['glass-cart'].attempts[0]).toMatchObject({ result: 'NONE', linkStarted: true });
    reject(s, { type: 'REPORT', caseId: 'glass-cart' }); reject(s, { type: 'PREPARE', caseId: 'glass-cart', method: 'ORDINARY' });
  });
  it('keeps real small injuries and fatigue after failure and permits zero-AP, zero-SP, zero-mind safety cleanup', () => {
    const s = ready(), original = findIronBloodMember(s, 'IB4-01')!; begin(s, 'glass-cart', 'ABILITY'); act(s, { type: 'CARRY_OUT' }, 100);
    expect(s.health).toBe(99); expect(original.health).toBe(98); expect(s.warBishop.life.cases['glass-cart'].attempts[0]!.failed).toBe(true);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; close(s, 'glass-cart'); expect(original.health).toBe(98); expect(s.health).toBe(99); expect(s.mind).toBe(0); expect(s.spirituality).toBe(0);
    expect(s.warBishop.life.cases['glass-cart'].attempts[0]!.memberCosts[0]).toEqual({ id: 'IB4-01', healthLoss: 1, energySpent: 3 });
  });
  it('allows cancellation immediately after invitation without pretending tools were borrowed', () => {
    const s = ready(); act(s, { type: 'OBSERVE', caseId: 'glass-cart' }); act(s, { type: 'PREPARE', caseId: 'glass-cart', method: 'ABILITY' }); act(s, { type: 'INVITE_TEAM', caseId: 'glass-cart' });
    act(s, { type: 'DISMISS_TEAM' }); act(s, { type: 'CLOSE', caseId: 'glass-cart' });
    expect(s.warBishop.life.cases['glass-cart'].attempts[0]).toMatchObject({ performed: false, returned: true, dismissed: true, closed: true, elapsedSeconds: 0 });
  });
  it('uses distinct fork positions and actual successive holders, requiring ordinary signal checks before passage', () => {
    const s = ready(); complete(s, 'glass-cart'); next(s); begin(s, 'fork-signals');
    expect(s.warBishop.life.practice.memberNodes.map(m => m.node)).toEqual(['NEAR', 'MID_A', 'FAR', 'MID_B', 'NEAR']);
    reject(s, { type: 'PASS_SECOND' }); reject(s, { type: 'PASS_FIRST' }); reject(s, { type: 'RETURN_TOOL' }); act(s, { type: 'CHECK_SIGNALS' });
    act(s, { type: 'PASS_FIRST' }); expect(s.warBishop.life.practice.card.holder).toBe('IB4-03'); expect(s.warBishop.life.practice.memberNodes[1]!.node).toBe('FAR');
    act(s, { type: 'PASS_SECOND' }); expect(s.warBishop.life.practice.card.holder).toBe('IB4-05'); reject(s, { type: 'RETURN_TOOL' }); act(s, { type: 'RETURN_NEAR' }); expect(s.warBishop.life.practice.card.holder).toBe('OWNER');
    close(s, 'fork-signals'); act(s, { type: 'REPORT', caseId: 'fork-signals' }); expect(s.warBishop.life.cases['fork-signals'].attempts[0]).toMatchObject({ signalStage: 2, toolTravelMetres: 6, signalChecked: true });
  });
  it('uses a real ability signal result and never conjures a completed pass from a failure', () => {
    const s = ready(); complete(s, 'glass-cart'); next(s); begin(s, 'fork-signals', 'ABILITY'); act(s, { type: 'PASS_FIRST' }, 100);
    expect(s.warBishop.life.practice.card.holder).toBe('IB4-01'); expect(s.warBishop.life.cases['fork-signals'].attempts[0]!.signalStage).toBe(0); reject(s, { type: 'PASS_SECOND' }); close(s, 'fork-signals');
    next(s); begin(s, 'fork-signals', 'ABILITY'); act(s, { type: 'PASS_FIRST' }); act(s, { type: 'PASS_SECOND' }); close(s, 'fork-signals'); act(s, { type: 'REPORT', caseId: 'fork-signals' });
    expect(s.warBishop.life.cases['fork-signals'].attempts).toHaveLength(2); expect(s.progression.mastery['hunter.s3.coordinated-action']).toBe(8);
  });
  it('requires actual machine warning, real five-point support, unloading and physical return', () => {
    const s = ready(); complete(s, 'glass-cart'); next(s); complete(s, 'fork-signals'); next(s); begin(s, 'lateral-load', 'ABILITY');
    reject(s, { type: 'SUPPORT_LOAD' }); reject(s, { type: 'RELEASE_LOAD' }); reject(s, { type: 'RETURN_NEAR' }); act(s, { type: 'WARN_LOAD' }); act(s, { type: 'SUPPORT_LOAD' });
    expect(s.warBishop.life.practice.load).toMatchObject({ id: 'WB3-LOAD-1', holder: 'RIG', phase: 'HELD' }); reject(s, { type: 'SUPPORT_LOAD' }); reject(s, { type: 'RETURN_NEAR' }); act(s, { type: 'RELEASE_LOAD' }); act(s, { type: 'RETURN_NEAR' }); close(s, 'lateral-load'); act(s, { type: 'REPORT', caseId: 'lateral-load' });
    expect(s.progression.mastery['hunter.s3.formation-link']).toBe(8); expect(s.warBishop.life.practice.load).toMatchObject({ holder: 'RACK', phase: 'RELEASED' });
  });
  it('keeps the fixed mechanical failure harmless to life but not free of injuries, and does not award mastery', () => {
    const s = ready(); complete(s, 'glass-cart'); next(s); complete(s, 'fork-signals'); next(s); begin(s, 'lateral-load', 'ABILITY'); act(s, { type: 'WARN_LOAD' }); act(s, { type: 'SUPPORT_LOAD' }, 100);
    expect(s.health).toBe(99); expect(findIronBloodMember(s, 'IB4-01')!.health).toBe(98); expect(s.progression.mastery['hunter.s3.formation-link']).toBe(0); close(s, 'lateral-load'); reject(s, { type: 'REPORT', caseId: 'lateral-load' });
  });
  it('allows three ordinary comparisons plus reflection to reach 100 acting without inventing ability mastery', () => {
    const s = ready(), before = totalMastery(s), sp = s.spirituality;
    for (const id of WAR_BISHOP_CASE_IDS) { if (id !== 'glass-cart') next(s); complete(s, id); }
    act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(totalMastery(s)).toBe(before); expect(s.spirituality).toBe(sp); expect(s.health).toBe(100); expect(findIronBloodMember(s, 'IB4-01')!.health).toBe(99);
    expect(s.warBishop.life.practice.frame.cargo).toBe('DELIVERED'); expect(s.warBishop.life.practice.card.holder).toBe('RACK'); expect(s.warBishop.life.practice.load.phase).toBe('RELEASED'); reject(s, { type: 'REFLECT' });
  });
  it('enforces one actual attendance per real week across life and the new encounter', () => {
    const s = ready(); complete(s, 'glass-cart'); expect(blockWarBishopTeamInvite(s)).toContain('真实周');
    act(s, { type: 'OBSERVE', caseId: 'fork-signals' }); act(s, { type: 'PREPARE', caseId: 'fork-signals', method: 'ORDINARY' }); reject(s, { type: 'INVITE_TEAM', caseId: 'fork-signals' });
    act(s, { type: 'WITHDRAW', caseId: 'fork-signals' }); next(s); expect(blockWarBishopTeamInvite(s)).toBeNull();
    s.warBishop.encounter.invitedWeek = s.week; expect(blockWarBishopTeamInvite(s)).toContain('真实周');
  });
  it('reserves one remaining AP for the real invitation instead of entering a last-AP preparation lock', () => {
    const s = ready(); act(s, { type: 'OBSERVE', caseId: 'glass-cart' }); s.actionsRemaining = 1;
    reject(s, { type: 'PREPARE', caseId: 'glass-cart', method: 'ABILITY' });
    expect(hasWarBishopLifeLock(s)).toBe(false); expect(s.warBishop.life.cases['glass-cart'].status).toBe('OBSERVED');
    expect(warBishopLifeActions(s).filter(a => a.command.type === 'PREPARE').every(a => !a.enabled && a.cost.includes('余2行动'))).toBe(true);
    s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'glass-cart', method: 'ABILITY' }); expect(s.actionsRemaining).toBe(1);
    act(s, { type: 'INVITE_TEAM', caseId: 'glass-cart' }); expect(s.actionsRemaining).toBe(0);
    act(s, { type: 'DISMISS_TEAM' }); act(s, { type: 'CLOSE', caseId: 'glass-cart' }); expect(hasWarBishopLifeLock(s)).toBe(false);
  });
  it('keeps prepared and active scenes locked and all scene cleanup available when the invitation spends the last AP', () => {
    const s = ready(); s.actionsRemaining = 3; begin(s, 'glass-cart', 'ABILITY'); expect(s.actionsRemaining).toBe(0); expect(hasWarBishopLifeLock(s)).toBe(true); act(s, { type: 'CARRY_OUT' }); close(s, 'glass-cart'); expect(hasWarBishopLifeLock(s)).toBe(false);
    expect(warBishopLifeActions(s).find(a => a.command.type === 'REPORT')!.enabled).toBe(false);
  });
  it('projects identical public arrays after canonical SQLite JSON changes case-object key order', () => {
    const s = ready(); const firstWeek = s.week;
    begin(s, 'glass-cart', 'ABILITY'); act(s, { type: 'CARRY_OUT' }, 100); close(s, 'glass-cart');
    next(s); complete(s, 'glass-cart'); next(s); complete(s, 'fork-signals'); next(s); complete(s, 'lateral-load');
    const before = structuredClone(s), expected = projectWarBishopLife(s);
    const reordered = JSON.parse(stableStringify(s)) as SliceState;
    expect(Object.keys(reordered.warBishop.life.cases)).toEqual(['fork-signals', 'glass-cart', 'lateral-load']);
    expect(expected.invitationWeeks).toEqual([firstWeek, firstWeek + 1, firstWeek + 2, firstWeek + 3]);
    expect(validateWarBishopLife(reordered)).toBe(true);
    expect(projectWarBishopLife(reordered)).toEqual(expected);
    expect(warBishopLifeActions(reordered)).toEqual(warBishopLifeActions(s));
    expect(s).toEqual(before);
  });
  it('rejects unknown command fields, hidden methods and forged members without mutation or RNG', () => {
    const s = ready(); for (const command of [{ type: 'START_LINK', memberIds: ['IB4-06'] }, { type: 'INVITE_TEAM', caseId: 'glass-cart', free: true }, { type: 'PREPARE', caseId: 'glass-cart', method: 'ARMY' }, { type: 'PASS_FIRST', target: 'FAR' }]) { expect(validateWarBishopActivityCommand(command)).toBe(false); reject(s, command); }
  });
  it('rejects copied health fields, wrong tool identity, remote original-card teleport and duplicate attendance in saved states', () => {
    const s = ready(); const bad = structuredClone(s); (bad.warBishop.life as unknown as Record<string, unknown>).members = [{ health: 100 }]; expect(validateWarBishopLife(bad)).toBe(false);
    const tool = structuredClone(s); (tool.warBishop.life.practice.frame as unknown as { id: string }).id = 'IB4-BEAM-1'; expect(validateWarBishopLife(tool)).toBe(false);
    complete(s, 'glass-cart'); next(s); begin(s, 'fork-signals'); const teleport = structuredClone(s); teleport.warBishop.life.practice.card.holder = 'IB4-05'; expect(validateWarBishopLife(teleport)).toBe(false);
    const duplicate = structuredClone(s); duplicate.warBishop.encounter.invitedWeek = duplicate.week; expect(validateWarBishopLife(duplicate)).toBe(false);
  });
  it('keeps all unrelated 21 pathways outside S3 commands and hides undiscovered life stories', () => {
    const s = ready(); s.progression.pathwayId = 'seer'; reject(s, { type: 'OBSERVE', caseId: 'glass-cart' }); expect(warBishopLifeActions(s)).toEqual([]); expect(projectWarBishopLife(s).cases).toEqual([]); expect(projectWarBishopLife(s).members).toEqual([]);
  });
});
