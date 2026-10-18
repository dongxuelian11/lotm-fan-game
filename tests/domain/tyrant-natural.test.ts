import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openTyrantRuntimeSession, type TyrantRuntimeSession } from '../../src/domain/tyrant/owned-session.js';
import { tyrantCoastEvidence } from '../../src/domain/tyrant/coasts.js';
import {
  CURRENT_IS_CAPTURE_FORMAT, CURRENT_SUPPORTED_PROMOTION_CHECK, RAW_SUPPORTED_PROMOTION_CHECK,
  INPUT_MANIFEST, NEW_COMMANDS, PINS, PREFIX, actualReceipts, assertCaptureFreeze, assertCurrentGlobal,
  assertCaptureManifest, assertGlobalPublic, assertPublicAction, authenticateInputs, bytes, captureFiles, capturePublic,
  compactHash, expectedCurrentGlobal, hash, historicalTyrantState, historicalTyrantPublic, json, loadCapture, migrateCapturedTyrantState, outcome, readAction, same,
  type Freeze, type LoadedCapture, type Manifest,
} from '../helpers/tyrant-capture.js';

/** Exactly163 new actual commands, once, in five disjoint contiguous blocks.
 * The original701 prefix is byte-authenticated and strictly migrated, never
 * replayed. Ordinary/S1 ingress is real; guidance780 opens the owned session.
 * Only one compressed action is retained per turn. No mock or RNG overrides. */
const BLOCKS = [[702, 734, 33], [735, 767, 33], [768, 800, 33], [801, 832, 32], [833, 864, 32]] as const;
let data: LoadedCapture;
beforeAll(() => { data = loadCapture(); }, 240_000);
afterAll(() => { authenticateInputs(); }, 240_000);
const actionAt = (count: number) => readAction(data.rows[count - PREFIX - 1]!);
function preserveOriginal(state: SliceState): void {
  const original = data.original;
  expect(state.runId).toBe(original.runId); expect(state.random.seed).toBe(original.random.seed);
  for (const key of ['sailor', 'rager', 'navigator', 'windBlessed', 'oceanSinger', 'cataclysmPriest', 'seaKing', 'town', 'combatHistory'] as const)
    same(state[key], original[key], `Original701 ${key} changed`);
  const catastrophe = structuredClone(state.catastrophe); catastrophe.life.site = structuredClone(original.catastrophe.life.site);
  same(catastrophe, original.catastrophe);
  for (const key of ['water', 'gate', 'buoy', 'mooring', 'winch', 'wheel'] as const)
    same(state.catastrophe.life.site[key], original.catastrophe.life.site[key]);
  const { coreStats: _current, ...identity } = state.character, { coreStats: _old, ...oldIdentity } = original.character;
  same(identity, oldIdentity);
  for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(state.progression.mastery[id], id).toBe(mastery);
  same(state.thunderGod.bottles.slice(0, 3), original.thunderGod.bottles);
  same(state.thunderGod.sourceScene, original.thunderGod.sourceScene); same(state.thunderGod.sourceHistory, original.thunderGod.sourceHistory);
  same(state.thunderGod.acquisitionJournal.slice(0, original.thunderGod.acquisitionJournal.length), original.thunderGod.acquisitionJournal);
  for (const bottle of state.thunderGod.bottles.slice(3)) expect(bottle.recovery?.originalBottleId).toBe('thunder-god-potion-1');
  expect(state.combat).toBeNull();
}

