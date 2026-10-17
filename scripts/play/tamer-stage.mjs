import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/apothecary-v0130/natural.json','utf8'));
const prefix=old.commands.slice(0,old.commands.findIndex(i=>i.type==='APOTHECARY'&&i.command.type==='REFLECT')+1);
let s=createSliceRun(old.final.runId,old.creation,old.seed);for(const i of prefix){s=applySliceIntent(s,i);assertValidSliceState(s);}assert.deepEqual(s,migrateSliceState(old.cared));
const stageCommands=[];let beforeLast=null,lastIntent=null,siteBoundary=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);stageCommands.push(intent);if(intent.type==='TAMER'&&intent.command.type==='ASSIST'&&s.tamer.animals[intent.command.animalId].helped&&!siteBoundary)siteBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};console.log(JSON.stringify({step:stageCommands.length,type:intent.command?.type??intent.type,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,check:s.lastCheck?.tier,acting:s.progression.acting}));}
const tamer=command=>go({type:'TAMER',command});const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;if(!id&&['ARC-B','ARC-REPORT'].includes(e.id))break;assert(id,'Unexpected event '+e.id);pick(id);}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
clear();while(s.cash<180)ordinary();tamer({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<12&&s.progression.sequence!==8;n++){
 let b=s.tamer.bottles.find(x=>x.status==='SUPPLIER');if(!b){tamer({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.tamer.resupply.requestedWeek)ordinary();tamer({type:'RECEIVE_SUPPLY'});b=s.tamer.bottles.find(x=>x.status==='SUPPLIER');}
 const id=b.id;for(let k=0;k<3;k++){tamer({type:'POTION_WORK',bottleId:id});clear();}
 while(s.cash<170||s.week-s.progression.promotionWeek<6||s.health<=0||s.mind<=0)ordinary();tamer({type:'BUY_POTION',bottleId:id});tamer({type:'CONSUME',bottleId:id,confirmed:true});
 if(s.progression.sequence!==8)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,8);const promoted=structuredClone(s);
for(const animalId of ['yard-hound','hillside-goat','rookery-raven']){
 clear();tamer({type:'OBSERVE',animalId});clear();
 for(let n=0;n<60&&!s.tamer.animals[animalId].trained;n++){
  const r=s.tamer.animals[animalId];if(r.trainingAttemptWeek===s.week){ordinary();continue;}
  if(r.foodHeld===0){while(s.cash<12||s.tamer.animals[animalId].foodWeek===s.week)ordinary();tamer({type:'BUY_FEED',animalId});}
  tamer({type:'TRAIN',animalId});clear();
 }
 assert(s.tamer.animals[animalId].trained);
 if(animalId==='yard-hound'){tamer({type:'INVITE',animalId});tamer({type:'RETURN_ANIMAL'});}
 for(let n=0;n<60&&!s.tamer.animals[animalId].helped;n++){
  if(s.tamer.animals[animalId].helpAttemptWeek===s.week){ordinary();continue;}
  tamer({type:'INVITE',animalId});tamer({type:'ASSIST',animalId});clear();
 }
 assert(s.tamer.animals[animalId].helped);assert.equal(s.tamer.companionId,null);
}
tamer({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const explored=structuredClone(s);
go({type:'TOWN',command:{type:'VISIT_SHOP'}});clear();while(s.cash<80)ordinary();go({type:'TOWN',command:{type:'BUY_CLUB'}});go({type:'TOWN',command:{type:'EQUIP_CLUB'}});
go({type:'ACTION',action:'INVESTIGATE',targetId:'LIFE-LEAD-NIGHTSHIFT'});pick('A_LEDGER');while(!s.activeEvent&&s.arc.stage==='WAIT_B')ordinary();if(s.activeEvent?.id==='ARC-B')pick('B_SHARE');if(s.activeEvent?.id==='ARC-REPORT')pick('SKIP');clear();go({type:'ACTION',action:'INVESTIGATE',targetId:'ARC-C'});pick('C_PURSUIT');const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});assert.equal(s.combat,null);assert.notEqual(s.status,'ACTIVE');
writeFileSync('output/play/tamer-stage-natural.json',JSON.stringify({creation:old.creation,seed:old.seed,commands:[...prefix,...stageCommands],stageCommands,promoted,explored,combatStart,beforeLast,lastIntent,final:s}));writeFileSync('output/play/tamer-site-save-boundary.json',JSON.stringify(siteBoundary));console.log(JSON.stringify({passed:true,commands:prefix.length+stageCommands.length,stageCommands:stageCommands.length,week:s.week,status:s.status,rounds:s.combatHistory.length,acting:s.progression.acting}));
