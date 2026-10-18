import { beforeAll, describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, statusPenalty } from '../../src/domain/slice/combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import {
  CONCEALMENT_SERVANT_COUNT_WHEEL, CONCEALMENT_SERVANT_ENEMY_COUNT_WHEEL, CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL,
  concealmentServantActionCount, concealmentServantEnemyActionCount, concealmentServantAbilityWheel,
  drawConcealmentServantAbility, drawConcealmentServantEnemyAbility, beginConcealmentServantCombatRound,
  currentConcealmentServantCombatSource, resolveConcealmentServantCombatAbility, resolveConcealmentServantEnemyAbility,
  finishConcealmentServantCombatRound, projectConcealmentServantCombat, validateConcealmentServantRoundOutcome,
  type ConcealmentServantMoveId, type ConcealmentServantCombatSource,
} from '../../src/domain/concealment-servant/combat.js';
import { concealmentServantSnapshot } from './concealment-servant-test-fixture.js';
const CONCEAL = 'darkness.s2.bounded-concealment', VEIL = 'darkness.s2.trace-veil';
const DISSOLUTION = 'darkness.s3.dark-dissolution', SLEEP = 'darkness.s3.sleep-fear';
const MISFORTUNE = 'darkness.s4.limited-misfortune', LEAF = 'darkness.s5.spirit-assistance';
const abilities = [
  { id: CONCEAL, weight: 20, stance: 'DEFEND' }, { id: VEIL, weight: 20, stance: 'CONTROL' },
  { id: DISSOLUTION, weight: 20, stance: 'ATTACK' }, { id: SLEEP, weight: 15, stance: 'CONTROL' },
  { id: MISFORTUNE, weight: 10, stance: 'CONTROL' }, { id: LEAF, weight: 15, stance: 'DEFEND' },
] as const;
let original: SliceState;
beforeAll(() => { original = concealmentServantSnapshot('combatStart'); });
/** Slot-only directed unit inputs. Scripted checks below are NOT natural captures
 * or valid full rounds. Whole-round replay is tested separately without mocks. */
function fixture(change?: (s: SliceState) => void): SliceState { const s = structuredClone(original); change?.(s); return s; }
function random(s: SliceState, ...values: number[]): ActionRandomStream {
  let index = 0, cursor = s.random.cursor;
  return { seed: s.random.seed, get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[index++];
    if (value === undefined || !Number.isInteger(value) || value < min || value > max) throw new Error(`Unexpected unit check ${index}: ${value}`);
    cursor++; return value;
  } };
}
const begin = (s: SliceState) => beginConcealmentServantCombatRound(s, 'ATTACK', random(s));
const player = (s: SliceState, r: ReturnType<typeof begin>, id: ConcealmentServantMoveId, ...rolls: number[]) =>
  resolveConcealmentServantCombatAbility(s, id, 1 - statusPenalty(r.source.playerHealth, 100), random(s, ...rolls), r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveConcealmentServantEnemyAbility>[1]) =>
  resolveConcealmentServantEnemyAbility(s, id, 1 - statusPenalty(r.source.enemyHealth, 100), random(s), r);
const uses = (s: SliceState) => s.concealmentServant.encounter.abilityUses;
const empty = { concealment: null, veil: null, anchorReady: false, anchorUsed: false };

