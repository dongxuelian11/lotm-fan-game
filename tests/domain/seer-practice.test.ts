import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { awardSeerMastery, type SeerContext } from '../../src/domain/seer/index.js';
import { SEER_ABILITY_IDS } from '../../src/domain/seer/types.js';
import {
  applySeerPractice, createSeerPractice, projectSeerPractice, validateSeerPractice,
  SEER_PRACTICE_CASE_IDS, SEER_PRACTICE_REWARD, type SeerPracticeCommand,
} from '../../src/domain/seer/practice.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ready(): SliceState {
  const s = createSliceRun('seer-practice', sliceDefaultCreationSelection, 'seer-practice-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.arc.stage = 'ENDED';
  s.status = 'ACTIVE';
  s.world.city = 'BACKLUND';
  s.week = 7;
  s.actionsRemaining = 30;
  s.weeklyBudget = 30;
  s.spirituality = 30;
  s.progression = {
    pathwayId: 'diviner', sequence: 9, promotionWeek: 5, acting: 0,
    mastery: Object.fromEntries(SEER_ABILITY_IDS.map(id => [id, 0])),
  };
  s.seer.practice = createSeerPractice();
  for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 15;
  return s;
}
function context(s: SliceState, checkRoll = 20, masteryTicket = 1) {
  const checks: [PublicCoreStatKey, number][] = [];
  const draws: [number, number][] = [];
  const awards: [string, 5 | 8][] = [];
  const notes: { title: string; text: string }[] = [];
  const c: SeerContext = {
    check(stat, difficulty) {
      checks.push([stat, difficulty]);
      const result = resolveNormalCheck({ ability: stat, baseAbility: s.character.coreStats[stat], difficulty, modifiers: [], roll: checkRoll });
      s.lastCheck = result;
      return result;
    },
    roll(min, max) { draws.push([min, max]); return Math.max(min, Math.min(max, masteryTicket)); },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, checks, draws, awards, notes, award: (sourceId: string, amount: 5 | 8) => {
    awards.push([sourceId, amount]); awardSeerMastery(s, sourceId, amount, c);
  } };
}
function command(s: SliceState, caseId: string = SEER_PRACTICE_CASE_IDS[0], method = 0): SeerPracticeCommand {
  return projectSeerPractice(s).cases.find(entry => entry.id === caseId)!.choices[method]!.command;
}
function attemptAndDeliver(s: SliceState, intent: SeerPracticeCommand, roll = 20) {
  const ctx = context(s, roll);
  applySeerPractice(s, intent, ctx.c, ctx.award);
  if (intent.type === 'PRACTICE' && s.seer.practice.cases.find(entry => entry.id === intent.caseId)?.status === 'OBSERVED') {
    applySeerPractice(s, { type: 'PRACTICE', caseId: intent.caseId, approachId: 'report-bounded' }, ctx.c, ctx.award);
  }
  return ctx;
}
function rejection(s: SliceState, intent: SeerPracticeCommand, message?: RegExp) {
  const before = JSON.stringify(s), ctx = context(s);
  if (message) expect(() => applySeerPractice(s, intent, ctx.c, ctx.award)).toThrow(message);
  else expect(() => applySeerPractice(s, intent, ctx.c, ctx.award)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
  expect([ctx.checks, ctx.draws, ctx.awards, ctx.notes]).toEqual([[], [], [], []]);
}
function finishAll(s: SliceState, method = 0) {
  for (const id of SEER_PRACTICE_CASE_IDS) attemptAndDeliver(s, command(s, id, method));
}

const approaches = [
  ['folded-bookmark', 'sight', 'inspect', 'perception', 10, 'perception', 13, 2],
  ['packing-list', 'divine', 'count', 'knowledge', 11, 'knowledge', 14, 3],
  ['loose-display', 'intuition', 'observe', 'perception', 10, 'perception', 13, 1],
  ['copied-warning', 'memory', 'collate', 'knowledge', 9, 'knowledge', 12, 1],
  ['mourning-ribbon', 'sight', 'boundaries', 'perception', 11, 'will', 12, 2],
  ['uncertain-journey', 'divine', 'timetable', 'knowledge', 12, 'knowledge', 14, 3],
  ['stage-rehearsal', 'intuition', 'trace-cues', 'perception', 11, 'perception', 14, 1],
  ['mixed-catalogue', 'memory', 'lookup', 'knowledge', 10, 'knowledge', 13, 1],
] as const;

describe('eight finite, original-object club commissions', () => {
  it('creates eight independent named originals and two distinct public approaches each', () => {
    const s = ready(), p = projectSeerPractice(s), independent = createSeerPractice();
    expect(validateSeerPractice(s)).toBe(true);
    expect(p.cases.map(entry => entry.id)).toEqual([...SEER_PRACTICE_CASE_IDS]);
    expect(new Set(s.seer.practice.cases.map(entry => entry.originalId)).size).toBe(8);
    expect(new Set(s.seer.practice.cases.map(entry => entry.owner)).size).toBe(8);
    expect([p.completed, p.total, p.reflection.enabled]).toEqual([0, 8, false]);
    for (const [index, entry] of p.cases.entries()) {
      expect(entry.choices).toHaveLength(2);
      expect(new Set(entry.choices.map(choice => choice.id)).size).toBe(2);
      expect(entry.body).toContain(s.seer.practice.cases[index]!.owner);
      expect(entry.choices.every(choice => choice.enabled)).toBe(true);
      expect(entry.choices[1]!.cost).toContain('0灵性');
    }
    independent.cases[0]!.owner = 'different';
    expect(s.seer.practice.cases[0]!.owner).not.toBe('different');
    expect(s.seer.practice.cases.every(entry => entry.originalStatus === 'WITH_OWNER' && entry.attemptWeek === null)).toBe(true);
  });

  for (const [id, specialId, ordinaryId, specialStat, specialDifficulty, ordinaryStat, ordinaryDifficulty, spirit] of approaches) {
    for (const method of [0, 1]) it(`${id}, approach ${method}: checks normally, returns the original, and rewards only once`, () => {
      const s = ready(), p = projectSeerPractice(s), offer = p.cases.find(entry => entry.id === id)!.choices[method]!;
      const original = { ...s.seer.practice.cases.find(entry => entry.id === id)! };
      const before = { cash: s.cash, ap: s.actionsRemaining, spirit: s.spirituality, arc: JSON.stringify(s.arc), world: JSON.stringify(s.world), ending: JSON.stringify(s.ending) };
      const ctx = attemptAndDeliver(s, offer.command);
      expect(offer.command).toEqual({ type: 'PRACTICE', caseId: id, approachId: `${id === 'folded-bookmark' ? 'observe-' : ''}${method === 0 ? specialId : ordinaryId}` });
      expect(ctx.checks).toEqual([[method === 0 ? specialStat : ordinaryStat, method === 0 ? specialDifficulty : ordinaryDifficulty]]);
      expect(offer.cost).toContain(`成功率${s.lastCheck!.chance}%`);
      expect([s.actionsRemaining, s.spirituality, s.cash, s.progression.acting]).toEqual([before.ap - 1, before.spirit - (method === 0 ? spirit : 0), before.cash + SEER_PRACTICE_REWARD, 12]);
      expect(s.seer.practice.cases.find(entry => entry.id === id)).toEqual({
        ...original, originalStatus: 'RETURNED', status: 'COMPLETED', attemptWeek: 7,
        outcome: 'SUCCESS', approachId: method === 0 ? specialId : ordinaryId,
      });
      expect(ctx.awards).toEqual([[`seer-practice:${id}`, method === 0 ? 8 : 5]]);
      expect(ctx.draws).toEqual([[1, 20]]);
      expect(Object.values(s.progression.mastery).reduce((sum, value) => sum + value, 0)).toBe(method === 0 ? 8 : 5);
      expect(Object.keys(s.progression.mastery)).toEqual([...SEER_ABILITY_IDS]);
      expect(ctx.notes.at(-1)!.text).toContain(`原物已交还${original.owner}`);
      expect(projectSeerPractice(s).cases.find(entry => entry.id === id)!.choices).toEqual([]);
      expect([JSON.stringify(s.arc), JSON.stringify(s.world), JSON.stringify(s.ending)]).toEqual([before.arc, before.world, before.ending]);
      expect(s.combat).toBeNull();
      expect(validateSeerPractice(s)).toBe(true);
      rejection(s, offer.command, /已经交付/);
      s.week += 1;
      rejection(s, { type: 'PRACTICE', caseId: id, approachId: method === 0 ? ordinaryId : specialId }, /已经交付/);
    });
  }

  for (const roll of [80, 100]) for (const method of [0, 1]) it(`failed roll ${roll}, method ${method}: spends this attempt and waits until a later week`, () => {
    const s = ready(), intent = command(s, SEER_PRACTICE_CASE_IDS[0], method);
    const beforeCash = s.cash, ctx = attemptAndDeliver(s, intent, roll);
    expect([s.actionsRemaining, s.spirituality, s.cash, s.progression.acting]).toEqual([29, method === 0 ? 28 : 30, beforeCash, 0]);
    expect(s.seer.practice.cases[0]).toMatchObject({ status: 'FAILED', originalStatus: 'RETURNED', attemptWeek: 7, outcome: roll === 100 ? 'GREAT_FAILURE' : 'FAILURE' });
    expect(s.seer.completedSources).toEqual([]);
    expect(ctx.awards).toEqual([]);
    expect(ctx.draws).toEqual([]);
    expect(projectSeerPractice(s).cases[0]!.choices.every(choice => !choice.enabled && choice.reason!.includes('下周'))).toBe(true);
    rejection(s, intent, /下周/);
    rejection(s, command(s, SEER_PRACTICE_CASE_IDS[0], method === 0 ? 1 : 0), /下周/);
    expect(validateSeerPractice(s)).toBe(true);
    const originalId = s.seer.practice.cases[0]!.originalId;
    s.week += 1;
    expect(projectSeerPractice(s).cases[0]!.choices.every(choice => choice.enabled)).toBe(true);
    attemptAndDeliver(s, command(s, SEER_PRACTICE_CASE_IDS[0], 1));
    expect(s.seer.practice.cases[0]).toMatchObject({ status: 'COMPLETED', attemptWeek: 8, originalId });
    expect(s.seer.completedSources).toEqual([`seer-practice:${SEER_PRACTICE_CASE_IDS[0]}`]);
    expect(s.cash).toBe(beforeCash + 12);
  });

  it('great success has the same finite reward and cannot duplicate the original', () => {
    const s = ready(), before = s.cash;
    attemptAndDeliver(s, command(s), 1);
    expect([s.cash, s.progression.acting]).toEqual([before + 12, 12]);
    expect(Object.values(s.progression.mastery).reduce((a, b) => a + b, 0)).toBe(8);
    expect(s.seer.practice.cases).toHaveLength(8);
    expect(s.seer.practice.cases[0]!.outcome).toBe('GREAT_SUCCESS');
  });
});

describe('commission boundaries and public-only projection', () => {
  const gates: [string, (s: SliceState) => void][] = [
    ['unfinished case', s => { s.arc.stage = 'C_AVAILABLE'; }],
    ['ordinary character', s => { s.progression.pathwayId = null; s.progression.sequence = null; s.progression.mastery = {}; }],
    ['ended run', s => { s.status = 'SLICE_COMPLETE'; }],
    ['dead run', s => { s.status = 'DEAD'; }],
    ['active event', s => { s.activeEvent = { id: 'LIFE-BILL-01', instanceId: 'blocking-event' }; }],
    ['combat', s => { s.combat = { round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null }; }],
    ['no health', s => { s.health = 0; }],
    ['no mind', s => { s.mind = 0; }],
    ['no AP', s => { s.actionsRemaining = 0; }],
    ['outside club city', s => { s.world.city = 'ELSEWHERE'; }],
  ];
  for (const [label, alter] of gates) it(`rejects ${label} before spending or rolling`, () => {
    const s = ready(), intent = command(s);
    alter(s);
    rejection(s, intent);
    expect(projectSeerPractice(s).cases.flatMap(entry => entry.choices).every(choice => !choice.enabled)).toBe(true);
  });

  it('does not publish clients or originals until both first-case ending and promotion', () => {
    const s = ready();
    s.arc.stage = 'NOT_STARTED';
    expect(projectSeerPractice(s).cases).toEqual([]);
    expect(JSON.stringify(projectSeerPractice(s))).not.toMatch(/艾达|practice-original|folded-bookmark/);
    s.arc.stage = 'ENDED'; s.progression.pathwayId = null; s.progression.sequence = null;
    expect(projectSeerPractice(s).cases).toEqual([]);
  });

  it('rejects nonexistent commands, methods, mismatched originals, missing powers and inadequate spirit', () => {
    const s = ready();
    rejection(s, { type: 'PRACTICE', caseId: 'secret-first-case-relic', approachId: 'sight' });
    rejection(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'heal-client' });
    rejection(s, { type: 'INVENT_RELIC' } as unknown as SeerPracticeCommand);
    const intent = command(s);
    s.seer.practice.cases[0]!.originalId = 'first-case-bell';
    rejection(s, intent, /原物/);
    s.seer.practice = createSeerPractice();
    delete s.progression.mastery['diviner.s9.spiritual-sight'];
    rejection(s, intent, /尚未拥有/);
    s.progression.mastery['diviner.s9.spiritual-sight'] = 0;
    s.spirituality = 1;
    rejection(s, intent, /2点灵性/);
    s.spirituality = 0;
    const ordinary = command(s, 'folded-bookmark', 1);
    attemptAndDeliver(s, ordinary);
    expect(s.spirituality).toBe(0);
    expect(Object.keys(s.progression.mastery)).toEqual([...SEER_ABILITY_IDS.filter(id => id !== 'diviner.s9.spiritual-sight'), 'diviner.s9.spiritual-sight']);
  });

  it('detaches projected commands and reveals no private outcome or first-case world fact', () => {
    const s = ready(), before = JSON.stringify(s), p = projectSeerPractice(s);
    expect(JSON.stringify(p)).not.toMatch(/右箱漏记|后脚悬空|seer-practice:|practice-original:|bellHolder|carrierAlive/);
    p.cases[0]!.title = 'changed';
    p.cases[0]!.choices[0]!.enabled = false;
    const intent = p.cases[0]!.choices[0]!.command;
    if (intent.type === 'PRACTICE') intent.caseId = 'changed';
    expect(JSON.stringify(s)).toBe(before);
    expect(projectSeerPractice(s).cases[0]!.id).toBe('folded-bookmark');
  });

  it('records bounded reports instead of promising futures, secret identities, or healing', () => {
    const s = ready();
    const notes = attemptAndDeliver(s, command(s, 'uncertain-journey')).notes.at(-1)!.text;
    expect(notes).toContain('没有保证未来');
    const ribbonNotes = attemptAndDeliver(s, command(s, 'mourning-ribbon')).notes.at(-1)!.text;
    expect(ribbonNotes).toContain('不能证明逝者在场');
    const beforeHealth = s.health, beforeMind = s.mind;
    attemptAndDeliver(s, command(s, 'stage-rehearsal'));
    expect([s.health, s.mind, s.combat]).toEqual([beforeHealth, beforeMind, null]);
  });
});

