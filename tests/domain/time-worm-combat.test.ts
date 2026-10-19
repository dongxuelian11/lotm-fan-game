import { describe,expect,it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { FATE_TROJAN_COUNT_WHEEL } from '../../src/domain/fate-trojan/combat.js';
import { createTimeWormEncounterState,applyTimeWormEncounterCommand,validateTimeWormEncounter,validateTimeWormEncounterCommand,projectTimeWormEncounter,settleTimeWormEncounter,combatBody,
 timeWormEncounterOriginalEvents,timeWormCompletedBudgetMatches,timeWormEncounterBudget,timeWormFinanceSnapshot,blockTimeWormEncounter,type TimeWormEncounterCommand,type TimeWormPolicy } from '../../src/domain/time-worm/encounter.js';
import { SHORT_TIME_THEFT,TIME_RELEASE,TIME_WORM_INHERITED_SKILL_IDS,TIME_WORM_NEW_ABILITY_IDS,TIME_WORM_COUNT_WHEEL,TIME_WORM_ENEMY_COUNT_WHEEL,TIME_WORM_ENEMY_ABILITY_WHEEL,TIME_WORM_COMBAT_CONSTANTS,
 timeWormActionCount,timeWormAbilityWheel,drawTimeWormEnemyAbility,currentTimeWormCombatSource,createTimeWormRuntime,declareTimeWormEnemyAction,resolveTimeWormPlayerSlot,resolveTimeWormEnemySlot,advanceTimeWormCombatClock,resolveTimeWormConsequences,replayTimeWormCombatRound,validTimeWormCombatSource,validateTimeWormCombatRound,validateTimeWormRoundOutcome,nextTimeWormCombatSource,projectTimeWormCombat,type TimeWormCombatSource } from '../../src/domain/time-worm/combat.js';

function context(s:SliceState):SeerContext{return{roll(){throw new Error('Encounter commands must not draw.');},check(){throw new Error('Encounter commands must not check.');},note(title,text){s.chronicle.push({id:`record-${s.revision+1}-${s.chronicle.length}`,week:s.week,title,text});}};}
/** Isolated current-schema constructor, never a rewritten historical fixture or
 * acquisition/campaign evidence. Actual source skill values exercise retention; this is not a natural capture. */
function readyUnit():SliceState {
 const s=createSliceRun('time-worm-isolated-combat',sliceDefaultCreationSelection,'time-worm-isolated-combat');
 s.activeEvent=null;s.eventQueue=[];s.chronicle=[];s.pulse='NONE';s.billAmount=0;s.revision=1009;s.week=201;s.date={epoch:'FIFTH_EPOCH',year:1353,month:4,day:28};
 s.cash=5280;s.actionsRemaining=3;s.health=100;s.mind=100;s.spirituality=120;s.injuries=[];s.injuryRisk=0;s.debts=[];
 s.character.coreStats={physique:28,perception:29,will:28,knowledge:24};s.progression.pathwayId='error';s.progression.sequence=1;s.progression.acting=100;
 const old=[41,49,57,41,8,8,8,0,16,33,8,8,8,8];s.progression.mastery=Object.fromEntries(TIME_WORM_INHERITED_SKILL_IDS.map((id,i)=>[id,old[i]!]));for(const id of TIME_WORM_NEW_ABILITY_IDS)s.progression.mastery[id]=0;
 s.timeWorm.promotionWeek=s.week;s.timeWorm.life.reflected=true;s.timeWorm.life.pending=null;s.timeWorm.life.activeCase=null;for(const c of Object.values(s.timeWorm.life.cases))c.status='RESOLVED';
 const site=s.fateTrojan.life.site;site.playerLocation='OUTSIDE';site.lina.location='OUTSIDE';site.victor.location='OUTSIDE';site.parcel.location='OUTSIDE';site.cabinet.open=false;site.cabinet.recognitionHolder='OWNER';site.link.holder='OWNER';site.link.returnPending=false;site.link.windowExpiresAt=null;site.fate.status='COMPLETED';site.fate.escrowPennies=0;site.fate.paidToPlayer=12;
 s.timeWorm.encounter=createTimeWormEncounterState();return s;
}
function encounter(s:SliceState,c:TimeWormEncounterCommand):SliceState{applyTimeWormEncounterCommand(s,c,context(s));s.revision++;return s;}
function fighting(policy:TimeWormPolicy='ALL'):SliceState {const s=readyUnit();encounter(s,{type:'ENCOUNTER_TALK'});encounter(s,{type:'ENCOUNTER_POLICY',policy});encounter(s,{type:'ENCOUNTER_FIGHT'});expect(validateTimeWormEncounter(s)).toBe(true);return s;}
function source(policy:TimeWormPolicy='ALL'):TimeWormCombatSource {const x=currentTimeWormCombatSource(fighting(policy));if(!x)throw new Error('Missing isolated source.');expect(validTimeWormCombatSource(x)).toBe(true);return x;}
/** Declared isolated checks, never substituted into a campaign or fixture. */
function random(...values:number[]):ActionRandomStream{let cursor=0;return{seed:'declared-isolated-slot',get cursor(){return cursor;},nextInt(min,max){const n=values[cursor++];if(n===undefined||n<min||n>max)throw new Error(`Unexpected isolated draw ${n} for ${min}..${max}`);return n;}};}
function commitRound(s:SliceState,stance:'ATTACK'|'RETREAT'='ATTACK'){
 const x=currentTimeWormCombatSource(s)!;const result=replayTimeWormCombatRound(x,stance),o=result.round.timeWormOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);Object.assign(s.timeWorm.encounter,combatBody(o));s.timeWorm.encounter.scene=structuredClone(o.rootAfter);s.timeWorm.encounter.materials=structuredClone(o.materialsAfter);
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;c.round++;s.lastCombatRound=result.round;s.random.cursor=o.randomCursorAfter;s.combatHistory.push(result.round);
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);else{settleTimeWormEncounter(s,result.outcome,context(s));if(result.outcome==='PLAYER_DEAD')s.status='DEAD';}s.revision++;return result;
}


