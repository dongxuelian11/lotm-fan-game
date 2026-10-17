import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/clown-v050/natural.json','utf8'));
let s=createSliceRun(old.final.runId,old.creation,old.seed);for(const i of old.commands){s=applySliceIntent(s,i);assertValidSliceState(s);}// Older captured narrative predates later supply/continue-life wording; replay all original commands on current code.
assert.deepEqual(s.progression,old.final.progression);assert.deepEqual(s.clown,migrateSliceState(old.final).clown);assert.deepEqual(s.injuries,old.final.injuries);assert.deepEqual(s.random,old.final.random);
const stageCommands=[];let beforeLast=null,lastIntent=null,practiceBoundary=null,transferBoundary=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);stageCommands.push(intent);if(intent.type==='MAGICIAN'&&intent.command.type==='TRANSFER_INJURY')transferBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};if(intent.type==='MAGICIAN'&&intent.command.type==='PRACTICE'&&s.magician.practices.length>beforeLast.magician.practices.length&&!practiceBoundary)practiceBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};console.log(JSON.stringify({step:stageCommands.length,type:intent.command?.type??intent.type,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,check:s.lastCheck?.tier,acting:s.progression.acting,spirituality:s.spirituality}));}
const magic=command=>go({type:'MAGICIAN',command});const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);pick(id);}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
for(const id of ['quiet-support','unexpected-stage']){for(let k=0;k<40&&!s.clown.practices.includes(id);k++){clear();if(s.clown.trainingAttempts[id]===s.week||s.spirituality<1){ordinary();continue;}go({type:'CLOWN',command:{type:'PRACTICE',practiceId:id}});}assert(s.clown.practices.includes(id));}
assert.equal(s.progression.acting,100);clear();while(s.cash<240)ordinary();magic({type:'LEARN_FORMULA'});clear();
for(let n=0;n<12&&s.progression.sequence!==7;n++){
 let b=s.magician.batches.find(x=>!x.acquired);if(!b){magic({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.magician.resupply.requestedWeek)ordinary();magic({type:'RECEIVE_SUPPLY'});b=s.magician.batches.find(x=>!x.acquired);}
 const id=b.id;for(let k=0;k<4;k++){magic({type:'MATERIAL_WORK',batchId:id});clear();}
 while(s.cash<210||s.week-s.clown.promotionWeek<8||s.health<=0||s.mind<=0)ordinary();magic({type:'BUY_MATERIALS',batchId:id});magic({type:'BREW',batchId:id});clear();magic({type:'CONSUME',bottleId:s.magician.bottles.find(x=>x.batchId===id).id,confirmed:true});
 if(s.progression.sequence!==7)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,7);const promoted=structuredClone(s);clear();const oldInjury=s.injuries.find(i=>i.severity==='HEAVY');if(oldInjury){while(s.spirituality<3)ordinary();magic({type:'TRANSFER_INJURY',injuryId:oldInjury.id});clear();}
function oil(){while(s.cash<12||(s.magician.lantern.oilStock===0&&s.magician.lantern.lastSupplyWeek===s.week))ordinary();magic({type:'BUY_OIL'});magic({type:'PREPARE_LANTERN'});}
function paper(){if(s.clown.paperSheets===0){while(s.cash<20)ordinary();go({type:'CLOWN',command:{type:'BUY_PAPER'}});}}
for(const id of ['lamplit-step','air-target','consenting-audience','shallow-water','loose-rope','paper-weapon']){
 for(let n=0;n<50&&!s.magician.practices.includes(id);n++){
  clear();if(s.magician.practiceAttempts[id]===s.week||s.spirituality<5||s.health<50||s.mind<30){ordinary();continue;}
  if(id==='lamplit-step')oil();if(id==='paper-weapon')paper();magic({type:'PRACTICE',practiceId:id});clear();
 }
 assert(s.magician.practices.includes(id));
}
const practiced=structuredClone(s);
while(s.health<90||s.mind<70||s.spirituality<45){go({type:'ACTION',action:'REST'});clear();}
paper();magic({type:'PREPARE_FIGURINE'});clear();paper();magic({type:'PREPARE_FIGURINE'});clear();
while(s.spirituality<45){go({type:'ACTION',action:'REST'});clear();}oil();magic({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;n<60&&s.combat;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});
assert.equal(s.combat,null);const terminal=structuredClone(s);
if(s.status==='ACTIVE'&&s.magician.encounter.status==='RESOLVED'){clear();magic({type:'REFLECT'});clear();}
writeFileSync('output/play/magician-stage-natural.json',JSON.stringify({creation:old.creation,seed:old.seed,commands:[...old.commands,...stageCommands],stageCommands,promoted,transferBoundary,practiced,combatStart,terminal,beforeLast,lastIntent,final:s}));
if(transferBoundary)writeFileSync('output/play/magician-transfer-save-boundary.json',JSON.stringify(transferBoundary));
assert(practiceBoundary);writeFileSync('output/play/magician-practice-save-boundary.json',JSON.stringify(practiceBoundary));
console.log(JSON.stringify({passed:true,totalCommands:old.commands.length+stageCommands.length,newCommands:stageCommands.length,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,encounter:s.magician.encounter,rounds:s.combatHistory.length-combatStart.combatHistory.length,figurines:s.magician.figurinesUsed,oil:s.magician.lantern,bottles:s.magician.bottles.map(b=>b.outcome)}));
