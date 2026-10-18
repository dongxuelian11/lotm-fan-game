import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applySecretSupplicantCommand, projectSecretSupplicant, validateSecretSupplicantState } from '../../src/domain/secret-supplicant/index.js';
import { applyListenerCommand, projectListener, validateListenerState } from '../../src/domain/listener/index.js';
import { applyShadowAsceticCommand, projectShadowAscetic, validateShadowAsceticState } from '../../src/domain/shadow-ascetic/index.js';
import { applyRoseBishopCommand, projectRoseBishop, validateRoseBishopState } from '../../src/domain/rose-bishop/index.js';
import { applyRoseBishopActivity, roseBishopActions } from '../../src/domain/rose-bishop/life.js';
import { applyShepherdCommand, projectShepherd, validateShepherdState } from '../../src/domain/shepherd/index.js';
import { activateShepherdSpirit, applyShepherdActivity } from '../../src/domain/shepherd/life.js';
import { applyBlackKnightCommand, projectBlackKnight, validateBlackKnightState } from '../../src/domain/black-knight/index.js';
import { applyThreeHeadedTemplarAcquisition, hasThreeHeadedTemplarHistory, isThreeHeadedTemplar, projectThreeHeadedTemplar, validateThreeHeadedTemplarState } from '../../src/domain/three-headed-templar/index.js';
import { applyThreeHeadedTemplarActivity, hasThreeHeadedTemplarLifeLock, threeHeadedTemplarLifeActions, validateThreeHeadedTemplarLife } from '../../src/domain/three-headed-templar/life.js';
import { applyThreeHeadedTemplarEncounterCommand, projectThreeHeadedTemplarEncounter, validateThreeHeadedTemplarEncounter } from '../../src/domain/three-headed-templar/encounter.js';
import { createElderState } from '../../src/domain/elder/index.js';
import { ELDER_ABILITY_IDS } from '../../src/domain/elder/types.js';
import { applyElderActivity } from '../../src/domain/elder/life.js';

const captured = JSON.parse(readFileSync('tests/fixtures/three-headed-templar-v01550/natural.json', 'utf8'));
const oldRoots = ['secretSupplicant', 'listener', 'shadowAscetic', 'roseBishop', 'shepherd', 'blackKnight', 'threeHeadedTemplar'] as const;
const validators = [validateSecretSupplicantState, validateListenerState, validateShadowAsceticState, validateRoseBishopState, validateShepherdState, validateBlackKnightState, validateThreeHeadedTemplarState];
const projectors = [projectSecretSupplicant, projectListener, projectShadowAscetic, projectRoseBishop, projectShepherd, projectBlackKnight, projectThreeHeadedTemplar];
const original = (): SliceState => structuredClone(captured.final) as SliceState;
/** Directed inheritance-only setup, not evidence of a naturally completed Elder promotion. */
function inherited(): SliceState {
  const s = original(); s.elder = createElderState();
  s.elder.promotionWeek = s.week; s.elder.threeHeadedTemplarActingAtPromotion = s.progression.acting;
  s.progression.sequence = 2; s.progression.acting = 0;
  for (const id of ELDER_ABILITY_IDS) s.progression.mastery[id] = 0;
  return s;
}
function context(s: SliceState): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 })) };
}
function expectOldValid(s: SliceState) { for (const validate of validators) expect(validate(s), validate.name).toBe(true); }
function rejectWithoutMutation(s: SliceState, action: () => void) { const before = structuredClone(s); expect(action).toThrow(); expect(s).toEqual(before); }

