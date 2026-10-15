import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createCoffinBearerState } from '../../src/domain/coffin-bearer/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyCoffinBearerEncounterCommand, createCoffinBearerEncounterState, coffinBearerEncounterReason, hasCoffinBearerDisputeOpponent,
  projectCoffinBearerEncounter, validateCoffinBearerEncounter, validateCoffinBearerEncounterCommand, hasCoffinBearerEncounterLock, COFFIN_BEARER_POWERS } from '../../src/domain/coffin-bearer/encounter.js';
import { currentCoffinBearerCombatSource } from '../../src/domain/coffin-bearer/combat.js';
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Explicit directed promotion/report setup; natural complete lineage is covered by shared tests. */
function fixture(): SliceState {
  const s = createSliceRun('coffin-bearer-encounter-directed', sliceDefaultCreationSelection, 'coffin-bearer-encounter');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 120; s.actionsRemaining = 6; s.cash = 1000; s.arc.stage = 'ENDED';
  s.progression = { pathwayId: 'mother', sequence: 3, mastery: {}, acting: 0, promotionWeek: 120 };
  s.coffinBearer = createCoffinBearerState(); s.coffinBearer.guidanceKnown = true; s.coffinBearer.promotionWeek = 120; s.coffinBearer.ancientAlchemistActingAtPromotion = 100;
  for (const c of Object.values(s.coffinBearer.life.cases)) c.status = 'RESOLVED'; s.coffinBearer.life.reflected = true; s.health = 100; s.mind = 100; s.spirituality = 120; return s;
}
const oldRoots = (s: SliceState) => structuredClone({ cultivator: s.cultivator, physician: s.physician, harvestpriest: s.harvestpriest, biologist: s.biologist, druid: s.druid, ancientAlchemist: s.ancientAlchemist });
describe('Chaos Hunter directed independent adult, original rod and finite encounter', () => {
  it('creates one new42year adult S4 with owned rod and actual120S', () => {
    const s = fixture(), e = createCoffinBearerEncounterState(); expect(e).toMatchObject({ targetId: 'CB3-NOLAN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', guardMode: null, guardCharges: 0 });
    const p = projectCoffinBearerEncounter(s); expect(p.enemy).toMatchObject({ id: 'CB3-NOLAN', name: '诺兰·韦斯特', age: 42, sequence: 4, source: 'ORIGINAL_LIMITED_G', weaponId: 'CB3-NOLAN-ROD' });
    expect(p.scene).toMatchObject({ distanceMetres: 2, exitMetres: 4, thirdPartiesInArea: 0, ordinaryExit: 'OPEN' }); expect(COFFIN_BEARER_POWERS.map(x => [x.cost, x.selfGain, x.enemyReduction])).toEqual([[5, 70, 0], [4, 0, 30], [4, 8, 0]]); expect(validateCoffinBearerEncounter(s)).toBe(true);
  });
  it('talk and explicit fight are separate, and zeroAP peace exit takes real4m4s', () => {
    const s = fixture(), old = oldRoots(s); expect(coffinBearerEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    applyCoffinBearerEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); expect(s.combat).toBeNull(); expect(s.actionsRemaining).toBe(5); expect(hasCoffinBearerEncounterLock(s)).toBe(true);
    s.actionsRemaining = 0; s.mind = 0; applyCoffinBearerEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context()); expect(s.actionsRemaining).toBe(0); expect(s.coffinBearer.life.clockSeconds).toBe(4);
    expect(s.coffinBearer.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', exitTravelMetres: 4, exitSeconds: 4, terminal: null });
    expect(s.coffinBearer.encounter.scene).toMatchObject({ playerPosition: 'EXIT', ordinaryWalkedMetres: 4 }); expect(oldRoots(s)).toEqual(old); expect(hasCoffinBearerEncounterLock(s)).toBe(false); expect(validateCoffinBearerEncounter(s)).toBe(true);
    expect(coffinBearerEncounterReason(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
  });
  it('starts only original Nolan at2m without cloning old Osric or changing any inherited root', () => {
    const s = fixture(), old = oldRoots(s), life = structuredClone(s.coffinBearer.life);
    applyCoffinBearerEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); applyCoffinBearerEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(4); expect(hasCoffinBearerDisputeOpponent(s)).toBe(true); expect(currentCoffinBearerCombatSource(s)).toMatchObject({ encounterId: 'COFFIN_BEARER_DISPUTE', targetId: 'CB3-NOLAN', targetSequence: 4, targetAge: 42, targetPhysique: 22, distanceMetres: 2, actualOriginalBody: true, enemyWeapon: 'CB3-NOLAN-ROD', weaponOwner: 'CB3-NOLAN' });
    expect(oldRoots(s)).toEqual(old); expect(s.coffinBearer.life).toEqual(life); expect(validateCoffinBearerEncounter(s)).toBe(true);
    s.coffinBearer.encounter.targetId = 'IM4-ROWAN-KELL' as never; expect(hasCoffinBearerDisputeOpponent(s)).toBe(false); expect(validateCoffinBearerEncounter(s)).toBe(false);
  });
  it('requires an actual report, original city and closure of every pending original practice', () => {
    const cases: [string, (s: SliceState) => void][] = [
      ['报告', s => { s.coffinBearer.life.cases['fresh-transfer'].status = 'AVAILABLE'; }], ['贝克兰德', s => { s.world.city = 'ELSEWHERE'; }],
      ['关闭', s => { s.coffinBearer.life.activeCase = 'fresh-transfer'; }], ['关闭', s => { s.coffinBearer.preparedWeek = s.week; }],
      ['关闭', s => { s.ancientAlchemist.life.cases['living-stem'].status = 'PREPARED'; }], ['关闭', s => { s.ancientAlchemist.encounter.guardReady = { guardId: 'AA4-GUARD-1', segmentId: 'AA4-GUARD-1-SEG1' }; }],
      ['关闭', s => { s.coffinBearer.life.cases['dry-record'].status = 'PREPARED'; }],
    ];
    for (const [message, mutate] of cases) { const s = fixture(); mutate(s); expect(coffinBearerEncounterReason(s, { type: 'ENCOUNTER_TALK' })).toContain(message); }
  });
  it('keeps enoughAP for a real talk/fight choice without forcing combat', () => {
    const s = fixture(); s.actionsRemaining = 1; expect(coffinBearerEncounterReason(s, { type: 'ENCOUNTER_TALK' })).toContain('另留');
    s.actionsRemaining = 2; applyCoffinBearerEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); expect(coffinBearerEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toBeNull(); expect(coffinBearerEncounterReason(s, { type: 'LEAVE_ENCOUNTER' })).toBeNull();
  });
  it('rejects unknown fields, fabricated resources, enemy identities and weapon transfer', () => {
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']) expect(validateCoffinBearerEncounterCommand({ type })).toBe(true);
    for (const v of [{ type: 'ENCOUNTER_FIGHT', targetId: 'FM3-DARIAN' }, { type: 'LEAVE_ENCOUNTER', heal: true }, { type: 'PICK_UP' }, { type: 'BUY_BLOCKS' }, [], null]) expect(validateCoffinBearerEncounterCommand(v)).toBe(false);
    for (const mutate of [(s: SliceState) => { s.coffinBearer.encounter.enemyHealth = 101; }, (s: SliceState) => { s.coffinBearer.encounter.weaponLocation = 'COURT'; },
      (s: SliceState) => { s.coffinBearer.encounter.enemySpirituality = 119; }, (s: SliceState) => { s.coffinBearer.encounter.guardMode = 'PRESERVE'; },
      (s: SliceState) => { s.coffinBearer.encounter.preservationAttempts = 1; }, (s: SliceState) => { s.coffinBearer.encounter.scene.distanceMetres = 4 as 2; },
      (s: SliceState) => { s.coffinBearer.encounter.exitSeconds = 4; }]) { const s = fixture(); mutate(s); expect(validateCoffinBearerEncounter(s)).toBe(false); }
  });
  it('dead players cannot talk, start, leave or move their original body', () => {
    const s = fixture(); s.status = 'DEAD'; s.health = 0;
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'] as const) expect(coffinBearerEncounterReason(s, { type })).toContain('活着'); expect(currentCoffinBearerCombatSource(s)).toBeNull();
  });
});
