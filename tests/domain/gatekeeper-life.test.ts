import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyGatekeeperCommand, createGatekeeperState, validateGatekeeperState } from '../../src/domain/gatekeeper/index.js';
import { applyGatekeeperActivity, isGatekeeperActivity, gatekeeperActions, gatekeeperCases, gatekeeperInside, gatekeeperCompanion, gatekeeperPractice, GATEKEEPER_ENVIRONMENT, validateGatekeeperLife } from '../../src/domain/gatekeeper/life.js';
import { GATEKEEPER_ABILITY_IDS, GATEKEEPER_CASE_IDS, type GatekeeperActivityCommand, type GatekeeperCaseId } from '../../src/domain/gatekeeper/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[GATEKEEPER_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function spiritGuide(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/spirit-guide-v0820/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.gatekeeper = createGatekeeperState();
  const week = Math.max(s.week, s.spiritGuide.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function promoted(): SliceState {
  const s = spiritGuide(), c = context(s).ctx;
  applyGatekeeperCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyGatekeeperCommand(s, { type: 'BUY_POTION', bottleId: s.gatekeeper.bottles[0]!.id }, c);
  applyGatekeeperCommand(s, { type: 'CONSUME', bottleId: s.gatekeeper.bottles[0]!.id, confirmed: true }, c);
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function act(s: SliceState, command: GatekeeperActivityCommand, roll = 1) { const c = context(s, roll); applyGatekeeperActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyGatekeeperActivity(s, command as GatekeeperActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: GatekeeperCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.gatekeeper.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: GatekeeperCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  if (s.gatekeeper.practice.marker === 'RECIPIENT') act(s, { type: 'RETRIEVE_MARKER' });
  return act(s, { type: 'REPORT', caseId });
}
function recruited() { const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'resting-place' }); act(s, { type: 'INVITE_SPIRIT' }); return s; }
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.corpsecollector, s.gravedigger, s.spiritmedium, s.spiritGuide, s.world, s.town]);


