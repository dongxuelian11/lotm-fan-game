import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { emptyProgression, type SeerContext } from '../../src/domain/seer/index.js';
import {
  applyAudienceCommand, createAudienceState, projectAudience, validateAudienceCommand, validateAudienceState,
} from '../../src/domain/audience/index.js';
import { AUDIENCE_ABILITIES, AUDIENCE_FORMULA, AUDIENCE_FORMULA_SOURCE } from '../../src/domain/audience/content.js';
import { AUDIENCE_ABILITY_IDS, AUDIENCE_CASE_IDS, type AudienceAcquisitionCommand } from '../../src/domain/audience/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function state(): SliceState {
  const s = createSliceRun('audience-acquisition', sliceDefaultCreationSelection, 'audience-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.cash = 5000;
  s.week = 5;
  s.actionsRemaining = 30;
  s.weeklyBudget = 30;
  s.progression = emptyProgression();
  s.audience = createAudienceState();
  s.character.coreStats.will = 15;
  s.character.coreStats.knowledge = 15;
  return s;
}
function context(s: SliceState, checkRoll = 20) {
  const checks: [PublicCoreStatKey, number][] = [];
  const notes: { title: string; text: string }[] = [];
  const c: SeerContext = {
    roll() { throw new Error('Acquisition must not roll mastery or invent extra outcomes.'); },
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
function apply(s: SliceState, command: AudienceAcquisitionCommand, checkRoll = 20) { applyAudienceCommand(s, command, context(s, checkRoll).c); }
function taught(s = state()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_FORMULA' });
  return s;
}
function brew(s: SliceState, index = 0) {
  const batchId = s.audience.batches[index]!.id;
  apply(s, { type: 'BUY_MATERIALS', batchId });
  apply(s, { type: 'BREW', batchId });
  return s.audience.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: s.audience.bottles[0]!.id, confirmed: true });
  return s;
}
function unchangedRejection(s: SliceState, command: AudienceAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) {
    const bottle = brew(s, index);
    apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
  }
  return s;
}

