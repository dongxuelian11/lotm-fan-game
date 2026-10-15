import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createThreeHeadedTemplarState, hasThreeHeadedTemplarLock } from '../../src/domain/three-headed-templar/index.js';
import { THREE_HEADED_TEMPLAR_ABILITY_IDS } from '../../src/domain/three-headed-templar/types.js';
import { createThreeHeadedTemplarLifeState, THREE_HEADED_TEMPLAR_CASE_IDS } from '../../src/domain/three-headed-templar/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  initial: SliceState; guidanceStart: SliceState; prepared: SliceState; promoted: SliceState;
  practiced: SliceState; combatStart: SliceState; beforeLast: SliceState; final: SliceState;
}
interface Original { creation: Parameters<typeof createSliceRun>[1]; seed: string; commands: SliceIntent[]; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/black-knight-v01320/natural.json', 'utf8'));
function capture(): Capture {
  const c: Capture = JSON.parse(readFileSync('tests/fixtures/three-headed-templar-v01550/natural.json', 'utf8'));
  for (const key of ['initial', 'guidanceStart', 'prepared', 'promoted', 'practiced', 'combatStart', 'beforeLast', 'final'] as const) c[key] = migrateSliceState(c[key]);
  return c;
}
const boundaries = (): Record<string, Boundary> => JSON.parse(readFileSync('tests/fixtures/three-headed-templar-v01550/boundaries.json', 'utf8'));
const roots = ['secretSupplicant', 'listener', 'shadowAscetic', 'roseBishop', 'shepherd', 'blackKnight'] as const;
function expectOriginals(s: SliceState, before: SliceState, allowReserveSpend = false) {
  for (const root of roots) {
    if (root !== 'roseBishop' || !allowReserveSpend) expect(s[root]).toEqual(before[root]);
    else {
      const { reserve: actual, ...a } = s.roseBishop, { reserve: old, ...b } = before.roseBishop;
      expect(a).toEqual(b); expect({ ...actual, points: old.points }).toEqual(old);
      expect(actual.points).toBeGreaterThanOrEqual(0); expect(actual.points).toBeLessThanOrEqual(old.points);
    }
  }
  expect(s.character.age).toBe(before.character.age); expect(s.character.gender).toBe(before.character.gender);
  expect(s.runId).toBe(before.runId); expect(s.random.seed).toBe(before.random.seed);
  expect(s.shepherd.grazing.spirits.find(spirit => spirit.id === 'SH5-CEDRIC-1')).toMatchObject({ status: 'RELEASED', releasedWeek: 64 });
  expect(s.shepherd.grazing).toMatchObject({ activeSpiritId: 'SH5-IRIS-1' });
  expect(s.shepherd.grazing.spirits.find(spirit => spirit.id === 'SH5-IRIS-1')).toMatchObject({ status: 'GRAZED', selectedAbilities: ['light-touch', 'brief-ward', 'blur-mark'] });
  expect(s.blackKnight.life.shade).toMatchObject({ creatureId: 'BK4-SHADE-1', status: 'ISOLATED', controlled: false, roomStatus: 'QUARANTINED', emergencySealUsed: true });
  expect(s.blackKnight.encounter).toMatchObject({ targetId: 'BK4-GARRICK-NOLL', enemyStatus: 'SURRENDERED', enemyHealth: 40, enemyMind: 100, enemySpirituality: 5 });
  expect(s.blackKnight.encounter.enemyInjuries).toHaveLength(4);
}

describe('Three Headed Templar actual public continuation from preserved Black Knight history', () => {
  it('replays creation, all339 original commands and every new public command with the original seed and untouched prefix', () => {
    const c = capture(), old = original(); expect(old.commands).toHaveLength(339); expect(c.prefixCount).toBe(339);
    expect(c.commands.length).toBeGreaterThan(339); expect(c.commands.slice(0, 339)).toEqual(old.commands);
    expect(c.creation).toEqual(old.creation); expect(c.seed).toBe('secret-supplicant-natural-v051'); expect(c.seed).toBe(old.seed);
    let s = createSliceRun(c.final.runId, c.creation, c.seed);
    for (const [index, command] of c.commands.entries()) { s = applySliceIntent(s, command); if (index === 338) expect(s).toEqual(migrateSliceState(old.final)); }
    expect(s).toEqual(c.final); assertValidSliceState(s); expectOriginals(s, old.final, true);
  }, 30_000);
  it('migrates the actual W90 save without changing resources, original roots or next RNG', () => {
    const old = original().final, bytes = JSON.stringify(old), s = migrateSliceState(old);
    expect(s.schemaVersion).toBe(176); expect(s.contentVersion).toBe('elder-v176'); expect(s.threeHeadedTemplar).toEqual(createThreeHeadedTemplarState());
    expect(s).toMatchObject({ week: 90, status: 'ACTIVE', health: 90, mind: 100, spirituality: 115, cash: 920, actionsRemaining: 3, progression: { sequence: 4, acting: 100 }, random: { seed: 'secret-supplicant-natural-v051', cursor: 222 } });
    for (const [key, value] of Object.entries(old)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key]).toEqual(value);
    expectOriginals(s, old); expect(JSON.stringify(old)).toBe(bytes); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  });
  it('preserves each old mastery and original at S3 promotion and adds exactly one zero mastery without gifting spirits', () => {
    const s = capture().promoted, old = original().final; assertValidSliceState(s); expectOriginals(s, old);
    expect(s.progression).toMatchObject({ pathwayId: 'hanged-man', sequence: 3, acting: 0 }); expect(s.threeHeadedTemplar.blackKnightActingAtPromotion).toBe(100);
    expect(s.threeHeadedTemplar.promotionWeek! - s.blackKnight.promotionWeek!).toBeGreaterThanOrEqual(12);
    for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...THREE_HEADED_TEMPLAR_ABILITY_IDS]);
    expect(s.progression.mastery['hanged-man.s3.multiple-release']).toBe(0); expect(s.threeHeadedTemplar.life).toEqual(createThreeHeadedTemplarLifeState());
    expect(s.threeHeadedTemplar.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'THT3-BRAM', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    const view = projectSliceState(s); expect(view.maxSpirituality).toBe(120); expect(view.blackKnight.acting).toBe(100);
    expect(view.threeHeadedTemplar.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
    expect(view.threeHeadedTemplar).toMatchObject({ promoted: true, formulaKnown: false, formula: [] });
    for (const text of ['SH5-CEDRIC-1', 'RELEASED', 'SH5-IRIS-1', 'ISOLATED', 'BK4-GARRICK-NOLL']) expect(view.threeHeadedTemplar.inheritedHistory.join(' ')).toContain(text);
    const promotion = Object.values(boundaries()).find(b => b.lastIntent.type === 'THREE_HEADED_TEMPLAR' && b.lastIntent.command.type === 'CONSUME' && b.beforeLast.progression.sequence === 4 && b.final.progression.sequence === 3);
    expect(promotion).toBeTruthy(); expect(s.spirituality).toBe(promotion!.beforeLast.spirituality); expect(s.health).toBe(promotion!.beforeLast.health);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(Math.min(500, promotion!.beforeLast.character.coreStats[stat] + 1));
  });
  it('replays every actual save boundary atomically without changing input states or original histories', () => {
    const saved = Object.values(boundaries()); expect(saved.length).toBeGreaterThan(0);
    for (const b of saved) {
      const before = migrateSliceState(b.beforeLast), expected = migrateSliceState(b.final), input = JSON.stringify(before), intent = JSON.stringify(b.lastIntent);
      assertValidSliceState(before); assertValidSliceState(expected); expect(applySliceIntent(before, b.lastIntent)).toEqual(expected);
      expect(JSON.stringify(before)).toBe(input); expect(JSON.stringify(b.lastIntent)).toBe(intent); expect(migrateSliceState(expected)).toEqual(expected); expectOriginals(expected, original().final, true);
    }
  }, 30_000);
  it('finishes three real reports and reflection without asserting that natural grazing or externalization succeeded', () => {
    const s = capture().practiced, life = s.threeHeadedTemplar.life; assertValidSliceState(s); expectOriginals(s, original().final);
    expect(s.progression).toMatchObject({ pathwayId: 'hanged-man', sequence: 3, acting: 100 }); expect(Object.keys(life.cases)).toEqual([...THREE_HEADED_TEMPLAR_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(life).toMatchObject({ reflected: true, playerLocation: 'START', activeCase: null }); expect(hasThreeHeadedTemplarLock(s)).toBe(false);
    expect(life.clockSeconds).toBeGreaterThan(0);
    const actualAbilityReports = Object.values(life.cases).filter(scene => scene.result === 'ABILITY').length;
    expect(s.progression.mastery['hanged-man.s3.multiple-release']).toBe(actualAbilityReports * 8);
    const summaries = projectSliceState(s).threeHeadedTemplar.inheritedHistory.join(' ');
    expect(summaries).toContain('永久释放'); expect(summaries).toContain('ISOLATED');
  });
  it('does not reopen old S4 dosing, original Garrick combat or create a controlled version of the isolated shadow', () => {
    const s = capture().promoted, bytes = JSON.stringify(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'CONSUME', bottleId: s.blackKnight.bottles[0]!.id, confirmed: true }, { type: 'SPAWN_SHADE', confirmed: true, acknowledgedUrge: '想为快速获胜忽视原灵界限' }] as const) expect(() => applySliceIntent(s, { type: 'BLACK_KNIGHT', command })).toThrow();
    expect(JSON.stringify(s)).toBe(bytes); expect(s.blackKnight.life.shade.controlled).toBe(false); expectOriginals(s, original().final);
  });
  it('retains the independent opponent and actual optional-combat terminal without assuming victory or survival', () => {
    const s = capture().final, old = original().final; assertValidSliceState(s); expectOriginals(s, old, true); expect(s.combat).toBeNull();
    expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    const encounter = s.threeHeadedTemplar.encounter, rounds = s.combatHistory.filter(r => r.threeHeadedTemplarOutcome);
    expect(encounter.targetId).toBe('THT3-BRAM'); expect(encounter.enemySpirituality).toBeLessThanOrEqual(120);
    if (rounds.length > 0) expect(encounter.terminal).not.toBeNull();
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); expect(() => applySliceIntent(s, { type: 'THREE_HEADED_TEMPLAR', command: { type: 'PREPARE_PROMOTION' } })).toThrow(); }
    else { expect(s.status).toBe('ACTIVE'); expect(s.health).toBeGreaterThan(0); expect(hasThreeHeadedTemplarLock(s)).toBe(false); }
  });
});