describe('finite acting completion and saved commission continuity', () => {
  for (const method of [0, 1]) it(`eight approach-${method} completions plus one reflection reach 100 without repeat farming`, () => {
    const s = ready(), beforeCash = s.cash;
    rejection(s, { type: 'REFLECT' }, /全部8项/);
    finishAll(s, method);
    expect(s.progression.acting).toBe(96);
    expect(s.cash).toBe(beforeCash + 96);
    expect(s.seer.completedSources).toHaveLength(8);
    expect(Object.values(s.progression.mastery).reduce((a, b) => a + b, 0)).toBe(method === 0 ? 64 : 40);
    expect(projectSeerPractice(s).reflection.enabled).toBe(true);
    const beforeMastery = { ...s.progression.mastery }, beforeSpirit = s.spirituality;
    const ctx = attemptAndDeliver(s, { type: 'REFLECT' });
    expect([s.actionsRemaining, s.progression.acting, s.spirituality, s.cash]).toEqual([21, 100, beforeSpirit, beforeCash + 96]);
    expect(s.progression.mastery).toEqual(beforeMastery);
    expect([ctx.checks, ctx.draws, ctx.awards]).toEqual([[], [], []]);
    expect(s.progression.sequence).toBe(9);
    expect(validateSeerPractice(s)).toBe(true);
    expect(projectSeerPractice(s).reflection.enabled).toBe(false);
    s.week += 1;
    rejection(s, { type: 'REFLECT' }, /已经完成/);
  });

  it('also applies event, AP and life gates to reflection, without touching prior endings', () => {
    const s = ready(); finishAll(s);
    for (const [, alter] of [gatesForReflection('event'), gatesForReflection('ap'), gatesForReflection('dead')]) {
      const candidate = JSON.parse(JSON.stringify(s)) as SliceState;
      alter(candidate);
      rejection(candidate, { type: 'REFLECT' });
    }
    s.progression.acting = 99;
    attemptAndDeliver(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100);
  });

  it('reuses the existing weighted mastery pool, caps overflow and adds no new skill', () => {
    const s = ready(), [a, b, c, d] = SEER_ABILITY_IDS;
    s.progression.mastery = { [a]: 500, [b]: 499, [c]: 500, [d]: 500 };
    const ctx = attemptAndDeliver(s, command(s));
    expect(ctx.draws).toEqual([[1, 1]]);
    expect(s.progression.mastery).toEqual({ [a]: 500, [b]: 500, [c]: 500, [d]: 500 });
    const second = attemptAndDeliver(s, command(s, 'packing-list'));
    expect(second.draws).toEqual([]);
    expect(s.seer.completedSources).toHaveLength(2);
    expect(s.progression.acting).toBe(24);
  });

  it('survives JSON reload of a failed attempt and preserves same-week retry rejection', () => {
    const s = ready(); attemptAndDeliver(s, command(s), 100);
    const restored = JSON.parse(JSON.stringify(s)) as SliceState;
    expect(validateSeerPractice(restored)).toBe(true);
    rejection(restored, command(restored), /下周/);
    restored.week += 1;
    attemptAndDeliver(restored, command(restored));
    expect(validateSeerPractice(restored)).toBe(true);
    const completed = JSON.parse(JSON.stringify(restored)) as SliceState;
    rejection(completed, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'inspect' }, /已经交付/);
  });

  it('rejects inconsistent fixed originals, weeks, results, sources and premature reflection', () => {
    const s = ready(); attemptAndDeliver(s, command(s));
    for (const alter of [
      (v: SliceState) => { v.seer.practice.cases[0]!.owner = 'PLAYER'; },
      (v: SliceState) => { v.seer.practice.cases[0]!.originalId = 'new-object'; },
      (v: SliceState) => { v.seer.practice.cases.push({ ...v.seer.practice.cases[0]! }); },
      (v: SliceState) => { v.seer.practice.cases[1]!.id = v.seer.practice.cases[0]!.id; },
      (v: SliceState) => { v.seer.practice.cases[0]!.attemptWeek = v.week + 1; },
      (v: SliceState) => { v.seer.practice.cases[0]!.outcome = 'FAILURE'; },
      (v: SliceState) => { v.seer.practice.cases[0]!.originalStatus = 'WITH_OWNER'; },
      (v: SliceState) => { v.seer.practice.cases[0]!.approachId = 'conjure'; },
      (v: SliceState) => { v.seer.completedSources = []; },
      (v: SliceState) => { v.seer.completedSources.push(v.seer.completedSources[0]!); },
      (v: SliceState) => { v.seer.practice.reflected = true; },
      (v: SliceState) => { v.arc.stage = 'C'; },
    ]) {
      const invalid = JSON.parse(JSON.stringify(s)) as SliceState;
      alter(invalid);
      expect(validateSeerPractice(invalid)).toBe(false);
    }
    for (const malformed of [null, {}, { cases: [null], reflected: false }]) {
      const invalid = JSON.parse(JSON.stringify(s)) as SliceState;
      invalid.seer.practice = malformed as unknown as SliceState['seer']['practice'];
      expect(validateSeerPractice(invalid)).toBe(false);
    }
  });
});

