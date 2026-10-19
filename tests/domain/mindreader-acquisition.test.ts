import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyAudienceCommand } from '../../src/domain/audience/index.js';
import { AUDIENCE_ABILITY_IDS } from '../../src/domain/audience/types.js';
import { applyMindreaderCommand, createMindreaderState, projectMindreader, validateMindreaderState, validateMindreaderCommand } from '../../src/domain/mindreader/index.js';
import { MINDREADER_ABILITIES, MINDREADER_FORMULA } from '../../src/domain/mindreader/content.js';
import { MINDREADER_ABILITY_IDS, type MindreaderAcquisitionCommand } from '../../src/domain/mindreader/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('mindreader-acquisition', sliceDefaultCreationSelection, 'mindreader-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.mindreader = createMindreaderState();
  return s;
}

function context(s: SliceState, checkRoll = 20) {
  const checks: [PublicCoreStatKey, number][] = [];
  const draws: [number, number][] = [];
  const notes: { title: string; text: string }[] = [];
  const c: SeerContext = {
    roll(min, max) { draws.push([min, max]); return min; },
    check(ability, difficulty) {
      checks.push([ability, difficulty]);
      const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: checkRoll });
      s.lastCheck = result;
      return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, checks, draws, notes };
}

function state(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyAudienceCommand(s, { type: 'DISCOVER' }, c);
  applyAudienceCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyAudienceCommand(s, { type: 'BUY_MATERIALS', batchId: s.audience.batches[0]!.id }, c);
  applyAudienceCommand(s, { type: 'BREW', batchId: s.audience.batches[0]!.id }, c);
  applyAudienceCommand(s, { type: 'CONSUME', bottleId: s.audience.bottles[0]!.id, confirmed: true }, c);
  s.week = 11;
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries(AUDIENCE_ABILITY_IDS.map((id, index) => [id, 25 * index]));
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: MindreaderAcquisitionCommand, roll = 20) { applyMindreaderCommand(s, command, context(s, roll).c); }
function taught(s = state()) { apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) {
  const batchId = s.mindreader.batches[index]!.id;
  apply(s, { type: 'BUY_MATERIALS', batchId });
  apply(s, { type: 'BREW', batchId });
  return s.mindreader.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: s.mindreader.bottles[0]!.id, confirmed: true });
  return s;
}
function unchangedRejection(s: SliceState, command: MindreaderAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('sourced small-batch mindreader acquisition', () => {
  it('keeps formula, abilities and supply details hidden from ordinary people', () => {
    const s = ordinary(), p = projectMindreader(s);
    expect(validateMindreaderState(s)).toBe(true);
    expect(p.discovered).toBe(false);
    expect(p.actions).toEqual([]);
    expect(p.formula).toEqual([]);
    expect(p.bottles).toEqual([]);
    expect(p.abilities).toEqual([]);
    expect(JSON.stringify(p)).not.toMatch(/mindreader-batch|七彩蜥龙|法尔斯曼|1200|仅有3批/);
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
    const separate = createMindreaderState();
    separate.batches[0]!.materials[0]!.quantity = 0;
    separate.cases['lost-key']!.status = 'OBSERVED';
    expect(s.mindreader.batches[0]!.materials[0]!.quantity).toBe(1);
    expect(s.mindreader.cases['lost-key']!.status).toBe('AVAILABLE');
  });

  it('uses the existing mentor, charging 180 pence and one action without a second discovery', () => {
    const s = state(), oldSeer = JSON.stringify(s.seer), progression = JSON.stringify(s.progression);
    expect(projectMindreader(s).actions.map(action => action.command.type)).toEqual(['LEARN_FORMULA']);
    expect(projectMindreader(s).formula).toEqual([]);
    apply(s, { type: 'LEARN_FORMULA' });
    expect([s.cash, s.actionsRemaining]).toEqual([9820, 39]);
    expect(JSON.stringify(s.seer)).toBe(oldSeer);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(projectMindreader(s).formula.map(item => `${item.name}:${item.quantity}${item.unit}`)).toEqual([
      '成年七彩蜥龙的完整脑垂体:1份', '法尔斯曼兔的脊髓液:10mL', '栗树芽孢:5g',
      '龙牙草粉末:8g', '纯白精灵花:3瓣', '纯水:100mL',
    ]);
    expect(validateMindreaderState(s)).toBe(true);
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
  });

  it('allows preparation before digestion and the six-week minimum are complete', () => {
    const s = state();
    s.week = 5;
    s.progression.acting = 0;
    taught(s);
    const bottle = brew(s);
    expect(bottle.status).toBe('PREPARED');
    unchangedRejection(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(validateMindreaderState(s)).toBe(true);
  });

  it('buys all six originals once for 1310, then consumes them for a 60-pence bottle without inventing a canonical order', () => {
    const s = taught(), batch = s.mindreader.batches[0]!, ap = s.actionsRemaining;
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([8510, ap]);
    expect(batch.materials.every(item => item.holder === 'PLAYER')).toBe(true);
    const ctx = context(s);
    applyMindreaderCommand(s, { type: 'BREW', batchId: batch.id }, ctx.c);
    expect([s.cash, s.actionsRemaining]).toEqual([8450, ap - 1]);
    expect(batch.materials.every(item => item.holder === 'CONSUMED' && item.quantity === 0)).toBe(true);
    expect(s.mindreader.bottles[0]!.inputIds).toEqual(MINDREADER_FORMULA.map(item => `${batch.id}:${item.id}`));
    expect(ctx.notes[0]!.text).toContain('不宣称尚未核实的原著投料顺序');
    expect(ctx.notes[0]!.text).not.toContain('最后加入');
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    unchangedRejection(s, { type: 'BREW', batchId: batch.id });
    expect(validateMindreaderState(s)).toBe(true);
  });

  it('requires three actual tasks for only this batch’s 1200-pence main-material credit', () => {
    const s = taught(), batch = s.mindreader.batches[0]!;
    for (let index = 0; index < 3; index += 1) {
      apply(s, { type: 'MATERIAL_WORK', batchId: batch.id });
      expect(batch.labourSteps).toBe(index + 1);
      expect(batch.materials.every(item => item.holder === 'SUPPLIER')).toBe(true);
      expect(projectMindreader(s).actions.find(action => action.id === `buy-${batch.id}`)!.cost).toContain(`${index === 2 ? 110 : 1310}便士`);
    }
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId: batch.id });
    expect(projectMindreader(s).actions.find(action => action.id === 'buy-mindreader-batch-2')!.cost).toContain('1310便士');
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    apply(s, { type: 'BREW', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([9650, 35]);
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId: batch.id });
    expect(validateMindreaderState(s)).toBe(true);
  });

  it.each([1, 2])('does not discount or cash out %i partial labour tasks', count => {
    const s = taught(), batchId = s.mindreader.batches[0]!.id;
    for (let index = 0; index < count; index += 1) apply(s, { type: 'MATERIAL_WORK', batchId });
    const cash = s.cash;
    apply(s, { type: 'BUY_MATERIALS', batchId });
    expect(cash - s.cash).toBe(1310);
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId });
  });

  it('rejects missing funds, unavailable batches and mismatched ingredients before mutation', () => {
    const s = state();
    s.cash = 179;
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
    s.cash = 10000;
    taught(s);
    const batchId = s.mindreader.batches[0]!.id;
    unchangedRejection(s, { type: 'BREW', batchId });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: 'mindreader-batch-4' });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: 'audience-batch-1' });
    s.cash = 1309;
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId });
    s.cash = 1369;
    apply(s, { type: 'BUY_MATERIALS', batchId });
    unchangedRejection(s, { type: 'BREW', batchId });
    s.cash = 60;
    s.mindreader.batches[0]!.materials[5]!.id = 'mindreader-batch-2:pure-water';
    unchangedRejection(s, { type: 'BREW', batchId });
    expect(validateMindreaderState(s)).toBe(false);
  });

  it('exhausts exactly three independent bottles with no refill or restored ingredients', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) brew(s, index);
    expect(new Set(s.mindreader.bottles.flatMap(bottle => bottle.inputIds)).size).toBe(18);
    for (const bottle of s.mindreader.bottles) apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
    expect(s.mindreader.bottles.every(bottle => bottle.status === 'CONSUMED')).toBe(true);
    expect(s.seer.pollution).toBe(75);
    s.week += 10;
    expect(projectMindreader(s).risk).toContain('供应方剩余0批');
    expect(projectMindreader(s).actions.map(a=>a.command.type)).toEqual(['REQUEST_SUPPLY']);expect(s.mindreader.batches).toHaveLength(3);
    expect(s.progression.sequence).toBe(9);
    expect(validateMindreaderState(s)).toBe(true);
  });
});

