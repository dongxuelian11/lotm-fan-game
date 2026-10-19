import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { resolveDarkAngelCombatRound } from '../../src/domain/slice/dark-angel-combat.js';
import { DARK_ANGEL_COUNT_WHEEL, DARK_ANGEL_ENEMY_COUNT_WHEEL, DARK_ANGEL_ENEMY_ABILITY_WHEEL, GUIDANCE, SHELTER,
  darkAngelAbilityWheel, darkAngelActionCount, darkAngelEnemyActionCount, currentDarkAngelCombatSource, replayDarkAngelCombatRound,
  validDarkAngelCombatSource, validateDarkAngelCombatRound, validateDarkAngelRoundOutcome, type DarkAngelRoundOutcome } from '../../src/domain/dark-angel/combat.js';
import { DARK_ANGEL_POLICIES, projectDarkAngelEncounter, validateDarkAngelEncounter, type DarkAngelPolicy } from '../../src/domain/dark-angel/encounter.js';
import { DARK_ANGEL_CASE_IDS } from '../../src/domain/dark-angel/life.js';
import { da, directedInitial2, prepareBottle, dose, ready, originalElder, oldHangedManRoots, rejectDarkAngel } from './dark-angel-directed-helper.js';

let practicedCache:SliceState|undefined;
/** The only directed choice occurs before any new journal. Actual clinic,
 * recovery, promotion and practice use public commands and three AP per week.
 * Combat never reseeds, searches, or tops up resources. */
function practiced():SliceState {
 if(!practicedCache){
  const initial=directedInitial2('SUCCESS');initial.actionsRemaining=initial.weeklyBudget=3;
  let s=da(prepareBottle(initial,dose.bottleId),dose);expect(s.progression.sequence).toBe(1);
  for(const caseId of DARK_ANGEL_CASE_IDS){
   s=ready(s,{ap:3,cash:20,mind:50});
   s=da(s,{type:'OBSERVE',caseId});s=da(s,{type:'CONSENT',caseId,permission:'OWNER'});s=da(s,{type:'PREPARE',caseId,method:'ORDINARY'});
   for(const type of ['WALK_TO_A','TAKE_CARD','WALK_TO_B','READ_ORIGINAL'] as const)s=da(s,{type,caseId});
   if(caseId==='guarded-pulse')s=da(s,{type:'PERFORM_OPERATION',caseId});
   for(const type of ['STOP_METHOD','RETURN_TO_A','RETURN_CARD','RETURN_TO_ENTRY','RETURN_STRIP','LEAVE','REPORT'] as const)s=da(s,{type,caseId});
  }
  s=da(ready(s),{type:'REFLECT'});assertValidSliceState(s);practicedCache=s;
 }
 return structuredClone(practicedCache);
}
function start(policy:DarkAngelPolicy='ALL',selected:'THT3-HELENA'|'THT3-ROLAND'|null='THT3-ROLAND',zeroAP=false):SliceState {
 let s=ready(practiced(),{ap:2,cash:30,health:100,mind:100,spirituality:120,healed:true});
 if(zeroAP)while(s.actionsRemaining>2)s=applySliceIntent(s,{type:'ACTION',action:'REST'});
 s=da(s,{type:'PREPARE_ENCOUNTER'});s=da(s,{type:'ENCOUNTER_TALK'});
 if(selected)s=da(s,{type:'SET_COMBAT_SPIRIT',spiritId:selected});
 if(policy!=='ALL')s=da(s,{type:'SET_COMBAT_POLICY',policy});
 s=da(s,{type:'ENCOUNTER_FIGHT'});assertValidSliceState(s);return s;
}
function costEvidence(o:DarkAngelRoundOutcome):void {
 const actions=[...o.playerActions,...o.enemyActions].sort((a,b)=>a.order-b.order);
 expect(actions.map(a=>a.order)).toEqual(actions.map((_a,i)=>i));
 expect(actions.every(a=>a.elapsedSeconds===5&&a.atSeconds===o.source.clockSeconds+5*a.order)).toBe(true);
 expect(o.clockSecondsAfter).toBe(o.source.clockSeconds+60);
 expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality-o.playerActions.reduce((n,a)=>n+a.paidCost,0));
 expect(o.enemySpirituality).toBe(o.source.enemySpirituality-o.enemyActions.reduce((n,a)=>n+a.paidCost,0));
 expect(o.reserveAfter.points).toBe(o.source.reserve.points-o.playerActions.reduce((n,a)=>n+a.reserveCost,0));
 expect(o.grazingAfter).toEqual(o.source.grazing);expect(o.operationAfter).toEqual(o.source.operation);
 expect(o.noteAfter.charges).toBe(o.source.note.charges-actions.reduce((n,a)=>n+a.noteChargePaid,0));
 expect(o.noteAfter.wear).toBe(o.source.note.wear+actions.reduce((n,a)=>n+a.noteWearPaid,0));
 for(const id of ['THT3-HELENA','THT3-ROLAND'] as const){
  const spent=o.playerActions.filter(a=>a.spirit?.id===id).length*3;
  expect(o.siteAfter.spirits[id]).toEqual({...o.source.site.spirits[id],spirituality:o.source.site.spirits[id].spirituality-spent});
 }
 for(const a of o.playerActions.filter(a=>a.id===GUIDANCE||a.id===SHELTER)){
  expect(a.paidCost).toBe(a.attempted?8:0);expect(a.mindCost).toBe(a.attempted?a.succeeded?2:4:0);
  expect(a.rolls).toHaveLength(a.attempted?1:0);
  if(a.attempted){expect(a.spirit?.id).toBe(o.source.selectedSpiritId);expect(a.spirit?.spiritCost).toBe(3);expect(a.spirit?.spiritualityBefore).toBe(a.spirit!.spiritualityAfter+3);}
  else expect(a.spirit).toBeNull();
  if(a.applied){const trigger=actions.find(v=>v.order===a.chargeConsumedByOrder)!;expect(a.succeeded).toBe(true);expect(trigger.atSeconds).toBeLessThan(a.expiresAt!);expect(trigger.conditionVersion).toBe(a.conditionVersion);expect(a.appliedAmount).toBeGreaterThan(0);expect(a.appliedAmount).toBeLessThanOrEqual(a.id===GUIDANCE?35:30);expect(trigger.noteChargePaid).toBe(1);expect(a.masteryApplied).toEqual([a.id]);}
  else expect(a.masteryApplied).toEqual([]);
 }
 for(const [id,value] of Object.entries(o.source.inheritedMastery))expect(o.masteryAfter[id]).toBe(value);
 for(const id of [GUIDANCE,SHELTER])expect(o.masteryAfter[id]).toBe(Math.min(500,o.source.mastery[id]!+8*o.playerActions.filter(a=>a.masteryApplied.includes(id)).length));
 for(const a of o.enemyActions.filter(a=>a.actual==='ARC_BOLT'||a.actual==='DREAD_MARK')){
  expect(a.paidCost).toBe(7);expect(a.receipt).toMatchObject({targetId:'DA1-EDGAR',paidCost:7,atSeconds:a.atSeconds});
  expect(o.marksAfter.find(m=>m.id===a.markId)).toMatchObject({status:'SPENT',usedRound:o.round,usedOrder:a.order});
  expect(a.threatens).toBe(a.attackKind==='BODY'&&a.selfGain>0);expect(a.mentalPressure).toBe(a.attackKind==='MENTAL'&&a.selfGain>0);
 }
}

