import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/vampire-v0190/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/potion-professor-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='POTION_PROFESSOR'?c.command.type:null;const key=t==='CONSUME'?(s.progression.sequence===6?'promotion':'consume'):t==='BREW_ASSISTANCE'&&s.potionProfessor.laboratory.potions.length>beforeLast.potionProfessor.laboratory.potions.length?'brew':t==='PERFORM'?'use':t==='CLOSE'?'close':t==='REPORT'?'report':c.type==='COMBAT_ROUND'&&!s.combat?'combat':null;if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'POTION_PROFESSOR',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
if(s.status==='SLICE_COMPLETE')go({type:'CONTINUE_LIFE'});clear();while(s.cash<360)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<12&&s.progression.sequence===7;n++){
 let b=s.potionProfessor.bottles.find(b=>b.status==='SUPPLIER');if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.potionProfessor.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.potionProfessor.bottles.find(b=>b.status==='SUPPLIER');}
 for(let k=b.labourSteps;k<5;k++){rd({type:'POTION_WORK',bottleId:b.id});clear();}
 while(s.cash<320||s.week-s.vampire.promotionWeek<12||s.health<60||s.mind<60)ordinary();rd({type:'BUY_POTION',bottleId:b.id});clear();rd({type:'CONSUME',bottleId:b.id,confirmed:true});clear();
 if(s.progression.sequence===7)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,6);const promoted=structuredClone(s);
while(s.vampire.blood.lastFedWeek===s.week||s.cash<24)ordinary();go({type:'VAMPIRE',command:{type:'BUY_BLOOD'}});clear();go({type:'VAMPIRE',command:{type:'FEED'}});clear();
for(const caseId of ['quiet-passage','separate-signals','willing-student']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<120&&s.potionProfessor.cases[caseId].status!=='RESOLVED';n++){
  const r=s.potionProfessor.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<8||s.mind<30){ordinary();continue;}
   const kinds=caseId==='quiet-passage'?['QUIET_STEP']:caseId==='separate-signals'?['BODY_VEIL','CLOTH_VEIL','ODOR_VEIL']:[];
   for(const kind of kinds){
    for(let brew=0;brew<24&&!s.potionProfessor.laboratory.potions.some(p=>p.kind===kind&&p.status==='PLAYER');brew++){
     if(s.spirituality<2){ordinary();continue;}
     if(s.potionProfessor.laboratory.materials===0){
      while(s.cash<100||(s.potionProfessor.laboratory.kitStock===0&&s.week<=s.potionProfessor.laboratory.restockAfterWeek))ordinary();
      rd({type:'BUY_KIT'});
     }
     rd({type:'BREW_ASSISTANCE',kind});clear();
    }
    assert(s.potionProfessor.laboratory.potions.some(p=>p.kind===kind&&p.status==='PLAYER'));
   }
   rd({type:'PREPARE',caseId,method:'ABILITY'});clear();
  }
  if(s.potionProfessor.cases[caseId].status==='PREPARED'){
   rd({type:'PERFORM',caseId});if(s.potionProfessor.cases[caseId].contactOpen)rd({type:'CLOSE',caseId});clear();
  }
  if(s.potionProfessor.cases[caseId].status==='EXAMINED'){rd({type:'REPORT',caseId});clear();}
 }
 assert.equal(s.potionProfessor.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
while(s.health<90||s.mind<80||s.spirituality<75)ordinary();rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});
assert.equal(s.combat,null);
writeFileSync('output/play/potion-professor-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));
for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/potion-professor-${k}-save-boundary.json`,JSON.stringify(b));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,rounds:s.combatHistory.length-practiced.combatHistory.length,health:s.health,laboratory:s.potionProfessor.laboratory,encounter:s.potionProfessor.encounter,bottles:s.potionProfessor.bottles.map(b=>b.outcome),boundaries:Object.keys(boundaries)}));
