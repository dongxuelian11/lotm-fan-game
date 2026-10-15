import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applySpiritWarlockCommand, createSpiritWarlockState, validateSpiritWarlockState } from '../../src/domain/spirit-warlock/index.js';
import { applySpiritWarlockActivity, isSpiritWarlockActivity, spiritWarlockActions, spiritWarlockCases, spiritWarlockInside, spiritWarlockCompanion, spiritWarlockPractice, SPIRIT_WARLOCK_ENVIRONMENT, validateSpiritWarlockLife } from '../../src/domain/spirit-warlock/life.js';
import { SPIRIT_WARLOCK_ABILITY_IDS, SPIRIT_WARLOCK_CASE_IDS, type SpiritWarlockActivityCommand, type SpiritWarlockCaseId } from '../../src/domain/spirit-warlock/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[SPIRIT_WARLOCK_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function soother(): SliceState {
  const old = JSON.parse(readFileSync('tests/fixtures/soother-v0780/natural.json', 'utf8')).final;
  const s = migrateSliceState(old); s.spiritWarlock = createSpiritWarlockState();
  const week = Math.max(s.week, s.soother.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function promoted(): SliceState {
  const s = soother(), c = context(s).ctx;
  applySpiritWarlockCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySpiritWarlockCommand(s, { type: 'BUY_POTION', bottleId: s.spiritWarlock.bottles[0]!.id }, c);
  applySpiritWarlockCommand(s, { type: 'CONSUME', bottleId: s.spiritWarlock.bottles[0]!.id, confirmed: true }, c);
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function act(s: SliceState, command: SpiritWarlockActivityCommand, roll = 1) { const c = context(s, roll); applySpiritWarlockActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applySpiritWarlockActivity(s, command as SpiritWarlockActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: SpiritWarlockCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.spiritWarlock.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: SpiritWarlockCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  if (s.spiritWarlock.practice.note === 'RECIPIENT') act(s, { type: 'RETRIEVE_NOTE' });
  return act(s, { type: 'REPORT', caseId });
}
function recruited() {
  const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'listening-leaves' }); act(s, { type: 'INVITE_SPIRIT' }); return s;
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.sleepless, s.midnight, s.nightmare, s.soother, s.world, s.town]);