describe('one-bottle advancement with inherited seer progress', () => {
  it('requires both digestion and six elapsed weeks, plus explicit bottle confirmation', () => {
    const s = prepared(), bottleId = s.mindreader.bottles[0]!.id;
    s.week = 10;
    expect(projectMindreader(s).actions.find(action => action.command.type === 'CONSUME')!.reason).toContain('5/6');
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: true });
    s.week = 11;
    s.progression.acting = 99;
    expect(projectMindreader(s).actions.find(action => action.command.type === 'CONSUME')!.reason).toContain('99/100');
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: true });
    s.progression.acting = 100;
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: false } as unknown as MindreaderAcquisitionCommand);
    unchangedRejection(s, { type: 'CONSUME', bottleId: s.audience.bottles[0]!.id, confirmed: true });
    const ap = s.actionsRemaining;
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.actionsRemaining).toBe(ap);
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: true });
  });

  for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} through will difficulty 12 with exact retained costs`, () => {
    const s = prepared(), stats = { ...s.character.coreStats }, mastery = { ...s.progression.mastery }, ap = s.actionsRemaining;
    const oldSeer = JSON.stringify({ ...s.seer, pollution: 0 }), ctx = context(s, roll);
    s.spirituality = 7;
    applyMindreaderCommand(s, { type: 'CONSUME', bottleId: s.mindreader.bottles[0]!.id, confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.mindreader.bottles[0]!).toMatchObject({ status: 'CONSUMED', outcome: tier });
    expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap]);
    expect(s.status).toBe('ACTIVE');
    expect(s.progression.promotionWeek).toBe(5);
    expect(s.progression.sequence).toBe(success ? 8 : 9);
    expect(s.progression.acting).toBe(success ? 0 : 100);
    expect(s.mindreader.promotionWeek).toBe(success ? 11 : null);
    expect(s.mindreader.audienceActingAtPromotion).toBe(success ? 100 : null);
    expect(JSON.stringify({ ...s.seer, pollution: 0 })).toBe(oldSeer);
    expect(s.progression.mastery).toMatchObject(mastery);
    expect(s.progression.mastery).toEqual(success ? { ...mastery, ...Object.fromEntries(MINDREADER_ABILITY_IDS.map(id => [id, 0])) } : mastery);
    expect(s.character.coreStats).toEqual(success ? { physique: stats.physique, perception: stats.perception + 3, will: stats.will + 3, knowledge: stats.knowledge + 2 } : stats);
    expect(validateMindreaderState(s)).toBe(true);
  });

  it('retains severe negative resources without random death, free retry, or loss of S9 mastery', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    s.health = 1;
    s.mind = 1;
    apply(s, { type: 'CONSUME', bottleId: s.mindreader.bottles[0]!.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution]).toEqual([-19, -39, 50]);
    expect(s.status).toBe('ACTIVE');
    expect(s.progression.mastery).toEqual(mastery);
    expect(s.progression.acting).toBe(100);
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: s.mindreader.batches[1]!.id });
    expect(validateMindreaderState(s)).toBe(true);
  });

  it('prevents multiple rewards even when extra original bottles remain prepared', () => {
    const s = prepared();
    brew(s, 1);
    apply(s, { type: 'CONSUME', bottleId: s.mindreader.bottles[0]!.id, confirmed: true });
    unchangedRejection(s, { type: 'CONSUME', bottleId: s.mindreader.bottles[1]!.id, confirmed: true });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: s.mindreader.batches[2]!.id });
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId: s.mindreader.batches[2]!.id });
    expect(s.mindreader.bottles[1]!.status).toBe('PREPARED');
    expect(projectMindreader(s).actions.length === 0).toBe(true);
    expect(validateMindreaderState(s)).toBe(true);
  });

  it('uses actual normal-check chances, caps attributes and never restores current spirit', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectMindreader(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 12, modifiers: [] }));
    }
    s.character.coreStats.physique = 498;
    s.character.coreStats.perception = 499;
    s.character.coreStats.knowledge = 500;
    s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: s.mindreader.bottles[0]!.id, confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 498, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
  });
});

describe('finite failure recovery and public boundary', () => {
  function failedRound() {
    const s = taught();
    for (let index = 0; index < 3; index += 1) {
      const bottle = brew(s, index);
      apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
    }
    return s;
  }

  it('waits for actual failure of every original and a real next week before new supply', () => {
    const s = taught();
    unchangedRejection(s, { type: 'REQUEST_SUPPLY' });
    unchangedRejection(s, { type: 'RECEIVE_SUPPLY' });
    for (let index = 0; index < 3; index += 1) {
      const bottle = brew(s, index);
      unchangedRejection(s, { type: 'REQUEST_SUPPLY' });
      apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
    }
    const oldBatches = JSON.stringify(s.mindreader.batches), oldBottles = JSON.stringify(s.mindreader.bottles);
    const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(ap - 1);
    expect(s.cash).toBe(cash);
    expect(s.mindreader.resupply.requestedWeek).toBe(11);
    unchangedRejection(s, { type: 'REQUEST_SUPPLY' });
    unchangedRejection(s, { type: 'RECEIVE_SUPPLY' });
    expect(projectMindreader(s).actions[0]!.enabled).toBe(false);
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.mindreader.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.mindreader.batches).toHaveLength(6);
    expect(JSON.stringify(s.mindreader.batches.slice(0, 3))).toBe(oldBatches);
    expect(JSON.stringify(s.mindreader.bottles)).toBe(oldBottles);
    expect(s.mindreader.batches.slice(3).map(b => b.id)).toEqual(['mindreader-batch-4', 'mindreader-batch-5', 'mindreader-batch-6']);
    expect(s.mindreader.batches.slice(3).every(b => !b.acquired && !b.brewed && b.labourSteps === 0 && b.materials.every(m => m.holder === 'SUPPLIER'))).toBe(true);
    expect([s.cash, s.actionsRemaining]).toEqual([cash, ap - 1]);
    unchangedRejection(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateMindreaderState(s)).toBe(true);
  });

  it('retains the same full costs or three real labour steps after resupply', () => {
    const s = failedRound();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const batchId = 'mindreader-batch-4', cash = s.cash, ap = s.actionsRemaining;
    for (let i = 0; i < 3; i += 1) apply(s, { type: 'MATERIAL_WORK', batchId });
    apply(s, { type: 'BUY_MATERIALS', batchId });
    apply(s, { type: 'BREW', batchId });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 170, ap - 4]);
    apply(s, { type: 'CONSUME', bottleId: `${batchId}:bottle`, confirmed: true }, 1);
    expect(s.progression.sequence).toBe(8);
    expect(validateMindreaderState(s)).toBe(true);
    unchangedRejection(s, { type: 'REQUEST_SUPPLY' });
  });

  it('blocks preparations while dead, in an event, combat, elsewhere or incapacitated', () => {
    const cases: ((s: SliceState) => void)[] = [
      s => { s.status = 'DEAD'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test-1' }; },
      s => { s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null }; },
      s => { s.world.city = 'ELSEWHERE'; },
      s => { s.health = 0; },
      s => { s.mind = 0; },
      s => { s.actionsRemaining = 0; },
    ];
    for (const mutate of cases) {
      const s = state(); mutate(s);
      unchangedRejection(s, { type: 'LEARN_FORMULA' });
    }
  });

  it('shows one new S8 ability, keeps each inherited pool, and detaches projected display data', () => {
    const s = promoted(), before = JSON.stringify(s), p = projectMindreader(s);
    expect(p.abilities.map(a => a.id)).toEqual(['audience.mind-reading']);
    expect(MINDREADER_ABILITIES).toHaveLength(1);
    expect(MINDREADER_ABILITIES[0]!.description).toContain('读取当下浅层想法');
    expect(MINDREADER_ABILITIES[0]!.description).toContain('不是客观真相');
    expect(MINDREADER_ABILITIES[0]!.description).toContain('不能检索深层记忆或直接控制');
    expect(p.risk).toContain('意志难度12');
    expect(p.risk).toContain('不适用于战斗');
    p.formula[0]!.quantity = 999;
    p.abilities[0]!.mastery = 500;
    p.bottles[0]!.source = 'changed';
    p.scenes.push({ id: 'fake', title: 'fake', story: '', observations: [], impression: '', status: 'AVAILABLE' });
    expect(JSON.stringify(s)).toBe(before);
    expect(MINDREADER_FORMULA[0]!.quantity).toBe(1);
    expect(s.progression.mastery).toMatchObject(Object.fromEntries(AUDIENCE_ABILITY_IDS.map((id, i) => [id, 25 * i])));
  });

  it.each([
    null, {}, { type: 'DISCOVER' }, { type: 'LEARN_GUIDANCE' }, { type: 'BUY_PAPER' },
    { type: 'LEARN_FORMULA', injected: true }, { type: 'BUY_MATERIALS', batchId: 'audience-batch-1' },
    { type: 'BUY_MATERIALS', batchId: 'mindreader-batch-01' },
    { type: 'CONSUME', bottleId: 'mindreader-batch-1:bottle', confirmed: false },
    { type: 'CONSUME', bottleId: 'mindreader-batch-1:bottle', confirmed: true, batchId: 'mindreader-batch-2' },
    { type: 'READ', caseId: 'unknown' }, { type: 'DISCUSS', caseId: 'lost-key', approach: 'ACCUSE' },
  ])('rejects malformed or unapproved command %j', command => {
    expect(validateMindreaderCommand(command)).toBe(false);
    unchangedRejection(taught(), command as MindreaderAcquisitionCommand);
  });

  it.each([
    { type: 'LEARN_FORMULA' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    { type: 'MATERIAL_WORK', batchId: 'mindreader-batch-1' }, { type: 'BUY_MATERIALS', batchId: 'mindreader-batch-1' },
    { type: 'BREW', batchId: 'mindreader-batch-1' }, { type: 'CONSUME', bottleId: 'mindreader-batch-1:bottle', confirmed: true },
    { type: 'OBSERVE', caseId: 'lost-key' }, { type: 'READ', caseId: 'curtain-call' },
    { type: 'DISCUSS', caseId: 'harbor-message', approach: 'ASK' }, { type: 'DISCUSS', caseId: 'harbor-message', approach: 'VERIFY' }, { type: 'REFLECT' },
  ])('recognizes bounded acquisition and social command %j', command => expect(validateMindreaderCommand(command)).toBe(true));
});

describe('mindreader save invariants', () => {
  it('accepts a JSON round trip without overwriting original promotion or S9 history', () => {
    const s = promoted(), loaded = JSON.parse(JSON.stringify(s)) as SliceState;
    expect(validateMindreaderState(loaded)).toBe(true);
    expect([loaded.progression.promotionWeek, loaded.mindreader.promotionWeek, loaded.mindreader.audienceActingAtPromotion]).toEqual([5, 11, 100]);
  });

  const mutations: [string, (s: SliceState) => void][] = [
    ['duplicate bottle', s => { s.mindreader.bottles.push({ ...s.mindreader.bottles[0]! }); }],
    ['restored consumed material', s => { s.mindreader.batches[0]!.materials[0]!.quantity = 1; }],
    ['transferred consumed material', s => { s.mindreader.batches[0]!.materials[0]!.holder = 'PLAYER'; }],
    ['invented material source', s => { s.mindreader.batches[0]!.materials[0]!.source = 'unknown'; }],
    ['mixed bottle provenance', s => { s.mindreader.bottles[0]!.inputIds[0] = 'audience-batch-1:pure-water'; }],
    ['prepared successful bottle', s => { s.mindreader.bottles[0]!.status = 'PREPARED'; }],
    ['early S8 promotion', s => { s.mindreader.promotionWeek = 10; }],
    ['forgotten S9 digestion', s => { s.mindreader.audienceActingAtPromotion = 99; }],
    ['forgotten formula', s => { s.mindreader.formulaKnown = false; }],
    ['absent new mastery', s => { delete s.progression.mastery['audience.mind-reading']; }],
    ['unlearned higher ability', s => { s.progression.mastery['audience.mind-control'] = 0; }],
    ['missing inherited mastery', s => { delete s.progression.mastery['audience.observation']; }],
    ['extra case', s => { s.mindreader.cases['fake'] = { ...s.mindreader.cases['lost-key']! }; }],
    ['unrecorded successful read', s => { s.mindreader.cases['lost-key']!.readSucceeded = true; }],
    ['read before promotion', s => { s.mindreader.cases['lost-key']!.status = 'OBSERVED'; s.mindreader.cases['lost-key']!.readWeek = 10; }],
    ['unrequested resupply', s => { s.mindreader.resupply.deliveries = 1; }],
  ];
  it.each(mutations)('rejects %s', (_name, mutate) => {
    const s = promoted(); mutate(s);
    expect(validateMindreaderState(s)).toBe(false);
  });

  it('rejects S8 markings or social progress before actual promotion', () => {
    for (const mutate of [
      (s: SliceState) => { s.mindreader.promotionWeek = 11; },
      (s: SliceState) => { s.mindreader.audienceActingAtPromotion = 100; },
      (s: SliceState) => { s.progression.mastery['audience.mind-reading'] = 0; },
      (s: SliceState) => { s.mindreader.cases['lost-key']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.mindreader.reflected = true; },
    ]) {
      const s = state(); mutate(s);
      expect(validateMindreaderState(s)).toBe(false);
    }
  });

  it('returns false rather than throwing for malformed nested saves', () => {
    const s = promoted();
    for (const mindreader of [null, {}, { ...s.mindreader, batches: [null, null, null] }, { ...s.mindreader, bottles: [null] }, { ...s.mindreader, cases: null }, { ...s.mindreader, cases: { ...s.mindreader.cases, 'lost-key': null } }, { ...s.mindreader, resupply: null }]) {
      expect(validateMindreaderState({ ...s, mindreader } as unknown as SliceState)).toBe(false);
    }
  });
});
