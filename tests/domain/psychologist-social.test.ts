import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyAudienceCommand } from '../../src/domain/audience/index.js';
import { applyMindreaderCommand } from '../../src/domain/mindreader/index.js';
import { applyPsychologistCommand, validatePsychologistState } from '../../src/domain/psychologist/index.js';
import { applyPsychologistSocial, psychologistActions, psychologistScenes,
  settlePsychologistEncounter, validatePsychologistSocial } from '../../src/domain/psychologist/social.js';
import { PSYCHOLOGIST_ABILITY_IDS, PSYCHOLOGIST_CASE_IDS,
  type PsychologistActivityCommand, type PsychologistSupportMethod } from '../../src/domain/psychologist/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const permittedSummary = '经本人同意，本次交流到的浅层片段：担心无法回应亲人的期待；信内文字和过去记忆仍未知。';
const cases = [
  ['night-watch', 'SOOTHE', 'will'],
  ['stage-fright', 'SUGGEST', 'will'],
  ['unsettled-letter', 'COMMUNICATE', 'perception'],
] as const;

function context(s: SliceState, roll = 1) {
  const checks: [PublicCoreStatKey, number][] = [], notes: { title: string; text: string }[] = [];
  const awards: { source: string; amount: 5 | 8 | 25 }[] = [];
  const c: SeerContext = {
    roll(min) { return min; },
    check(ability, difficulty) {
      checks.push([ability, difficulty]);
      const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll });
      s.lastCheck = result;
      return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  const award = (source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    awards.push({ source, amount });
    s.seer.completedSources.push(source);
    const id = PSYCHOLOGIST_ABILITY_IDS[0];
    s.progression.mastery[id] = Math.min(500, s.progression.mastery[id]! + amount);
  };
  return { c, award, awards, checks, notes };
}

/** Synthetic fixture: real acquisition transitions with explicitly advanced weeks/acting.
 * This is a focused rule fixture, not evidence of a natural full-game playthrough. */