describe('Spirit Warlock voluntary original spirit, actual original note and dream cooperation', () => {
  it('has no automatic spirit on promotion and hides life before promotion', () => {
    const before = soother();
    expect(spiritWarlockActions(before)).toEqual([]); expect(spiritWarlockCases(before)).toEqual([]);
    expect(spiritWarlockCompanion(before)).toBeNull(); expect(spiritWarlockPractice(before)).toBeNull();
    expect(validateSpiritWarlockLife(before)).toBe(true);
    const s = promoted();
    expect(s.spiritWarlock.companion).toEqual({ status: 'UNMET', invitedWeek: null, acquiredWeek: null, releases: 0, deployments: 0, recalls: 0, source: 'SW5-LEAF-1' });
    expect(s.spiritWarlock.practice).toEqual({ note: 'TABLE', dreamOpen: false, deliveries: 0, returns: 0, coordinationChecks: 0 });
    expect(spiritWarlockCases(s).map(p => p.id)).toEqual([...SPIRIT_WARLOCK_CASE_IDS]);
    expect(spiritWarlockCases(s).every(p => p.observations.length === 0)).toBe(true);
    expect(spiritWarlockInside(s)).toBe(false); expect(validateSpiritWarlockState(s)).toBe(true);
    expect(SPIRIT_WARLOCK_ENVIRONMENT).toContain('晋升不附赠灵'); expect(SPIRIT_WARLOCK_ENVIRONMENT).toContain('原创G');
  });

  it('accepts the exact companion activities and rejects invented originals or extra command fields before mutation', () => {
    for (const type of ['INVITE_SPIRIT', 'RECALL_SPIRIT', 'RELEASE_SPIRIT', 'RETRIEVE_NOTE'] as const) expect(isSpiritWarlockActivity({ type })).toBe(true);
    for (const command of [null, {}, { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'listening-leaves', method: 'FLIGHT' }, { type: 'INVITE_SPIRIT', spirit: 'new-spirit' }, { type: 'RECALL_SPIRIT', caseId: 'listening-leaves' }, { type: 'RELEASE_SPIRIT', source: 'SW5-LEAF-1' }, { type: 'RETRIEVE_NOTE', teleport: true }, { type: 'PERFORM', caseId: 'quiet-coordination', awake: false }, { type: 'CLOSE', caseId: 'original-message', returnNote: true }, { type: 'REPORT', caseId: 'original-message', truth: true }, { type: 'REFLECT', extra: true }]) reject(promoted(), command);
  });

  it('makes observation separate from recruitment and keeps the three original cases independently observable', () => {
    const s = promoted(), spirit = s.spirituality;
    reject(s, { type: 'INVITE_SPIRIT' }); reject(s, { type: 'PERFORM', caseId: 'listening-leaves' });
    act(s, { type: 'OBSERVE', caseId: 'quiet-coordination' }); act(s, { type: 'OBSERVE', caseId: 'original-message' });
    expect(s.spiritWarlock.companion.status).toBe('UNMET');
    act(s, { type: 'OBSERVE', caseId: 'listening-leaves' });
    expect(s.spiritWarlock.companion.status).toBe('AVAILABLE'); expect(s.spiritWarlock.companion.acquiredWeek).toBeNull();
    expect(s.spirituality).toBe(spirit); expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('charges a refused invitation and waits another real week without sealing or inventing a spirit', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'listening-leaves' });
    const spirit = s.spirituality, ap = s.actionsRemaining, week = s.week, old = originals(s);
    const c = act(s, { type: 'INVITE_SPIRIT' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('will', 14);
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 3]);
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'AVAILABLE', invitedWeek: week, acquiredWeek: null, deployments: 0 });
    expect(c.award).not.toHaveBeenCalled(); expect(messages(c)).toContain('没有默认同意');
    reject(s, { type: 'INVITE_SPIRIT' }); nextWeek(s); act(s, { type: 'INVITE_SPIRIT' });
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'SEALED', invitedWeek: week + 1, acquiredWeek: week + 1, source: 'SW5-LEAF-1' });
    expect(originals(s)).toEqual(old); expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('voluntarily releases and later re-invites the same original without clearing history or rewarding again', () => {
    const s = recruited(), firstWeek = s.week, before = structuredClone(s.spiritWarlock.companion), spirit = s.spirituality, mastery = structuredClone(s.progression.mastery);
    s.actionsRemaining = 0; s.mind = 0;
    const release = act(s, { type: 'RELEASE_SPIRIT' });
    expect(release.ctx.check).not.toHaveBeenCalled(); expect(release.award).not.toHaveBeenCalled();
    expect(s.spiritWarlock.companion).toEqual({ ...before, status: 'RELEASED', releases: 1 });
    expect([s.actionsRemaining, s.mind, s.spirituality]).toEqual([0, 0, spirit]);
    reject(s, { type: 'RELEASE_SPIRIT' }); s.actionsRemaining = 100; s.mind = 100; reject(s, { type: 'INVITE_SPIRIT' });
    nextWeek(s); act(s, { type: 'INVITE_SPIRIT' }, 100);
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'RELEASED', acquiredWeek: firstWeek, releases: 1 });
    nextWeek(s); const invite = act(s, { type: 'INVITE_SPIRIT' });
    expect(invite.award).not.toHaveBeenCalled(); expect(s.progression.mastery).toEqual(mastery);
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'SEALED', invitedWeek: firstWeek + 2, acquiredWeek: firstWeek, releases: 1, source: 'SW5-LEAF-1' });
    expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('requires a separately acquired spirit for ability execution but lets the player cancel and use ordinary methods', () => {
    const s = promoted(); begin(s, 'listening-leaves', 'ABILITY');
    expect(spiritWarlockInside(s)).toBe(false); reject(s, { type: 'PERFORM', caseId: 'listening-leaves' }); reject(s, { type: 'INVITE_SPIRIT' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const c = act(s, { type: 'WITHDRAW', caseId: 'listening-leaves' });
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(s.spiritWarlock.cases['listening-leaves']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]);
    s.actionsRemaining = 100; s.mind = 100; begin(s, 'listening-leaves'); act(s, { type: 'PERFORM', caseId: 'listening-leaves' });
    expect(s.spiritWarlock.cases['listening-leaves']!.status).toBe('EXAMINED');
    expect(s.spiritWarlock.companion.status).toBe('AVAILABLE'); expect(s.spirituality).toBe(0); expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('actually dispatches the acquired leaf spirit and recall alone does not close the listening case', () => {
    const s = recruited(); begin(s, 'listening-leaves', 'ABILITY'); const ap = s.actionsRemaining, spirit = s.spirituality, old = originals(s);
    const c = act(s, { type: 'PERFORM', caseId: 'listening-leaves' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('will', 14); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 3]);
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'DEPLOYED', deployments: 1, recalls: 0 });
    expect(s.spiritWarlock.cases['listening-leaves']).toMatchObject({ status: 'EXAMINED', contactOpen: true, outcome: 'LEAVES_CHECKED' });
    expect(c.award).not.toHaveBeenCalled(); expect(spiritWarlockInside(s)).toBe(true);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    act(s, { type: 'RECALL_SPIRIT' });
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'SEALED', deployments: 1, recalls: 1 });
    expect(s.spiritWarlock.cases['listening-leaves']!.contactOpen).toBe(true); expect(spiritWarlockInside(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'listening-leaves' }); reject(s, { type: 'RELEASE_SPIRIT' }); reject(s, { type: 'RECALL_SPIRIT' });
    act(s, { type: 'CLOSE', caseId: 'listening-leaves' });
    expect(spiritWarlockInside(s)).toBe(false); expect(s.spiritWarlock.companion.recalls).toBe(1);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(originals(s)).toEqual(old);
    expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('retains failed ability dispatch and costs, closes at zero AP, then permits only a later-week attempt', () => {
    const s = recruited(); begin(s, 'listening-leaves', 'ABILITY'); const spirit = s.spirituality, mind = s.mind;
    act(s, { type: 'PERFORM', caseId: 'listening-leaves' }, 100);
    expect([s.spirituality, s.mind]).toEqual([spirit - 3, mind]);
    expect(s.spiritWarlock.cases['listening-leaves']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true, attemptWeek: s.week });
    expect(s.spiritWarlock.companion.status).toBe('DEPLOYED'); reject(s, { type: 'WITHDRAW', caseId: 'listening-leaves' });
    act(s, { type: 'CLOSE', caseId: 'listening-leaves' }); reject(s, { type: 'PREPARE', caseId: 'listening-leaves', method: 'ORDINARY' });
    nextWeek(s); begin(s, 'listening-leaves'); act(s, { type: 'PERFORM', caseId: 'listening-leaves' }); act(s, { type: 'CLOSE', caseId: 'listening-leaves' });
    expect(s.spiritWarlock.cases['listening-leaves']!.closes).toBe(2); expect(s.spiritWarlock.companion.deployments).toBe(1);
    expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('really delivers the same note by the actual spirit and closure does not teleport it back', () => {
    const s = recruited(); begin(s, 'original-message', 'ABILITY'); const old = originals(s), spirit = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'original-message' });
    expect(s.spirituality).toBe(spirit - 3); expect(messages(c)).toContain('SW5-NOTE-1'); expect(messages(c)).toContain('两米');
    expect(s.spiritWarlock.practice).toEqual({ note: 'RECIPIENT', dreamOpen: false, deliveries: 1, returns: 0, coordinationChecks: 0 });
    reject(s, { type: 'REPORT', caseId: 'original-message' }); act(s, { type: 'CLOSE', caseId: 'original-message' });
    expect(s.spiritWarlock.companion.status).toBe('SEALED'); expect(s.spiritWarlock.practice.note).toBe('RECIPIENT');
    expect(spiritWarlockInside(s)).toBe(true); reject(s, { type: 'REPORT', caseId: 'original-message' }); reject(s, { type: 'OBSERVE', caseId: 'quiet-coordination' });
    s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0;
    const retrieve = act(s, { type: 'RETRIEVE_NOTE' });
    expect(messages(retrieve)).toContain('梅森本人亲手交还'); expect(retrieve.ctx.check).not.toHaveBeenCalled(); expect(retrieve.award).not.toHaveBeenCalled();
    expect(s.spiritWarlock.practice).toMatchObject({ note: 'TABLE', deliveries: 1, returns: 1 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(spiritWarlockInside(s)).toBe(false);
    expect(originals(s)).toEqual(old); reject(s, { type: 'RETRIEVE_NOTE' }); expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('allows actual retrieval before closure but retains the unpaid closure boundary', () => {
    const s = promoted(); begin(s, 'original-message'); act(s, { type: 'PERFORM', caseId: 'original-message' });
    act(s, { type: 'RETRIEVE_NOTE' });
    expect(s.spiritWarlock.practice.note).toBe('TABLE'); expect(s.spiritWarlock.cases['original-message']!.contactOpen).toBe(true);
    expect(spiritWarlockInside(s)).toBe(true); reject(s, { type: 'REPORT', caseId: 'original-message' });
    act(s, { type: 'CLOSE', caseId: 'original-message' }); act(s, { type: 'REPORT', caseId: 'original-message' });
    expect(s.spiritWarlock.practice.returns).toBe(1); expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('a failed ability delivery leaves the original note at its source and still requires dispatch closure', () => {
    const s = recruited(); begin(s, 'original-message', 'ABILITY'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'original-message' }, 100);
    expect(s.spirituality).toBe(spirit - 3); expect(s.spiritWarlock.companion.status).toBe('DEPLOYED');
    expect(s.spiritWarlock.practice).toMatchObject({ note: 'TABLE', deliveries: 0, returns: 0 });
    reject(s, { type: 'RETRIEVE_NOTE' }); act(s, { type: 'CLOSE', caseId: 'original-message' });
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'SEALED', deployments: 1, recalls: 1 });
    expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('a failed ordinary check retains the real two-metre hand delivery until the same original is retrieved', () => {
    const s = promoted(); s.spirituality = 0; begin(s, 'original-message'); const ap = s.actionsRemaining;
    const c = act(s, { type: 'PERFORM', caseId: 'original-message' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, 0]);
    expect(messages(c)).toContain('真实交付已经发生'); expect(s.spiritWarlock.cases['original-message']!.status).toBe('OBSERVED');
    expect(s.spiritWarlock.practice).toMatchObject({ note: 'RECIPIENT', deliveries: 1, returns: 0 });
    act(s, { type: 'CLOSE', caseId: 'original-message' }); reject(s, { type: 'PREPARE', caseId: 'original-message', method: 'ORDINARY' });
    act(s, { type: 'RETRIEVE_NOTE' }); reject(s, { type: 'PREPARE', caseId: 'original-message', method: 'ORDINARY' });
    nextWeek(s); begin(s, 'original-message'); act(s, { type: 'PERFORM', caseId: 'original-message' });
    expect(s.spiritWarlock.practice).toMatchObject({ note: 'RECIPIENT', deliveries: 2, returns: 1 });
    act(s, { type: 'RETRIEVE_NOTE' }); act(s, { type: 'CLOSE', caseId: 'original-message' }); act(s, { type: 'REPORT', caseId: 'original-message' });
    expect(s.spiritWarlock.practice).toMatchObject({ note: 'TABLE', deliveries: 2, returns: 2 });
    expect(s.spiritWarlock.companion.status).toBe('UNMET'); expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('keeps the real body still while its acquired spirit helps with the inherited finite dream', () => {
    const s = recruited(); begin(s, 'quiet-coordination', 'ABILITY'); const spirit = s.spirituality, old = originals(s);
    const c = act(s, { type: 'PERFORM', caseId: 'quiet-coordination' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('will', 14); expect(s.spirituality).toBe(spirit - 4);
    expect(messages(c)).toContain('保持原身体静坐'); expect(messages(c)).toContain('梅森本人已休息并同意');
    expect(s.spiritWarlock.practice).toMatchObject({ dreamOpen: true, coordinationChecks: 1 });
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'DEPLOYED', deployments: 1 });
    act(s, { type: 'RECALL_SPIRIT' });
    expect(s.spiritWarlock.companion.status).toBe('SEALED'); expect(s.spiritWarlock.practice.dreamOpen).toBe(true);
    expect(spiritWarlockInside(s)).toBe(true); reject(s, { type: 'RELEASE_SPIRIT' }); reject(s, { type: 'REPORT', caseId: 'quiet-coordination' });
    s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0;
    const close = act(s, { type: 'CLOSE', caseId: 'quiet-coordination' });
    expect(messages(close)).toContain('梅森在原椅上醒来'); expect(s.spiritWarlock.practice).toMatchObject({ dreamOpen: false, coordinationChecks: 1 });
    expect(s.spiritWarlock.companion.recalls).toBe(1); expect(originals(s)).toEqual(old); expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('a failed coordination check does not erase the maintained dream or fabricate a successful cooperation', () => {
    const s = recruited(); begin(s, 'quiet-coordination', 'ABILITY'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'quiet-coordination' }, 100);
    expect(s.spirituality).toBe(spirit - 4); expect(s.spiritWarlock.practice).toMatchObject({ dreamOpen: true, coordinationChecks: 0 });
    expect(s.spiritWarlock.cases['quiet-coordination']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(validateSpiritWarlockLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'quiet-coordination' });
    expect(s.spiritWarlock.practice.dreamOpen).toBe(false); expect(s.spiritWarlock.companion.status).toBe('SEALED');
    nextWeek(s); complete(s, 'quiet-coordination');
    expect(s.spiritWarlock.practice.coordinationChecks).toBe(0); expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('uses ordinary awake discussion without opening dreams, dispatching or obtaining any spirit', () => {
    const s = promoted(); s.spirituality = 0; begin(s, 'quiet-coordination');
    const c = act(s, { type: 'PERFORM', caseId: 'quiet-coordination' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(messages(c)).toContain('醒着的梅森');
    expect(s.spiritWarlock.practice).toMatchObject({ dreamOpen: false, coordinationChecks: 0 });
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'UNMET', acquiredWeek: null, deployments: 0 });
    act(s, { type: 'CLOSE', caseId: 'quiet-coordination' }); const report = act(s, { type: 'REPORT', caseId: 'quiet-coordination' });
    expect(report.award).not.toHaveBeenCalled(); expect(s.progression.acting).toBe(25); expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('all three ordinary reports and reflection reach acting100 without recruitment or magical mastery', () => {
    const s = promoted(), mastery = structuredClone(s.progression.mastery), old = originals(s); s.spirituality = 0;
    for (const id of SPIRIT_WARLOCK_CASE_IDS) expect(complete(s, id).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(75); const reflection = act(s, { type: 'REFLECT' });
    expect(reflection.award).not.toHaveBeenCalled(); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery);
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'AVAILABLE', acquiredWeek: null, deployments: 0, recalls: 0 });
    expect(s.spiritWarlock.practice).toEqual({ note: 'TABLE', dreamOpen: false, deliveries: 1, returns: 1, coordinationChecks: 0 });
    expect(s.seer.completedSources.filter(x => x.startsWith('spirit-warlock-'))).toEqual([...SPIRIT_WARLOCK_CASE_IDS.map(id => `spirit-warlock-case:${id}`), 'spirit-warlock-reflection']);
    expect(originals(s)).toEqual(old); expect(validateSpiritWarlockState(s)).toBe(true);
    for (const caseId of SPIRIT_WARLOCK_CASE_IDS) { reject(s, { type: 'PERFORM', caseId }); reject(s, { type: 'REPORT', caseId }); }
    reject(s, { type: 'REFLECT' });
  });

  it('ability reports award a single existing-pool8 each only after genuine closure and note return', () => {
    const s = recruited();
    for (const id of SPIRIT_WARLOCK_CASE_IDS) {
      const c = complete(s, id, 'ABILITY'); expect(c.award).toHaveBeenCalledExactlyOnceWith(`spirit-warlock-case:${id}`, 8);
      reject(s, { type: 'REPORT', caseId: id });
    }
    expect(s.progression.mastery[SPIRIT_WARLOCK_ABILITY_IDS[0]]).toBe(24); expect(s.progression.acting).toBe(75);
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'SEALED', deployments: 3, recalls: 3 });
    expect(s.spiritWarlock.practice).toEqual({ note: 'TABLE', dreamOpen: false, deliveries: 1, returns: 1, coordinationChecks: 1 });
    act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(validateSpiritWarlockState(s)).toBe(true);
  });

  it('can prepare an ability after an earlier ordinary failure without rewriting that historical attempt as a spirit dispatch', () => {
    const s = promoted(); begin(s, 'original-message'); act(s, { type: 'PERFORM', caseId: 'original-message' }, 100);
    act(s, { type: 'CLOSE', caseId: 'original-message' }); act(s, { type: 'RETRIEVE_NOTE' }); nextWeek(s);
    begin(s, 'original-message', 'ABILITY'); expect(validateSpiritWarlockLife(s)).toBe(true);
    reject(s, { type: 'PERFORM', caseId: 'original-message' }); act(s, { type: 'WITHDRAW', caseId: 'original-message' });
    expect(validateSpiritWarlockLife(s)).toBe(true);
  });

  it('public last-AP delivery cannot advance the week until both real closure and retrieval happen', () => {
    const s = promoted(); begin(s, 'original-message'); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week;
    const delivered = applySliceIntent(s, { type: 'SPIRIT_WARLOCK', command: { type: 'PERFORM', caseId: 'original-message' } });
    expect([delivered.week, delivered.actionsRemaining, delivered.spiritWarlock.practice.note]).toEqual([week, 0, 'RECIPIENT']);
    expect(() => applySliceIntent(delivered, { type: 'ACTION', action: 'WORK' })).toThrow();
    const closed = applySliceIntent(delivered, { type: 'SPIRIT_WARLOCK', command: { type: 'CLOSE', caseId: 'original-message' } });
    expect(closed.week).toBe(week); expect(spiritWarlockInside(closed)).toBe(true);
    expect(() => applySliceIntent(closed, { type: 'ACTION', action: 'REST' })).toThrow();
    const returned = applySliceIntent(closed, { type: 'SPIRIT_WARLOCK', command: { type: 'RETRIEVE_NOTE' } });
    expect(returned.week).toBe(week + 1); expect(spiritWarlockInside(returned)).toBe(false);
    expect(returned.spiritWarlock.practice).toMatchObject({ note: 'TABLE', deliveries: 1, returns: 1 });
  });

  it('public last-AP dream and recall hold the same week until actual dream closure', () => {
    const s = recruited(); begin(s, 'quiet-coordination', 'ABILITY'); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week;
    const dreaming = applySliceIntent(s, { type: 'SPIRIT_WARLOCK', command: { type: 'PERFORM', caseId: 'quiet-coordination' } });
    expect([dreaming.week, dreaming.actionsRemaining, dreaming.spiritWarlock.practice.dreamOpen]).toEqual([week, 0, true]);
    const recalled = applySliceIntent(dreaming, { type: 'SPIRIT_WARLOCK', command: { type: 'RECALL_SPIRIT' } });
    expect(recalled.week).toBe(week); expect(recalled.spiritWarlock.practice.dreamOpen).toBe(true);
    const closed = applySliceIntent(recalled, { type: 'SPIRIT_WARLOCK', command: { type: 'CLOSE', caseId: 'quiet-coordination' } });
    expect(closed.week).toBe(week + 1); expect(closed.spiritWarlock.practice.dreamOpen).toBe(false);
    expect(closed.spiritWarlock.companion.recalls).toBe(1);
  });

  it('projects the actual original note, spirit history and dream boundaries as detached public strings', () => {
    const s = recruited(); begin(s, 'original-message', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'original-message' });
    const cases = spiritWarlockCases(s), companion = spiritWarlockCompanion(s)!, practice = spiritWarlockPractice(s)!;
    expect(companion.source).toContain('SW5-LEAF-1'); expect(companion.status).toContain('正在'); expect(companion.history.join(' ')).toContain('实际派出1次');
    expect(practice.note).toContain('SW5-NOTE-1'); expect(practice.note).toContain('梅森原桌'); expect(practice.summary).toContain('取回0次');
    expect(new Set(cases.map(c => c.story)).size).toBe(3); expect(cases.find(c => c.id === 'original-message')!.result).toContain('仍在梅森原桌');
    companion.history.push('invented'); cases[0]!.observations.push('invented'); practice.note = 'copied';
    expect(spiritWarlockCompanion(s)!.history).not.toContain('invented'); expect(spiritWarlockCases(s)[0]!.observations).not.toContain('invented');
    expect(s.spiritWarlock.practice.note).toBe('RECIPIENT');
    const actions = spiritWarlockActions(s);
    expect(actions.find(a => a.command.type === 'RETRIEVE_NOTE')!.enabled).toBe(true);
    expect(actions.find(a => a.command.type === 'REPORT')!.enabled).toBe(false);
  });

  it('validates exact originals, outstanding returns, real dispatch counts, dreams and unique report sources', () => {
    const initial = promoted(); expect(validateSpiritWarlockLife(initial)).toBe(true);
    const forgedInitial: ((s: SliceState) => void)[] = [
      s => { Object.assign(s.spiritWarlock.companion, { source: 'OTHER' }); },
      s => { Object.assign(s.spiritWarlock.companion, { secondSpirit: true }); },
      s => { s.spiritWarlock.companion.status = 'SEALED'; },
      s => { s.spiritWarlock.practice.deliveries = 1; },
      s => { s.spiritWarlock.practice.dreamOpen = true; },
      s => { s.spiritWarlock.practice.coordinationChecks = 1; },
      s => { Object.assign(s.spiritWarlock.practice, { duplicateNote: true }); },
      s => { s.spiritWarlock.cases['listening-leaves']!.status = 'OBSERVED'; },
      s => { Object.assign(s.spiritWarlock, { companion: null }); },
      s => { Object.assign(s.spiritWarlock, { practice: null }); },
    ];
    for (const change of forgedInitial) { const s = structuredClone(initial); change(s); expect(validateSpiritWarlockLife(s)).toBe(false); }
    const completeState = recruited(); for (const id of SPIRIT_WARLOCK_CASE_IDS) complete(completeState, id, 'ABILITY');
    const changes: ((s: SliceState) => void)[] = [
      s => { s.spiritWarlock.companion.recalls = 0; },
      s => { s.spiritWarlock.companion.acquiredWeek = null; },
      s => { s.spiritWarlock.companion.status = 'DEPLOYED'; s.spiritWarlock.companion.deployments += 1; },
      s => { s.spiritWarlock.companion.status = 'RELEASED'; },
      s => { s.spiritWarlock.practice.note = 'RECIPIENT'; s.spiritWarlock.practice.returns = 0; },
      s => { s.spiritWarlock.practice.returns = 2; },
      s => { s.spiritWarlock.practice.coordinationChecks = 0; },
      s => { s.spiritWarlock.cases['original-message']!.outcome = 'LEAVES_CHECKED'; },
      s => { s.spiritWarlock.cases['quiet-coordination']!.closes = 0; },
      s => { s.seer.completedSources.push('spirit-warlock-case:original-message'); },
      s => { s.progression.acting = 100; },
    ];
    for (const change of changes) { const s = structuredClone(completeState); change(s); expect(validateSpiritWarlockLife(s)).toBe(false); }
  });

  it('blocks interruptions, insufficient costs and premature encounters without changing state', () => {
    for (const change of [((s: SliceState) => { s.world.city = 'TINGEN'; }), (s: SliceState) => { s.actionsRemaining = 0; }, (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.mind = 0; }, (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.activeEvent = { id: 'pending', instanceId: 'pending' }; }]) {
      const s = promoted(); change(s); reject(s, { type: 'OBSERVE', caseId: 'listening-leaves' });
    }
    reject(soother(), { type: 'OBSERVE', caseId: 'listening-leaves' });
    const s = recruited(); begin(s, 'quiet-coordination', 'ABILITY'); s.spirituality = 3;
    reject(s, { type: 'PERFORM', caseId: 'quiet-coordination' }); act(s, { type: 'WITHDRAW', caseId: 'quiet-coordination' });
    reject(s, { type: 'ENCOUNTER_FIGHT' }); reject(s, { type: 'ENCOUNTER_TALK' }); reject(s, { type: 'REFLECT' });
    complete(s, 'listening-leaves');
    expect(spiritWarlockActions(s).find(a => a.command.type === 'ENCOUNTER_TALK')!.enabled).toBe(true);
  });
});
