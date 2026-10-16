import { describe, expect, it } from 'vitest';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { CONCEALMENT_SERVANT_COUNT_WHEEL } from '../../src/domain/concealment-servant/combat.js';
import { MISFORTUNE_KNIGHT_CASE_IDS } from '../../src/domain/misfortune-knight/life.js';
import { validateMisfortuneKnightEncounter, validateMisfortuneKnightEncounterCommand, projectMisfortuneKnightEncounter,
  misfortuneKnightEncounterOriginalEvents, misfortuneKnightEncounterBudget, misfortuneKnightFinanceSnapshot,
  misfortuneKnightCompletedBudgetMatches, type MisfortuneKnightPolicy, type MisfortuneKnightFinanceSnapshot } from '../../src/domain/misfortune-knight/encounter.js';
import { GUIDED_MISHAP, BOUNDED_NIGHT_GUARD, MISFORTUNE_KNIGHT_INHERITED_SKILL_IDS, MISFORTUNE_KNIGHT_COMBAT_CONSTANTS,
  MISFORTUNE_KNIGHT_COUNT_WHEEL, MISFORTUNE_KNIGHT_ENEMY_COUNT_WHEEL, misfortuneKnightAbilityWheel,
  currentMisfortuneKnightCombatSource, createMisfortuneKnightRuntime, declareMisfortuneKnightEnemyAction,
  resolveMisfortuneKnightPlayerSlot, resolveMisfortuneKnightEnemySlot, advanceMisfortuneKnightCombatClock,
  replayMisfortuneKnightCombatRound, validMisfortuneKnightCombatSource, validateMisfortuneKnightCombatRound,
  validateMisfortuneKnightRoundOutcome, nextMisfortuneKnightCombatSource, type MisfortuneKnightCombatSource } from '../../src/domain/misfortune-knight/combat.js';
import { mk, promoted, originalConcealmentServant, recoverResources, rejectMisfortuneKnight, step } from './misfortune-knight-directed-helper.js';

let readyCache:SliceState|undefined;
/** Acquisition helper explicitly migrates the original living518-command branch.
 * Its directed pre-journal inputs are unit-only. All scene actions here are public. */
function ready():SliceState {
 if(!readyCache){let s=recoverResources(promoted());
  for(const caseId of MISFORTUNE_KNIGHT_CASE_IDS){
   s=mk(s,{type:'OBSERVE',caseId});s=mk(s,{type:'INVITE',caseId,method:'ORDINARY'});s=mk(s,{type:'VISIT_ROOM'});
   s=mk(s,{type:'CONSENT',permission:'OWNER'});s=mk(s,{type:'CONSENT',permission:'TECHNICIAN'});s=mk(s,{type:'DECLINE_CONSENT',permission:'SELF_POWER'});
   s=mk(s,{type:'SETUP_TOOLS'});s=mk(s,{type:'BORROW_BOX'});
   if(caseId==='withdrawn-path'){s=mk(s,{type:'BORROW_PLATE'});s=mk(s,{type:'BLOCK_DOOR'});s=mk(s,{type:'REVOKE_CONSENT',permission:'OWNER'});s=mk(s,{type:'CLEAR_DOOR'});}
   s=mk(s,{type:'ORDINARY_CARRY'});s=mk(s,{type:'RETURN_BOX'});
   if(s.misfortuneKnight.life.practice.plate.holder==='PLAYER')s=mk(s,{type:'RETURN_PLATE'});
   s=mk(s,{type:'RETURN_TOOLS'});s=mk(s,{type:'RETURN_HOME'});s=mk(s,{type:'REPORT',caseId});
  }
  readyCache=mk(s,{type:'REFLECT'});assertValidSliceState(readyCache);
 }return structuredClone(readyCache);
}
const fightingCache=new Map<string,SliceState>();
function fighting(policy:MisfortuneKnightPolicy='ALL',plate=true):SliceState {
 const key=`${policy}:${plate}`;if(!fightingCache.has(key)){let s=ready();if(plate)s=mk(s,{type:'BUY_BATTLE_PLATE'});s=mk(s,{type:'ENCOUNTER_TALK'});s=mk(s,{type:'ENCOUNTER_POLICY',policy});s=mk(s,{type:'ENCOUNTER_FIGHT'});assertValidSliceState(s);fightingCache.set(key,s);}return structuredClone(fightingCache.get(key)!);
}
function source(policy:MisfortuneKnightPolicy='ALL',plate=true):MisfortuneKnightCombatSource{const x=currentMisfortuneKnightCombatSource(fighting(policy,plate));if(!x)throw new Error('Public encounter source absent.');expect(validMisfortuneKnightCombatSource(x)).toBe(true);return x;}
/** Isolated declared slot rolls never replace a campaign random stream. */
function random(...rolls:number[]):ActionRandomStream{let cursor=0;return{seed:'declared-isolated-slot',get cursor(){return cursor;},nextInt(min,max){const n=rolls[cursor++];if(n===undefined||n<min||n>max)throw new Error(`Unexpected slot draw ${n} for ${min}..${max}`);return n;}};}
function spendTo(s:SliceState,actions:number):SliceState{for(let n=0;s.actionsRemaining>actions&&n<128;n++)s=step(s,{type:'ACTION',action:'REST'});expect(s.actionsRemaining).toBe(actions);return s;}

