import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
import {addGameYears} from '../../dist/domain/game-calendar.js';
const old=JSON.parse(readFileSync('tests/fixtures/bizarro-sorcerer-v01170/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={},prefixCount=old.commands.length;
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1100,'bounded public play');beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/ancient-scholar-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);if(commands.length>prefixCount){const key=c.type==='ANCIENT_SCHOLAR'?c.command.type.toLowerCase():null;if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(c.type==='ANCIENT_SCHOLAR'&&c.command.type==='CONSUME'&&s.progression.sequence===3)boundaries.promotion={beforeLast,lastIntent,final:structuredClone(s)};if(c.type==='COMBAT_ROUND'&&s.lastCombatRound?.ancientScholarOutcome){const k=s.combat?'combat_first':'combat_end';if(!boundaries[k])boundaries[k]={beforeLast,lastIntent,final:structuredClone(s)};}console.log(JSON.stringify({step:commands.length,command:c,week:s.week,date:s.date,H:s.health,M:s.mind,S:s.spirituality,AP:s.actionsRemaining,phase:s.ancientScholar.ritual.phase,sequence:s.progression.sequence}));}}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const departureStart=structuredClone(s);
function clear(){for(let n=0;n<15&&s.activeEvent;n++){const e=projectSliceState(s).activeEvent,id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':e.id.startsWith('ORIGIN')?'.decline':null;assert(id,'unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}assert.equal(s.activeEvent,null);}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
function as(c){go({type:'ANCIENT_SCHOLAR',command:c});if(!s.ancientScholar.ritual.eraClosedDate&&s.ancientScholar.ritual.location!=='VAULT')clear();}
function action(c){if(!s.ancientScholar.ritual.eraClosedDate){clear();while(s.actionsRemaining<1)ordinary();}else if(s.actionsRemaining<1)as({type:'NEXT_WEEK'});as(c);}
clear();while(s.injuries.some(i=>i.treatedRevision===null)||s.injuryRisk>0||s.health<80||s.mind<60)ordinary();
if(s.faceless.appearance.templateId!=='SELF')go({type:'FACELESS',command:{type:'RESTORE_SELF'}});
action({type:'LEARN_FORMULA'});action({type:'HAND_OVER_BELL'});as({type:'REVIEW_SECLUSION'});
for(const recordId of ['AS3-RECORD-145','AS3-RECORD-170','AS3-RECORD-230']){action({type:'OBTAIN_RECORD',recordId});action({type:'VERIFY_RECORD',recordId});}
for(const taskId of ['CHECK_CONTAINER','CHECK_LOCAL_CLOCK','REGISTER_SEALS'])action({type:'PREPARE_FACILITY',taskId});
for(let n=0;n<3;n++)action({type:'FACILITY_WORK'});as({type:'PAY_FACILITY'});
for(const batchId of s.ancientScholar.batches.map(b=>b.id)){for(let n=0;n<3;n++)action({type:'MATERIAL_WORK',batchId});as({type:'BUY_MATERIALS',batchId});action({type:'BREW',batchId});}
const prepared=structuredClone(s);as({type:'ENTER_SECLUSION',confirmed:true});const sealed=structuredClone(s);
as({type:'ADVANCE_FIRST_150'});const first150=structuredClone(s);assert.deepEqual(s.date,addGameYears(sealed.date,150));
assert.throws(()=>applySliceIntent(s,{type:'ANCIENT_SCHOLAR',command:{type:'CONSUME',bottleId:s.ancientScholar.bottles[0].id,confirmed:true}}));assert.throws(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'}));
as({type:'ADVANCE_SECOND_150'});const full300=structuredClone(s);assert.deepEqual(s.date,addGameYears(sealed.date,300));as({type:'VERIFY_CONTINUITY'});const verified=structuredClone(s);
function save(extra={}){const capture={creation,seed,commands,prefixCount,departureStart,prepared,sealed,first150,full300,verified,...extra,beforeLast,lastIntent,final:s};writeFileSync('output/play/ancient-scholar-stage-natural.json',JSON.stringify(capture));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/ancient-scholar-${k}-save-boundary.json`,JSON.stringify(b));mkdirSync('tests/fixtures/ancient-scholar-v01400',{recursive:true});writeFileSync('tests/fixtures/ancient-scholar-v01400/natural.json',JSON.stringify(capture));writeFileSync('tests/fixtures/ancient-scholar-v01400/boundaries.json',JSON.stringify(boundaries));console.log(JSON.stringify({passed:true,commands:commands.length,date:s.date,week:s.week,phase:s.ancientScholar.ritual.phase,sequence:s.progression.sequence,boundaries:Object.keys(boundaries)}));}
save({stage:'REAL_300_YEARS_VERIFIED'});
if(process.argv.includes('--isolation-only'))process.exit(0);
let promoted=null,practiced=null,combatStart=null;
for(const bottle of [...s.ancientScholar.bottles]){
 if(s.progression.sequence===3)break;
 while((s.health<=20||s.mind<70)&&s.ancientScholar.ritual.visits.at(-1).recoveryUses<3)as({type:'ISOLATION_REST'});
 if(s.health<=20||s.mind<=40)break;
 as({type:'CONSUME',bottleId:bottle.id,confirmed:true});
}
if(s.progression.sequence!==3){save({stage:'ACTUAL_ISOLATION_AND_POTION_FAILURES',promoted,practiced,combatStart});process.exit(0);}
promoted=structuredClone(s);as({type:'EXIT_SECLUSION'});
function future(){if(s.actionsRemaining===0)as({type:'NEXT_WEEK'});else as({type:s.cash<120?'WORK':(s.health<100||s.mind<95||s.spirituality<105||s.seer.pollution>0)?'REST':'WORK'});}
while(s.health<95||s.mind<90||s.spirituality<100||s.seer.pollution>0)future();
for(const caseId of ['past-reserve','old-tag','lit-fragment']){
 action({type:'OBSERVE',caseId});action({type:'PREPARE',caseId,method:'ABILITY'});action({type:'PERFORM',caseId});
 const ability=caseId==='past-reserve'?'BORROW_PAST':caseId==='old-tag'?'PROJECT_TAG':'HIDE_IN_HISTORY';as({type:ability});
 let r=s.ancientScholar.life.cases[caseId];
 if(['SUCCESS','GREAT_SUCCESS'].includes(r.outcome)){
  if(caseId==='past-reserve')as({type:'USE_BORROWED_RESERVE'});
  if(caseId==='old-tag')as({type:'MOVE_TAG_IMAGE'});
 }else as({type:'FINISH_ORDINARY'});
 as({type:'RETURN_TO_PRESENT'});as({type:'CLOSE',caseId});action({type:'REPORT',caseId});
}
action({type:'REFLECT'});assert.equal(s.progression.acting,100);practiced=structuredClone(s);
while(s.health<100||s.mind<100||s.spirituality<115||s.cash<150)future();
action({type:'BUY_CURRENT_KIT'});
while(s.actionsRemaining<2)future();
as({type:'LIGHT_CURRENT_LANTERN'});as({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);
for(let round=0;s.combat&&round<100;round++)go({type:'COMBAT_ROUND',stance:round<2?'CONTROL':'ATTACK'});
assert.equal(s.combat,null);
if(s.status==='ACTIVE')as({type:'LEAVE_RECEPTION'});
save({stage:'FULL_NATURAL_BRANCH',promoted,practiced,combatStart});