describe('audience formula and conserved acquisition', () => {
  it('initializes independent finite materials and all four untouched social scenes', () => {
    const s = state(), p = projectAudience(s);
    expect(validateAudienceState(s)).toBe(true);
    expect(p.formula).toEqual([]);
    expect(p.bottles).toEqual([]);
    expect(p.abilities).toEqual([]);
    expect(p.scenes).toEqual([]);
    expect(p.actions.map(action => action.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toMatch(/audience-batch|曼哈尔|黑鱼|供应方剩余|仅有3批/);
    expect(s.audience.batches).toHaveLength(3);
    expect(s.audience.social).toEqual({
      trust: 0, reflected: false,
      cases: Object.fromEntries(AUDIENCE_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, approach: null, verified: false }])),
    });
    const independent = createAudienceState();
    independent.batches[0]!.materials[0]!.quantity = 0;
    independent.social.cases['counter-receipt']!.verified = true;
    expect(s.audience.batches[0]!.materials[0]!.quantity).toBe(80);
    expect(s.audience.social.cases['counter-receipt']!.verified).toBe(false);
  });

  it('charges one ordinary visit without granting abilities or revealing the formula', () => {
    const s = state(), stats = { ...s.character.coreStats }, cash = s.cash;
    apply(s, { type: 'DISCOVER' });
    expect([s.actionsRemaining, s.cash]).toEqual([29, cash]);
    expect(s.character.coreStats).toEqual(stats);
    expect(s.progression).toEqual(emptyProgression());
    expect(projectAudience(s).formula).toEqual([]);
    expect(projectAudience(s).risk).toContain('仅有3批');
    unchangedRejection(s, { type: 'DISCOVER' });
  });

  it('teaches six canon quantities, in auxiliary then eyes then blood order', () => {
    const s = taught(), p = projectAudience(s);
    expect([s.cash, s.actionsRemaining]).toEqual([4880, 28]);
    expect(AUDIENCE_FORMULA_SOURCE).toContain('第34章');
    expect(p.formula.map(item => `${item.name}:${item.quantity}${item.unit}`)).toEqual([
      '纯水:80mL', '秋水仙精华:5滴', '牛齿芍药粉末:13g', '精灵花:7瓣', '成年曼哈尔鱼的眼睛:1对', '羊角黑鱼血液:35mL',
    ]);
    expect(p.abilities).toEqual([]);
    expect(validateAudienceState(s)).toBe(true);
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
  });

  it('purchases one whole batch and consumes it once into its independent original bottle', () => {
    const s = taught(), batch = s.audience.batches[0]!, ap = s.actionsRemaining;
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([4220, ap]);
    expect(batch.materials.every(item => item.holder === 'PLAYER')).toBe(true);
    const ctx = context(s);
    applyAudienceCommand(s, { type: 'BREW', batchId: batch.id }, ctx.c);
    expect([s.cash, s.actionsRemaining]).toEqual([4160, ap - 1]);
    expect(batch.materials.every(item => item.holder === 'CONSUMED' && item.quantity === 0)).toBe(true);
    expect(s.audience.bottles[0]).toEqual({
      id: 'audience-batch-1:bottle', batchId: batch.id, inputIds: batch.materials.map(item => item.id),
      brewedWeek: 5, status: 'PREPARED', outcome: null,
    });
    expect(ctx.notes[0]!.text).toMatch(/先混合四项辅材.*再放入成年曼哈尔鱼眼睛.*最后加入羊角黑鱼血液/);
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    unchangedRejection(s, { type: 'BREW', batchId: batch.id });
    expect(validateAudienceState(s)).toBe(true);
  });

  it('requires two real labour actions for this batch only, plus auxiliary and brew fees', () => {
    const s = taught(), batchId = s.audience.batches[0]!.id;
    apply(s, { type: 'MATERIAL_WORK', batchId });
    expect(projectAudience(s).actions.find(action => action.id === `buy-${batchId}`)?.cost).toContain('660便士');
    apply(s, { type: 'MATERIAL_WORK', batchId });
    expect(projectAudience(s).actions.find(action => action.id === `buy-${batchId}`)?.cost).toContain('60便士');
    expect(s.audience.batches[0]!.materials.every(item => item.holder === 'SUPPLIER')).toBe(true);
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId });
    apply(s, { type: 'BUY_MATERIALS', batchId });
    apply(s, { type: 'BREW', batchId });
    expect([s.cash, s.actionsRemaining]).toEqual([4760, 25]);
    expect(s.audience.batches[1]!.labourSteps).toBe(0);
    expect(projectAudience(s).actions.find(action => action.id === 'buy-audience-batch-2')?.cost).toContain('660便士');
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId });
    expect(validateAudienceState(s)).toBe(true);
  });

  it('never refunds partial labour, backdates credit or substitutes material stock', () => {
    const s = taught(), batchId = s.audience.batches[0]!.id;
    apply(s, { type: 'MATERIAL_WORK', batchId });
    const cash = s.cash;
    apply(s, { type: 'BUY_MATERIALS', batchId });
    expect(cash - s.cash).toBe(660);
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: 'audience-batch-4' });
    s.audience.batches[0]!.materials[0]!.quantity = 79;
    unchangedRejection(s, { type: 'BREW', batchId });
    expect(validateAudienceState(s)).toBe(false);
  });

  it('rejects missing prerequisites and money before mutating the working state', () => {
    const s = state();
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: 'audience-batch-1' });
    apply(s, { type: 'DISCOVER' });
    s.cash = 119;
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
    s.cash = 1000;
    apply(s, { type: 'LEARN_FORMULA' });
    const batchId = s.audience.batches[0]!.id;
    unchangedRejection(s, { type: 'BREW', batchId });
    s.cash = 659;
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId });
    s.cash = 719;
    apply(s, { type: 'BUY_MATERIALS', batchId });
    unchangedRejection(s, { type: 'BREW', batchId });
  });
});

