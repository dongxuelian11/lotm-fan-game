import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyPryerCommand } from '../../src/domain/pryer/index.js';
import { PRYER_ABILITY_IDS } from '../../src/domain/pryer/types.js';
import { applyCombatScholarCommand } from '../../src/domain/combat-scholar/index.js';
import { COMBAT_SCHOLAR_ABILITY_IDS } from '../../src/domain/combat-scholar/types.js';
import {
  applyWizardCommand, createWizardState, isWizardAcquisitionCommand,
  projectWizard, validateWizardCommand, validateWizardState,
} from '../../src/domain/wizard/index.js';
import {
  WIZARD_ABILITIES, WIZARD_BOTTLE_IDS, WIZARD_FORMULA_STATUS,
  WIZARD_LABOUR_TASKS, WIZARD_SOURCE_STATUS, WIZARD_SPELLS,
} from '../../src/domain/wizard/content.js';
import {
  WIZARD_ABILITY_IDS, WIZARD_CASE_IDS, WIZARD_SPELL_IDS,
  type WizardAcquisitionCommand, type WizardCommand,
} from '../../src/domain/wizard/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('wizard-acquisition', sliceDefaultCreationSelection, 'wizard-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 20000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 18;
  s.wizard = createWizardState();
  return s;
}
function context(s: SliceState, roll = 20) {
  const checks: [PublicCoreStatKey, number][] = [], draws: [number, number][] = [];
  const notes: { title: string; text: string }[] = [];
  const c: SeerContext = {
    roll(min, max) { draws.push([min, max]); return min; },
    check(ability, difficulty) {
      checks.push([ability, difficulty]);
      const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll });
      s.lastCheck = result; return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, checks, draws, notes };
}
/** Real prior potion identities, with the already-completed S9/S8 acting supplied as an acquisition fixture. */
function scholar() {
  const s = ordinary(), c = context(s, 1).c;
  applyPryerCommand(s, { type: 'DISCOVER' }, c);
  applyPryerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyPryerCommand(s, { type: 'BUY_POTION', bottleId: s.pryer.bottles[0]!.id }, c);
  applyPryerCommand(s, { type: 'CONSUME', bottleId: s.pryer.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100; s.week = 9;
  applyCombatScholarCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyCombatScholarCommand(s, { type: 'BUY_POTION', bottleId: s.combatScholar.bottles[0]!.id }, c);
  applyCombatScholarCommand(s, { type: 'CONSUME', bottleId: s.combatScholar.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS].map((id, index) => [id, index * 25]));
  s.week = 17; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 18;
  return s;
}
function apply(s: SliceState, command: WizardAcquisitionCommand, roll = 20) { applyWizardCommand(s, command, context(s, roll).c); }
function taught(s = scholar()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.wizard.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of WIZARD_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as WizardAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Wizard independent S7 acquisition', () => {
  it('starts with three separate original bottles and unlearned lessons, without a formula', () => {
    const s = ordinary(), projection = projectWizard(s);
    expect(validateWizardState(s)).toBe(true);
    expect(s.wizard.bottles.map(b => b.id)).toEqual([...WIZARD_BOTTLE_IDS]);
    expect(s.wizard.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.wizard.cases)).toEqual([...WIZARD_CASE_IDS]);
    expect(Object.values(s.wizard.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.effectOpen)).toBe(true);
    expect(s.wizard.lessons).toEqual(Object.fromEntries(WIZARD_SPELL_IDS.map(id => [id, { learned: false, attemptWeek: null }])));
    expect(projection).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], lessons: [], insideCase: false });
    const other = createWizardState(); other.bottles[0]!.labourSteps = 1; other.lessons['light-touch']!.learned = true;
    expect(s.wizard.bottles[0]!.labourSteps).toBe(0); expect(s.wizard.lessons['light-touch']!.learned).toBe(false);
  });

  it('uses Lina’s adult-instructor introduction and charges 240 pence plus one AP only for guidance', () => {
    const s = scholar(), old = JSON.stringify([s.pryer, s.combatScholar, s.progression]), ctx = context(s);
    rejected(s, { type: 'BUY_POTION', bottleId: WIZARD_BOTTLE_IDS[0] });
    applyWizardCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.wizard.guidanceKnown]).toEqual([9760, 39, true]);
    for (const text of ['经莉奈·安瑟介绍', '成年', '伊蕾·莫文']) expect(ctx.notes[0]!.text).toContain(text);
    expect(projectWizard(s).supplies).toContain(WIZARD_FORMULA_STATUS);
    expect(JSON.stringify([s.pryer, s.combatScholar, s.progression])).toBe(old);
    rejected(s, { type: 'LEARN_GUIDANCE' }); expect(validateWizardState(s)).toBe(true);
  });

  it('delivers an original for 2010 pence at zero AP with no partial labour discount', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: WIZARD_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.wizard.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 2010, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 17, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.wizard.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id }); rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateWizardState(s)).toBe(true);
  });

  it('requires four distinct jobs for that bottle before paying the remaining 210 pence', () => {
    const s = taught(), bottleId = WIZARD_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 4; step += 1) {
      applyWizardCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.wizard.bottles[0]!.labourSteps]).toEqual([9760, 38 - step, step + 1]);
      expect(projectWizard(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 3 ? 210 : 2010}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(WIZARD_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.wizard.bottles[1]!.labourSteps).toBe(0); rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId }); s.cash = 210; buy(s);
    expect([s.cash, s.actionsRemaining, s.wizard.bottles[0]!.status]).toEqual([0, 35, 'PLAYER']);
  });

  it('allows early preparation but requires acting100, eight whole S8 weeks and confirmation', () => {
    const s = scholar(); s.week = 9; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 16;
    rejected(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true });
    s.week = 17; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; rejected(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.combatScholar.promotionWeek, s.wizard.promotionWeek]).toEqual([7, 5, 9, 17]);
    expect(validateWizardState(s)).toBe(true);
  });

  it('blocks unavailable channels, open prior effects, ended runs and unrestored health without mutation', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.pryer.discovered = false; },
      s => { s.pryer.guidanceKnown = false; }, s => { s.combatScholar.guidanceKnown = false; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; }, s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.pryer.cases['intrusive-page']!.readingOpen = true; },
      s => { s.combatScholar.cases['halted-exercise']!.exerciseOpen = true; },
      s => { s.wizard.cases['soft-impact']!.effectOpen = true; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true }); }
    const s = scholar(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: WIZARD_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true }); expect(s.actionsRemaining).toBe(0);
  });

  it('resolves all four tiers with one will18 check, no death draw, and unchanged S9/S8 histories', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, old = JSON.stringify([s.pryer, s.combatScholar]), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7; const chance = projectWizard(s).bottles[0]!.chance;
      applyWizardCommand(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 18, difficulty: 18, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.wizard.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 17, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['hermit', success ? 7 : 8, 5, success ? 0 : 100]);
      expect([s.wizard.promotionWeek, s.wizard.combatScholarActingAtPromotion]).toEqual(success ? [17, 100] : [null, null]);
      expect(JSON.stringify([s.pryer, s.combatScholar])).toBe(old); expect(s.seer.completedSources).toEqual(sources);
      for (const id of [...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS]) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 2], ['knowledge', 2]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS, ...WIZARD_ABILITY_IDS] : [...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS]);
      if (success) { expect(s.progression.mastery[WIZARD_ABILITY_IDS[0]]).toBe(0); expect(projectSliceState(s).maxSpirituality).toBe(60); }
      expect(Object.values(s.wizard.lessons).every(lesson => !lesson.learned && lesson.attemptWeek === null)).toBe(true);
      expect(s.status).toBe('ACTIVE'); expect(validateWizardState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps granted attributes at500 and never creates additional mastery bars or learned spells', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(projectWizard(s).abilities.map(a => a.id)).toEqual(['hermit.s7.spellcraft']);
    expect(projectWizard(s).lessons.map(l => l.learned)).toEqual([false, false, false]);
  });

  it('retains unused originals after success but never permits duplicate preparation or consumption', () => {
    const s = prepared(); buy(s, 1); const held = structuredClone(s.wizard.bottles[1]);
    apply(s, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true });
    expect(s.wizard.bottles[1]).toEqual(held);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'BUY_POTION', bottleId: WIZARD_BOTTLE_IDS[2] },
      { type: 'POTION_WORK', bottleId: WIZARD_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectWizard(s).actions.every(a => !a.enabled)).toBe(true); expect(validateWizardState(s)).toBe(true);
  });

  it('requests the next finite batch at1AP and receives three new identities only next real week', () => {
    const s = exhausted(), old = JSON.stringify(s.wizard.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.wizard.resupply.requestedWeek, s.wizard.bottles.length]).toEqual([ap - 1, 17, 3]);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    s.week = 18; s.actionsRemaining = 0; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.wizard.bottles.slice(0, 3))).toBe(old);
    expect([s.cash, s.actionsRemaining, s.wizard.resupply.deliveries, s.wizard.resupply.requestedWeek]).toEqual([cash, 0, 1, null]);
    expect(s.wizard.bottles.slice(3).map(b => b.id)).toEqual(['wizard-potion-4', 'wizard-potion-5', 'wizard-potion-6']);
    expect(s.wizard.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.acquiredWeek === null && b.source.includes('第18周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'wizard-potion-4', confirmed: true }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 4;
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'wizard-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 210);
    apply(s, { type: 'CONSUME', bottleId: 'wizard-potion-4', confirmed: true });
    expect([s.combatScholar.promotionWeek, s.wizard.promotionWeek]).toEqual([9, 18]); expect(validateWizardState(s)).toBe(true);
  });

  it('never refills automatically or supplies while an original remains or promotion succeeded', () => {
    for (const s of [ordinary(), scholar(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10; expect(s.wizard.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('validates exact declared commands and routes learning and activities separately from acquisition', () => {
    const commands: WizardCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: WIZARD_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'wizard-potion-99' },
      { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0], confirmed: true }, { type: 'REFLECT' },
      ...WIZARD_SPELL_IDS.map(spellId => ({ type: 'LEARN_SPELL' as const, spellId })),
      ...WIZARD_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'END', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['MAGIC', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) { expect(validateWizardCommand(command)).toBe(true); if (!isWizardAcquisitionCommand(command)) rejected(prepared(), command); }
    for (const command of [
      null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
      { type: 'LEARN_GUIDANCE', free: true }, { type: 'BUY_POTION', bottleId: 'combat-scholar-potion-1' },
      { type: 'BUY_POTION', bottleId: 'wizard-potion-01' }, { type: 'CONSUME', bottleId: WIZARD_BOTTLE_IDS[0] },
      { type: 'PREPARE', caseId: 'paper-marker', method: 'TEAM' }, { type: 'END', caseId: 'soft-impact', refund: true },
      { type: 'REPORT', caseId: 'veiled-tag', claim: 'COMPLETE' }, { type: 'STOP', caseId: 'soft-impact' },
      { type: 'LEARN_SPELL', spellId: 'resurrection' }, { type: 'LEARN_SPELL', spellId: 'light-touch', mastered: true },
    ]) { expect(validateWizardCommand(command)).toBe(false); expect(isWizardAcquisitionCommand(command)).toBe(false); rejected(prepared(), command); }
  });

  it('rejects forged bottle chronology, lost inherited mastery and malformed case shapes', () => {
    const valid = promoted();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.wizard.bottles[0]!.id = 'combat-scholar-potion-1'; }, s => { s.wizard.bottles[0]!.source = 'invented'; },
      s => { s.wizard.bottles[0]!.labourSteps = 5; }, s => { s.wizard.bottles[0]!.consumedWeek = 16; },
      s => { s.wizard.combatScholarActingAtPromotion = 99; }, s => { s.wizard.promotionWeek = 16; },
      s => { delete s.progression.mastery[PRYER_ABILITY_IDS[0]]; }, s => { delete s.progression.mastery[COMBAT_SCHOLAR_ABILITY_IDS[0]]; },
      s => { s.progression.mastery['hermit.s6.scrollcraft'] = 0; }, s => { delete s.wizard.cases['veiled-tag']; },
      s => { s.wizard.resupply.deliveries = 1; },
    ];
    for (const change of changes) { const s: SliceState = structuredClone(valid); change(s); expect(validateWizardState(s)).toBe(false); }
    const empty = ordinary(); empty.wizard.cases['paper-marker']!.status = 'OBSERVED'; expect(validateWizardState(empty)).toBe(false);
    const supplied = exhausted(); apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 18; apply(supplied, { type: 'RECEIVE_SUPPLY' });
    supplied.wizard.bottles[3]!.source = supplied.wizard.bottles[3]!.source.replace('第18周实收入库', '第17周实收入库'); expect(validateWizardState(supplied)).toBe(false);
  });

  it('validates lesson identity and chronology without treating promotion as automatic learning', () => {
    const valid = promoted();
    for (const mutate of [
      (s: SliceState) => { s.wizard.lessons['light-touch']!.learned = true; },
      (s: SliceState) => { s.wizard.lessons['light-touch']!.attemptWeek = 16; },
      (s: SliceState) => { s.wizard.lessons['brief-ward']!.attemptWeek = 18; },
      (s: SliceState) => { delete s.wizard.lessons['blur-mark']; },
      (s: SliceState) => { s.wizard.lessons['resurrection'] = { learned: false, attemptWeek: null }; },
    ]) { const s = structuredClone(valid); mutate(s); expect(validateWizardState(s)).toBe(false); }
    const failed = structuredClone(valid); failed.wizard.lessons['light-touch']!.attemptWeek = 17; expect(validateWizardState(failed)).toBe(true);
    failed.wizard.lessons['light-touch']!.learned = true; expect(validateWizardState(failed)).toBe(true);
    const early = scholar(); early.wizard.lessons['light-touch']!.attemptWeek = 17; expect(validateWizardState(early)).toBe(false);
    expect(projectWizard(valid).lessons.map(l => [l.id, l.learned])).toEqual(WIZARD_SPELL_IDS.map(id => [id, false]));
  });

  it('separates the two name citations from three G teachings and discloses the unverified formula', () => {
    for (const text of ['第一部第65章', 'L12121', '第二部第4章', 'L40190', '仅确认', '本作原创G低阶教学应用', '不声称原著完整技能表', '序列4神秘再现', '序列6卷轴制造']) expect(WIZARD_SOURCE_STATUS).toContain(text);
    expect(WIZARD_ABILITIES.map(a => a.id)).toEqual(['hermit.s7.spellcraft']);
    expect(WIZARD_SPELLS.map(spell => spell.label)).toEqual(['有限牵引', '短时护持', '局部模糊']);
    expect(WIZARD_SPELLS.every(spell => spell.description.includes('本作原创G教学') && spell.description.includes('单独学习成功'))).toBe(true);
    expect(projectWizard(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
  });
});
