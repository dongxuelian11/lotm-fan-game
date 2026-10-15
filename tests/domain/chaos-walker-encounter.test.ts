import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createChaosWalkerState } from '../../src/domain/chaos-walker/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyChaosWalkerEncounterCommand, createChaosWalkerEncounterState, chaosWalkerEncounterReason, hasChaosWalkerDisputeOpponent,
  projectChaosWalkerEncounter, validateChaosWalkerEncounter, validateChaosWalkerEncounterCommand, hasChaosWalkerEncounterLock, CHAOS_WALKER_POWERS } from '../../src/domain/chaos-walker/encounter.js';
import { currentChaosWalkerCombatSource } from '../../src/domain/chaos-walker/combat.js';
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Explicit directed promotion/report setup; natural complete lineage is covered by shared tests. */
function fixture(): SliceState {
  const s = createSliceRun('chaos-encounter-directed', sliceDefaultCreationSelection, 'chaos-encounter');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 120; s.actionsRemaining = 6; s.cash = 1000; s.arc.stage = 'ENDED';
  s.progression = { pathwayId: 'wheel', sequence: 3, mastery: {}, acting: 0, promotionWeek: 120 };
  s.chaosWalker = createChaosWalkerState(); s.chaosWalker.guidanceKnown = true; s.chaosWalker.promotionWeek = 120; s.chaosWalker.misfortuneMageActingAtPromotion = 100;
  s.chaosWalker.life.cases['cart-fork'].status = 'RESOLVED'; s.health = 100; s.mind = 100; s.spirituality = 120; return s;
}
const oldRoots = (s: SliceState) => structuredClone({ monster: s.monster, machine: s.machine, lucky: s.lucky, calamityPriest: s.calamityPriest, winner: s.winner, misfortuneMage: s.misfortuneMage });
describe('Chaos Walker independent adult, original rod and finite encounter', () => {
  it('creates one new46year adult S4 with owned rod and actual120S', () => {
    const s = fixture(), e = createChaosWalkerEncounterState(); expect(e).toMatchObject({ targetId: 'CW3-GARETH', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', pendingKind: null });
    const p = projectChaosWalkerEncounter(s); expect(p.enemy).toMatchObject({ id: 'CW3-GARETH', name: '加雷斯·默瑟', age: 46, sequence: 4, source: 'ORIGINAL_LIMITED_G', weaponId: 'CW3-GARETH-ROD' });
    expect(p.scene).toMatchObject({ distanceMetres: 2, exitMetres: 4, thirdPartiesInArea: 0, ordinaryExit: 'OPEN' }); expect(CHAOS_WALKER_POWERS.map(x => [x.cost, x.selfGain, x.enemyReduction])).toEqual([[5, 70, 0], [4, 0, 30], [4, 8, 0]]); expect(validateChaosWalkerEncounter(s)).toBe(true);
  });
  it('talk and explicit fight are separate, and zeroAP peace exit takes real4m4s', () => {
    const s = fixture(), old = oldRoots(s); expect(chaosWalkerEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    applyChaosWalkerEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); expect(s.combat).toBeNull(); expect(s.actionsRemaining).toBe(5); expect(hasChaosWalkerEncounterLock(s)).toBe(true);
    s.actionsRemaining = 0; s.mind = 0; applyChaosWalkerEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context()); expect(s.actionsRemaining).toBe(0); expect(s.chaosWalker.life.clockSeconds).toBe(4);
    expect(s.chaosWalker.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', exitTravelMetres: 4, exitSeconds: 4, terminal: null });
    expect(s.chaosWalker.encounter.scene).toMatchObject({ playerPosition: 'EXIT', ordinaryWalkedMetres: 4 }); expect(oldRoots(s)).toEqual(old); expect(hasChaosWalkerEncounterLock(s)).toBe(false); expect(validateChaosWalkerEncounter(s)).toBe(true);
    expect(chaosWalkerEncounterReason(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
  });
  it('starts only original Gareth at2m without cloning old Ferris or changing any inherited root', () => {
    const s = fixture(), old = oldRoots(s), life = structuredClone(s.chaosWalker.life);
    applyChaosWalkerEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); applyChaosWalkerEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(4); expect(hasChaosWalkerDisputeOpponent(s)).toBe(true); expect(currentChaosWalkerCombatSource(s)).toMatchObject({ encounterId: 'CHAOS_WALKER_DISPUTE', targetId: 'CW3-GARETH', targetSequence: 4, targetAge: 46, targetPhysique: 22, distanceMetres: 2, actualOriginalBody: true, enemyWeapon: 'CW3-GARETH-ROD', weaponOwner: 'CW3-GARETH' });
    expect(oldRoots(s)).toEqual(old); expect(s.chaosWalker.life).toEqual(life); expect(validateChaosWalkerEncounter(s)).toBe(true);
    s.chaosWalker.encounter.targetId = 'MM4-FERRIS-LORNE' as never; expect(hasChaosWalkerDisputeOpponent(s)).toBe(false); expect(validateChaosWalkerEncounter(s)).toBe(false);
  });
  it('requires an actual report, original city and closure of every pending original practice', () => {
    const cases: [string, (s: SliceState) => void][] = [
      ['报告', s => { s.chaosWalker.life.cases['cart-fork'].status = 'AVAILABLE'; }], ['贝克兰德', s => { s.world.city = 'ELSEWHERE'; }],
      ['关闭', s => { s.chaosWalker.life.activeCase = 'cart-fork'; }], ['关闭', s => { s.chaosWalker.preparedWeek = s.week; }],
      ['关闭', s => { s.winner.practice.ring = 'MAT'; }], ['关闭', s => { s.misfortuneMage.life.weight.permission = true; }],
      ['关闭', s => { s.chaosWalker.life.cases['counterexample'].status = 'PREPARED'; }],
    ];
    for (const [message, mutate] of cases) { const s = fixture(); mutate(s); expect(chaosWalkerEncounterReason(s, { type: 'ENCOUNTER_TALK' })).toContain(message); }
  });
  it('keeps enoughAP for a real talk/fight choice without forcing combat', () => {
    const s = fixture(); s.actionsRemaining = 1; expect(chaosWalkerEncounterReason(s, { type: 'ENCOUNTER_TALK' })).toContain('另留');
    s.actionsRemaining = 2; applyChaosWalkerEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); expect(chaosWalkerEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toBeNull(); expect(chaosWalkerEncounterReason(s, { type: 'LEAVE_ENCOUNTER' })).toBeNull();
  });
  it('rejects unknown fields, fabricated resources, enemy identities and weapon transfer', () => {
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']) expect(validateChaosWalkerEncounterCommand({ type })).toBe(true);
    for (const v of [{ type: 'ENCOUNTER_FIGHT', targetId: 'CW3-VERA' }, { type: 'LEAVE_ENCOUNTER', heal: true }, { type: 'PICK_UP' }, { type: 'BUY_BLOCKS' }, [], null]) expect(validateChaosWalkerEncounterCommand(v)).toBe(false);
    for (const mutate of [(s: SliceState) => { s.chaosWalker.encounter.enemyHealth = 101; }, (s: SliceState) => { s.chaosWalker.encounter.weaponLocation = 'COURT'; },
      (s: SliceState) => { s.chaosWalker.encounter.enemySpirituality = 119; }, (s: SliceState) => { s.chaosWalker.encounter.pendingKind = 'FUTURE_IMPEDIMENT'; },
      (s: SliceState) => { s.chaosWalker.encounter.luckAttempts = 1; }, (s: SliceState) => { s.chaosWalker.encounter.scene.distanceMetres = 4 as 2; },
      (s: SliceState) => { s.chaosWalker.encounter.exitSeconds = 4; }]) { const s = fixture(); mutate(s); expect(validateChaosWalkerEncounter(s)).toBe(false); }
  });
  it('dead players cannot talk, start, leave or move their original body', () => {
    const s = fixture(); s.status = 'DEAD'; s.health = 0;
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'] as const) expect(chaosWalkerEncounterReason(s, { type })).toContain('活着'); expect(currentChaosWalkerCombatSource(s)).toBeNull();
  });
});
