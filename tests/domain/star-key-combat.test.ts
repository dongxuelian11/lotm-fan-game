import { describe,expect,it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { PLANESWALKER_COUNT_WHEEL } from '../../src/domain/planeswalker/combat.js';
import { createStarKeyEncounterState,applyStarKeyEncounterCommand,validateStarKeyEncounter,validateStarKeyEncounterCommand,projectStarKeyEncounter,settleStarKeyEncounter,combatBody,
 starKeyEncounterOriginalEvents,starKeyCompletedBudgetMatches,starKeyEncounterBudget,starKeyFinanceSnapshot,blockStarKeyEncounter,type StarKeyEncounterCommand,type StarKeyPolicy } from '../../src/domain/star-key/encounter.js';
import { ENDPOINT_LOCATION,ANCHOR_MAINTENANCE,STAR_KEY_INHERITED_SKILL_IDS,STAR_KEY_NEW_ABILITY_IDS,STAR_KEY_COUNT_WHEEL,STAR_KEY_ENEMY_COUNT_WHEEL,STAR_KEY_ENEMY_ABILITY_WHEEL,STAR_KEY_COMBAT_CONSTANTS,
 starKeyActionCount,starKeyAbilityWheel,drawStarKeyEnemyAbility,currentStarKeyCombatSource,createStarKeyRuntime,declareStarKeyEnemyAction,resolveStarKeyPlayerSlot,resolveStarKeyEnemySlot,advanceStarKeyCombatClock,resolveStarKeyConsequences,replayStarKeyCombatRound,validStarKeyCombatSource,validateStarKeyCombatRound,validateStarKeyRoundOutcome,nextStarKeyCombatSource,type StarKeyCombatSource } from '../../src/domain/star-key/combat.js';

function context(s:SliceState):SeerContext{return{roll(){throw new Error('Encounter commands must not draw.');},check(){throw new Error('Encounter commands must not check.');},note(title,text){s.chronicle.push({id:`record-${s.revision+1}-${s.chronicle.length}`,week:s.week,title,text});}};}
/** Isolated current-schema constructor, never a rewritten historical fixture or
 * acquisition/campaign evidence. Explicit old skill values exercise retention. */
function readyUnit():SliceState {
 const s=createSliceRun('star-key-isolated-combat',sliceDefaultCreationSelection,'star-key-isolated-combat');
 s.activeEvent=null;s.eventQueue=[];s.chronicle=[];s.pulse='NONE';s.billAmount=0;s.revision=1009;s.week=201;s.date={epoch:'FIFTH_EPOCH',year:1353,month:4,day:28};
 s.cash=5280;s.actionsRemaining=3;s.health=100;s.mind=100;s.spirituality=120;s.injuries=[];s.injuryRisk=0;s.debts=[];
 s.character.coreStats={physique:28,perception:29,will:28,knowledge:24};s.progression.pathwayId='door';s.progression.sequence=1;s.progression.acting=100;
 const old=[78,45,66,8,8,8,46,0,0,0,0,0,0,8,0];s.progression.mastery=Object.fromEntries(STAR_KEY_INHERITED_SKILL_IDS.map((id,i)=>[id,old[i]!]));for(const id of STAR_KEY_NEW_ABILITY_IDS)s.progression.mastery[id]=0;
 s.starKey.promotionWeek=s.week;s.starKey.life.reflected=true;s.starKey.life.playerLocation='OUTSIDE';for(const c of Object.values(s.starKey.life.cases))c.status='RESOLVED';
 s.planeswalker.life.site.playerLocation='OUTSIDE';s.planeswalker.life.site.operatorLocation='OUTSIDE';s.planeswalker.life.site.door.state='CLOSED';s.planeswalker.life.site.parcel.location='ENTRY_STAND';
 s.starKey.encounter=createStarKeyEncounterState();return s;
}
function encounter(s:SliceState,c:StarKeyEncounterCommand):SliceState{applyStarKeyEncounterCommand(s,c,context(s));s.revision++;return s;}
function fighting(policy:StarKeyPolicy='ALL'):SliceState {const s=readyUnit();encounter(s,{type:'ENCOUNTER_TALK'});encounter(s,{type:'ENCOUNTER_POLICY',policy});encounter(s,{type:'ENCOUNTER_FIGHT'});expect(validateStarKeyEncounter(s)).toBe(true);return s;}
function source(policy:StarKeyPolicy='ALL'):StarKeyCombatSource {const x=currentStarKeyCombatSource(fighting(policy));if(!x)throw new Error('Missing isolated source.');expect(validStarKeyCombatSource(x)).toBe(true);return x;}
/** Declared isolated checks, never substituted into a campaign or fixture. */
function random(...values:number[]):ActionRandomStream{let cursor=0;return{seed:'declared-isolated-slot',get cursor(){return cursor;},nextInt(min,max){const n=values[cursor++];if(n===undefined||n<min||n>max)throw new Error(`Unexpected isolated draw ${n} for ${min}..${max}`);return n;}};}
function commitRound(s:SliceState,stance:'ATTACK'|'RETREAT'='ATTACK'){
 const x=currentStarKeyCombatSource(s)!;const result=replayStarKeyCombatRound(x,stance),o=result.round.starKeyOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);Object.assign(s.starKey.encounter,combatBody(o));s.starKey.encounter.scene=structuredClone(o.rootAfter);s.starKey.encounter.materials=structuredClone(o.materialsAfter);
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;c.round++;s.lastCombatRound=result.round;s.random.cursor=o.randomCursorAfter;s.combatHistory.push(result.round);
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);else{settleStarKeyEncounter(s,result.outcome,context(s));if(result.outcome==='PLAYER_DEAD')s.status='DEAD';}s.revision++;return result;
}

