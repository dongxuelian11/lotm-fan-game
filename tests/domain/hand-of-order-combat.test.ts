import { afterEach,describe,expect,it,vi } from 'vitest';
import { DeterministicActionRandomStream,type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createChaosHunterLifeState } from '../../src/domain/chaos-hunter/life.js';
import { HAND_OF_ORDER_ABILITY_IDS,HAND_OF_ORDER_INHERITED_ABILITY_IDS } from '../../src/domain/hand-of-order/types.js';
import type { HandOfOrderSite,HandOfOrderGuardPlate,HandOfOrderOperationState } from '../../src/domain/hand-of-order/life.js';
import { createHandOfOrderBody,createHandOfOrderSupportPieces,createHandOfOrderEncounterState,handOfOrderApproachedSite,leaveHandOfOrderCombatSite,validateHandOfOrderPreparation,validateHandOfOrderEncounterCommand,HAND_OF_ORDER_POLICIES,type HandOfOrderPreparation } from '../../src/domain/hand-of-order/encounter.js';
import { BODY,WOUND,DEPRIVATION,IMBALANCE,RESISTANCE,DIVISION,AFTERMATH,HAND_OF_ORDER_COUNT_WHEEL,HAND_OF_ORDER_ABILITY_ENTRIES,handOfOrderActionCount,handOfOrderAbilityWheel,createHandOfOrderRuntime,advanceHandOfOrderCombatClock,resolveHandOfOrderPlayerSlot,resolveHandOfOrderEnemySlot,replayHandOfOrderCombatRound,validHandOfOrderCombatSource,validateHandOfOrderCombatRound,validateHandOfOrderRoundOutcome,nextHandOfOrderCombatSource,projectHandOfOrderRoundOutcome,projectHandOfOrderCombat,type HandOfOrderCombatSource } from '../../src/domain/hand-of-order/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';

