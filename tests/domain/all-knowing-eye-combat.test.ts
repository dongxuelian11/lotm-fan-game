import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { resolveAllKnowingEyeCombatRound } from '../../src/domain/slice/all-knowing-eye-combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { WISDOM_ANGEL_COUNT_WHEEL } from '../../src/domain/wisdom-angel/combat.js';
import { createAllKnowingEyeLifeState } from '../../src/domain/all-knowing-eye/life.js';
import { createAllKnowingEyeEncounterState, applyAllKnowingEyeEncounterCommand, validateAllKnowingEyeEncounter,
  validateAllKnowingEyeEncounterCommand, projectAllKnowingEyeEncounter, settleAllKnowingEyeEncounter,
  allKnowingEyeEncounterOriginalEvents, allKnowingEyeCompletedBudgetMatches, allKnowingEyeEncounterBudget,
  allKnowingEyeFinanceSnapshot, blockAllKnowingEyeEncounter, type AllKnowingEyeEncounterCommand, type AllKnowingEyePolicy } from '../../src/domain/all-knowing-eye/encounter.js';
import { BOUNDED_INSIGHT, PENDING_FORECAST, ALL_KNOWING_EYE_INHERITED_SKILL_IDS, ALL_KNOWING_EYE_NEW_ABILITY_IDS,
  ALL_KNOWING_EYE_COUNT_WHEEL, ALL_KNOWING_EYE_ENEMY_COUNT_WHEEL, ALL_KNOWING_EYE_ENEMY_ABILITY_WHEEL, ALL_KNOWING_EYE_COMBAT_CONSTANTS,
  allKnowingEyeActionCount, allKnowingEyeAbilityWheel, drawAllKnowingEyeEnemyAbility, currentAllKnowingEyeCombatSource,
  createAllKnowingEyeRuntime, declareAllKnowingEyeEnemyAction, resolveAllKnowingEyePlayerSlot, resolveAllKnowingEyeEnemySlot,
  advanceAllKnowingEyeCombatClock, resolveAllKnowingEyeConsequences, replayAllKnowingEyeCombatRound,
  validAllKnowingEyeCombatSource, validateAllKnowingEyeCombatRound, validateAllKnowingEyeRoundOutcome,
  nextAllKnowingEyeCombatSource, type AllKnowingEyeCombatSource } from '../../src/domain/all-knowing-eye/combat.js';

const path='tests/fixtures/wisdom-angel-v01700/original-enemy-approach.json';
/** Explicit migration of every historical fixture. Raw hash/schema assertions
 * are kept out of these current-domain tests. No historic capture is modified. */
function original():SliceState{return migrateSliceState(readObjectEntry<SliceState>(path,'beforeLast'));}
function context(s:SliceState):SeerContext{return{roll(){throw new Error('Encounter commands must not draw.');},check(){throw new Error('Encounter commands must not check.');},note(title,text){s.chronicle.push({id:`record-${s.revision+1}-${s.chronicle.length}`,week:s.week,title,text});}};}
/** Isolated combat-unit input, not acquisition evidence or a campaign capture.
 * Keeps all nineteen old masteries, actual old originals and original RNG. */
function readyUnit():SliceState {
 const s=original();s.progression.sequence=1;s.allKnowingEye.promotionWeek=s.week;
 for(const id of ALL_KNOWING_EYE_NEW_ABILITY_IDS)s.progression.mastery[id]=0;
 s.allKnowingEye.life=createAllKnowingEyeLifeState();s.allKnowingEye.life.reflected=true;
 s.allKnowingEye.encounter=createAllKnowingEyeEncounterState();return s;
}
function encounter(s:SliceState,c:AllKnowingEyeEncounterCommand):SliceState{applyAllKnowingEyeEncounterCommand(s,c,context(s));s.revision++;return s;}
function fighting(policy:AllKnowingEyePolicy='ALL'):SliceState {
 const s=readyUnit();encounter(s,{type:'ENCOUNTER_TALK'});encounter(s,{type:'ENCOUNTER_POLICY',policy});encounter(s,{type:'ENCOUNTER_FIGHT'});
 expect(validateAllKnowingEyeEncounter(s)).toBe(true);return s;
}
function source(policy:AllKnowingEyePolicy='ALL'):AllKnowingEyeCombatSource{const x=currentAllKnowingEyeCombatSource(fighting(policy));if(!x)throw new Error('Missing unit encounter source.');expect(validAllKnowingEyeCombatSource(x)).toBe(true);return x;}
/** Explicit, isolated slot draws. Never substituted into a campaign or fixture. */
function random(...values:number[]):ActionRandomStream{let cursor=0;return{seed:'declared-isolated-slot',get cursor(){return cursor;},nextInt(min,max){const n=values[cursor++];if(n===undefined||n<min||n>max)throw new Error(`Unexpected isolated draw ${n} for ${min}..${max}`);return n;}};}
function tickRound(s:SliceState,stance:'ATTACK'|'RETREAT'='ATTACK'){
 const result=resolveAllKnowingEyeCombatRound(s,stance);s.combatHistory.push(result.round);
 if(result.outcome!=='CONTINUE'){settleAllKnowingEyeEncounter(s,result.outcome,context(s));if(result.outcome==='PLAYER_DEAD')s.status='DEAD';}
 s.revision++;return result;
}

