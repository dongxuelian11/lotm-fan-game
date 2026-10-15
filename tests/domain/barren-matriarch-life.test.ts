import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { PublicResolutionTier } from '../../src/shared/contracts.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { BARREN_MATRIARCH_PREPARATION_IDS } from '../../src/domain/barren-matriarch/types.js';
import { BARREN_MATRIARCH_CASE_IDS, barrenMatriarchLifeClosed, blockBarrenMatriarchLife, hasBarrenMatriarchLifeLock, projectBarrenMatriarchLife, replayBarrenMatriarchLifeRoot, replayBarrenMatriarchLifeRootPad, validateBarrenMatriarchActivityCommand, validateBarrenMatriarchLifeState, validateBarrenMatriarchSourceCoffinBearerLife, type BarrenMatriarchActivityCommand, type BarrenMatriarchCaseId } from '../../src/domain/barren-matriarch/life.js';
import { ba, directedInitial3, dose, originalCoffinBearer, promoted, rejectBarrenMatriarch, rejectIntent } from './barren-matriarch-directed-helper.js';
const DORMANCY = 'mother.s2.bounded-dormancy', BUFFER = 'mother.s2.root-buffer';
const attempt = (s: SliceState, id: BarrenMatriarchCaseId) => s.barrenMatriarch.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, command: BarrenMatriarchActivityCommand): SliceState { const next = ba(s, command); expect(validateBarrenMatriarchLifeState(next), JSON.stringify(command)).toBe(true); return next; }
function begin(s: SliceState, id: BarrenMatriarchCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', consent: 'CONSENT_OWNER' | 'DECLINE_PERMISSION' = 'CONSENT_OWNER'): SliceState {
  for (const c of [{ type: 'OBSERVE', caseId: id }, { type: 'PREPARE', caseId: id, method }, { type: 'WALK', caseId: id, to: 'A' }, { type: 'CHECK_ORIGINALS', caseId: id }, { type: consent, caseId: id }, { type: 'TAKE_KIT', caseId: id }] as BarrenMatriarchActivityCommand[]) s = act(s, c);
  if (id === 'bounded-dormancy') s = act(s, { type: 'WALK', caseId: id, to: 'B' });
  for (const type of ['CHECK_SAMPLE', 'CONSENT_SAMPLE', 'TAKE_SAMPLE'] as const) s = act(s, { type, caseId: id }); return s;
}
function across(s: SliceState, id: BarrenMatriarchCaseId): SliceState {
  s = act(s, { type: 'WALK', caseId: id, to: id === 'bounded-dormancy' ? 'A' : 'B' });
  if (id === 'withdrawn-transfer') s = act(s, { type: 'WITHDRAW_PERMISSION', caseId: id });
  s = act(s, { type: 'VERIFY_TRANSPORT', caseId: id });
  return id === 'finite-root-buffer' ? act(s, { type: 'CONFIRM_LIMITED', caseId: id }) : s;
}
function finishAcross(s: SliceState, id: BarrenMatriarchCaseId, report = true): SliceState {
  if (id === 'finite-root-buffer' && !attempt(s, id).impact) s = act(s, { type: 'ORDINARY_SUPPORT', caseId: id });
  s = act(s, { type: 'WALK', caseId: id, to: id === 'bounded-dormancy' ? 'B' : 'A' });
  if (s.barrenMatriarch.life.operation.dormancy || s.barrenMatriarch.life.operation.buffer) s = act(s, { type: 'STOP', caseId: id });
  s = act(s, { type: 'RETURN_SAMPLE', caseId: id });
  if (id === 'bounded-dormancy') s = act(s, { type: 'WALK', caseId: id, to: 'A' });
  for (const c of [{ type: 'RETURN_KIT', caseId: id }, { type: 'WALK', caseId: id, to: 'START' }, { type: 'INSPECT', caseId: id }, { type: 'LEAVE', caseId: id }] as BarrenMatriarchActivityCommand[]) s = act(s, c);
  return report ? act(s, { type: 'REPORT', caseId: id }) : s;
}
const ordinary = (s: SliceState, id: BarrenMatriarchCaseId) => finishAcross(across(begin(s, id, 'ORDINARY'), id), id);
const third = (s: SliceState) => ordinary(ordinary(s, 'bounded-dormancy'), 'withdrawn-transfer');
const cache = new Map<string, SliceState>();
/** Declared unit-only AP and original-seed cursor selection BEFORE new acquisition.
 * Old people, samples, records, health, injuries and historical checks remain exact. */
