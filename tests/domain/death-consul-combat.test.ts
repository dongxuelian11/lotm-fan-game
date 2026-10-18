import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage, consequenceWeights, statusPenalty } from '../../src/domain/slice/combat.js';
import { resolveDeathConsulCombatRound } from '../../src/domain/slice/death-consul-combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import {
  DEATH_CONSUL_COUNT_WHEEL, DEATH_CONSUL_ENEMY_COUNT_WHEEL, DEATH_CONSUL_ENEMY_ABILITY_WHEEL,
  deathConsulActionCount, deathConsulEnemyActionCount, deathConsulAbilityWheel,
  drawDeathConsulAbility, drawDeathConsulEnemyAbility, currentDeathConsulCombatSource,
  beginDeathConsulCombatRound, resolveDeathConsulCombatAbility, resolveDeathConsulEnemyAbility,
  finishDeathConsulCombatRound, deathConsulRoundOutcome, projectDeathConsulCombat,
  validateDeathConsulRoundOutcome, validateDeathConsulCombatRound,
  type DeathConsulMoveId, type DeathConsulCombatSource, type DeathConsulRoundOutcome,
} from '../../src/domain/death-consul/combat.js';
import {
  DEATH_CONSUL_TARGETS, deathConsulApproachedSite, validateDeathConsulEncounter,
  projectDeathConsulEncounter,
} from '../../src/domain/death-consul/encounter.js';
import { validateDeathConsulLife } from '../../src/domain/death-consul/life.js';
import { DEATH_CONSUL_SOURCES, validateDeathConsulSiteState } from '../../src/domain/death-consul/resources.js';

const FLAME='death.s2.pale-flame', PASSAGE='death.s2.spirit-passage';
const WORDS='death.s6.dead-words', SEAL='death.s4.underworld-seal';
const legacyKeys=['corpsecollector','gravedigger','spiritmedium','spiritGuide','gatekeeper','undying','ferryman','longChapter'] as const;
let entry:SliceState, terminal:SliceState, round13Entry:SliceState, recordedRounds:SliceCombatRound[];
/** Only this on-disk capture is natural input. The producer must record the genuine public command prefix;
 * absence is an error, never permission to manufacture a replacement fixture. */
function naturalCombatStart():SliceState {
  return migrateSliceState(JSON.parse(readFileSync('tests/fixtures/death-consul-v01730/snapshot-combatStart.json','utf8')));
}
function outcome(round:SliceCombatRound):DeathConsulRoundOutcome {
  if(!round.deathConsulOutcome)throw new Error('Missing DeathConsul ordered round evidence');return round.deathConsulOutcome;
}
const ordered=(o:DeathConsulRoundOutcome)=>[...o.playerActions,...o.enemyActions].sort((a,b)=>a.order-b.order);
const sum=(actions:{selfGain:number;enemyReduction:number}[],key:'selfGain'|'enemyReduction')=>actions.reduce((n,a)=>n+a[key],0);
function scripted(s:SliceState,values:number[]=[]):ActionRandomStream {
  let index=0,cursor=s.random.cursor;
  return{seed:s.random.seed,get cursor(){return cursor;},nextInt(min,max){const value=values[index++];
    if(value===undefined||!Number.isInteger(value)||value<min||value>max)throw new Error(`Unexpected DIRECTED slot draw ${index}: ${value}`);
    cursor++;return value;}};
}
/** DIRECTED SLOT-ONLY unit. Explicit resource/site/check changes below are not natural-play evidence,
 * are never persisted, and cannot be accepted as complete RNG-replayed rounds. */
