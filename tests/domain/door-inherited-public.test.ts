import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { projectStarKeyCombat, projectStarKeyRoundOutcome } from '../../src/domain/star-key/combat.js';
import { projectStarKeyLife, projectStarKeyLifeReceipt } from '../../src/domain/star-key/life.js';
import { projectPlaneswalkerCombat, projectPlaneswalkerRoundOutcome, type PlaneswalkerCombatSource,
  type PlaneswalkerPlayerAction, type PlaneswalkerEnemyAction, type PlaneswalkerRoundOutcome } from '../../src/domain/planeswalker/combat.js';
import { projectPlaneswalkerLife } from '../../src/domain/planeswalker/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const FILE = 'tests/fixtures/star-key-v01960/natural.json';
const FILE_HASH = 'd9f23dd736ccf0a9fe4eb48e7ffbd79f86a87c6f6ad58dcd913d234c3251cc6d';
const FINAL_HASH = '56ecbdddfdbfa82116aa8ea466d4195be0b98e4ccbcc49bea07f3f2cabfd1a5b';
const digest = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');
const fileDigest = () => createHash('sha256').update(readFileSync(FILE)).digest('hex');
function captured() {
  expect(fileDigest()).toBe(FILE_HASH);
  const raw = readObjectEntry<SliceState>(FILE, 'final');
  expect(digest(raw)).toBe(FINAL_HASH);
  return raw;
}
function migrated() {
  const raw = captured(), state = migrateSliceState(raw);
  for (const [key, value] of Object.entries(raw)) if (!['schemaVersion', 'contentVersion'].includes(key)) {
    expect(digest(state[key as keyof SliceState]), `migration changed inherited ${key}`).toBe(digest(value));
  }
  expect(digest(raw)).toBe(FINAL_HASH);
  return state;
}
const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomBefore', 'randomAfter',
  'randomCursorBefore', 'randomCursorAfter', 'cursorBefore', 'cursorAfter', 'randomReceipts', 'preparationRoll',
  'sourceHistory', 'sourceScene', 'sourceDigest', 'historyDigest', 'privateProbe', 'privateMastery', 'unexpectedField']);
function publicOnly(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(publicOnly); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(forbidden.has(key), `private field ${key}`).toBe(false);
    // Human-readable provenance and check modifiers are valid; replay source objects are not.
    if (key === 'source') expect(child === null || typeof child === 'string').toBe(true);
    publicOnly(child);
  }
}
function inject(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(inject); return; }
  Object.entries(value).forEach(([key, child]) => { if (key !== 'source') inject(child); });
  Object.assign(value, { unexpectedField: 'private', preparationRoll: 13, historyDigest: 'private', privateProbe: { randomSeed: 'private', randomCursor: 99 } });
}
function objects(value: unknown, seen = new Set<object>()): Set<object> {
  if (!value || typeof value !== 'object' || seen.has(value)) return seen;
  seen.add(value); Object.values(value).forEach(v => objects(v, seen)); return seen;
}
function detached(value: unknown, input: unknown): void {
  const originals = objects(input);
  for (const v of objects(value)) expect(originals.has(v)).toBe(false);
}
function visibleOutcome(input: unknown) {
  const o = structuredClone(input) as Record<string, unknown>;
  delete o.source; delete o.randomCursorAfter;
  for (const side of ['playerActions', 'enemyActions']) for (const a of o[side] as Record<string, unknown>[]) {
    delete a.randomCursorBefore; delete a.randomCursorAfter;
  }
  return o;
}
function visibleLife(input: unknown) {
  const e = structuredClone(input) as Record<string, unknown>;
  for (const key of ['source', 'finance', 'randomCursor', 'randomBefore', 'randomAfter']) delete e[key];
  return e;
}
function routeRound(state: SliceState, round: SliceCombatRound, index: number): void {
  state.lastCombatRound = structuredClone(round); state.combatHistory[index] = structuredClone(round);
  // Deliberately projection-only cache routing, never accepted as a valid save or played campaign.
  state.combat = { encounterId: 'FIRST_CASE', round: round.round, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: structuredClone(round) };
}

/** The original 196 branch peacefully closed the S2 encounter, so it has no S2
 * combat receipt. This complete typed object is only a public-boundary probe,
 * built from original physical fields; it is never replayed or called history. */
