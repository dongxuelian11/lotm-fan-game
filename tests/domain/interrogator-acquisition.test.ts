import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyArbiterCommand } from '../../src/domain/arbiter/index.js';
import { ARBITER_ABILITY_IDS } from '../../src/domain/arbiter/types.js';
import { applySheriffCommand } from '../../src/domain/sheriff/index.js';
import { SHERIFF_ABILITY_IDS } from '../../src/domain/sheriff/types.js';
import {
  applyInterrogatorCommand, createInterrogatorState, isInterrogatorAcquisitionCommand,
  projectInterrogator, validateInterrogatorCommand, validateInterrogatorState,
} from '../../src/domain/interrogator/index.js';
import {
  INTERROGATOR_ABILITIES, INTERROGATOR_BOTTLE_IDS, INTERROGATOR_CONSUMPTION_RISK, INTERROGATOR_FORMULA_STATUS,
  INTERROGATOR_LABOUR_TASKS, INTERROGATOR_SOURCE_STATUS,
} from '../../src/domain/interrogator/content.js';
import { INTERROGATOR_ABILITY_IDS, INTERROGATOR_CASE_IDS, type InterrogatorAcquisitionCommand, type InterrogatorCommand } from '../../src/domain/interrogator/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const OLD_IDS = [...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS];
function ordinary(): SliceState {
  const s = createSliceRun('interrogator-acquisition', sliceDefaultCreationSelection, 'interrogator-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 20000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 18;
  s.interrogator = createInterrogatorState();
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
/** Real prior bottles and promotion weeks; completed earlier acting is an acquisition fixture. */
function sheriff() {
  const s = ordinary(), c = context(s, 1).c;
  applyArbiterCommand(s, { type: 'DISCOVER' }, c);
  applyArbiterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyArbiterCommand(s, { type: 'BUY_POTION', bottleId: s.arbiter.bottles[0]!.id }, c);
  applyArbiterCommand(s, { type: 'CONSUME', bottleId: s.arbiter.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100; s.week = 11;
  applySheriffCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySheriffCommand(s, { type: 'BUY_POTION', bottleId: s.sheriff.bottles[0]!.id }, c);
  applySheriffCommand(s, { type: 'CONSUME', bottleId: s.sheriff.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries(OLD_IDS.map((id, index) => [id, index * 25]));
  s.week = 19; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 18;
  return s;
}
function apply(s: SliceState, command: InterrogatorAcquisitionCommand, roll = 20) { applyInterrogatorCommand(s, command, context(s, roll).c); }
function taught(s = sheriff()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.interrogator.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of INTERROGATOR_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as InterrogatorAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

// Acquisition owns bottle identity, maturity and promotion; life owns voluntary interview boundaries and CLOSE.
describe('Interrogator independent S7 acquisition', () => {
  it('starts with three separate original bottles, untouched cases and no known recipe', () => {
    const s = ordinary(), p = projectInterrogator(s);
    expect(validateInterrogatorState(s)).toBe(true);
    expect(s.interrogator.bottles.map(b => b.id)).toEqual([...INTERROGATOR_BOTTLE_IDS]);
    expect(s.interrogator.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.interrogator.cases)).toEqual([...INTERROGATOR_CASE_IDS]);
    expect(Object.values(s.interrogator.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.contactOpen && c.closes === 0)).toBe(true);
    expect(p).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('continues the same adult guide for240 and1AP without rewriting either earlier stage', () => {
    const s = sheriff(), prior = JSON.stringify([s.arbiter, s.sheriff, s.progression]), ctx = context(s);
    applyInterrogatorCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.interrogator.guidanceKnown]).toEqual([9760, 39, true]);
    expect(ctx.notes[0]!.text).toContain('已认识的本作原创成年民间调解文书员薇娜·贝尔');
    expect(projectInterrogator(s).supplies).toContain(INTERROGATOR_FORMULA_STATUS);
    expect(projectInterrogator(s).risk).toContain(INTERROGATOR_CONSUMPTION_RISK);
    expect(JSON.stringify([s.arbiter, s.sheriff, s.progression])).toBe(prior);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateInterrogatorState(s)).toBe(true);
  });

  it('requires confirmation for the exact owned S7 original, never an earlier bottle', () => {
    const s = prepared(), bottleId = INTERROGATOR_BOTTLE_IDS[0];
    for (const command of [
      { type: 'CONSUME', bottleId }, { type: 'CONSUME', bottleId, confirmed: false },
      { type: 'CONSUME', bottleId, confirmed: 'true' },
      { type: 'CONSUME', bottleId: 'arbiter-potion-1', confirmed: true },
      { type: 'CONSUME', bottleId: 'sheriff-potion-1', confirmed: true },
    ]) { expect(validateInterrogatorCommand(command)).toBe(false); rejected(s, command); }
    rejected(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[1], confirmed: true });
    expect(s.interrogator.bottles[0]!.status).toBe('PLAYER');
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.progression.sequence).toBe(7);
  });

  it('charges2010 at zero AP and does not partially redeem unfinished jobs', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: INTERROGATOR_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.interrogator.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 2010, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.interrogator.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateInterrogatorState(s)).toBe(true);
  });

  it('requires four separate jobs for this bottle before paying its remaining210', () => {
    const s = taught(), bottleId = INTERROGATOR_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 4; step += 1) {
      applyInterrogatorCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.interrogator.bottles[0]!.labourSteps]).toEqual([9760, 38 - step, step + 1]);
      expect(projectInterrogator(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 3 ? 210 : 2010}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(INTERROGATOR_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.interrogator.bottles[1]!.labourSteps).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 210; buy(s);
    expect([s.cash, s.actionsRemaining, s.interrogator.bottles[0]!.status]).toEqual([0, 35, 'PLAYER']);
  });

  it('permits preparation early but counts eight full weeks from Sheriff promotion', () => {
    const s = sheriff(); s.week = 11; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 18;
    expect(s.progression.promotionWeek).toBe(5);
    expect(s.sheriff.promotionWeek).toBe(11);
    rejected(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true });
    s.week = 19; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    apply(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.sheriff.promotionWeek, s.interrogator.promotionWeek]).toEqual([7, 5, 11, 19]);
    expect(validateInterrogatorState(s)).toBe(true);
  });

  it('blocks all three open contacts, lost channels and unavailable actions without spending', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.arbiter.cases['shared-yard']!.contactOpen = true; },
      s => { s.sheriff.cases['remembered-face']!.contactOpen = true; },
      s => { s.interrogator.cases['fragment-account']!.contactOpen = true; },
      s => { s.sheriff.guidanceKnown = false; }, s => { s.arbiter.discovered = false; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
    ];
    for (const change of changes) {
      const s = prepared(); change(s);
      rejected(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true });
      expect(projectInterrogator(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    }
    const s = sheriff(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: INTERROGATOR_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
  });

  it('resolves the four will18 tiers and preserves five old IDs, histories and current spirit', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, prior = JSON.stringify([s.arbiter, s.sheriff]), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7;
      const chance = projectInterrogator(s).bottles[0]!.chance;
      applyInterrogatorCommand(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 18, difficulty: 18, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.interrogator.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['justiciar', success ? 7 : 8, 5, success ? 0 : 100]);
      expect([s.interrogator.promotionWeek, s.interrogator.sheriffActingAtPromotion]).toEqual(success ? [19, 100] : [null, null]);
      expect(JSON.stringify([s.arbiter, s.sheriff])).toBe(prior); expect(s.seer.completedSources).toEqual(sources);
      for (const id of OLD_IDS) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 2], ['knowledge', 0]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...OLD_IDS, ...INTERROGATOR_ABILITY_IDS] : OLD_IDS);
      if (success) {
        for (const id of INTERROGATOR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
        expect(projectSliceState(s).maxSpirituality).toBe(60);
      }
      expect(Object.values(s.interrogator.cases).every(c => !c.contactOpen && c.closes === 0)).toBe(true);
      expect(s.status).toBe('ACTIVE'); expect(validateInterrogatorState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps gains at500 and exposes both limited S7 abilities without higher powers', () => {
    const s = prepared(); Object.assign(s.character.coreStats, { physique: 499, perception: 499, will: 499, knowledge: 499 });
    apply(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 499 });
    expect(INTERROGATOR_ABILITY_IDS).toEqual(['justiciar.s7.mental-puncture', 'justiciar.s7.mental-pressure']);
    expect(projectInterrogator(s).abilities).toEqual(INTERROGATOR_ABILITIES.map(a => ({ ...a, mastery: 0 })));
    expect(projectInterrogator(s)).toMatchObject({ formulaKnown: false, formula: [], cases: [] });
    for (const boundary of ['第二部第17章', '克莱恩并未屈服', '第五部第4章', '第三部第100章', '特雷茜躲开', '不设必中', '精神压迫', '精神刺穿', '序列6法官的禁止', '自愿', '本作原创G']) expect(INTERROGATOR_SOURCE_STATUS).toContain(boundary);
    for (const fragment of ['第二部第239章《班森的打算》', '闪纹黑蛇的角', '湖中之灵粉尘', '完整配方尚未核实', '投料数量', '不补造克数或辅材']) expect(INTERROGATOR_FORMULA_STATUS).toContain(fragment);
    expect(INTERROGATOR_ABILITIES[1]!.description).toContain('不保证口供真实');
  });

  it('keeps severe guided rejection recoverable and requires rest plus another original', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([8, 100]);
    expect(validateInterrogatorState(s)).toBe(true);
    s.health = 100; s.mind = 100;
    apply(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[1], confirmed: true });
    expect(s.interrogator.bottles[0]!.outcome).toBe('GREAT_FAILURE');
    expect(s.interrogator.bottles[1]!.outcome).toBe('SUCCESS');
    expect(s.seer.pollution).toBe(100);
    expect(validateInterrogatorState(s)).toBe(true);
  });

  it('retains held originals after promotion while closing further acquisition', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.interrogator.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: INTERROGATOR_BOTTLE_IDS[2] }, { type: 'BUY_POTION', bottleId: INTERROGATOR_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectInterrogator(s).digestion).toContain('治安官消化成果100/100已保留；审讯者扮演0/100');
    expect(validateInterrogatorState(s)).toBe(true);
  });

  it('waits a real week after exhaustion and delivers three separate payable originals', () => {
    const s = exhausted(), old = JSON.stringify(s.interrogator.bottles), prior = JSON.stringify([s.arbiter, s.sheriff]), cash = s.cash;
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.interrogator.resupply.requestedWeek]).toEqual([0, cash, 19]);
    expect(s.interrogator.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateInterrogatorState(s)).toBe(true);
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.interrogator.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.interrogator.bottles.slice(0, 3))).toBe(old); expect(JSON.stringify([s.arbiter, s.sheriff])).toBe(prior);
    expect(s.interrogator.bottles.slice(3).map(b => b.id)).toEqual(['interrogator-potion-4', 'interrogator-potion-5', 'interrogator-potion-6']);
    expect(s.interrogator.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第20周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'interrogator-potion-4', confirmed: true });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 4;
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'interrogator-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 210);
    apply(s, { type: 'CONSUME', bottleId: 'interrogator-potion-4', confirmed: true });
    expect([s.sheriff.promotionWeek, s.interrogator.promotionWeek]).toEqual([11, 20]);
    expect(validateInterrogatorState(s)).toBe(true);
  });

  it('never refills automatically or lets existing originals coexist with a new batch', () => {
    for (const s of [ordinary(), sheriff(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.interrogator.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    expect(s.interrogator.bottles).toHaveLength(6);
    expect(validateInterrogatorState(s)).toBe(true);
  });

  it('accepts exact acquisition and voluntary activity commands without formula or coercion actions', () => {
    const commands: InterrogatorCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'REFLECT' },
      { type: 'POTION_WORK', bottleId: INTERROGATOR_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'interrogator-potion-99' },
      { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true },
      ...INTERROGATOR_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['ABILITY', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) {
      expect(validateInterrogatorCommand(command)).toBe(true);
      if (!isInterrogatorAcquisitionCommand(command)) rejected(prepared(), command);
    }
    for (const command of [
      { type: 'LEARN_FORMULA' }, { type: 'BREW' }, { type: 'FORCE_CONFESSION' }, { type: 'TORTURE' }, { type: 'PROHIBIT' },
      { type: 'PREPARE', caseId: 'fragment-account', method: 'FORCE' },
      { type: 'PERFORM', caseId: 'fragment-account', guaranteedTruth: true },
      { type: 'CONSUME', bottleId: INTERROGATOR_BOTTLE_IDS[0], confirmed: true, free: true },
      { type: 'BUY_POTION', bottleId: 'interrogator-potion-01' },
    ]) expect(validateInterrogatorCommand(command)).toBe(false);
  });

  it('validates prior promotion provenance, exact mastery and case shape', () => {
    const valid = promoted();
    for (const change of [
      (s: SliceState) => { s.interrogator.sheriffActingAtPromotion = 99; },
      (s: SliceState) => { s.interrogator.promotionWeek = 18; },
      (s: SliceState) => { s.interrogator.bottles[0]!.consumedWeek = 18; },
      (s: SliceState) => { s.interrogator.bottles[0]!.source = 'converted sheriff bottle'; },
      (s: SliceState) => { delete s.progression.mastery[SHERIFF_ABILITY_IDS[0]]; },
      (s: SliceState) => { delete s.progression.mastery[ARBITER_ABILITY_IDS[0]]; },
      (s: SliceState) => { s.progression.mastery['justiciar.s6.prohibition'] = 0; },
      (s: SliceState) => { s.interrogator.cases['fragment-account']!.closes = -1; },
      (s: SliceState) => { s.interrogator.cases['fragment-account']!.attemptWeek = 18; },
      (s: SliceState) => { Object.assign(s.interrogator, { arbiterActingAtPromotion: 100 }); },
      (s: SliceState) => { Object.assign(s.interrogator.cases['fragment-account']!, { guaranteedTruth: true }); },
    ]) { const s = structuredClone(valid); change(s); expect(validateInterrogatorState(s)).toBe(false); }
    const r = valid.interrogator.cases['fragment-account']!;
    Object.assign(r, { status: 'EXAMINED', attemptWeek: 19, method: 'ABILITY', outcome: 'ACCOUNT_BOUNDED', contactOpen: true });
    expect(validateInterrogatorState(valid)).toBe(true);
    expect(projectInterrogator(valid).insideCase).toBe(true);
    r.contactOpen = false; r.closes = 1;
    expect(validateInterrogatorState(valid)).toBe(true);
    expect(projectInterrogator(valid).insideCase).toBe(false);
  });

  it('rejects forged supply provenance, chronology and malformed records without throwing', () => {
    const supplied = exhausted();
    apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 20;
    apply(supplied, { type: 'RECEIVE_SUPPLY' });
    for (const change of [
      (s: SliceState) => { s.interrogator.bottles[3]!.source = s.interrogator.bottles[0]!.source; },
      (s: SliceState) => { s.interrogator.bottles[3]!.labourSteps = 5; },
      (s: SliceState) => { s.interrogator.bottles[3]!.id = 'interrogator-potion-1'; },
      (s: SliceState) => { s.interrogator.bottles[0]!.consumedWeek = 20; },
      (s: SliceState) => { s.interrogator.resupply.deliveries = 0; },
      (s: SliceState) => { s.interrogator.resupply.requestedWeek = 20; },
      (s: SliceState) => { s.interrogator.bottles[0] = null as never; },
      (s: SliceState) => { s.interrogator.cases['fragment-account'] = null as never; },
      (s: SliceState) => { s.interrogator.reflected = true; },
    ]) {
      const s = structuredClone(supplied); change(s);
      expect(() => validateInterrogatorState(s)).not.toThrow();
      expect(validateInterrogatorState(s)).toBe(false);
    }
    expect(validateInterrogatorState(supplied)).toBe(true);
  });
});
