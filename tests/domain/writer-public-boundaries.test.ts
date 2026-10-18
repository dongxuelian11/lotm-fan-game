import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import {
  WRITER_COUNT_WHEEL, WRITER_ENEMY_COUNT_WHEEL, WRITER_ENEMY_ABILITY_WHEEL,
  projectWriterAction, projectWriterCombat, projectWriterRoundOutcome,
  type WriterActionEvidence, type WriterRoundOutcome,
} from '../../src/domain/writer/combat.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const ROOT = 'tests/fixtures/writer-v01880';
const naturalFile = `${ROOT}/natural.json`;
const captured = () => readObjectEntry<SliceState>(naturalFile, 'final');
const capturedLive = () => readObjectEntry<SliceState>(`${ROOT}/boundary-combat-round-2.json`, 'final');
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const fileDigest = () => createHash('sha256').update(readFileSync(naturalFile)).digest('hex');
const rounds = (state: SliceState) => state.combatHistory.filter(round => round.writerOutcome);
function withoutActionReplay(action: WriterActionEvidence) {
  const { randomCursorBefore: _before, randomCursorAfter: _after, ...facts } = structuredClone(action);
  return facts;
}
function withoutOutcomeReplay(outcome: WriterRoundOutcome) {
  const { source: _source, randomCursorAfter: _cursor, playerActions, enemyActions, ...facts } = structuredClone(outcome);
  return { ...facts, playerActions: playerActions.map(withoutActionReplay), enemyActions: enemyActions.map(withoutActionReplay) };
}
function assertPublicOnly(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((child, index) => assertPublicOnly(child, `${path}[${index}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(['randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'preparation', 'privateProbe', 'privateMastery'].includes(key), `${path}.${key}`).toBe(false);
    // A resolved check's public explanation is also named "source".
    if (key === 'source') expect(path, `${path}.${key}`).toMatch(/\.check\.modifiers\[\d+\]$/);
    assertPublicOnly(child, `${path}.${key}`);
  }
}
function objects(value: unknown, found = new Set<object>()): Set<object> {
  if (!value || typeof value !== 'object' || found.has(value)) return found;
  found.add(value); Object.values(value).forEach(child => objects(child, found)); return found;
}
function assertDetached(output: unknown, input: unknown): void {
  const originals = objects(input);
  for (const object of objects(output)) expect(originals.has(object), 'public objects must not alias their input').toBe(false);
}
function injectPrivateFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(injectPrivateFields); return; }
  for (const [key, child] of Object.entries(value)) {
    // Leave the real replay source intact in the hostile copy, too.
    if (key !== 'source') injectPrivateFields(child);
  }
  Object.assign(value, { privateProbe: { randomSeed: 'must-stay-private', randomCursor: 1234 } });
}

describe('Writer S1 public evidence allowlists', () => {
  it('preserves every resolved fact from all five real rounds and the original death terminal', () => {
    // Read the original capture directly, without campaign replay or a fixture rewrite.
    const state = captured(), before = digest(state), bytes = fileDigest(), random = structuredClone(state.random);
    const history = rounds(state);
    expect(history).toHaveLength(5);
    expect(state.status).toBe('DEAD'); expect(state.health).toBe(0);
    expect(state.writer.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', round: 5 });
    expect(state.random.cursor).toBe(537);
    for (const round of history) {
      const outcome = round.writerOutcome!, source = stableStringify(outcome.source);
      expect(outcome.source.randomSeed).toBe(state.random.seed);
      expect(outcome.source.preparation.randomSeed).toBe(state.random.seed);
      const projected = projectWriterRoundOutcome(outcome);
      expect(projected).toEqual(withoutOutcomeReplay(outcome));
      expect(projected.materialsAfter).toEqual(outcome.materialsAfter);
      expect(projected.rootAfter).toEqual(outcome.rootAfter);
      expect(projected.masteryAfter).toEqual(outcome.masteryAfter);
      expect(projected.windowsAfter).toEqual(outcome.windowsAfter);
      expect(projected.pendingEnemyActionAfter).toBeNull();
      assertPublicOnly(projected); assertDetached(projected, outcome);
      expect(stableStringify(outcome.source)).toBe(source);
    }
    expect(state.random).toEqual(random);
    expect(digest(state)).toBe(before);
    expect(fileDigest()).toBe(bytes);
  });

  it('keeps resolved checks, public modifier sources, costs, resistance, names and pending facts', () => {
    const state = captured();
    const original = rounds(state).flatMap(round => round.writerOutcome!.playerActions).find(action => action.check)!;
    expect(original).toBeDefined();
    const action = structuredClone(original);
    action.check = { ...action.check!, modifiers: [{ source: '公开检定修正说明', value: 0 }] };
    const before = digest(action), projected = projectWriterAction(action);
    expect(projected).toEqual(withoutActionReplay(action));
    expect(projected.check).toEqual(action.check);
    expect(projected.check!.modifiers).toEqual([{ source: '公开检定修正说明', value: 0 }]);
    for (const round of rounds(state)) for (const evidence of [...round.writerOutcome!.playerActions, ...round.writerOutcome!.enemyActions]) {
      const facts = projectWriterAction(evidence);
      expect(facts).toMatchObject({ paidCost: evidence.paidCost, mindCost: evidence.mindCost, resistanceRoll: evidence.resistanceRoll,
        resistanceChance: evidence.resistanceChance, finiteResult: evidence.finiteResult, wardAbsorption: evidence.wardAbsorption,
        playerObservationGain: evidence.playerObservationGain, knownPlayerName: evidence.knownPlayerName, learnedClue: evidence.learnedClue,
        atSeconds: evidence.atSeconds, travelMetres: evidence.travelMetres });
      expect(facts.windowsBefore).toEqual(evidence.windowsBefore); expect(facts.windowsAfter).toEqual(evidence.windowsAfter);
      expect(facts.pendingBefore).toEqual(evidence.pendingBefore); expect(facts.pendingAfter).toEqual(evidence.pendingAfter);
    }
    assertPublicOnly({ action: projected }); assertDetached(projected, action);
    expect(digest(action)).toBe(before);
  });

  it('rejects unknown nested fields while retaining every allowed field and unchanged private sources', () => {
    const state = captured(); let checks = 0, windows = 0, pending = 0, injuries = 0;
    for (const round of rounds(state)) {
      const outcome = structuredClone(round.writerOutcome!), source = stableStringify(outcome.source);
      for (const action of [...outcome.playerActions, ...outcome.enemyActions]) {
        if (action.check) { action.check = { ...action.check, modifiers: [{ source: '公开来源不是私有重放来源', value: 0 }] }; checks++; }
        if (action.pendingBefore) pending++;
      }
      windows += outcome.expiredWindows.length; injuries += outcome.enemyInjuries.length + outcome.playerInjuriesAfter.length;
      const expected = withoutOutcomeReplay(outcome);
      injectPrivateFields(outcome); outcome.masteryAfter.privateMastery = 42;
      const before = digest(outcome), projected = projectWriterRoundOutcome(outcome);
      expect(projected).toEqual(expected);
      assertPublicOnly(projected); assertDetached(projected, outcome);
      expect(stableStringify(outcome.source)).toBe(source);
      expect(digest(outcome)).toBe(before);
    }
    expect(checks).toBeGreaterThan(0); expect(windows).toBeGreaterThan(0);
    expect(pending).toBeGreaterThan(0); expect(injuries).toBeGreaterThan(0);
  });

  it('allowlists all four window kinds without stripping words from public names or explanations', () => {
    // An explicitly synthetic projection probe, separate from the immutable actual campaign.
    const outcome = structuredClone(rounds(captured())[0]!.writerOutcome!);
    const action = outcome.playerActions.find(candidate => candidate.check && candidate.pendingBefore)!;
    const text = 'source randomSeed randomCursor preparation 莉娜';
    action.knownPlayerName = text; action.learnedClue = text; action.label = text;
    outcome.rootAfter.knownPlayerName = text;
    action.check = { ...action.check!, modifiers: [{ source: text, value: 0 }] };
    action.pendingBefore!.visibleIntent = text;
    action.pendingAfter = structuredClone(action.pendingBefore);
    const template = outcome.expiredWindows[0]!;
    for (const [key, kind] of [['ward', 'WARD'], ['attention', 'ATTENTION'], ['reciprocal', 'RECIPROCAL'], ['arrangement', 'ARRANGEMENT']] as const) {
      const window = { ...template, id: `public-${kind}`, kind, targetActionId: action.pendingBefore!.id };
      action.windowsBefore[key] = structuredClone(window); action.windowsAfter[key] = structuredClone(window);
      outcome.windowsAfter[key] = structuredClone(window); outcome.expiredWindows.push(structuredClone(window));
    }
    const expected = withoutOutcomeReplay(outcome);
    injectPrivateFields(outcome);
    const projected = projectWriterRoundOutcome(outcome), publicAction = projected.playerActions.find(candidate => candidate.order === action.order)!;
    expect(projected).toEqual(expected);
    expect(projected.rootAfter.knownPlayerName).toBe(text); expect(publicAction.knownPlayerName).toBe(text);
    expect(publicAction.check!.modifiers[0]!.source).toBe(text); expect(publicAction.pendingBefore!.visibleIntent).toBe(text);
    expect(Object.values(publicAction.windowsAfter).map(window => window!.kind)).toEqual(['WARD', 'ATTENTION', 'RECIPROCAL', 'ARRANGEMENT']);
    assertPublicOnly(projected); assertDetached(projected, outcome);
  });

  it('uses the same detached public action mapping for live and terminal lastActionSequence', () => {
    const terminal = captured(), live = capturedLive();
    expect(terminal.combat).toBeNull(); expect(live.combat?.encounterId).toBe('WRITER_DISPUTE');
    for (const state of [live, terminal]) {
      const before = digest(state), panel = projectWriterCombat(state), repeated = projectWriterCombat(state);
      const outcome = (state.combat?.lastRound ?? state.combatHistory[state.writer.encounter.terminal!.historyIndex])!.writerOutcome!;
      expect(panel.lastActionSequence).toEqual([...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order).map(withoutActionReplay));
      expect(panel.materials).toEqual(state.writer.encounter.materials);
      expect(panel.powerUses).toEqual(state.writer.encounter.powerUses);
      assertPublicOnly(panel); assertDetached(panel, state); assertDetached(panel, repeated);
      assertDetached(panel.countWheel, WRITER_COUNT_WHEEL);
      assertDetached(panel.enemyCountWheel, WRITER_ENEMY_COUNT_WHEEL);
      assertDetached(panel.enemyAbilityWheel, WRITER_ENEMY_ABILITY_WHEEL);
      assertDetached(panel.countWheel, panel.enemyCountWheel);
      panel.lastActionSequence[0]!.label = 'public copy only';
      panel.materials.weapon.location = 'COURT'; panel.powerUses.WARD++; panel.countWheel[0]!.weight = 0;
      const pending = panel.lastActionSequence.find(action => action.pendingBefore);
      if (pending) pending.pendingBefore!.visibleIntent = 'public copy only';
      const window = panel.lastActionSequence.flatMap(action => Object.values(action.windowsBefore)).find(Boolean);
      if (window) window.magnitude++;
      const checked = panel.lastActionSequence.find(action => action.check);
      if (checked) Object.assign(checked.check!, { roll: 1 });
      expect(projectWriterCombat(state)).toEqual(repeated);
      expect(digest(state)).toBe(before);
    }
  });

  it('allowlists nested panel materials, known power counts and wheel entries', () => {
    const state = captured(), expected = projectWriterCombat(state);
    injectPrivateFields(state.writer.encounter.materials); injectPrivateFields(state.writer.encounter.powerUses);
    const outcome = state.combatHistory[state.writer.encounter.terminal!.historyIndex]!.writerOutcome!;
    injectPrivateFields(outcome);
    const before = digest(state);
    const wheelBefore = digest([WRITER_COUNT_WHEEL, WRITER_ENEMY_COUNT_WHEEL, WRITER_ENEMY_ABILITY_WHEEL]);
    const actual = projectWriterCombat(state);
    expect(actual).toEqual(expected); assertPublicOnly(actual); assertDetached(actual, state);
    for (const wheel of [actual.countWheel, actual.enemyCountWheel, actual.enemyAbilityWheel]) {
      for (const entry of wheel) expect(Object.keys(entry).sort()).toEqual(['id', 'label', 'weight']);
    }
    expect(digest([WRITER_COUNT_WHEEL, WRITER_ENEMY_COUNT_WHEEL, WRITER_ENEMY_ABILITY_WHEEL])).toBe(wheelBefore);
    expect(digest(state)).toBe(before);
  });

  it.each(['lastCombatRound', 'combatHistory', 'combat.lastRound'] as const)('routes current %s through the safe mapper without rewriting the original capture', entry => {
    const bytes = fileDigest(), raw = entry === 'combat.lastRound' ? capturedLive() : captured(), original = digest(raw);
    // Only the current global projection needs migration; direct evidence tests above use the original capture.
    const state = migrateSliceState(raw), before = digest(state), rng = structuredClone(state.random), view = projectSliceState(state);
    const expected = projectWriterRoundOutcome(state.lastCombatRound!.writerOutcome!);
    if (entry === 'lastCombatRound') {
      expect(view.lastCombatRound!.writerOutcome).toEqual(expected);
      assertPublicOnly(view.lastCombatRound!.writerOutcome); assertDetached(view.lastCombatRound!.writerOutcome, state);
      expect(view.status).toBe('DEAD'); expect(view.health).toBe(0);
    } else if (entry === 'combatHistory') {
      const history = view.combatHistory.filter(round => round.writerOutcome);
      expect(history).toHaveLength(5); expect(history.at(-1)!.writerOutcome).toEqual(expected);
      history.forEach((round, index) => {
        expect(round.writerOutcome).toEqual(projectWriterRoundOutcome(rounds(state)[index]!.writerOutcome!));
        assertPublicOnly(round.writerOutcome); assertDetached(round.writerOutcome, state);
      });
    } else {
      expect(view.combat).not.toBeNull(); expect(view.combat!.lastRound!.writerOutcome).toEqual(expected);
      assertPublicOnly(view.combat!.lastRound!.writerOutcome); assertDetached(view.combat!.lastRound!.writerOutcome, state);
      assertPublicOnly(view.combat!.writer); assertDetached(view.combat!.writer, state);
    }
    expect(state.random).toEqual(rng); expect(digest(state)).toBe(before);
    expect(digest(raw)).toBe(original); expect(fileDigest()).toBe(bytes);
  });
});