function scenario(checks:number[]=[],change?:(s:SliceState)=>void,base:SliceState=entry){
  const state=structuredClone(base);change?.(state);const random=scripted(state,checks),round=beginDeathConsulCombatRound(state,'ATTACK',random);
  return{state,random,round,
    player:(id:DeathConsulMoveId)=>resolveDeathConsulCombatAbility(state,id,1-statusPenalty(round.source.playerHealth,100),random,round),
    enemy:(id:Parameters<typeof resolveDeathConsulEnemyAbility>[1])=>resolveDeathConsulEnemyAbility(state,id,1-statusPenalty(round.source.enemyHealth,100),random,round)};
}
function openDoor(s:SliceState):void{const door=s.deathConsul.life.site.door;if(door.state!=='OPEN'){door.state='OPEN';door.operations++;}}
function noEnemySpirituality(s:SliceState):void{
  // An explicit depleted-pool SOURCE unit, not a claim that 24 new strikes occurred in the natural journal.
  s.deathConsul.encounter.enemySpirituality=0;s.deathConsul.encounter.powerUses={PALE_STRIKE:24,STEADY:0,CLOSE_DOOR:0};
}
function accounting(before:SliceState,after:SliceState,round:SliceCombatRound):void {
  const o=outcome(round),x=o.source,actions=ordered(o);
  expect(o.playerSpiritualityAfter).toBe(x.playerSpirituality-o.playerActions.reduce((n,a)=>n+a.paidCost,0));
  expect(o.enemySpirituality).toBe(x.enemySpirituality-o.enemyActions.reduce((n,a)=>n+a.paidCost,0));
  expect(after.spirituality).toBe(o.continuing?Math.min(120,o.playerSpiritualityAfter+12):o.playerSpiritualityAfter);
  expect(after.deathConsul.encounter.enemySpirituality).toBe(o.enemySpirituality);
  expect(o.enemySpirituality).toBe(120-o.powerUses.PALE_STRIKE*5-o.powerUses.STEADY*4);
  let playerS=x.playerSpirituality,enemyS=x.enemySpirituality,site=x.site;
  for(const [index,a]of actions.entries()){
    expect(a.order).toBe(index);expect(a.atSeconds).toBe(x.site.elapsedSeconds+index*5);expect(a.elapsedSeconds).toBe(5);
    expect(a.siteBefore).toEqual(site);expect(a.siteAfter.elapsedSeconds).toBe(a.siteBefore.elapsedSeconds+5);
    expect(validateDeathConsulSiteState(a.siteAfter)).toBe(true);
    expect(a.siteAfter.door.operations-a.siteBefore.door.operations).toBe(a.doorOperationSeconds/5);
    expect(a.siteAfter.playerPassageMetres-a.siteBefore.playerPassageMetres).toBe(a.passageMetres);
    for(const key of ['sourceEra','introducedWeek','introducedDate','residual','material','playerMetres','operatorId','operatorName','operatorAge','operatorSource',
      'operatorLocation','operatorMetres','operatorPassageMetres','operatorEnergy','operatorConsent','operatorConsentWeek','ordinaryExit'] as const)expect(a.siteAfter[key]).toEqual(a.siteBefore[key]);
    if('id'in a){
      playerS-=a.paidCost;
      if(a.fallback==='DOOR_OPEN')expect(a).toMatchObject({paidCost:0,rolls:[],selfGain:0,enemyReduction:0,threatens:false,attempted:false,succeeded:false,applied:false,doorOperationSeconds:5});
      if(a.id===FLAME&&a.succeeded)expect(a).toMatchObject({paidCost:7,selfGain:105,applied:true,threatens:true});
      if(a.id===WORDS&&a.succeeded)expect(a.selfGain).toBe(38*(.65+.35*x.deadWordsMastery/500));
      if(a.id===SEAL&&a.succeeded)expect(a.enemyReduction).toBe(a.consumedSteadyOrder===null?20*(.65+.35*x.sealMastery/500):0);
      if(a.id===PASSAGE&&a.attempted){
        expect(a.paidCost).toBe(6);expect(a.chargeGranted).toBe(a.succeeded);expect(a.applied).toBe(a.succeeded);
        expect(a.passageMetres).toBe(a.succeeded?2:0);expect(a.enemyReduction).toBe(a.appliedAmount);
        expect(a.siteAfter.playerLocation).toBe(a.succeeded?(a.siteBefore.playerLocation==='NEAR'?'OTHER':'NEAR'):a.siteBefore.playerLocation);
        if(a.chargeConsumedByOrder===null)expect(a.appliedAmount).toBe(0);
        else{const consumer=o.enemyActions.find(v=>v.order===a.chargeConsumedByOrder)!;
          expect(consumer).toMatchObject({actual:'BODY_STRIKE',paidCost:0,consumedPassageOrder:a.order});expect(consumer.order).toBeGreaterThan(a.order);expect(a.appliedAmount).toBe(40);}
      }
    }else{
      enemyS-=a.paidCost;
      if(a.actual==='PALE_STRIKE')expect(a).toMatchObject({paidCost:5,selfGain:75,threatens:true,consumedPassageOrder:null});
      if(a.actual==='CLOSE_DOOR'||a.actual==='OPEN_DOOR')expect(a).toMatchObject({paidCost:0,selfGain:0,enemyReduction:0,threatens:false,doorChanged:true,doorOperationSeconds:5,consumedPassageOrder:null});
      if(a.actual==='BODY_STRIKE'){
        expect(a).toMatchObject({paidCost:0,selfGain:20*a.physicalFactor,threatens:true});
        expect(a.siteBefore.playerLocation==='OTHER'||a.siteBefore.door.state==='OPEN').toBe(true);
      }
      if(a.actual==='STEADY'){
        expect(a).toMatchObject({paidCost:4,chargeGranted:true,selfGain:0,enemyReduction:0,threatens:false});
        if(a.chargeConsumedByOrder===null)expect(a.appliedAmount).toBe(0);
        else{const consumer=o.playerActions.find(v=>v.order===a.chargeConsumedByOrder)!;
          expect(consumer).toMatchObject({id:SEAL,succeeded:true,consumedSteadyOrder:a.order});expect(consumer.order).toBeGreaterThan(a.order);
          expect(a.appliedAmount).toBe(Math.min(32,20*(.65+.35*x.sealMastery/500)));}
      }
    }
    expect(a.playerSpiritualityAfter).toBe(playerS);expect(a.enemySpiritualityAfter).toBe(enemyS);
    expect(a.randomCursorAfter-a.randomCursorBefore).toBe(a.rolls.length);site=a.siteAfter;
  }
  expect(o.playerActions.filter(a=>a.id===PASSAGE&&a.attempted).length).toBeLessThanOrEqual(1);
  for(const id of ['PALE_STRIKE','STEADY','CLOSE_DOOR']as const){const uses=o.enemyActions.filter(a=>a.actual===id).length;
    expect(o.powerUses[id]).toBe(x.powerUses[id]+uses);if(id==='STEADY')expect(uses).toBeLessThanOrEqual(1);}
  expect(o.expiredPassageChargeOrder).toBe(o.playerActions.find(a=>a.chargeGranted&&a.chargeConsumedByOrder===null)?.order??null);
  expect(o.expiredSteadyChargeOrder).toBe(o.enemyActions.find(a=>a.chargeGranted&&a.chargeConsumedByOrder===null)?.order??null);
  const exit=!o.continuing&&o.playerHealthAfter>0?(site.playerLocation==='NEAR'?2:site.door.state==='OPEN'?4:8):0;
  const expectedSite={...structuredClone(site),elapsedSeconds:x.site.elapsedSeconds+60+exit,effect:{mode:'OFF',expiresAt:null},
    playerLocation:exit?'ENTRY':site.playerLocation,playerMetres:site.playerMetres+exit};
  expect(o.exitMetres).toBe(exit);expect(o.elapsedSeconds).toBe(60+exit);expect(o.siteAfter).toEqual(expectedSite);expect(after.deathConsul.life.site).toEqual(expectedSite);
  const core=x.physique*.35+x.perception*.25+x.will*.25+x.knowledge*.15;
  expect(round.playerAdvantage).toBe(Math.max(125,baseAdvantage(core,x.playerHealth,x.playerMind,x.playerSpirituality,1250,120)+sum(o.playerActions,'selfGain')-sum(o.enemyActions,'enemyReduction')));
  expect(round.enemyAdvantage).toBe(Math.max(125,baseAdvantage(24,x.enemyHealth,x.enemyMind,x.enemySpirituality,1250,120)+sum(o.enemyActions,'selfGain')-sum(o.playerActions,'enemyReduction')));
  expect(round.winChance).toBe(round.playerAdvantage/(round.playerAdvantage+round.enemyAdvantage)*100);
  if(round.consequenceWeights)expect(round.consequenceWeights).toEqual(consequenceWeights(round.winner==='PLAYER'?o.enemyRiskAfter:o.playerRiskAfter));
  expect(after.random).toEqual({seed:before.random.seed,cursor:o.randomCursorAfter});expect(after.progression.mastery).toEqual(before.progression.mastery);
  for(const key of legacyKeys)expect(after[key]).toEqual(before[key]);
}
beforeAll(()=>{
  entry=naturalCombatStart();expect(entry.combat?.encounterId).toBe('DEATH_CONSUL_DISPUTE');expect(entry.deathConsul.encounter.status).toBe('FIGHTING');
  terminal=migrateSliceState(readObjectEntry<unknown>('tests/fixtures/death-consul-v01730/combat-terminal.json','final'));
  round13Entry=migrateSliceState(readObjectEntry<unknown>('tests/fixtures/death-consul-v01730/combat-round-13.json','beforeLast'));
  const e=terminal.deathConsul.encounter;expect(e.terminal).not.toBeNull();recordedRounds=terminal.combatHistory.slice(e.startHistoryIndex!,e.terminal!.historyIndex+1);
  assertValidSliceState(entry);assertValidSliceState(terminal);
  // These are only the producer's unique natural mainline captures. No second fixed-ATTACK branch is called natural.
  expect(recordedRounds.map(r=>r.stance)).toEqual(['CONTROL','CONTROL',...Array(11).fill('ATTACK'),'RETREAT']);
  expect(e.terminal).toMatchObject({outcome:'RETREATED',round:14,enemyHealth:80,enemySpirituality:46});expect(terminal.health).toBe(20);
},120_000);

