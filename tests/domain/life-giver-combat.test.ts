import { beforeAll, describe, expect, it } from 'vitest';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import {
  LIFE_GIVER_COUNT_WHEEL, LIFE_GIVER_ENEMY_COUNT_WHEEL, LIFE_GIVER_PLAYER_ABILITIES, LIFE_GIVER_ENEMY_ABILITY_WHEEL,
  lifeGiverActionCount, lifeGiverEnemyActionCount, lifeGiverAbilityWheel, drawLifeGiverAbility, drawLifeGiverEnemyAbility,
  beginLifeGiverCombatRound, currentLifeGiverCombatSource, resolveLifeGiverCombatAbility, resolveLifeGiverEnemyAbility,
  finishLifeGiverCombatRound, lifeGiverRoundOutcome, validateLifeGiverCombatSource, validateLifeGiverRoundOutcome,
  type LifeGiverMoveId, type LifeGiverCombatSource,
} from '../../src/domain/life-giver/combat.js';
import { lifeGiverSnapshot } from './life-giver-test-fixture.js';
const VITALITY = 'moon.s2.bounded-vitality', SHELTER = 'moon.s2.shared-shelter';
const SUMMON = 'moon.s3.bounded-summoning', COOPERATE = 'moon.s3.guest-cooperation';
const PAPER = 'moon.s4.moon-paper-substitute', ARROW = 'moon.s4.blood-moon-arrow';
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'life-giver-directed-unit-checks', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || !Number.isInteger(n) || n < min || n > max) throw new Error(`Unexpected directed draw ${cursor}: ${n}`); return n;
  } };
}
let original: SliceState;
beforeAll(() => { original = lifeGiverSnapshot('combatStart'); });
/** Explicit local domain-unit setup, never a natural campaign capture. Resource
 * overrides below isolate boundary conditions; they do not assert whole-save
 * provenance. Public command/terminal tests use separately valid inputs. */
function directed(setup?: (s: SliceState) => void): SliceState { const s = structuredClone(original); setup?.(s); return s; }
const begin = (s: SliceState) => beginLifeGiverCombatRound(s, 'ATTACK', random());
const effect = (s: SliceState, r: ReturnType<typeof begin>, id: LifeGiverMoveId, ...rolls: number[]) => resolveLifeGiverCombatAbility(s, id, 1, random(...rolls), r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveLifeGiverEnemyAbility>[1]) => resolveLifeGiverEnemyAbility(s, id, 1, random(), r);
function finish(s: SliceState, r: ReturnType<typeof begin>, continuing = true) { const o = finishLifeGiverCombatRound(s, r, continuing); expect(validateLifeGiverRoundOutcome(o)).toBe(true); return o; }

