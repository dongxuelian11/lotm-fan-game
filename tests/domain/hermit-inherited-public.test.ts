import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { publicMysticRound } from '../../src/domain/mystic/combat.js';
import { publicProphecyMasterRound } from '../../src/domain/prophecy-master/combat.js';
import { publicSageRound } from '../../src/domain/sage/combat.js';
import { projectSageLife } from '../../src/domain/sage/life.js';
import { projectKnowledgeEmperorCombat, publicKnowledgeEmperorRound } from '../../src/domain/knowledge-emperor/combat.js';
import { projectKnowledgeEmperorEncounter } from '../../src/domain/knowledge-emperor/encounter.js';
import { projectKnowledgeEmperorLife, publicKnowledgeEmperorLifeReceipt } from '../../src/domain/knowledge-emperor/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const SOURCE = 'tests/fixtures/knowledge-emperor-v02000/snapshot-recoveredBeforeEncounter.json';
const SOURCE_FILE_HASH = '7dfb8d05d6dfd262aa804fd6e8a4a1c0256dccffbdebdd0dcad4e77e830b0cb7';
const SOURCE_STATE_HASH = 'bf23ffe532b8be8c33fd44d5e5408a1600a1e7a6173ef73482a52a4336596f4b';
const OLD_TERMINAL = 'tests/fixtures/knowledge-emperor-v02000/natural.json';
const OLD_TERMINAL_HASH = '9541728e0bd5fad9a0c0f03fe677bee69c5cf4ab7385c6d86cdc33874017dfd5';
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
function captured(): SliceState {
  const file = readFileSync(SOURCE);
  expect(createHash('sha256').update(file).digest('hex')).toBe(SOURCE_FILE_HASH);
  const s = JSON.parse(file.toString('utf8')) as SliceState;
  expect(digest(s)).toBe(SOURCE_STATE_HASH);
  return s;
}
function oldTerminal(): SliceState {
  // This dead 831-command branch is only historical combat evidence, never the new campaign's source.
  const s = readObjectEntry<SliceState>(OLD_TERMINAL, 'final');
  expect(digest(s)).toBe(OLD_TERMINAL_HASH);
  expect(s).toMatchObject({ revision: 832, status: 'DEAD', health: 0 });
  return s;
}
const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomBefore', 'randomAfter',
  'randomCursorBefore', 'randomCursorAfter', 'cursorBefore', 'cursorAfter', 'randomReceipts', 'preparationRoll',
  'sourceHistory', 'sourceScene', 'sourceDigest', 'historyDigest', 'privateProbe', 'privateMastery', 'unexpectedField']);
function publicOnly(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(publicOnly); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(forbidden.has(key), `private field ${key}`).toBe(false);
    if (key === 'source') expect(child === null || typeof child === 'string').toBe(true);
    if (key === 'preparation') expect(child === null || typeof child !== 'object').toBe(true);
    publicOnly(child);
  }
}
function inject(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach(inject);
  if (!Array.isArray(value)) Object.assign(value, { unexpectedField: 'private', preparationRoll: 13, historyDigest: 'private', privateProbe: { randomSeed: 'private', randomCursor: 99 } });
}
function objects(value: unknown, seen = new Set<object>()): Set<object> {
  if (!value || typeof value !== 'object' || seen.has(value)) return seen;
  seen.add(value); Object.values(value).forEach(v => objects(v, seen)); return seen;
}
function detached(value: unknown, input: unknown): void {
  const originals = objects(input);
  for (const v of objects(value)) expect(originals.has(v)).toBe(false);
}
/** Expected historical evidence removes only known replay authority, never checks or source labels. */
function historical(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(historical);
  return Object.fromEntries(Object.entries(value).filter(([key, child]) =>
    !['randomCursor', 'randomBefore', 'randomAfter', 'randomCursorBefore', 'randomCursorAfter', 'finance'].includes(key) &&
    !(key === 'source' && child !== null && typeof child === 'object') && !(key === 'source' && child === null))
    .map(([key, child]) => [key, historical(child)]));
}
function selection(round: SliceCombatRound) {
  if (round.mysticOutcome) return { key: 'mysticOutcome' as const, outcome: publicMysticRound(round.mysticOutcome) };
  if (round.prophecyMasterOutcome) return { key: 'prophecyMasterOutcome' as const, outcome: publicProphecyMasterRound(round.prophecyMasterOutcome) };
  if (round.sageOutcome) return { key: 'sageOutcome' as const, outcome: publicSageRound(round.sageOutcome) };
  if (round.knowledgeEmperorOutcome) return { key: 'knowledgeEmperorOutcome' as const, outcome: publicKnowledgeEmperorRound(round.knowledgeEmperorOutcome) };
  return null;
}
function routeRound(s: SliceState, round: SliceCombatRound): void {
  // Projection-only cache routing. This is not accepted or replayed as a save or new campaign history.
  s.lastCombatRound = structuredClone(round); s.combatHistory = [structuredClone(round)];
  s.combat = { encounterId: 'FIRST_CASE', round: round.round, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: structuredClone(round) };
}