describe('Misfortune Knight exact old Darkness profile and independent encounter',()=>{
 it('keeps eighteen old masteries, original leaf and the original dead/surrendered people',()=>{
  const old=originalConcealmentServant(),s=ready(),x=source();expect(MISFORTUNE_KNIGHT_COUNT_WHEEL).toBe(CONCEALMENT_SERVANT_COUNT_WHEEL);expect(MISFORTUNE_KNIGHT_ENEMY_COUNT_WHEEL).toBe(CONCEALMENT_SERVANT_COUNT_WHEEL);
  expect(MISFORTUNE_KNIGHT_COUNT_WHEEL.map(a=>a.weight)).toEqual([10,15,25,25,15,10]);expect(MISFORTUNE_KNIGHT_COMBAT_CONSTANTS).toMatchObject({weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12});
  expect(MISFORTUNE_KNIGHT_INHERITED_SKILL_IDS).toHaveLength(18);for(const id of MISFORTUNE_KNIGHT_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(old.progression.mastery[id]);expect(MISFORTUNE_KNIGHT_INHERITED_SKILL_IDS.filter(id=>s.progression.mastery[id]===0)).toHaveLength(5);
  expect(x.companion).toEqual(old.spiritWarlock.companion);expect(x.companion).toMatchObject({source:'SW5-LEAF-1',status:'SEALED',acquiredWeek:45,invitedWeek:53,releases:1,deployments:12,recalls:12});
  expect(s.nightwatcher.encounter).toEqual(old.nightwatcher.encounter);expect(s.fearBishop.encounter).toEqual(old.fearBishop.encounter);expect(s.concealmentServant.encounter).toEqual(old.concealmentServant.encounter);
  expect(x).toMatchObject({targetId:'MK1-ALDEN-WARD',targetName:'奥尔登·沃德',targetAge:46,targetCore:24,thirdPartiesInArea:0,body:{enemyHealth:100,enemyMind:100,enemySpirituality:120}});
  expect(x.materials.weapon).toMatchObject({id:'MK1-ALDEN-ROD',owner:'MK1-ALDEN-WARD',charge:4});expect(x.materials.plate).toMatchObject({id:'MK1-BATTLE-WOOD-PLATE',sourceId:'MK1-BATTLE-WOOD-SHOP-1',integrity:65,location:'PLAYER'});expect(misfortuneKnightAbilityWheel(s,null).reduce((n,a)=>n+a.weight,0)).toBeCloseTo(100);
 });
 it('pays for exactly one separate plate and never resets its identity or integrity',()=>{
  let s=ready();expect(s.misfortuneKnight.encounter.materials.plate).toBeNull();const cash=s.cash,ap=s.actionsRemaining,life=structuredClone(s.misfortuneKnight.life);
  s=mk(s,{type:'BUY_BATTLE_PLATE'});expect(s.cash).toBe(cash-40);expect(s.actionsRemaining).toBe(ap-1);expect(s.misfortuneKnight.encounter.purchases).toHaveLength(1);expect(s.misfortuneKnight.life).toEqual(life);rejectMisfortuneKnight(s,{type:'BUY_BATTLE_PLATE'});
  expect(validateMisfortuneKnightEncounter(s)).toBe(true);const forged=structuredClone(s);forged.misfortuneKnight.encounter.purchases[0]!.after.cash++;expect(validateMisfortuneKnightEncounter(forged)).toBe(false);
 });
 it('requires completed real life, actual arrival and a deliberate policy',()=>{
  rejectMisfortuneKnight(promoted(),{type:'ENCOUNTER_TALK'});rejectMisfortuneKnight(ready(),{type:'ENCOUNTER_FIGHT'});
  const arrived=mk(ready(),{type:'ENCOUNTER_TALK'}),p=projectMisfortuneKnightEncounter(arrived);expect(p.policyConfirmed).toBe(false);expect(p.scene).toMatchObject({playerLocation:'YARD',playerCoordinate:4,enemyCoordinate:6,playerTravelMetres:4,clockSeconds:4,presentMemberIds:[]});rejectMisfortuneKnight(arrived,{type:'ENCOUNTER_FIGHT'});
  const selected=mk(arrived,{type:'ENCOUNTER_POLICY',policy:'INHERITED_ONLY'}),left=mk(selected,{type:'LEAVE_ENCOUNTER'});expect(left.misfortuneKnight.encounter.scene).toMatchObject({playerLocation:'OUTSIDE',playerCoordinate:0,playerTravelMetres:8,clockSeconds:8});expect(validateMisfortuneKnightEncounter(left)).toBe(true);rejectMisfortuneKnight(left,{type:'ENCOUNTER_TALK'});rejectMisfortuneKnight(fighting(),{type:'ENCOUNTER_POLICY',policy:'ORDINARY'});
  expect(JSON.stringify(p)).not.toMatch(/月片|战场灯|流灯|达莉娅|候选|\dG|（G）/);
 });
 it('rejects recycled enemies, forged original skills, leaf counts, sources and extra command fields',()=>{
  for(const c of [{type:'ENCOUNTER_POLICY',policy:'ALL',extra:true},{type:'ENCOUNTER_FIGHT',target:'CS2-OSWIN'},{type:'REPAIR_BATTLE_PLATE'}])expect(validateMisfortuneKnightEncounterCommand(c)).toBe(false);
  for(const mutate of [(x:MisfortuneKnightCombatSource)=>{(x as unknown as {targetId:string}).targetId='CS2-OSWIN';},(x:MisfortuneKnightCombatSource)=>{x.mastery['darkness.s5.spirit-assistance']=1;},(x:MisfortuneKnightCombatSource)=>{x.companion.deployments++;x.companion.recalls++;},(x:MisfortuneKnightCombatSource)=>{x.companion.releases++;},(x:MisfortuneKnightCombatSource)=>{x.root.presentMemberIds.push('CS2-ERIN');},(x:MisfortuneKnightCombatSource)=>{x.materials.plate!.integrity++;},(x:MisfortuneKnightCombatSource)=>{x.randomSeed='substituted';}]){const x=source();mutate(x);expect(validMisfortuneKnightCombatSource(x)).toBe(false);}
 });
});

describe('finite future-only guided mishap and actual wood guard',()=>{
 it('refuses empty, mental, already executed, blocked and disallowed targets without a free effect',()=>{
  const x=source(),r=createMisfortuneKnightRuntime(x);for(const id of [GUIDED_MISHAP,BOUNDED_NIGHT_GUARD])expect(resolveMisfortuneKnightPlayerSlot(x,r,id,0,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE'});
  declareMisfortuneKnightEnemyAction(x,r,'MIND_PRESSURE',0);for(const id of [GUIDED_MISHAP,BOUNDED_NIGHT_GUARD])expect(resolveMisfortuneKnightPlayerSlot(x,r,id,1,random()).paidCost).toBe(0);resolveMisfortuneKnightEnemySlot(x,r,'MIND_PRESSURE',2,random());expect(resolveMisfortuneKnightPlayerSlot(x,r,GUIDED_MISHAP,3,random()).paidCost).toBe(0);
  for(const policy of ['INHERITED_ONLY','ORDINARY'] as const){const z=source(policy),model=createMisfortuneKnightRuntime(z);declareMisfortuneKnightEnemyAction(z,model,'DARK_BOLT',0);expect(resolveMisfortuneKnightPlayerSlot(z,model,GUIDED_MISHAP,0,random()).paidCost).toBe(0);expect(resolveMisfortuneKnightPlayerSlot(z,model,BOUNDED_NIGHT_GUARD,1,random()).paidCost).toBe(0);}
  const absent=source('ALL',false),model=createMisfortuneKnightRuntime(absent);declareMisfortuneKnightEnemyAction(absent,model,'DARK_BOLT',0);expect(resolveMisfortuneKnightPlayerSlot(absent,model,BOUNDED_NIGHT_GUARD,0,random()).paidCost).toBe(0);
 });
 it('failed and resisted guidance pays six spirituality and two mind once, without skill',()=>{
  for(const rolls of [[100],[1,30]]){const x=source(),r=createMisfortuneKnightRuntime(x);declareMisfortuneKnightEnemyAction(x,r,'DARK_BOLT',0);const a=resolveMisfortuneKnightPlayerSlot(x,r,GUIDED_MISHAP,0,random(...rolls));expect(a).toMatchObject({paidCost:6,mindCost:2});expect(['FAILED','RESISTED']).toContain(a.finiteResult);expect(r.windows.guidedMishap).toBeNull();expect(r.mastery).toEqual(x.mastery);expect(resolveMisfortuneKnightPlayerSlot(x,r,GUIDED_MISHAP,1,random())).toMatchObject({paidCost:0,finiteResult:'ALREADY_ATTEMPTED'});}
 });
 it('guides only one observed future body impact and awards only when it actually applies',()=>{
  const x=source(),r=createMisfortuneKnightRuntime(x),pending=declareMisfortuneKnightEnemyAction(x,r,'DARK_BOLT',0);expect(pending.observedAt).toBe(pending.declaredAt+1);
  expect(resolveMisfortuneKnightPlayerSlot(x,r,GUIDED_MISHAP,0,random(1,100))).toMatchObject({finiteResult:'PENDING',paidCost:6,mindCost:2,selfGain:0});expect(r.mastery).toEqual(x.mastery);
  expect(resolveMisfortuneKnightEnemySlot(x,r,'DARK_BOLT',1,random())).toMatchObject({rawContribution:105,selfGain:80,attackKind:'BODY',masteryApplied:[GUIDED_MISHAP]});expect(r.windows.guidedMishap).toBeNull();expect(r.body.guidedMishapSuccesses).toBe(1);
  expect(resolveMisfortuneKnightEnemySlot(x,r,'DARK_BOLT',2,random()).selfGain).toBe(105);expect(resolveMisfortuneKnightEnemySlot(x,r,'MIND_PRESSURE',3,random())).toMatchObject({selfGain:70,attackKind:'MENTAL',mentalPressure:true,threatens:false});
 });
 it('guard checks knowledge18 and wears the same plate even when the check fails',()=>{
  const x=source(),r=createMisfortuneKnightRuntime(x);declareMisfortuneKnightEnemyAction(x,r,'DARK_BOLT',0);const a=resolveMisfortuneKnightPlayerSlot(x,r,BOUNDED_NIGHT_GUARD,0,random(100));expect(a).toMatchObject({paidCost:8,mindCost:3,plateWear:10,plateId:'MK1-BATTLE-WOOD-PLATE',finiteResult:'FAILED',check:{ability:'knowledge',difficulty:18}});
  expect(r.materials.plate!.integrity).toBe(55);expect(r.mastery).toEqual(x.mastery);expect(resolveMisfortuneKnightPlayerSlot(x,r,BOUNDED_NIGHT_GUARD,1,random()).finiteResult).toBe('ALREADY_ATTEMPTED');
 });
 it('reduces one pending body attack by thirty while mental pressure remains unchanged',()=>{
  const x=source(),r=createMisfortuneKnightRuntime(x);declareMisfortuneKnightEnemyAction(x,r,'DARK_BOLT',0);resolveMisfortuneKnightPlayerSlot(x,r,BOUNDED_NIGHT_GUARD,0,random(1));expect(r.mastery).toEqual(x.mastery);
  expect(resolveMisfortuneKnightEnemySlot(x,r,'DARK_BOLT',1,random())).toMatchObject({rawContribution:105,selfGain:75,rodChargeSpent:1,masteryApplied:[BOUNDED_NIGHT_GUARD]});expect(resolveMisfortuneKnightEnemySlot(x,r,'MIND_PRESSURE',2,random())).toMatchObject({selfGain:70,attackKind:'MENTAL'});expect(r.materials.plate!.integrity).toBe(55);
 });
 it('expired or physically blocked windows retain their cost and wear without skill',()=>{
  for(const id of [GUIDED_MISHAP,BOUNDED_NIGHT_GUARD]){const x=source(),r=createMisfortuneKnightRuntime(x);declareMisfortuneKnightEnemyAction(x,r,'DARK_BOLT',0);resolveMisfortuneKnightPlayerSlot(x,r,id,0,id===GUIDED_MISHAP?random(1,100):random(1));advanceMisfortuneKnightCombatClock(r,30);expect(resolveMisfortuneKnightEnemySlot(x,r,'DARK_BOLT',1,random()).selfGain).toBe(105);expect(r.mastery).toEqual(x.mastery);expect(r.playerS).toBe(x.playerSpirituality-(id===GUIDED_MISHAP?6:8));}
  const x=source(),r=createMisfortuneKnightRuntime(x);resolveMisfortuneKnightEnemySlot(x,r,'BLOCK_LINE',0,random());expect(r.root.floorLineClear).toBe(false);declareMisfortuneKnightEnemyAction(x,r,'DARK_BOLT',1);expect(resolveMisfortuneKnightPlayerSlot(x,r,GUIDED_MISHAP,2,random()).paidCost).toBe(0);expect(resolveMisfortuneKnightPlayerSlot(x,r,BOUNDED_NIGHT_GUARD,3,random()).paidCost).toBe(0);
  const travel=r.root.playerTravelMetres;resolveMisfortuneKnightPlayerSlot(x,r,'OBSERVE',4,random());expect(r.root.floorLineClear).toBe(true);expect(r.root.playerTravelMetres).toBe(travel+2);expect(r.materials.plate!.integrity).toBe(65);
 });
 it('combines at most those two paid reductions on the same pending attack, with no replay of an executed event',()=>{
  const x=source(),r=createMisfortuneKnightRuntime(x);declareMisfortuneKnightEnemyAction(x,r,'DARK_BOLT',0);resolveMisfortuneKnightPlayerSlot(x,r,GUIDED_MISHAP,0,random(1,100));resolveMisfortuneKnightPlayerSlot(x,r,BOUNDED_NIGHT_GUARD,1,random(1));const a=resolveMisfortuneKnightEnemySlot(x,r,'DARK_BOLT',2,random());expect(a.selfGain).toBe(50);expect(a.masteryApplied).toEqual([GUIDED_MISHAP,BOUNDED_NIGHT_GUARD]);expect(r.playerS).toBe(x.playerSpirituality-14);expect(r.playerM).toBe(x.playerMind-5);expect(r.materials.plate!.integrity).toBe(55);
 });
 it('exhausts four original rod charges then uses actual body movement, without recharge or extra rolls',()=>{
  const x=source(),r=createMisfortuneKnightRuntime(x);for(let n=0;n<4;n++)resolveMisfortuneKnightEnemySlot(x,r,'DARK_BOLT',n,random());expect(r.materials.weapon.charge).toBe(0);expect(r.body.powerUses.DARK_BOLT).toBe(4);expect(resolveMisfortuneKnightEnemySlot(x,r,'DARK_BOLT',4,random())).toMatchObject({selectedAbility:'BODY_STRIKE',paidCost:0,rodChargeSpent:0,attackKind:'BODY',travelPath:[6,4,6],travelMetres:4});expect(r.body.enemySpirituality).toBe(92);
 });
 it('uses exact original two-stage leaf assistance, and unavailable inherited conditions fall back',()=>{
  const x=source(),r=createMisfortuneKnightRuntime(x),first=resolveMisfortuneKnightPlayerSlot(x,r,'darkness.s5.spirit-assistance',0,random());expect(first).toMatchObject({paidCost:2,spiritOperation:'DEPLOY',selfGain:0,enemyReduction:0});expect(r.companion).toMatchObject({source:'SW5-LEAF-1',status:'DEPLOYED',deployments:13,recalls:12});
  expect(resolveMisfortuneKnightPlayerSlot(x,r,'darkness.s5.spirit-assistance',1,random())).toMatchObject({paidCost:2,spiritOperation:'ASSIST',enemyReduction:22});expect(r.mastery).toEqual(x.mastery);
  for(const id of ['darkness.s2.bounded-concealment','darkness.s2.trace-veil','darkness.s7.dream-entry'] as const)expect(resolveMisfortuneKnightPlayerSlot(x,r,id,2,random())).toMatchObject({paidCost:0,selectedAbility:'OBSERVE'});
  const absent=createMisfortuneKnightRuntime(x);absent.companion.status='RELEASED';expect(resolveMisfortuneKnightPlayerSlot(x,absent,'darkness.s5.spirit-assistance',0,random())).toMatchObject({paidCost:0,spiritOperation:'NONE'});expect(absent.companion.deployments).toBe(12);
 });
});

describe('deterministic complete rounds and actual terminal cleanup',()=>{
 it('replays exact random draws, resources, leaf recall, clocks and finite window effects',()=>{
  const x=source(),result=replayMisfortuneKnightCombatRound(x,'CONTROL'),o=result.round.misfortuneKnightOutcome!;expect(validateMisfortuneKnightCombatRound(result.round)).toBe(true);expect(validateMisfortuneKnightRoundOutcome(o)).toBe(true);expect(replayMisfortuneKnightCombatRound(x,'CONTROL')).toEqual(result);expect(o.elapsedSeconds).toBe(60);expect(o.rootAfter.clockSeconds).toBe(x.root.clockSeconds+60);expect(o.windowsAfter).toEqual({nightGuard:null,guidedMishap:null,attention:null});expect(o.companion.status).toBe('SEALED');expect(o.companion.deployments).toBe(o.companion.recalls);
  if(o.spiritRecall){expect(o.spiritRecall.after).toEqual(o.companion);expect(o.spiritRecall.before.status).toBe('DEPLOYED');expect(o.spiritRecall.elapsedSeconds).toBe(1);}
  for(const mutate of [(v:typeof result.round)=>{v.playerAdvantage++;},(v:typeof result.round)=>{v.misfortuneKnightOutcome!.playerSpiritualityAfter++;},(v:typeof result.round)=>{v.misfortuneKnightOutcome!.materialsAfter.plate!.integrity+=10;},(v:typeof result.round)=>{v.misfortuneKnightOutcome!.companion.recalls++;},(v:typeof result.round)=>{(v.misfortuneKnightOutcome as unknown as Record<string,unknown>).freeSpirit=true;}]){const bad=structuredClone(result.round);mutate(bad);expect(validateMisfortuneKnightCombatRound(bad)).toBe(false);}
  if(o.continuing){const next=nextMisfortuneKnightCombatSource(o);expect(next.playerSpirituality).toBe(Math.min(120,o.playerSpiritualityAfter+12));expect(next.materials.plate).toEqual(o.materialsAfter.plate);expect(next.companion).toEqual(o.companion);expect(validMisfortuneKnightCombatSource(next)).toBe(true);}
 });
 it('separates actual MENTAL consequences, bodily death and living mental exhaustion in directed round-only inputs',()=>{
  // Deliberate unit-only future inputs. No selected result enters a campaign,
  // original fixture, save capture, natural producer or promotion journal.
  const original=source('ORDINARY',false);
  const find=(kind:'MENTAL'|'DEATH'|'EXHAUSTED')=>{for(let offset=0;offset<4096;offset++){
   const x=structuredClone(original);x.randomCursor+=offset;if(kind==='EXHAUSTED')x.playerMind=1;
   const result=replayMisfortuneKnightCombatRound(x,'DEFEND');
   if(kind==='MENTAL'&&result.round.consequenceDomain==='MENTAL'||kind==='DEATH'&&result.outcome==='PLAYER_DEAD'||kind==='EXHAUSTED'&&result.round.consequenceDomain==='MENTAL'&&result.outcome==='RETREATED')return result;
  }throw new Error(`No declared ${kind} round-only input found.`);};
  const mental=find('MENTAL'),m=mental.round.misfortuneKnightOutcome!;expect(mental.round.consequenceWeights).toBeNull();expect(mental.round.consequenceRoll).toBeUndefined();expect(m.playerHealthAfter).toBe(m.source.playerHealth);expect(m.playerInjuriesAfter).toEqual(m.source.playerInjuries);expect(m.playerRiskAfter).toBe(m.source.playerRisk);expect(m.playerMindAfter).toBe(m.source.playerMind-10);expect(mental.round.winner).toBe('ENEMY');
  const death=find('DEATH');expect(death.round.consequenceDomain).toBe('BODY');expect(death.round.misfortuneKnightOutcome!.playerHealthAfter).toBe(0);expect(death.round.misfortuneKnightOutcome!.continuing).toBe(false);expect(validateMisfortuneKnightCombatRound(death.round)).toBe(true);
  const exhausted=find('EXHAUSTED'),e=exhausted.round.misfortuneKnightOutcome!;expect(e.playerMindAfter).toBe(0);expect(e.playerHealthAfter).toBeGreaterThan(0);expect(e.continuing).toBe(false);expect(validateMisfortuneKnightCombatRound(exhausted.round)).toBe(true);
 });
 it('retains six finite guard attempts across declared unit rounds, never creating a seventh usable plate',()=>{
  const x=source(),r=createMisfortuneKnightRuntime(x);
  // Explicit isolated round boundaries exercise durable material; no campaign
  // source, history or random result is claimed by this slot-level scenario.
  for(let round=0;round<6;round++){r.nightGuardAttempted=false;declareMisfortuneKnightEnemyAction(x,r,'BODY_STRIKE',round);resolveMisfortuneKnightPlayerSlot(x,r,BOUNDED_NIGHT_GUARD,round*2,random(100));resolveMisfortuneKnightEnemySlot(x,r,'BODY_STRIKE',round*2+1,random());}
  expect(r.materials.plate!.integrity).toBe(5);expect(r.body.nightGuardAttempts).toBe(6);r.nightGuardAttempted=false;declareMisfortuneKnightEnemyAction(x,r,'BODY_STRIKE',6);expect(resolveMisfortuneKnightPlayerSlot(x,r,BOUNDED_NIGHT_GUARD,12,random())).toMatchObject({paidCost:0,plateWear:0,finiteResult:'UNAVAILABLE'});expect(r.playerS).toBe(x.playerSpirituality-48);
 });
 it('peacefully exits at actual zeroAP, then pays exact ordinary weekly finance',()=>{
  let s=mk(ready(),{type:'BUY_BATTLE_PLATE'});s=spendTo(s,1);const week=s.week,cash=s.cash,finance=misfortuneKnightFinanceSnapshot(s),date=structuredClone(s.date);
  s=mk(s,{type:'ENCOUNTER_TALK'});expect(s.actionsRemaining).toBe(0);expect(s.week).toBe(week);expect(s.cash).toBe(cash);expect(s.pulse).toBe('NONE');rejectMisfortuneKnight(s,{type:'ENCOUNTER_FIGHT'});
  const inputRevision=s.revision;s=mk(s,{type:'LEAVE_ENCOUNTER'});const expected=resolveSliceWeeklyFinance({...finance,cash,week,revision:inputRevision,pulse:'BILL',billAmount:0});
  expect(expected.eventId).toBeNull();expect(s.cash).toBe(expected.state.cash);expect(s.week).toBe(week+1);expect(s.date).toEqual(addGameWeeks(date,1));expect(s.actionsRemaining).toBe(finance.weeklyBudget);expect(s.misfortuneKnight.encounter.materials.plate!.location).toBe('RETURN_TRAY');expect(validateMisfortuneKnightEncounter(s)).toBe(true);assertValidSliceState(s);
  for(const change of [(v:SliceState)=>{v.cash++;},(v:SliceState)=>{v.actionsRemaining++;},(v:SliceState)=>{v.missedWeeks++;},(v:SliceState)=>{v.debts[0]!.remaining++;},(v:SliceState)=>{v.misfortuneKnight.encounter.scene.playerTravelMetres--;},(v:SliceState)=>{const entry=v.chronicle.find(e=>e.title==='新的一周'&&e.week===v.week)!;entry.text+='伪造';}]){const bad=structuredClone(s);change(bad);expect(validateMisfortuneKnightEncounter(bad)).toBe(false);}
 });
 it('finishes an actual zeroAP fight with same people, actual wounds and real four-metre survivor exit',()=>{
  let s=mk(ready(),{type:'BUY_BATTLE_PLATE'});s=spendTo(s,2);const old=originalConcealmentServant(),life=structuredClone(s.misfortuneKnight.life),week=s.week;
  s=mk(s,{type:'ENCOUNTER_TALK'});s=mk(s,{type:'ENCOUNTER_POLICY',policy:'ALL'});s=mk(s,{type:'ENCOUNTER_FIGHT'});expect(s.actionsRemaining).toBe(0);
  for(let n=0;s.combat&&n<64;n++)s=step(s,{type:'COMBAT_ROUND',stance:n>2?'RETREAT':'CONTROL'});
  expect(s.combat).toBeNull();assertValidSliceState(s);expect(validateMisfortuneKnightEncounter(s)).toBe(true);expect(s.misfortuneKnight.life).toEqual(life);expect(s.nightwatcher.encounter).toEqual(old.nightwatcher.encounter);expect(s.fearBishop.encounter).toEqual(old.fearBishop.encounter);expect(s.concealmentServant.encounter).toEqual(old.concealmentServant.encounter);
  const e=s.misfortuneKnight.encounter,t=e.terminal!;expect(misfortuneKnightEncounterOriginalEvents(s)).toHaveLength(t.round);expect(s.spiritWarlock.companion.status).toBe('SEALED');expect(s.spiritWarlock.companion.deployments).toBe(s.spiritWarlock.companion.recalls);for(const id of MISFORTUNE_KNIGHT_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(old.progression.mastery[id]);
  if(t.outcome==='PLAYER_DEAD'){expect(s.status).toBe('DEAD');expect(s.week).toBe(week);expect(s.actionsRemaining).toBe(0);expect(t.exitMetres).toBe(0);expect(e.materials.plate!.location).toBe('YARD');}else{expect(t.exitMetres).toBe(4);expect(t.exitSeconds).toBe(4);expect(e.scene.playerLocation).toBe('OUTSIDE');expect(e.materials.plate!.location).toBe('RETURN_TRAY');expect(s.week).toBe(week+1);}
  for(const change of [(v:SliceState)=>{v.cash++;},(v:SliceState)=>{v.actionsRemaining++;},(v:SliceState)=>{v.debts[0]!.remaining++;},(v:SliceState)=>{v.misfortuneKnight.encounter.materials.plate!.integrity+=10;},(v:SliceState)=>{v.spiritWarlock.companion.deployments++;v.spiritWarlock.companion.recalls++;}]){const bad=structuredClone(s);change(bad);expect(validateMisfortuneKnightEncounter(bad)).toBe(false);}
 },120000);
});

/** Pure finance boundary fixtures, deliberately not asserted as campaign saves.
 * They exercise exact full/reduced/unpaid debt outcomes, including event IDs. */
describe('exact finance receipts, credit and debt without budget widening',()=>{
 for(const scenario of ['PAID','PARTIAL','BILL','NOTICE','SETTLE','SUSPENDED'] as const)it(`matches shared weekly-finance ${scenario} and rejects tampered payment/receipts`,()=>{
  const s=ready(),week=s.week,date=structuredClone(s.date);s.revision++;const revision=s.revision,cursor=s.random.cursor;
  const finance:MisfortuneKnightFinanceSnapshot={weeklyBudget:3,lifeTier:'DESTITUTE',nextLifeTier:'DESTITUTE',debts:[{id:'unit-old-debt',source:'Declared finance-only test',remaining:90,weeklyPayment:30,createdWeek:week-1}],missedWeeks:scenario==='NOTICE'?1:scenario==='SETTLE'?3:0,credit:scenario==='SUSPENDED'?'SUSPENDED':'NORMAL'};
  const cash=scenario==='PAID'?1000:scenario==='PARTIAL'?45:scenario==='NOTICE'||scenario==='SETTLE'?30:0,expected={...misfortuneKnightEncounterBudget(s),cash,actions:0};
  const r=resolveSliceWeeklyFinance({...finance,cash,week,revision:revision-1,pulse:'BILL',billAmount:0}),advanced=r.eventId===null&&r.state.pulse==='ADVANCE';
  Object.assign(s,{...finance,...r.state,revision,weeklyBudget:3,lifeTier:advanced?r.state.nextLifeTier:finance.lifeTier,week:week+(advanced?1:0),date:advanced?addGameWeeks(date,1):date,actionsRemaining:advanced?3:0,pulse:advanced?'NONE':r.state.pulse,billAmount:advanced?0:r.state.billAmount,activeEvent:null,eventQueue:[]});
  s.chronicle=[];const note=(w:number,title:string,text:string)=>s.chronicle.push({id:`record-${revision}-${s.chronicle.length}`,week:w,title,text});note(week,'unit-completed','unit-only completion');for(const receipt of r.receipts)note(week,receipt.title,receipt.text);
  if(advanced)note(week+1,'新的一周','日期推进7天，本周3次行动。');if(r.eventId)s.activeEvent={id:r.eventId,instanceId:`${s.runId}:${r.eventId}:${revision}:${1+r.receipts.length}`};
  expect(misfortuneKnightCompletedBudgetMatches(s,expected,finance,week,date,revision,cursor,'unit-completed')).toBe(true);
  for(const change of [(v:SliceState)=>{v.cash++;},(v:SliceState)=>{v.debts[0]!.remaining++;},(v:SliceState)=>{v.missedWeeks++;},(v:SliceState)=>{v.weeklyBudget++;},(v:SliceState)=>{v.chronicle.push({id:`record-${revision}-${v.chronicle.length}`,week,title:'本周约定还款',text:'虚构还款'});}]){const bad=structuredClone(s);change(bad);expect(misfortuneKnightCompletedBudgetMatches(bad,expected,finance,week,date,revision,cursor,'unit-completed')).toBe(false);}
 });
});
