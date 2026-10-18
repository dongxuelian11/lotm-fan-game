import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyMonsterCommand } from '../../src/domain/monster/index.js';
import { MONSTER_ABILITY_IDS } from '../../src/domain/monster/types.js';
import { applyMachineCommand } from '../../src/domain/machine/index.js';
import { MACHINE_ABILITY_IDS } from '../../src/domain/machine/types.js';
import {
  applyLuckyCommand, createLuckyState, isLuckyAcquisitionCommand,
  projectLucky, validateLuckyCommand, validateLuckyState,
} from '../../src/domain/lucky/index.js';
import {
  LUCKY_ABILITIES, LUCKY_BOTTLE_IDS, LUCKY_CONSUMPTION_RISK, LUCKY_FORMULA_STATUS,
  LUCKY_LABOUR_TASKS, LUCKY_SOURCE_STATUS,
} from '../../src/domain/lucky/content.js';
import { LUCKY_ABILITY_IDS, LUCKY_CASE_IDS, type LuckyAcquisitionCommand, type LuckyCommand } from '../../src/domain/lucky/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const OLD_IDS = [...MONSTER_ABILITY_IDS, ...MACHINE_ABILITY_IDS];
function ordinary(): SliceState {
  const s = createSliceRun('lucky-acquisition', sliceDefaultCreationSelection, 'lucky-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 20000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 18;
  s.lucky = createLuckyState();
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
function machine() {
  const s = ordinary(), c = context(s, 1).c;
  applyMonsterCommand(s, { type: 'DISCOVER' }, c);
  applyMonsterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyMonsterCommand(s, { type: 'BUY_POTION', bottleId: s.monster.bottles[0]!.id }, c);
  applyMonsterCommand(s, { type: 'CONSUME', bottleId: s.monster.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100; s.week = 11;
  applyMachineCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyMachineCommand(s, { type: 'BUY_POTION', bottleId: s.machine.bottles[0]!.id }, c);
  applyMachineCommand(s, { type: 'CONSUME', bottleId: s.machine.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries(OLD_IDS.map((id, index) => [id, index * 25]));
  s.week = 19; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 18;
  return s;
}
function apply(s: SliceState, command: LuckyAcquisitionCommand, roll = 20) { applyLuckyCommand(s, command, context(s, roll).c); }
function taught(s = machine()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.lucky.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of LUCKY_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as LuckyAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

// Acquisition owns bottle identity, maturity and promotion; life owns actual passive draws and CLOSE.
describe('Lucky independent S7 acquisition', () => {
  it('starts with three separate original bottles, untouched cases and no known recipe', () => {
    const s = ordinary(), p = projectLucky(s);
    expect(validateLuckyState(s)).toBe(true);
    expect(s.lucky.bottles.map(b => b.id)).toEqual([...LUCKY_BOTTLE_IDS]);
    expect(s.lucky.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.lucky.cases)).toEqual([...LUCKY_CASE_IDS]);
    expect(Object.values(s.lucky.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.contactOpen && c.closes === 0 && c.luckRoll === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('continues the same adult guide for240 and1AP without rewriting either earlier stage', () => {
    const s = machine(), prior = JSON.stringify([s.monster, s.machine, s.progression]), ctx = context(s);
    applyLuckyCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.lucky.guidanceKnown]).toEqual([9760, 39, true]);
    expect(ctx.notes[0]!.text).toContain('已认识的本作原创成年报时铺记录员艾妲·芬恩');
    expect(projectLucky(s).supplies).toContain(LUCKY_FORMULA_STATUS);
    expect(projectLucky(s).risk).toContain(LUCKY_CONSUMPTION_RISK);
    expect(JSON.stringify([s.monster, s.machine, s.progression])).toBe(prior);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateLuckyState(s)).toBe(true);
  });

  it('requires confirmation for the exact owned S7 original, never an earlier bottle', () => {
    const s = prepared(), bottleId = LUCKY_BOTTLE_IDS[0];
    for (const command of [
      { type: 'CONSUME', bottleId }, { type: 'CONSUME', bottleId, confirmed: false },
      { type: 'CONSUME', bottleId, confirmed: 'true' },
      { type: 'CONSUME', bottleId: 'monster-potion-1', confirmed: true },
      { type: 'CONSUME', bottleId: 'machine-potion-1', confirmed: true },
    ]) { expect(validateLuckyCommand(command)).toBe(false); rejected(s, command); }
    rejected(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[1], confirmed: true });
    expect(s.lucky.bottles[0]!.status).toBe('PLAYER');
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.progression.sequence).toBe(7);
  });

  it('charges2010 at zero AP and does not partially redeem unfinished jobs', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: LUCKY_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.lucky.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 2010, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.lucky.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateLuckyState(s)).toBe(true);
  });

  it('requires four separate jobs for this bottle before paying its remaining210', () => {
    const s = taught(), bottleId = LUCKY_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 4; step += 1) {
      applyLuckyCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.lucky.bottles[0]!.labourSteps]).toEqual([9760, 38 - step, step + 1]);
      expect(projectLucky(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 3 ? 210 : 2010}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(LUCKY_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.lucky.bottles[1]!.labourSteps).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 210; buy(s);
    expect([s.cash, s.actionsRemaining, s.lucky.bottles[0]!.status]).toEqual([0, 35, 'PLAYER']);
  });

  it('permits preparation early but counts eight full weeks from Machine promotion', () => {
    const s = machine(); s.week = 11; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 18;
    expect(s.progression.promotionWeek).toBe(5);
    expect(s.machine.promotionWeek).toBe(11);
    rejected(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true });
    s.week = 19; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    apply(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.machine.promotionWeek, s.lucky.promotionWeek]).toEqual([7, 5, 11, 19]);
    expect(validateLuckyState(s)).toBe(true);
  });

  it('blocks all three open contacts, lost channels and unavailable actions without spending', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.monster.cases['quiet-door']!.contactOpen = true; },
      s => { s.machine.cases['private-question']!.contactOpen = true; },
      s => { s.lucky.cases['loose-receipt']!.contactOpen = true; },
      s => { s.machine.guidanceKnown = false; }, s => { s.monster.discovered = false; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
    ];
    for (const change of changes) {
      const s = prepared(); change(s);
      rejected(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true });
      expect(projectLucky(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    }
    const s = machine(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: LUCKY_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
  });

  it('resolves the four will18 tiers and preserves five old IDs, histories and current spirit', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, prior = JSON.stringify([s.monster, s.machine]), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7;
      const chance = projectLucky(s).bottles[0]!.chance;
      applyLuckyCommand(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 18, difficulty: 18, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.lucky.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['wheel', success ? 7 : 8, 5, success ? 0 : 100]);
      expect([s.lucky.promotionWeek, s.lucky.machineActingAtPromotion]).toEqual(success ? [19, 100] : [null, null]);
      expect(JSON.stringify([s.monster, s.machine])).toBe(prior); expect(s.seer.completedSources).toEqual(sources);
      for (const id of OLD_IDS) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 0], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...OLD_IDS, ...LUCKY_ABILITY_IDS] : OLD_IDS);
      if (success) {
        expect(s.progression.mastery[LUCKY_ABILITY_IDS[0]]).toBe(0);
        expect(projectSliceState(s).maxSpirituality).toBe(60);
      }
      expect(Object.values(s.lucky.cases).every(c => !c.contactOpen && c.closes === 0 && c.luckRoll === null)).toBe(true);
      expect(s.status).toBe('ACTIVE'); expect(validateLuckyState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps gains at500 and exposes only passive fluctuating luck with canon and G boundaries', () => {
    const s = prepared(); Object.assign(s.character.coreStats, { physique: 499, perception: 499, will: 500, knowledge: 500 });
    apply(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 499, perception: 500, will: 500, knowledge: 500 });
    expect(LUCKY_ABILITY_IDS).toEqual(['wheel.s7.passive-luck']);
    expect(projectLucky(s).abilities).toEqual(LUCKY_ABILITIES.map(a => ({ ...a, mastery: 0 })));
    expect(projectLucky(s)).toMatchObject({ formulaKnown: false, formula: [], cases: [] });
    for (const boundary of ['第四部第178章', '被动幸运', '无法主动控制', '波动', '普通运气', '没有等量厄运偿还规则', '序列6招灾', '序列5幸运池', '高位重启', '本作原创G']) expect(LUCKY_SOURCE_STATUS).toContain(boundary);
    expect(JSON.stringify(projectLucky(s))).not.toContain('luckRoll');
  });

  it('keeps severe guided rejection recoverable and requires rest plus another original', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([8, 100]);
    expect(validateLuckyState(s)).toBe(true);
    s.health = 100; s.mind = 100;
    apply(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[1], confirmed: true });
    expect(s.lucky.bottles[0]!.outcome).toBe('GREAT_FAILURE');
    expect(s.lucky.bottles[1]!.outcome).toBe('SUCCESS');
    expect(s.seer.pollution).toBe(100);
    expect(validateLuckyState(s)).toBe(true);
  });

  it('retains held originals after promotion while closing further acquisition', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true });
    expect(s.lucky.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: LUCKY_BOTTLE_IDS[2] }, { type: 'BUY_POTION', bottleId: LUCKY_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectLucky(s).digestion).toContain('机器消化成果100/100已保留；幸运者扮演0/100');
    expect(validateLuckyState(s)).toBe(true);
  });

  it('waits a real week after exhaustion and delivers three separate payable originals', () => {
    const s = exhausted(), old = JSON.stringify(s.lucky.bottles), prior = JSON.stringify([s.monster, s.machine]), cash = s.cash;
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.lucky.resupply.requestedWeek]).toEqual([0, cash, 19]);
    expect(s.lucky.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateLuckyState(s)).toBe(true);
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.lucky.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.lucky.bottles.slice(0, 3))).toBe(old); expect(JSON.stringify([s.monster, s.machine])).toBe(prior);
    expect(s.lucky.bottles.slice(3).map(b => b.id)).toEqual(['lucky-potion-4', 'lucky-potion-5', 'lucky-potion-6']);
    expect(s.lucky.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第20周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'lucky-potion-4', confirmed: true });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 4;
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'lucky-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 210);
    apply(s, { type: 'CONSUME', bottleId: 'lucky-potion-4', confirmed: true });
    expect([s.machine.promotionWeek, s.lucky.promotionWeek]).toEqual([11, 20]);
    expect(validateLuckyState(s)).toBe(true);
  });

  it('never refills automatically or lets existing originals coexist with a new batch', () => {
    for (const s of [ordinary(), machine(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.lucky.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    expect(s.lucky.bottles).toHaveLength(6);
    expect(validateLuckyState(s)).toBe(true);
  });

  it('accepts only exact acquisition and activity commands, with no lucky-control action', () => {
    const commands: LuckyCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'REFLECT' },
      { type: 'POTION_WORK', bottleId: LUCKY_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'lucky-potion-99' },
      { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true },
      ...LUCKY_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['CAREFUL', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) {
      expect(validateLuckyCommand(command)).toBe(true);
      if (!isLuckyAcquisitionCommand(command)) rejected(prepared(), command);
    }
    for (const command of [
      { type: 'LEARN_FORMULA' }, { type: 'BREW' }, { type: 'CONTROL_LUCK' }, { type: 'STORE_LUCK' }, { type: 'REROLL' },
      { type: 'PREPARE', caseId: 'next-carriage', method: 'ABILITY' },
      { type: 'PERFORM', caseId: 'next-carriage', luckRoll: 1 },
      { type: 'CONSUME', bottleId: LUCKY_BOTTLE_IDS[0], confirmed: true, free: true },
      { type: 'BUY_POTION', bottleId: 'lucky-potion-01' },
    ]) expect(validateLuckyCommand(command)).toBe(false);
  });

  it('validates promotion provenance and finite committed luck draws rather than a luck balance', () => {
    const valid = promoted();
    for (const change of [
      (s: SliceState) => { s.lucky.machineActingAtPromotion = 99; },
      (s: SliceState) => { s.lucky.promotionWeek = 18; },
      (s: SliceState) => { s.lucky.bottles[0]!.source = 'converted machine bottle'; },
      (s: SliceState) => { delete s.progression.mastery[MACHINE_ABILITY_IDS[0]]; },
      (s: SliceState) => { s.progression.mastery['wheel.s5.luck-pool'] = 0; },
      (s: SliceState) => { s.lucky.cases['next-carriage']!.luckRoll = 1; },
    ]) { const s = structuredClone(valid); change(s); expect(validateLuckyState(s)).toBe(false); }
    const r = valid.lucky.cases['loose-receipt']!;
    Object.assign(r, { status: 'EXAMINED', attemptWeek: 19, method: 'CAREFUL', outcome: 'RECEIPT_RECORDED', contactOpen: true, luckRoll: 25 });
    expect(validateLuckyState(valid)).toBe(true);
    expect(projectLucky(valid).insideCase).toBe(true);
    for (const luckRoll of [0, 101, 2.5, null]) { r.luckRoll = luckRoll; expect(validateLuckyState(valid)).toBe(false); }
    r.luckRoll = 100; r.contactOpen = false; r.closes = 1;
    expect(validateLuckyState(valid)).toBe(true);
    expect(projectLucky(valid).insideCase).toBe(false);
  });
});
