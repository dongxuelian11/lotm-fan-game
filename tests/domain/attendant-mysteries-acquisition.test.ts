import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { attendantMysteriesAcquisitionBlock, validateAttendantMysteriesAcquisitionJournal, validateAttendantMysteriesState } from '../../src/domain/attendant-mysteries/index.js';
import { attendantMysteriesSourceDigest } from '../../src/domain/attendant-mysteries/ritual.js';
import { ATTENDANT_MYSTERIES_ABILITY_IDS } from '../../src/domain/attendant-mysteries/types.js';
import { attendantMysteriesLifeClosed } from '../../src/domain/attendant-mysteries/life.js';
import { FACILITY_IDS, hasUsableTownRegion, townEvidence, transitionTown, validateTownState, weeklyEvent } from '../../src/domain/attendant-mysteries/town.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const ROOT = 'tests/fixtures/attendant-mysteries-v01860';
const SUCCESS = `${ROOT}/boundary-same-original-successful-consumption-revalidated.json`;
const NATURAL = `${ROOT}/natural.json`;
const ORIGINAL = 'tests/fixtures/miracle-worker-v01640/continuation.json';
const FIRST = 'attendant-mysteries-batch-1:bottle';
const SECOND = 'attendant-mysteries-batch-2:bottle';
const same = (actual: unknown, expected: unknown, label?: string): void => {
  expect(Buffer.from(stableStringify(actual)).equals(Buffer.from(stableStringify(expected))), label).toBe(true);
};
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
let savedBoundary: Boundary | undefined;
function boundary(): Boundary {
  return savedBoundary ??= { beforeLast: migrateSliceState(readObjectEntry<unknown>(SUCCESS, 'beforeLast')), lastIntent: readObjectEntry<SliceIntent>(SUCCESS, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(SUCCESS, 'final')) };
}
const consumption = (bottleId: string): SliceIntent => ({ type: 'ATTENDANT_MYSTERIES', command: { type: 'CONSUME', bottleId, confirmed: true } });

/** Positive inputs are captured natural public-play history and the same original
 * successful-consumption boundary revalidated after the inheritance correction.
 * Only that recorded intent is replayed here, without editing source or RNG.
 * Mutated clones below are declared negative tests, never natural histories. */
