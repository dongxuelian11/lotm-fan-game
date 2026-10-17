import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { describe, expect, it } from 'vitest';
import { FATE_COMMISSIONS, FATE_CONTENT_VERSION, FATE_ORIGIN, FATE_PURSUIT_TABLE } from '../../src/domain/fool/fate-content';
import {
  applyFateCommand, applyFateRecovery, createFateRecovery, createFateState, evaluateFate,
  fateCaseJournalDigest, fateOriginalsDigest, isFateEffectLiveAt, projectFate,
  replayFate, resolveFateLoad, validateFate, validateFateRecovery,
  type FateAuthority, type FateBodyHealth, type FateCommand, type FateHostReceipt, type FateInitial,
  type FateRecoveryAuthority, type FateRecoveryInitial, type FateRecoveryReceipt,
  type FateResources, type FateState, type FateWorldFact,
} from '../../src/domain/fool/fate';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
type WithoutId<T> = T extends { id: string } ? Omit<T, 'id'> : never;
type Action = WithoutId<FateCommand>;
function original(index = 0, availableAt = 1000): FateInitial {
  const c = FATE_COMMISSIONS[index]!;
  const id = (value: string): string => `run-1868:${value}`;
  return {
    version: FATE_CONTENT_VERSION, runId: 'run-1868', commissionId: c.id, instanceId: id(c.id),
    actorId: 'original-player-1868', availableAt,
    originals: { boatId: id(c.boat), crateId: id(c.crate), ownerId: id(c.owner), saddleId: id(c.saddle), wellId: id(c.well), sealId: id(`SEAL-${index}`), cargoIds: [id(`CARGO-${index}-1`), id(`CARGO-${index}-2`)], commercialRegisterReceipt: id(c.commissionSource), boatContinuityReceipt: id(`BOAT-HISTORY-${index}`), crateContinuityReceipt: id(`CRATE-HISTORY-${index}`) },
    crew: [
      { id: id(`CREW-${index}-1`), bodyId: id(`BODY-${index}-1`), adult: true, willingToEvacuate: true },
      { id: id(`CREW-${index}-2`), bodyId: id(`BODY-${index}-2`), adult: true, willingToEvacuate: true },
    ],
    binding: { id: id(c.binding), createdAt: 100, originReceipt: id(`REAL-RELIC-OCCURRENCE-${index}`), artifactId: FATE_ORIGIN.artifactId, mechanism: FATE_ORIGIN.mechanism, provenanceKind: FATE_ORIGIN.provenanceKind, chainVersion: FATE_ORIGIN.chainVersion, channelId: id(`CHANNEL-${index}`), boatId: id(c.boat), crateId: id(c.crate), saddleId: id(c.saddle), clockRule: 'FIRST_REAL_DEPARTURE_PLUS_180_SECONDS', lockedOutcome: 'ORIGINAL_STRUCTURE_BROKEN', contribution: 40, structuralFailureAt: 35, pursuitTable: copy(FATE_PURSUIT_TABLE) },
    preexistingTrace: { receipt: id(`TRACE-${index}`), recordedAt: 200, saddleId: id(c.saddle), measuredLoad: 4, tetherId: id(`EXISTING-TETHER-${index}`) },
    well: { capacity: 40, integrity: 'SOUND', occupants: [] },
    independentUniquenessCustodyReceipt: 'separate-safe-custody-original-uniqueness',
  };
}
function harness(initial = original(), entryAt = initial.availableAt) {
  const receipts = new Map<string, FateHostReceipt>();
  const authority: FateAuthority = { initial: copy(initial), instanceAlreadyRegistered: false, entryAt, receiptIsAuthentic: r => same(receipts.get(r.id), r) };
  let state = createFateState(initial, authority);
  authority.instanceAlreadyRegistered = true;
  let count = 0;
  let bodyHealth: FateBodyHealth = { actor: 100, crew: Object.fromEntries(initial.crew.map(c => [c.id, 100])) };
  let resources: FateResources = { actionPoints: 12, spirituality: 30, mental: 20, pennies: 100, inspectionKits: ['probe-1', 'probe-2'], preparationKits: ['prep-1', 'prep-2'] };
  const perform = (action: Action, options: { health?: Partial<FateBodyHealth>; checkRoll?: number; facts?: FateWorldFact[]; resources?: Partial<FateResources>; otherGraft?: boolean; conscious?: boolean; commit?: boolean } = {}) => {
    const command = { ...action, id: `command-${++count}` } as FateCommand;
    const host: FateHostReceipt = {
      id: `receipt-${count}`, ledgerRevision: `ledger-${count}`, commandId: command.id, command: copy(command), expectedRevision: state.journal.length, now: state.scene.now,
      actorId: initial.actorId, actorAlive: state.scene.actorAlive, actorConscious: options.conscious ?? true,
      bodyHealth: { ...copy(bodyHealth), ...options.health },
      resources: { ...copy(resources), ...options.resources }, otherComplexGraftActive: options.otherGraft ?? false, worldFacts: options.facts ?? [],
      ...(action.type === 'GRAFT' ? { check: { id: `check-${count}`, actorId: initial.actorId, ability: 'S1_PHYSICAL_GRAFT' as const, skill: 'KNOWLEDGE' as const, result: resolveNormalCheck({ ability: 'knowledge', baseAbility: 20, difficulty: 20, modifiers: [], roll: options.checkRoll ?? 10 }), rngBeforeRef: `rng-before-${count}`, rngAfterRef: `rng-after-${count}` } } : {}),
    };
    receipts.set(host.id, copy(host));
    const result = applyFateCommand(state, command, host, authority);
    if (result.ok && options.commit !== false) {
      state = result.state;
      bodyHealth = copy(host.bodyHealth);
      for (const consequence of result.consequences) {
        if (consequence.subjectId === initial.actorId) bodyHealth.actor = consequence.healthAfter;
        else bodyHealth.crew = { ...bodyHealth.crew, [consequence.subjectId]: consequence.healthAfter };
      }
      if (!state.scene.actorAlive) bodyHealth.actor = 0;
      for (const c of state.scene.crew) if (!c.alive) bodyHealth.crew = { ...bodyHealth.crew, [c.id]: 0 };
      resources = { ...host.resources, actionPoints: host.resources.actionPoints - result.cost.actionPoints, spirituality: host.resources.spirituality - result.cost.spirituality, mental: host.resources.mental - result.cost.mental, pennies: host.resources.pennies - result.cost.pennies, inspectionKits: host.resources.inspectionKits.filter(x => !result.cost.consumedItemIds.includes(x)), preparationKits: host.resources.preparationKits.filter(x => !result.cost.consumedItemIds.includes(x)) };
    }
    return { ...result, host, command };
  };
  const until = (relative: number) => perform({ type: 'WAIT', seconds: (state.scene.departureAt ?? authority.entryAt) + relative - state.scene.now });
  const prepared = (branch: typeof FATE_PURSUIT_TABLE[number]['branch'] = 'SHIELD_MAIN', route: 'MAIN' | 'SIDE' = 'MAIN') => {
    expect(perform({ type: 'INSPECT_CONSTRAINT', branch, kitId: 'probe-1' }).ok).toBe(true);
    expect(perform({ type: 'PREPARE_ENDPOINTS', kitId: 'prep-1' }).ok).toBe(true);
    expect(perform({ type: 'TRANSIT', route }).ok).toBe(true);
  };
  const ready = () => {
    prepared();
    for (const c of initial.crew) expect(perform({ type: 'RESCUE', crewId: c.id }).ok).toBe(true);
    expect(until(150).ok).toBe(true);
  };
  const finish = () => {
    expect(perform({ type: 'GRAFT' }).ok).toBe(true);
    expect(until(180).ok).toBe(true);
    expect(perform({ type: 'ARRIVE_AND_VERIFY' }).ok).toBe(true);
  };
  const view = () => projectFate(state, { now: state.scene.now, actorId: initial.actorId, actorAlive: state.scene.actorAlive, actorConscious: true, bodyHealth, resources, otherComplexGraftActive: false }, authority);
  return { initial, authority, receipts, perform, until, prepared, ready, finish, view, get state() { return state; }, get resources() { return resources; } };
}

