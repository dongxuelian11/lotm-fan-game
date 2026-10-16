import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/sunpriest-v0310/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/notary-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='NOTARY'?c.command.type:null;const key=t==='CONSUME'?(s.progression.sequence===6?'promotion':'consume'):t==='BREW'?'brew':t==='SIGN'?'sign':t==='PERFORM'&&s.notary.contract.active?'contract':t==='PERFORM'&&c.command.caseId==='rejected-terms'&&!s.notary.cases['rejected-terms'].revised?'refusal':t==='CLOSE'&&c.command.caseId==='signed-tool'&&s.notary.contract.fulfilled?'return':t==='REPORT'?'report':c.type==='COMBAT_ROUND'&&!s.combat?'combat':null;if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'NOTARY',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
if(s.status==='SLICE_COMPLETE')go({type:'CONTINUE_LIFE'});clear();while(s.cash<360)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_FORMULA'});clear();
for(let n=0;n<12&&s.progression.sequence===7;n++){
 let b=s.notary.batches.find(b=>!b.brewed);if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.notary.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.notary.batches.find(b=>!b.brewed);}
 for(let k=b.labourSteps;k<5;k++){rd({type:'MATERIAL_WORK',batchId:b.id});clear();}
 while(s.cash<320||s.week-s.sunpriest.promotionWeek<12||s.health<60||s.mind<60)ordinary();rd({type:'BUY_MATERIALS',batchId:b.id});rd({type:'BREW',batchId:b.id});clear();rd({type:'CONSUME',bottleId:s.notary.bottles.at(-1).id,confirmed:true});clear();
 if(s.progression.sequence===7)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,6);const promoted=structuredClone(s);
for(const caseId of ['limited-light','rejected-terms','signed-tool']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<80&&s.notary.cases[caseId].status!=='RESOLVED';n++){
  const r=s.notary.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<3||s.mind<20){ordinary();continue;}
   rd({type:'PREPARE',caseId,method:'ABILITY'});clear();
  }
  if(s.notary.cases[caseId].status==='PREPARED'){
   if(caseId==='signed-tool'&&!s.notary.contract.signed)rd({type:'SIGN',caseId});
   rd({type:'PERFORM',caseId});if(s.notary.cases[caseId].contactOpen)rd({type:'CLOSE',caseId});clear();
  }
  if(s.notary.cases[caseId].status==='EXAMINED'){rd({type:'REPORT',caseId});clear();}
 }
 assert.equal(s.notary.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
while(s.health<90||s.mind<80||s.spirituality<75)ordinary();rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'CONTROL'});
assert.equal(s.combat,null);
writeFileSync('output/play/notary-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));
for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/notary-${k}-save-boundary.json`,JSON.stringify(b));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,rounds:s.combatHistory.length-practiced.combatHistory.length,health:s.health,contract:s.notary.contract,encounter:s.notary.encounter,bottles:s.notary.bottles.map(b=>b.outcome),boundaries:Object.keys(boundaries)}));