describe('audience promotion and guided failure', () => {
  it('waits four completed ordinary weeks and requires an independent confirmation', () => {
    const s = prepared(), bottleId = s.audience.bottles[0]!.id;
    s.week = 4;
    const offer = projectAudience(s).actions.find(action => action.command.type === 'CONSUME')!;
    expect(offer.enabled).toBe(false);
    expect(offer.reason).toContain('3/4');
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: true });
    s.week = 5;
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: false } as unknown as AudienceAcquisitionCommand);
    unchangedRejection(s, { type: 'CONSUME', bottleId: 'audience-batch-2:bottle', confirmed: true });
    const ap = s.actionsRemaining;
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.actionsRemaining).toBe(ap);
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: true });
  });

  for (const [roll, tier, mentalCost, healthCost, pollution, isPromoted] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [98, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`settles ${tier} with the exact original bottle and no spirit refill`, () => {
    const s = prepared(), before = { ...s.character.coreStats }, ap = s.actionsRemaining, ctx = context(s, roll);
    s.spirituality = 7;
    applyAudienceCommand(s, { type: 'CONSUME', bottleId: s.audience.bottles[0]!.id, confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 5]]);
    expect(s.audience.bottles[0]!.status).toBe('CONSUMED');
    expect(s.audience.bottles[0]!.outcome).toBe(tier);
    expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap]);
    expect(s.status).toBe('ACTIVE');
    expect(s.character.coreStats.physique).toBe(before.physique);
    expect(s.character.coreStats.perception).toBe(before.perception + (isPromoted ? 4 : 0));
    expect(s.character.coreStats.will).toBe(before.will + (isPromoted ? 3 : 0));
    expect(s.character.coreStats.knowledge).toBe(before.knowledge + (isPromoted ? 3 : 0));
    expect(s.progression.pathwayId).toBe(isPromoted ? 'audience' : null);
    expect(s.progression.mastery).toEqual(isPromoted ? Object.fromEntries(AUDIENCE_ABILITY_IDS.map(id => [id, 0])) : {});
    expect(s.seer.completedSources).toEqual([]);
    expect(validateAudienceState(s)).toBe(true);
  });

  it('can recover after failure and consume a different actual bottle only once', () => {
    const s = prepared(), first = s.audience.bottles[0]!;
    apply(s, { type: 'CONSUME', bottleId: first.id, confirmed: true }, 98);
    s.health = 100; s.mind = 100;
    const second = brew(s, 1);
    apply(s, { type: 'CONSUME', bottleId: second.id, confirmed: true }, 20);
    expect(s.audience.bottles.map(bottle => bottle.outcome)).toEqual(['GREAT_FAILURE', 'SUCCESS']);
    expect(s.seer.pollution).toBe(50);
    expect(s.progression.pathwayId).toBe('audience');
    unchangedRejection(s, { type: 'CONSUME', bottleId: first.id, confirmed: true });
    expect(validateAudienceState(s)).toBe(true);
  });

  it('uses the same displayed will check and caps attributes at 500', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectAudience(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.perception = 499;
    s.character.coreStats.knowledge = 500;
    apply(s, { type: 'CONSUME', bottleId: s.audience.bottles[0]!.id, confirmed: true }, 1);
    expect(s.character.coreStats).toMatchObject({ perception: 500, will: 500, knowledge: 500 });
    expect(AUDIENCE_ABILITIES.map(ability => ability.id)).toEqual([...AUDIENCE_ABILITY_IDS]);
    expect(projectAudience(s).abilities).toHaveLength(3);
  });

  for (const pathwayId of ['diviner', 'hunter', 'audience'] as const) it(`preserves unconsumed originals after choosing ${pathwayId}`, () => {
    const s = prepared();
    s.progression.pathwayId = pathwayId;
    s.progression.sequence = 9;
    unchangedRejection(s, { type: 'CONSUME', bottleId: s.audience.bottles[0]!.id, confirmed: true });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: 'audience-batch-2' });
    expect(s.audience.bottles[0]!.status).toBe('PREPARED');
    expect(projectAudience(s).actions.every(action => !action.enabled)).toBe(true);
  });

  it('publishes detached formula, original bottle records and ability values', () => {
    const s = promoted(), before = JSON.stringify(s), p = projectAudience(s);
    expect(p.bottles[0]!.source).toContain(s.audience.bottles[0]!.id);
    p.formula[0]!.quantity = 999;
    p.abilities[0]!.mastery = 500;
    p.bottles[0]!.source = 'different';
    p.bottles[0]!.command.type = 'DISCOVER';
    expect(JSON.stringify(s)).toBe(before);
    expect(AUDIENCE_FORMULA[0].quantity).toBe(80);
  });
});

