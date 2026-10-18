/** Read-only retained actual198 input and a controlled projection host, never a replay or a new save. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { projectDivineHandLife, projectDivineHandLifeReceipt, type DivineHandLifeReceipt } from '../../src/domain/divine-hand/life.js';
import { projectGlory } from '../../src/domain/glory/index.js';
import { projectGloryCombat } from '../../src/domain/glory/combat.js';

const FILE = 'tests/fixtures/divine-hand-v01980/snapshot-recoveredBeforeEncounter.json';
const FILE_SHA = 'eb9bc7d243a5ffd4704a0d8047c66cf27acbe69dcc447c6075e6b738d057828d';
const digest = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');
const bytes = readFileSync(FILE), raw = JSON.parse(bytes.toString('utf8')) as SliceState;
const keys = ['demonHunterOutcome', 'silverKnightOutcome', 'gloryOutcome'] as const;
function host(): SliceState {
  // Supply only missing newer module defaults for the public projector; do not migrate or validate/replay history.
  return { ...createSliceRun('warrior-public-host', sliceDefaultCreationSelection, 'warrior-public-host'), ...structuredClone(raw) };
}
function withoutReceiptReplay(r: DivineHandLifeReceipt) {
  const { source: _source, randomCursor: _cursor, randomBefore: _before, randomAfter: _after, ...facts } = structuredClone(r);
  return facts;
}
function withoutOutcomeReplay(o: NonNullable<SliceCombatRound[typeof keys[number]]>) {
  const result = structuredClone(o) as unknown as Record<string, unknown>;
  delete result.source; delete result.randomCursorAfter;
  for (const key of ['playerActions', 'enemyActions']) if (Array.isArray(result[key]))
    for (const a of result[key]) { delete a.randomCursorBefore; delete a.randomCursorAfter; }
  return result;
}
function inject(v: unknown): void {
  if (!v || typeof v !== 'object') return;
  if (Array.isArray(v)) { v.forEach(inject); return; }
  for (const [key, child] of Object.entries(v)) if (key !== 'source') inject(child);
  Object.assign(v, { privateProbe: { randomSeed: 'private-probe', randomCursor: 9001 } });
}
function publicOnly(v: unknown): void {
  if (!v || typeof v !== 'object') return;
  for (const [key, child] of Object.entries(v)) {
    expect(['randomSeed', 'randomCursor', 'randomBefore', 'randomAfter', 'randomCursorBefore', 'randomCursorAfter', 'privateProbe'].includes(key), key).toBe(false);
    if (key === 'source') expect(typeof child, 'public source labels remain strings').toBe('string');
    publicOnly(child);
  }
}
function objects(v: unknown, result = new Set<object>()): Set<object> {
  if (!v || typeof v !== 'object' || result.has(v)) return result;
  result.add(v); Object.values(v).forEach(child => objects(child, result)); return result;
}
function detached(publicView: unknown, privateState: unknown): void {
  const privateObjects = objects(privateState);
  for (const value of objects(publicView)) expect(privateObjects.has(value)).toBe(false);
}

describe('actual220 inherited warrior public evidence', () => {
  it('keeps every receipt fact and legitimate labels/physical actor IDs without touching private evidence', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(FILE_SHA);
    const state = host(), before = digest(state), random = structuredClone(state.random), life = projectDivineHandLife(state);
    expect(state.divineHand.life.journal).toHaveLength(45);
    expect(life.ledger).toEqual(state.divineHand.life.journal.map(withoutReceiptReplay));
    expect(life.source).toEqual(expect.any(String)); expect(life.site).toEqual(state.glory.life.site);
    expect(life.ledger.some(r => r.check !== null)).toBe(true);
    expect(life.ledger.some(r => r.moves.length > 0)).toBe(true);
    expect(life.ledger[0]!.originalsBefore.site.guard.actorId).toBeNull();
    publicOnly(life); detached(life, state);
    for (const receipt of state.divineHand.life.journal) {
      const input = structuredClone(receipt);
      if (input.check) input.check.modifiers = [{ source: '实际公开检定修正', value: 0 }];
      const expected = withoutReceiptReplay(input); inject(input); const privateBefore = digest(input);
      const view = projectDivineHandLifeReceipt(input);
      expect(view).toEqual(expected); publicOnly(view); detached(view, input); expect(digest(input)).toBe(privateBefore);
    }
    const glory = projectGlory(state);
    expect(glory.life.cases.some(c => c.attempts.some(a => a.actorMoves.length > 0))).toBe(true);
    for (const c of glory.life.cases) expect(c.attempts).toEqual(state.glory.life.cases[c.id].attempts);
    publicOnly(glory.life); expect(state.random).toEqual(random); expect(digest(state)).toBe(before);
  });

  it('rejects unknown nested life fields and preserves original armor, consent, costs and physical movement', () => {
    const state = host(), expected = projectDivineHandLife(state), gloryExpected = projectGlory(state).life;
    inject(state.divineHand.life); inject(state.glory.life.site);
    for (const c of Object.values(state.glory.life.cases)) c.attempts.forEach(inject);
    const before = digest(state), life = projectDivineHandLife(state), glory = projectGlory(state).life;
    // Unknown private fields invalidate the strict recovery evidence; projection must retain that rejection.
    expect(expected.actions.find(a => a.command.type === 'RECOVER_ENERGY')?.enabled).toBe(true);
    expect(life.actions.find(a => a.command.type === 'RECOVER_ENERGY')).toMatchObject({ enabled: false, reason: '原人、原物、当前成本或实际记录不一致。' });
    expect(life).toEqual({ ...expected, actions: expected.actions.map(a => a.command.type === 'RECOVER_ENERGY'
      ? { ...a, enabled: false, reason: '原人、原物、当前成本或实际记录不一致。' } : a) });
    expect(glory).toEqual(gloryExpected);
    publicOnly(life); publicOnly(glory); detached(life, state); detached(glory, state); expect(digest(state)).toBe(before);
  });

  it('uses the same allowed action facts in live and terminal Glory panels', () => {
    const round = raw.combatHistory.filter(r => r.gloryOutcome).at(-1)!, outcome = round.gloryOutcome!;
    const facts = withoutOutcomeReplay(outcome) as { playerActions: { order: number }[]; enemyActions: { order: number }[] };
    const expected = [...facts.playerActions.map(a => ({ ...a, actor: 'PLAYER' })), ...facts.enemyActions.map(a => ({ ...a, actor: 'ENEMY' }))].sort((a, b) => a.order - b.order);
    for (const live of [false, true]) {
      const state = host(); state.progression.sequence = 2;
      if (live) state.combat = { encounterId: 'GLORY_DISPUTE', round: round.round + 1, enemyHealth: outcome.enemyHealth, enemyMind: outcome.enemyMind,
        enemyStatus: outcome.enemyStatus, enemyInjuries: structuredClone(outcome.enemyInjuriesAfter), enemyRisk: outcome.enemyRiskAfter, lastRound: structuredClone(round) };
      inject(state.glory.life.site); inject(state.glory.encounter.powerUses);
      for (const r of state.combatHistory) if (r.gloryOutcome) inject(r.gloryOutcome);
      if (state.combat?.lastRound?.gloryOutcome) inject(state.combat.lastRound.gloryOutcome);
      const before = digest(state), panel = projectGloryCombat(state);
      expect(panel.lastActionSequence).toEqual(expected); expect(panel).not.toHaveProperty('source');
      publicOnly(panel); detached(panel, state); expect(digest(state)).toBe(before);
    }
  });

  it('uses one sanitized outcome projection at lastCombatRound, combatHistory and combat.lastRound', () => {
    const state = host(), expected = state.combatHistory.map(round => projectPlayerText(Object.fromEntries(keys.filter(key => round[key]).map(key => [key, withoutOutcomeReplay(round[key]!)])), state.character.name));
    expect(state.combatHistory.filter(r => r.demonHunterOutcome)).toHaveLength(2);
    expect(state.combatHistory.filter(r => r.silverKnightOutcome)).toHaveLength(13);
    expect(state.combatHistory.filter(r => r.gloryOutcome)).toHaveLength(2);
    // Controlled previous round collects retained real outcomes to exercise all three public entry points once.
    const previous = structuredClone(state.combatHistory.at(-1)!);
    previous.demonHunterOutcome = structuredClone(state.combatHistory.find(r => r.demonHunterOutcome)!.demonHunterOutcome!);
    previous.silverKnightOutcome = structuredClone(state.combatHistory.find(r => r.silverKnightOutcome)!.silverKnightOutcome!);
    const previousExpected = projectPlayerText(Object.fromEntries(keys.map(key => [key, withoutOutcomeReplay(previous[key]!)])), state.character.name);
    state.lastCombatRound = structuredClone(previous);
    state.combat = { encounterId: 'FIRST_CASE', round: previous.round + 1, enemyHealth: 100, enemyMind: 100,
      enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, lastRound: structuredClone(previous) };
    for (const round of [...state.combatHistory, state.lastCombatRound, state.combat.lastRound!])
      for (const key of keys) if (round[key]) inject(round[key]);
    const before = digest(state), random = structuredClone(state.random), view = projectSliceState(state);
    for (const key of keys) {
      expect(view.lastCombatRound![key]).toEqual(previousExpected[key]);
      expect(view.combat!.lastRound![key]).toEqual(previousExpected[key]);
      publicOnly(view.lastCombatRound![key]); publicOnly(view.combat!.lastRound![key]);
    }
    for (const [i, round] of view.combatHistory.entries()) for (const key of keys) if (round[key]) {
      expect(round[key]).toEqual(expected[i]![key]); publicOnly(round[key]);
    }
    expect(view.divineHand.life.ledger).toEqual(projectPlayerText({ ledger: raw.divineHand.life.journal.map(withoutReceiptReplay) }, state.character.name).ledger);
    detached(view.lastCombatRound, state); detached(view.combat!.lastRound, state); detached(view.combatHistory, state);
    expect(state.random).toEqual(random); expect(digest(state)).toBe(before);
    expect(createHash('sha256').update(readFileSync(FILE)).digest('hex')).toBe(FILE_SHA);
  }, 120_000);
});