function planeswalkerBoundaryProbe(s: SliceState): PlaneswalkerRoundOutcome {
  const site = structuredClone(s.planeswalker.life.site), e = s.planeswalker.encounter;
  const source: PlaneswalkerCombatSource = {
    runId: s.runId, revision: s.revision, week: s.week, round: 1, encounterId: 'PLANESWALKER_DISPUTE', targetId: 'PW2-SOREN',
    attemptWeek: s.week, startHistoryIndex: 0, targetName: '索伦', targetAge: 46, targetSequence: 3, targetCore: 24,
    actualContemporaryBody: true, independentMind: true, enemyWeapon: 'PW2-SOREN-CLUB', weaponLocation: 'HAND', enemyLocation: 'FAR',
    enemyPositionMetres: 6, distanceMetres: 4, ordinaryExit: true, pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    site: structuredClone(site), playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    playerInjuries: structuredClone(s.injuries), enemyInjuries: structuredClone(e.enemyInjuries), playerRisk: s.injuryRisk, enemyRisk: e.enemyRisk,
    clubHeld: s.town.clubLocation === 'HAND', ...s.character.coreStats,
    travelMastery: s.progression.mastery['door.s5.travel']!, tricksMastery: s.progression.mastery['door.s8.tricks']!,
    powerUses: { ...e.powerUses }, randomSeed: s.random.seed, randomCursor: s.random.cursor,
  };
  const originalCheck = s.starKey.life.journal.find(r => r.check)!.check!;
  const common = {
    label: 'Projection-only action probe', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false as const,
    order: 0, atSeconds: site.elapsedSeconds, elapsedSeconds: 5 as const, paidCost: 6, physicalFactor: 1, rolls: [originalCheck.roll],
    randomCursorBefore: s.random.cursor, randomCursorAfter: s.random.cursor + 1,
    playerSpiritualityAfter: s.spirituality - 6, enemySpiritualityAfter: e.enemySpirituality,
    siteBefore: structuredClone(site), siteAfter: structuredClone(site), doorOperationSeconds: 0 as const, symbolicMetres: 0 as const,
    chargeGranted: false, chargeConsumedByOrder: null, appliedAmount: 0, consumedTransitOrder: null, consumedWardOrder: null,
  };
  const player: PlaneswalkerPlayerAction = { ...common, id: 'door.s2.symbolic-transit', attempted: true, succeeded: false, applied: false, fallback: 'NONE' };
  const enemy: PlaneswalkerEnemyAction = { ...structuredClone(common), order: 1, paidCost: 4, rolls: [], planned: 'REFRACT_WARD', actual: 'REFRACT_WARD', doorChanged: false };
  return {
    targetId: 'PW2-SOREN', round: 1, source, stance: 'CONTROL', continuing: true,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus,
    playerSpiritualityBefore: s.spirituality, playerSpiritualityAfter: s.spirituality - 6, playerHealthAfter: s.health,
    playerMindAfter: s.mind, enemySpiritualityBefore: e.enemySpirituality,
    playerInjuriesAfter: structuredClone(s.injuries), enemyInjuriesAfter: structuredClone(e.enemyInjuries),
    playerRiskAfter: s.injuryRisk, enemyRiskAfter: e.enemyRisk, powerUses: { ...e.powerUses }, doorClosed: false,
    playerDoorOpened: false, transitAttempted: true, wardAttempted: true, expiredTransitChargeOrder: null, expiredWardChargeOrder: 1,
    siteAfter: site, elapsedSeconds: 60, exitMetres: 0, randomCursorAfter: s.random.cursor + 1, playerActions: [player], enemyActions: [enemy],
  };
}

