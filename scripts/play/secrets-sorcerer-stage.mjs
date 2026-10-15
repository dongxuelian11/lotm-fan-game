import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/traveler-v01050/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent,guidanceStart,prepared=null,sealed=null,promoted=null,practiced=null,combatStart=null;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<2000);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/secrets-sorcerer-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='SECRETS_SORCERER'?c.command.type:null;let key=({SURVEY_RITUAL:'survey',PREPARE_SEAL:'prepare-seal',START_RITUAL:'start',CONSUME:s.progression.sequence===4?'promotion':'consume',END_RITUAL:'exit',RECORD_SAMPLE:'record',PERFORM:c.command?.caseId==='hidden-room'?'hide':c.command?.caseId==='original-pocket'?'pocket':'banish',EXIT_ROOM:'door-exit',STOP_HIDING:'stop-hide',STORE_ITEM:'store',TAKE_ITEM:'take',RETURN_ITEM:'return-item',STOP_POCKET:'stop-pocket',SECURE_TARGET:'restrain',WAIT_RETURN:'return-target',RELEASE_RESTRAINT:'release',CLOSE:'close',REPORT:'report'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?(s.secretsSorcerer.ritual.phase==='SEALED'?'sealed':'combat-end'):null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,H:s.health,M:s.mind,S:s.spirituality,sequence:s.progression.sequence,ritual:s.secretsSorcerer.ritual.phase}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'SECRETS_SORCERER',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
function view(){return projectSliceState(s).secretsSorcerer;}
function finish(){writeFileSync('output/play/secrets-sorcerer-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,prepared,sealed,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/secrets-sorcerer-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,complete:!!practiced,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,bottles:s.secretsSorcerer.bottles.map(b=>b.outcome),attempts:s.secretsSorcerer.ritual.attempts,boundaries:Object.keys(boundaries)}));}
clear();while(s.cash<520||s.week-s.traveler.promotionWeek<12||s.health<=20||s.mind<=40)ordinary();guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
function availableTarget(){return s.secretsSorcerer.ritual.targets.find(t=>['UNSURVEYED','AVAILABLE'].includes(t.status)&&t.body.health>0);}
function fight(mode,bottle){
 let target=availableTarget();if(!target){rd({type:'REQUEST_NEW_LEAD'});clear();while(s.week<=s.secretsSorcerer.ritual.leadRequestedWeek)ordinary();rd({type:'RECEIVE_LEAD'});target=availableTarget();}
 while(s.week<s.secretsSorcerer.ritual.earliestSurveyWeek||s.health<100||s.mind<100||s.spirituality<(mode==='RITUAL'?100:120)||s.actionsRemaining<3||s.cash<300)ordinary();
 rd({type:'SURVEY_RITUAL',targetId:target.id});rd({type:'PREPARE_SEAL'});prepared??=structuredClone(s);
 rd(mode==='RITUAL'?{type:'START_RITUAL',bottleId:bottle.id,confirmed:true}:{type:'START_CHALLENGE',targetId:target.id,confirmed:true});combatStart=structuredClone(s);
 for(let n=0;s.combat&&n<100;n++)go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':s.secretsSorcerer.ritual.restraintMarks===2?'PREPARE':'CONTROL'});
 assert.equal(s.combat,null);if(s.secretsSorcerer.ritual.phase==='SEALED')sealed??=structuredClone(s);
}
for(let attempt=0;s.progression.sequence===5&&s.status==='ACTIVE'&&attempt<18;attempt++){
 let bottle=s.secretsSorcerer.bottles.find(b=>b.status==='PLAYER');
 if(!bottle){bottle=s.secretsSorcerer.bottles.find(b=>b.status==='SUPPLIER');if(!bottle){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.secretsSorcerer.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});bottle=s.secretsSorcerer.bottles.find(b=>b.status==='SUPPLIER');}for(let n=bottle.labourSteps;n<5;n++){rd({type:'POTION_WORK',bottleId:bottle.id});clear();}while(s.cash<1800)ordinary();rd({type:'BUY_POTION',bottleId:bottle.id});clear();}
 while(s.seer.pollution>0)ordinary();fight('RITUAL',bottle);
 if(s.status!=='ACTIVE')break;
 if(s.secretsSorcerer.ritual.phase==='SEALED'){rd({type:'CONSUME',bottleId:bottle.id,confirmed:true});if(s.progression.sequence===4)promoted=structuredClone(s);}
 rd({type:'END_RITUAL'});clear();
}
if(s.status!=='ACTIVE'){finish();process.exit(0);}assert.equal(s.progression.sequence,4);
for(const caseId of ['hidden-room','original-pocket','temporary-banishment']){
 clear();while(s.spirituality<20||s.cash<100)ordinary();rd({type:'OBSERVE',caseId});clear();
 const action=type=>view().actions.find(a=>a.command.type===type&&(!('caseId'in a.command)||a.command.caseId===caseId)&&a.enabled);
 const doEnabled=type=>{const a=action(type);if(a){rd(a.command);clear();return true;}return false;};
 for(let n=0;n<100&&s.secretsSorcerer.life.cases[caseId].status!=='RESOLVED';n++){
  const r=s.secretsSorcerer.life.cases[caseId];
  if(r.status==='OBSERVED'){if(r.attemptWeek===s.week||s.spirituality<12||s.cash<100||s.actionsRemaining<2){ordinary();continue;}rd({type:'PREPARE',caseId,method:'ABILITY'});clear();}
  doEnabled('SECURE_TARGET');doEnabled('PERFORM');
  if(caseId==='original-pocket'&&s.secretsSorcerer.life.pocket.mode!=='NONE'){
   for(const type of ['STORE_ITEM','TAKE_ITEM','RETURN_ITEM'])for(const itemId of ['SS4-CARD-1','SS4-COIN-1','SS4-SEALED-STONE-1']){const a=view().actions.find(a=>a.command.type===type&&a.command.itemId===itemId&&a.enabled);if(a)rd(a.command);}
  }
  for(const type of ['EXIT_ROOM','STOP_HIDING','STOP_POCKET','WAIT_RETURN','RELEASE_RESTRAINT','CLOSE','REPORT'])doEnabled(type);
 }
 assert.equal(s.secretsSorcerer.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);practiced=structuredClone(s);
// Actual inherited demonstration is independent of the new magical pocket.
while(s.spirituality<10||s.actionsRemaining<1)ordinary();const record=view().actions.find(a=>a.enabled&&a.command.type==='RECORD_SAMPLE'&&a.command.sample==='FLASH');if(record){rd(record.command);clear();}
fight('CHALLENGE',null);if(s.status==='ACTIVE'){rd({type:'END_RITUAL'});clear();}finish();
