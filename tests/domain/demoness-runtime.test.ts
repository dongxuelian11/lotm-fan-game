import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { openDemonessRuntimeSession, type DemonessRuntimeSession } from '../../src/domain/demoness/owned-session.js';
import { getDemonessPromotionStabilityPreview } from '../../src/domain/demoness/engine.js';
import { validateDemonessCommand } from '../../src/domain/demoness/index.js';
import { DEMONESS_ABILITY_IDS, DEMONESS_ORIGINAL_IDS, DEMONESS_RESIDENT_IDS,
  type DemonessCommand, type DemonessPassageCommand } from '../../src/domain/demoness/types.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import {
  assertDemonessSourceUnmodified, preparedDemonessScenario, demonessInheritedHash,
  demonessHash, commitDemoness, executeDemoness, controlledDemonessRolls, demonessPublicLeaks,
} from '../helpers/demoness-scenario.js';

let route: ReturnType<typeof preparedDemonessScenario>;
beforeAll(() => { route = preparedDemonessScenario(); }, 120_000);
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });
afterAll(() => { assertDemonessSourceUnmodified(); });
const session = () => openDemonessRuntimeSession(structuredClone(route.beforeConsume));
const consume = (): DemonessCommand => ({ type: 'CONSUME', compoundId: route.beforeConsume.demoness.materials!.compounds[0]!.id, confirmed: true });
const passage = (s: DemonessRuntimeSession, command: DemonessPassageCommand) => commitDemoness(s, { type: 'PASSAGE', command });
function readyReturn(s: DemonessRuntimeSession): void {
  // Earn actual wages and pay actual living bills before entering; never patch AP or cash.
  for (let n = 0; n < 30; n++) {
    const p = s.projectDemoness();
    const resourcesReady = p.resources.spirituality >= 26 && p.resources.mind >= 20;
    if (parseInt(p.resources.cash, 10) >= 150 && p.resources.actionsRemaining >= 2 && resourcesReady) break;
    if (n === 29) throw Error('Unable to fund the finite return route.');
    const neededRest = !resourcesReady && p.actions.find(a => a.command.type === 'REST' && a.enabled);
    const work = p.actions.find(a => a.command.type === 'WORK' && a.enabled);
    commitDemoness(s, neededRest ? neededRest.command : work?.command ?? { type: 'NEXT_WEEK' });
  }
  commitDemoness(s, { type: 'TRAVEL', to: 'DM221-ARCH' });
  passage(s, { type: 'START_RETURN' }); passage(s, { type: 'BUY_RETURN_KIT' });
  // Three actual new-week actions cover two attempts and an ordinary fallback.
  commitDemoness(s, { type: 'NEXT_WEEK' });
  for (let n = 0; n < 8; n++) {
    const rest = s.projectDemoness().actions.find(a => a.command.type === 'PASSAGE' && a.command.command.type === 'REST_OUTSIDE' && a.enabled);
    if (!rest) break; commitDemoness(s, rest.command);
  }
  for (const residentId of DEMONESS_RESIDENT_IDS) passage(s, { type: 'ASK_RESIDENT', residentId });
  for (const residentId of DEMONESS_RESIDENT_IDS) passage(s, { type: 'ARRIVE_RESIDENT', residentId });
  passage(s, { type: 'WALK', to: 3 });
}

