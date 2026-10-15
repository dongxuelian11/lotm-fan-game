import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateSailorState } from '../../src/domain/sailor/index.js';
import { validateRagerState } from '../../src/domain/rager/index.js';
import { validateNavigatorState } from '../../src/domain/navigator/index.js';
import { validateWindBlessedState } from '../../src/domain/wind-blessed/index.js';
import { validateOceanSingerState, validateOceanSingerRitual } from '../../src/domain/ocean-singer/index.js';
import { validateCataclysmPriestState, validateCataclysmPriestRitualState } from '../../src/domain/cataclysm-priest/index.js';
import { validateSeaKingState, isSeaKing, hasSeaKingHistory } from '../../src/domain/sea-king/index.js';
import { validateSeerState } from '../../src/domain/seer/index.js';
import { createCatastropheState, validateCatastropheState } from '../../src/domain/catastrophe/index.js';
import { CATASTROPHE_ABILITY_IDS } from '../../src/domain/catastrophe/types.js';
import { CATASTROPHE_CASE_IDS } from '../../src/domain/catastrophe/life.js';
import { SEA_KING_ENEMY_COUNT_WHEEL, SEA_KING_ENEMY_ABILITY_WHEEL, isSeaKing as isSeaKingCombat,
  currentSeaKingCombatSource } from '../../src/domain/sea-king/combat.js';
import { CATASTROPHE_ENEMY_COUNT_WHEEL, CATASTROPHE_ENEMY_ABILITY_WHEEL } from '../../src/domain/catastrophe/combat.js';
import { catastropheFixturePath, catastropheBoundaryNames, catastropheBoundary, catastropheBoundaryForIntent,
  catastropheSnapshot, tyrantLegacyKeys, seaKingFixturePath, unitBudget } from './catastrophe-helper.js';

/** All seven original domains are historical only. No new-stage craft or resource route may mutate them. */
function expectOriginalHistory(s: SliceState, old: SliceState) {
  for (const key of tyrantLegacyKeys) expect(s[key], key).toEqual(old[key]);
  expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
  expect(s.character.gender).toBe(old.character.gender); expect(s.runId).toBe(old.runId); expect(s.random.seed).toBe(old.random.seed);
  for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
  expect(s.seer.completedSources.slice(0, old.seer.completedSources.length)).toEqual(old.seer.completedSources);
  for (const source of old.seer.completedSources) expect(s.seer.completedSources.filter(x => x === source), source).toHaveLength(1);
}
const stageValidators = { validateSailorState, validateRagerState, validateNavigatorState, validateWindBlessedState,
  validateOceanSingerState, validateOceanSingerRitual, validateCataclysmPriestState, validateCataclysmPriestRitualState,
  validateSeaKingState, validateSeerState, validateCatastropheState };

