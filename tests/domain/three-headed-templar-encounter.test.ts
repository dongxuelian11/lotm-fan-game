import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveThreeHeadedTemplarCombatRound } from '../../src/domain/slice/three-headed-templar-combat.js';
import { createThreeHeadedTemplarState } from '../../src/domain/three-headed-templar/index.js';
import { applyThreeHeadedTemplarActivity, type ThreeHeadedTemplarActivityCommand, validateThreeHeadedTemplarSpiritSources } from '../../src/domain/three-headed-templar/life.js';
import { createThreeHeadedTemplarEncounterState, applyThreeHeadedTemplarEncounterCommand, blockThreeHeadedTemplarEncounter,
  projectThreeHeadedTemplarEncounter, validateThreeHeadedTemplarEncounter, validateThreeHeadedTemplarEncounterCommand,
  hasThreeHeadedTemplarDisputeOpponent, hasThreeHeadedTemplarEncounterLock, settleThreeHeadedTemplarEncounter,
} from '../../src/domain/three-headed-templar/encounter.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const context = (s: SliceState): SeerContext => ({ roll: min => min, note: () => {}, check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 }) });
/** Explicit directed S3 setup continues original339-command naturalBlackKnight save, never natural promotion evidence. */
function fixture(acquire = false): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/black-knight-v01320/natural.json', 'utf8')).final);
  s.threeHeadedTemplar = createThreeHeadedTemplarState(); s.threeHeadedTemplar.guidanceKnown = true; s.threeHeadedTemplar.promotionWeek = s.week; s.threeHeadedTemplar.blackKnightActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.mastery['hanged-man.s3.multiple-release'] = 0; s.character.coreStats.knowledge = 30;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 30; s.cash = 10000; s.activeEvent = null; s.combat = null;
  if (acquire) { act(s, { type: 'MEET_SPIRITS' }); for (const spiritId of ['THT3-HELENA', 'THT3-ROLAND'] as const) {
    act(s, { type: 'PREPARE_GRAZING', spiritId }); act(s, { type: 'GRAZE', spiritId, abilityIds: spiritId === 'THT3-HELENA' ? ['SIGNAL', 'BRIEF_WARD', 'LOW_GLOW'] : ['SIGNAL', 'STEADY_HOLD', 'SCREEN'], confirmed: true });
  } }
  return s;
}
const act = (s: SliceState, c: ThreeHeadedTemplarActivityCommand) => applyThreeHeadedTemplarActivity(s, c, context(s));
const talk = (s: SliceState) => applyThreeHeadedTemplarEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context(s));
const fight = (s: SliceState) => applyThreeHeadedTemplarEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context(s));
function start(s: SliceState, external = false) { talk(s); if (external) for (const spiritId of ['THT3-HELENA', 'THT3-ROLAND'] as const) act(s, { type: 'EXTERNALIZE', spiritId }); fight(s); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: SliceStance, ...values: number[]) {
  const spy = script(...values), result = resolveThreeHeadedTemplarCombatRound(s, stance); s.combatHistory.push(result.round); expect(spy).toHaveBeenCalledTimes(values.length); vi.restoreAllMocks();
  settleThreeHeadedTemplarEncounter(s, result.outcome, context(s)); return result;
}
const legacy = (s: SliceState) => structuredClone({ secretSupplicant: s.secretSupplicant, listener: s.listener, shadowAscetic: s.shadowAscetic, roseBishop: s.roseBishop, shepherd: s.shepherd, blackKnight: s.blackKnight, town: s.town });
afterEach(() => vi.restoreAllMocks());

