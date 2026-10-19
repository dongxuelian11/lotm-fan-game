import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createPrinceOfAbolitionState } from '../../src/domain/prince-of-abolition/index.js';
import { PRINCE_OF_ABOLITION_ABILITY_IDS, PRINCE_OF_ABOLITION_SOURCE_KEYS } from '../../src/domain/prince-of-abolition/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { PRINCE_OF_ABOLITION_CAPTURE_EVIDENCE as evidence } from './prince-of-abolition-capture-evidence.js';
import { PRINCE_OF_ABOLITION_SOURCE as SOURCE, PRINCE_OF_ABOLITION_PRIOR as PRIOR, PRINCE_OF_ABOLITION_SEED as SEED,
  PRINCE_OF_ABOLITION_PREFIX_COUNT as PREFIX, PRINCE_OF_ABOLITION_INHERITED_COUNT as INHERITED,
  sourceEntry, captureFileHash, captureValueHash, insertionOrderHash, currentCapture, originalLivingPrefix, assertOriginalContinuity, sameCaptureValue as same } from './prince-of-abolition-capture-helper.js';

// These are established historical observations. They do not assert that the
// unrun stage205 continuation succeeds, reaches any case or survives an encounter.
describe('Prince of Abolition authentic743 source and separately preserved558 death', () => {
  it('pins untouched raw180/743 and raw157/558 files with exactly555 inherited commands', async () => {
    expect(await captureFileHash(SOURCE)).toBe(evidence.sourceSha256); expect(await captureFileHash(PRIOR)).toBe(evidence.priorSha256);
    const commands = sourceEntry<SliceIntent[]>('commands'), prior = readObjectEntry<SliceIntent[]>(PRIOR, 'commands');
    expect(commands).toHaveLength(PREFIX); expect(PREFIX).toBe(743); expect(prior).toHaveLength(558); expect(INHERITED).toBe(555);
    expect(sourceEntry('prefixCount')).toBe(INHERITED); expect(sourceEntry('prefixVerified')).toBe(true); expect(sourceEntry('seed')).toBe(SEED);
    same(commands.slice(0, INHERITED), prior.slice(0, INHERITED)); expect(insertionOrderHash(commands)).toBe(evidence.prefixSha256);
    expect(insertionOrderHash(commands.slice(0, INHERITED))).toBe(evidence.inheritedSha256);
    expect(commands[INHERITED]).not.toEqual(prior[INHERITED]);
    expect(sourceEntry('provenance')).toMatchObject({ kind: 'SAME_SEED_ORIGINAL_LIVING_PREFIX_PUBLIC_CONTINUATION', newRandomChanges: false, source: PRIOR, sourceSha256: evidence.priorSha256 });
    for (const key of ['initial', 'final']) {
      const raw = sourceEntry<SliceState>(key); expect([raw.schemaVersion, raw.contentVersion]).toEqual([180, 'entropy-duke-v180']);
    }
    const dead = readObjectEntry<SliceState>(PRIOR, 'final');
    expect(dead).toMatchObject({ schemaVersion: 157, contentVersion: 'frenzy-mage-v157', status: 'DEAD', health: 0, revision: 559, week: 141,
      random: { seed: SEED, cursor: 202 }, ending: { kind: 'DEATH' } });
  }, 120_000);

  it('adds only genuinely missing CURRENT roots and preserves every raw field without relabelling source bytes', () => {
    for (const key of ['initial', 'prefixFinal', 'final']) {
      const raw = sourceEntry<Record<string, unknown>>(key), beforeHash = captureValueHash(raw), s = currentCapture(raw);
      const current = s as unknown as Record<string, unknown>;
      const defaults = createSliceRun(s.runId, sourceEntry<Parameters<typeof createSliceRun>[1]>('creation'), SEED) as unknown as Record<string, unknown>;
      const added = Object.keys(defaults).filter(name => !Object.hasOwn(raw, name));
      expect(added).toContain('princeOfAbolition'); expect(Object.keys(current).filter(name => !Object.hasOwn(raw, name)).sort()).toEqual([...added].sort());
      for (const name of Object.keys(raw)) if (name !== 'schemaVersion' && name !== 'contentVersion') same(current[name], raw[name]);
      for (const name of added) same(current[name], defaults[name]);
      expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]); same(s.princeOfAbolition, createPrinceOfAbolitionState());
      same(migrateSliceState(s), s); expect(captureValueHash(raw)).toBe(beforeHash); assertValidSliceState(s);
    }
  }, 120_000);

  it('retains real14 mastery values, zero body injury, clock449 originals, spent gifts and old opponents', () => {
    const s = originalLivingPrefix();
    expect(s).toMatchObject({ runId: 'lawyer-rebuild-natural', status: 'ACTIVE', revision: 744, week: 185,
      health: 100, mind: 95, spirituality: 94, cash: 800, actionsRemaining: 3, injuryRisk: 0,
      date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 1, day: 6 }, random: { seed: SEED, cursor: 228 } });
    expect(s.injuries).toEqual([]); expect(s.seer.pollution).toBe(0); expect(s.progression.sequence).toBe(2); expect(s.progression.acting).toBe(100);
    expect(s.progression.promotionWeek).toBe(6); expect(s.entropyDuke.promotionWeek).toBe(175);
    expect(s.character.coreStats).toEqual({ physique: 29, perception: 23, will: 25, knowledge: 23 });
    expect(Object.keys(s.progression.mastery)).toHaveLength(14);
    expect(Object.entries(s.progression.mastery).filter(([, v]) => v === 0).map(([id]) => id).sort()).toEqual([
      'black-emperor.s3.ordered-deviation', 'black-emperor.s5.disorder', 'black-emperor.s7.bribery-weakening',
    ]);
    for (const id of ['black-emperor.s2.action-amplification', 'black-emperor.s2.effect-prolongation']) expect(s.progression.mastery[id]).toBe(8);
    for (const id of PRINCE_OF_ABOLITION_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    expect(s.frenzyMage.life).toMatchObject({ playerLocation: 'START', clockSeconds: 449, playerTravelMetres: 120, guideTravelMetres: 52,
      guide: { name: '米蕾·沃德', location: 'OUTSIDE' }, volunteer: { age: 42, location: 'OUTSIDE', mind: 100 } });
    for (const object of [s.frenzyMage.life.parcel, s.frenzyMage.life.ball, s.frenzyMage.life.paper]) expect(object).toMatchObject({ owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1 });
    expect(s.frenzyMage.life.parcel.massGrams).toBe(400); expect(s.frenzyMage.life.ball.massGrams).toBe(80); expect(s.frenzyMage.life.paper.text).toBe('从A到B');
    expect(s.frenzyMage.life.pads.map(p => [p.id, p.location, p.people])).toEqual([['FM3-PAD-B', 'B', 0], ['FM3-PAD-C', 'C', 0]]);
    expect(s.entropyDuke.life.source!.snapshot.clockSeconds).toBe(85); expect(s.entropyDuke.encounter.startRoot!.clockSeconds).toBe(249);
    expect(s.entropyDuke.life.operation).toEqual({ door: 'OPEN', inputActive: false, flight: null });
    expect(s.entropyDuke.encounter).toMatchObject({ targetId: 'ED2-OSWIN', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 85,
      enemyPosition: 'BETWEEN_A_AND_B', weaponLocation: 'HAND', enemyRisk: 1 });
    expect(s.entropyDuke.encounter.enemyInjuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['LIGHT', 741, null], ['HEAVY', 743, null]]);
    expect(s.fallenEarl.encounter).toMatchObject({ enemyStatus: 'DEAD', enemyHealth: 0 });
    expect(s.briber.gifts).toHaveLength(15); expect(s.briber.gifts.filter(g => g.location === 'GIVEN')).toHaveLength(12);
    expect(s.briber.gifts.filter(g => g.location === 'PLAYER').map(g => g.id)).toEqual(['BR7-GIFT-13', 'BR7-GIFT-14', 'BR7-GIFT-15']);
    expect(s.entropyDuke.bottles.map(b => [b.status, b.outcome])).toEqual([['CONSUMED', 'FAILURE'], ['CONSUMED', 'FAILURE'], ['CONSUMED', 'FAILURE'], ['CONSUMED', 'GREAT_SUCCESS'], ['SUPPLIER', null], ['SUPPLIER', null]]);
    assertOriginalContinuity(s, s);
  }, 120_000);

  it('replays the original three-command death tail from the authentic living555 branch and never resurrects it', () => {
    const source = sourceEntry<SliceState>('prefixFinal'), originalHash = captureValueHash(source), commands = readObjectEntry<SliceIntent[]>(PRIOR, 'commands');
    expect(source).toMatchObject({ status: 'ACTIVE', revision: 556, random: { seed: SEED, cursor: 189 } });
    let branch = currentCapture(source);
    for (const intent of commands.slice(INHERITED)) { branch = applySliceIntent(branch, intent); assertValidSliceState(branch); }
    same(branch, currentCapture(readObjectEntry(PRIOR, 'final')));
    expect(branch).toMatchObject({ status: 'DEAD', health: 0, revision: 559, random: { seed: SEED, cursor: 202 } });
    expect(projectSliceState(branch).canAct).toBe(false);
    const terminalHash = captureValueHash(branch);
    for (const intent of [{ type: 'CONTINUE_LIFE' }, { type: 'ACTION', action: 'REST' },
      { type: 'PRINCE_OF_ABOLITION', command: { type: 'LEARN_GUIDANCE' } }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }] as SliceIntent[]) {
      expect(() => applySliceIntent(branch, intent)).toThrow(); expect(captureValueHash(branch)).toBe(terminalHash);
    }
    expect(captureValueHash(source)).toBe(originalHash);
  }, 120_000);

  it('rejects future formats and missing CURRENT historical roots without mutating the genuine source', () => {
    const s = originalLivingPrefix(), hash = captureValueHash(s);
    for (const key of [...PRINCE_OF_ABOLITION_SOURCE_KEYS, 'princeOfAbolition'] as const) {
      const invalid = structuredClone(s) as Partial<SliceState>; delete invalid[key];
      expect(() => migrateSliceState(invalid), key).toThrow();
    }
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => migrateSliceState({ ...s, contentVersion: 'unknown-future-prince-of-abolition' })).toThrow();
    expect(captureValueHash(s)).toBe(hash);
  }, 120_000);
});
