import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { projectMercurySnakeCombat, projectMercurySnakeRoundOutcome } from '../../src/domain/mercury-snake/combat.js';
import { projectMercurySnakePreparation, projectMercurySnakeEncounter } from '../../src/domain/mercury-snake/encounter.js';
import { projectMercurySnakeLife, projectMercurySnakeLifeReceipt } from '../../src/domain/mercury-snake/life.js';
import { projectMercurySnakeCombatRound, projectMercurySnakeLastCheck, projectFateProphetRoundOutcome, projectChaosWalkerRoundOutcome, projectMisfortuneMageRoundOutcome } from '../../src/domain/mercury-snake/public.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const file = 'tests/fixtures/mercury-snake-v02040/natural.json';
const fileHash = '6d4542561817368ec18b535ee6195084412f97f356c00d511b8cf57c8198d574';
const hash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const load = () => migrateSliceState(readObjectEntry<SliceState>(file, 'final'));
const privateKeys = new Set(['seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'preparationRoll', 'futureRoll', 'nextRoll', 'futurePrivate', 'sourceDigest', 'identityDigest', 'historyDigest']);
function privatePaths(value: unknown): string[] {
  const paths: string[] = [];
  function walk(v: unknown, path: string): void {
    if (!v || typeof v !== 'object') return;
    for (const [key, child] of Object.entries(v)) {
      const at = `${path}.${key}`;
      if (privateKeys.has(key) || key === 'source' && child !== null && typeof child === 'object') paths.push(at);
      walk(child, at);
    }
  }
  walk(value, '$'); return paths;
}
function noSecrets(value: unknown): void {
  expect(privatePaths(value)).toEqual([]);
  expect(JSON.stringify(value)).not.toContain('monster-natural-v060');
  expect(JSON.stringify(value)).not.toContain('PRIVATE-FUTURE');
}
function inject(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value)) inject(child);
  if (!Array.isArray(value)) Object.assign(value, { futurePrivate: 'PRIVATE-FUTURE', randomSeed: 'PRIVATE-FUTURE', randomCursor: 987654, preparationRoll: 99 });
}
/** Expected historical facts, independent of the production positive allowlists. */
function publicFacts(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicFacts);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key, child]) => !privateKeys.has(key) && !(key === 'source' && child !== null && typeof child === 'object')).map(([key, child]) => [key, publicFacts(child)]));
}

