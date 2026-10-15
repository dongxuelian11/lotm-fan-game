import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/marionettist-v0950/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent,guidanceStart,promoted=null,practiced=null,combatStart=null;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1400);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/bizarro-sorcerer-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='BIZARRO_SORCERER'?c.command.type:null;const key=t==='CONSUME_FINALE'?(s.progression.sequence===4?'promotion':'consume'):({BREW:'brew',SURVEY_RITUAL:'survey',GATHER_WITNESSES:'witnesses',START_RITUAL:'ritual-start',CLOSE_RITUAL:'ritual-close',CAPTURE_MOUSE:'mouse-capture',COMPLETE_MOUSE_CONTROL:'mouse-convert',ASSIGN_WORM:'worm-assign',RECALL_WORM:'worm-recall',PUPPET_ILLUSION:'puppet-use',SWAP_OUT:'swap',RETURN_ORDINARY:'return',CLOSE:'close',REPORT:'report'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?(s.bizarroSorcerer.ritual.phase==='FINALE'?'finale':'combat'):null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,health:s.health,S:s.spirituality,phase:s.bizarroSorcerer.ritual.phase,sequence:s.progression.sequence}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'BIZARRO_SORCERER',command});
const magic=type=>go({type:'MAGICIAN',command:{type}});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
function readyFight(){
 while(s.cash<100||s.health<100||s.mind<100||s.spirituality<(s.progression.sequence===4?115:100)||s.seer.pollution>0)ordinary();
 while(s.magician.figurinesHeld<6&&(s.clown.paperSheets>0||s.clown.paperStock>0)){if(s.clown.paperSheets<1){while(s.cash<40)ordinary();go({type:'CLOWN',command:{type:'BUY_PAPER'}});}magic('PREPARE_FIGURINE');clear();}
 if(s.magician.lantern.oilHeld<1){while(s.cash<12)ordinary();magic('BUY_OIL');}
 while(s.health<100||s.mind<100||s.spirituality<(s.progression.sequence===4?115:100)||s.actionsRemaining<2)ordinary();
}
function findTarget(){
 const r=s.bizarroSorcerer.ritual;let target=r.targets.find(t=>['UNSURVEYED','AVAILABLE'].includes(t.status));
 if(!target){rd({type:'REQUEST_NEW_LEAD'});clear();while(s.week<=s.bizarroSorcerer.ritual.leadRequestedWeek)ordinary();rd({type:'RECEIVE_LEAD'});return s.bizarroSorcerer.ritual.pendingLead.targetId;}
 return target.id;
}
function finish(){
 writeFileSync('output/play/bizarro-sorcerer-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));
 for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/bizarro-sorcerer-${k}-save-boundary.json`,JSON.stringify(b));
 console.log(JSON.stringify({passed:true,complete:!!practiced,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,bottles:s.bizarroSorcerer.bottles.map(b=>b.outcome),attempts:s.bizarroSorcerer.ritual.attempts.map(a=>({id:a.id,outcome:a.outcome,invalid:a.invalidReason,witnesses:a.deathWitnessIds.length})),life:s.bizarroSorcerer.life,boundaries:Object.keys(boundaries)}));
}
clear();while(s.cash<500)ordinary();guidanceStart=structuredClone(s);rd({type:'LEARN_FORMULA'});clear();
for(let attempt=0;attempt<12&&s.progression.sequence===5&&s.status==='ACTIVE';attempt++){
 let bottle=s.bizarroSorcerer.bottles.find(b=>b.status==='PREPARED');
 if(!bottle){let batch=s.bizarroSorcerer.batches.find(b=>!b.brewed);if(!batch){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.bizarroSorcerer.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});batch=s.bizarroSorcerer.batches.find(b=>!b.brewed);}
 for(let k=batch.labourSteps;k<5;k++){rd({type:'MATERIAL_WORK',batchId:batch.id});clear();}
 while(s.cash<500||s.week-s.marionettist.promotionWeek<12)ordinary();rd({type:'BUY_MATERIALS',batchId:batch.id});rd({type:'BREW',batchId:batch.id});clear();bottle=s.bizarroSorcerer.bottles.find(b=>b.status==='PREPARED');}
 readyFight();const targetId=findTarget();while(s.week<s.bizarroSorcerer.ritual.earliestSurveyWeek)ordinary();rd({type:'SURVEY_RITUAL',targetId});clear();rd({type:'PREPARE_STAGE'});clear();
 while(s.week<=s.bizarroSorcerer.ritual.preparedWeek||s.actionsRemaining<2||s.spirituality<95)ordinary();rd({type:'GATHER_WITNESSES'});magic('PREPARE_LANTERN');rd({type:'START_RITUAL',bottleId:bottle.id,confirmed:true});combatStart=structuredClone(s);
 for(let round=0;s.combat&&round<100;round++)go({type:'COMBAT_ROUND',stance:'ATTACK'});assert.equal(s.combat,null);
 if(s.status!=='ACTIVE'){finish();process.exit(0);}
 if(s.bizarroSorcerer.ritual.phase==='FINALE'){
  const action=projectSliceState(s).bizarroSorcerer.actions.find(a=>a.command.type==='CONSUME_FINALE'&&a.command.bottleId===bottle.id);
  if(action?.enabled)rd({type:'CONSUME_FINALE',bottleId:bottle.id,confirmed:true});else rd({type:'CLOSE_RITUAL'});
 }
 clear();
}
if(s.progression.sequence!==4){finish();process.exit(0);}
promoted=structuredClone(s);
while(s.health<90||s.mind<90||s.spirituality<90||s.seer.pollution>0)ordinary();
for(let n=0;s.bizarroSorcerer.life.mouse.status==='WILD'&&n<12;n++){
 if(s.bizarroSorcerer.life.mouse.captureAttemptWeek===s.week){ordinary();continue;}rd({type:'CAPTURE_MOUSE'});
 if(s.bizarroSorcerer.life.mouse.status==='HELD')rd({type:'BEGIN_MOUSE_CONTROL'});
 if(s.bizarroSorcerer.life.mouse.status==='INITIAL_CONTROL')rd({type:'COMPLETE_MOUSE_CONTROL',confirmedDeath:true});clear();
}
for(const caseId of ['two-flames','one-way-gift','paired-positions']){
 rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<80&&s.bizarroSorcerer.life.cases[caseId].status!=='RESOLVED';n++){
  let r=s.bizarroSorcerer.life.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<20||s.mind<30){ordinary();continue;}
   const l=s.bizarroSorcerer.life;const ability=caseId==='two-flames'||l.mouse.status==='CONTROLLED'&&(caseId!=='one-way-gift'||!l.worms.split&&l.mouse.spirituality>=3);
   rd({type:'PREPARE',caseId,method:ability?'ABILITY':'ORDINARY'});clear();
  }
  if(s.bizarroSorcerer.life.cases[caseId].status==='PREPARED'){
   rd({type:'PERFORM',caseId});r=s.bizarroSorcerer.life.cases[caseId];
   if(r.method==='ABILITY'){
    if(caseId==='two-flames'){rd({type:'FLAME_OUT'});if(s.bizarroSorcerer.life.practice.ownerAt==='FAR')rd({type:'FLAME_BACK'});}
    else if(caseId==='one-way-gift'){rd({type:'ASSIGN_WORM'});rd({type:'PUPPET_ILLUSION'});rd({type:'RECALL_WORM'});}
    else{rd({type:'WALK_MOUSE_FAR'});rd({type:'SWAP_OUT'});if(s.bizarroSorcerer.life.practice.ownerAt==='FAR')rd({type:'SWAP_BACK'});}
   }
   rd({type:'RETURN_ORDINARY'});rd({type:'CLOSE',caseId});clear();
  }
  if(s.bizarroSorcerer.life.cases[caseId].status==='EXAMINED'){rd({type:'REPORT',caseId});clear();}
 }
 assert.equal(s.bizarroSorcerer.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);practiced=structuredClone(s);
readyFight();const targetId=findTarget();while(s.week<s.bizarroSorcerer.ritual.earliestSurveyWeek)ordinary();rd({type:'SURVEY_RITUAL',targetId});clear();magic('PREPARE_LANTERN');rd({type:'START_CHALLENGE',targetId,confirmed:true});combatStart=structuredClone(s);
for(let round=0;s.combat&&round<100;round++)go({type:'COMBAT_ROUND',stance:round<2?'CONTROL':'ATTACK'});assert.equal(s.combat,null);finish();