describe('Star Key finite encounter and actual Door source',()=>{
 it('retains fifteen old values including seven zeros and exactly two new skills',()=>{const x=source();expect(STAR_KEY_INHERITED_SKILL_IDS).toHaveLength(15);expect(Object.keys(x.mastery)).toHaveLength(17);expect(STAR_KEY_INHERITED_SKILL_IDS.filter(id=>x.mastery[id]===0)).toHaveLength(7);expect(x.mastery['door.s2.symbolic-transit']).toBe(8);expect(x.mastery['door.s2.pattern-reproduction']).toBe(0);});
 it('retains the real count wheel, core, base, floor and bounded resources',()=>{
  expect(STAR_KEY_COUNT_WHEEL).toBe(PLANESWALKER_COUNT_WHEEL);expect(STAR_KEY_ENEMY_COUNT_WHEEL).toBe(PLANESWALKER_COUNT_WHEEL);expect(STAR_KEY_COUNT_WHEEL.map(x=>x.weight)).toEqual([10,15,25,25,15,10]);
  for(const [roll,count]of [[1,1],[10,1],[11,2],[25,2],[26,3],[50,3],[51,4],[75,4],[76,5],[90,5],[91,6],[100,6]])expect(starKeyActionCount(roll!)).toBe(count);
  expect(STAR_KEY_COMBAT_CONSTANTS).toMatchObject({weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,windowSeconds:20});expect(starKeyAbilityWheel(readyUnit(),null).reduce((n,a)=>n+a.weight,0)).toBeCloseTo(100);
  let n=0;for(const e of STAR_KEY_ENEMY_ABILITY_WHEEL){expect(drawStarKeyEnemyAbility(random(n+1))).toBe(e.id);n+=e.weight;expect(drawStarKeyEnemyAbility(random(n))).toBe(e.id);}expect(n).toBe(100);
 });
 it('requires Mara to have physically exited and a fresh independent adult with own club and three marks',()=>{
  for(const mutate of [(s:SliceState)=>{s.planeswalker.life.site.operatorLocation='ENTRY';},(s:SliceState)=>{s.planeswalker.life.site.playerLocation='ENTRY';},(s:SliceState)=>{s.planeswalker.life.site.parcel.location='PLAYER';},(s:SliceState)=>{s.planeswalker.life.site.door.state='OPEN';},(s:SliceState)=>{s.starKey.life.reflected=false;}]){const s=readyUnit();mutate(s);expect(blockStarKeyEncounter(s,{type:'ENCOUNTER_TALK'})).not.toBeNull();}
  const s=readyUnit(),old=structuredClone(s.planeswalker);encounter(s,{type:'ENCOUNTER_TALK'});expect(()=>encounter(s,{type:'ENCOUNTER_FIGHT'})).toThrow();const p=projectStarKeyEncounter(s);expect(p.enemy).toMatchObject({id:'SK1-ROWAN-VALE',age:44,health:100,mind:100,spirituality:120});expect(p.materials.marks).toHaveLength(3);expect(p.scene).toMatchObject({playerCoordinate:4,enemyCoordinate:6,clockSeconds:4,playerTravelMetres:4,presentMemberIds:[]});expect(s.planeswalker).toEqual(old);expect(JSON.stringify(p)).not.toMatch(/候选|待核实|开发者/);
  encounter(s,{type:'LEAVE_ENCOUNTER'});expect(s.starKey.encounter.scene).toMatchObject({playerLocation:'OUTSIDE',playerCoordinate:0,clockSeconds:8,playerTravelMetres:8});expect(validateStarKeyEncounter(s)).toBe(true);expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('rejects changed originals, extra command fields, a recycled Soren and forged source resources',()=>{
  expect(validateStarKeyEncounterCommand({type:'ENCOUNTER_FIGHT',target:'PW2-SOREN'})).toBe(false);expect(validateStarKeyEncounterCommand({type:'ENCOUNTER_POLICY',policy:'ALL',extra:true})).toBe(false);
  for(const mutate of [(x:StarKeyCombatSource)=>{(x as unknown as{targetId:string}).targetId='PW2-SOREN';},(x:StarKeyCombatSource)=>{x.mastery['door.s4.banishment']=8;},(x:StarKeyCombatSource)=>{x.materials.marks.pop();},(x:StarKeyCombatSource)=>{x.root.presentMemberIds.push('PW2-MARA');},(x:StarKeyCombatSource)=>{x.randomSeed='replacement';},(x:StarKeyCombatSource)=>{x.body.enemySpirituality++;}]){const x=source();mutate(x);expect(validStarKeyCombatSource(x)).toBe(false);}
  const s=fighting();s.planeswalker.life.site.lamp.oilRemaining++;expect(currentStarKeyCombatSource(s)).toBeNull();expect(validateStarKeyEncounter(s)).toBe(false);
 });
});

describe('future-only location and anchor windows',()=>{
 it('requires an observed pending target and pays8S2M before opening a zero-effect20s clue',()=>{
  const x=source(),r=createStarKeyRuntime(x);expect(resolveStarKeyPlayerSlot(x,r,ENDPOINT_LOCATION,0,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE'});declareStarKeyEnemyAction(x,r,'BODY_STRIKE',0);
  const a=resolveStarKeyPlayerSlot(x,r,ENDPOINT_LOCATION,1,random(1,100));expect(a).toMatchObject({paidCost:8,mindCost:2,selfGain:0,enemyReduction:0,finiteResult:'PENDING',check:{ability:'perception',difficulty:18},elapsedSeconds:5});expect(r.mastery).toEqual(x.mastery);expect(r.windows.endpointLocation!.expiresAt-r.windows.endpointLocation!.createdAt).toBe(20);
  const b=resolveStarKeyPlayerSlot(x,r,'STRIKE',2,random());expect(b.selfGain).toBe(b.rawContribution+30);expect(b.masteryApplied).toEqual([ENDPOINT_LOCATION]);expect(r.windows.endpointLocation).toBeNull();expect(resolveStarKeyPlayerSlot(x,r,'STRIKE',3,random()).selfGain).toBe(b.rawContribution);
 });
 it('preserves the clue through an ineligible observation, then applies only the next eligible own action',()=>{
  const x=source(),r=createStarKeyRuntime(x);declareStarKeyEnemyAction(x,r,'BODY_STRIKE',0);resolveStarKeyPlayerSlot(x,r,ENDPOINT_LOCATION,0,random(1,100));resolveStarKeyPlayerSlot(x,r,'OBSERVE',1,random());expect(r.mastery).toEqual(x.mastery);expect(r.windows.endpointLocation).not.toBeNull();expect(resolveStarKeyPlayerSlot(x,r,'BLOCK',2,random())).toMatchObject({rawReduction:10,enemyReduction:40,masteryApplied:[ENDPOINT_LOCATION]});
 });
 it('never retroactively edits a previous action or awards mastery for opening another window',()=>{
  const x=source(),r=createStarKeyRuntime(x),old=resolveStarKeyPlayerSlot(x,r,'STRIKE',0,random()),copy=structuredClone(old);declareStarKeyEnemyAction(x,r,'MENTAL_MARK',0);resolveStarKeyPlayerSlot(x,r,ENDPOINT_LOCATION,1,random(1,100));expect(resolveStarKeyPlayerSlot(x,r,ANCHOR_MAINTENANCE,2,random(1,100))).toMatchObject({selfGain:0,enemyReduction:0,masteryApplied:[]});expect(old).toEqual(copy);expect(r.mastery).toEqual(x.mastery);
 });
 it('retains paid costs on failed/resisted casts and blocks free repeat attempts',()=>{
  for(const id of [ENDPOINT_LOCATION,ANCHOR_MAINTENANCE])for(const rolls of [[100],[1,30]]){const x=source(),r=createStarKeyRuntime(x);declareStarKeyEnemyAction(x,r,'MENTAL_MARK',0);const a=resolveStarKeyPlayerSlot(x,r,id,0,random(...rolls));expect(a.paidCost).toBe(id===ENDPOINT_LOCATION?8:7);expect(a.mindCost).toBe(2);expect(['FAILED','RESISTED']).toContain(a.finiteResult);expect(r.mastery).toEqual(x.mastery);expect(resolveStarKeyPlayerSlot(x,r,id,1,random())).toMatchObject({paidCost:0,finiteResult:'ALREADY_ATTEMPTED'});}
 });
 it('anchor refuses BODY and past marks without cost, and never skips a club action',()=>{
  const x=source(),r=createStarKeyRuntime(x);declareStarKeyEnemyAction(x,r,'BODY_STRIKE',0);expect(resolveStarKeyPlayerSlot(x,r,ANCHOR_MAINTENANCE,0,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE'});expect(resolveStarKeyEnemySlot(x,r,'BODY_STRIKE',1,random())).toMatchObject({rawContribution:20,selfGain:20,attackKind:'BODY',threatens:true});
  resolveStarKeyEnemySlot(x,r,'MENTAL_MARK',2,random());expect(resolveStarKeyPlayerSlot(x,r,ANCHOR_MAINTENANCE,3,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE'});expect(r.mastery).toEqual(x.mastery);
 });
 it('anchor pays7S2M and reduces exactly the same future observed SPATIAL or MENTAL contribution30',()=>{
  for(const intent of ['SPATIAL_MARK','MENTAL_MARK'] as const){const x=source(),r=createStarKeyRuntime(x);const pending=declareStarKeyEnemyAction(x,r,intent,0);expect(resolveStarKeyPlayerSlot(x,r,ANCHOR_MAINTENANCE,0,random(1,100))).toMatchObject({paidCost:7,mindCost:2,finiteResult:'PENDING',check:{ability:'knowledge',difficulty:18},masteryApplied:[]});expect(r.windows.anchorMaintenance!.targetActionId).toBe(pending.id);
   const a=resolveStarKeyEnemySlot(x,r,intent,1,random());expect(a.selfGain).toBe(a.rawContribution-30);expect(a.masteryApplied).toEqual([ANCHOR_MAINTENANCE]);expect(a.consumedMarkId).toBe('SK1-ROWAN-MARK-1');expect(resolveStarKeyEnemySlot(x,r,'BODY_STRIKE',2,random()).selfGain).toBe(20);expect(r.windows.anchorMaintenance).toBeNull();}
 });
 it('expiry, obscuration, actual moved endpoint and leaving cancel paid windows without refund',()=>{
  for(const change of [(r:ReturnType<typeof createStarKeyRuntime>)=>advanceStarKeyCombatClock(r,15),(r:ReturnType<typeof createStarKeyRuntime>)=>{r.root.visibleBodyLine=false;},(r:ReturnType<typeof createStarKeyRuntime>)=>{r.root.enemyCoordinate=7;},(r:ReturnType<typeof createStarKeyRuntime>)=>{r.root.playerLocation='OUTSIDE';r.root.playerCoordinate=0;}]){
   const x=source(),r=createStarKeyRuntime(x);declareStarKeyEnemyAction(x,r,'MENTAL_MARK',0);resolveStarKeyPlayerSlot(x,r,ENDPOINT_LOCATION,0,random(1,100));change(r);expect(resolveStarKeyPlayerSlot(x,r,'STRIKE',1,random()).masteryApplied).toEqual([]);expect(r.mastery).toEqual(x.mastery);expect(r.playerS).toBe(x.playerSpirituality-8);expect(r.windows.endpointLocation).toBeNull();
  }
  const x=source(),r=createStarKeyRuntime(x);declareStarKeyEnemyAction(x,r,'MENTAL_MARK',0);resolveStarKeyPlayerSlot(x,r,ANCHOR_MAINTENANCE,0,random(1,100));advanceStarKeyCombatClock(r,15);expect(resolveStarKeyEnemySlot(x,r,'MENTAL_MARK',1,random())).toMatchObject({selfGain:65,masteryApplied:[]});
 });
 it('FEINT physically moves one metre, invalidates windows, and ordinary observation reacquires current position',()=>{
  const x=source(),r=createStarKeyRuntime(x);declareStarKeyEnemyAction(x,r,'FEINT',0);resolveStarKeyPlayerSlot(x,r,ENDPOINT_LOCATION,0,random(1,100));expect(resolveStarKeyEnemySlot(x,r,'FEINT',1,random())).toMatchObject({paidCost:3,travelPath:[6,7],travelMetres:1});expect(r.root).toMatchObject({enemyCoordinate:7,conditionVersion:2,visibleBodyLine:false,enemyTravelMetres:1});expect(r.windows.endpointLocation).toBeNull();
  expect(resolveStarKeyPlayerSlot(x,r,'OBSERVE',2,random())).toMatchObject({travelMetres:2,lateralTravelPath:[0,1,0]});expect(r.root.observedConditionVersion).toBe(2);expect(resolveStarKeyEnemySlot(x,r,'FEINT',3,random())).toMatchObject({selectedAbility:'OBSERVE',paidCost:0});
 });
 it('honours all five policies and cannot cast with missing S or last2M',()=>{
  for(const policy of ['ORDINARY','INHERITED_ONLY'] as const){const x=source(policy),r=createStarKeyRuntime(x);declareStarKeyEnemyAction(x,r,'MENTAL_MARK',0);for(const id of [ENDPOINT_LOCATION,ANCHOR_MAINTENANCE])expect(resolveStarKeyPlayerSlot(x,r,id,0,random())).toMatchObject({paidCost:0,selectedAbility:'BLOCK'});expect(r.mastery).toEqual(x.mastery);}
  for(const policy of ['ENDPOINT_LOCATION','ANCHOR_MAINTENANCE'] as const){const x=source(policy),r=createStarKeyRuntime(x);declareStarKeyEnemyAction(x,r,'MENTAL_MARK',0);const rejected=policy==='ENDPOINT_LOCATION'?ANCHOR_MAINTENANCE:ENDPOINT_LOCATION;expect(resolveStarKeyPlayerSlot(x,r,rejected,0,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE'});}
  for(const field of ['playerS','playerM'] as const){const x=source(),r=createStarKeyRuntime(x);r[field]=field==='playerS'?0:2;declareStarKeyEnemyAction(x,r,'MENTAL_MARK',0);expect(resolveStarKeyPlayerSlot(x,r,ENDPOINT_LOCATION,0,random())).toMatchObject({paidCost:0,mindCost:0,finiteResult:'INSUFFICIENT'});expect(r.body.endpointLocationAttempts).toBe(0);}
 });
});

describe('finite inherited resources and separate consequence domains',()=>{
 it('depletes the same three marks across both effects, then falls back without negative stock or refills',()=>{
  const x=source(),r=createStarKeyRuntime(x);for(const intent of ['SPATIAL_MARK','MENTAL_MARK','SPATIAL_MARK'] as const)resolveStarKeyEnemySlot(x,r,intent,0,random());expect(r.materials.marks.map(m=>m.status)).toEqual(['SPENT','SPENT','SPENT']);expect(r.body.enemySpirituality).toBe(99);
  expect(resolveStarKeyEnemySlot(x,r,'MENTAL_MARK',3,random())).toMatchObject({selectedAbility:'BODY_STRIKE',paidCost:0,consumedMarkId:null,selfGain:20});expect(r.materials.weapon.id).toBe('SK1-ROWAN-CLUB');expect(r.body.enemySpirituality).toBe(99);
 });
 it('uses old tricks/travel with real predecessor checks, costs, mastery scaling and application-only gains',()=>{
  for(const [id,ability,key,n]of [['door.s8.tricks','knowledge','selfGain',36],['door.s5.travel','perception','enemyReduction',22]] as const){const x=source(),r=createStarKeyRuntime(x),a=resolveStarKeyPlayerSlot(x,r,id,0,random(1));expect(a).toMatchObject({paidCost:6,check:{ability,difficulty:16},masteryApplied:[id],finiteResult:'APPLIED'});expect(a[key]).toBeCloseTo(n*(.65+.35*x.mastery[id]!/500));expect(r.mastery[id]).toBe(x.mastery[id]!+8);if(id==='door.s5.travel'){expect(a).toMatchObject({travelMetres:2,lateralTravelPath:[0,1,0]});expect(r.root.playerTravelMetres).toBe(x.root.playerTravelMetres+2);}
   const failed=createStarKeyRuntime(x);expect(resolveStarKeyPlayerSlot(x,failed,id,0,random(100))).toMatchObject({paidCost:6,masteryApplied:[],finiteResult:'FAILED'});expect(failed.mastery).toEqual(x.mastery);}
 });
 it('never fabricates records, remote trips, room devices or zero-mastery powers',()=>{
  const x=source(),r=createStarKeyRuntime(x);for(const id of STAR_KEY_INHERITED_SKILL_IDS.filter(id=>id!=='door.s8.tricks'&&id!=='door.s5.travel'))expect(resolveStarKeyPlayerSlot(x,r,id,0,random())).toMatchObject({selectedAbility:'OBSERVE',paidCost:0,masteryApplied:[],finiteResult:'UNAVAILABLE',selfGain:0,enemyReduction:0});expect(r.mastery).toEqual(x.mastery);expect(r.materials).toEqual(x.materials);
 });
 it('MENTAL pressure never rolls BODY death; spatial-only contribution has no direct injury source',()=>{
  const x=source(),r=createStarKeyRuntime(x),mental=resolveStarKeyEnemySlot(x,r,'MENTAL_MARK',0,random());expect(mental).toMatchObject({attackKind:'MENTAL',mentalPressure:true,threatens:false});const m=resolveStarKeyConsequences(x,r,[],[mental],'ENEMY','NONE',random());expect(m).toMatchObject({playerHealth:100,playerRisk:x.playerRisk,playerInjuries:x.playerInjuries,consequenceDomain:'MENTAL',consequenceWeights:null,consequenceRoll:undefined});expect(r.playerM).toBe(90);
  const q=createStarKeyRuntime(x),spatial=resolveStarKeyEnemySlot(x,q,'SPATIAL_MARK',0,random());expect(spatial).toMatchObject({attackKind:'SPATIAL',mentalPressure:false,threatens:false});expect(resolveStarKeyConsequences(x,q,[],[spatial],'ENEMY','NONE',random())).toMatchObject({playerHealth:100,playerRisk:x.playerRisk,consequenceDomain:undefined,consequenceWeights:null});
 });
 it('body death is final while mental depletion retreats alive and preserves original wounds',()=>{
  const x=source(),r=createStarKeyRuntime(x);r.playerM=10;const mental=resolveStarKeyEnemySlot(x,r,'MENTAL_MARK',0,random());expect(resolveStarKeyConsequences(x,r,[],[mental],'ENEMY','NONE',random())).toMatchObject({outcome:'RETREATED',playerHealth:100});expect(r.playerM).toBe(0);
  const d=createStarKeyRuntime(x),body=resolveStarKeyEnemySlot(x,d,'BODY_STRIKE',0,random());expect(resolveStarKeyConsequences(x,d,[],[body],'ENEMY','NONE',random(100))).toMatchObject({outcome:'PLAYER_DEAD',playerHealth:0,consequenceDomain:'BODY',consequenceWeights:{light:65,heavy:30,death:5}});
 });
 it('replays the exact source/cursor/action costs and rejects altered round evidence',()=>{
  const x=source(),before=structuredClone(x),result=replayStarKeyCombatRound(x,'ATTACK'),o=result.round.starKeyOutcome!;expect(x).toEqual(before);expect(validateStarKeyCombatRound(result.round)).toBe(true);expect(validateStarKeyRoundOutcome(o)).toBe(true);expect(o.rootAfter.clockSeconds).toBe(x.root.clockSeconds+60);expect(o.windowsAfter).toEqual({endpointLocation:null,anchorMaintenance:null});expect([...o.playerActions,...o.enemyActions].every(a=>a.elapsedSeconds===5)).toBe(true);
  for(const mutate of [(v:typeof o)=>{v.randomCursorAfter++;},(v:typeof o)=>{v.playerSpiritualityAfter++;},(v:typeof o)=>{v.materialsAfter.marks[0]!.status='HELD';v.materialsAfter.marks[0]!.usedRound=null;v.materialsAfter.marks[0]!.id='FORGED';},(v:typeof o)=>{v.rootAfter.playerTravelMetres++;},(v:typeof o)=>{v.masteryAfter[ENDPOINT_LOCATION]!+=8;}]){const f=structuredClone(o);mutate(f);expect(validateStarKeyRoundOutcome(f)).toBe(false);}
  if(o.continuing){const next=nextStarKeyCombatSource(o);expect(next.playerSpirituality).toBe(Math.min(120,o.playerSpiritualityAfter+12));expect(validStarKeyCombatSource(next)).toBe(true);}
 });
 it('keeps all eight original roots and histories untouched through a terminal lifecycle',()=>{
  const s=fighting(),keys=['apprentice','trickmaster','astrologer','recorder','traveler','secretsSorcerer','wanderer','planeswalker'] as const,roots=keys.map(k=>structuredClone(s[k])),history=structuredClone(s.combatHistory);let n=0;
  while(s.combat&&n++<128){commitRound(s);expect(validateStarKeyEncounter(s)).toBe(true);}expect(s.combat).toBeNull();expect(s.starKey.encounter.terminal).not.toBeNull();keys.forEach((k,i)=>expect(s[k]).toEqual(roots[i]));expect(s.combatHistory.slice(0,history.length)).toEqual(history);expect(starKeyEncounterOriginalEvents(s)).toEqual([]);
  const last=s.combatHistory.at(-1)!.starKeyOutcome!;expect(s.starKey.encounter.scene.playerTravelMetres).toBe(last.rootAfter.playerTravelMetres+(s.health>0?4:0));expect(s.starKey.encounter.scene.clockSeconds).toBe(last.rootAfter.clockSeconds+(s.health>0?4:0));expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('allows real zero-AP peaceful exit then validates exact shared weekly finance and rejects a free penny',()=>{
  const s=readyUnit();s.actionsRemaining=1;encounter(s,{type:'ENCOUNTER_TALK'});expect(s.actionsRemaining).toBe(0);expect(blockStarKeyEncounter(s,{type:'LEAVE_ENCOUNTER'})).toBeNull();expect(blockStarKeyEncounter(s,{type:'ENCOUNTER_FIGHT'})).not.toBeNull();expect(validateStarKeyEncounter(s)).toBe(true);encounter(s,{type:'LEAVE_ENCOUNTER'});
  const entry=s.starKey.encounter.journal.at(-1)!,expected=starKeyEncounterBudget(s),finance=starKeyFinanceSnapshot(s),week=s.week,date={...s.date};const transition=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:s.revision-1,pulse:'BILL',billAmount:0});expect(transition.eventId).toBeNull();
  const final=transition.state;s.cash=final.cash;s.debts=structuredClone(final.debts);s.missedWeeks=final.missedWeeks;s.credit=final.credit;s.nextLifeTier=final.nextLifeTier;s.lifeTier=final.nextLifeTier;s.week++;s.date=addGameWeeks(date,1);s.actionsRemaining=finance.weeklyBudget;s.pulse='NONE';s.billAmount=0;for(const receipt of transition.receipts)s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week,...receipt});s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week:s.week,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
  expect(starKeyCompletedBudgetMatches(s,expected,finance,week,date,entry.revision,entry.randomCursor,'沿普通路和平离开前庭')).toBe(true);expect(validateStarKeyEncounter(s)).toBe(true);const forged=structuredClone(s);forged.cash++;expect(validateStarKeyEncounter(forged)).toBe(false);expect(s.starKey.encounter.scene).toMatchObject({clockSeconds:8,playerTravelMetres:8,playerLocation:'OUTSIDE'});
 });
});