describe('explicit audience resupply across a real week', () => {
  it('does not replenish by waiting, request repeatedly, or deliver in the request week', () => {
    const s = exhausted(), originals = JSON.stringify(s.audience.batches), oldBottles = JSON.stringify(s.audience.bottles);
    expect(s.seer.pollution).toBe(75);
    expect(new Set(s.audience.bottles.flatMap(bottle => bottle.inputIds)).size).toBe(18);
    s.week += 10;
    expect(s.audience.batches).toHaveLength(3);
    expect(projectAudience(s).actions.map(action => action.command.type)).toEqual(['REQUEST_SUPPLY']);
    unchangedRejection(s, { type: 'RECEIVE_SUPPLY' });
    const ap = s.actionsRemaining, cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.audience.resupply.requestedWeek]).toEqual([ap - 1, cash, 15]);
    unchangedRejection(s, { type: 'REQUEST_SUPPLY' });
    unchangedRejection(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateAudienceState(s)).toBe(true);
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    expect([s.actionsRemaining, s.cash]).toEqual([ap - 1, cash]);
    expect(s.audience.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.audience.batches).toHaveLength(6);
    expect(JSON.stringify(s.audience.batches.slice(0, 3))).toBe(originals);
    expect(JSON.stringify(s.audience.bottles)).toBe(oldBottles);
    expect(s.audience.batches[3]!.id).toBe('audience-batch-4');
    expect(s.audience.batches[3]!.materials.every(material => material.holder === 'SUPPLIER')).toBe(true);
    expect(projectAudience(s).actions.find(action => action.id === 'buy-audience-batch-4')?.cost).toContain('660便士');
    unchangedRejection(s, { type: 'RECEIVE_SUPPLY' });
    unchangedRejection(s, { type: 'REQUEST_SUPPLY' });
    expect(validateAudienceState(s)).toBe(true);
    const next = brew(s, 3);
    apply(s, { type: 'CONSUME', bottleId: next.id, confirmed: true });
    expect(next.id).toBe('audience-batch-4:bottle');
    expect(validateAudienceState(s)).toBe(true);
  });

  it('blocks resupply while real ingredients or an unconsumed bottle remain', () => {
    const s = taught();
    unchangedRejection(s, { type: 'REQUEST_SUPPLY' });
    for (let index = 0; index < 3; index += 1) brew(s, index);
    for (const bottle of s.audience.bottles.slice(0, 2)) apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
    unchangedRejection(s, { type: 'REQUEST_SUPPLY' });
  });
});

