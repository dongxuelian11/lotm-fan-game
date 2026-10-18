import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyAudienceCommand } from '../../src/domain/audience/index.js';
import { AUDIENCE_ABILITY_IDS } from '../../src/domain/audience/types.js';
import { applyMindreaderCommand } from '../../src/domain/mindreader/index.js';
import { MINDREADER_ABILITY_IDS } from '../../src/domain/mindreader/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyPsychologistCommand, createPsychologistState, isPsychologistAcquisitionCommand,
  projectPsychologist, validatePsychologistCommand, validatePsychologistState,
} from '../../src/domain/psychologist/index.js';
import { PSYCHOLOGIST_ABILITIES, PSYCHOLOGIST_BOTTLE_IDS, PSYCHOLOGIST_FORMULA_STATUS, PSYCHOLOGIST_LABOUR_TASKS } from '../../src/domain/psychologist/content.js';
import { PSYCHOLOGIST_ABILITY_IDS, PSYCHOLOGIST_CASE_IDS, type PsychologistAcquisitionCommand } from '../../src/domain/psychologist/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const FIRST_BOTTLE = PSYCHOLOGIST_BOTTLE_IDS[0];
function ordinary(): SliceState {
  const s = createSliceRun('psychologist-acquisition', sliceDefaultCreationSelection, 'psychologist-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.psychologist = createPsychologistState();
  return s;
}
function context(s: SliceState, checkRoll = 20) {
  const checks: [PublicCoreStatKey, number][] = [], notes: { title: string; text: string }[] = [];
  const c: SeerContext = {
    roll(min) { return min; },
    check(ability, difficulty) {
      checks.push([ability, difficulty]);
      const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: checkRoll });
      s.lastCheck = result;
      return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, checks, notes };
}
function mindreader(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
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
  s.progression.mastery = Object.fromEntries([...AUDIENCE_ABILITY_IDS, ...MINDREADER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 20;
  return s;
}
function apply(s: SliceState, command: PsychologistAcquisitionCommand, roll = 20) { applyPsychologistCommand(s, command, context(s, roll).c); }
function taught(s = mindreader()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.psychologist.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function consume(s: SliceState, roll = 20, index = 0) { apply(s, { type: 'CONSUME', bottleId: s.psychologist.bottles[index]!.id, confirmed: true }, roll); }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as PsychologistAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
  return s;
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('psychologist S7 independent finished-potion acquisition', () => {
  it('starts with three independent sourced originals and no activity progress', () => {
    const s = ordinary(), other = createPsychologistState();
    expect(validatePsychologistState(s)).toBe(true);
    expect(s.psychologist.bottles.map(bottle => bottle.id)).toEqual([...PSYCHOLOGIST_BOTTLE_IDS]);
    expect(s.psychologist.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(s.psychologist).toMatchObject({ reflected: false, promotionWeek: null, mindreaderActingAtPromotion: null, encounter: { status: 'AVAILABLE', observed: false, attemptWeek: null, startHistoryIndex: null } });
    expect(Object.keys(s.psychologist.cases)).toEqual([...PSYCHOLOGIST_CASE_IDS]);
    for (const [index, id] of PSYCHOLOGIST_CASE_IDS.entries()) expect(s.psychologist.cases[id]).toEqual({ status: 'AVAILABLE', consent: false, supportWeek: null, attemptWeek: null, method: null, mind: [40, 55, 50][index], readSummary: null });
    other.bottles[0]!.labourSteps = 4; other.cases['night-watch']!.mind = 70; other.encounter.observed = true;
    expect(s.psychologist.bottles[0]!.labourSteps).toBe(0);
    expect(s.psychologist.cases['night-watch']!.mind).toBe(40);
    expect(s.psychologist.encounter.observed).toBe(false);
  });

  it('hides the future channel from ordinary people and prevents route skipping', () => {
    const s = ordinary(), p = projectPsychologist(s);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], scenes: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/psychologist-potion|2010|1800/);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    const audience = mindreader(); audience.progression.sequence = 9;
    rejected(audience, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 240 pence and one action for guidance without revealing an invented formula', () => {
    const s = mindreader(), oldAudience = JSON.stringify(s.audience), oldMindreader = JSON.stringify(s.mindreader), oldProgression = JSON.stringify(s.progression);
    expect(projectPsychologist(s).actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    taught(s);
    expect([s.cash, s.actionsRemaining, s.psychologist.guidanceKnown]).toEqual([9760, 39, true]);
    expect(projectPsychologist(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(projectPsychologist(s).supplies).toContain(PSYCHOLOGIST_FORMULA_STATUS);
    expect(projectPsychologist(s).bottles.every(bottle => bottle.source.includes('序列7') && bottle.source.includes('本作G'))).toBe(true);
    expect([JSON.stringify(s.audience), JSON.stringify(s.mindreader), JSON.stringify(s.progression)]).toEqual([oldAudience, oldMindreader, oldProgression]);
    expect(validatePsychologistState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 2010 pence with zero action to transfer exactly the selected original', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.psychologist.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([7750, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.psychologist.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validatePsychologistState(s)).toBe(true);
  });

  it('requires four real actions on this bottle before the 1800 credit and 210 cash payment', () => {
    const s = taught(), ctx = context(s);
    for (let index = 0; index < 4; index += 1) {
      applyPsychologistCommand(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.psychologist.bottles[0]!.labourSteps]).toEqual([9760, 38 - index, index + 1]);
      expect(projectPsychologist(s).actions.find(action => action.id === `buy-${FIRST_BOTTLE}`)!.cost).toContain(`${index === 3 ? 210 : 2010}便士`);
    }
    expect(ctx.notes.map(note => note.title)).toEqual(PSYCHOLOGIST_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectPsychologist(s).actions.find(action => action.id === `buy-${PSYCHOLOGIST_BOTTLE_IDS[1]}`)!.cost).toContain('2010便士');
    rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    buy(s);
    expect([s.cash, s.actionsRemaining, s.psychologist.bottles[0]!.status]).toEqual([9550, 35, 'PLAYER']);
  });

  it('never partially refunds one, two or three completed jobs', () => {
    for (const count of [1, 2, 3]) {
      const s = taught();
      for (let i = 0; i < count; i += 1) apply(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
      const cash = s.cash;
      buy(s);
      expect(cash - s.cash).toBe(2010);
      rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    }
  });

  it('rejects insufficient cash and foreign or nonexistent originals before mutation', () => {
    const s = mindreader(); s.cash = 239;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; taught(s);
    for (const bottleId of ['audience-potion-1', 'mindreader-potion-1', 'psychologist-potion-4']) rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 2009; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    s.cash = 210; buy(s); expect(s.cash).toBe(0);
  });

  it('allows preparation early but measures eight whole weeks from S8, not the S9 promotion', () => {
    const s = mindreader(); s.week = 11; s.progression.acting = 0;
    taught(s); buy(s);
    const command = { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true } as const;
    rejected(s, command);
    s.progression.acting = 100;
    for (const week of [11, 16, 18]) {
      s.week = week;
      expect(projectPsychologist(s).actions.find(action => action.id === `consume-${FIRST_BOTTLE}`)!.reason).toContain(`${week - 11}/8`);
      rejected(s, command);
    }
    s.week = 19; s.progression.acting = 99; rejected(s, command);
    s.progression.acting = 100; apply(s, command);
    expect([s.progression.promotionWeek, s.mindreader.promotionWeek, s.psychologist.promotionWeek]).toEqual([5, 11, 19]);
    expect(s.psychologist.bottles[0]).toMatchObject({ acquiredWeek: 11, consumedWeek: 19 });
    expect(validatePsychologistState(s)).toBe(true);
  });

  it('requires separate exact confirmation and rejects forged commands without mutation', () => {
    const s = prepared();
    for (const command of [
      { type: 'CONSUME', bottleId: FIRST_BOTTLE },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, bonus: 1 },
      { type: 'BREW' }, { type: 'PRACTICE', practiceId: 'flame-control' },
      { type: 'CONSUME', bottleId: PSYCHOLOGIST_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
  });

  it('blocks unavailable bodies, routes, locations, runs and active events', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.audience.discovered = false; },
      s => { s.mindreader.formulaKnown = false; }, s => { s.mindreader.promotionWeek = null; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; },
      s => { s.status = 'SLICE_COMPLETE'; }, s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
    ];
    for (const change of changes) {
      const s = prepared(); change(s);
      rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true });
    }
  });

  it('requires AP for guidance and labour but permits payment and consumption at zero AP', () => {
    const s = mindreader(); s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s);
    rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    buy(s); consume(s);
    expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 7]);
  });

  it.each([
    [1, 'GREAT_SUCCESS', 7, 95, 100, 0],
    [20, 'SUCCESS', 7, 90, 100, 0],
    [80, 'FAILURE', 8, 80, 90, 25],
    [99, 'GREAT_FAILURE', 8, 60, 80, 50],
  ] as const)('resolves roll %i as %s with a consumed original and the guided recoverable consequences', (roll, tier, sequence, mind, health, pollution) => {
    const s = prepared(), ctx = context(s, roll), ap = s.actionsRemaining;
    applyPsychologistCommand(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 18]]);
    expect([s.progression.sequence, s.mind, s.health, s.seer.pollution, s.status, s.actionsRemaining]).toEqual([sequence, mind, health, pollution, 'ACTIVE', ap]);
    expect(s.psychologist.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
    expect(validatePsychologistState(s)).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true });
  });

  it('inherits all four mastered abilities and records S8 digestion while resetting only S7 acting', () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldAudience = JSON.stringify(s.audience), oldMindreader = JSON.stringify(s.mindreader), oldArchive = JSON.stringify(s.caseArchive);
    s.spirituality = 9; consume(s);
    expect(s.psychologist.mindreaderActingAtPromotion).toBe(100);
    expect(s.progression.acting).toBe(0);
    expect(s.progression.mastery).toEqual({ ...oldMastery, ...Object.fromEntries(PSYCHOLOGIST_ABILITY_IDS.map(id => [id, 0])) });
    expect(s.character.coreStats).toEqual({ physique: stats.physique, perception: stats.perception + 2, will: stats.will + 4, knowledge: stats.knowledge + 2 });
    expect(s.spirituality).toBe(9);
    expect(projectSliceState(s).maxSpirituality).toBe(60);
    expect([JSON.stringify(s.audience), JSON.stringify(s.mindreader), JSON.stringify(s.caseArchive)]).toEqual([oldAudience, oldMindreader, oldArchive]);
    expect(projectPsychologist(s).abilities.map(ability => ability.id)).toEqual([...PSYCHOLOGIST_ABILITY_IDS]);
  });

  it('keeps failures and earlier progression intact so another original can be used after recovery', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    consume(s, 99);
    expect([s.progression.acting, s.psychologist.promotionWeek, s.psychologist.mindreaderActingAtPromotion]).toEqual([100, null, null]);
    expect(s.progression.mastery).toEqual(mastery);
    s.mind = 100; s.health = 100;
    buy(s, 1); consume(s, 20, 1);
    expect(s.psychologist.bottles[0]!.outcome).toBe('GREAT_FAILURE');
    expect(s.psychologist.bottles[1]!.outcome).toBe('SUCCESS');
    expect(s.seer.pollution).toBe(50);
    expect(validatePsychologistState(s)).toBe(true);
  });

  it('keeps spare bottles after promotion but blocks further preparation or consumption', () => {
    const s = taught(); buy(s); buy(s, 1); consume(s);
    expect(s.psychologist.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: PSYCHOLOGIST_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: PSYCHOLOGIST_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: PSYCHOLOGIST_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectPsychologist(s).actions.every(action => !action.enabled)).toBe(true);
  });

  it('only restocks after all failures and a real later week, without giving away the next bottles', () => {
    const s = exhausted(), originals = JSON.stringify(s.psychologist.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.psychologist.bottles.length, s.psychologist.resupply.requestedWeek]).toEqual([ap - 1, 3, 19]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.psychologist.bottles.slice(0, 3))).toBe(originals);
    expect([s.cash, s.actionsRemaining, s.psychologist.resupply.deliveries, s.psychologist.resupply.requestedWeek]).toEqual([cash, ap - 1, 1, null]);
    expect(s.psychologist.bottles.slice(3).map(bottle => [bottle.id, bottle.status, bottle.labourSteps])).toEqual([
      ['psychologist-potion-4', 'SUPPLIER', 0], ['psychologist-potion-5', 'SUPPLIER', 0], ['psychologist-potion-6', 'SUPPLIER', 0],
    ]);
    expect(projectPsychologist(s).actions.find(action => action.id === 'buy-psychologist-potion-4')!.cost).toContain('2010便士');
    expect(validatePsychologistState(s)).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
  });

  it('does not restock while any original remains unconsumed', () => {
    const s = taught();
    rejected(s, { type: 'REQUEST_SUPPLY' });
    buy(s); consume(s, 80); buy(s, 1); consume(s, 80, 1);
    rejected(s, { type: 'REQUEST_SUPPLY' });
    expect(s.psychologist.bottles).toHaveLength(3);
  });

  it('rejects invalid bottle identity, duplicated promotion and shortened maturation on load', () => {
    const s = prepared(); consume(s);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.psychologist.bottles[0]!.id = 'mindreader-potion-1'; },
      s => { s.psychologist.bottles[0]!.source = 'unsourced substitute'; },
      s => { s.psychologist.bottles[1]!.labourSteps = 5; },
      s => { s.psychologist.promotionWeek = 18; },
      s => { s.psychologist.mindreaderActingAtPromotion = 99; },
      s => { delete s.progression.mastery[AUDIENCE_ABILITY_IDS[0]]; },
      s => { delete s.progression.mastery[MINDREADER_ABILITY_IDS[0]]; },
      s => { delete s.psychologist.cases['night-watch']; },
      s => { s.psychologist.cases['stage-fright']!.supportWeek = 18; },
      s => { s.psychologist.cases['unsettled-letter']!.mind = 101; },
      s => { s.psychologist.encounter.attemptWeek = 18; },
      s => { s.psychologist.bottles[1] = { ...s.psychologist.bottles[0]!, id: PSYCHOLOGIST_BOTTLE_IDS[1], source: s.psychologist.bottles[1]!.source }; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validatePsychologistState(bad)).toBe(false); }
    const bad = clone(s); (bad.psychologist.bottles as unknown[])[0] = null;
    expect(validatePsychologistState(bad)).toBe(false);
  });

  it('keeps command boundaries separate and projects the exact G risk and current will chance', () => {
    expect(isPsychologistAcquisitionCommand({ type: 'BUY_POTION', bottleId: FIRST_BOTTLE })).toBe(true);
    expect(isPsychologistAcquisitionCommand({ type: 'REFLECT' })).toBe(false);
    for (const type of ['OBSERVE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT']) expect(validatePsychologistCommand({ type })).toBe(true);
    for (const type of ['OBSERVE', 'DISCUSS', 'REFER', 'WITHDRAW']) expect(validatePsychologistCommand({ type, caseId: 'night-watch' })).toBe(true);
    for (const method of ['SOOTHE', 'SUGGEST', 'COMMUNICATE']) expect(validatePsychologistCommand({ type: 'SUPPORT', caseId: 'stage-fright', method })).toBe(true);
    for (const bad of [
      { type: 'SUPPORT', caseId: 'night-watch', method: 'REFER' },
      { type: 'SUPPORT', caseId: 'night-watch', method: 'HYPNOTIZE' },
      { type: 'SUPPORT', caseId: 'unknown', method: 'SOOTHE' },
      { type: 'OBSERVE', caseId: 'lost-key' },
      { type: 'WITHDRAW', caseId: 'night-watch', free: true },
      { type: 'OBSERVE_ENCOUNTER', free: true },
    ]) expect(validatePsychologistCommand(bad)).toBe(false);
    const s = prepared(), p = projectPsychologist(s);
    expect(p.bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] }));
    expect(p.risk).toContain('本作G游戏平衡');
    expect(p.risk).toContain('意志难度18');
    expect(PSYCHOLOGIST_ABILITIES.map(ability => ability.id)).toEqual([...PSYCHOLOGIST_ABILITY_IDS]);
    expect(PSYCHOLOGIST_ABILITIES.some(ability => /hypnosis|invisibility|scales|purify/.test(ability.id))).toBe(false);
    expect(PSYCHOLOGIST_ABILITIES.find(ability => ability.id === 'audience.s7.frenzy')!.description).toContain('不能把每个目标自动判为失控');
    expect(PSYCHOLOGIST_ABILITIES.find(ability => ability.id === 'audience.s7.soothe')!.description).toContain('可能失败');
    expect(PSYCHOLOGIST_ABILITIES.find(ability => ability.id === 'audience.s7.mental-communication')!.description).toContain('欺骗');
    expect(JSON.stringify(p.formula)).not.toMatch(/镜龙|血液|50|长者之树/);
  });
});
