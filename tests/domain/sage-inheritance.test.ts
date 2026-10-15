import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyPryerCommand, projectPryer, validatePryerState } from '../../src/domain/pryer/index.js';
import { applyCombatScholarCommand, projectCombatScholar, validateCombatScholarState } from '../../src/domain/combat-scholar/index.js';
import { applyWizardCommand, projectWizard, validateWizardState } from '../../src/domain/wizard/index.js';
import { applyScrollProfessorCommand, projectScrollProfessor, validateScrollProfessorState } from '../../src/domain/scroll-professor/index.js';
import { applyScrollProfessorActivity, scrollProfessorActions, validateScrollProfessorLife } from '../../src/domain/scroll-professor/life.js';
import { applyStarMysticCommand, projectStarMystic, validateStarMysticState } from '../../src/domain/star-mystic/index.js';
import { applyMysticCommand, projectMystic, validateMysticState } from '../../src/domain/mystic/index.js';
import { applyProphecyMasterAcquisition, isProphecyMaster, hasProphecyMasterHistory, projectProphecyMaster, validateProphecyMasterState } from '../../src/domain/prophecy-master/index.js';
import { applyProphecyMasterActivity, prophecyMasterLifeActions, validateProphecyMasterLife } from '../../src/domain/prophecy-master/life.js';
import { applyProphecyMasterEncounterCommand, projectProphecyMasterEncounter, validateProphecyMasterEncounter } from '../../src/domain/prophecy-master/encounter.js';
import { SAGE_ABILITY_IDS } from '../../src/domain/sage/types.js';

const captured = JSON.parse(readFileSync('tests/fixtures/prophecy-master-v01540/natural.json', 'utf8'));
const oldRoots = ['pryer', 'combatScholar', 'wizard', 'scrollProfessor', 'starMystic', 'mystic', 'prophecyMaster'] as const;
const validators = [validatePryerState, validateCombatScholarState, validateWizardState, validateScrollProfessorState, validateStarMysticState, validateMysticState, validateProphecyMasterState];
const projectors = [projectPryer, projectCombatScholar, projectWizard, projectScrollProfessor, projectStarMystic, projectMystic, projectProphecyMaster];
const original = (): SliceState => structuredClone(captured.final) as SliceState;
/** Directed inheritance-only setup. This is not evidence of a naturally completed Sage promotion. */
function inherited(): SliceState {
  const s = original();
  s.sage = { promotionWeek: s.week, prophecyMasterActingAtPromotion: s.progression.acting } as SliceState['sage'];
  s.progression.sequence = 2; s.progression.acting = 0;
  for (const id of SAGE_ABILITY_IDS) s.progression.mastery[id] = 0;
  return s;
}
function context(s: SliceState): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 })) };
}
function expectOldValid(s: SliceState) {
  for (const validate of validators) expect(validate(s), validate.name).toBe(true);
}
function rejectWithoutMutation(s: SliceState, action: () => void) {
  const before = structuredClone(s); expect(action).toThrow(); expect(s).toEqual(before);
}

