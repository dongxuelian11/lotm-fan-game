import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createDreamWeaverState } from '../../src/domain/dream-weaver/index.js';
import {
  DREAM_WEAVER_CASE_IDS, DREAM_WEAVER_PERSON_IDS, applyDreamWeaverActivity, blockDreamWeaverActivity,
  createDreamWeaverLifeState, dreamWeaverLifeActions, hasDreamWeaverLifeLock, projectDreamWeaverLife,
  validateDreamWeaverActivityCommand, validateDreamWeaverLifeState, type DreamWeaverActivityCommand, type DreamWeaverCaseId,
} from '../../src/domain/dream-weaver/life.js';
const IDENTITY = 'audience.s3.external-identity', IMAGE = 'audience.s3.woven-image';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Explicit domain-unit post-promotion fixture; the natural 354-command route is tested separately. */
function ready(): SliceState {
  const s = createSliceRun('dream-weaver-life', sliceDefaultCreationSelection, 'dream-weaver-life');
  s.dreamWeaver = createDreamWeaverState(); s.week = 100; s.dreamWeaver.promotionWeek = 99;
  s.progression = { pathwayId: 'audience', sequence: 3, acting: 0, promotionWeek: 19, mastery: { [IDENTITY]: 0, [IMAGE]: 0, 'audience.s4.virtual-persona': 41 } };
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100;
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, c: DreamWeaverActivityCommand, roll = 1) { const ctx = context(s, roll); applyDreamWeaverActivity(s, c, ctx); expect(validateDreamWeaverLifeState(s)).toBe(true); return ctx; }
function reject(s: SliceState, c: DreamWeaverActivityCommand) { const before = structuredClone(s); expect(() => applyDreamWeaverActivity(s, c, context(s))).toThrow(); expect(s).toEqual(before); }
function prepare(s: SliceState, caseId: DreamWeaverCaseId, method: 'ABILITY' | 'ORDINARY') { if (s.dreamWeaver.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method }); }
function consent(s: SliceState) { for (const personId of DREAM_WEAVER_PERSON_IDS) act(s, { type: 'CONSENT', personId }); }
function begin(s: SliceState, caseId: DreamWeaverCaseId, method: 'ABILITY' | 'ORDINARY') { prepare(s, caseId, method); consent(s); act(s, { type: 'PERFORM', caseId }); }
function close(s: SliceState, caseId: DreamWeaverCaseId, report = true) { if (s.dreamWeaver.life.practice.identity) act(s, { type: 'REJOIN_IDENTITY' }); act(s, { type: 'VERIFY', caseId }); act(s, { type: 'CLOSE', caseId }); if (report) act(s, { type: 'REPORT', caseId }); }
function ordinaryTwoDesks(s: SliceState, start = true) { if (start) begin(s, 'two-desks', 'ORDINARY'); act(s, { type: 'TALK', actor: 'OWNER', personId: 'DWV3-OWEN' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'TALK', actor: 'OWNER', personId: 'DWV3-IRIS' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); close(s, 'two-desks'); }
function carryOriginal(s: SliceState, alreadyRead = false) { act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); if (!alreadyRead) act(s, { type: 'READ_MESSAGE', actor: 'OWNER' }); act(s, { type: 'TAKE_MESSAGE' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); act(s, { type: 'CHECK_MESSAGE' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'RETURN_MESSAGE' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); }
function ordinaryMessage(s: SliceState) { begin(s, 'original-message', 'ORDINARY'); carryOriginal(s); close(s, 'original-message'); }
function toBell(s: SliceState) { ordinaryTwoDesks(s); ordinaryMessage(s); }
function snapshotWithSortedKeys<T>(v: T): T { if (Array.isArray(v)) return v.map(snapshotWithSortedKeys) as T; if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => [k, snapshotWithSortedKeys(value)])) as T; return v; }