describe('All-Knowing Eye exact independent source',()=>{
 it('retains actual nineteen mastery values and old deaths without reviving the natural ending',()=>{
  const old=original(),s=readyUnit(),x=source();expect(old).toMatchObject({revision:538,week:125,status:'ACTIVE',health:100,mind:100,spirituality:120,cash:410,actionsRemaining:3,random:{seed:'reader-natural-v023',cursor:180}});
  expect(ALL_KNOWING_EYE_INHERITED_SKILL_IDS).toHaveLength(19);for(const id of ALL_KNOWING_EYE_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(old.progression.mastery[id]);expect(ALL_KNOWING_EYE_INHERITED_SKILL_IDS.filter(id=>s.progression.mastery[id]===0)).toHaveLength(5);
  expect(x.crafts.map(c=>[c.id,c.status])).toEqual([['MM5-FLASH-1','CONSUMED'],['MM5-FLASH-3','PLAYER'],['MM5-FLASH-4','PLAYER']]);expect(x.flashSample).toEqual(old.polymath.samples.FLASH);expect(x.flashSample.learnedWeek).toBe(42);
  for(const key of ['reader','reasoner','detective','polymath','mysticismMagister','prophet','insightScholar','wisdomAngel'] as const)expect(s[key]).toEqual(old[key]);
  expect(s.wisdomAngel.encounter.status).toBe('AVAILABLE');expect(s.wisdomAngel.life.device.charges).toBe(0);
  const dead=migrateSliceState(readObjectEntry<SliceState>('tests/fixtures/wisdom-angel-v01700/natural.json','final'));expect(dead.status).toBe('DEAD');expect(dead.health).toBe(0);expect(blockAllKnowingEyeEncounter(dead,{type:'ENCOUNTER_TALK'})).not.toBeNull();
 });
 it('uses exact inherited count boundaries and the displayed actual enemy wheel',()=>{
  expect(ALL_KNOWING_EYE_COUNT_WHEEL).toBe(WISDOM_ANGEL_COUNT_WHEEL);expect(ALL_KNOWING_EYE_ENEMY_COUNT_WHEEL).toBe(WISDOM_ANGEL_COUNT_WHEEL);expect(ALL_KNOWING_EYE_COUNT_WHEEL.map(x=>x.weight)).toEqual([10,15,25,25,15,10]);
  for(const [roll,count]of [[1,1],[10,1],[11,2],[25,2],[26,3],[50,3],[51,4],[75,4],[76,5],[90,5],[91,6],[100,6]])expect(allKnowingEyeActionCount(roll!)).toBe(count);
  expect(ALL_KNOWING_EYE_COMBAT_CONSTANTS).toMatchObject({weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12});
  expect(ALL_KNOWING_EYE_ENEMY_ABILITY_WHEEL.map(x=>[x.id,x.weight])).toEqual([['FLASH',25],['WARD',20],['MIND_PRESSURE',20],['BODY_STRIKE',20],['FEINT',10],['ACCIDENT',5]]);
  let boundary=0;for(const entry of ALL_KNOWING_EYE_ENEMY_ABILITY_WHEEL){const first=boundary+1;boundary+=entry.weight;expect(drawAllKnowingEyeEnemyAbility(random(first))).toBe(entry.id);expect(drawAllKnowingEyeEnemyAbility(random(boundary))).toBe(entry.id);}
  expect(allKnowingEyeAbilityWheel(readyUnit(),null).reduce((n,a)=>n+a.weight,0)).toBeCloseTo(100);
 });
 it('physically approaches the independent adult and requires an explicit policy',()=>{
  const s=readyUnit();expect(()=>encounter(s,{type:'ENCOUNTER_FIGHT'})).toThrow();encounter(s,{type:'ENCOUNTER_TALK'});expect(()=>encounter(s,{type:'ENCOUNTER_FIGHT'})).toThrow();
  const p=projectAllKnowingEyeEncounter(s);expect(p.enemy).toMatchObject({id:'AE1-EDWIN-ROSS',age:47,sequence:1,health:100,mind:100,spirituality:120});expect(p.scene).toMatchObject({playerLocation:'YARD',playerCoordinate:4,enemyCoordinate:6,clockSeconds:4,playerTravelMetres:4,presentMemberIds:[]});expect(p.materials.weapon).toMatchObject({id:'AE1-EDWIN-ROD',owner:'AE1-EDWIN-ROSS',massKg:2,charge:4});expect(p.remainingCraftIds).toEqual(['MM5-FLASH-3','MM5-FLASH-4']);expect(JSON.stringify(p)).not.toMatch(/卷叶|木板|厄势|隐夜|候选|\dG/);
  encounter(s,{type:'ENCOUNTER_POLICY',policy:'ORDINARY'});encounter(s,{type:'LEAVE_ENCOUNTER'});expect(s.allKnowingEye.encounter.scene).toMatchObject({playerLocation:'OUTSIDE',playerCoordinate:0,clockSeconds:8,playerTravelMetres:8});expect(validateAllKnowingEyeEncounter(s)).toBe(true);expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('refuses present life adults, forged sources, extra fields and recycled enemies',()=>{
  for(const mutate of [(s:SliceState)=>{s.allKnowingEye.life.maraPresent=true;},(s:SliceState)=>{s.allKnowingEye.life.irena.present=true;},(s:SliceState)=>{s.allKnowingEye.life.playerLocation='EXIT';}]){const s=readyUnit();mutate(s);expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();}
  for(const c of [{type:'ENCOUNTER_POLICY',policy:'ALL',extra:true},{type:'ENCOUNTER_FIGHT',target:'WA2-VICTOR'},{type:'BUY_BATTLE_PLATE'}])expect(validateAllKnowingEyeEncounterCommand(c)).toBe(false);
  for(const mutate of [(x:AllKnowingEyeCombatSource)=>{(x as unknown as {targetId:string}).targetId='WA2-VICTOR';},(x:AllKnowingEyeCombatSource)=>{x.mastery['reader.s7.agility']=1;},(x:AllKnowingEyeCombatSource)=>{x.materials.weapon.charge=3;},(x:AllKnowingEyeCombatSource)=>{x.root.presentMemberIds.push('WA2-MARA');},(x:AllKnowingEyeCombatSource)=>{x.flashSample.learnedWeek=x.week+1;},(x:AllKnowingEyeCombatSource)=>{x.crafts[1]!.power++;},(x:AllKnowingEyeCombatSource)=>{x.randomSeed='replacement';}]){const x=source();mutate(x);expect(validAllKnowingEyeCombatSource(x)).toBe(false);}
 });
});

describe('future-only conditional windows with real cost',()=>{
 it('opens insight with no immediate reward, then aids only one subsequent independent slot',()=>{
  const x=source(),r=createAllKnowingEyeRuntime(x),first=resolveAllKnowingEyePlayerSlot(x,r,BOUNDED_INSIGHT,0,random(1,100));expect(first).toMatchObject({paidCost:6,mindCost:2,selfGain:0,enemyReduction:0,finiteResult:'PENDING',check:{ability:'knowledge',difficulty:18}});expect(r.mastery).toEqual(x.mastery);
  const next=resolveAllKnowingEyePlayerSlot(x,r,'STRIKE',1,random());expect(next.selfGain).toBe(next.rawContribution+10);expect(next.masteryApplied).toEqual([BOUNDED_INSIGHT]);expect(r.windows.boundedInsight).toBeNull();expect(resolveAllKnowingEyePlayerSlot(x,r,'STRIKE',2,random()).selfGain).toBe(next.rawContribution);
 });
 it('does not retroactively assist an earlier action or reward failed or empty next slots',()=>{
  for(const next of ['OBSERVE','reader.s6.limited-imitation'] as const){const x=source(),r=createAllKnowingEyeRuntime(x),old=resolveAllKnowingEyePlayerSlot(x,r,'STRIKE',0,random()),oldCopy=structuredClone(old);resolveAllKnowingEyePlayerSlot(x,r,BOUNDED_INSIGHT,1,random(1,100));resolveAllKnowingEyePlayerSlot(x,r,next,2,next==='OBSERVE'?random():random(100));expect(old).toEqual(oldCopy);expect(r.mastery).toEqual(x.mastery);expect(r.windows.boundedInsight).toBeNull();}
 });
 it('pays once on failed and resisted insight, with ordinary fallback on repeat',()=>{
  for(const rolls of [[100],[1,30]]){const x=source(),r=createAllKnowingEyeRuntime(x),a=resolveAllKnowingEyePlayerSlot(x,r,BOUNDED_INSIGHT,0,random(...rolls));expect(a).toMatchObject({paidCost:6,mindCost:2});expect(['FAILED','RESISTED']).toContain(a.finiteResult);expect(r.windows.boundedInsight).toBeNull();expect(r.mastery).toEqual(x.mastery);expect(resolveAllKnowingEyePlayerSlot(x,r,BOUNDED_INSIGHT,1,random())).toMatchObject({finiteResult:'ALREADY_ATTEMPTED',paidCost:0,selectedAbility:'BLOCK'});}
 });
 it('forecast needs a visible future BODY and cannot be purchased against MENTAL or no target',()=>{
  const x=source(),r=createAllKnowingEyeRuntime(x);expect(resolveAllKnowingEyePlayerSlot(x,r,PENDING_FORECAST,0,random())).toMatchObject({finiteResult:'UNAVAILABLE',paidCost:0});declareAllKnowingEyeEnemyAction(x,r,'MIND_PRESSURE',0);expect(resolveAllKnowingEyePlayerSlot(x,r,PENDING_FORECAST,1,random()).paidCost).toBe(0);expect(resolveAllKnowingEyeEnemySlot(x,r,'MIND_PRESSURE',2,random())).toMatchObject({selfGain:65,attackKind:'MENTAL',mentalPressure:true,threatens:false});expect(r.mastery).toEqual(x.mastery);
 });
 it('forecast pays eight spirituality and three mind, then reduces exactly one visible BODY by30',()=>{
  const x=source(),r=createAllKnowingEyeRuntime(x);declareAllKnowingEyeEnemyAction(x,r,'FLASH',0);const open=resolveAllKnowingEyePlayerSlot(x,r,PENDING_FORECAST,0,random(1,100));expect(open).toMatchObject({paidCost:8,mindCost:3,finiteResult:'PENDING',check:{ability:'perception',difficulty:18}});expect(r.mastery).toEqual(x.mastery);
  expect(resolveAllKnowingEyeEnemySlot(x,r,'FLASH',1,random())).toMatchObject({selfGain:75,rawContribution:105,rodChargeSpent:1,masteryApplied:[PENDING_FORECAST]});expect(resolveAllKnowingEyeEnemySlot(x,r,'FLASH',2,random()).selfGain).toBe(105);expect(r.mastery[PENDING_FORECAST]).toBe(x.mastery[PENDING_FORECAST]!+8);
 });
 it('failed or resisted forecast retains real costs without mastery',()=>{
  for(const rolls of [[100],[1,1]]){const x=source(),r=createAllKnowingEyeRuntime(x);declareAllKnowingEyeEnemyAction(x,r,'FLASH',0);expect(resolveAllKnowingEyePlayerSlot(x,r,PENDING_FORECAST,0,random(...rolls))).toMatchObject({paidCost:8,mindCost:3});expect(resolveAllKnowingEyeEnemySlot(x,r,'FLASH',1,random()).selfGain).toBe(105);expect(r.mastery).toEqual(x.mastery);}
 });
 it('expiry, a changed version, obscuration and leaving invalidate unused windows',()=>{
  for(const change of [(r:ReturnType<typeof createAllKnowingEyeRuntime>)=>advanceAllKnowingEyeCombatClock(r,30),(r:ReturnType<typeof createAllKnowingEyeRuntime>)=>{r.root.conditionVersion++;},(r:ReturnType<typeof createAllKnowingEyeRuntime>)=>{r.root.visibleBodyLine=false;},(r:ReturnType<typeof createAllKnowingEyeRuntime>)=>{r.root.playerLocation='OUTSIDE';r.root.playerCoordinate=0;}]){
   const x=source(),r=createAllKnowingEyeRuntime(x);resolveAllKnowingEyePlayerSlot(x,r,BOUNDED_INSIGHT,0,random(1,100));change(r);const a=resolveAllKnowingEyePlayerSlot(x,r,'STRIKE',1,random());expect(a.masteryApplied).toEqual([]);expect(r.mastery).toEqual(x.mastery);expect(r.playerS).toBe(x.playerSpirituality-6);
  }
  const x=source(),r=createAllKnowingEyeRuntime(x);declareAllKnowingEyeEnemyAction(x,r,'FLASH',0);resolveAllKnowingEyePlayerSlot(x,r,PENDING_FORECAST,0,random(1,100));advanceAllKnowingEyeCombatClock(r,30);expect(resolveAllKnowingEyeEnemySlot(x,r,'FLASH',1,random()).selfGain).toBe(105);expect(r.mastery).toEqual(x.mastery);
 });
 it('actual FEINT changes conditions and OBSERVE walks one metre sideways and back',()=>{
  const x=source(),r=createAllKnowingEyeRuntime(x);resolveAllKnowingEyePlayerSlot(x,r,BOUNDED_INSIGHT,0,random(1,100));expect(resolveAllKnowingEyeEnemySlot(x,r,'FEINT',1,random())).toMatchObject({paidCost:3,conditionVersionBefore:1,conditionVersionAfter:2});expect(r.windows.boundedInsight).toBeNull();expect(r.root.visibleBodyLine).toBe(false);const before=r.root.playerTravelMetres;
  expect(resolveAllKnowingEyePlayerSlot(x,r,'OBSERVE',2,random())).toMatchObject({travelMetres:2,lateralTravelPath:[0,1,0]});expect(r.root).toMatchObject({playerCoordinate:4,playerTravelMetres:before+2,visibleBodyLine:true,observedConditionVersion:2});expect(resolveAllKnowingEyeEnemySlot(x,r,'FEINT',3,random())).toMatchObject({selectedAbility:'OBSERVE',paidCost:0});expect(r.body.powerUses.FEINT).toBe(1);
 });
 it('honours ordinary and inherited-only policies and resource insufficiency',()=>{
  for(const policy of ['ORDINARY','INHERITED_ONLY'] as const){const x=source(policy),r=createAllKnowingEyeRuntime(x);declareAllKnowingEyeEnemyAction(x,r,'FLASH',0);for(const id of [BOUNDED_INSIGHT,PENDING_FORECAST])expect(resolveAllKnowingEyePlayerSlot(x,r,id,0,random())).toMatchObject({paidCost:0,selectedAbility:'BLOCK'});expect(r.mastery).toEqual(x.mastery);}
  const x=source(),r=createAllKnowingEyeRuntime(x);r.playerS=0;expect(resolveAllKnowingEyePlayerSlot(x,r,BOUNDED_INSIGHT,0,random())).toMatchObject({paidCost:0,finiteResult:'INSUFFICIENT'});expect(r.body.boundedInsightAttempts).toBe(0);
 });
});

describe('actual original craft, body, mind and deterministic outcome evidence',()=>{
 it('consumes only original FLASH3 then4, leaves1 consumed, then uses ordinary fallback',()=>{
  const x=source(),r=createAllKnowingEyeRuntime(x),first=structuredClone(r.crafts[0]);expect(resolveAllKnowingEyePlayerSlot(x,r,'reader.s5.material-imitation',0,random())).toMatchObject({consumedCraftId:'MM5-FLASH-3',enemyReduction:18*x.crafts[1]!.power});expect(resolveAllKnowingEyePlayerSlot(x,r,'reader.s5.material-imitation',1,random())).toMatchObject({consumedCraftId:'MM5-FLASH-4',enemyReduction:18*x.crafts[2]!.power});expect(resolveAllKnowingEyePlayerSlot(x,r,'reader.s5.material-imitation',2,random())).toMatchObject({consumedCraftId:null,selectedAbility:'STRIKE'});expect(r.crafts[0]).toEqual(first);expect(r.crafts.map(c=>c.id)).toEqual(x.crafts.map(c=>c.id));expect(r.mastery).toEqual(x.mastery);
 });
 it('requires the learned FLASH sample and actual witnessed METHOD, with no free skill library',()=>{
  const x=source(),r=createAllKnowingEyeRuntime(x);expect(resolveAllKnowingEyePlayerSlot(x,r,'reader.s3.method-analysis',0,random()).paidCost).toBe(0);resolveAllKnowingEyeEnemySlot(x,r,'WARD',1,random());expect(resolveAllKnowingEyePlayerSlot(x,r,'reader.s3.method-analysis',2,random(1))).toMatchObject({paidCost:5,enemyReduction:35});expect(resolveAllKnowingEyePlayerSlot(x,r,'reader.s6.limited-imitation',3,random(1))).toMatchObject({paidCost:2});expect(resolveAllKnowingEyePlayerSlot(x,r,'reader.s7.reconstruction',4,random())).toMatchObject({selectedAbility:'OBSERVE',paidCost:0});expect(r.mastery).toEqual(x.mastery);
  const missing=source();missing.flashSample.learnedWeek=null;expect(resolveAllKnowingEyePlayerSlot(missing,createAllKnowingEyeRuntime(missing),'reader.s6.limited-imitation',0,random())).toMatchObject({paidCost:0,selectedAbility:'STRIKE'});
 });
 it('never records an unseen spell as a witnessed method',()=>{
  const x=source(),r=createAllKnowingEyeRuntime(x);resolveAllKnowingEyeEnemySlot(x,r,'FEINT',0,random());resolveAllKnowingEyeEnemySlot(x,r,'FLASH',1,random());expect(r.body.observations).toEqual([]);resolveAllKnowingEyePlayerSlot(x,r,'OBSERVE',2,random());expect(resolveAllKnowingEyePlayerSlot(x,r,'reader.s3.method-analysis',3,random()).paidCost).toBe(0);
 });
 it('exhausts exactly four rod charges, then attacks with the same body and rod',()=>{
  const x=source(),r=createAllKnowingEyeRuntime(x);for(let n=0;n<4;n++)resolveAllKnowingEyeEnemySlot(x,r,'FLASH',n,random());expect(r.materials.weapon.charge).toBe(0);expect(r.body.enemySpirituality).toBe(92);expect(resolveAllKnowingEyeEnemySlot(x,r,'FLASH',4,random())).toMatchObject({selectedAbility:'BODY_STRIKE',paidCost:0,rodChargeSpent:0,travelPath:[6,4,6],travelMetres:4});expect(r.materials.weapon.id).toBe('AE1-EDWIN-ROD');
 });
 it('MENTAL loss has no bodily injury wheel, while health death is terminal',()=>{
  const x=source(),r=createAllKnowingEyeRuntime(x),mental=resolveAllKnowingEyeEnemySlot(x,r,'MIND_PRESSURE',0,random());const m=resolveAllKnowingEyeConsequences(x,r,[],[mental],'ENEMY','NONE',random());expect(m).toMatchObject({playerHealth:x.playerHealth,playerRisk:x.playerRisk,playerInjuries:x.playerInjuries,consequenceDomain:'MENTAL',consequenceWeights:null,consequenceRoll:undefined,outcome:'CONTINUE'});expect(r.playerM).toBe(x.playerMind-10);
  const exhausted=createAllKnowingEyeRuntime(x);exhausted.playerM=10;const e=resolveAllKnowingEyeEnemySlot(x,exhausted,'MIND_PRESSURE',0,random());expect(resolveAllKnowingEyeConsequences(x,exhausted,[],[e],'ENEMY','NONE',random()).outcome).toBe('RETREATED');expect(exhausted.playerM).toBe(0);expect(exhausted.playerH).toBe(100);
  const dying=createAllKnowingEyeRuntime(x),body=resolveAllKnowingEyeEnemySlot(x,dying,'BODY_STRIKE',0,random());expect(resolveAllKnowingEyeConsequences(x,dying,[],[body],'ENEMY','NONE',random(100))).toMatchObject({playerHealth:0,outcome:'PLAYER_DEAD',consequenceDomain:'BODY',consequenceWeights:{light:65,heavy:30,death:5}});
 });
 it('replays exact source/cursor/action/cost/craft evidence and rejects forged outcomes',()=>{
  const x=source(),before=structuredClone(x),result=replayAllKnowingEyeCombatRound(x,'ATTACK'),o=result.round.allKnowingEyeOutcome!;expect(x).toEqual(before);expect(validateAllKnowingEyeCombatRound(result.round)).toBe(true);expect(validateAllKnowingEyeRoundOutcome(o)).toBe(true);expect(o.windowsAfter).toEqual({boundedInsight:null,pendingForecast:null,oldResponse:null});expect(o.rootAfter.clockSeconds).toBe(x.root.clockSeconds+60);
  for(const mutate of [(v:typeof o)=>{v.randomCursorAfter++;},(v:typeof o)=>{v.playerSpiritualityAfter++;},(v:typeof o)=>{v.craftsAfter[0]!.status='PLAYER';v.craftsAfter[0]!.usedWeek=null;},(v:typeof o)=>{v.materialsAfter.weapon.charge++;},(v:typeof o)=>{v.rootAfter.playerTravelMetres++;}]){const forged=structuredClone(o);mutate(forged);expect(validateAllKnowingEyeRoundOutcome(forged)).toBe(false);}
  if(o.continuing){const next=nextAllKnowingEyeCombatSource(o);expect(next.playerSpirituality).toBe(Math.min(120,o.playerSpiritualityAfter+12));expect(next.crafts).toEqual(o.craftsAfter);expect(validAllKnowingEyeCombatSource(next)).toBe(true);}
 });
 it('runs a fixed original-seed unit encounter to a real terminal with original history and material audit intact',()=>{
  const s=fighting(),old=original(),history=structuredClone(s.combatHistory);let rounds=0;
  while(s.combat&&rounds++<64){tickRound(s);expect(validateAllKnowingEyeEncounter(s)).toBe(true);}
  expect(s.combat).toBeNull();const e=s.allKnowingEye.encounter,t=e.terminal!;expect(t).not.toBeNull();expect(s.combatHistory.slice(0,history.length)).toEqual(history);expect(allKnowingEyeEncounterOriginalEvents(s)).toHaveLength(t.round);expect(s.wisdomAngel).toEqual(old.wisdomAngel);expect(s.polymath).toEqual(old.polymath);expect(s.wisdomAngel.life.device.charges).toBe(0);for(const id of ALL_KNOWING_EYE_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(old.progression.mastery[id]);
  const last=s.combatHistory.at(-1)!.allKnowingEyeOutcome!;expect(e.scene.playerTravelMetres).toBe(last.rootAfter.playerTravelMetres+(s.health>0?4:0));expect(e.scene.clockSeconds).toBe(last.rootAfter.clockSeconds+(s.health>0?4:0));expect(e.scene.playerLocation).toBe(s.health>0?'OUTSIDE':'YARD');expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('allows honest zero-AP ready cleanup, then validates the exact shared weekly finance transition',()=>{
  const s=readyUnit();s.actionsRemaining=1;encounter(s,{type:'ENCOUNTER_TALK'});expect(s.actionsRemaining).toBe(0);expect(blockAllKnowingEyeEncounter(s,{type:'LEAVE_ENCOUNTER'})).toBeNull();expect(blockAllKnowingEyeEncounter(s,{type:'ENCOUNTER_FIGHT'})).not.toBeNull();expect(validateAllKnowingEyeEncounter(s)).toBe(true);
  encounter(s,{type:'LEAVE_ENCOUNTER'});const entry=s.allKnowingEye.encounter.journal.at(-1)!,expected=allKnowingEyeEncounterBudget(s),finance=allKnowingEyeFinanceSnapshot(s),week=s.week,date={...s.date};expect(expected.actions).toBe(0);
  const transition=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:s.revision-1,pulse:'BILL',billAmount:0});expect(transition.eventId).toBeNull();
  const final=transition.state;s.cash=final.cash;s.debts=structuredClone(final.debts);s.missedWeeks=final.missedWeeks;s.credit=final.credit;s.nextLifeTier=final.nextLifeTier;s.lifeTier=final.nextLifeTier;s.week++;s.date=addGameWeeks(date,1);s.actionsRemaining=finance.weeklyBudget;s.pulse='NONE';s.billAmount=0;
  for(const receipt of transition.receipts)s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week,...receipt});s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week:s.week,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
  expect(allKnowingEyeCompletedBudgetMatches(s,expected,finance,week,date,entry.revision,entry.randomCursor,'沿普通路和平离开石院')).toBe(true);expect(validateAllKnowingEyeEncounter(s)).toBe(true);const forged=structuredClone(s);forged.cash++;expect(validateAllKnowingEyeEncounter(forged)).toBe(false);expect(s.allKnowingEye.encounter.scene).toMatchObject({clockSeconds:8,playerTravelMetres:8,playerLocation:'OUTSIDE'});
 });
});