describe('F208 original, deterministic causal deviation candidate', () => {
  it('settles a lethal third-bell crush before same-second rescue movement, exactly once', () => {
    const h = harness(); h.prepared(); h.until(170);
    const crew = h.initial.crew[0]!;
    const r = h.perform({ type: 'RESCUE', crewId: crew.id }, { health: { actor: 35 } });
    expect(r.ok).toBe(true); expect(h.state.scene.actorAlive).toBe(false);
    expect(h.state.scene.actorPlace).toBe('GATE');
    expect(h.state.journal.some(e => e.type === 'ORIGINAL_CREW_RESCUED')).toBe(false);
    const injury = r.consequences.find(c => c.subjectId === h.initial.actorId)!;
    expect(injury).toMatchObject({ healthBefore: 35, healthAfter: 0, died: true, at: h.state.scene.thirdBellAt });
    expect(h.state.scene.actorInjuries.filter(id => id === injury.injuryReceipt)).toHaveLength(1);
    expect(h.perform({ type: 'ADVANCE_WORLD', seconds: 100 }).consequences).toEqual([]);
    expect(validateFate(h.state, h.authority).valid).toBe(true);
  });

  it('does not move a mortally crushed body to refuge at a later withdrawal completion', () => {
    const h = harness(); h.prepared(); h.until(170);
    const r = h.perform({ type: 'WITHDRAW' }, { health: { actor: 34 } });
    expect(r.ok).toBe(true); expect(h.state.scene.actorAlive).toBe(false);
    expect(h.state.scene.actorPlace).toBe('GATE'); expect(h.state.scene.withdrawn).toBe(false);
    expect(h.state.scene.crew.every(c => c.place !== 'REFUGE')).toBe(true);
  });

  it('uses each real NPC health and cancels rescuing a body killed earlier at that same second', () => {
    const h = harness(); h.prepared(); h.until(170);
    const crew = h.initial.crew[0]!;
    const r = h.perform({ type: 'RESCUE', crewId: crew.id }, { health: { actor: 36, crew: Object.fromEntries(h.initial.crew.map(c => [c.id, c.id === crew.id ? 35 : 100])) } });
    expect(r.ok).toBe(true); expect(h.state.scene.actorAlive).toBe(true);
    expect(h.state.scene.crew.find(c => c.id === crew.id)).toMatchObject({ alive: false, place: 'RIGGING' });
    expect(r.consequences.find(c => c.subjectId === crew.id)).toMatchObject({ healthBefore: 35, healthAfter: 0, died: true });
    expect(r.consequences.find(c => c.subjectId === h.initial.actorId)).toMatchObject({ healthAfter: 1, died: false });
  });

  it('retains a rescue completed before the bell and does not injure safe original bodies', () => {
    const h = harness(); h.prepared(); h.until(160);
    const crew = h.initial.crew[0]!;
    const r = h.perform({ type: 'RESCUE', crewId: crew.id }, { health: { actor: 35 } });
    expect(r.ok).toBe(true); expect(h.state.scene.actorAlive).toBe(true);
    expect(h.state.scene.crew.find(c => c.id === crew.id)).toMatchObject({ alive: true, place: 'REFUGE' });
    expect(r.consequences.some(c => c.subjectId === crew.id || c.subjectId === h.initial.actorId)).toBe(false);
  });

  it('pays a failed graft down to zero mental at cast start and cannot complete it after death', () => {
    const h = harness(); h.ready(); const at = h.state.scene.now;
    const r = h.perform({ type: 'GRAFT' }, { checkRoll: 100, resources: { mental: 4 } });
    expect(r.ok).toBe(true); expect(r.cost).toMatchObject({ spirituality: 8, mental: 4 });
    expect(h.state.scene.actorAlive).toBe(false); expect(h.state.effect).toBeNull();
    expect(h.state.journal.find(e => e.type === 'PLAYER_DIED_FROM_PAID_MENTAL_COST')?.at).toBe(at);
    expect(h.perform({ type: 'ADVANCE_WORLD', seconds: h.state.scene.thirdBellAt! - h.state.scene.now }).ok).toBe(true);
    expect(h.state.scene.bellOccurred).toBe(true); expect(h.state.scene.everDamaged).toBe(true);
  });

  it('completes real inspection, preparation, rescue, active graft, delivery and original handover', () => {
    const h = harness(); h.ready(); h.finish();
    expect(evaluateFate(h.state, h.authority).verdict).toBe('VERIFIED_DEVIATION');
    expect(h.state.scene.now).toBe(1255);
    expect(h.state.scene.forceToWell).toBe(40);
    expect(h.state.scene.forceToOriginal).toBe(0);
    expect(h.state.endpoints.wellCapacity).toBe(0);
    expect(h.state.endpoints.wellWear).toBe(40);
    expect(h.state.scene.crew.every(c => c.place === 'REFUGE' && c.alive)).toBe(true);
    expect(h.resources).toMatchObject({ actionPoints: 9, spirituality: 22, mental: 18, pennies: 100 });
    expect(h.resources.inspectionKits).not.toContain('probe-1');
    expect(h.resources.preparationKits).not.toContain('prep-1');
    expect(h.state.instance.initial.independentUniquenessCustodyReceipt).toBe(h.initial.independentUniquenessCustodyReceipt);
    expect(h.state).not.toHaveProperty('fateSatisfied');
    expect(h.state).not.toHaveProperty('godApproved');
  });

  it('replays exactly from pinned originals and full authenticated receipts', () => {
    const h = harness(); h.ready(); h.finish();
    expect(replayFate(h.initial, copy(h.state.journal), h.authority)).toEqual(h.state);
    expect(validateFate(copy(h.state), h.authority)).toEqual({ valid: true, errors: [] });
    expect(() => createFateState(h.initial, h.authority)).toThrow('ORIGINAL_INSTANCE_ALREADY_REGISTERED');
  });

  it.each(FATE_PURSUIT_TABLE.map(p => p.branch))('ordinary branch %s actually follows the same original target', branch => {
    const h = harness(); h.prepared(branch, branch === 'SIDE_CHANNEL' ? 'SIDE' : 'MAIN');
    h.until(180);
    const pursuit = h.state.journal.find(e => e.type === 'ORDINARY_INTERVENTION_ACTUALLY_PURSUED');
    expect(pursuit?.data).toMatchObject({ branch, originalTargetId: h.initial.originals.crateId, sourceId: h.initial.originals.saddleId, measuredLoadContinues: 4 });
    expect(h.state.scene.forceToOriginal).toBe(40);
    expect(h.state.scene.everDamaged).toBe(true);
    if (branch === 'SIDE_CHANNEL') expect(h.state.journal.filter(e => e.type === 'ACTUAL_MOVEMENT').some(e => e.data.boatTo === 'SIDE_CHANNEL')).toBe(true);
    if (branch === 'HOLD_OR_MOVE') { expect(h.state.scene.crateSlot).toBe('AFT_HOLD'); expect(h.state.scene.hullWear).toBe(1); }
    if (branch === 'SHIELD_MAIN') { expect(h.state.scene.shieldWear).toBe(1); expect(h.state.scene.hullWear).toBe(0); }
    if (branch === 'SIDE_CHANNEL') expect(h.state.scene.hullWear).toBe(0);
  });

  it('anchoring/waiting does not remove the binding or defer its bell', () => {
    const h = harness(); h.prepared('HOLD_OR_MOVE'); h.perform({ type: 'ANCHOR' }); h.until(180);
    expect(h.state.scene.boatPlace).toBe('GATE'); expect(h.state.scene.anchored).toBe(true);
    expect(h.state.journal.some(e => e.type === 'ORIGINAL_BOAT_ANCHORED')).toBe(true);
    expect(h.state.scene.forceToOriginal).toBe(40);
    expect(evaluateFate(h.state, h.authority).verdict).toBe('FAILED');
  });

  it('a successful roll and connection alone are incomplete', () => {
    const h = harness(); h.ready(); h.perform({ type: 'GRAFT' });
    expect(h.state.effect?.remainingUses).toBe(1);
    expect(h.state.scene.forceToWell).toBe(0);
    expect(evaluateFate(h.state, h.authority).verdict).toBe('INCOMPLETE');
  });

  it('real diversion without handover remains incomplete', () => {
    const h = harness(); h.ready(); h.perform({ type: 'GRAFT' }); h.until(180);
    expect(evaluateFate(h.state, h.authority).reasons).toContain('SAME_ORIGINALS_NOT_YET_HANDED_OVER');
  });

  it('source cancellation yields ordinary survival, never fate proof', () => {
    const h = harness(); h.prepared();
    h.perform({ type: 'WAIT', seconds: 140 }, { facts: [{ id: 'source-removal', at: 1190, type: 'SOURCE_CANCELLED', causeReceipt: 'actual-paid-external-dismantling' }] });
    h.perform({ type: 'ARRIVE_AND_VERIFY' });
    expect(h.state.scene.forceToWell).toBe(0);
    expect(h.state.journal.some(e => e.type === 'SOURCE_FORCE_EMITTED')).toBe(false);
    expect(evaluateFate(h.state, h.authority).verdict).toBe('ORDINARY_SURVIVAL');
  });

  it('binding release is an ordinary result even with original safe arrival', () => {
    const h = harness(); h.ready(); h.perform({ type: 'GRAFT' });
    h.perform({ type: 'WAIT', seconds: 25 }, { facts: [{ id: 'release', at: 1220, type: 'BINDING_RELEASED', causeReceipt: 'independent-real-release' }] });
    h.perform({ type: 'ARRIVE_AND_VERIFY' });
    expect(evaluateFate(h.state, h.authority).verdict).toBe('ORDINARY_SURVIVAL');
  });

  it('post-diversion cargo damage permanently prevents complete original result', () => {
    const h = harness(); h.ready(); h.perform({ type: 'GRAFT' }); h.until(180);
    h.perform({ type: 'ARRIVE_AND_VERIFY' }, { facts: [{ id: 'cargo-crack', at: 1240, type: 'ORIGINAL_DAMAGE', target: 'CARGO', reason: 'actual-dock-impact' }] });
    expect(h.state.scene.forceToWell).toBe(40);
    expect(h.state.scene.everDamaged).toBe(true);
    expect(evaluateFate(h.state, h.authority).verdict).toBe('FAILED');
  });

  it('a long ordinary wait processes activation, bell and damage in exact real-time order', () => {
    const h = harness(); h.prepared(); h.perform({ type: 'WAIT', seconds: 200 });
    const types = h.state.journal.map(e => e.type);
    expect(types.indexOf('SOURCE_ACTIVATED')).toBeLessThan(types.indexOf('THIRD_BELL'));
    expect(h.state.journal.find(e => e.type === 'SOURCE_ACTIVATED')?.at).toBe(1200);
    expect(h.state.journal.find(e => e.type === 'THIRD_BELL')?.at).toBe(1230);
    expect(h.state.scene.now).toBe(1290); expect(h.state.scene.everDamaged).toBe(true);
  });

  it('predeparture preparation can happen late without silently expiring an unstarted voyage', () => {
    const h = harness(); h.until(140); h.perform({ type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: 'probe-1' });
    expect(h.state.constraint).not.toBeNull(); expect(h.state.scene.thirdBellAt).toBeNull();
    h.perform({ type: 'PREPARE_ENDPOINTS', kitId: 'prep-1' }); h.perform({ type: 'TRANSIT', route: 'MAIN' });
    expect(h.state.scene.departureAt).toBe(1190); expect(h.state.scene.thirdBellAt).toBe(1370);
    expect(h.state.journal.filter(e => e.type === 'DEPARTURE_CLOCK_FIXED')).toHaveLength(1);
  });

  it('predeparture ordinary exit and return retain the same originals, cost and prepared evidence', () => {
    const h = harness(); h.perform({ type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: 'probe-1' });
    h.perform({ type: 'PREPARE_ENDPOINTS', kitId: 'prep-1' });
    h.perform({ type: 'WITHDRAW' });
    expect(h.state.scene.thirdBellAt).toBeNull(); expect(h.view().actions[0]?.type).toBe('RETURN_TO_BERTH');
    expect(h.perform({ type: 'RETURN_TO_BERTH' }).ok).toBe(true);
    expect(h.state.scene.actorPlace).toBe('BERTH'); expect(h.resources.preparationKits).not.toContain('prep-1');
    expect(h.state.endpoints.preparedAt).toBe(1050); h.perform({ type: 'TRANSIT', route: 'MAIN' });
    expect(h.state.scene.departureAt).toBe(1090); expect(h.state.scene.thirdBellAt).toBe(1270);
  });

  it.each([175, 178])('a cast begun at %i pays before third-bell damage and cannot finish retroactively', relative => {
    const h = harness(); h.ready(); h.until(relative); const r = h.perform({ type: 'GRAFT' });
    expect(r.cost).toMatchObject({ actionPoints: 1, spirituality: 8, mental: 2 });
    expect(h.state.effect).toBeNull(); expect(h.state.scene.everDamaged).toBe(true);
    const j = h.state.journal;
    expect(j.findIndex(e => e.type === 'THIRD_BELL')).toBeLessThan(j.findIndex(e => e.type === 'GRAFT_FAILED'));
  });

  it('failed casting consumes RNG, time and full cost; a short-window retry pays again', () => {
    const h = harness(); h.ready(); const a = h.perform({ type: 'GRAFT' }, { checkRoll: 75 });
    expect(a.ok).toBe(true); expect(h.state.effect).toBeNull(); expect(h.state.scene.now).toBe(1205);
    const b = h.perform({ type: 'GRAFT' }); expect(b.ok).toBe(true);
    expect(h.resources).toMatchObject({ actionPoints: 8, spirituality: 14, mental: 14 });
    expect(h.state.journal.filter(e => e.type === 'GRAFT_PAID_AND_CAST')).toHaveLength(2);
    h.until(180); h.perform({ type: 'ARRIVE_AND_VERIFY' });
    expect(evaluateFate(h.state, h.authority).verdict).toBe('VERIFIED_DEVIATION');
  });

  it('no late retry resets the clock or refunds prior failures', () => {
    const h = harness(); h.ready(); h.until(173); h.perform({ type: 'GRAFT' }, { checkRoll: 75 }); h.perform({ type: 'GRAFT' });
    expect(h.state.scene.now).toBe(1233); expect(h.resources.spirituality).toBe(14);
    expect(evaluateFate(h.state, h.authority).verdict).toBe('FAILED');
    const r = h.perform({ type: 'GRAFT' }); expect(r.ok).toBe(false); expect(r.cost.spirituality).toBe(0);
  });

  it('no AP still permits rescue, wait and ordinary withdrawal with real elapsed time', () => {
    const h = harness(); h.prepared();
    expect(h.perform({ type: 'RESCUE', crewId: h.initial.crew[0].id }, { resources: { actionPoints: 0 } }).ok).toBe(true);
    expect(h.perform({ type: 'WAIT', seconds: 5 }).ok).toBe(true);
    const r = h.perform({ type: 'WITHDRAW' });
    expect(r.ok).toBe(true); expect(r.cost.actionPoints).toBe(0);
    expect(h.state.scene.now).toBe(1230); expect(h.state.scene.actorPlace).toBe('REFUGE');
    expect(h.state.scene.everDamaged).toBe(true); expect(h.state.scene.actorInjuries).toHaveLength(0);
  });

  it('rescue crossing the bell resolves injury first and preserves it after evacuation', () => {
    const h = harness(); h.prepared(); h.until(175);
    h.perform({ type: 'RESCUE', crewId: h.initial.crew[0].id });
    const crew = h.state.scene.crew[0]!;
    expect(crew.place).toBe('REFUGE'); expect(crew.injuries.length).toBeGreaterThan(0);
    expect(h.state.scene.now).toBe(1245); expect(h.state.scene.everDamaged).toBe(true);
  });

  it('remaining mental must exceed the spell cost to stay conscious', () => {
    const h = harness(); h.ready(); const r = h.perform({ type: 'GRAFT' }, { resources: { mental: 2 } });
    expect(r.ok).toBe(false); expect(r.elapsedSeconds).toBe(0); expect(r.cost.mental).toBe(0);
  });

  it('the worst-case four mental is reserved and a percentile failure pays four', () => {
    const h = harness(); h.ready(); const r = h.perform({ type: 'GRAFT' }, { checkRoll: 75, resources: { mental: 4 } });
    expect(r.ok).toBe(true); expect(r.cost.mental).toBe(4); expect(h.resources.mental).toBe(0); expect(h.state.effect).toBeNull();
  });

  it.each([1, 5, 50])('standard percentile roll %i uses the existing successful tier', roll => {
    const h = harness(); h.ready(); h.perform({ type: 'GRAFT' }, { checkRoll: roll });
    expect(h.state.effect).not.toBeNull(); expect(h.resources.mental).toBe(18);
  });

  it.each([51, 96, 100])('standard percentile roll %i retains the true failed tier and cost', roll => {
    const h = harness(); h.ready(); h.perform({ type: 'GRAFT' }, { checkRoll: roll });
    expect(h.state.effect).toBeNull(); expect(h.resources.mental).toBe(16);
  });

  it('an existing complex graft blocks stacking without charging another spell', () => {
    const h = harness(); h.ready(); const r = h.perform({ type: 'GRAFT' }, { otherGraft: true });
    expect(r.blockedReason).toBe('AN_EXISTING_COMPLEX_GRAFT_MUST_END_FIRST'); expect(r.cost.spirituality).toBe(0);
  });

  it('an occupied initial well blocks preparation before material is spent', () => {
    const i = original(); i.well.occupants = ['living-inspector']; const h = harness(i);
    h.perform({ type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: 'probe-1' });
    const r = h.perform({ type: 'PREPARE_ENDPOINTS', kitId: 'prep-1' });
    expect(r.ok).toBe(false); expect(r.cost.consumedItemIds).toHaveLength(0);
  });

  it('well occupancy during a paid cast stops connection and retains the payment', () => {
    const h = harness(); h.ready(); const r = h.perform({ type: 'GRAFT' }, { facts: [{ id: 'entered-well', at: 1203, type: 'WELL_OCCUPANCY', occupantIds: ['adult-inspector'] }] });
    expect(r.ok).toBe(true); expect(r.cost.spirituality).toBe(8); expect(h.state.effect).toBeNull();
  });

  it('well occupancy at the exact bell is processed before transmission', () => {
    const h = harness(); h.ready(); h.perform({ type: 'GRAFT' });
    h.perform({ type: 'WAIT', seconds: 25 }, { facts: [{ id: 'entered-at-bell', at: 1230, type: 'WELL_OCCUPANCY', occupantIds: ['adult-inspector'] }] });
    expect(h.state.scene.forceToWell).toBe(0); expect(h.state.scene.forceToOriginal).toBe(40);
  });

  it('an endpoint invalidated after casting cannot use stale location evidence', () => {
    const h = harness(); h.ready(); h.perform({ type: 'GRAFT' });
    h.perform({ type: 'WAIT', seconds: 25 }, { facts: [{ id: 'marker-lost', at: 1229, type: 'ENDPOINT_INVALIDATED', endpoint: 'WELL' }] });
    expect(h.state.scene.forceToOriginal).toBe(40); expect(h.state.endpoints.wellCapacity).toBe(40);
  });

  it('death interrupts casting without revival; host time still settles the original disaster', () => {
    const h = harness(); h.ready(); h.perform({ type: 'GRAFT' }, { facts: [{ id: 'player-died', at: 1202, type: 'BODY_DIED', subjectId: h.initial.actorId, injuryReceipt: 'host-actual-death-receipt' }] });
    expect(h.state.scene.actorAlive).toBe(false); expect(h.state.effect).toBeNull();
    expect(h.perform({ type: 'WAIT', seconds: 25 }).blockedReason).toBe('PLAYER_DEAD');
    expect(h.perform({ type: 'ADVANCE_WORLD', seconds: 25 }, { conscious: false }).ok).toBe(true);
    expect(h.state.scene.bellOccurred).toBe(true); expect(h.state.scene.everDamaged).toBe(true);
    expect(h.state.scene.actorAlive).toBe(false); expect(evaluateFate(h.state, h.authority).verdict).toBe('FAILED');
  });

  it('dead original crew are never replaced or resurrected by rescue', () => {
    const h = harness(); h.prepared();
    h.perform({ type: 'WAIT', seconds: 1 }, { facts: [{ id: 'crew-died', at: 1091, type: 'BODY_DIED', subjectId: h.initial.crew[0].id, injuryReceipt: 'actual-crew-death' }] });
    expect(h.perform({ type: 'RESCUE', crewId: h.initial.crew[0].id }).ok).toBe(false);
    expect(h.state.scene.crew[0]?.alive).toBe(false); expect(h.state.scene.crew[0]?.bodyId).toBe(h.initial.crew[0].bodyId);
  });

  it('ordinary withdrawal does not move an unwilling crew member by magic', () => {
    const i = original(); i.crew[1].willingToEvacuate = false; const h = harness(i); h.perform({ type: 'TRANSIT', route: 'MAIN' }); h.perform({ type: 'WITHDRAW' });
    expect(h.state.scene.crew[0]?.place).toBe('REFUGE'); expect(h.state.scene.crew[1]?.place).toBe('BOAT_DECK');
    expect(h.state.scene.crew[1]?.injuries.length).toBeGreaterThan(0);
  });

  it('a destroyed boat cannot be freely sailed to the dock for verification', () => {
    const h = harness(); h.prepared(); h.until(180);
    expect(h.perform({ type: 'ARRIVE_AND_VERIFY' }).blockedReason).toBe('DAMAGED_BOAT_REQUIRES_REAL_SALVAGE_NOT_FREE_TRANSPORT');
  });

  it('pure commands do not mutate the caller state or initial provenance', () => {
    const h = harness(); const old = h.state, bytes = JSON.stringify(old), initial = JSON.stringify(h.initial);
    const r = h.perform({ type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: 'probe-1' }, { commit: false });
    expect(r.ok).toBe(true); expect(JSON.stringify(old)).toBe(bytes); expect(JSON.stringify(h.initial)).toBe(initial);
  });

  it('repeated command submission cannot pay, roll or move twice', () => {
    const h = harness(); const r = h.perform({ type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: 'probe-1' });
    const duplicate = applyFateCommand(h.state, r.command, r.host, h.authority);
    expect(duplicate.ok).toBe(false); expect(duplicate.elapsedSeconds).toBe(0);
  });

  it('a consumed preparation kit cannot be reused even if a stale snapshot lists it', () => {
    const h = harness(); h.perform({ type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: 'probe-1' }); h.perform({ type: 'PREPARE_ENDPOINTS', kitId: 'prep-1' });
    const r = h.perform({ type: 'PREPARE_ENDPOINTS', kitId: 'prep-1' }, { resources: { preparationKits: ['prep-1'] } });
    expect(r.blockedReason).toBe('MATERIAL_ALREADY_CONSUMED');
  });

  it('receipt authentication covers the exact command, not just an editable command ID', () => {
    const h = harness(); const r = h.perform({ type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: 'probe-1' }, { commit: false });
    const altered = { ...r.command, branch: 'HOLD_OR_MOVE' } as FateCommand;
    expect(applyFateCommand(h.state, altered, r.host, h.authority).blockedReason).toBe('HOST_CONTEXT_MISMATCH');
  });

  it('authenticity checks full receipt bytes, including private dice', () => {
    const h = harness(); h.ready(); const r = h.perform({ type: 'GRAFT' }, { commit: false });
    const altered = copy(r.host); altered.check!.result = { ...altered.check!.result, roll: 20 };
    expect(applyFateCommand(h.state, r.command, altered, h.authority).blockedReason).toBe('UNAUTHENTIC_HOST_RECEIPT');
  });

  it.each(['binding', 'originals', 'cache', 'phase', 'journal', 'npc', 'cost', 'effect'])('save mutation of %s cannot award deviation', field => {
    const h = harness(); h.ready(); h.finish(); const altered = copy(h.state);
    if (field === 'binding') altered.scene.thirdBellAt = (altered.scene.thirdBellAt ?? 0) + 1;
    if (field === 'originals') altered.instance.initial.originals.crateId = 'same-name-replacement';
    if (field === 'cache') altered.scene.forceToWell = 4000;
    if (field === 'phase') altered.phase = 'DISCOVER';
    if (field === 'journal') altered.journal = altered.journal.filter(e => e.type !== 'SOURCE_ACTIVATED');
    if (field === 'npc') altered.journal.push({ sequence: altered.journal.length, at: altered.scene.now, type: 'GOD_SAYS_FATE_FOOLED', data: {} });
    if (field === 'cost') altered.journal.find(e => e.type === 'COST_PAID')!.data.cost = { actionPoints: 0 };
    if (field === 'effect') altered.effect!.capacity = 999;
    expect(validateFate(altered, h.authority).valid).toBe(false);
    expect(evaluateFate(altered, h.authority).verdict).toBe('INCOMPLETE');
  });

  it.each(['forecast', 'source', 'trace', 'duplicateCargo', 'lateBinding', 'chain'])('invalid authored provenance %s is rejected at creation', kind => {
    const i = original();
    if (kind === 'forecast') i.binding.provenanceKind = 'NPC_PREDICTION' as typeof i.binding.provenanceKind;
    if (kind === 'source') i.binding.originReceipt = '';
    if (kind === 'trace') i.preexistingTrace.measuredLoad = Number.POSITIVE_INFINITY;
    if (kind === 'duplicateCargo') i.originals.cargoIds = [i.originals.cargoIds[0]!, i.originals.cargoIds[0]!];
    if (kind === 'lateBinding') i.binding.createdAt = i.availableAt;
    if (kind === 'chain') i.binding.chainVersion = 'rewritten-after-choice' as typeof i.binding.chainVersion;
    expect(() => harness(i)).toThrow();
  });

  it('capacity arithmetic retains residual above 45 and treats expiry as an exclusive endpoint', () => {
    expect(resolveFateLoad(40, 45, 35)).toEqual({ transferred: 40, residual: 0, breaksStructure: false });
    expect(resolveFateLoad(90, 45, 35)).toEqual({ transferred: 45, residual: 45, breaksStructure: true });
    const h = harness(); h.ready(); h.perform({ type: 'GRAFT' }); const effect = h.state.effect!;
    expect(isFateEffectLiveAt(effect, effect.expiresAt - 1)).toBe(true);
    expect(isFateEffectLiveAt(effect, effect.expiresAt)).toBe(false);
  });

  it('public projection has one recommendation, few alternatives, real cost/time and no private state', () => {
    const h = harness(); h.ready(); const view = h.view(), bytes = JSON.stringify(view);
    expect(view.actions.length).toBeLessThanOrEqual(3);
    expect(view.actions.filter(a => a.recommended)).toHaveLength(1);
    expect(view.actions[0]).toMatchObject({ type: 'GRAFT', enabled: true, seconds: 5, cost: { actionPoints: 1, spirituality: 8, mental: 2 } });
    expect(view.secondsToBell).toBe(30);
    expect(view.crate).toMatchObject({ slot: 'SADDLE', boatName: '登记原船' });
    for (const forbidden of ['rngBeforeRef', 'rngAfterRef', 'roll', 'pursuitTable', 'originReceipt', 'seed', 'futureBranch', 'journal', 'initialDigest', 'checkTotal']) expect(bytes).not.toContain(`"${forbidden}"`);
    expect(view.actions.some(a => a.type === 'WITHDRAW' && a.enabled && a.cost.actionPoints === 0)).toBe(true);
  });

  it('lack of AP shows an explicit block without removing retreat', () => {
    const h = harness(); h.ready(); h.perform({ type: 'WAIT', seconds: 1 }, { resources: { actionPoints: 0 } }); const view = h.view();
    expect(view.actions[0]?.enabled).toBe(false); expect(view.actions[0]?.blockedReason).toBeTruthy();
    expect(view.actions.find(a => a.type === 'WITHDRAW')?.enabled).toBe(true);
  });
});