describe('Time Worm independent encounter and actual Error source',()=>{
 it('preserves fourteen exact inherited values including the one zero and adds only two new skills',()=>{
  const x=source();expect(TIME_WORM_INHERITED_SKILL_IDS).toHaveLength(14);expect(Object.keys(x.mastery)).toHaveLength(16);expect(TIME_WORM_INHERITED_SKILL_IDS.map(id=>x.mastery[id])).toEqual([41,49,57,41,8,8,8,0,16,33,8,8,8,8]);expect(x.mastery[SHORT_TIME_THEFT]).toBe(0);expect(x.mastery[TIME_RELEASE]).toBe(0);
 });
 it('inherits the actual Fate Trojan count wheel, core weights, tier/floor and finite resource scale',()=>{
  expect(TIME_WORM_COUNT_WHEEL).toBe(FATE_TROJAN_COUNT_WHEEL);expect(TIME_WORM_ENEMY_COUNT_WHEEL).toBe(FATE_TROJAN_COUNT_WHEEL);expect(TIME_WORM_COUNT_WHEEL.map(x=>x.weight)).toEqual([10,15,25,25,15,10]);
  for(const [roll,count]of [[1,1],[10,1],[11,2],[25,2],[26,3],[50,3],[51,4],[75,4],[76,5],[90,5],[91,6],[100,6]])expect(timeWormActionCount(roll!)).toBe(count);
  expect(TIME_WORM_COMBAT_CONSTANTS).toMatchObject({weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,windowSeconds:3,slotSeconds:1});expect(timeWormAbilityWheel(readyUnit(),null).reduce((n,a)=>n+a.weight,0)).toBeCloseTo(100);
  let n=0;for(const e of TIME_WORM_ENEMY_ABILITY_WHEEL){expect(drawTimeWormEnemyAbility(random(n+1))).toBe(e.id);n+=e.weight;expect(drawTimeWormEnemyAbility(random(n))).toBe(e.id);}expect(n).toBe(100);
 });
 it('hides a new identity until contact and requires every original adult to have really left',()=>{
  const uncontacted=readyUnit();expect(projectTimeWormEncounter(uncontacted).enemy.name).toBeNull();expect(projectTimeWormCombat(uncontacted).enemyName).toBeNull();expect(projectTimeWormEncounter(uncontacted).story).not.toContain('艾德里安');expect(projectTimeWormEncounter(uncontacted).actions[0]!.label).not.toContain('艾德里安');
  for(const mutate of [(s:SliceState)=>{s.fateTrojan.life.site.lina.location='DESK';},(s:SliceState)=>{s.fateTrojan.life.site.victor.location='CABINET';},(s:SliceState)=>{s.fateTrojan.life.site.playerLocation='ENTRY';},(s:SliceState)=>{s.fateTrojan.life.site.parcel.location='CABINET';},(s:SliceState)=>{s.fateTrojan.life.site.link.returnPending=true;},(s:SliceState)=>{s.fateTrojan.life.site.cabinet.open=true;},(s:SliceState)=>{s.timeWorm.life.reflected=false;}]){const s=readyUnit();mutate(s);expect(blockTimeWormEncounter(s,{type:'ENCOUNTER_TALK'})).not.toBeNull();}
  const s=readyUnit(),old=structuredClone(s.fateTrojan),thomas=structuredClone(s.parasite);encounter(s,{type:'ENCOUNTER_TALK'});expect(()=>encounter(s,{type:'ENCOUNTER_FIGHT'})).toThrow();const p=projectTimeWormEncounter(s);expect(p.enemy).toMatchObject({id:'TW1-ADRIAN',name:'艾德里安·凯斯',age:45,health:100,mind:100,spirituality:120});expect(p.materials.marks).toHaveLength(3);expect(p.materials.weapon).toMatchObject({owner:'TW1-ADRIAN',massKg:2});expect(p.scene).toMatchObject({playerCoordinate:4,enemyCoordinate:6,clockSeconds:4,playerTravelMetres:4,presentMemberIds:[]});expect(s.fateTrojan).toEqual(old);expect(s.parasite).toEqual(thomas);
  encounter(s,{type:'LEAVE_ENCOUNTER'});expect(s.timeWorm.encounter.scene).toMatchObject({playerLocation:'OUTSIDE',clockSeconds:8,playerTravelMetres:8});expect(validateTimeWormEncounter(s)).toBe(true);expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('rejects changed original roots, recycled Elias, extra fields and fabricated resources',()=>{
  expect(validateTimeWormEncounterCommand({type:'ENCOUNTER_FIGHT',target:'FT2-ELIAS'})).toBe(false);expect(validateTimeWormEncounterCommand({type:'ENCOUNTER_POLICY',policy:'ALL',extra:true})).toBe(false);
  for(const mutate of [(x:TimeWormCombatSource)=>{(x as unknown as{targetId:string}).targetId='FT2-ELIAS';},(x:TimeWormCombatSource)=>{x.mastery['error.s5.thought-theft']=8;},(x:TimeWormCombatSource)=>{x.materials.marks.pop();},(x:TimeWormCombatSource)=>{x.root.presentMemberIds.push('FT2-LINA');},(x:TimeWormCombatSource)=>{x.randomSeed='replacement';},(x:TimeWormCombatSource)=>{x.body.enemySpirituality++;}]){const x=source();mutate(x);expect(validTimeWormCombatSource(x)).toBe(false);}
  const s=fighting();s.fateTrojan.life.site.parcel.ordinaryMetres++;expect(currentTimeWormCombatSource(s)).toBeNull();expect(validateTimeWormEncounter(s)).toBe(false);
 });
});

describe('future-only paid three-second target delay and conserved personal reserve',()=>{
 it('requires a visible pending action, pays 8S2M, then starts an actual three-second hold after its one-second cast',()=>{
  const x=source(),r=createTimeWormRuntime(x);expect(resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,0,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE'});const p=declareTimeWormEnemyAction(x,r,'BODY_MARK',0),before=r.root.clockSeconds;
  const a=resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,1,random(1,100));expect(a).toMatchObject({paidCost:8,mindCost:2,selfGain:0,enemyReduction:0,finiteResult:'PENDING',elapsedSeconds:1,check:{ability:'perception',difficulty:18}});expect(r.root.clockSeconds).toBe(before+1);expect(r.pendingEnemyAction).toMatchObject({id:p.id,status:'DELAYED',heldFrom:before+1,dueAt:before+4,delayedBySeconds:3});expect(r.windows.shortTimeTheft!.expiresAt-r.windows.shortTimeTheft!.createdAt).toBe(3);expect(r.mastery).toEqual(x.mastery);
  const enemy=resolveTimeWormEnemySlot(x,r,'BODY_MARK',2,random());expect(enemy.atSeconds).toBe(before+4);expect(enemy).toMatchObject({selfGain:45,rawContribution:75,attackKind:'BODY',threatens:true,masteryApplied:[SHORT_TIME_THEFT],targetDelay:{targetActionId:p.id,delayedBySeconds:3,reduction:30}});expect(r.waits).toEqual([{fromSeconds:before+1,toSeconds:before+4,seconds:3,reason:'DELAYED_ENEMY',targetActionId:p.id}]);
 });
 it('uses only the actual stolen reserve, pays release costs, and consumes aid only on a real ordinary strike',()=>{
  const x=source(),r=createTimeWormRuntime(x);expect(resolveTimeWormPlayerSlot(x,r,TIME_RELEASE,0,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE'});declareTimeWormEnemyAction(x,r,'MENTAL_MARK',0);resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,1,random(1,100));const due=r.pendingEnemyAction!.dueAt;
  const release=resolveTimeWormPlayerSlot(x,r,TIME_RELEASE,2,random(1));expect(release).toMatchObject({paidCost:6,mindCost:2,selfGain:0,enemyReduction:0,finiteResult:'PENDING',check:{ability:'will',difficulty:18},masteryApplied:[]});expect(r.windows.shortTimeTheft).toBeNull();expect(r.pendingEnemyAction!.dueAt).toBe(due);expect(r.mastery).toEqual(x.mastery);
  const strike=resolveTimeWormPlayerSlot(x,r,'STRIKE',3,random());expect(strike.completedAtSeconds).toBeLessThan(due);expect(strike.selfGain).toBe(strike.rawContribution+30);expect(strike.masteryApplied).toEqual([TIME_RELEASE]);expect(r.windows.timeRelease).toBeNull();expect(r.pendingEnemyAction!.dueAt).toBe(due);
  const enemy=resolveTimeWormEnemySlot(x,r,'MENTAL_MARK',4,random());expect(enemy.atSeconds).toBe(due);expect(enemy.selfGain).toBe(35);expect(enemy.masteryApplied).toEqual([SHORT_TIME_THEFT]);expect(r.playerS).toBe(x.playerSpirituality-14);expect(r.playerM).toBe(x.playerMind-4);
 });
 it('a strike completing exactly at dueAt is too late, with no refund or release mastery',()=>{
  const x=source(),r=createTimeWormRuntime(x);declareTimeWormEnemyAction(x,r,'BODY_MARK',0);resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,0,random(1,100));resolveTimeWormPlayerSlot(x,r,TIME_RELEASE,1,random(1));resolveTimeWormPlayerSlot(x,r,'BLOCK',2,random());const due=r.pendingEnemyAction!.dueAt;
  const strike=resolveTimeWormPlayerSlot(x,r,'STRIKE',3,random());expect(strike.completedAtSeconds).toBe(due);expect(strike.selfGain).toBe(strike.rawContribution);expect(strike.masteryApplied).toEqual([]);expect(r.windows.timeRelease).toBeNull();expect(r.mastery[TIME_RELEASE]).toBe(0);expect(r.playerS).toBe(x.playerSpirituality-14);
 });
 it('never changes an earlier contribution, damage, injury or original mastery when it merely opens a window',()=>{
  const x=source(),r=createTimeWormRuntime(x),old=resolveTimeWormPlayerSlot(x,r,'STRIKE',0,random()),copy=structuredClone(old),health=r.playerH;declareTimeWormEnemyAction(x,r,'BODY_MARK',0);resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,1,random(1,100));expect(old).toEqual(copy);expect(r.playerH).toBe(health);expect(r.mastery).toEqual(x.mastery);expect(x.playerInjuries).toEqual(source().playerInjuries);
 });
 it('retains paid failed/resisted theft costs and never permits another same-round attempt',()=>{
  for(const rolls of [[100],[1,30]]){const x=source(),r=createTimeWormRuntime(x);declareTimeWormEnemyAction(x,r,'BODY_MARK',0);const a=resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,0,random(...rolls));expect(a).toMatchObject({paidCost:8,mindCost:2});expect(['FAILED','RESISTED']).toContain(a.finiteResult);expect(r.windows.shortTimeTheft).toBeNull();expect(r.pendingEnemyAction!.status).toBe('PENDING');expect(resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,1,random())).toMatchObject({paidCost:0,finiteResult:'ALREADY_ATTEMPTED'});expect(r.mastery).toEqual(x.mastery);}
 });
 it('failed release consumes only that reserve and preserves the original target delay and costs',()=>{
  const x=source(),r=createTimeWormRuntime(x);declareTimeWormEnemyAction(x,r,'MENTAL_MARK',0);resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,0,random(1,100));const due=r.pendingEnemyAction!.dueAt;expect(resolveTimeWormPlayerSlot(x,r,TIME_RELEASE,1,random(100))).toMatchObject({paidCost:6,mindCost:2,finiteResult:'FAILED',masteryApplied:[]});expect(r.windows).toEqual({shortTimeTheft:null,timeRelease:null});expect(r.pendingEnemyAction!.dueAt).toBe(due);expect(resolveTimeWormPlayerSlot(x,r,TIME_RELEASE,2,random())).toMatchObject({paidCost:0,finiteResult:'ALREADY_ATTEMPTED'});expect(resolveTimeWormEnemySlot(x,r,'MENTAL_MARK',3,random()).atSeconds).toBe(due);expect(r.mastery[TIME_RELEASE]).toBe(0);
 });
 it('ordinary clock expiry destroys reserve without cancelling already imposed target delay',()=>{
  const x=source(),r=createTimeWormRuntime(x);declareTimeWormEnemyAction(x,r,'BODY_MARK',0);resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,0,random(1,100));const due=r.pendingEnemyAction!.dueAt;advanceTimeWormCombatClock(r,3);expect(r.root.clockSeconds).toBe(due);expect(r.windows.shortTimeTheft).toBeNull();expect(resolveTimeWormPlayerSlot(x,r,TIME_RELEASE,1,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE'});expect(r.pendingEnemyAction!.dueAt).toBe(due);expect(r.playerS).toBe(x.playerSpirituality-8);
 });
 it('cancelled visibility/position invalidates unused reserve without rewinding actual clock',()=>{
  for(const change of [(r:ReturnType<typeof createTimeWormRuntime>)=>{r.root.visibleBodyLine=false;},(r:ReturnType<typeof createTimeWormRuntime>)=>{r.root.enemyCoordinate=7;},(r:ReturnType<typeof createTimeWormRuntime>)=>{r.root.playerLocation='OUTSIDE';r.root.playerCoordinate=0;}]){const x=source(),r=createTimeWormRuntime(x);declareTimeWormEnemyAction(x,r,'BODY_MARK',0);resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,0,random(1,100));const due=r.pendingEnemyAction!.dueAt;change(r);expect(resolveTimeWormPlayerSlot(x,r,TIME_RELEASE,1,random()).paidCost).toBe(0);expect(r.windows.shortTimeTheft).toBeNull();expect(r.pendingEnemyAction!.dueAt).toBe(due);expect(r.playerS).toBe(x.playerSpirituality-8);expect(r.mastery).toEqual(x.mastery);}
 });
 it('FEINT is a paid one-metre actual move once per round; it never grants an extra action or mastery',()=>{
  const x=source(),r=createTimeWormRuntime(x);declareTimeWormEnemyAction(x,r,'FEINT',0);resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,0,random(1,100));const due=r.pendingEnemyAction!.dueAt;const feint=resolveTimeWormEnemySlot(x,r,'FEINT',1,random());expect(feint).toMatchObject({paidCost:3,travelPath:[6,7],travelMetres:1,masteryApplied:[],targetDelay:{dueAt:due,reduction:0}});expect(r.root).toMatchObject({enemyCoordinate:7,conditionVersion:2,visibleBodyLine:false,enemyTravelMetres:1});expect(r.windows.shortTimeTheft).toBeNull();expect(resolveTimeWormPlayerSlot(x,r,'OBSERVE',2,random())).toMatchObject({travelMetres:2,lateralTravelPath:[0,1,0]});expect(resolveTimeWormEnemySlot(x,r,'FEINT',3,random())).toMatchObject({selectedAbility:'OBSERVE',paidCost:0});
 });
 it('policies are honest about the paid theft dependency, and insufficient resources never pay or cast',()=>{
  for(const policy of ['ORDINARY','INHERITED_ONLY'] as const){const x=source(policy),r=createTimeWormRuntime(x);declareTimeWormEnemyAction(x,r,'MENTAL_MARK',0);for(const id of [SHORT_TIME_THEFT,TIME_RELEASE])expect(resolveTimeWormPlayerSlot(x,r,id,0,random())).toMatchObject({paidCost:0,selectedAbility:'BLOCK'});}
  const x=source('SHORT_TIME_THEFT'),r=createTimeWormRuntime(x);declareTimeWormEnemyAction(x,r,'MENTAL_MARK',0);resolveTimeWormPlayerSlot(x,r,SHORT_TIME_THEFT,0,random(1,100));expect(resolveTimeWormPlayerSlot(x,r,TIME_RELEASE,1,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE'});
  const y=source('TIME_RELEASE'),q=createTimeWormRuntime(y);declareTimeWormEnemyAction(y,q,'MENTAL_MARK',0);expect(resolveTimeWormPlayerSlot(y,q,SHORT_TIME_THEFT,0,random(1,100)).paidCost).toBe(8);expect(resolveTimeWormPlayerSlot(y,q,TIME_RELEASE,1,random(1)).paidCost).toBe(6);
  for(const field of ['playerS','playerM'] as const){const z=source(),t=createTimeWormRuntime(z);t[field]=field==='playerS'?7:2;declareTimeWormEnemyAction(z,t,'BODY_MARK',0);expect(resolveTimeWormPlayerSlot(z,t,SHORT_TIME_THEFT,0,random())).toMatchObject({paidCost:0,mindCost:0,finiteResult:'INSUFFICIENT'});expect(t.body.shortTimeTheftAttempts).toBe(0);}
 });
});

