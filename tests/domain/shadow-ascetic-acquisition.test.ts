import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applySecretSupplicantCommand } from '../../src/domain/secret-supplicant/index.js';
import { SECRET_SUPPLICANT_ABILITY_IDS } from '../../src/domain/secret-supplicant/types.js';
import { applyListenerCommand } from '../../src/domain/listener/index.js';
import { LISTENER_ABILITY_IDS } from '../../src/domain/listener/types.js';
import {
  applyShadowAsceticCommand, createShadowAsceticState, isShadowAsceticAcquisitionCommand,
  projectShadowAscetic, validateShadowAsceticCommand, validateShadowAsceticState,
} from '../../src/domain/shadow-ascetic/index.js';
import {
  SHADOW_ASCETIC_ABILITIES, SHADOW_ASCETIC_BOTTLE_IDS, SHADOW_ASCETIC_FORMULA_STATUS,
  SHADOW_ASCETIC_LABOUR_TASKS, SHADOW_ASCETIC_SOURCE_STATUS,
} from '../../src/domain/shadow-ascetic/content.js';
import {
  SHADOW_ASCETIC_ABILITY_IDS, SHADOW_ASCETIC_CASE_IDS,
  type ShadowAsceticAcquisitionCommand, type ShadowAsceticCommand,
} from '../../src/domain/shadow-ascetic/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('shadow-ascetic-acquisition', sliceDefaultCreationSelection, 'shadow-ascetic-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 20000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 18;
  s.shadowAscetic = createShadowAsceticState();
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
function listener() {
  const s = ordinary(), c = context(s, 1).c;
  applySecretSupplicantCommand(s, { type: 'DISCOVER' }, c);
  applySecretSupplicantCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySecretSupplicantCommand(s, { type: 'BUY_POTION', bottleId: s.secretSupplicant.bottles[0]!.id }, c);
  applySecretSupplicantCommand(s, { type: 'CONSUME', bottleId: s.secretSupplicant.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100; s.week = 9;
  applyListenerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyListenerCommand(s, { type: 'BUY_POTION', bottleId: s.listener.bottles[0]!.id }, c);
  applyListenerCommand(s, { type: 'CONSUME', bottleId: s.listener.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS].map((id, index) => [id, index * 25]));
  s.week = 17; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 18;
  return s;
}
function apply(s: SliceState, command: ShadowAsceticAcquisitionCommand, roll = 20) { applyShadowAsceticCommand(s, command, context(s, roll).c); }
function taught(s = listener()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.shadowAscetic.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of SHADOW_ASCETIC_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as ShadowAsceticAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('ShadowAscetic independent S7 acquisition', () => {
  it('starts with three separate original bottles and untouched shadow cases, without a formula', () => {
    const s = ordinary(), projection = projectShadowAscetic(s);
    expect(validateShadowAsceticState(s)).toBe(true);
    expect(s.shadowAscetic.bottles.map(b => b.id)).toEqual([...SHADOW_ASCETIC_BOTTLE_IDS]);
    expect(s.shadowAscetic.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.shadowAscetic.cases)).toEqual([...SHADOW_ASCETIC_CASE_IDS]);
    expect(Object.values(s.shadowAscetic.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.shadowOpen && !c.hidden)).toBe(true);
    expect(projection).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    const other = createShadowAsceticState(); other.bottles[0]!.labourSteps = 1; other.cases['lamp-shift']!.hidden = true;
    expect(s.shadowAscetic.bottles[0]!.labourSteps).toBe(0); expect(s.shadowAscetic.cases['lamp-shift']!.hidden).toBe(false);
  });

  it('uses the existing adult Listener guide and charges 240 pence plus one AP only for guidance', () => {
    const s = listener(), old = JSON.stringify([s.secretSupplicant, s.listener, s.progression]), ctx = context(s);
    rejected(s, { type: 'BUY_POTION', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0] });
    applyShadowAsceticCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.shadowAscetic.guidanceKnown]).toEqual([9760, 39, true]);
    for (const text of ['通过已有倾听者渠道', '成年', '伊森·洛弗']) expect(ctx.notes[0]!.text).toContain(text);
    expect(projectShadowAscetic(s).supplies).toContain(SHADOW_ASCETIC_FORMULA_STATUS);
    expect(JSON.stringify([s.secretSupplicant, s.listener, s.progression])).toBe(old);
    rejected(s, { type: 'LEARN_GUIDANCE' }); expect(validateShadowAsceticState(s)).toBe(true);
  });

  it('delivers an original for 2010 pence at zero AP with no partial labour discount', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.shadowAscetic.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 2010, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 17, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.shadowAscetic.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id }); rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateShadowAsceticState(s)).toBe(true);
  });

  it('requires four distinct jobs for that bottle before paying the remaining 210 pence', () => {
    const s = taught(), bottleId = SHADOW_ASCETIC_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 4; step += 1) {
      applyShadowAsceticCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.shadowAscetic.bottles[0]!.labourSteps]).toEqual([9760, 38 - step, step + 1]);
      expect(projectShadowAscetic(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 3 ? 210 : 2010}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(SHADOW_ASCETIC_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.shadowAscetic.bottles[1]!.labourSteps).toBe(0); rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId }); s.cash = 210; buy(s);
    expect([s.cash, s.actionsRemaining, s.shadowAscetic.bottles[0]!.status]).toEqual([0, 35, 'PLAYER']);
  });

  it('allows early preparation but requires acting100, eight whole S8 weeks and confirmation', () => {
    const s = listener(); s.week = 9; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 16;
    rejected(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true });
    s.week = 17; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; rejected(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.listener.promotionWeek, s.shadowAscetic.promotionWeek]).toEqual([7, 5, 9, 17]);
    expect(validateShadowAsceticState(s)).toBe(true);
  });

  it('blocks unavailable channels, open prior effects, ended runs and unrestored health without mutation', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.secretSupplicant.discovered = false; },
      s => { s.secretSupplicant.guidanceKnown = false; }, s => { s.listener.guidanceKnown = false; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; }, s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.secretSupplicant.cases['covered-token']!.contactOpen = true; },
      s => { s.listener.cases['room-exit']!.contactOpen = true; },
      s => { s.shadowAscetic.cases['blocked-alcove']!.shadowOpen = true; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true }); }
    const s = listener(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true }); expect(s.actionsRemaining).toBe(0);
  });

  it('resolves all four tiers with one will18 check, no death draw, and unchanged S9/S8 histories', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, old = JSON.stringify([s.secretSupplicant, s.listener]), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7; const chance = projectShadowAscetic(s).bottles[0]!.chance;
      applyShadowAsceticCommand(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 18, difficulty: 18, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.shadowAscetic.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 17, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['hanged-man', success ? 7 : 8, 5, success ? 0 : 100]);
      expect([s.shadowAscetic.promotionWeek, s.shadowAscetic.listenerActingAtPromotion]).toEqual(success ? [17, 100] : [null, null]);
      expect(JSON.stringify([s.secretSupplicant, s.listener])).toBe(old); expect(s.seer.completedSources).toEqual(sources);
      for (const id of [...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS]) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 2], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS, ...SHADOW_ASCETIC_ABILITY_IDS] : [...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS]);
      if (success) { expect(s.progression.mastery[SHADOW_ASCETIC_ABILITY_IDS[0]]).toBe(0); expect(projectSliceState(s).maxSpirituality).toBe(60); }
      expect(s.status).toBe('ACTIVE'); expect(validateShadowAsceticState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps granted attributes at500 and never creates additional mastery bars or invented spells', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(projectShadowAscetic(s).abilities.map(a => a.id)).toEqual(['hanged-man.s7.shadow-concealment']);
  });

  it('retains unused originals after success but never permits duplicate preparation or consumption', () => {
    const s = prepared(); buy(s, 1); const held = structuredClone(s.shadowAscetic.bottles[1]);
    apply(s, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true });
    expect(s.shadowAscetic.bottles[1]).toEqual(held);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'BUY_POTION', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[2] },
      { type: 'POTION_WORK', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectShadowAscetic(s).actions.every(a => !a.enabled)).toBe(true); expect(validateShadowAsceticState(s)).toBe(true);
  });

  it('requests the next finite batch at1AP and receives three new identities only next real week', () => {
    const s = exhausted(), old = JSON.stringify(s.shadowAscetic.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.shadowAscetic.resupply.requestedWeek, s.shadowAscetic.bottles.length]).toEqual([ap - 1, 17, 3]);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    s.week = 18; s.actionsRemaining = 0; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.shadowAscetic.bottles.slice(0, 3))).toBe(old);
    expect([s.cash, s.actionsRemaining, s.shadowAscetic.resupply.deliveries, s.shadowAscetic.resupply.requestedWeek]).toEqual([cash, 0, 1, null]);
    expect(s.shadowAscetic.bottles.slice(3).map(b => b.id)).toEqual(['shadow-ascetic-potion-4', 'shadow-ascetic-potion-5', 'shadow-ascetic-potion-6']);
    expect(s.shadowAscetic.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.acquiredWeek === null && b.source.includes('第18周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'shadow-ascetic-potion-4', confirmed: true }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 4;
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'shadow-ascetic-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 210);
    apply(s, { type: 'CONSUME', bottleId: 'shadow-ascetic-potion-4', confirmed: true });
    expect([s.listener.promotionWeek, s.shadowAscetic.promotionWeek]).toEqual([9, 18]); expect(validateShadowAsceticState(s)).toBe(true);
  });

  it('never refills automatically or supplies while an original remains or promotion succeeded', () => {
    for (const s of [ordinary(), listener(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10; expect(s.shadowAscetic.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('validates exact declared commands and routes activities separately from acquisition', () => {
    const commands: ShadowAsceticCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'shadow-ascetic-potion-99' },
      { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0], confirmed: true }, { type: 'REFLECT' },
      ...SHADOW_ASCETIC_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'REVEAL', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['SHADOW', 'ORDINARY', 'BLOCKED_ROUTE'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) { expect(validateShadowAsceticCommand(command)).toBe(true); if (!isShadowAsceticAcquisitionCommand(command)) rejected(prepared(), command); }
    for (const command of [
      null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
      { type: 'LEARN_GUIDANCE', free: true }, { type: 'BUY_POTION', bottleId: 'listener-potion-1' },
      { type: 'BUY_POTION', bottleId: 'shadow-ascetic-potion-01' }, { type: 'CONSUME', bottleId: SHADOW_ASCETIC_BOTTLE_IDS[0] },
      { type: 'PREPARE', caseId: 'lamp-shift', method: 'TEAM' }, { type: 'REVEAL', caseId: 'blocked-alcove', refund: true },
      { type: 'REPORT', caseId: 'agreed-watch', claim: 'COMPLETE' }, { type: 'STOP', caseId: 'blocked-alcove' },
      { type: 'LEARN_SPELL', spellId: 'resurrection' }, { type: 'LEARN_SPELL', spellId: 'light-touch', mastered: true },
    ]) { expect(validateShadowAsceticCommand(command)).toBe(false); expect(isShadowAsceticAcquisitionCommand(command)).toBe(false); rejected(prepared(), command); }
  });

  it('rejects forged bottle chronology, lost inherited mastery and malformed case shapes', () => {
    const valid = promoted();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.shadowAscetic.bottles[0]!.id = 'listener-potion-1'; }, s => { s.shadowAscetic.bottles[0]!.source = 'invented'; },
      s => { s.shadowAscetic.bottles[0]!.labourSteps = 5; }, s => { s.shadowAscetic.bottles[0]!.consumedWeek = 16; },
      s => { s.shadowAscetic.listenerActingAtPromotion = 99; }, s => { s.shadowAscetic.promotionWeek = 16; },
      s => { delete s.progression.mastery[SECRET_SUPPLICANT_ABILITY_IDS[0]]; }, s => { delete s.progression.mastery[LISTENER_ABILITY_IDS[0]]; },
      s => { s.progression.mastery['hanged-man.s6.flesh-magic'] = 0; }, s => { delete s.shadowAscetic.cases['agreed-watch']; },
      s => { s.shadowAscetic.resupply.deliveries = 1; },
    ];
    for (const change of changes) { const s: SliceState = structuredClone(valid); change(s); expect(validateShadowAsceticState(s)).toBe(false); }
    const empty = ordinary(); empty.shadowAscetic.cases['lamp-shift']!.status = 'OBSERVED'; expect(validateShadowAsceticState(empty)).toBe(false);
    const supplied = exhausted(); apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 18; apply(supplied, { type: 'RECEIVE_SUPPLY' });
    supplied.shadowAscetic.bottles[3]!.source = supplied.shadowAscetic.bottles[3]!.source.replace('第18周实收入库', '第17周实收入库'); expect(validateShadowAsceticState(supplied)).toBe(false);
  });

  it('validates exact shadow case shape and mature activity chronology without inventing spell lessons', () => {
    const valid = promoted();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.shadowAscetic.cases['lamp-shift']!.attemptWeek = 16; },
      s => { s.shadowAscetic.cases['blocked-alcove']!.attemptWeek = 18; },
      s => { delete s.shadowAscetic.cases['agreed-watch']; },
      s => { (s.shadowAscetic as unknown as Record<string, unknown>).lessons = {}; },
      s => { (s.shadowAscetic.cases['lamp-shift'] as unknown as Record<string, unknown>).hidden = 'yes'; },
      s => { delete (s.shadowAscetic.cases['lamp-shift'] as unknown as Record<string, unknown>).shadowOpen; },
    ];
    for (const mutate of changes) { const s = structuredClone(valid); mutate(s); expect(validateShadowAsceticState(s)).toBe(false); }
    const early = listener(); early.shadowAscetic.cases['lamp-shift']!.attemptWeek = 17; expect(validateShadowAsceticState(early)).toBe(false);
  });

  it('separates source-supported concealment from G cases and discloses the unverified formula', () => {
    for (const text of ['第三部第183章', 'L119923', '第二部第72章', '灵体之线', '遭射击', '不编造完整法术表', '本作原创G', '序列6蔷薇主教', '序列5牧羊人']) expect(SHADOW_ASCETIC_SOURCE_STATUS).toContain(text);
    expect(SHADOW_ASCETIC_ABILITIES.map(a => a.id)).toEqual(['hanged-man.s7.shadow-concealment']);
    for (const text of ['阴影', '被攻击', '不免疫', '不瞬移', '不分身', '封死']) expect(SHADOW_ASCETIC_ABILITIES[0]!.description).toContain(text);
    expect(projectShadowAscetic(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
  });
});
