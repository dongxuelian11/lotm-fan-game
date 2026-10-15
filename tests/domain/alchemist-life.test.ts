import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createAlchemistState } from '../../src/domain/alchemist/index.js';
import { ALCHEMIST_ABILITY_IDS } from '../../src/domain/alchemist/types.js';
import { applyAlchemistActivity, blockAlchemistLife, createAlchemistLifeState, findAlchemistFrame, hasAlchemistLifeLock, projectAlchemistLife, validateAlchemistActivityCommand, validateAlchemistLife, type AlchemistActivityCommand, type AlchemistCaseId } from '../../src/domain/alchemist/life.js';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Narrow post-promotion domain fixture; real acquisition and SQLite are tested independently. */
function ready(): SliceState { const s = createSliceRun('alchemist-life', sliceDefaultCreationSelection, 'alchemist-life'); s.alchemist = createAlchemistState(); s.week = 20; s.alchemist.promotionWeek = 19; s.progression = { pathwayId: 'paragon', sequence: 4, acting: 0, promotionWeek: 19, mastery: Object.fromEntries(ALCHEMIST_ABILITY_IDS.map(id => [id, 0])) }; s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s; }
function act(s: SliceState, c: AlchemistActivityCommand, roll = 1) { const ctx = context(s, roll); applyAlchemistActivity(s, c, ctx); expect(validateAlchemistLife(s)).toBe(true); return ctx; }
function reject(s: SliceState, c: AlchemistActivityCommand) { const before = structuredClone(s); expect(() => applyAlchemistActivity(s, c, context(s))).toThrow(); expect(s).toEqual(before); }
function prepare(s: SliceState, caseId: AlchemistCaseId, method: 'ABILITY' | 'ORDINARY') { if (s.alchemist.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId }); if (caseId !== 'maker-account' && s.alchemist.life.materials[caseId === 'messenger-box' ? 0 : 1]!.status === 'SUPPLIER') act(s, { type: 'BUY_KIT', caseId }); act(s, { type: 'PREPARE', caseId, method }); if (caseId !== 'maker-account' && !s.alchemist.life.creations.some(x => x.id === (caseId === 'messenger-box' ? 'AL4-BOX-1' : 'AL4-FRAME-1'))) act(s, { type: 'ASSEMBLE', caseId }); }
function finish(s: SliceState, caseId: AlchemistCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') { prepare(s, caseId, method); act(s, { type: 'PERFORM', caseId }); if (caseId === 'maker-account') act(s, { type: 'RETURN_MATERIAL', caseId }); else { act(s, { type: caseId === 'messenger-box' ? 'MOVE_CREATION' : 'GUARD_CREATION', caseId }); if (method === 'ABILITY') act(s, { type: 'STOP_CREATION', caseId }); act(s, { type: 'RETURN_CREATION', caseId }); } act(s, { type: 'CLOSE', caseId }); act(s, { type: 'REPORT', caseId }); }
const mastery = (s: SliceState) => Object.values(s.progression.mastery).reduce((a, b) => a + b, 0);

describe('Alchemist finite personally manufactured life cases', () => {
  it('has no fabricated original creations before purchasing and personally assembling actual material', () => {
    const s = ready(); expect(s.alchemist.life.creations).toEqual([]); reject(s, { type: 'ASSEMBLE', caseId: 'messenger-box' });
    act(s, { type: 'OBSERVE', caseId: 'messenger-box' }); reject(s, { type: 'PREPARE', caseId: 'messenger-box', method: 'ABILITY' });
    act(s, { type: 'BUY_KIT', caseId: 'messenger-box' }); expect(s.cash).toBe(920); expect(s.alchemist.life.creations).toEqual([]); reject(s, { type: 'BUY_KIT', caseId: 'messenger-box' });
    act(s, { type: 'PREPARE', caseId: 'messenger-box', method: 'ABILITY' }); reject(s, { type: 'PERFORM', caseId: 'messenger-box' });
    act(s, { type: 'ASSEMBLE', caseId: 'messenger-box' }); const box = s.alchemist.life.creations[0]!;
    expect(box).toMatchObject({ id: 'AL4-BOX-1', madeBy: s.runId, owner: 'PLAYER', custodian: 'PLAYER', location: 'PLAYER', charge: 0, durability: 100, active: false });
    expect(box.componentIds).toEqual(s.alchemist.life.materials[0]!.componentIds); expect(s.alchemist.life.materials[0]!.status).toBe('CONSUMED'); reject(s, { type: 'ASSEMBLE', caseId: 'messenger-box' });
  });
  it('moves only the same original parcel two metres, then requires actual stop and return before report', () => {
    const s = ready(); prepare(s, 'messenger-box', 'ABILITY'); const box = s.alchemist.life.creations[0]!;
    act(s, { type: 'PERFORM', caseId: 'messenger-box' }); expect(s.spirituality).toBe(117); expect(box).toMatchObject({ location: 'BENCH_START', charge: 3, active: true });
    reject(s, { type: 'CLOSE', caseId: 'messenger-box' }); act(s, { type: 'MOVE_CREATION', caseId: 'messenger-box' });
    expect(box).toMatchObject({ location: 'BENCH_END', charge: 2 }); expect(s.alchemist.life.parcel).toMatchObject({ id: 'AL4-PARCEL-1', location: 'BENCH_END', custodian: 'AL4-BOX-1', weightGrams: 200 }); reject(s, { type: 'MOVE_CREATION', caseId: 'messenger-box' }); reject(s, { type: 'RETURN_CREATION', caseId: 'messenger-box' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; act(s, { type: 'STOP_CREATION', caseId: 'messenger-box' }); act(s, { type: 'RETURN_CREATION', caseId: 'messenger-box' }); act(s, { type: 'CLOSE', caseId: 'messenger-box' });
    expect(hasAlchemistLifeLock(s)).toBe(false); expect(s.alchemist.life.creations[0]).toBe(box); expect(box).toMatchObject({ location: 'PLAYER', charge: 2, active: false }); expect(s.alchemist.life.parcel.location).toBe('OWNER');
    s.actionsRemaining = 1; s.mind = 100; act(s, { type: 'REPORT', caseId: 'messenger-box' }); expect(s.progression.acting).toBe(25); expect(mastery(s)).toBe(8); reject(s, { type: 'REPORT', caseId: 'messenger-box' });
  });
  it('failure keeps AP, real materials and SP cost; zero-resource cleanup and later real week retry work', () => {
    const s = ready(); prepare(s, 'messenger-box', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'messenger-box' }, 100);
    expect(s.spirituality).toBe(117); expect(s.alchemist.life.creations[0]!.charge).toBe(0); reject(s, { type: 'MOVE_CREATION', caseId: 'messenger-box' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; act(s, { type: 'RETURN_CREATION', caseId: 'messenger-box' }); act(s, { type: 'WITHDRAW', caseId: 'messenger-box' });
    s.actionsRemaining = 100; s.mind = 100; reject(s, { type: 'PREPARE', caseId: 'messenger-box', method: 'ORDINARY' }); s.week++; finish(s, 'messenger-box'); expect(s.cash).toBe(920); expect(mastery(s)).toBe(0); expect(s.alchemist.life.creations).toHaveLength(1);
  });
  it('guard consumes actual finite charge and durability and recharge requires full real payment', () => {
    const s = ready(); finish(s, 'messenger-box'); finish(s, 'guard-frame', 'ABILITY'); const frame = findAlchemistFrame(s)!;
    expect(frame).toMatchObject({ charge: 2, durability: 95, active: false, location: 'PLAYER', madeBy: s.runId }); expect(s.cash).toBe(800); expect(s.spirituality).toBe(115);
    const ap = s.actionsRemaining; act(s, { type: 'RECHARGE_FRAME' }); expect(findAlchemistFrame(s)).toBe(frame); expect(frame).toMatchObject({ charge: 3, durability: 95, active: false }); expect(s.cash).toBe(760); expect(s.spirituality).toBe(112); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECHARGE_FRAME' });
    frame.charge = 0; s.cash = 39; reject(s, { type: 'RECHARGE_FRAME' }); s.cash = 40; s.spirituality = 2; reject(s, { type: 'RECHARGE_FRAME' });
  });
  it('ordinary manufacture and maker account finish acting100 without inventing ability mastery', () => {
    const s = ready(); finish(s, 'messenger-box'); finish(s, 'guard-frame'); prepare(s, 'maker-account', 'ORDINARY');
    act(s, { type: 'PERFORM', caseId: 'maker-account' }); expect(s.alchemist.life.pieceRecords).toEqual(['AL4-BOX-1', 'AL4-FRAME-1']); expect(s.alchemist.life.entrustedMaterial.custodian).toBe('PLAYER'); reject(s, { type: 'CLOSE', caseId: 'maker-account' });
    act(s, { type: 'RETURN_MATERIAL', caseId: 'maker-account' }); act(s, { type: 'CLOSE', caseId: 'maker-account' }); act(s, { type: 'REPORT', caseId: 'maker-account' }); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(mastery(s)).toBe(0); expect(s.spirituality).toBe(120); expect(s.alchemist.life.creations.every(x => !x.active && x.charge === 0)).toBe(true); reject(s, { type: 'REFLECT' });
  });
  it('allows cancellation before assembly without returning money or deleting materials', () => { const s = ready(); act(s, { type: 'OBSERVE', caseId: 'messenger-box' }); act(s, { type: 'BUY_KIT', caseId: 'messenger-box' }); act(s, { type: 'PREPARE', caseId: 'messenger-box', method: 'ABILITY' }); s.actionsRemaining = 0; act(s, { type: 'WITHDRAW', caseId: 'messenger-box' }); expect(s.cash).toBe(920); expect(s.alchemist.life.materials[0]!.status).toBe('PLAYER'); expect(s.alchemist.life.creations).toEqual([]); });
  it('rejects copy source, excess finite charge, fake maker account ability and unsafe unknown commands', () => {
    const s = ready(); finish(s, 'messenger-box'); const saved = structuredClone(s);
    s.alchemist.life.creations[0]!.madeBy = 'OTHER_RUN'; expect(validateAlchemistLife(s)).toBe(false); s.alchemist.life = structuredClone(saved.alchemist.life);
    s.alchemist.life.creations[0]!.charge = 4; expect(validateAlchemistLife(s)).toBe(false); s.alchemist.life = structuredClone(saved.alchemist.life);
    finish(s, 'guard-frame'); act(s, { type: 'OBSERVE', caseId: 'maker-account' }); reject(s, { type: 'PREPARE', caseId: 'maker-account', method: 'ABILITY' });
    for (const bad of [{ type: 'SET_LIFE', charge: 3 }, { type: 'RECHARGE_FRAME', amount: 3 }, { type: 'ASSEMBLE', caseId: 'forged' }, { type: 'PERFORM', caseId: 'messenger-box', soul: 'PERMANENT' }]) expect(validateAlchemistActivityCommand(bad)).toBe(false);
  });
  it('projects current original source, materials, charge, custodian and legal cleanup actions', () => { const s = ready(); prepare(s, 'messenger-box', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'messenger-box' }); const p = projectAlchemistLife(s); expect(p.creations[0]).toMatchObject({ id: 'AL4-BOX-1', charge: 3, location: 'BENCH_START', custodian: 'PLAYER', madeBy: s.runId }); expect(p.actions.find(a => a.command.type === 'STOP_CREATION')?.enabled).toBe(true); p.creations[0]!.charge = 0; expect(s.alchemist.life.creations[0]!.charge).toBe(3); expect(blockAlchemistLife(s, { type: 'REFLECT' })).not.toBeNull(); });
  it('accepts untouched life for unrelated paths and rejects premature manufactured objects', () => { const s = ready(); s.progression.pathwayId = 'hunter'; s.progression.sequence = 9; expect(validateAlchemistLife(s)).toBe(true); s.alchemist.life.rechargeCount = 1; expect(validateAlchemistLife(s)).toBe(false); expect(createAlchemistLifeState().creations).toEqual([]); });
});