describe('ThreeHeadedTemplar originalBram and shared actualconsequences', () => {
  it('creates independent49yearBram100/100/120 withoneoriginalrod andkeeps oldconsequences', () => {
    const s = fixture(), old = legacy(s);
    expect(createThreeHeadedTemplarEncounterState()).toMatchObject({ targetId: 'THT3-BRAM', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', shadowReady: false, scene: { courtId: 'THT3-COURT', distanceMetres: 4, exitMetres: 4, thirdPartiesInArea: 0 } });
    expect(projectThreeHeadedTemplarEncounter(s).enemy).toMatchObject({ name: '布拉姆·福斯', age: 49, sequence: 3, weaponId: 'THT3-BRAM-ROD', source: 'ORIGINAL_LIMITED_G' });
    expect(s.blackKnight.encounter.enemyStatus).toBe('SURRENDERED'); expect(s.shepherd.grazing.spirits.find(a => a.id === 'SH5-CEDRIC-1')!.status).toBe('RELEASED'); expect(legacy(s)).toEqual(old); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true);
  });
  it('requires1AP realtalk thenexplicit1AP fight and neverrequires a free spirit', () => {
    const s = fixture(); expect(blockThreeHeadedTemplarEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈'); s.actionsRemaining = 1;
    expect(blockThreeHeadedTemplarEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2; talk(s); expect(s.combat).toBeNull(); expect(s.actionsRemaining).toBe(1); expect(hasThreeHeadedTemplarEncounterLock(s)).toBe(true);
    fight(s); expect(s.actionsRemaining).toBe(0); expect(hasThreeHeadedTemplarDisputeOpponent(s)).toBe(true); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true);
  });
  it('hidesnewenemy beforeS3 while unchangedinitial encounterstaysvalid', () => {
    const s = fixture(); s.progression.sequence = 4; s.threeHeadedTemplar.promotionWeek = null; const v = projectThreeHeadedTemplarEncounter(s);
    expect(v.enemy).toBeNull(); expect(v.story).toBe(''); expect(v.facts).toEqual([]); expect(v.actions).toEqual([]); expect(v.scene).toBeNull(); expect(JSON.stringify(v)).not.toMatch(/BRAM|布拉姆/); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true);
  });
  it('peacefulexit atzeroAP zeroMind actuallyrecalls originals thenwalks4m withoutrefill', () => {
    const s = fixture(true), old = legacy(s); talk(s); for (const spiritId of ['THT3-HELENA', 'THT3-ROLAND'] as const) act(s, { type: 'EXTERNALIZE', spiritId });
    const startClock = s.threeHeadedTemplar.life.clockSeconds, mana = s.spirituality; s.actionsRemaining = 0; s.mind = 0;
    applyThreeHeadedTemplarEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context(s));
    expect(s.threeHeadedTemplar.life.clockSeconds).toBe(startClock + 12); expect(s.threeHeadedTemplar.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'RESISTING', enemySpirituality: 120, scene: { playerPosition: 'EXIT', ordinaryWalkedMetres: 4 } });
    for (const spirit of Object.values(s.threeHeadedTemplar.life.spirits)) expect(spirit).toMatchObject({ location: 'INTERNAL', spirituality: 30, travelMetres: 4 });
    expect(s.spirituality).toBe(mana); expect(legacy(s)).toEqual(old); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0);
  });
  it('READY allows actualexternalization andmanualrecall beforefight withoutrefill', () => {
    const s = fixture(true); talk(s); act(s, { type: 'EXTERNALIZE', spiritId: 'THT3-HELENA' }); act(s, { type: 'EXTERNALIZE', spiritId: 'THT3-ROLAND' });
    act(s, { type: 'RECALL_SPIRIT', spiritId: 'THT3-HELENA' }); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true); fight(s);
    const result = round(s, 'ATTACK', 1, 1, 426, 100, 1); expect(result.round.threeHeadedTemplarOutcome!.playerActions[0]!.supportActions.map(a => a.spiritId)).toEqual(['THT3-ROLAND']); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true);
  });
  it('rejects forgedsources wrongcity extraauthority andoldGarrick substitution', () => {
    expect(validateThreeHeadedTemplarEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true); expect(validateThreeHeadedTemplarEncounterCommand({ type: 'ENCOUNTER_FIGHT', freeSouls: true })).toBe(false);
    const changes: ((s: SliceState) => void)[] = [s => { s.world.city = 'TINGEN'; }, s => { s.threeHeadedTemplar.guidanceKnown = false; }, s => { s.threeHeadedTemplar.promotionWeek = null; }, s => { s.threeHeadedTemplar.life.cases['two-end-seal'].status = 'PREPARED'; }, s => { s.threeHeadedTemplar.life.spirits['THT3-HELENA'].status = 'GRAZED'; }];
    for (const change of changes) { const s = fixture(); change(s); const before = structuredClone(s); expect(() => talk(s)).toThrow(); expect(s).toEqual(before); }
    const s = fixture(); start(s); s.threeHeadedTemplar.encounter.targetId = 'BK4-GARRICK-NOLL' as 'THT3-BRAM'; expect(hasThreeHeadedTemplarDisputeOpponent(s)).toBe(false); expect(validateThreeHeadedTemplarEncounter(s)).toBe(false);
  });
  it('retreatbeforeaction paysno support andactuallyrecallsboth inside68seconds', () => {
    const s = fixture(true), old = legacy(s); start(s, true); const clock = s.threeHeadedTemplar.life.clockSeconds, mana = s.spirituality, result = round(s, 'RETREAT', 1, 1, 1);
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]); expect(s.spirituality).toBe(mana); expect(s.threeHeadedTemplar.life.clockSeconds).toBe(clock + 68); expect(legacy(s)).toEqual(old);
    expect(s.threeHeadedTemplar.life.spirits['THT3-HELENA']).toMatchObject({ location: 'INTERNAL', spirituality: 30 }); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true);
  });
  it('usesactualBlackKnight50/20/20/10 core1250floor125 and12S onlyCONTINUE', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    const result = round(s, 'ATTACK', 1, 1, 426, 100, 1); expect(result.outcome).toBe('CONTINUE');
    expect(result.round.playerAdvantage).toBe(baseAdvantage(19, 100, 100, 100, 1250, 120) - 22.5); expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 120, 1250, 120)); expect(s.spirituality).toBe(112); expect(result.round.consequenceWeights).toBeNull(); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true);
    round(s, 'RETREAT', 1, 1, 100, 1); expect(s.spirituality).toBe(112); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true);
  });
  it('genuineoddplayerfirst keepsperformedward thenevenenemyfirst interruptsremainingRoland', () => {
    const s = fixture(true); start(s, true); const first = round(s, 'ATTACK', 1, 1, 426, 81, 1);
    expect(first.round.first).toBe('PLAYER'); expect(first.round.threeHeadedTemplarOutcome!.playerActions[0]!.enemyReduction).toBe(18); expect(s.threeHeadedTemplar.life.spirits['THT3-HELENA']).toMatchObject({ location: 'INTERNAL', integrity: 80, spirituality: 27 });
    const second = round(s, 'ATTACK', 1, 1, 81, 426, 1); expect(second.round.first).toBe('ENEMY'); expect(second.round.threeHeadedTemplarOutcome!.playerActions[0]!.supportActions).toEqual([]);
    expect(s.threeHeadedTemplar.life.spirits['THT3-ROLAND']).toMatchObject({ location: 'INTERNAL', integrity: 80, spirituality: 27 }); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true);
  });
  it('eachoriginal hasfinite30S andround11 neverrefreshes exhaustedspirits', () => {
    const s = fixture(true); start(s, true);
    for (let i = 1; i <= 11; i++) { const result = i % 2 === 1 ? round(s, 'ATTACK', 1, 1, 426, 100, 1) : round(s, 'ATTACK', 1, 1, 100, 426, 1);
      expect(result.round.threeHeadedTemplarOutcome!.playerActions[0]!.supportActions).toHaveLength(i <= 10 ? 2 : 0); expect(result.round.consequenceWeights).toBeNull(); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true); }
    for (const spirit of Object.values(s.threeHeadedTemplar.life.spirits)) expect(spirit).toMatchObject({ spirituality: 0, integrity: 100, location: 'COURT' });
    expect(validateThreeHeadedTemplarSpiritSources(s.threeHeadedTemplar.life.spirits, s.week)).toBe(true);
  });
  it('actualpaidblade canproduce sharedheavy surrender andrecall originalswithoutloot', () => {
    const s = fixture(true), old = legacy(s); start(s, true); const result = round(s, 'ATTACK', 1, 1, 1, 100, 1, 66);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.threeHeadedTemplar.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'COURT', enemySpirituality: 120 });
    expect(s.threeHeadedTemplar.encounter.enemyInjuries).toHaveLength(1); expect(s.threeHeadedTemplar.life.spirits['THT3-HELENA']).toMatchObject({ location: 'INTERNAL', spirituality: 27 }); expect(legacy(s)).toEqual(old); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true);
  });
  it('shareddeathreallykills playerandpermanentlyreleasesstill-external originals', () => {
    const s = fixture(true), old = legacy(s); start(s, true); const result = round(s, 'ATTACK', 1, 1, 426, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat).toBeNull(); expect(s.threeHeadedTemplar.encounter).toMatchObject({ status: 'LOST', scene: { playerPosition: 'COURT', ordinaryWalkedMetres: 0 } });
    for (const spirit of Object.values(s.threeHeadedTemplar.life.spirits)) expect(spirit).toMatchObject({ status: 'RELEASED', location: 'RELEASED', spirituality: 27, releasedWeek: s.week });
    expect(legacy(s)).toEqual(old); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true);
  });
  it('rejectsfabricatedterminal, costrefunds, count, initiative andclonedsource histories', () => {
    const s = fixture(true); start(s, true); expect(() => settleThreeHeadedTemplarEncounter(s, 'ENEMY_DEAD', context(s))).toThrow(); expect(() => settleThreeHeadedTemplarEncounter(s, 'AUTO_WIN', context(s))).toThrow();
    round(s, 'ATTACK', 1, 1, 426, 81, 1); expect(validateThreeHeadedTemplarEncounter(s)).toBe(true);
    const changes: ((c: SliceState) => void)[] = [c => { c.threeHeadedTemplar.encounter.enemySpirituality = 120; }, c => { c.threeHeadedTemplar.encounter.shadowReady = true; },
      c => { c.combatHistory.at(-1)!.threeHeadedTemplarOutcome!.playerActions[0]!.supportActions[0]!.paidCost = 0 as 1; }, c => { c.combatHistory.at(-1)!.first = 'ENEMY'; }, c => { c.combatHistory.at(-1)!.playerCountRoll = 100; },
      c => { c.threeHeadedTemplar.life.spirits['THT3-HELENA'].spirituality = 30; }, c => { c.threeHeadedTemplar.life.spirits['THT3-ROLAND'].casketId = 'THT3-HELENA-CASKET'; },
      c => { c.spirituality--; }, c => { c.threeHeadedTemplar.life.clockSeconds--; }, c => { c.combatHistory.at(-1)!.threeHeadedTemplarOutcome!.enemyActions[0]!.order = 0; }];
    for (const change of changes) { const copy = structuredClone(s); change(copy); expect(validateThreeHeadedTemplarEncounter(copy)).toBe(false); }
  });
});
