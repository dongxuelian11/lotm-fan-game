import { playerText } from '../../src/shared/player-text.js';
import { FRENZY_MAGE_FORMULA_STATUS, FRENZY_MAGE_SOURCE_STATUS } from '../../src/domain/frenzy-mage/content.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createFrenzyMageState, hasFrenzyMageLock } from '../../src/domain/frenzy-mage/index.js';
import { FRENZY_MAGE_ABILITY_IDS } from '../../src/domain/frenzy-mage/types.js';
import { createFrenzyMageLifeState, FRENZY_MAGE_CASE_IDS } from '../../src/domain/frenzy-mage/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  prepared: SliceState; promoted: SliceState; practiced: SliceState; combatStart: SliceState; final: SliceState;
}
interface Original { creation: Parameters<typeof createSliceRun>[1]; seed: string; commands: SliceIntent[]; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/fallen-earl-v01360/natural.json', 'utf8'));
function capture(): Capture {
  const c: Capture = JSON.parse(readFileSync('tests/fixtures/frenzy-mage-v01590/natural.json', 'utf8'));
  for (const key of ['prepared', 'promoted', 'practiced', 'combatStart', 'final'] as const) c[key] = migrateSliceState(c[key]);
  return c;
}
const boundaries = (): Record<string, Boundary> => JSON.parse(readFileSync('tests/fixtures/frenzy-mage-v01590/boundaries.json', 'utf8'));
const immutableRoots = ['lawyer', 'barbarian', 'corruptionBaron', 'mentorDisorder', 'fallenEarl'] as const;
function expectOriginals(s: SliceState, before: SliceState, preserveGifts = false) {
  for (const root of immutableRoots) expect(s[root]).toEqual(before[root]);
  const { gifts, ...briber } = s.briber, { gifts: oldGifts, ...oldBriber } = before.briber;
  expect(briber).toEqual(oldBriber); expect(gifts.map(g => g.id)).toEqual(oldGifts.map(g => g.id));
  if (preserveGifts) expect(gifts).toEqual(oldGifts);
  for (const oldGift of oldGifts) {
    const gift = gifts.find(g => g.id === oldGift.id)!;
    if (oldGift.location === 'GIVEN' || gift.location === 'PLAYER') expect(gift).toEqual(oldGift);
    else {
      expect(gift).toMatchObject({ location: 'GIVEN', destination: 'BATTLE:FRENZY_MAGE_DISPUTE:GROUND' });
      expect(gift.givenWeek).toBeGreaterThanOrEqual(s.frenzyMage.promotionWeek!); expect(gift.givenWeek).toBeLessThanOrEqual(s.week);
    }
  }
  expect(s.character.age).toBe(before.character.age); expect(s.character.gender).toBe(before.character.gender);
  expect(s.runId).toBe(before.runId); expect(s.random.seed).toBe(before.random.seed);
  expect(s.fallenEarl.encounter).toMatchObject({ targetId: 'FE4-MARLOW-VENN', enemyStatus: 'DEAD', enemyHealth: 0, enemyMind: 100, enemySpirituality: 8, powerUses: { ARC_BOLT: 4, WARD: 1, COMPOSE: 3 } });
  expect(s.fallenEarl.encounter.enemyInjuries.map(i => i.severity)).toEqual(['LIGHT']);
  expect(s.fallenEarl.life.crate).toMatchObject({ id: 'FE4-CRATE-1', owner: 'GUIDE', holder: 'GUIDE', positionMetres: 0 });
  expect(s.fallenEarl.life.pad).toMatchObject({ id: 'FE4-PAD-1', holder: 'GUIDE', bodyState: 'GROUNDED', remainingSeconds: 0 });
  expect(s.fallenEarl.life.clerk).toMatchObject({ person: 'ORIGINAL_EVE', consented: false, effect: 'NONE', remainingSeconds: 0 });
}

describe('FrenzyMage public continuation with the same originals and no new inventory', () => {
  it('replays all438 original commands and every new public command from the unchanged original seed', () => {
    const c = capture(), old = original(); expect(old.commands).toHaveLength(438); expect(c.prefixCount).toBe(438);
    expect(c.commands.length).toBeGreaterThan(438); expect(c.commands.slice(0, 438)).toEqual(old.commands);
    expect(c.creation).toEqual(old.creation); expect(c.seed).toBe('lawyer-natural-v063'); expect(c.seed).toBe(old.seed);
    let s = createSliceRun(c.final.runId, c.creation, c.seed);
    for (const [index, command] of c.commands.entries()) { s = applySliceIntent(s, command); if (index === 437) expect(s).toEqual(migrateSliceState(old.final)); }
    expect(s).toEqual(c.final); assertValidSliceState(s); expectOriginals(s, old.final);
  }, 30_000);
  it('migrates W115 without changing original resources, six roots, corpse history or next RNG', () => {
    const old = original().final, bytes = JSON.stringify(old), s = migrateSliceState(old);
    expect(s.schemaVersion).toBe(177); expect(s.contentVersion).toBe('blood-duke-v177'); expect(s.frenzyMage).toEqual(createFrenzyMageState());
    expect(s).toMatchObject({ week: 115, status: 'ACTIVE', health: 70, mind: 100, spirituality: 116, cash: 300, actionsRemaining: 2, progression: { sequence: 4, acting: 100 }, random: { seed: 'lawyer-natural-v063', cursor: 184 } });
    expect(s.character.coreStats).toEqual({ physique: 27, perception: 21, will: 23, knowledge: 21 }); expect(s.fallenEarl.promotionWeek).toBe(108);
    expect(s.briber.gifts).toHaveLength(15); expect(s.briber.gifts.slice(0, 10).every(g => g.location === 'GIVEN')).toBe(true);
    expect(s.briber.gifts.slice(10).every(g => g.location === 'PLAYER' && g.destination === null && g.givenWeek === null)).toBe(true);
    for (const [key, value] of Object.entries(old)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key]).toEqual(value);
    expectOriginals(s, old, true); expect(JSON.stringify(old)).toBe(bytes); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  });
  it('preserves every original and old mastery at promotion, adding only one zero mastery and no gift', () => {
    const s = capture().promoted, old = original().final; assertValidSliceState(s); expectOriginals(s, old, true);
    expect(s.progression).toMatchObject({ pathwayId: 'black-emperor', sequence: 3, acting: 0 }); expect(s.frenzyMage.fallenEarlActingAtPromotion).toBe(100);
    expect(s.frenzyMage.promotionWeek! - s.fallenEarl.promotionWeek!).toBeGreaterThanOrEqual(12);
    for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...FRENZY_MAGE_ABILITY_IDS]);
    expect(s.progression.mastery['black-emperor.s3.ordered-deviation']).toBe(0);
    expect(s.frenzyMage.life).toEqual(createFrenzyMageLifeState()); expect(Object.hasOwn(s.frenzyMage, 'gifts')).toBe(false); expect(Object.hasOwn(s.frenzyMage, 'luck')).toBe(false);
    const view = projectSliceState(s); expect(view.maxSpirituality).toBe(120); expect(view.fallenEarl.acting).toBe(100); expect(view.mentorDisorder.acting).toBe(100);
    expect(view.frenzyMage).toMatchObject({ promoted: true, formulaKnown: false, formula: [] });
    expect(view.frenzyMage.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
    for (const text of ['FE4-MARLOW-VENN', 'DEAD', '原伤势1处', '唯一briber.gifts', 'BATTLE:FALLEN_EARL_DISPUTE:GROUND']) expect(view.frenzyMage.inheritedHistory.join(' ')).toContain(text);
    const authoredStory = `${FRENZY_MAGE_FORMULA_STATUS}${FRENZY_MAGE_SOURCE_STATUS}`;
    for (const text of ['L58310', 'L58322', '序列2熵之公爵', '尚未披露', '均为原创G']) expect(authoredStory).toContain(text);
    expect(view.frenzyMage.story).toBe(playerText(authoredStory));
    for (const text of ['L58310', 'L58322', '均为原创G']) expect(view.frenzyMage.story).not.toContain(text);
    for (const text of ['狂乱法师3、熵之公爵2、弑序亲王1', '仍须完成服药准备', '三项专业准备和当周房间检查仍须完成', '不开放自制魔药', '30秒窗口', '不追改既发事实、不传送、不替代独立心智', '原马洛永久死亡', '没有新礼物池、幸运池、召回或复制']) expect(view.frenzyMage.story).toContain(text);
    const b = Object.values(boundaries()).find(b => b.lastIntent.type === 'FRENZY_MAGE' && b.lastIntent.command.type === 'CONSUME' && b.beforeLast.progression.sequence === 4 && b.final.progression.sequence === 3)!;
    expect(b).toBeTruthy(); expect(s.spirituality).toBe(b.beforeLast.spirituality); expect(s.health).toBe(b.beforeLast.health);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(Math.min(500, b.beforeLast.character.coreStats[stat] + 1));
  });
  it('replays every actual save boundary atomically without mutating input or prior history', () => {
    const saved = Object.values(boundaries()); expect(saved.length).toBeGreaterThan(0);
    for (const b of saved) {
      const before = migrateSliceState(b.beforeLast), expected = migrateSliceState(b.final), input = JSON.stringify(before), intent = JSON.stringify(b.lastIntent);
      assertValidSliceState(before); assertValidSliceState(expected); expect(applySliceIntent(before, b.lastIntent)).toEqual(expected);
      expect(JSON.stringify(before)).toBe(input); expect(JSON.stringify(b.lastIntent)).toBe(intent); expect(migrateSliceState(expected)).toEqual(expected); expectOriginals(expected, original().final);
    }
  }, 30_000);
  it('finishes three honest reports without assuming that paid checks all succeed', () => {
    const s = capture().practiced, life = s.frenzyMage.life; assertValidSliceState(s); expectOriginals(s, original().final, true);
    expect(s.progression).toMatchObject({ pathwayId: 'black-emperor', sequence: 3, acting: 100 }); expect(Object.keys(life.cases)).toEqual([...FRENZY_MAGE_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(life).toMatchObject({ reflected: true, playerLocation: 'START', activeCase: null }); expect(hasFrenzyMageLock(s)).toBe(false);
    expect(projectSliceState(s).frenzyMage.digestion).toContain('和平100不保证安全消化');
    expect(Object.hasOwn(life, 'luck')).toBe(false); expect(Object.hasOwn(s.frenzyMage, 'gifts')).toBe(false);
    expect(s.progression.mastery['black-emperor.s3.ordered-deviation']).toBeLessThanOrEqual(16);
    expect(s.progression.mastery['black-emperor.s3.ordered-deviation']! % 8).toBe(0);
  });
  it('records each real original-bottle outcome after a separate same-week140 preparation', () => {
    const s = capture().promoted;
    expect(s.frenzyMage.bottles.filter(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')).toHaveLength(1);
    for (const b of s.frenzyMage.bottles.filter(b => b.status === 'CONSUMED')) {
      expect(b.preparationWeek).toBe(b.consumedWeek); expect(b.acquiredWeek).not.toBeNull(); expect(b.id).toMatch(/^frenzy-mage-potion-/);
      expect(b.consumedWeek).toBeGreaterThanOrEqual(s.fallenEarl.promotionWeek! + 12); expect(b.consumedWeek).toBeLessThanOrEqual(s.frenzyMage.promotionWeek!);
    }
    expect(s.frenzyMage.preparedWeek).toBeNull(); expect(s.frenzyMage.preparations).toHaveLength(3);
  });
  it('shows only the purchased original bottle in the ordinary bag and removes only the consumed bottle', () => {
    const all = Object.values(boundaries()), purchase = all.find(b => b.lastIntent.type === 'FRENZY_MAGE' && b.lastIntent.command.type === 'BUY_POTION')!;
    expect(purchase).toBeTruthy(); const before = migrateSliceState(purchase.beforeLast), after = migrateSliceState(purchase.final);
    const id = purchase.lastIntent.type === 'FRENZY_MAGE' && 'bottleId' in purchase.lastIntent.command ? purchase.lastIntent.command.bottleId : '';
    expect(projectSliceState(before).town.items.some(item => item.id === id)).toBe(false); expect(projectSliceState(after).town.items.filter(item => item.id === id)).toHaveLength(1);
    const dose = all.find(b => b.lastIntent.type === 'FRENZY_MAGE' && b.lastIntent.command.type === 'CONSUME' && b.lastIntent.command.bottleId === id)!;
    expect(dose).toBeTruthy(); expect(projectSliceState(migrateSliceState(dose.final)).town.items.some(item => item.id === id)).toBe(false);
  });
  it('rejects old-stage commands after promotion without reviving Marlow or reopening old bottles', () => {
    const s = capture().promoted, bytes = JSON.stringify(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'BUY_GIFTS' }, { type: 'CONSUME', bottleId: s.fallenEarl.bottles[0]!.id, confirmed: true }, { type: 'OBSERVE', caseId: 'willing-pause' }] as const) expect(() => applySliceIntent(s, { type: 'FALLEN_EARL', command })).toThrow();
    expect(() => applySliceIntent(s, { type: 'BRIBER', command: { type: 'BUY_GIFTS' } })).toThrow();
    expect(JSON.stringify(s)).toBe(bytes); expectOriginals(s, original().final, true);
  });
  it('retains optional-combat results honestly without promising victory or survival', () => {
    const s = capture().final, old = original().final; assertValidSliceState(s); expectOriginals(s, old); expect(s.combat).toBeNull();
    expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    const encounter = s.frenzyMage.encounter; expect(encounter.targetId).toBe('FM3-ALDEN'); expect(encounter.enemySpirituality).toBeLessThanOrEqual(120);
    expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.ARC_BOLT * 5 - encounter.powerUses.WARD * 4 - encounter.powerUses.COMPOSE * 4);
    expect(s.progression.mastery['black-emperor.s3.ordered-deviation']).toBe(capture().practiced.progression.mastery['black-emperor.s3.ordered-deviation']);
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); expect(() => applySliceIntent(s, { type: 'FRENZY_MAGE', command: { type: 'PREPARE_PROMOTION' } })).toThrow(); }
    else { expect(s.status).toBe('ACTIVE'); expect(s.health).toBeGreaterThan(0); expect(hasFrenzyMageLock(s)).toBe(false); }
    expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});