describe('DeathConsul explicit DIRECTED slot-only checks',()=>{
  it('retains both 1–6 wheels, exact player25/20/20/15/15/5 and enemy35/25/20/15/5 with5:4 stance tickets',()=>{
    expect(DEATH_CONSUL_COUNT_WHEEL.map(a=>a.weight)).toEqual([10,15,25,25,15,10]);expect(DEATH_CONSUL_ENEMY_COUNT_WHEEL).toEqual(DEATH_CONSUL_COUNT_WHEEL);
    for(const [roll,count]of [[1,1],[10,1],[11,2],[25,2],[26,3],[50,3],[51,4],[75,4],[76,5],[90,5],[91,6],[100,6]]){
      expect(deathConsulActionCount(roll!)).toBe(count);expect(deathConsulEnemyActionCount(roll!)).toBe(count);}
    const neutral=deathConsulAbilityWheel(entry,null);expect(neutral.map(a=>a.id)).toEqual([FLAME,PASSAGE,WORDS,SEAL,'EVADE','ACCIDENT']);expect(neutral.map(a=>a.weight)).toEqual([25,20,20,15,15,5]);
    expect(DEATH_CONSUL_ENEMY_ABILITY_WHEEL.map(a=>[a.id,a.weight])).toEqual([['PALE_STRIKE',35],['STEADY',25],['BODY_STRIKE',20],['CLOSE_DOOR',15],['ACCIDENT',5]]);
    const assignments=['ATTACK','CONTROL','DEFEND','CONTROL','PREPARE',null];
    for(const stance of ['ATTACK','CONTROL','DEFEND','PREPARE','RETREAT']as const){const weights=neutral.map((a,i)=>a.weight*(assignments[i]===stance?5:4)),total=weights.reduce((a,b)=>a+b,0);
      expect(deathConsulAbilityWheel(entry,stance).map(a=>a.weight)).toEqual(weights.map(a=>a/total*100));}
    let edge=0;for(const a of neutral){const first=edge+1;edge+=a.weight*4;const rng=scripted(entry,[first,edge]);expect(drawDeathConsulAbility(rng,entry,null)).toBe(a.id);expect(drawDeathConsulAbility(rng,entry,null)).toBe(a.id);expect(rng.cursor-entry.random.cursor).toBe(2);}
    edge=0;for(const a of DEATH_CONSUL_ENEMY_ABILITY_WHEEL){const first=edge+1;edge+=a.weight;const rng=scripted(entry,[first,edge]);expect(drawDeathConsulEnemyAbility(rng)).toBe(a.id);expect(drawDeathConsulEnemyAbility(rng)).toBe(a.id);}
  });
  it('closed-door flame or passage first spends one ordinary5-second opening slot without spell, attack, check or SP',()=>{
    for(const id of [FLAME,PASSAGE]as const){const u=scenario([],s=>{s.deathConsul.life.site.door.state='CLOSED';}),before=structuredClone(u.state.deathConsul.life.site),sp=u.state.spirituality;
      expect(u.player(id)).toMatchObject({selfGain:0,enemyReduction:0,threatens:false});expect(u.round.playerActions[0]).toMatchObject({id,fallback:'DOOR_OPEN',paidCost:0,attempted:false,succeeded:false,applied:false,rolls:[],doorOperationSeconds:5,passageMetres:0});
      expect(u.state.deathConsul.life.site.door).toEqual({...before.door,state:'OPEN',operations:before.door.operations+1});expect(u.state.deathConsul.life.site.elapsedSeconds).toBe(before.elapsedSeconds+5);
      expect(u.state.spirituality).toBe(sp);expect(u.random.cursor).toBe(entry.random.cursor);expect(u.round.runtime.passageAttempted).toBe(false);}
  });
  it('BLOCKED door never opens or permits flame/passage; ordinary exit remains open and neither pool is charged',()=>{
    const u=scenario([],s=>{s.deathConsul.life.site.door.state='BLOCKED';}),before=structuredClone(u.state.deathConsul.life.site);
    u.player(FLAME);u.player(PASSAGE);u.enemy('BODY_STRIKE');u.enemy('PALE_STRIKE');u.enemy('CLOSE_DOOR');
    expect(u.round.playerActions.every(a=>a.fallback==='OBSERVE'&&a.paidCost===0&&a.rolls.length===0&&a.passageMetres===0)).toBe(true);
    expect(u.round.enemyActions.every(a=>a.actual==='OBSERVE'&&a.paidCost===0&&!a.threatens)).toBe(true);
    expect(u.state.deathConsul.life.site.door).toEqual(before.door);expect(u.state.deathConsul.life.site.playerLocation).toBe('NEAR');expect(u.state.deathConsul.life.site.ordinaryExit).toBe('OPEN');
    expect(u.state.spirituality).toBe(u.round.source.playerSpirituality);expect(u.state.deathConsul.encounter.enemySpirituality).toBe(120);expect(u.random.cursor).toBe(entry.random.cursor);
  });
  it('physical cross-door strikes open CLOSED with no attack, while same-sideOTHER attacks remain real even with BLOCKED door',()=>{
    const u=scenario([],s=>{s.deathConsul.life.site.door.state='CLOSED';});u.enemy('BODY_STRIKE');
    expect(u.round.enemyActions[0]).toMatchObject({planned:'BODY_STRIKE',actual:'OPEN_DOOR',selfGain:0,paidCost:0,threatens:false,doorChanged:true,doorOperationSeconds:5,consumedPassageOrder:null});
    u.enemy('BODY_STRIKE');expect(u.round.enemyActions[1]).toMatchObject({actual:'BODY_STRIKE',selfGain:20,paidCost:0,threatens:true});
    const sameSide=scenario([],s=>{s.deathConsul.life.site.playerLocation='OTHER';s.deathConsul.life.site.playerPassageMetres+=2;s.deathConsul.life.site.door.state='BLOCKED';});
    sameSide.enemy('BODY_STRIKE');expect(sameSide.round.enemyActions[0]).toMatchObject({actual:'BODY_STRIKE',selfGain:20,threatens:true});
  });
  it('enemy ordinary close/open/close uses separate slots with0SP and never piggybacks a strike',()=>{
    const u=scenario([],openDoor),operations=u.state.deathConsul.life.site.door.operations;
    u.enemy('CLOSE_DOOR');u.enemy('BODY_STRIKE');u.enemy('CLOSE_DOOR');
    expect(u.round.enemyActions.map(a=>a.actual)).toEqual(['CLOSE_DOOR','OPEN_DOOR','CLOSE_DOOR']);expect(u.round.enemyActions.every(a=>!a.threatens&&a.selfGain===0&&a.paidCost===0)).toBe(true);
    expect(u.state.deathConsul.life.site.door.operations).toBe(operations+3);expect(u.state.deathConsul.encounter.powerUses.CLOSE_DOOR).toBe(2);expect(u.state.deathConsul.encounter.enemySpirituality).toBe(120);
  });
  it('flame pays7/Will20 for105 independent of new mastery and does not directly harm, heal or alter original material',()=>{
    for(const mastery of [0,250,500]){const u=scenario([1],s=>{openDoor(s);s.progression.mastery[FLAME]=mastery;}),before=structuredClone(u.state);
      expect(u.player(FLAME)).toMatchObject({selfGain:105,enemyReduction:0,threatens:true,mentalPressure:false});expect(u.round.playerActions[0]).toMatchObject({paidCost:7,attempted:true,succeeded:true,applied:true,rolls:[1]});
      expect(u.state.spirituality).toBe(before.spirituality-7);expect(u.state.health).toBe(before.health);expect(u.state.combat!.enemyHealth).toBe(100);expect(u.state.combat!.enemyMind).toBe(100);
      expect(u.state.deathConsul.life.site.effect).toEqual({mode:'OFF',expiresAt:null});expect(u.state.deathConsul.life.site.residual).toEqual(before.deathConsul.life.site.residual);expect(u.state.deathConsul.life.site.material).toEqual(before.deathConsul.life.site.material);
      expect(u.state.progression.mastery).toEqual(before.progression.mastery);}
  });
  it('successful passage pays6, actually moves2m, initially reduces0, ignores pale attacks, then reduces exactly one subsequent BODY40',()=>{
    const u=scenario([1],openDoor),site=structuredClone(u.state.deathConsul.life.site),sp=u.state.spirituality;
    expect(u.player(PASSAGE)).toMatchObject({selfGain:0,enemyReduction:0,threatens:false});const pending=structuredClone(u.round.playerActions[0]!);
    expect(pending).toMatchObject({paidCost:6,succeeded:true,applied:true,passageMetres:2,chargeGranted:true,appliedAmount:0,chargeConsumedByOrder:null});
    expect(u.state.deathConsul.life.site).toMatchObject({playerLocation:'OTHER',playerMetres:site.playerMetres,playerPassageMetres:site.playerPassageMetres+2});
    u.enemy('PALE_STRIKE');expect(u.round.playerActions[0]).toEqual(pending);expect(u.round.enemyActions[0]).toMatchObject({actual:'PALE_STRIKE',selfGain:75,paidCost:5,consumedPassageOrder:null});
    u.enemy('BODY_STRIKE');expect(u.round.playerActions[0]).toMatchObject({appliedAmount:40,enemyReduction:40,chargeConsumedByOrder:2});expect(u.round.enemyActions[1]).toMatchObject({actual:'BODY_STRIKE',consumedPassageOrder:0,threatens:true});
    u.enemy('BODY_STRIKE');expect(u.round.enemyActions[2].consumedPassageOrder).toBeNull();expect(u.round.runtime.passage).toBeNull();expect(u.state.spirituality).toBe(sp-6);expect(u.state.deathConsul.encounter.enemySpirituality).toBe(115);
    expect(u.state.health).toBe(u.round.source.playerHealth);expect(u.state.combat!.enemyHealth).toBe(100);
  });
  it('passage fromOTHER really returnsNEAR; a later door operation cannot consume its pending BODY-only charge',()=>{
    const u=scenario([1],s=>{openDoor(s);s.deathConsul.life.site.playerLocation='OTHER';s.deathConsul.life.site.playerPassageMetres+=2;});u.player(PASSAGE);u.enemy('CLOSE_DOOR');u.enemy('BODY_STRIKE');
    expect(u.state.deathConsul.life.site.playerLocation).toBe('NEAR');expect(u.round.playerActions[0]).toMatchObject({passageMetres:2,appliedAmount:0,chargeConsumedByOrder:null});
    expect(u.round.enemyActions.map(a=>a.actual)).toEqual(['CLOSE_DOOR','OPEN_DOOR']);expect(u.round.runtime.passage?.order).toBe(0);
    u.enemy('BODY_STRIKE');expect(u.round.playerActions[0]).toMatchObject({appliedAmount:40,chargeConsumedByOrder:3});
  });
  it('a failed passage still pays6, uses the one attempt, never moves, and cannot retry; success also cannot stack',()=>{
    for(const check of [100,1]){const u=scenario([check],openDoor),sp=u.state.spirituality;u.player(PASSAGE);const location=u.state.deathConsul.life.site.playerLocation,metres=u.state.deathConsul.life.site.playerPassageMetres;u.player(PASSAGE);
      expect(u.round.playerActions[0]).toMatchObject({attempted:true,succeeded:check===1,paidCost:6,passageMetres:check===1?2:0});expect(u.round.playerActions[1]).toMatchObject({fallback:'EVADE',attempted:false,paidCost:0,rolls:[],enemyReduction:10,passageMetres:0});
      expect(u.state.spirituality).toBe(sp-6);expect(u.random.cursor-entry.random.cursor).toBe(1);expect(u.state.deathConsul.life.site.playerLocation).toBe(location);expect(u.state.deathConsul.life.site.playerPassageMetres).toBe(metres);}
  });
  it('an unconsumed successful passage expires at0 actual reduction while keeping the actual2m movement',()=>{
    const u=scenario([1],openDoor);u.player(PASSAGE);u.enemy('PALE_STRIKE');const sp=u.state.spirituality,enemySp=u.state.deathConsul.encounter.enemySpirituality;
    const o=finishDeathConsulCombatRound(u.state,u.round,true,u.random.cursor);expect(o).toMatchObject({expiredPassageChargeOrder:0,exitMetres:0,elapsedSeconds:60,playerSpiritualityAfter:sp,enemySpirituality:enemySp});
    expect(o.playerActions[0]).toMatchObject({applied:true,appliedAmount:0,enemyReduction:0,passageMetres:2});expect(o.siteAfter.playerLocation).toBe('OTHER');expect(o.siteAfter.effect).toEqual({mode:'OFF',expiresAt:null});
    expect(validateDeathConsulRoundOutcome(o)).toBe(false); // Deliberately scripted slot units are not complete natural RNG rounds.
  });
  it('inherits dead-wordsWill16/38 and underworld-sealKnowledge16/20 from the old independent mastery values',()=>{
    for(const mastery of [0,250,500]){const u=scenario([1,1],s=>{s.progression.mastery[SEAL]=mastery;s.progression.mastery[WORDS]=500-mastery;}),sp=u.state.spirituality;
      expect(u.player(WORDS)).toMatchObject({selfGain:38*(.65+.35*(500-mastery)/500),threatens:true});expect(u.player(SEAL)).toMatchObject({enemyReduction:20*(.65+.35*mastery/500),threatens:false});
      expect(u.round.playerActions.map(a=>a.paidCost)).toEqual([6,6]);expect(u.state.spirituality).toBe(sp-12);}
    for(const [id,ability,difficulty]of [[FLAME,'will',20],[PASSAGE,'knowledge',20],[WORDS,'will',16],[SEAL,'knowledge',16]]as const){
      for(const [roll,succeeds]of [[50,true],[51,false]]as const){const u=scenario([roll],s=>{openDoor(s);s.character.coreStats[ability]=difficulty;});u.player(id);expect(u.round.playerActions[0].succeeded).toBe(succeeds);}}
  });
  it('paid STEADY waits through failure, passage and attacks, consumes only the next successful old seal once, and cannot rearm',()=>{
    const u=scenario([100,1,1,1,1],openDoor);u.enemy('STEADY');const pending=structuredClone(u.round.enemyActions[0]!);
    u.player(SEAL);u.player(PASSAGE);u.player(WORDS);expect(u.round.enemyActions[0]).toEqual(pending);expect(u.round.runtime.steady?.order).toBe(0);
    u.player(SEAL);const amount=20*(.65+.35*u.round.source.sealMastery/500);
    expect(u.round.enemyActions[0]).toMatchObject({paidCost:4,selfGain:0,enemyReduction:0,appliedAmount:Math.min(32,amount),chargeConsumedByOrder:4});expect(u.round.playerActions[3]).toMatchObject({enemyReduction:0,consumedSteadyOrder:0,paidCost:6});
    u.enemy('STEADY');expect(u.round.enemyActions[1]).toMatchObject({actual:'OBSERVE',paidCost:0,chargeGranted:false});u.player(SEAL);expect(u.round.playerActions[4]).toMatchObject({enemyReduction:amount,consumedSteadyOrder:null});
    expect(u.state.deathConsul.encounter.enemySpirituality).toBe(116);expect(u.round.runtime.steady).toBeNull();
  });
  it('unused STEADY expires with0 effect; lowSP and failures do not create free spells or refill either pool',()=>{
    const u=scenario([100],s=>{openDoor(s);s.spirituality=7;});u.enemy('STEADY');u.player(FLAME);u.player(FLAME);u.player(PASSAGE);u.player(WORDS);u.player(SEAL);
    expect(u.round.playerActions[0]).toMatchObject({paidCost:7,succeeded:false,selfGain:0});expect(u.round.playerActions.slice(1).map(a=>a.fallback)).toEqual(['STRIKE','EVADE','STRIKE','EVADE']);
    const o=finishDeathConsulCombatRound(u.state,u.round,true,u.random.cursor);expect(o.expiredSteadyChargeOrder).toBe(0);expect(o.enemyActions[0].appliedAmount).toBe(0);expect(u.state.spirituality).toBe(0);expect(u.state.deathConsul.encounter.enemySpirituality).toBe(116);
  });
  it('ordinary insufficientSP attacks also obey the original door; exhaustion cannot turn a blocked strike into free magic',()=>{
    const u=scenario([],s=>{s.spirituality=0;s.deathConsul.life.site.door.state='CLOSED';});u.player(WORDS);expect(u.round.playerActions[0]).toMatchObject({fallback:'DOOR_OPEN',paidCost:0,selfGain:0,threatens:false,rolls:[]});
    const blocked=scenario([],s=>{s.spirituality=0;s.deathConsul.life.site.door.state='BLOCKED';});blocked.player(WORDS);expect(blocked.round.playerActions[0]).toMatchObject({fallback:'OBSERVE',selfGain:0,threatens:false,paidCost:0});
    const depleted=scenario([],s=>{openDoor(s);s.deathConsul.encounter.enemySpirituality=5;s.deathConsul.encounter.powerUses={PALE_STRIKE:23,STEADY:0,CLOSE_DOOR:0};},round13Entry);
    depleted.enemy('PALE_STRIKE');depleted.enemy('PALE_STRIKE');depleted.enemy('STEADY');expect(depleted.round.enemyActions.map(a=>[a.actual,a.paidCost])).toEqual([['PALE_STRIKE',5],['BODY_STRIKE',0],['BODY_STRIKE',0]]);
    expect(depleted.state.deathConsul.encounter.enemySpirituality).toBe(0);expect(depleted.state.deathConsul.encounter.powerUses).toEqual({PALE_STRIKE:24,STEADY:0,CLOSE_DOOR:0});
  });
  it('DIRECTED complete depleted/BLOCKED round continues with player+12, enemy+0, no fake physical injury, and validates exact full replay',()=>{
    const state=structuredClone(round13Entry);state.spirituality=0;noEnemySpirituality(state);state.deathConsul.life.site.door.state='BLOCKED';const before=structuredClone(state);
    const result=resolveDeathConsulCombatRound(state,'ATTACK'),o=outcome(result.round);
    expect(result.outcome).toBe('CONTINUE');expect(o.continuing).toBe(true);expect(o.playerSpiritualityAfter).toBe(0);expect(state.spirituality).toBe(12);expect(state.deathConsul.encounter.enemySpirituality).toBe(0);
    expect(ordered(o).every(a=>!a.threatens&&a.paidCost===0)).toBe(true);expect(result.round.consequenceWeights).toBeNull();expect(result.round.consequenceRoll).toBeUndefined();
    expect(state.health).toBe(before.health);expect(state.injuries).toEqual(before.injuries);expect(state.combat!.enemyInjuries).toEqual(before.combat!.enemyInjuries);
    expect(validateDeathConsulRoundOutcome(o)).toBe(true);expect(validateDeathConsulCombatRound(result.round)).toBe(true);accounting(before,state,result.round);
  });
  it('DIRECTED complete round13 depleted-enemy fork consumes40 on a genuine later BODY fallback and rejects forged charge links',()=>{
    // Source is the actual pre-round13 boundary. Only the enemy pool/accounting is explicitly depleted.
    // The original seed, cursor, stance and earlier player/site history are unchanged. This result is NOT the natural round13.
    const state=structuredClone(round13Entry),natural=outcome(recordedRounds[12]!);noEnemySpirituality(state);const before=structuredClone(state);
    const result=resolveDeathConsulCombatRound(state,'ATTACK'),o=outcome(result.round),passage=o.playerActions.find(a=>a.id===PASSAGE&&a.succeeded)!;
    expect(natural.playerActions.find(a=>a.id===PASSAGE&&a.succeeded)).toMatchObject({appliedAmount:0,chargeConsumedByOrder:null});
    expect(passage).toMatchObject({paidCost:6,passageMetres:2,chargeGranted:true,applied:true,appliedAmount:40,enemyReduction:40});
    const body=o.enemyActions.find(a=>a.order===passage.chargeConsumedByOrder)!;expect(body).toMatchObject({planned:'PALE_STRIKE',actual:'BODY_STRIKE',paidCost:0,consumedPassageOrder:passage.order,threatens:true});
    expect(body.order).toBeGreaterThan(passage.order);expect(o.expiredPassageChargeOrder).toBeNull();expect(o.enemyActions.filter(a=>a.consumedPassageOrder!==null)).toHaveLength(1);
    expect(validateDeathConsulRoundOutcome(o)).toBe(true);expect(validateDeathConsulCombatRound(result.round)).toBe(true);accounting(before,state,result.round);
    const forgeries:((v:DeathConsulRoundOutcome)=>void)[]=[
      v=>{v.playerActions.find(a=>a.id===PASSAGE&&a.succeeded)!.chargeGranted=false;},
      v=>{v.playerActions.find(a=>a.id===PASSAGE&&a.succeeded)!.chargeConsumedByOrder=null;},
      v=>{v.playerActions.find(a=>a.id===PASSAGE&&a.succeeded)!.appliedAmount=45;},
      v=>{const a=v.playerActions.find(a=>a.id===PASSAGE&&a.succeeded)!;a.appliedAmount=45;a.enemyReduction=45;},
      v=>{v.enemyActions.find(a=>a.consumedPassageOrder!==null)!.actual='PALE_STRIKE';},
      v=>{v.enemyActions.find(a=>a.consumedPassageOrder!==null)!.consumedPassageOrder=null;},
      v=>{v.expiredPassageChargeOrder=v.playerActions.find(a=>a.id===PASSAGE&&a.succeeded)!.order;},
      v=>{v.playerActions.find(a=>a.id===PASSAGE&&a.succeeded)!.passageMetres=0;},
    ];
    for(const [i,forge]of forgeries.entries()){const bad=structuredClone(result.round);forge(outcome(bad));expect(validateDeathConsulRoundOutcome(outcome(bad)),`BODY charge forgery ${i}`).toBe(false);expect(validateDeathConsulCombatRound(bad)).toBe(false);}
  });
  it('DIRECTED finish-only terminal branches use actualNEAR2m/OTHER4m or blocked8m ordinary exits; corpses stay put',()=>{
    for(const location of ['NEAR','OTHER']as const)for(const door of ['OPEN','CLOSED','BLOCKED']as const)for(const alive of [false,true]){
      const u=scenario([],s=>{s.deathConsul.life.site.playerLocation=location;s.deathConsul.life.site.door.state=door;if(location==='OTHER')s.deathConsul.life.site.playerPassageMetres+=2;});
      u.enemy('STEADY');const site=structuredClone(u.state.deathConsul.life.site),sp=u.state.spirituality;
      // An isolated corpse/survival finish boundary, never an invented natural injury roll.
      if(!alive)u.state.health=0;else{u.state.combat!.enemyHealth=0;u.state.combat!.enemyStatus='DEAD';}
      const exit=alive?(location==='NEAR'?2:door==='OPEN'?4:8):0,o=finishDeathConsulCombatRound(u.state,u.round,false,u.random.cursor);
      expect(o).toMatchObject({exitMetres:exit,elapsedSeconds:60+exit,playerSpiritualityAfter:sp,enemySpirituality:116,expiredSteadyChargeOrder:0});
      expect(o.siteAfter).toEqual({...site,effect:{mode:'OFF',expiresAt:null},elapsedSeconds:u.round.source.site.elapsedSeconds+60+exit,playerLocation:alive?'ENTRY':location,playerMetres:site.playerMetres+exit});
      expect(o.siteAfter.playerPassageMetres).toBe(site.playerPassageMetres);expect(u.state.deathConsul.encounter.weaponLocation).toBe(alive?'OTHER':'HAND');expect(u.state.deathConsul.encounter.enemyLocation).toBe('OTHER');
      expect(u.state.health).toBe(alive?u.round.source.playerHealth:0);expect(validateDeathConsulRoundOutcome(o)).toBe(false);
    }
  });
  it('rejects substituted sources, wrong physical factors and out-of-band site changes without draws or resource mutation',()=>{
    const u=scenario(),source=structuredClone(u.round.source),before=structuredClone(u.state),cursor=u.random.cursor;
    for(const bad of [null,{...source,targetId:'FR3-ROWAN'},{...source,enemyWeapon:'FR3-ROWAN-CLUB'},{...source,round:99},{...source,sourceEra:source.sourceEra==='ORIGINAL'?'POST_CYCLE':'ORIGINAL'}]){
      expect(resolveDeathConsulCombatAbility(u.state,FLAME,1-statusPenalty(source.playerHealth,100),u.random,u.round,bad as DeathConsulCombatSource|null).selfGain).toBe(0);expect(u.state).toEqual(before);}
    expect(resolveDeathConsulCombatAbility(u.state,FLAME,.5,u.random,u.round).selfGain).toBe(0);expect(resolveDeathConsulEnemyAbility(u.state,'PALE_STRIKE',.5,u.random,u.round).selfGain).toBe(0);
    expect(u.random.cursor).toBe(cursor);expect(u.round.playerActions).toHaveLength(0);expect(u.round.enemyActions).toHaveLength(0);
    u.state.deathConsul.life.site.door.operations++;const changed=structuredClone(u.state);u.player(PASSAGE);expect(u.state).toEqual(changed);expect(u.random.cursor).toBe(cursor);expect(()=>finishDeathConsulCombatRound(u.state,u.round)).toThrow();
  });
  it('caps each actor at six5-second slots, rejects scripted slots as natural replay, and returns detached finished evidence',()=>{
    const u=scenario();for(let i=0;i<6;i++){u.player('EVADE');u.enemy('ACCIDENT');}const before=structuredClone(u.state);u.player(FLAME);u.enemy('PALE_STRIKE');expect(u.state).toEqual(before);
    expect(u.round.playerActions).toHaveLength(6);expect(u.round.enemyActions).toHaveLength(6);const o=finishDeathConsulCombatRound(u.state,u.round,true,u.random.cursor);
    expect(o.elapsedSeconds).toBe(60);expect(validateDeathConsulRoundOutcome(o)).toBe(false);o.siteAfter.door.operations++;expect(deathConsulRoundOutcome(u.round).siteAfter.door.operations).toBe(before.deathConsul.life.site.door.operations);
    expect(()=>finishDeathConsulCombatRound(u.state,u.round)).toThrow();
  });
});

