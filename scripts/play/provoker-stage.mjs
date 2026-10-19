import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/hunter-v060/natural.json','utf8'));
let s=createSliceRun(old.final.runId,old.creation,old.seed);
for(const i of old.commands){s=applySliceIntent(s,i);assertValidSliceState(s);}assert.deepEqual(s,migrateSliceState(old.final));
const commands=[];let beforeLast=null,lastIntent=null,provocationBoundary=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(intent);if(intent.type==='COMBAT_ROUND'&&s.lastCombatRound.moves.some(m=>m.actor==='PLAYER'&&m.label.includes('挑衅')&&m.selfGain>0)&&!provocationBoundary)provocationBoundary={before:structuredClone(beforeLast),intent,after:structuredClone(s)};console.log(JSON.stringify({step:commands.length,type:intent.command?.type??intent.type,case:intent.command?.caseId,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,check:s.lastCheck?.tier,sequence:s.progression.sequence,acting:s.progression.acting}));}
const provoker=command=>go({type:'PROVOKER',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected actual event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
while(s.cash<180)ordinary();provoker({type:'LEARN_GUIDANCE'});clear();
for(let tries=0;tries<12&&s.progression.sequence!==8;tries++){
 let b=s.provoker.bottles.find(x=>x.status==='SUPPLIER');
 if(!b){provoker({type:'REQUEST_SUPPLY'});clear();const requestWeek=s.provoker.resupply.requestedWeek;while(s.week<=requestWeek)ordinary();provoker({type:'RECEIVE_SUPPLY'});b=s.provoker.bottles.find(x=>x.status==='SUPPLIER');}
 for(let n=0;n<3;n++){provoker({type:'POTION_WORK',bottleId:b.id});clear();}
 while(s.cash<170||s.week-s.progression.promotionWeek<6||s.health<=0||s.mind<=0)ordinary();
 provoker({type:'BUY_POTION',bottleId:b.id});provoker({type:'CONSUME',bottleId:b.id,confirmed:true});
 if(s.progression.sequence!==8)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,8,'No promotion in actual bounded supplies; retain real failure');const promoted=structuredClone(s);
for(const [caseId,choice] of [['invoice-claim','DEESCALATE'],['queue-boast','CHALLENGE'],['yard-hound','ATTRACT']]){
 provoker({type:'OBSERVE',caseId});clear();
 for(let n=0;n<35&&s.provoker.cases[caseId].status!=='COMPLETED';n++){
  if(s.provoker.cases[caseId].attemptWeek===s.week||s.spirituality<2||s.health<50||s.mind<40){ordinary();continue;}
  provoker({type:'CHOOSE',caseId,choice});clear();
 }
 assert.equal(s.provoker.cases[caseId].status,'COMPLETED');
}
while(s.health<80||s.mind<70||s.spirituality<15)ordinary();const beforeEncounter=structuredClone(s);provoker({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'CONTROL'});
assert.equal(s.combat,null);const terminalBoundary={beforeLast:structuredClone(beforeLast),lastIntent,final:structuredClone(s)};
if(s.status==='ACTIVE'&&s.provoker.encounter.status==='RESOLVED'){clear();provoker({type:'REFLECT'});}
writeFileSync('output/play/provoker-stage-natural.json',JSON.stringify({creation:old.creation,seed:old.seed,commands:[...old.commands,...commands],stageCommands:commands,promoted,beforeEncounter,combatStart,provocationBoundary,beforeLast,lastIntent,final:s}));
writeFileSync('output/play/provoker-terminal-save-boundary.json',JSON.stringify(terminalBoundary));
if(provocationBoundary)writeFileSync('output/play/provoker-action-save-boundary.json',JSON.stringify({beforeLast:provocationBoundary.before,lastIntent:provocationBoundary.intent,final:provocationBoundary.after}));
console.log(JSON.stringify({passed:true,totalCommands:old.commands.length+commands.length,stageCommands:commands.length,week:s.week,status:s.status,encounter:s.provoker.encounter,acting:s.progression.acting,mastery:s.progression.mastery,bottles:s.provoker.bottles,provocationBoundary:!!provocationBoundary}));
