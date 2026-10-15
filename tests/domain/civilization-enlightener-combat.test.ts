import { describe, expect, it } from 'vitest';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { KNOWLEDGE_MENTOR_COUNT_WHEEL } from '../../src/domain/knowledge-mentor/combat.js';
import { CIVILIZATION_ENLIGHTENER_CASE_IDS } from '../../src/domain/civilization-enlightener/life.js';
import { validateCivilizationEnlightenerEncounter, validateCivilizationEnlightenerEncounterCommand,
 projectCivilizationEnlightenerEncounter, civilizationEnlightenerEncounterOriginalEvents } from '../../src/domain/civilization-enlightener/encounter.js';
import { PROCESS_ANALYSIS, OPERATIONAL_GUIDANCE, CIVILIZATION_ENLIGHTENER_INHERITED_SKILL_IDS,
 CIVILIZATION_ENLIGHTENER_COUNT_WHEEL, CIVILIZATION_ENLIGHTENER_ENEMY_COUNT_WHEEL,
 civilizationEnlightenerAbilityWheel, currentCivilizationEnlightenerCombatSource, createCivilizationEnlightenerRuntime,
 declareCivilizationEnlightenerEnemyAction, resolveCivilizationEnlightenerPlayerSlot, resolveCivilizationEnlightenerEnemySlot,
 advanceCivilizationEnlightenerCombatClock, replayCivilizationEnlightenerCombatRound, validCivilizationEnlightenerCombatSource,
 validateCivilizationEnlightenerCombatRound, validateCivilizationEnlightenerRoundOutcome,
 type CivilizationEnlightenerCombatSource } from '../../src/domain/civilization-enlightener/combat.js';
import { ce, promoted, originalKnowledgeMentor, recoverResources, rejectEnlightener, step } from './civilization-enlightener-directed-helper.js';

let readyCache:SliceState|undefined;
/** Every step after the pre-journal directed fixture is an actual command.
 * Clinic/rest removes the real old wound; original objects are never rewritten. */
function ready():SliceState{
 if(!readyCache){let s=recoverResources(promoted());
  for(const caseId of CIVILIZATION_ENLIGHTENER_CASE_IDS){
   s=ce(s,{type:'OBSERVE',caseId});s=ce(s,{type:'INVITE',caseId,method:'ORDINARY'});
   s=ce(s,{type:'CONSENT',permission:'TEACHING'});s=ce(s,{type:'DECLINE_CONSENT',permission:'ABILITY'});
   for(const type of ['BORROW_WRENCH','ENTER_WORKSHOP','PLACE_ORIGINALS'] as const)s=ce(s,{type});
   if(caseId==='worn-bearing'){for(const type of ['READ_RECORDS','INSPECT_FRAME','HAND_INSPECT','BUY_SHIM','REPAIR_FRAME'] as const)s=ce(s,{type});}
   else{for(const type of ['DEMONSTRATE_STOP','ARM_MANUAL_LOAD','MANUAL_STOP'] as const)s=ce(s,{type});}
   s=ce(s,{type:'RETURN_ORIGINALS'});s=ce(s,{type:'MOVE',to:'NEAR'});s=ce(s,{type:'RETURN_WRENCH'});s=ce(s,{type:'RETURN_HOME'});s=ce(s,{type:'REPORT',caseId});
  }
  readyCache=ce(s,{type:'REFLECT'});assertValidSliceState(readyCache);
 }
 return structuredClone(readyCache);
}
let fightCache:SliceState|undefined;
function fighting():SliceState{if(!fightCache){let s=ce(ready(),{type:'ENCOUNTER_TALK'});s=ce(s,{type:'ENCOUNTER_POLICY',policy:'ALL'});fightCache=ce(s,{type:'ENCOUNTER_FIGHT'});}return structuredClone(fightCache);}
function source():CivilizationEnlightenerCombatSource{const x=currentCivilizationEnlightenerCombatSource(fighting());if(!x)throw new Error('Actual public encounter absent.');return x;}
/** Isolated slot inputs are not written into the actual campaign or its RNG. */
function random(...rolls:number[]):ActionRandomStream{let cursor=0;return{seed:'isolated-declared-slot',get cursor(){return cursor;},nextInt(min,max){const n=rolls[cursor++];if(n===undefined||n<min||n>max)throw new Error(`Unexpected slot draw ${n} for ${min}..${max}`);return n;}};}

