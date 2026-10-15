import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createChaosHunterState } from '../../src/domain/chaos-hunter/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyChaosHunterEncounterCommand, createChaosHunterEncounterState, chaosHunterEncounterReason, hasChaosHunterDisputeOpponent,
  projectChaosHunterEncounter, validateChaosHunterEncounter, validateChaosHunterEncounterCommand, hasChaosHunterEncounterLock, CHAOS_HUNTER_POWERS } from '../../src/domain/chaos-hunter/encounter.js';
import { currentChaosHunterCombatSource } from '../../src/domain/chaos-hunter/combat.js';
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Explicit directed promotion/report setup; natural complete lineage is covered by shared tests. */
function fixture(): SliceState {
  const s = createSliceRun('chaos-hunter-encounter-directed', sliceDefaultCreationSelection, 'chaos-hunter-encounter');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 120; s.actionsRemaining = 6; s.cash = 1000; s.arc.stage = 'ENDED';
  s.progression = { pathwayId: 'justiciar', sequence: 3, mastery: {}, acting: 0, promotionWeek: 120 };
  s.chaosHunter = createChaosHunterState(); s.chaosHunter.guidanceKnown = true; s.chaosHunter.promotionWeek = 120; s.chaosHunter.imperativeMageActingAtPromotion = 100;
  s.chaosHunter.life.cases['paired-line'].status = 'RESOLVED'; s.health = 100; s.mind = 100; s.spirituality = 120; return s;
}
const oldRoots = (s: SliceState) => structuredClone({ arbiter: s.arbiter, sheriff: s.sheriff, interrogator: s.interrogator, judge: s.judge, punishmentKnight: s.punishmentKnight, imperativeMage: s.imperativeMage });
describe('Chaos Hunter directed independent adult, original rod and finite encounter', () => {
  it('creates one new44year adult S4 with owned rod and actual120S', () => {
    const s = fixture(), e = createChaosHunterEncounterState(); expect(e).toMatchObject({ targetId: 'CH3-EDRIC', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', playerBodyPending: false, enemyBodyPending: false });
    const p = projectChaosHunterEncounter(s); expect(p.enemy).toMatchObject({ id: 'CH3-EDRIC', name: '埃德里克·梅森', age: 44, sequence: 4, source: 'ORIGINAL_LIMITED_G', weaponId: 'CH3-EDRIC-ROD' });
    expect(p.scene).toMatchObject({ distanceMetres: 2, exitMetres: 4, thirdPartiesInArea: 0, ordinaryExit: 'OPEN' }); expect(CHAOS_HUNTER_POWERS.map(x => [x.cost, x.selfGain, x.enemyReduction])).toEqual([[5, 70, 0], [4, 0, 30], [4, 8, 0]]); expect(validateChaosHunterEncounter(s)).toBe(true);
  });
  it('talk and explicit fight are separate, and zeroAP peace exit takes real4m4s', () => {
    const s = fixture(), old = oldRoots(s); expect(chaosHunterEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    applyChaosHunterEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); expect(s.combat).toBeNull(); expect(s.actionsRemaining).toBe(5); expect(hasChaosHunterEncounterLock(s)).toBe(true);
    s.actionsRemaining = 0; s.mind = 0; applyChaosHunterEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context()); expect(s.actionsRemaining).toBe(0); expect(s.chaosHunter.life.clockSeconds).toBe(4);
    expect(s.chaosHunter.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', exitTravelMetres: 4, exitSeconds: 4, terminal: null });
    expect(s.chaosHunter.encounter.scene).toMatchObject({ playerPosition: 'EXIT', ordinaryWalkedMetres: 4 }); expect(oldRoots(s)).toEqual(old); expect(hasChaosHunterEncounterLock(s)).toBe(false); expect(validateChaosHunterEncounter(s)).toBe(true);
    expect(chaosHunterEncounterReason(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
  });
  it('starts only original Edric at2m without cloning old Rowan or changing any inherited root', () => {
    const s = fixture(), old = oldRoots(s), life = structuredClone(s.chaosHunter.life);
    applyChaosHunterEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); applyChaosHunterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(4); expect(hasChaosHunterDisputeOpponent(s)).toBe(true); expect(currentChaosHunterCombatSource(s)).toMatchObject({ encounterId: 'CHAOS_HUNTER_DISPUTE', targetId: 'CH3-EDRIC', targetSequence: 4, targetAge: 44, targetPhysique: 22, distanceMetres: 2, actualOriginalBody: true, enemyWeapon: 'CH3-EDRIC-ROD', weaponOwner: 'CH3-EDRIC' });
    expect(oldRoots(s)).toEqual(old); expect(s.chaosHunter.life).toEqual(life); expect(validateChaosHunterEncounter(s)).toBe(true);
    s.chaosHunter.encounter.targetId = 'IM4-ROWAN-KELL' as never; expect(hasChaosHunterDisputeOpponent(s)).toBe(false); expect(validateChaosHunterEncounter(s)).toBe(false);
  });
  it('requires an actual report, original city and closure of every pending original practice', () => {
    const cases: [string, (s: SliceState) => void][] = [
      ['报告', s => { s.chaosHunter.life.cases['paired-line'].status = 'AVAILABLE'; }], ['贝克兰德', s => { s.world.city = 'ELSEWHERE'; }],
      ['关闭', s => { s.chaosHunter.life.activeCase = 'paired-line'; }], ['关闭', s => { s.chaosHunter.preparedWeek = s.week; }],
      ['关闭', s => { s.imperativeMage.life.attention.consented = true; }], ['关闭', s => { s.imperativeMage.encounter.intimidationReady = true; }],
      ['关闭', s => { s.chaosHunter.life.cases['own-line'].status = 'PREPARED'; }],
    ];
    for (const [message, mutate] of cases) { const s = fixture(); mutate(s); expect(chaosHunterEncounterReason(s, { type: 'ENCOUNTER_TALK' })).toContain(message); }
  });
  it('keeps enoughAP for a real talk/fight choice without forcing combat', () => {
    const s = fixture(); s.actionsRemaining = 1; expect(chaosHunterEncounterReason(s, { type: 'ENCOUNTER_TALK' })).toContain('另留');
    s.actionsRemaining = 2; applyChaosHunterEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); expect(chaosHunterEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toBeNull(); expect(chaosHunterEncounterReason(s, { type: 'LEAVE_ENCOUNTER' })).toBeNull();
  });
  it('rejects unknown fields, fabricated resources, enemy identities and weapon transfer', () => {
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']) expect(validateChaosHunterEncounterCommand({ type })).toBe(true);
    for (const v of [{ type: 'ENCOUNTER_FIGHT', targetId: 'FM3-DARIAN' }, { type: 'LEAVE_ENCOUNTER', heal: true }, { type: 'PICK_UP' }, { type: 'BUY_BLOCKS' }, [], null]) expect(validateChaosHunterEncounterCommand(v)).toBe(false);
    for (const mutate of [(s: SliceState) => { s.chaosHunter.encounter.enemyHealth = 101; }, (s: SliceState) => { s.chaosHunter.encounter.weaponLocation = 'COURT'; },
      (s: SliceState) => { s.chaosHunter.encounter.enemySpirituality = 119; }, (s: SliceState) => { s.chaosHunter.encounter.playerBodyPending = true; },
      (s: SliceState) => { s.chaosHunter.encounter.boundedOrderAttempts = 1; }, (s: SliceState) => { s.chaosHunter.encounter.scene.distanceMetres = 4 as 2; },
      (s: SliceState) => { s.chaosHunter.encounter.exitSeconds = 4; }]) { const s = fixture(); mutate(s); expect(validateChaosHunterEncounter(s)).toBe(false); }
  });
  it('dead players cannot talk, start, leave or move their original body', () => {
    const s = fixture(); s.status = 'DEAD'; s.health = 0;
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'] as const) expect(chaosHunterEncounterReason(s, { type })).toContain('活着'); expect(currentChaosHunterCombatSource(s)).toBeNull();
  });
});
