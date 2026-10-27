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
import { ERROR_ASCENT_ABILITY_IDS, type ErrorAscentCommand } from '../../src/domain/error-ascent/types.js';
import { ERROR_ASCENT_HOME } from '../../src/domain/error-ascent/content.js';
import { ERROR_ASCENT_CONSUMPTION, ERROR_ASCENT_MATERIAL_POLICY } from '../../src/domain/error-ascent/material-content.js';
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

  it('keeps an ordinary surviving failure, real retreat and paid next-week recovery of the same residues', () => {
    const before = route.beforeReplace;
    const input = getErrorRitualCheckInput(before.errorAscent.ritual!, errorAscentRitualHost(before.errorAscent, 'PREVIEW', before.revision + 1));
    // Choose a legal ordinary failure from the actual current chance. Neither
    // the product seed nor any later draw is altered to manufacture survival.
    const roll = Math.max(6, computeCheckChance(input) + 1);
    expect(roll).toBeLessThan(96);
    const check = resolveNormalCheck({ ...input, roll });
    expect(check.tier).toBe('FAILURE');
    const control = installControlledErrorAscentReplacement(roll);
    try {
      const session = openErrorAscentRuntimeSession(before), failed = stepErrorAscent(session, route.replace);
      const compound = failed.errorAscent.materials!.compounds[0]!, place = compound.location;
      const seal: ErrorAscentCommand = { type: 'MATERIAL', command: { type: 'SEAL_REMAINS', compoundId: compound.id } };
      const recover: ErrorAscentCommand = { type: 'MATERIAL', command: { type: 'RECOVER_SEALED', compoundId: compound.id } };
      expect(failed).toMatchObject({ status: 'ACTIVE', ending: null, progression: { sequence: 1, acting: 100 },
        random: { seed: before.random.seed, cursor: ERROR_ASCENT_CONTROLLED_CURSOR + 1 } });
      expect(failed.lastCheck).toEqual(check);
      expect(failed.health).toBe(before.health - ERROR_ASCENT_CONSUMPTION.failureHealth);
      expect(failed.mind).toBe(before.mind - ERROR_ASCENT_CONSUMPTION.mind - ERROR_ASCENT_CONSUMPTION.failureMind);
      expect(failed.spirituality).toBe(before.spirituality - ERROR_ASCENT_CONSUMPTION.spirituality);
      expect(failed.actionsRemaining).toBe(before.actionsRemaining - ERROR_ASCENT_CONSUMPTION.actions);
      expect(failed.cash).toBe(before.cash);
      expect(failed.seer.pollution).toBe(before.seer.pollution + ERROR_ASCENT_CONSUMPTION.failurePollution);
      expect(failed.injuries.at(-1)).toMatchObject({ severity: 'HEAVY', acquiredRevision: failed.revision, treatedRevision: null });
      expect(failed.errorAscent.ritual).toMatchObject({ phase: 'SETTLED', player: { outcome: 'FAILED_ALIVE', position: 'OUTER_CONTACT' },
        candidate: { sequence: 0 }, candidateOutcome: 'ASCENDED' });
      expect(compound.status).toBe('FAILED_EXPOSED');
      expect(failed.errorAscent.materials!.settlements).toHaveLength(1);
      expect(failed.errorAscent.materials!.settlements[0]).toMatchObject({ compoundId: compound.id, success: false, alive: true });
      expect(failed.errorAscent.promotionStability.preparations.at(-1)!.status).toBe('SPENT');
      const failedHash = errorAscentScenarioHash(failed);
      for (const command of [seal, { type: 'RETURN_ON_FOOT' } as const, route.replace])
        expect(() => session.prepare({ type: 'ERROR_ASCENT', command }, failed.revision)).toThrow();
      expect(errorAscentScenarioHash(session.snapshot())).toBe(failedHash);

      let state = failed;
      const step = (command: ErrorAscentCommand) => {
        state = stepErrorAscent(session, command);
        expect(state.status).toBe('ACTIVE');
        expect(state.random).toEqual(failed.random);
        expect(state.health).toBe(failed.health); expect(state.mind).toBe(failed.mind);
        expect(state.spirituality).toBe(failed.spirituality); expect(state.injuries).toEqual(failed.injuries);
        expect(errorAscentInheritedHash(state)).toBe(errorAscentInheritedHash(route.source));
        return state;
      };
      const retreated = step({ type: 'RITUAL', command: { type: 'RETREAT' } });
      expect(retreated.errorAscent.ritual!.player.position).toBe('OUTSIDE');
      expect(retreated.errorAscent.frame!.nowSecond - failed.errorAscent.frame!.nowSecond).toBe(6);
      expect([retreated.cash, retreated.actionsRemaining]).toEqual([failed.cash, failed.actionsRemaining]);
      const sealed = step(seal);
      expect(sealed.errorAscent.materials!.compounds[0]).toMatchObject({ id: compound.id, status: 'FAILED_SEALED', sealedWeek: sealed.week });
      expect(sealed.errorAscent.frame!.nowSecond - retreated.errorAscent.frame!.nowSecond).toBe(ERROR_ASCENT_MATERIAL_POLICY.sealSeconds);
      expect([sealed.cash, sealed.actionsRemaining]).toEqual([retreated.cash, retreated.actionsRemaining]);
      for (const item of [...sealed.errorAscent.materials!.characteristics, sealed.errorAscent.materials!.uniqueness])
        expect(item.holder).toBe('originBottleId' in item && item.originBottleId === sealed.errorAscent.materials!.embodiedOriginalBottleId ? 'EMBODIED' : 'SEALED');
      expect(() => session.prepare({ type: 'ERROR_ASCENT', command: recover }, sealed.revision)).toThrow();
      expect(session.snapshot()).toEqual(sealed);
      const home = step({ type: 'RETURN_ON_FOOT' });
      expect(home.errorAscent.frame!.location).toBe(ERROR_ASCENT_HOME);
      expect(home.errorAscent.frame!.nowSecond - sealed.errorAscent.frame!.nowSecond).toBe(7200);
      expect([home.cash, home.actionsRemaining]).toEqual([sealed.cash, sealed.actionsRemaining]);
      expect(home.errorAscent.materials!.uniqueness).toMatchObject({ holder: 'SEALED', location: place });
      const nextWeek = step({ type: 'NEXT_WEEK' });
      expect(nextWeek.week).toBe(sealed.week + 1);
      expect(nextWeek.errorAscent.frame!.nowSecond).toBe(home.errorAscent.frame!.weekAnchor + 604800);
      expect(nextWeek.cash).toBeLessThan(home.cash);
      expect(nextWeek.errorAscent.journal.at(-1)!.financeReceipts.length).toBeGreaterThan(0);
      const paid = step({ type: 'WORK' });
      expect(paid.cash).toBe(nextWeek.cash + route.source.character.weeklyWage);
      expect(paid.actionsRemaining).toBe(nextWeek.actionsRemaining - 1);
      const returned = step({ type: 'TRAVEL', to: place });
      expect(returned.actionsRemaining).toBe(paid.actionsRemaining - 1);
      expect(returned.cash).toBe(paid.cash);
      const recovered = step(recover), material = recovered.errorAscent.materials!;
      expect(ERROR_ASCENT_MATERIAL_POLICY.sealedRecoveryFee).toBe(60);
      expect(recovered.cash).toBe(returned.cash - 60);
      expect(recovered.actionsRemaining).toBe(returned.actionsRemaining - 1);
      expect(recovered.errorAscent.frame!.nowSecond - returned.errorAscent.frame!.nowSecond).toBe(ERROR_ASCENT_MATERIAL_POLICY.operationSeconds);
      expect(material.compounds).toHaveLength(1);
      expect(material.compounds[0]).toMatchObject({ id: compound.id, batchId: compound.batchId,
        characteristicIds: compound.characteristicIds, uniquenessId: compound.uniquenessId, status: 'RECOVERED' });
      expect(material.characteristics.map(c => [c.id, c.originBottleId, c.latestBottleId])).toEqual(
        before.errorAscent.materials!.characteristics.map(c => [c.id, c.originBottleId, c.latestBottleId]));
      for (const item of material.characteristics)
        expect(item.holder).toBe(item.originBottleId === material.embodiedOriginalBottleId ? 'EMBODIED' : 'PLAYER');
      expect(material.uniqueness).toMatchObject({ id: before.errorAscent.materials!.uniqueness.id, holder: 'PLAYER', location: place });
      expect(material.batches.map(b => [b.id, b.status, b.uses])).toEqual([[compound.batchId, 'SPENT', 1]]);
      expect(material.settlements).toEqual(failed.errorAscent.materials!.settlements);
      expect(recovered.errorAscent.promotionWeek).toBeNull();
      expect(recovered.errorAscent.ritual!.booking).toEqual(before.errorAscent.ritual!.booking);
      expect(recovered.errorAscent.ritual!.player.attemptedAt).toBe(failed.errorAscent.ritual!.player.attemptedAt);
      const closedHash = errorAscentScenarioHash(recovered);
      for (const command of [route.replace, { type: 'RITUAL', command: { type: 'BRIEF' } } as const, recover])
        expect(() => session.prepare({ type: 'ERROR_ASCENT', command }, recovered.revision)).toThrow();
      expect(errorAscentScenarioHash(session.snapshot())).toBe(closedHash);
      const final = step({ type: 'RETURN_ON_FOOT' });
      expect(final.errorAscent.frame!.location).toBe(ERROR_ASCENT_HOME);
      expect([final.cash, final.actionsRemaining]).toEqual([recovered.cash, recovered.actionsRemaining]);
      expect(final.errorAscent.materials!.uniqueness).toMatchObject({ holder: 'PLAYER', location: ERROR_ASCENT_HOME });
      expect(final.progression.mastery).toEqual(route.source.progression.mastery);
      expect(final.errorAscent.journal.flatMap(e => e.randomReceipts)).toHaveLength(1);
      assertValidSliceState(final);
      expect(errorAscentScenarioHash(migrateSliceState(structuredClone(final)))).toBe(errorAscentScenarioHash(final));
      expect(control.substituted.every(x => x.cursorBefore === 397 && x.cursorAfter === 398 && x.controlled === roll)).toBe(true);
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