describe('DeathConsul genuine entry, whole public rounds and immutable historical bodies',()=>{
  it('imports the exact closed life site, moves the actual manager2m/2s/2energy outside and enters2m/2s',()=>{
    const e=entry.deathConsul.encounter,start=e.startSite!;expect(entry.deathConsul.life.site).toEqual(deathConsulApproachedSite(start,e.approachWeek!));
    expect(entry.deathConsul.life.site).toMatchObject({playerLocation:'NEAR',playerMetres:start.playerMetres+2,operatorLocation:'OUTSIDE',operatorMetres:start.operatorMetres+2,
      operatorEnergy:start.operatorEnergy-2,operatorConsent:'GRANTED',operatorConsentWeek:entry.week,elapsedSeconds:start.elapsedSeconds+4});
    for(const key of ['door','residual','material','playerPassageMetres','operatorPassageMetres']as const)expect(entry.deathConsul.life.site[key]).toEqual(start[key]);
    expect(currentDeathConsulCombatSource(entry)).toEqual(e.startSource);expect(e.startSource).toMatchObject({targetCore:24,targetSequence:3,actualContemporaryBody:true,independentMind:true,enemyHealth:100,enemyMind:100,enemySpirituality:120,
      thirdPartiesInArea:0,automaticAllyImmunity:false,ordinaryExit:true,pursuit:false,distanceMetres:2});
  });
  it('replays every captured natural public stance from the original source stream, including injuries, clocks and continuing-only refill',()=>{
    let state=entry;expect(recordedRounds.length).toBeGreaterThan(0);
    for(const expected of recordedRounds){expect(currentDeathConsulCombatSource(state)).toEqual(outcome(expected).source);const before=structuredClone(state),next=applySliceIntent(state,{type:'COMBAT_ROUND',stance:expected.stance});
      expect(state).toEqual(before);expect(next.combatHistory.at(-1)).toEqual(expected);expect(next.combatHistory.slice(0,-1)).toEqual(before.combatHistory);
      expect(validateDeathConsulRoundOutcome(outcome(expected))).toBe(true);expect(validateDeathConsulCombatRound(expected)).toBe(true);expect(validateDeathConsulLife(next)).toBe(true);expect(validateDeathConsulEncounter(next)).toBe(true);assertValidSliceState(next);accounting(before,next,expected);state=next;}
    expect(state).toEqual(terminal);expect(terminal.deathConsul.encounter.terminal!.historyIndex).toBe(terminal.combatHistory.length-1);expect(terminal.deathConsul.encounter.terminal!.round).toBe(recordedRounds.length);
  });
  it('keeps actual terminal bodies/weapons, new site objects and every old3/4/long-chapter record; no reintroduction or corpse reset is available',()=>{
    const o=outcome(recordedRounds.at(-1)!),e=terminal.deathConsul.encounter;expect(o.continuing).toBe(false);expect(terminal.combat).toBeNull();expect(currentDeathConsulCombatSource(terminal)).toBeNull();
    expect(e).toMatchObject({targetId:o.targetId,sourceEra:o.source.sourceEra,enemyLocation:'OTHER',enemyMetres:0,enemyHealth:o.enemyHealth,enemyMind:100,enemySpirituality:o.enemySpirituality,enemyInjuries:o.enemyInjuriesAfter,enemyRisk:o.enemyRiskAfter});
    expect(e.weaponLocation).toBe(o.enemyStatus==='RESISTING'?'HAND':'OTHER');expect(terminal.spirituality).toBe(o.playerSpiritualityAfter);expect(terminal.injuries).toEqual(o.playerInjuriesAfter);expect(terminal.deathConsul.life.site).toEqual(o.siteAfter);
    expect(o.siteAfter.effect).toEqual({mode:'OFF',expiresAt:null});expect(o.siteAfter.operatorLocation).toBe('OUTSIDE');expect(o.siteAfter.residual).toEqual(entry.deathConsul.life.site.residual);expect(o.siteAfter.material).toEqual(entry.deathConsul.life.site.material);
    for(const key of legacyKeys)expect(terminal[key]).toEqual(entry[key]);
    for(const type of ['ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER']as const){const frozen=structuredClone(terminal);expect(()=>applySliceIntent(terminal,{type:'DEATH_CONSUL',command:{type}})).toThrow();expect(terminal).toEqual(frozen);}
    expect(()=>applySliceIntent(terminal,{type:'COMBAT_ROUND',stance:'ATTACK'})).toThrow();
  });
  it('DIRECTED era identity units use distinct contemporary people and weapons instead of one ordinary sixty-year survivor',()=>{
    const ids:string[]=[];
    for(const era of ['ORIGINAL','POST_CYCLE']as const){
      const state=structuredClone(entry),identity=DEATH_CONSUL_SOURCES[era],target=DEATH_CONSUL_TARGETS[era];
      // Explicit isolated identity SOURCE fork only. This is not saved or asserted as a natural whole-state history.
      // The genuine fixture is post-cycle. The ORIGINAL fork removes only the era boundary for this local unit.
      state.deathConsul.sourceEra=era;state.deathConsul.encounter.sourceEra=era;state.deathConsul.encounter.targetId=target.id;
      if(era==='ORIGINAL'){state.longChapter.handoff=null;state.longChapter.cycleDeathDate=null;}
      const site=state.deathConsul.life.site;site.sourceEra=era;Object.assign(site,{operatorId:identity.operatorId,operatorName:identity.operatorName,operatorAge:identity.operatorAge,operatorSource:identity.operatorSource});
      site.residual.id=identity.residualId;site.residual.source=identity.residualSource;if(site.material.acquired)Object.assign(site.material,{id:identity.materialId,paidPennies:identity.materialPrice});
      const source=currentDeathConsulCombatSource(state);expect(source).toMatchObject({sourceEra:era,targetId:target.id,targetName:target.name,targetAge:target.age,enemyWeapon:target.weaponId,actualContemporaryBody:true,independentMind:true});
      const round=beginDeathConsulCombatRound(state,'ATTACK',scripted(state));expect(round.source.targetId).toBe(target.id);ids.push(round.source.targetId);
      const view=projectDeathConsulEncounter(state);expect(view.enemy).toMatchObject({id:target.id,name:target.name,age:target.age,sourceEra:era,weaponId:target.weaponId});
      expect(JSON.stringify(source)).not.toMatch(/FR3-ROWAN|UDY4-OWEN|LS2-OWEN/);
    }
    expect(ids).toEqual(['DC2-O-ROOK','DC2-P-NOLAN']);expect(DEATH_CONSUL_TARGETS.ORIGINAL.age).toBe(47);expect(DEATH_CONSUL_TARGETS.POST_CYCLE.age).toBe(45);
  });
  it('projections detach the current site, immutable start site, counts and ordered evidence without further random draws',()=>{
    const frozen=structuredClone(terminal),view=projectDeathConsulCombat(terminal),o=outcome(recordedRounds.at(-1)!);
    // Only the private RNG cursors are omitted; every allowed field remains part of the exact ordered comparison.
    expect(view.lastActionSequence).toEqual([
      ...o.playerActions.map(({randomCursorBefore:_before,randomCursorAfter:_after,...a})=>({...a,actor:'PLAYER'})),
      ...o.enemyActions.map(({randomCursorBefore:_before,randomCursorAfter:_after,...a})=>({...a,actor:'ENEMY'})),
    ].sort((a,b)=>a.order-b.order));
    for(const a of view.lastActionSequence){expect(a).not.toHaveProperty('randomCursorBefore');expect(a).not.toHaveProperty('randomCursorAfter');}
    for(const a of ordered(o)){expect(a).toHaveProperty('randomCursorBefore');expect(a).toHaveProperty('randomCursorAfter');}
    expect(view.enemyAbilityWheel).toEqual(DEATH_CONSUL_ENEMY_ABILITY_WHEEL);expect(view.enemyCountWheel).toEqual(DEATH_CONSUL_ENEMY_COUNT_WHEEL);
    view.site!.door.operations++;view.startSite!.playerMetres++;view.lastActionSequence[0]!.paidCost++;expect(terminal).toEqual(frozen);
    expect(terminal.random).toEqual(frozen.random);expect(o).toEqual(outcome(frozen.combatHistory.at(-1)!));
  });
});