describe('Elder2 preserves the real Hanged Man9–3 lineage', () => {
  it('retains the 500-command S3 history and the exact thirteen inherited abilities without healing or new inventory', () => {
    const prior = original(), s = inherited();
    expect(captured.commands).toHaveLength(500); expectOldValid(prior); expectOldValid(s);
    expect(prior).toMatchObject({ week: 124, health: 40, mind: 96, spirituality: 120, progression: { sequence: 3, acting: 100 } });
    expect(Object.keys(prior.progression.mastery)).toHaveLength(13); expect(Object.keys(s.progression.mastery)).toHaveLength(15);
    for (const root of oldRoots) expect(s[root]).toEqual(prior[root]);
    for (const id of Object.keys(prior.progression.mastery)) expect(s.progression.mastery[id]).toBe(prior.progression.mastery[id]);
    expect(s.progression.mastery['hanged-man.s6.flesh-shaping']).toBe(0); expect(s.progression.mastery['hanged-man.s5.borrowed-arts']).toBe(0);
    expect(s.health).toBe(prior.health); expect(s.injuries).toEqual(prior.injuries); expect(s.spirituality).toBe(prior.spirituality); expect(s.cash).toBe(prior.cash);
    expect(s.shepherd.grazing.spirits.find(sp => sp.id === 'SH5-CEDRIC-1')).toMatchObject({ status: 'RELEASED', releasedWeek: 64 });
    expect(s.blackKnight.life.shade).toMatchObject({ status: 'ISOLATED', controlled: false, roomStatus: 'QUARANTINED', emergencySealUsed: true, glassHood: 'BROKEN' });
    expect(s.threeHeadedTemplar.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 80, enemySpirituality: 30 });
  });
  it('projects all old digestion at 100 and old injuries and retreat without using new Elder acting', () => {
    const s = inherited(); expect(isThreeHeadedTemplar(s)).toBe(false); expect(hasThreeHeadedTemplarHistory(s)).toBe(true);
    for (const project of projectors) expect(project(s)).toMatchObject({ promoted: true, acting: 100 });
    s.progression.acting = 25; expect(projectThreeHeadedTemplar(s).acting).toBe(100); expect(validateThreeHeadedTemplarLife(s)).toBe(true);
    expect(projectThreeHeadedTemplarEncounter(s)).toMatchObject({ status: 'RETREATED', enemy: { health: 80, spirituality: 30, status: 'RESISTING' }, actions: [] });
    s.elder.threeHeadedTemplarActingAtPromotion = 99; expect(validateThreeHeadedTemplarLife(s)).toBe(false); expect(validateThreeHeadedTemplarState(s)).toBe(false);
  });
  it('requires exactly thirteen old and two new ability IDs with finite bounded mastery', () => {
    for (const id of Object.keys(inherited().progression.mastery)) {
      const s = inherited(); delete s.progression.mastery[id];
      for (const validate of validators) expect(validate(s), `${validate.name}: missing ${id}`).toBe(false);
    }
    for (const value of [-1, 501, 0.5, Number.NaN]) {
      const s = inherited(); s.progression.mastery[ELDER_ABILITY_IDS[0]] = value;
      for (const validate of validators) expect(validate(s), validate.name).toBe(false);
    }
    const invented = inherited(); invented.progression.mastery['hanged-man.s2.invented'] = 0;
    for (const validate of validators) expect(validate(invented), validate.name).toBe(false);
    const old = original(); old.progression.mastery[ELDER_ABILITY_IDS[0]] = 0;
    for (const validate of validators) expect(validate(old), `${validate.name}: S2 ID before S2`).toBe(false);
  });
  it('rejects altered old bottle provenance, released spirits, isolated shade, and prior enemy records', () => {
    for (const [i, root] of oldRoots.entries()) {
      const s = inherited(); s[root].bottles[0]!.source += ' rewritten'; expect(validators[i]!(s), root).toBe(false);
    }
    const cedric = inherited(); cedric.shepherd.grazing.spirits[1]!.status = 'GRAZED'; expect(validateShepherdState(cedric)).toBe(false);
    const shade = inherited(); shade.blackKnight.life.shade.controlled = true; expect(validateBlackKnightState(shade)).toBe(false);
    const enemy = inherited(); enemy.threeHeadedTemplar.encounter.enemyHealth = 100; expect(validateThreeHeadedTemplarEncounter(enemy)).toBe(false);
    const item = inherited(); item.threeHeadedTemplar.life.card.id = 'replacement' as typeof item.threeHeadedTemplar.life.card.id; expect(validateThreeHeadedTemplarLife(item)).toBe(false);
    const spirit = inherited(); spirit.threeHeadedTemplar.life.spirits['THT3-HELENA'].spirituality = 30; expect(validateThreeHeadedTemplarLife(spirit)).toBe(false);
  });
  it('blocks old potion acquisition, S3 case advancement, source care and old combat without mutations', () => {
    const s = inherited(), c = context(s);
    const apply = [applySecretSupplicantCommand, applyListenerCommand, applyShadowAsceticCommand, applyRoseBishopCommand, applyShepherdCommand, applyBlackKnightCommand, applyThreeHeadedTemplarAcquisition];
    for (const [i, action] of apply.entries()) {
      const bottleId = s[oldRoots[i]!].bottles[0]!.id;
      rejectWithoutMutation(s, () => action(s, { type: 'BUY_POTION', bottleId }, c));
      rejectWithoutMutation(s, () => action(s, { type: 'CONSUME', bottleId, confirmed: true }, c));
    }
    expect(threeHeadedTemplarLifeActions(s)).toEqual([]); expect(hasThreeHeadedTemplarLifeLock(s)).toBe(false);
    rejectWithoutMutation(s, () => applyThreeHeadedTemplarActivity(s, { type: 'OBSERVE', caseId: 'two-end-seal' }, c));
    rejectWithoutMutation(s, () => applyThreeHeadedTemplarActivity(s, { type: 'REST_SPIRIT', spiritId: 'THT3-HELENA' }, c));
    rejectWithoutMutation(s, () => applyThreeHeadedTemplarActivity(s, { type: 'EXTERNALIZE', spiritId: 'THT3-ROLAND' }, c));
    rejectWithoutMutation(s, () => applyThreeHeadedTemplarEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, c));
    expect(c.check).not.toHaveBeenCalled();
  });
  it('accepts only replay-proven movement of the same original card and still fully validates the S3 baseline', () => {
    const s = inherited(), c = context(s), prior = structuredClone(s.threeHeadedTemplar.life), caseId = 'sealed-whisper' as const;
    applyElderActivity(s, { type: 'OBSERVE', caseId }, c); s.revision++;
    applyElderActivity(s, { type: 'CONSENT_OWNER', caseId }, c); s.revision++;
    applyElderActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }, c); s.revision++;
    applyElderActivity(s, { type: 'WALK', caseId, to: 'A' }, c); s.revision++;
    applyElderActivity(s, { type: 'TAKE_CARD', caseId }, c); s.revision++;
    applyElderActivity(s, { type: 'WALK', caseId, to: 'B' }, c); s.revision++;
    expect(s.threeHeadedTemplar.life.card).toMatchObject({ id: 'THT3-CARD', location: 'PLAYER', travelMetres: prior.card.travelMetres + 4 });
    expect(s.threeHeadedTemplar.life.playerTravelMetres).toBe(prior.playerTravelMetres + 8);
    expect(s.threeHeadedTemplar.life.cases).toEqual(prior.cases); expect(s.threeHeadedTemplar.life.spirits).toEqual(prior.spirits);
    expect(hasThreeHeadedTemplarLifeLock(s)).toBe(false); expectOldValid(s);
    const freeReturn = structuredClone(s); freeReturn.threeHeadedTemplar.life.card.location = 'TABLE'; expect(validateThreeHeadedTemplarLife(freeReturn)).toBe(false);
    const freeSpirit = structuredClone(s); freeSpirit.threeHeadedTemplar.life.spirits['THT3-HELENA'].spirituality++; expect(validateThreeHeadedTemplarLife(freeSpirit)).toBe(false);
    // Even matching forged handoff snapshots cannot bypass the original complete S3 scene replay.
    const rewritten = structuredClone(s), source = rewritten.elder.life.source!;
    source.snapshot.cases['two-end-seal'].attempts[0]!.playerTravelMetres++;
    rewritten.elder.life.journal[0]!.inheritedScene = structuredClone(source);
    rewritten.threeHeadedTemplar.life.cases = structuredClone(source.snapshot.cases);
    expect(validateThreeHeadedTemplarLife(rewritten)).toBe(false);
    expect(c.check).not.toHaveBeenCalled();
  });
  it('keeps paid original reserve packets usable in S2 without free healing or old acting', () => {
    const s = inherited(), c = context(s), before = structuredClone(s.roseBishop.reserve), award = vi.fn();
    expect(roseBishopActions(s).every(a => ['BUY_RATION', 'TAKE_RATION'].includes(a.command.type))).toBe(true);
    applyRoseBishopActivity(s, { type: 'BUY_RATION' }, c, award);
    const packet = s.roseBishop.reserve.packets.at(-1)!;
    expect(packet).toMatchObject({ status: 'HELD', acquiredWeek: s.week, consumedWeek: null });
    expect(s.cash).toBe(560); expect(s.actionsRemaining).toBe(2); expect(s.roseBishop.reserve.packets.slice(0, before.packets.length)).toEqual(before.packets);
    if (before.points < 3) {
      applyRoseBishopActivity(s, { type: 'TAKE_RATION', packetId: packet.id }, c, award);
      expect(packet).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week }); expect(s.roseBishop.reserve.points).toBe(before.points + 1);
    }
    expect(s.health).toBe(40); expect(s.progression.acting).toBe(0); expect(award).not.toHaveBeenCalled(); expectOldValid(s);
  });
  it('uses only the already grazed Iris and never recalls the permanently released Cedric', () => {
    const s = inherited(), c = context(s), before = structuredClone(s.shepherd.grazing.spirits);
    activateShepherdSpirit(s, null, c); expect(s.shepherd.grazing.activeSpiritId).toBeNull();
    activateShepherdSpirit(s, 'SH5-IRIS-1', c); expect(s.shepherd.grazing.activeSpiritId).toBe('SH5-IRIS-1');
    rejectWithoutMutation(s, () => activateShepherdSpirit(s, 'SH5-CEDRIC-1', c));
    rejectWithoutMutation(s, () => applyShepherdActivity(s, { type: 'GRAZE', spiritId: 'SH5-CEDRIC-1', abilityIds: ['courage-song'] }, c, vi.fn()));
    expect(s.shepherd.grazing.spirits).toEqual(before); expect([s.cash, s.spirituality, s.actionsRemaining, s.progression.acting]).toEqual([600, 120, 3, 0]); expectOldValid(s);
  });
});