describe('Demoness218 actual recovered S1 source and finite paid runtime', () => {
  it('admits the genuine reflected S1 at current OUTSIDE positions without changing eight earlier roots or S1', () => {
    const { source, guided, beforeConsume } = route, live = source.apocalypseDemoness.life.site!;
    expect(source).toMatchObject({ status: 'ACTIVE', progression: { pathwayId: 'demoness', sequence: 1, acting: 100 } });
    expect(source.apocalypseDemoness.life.reflected).toBe(true);
    expect([live.playerLocation, live.vera!.location, live.marcus!.location]).toEqual(['OUTSIDE', 'OUTSIDE', 'OUTSIDE']);
    expect(guided).toMatchObject({ cash: source.cash - 100, actionsRemaining: source.actionsRemaining - 1 });
    expect(guided.demoness.source!.originals.liveSite).toEqual(live);
    expect(guided.demoness.source!.originals.inheritedAtGuidance).toEqual(source.apocalypseDemoness.sourceScene!.originals);
    expect(guided.demoness.passage!.playerEnergy).toBe(live.playerEnergy);
    expect(demonessInheritedHash(beforeConsume)).toBe(demonessInheritedHash(source));
    expect(beforeConsume.character).toEqual(source.character);
    expect(beforeConsume.progression.mastery).toEqual(source.progression.mastery);
    expect(source.apocalypseDemoness.bottles.filter(b => b.consumedWeek !== null && (b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS'))).toHaveLength(1);
  });

  it('pays for actual passage, three conserved original identities, one uniqueness and the same-body prepared chance', () => {
    const s = route.beforeConsume, root = s.demoness, m = root.materials!, p = root.passage!, compound = m.compounds[0]!;
    expect(m.characteristics.map(c => c.originalId).sort()).toEqual([...DEMONESS_ORIGINAL_IDS].sort());
    expect(new Set(m.characteristics.map(c => c.id)).size).toBe(3);
    expect(m.characteristics.filter(c => c.holder === 'EMBODIED')).toHaveLength(1);
    expect(m.characteristics.filter(c => c.holder === 'COMPOUND')).toHaveLength(2);
    expect(compound.characteristicIds).toEqual(m.characteristics.map(c => c.id));
    expect(compound.uniquenessId).toBe(m.uniqueness.id); expect(m.uniqueness.holder).toBe('COMPOUND');
    expect(m.succession).toMatchObject({ formerOwnerAlive: false, objectCount: 1, currentIncumbent: null, custody: { custodyOnly: true } });
    expect(m.carriers.map(c => c.status)).toEqual(['SPENT', 'SUPPLIER', 'SUPPLIER']);
    expect(p.supports).toHaveLength(2); expect(p.supports.every(x => x.fittedEventId && x.passagesRemaining === 0)).toBe(true);
    expect(p.residents.every(r => r.position === -2 && r.walkedMetres >= 20 && r.passage?.a && r.passage.b && r.passage.exit)).toBe(true);
    expect(s.week - root.source!.actualS1PromotionWeek).toBeGreaterThanOrEqual(12);
    expect(root.journal.some(e => e.command.type === 'WORK')).toBe(true);
    expect(root.journal.some(e => e.financeReceipts.length > 0)).toBe(true);
    const preparation = [...root.journal].reverse().find(e => e.command.type === 'STABILIZE_PROMOTION')!;
    for (const [key, cost] of [['cash', 150], ['actions', 1], ['spirituality', 12], ['mind', 8]] as const)
      expect(preparation.after.budget[key]).toBe(preparation.before.budget[key] - cost);
    const preview = getDemonessPromotionStabilityPreview(root, compound.id);
    expect(preview.prepared).toBe(true);
    expect(route.session.projectDemoness().actions.find(a => a.preferredAction)?.command.type).toBe('CONSUME');
    expect(preview.chance).toBe(computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 57,
      modifiers: [{ source: '同一本人的同瓶实际稳定准备', value: 40 }] }));
    expect(preview.chance).toBeGreaterThanOrEqual(60); expect(preview.chance).toBeLessThanOrEqual(80);
    expect(route.session.projectDemoness().actions.find(a => a.command.type === 'CONSUME')!.cost).toContain(preview.chance + '%');
  });

  it('discards private drafts, rejects result-bearing commands and exposes no replay authority', () => {
    const s = route.session, hash = demonessHash(s.snapshot());
    const draft = s.prepare({ type: 'DEMONESS', command: { type: 'RETURN_ON_FOOT' } }, s.inspect().revision);
    const copy = s.snapshotDraft(draft); copy.cash = 999999;
    expect(s.snapshotDraft(draft).cash).not.toBe(999999);
    s.discard(draft); expect(() => s.commit(draft)).toThrow();
    expect(demonessHash(s.snapshot())).toBe(hash);
    expect(() => s.prepare({ type: 'ACTION', action: 'WORK' }, s.inspect().revision)).toThrow();
    expect(validateDemonessCommand({ ...consume(), roll: 1 })).toBe(false);
    expect(validateDemonessCommand({ type: 'PASSAGE', command: { type: 'PETRIFY_STONE', success: true } })).toBe(false);
    for (const view of [projectSliceState(route.source), s.project()]) expect(demonessPublicLeaks(view)).toEqual([]);
  }, 60_000);

  it('controlled S0 success fuses only the original bodies, pays costs and adds two zero skills without refilling', () => {
    const before = route.beforeConsume, restore = controlledDemonessRolls(before, { [before.random.cursor]: 1 });
    try {
      const s = session(), result = executeDemoness(s, consume()), m = result.demoness.materials!;
      expect(result.progression.sequence).toBe(0); expect(result.progression.acting).toBe(0);
      expect(result.spirituality).toBe(before.spirituality - 30); expect(result.mind).toBe(before.mind - 12);
      expect(result.health).toBe(before.health); expect(result.cash).toBe(before.cash);
      expect(result.random).toEqual({ seed: before.random.seed, cursor: before.random.cursor + 1 });
      expect(m.characteristics.map(c => c.id)).toEqual(before.demoness.materials!.characteristics.map(c => c.id));
      expect(m.characteristics.every(c => c.holder === 'FUSED')).toBe(true); expect(m.uniqueness.holder).toBe('FUSED');
      const { coreStats, ...identity } = result.character, { coreStats: oldStats, ...oldIdentity } = before.character;
      expect(identity).toEqual(oldIdentity);
      for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(coreStats[key]).toBe(oldStats[key] + 1);
      expect(result.progression.mastery).toEqual({ ...before.progression.mastery, ...Object.fromEntries(DEMONESS_ABILITY_IDS.map(id => [id, 0])) });
      expect(s.project()).toMatchObject({ maxSpirituality: 150, canAct: false, demoness: { promoted: true, resources: { maxSpirituality: 150 } } });
      expect(demonessInheritedHash(result)).toBe(demonessInheritedHash(route.source)); assertValidSliceState(result);
    } finally { restore(); }
  }, 120_000);

  it('living failure costs persist while the same sealed originals recover for60 only after a real week', () => {
    const before = route.beforeConsume, restore = controlledDemonessRolls(before, { [before.random.cursor]: 90 });
    try {
      const s = session(), failed = executeDemoness(s, consume()), id = failed.demoness.materials!.compounds[0]!.id;
      expect(failed.status).toBe('ACTIVE'); expect(failed.progression.sequence).toBe(1);
      expect(failed.health).toBe(before.health - 45); expect(failed.mind).toBe(before.mind - 40);
      expect(failed.seer.pollution).toBe(before.seer.pollution + 35);
      const sealed = executeDemoness(s, { type: 'MATERIAL', command: { type: 'SEAL_REMAINS', compoundId: id } });
      expect(sealed.cash).toBe(failed.cash);
      expect(() => s.prepare({ type: 'DEMONESS', command: { type: 'MATERIAL', command: { type: 'RECOVER_REMAINS', compoundId: id } } }, sealed.revision)).toThrow();
      commitDemoness(s, { type: 'NEXT_WEEK' }); const worked = executeDemoness(s, { type: 'WORK' });
      const recovered = executeDemoness(s, { type: 'MATERIAL', command: { type: 'RECOVER_REMAINS', compoundId: id } }), m = recovered.demoness.materials!;
      expect(recovered.cash).toBe(worked.cash - 60); expect(recovered.health).toBe(failed.health);
      expect(recovered.mind).toBe(failed.mind); expect(recovered.injuries).toEqual(failed.injuries);
      expect(recovered.seer.pollution).toBe(failed.seer.pollution);
      expect(m.characteristics.map(c => c.id)).toEqual(before.demoness.materials!.characteristics.map(c => c.id));
      expect(m.characteristics.filter(c => c.holder === 'PLAYER')).toHaveLength(2);
      expect(m.characteristics.filter(c => c.holder === 'EMBODIED')).toHaveLength(1);
      expect(m.uniqueness.holder).toBe('PLAYER'); expect(m.compounds[0]!.status).toBe('RECOVERED');
      expect(m.carriers.map(c => c.status)).toEqual(['SPENT', 'SUPPLIER', 'SUPPLIER']);
      expect(demonessInheritedHash(recovered)).toBe(demonessInheritedHash(route.source));
    } finally { restore(); }
  }, 60_000);

  it('severe actual failure leaves exactly three original residues and terminal death', () => {
    const before = route.beforeConsume, restore = controlledDemonessRolls(before, { [before.random.cursor]: 100 });
    try {
      const s = session(), dead = executeDemoness(s, consume()), m = dead.demoness.materials!;
      expect(dead.status).toBe('DEAD'); expect(dead.health).toBe(0);
      expect(m.compounds[0]!.status).toBe('DEATH_EXPOSED');
      expect(m.characteristics).toHaveLength(3); expect(m.characteristics.every(c => c.holder === 'EXPOSED')).toBe(true);
      expect(m.uniqueness.holder).toBe('EXPOSED');
      for (const command of [{ type: 'REST' }, { type: 'RETURN_ON_FOOT' }, { type: 'NEXT_WEEK' }] as const)
        expect(() => s.prepare({ type: 'DEMONESS', command }, dead.revision)).toThrow();
      assertValidSliceState(dead);
    } finally { restore(); }
  }, 60_000);

  it('returns by ordinary road with zero cash and zero actions, preserving wounds, stock, random and costs', () => {
    const s = session(); let before = s.snapshot();
    // Unpaid real weeks consume the remaining money; this is not a resource edit.
    for (let n = 0; before.cash > 0 && n < 120; n++) before = executeDemoness(s, { type: 'NEXT_WEEK' });
    expect(before.cash).toBe(0);
    while (before.actionsRemaining > 0) before = executeDemoness(s, { type: 'TRAVEL',
      to: before.demoness.frame!.location === 'DM221-WORKSHOP' ? 'DM221-VAULT' : 'DM221-WORKSHOP' });
    const after = executeDemoness(s, { type: 'RETURN_ON_FOOT' });
    expect(after).toMatchObject({ cash: 0, actionsRemaining: 0, health: before.health, mind: before.mind, spirituality: before.spirituality });
    expect(after.injuries).toEqual(before.injuries); expect(after.random).toEqual(before.random);
    expect(after.demoness.frame!.location).toBe('DM221-RECEPTION');
    expect(after.demoness.frame!.nowSecond - before.demoness.frame!.nowSecond).toBe(7200);
    expect(after.demoness.materials!.carriers).toEqual(before.demoness.materials!.carriers);
    expect(after.demoness.materials!.characteristics.map(c => [c.id, c.holder])).toEqual(before.demoness.materials!.characteristics.map(c => [c.id, c.holder]));
    expect(demonessInheritedHash(after)).toBe(demonessInheritedHash(route.source));
  }, 60_000);

  it('both finite abilities pay resistance checks, gain mastery only on real application and allow ordinary failed routes', () => {
    for (const roll of [1, 100]) {
      const before = route.beforeConsume, cursor = before.random.cursor;
      const restore = controlledDemonessRolls(before, { [cursor]: 1, [cursor + 1]: roll, [cursor + 2]: roll });
      try {
        const s = session(); commitDemoness(s, consume()); readyReturn(s);
        const initial = s.snapshot(), initialStrut = initial.demoness.passage!.strut.integrity;
        passage(s, { type: 'OBSERVE_STONE' }); passage(s, { type: 'PETRIFY_STONE' });
        const stoneAttempt = s.snapshot();
        expect(stoneAttempt.progression.mastery[DEMONESS_ABILITY_IDS[0]]).toBe(0);
        if (roll === 1) {
          const window = stoneAttempt.demoness.passage!.window!;
          expect(window).toMatchObject({ kind: 'PETRIFICATION', targetId: 'DM221-ORIGINAL-STONE',
            version: stoneAttempt.demoness.passage!.stone.version, playerPosition: 3 });
          expect(window.expiresAt - window.createdAt).toBeLessThanOrEqual(8);
          expect(window.expiresAt).toBeGreaterThan(stoneAttempt.demoness.frame!.nowSecond + 1);
        } else expect(stoneAttempt.demoness.passage!.window).toBeNull();
        passage(s, { type: 'CATCH_STONE' });
        expect(() => s.prepare({ type: 'DEMONESS', command: { type: 'PASSAGE', command: { type: 'CATCH_STONE' } } }, s.inspect().revision)).toThrow();
        passage(s, { type: 'TOUCH_STRUT' }); passage(s, { type: 'RESHAPE_STRUT' });
        const strutAttempt = s.snapshot();
        expect(strutAttempt.progression.mastery[DEMONESS_ABILITY_IDS[1]]).toBe(0);
        if (roll === 1) {
          const window = strutAttempt.demoness.passage!.window!;
          expect(window).toMatchObject({ kind: 'RESHAPING', targetId: 'DM221-ORIGINAL-STRUT',
            version: strutAttempt.demoness.passage!.strut.version, playerPosition: 3 });
          expect(window.expiresAt - window.createdAt).toBe(20);
          expect(strutAttempt.demoness.passage!.contact).toBe(true);
        } else expect(strutAttempt.demoness.passage!.window).toBeNull();
        passage(s, { type: roll === 1 ? 'FIT_WEDGE' : 'ORDINARY_SHORE' });
        expect(s.snapshot().progression.mastery[DEMONESS_ABILITY_IDS[1]]).toBe(0);
        for (const residentId of DEMONESS_RESIDENT_IDS) {
          passage(s, { type: 'CROSS_RETURN', residentId }); passage(s, { type: 'EXIT_RESIDENT', residentId });
        }
        passage(s, { type: 'WALK', to: -2 }); passage(s, { type: 'REPORT_RETURN' });
        const final = s.snapshot(), p = final.demoness.passage!;
        expect(p.phase).toBe('CLOSED'); expect(p.position).toBe(-2);
        expect(p.residents.every(r => r.position === -2 && r.returnPassage?.crossing && r.returnPassage.exit)).toBe(true);
        expect([p.petrificationAttempts, p.reshapingAttempts]).toEqual([1, 1]);
        expect(p.stone).toMatchObject({ id: 'DM221-ORIGINAL-STONE', massKg: 2, state: 'CAUGHT', petrified: roll === 1 });
        expect(p.strut).toMatchObject({ id: 'DM221-ORIGINAL-STRUT', scarred: true, integrity: initialStrut + (roll === 1 ? 4 : 0) - 2 });
        expect(p.returnKit).toMatchObject({ catcherUses: 0, wedgeUses: 0, usedReshaping: roll === 1 });
        expect(p.window).toBeNull(); expect(p.contact).toBe(false);
        expect(final.spirituality).toBe(initial.spirituality - 26); expect(final.mind).toBe(initial.mind - 11);
        expect(final.health).toBe(initial.health - (roll === 1 ? 3 : 8)); expect(final.injuries.at(-1)!.severity).toBe('LIGHT');
        for (const id of DEMONESS_ABILITY_IDS) expect(final.progression.mastery[id]).toBe(roll === 1 ? 8 : 0);
        const attempts = final.demoness.journal.filter(e => e.command.type === 'PASSAGE' && ['PETRIFY_STONE', 'RESHAPE_STRUT'].includes(e.command.command.type));
        expect(attempts).toHaveLength(2);
        expect(attempts.map(e => e.checks[0]!.check.difficulty)).toEqual([p.stone.resistance + 7, p.strut.resistance]);
        expect(attempts.map(e => e.checks[0]!.check.roll)).toEqual([roll, roll]);
        expect(attempts.map(e => e.before.budget.spirituality - e.after.budget.spirituality)).toEqual([12, 14]);
        expect(attempts.map(e => e.before.budget.mind - e.after.budget.mind)).toEqual([5, 6]);
        expect(demonessInheritedHash(final)).toBe(demonessInheritedHash(route.source));
      } finally { restore(); }
    }
  }, 120_000);
});
