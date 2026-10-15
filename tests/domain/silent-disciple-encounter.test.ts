import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createSilentDiscipleState } from '../../src/domain/silent-disciple/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applySilentDiscipleEncounterCommand, createSilentDiscipleEncounterState, silentDiscipleEncounterReason, hasSilentDiscipleDisputeOpponent,
  projectSilentDiscipleEncounter, validateSilentDiscipleEncounter, validateSilentDiscipleEncounterCommand, hasSilentDiscipleEncounterLock,
  SILENT_DISCIPLE_BLOCK_IDS, SILENT_DISCIPLE_POWERS } from '../../src/domain/silent-disciple/encounter.js';
import { currentSilentDiscipleCombatSource, validateSilentDiscipleBlocks } from '../../src/domain/silent-disciple/combat.js';

function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Explicitly directed report/promotion setup, not a claim of natural completion. */
function fixture(): SliceState {
  const s = createSliceRun('silent-encounter-directed', sliceDefaultCreationSelection, 'silent-encounter');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 120; s.actionsRemaining = 6; s.cash = 1000; s.arc.stage = 'ENDED';
  s.progression = { pathwayId: 'chained', sequence: 3, mastery: {}, acting: 0, promotionWeek: 120 };
  s.silentDisciple = createSilentDiscipleState(); s.silentDisciple.guidanceKnown = true; s.silentDisciple.promotionWeek = 120; s.silentDisciple.puppetActingAtPromotion = 100;
  s.silentDisciple.life.cases['original-body'].status = 'RESOLVED'; s.health = 100; s.mind = 100; s.spirituality = 120; return s;
}
const oldRoots = (s: SliceState) => structuredClone({ prisoner: s.prisoner, madman: s.madman, werewolf: s.werewolf, zombie: s.zombie, wraith: s.wraith, puppet: s.puppet });

