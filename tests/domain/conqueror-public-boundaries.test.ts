import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import {
  CONQUEROR_COUNT_WHEEL, CONQUEROR_ENEMY_COUNT_WHEEL, CONQUEROR_ENEMY_ABILITY_WHEEL,
  projectConquerorAction, projectConquerorCombat, projectConquerorRoundOutcome,
  type ConquerorActionEvidence, type ConquerorRoundOutcome,
} from '../../src/domain/conqueror/combat.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const ROOT = 'tests/fixtures/conqueror-v01870';
const naturalFile = `${ROOT}/natural.json`;
const captured = () => readObjectEntry<SliceState>(naturalFile, 'final');
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const fileDigest = () => createHash('sha256').update(readFileSync(naturalFile)).digest('hex');
const rounds = (state: SliceState) => state.combatHistory.filter(round => round.conquerorOutcome);
function withoutActionReplay(action: ConquerorActionEvidence) {
  const { randomCursorBefore: _before, randomCursorAfter: _after, ...facts } = structuredClone(action);
  return facts;
}
function withoutOutcomeReplay(outcome: ConquerorRoundOutcome) {
  const { source: _source, randomCursorAfter: _cursor, playerActions, enemyActions, ...facts } = structuredClone(outcome);
  return { ...facts, playerActions: playerActions.map(withoutActionReplay), enemyActions: enemyActions.map(withoutActionReplay) };
}
function assertPublicOnly(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((child, index) => assertPublicOnly(child, `${path}[${index}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(['randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'preparation', 'privateProbe', 'privateMastery'].includes(key), `${path}.${key}`).toBe(false);
    // Resolved check modifiers retain their public explanation named "source".
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
    // Keep the real replay source exactly as captured, even in the hostile copy.
    if (key !== 'source') injectPrivateFields(child);
  }
  Object.assign(value, { privateProbe: { randomSeed: 'must-stay-private', randomCursor: 1234 } });
}

describe('Conqueror S1 public evidence allowlists', () => {
  it('preserves every resolved fact from all eight real rounds without source or RNG data', () => {
    // Read the original capture directly: no campaign replay, fixture rewrite or RNG draw.
    const state = captured(), before = digest(state), bytes = fileDigest(), random = structuredClone(state.random);
    const history = rounds(state);
    expect(history).toHaveLength(8);
    for (const round of history) {
      const outcome = round.conquerorOutcome!, source = stableStringify(outcome.source);
      expect(outcome.source.randomSeed).toBe(state.random.seed);
      expect(outcome.source.preparation.randomSeed).toBe(state.random.seed);
      const projected = projectConquerorRoundOutcome(outcome);
      expect(projected).toEqual(withoutOutcomeReplay(outcome));
      expect(projected.materialsAfter).toEqual(outcome.materialsAfter);
      expect(projected.rootAfter).toEqual(outcome.rootAfter);
      expect(projected.masteryAfter).toEqual(outcome.masteryAfter);
      assertPublicOnly(projected); assertDetached(projected, outcome);
      expect(stableStringify(outcome.source)).toBe(source);
    }
    expect(state.random).toEqual(random);
    expect(digest(state)).toBe(before);
    expect(fileDigest()).toBe(bytes);
  });

  it('keeps resolved checks, public modifier sources, costs, and material provenance and positions', () => {
    const state = captured();
    const original = rounds(state).flatMap(round => round.conquerorOutcome!.playerActions).find(action => action.check)!;
    expect(original).toBeDefined();
    const action = structuredClone(original);
    action.check = { ...action.check!, modifiers: [{ source: '公开检定修正说明', value: 0 }] };
    const before = digest(action), projected = projectConquerorAction(action);
    expect(projected).toEqual(withoutActionReplay(action));
    expect(projected.check).toEqual(action.check);
    expect(projected.check!.modifiers).toEqual([{ source: '公开检定修正说明', value: 0 }]);
    for (const round of rounds(state)) for (const evidence of [...round.conquerorOutcome!.playerActions, ...round.conquerorOutcome!.enemyActions]) {
      const facts = projectConquerorAction(evidence);
      expect(facts).toMatchObject({ paidCost: evidence.paidCost, mindCost: evidence.mindCost, materialSourceId: evidence.materialSourceId,
        heatingDegrees: evidence.heatingDegrees, coolingLitres: evidence.coolingLitres, atSeconds: evidence.atSeconds, travelMetres: evidence.travelMetres });
      expect(facts.materialsBefore).toEqual(evidence.materialsBefore);
      expect(facts.materialsAfter).toEqual(evidence.materialsAfter);
    }
    assertPublicOnly({ action: projected }); assertDetached(projected, action);
    expect(digest(action)).toBe(before);
  });

  it('rejects unknown nested fields while retaining every allowed field and unchanged private sources', () => {
    const state = captured(); let checks = 0, wards = 0, injuries = 0;
    for (const round of rounds(state)) {
      const outcome = structuredClone(round.conquerorOutcome!), source = stableStringify(outcome.source);
      for (const action of [...outcome.playerActions, ...outcome.enemyActions]) if (action.check) {
        action.check = { ...action.check, modifiers: [{ source: '公开来源不是私有重放来源', value: 0 }] }; checks++;
      }
      wards += outcome.expiredWards.length; injuries += outcome.enemyInjuries.length + outcome.playerInjuriesAfter.length;
      const expected = withoutOutcomeReplay(outcome);
      injectPrivateFields(outcome); outcome.masteryAfter.privateMastery = 42;
      const before = digest(outcome), projected = projectConquerorRoundOutcome(outcome);
      expect(projected).toEqual(expected);
      assertPublicOnly(projected); assertDetached(projected, outcome);
      expect(stableStringify(outcome.source)).toBe(source);
      expect(digest(outcome)).toBe(before);
    }
    expect(checks).toBeGreaterThan(0); expect(wards).toBeGreaterThan(0); expect(injuries).toBeGreaterThan(0);
  });

  it('uses the same detached public action mapping for live and terminal lastActionSequence', () => {
    const terminal = captured();
    const live = readObjectEntry<SliceState>(`${ROOT}/boundary-combat-round-2.json`, 'final');
    expect(terminal.combat).toBeNull(); expect(live.combat?.encounterId).toBe('CONQUEROR_DISPUTE');
    for (const state of [live, terminal]) {
      const before = digest(state), panel = projectConquerorCombat(state), repeated = projectConquerorCombat(state);
      const outcome = (state.combat?.lastRound ?? state.combatHistory[state.conqueror.encounter.terminal!.historyIndex])!.conquerorOutcome!;
      expect(panel.lastActionSequence).toEqual([...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order).map(withoutActionReplay));
      expect(panel.materials).toEqual(state.conqueror.encounter.materials);
      expect(panel.powerUses).toEqual(state.conqueror.encounter.powerUses);
      assertPublicOnly(panel); assertDetached(panel, state); assertDetached(panel, repeated);
      assertDetached(panel.countWheel, CONQUEROR_COUNT_WHEEL);
      assertDetached(panel.enemyCountWheel, CONQUEROR_ENEMY_COUNT_WHEEL);
      assertDetached(panel.enemyAbilityWheel, CONQUEROR_ENEMY_ABILITY_WHEEL);
      assertDetached(panel.countWheel, panel.enemyCountWheel);
      panel.lastActionSequence[0]!.label = 'public copy only';
      panel.lastActionSequence[0]!.materialsAfter.weapon.temperatureC++;
      panel.materials.water.remainingLitres--; panel.powerUses.WARD++; panel.countWheel[0]!.weight = 0;
      const checked = panel.lastActionSequence.find(action => action.check);
      if (checked) Object.assign(checked.check!, { roll: 1 });
      expect(projectConquerorCombat(state)).toEqual(repeated);
      expect(digest(state)).toBe(before);
    }
  });

  it('whitelists nested panel materials, known power counts and wheel entries', () => {
    const state = captured(), expected = projectConquerorCombat(state);
    injectPrivateFields(state.conqueror.encounter.materials); injectPrivateFields(state.conqueror.encounter.powerUses);
    const outcome = state.combatHistory[state.conqueror.encounter.terminal!.historyIndex]!.conquerorOutcome!;
    injectPrivateFields(outcome);
    const before = digest(state);
    const wheelBefore = digest([CONQUEROR_COUNT_WHEEL, CONQUEROR_ENEMY_COUNT_WHEEL, CONQUEROR_ENEMY_ABILITY_WHEEL]);
    const actual = projectConquerorCombat(state);
    expect(actual).toEqual(expected); assertPublicOnly(actual); assertDetached(actual, state);
    for (const wheel of [actual.countWheel, actual.enemyCountWheel, actual.enemyAbilityWheel]) {
      for (const entry of wheel) expect(Object.keys(entry).sort()).toEqual(['id', 'label', 'weight']);
    }
    expect(digest([CONQUEROR_COUNT_WHEEL, CONQUEROR_ENEMY_COUNT_WHEEL, CONQUEROR_ENEMY_ABILITY_WHEEL])).toBe(wheelBefore);
    expect(digest(state)).toBe(before);
  });
  it('routes current last, history and active combat through the same safe mapper without rewriting the original capture', () => {
    const originalBytes = fileDigest();
    for (const raw of [captured(), readObjectEntry<SliceState>(`${ROOT}/boundary-combat-round-2.json`, 'final')]) {
      const state = migrateSliceState(raw), before = digest(state), rng = structuredClone(state.random);
      const view = projectSliceState(state);
      const last = view.lastCombatRound!.conquerorOutcome!;
      assertPublicOnly(last);
      const original = state.lastCombatRound!.conquerorOutcome!;
      expect(last.materialsAfter).toEqual(original.materialsAfter);
      expect(last.rootAfter).toEqual(original.rootAfter);
      expect(last.playerHealthAfter).toBe(original.playerHealthAfter);
      expect(last.playerSpiritualityAfter).toBe(original.playerSpiritualityAfter);
      const history = view.combatHistory.filter(round => round.conquerorOutcome);
      expect(history.at(-1)!.conquerorOutcome).toEqual(last);
      history.forEach(round => assertPublicOnly(round.conquerorOutcome));
      if (view.combat) {
        expect(view.combat.lastRound!.conquerorOutcome).toEqual(last);
        assertPublicOnly(view.combat.conqueror);
      }
      expect(state.random).toEqual(rng); expect(digest(state)).toBe(before);
    }
    expect(fileDigest()).toBe(originalBytes);
  });

});
