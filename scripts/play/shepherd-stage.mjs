import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/rose-bishop-v0880/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<700);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/shepherd-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='SHEPHERD'?c.command.type:null;const key=t==='CONSUME'?(s.progression.sequence===5?'promotion':'consume'):t==='GRAZE'&&s.shepherd.grazing.spirits.find(x=>x.id===c.command.spiritId)?.status==='GRAZED'?(c.command.spiritId==='SH5-IRIS-1'?'graze-iris':'graze-cedric'):t==='ACTIVATE_SPIRIT'?'activate':t==='RELEASE_SPIRIT'?'release':t==='PREPARE'?'prepare':t==='PERFORM'&&c.command.caseId==='willing-chorus'?'chorus':t==='PERFORM'&&c.command.caseId==='limited-account'?'account':t==='PERFORM'?'paper':t==='CLOSE'?'close':t==='REPORT'?'report':c.type==='COMBAT_ROUND'&&!s.combat?'combat':null;if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'SHEPHERD',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
clear();while(s.cash<460)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<12&&s.progression.sequence===6;n++){
 let b=s.shepherd.bottles.find(b=>b.status==='SUPPLIER');if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.shepherd.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.shepherd.bottles.find(b=>b.status==='SUPPLIER');}
 for(let k=b.labourSteps;k<5;k++){rd({type:'POTION_WORK',bottleId:b.id});clear();}
 while(s.cash<700||s.week-s.roseBishop.promotionWeek<12||s.health<60||s.mind<60)ordinary();rd({type:'BUY_POTION',bottleId:b.id});clear();rd({type:'CONSUME',bottleId:b.id,confirmed:true});clear();
 if(s.progression.sequence===6)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,5);const promoted=structuredClone(s);rd({type:'MEET_SPIRITS'});clear();
for(const [spiritId,abilityIds] of [['SH5-IRIS-1',['light-touch','brief-ward','blur-mark']],['SH5-CEDRIC-1',['courage-song']]]){for(let n=0;n<20&&s.shepherd.grazing.spirits.find(x=>x.id===spiritId).status!=='GRAZED';n++){const soul=s.shepherd.grazing.spirits.find(x=>x.id===spiritId);while(soul.attemptWeek===s.week||s.spirituality<3)ordinary();rd({type:'GRAZE',spiritId,abilityIds});clear();}assert.equal(s.shepherd.grazing.spirits.find(x=>x.id===spiritId).status,'GRAZED');}
for(const caseId of ['paper-guidance','willing-chorus','limited-account']){
 clear();if(caseId!=='limited-account')rd({type:'ACTIVATE_SPIRIT',spiritId:caseId==='paper-guidance'?'SH5-IRIS-1':'SH5-CEDRIC-1'});rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<80&&s.shepherd.cases[caseId].status!=='RESOLVED';n++){
  const r=s.shepherd.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<5||s.mind<20){ordinary();continue;}
   rd({type:'PREPARE',caseId,method:caseId==='limited-account'?'ORDINARY':'ABILITY'});clear();
  }
  if(s.shepherd.cases[caseId].status==='PREPARED'){
   rd({type:'PERFORM',caseId});
   if(s.shepherd.cases[caseId].contactOpen)rd({type:'CLOSE',caseId});
   clear();
  }
  if(s.shepherd.cases[caseId].status==='EXAMINED'){rd({type:'REPORT',caseId});clear();}
 }
 assert.equal(s.shepherd.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
while(s.health<90||s.mind<80||s.spirituality<95)ordinary();
rd({type:'RELEASE_SPIRIT',spiritId:'SH5-CEDRIC-1',confirmed:true});clear();
rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:n<2?'CONTROL':'ATTACK',shepherdSpiritId:'SH5-IRIS-1'});
assert.equal(s.combat,null);
writeFileSync('output/play/shepherd-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));
for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/shepherd-${k}-save-boundary.json`,JSON.stringify(b));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,rounds:s.combatHistory.length-practiced.combatHistory.length,health:s.health,encounter:s.shepherd.encounter,bottles:s.shepherd.bottles.map(b=>b.outcome),practice:s.shepherd.practice,boundaries:Object.keys(boundaries)}));
