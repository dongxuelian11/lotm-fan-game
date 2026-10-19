import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { ScrollProfessorScroll } from '../../src/domain/scroll-professor/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createProphecyMasterState } from '../../src/domain/prophecy-master/index.js';
import { applyProphecyMasterEncounterCommand } from '../../src/domain/prophecy-master/encounter.js';
import {
  PROPHECY_MASTER_COUNT_WHEEL, PROPHECY_MASTER_ENEMY_COUNT_WHEEL, PROPHECY_MASTER_ENEMY_ABILITY_WHEEL,
  prophecyMasterActionCount, prophecyMasterEnemyActionCount, prophecyMasterAbilityWheel, drawProphecyMasterAbility, drawProphecyMasterEnemyAbility,
  beginProphecyMasterCombatRound, currentProphecyMasterCombatSource, resolveProphecyMasterCombatAbility, resolveProphecyMasterEnemyAbility,
  finishProphecyMasterCombatRound, prophecyMasterRoundOutcome, validateProphecyMasterRoundOutcome, projectProphecyMasterCombat,
  type ProphecyMasterCombatSource, type ProphecyMasterMoveId,
} from '../../src/domain/prophecy-master/combat.js';

const H = 'hermit.s6.scrollcraft', J = 'BODY_FOLLOWUP', B = 'BRIEF_WARD', K = 'hermit.s5.star-cage', R = 'hermit.s4.mystical-reenactment', G = 'hermit.s3.prophetic-glimpse';
const context: SeerContext = { roll: min => min, note: () => {}, check: () => { throw new Error('No automatic scene check'); } };
function random(...values: number[]): ActionRandomStream { let cursor = 0;
  return { seed: 'prophecy-master-directed-unit', get cursor() { return cursor; }, nextInt(min, max) { const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n; } };
}
/** Explicit directed S3 setup on the unchanged genuine natural411-command Mystic4 prefix. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/mystic-v01310/natural.json', 'utf8')).final);
  s.prophecyMaster = createProphecyMasterState(); s.prophecyMaster.guidanceKnown = true; s.prophecyMaster.promotionWeek = s.week; s.prophecyMaster.mysticActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.mastery[G] = 0; s.character.coreStats.knowledge = 30;
  s.actionsRemaining = 3; s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null;
  applyProphecyMasterEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); applyProphecyMasterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginProphecyMasterCombatRound(s, 'ATTACK', random());
const player = (s: SliceState, r: ReturnType<typeof begin>, id: ProphecyMasterMoveId, rng = random(), physical = 1) => resolveProphecyMasterCombatAbility(s, id, physical, rng, r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveProphecyMasterEnemyAbility>[1], physical = 1) => resolveProphecyMasterEnemyAbility(s, id, physical, random(), r);
const valid = (s: SliceState, r: ReturnType<typeof begin>) => expect(validateProphecyMasterRoundOutcome(finishProphecyMasterCombatRound(s, r))).toBe(true);
const legacy = (s: SliceState) => structuredClone({ pryer: s.pryer, combatScholar: s.combatScholar, wizard: s.wizard, scrollProfessor: s.scrollProfessor, starMystic: s.starMystic, mystic: s.mystic, town: s.town });
/** Extra original for an explicitly directed inventory boundary, not natural acquisition evidence. */
function addScroll(s: SliceState, kind: 'IMPACT' | 'WARD', makerSequence: 6 | 5 | 4 | 3 = 4): string {
  const w = s.scrollProfessor.workshop, n = w.scrolls.length + 1, materialId = `scroll-professor-material-${w.materials.length + 1}`;
  w.materials.push({ id: materialId, acquiredWeek: s.week - 1, spentWeek: s.week, status: 'SPENT' });
  w.scrolls.push({ id: `scroll-professor-scroll-${n}`, kind, materialId, makerSequence, inscriptionMastery: 8, createdWeek: s.week, status: 'HELD', usedWeek: null, authorized: true });
  w.craftAttempts++; return w.scrolls.at(-1)!.id;
}

