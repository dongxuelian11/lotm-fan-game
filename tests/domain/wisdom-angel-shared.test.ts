import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateReaderState } from '../../src/domain/reader/index.js';
import { validateReasonerState } from '../../src/domain/reasoner/index.js';
import { validateDetectiveState } from '../../src/domain/detective/index.js';
import { validatePolymathState } from '../../src/domain/polymath/index.js';
import { validateMysticismMagisterState } from '../../src/domain/mysticism-magister/index.js';
import { validateProphetState } from '../../src/domain/prophet/index.js';
import { validateProphetRitualState } from '../../src/domain/prophet/ritual.js';
import { validateInsightScholarState, isInsightScholar, hasInsightScholarHistory } from '../../src/domain/insight-scholar/index.js';
import { validateSeerState } from '../../src/domain/seer/index.js';
import { createWisdomAngelState, validateWisdomAngelState } from '../../src/domain/wisdom-angel/index.js';
import { WISDOM_ANGEL_ABILITY_IDS } from '../../src/domain/wisdom-angel/types.js';
import { WISDOM_ANGEL_CASE_IDS } from '../../src/domain/wisdom-angel/life.js';
import { INSIGHT_SCHOLAR_ENEMY_COUNT_WHEEL, INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL, isInsightScholar as isInsightScholarCombat, currentInsightScholarCombatSource } from '../../src/domain/insight-scholar/combat.js';
import { WISDOM_ANGEL_ENEMY_COUNT_WHEEL, WISDOM_ANGEL_ENEMY_ABILITY_WHEEL } from '../../src/domain/wisdom-angel/combat.js';
import { wisdomAngelFixturePath, wisdomAngelBoundaryNames, wisdomAngelBoundary, wisdomAngelBoundaryForIntent,
  wisdomAngelSnapshot, readingLegacyKeys, insightScholarPeacefulFixturePath, insightScholarDeathFixturePath,
  unitBudget } from './wisdom-angel-helper.js';

/** Old actual people, learned samples and case records remain immutable. Only paid old production and actual combat use may change crafts. */
function expectOriginalHistory(s: SliceState, old: SliceState) {
  for (const key of readingLegacyKeys.filter(k => k !== 'mysticismMagister')) expect(s[key], key).toEqual(old[key]);
  expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
  expect(s.character.gender).toBe(old.character.gender); expect(s.runId).toBe(old.runId); expect(s.random.seed).toBe(old.random.seed);
  for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
  const m = structuredClone(s.mysticismMagister), previous = old.mysticismMagister;
  const outcomes = s.combatHistory.slice(old.combatHistory.length).flatMap(r => r.wisdomAngelOutcome ? [r.wisdomAngelOutcome] : []);
  const consumed = outcomes.flatMap(r => r.consumedCraftIds);
  expect(new Set(consumed).size).toBe(consumed.length);
  expect(m.crafts.length).toBeGreaterThanOrEqual(previous.crafts.length);
  for (const [index, prior] of previous.crafts.entries()) {
    const actual = structuredClone(m.crafts[index]!);
    if (consumed.includes(prior.id)) {
      expect(prior).toMatchObject({ status: 'PLAYER', usedWeek: null });
      expect(actual.status).toBe('CONSUMED'); expect(actual.usedWeek).toBeGreaterThanOrEqual(old.week);
      actual.status = prior.status; actual.usedWeek = prior.usedWeek;
    }
    expect(actual).toEqual(prior);
  }
  // A new original is allowed only through the same numbered, paid, consumed material-kit producer.
  for (const craft of m.crafts.slice(previous.crafts.length)) {
    const number = Number(craft.id.replace('MM5-FLASH-', ''));
    expect(Number.isSafeInteger(number)).toBe(true); expect(number).toBeGreaterThan(previous.practice.kitsUsed);
    expect(number).toBeLessThanOrEqual(m.practice.kitsUsed); expect(craft.sourceKitId).toBe(`MM5-KIT-${number}`);
    expect(craft.createdWeek).toBeGreaterThanOrEqual(old.week);
    expect(craft.power).toBe(0.65 + 0.35 * (old.progression.mastery['reader.s5.material-imitation'] ?? 0) / 500);
  }
  expect(m.practice.kitsUsed).toBeGreaterThanOrEqual(previous.practice.kitsUsed);
  m.crafts = structuredClone(previous.crafts); m.practice.kitsUsed = previous.practice.kitsUsed; m.craftAttemptWeek = previous.craftAttemptWeek;
  expect(m).toEqual(previous);
}
const stageValidators = { validateReaderState, validateReasonerState, validateDetectiveState, validatePolymathState,
  validateMysticismMagisterState, validateProphetState, validateProphetRitualState, validateInsightScholarState, validateSeerState, validateWisdomAngelState };