describe('Concealment Servant exact paid slots and original finite windows (directed units)', () => {
  it('uses the exact six-count thresholds on both sides', () => {
    expect(CONCEALMENT_SERVANT_COUNT_WHEEL.map(a => a.weight)).toEqual([10,15,25,25,15,10]);
    expect(CONCEALMENT_SERVANT_ENEMY_COUNT_WHEEL).toEqual(CONCEALMENT_SERVANT_COUNT_WHEEL);
    for (const [roll,count] of [[1,1],[10,1],[11,2],[25,2],[26,3],[50,3],[51,4],[75,4],[76,5],[90,5],[91,6],[100,6]]) {
      expect(concealmentServantActionCount(roll!)).toBe(count); expect(concealmentServantEnemyActionCount(roll!)).toBe(count);
    }
  });
  it('draws every neutral and stance-weighted boundary with one real draw per slot', () => {
    const s = fixture(); expect(concealmentServantAbilityWheel(s,null).map(a => a.weight)).toEqual([20,20,20,15,10,15]);
    for (const stance of [null,'ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'] as (SliceStance | null)[]) {
      const weights = abilities.map(a => a.weight * (a.stance === stance ? 5 : 4)), total = weights.reduce((n,w) => n+w,0);
      const wheel = concealmentServantAbilityWheel(s,stance); let boundary = 0;
      abilities.forEach((a,i) => { const first = boundary+1; boundary += weights[i]!; const rng = random(s,first,boundary), cursor = rng.cursor;
        expect(drawConcealmentServantAbility(rng,s,stance)).toBe(a.id); expect(drawConcealmentServantAbility(rng,s,stance)).toBe(a.id);
        expect(rng.cursor).toBe(cursor+2); expect(wheel[i]).toMatchObject({ id:a.id, weight:weights[i]!/total*100 });
      });
    }
    let boundary = 0; expect(CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35,25,20,15,5]);
    for (const a of CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL) { const first = boundary+1; boundary += a.weight; const rng = random(s,first,boundary), cursor = rng.cursor;
      expect(drawConcealmentServantEnemyAbility(rng)).toBe(a.id); expect(drawConcealmentServantEnemyAbility(rng)).toBe(a.id); expect(rng.cursor).toBe(cursor+2);
    }
  });
  it('publishes those exact real wheels and current independent resources', () => {
    const s = fixture(), p = projectSliceState(s).combat!, detail = projectConcealmentServantCombat(s);
    expect(p.playerCountWheel).toEqual(CONCEALMENT_SERVANT_COUNT_WHEEL); expect(p.enemyCountWheel).toEqual(CONCEALMENT_SERVANT_ENEMY_COUNT_WHEEL);
    const enemyLabels = ['有限暗矢：7S/105；仍需检索原目标','有限护术：6S/减60','原门口可达原身体：原棍20×身体','原场照明锚：4S/每轮一次，打断当前或下一新窗口','判断偏差：−22.5'];
    const playerLabels = ['有限房间隐秘（6S/知识18；≤60秒，后续暗矢才减35）','有限遮踪（5S/意志18；原弱标记≤20秒，后续暗矢才减20）','继承黑暗毁灭（6S/知识18，65×原掌握）','继承睡恐短时压力（5S/意志18，减32）','继承有限厄运（4S/意志16，减22）','同一原卷叶（先2S派出0贡献；后槽2S协助减22）'];
    expect(p.enemyAbilityWheel).toEqual(CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:enemyLabels[index]})));
    expect(p.playerAbilityWheel).toEqual(playerAbilityWheel(s,null).map((entry,index)=>({...entry,label:playerLabels[index]})));
    expect(p.playerAbilityWheel.map(({id,weight})=>({id,weight}))).toEqual(concealmentServantAbilityWheel(s,null).map(({id,weight})=>({id,weight})));
    for (const stance of ['ATTACK','DEFEND','CONTROL','PREPARE'] as const) expect(p.playerAbilityWheels?.[stance]).toEqual(playerAbilityWheel(s,stance).map((entry,index)=>({...entry,label:playerLabels[index]})));
    expect(p.playerAbilityWheels?.RETREAT).toEqual([]);
    expect(detail).toMatchObject({ targetId:'CS2-OSWIN', playerHealth:s.health, playerMind:s.mind, playerSpirituality:s.spirituality,
      enemyHealth:100, enemyMind:100, enemySpirituality:120, maxSpirituality:120, originalExit:true, pursuit:false });
    expect(currentConcealmentServantCombatSource(s)).toMatchObject({ targetAge:47,targetSequence:2,targetCore:24,enemyWeapon:'CS2-OSWIN-CLUB',ordinaryExit:true,space:'CS2-OSWIN-ROOM',roomMetres:6 });
  });
  it.each([[CONCEAL,6,'BOUNDED_CONCEALMENT',70],[VEIL,5,'TRACE_VEIL',85]] as const)('pays %s to open a window, and only a later actual bolt consumes its one effect', (id,cost,key,remaining) => {
    const s = fixture(), r = begin(s), spirit = s.spirituality;
    expect(player(s,r,id,1)).toMatchObject({ selfGain:0,enemyReduction:0,threatens:false });
    expect(uses(s)[key]).toEqual({ attempts:1,successes:1,effects:0 }); expect(s.spirituality).toBe(spirit-cost);
    expect(enemy(s,r,'DARK_BOLT').selfGain).toBe(remaining); expect(uses(s)[key]).toEqual({ attempts:1,successes:1,effects:1 });
    expect(enemy(s,r,'DARK_BOLT').selfGain).toBe(105); expect(s.concealmentServant.encounter.enemySpirituality).toBe(106);
    expect(s.combat).toMatchObject({ enemyHealth:100,enemyMind:100,enemyStatus:'RESISTING' });
  });
  it('combines only two live registered windows on the next bolt without erasing the target', () => {
    const s = fixture(), r = begin(s); player(s,r,CONCEAL,1); player(s,r,VEIL,1);
    expect(enemy(s,r,'DARK_BOLT')).toMatchObject({ selfGain:50,threatens:true }); expect(r.enemyActions[0]!.applied).toEqual(['BOUNDED_CONCEALMENT','TRACE_VEIL']);
    expect(s.concealmentServant.encounter.playerLocation).toBe('DOORSTEP'); expect(s.concealmentServant.encounter.playerTravelMetres).toBe(2);
    expect(s.concealmentServant.encounter.targetId).toBe('CS2-OSWIN'); expect(s.combat!.enemyMind).toBe(100);
  });
  it('charges both failed checks, counting attempts without success, effect or consolation', () => {
    const s = fixture(), r = begin(s), spirit = s.spirituality;
    expect(player(s,r,CONCEAL,100)).toMatchObject({ selfGain:0,enemyReduction:0 }); expect(player(s,r,VEIL,100)).toMatchObject({ selfGain:0,enemyReduction:0 });
    expect(s.spirituality).toBe(spirit-11); expect(uses(s)).toEqual({ BOUNDED_CONCEALMENT:{attempts:1,successes:0,effects:0},TRACE_VEIL:{attempts:1,successes:0,effects:0} });
    expect(r.playerActions.map(a=>a.paidCost)).toEqual([6,5]); expect(r.playerActions.map(a=>a.rolls)).toEqual([[100],[100]]);
    expect(enemy(s,r,'DARK_BOLT').selfGain).toBe(105);
  });
  it('expires unused success without awarding an application, mastery or refill', () => {
    const s = fixture(), r = begin(s), mastery = structuredClone(s.progression.mastery), spirit=s.spirituality;
    player(s,r,CONCEAL,1); player(s,r,VEIL,1); const o = finishConcealmentServantCombatRound(s,r);
    expect(o.windowsBeforeClose).toEqual(empty); expect(o.windowsAfter).toEqual(empty); expect(s.spirituality).toBe(spirit-11);
    expect(o.abilityUses.BOUNDED_CONCEALMENT).toEqual({attempts:1,successes:1,effects:0}); expect(o.abilityUses.TRACE_VEIL).toEqual({attempts:1,successes:1,effects:0});
    expect(s.progression.mastery).toEqual(mastery); expect(o.elapsedSeconds).toBe(60);
    // A manually selected slot sequence must not pass deterministic whole-round replay.
    expect(validateConcealmentServantRoundOutcome(o)).toBe(false);
  });
  it('expires a veil at the exact 20-second limit before the next action', () => {
    const s = fixture(), r = begin(s); player(s,r,VEIL,1);
    for (let i=0;i<3;i++) player(s,r,'OBSERVE');
    expect(enemy(s,r,'DARK_BOLT').selfGain).toBe(105); expect(r.enemyActions[0]).toMatchObject({ order:4,atSeconds:20,applied:[] });
    expect(uses(s).TRACE_VEIL).toEqual({attempts:1,successes:1,effects:0});
  });
  it('reopening the same window does not create two effects for one real bolt', () => {
    const s=fixture(),r=begin(s); player(s,r,CONCEAL,1); player(s,r,CONCEAL,1);
    expect(enemy(s,r,'DARK_BOLT').selfGain).toBe(70); expect(uses(s).BOUNDED_CONCEALMENT).toEqual({attempts:2,successes:2,effects:1});
  });
  it('an earlier paid anchor survives failure, resists one success and cannot be purchased twice this round', () => {
    const s=fixture(),r=begin(s),spirit=s.spirituality; enemy(s,r,'ANCHOR_LIGHT'); player(s,r,CONCEAL,100);
    expect(r.runtime.windows.anchorReady).toBe(true); player(s,r,VEIL,1); expect(r.playerActions[1]!.resisted).toBe(true); expect(r.runtime.windows.anchorReady).toBe(false);
    player(s,r,CONCEAL,1); expect(enemy(s,r,'ANCHOR_LIGHT').selfGain).toBe(20); expect(r.enemyActions[1]).toMatchObject({ planned:'ANCHOR_LIGHT',actual:'BODY_STRIKE',paidCost:0,anchorGranted:false });
    expect(enemy(s,r,'DARK_BOLT').selfGain).toBe(70); expect(s.spirituality).toBe(spirit-17);
    expect(s.concealmentServant.encounter.powerUses).toEqual({DARK_BOLT:1,WARD:0,ANCHOR_LIGHT:1});
    expect(uses(s)).toEqual({BOUNDED_CONCEALMENT:{attempts:2,successes:1,effects:1},TRACE_VEIL:{attempts:1,successes:1,effects:0}});
  });
  it('an anchor after both openings interrupts both, with paid successes but no application', () => {
    const s=fixture(),r=begin(s); player(s,r,CONCEAL,1); player(s,r,VEIL,1); enemy(s,r,'ANCHOR_LIGHT');
    expect(r.enemyActions[0]!.interrupted).toEqual(['BOUNDED_CONCEALMENT','TRACE_VEIL']); expect(r.runtime.windows.anchorReady).toBe(false);
    expect(enemy(s,r,'DARK_BOLT').selfGain).toBe(105); expect(uses(s).BOUNDED_CONCEALMENT.effects).toBe(0); expect(uses(s).TRACE_VEIL.effects).toBe(0);
  });
  it('a later anchor never cancels a bolt reduction that already happened', () => {
    const s=fixture(),r=begin(s); player(s,r,CONCEAL,1); enemy(s,r,'DARK_BOLT'); const applied=structuredClone(r.enemyActions[0]);
    enemy(s,r,'ANCHOR_LIGHT'); expect(r.enemyActions[0]).toEqual(applied); expect(r.runtime.windows.anchorReady).toBe(true);
    player(s,r,VEIL,1); expect(r.playerActions[1]!.resisted).toBe(true); expect(uses(s).BOUNDED_CONCEALMENT.effects).toBe(1); expect(uses(s).TRACE_VEIL.effects).toBe(0);
  });
  it.each([0,250,500])('retains paid inherited dissolution scaling at mastery %s', mastery => {
    const s=fixture(s=>{s.progression.mastery[DISSOLUTION]=mastery;}),r=begin(s),spirit=s.spirituality;
    expect(player(s,r,DISSOLUTION,1)).toMatchObject({selfGain:65*(.65+.35*mastery/500),enemyReduction:0,threatens:true});
    expect(s.spirituality).toBe(spirit-6); expect(s.combat).toMatchObject({enemyHealth:100,enemyMind:100});
  });
  it('retains inherited pressure prices and paid failure without permanent mental changes', () => {
    const s=fixture(),r=begin(s),spirit=s.spirituality,mind=s.mind,will=s.character.coreStats.will;
    expect(player(s,r,SLEEP,1)).toMatchObject({enemyReduction:32,mentalPressure:false}); expect(player(s,r,MISFORTUNE,1).enemyReduction).toBe(22);
    expect(player(s,r,DISSOLUTION,100).selfGain).toBe(0); expect(s.spirituality).toBe(spirit-15); expect(s.mind).toBe(mind);
    expect(s.character.coreStats.will).toBe(will); expect(s.combat!.enemyMind).toBe(100);
  });
  it('deploys only the same original sealed Leaf for2S, assists later for2S, and really recalls it', () => {
    const s=fixture(),r=begin(s),old=structuredClone(s.spiritWarlock),spirit=s.spirituality,history=structuredClone(s.combatHistory),fear=structuredClone(s.fearBishop);
    expect(old.companion).toMatchObject({source:'SW5-LEAF-1',status:'SEALED'});
    expect(player(s,r,LEAF)).toMatchObject({selfGain:0,enemyReduction:0}); expect(s.spiritWarlock.companion.status).toBe('DEPLOYED');
    expect(s.spiritWarlock.companion.deployments).toBe(old.companion.deployments+1); expect(player(s,r,LEAF).enemyReduction).toBe(22);
    const o=finishConcealmentServantCombatRound(s,r); expect(o.recalled).toBe(true); expect(s.spirituality).toBe(spirit-4);
    expect(s.spiritWarlock).toEqual({...old,companion:{...old.companion,deployments:old.companion.deployments+1,recalls:old.companion.recalls+1}});
    expect(s.fearBishop).toEqual(fear); expect(s.combatHistory).toEqual(history); expect(r.playerActions.map(a=>a.spiritOperation)).toEqual(['DEPLOY','ASSIST']);
  });
  it.each(['RELEASED','UNMET','AVAILABLE'] as const)('does not replace or silently reinvite a %s original Leaf', status => {
    const s=fixture(s=>{ s.spiritWarlock.companion.status=status;
      if(status==='RELEASED'){s.spiritWarlock.companion.releases++;s.spiritWarlock.companion.invitedWeek=null;}
      if(status==='UNMET'){s.spiritWarlock.companion.acquiredWeek=null;s.spiritWarlock.companion.invitedWeek=null;}
    }),before=structuredClone(s.spiritWarlock),spirit=s.spirituality,r=begin(s);
    expect(player(s,r,LEAF).enemyReduction).toBe(10); expect(s.spirituality).toBe(spirit); expect(s.spiritWarlock).toEqual(before);
    expect(finishConcealmentServantCombatRound(s,r).recalled).toBe(false);
  });
  it('missing original acquisition provenance falls back without charging or inventing a spirit', () => {
    const s=fixture(s=>{s.spiritWarlock.companion.acquiredWeek=null;}),r=begin(s),before=structuredClone(s.spiritWarlock),spirit=s.spirituality;
    expect(player(s,r,LEAF).enemyReduction).toBe(10); expect(r.playerActions[0]!.spiritOperation).toBe('NONE'); expect(s.spirituality).toBe(spirit); expect(s.spiritWarlock).toEqual(before);
  });
  it.each([true,false])('resource exhaustion uses the actual held-club=%s body or ordinary evade with no check', held => {
    const s=fixture(s=>{s.spirituality=1;s.town.clubLocation=held?'HAND':'SHOP';}),r=begin(s),physical=1-statusPenalty(s.health,100);
    expect(player(s,r,DISSOLUTION).selfGain).toBe((held?16:12)*physical);
    for(const id of [CONCEAL,VEIL,SLEEP,MISFORTUNE,LEAF] as const) expect(player(s,r,id).enemyReduction).toBe(10);
    expect(s.spirituality).toBe(1); expect(r.playerActions.every(a=>a.paidCost===0&&a.rolls.length===0)).toBe(true);
    expect(uses(s)).toEqual({BOUNDED_CONCEALMENT:{attempts:0,successes:0,effects:0},TRACE_VEIL:{attempts:0,successes:0,effects:0}});
  });
  it('the independent enemy pays7/6/4 and cannot refill depleted spell resources', () => {
    const s=fixture(),r=begin(s); expect(enemy(s,r,'DARK_BOLT').selfGain).toBe(105); expect(enemy(s,r,'WARD').enemyReduction).toBe(60); enemy(s,r,'ANCHOR_LIGHT');
    expect(s.concealmentServant.encounter).toMatchObject({enemySpirituality:103,powerUses:{DARK_BOLT:1,WARD:1,ANCHOR_LIGHT:1}});
    const low=fixture(s=>{Object.assign(s.concealmentServant.encounter,{enemySpirituality:3,powerUses:{DARK_BOLT:9,WARD:9,ANCHOR_LIGHT:0}});}),lr=begin(low);
    for(const id of ['DARK_BOLT','WARD','ANCHOR_LIGHT'] as const) expect(enemy(low,lr,id)).toMatchObject({selfGain:20,enemyReduction:0});
    const o=finishConcealmentServantCombatRound(low,lr); expect(o.enemySpirituality).toBe(3); expect(o.powerUses).toEqual({DARK_BOLT:9,WARD:9,ANCHOR_LIGHT:0});
  });
  it('caps each side at six original slots, with no seventh charge, hidden check or extra action', () => {
    const s=fixture(),r=begin(s); for(let i=0;i<6;i++){player(s,r,'OBSERVE');enemy(s,r,'WARD');}
    const before=structuredClone(s); expect(player(s,r,CONCEAL).selfGain).toBe(0); expect(enemy(s,r,'DARK_BOLT').selfGain).toBe(0);
    expect(s).toEqual(before); expect(r.playerActions).toHaveLength(6); expect(r.enemyActions).toHaveLength(6);
  });
  it('rejects borrowed/stale source and foreign RNG without spending or drawing', () => {
    const s=fixture(),r=begin(s),source=currentConcealmentServantCombatSource(s)!,rng=random(s),physical=1-statusPenalty(s.health,100);
    for(const bad of [null,{...source,round:99},{...source,targetId:'NW4-BRAM'},{...source,door:'FOREIGN-DOOR'},{...source,companion:{...source.companion,source:'NEW-LEAF'}}]){
      const before=structuredClone(s); expect(resolveConcealmentServantCombatAbility(s,CONCEAL,physical,rng,r,bad as ConcealmentServantCombatSource|null).selfGain).toBe(0); expect(s).toEqual(before);
    }
    expect(()=>beginConcealmentServantCombatRound(s,'ATTACK',{...rng,seed:'foreign'})).toThrow();
    expect(()=>beginConcealmentServantCombatRound(s,'ATTACK',{...rng,cursor:rng.cursor+1})).toThrow();
    s.spiritWarlock.companion.releases++; const before=structuredClone(s); expect(player(s,r,LEAF).enemyReduction).toBe(0); expect(s).toEqual(before);
    expect(()=>finishConcealmentServantCombatRound(s,r)).toThrow();
  });
});
