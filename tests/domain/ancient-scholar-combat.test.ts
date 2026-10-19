import { describe, expect, it } from 'vitest';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { MAGICIAN_COUNT_WHEEL } from '../../src/domain/magician/combat.js';
import { ANCIENT_SCHOLAR_COUNT_WHEEL, ANCIENT_SCHOLAR_ENEMY_COUNT_WHEEL, ANCIENT_SCHOLAR_ENEMY_ABILITY_WHEEL,
  ancientScholarActionCount, ancientScholarEnemyActionCount, ancientScholarAbilityWheel, drawAncientScholarAbility, drawAncientScholarEnemyAbility,
  beginAncientScholarCombatRound, currentAncientScholarCombatSource, resolveAncientScholarCombatAbility, resolveAncientScholarEnemyAbility,
  finishAncientScholarCombatRound, validateAncientScholarRoundOutcome, projectAncientScholarCombat, type AncientScholarMoveId } from '../../src/domain/ancient-scholar/combat.js';
import { ANCIENT_SCHOLAR_CASE_IDS } from '../../src/domain/ancient-scholar/life.js';
import { applyAncientScholarEncounter, blockAncientScholarEncounter, hasAncientScholarDisputeOpponent,
  projectAncientScholarEncounter, validateAncientScholarEncounter, validateAncientScholarEncounterCommand } from '../../src/domain/ancient-scholar/encounter.js';
import { ancientScholarPracticeFixture as fixture, ancientScholarPracticeContext as context, practiceOrdinary as ordinary, practiceAct as act } from './ancient-scholar-practice-fixture.js';
const B = 'diviner.s3.borrow-past', P = 'diviner.s3.historical-projection', H = 'diviner.s3.history-shelter';
function random(...rolls: number[]): ActionRandomStream { let cursor = 0; return { seed: 'directed-as3-test', get cursor() { return cursor; }, nextInt(min, max) { const value = rolls[cursor++]; if (value === undefined || value < min || value > max) throw new Error(`Unexpected RNG ${cursor}:${value} in ${min}..${max}`); return value; } }; }
function ready(start = true, kit = false) { const s = fixture(); for (const id of ANCIENT_SCHOLAR_CASE_IDS) ordinary(s, id); act(s, { type: 'REFLECT' });
  if (kit) { applyAncientScholarEncounter(s, { type: 'BUY_CURRENT_KIT' }, context(s)); applyAncientScholarEncounter(s, { type: 'LIGHT_CURRENT_LANTERN' }, context(s)); }
  if (start) applyAncientScholarEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context(s)); return s; }
const begin = (s: SliceState) => beginAncientScholarCombatRound(s, 'ATTACK', random());
const effect = (s: SliceState, id: AncientScholarMoveId, r: ReturnType<typeof begin>, rng = random(), physical = 1) => resolveAncientScholarCombatAbility(s, id, physical, rng, r);
const enemy = (s: SliceState, id: Parameters<typeof resolveAncientScholarEnemyAbility>[1], r: ReturnType<typeof begin>, physical = 1) => resolveAncientScholarEnemyAbility(s, id, physical, random(), r);
function finish(s: SliceState, r: ReturnType<typeof begin>) { const outcome = finishAncientScholarCombatRound(s, r); expect(validateAncientScholarRoundOutcome(outcome)).toBe(true); return outcome; }