function syntheticPromoted(): SliceState {
  const s = createSliceRun('psychologist-social-synthetic', sliceDefaultCreationSelection, 'psychologist-social-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 20000; s.actionsRemaining = 80; s.weeklyBudget = 80;
  const c = context(s).c;
  applyAudienceCommand(s, { type: 'DISCOVER' }, c);
  applyAudienceCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyAudienceCommand(s, { type: 'BUY_MATERIALS', batchId: s.audience.batches[0]!.id }, c);
  applyAudienceCommand(s, { type: 'BREW', batchId: s.audience.batches[0]!.id }, c);
  applyAudienceCommand(s, { type: 'CONSUME', bottleId: s.audience.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyMindreaderCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyMindreaderCommand(s, { type: 'BUY_MATERIALS', batchId: s.mindreader.batches[0]!.id }, c);
  applyMindreaderCommand(s, { type: 'BREW', batchId: s.mindreader.batches[0]!.id }, c);
  applyMindreaderCommand(s, { type: 'CONSUME', bottleId: s.mindreader.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyPsychologistCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyPsychologistCommand(s, { type: 'BUY_POTION', bottleId: s.psychologist.bottles[0]!.id }, c);
  applyPsychologistCommand(s, { type: 'CONSUME', bottleId: s.psychologist.bottles[0]!.id, confirmed: true }, c);
  s.health = 80; s.mind = 70; s.spirituality = 30; s.seer.pollution = 12;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  return s;
}
function apply(s: SliceState, command: PsychologistActivityCommand, roll = 1) {
  const ctx = context(s, roll);
  applyPsychologistSocial(s, command, ctx.c, ctx.award);
  return ctx;
}
function reject(s: SliceState, command: PsychologistActivityCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
function observe(s: SliceState, caseId: string) { return apply(s, { type: 'OBSERVE', caseId }); }
function support(s: SliceState, caseId: string, method: PsychologistSupportMethod, roll = 1) {
  return apply(s, { type: 'SUPPORT', caseId, method }, roll);
}
function syntheticPositiveRound(): SliceCombatRound {
  return { round: 1, stance: 'PREPARE', first: 'PLAYER', playerCount: 1, enemyCount: 1,
    playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'PLAYER', label: '有限精神影响', selfGain: 28, enemyReduction: 0 }],
    playerAdvantage: 130, enemyAdvantage: 100, winChance: 56,
    winner: 'PLAYER', consequence: '精神损耗', consequenceWeights: null, retreat: 'NONE' };
}

describe('psychologist consenting social practice (synthetic fixtures)', () => {
  it('hides scenes before S7 and spends one action on each person’s present consent', () => {
    const ordinary = createSliceRun('ordinary-social', sliceDefaultCreationSelection, 'ordinary-social');
    ordinary.activeEvent = null;
    expect(psychologistActions(ordinary)).toEqual([]);
    expect(psychologistScenes(ordinary)).toEqual([]);
    reject(ordinary, { type: 'OBSERVE', caseId: 'night-watch' });
    const s = syntheticPromoted(), before = s.actionsRemaining;
    expect(validatePsychologistState(s)).toBe(true);
    expect(psychologistScenes(s).every(scene => scene.impression === null && scene.observations.length === 0)).toBe(true);
    for (const id of PSYCHOLOGIST_CASE_IDS) {
      observe(s, id);
      expect(s.psychologist.cases[id]).toMatchObject({ status: 'OBSERVED', consent: true, supportWeek: null, method: null, readSummary: null });
      expect(psychologistScenes(s).find(scene => scene.id === id)!.observations.length).toBeGreaterThan(0);
      reject(s, { type: 'OBSERVE', caseId: id });
    }
    expect([s.actionsRemaining, s.progression.acting, s.spirituality]).toEqual([before - 3, 0, 30]);
  });

  it('requires fresh consent for all three methods and consumes the correct real resources and check', () => {
    for (const [id, method, stat] of cases) {
      const s = syntheticPromoted();
      reject(s, { type: 'SUPPORT', caseId: id, method });
      observe(s, id);
      const ap = s.actionsRemaining, spirit = s.spirituality;
      const ctx = support(s, id, method);
      expect(ctx.checks).toEqual([[stat, 14]]);
      expect([s.actionsRemaining, s.spirituality, s.progression.acting]).toEqual([ap - 1, spirit - 3, 0]);
      expect(s.psychologist.cases[id]).toMatchObject({ status: 'SUPPORTED', consent: true, method, supportWeek: 19, attemptWeek: 19 });
      expect(ctx.awards).toEqual([]);
      expect(validatePsychologistSocial(s)).toBe(true);
      reject(s, { type: 'SUPPORT', caseId: id, method });
    }
  });

  it('rejects unconsented methods and insufficient spirituality without partially changing anything', () => {
    for (const [id, allowed] of cases) {
      const s = syntheticPromoted(); observe(s, id);
      for (const method of ['SOOTHE', 'SUGGEST', 'COMMUNICATE'] as const) {
        if (method !== allowed) reject(s, { type: 'SUPPORT', caseId: id, method });
      }
      s.spirituality = 2;
      reject(s, { type: 'SUPPORT', caseId: id, method: allowed });
    }
  });

  it('retains failed costs and permits only a later-week retry without inventing thoughts or growth', () => {
    for (const [id, method] of cases) {
      const s = syntheticPromoted(); observe(s, id);
      const ap = s.actionsRemaining, spirit = s.spirituality, originalMind = s.psychologist.cases[id]!.mind;
      const ctx = support(s, id, method, 99);
      expect([s.actionsRemaining, s.spirituality, s.progression.acting]).toEqual([ap - 1, spirit - 3, 0]);
      expect(s.psychologist.cases[id]).toMatchObject({ status: 'OBSERVED', supportWeek: null, attemptWeek: 19, method: null, mind: originalMind, readSummary: null });
      expect(ctx.awards).toEqual([]);
      reject(s, { type: 'SUPPORT', caseId: id, method });
      s.week = 20; support(s, id, method);
      expect(s.psychologist.cases[id]).toMatchObject({ status: 'SUPPORTED', supportWeek: 20, attemptWeek: 20 });
      expect(s.spirituality).toBe(spirit - 6);
    }
  });

  it('makes soothing change only the actual client mind value, with no bodily or pollution cure', () => {
    const s = syntheticPromoted(), personal = [s.health, s.mind, s.seer.pollution];
    for (const [id, method] of cases) { observe(s, id); support(s, id, method); }
    expect(PSYCHOLOGIST_CASE_IDS.map(id => s.psychologist.cases[id]!.mind)).toEqual([55, 55, 50]);
    expect([s.health, s.mind, s.seer.pollution]).toEqual(personal);
    expect(s.progression.acting).toBe(0);
    expect(validatePsychologistState(s)).toBe(true);
    expect(validatePsychologistSocial(s)).toBe(true);
  });

  it('can withdraw at zero AP and zero mind without refunds, rewards, deletion or forced continuation', () => {
    const s = syntheticPromoted(); observe(s, 'unsettled-letter'); support(s, 'unsettled-letter', 'COMMUNICATE');
    s.actionsRemaining = 0; s.mind = 0; s.world.city = 'ELSEWHERE';
    const original = { ...s.psychologist.cases['unsettled-letter']! }, spirit = s.spirituality, cash = s.cash;
    const mastery = { ...s.progression.mastery }, sources = [...s.seer.completedSources];
    const action = psychologistActions(s).find(candidate => candidate.command.type === 'WITHDRAW' && candidate.command.caseId === 'unsettled-letter');
    expect(action).toMatchObject({ enabled: true, cost: '0行动 · 原消耗保留' });
    const ctx = apply(s, { type: 'WITHDRAW', caseId: 'unsettled-letter' });
    expect(s.psychologist.cases['unsettled-letter']).toEqual({ ...original, consent: false });
    expect([s.actionsRemaining, s.mind, s.spirituality, s.cash, s.progression.acting]).toEqual([0, 0, spirit, cash, 0]);
    expect(s.progression.mastery).toEqual(mastery);
    expect(s.seer.completedSources).toEqual(sources);
    expect(ctx.awards).toEqual([]);
    reject(s, { type: 'WITHDRAW', caseId: 'unsettled-letter' });
    reject(s, { type: 'DISCUSS', caseId: 'unsettled-letter' });
    s.actionsRemaining = 2; s.mind = 70; s.world.city = 'BACKLUND'; s.week = 20;
    reject(s, { type: 'DISCUSS', caseId: 'unsettled-letter' });
    observe(s, 'unsettled-letter'); apply(s, { type: 'DISCUSS', caseId: 'unsettled-letter' });
    expect(s.psychologist.cases['unsettled-letter']!.status).toBe('RESOLVED');
  });

  it('records only the explicitly permitted present thought after successful communication', () => {
    const s = syntheticPromoted();
    for (const [id, method] of cases) { observe(s, id); support(s, id, method); }
    expect(s.psychologist.cases['night-watch']!.readSummary).toBeNull();
    expect(s.psychologist.cases['stage-fright']!.readSummary).toBeNull();
    expect(s.psychologist.cases['unsettled-letter']!.readSummary).toBe(permittedSummary);
    const scenes = psychologistScenes(s);
    expect(scenes.filter(scene => scene.impression !== null).map(scene => [scene.id, scene.impression])).toEqual([['unsettled-letter', permittedSummary]]);
    expect(scenes.find(scene => scene.id === 'unsettled-letter')!.story).toContain('信件始终由他保管');
    expect(scenes.find(scene => scene.id === 'unsettled-letter')!.story).toContain('内容没有向你开放');
  });

  it('requires later personal verification, retains a failed discussion and awards each resolved case once', () => {
    const s = syntheticPromoted(); observe(s, 'night-watch'); support(s, 'night-watch', 'SOOTHE');
    reject(s, { type: 'DISCUSS', caseId: 'night-watch' });
    s.week = 20;
    const ap = s.actionsRemaining, spirit = s.spirituality;
    const failed = apply(s, { type: 'DISCUSS', caseId: 'night-watch' }, 99);
    expect(failed.checks).toEqual([['knowledge', 12]]);
    expect(failed.awards).toEqual([]);
    expect(s.psychologist.cases['night-watch']).toMatchObject({ status: 'SUPPORTED', consent: true, supportWeek: 19, attemptWeek: 20, mind: 55 });
    expect([s.actionsRemaining, s.spirituality, s.progression.acting]).toEqual([ap - 1, spirit, 0]);
    reject(s, { type: 'DISCUSS', caseId: 'night-watch' });
    s.week = 21;
    const success = apply(s, { type: 'DISCUSS', caseId: 'night-watch' });
    expect(success.awards).toEqual([{ source: 'psychologist-case:night-watch', amount: 8 }]);
    expect(s.psychologist.cases['night-watch']).toMatchObject({ status: 'RESOLVED', consent: false, attemptWeek: 21 });
    expect(s.progression.acting).toBe(25);
    expect(validatePsychologistSocial(s)).toBe(true);
    for (const type of ['OBSERVE', 'DISCUSS', 'REFER', 'WITHDRAW'] as const) reject(s, { type, caseId: 'night-watch' });
  });

  it('reaches peaceful 100 through verified help, referral and one reflection without an encounter', () => {
    const s = syntheticPromoted();
    reject(s, { type: 'REFLECT' });
    observe(s, 'night-watch'); support(s, 'night-watch', 'SOOTHE'); s.week = 20;
    apply(s, { type: 'DISCUSS', caseId: 'night-watch' });
    observe(s, 'stage-fright');
    const spirit = s.spirituality, stageMind = s.psychologist.cases['stage-fright']!.mind;
    const referral = apply(s, { type: 'REFER', caseId: 'stage-fright' });
    expect(referral.checks).toEqual([]);
    expect(s.spirituality).toBe(spirit);
    expect(s.psychologist.cases['stage-fright']).toMatchObject({ status: 'RESOLVED', method: 'REFER', supportWeek: null, mind: stageMind, readSummary: null, consent: false });
    observe(s, 'unsettled-letter'); support(s, 'unsettled-letter', 'COMMUNICATE'); s.week = 21;
    apply(s, { type: 'DISCUSS', caseId: 'unsettled-letter' });
    expect(s.progression.acting).toBe(75);
    apply(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.psychologist.reflected, s.combat, s.psychologist.encounter.status]).toEqual([100, true, null, 'AVAILABLE']);
    expect(s.progression.mastery[PSYCHOLOGIST_ABILITY_IDS[0]]).toBe(24);
    expect(s.seer.completedSources.filter(source => source.startsWith('psychologist-'))).toEqual([
      'psychologist-case:night-watch', 'psychologist-case:stage-fright', 'psychologist-case:unsettled-letter', 'psychologist-reflection',
    ]);
    expect(validatePsychologistState(s)).toBe(true);
    expect(validatePsychologistSocial(s)).toBe(true);
    reject(s, { type: 'REFLECT' });
  });

  it('retreats from the real encounter without awarding prior effective moves or inventing goods', () => {
    const s = syntheticPromoted(), cash = s.cash, mastery = { ...s.progression.mastery }, sources = [...s.seer.completedSources];
    reject(s, { type: 'ENCOUNTER_FIGHT' });
    apply(s, { type: 'OBSERVE_ENCOUNTER' }); apply(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.combat).toMatchObject({ encounterId: 'PSYCHOLOGIST_DISPUTE', enemyMind: 100, enemyHealth: 100 });
    s.combatHistory.push(syntheticPositiveRound());
    const ctx = context(s);
    settlePsychologistEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect([s.combat, s.psychologist.encounter.status, s.progression.acting, s.cash]).toEqual([null, 'RETREATED', 0, cash]);
    expect(ctx.awards).toEqual([]);
    expect(s.progression.mastery).toEqual(mastery);
    expect(s.seer.completedSources).toEqual(sources);
    expect(validatePsychologistSocial(s)).toBe(true);
    reject(s, { type: 'ENCOUNTER_FIGHT' });
    reject(s, { type: 'ENCOUNTER_TALK' });
  });
});