describe('Attendant acquisition from the real original town and original bottles', () => {
  it('requires the actual24 converted bodies, six staffed facilities and twelve distinct consequential weeks', () => {
    const s = boundary().beforeLast, t = s.attendantMysteries.town!;
    assertValidSliceState(s);
    expect(validateTownState(t)).toBe(true);
    expect(t.originals).toHaveLength(24);
    expect(new Set(t.originals.map(o => o.id)).size).toBe(24);
    expect(new Set(t.originals.map(o => o.bodyId)).size).toBe(24);
    for (const o of t.originals) {
      expect(o).toMatchObject({ nature: 'LIVING_NONHUMAN_HUMANOID_SUPERNATURAL', status: 'CONTROLLED', alive: false, location: t.plot });
      expect(o.health).toBeGreaterThan(0);
      expect(o.convertedWeek).not.toBeNull();
      expect(o.controlHistory.some(h => h.step === 'CONTINUE' && h.success && h.seconds === 30)).toBe(true);
      expect(t.journal.filter(e => e.command.type === 'CONVERT' && e.command.originalId === o.id)).toHaveLength(1);
      expect(t.worms.find(w => w.id === o.wormId)).toMatchObject({ originalId: o.id, status: 'ASSIGNED' });
      expect(t.journeys.some(j => j.to === t.plot && j.bodyIds.includes(o.bodyId))).toBe(true);
    }
    expect(t.facilities.map(f => f.id)).toEqual([...FACILITY_IDS]);
    for (const f of t.facilities) {
      expect(f.builtWeek).not.toBeNull(); expect(f.location).toBe(t.plot); expect(f.condition).toBeGreaterThan(0);
      expect(f.staff).toHaveLength(4);
      for (const id of f.staff) expect(t.originals.find(o => o.id === id)?.facility).toBe(f.id);
    }
    expect(new Set(t.facilities.flatMap(f => f.staff)).size).toBe(24);
    expect(t.fates).toHaveLength(12); expect(new Set(t.fates.map(f => f.week)).size).toBe(12);
    expect(t.journal.filter(e => e.command.type === 'LIVE_WEEK')).toHaveLength(12);
    for (const f of t.fates) {
      expect(f.choice).toBe('FULFILL'); expect(f.epoch).toBe(t.epoch); expect(f.plot).toBe(t.plot);
      expect(f.participants).toHaveLength(5); expect(f.effects).toHaveLength(5); expect(f.links).toHaveLength(4);
      const plan = weeklyEvent(f.eventIndex);
      expect(f.input).toEqual(plan.input); expect(f.output).toEqual(plan.output);
      expect(f.participants).toEqual(plan.participants); expect(f.facilities).toEqual([plan.producer, plan.receiver]);
      // Clinic/post/market weeks consume stock without producing another good.
      // The two actual clinic visits also preserve the individual health caps.
      const health = f.eventIndex === 3 ? [-1, -1, -1, 0, 0] : f.eventIndex === 9 ? [-1, -1, -1, 1, 0] : [-1, -1, -1, -1, -1];
      expect(f.effects).toEqual(plan.participants.map((originalId, i) => ({
        originalId, task: `${i < 3 ? 'Make and dispatch' : 'Receive and use'}: ${plan.title}`,
        fatigueDelta: 1, earningsDelta: 2, healthDelta: health[i],
      })));
    }
    expect(t.fates.map(f => f.eventIndex)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect(t.fates.filter(f => Object.keys(f.output).length === 0).map(f => f.eventIndex)).toEqual([3, 4, 5, 9, 10, 11]);
    // Replay only the 36 captured town commands after actual founding, not the
    // 1,038-command source run. Keep every recorded host fact and die untouched.
    const founded = migrateSliceState(readObjectEntry<unknown>(`${ROOT}/boundary-actual-twenty-four-town-founded.json`, 'final'));
    const lived = migrateSliceState(readObjectEntry<unknown>(`${ROOT}/boundary-actual-life-weeks-12.json`, 'final'));
    assertValidSliceState(founded); assertValidSliceState(lived);
    let rebuilt = founded.attendantMysteries.town!;
    const target = lived.attendantMysteries.town!;
    same(target.journal.slice(0, rebuilt.journal.length), rebuilt.journal);
    const receipts = target.journal.slice(rebuilt.journal.length);
    expect(receipts).toHaveLength(36);
    expect(receipts.filter(e => e.command.type === 'LIVE_WEEK')).toHaveLength(12);
    for (const receipt of receipts) {
      const before = rebuilt, result = transitionTown(before, receipt.command, receipt.host);
      expect(result.cost).toEqual(receipt.cost);
      const expectedGoods = { ...before.goods };
      if (receipt.command.type === 'LIVE_WEEK') {
        const plan = weeklyEvent(receipt.command.eventIndex);
        for (const material of Object.keys(expectedGoods) as (keyof typeof expectedGoods)[]) {
          expectedGoods[material] += (plan.output[material] ?? 0) - (plan.input[material] ?? 0);
        }
        const actualFate = result.state.fates[result.state.fates.length - 1]!;
        expect(actualFate).toEqual(t.fates[receipt.command.eventIndex]);
        for (const effect of actualFate.effects) {
          const previous = before.originals.find(o => o.id === effect.originalId)!;
          const current = result.state.originals.find(o => o.id === effect.originalId)!;
          expect([current.health - previous.health, current.fatigue - previous.fatigue, current.earnings - previous.earnings])
            .toEqual([effect.healthDelta, effect.fatigueDelta, effect.earningsDelta]);
          expect(current.workCount).toBe(previous.workCount + 1);
        }
      } else expect(receipt.command.type).toBe('TRAVEL');
      expect(result.state.goods).toEqual(expectedGoods);
      rebuilt = result.state;
    }
    same(rebuilt, target);
    expect(new Set(t.fates.flatMap(f => f.participants)).size).toBe(24);
    expect(townEvidence(t, s.week)).toMatchObject({ ready: true, blockers: [] });
  }, 30_000);

  it('retains all three independent visitors, actual exchanges, delivered letter and matching spirit region', () => {
    const s = boundary().beforeLast, t = s.attendantMysteries.town!;
    expect(t.visitors.map(v => v.id).sort()).toEqual(['courier-neri', 'merchant-ada', 'weaver-iven']);
    expect(t.interactions).toHaveLength(3);
    for (const v of t.visitors) {
      expect(v).toMatchObject({ human: true, alive: true, controlled: false, location: 'outside', consent: { epoch: t.epoch, status: 'USED' } });
      expect(v.age).toBeGreaterThanOrEqual(18);
      expect(t.journeys.some(j => j.from === 'outside' && j.to === t.plot && j.bodyIds.includes(v.bodyId))).toBe(true);
      expect(t.journeys.some(j => j.from === t.plot && j.to === 'outside' && j.bodyIds.includes(v.bodyId))).toBe(true);
      const interaction = t.interactions.find(x => x.visitorId === v.id)!;
      expect(interaction).toMatchObject({ purpose: v.purpose, epoch: t.epoch, plot: t.plot });
      expect(interaction.completedWeek).not.toBeNull();
      expect(interaction.townOriginalIds.every(id => t.originals.some(o => o.id === id))).toBe(true);
    }
    expect(t.interactions.find(x => x.visitorId === 'merchant-ada')?.exported).toEqual({ bread: 2 });
    expect(t.interactions.find(x => x.visitorId === 'weaver-iven')?.exported).toEqual({ tools: 1 });
    const exchange = t.interactions.find(x => x.visitorId === 'courier-neri')!, letter = t.letters.find(l => l.id === exchange.letterId)!;
    expect(letter).toMatchObject({ holder: 'recipient', epoch: t.epoch, intendedRecipient: 'outside-cooperative-clerk' });
    expect(letter.deliveredWeek).toBeGreaterThan(exchange.week);
    expect(exchange.completedWeek).toBe(letter.deliveredWeek);
    expect(t.region).toMatchObject({ id: 'town-spirit-region-1', epoch: t.epoch, plot: t.plot });
    expect(t.region!.fateIds).toEqual(t.fates.map(f => f.id));
    expect(t.region!.interactionIds).toEqual(t.interactions.map(i => i.id));
    expect(hasUsableTownRegion(t, s.week)).toBe(true);
    expect(s.attendantMysteries.preparation).toMatchObject({ bottleId: SECOND, regionId: t.region!.id, epoch: t.epoch, week: s.week, townJournalLength: t.journal.length });
  });

  it('records a real first failure and second success with two independent ten-ingredient bottles and nonrefunded fees', () => {
    const s = boundary().final, a = s.attendantMysteries;
    expect(validateAttendantMysteriesAcquisitionJournal(s)).toBe(true);
    expect(a.bottles.map(b => [b.id, b.status, b.outcome])).toEqual([[FIRST, 'CONSUMED', 'FAILURE'], [SECOND, 'CONSUMED', 'SUCCESS']]);
    expect(new Set(a.bottles.flatMap(b => b.inputIds)).size).toBe(20);
    for (const b of a.bottles) {
      const batch = a.batches.find(x => x.id === b.batchId)!;
      expect(b.inputIds).toHaveLength(10); expect(b.inputIds).toEqual(batch.materials.map(m => m.id));
      expect(batch.materials.every(m => m.holder === 'CONSUMED' && m.quantity === 0)).toBe(true);
      const labour = a.acquisitionJournal.filter(e => e.command.type === 'MATERIAL_WORK' && e.command.batchId === b.batchId);
      expect(labour).toHaveLength(5);
      expect(labour.every(e => e.before.actions - e.after.actions === 1 && e.before.cash === e.after.cash)).toBe(true);
      const buy = a.acquisitionJournal.find(e => e.command.type === 'BUY_MATERIALS' && e.command.batchId === b.batchId)!;
      const brew = a.acquisitionJournal.find(e => e.command.type === 'BREW' && e.command.batchId === b.batchId)!;
      const prepare = a.acquisitionJournal.find(e => e.command.type === 'PREPARE_PROMOTION' && e.command.bottleId === b.id)!;
      expect([buy.before.cash - buy.after.cash, brew.before.cash - brew.after.cash, prepare.before.cash - prepare.after.cash]).toEqual([900, 120, 140]);
      expect([brew.before.actions - brew.after.actions, prepare.before.actions - prepare.after.actions]).toEqual([1, 1]);
    }
    const uses = a.acquisitionJournal.filter(e => e.command.type === 'CONSUME');
    expect(uses.map(e => [e.check!.roll, e.check!.chance, e.check!.tier])).toEqual([[66, 46, 'FAILURE'], [9, 46, 'SUCCESS']]);
    const failed = uses[0]!, success = uses[1]!;
    expect([failed.before.health - failed.after.health, failed.before.mind - failed.after.mind, failed.after.pollution - failed.before.pollution]).toEqual([15, 25, 30]);
    expect([failed.before.sequence, failed.after.sequence, success.before.sequence, success.after.sequence]).toEqual([2, 2, 2, 1]);
    for (const e of uses) {
      expect(e.randomAfter).toBe(e.randomBefore + 1);
      expect([e.after.cash, e.after.actions, e.after.spirituality]).toEqual([e.before.cash, e.before.actions, e.before.spirituality]);
    }
    expect(success.after.mind).toBe(success.before.mind - 15);
    expect(success.after.health).toBe(success.before.health);
    expect(a.preparation).toBeNull();
    assertValidSliceState(s);
  }, 30_000);

  it('replays precisely the original successful intent twice with the same full result and untouched input/RNG', () => {
    const b = boundary(), before = stableStringify(b.beforeLast);
    expect(b.lastIntent).toEqual(consumption(SECOND)); expect(validateSlicePayload(b.lastIntent)).toBe(true);
    assertValidSliceState(b.beforeLast);
    const first = applySliceIntent(b.beforeLast, b.lastIntent), second = applySliceIntent(b.beforeLast, b.lastIntent);
    assertValidSliceState(first); assertValidSliceState(second);
    same(first, b.final, 'recorded original outcome'); same(second, first, 'deterministic identical replay');
    expect(stableStringify(b.beforeLast)).toBe(before);
    expect(first.random).toEqual({ seed: b.beforeLast.random.seed, cursor: b.beforeLast.random.cursor + 1 });
    expect(first.revision).toBe(b.beforeLast.revision + 1);
    same(first.attendantMysteries.town, b.beforeLast.attendantMysteries.town);
  }, 30_000);

  it('inherits all31 actual old masteries and sealed roots, adds only three zeros and preserves four unused revivals', () => {
    const original = readObjectEntry<SliceState>(ORIGINAL, 'final'), b = boundary(), s = b.final;
    expect(Object.keys(b.beforeLast.progression.mastery)).toHaveLength(31);
    expect(Object.values(b.beforeLast.progression.mastery).filter(n => n === 0)).toHaveLength(14);
    same(b.beforeLast.progression.mastery, original.progression.mastery);
    expect(Object.keys(s.progression.mastery)).toHaveLength(34);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(original.progression.mastery, id))).toEqual([...ATTENDANT_MYSTERIES_ABILITY_IDS]);
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id], id).toBe(value);
    for (const id of ATTENDANT_MYSTERIES_ABILITY_IDS) expect(s.progression.mastery[id], id).toBe(0);
    for (const key of ['seer', 'clown', 'magician', 'faceless', 'marionettist', 'bizarroSorcerer', 'ancientScholar', 'miracleWorker'] as const) same(s[key], original[key], `sealed original root ${key}`);
    expect(s.miracleWorker.revival).toEqual({ allowance: 4, used: 0, pendingDeathId: null, records: [] });
    expect(s.bizarroSorcerer.life.worms).toEqual({ capacity: 50, split: 0, assigned: 0, recalled: 0, lost: 0 });
    expect(s.attendantMysteries.town!.worms.filter(w => w.status === 'ASSIGNED')).toHaveLength(24);
    expect(s.attendantMysteries.miracleWorkerActingAtPromotion).toBe(100);
    expect(s.progression.acting).toBe(0); expect(s.character.name).toBe(original.character.name);
    expect(attendantMysteriesSourceDigest(s)).toBe(attendantMysteriesSourceDigest(original));
  });

  it('directed negative clones cannot consume with a broken region, changed relocation epoch or missing original body', () => {
    const b = boundary(), originalBytes = stableStringify(b.beforeLast);
    const mutations: Array<[string, (s: SliceState) => void]> = [
      ['missing region', s => { s.attendantMysteries.town!.region = null; }],
      ['changed epoch without genuine relocation history', s => { s.attendantMysteries.town!.epoch++; }],
      ['missing original body', s => { s.attendantMysteries.town!.originals.pop(); }],
    ];
    for (const [label, mutate] of mutations) {
      const bad = structuredClone(b.beforeLast); mutate(bad); const before = stableStringify(bad);
      expect(hasUsableTownRegion(bad.attendantMysteries.town!, bad.week), label).toBe(false);
      expect(attendantMysteriesAcquisitionBlock(bad, { type: 'CONSUME', bottleId: SECOND, confirmed: true }), label).not.toBeNull();
      expect(() => applySliceIntent(bad, b.lastIntent), label).toThrow();
      expect(() => assertValidSliceState(bad), label).toThrow();
      expect(stableStringify(bad), label).toBe(before);
      same(bad.random, b.beforeLast.random);
    }
    expect(stableStringify(b.beforeLast)).toBe(originalBytes);
  }, 30_000);

  it('directed wrong-bottle attempts fail and forged old-source facts or digests fail save validation', () => {
    const b = boundary(), before = stableStringify(b.beforeLast);
    for (const bottleId of [FIRST, 'attendant-mysteries-batch-3:bottle']) {
      expect(() => applySliceIntent(b.beforeLast, consumption(bottleId))).toThrow();
      expect(stableStringify(b.beforeLast)).toBe(before);
    }
    const mutations: Array<[string, (s: SliceState) => void]> = [
      ['preparation bound to the already consumed bottle', s => { s.attendantMysteries.preparation!.bottleId = FIRST; }],
      ['forged root source digest', s => { s.attendantMysteries.sourceHistoryDigest = '0'.repeat(64); }],
      ['changed old work facts with internally balanced totals', s => { s.miracleWorker.ritual.work.works++; s.miracleWorker.ritual.work.income += 24; }],
    ];
    for (const [label, mutate] of mutations) {
      const bad = structuredClone(b.beforeLast); mutate(bad);
      expect(validateAttendantMysteriesState(bad), label).toBe(false);
      expect(() => assertValidSliceState(bad), label).toThrow();
      same(bad.random, b.beforeLast.random);
    }
    expect(stableStringify(b.beforeLast)).toBe(before);
  }, 30_000);

  it('keeps that acquisition in the natural living three-case continuation rather than replacing it with a fabricated successful state', () => {
    const provenance = readObjectEntry<{ kind: string; source: string; newRandomChanges: boolean }>(NATURAL, 'provenance');
    expect(provenance).toMatchObject({ kind: 'SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION', source: ORIGINAL, newRandomChanges: false });
    expect(readObjectEntry<number>(NATURAL, 'prefixCount')).toBe(1038);
    expect(readObjectEntry<boolean>(NATURAL, 'prefixVerified')).toBe(true);
    const s = migrateSliceState(readObjectEntry<unknown>(NATURAL, 'final')), promoted = boundary().final;
    assertValidSliceState(s);
    expect(s.status).toBe('ACTIVE'); expect(s.progression.sequence).toBe(1); expect(s.progression.acting).toBe(100);
    expect(attendantMysteriesLifeClosed(s)).toBe(true);
    expect(Object.values(s.attendantMysteries.life.cases).map(c => c.status)).toEqual(['RESOLVED', 'RESOLVED', 'RESOLVED']);
    same(s.attendantMysteries.acquisitionJournal, promoted.attendantMysteries.acquisitionJournal);
    same(s.attendantMysteries.bottles, promoted.attendantMysteries.bottles);
    same(s.miracleWorker, promoted.miracleWorker);
    expect(ATTENDANT_MYSTERIES_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8, 8]);
  }, 30_000);
  it('keeps the actual town projection identical after canonical save-key ordering', () => {
    const s = boundary().final, original = stableStringify(s);
    const reopened = JSON.parse(original) as SliceState;
    assertValidSliceState(reopened);
    same(projectSliceState(reopened), projectSliceState(s));
    expect(stableStringify(s)).toBe(original);
  }, 15_000);

});