describe('ProphecyMaster actual finite omen and inherited original combat', () => {
  it('uses both1–6 wheels and exactly H30/J15/B20/K15/R10/G5/ACC5', () => {
    expect(PROPHECY_MASTER_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(PROPHECY_MASTER_ENEMY_COUNT_WHEEL).toEqual(PROPHECY_MASTER_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(prophecyMasterActionCount(roll!)).toBe(count); expect(prophecyMasterEnemyActionCount(roll!)).toBe(count);
    }
    const wheel = prophecyMasterAbilityWheel(fixture(), null);
    expect(wheel.map(v => v.id)).toEqual([H, J, B, K, R, G, 'ACCIDENT']); expect(wheel.map(v => v.weight)).toEqual([30, 15, 20, 15, 10, 5, 5]);
    expect(PROPHECY_MASTER_ENEMY_ABILITY_WHEEL.map(v => v.id)).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'FEINT', 'ACCIDENT']);
    expect(PROPHECY_MASTER_ENEMY_ABILITY_WHEEL.reduce((n, v) => n + v.weight, 0)).toBe(100);
  });
  it('draws exact boundaries once with standard5-to4 stance bias', () => {
    const s = fixture(); let boundary = 0;
    for (const a of prophecyMasterAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4;
      const rng = random(first, boundary); expect(drawProphecyMasterAbility(rng, s, null)).toBe(a.id); expect(drawProphecyMasterAbility(rng, s, null)).toBe(a.id); expect(rng.cursor).toBe(2); }
    boundary = 0; for (const a of PROPHECY_MASTER_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight;
      const rng = random(first, boundary); expect(drawProphecyMasterEnemyAbility(rng)).toBe(a.id); expect(drawProphecyMasterEnemyAbility(rng)).toBe(a.id); }
    expect(drawProphecyMasterAbility(random(406), s, 'ATTACK')).toBe(G); expect(drawProphecyMasterAbility(random(425), s, 'ATTACK')).toBe(G);
    expect(prophecyMasterAbilityWheel(s, 'PREPARE')[5]!.weight).toBe(25 / 415 * 100);
  });
  it('pays6S2M for uncertainwindow, adds no attack, and reduces next actualbody once', () => {
    const s = fixture(), old = legacy(s), r = begin(s);
    expect(player(s, r, G)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(s.spirituality).toBe(114); expect(s.mind).toBe(98);
    expect(r.playerActions[0]).toMatchObject({ mode: 'PREPARED', prepared: 'GLIMPSE', paidCost: 6, mindCost: 2 });
    expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(14); expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(20);
    expect(r.enemyActions.map(a => a.windowConsumed)).toEqual([true, false]); expect(legacy(s)).toEqual(old); valid(s, r);
  });
  it('knowledge18 actual50 boundary succeeds and51 fails with both costs retained', () => {
    const s = fixture(); s.character.coreStats.knowledge = 18; const r = begin(s);
    player(s, r, G, random(50)); enemy(s, r, 'FEINT'); player(s, r, G, random(51));
    expect(r.playerActions.map(a => a.mode)).toEqual(['PREPARED', 'FAILED']); expect(s.prophecyMaster.encounter.propheticWindow).toBe(false);
    expect(s.spirituality).toBe(108); expect(s.mind).toBe(96); expect(enemy(s, r, 'ARC_BOLT').selfGain).toBe(70); valid(s, r);
  });
  it('does not refill or stack an unusedwindow and expires it at actual60secondround end', () => {
    const s = fixture(), r = begin(s); player(s, r, G); const rng = random(); player(s, r, G, rng);
    expect(rng.cursor).toBe(0); expect(s.spirituality).toBe(114); expect(s.mind).toBe(98); expect(r.playerActions[1]!.mode).toBe('ALREADY_PREPARED');
    const o = finishProphecyMasterCombatRound(s, r); expect(o.propheticWindowAfter).toBe(false); expect(s.prophecyMaster.encounter.propheticWindow).toBe(false);
    expect(o.lifeClockSecondsAfter).toBe(60); expect(s.prophecyMaster.life.clockSeconds).toBe(60); expect(validateProphecyMasterRoundOutcome(o)).toBe(true);
  });
  it('cannot prepare with5S or2M and consumes no random draw or resource', () => {
    for (const [spirituality, mind] of [[5, 100], [120, 2]]) { const s = fixture(); s.spirituality = spirituality!; s.mind = mind!; const r = begin(s), rng = random();
      expect(player(s, r, G, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(rng.cursor).toBe(0);
      expect(s.spirituality).toBe(spirituality); expect(s.mind).toBe(mind); valid(s, r); }
  });
  it('ward, accident and zero-body attack leavewindow for next positive paidarc', () => {
    const s = fixture(), r = begin(s); player(s, r, G); enemy(s, r, 'WARD'); enemy(s, r, 'ACCIDENT'); enemy(s, r, 'BODY_STRIKE', 0);
    expect(s.prophecyMaster.encounter.propheticWindow).toBe(true); expect(enemy(s, r, 'ARC_BOLT').selfGain).toBe(49);
    expect(s.prophecyMaster.encounter.enemySpirituality).toBe(111); expect(s.prophecyMaster.encounter.powerUses).toEqual({ ARC_BOLT: 1, WARD: 1, FEINT: 0 }); valid(s, r);
  });
  it('actual paidfeint consumeswindow but makes no injurythreat and does not consume oldeffects', () => {
    const s = fixture(), r = begin(s); player(s, r, K); player(s, r, R); player(s, r, G);
    expect(enemy(s, r, 'FEINT')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.prophecyMaster.encounter).toMatchObject({ propheticWindow: false, cageReady: true, echoReady: true, enemySpirituality: 117, powerUses: { FEINT: 1 } });
    expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(10); expect(enemy(s, r, 'ARC_BOLT').selfGain).toBe(70 * .955); valid(s, r);
  });
  it('feint withnowindow is a zero-cost nonthreatening ordinaryaction', () => {
    const s = fixture(), r = begin(s); expect(enemy(s, r, 'FEINT')).toMatchObject({ selfGain: 0, threatens: false });
    expect(r.enemyActions[0]).toMatchObject({ mode: 'NO_WINDOW', paidCost: 0, windowConsumed: false }); expect(s.prophecyMaster.encounter.enemySpirituality).toBe(120); valid(s, r);
  });
  it('insufficientenemyS uses actualrod, nextpositivebody consumespaidwindow', () => {
    const s = fixture(); s.prophecyMaster.encounter.powerUses.ARC_BOLT = 24; s.prophecyMaster.encounter.enemySpirituality = 0; const r = begin(s); player(s, r, G);
    expect(enemy(s, r, 'FEINT').selfGain).toBe(14); expect(enemy(s, r, 'ARC_BOLT').selfGain).toBe(20); expect(enemy(s, r, 'WARD').selfGain).toBe(20);
    expect(s.prophecyMaster.encounter.enemySpirituality).toBe(0); expect(r.enemyActions.every(a => a.actual === 'BODY_STRIKE' && a.paidCost === 0)).toBe(true); valid(s, r);
  });
  it('oldcage costs3S knowledge14 and onlypositivebody usesit once', () => {
    const s = fixture(); s.character.coreStats.knowledge = 14; const r = begin(s); player(s, r, K, random(50)); const rng = random(); player(s, r, K, rng);
    expect(rng.cursor).toBe(0); expect(s.spirituality).toBe(117); enemy(s, r, 'ARC_BOLT'); enemy(s, r, 'BODY_STRIKE', 0); expect(s.prophecyMaster.encounter.cageReady).toBe(true);
    expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(10); expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(20); valid(s, r);
  });
  it('published oldecho still15percent efficacy and combinesonlyactualpaidarc withwindow', () => {
    const s = fixture(), old = legacy(s), r = begin(s); player(s, r, R); player(s, r, G);
    enemy(s, r, 'WARD'); expect(s.prophecyMaster.encounter.echoReady).toBe(true);
    expect(enemy(s, r, 'ARC_BOLT').selfGain).toBeCloseTo(70 * .955 * .7); expect(enemy(s, r, 'ARC_BOLT').selfGain).toBe(70);
    expect(s.spirituality).toBe(110); expect(s.mind).toBe(98); expect(legacy(s)).toEqual(old); valid(s, r);
  });
  it('unlearnedecho is0S ordinaryobservation without oldglasses focus or freespell', () => {
    const s = fixture(); s.mystic.life.echoLearned = false; s.mystic.life.publicDisclosed = false; const old = legacy(s), r = begin(s), rng = random();
    expect(player(s, r, R, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(rng.cursor).toBe(0); expect(s.spirituality).toBe(120);
    expect(r.playerActions[0]!.mode).toBe('NOT_LEARNED'); expect(legacy(s)).toEqual(old); valid(s, r);
  });
  it('inherits realH/J/B budgets and actuallearned2S costs without refilling used originals', () => {
    const s = fixture(); s.progression.mastery['hermit.s7.spellcraft'] = 500; s.progression.mastery['hermit.s8.combat-study'] = 0; const old = legacy(s), r = begin(s);
    expect(player(s, r, H).selfGain).toBe(38.025); expect(player(s, r, B).enemyReduction).toBe(42.25); expect(player(s, r, J, random(), .5).selfGain).toBe(20.475 * .65 * .5);
    expect(s.spirituality).toBe(116); expect(r.playerActions.map(a => a.mode)).toEqual(['LEARNED_SPELL', 'LEARNED_SPELL', 'INHERITED_BODY']); expect(legacy(s)).toEqual(old); valid(s, r);
  });
  it('consumes onlyactualauthorizedoldscroll once then usesrealspell; maker6/5/4/actual3 budgetunchanged', () => {
    for (const maker of [6, 5, 4, 3] as const) { const s = fixture(), id = addScroll(s, 'IMPACT', maker), old = legacy(s), r = begin(s);
      expect(player(s, r, H).selfGain).toBe(38.025 * (.65 + .35 * 8 / 500)); player(s, r, H);
      expect(s.spirituality).toBe(117); expect(r.playerActions.map(a => a.mode)).toEqual(['ORIGINAL_SCROLL', 'LEARNED_SPELL']);
      expect(r.playerActions[0]!.scroll).toMatchObject({ id, makerSequence: maker, inscriptionMastery: 8 });
      expect(s.scrollProfessor.workshop.scrolls.find(v => v.id === id)).toMatchObject({ status: 'USED', authorized: false, usedWeek: s.week });
      const expected = structuredClone(old); Object.assign(expected.scrollProfessor.workshop.scrolls.find(v => v.id === id)!, { status: 'USED', authorized: false, usedWeek: s.week });
      expect(legacy(s)).toEqual(expected); valid(s, r); }
  });
  it('realwardscroll consumes1S and stays nonthreatening', () => {
    const s = fixture(), id = addScroll(s, 'WARD'), r = begin(s);
    expect(player(s, r, B)).toMatchObject({ enemyReduction: 42.25 * (.65 + .35 * 8 / 500), selfGain: 0, threatens: false });
    expect(s.spirituality).toBe(119); expect(r.playerActions[0]!.scroll!.id).toBe(id); valid(s, r);
  });
  it('no authorization, realspentmaterial or validmaker means no inventedscroll power', () => {
    const changes: ((s: SliceState, scroll: ScrollProfessorScroll) => void)[] = [(_s, a) => { a.authorized = false; }, (s, a) => { s.scrollProfessor.workshop.materials.find(m => m.id === a.materialId)!.status = 'HELD'; },
      (_s, a) => { a.makerSequence = 2 as 4; }, (s, a) => { s.scrollProfessor.workshop.scrolls.push({ ...a }); }];
    for (const change of changes) { const s = fixture(), id = addScroll(s, 'IMPACT'); change(s, s.scrollProfessor.workshop.scrolls.find(a => a.id === id)!); const r = begin(s);
      player(s, r, H); expect(r.playerActions[0]).toMatchObject({ mode: 'LEARNED_SPELL', paidCost: 2, scroll: null }); }
  });
  it('no learnedspell or payableoriginal usesownrod/body/block withoutenemyweaponborrowing', () => {
    const s = fixture(); s.wizard.lessons['light-touch']!.learned = false; s.wizard.lessons['brief-ward']!.learned = false; s.town.clubLocation = 'HAND'; const r = begin(s);
    expect(player(s, r, H, random(), .5).selfGain).toBe(8); expect(player(s, r, B, random(), .5).enemyReduction).toBe(5); expect(s.spirituality).toBe(120); valid(s, r);
    const naked = fixture(); naked.spirituality = 0; const nr = begin(naked); expect(player(naked, nr, H).selfGain).toBe(12); expect(player(naked, nr, B).enemyReduction).toBe(10); valid(naked, nr);
  });
  it('stalesource, alteredoriginalinventory or substitutedoldLucan makes noaction orrandomdraw', () => {
    const s = fixture(), r = begin(s), rng = random(), source = structuredClone(r.source); source.targetAge = 49 as 48;
    expect(resolveProphecyMasterCombatAbility(s, G, 1, rng, r, source).selfGain).toBe(0); expect(rng.cursor).toBe(0); expect(r.playerActions).toHaveLength(0);
    s.scrollProfessor.workshop.kitsBought++; player(s, r, G, rng); expect(rng.cursor).toBe(0); expect(s.spirituality).toBe(120); expect(r.playerActions).toHaveLength(0);
    const other = fixture(); other.prophecyMaster.encounter.targetId = 'MY4-LUCAN-VEY' as 'PM3-OSRIC'; expect(currentProphecyMasterCombatSource(other)).toBeNull();
  });
  it('caps bothactors at6, preservesisolatedoutcome and rejects duplicatefinish', () => {
    const s = fixture(), r = begin(s); for (let i = 0; i < 6; i++) { player(s, r, G); enemy(s, r, 'FEINT'); }
    const rng = random(); player(s, r, G, rng); enemy(s, r, 'ARC_BOLT'); expect(r.playerActions).toHaveLength(6); expect(r.enemyActions).toHaveLength(6); expect(rng.cursor).toBe(0);
    const o = finishProphecyMasterCombatRound(s, r); expect(validateProphecyMasterRoundOutcome(o)).toBe(true); o.powerUses.FEINT++;
    expect(prophecyMasterRoundOutcome(r).powerUses.FEINT).toBe(6); expect(validateProphecyMasterRoundOutcome(o)).toBe(false); expect(() => finishProphecyMasterCombatRound(s, r)).toThrow();
  });
  it('actualdeath doesnotmoveorheal originalbody and stillclears paidwindow', () => {
    const s = fixture(), old = legacy(s), r = begin(s); player(s, r, G); enemy(s, r, 'ARC_BOLT'); s.health = 0;
    const o = finishProphecyMasterCombatRound(s, r, false); expect(o.sceneAfter).toMatchObject({ playerPosition: 'COURT', ordinaryWalkedMetres: 0 });
    expect(s.health).toBe(0); expect(s.spirituality).toBe(114); expect(s.mind).toBe(98); expect(s.prophecyMaster.life.clockSeconds).toBe(60); expect(legacy(s)).toEqual(old); expect(validateProphecyMasterRoundOutcome(o)).toBe(true);
  });
  it('replayscosts, chronology, claims, oldscrolls and nonthreateningomen/feint withoutphantominjury', () => {
    const s = fixture(), r = begin(s); player(s, r, G); enemy(s, r, 'FEINT'); const o = finishProphecyMasterCombatRound(s, r);
    expect(validateProphecyMasterRoundOutcome(o)).toBe(true);
    const changes: ((v: typeof o) => void)[] = [v => { v.playerSpiritualityAfter++; }, v => { v.playerMindAfter++; }, v => { v.enemySpirituality++; },
      v => { v.playerActions[0]!.paidCost = 0; }, v => { v.playerActions[0]!.mindCost = 0; }, v => { v.enemyActions[0]!.paidCost = 0; }, v => { v.enemyActions[0]!.windowConsumed = false; },
      v => { v.playerActions[0]!.threatens = true; }, v => { v.enemyActions[0]!.threatens = true; }, v => { v.enemyActions[0]!.order = 0; }, v => { v.propheticWindowAfter = true as false; },
      v => { v.enemyHealth--; }, v => { v.playerHealthAfter--; }, v => { v.enemyMind--; }, v => { v.enemyStatus = 'SURRENDERED'; }, v => { v.lifeClockSecondsAfter++; },
      v => { v.workshopAfter.scrolls[0]!.status = 'HELD'; }, v => { v.sceneAfter.playerPosition = 'EXIT'; }, v => { v.source = { ...v.source, actualOriginalBody: false } as unknown as ProphecyMasterCombatSource; }];
    for (const change of changes) { const bad = structuredClone(o); change(bad); expect(validateProphecyMasterRoundOutcome(bad)).toBe(false); }
  });
  it('keeps oldLucan70H17S surrendered and hides newOsric beforeS3', () => {
    const s = fixture(); expect(s.mystic.encounter).toMatchObject({ targetId: 'MY4-LUCAN-VEY', enemyHealth: 70, enemySpirituality: 17, enemyStatus: 'SURRENDERED' });
    expect(s.mystic.life.publicDisclosed).toBe(true); expect(currentProphecyMasterCombatSource(s)).toMatchObject({ targetAge: 48, distanceMetres: 4, enemyWeapon: 'PM3-OSRIC-ROD' });
    s.progression.sequence = 4; const view = projectProphecyMasterCombat(s);
    expect(view).toEqual({ enemyName: '', targetId: null, enemyMind: null, enemySpirituality: null, powerUses: null, scene: null, summary: '' });
    expect(view).not.toHaveProperty('source'); expect(JSON.stringify(view)).not.toMatch(/OSRIC|奥斯里克/);
  });
});
