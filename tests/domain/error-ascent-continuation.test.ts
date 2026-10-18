/** Controlled future continuations, not naturally obtained S0 evidence.
 * The retained 656-command S1 snapshot is read unchanged, never replayed by this
 * fixture. Only its next d100 (cursor 397) is controlled; all new work is real. */
import { beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { openErrorAscentRuntimeSession } from '../../src/domain/error-ascent/owned-session.js';
import { errorAscentRitualHost, getErrorAscentEpilogueCheckPreview } from '../../src/domain/error-ascent/engine.js';
import { getErrorRitualCheckInput } from '../../src/domain/error-ascent/ritual.js';
import { getErrorAscentEpilogueCheckInput } from '../../src/domain/error-ascent/epilogue.js';
import { ERROR_ASCENT_ABILITY_IDS } from '../../src/domain/error-ascent/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  assertUnmodifiedErrorAscentInput, errorAscentInheritedHash, errorAscentPublicLeaks,
  errorAscentScenarioHash, installControlledErrorAscentReplacement, preparedErrorAscentRoute,
  stepErrorAscent, type PreparedErrorAscentRoute, ERROR_ASCENT_CONTROLLED_CURSOR,
} from '../helpers/error-ascent-scenario.js';

const budget = 300_000;
let route: PreparedErrorAscentRoute;
beforeAll(() => { route = preparedErrorAscentRoute(); }, budget);

