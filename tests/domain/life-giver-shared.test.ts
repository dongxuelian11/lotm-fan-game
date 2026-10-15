import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import { playerAbilityWheel } from '../../src/domain/slice/combat.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { LIFE_GIVER_COUNT_WHEEL, LIFE_GIVER_ENEMY_COUNT_WHEEL, LIFE_GIVER_ENEMY_ABILITY_WHEEL, LIFE_GIVER_COMBAT_CONSTANTS, currentLifeGiverCombatSource, lifeGiverAbilityWheel } from '../../src/domain/life-giver/combat.js';
import { SUMMONING_MASTER_COUNT_WHEEL, SUMMONING_MASTER_ENEMY_COUNT_WHEEL, SUMMONING_MASTER_ENEMY_ABILITY_WHEEL, summoningMasterAbilityWheel } from '../../src/domain/summoning-master/combat.js';
import { LIFE_GIVER_ABILITY_IDS } from '../../src/domain/life-giver/types.js';
import { attempt, guest, lifeGiverBoundary, lifeGiverBoundaryNames, lifeGiverFixturePath, lifeGiverSnapshot, moonLegacyKeys, summoningMasterFixturePath, type LifeGiverBoundary } from './life-giver-test-fixture.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';

describe('Life Giver full unchanged original campaign and shared save boundaries', () => {
  it('replays572 public commands with all444 original S3 commands and exact migrated historical terminal state', () => {
    const commands = readObjectEntry<SliceIntent[]>(lifeGiverFixturePath, 'commands');
    const prefix = readObjectEntry<SliceIntent[]>(summoningMasterFixturePath, 'commands');
    expect(prefix).toHaveLength(444); expect(commands).toHaveLength(572); expect(commands.slice(0, 444)).toEqual(prefix);
    expect(readObjectEntry<number>(lifeGiverFixturePath, 'prefixCount')).toBe(444); expect(readObjectEntry<boolean>(lifeGiverFixturePath, 'prefixVerified')).toBe(true);
    expect(readObjectEntry<number>(summoningMasterFixturePath, 'prefixCount')).toBe(349);
    const seed = readObjectEntry<string>(lifeGiverFixturePath, 'seed'); expect(seed).toBe('apothecary-rebuild-first'); expect(seed).toBe(readObjectEntry<string>(summoningMasterFixturePath, 'seed'));
    const final = lifeGiverSnapshot('final'), inherited = migrateSliceState(readObjectEntry<unknown>(summoningMasterFixturePath, 'final'));
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(lifeGiverFixturePath, 'creation');
    let s = createSliceRun(final.runId, creation, seed);
    for (const [index, command] of commands.entries()) {
      expect(validateSlicePayload(command), `command ${index + 1}`).toBe(true);
      const cursor = s.random.cursor; s = applySliceIntent(s, command);
      expect(s.random.seed).toBe(seed); expect(s.random.cursor).toBeGreaterThanOrEqual(cursor); expect(s.weeklyBudget).toBe(3);
      if (index === 443) { expect(s).toEqual(inherited); expect(s).toEqual(lifeGiverSnapshot('departureStart')); }
    }
    assertValidSliceState(s); expect(s).toEqual(final);
    expect(s).toMatchObject({ status: 'ACTIVE', week: 131, health: 70, mind: 100, spirituality: 120, cash: 634, progression: { sequence: 2, acting: 100 } });
    expect(readObjectEntry<string>(lifeGiverFixturePath, 'stage')).toBe('FULL_NATURAL_BRANCH');
  }, 120000);

  it('replays all68 actual natural boundaries one entry at a time without editing the input', () => {
    const names = lifeGiverBoundaryNames(); expect(names).toHaveLength(68); expect(new Set(names).size).toBe(68);
    for (const key of ['inherited-full-s3-final', 'clinic-discovery', 'clinic-actual-pay60', 'original-wounds-actually-recovered', 'guidance', 'promotion', 'tired-guest-vitality-outcome', 'withdrawn-consent-actual-stop', 'interrupted-link-shelter-outcome', 'interrupted-link-actual-obstruction', 'reflection', 'new-current-battle-invitation', 'combat-start', 'combat-first', 'combat-terminal', 'ordinary-life-after-actual-exit']) expect(names).toContain(key);
    for (const key of names) {
      const b = lifeGiverBoundary(key), bytes = JSON.stringify(b.beforeLast); assertValidSliceState(b.beforeLast); assertValidSliceState(b.final);
      expect(applySliceIntent(b.beforeLast, b.lastIntent), key).toEqual(b.final); expect(JSON.stringify(b.beforeLast), key).toBe(bytes);
    }
  }, 120000);

  it('retainsH30 one-light/two-heavy risk2 departure, pays60 for actual treatment, then heals only through laterREST', () => {
    const old = lifeGiverSnapshot('departureStart'); expect(old).toMatchObject({ week: 108, cash: 514, actionsRemaining: 3, health: 30, mind: 100, spirituality: 120, injuryRisk: 2, progression: { sequence: 3, acting: 100 } });
    expect(old.injuries.map(i => i.severity)).toEqual(['LIGHT', 'HEAVY', 'HEAVY']); expect(old.injuries.every(i => i.treatedRevision === null)).toBe(true);
    const discovery = lifeGiverBoundary('clinic-discovery'); expect(discovery.lastIntent).toEqual({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' });
    expect(discovery.final.injuries).toEqual(discovery.beforeLast.injuries); expect(discovery.final.health).toBe(discovery.beforeLast.health);
    const paid = lifeGiverBoundary('clinic-actual-pay60'); expect(paid.lastIntent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
    expect(paid.final.cash).toBe(paid.beforeLast.cash - 60); expect(paid.final.injuries.map(i => i.id)).toEqual(paid.beforeLast.injuries.map(i => i.id));
    for (const wound of paid.final.injuries.filter(i => i.severity === 'HEAVY')) expect(wound.treatedRevision).toBe(paid.final.revision);
    const healed = lifeGiverBoundary('original-wounds-actually-recovered'); expect(healed.lastIntent).toEqual({ type: 'ACTION', action: 'REST' });
    expect(healed.final.injuries).toEqual([]); expect(healed.final.injuryRisk).toBe(0); expect(healed.final.health).toBe(86);
    expect(lifeGiverSnapshot('guidanceStart').injuries).toEqual([]);
    for (const key of moonLegacyKeys) expect(healed.final[key], key).toEqual(old[key]);
  });

  it('preserves true first-bottleW120success and all three real life results/costs/physical returns', () => {
    const promoted = lifeGiverSnapshot('promoted'); expect(promoted.lifeGiver.promotionWeek).toBe(120);
    expect(promoted.lifeGiver.bottles.map(b => [b.status, b.outcome, b.labourSteps])).toEqual([['CONSUMED', 'SUCCESS', 5], ['SUPPLIER', null, 0], ['SUPPLIER', null, 0]]);
    const s = lifeGiverSnapshot('practiced'), cases = ['tired-guest', 'withdrawn-consent', 'interrupted-link'] as const, a = cases.map(id => attempt(s, id));
    expect(cases.map(id => s.lifeGiver.life.cases[id].result)).toEqual(['ABILITY', 'ORDINARY', 'ORDINARY']);
    expect(a.map(v => [v.elapsedSeconds, v.playerTravelMetres, v.guestTravelMetres])).toEqual([[141, 120, 64], [141, 124, 60], [145, 124, 60]]);
    expect(a.map(v => [v.spiritualitySpent, v.guestStaminaSpent, v.playerHealthSpent])).toEqual([[6, 16, 0], [0, 0, 0], [4, 0, 0]]);
    expect(a[0]).toMatchObject({ vitalityTier: 'SUCCESS', vitalityRestored: 12, shelterTier: null });
    expect(a[1]).toMatchObject({ revoked: true, vitalityTier: null, shelterTier: null, ordinaryCompleted: true });
    expect(a[2]).toMatchObject({ shelterTier: 'SUCCESS', shelterStatus: 'STOPPED', shelterApplied: false, obstructionObserved: true, cleared: true, ordinaryCompleted: true });
    expect(a.every(v => v.closed && v.inspected && v.guestReturned && v.tokenReturned && v.guestAfter?.location === 'HOME')).toBe(true);
    expect(s.lifeGiver.life.beads).toHaveLength(6); expect(s.lifeGiver.life.beads.every(b => b.paidPennies === 60 && b.location === 'RETURN_TRAY')).toBe(true);
    expect(LIFE_GIVER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 0]); expect(s.progression.acting).toBe(100);
  });

  it('retains all old people, histories, original supplies and mastery through the actualS2retreat', () => {
    const old = lifeGiverSnapshot('departureStart'), s = lifeGiverSnapshot('final');
    for (const key of moonLegacyKeys) expect(s[key], key).toEqual(old[key]);
    expect(s.character.gender).toBe(old.character.gender); expect(s.runId).toBe(old.runId); expect(s.random.seed).toBe(old.random.seed);
    expect(s.witchKing.encounter).toEqual(old.witchKing.encounter); expect(s.witchKing.ritual).toEqual(old.witchKing.ritual); expect(s.witchKing.life.target).toEqual(old.witchKing.life.target);
    const currentWitch = structuredClone(s.witchKing);
    expect(currentWitch.life.papers.map(p => p.id)).toEqual(old.witchKing.life.papers.map(p => p.id));
    for (const p of currentWitch.life.papers) {
      const previous = old.witchKing.life.papers.find(x => x.id === p.id)!;
      if (previous.status === 'CONSUMED') expect(p).toEqual(previous);
      else {
        expect(p).toMatchObject({ id: 'WK4-PAPER-1-3', status: 'CONSUMED', consumedBy: 'COMBAT' });
        expect(s.combatHistory.some(r => r.lifeGiverOutcome?.papersConsumed.includes(p.id))).toBe(true);
        for (const key of ['status', 'preparedWeek', 'consumedWeek', 'consumedBy', 'combatRound'] as const) Object.assign(p, { [key]: previous[key] });
      }
    }
    expect(currentWitch).toEqual(old.witchKing);
    const currentSummoning = structuredClone(s.summoningMaster); currentSummoning.life.partner = structuredClone(old.summoningMaster.life.partner);
    expect(currentSummoning).toEqual(old.summoningMaster);
    for (const key of ['id', 'bodyId', 'homeId', 'source', 'name', 'chime', 'willing', 'adult', 'independentMind'] as const) expect(guest(s)[key], key).toEqual(guest(old)[key]);
    expect(guest(s).restHistory.slice(0, guest(old).restHistory.length)).toEqual(guest(old).restHistory);
    expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    for (const [id, value] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id], id).toBe(value);
    expect(s.progression.mastery).toEqual(lifeGiverSnapshot('practiced').progression.mastery);
    expect(s.summoningMaster.encounter).toMatchObject({ enemyStatus: 'RESISTING', enemyHealth: 100, enemySpirituality: 71, status: 'RETREATED' });
    const reordered = JSON.parse(stableStringify(s)); assertValidSliceState(reordered); expect(projectSliceState(reordered)).toEqual(projectSliceState(s));
  });

  it('exposes all21 unique original abilityIDs after projection, including original zero-valued mastery', () => {
    const s = lifeGiverSnapshot('promoted'), p = projectSliceState(s).lifeGiver;
    expect(p.abilities).toHaveLength(21); expect(new Set(p.abilities.map(a => a.id)).size).toBe(21);
    expect(new Set(p.abilities.map(a => a.id))).toEqual(new Set(Object.keys(s.progression.mastery)));
    for (const a of p.abilities) expect(a.mastery).toBe(s.progression.mastery[a.id]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], currentGender: s.character.gender });
  });

  it('projects the new Adrian wheels from actualS2resolution constants and keeps their source evidence', () => {
    const s = lifeGiverSnapshot('combatStart'), bytes = JSON.stringify(s), p = projectSliceState(s).combat!, source = currentLifeGiverCombatSource(s)!;
    const playerLabels = ["有限活力（每轮一次，6S＋实付原珠/知识18，只恢复原来客至多12已失精力）", "分担庇护（每轮一次4S＋原珠/知识18；下次成功合作本人H−5、来客耗3精力、额外减20）", "继承血月之箭（4S/感知16，45×旧掌握）", "继承同一预备原纸（3S＋PREPARED原纸，减势35）", "当场许可的原来客召入（6S/知识18＋同体过门6精力）", "原来客合作（3S＋8原精力/知识16，32优势/减16）", "判断失衡（固定−22.5）"];
    const enemyLabels = ["有限暗矢：7S/105", "有限护术：6S/减60", "有限干扰：4S/断实际门与庇护，来客本轮至多M−8", "同一原棍：20×身体", "判断失衡：−22.5"];
    expect(p.playerCountWheel).toEqual(LIFE_GIVER_COUNT_WHEEL); expect(p.enemyCountWheel).toEqual(LIFE_GIVER_ENEMY_COUNT_WHEEL); expect(p.enemyAbilityWheel).toEqual(LIFE_GIVER_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:enemyLabels[index]})));
    expect(p.playerAbilityWheel).toEqual(playerAbilityWheel(s, null).map((entry,index)=>({...entry,label:playerLabels[index]}))); expect(p.playerAbilityWheel.map(({ id, weight }) => ({ id, weight }))).toEqual(lifeGiverAbilityWheel(s, null).map(({ id, weight }) => ({ id, weight })));
    for (const stance of ['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE'] as const) {
      expect(p.playerAbilityWheels?.[stance]).toEqual(playerAbilityWheel(s, stance).map((entry,index)=>({...entry,label:playerLabels[index]})));
      expect(p.playerAbilityWheels?.[stance]?.map(({ id, weight }) => ({ id, weight }))).toEqual(lifeGiverAbilityWheel(s, stance).map(({ id, weight }) => ({ id, weight })));
    }
    expect(source).toMatchObject({ encounterId: 'LIFE_GIVER_DISPUTE', targetId: 'LG2-ADRIAN-VALE', randomSeed: s.random.seed, randomCursor: s.random.cursor, targetSequence: 2, enemyPhysique: 24, enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, ordinaryExitMetres: 4, ordinaryExitSeconds: 4 });
    expect(source.partner).toEqual(guest(s)); expect(source.guestPermit).toEqual(s.lifeGiver.encounter.guestPermit);
    expect(LIFE_GIVER_COMBAT_CONSTANTS).toMatchObject({ weights: { physique: .35, perception: .25, will: .25, knowledge: .15 }, tier: 1250, floor: 125, maxSpirituality: 120, continuingRecovery: 12 });
    expect(JSON.stringify(s)).toBe(bytes);
  });

  it('projects the original Edwin wheels from actualS3constants without changing old historical draws', () => {
    const s = migrateSliceState(readObjectEntry<unknown>(summoningMasterFixturePath, 'combatStart')); assertValidSliceState(s);
    const bytes = JSON.stringify(s), p = projectSliceState(s).combat!;
    const playerLabels = ["继承血月之箭（H；4S/感知16，45×旧掌握）", "继承同一预备原纸（J；3S＋实际原纸，减势35）", "有许可的有限召唤（B；6S/知识18＋同体过门6精力）", "继承有限深渊枷锁（K；2S/感知16，减势18）", "原来客有限合作（R；3S＋8原精力/知识16，32/减16）", "判断失衡（A；固定−22.5）"];
    const enemyLabels = ["有限暗矢：5S/75", "有限护术：4S/减45", "同一原棍：20×身体", "干扰原门：4S/来客惊扰一次M−8", "判断偏差：−22.5"];
    expect(p.playerCountWheel).toEqual(SUMMONING_MASTER_COUNT_WHEEL); expect(p.enemyCountWheel).toEqual(SUMMONING_MASTER_ENEMY_COUNT_WHEEL); expect(p.enemyAbilityWheel).toEqual(SUMMONING_MASTER_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:enemyLabels[index]})));
    expect(p.playerAbilityWheel).toEqual(playerAbilityWheel(s, null).map((entry,index)=>({...entry,label:playerLabels[index]}))); expect(p.playerAbilityWheel.map(({ id, weight }) => ({ id, weight }))).toEqual(summoningMasterAbilityWheel(s, null).map(({ id, weight }) => ({ id, weight })));
    for (const stance of ['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE'] as const) {
      expect(p.playerAbilityWheels?.[stance]).toEqual(playerAbilityWheel(s, stance).map((entry,index)=>({...entry,label:playerLabels[index]})));
      expect(p.playerAbilityWheels?.[stance]?.map(({ id, weight }) => ({ id, weight }))).toEqual(summoningMasterAbilityWheel(s, stance).map(({ id, weight }) => ({ id, weight })));
    }
    expect(JSON.stringify(s)).toBe(bytes);
  });

  it('replays seven explicitly alternate public-choice boundaries with unchangedseed/cursor and actual shared health cost', () => {
    const path = 'tests/fixtures/life-giver-v01680/directed.json';
    const names = ['actual-shared-load', 'return_token', 'return_guest', 'return_player', 'return_beads', 'inspect', 'close'];
    const source = lifeGiverBoundary('interrupted-link-shelter-outcome').final;
    let previous = source;
    for (const name of names) {
      const raw = readObjectEntry<LifeGiverBoundary>(path, name), b = { beforeLast: migrateSliceState(raw.beforeLast), lastIntent: raw.lastIntent, final: migrateSliceState(raw.final) };
      expect(b.beforeLast, name).toEqual(previous); expect(applySliceIntent(b.beforeLast, b.lastIntent), name).toEqual(b.final);
      expect(b.final.random).toEqual(source.random); assertValidSliceState(b.final); previous = b.final;
      if (name === 'actual-shared-load') {
        expect(b.lastIntent).toEqual({ type: 'LIFE_GIVER', command: { type: 'GUEST_CARRY', caseId: 'interrupted-link' } });
        expect(b.final.health).toBe(source.health - 5); expect(guest(b.final).stamina).toBe(guest(source).stamina - 3);
        expect(attempt(b.final, 'interrupted-link')).toMatchObject({ shelterApplied: true, shelterStatus: 'APPLIED', playerHealthSpent: 5, guestStaminaSpent: 3 });
        expect(b.final.progression.mastery['moon.s2.shared-shelter']).toBe(8);
      }
    }
    expect(previous.health).toBe(95); expect(guest(previous).location).toBe('HOME'); expect(previous.lifeGiver.life.playerLocation).toBe('YARD');
    expect(previous.lifeGiver.life.token.location).toBe('OWNER'); expect(previous.lifeGiver.life.beads.every(b => b.location === 'RETURN_TRAY')).toBe(true);
    expect(attempt(previous, 'interrupted-link').closed).toBe(true);
    expect(lifeGiverSnapshot('final').progression.mastery['moon.s2.shared-shelter']).toBe(0);
  }, 60000);
});
