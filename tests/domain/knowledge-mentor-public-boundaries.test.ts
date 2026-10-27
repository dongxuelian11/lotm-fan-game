import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import {
  projectKnowledgeMentorCombat, projectKnowledgeMentorRoundOutcome, validateKnowledgeMentorRoundOutcome,
  type KnowledgeMentorRoundOutcome,
} from '../../src/domain/knowledge-mentor/combat.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

// Read the original CE campaign's four inherited S2 rounds. Never rewrite or
// regenerate this capture to manufacture different rolls, resources or history.
const FILE = 'tests/fixtures/civilization-enlightener-v01890/natural.json';
const FILE_HASH = '5d7a97347f8a555c91c7b1a57dc4acdebd78f3ac36414e1674d2bb5d34cc835f';
const captured = () => readObjectEntry<SliceState>(FILE, 'final');
const digest = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');
const fileDigest = () => createHash('sha256').update(readFileSync(FILE)).digest('hex');
const rounds = (s: SliceState) => s.combatHistory.filter(r => r.knowledgeMentorOutcome);
const publicFacts = (o: KnowledgeMentorRoundOutcome) => {
  const { source: _source, randomCursorAfter: _cursor, ...facts } = structuredClone(o);
  return facts;
};
function assertPublicOnly(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((child, i) => assertPublicOnly(child, `${path}[${i}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(['randomSeed', 'randomCursor', 'randomBefore', 'randomAfter', 'randomCursorBefore', 'randomCursorAfter',
      'sourceRecord', 'sourceHistory', 'historyDigest', 'privateProbe', 'unexpectedField'].includes(key), `${path}.${key}`).toBe(false);
    // Actual material provenance and public check explanations retain "source".
    if (key === 'source') expect(path, `${path}.${key}`).toMatch(/(?:\.creations\[\d+\]|\.combatPlates\[\d+\]|\.check\.modifiers\[\d+\])$/);
    assertPublicOnly(child, `${path}.${key}`);
  }
}
function objects(value: unknown, found = new Set<object>()): Set<object> {
  if (!value || typeof value !== 'object' || found.has(value)) return found;
  found.add(value); Object.values(value).forEach(child => objects(child, found)); return found;
}
function assertDetached(output: unknown, input: unknown): void {
  const originals = objects(input);
  for (const object of objects(output)) expect(originals.has(object), 'public facts must not alias private evidence').toBe(false);
}
function injectPrivateFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(injectPrivateFields); return; }
  Object.entries(value).forEach(([key, child]) => { if (key !== 'source') injectPrivateFields(child); });
  Object.assign(value, { unexpectedField: 'private extension', historyDigest: 'private history', privateProbe: { randomSeed: 'private', randomCursor: 1000 } });
}

describe('Knowledge Mentor historical public evidence allowlists', () => {
  it('preserves all four inherited rounds and every resolved fact without replay source or stream offsets', () => {
    expect(fileDigest()).toBe(FILE_HASH);
    const state = captured(), before = digest(state), random = structuredClone(state.random);
    expect(state.combatHistory.flatMap((r, i) => r.knowledgeMentorOutcome ? [i] : [])).toEqual([20, 21, 22, 23]);
    for (const round of rounds(state)) {
      const outcome = round.knowledgeMentorOutcome!, source = stableStringify(outcome.source);
      expect(validateKnowledgeMentorRoundOutcome(outcome)).toBe(true);
      expect(outcome.source.randomSeed).toBe(state.random.seed);
      const projected = projectKnowledgeMentorRoundOutcome(outcome);
      expect(projected).toEqual(publicFacts(outcome)); assertPublicOnly(projected); assertDetached(projected, outcome);
      expect(stableStringify(outcome.source)).toBe(source);
    }
    expect(state.random).toEqual(random); expect(digest(state)).toBe(before); expect(fileDigest()).toBe(FILE_HASH);
  });

  it('retains actual costs, resolved rolls, injuries, original provenance, plate checks and legal modifier sources', () => {
    const state = captured(), before = digest(state), text = 'source randomSeed randomCursor randomBefore randomAfter 的公开说明';
    const outcomes = rounds(state).map(r => structuredClone(r.knowledgeMentorOutcome!));
    expect(outcomes.at(-1)!.powerUses).toEqual({ ARC_BOLT: 4, WARD: 2, JAM: 2 });
    expect(outcomes.at(-1)!).toMatchObject({ protocolUses: 1, calibrationUses: 1, totalOwnerMindSpent: 1, enemyHealth: 0, enemySpirituality: 74 });
    for (const outcome of outcomes) {
      outcome.combatPlates[0]!.check = { ...outcome.combatPlates[0]!.check, modifiers: [{ source: text, value: 0 }] };
      const projected = projectKnowledgeMentorRoundOutcome(outcome);
      expect(projected).toEqual(publicFacts(outcome));
      expect(projected.combatPlates[0]!.check.modifiers[0]!.source).toBe(text);
      expect(projected.combatPlates[0]).toMatchObject({ paidPennies: 60, spiritualitySpent: 4, actionsSpent: 1, boundObjectIds: ['AL4-BOX-1', 'AL4-FRAME-1'] });
      expect(projected.creations).toEqual(outcome.creations);
      expect(projected.playerActions.map(a => [a.paidCost, a.mentalCost, a.boxChargeSpent, a.frameChargeSpent, a.rolls])).toEqual(outcome.playerActions.map(a => [a.paidCost, a.mentalCost, a.boxChargeSpent, a.frameChargeSpent, a.rolls]));
      assertPublicOnly(projected); assertDetached(projected, outcome);
    }
    expect(digest(state)).toBe(before);
  });

  it('drops undeclared nested fields while preserving raw replay validation, source and hashes', () => {
    for (const round of rounds(captured())) {
      const outcome = structuredClone(round.knowledgeMentorOutcome!), source = stableStringify(outcome.source);
      outcome.combatPlates[0]!.check = { ...outcome.combatPlates[0]!.check, modifiers: [{ source: '公开检定来源', value: 0 }] };
      const expected = publicFacts(outcome); injectPrivateFields(outcome);
      const before = digest(outcome), projected = projectKnowledgeMentorRoundOutcome(outcome);
      expect(projected).toEqual(expected); assertPublicOnly(projected); assertDetached(projected, outcome);
      expect(validateKnowledgeMentorRoundOutcome(outcome)).toBe(false);
      expect(stableStringify(outcome.source)).toBe(source); expect(digest(outcome)).toBe(before);
    }
  });

  it('uses detached nested facts in the current combat panel and omits its private replay source', () => {
    const state = captured(), before = digest(state), panel = projectKnowledgeMentorCombat(state), repeated = projectKnowledgeMentorCombat(state);
    expect(panel.powerUses).toEqual(state.knowledgeMentor.encounter.powerUses);
    expect(panel.creations).toEqual(state.alchemist.life.creations);
    expect(panel.combatPlates).toEqual(state.knowledgeMentor.encounter.carriedPlateIds.map(id => state.knowledgeMentor.life.combatPlates.find(p => p.id === id)));
    assertPublicOnly(panel); assertDetached(panel, state); assertDetached(panel, repeated);
    panel.creations[0]!.componentIds.push('public-only'); panel.combatPlates[0]!.boundObjectIds.pop();
    expect(projectKnowledgeMentorCombat(state)).toEqual(repeated); expect(digest(state)).toBe(before);
    injectPrivateFields(state.knowledgeMentor.encounter.powerUses); injectPrivateFields(state.alchemist.life.creations); injectPrivateFields(state.knowledgeMentor.life.combatPlates);
    const injected = digest(state), safe = projectKnowledgeMentorCombat(state);
    expect(safe).toEqual(repeated); assertPublicOnly(safe); expect(digest(state)).toBe(injected);
  });

  it.each(['lastCombatRound', 'combatHistory', 'combat.lastRound'] as const)('routes current %s through the mapper without changing the original capture or RNG', entrance => {
    const raw = captured(), original = digest(raw), state = migrateSliceState(raw);
    // These are projection-only entrance probes using the unchanged historical
    // round, not a replay, a new campaign outcome or a replacement fixture.
    const round = structuredClone(rounds(state)[0]!), outcome = round.knowledgeMentorOutcome!;
    if (entrance === 'lastCombatRound') state.lastCombatRound = round;
    if (entrance === 'combat.lastRound') state.combat = { encounterId: 'KNOWLEDGE_MENTOR_DISPUTE', round: outcome.round + 1,
      enemyHealth: outcome.enemyHealth, enemyMind: outcome.enemyMind, enemyInjuries: structuredClone(outcome.enemyInjuriesAfter),
      enemyRisk: outcome.enemyRiskAfter, enemyStatus: outcome.enemyStatus, lastRound: round };
    const before = digest(state), random = structuredClone(state.random), view = projectSliceState(state);
    const expected = projectPlayerText(projectKnowledgeMentorRoundOutcome(outcome), state.character.name);
    if (entrance === 'combatHistory') {
      const history = view.combatHistory.filter(r => r.knowledgeMentorOutcome);
      expect(history).toHaveLength(4);
      history.forEach((entry, i) => {
        expect(entry.knowledgeMentorOutcome).toEqual(projectPlayerText(projectKnowledgeMentorRoundOutcome(rounds(state)[i]!.knowledgeMentorOutcome!), state.character.name));
        assertPublicOnly(entry.knowledgeMentorOutcome);
      });
    } else {
      const actual = entrance === 'lastCombatRound' ? view.lastCombatRound?.knowledgeMentorOutcome : view.combat?.lastRound?.knowledgeMentorOutcome;
      expect(actual).toEqual(expected); assertPublicOnly(actual);
      if (entrance === 'combat.lastRound') { expect(view.combat?.knowledgeMentor).toBeDefined(); assertPublicOnly(view.combat!.knowledgeMentor); }
    }
    expect(state.random).toEqual(random); expect(digest(state)).toBe(before); expect(digest(raw)).toBe(original); expect(fileDigest()).toBe(FILE_HASH);
  });

  it('preserves custom names and ordinary source/cursor words in legal public text', () => {
    const raw = captured(), original = digest(raw), state = migrateSliceState(raw);
    const name = 'source randomSeed randomCursor 原创G 维拉'; state.character.name = name;
    for (const round of rounds(state)) {
      const outcome = round.knowledgeMentorOutcome!;
      outcome.playerActions[0]!.label = name; outcome.creations[0]!.source = `公开材料来源 ${name}`;
      outcome.combatPlates[0]!.check = { ...outcome.combatPlates[0]!.check, modifiers: [{ source: name, value: 0 }] };
    }
    const before = digest(state), view = projectSliceState(state);
    expect(view.character.name).toBe(name);
    for (const round of view.combatHistory.filter(r => r.knowledgeMentorOutcome)) {
      expect(round.knowledgeMentorOutcome!.playerActions[0]!.label).toBe(name);
      expect(round.knowledgeMentorOutcome!.creations[0]!.source).toBe(`公开材料来源 ${name}`);
      expect(round.knowledgeMentorOutcome!.combatPlates[0]!.check.modifiers[0]!.source).toBe(name);
      assertPublicOnly(round.knowledgeMentorOutcome);
    }
    expect(digest(state)).toBe(before); expect(digest(raw)).toBe(original); expect(fileDigest()).toBe(FILE_HASH);
  });
});