describe('Silent Disciple independent adult and actual encounter entry', () => {
  it('creates exactly one original adult, one owned rod and no free new blocks', () => {
    const s = fixture(), e = createSilentDiscipleEncounterState(); expect(e).toMatchObject({ targetId: 'SD3-CALDER', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyForm: 'HUMAN', weaponLocation: 'HAND', blocksPurchased: false, blocks: [] });
    const p = projectSilentDiscipleEncounter(s); expect(p.enemy).toMatchObject({ id: 'SD3-CALDER', name: '卡尔德·里德', age: 47, sequence: 4, source: 'ORIGINAL_LIMITED_G', weaponId: 'SD3-CALDER-ROD' });
    expect(p.scene).toMatchObject({ distanceMetres: 2, exitMetres: 4, thirdPartiesInArea: 0, ordinaryExit: 'OPEN' }); expect(SILENT_DISCIPLE_POWERS.map(x => x.cost)).toEqual([5, 4, 4]); expect(validateSilentDiscipleEncounter(s)).toBe(true);
  });
  it('charges80p zeroAP once and leaves the six inherited roots and old wood originals unchanged', () => {
    const s = fixture(), old = oldRoots(s); s.actionsRemaining = 0;
    applySilentDiscipleEncounterCommand(s, { type: 'BUY_BLOCKS' }, context()); expect(s.cash).toBe(920); expect(s.actionsRemaining).toBe(0);
    expect(s.silentDisciple.encounter.blocks.map(b => b.id)).toEqual(SILENT_DISCIPLE_BLOCK_IDS); expect(s.silentDisciple.encounter.blocks.every(b => b.owner === 'PLAYER' && b.status === 'READY' && b.location === 'SOURCE')).toBe(true);
    expect(() => applySilentDiscipleEncounterCommand(s, { type: 'BUY_BLOCKS' }, context())).toThrow('唯一'); expect(oldRoots(s)).toEqual(old); expect(validateSilentDiscipleEncounter(s)).toBe(true);
  });
  it('keeps talk and explicit fight separate and offers ordinary zeroAP peace exit', () => {
    const s = fixture(), old = oldRoots(s); expect(silentDiscipleEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    applySilentDiscipleEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); expect(s.combat).toBeNull(); expect(s.silentDisciple.encounter.status).toBe('READY'); expect(s.actionsRemaining).toBe(5); expect(hasSilentDiscipleEncounterLock(s)).toBe(true);
    s.actionsRemaining = 0; s.mind = 0; applySilentDiscipleEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context());
    expect(s.actionsRemaining).toBe(0); expect(s.silentDisciple.life.clockSeconds).toBe(4); expect(s.silentDisciple.encounter.scene).toMatchObject({ playerPosition: 'EXIT', ordinaryWalkedMetres: 4 });
    expect(s.silentDisciple.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', terminal: null });
    expect(oldRoots(s)).toEqual(old); expect(hasSilentDiscipleEncounterLock(s)).toBe(false); expect(validateSilentDiscipleEncounter(s)).toBe(true);
    expect(silentDiscipleEncounterReason(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
  });
  it('starts only original current Calder at2m and never treats the life volunteer or old Edrin as enemy', () => {
    const s = fixture(), old = oldRoots(s), volunteer = structuredClone(s.silentDisciple.life.volunteer);
    applySilentDiscipleEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); applySilentDiscipleEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(4); expect(hasSilentDiscipleDisputeOpponent(s)).toBe(true); expect(currentSilentDiscipleCombatSource(s)).toMatchObject({ encounterId: 'SILENT_DISCIPLE_DISPUTE', targetId: 'SD3-CALDER', targetSequence: 4, targetAge: 47, targetPhysique: 22, distanceMetres: 2, actualOriginalBody: true, enemyWeapon: 'SD3-CALDER-ROD', weaponOwner: 'SD3-CALDER' });
    expect(oldRoots(s)).toEqual(old); expect(s.silentDisciple.life.volunteer).toEqual(volunteer); expect(validateSilentDiscipleEncounter(s)).toBe(true);
    s.silentDisciple.encounter.targetId = 'SD3-ELSA' as never; expect(hasSilentDiscipleDisputeOpponent(s)).toBe(false); expect(currentSilentDiscipleCombatSource(s)).toBeNull(); expect(validateSilentDiscipleEncounter(s)).toBe(false);
  });
  it('requires money, an actual closed report, original city, life closure and a resolved announcement', () => {
    const cases: [string, (s: SliceState) => void][] = [
      ['80', s => { s.cash = 79; }], ['报告', s => { s.silentDisciple.life.cases['original-body'].status = 'AVAILABLE'; }],
      ['贝克兰德', s => { s.world.city = 'ELSEWHERE'; }], ['关闭', s => { s.silentDisciple.life.volunteer.form = 'RABBIT'; }],
      ['关闭', s => { s.silentDisciple.life.moon.status = 'ANNOUNCED'; }], ['关闭', s => { s.puppet.life.body.form = 'WOOD'; }],
      ['关闭', s => { s.puppet.encounter.link = 'LINKED'; }], ['关闭', s => { s.werewolf.moon.pendingWeek = s.week; }],
    ];
    for (const [message, mutate] of cases) {
      const s = fixture(); mutate(s); expect(silentDiscipleEncounterReason(s, { type: message === '80' ? 'BUY_BLOCKS' : 'ENCOUNTER_TALK' })).toContain(message);
    }
  });
  it('requires enough actual actions to talk without forcing a fight', () => {
    const s = fixture(); s.actionsRemaining = 1; expect(silentDiscipleEncounterReason(s, { type: 'ENCOUNTER_TALK' })).toContain('另留');
    s.actionsRemaining = 2; applySilentDiscipleEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); expect(silentDiscipleEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toBeNull(); expect(silentDiscipleEncounterReason(s, { type: 'LEAVE_ENCOUNTER' })).toBeNull();
  });
  it('rejects unknown fields and fabricated quantities, enemy identity or pickup commands', () => {
    for (const type of ['BUY_BLOCKS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']) expect(validateSilentDiscipleEncounterCommand({ type })).toBe(true);
    for (const v of [{ type: 'BUY_BLOCKS', quantity: 3 }, { type: 'ENCOUNTER_FIGHT', targetId: 'SD3-ELSA' }, { type: 'LEAVE_ENCOUNTER', heal: true }, { type: 'PICK_UP' }, { type: 'PURCHASE_BLOCKS' }, [], null]) expect(validateSilentDiscipleEncounterCommand(v)).toBe(false);
  });
  it('rejects duplicate blocks, copied ownership, weapon teleport, fake resources and source resets', () => {
    const s = fixture(); applySilentDiscipleEncounterCommand(s, { type: 'BUY_BLOCKS' }, context()); const blocks = structuredClone(s.silentDisciple.encounter.blocks);
    expect(validateSilentDiscipleBlocks(blocks, true)).toBe(true); blocks[1]!.id = blocks[0]!.id; expect(validateSilentDiscipleBlocks(blocks, true)).toBe(false);
    for (const mutate of [(x: SliceState) => { x.silentDisciple.encounter.enemyHealth = 101; }, (x: SliceState) => { x.silentDisciple.encounter.weaponLocation = 'COURT'; },
      (x: SliceState) => { x.silentDisciple.encounter.enemySpirituality = 119; }, (x: SliceState) => { x.silentDisciple.encounter.blocks[0]!.owner = 'SD3-CALDER' as never; },
      (x: SliceState) => { x.silentDisciple.encounter.enemyForm = 'RABBIT'; }, (x: SliceState) => { x.silentDisciple.encounter.pickUpUses = 1; },
      (x: SliceState) => { x.silentDisciple.encounter.scene.distanceMetres = 4 as 2; }]) {
      const bad = structuredClone(s); mutate(bad); expect(validateSilentDiscipleEncounter(bad)).toBe(false);
    }
  });
  it('dead players cannot buy, talk, start or leave and cannot reset the current enemy', () => {
    const s = fixture(); s.status = 'DEAD'; s.health = 0;
    for (const type of ['BUY_BLOCKS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'] as const) expect(silentDiscipleEncounterReason(s, { type })).toContain('活着');
    expect(currentSilentDiscipleCombatSource(s)).toBeNull();
  });
});
