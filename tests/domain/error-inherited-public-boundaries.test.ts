/** Read retained S1 history only. These projection hosts are not new natural-route evidence. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { projectFateTrojanCombat, type FateTrojanEnemyAction, type FateTrojanPlayerAction, type FateTrojanRoundOutcome } from '../../src/domain/fate-trojan/combat.js';
import { projectFateTrojanRoundOutcome } from '../../src/domain/fate-trojan/public.js';
import { projectTimeWormCombat, type TimeWormActionEvidence, type TimeWormRoundOutcome } from '../../src/domain/time-worm/combat.js';
import { projectTimeWormLife, type TimeWormLifeReceipt } from '../../src/domain/time-worm/life.js';
import { projectTimeWormAction, projectTimeWormLifeReceipt, projectTimeWormRoundOutcome } from '../../src/domain/time-worm/public.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const FILE = 'tests/fixtures/time-worm-v01970/natural.json';
const FILE_SHA = 'e9920991623fdd3f1b8ecf4e5c8049720f362145462703d6b804afa9dfd390cf';
const FINAL_SHA = 'abfce49e9f21e1599f4b9abb1c2e34e15afeb8a2fbe177e2926b3ac4f2d49191';
const digest = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');
const fileDigest = () => createHash('sha256').update(readFileSync(FILE)).digest('hex');
let original: SliceState;
beforeAll(() => {
  expect(fileDigest()).toBe(FILE_SHA);
  original = readObjectEntry<SliceState>(FILE, 'final');
  expect(digest(original)).toBe(FINAL_SHA);
});
const fateRounds = (s: SliceState) => s.combatHistory.filter(r => r.fateTrojanOutcome);
const timeRounds = (s: SliceState) => s.combatHistory.filter(r => r.timeWormOutcome);
function withoutActionReplay(a: FateTrojanPlayerAction | FateTrojanEnemyAction | TimeWormActionEvidence) {
  const { randomCursorBefore: _before, randomCursorAfter: _after, ...facts } = structuredClone(a);
  return facts;
}
function withoutOutcomeReplay(o: FateTrojanRoundOutcome | TimeWormRoundOutcome) {
  const { source: _source, randomCursorAfter: _cursor, playerActions, enemyActions, ...facts } = structuredClone(o);
  return { ...facts, playerActions: playerActions.map(withoutActionReplay), enemyActions: enemyActions.map(withoutActionReplay) };
}
function withoutLifeReplay(r: TimeWormLifeReceipt) {
  const { source: _source, randomCursor: _cursor, randomBefore: _before, randomAfter: _after, ...facts } = structuredClone(r);
  return facts;
}
function assertPublicOnly(v: unknown): void {
  if (!v || typeof v !== 'object') return;
  for (const [key, child] of Object.entries(v)) {
    expect(['randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'randomBefore', 'randomAfter',
      'privateProbe', 'privateMastery'].includes(key), key).toBe(false);
    if (key === 'source') expect(typeof child, 'public modifier and debt labels remain strings').toBe('string');
    assertPublicOnly(child);
  }
}
function objects(v: unknown, found = new Set<object>()): Set<object> {
  if (!v || typeof v !== 'object' || found.has(v)) return found;
  found.add(v); Object.values(v).forEach(child => objects(child, found)); return found;
}
function assertDetached(output: unknown, input: unknown): void {
  const source = objects(input);
  for (const object of objects(output)) expect(source.has(object), 'public output must not alias private input').toBe(false);
}
function injectPrivateFields(v: unknown): void {
  if (!v || typeof v !== 'object') return;
  if (Array.isArray(v)) { v.forEach(injectPrivateFields); return; }
  for (const [key, child] of Object.entries(v)) if (key !== 'source') injectPrivateFields(child);
  Object.assign(v, { privateProbe: { randomSeed: 'not-public', randomCursor: 1234 } });
}
function withRound(s: SliceState, round: SliceCombatRound, kind: 'fateTrojan' | 'timeWorm'): SliceState {
  // The actual captured round is mounted at each public entry; no intent or replay is executed.
  const host = structuredClone(s), outcome = kind === 'fateTrojan' ? round.fateTrojanOutcome! : round.timeWormOutcome!;
  host.progression.sequence = kind === 'fateTrojan' ? 2 : 1;
  host.lastCombatRound = structuredClone(round);
  host.combat = { encounterId: kind === 'fateTrojan' ? 'FATE_TROJAN_DISPUTE' : 'TIME_WORM_DISPUTE', round: round.round + 1,
    enemyHealth: outcome.enemyHealth, enemyMind: outcome.enemyMind, enemyStatus: outcome.enemyStatus,
    enemyInjuries: structuredClone('enemyInjuriesAfter' in outcome ? outcome.enemyInjuriesAfter : outcome.enemyInjuries),
    enemyRisk: 'enemyRiskAfter' in outcome ? outcome.enemyRiskAfter : outcome.enemyRisk, lastRound: structuredClone(round) };
  return host;
}

describe('Error219 inherited public evidence boundaries', () => {
  it('retains all resolved facts from nine FateTrojan and two TimeWorm rounds with unchanged private history', () => {
    expect(fateRounds(original)).toHaveLength(9); expect(timeRounds(original)).toHaveLength(2);
    const before = digest(original), rng = structuredClone(original.random);
    for (const round of fateRounds(original)) {
      const outcome = round.fateTrojanOutcome!, view = projectFateTrojanRoundOutcome(outcome);
      expect(view).toEqual(withoutOutcomeReplay(outcome)); assertPublicOnly(view); assertDetached(view, outcome);
    }
    for (const round of timeRounds(original)) {
      const outcome = round.timeWormOutcome!, view = projectTimeWormRoundOutcome(outcome);
      expect(view).toEqual(withoutOutcomeReplay(outcome)); assertPublicOnly(view); assertDetached(view, outcome);
      expect(view.rootAfter).toEqual(outcome.rootAfter); expect(view.materialsAfter).toEqual(outcome.materialsAfter);
      expect(view.masteryAfter).toEqual(outcome.masteryAfter);
    }
    expect(original.random).toEqual(rng); expect(digest(original)).toBe(before); expect(fileDigest()).toBe(FILE_SHA);
  });

  it('projects all 47 life receipts without replay inputs and preserves checks, positions, costs and movement', () => {
    const before = digest(original), receipts = original.timeWorm.life.journal;
    expect(receipts).toHaveLength(47); expect(receipts.some(r => r.source)).toBe(true);
    const view = projectTimeWormLife(original);
    expect(view.ledger).toEqual(receipts.map(withoutLifeReplay)); assertPublicOnly(view.ledger); assertDetached(view.ledger, receipts);
    expect(view.ledger.some(r => r.moves.length > 0)).toBe(true);
    expect(view.ledger.some(r => r.check !== null)).toBe(true);
    for (const [i, r] of receipts.entries()) {
      expect(view.ledger[i]!.originalsAfter).toEqual(r.originalsAfter);
      expect(view.ledger[i]!.check).toEqual(r.check);
      expect(view.ledger[i]!.before).toEqual(r.before); expect(view.ledger[i]!.after).toEqual(r.after);
    }
    expect(digest(original)).toBe(before);
  });

  it('rejects unknown nested fields while retaining legitimate check.modifiers.source and every allowed fact', () => {
    for (const round of fateRounds(original)) {
      const outcome = structuredClone(round.fateTrojanOutcome!), expected = withoutOutcomeReplay(outcome), source = digest(outcome.source);
      injectPrivateFields(outcome); const before = digest(outcome), view = projectFateTrojanRoundOutcome(outcome);
      expect(view).toEqual(expected); assertPublicOnly(view); assertDetached(view, outcome);
      expect(digest(outcome.source)).toBe(source); expect(digest(outcome)).toBe(before);
    }
    let checks = 0;
    for (const round of timeRounds(original)) {
      const outcome = structuredClone(round.timeWormOutcome!);
      for (const action of [...outcome.playerActions, ...outcome.enemyActions]) if (action.check) {
        action.check = { ...action.check, modifiers: [{ source: '公开检定修正说明', value: 0 }] }; checks++;
      }
      const expected = withoutOutcomeReplay(outcome), source = digest(outcome.source);
      injectPrivateFields(outcome); outcome.masteryAfter.privateMastery = 42;
      const before = digest(outcome), view = projectTimeWormRoundOutcome(outcome);
      expect(view).toEqual(expected); assertPublicOnly(view); assertDetached(view, outcome);
      expect(digest(outcome.source)).toBe(source); expect(digest(outcome)).toBe(before);
      for (const action of [...outcome.playerActions, ...outcome.enemyActions]) if (action.check)
        expect(projectTimeWormAction(action).check!.modifiers).toEqual([{ source: '公开检定修正说明', value: 0 }]);
    }
    expect(checks).toBeGreaterThan(0);
    for (const receipt of original.timeWorm.life.journal) {
      const input = structuredClone(receipt);
      if (input.check) input.check = { ...input.check, modifiers: [{ source: '保留已发生检定', value: 0 }] };
      const expected = withoutLifeReplay(input); injectPrivateFields(input);
      const before = digest(input), view = projectTimeWormLifeReceipt(input);
      expect(view).toEqual(expected); assertPublicOnly(view); assertDetached(view, input); expect(digest(input)).toBe(before);
    }
  });

  it('uses detached public round actions for both live and terminal combat panels', () => {
    for (const kind of ['fateTrojan', 'timeWorm'] as const) {
      const round = (kind === 'fateTrojan' ? fateRounds(original) : timeRounds(original)).at(-1)!;
      const terminal = structuredClone(original); terminal.progression.sequence = kind === 'fateTrojan' ? 2 : 1;
      for (const host of [terminal, withRound(original, round, kind)]) {
        const before = digest(host), panel = kind === 'fateTrojan' ? projectFateTrojanCombat(host) : projectTimeWormCombat(host);
        const outcome = kind === 'fateTrojan' ? round.fateTrojanOutcome! : round.timeWormOutcome!;
        const actions = kind === 'fateTrojan'
          ? [...outcome.playerActions.map(a => ({ ...withoutActionReplay(a), actor: 'PLAYER' })), ...outcome.enemyActions.map(a => ({ ...withoutActionReplay(a), actor: 'ENEMY' }))]
          : [...outcome.playerActions, ...outcome.enemyActions].map(withoutActionReplay);
        expect(panel.lastActionSequence).toEqual(actions.sort((a, b) => a.order - b.order));
        assertPublicOnly(panel); assertDetached(panel, host); expect(digest(host)).toBe(before);
      }
      const hostile = withRound(original, round, kind), expected = kind === 'fateTrojan' ? projectFateTrojanCombat(hostile) : projectTimeWormCombat(hostile);
      if (kind === 'fateTrojan') {
        injectPrivateFields(hostile.fateTrojan.life.site); injectPrivateFields(hostile.fateTrojan.encounter.powerUses);
        injectPrivateFields(hostile.combat!.lastRound!.fateTrojanOutcome);
      } else {
        injectPrivateFields(hostile.timeWorm.encounter.scene); injectPrivateFields(hostile.timeWorm.encounter.materials);
        injectPrivateFields(hostile.timeWorm.encounter.powerUses); injectPrivateFields(hostile.combat!.lastRound!.timeWormOutcome);
      }
      const before = digest(hostile), view = kind === 'fateTrojan' ? projectFateTrojanCombat(hostile) : projectTimeWormCombat(hostile);
      expect(view).toEqual(expected); assertPublicOnly(view); assertDetached(view, hostile); expect(digest(hostile)).toBe(before);
    }
  });

  it('closes current last, history and combat.lastRound including hostile nested fields without changing saved history', () => {
    const state = migrateSliceState(structuredClone(original)), before = digest(state), rng = structuredClone(state.random);
    const inherited = projectSliceState(state);
    expect(inherited.timeWorm.life.ledger).toEqual(original.timeWorm.life.journal.map(withoutLifeReplay));
    for (const kind of ['fateTrojan', 'timeWorm'] as const) {
      const outcomeKey = kind === 'fateTrojan' ? 'fateTrojanOutcome' : 'timeWormOutcome';
      const round = (kind === 'fateTrojan' ? fateRounds(state) : timeRounds(state)).at(-1)!;
      const expected = withoutOutcomeReplay(round[outcomeKey]!);
      const host = withRound(state, round, kind);
      injectPrivateFields(host.lastCombatRound![outcomeKey]); injectPrivateFields(host.combat!.lastRound![outcomeKey]);
      for (const entry of host.combatHistory) if (entry[outcomeKey]) injectPrivateFields(entry[outcomeKey]);
      for (const receipt of host.timeWorm.life.journal) injectPrivateFields(receipt);
      const hostBefore = digest(host), view = projectSliceState(host);
      expect(view.lastCombatRound![outcomeKey]).toEqual(expected);
      expect(view.combat!.lastRound![outcomeKey]).toEqual(expected);
      expect(view.combatHistory.filter(r => r[outcomeKey]).at(-1)![outcomeKey]).toEqual(expected);
      assertPublicOnly(view.lastCombatRound![outcomeKey]); assertPublicOnly(view.combat!.lastRound![outcomeKey]);
      view.combatHistory.filter(r => r[outcomeKey]).forEach(r => assertPublicOnly(r[outcomeKey]));
      assertPublicOnly(kind === 'fateTrojan' ? view.combat!.fateTrojan : view.combat!.timeWorm);
      expect(view.timeWorm.life.ledger).toEqual(original.timeWorm.life.journal.map(withoutLifeReplay));
      assertPublicOnly(view.timeWorm.life.ledger); expect(digest(host)).toBe(hostBefore);
    }
    expect(state.random).toEqual(rng); expect(digest(state)).toBe(before); expect(digest(original)).toBe(FINAL_SHA); expect(fileDigest()).toBe(FILE_SHA);
  }, 120_000);
});
