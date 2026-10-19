import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { PublicResolutionTier } from '../../src/shared/contracts.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { pureWhiteAngelOriginals, applyPureWhiteAngelAcquisition, resolvePureWhiteAngelOriginalsSnapshot } from '../../src/domain/pure-white-angel/index.js';
import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { PURE_WHITE_ANGEL_PREPARATION_IDS, type PureWhiteAngelAcquisitionCommand } from '../../src/domain/pure-white-angel/types.js';
import { SUN_FUTURE_BRANCH, SUN_MATERIAL_LOCATIONS as LOC, SUN_MATERIAL_POLICY as POLICY, sunSuccessionAt } from '../../src/domain/sun/material-content.js';
import type { SunMaterialHost } from '../../src/domain/sun/material-ports.js';
import { applySunMaterial, createSunMaterials, getSunMaterialActions, projectSunMaterials,
  settleSunConsumption, transportSunMaterials, validateSunMaterialCommand, validateSunMaterialPolicy,
  sunMaterialBlock, sunMaterialConservationBlock, sunMaterialEffect, sunServiceReceiptsComplete } from '../../src/domain/sun/materials.js';
import { resolveSunOriginals } from '../../src/domain/sun/originals.js';
import { sunAcquisitionSnapshot } from '../../src/domain/sun/source.js';
import { SUN_CARRIER_IDS, SUN_LABOUR_IDS, SUN_ORIGINAL_IDS, SUN_UNIQUENESS_ID,
  type SunCarrierId, type SunMaterialCommand, type SunMaterialPolicy, type SunMaterialSettlement,
  type SunMaterialsState, type SunOriginalId, type SunServiceReceipt } from '../../src/domain/sun/types.js';
import { originalLightSeeker } from './pure-white-angel-directed-helper.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const RAW_PATH = 'tests/fixtures/pure-white-angel-v01940/natural.json';
const RAW_SHA = '3f13d554046ecffe3512bda22fb4cd14747be2b06dd6dd47185c025d7d9855f1';
const original = (n: 1 | 2 | 3): SunOriginalId => `pure-white-angel-potion-${n}`;
const bottle = (n: number) => `pure-white-angel-potion-${n}`;
let rawCache: SliceState | undefined;
const actualSource = () => structuredClone(rawCache ??= readObjectEntry<SliceState>(RAW_PATH, 'final'));
const originOf = (s: SliceState): SunMaterialsState['origin'] => {
  const acquisition = sunAcquisitionSnapshot(s);
  return { ...acquisition, actorId: `${s.runId}:original-player`, sourceDigest: sha256Hex(stableStringify(acquisition)), inheritanceLocation: 'component:inherited-original-exit' };
};
type SourceMode = 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'RECOVERED_SUCCESS' | 'RECOVERED_SUPPLIER';
const componentCache = new Map<string, SliceState>();

/** Acquisition-only component fixture, never a natural run or full-save proof.
 * Declare a pre-guidance future cursor under the unchanged source seed and draw
 * every outcome through the real deterministic stream and acquisition reducer.
 * Body/budget gaps and week advances are explicit host inputs; old receipts,
 * recorded outcomes and original bottle identities are never edited. */
function componentSource(success: 1 | 2 | 3, mode: SourceMode): SliceState {
  const key = `${success}:${mode}`, cached = componentCache.get(key); if (cached) return structuredClone(cached);
  const s = originalLightSeeker(), weeks = Math.max(0, 179 - s.week);
  s.week += weeks; s.date = addGameWeeks(s.date, weeks); s.revision += 2;
  s.schemaVersion = CURRENT_SCHEMA_VERSION; s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  expect(s.pureWhiteAngel.acquisitionJournal).toHaveLength(0);
  const recoveryMode = mode === 'RECOVERED_SUCCESS' || mode === 'RECOVERED_SUPPLIER';
  const tiers: PublicResolutionTier[] = recoveryMode ? ['FAILURE', 'FAILURE', 'FAILURE', 'SUCCESS'] : mode === 'FAILED_REMAINS' ? ['FAILURE', 'FAILURE', 'SUCCESS'] : ['SUCCESS'];
  let chosen: number | null = null;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 65536; cursor++) {
    const stream = new DeterministicActionRandomStream(s.random.seed, cursor);
    if (tiers.every(tier => resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: stream.nextInt(1, 100) }).tier === tier)) { chosen = cursor; break; }
  }
  expect(chosen).not.toBeNull(); s.random.cursor = chosen!;
  const apply = (command: PureWhiteAngelAcquisitionCommand) => {
    applyPureWhiteAngelAcquisition(s, command, { note() {}, roll() { throw Error('No auxiliary component draw'); }, check(ability, difficulty) {
      const stream = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), roll = stream.nextInt(1, 100); s.random.cursor = stream.cursor;
      return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll });
    } }); s.revision++;
  };
  const bodyGap = () => { s.revision += 2; s.health = 100; s.mind = 100; s.spirituality = 120; s.seer.pollution = 0; s.actionsRemaining = 100; };
  const consume = (id: string) => {
    bodyGap(); if (s.pureWhiteAngel.bottles.find(b => b.id === id)!.status === 'SUPPLIER') apply({ type: 'BUY_POTION', bottleId: id });
    apply({ type: 'PREPARE_PROMOTION' }); apply({ type: 'CONSUME', bottleId: id, confirmed: true });
  };
  const recover = (id: string) => {
    apply({ type: 'REQUEST_RECOVERY_V1', bottleId: id }); s.week++; s.date = addGameWeeks(s.date, 1); s.revision += 2;
    apply({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: id }); return s.pureWhiteAngel.bottles.at(-1)!.id;
  };
  apply({ type: 'LEARN_GUIDANCE' }); for (const taskId of PURE_WHITE_ANGEL_PREPARATION_IDS) apply({ type: 'PREPARE_TASK', taskId });
  if (mode === 'PLAYER') for (const id of SUN_ORIGINAL_IDS) apply({ type: 'BUY_POTION', bottleId: id });
  if (mode === 'FAILED_REMAINS') for (const id of SUN_ORIGINAL_IDS.filter(id => id !== original(success))) consume(id);
  if (recoveryMode) {
    for (const id of SUN_ORIGINAL_IDS) consume(id);
    if (mode === 'RECOVERED_SUPPLIER') recover(SUN_ORIGINAL_IDS.find(id => id !== original(success))!);
    consume(recover(original(success)));
  } else consume(original(success));
  expect(s.pureWhiteAngel.acquisitionJournal.filter(e => e.command.type === 'CONSUME').map(e => e.check!.tier)).toEqual(tiers);
  for (const e of s.pureWhiteAngel.acquisitionJournal.filter(e => e.command.type === 'CONSUME')) {
    const stream = new DeterministicActionRandomStream(s.random.seed, e.cursorBefore);
    expect(e.check).toEqual(resolveNormalCheck({ ability: 'will', baseAbility: e.before.coreStats.will, difficulty: 30, modifiers: [], roll: stream.nextInt(1, 100) }));
    expect(e.cursorAfter).toBe(stream.cursor);
  }
  expect(resolvePureWhiteAngelOriginalsSnapshot(s.pureWhiteAngel)).not.toBeNull(); expect(resolveSunOriginals(sunAcquisitionSnapshot(s))).not.toBeNull();
  componentCache.set(key, structuredClone(s)); return s;
}