describe('Hermit inherited positive public boundaries from the living 827-command source', () => {
  it('migrates the pinned source without changing inherited private state or RNG and projects it without replay secrets', () => {
    const raw = captured(), s = migrateSliceState(raw);
    for (const [key, value] of Object.entries(raw)) if (!['schemaVersion', 'contentVersion'].includes(key))
      expect(digest(s[key as keyof SliceState]), `changed inherited ${key}`).toBe(digest(value));
    const before = digest(s), random = structuredClone(s.random), view = projectSliceState(s);
    expect(s).toMatchObject({ revision: 828, week: 194, status: 'ACTIVE', progression: { pathwayId: 'hermit', sequence: 1 }, random: { cursor: 346 } });
    expect(s.knowledgeEmperor.life.journal).toHaveLength(55);
    expect(s.combatHistory.filter(r => r.mysticOutcome)).toHaveLength(3);
    expect(s.combatHistory.filter(r => r.prophecyMasterOutcome)).toHaveLength(4);
    expect(s.combatHistory.filter(r => r.sageOutcome)).toHaveLength(5);
    expect(s.combatHistory.filter(r => r.knowledgeEmperorOutcome)).toHaveLength(0);
    publicOnly(view); expect(JSON.stringify(view)).not.toContain(s.random.seed);
    expect(digest(s)).toBe(before); expect(s.random).toEqual(random); expect(digest(raw)).toBe(SOURCE_STATE_HASH);
  }, 60_000);

  it('preserves each authentic inherited round, actual past rolls, costs, injuries, positions and finite objects', () => {
    const s = captured(), before = digest(s);
    for (const round of s.combatHistory) {
      const item = selection(round); if (!item) continue;
      const raw = round[item.key]!;
      expect(item.outcome).toEqual(historical(raw)); publicOnly(item.outcome); detached(item.outcome, raw);
      const probe = structuredClone(round); inject(probe[item.key]); const probeBefore = digest(probe);
      expect(selection(probe)!.outcome).toEqual(item.outcome);
      publicOnly(selection(probe)!.outcome); detached(selection(probe)!.outcome, probe);
      expect(digest(probe)).toBe(probeBefore);
    }
    expect(digest(s)).toBe(before);
  });

  it('preserves all 55 real life receipts and legal check modifier source text while excluding nested replay authority', () => {
    const s = captured(), before = digest(s), life = projectKnowledgeEmperorLife(s), sage = projectSageLife(s);
    expect(life.ledger).toEqual(s.knowledgeEmperor.life.journal.map(historical));
    publicOnly(life); publicOnly(sage); detached(life, s); detached(sage, s);
    for (const original of s.knowledgeEmperor.life.journal) {
      const receipt = structuredClone(original), label = 'source randomSeed randomCursor preparationRoll 是公开检定说明';
      if (receipt.check) receipt.check = { ...receipt.check, modifiers: [{ source: label, value: 0 }] };
      const expected = historical(receipt); inject(receipt); receipt.before.mastery.privateMastery = 500;
      const receiptBefore = digest(receipt), view = publicKnowledgeEmperorLifeReceipt(receipt);
      expect(view).toEqual(expected); publicOnly(view); detached(view, receipt);
      if (view.check) expect(view.check.modifiers[0]!.source).toBe(label);
      expect(digest(receipt)).toBe(receiptBefore);
    }
    const probe = structuredClone(s);
    for (const c of Object.values(probe.knowledgeEmperor.life.cases)) c.attempts.forEach(inject);
    for (const c of Object.values(probe.sage.life.cases)) c.attempts.forEach(inject);
    for (const receipt of probe.knowledgeEmperor.life.journal) inject(receipt);
    inject(probe.knowledgeEmperor.life.notes); inject(probe.knowledgeEmperor.life.pending); inject(probe.knowledgeEmperor.life.site);
    inject(probe.sage.life.site); inject(probe.sage.encounter.currentSite);
    expect(projectKnowledgeEmperorLife(probe)).toEqual(life); expect(projectSageLife(probe)).toEqual(sage);
    expect(digest(s)).toBe(before);
  });

  it('keeps the old dead branch separate and positively projects its actual Knowledge Emperor action receipts', () => {
    const s = oldTerminal(), before = digest(s), raw = s.lastCombatRound!.knowledgeEmperorOutcome!;
    const projected = publicKnowledgeEmperorRound(raw);
    expect(projected).toEqual(historical(raw)); publicOnly(projected); detached(projected, raw);
    const panel = projectKnowledgeEmperorCombat(s), encounter = projectKnowledgeEmperorEncounter(s);
    expect(panel.lastActionSequence).toEqual([...projected.playerActions.map(a => ({ ...a, actor: 'PLAYER' })), ...projected.enemyActions.map(a => ({ ...a, actor: 'ENEMY' }))].sort((a, b) => a.order - b.order));
    publicOnly(panel); publicOnly(encounter); expect(encounter).not.toHaveProperty('preparation');
    const probe = structuredClone(raw); inject(probe); probe.masteryAfter.privateMastery = 500;
    const probeBefore = digest(probe); expect(publicKnowledgeEmperorRound(probe)).toEqual(projected);
    expect(digest(probe)).toBe(probeBefore); expect(digest(s)).toBe(before);
  });

  it('uses the same projector through active lastRound, lastCombatRound and combatHistory for all four reachable outcome kinds', () => {
    const s = migrateSliceState(captured()), old = oldTerminal();
    const rounds = [s.combatHistory.find(r => r.mysticOutcome)!, s.combatHistory.find(r => r.prophecyMasterOutcome)!,
      s.combatHistory.find(r => r.sageOutcome)!, old.lastCombatRound!];
    for (const round of rounds) {
      const item = selection(round)!; routeRound(s, round);
      for (const cached of [s.lastCombatRound!, s.combat!.lastRound!, ...s.combatHistory]) inject(cached[item.key]);
      const before = digest(s), view = projectSliceState(s), expected = projectPlayerText(item.outcome, s.character.name);
      expect(view.combat!.lastRound![item.key]).toEqual(expected);
      expect(view.lastCombatRound![item.key]).toEqual(expected);
      expect(view.combatHistory[0]![item.key]).toEqual(expected);
      publicOnly(view.combat!.lastRound); publicOnly(view.lastCombatRound); publicOnly(view.combatHistory);
      expect(digest(s)).toBe(before);
    }
  }, 60_000);
});
