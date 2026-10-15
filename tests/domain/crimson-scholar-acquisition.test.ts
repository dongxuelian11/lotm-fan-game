import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { APOTHECARY_ABILITY_IDS } from '../../src/domain/apothecary/types.js';
import { TAMER_ABILITY_IDS } from '../../src/domain/tamer/types.js';
import { VAMPIRE_ABILITY_IDS } from '../../src/domain/vampire/types.js';
import { POTION_PROFESSOR_ABILITY_IDS } from '../../src/domain/potion-professor/types.js';
import { WEREWOLF_MOON_EVENTS } from '../../src/domain/werewolf/content.js';
import { applyCrimsonScholarCommand, createCrimsonScholarState, isCrimsonScholarAcquisitionCommand, projectCrimsonScholar, validateCrimsonScholarCommand, validateCrimsonScholarState } from '../../src/domain/crimson-scholar/index.js';
import { CRIMSON_SCHOLAR_FORMULA_STATUS, CRIMSON_SCHOLAR_PRICES, CRIMSON_SCHOLAR_RITUAL_KIT_SOURCE, CRIMSON_SCHOLAR_SOURCE_STATUS } from '../../src/domain/crimson-scholar/content.js';
import { CRIMSON_SCHOLAR_ABILITY_IDS, type CrimsonScholarAcquisitionCommand } from '../../src/domain/crimson-scholar/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function professor(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/potion-professor-v0770/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.crimsonScholar = createCrimsonScholarState(); s.week = s.potionProfessor.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: CrimsonScholarAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyCrimsonScholarCommand(s, command, c); return c;
}
function taught(s = professor()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.crimsonScholar.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function arrive(s: SliceState) {
  act(s, { type: 'REQUEST_RITUAL' });
  const event = s.crimsonScholar.ritual.announcements.find(e => e.id === s.crimsonScholar.ritual.reservedEventId)!;
  s.week = event.week; act(s, { type: 'BEGIN_RITUAL' }); return event;
}
function prepared() { const s = taught(); buy(s); arrive(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.crimsonScholar.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyCrimsonScholarCommand(s, command as CrimsonScholarAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Crimson Scholar original S5 bottles and actual full-moon ritual', () => {
  it('hides the future channel and initializes isolated bottles, practice and immutable fixed announcements', () => {
    const s = createSliceRun('crimson-hidden', sliceDefaultCreationSelection, 'crimson-hidden');
    expect(validateCrimsonScholarState(s)).toBe(true);
    expect(projectCrimsonScholar(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], practice: null, ritual: { summary: '', announcements: [], history: [] } });
    expect(projectCrimsonScholar(s).story).toBeUndefined();
    expect(s.crimsonScholar.ritual.announcements).toEqual(WEREWOLF_MOON_EVENTS.map(({ id, week, source }) => ({ id, week, source })));
    const other = createCrimsonScholarState(); other.practice.field = 'FULL'; other.bottles[0]!.labourSteps = 5; other.ritual.announcements[0]!.week = 1;
    expect(s.crimsonScholar.practice.field).toBe('NONE'); expect(s.crimsonScholar.bottles[0]!.labourSteps).toBe(0); expect(s.crimsonScholar.ritual.announcements[0]!.week).toBe(32);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('uses the original adult mentor, charges460 and keeps the unknown formula separate from known ritual requirements', () => {
    const s = professor(), old = structuredClone([s.apothecary, s.tamer, s.vampire, s.potionProfessor]);
    expect(validateCrimsonScholarState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.apothecary, s.tamer, s.vampire, s.potionProfessor]).toEqual(old);
    expect(CRIMSON_SCHOLAR_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(CRIMSON_SCHOLAR_FORMULA_STATUS).toContain('完整晋升配方仍未知');
    expect(CRIMSON_SCHOLAR_FORMULA_STATUS).toContain('真实满月照耀');
    expect(projectCrimsonScholar(s)).toMatchObject({ formulaKnown: false, formula: [] });
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labours and600 payment per bottle with no transferred or partial credit', () => {
    const s = taught(), b = s.crimsonScholar.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.crimsonScholar.bottles[1]!; act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateCrimsonScholarState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.crimsonScholar.bottles[2]!.id });
  });
  it('reserves the next strictly future fixed event and allows zero-action cancellation without changing its announcement', () => {
    const s = taught(), original = structuredClone(s.crimsonScholar.ritual.announcements), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_RITUAL' });
    expect(s.crimsonScholar.ritual.reservedEventId).toBe('wolf-moon-06'); expect(s.actionsRemaining).toBe(ap - 1);
    expect(s.crimsonScholar.ritual.visits).toEqual([]); reject(s, { type: 'REQUEST_RITUAL' });
    s.actionsRemaining = 0; act(s, { type: 'CANCEL_RITUAL' });
    expect(s.crimsonScholar.ritual.announcements).toEqual(original); expect(s.crimsonScholar.ritual.reservedEventId).toBeNull();
    s.week = 55; s.actionsRemaining = 1; act(s, { type: 'REQUEST_RITUAL' });
    expect(s.crimsonScholar.ritual.reservedEventId).toBe('wolf-moon-07');
    expect(validateCrimsonScholarState(s)).toBe(true);
  });
  it('publishes one explicit late current+5 event and reuses the unchanged date after cancellation', () => {
    const s = taught(); s.week = 70; act(s, { type: 'REQUEST_RITUAL' });
    const event = structuredClone(s.crimsonScholar.ritual.announcements.at(-1)!);
    expect(event).toMatchObject({ id: 'crimson-scholar-moon-1', week: 75 }); expect(event.source).toContain('第70周公开发布');
    act(s, { type: 'CANCEL_RITUAL' }); s.week = 71; act(s, { type: 'REQUEST_RITUAL' });
    expect(s.crimsonScholar.ritual.announcements).toHaveLength(9); expect(s.crimsonScholar.ritual.announcements.at(-1)).toEqual(event);
    expect(s.crimsonScholar.ritual.reservedEventId).toBe(event.id); expect(validateCrimsonScholarState(s)).toBe(true);
  });
  it('requires actual arrival on the announced week, rejects stale dates and does not convert synthetic fields into a ritual', () => {
    const s = taught(); buy(s); act(s, { type: 'REQUEST_RITUAL' });
    reject(s, { type: 'BEGIN_RITUAL' }); reject(s, { type: 'CONSUME', bottleId: s.crimsonScholar.bottles[0]!.id, confirmed: true });
    s.week = 56; reject(s, { type: 'BEGIN_RITUAL' }); expect(projectCrimsonScholar(s).ritual.reservation).toContain('已错过');
    act(s, { type: 'CANCEL_RITUAL' }); act(s, { type: 'REQUEST_RITUAL' }); s.week = 60;
    s.cash = 149; reject(s, { type: 'BEGIN_RITUAL' }); s.cash = 150; s.actionsRemaining = 0; reject(s, { type: 'BEGIN_RITUAL' });
    s.actionsRemaining = 1; act(s, { type: 'BEGIN_RITUAL' });
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]); expect(projectCrimsonScholar(s).ritual.activeVisit).toContain('真实满月照耀');
  });
  it('actually consumes the unique paid material kit before any potion and never refunds it on zero-action exit', () => {
    const s = prepared(), cash = s.cash, b = s.crimsonScholar.bottles[0]!;
    expect(s.crimsonScholar.ritual.visits[0]).toEqual({ id: 1, eventId: 'wolf-moon-06', week: 55, kitId: 'CS5-KIT-1', consumedBottleId: null, endedWeek: null });
    expect(CRIMSON_SCHOLAR_RITUAL_KIT_SOURCE).toContain('非人幻想生物');
    reject(s, { type: 'CANCEL_RITUAL' }); s.actionsRemaining = 0; act(s, { type: 'END_RITUAL' });
    expect(s.cash).toBe(cash); expect(b.status).toBe('PLAYER'); expect(s.crimsonScholar.ritual.visits[0]!.endedWeek).toBe(55);
    expect(validateCrimsonScholarState(s)).toBe(true); reject(s, { type: 'BEGIN_RITUAL' }); reject(s, { type: 'END_RITUAL' });
    s.actionsRemaining = 2; act(s, { type: 'REQUEST_RITUAL' }); expect(s.crimsonScholar.ritual.reservedEventId).toBe('wolf-moon-07');
  });
  it('allows early acquisition while enforcing S6 digestion100, twelve complete weeks and safe guided resource boundaries', () => {
    const s = professor(); s.week = s.potionProfessor.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateCrimsonScholarState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectCrimsonScholar(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; arrive(s);
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      s.health = health!; s.mind = mind!; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
      expect(b.status).toBe('PLAYER');
    }
    s.health = 100; s.mind = 100; s.actionsRemaining = 0;
    act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(5);
  });
  it('consumes exactly one chosen original and applies all four guided tiers inside an actual visit', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.crimsonScholar.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.crimsonScholar.ritual.visits[0]!.consumedBottleId).toBe(b.id);
      expect(s.crimsonScholar.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      expect(validateCrimsonScholarState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
      act(s, { type: 'END_RITUAL' }); expect(validateCrimsonScholarState(s)).toBe(true);
    }
  });
  it('preserves all four old sequences, adds exactly three zero masteries and four stats without refilling spirit', () => {
    const s = prepared(), old = structuredClone([s.apothecary, s.tamer, s.vampire, s.potionProfessor]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.crimsonScholar.bottles[0]!.id, confirmed: true });
    expect([s.apothecary, s.tamer, s.vampire, s.potionProfessor]).toEqual(old); expect(s.crimsonScholar.potionProfessorActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS, ...VAMPIRE_ABILITY_IDS, ...POTION_PROFESSOR_ABILITY_IDS, ...CRIMSON_SCHOLAR_ABILITY_IDS]);
    expect(CRIMSON_SCHOLAR_ABILITY_IDS).toEqual(['moon.s5.regional-moon', 'moon.s5.moonlight-step', 'moon.s5.moonlight-reassembly']);
    for (const id of CRIMSON_SCHOLAR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(CRIMSON_SCHOLAR_SOURCE_STATUS).toContain('第五部第63章');
    expect(projectCrimsonScholar(s).actions.find(a => a.command.type === 'END_RITUAL')!.enabled).toBe(true);
  });
  it('requires a new future moon event and unique kit for a retry instead of consuming a second bottle during one visit', () => {
    const s = taught(), first = buy(s), second = buy(s, 1); arrive(s);
    act(s, { type: 'CONSUME', bottleId: first.id, confirmed: true }, 85);
    reject(s, { type: 'CONSUME', bottleId: second.id, confirmed: true }); reject(s, { type: 'REQUEST_RITUAL' });
    act(s, { type: 'END_RITUAL' }); arrive(s);
    expect(s.crimsonScholar.ritual.visits[1]).toMatchObject({ id: 2, eventId: 'wolf-moon-07', week: 60, kitId: 'CS5-KIT-2' });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true }); expect(validateCrimsonScholarState(s)).toBe(true);
  });
  it('preserves all failed originals and requires a real later week to receive a paid new supply batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); arrive(s); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); act(s, { type: 'END_RITUAL' }); }
    const originals = structuredClone(s.crimsonScholar.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.crimsonScholar.bottles.slice(0, 3)).toEqual(originals); expect(s.crimsonScholar.bottles).toHaveLength(6);
    expect(s.crimsonScholar.bottles[3]).toMatchObject({ id: 'crimson-scholar-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(validateCrimsonScholarState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects invented or expanded commands and keeps exact life commands outside acquisition', () => {
    for (const command of [null, {}, { type: 'BREW' }, { type: 'BEGIN_RITUAL', kitId: 'invented' }, { type: 'CONSUME', bottleId: 'crimson-scholar-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'potion-professor-potion-1' }, { type: 'RETURN', caseId: 'moonlight-route' }, { type: 'REASSEMBLE', free: true }]) {
      expect(validateCrimsonScholarCommand(command)).toBe(false); expect(isCrimsonScholarAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
    for (const command of [{ type: 'RETURN' }, { type: 'REASSEMBLE' }, { type: 'PREPARE', caseId: 'full-moon', method: 'ABILITY' }]) {
      expect(validateCrimsonScholarCommand(command)).toBe(true); expect(isCrimsonScholarAcquisitionCommand(command)).toBe(false); reject(promoted(), command);
    }
  });
  it('rejects forged ritual sources, kits, duplicate visits and bottle mismatches, and projects isolated current snapshots', () => {
    const s = promoted(), changes: ((t: SliceState) => void)[] = [
      t => { t.crimsonScholar.bottles[0]!.source = 'invented'; },
      t => { t.crimsonScholar.potionProfessorActingAtPromotion = 99; },
      t => { delete t.progression.mastery[APOTHECARY_ABILITY_IDS[0]]; },
      t => { t.crimsonScholar.ritual.announcements[0]!.week = 33; },
      t => { t.crimsonScholar.ritual.announcements[0]!.source = 'invented'; },
      t => { t.crimsonScholar.ritual.visits[0]!.kitId = 'CS5-KIT-2'; },
      t => { t.crimsonScholar.ritual.visits[0]!.consumedBottleId = null; },
      t => { t.crimsonScholar.ritual.visits.push({ ...t.crimsonScholar.ritual.visits[0]!, id: 2, kitId: 'CS5-KIT-2' }); },
      t => { t.crimsonScholar.ritual.activeVisitId = null; },
      t => { (t.crimsonScholar as unknown as Record<string, unknown>).ritual = null; },
      t => { (t.crimsonScholar.ritual.announcements as unknown[])[0] = null; },
      t => { (t.crimsonScholar as unknown as Record<string, unknown>).practice = null; },
      t => { (t.crimsonScholar.cases as unknown as Record<string, unknown>)['full-moon'] = null; },
      t => { (t.crimsonScholar as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateCrimsonScholarState(t)).not.toThrow(); expect(validateCrimsonScholarState(t)).toBe(false); }
    const p = projectCrimsonScholar(s); expect(p).toMatchObject({ promoted: true, insideCase: true, formulaKnown: false, formula: [], practice: { field: 'NONE', location: 'START', outboundTrips: 0, returns: 0, reassemblies: 0, reassembledWeek: null } });
    p.practice!.field = 'FULL'; p.ritual.announcements.length = 0;
    expect(s.crimsonScholar.practice.field).toBe('NONE'); expect(s.crimsonScholar.ritual.announcements).toHaveLength(8);
    expect(p.ritual.history[0]).toContain('CS5-KIT-1');
  });
});