/** These typed passage and host inputs exercise the materials port only. They
 * are not passage-playthrough evidence or public certificates; the private
 * engine must derive them from its actual chapter journal in integration tests. */
const componentServices = (): SunServiceReceipt[] => POLICY.serviceIds.map((serviceId, i) => ({ serviceId,
  residentId: `component:resident:${i}`, apparatusId: `component:apparatus:${i}`, passedEventId: `component:passed:${i}`,
  reviewedEventId: `component:reviewed:${i}`, passedWeek: 198, reviewedWeek: 199 }));
function harness(source = actualSource()) {
  const origin = originOf(source), originals = pureWhiteAngelOriginals(source);
  let state = createSunMaterials(origin, POLICY, originals), revision = 2000;
  const host: SunMaterialHost = { actorId: origin.actorId, sourceDigest: origin.sourceDigest, eventId: `component:${revision}`, revision,
    week: 200, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 21 }, nowSecond: 0, weekAnchor: 0,
    location: origin.inheritanceLocation, sequence: 1, status: 'ACTIVE', cash: 100000, actions: 100,
    serviceReceipts: componentServices(), legacyAccess: null, succession: sunSuccessionAt({ epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 21 }) };
  const nextEvent = () => { host.revision = ++revision; host.eventId = `component:${revision}`; };
  const syncLegacy = (id: SunOriginalId) => { host.legacyAccess = structuredClone(state.legacySites.find(site => site.originalBottleId === id) ?? null); };
  const move = (to: string) => { state = transportSunMaterials(state, host.location, to); host.location = to; if (host.legacyAccess) syncLegacy(host.legacyAccess.originalBottleId); };
  const laterWeek = () => { host.week++; host.date = addGameWeeks(host.date, 1); host.nowSecond += 604800; host.weekAnchor += 604800; host.actions = 100; host.succession = sunSuccessionAt(host.date); };
  const run = (command: SunMaterialCommand) => {
    if ('bottleId' in command) syncLegacy(command.bottleId);
    const before = stableStringify(state), result = applySunMaterial(state, command, host, POLICY);
    expect(stableStringify(state)).toBe(before); state = result.state;
    host.cash -= result.effect.cashCost; host.actions -= result.effect.actions; host.nowSecond += result.effect.seconds;
    if ('bottleId' in command) syncLegacy(command.bottleId); nextEvent();
    expect(sunMaterialConservationBlock(state)).toBeNull(); return result;
  };
  const acquire = () => {
    for (const id of SUN_ORIGINAL_IDS) {
      const item = state.characteristics.find(c => c.originBottleId === id)!;
      if (item.holder === 'SUPPLIER' || item.holder === 'PLAYER') { move(item.location!); run({ type: 'ACQUIRE_CHARACTERISTIC', bottleId: id }); }
      else if (item.holder === 'UNLOCATED') {
        move(LOC.originalRoom); run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); run({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: id });
        run({ type: 'SEAL_LEGACY_REMAINS', bottleId: id }); laterWeek(); run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); run({ type: 'RECOVER_LEGACY_REMAINS', bottleId: id });
      }
    }
    move(LOC.archive); run({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' }); move(LOC.vault);
    run({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); run({ type: 'ACQUIRE_UNIQUENESS' });
  };
  const compose = (batchId: SunCarrierId = SUN_CARRIER_IDS[0]) => {
    move(LOC.supplier); run({ type: 'BUY_COMPOUND', batchId }); move(LOC.workshop); run({ type: 'COMPOSE_POTION', batchId });
  };
  /** Explicit component outcome, not an engine roll, survival grant or proof of
   * playable promotion. The integration suite owns the normal-check outcome. */
  const settle = (success: boolean, alive: boolean, residualPresent = true) => {
    const input: SunMaterialSettlement = { eventId: host.eventId, week: host.week, compoundId: state.compounds.at(-1)!.id,
      success, alive, residualPresent, location: host.location };
    state = settleSunConsumption(state, input); if (!alive) host.status = 'DEAD'; nextEvent(); return input;
  };
  return { source, originals, host, get state() { return state; }, move, laterWeek, run, acquire, compose, settle, syncLegacy };
}


describe('Sun finite material custody: source-backed and explicitly controlled component cases', () => {
  it('pins the untouched 853-command S1 source with original1 embodied and originals2/3 supplied', () => {
    const bytes = readFileSync(RAW_PATH); expect(createHash('sha256').update(bytes).digest('hex')).toBe(RAW_SHA);
    expect(readObjectEntry<unknown[]>(RAW_PATH, 'commands')).toHaveLength(853);
    const source = actualSource(), before = stableStringify(source), r = harness(source);
    expect([source.revision, source.week, source.status, source.health, source.mind, source.spirituality, source.cash, source.actionsRemaining]).toEqual([854, 196, 'ACTIVE', 100, 98, 106, 1250, 3]);
    expect(source.pureWhiteAngel.acquisitionJournal.filter(e => e.command.type === 'CONSUME').map(e => [e.week, e.revision, e.check!.tier])).toEqual([[186, 767, 'GREAT_SUCCESS']]);
    expect(r.state.characteristics.map(c => c.holder)).toEqual(['EMBODIED', 'SUPPLIER', 'SUPPLIER']);
    expect(r.state.embodiedOriginalBottleId).toBe(original(1)); expect(r.state.legacyRemains).toEqual([]);
    expect(r.state.characteristics.map(c => c.id)).toEqual(SUN_ORIGINAL_IDS.map(id => `${id}:characteristic`));
    expect(r.state.characteristics[0]!.acquiredEventId).toBeNull(); expect(stableStringify(source)).toBe(before);
    expect(readFileSync(RAW_PATH).compare(bytes)).toBe(0);
  });

  for (const n of [1, 2, 3] as const) for (const mode of ['SUPPLIER', 'PLAYER', 'FAILED_REMAINS'] as const) {
    it(`keeps original${n} success and both ${mode} routes without adding a fourth characteristic`, () => {
      const source = componentSource(n, mode), before = stableStringify(source), r = harness(source), resolved = resolveSunOriginals(r.state.origin)!;
      expect(resolved.embodiedOriginalBottleId).toBe(original(n)); expect(resolved.embodiedBottleId).toBe(original(n));
      expect(resolved.characteristics.map(c => c.holder)).toEqual(SUN_ORIGINAL_IDS.map(id => id === original(n) ? 'EMBODIED' : mode));
      r.acquire(); r.compose(); expect(r.state.characteristics.filter(c => c.holder === 'COMPOUND')).toHaveLength(2);
      expect(r.state.characteristics.find(c => c.originBottleId === original(n))!.holder).toBe('EMBODIED');
      expect(r.state.compounds[0]!.characteristicIds).toEqual(SUN_ORIGINAL_IDS.map(id => `${id}:characteristic`));
      r.settle(true, true); expect(r.state.characteristics.every(c => c.holder === 'FUSED')).toBe(true);
      expect(r.state.uniqueness).toMatchObject({ id: SUN_UNIQUENESS_ID, holder: 'FUSED', incumbentActorId: r.host.actorId });
      expect(stableStringify(source)).toBe(before); expect(r.state.origin).toEqual(originOf(source));
    });
  }

  it.each([1, 2, 3] as const)('resolves recovered success to original%s rather than treating the new vessel as a fourth original', n => {
    const source = componentSource(n, 'RECOVERED_SUCCESS'), r = harness(source), resolved = resolveSunOriginals(r.state.origin)!;
    expect(source.pureWhiteAngel.bottles).toHaveLength(4); expect(resolved.embodiedBottleId).toBe(bottle(4));
    expect(resolved.embodiedOriginalBottleId).toBe(original(n)); expect(r.state.characteristics).toHaveLength(3);
    expect(r.state.characteristics[n - 1]).toMatchObject({ originBottleId: original(n), latestBottleId: bottle(4), holder: 'EMBODIED', recoveredVessel: true });
    expect(source.pureWhiteAngel.bottles.slice(0, 3).every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    r.acquire(); r.compose(); expect(r.state.compounds[0]!.characteristicIds).not.toContain(`${bottle(4)}:characteristic`);
  });

  it('rejects an independent fourth original, edited success, unpaid handover and invented recovery genealogy', () => {
    const actual = originOf(actualSource());
    for (const mutate of [
      (s: SunMaterialsState['origin']) => { s.bottles.push({ ...structuredClone(s.bottles[1]!), id: bottle(4) }); },
      (s: SunMaterialsState['origin']) => { s.bottles[1]!.status = 'CONSUMED'; s.bottles[1]!.outcome = 'SUCCESS'; s.bottles[1]!.consumedWeek = s.promotionWeek; },
      (s: SunMaterialsState['origin']) => { s.acquisitionJournal.find(e => e.command.type === 'BUY_POTION')!.after.cash++; },
      (s: SunMaterialsState['origin']) => { s.promotionWeek++; },
    ]) {
      const altered = structuredClone(actual); mutate(altered); expect(resolveSunOriginals(altered)).toBeNull();
      expect(() => createSunMaterials(altered, POLICY, pureWhiteAngelOriginals(actualSource()))).toThrow();
    }
    const recovered = originOf(componentSource(2, 'RECOVERED_SUCCESS'));
    recovered.bottles[3]!.recovery!.originalBottleId = original(1);
    expect(resolveSunOriginals(recovered)).toBeNull();
  });

  it('requires actual handover but charges no second purchase for inherited player-held originals', () => {
    const r = harness(componentSource(2, 'PLAYER')), c = { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(1) } as const;
    expect(sunMaterialEffect(r.state, c, POLICY)).toMatchObject({ cashCost: 0, actions: 1 });
    expect(sunMaterialBlock(r.state, c, { ...r.host, location: LOC.supplier }, POLICY)).not.toBeNull();
    expect(r.run(c).effect.cashCost).toBe(0); expect(sunMaterialBlock(r.state, c, r.host, POLICY)).not.toBeNull();
    expect(sunMaterialBlock(r.state, { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(2) }, r.host, POLICY)).not.toBeNull();
  });

  it.each(['SUPPLIER', 'RECOVERED_SUPPLIER'] as const)('requires the five current-vessel jobs for the %s discount', mode => {
    const r = harness(componentSource(3, mode)), item = r.state.characteristics.find(c => c.holder === 'SUPPLIER')!, c = { type: 'ACQUIRE_CHARACTERISTIC', bottleId: item.originBottleId } as const;
    r.move(LOC.supplier); expect(item.recoveredVessel).toBe(mode === 'RECOVERED_SUPPLIER');
    const full = item.recoveredVessel ? POLICY.recoveredVesselFullPrice : 6600, discounted = item.recoveredVessel ? POLICY.recoveredVesselLabourPrice : 1100;
    expect(sunMaterialEffect(r.state, c, POLICY).cashCost).toBe(full);
    expect(sunMaterialBlock(r.state, { type: 'MATERIAL_LABOUR', bottleId: item.originBottleId, taskId: SUN_LABOUR_IDS[1] }, r.host, POLICY)).not.toBeNull();
    for (const taskId of SUN_LABOUR_IDS.slice(0, 4)) {
      r.run({ type: 'MATERIAL_LABOUR', bottleId: item.originBottleId, taskId }); expect(sunMaterialEffect(r.state, c, POLICY).cashCost).toBe(full);
    }
    r.run({ type: 'MATERIAL_LABOUR', bottleId: item.originBottleId, taskId: SUN_LABOUR_IDS[4] });
    expect(sunMaterialEffect(r.state, c, POLICY).cashCost).toBe(discounted); expect(r.run(c).effect.cashCost).toBe(discounted);
    expect(sunMaterialBlock(r.state, { type: 'MATERIAL_LABOUR', bottleId: item.originBottleId, taskId: SUN_LABOUR_IDS[4] }, r.host, POLICY)).not.toBeNull();
  });

  it('keeps Mara at SIDE and old withdrawn permission separate from new material consent', () => {
    const source = componentSource(3, 'FAILED_REMAINS'), originals = pureWhiteAngelOriginals(source), before = stableStringify(originals), r = harness(source);
    const id = original(1), investigate = { type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: id } as const;
    expect(originals).toMatchObject({ id: 'LS2-GALLERY', ordinaryExit: 'OPEN', playerLocation: 'ENTRY', operatorId: 'LS2-MARA', operatorLocation: 'SIDE', light: { mode: 'OFF' } });
    expect(r.state.legacySites[0]).toMatchObject({ originalBottleId: id, sceneId: 'BACKLUND_ORIGINAL_LIGHT_GALLERY_ENTRY', custodianId: 'LS2-MARA', custodianPresent: true, accessible: true, residualPresent: true, investigation: 'UNASKED', handover: 'UNASKED' });
    r.move(LOC.originalRoom); r.syncLegacy(id); expect(sunMaterialBlock(r.state, investigate, r.host, POLICY)).not.toBeNull();
    for (const patch of [{ accessible: false }, { custodianPresent: false }, { residualPresent: false }, { consumeRevision: -1 }, { latestBottleId: bottle(99) }]) {
      expect(sunMaterialBlock(r.state, { type: 'ASK_LEGACY_PERMISSION', bottleId: id }, { ...r.host, legacyAccess: { ...r.host.legacyAccess!, ...patch } }, POLICY)).not.toBeNull();
    }
    r.run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id });
    for (const investigation of ['UNASKED', 'WITHDRAWN'] as const) expect(sunMaterialBlock(r.state, investigate, { ...r.host, legacyAccess: { ...r.host.legacyAccess!, investigation } }, POLICY)).not.toBeNull();
    expect(r.run(investigate).effect).toMatchObject({ cashCost: 120, actions: 1 });
    expect(r.state.legacyRemains[0]).toMatchObject({ sceneId: 'BACKLUND_ORIGINAL_LIGHT_GALLERY_ENTRY', custodianId: 'LS2-MARA', physicalVersion: originals.elapsedSeconds + 1 });
    expect(stableStringify(originals)).toBe(before); expect(pureWhiteAngelOriginals(source)).toEqual(originals);
    // This component variant explicitly supplies the real final gallery's old
    // WITHDRAWN answer without editing its historical source or authorizing reuse.
    const finalGallery = pureWhiteAngelOriginals(actualSource()), finalBefore = stableStringify(finalGallery);
    expect(finalGallery.operatorConsent).toBe('WITHDRAWN');
    const material = createSunMaterials(originOf(source), POLICY, finalGallery);
    expect(material.legacySites[0]!.investigation).toBe('UNASKED');
    const actualHost = { ...r.host, eventId: 'component:fresh-final-gallery', legacyAccess: structuredClone(material.legacySites[0]!) };
    expect(sunMaterialBlock(material, investigate, actualHost, POLICY)).not.toBeNull();
    const agreed = applySunMaterial(material, { type: 'ASK_LEGACY_PERMISSION', bottleId: id }, actualHost, POLICY);
    expect(agreed.state.legacySites[0]!.permissionEventId).toBe(actualHost.eventId);
    expect(stableStringify(finalGallery)).toBe(finalBefore);
    for (const change of [
      (o: typeof originals) => { o.playerLocation = 'FAR'; },
      (o: typeof originals) => { o.operatorLocation = 'FAR'; },
      (o: typeof originals) => { o.light.mode = 'PLAIN'; },
    ]) {
      const changed = structuredClone(originals); change(changed); const state = createSunMaterials(originOf(source), POLICY, changed);
      expect(sunMaterialBlock(state, { type: 'ASK_LEGACY_PERMISSION', bottleId: id }, { ...r.host, legacyAccess: structuredClone(state.legacySites[0]!) }, POLICY)).not.toBeNull();
    }
  });

  it('revokes old visit permission on leaving and requires next-week repermission and original-site recovery', () => {
    const r = harness(componentSource(3, 'FAILED_REMAINS')), id = original(1), seal = { type: 'SEAL_LEGACY_REMAINS', bottleId: id } as const, recover = { type: 'RECOVER_LEGACY_REMAINS', bottleId: id } as const;
    r.move(LOC.originalRoom); r.run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); r.run({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: id });
    expect(sunMaterialBlock(r.state, seal, { ...r.host, legacyAccess: { ...r.host.legacyAccess!, handover: 'WITHDRAWN' } }, POLICY)).not.toBeNull();
    expect(sunMaterialBlock(r.state, seal, { ...r.host, legacyAccess: { ...r.host.legacyAccess!, physicalVersion: 3 } }, POLICY)).not.toBeNull();
    r.move(LOC.supplier); r.move(LOC.originalRoom); expect(r.state.legacySites[0]).toMatchObject({ investigation: 'UNASKED', handover: 'UNASKED', permissionWeek: null });
    expect(sunMaterialBlock(r.state, seal, r.host, POLICY)).not.toBeNull(); r.run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id });
    r.host.actions = 0; r.host.cash = 0; expect(r.run(seal).effect).toMatchObject({ cashCost: 0, actions: 0 });
    expect(sunMaterialBlock(r.state, recover, r.host, POLICY)).not.toBeNull(); r.laterWeek(); r.host.cash = 120;
    expect(sunMaterialBlock(r.state, recover, r.host, POLICY)).not.toBeNull(); r.run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id });
    expect(sunMaterialBlock(r.state, recover, { ...r.host, location: LOC.workshop }, POLICY)).not.toBeNull();
    expect(sunMaterialBlock(r.state, recover, { ...r.host, nowSecond: r.state.legacyRemains[0]!.sealedSecond! }, POLICY)).not.toBeNull();
    expect(r.run(recover).effect).toMatchObject({ cashCost: 120, actions: 1 });
    expect(r.state.characteristics[0]).toMatchObject({ holder: 'PLAYER', location: LOC.originalRoom }); expect(r.state.legacySites[0]!.residualPresent).toBe(false);
    expect(sunMaterialBlock(r.state, recover, r.host, POLICY)).not.toBeNull();
  });

  it('binds one dated October8 predecessor death and separation to October9 non-embodied custody', () => {
    expect(validateSunMaterialPolicy(POLICY)).toBe(true);
    expect(SUN_FUTURE_BRANCH.terminationDate).toEqual({ epoch: 'FIFTH_EPOCH', year: 1352, month: 10, day: 8 });
    expect(SUN_FUTURE_BRANCH.transferDate).toEqual({ epoch: 'FIFTH_EPOCH', year: 1352, month: 10, day: 9 });
    const before = { epoch: 'FIFTH_EPOCH' as const, year: 1352, month: 10, day: 8 };
    expect(POLICY.succession.characteristicCustody.map(c => c.originalBottleId)).toEqual(SUN_ORIGINAL_IDS);
    expect(POLICY.succession.characteristicCustody.every(c => c.transfer.date.year === 1352 && c.transfer.date.month === 10 && c.transfer.date.day === 9)).toBe(true);
    expect(sunSuccessionAt(before)).toBeNull(); expect(sunSuccessionAt(SUN_FUTURE_BRANCH.transferDate)).toEqual(POLICY.succession);
    expect(POLICY.succession).toMatchObject({ objectCount: 1, predecessorStillEmbodied: false, incumbentActorId: null, custodianEmbodied: false,
      termination: { cause: 'ACTUAL_DEATH', date: before }, separation: { objectId: SUN_UNIQUENESS_ID, date: before },
      transfer: { objectId: SUN_UNIQUENESS_ID, custodyOnly: true, toActorId: SUN_FUTURE_BRANCH.custodianId } });
    const r = harness(), chain = { type: 'VERIFY_UNIQUENESS', step: 'CHAIN' } as const; r.move(LOC.archive);
    expect(sunMaterialBlock(r.state, chain, { ...r.host, date: before }, POLICY)).not.toBeNull();
    const mutate: ((p: SunMaterialPolicy) => void)[] = [
      p => { Object.assign(p.succession, { objectCount: 2 }); }, p => { Object.assign(p.succession, { predecessorStillEmbodied: true }); },
      p => { Object.assign(p.succession, { incumbentActorId: p.succession.predecessorId }); }, p => { Object.assign(p.succession, { custodianEmbodied: true }); },
      p => { p.succession.custodianActorId = p.succession.predecessorId; }, p => { p.succession.permission = 'WITHDRAWN'; },
      p => { Object.assign(p.succession.termination, { cause: 'PAPER_REASSIGNMENT' }); }, p => { p.succession.separation.eventId = p.succession.termination.eventId; },
      p => { Object.assign(p.succession.separation, { objectId: 'COPY' }); }, p => { p.succession.transfer.toActorId = 'OTHER'; },
      p => { p.succession.characteristicCustody.pop(); },
      p => { p.succession.characteristicCustody[1]!.originalBottleId = p.succession.characteristicCustody[0]!.originalBottleId; },
      p => { p.succession.characteristicCustody[1]!.transfer.date.month = 12; },
      p => { Object.assign(p.succession.transfer, { custodyOnly: false }); }, p => { p.succession.transfer.date.day = 7; },
    ];
    for (const change of mutate) {
      const policy = structuredClone(POLICY); change(policy); expect(validateSunMaterialPolicy(policy)).toBe(false);
      expect(sunMaterialBlock(r.state, chain, { ...r.host, succession: policy.succession }, POLICY)).not.toBeNull();
    }
    expect(sunMaterialBlock(r.state, chain, { ...r.host, succession: null }, POLICY)).not.toBeNull();
    expect(sunMaterialBlock(r.state, chain, { ...r.host, succession: { ...r.host.succession!, seal: 'OTHER-SEAL' } }, POLICY)).not.toBeNull();
  });

  it('requires ordered chain and same-week current vacancy checks before uniqueness handover', () => {
    const r = harness(), vacancy = { type: 'VERIFY_UNIQUENESS', step: 'VACANCY' } as const, acquire = { type: 'ACQUIRE_UNIQUENESS' } as const; r.move(LOC.archive);
    expect(sunMaterialBlock(r.state, vacancy, r.host, POLICY)).not.toBeNull(); expect(sunMaterialBlock(r.state, acquire, r.host, POLICY)).not.toBeNull();
    r.run({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' }); r.run(vacancy); expect(sunMaterialBlock(r.state, vacancy, r.host, POLICY)).not.toBeNull();
    r.laterWeek(); expect(sunMaterialBlock(r.state, acquire, r.host, POLICY)).not.toBeNull(); r.run(vacancy);
    expect(r.state.uniqueness.checks).toHaveLength(2);
    expect(sunMaterialBlock(r.state, acquire, { ...r.host, succession: { ...r.host.succession!, permission: 'WITHDRAWN' } }, POLICY)).not.toBeNull();
    expect(r.run(acquire).effect.cashCost).toBe(120); expect(r.state.uniqueness).toMatchObject({ holder: 'PLAYER', custodianActorId: null, incumbentActorId: null });
    expect(sunMaterialBlock(r.state, acquire, r.host, POLICY)).not.toBeNull();
  });

  it('accepts only exact material intents and rejects command-supplied success, custody or passage certificates', () => {
    for (const command of [
      { type: 'BUY_COMPOUND', batchId: 'sun-carrier-4' }, { type: 'ACQUIRE_CHARACTERISTIC', bottleId: bottle(4) },
      { type: 'COMPOSE_POTION', batchId: SUN_CARRIER_IDS[0], serviceReceipts: componentServices() },
      { type: 'ACQUIRE_UNIQUENESS', succession: POLICY.succession }, { type: 'SEAL_REMAINS', compoundId: 'sun-compound-4' },
      { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(2), success: true },
    ]) expect(validateSunMaterialCommand(command)).toBe(false);
    const r = harness(); for (const action of getSunMaterialActions(r.state, POLICY)) expect(validateSunMaterialCommand(action.command)).toBe(true);
  });

  it('requires two distinct resident and apparatus services with separate actual verification', () => {
    const valid = componentServices(); expect(sunServiceReceiptsComplete(valid, POLICY, 200)).toBe(true);
    const sameDay = valid.map(r => ({ ...r, reviewedWeek: r.passedWeek }));
    expect(sunServiceReceiptsComplete(sameDay, POLICY, 200)).toBe(true);
    for (const change of [
      (receipts: SunServiceReceipt[]) => { receipts.pop(); },
      (receipts: SunServiceReceipt[]) => { receipts[1]!.residentId = receipts[0]!.residentId; },
      (receipts: SunServiceReceipt[]) => { receipts[1]!.apparatusId = receipts[0]!.apparatusId; },
      (receipts: SunServiceReceipt[]) => { receipts[1]!.serviceId = receipts[0]!.serviceId; },
      (receipts: SunServiceReceipt[]) => { receipts[1]!.reviewedEventId = receipts[0]!.passedEventId; },
      (receipts: SunServiceReceipt[]) => { receipts[0]!.reviewedWeek = receipts[0]!.passedWeek - 1; },
      (receipts: SunServiceReceipt[]) => { receipts[0]!.reviewedWeek = 201; },
    ]) { const receipts = structuredClone(valid); change(receipts); expect(sunServiceReceiptsComplete(receipts, POLICY, 200)).toBe(false); }
  });

  it('will not compose from unhanded originals, a doubled embodied original or absent passage receipts', () => {
    const r = harness(); r.acquire(); r.move(LOC.supplier); r.run({ type: 'BUY_COMPOUND', batchId: SUN_CARRIER_IDS[0] }); r.move(LOC.workshop);
    const c = { type: 'COMPOSE_POTION', batchId: SUN_CARRIER_IDS[0] } as const;
    expect(sunMaterialBlock(r.state, c, { ...r.host, serviceReceipts: [] }, POLICY)).not.toBeNull();
    const unhanded = structuredClone(r.state); unhanded.characteristics[1]!.acquiredEventId = null; expect(sunMaterialBlock(unhanded, c, r.host, POLICY)).not.toBeNull();
    const doubled = structuredClone(r.state); doubled.characteristics[0]!.holder = 'PLAYER'; expect(sunMaterialConservationBlock(doubled)).not.toBeNull();
    const remote = structuredClone(r.state); remote.uniqueness.location = LOC.archive; expect(sunMaterialBlock(remote, c, r.host, POLICY)).not.toBeNull();
    r.run(c); expect(r.state.characteristics[0]!.holder).toBe('EMBODIED'); expect(sunMaterialBlock(r.state, c, r.host, POLICY)).not.toBeNull();
  });

  it('charges real component budgets and rejects another actor, source, sequence or duplicate action', () => {
    const r = harness(), c = { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(2) } as const; r.move(LOC.supplier);
    for (const patch of [{ cash: 6599 }, { actions: 0 }, { actorId: 'OTHER' }, { sourceDigest: 'OTHER' }, { sequence: 0 as const }, { status: 'DEAD' as const }]) {
      expect(sunMaterialBlock(r.state, c, { ...r.host, ...patch }, POLICY)).not.toBeNull();
    }
    const cash = r.host.cash, ap = r.host.actions, eventId = r.host.eventId; r.run(c);
    expect([r.host.cash, r.host.actions]).toEqual([cash - 6600, ap - 1]);
    expect(sunMaterialBlock(r.state, { type: 'BUY_COMPOUND', batchId: SUN_CARRIER_IDS[0] }, { ...r.host, eventId }, POLICY)).not.toBeNull();
  });

  it('keeps prepared originals together in transport, but exposed or sealed remnants stay at the failed scene', () => {
    const r = harness(); r.acquire(); r.compose(); r.move(LOC.archive);
    expect(r.state.compounds[0]!.location).toBe(LOC.archive); expect(r.state.batches[0]!.location).toBe(LOC.archive);
    expect(r.state.characteristics[0]!.location).toBe(r.host.actorId); expect(r.state.characteristics.slice(1).every(c => c.location === LOC.archive)).toBe(true);
    r.settle(false, true); r.move(LOC.supplier); expect(r.state.compounds[0]!.location).toBe(LOC.archive);
    expect(r.state.uniqueness.location).toBe(LOC.archive); expect(r.state.characteristics.slice(1).every(c => c.location === LOC.archive)).toBe(true);
    expect(sunMaterialBlock(r.state, { type: 'SEAL_REMAINS', compoundId: 'sun-compound-1' }, r.host, POLICY)).not.toBeNull();
    r.move(LOC.archive); r.run({ type: 'SEAL_REMAINS', compoundId: 'sun-compound-1' }); r.move(LOC.supplier);
    expect(r.state.uniqueness).toMatchObject({ holder: 'SEALED', location: LOC.archive });
  });

  it('preserves the embodied original through living failure, zero-action sealing and paid later-week recovery', () => {
    const r = harness(), origin = structuredClone(r.state.origin); r.acquire(); r.compose(); const input = r.settle(false, true);
    expect(r.state.characteristics.map(c => c.holder)).toEqual(['EMBODIED', 'EXPOSED', 'EXPOSED']);
    expect(r.state.uniqueness.holder).toBe('EXPOSED'); expect(() => settleSunConsumption(r.state, input)).toThrow();
    r.host.actions = 0; r.host.cash = 0; expect(r.run({ type: 'SEAL_REMAINS', compoundId: input.compoundId }).effect).toMatchObject({ cashCost: 0, actions: 0 });
    const recover = { type: 'RECOVER_SEALED', compoundId: input.compoundId } as const;
    expect(sunMaterialBlock(r.state, recover, r.host, POLICY)).not.toBeNull(); r.laterWeek();
    expect(sunMaterialBlock(r.state, recover, r.host, POLICY)).not.toBeNull(); r.host.cash = 120;
    expect(sunMaterialBlock(r.state, recover, { ...r.host, nowSecond: r.state.compounds[0]!.sealedSecond! }, POLICY)).not.toBeNull();
    expect(r.run(recover).effect).toMatchObject({ cashCost: 120, actions: 1 });
    expect(r.state.characteristics.map(c => c.holder)).toEqual(['EMBODIED', 'PLAYER', 'PLAYER']); expect(r.state.uniqueness.holder).toBe('PLAYER');
    expect(r.state.batches[0]).toMatchObject({ status: 'SPENT', uses: 1 }); expect(r.state.compounds[0]!.status).toBe('RECOVERED');
    expect(r.state.origin).toEqual(origin); expect(sunMaterialBlock(r.state, recover, r.host, POLICY)).not.toBeNull();
  });

  it('exhausts exactly three paid carriers without duplicating originals or replacing spent ordinary liquid', () => {
    const r = harness(); r.acquire(); const initialIds = r.state.characteristics.map(c => c.id);
    expect(sunMaterialBlock(r.state, { type: 'BUY_COMPOUND', batchId: SUN_CARRIER_IDS[1] }, { ...r.host, location: LOC.supplier }, POLICY)).not.toBeNull();
    for (const batchId of SUN_CARRIER_IDS) {
      r.compose(batchId); const input = r.settle(false, true); r.run({ type: 'SEAL_REMAINS', compoundId: input.compoundId });
      r.laterWeek(); r.run({ type: 'RECOVER_SEALED', compoundId: input.compoundId });
      expect(r.state.characteristics.map(c => c.id)).toEqual(initialIds); expect(r.state.uniqueness.id).toBe(SUN_UNIQUENESS_ID);
    }
    expect(r.state.batches.map(b => [b.status, b.uses])).toEqual([['SPENT', 1], ['SPENT', 1], ['SPENT', 1]]); expect(r.state.compounds).toHaveLength(3);
    expect(getSunMaterialActions(r.state, POLICY).some(a => ['BUY_COMPOUND', 'COMPOSE_POTION'].includes(a.command.type))).toBe(false);
    expect(r.state.receipts.filter(r => r.command.type === 'BUY_COMPOUND').map(r => r.effect.cashCost)).toEqual([320, 360, 400]);
    expect(sunMaterialBlock(r.state, { type: 'BUY_COMPOUND', batchId: SUN_CARRIER_IDS[0] }, { ...r.host, location: LOC.supplier }, POLICY)).not.toBeNull();
    expect(projectSunMaterials(r.state).lines.join('\n')).toContain('尚有0件未使用');
  });

  it.each([{ alive: false, residualPresent: true }, { alive: true, residualPresent: false }])('never recovers lost components after alive=$alive residualPresent=$residualPresent', ({ alive, residualPresent }) => {
    const r = harness(); r.acquire(); r.compose(); const input = r.settle(false, alive, residualPresent);
    expect(r.state.compounds[0]!.status).toBe('FAILED_LOST'); expect(r.state.uniqueness.holder).toBe('LOST');
    expect(r.state.characteristics.map(c => c.holder)).toEqual([alive ? 'EMBODIED' : 'LOST', 'LOST', 'LOST']);
    expect(sunMaterialBlock(r.state, { type: 'SEAL_REMAINS', compoundId: input.compoundId }, r.host, POLICY)).not.toBeNull();
    r.laterWeek(); expect(sunMaterialBlock(r.state, { type: 'RECOVER_SEALED', compoundId: input.compoundId }, r.host, POLICY)).not.toBeNull();
    expect(r.state.settlements).toEqual([input]); expect(sunMaterialConservationBlock(r.state)).toBeNull();
  });

  it('rejects inconsistent, premature, misplaced and receipt-reusing settlements without mutating prepared originals', () => {
    const r = harness(); r.acquire(); r.compose();
    const input: SunMaterialSettlement = { eventId: 'component:pending-settlement', compoundId: 'sun-compound-1', week: r.host.week,
      location: r.host.location, success: false, alive: true, residualPresent: true };
    const before = stableStringify(r.state);
    for (const patch of [{ success: true, alive: false }, { location: LOC.supplier }, { week: r.state.compounds[0]!.preparedWeek - 1 },
      { compoundId: 'sun-compound-2' }, { eventId: r.state.receipts.at(-1)!.eventId }]) {
      expect(() => settleSunConsumption(r.state, { ...input, ...patch })).toThrow(); expect(stableStringify(r.state)).toBe(before);
    }
  });

  it('does not expose private actor or unlocated scene details in material projection', () => {
    const r = harness(componentSource(3, 'FAILED_REMAINS')), projection = stableStringify(projectSunMaterials(r.state));
    expect(projection).not.toContain(r.host.actorId); expect(projection).not.toContain('BACKLUND_ORIGINAL_LIGHT_GALLERY_ENTRY');
    expect(projection).not.toContain('consumeRevision'); expect(projection).not.toContain('UNLOCATED'); expect(projection).toContain('地点尚未核实');
  });
});