describe('Wisdom Angel original423 living prefix, migration167 and shared runtime', () => {
  it('migrates the genuine survivor with every original field intact and no free medical treatment', () => {
    const original = readObjectEntry<SliceState>(insightScholarPeacefulFixturePath, 'final'), bytes = JSON.stringify(original), s = migrateSliceState(original);
    expect(s.schemaVersion).toBe(177); expect(s.contentVersion).toBe('blood-duke-v177');
    for (const key of Object.keys(original)) if (!['schemaVersion', 'contentVersion'].includes(key)) {
      const expected = (original as unknown as Record<string, unknown>)[key], actual = (s as unknown as Record<string, unknown>)[key];
      // Existing migrations may append defaults inside another stage, but cannot rewrite any old value.
      if (expected !== null && typeof expected === 'object') expect(actual, key).toMatchObject(expected);
      else expect(actual, key).toEqual(expected);
    }
    expect(s.wisdomAngel).toEqual(createWisdomAngelState()); expect(s.injuries).toHaveLength(1);
    expect(s.injuries[0]).toMatchObject({ severity: 'HEAVY', treatedRevision: null }); expect(s.injuryRisk).toBe(1);
    expect(JSON.stringify(original)).toBe(bytes); assertValidSliceState(s); expect(migrateSliceState(s)).toEqual(s);
  });
  it('replays all423 unchanged commands and every captured new choice under the original seed without directed rerolls', () => {
    const commands = readObjectEntry<SliceIntent[]>(wisdomAngelFixturePath, 'commands');
    const oldCommands = readObjectEntry<SliceIntent[]>(insightScholarPeacefulFixturePath, 'commands');
    expect(oldCommands).toHaveLength(423); expect(commands.slice(0, 423)).toEqual(oldCommands); expect(commands.length).toBeGreaterThan(423);
    expect(readObjectEntry<number>(wisdomAngelFixturePath, 'prefixCount')).toBe(423);
    expect(readObjectEntry<boolean>(wisdomAngelFixturePath, 'prefixVerified')).toBe(true);
    const seed = readObjectEntry<string>(wisdomAngelFixturePath, 'seed'); expect(seed).toBe('reader-natural-v023');
    expect(seed).toBe(readObjectEntry<string>(insightScholarPeacefulFixturePath, 'seed'));
    const inherited = migrateSliceState(readObjectEntry<unknown>(insightScholarPeacefulFixturePath, 'final'));
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(wisdomAngelFixturePath, 'creation');
    let s = createSliceRun(inherited.runId, creation, seed);
    for (const [index, intent] of commands.entries()) {
      expect(validateSlicePayload(intent), `command ${index + 1}`).toBe(true);
      const cursor = s.random.cursor, revision = s.revision; s = applySliceIntent(s, intent);
      expect(s.random.seed).toBe(seed); expect(s.random.cursor).toBeGreaterThanOrEqual(cursor); expect(s.revision).toBe(revision + 1); expect(s.weeklyBudget).toBe(3);
      if (index === 422) { expect(s).toEqual(inherited); expect(s).toEqual(wisdomAngelSnapshot('departureStart')); }
    }
    assertValidSliceState(s); expect(s).toEqual(wisdomAngelSnapshot('final'));
    expect(s.combat).toBeNull(); expect(s.wisdomAngel.encounter.terminal).not.toBeNull(); expectOriginalHistory(s, inherited);
    // The replay, not an expected happy ending, decides the terminal branch.
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); expect(s.wisdomAngel.encounter.terminal?.outcome).toBe('PLAYER_DEAD'); }
    else { expect(s.status).toBe('ACTIVE'); expect(s.health).toBeGreaterThan(0); expect(s.wisdomAngel.encounter.terminal?.outcome).not.toBe('PLAYER_DEAD'); }
  }, 120000);
  it('keeps the independent original425-command death branch dead and distinct from the living departure', () => {
    const death = readObjectEntry<SliceState>(insightScholarDeathFixturePath, 'final'), bytes = JSON.stringify(death);
    const deadCommands = readObjectEntry<SliceIntent[]>(insightScholarDeathFixturePath, 'commands');
    const livingCommands = readObjectEntry<SliceIntent[]>(insightScholarPeacefulFixturePath, 'commands');
    expect(deadCommands).toHaveLength(425); expect(livingCommands).toHaveLength(423); expect(livingCommands.slice(0, 421)).toEqual(deadCommands.slice(0, 421));
    expect(deadCommands[421]).toEqual({ type: 'INSIGHT_SCHOLAR', command: { type: 'ENCOUNTER_FIGHT' } });
    expect(livingCommands.slice(421)).toEqual([{ type: 'INSIGHT_SCHOLAR', command: { type: 'LEAVE_ENCOUNTER' } }, { type: 'ACTION', action: 'WORK' }]);
    expect(death).toMatchObject({ status: 'DEAD', health: 0, week: 106, spirituality: 111, random: { cursor: 209 }, ending: { kind: 'DEATH' } });
    const migrated = migrateSliceState(death); assertValidSliceState(migrated); expect(migrated.status).toBe('DEAD'); expect(migrated.wisdomAngel).toEqual(createWisdomAngelState());
    expect(() => applySliceIntent(migrated, { type: 'WISDOM_ANGEL', command: { type: 'LEARN_GUIDANCE' } })).toThrow();
    expect(JSON.stringify(death)).toBe(bytes); expect(wisdomAngelSnapshot('departureStart').status).toBe('ACTIVE');
  });
  it('replays complete boundaries one at a time and verifies each input remains untouched', () => {
    const names = wisdomAngelBoundaryNames(); expect(names.length).toBeGreaterThan(20); expect(new Set(names).size).toBe(names.length);
    const commands = new Set<string>();
    for (const key of names) {
      const b = wisdomAngelBoundary(key), bytes = JSON.stringify(b.beforeLast), intent = JSON.stringify(b.lastIntent);
      assertValidSliceState(b.beforeLast); assertValidSliceState(b.final); expect(validateSlicePayload(b.lastIntent), key).toBe(true);
      expect(applySliceIntent(b.beforeLast, b.lastIntent), key).toEqual(b.final);
      expect(JSON.stringify(b.beforeLast), key).toBe(bytes); expect(JSON.stringify(b.lastIntent), key).toBe(intent);
      if (b.lastIntent.type === 'WISDOM_ANGEL') commands.add(b.lastIntent.command.type);
    }
    for (const command of ['LEARN_GUIDANCE', 'PREPARE_TASK', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT']) expect(commands.has(command), command).toBe(true);
  }, 120000);
  it('actually discovers care, pays60 for the same old heavy injury and only later clears it through ordinary rest', () => {
    const old = wisdomAngelSnapshot('departureStart'); expect(old).toMatchObject({ week: 106, health: 100, injuryRisk: 1, cash: 640, actionsRemaining: 1 });
    const wound = old.injuries.find(i => i.severity === 'HEAVY' && i.treatedRevision === null)!; expect(wound).toBeDefined();
    const discovery = wisdomAngelBoundaryForIntent(i => i.type === 'ACTION' && i.action === 'INVESTIGATE' && i.targetId === 'CARE-ACCESS-01');
    expect(discovery.final.injuries).toEqual(discovery.beforeLast.injuries);
    const paid = wisdomAngelBoundaryForIntent(i => i.type === 'EVENT_CHOICE' && i.choiceId === 'PAY',
      b => b.beforeLast.injuries.some(i => i.id === wound.id && i.treatedRevision === null) && b.final.injuries.some(i => i.id === wound.id && i.treatedRevision !== null));
    expect(paid.beforeLast.cash - paid.final.cash).toBeGreaterThanOrEqual(60);
    expect(paid.final.injuries.find(i => i.id === wound.id)).toMatchObject({ severity: 'HEAVY', treatedRevision: paid.final.revision });
    const healed = wisdomAngelBoundaryForIntent(i => i.type === 'ACTION' && i.action === 'REST',
      b => b.beforeLast.injuries.some(i => i.id === wound.id && i.treatedRevision !== null) && !b.final.injuries.some(i => i.id === wound.id));
    expect(healed.final.injuries).toEqual([]); expect(healed.final.injuryRisk).toBe(0);
    expect(wisdomAngelSnapshot('guidanceStart').injuries).toEqual([]); expectOriginalHistory(healed.final, old);
  });
  it('naturally preserves exact17 old values, adds only two zero entries and freezes S3 digestion without refilling S120', () => {
    const s = wisdomAngelSnapshot('promoted'), old = wisdomAngelSnapshot('departureStart'), view = projectSliceState(s);
    expect(s.progression).toMatchObject({ pathwayId: 'white-tower', sequence: 2, acting: 0, promotionWeek: 5 });
    expect(s.wisdomAngel.insightScholarActingAtPromotion).toBe(100); expect(s.wisdomAngel.promotionWeek! - s.insightScholar.promotionWeek!).toBeGreaterThanOrEqual(12);
    expect(Object.keys(s.progression.mastery)).toHaveLength(19); expect(WISDOM_ANGEL_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id)).sort()).toEqual([...WISDOM_ANGEL_ABILITY_IDS].sort());
    expect(view.wisdomAngel.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort()); expect(new Set(view.wisdomAngel.abilities.map(a => a.id)).size).toBe(19);
    expect(view.wisdomAngel).toMatchObject({ formulaKnown: false, formula: [], promoted: true, currentGender: old.character.gender });
    expect(view.maxSpirituality).toBe(120); expect(view.wisdomAngel.resources).toMatchObject({ maxSpirituality: 120, spirituality: s.spirituality });
    expectOriginalHistory(s, old); expect(s.mysticismMagister).toEqual(old.mysticismMagister);
    const b = wisdomAngelBoundaryForIntent(i => i.type === 'WISDOM_ANGEL' && i.command.type === 'CONSUME', b => b.final.progression.sequence === 2);
    expect(b.final.spirituality).toBe(b.beforeLast.spirituality); expect(b.final.injuries).toEqual(b.beforeLast.injuries); expect(b.final.injuryRisk).toBe(b.beforeLast.injuryRisk);
    const outcome = b.final.wisdomAngel.bottles.find(bottle => ['SUCCESS', 'GREAT_SUCCESS'].includes(bottle.outcome ?? ''))!.outcome;
    expect(b.final.mind).toBe(b.beforeLast.mind - (outcome === 'GREAT_SUCCESS' ? 8 : 15));
    for (const bottle of s.wisdomAngel.bottles.filter(bottle => bottle.status === 'CONSUMED')) {
      expect(bottle.preparationWeek).toBe(bottle.consumedWeek); expect(bottle.acquiredWeek).not.toBeNull();
      expect(bottle.id).toMatch(/^wisdom-angel-potion-/); expect(bottle.source).not.toBe(s.insightScholar.bottles[0]!.source);
    }
  });
  it('validates all seven inherited stages, the old ritual and shared mastery at promoted, practiced and actual terminal states', () => {
    for (const checkpoint of ['promoted', 'practiced', 'final'] as const) {
      const s = wisdomAngelSnapshot(checkpoint); assertValidSliceState(s);
      for (const [name, validate] of Object.entries(stageValidators)) expect(validate(s), `${checkpoint}: ${name}`).toBe(true);
      const view = projectSliceState(s);
      for (const key of readingLegacyKeys) { expect(view[key].promoted, key).toBe(true); expect(view[key].acting, key).toBe(100); }
      expect(s.wisdomAngel.insightScholarActingAtPromotion).toBe(100);
    }
  });
  it('keeps exact current-stage legacy actions closed, including the old S3 inherited-craft front door', () => {
    const s = wisdomAngelSnapshot('promoted'), view = projectSliceState(s);
    expect(hasInsightScholarHistory(s)).toBe(true); expect(isInsightScholar(s)).toBe(false);
    expect(isInsightScholarCombat(s)).toBe(false); expect(currentInsightScholarCombatSource(s)).toBeNull();
    for (const key of readingLegacyKeys) expect(view[key].actions.filter(a => a.enabled), key).toEqual([]);
    const intents: SliceIntent[] = [
      { type: 'READER', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'REASONER', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'DETECTIVE', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'POLYMATH', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'MYSTICISM_MAGISTER', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'PROPHET', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'INSIGHT_SCHOLAR', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'READER', command: { type: 'READ', caseId: 'shift-ledger' } },
      { type: 'REASONER', command: { type: 'EXAMINE', caseId: 'stair-footprints' } },
      { type: 'DETECTIVE', command: { type: 'SURVEY', caseId: 'fallen-shelf' } },
      { type: 'POLYMATH', command: { type: 'OBSERVE', caseId: 'flash-study' } },
      { type: 'POLYMATH', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'MYSTICISM_MAGISTER', command: { type: 'OBSERVE', caseId: 'linked-dream' } },
      { type: 'MYSTICISM_MAGISTER', command: { type: 'MAKE_TOKEN' } },
      { type: 'PROPHET', command: { type: 'BOOK_RITUAL' } },
      { type: 'PROPHET', command: { type: 'OBSERVE', caseId: 'loose-shutter' } },
      { type: 'PROPHET', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'INSIGHT_SCHOLAR', command: { type: 'OBSERVE', caseId: 'copy-discrepancy' } },
      { type: 'INSIGHT_SCHOLAR', command: { type: 'PREPARE_PROMOTION' } },
      { type: 'INSIGHT_SCHOLAR', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'INSIGHT_SCHOLAR', command: { type: 'MAKE_INHERITED_FLASH' } },
    ];
    for (const intent of intents) {
      expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true); const before = JSON.stringify(s);
      expect(() => applySliceIntent(s, intent)).toThrow(); expect(JSON.stringify(s)).toBe(before);
    }
  });
  it('preserves Alton peacefully resolved, Harold actually injured and surrendered, original people, samples and depleted originals', () => {
    const s = wisdomAngelSnapshot('final'), old = wisdomAngelSnapshot('departureStart'); expectOriginalHistory(s, old);
    expect(s.insightScholar.encounter).toMatchObject({ targetId: 'IS3-ALTON', status: 'RESOLVED', attemptWeek: null, startHistoryIndex: null, terminal: null,
      enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', powerUses: { FLASH: 0, WARD: 0, FOCUS: 0 }, seenPowers: [] });
    expect(s.prophet.encounter.enemy).toMatchObject({ id: 'PF4-HAROLD', health: 70, mind: 100, status: 'SURRENDERED', weaponId: 'PF4-HAROLD-CLUB', weaponLocation: 'YARD' });
    expect(s.insightScholar.life.box).toMatchObject({ id: 'IS3-BOX', charges: 0, demonstrations: 2, location: 'OWNER' });
    expect(s.polymath.samples.FLASH.learnedWeek).toBe(42); expect(s.polymath.samples.FROST.learnedWeek).toBe(44); expect(s.polymath.samples.COURAGE.learnedWeek).toBe(45);
    expect(s.mysticismMagister.crafts[0]).toEqual(old.mysticismMagister.crafts[0]);
    expect(s.mysticismMagister.crafts[1]).toMatchObject({ id: 'MM5-FLASH-3', sourceKitId: 'MM5-KIT-3', createdWeek: 63, power: 0.65 });
    expect(s.wisdomAngel.encounter.targetId).toBe('WA2-VICTOR');
  });
  it('records the natural paid inherited FLASH attempt with its actual result and unchanged original objects', () => {
    const b = wisdomAngelBoundaryForIntent(i => i.type === 'WISDOM_ANGEL' && i.command.type === 'MAKE_INHERITED_FLASH');
    const before = b.beforeLast, after = b.final, prior = before.mysticismMagister, made = after.mysticismMagister;
    expect(before.progression.sequence).toBe(2); expect(before.polymath.samples.FLASH.learnedWeek).toBe(42);
    expect(before.cash - after.cash).toBeGreaterThanOrEqual(160); expect(made.practice.kitsUsed).toBe(prior.practice.kitsUsed + 1);
    expect(made.craftAttemptWeek).toBe(before.week); expect(after.lastCheck).toMatchObject({ ability: 'knowledge', difficulty: 16 });
    expect(after.progression.mastery).toEqual(before.progression.mastery); expect(after.progression.acting).toBe(before.progression.acting);
    expect(made.crafts.slice(0, prior.crafts.length)).toEqual(prior.crafts);
    const successful = ['SUCCESS', 'GREAT_SUCCESS'].includes(after.lastCheck!.tier);
    expect(made.crafts).toHaveLength(prior.crafts.length + (successful ? 1 : 0));
    if (successful) expect(made.crafts.at(-1)).toMatchObject({ id: `MM5-FLASH-${made.practice.kitsUsed}`,
      sourceKitId: `MM5-KIT-${made.practice.kitsUsed}`, createdWeek: before.week, usedWeek: null, status: 'PLAYER' });
    if (before.week === after.week) {
      expect(after.spirituality).toBe(before.spirituality - 4); expect(after.actionsRemaining).toBe(before.actionsRemaining - 1);
    }
  });
  it('derives natural practice mastery only from actual effects rather than assuming successful checks were applied', () => {
    const s = wisdomAngelSnapshot('practiced'), life = s.wisdomAngel.life;
    expect(s.progression.acting).toBe(100); expect(life.reflected).toBe(true); expect(life.activeCase).toBeNull(); expect(life.playerLocation).toBe('EXIT');
    for (const id of WISDOM_ANGEL_CASE_IDS) {
      const c = life.cases[id]; expect(c.status).toBe('RESOLVED'); expect(c.contactOpen).toBe(false); expect(c.returned).toBe(true);
      expect(c.attempts.length).toBeGreaterThan(0);
      for (const a of c.attempts) {
        expect(a.closed).toBe(true);
        for (const use of [a.synthesis, a.response]) { expect(use.successes).toBeLessThanOrEqual(use.attempts); expect(use.effects).toBeLessThanOrEqual(use.successes); }
      }
    }
    for (const [index, field] of (['synthesis', 'response'] as const).entries()) {
      const earned = WISDOM_ANGEL_CASE_IDS.reduce((total, id) => total + (life.cases[id].attempts.some(a => a[field].effects > 0) ? 8 : 0), 0);
      expect(s.progression.mastery[WISDOM_ANGEL_ABILITY_IDS[index]!]).toBe(earned);
    }
    for (const a of life.cases['withdrawn-consent'].attempts) expect([a.synthesis.effects, a.response.effects]).toEqual([0, 0]);
    expect(life.device.charges).toBe(0); expect(life.device.demonstrations).toBe(2);
    expect(life.papers.every(p => p.location === 'TABLE')).toBe(true); expect(life.device.location).toBe('TABLE');
    expectOriginalHistory(s, wisdomAngelSnapshot('departureStart'));
  });
  it('exposes the same old S3 and new S2 enemy arrays that their actual resolvers draw', () => {
    const old = migrateSliceState(readObjectEntry<unknown>(insightScholarDeathFixturePath, 'combatStart')), bytes = JSON.stringify(old), oldCombat = projectSliceState(old).combat!;
    expect(oldCombat.enemyCountWheel).toEqual(INSIGHT_SCHOLAR_ENEMY_COUNT_WHEEL); const oldLabels=["有限闪光：5S/75", "有限护术：4S/减45", "同一原棍：20×身体", "有限专注：4S/抵本轮下一次成功闪光或方法压力", "判断偏差：−22.5"];expect(INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL).toHaveLength(oldLabels.length);expect(oldCombat.enemyAbilityWheel).toEqual(INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:oldLabels[index]})));
    expect(oldCombat.enemyAbilityWheel.map(x => [x.id, x.weight])).toEqual([['FLASH', 35], ['WARD', 25], ['BODY_STRIKE', 20], ['FOCUS', 15], ['ACCIDENT', 5]]);
    expect(JSON.stringify(old)).toBe(bytes);
    const currentState=wisdomAngelSnapshot('combatStart'),currentBytes=JSON.stringify(currentState),current=projectSliceState(currentState).combat!;
    expect(current.enemyCountWheel).toEqual(WISDOM_ANGEL_ENEMY_COUNT_WHEEL); const currentLabels=["原有限闪光：7S/105", "原有限护术：6S/减60", "原棍普通打击：20×身体", "实际变换节奏：3S/每轮一次，当前条件版本+1并结束当前应对窗", "判断偏差：−22.5"];expect(WISDOM_ANGEL_ENEMY_ABILITY_WHEEL).toHaveLength(currentLabels.length);expect(current.enemyAbilityWheel).toEqual(WISDOM_ANGEL_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:currentLabels[index]})));
    expect(current.enemyCountWheel.map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]);expect(JSON.stringify(currentState)).toBe(currentBytes);
  });
  it.each([0, 31, 119, 120])('retains S%s with public/save cap120 and ordinary rest never clamps the current S2 to30', spirit => {
    const s = unitBudget(wisdomAngelSnapshot('promoted')); s.spirituality = spirit; assertValidSliceState(s);
    expect(projectSliceState(s).maxSpirituality).toBe(120); expect(projectSliceState(s).wisdomAngel.resources?.spirituality).toBe(spirit);
    expect(migrateSliceState(s).spirituality).toBe(spirit);
    const next = applySliceIntent(s, { type: 'ACTION', action: 'REST' }); expect(next.spirituality).toBeGreaterThanOrEqual(spirit);
    expect(next.spirituality).toBeLessThanOrEqual(120); if (spirit >= 119) expect(next.spirituality).toBe(120); assertValidSliceState(next);
    const invalid = structuredClone(s); invalid.spirituality = 121; expect(() => assertValidSliceState(invalid)).toThrow();
  });
  it('rejects altered historical digestion, source chronology, originals and new-stage shortcuts rather than repairing them', () => {
    const s = wisdomAngelSnapshot('practiced');
    const changes: ((t: SliceState) => void)[] = [
      t => { delete t.progression.mastery['reader.s3.method-analysis']; },
      t => { delete t.progression.mastery[WISDOM_ANGEL_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['reader.s1.unearned'] = 0; },
      t => { t.progression.mastery[WISDOM_ANGEL_ABILITY_IDS[0]] = 501; },
      t => { t.reasoner.readerActingAtPromotion = 99; }, t => { t.detective.reasonerActingAtPromotion = 99; },
      t => { t.polymath.detectiveActingAtPromotion = 99; }, t => { t.mysticismMagister.polymathActingAtPromotion = 99; },
      t => { t.prophet.mysticismMagisterActingAtPromotion = 99; }, t => { t.insightScholar.prophetActingAtPromotion = 99; },
      t => { t.wisdomAngel.insightScholarActingAtPromotion = 99; },
      t => { t.polymath.samples.FLASH.learnedWeek = t.polymath.samples.FLASH.observedWeek! - 1; },
      t => { t.mysticismMagister.crafts[1]!.sourceKitId = 'MM5-KIT-FREE'; },
      t => { t.mysticismMagister.crafts[0]!.status = 'PLAYER'; t.mysticismMagister.crafts[0]!.usedWeek = null; },
      t => { t.insightScholar.life.box.charges = 2; }, t => { t.insightScholar.life.reflected = false; },
      t => { t.insightScholar.encounter.status = 'READY'; },
      t => { t.prophet.encounter.enemy.health = 100; t.prophet.encounter.enemy.status = 'RESISTING'; },
      t => { t.prophet.ritual.visits.find(v => v.kit.status === 'CONSUMED')!.kit.status = 'SEALED'; },
      t => { t.wisdomAngel.life.reflected = false; }, t => { t.progression.sequence = 1; }, t => { t.progression.pathwayId = 'diviner'; },
    ];
    for (const [index, change] of changes.entries()) { const t = structuredClone(s); change(t); expect(() => assertValidSliceState(t), `tamper ${index + 1}`).toThrow(); }
  });
});