describe('Sage2 preserves the real Hermit9–3 lineage', () => {
  it('keeps the 507-command original unchanged and validates both exact S3 and inherited S2 history', () => {
    const prior = original(), s = inherited();
    expect(captured.commands).toHaveLength(507); expectOldValid(prior); expectOldValid(s);
    expect(prior).toMatchObject({ week: 124, health: 80, injuryRisk: 1, progression: { sequence: 3, acting: 100 } });
    expect(prior.injuries.filter(i => i.severity === 'LIGHT')).toHaveLength(2);
    expect(Object.keys(prior.progression.mastery)).toHaveLength(11);
    expect(Object.keys(s.progression.mastery)).toHaveLength(13);
    for (const root of oldRoots) expect(s[root]).toEqual(prior[root]);
    expect(s.mystic.life.story.readerIds).toHaveLength(105); expect(s.mystic.life.publicDisclosed).toBe(true);
    expect(s.mystic.encounter.enemyStatus).toBe('SURRENDERED'); expect(s.prophecyMaster.encounter.enemyStatus).toBe('DEAD');
    expect(s.scrollProfessor.workshop.scrolls).toHaveLength(9); expect(s.scrollProfessor.workshop.scrolls.every(x => x.status === 'USED')).toBe(true);
    expect(s.scrollProfessor.workshop.materials).toHaveLength(12); expect(s.scrollProfessor.workshop.materials.every(x => x.status === 'SPENT')).toBe(true);
  });
  it('projects historical digestion from each promotion snapshot without using new Sage acting', () => {
    const s = inherited();
    expect(isProphecyMaster(s)).toBe(false); expect(hasProphecyMasterHistory(s)).toBe(true);
    for (const project of projectors) expect(project(s)).toMatchObject({ promoted: true, acting: 100 });
    s.progression.acting = 25; expect(projectProphecyMaster(s).acting).toBe(100); expect(validateProphecyMasterLife(s)).toBe(true);
    s.sage.prophecyMasterActingAtPromotion = 99; expect(validateProphecyMasterLife(s)).toBe(false);
  });
  it('requires exactly all old abilities and both new abilities, with bounded mastery', () => {
    for (const id of Object.keys(inherited().progression.mastery)) {
      const s = inherited(); delete s.progression.mastery[id];
      for (const validate of validators) expect(validate(s), `${validate.name}: missing ${id}`).toBe(false);
    }
    for (const value of [-1, 501, 0.5]) {
      const s = inherited(); s.progression.mastery[SAGE_ABILITY_IDS[0]] = value;
      for (const validate of validators) expect(validate(s), validate.name).toBe(false);
    }
    const s = inherited(); s.progression.mastery['hermit.s2.invented'] = 0;
    for (const validate of validators) expect(validate(s), validate.name).toBe(false);
  });
  it('still rejects altered old bottle sources, original objects and ended NPC records', () => {
    for (const [i, root] of oldRoots.entries()) {
      const s = inherited(); s[root].bottles[0]!.source += 'rewritten'; expect(validators[i]!(s), root).toBe(false);
    }
    const s = inherited(); s.mystic.life.story.readerIds.pop(); expect(validateMysticState(s)).toBe(false);
    const e = inherited(); e.prophecyMaster.encounter.enemyStatus = 'RESISTING'; expect(validateProphecyMasterEncounter(e)).toBe(false);
    const p = inherited(); p.prophecyMaster.life.records['bell-schedule'].id = 'replacement' as typeof p.prophecyMaster.life.records['bell-schedule']['id'];
    expect(validateProphecyMasterLife(p)).toBe(false);
  });
  it('cannot buy or drink old potions or restart completed PM3 cases and combat', () => {
    const s = inherited(), c = context(s);
    const commands = [applyPryerCommand, applyCombatScholarCommand, applyWizardCommand, applyScrollProfessorCommand, applyStarMysticCommand, applyMysticCommand, applyProphecyMasterAcquisition];
    for (const [i, apply] of commands.entries()) {
      const bottleId = s[oldRoots[i]!].bottles[0]!.id;
      rejectWithoutMutation(s, () => apply(s, { type: 'BUY_POTION', bottleId }, c));
      rejectWithoutMutation(s, () => apply(s, { type: 'CONSUME', bottleId, confirmed: true }, c));
    }
    expect(prophecyMasterLifeActions(s)).toEqual([]);
    expect(projectProphecyMasterEncounter(s)).toMatchObject({ enemy: { status: 'DEAD', health: 0 }, actions: [] });
    rejectWithoutMutation(s, () => applyProphecyMasterActivity(s, { type: 'OBSERVE', caseId: 'bell-schedule' }, c));
    rejectWithoutMutation(s, () => applyProphecyMasterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, c));
    expect(c.check).not.toHaveBeenCalled();
  });
  it('requires paid real materials for S2 scroll creation, preserves old originals, and records same-scroll authorization', () => {
    const s = inherited(), c = context(s), before = structuredClone(s.scrollProfessor.workshop), award = vi.fn();
    rejectWithoutMutation(s, () => applyScrollProfessorActivity(s, { type: 'CRAFT_SCROLL', kind: 'IMPACT' }, c, award));
    applyScrollProfessorActivity(s, { type: 'BUY_KIT' }, c, award);
    expect([s.cash, s.actionsRemaining]).toEqual([430, 2]); expect(s.scrollProfessor.workshop.materials).toHaveLength(16);
    rejectWithoutMutation(s, () => applyScrollProfessorActivity(s, { type: 'BUY_KIT' }, c, award));
    applyScrollProfessorActivity(s, { type: 'CRAFT_SCROLL', kind: 'IMPACT' }, c, award);
    const scroll = s.scrollProfessor.workshop.scrolls.at(-1)!;
    expect(scroll).toMatchObject({ makerSequence: 2, createdWeek: s.sage.promotionWeek, materialId: 'scroll-professor-material-13', inscriptionMastery: 8, status: 'HELD', authorized: false });
    expect([s.spirituality, s.actionsRemaining]).toEqual([112, 1]);
    expect(s.scrollProfessor.workshop.scrolls.slice(0, 9)).toEqual(before.scrolls); expect(s.scrollProfessor.workshop.materials.slice(0, 12)).toEqual(before.materials);
    applyScrollProfessorActivity(s, { type: 'AUTHORIZE_SCROLL', scrollId: scroll.id, authorized: true }, c, award);
    expect(scroll.authorized).toBe(true); expect([s.spirituality, s.actionsRemaining]).toEqual([112, 1]); expect(award).not.toHaveBeenCalled();
    expectOldValid(s);
    s.sage.promotionWeek = s.week + 1; expect(validateScrollProfessorLife(s)).toBe(false);
  });
  it('does not relabel an old scroll as newly made by a Sage or authorize spent originals', () => {
    const s = inherited(), c = context(s), scroll = s.scrollProfessor.workshop.scrolls[0]!;
    rejectWithoutMutation(s, () => applyScrollProfessorActivity(s, { type: 'AUTHORIZE_SCROLL', scrollId: scroll.id, authorized: true }, c, vi.fn()));
    scroll.makerSequence = 2; expect(validateScrollProfessorLife(s)).toBe(false);
    expect(scrollProfessorActions(inherited()).every(a => ['LEARN_SPELL', 'BUY_KIT', 'CRAFT_SCROLL', 'AUTHORIZE_SCROLL'].includes(a.command.type))).toBe(true);
  });
  it('allows paid inherited spell study while leaving old practice archived', () => {
    const s = inherited(), c = context(s), award = vi.fn();
    // Isolated unlearned-lesson setup, not a rewrite of the captured natural history.
    s.wizard.lessons['blur-mark'] = { learned: false, attemptWeek: null };
    applyScrollProfessorActivity(s, { type: 'LEARN_SPELL', spellId: 'blur-mark' }, c, award);
    expect(s.wizard.lessons['blur-mark']).toEqual({ learned: true, attemptWeek: s.week });
    expect([s.cash, s.actionsRemaining, s.progression.acting]).toEqual([470, 2, 0]);
    rejectWithoutMutation(s, () => applyScrollProfessorActivity(s, { type: 'OBSERVE', caseId: 'paper-target' }, c, award));
  });
});
