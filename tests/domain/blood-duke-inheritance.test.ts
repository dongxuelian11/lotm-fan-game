import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createBloodDukeState } from '../../src/domain/blood-duke/index.js';
import { BLOOD_DUKE_ABILITY_IDS } from '../../src/domain/blood-duke/types.js';
import { validateCriminalState } from '../../src/domain/criminal/index.js';
import { validateUnwingedState } from '../../src/domain/unwinged/index.js';
import { validateSerialKillerState } from '../../src/domain/serial-killer/index.js';
import { validateDemonState } from '../../src/domain/demon/index.js';
import { validateDesireApostleState } from '../../src/domain/desire-apostle/index.js';
import { validateDevilState } from '../../src/domain/devil/index.js';
import { validateBlathererState } from '../../src/domain/blatherer/index.js';
import { validateBlathererLife, validateBlathererLifeOriginal } from '../../src/domain/blatherer/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { abyssLegacyKeys, blathererNaturalPath, originalBlathererPrefix, originalBlathererDead, promoted, bd, rejectIntent, rejectBloodDuke } from './blood-duke-directed-helper.js';

const validators = [validateCriminalState, validateUnwingedState, validateSerialKillerState, validateDemonState, validateDesireApostleState, validateDevilState, validateBlathererState];
const legacyMastery = (s: SliceState) => Object.fromEntries(Object.entries(s.progression.mastery).filter(([id]) => !BLOOD_DUKE_ABILITY_IDS.includes(id as typeof BLOOD_DUKE_ABILITY_IDS[number])));

