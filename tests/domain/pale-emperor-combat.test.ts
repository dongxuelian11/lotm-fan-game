import { beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { DEATH_CONSUL_COUNT_WHEEL } from '../../src/domain/death-consul/combat.js';
import { originalDeathConsul, promoted, pe, ready, era } from './pale-emperor-directed-helper.js';
import { PALE_EMPEROR_CASE_IDS } from '../../src/domain/pale-emperor/life.js';
import { resolvePaleEmperorCombatRound } from '../../src/domain/slice/pale-emperor-combat.js';
import { applyPaleEmperorEncounterCommand, validatePaleEmperorEncounter, validatePaleEmperorEncounterCommand,
 projectPaleEmperorEncounter, settlePaleEmperorEncounter, paleEmperorEncounterOriginalEvents, paleEmperorCompletedBudgetMatches,
 paleEmperorEncounterBudget, paleEmperorFinanceSnapshot, paleEmperorEncounterCompletedBudget, blockPaleEmperorEncounter,
 type PaleEmperorEncounterCommand, type PaleEmperorPolicy } from '../../src/domain/pale-emperor/encounter.js';
import { RESIDUAL_QUIETING, SPIRITUAL_INTERDICTION, PALE_EMPEROR_INHERITED_SKILL_IDS, PALE_EMPEROR_NEW_ABILITY_IDS,
 PALE_EMPEROR_COUNT_WHEEL, PALE_EMPEROR_ENEMY_COUNT_WHEEL, PALE_EMPEROR_ENEMY_ABILITY_WHEEL, PALE_EMPEROR_COMBAT_CONSTANTS,
 paleEmperorActionCount, paleEmperorAbilityWheel, drawPaleEmperorEnemyAbility, currentPaleEmperorCombatSource,
 createPaleEmperorRuntime, declarePaleEmperorEnemyAction, resolvePaleEmperorPlayerSlot, resolvePaleEmperorEnemySlot,
 advancePaleEmperorCombatClock, resolvePaleEmperorConsequences, replayPaleEmperorCombatRound, validPaleEmperorCombatSource,
 validatePaleEmperorCombatRound, validatePaleEmperorRoundOutcome, nextPaleEmperorCombatSource,
 type PaleEmperorCombatSource } from '../../src/domain/pale-emperor/combat.js';

const path='tests/fixtures/death-consul-v01730/natural.json';
function original():SliceState{return migrateSliceState(readObjectEntry<SliceState>(path,'final'));}
function context(s:SliceState):SeerContext{return{roll(){throw new Error('Encounter must not draw.');},check(){throw new Error('Encounter must not check.');},note(title,text){s.chronicle.push({id:`record-${s.revision+1}-${s.chronicle.length}`,week:s.week,title,text});}};}
let readyCache:SliceState|undefined;
/** Actual original815 prefix, public recovery/promotion, then all three ordinary
 * life routes. No sequence/mastery/health assignment, injected money or RNG search. */
function readyUnit():SliceState{
 if(!readyCache){let s=promoted();
  for(const caseId of PALE_EMPEROR_CASE_IDS){
   s=ready(s,{cash:caseId==='quiet-lid'?18:10,ap:2});s=pe(s,{type:'OBSERVE',caseId});s=pe(s,{type:'WALK_TO_ANNEX'});
   if(caseId==='quiet-lid')s=pe(s,{type:'BUY_SEALS'});
   s=pe(s,{type:'INVITE',caseId,method:'ORDINARY'});s=pe(s,{type:'CONSENT',permission:'CUSTODIAN'});s=pe(s,{type:'DECLINE_CONSENT',permission:'ABILITY'});
   s=pe(s,{type:'PREPARE_VESSEL'});s=pe(s,{type:'OBSERVE_VESSEL'});
   if(caseId==='quiet-lid'){s=pe(s,{type:'ORDINARY_FIT'});s=pe(s,{type:'RESEAL'});}
   else if(caseId==='guarded-carry'){s=pe(s,{type:'SCREENED_CARRY'});s=pe(s,{type:'ORDINARY_FIT'});s=pe(s,{type:'RESEAL'});}
   else{s=pe(s,{type:'WITHDRAW_CONSENT',permission:'CUSTODIAN'});s=pe(s,{type:'MANUAL_RETURN'});}
   s=pe(s,{type:'RETURN_LOAN'});s=pe(s,{type:'LEAVE'});s=pe(ready(s),{type:'REPORT',caseId});
  }
  s=pe(ready(s),{type:'REFLECT'});readyCache=ready(s,{ap:3,health:100,mind:100,spirituality:120,healed:true,cash:100});
 }return structuredClone(readyCache);
}
beforeAll(()=>{readyUnit();},300000);
function encounter(s:SliceState,c:PaleEmperorEncounterCommand):SliceState{applyPaleEmperorEncounterCommand(s,c,context(s));s.revision++;return s;}
function fighting(policy:PaleEmperorPolicy='ALL'):SliceState{const s=readyUnit();encounter(s,{type:'ENCOUNTER_TALK'});encounter(s,{type:'ENCOUNTER_POLICY',policy});encounter(s,{type:'ENCOUNTER_FIGHT'});expect(validatePaleEmperorEncounter(s)).toBe(true);return s;}
function source(policy:PaleEmperorPolicy='ALL'):PaleEmperorCombatSource{const x=currentPaleEmperorCombatSource(fighting(policy));if(!x)throw new Error('Missing actual source.');expect(validPaleEmperorCombatSource(x)).toBe(true);return x;}
function random(...values:number[]):ActionRandomStream{let i=0;return{seed:'pale-emperor-declared-slot-only',get cursor(){return i;},nextInt(min,max){const n=values[i++]??100;if(n<min||n>max)throw new Error(`Invalid isolated draw ${n}`);return n;}};}
function tick(s:SliceState,stance:'ATTACK'|'CONTROL'|'RETREAT'='CONTROL'){
 const result=resolvePaleEmperorCombatRound(s,stance);s.combatHistory.push(result.round);
 if(result.outcome!=='CONTINUE'){settlePaleEmperorEncounter(s,result.outcome,context(s));if(result.outcome==='PLAYER_DEAD')s.status='DEAD';}
 s.revision++;return result;
}

describe('Pale Emperor independent source and public projection',{timeout:300000},()=>{
 it('reads exact wounded815-command source and shared migrated versions',()=>{
  expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe('283fa4554282597027a6e65f2a31c561750769fb3f93343e570abebac11fdee9');
  expect(readObjectEntry<unknown[]>(path,'commands')).toHaveLength(815);const s=original();
  expect(s).toMatchObject({schemaVersion:CURRENT_SCHEMA_VERSION,contentVersion:CURRENT_CONTENT_VERSION,revision:816,week:3290,status:'ACTIVE',health:20,mind:100,spirituality:95,cash:34,actionsRemaining:1,injuryRisk:6,random:{seed:'corpsecollector-natural-v032',cursor:359},character:{gender:'FEMALE',coreStats:{physique:32,perception:28,will:26,knowledge:22}}});
  expect(s.injuries.map(i=>[i.severity,i.treatedRevision])).toEqual([['HEAVY',null],['LIGHT',null],['LIGHT',null],['HEAVY',null]]);
  expect(s.deathConsul.encounter).toMatchObject({status:'RETREATED',enemyHealth:80,enemySpirituality:46});expect(s.undying.encounter.status).toBe('AVAILABLE');
  expect(blockPaleEmperorEncounter(s,{type:'ENCOUNTER_TALK'})).not.toBeNull();
 });
 it('preserves all17 actual old masteries including5 zeroes and grants no new mastery on promotion or ordinary practice',()=>{
  const old=originalDeathConsul(),s=readyUnit();expect(PALE_EMPEROR_INHERITED_SKILL_IDS).toHaveLength(17);
  expect(PALE_EMPEROR_INHERITED_SKILL_IDS.filter(id=>old.progression.mastery[id]===0)).toHaveLength(5);
  for(const id of PALE_EMPEROR_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(old.progression.mastery[id]);
  for(const id of PALE_EMPEROR_NEW_ABILITY_IDS)expect(s.progression.mastery[id]).toBe(0);
  expect(s.deathConsul).toEqual(old.deathConsul);expect(s.undying).toEqual(old.undying);expect(s.longChapter).toEqual(old.longChapter);
 });
 it('walks the road12m then forecourt4m; holds its own finite originals with adults absent',()=>{
  const s=fighting(),e=s.paleEmperor.encounter,p=projectPaleEmperorEncounter(s),x=source();
  expect(e.scene).toMatchObject({clockSeconds:16,externalSeconds:16,playerTravelMetres:16,roadTravelMetres:12,forecourtTravelMetres:4,thirdPartiesInArea:0,presentMemberIds:[]});
  expect(p.enemy).toMatchObject({id:'PE1-ALDEN-WARD',name:'阿尔登·沃德',age:47,sequence:1,health:100,mind:100,spirituality:120});
  expect(e.materials.weapon).toMatchObject({id:'PE1-ALDEN-CLUB',owner:'PE1-ALDEN-WARD',location:'HAND'});expect(e.materials.marks.remaining).toBe(3);
  expect(e.materials.marks.pieces.map(m=>m.id)).toEqual(['PE1-ALDEN-MARK-1','PE1-ALDEN-MARK-2','PE1-ALDEN-MARK-3']);
  expect(x.clubHeld).toBe(false);expect(paleEmperorEncounterOriginalEvents(s)).toEqual([]);expect(e.preparation!.before.cash).toBe(e.preparation!.after.cash);
 });
 it('uses the exact actual public wheels and body constants',()=>{
  expect(PALE_EMPEROR_COUNT_WHEEL).toEqual(DEATH_CONSUL_COUNT_WHEEL);expect(PALE_EMPEROR_ENEMY_COUNT_WHEEL).toEqual(DEATH_CONSUL_COUNT_WHEEL);
  expect([1,10,11,25,26,50,51,75,76,90,91,100].map(paleEmperorActionCount)).toEqual([1,1,2,2,3,3,4,4,5,5,6,6]);
  const counts:Record<string,number>={};for(let n=1;n<=100;n++){const id=drawPaleEmperorEnemyAbility(random(n));counts[id]=(counts[id]??0)+1;}
  expect(counts).toEqual({PALE_STRIKE:25,SPIRIT_PRESSURE:20,STEADY:20,BODY_STRIKE:20,CLOSE_SCREEN:10,ACCIDENT:5});expect(PALE_EMPEROR_ENEMY_ABILITY_WHEEL.map(x=>x.weight)).toEqual([25,20,20,20,10,5]);
  expect(paleEmperorAbilityWheel(readyUnit(),null).reduce((n,x)=>n+x.weight,0)).toBeCloseTo(100);expect(PALE_EMPEROR_COMBAT_CONSTANTS).toMatchObject({tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,windowSeconds:20});
 });
 it('rejects extra command fields, borrowed targets, forged originals and absent policy',()=>{
  expect(validatePaleEmperorEncounterCommand({type:'ENCOUNTER_FIGHT',target:'DC2-P-NOLAN'})).toBe(false);
  const s=readyUnit();encounter(s,{type:'ENCOUNTER_TALK'});expect(blockPaleEmperorEncounter(s,{type:'ENCOUNTER_FIGHT'})).not.toBeNull();
  const bad=structuredClone(s);bad.deathConsul.encounter.enemyHealth++;expect(validatePaleEmperorEncounter(bad)).toBe(false);
  const forged=fighting();forged.paleEmperor.encounter.materials.marks.pieces[0]!.id='OLD-SPIRIT';expect(currentPaleEmperorCombatSource(forged)).toBeNull();
 });
});

describe('Pale Emperor next eligible actual pressure windows',{timeout:300000},()=>{
 it('cannot target unseen, absent, physical-only or already-resolved pressure',()=>{
  for(const id of PALE_EMPEROR_NEW_ABILITY_IDS){
   const x=source(),r=createPaleEmperorRuntime(x);expect(resolvePaleEmperorPlayerSlot(x,r,id,0,random())).toMatchObject({finiteResult:'UNAVAILABLE',paidCost:0,masteryApplied:[]});
   declarePaleEmperorEnemyAction(x,r,'BODY_STRIKE',0);expect(resolvePaleEmperorPlayerSlot(x,r,id,1,random()).paidCost).toBe(0);resolvePaleEmperorEnemySlot(x,r,'BODY_STRIKE',2,random());
   resolvePaleEmperorEnemySlot(x,r,'SPIRIT_PRESSURE',3,random(100));expect(resolvePaleEmperorPlayerSlot(x,r,id,4,random())).toMatchObject({finiteResult:'UNAVAILABLE',paidCost:0});expect(r.mastery).toEqual(x.mastery);
  }
 });
 it('quieting pays8S2M, opens without contribution, then reduces one later same-source pressure30',()=>{
  const x=source(),r=createPaleEmperorRuntime(x);declarePaleEmperorEnemyAction(x,r,'PALE_STRIKE',0);
  const a=resolvePaleEmperorPlayerSlot(x,r,RESIDUAL_QUIETING,0,random(1,100));expect(a).toMatchObject({paidCost:8,mindCost:2,selfGain:0,enemyReduction:0,finiteResult:'PENDING',masteryApplied:[],check:{ability:'will',difficulty:18}});
  expect(r.mastery).toEqual(x.mastery);expect(r.windows.residualQuieting).toMatchObject({createdAt:16,expiresAt:36,sourceEffectId:'PE1-ALDEN-SPIRIT-LINE'});
  expect(resolvePaleEmperorEnemySlot(x,r,'PALE_STRIKE',1,random(100))).toMatchObject({rawContribution:105,selfGain:75,attackKind:'MENTAL',threatens:false,spiritMarksSpent:1,masteryApplied:[RESIDUAL_QUIETING]});
  expect(resolvePaleEmperorEnemySlot(x,r,'PALE_STRIKE',2,random(100)).selfGain).toBe(105);expect(r.mastery[RESIDUAL_QUIETING]).toBe(x.mastery[RESIDUAL_QUIETING]!+8);
 });
 it('interdiction ignores a resisted effect and subsequent BODY before consuming only the next eligible MENTAL hit',()=>{
  const x=source(),r=createPaleEmperorRuntime(x);declarePaleEmperorEnemyAction(x,r,'SPIRIT_PRESSURE',0);
  expect(resolvePaleEmperorPlayerSlot(x,r,SPIRITUAL_INTERDICTION,0,random(1,100))).toMatchObject({paidCost:7,mindCost:2,finiteResult:'PENDING',check:{ability:'knowledge',difficulty:18}});
  expect(resolvePaleEmperorEnemySlot(x,r,'SPIRIT_PRESSURE',1,random(30))).toMatchObject({paidCost:7,selfGain:0,finiteResult:'RESISTED',masteryApplied:[]});expect(r.windows.spiritualInterdiction).not.toBeNull();
  expect(resolvePaleEmperorEnemySlot(x,r,'BODY_STRIKE',2,random())).toMatchObject({selfGain:20,rawContribution:20,attackKind:'BODY',masteryApplied:[],travelPath:[6,4,6]});expect(r.windows.spiritualInterdiction).not.toBeNull();
  expect(resolvePaleEmperorEnemySlot(x,r,'SPIRIT_PRESSURE',3,random(100))).toMatchObject({selfGain:35,rawContribution:65,attackKind:'MENTAL',masteryApplied:[SPIRITUAL_INTERDICTION]});expect(r.windows.spiritualInterdiction).toBeNull();
 });
 it('two paid windows can each reduce30 on one actual later hit without awarding twice',()=>{
  const x=source(),r=createPaleEmperorRuntime(x);declarePaleEmperorEnemyAction(x,r,'PALE_STRIKE',0);
  resolvePaleEmperorPlayerSlot(x,r,RESIDUAL_QUIETING,0,random(1,100));resolvePaleEmperorPlayerSlot(x,r,SPIRITUAL_INTERDICTION,1,random(1,100));
  expect(resolvePaleEmperorEnemySlot(x,r,'PALE_STRIKE',2,random(100))).toMatchObject({selfGain:45,rawContribution:105,masteryApplied:[RESIDUAL_QUIETING,SPIRITUAL_INTERDICTION]});
  expect(r.body).toMatchObject({residualQuietingAttempts:1,spiritualInterdictionAttempts:1,residualQuietingSuccesses:1,spiritualInterdictionSuccesses:1,totalOwnerMindSpent:4});
 });
 it('failed and resisted openings retain costs, no same-round rerolls and no insufficient-resource debit',()=>{
  for(const id of PALE_EMPEROR_NEW_ABILITY_IDS)for(const rolls of [[100],[1,30]]){
   const x=source(),r=createPaleEmperorRuntime(x);declarePaleEmperorEnemyAction(x,r,'PALE_STRIKE',0);
   expect(resolvePaleEmperorPlayerSlot(x,r,id,0,random(...rolls))).toMatchObject({paidCost:id===RESIDUAL_QUIETING?8:7,mindCost:2,masteryApplied:[]});expect(r.mastery).toEqual(x.mastery);
   expect(resolvePaleEmperorPlayerSlot(x,r,id,1,random())).toMatchObject({finiteResult:'ALREADY_ATTEMPTED',paidCost:0});
  }
  const x=source(),r=createPaleEmperorRuntime(x);declarePaleEmperorEnemyAction(x,r,'PALE_STRIKE',0);r.playerS=6;expect(resolvePaleEmperorPlayerSlot(x,r,SPIRITUAL_INTERDICTION,0,random())).toMatchObject({finiteResult:'INSUFFICIENT',paidCost:0,mindCost:0});
 });
 it('exact20-second expiry, changing conditions, closed screen, or leaving ends a window without mastery or refund',()=>{
  for(const change of [(r:ReturnType<typeof createPaleEmperorRuntime>)=>advancePaleEmperorCombatClock(r,15),(r:ReturnType<typeof createPaleEmperorRuntime>)=>{r.root.conditionVersion++;},(r:ReturnType<typeof createPaleEmperorRuntime>)=>{r.materials.screen.hood='CLOSED';},(r:ReturnType<typeof createPaleEmperorRuntime>)=>{r.root.playerLocation='OUTSIDE';r.root.playerCoordinate=0;}]){
   const x=source(),r=createPaleEmperorRuntime(x);declarePaleEmperorEnemyAction(x,r,'SPIRIT_PRESSURE',0);resolvePaleEmperorPlayerSlot(x,r,RESIDUAL_QUIETING,0,random(1,100));change(r);advancePaleEmperorCombatClock(r,0);expect(r.windows.residualQuieting).toBeNull();expect(r.mastery).toEqual(x.mastery);expect(r.playerS).toBe(x.playerSpirituality-8);expect(r.expiredWindows).toHaveLength(1);
  }
 });
 it('ordinary and inherited-only policies never pay for new powers',()=>{
  for(const policy of ['ORDINARY','INHERITED_ONLY'] as const){const x=source(policy),r=createPaleEmperorRuntime(x);declarePaleEmperorEnemyAction(x,r,'SPIRIT_PRESSURE',0);for(const id of PALE_EMPEROR_NEW_ABILITY_IDS)expect(resolvePaleEmperorPlayerSlot(x,r,id,0,random())).toMatchObject({paidCost:0,selectedAbility:'BLOCK'});expect(r.mastery).toEqual(x.mastery);}
 });
});

describe('finite originals, inherited actions and real consequences',{timeout:300000},()=>{
 it('spends only its3 original marks including resisted attempts, then uses the same physical club',()=>{
  const x=source(),r=createPaleEmperorRuntime(x);for(let i=0;i<3;i++)expect(resolvePaleEmperorEnemySlot(x,r,'PALE_STRIKE',i,random(30))).toMatchObject({paidCost:7,spiritMarksSpent:1,spiritMarkId:`PE1-ALDEN-MARK-${i+1}`,selfGain:0});
  expect(r.materials.marks.remaining).toBe(0);expect(r.materials.marks.pieces.map(x=>x.state)).toEqual(['SPENT','SPENT','SPENT']);expect(r.body.enemySpirituality).toBe(99);
  expect(resolvePaleEmperorEnemySlot(x,r,'PALE_STRIKE',3,random())).toMatchObject({selectedAbility:'BODY_STRIKE',paidCost:0,spiritMarksSpent:0,selfGain:20,attackKind:'BODY',travelPath:[6,4,6],travelMetres:4});advancePaleEmperorCombatClock(r,60);expect(r.body.enemySpirituality).toBe(99);
 });
 it('physically closes and reopens the same screen, preventing unseen supernatural attacks',()=>{
  const x=source(),r=createPaleEmperorRuntime(x);expect(resolvePaleEmperorEnemySlot(x,r,'CLOSE_SCREEN',0,random())).toMatchObject({paidCost:3,conditionVersionAfter:2,travelMetres:2,travelPath:[6,5,6]});
  expect(resolvePaleEmperorEnemySlot(x,r,'PALE_STRIKE',1,random())).toMatchObject({selectedAbility:'OBSERVE',paidCost:0,spiritMarksSpent:0});expect(r.materials.marks.remaining).toBe(3);
  expect(resolvePaleEmperorPlayerSlot(x,r,'OBSERVE',2,random())).toMatchObject({travelMetres:2,travelPath:[4,5,4],conditionVersionAfter:3});expect(r.root).toMatchObject({visibleBodyLine:true,observedConditionVersion:3,playerTravelMetres:18,forecourtTravelMetres:6,roadTravelMetres:12});
  expect(resolvePaleEmperorEnemySlot(x,r,'CLOSE_SCREEN',3,random())).toMatchObject({selectedAbility:'OBSERVE',paidCost:0});
 });
 it('retains actual6S words and seal,4S door,6S ferry/ward,7S flame and never summons unavailable old people or endpoints',()=>{
  for(const [id,cost] of [['death.s6.dead-words',6],['death.s5.underworld-door',4],['death.s4.underworld-seal',6],['death.s3.bounded-ferry',6],['death.s3.departure-ward',6],['death.s2.pale-flame',7]] as const){const x=source(),r=createPaleEmperorRuntime(x);expect(resolvePaleEmperorPlayerSlot(x,r,id,0,random(100))).toMatchObject({paidCost:cost,finiteResult:'FAILED',masteryApplied:[]});expect(resolvePaleEmperorPlayerSlot(x,r,id,1,random(1,100))).toMatchObject({paidCost:cost,masteryApplied:[id]});}
  const x=source(),r=createPaleEmperorRuntime(x);for(const id of ['death.s5.inner-underworld','death.s6.spirit-recruitment','death.s7.spirit-borrowing','death.s2.spirit-passage','death.s8.death-eye'] as const)expect(resolvePaleEmperorPlayerSlot(x,r,id,0,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE',selectedAbility:'OBSERVE',masteryApplied:[]});expect(r.mastery).toEqual(x.mastery);
 });
 it('paid enemy steady blocks only the next actual inherited restraint; it does not protect against physical attack',()=>{
  const x=source(),r=createPaleEmperorRuntime(x);expect(resolvePaleEmperorEnemySlot(x,r,'STEADY',0,random(100))).toMatchObject({paidCost:6,enemyReduction:0,finiteResult:'PENDING'});
  expect(resolvePaleEmperorPlayerSlot(x,r,'STRIKE',1,random()).selfGain).toBe(12);expect(r.windows.enemySteady).not.toBeNull();
  expect(resolvePaleEmperorPlayerSlot(x,r,'death.s3.bounded-ferry',2,random(1,100))).toMatchObject({paidCost:6,rawReduction:36,enemyReduction:4,masteryApplied:['death.s3.bounded-ferry']});expect(r.windows.enemySteady).toBeNull();
  expect(resolvePaleEmperorEnemySlot(x,r,'STEADY',3,random())).toMatchObject({paidCost:0,selectedAbility:'OBSERVE'});
 });
 it('NONE never wounds; MENTAL loss preserves body wounds/risk; BODY death remains terminal without revival',()=>{
  const x=source(),r=createPaleEmperorRuntime(x),none=resolvePaleEmperorEnemySlot(x,r,'ACCIDENT',0,random());expect(resolvePaleEmperorConsequences(x,r,[],[none],'ENEMY','NONE',random())).toMatchObject({consequenceDomain:'NONE',playerHealth:x.playerHealth,playerRisk:x.playerRisk,consequenceWeights:null});
  const mental=resolvePaleEmperorEnemySlot(x,r,'SPIRIT_PRESSURE',1,random(100));expect(resolvePaleEmperorConsequences(x,r,[],[mental],'ENEMY','NONE',random())).toMatchObject({consequenceDomain:'MENTAL',playerHealth:x.playerHealth,playerInjuries:x.playerInjuries,playerRisk:x.playerRisk,consequenceWeights:null});expect(r.playerM).toBe(x.playerMind-10);
  const dying=createPaleEmperorRuntime(x),body=resolvePaleEmperorEnemySlot(x,dying,'BODY_STRIKE',0,random());expect(resolvePaleEmperorConsequences(x,dying,[],[body],'ENEMY','NONE',random(100))).toMatchObject({playerHealth:0,outcome:'PLAYER_DEAD',consequenceDomain:'BODY'});
 });
 it('replays exact original cursor and order, and rejects forged marks, costs, source snapshots and results',()=>{
  const x=source(),before=structuredClone(x),result=replayPaleEmperorCombatRound(x,'CONTROL'),o=result.round.paleEmperorOutcome!;expect(x).toEqual(before);expect(validatePaleEmperorCombatRound(result.round)).toBe(true);expect(validatePaleEmperorRoundOutcome(o)).toBe(true);
  expect(o.windowsAfter).toEqual({residualQuieting:null,spiritualInterdiction:null,enemySteady:null});expect(o.rootAfter.clockSeconds).toBe(x.root.clockSeconds+60);
  const actions=[...o.playerActions,...o.enemyActions].sort((a,b)=>a.order-b.order);expect(actions.map(a=>a.order)).toEqual(actions.map((_a,i)=>i));expect(actions.map(a=>a.atSeconds)).toEqual(actions.map((_a,i)=>16+5*i));expect(result.round.moves.map(a=>a.actor)).toEqual(actions.map(a=>a.actor));
  for(const mutate of [(v:typeof o)=>{v.randomCursorAfter++;},(v:typeof o)=>{v.playerSpiritualityAfter++;},(v:typeof o)=>{v.materialsAfter.marks.remaining++;},(v:typeof o)=>{v.materialsAfter.marks.pieces[0]!.id='DC2-OLD-MARK';},(v:typeof o)=>{v.rootAfter.roadTravelMetres++;},(v:typeof o)=>{v.source.preparation.week++;}]){const forged=structuredClone(o);mutate(forged);expect(validatePaleEmperorRoundOutcome(forged)).toBe(false);}
  if(o.continuing){const next=nextPaleEmperorCombatSource(o);expect(next.playerSpirituality).toBe(Math.min(120,o.playerSpiritualityAfter+12));expect(next.body.enemySpirituality).toBe(o.enemySpirituality);expect(validPaleEmperorCombatSource(next)).toBe(true);}
 });
 it('actual retreat returns4m then12m without changing old people or old combat history',()=>{
  const s=fighting(),old=structuredClone(s),history=structuredClone(s.combatHistory);expect(tick(s,'RETREAT').outcome).toBe('RETREATED');expect(s.combat).toBeNull();expect(validatePaleEmperorEncounter(s)).toBe(true);
  expect(s.combatHistory.slice(0,history.length)).toEqual(history);expect(s.deathConsul).toEqual(old.deathConsul);expect(s.ferryman).toEqual(old.ferryman);expect(s.longChapter).toEqual(old.longChapter);
  const e=s.paleEmperor.encounter,o=s.combatHistory.at(-1)!.paleEmperorOutcome!;expect(e.terminal).toMatchObject({outcome:'RETREATED',exitMetres:4,exitSeconds:4,roadExitMetres:12,roadExitSeconds:12});expect(e.scene.playerTravelMetres).toBe(o.rootAfter.playerTravelMetres+16);expect(e.scene.clockSeconds).toBe(o.rootAfter.clockSeconds+16);expect(e.scene).toMatchObject({playerLocation:'OUTSIDE',roadTravelMetres:24});
  expect(paleEmperorEncounterCompletedBudget(s)).toMatchObject({revision:o.source.revision,randomCursor:o.randomCursorAfter});expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('preserves the full valid current-era state after actual public retreat and subsequent work',()=>{
  let s=pe(readyUnit(),{type:'ENCOUNTER_TALK'});s=pe(s,{type:'ENCOUNTER_POLICY',policy:'ALL'});s=pe(s,{type:'ENCOUNTER_FIGHT'});assertValidSliceState(s);
  s=applySliceIntent(s,{type:'COMBAT_ROUND',stance:'RETREAT'});expect(s.paleEmperor.encounter.status).toBe('RETREATED');assertValidSliceState(s);
  const before=s; if(s.actionsRemaining===0)s=era(s,'ERA_NEXT_WEEK');s=era(s,'ERA_WORK');assertValidSliceState(s);
  expect(s.paleEmperor.encounter).toEqual(before.paleEmperor.encounter);expect(s.combatHistory).toEqual(before.combatHistory);
  expect(s.ferryman.era.works).toBe(before.ferryman.era.works+1);
 },300000);
 it('zero-AP peaceful exit preserves current-era AP0/cash/date until an actual separate ERA_NEXT_WEEK',()=>{
  // Reach one remaining action through actual current-era labour, never overwrite its budget.
  let s=readyUnit();while(s.actionsRemaining>1)s=era(s,'ERA_WORK');const week=s.week,date={...s.date},cash=s.cash,oldEra=structuredClone(s.ferryman.era);
  encounter(s,{type:'ENCOUNTER_TALK'});expect(s.actionsRemaining).toBe(0);expect(blockPaleEmperorEncounter(s,{type:'ENCOUNTER_FIGHT'})).not.toBeNull();expect(blockPaleEmperorEncounter(s,{type:'LEAVE_ENCOUNTER'})).toBeNull();encounter(s,{type:'LEAVE_ENCOUNTER'});
  expect(s.week).toBe(week);expect(s.date).toEqual(date);expect(s.cash).toBe(cash);expect(s.ferryman.era).toEqual(oldEra);expect(validatePaleEmperorEncounter(s)).toBe(true);
  const budget=paleEmperorEncounterBudget(s),finance=paleEmperorFinanceSnapshot(s);expect(paleEmperorCompletedBudgetMatches(s,budget,finance,week,date,s.revision,s.random.cursor,'沿普通路和平离开附室外前庭')).toBe(true);
  const forged=structuredClone(s);forged.cash++;expect(validatePaleEmperorEncounter(forged)).toBe(false);s=era(s,'ERA_NEXT_WEEK');expect(s.week).toBe(week+1);expect(s.cash).toBe(cash-24);expect(s.actionsRemaining).toBe(4);expect(validatePaleEmperorEncounter(s)).toBe(true);
 });
});
