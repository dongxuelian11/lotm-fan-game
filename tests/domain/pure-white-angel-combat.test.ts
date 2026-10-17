import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { resolvePureWhiteAngelCombatRound } from '../../src/domain/slice/pure-white-angel-combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { LIGHT_SEEKER_COUNT_WHEEL } from '../../src/domain/light-seeker/combat.js';
import { PURE_WHITE_ANGEL_CASE_IDS } from '../../src/domain/pure-white-angel/life.js';
import { originalLightSeeker, promoted, pw, ready } from './pure-white-angel-directed-helper.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { applyPureWhiteAngelEncounterCommand, validatePureWhiteAngelEncounter,
  validatePureWhiteAngelEncounterCommand, projectPureWhiteAngelEncounter, settlePureWhiteAngelEncounter,
  pureWhiteAngelEncounterOriginalEvents, pureWhiteAngelCompletedBudgetMatches, pureWhiteAngelEncounterBudget,
  pureWhiteAngelFinanceSnapshot, blockPureWhiteAngelEncounter, type PureWhiteAngelEncounterCommand, type PureWhiteAngelPolicy } from '../../src/domain/pure-white-angel/encounter.js';
import { FOCUSED_PURIFICATION, WARM_RADIANCE_GUARD, PURE_WHITE_ANGEL_INHERITED_SKILL_IDS, PURE_WHITE_ANGEL_NEW_ABILITY_IDS,
  PURE_WHITE_ANGEL_COUNT_WHEEL, PURE_WHITE_ANGEL_ENEMY_COUNT_WHEEL, PURE_WHITE_ANGEL_ENEMY_ABILITY_WHEEL, PURE_WHITE_ANGEL_COMBAT_CONSTANTS,
  pureWhiteAngelActionCount, pureWhiteAngelAbilityWheel, drawPureWhiteAngelEnemyAbility, currentPureWhiteAngelCombatSource,
  createPureWhiteAngelRuntime, declarePureWhiteAngelEnemyAction, resolvePureWhiteAngelPlayerSlot, resolvePureWhiteAngelEnemySlot,
  advancePureWhiteAngelCombatClock, resolvePureWhiteAngelConsequences, replayPureWhiteAngelCombatRound,
  validPureWhiteAngelCombatSource, validatePureWhiteAngelCombatRound, validatePureWhiteAngelRoundOutcome,
  nextPureWhiteAngelCombatSource, type PureWhiteAngelCombatSource } from '../../src/domain/pure-white-angel/combat.js';

const path='tests/fixtures/light-seeker-v01720/natural.json';
function original():SliceState{return migrateSliceState(readObjectEntry<SliceState>(path,'final'));}
function context(s:SliceState):SeerContext{return{roll(){throw new Error('Encounter commands must not draw.');},check(){throw new Error('Encounter commands must not check.');},note(title,text){s.chronicle.push({id:`record-${s.revision+1}-${s.chronicle.length}`,week:s.week,title,text});}};}
let readyCache:SliceState|undefined;
/** Every preparation uses real public commands from the wounded729-command
 * original. No healed substitute, sequence assignment, seed or cursor edit. */
