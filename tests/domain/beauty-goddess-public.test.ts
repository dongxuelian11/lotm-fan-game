import { projectPlayerText } from '../../src/shared/player-text.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import {
  BEAUTY_GODDESS_COMBAT_CONSTANTS, BEAUTY_GODDESS_COUNT_WHEEL, BEAUTY_GODDESS_ENEMY_ABILITY_WHEEL,
  projectBeautyGoddessCombat, type BeautyGoddessActionEvidence, type BeautyGoddessRoundOutcome,
} from '../../src/domain/beauty-goddess/combat.js';
import { projectBeautyGoddessLife, type BeautyGoddessLifeReceipt } from '../../src/domain/beauty-goddess/life.js';
import { projectBeautyGoddessAction, projectBeautyGoddessPublicCombat, projectBeautyGoddessRoundOutcome } from '../../src/domain/beauty-goddess/public.js';
import { projectBeautyGoddessLifeReceipt } from '../../src/domain/beauty-goddess/public-life.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const ROOT = 'tests/fixtures/beauty-goddess-v01900';
const CAPTURES = [
  ['natural.json', '6c797e81ca08b1140089a3bf22179f19b58f687e95df31a5b20a0508cf88e1a1'],
  ['boundary-combat-round-1.json', '84bbf317d0d4c39abd6bd82a1ae12e1cd2f9907addd04b2e6f4949fb75b907bd'],
] as const;
const captured = (file = 'natural.json') => readObjectEntry<SliceState>(`${ROOT}/${file}`, 'final');
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const fileDigest = (file: string) => createHash('sha256').update(readFileSync(`${ROOT}/${file}`)).digest('hex');
const rounds = (s: SliceState) => s.combatHistory.filter(r => r.beautyGoddessOutcome);
function withoutActionReplay(a: BeautyGoddessActionEvidence) {
  const { randomCursorBefore: _before, randomCursorAfter: _after, ...facts } = structuredClone(a);
  return facts;
}
function withoutOutcomeReplay(o: BeautyGoddessRoundOutcome) {
  const { source: _source, randomCursorAfter: _cursor, playerActions, enemyActions, ...facts } = structuredClone(o);
  return { ...facts, playerActions: playerActions.map(withoutActionReplay), enemyActions: enemyActions.map(withoutActionReplay) };
}
function withoutLifeReplay(e: BeautyGoddessLifeReceipt) {
  const { randomCursor: _cursor, randomBefore: _before, randomAfter: _after, checkBase: _base, ...facts } = structuredClone(e);
  return facts;
}
function assertPublicOnly(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((child, i) => assertPublicOnly(child, `${path}[${i}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(['randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'randomBefore', 'randomAfter',
      'cursorBefore', 'cursorAfter', 'checkBase', 'preparation', 'privateProbe', 'privateMastery'].includes(key), `${path}.${key}`).toBe(false);
    // These strings explain real checks or known original objects/people, not replay input.
    if (key === 'source') expect(path, `${path}.${key}`).toMatch(/(?:\.check\.modifiers\[\d+\]|\.papers\[\d+\]|\.partner|\.guestBefore|\.guestAfter)$/);
    assertPublicOnly(child, `${path}.${key}`);
  }
}
function objects(value: unknown, found = new Set<object>()): Set<object> {
  if (!value || typeof value !== 'object' || found.has(value)) return found;
  found.add(value); Object.values(value).forEach(child => objects(child, found)); return found;
}
function assertDetached(output: unknown, input: unknown): void {
  const originals = objects(input);
  for (const object of objects(output)) expect(originals.has(object), 'public objects must not alias private input').toBe(false);
}
function injectPrivateFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(injectPrivateFields); return; }
  for (const [key, child] of Object.entries(value)) if (key !== 'source') injectPrivateFields(child);
  Object.assign(value, { privateProbe: { randomSeed: 'private-only', randomCursor: 1234 } });
}

describe('Beauty Goddess S1 positive public evidence boundaries', () => {
  it('preserves every resolved fact from both actual old190 rounds without changing private state or capture bytes', () => {
    const state = captured(), before = digest(state), random = structuredClone(state.random);
    expect(rounds(state)).toHaveLength(2);
    for (const round of rounds(state)) {
      const o = round.beautyGoddessOutcome!, source = digest(o.source), projected = projectBeautyGoddessRoundOutcome(o);
      expect(o.source.randomSeed).toBe(state.random.seed);
      expect(o.source.preparation.randomSeed).toBe(state.random.seed);
      expect(projected).toEqual(withoutOutcomeReplay(o));
      expect(projected.enemyInjuries).toEqual(o.enemyInjuries);
      expect(projected.materialsAfter).toEqual(o.materialsAfter);
      expect(projected.rootAfter).toEqual(o.rootAfter);
      expect(projected.papers).toEqual(o.papers);
      assertPublicOnly(projected); assertDetached(projected, o);
      expect(digest(o.source)).toBe(source);
    }
    expect(state.random).toEqual(random); expect(digest(state)).toBe(before);
    for (const [file, sha] of CAPTURES) expect(fileDigest(file)).toBe(sha);
  });

  it('retains actual checks, modifier sources, resistance rolls, costs, body effects and original material positions', () => {
    const state = captured(), actions = rounds(state).flatMap(r => [...r.beautyGoddessOutcome!.playerActions, ...r.beautyGoddessOutcome!.enemyActions]);
    const checked = structuredClone(actions.find(a => a.check)!);
    expect(checked.check).not.toBeNull();
    checked.check = { ...checked.check!, modifiers: [{ source: '公开检定来源，仍应可见', value: 0 }] };
    const before = digest(checked), projected = projectBeautyGoddessAction(checked);
    expect(projected).toEqual(withoutActionReplay(checked));
    expect(projected.check!.modifiers).toEqual([{ source: '公开检定来源，仍应可见', value: 0 }]);
    for (const a of actions) {
      const p = projectBeautyGoddessAction(a);
      expect(p).toEqual(withoutActionReplay(a));
      expect(p).toMatchObject({ paidCost: a.paidCost, mindCost: a.mindCost, rodChargeSpent: a.rodChargeSpent,
        resistanceRoll: a.resistanceRoll, resistanceChance: a.resistanceChance, attackKind: a.attackKind,
        atSeconds: a.atSeconds, elapsedSeconds: a.elapsedSeconds, travelMetres: a.travelMetres });
      expect(p.materialsAfter).toEqual(a.materialsAfter);
    }
    assertPublicOnly({ action: projected }); assertDetached(projected, checked); expect(digest(checked)).toBe(before);
  });

  it('rejects unknown fields at every nested combat boundary without deleting legitimate provenance named source', () => {
    const state = captured();
    for (const round of rounds(state)) {
      const o = structuredClone(round.beautyGoddessOutcome!), source = digest(o.source);
      for (const a of [...o.playerActions, ...o.enemyActions]) if (a.check) a.check = { ...a.check, modifiers: [{ source: '已发生修正的公开来源', value: 0 }] };
      const expected = withoutOutcomeReplay(o);
      injectPrivateFields(o); o.masteryAfter.privateMastery = 42;
      const before = digest(o), actual = projectBeautyGoddessRoundOutcome(o);
      expect(actual).toEqual(expected); assertPublicOnly(actual); assertDetached(actual, o);
      expect(digest(o.source)).toBe(source); expect(digest(o)).toBe(before);
    }
  });

  it('allowlists non-null pending and expired windows as detached public facts in an isolated projection example', () => {
    // The actual capture has no successful windows. This unit-only copy is never replayed or saved as history.
    const o = structuredClone(rounds(captured())[0]!.beautyGoddessOutcome!);
    const window = { id: 'projection-window', kind: 'SELF_POISE' as const, createdAt: 4, expiresAt: 34, targetActionId: null, magnitude: 25, pieceId: null };
    o.expiredWindows = [window]; o.playerActions[0]!.windowsBefore.selfPoise = structuredClone(window);
    o.playerActions[0]!.windowsAfter.moonform = { ...window, kind: 'MOONFORM', targetActionId: 'observed-pending', magnitude: 30, pieceId: 'BG1-BATTLE-MOON-PIECE-1' };
    const expected = withoutOutcomeReplay(o); injectPrivateFields(o);
    const before = digest(o), actual = projectBeautyGoddessRoundOutcome(o);
    expect(actual).toEqual(expected); assertPublicOnly(actual); assertDetached(actual, o); expect(digest(o)).toBe(before);
  });

  it('uses safe detached facts for both live and terminal combat panels and rejects future nested fields', () => {
    for (const [file] of CAPTURES) {
      const state = captured(file), before = digest(state), raw = projectBeautyGoddessCombat(state);
      const expected = { ...raw, lastActionSequence: raw.lastActionSequence.map(withoutActionReplay) };
      const panel = projectBeautyGoddessPublicCombat(state), repeated = projectBeautyGoddessPublicCombat(state);
      expect(panel).toEqual(expected); assertPublicOnly(panel); assertDetached(panel, state); assertDetached(panel, repeated);
      assertDetached(panel.constants, BEAUTY_GODDESS_COMBAT_CONSTANTS);
      assertDetached(panel.countWheel, BEAUTY_GODDESS_COUNT_WHEEL);
      assertDetached(panel.enemyAbilityWheel, BEAUTY_GODDESS_ENEMY_ABILITY_WHEEL);
      assertDetached(panel.countWheel, panel.enemyCountWheel);
      panel.lastActionSequence[0]!.label = 'public copy only'; panel.materials.weapon.charge--;
      panel.partner.restHistory[0]!.staminaAfter--; panel.countWheel[0]!.weight = 0;
      expect(projectBeautyGoddessPublicCombat(state)).toEqual(repeated); expect(digest(state)).toBe(before);

      injectPrivateFields(state.beautyGoddess.encounter.materials); injectPrivateFields(state.beautyGoddess.encounter.powerUses);
      injectPrivateFields(state.summoningMaster.life.partner); injectPrivateFields(state.witchKing.life.papers);
      const o = (state.combat?.lastRound ?? state.combatHistory[state.beautyGoddess.encounter.terminal!.historyIndex])!.beautyGoddessOutcome!;
      injectPrivateFields(o);
      const injected = digest(state), safe = projectBeautyGoddessPublicCombat(state);
      expect(safe).toEqual(repeated); assertPublicOnly(safe); assertDetached(safe, state); expect(digest(state)).toBe(injected);
    }
  });

  it('projects both life ledger and attempt receipts without cursors while preserving actual checks, costs and original guest', () => {
    const state = captured(), before = digest(state), journalBefore = digest(state.beautyGoddess.life.journal), rng = structuredClone(state.random);
    const original = state.beautyGoddess.life.journal, view = projectBeautyGoddessLife(state);
    expect(original).toHaveLength(57); expect(original.filter(e => e.check)).toHaveLength(5);
    expect(view.ledger).toEqual(original.map(withoutLifeReplay));
    expect(view.practice).toEqual(state.beautyGoddess.life.practice);
    let attemptReceipts = 0;
    for (const c of view.cases) for (const attempt of c.attempts) for (const e of attempt.receipts) {
      const raw = original.find(r => r.revision === e.revision)!;
      expect(e).toEqual(withoutLifeReplay(raw)); assertPublicOnly(e); assertDetached(e, raw); attemptReceipts++;
    }
    expect(attemptReceipts).toBeGreaterThan(0);
    for (const e of view.ledger) { assertPublicOnly(e); assertDetached(e, original); }
    expect(view.ledger.some(e => e.check?.modifiers.some(m => m.source.length > 0))).toBe(true);
    expect(view.ledger.some(e => e.before.cash > e.after.cash)).toBe(true);
    expect(view.ledger.some(e => e.guestWalkedMetres > 0)).toBe(true);
    expect(digest(state.beautyGoddess.life.journal)).toBe(journalBefore); expect(state.random).toEqual(rng); expect(digest(state)).toBe(before);
  });

  it('rejects unknown nested life receipt fields and keeps genuine public modifier and guest provenance', () => {
    const state = captured();
    for (const e of state.beautyGoddess.life.journal) {
      const expected = withoutLifeReplay(e); injectPrivateFields(e);
      const before = digest(e), actual = projectBeautyGoddessLifeReceipt(e);
      expect(actual).toEqual(expected); assertPublicOnly(actual); assertDetached(actual, e); expect(digest(e)).toBe(before);
    }
    const before = digest(state), view = projectBeautyGoddessLife(state);
    for (const e of view.ledger) assertPublicOnly(e);
    for (const c of view.cases) for (const a of c.attempts) for (const e of a.receipts) assertPublicOnly(e);
    expect(digest(state)).toBe(before);
  });

  it('routes current last, history, live combat and life receipts through public mappings without rewriting old190 captures', async () => {
    const { projectSliceState } = await import('../../src/domain/slice/index.js');
    const { migrateSliceState } = await import('../../src/domain/slice/migration.js');
    for (const [file, sha] of CAPTURES) {
      const state = migrateSliceState(captured(file)), before = digest(state), rng = structuredClone(state.random);
      const view = projectSliceState(state), last = view.lastCombatRound!.beautyGoddessOutcome!;
      expect(last).toEqual(projectPlayerText(withoutOutcomeReplay(state.lastCombatRound!.beautyGoddessOutcome!), state.character.name)); assertPublicOnly(last);
      const history = view.combatHistory.filter(r => r.beautyGoddessOutcome);
      expect(history.at(-1)!.beautyGoddessOutcome).toEqual(last);
      history.forEach(r => assertPublicOnly(r.beautyGoddessOutcome));
      if (view.combat) {
        expect(view.combat.lastRound!.beautyGoddessOutcome).toEqual(last); assertPublicOnly(view.combat.beautyGoddess);
      }
      for (const e of view.beautyGoddess.life.ledger) assertPublicOnly(e);
      expect(state.random).toEqual(rng); expect(digest(state)).toBe(before); expect(fileDigest(file)).toBe(sha);
    }
  }, 30_000);
});
