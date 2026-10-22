import { playerAbilityWheel } from '../../src/domain/slice/combat.js';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { projectKnowledgeMentorLife } from '../../src/domain/knowledge-mentor/life.js';
import { ARCANE_SCHOLAR_COUNT_WHEEL, ARCANE_SCHOLAR_ENEMY_COUNT_WHEEL, ARCANE_SCHOLAR_ENEMY_ABILITY_WHEEL, arcaneScholarAbilityWheel } from '../../src/domain/arcane-scholar/combat.js';
import { knowledgeMentorFixturePath, knowledgeMentorBoundary, knowledgeMentorBoundaryNames, knowledgeMentorSnapshot, paragonLegacyKeys } from './knowledge-mentor-test-fixture.js';
const oldPath = 'tests/fixtures/arcane-scholar-v01430/natural.json';

describe('Knowledge Mentor actual same-seed route and shared save boundaries', () => {
  it('replays all691 real public commands after an unchanged564-command living S3 prefix', () => {
    const commands = readObjectEntry<SliceIntent[]>(knowledgeMentorFixturePath, 'commands'), prefix = readObjectEntry<SliceIntent[]>(oldPath, 'commands');
    expect(prefix).toHaveLength(564); expect(commands).toHaveLength(691); expect(commands.slice(0, 564)).toEqual(prefix);
    expect(readObjectEntry<number>(knowledgeMentorFixturePath, 'prefixCount')).toBe(564); expect(readObjectEntry<boolean>(knowledgeMentorFixturePath, 'prefixVerified')).toBe(true);
    const seed = readObjectEntry<string>(knowledgeMentorFixturePath, 'seed'); expect(seed).toBe(readObjectEntry<string>(oldPath, 'seed'));
    const final = knowledgeMentorSnapshot('final'), creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(knowledgeMentorFixturePath, 'creation');
    let s = createSliceRun(final.runId, creation, seed);
    for (const command of commands) s = applySliceIntent(s, command);
    assertValidSliceState(s); expect(s).toEqual(final);
    expect(s).toMatchObject({ status: 'ACTIVE', week: 169, health: 70, mind: 99, spirituality: 113, cash: 576, progression: { sequence: 2, acting: 100 } });
    expect(knowledgeMentorSnapshot('departureStart')).toEqual(migrateSliceState(readObjectEntry<unknown>(oldPath, 'final')));
  }, 60000);

  it('replays each of39 actual transaction boundaries without editing inputs or loading all histories at once', () => {
    const names = knowledgeMentorBoundaryNames(); expect(names).toHaveLength(39); expect(new Set(names).size).toBe(39);
    for (const name of ['inherited-full-s3-final', 'original-light-wounds-actual-rest', 'guidance', 'promotion', 'documented-cycle-binding-outcome', 'documented-cycle-program-outcome', 'consented-transfer-binding-outcome', 'vera-same-parcel-returned', 'blocked-cycle-calibration-outcome', 'reflection', 'combat-plate-attempt-1', 'combat-plate-attempt-2', 'combat-plate-attempt-3', 'combat-start', 'combat-first', 'combat-terminal', 'ordinary-life-after-actual-exit']) expect(names).toContain(name);
    for (const name of names) {
      const b = knowledgeMentorBoundary(name), bytes = JSON.stringify(b.beforeLast); assertValidSliceState(b.beforeLast); assertValidSliceState(b.final);
      expect(applySliceIntent(b.beforeLast, b.lastIntent), name).toEqual(b.final); expect(JSON.stringify(b.beforeLast), name).toBe(bytes);
    }
  }, 60000);

  it('heals precisely the two original light wounds through actual later REST without fabricating a heavy-wound payment', () => {
    const departure = knowledgeMentorSnapshot('departureStart'), b = knowledgeMentorBoundary('original-light-wounds-actual-rest');
    expect(departure.injuries).toHaveLength(2); expect(departure.injuries.every(i => i.severity === 'LIGHT' && i.treatedRevision === null)).toBe(true);
    expect(b.lastIntent).toEqual({ type: 'ACTION', action: 'REST' }); expect(b.beforeLast.injuries).toEqual(departure.injuries);
    expect(b.final.injuries).toEqual([]); expect(b.final.injuryRisk).toBe(0);
    expect(knowledgeMentorSnapshot('guidanceStart').injuries).toEqual([]);
    for (const key of paragonLegacyKeys) expect(b.final[key], key).toEqual(departure[key]);
  });

  it('retains actual natural ability/ordinary/ability results and their exact time, distances and distinct costs', () => {
    const s = knowledgeMentorSnapshot('practiced'), p = projectKnowledgeMentorLife(s), a = p.cases.map(c => c.attempts[0]!);
    expect(a.map(v => v.result)).toEqual(['ABILITY', 'ORDINARY', 'ABILITY']);
    expect(a.map(v => [v.elapsedSeconds, v.ownerTravelMetres, v.boxTravelMetres])).toEqual([[92, 12, 10], [97, 16, 10], [108, 16, 10]]);
    expect(a.map(v => [v.spiritualitySpent, v.paidPennies, v.boxChargeSpent, v.frameChargeSpent, v.frameDurabilityLost])).toEqual([[9, 60, 1, 1, 0], [4, 60, 0, 0, 0], [13, 60, 1, 1, 5]]);
    expect(a.map(v => v.bindCheck!.roll)).toEqual([7, 84, 3]); expect(a.map(v => v.runCheck?.roll ?? null)).toEqual([65, null, 22]); expect(a[2]!.calibrationCheck!.roll).toBe(41);
    expect(a.every(v => v.closed && v.verified && v.originalsReturned && v.plate?.location === 'RECYCLE' && !v.programActive)).toBe(true);
    expect(a[1]!.parcel).toMatchObject({ holder: 'KM2-VERA', location: 'OWNER', delivered: true, returned: true });
    expect([s.progression.mastery['paragon.s2.protocol-binding'], s.progression.mastery['paragon.s2.bounded-calibration']]).toEqual([8, 8]);
    expect(s.progression.acting).toBe(100); expect(s.knowledgeMentor.life.reflected).toBe(true);
  });

  it('preserves old natural S3 people, dead gardens, prior combat and all old masteries through the final new stage', () => {
    const old = knowledgeMentorSnapshot('departureStart'), s = knowledgeMentorSnapshot('final');
    for (const key of ['savant', 'archaeologist', 'appraiser', 'artisan', 'astronomer', 'arcaneScholar'] as const) expect(s[key], key).toEqual(old[key]);
    expect(s.alchemist.encounter).toEqual(old.alchemist.encounter); expect(s.alchemist.ritual).toEqual(old.alchemist.ritual);
    expect(s.alchemist.life.parcel).toEqual(old.alchemist.life.parcel); expect(s.alchemist.life.entrustedMaterial).toEqual(old.alchemist.life.entrustedMaterial);
    expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    for (const [id, value] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(s.arcaneScholar.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 70, enemySpirituality: 64 });
    expect(s.alchemist.encounter.enemy).toMatchObject({ status: 'DEAD', health: 0 });
    expect(new Set(s.alchemist.life.creations.map(x => x.id))).toEqual(new Set(['AL4-BOX-1', 'AL4-FRAME-1']));
    const reordered = JSON.parse(stableStringify(s)); assertValidSliceState(reordered); expect(projectSliceState(reordered)).toEqual(projectSliceState(s));
  });

  it('shows the old Corwin wheel from the original actual S3 constants without changing historical draws', () => {
    const old = migrateSliceState(readObjectEntry<unknown>(oldPath, 'combatStart')); assertValidSliceState(old); const bytes = JSON.stringify(old), p = projectSliceState(old).combat!;
    expect(p.playerCountWheel).toEqual(ARCANE_SCHOLAR_COUNT_WHEEL); expect(p.enemyCountWheel).toEqual(ARCANE_SCHOLAR_ENEMY_COUNT_WHEEL);
    const playerLabels = ["双原件有限协同（5S+各1储能/知识18，成功40/减20）", "有限结构解析（4S/知识18，下一次普通打击窗口）", "继承原护架赋灵（4S+1储能/知识16，40×原掌握）", "继承指挥原护架（2S+1储能/减26，须原架实际赋灵）", "继承短时专注（2S/12×原掌握）", "持握原短棍打击", "本人普通避让（减10，不免伤）", "观察眼前原人原物（0消耗/0贡献）", "判断失衡（固定−22.5）"];
    const enemyLabels = ["有限弧光术：5S/贡献75", "有限护术：4S/减势45", "有限干扰：4S/本轮下一次协同抵抗30%→70%", "自己的唯一原棍：20×身体", "普通观察原人原出口：0贡献", "判断偏差：−22.5"];
    expect(p.enemyAbilityWheel).toEqual(ARCANE_SCHOLAR_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:enemyLabels[index]}))); expect(p.playerAbilityWheel).toEqual(playerAbilityWheel(old, null).map((entry,index)=>({...entry,label:playerLabels[index]}))); expect(p.playerAbilityWheel.map(({id,weight})=>({id,weight}))).toEqual(arcaneScholarAbilityWheel(old,null).map(({id,weight})=>({id,weight})));
    for (const stance of ['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE'] as const) expect(p.playerAbilityWheels?.[stance]).toEqual(playerAbilityWheel(old, stance).map((entry,index)=>({...entry,label:playerLabels[index]})));
    expect(JSON.stringify(old)).toBe(bytes);
  });

  it.each([
    ['weather-warlock-v01650', 'promotion'], ['discerner-v01660', 'promotion'],
  ])('keeps %s prepared-scene canAct consistent with the existing ordinary-action command lock', (stage, key) => {
    const b = readObjectEntry<{ beforeLast: unknown }>(`tests/fixtures/${stage}/boundaries.json`, key), s = migrateSliceState(b.beforeLast);
    assertValidSliceState(s); expect(projectSliceState(s).canAct).toBe(false);
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'WORK' })).toThrow();
  }, 10_000);
});
