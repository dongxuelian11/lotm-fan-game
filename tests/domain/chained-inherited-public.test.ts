import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { projectAbominationCombat, projectAbominationRoundOutcome } from '../../src/domain/abomination/combat.js';
import { projectAncientEvilCombat, projectAncientEvilRoundOutcome } from '../../src/domain/ancient-evil/combat.js';
import { projectPuppetRoundOutcome, projectSilentDiscipleRoundOutcome } from '../../src/domain/ancient-evil/public.js';
import { projectAbominationPreparation } from '../../src/domain/abomination/encounter.js';
import { projectAncientEvilPreparation } from '../../src/domain/ancient-evil/encounter.js';
import { projectAbominationLifeReceipt } from '../../src/domain/abomination/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const file = 'tests/fixtures/abomination-v02030/natural.json';
const hash = (x: unknown) => createHash('sha256').update(stableStringify(x)).digest('hex');
const load = (entry: 'final' | 'beforeLast' | 'prefixFinal' = 'final') => migrateSliceState(readObjectEntry<SliceState>(file, entry));
const forbidden = new Set(['seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'futureRoll', 'nextRoll', 'futurePrivate', 'sourceDigest', 'identityDigest', 'historyDigest']);
/** Display source strings and settled rolls remain public; replay source objects do not. */
function privatePaths(value: unknown): string[] {
  const paths: string[] = [];
  function walk(v: unknown, path: string): void {
    if (!v || typeof v !== 'object') return;
    for (const [key, child] of Object.entries(v)) {
      const at = `${path}.${key}`;
      if (forbidden.has(key) || key === 'source' && child !== null && typeof child === 'object') paths.push(at);
      walk(child, at);
    }
  }
  walk(value, '$'); return paths;
}
function inject(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value)) inject(child);
  if (!Array.isArray(value)) Object.assign(value, { futurePrivate: 'PRIVATE-FUTURE', randomSeed: 'PRIVATE-SEED', randomCursor: 987654, sourceDigest: 'PRIVATE-DIGEST' });
}
function noSecrets(value: unknown): void {
  expect(privatePaths(value)).toEqual([]);
  expect(JSON.stringify(value)).not.toContain('prisoner-natural-v057');
  expect(JSON.stringify(value)).not.toContain('PRIVATE-');
}