describe('Gatekeeper same-original voluntary residence, real marker and finite local door', () => {
  it('starts without a resident spirit and preserves the completed old one-letter history', () => {
    const before = spiritGuide();
    expect(gatekeeperActions(before)).toEqual([]); expect(gatekeeperCases(before)).toEqual([]);
    expect(gatekeeperCompanion(before)).toBeNull(); expect(gatekeeperPractice(before)).toBeNull(); expect(validateGatekeeperLife(before)).toBe(true);
    const s = promoted();
    expect(s.spiritGuide.messenger).toMatchObject({ recruited: true, deliveries: 1, letter: 'RECIPIENT', feePaid: 12 });
    expect(s.gatekeeper.companion).toEqual({ source: 'SG6-GRAY-FEATHER', status: 'OUTSIDE', agreementWeek: null, entries: 0, releases: 0, deployments: 0, recalls: 0, feePaid: 0 });
    expect(s.gatekeeper.inviteAttemptWeek).toBeNull();
    expect(s.gatekeeper.practice).toEqual({ marker: 'DESK', gateOpen: false, deliveries: 0, returns: 0, gateTests: 0 });
    expect(gatekeeperCases(s).map(p => p.id)).toEqual([...GATEKEEPER_CASE_IDS]);
    expect(gatekeeperCases(s).every(p => p.observations.length === 0)).toBe(true);
    expect(gatekeeperInside(s)).toBe(false); expect(validateGatekeeperState(s)).toBe(true);
    expect(GATEKEEPER_ENVIRONMENT).toContain('晋升不附赠灵'); expect(GATEKEEPER_ENVIRONMENT).toContain('原创G');
  });

  it('accepts exact activity types and rejects invented originals or extra fields before mutation', () => {
    for (const type of ['INVITE_SPIRIT', 'RELEASE_SPIRIT', 'RECALL_SPIRIT', 'RETRIEVE_MARKER'] as const) expect(isGatekeeperActivity({ type })).toBe(true);
    for (const command of [null, {}, { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'resting-place', method: 'BANISH' }, { type: 'INVITE_SPIRIT', spirit: 'new-spirit' }, { type: 'RECALL_SPIRIT', caseId: 'shared-task' }, { type: 'RELEASE_SPIRIT', source: 'SG6-GRAY-FEATHER' }, { type: 'RETRIEVE_MARKER', teleport: true }, { type: 'PERFORM', caseId: 'controlled-threshold', target: 'keeper' }, { type: 'CLOSE', caseId: 'shared-task', returnMarker: true }, { type: 'REPORT', caseId: 'shared-task', truth: true }, { type: 'REFLECT', extra: true }]) reject(promoted(), command);
  });

  it('observes independent plans without recruiting, moving the body to the alcove or extending the old contract', () => {
    const s = promoted(), old = originals(s), spirit = s.spirituality;
    reject(s, { type: 'INVITE_SPIRIT' });
    act(s, { type: 'OBSERVE', caseId: 'controlled-threshold' }); act(s, { type: 'OBSERVE', caseId: 'shared-task' });
    expect(s.gatekeeper.companion.entries).toBe(0); expect(gatekeeperInside(s)).toBe(false);
    act(s, { type: 'OBSERVE', caseId: 'resting-place' });
    expect(s.gatekeeper.companion.status).toBe('OUTSIDE'); expect(s.gatekeeper.companion.agreementWeek).toBeNull();
    expect(s.spirituality).toBe(spirit); expect(originals(s)).toEqual(old); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('charges refused invitation action and spirit but no fee, then requires another real week and fresh consent', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'resting-place' });
    const spirit = s.spirituality, cash = s.cash, ap = s.actionsRemaining, week = s.week, old = originals(s);
    const refusal = act(s, { type: 'INVITE_SPIRIT' }, 100);
    expect(refusal.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.actionsRemaining, s.spirituality, s.cash]).toEqual([ap - 1, spirit - 3, cash]);
    expect(s.gatekeeper.companion).toMatchObject({ status: 'OUTSIDE', agreementWeek: null, entries: 0, feePaid: 0 });
    expect(s.gatekeeper.inviteAttemptWeek).toBe(week); expect(refusal.award).not.toHaveBeenCalled(); expect(messages(refusal)).toContain('没有默认同意');
    reject(s, { type: 'INVITE_SPIRIT' }); nextWeek(s); const success = act(s, { type: 'INVITE_SPIRIT' });
    expect(s.gatekeeper.companion).toMatchObject({ status: 'INSIDE', agreementWeek: week + 1, entries: 1, feePaid: 12, source: 'SG6-GRAY-FEATHER' });
    expect(s.cash).toBe(cash - 12); expect(success.award).not.toHaveBeenCalled(); expect(originals(s)).toEqual(old); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('requires both 3 spirituality and the available 12-penny fee before an invitation can be attempted', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'resting-place' });
    s.cash = 11; reject(s, { type: 'INVITE_SPIRIT' }); s.cash = 12; s.spirituality = 2; reject(s, { type: 'INVITE_SPIRIT' });
    s.spirituality = 3; act(s, { type: 'INVITE_SPIRIT' }); expect([s.cash, s.spirituality]).toEqual([0, 0]);
    expect(s.gatekeeper.companion.feePaid).toBe(12); reject(s, { type: 'INVITE_SPIRIT' });
  });

  it('actually releases and later re-invites the same original with another fee, preserving prior reports', () => {
    const s = recruited(); complete(s, 'resting-place', 'ABILITY');
    const firstWeek = s.week, before = structuredClone(s.gatekeeper.companion), spirit = s.spirituality, cash = s.cash, mastery = structuredClone(s.progression.mastery), old = originals(s);
    s.actionsRemaining = 0; s.mind = 0; const release = act(s, { type: 'RELEASE_SPIRIT' });
    expect(release.ctx.check).not.toHaveBeenCalled(); expect(release.award).not.toHaveBeenCalled(); expect(messages(release)).toContain('原工作室栖架');
    expect(s.gatekeeper.companion).toEqual({ ...before, status: 'OUTSIDE', releases: 1 }); expect([s.actionsRemaining, s.mind, s.spirituality, s.cash]).toEqual([0, 0, spirit, cash]);
    reject(s, { type: 'RELEASE_SPIRIT' }); s.actionsRemaining = 100; s.mind = 100; reject(s, { type: 'INVITE_SPIRIT' });
    nextWeek(s); act(s, { type: 'INVITE_SPIRIT' }, 100);
    expect(s.gatekeeper.companion).toMatchObject({ status: 'OUTSIDE', agreementWeek: firstWeek, entries: 1, releases: 1, feePaid: 12 });
    nextWeek(s); act(s, { type: 'INVITE_SPIRIT' });
    expect(s.gatekeeper.companion).toMatchObject({ status: 'INSIDE', agreementWeek: firstWeek + 2, entries: 2, releases: 1, feePaid: 24 });
    expect(s.cash).toBe(cash - 12); expect(s.progression.mastery).toEqual(mastery); expect(originals(s)).toEqual(old); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('requires the fresh actual resident for ability execution and permits zero-resource withdrawal to ordinary methods', () => {
    const s = promoted(); begin(s, 'resting-place', 'ABILITY');
    expect(s.spiritGuide.messenger.recruited).toBe(true); expect(gatekeeperInside(s)).toBe(false);
    reject(s, { type: 'PERFORM', caseId: 'resting-place' }); reject(s, { type: 'INVITE_SPIRIT' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const c = act(s, { type: 'WITHDRAW', caseId: 'resting-place' });
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(s.gatekeeper.cases['resting-place']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]);
    s.actionsRemaining = 100; s.mind = 100; complete(s, 'resting-place');
    expect(s.gatekeeper.companion.status).toBe('OUTSIDE'); expect(s.spirituality).toBe(0); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('keeps the original inside during resting communication and closes at zero resources without releasing it', () => {
    const s = recruited(); begin(s, 'resting-place', 'ABILITY'); const ap = s.actionsRemaining, spirit = s.spirituality, old = originals(s);
    const performed = act(s, { type: 'PERFORM', caseId: 'resting-place' });
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('will', 14); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 2]);
    expect(s.gatekeeper.companion).toMatchObject({ status: 'INSIDE', deployments: 0, recalls: 0 });
    expect(s.gatekeeper.cases['resting-place']).toMatchObject({ status: 'EXAMINED', contactOpen: true, outcome: 'RESTING_CHECKED' });
    expect(performed.award).not.toHaveBeenCalled(); expect(gatekeeperInside(s)).toBe(true);
    reject(s, { type: 'RECALL_SPIRIT' }); reject(s, { type: 'RELEASE_SPIRIT' }); reject(s, { type: 'REPORT', caseId: 'resting-place' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; act(s, { type: 'CLOSE', caseId: 'resting-place' });
    expect(gatekeeperInside(s)).toBe(false); expect(s.gatekeeper.companion).toMatchObject({ status: 'INSIDE', releases: 0, deployments: 0, recalls: 0 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(originals(s)).toEqual(old); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('retains failed resting costs and requires real closure before a later-week retry', () => {
    const s = recruited(); begin(s, 'resting-place', 'ABILITY'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'resting-place' }, 100);
    expect(s.spirituality).toBe(spirit - 2); expect(s.gatekeeper.companion.status).toBe('INSIDE');
    expect(s.gatekeeper.cases['resting-place']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true, attemptWeek: s.week });
    reject(s, { type: 'WITHDRAW', caseId: 'resting-place' }); act(s, { type: 'CLOSE', caseId: 'resting-place' });
    reject(s, { type: 'PREPARE', caseId: 'resting-place', method: 'ORDINARY' }); nextWeek(s); complete(s, 'resting-place');
    expect(s.gatekeeper.cases['resting-place']!.closes).toBe(2); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('actually deploys the same spirit and delivers the marker, while recall and closure never teleport it back', () => {
    const s = recruited(); begin(s, 'shared-task', 'ABILITY'); const old = originals(s), spirit = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'shared-task' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(s.spirituality).toBe(spirit - 3); expect(messages(c)).toContain('GK5-MARKER-1');
    expect(s.gatekeeper.practice).toEqual({ marker: 'RECIPIENT', gateOpen: false, deliveries: 1, returns: 0, gateTests: 0 });
    expect(s.gatekeeper.companion).toMatchObject({ status: 'DEPLOYED', deployments: 1, recalls: 0 });
    act(s, { type: 'RECALL_SPIRIT' }); expect(s.gatekeeper.companion).toMatchObject({ status: 'INSIDE', recalls: 1 });
    expect(s.gatekeeper.cases['shared-task']!.contactOpen).toBe(true); expect(s.gatekeeper.practice.marker).toBe('RECIPIENT');
    reject(s, { type: 'REPORT', caseId: 'shared-task' }); reject(s, { type: 'RELEASE_SPIRIT' });
    act(s, { type: 'CLOSE', caseId: 'shared-task' }); expect(s.gatekeeper.companion.recalls).toBe(1); expect(gatekeeperInside(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'shared-task' }); reject(s, { type: 'OBSERVE', caseId: 'controlled-threshold' });
    s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0; const retrieve = act(s, { type: 'RETRIEVE_MARKER' });
    expect(messages(retrieve)).toContain('本人亲手交还'); expect(messages(retrieve)).toContain('步行两米'); expect(retrieve.ctx.check).not.toHaveBeenCalled(); expect(retrieve.award).not.toHaveBeenCalled();
    expect(s.gatekeeper.practice).toMatchObject({ marker: 'DESK', deliveries: 1, returns: 1 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(gatekeeperInside(s)).toBe(false);
    expect(originals(s)).toEqual(old); reject(s, { type: 'RETRIEVE_MARKER' }); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('allows original marker retrieval before closure without clearing contact or a deployed spirit', () => {
    const s = recruited(); begin(s, 'shared-task', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'shared-task' });
    act(s, { type: 'RETRIEVE_MARKER' }); expect(s.gatekeeper.practice.marker).toBe('DESK');
    expect(s.gatekeeper.companion.status).toBe('DEPLOYED'); expect(s.gatekeeper.cases['shared-task']!.contactOpen).toBe(true);
    expect(gatekeeperInside(s)).toBe(true); reject(s, { type: 'REPORT', caseId: 'shared-task' });
    act(s, { type: 'CLOSE', caseId: 'shared-task' }); act(s, { type: 'REPORT', caseId: 'shared-task' });
    expect(s.gatekeeper.companion).toMatchObject({ status: 'INSIDE', deployments: 1, recalls: 1 }); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('failed ability delivery leaves the original marker at source and requires actual recall', () => {
    const s = recruited(); begin(s, 'shared-task', 'ABILITY'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'shared-task' }, 100);
    expect(s.spirituality).toBe(spirit - 3); expect(s.gatekeeper.companion.status).toBe('DEPLOYED');
    expect(s.gatekeeper.practice).toMatchObject({ marker: 'DESK', deliveries: 0, returns: 0 }); reject(s, { type: 'RETRIEVE_MARKER' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; act(s, { type: 'CLOSE', caseId: 'shared-task' });
    expect(s.gatekeeper.companion).toMatchObject({ status: 'INSIDE', deployments: 1, recalls: 1 }); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('failed ordinary checking retains the actual two-metre hand delivery until the same original is returned', () => {
    const s = promoted(); s.spirituality = 0; begin(s, 'shared-task'); const ap = s.actionsRemaining, old = originals(s);
    const c = act(s, { type: 'PERFORM', caseId: 'shared-task' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, 0]);
    expect(messages(c)).toContain('真实交付已经发生'); expect(s.gatekeeper.cases['shared-task']!.status).toBe('OBSERVED');
    expect(s.gatekeeper.practice).toMatchObject({ marker: 'RECIPIENT', deliveries: 1, returns: 0 });
    act(s, { type: 'CLOSE', caseId: 'shared-task' }); reject(s, { type: 'PREPARE', caseId: 'shared-task', method: 'ORDINARY' });
    act(s, { type: 'RETRIEVE_MARKER' }); reject(s, { type: 'PREPARE', caseId: 'shared-task', method: 'ORDINARY' });
    nextWeek(s); complete(s, 'shared-task');
    expect(s.gatekeeper.practice).toMatchObject({ marker: 'DESK', deliveries: 2, returns: 2 });
    expect(s.gatekeeper.companion.entries).toBe(0); expect(originals(s)).toEqual(old); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('requires actual release before either threshold method and keeps preparation at the original workroom', () => {
    const s = recruited(); act(s, { type: 'OBSERVE', caseId: 'controlled-threshold' });
    for (const method of ['ABILITY', 'ORDINARY'] as const) reject(s, { type: 'PREPARE', caseId: 'controlled-threshold', method });
    const release = act(s, { type: 'RELEASE_SPIRIT' }); expect(messages(release)).toContain('实际离开你的原身体');
    begin(s, 'controlled-threshold', 'ABILITY'); expect(gatekeeperInside(s)).toBe(false); expect(s.gatekeeper.practice.gateOpen).toBe(false);
    reject(s, { type: 'INVITE_SPIRIT' }); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const withdrawal = act(s, { type: 'WITHDRAW', caseId: 'controlled-threshold' }); expect(messages(withdrawal)).toContain('原身体尚未走到空壁龛');
    expect(gatekeeperInside(s)).toBe(false); expect(s.gatekeeper.companion.status).toBe('OUTSIDE'); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('walks the real body ten metres in PERFORM and closes the finite anchored-cloth door before walking back', () => {
    const s = recruited(); act(s, { type: 'RELEASE_SPIRIT' }); begin(s, 'controlled-threshold', 'ABILITY');
    const spirit = s.spirituality, old = originals(s); const c = act(s, { type: 'PERFORM', caseId: 'controlled-threshold' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('will', 14); expect(s.spirituality).toBe(spirit - 4);
    expect(messages(c)).toContain('步行十米到原空壁龛'); expect(messages(c)).toContain('GK5-CLOTH-1'); expect(messages(c)).toContain('原锚点');
    expect(s.gatekeeper.practice).toMatchObject({ marker: 'DESK', gateOpen: true, gateTests: 1 });
    expect(s.gatekeeper.companion).toMatchObject({ status: 'OUTSIDE', entries: 1, releases: 1, deployments: 0 });
    for (const command of [{ type: 'INVITE_SPIRIT' }, { type: 'RELEASE_SPIRIT' }, { type: 'RECALL_SPIRIT' }, { type: 'RETRIEVE_MARKER' }, { type: 'REPORT', caseId: 'controlled-threshold' }]) reject(s, command);
    s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0; const close = act(s, { type: 'CLOSE', caseId: 'controlled-threshold' });
    expect(messages(close)).toContain('完全关闭'); expect(messages(close)).toContain('步行十米回到原工作室');
    expect(s.gatekeeper.practice).toMatchObject({ gateOpen: false, gateTests: 1 }); expect(gatekeeperInside(s)).toBe(false);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(originals(s)).toEqual(old); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('failed finite-door checking retains the actual open door and body location until zero-AP closure', () => {
    const s = promoted(); begin(s, 'controlled-threshold', 'ABILITY'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'controlled-threshold' }, 100);
    expect(s.spirituality).toBe(spirit - 4); expect(s.gatekeeper.practice).toMatchObject({ gateOpen: true, gateTests: 0 });
    expect(s.gatekeeper.cases['controlled-threshold']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(gatekeeperInside(s)).toBe(true); expect(validateGatekeeperLife(s)).toBe(true);
    s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0; act(s, { type: 'CLOSE', caseId: 'controlled-threshold' });
    expect(s.gatekeeper.practice.gateOpen).toBe(false); expect(gatekeeperInside(s)).toBe(false);
    s.actionsRemaining = 100; s.mind = 100; reject(s, { type: 'PREPARE', caseId: 'controlled-threshold', method: 'ORDINARY' });
    nextWeek(s); complete(s, 'controlled-threshold'); expect(s.gatekeeper.practice.gateTests).toBe(0); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('ordinary threshold uses the actual original fan and physical return without a gate or resident spirit', () => {
    const s = promoted(); s.spirituality = 0; begin(s, 'controlled-threshold');
    const c = act(s, { type: 'PERFORM', caseId: 'controlled-threshold' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(messages(c)).toContain('导师原手扇');
    expect(s.gatekeeper.practice).toMatchObject({ gateOpen: false, gateTests: 0 }); expect(gatekeeperInside(s)).toBe(true);
    expect(gatekeeperPractice(s)!.gate).toContain('须步行十米返回');
    const close = act(s, { type: 'CLOSE', caseId: 'controlled-threshold' }); expect(messages(close)).toContain('步行十米回到原工作室');
    expect(gatekeeperInside(s)).toBe(false); const report = act(s, { type: 'REPORT', caseId: 'controlled-threshold' });
    expect(report.award).not.toHaveBeenCalled(); expect(s.gatekeeper.companion.entries).toBe(0); expect(s.progression.acting).toBe(25); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('all ordinary reports and reflection reach acting100 without recruitment, magic or old-history changes', () => {
    const s = promoted(), mastery = structuredClone(s.progression.mastery), old = originals(s); s.spirituality = 0;
    for (const id of GATEKEEPER_CASE_IDS) expect(complete(s, id).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(75); const reflection = act(s, { type: 'REFLECT' });
    expect(reflection.award).not.toHaveBeenCalled(); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery);
    expect(s.gatekeeper.companion).toMatchObject({ status: 'OUTSIDE', agreementWeek: null, entries: 0, deployments: 0, recalls: 0, feePaid: 0 });
    expect(s.gatekeeper.practice).toEqual({ marker: 'DESK', gateOpen: false, deliveries: 1, returns: 1, gateTests: 0 });
    expect(s.seer.completedSources.filter(x => x.startsWith('gatekeeper-'))).toEqual([...GATEKEEPER_CASE_IDS.map(id => `gatekeeper-case:${id}`), 'gatekeeper-reflection']);
    expect(originals(s)).toEqual(old); expect(validateGatekeeperState(s)).toBe(true);
    for (const caseId of GATEKEEPER_CASE_IDS) { reject(s, { type: 'PERFORM', caseId }); reject(s, { type: 'REPORT', caseId }); }
    reject(s, { type: 'REFLECT' });
  });

  it('ability reports award the known pool once each after actual closure and return, with no third-case spirit dispatch', () => {
    const s = recruited();
    for (const id of GATEKEEPER_CASE_IDS) {
      if (id === 'controlled-threshold') act(s, { type: 'RELEASE_SPIRIT' });
      const c = complete(s, id, 'ABILITY'); expect(c.award).toHaveBeenCalledExactlyOnceWith(`gatekeeper-case:${id}`, 8); reject(s, { type: 'REPORT', caseId: id });
    }
    expect(s.progression.mastery[GATEKEEPER_ABILITY_IDS[0]]).toBe(24); expect(s.progression.acting).toBe(75);
    expect(s.gatekeeper.companion).toMatchObject({ status: 'OUTSIDE', entries: 1, releases: 1, deployments: 1, recalls: 1, feePaid: 12 });
    expect(s.gatekeeper.practice).toEqual({ marker: 'DESK', gateOpen: false, deliveries: 1, returns: 1, gateTests: 1 });
    act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(validateGatekeeperState(s)).toBe(true);
  });

  it('can change from an earlier failed ordinary attempt to a prepared ability without inventing past residence', () => {
    const s = promoted(); begin(s, 'shared-task'); act(s, { type: 'PERFORM', caseId: 'shared-task' }, 100);
    act(s, { type: 'CLOSE', caseId: 'shared-task' }); act(s, { type: 'RETRIEVE_MARKER' }); nextWeek(s);
    begin(s, 'shared-task', 'ABILITY'); expect(validateGatekeeperLife(s)).toBe(true);
    reject(s, { type: 'PERFORM', caseId: 'shared-task' }); act(s, { type: 'WITHDRAW', caseId: 'shared-task' }); expect(validateGatekeeperLife(s)).toBe(true);
  });

  it('resting INSIDE without contact permits public ordinary life and normal week advancement', () => {
    const s = recruited(), before = structuredClone(s.gatekeeper.companion); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week; expect(gatekeeperInside(s)).toBe(false);
    const rested = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(rested.week).toBe(week + 1); expect(rested.gatekeeper.companion).toEqual(before); expect(gatekeeperInside(rested)).toBe(false);
  });

  it('public last-AP delivery holds the same week until both real closure and marker retrieval happen', () => {
    const s = promoted(); begin(s, 'shared-task'); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, delivered = applySliceIntent(s, { type: 'GATEKEEPER', command: { type: 'PERFORM', caseId: 'shared-task' } });
    expect([delivered.week, delivered.actionsRemaining, delivered.gatekeeper.practice.marker]).toEqual([week, 0, 'RECIPIENT']);
    expect(() => applySliceIntent(delivered, { type: 'ACTION', action: 'WORK' })).toThrow();
    const closed = applySliceIntent(delivered, { type: 'GATEKEEPER', command: { type: 'CLOSE', caseId: 'shared-task' } });
    expect(closed.week).toBe(week); expect(gatekeeperInside(closed)).toBe(true); expect(() => applySliceIntent(closed, { type: 'ACTION', action: 'REST' })).toThrow();
    const returned = applySliceIntent(closed, { type: 'GATEKEEPER', command: { type: 'RETRIEVE_MARKER' } });
    expect(returned.week).toBe(week + 1); expect(gatekeeperInside(returned)).toBe(false);
    expect(returned.gatekeeper.practice).toMatchObject({ marker: 'DESK', deliveries: 1, returns: 1 }); expect(returned.spiritGuide.messenger.letter).toBe('RECIPIENT');
  });

  it('public last-AP threshold holds the same week until the finite door closes and original body walks back', () => {
    const s = promoted(); begin(s, 'controlled-threshold', 'ABILITY'); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, opened = applySliceIntent(s, { type: 'GATEKEEPER', command: { type: 'PERFORM', caseId: 'controlled-threshold' } });
    expect([opened.week, opened.actionsRemaining, opened.gatekeeper.practice.gateOpen]).toEqual([week, 0, true]);
    expect(() => applySliceIntent(opened, { type: 'ACTION', action: 'REST' })).toThrow();
    const closed = applySliceIntent(opened, { type: 'GATEKEEPER', command: { type: 'CLOSE', caseId: 'controlled-threshold' } });
    expect(closed.week).toBe(week + 1); expect(closed.gatekeeper.practice.gateOpen).toBe(false); expect(gatekeeperInside(closed)).toBe(false);
  });

  it('projects detached actual companion, marker, gate and historical strings', () => {
    const s = recruited(); begin(s, 'shared-task', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'shared-task' });
    const cases = gatekeeperCases(s), companion = gatekeeperCompanion(s)!, practice = gatekeeperPractice(s)!;
    expect(companion.source).toContain('SG6-GRAY-FEATHER'); expect(companion.status).toContain('正在'); expect(companion.history.join(' ')).toContain('实际派出1次');
    expect(practice.marker).toContain('GK5-MARKER-1'); expect(practice.marker).toContain('原看守桌'); expect(practice.summary).toContain('取回0次');
    expect(new Set(cases.map(c => c.story)).size).toBe(3); expect(cases.find(c => c.id === 'shared-task')!.result).toContain('仍在原看守桌');
    companion.history.push('invented'); cases[0]!.observations.push('invented'); practice.marker = 'copied';
    expect(gatekeeperCompanion(s)!.history).not.toContain('invented'); expect(gatekeeperCases(s)[0]!.observations).not.toContain('invented'); expect(s.gatekeeper.practice.marker).toBe('RECIPIENT');
    const actions = gatekeeperActions(s); expect(actions.find(a => a.command.type === 'RETRIEVE_MARKER')!.enabled).toBe(true); expect(actions.find(a => a.command.type === 'REPORT')!.enabled).toBe(false);
  });

  it('rejects forged originals, missing fresh agreements, unbalanced counters, ghost gates and duplicate rewards', () => {
    const initial = promoted(); expect(validateGatekeeperLife(initial)).toBe(true);
    const forgedInitial: ((s: SliceState) => void)[] = [
      s => { Object.assign(s.gatekeeper.companion, { source: 'OTHER' }); }, s => { Object.assign(s.gatekeeper.companion, { secondSpirit: true }); },
      s => { s.gatekeeper.companion.status = 'INSIDE'; }, s => { s.gatekeeper.companion.entries = 1; }, s => { s.gatekeeper.companion.feePaid = 12; },
      s => { s.gatekeeper.inviteAttemptWeek = s.week + 1; }, s => { s.gatekeeper.practice.deliveries = 1; }, s => { s.gatekeeper.practice.gateOpen = true; },
      s => { s.gatekeeper.practice.gateTests = 1; }, s => { Object.assign(s.gatekeeper.practice, { duplicateMarker: true }); },
      s => { Object.assign(s.gatekeeper, { companion: null }); }, s => { Object.assign(s.gatekeeper, { practice: null }); }, s => { Object.assign(s.gatekeeper.cases, { 'resting-place': null }); },
    ];
    for (const change of forgedInitial) { const s = structuredClone(initial); change(s); expect(validateGatekeeperLife(s)).toBe(false); }
    const finished = recruited(); complete(finished, 'resting-place', 'ABILITY'); complete(finished, 'shared-task', 'ABILITY'); act(finished, { type: 'RELEASE_SPIRIT' }); complete(finished, 'controlled-threshold', 'ABILITY');
    const changes: ((s: SliceState) => void)[] = [
      s => { s.gatekeeper.companion.recalls = 0; }, s => { s.gatekeeper.companion.agreementWeek = null; }, s => { s.gatekeeper.companion.feePaid = 0; },
      s => { s.gatekeeper.companion.status = 'DEPLOYED'; s.gatekeeper.companion.deployments += 1; }, s => { s.gatekeeper.companion.releases = 0; },
      s => { s.gatekeeper.practice.marker = 'RECIPIENT'; s.gatekeeper.practice.returns = 0; }, s => { s.gatekeeper.practice.returns = 2; }, s => { s.gatekeeper.practice.gateTests = 0; },
      s => { s.gatekeeper.cases['shared-task']!.outcome = 'RESTING_CHECKED'; }, s => { s.gatekeeper.cases['controlled-threshold']!.closes = 0; },
      s => { s.seer.completedSources.push('gatekeeper-case:shared-task'); }, s => { s.progression.acting = 100; },
    ];
    for (const change of changes) { const s = structuredClone(finished); change(s); expect(validateGatekeeperLife(s)).toBe(false); }
  });

  it('blocks interruptions, insufficient spirit, dead recruitment and premature encounters without mutation', () => {
    for (const change of [((s: SliceState) => { s.world.city = 'TINGEN'; }), (s: SliceState) => { s.actionsRemaining = 0; }, (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.mind = 0; }, (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.activeEvent = { id: 'pending', instanceId: 'pending' }; }]) {
      const s = promoted(); change(s); reject(s, { type: 'OBSERVE', caseId: 'resting-place' });
    }
    reject(spiritGuide(), { type: 'OBSERVE', caseId: 'resting-place' });
    const s = promoted(); begin(s, 'controlled-threshold', 'ABILITY'); s.spirituality = 3;
    reject(s, { type: 'PERFORM', caseId: 'controlled-threshold' }); act(s, { type: 'WITHDRAW', caseId: 'controlled-threshold' });
    reject(s, { type: 'ENCOUNTER_FIGHT' }); reject(s, { type: 'ENCOUNTER_TALK' }); reject(s, { type: 'REFLECT' });
    complete(s, 'resting-place'); expect(gatekeeperActions(s).find(a => a.command.type === 'ENCOUNTER_TALK')!.enabled).toBe(true);
    s.status = 'DEAD'; reject(s, { type: 'INVITE_SPIRIT' }); expect(gatekeeperCompanion(s)!.status).toContain('不能重新邀请');
  });
});