function directed(tiers: PublicResolutionTier[], actions = 100): SliceState {
  const key = `${tiers}:${actions}`, cached = cache.get(key); if (cached) return structuredClone(cached);
  let s = directedInitial3(); const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] }); let cursor: number | null = null;
  for (let n = s.random.cursor; n < s.random.cursor + 8192; n++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, n), potion = rng.nextInt(1, 100); if (potion <= 5 || potion > potionChance) continue;
    const okay = tiers.every(tier => { const roll = rng.nextInt(1, 100), chance = computeCheckChance({ baseAbility: Math.min(500, s.character.coreStats.knowledge + 1), difficulty: 20, modifiers: [] }); return tier === 'GREAT_SUCCESS' ? roll <= 5 : tier === 'SUCCESS' ? roll > 5 && roll <= chance : tier === 'FAILURE' ? roll > chance && roll < 96 : roll >= 96; });
    if (okay) { cursor = n; break; }
  }
  expect(cursor).not.toBeNull(); s.random.cursor = cursor!; s.actionsRemaining = s.weeklyBudget = actions; assertValidSliceState(s);
  s = ba(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId }); s = ba(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ba(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, dose); expect(s.progression.sequence).toBe(2); cache.set(key, structuredClone(s)); return s;
}
function dormant(tier: PublicResolutionTier = 'SUCCESS'): SliceState { return act(begin(directed([tier]), 'bounded-dormancy'), { type: 'BOUNDED_DORMANCY', caseId: 'bounded-dormancy' }); }
function buffered(tier: PublicResolutionTier = 'SUCCESS'): SliceState { let s = act(directed([tier]), { type: 'BUY_ROOT_PAD' }); s = third(s); s = across(begin(s, 'finite-root-buffer'), 'finite-root-buffer'); return act(s, { type: 'ROOT_BUFFER', caseId: 'finite-root-buffer' }); }