describe('Chained genuine inherited public boundary', () => {
  it('pins the untouched 203 source and scans actual final, preceding and S2 prefix projections without mutating private state', () => {
    expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe('0d99439f4e950a633e20fdba372fb0e59beb41982ccff5fe6a27fd2834adf442');
    // These are saved terminal/boundary snapshots, never relabelled live-combat fixtures.
    for (const [entry, revision, week, sequence, cursor, rounds] of [['beforeLast', 778, 175, 1, 291, 18], ['final', 779, 175, 1, 291, 18], ['prefixFinal', 643, 148, 2, 228, 14]] as const) {
      const s = load(entry), before = hash(s), p = projectSliceState(s);
      expect(s).toMatchObject({ revision, week, status: 'ACTIVE', progression: { pathwayId: 'chained', sequence }, random: { seed: 'prisoner-natural-v057', cursor } });
      expect(s.combat).toBeNull(); expect(p.combat).toBeNull(); expect(s.combatHistory).toHaveLength(rounds);
      expect(p.progression.mastery).toEqual(s.progression.mastery);
      noSecrets(p); expect(hash(s)).toBe(before);
    }
  }, 60_000);

  it('uses the public mapper for genuine saved outcomes and the same central active-round entry', () => {
    const s = load(), before = hash(s), p = projectSliceState(s), raw = s.lastCombatRound!.abominationOutcome!;
    const expected = projectPlayerText(projectAbominationRoundOutcome(raw), s.character.name);
    expect(p.lastCombatRound!.abominationOutcome).toEqual(expected);
    expect(p.combatHistory.at(-1)!.abominationOutcome).toEqual(expected);
    for (const [index, round] of s.combatHistory.entries()) {
      if (round.abominationOutcome) expect(p.combatHistory[index]!.abominationOutcome).toEqual(projectPlayerText(projectAbominationRoundOutcome(round.abominationOutcome), s.character.name));
      if (round.ancientEvilOutcome) expect(p.combatHistory[index]!.ancientEvilOutcome).toEqual(projectPlayerText(projectAncientEvilRoundOutcome(round.ancientEvilOutcome), s.character.name));
      if (round.puppetOutcome) expect(p.combatHistory[index]!.puppetOutcome).toEqual(projectPlayerText(projectPuppetRoundOutcome(round.puppetOutcome), s.character.name));
      if (round.silentDiscipleOutcome) expect(p.combatHistory[index]!.silentDiscipleOutcome).toEqual(projectPlayerText(projectSilentDiscipleRoundOutcome(round.silentDiscipleOutcome), s.character.name));
    }
    // No live-combat checkpoint exists in this source. Inspect its real entry wiring,
    // rather than manufacturing a body or replaying the full campaign for this test.
    const wiring = readFileSync('src/domain/slice/index.ts', 'utf8');
    for (const entry of ['lastRound:publicCombatRound(s.combat.lastRound)', 'lastCombatRound:publicCombatRound(s.lastCombatRound)', 'combatHistory:s.combatHistory.map(round=>publicCombatRound(round)!']) expect(wiring).toContain(entry);
    const panel = projectAbominationCombat(s);
    expect(panel).not.toHaveProperty('source'); noSecrets(panel);
    expect(panel.lastActionSequence.map(a => [a.paidCost, a.mindCost, a.pieceChargePaid, a.pieceWearPaid])).toEqual([...raw.playerActions, ...raw.enemyActions].sort((a, b) => a.order - b.order).map(a => [a.paidCost, a.mindCost, a.pieceChargePaid, a.pieceWearPaid]));
    noSecrets(projectAncientEvilCombat(load('prefixFinal'))); expect(hash(s)).toBe(before);
  }, 60_000);

  it('positively selects round and action evidence while retaining physical bodies, ownership, costs and settled rolls', () => {
    const s = load(), before = hash(s), abomination = s.lastCombatRound!.abominationOutcome!;
    const ancient = s.combatHistory.find(r => r.ancientEvilOutcome)!.ancientEvilOutcome!;
    const abominationPublic = projectAbominationRoundOutcome(abomination), ancientPublic = projectAncientEvilRoundOutcome(ancient);
    expect(abominationPublic.siteAfter).toEqual(abomination.siteAfter); expect(abominationPublic.operationAfter).toEqual(abomination.operationAfter);
    expect(abominationPublic.masteryAfter).toEqual(abomination.masteryAfter); expect(abominationPublic.piece).toEqual(abomination.piece); expect(abominationPublic.plates).toEqual(abomination.plates);
    expect(ancientPublic.rootAfter).toEqual(ancient.rootAfter); expect(ancientPublic.blocks).toEqual(ancient.blocks);
    for (const [original, visible] of [[abomination.playerActions, abominationPublic.playerActions], [abomination.enemyActions, abominationPublic.enemyActions], [ancient.playerActions, ancientPublic.playerActions], [ancient.enemyActions, ancientPublic.enemyActions]] as const) {
      for (const [index, action] of original.entries()) {
        const { randomCursorBefore, randomCursorAfter, ...facts } = action;
        expect(visible[index]).toEqual(facts); expect(Number.isInteger(randomCursorBefore)).toBe(true); expect(Number.isInteger(randomCursorAfter)).toBe(true);
      }
    }
    const poisonedAbomination = structuredClone(abomination); inject(poisonedAbomination);
    expect(projectAbominationRoundOutcome(poisonedAbomination)).toEqual(abominationPublic); noSecrets(projectAbominationRoundOutcome(poisonedAbomination));
    const poisonedAncient = structuredClone(ancient); inject(poisonedAncient);
    expect(projectAncientEvilRoundOutcome(poisonedAncient)).toEqual(ancientPublic); noSecrets(projectAncientEvilRoundOutcome(poisonedAncient));
    for (const round of s.combatHistory) {
      if (round.puppetOutcome) { const { source, ...facts } = round.puppetOutcome; expect(source).toBeTruthy(); expect(projectPuppetRoundOutcome(round.puppetOutcome)).toEqual(facts); }
      if (round.silentDiscipleOutcome) { const { source, ...facts } = round.silentDiscipleOutcome; expect(source).toBeTruthy(); expect(projectSilentDiscipleRoundOutcome(round.silentDiscipleOutcome)).toEqual(facts); }
    }
    expect(abomination.source.randomSeed).toBe(s.random.seed); expect(hash(s)).toBe(before);
  }, 60_000);

  it('removes preparation and life-receipt replay authority while preserving all actual payments and original objects', () => {
    const s = load(), before = hash(s), abomination = s.abomination.encounter.preparation!, ancient = s.ancientEvil.encounter.preparation!;
    const { runId: abominationRun, randomSeed: abominationSeed, randomCursor: abominationCursor, ...abominationFacts } = abomination;
    const { runId: ancientRun, randomSeed: ancientSeed, randomCursor: ancientCursor, ...ancientFacts } = ancient;
    const abominationPublic = projectAbominationPreparation(abomination), ancientPublic = projectAncientEvilPreparation(ancient);
    expect(abominationPublic).toEqual(abominationFacts); expect(ancientPublic).toEqual(ancientFacts);
    expect(abominationPublic.pricePaid).toBe(30); expect(abominationPublic.actionsPaid).toBe(1); expect(ancientPublic.mindPaid).toBe(2);
    expect(abominationRun).toBe(s.runId); expect(ancientRun).toBe(s.runId); expect(abominationSeed).toBe(s.random.seed); expect(ancientSeed).toBe(s.random.seed);
    expect(Number.isInteger(abominationCursor)).toBe(true); expect(Number.isInteger(ancientCursor)).toBe(true);
    const poisonedAbomination = structuredClone(abomination); inject(poisonedAbomination); expect(projectAbominationPreparation(poisonedAbomination)).toEqual(abominationPublic);
    const poisonedAncient = structuredClone(ancient); inject(poisonedAncient); expect(projectAncientEvilPreparation(poisonedAncient)).toEqual(ancientPublic);
    for (const receipt of s.abomination.life.journal) {
      const { randomCursor, randomBefore, randomAfter, source, ...facts } = receipt, visible = projectAbominationLifeReceipt(receipt);
      expect(visible).toEqual(facts); noSecrets(visible);
      expect(Number.isInteger(randomCursor)).toBe(true); expect(randomBefore === null || typeof randomBefore === 'number').toBe(true); expect(randomAfter === null || typeof randomAfter === 'number').toBe(true); expect(source === null || typeof source === 'object').toBe(true);
      const poisoned = structuredClone(receipt); inject(poisoned); expect(projectAbominationLifeReceipt(poisoned)).toEqual(visible);
    }
    noSecrets(abominationPublic); noSecrets(ancientPublic); expect(hash(s)).toBe(before);
  }, 60_000);

  it('keeps legitimate modifier source strings and known check evidence', () => {
    const s = load(), before = hash(s), receipt = structuredClone(s.abomination.life.journal.find(r => r.check)!);
    receipt.check!.modifiers.push({ source: '同一原纸已实际核对', value: 3 });
    const visible = projectAbominationLifeReceipt(receipt);
    expect(visible.check!.modifiers).toEqual(receipt.check!.modifiers); expect(visible.check!.roll).toBe(receipt.check!.roll); expect(visible.resistanceRoll).toBe(receipt.resistanceRoll);
    noSecrets(visible); expect(hash(s)).toBe(before);
  }, 60_000);
});