describe('DeathConsul strict ordered complete-RNG validation rejects plausible forged outcomes',()=>{
  it('rejects source, cost, check, order, movement, charge, elapsed time and resource forgery',()=>{
    const actual=recordedRounds[0]!;const changes:[string,(o:DeathConsulRoundOutcome)=>void][]=[
      ['old target',o=>{o.source.targetId='FR3-ROWAN'as never;}],['wrong era',o=>{o.source.sourceEra=o.source.sourceEra==='ORIGINAL'?'POST_CYCLE':'ORIGINAL';}],
      ['old weapon',o=>{o.source.enemyWeapon='FR3-ROWAN-CLUB'as never;}],['wrong age',o=>{o.source.targetAge=99 as never;}],['wrong budget',o=>{o.source.targetCore=25 as never;}],
      ['invented body',o=>{o.source.actualContemporaryBody=false as never;}],['ally immunity',o=>{o.source.automaticAllyImmunity=true as never;}],['distance',o=>{o.source.distanceMetres=6 as never;}],
      ['source cursor',o=>{o.source.randomCursor++;}],['output cursor',o=>{o.randomCursorAfter++;}],['output target',o=>{o.targetId='FR3-ROWAN'as never;}],
      ['player refund',o=>{o.playerSpiritualityAfter++;}],['enemy refill',o=>{o.enemySpirituality++;}],['cost',o=>{ordered(o)[0]!.paidCost++;}],
      ['extra check',o=>{ordered(o)[0]!.rolls.push(1);}],['slot cursor',o=>{ordered(o)[0]!.randomCursorAfter++;}],['slot order',o=>{ordered(o)[0]!.order++;}],
      ['slot time',o=>{ordered(o)[0]!.atSeconds++;}],['slot duration',o=>{ordered(o)[0]!.elapsedSeconds=7 as never;}],['advantage',o=>{ordered(o)[0]!.selfGain++;}],
      ['physical factor',o=>{ordered(o)[0]!.physicalFactor=.5;}],['false threat',o=>{ordered(o)[0]!.threatens=!ordered(o)[0]!.threatens;}],['saved prose',o=>{ordered(o)[0]!.label+=' Free healing';}],
      ['before metres',o=>{ordered(o)[0]!.siteBefore.playerMetres++;}],['after passage metres',o=>{ordered(o)[0]!.siteAfter.playerPassageMetres+=2;}],
      ['invented move',o=>{ordered(o)[0]!.passageMetres=ordered(o)[0]!.passageMetres===0?2:0;}],['unpaid charge',o=>{ordered(o)[0]!.chargeGranted=!ordered(o)[0]!.chargeGranted;}],
      ['retroactive charge',o=>{ordered(o)[0]!.chargeConsumedByOrder=-1;}],['unprovenBODY link',o=>{ordered(o)[0]!.consumedPassageOrder=999;}],['unproven seal link',o=>{ordered(o)[0]!.consumedSteadyOrder=999;}],
      ['applied amount',o=>{ordered(o)[0]!.appliedAmount++;}],['expired charge',o=>{o.expiredPassageChargeOrder=999;}],['expired steady',o=>{o.expiredSteadyChargeOrder=999;}],
      ['attempt flag',o=>{o.passageAttempted=!o.passageAttempted;}],['power use',o=>{o.powerUses.STEADY++;}],['door history',o=>{o.siteAfter.door.operations++;}],
      ['material refill',o=>{o.siteAfter.material.remaining++;}],['residual teleport',o=>{o.siteAfter.residual.location='PLAYER';}],['operator teleport',o=>{o.siteAfter.operatorLocation='ENTRY';}],
      ['ordinary distance',o=>{o.siteAfter.playerMetres++;}],['passage distance',o=>{o.siteAfter.playerPassageMetres++;}],['clock',o=>{o.siteAfter.elapsedSeconds++;}],
      ['round duration',o=>{o.elapsedSeconds=o.elapsedSeconds===60?62:60;}],['ordinary exit',o=>{o.exitMetres=o.exitMetres===0?2:0;}],['continuation',o=>{o.continuing=!o.continuing;}],
      ['free health',o=>{o.playerHealthAfter++;}],['unknown output field',o=>{(o as unknown as Record<string,unknown>).persistentShield=40;}],
    ];
    for(const [name,change]of changes){const round=structuredClone(actual);expect(validateDeathConsulCombatRound(round),name).toBe(true);change(outcome(round));expect(validateDeathConsulRoundOutcome(outcome(round)),name).toBe(false);expect(validateDeathConsulCombatRound(round),name).toBe(false);}
  });
  it('rejects public round metadata and consequence tampering while its nested outcome remains genuine',()=>{
    const changes:((r:SliceCombatRound)=>void)[]=[r=>{r.consequence+=' Undocumented result';},r=>{r.moves[0]!.label+=' Altered';},r=>{r.moves[0]!.selfGain++;},r=>{r.playerAdvantage++;},r=>{r.enemyAdvantage++;},
      r=>{r.winChance++;},r=>{r.playerCount++;},r=>{r.enemyCount++;},r=>{r.playerCountRoll++;},r=>{r.enemyCountRoll++;},r=>{r.first=r.first==='PLAYER'?'ENEMY':'PLAYER';},
      r=>{r.winner=r.winner==='PLAYER'?'ENEMY':'PLAYER';},r=>{r.retreat=r.retreat==='NONE'?'SUCCESS':'NONE';},r=>{r.consequenceRoll=(r.consequenceRoll??0)+1;},r=>{(r as unknown as Record<string,unknown>).freeTurn=true;}];
    for(const [i,change]of changes.entries()){const round=structuredClone(recordedRounds[0]!);change(round);expect(validateDeathConsulRoundOutcome(outcome(round))).toBe(true);expect(validateDeathConsulCombatRound(round),`round mutation ${i}`).toBe(false);}
  });
  it('rejects live/start-site provenance, invented terminal state, resource reset or extra history even when basic shapes remain plausible',()=>{
    const changes:((s:SliceState)=>void)[]=[s=>{s.deathConsul.encounter.startSite!.door.operations++;},s=>{s.deathConsul.encounter.startSite!.playerMetres++;},
      s=>{s.deathConsul.encounter.startSource!.site.operatorEnergy-=2;},s=>{s.deathConsul.encounter.startSource!.randomCursor++;},s=>{s.deathConsul.encounter.targetId='FR3-ROWAN'as never;},
      s=>{s.deathConsul.encounter.sourceEra=s.deathConsul.encounter.sourceEra==='ORIGINAL'?'POST_CYCLE':'ORIGINAL';},s=>{s.deathConsul.encounter.enemySpirituality++;},
      s=>{s.deathConsul.encounter.weaponLocation=s.deathConsul.encounter.weaponLocation==='HAND'?'OTHER':'HAND';},s=>{s.deathConsul.encounter.terminal!.historyIndex--;},
      s=>{s.deathConsul.encounter.terminal!.outcome=s.deathConsul.encounter.terminal!.outcome==='PLAYER_DEAD'?'RETREATED':'PLAYER_DEAD';},s=>{s.deathConsul.life.site.playerPassageMetres++;},
      s=>{s.deathConsul.life.site.operatorEnergy+=2;},s=>{s.combatHistory.push(structuredClone(s.combatHistory.at(-1)!));}];
    for(const [i,change]of changes.entries()){const state=structuredClone(terminal);change(state);expect(validateDeathConsulLife(state)&&validateDeathConsulEncounter(state),`provenance mutation ${i}`).toBe(false);expect(()=>assertValidSliceState(state)).toThrow();}
  });
});