describe('Error219 controlled authentic-history continuation', () => {
  it('admits the unchanged S1 source and keeps previews and uncommitted drafts pure', () => {
    const session = openErrorAscentRuntimeSession(route.beforeReplace), hash = errorAscentScenarioHash(session.snapshot());
    expect(route.commands.some(c => c.type === 'WORK')).toBe(true);
    expect(route.commands.some(c => c.type === 'CLINIC')).toBe(true);
    expect(route.commands.some(c => c.type === 'REST')).toBe(true);
    expect(route.commands.some(c => c.type === 'WAIT_FOR_PREPARATION')).toBe(true);
    expect(route.replace).toEqual({ type: 'RITUAL', command: { type: 'REPLACE', confirmed: true } });
    expect(route.beforeReplace.random).toEqual(route.source.random);
    expect(route.beforeReplace.injuries).toEqual([]);
    const preparation = route.beforeReplace.errorAscent.promotionStability.preparations.at(-1)!;
    expect(preparation.status).toBe('READY');
    expect(preparation.expiresSecond).toBeGreaterThan(route.beforeReplace.errorAscent.frame!.nowSecond + 4);
    for (let i = 0; i < 3; i++) {
      const panel = session.projectErrorAscent();
      expect(panel.actions.find(a => a.preferredAction)).toMatchObject({ enabled: true, command: route.replace });
      expect(errorAscentPublicLeaks(panel)).toEqual([]);
      expect(errorAscentScenarioHash(session.snapshot())).toBe(hash);
    }
    const retreat = session.prepare({ type: 'ERROR_ASCENT', command: { type: 'RITUAL', command: { type: 'RETREAT' } } }, route.beforeReplace.revision);
    expect(session.inspectDraft(retreat).revision).toBe(route.beforeReplace.revision + 1);
    expect(errorAscentScenarioHash(session.snapshot())).toBe(hash);
    session.discard(retreat);
    expect(() => session.commit(retreat)).toThrow();
    expect(errorAscentScenarioHash(session.snapshot())).toBe(hash);
    expect(() => applySliceIntent(route.guided, { type: 'ERROR_ASCENT', command: { type: 'LEARN_GUIDANCE' } })).toThrow();
    const fake = structuredClone(route.source); fake.progression.sequence = 0;
    expect(() => assertValidSliceState(fake)).toThrow();
    expect(errorAscentInheritedHash(route.beforeReplace)).toBe(errorAscentInheritedHash(route.source));
    assertUnmodifiedErrorAscentInput();
  }, budget);

  it('commits a controlled successful replacement, strict cold reopen and private/public boundaries', () => {
    const control = installControlledErrorAscentReplacement(1);
    try {
      const session = openErrorAscentRuntimeSession(route.beforeReplace), before = session.snapshot();
      expect(control.substituted).toEqual([]);
      const input = getErrorRitualCheckInput(before.errorAscent.ritual!, errorAscentRitualHost(before.errorAscent, 'PREVIEW', before.revision + 1));
      const promoted = stepErrorAscent(session, route.replace);
      expect(promoted).toMatchObject({ status: 'ACTIVE', progression: { pathwayId: 'error', sequence: 0, acting: 0 },
        random: { cursor: ERROR_ASCENT_CONTROLLED_CURSOR + 1 } });
      expect(promoted.lastCheck).toEqual(resolveNormalCheck({ ...input, roll: 1 }));
      expect(promoted.character.coreStats).toEqual(route.source.character.coreStats);
      for (const [id, value] of Object.entries(route.source.progression.mastery)) expect(promoted.progression.mastery[id], id).toBe(value);
      for (const id of ERROR_ASCENT_ABILITY_IDS) expect(promoted.progression.mastery[id]).toBe(0);
      expect(promoted.errorAscent.ritual).toMatchObject({ player: { outcome: 'ASCENDED' }, candidate: { sequence: 1 }, candidateOutcome: 'DISPLACED_ALIVE' });
      expect(promoted.errorAscent.materials!.characteristics.every(c => c.holder === 'FUSED')).toBe(true);
      expect(promoted.errorAscent.materials!.uniqueness.holder).toBe('FUSED');
      expect(promoted.errorAscent.materials!.compounds[0]!.status).toBe('SUCCESS');
      expect(promoted.errorAscent.promotionStability.preparations.at(-1)!.status).toBe('SPENT');
      expect(errorAscentInheritedHash(promoted)).toBe(errorAscentInheritedHash(route.source));
      const hash = errorAscentScenarioHash(promoted);
      assertValidSliceState(promoted);
      expect(errorAscentScenarioHash(migrateSliceState(structuredClone(promoted)))).toBe(hash);
      expect(errorAscentScenarioHash(openErrorAscentRuntimeSession(structuredClone(promoted)).snapshot())).toBe(hash);
      const view = projectSliceState(promoted);
      expect(view).toMatchObject({ canAct: false, maxSpirituality: 150, errorAscent: { promoted: true, resources: { maxSpirituality: 150 } } });
      expect(errorAscentPublicLeaks(view)).toEqual([]);
      for (const privateValue of [promoted.random.seed, promoted.errorAscent.source!.actorId, promoted.errorAscent.source!.historyDigest])
        expect(JSON.stringify(view).includes(privateValue)).toBe(false);
      expect(view.errorAscent.actions.some(a => a.enabled && a.command.type === 'RITUAL' && a.command.command.type === 'RETREAT')).toBe(true);
      for (const type of ['STEAL_MOVEMENT', 'DIVERT_RELEASE'] as const) {
        const spec = getErrorAscentEpilogueCheckInput({ type })!;
        expect(getErrorAscentEpilogueCheckPreview(promoted.errorAscent, type)!.chance).toBe(computeCheckChance({
          baseAbility: promoted.character.coreStats[spec.ability], difficulty: spec.difficulty, modifiers: [{ source: spec.source, value: spec.modifier }],
        }));
      }
      expect(errorAscentScenarioHash(promoted)).toBe(hash);
      expect(control.substituted.length).toBeGreaterThan(0);
      expect(control.substituted.every(x => x.cursorBefore === 397 && x.cursorAfter === 398 && x.controlled === 1)).toBe(true);
      assertUnmodifiedErrorAscentInput();
    } finally { control.restore(); }
  }, budget);

  it('retains a controlled fatal future attempt, conserved residues and the independent candidate outcome', () => {
    const control = installControlledErrorAscentReplacement(100);
    try {
      const session = openErrorAscentRuntimeSession(route.beforeReplace), dead = stepErrorAscent(session, route.replace);
      expect(dead).toMatchObject({ status: 'DEAD', health: 0, progression: { sequence: 1 },
        random: { cursor: ERROR_ASCENT_CONTROLLED_CURSOR + 1 }, lastCheck: { roll: 100, tier: 'GREAT_FAILURE' } });
      expect(dead.errorAscent.promotionWeek).toBeNull();
      expect(dead.errorAscent.ritual).toMatchObject({ phase: 'SETTLED', player: { outcome: 'DEAD' }, candidate: { sequence: 0 }, candidateOutcome: 'ASCENDED' });
      expect(dead.errorAscent.ritual!.candidateSettledAt).not.toBeNull();
      const material = dead.errorAscent.materials!;
      expect(material.compounds[0]!.status).toBe('DEATH_EXPOSED');
      expect(material.characteristics).toHaveLength(3);
      for (const item of [...material.characteristics, material.uniqueness])
        expect(item).toMatchObject({ holder: 'EXPOSED', location: dead.errorAscent.frame!.location });
      expect(material.batches.map(b => [b.status, b.uses])).toEqual([['SPENT', 1]]);
      expect(material.settlements).toHaveLength(1);
      expect(material.settlements[0]).toMatchObject({ success: false, alive: false });
      expect(dead.errorAscent.promotionStability.preparations.at(-1)!.status).toBe('SPENT');
      expect(dead.progression.mastery).toEqual(route.source.progression.mastery);
      expect(errorAscentInheritedHash(dead)).toBe(errorAscentInheritedHash(route.source));
      const hash = errorAscentScenarioHash(dead);
      assertValidSliceState(dead);
      expect(errorAscentScenarioHash(migrateSliceState(structuredClone(dead)))).toBe(hash);
      expect(() => session.prepare({ type: 'ERROR_ASCENT', command: route.replace }, dead.revision)).toThrow();
      expect(errorAscentScenarioHash(session.snapshot())).toBe(hash);
      expect(session.projectErrorAscent().actions.every(a => !a.enabled)).toBe(true);
      assertUnmodifiedErrorAscentInput();
    } finally { control.restore(); }
  }, budget);
});
