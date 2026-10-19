import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/priest-of-light-v01030/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent,guidanceStart,promoted=null,practiced=null,combatStart=null;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1500);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/unshadowed-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='UNSHADOWED'?c.command.type:null;let key=({BOOK_RITUAL:'book',BEGIN_RITUAL:'open',DECLARE_EMOTION:'declare',SEPARATE_EMOTION:'separate',CONSUME:'drink',RETURN_EMOTION:s.progression.sequence===4?'promotion':'return-emotion',END_RITUAL:'exit',MOVE_ALLY:'move-ally',RETURN_ALLY:'return-ally',STEP_OUT:'step-out',STEP_IN:'step-in',COOL_TARGET:'cool',PERFORM:c.command?.caseId==='open-domain'?'domain':c.command?.caseId==='finite-purification'?'purification':'sunflare',STOP_EFFECT:'stop',CLOSE:'close',REPORT:'report'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,health:s.health,mind:s.mind,S:s.spirituality,sequence:s.progression.sequence}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'UNSHADOWED',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
function view(){return projectSliceState(s).unshadowed;}
function finish(){writeFileSync('output/play/unshadowed-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/unshadowed-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,complete:!!practiced,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,bottles:s.unshadowed.bottles.map(b=>b.outcome),visits:s.unshadowed.ritual.visits,boundaries:Object.keys(boundaries)}));}
clear();while(s.cash<520)ordinary();guidanceStart=structuredClone(s);rd({type:'LEARN_FORMULA'});clear();
for(let attempt=0;s.progression.sequence===5&&s.status==='ACTIVE'&&attempt<12;attempt++){
 let bottle=s.unshadowed.bottles.find(b=>b.status==='PREPARED');
 if(!bottle){let batch=s.unshadowed.batches.find(b=>!b.brewed);if(!batch){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.unshadowed.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});batch=s.unshadowed.batches.find(b=>!b.brewed);}for(let n=batch.labourSteps;n<5;n++){rd({type:'POTION_WORK',batchId:batch.id});clear();}while(s.cash<1000)ordinary();rd({type:'BUY_MATERIALS',batchId:batch.id});clear();rd({type:'BREW',batchId:batch.id});clear();bottle=s.unshadowed.bottles.find(b=>b.status==='PREPARED');}
 while(s.health<100||s.mind<100||s.spirituality<100||s.seer.pollution>0||s.week-s.priestOfLight.promotionWeek<12||s.cash<320)ordinary();
 rd({type:'BOOK_RITUAL'});clear();const visit=s.unshadowed.ritual.visits.at(-1);while(s.week<visit.plannedWeek)ordinary();
 rd({type:'BEGIN_RITUAL'});rd({type:'DECLARE_EMOTION',subjectId:'UD4-MIRIEL',confirmed:true});rd({type:'SEPARATE_EMOTION',confirmed:true});rd({type:'CONSUME',bottleId:bottle.id,confirmed:true});
 assert.equal(s.progression.sequence,5,'Drinking must not finish the emotion-return rite');
 rd({type:'RETURN_EMOTION'});
 if(s.progression.sequence===4)promoted=structuredClone(s);rd({type:'END_RITUAL'});clear();
}
if(s.status!=='ACTIVE'){finish();process.exit(0);}assert.equal(s.progression.sequence,4);
for(const caseId of ['open-domain','finite-purification','warned-sunflare']){
 clear();while(s.spirituality<20)ordinary();rd({type:'OBSERVE',caseId});clear();
 const action=type=>view().actions.find(a=>a.command.type===type&&(!('caseId'in a.command)||a.command.caseId===caseId)&&a.enabled);
 for(let n=0;n<100&&s.unshadowed.life.cases[caseId].status!=='RESOLVED';n++){
  const r=s.unshadowed.life.cases[caseId];
  if(r.status==='OBSERVED'){if(r.attemptWeek===s.week||s.spirituality<12){ordinary();continue;}rd({type:'PREPARE',caseId,method:'ABILITY'});clear();}
  let a=action('MOVE_ALLY');if(a)rd(a.command);
  a=action('PERFORM');if(a)rd(a.command);
  for(const type of ['STEP_OUT','STEP_IN','STOP_EFFECT','COOL_TARGET','RETURN_ALLY','CLOSE','REPORT']){a=action(type);if(a){rd(a.command);clear();}}
 }
 assert.equal(s.unshadowed.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);practiced=structuredClone(s);
while(s.health<100||s.mind<90||s.spirituality<110||s.cash<40||s.actionsRemaining<2)ordinary();
rd({type:'ENCOUNTER_TALK'});rd({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'CONTROL'});
assert.equal(s.combat,null);finish();
