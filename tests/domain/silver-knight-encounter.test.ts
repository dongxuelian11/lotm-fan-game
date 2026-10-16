import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createSilverKnightState } from '../../src/domain/silver-knight/index.js';
import { resolveSilverKnightCombatRound } from '../../src/domain/slice/silver-knight-combat.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { applySilverKnightEncounterCommand, blockSilverKnightEncounter, createSilverKnightEncounterState, currentSilverKnightHunt,
  projectSilverKnightEncounter, validateSilverKnightEncounter, validateSilverKnightEncounterCommand, settleSilverKnightEncounter,
  getSilverKnightHuntRemains, placeSilverKnightHuntRemains, consumeSilverKnightHuntRemains, hasSilverKnightDisputeOpponent,
  SILVER_KNIGHT_SPECIES, SILVER_KNIGHT_ALTAR_SLOTS, type SilverKnightSpeciesId } from '../../src/domain/silver-knight/encounter.js';

const ctx: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No unrelated check'); } };
/** Directed unit starting resources. Old six roots are read from genuine natural340, never relabelled as new natural evidence. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/demon-hunter-v01290/natural.json', 'utf8')).final);
  s.silverKnight = createSilverKnightState(); s.silverKnight.guidanceKnown = true; s.actionsRemaining = 80; s.cash = 20000;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null; return s;
}
const old = (s: SliceState) => structuredClone({ warrior: s.warrior, gladiator: s.gladiator, weaponmaster: s.weaponmaster, dawnPaladin: s.dawnPaladin, guardian: s.guardian, demonHunter: s.demonHunter });
function start(s: SliceState, speciesId: SilverKnightSpeciesId, prepare = false) {
  applySilverKnightEncounterCommand(s, { type: 'INVESTIGATE_HUNT', speciesId }, ctx);
  if (prepare) applySilverKnightEncounterCommand(s, { type: 'PREPARE_HUNT', speciesId }, ctx);
  applySilverKnightEncounterCommand(s, { type: 'HUNT_FIGHT', speciesId }, ctx);
}
function round(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed shared draw ${cursor}: ${n}`); return n;
  });
  try {
    const result = resolveSilverKnightCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); expect(spy).toHaveBeenCalledTimes(values.length);
    settleSilverKnightEncounter(s, result.outcome, ctx); if (result.outcome === 'PLAYER_DEAD') s.status = 'DEAD'; return result;
  } finally { spy.mockRestore(); }
}
function killAndCollect(s: SliceState, speciesId: SilverKnightSpeciesId) {
  start(s, speciesId); expect(round(s, 'ATTACK', 1, 1, 1, 96, 1, 100).outcome).toBe('ENEMY_DEAD');
  applySilverKnightEncounterCommand(s, { type: 'COLLECT_REMAINS', speciesId }, ctx);
}
afterEach(() => vi.restoreAllMocks());

describe('Finite six original pre-promotion hunts', () => {
  it('starts six unique unseen bodies, no carried remains, and preserves all six old roots', () => {
    const s = fixture(), before = old(s), e = createSilverKnightEncounterState();
    expect(e.hunts).toHaveLength(6); expect(new Set(e.hunts.map(b => b.id)).size).toBe(6); expect(new Set(e.hunts.map(b => b.locationId)).size).toBe(6);
    expect(e.hunts.every(b => b.status === 'UNSEEN' && b.enemyHealth === 100 && b.enemyMind === 100)).toBe(true);
    expect(e.remains).toEqual([]); expect(projectSilverKnightEncounter(s).hunts.every(h => h.instanceId === null && h.health === null && h.trait === null)).toBe(true);
    expect(old(s)).toEqual(before); expect(validateSilverKnightEncounter(s)).toBe(true);
  });
  it('requires actual1AP investigation, optional target-specific120 preparation and separate1AP approach', () => {
    const s = fixture(); s.actionsRemaining = 3;
    expect(blockSilverKnightEncounter(s, { type: 'HUNT_FIGHT', speciesId: 'ROCK_HUSK' })).not.toBeNull();
    applySilverKnightEncounterCommand(s, { type: 'INVESTIGATE_HUNT', speciesId: 'ROCK_HUSK' }, ctx); expect(s.actionsRemaining).toBe(2); expect(s.combat).toBeNull();
    const cash = s.cash; applySilverKnightEncounterCommand(s, { type: 'PREPARE_HUNT', speciesId: 'ROCK_HUSK' }, ctx);
    expect(s.cash).toBe(cash - 120); expect(s.actionsRemaining).toBe(1); expect(currentSilverKnightHunt(s, 'ROCK_HUSK').resources.coatings).toHaveLength(2);
    applySilverKnightEncounterCommand(s, { type: 'HUNT_FIGHT', speciesId: 'ROCK_HUSK' }, ctx);
    expect(s.actionsRemaining).toBe(0); expect(hasSilverKnightDisputeOpponent(s)).toBe(true); expect(validateSilverKnightEncounter(s)).toBe(true);
  });
  it('rejects target rewriting, arbitrary command fields, old cinder substitution and material collection without a kill', () => {
    expect(validateSilverKnightEncounterCommand({ type: 'HUNT_FIGHT', speciesId: 'ROCK_HUSK', free: true })).toBe(false);
    expect(validateSilverKnightEncounterCommand({ type: 'INVESTIGATE_HUNT', speciesId: 'DH4-CINDER-GUARD' })).toBe(false);
    const s = fixture(); expect(blockSilverKnightEncounter(s, { type: 'COLLECT_REMAINS', speciesId: 'ROCK_HUSK' })).not.toBeNull();
    start(s, 'ROCK_HUSK'); currentSilverKnightHunt(s, 'ROCK_HUSK').id = 'DH4-CINDER-GUARD';
    expect(hasSilverKnightDisputeOpponent(s)).toBe(false); expect(validateSilverKnightEncounter(s)).toBe(false);
  });
  it('a real shared death leaves the corpse at its original quarry, then a paid collection creates only one original remains', () => {
    const s = fixture(), before = old(s); start(s, 'ROCK_HUSK');
    const death = round(s, 'ATTACK', 1, 1, 1, 96, 1, 100); expect(death.outcome).toBe('ENEMY_DEAD');
    const b = currentSilverKnightHunt(s, 'ROCK_HUSK'); expect(b.status).toBe('DEAD'); expect(b.locationId).toBe('SK3-QUARRY-RIDGE'); expect(b.remainsId).toBeNull(); expect(getSilverKnightHuntRemains(s)).toEqual([]);
    const ap = s.actionsRemaining; applySilverKnightEncounterCommand(s, { type: 'COLLECT_REMAINS', speciesId: 'ROCK_HUSK' }, ctx);
    expect(s.actionsRemaining).toBe(ap - 1); expect(getSilverKnightHuntRemains(s)).toEqual([expect.objectContaining({ id: 'SK3-HUNT-ROCK_HUSK-1-REMAINS', instanceId: b.id, speciesId: 'ROCK_HUSK', killedBy: 'PLAYER', outcome: 'ENEMY_DEAD', status: 'OWNER_PLAYER', locationId: 'PLAYER', originLocationId: b.locationId })]);
    expect(() => applySilverKnightEncounterCommand(s, { type: 'COLLECT_REMAINS', speciesId: 'ROCK_HUSK' }, ctx)).toThrow();
    expect(old(s)).toEqual(before); expect(validateSilverKnightEncounter(s)).toBe(true);
  });
  it('ordinary retreat retains the same living enemy health, injuries, spirituality and spent resources on retry', () => {
    const s = fixture(); start(s, 'ROCK_HUSK', true);
    expect(round(s, 'ATTACK', 1, 1, 1, 1, 1, 1).outcome).toBe('CONTINUE'); // Actual10H enemy injury and paid6S enemy ram.
    expect(round(s, 'RETREAT', 1, 1, 96, 1).outcome).toBe('RETREATED'); // Even round enemy accident precedes real ground exit.
    const b = currentSilverKnightHunt(s, 'ROCK_HUSK'), saved = structuredClone({ health: b.enemyHealth, mind: b.enemyMind, injuries: b.enemyInjuries, resources: b.resources });
    expect(saved.health).toBe(90); expect(saved.resources.enemySpirituality).toBe(84); expect(validateSilverKnightEncounter(s)).toBe(true);
    applySilverKnightEncounterCommand(s, { type: 'HUNT_FIGHT', speciesId: 'ROCK_HUSK' }, ctx);
    expect(currentSilverKnightHunt(s, 'ROCK_HUSK').id).toBe('SK3-HUNT-ROCK_HUSK-1'); expect(s.combat?.enemyHealth).toBe(90);
    expect(b.enemyInjuries).toEqual(saved.injuries); expect(b.resources).toEqual(saved.resources); expect(b.attempts).toHaveLength(2); expect(validateSilverKnightEncounter(s)).toBe(true);
  });
  it('living surrender yields no corpse and the next real week can reveal a different original body', () => {
    const s = fixture(); start(s, 'MIST_ANTLER');
    expect(round(s, 'ATTACK', 1, 1, 1, 96, 1, 70).outcome).toBe('ENEMY_SURRENDERED');
    const b = currentSilverKnightHunt(s, 'MIST_ANTLER'), saved = structuredClone(b);
    expect(b.enemyHealth).toBe(70); expect(b.status).toBe('SURRENDERED'); expect(getSilverKnightHuntRemains(s)).toEqual([]);
    expect(blockSilverKnightEncounter(s, { type: 'COLLECT_REMAINS', speciesId: 'MIST_ANTLER' })).not.toBeNull();
    expect(blockSilverKnightEncounter(s, { type: 'HUNT_FIGHT', speciesId: 'MIST_ANTLER' })).not.toBeNull();
    expect(blockSilverKnightEncounter(s, { type: 'INVESTIGATE_HUNT', speciesId: 'MIST_ANTLER' })).not.toBeNull();
    s.week++; const ap = s.actionsRemaining; applySilverKnightEncounterCommand(s, { type: 'INVESTIGATE_HUNT', speciesId: 'MIST_ANTLER' }, ctx);
    expect(s.actionsRemaining).toBe(ap - 1); expect(currentSilverKnightHunt(s, 'MIST_ANTLER')).toMatchObject({ id: 'SK3-HUNT-MIST_ANTLER-2', locationId: 'SK3-QUARRY-MIST-SIGHTING-2', enemyHealth: 100, status: 'TRACKED' });
    expect(s.silverKnight.encounter.hunts.find(h => h.id === saved.id)).toEqual(saved); expect(validateSilverKnightEncounter(s)).toBe(true);
  });
  it('player death remains genuine and the original player corpse stays at that original location', () => {
    const s = fixture(), before = old(s); start(s, 'THORN_SHADOW');
    expect(round(s, 'ATTACK', 1, 1, 445, 1, 1000000, 100).outcome).toBe('PLAYER_DEAD');
    expect(s.health).toBe(0); expect(s.status).toBe('DEAD'); expect(s.silverKnight.encounter.scene).toMatchObject({ playerPosition: 'ORIGIN', locationId: 'SK3-QUARRY-ARCH' });
    expect(getSilverKnightHuntRemains(s)).toEqual([]); expect(old(s)).toEqual(before); expect(validateSilverKnightEncounter(s)).toBe(true);
  });
});

describe('Unique remains inventory and paid-failure replenishment continuity', () => {
  it('requires six distinct actual collected species and correct original slots; consumption is all-or-none', () => {
    const s = fixture(); for (const species of SILVER_KNIGHT_SPECIES) killAndCollect(s, species);
    const remains = getSilverKnightHuntRemains(s); expect(remains).toHaveLength(6); expect(new Set(remains.map(r => r.instanceId)).size).toBe(6);
    expect(placeSilverKnightHuntRemains(s, remains[0]!.id, 'SOUTH')).toBe(false); expect(consumeSilverKnightHuntRemains(s, remains.map(r => r.id))).toBe(false);
    for (const [i, r] of remains.entries()) expect(placeSilverKnightHuntRemains(s, r.id, SILVER_KNIGHT_ALTAR_SLOTS[i]!)).toBe(true);
    const before = structuredClone(s.silverKnight.encounter.remains); expect(consumeSilverKnightHuntRemains(s, Array(6).fill(remains[0]!.id))).toBe(false); expect(s.silverKnight.encounter.remains).toEqual(before);
    expect(consumeSilverKnightHuntRemains(s, remains.map(r => r.id))).toBe(true); expect(consumeSilverKnightHuntRemains(s, remains.map(r => r.id))).toBe(false);
    expect(getSilverKnightHuntRemains(s).every(r => r.status === 'CONSUMED' && r.locationId.startsWith('SK3-CHAPEL:ALTAR:') && r.consumedWeek === s.week)).toBe(true);
    expect(validateSilverKnightEncounter(s)).toBe(true);
  });
  it('consumed original remains never resurrect; new-week investigation creates distinct next body and site only', () => {
    const s = fixture(); for (const species of SILVER_KNIGHT_SPECIES) killAndCollect(s, species);
    const remains = getSilverKnightHuntRemains(s);
    for (const [i, r] of remains.entries()) placeSilverKnightHuntRemains(s, r.id, SILVER_KNIGHT_ALTAR_SLOTS[i]!);
    consumeSilverKnightHuntRemains(s, remains.map(r => r.id)); const original = structuredClone(currentSilverKnightHunt(s, 'FROST_SPINE'));
    expect(blockSilverKnightEncounter(s, { type: 'INVESTIGATE_HUNT', speciesId: 'FROST_SPINE' })).not.toBeNull();
    s.week++; expect(s.silverKnight.encounter.hunts).toHaveLength(6); // Advancing time never spawns a corpse or inventory.
    applySilverKnightEncounterCommand(s, { type: 'INVESTIGATE_HUNT', speciesId: 'FROST_SPINE' }, ctx);
    expect(currentSilverKnightHunt(s, 'FROST_SPINE')).toMatchObject({ id: 'SK3-HUNT-FROST_SPINE-2', locationId: 'SK3-QUARRY-CISTERN-SIGHTING-2', enemyHealth: 100, enemyMind: 100, remainsId: null, resources: { enemySpirituality: 80, coatings: [] } });
    expect(s.silverKnight.encounter.hunts.find(h => h.id === original.id)).toEqual(original); expect(getSilverKnightHuntRemains(s)).toHaveLength(6); expect(validateSilverKnightEncounter(s)).toBe(true);
  });
  it('read views cannot mutate the sole source inventory and fabricated death provenance is rejected', () => {
    const s = fixture(); killAndCollect(s, 'ROCK_HUSK'); const read = getSilverKnightHuntRemains(s); read[0]!.locationId = 'FAKE';
    expect(s.silverKnight.encounter.remains[0]?.locationId).toBe('PLAYER'); s.silverKnight.encounter.remains[0]!.instanceId = 'DH4-CINDER-GUARD';
    expect(validateSilverKnightEncounter(s)).toBe(false);
  });
});

describe('Independent post-promotion original Lorcan', () => {
  it('requires realS3 and talk, uses original48-year-old opponent and preserves finite resources on ordinary exit', () => {
    const s = fixture(); expect(blockSilverKnightEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.progression.sequence = 3; s.silverKnight.promotionWeek = s.week;
    applySilverKnightEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, ctx); s.actionsRemaining = 0; s.mind = 0;
    applySilverKnightEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, ctx);
    expect(projectSilverKnightEncounter(s).enemy).toMatchObject({ id: 'SK3-LORCAN', name: '洛肯·里德', age: 48, health: 100, spirituality: 120, status: 'LEFT' });
    expect(projectSilverKnightEncounter(s).facts.join('')).toContain('SK3-LORCAN-ROD'); expect(validateSilverKnightEncounter(s)).toBe(true);
  });
  it('known original source cannot be replaced by a resurrected old cinder guard after promotion', () => {
    const s = fixture(), before = old(s); s.progression.sequence = 3; s.silverKnight.promotionWeek = s.week;
    applySilverKnightEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, ctx); applySilverKnightEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx);
    expect(s.combat?.encounterId).toBe('SILVER_KNIGHT_DISPUTE'); expect(hasSilverKnightDisputeOpponent(s)).toBe(true); expect(old(s)).toEqual(before);
    expect(round(s, 'ATTACK', 1, 1, 1, 96, 1, 70).outcome).toBe('ENEMY_SURRENDERED'); expect(getSilverKnightHuntRemains(s)).toEqual([]);
    expect(projectSilverKnightEncounter(s).enemy?.status).toBe('SURRENDERED'); expect(validateSilverKnightEncounter(s)).toBe(true);
  });
});