function readyUnit():SliceState {
 if(!readyCache){
  let s=promoted();
  for(const caseId of PURE_WHITE_ANGEL_CASE_IDS){
   s=pw(ready(s),{type:'OBSERVE',caseId});
   if(s.pureWhiteAngel.life.sample.purchasedWeek===null)s=pw(ready(s,{cash:40}),{type:'BUY_SAMPLE'});
   if(s.pureWhiteAngel.life.pad.purchasedWeek===null)s=pw(ready(s,{cash:20}),{type:'BUY_PAD'});
   s=ready(s,{ap:1,cash:10});s=pw(s,{type:'WALK_TO_GALLERY'});s=pw(s,{type:'INVITE',caseId,method:'ORDINARY'});
   for(const type of ['READ_SOURCE','ASK_SPIRIT','ACKNOWLEDGE_REFUSAL'] as const)s=pw(s,{type});
   s=pw(s,{type:'CONSENT',permission:'OWNER'});s=pw(s,{type:'CONSENT',permission:'TECHNICIAN'});s=pw(s,{type:'DECLINE_CONSENT',permission:'ABILITY'});
   s=pw(s,{type:'AGREE_RETURN'});s=pw(s,{type:'MOVE_TECHNICIAN_SIDE'});s=pw(s,{type:'ENTER_GALLERY'});
   if(caseId==='residue-trace'){for(const type of ['PLACE_SAMPLE','OBSERVE_SAMPLE','MANUAL_CONTAIN','RETRIEVE_SAMPLE'] as const)s=pw(s,{type});}
   else{
    s=pw(s,{type:'WEAR_PAD'});s=pw(s,{type:'DECLARE_IMPACT'});
    if(caseId==='screened-return'){s=pw(s,{type:'CHANGE_CONDITIONS'});s=pw(s,{type:'WITHDRAW_CONSENT',permission:'OWNER'});}
    s=pw(s,{type:'HANDLE_RESET'});if(caseId==='screened-return')s=pw(s,{type:'OPEN_SHUTTER'});s=pw(s,{type:'RETRIEVE_PAD'});
   }
   s=pw(s,{type:'EXIT_GALLERY'});s=pw(s,{type:'LEAVE'});s=pw(ready(s),{type:'REPORT',caseId});
  }
  s=pw(ready(s),{type:'REFLECT'});readyCache=ready(s,{ap:3,health:100,mind:100,spirituality:120,healed:true,cash:100});
 }
 return structuredClone(readyCache);
}
beforeAll(()=>{readyUnit();},180000);
function encounter(s:SliceState,c:PureWhiteAngelEncounterCommand):SliceState{applyPureWhiteAngelEncounterCommand(s,c,context(s));s.revision++;return s;}
function fighting(policy:PureWhiteAngelPolicy='ALL'):SliceState {
 const s=readyUnit();encounter(s,{type:'ENCOUNTER_TALK'});encounter(s,{type:'ENCOUNTER_POLICY',policy});encounter(s,{type:'ENCOUNTER_FIGHT'});
 expect(validatePureWhiteAngelEncounter(s)).toBe(true);return s;
}
function source(policy:PureWhiteAngelPolicy='ALL'):PureWhiteAngelCombatSource{const x=currentPureWhiteAngelCombatSource(fighting(policy));if(!x)throw new Error('Missing unit encounter source.');expect(validPureWhiteAngelCombatSource(x)).toBe(true);return x;}
function random(...values:number[]):ActionRandomStream{let i=0;return{seed:'pure-white-declared-slot-only',get cursor(){return i;},nextInt(min:number,max:number){const n=values[i++]??100;if(n<min||n>max)throw new Error(`Bad isolated draw ${n} outside ${min}..${max}`);return n;}};}
function tickRound(s:SliceState,stance:'ATTACK'|'CONTROL'|'RETREAT'='CONTROL'){
 const result=resolvePureWhiteAngelCombatRound(s,stance);s.combatHistory.push(result.round);
 if(result.outcome!=='CONTINUE'){settlePureWhiteAngelEncounter(s,result.outcome,context(s));if(result.outcome==='PLAYER_DEAD')s.status='DEAD';}
 s.revision++;return result;
}