function gatesForReflection(kind: 'event' | 'ap' | 'dead'): [string, (s: SliceState) => void] {
  return [kind, s => {
    if (kind === 'event') s.activeEvent = { id: 'LIFE-BILL-01', instanceId: 'reflection-bill' };
    if (kind === 'ap') s.actionsRemaining = 0;
    if (kind === 'dead') s.status = 'DEAD';
  }];
}

describe('the first commission leaves interpretation to the player', () => {
  const bounded: SeerPracticeCommand = { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'report-bounded' };
  const cause: SeerPracticeCommand = { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'report-cause' };

  for (const method of [0, 1]) it(`saves approach ${method} observation without auto-delivery, then resolves without a second check or cost`, () => {
    const s = ready(), beforeCash = s.cash, ctx = context(s);
    s.actionsRemaining = 1;
    const inspect = command(s, 'folded-bookmark', method);
    applySeerPractice(s, inspect, ctx.c, ctx.award);
    expect(s.seer.practice.cases[0]).toMatchObject({ status: 'OBSERVED', outcome: 'SUCCESS', approachId: method === 0 ? 'sight' : 'inspect' });
    expect([s.actionsRemaining, s.cash, s.progression.acting]).toEqual([0, beforeCash, 0]);
    expect(ctx.awards).toEqual([]);
    expect(ctx.draws).toEqual([]);
    expect(projectSeerPractice(s).cases[0]!.body).toContain('你该怎样回答');
    expect(projectSeerPractice(s).cases[0]!.choices.map(choice => choice.command)).toEqual([bounded, cause]);
    expect(projectSeerPractice(s).cases[0]!.choices.every(choice => choice.enabled)).toBe(true);
    rejection(s, inspect, /先决定/);
    const restored = JSON.parse(JSON.stringify(s)) as SliceState;
    expect(validateSeerPractice(restored)).toBe(true);
    const reply = context(restored);
    applySeerPractice(restored, bounded, reply.c, reply.award);
    expect(reply.checks).toEqual([]);
    expect([restored.actionsRemaining, restored.spirituality, restored.cash, restored.progression.acting]).toEqual([0, s.spirituality, beforeCash + 12, 12]);
    expect(reply.awards).toEqual([['seer-practice:folded-bookmark', method === 0 ? 8 : 5]]);
    expect(reply.notes.at(-1)!.text).toContain('马洛·里德');
    expect(validateSeerPractice(restored)).toBe(true);
    rejection(restored, bounded, /已经交付/);
    rejection(restored, cause, /已经交付/);
  });

  it('does not turn an unsupported causal claim into a bad observation roll or a reward', () => {
    const s = ready(), beforeCash = s.cash, ctx = context(s, 1);
    applySeerPractice(s, command(s), ctx.c, ctx.award);
    const afterObservation = [s.actionsRemaining, s.spirituality];
    applySeerPractice(s, cause, ctx.c, ctx.award);
    expect(s.seer.practice.cases[0]).toMatchObject({ status: 'DISPUTED', outcome: 'GREAT_SUCCESS' });
    expect([s.actionsRemaining, s.spirituality]).toEqual(afterObservation);
    expect([s.cash, s.progression.acting]).toEqual([beforeCash, 0]);
    expect([ctx.checks.length, ctx.draws.length, ctx.awards.length]).toEqual([1, 0, 0]);
    expect(ctx.notes.at(-1)!.text).toContain('没有依据');
    expect(validateSeerPractice(s)).toBe(true);
    rejection(s, bounded, /先完成/);
    rejection(s, command(s), /下周/);
    const restored = JSON.parse(JSON.stringify(s)) as SliceState;
    expect(validateSeerPractice(restored)).toBe(true);
    restored.week += 1;
    attemptAndDeliver(restored, command(restored));
    expect(restored.seer.practice.cases[0]!.status).toBe('COMPLETED');
    expect(restored.cash).toBe(beforeCash + 12);
    expect(restored.seer.completedSources).toEqual(['seer-practice:folded-bookmark']);
  });

  it('rejects interpretation before observation, after a failed check, and for other cases', () => {
    const s = ready();
    rejection(s, bounded, /先完成/);
    rejection(s, { type: 'PRACTICE', caseId: 'packing-list', approachId: 'report-bounded' });
    const ctx = context(s, 100);
    applySeerPractice(s, command(s), ctx.c, ctx.award);
    rejection(s, bounded, /先完成/);
    expect(s.seer.practice.cases[0]!.status).toBe('FAILED');
  });

  it('keeps saved pending choices subject to event, city and life gates but not another action payment', () => {
    const s = ready(), ctx = context(s);
    applySeerPractice(s, command(s), ctx.c, ctx.award);
    for (const alter of [
      (v: SliceState) => { v.activeEvent = { id: 'LIFE-BILL-01', instanceId: 'pending-reply-event' }; },
      (v: SliceState) => { v.status = 'DEAD'; },
      (v: SliceState) => { v.world.city = 'ELSEWHERE'; },
    ]) {
      const invalid = structuredClone(s);
      alter(invalid);
      rejection(invalid, bounded);
    }
    s.actionsRemaining = 0;
    s.spirituality = 0;
    applySeerPractice(s, bounded, ctx.c, ctx.award);
    expect(s.seer.practice.cases[0]!.status).toBe('COMPLETED');
  });

  it('validates pending observations, keeps historical deliveries unchanged, and rejects forged pending rewards', () => {
    const s = ready(), ctx = context(s);
    applySeerPractice(s, command(s), ctx.c, ctx.award);
    for (const alter of [
      (v: SliceState) => { v.seer.practice.cases[0]!.outcome = null; },
      (v: SliceState) => { v.seer.practice.cases[0]!.outcome = 'FAILURE'; },
      (v: SliceState) => { v.seer.practice.cases[0]!.approachId = 'report-bounded'; },
      (v: SliceState) => { v.seer.completedSources.push('seer-practice:folded-bookmark'); },
      (v: SliceState) => { Object.assign(v.seer.practice.cases[1]!, { status: 'OBSERVED', originalStatus: 'RETURNED', attemptWeek: 7, outcome: 'SUCCESS', approachId: 'divine' }); },
    ]) {
      const invalid = structuredClone(s);
      alter(invalid);
      expect(validateSeerPractice(invalid)).toBe(false);
    }
    // Historical completed records have exactly the old fields; no interpretation migration is needed.
    const historical = ready();
    Object.assign(historical.seer.practice.cases[0]!, { status: 'COMPLETED', originalStatus: 'RETURNED', attemptWeek: 6, outcome: 'SUCCESS', approachId: 'sight' });
    historical.seer.completedSources.push('seer-practice:folded-bookmark');
    const bytes = JSON.stringify(historical);
    expect(validateSeerPractice(historical)).toBe(true);
    expect(projectSeerPractice(historical).cases[0]!.choices).toEqual([]);
    expect(JSON.stringify(historical)).toBe(bytes);
  });
});

