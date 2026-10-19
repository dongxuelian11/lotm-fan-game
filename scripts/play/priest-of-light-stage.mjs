import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/notary-v0810/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<700);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/priest-of-light-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='PRIEST_OF_LIGHT'?c.command.type:null;const key=t==='CONSUME'?(s.progression.sequence===5?'promotion':'consume'):t==='BREW'?'brew':t==='BEGIN_RITUAL'?'enter':t==='END_RITUAL'?'exit':t==='RETURN_GUIDE'?'return':t==='MOVE_LANTERN'?'move-lantern':t==='RETURN_LANTERN'?'return-lantern':t==='PREPARE'?'prepare':t==='PERFORM'?'effect':t==='CLOSE'?'close':t==='REPORT'?'report':c.type==='COMBAT_ROUND'&&!s.combat?'combat':null;if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'PRIEST_OF_LIGHT',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
clear();while(s.cash<460)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_FORMULA'});clear();
for(let n=0;n<12&&s.progression.sequence===6;n++){
 let b=s.priestOfLight.batches.find(b=>!b.brewed);if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.priestOfLight.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.priestOfLight.batches.find(b=>!b.brewed);}
 for(let k=b.labourSteps;k<5;k++){rd({type:'MATERIAL_WORK',batchId:b.id});clear();}
 while(s.cash<1400||s.week-s.notary.promotionWeek<12||s.health<60||s.mind<60)ordinary();rd({type:'BUY_MATERIALS',batchId:b.id});rd({type:'BREW',batchId:b.id});clear();
 const bottle=s.priestOfLight.bottles.at(-1);rd({type:'REQUEST_RITUAL'});clear();while(s.week<=s.priestOfLight.ritual.requestedWeek||s.cash<300)ordinary();
 rd({type:'GO_RITUAL'});rd({type:'BEGIN_RITUAL'});rd({type:'CONSUME',bottleId:bottle.id,confirmed:true});rd({type:'END_RITUAL'});rd({type:'RETURN_GUIDE'});clear();
 if(s.progression.sequence===6)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,5);const promoted=structuredClone(s);
for(const caseId of ['darkened-walk','bounded-cleansing','mixed-company']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<80&&s.priestOfLight.cases[caseId].status!=='RESOLVED';n++){
  const r=s.priestOfLight.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<5||s.mind<20){ordinary();continue;}
   rd({type:'PREPARE',caseId,method:'ABILITY'});clear();
  }
  if(s.priestOfLight.cases[caseId].status==='PREPARED'){
   if(caseId==='mixed-company'){while(s.actionsRemaining<1)ordinary();rd({type:'MOVE_LANTERN'});}
   rd({type:'PERFORM',caseId});if(s.priestOfLight.cases[caseId].contactOpen||s.priestOfLight.practice.auraOpen)rd({type:'CLOSE',caseId});
   if(s.priestOfLight.practice.spiritDistressed)rd({type:'CLEAR_SPIRIT'});
   if(s.priestOfLight.practice.lanternPosition==='SHELTER')rd({type:'RETURN_LANTERN'});clear();
  }
  if(s.priestOfLight.cases[caseId].status==='EXAMINED'){rd({type:'REPORT',caseId});clear();}
 }
 assert.equal(s.priestOfLight.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
while(s.health<90||s.mind<80||s.spirituality<95)ordinary();rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});
assert.equal(s.combat,null);
writeFileSync('output/play/priest-of-light-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));
for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/priest-of-light-${k}-save-boundary.json`,JSON.stringify(b));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,rounds:s.combatHistory.length-practiced.combatHistory.length,health:s.health,encounter:s.priestOfLight.encounter,bottles:s.priestOfLight.bottles.map(b=>b.outcome),ritual:s.priestOfLight.ritual,practice:s.priestOfLight.practice,boundaries:Object.keys(boundaries)}));
