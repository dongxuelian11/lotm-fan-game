import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { applyMysticCommand, createMysticState, isMystic, projectMystic, validateMysticCommand, validateMysticState } from '../../src/domain/mystic/index.js';
import { MYSTIC_ABILITIES, MYSTIC_CONSUMPTION_RISK, MYSTIC_FORMULA_STATUS, MYSTIC_PRICES, MYSTIC_SOURCE_STATUS } from '../../src/domain/mystic/content.js';
import { MYSTIC_ABILITY_IDS, type MysticCommand } from '../../src/domain/mystic/types.js';
import { MYSTIC_ANALYSIS_STEPS, MYSTIC_SAMPLE_SOURCE, hasMysticRitualLock, validateMysticRitual } from '../../src/domain/mystic/ritual.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Directed fixtures continue the genuine old S5 history; prescribed rolls/resources are unit fixtures, not natural-play evidence.
function star(): SliceState {
  const prior = JSON.parse(readFileSync('tests/fixtures/star-mystic-v01090/natural.json', 'utf8')).final;
  const s = migrateSliceState(prior);
  s.mystic = createMysticState(); s.week = Math.max(s.week, s.starMystic.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 40000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 18;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: MysticCommand, roll = 1) { const c = context(s, roll); applyMysticCommand(s, command, c); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyMysticCommand(s, command as MysticCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
function taught(s = star()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function analyzed(s = taught(), returned = true) {
  act(s, { type: 'ACQUIRE_SAMPLE' }); act(s, { type: 'OPEN_ANALYSIS' });
  for (let n = 0; n < 3; n++) act(s, { type: 'ANALYZE_SAMPLE' });
  act(s, { type: 'CLOSE_ANALYSIS' }); if (returned) act(s, { type: 'RETURN_SAMPLE' }); return s;
}
function buy(s: SliceState, index = 0) { const b = s.mystic.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = analyzed(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.mystic.bottles[0]!.id, confirmed: true }); return s; }
const oldStages = (s: SliceState) => [s.pryer, s.combatScholar, s.wizard, s.scrollProfessor, s.starMystic, s.town, s.combatHistory];

describe('Mystic S4 finite original acquisition and one-drop analysis', () => {
  it('creates independent dormant state without inventing formulas, samples or abilities', () => {
    const s = createSliceRun('mystic-hidden', sliceDefaultCreationSelection, 'mystic-hidden');
    expect(validateMysticState(s)).toBe(true);
    expect(projectMystic(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], ritual: null });
    expect(projectMystic(s).story).toBeUndefined();
    const other = createMysticState(); other.bottles[0]!.labourSteps = 4; other.ritual.sample.status = 'SEALED';
    expect(s.mystic).toEqual(createMysticState()); reject(s, { type: 'LEARN_GUIDANCE' }); reject(s, { type: 'ACQUIRE_SAMPLE' });
  });
  it('charges original guidance and preserves every old stage while leaving complete formula unknown', () => {
    const s = star(), old = structuredClone(oldStages(s));
    expect(validateMysticState(s)).toBe(true); act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([39460, 99]); expect(oldStages(s)).toEqual(old);
    expect(MYSTIC_PRICES).toEqual({ guidance: 540, potion: 6800, labourCredit: 5300 });
    expect(MYSTIC_FORMULA_STATUS).toContain('其余仪式细节未知'); expect(MYSTIC_FORMULA_STATUS).toContain('不饮用');
    expect(projectMystic(s)).toMatchObject({ discovered: true, guidanceKnown: true, formulaKnown: false, formula: [] });
    reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateMysticState(s)).toBe(true);
  });
  it('requires five real actions and a paid nontransferable bottle credit', () => {
    const s = taught(), b = s.mystic.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, s.actionsRemaining]).toEqual([5, 94]); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    buy(s); expect([b.status, s.cash, s.actionsRemaining]).toEqual(['PLAYER', 37960, 94]);
    act(s, { type: 'POTION_WORK', bottleId: s.mystic.bottles[1]!.id }); const before = s.cash; buy(s, 1);
    expect(before - s.cash).toBe(6800); reject(s, { type: 'BUY_POTION', bottleId: b.id }); expect(validateMysticState(s)).toBe(true);
  });
  it('actually acquires only one traceable donated drop, one original shield and one book for 240 and one action', () => {
    const s = taught(), old = structuredClone(oldStages(s)), ap = s.actionsRemaining, cash = s.cash;
    act(s, { type: 'ACQUIRE_SAMPLE' });
    expect([s.actionsRemaining, s.cash]).toEqual([ap - 1, cash - 240]);
    expect(s.mystic.ritual.sample).toMatchObject({ id: 'MY4-BLOOD-1', donorId: 'MY4-DONOR-1', quantityDrops: 1, source: MYSTIC_SAMPLE_SOURCE, status: 'SEALED', acquiredWeek: s.week });
    expect(s.mystic.ritual.donorContribution).toEqual({ donorId: 'MY4-DONOR-1', sampleId: 'MY4-BLOOD-1', week: s.week, quantityDrops: 1, source: MYSTIC_SAMPLE_SOURCE });
    expect(s.mystic.ritual.shield).toEqual({ id: 'MY4-SHIELD-1', status: 'RACK' }); expect(s.mystic.ritual.recordbook).toEqual({ id: 'MY4-RECORD-1', status: 'PLAYER' });
    expect(oldStages(s)).toEqual(old); reject(s, { type: 'ACQUIRE_SAMPLE' }); reject(s, { type: 'RETURN_SAMPLE' }); expect(validateMysticState(s)).toBe(true);
  });
  it('offers original lenses without a permanent prepromotion lock and never duplicates an already owned pair', () => {
    const s = taught(); s.starMystic.practice.lenses = 'SUPPLIER'; act(s, { type: 'ACQUIRE_SAMPLE' });
    reject(s, { type: 'OPEN_ANALYSIS' }); const ap = s.actionsRemaining, cash = s.cash, marker = s.starMystic.practice.markerSeen;
    expect(projectMystic(s).actions.some(a => a.command.type === 'BUY_LENSES' && a.enabled)).toBe(true);
    act(s, { type: 'BUY_LENSES' }); expect([s.actionsRemaining, s.cash, s.starMystic.practice.lenses]).toEqual([ap - 1, cash - 80, 'WORN']);
    expect(s.starMystic.practice.markerSeen).toBe(marker); reject(s, { type: 'BUY_LENSES' }); act(s, { type: 'OPEN_ANALYSIS' });
    expect(hasMysticRitualLock(s)).toBe(true); expect(validateMysticRitual(s)).toBe(true);
  });
  it('records three distinct genuinely successful analyses and every real cost, without acting or mastery rewards', () => {
    const s = taught(), old = structuredClone(oldStages(s)), mastery = { ...s.progression.mastery }, acting = s.progression.acting;
    act(s, { type: 'ACQUIRE_SAMPLE' }); act(s, { type: 'OPEN_ANALYSIS' }); const ap = s.actionsRemaining, mind = s.mind, spirit = s.spirituality;
    for (let n = 0; n < 3; n++) {
      const c = act(s, { type: 'ANALYZE_SAMPLE' }); expect(c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18);
      expect(s.mystic.ritual.attempts[n]).toMatchObject({ stepId: MYSTIC_ANALYSIS_STEPS[n]!.id, sampleId: 'MY4-BLOOD-1', session: 1, week: s.week, tier: 'GREAT_SUCCESS', actionCost: 1, spiritualityCost: 4, mindCost: 2 });
      expect(validateMysticState(s)).toBe(true);
    }
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([ap - 3, spirit - 12, mind - 6]);
    expect(s.mystic.ritual.completedSteps).toEqual(['structure', 'references', 'model-recheck']); expect(s.mystic.ritual.complete).toBe(true);
    expect(s.progression.acting).toBe(acting); expect(s.progression.mastery).toEqual(mastery); expect(oldStages(s)).toEqual(old);
    reject(s, { type: 'ANALYZE_SAMPLE' }); reject(s, { type: 'RETURN_SAMPLE' });
    s.actionsRemaining = 0; act(s, { type: 'CLOSE_ANALYSIS' }); expect(hasMysticRitualLock(s)).toBe(false);
    act(s, { type: 'RETURN_SAMPLE' }); expect(s.mystic.ritual.sample).toMatchObject({ status: 'RETURNED', returnedWeek: s.week, quantityDrops: 1 });
    expect(s.actionsRemaining).toBe(0); reject(s, { type: 'RETURN_SAMPLE' }); expect(validateMysticState(s)).toBe(true);
  });
  it('keeps a failed paid step incomplete, enables zero-AP safety and only retries in a genuinely later week', () => {
    const s = taught(); act(s, { type: 'ACQUIRE_SAMPLE' }); act(s, { type: 'OPEN_ANALYSIS' }); const ap = s.actionsRemaining;
    act(s, { type: 'ANALYZE_SAMPLE' }, 100);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([ap - 1, 96, 98]);
    expect(s.mystic.ritual.attempts[0]).toMatchObject({ stepId: 'structure', tier: 'GREAT_FAILURE', actionCost: 1, spiritualityCost: 4, mindCost: 2 });
    expect(s.mystic.ritual.completedSteps).toEqual([]); reject(s, { type: 'ANALYZE_SAMPLE' });
    s.actionsRemaining = 0; s.spirituality = 0; act(s, { type: 'CLOSE_ANALYSIS' });
    expect(hasMysticRitualLock(s)).toBe(false); expect(validateMysticState(s)).toBe(true);
    s.actionsRemaining = 10; s.spirituality = 20; reject(s, { type: 'OPEN_ANALYSIS' }); s.week++;
    act(s, { type: 'OPEN_ANALYSIS' }); act(s, { type: 'ANALYZE_SAMPLE' });
    expect(s.mystic.ritual.completedSteps).toEqual(['structure']); expect(s.mystic.ritual.attempts).toHaveLength(2);
    expect(s.mystic.ritual.attempts[1]).toMatchObject({ stepId: 'structure', session: 2, week: s.week });
    expect(projectMystic(s).ritual!.history.some(h => h.includes('失败成本保留'))).toBe(true); expect(validateMysticState(s)).toBe(true);
  });
  it('requires complete analysis, actual close and actual original return separately before medicine', () => {
    const s = taught(), b = buy(s); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    analyzed(s, false); expect(s.mystic.ritual.complete).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(projectMystic(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('归还');
    s.actionsRemaining = 0; act(s, { type: 'RETURN_SAMPLE' }); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(isMystic(s)).toBe(true); expect(s.actionsRemaining).toBe(0); expect(validateMysticState(s)).toBe(true);
  });
  it('permits preparation early but requires 100 digestion and twelve actual post-S5 weeks', () => {
    const s = star(); s.week = s.starMystic.promotionWeek! + 11; s.progression.acting = 99;
    taught(s); analyzed(s); const b = buy(s); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; expect(projectMystic(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); s.week++;
    act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.mystic.starMysticActingAtPromotion).toBe(100); expect(validateMysticState(s)).toBe(true);
  });
  it('executes all four fixed G outcomes against exactly the selected original bottle', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 96, 100, 31, 0, 4], [30, 'SUCCESS', 92, 100, 16, 0, 4], [85, 'FAILURE', 75, 85, 31, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 31, 60, 5]] as const;
    for (const [roll, tier, mind, health, spirit, pollution, sequence] of tiers) {
      const s = prepared(), old = structuredClone(oldStages(s)), ritual = structuredClone(s.mystic.ritual), mastery = { ...s.progression.mastery };
      s.health = 100; s.mind = 100; s.spirituality = 31; const b = s.mystic.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect([b.status, b.outcome, s.mind, s.health, s.spirituality, s.seer.pollution, s.progression.sequence]).toEqual(['CONSUMED', tier, mind, health, spirit, pollution, sequence]);
      expect(oldStages(s)).toEqual(old); expect(s.mystic.ritual).toEqual(ritual);
      for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.mystic.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      expect(validateMysticState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('limits medicine-only severe loss to one without reviving consumed bottles or granting other protections', () => {
    const s = prepared(); s.health = 21; s.mind = 41; s.seer.pollution = 90;
    act(s, { type: 'CONSUME', bottleId: s.mystic.bottles[0]!.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.progression.sequence, s.progression.acting]).toEqual([1, 1, 100, 5, 100]);
    expect(s.mystic.ritual.sample.status).toBe('RETURNED'); expect(validateMysticState(s)).toBe(true);
    expect(MYSTIC_CONSUMPTION_RISK).toContain('保护不适用于战斗');
    for (const [health, mind] of [[20, 100], [100, 40]]) { const t = prepared(); t.health = health!; t.mind = mind!; reject(t, { type: 'CONSUME', bottleId: t.mystic.bottles[0]!.id, confirmed: true }); }
    const t = prepared(); t.spirituality = 3; act(t, { type: 'CONSUME', bottleId: t.mystic.bottles[0]!.id, confirmed: true }, 30); expect(t.spirituality).toBe(0);
  });
  it('adds only two zero mastery IDs, four stats and a preserved S5 snapshot with no body or resource reset', () => {
    const s = prepared(), ids = Object.keys(s.progression.mastery), stats = { ...s.character.coreStats }, gender = s.character.gender, spirit = s.spirituality;
    act(s, { type: 'CONSUME', bottleId: s.mystic.bottles[0]!.id, confirmed: true });
    expect(Object.keys(s.progression.mastery)).toEqual([...ids, ...MYSTIC_ABILITY_IDS]);
    for (const id of MYSTIC_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(stats[key] + 1);
    expect([s.character.gender, s.spirituality, s.progression.acting, s.mystic.starMysticActingAtPromotion]).toEqual([gender, spirit, 0, 100]);
    expect(s.mystic.life).toEqual(createMysticState().life); expect(s.mystic.encounter).toEqual(createMysticState().encounter);
    expect(projectMystic(s).abilities.map(a => a.id)).toEqual([...MYSTIC_ABILITY_IDS]);
  });
  it('resupplies only after every failed original and a later real week, preserving the already returned sample', () => {
    const s = analyzed(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { s.health = 100; s.mind = 100; const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.mystic.bottles), ritual = structuredClone(s.mystic.ritual);
    act(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' }); expect(s.mystic.bottles).toHaveLength(6); expect(s.mystic.bottles.slice(0, 3)).toEqual(originals);
    expect(s.mystic.ritual).toEqual(ritual); expect(s.mystic.bottles[3]).toMatchObject({ id: 'mystic-potion-4', labourSteps: 0, status: 'SUPPLIER' });
    expect(validateMysticState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('unifies current life, encounter and original maker4 workshop without uplifting or replacing any old scroll', () => {
    const s = promoted(), old = structuredClone(s.scrollProfessor.workshop.scrolls), mastery = { ...s.progression.mastery };
    expect(validateMysticCommand({ type: 'OBSERVE', caseId: 'sealed-story' })).toBe(true);
    expect(validateMysticCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateMysticCommand({ type: 'PUBLISH_STORY', confirmed: true })).toBe(true);
    expect(projectMystic(s).workshop).toBeDefined(); act(s, { type: 'BUY_KIT' });
    act(s, { type: 'CRAFT_SCROLL', kind: 'IMPACT' });
    expect(s.scrollProfessor.workshop.scrolls.slice(0, old.length)).toEqual(old);
    const scroll = s.scrollProfessor.workshop.scrolls.at(-1)!; expect(scroll.makerSequence).toBe(4); expect(scroll.authorized).toBe(false);
    act(s, { type: 'AUTHORIZE_SCROLL', scrollId: scroll.id, authorized: true }); expect(scroll.authorized).toBe(true); expect(s.progression.mastery).toEqual(mastery);
    act(s, { type: 'OBSERVE', caseId: 'sealed-story' }); expect(s.mystic.life.cases['sealed-story'].status).toBe('OBSERVED');
  });
  it('rejects malformed, invented, drinking and unconfirmed commands atomically', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'DRINK_BLOOD' }, { type: 'ANALYZE_SAMPLE', step: 'all' }, { type: 'ACQUIRE_SAMPLE', copies: 2 }, { type: 'CONSUME', bottleId: 'mystic-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'star-mystic-potion-1' }, { type: 'BUY_LENSES', price: 0 }, { type: 'PUBLISH_STORY', confirmed: false }, { type: 'TRANSFORM_MYTHIC' }];
    for (const command of malformed) { expect(validateMysticCommand(command)).toBe(false); reject(taught(), command); }
    reject(prepared(), { type: 'BUY_POTION', bottleId: 'mystic-potion-999' });
    const s = taught(); s.actionsRemaining = 0; reject(s, { type: 'ACQUIRE_SAMPLE' });
    const t = taught(); t.cash = 239; reject(t, { type: 'ACQUIRE_SAMPLE' });
  });
  it('blocks medicine and preparation during unfinished old contact, old preparation, sample analysis or a live event', () => {
    for (const mutate of [
      (s: SliceState) => { s.starMystic.practice.lenses = 'HELD'; },
      (s: SliceState) => { s.starMystic.practice.cageActive = true; },
      (s: SliceState) => { s.starMystic.practice.playerNode = 'COURTYARD'; },
      (s: SliceState) => { s.scrollProfessor.cases['paper-target']!.contactOpen = true; },
      (s: SliceState) => { s.wizard.cases['paper-marker']!.status = 'PREPARED'; },
    ]) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.mystic.bottles[0]!.id, confirmed: true }); }
    const s = taught(); act(s, { type: 'ACQUIRE_SAMPLE' }); act(s, { type: 'OPEN_ANALYSIS' }); reject(s, { type: 'BUY_POTION', bottleId: s.mystic.bottles[0]!.id });
  });
  it('rejects forged identity, duplicated successful steps, missing failure costs, chronology and completed flags', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.mystic.ritual.sample.source = 'invented'; },
      t => { t.mystic.ritual.donorContribution!.source = 'anonymous'; },
      t => { t.mystic.ritual.completedSteps[1] = 'structure'; },
      t => { t.mystic.ritual.attempts[1]!.stepId = 'structure'; },
      t => { t.mystic.ritual.attempts[0]!.tier = 'FAILURE'; },
      t => { t.mystic.ritual.attempts[0]!.week++; },
      t => { t.mystic.ritual.attempts.pop(); },
      t => { t.mystic.ritual.sample.status = 'SEALED'; t.mystic.ritual.sample.returnedWeek = null; },
      t => { t.mystic.ritual.sample.returnedWeek = t.mystic.promotionWeek! + 1; },
      t => { t.mystic.starMysticActingAtPromotion = 99; },
      t => { t.mystic.bottles[0]!.source = 'invented'; },
      t => { t.mystic.bottles[0]!.consumedWeek = t.mystic.bottles[0]!.consumedWeek! - 1; },
      t => { t.mystic.bottles[1]!.id = 'mystic-potion-1'; },
      t => { (t.mystic.ritual.attempts as unknown[])[0] = null; },
      t => { (t.mystic as unknown as Record<string, unknown>).ritual = null; },
      t => { t.progression.mastery['hermit.s4.free-luck'] = 0; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateMysticState(t)).not.toThrow(); expect(validateMysticState(t)).toBe(false); }
  });
  it('preserves canonical JSON order and exposes only read-only copies and explicit source boundaries', () => {
    for (const s of [star(), taught(), prepared(), promoted()]) {
      const reordered = JSON.parse(stableStringify(s)) as SliceState;
      expect(validateMysticState(reordered)).toBe(true); expect(projectMystic(reordered)).toEqual(projectMystic(s));
    }
    const s = promoted(), before = structuredClone(s), p = projectMystic(s);
    p.ritual!.steps[0]!.complete = false; p.ritual!.history.push('invented'); p.abilities[0]!.mastery = 99;
    expect(s).toEqual(before); expect(MYSTIC_ABILITIES).toHaveLength(2);
    for (const boundary of ['不饮', '神秘再现', '传播', '背叛之宴', '丑小鸭', '预言大师', '原创G']) expect(MYSTIC_SOURCE_STATUS + MYSTIC_FORMULA_STATUS).toContain(boundary);
  });
});