describe('historical first-commission commands', () => {
  for (const approachId of ['sight', 'inspect']) it(`keeps ${approachId} immediate completion, costs and mastery draw`, () => {
    const s = ready(), beforeCash = s.cash, ctx = context(s);
    applySeerPractice(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId }, ctx.c, ctx.award);
    expect(s.seer.practice.cases[0]).toMatchObject({ status: 'COMPLETED', approachId, outcome: 'SUCCESS' });
    expect([s.actionsRemaining, s.spirituality, s.cash, s.progression.acting]).toEqual([29, approachId === 'sight' ? 28 : 30, beforeCash + 12, 12]);
    expect(ctx.checks).toHaveLength(1);
    expect(ctx.draws).toEqual([[1, 20]]);
    expect(ctx.awards).toEqual([['seer-practice:folded-bookmark', approachId === 'sight' ? 8 : 5]]);
    expect(ctx.notes.at(-1)!.title).toBe('书签折痕里的冷意 · 已交付');
    expect(ctx.notes.at(-1)!.text).not.toContain('马洛');
    expect(validateSeerPractice(s)).toBe(true);
    rejection(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId }, /已经交付/);
  });

  it('only exposes new observation commands for the first commission', () => {
    const s = ready(), first = projectSeerPractice(s).cases[0]!;
    expect(first.choices.map(choice => choice.command)).toEqual([
      { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'observe-sight' },
      { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'observe-inspect' },
    ]);
    rejection(s, { type: 'PRACTICE', caseId: 'mourning-ribbon', approachId: 'observe-sight' });
    rejection(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'observe-divine' });
  });
});