describe('finite independent resources, actual consequences and exact replay',()=>{
 it('consumes the same three owned seals across both marks, then falls back to the original club',()=>{
  const x=source(),r=createTimeWormRuntime(x);for(const intent of ['BODY_MARK','MENTAL_MARK','BODY_MARK'] as const)resolveTimeWormEnemySlot(x,r,intent,0,random());expect(r.materials.marks.map(m=>m.status)).toEqual(['SPENT','SPENT','SPENT']);expect(r.body.enemySpirituality).toBe(99);expect(resolveTimeWormEnemySlot(x,r,'MENTAL_MARK',3,random())).toMatchObject({selectedAbility:'BODY_STRIKE',paidCost:0,consumedMarkId:null,selfGain:20});expect(r.materials.weapon.id).toBe('TW1-ADRIAN-CLUB');expect(r.body.enemySpirituality).toBe(99);
 });
 it('keeps deep-deception actual predecessor cost/check/reduction and never invents other inherited conditions',()=>{
  const x=source(),r=createTimeWormRuntime(x);expect(resolveTimeWormPlayerSlot(x,r,'error.s3.deep-deception',0,random(1))).toMatchObject({paidCost:6,check:{ability:'knowledge',difficulty:18},enemyReduction:30,masteryApplied:['error.s3.deep-deception'],finiteResult:'APPLIED'});const failed=createTimeWormRuntime(x);expect(resolveTimeWormPlayerSlot(x,failed,'error.s3.deep-deception',0,random(100))).toMatchObject({paidCost:6,masteryApplied:[],finiteResult:'FAILED'});
  const q=createTimeWormRuntime(x);for(const id of TIME_WORM_INHERITED_SKILL_IDS.filter(id=>id!=='error.s3.deep-deception'))expect(resolveTimeWormPlayerSlot(x,q,id,0,random())).toMatchObject({paidCost:0,masteryApplied:[],finiteResult:'UNAVAILABLE',selfGain:0,enemyReduction:0});expect(q.mastery).toEqual(x.mastery);expect(q.materials).toEqual(x.materials);
 });
 it('BODY_MARK is physical and can kill; MENTAL_MARK cannot roll a physical death',()=>{
  const x=source(),r=createTimeWormRuntime(x),mental=resolveTimeWormEnemySlot(x,r,'MENTAL_MARK',0,random());expect(mental).toMatchObject({attackKind:'MENTAL',mentalPressure:true,threatens:false});expect(resolveTimeWormConsequences(x,r,[],[mental],'ENEMY','NONE',random())).toMatchObject({playerHealth:100,playerRisk:x.playerRisk,playerInjuries:x.playerInjuries,consequenceDomain:'MENTAL',consequenceWeights:null});expect(r.playerM).toBe(90);
  const q=createTimeWormRuntime(x),body=resolveTimeWormEnemySlot(x,q,'BODY_MARK',0,random());expect(body).toMatchObject({attackKind:'BODY',mentalPressure:false,threatens:true});expect(resolveTimeWormConsequences(x,q,[],[body],'ENEMY','NONE',random(100))).toMatchObject({outcome:'PLAYER_DEAD',playerHealth:0,consequenceDomain:'BODY',consequenceWeights:{light:65,heavy:30,death:5}});
 });
 it('mental depletion retreats alive with no physical recovery or rewritten wounds',()=>{
  const x=source(),r=createTimeWormRuntime(x);r.playerM=10;const mental=resolveTimeWormEnemySlot(x,r,'MENTAL_MARK',0,random());expect(resolveTimeWormConsequences(x,r,[],[mental],'ENEMY','NONE',random())).toMatchObject({outcome:'RETREATED',playerHealth:100,playerInjuries:x.playerInjuries});expect(r.playerM).toBe(0);
 });
 it('replays the same seed/cursor and exact action timing, costs, waits, bodies and mastery',()=>{
  const x=source(),before=structuredClone(x),result=replayTimeWormCombatRound(x,'ATTACK'),o=result.round.timeWormOutcome!;expect(x).toEqual(before);expect(validateTimeWormCombatRound(result.round)).toBe(true);expect(validateTimeWormRoundOutcome(o)).toBe(true);expect(o.rootAfter.clockSeconds).toBe(x.root.clockSeconds+60);expect(o.windowsAfter).toEqual({shortTimeTheft:null,timeRelease:null});const actions=[...o.playerActions,...o.enemyActions].sort((a,b)=>a.order-b.order);expect(actions.every(a=>a.elapsedSeconds===1&&a.completedAtSeconds===a.atSeconds+1)).toBe(true);expect(actions.length).toBe(result.round.playerCount+result.round.enemyCount);expect(actions.length+o.waits.reduce((n,w)=>n+w.seconds,0)).toBe(60);
  for(const mutate of [(v:typeof o)=>{v.randomCursorAfter++;},(v:typeof o)=>{v.playerSpiritualityAfter++;},(v:typeof o)=>{v.materialsAfter.marks[0]!.id='FORGED';},(v:typeof o)=>{v.rootAfter.playerTravelMetres++;},(v:typeof o)=>{v.masteryAfter[SHORT_TIME_THEFT]!+=8;},(v:typeof o)=>{v.playerActions[0]!.completedAtSeconds++;},(v:typeof o)=>{v.waits.at(-1)!.seconds++;}]){const f=structuredClone(o);mutate(f);expect(validateTimeWormRoundOutcome(f)).toBe(false);}
  if(o.continuing){const next=nextTimeWormCombatSource(o);expect(next.playerSpirituality).toBe(Math.min(120,o.playerSpiritualityAfter+12));expect(validTimeWormCombatSource(next)).toBe(true);}
 });
 it('retains every old Error root and history through terminal bodily consequences and ordinary exit',()=>{
  const s=fighting(),keys=['marauder','swindler','cryptologist','fireThief','dreamStealer','parasite','deceitMentor','fateTrojan'] as const,roots=keys.map(k=>structuredClone(s[k])),history=structuredClone(s.combatHistory);let n=0;
  while(s.combat&&n++<128){commitRound(s);expect(validateTimeWormEncounter(s)).toBe(true);}expect(s.combat).toBeNull();expect(s.timeWorm.encounter.terminal).not.toBeNull();keys.forEach((k,i)=>expect(s[k]).toEqual(roots[i]));expect(s.combatHistory.slice(0,history.length)).toEqual(history);expect(timeWormEncounterOriginalEvents(s)).toEqual([]);
  const last=s.combatHistory.at(-1)!.timeWormOutcome!;expect(s.timeWorm.encounter.scene.playerTravelMetres).toBe(last.rootAfter.playerTravelMetres+(s.health>0?4:0));expect(s.timeWorm.encounter.scene.clockSeconds).toBe(last.rootAfter.clockSeconds+(s.health>0?4:0));expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('permits real zero-AP peaceful exit and validates exact shared weekly finance rather than free cash',()=>{
  const s=readyUnit();s.actionsRemaining=1;encounter(s,{type:'ENCOUNTER_TALK'});expect(s.actionsRemaining).toBe(0);expect(blockTimeWormEncounter(s,{type:'LEAVE_ENCOUNTER'})).toBeNull();expect(blockTimeWormEncounter(s,{type:'ENCOUNTER_FIGHT'})).not.toBeNull();expect(validateTimeWormEncounter(s)).toBe(true);encounter(s,{type:'LEAVE_ENCOUNTER'});
  const entry=s.timeWorm.encounter.journal.at(-1)!,expected=timeWormEncounterBudget(s),finance=timeWormFinanceSnapshot(s),week=s.week,date={...s.date};const transition=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:s.revision-1,pulse:'BILL',billAmount:0});expect(transition.eventId).toBeNull();
  const final=transition.state;s.cash=final.cash;s.debts=structuredClone(final.debts);s.missedWeeks=final.missedWeeks;s.credit=final.credit;s.nextLifeTier=final.nextLifeTier;s.lifeTier=final.nextLifeTier;s.week++;s.date=addGameWeeks(date,1);s.actionsRemaining=finance.weeklyBudget;s.pulse='NONE';s.billAmount=0;for(const receipt of transition.receipts)s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week,...receipt});s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week:s.week,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
  expect(timeWormCompletedBudgetMatches(s,expected,finance,week,date,entry.revision,entry.randomCursor,'沿普通路和平离开前庭')).toBe(true);expect(validateTimeWormEncounter(s)).toBe(true);const forged=structuredClone(s);forged.cash++;expect(validateTimeWormEncounter(forged)).toBe(false);expect(s.timeWorm.encounter.scene).toMatchObject({clockSeconds:8,playerTravelMetres:8,playerLocation:'OUTSIDE'});
 });
});