/** Declared kernel-only fixture. It is not a mutation of any natural campaign or captured draw. */
function source():HandOfOrderCombatSource{
 const original=createChaosHunterLifeState();original.introducedWeek=1;original.introducedDate={epoch:'FIFTH_EPOCH',year:1349,month:6,day:28};original.clockSeconds=767;original.playerTravelMetres=124;original.guideTravelMetres=92;original.guide.location='OUTSIDE';original.volunteer.location='OUTSIDE';original.volunteer.willing=false;original.parcel.location=original.line.location=original.paper.location='OUTSIDE';
 const site:HandOfOrderSite=structuredClone(original);site.playerLocation='OUTSIDE';site.clockSeconds+=4;site.playerTravelMetres+=4;site.volunteer.mind=97;
 const guardPlate:HandOfOrderGuardPlate={id:'BA2-GUARD-PLATE',owner:'PLAYER',holder:'PLAYER',location:'OUTSIDE',integrity:65,acquiredWeek:1};
 const originals={site:original,operation:{door:'OPEN' as const,truth:null,effect:null},guardPlate:{...guardPlate,location:'START' as const}};
 const operation:HandOfOrderOperationState={door:'OPEN',truth:null,effect:null,pending:null,division:null,aftermath:null};
 const mastery=Object.fromEntries([...HAND_OF_ORDER_INHERITED_ABILITY_IDS,...HAND_OF_ORDER_ABILITY_IDS].map(id=>[id,0]));
 const before={cash:1000,actions:100,health:100,mind:100,spirituality:120,pollution:0,gender:'FEMALE',sequence:1 as const,acting:100,coreStats:{physique:10,perception:20,will:30,knowledge:40},mastery,completedSources:[],injuries:[],injuryRisk:0};
 const date={epoch:'FIFTH_EPOCH' as const,year:1349,month:6,day:28};
 const preparation:HandOfOrderPreparation={week:1,date,revision:2,runId:'order-declared-unit',randomSeed:'order-declared-unit',randomCursor:0,pricePaid:30,mindPaid:2,actionsPaid:0,lifeJournalLength:1,lifeClockSeconds:site.clockSeconds,before,after:{...before,cash:970,mind:98},finance:{weeklyBudget:100,lifeTier:'DESTITUTE',nextLifeTier:'DESTITUTE',debts:[],missedWeeks:0,credit:'NORMAL'},site,guardPlate,operation,originals};
 return {runId:'order-declared-unit',revision:4,week:1,date,round:1,encounterId:'HAND_OF_ORDER_DISPUTE',targetId:'HO1-BRAM',attemptWeek:1,startHistoryIndex:0,targetName:'布拉姆·温特',targetAge:45,targetPathway:'original-caster',targetSequence:2,targetCore:27,targetWill:27,maxActionCount:6,actualBody:true,independentMind:true,enemyWeapon:'HO1-BRAM-ROD',weaponOwner:'HO1-BRAM',yardId:'HO1-NEIGHBOR-ANNEX',playerPosition:'ANNEX_A',enemyPosition:'ANNEX_A',enemyDistanceMetres:2,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,automaticAllyImmunity:false,freeSkillLibrary:false,playerHealth:100,playerMind:98,playerSpirituality:120,playerInjuries:[],playerRisk:0,...before.coreStats,mastery:{...mastery},clubHeld:false,guardPlate:{...guardPlate,location:'ANNEX_A'},preparation,site:handOfOrderApproachedSite(site,originals),operation:structuredClone(operation),originals:structuredClone(originals),body:{...createHandOfOrderBody(),supportPieces:createHandOfOrderSupportPieces()},budget:{...preparation.after,actions:98},finance:structuredClone(preparation.finance),policy:'ALL',randomSeed:'order-declared-unit',randomCursor:0};
}
function random(...rolls:number[]):ActionRandomStream{let cursor=0;return{seed:'declared-slot-unit',get cursor(){return cursor;},nextInt(min,max){const n=rolls[cursor++];if(n===undefined||n<min||n>max)throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`);return n;}};}
function script(rolls:number[]){let cursor=0;const original=DeterministicActionRandomStream.prototype.nextInt;return vi.spyOn(DeterministicActionRandomStream.prototype,'nextInt').mockImplementation(function(this:DeterministicActionRandomStream,min,max){original.call(this,min,max);const n=rolls[cursor++];if(n===undefined||n<min||n>max)throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`);return n;});}
afterEach(()=>vi.restoreAllMocks());
describe('Hand of Order finite original-body combat',()=>{
 it('uses the S1 count wheel and appends two slots to the exact inherited six',()=>{
  expect(HAND_OF_ORDER_COUNT_WHEEL.map(r=>r.weight)).toEqual([10,15,25,25,15,10]);expect([1,10,11,25,26,50,51,75,76,90,91,100].map(handOfOrderActionCount)).toEqual([1,1,2,2,3,3,4,4,5,5,6,6]);
  expect(HAND_OF_ORDER_ABILITY_ENTRIES.map(r=>r.weight)).toEqual([30,15,25,10,15,5,20,20]);expect(HAND_OF_ORDER_ABILITY_ENTRIES.map(r=>r.id)).toEqual([BODY,WOUND,RESISTANCE,IMBALANCE,DEPRIVATION,'ACCIDENT',DIVISION,AFTERMATH]);
  expect(validHandOfOrderCombatSource(source())).toBe(true);expect(validateHandOfOrderPreparation(source().preparation)).toBe(true);expect(source().body.enemySpirituality).toBe(100);
 });
 it('keeps Balancer actual core30/20/35/15, rather than a guessed average',()=>{
  script([1,1,426,100,500000]);const r=replayHandOfOrderCombatRound(source(),'ATTACK').round;expect(r.playerAdvantage).toBeCloseTo(1250+10*.30+20*.20+30*.35+40*.15-22.5);expect(r.enemyAdvantage).toBe(1250+27-22.5);
 });
 it('keeps exact inherited ordinary body, club, side blow and real-wound fees',()=>{
  const x=source(),r=createHandOfOrderRuntime(x);expect(resolveHandOfOrderPlayerSlot(x,r,BODY,0,random()).selfGain).toBeCloseTo(59.15*.65);expect(resolveHandOfOrderPlayerSlot(x,r,WOUND,1,random()).selfGain).toBeCloseTo(41.405*.65);
  x.clubHeld=true;expect(resolveHandOfOrderPlayerSlot(x,r,BODY,2,random()).selfGain).toBe(16);r.body.enemyInjuries.push({id:'declared-real-old-wound',severity:'LIGHT',acquiredRevision:3,treatedRevision:null});const a=resolveHandOfOrderPlayerSlot(x,r,WOUND,3,random(1));expect([a.paidCost,a.selfGain,a.attackKind]).toEqual([3,45*.65,'WOUND']);
 });
 it('charges new failed and resisted casts without granting mastery or replacing support pieces',()=>{
  const x=source(),r=createHandOfOrderRuntime(x),failed=resolveHandOfOrderPlayerSlot(x,r,DIVISION,0,random(100));expect([failed.paidCost,failed.mindCost,failed.supportWearPaid]).toEqual([8,4,1]);expect(r.body.division).toBeNull();
  const resisted=resolveHandOfOrderPlayerSlot(x,r,DIVISION,1,random(1,1));expect([resisted.resisted,resisted.resistanceChance,resisted.mindCost]).toEqual([true,62,4]);expect(r.mastery[DIVISION]).toBe(0);expect(r.body.supportPieces.filter(p=>p.status==='SPENT')).toHaveLength(2);
 });
 it('uses division only for the next real pending BODY action and awards8 on application',()=>{
  const x=source(),r=createHandOfOrderRuntime(x),cast=resolveHandOfOrderPlayerSlot(x,r,DIVISION,0,random(1,100));expect(cast.succeeded).toBe(true);expect(r.mastery[DIVISION]).toBe(0);expect(cast.windowGranted!.expiresAt-cast.windowGranted!.castAt).toBe(20);
  r.body.enemyInjuries.push({id:'real-wound',severity:'LIGHT',acquiredRevision:3,treatedRevision:null});const wound=resolveHandOfOrderPlayerSlot(x,r,WOUND,1,random(1));expect(wound.windowsApplied).toEqual([]);expect(r.body.division).not.toBeNull();
  const used=resolveHandOfOrderPlayerSlot(x,r,BODY,2,random());expect(used.selfGain-used.rawContribution).toBeCloseTo(35,10);expect(used.masteryApplied).toEqual([DIVISION]);expect(r.body.division).toBeNull();expect(r.mastery[DIVISION]).toBe(8);
 });
 it('expires division at20 seconds with no refund, refresh or free mastery',()=>{
  const x=source(),r=createHandOfOrderRuntime(x);resolveHandOfOrderPlayerSlot(x,r,DIVISION,0,random(1,100));const deadline=r.body.division!.expiresAt;expect(resolveHandOfOrderPlayerSlot(x,r,DIVISION,1,random()).paidCost).toBe(0);expect(r.body.division!.expiresAt).toBe(deadline);
  advanceHandOfOrderCombatClock(r,deadline-r.root.clockSeconds);expect(r.body.division).toBeNull();expect(r.playerS).toBe(112);expect(r.mastery[DIVISION]).toBe(0);expect(resolveHandOfOrderPlayerSlot(x,r,BODY,2,random()).selfGain).toBeCloseTo(59.15*.65);
 });
 it('retains a late20-second window across the round boundary without resetting its deadline',()=>{
  script([91,91,...Array.from({length:5},()=>[426,100]).flat(),446,1,100,100,500000]);const x=source(),result=replayHandOfOrderCombatRound(x,'ATTACK'),o=result.round.handOfOrderOutcome!;
  expect(result.outcome).toBe('CONTINUE');expect(o.division).not.toBeNull();expect(o.division!.expiresAt-o.siteAfter.clockSeconds).toBe(10);expect(o.masteryAfter[DIVISION]).toBe(0);
  const next=nextHandOfOrderCombatSource(o);expect(validHandOfOrderCombatSource(next)).toBe(true);const expired=createHandOfOrderRuntime(next);advanceHandOfOrderCombatClock(expired,10);expect(expired.body.division).toBeNull();expect(resolveHandOfOrderPlayerSlot(next,expired,BODY,0,random()).selfGain).toBeCloseTo(59.15*.65);expect(expired.mastery[DIVISION]).toBe(0);const r=createHandOfOrderRuntime(next),used=resolveHandOfOrderPlayerSlot(next,r,BODY,0,random());expect(used.selfGain-used.rawContribution).toBeCloseTo(35,10);expect(r.body.division).toBeNull();
 });
 it('allows ordinary combat exit without a success roll, enemy pursuit or supernatural resources',()=>{
  const x=source();x.playerSpirituality=0;x.budget.spirituality=0;const result=replayHandOfOrderCombatRound(x,'RETREAT'),o=result.round.handOfOrderOutcome!;expect(result.outcome).toBe('RETREATED');expect(o.elapsedSeconds).toBe(0);expect(o.siteAfter.clockSeconds).toBe(x.site.clockSeconds);expect(o.playerActions).toEqual([]);expect(o.enemyActions).toEqual([]);expect(o.randomCursorAfter-x.randomCursor).toBe(2);const site=structuredClone(o.siteAfter);leaveHandOfOrderCombatSite(site);expect(site.playerLocation).toBe('OUTSIDE');expect(site.clockSeconds-x.site.clockSeconds).toBe(4);
 });
 it('spends exactly three physical supports and then blocks before drawing or paying',()=>{
  const x=source(),r=createHandOfOrderRuntime(x);for(let i=0;i<3;i++)resolveHandOfOrderPlayerSlot(x,r,DIVISION,i,random(100));const a=resolveHandOfOrderPlayerSlot(x,r,DIVISION,3,random());expect([a.paidCost,a.mindCost,a.supportId]).toEqual([0,0,null]);expect(r.body.supportPieces.map(p=>p.id)).toEqual(['HO1-COMBAT-SUPPORT-1','HO1-COMBAT-SUPPORT-2','HO1-COMBAT-SUPPORT-3']);expect(r.playerS).toBe(96);
 });
 it('aftermath applies to actual ARC, wears the original plate15 and never blocks MIND',()=>{
  const x=source(),r=createHandOfOrderRuntime(x);resolveHandOfOrderPlayerSlot(x,r,AFTERMATH,0,random(1,100));expect(r.guardPlate.integrity).toBe(65);expect(r.mastery[AFTERMATH]).toBe(0);
  const mind=resolveHandOfOrderEnemySlot(x,r,'MENTAL_PRESSURE',1,random());expect([mind.selfGain,mind.attackKind,mind.plateWear]).toEqual([45,'MIND',0]);expect(r.body.aftermath).not.toBeNull();
  const arc=resolveHandOfOrderEnemySlot(x,r,'ARC_BOLT',2,random());expect([arc.selfGain,arc.rawContribution,arc.plateWear,r.guardPlate.integrity]).toEqual([40,70,15,50]);expect(arc.masteryApplied).toEqual([AFTERMATH]);expect(r.body.aftermath).toBeNull();
 });
 it('preserves S2 resistance and shares one original plate across both abilities',()=>{
  const x=source(),r=createHandOfOrderRuntime(x);resolveHandOfOrderPlayerSlot(x,r,RESISTANCE,0,random(1));resolveHandOfOrderPlayerSlot(x,r,AFTERMATH,1,random(1,100));
  const body=resolveHandOfOrderEnemySlot(x,r,'BODY_STRIKE',2,random());expect([body.selfGain,body.plateWear,r.guardPlate.integrity]).toEqual([0,15,50]);expect(body.masteryApplied).toEqual([RESISTANCE]);expect(r.body.aftermath).not.toBeNull();
  const arc=resolveHandOfOrderEnemySlot(x,r,'ARC_BOLT',3,random());expect([arc.selfGain,arc.plateWear,r.guardPlate.integrity]).toEqual([40,15,35]);expect(arc.masteryApplied).toEqual([AFTERMATH]);expect(x.originals.guardPlate.integrity).toBe(65);expect(x.guardPlate.integrity).toBe(65);
 });
 it('blocks aftermath with plate0 or14 before payment while ordinary movement remains available',()=>{
  for(const integrity of [0,14]){const x=source(),r=createHandOfOrderRuntime(x);r.guardPlate.integrity=integrity;const a=resolveHandOfOrderPlayerSlot(x,r,AFTERMATH,0,random());expect([a.paidCost,a.mindCost,a.supportId]).toEqual([0,0,null]);expect(r.body.supportPieces.every(p=>p.status==='HELD')).toBe(true);leaveHandOfOrderCombatSite(r.root);expect(r.root.playerLocation).toBe('OUTSIDE');}
 });
 it('retains inherited sensing conditions, finite window and actual application',()=>{
  const x=source(),r=createHandOfOrderRuntime(x);expect(resolveHandOfOrderPlayerSlot(x,r,IMBALANCE,0,random()).paidCost).toBe(0);resolveHandOfOrderEnemySlot(x,r,'BODY_STRIKE',1,random());const cast=resolveHandOfOrderPlayerSlot(x,r,IMBALANCE,2,random(1));expect(cast.paidCost).toBe(5);expect(r.mastery[IMBALANCE]).toBe(0);const a=resolveHandOfOrderPlayerSlot(x,r,BODY,3,random());expect(a.selfGain-a.rawContribution).toBe(25);expect(a.masteryApplied).toEqual([IMBALANCE]);
 });
 it('lets independent COMPOSE cancel unused windows and still charges attempted resistance',()=>{
  const x=source(),r=createHandOfOrderRuntime(x);resolveHandOfOrderPlayerSlot(x,r,DIVISION,0,random(1,100));const compose=resolveHandOfOrderEnemySlot(x,r,'COMPOSE',1,random());expect(compose.paidCost).toBe(4);expect(compose.windowsCancelled).toHaveLength(1);expect(r.body.division).toBeNull();expect(r.mastery[DIVISION]).toBe(0);const a=resolveHandOfOrderPlayerSlot(x,r,AFTERMATH,2,random(1,100));expect([a.resisted,a.paidCost,a.mindCost]).toEqual([true,8,4]);
 });
 it('charges only three actual offensive pieces and preserves same-slot ordinary fallback',()=>{
  const x=source(),r=createHandOfOrderRuntime(x);for(let i=0;i<3;i++)expect(resolveHandOfOrderEnemySlot(x,r,'ARC_BOLT',i,random()).enemyChargeId).toBe(`HO1-BRAM-CHARGE-${i+1}`);const a=resolveHandOfOrderEnemySlot(x,r,'ARC_BOLT',3,random());expect([a.selectedAbility,a.paidCost,a.selfGain,a.fallbackReason]).toEqual(['BODY_STRIKE',0,20,'NO_ACTUAL_ENEMY_CHARGE']);expect(r.body.enemySpirituality).toBe(85);expect(r.body.enemyTravelMetres).toBe(4);
 });
 it('keeps inherited deprivation at4 and does not waste a charged piece on its fallback',()=>{
  const x=source(),r=createHandOfOrderRuntime(x);expect(resolveHandOfOrderPlayerSlot(x,r,DEPRIVATION,0,random(1)).paidCost).toBe(4);const a=resolveHandOfOrderEnemySlot(x,r,'ARC_BOLT',1,random());expect([a.paidCost,a.enemyChargeId,a.selectedAbility]).toEqual([0,null,'BODY_STRIKE']);expect(r.body.enemyCharges.every(p=>p.status==='HELD')).toBe(true);
 });
 it('exposes only implemented policies, aligns their wheels, and spends no power under ORDINARY',()=>{
  expect(HAND_OF_ORDER_POLICIES).toEqual(['ALL','DIVISION','AFTERMATH','ORDINARY']);expect(validateHandOfOrderEncounterCommand({type:'SET_COMBAT_POLICY',policy:'INHERITED_ONLY'})).toBe(false);
  for(const policy of HAND_OF_ORDER_POLICIES){const s={handOfOrder:{encounter:{policy}}} as SliceState,ids=handOfOrderAbilityWheel(s,null).map(a=>a.id);expect(ids.includes(DIVISION)).toBe(policy==='ALL'||policy==='DIVISION');expect(ids.includes(AFTERMATH)).toBe(policy==='ALL'||policy==='AFTERMATH');}
  const x=source();x.policy='ORDINARY';const r=createHandOfOrderRuntime(x);for(const id of [BODY,WOUND,RESISTANCE,IMBALANCE,DEPRIVATION] as const)expect(resolveHandOfOrderPlayerSlot(x,r,id,0,random()).paidCost).toBe(0);expect(r.playerS).toBe(120);expect(r.guardPlate.integrity).toBe(65);
 });
 it('replays the exact full source and rejects tampering while preserving originals',()=>{
  const x=source(),originals=structuredClone(x.originals),r=replayHandOfOrderCombatRound(x,'CONTROL');expect(validateHandOfOrderCombatRound(r.round)).toBe(true);expect(validateHandOfOrderRoundOutcome(r.round.handOfOrderOutcome)).toBe(true);expect(x.originals).toEqual(originals);expect(r.round.handOfOrderOutcome!.siteAfter.volunteer.mind).toBe(97);
  const changed=structuredClone(r.round);changed.handOfOrderOutcome!.guardPlateAfter.integrity=65-changed.handOfOrderOutcome!.guardPlateAfter.integrity;expect(validateHandOfOrderCombatRound(changed)).toBe(false);
  const bad=structuredClone(x);bad.site.volunteer.location='ANNEX_A';expect(validHandOfOrderCombatSource(bad)).toBe(false);const reset=structuredClone(x);reset.body.enemySpirituality=120;expect(validHandOfOrderCombatSource(reset)).toBe(false);
  if(r.outcome==='CONTINUE'){const next=nextHandOfOrderCombatSource(r.round.handOfOrderOutcome!);expect(validHandOfOrderCombatSource(next)).toBe(true);expect(next.guardPlate).toEqual(r.round.handOfOrderOutcome!.guardPlateAfter);expect(next.originals).toEqual(originals);}
 });
 it('projects nested positive allowlists without erasing legitimate modifier.source labels',()=>{
  const x=source(),r=replayHandOfOrderCombatRound(x,'CONTROL'),o=r.round.handOfOrderOutcome!,a=o.playerActions[0]!;
  a.check={ability:'knowledge',baseAbility:40,modifiers:[{source:'实际原学习修正',value:2}],effectiveAbility:42,difficulty:18,chance:74,roll:1,tier:'SUCCESS'};
  Object.assign(o,{seed:'private',cursor:123,preparationRoll:88});Object.assign(o.siteAfter.guide,{seed:'nested'});Object.assign(o.siteAfter.cases,{privateSource:{seed:'history'}});Object.assign(a.check.modifiers[0]!,{randomSeed:'nested-modifier'});Object.assign(a,{preparationRoll:99});
  const projected=projectHandOfOrderRoundOutcome(o),text=JSON.stringify(projected);for(const key of ['randomSeed','randomCursor','randomCursorBefore','randomCursorAfter','preparationRoll','"source":{','"seed"','"cursor"','privateSource'])expect(text).not.toContain(key);expect(projected.playerActions[0]!.check!.modifiers).toEqual([{source:'实际原学习修正',value:2}]);expect(projected.siteAfter).not.toHaveProperty('cases');expect(projected.operationAfter).toEqual({door:'OPEN'});expect(projected.operationAfter).not.toHaveProperty('pending');expect(o.operationAfter).toHaveProperty('pending',null);expect(o.source.randomSeed).toBe('order-declared-unit');
  const state={handOfOrder:{encounter:{...createHandOfOrderEncounterState(),...o,terminal:{historyIndex:0}},life:{site:o.siteAfter,guardPlate:o.guardPlateAfter}},progression:{pathwayId:'justiciar',sequence:1},combat:null,combatHistory:[r.round]} as unknown as SliceState;
  const combat=projectHandOfOrderCombat(state);expect(JSON.stringify(combat)).not.toContain('preparationRoll');expect(combat.lastActionSequence[0]!.check!.modifiers[0]!.source).toBe('实际原学习修正');
 });
});
