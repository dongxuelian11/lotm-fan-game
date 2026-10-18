import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { projectFerrymanCombat, projectFerrymanRoundOutcome } from '../../src/domain/ferryman/combat.js';
import { projectDeathConsulCombat, projectDeathConsulRoundOutcome } from '../../src/domain/death-consul/combat.js';
import { projectPaleEmperorCombat, projectPaleEmperorRoundOutcome } from '../../src/domain/pale-emperor/combat.js';
import { projectPaleEmperorLife, projectPaleEmperorLifeReceipt } from '../../src/domain/pale-emperor/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const FILE = 'tests/fixtures/pale-emperor-v01950/natural.json';
const HASH = '14be49645e7fa18b4127c7ec34b39875eff1302fbba8052b9037ed149a42d66c';
const captured = () => readObjectEntry<SliceState>(FILE, 'final');
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const fileDigest = () => createHash('sha256').update(readFileSync(FILE)).digest('hex');
const forbidden = ['randomSeed', 'randomCursor', 'randomBefore', 'randomAfter', 'randomCursorBefore', 'randomCursorAfter',
  'preparationRoll', 'preparation', 'sourceHistory', 'sourceScene', 'historyDigest', 'privateProbe', 'privateMastery', 'unexpectedField'];
function publicOnly(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(publicOnly); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(forbidden, `private field ${key}`).not.toContain(key);
    // Material provenance, debt labels and check modifiers legitimately use this spelling.
    if (key === 'source') expect(child === null || typeof child === 'string', 'private source snapshots stay private').toBe(true);
    publicOnly(child);
  }
}
function inject(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(inject); return; }
  Object.entries(value).forEach(([key, child]) => { if (key !== 'source') inject(child); });
  Object.assign(value, { unexpectedField: 'private', preparationRoll: 13, historyDigest: 'private', privateProbe: { randomSeed: 'private', randomCursor: 99 } });
}
function objects(value: unknown, set = new Set<object>()): Set<object> {
  if (!value || typeof value !== 'object' || set.has(value)) return set;
  set.add(value); Object.values(value).forEach(child => objects(child, set)); return set;
}
function detached(actual: unknown, input: unknown): void {
  const originals = objects(input);
  for (const value of objects(actual)) expect(originals.has(value)).toBe(false);
}
function visibleOutcome(input: unknown) {
  const o = structuredClone(input) as Record<string, unknown>;
  delete o.source; delete o.randomCursorAfter;
  for (const key of ['playerActions', 'enemyActions']) for (const a of o[key] as Record<string, unknown>[]) {
    delete a.randomCursorBefore; delete a.randomCursorAfter;
  }
  return o;
}
function visibleLife(input: unknown) {
  const e = structuredClone(input) as Record<string, unknown>;
  for (const key of ['source', 'randomCursor', 'randomBefore', 'randomAfter']) delete e[key];
  return e;
}
function projectedOutcome(round: SliceCombatRound) {
  if (round.ferrymanOutcome) return projectFerrymanRoundOutcome(round.ferrymanOutcome);
  if (round.deathConsulOutcome) return projectDeathConsulRoundOutcome(round.deathConsulOutcome);
  if (round.paleEmperorOutcome) return projectPaleEmperorRoundOutcome(round.paleEmperorOutcome);
  return null;
}
function outcome(round: SliceCombatRound) { return round.ferrymanOutcome ?? round.deathConsulOutcome ?? round.paleEmperorOutcome ?? null; }
function assertMechanicalFacts(actual: unknown, original: unknown): void {
  const a = actual as Record<string, unknown>, o = original as Record<string, unknown>;
  // Independent of prose adaptation: every paid amount, physical result and known original stays identical.
  for (const key of ['targetId', 'round', 'stance', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus',
    'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerMindAfter', 'enemySpiritualityBefore',
    'playerInjuriesAfter', 'enemyInjuriesAfter', 'enemyInjuries', 'playerRiskAfter', 'enemyRiskAfter', 'enemyRisk',
    'powerUses', 'materialsAfter', 'siteAfter', 'elapsedSeconds', 'exitMetres', 'weaponLocation', 'masteryAfter']) {
    if (Object.hasOwn(o, key)) expect(a[key], key).toEqual(o[key]);
  }
  for (const side of ['playerActions', 'enemyActions']) {
    const actions = a[side] as Record<string, unknown>[], originals = o[side] as Record<string, unknown>[];
    expect(actions).toHaveLength(originals.length);
    originals.forEach((action, index) => {
      for (const key of ['order', 'id', 'actor', 'planned', 'actual', 'selectedAbility', 'paidCost', 'mindCost', 'physicalFactor',
        'rolls', 'selfGain', 'enemyReduction', 'threatens', 'mentalPressure', 'succeeded', 'resistanceRoll', 'resistanceChance',
        'siteBefore', 'siteAfter', 'materialsBefore', 'materialsAfter', 'atSeconds', 'elapsedSeconds', 'travelMetres',
        'travelPath', 'lateralTravelPath', 'passageMetres', 'doorOperationSeconds', 'spiritMarksSpent',
        'playerMindAfter', 'playerSpiritualityAfter', 'enemyMindAfter', 'enemySpiritualityAfter']) {
        if (Object.hasOwn(action, key)) expect(actions[index]![key], `${side}[${index}].${key}`).toEqual(action[key]);
      }
    });
  }
}


