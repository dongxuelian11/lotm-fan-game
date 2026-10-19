import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/mindreader-v090/natural.json','utf8'));
let s=createSliceRun(old.final.runId,old.creation,old.seed);for(const i of old.commands){s=applySliceIntent(s,i);assertValidSliceState(s);}const prior=migrateSliceState(old.final);for(const k of ['progression','audience','mindreader','injuries','random'])assert.deepEqual(s[k],prior[k]);
const stageCommands=[];let beforeLast=null,lastIntent=null,socialBoundary=null,mentalBoundary=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);stageCommands.push(intent);if(intent.type==='PSYCHOLOGIST'&&intent.command.type==='SUPPORT'&&s.psychologist.cases[intent.command.caseId].status==='SUPPORTED'&&!socialBoundary)socialBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};if(intent.type==='COMBAT_ROUND'&&s.lastCombatRound.moves.some(m=>m.actor==='PLAYER'&&/狂乱|震慑|暗示|安抚/.test(m.label)&&m.selfGain+m.enemyReduction>0)&&!mentalBoundary)mentalBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};console.log(JSON.stringify({step:stageCommands.length,type:intent.command?.type??intent.type,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,check:s.lastCheck?.tier,acting:s.progression.acting,spirituality:s.spirituality}));}
const psy=command=>go({type:'PSYCHOLOGIST',command});const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);pick(id);}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
if(s.status==='SLICE_COMPLETE')go({type:'CONTINUE_LIFE'});clear();while(s.cash<240)ordinary();psy({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<12&&s.progression.sequence!==7;n++){
 let b=s.psychologist.bottles.find(x=>x.status==='SUPPLIER');if(!b){psy({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.psychologist.resupply.requestedWeek)ordinary();psy({type:'RECEIVE_SUPPLY'});b=s.psychologist.bottles.find(x=>x.status==='SUPPLIER');}
 const id=b.id;for(let k=0;k<4;k++){psy({type:'POTION_WORK',bottleId:id});clear();}
 while(s.cash<210||s.week-s.mindreader.promotionWeek<8||s.health<=0||s.mind<=0)ordinary();psy({type:'BUY_POTION',bottleId:id});psy({type:'CONSUME',bottleId:id,confirmed:true});
 if(s.progression.sequence!==7)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,7);const promoted=structuredClone(s);
for(const [id,method] of [['night-watch','SOOTHE'],['stage-fright','SUGGEST'],['unsettled-letter','COMMUNICATE']]){
 clear();psy({type:'OBSERVE',caseId:id});clear();
 for(let n=0;n<60&&s.psychologist.cases[id].status!=='SUPPORTED';n++){
  const r=s.psychologist.cases[id];if(r.attemptWeek===s.week||s.spirituality<3||s.health<50||s.mind<30){ordinary();continue;}psy({type:'SUPPORT',caseId:id,method});clear();
 }assert.equal(s.psychologist.cases[id].status,'SUPPORTED');
 for(let n=0;n<60&&s.psychologist.cases[id].status!=='RESOLVED';n++){if(s.psychologist.cases[id].attemptWeek===s.week){ordinary();continue;}psy({type:'DISCUSS',caseId:id});clear();}assert.equal(s.psychologist.cases[id].status,'RESOLVED');
}
psy({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const peaceful=structuredClone(s);
psy({type:'OBSERVE_ENCOUNTER'});clear();while(s.health<90||s.mind<80||s.spirituality<45){go({type:'ACTION',action:'REST'});clear();}psy({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);for(let n=0;n<60&&s.combat;n++)go({type:'COMBAT_ROUND',stance:'CONTROL'});assert.equal(s.combat,null);
writeFileSync('output/play/psychologist-stage-natural.json',JSON.stringify({creation:old.creation,seed:old.seed,commands:[...old.commands,...stageCommands],stageCommands,promoted,peaceful,combatStart,mentalBoundary,beforeLast,lastIntent,final:s}));assert(socialBoundary);writeFileSync('output/play/psychologist-social-save-boundary.json',JSON.stringify(socialBoundary));if(mentalBoundary)writeFileSync('output/play/psychologist-mental-save-boundary.json',JSON.stringify(mentalBoundary));
console.log(JSON.stringify({passed:true,totalCommands:old.commands.length+stageCommands.length,newCommands:stageCommands.length,week:s.week,status:s.status,sequence:s.progression.sequence,peacefulActing:peaceful.progression.acting,encounter:s.psychologist.encounter,rounds:s.combatHistory.length-combatStart.combatHistory.length,actualMental:mentalBoundary!==null,bottles:s.psychologist.bottles.map(b=>b.outcome)}));
