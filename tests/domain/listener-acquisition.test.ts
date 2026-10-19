import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applySecretSupplicantCommand } from '../../src/domain/secret-supplicant/index.js';
import { applySecretSupplicantActivity } from '../../src/domain/secret-supplicant/life.js';
import { SECRET_SUPPLICANT_ABILITY_IDS, SECRET_SUPPLICANT_CASE_IDS } from '../../src/domain/secret-supplicant/types.js';
import {
  applyListenerCommand, createListenerState, isListenerAcquisitionCommand,
  projectListener, validateListenerCommand, validateListenerState,
} from '../../src/domain/listener/index.js';
import {
  LISTENER_ABILITIES, LISTENER_BOTTLE_IDS, LISTENER_FORMULA_STATUS,
  LISTENER_LABOUR_TASKS, LISTENER_SOURCE_STATUS,
} from '../../src/domain/listener/content.js';
import {
  LISTENER_ABILITY_IDS, LISTENER_CASE_IDS,
  type ListenerAcquisitionCommand, type ListenerCommand,
} from '../../src/domain/listener/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('listener-acquisition', sliceDefaultCreationSelection, 'listener-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.listener = createListenerState();
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
      s.lastCheck = result;
      return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, checks, draws, notes };
}
function secretSupplicant() {
  const s = ordinary(), c = context(s, 1).c;
  applySecretSupplicantCommand(s, { type: 'DISCOVER' }, c);
  applySecretSupplicantCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySecretSupplicantCommand(s, { type: 'BUY_POTION', bottleId: s.secretSupplicant.bottles[0]!.id }, c);
  applySecretSupplicantCommand(s, { type: 'CONSUME', bottleId: s.secretSupplicant.bottles[0]!.id, confirmed: true }, c);
  const award = (source: string, amount: 5 | 8 | 25) => {
    s.seer.completedSources.push(source);
    s.progression.mastery[SECRET_SUPPLICANT_ABILITY_IDS[0]]! += amount;
  };
  for (const caseId of SECRET_SUPPLICANT_CASE_IDS) {
    applySecretSupplicantActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applySecretSupplicantActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }, c, award);
    applySecretSupplicantActivity(s, { type: 'PERFORM', caseId }, c, award);
    if (caseId === 'covered-token') applySecretSupplicantActivity(s, { type: 'COVER', caseId }, c, award);
    applySecretSupplicantActivity(s, { type: 'REPORT', caseId, claim: 'LIMITED' }, c, award);
  }
  applySecretSupplicantActivity(s, { type: 'REFLECT' }, c, award);
  s.progression.mastery = Object.fromEntries(SECRET_SUPPLICANT_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.week = 11; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: ListenerAcquisitionCommand, roll = 20) {
  applyListenerCommand(s, command, context(s, roll).c);
}
function taught(s = secretSupplicant()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.listener.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of LISTENER_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as ListenerAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

// Focused acquisition coverage. Life owns exact case transitions and real LEAVE / VERIFY behavior.
describe('Listener independent S8 acquisition', () => {
  it('starts with three separate G originals and locked cases, without a formula', () => {
    const s = ordinary(), projection = projectListener(s);
    expect(validateListenerState(s)).toBe(true);
    expect(s.listener.bottles.map(b => b.id)).toEqual([...LISTENER_BOTTLE_IDS]);
    expect(s.listener.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.listener.cases)).toEqual([...LISTENER_CASE_IDS]);
    expect(Object.values(s.listener.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.contactOpen && !c.verified && c.overclaims === 0)).toBe(true);
    expect(projection).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    const other = createListenerState(); other.bottles[0]!.labourSteps = 1;
    expect(s.listener.bottles[0]!.labourSteps).toBe(0);
  });

  it('continues through Ethan’s existing channel and charges 180 pence plus one AP for guidance only', () => {
    const s = secretSupplicant(), before = JSON.stringify(s.secretSupplicant), progression = JSON.stringify(s.progression), ctx = context(s);
    rejected(s, { type: 'BUY_POTION', bottleId: LISTENER_BOTTLE_IDS[0] });
    applyListenerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.listener.guidanceKnown]).toEqual([9820, 39, true]);
    expect(ctx.notes[0]!.text).toContain('已认识的');
    expect(ctx.notes[0]!.text).toContain('成年');
    expect(ctx.notes[0]!.text).toContain('伊森·洛弗');
    expect(projectListener(s).supplies).toContain(LISTENER_FORMULA_STATUS);
    expect(JSON.stringify(s.secretSupplicant)).toBe(before);
    expect(JSON.stringify(s.progression)).toBe(progression);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateListenerState(s)).toBe(true);
  });

  it('delivers an original for 1210 pence at zero AP with no partial labour discount', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: LISTENER_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.listener.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1210, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.listener.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateListenerState(s)).toBe(true);
  });

  it('requires three real jobs per bottle before paying the remaining 160 pence', () => {
    const s = taught(), bottleId = LISTENER_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 3; step += 1) {
      applyListenerCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.listener.bottles[0]!.labourSteps]).toEqual([9820, 38 - step, step + 1]);
      expect(projectListener(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(LISTENER_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.listener.bottles[1]!.labourSteps).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 159; rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 160; buy(s);
    expect([s.cash, s.actionsRemaining, s.listener.bottles[0]!.status]).toEqual([0, 36, 'PLAYER']);
  });

  it('allows early preparation but requires acting100, four whole S9 weeks and confirmation', () => {
    const s = secretSupplicant(); s.week = 5; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 8;
    rejected(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true });
    s.week = 9; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.listener.promotionWeek]).toEqual([8, 5, 9]);
    expect(validateListenerState(s)).toBe(true);
  });

  it('blocks unavailable channels, ended runs, blockers and unrestored health without mutation', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.secretSupplicant.discovered = false; },
      s => { s.secretSupplicant.guidanceKnown = false; }, s => { s.world.city = 'ELSEWHERE'; },
      s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.secretSupplicant.cases['covered-token']!.contactOpen = true; },
      s => { s.listener.cases['room-exit']!.contactOpen = true; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true }); }
    const s = secretSupplicant(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: LISTENER_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
  });

  it('resolves all four tiers with one will12 check, no death draw, and unchanged S9 history', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, old = JSON.stringify(s.secretSupplicant), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7;
      const chance = projectListener(s).bottles[0]!.chance;
      applyListenerCommand(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 12]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.listener.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['hanged-man', success ? 8 : 9, 5, success ? 0 : 100]);
      expect([s.listener.promotionWeek, s.listener.secretSupplicantActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
      expect(JSON.stringify(s.secretSupplicant)).toBe(old); expect(s.seer.completedSources).toEqual(sources);
      for (const id of SECRET_SUPPLICANT_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 0], ['perception', 1], ['will', 2], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS] : [...SECRET_SUPPLICANT_ABILITY_IDS]);
      if (success) { expect(s.progression.mastery[LISTENER_ABILITY_IDS[0]]).toBe(0); expect(projectSliceState(s).maxSpirituality).toBe(45); }
      expect(s.status).toBe('ACTIVE'); expect(validateListenerState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps granted attributes at500, never raises physique, and adds only whisper listening', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 499, perception: 500, will: 500, knowledge: 500 });
    expect(LISTENER_ABILITY_IDS).toEqual(['hanged-man.s8.whisper-listening']);
    expect(projectListener(s).abilities).toEqual(LISTENER_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });

  it('keeps severe rejection recoverable and cannot retry while resources are exhausted', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([9, 100]);
    expect(validateListenerState(s)).toBe(true);
  });

  it('preserves held bottles after success but forbids repeat promotion and further supply work', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true });
    expect(s.listener.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: LISTENER_BOTTLE_IDS[2] }, { type: 'BUY_POTION', bottleId: LISTENER_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectListener(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    expect(validateListenerState(s)).toBe(true);
  });

  it('requires exhaustion, one request AP and a later week before three new payable originals arrive', () => {
    const s = exhausted(), old = JSON.stringify(s.listener.bottles), s9 = JSON.stringify(s.secretSupplicant), cash = s.cash;
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.listener.resupply.requestedWeek]).toEqual([0, cash, 11]);
    expect(s.listener.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateListenerState(s)).toBe(true);
    s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.listener.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.listener.bottles.slice(0, 3))).toBe(old); expect(JSON.stringify(s.secretSupplicant)).toBe(s9);
    expect(s.listener.bottles.slice(3).map(b => b.id)).toEqual(['listener-potion-4', 'listener-potion-5', 'listener-potion-6']);
    expect(s.listener.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第12周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'listener-potion-4', confirmed: true });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 3;
    for (let i = 0; i < 3; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'listener-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 160);
    apply(s, { type: 'CONSUME', bottleId: 'listener-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.listener.promotionWeek]).toEqual([5, 12]);
    expect(validateListenerState(s)).toBe(true);
  });

  it('never refills automatically or supplies while an original remains or promotion succeeded', () => {
    for (const s of [ordinary(), secretSupplicant(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.listener.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('validates exact declared commands and routes only acquisition commands here', () => {
    const commands: ListenerCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: LISTENER_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'listener-potion-99' },
      { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0], confirmed: true }, { type: 'REFLECT' },
      ...LISTENER_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'LEAVE', 'VERIFY', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['LIMITED', 'CERTAIN'] as const).map(claim => ({ type: 'REPORT' as const, caseId, claim })),
        ...(['LISTEN', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) { expect(validateListenerCommand(command)).toBe(true); if (!isListenerAcquisitionCommand(command)) rejected(prepared(), command); }
    for (const command of [
      null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
      { type: 'LEARN_GUIDANCE', free: true }, { type: 'BUY_POTION', bottleId: 'secret-supplicant-potion-1' },
      { type: 'BUY_POTION', bottleId: 'listener-potion-01' }, { type: 'CONSUME', bottleId: LISTENER_BOTTLE_IDS[0] },
      { type: 'PREPARE', caseId: 'wall-knock', method: 'MYSTIC' }, { type: 'LEAVE', caseId: 'wall-knock', guaranteed: true },
      { type: 'REPORT', caseId: 'wall-knock', claim: 'COMPLETE' }, { type: 'REPORT', caseId: 'wall-knock' },
      { type: 'VERIFY', caseId: 'wall-knock', guaranteed: true }, { type: 'COVER', caseId: 'wall-knock' },
    ]) { expect(validateListenerCommand(command)).toBe(false); rejected(prepared(), command); }
  });

  it('rejects forged chronology, inherited mastery and malformed case shapes', () => {
    const valid = promoted();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.listener.bottles[0]!.id = 'secret-supplicant-potion-1'; }, s => { s.listener.bottles[0]!.source = 'invented'; },
      s => { s.listener.bottles[0]!.labourSteps = 4; }, s => { s.listener.bottles[0]!.consumedWeek = 8; },
      s => { s.listener.secretSupplicantActingAtPromotion = 99; }, s => { s.listener.promotionWeek = 10; },
      s => { delete s.progression.mastery[SECRET_SUPPLICANT_ABILITY_IDS[0]]; }, s => { s.progression.mastery['hanged-man.s7.shadow'] = 0; },
      s => { delete s.listener.cases['room-exit']; }, s => { s.listener.resupply.deliveries = 1; },
      s => { s.listener.cases['wall-knock']!.overclaims = -1; },
      s => { s.listener.cases['broken-phrase']!.attemptWeek = 10; },
    ];
    for (const change of changes) { const s: SliceState = structuredClone(valid); change(s); expect(validateListenerState(s)).toBe(false); }
    const empty = ordinary(); empty.listener.cases['wall-knock']!.status = 'OBSERVED';
    expect(validateListenerState(empty)).toBe(false);
    const supplied = exhausted(); apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 12; apply(supplied, { type: 'RECEIVE_SUPPLY' });
    supplied.listener.bottles[3]!.source = supplied.listener.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库');
    expect(validateListenerState(supplied)).toBe(false);
  });

  it('rejects malformed case and bottle records without throwing during save validation', () => {
    for (const replacement of [null, [], {}, { verified: 'yes' }]) {
      const s = promoted();
      (s.listener.cases as Record<string, unknown>)['wall-knock'] = replacement;
      expect(() => validateListenerState(s)).not.toThrow();
      expect(validateListenerState(s)).toBe(false);
    }
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' }); s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' });
    (s.listener.bottles as unknown[])[0] = null;
    expect(() => validateListenerState(s)).not.toThrow();
    expect(validateListenerState(s)).toBe(false);
  });

  it('separates source-bounded hearing from possible gifts and retains the unverified formula', () => {
    expect(LISTENER_SOURCE_STATUS).toContain('第一部第105章');
    expect(LISTENER_SOURCE_STATUS).toContain('直接听到对应隐秘存在的耳语');
    expect(LISTENER_SOURCE_STATUS).toContain('不是自动赐予');
    expect(LISTENER_SOURCE_STATUS).toContain('当前普通首案没有已核实的超凡声音来源');
    expect(LISTENER_SOURCE_STATUS).toContain('不设置人人五年必死');
    expect(LISTENER_SOURCE_STATUS).toContain('现实心理症状');
    expect(LISTENER_ABILITIES[0]!.description).toContain('不形成人人通用的法术表');
    expect(projectListener(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
  });
});