describe('Catastrophe original492 living prefix, migration168 and shared runtime', () => {
  it('migrates the actual W121 survivor without changing original bodies, wounds, fields or random state', () => {
    const original = readObjectEntry<SliceState>(seaKingFixturePath, 'final'), bytes = JSON.stringify(original), s = migrateSliceState(original);
    expect(s.schemaVersion).toBe(174); expect(s.contentVersion).toBe('calamity-demoness-v174');
    for (const key of Object.keys(original)) if (!['schemaVersion', 'contentVersion'].includes(key)) {
      const expected = (original as unknown as Record<string, unknown>)[key], actual = (s as unknown as Record<string, unknown>)[key];
      // Earlier migrations may append defaults, never overwrite any existing value.
      if (expected !== null && typeof expected === 'object') expect(actual, key).toMatchObject(expected);
      else expect(actual, key).toEqual(expected);
    }
    expect(s.catastrophe).toEqual(createCatastropheState()); expect(s.injuries).toEqual(original.injuries);
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['LIGHT', null], ['LIGHT', null], ['HEAVY', null]]);
    expect(s.injuryRisk).toBe(2); expect(s.health).toBe(50); expectOriginalHistory(s, original);
    expect(JSON.stringify(original)).toBe(bytes); assertValidSliceState(s); expect(migrateSliceState(s)).toEqual(s);
  });
  it('replays the full492 original commands and every captured new choice without changing the seed or searching for favorable outcomes', () => {
    const commands = readObjectEntry<SliceIntent[]>(catastropheFixturePath, 'commands');
    const oldCommands = readObjectEntry<SliceIntent[]>(seaKingFixturePath, 'commands');
    expect(oldCommands).toHaveLength(492); expect(commands.slice(0, 492)).toEqual(oldCommands); expect(commands.length).toBeGreaterThan(492);
    expect(readObjectEntry<number>(catastropheFixturePath, 'prefixCount')).toBe(492);
    const seed = readObjectEntry<string>(catastropheFixturePath, 'seed'); expect(seed).toBe('sailor-natural-v026');
    expect(seed).toBe(readObjectEntry<string>(seaKingFixturePath, 'seed'));
    const inherited = migrateSliceState(readObjectEntry<unknown>(seaKingFixturePath, 'final'));
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(catastropheFixturePath, 'creation');
    let s = createSliceRun(inherited.runId, creation, seed);
    for (const [index, intent] of commands.entries()) {
      expect(validateSlicePayload(intent), `command ${index + 1}`).toBe(true);
      const cursor = s.random.cursor, revision = s.revision; s = applySliceIntent(s, intent);
      expect(s.random.seed).toBe(seed); expect(s.random.cursor).toBeGreaterThanOrEqual(cursor); expect(s.revision).toBe(revision + 1); expect(s.weeklyBudget).toBe(3);
      if (index === 491) { expect(s).toEqual(inherited); expect(s).toEqual(catastropheSnapshot('departureStart')); }
    }
    assertValidSliceState(s); expect(s).toEqual(catastropheSnapshot('final')); expectOriginalHistory(s, inherited);
    expect(s.combat).toBeNull(); expect(s.catastrophe.encounter.terminal).not.toBeNull();
    // Actual replay determines this branch; the test never demands a win or a surviving player.
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); expect(s.catastrophe.encounter.terminal?.outcome).toBe('PLAYER_DEAD'); }
    else { expect(s.status).toBe('ACTIVE'); expect(s.health).toBeGreaterThan(0); expect(s.catastrophe.encounter.terminal?.outcome).not.toBe('PLAYER_DEAD'); }
  }, 120000);
  it('replays every full indexed before/intent/after boundary without mutating input or substituting a final-only snapshot', () => {
    const names = catastropheBoundaryNames(); expect(names.length).toBeGreaterThan(20); expect(new Set(names).size).toBe(names.length);
    const commands = new Set<string>();
    for (const key of names) {
      const b = catastropheBoundary(key), bytes = JSON.stringify(b.beforeLast), intent = JSON.stringify(b.lastIntent);
      assertValidSliceState(b.beforeLast); assertValidSliceState(b.final); expect(validateSlicePayload(b.lastIntent), key).toBe(true);
      expect(applySliceIntent(b.beforeLast, b.lastIntent), key).toEqual(b.final);
      expect(JSON.stringify(b.beforeLast), key).toBe(bytes); expect(JSON.stringify(b.lastIntent), key).toBe(intent);
      if (b.lastIntent.type === 'CATASTROPHE') commands.add(b.lastIntent.command.type);
    }
    for (const command of ['LEARN_GUIDANCE', 'PREPARE_TASK', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT']) expect(commands.has(command), command).toBe(true);
  }, 120000);
  it('actually discovers care, pays60 for the same original heavy injury and clears wounds only through a later ordinary rest', () => {
    const old = catastropheSnapshot('departureStart'); expect(old).toMatchObject({ week: 121, health: 50, injuryRisk: 2, cash: 540, actionsRemaining: 3 });
    const wound = old.injuries.find(i => i.severity === 'HEAVY' && i.treatedRevision === null)!; expect(wound).toBeDefined();
    const discovery = catastropheBoundaryForIntent(i => i.type === 'ACTION' && i.action === 'INVESTIGATE' && i.targetId === 'CARE-ACCESS-01');
    expect(discovery.beforeLast.careKnown).toBe(false); expect(discovery.final.careKnown).toBe(true);
    expect(discovery.final.injuries).toEqual(discovery.beforeLast.injuries); expect(discovery.final.health).toBe(discovery.beforeLast.health);
    const paid = catastropheBoundaryForIntent(i => i.type === 'EVENT_CHOICE' && i.choiceId === 'PAY',
      b => b.beforeLast.activeEvent?.id === 'LIFE-CARE-01' && b.beforeLast.injuries.some(i => i.id === wound.id && i.treatedRevision === null) && b.final.injuries.some(i => i.id === wound.id && i.treatedRevision !== null));
    expect(paid.beforeLast.cash - paid.final.cash).toBeGreaterThanOrEqual(60);
    if (paid.beforeLast.week === paid.final.week) expect(paid.beforeLast.cash - paid.final.cash).toBe(60);
    expect(paid.final.injuries.find(i => i.id === wound.id)).toMatchObject({ severity: 'HEAVY', treatedRevision: paid.final.revision });
    expect(paid.final.health).toBe(paid.beforeLast.health); expect(paid.final.injuryRisk).toBe(2);
    const healed = catastropheBoundaryForIntent(i => i.type === 'ACTION' && i.action === 'REST',
      b => b.beforeLast.injuries.some(i => i.id === wound.id && i.treatedRevision !== null) && !b.final.injuries.some(i => i.id === wound.id));
    expect(healed.beforeLast.revision).toBeGreaterThanOrEqual(paid.final.revision); expect(healed.final.health).toBeGreaterThanOrEqual(80);
    expect(healed.final.injuries).toEqual([]); expect(healed.final.injuryRisk).toBe(0);
    expect(catastropheSnapshot('guidanceStart').injuries).toEqual([]); expectOriginalHistory(healed.final, old);
  });
  it('naturally preserves exactly20 old values, adds only two zero entries and freezes Sea King digestion without refilling S', () => {
    const s = catastropheSnapshot('promoted'), old = catastropheSnapshot('departureStart'), view = projectSliceState(s);
    expect(s.progression).toMatchObject({ pathwayId: 'tyrant', sequence: 2, acting: 0, promotionWeek: 7 });
    expect(s.catastrophe.seaKingActingAtPromotion).toBe(100); expect(s.catastrophe.promotionWeek! - s.seaKing.promotionWeek!).toBeGreaterThanOrEqual(12);
    expect(Object.keys(s.progression.mastery)).toHaveLength(22); expect(CATASTROPHE_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id)).sort()).toEqual([...CATASTROPHE_ABILITY_IDS].sort());
    expect(view.catastrophe.abilities.map(a => a.id).sort()).toEqual([...Object.keys(old.progression.mastery), ...CATASTROPHE_ABILITY_IDS].sort());
    expect(view.catastrophe).toMatchObject({ formulaKnown: false, formula: [], promoted: true, currentGender: old.character.gender });
    expect(view.maxSpirituality).toBe(120); expect(view.catastrophe.resources).toMatchObject({ maxSpirituality: 120, spirituality: s.spirituality });
    expectOriginalHistory(s, old);
    const b = catastropheBoundaryForIntent(i => i.type === 'CATASTROPHE' && i.command.type === 'CONSUME', b => b.final.progression.sequence === 2);
    expect(b.final.spirituality).toBe(b.beforeLast.spirituality); expect(b.final.injuries).toEqual(b.beforeLast.injuries); expect(b.final.injuryRisk).toBe(b.beforeLast.injuryRisk);
    const outcome = b.final.catastrophe.bottles.find(bottle => ['SUCCESS', 'GREAT_SUCCESS'].includes(bottle.outcome ?? ''))!.outcome;
    expect(b.final.mind).toBe(b.beforeLast.mind - (outcome === 'GREAT_SUCCESS' ? 8 : 15));
    for (const bottle of s.catastrophe.bottles.filter(bottle => bottle.status === 'CONSUMED')) {
      expect(bottle.preparationWeek).toBe(bottle.consumedWeek); expect(bottle.acquiredWeek).not.toBeNull();
      expect(bottle.id).toMatch(/^catastrophe-potion-/); expect(bottle.source).not.toBe(s.seaKing.bottles[0]!.source);
    }
  });
  it('validates all seven inherited histories, both old rituals and central mastery at promotion, practice and actual terminal state', () => {
    for (const checkpoint of ['promoted', 'practiced', 'final'] as const) {
      const s = catastropheSnapshot(checkpoint); assertValidSliceState(s);
      for (const [name, validate] of Object.entries(stageValidators)) expect(validate(s), `${checkpoint}: ${name}`).toBe(true);
      const view = projectSliceState(s);
      for (const key of tyrantLegacyKeys) { expect(view[key].promoted, key).toBe(true); expect(view[key].acting, key).toBe(100); }
      expect(view.sailor.digestion).toContain('已消化'); expect(view.sailor.digestion).not.toContain('刚刚服药');
      expect(s.catastrophe.seaKingActingAtPromotion).toBe(100);
    }
  });
  it('keeps all old exact-stage acquisition, life, ritual and combat entrances closed at S2', () => {
    const s = catastropheSnapshot('promoted'), view = projectSliceState(s);
    expect(hasSeaKingHistory(s)).toBe(true); expect(isSeaKing(s)).toBe(false); expect(isSeaKingCombat(s)).toBe(false); expect(currentSeaKingCombatSource(s)).toBeNull();
    for (const key of tyrantLegacyKeys) expect(view[key].actions.filter(a => a.enabled), key).toEqual([]);
    const intents: SliceIntent[] = [
      { type: 'SAILOR', command: { type: 'LEARN_GUIDANCE' } }, { type: 'RAGER', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'NAVIGATOR', command: { type: 'LEARN_GUIDANCE' } }, { type: 'WIND_BLESSED', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'OCEAN_SINGER', command: { type: 'LEARN_GUIDANCE' } }, { type: 'CATACLYSM_PRIEST', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'SEA_KING', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'SAILOR', command: { type: 'SURVEY', caseId: 'moored-barrel' } },
      { type: 'RAGER', command: { type: 'OBSERVE', caseId: 'jammed-capstan' } },
      { type: 'NAVIGATOR', command: { type: 'SURVEY', caseId: 'tide-crossing' } },
      { type: 'WIND_BLESSED', command: { type: 'OBSERVE', caseId: 'crosswind-screen' } },
      { type: 'WIND_BLESSED', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'OCEAN_SINGER', command: { type: 'OBSERVE', caseId: 'warned-rehearsal' } },
      { type: 'OCEAN_SINGER', command: { type: 'REQUEST_RITUAL' } },
      { type: 'OCEAN_SINGER', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'CATACLYSM_PRIEST', command: { type: 'OBSERVE', caseId: 'sea-eddy' } },
      { type: 'CATACLYSM_PRIEST', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'SEA_KING', command: { type: 'OBSERVE', caseId: 'remote-dinghy' } },
      { type: 'SEA_KING', command: { type: 'PREPARE_PROMOTION' } },
      { type: 'SEA_KING', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'SEA_KING', command: { type: 'CONSUME', bottleId: 'sea-king-potion-3', confirmed: true } },
    ];
    for (const intent of intents) {
      expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true); const before = JSON.stringify(s);
      expect(() => applySliceIntent(s, intent)).toThrow(); expect(JSON.stringify(s)).toBe(before);
    }
  });
  it('keeps Benedict and Quentin dead, their original clubs on the quay, old failed bottles consumed and original Sea King wear unchanged', () => {
    const s = catastropheSnapshot('final'), old = catastropheSnapshot('departureStart'); expectOriginalHistory(s, old);
    expect(s.cataclysmPriest.encounter.enemy).toMatchObject({ id: 'CP4-BENEDICT', health: 0, mind: 100, status: 'DEAD', weaponId: 'CP4-BENEDICT-CLUB', weaponLocation: 'QUAY' });
    expect(s.seaKing.encounter).toMatchObject({ targetId: 'SK3-QUENTIN', enemyHealth: 0, enemyMind: 100, enemySpirituality: 24, enemyStatus: 'DEAD', weaponLocation: 'QUAY', enemyRisk: 1,
      powerUses: { WIND: 12, WATER_WARD: 5, FOCUS: 4 }, terminal: { outcome: 'ENEMY_DEAD', round: 8, historyIndex: 17 } });
    expect(s.seaKing.encounter.enemyInjuries).toHaveLength(1);
    expect(s.seaKing.life.orin).toMatchObject({ id: 'SK3-ORIN', age: 39, alive: true, location: 'PIER', energy: 76, travelMetres: 120 });
    expect(s.seaKing.life.dinghy).toMatchObject({ id: 'SK3-DINGHY', location: 'PIER', occupant: null, hull: 100, travelMetres: 120 });
    expect(s.seaKing.life.windlass).toMatchObject({ id: 'SK3-WINDLASS', location: 'OWNER', durability: 98 });
    expect(s.seaKing.life.recess).toMatchObject({ waterUnits: 20, displacedToCove: 0 });
    expect(s.seaKing.life.cases['calm-water-record'].attempts[0]).toMatchObject({ abilityTier: 'FAILURE', fragments: [], hypothesisHistory: ['CURRENT', 'HAND_MOVED'] });
    expect(s.seaKing.bottles.map(b => [b.status, b.consumedWeek, b.outcome])).toEqual([['CONSUMED', 98, 'FAILURE'], ['CONSUMED', 106, 'FAILURE'], ['CONSUMED', 113, 'SUCCESS']]);
    expect(s.cataclysmPriest.ritual.visits[0]).toMatchObject({ kit: { id: 'CP4-KIT-1', status: 'CONSUMED', location: 'PLATFORM' }, site: { gauge: 'BROKEN', lowerWalkway: 'WASHED_OUT', sea: 'RECEDED' } });
    expect(s.catastrophe.encounter.targetId).toBe('CT2-VALE');
    expect(s.catastrophe.life.site.keeper.id).toBe('CT2-NORA'); expect(s.catastrophe.life.site.water.id).toBe('CT2-WATER');
  });
  it('derives natural practice mastery from actual applications and leaves unused successful windows unrewarded', () => {
    const s = catastropheSnapshot('practiced'), life = s.catastrophe.life;
    expect(s.progression.acting).toBe(100); expect(life.reflected).toBe(true); expect(life.activeCase).toBeNull(); expect(life.site.playerPosition).toBe('EXIT');
    for (const id of CATASTROPHE_CASE_IDS) {
      const c = life.cases[id]; expect(c.status).toBe('RESOLVED'); expect(c.contactOpen).toBe(false); expect(c.returned).toBe(true);
      expect(c.attempts.length).toBeGreaterThan(0);
      for (const a of c.attempts) { expect(a.closed).toBe(true); for (const use of [a.storm, a.pressure]) { expect(use.successes).toBeLessThanOrEqual(use.attempts); expect(use.effects).toBeLessThanOrEqual(use.successes); } }
    }
    for (const [index, field] of (['storm', 'pressure'] as const).entries()) {
      const earned = CATASTROPHE_CASE_IDS.reduce((total, id) => total + (life.cases[id].attempts.some(a => a[field].effects > 0) ? 8 : 0), 0);
      expect(s.progression.mastery[CATASTROPHE_ABILITY_IDS[index]!]).toBe(earned);
    }
    for (const a of life.cases['withdrawn-request'].attempts) expect([a.storm.effects, a.pressure.effects]).toEqual([0, 0]);
    expect(life.site.water.bayUnits + life.site.water.channelUnits).toBe(20); expect(life.site.water.channelUnits).toBe(0);
    expect(life.site.gate.position).toBe('CLOSED'); expect(life.site.buoy.offsetMetres).toBe(0); expectOriginalHistory(s, catastropheSnapshot('departureStart'));
  });
  it('projects the actual old Sea King enemy constants without changing old dice, and keeps the Cataclysm Priest enemy ordinary', () => {
    const old = migrateSliceState(readObjectEntry<unknown>(seaKingFixturePath, 'combatStart')), bytes = JSON.stringify(old), projected = projectSliceState(old).combat!;
    expect(projected.enemyCountWheel.map(({ id, weight }) => ({ id, weight }))).toEqual(SEA_KING_ENEMY_COUNT_WHEEL.map(({ id, weight }) => ({ id, weight })));
    expect(projected.enemyAbilityWheel.map(({ id, weight }) => ({ id, weight }))).toEqual(SEA_KING_ENEMY_ABILITY_WHEEL.map(({ id, weight }) => ({ id, weight })));
    const seaKingDisplayLabels = ['有限风压：5S/75', '真实海水防护：4S/减45', '同一原棍：20×身体', '有限专注：4S/抵本轮下一次成功风水压力，不抵雷', '判断偏差：−22.5'];
    expect(projected.enemyCountWheel).toEqual(SEA_KING_ENEMY_COUNT_WHEEL);
    expect(projected.enemyAbilityWheel).toEqual(SEA_KING_ENEMY_ABILITY_WHEEL.map((entry, index) => ({ ...entry, label: seaKingDisplayLabels[index] })));
    expect(projected.enemyAbilityWheel.map(x => [x.id, x.weight])).toEqual([['WIND', 35], ['WATER_WARD', 25], ['BODY_STRIKE', 20], ['FOCUS', 15], ['ACCIDENT', 5]]);
    expect(projected.enemyCountWheel.map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(JSON.stringify(old)).toBe(bytes);
    const cp = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/cataclysm-priest-v01240/natural.json', 'combatStart'));
    const ordinary = projectSliceState(cp).combat!;
    expect(ordinary.enemyCountWheel.map(x => x.weight)).toEqual([45, 40, 15]);
    expect(ordinary.enemyAbilityWheel.map(x => [x.id, x.weight])).toEqual([['STRIKE', 40], ['BLOCK', 20], ['OPENING', 20], ['DISTANCE', 15], ['MISS', 5]]);
    const current = projectSliceState(catastropheSnapshot('combatStart')).combat!;
    expect(current.enemyCountWheel.map(({ id, weight }) => ({ id, weight }))).toEqual(CATASTROPHE_ENEMY_COUNT_WHEEL.map(({ id, weight }) => ({ id, weight })));
    expect(current.enemyAbilityWheel.map(({ id, weight }) => ({ id, weight }))).toEqual(CATASTROPHE_ENEMY_ABILITY_WHEEL.map(({ id, weight }) => ({ id, weight })));
    const catastropheDisplayLabels = ['原风暴：7S/105；真实湾水、系索耐久−1', '原水压：6S/减60；开闸原渠水≥1、回流1单位', '唯一原棍普通打击：20×身体', '普通切换原闸：0S、每轮一次、耐久−1；初次空渠开闸引4单位', '判断偏差：−22.5'];
    expect(current.enemyCountWheel).toEqual(CATASTROPHE_ENEMY_COUNT_WHEEL);
    expect(current.enemyAbilityWheel).toEqual(CATASTROPHE_ENEMY_ABILITY_WHEEL.map((entry, index) => ({ ...entry, label: catastropheDisplayLabels[index] })));
  });
  it.each([0, 31, 119, 120])('preserves S%s with public/save cap120 and ordinary rest does not clamp S2 to30', spirit => {
    const s = unitBudget(catastropheSnapshot('promoted')); s.spirituality = spirit; assertValidSliceState(s);
    expect(projectSliceState(s).maxSpirituality).toBe(120); expect(projectSliceState(s).catastrophe.resources?.spirituality).toBe(spirit);
    expect(migrateSliceState(s).spirituality).toBe(spirit);
    const next = applySliceIntent(s, { type: 'ACTION', action: 'REST' }); expect(next.spirituality).toBeGreaterThanOrEqual(spirit);
    expect(next.spirituality).toBeLessThanOrEqual(120); if (spirit >= 119) expect(next.spirituality).toBe(120); assertValidSliceState(next);
    const invalid = structuredClone(s); invalid.spirituality = 121; expect(() => assertValidSliceState(invalid)).toThrow();
  });
  it('rejects deleted/extra mastery, changed old digestion, revived originals and future or unknown fields instead of repairing them', () => {
    const s = catastropheSnapshot('practiced');
    const changes: ((t: SliceState) => void)[] = [
      t => { delete t.progression.mastery['tyrant.s3.sea-domain']; }, t => { delete t.progression.mastery[CATASTROPHE_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['tyrant.s1.unearned'] = 0; }, t => { t.progression.mastery[CATASTROPHE_ABILITY_IDS[0]] = 501; },
      t => { t.progression.mastery[CATASTROPHE_ABILITY_IDS[0]] = 0.5; },
      t => { t.rager.sailorActingAtPromotion = 99; }, t => { t.navigator.ragerActingAtPromotion = 99; },
      t => { t.windBlessed.navigatorActingAtPromotion = 99; }, t => { t.oceanSinger.windBlessedActingAtPromotion = 99; },
      t => { t.cataclysmPriest.oceanSingerActingAtPromotion = 99; }, t => { t.seaKing.cataclysmPriestActingAtPromotion = 99; },
      t => { t.catastrophe.seaKingActingAtPromotion = 99; }, t => { t.seaKing.life.reflected = false; },
      t => { t.seaKing.life.orin.energy = 100; }, t => { t.seaKing.life.windlass.durability = 100; },
      t => { t.seaKing.encounter.enemyHealth = 100; t.seaKing.encounter.enemyStatus = 'RESISTING'; },
      t => { t.seaKing.encounter.enemySpirituality = 120; },
      t => { t.cataclysmPriest.encounter.enemy.health = 100; t.cataclysmPriest.encounter.enemy.status = 'RESISTING'; },
      t => { t.cataclysmPriest.ritual.visits[0]!.kit.status = 'SEALED'; },
      t => { t.catastrophe.life.reflected = false; }, t => { t.progression.sequence = 1; }, t => { t.progression.pathwayId = 'diviner'; },
      t => { Object.assign(t.catastrophe, { futurePower: true }); }, t => { Object.assign(t, { futurePower: true }); },
    ];
    for (const [index, change] of changes.entries()) { const t = structuredClone(s); change(t); expect(() => assertValidSliceState(t), `tamper ${index + 1}`).toThrow(); }
    const future = { ...structuredClone(s), schemaVersion: s.schemaVersion + 1 }; expect(() => migrateSliceState(future)).toThrow();
  });
});