describe('Ancient Scholar finite same-source six-slot battle', () => {
  it('retains both exact 1–6 count wheels and full inherited sectors alongside the three new abilities', () => {
    const s = ready(); expect(ANCIENT_SCHOLAR_COUNT_WHEEL).toEqual(MAGICIAN_COUNT_WHEEL); expect(ANCIENT_SCHOLAR_ENEMY_COUNT_WHEEL).toEqual(MAGICIAN_COUNT_WHEEL);
    expect([1, 11, 26, 51, 76, 91].map(ancientScholarActionCount)).toEqual([1, 2, 3, 4, 5, 6]); expect([1, 11, 26, 51, 76, 91].map(ancientScholarEnemyActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    const wheel = ancientScholarAbilityWheel(s, null); expect(wheel.reduce((n, x) => n + x.weight, 0)).toBeCloseTo(100);
    for (const id of ['diviner.s7.air-bullet', 'diviner.s7.paper-weapon', 'diviner.s7.flame-jump', 'diviner.s4.worm-assignment', 'diviner.s4.puppet-swap', B, P, H]) expect(wheel.some(a => a.id === id)).toBe(true);
    expect(drawAncientScholarAbility(random(1), s, null)).toBe('STRIKE'); expect(ANCIENT_SCHOLAR_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]);
    expect([1, 36, 61, 86, 96].map(n => drawAncientScholarEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT']);
  });
  it('requires a real report and a closed reception practice; ordinary refusal preserves the independent adult', () => {
    const s = fixture(); expect(blockAncientScholarEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('报告'); ordinary(s, 'past-reserve');
    const old = structuredClone([s.bizarroSorcerer, s.marionettist]); applyAncientScholarEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s));
    expect(s.combat).toBeNull(); expect(s.ancientScholar.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    expect(validateAncientScholarEncounter(s)).toBe(true); expect(blockAncientScholarEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('不能'); expect([s.bizarroSorcerer, s.marionettist]).toEqual(old);
  });
  it('has no free new inventory and only an actual one-time purchase yields current paper, club and oil', () => {
    const s = ready(false), old = structuredClone([s.clown, s.magician, s.town]), cash = s.cash, ap = s.actionsRemaining;
    expect(s.ancientScholar.encounter.supplies).toMatchObject({ clubHeld: false, paperSheets: 0, oilHeld: 0, pricePaid: 0 });
    applyAncientScholarEncounter(s, { type: 'BUY_CURRENT_KIT' }, context(s)); expect(s.cash).toBe(cash - 120); expect(s.actionsRemaining).toBe(ap - 1);
    expect(s.ancientScholar.encounter.supplies).toMatchObject({ clubHeld: true, paperSheets: 4, oilHeld: 1, pricePaid: 120 }); expect(blockAncientScholarEncounter(s, { type: 'BUY_CURRENT_KIT' })).toContain('不凭空');
    applyAncientScholarEncounter(s, { type: 'LIGHT_CURRENT_LANTERN' }, context(s)); expect(s.ancientScholar.encounter.supplies).toMatchObject({ oilHeld: 0, oilSpent: 1, lanternPreparedWeek: s.week });
    expect(blockAncientScholarEncounter(s, { type: 'LIGHT_CURRENT_LANTERN' })).toContain('没有'); expect([s.clown, s.magician, s.town]).toEqual(old); expect(validateAncientScholarEncounter(s)).toBe(true);
  });
  it('never lets nonzero centuries-old paper, oil, figurines or a historical club become current resources', () => {
    const s = ready(); s.clown.paperSheets = 90; s.magician.figurinesHeld = 90; s.magician.figurinesMade = 90; s.magician.lantern.prepared = true; s.magician.lantern.oilSpent = 99; s.town.clubLocation = 'HAND';
    const old = structuredClone([s.clown, s.magician, s.town]), r = begin(s);
    expect(effect(s, 'STRIKE', r).selfGain).toBe(12); expect(effect(s, 'diviner.s8.paper-dagger', r).label).toContain('旧纸'); expect(effect(s, 'diviner.s7.paper-weapon', r).selfGain).toBe(12);
    expect(effect(s, 'diviner.s7.flame-control', r).selfGain).toBe(12); expect(effect(s, 'diviner.s7.flame-jump', r).enemyReduction).toBe(10); expect([s.clown, s.magician, s.town]).toEqual(old); finish(s, r);
  });
  it('pays only new actual paper and same-week lamp sources for inherited abilities', () => {
    const s = ready(true, true), old = structuredClone([s.clown, s.magician, s.town]), r = begin(s);
    expect(effect(s, 'STRIKE', r).selfGain).toBe(16); expect(effect(s, 'diviner.s8.paper-dagger', r).selfGain).toBe(34); expect(effect(s, 'diviner.s7.paper-weapon', r).selfGain).toBe(22);
    expect(effect(s, 'diviner.s7.flame-control', r).selfGain).toBe(31.2); expect(effect(s, 'diviner.s7.flame-jump', r).enemyReduction).toBe(31.2);
    expect(s.ancientScholar.encounter.supplies).toMatchObject({ paperSheets: 2, paperSpent: 2, oilHeld: 0, oilSpent: 1 }); expect(s.spirituality).toBe(113); expect([s.clown, s.magician, s.town]).toEqual(old); finish(s, r);
  });
  it('does not carry a previously prepared lamp across a new week', () => {
    const s = ready(false, true); s.week++; applyAncientScholarEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context(s)); const r = begin(s);
    expect(effect(s, 'diviner.s7.flame-control', r).label).toContain('没有本时代当周'); expect(s.spirituality).toBe(120); finish(s, r);
  });
  it('borrows only a real stronger reserve, pays current upkeep, uses 2 temporary SP and loses the rest', () => {
    const s = ready(); s.spirituality = 1; const health = s.health, mind = s.mind, r = begin(s);
    const result = effect(s, B, r, random(1)); expect(result.selfGain).toBe(60); expect(s.spirituality).toBe(0); expect(s.health).toBe(health); expect(s.mind).toBe(mind);
    expect(r.playerActions[0]).toMatchObject({ paidCost: 1, borrowedReserve: 6, reserveSpent: 2, discardedReserve: 4, activeSeconds: 6, sourceId: s.ancientScholar.life.sample!.id });
    const o = finish(s, r); expect(o).toMatchObject({ playerSpiritualityAfter: 0, borrowedReserveAfter: 0, activeImagesAfter: 0, ownerAt: 'PRESENT_MAT', elapsedSeconds: 60 });
  });
  it('does not borrow without current upkeep, with weaker history, or twice in one round', () => {
    const zero = ready(); zero.spirituality = 0; const zr = begin(zero); expect(effect(zero, B, zr).label).toContain('没有真实过去'); finish(zero, zr);
    const same = ready(), sr = begin(same); expect(effect(same, B, sr).selfGain).toBe(12); expect(same.spirituality).toBe(120); finish(same, sr);
    const s = ready(); s.spirituality = 90; const r = begin(s); effect(s, B, r, random(1)); expect(effect(s, B, r).label).toContain('本轮已经借过'); expect(s.spirituality).toBe(89); finish(s, r);
  });
  it('retains failed borrow costs and no benefit; no reroll or automatic restore', () => {
    const s = ready(); s.spirituality = 90; const r = begin(s), a = effect(s, B, r, random(100)); expect(a.selfGain).toBe(0); expect(a.label).toContain('失败贡献0');
    expect(s.spirituality).toBe(89); expect(r.playerActions[0]).toMatchObject({ borrowedReserve: 0, reserveSpent: 0, discardedReserve: 0 }); finish(s, r);
  });
  it('summons only the verified ordinary tag image once, at a paid cost and with expiry', () => {
    const s = ready(), old = structuredClone(s.bizarroSorcerer), r = begin(s); const a = effect(s, P, r, random(1)); expect(a.enemyReduction).toBe(12); expect(a.label).toContain('1克普通原签');
    expect(r.playerActions[0]).toMatchObject({ paidCost: 4, sourceId: 'BR4-TAG-1', activeSeconds: 30 }); expect(r.playerActions[0]!.imageId).not.toBe('BR4-TAG-1');
    expect(effect(s, P, r).label).toContain('本轮唯一'); expect(s.spirituality).toBe(116); expect(s.bizarroSorcerer).toEqual(old); expect(finish(s, r).activeImagesAfter).toBe(0);
  });
  it('pays a failed projection and never produces a high-rank source or asks unknown history', () => {
    const s = ready(), r = begin(s); const a = effect(s, P, r, random(100)); expect(a.enemyReduction).toBe(0); expect(r.playerActions[0]!.imageId).toBeNull(); expect(s.spirituality).toBe(116); finish(s, r);
    expect(validateAncientScholarEncounterCommand({ type: 'ENCOUNTER_FIGHT', angelProjection: true })).toBe(false);
  });
  it('uses one same-body 10-second shelter then actually returns; no parallel self or guaranteed escape', () => {
    const s = ready(), r = begin(s); const a = effect(s, H, r, random(1)); expect(a.enemyReduction).toBe(35); expect(a.label).toContain('同一本人'); expect(a.label).toContain('本场同一原垫');
    expect(r.playerActions[0]).toMatchObject({ paidCost: 4, activeSeconds: 10, returnedToPresent: true, sourceId: s.ancientScholar.life.fragment!.id });
    expect(effect(s, H, r).label).toContain('本轮藏身'); expect(s.spirituality).toBe(116); expect(finish(s, r).ownerAt).toBe('PRESENT_MAT');
  });
  it('keeps a failed shelter in reality and preserves the 4 current SP cost', () => { const s = ready(), r = begin(s); expect(effect(s, H, r, random(100)).enemyReduction).toBe(0); expect(s.spirituality).toBe(116); expect(r.playerActions[0]).toMatchObject({ activeSeconds: 0, returnedToPresent: true }); finish(s, r); });
  it('falls back ordinarily when true learning sources are missing, without forging a source', () => {
    for (const [id, erase] of [[B, (s: SliceState) => { s.ancientScholar.life.sample = null; }], [P, (s: SliceState) => { s.ancientScholar.life.tagFamiliarity = null; }], [H, (s: SliceState) => { s.ancientScholar.life.fragment = null; }]] as const) {
      const s = ready(); erase(s); const r = begin(s); expect(effect(s, id, r).label).toContain('没有'); expect(s.spirituality).toBe(120); finish(s, r);
    }
  });
  it('does not turn the released old mouse or an image into a free marionette or worm', () => { const s = ready(), old = structuredClone(s.bizarroSorcerer), r = begin(s); for (const id of ['diviner.s4.worm-assignment', 'diviner.s4.puppet-swap'] as const) { const a = effect(s, id, r); expect(a.selfGain).toBe(0); expect(a.enemyReduction).toBe(0); expect(a.label).toContain('原鼠失败活放生'); } expect(s.bizarroSorcerer).toEqual(old); finish(s, r); });
  it('retains original opponent resources and exact paid fallback without reviving old people', () => {
    const s = ready(), old = structuredClone([s.marionettist, s.bizarroSorcerer]), r = begin(s); expect(currentAncientScholarCombatSource(s)).toMatchObject({ targetId: 'AS3-ROOK-VENN', targetAge: 41, targetSequence: 4, enemyWeapon: 'AS3-ROOK-CLUB', independentMind: true, pursuit: false });
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(75); expect(enemy(s, 'WARD', r).enemyReduction).toBe(45); expect(enemy(s, 'COMPOSE', r).selfGain).toBe(0); expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(20);
    expect(s.ancientScholar.encounter.enemySpirituality).toBe(111); expect(s.ancientScholar.encounter.powerUses).toEqual({ ARC_BOLT: 1, WARD: 1, COMPOSE: 1 }); expect([s.marionettist, s.bizarroSorcerer]).toEqual(old); finish(s, r);
    const t = ready(); t.ancientScholar.encounter.powerUses = { ARC_BOLT: 24, WARD: 0, COMPOSE: 0 }; t.ancientScholar.encounter.enemySpirituality = 0; const tr = begin(t);
    expect(enemy(t, 'ARC_BOLT', tr).label).toContain('灵性不足'); expect(enemy(t, 'WARD', tr).selfGain).toBe(20); expect(t.ancientScholar.encounter.enemySpirituality).toBe(0); finish(t, tr);
  });
  it('preserves actual original injury transfer costs without healing, clearing risk or moving wounds into history', () => {
    const s = ready(); s.injuries = [{ id: 'actual-heavy', severity: 'HEAVY', acquiredRevision: s.revision, treatedRevision: null }]; s.magician.damageTransfers = []; s.injuryRisk = 3; const h = s.health, r = begin(s);
    expect(ancientScholarAbilityWheel(s, null).some(a => a.id === 'diviner.s7.damage-transfer')).toBe(true); effect(s, 'diviner.s7.damage-transfer', r);
    expect(s.injuries[0]!.severity).toBe('LIGHT'); expect(s.magician.damageTransfers).toEqual(['actual-heavy']); expect(s.spirituality).toBe(117); expect(s.health).toBe(h); expect(s.injuryRisk).toBe(3); finish(s, r);
  });
  it('rejects changed body, source, snapshot, current resources and supplies without a paid action', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.spirituality--; }, (s: SliceState) => { s.ancientScholar.life.sample!.spirituality--; }, (s: SliceState) => { s.ancientScholar.encounter.supplies.paperSheets--; }]) {
      const s = ready(true, true), r = begin(s); change(s); const before = structuredClone(s); expect(effect(s, P, r).selfGain).toBe(0); expect(s).toEqual(before); expect(r.playerActions).toEqual([]);
    }
  });
  it('accepts actual advanced knowledge above100 without inventing a new cap', () => { const s = ready(); s.character.coreStats.knowledge = 420; const r = begin(s); expect(effect(s, H, r, random(1)).enemyReduction).toBe(35); finish(s, r); });
  it('replays every payment and rejects invented permanent resources, lifespan, copied bodies or images', () => {
    const s = ready(true, true); s.spirituality = 90; const r = begin(s); effect(s, B, r, random(1)); enemy(s, 'ARC_BOLT', r); effect(s, P, r, random(1)); effect(s, H, r, random(1)); const o = finish(s, r);
    const edits = [ (x: typeof o) => { x.playerSpiritualityAfter++; }, (x: typeof o) => { x.playerActions[0]!.discardedReserve++; }, (x: typeof o) => { x.source.sample!.bodyId = 'second-self'; }, (x: typeof o) => { x.playerActions[1]!.activeSeconds = 10; }, (x: typeof o) => { x.suppliesAfter.paperSheets++; }, (x: typeof o) => { x.enemySpirituality++; }, (x: typeof o) => { x.elapsedSeconds = 30 as 60; } ];
    for (const edit of edits) { const copy = structuredClone(o); edit(copy); expect(validateAncientScholarRoundOutcome(copy)).toBe(false); }
    expect(() => finishAncientScholarCombatRound(s, r)).toThrow(); expect(effect(s, B, r).label).toContain('来源');
  });
  it('projects the new actual adult, current resources and ordinary exit independently of state', () => {
    const s = ready(), before = structuredClone(s); const p = projectAncientScholarEncounter(s); expect(p.encounter).toMatchObject({ age: 41, sequence: 4, distanceMetres: 2, pursuit: false });
    expect(p.encounter!.abilities.map(a => a.cost)).toEqual([5, 4, 0]); p.encounter!.enemySpirituality = 999; expect(s).toEqual(before);
    expect(projectAncientScholarCombat(s).summary).toContain('1250/底125'); expect(hasAncientScholarDisputeOpponent(s)).toBe(true); expect(validateAncientScholarEncounter(s)).toBe(true);
  });
});