describe('audience command and save boundaries', () => {
  for (const command of [
    { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    { type: 'MATERIAL_WORK', batchId: 'audience-batch-4' }, { type: 'BUY_MATERIALS', batchId: 'audience-batch-1' },
    { type: 'BREW', batchId: 'audience-batch-2' }, { type: 'CONSUME', bottleId: 'audience-batch-1:bottle', confirmed: true },
    { type: 'OBSERVE', caseId: 'counter-receipt' }, { type: 'DISCUSS', caseId: 'backstage-letter', approach: 'ASK' },
    { type: 'DISCUSS', caseId: 'boarding-house', approach: 'VERIFY' }, { type: 'DISCUSS', caseId: 'night-deposition', approach: 'ACCUSE' }, { type: 'REFLECT' },
  ]) it(`accepts exact ${command.type} command shape`, () => { expect(validateAudienceCommand(command)).toBe(true); });

  for (const command of [
    null, [], {}, { type: 'DIVINE', targetId: 'FIRST_CASE' }, { type: 'READ_MIND' },
    { type: 'DISCOVER', secret: true }, { type: 'CONSUME', bottleId: 'audience-batch-1:bottle' },
    { type: 'CONSUME', bottleId: 'audience-batch-1:bottle', confirmed: false },
    { type: 'CONSUME', bottleId: 'seer-batch-1:bottle', confirmed: true },
    { type: 'BREW', batchId: 'audience-batch-0' }, { type: 'BREW', batchId: 'audience-batch-01' },
    { type: 'OBSERVE', caseId: 'unknown-secret' }, { type: 'DISCUSS', caseId: 'counter-receipt', approach: 'CONTROL' },
    { type: 'REFLECT', caseId: 'counter-receipt' },
  ]) it(`rejects malformed command ${JSON.stringify(command)}`, () => { expect(validateAudienceCommand(command)).toBe(false); });

  it('never interprets a forged command as brewing', () => {
    const s = taught();
    apply(s, { type: 'BUY_MATERIALS', batchId: 'audience-batch-1' });
    unchangedRejection(s, { type: 'UNKNOWN', batchId: 'audience-batch-1' } as unknown as AudienceAcquisitionCommand);
  });

  for (const block of ['dead', 'event', 'combat', 'health', 'mind', 'actions', 'city'] as const) it(`blocks acquisitions during ${block}`, () => {
    const s = state();
    if (block === 'dead') s.status = 'DEAD';
    if (block === 'event') s.activeEvent = { id: 'blocking' } as SliceState['activeEvent'];
    if (block === 'combat') s.combat = {} as NonNullable<SliceState['combat']>;
    if (block === 'health') s.health = 0;
    if (block === 'mind') s.mind = 0;
    if (block === 'actions') s.actionsRemaining = 0;
    if (block === 'city') s.world.city = 'ELSEWHERE';
    unchangedRejection(s, { type: 'DISCOVER' });
    expect(projectAudience(s).actions[0]!.enabled).toBe(false);
  });

  it('round-trips valid state and rejects duplicate originals, changed materials and impossible chronology', () => {
    const s = promoted();
    expect(validateAudienceState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    for (const mutate of [
      (v: SliceState) => { v.audience.bottles.push({ ...v.audience.bottles[0]! }); },
      (v: SliceState) => { v.audience.batches[0]!.materials[0]!.quantity = 80; },
      (v: SliceState) => { v.audience.batches[0]!.materials[0]!.holder = 'PLAYER'; },
      (v: SliceState) => { v.audience.batches[0]!.materials[0]!.source = 'invented'; },
      (v: SliceState) => { v.audience.bottles[0]!.inputIds[0] = 'audience-batch-2:pure-water'; },
      (v: SliceState) => { v.audience.bottles[0]!.status = 'PREPARED'; },
      (v: SliceState) => { v.audience.bottles[0]!.brewedWeek = 6; },
      (v: SliceState) => { v.progression.promotionWeek = 4; },
      (v: SliceState) => { v.progression.mastery['audience.telepathy'] = 0; },
      (v: SliceState) => { v.audience.formulaKnown = false; },
      (v: SliceState) => { v.audience.resupply.deliveries = 1; },
    ]) {
      const invalid = JSON.parse(JSON.stringify(s)) as SliceState;
      mutate(invalid);
      expect(validateAudienceState(invalid)).toBe(false);
    }
  });

  it('does not throw on malformed nested persisted state', () => {
    const s = state();
    for (const malformed of [
      null, {}, { ...s.audience, batches: [null, null, null] }, { ...s.audience, bottles: [null] },
      { ...s.audience, social: null }, { ...s.audience, social: { ...s.audience.social, cases: { 'counter-receipt': null } } },
    ]) {
      expect(validateAudienceState({ ...s, audience: malformed } as unknown as SliceState)).toBe(false);
    }
  });

  it('rejects a second supply round brewed without waiting a real week', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    brew(s, 3);
    expect(validateAudienceState(s)).toBe(true);
    s.audience.bottles[3]!.brewedWeek = 5;
    expect(validateAudienceState(s)).toBe(false);
  });
});