describe('Death inherited original 1038-command public boundary', () => {
  it('pins the authentic final and retains every resolved fact in all 31 inherited supernatural rounds', () => {
    expect(fileDigest()).toBe(HASH);
    const state = captured(), before = digest(state), random = structuredClone(state.random);
    expect(state.revision).toBe(1039); expect(state.combat).toBeNull(); expect(state.combatHistory).toHaveLength(38);
    expect([state.combatHistory.filter(r => r.ferrymanOutcome).length, state.combatHistory.filter(r => r.deathConsulOutcome).length,
      state.combatHistory.filter(r => r.paleEmperorOutcome).length]).toEqual([5, 14, 12]);
    for (const round of state.combatHistory) {
      const raw = outcome(round); if (!raw) continue;
      const projected = projectedOutcome(round);
      expect(projected).toEqual(visibleOutcome(raw)); publicOnly(projected); detached(projected, raw);
    }
    expect(digest(state)).toBe(before); expect(state.random).toEqual(random); expect(fileDigest()).toBe(HASH);
  });

  it('rejects unknown nested fields while retaining costs, positions, injuries, windows and original objects', () => {
    const state = captured();
    for (const round of state.combatHistory) {
      const raw = outcome(round); if (!raw) continue;
      const expected = visibleOutcome(raw), source = digest(raw.source);
      inject(raw);
      if (round.paleEmperorOutcome) {
        round.paleEmperorOutcome.masteryAfter.privateMastery = 20;
        round.paleEmperorOutcome.inheritedApplications.privateMastery = 20;
      }
      const before = digest(raw), projected = projectedOutcome(round);
      expect(projected).toEqual(expected); publicOnly(projected); detached(projected, raw);
      expect(digest(raw)).toBe(before); expect(digest(raw.source)).toBe(source);
    }
  });

  it('keeps all 42 life receipts and legitimate modifier/provenance text without stream offsets or source snapshots', () => {
    const state = captured(), original = digest(state), journal = state.paleEmperor.life.journal;
    expect(journal).toHaveLength(42);
    expect(projectPaleEmperorLife(state).ledger).toEqual(journal.map(visibleLife));
    const label = 'source randomSeed randomCursor preparationRoll 仍是公开检定说明';
    for (const originalEntry of journal) {
      const entry = structuredClone(originalEntry);
      if (entry.check) entry.check.modifiers = [{ source: label, value: 0 }];
      const expected = visibleLife(entry); inject(entry);
      entry.before.mastery.privateMastery = 20; entry.after.mastery.privateMastery = 20;
      const before = digest(entry), projected = projectPaleEmperorLifeReceipt(entry);
      expect(projected).toEqual(expected); publicOnly(projected); detached(projected, entry);
      if (projected.check) expect(projected.check.modifiers[0]!.source).toBe(label);
      expect(digest(entry)).toBe(before);
    }
    const paleRounds = state.combatHistory.filter(r => r.paleEmperorOutcome);
    expect(paleRounds.flatMap(r => [...r.paleEmperorOutcome!.playerActions, ...r.paleEmperorOutcome!.enemyActions])
      .filter(a => a.check)).toHaveLength(0);
    // The actual combat has no checks. This isolated boundary probe copies an actual life check;
    // it is not a claim that this cast or check happened in the historical combat.
    const raw = structuredClone(paleRounds[0]!.paleEmperorOutcome!), action = raw.playerActions[0]!;
    action.check = structuredClone(journal.find(entry => entry.check)!.check!);
    action.check.modifiers = [{ source: label, value: 0 }];
    const probeBefore = digest(raw), publicAction = projectPaleEmperorRoundOutcome(raw).playerActions[0]!;
    expect(publicAction.check).toEqual(action.check);
    expect(publicAction.check!.modifiers[0]!.source).toBe(label);
    publicOnly(publicAction); detached(publicAction, raw); expect(digest(raw)).toBe(probeBefore);
    expect(digest(state)).toBe(original); expect(digest(captured())).toBe(original); expect(fileDigest()).toBe(HASH);
  });

  it('uses the same mappers at the terminal history and life projection entrances', () => {
    const raw = captured(), original = digest(raw), state = migrateSliceState(raw), before = digest(state), view = projectSliceState(state);
    expect(view.combatHistory.slice(0, 7)).toEqual(projectPlayerText({ rounds: state.combatHistory.slice(0, 7) }, state.character.name).rounds);
    for (let i = 0; i < 7; i++) {
      const { moves: _moves, consequence: _consequence, ...facts } = state.combatHistory[i]!;
      const { moves: _publicMoves, consequence: _publicConsequence, ...publicFacts } = view.combatHistory[i]!;
      expect(publicFacts).toEqual(facts);
      expect(_publicMoves.map(({ actor, selfGain, enemyReduction }) => ({ actor, selfGain, enemyReduction })))
        .toEqual(_moves.map(({ actor, selfGain, enemyReduction }) => ({ actor, selfGain, enemyReduction })));
    }
    for (let i = 7; i < state.combatHistory.length; i++) {
      const r = state.combatHistory[i]!, v = view.combatHistory[i]!;
      const actual = v.ferrymanOutcome ?? v.deathConsulOutcome ?? v.paleEmperorOutcome;
      expect(actual).toEqual(projectPlayerText(projectedOutcome(r)!, state.character.name));
      assertMechanicalFacts(actual, outcome(r)); publicOnly(v);
    }
    expect(view.lastCombatRound!.paleEmperorOutcome).toEqual(projectPlayerText(projectedOutcome(state.lastCombatRound!)!, state.character.name));
    assertMechanicalFacts(view.lastCombatRound!.paleEmperorOutcome, outcome(state.lastCombatRound!));
    expect(view.paleEmperor.life.ledger).toEqual(projectPlayerText({ ledger: state.paleEmperor.life.journal.map(visibleLife) }, state.character.name).ledger);
    view.paleEmperor.life.ledger.forEach((entry, index) => {
      const originalEntry = state.paleEmperor.life.journal[index]!;
      expect(entry.before).toEqual(originalEntry.before); expect(entry.after).toEqual(originalEntry.after);
      expect(entry.finance).toEqual(originalEntry.finance); expect(entry.siteBefore).toEqual(originalEntry.siteBefore);
      expect(entry.siteAfter).toEqual(originalEntry.siteAfter); expect(entry.check).toEqual(originalEntry.check);
    });
    publicOnly(view.lastCombatRound); publicOnly(view.paleEmperor.life.ledger);
    detached(view.combatHistory, state); detached(view.paleEmperor.life.ledger, state);
    expect(digest(state)).toBe(before); expect(digest(raw)).toBe(original);
  });

  it('keeps all three global round entrances safe for each inherited outcome, including nested negative probes', () => {
    const state = migrateSliceState(captured());
    for (const index of [7, 12, 26]) {
      const probe = structuredClone(state), round = structuredClone(probe.combatHistory[index]!);
      const originalOutcome = structuredClone(outcome(round));
      const expected = projectPlayerText(projectedOutcome(round)!, state.character.name); inject(outcome(round));
      probe.lastCombatRound = structuredClone(round); probe.combatHistory[index] = structuredClone(round);
      // Projection-only routing probe, not a new campaign, replay or fabricated gameplay receipt.
      probe.combat = { encounterId: 'FIRST_CASE', round: round.round, enemyHealth: 100, enemyMind: 100,
        enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: structuredClone(round) };
      const before = digest(probe), view = projectSliceState(probe);
      for (const result of [view.lastCombatRound!, view.combatHistory[index]!, view.combat!.lastRound!]) {
        const actual = result.ferrymanOutcome ?? result.deathConsulOutcome ?? result.paleEmperorOutcome;
        expect(actual).toEqual(expected); assertMechanicalFacts(actual, originalOutcome);
        publicOnly(result); detached(result, probe);
      }
      expect(digest(probe)).toBe(before);
    }
  });

  it('keeps the original specialised battle panels free of private sources and action cursors', () => {
    const state = captured(), before = digest(state);
    const pale = projectPaleEmperorCombat(state);
    const last = state.combatHistory[state.paleEmperor.encounter.terminal!.historyIndex]!.paleEmperorOutcome!;
    expect(pale.lastActionSequence).toEqual([...projectPaleEmperorRoundOutcome(last).playerActions,
      ...projectPaleEmperorRoundOutcome(last).enemyActions].sort((a, b) => a.order - b.order));
    publicOnly(pale); detached(pale.lastActionSequence, state);
    expect(projectFerrymanCombat(state)).not.toHaveProperty('source');
    expect(projectDeathConsulCombat(state)).not.toHaveProperty('source');
    // The old scene remains untouched; lowering the sequence here only exercises its public panel branch.
    const consul = structuredClone(state); consul.progression.sequence = 2;
    publicOnly(projectDeathConsulCombat(consul));
    expect(digest(state)).toBe(before); expect(fileDigest()).toBe(HASH);
  });
});