describe('Pure White Angel exact independent original source',{timeout:120000},()=>{
 it('loads the actual wounded729-command source, preserves old death and migrates using shared current constants',()=>{
  expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe('0a06e9fa84a0b384aea3bf7bb79a7e72b2620ec113ad517bee2af14df35ae556');
  expect(readObjectEntry<unknown[]>(path,'commands')).toHaveLength(729);
  const s=original();expect(s).toMatchObject({schemaVersion:CURRENT_SCHEMA_VERSION,contentVersion:CURRENT_CONTENT_VERSION,revision:730,week:175,status:'ACTIVE',health:50,mind:100,spirituality:87,cash:540,actionsRemaining:3,injuryRisk:3,random:{seed:'bard-natural-v029',cursor:356},character:{name:'塞琳',gender:'FEMALE',age:26,coreStats:{physique:30,perception:26,will:29,knowledge:24}}});
  expect(s.injuries.map(i=>[i.severity,i.treatedRevision])).toEqual([['LIGHT',null],['LIGHT',null],['HEAVY',null]]);
  expect(s.lightSeeker.encounter).toMatchObject({targetId:'LS2-OWEN',status:'RESOLVED',enemyStatus:'DEAD',enemyHealth:0});expect(blockPureWhiteAngelEncounter(s,{type:'ENCOUNTER_TALK'})).not.toBeNull();
 });
 it('retains all20 original mastery values including5 zeros and all eight source roots',()=>{
  const old=originalLightSeeker(),s=promoted();expect(PURE_WHITE_ANGEL_INHERITED_SKILL_IDS).toHaveLength(20);expect(PURE_WHITE_ANGEL_INHERITED_SKILL_IDS.filter(id=>s.progression.mastery[id]===0)).toHaveLength(5);
  for(const id of PURE_WHITE_ANGEL_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(old.progression.mastery[id]);for(const id of PURE_WHITE_ANGEL_NEW_ABILITY_IDS)expect(s.progression.mastery[id]).toBe(0);
  for(const key of ['bard','lightprayer','sunpriest','notary','priestOfLight','unshadowed','justiceMentor','lightSeeker'] as const)expect(s.pureWhiteAngel.sourceHistory![key]).toEqual(old[key]);
  expect(s.pureWhiteAngel.sourceScene!.originals).toEqual(old.lightSeeker.life.site);expect(s.pureWhiteAngel.sourceScene!.originals).toMatchObject({id:'LS2-GALLERY',elapsedSeconds:976,playerLocation:'ENTRY',playerMetres:94,operatorEnergy:90,spiritEnergy:96,shutter:{state:'OPEN',durability:81,operations:19},lamp:{oil:3}});
 });
 it('uses exact inherited count boundaries, actual displayed enemy wheel and unchanged strength model',()=>{
  expect(PURE_WHITE_ANGEL_COUNT_WHEEL).toBe(LIGHT_SEEKER_COUNT_WHEEL);expect(PURE_WHITE_ANGEL_ENEMY_COUNT_WHEEL).toBe(LIGHT_SEEKER_COUNT_WHEEL);expect(PURE_WHITE_ANGEL_COUNT_WHEEL.map(x=>x.weight)).toEqual([10,15,25,25,15,10]);
  for(const [roll,count]of [[1,1],[10,1],[11,2],[25,2],[26,3],[50,3],[51,4],[75,4],[76,5],[90,5],[91,6],[100,6]])expect(pureWhiteAngelActionCount(roll!)).toBe(count);
  expect(PURE_WHITE_ANGEL_COMBAT_CONSTANTS).toMatchObject({weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,slotSeconds:5,roundSeconds:60});
  expect(PURE_WHITE_ANGEL_ENEMY_ABILITY_WHEEL.map(x=>[x.id,x.weight])).toEqual([['LIGHT_STRIKE',25],['LIGHT_WARD',20],['DAZZLING_PRESSURE',20],['BODY_STRIKE',20],['OBSCURE',10],['ACCIDENT',5]]);
  let boundary=0;for(const entry of PURE_WHITE_ANGEL_ENEMY_ABILITY_WHEEL){const first=boundary+1;boundary+=entry.weight;expect(drawPureWhiteAngelEnemyAbility(random(first))).toBe(entry.id);expect(drawPureWhiteAngelEnemyAbility(random(boundary))).toBe(entry.id);}
  expect(pureWhiteAngelAbilityWheel(readyUnit(),null).reduce((n,a)=>n+a.weight,0)).toBeCloseTo(100);
 });
 it('walks4m to independent49-year-old Silas, demands policy and keeps all adults out',()=>{
  const s=readyUnit(),site=structuredClone(s.lightSeeker.life.site);expect(()=>encounter(s,{type:'ENCOUNTER_FIGHT'})).toThrow();encounter(s,{type:'ENCOUNTER_TALK'});expect(()=>encounter(s,{type:'ENCOUNTER_FIGHT'})).toThrow();
  const p=projectPureWhiteAngelEncounter(s);expect(p.enemy).toMatchObject({id:'PW1-SILAS-DANE',age:49,sequence:1,health:100,mind:100,spirituality:120});expect(p.scene).toMatchObject({playerLocation:'FORECOURT',playerCoordinate:4,enemyCoordinate:6,clockSeconds:4,playerTravelMetres:4,presentMemberIds:[]});expect(p.materials.weapon).toMatchObject({id:'PW1-SILAS-ROD',owner:'PW1-SILAS-DANE',massKg:2,charge:4});expect(p.materials.screen).toMatchObject({hood:'OPEN',durability:100,operations:0});
  encounter(s,{type:'ENCOUNTER_POLICY',policy:'ORDINARY'});encounter(s,{type:'LEAVE_ENCOUNTER'});expect(s.pureWhiteAngel.encounter.scene).toMatchObject({playerLocation:'OUTSIDE',playerCoordinate:0,clockSeconds:8,playerTravelMetres:8});expect(validatePureWhiteAngelEncounter(s)).toBe(true);expect(s.lightSeeker.life.site).toEqual(site);expect(pureWhiteAngelEncounterOriginalEvents(s)).toEqual([]);expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('rejects present adults, forged original target/history, future data and extra command fields',()=>{
  for(const mutate of [(s:SliceState)=>{s.pureWhiteAngel.life.maraPresent=true;},(s:SliceState)=>{s.pureWhiteAngel.life.ivan.present=true;},(s:SliceState)=>{s.pureWhiteAngel.life.playerLocation='ENTRY';}]){const s=readyUnit();mutate(s);expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();}
  for(const c of [{type:'ENCOUNTER_POLICY',policy:'ALL',extra:true},{type:'ENCOUNTER_FIGHT',target:'LS2-OWEN'},{type:'BUY_BATTLE_PLATE'}])expect(validatePureWhiteAngelEncounterCommand(c)).toBe(false);
  for(const mutate of [(x:PureWhiteAngelCombatSource)=>{(x as unknown as {targetId:string}).targetId='LS2-OWEN';},(x:PureWhiteAngelCombatSource)=>{x.mastery['sun.s8.ritual']!++;},(x:PureWhiteAngelCombatSource)=>{x.materials.weapon.charge=3;},(x:PureWhiteAngelCombatSource)=>{x.root.presentMemberIds.push('LS2-MARA');},(x:PureWhiteAngelCombatSource)=>{x.preparation.week=x.week+1;},(x:PureWhiteAngelCombatSource)=>{x.randomSeed='replacement';},(x:PureWhiteAngelCombatSource)=>{x.materials.screen.operations++;}]){const x=source();mutate(x);expect(validPureWhiteAngelCombatSource(x)).toBe(false);}
  const s=fighting();s.pureWhiteAngel.encounter.originalHistory![0]!.playerAdvantage++;expect(validatePureWhiteAngelEncounter(s)).toBe(false);
 });
});

describe('future-only finite windows with real player costs',{timeout:120000},()=>{
 it('opens focused purification with no immediate reward and adds30 to one subsequent threatening attack',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x),old=resolvePureWhiteAngelPlayerSlot(x,r,'STRIKE',0,random()),copy=structuredClone(old),open=resolvePureWhiteAngelPlayerSlot(x,r,FOCUSED_PURIFICATION,1,random(1,100));
  expect(open).toMatchObject({paidCost:8,mindCost:2,selfGain:0,enemyReduction:0,finiteResult:'PENDING',check:{ability:'will',difficulty:18},elapsedSeconds:5});expect(r.mastery).toEqual(x.mastery);
  const block=resolvePureWhiteAngelPlayerSlot(x,r,'BLOCK',2,random());expect(block.masteryApplied).toEqual([]);expect(r.windows.focusedPurification).not.toBeNull();
  const next=resolvePureWhiteAngelPlayerSlot(x,r,'STRIKE',3,random());expect(next.selfGain).toBe(next.rawContribution+30);expect(next.masteryApplied).toEqual([FOCUSED_PURIFICATION]);expect(old).toEqual(copy);expect(r.windows.focusedPurification).toBeNull();expect(resolvePureWhiteAngelPlayerSlot(x,r,'STRIKE',4,random()).selfGain).toBe(next.rawContribution);
 });
 it('does not turn a failed later inherited attack into a successful application',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x);resolvePureWhiteAngelPlayerSlot(x,r,FOCUSED_PURIFICATION,0,random(1,100));expect(resolvePureWhiteAngelPlayerSlot(x,r,'sun.s4.purification',1,random(100))).toMatchObject({paidCost:6,selfGain:0,finiteResult:'FAILED',masteryApplied:[]});expect(r.mastery).toEqual(x.mastery);advancePureWhiteAngelCombatClock(r,30);expect(r.windows.focusedPurification).toBeNull();
 });
 it('failed and resisted openings pay once; same-round retries and insufficiency cannot farm rolls',()=>{
  for(const rolls of [[100],[1,30]]){const x=source(),r=createPureWhiteAngelRuntime(x),a=resolvePureWhiteAngelPlayerSlot(x,r,FOCUSED_PURIFICATION,0,random(...rolls));expect(a).toMatchObject({paidCost:8,mindCost:2});expect(['FAILED','RESISTED']).toContain(a.finiteResult);expect(r.windows.focusedPurification).toBeNull();expect(r.mastery).toEqual(x.mastery);expect(resolvePureWhiteAngelPlayerSlot(x,r,FOCUSED_PURIFICATION,1,random())).toMatchObject({finiteResult:'ALREADY_ATTEMPTED',paidCost:0,selectedAbility:'BLOCK'});}
  const x=source(),r=createPureWhiteAngelRuntime(x);r.playerS=7;expect(resolvePureWhiteAngelPlayerSlot(x,r,FOCUSED_PURIFICATION,0,random())).toMatchObject({finiteResult:'INSUFFICIENT',paidCost:0,mindCost:0});expect(r.body.focusedPurificationAttempts).toBe(0);r.playerS=120;r.playerM=2;expect(resolvePureWhiteAngelPlayerSlot(x,r,FOCUSED_PURIFICATION,1,random()).paidCost).toBe(0);
 });
 it('guard opens against the seen original but never consumes on mental pressure',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x);expect(resolvePureWhiteAngelPlayerSlot(x,r,WARM_RADIANCE_GUARD,0,random(1,100))).toMatchObject({paidCost:6,mindCost:2,finiteResult:'PENDING',selfGain:0,check:{ability:'knowledge',difficulty:18}});
  expect(resolvePureWhiteAngelEnemySlot(x,r,'DAZZLING_PRESSURE',1,random(100))).toMatchObject({selfGain:65,attackKind:'MENTAL',mentalPressure:true,threatens:false,masteryApplied:[]});expect(r.windows.warmRadianceGuard).not.toBeNull();expect(r.mastery).toEqual(x.mastery);
  expect(resolvePureWhiteAngelEnemySlot(x,r,'BODY_STRIKE',2,random())).toMatchObject({rawContribution:20,selfGain:0,threatens:false,masteryApplied:[WARM_RADIANCE_GUARD]});expect(r.windows.warmRadianceGuard).toBeNull();
 });
 it('guard pays6S2M then reduces exactly one visible later BODY by30',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x);declarePureWhiteAngelEnemyAction(x,r,'LIGHT_STRIKE',0);expect(resolvePureWhiteAngelPlayerSlot(x,r,WARM_RADIANCE_GUARD,0,random(1,100))).toMatchObject({paidCost:6,mindCost:2,finiteResult:'PENDING',check:{ability:'knowledge',difficulty:18}});expect(r.mastery).toEqual(x.mastery);
  expect(resolvePureWhiteAngelEnemySlot(x,r,'LIGHT_STRIKE',1,random(100))).toMatchObject({selfGain:75,rawContribution:105,rodChargeSpent:1,masteryApplied:[WARM_RADIANCE_GUARD]});expect(resolvePureWhiteAngelEnemySlot(x,r,'LIGHT_STRIKE',2,random(100)).selfGain).toBe(105);expect(r.mastery[WARM_RADIANCE_GUARD]).toBe(x.mastery[WARM_RADIANCE_GUARD]!+8);
 });
 it('failed/resisted guard retains costs; resisted incoming BODY consumes no successful guard credit',()=>{
  for(const rolls of [[100],[1,1]]){const x=source(),r=createPureWhiteAngelRuntime(x);declarePureWhiteAngelEnemyAction(x,r,'LIGHT_STRIKE',0);expect(resolvePureWhiteAngelPlayerSlot(x,r,WARM_RADIANCE_GUARD,0,random(...rolls))).toMatchObject({paidCost:6,mindCost:2});expect(resolvePureWhiteAngelEnemySlot(x,r,'LIGHT_STRIKE',1,random(100)).selfGain).toBe(105);expect(r.mastery).toEqual(x.mastery);}
  const x=source(),r=createPureWhiteAngelRuntime(x);declarePureWhiteAngelEnemyAction(x,r,'LIGHT_STRIKE',0);resolvePureWhiteAngelPlayerSlot(x,r,WARM_RADIANCE_GUARD,0,random(1,100));expect(resolvePureWhiteAngelEnemySlot(x,r,'LIGHT_STRIKE',1,random(30))).toMatchObject({selfGain:0,paidCost:7,rodChargeSpent:1,finiteResult:'RESISTED',masteryApplied:[]});expect(r.windows.warmRadianceGuard).not.toBeNull();expect(r.mastery).toEqual(x.mastery);
 });
 it('expiry, condition changes, obscuration and departure invalidate windows without refunds',()=>{
  for(const change of [(r:ReturnType<typeof createPureWhiteAngelRuntime>)=>advancePureWhiteAngelCombatClock(r,30),(r:ReturnType<typeof createPureWhiteAngelRuntime>)=>{r.root.conditionVersion++;},(r:ReturnType<typeof createPureWhiteAngelRuntime>)=>{r.root.visibleBodyLine=false;},(r:ReturnType<typeof createPureWhiteAngelRuntime>)=>{r.root.playerLocation='OUTSIDE';r.root.playerCoordinate=0;}]){
   const x=source(),r=createPureWhiteAngelRuntime(x);resolvePureWhiteAngelPlayerSlot(x,r,FOCUSED_PURIFICATION,0,random(1,100));change(r);expect(resolvePureWhiteAngelPlayerSlot(x,r,'STRIKE',1,random()).masteryApplied).toEqual([]);expect(r.mastery).toEqual(x.mastery);expect(r.playerS).toBe(x.playerSpirituality-8);
  }
  const x=source(),r=createPureWhiteAngelRuntime(x);declarePureWhiteAngelEnemyAction(x,r,'LIGHT_STRIKE',0);resolvePureWhiteAngelPlayerSlot(x,r,WARM_RADIANCE_GUARD,0,random(1,100));advancePureWhiteAngelCombatClock(r,30);expect(resolvePureWhiteAngelEnemySlot(x,r,'LIGHT_STRIKE',1,random(100)).selfGain).toBe(105);expect(r.mastery).toEqual(x.mastery);
 });
 it('the same original hood actually closes and can be walked to and opened, without reopening old windows',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x);resolvePureWhiteAngelPlayerSlot(x,r,FOCUSED_PURIFICATION,0,random(1,100));expect(resolvePureWhiteAngelEnemySlot(x,r,'OBSCURE',1,random())).toMatchObject({paidCost:3,conditionVersionBefore:1,conditionVersionAfter:2,travelPath:[6,5,6]});expect(r.windows.focusedPurification).toBeNull();expect(r.materials.screen.hood).toBe('CLOSED');
  expect(resolvePureWhiteAngelPlayerSlot(x,r,'sun.s4.purification',2,random())).toMatchObject({finiteResult:'UNAVAILABLE',paidCost:0});const before=r.root.playerTravelMetres;expect(resolvePureWhiteAngelPlayerSlot(x,r,'OBSERVE',3,random())).toMatchObject({travelMetres:2,travelPath:[4,5,4]});expect(r.root).toMatchObject({playerCoordinate:4,playerTravelMetres:before+2,visibleBodyLine:true,conditionVersion:3,observedConditionVersion:3});expect(r.materials.screen).toMatchObject({id:'PW1-SILAS-SCREEN',hood:'OPEN',operations:2});expect(r.windows.focusedPurification).toBeNull();expect(resolvePureWhiteAngelEnemySlot(x,r,'OBSCURE',4,random())).toMatchObject({selectedAbility:'OBSERVE',paidCost:0});
 });
 it('ordinary/inherited-only policies preserve the explicit permission boundary',()=>{
  for(const policy of ['ORDINARY','INHERITED_ONLY'] as const){const x=source(policy),r=createPureWhiteAngelRuntime(x);declarePureWhiteAngelEnemyAction(x,r,'LIGHT_STRIKE',0);for(const id of [FOCUSED_PURIFICATION,WARM_RADIANCE_GUARD])expect(resolvePureWhiteAngelPlayerSlot(x,r,id,0,random())).toMatchObject({paidCost:0,selectedAbility:'BLOCK'});expect(r.mastery).toEqual(x.mastery);}
 });
});