function recoveryHarness() {
  const previous = harness(); previous.perform({ type: 'TRANSIT', route: 'MAIN' }); previous.perform({ type: 'WITHDRAW' });
  const initial: FateRecoveryInitial = { runId: previous.initial.runId, registeredAt: 500, commissions: [previous.initial, original(1), original(2)] };
  const receipts = new Map<string, FateRecoveryReceipt>();
  const authority: FateRecoveryAuthority = { initial: copy(initial), priorCases: [{ state: previous.state, authority: previous.authority }], receiptIsAuthentic: r => same(receipts.get(r.id), r) };
  let state = createFateRecovery(initial, authority), counter = 0;
  const perform = (changes: Partial<FateRecoveryReceipt> = {}) => {
    const receipt: FateRecoveryReceipt = { id: `recovery-${++counter}`, type: 'INVESTIGATE', targetCommissionId: 'F208-COMMISSION-2', week: 15971, now: 1181, actorId: previous.initial.actorId, actorAlive: true, penniesAvailable: 100, previousCaseId: previous.state.instance.id, previousCaseJournalDigest: fateCaseJournalDigest(previous.state), ...changes };
    receipts.set(receipt.id, copy(receipt)); const result = applyFateRecovery(state, receipt, authority); if (result.ok) state = result.state; return { ...result, receipt };
  };
  const verification = (changes: Partial<FateRecoveryReceipt> = {}) => {
    const target = initial.commissions[1]!; const now = 605805;
    return perform({ type: 'VERIFY', week: 15972, now, checks: { registerReceipt: target.originals.commercialRegisterReceipt, boatContinuityReceipt: target.originals.boatContinuityReceipt, crateContinuityReceipt: target.originals.crateContinuityReceipt, originReceipt: target.binding.originReceipt, originalsDigest: fateOriginalsDigest(target), inspectedAt: now }, ...changes });
  };
  return { initial, authority, previous, perform, verification, get state() { return state; } };
}