describe('Dream Weaver original people, finite identity and real ordinary exits', () => {
  it('creates a pristine independent room and hides it before sequence3', () => {
    const s = ready(); expect(validateDreamWeaverLifeState(s)).toBe(true); expect(s.dreamWeaver.life).toEqual(createDreamWeaverLifeState());
    expect(s.dreamWeaver.life.practice.participants['DWV3-IRIS']).toMatchObject({ age: 36, node: 'FAR', health: 100, mind: 100 });
    expect(s.dreamWeaver.life.practice.participants['DWV3-OWEN']).toMatchObject({ age: 44, node: 'NEAR' });
    s.progression.sequence = 4; expect(projectDreamWeaverLife(s)).toMatchObject({ practice: null, currentAttempt: null, cases: [], currentConsents: [] }); expect(dreamWeaverLifeActions(s)).toEqual([]);
  });
  it('requires two new current consents and never accepts old Mira or anonymous authorization', () => {
    const s = ready(); prepare(s, 'two-desks', 'ABILITY'); reject(s, { type: 'PERFORM', caseId: 'two-desks' });
    act(s, { type: 'CONSENT', personId: 'DWV3-IRIS' }); reject(s, { type: 'PERFORM', caseId: 'two-desks' }); act(s, { type: 'CONSENT', personId: 'DWV3-OWEN' }); act(s, { type: 'PERFORM', caseId: 'two-desks' });
    expect(validateDreamWeaverActivityCommand({ type: 'CONSENT', personId: 'MP4-MIRA' })).toBe(false); expect(validateDreamWeaverActivityCommand({ type: 'CONSENT' })).toBe(false);
  });
  it('prevents the last-AP preparation trap and allows a fully real zero-AP exit', () => {
    const s = ready(); act(s, { type: 'OBSERVE', caseId: 'two-desks' }); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'two-desks', method: 'ORDINARY' });
    s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'two-desks', method: 'ORDINARY' }); consent(s); act(s, { type: 'PERFORM', caseId: 'two-desks' }); expect(s.actionsRemaining).toBe(0);
    act(s, { type: 'TALK', actor: 'OWNER', personId: 'DWV3-OWEN' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'TALK', actor: 'OWNER', personId: 'DWV3-IRIS' }); reject(s, { type: 'CLOSE', caseId: 'two-desks' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); close(s, 'two-desks', false);
    expect(hasDreamWeaverLifeLock(s)).toBe(false); expect(s.actionsRemaining).toBe(0); reject(s, { type: 'REPORT', caseId: 'two-desks' });
  });
  it('actually moves one identity and exchanges only known facts at each occupied desk', () => {
    const s = ready(), old = structuredClone(s.manipulator), cash = s.cash; begin(s, 'two-desks', 'ABILITY');
    const ctx = act(s, { type: 'CREATE_IDENTITY' }); expect(ctx.check).toHaveBeenCalledWith('will', 16); expect(s.spirituality).toBe(115); expect(s.mind).toBe(98);
    expect(s.dreamWeaver.life.practice.identity).toMatchObject({ source: 'OWNER_SHARED_THOUGHT', originalName: s.character.name, node: 'NEAR', remainingSeconds: 60, limitMetres: 6 });
    reject(s, { type: 'CREATE_IDENTITY' }); reject(s, { type: 'TALK', actor: 'IDENTITY', personId: 'DWV3-IRIS' });
    act(s, { type: 'TALK', actor: 'OWNER', personId: 'DWV3-OWEN' }); act(s, { type: 'MOVE', actor: 'IDENTITY', to: 'FAR' }); act(s, { type: 'TALK', actor: 'IDENTITY', personId: 'DWV3-IRIS' });
    expect(s.dreamWeaver.life.practice.ownerNode).toBe('NEAR'); expect(s.dreamWeaver.life.practice.identity?.remainingSeconds).toBe(53); reject(s, { type: 'VERIFY', caseId: 'two-desks' }); close(s, 'two-desks');
    expect(s.progression.mastery[IDENTITY]).toBe(8); expect(s.progression.mastery[IMAGE]).toBe(0); expect(s.progression.mastery['audience.s4.virtual-persona']).toBe(41); expect(s.cash).toBe(cash); expect(s.manipulator).toEqual(old);
  });
  it('keeps failed creation costs and uses an ordinary fallback without any further ability roll', () => {
    const s = ready(); begin(s, 'two-desks', 'ABILITY'); act(s, { type: 'CREATE_IDENTITY' }, 100); expect(s.dreamWeaver.life.practice.identity).toBeNull(); reject(s, { type: 'CREATE_IDENTITY' });
    ordinaryTwoDesks(s, false); expect(s.spirituality).toBe(115); expect(s.mind).toBe(98); expect(s.progression.mastery[IDENTITY]).toBe(0);
    expect(s.dreamWeaver.life.cases['two-desks'].attempts[0]).toMatchObject({ identityAttempted: true, identityCreated: false, result: 'ORDINARY', ownerTravelMetres: 6, spiritualitySpent: 5, ownerMindSpent: 2 });
  });
  it('identity expiry never teleports the owner home or restores spent resources', () => {
    const s = ready(); begin(s, 'two-desks', 'ABILITY'); act(s, { type: 'CREATE_IDENTITY' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'WAIT_IDENTITY' });
    expect(s.dreamWeaver.life.practice.identity).toBeNull(); expect(s.dreamWeaver.life.practice.ownerNode).toBe('FAR'); expect(s.dreamWeaver.life.cases['two-desks'].attempts[0]).toMatchObject({ identityEnd: 'EXPIRED', elapsedSeconds: 62 });
    reject(s, { type: 'CLOSE', caseId: 'two-desks' }); s.actionsRemaining = 0; s.mind = 0; act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); act(s, { type: 'CLOSE', caseId: 'two-desks' }); expect(hasDreamWeaverLifeLock(s)).toBe(false); expect(s.spirituality).toBe(115); expect(s.mind).toBe(0);
  });
  it('explicit identity rejoin at the far desk also leaves the original body at its actual location', () => {
    const s = ready(); begin(s, 'two-desks', 'ABILITY'); act(s, { type: 'CREATE_IDENTITY' }); act(s, { type: 'MOVE', actor: 'IDENTITY', to: 'FAR' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'REJOIN_IDENTITY' });
    expect(s.dreamWeaver.life.practice.ownerNode).toBe('FAR'); reject(s, { type: 'CLOSE', caseId: 'two-desks' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); act(s, { type: 'CLOSE', caseId: 'two-desks' });
  });
  it('does not expose the original message until an authorized actor truly reads it at the far desk', () => {
    const s = ready(); ordinaryTwoDesks(s); begin(s, 'original-message', 'ABILITY');
    expect(projectDreamWeaverLife(s).practice?.knownMessage).toBeNull(); expect(JSON.stringify(projectDreamWeaverLife(s))).not.toContain('今晚我会亲自合上西窗');
    reject(s, { type: 'READ_MESSAGE', actor: 'OWNER' }); reject(s, { type: 'READ_MESSAGE', actor: 'IDENTITY' }); reject(s, { type: 'CHECK_MESSAGE' });
    act(s, { type: 'CREATE_IDENTITY' }); act(s, { type: 'MOVE', actor: 'IDENTITY', to: 'FAR' }); act(s, { type: 'READ_MESSAGE', actor: 'IDENTITY' });
    expect(projectDreamWeaverLife(s).practice?.knownMessage).toMatchObject({ sourceId: 'DWV3-MESSAGE', reader: 'IDENTITY', text: expect.stringContaining('今晚我会亲自合上西窗') });
    expect(s.dreamWeaver.life.practice.message).toEqual({ id: 'DWV3-MESSAGE', ownerId: 'DWV3-IRIS', holder: 'FAR_DESK' }); expect(s.dreamWeaver.life.practice.ownerNode).toBe('NEAR'); reject(s, { type: 'TAKE_MESSAGE' });
  });
  it('requires the owner to carry the same paper through all four real 3m legs after identity reading', () => {
    const s = ready(); ordinaryTwoDesks(s); begin(s, 'original-message', 'ABILITY'); act(s, { type: 'CREATE_IDENTITY' }); act(s, { type: 'MOVE', actor: 'IDENTITY', to: 'FAR' }); act(s, { type: 'READ_MESSAGE', actor: 'IDENTITY' }); act(s, { type: 'REJOIN_IDENTITY' });
    act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'TAKE_MESSAGE' }); reject(s, { type: 'CHECK_MESSAGE' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); act(s, { type: 'CHECK_MESSAGE' }); reject(s, { type: 'RETURN_MESSAGE' });
    act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'RETURN_MESSAGE' }); reject(s, { type: 'CLOSE', caseId: 'original-message' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); close(s, 'original-message');
    expect(s.dreamWeaver.life.cases['original-message'].attempts[0]).toMatchObject({ ownerTravelMetres: 12, identityTravelMetres: 3, messageReadBy: 'IDENTITY', messageTaken: true, messageChecked: true, messageReturned: true, result: 'ABILITY' }); expect(s.progression.mastery[IDENTITY]).toBe(8);
  });
  it('withdrawn consent forbids further reading but still permits real paper return and body exit at zero AP', () => {
    const s = ready(); ordinaryTwoDesks(s); begin(s, 'original-message', 'ORDINARY'); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'READ_MESSAGE', actor: 'OWNER' }); act(s, { type: 'TAKE_MESSAGE' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); act(s, { type: 'REVOKE_CONSENT', personId: 'DWV3-IRIS' });
    reject(s, { type: 'CHECK_MESSAGE' }); reject(s, { type: 'CLOSE', caseId: 'original-message' }); s.actionsRemaining = 0; act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'RETURN_MESSAGE' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); act(s, { type: 'WITHDRAW', caseId: 'original-message' });
    expect(hasDreamWeaverLifeLock(s)).toBe(false); expect(s.dreamWeaver.life.cases['original-message'].result).toBe('NONE'); expect(s.dreamWeaver.life.practice.knownMessage).not.toBeNull();
  });
  it('a failed or withdrawn attempt remains in history and cannot re-roll in the same week', () => {
    const s = ready(); begin(s, 'two-desks', 'ABILITY'); act(s, { type: 'CREATE_IDENTITY' }, 100); act(s, { type: 'CLOSE', caseId: 'two-desks' }); reject(s, { type: 'PREPARE', caseId: 'two-desks', method: 'ABILITY' }); s.week++; ordinaryTwoDesks(s);
    expect(s.dreamWeaver.life.cases['two-desks'].attempts).toHaveLength(2); expect(s.dreamWeaver.life.cases['two-desks'].attempts[0]).toMatchObject({ result: 'NONE', closed: true, identityAttempted: true, spiritualitySpent: 5 }); expect(s.progression.mastery[IDENTITY]).toBe(0);
  });
  it('gives a target-specific mental consequence, then recognition, stop and original-bell verification', () => {
    const s = ready(); toBell(s); begin(s, 'woven-bell', 'ABILITY'); const ctx = act(s, { type: 'WOVEN_IMAGE' }); expect(ctx.check).toHaveBeenCalledWith('will', 16); expect(s.spirituality).toBe(114);
    expect(s.dreamWeaver.life.practice.image).toMatchObject({ source: 'KNOWN_ORIGINAL_BELL', targetId: 'DWV3-OWEN', believed: false }); reject(s, { type: 'CHECK_BELL' }); act(s, { type: 'BELIEVE_IMAGE' });
    expect(s.dreamWeaver.life.practice.participants['DWV3-OWEN']).toMatchObject({ health: 100, mind: 98 }); expect(s.dreamWeaver.life.practice.participants['DWV3-IRIS'].mind).toBe(100); reject(s, { type: 'BELIEVE_IMAGE' }); act(s, { type: 'RECOGNIZE_IMAGE' }); expect(s.dreamWeaver.life.practice.image?.believed).toBe(false); act(s, { type: 'STOP_IMAGE' }); act(s, { type: 'CHECK_BELL' }); close(s, 'woven-bell');
    expect(s.progression.mastery[IMAGE]).toBe(8); expect(s.progression.mastery[IDENTITY]).toBe(0); expect(s.dreamWeaver.life.practice.bell).toEqual(createDreamWeaverLifeState().practice.bell); expect(s.dreamWeaver.life.practice.participants['DWV3-OWEN'].mind).toBe(98);
  });
  it('allows a participant to stop the image immediately and preserves the real prior mind cost', () => {
    const s = ready(); toBell(s); begin(s, 'woven-bell', 'ABILITY'); act(s, { type: 'WOVEN_IMAGE' }); act(s, { type: 'BELIEVE_IMAGE' }); act(s, { type: 'REVOKE_CONSENT', personId: 'DWV3-OWEN' }); reject(s, { type: 'RECOGNIZE_IMAGE' }); s.actionsRemaining = 0; s.mind = 0; act(s, { type: 'STOP_IMAGE' }); act(s, { type: 'WITHDRAW', caseId: 'woven-bell' });
    expect(s.dreamWeaver.life.practice.participants['DWV3-OWEN'].mind).toBe(98); expect(s.spirituality).toBe(114); expect(s.progression.mastery[IMAGE]).toBe(0); expect(hasDreamWeaverLifeLock(s)).toBe(false);
  });
  it('failed image spends6S once and can complete by ordinary comparison without another check', () => {
    const s = ready(); toBell(s); begin(s, 'woven-bell', 'ABILITY'); act(s, { type: 'WOVEN_IMAGE' }, 100); reject(s, { type: 'WOVEN_IMAGE' }); const ctx = act(s, { type: 'CHECK_BELL' }); expect(ctx.check).not.toHaveBeenCalled(); close(s, 'woven-bell');
    expect(s.spirituality).toBe(114); expect(s.dreamWeaver.life.practice.participants['DWV3-OWEN'].mind).toBe(100); expect(s.dreamWeaver.life.cases['woven-bell'].result).toBe('ORDINARY'); expect(s.progression.mastery[IMAGE]).toBe(0);
  });
  it('three all-ordinary cases reach100 with reflection, no spell costs and no new mastery', () => {
    const s = ready(), old = structuredClone(s.manipulator); toBell(s); begin(s, 'woven-bell', 'ORDINARY'); reject(s, { type: 'WOVEN_IMAGE' }); act(s, { type: 'CHECK_BELL' }); close(s, 'woven-bell'); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual({ [IDENTITY]: 0, [IMAGE]: 0, 'audience.s4.virtual-persona': 41 }); expect(s.spirituality).toBe(120); expect(s.mind).toBe(100); expect(s.manipulator).toEqual(old); expect(s.dreamWeaver.life.practice.ownerNode).toBe('NEAR'); expect(hasDreamWeaverLifeLock(s)).toBe(false); reject(s, { type: 'REFLECT' });
  });
  it('insufficient spirituality offers ordinary work and never generates free identities or equipment', () => {
    const s = ready(); begin(s, 'two-desks', 'ABILITY'); s.spirituality = 4; reject(s, { type: 'CREATE_IDENTITY' }); ordinaryTwoDesks(s, false); expect(s.spirituality).toBe(4); expect(s.progression.mastery[IDENTITY]).toBe(0);
    expect(validateDreamWeaverActivityCommand({ type: 'CREATE_IDENTITY', count: 2 })).toBe(false); expect(validateDreamWeaverActivityCommand({ type: 'TAKE_MESSAGE', actor: 'IDENTITY' })).toBe(false); expect(validateDreamWeaverActivityCommand({ type: 'WOVEN_IMAGE', source: 'HIGHER_SOUL' })).toBe(false);
  });
  it('projects and enumerates cases in fixed order regardless of persisted object-key ordering', () => {
    const s = ready(); ordinaryTwoDesks(s); begin(s, 'original-message', 'ORDINARY'); const sorted = snapshotWithSortedKeys(s);
    expect(validateDreamWeaverLifeState(sorted)).toBe(true); expect(projectDreamWeaverLife(sorted)).toEqual(projectDreamWeaverLife(s)); expect(projectDreamWeaverLife(sorted).cases.map(c => c.id)).toEqual([...DREAM_WEAVER_CASE_IDS]); expect(dreamWeaverLifeActions(sorted)).toEqual(dreamWeaverLifeActions(s));
  });
  it('validation rejects fabricated messages, duplicate originals, cost refunds and unearned results', () => {
    const base = ready(); begin(base, 'two-desks', 'ABILITY'); act(base, { type: 'CREATE_IDENTITY' });
    const changes: ((s: SliceState) => void)[] = [
      s => { Object.assign(s.dreamWeaver.life.practice.message, { id: 'COPY' }); },
      s => { Object.assign(s.dreamWeaver.life.practice.identity!, { spirituality: 120 }); },
      s => { s.dreamWeaver.life.practice.identity!.remainingSeconds = 61; },
      s => { s.dreamWeaver.life.cases['two-desks'].attempts[0]!.ownerMindSpent = 0; },
      s => { s.dreamWeaver.life.practice.participants['DWV3-IRIS'].mind = 98; },
      s => { s.dreamWeaver.life.practice.knownMessage = { sourceId: 'DWV3-MESSAGE', text: 'secret invented truth', readWeek: s.week, reader: 'IDENTITY' }; },
      s => { s.dreamWeaver.life.cases['two-desks'].result = 'ABILITY'; },
    ];
    for (const change of changes) { const s = structuredClone(base); change(s); expect(validateDreamWeaverLifeState(s)).toBe(false); }
  });
  it('prepared consent ends on withdrawal and cannot be carried into a new preparation or real week', () => {
    const s = ready(); prepare(s, 'two-desks', 'ORDINARY'); consent(s); act(s, { type: 'WITHDRAW', caseId: 'two-desks' }); expect(projectDreamWeaverLife(s).currentConsents.every(c => !c.consented)).toBe(true); prepare(s, 'two-desks', 'ORDINARY'); reject(s, { type: 'PERFORM', caseId: 'two-desks' }); consent(s); s.week++; reject(s, { type: 'PERFORM', caseId: 'two-desks' }); act(s, { type: 'WITHDRAW', caseId: 'two-desks' }); expect(hasDreamWeaverLifeLock(s)).toBe(false);
  });
  it('returns a public reason for same-node moves, unfinished closure and premature report', () => {
    const s = ready(); begin(s, 'two-desks', 'ORDINARY'); expect(blockDreamWeaverActivity(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' })).toContain('目的桌'); expect(blockDreamWeaverActivity(s, { type: 'REPORT', caseId: 'two-desks' })).not.toBeNull(); const actions = dreamWeaverLifeActions(s); expect(actions.some(a => a.command.type === 'MOVE' && a.command.actor === 'OWNER' && a.command.to === 'FAR' && a.enabled)).toBe(true); expect(actions.every(a => a.enabled === (a.reason === null))).toBe(true);
  });
});