describe('Door inherited positive public boundaries without replaying the original campaign', () => {
  it('strictly migrates the pinned 823-command source without changing any inherited private field', () => {
    expect(readObjectEntry<unknown[]>(FILE, 'commands')).toHaveLength(823);
    const s = migrated(), before = digest(s), random = structuredClone(s.random), view = projectSliceState(s);
    expect(s).toMatchObject({ revision: 1131, week: 218, health: 80, mind: 98, spirituality: 120, cash: 3900, actionsRemaining: 3 });
    expect(s.starKey.life.journal).toHaveLength(66); expect(s.combatHistory.filter(r => r.starKeyOutcome)).toHaveLength(10);
    expect(s.combatHistory.filter(r => r.planeswalkerOutcome)).toHaveLength(0);
    publicOnly(view); expect(JSON.stringify(view)).not.toContain(s.random.seed);
    expect(digest(s)).toBe(before); expect(s.random).toEqual(random); expect(fileDigest()).toBe(FILE_HASH);
  }, 60_000);

  it('preserves every public field in the ten authentic StarKey rounds, including checks and physical resources', () => {
    const s = captured(), before = digest(s);
    for (const round of s.combatHistory) {
      if (!round.starKeyOutcome) continue;
      const raw = round.starKeyOutcome, expected = visibleOutcome(raw), sourceBefore = digest(raw.source);
      const publicRound = projectStarKeyRoundOutcome(raw);
      expect(publicRound).toEqual(expected); publicOnly(publicRound); detached(publicRound, raw);
      const probe = structuredClone(raw); inject(probe); probe.masteryAfter.privateMastery = 20;
      const probeBefore = digest(probe), projected = projectStarKeyRoundOutcome(probe);
      expect(projected).toEqual(expected); publicOnly(projected); detached(projected, probe);
      expect(digest(probe)).toBe(probeBefore); expect(digest(raw.source)).toBe(sourceBefore);
    }
    expect(digest(s)).toBe(before); expect(fileDigest()).toBe(FILE_HASH);
  });

  it('preserves legitimate action-check modifier source text without admitting similarly named private fields', () => {
    const s = captured(), before = digest(s), raw = structuredClone(s.combatHistory.find(r =>
      r.starKeyOutcome?.playerActions.some(a => a.check))!.starKeyOutcome!);
    const action = raw.playerActions.find(a => a.check)!, label = 'source randomSeed randomCursor preparationRoll 是公开检定说明';
    action.check!.modifiers = [{ source: label, value: 0 }];
    const expected = visibleOutcome(raw); inject(raw); const probeBefore = digest(raw), projected = projectStarKeyRoundOutcome(raw);
    expect(projected).toEqual(expected);
    expect(projected.playerActions.find(a => a.check)!.check!.modifiers).toEqual([{ source: label, value: 0 }]);
    publicOnly(projected); detached(projected, raw); expect(digest(raw)).toBe(probeBefore); expect(digest(s)).toBe(before);
  });

  it('retains all 66 resolved life costs/checks/objects while withholding historical finance and replay sources', () => {
    const s = captured(), before = digest(s), life = projectStarKeyLife(s), planeswalkerLife = projectPlaneswalkerLife(s);
    expect(life.ledger).toEqual(s.starKey.life.journal.map(visibleLife));
    expect(life.site).toEqual(s.planeswalker.life.site);
    for (const original of s.starKey.life.journal) {
      const entry = structuredClone(original), label = 'source randomSeed randomCursor preparationRoll 是公开检定说明';
      if (entry.check) entry.check.modifiers = [{ source: label, value: 0 }];
      const expected = visibleLife(entry); inject(entry); const entryBefore = digest(entry), projected = projectStarKeyLifeReceipt(entry);
      expect(projected).toEqual(expected); publicOnly(projected); detached(projected, entry);
      expect(projected).not.toHaveProperty('finance'); expect(projected.before.cash).toBe(original.before.cash);
      expect(projected.after.actions).toBe(original.after.actions); expect(projected.moves).toEqual(original.moves);
      if (projected.check) expect(projected.check.modifiers[0]!.source).toBe(label);
      expect(digest(entry)).toBe(entryBefore);
    }
    const probe = structuredClone(s);
    for (const entry of probe.starKey.life.journal) inject(entry);
    for (const c of Object.values(probe.starKey.life.cases)) c.attempts.forEach(inject);
    for (const c of Object.values(probe.planeswalker.life.cases)) c.attempts.forEach(inject);
    inject(probe.planeswalker.life.site);
    expect(projectStarKeyLife(probe)).toEqual(life); expect(projectPlaneswalkerLife(probe)).toEqual(planeswalkerLife);
    publicOnly(life); publicOnly(planeswalkerLife); detached(life, s); detached(planeswalkerLife, s);
    expect(digest(s)).toBe(before); expect(fileDigest()).toBe(FILE_HASH);
  });

  it('routes authentic StarKey outcomes through all three central entrances and the specialised panel', () => {
    const s = migrated(), before = digest(s), panel = projectStarKeyCombat(s), view = projectSliceState(s);
    const terminal = s.combatHistory[s.starKey.encounter.terminal!.historyIndex]!.starKeyOutcome!;
    const publicTerminal = projectStarKeyRoundOutcome(terminal);
    expect(panel.lastActionSequence).toEqual([...publicTerminal.playerActions, ...publicTerminal.enemyActions].sort((a, b) => a.order - b.order));
    expect(view.lastCombatRound!.starKeyOutcome).toEqual(projectPlayerText(publicTerminal, s.character.name));
    expect(view.starKey.life.ledger).toEqual(projectPlayerText({ ledger: s.starKey.life.journal.map(visibleLife) }, s.character.name).ledger);
    publicOnly(panel); detached(panel, s);
    for (const index of [20, 29]) {
      const probe = structuredClone(s), round = structuredClone(probe.combatHistory[index]!);
      const expected = projectPlayerText(projectStarKeyRoundOutcome(round.starKeyOutcome!), s.character.name);
      inject(round.starKeyOutcome); routeRound(probe, round, index);
      const probeBefore = digest(probe), result = projectSliceState(probe);
      for (const entry of [result.lastCombatRound!, result.combatHistory[index]!, result.combat!.lastRound!]) {
        expect(entry.starKeyOutcome).toEqual(expected); publicOnly(entry); detached(entry, probe);
      }
      expect(digest(probe)).toBe(probeBefore);
    }
    const panelProbe = structuredClone(s);
    inject(panelProbe.starKey.encounter.scene); inject(panelProbe.starKey.encounter.materials); inject(panelProbe.starKey.encounter.powerUses);
    inject(panelProbe.combatHistory[panelProbe.starKey.encounter.terminal!.historyIndex]!.starKeyOutcome);
    expect(projectStarKeyCombat(panelProbe)).toEqual(panel);
    expect(digest(s)).toBe(before); expect(fileDigest()).toBe(FILE_HASH);
  }, 60_000);

  it('filters Planeswalker helpers, panel and three entrances using only a labeled projection probe', () => {
    const s = migrated(), before = digest(s), raw = planeswalkerBoundaryProbe(s), expected = visibleOutcome(raw);
    expect(projectPlaneswalkerRoundOutcome(raw)).toEqual(expected);
    const probe = structuredClone(raw); inject(probe); const probeBefore = digest(probe);
    const publicRound = projectPlaneswalkerRoundOutcome(probe);
    expect(publicRound).toEqual(expected); publicOnly(publicRound); detached(publicRound, probe); expect(digest(probe)).toBe(probeBefore);
    const routing = structuredClone(s), round = { ...structuredClone(s.combatHistory[0]!), planeswalkerOutcome: probe };
    routeRound(routing, round, 0); const routingBefore = digest(routing), view = projectSliceState(routing);
    for (const entry of [view.lastCombatRound!, view.combatHistory[0]!, view.combat!.lastRound!]) {
      expect(entry.planeswalkerOutcome).toEqual(projectPlayerText(publicRound, s.character.name)); publicOnly(entry); detached(entry, routing);
    }
    expect(digest(routing)).toBe(routingBefore);
    const panelState = structuredClone(s); panelState.progression.sequence = 2;
    panelState.combat = { encounterId: 'PLANESWALKER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
      enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: round };
    const panel = projectPlaneswalkerCombat(panelState);
    expect(panel).not.toHaveProperty('source'); expect(panel.site).toEqual(s.planeswalker.life.site);
    expect(panel.lastActionSequence).toEqual([...publicRound.playerActions.map(a => ({ ...a, actor: 'PLAYER' })),
      ...publicRound.enemyActions.map(a => ({ ...a, actor: 'ENEMY' }))].sort((a, b) => a.order - b.order));
    publicOnly(panel); detached(panel, panelState);
    inject(panelState.planeswalker.life.site); inject(panelState.planeswalker.encounter.startSite); inject(panelState.planeswalker.encounter.powerUses);
    expect(projectPlaneswalkerCombat(panelState)).toEqual(panel);
    expect(digest(s)).toBe(before); expect(digest(captured())).toBe(FINAL_HASH); expect(fileDigest()).toBe(FILE_HASH);
  }, 60_000);
});