describe('Civilization Enlightener continuous optional workshop encounter',()=>{
 it('inherits the actual nineteen skills and original zero-charge pair, without plates, charge or mastery grants',()=>{
  const s=ready(),old=originalKnowledgeMentor(),x=source();
  expect(CIVILIZATION_ENLIGHTENER_COUNT_WHEEL).toBe(KNOWLEDGE_MENTOR_COUNT_WHEEL);expect(CIVILIZATION_ENLIGHTENER_ENEMY_COUNT_WHEEL).toBe(KNOWLEDGE_MENTOR_COUNT_WHEEL);
  expect(CIVILIZATION_ENLIGHTENER_COUNT_WHEEL.map(a=>a.weight)).toEqual([10,15,25,25,15,10]);expect(CIVILIZATION_ENLIGHTENER_INHERITED_SKILL_IDS).toHaveLength(19);
  for(const id of CIVILIZATION_ENLIGHTENER_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(old.progression.mastery[id]);
  expect(CIVILIZATION_ENLIGHTENER_INHERITED_SKILL_IDS.filter(id=>s.progression.mastery[id]===0)).toHaveLength(7);
  expect(x.creations.map(v=>[v.id,v.charge,v.durability,v.active,v.location])).toEqual([['AL4-BOX-1',0,100,false,'YARD'],['AL4-FRAME-1',0,95,false,'YARD']]);
  expect(s.knowledgeMentor.life.combatPlates).toEqual(old.knowledgeMentor.life.combatPlates);
  expect(s.knowledgeMentor.encounter.enemyStatus).toBe('DEAD');expect(s.alchemist.encounter.enemy.status).toBe('DEAD');expect(s.arcaneScholar.encounter.enemyStatus).toBe('SURRENDERED');
  expect(x).toMatchObject({targetId:'CE1-ADRIAN-HALE',targetAge:44,targetCore:24,thirdPartiesInArea:0,body:{enemyHealth:100,enemyMind:100,enemySpirituality:120}});
  expect(validCivilizationEnlightenerCombatSource(x)).toBe(true);expect(civilizationEnlightenerAbilityWheel(s,null).reduce((n,a)=>n+a.weight,0)).toBeCloseTo(100);
 });
 it('requires completed physical life, actual talk and a pre-fight policy, and offers an actual four-metre peaceful exit',()=>{
  rejectEnlightener(promoted(),{type:'ENCOUNTER_TALK'});rejectEnlightener(ready(),{type:'ENCOUNTER_FIGHT'});
  const arrived=ce(ready(),{type:'ENCOUNTER_TALK'}),p=projectCivilizationEnlightenerEncounter(arrived);
  expect(p.scene).toMatchObject({playerLocation:'YARD',playerCoordinate:4,enemyCoordinate:6,playerTravelMetres:4,clockSeconds:4,presentMemberIds:[]});
  expect(arrived.civilizationEnlightener.life.practice.participant.present).toBe(false);rejectEnlightener(arrived,{type:'ENCOUNTER_FIGHT'});
  const left=ce(arrived,{type:'LEAVE_ENCOUNTER'});expect(left.civilizationEnlightener.encounter.scene).toMatchObject({playerLocation:'WORKSHOP',playerCoordinate:0,playerTravelMetres:8,clockSeconds:8});
  expect(left.alchemist.life.creations.every(v=>v.location==='PLAYER'&&!v.active)).toBe(true);expect(validateCivilizationEnlightenerEncounter(left)).toBe(true);rejectEnlightener(left,{type:'ENCOUNTER_TALK'});
  rejectEnlightener(fighting(),{type:'ENCOUNTER_POLICY',policy:'ORDINARY'});
  expect(civilizationEnlightenerEncounterOriginalEvents(left).map(e=>e.source)).toEqual(['ENCOUNTER_TALK','LEAVE_ENCOUNTER']);
  expect(JSON.stringify(p)).not.toMatch(/候选|\dG|（G）/);
 });
 it('rejects invented fields, prior dead enemies, fabricated old skill values and replacement resources',()=>{
  for(const c of [{type:'ENCOUNTER_POLICY',policy:'ALL',extra:true},{type:'ENCOUNTER_FIGHT',target:'KM2-ROWAN-HALE'},{type:'RECHARGE_FRAME'}])expect(validateCivilizationEnlightenerEncounterCommand(c)).toBe(false);
  for(const mutate of [(x:CivilizationEnlightenerCombatSource)=>{(x as unknown as {targetId:string}).targetId='KM2-ROWAN-HALE';},
   (x:CivilizationEnlightenerCombatSource)=>{x.creations[1]!.charge=1;},(x:CivilizationEnlightenerCombatSource)=>{x.creations[1]!.durability=100;},
   (x:CivilizationEnlightenerCombatSource)=>{x.mastery['paragon.s4.animate-made-object']=1;},(x:CivilizationEnlightenerCombatSource)=>{x.mastery['paragon.s1.free-machines']=500;},
   (x:CivilizationEnlightenerCombatSource)=>{x.root.presentMemberIds.push('KM2-VERA');},(x:CivilizationEnlightenerCombatSource)=>{x.randomSeed='replacement';}]){const x=source();mutate(x);expect(validCivilizationEnlightenerCombatSource(x)).toBe(false);}
 });
});

describe('finite observed actions, real payments and later usable original operations',()=>{
 it('requires an observed pending mechanical action; absent, mental, already-completed and denied-policy targets do not cast',()=>{
  const x=source(),r=createCivilizationEnlightenerRuntime(x);
  expect(resolveCivilizationEnlightenerPlayerSlot(x,r,PROCESS_ANALYSIS,0,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE'});
  declareCivilizationEnlightenerEnemyAction(x,r,'MIND_PRESSURE',0);expect(resolveCivilizationEnlightenerPlayerSlot(x,r,PROCESS_ANALYSIS,1,random()).paidCost).toBe(0);resolveCivilizationEnlightenerEnemySlot(x,r,'MIND_PRESSURE',2,random());
  expect(resolveCivilizationEnlightenerPlayerSlot(x,r,PROCESS_ANALYSIS,3,random()).paidCost).toBe(0);
  x.policy='INHERITED_ONLY';declareCivilizationEnlightenerEnemyAction(x,r,'MECHANICAL_PULSE',1);expect(resolveCivilizationEnlightenerPlayerSlot(x,r,PROCESS_ANALYSIS,4,random()).paidCost).toBe(0);
  expect(r.mastery).toEqual(x.mastery);
 });
 it('pays failed and resisted checks and forbids a second attempt in the round',()=>{
  for(const rolls of [[100],[1,30]]){const x=source(),r=createCivilizationEnlightenerRuntime(x);declareCivilizationEnlightenerEnemyAction(x,r,'MECHANICAL_PULSE',0);
   const a=resolveCivilizationEnlightenerPlayerSlot(x,r,PROCESS_ANALYSIS,0,random(...rolls));expect(a.paidCost).toBe(6);expect(a.mindCost).toBe(2);expect(['FAILED','RESISTED']).toContain(a.finiteResult);expect(r.playerS).toBe(x.playerSpirituality-6);expect(r.playerM).toBe(x.playerMind-2);expect(r.windows.analysis).toBeNull();
   expect(resolveCivilizationEnlightenerPlayerSlot(x,r,PROCESS_ANALYSIS,1,random())).toMatchObject({paidCost:0,finiteResult:'ALREADY_ATTEMPTED'});expect(r.mastery).toEqual(x.mastery);
  }
  const x=source(),r=createCivilizationEnlightenerRuntime(x);expect(resolveCivilizationEnlightenerPlayerSlot(x,r,OPERATIONAL_GUIDANCE,0,random(100))).toMatchObject({paidCost:8,mindCost:3,finiteResult:'FAILED'});expect(r.body.guidanceSuccesses).toBe(0);
 });
 it('applies thirty only when the same observed pending mechanism really executes, once, then awards eight',()=>{
  const x=source(),r=createCivilizationEnlightenerRuntime(x),pending=declareCivilizationEnlightenerEnemyAction(x,r,'MECHANICAL_PULSE',0);
  expect(pending).toMatchObject({mechanical:true,observationSeconds:1});expect(pending.observedAt).toBe(pending.declaredAt+1);
  const cast=resolveCivilizationEnlightenerPlayerSlot(x,r,PROCESS_ANALYSIS,0,random(1,100));expect(cast).toMatchObject({paidCost:6,mindCost:2,finiteResult:'PENDING',selfGain:0});expect(r.mastery).toEqual(x.mastery);
  const actual=resolveCivilizationEnlightenerEnemySlot(x,r,'MECHANICAL_PULSE',1,random());expect(actual).toMatchObject({paidCost:7,mechanismChargeSpent:1,rawContribution:95,selfGain:65,attackKind:'BODY',masteryApplied:[PROCESS_ANALYSIS]});expect(r.mastery[PROCESS_ANALYSIS]).toBe(x.mastery[PROCESS_ANALYSIS]!+8);expect(r.windows.analysis).toBeNull();
  expect(resolveCivilizationEnlightenerEnemySlot(x,r,'MECHANICAL_PULSE',2,random()).selfGain).toBe(95);
 });
 it('does not award empty or expired windows and never enhances resource-ineligible fallback',()=>{
  const x=source(),r=createCivilizationEnlightenerRuntime(x);resolveCivilizationEnlightenerPlayerSlot(x,r,OPERATIONAL_GUIDANCE,0,random(1));
  expect(r.mastery).toEqual(x.mastery);const fallback=resolveCivilizationEnlightenerPlayerSlot(x,r,'paragon.s4.animate-made-object',1,random());
  expect(fallback).toMatchObject({paidCost:0,frameChargeSpent:0,selectedAbility:'STRIKE',masteryApplied:[]});expect(r.windows.guidance).not.toBeNull();expect(fallback.selfGain).toBe((x.clubHeld?16:12));
  advanceCivilizationEnlightenerCombatClock(r,30);expect(r.windows.guidance).toBeNull();expect(r.mastery).toEqual(x.mastery);expect(r.playerS).toBe(x.playerSpirituality-8);
  const r2=createCivilizationEnlightenerRuntime(x);declareCivilizationEnlightenerEnemyAction(x,r2,'MECHANICAL_PULSE',0);resolveCivilizationEnlightenerPlayerSlot(x,r2,PROCESS_ANALYSIS,0,random(1,100));advanceCivilizationEnlightenerCombatClock(r2,30);
  expect(resolveCivilizationEnlightenerEnemySlot(x,r2,'MECHANICAL_PULSE',1,random()).selfGain).toBe(95);expect(r2.mastery).toEqual(x.mastery);
 });
 it('adds twenty-five once to a later actual usable original action, without a new action or old mastery grant',()=>{
  const x=source(),r=createCivilizationEnlightenerRuntime(x);resolveCivilizationEnlightenerPlayerSlot(x,r,OPERATIONAL_GUIDANCE,0,random(1));
  const focus=resolveCivilizationEnlightenerPlayerSlot(x,r,'paragon.s5.precision-focus',1,random());expect(focus.selfGain).toBe(12*(.65+.35*x.mastery['paragon.s5.precision-focus']!/500)+25);expect(focus.paidCost).toBe(2);expect(focus.masteryApplied).toEqual([OPERATIONAL_GUIDANCE]);expect(r.body.guidanceSuccesses).toBe(1);
  expect(resolveCivilizationEnlightenerPlayerSlot(x,r,'paragon.s5.precision-focus',2,random()).masteryApplied).toEqual([]);
  for(const id of CIVILIZATION_ENLIGHTENER_INHERITED_SKILL_IDS)expect(r.mastery[id]).toBe(x.mastery[id]);expect(r.creations).toEqual(x.creations);
 });
 it('pays finite enemy powers, consumes only four original mechanism charges, and distinguishes mental from body attacks',()=>{
  const x=source(),r=createCivilizationEnlightenerRuntime(x);resolveCivilizationEnlightenerEnemySlot(x,r,'ATTENTION',0,random());declareCivilizationEnlightenerEnemyAction(x,r,'MECHANICAL_PULSE',0);
  expect(resolveCivilizationEnlightenerPlayerSlot(x,r,PROCESS_ANALYSIS,1,random(1,50))).toMatchObject({resistanceChance:70,finiteResult:'RESISTED',paidCost:6});expect(r.windows.attention).toBeNull();
  resolveCivilizationEnlightenerEnemySlot(x,r,'MECHANICAL_PULSE',2,random());for(let i=0;i<3;i++)resolveCivilizationEnlightenerEnemySlot(x,r,'MECHANICAL_PULSE',3+i,random());
  expect(r.materials.mechanism.charge).toBe(0);expect(r.body.powerUses.MECHANICAL_PULSE).toBe(4);expect(resolveCivilizationEnlightenerEnemySlot(x,r,'MECHANICAL_PULSE',6,random())).toMatchObject({selectedAbility:'BODY_STRIKE',paidCost:0,mechanismChargeSpent:0,attackKind:'BODY'});
  expect(resolveCivilizationEnlightenerEnemySlot(x,r,'MIND_PRESSURE',7,random())).toMatchObject({paidCost:7,attackKind:'MENTAL',mentalPressure:true,threatens:false});expect(r.creations).toEqual(x.creations);
 });
});

describe('deterministic whole-round receipts and terminal resource continuity',()=>{
 it('replays exact actual RNG, finite costs, sources and windows, rejecting mutation and unknown fields',()=>{
  const x=source(),first=replayCivilizationEnlightenerCombatRound(x,'CONTROL');expect(validateCivilizationEnlightenerCombatRound(first.round)).toBe(true);expect(validateCivilizationEnlightenerRoundOutcome(first.round.civilizationEnlightenerOutcome)).toBe(true);expect(replayCivilizationEnlightenerCombatRound(x,'CONTROL')).toEqual(first);
  const o=first.round.civilizationEnlightenerOutcome!;expect(o.elapsedSeconds).toBe(60);expect(o.rootAfter.clockSeconds).toBe(x.root.clockSeconds+60);expect(o.windowsAfter).toEqual({analysis:null,guidance:null,attention:null,oldAnalysis:null,calibration:null});expect(o.creations.map(v=>v.charge)).toEqual([0,0]);
  for(const mutate of [(v:typeof first.round)=>{v.playerAdvantage++;},(v:typeof first.round)=>{v.civilizationEnlightenerOutcome!.playerSpiritualityAfter++;},(v:typeof first.round)=>{v.civilizationEnlightenerOutcome!.creations[1]!.durability++;},(v:typeof first.round)=>{(v.civilizationEnlightenerOutcome as unknown as Record<string,unknown>).freeCharge=true;}]){const changed=structuredClone(first.round);mutate(changed);expect(validateCivilizationEnlightenerCombatRound(changed)).toBe(false);}
 });
 it('finishes the real public encounter without resurrecting an old person or resetting the original objects',()=>{
  let s=fighting();const original=s.alchemist.life.creations.map(v=>[v.id,v.charge,v.durability]),old=s.knowledgeMentor.encounter.enemyStatus;
  for(let n=0;s.combat&&n<64;n++)s=step(s,{type:'COMBAT_ROUND',stance:n>8?'RETREAT':'CONTROL'});
  expect(s.combat).toBeNull();expect(s.civilizationEnlightener.encounter.terminal).not.toBeNull();assertValidSliceState(s);expect(validateCivilizationEnlightenerEncounter(s)).toBe(true);
  expect(s.alchemist.life.creations.map(v=>[v.id,v.charge,v.durability])).toEqual(original);expect(s.knowledgeMentor.encounter.enemyStatus).toBe(old);
  const terminal=s.civilizationEnlightener.encounter.terminal!;
  if(terminal.outcome==='PLAYER_DEAD'){expect(s.status).toBe('DEAD');expect(s.health).toBe(0);expect(terminal.exitMetres).toBe(0);expect(s.alchemist.life.creations.every(v=>v.location==='YARD')).toBe(true);}
  else{expect(terminal.exitMetres).toBe(4);expect(terminal.exitSeconds).toBe(4);expect(s.alchemist.life.creations.every(v=>v.location==='PLAYER')).toBe(true);}
 },120000);
});
