import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createFrenzyMageState } from '../../src/domain/frenzy-mage/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyFrenzyMageEncounterCommand, createFrenzyMageEncounterState, frenzyMageEncounterReason, hasFrenzyMageDisputeOpponent,
  projectFrenzyMageEncounter, validateFrenzyMageEncounter, validateFrenzyMageEncounterCommand, hasFrenzyMageEncounterLock, FRENZY_MAGE_POWERS } from '../../src/domain/frenzy-mage/encounter.js';
import { currentFrenzyMageCombatSource } from '../../src/domain/frenzy-mage/combat.js';
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Explicit directed promotion/report setup; natural complete lineage is covered by shared tests. */
function fixture(): SliceState {
  const s = createSliceRun('frenzy-encounter-directed', sliceDefaultCreationSelection, 'frenzy-encounter');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 120; s.actionsRemaining = 6; s.cash = 1000; s.arc.stage = 'ENDED';
  s.progression = { pathwayId: 'black-emperor', sequence: 3, mastery: {}, acting: 0, promotionWeek: 120 };
  s.frenzyMage = createFrenzyMageState(); s.frenzyMage.guidanceKnown = true; s.frenzyMage.promotionWeek = 120; s.frenzyMage.fallenEarlActingAtPromotion = 100;
  s.frenzyMage.life.cases['courier-route'].status = 'RESOLVED'; s.health = 100; s.mind = 100; s.spirituality = 120; return s;
}
const oldRoots = (s: SliceState) => structuredClone({ lawyer: s.lawyer, barbarian: s.barbarian, briber: s.briber, corruptionBaron: s.corruptionBaron, mentorDisorder: s.mentorDisorder, fallenEarl: s.fallenEarl });
describe('Frenzy Mage directed independent adult, original rod and finite encounter', () => {
  it('creates one new45year adult S4 with owned rod and actual120S', () => {
    const s = fixture(), e = createFrenzyMageEncounterState(); expect(e).toMatchObject({ targetId: 'FM3-ALDEN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', pendingKind: null });
    const p = projectFrenzyMageEncounter(s); expect(p.enemy).toMatchObject({ id: 'FM3-ALDEN', name: '阿尔登·鲁克', age: 45, sequence: 4, source: 'ORIGINAL_LIMITED_G', weaponId: 'FM3-ALDEN-ROD' });
    expect(p.scene).toMatchObject({ distanceMetres: 2, exitMetres: 4, thirdPartiesInArea: 0, ordinaryExit: 'OPEN' }); expect(FRENZY_MAGE_POWERS.map(x => [x.cost, x.selfGain, x.enemyReduction])).toEqual([[5, 70, 0], [4, 0, 30], [4, 8, 0]]); expect(validateFrenzyMageEncounter(s)).toBe(true);
  });
  it('talk and explicit fight are separate, and zeroAP peace exit takes real4m4s', () => {
    const s = fixture(), old = oldRoots(s); expect(frenzyMageEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    applyFrenzyMageEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); expect(s.combat).toBeNull(); expect(s.actionsRemaining).toBe(5); expect(hasFrenzyMageEncounterLock(s)).toBe(true);
    s.actionsRemaining = 0; s.mind = 0; applyFrenzyMageEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context()); expect(s.actionsRemaining).toBe(0); expect(s.frenzyMage.life.clockSeconds).toBe(4);
    expect(s.frenzyMage.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', exitTravelMetres: 4, exitSeconds: 4, terminal: null });
    expect(s.frenzyMage.encounter.scene).toMatchObject({ playerPosition: 'EXIT', ordinaryWalkedMetres: 4 }); expect(oldRoots(s)).toEqual(old); expect(hasFrenzyMageEncounterLock(s)).toBe(false); expect(validateFrenzyMageEncounter(s)).toBe(true);
    expect(frenzyMageEncounterReason(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
  });
  it('starts only original Alden at2m without cloning old Marlow or changing any inherited root', () => {
    const s = fixture(), old = oldRoots(s), life = structuredClone(s.frenzyMage.life);
    applyFrenzyMageEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); applyFrenzyMageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(4); expect(hasFrenzyMageDisputeOpponent(s)).toBe(true); expect(currentFrenzyMageCombatSource(s)).toMatchObject({ encounterId: 'FRENZY_MAGE_DISPUTE', targetId: 'FM3-ALDEN', targetSequence: 4, targetAge: 45, targetPhysique: 22, distanceMetres: 2, actualOriginalBody: true, enemyWeapon: 'FM3-ALDEN-ROD', weaponOwner: 'FM3-ALDEN' });
    expect(oldRoots(s)).toEqual(old); expect(s.frenzyMage.life).toEqual(life); expect(validateFrenzyMageEncounter(s)).toBe(true);
    s.frenzyMage.encounter.targetId = 'FE4-MARLOW-VENN' as never; expect(hasFrenzyMageDisputeOpponent(s)).toBe(false); expect(validateFrenzyMageEncounter(s)).toBe(false);
  });
  it('requires an actual report, original city and closure of every pending original practice', () => {
    const cases: [string, (s: SliceState) => void][] = [
      ['报告', s => { s.frenzyMage.life.cases['courier-route'].status = 'AVAILABLE'; }], ['贝克兰德', s => { s.world.city = 'ELSEWHERE'; }],
      ['关闭', s => { s.frenzyMage.life.activeCase = 'courier-route'; }], ['关闭', s => { s.frenzyMage.preparedWeek = s.week; }],
      ['关闭', s => { s.fallenEarl.life.clerk.consented = true; }], ['关闭', s => { s.fallenEarl.encounter.bestowReady = true; }],
      ['关闭', s => { s.frenzyMage.life.cases['own-throw'].status = 'PREPARED'; }],
    ];
    for (const [message, mutate] of cases) { const s = fixture(); mutate(s); expect(frenzyMageEncounterReason(s, { type: 'ENCOUNTER_TALK' })).toContain(message); }
  });
  it('keeps enoughAP for a real talk/fight choice without forcing combat', () => {
    const s = fixture(); s.actionsRemaining = 1; expect(frenzyMageEncounterReason(s, { type: 'ENCOUNTER_TALK' })).toContain('另留');
    s.actionsRemaining = 2; applyFrenzyMageEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); expect(frenzyMageEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toBeNull(); expect(frenzyMageEncounterReason(s, { type: 'LEAVE_ENCOUNTER' })).toBeNull();
  });
  it('rejects unknown fields, fabricated resources, enemy identities and weapon transfer', () => {
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']) expect(validateFrenzyMageEncounterCommand({ type })).toBe(true);
    for (const v of [{ type: 'ENCOUNTER_FIGHT', targetId: 'FM3-DARIAN' }, { type: 'LEAVE_ENCOUNTER', heal: true }, { type: 'PICK_UP' }, { type: 'BUY_BLOCKS' }, [], null]) expect(validateFrenzyMageEncounterCommand(v)).toBe(false);
    for (const mutate of [(s: SliceState) => { s.frenzyMage.encounter.enemyHealth = 101; }, (s: SliceState) => { s.frenzyMage.encounter.weaponLocation = 'COURT'; },
      (s: SliceState) => { s.frenzyMage.encounter.enemySpirituality = 119; }, (s: SliceState) => { s.frenzyMage.encounter.pendingKind = 'ORDERED_DEVIATION'; },
      (s: SliceState) => { s.frenzyMage.encounter.deviationAttempts = 1; }, (s: SliceState) => { s.frenzyMage.encounter.scene.distanceMetres = 4 as 2; },
      (s: SliceState) => { s.frenzyMage.encounter.exitSeconds = 4; }]) { const s = fixture(); mutate(s); expect(validateFrenzyMageEncounter(s)).toBe(false); }
  });
  it('dead players cannot talk, start, leave or move their original body', () => {
    const s = fixture(); s.status = 'DEAD'; s.health = 0;
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'] as const) expect(frenzyMageEncounterReason(s, { type })).toContain('活着'); expect(currentFrenzyMageCombatSource(s)).toBeNull();
  });
});
