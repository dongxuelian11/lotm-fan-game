import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { playerText } from '../../src/shared/player-text.js';
import { COFFIN_BEARER_FORMULA_STATUS, COFFIN_BEARER_SOURCE_STATUS } from '../../src/domain/coffin-bearer/content.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createCoffinBearerState, hasCoffinBearerLock } from '../../src/domain/coffin-bearer/index.js';
import { COFFIN_BEARER_ABILITY_IDS } from '../../src/domain/coffin-bearer/types.js';
import { createCoffinBearerLifeState, COFFIN_BEARER_CASE_IDS } from '../../src/domain/coffin-bearer/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  prepared: SliceState; promoted: SliceState; practiced: SliceState; combatStart: SliceState; final: SliceState;
}
interface Original { creation: Parameters<typeof createSliceRun>[1]; seed: string; commands: SliceIntent[]; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/ancient-alchemist-v01380/natural.json', 'utf8'));
function capture(): Capture {
  const c: Capture = JSON.parse(readFileSync('tests/fixtures/coffin-bearer-v01610/natural.json', 'utf8'));
  for (const key of ['prepared', 'promoted', 'practiced', 'combatStart', 'final'] as const) c[key] = migrateSliceState(c[key]);
  return c;
}
const boundaries = (): Record<string, Boundary> => JSON.parse(readFileSync('tests/fixtures/coffin-bearer-v01610/boundaries.json', 'utf8'));
const immutableRoots = ['cultivator', 'physician', 'harvestpriest', 'biologist', 'druid', 'ancientAlchemist'] as const;
function expectOriginals(s: SliceState, before: SliceState) {
  for (const root of immutableRoots) expect(s[root]).toEqual(before[root]);
  expect(s.character.age).toBe(before.character.age); expect(s.character.gender).toBe(before.character.gender);
  expect(s.runId).toBe(before.runId); expect(s.random.seed).toBe(before.random.seed);
  expect(s.ancientAlchemist.encounter).toMatchObject({ targetId: 'AA4-OSRIC-VALE', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 24, enemyRisk: 0, guardAttempts: 0, powerUses: { ARC_BOLT: 2, WARD: 2, COMPOSE: 0 } });
  expect(s.ancientAlchemist.encounter.enemyInjuries.map(i => i.severity)).toEqual(['HEAVY']);
  expect(s.ancientAlchemist.life.stem).toMatchObject({ id: 'AA4-STEM-1', potId: 'AA4-POT-1', holder: 'GUIDE', living: true });
  expect(s.ancientAlchemist.life.record).toMatchObject({ id: 'AA4-RECORD-1', holder: 'NORA' });
  expect(s.ancientAlchemist.life.guards[0]!.segments.every(segment => segment.spentWeek === null)).toBe(true);
}

describe('CoffinBearer public continuation with the same old originals and explicitly purchased new originals', () => {
  it('replays all483 original commands and every new public command from the unchanged original seed', () => {
    const c = capture(), old = original(); expect(old.commands).toHaveLength(483); expect(c.prefixCount).toBe(483);
    expect(c.commands.length).toBeGreaterThan(483); expect(c.commands.slice(0, 483)).toEqual(old.commands);
    expect(c.creation).toEqual(old.creation); expect(c.seed).toBe('cultivator-natural-v069'); expect(c.seed).toBe(old.seed);
    let s = createSliceRun(c.final.runId, c.creation, c.seed);
    for (const [index, command] of c.commands.entries()) { s = applySliceIntent(s, command); if (index === 482) expect(s).toEqual(migrateSliceState(old.final)); }
    expect(s).toEqual(c.final); assertValidSliceState(s); expectOriginals(s, old.final);
  }, 30_000);
  it('migrates W130 without changing original resources, six roots, original Osric history or next RNG', () => {
    const old = original().final, bytes = JSON.stringify(old), s = migrateSliceState(old);
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION); expect(s.contentVersion).toBe(CURRENT_CONTENT_VERSION); expect(s.coffinBearer).toEqual(createCoffinBearerState());
    expect(s).toMatchObject({ week: 130, status: 'ACTIVE', health: 90, mind: 100, spirituality: 120, cash: 225, actionsRemaining: 1, progression: { sequence: 4, acting: 100 }, random: { seed: 'cultivator-natural-v069', cursor: 136 } });
    expect(s.character.coreStats).toEqual({ physique: 26, perception: 22, will: 21, knowledge: 22 }); expect(s.ancientAlchemist.promotionWeek).toBe(119);
    for (const [key, value] of Object.entries(old)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key]).toEqual(value);
    expectOriginals(s, old); expect(JSON.stringify(old)).toBe(bytes); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  });
  it('preserves every original and old mastery at promotion, adding only one zero mastery and no gift', () => {
    const s = capture().promoted, old = original().final; assertValidSliceState(s); expectOriginals(s, old);
    expect(s.progression).toMatchObject({ pathwayId: 'mother', sequence: 3, acting: 0 }); expect(s.coffinBearer.ancientAlchemistActingAtPromotion).toBe(100);
    expect(s.coffinBearer.promotionWeek! - s.ancientAlchemist.promotionWeek!).toBeGreaterThanOrEqual(12);
    for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...COFFIN_BEARER_ABILITY_IDS]);
    expect(s.progression.mastery['mother.s3.finite-preservation']).toBe(0);
    expect(s.coffinBearer.life).toEqual(createCoffinBearerLifeState()); expect(Object.hasOwn(s.coffinBearer, 'gifts')).toBe(false); expect(Object.hasOwn(s.coffinBearer, 'luck')).toBe(false);
    const view = projectSliceState(s); expect(view.maxSpirituality).toBe(120); expect(view.ancientAlchemist.acting).toBe(100); expect(view.druid.acting).toBe(100);
    expect(view.coffinBearer).toMatchObject({ promoted: true, formulaKnown: false, formula: [] });
    expect(view.coffinBearer.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
    for (const text of ['AA4-OSRIC-VALE', 'SURRENDERED', '原伤势1处', '轻伤0', '重伤1', 'AA4-STEM-1', 'AA4-RECORD-1']) expect(view.coffinBearer.inheritedHistory.join(' ')).toContain(text);
    const authoredStory = `${COFFIN_BEARER_FORMULA_STATUS}${COFFIN_BEARER_SOURCE_STATUS}`;
    for (const text of ['L231911', '序列2荒芜主母', '序列1自然行者', '尚未披露', '均为原创G']) expect(authoredStory).toContain(text);
    expect(view.coffinBearer.story).toBe(playerText(authoredStory));
    for (const text of ['L231911', '均为原创G']) expect(view.coffinBearer.story).not.toContain(text);
    for (const text of ['抬棺人3、荒芜主母2、自然行者1', '仍须完成服药准备', '不开放自制魔药', '不能复活、造魂、操纵死人或免于死亡', '仅减慢当前仍活样本本次有限暴露的衰减', '不增加活性、治疗、改死亡或证明永久保全', '新CB3-GUARD必须以新原材料另外实际制作，其三段不自动补充']) expect(view.coffinBearer.story).toContain(text);
    const b = Object.values(boundaries()).find(b => b.lastIntent.type === 'COFFIN_BEARER' && b.lastIntent.command.type === 'CONSUME' && b.beforeLast.progression.sequence === 4 && b.final.progression.sequence === 3)!;
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
    const s = capture().practiced, life = s.coffinBearer.life; assertValidSliceState(s); expectOriginals(s, original().final);
    expect(s.progression).toMatchObject({ pathwayId: 'mother', sequence: 3, acting: 100 }); expect(Object.keys(life.cases)).toEqual([...COFFIN_BEARER_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(life).toMatchObject({ reflected: true, playerLocation: 'START', activeCase: null }); expect(hasCoffinBearerLock(s)).toBe(false);
    expect(projectSliceState(s).coffinBearer.digestion).toContain('和平100不保证安全消化');
    expect(Object.hasOwn(life, 'luck')).toBe(false); expect(Object.hasOwn(s.coffinBearer, 'gifts')).toBe(false);
    expect(s.progression.mastery['mother.s3.finite-preservation']).toBeLessThanOrEqual(8);
    expect(s.progression.mastery['mother.s3.finite-preservation']! % 8).toBe(0);
  });
  it('retains distinct real samples, original records and paid materials through actual handoff and withdrawal', () => {
    const s = capture().practiced, life = s.coffinBearer.life;
    expect(life.samples.map(sample => sample.id)).toEqual(['CB3-LIVE-1', 'CB3-LIVE-2', 'CB3-DRY-1']);
    expect(life.paper).toMatchObject({ id: 'CB3-RECORD', holder: 'OWNER', location: 'A', sampleIds: ['CB3-LIVE-1', 'CB3-LIVE-2', 'CB3-DRY-1'] });
    // Handover counts include owner→player pickup and the later recipient/owner transfer.
    expect(life.samples[0]).toMatchObject({ id: 'CB3-LIVE-1', owner: 'OWNER', originalAlive: true, originalVitality: 50, massGrams: 500, holder: 'RECIPIENT', location: 'B', care: 'RECIPIENT_CARE', handovers: 2, returns: 0 });
    expect(life.samples[1]).toMatchObject({ id: 'CB3-LIVE-2', owner: 'OWNER', originalAlive: true, originalVitality: 50, massGrams: 500, holder: 'OWNER', location: 'A', care: 'OWNER_CARE', handovers: 2, returns: 1 });
    expect(life.samples[2]).toMatchObject({ id: 'CB3-DRY-1', owner: 'OWNER', origin: 'OWNER_NATURALLY_WITHERED', originalAlive: false, originalVitality: 0, alive: false, vitality: 0, massGrams: 100, holder: 'OWNER', location: 'A', care: 'OWNER_CARE', returns: 1 });
    expect(life.owner).toMatchObject({ id: 'CB3-ADA', age: 46, independentMind: true, health: 100, mind: 100, location: 'A' });
    expect(life.recipient).toMatchObject({ id: 'CB3-LENA', age: 39, independentMind: true, health: 100, mind: 100, location: 'B' });
    expect(life.kit).toMatchObject({ purchased: true, costPence: 90, actionsSpent: 1 });
    expect(life.box).toMatchObject({ id: 'CB3-CASE', holder: 'OWNER', location: 'A', sampleId: null, capacity: 1, maximumMassGrams: 1000 });
    expect(life.tag).toMatchObject({ id: 'CB3-TAG', holder: 'OWNER', location: 'A' });
    const attempts = COFFIN_BEARER_CASE_IDS.map(id => { expect(life.cases[id].attempts).toHaveLength(1); return life.cases[id].attempts[0]!; });
    for (const [index, attempt] of attempts.entries()) {
      expect(attempt).toMatchObject({ sampleId: life.samples[index]!.id, closed: true, sampleChecked: true, paperRead: true, outcomeRecorded: true, kitReturned: true, remainingSeconds: 0, effectActive: false });
      expect(life.samples[index]!.vitality).toBe(life.samples[index]!.originalVitality - attempt.vitalityLost);
      expect(life.samples[index]!.vitality).toBeLessThanOrEqual(life.samples[index]!.originalVitality);
    }
    expect(attempts[0]).toMatchObject({ waitCompleted: true, handedOver: true });
    expect(attempts[1]).toMatchObject({ consentWithdrawn: true, recipientConsent: 'REVOKED', stopped: true, sampleReturned: true, handedOver: false });
    expect(attempts[2]).toMatchObject({ ordinaryChecked: true, abilityCheck: null, spiritualitySpent: 0, mindSpent: 0, padId: null, limitedConfirmed: true });
    const paidPads = attempts.flatMap(attempt => attempt.padId ? [attempt.padId] : []);
    expect(new Set(paidPads).size).toBe(paidPads.length);
    expect(life.pads.filter(pad => pad.status === 'SPENT').map(pad => pad.id).sort()).toEqual(paidPads.sort());
    expect(life.pads).toHaveLength(3); expect(life.pads.every(pad => pad.holder === 'OWNER' && pad.location === 'A')).toBe(true);
    expect(capture().final.coffinBearer.life.samples).toEqual(life.samples);
    expectOriginals(s, original().final);
  });
  it('records each real original-bottle outcome after a separate same-week140 preparation', () => {
    const s = capture().promoted;
    expect(s.coffinBearer.bottles.filter(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')).toHaveLength(1);
    for (const b of s.coffinBearer.bottles.filter(b => b.status === 'CONSUMED')) {
      expect(b.preparationWeek).toBe(b.consumedWeek); expect(b.acquiredWeek).not.toBeNull(); expect(b.id).toMatch(/^coffin-bearer-potion-/);
      expect(b.consumedWeek).toBeGreaterThanOrEqual(s.ancientAlchemist.promotionWeek! + 12); expect(b.consumedWeek).toBeLessThanOrEqual(s.coffinBearer.promotionWeek!);
    }
    expect(s.coffinBearer.preparedWeek).toBeNull(); expect(s.coffinBearer.preparations).toHaveLength(3);
  });
  it('shows only the purchased original bottle in the ordinary bag and removes only the consumed bottle', () => {
    const all = Object.values(boundaries()), purchase = all.find(b => b.lastIntent.type === 'COFFIN_BEARER' && b.lastIntent.command.type === 'BUY_POTION')!;
    expect(purchase).toBeTruthy(); const before = migrateSliceState(purchase.beforeLast), after = migrateSliceState(purchase.final);
    const id = purchase.lastIntent.type === 'COFFIN_BEARER' && 'bottleId' in purchase.lastIntent.command ? purchase.lastIntent.command.bottleId : '';
    expect(projectSliceState(before).town.items.some(item => item.id === id)).toBe(false); expect(projectSliceState(after).town.items.filter(item => item.id === id)).toHaveLength(1);
    const dose = all.find(b => b.lastIntent.type === 'COFFIN_BEARER' && b.lastIntent.command.type === 'CONSUME' && b.lastIntent.command.bottleId === id)!;
    expect(dose).toBeTruthy(); expect(projectSliceState(migrateSliceState(dose.final)).town.items.some(item => item.id === id)).toBe(false);
  });
  it('rejects old-stage commands after promotion without refreshing Osric, old originals or old bottles', () => {
    const s = capture().promoted, bytes = JSON.stringify(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'CONSUME', bottleId: s.ancientAlchemist.bottles[0]!.id, confirmed: true }, { type: 'OBSERVE', caseId: 'living-stem' }] as const) expect(() => applySliceIntent(s, { type: 'ANCIENT_ALCHEMIST', command })).toThrow();
    expect(JSON.stringify(s)).toBe(bytes); expectOriginals(s, original().final);
  });
  it('retains optional-combat results honestly without promising victory or survival', () => {
    const s = capture().final, old = original().final; assertValidSliceState(s); expectOriginals(s, old); expect(s.combat).toBeNull();
    expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    const encounter = s.coffinBearer.encounter; expect(encounter.targetId).toBe('CB3-NOLAN'); expect(encounter.enemySpirituality).toBeLessThanOrEqual(120);
    expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.ARC_BOLT * 5 - encounter.powerUses.WARD * 4 - encounter.powerUses.COMPOSE * 4);
    expect(s.progression.mastery['mother.s3.finite-preservation']).toBe(capture().practiced.progression.mastery['mother.s3.finite-preservation']);
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); expect(() => applySliceIntent(s, { type: 'COFFIN_BEARER', command: { type: 'PREPARE_PROMOTION' } })).toThrow(); }
    else { expect(s.status).toBe('ACTIVE'); expect(s.health).toBeGreaterThan(0); expect(hasCoffinBearerLock(s)).toBe(false); }
    expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});