describe('actual Sun original resources, injuries and deterministic recorded outcomes',{timeout:120000},()=>{
 it('old sample-free powers pay real original costs and gain only on actual successful application',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x),id='sun.s4.purification';expect(resolvePureWhiteAngelPlayerSlot(x,r,id,0,random(100))).toMatchObject({paidCost:6,selfGain:0,finiteResult:'FAILED',masteryApplied:[]});expect(r.mastery[id]).toBe(x.mastery[id]);
  const applied=resolvePureWhiteAngelPlayerSlot(x,r,id,1,random(1,100));expect(applied.paidCost).toBe(6);expect(applied.selfGain).toBe(34*(.65+.35*x.mastery[id]!/500));expect(applied.masteryApplied).toEqual([id]);expect(r.mastery[id]).toBe(x.mastery[id]!+8);
  for(const id of ['sun.s7.holy-water','sun.s6.signed-contract','sun.s5.purification-aura','sun.s4.sunflare','sun.s8.ritual'] as const)expect(resolvePureWhiteAngelPlayerSlot(x,r,id,2,random())).toMatchObject({paidCost:0,selfGain:0,masteryApplied:[],selectedAbility:'OBSERVE'});
 });
 it('retains actual S4 domain and S2 light costs, while pending notarization and limited light reward only later application',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x);
  expect(resolvePureWhiteAngelPlayerSlot(x,r,'sun.s4.unshadowed-domain',0,random(1,100))).toMatchObject({paidCost:5,attackKind:'NONE',check:{ability:'will',difficulty:16},masteryApplied:['sun.s4.unshadowed-domain']});
  expect(resolvePureWhiteAngelPlayerSlot(x,r,'sun.s6.notarization',1,random(1,100))).toMatchObject({paidCost:3,selfGain:0,masteryApplied:[],finiteResult:'PENDING',check:{ability:'knowledge',difficulty:14}});
  expect(resolvePureWhiteAngelPlayerSlot(x,r,'sun.s2.guided-radiance',2,random(1,100))).toMatchObject({paidCost:7,selfGain:105*1.15,check:{ability:'will',difficulty:20},masteryApplied:['sun.s6.notarization','sun.s2.guided-radiance']});
  expect(resolvePureWhiteAngelPlayerSlot(x,r,'sun.s2.limited-light',3,random(1,100))).toMatchObject({paidCost:6,selfGain:0,masteryApplied:[],finiteResult:'PENDING',check:{ability:'knowledge',difficulty:20}});
  expect(resolvePureWhiteAngelEnemySlot(x,r,'BODY_STRIKE',4,random()).selfGain).toBe(20);expect(r.windows.limitedLight).not.toBeNull();
  expect(resolvePureWhiteAngelEnemySlot(x,r,'LIGHT_STRIKE',5,random(100))).toMatchObject({selfGain:60,rawContribution:105,masteryApplied:['sun.s2.limited-light']});expect(r.windows.limitedLight).toBeNull();
 });
 it('enemy light ward is paid preparation, blocks one later real light and leaves ordinary blows alone',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x);expect(resolvePureWhiteAngelEnemySlot(x,r,'LIGHT_WARD',0,random(100))).toMatchObject({paidCost:6,enemyReduction:0,finiteResult:'PENDING'});
  const body=resolvePureWhiteAngelPlayerSlot(x,r,'STRIKE',1,random());expect(body.selfGain).toBe(x.clubHeld?16:12);expect(r.windows.enemyWard).not.toBeNull();
  expect(resolvePureWhiteAngelPlayerSlot(x,r,'sun.s2.guided-radiance',2,random(1,100))).toMatchObject({selfGain:45,rawContribution:105});expect(r.windows.enemyWard).toBeNull();
  expect(resolvePureWhiteAngelEnemySlot(x,r,'LIGHT_WARD',3,random())).toMatchObject({paidCost:0,selectedAbility:'OBSERVE'});
 });
 it('an opaque current hood blocks actual light and mental dazzle without inventing attacks or charges',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x);resolvePureWhiteAngelEnemySlot(x,r,'OBSCURE',0,random());
  for(const id of ['LIGHT_STRIKE','DAZZLING_PRESSURE'] as const)expect(resolvePureWhiteAngelEnemySlot(x,r,id,1,random())).toMatchObject({selectedAbility:'OBSERVE',paidCost:0,rodChargeSpent:0,selfGain:0,attackKind:'NONE'});
  expect(r.materials.weapon.charge).toBe(4);expect(r.body.enemySpirituality).toBe(117);expect(resolvePureWhiteAngelPlayerSlot(x,r,FOCUSED_PURIFICATION,2,random())).toMatchObject({finiteResult:'UNAVAILABLE',paidCost:0});
 });
 it('reports NONE for no actual threat and never increments body risk for mere scheduled slots',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x),none=resolvePureWhiteAngelEnemySlot(x,r,'ACCIDENT',0,random());
  expect(resolvePureWhiteAngelConsequences(x,r,[],[none],'ENEMY','NONE',random())).toMatchObject({consequenceDomain:'NONE',playerHealth:x.playerHealth,playerRisk:x.playerRisk,playerInjuries:x.playerInjuries,consequenceWeights:null,consequenceRoll:undefined});
 });
 it('uses a club only if genuinely HAND, and never supplies an item for free',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x);expect(resolvePureWhiteAngelPlayerSlot(x,r,'STRIKE',0,random()).selfGain).toBe(x.clubHeld?16:12);expect(Object.keys(r.materials).sort()).toEqual(['screen','weapon']);expect(Object.keys(r.materials.weapon)).not.toContain('player');
 });
 it('spends all4 original rod charges even on resistance, then falls back with the same body/rod',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x);for(let n=0;n<4;n++)expect(resolvePureWhiteAngelEnemySlot(x,r,'LIGHT_STRIKE',n,random(30))).toMatchObject({rodChargeSpent:1,chargePieceId:`PW1-SILAS-CHARGE-${n+1}`});expect(r.materials.weapon.pieces.map(p=>p.state)).toEqual(['SPENT','SPENT','SPENT','SPENT']);expect(r.materials.weapon.charge).toBe(0);expect(r.body.enemySpirituality).toBe(92);expect(resolvePureWhiteAngelEnemySlot(x,r,'LIGHT_STRIKE',4,random())).toMatchObject({selectedAbility:'BODY_STRIKE',paidCost:0,rodChargeSpent:0,travelPath:[6,4,6],travelMetres:4});expect(r.materials.weapon.id).toBe('PW1-SILAS-ROD');
 });
 it('enemy ward6, song7 and obscure3 are finite; depleted spirituality never regenerates',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x);expect(resolvePureWhiteAngelEnemySlot(x,r,'LIGHT_WARD',0,random(100))).toMatchObject({paidCost:6,enemyReduction:0,finiteResult:'PENDING'});expect(resolvePureWhiteAngelEnemySlot(x,r,'DAZZLING_PRESSURE',1,random(100))).toMatchObject({paidCost:7,selfGain:65,attackKind:'MENTAL'});expect(resolvePureWhiteAngelEnemySlot(x,r,'OBSCURE',2,random()).paidCost).toBe(3);expect(r.body.enemySpirituality).toBe(104);advancePureWhiteAngelCombatClock(r,60);expect(r.body.enemySpirituality).toBe(104);r.body.enemySpirituality=0;expect(resolvePureWhiteAngelEnemySlot(x,r,'DAZZLING_PRESSURE',3,random())).toMatchObject({selectedAbility:'BODY_STRIKE',paidCost:0});
 });
 it('MENTAL loss cannot create a body wound or body risk; true health death remains terminal',()=>{
  const x=source(),r=createPureWhiteAngelRuntime(x),mental=resolvePureWhiteAngelEnemySlot(x,r,'DAZZLING_PRESSURE',0,random(100)),m=resolvePureWhiteAngelConsequences(x,r,[],[mental],'ENEMY','NONE',random());expect(m).toMatchObject({playerHealth:x.playerHealth,playerRisk:x.playerRisk,playerInjuries:x.playerInjuries,consequenceDomain:'MENTAL',consequenceWeights:null,consequenceRoll:undefined,outcome:'CONTINUE'});expect(r.playerM).toBe(x.playerMind-10);
  const exhausted=createPureWhiteAngelRuntime(x);exhausted.playerM=10;const e=resolvePureWhiteAngelEnemySlot(x,exhausted,'DAZZLING_PRESSURE',0,random(100));expect(resolvePureWhiteAngelConsequences(x,exhausted,[],[e],'ENEMY','NONE',random()).outcome).toBe('RETREATED');expect(exhausted.playerM).toBe(0);expect(exhausted.playerH).toBe(100);
  const dying=createPureWhiteAngelRuntime(x),body=resolvePureWhiteAngelEnemySlot(x,dying,'BODY_STRIKE',0,random());expect(resolvePureWhiteAngelConsequences(x,dying,[],[body],'ENEMY','NONE',random(100))).toMatchObject({playerHealth:0,outcome:'PLAYER_DEAD',consequenceDomain:'BODY',consequenceWeights:{light:65,heavy:30,death:5}});
 });
 it('replays exact source/cursor/cost/action order and rejects forged outcomes or future records',()=>{
  const x=source(),before=structuredClone(x),result=replayPureWhiteAngelCombatRound(x,'CONTROL'),o=result.round.pureWhiteAngelOutcome!;expect(x).toEqual(before);expect(validatePureWhiteAngelCombatRound(result.round)).toBe(true);expect(validatePureWhiteAngelRoundOutcome(o)).toBe(true);expect(o.windowsAfter).toEqual({focusedPurification:null,warmRadianceGuard:null,notarization:null,limitedLight:null,enemyWard:null});expect(o.rootAfter.clockSeconds).toBe(x.root.clockSeconds+60);
  const actions=[...o.playerActions,...o.enemyActions].sort((a,b)=>a.order-b.order);expect(actions.map(a=>a.order)).toEqual(actions.map((_a,i)=>i));expect(actions.map(a=>a.atSeconds)).toEqual(actions.map((_a,i)=>4+5*i));expect(actions.every(a=>a.elapsedSeconds===5)).toBe(true);expect(result.round.moves.map(a=>a.actor)).toEqual(actions.map(a=>a.actor));
  for(const mutate of [(v:typeof o)=>{v.randomCursorAfter++;},(v:typeof o)=>{v.playerSpiritualityAfter++;},(v:typeof o)=>{v.materialsAfter.weapon.charge++;},(v:typeof o)=>{v.materialsAfter.weapon.pieces[0]!.id='LS2-OWEN-CLUB';},(v:typeof o)=>{v.rootAfter.playerTravelMetres++;},(v:typeof o)=>{v.source.preparation.week++;}]){const forged=structuredClone(o);mutate(forged);expect(validatePureWhiteAngelRoundOutcome(forged)).toBe(false);}
  if(o.continuing){const next=nextPureWhiteAngelCombatSource(o);expect(next.playerSpirituality).toBe(Math.min(120,o.playerSpiritualityAfter+12));expect(next.body.enemySpirituality).toBe(o.enemySpirituality);expect(validPureWhiteAngelCombatSource(next)).toBe(true);}
 });
 it('ordinary open-route retreat reaches a real terminal4m exit without altering the original gallery or history',()=>{
  const s=fighting(),old=structuredClone(s),history=structuredClone(s.combatHistory),result=tickRound(s,'RETREAT');expect(result.outcome).toBe('RETREATED');expect(s.combat).toBeNull();expect(validatePureWhiteAngelEncounter(s)).toBe(true);expect(s.combatHistory.slice(0,history.length)).toEqual(history);expect(s.lightSeeker).toEqual(old.lightSeeker);expect(pureWhiteAngelEncounterOriginalEvents(s)).toEqual([]);
  const e=s.pureWhiteAngel.encounter,o=s.combatHistory.at(-1)!.pureWhiteAngelOutcome!;expect(e.terminal).toMatchObject({outcome:'RETREATED',exitMetres:4,exitSeconds:4});expect(e.scene.playerTravelMetres).toBe(o.rootAfter.playerTravelMetres+4);expect(e.scene.clockSeconds).toBe(o.rootAfter.clockSeconds+4);expect(e.scene.playerLocation).toBe('OUTSIDE');expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('fixed original-seed CONTROL reaches actual terminal without resetting people, mastery or injuries',()=>{
  const s=fighting(),old=structuredClone(s),history=structuredClone(s.combatHistory);let rounds=0;
  while(s.combat&&rounds++<64){tickRound(s);expect(validatePureWhiteAngelEncounter(s)).toBe(true);}
  expect(s.combat).toBeNull();expect(s.pureWhiteAngel.encounter.terminal).not.toBeNull();expect(s.combatHistory.slice(0,history.length)).toEqual(history);expect(s.lightSeeker).toEqual(old.lightSeeker);expect(pureWhiteAngelEncounterOriginalEvents(s)).toEqual([]);
  const e=s.pureWhiteAngel.encounter,o=s.combatHistory.at(-1)!.pureWhiteAngelOutcome!,prep=e.preparation!;
  for(const id of PURE_WHITE_ANGEL_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(Math.min(500,prep.after.mastery[id]!+8*(e.inheritedApplications[id]??0)));
  expect(e.scene.playerTravelMetres).toBe(o.rootAfter.playerTravelMetres+(s.health>0?4:0));expect(e.scene.clockSeconds).toBe(o.rootAfter.clockSeconds+(s.health>0?4:0));expect(e.scene.playerLocation).toBe(s.health>0?'OUTSIDE':'FORECOURT');expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('zero-AP arrival can cleanly leave then replay exact shared weekly finance',()=>{
  // Explicit isolated budget boundary only; never used as a campaign source.
  const s=readyUnit();s.actionsRemaining=1;encounter(s,{type:'ENCOUNTER_TALK'});expect(s.actionsRemaining).toBe(0);expect(blockPureWhiteAngelEncounter(s,{type:'LEAVE_ENCOUNTER'})).toBeNull();expect(blockPureWhiteAngelEncounter(s,{type:'ENCOUNTER_FIGHT'})).not.toBeNull();expect(validatePureWhiteAngelEncounter(s)).toBe(true);
  encounter(s,{type:'LEAVE_ENCOUNTER'});const entry=s.pureWhiteAngel.encounter.journal.at(-1)!,expected=pureWhiteAngelEncounterBudget(s),finance=pureWhiteAngelFinanceSnapshot(s),week=s.week,date={...s.date};
  const transition=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:s.revision-1,pulse:'BILL',billAmount:0});expect(transition.eventId).toBeNull();const final=transition.state;s.cash=final.cash;s.debts=structuredClone(final.debts);s.missedWeeks=final.missedWeeks;s.credit=final.credit;s.nextLifeTier=final.nextLifeTier;s.lifeTier=final.nextLifeTier;s.week++;s.date=addGameWeeks(date,1);s.actionsRemaining=finance.weeklyBudget;s.pulse='NONE';s.billAmount=0;
  for(const receipt of transition.receipts)s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week,...receipt});s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week:s.week,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
  expect(pureWhiteAngelCompletedBudgetMatches(s,expected,finance,week,date,entry.revision,entry.randomCursor,'沿普通路和平离开廊外前庭')).toBe(true);expect(validatePureWhiteAngelEncounter(s)).toBe(true);const forged=structuredClone(s);forged.cash++;expect(validatePureWhiteAngelEncounter(forged)).toBe(false);
 });
});