describe('Life Giver directed original-body paid combat units', () => {
  it('keeps the exact six-count wheel and one draw at each ability boundary for every stance', () => {
    const s = directed(); expect(LIFE_GIVER_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(LIFE_GIVER_ENEMY_COUNT_WHEEL).toEqual(LIFE_GIVER_COUNT_WHEEL);
    for (const [roll, count] of [[1,1],[10,1],[11,2],[25,2],[26,3],[50,3],[51,4],[75,4],[76,5],[90,5],[91,6],[100,6]]) {
      expect(lifeGiverActionCount(roll!)).toBe(count); expect(lifeGiverEnemyActionCount(roll!)).toBe(count);
    }
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as (SliceStance | null)[]) {
      const weights = LIFE_GIVER_PLAYER_ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
      let boundary = 0; const wheel = lifeGiverAbilityWheel(s, stance), total = weights.reduce((a,b) => a+b, 0);
      LIFE_GIVER_PLAYER_ABILITIES.forEach((a,i) => { const first = boundary+1; boundary += weights[i]!; const rng = random(first, boundary);
        expect(drawLifeGiverAbility(rng,s,stance)).toBe(a.id); expect(drawLifeGiverAbility(rng,s,stance)).toBe(a.id); expect(rng.cursor).toBe(2);
        expect(wheel[i]!.weight).toBe(weights[i]!/total*100);
      });
    }
    let boundary = 0;
    for (const a of LIFE_GIVER_ENEMY_ABILITY_WHEEL) { const first = boundary+1; boundary += a.weight; const rng = random(first,boundary);
      expect(drawLifeGiverEnemyAbility(rng)).toBe(a.id); expect(drawLifeGiverEnemyAbility(rng)).toBe(a.id); expect(rng.cursor).toBe(2); }
  });

  it('pays real summon6S and crossing6 stamina while retaining the exact body and owned chime objects', () => {
    const s = directed(), p = s.summoningMaster.life.partner, chime = p.chime, before = structuredClone(p), r = begin(s), spirit = s.spirituality;
    effect(s,r,SUMMON,1); effect(s,r,SUMMON);
    expect(s.summoningMaster.life.partner).toBe(p); expect(p.chime).toBe(chime);
    expect(p).toMatchObject({ id: before.id, bodyId: before.bodyId, source: before.source, location: 'YARD', stamina: before.stamina-6, gateCrossings: before.gateCrossings+1 });
    expect(s.spirituality).toBe(spirit-6); expect(r.playerActions.map(a => a.paidCost)).toEqual([6,0]);
    const o = finish(s,r); expect(o.ordinaryReturnMetres).toBe(30); expect(p.location).toBe('HOME'); expect(p.ordinaryDistanceM).toBe(before.ordinaryDistanceM+30);
  });

  it('charges a failed summon once, without crossing, replacement, refund or retry check', () => {
    const s = directed(), p = structuredClone(s.summoningMaster.life.partner), r = begin(s), spirit = s.spirituality;
    effect(s,r,SUMMON,100); effect(s,r,SUMMON); expect(s.summoningMaster.life.partner).toEqual(p);
    expect(s.spirituality).toBe(spirit-6); expect(r.playerActions.map(a => a.rolls)).toEqual([[100],[]]); expect(finish(s,r).ordinaryReturnMetres).toBe(0);
  });

  it.each(['HOME','UNWILLING','FATIGUED','LOW_MIND','LOW_S'] as const)('uses explicit ordinary fallback for %s without hidden checks or cost', condition => {
    const s = directed(s => { const p = s.summoningMaster.life.partner;
      if (condition === 'HOME') { s.lifeGiver.encounter.guestPolicy = 'HOME'; s.lifeGiver.encounter.guestPermit = null; }
      if (condition === 'UNWILLING') p.willing = false;
      if (condition === 'FATIGUED') p.stamina = 5;
      if (condition === 'LOW_MIND') p.mind = 29;
      if (condition === 'LOW_S') s.spirituality = 5;
    }), before = structuredClone(s), r = begin(s);
    expect(effect(s,r,SUMMON)).toMatchObject({ selfGain:0, enemyReduction:10 });
    expect(effect(s,r,COOPERATE).selfGain).toBe(s.town.clubLocation === 'HAND' ? 16 : 12);
    expect(effect(s,r,VITALITY).enemyReduction).toBe(10); expect(effect(s,r,SHELTER).enemyReduction).toBe(10);
    expect(s).toEqual(before); expect(r.playerActions.every(a => a.paidCost === 0 && a.rolls.length === 0 && a.beadId === null)).toBe(true); finish(s,r);
  });

  it('uses exactly one paid bead and 6S to restore only real missing stamina, at most12 and once per round', () => {
    const s = directed(s => { s.summoningMaster.life.partner.stamina = 50; }), p = s.summoningMaster.life.partner, r = begin(s), before = structuredClone(s), bead = s.lifeGiver.life.beads.find(b => b.purpose === 'COMBAT' && b.status === 'READY')!;
    effect(s,r,SUMMON,1); effect(s,r,VITALITY,1); effect(s,r,VITALITY);
    expect(p.stamina).toBe(56); expect(p.health).toBe(before.summoningMaster.life.partner.health); expect(p.mind).toBe(before.summoningMaster.life.partner.mind);
    expect(s.spirituality).toBe(before.spirituality-12); expect(s.lifeGiver.life.beads.find(b => b.id === bead.id)).toBe(bead);
    expect(bead).toMatchObject({ status:'SPENT', location:'PLAYER', abilityId:VITALITY, paidPennies:60, combatRound:r.source.round });
    expect(finish(s,r)).toMatchObject({ vitalityUses:1, vitalitySuccesses:1, staminaRestored:12 }); expect(s.progression.mastery).toEqual(before.progression.mastery);
  });

  it('never overfills stamina and cannot use an unfatigued present guest as a second activation target', () => {
    const s = directed(s => { s.summoningMaster.life.partner.stamina = 100; }), r = begin(s);
    effect(s,r,SUMMON,1); effect(s,r,VITALITY,1); effect(s,r,VITALITY);
    expect(s.summoningMaster.life.partner.stamina).toBe(100); expect(r.playerActions[1]!.guestStaminaRestored).toBe(6); expect(r.playerActions[2]!.paidCost).toBe(0); finish(s,r);
  });

  it.each([VITALITY,SHELTER] as const)('retains failed %s actual costs and one-attempt limit without awarding effects or mastery', id => {
    const s = directed(), r = begin(s), before = structuredClone(s); effect(s,r,SUMMON,1); effect(s,r,id,100); effect(s,r,id);
    expect(r.playerActions[1]).toMatchObject({ paidCost:id === VITALITY ? 6 : 4, beadId:expect.any(String), selfGain:0, enemyReduction:0 });
    expect(r.playerActions[2]!.rolls).toEqual([]); const o = finish(s,r);
    expect(o.staminaRestored).toBe(0); expect(o.shelterEffects).toBe(0); expect(o.totalPlayerHealthSpent).toBe(0);
    expect(s.health).toBe(before.health); expect(s.progression.mastery).toEqual(before.progression.mastery);
  });

  it.each(['NO_BEAD','LOW_S','LOW_HEALTH'] as const)('does not pay shelter for %s even with actual consented presence', condition => {
    const s = directed(s => { if(condition === 'NO_BEAD') s.lifeGiver.life.beads = s.lifeGiver.life.beads.filter(b => b.purpose !== 'COMBAT');
      if(condition === 'LOW_S') s.spirituality = 9; if(condition === 'LOW_HEALTH') s.health = 10; }), r = begin(s);
    effect(s,r,SUMMON,1); const before = structuredClone(s); expect(effect(s,r,SHELTER).enemyReduction).toBe(10); expect(s).toEqual(before); finish(s,r);
  });

  it('shelter4S and one bead apply only to successful cooperation: ownH−5, guest3 and additional reduction20', () => {
    const s = directed(), p = s.summoningMaster.life.partner, r = begin(s), before = structuredClone(s);
    effect(s,r,SUMMON,1); effect(s,r,SHELTER,1); expect(s.health).toBe(before.health);
    effect(s,r,COOPERATE,100); expect(s.health).toBe(before.health); expect(s.lifeGiver.encounter.shelterOpen).toBe(true);
    effect(s,r,COOPERATE,1); effect(s,r,COOPERATE,1); effect(s,r,SHELTER);
    expect(r.playerActions[2]).toMatchObject({ paidCost:3,guestStaminaSpent:8,shelterApplied:false,playerHealthSpent:0 });
    expect(r.playerActions[3]).toMatchObject({ paidCost:3,guestStaminaSpent:3,shelterApplied:true,playerHealthSpent:5,selfGain:32,enemyReduction:36 });
    expect(r.playerActions[4]).toMatchObject({ guestStaminaSpent:8,shelterApplied:false,enemyReduction:16 });
    expect(p.stamina).toBe(before.summoningMaster.life.partner.stamina-6-8-3-8); expect(s.health).toBe(before.health-5);
    expect(s.spirituality).toBe(before.spirituality-6-4-9); expect(s.progression.mastery).toEqual(before.progression.mastery);
    expect(finish(s,r)).toMatchObject({ shelterUses:1,shelterSuccesses:1,shelterEffects:1,totalPlayerHealthSpent:5,shelterExpired:false });
  });

  it('unused successful shelter expires without phantom effect, health cost or mastery', () => {
    const s = directed(), r = begin(s), before = structuredClone(s); effect(s,r,SUMMON,1); effect(s,r,SHELTER,1); effect(s,r,'OBSERVE');
    expect(finish(s,r)).toMatchObject({ shelterSuccesses:1,shelterEffects:0,shelterExpired:true,totalPlayerHealthSpent:0 });
    expect(s.health).toBe(before.health); expect(s.lifeGiver.encounter.shelterOpen).toBe(false); expect(s.progression.mastery).toEqual(before.progression.mastery);
  });

  it('JAM pays actual4S each time, breaks the real shelter and door once and never deletes the original guest', () => {
    const s = directed(), p = s.summoningMaster.life.partner, r = begin(s), before = structuredClone(s); effect(s,r,SUMMON,1); effect(s,r,SHELTER,1);
    enemy(s,r,'JAM'); enemy(s,r,'JAM'); expect(p.location).toBe('YARD'); expect(p.mind).toBe(before.summoningMaster.life.partner.mind-8);
    expect(r.enemyActions[0]).toMatchObject({ paidCost:4,gateDestroyed:true,shelterDestroyed:true,guestMindDamage:8 });
    expect(r.enemyActions[1]).toMatchObject({ paidCost:4,gateDestroyed:false,shelterDestroyed:false,guestMindDamage:0 });
    effect(s,r,COOPERATE,1); expect(r.playerActions.at(-1)).toMatchObject({ guestStaminaSpent:8,playerHealthSpent:0,enemyReduction:16,shelterApplied:false });
    expect(finish(s,r)).toMatchObject({ shelterBroken:1,shelterEffects:0,ordinaryReturnMetres:30,enemySpirituality:112 }); expect(p.chime).toEqual(before.summoningMaster.life.partner.chime);
  });

  it('JAM before actual arrival cannot damage a HOME guest, but first post-arrival JAM can', () => {
    const s = directed(), r = begin(s), mind = s.summoningMaster.life.partner.mind; enemy(s,r,'JAM'); expect(s.summoningMaster.life.partner.mind).toBe(mind);
    effect(s,r,SUMMON,1); enemy(s,r,'JAM'); expect(s.summoningMaster.life.partner.mind).toBe(mind-8); finish(s,r);
  });

  it('uses independent actual enemy S7/6/4 and its own original club when a planned power is unaffordable', () => {
    const s = directed(), r = begin(s), spirit = s.spirituality;
    expect(enemy(s,r,'DARK_BOLT')).toMatchObject({ selfGain:105,threatens:true }); expect(enemy(s,r,'WARD').enemyReduction).toBe(60); enemy(s,r,'JAM');
    expect(s.spirituality).toBe(spirit); expect(finish(s,r)).toMatchObject({ enemySpirituality:103,powerUses:{DARK_BOLT:1,WARD:1,JAM:1} });
    const low = directed(s => { s.lifeGiver.encounter.enemySpirituality = 3; s.lifeGiver.encounter.powerUses = {DARK_BOLT:15,WARD:2,JAM:0}; }), lowRound = begin(low);
    expect(resolveLifeGiverEnemyAbility(low,'DARK_BOLT',.5,random(),lowRound).selfGain).toBe(10);
    expect(lowRound.enemyActions[0]).toMatchObject({ planned:'DARK_BOLT',actual:'BODY_STRIKE',paidCost:0 }); expect(low.lifeGiver.encounter.enemySpirituality).toBe(3); finish(low,lowRound);
  });

  it('consumes the same pre-existing PREPARED paper once, never the two old consumed paper instances', () => {
    const s = directed(), originalPapers = structuredClone(s.witchKing.life.papers), paper = s.witchKing.life.papers.find(p => p.status === 'PREPARED')!, r = begin(s), spirit = s.spirituality;
    expect(paper).toBeDefined(); expect(effect(s,r,PAPER).enemyReduction).toBe(35); expect(effect(s,r,PAPER).enemyReduction).toBe(10);
    expect(s.witchKing.life.papers.find(p => p.id === paper.id)).toBe(paper); expect(paper.status).toBe('CONSUMED'); expect(s.spirituality).toBe(spirit-3);
    for(const old of originalPapers.filter(p => p.id !== paper.id)) expect(s.witchKing.life.papers.find(p => p.id === old.id)).toEqual(old);
    expect(finish(s,r).papersConsumed).toEqual([paper.id]);
  });

  it('inherits the actual old arrow mastery and real4S check, with ordinary lowS fallback and no added mastery', () => {
    const s = directed(), before = structuredClone(s), r = begin(s); expect(effect(s,r,ARROW,1).selfGain).toBe(45*(.65+.35*(s.progression.mastery[ARROW]??0)/500));
    effect(s,r,ARROW,100); expect(s.spirituality).toBe(before.spirituality-8); expect(s.progression.mastery).toEqual(before.progression.mastery); finish(s,r);
    const low = directed(s => {s.spirituality=3;}), lr=begin(low); expect(effect(low,lr,ARROW).selfGain).toBe(low.town.clubLocation==='HAND'?16:12); expect(low.spirituality).toBe(3); finish(low,lr);
  });

  it('allows actual guest death at the once-per-round original-club interception, retaining corpse and chime at YARD', () => {
    const s = directed(s => { s.summoningMaster.life.partner.health=5; }), r=begin(s), p=s.summoningMaster.life.partner;
    effect(s,r,SUMMON,1); effect(s,r,COOPERATE,1); enemy(s,r,'BODY_STRIKE');
    expect(p).toMatchObject({health:0,status:'DEAD',willing:false,location:'YARD',chime:{id:'SM3-CHIME',owner:'SM3-LUMEN'}});
    effect(s,r,VITALITY); effect(s,r,SHELTER); expect(finish(s,r).ordinaryReturnMetres).toBe(0); expect(p.location).toBe('YARD');
  });

  it('a living guest returns by the original30m route even when the player dies; no vitality resurrection occurs', () => {
    const s=directed(),r=begin(s); effect(s,r,SUMMON,1); s.health=0; const o=finish(s,r,false);
    expect(o).toMatchObject({playerHealthAfter:0,ordinaryReturnMetres:30}); expect(o.partnerAfter.location).toBe('HOME'); expect(s.health).toBe(0);
  });

  it('rejects missing, altered and stale source comparisons with zero resource changes or checks', () => {
    const s=directed(),r=begin(s),before=structuredClone(s);
    for(const source of [null,{...r.source,randomCursor:r.source.randomCursor+1},{...r.source,playerSpirituality:r.source.playerSpirituality-1},
      {...r.source,partner:{...r.source.partner,bodyId:'COPY'}},{...r.source,lifeAnchor:'COPY'}]) {
      expect(resolveLifeGiverCombatAbility(s,VITALITY,1,random(),r,source as LifeGiverCombatSource|null)).toMatchObject({selfGain:0,enemyReduction:0}); expect(s).toEqual(before);
    }
    expect(r.playerActions).toEqual([]); const unpaid=structuredClone(r.source); unpaid.combatBeads[0]!.paidPennies=0 as 60; expect(validateLifeGiverCombatSource(unpaid)).toBe(false);
    const duplicate=structuredClone(r.source); duplicate.combatBeads.push(structuredClone(duplicate.combatBeads[0]!)); expect(validateLifeGiverCombatSource(duplicate)).toBe(false);
    finish(s,r); expect(() => finishLifeGiverCombatRound(s,r)).toThrow(); expect(effect(s,r,VITALITY)).toMatchObject({selfGain:0,enemyReduction:0});
  });

  it('rejects paid action/roll/body/bead/order/counter tampering and keeps returned evidence detached', () => {
    const s=directed(),r=begin(s); effect(s,r,SUMMON,1); effect(s,r,SHELTER,1); effect(s,r,COOPERATE,1); const o=finish(s,r);
    const mutations: ((x: typeof o)=>void)[]=[x=>{x.playerActions[0]!.rolls=[];},x=>{x.playerActions[1]!.rolls.push(1);},x=>{x.playerActions[2]!.order=0;},
      x=>{x.playerActions[2]!.guestStaminaSpent=8;},x=>{x.playerActions[2]!.playerHealthSpent=0;},x=>{x.playerActions[2]!.enemyReduction=16;},
      x=>{x.playerSpiritualityAfter++;},x=>{x.totalPlayerHealthSpent=0;},x=>{x.shelterEffects=0;},x=>{x.ordinaryReturnMetres=0;},
      x=>{x.partnerAfter.chime.owner='COPY' as 'SM3-LUMEN';},x=>{x.combatBeads.find(b=>b.status==='SPENT')!.status='READY';}];
    for(const change of mutations){const bad=structuredClone(o);change(bad);expect(validateLifeGiverRoundOutcome(bad)).toBe(false);}
    o.partnerAfter.stamina++; expect(lifeGiverRoundOutcome(r).partnerAfter.stamina).toBe(s.summoningMaster.life.partner.stamina); expect(validateLifeGiverRoundOutcome(o)).toBe(false);
    expect(currentLifeGiverCombatSource(original)).not.toBeNull();
  });
});