describe('Dark Angel exact original-spirit combat',()=>{
 it('uses current migrated format and retains the real eight-root Elder source',()=>{
  const source=originalElder(),s=practiced();expect(source.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);expect(source.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(source));expect(s.character.gender).toBe('FEMALE');expect(s.darkAngel.life.site.playerLocation).toBe('START');
  expect(s.darkAngel.encounter.grazing).toEqual(source.shepherd.grazing);expect(s.darkAngel.encounter.reserve).toEqual(source.roseBishop.reserve);
  expect(s.progression.mastery['hanged-man.s6.flesh-shaping']).toBe(0);expect(s.progression.mastery['hanged-man.s5.borrowed-arts']).toBe(0);
 },30_000);
 it('retains eight Elder relative slots140 plus two20, exact1..6 counts and the actual enemy wheel',()=>{
  const s=start(),wheel=darkAngelAbilityWheel(s,null),weights=[30,15,20,20,10,5,20,20,20,20];
  expect(wheel).toHaveLength(10);wheel.forEach((row,i)=>expect(row.weight).toBeCloseTo(weights[i]!/180*100));
  expect(wheel.map(a=>a.id)).not.toContain('hermit.s6.scrollcraft');expect(DARK_ANGEL_COUNT_WHEEL).toEqual(DARK_ANGEL_ENEMY_COUNT_WHEEL);
  const counts=Array.from({length:100},(_,i)=>darkAngelActionCount(i+1));expect([1,2,3,4,5,6].map(n=>counts.filter(v=>v===n).length)).toEqual([10,15,25,25,15,10]);
  expect(counts).toEqual(Array.from({length:100},(_,i)=>darkAngelEnemyActionCount(i+1)));
  expect(projectDarkAngelEncounter(s).enemyAbilityWheel).toEqual(DARK_ANGEL_ENEMY_ABILITY_WHEEL);
  expect(DARK_ANGEL_POLICIES).toEqual(['INHERITED_ONLY','GUIDANCE','SHELTER','ALL','ORDINARY']);
 });
 it('prepares once, physically walks4m, selects exactly one existing spirit and never resets an old enemy',()=>{
  const s=start();expect(s.darkAngel.encounter.currentSite!.playerTravelMetres).toBe(s.darkAngel.life.site.playerTravelMetres+4);
  expect(s.darkAngel.encounter.selectedSpiritId).toBe('THT3-ROLAND');expect(s.darkAngel.encounter.note).toMatchObject({id:'DA1-COMBAT-SEAL-STRIP',charges:3,paidPennies:30});
  expect(s.darkAngel.encounter.targetId).toBe('DA1-EDGAR');expect(s.elder.encounter).toEqual(originalElder().elder.encounter);
  rejectDarkAngel(s,{type:'PREPARE_ENCOUNTER'});rejectDarkAngel(s,{type:'SET_COMBAT_SPIRIT',spiritId:'SH5-CEDRIC-1'});
 });
 it('purely replays ordered RNG, actual costs, spirit ledger and real body/mental consequences',()=>{
  const s=start(),snapshot=structuredClone(s),source=currentDarkAngelCombatSource(s)!;expect(validDarkAngelCombatSource(source)).toBe(true);
  const result=replayDarkAngelCombatRound(source,'CONTROL'),again=replayDarkAngelCombatRound(source,'CONTROL');expect(result).toEqual(again);expect(s).toEqual(snapshot);
  const o=result.round.darkAngelOutcome!;costEvidence(o);expect(validateDarkAngelCombatRound(result.round)).toBe(true);expect(validateDarkAngelRoundOutcome(o)).toBe(true);
  const actual=resolveDarkAngelCombatRound(s,'CONTROL');expect(actual).toEqual(result);expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(snapshot));
  expect(s.darkAngel.encounter.currentSite).toEqual(o.siteAfter);expect(s.darkAngel.encounter.reserve).toEqual(o.reserveAfter);
 });
 it('rejects altered receipts, RNG, mark costs, source identity, mastery and unearned spirit refill',()=>{
  const result=replayDarkAngelCombatRound(currentDarkAngelCombatSource(start())!,'CONTROL').round;
  const bad=(mutate:(r:SliceCombatRound)=>void)=>{const copy=structuredClone(result);mutate(copy);expect(validateDarkAngelCombatRound(copy)).toBe(false);};
  bad(r=>r.darkAngelOutcome!.randomCursorAfter++);bad(r=>r.darkAngelOutcome!.siteAfter.spirits['THT3-ROLAND'].spirituality++);
  bad(r=>r.darkAngelOutcome!.noteAfter.charges++);bad(r=>r.darkAngelOutcome!.masteryAfter[GUIDANCE]!++);bad(r=>r.darkAngelOutcome!.source.targetAge=46 as 45);
  bad(r=>r.darkAngelOutcome!.enemySpirituality++);bad(r=>r.darkAngelOutcome!.playerSpiritualityAfter++);bad(r=>r.moves.push({actor:'PLAYER',label:'伪造',selfGain:0,enemyReduction:0}));
 });
 it('unselected original spirit gives ordinary fallback without charge, mastery or replacement',()=>{
  const s=start('ALL',null),o=replayDarkAngelCombatRound(currentDarkAngelCombatSource(s)!,'CONTROL').round.darkAngelOutcome!;
  for(const a of o.playerActions.filter(a=>a.id===GUIDANCE||a.id===SHELTER))expect(a).toMatchObject({attempted:false,paidCost:0,mindCost:0,spirit:null,masteryApplied:[]});
  expect(o.masteryAfter[GUIDANCE]).toBe(o.source.mastery[GUIDANCE]);expect(o.masteryAfter[SHELTER]).toBe(o.source.mastery[SHELTER]);
 });
 it('ordinary policy never spends supernatural player or original spirit resources',()=>{
  const s=start('ORDINARY'),o=replayDarkAngelCombatRound(currentDarkAngelCombatSource(s)!,'ATTACK').round.darkAngelOutcome!;
  expect(o.playerActions.every(a=>a.paidCost===0&&a.mindCost===0&&a.spirit===null&&a.reserveCost===0)).toBe(true);
  expect(o.siteAfter.spirits).toEqual(o.source.site.spirits);expect(o.reserveAfter).toEqual(o.source.reserve);expect(o.noteAfter).toEqual(o.source.note);
 });
 it('fixed ALL+CONTROL reaches a real terminal with0AP finance and old roots intact',()=>{
  let s=start('ALL','THT3-ROLAND',true);const roots=oldHangedManRoots(s),startWeek=s.week,prep=s.darkAngel.encounter.preparation!;expect(s.actionsRemaining).toBe(0);
  for(let round=0;round<90&&s.combat;round++)s=applySliceIntent(s,{type:'COMBAT_ROUND',stance:'CONTROL'});
  expect(s.combat).toBeNull();expect(s.darkAngel.encounter.terminal).not.toBeNull();expect(validateDarkAngelEncounter(s)).toBe(true);assertValidSliceState(s);
  expect(oldHangedManRoots(s)).toEqual(roots);const terminal=s.darkAngel.encounter.terminal!;
  expect(s.darkAngel.encounter.currentSite!.playerLocation).toBe(terminal.outcome==='PLAYER_DEAD'?'YARD':'START');
  if(s.status==='ACTIVE'){expect(s.week).toBe(startWeek+1);expect(s.actionsRemaining).toBe(prep.finance.weeklyBudget);}else expect(s.week).toBe(startWeek);
  expect(s.elder.encounter.status).toBe('RETREATED');expect(s.elder.encounter.enemyHealth).toBe(100);
 });
});