describe('NEW rebuilt215 immutable natural864 death capture', () => {
  it('authenticates all321 members, original835, original701 and all163 actual action inputs', () => {
    expect(data.rows).toHaveLength(NEW_COMMANDS); expect(captureFiles()).toHaveLength(321);
    expect(data.checkpoint.boundaries.map(row => row.commandCount)).toEqual(PINS.boundaryCommandCounts);
    expect(data.checkpoint.pending).toBeNull();
    expect(data.checkpoint.terminal).toEqual({ stage: PINS.stage, reason: PINS.reason });
    expect(data.original).toMatchObject({ schemaVersion: 190, contentVersion: 'thunder-god-v190', revision: 702,
      status: 'ACTIVE', week: 169, health: 93, mind: 85, spirituality: 120, cash: 210, actionsRemaining: 2,
      random: { seed: 'sailor-natural-v026', cursor: 270 }, progression: { pathwayId: 'tyrant', sequence: 2, acting: 100 } });
    expect(data.original.thunderGod.bottles).toHaveLength(3);
    expect(data.original.thunderGod.bottles.map(bottle => bottle.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE']);
    expect(data.archived.commands).toHaveLength(820); expect(data.archived.final.status).toBe('DEAD');
    expect(compactHash(data.archived.commands.slice(0, PREFIX))).toBe(PINS.prefixSha256);
    const counts = BLOCKS.flatMap(([first, last, size]) => {
      expect(last - first + 1).toBe(size); return Array.from({ length: size }, (_, index) => first + index);
    });
    expect(counts).toEqual(data.rows.map(row => row.commandCount)); expect(new Set(counts).size).toBe(163);
    expect(data.summary).toMatchObject({ rebuild: 'NEW215', lostOriginal215Restored: false, commands: 864,
      originalCommands: 701, newCommands: 163, paused: false, diagnostic: false, controlledStop: false });
  });

  it('rejects missing, added, duplicated, path-traversed or rewritten capture evidence without touching files', () => {
    const manifest = JSON.parse(bytes(INPUT_MANIFEST).toString('utf8')) as Manifest, names = manifest.files.map(row => row.file);
    const before = hash(manifest);
    expect(() => assertCaptureManifest(manifest, names)).not.toThrow();
    expect(() => assertCaptureManifest(manifest, names.filter(name => name !== 'action-836.json.gz'))).toThrow();
    expect(() => assertCaptureManifest(manifest, [...names, 'replacement.json'])).toThrow();
    const duplicate = structuredClone(manifest); duplicate.files[1] = structuredClone(duplicate.files[0]!);
    expect(() => assertCaptureManifest(duplicate, names)).toThrow();
    const traversed = structuredClone(manifest); traversed.files[0]!.file = '../substitute.json';
    expect(() => assertCaptureManifest(traversed, names)).toThrow();
    const freeze = json<Freeze>('runtime-freeze.json'), rewritten = structuredClone(freeze);
    rewritten.files[0]!.sha256 = '0'.repeat(64); expect(() => assertCaptureFreeze(rewritten)).toThrow();
    rewritten.sha256 = compactHash(rewritten.files); expect(() => assertCaptureFreeze(rewritten)).toThrow();
    const row = structuredClone(data.rows[134]!); row.afterStateSha256 = '0'.repeat(64);
    expect(() => readAction(row)).toThrow(); expect(hash(manifest)).toBe(before);
  });

  it.each(BLOCKS)('replays recorded %i..%i (%i commands) with every full private/RNG/chapter/global boundary', (first, last, size) => {
    let state = first === PREFIX + 1 ? structuredClone(data.initial) : migrateCapturedTyrantState(actionAt(first).beforeLast);
    let session: TyrantRuntimeSession | null = state.tyrant.guidanceKnown ? openTyrantRuntimeSession(state) : null;
    let global = session ? session.project() : projectSliceState(state), view = capturePublic(global);
    const rows = data.rows.filter(row => row.commandCount >= first && row.commandCount <= last);
    expect(rows).toHaveLength(size); let prepared = 0, committed = 0, ingress = 0;
    for (const row of rows) {
      const before = state, beforeHash = hash(before), recorded = readAction(row);
      // Historical hashes were independently checked by readAction; current
      // schema admission and replay expectations do not overwrite those pins.
      const expectedBefore = CURRENT_IS_CAPTURE_FORMAT ? recorded.beforeLast : migrateCapturedTyrantState(recorded.beforeLast);
      const expectedAfter = CURRENT_IS_CAPTURE_FORMAT ? recorded.final : migrateCapturedTyrantState(recorded.final);
      const expectedGlobalBefore = CURRENT_IS_CAPTURE_FORMAT ? expectedCurrentGlobal(recorded, 'before') : projectSliceState(expectedBefore);
      const expectedGlobalAfter = CURRENT_IS_CAPTURE_FORMAT ? expectedCurrentGlobal(recorded, 'after') : projectSliceState(expectedAfter);
      same(before, expectedBefore, `Complete private before ${row.commandCount}`);
      same(global, expectedGlobalBefore, `Complete global before ${row.commandCount}`);
      assertCurrentGlobal(global, recorded, 'before');
      same(view, capturePublic(expectedGlobalBefore), `Complete chapter before ${row.commandCount}`);
      expect(before.random).toEqual(recorded.randomBefore); expect(hash(before.random)).toBe(row.randomBeforeSha256);
      assertGlobalPublic(global, before); assertPublicAction(recorded.publicBefore, row); assertPublicAction(view, row);
      expect(validateSlicePayload(row.intent)).toBe(true); expect(before.status).toBe('ACTIVE');
      if (session) {
        const draft = session.prepare(row.intent, before.revision); prepared++;
        state = session.snapshotDraft(draft); global = session.projectDraft(draft);
        expect(session.inspect()).toEqual({ runId: before.runId, revision: before.revision, status: before.status });
        expect(hash(before), 'Prepare cannot mutate predecessor').toBe(beforeHash);
        same(state, expectedAfter); same(global, expectedGlobalAfter);
        session.commit(draft); committed++;
        expect(session.inspect()).toEqual({ runId: state.runId, revision: state.revision, status: state.status });
      } else {
        expect(row.commandCount).toBeLessThanOrEqual(780); ingress++;
        state = applySliceIntent(before, row.intent);
        if (state.tyrant.guidanceKnown) {
          expect(row.commandCount).toBe(780); expect(row.intent).toEqual({ type: 'TYRANT', command: { type: 'LEARN_GUIDANCE' } });
          session = openTyrantRuntimeSession(state); global = session.project();
        } else global = projectSliceState(state);
      }
      view = capturePublic(global); assertGlobalPublic(global, state);
      expect(hash(before), 'Commit cannot rewrite predecessor').toBe(beforeHash);
      same(state, expectedAfter, `Complete private after ${row.commandCount}`);
      same(global, expectedGlobalAfter, `Complete global after ${row.commandCount}`);
      same(view, capturePublic(expectedGlobalAfter), `Complete chapter after ${row.commandCount}`);
      expect(hash(historicalTyrantState(before))).toBe(row.beforeStateSha256);
      expect(hash(historicalTyrantState(state))).toBe(row.afterStateSha256);
      assertCurrentGlobal(global, recorded, 'after');
      if (row.commandCount !== 717) expect(hash(historicalTyrantPublic(global, state))).toBe(row.globalPublicAfterSha256);
      expect(hash(view)).toBe(row.publicAfterSha256);
      expect(state.random).toEqual(recorded.randomAfter); expect(hash(state.random)).toBe(row.randomAfterSha256);
      expect(state.random.seed).toBe(data.original.random.seed);
      expect([state.revision, state.week]).toEqual([row.revision, row.week]); expect(state.revision).toBe(before.revision + 1);
      expect(outcome(view)).toEqual(row.selectionOutcome); same(actualReceipts(state, before), row.receipts);
      if (before.tyrant.guidanceKnown) {
        for (const key of ['tyrant', 'thunderGod', 'catastrophe', 'world', 'character'] as const)
          same(key === 'tyrant' ? state.tyrant.source : state[key], key === 'tyrant' ? before.tyrant.source : before[key]);
      }
    }
    expect(prepared + ingress).toBe(size); expect(committed).toBe(prepared);
    if (session) { same(session.snapshot(), state); same(session.project(), global); }
    const end = actionAt(last);
    same(state, migrateCapturedTyrantState(end.final)); preserveOriginal(state);
    if (last === 864) {
      same(state, migrateCapturedTyrantState(data.checkpoint.state));
      expect(state).toMatchObject({ status: 'DEAD', health: 0, week: 195, random: { cursor: 284 } });
      expect(view.tyrant.promoted).toBe(false);
    }
  }, 240_000);

  it('allows only verified empty Sun, Death and Door roots when comparing captured212', () => {
    const state = data.initial, historical = historicalTyrantState(state);
    for (const root of ['sun', 'death', 'door'] as const) {
      const { [root]: _missing, ...missing } = state;
      expect(() => historicalTyrantState(missing as SliceState)).toThrow();
      for (const value of [null, { ...state[root], guidanceKnown: true },
        { ...state[root], unexpectedField: undefined }])
        expect(() => historicalTyrantState({ ...state, [root]: value } as SliceState)).toThrow();
      expect(() => migrateCapturedTyrantState({ ...historical, [root]: state[root] } as SliceState)).toThrow();
    }
    expect(hash(historicalTyrantState({ ...state, unknownRoot: null } as SliceState))).not.toBe(hash(historical));
    const projection = projectSliceState(state), oldPublic = historicalTyrantPublic(projection, state);
    for (const root of ['sun', 'death', 'door'] as const) {
      const { [root]: _missing, ...missing } = projection;
      expect(() => historicalTyrantPublic(missing as SliceProjection, state)).toThrow();
      for (const value of [null, { ...projection[root], promoted: true },
        { ...projection[root], unexpectedField: undefined }])
        expect(() => historicalTyrantPublic({ ...projection, [root]: value } as SliceProjection, state)).toThrow();
    }
    expect(hash(historicalTyrantPublic({ ...projection, unknownRoot: null } as SliceProjection, state)))
      .not.toBe(hash(oldPublic));
  });

  it('changes only the full717-after/718-before public check from legacy44 to the actual paid70 receipt', () => {
    const promoted = actionAt(717), next = actionAt(718), rawHash = hash(promoted.globalPublic), privateHash = hash(promoted.final);
    expect(promoted.globalPublic.lastCheck).toEqual(RAW_SUPPORTED_PROMOTION_CHECK);
    expect(promoted.final.lastCheck).toEqual(RAW_SUPPORTED_PROMOTION_CHECK);
    same(next.globalPublicBefore, promoted.globalPublic); same(next.beforeLast, promoted.final);
    const expected = expectedCurrentGlobal(promoted, 'after');
    expect(expected.lastCheck).toEqual(CURRENT_SUPPORTED_PROMOTION_CHECK);
    expect(expected.lastCheck).toEqual(promoted.final.thunderGod.acquisitionJournal.at(-1)!.check);
    same(expectedCurrentGlobal(next, 'before'), expected);
    const { lastCheck: _rawCheck, ...rawRest } = promoted.globalPublic;
    const { lastCheck: _currentCheck, ...currentRest } = expected;
    same(currentRest, rawRest, 'No other public field, value, ordering or identifier may change');
    same(expectedCurrentGlobal(promoted, 'before'), promoted.globalPublicBefore);
    same(expectedCurrentGlobal(next, 'after'), next.globalPublic);
    same(capturePublic(expected), promoted.public);
    const current = migrateCapturedTyrantState(promoted.final), actual = projectSliceState(current);
    assertCurrentGlobal(actual, promoted, 'after'); assertCurrentGlobal(actual, next, 'before');
    const currentExpected = { ...expected, sun: actual.sun, death: actual.death, door: actual.door };
    expect(() => assertCurrentGlobal({ ...promoted.globalPublic, sun: actual.sun, death: actual.death, door: actual.door }, promoted, 'after')).toThrow();
    const extraChange = structuredClone(currentExpected); extraChange.cash++;
    expect(() => assertCurrentGlobal(extraChange, promoted, 'after')).toThrow();
    const extraField = { ...currentExpected, unexpectedPromotionField: true };
    expect(() => assertCurrentGlobal(extraField, promoted, 'after')).toThrow();
    const wrongSupport = structuredClone(currentExpected);
    wrongSupport.lastCheck = { ...wrongSupport.lastCheck!, modifiers: [{ source: '同瓶同场当周有价支持', value: 14 }] };
    expect(() => assertCurrentGlobal(wrongSupport, promoted, 'after')).toThrow();
    expect(hash(promoted.globalPublic)).toBe(rawHash); expect(hash(promoted.final)).toBe(privateHash);
    expect(promoted.final.random).toEqual({ seed: 'sailor-natural-v026', cursor: 271 });
    expect(current.lastCheck).toEqual(RAW_SUPPORTED_PROMOTION_CHECK);
  }, 240_000);

  it('keeps all three original failures and paid recovery before the real supported70% roll36 S1 success', () => {
    const promoted = actionAt(717), final = data.checkpoint.state;
    const checks = final.thunderGod.acquisitionJournal.filter(row => row.command.type === 'CONSUME');
    expect(checks.map(row => [row.week, row.check?.chance, row.check?.roll, row.check?.tier, row.cursorBefore, row.cursorAfter]))
      .toEqual([[149, 44, 84, 'FAILURE', 267, 268], [159, 44, 75, 'FAILURE', 268, 269],
        [168, 44, 94, 'FAILURE', 269, 270], [173, 70, 36, 'SUCCESS', 270, 271]]);
    expect([promoted.beforeLast.progression.sequence, promoted.final.progression.sequence]).toEqual([2, 1]);
    expect(final.thunderGod.bottles).toHaveLength(4);
    expect(final.thunderGod.bottles[3]).toMatchObject({ id: 'thunder-god-potion-4', labourSteps: 5, outcome: 'SUCCESS',
      acquiredWeek: 173, consumedWeek: 173, recovery: { originalBottleId: 'thunder-god-potion-1',
        sourceBottleId: 'thunder-god-potion-1', characteristicId: 'thunder-god-potion-1:characteristic', requestedWeek: 169, recoveredWeek: 170 } });
    const request = actionAt(702); expect(request.beforeLast.cash - request.final.cash).toBe(120);
    expect(promoted.beforeLast.mind - promoted.final.mind).toBe(15);
    expect(data.checkpoint.policy).toMatchObject({ s1Doses: 1, doses: 0, epilogueAttempted: [], reported: false });
    expect(final.thunderGod.life.reflected).toBe(true);
    expect(Object.values(final.thunderGod.life.cases).map(c => [c.status, c.method, c.returned, c.contactOpen]))
      .toEqual(Array.from({ length: 3 }, () => ['RESOLVED', 'ORDINARY', true, false]));
    expect(final.progression.mastery['tyrant.s1.guided-thunder']).toBe(0);
    expect(final.progression.mastery['tyrant.s1.storm-brace']).toBe(0);
    expect(final.progression.mastery['tyrant.s0.bounded-storm']).toBeUndefined();
    expect(final.progression.mastery['tyrant.s0.matter-energy']).toBeUndefined();
    preserveOriginal(final);
  });

  it('retains East830 failure, the exact835 cooldown, real paid836 wait and fresh paid-grain838 renewal', () => {
    const failed = actionAt(830), wait = actionAt(836), renewed = actionAt(838);
    expect(failed.final.lastCheck).toMatchObject({ chance: 72, roll: 74, tier: 'FAILURE' });
    expect([failed.beforeLast.health - failed.final.health, failed.beforeLast.spirituality - failed.final.spirituality,
      failed.beforeLast.actionsRemaining - failed.final.actionsRemaining]).toEqual([4, 6, 1]);
    expect(failed.final.tyrant.coasts!.coasts[1]).toMatchObject({ grain: 12, fulfillment: { passed: false }, review: null });
    expect(failed.final.tyrant.coasts!.coasts[1]!.cohorts.every(g => g.fears && !g.obeys && !g.believes)).toBe(true);
    const refusal = actionAt(834).final.tyrant.coasts!.coasts[1]!;
    expect(refusal).toMatchObject({ status: 'REFUSED', permission: { answer: 'REFUSE', week: 190 }, review: null });
    const cooldown = wait.publicBefore.tyrant.actions.find(a => a.command.type === 'COAST' &&
      a.command.command.type === 'ASK_PERMISSION' && a.command.command.coastId === 'east');
    expect(cooldown).toMatchObject({ preferredAction: true, enabled: false, reason: '本周已得到这一原人群答复，不反复询问刷许可。' });
    expect(wait.lastIntent).toEqual({ type: 'TYRANT', command: { type: 'NEXT_WEEK' } });
    expect([wait.beforeLast.week, wait.final.week, wait.beforeLast.cash - wait.final.cash]).toEqual([190, 191, 30]);
    expect([wait.final.health, wait.final.mind, wait.final.spirituality]).toEqual([wait.beforeLast.health, wait.beforeLast.mind, wait.beforeLast.spirituality]);
    same(wait.final.random, wait.beforeLast.random);
    same(wait.final.tyrant.coasts!.coasts, wait.beforeLast.tyrant.coasts!.coasts);
    expect(renewed.lastIntent).toEqual({ type: 'TYRANT', command: { type: 'COAST', command: { type: 'RENEW', coastId: 'east' } } });
    expect(renewed.final.lastCheck).toMatchObject({ chance: 72, roll: 55, tier: 'SUCCESS' });
    expect([renewed.beforeLast.tyrant.coasts!.coasts[1]!.grain, renewed.final.tyrant.coasts!.coasts[1]!.grain]).toEqual([12, 9]);
    expect(renewed.beforeLast.actionsRemaining - renewed.final.actionsRemaining).toBe(1);
    expect(renewed.beforeLast.spirituality - renewed.final.spirituality).toBe(6);
  });

  it('accounts for the same270000 living followers, all36 original grain and every actual sea journey', () => {
    const final = data.checkpoint.state, coasts = final.tyrant.coasts!, evidence = tyrantCoastEvidence(coasts, final.week);
    expect(evidence).toMatchObject({ validRoster: true, intersection: 270000, required: 200000, ready: true });
    expect(evidence.groups).toHaveLength(9); expect(new Set(evidence.groups.map(g => g.id)).size).toBe(9);
    expect(coasts.coasts.map(c => [c.id, c.grain, c.review?.week, c.review?.expiresWeek]))
      .toEqual([['north', 12, 188, 200], ['east', 9, 192, 204], ['south', 3, 194, 206]]);
    const paid = coasts.journal.filter(row => ['FULFILL', 'RENEW'].includes(row.command.type));
    expect(paid.map(row => [row.command.coastId, row.command.type, row.grainBefore - row.grainAfter]))
      .toEqual([['north', 'FULFILL', 3], ['east', 'FULFILL', 3], ['east', 'RENEW', 3], ['south', 'FULFILL', 3]]);
    expect(coasts.coasts.reduce((sum, c) => sum + c.grain, 0) + paid.reduce((sum, row) => sum + row.grainBefore - row.grainAfter, 0)).toBe(36);
    expect(coasts.parcels).toEqual([]); // This natural branch did not require a transfer; never invent one.
    expect(final.tyrant.seaVoyages).toHaveLength(3);
    for (const voyage of final.tyrant.seaVoyages) {
      expect(voyage).toMatchObject({ cashCost: 60, actions: 1, cargoId: null });
      expect(voyage.arriveWeek - voyage.departWeek).toBe(1); expect(voyage.arriveSecond - voyage.departSecond).toBe(604800);
    }
    expect(tyrantCoastEvidence(coasts, 206).intersection).toBe(0);
  });

  it('archives actual ninth-exchange death at60 metres without survival, S0, refunds or replacement originals', () => {
    const final = data.checkpoint.state, challenge = final.tyrant.challenge!, materials = final.tyrant.materials!;
    expect(final).toMatchObject({ revision: 865, status: 'DEAD', week: 195, health: 0, mind: 100,
      spirituality: 76, cash: 120, actionsRemaining: 0, random: { seed: 'sailor-natural-v026', cursor: 284 },
      progression: { sequence: 1 }, ending: { kind: 'DEATH' } });
    expect(challenge).toMatchObject({ status: 'DEAD', startedWeek: 195, position: 60, totalWalkedMeters: 60, escape: null,
      opponent: { pathway: 'sun', sequence: 0, status: 'ACTIVE', disposition: 'HOSTILE', health: 988, spirituality: 9872, pursuitCount: 9 } });
    expect(challenge.participants.map(p => p.role)).toEqual(['CHALLENGER', 'HOSTILE_DEITY']);
    expect(challenge.exchanges.map(e => [e.command, e.check.roll])).toEqual([
      ['BEGIN', 41], ['WITHDRAW', 98], ['WITHDRAW', 79], ['WITHDRAW', 84], ['WITHDRAW', 65],
      ['WITHDRAW', 81], ['WITHDRAW', 100], ['WITHDRAW', 19], ['WITHDRAW', 38],
    ]);
    expect(final.injuries.map(i => i.severity)).toEqual(['HEAVY', 'LIGHT', 'LIGHT', 'LIGHT', 'HEAVY']);
    same(final.injuries, challenge.injuries);
    expect(materials.characteristics.map(c => [c.originBottleId, c.latestBottleId, c.holder, c.location, c.compoundId]))
      .toEqual([1, 2, 3].map(n => [`thunder-god-potion-${n}`, `thunder-god-potion-${n === 1 ? 4 : n}`, 'UNAVAILABLE', 'TYRANT0-SUN-CHALLENGE', null]));
    expect(materials.uniqueness).toMatchObject({ id: 'TY0-U1', holder: 'UNAVAILABLE', location: 'TYRANT0-SUN-CHALLENGE', compoundId: null });
    expect(materials.death?.dispositions.map(d => [d.id, d.holder])).toEqual([
      ['thunder-god-potion-1:characteristic', 'EMBODIED'], ['thunder-god-potion-2:characteristic', 'PLAYER'],
      ['thunder-god-potion-3:characteristic', 'PLAYER'], ['TY0-U1', 'PLAYER'],
    ]);
    expect(materials.compounds).toEqual([]); expect(materials.settlements).toEqual([]);
    expect(materials.batches.map(b => [b.id, b.status, b.uses])).toEqual([
      ['tyrant-carrier-1', 'PLAYER', 0], ['tyrant-carrier-2', 'SUPPLIER', 0], ['tyrant-carrier-3', 'SUPPLIER', 0],
    ]);
    expect(final.tyrant.promotionWeek).toBeNull(); expect(final.tyrant.epilogue).toBeNull();
    expect(outcome(data.summary.public)).toEqual({ status: 'DEAD', sequence: 1, promoted: false, guidance: true, s1Reflected: true });
  });

  it('rejects injected outcomes/private sources and refuses every attempted continuation of the actual DEAD endpoint', () => {
    const final = migrateCapturedTyrantState(data.checkpoint.state), before = hash(final);
    const session = openTyrantRuntimeSession(final), global = session.project();
    assertGlobalPublic(global, final);
    const injected = structuredClone(global) as SliceProjection & { nextRoll?: number; privateSource?: unknown };
    injected.nextRoll = 1; expect(() => assertGlobalPublic(injected, final)).toThrow(); delete injected.nextRoll;
    injected.privateSource = { actorId: final.tyrant.source!.actorId }; expect(() => assertGlobalPublic(injected, final)).toThrow();
    expect(validateSlicePayload({ type: 'TYRANT', command: { type: 'CHALLENGE', command: { type: 'WITHDRAW', success: true } } })).toBe(false);
    expect(validateSlicePayload({ type: 'TYRANT', command: { type: 'COAST', command: { type: 'FULFILL', coastId: 'east', population: 270000 } } })).toBe(false);
    expect(global.tyrant.actions.every(a => !a.enabled)).toBe(true);
    const attempts: SliceIntent[] = [
      { type: 'TYRANT', command: { type: 'NEXT_WEEK' } },
      { type: 'TYRANT', command: { type: 'CHALLENGE', command: { type: 'BREAK_CONTACT' } } },
      { type: 'TYRANT', command: { type: 'MATERIAL', command: { type: 'RECOVER_LEGACY_REMAINS', bottleId: 'thunder-god-potion-2' } } },
    ];
    for (const intent of attempts) expect(() => session.prepare(intent, final.revision)).toThrow();
    expect(() => applySliceIntent(final, { type: 'ACTION', action: 'REST' })).toThrow();
    expect(hash(final)).toBe(before); same(session.snapshot(), final); same(session.project(), global);
    expect(session.inspect()).toEqual({ runId: final.runId, revision: 865, status: 'DEAD' });
  }, 240_000);
});
