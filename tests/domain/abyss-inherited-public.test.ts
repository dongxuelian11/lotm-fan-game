import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { projectDevilRoundOutcome } from '../../src/domain/devil/combat.js';
import { projectUncleanMonarchCombat, projectUncleanMonarchRoundOutcome } from '../../src/domain/unclean-monarch/combat.js';
import { projectUncleanMonarchPreparation } from '../../src/domain/unclean-monarch/encounter.js';
import { projectUncleanMonarchLifeReceipt } from '../../src/domain/unclean-monarch/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const file = 'tests/fixtures/unclean-monarch-v02020/natural.json';
const hash = (x: unknown) => createHash('sha256').update(stableStringify(x)).digest('hex');
const load = (entry: 'final' | 'beforeLast' = 'final') => migrateSliceState(readObjectEntry<SliceState>(file, entry));
const forbidden = new Set(['seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'futureRoll', 'nextRoll', 'futurePrivate', 'sourceDigest', 'identityDigest', 'historyDigest']);
/** A source string (including a paid check modifier) is a display fact, not a replay source object. */
function privatePaths(value: unknown): string[] {
  const paths: string[] = [];
  function walk(v: unknown, path: string) {
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
function noSecrets(value: unknown) {
  expect(privatePaths(value)).toEqual([]);
  expect(JSON.stringify(value)).not.toContain('criminal-natural-v054');
  expect(JSON.stringify(value)).not.toContain('PRIVATE-');
}

describe('Abyss genuine inherited public boundary', () => {
  it('pins the actual source and scans the entire final and immediately preceding public projections without changing private state', () => {
    expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe('44f863ff2286be6aff77275d5c8455b2641680214d5b879e285d9d976b6d3ada');
    // The captured command count is 821: its final revision is 822; beforeLast is revision 821.
    // Neither terminal snapshot is relabelled or rebuilt as an active combat fixture.
    for (const [entry, revision] of [['beforeLast', 821], ['final', 822]] as const) {
      const s = load(entry), before = hash(s), p = projectSliceState(s);
      expect(s).toMatchObject({ revision, week: 198, status: 'ACTIVE', progression: { pathwayId: 'abyss', sequence: 1 }, random: { seed: 'criminal-natural-v054', cursor: 145 } });
      expect(s.combat).toBeNull(); expect(p.combat).toBeNull(); expect(s.combatHistory).toHaveLength(6);
      expect(p.progression.mastery).toEqual(s.progression.mastery);
      expect(p.uncleanMonarch.life.site).toEqual(s.uncleanMonarch.encounter.currentSite);
      expect(p.uncleanMonarch.life.operation).toEqual(s.uncleanMonarch.life.operation);
      expect(s.bloodDuke.encounter.preparation).toBeNull(); // No invented Blood Duke encounter sample.
      noSecrets(p); expect(hash(s)).toBe(before);
    }
  }, 60_000);

  it('maps actual final/history rounds and verifies the same mapper is wired at the active combat entry', () => {
    const s = load(), before = hash(s), p = projectSliceState(s), raw = s.lastCombatRound!.uncleanMonarchOutcome!;
    const expected = projectPlayerText(projectUncleanMonarchRoundOutcome(raw), s.character.name);
    expect(p.lastCombatRound!.uncleanMonarchOutcome).toEqual(expected);
    expect(p.combatHistory.at(-1)!.uncleanMonarchOutcome).toEqual(expected);
    for (const [index, round] of s.combatHistory.entries()) {
      if (round.uncleanMonarchOutcome) expect(p.combatHistory[index]!.uncleanMonarchOutcome).toEqual(projectPlayerText(projectUncleanMonarchRoundOutcome(round.uncleanMonarchOutcome), s.character.name));
      if (round.devilOutcome) expect(p.combatHistory[index]!.devilOutcome).toEqual(projectPlayerText(projectDevilRoundOutcome(round.devilOutcome), s.character.name));
    }
    // There is no saved live-combat checkpoint in this inherited fixture. Verify that
    // entry's actual wiring, rather than manufacturing one or replaying a second campaign.
    const wiring = readFileSync('src/domain/slice/index.ts', 'utf8');
    for (const entry of ['lastRound:publicCombatRound(s.combat.lastRound)', 'lastCombatRound:publicCombatRound(s.lastCombatRound)', 'combatHistory:s.combatHistory.map(round=>publicCombatRound(round)!']) expect(wiring).toContain(entry);
    const panel = projectUncleanMonarchCombat(s);
    expect(panel).not.toHaveProperty('source'); noSecrets(panel);
    expect(panel.lastActionSequence.map(a => [a.paidCost, a.mindCost, a.pieceChargePaid, a.pieceWearPaid])).toEqual([...raw.playerActions, ...raw.enemyActions].sort((a, b) => a.order - b.order).map(a => [a.paidCost, a.mindCost, a.pieceChargePaid, a.pieceWearPaid]));
    expect(hash(s)).toBe(before);
  }, 60_000);

  it('selects each round and nested action positively while retaining original locations, costs, settled rolls and mastery', () => {
    const s = load(), before = hash(s);
    const raw = s.lastCombatRound!.uncleanMonarchOutcome!, expected = projectUncleanMonarchRoundOutcome(raw);
    expect(expected.siteAfter).toEqual(raw.siteAfter); expect(expected.operationAfter).toEqual(raw.operationAfter);
    expect(expected.masteryAfter).toEqual(raw.masteryAfter); expect(expected.pieceAfter).toEqual(raw.pieceAfter); expect(expected.platesAfter).toEqual(raw.platesAfter);
    for (const [index, action] of expected.playerActions.entries()) {
      const original = raw.playerActions[index]!;
      const { randomCursorBefore, randomCursorAfter, ...facts } = original;
      expect(action).toEqual(facts); expect(Number.isInteger(randomCursorBefore)).toBe(true); expect(Number.isInteger(randomCursorAfter)).toBe(true);
    }
    for (const [index, action] of expected.enemyActions.entries()) {
      const { randomCursorBefore, randomCursorAfter, ...facts } = raw.enemyActions[index]!;
      expect(action).toEqual(facts); expect(Number.isInteger(randomCursorBefore)).toBe(true); expect(Number.isInteger(randomCursorAfter)).toBe(true);
    }
    const injected = structuredClone(raw); inject(injected);
    expect(projectUncleanMonarchRoundOutcome(injected)).toEqual(expected); noSecrets(projectUncleanMonarchRoundOutcome(injected));
    const devil = s.combatHistory.find(r => r.devilOutcome)!.devilOutcome!, originalDevil = projectDevilRoundOutcome(devil);
    const { source, ...devilFacts } = devil; expect(source).toBeTruthy(); expect(originalDevil).toEqual(devilFacts);
    const injectedDevil = structuredClone(devil); inject(injectedDevil);
    expect(projectDevilRoundOutcome(injectedDevil)).toEqual(originalDevil); noSecrets(projectDevilRoundOutcome(injectedDevil));
    expect(raw.source.randomSeed).toBe(s.random.seed); expect(hash(s)).toBe(before);
  }, 60_000);

  it('omits independent preparation and receipt authority fields while retaining every actual payment and original object', () => {
    const s = load(), before = hash(s), preparation = s.uncleanMonarch.encounter.preparation!;
    const visible = projectUncleanMonarchPreparation(preparation);
    const { runId, randomSeed, randomCursor, ...preparationFacts } = preparation;
    expect(visible).toEqual(preparationFacts); expect(visible.pricePaid).toBe(30); expect(visible.actionsPaid).toBe(1);
    expect(runId).toBe(s.runId); expect(randomSeed).toBe(s.random.seed); expect(Number.isInteger(randomCursor)).toBe(true);
    for (const key of ['randomSeed', 'randomCursor', 'source', 'futureRoll', 'futurePrivate']) {
      const poisoned = { ...preparation, [key]: key === 'source' ? { randomSeed: 'PRIVATE-SEED' } : 'PRIVATE-OMITTED' } as typeof preparation;
      expect(projectUncleanMonarchPreparation(poisoned)).toEqual(visible);
    }
    const nested = structuredClone(preparation); inject(nested); expect(projectUncleanMonarchPreparation(nested)).toEqual(visible);
    for (const receipt of s.uncleanMonarch.life.journal) {
      const { randomCursor: cursor, randomBefore, randomAfter, source, ...facts } = receipt;
      const publicReceipt = projectUncleanMonarchLifeReceipt(receipt);
      expect(publicReceipt).toEqual(facts); noSecrets(publicReceipt);
      expect(publicReceipt.moves.every(m => m.actorId === 'PLAYER')).toBe(true);
      expect(Number.isInteger(cursor)).toBe(true); expect(randomBefore === null || typeof randomBefore === 'number').toBe(true);
      expect(randomAfter === null || typeof randomAfter === 'number').toBe(true); expect(source === null || typeof source === 'object').toBe(true);
      const poisoned = structuredClone(receipt); inject(poisoned);
      expect(projectUncleanMonarchLifeReceipt(poisoned)).toEqual(publicReceipt);
    }
    noSecrets(visible); expect(hash(s)).toBe(before);
  }, 60_000);

  it('keeps legitimate source strings in settled check modifiers', () => {
    const s = load(), before = hash(s), receipt = structuredClone(s.uncleanMonarch.life.journal.find(r => r.check)!);
    receipt.check!.modifiers.push({ source: '同一原卡已实际核对', value: 3 });
    const visible = projectUncleanMonarchLifeReceipt(receipt);
    expect(visible.check!.modifiers).toEqual(receipt.check!.modifiers);
    noSecrets(visible); expect(hash(s)).toBe(before);
  }, 60_000);
});