describe('F208 finite independent commercial recovery', () => {
  it('charges investigation, waits a calendar week, verifies preexisting new originals and keeps old loss', () => {
    const h = recoveryHarness(), old = JSON.stringify(h.previous.state);
    expect(h.perform().penniesSpent).toBe(18);
    const r = h.verification(); expect(r.ok).toBe(true); expect(r.penniesSpent).toBe(0); expect(r.eligibleEntryAt).toBe(605805);
    expect(r.eligibleInitial?.originals.crateId).not.toBe(h.previous.initial.originals.crateId);
    expect(r.eligibleInitial?.binding.createdAt).toBeLessThan(h.initial.registeredAt);
    expect(JSON.stringify(h.previous.state)).toBe(old);
    expect(h.previous.state.scene.everDamaged).toBe(true);
    expect(validateFateRecovery(h.state, h.authority).valid).toBe(true);
  });

  it('has no free, same-week or uninspected verification', () => {
    const h = recoveryHarness(); expect(h.verification().ok).toBe(false); h.perform();
    expect(h.verification({ week: 15971 }).blockedReason).toBe('INDEPENDENT_VERIFICATION_REQUIRES_NEXT_WEEK');
    expect(h.verification({ checks: undefined as unknown as NonNullable<FateRecoveryReceipt['checks']> }).blockedReason).toBe('ACTUAL_ORIGINALS_AND_INDEPENDENT_BINDING_NOT_VERIFIED');
  });

  it('cannot invent a fourth commission or reuse the first original box', () => {
    const h = recoveryHarness();
    expect(h.perform({ targetCommissionId: 'F208-COMMISSION-4' as FateRecoveryReceipt['targetCommissionId'] }).ok).toBe(false);
    expect(h.perform({ targetCommissionId: 'F208-COMMISSION-1' }).ok).toBe(false);
  });

  it('does not issue the second case more than once or repay its investigation', () => {
    const h = recoveryHarness(); h.perform();
    expect(h.perform().blockedReason).toBe('INVESTIGATION_ALREADY_PAID_NO_REROLL');
    h.verification(); expect(h.verification().blockedReason).toBe('COMMISSION_ALREADY_USED');
  });

  it('requires real funds and cannot revive a dead player for another ritual', () => {
    const h = recoveryHarness();
    expect(h.perform({ penniesAvailable: 17 }).blockedReason).toBe('PAID_INVESTIGATION_REQUIRES_18_PENNIES');
    expect(h.perform({ actorAlive: false }).ok).toBe(false);
  });

  it('preexisting unstarted commissions remain available years later, then start one real voyage clock', () => {
    const h = recoveryHarness(); h.perform(); const target = h.initial.commissions[1]!; const now = 10 * 365 * 86400;
    const r = h.verification({ now, week: 16491, checks: { registerReceipt: target.originals.commercialRegisterReceipt, boatContinuityReceipt: target.originals.boatContinuityReceipt, crateContinuityReceipt: target.originals.crateContinuityReceipt, originReceipt: target.binding.originReceipt, originalsDigest: fateOriginalsDigest(target), inspectedAt: now } });
    expect(r.ok).toBe(true); const second = harness(r.eligibleInitial!, r.eligibleEntryAt!);
    expect(second.state.scene.thirdBellAt).toBeNull(); second.perform({ type: 'TRANSIT', route: 'MAIN' });
    expect(second.state.scene.departureAt).toBe(now); expect(second.state.scene.thirdBellAt).toBe(now + 180);
  });

  it('rejects retrospectively created bindings and duplicate independent originals', () => {
    const h = recoveryHarness(); const late = copy(h.initial); late.commissions[1]!.binding.createdAt = 501;
    expect(() => createFateRecovery(late, { ...h.authority, initial: late })).toThrow('COMMISSION_NOT_PREEXISTING');
    const duplicate = copy(h.initial); duplicate.commissions[1]!.originals.cargoIds = duplicate.commissions[0]!.originals.cargoIds;
    expect(() => createFateRecovery(duplicate, { ...h.authority, initial: duplicate })).toThrow('RECOVERY_REUSES_ORIGINALS_OR_BINDING');
  });

  it('a later registered second scene does not invalidate authentic historical recovery receipts', () => {
    const h = recoveryHarness(); h.perform(); const r = h.verification();
    const second = harness(r.eligibleInitial!, r.eligibleEntryAt!);
    h.authority.priorCases = [...h.authority.priorCases, { state: second.state, authority: second.authority }];
    expect(validateFateRecovery(h.state, h.authority).valid).toBe(true);
  });

  it('a forged recovery success or waived investigation payment fails full receipt replay', () => {
    const h = recoveryHarness(); h.perform(); h.verification();
    const changed = copy(h.state); changed.journal[0]!.penniesAvailable = 0;
    expect(validateFateRecovery(changed, h.authority).valid).toBe(false);
  });
});
