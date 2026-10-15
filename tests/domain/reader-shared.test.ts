import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState,
} from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { playerAbilityWheel } from '../../src/domain/slice/combat.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createReaderState } from '../../src/domain/reader/index.js';
import { READER_ABILITY_IDS, READER_CASE_IDS } from '../../src/domain/reader/types.js';


const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
interface BoundaryCapture { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
interface NaturalCapture {
  creation: Parameters<typeof createSliceRun>[1];
  seed: string;
  commands: SliceIntent[];
  promoted: SliceState;
  practiced: SliceState;
  combatStart: SliceState;
  terminal: SliceState;
  final: SliceState;
  wrongBoundary: BoundaryCapture;
}
const capture = (): NaturalCapture => currentCapture(JSON.parse(readFileSync(new URL('../fixtures/reader-v0230/shared-stage-natural.json', import.meta.url),'utf8')));
const boundary = (name: 'report' | 'combat'): BoundaryCapture => currentCapture(JSON.parse(readFileSync(new URL(`../fixtures/reader-v0230/shared-${name}-save-boundary.json`, import.meta.url),'utf8')));
const masteryTotal = (s: SliceState) => Object.values(s.progression.mastery).reduce((sum, value) => sum + value, 0);

/** Find a real public command boundary, without manufacturing a promoted state. */
function beforeCommand(predicate: (command: SliceIntent, state: SliceState) => boolean): SliceState {
  const c = capture();
  let s = createSliceRun(c.final.runId, c.creation, c.seed);
  for (const command of c.commands) {
    if (predicate(command, s)) return s;
    s = applySliceIntent(s, command);
  }
  throw new Error('The natural capture is missing the requested public boundary.');
}

describe('Reader actual documents, bounded conclusions and original first-case route', () => {
  it('replays every original creation command and all milestones without replacing the seed or outcome', () => {
    const c = capture();
    let s = createSliceRun(c.final.runId, c.creation, c.seed);
    const milestones = [c.promoted, c.practiced, c.combatStart, c.terminal, c.final];
    const reached = new Set<number>();
    for (const command of c.commands) {
      s = applySliceIntent(s, command);
      assertValidSliceState(s);
      for (const [index, state] of milestones.entries()) if (s.revision === state.revision) {
        expect(s).toEqual(state);
        reached.add(index);
      }
    }
    expect(c.commands).toHaveLength(52);
    expect(s).toEqual(c.final);
    expect(reached.size).toBe(milestones.length);
    expect(s.random.seed).toBe(c.seed);
    expect(c.promoted.progression).toMatchObject({ pathwayId: 'white-tower', sequence: 9, promotionWeek: 5, acting: 0 });
    expect(c.promoted.reader.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'SUCCESS', consumedWeek: 5 });
    expect(Object.keys(s.progression.mastery)).toEqual([...READER_ABILITY_IDS]);
    expect(projectSliceState(s).maxSpirituality).toBe(30);
  });

  it('migrates frozen 0.22 facts by adding only Reader and changing the two version fields', () => {
    const old = JSON.parse(readFileSync(new URL('../fixtures/nightmare-v0220/natural.json', import.meta.url), 'utf8')).final;
    const bytes = JSON.stringify(old);
    expect(old.schemaVersion).toBe(21);
    expect(old.contentVersion).toBe('nightmare-life-v21');
    expect(old).not.toHaveProperty('reader');
    const next = migrateSliceState(old);
    const { reader, schemaVersion, contentVersion, ...rest } = next;
    const { schemaVersion: oldSchema, contentVersion: oldContent, ...prior } = old;
    expectPriorFields(next,old);
    expect([oldSchema, oldContent]).toEqual([21, 'nightmare-life-v21']);
    expect([schemaVersion,contentVersion]).toEqual([177,'blood-duke-v177']);
    expect(reader).toEqual(createReaderState());
    assertValidSliceState(next);
    expect(migrateSliceState(next)).toEqual(next);
    expect(JSON.stringify(old)).toBe(bytes);
  });

  it('reaches peaceful digestion100 through three finite reports and reflection, without performing a ritual', () => {
    const c = capture(), s = c.practiced, p = projectSliceState(s);
    assertValidSliceState(s);
    expect(s.status).toBe('ACTIVE');
    expect(s.health).toBeGreaterThan(0);
    expect(s.progression).toMatchObject({ pathwayId: 'white-tower', sequence: 9, acting: 100 });
    expect(Object.keys(s.progression.mastery)).toEqual([...READER_ABILITY_IDS]);
    expect(masteryTotal(s) - masteryTotal(c.promoted)).toBe(24);
    expect(s.reader.reflected).toBe(true);
    for (const caseId of READER_CASE_IDS) {
      expect(s.reader.cases[caseId]).toMatchObject({ status: 'RESOLVED', conclusion: 'LIMITED' });
      expect(s.reader.cases[caseId]!.attemptWeek).not.toBeNull();
      expect(s.seer.completedSources.filter(source => source === `reader-case:${caseId}`)).toHaveLength(1);
      expect(p.reader.cases.find(entry => entry.id === caseId)!.result).toEqual(expect.any(String));
    }
    expect(s.seer.completedSources.filter(source => source === 'reader-reflection')).toHaveLength(1);
    expect(s.seer.completedSources).not.toContain('first-case-combat');
    expect(s.combat).toBeNull();
    expect(s.combatHistory).toEqual([]);
    expect(s.reader.bottles).toEqual(c.promoted.reader.bottles);
    expect(s.town).toEqual(c.promoted.town);
    expect(p.reader.abilities.map(ability => ability.id)).toEqual([...READER_ABILITY_IDS]);
    expect(p.reader).toMatchObject({ formulaKnown: false, formula: [], acting: 100 });
    expect(p.reader.cases.find(entry => entry.id === 'ritual-margin')!.result).toContain('没有补造材料、符咒或施法效果');
    expect(p.town.items.some(item => /符咒|仪式材料/.test(item.label))).toBe(false);
    expect(Object.hasOwn(s.reader, 'encounter')).toBe(false);
  });

  it('hides unread documents and unanalyzed conclusions instead of giving knowledge from a case title', () => {
    const s = capture().promoted, before = structuredClone(s), p = projectSliceState(s).reader;
    expect(p.cases.map(entry => entry.id)).toEqual([...READER_CASE_IDS]);
    for (const caseId of READER_CASE_IDS) {
      expect(p.cases.find(entry => entry.id === caseId)).toMatchObject({ status: 'AVAILABLE', documents: [], analysis: null, result: null });
      expect(() => applySliceIntent(s, { type: 'READER', command: { type: 'ANALYZE', caseId } })).toThrow();
      expect(() => applySliceIntent(s, { type: 'READER', command: { type: 'SUBMIT', caseId, conclusion: 'LIMITED' } })).toThrow();
      const read = beforeCommand((command, state) => command.type === 'READER' && command.command.type === 'ANALYZE'
        && command.command.caseId === caseId && state.reader.cases[caseId]!.status === 'READ');
      const visible = projectSliceState(read).reader.cases.find(entry => entry.id === caseId)!;
      expect(visible.documents).toHaveLength(2);
      expect(visible.analysis).toBeNull();
      expect(visible.result).toBeNull();
      expect(() => applySliceIntent(read, { type: 'READER', command: { type: 'SUBMIT', caseId, conclusion: 'LIMITED' } })).toThrow();
    }
    expect(s).toEqual(before);
  });

  it('spends one real AP on the unsupported CERTAIN report, preserves its mistake and requires later-week rechecking', () => {
    const wrong = currentCapture(capture().wrongBoundary), original = structuredClone(wrong.beforeLast);
    expect(wrong.lastIntent).toEqual({ type: 'READER', command: { type: 'SUBMIT', caseId: 'shift-ledger', conclusion: 'CERTAIN' } });
    const next = applySliceIntent(wrong.beforeLast, wrong.lastIntent);
    assertValidSliceState(next);
    expect(next).toEqual(wrong.final);
    expect(wrong.beforeLast).toEqual(original);
    expect(next.week).toBe(original.week);
    expect(next.actionsRemaining).toBe(original.actionsRemaining - 1);
    expect(next.reader.cases['shift-ledger']).toMatchObject({ status: 'READ', conclusion: 'CERTAIN', mistakes: 1, attemptWeek: original.week });
    expect(next.progression).toEqual(original.progression);
    expect(next.seer.completedSources).toEqual(original.seer.completedSources);
    expect(next.random).toEqual(original.random);
    expect(next.reader.bottles).toEqual(original.reader.bottles);
    expect(next.world).toEqual(original.world);
    expect(projectSliceState(next).reader.cases.find(entry => entry.id === 'shift-ledger')).toMatchObject({ status: 'READ', analysis: null, result: expect.any(String) });
    expect(() => applySliceIntent(next, { type: 'READER', command: { type: 'ANALYZE', caseId: 'shift-ledger' } })).toThrow('下周补核');
    expect(() => applySliceIntent(next, { type: 'READER', command: { type: 'SUBMIT', caseId: 'shift-ledger', conclusion: 'LIMITED' } })).toThrow();
    const recheck = beforeCommand((command, state) => state.revision > next.revision && command.type === 'READER'
      && command.command.type === 'ANALYZE' && command.command.caseId === 'shift-ledger');
    expect(recheck.week).toBeGreaterThan(next.reader.cases['shift-ledger']!.attemptWeek!);
    expect(applySliceIntent(recheck, { type: 'READER', command: { type: 'ANALYZE', caseId: 'shift-ledger' } }).reader.cases['shift-ledger']!.mistakes).toBe(1);
    expect(capture().practiced.reader.cases['shift-ledger']).toMatchObject({ status: 'RESOLVED', conclusion: 'LIMITED', mistakes: 1 });
  });

  it('cannot replay completed cases or reflection, or delete, duplicate or fabricate their sources', () => {
    const original = capture().practiced, s = structuredClone(original);
    for (const caseId of READER_CASE_IDS) {
      for (const type of ['READ', 'ANALYZE'] as const) expect(() => applySliceIntent(s, { type: 'READER', command: { type, caseId } })).toThrow();
      for (const conclusion of ['LIMITED', 'CERTAIN'] as const) expect(() => applySliceIntent(s, { type: 'READER', command: { type: 'SUBMIT', caseId, conclusion } })).toThrow();
    }
    expect(() => applySliceIntent(s, { type: 'READER', command: { type: 'REFLECT' } })).toThrow();
    expect(s).toEqual(original);
    for (const source of [...READER_CASE_IDS.map(id => `reader-case:${id}`), 'reader-reflection']) {
      const missing = structuredClone(original);
      missing.seer.completedSources = missing.seer.completedSources.filter(id => id !== source);
      expect(() => assertValidSliceState(missing)).toThrow();
      const duplicate = structuredClone(original);
      duplicate.seer.completedSources.push(source);
      expect(() => assertValidSliceState(duplicate)).toThrow();
    }
    const forged = capture().promoted;
    forged.seer.completedSources.push('reader-case:shift-ledger');
    expect(() => assertValidSliceState(forged)).toThrow();
  });

  it('uses the actual held original club in FIRST_CASE and preserves the captured five-round death', () => {
    const c = capture(), s = c.combatStart, final = c.terminal, before = structuredClone(final);
    expect(s.combat?.encounterId).toBe('FIRST_CASE');
    expect(s.town.clubLocation).toBe('HAND');
    expect(projectSliceState(s).town.items.filter(item => item.id === 'town-short-club')).toEqual([
      expect.objectContaining({ quantity: 1, owner: 'PLAYER', location: 'HAND', equipped: true }),
    ]);
    expect(playerAbilityWheel(s, null).find(entry => entry.id === 'reader.s9.ritual-tool')!.label).toContain('原短棍');
    expect(final.combatHistory).toHaveLength(5);
    expect(final.combatHistory.some(round => round.moves.some(move => move.actor === 'PLAYER' && move.label.includes('持握原短棍打击')))).toBe(true);
    expect(final).toMatchObject({ status: 'DEAD', health: 0, combat: null, ending: { kind: 'DEATH' } });
    expect(final.reader).toEqual(c.practiced.reader);
    expect(final.town).toEqual(s.town);
    expect(final.progression.acting).toBe(100);
    expect(c.final).toEqual(final);
    for (const intent of [
      { type: 'CONTINUE_LIFE' }, { type: 'ACTION', action: 'REST' }, { type: 'COMBAT_ROUND', stance: 'ATTACK' },
    ] as const) expect(() => applySliceIntent(final, intent)).toThrow();
    expect(final).toEqual(before);
    expect(projectSliceState(final).canAct).toBe(false);
  });

  it('replays the actual report and lethal combat save boundaries while conserving originals and histories', () => {
    for (const name of ['report', 'combat'] as const) {
      const c = boundary(name), before = structuredClone(c.beforeLast);
      assertValidSliceState(c.beforeLast);
      const next = applySliceIntent(c.beforeLast, c.lastIntent);
      assertValidSliceState(next);
      expect(next).toEqual(c.final);
      expect(c.beforeLast).toEqual(before);
      expect(next.reader.bottles).toEqual(before.reader.bottles);
      expect(next.reader.resupply).toEqual(before.reader.resupply);
      expect(next.town).toEqual(before.town);
      expect(Object.keys(next.progression.mastery)).toEqual([...READER_ABILITY_IDS]);
      if (name === 'report') {
        expect(c.lastIntent).toEqual({ type: 'READER', command: { type: 'SUBMIT', caseId: 'shift-ledger', conclusion: 'LIMITED' } });
        expect(next.reader.cases['shift-ledger']).toMatchObject({ status: 'RESOLVED', conclusion: 'LIMITED', mistakes: 1 });
        expect(next.progression.acting).toBe(before.progression.acting + 25);
        expect(masteryTotal(next) - masteryTotal(before)).toBe(8);
        expect(next.seer.completedSources).toEqual([...before.seer.completedSources, 'reader-case:shift-ledger']);
        expect(next.combatHistory).toEqual(before.combatHistory);
      } else {
        expect(c.lastIntent.type).toBe('COMBAT_ROUND');
        expect(before.combat?.encounterId).toBe('FIRST_CASE');
        expect(next.combatHistory.slice(0, -1)).toEqual(before.combatHistory);
        expect(next.combatHistory).toHaveLength(before.combatHistory.length + 1);
        expect(next.reader).toEqual(before.reader);
        expect(next.progression).toEqual(before.progression);
        expect(next).toMatchObject({ status: 'DEAD', health: 0, combat: null, ending: { kind: 'DEATH' } });
      }
      expect(() => applySliceIntent(next, c.lastIntent)).toThrow();
    }
  });
});