describe('Wheel of Fortune genuine 204 inherited public evidence', () => {
  it('pins the authentic 841-command final and checks the whole migrated public projection without changing private history', () => {
    expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(fileHash);
    const s = load(), before = hash(s), random = structuredClone(s.random), p = projectSliceState(s);
    expect(s).toMatchObject({ revision: 842, week: 202, status: 'ACTIVE', health: 90, mind: 88, spirituality: 86, cash: 20, actionsRemaining: 3, progression: { pathwayId: 'wheel', sequence: 1 }, random: { seed: 'monster-natural-v060', cursor: 306 } });
    expect(s.combat).toBeNull(); expect(p.combat).toBeNull(); expect(s.combatHistory).toHaveLength(19);
    expect(p.progression.mastery).toEqual(s.progression.mastery);
    noSecrets(p); expect(hash(s)).toBe(before); expect(s.random).toEqual(random);
  }, 60_000);

  it('projects all four genuinely inherited outcome shapes through the central history and last-round entries', () => {
    const s = load(), before = hash(s), p = projectSliceState(s);
    const counts = { misfortuneMageOutcome: 0, chaosWalkerOutcome: 0, fateProphetOutcome: 0, mercurySnakeOutcome: 0 };
    for (const [index, round] of s.combatHistory.entries()) {
      const visible = projectMercurySnakeCombatRound(round);
      for (const key of Object.keys(counts) as (keyof typeof counts)[]) {
        if (!round[key]) continue;
        counts[key]++;
        expect(visible[key]).toEqual(publicFacts(round[key]));
        expect(p.combatHistory[index]![key]).toEqual(projectPlayerText(visible[key], s.character.name));
        noSecrets(visible[key]);
      }
    }
    expect(counts).toEqual({ misfortuneMageOutcome: 2, chaosWalkerOutcome: 5, fateProphetOutcome: 3, mercurySnakeOutcome: 2 });
    const raw = s.lastCombatRound!.mercurySnakeOutcome!, expected = projectMercurySnakeRoundOutcome(raw);
    expect(p.lastCombatRound!.mercurySnakeOutcome).toEqual(projectPlayerText(expected, s.character.name));
    expect(p.combatHistory.at(-1)!.mercurySnakeOutcome).toEqual(p.lastCombatRound!.mercurySnakeOutcome);
    // The source has no live-combat save. Check the same active-round wiring rather than relabelling the terminal body.
    const wiring = readFileSync('src/domain/slice/index.ts', 'utf8');
    for (const entry of ['lastRound:publicCombatRound(s.combat.lastRound)', 'lastCombatRound:publicCombatRound(s.lastCombatRound)', 'combatHistory:s.combatHistory.map(round=>publicCombatRound(round)!']) expect(wiring).toContain(entry);
    expect(hash(s)).toBe(before);
  }, 60_000);

  it('rejects added nested private fields while preserving every legal cost, position, injury, original object and settled roll', () => {
    const s = load(), original = hash(s);
    for (const round of s.combatHistory) {
      if (round.mercurySnakeOutcome) {
        const raw = structuredClone(round.mercurySnakeOutcome), expected = projectMercurySnakeRoundOutcome(raw); inject(raw);
        const before = hash(raw), sourceBefore = hash(raw.source), p = projectMercurySnakeRoundOutcome(raw);
        expect(p).toEqual(expected); noSecrets(p); expect(hash(raw)).toBe(before); expect(hash(raw.source)).toBe(sourceBefore);
      }
      if (round.fateProphetOutcome) {
        const raw = structuredClone(round.fateProphetOutcome), expected = projectFateProphetRoundOutcome(raw); inject(raw);
        const before = hash(raw), sourceBefore = hash(raw.source), p = projectFateProphetRoundOutcome(raw);
        expect(p).toEqual(expected); noSecrets(p); expect(hash(raw)).toBe(before); expect(hash(raw.source)).toBe(sourceBefore);
      }
      if (round.chaosWalkerOutcome) {
        const raw = structuredClone(round.chaosWalkerOutcome), expected = projectChaosWalkerRoundOutcome(raw); inject(raw);
        const before = hash(raw), p = projectChaosWalkerRoundOutcome(raw); expect(p).toEqual(expected); noSecrets(p); expect(hash(raw)).toBe(before);
      }
      if (round.misfortuneMageOutcome) {
        const raw = structuredClone(round.misfortuneMageOutcome), expected = projectMisfortuneMageRoundOutcome(raw); inject(raw);
        const before = hash(raw), p = projectMisfortuneMageRoundOutcome(raw); expect(p).toEqual(expected); noSecrets(p); expect(hash(raw)).toBe(before);
      }
    }
    expect(hash(s)).toBe(original);
  }, 60_000);

  it('keeps preparation costs and original custody, and exposes detached action evidence in both existing panels', () => {
    const s = load(), before = hash(s), raw = s.mercurySnake.encounter.preparation!;
    const visible = projectMercurySnakePreparation(raw), { runId, randomSeed, randomCursor, ...facts } = raw;
    expect(visible).toEqual(publicFacts(facts)); expect(runId).toBe(s.runId); expect(randomSeed).toBe(s.random.seed); expect(Number.isInteger(randomCursor)).toBe(true);
    expect(visible).toMatchObject({ pricePaid: 30, actionsPaid: 1 });
    expect(visible.site.cart).toEqual(raw.site.cart); expect(visible.site.parcel).toEqual(raw.site.parcel); expect(visible.site.tags).toEqual(raw.site.tags);
    expect(visible.operation.mechanical).not.toHaveProperty('preparationRoll');
    const poisoned = structuredClone(raw); inject(poisoned); const poisonedBefore = hash(poisoned);
    expect(projectMercurySnakePreparation(poisoned)).toEqual(visible); expect(hash(poisoned)).toBe(poisonedBefore);
    const last = s.lastCombatRound!.mercurySnakeOutcome!, expected = [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order).map(publicFacts);
    const panel = projectMercurySnakeCombat(s), encounter = projectMercurySnakeEncounter(s);
    expect(panel).not.toHaveProperty('source'); expect(panel.lastActionSequence).toEqual(expected); expect(encounter.lastActionSequence).toEqual(expected);
    noSecrets(panel); noSecrets(encounter); expect(hash(s)).toBe(before);
  }, 60_000);

  it('preserves all 64 actual life receipts and legitimate modifier source text without future stream authority', () => {
    const s = load(), before = hash(s), journal = s.mercurySnake.life.journal;
    expect(journal).toHaveLength(64);
    expect(projectMercurySnakeLife(s).ledger).toEqual(journal.map(projectMercurySnakeLifeReceipt));
    for (const original of journal) {
      const raw = structuredClone(original), expected = projectMercurySnakeLifeReceipt(raw); inject(raw); const privateBefore = hash(raw);
      expect(projectMercurySnakeLifeReceipt(raw)).toEqual(expected); noSecrets(expected); expect(hash(raw)).toBe(privateBefore);
    }
    const receipt = structuredClone(journal.find(r => r.check)!);
    const label = 'source randomSeed randomCursor preparationRoll 是合法的公开检定说明';
    receipt.check!.modifiers.push({ source: label, value: 3 });
    const projected = projectMercurySnakeLifeReceipt(receipt);
    expect(projected.check!.modifiers).toEqual(receipt.check!.modifiers); expect(projected.check!.roll).toBe(receipt.check!.roll); noSecrets(projected);
    const probe = structuredClone(s); probe.lastCheck = receipt.check;
    expect(projectMercurySnakeLastCheck(probe)).toEqual(receipt.check); expect(projectMercurySnakeLastCheck(probe)!.modifiers.at(-1)!.source).toBe(label);
    expect(hash(s)).toBe(before); expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(fileHash);
  }, 60_000);
});