describe('Barren Matriarch same original nursery and finite plant/self effects', () => {
  it('pins all 674 original commands and real people, samples, records and spent inventory', () => {
    const s = originalCoffinBearer(), p = s.coffinBearer.life;
    expect([p.clockSeconds, p.externalSeconds, p.playerTravelMetres]).toEqual([504, 364, 48]);
    expect(p.owner).toMatchObject({ id: 'CB3-ADA', name: '艾达·芬恩', age: 46, location: 'A', health: 100, mind: 100, independentMind: true });
    expect(p.recipient).toMatchObject({ id: 'CB3-LENA', name: '莉娜·肖', age: 39, location: 'B', health: 100, mind: 100, independentMind: true });
    expect(p.samples.map(x => [x.id, x.massGrams, x.alive, x.vitality, x.holder, x.location, x.care])).toEqual([['CB3-LIVE-1', 500, true, 47, 'RECIPIENT', 'B', 'RECIPIENT_CARE'], ['CB3-LIVE-2', 500, true, 49, 'OWNER', 'A', 'OWNER_CARE'], ['CB3-DRY-1', 100, false, 0, 'OWNER', 'A', 'OWNER_CARE']]);
    expect(p.box).toMatchObject({ id: 'CB3-CASE', quantity: 1, capacity: 1, maximumMassGrams: 1000, owner: 'PLAYER', holder: 'OWNER', location: 'A', sampleId: null }); expect(p.pads.map(x => x.status)).toEqual(['SPENT', 'SPENT', 'UNUSED']); expect(p.guard.segments.map(x => x.status)).toEqual(['SPENT', 'UNUSED', 'UNUSED']);
  }, 60_000);
  it('rejects extra fields, remote human/dead targets, free material, regeneration and teleport', () => {
    for (const c of [{ type: 'REFLECT', extra: true }, { type: 'BUY_ROOT_PAD', quantity: 3 }, { type: 'WALK', caseId: 'bounded-dormancy', to: 'OUTSIDE' }, { type: 'BOUNDED_DORMANCY', caseId: 'bounded-dormancy', target: 'LENA' }, { type: 'ROOT_BUFFER', caseId: 'finite-root-buffer', target: 'ABSENT_PERSON' }, { type: 'REVIVE' }, { type: 'RESTORE_PAD' }]) expect(validateBarrenMatriarchActivityCommand(c)).toBe(false);
    rejectBarrenMatriarch(promoted(), { type: 'BOUNDED_DORMANCY', caseId: 'bounded-dormancy' });
  });
  it('completes all three ordinary cases with real original travel and no mastery, hurt or free healing', () => {
    let s = promoted(); const old = structuredClone(s.coffinBearer.life), history = structuredClone(s.combatHistory), injuries = structuredClone(s.injuries), mastery = { ...s.progression.mastery }, resources = [s.health, s.mind, s.spirituality, s.cash];
    for (const id of BARREN_MATRIARCH_CASE_IDS) s = ordinary(s, id); s = act(s, { type: 'REFLECT' });
    expect(barrenMatriarchLifeClosed(s)).toBe(true); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery); expect(s.barrenMatriarch.life.source!.snapshot).toEqual(old); expect(s.coffinBearer.life.cases).toEqual(old.cases); expect(s.coffinBearer.life.guard).toEqual(old.guard); expect(s.coffinBearer.life.kit).toEqual(old.kit); expect(s.coffinBearer.life.pads).toEqual(old.pads); expect(s.coffinBearer.life.paper.records.slice(0, 3)).toEqual(old.paper.records); expect(s.coffinBearer.life.paper.records).toHaveLength(6);
    expect(s.coffinBearer.life.playerTravelMetres).toBe(old.playerTravelMetres + 56); expect(s.coffinBearer.life.samples.map(x => x.vitality)).toEqual([45, 47, 0]); expect(s.coffinBearer.life.samples.map(x => x.alive)).toEqual([true, true, false]); expect([s.health, s.mind, s.spirituality, s.cash]).toEqual(resources); expect(s.injuries).toEqual(injuries); expect(s.combatHistory).toEqual(history); expect(validateBarrenMatriarchSourceCoffinBearerLife(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('buys precisely one new plant-fibre pad for30p1AP without changing old pads or guard', () => {
    const before = promoted(), s = act(before, { type: 'BUY_ROOT_PAD' }), e = s.barrenMatriarch.life.journal[0]!;
    expect([before.cash - s.cash, before.actionsRemaining - s.actionsRemaining]).toEqual([30, 1]); expect(s.barrenMatriarch.life.rootPad).toMatchObject({ id: 'BM2-ROOT-PAD', sourceId: 'BM2-ROOT-FIBRE-STOCK', material: 'PLANT_FIBRE', quantity: 1, owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 65, acquiredWeek: s.week }); expect(e.padBefore.owner).toBe('SUPPLIER'); expect(e.padAfter.owner).toBe('PLAYER'); expect(s.coffinBearer.life.pads).toEqual(before.coffinBearer.life.pads); expect(s.coffinBearer.life.guard).toEqual(before.coffinBearer.life.guard); expect(replayBarrenMatriarchLifeRootPad(s)).toEqual(s.barrenMatriarch.life.rootPad); rejectBarrenMatriarch(s, { type: 'BUY_ROOT_PAD' });
  });
  it('requires fresh owner and current custodian consent and real approach, preserving refusal ordinary route', () => {
    let s = act(promoted(), { type: 'OBSERVE', caseId: 'bounded-dormancy' }); s = act(s, { type: 'PREPARE', caseId: 'bounded-dormancy', method: 'ABILITY' }); expect(hasBarrenMatriarchLifeLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' }); for (const type of ['CHECK_ORIGINALS', 'TAKE_KIT', 'CHECK_SAMPLE', 'CONSENT_SAMPLE', 'BOUNDED_DORMANCY'] as const) rejectBarrenMatriarch(s, { type, caseId: 'bounded-dormancy' });
    s = begin(promoted(), 'bounded-dormancy', 'ABILITY', 'DECLINE_PERMISSION'); rejectBarrenMatriarch(s, { type: 'BOUNDED_DORMANCY', caseId: 'bounded-dormancy' }); s = finishAcross(across(s, 'bounded-dormancy'), 'bounded-dormancy'); expect(attempt(s, 'bounded-dormancy').result).toBe('ORDINARY'); expect(s.progression.mastery[DORMANCY]).toBe(0);
  });
  for (const tier of ['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const) it(`${tier} dormancy is a deterministic paid living-plant check, never healing`, () => {
    let s = dormant(tier); const a = attempt(s, 'bounded-dormancy'), e = s.barrenMatriarch.life.journal.at(-1)!; expect(a.dormancyTier).toBe(tier); expect(e.source).toMatchObject({ abilityId: DORMANCY, coreStat: 'knowledge', difficulty: 20, target: 'LIVING_PLANT', maximumSeconds: 60, currentConsent: 'GRANTED', sample: { id: 'CB3-LIVE-1', alive: true, vitality: 47, holder: 'CASE', location: 'B', care: 'EXPOSED' } }); expect(e.paid).toMatchObject({ actions: 1, spirituality: 5, mind: tier.includes('FAILURE') ? 4 : 2 }); expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(s.coffinBearer.life.samples[0]!.vitality).toBe(47); expect(s.progression.mastery[DORMANCY]).toBe(0);
    s = finishAcross(across(s, 'bounded-dormancy'), 'bounded-dormancy'); expect(attempt(s, 'bounded-dormancy').protectedTravelSeconds).toBe(tier.includes('FAILURE') ? 0 : 8); expect(s.coffinBearer.life.samples[0]!.vitality).toBe(tier.includes('FAILURE') ? 45 : 46); expect(s.progression.mastery[DORMANCY]).toBe(tier.includes('FAILURE') ? 0 : 8); expect(s.coffinBearer.life.samples[2]!.vitality).toBe(0);
  });
  it('expiry is actual bounded waiting; no protected travel means no mastery and awakening adds nothing', () => {
    let s = dormant(); const before = s.coffinBearer.life.clockSeconds; s = act(s, { type: 'WAIT_EFFECT', caseId: 'bounded-dormancy' }); expect(s.coffinBearer.life.clockSeconds).toBe(before + 60); expect(attempt(s, 'bounded-dormancy').effectExpired).toBe(true); expect(s.coffinBearer.life.samples[0]!.vitality).toBe(44); expect(s.barrenMatriarch.life.operation.dormancy).toBeNull(); rejectBarrenMatriarch(s, { type: 'WAIT_EFFECT', caseId: 'bounded-dormancy' }); s = finishAcross(across(s, 'bounded-dormancy'), 'bounded-dormancy'); expect(s.progression.mastery[DORMANCY]).toBe(0); expect(s.coffinBearer.life.samples[0]!.vitality).toBeLessThan(44);
  });
  it('stop before actual travel cannot award mastery, refund resources or revive a source', () => {
    let s = dormant(); const resources = [s.cash, s.mind, s.spirituality], value = s.coffinBearer.life.samples[0]!.vitality; s = act(s, { type: 'STOP', caseId: 'bounded-dormancy' }); expect([s.cash, s.mind, s.spirituality]).toEqual(resources); expect(s.coffinBearer.life.samples[0]!.vitality).toBeLessThanOrEqual(value); rejectBarrenMatriarch(s, { type: 'BOUNDED_DORMANCY', caseId: 'bounded-dormancy' }); s = finishAcross(across(s, 'bounded-dormancy'), 'bounded-dormancy'); expect(s.progression.mastery[DORMANCY]).toBe(0);
  });
  it('second-case withdrawal preserves costs and stops new use; only physical return closes it', () => {
    let s = ordinary(directed(['SUCCESS']), 'bounded-dormancy'); s = act(begin(s, 'withdrawn-transfer'), { type: 'BOUNDED_DORMANCY', caseId: 'withdrawn-transfer' }); const resources = [s.cash, s.mind, s.spirituality]; s = across(s, 'withdrawn-transfer'); expect(attempt(s, 'withdrawn-transfer').permissionWithdrawn).toBe(true); expect(s.barrenMatriarch.life.operation.dormancy).toBeNull(); expect([s.cash, s.mind, s.spirituality]).toEqual(resources); for (const type of ['BOUNDED_DORMANCY', 'RETURN_SAMPLE', 'RETURN_KIT', 'LEAVE'] as const) rejectBarrenMatriarch(s, { type, caseId: 'withdrawn-transfer' }); s = finishAcross(s, 'withdrawn-transfer'); expect(s.progression.mastery[DORMANCY]).toBe(0); expect(s.coffinBearer.life.samples[1]).toMatchObject({ holder: 'OWNER', location: 'A', care: 'OWNER_CARE' });
  });
  it('the original dead0 sample rejects dormancy before any charge or random draw', () => {
    let s = begin(third(promoted()), 'finite-root-buffer'); const before = structuredClone(s); rejectBarrenMatriarch(s, { type: 'BOUNDED_DORMANCY', caseId: 'finite-root-buffer' }); expect(s).toEqual(before); expect(attempt(s, 'finite-root-buffer')).toMatchObject({ checkedAlive: false, checkedVitality: 0 }); s = finishAcross(across(s, 'finite-root-buffer'), 'finite-root-buffer'); expect(s.coffinBearer.life.samples[2]).toMatchObject({ id: 'CB3-DRY-1', alive: false, vitality: 0, holder: 'OWNER', location: 'A' });
  });
  for (const tier of ['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const) it(`${tier} root-buffer applies only to a real own impact and wears the unique paid pad`, () => {
    let s = buffered(tier); const before = s.health, e = s.barrenMatriarch.life.journal.at(-1)!; expect(e.source).toMatchObject({ abilityId: BUFFER, target: 'PLAYER', maximumSeconds: 30, coreStat: 'knowledge', difficulty: 20, rootPad: { id: 'BM2-ROOT-PAD', integrity: 65 }, sample: { id: 'CB3-DRY-1', alive: false, vitality: 0 } }); expect(e.paid).toMatchObject({ actions: 1, spirituality: 6, mind: tier.includes('FAILURE') ? 4 : 2 }); expect(s.progression.mastery[BUFFER]).toBe(0); s = act(s, { type: 'APPLY_IMPACT', caseId: 'finite-root-buffer' }); expect(before - s.health).toBe(tier.includes('FAILURE') ? 5 : 2); expect(s.barrenMatriarch.life.rootPad.integrity).toBe(50); expect(attempt(s, 'finite-root-buffer').impact).toMatchObject({ actor: 'PLAYER', target: 'PLAYER', objectId: 'CB3-DRY-1', massGrams: 100, padWear: 15, bufferApplied: !tier.includes('FAILURE') }); rejectBarrenMatriarch(s, { type: 'APPLY_IMPACT', caseId: 'finite-root-buffer' }); s = finishAcross(s, 'finite-root-buffer'); expect(s.progression.mastery[BUFFER]).toBe(tier.includes('FAILURE') ? 0 : 8); expect(s.coffinBearer.life.owner.health).toBe(100); expect(s.coffinBearer.life.recipient.health).toBe(100);
  });
  it('ordinary support after a paid successful buffer prevents damage and gives no fake mastery', () => {
    let s = buffered(); const health = s.health; s = act(s, { type: 'ORDINARY_SUPPORT', caseId: 'finite-root-buffer' }); expect(s.health).toBe(health); expect(s.barrenMatriarch.life.rootPad.integrity).toBe(65); expect(s.barrenMatriarch.life.operation.buffer).toBeNull(); s = finishAcross(s, 'finite-root-buffer'); expect(s.progression.mastery[BUFFER]).toBe(0);
  });
  it('buffer expires after exactly30 actual seconds and cannot protect a later own hit', () => {
    let s = buffered(); const time = s.coffinBearer.life.clockSeconds, health = s.health; s = act(s, { type: 'WAIT_EFFECT', caseId: 'finite-root-buffer' }); expect(s.coffinBearer.life.clockSeconds).toBe(time + 30); s = act(s, { type: 'APPLY_IMPACT', caseId: 'finite-root-buffer' }); expect(s.health).toBe(health - 5); expect(s.barrenMatriarch.life.rootPad.integrity).toBe(50); s = finishAcross(s, 'finite-root-buffer'); expect(s.progression.mastery[BUFFER]).toBe(0);
  });
  it('replays physical truth and rejects source/current/journal/resource/random/consent tampering', () => {
    const source = dormant(); expect(replayBarrenMatriarchLifeRoot(source)).toEqual(source.coffinBearer.life);
    const edits: ((s: SliceState) => void)[] = [s => { s.coffinBearer.life.samples[0]!.vitality++; }, s => { s.coffinBearer.life.samples[2]!.alive = true; }, s => { s.coffinBearer.life.box.sampleId = null; }, s => { s.coffinBearer.life.owner.health = 99 as 100; }, s => { s.coffinBearer.life.clockSeconds++; }, s => { s.coffinBearer.life.playerTravelMetres += 4; }, s => { s.barrenMatriarch.life.source!.snapshot.samples[0]!.vitality++; }, s => { s.barrenMatriarch.life.source!.snapshot.cases['fresh-transfer'].attempts[0]!.vitalityLost--; }, s => { s.barrenMatriarch.life.journal.at(-1)!.clockAfter++; }, s => { s.barrenMatriarch.life.journal.at(-1)!.source!.target = 'PLAYER'; }, s => { s.barrenMatriarch.life.journal.at(-1)!.source!.sample.vitality++; }, s => { s.barrenMatriarch.life.journal.at(-1)!.paid.spirituality = 0; }, s => { s.barrenMatriarch.life.journal.at(-1)!.randomAfter!++; }, s => { s.barrenMatriarch.life.operation.dormancy!.expiresAt++; }, s => { attempt(s, 'bounded-dormancy').consent = 'WITHDRAWN'; }, s => { s.actionsRemaining++; }, s => { s.spirituality++; }, s => { s.cash++; }, s => { s.random.cursor++; }, s => { s.progression.mastery[DORMANCY] = 8; }];
    for (const edit of edits) { const s = structuredClone(source); edit(s); expect(validateBarrenMatriarchLifeState(s), edit.toString()).toBe(false); }
  });
  it('zero AP preserves finite WAIT and all real cleanup without refunding or skipping travel', () => {
    let s = act(begin(directed(['SUCCESS'], 8), 'bounded-dormancy'), { type: 'BOUNDED_DORMANCY', caseId: 'bounded-dormancy' }); expect(s.actionsRemaining).toBe(0); const resources = [s.health, s.mind, s.spirituality, s.cash]; s = act(s, { type: 'WAIT_EFFECT', caseId: 'bounded-dormancy' }); expect(attempt(s, 'bounded-dormancy').waitedSeconds).toBe(60); s = across(s, 'bounded-dormancy');
    for (const c of [{ type: 'WALK', caseId: 'bounded-dormancy', to: 'B' }, { type: 'RETURN_SAMPLE', caseId: 'bounded-dormancy' }, { type: 'WALK', caseId: 'bounded-dormancy', to: 'A' }, { type: 'RETURN_KIT', caseId: 'bounded-dormancy' }, { type: 'WALK', caseId: 'bounded-dormancy', to: 'START' }, { type: 'INSPECT', caseId: 'bounded-dormancy' }] as BarrenMatriarchActivityCommand[]) { expect(blockBarrenMatriarchLife(s, c)).toBeNull(); s = act(s, c); }
    expect(s.actionsRemaining).toBe(0); expect([s.health, s.mind, s.spirituality, s.cash]).toEqual(resources); expect(s.coffinBearer.life.playerTravelMetres).toBe(72); expect(s.coffinBearer.life.samples[0]).toMatchObject({ holder: 'RECIPIENT', location: 'B', care: 'RECIPIENT_CARE' }); expect(s.coffinBearer.life.box).toMatchObject({ holder: 'OWNER', location: 'A', sampleId: null }); expect(blockBarrenMatriarchLife(s, { type: 'LEAVE', caseId: 'bounded-dormancy' })).toBeNull();
  });
  it('public projection exposes finite current observations without source snapshots, journals or internal labels', () => {
    const s = dormant(), view = projectBarrenMatriarchLife(s), text = JSON.stringify(view); expect(view.currentAttempt).toMatchObject({ checkedAlive: true, checkedVitality: 47, effectRemainingSeconds: 60 }); expect(view.site.samples).toHaveLength(3); expect(view.rootPad.integrity).toBe(65); expect(view.preferredActionId).not.toBeNull(); expect(text).not.toMatch(/"snapshot"|"journal"|"randomBefore"|"inheritedScene"|本作G|原创G|G ·|未核|未知来源/); expect(blockBarrenMatriarchLife(s, { type: 'WAIT_EFFECT', caseId: 'bounded-dormancy' })).toBeNull();
  });
});