describe('Blood Duke inherited original history and immutable old death', () => {
  it('uses the exact first583 public commands before optional old TALK, with its actual alive resources', () => {
    const s = originalBlathererPrefix();
    expect(s).toMatchObject({ revision: 584, week: 154, status: 'ACTIVE', health: 100, mind: 100, spirituality: 120, cash: 500, actionsRemaining: 3,
      progression: { pathwayId: 'abyss', sequence: 3, acting: 100 }, random: { seed: 'criminal-natural-v054', cursor: 106 }, injuryRisk: 0 });
    expect(s.injuries).toEqual([]); expect(s.blatherer.promotionWeek).toBe(146); expect(s.blatherer.encounter.status).toBe('AVAILABLE');
    expect(s.blatherer.life).toMatchObject({ playerLocation: 'START', activeCase: null, reflected: true, volunteer: { id: 'BL3-NORA', location: 'A' }, card: { id: 'BL3-CARD', location: 'NORA' } });
    expect(Object.keys(s.progression.mastery)).toHaveLength(14); expect(s.bloodDuke).toEqual(createBloodDukeState()); assertValidSliceState(s);
  }, 30_000);

  it('migrates the actual592-command old DEAD ending without reviving, rewriting roots or resetting RNG', () => {
    const old = readObjectEntry<SliceState>(blathererNaturalPath, 'final'), bytes = JSON.stringify(old), s = originalBlathererDead();
    expect(old.status).toBe('DEAD'); expect(s.status).toBe('DEAD'); expect(s.health).toBe(0); expect(s.revision).toBe(593);
    for (const key of abyssLegacyKeys) expect(s[key]).toEqual(old[key]);
    for (const key of ['week', 'date', 'random', 'progression', 'combatHistory', 'injuries', 'injuryRisk', 'cash', 'actionsRemaining', 'spirituality', 'mind'] as const) expect(s[key]).toEqual(old[key]);
    expect(s.blatherer.encounter).toMatchObject({ status: 'LOST', terminal: { outcome: 'PLAYER_DEAD' } });
    expect(s.bloodDuke).toEqual(createBloodDukeState()); assertValidSliceState(s); expect(migrateSliceState(s)).toEqual(s); expect(JSON.stringify(old)).toBe(bytes);
    rejectBloodDuke(s, { type: 'LEARN_GUIDANCE' }); rejectIntent(s, { type: 'BLATHERER', command: { type: 'ENCOUNTER_TALK' } });
  });

  it('directed UNIT promotion preserves all14 exact mastery values and seven roots, adding only two genuine zero IDs', () => {
    const source = originalBlathererPrefix(), s = promoted();
    expect(Object.keys(source.progression.mastery)).toHaveLength(14); expect(legacyMastery(s)).toEqual(source.progression.mastery);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(source.progression.mastery, id))).toEqual([...BLOOD_DUKE_ABILITY_IDS]);
    for (const id of BLOOD_DUKE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.progression.mastery['abyss.s7.demonic-lore']).toBe(0); expect(s.progression.mastery['abyss.s7.ritual-practice']).toBe(0);
    for (const key of abyssLegacyKeys) expect(s[key]).toEqual(source[key]);
    expect(s.unwinged.conscienceLost).toBe(true); expect(s.devil.life.invitation.declined).toBe(true);
    expect(s.devil.encounter).toMatchObject({ targetId: 'DV4-ORRICK-FANE', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemySpirituality: 32 });
    expect(s.blatherer.encounter).toEqual(source.blatherer.encounter); expect(validators.map(validate => validate(s))).toEqual(validators.map(() => true)); assertValidSliceState(s);
  });

  it('directed UNIT S2 projections use stored100 old acting while new acting remains0', () => {
    const s = promoted(), view = projectSliceState(s);
    expect(s.progression.acting).toBe(0); expect(s.bloodDuke.blathererActingAtPromotion).toBe(100);
    for (const key of abyssLegacyKeys) expect(view[key].acting, key).toBe(100);
    expect(view.blatherer.actions).toEqual([]); expect(view.blatherer.encounter.actions).toEqual([]);
  });

  it('directed UNIT S2 cannot reopen any old case, acquire old bottles, or restart the untouched old opponent', () => {
    const s = promoted();
    const intents: SliceIntent[] = [
      { type: 'CRIMINAL', command: { type: 'REFLECT' } }, { type: 'UNWINGED', command: { type: 'REFLECT' } },
      { type: 'SERIAL_KILLER', command: { type: 'REFLECT' } }, { type: 'DEMON', command: { type: 'REFLECT' } },
      { type: 'DESIRE_APOSTLE', command: { type: 'REFLECT' } }, { type: 'DEVIL', command: { type: 'REFLECT' } },
      { type: 'BLATHERER', command: { type: 'REFLECT' } }, { type: 'BLATHERER', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'BLATHERER', command: { type: 'ENCOUNTER_TALK' } }, { type: 'BLATHERER', command: { type: 'ENCOUNTER_FIGHT' } },
    ];
    for (const intent of intents) rejectIntent(s, intent);
  });

  it('directed UNIT S2 retains the old paid COMPOSE cost and changes only the actual inherited strain', () => {
    const s = promoted(); expect(s.demon.strain).toBeGreaterThan(0);
    const next = applySliceIntent(s, { type: 'DEMON', command: { type: 'COMPOSE' } });
    expect(next.demon).toEqual({ ...s.demon, strain: s.demon.strain - 1 }); expect(next.actionsRemaining).toBe(s.actionsRemaining - 1);
    for (const key of ['health', 'mind', 'spirituality', 'progression', 'injuries', 'injuryRisk'] as const) expect(next[key]).toEqual(s[key]);
    for (const key of abyssLegacyKeys.filter(key => key !== 'demon')) expect(next[key]).toEqual(s[key]); assertValidSliceState(next);
  });

  it('rejects an unlogged Nora move in both old raw history and directed UNIT S2 continuation', () => {
    for (const source of [originalBlathererPrefix(), promoted()]) {
      const s = structuredClone(source); s.blatherer.life.volunteer.location = 'OUTSIDE'; s.blatherer.life.card.travelMetres += 8; s.blatherer.life.clockSeconds += 8;
      expect(validateBlathererLifeOriginal(s)).toBe(false); expect(validateBlathererLife(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
    }
  });

  it('directed UNIT continuation replays the same original room and preserves every old case while physically carrying its one card', () => {
    let s = promoted(); const original = structuredClone(s.blatherer.life), oldMastery = legacyMastery(s), caseId = 'door-restraint' as const;
    s = bd(s, { type: 'OBSERVE', caseId }); s = bd(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
    s = bd(s, { type: 'WALK', caseId, to: 'A' });
    const activeView = projectSliceState(s); expect(activeView.blatherer.insideCase).toBe(false); expect(activeView.blatherer.life.insideCase).toBe(false); expect(activeView.bloodDuke.life.insideCase).toBe(true);
    rejectIntent(s, { type: 'ACTION', action: 'WORK' });
    s = bd(s, { type: 'CONSENT_NORA', caseId }); s = bd(s, { type: 'TAKE_CARD', caseId });
    s = bd(s, { type: 'WALK', caseId, to: 'B' }); s = bd(s, { type: 'READ_NOTE', caseId }); s = bd(s, { type: 'WALK', caseId, to: 'A' });
    s = bd(s, { type: 'MANUAL_OPERATION', caseId }); s = bd(s, { type: 'RETURN_CARD', caseId }); s = bd(s, { type: 'WALK', caseId, to: 'START' });
    for (const type of ['INSPECT', 'CLOSE', 'REPORT'] as const) s = bd(s, { type, caseId });
    expect(s.bloodDuke.life.source?.snapshot).toEqual(original); expect(s.blatherer.life.cases).toEqual(original.cases);
    expect(s.blatherer.life.playerTravelMetres).toBe(original.playerTravelMetres + 16); expect(s.blatherer.life.card.travelMetres).toBe(original.card.travelMetres + 8);
    expect(s.blatherer.life.volunteer).toEqual(original.volunteer); expect(s.blatherer.life.guide).toEqual(original.guide); expect(legacyMastery(s)).toEqual(oldMastery);
    expect(validateBlathererLifeOriginal(s)).toBe(false); expect(validateBlathererLife(s)).toBe(true); assertValidSliceState(s);
    const forged = structuredClone(s), handoff = forged.bloodDuke.life.source!;
    handoff.snapshot.cases['conflicting-bell'].attempts[0]!.elapsedSeconds++;
    forged.bloodDuke.life.journal[0]!.inheritedScene = structuredClone(handoff);
    expect(validateBlathererLife(forged)).toBe(false); expect(() => assertValidSliceState(forged)).toThrow();
  });

  it('directed UNIT S2 rejects missing, extra, duplicate-stage, or silently boosted inherited mastery', () => {
    const source = promoted();
    for (const mutate of [
      (s: SliceState) => { delete s.progression.mastery['abyss.s7.demonic-lore']; },
      (s: SliceState) => { s.progression.mastery['abyss.s1.unsupported'] = 0; },
      (s: SliceState) => { s.progression.mastery['abyss.s7.demonic-lore'] = 1; },
      (s: SliceState) => { s.bloodDuke.blathererActingAtPromotion = 0; },
      (s: SliceState) => { s.blatherer.devilActingAtPromotion = 0; },
    ]) { const s = structuredClone(source); mutate(s); expect(() => assertValidSliceState(s)).toThrow(); }
  });
});
