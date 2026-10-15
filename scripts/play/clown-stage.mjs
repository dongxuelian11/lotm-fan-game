import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const origin=JSON.parse(readFileSync('tests/fixtures/seer-v040/natural.json','utf8'));
let s=createSliceRun(origin.final.runId,origin.creation,origin.seed);
for(const intent of origin.commands){s=applySliceIntent(s,intent);assertValidSliceState(s);}
assert.deepEqual(s,migrateSliceState(origin.final));
const commands=[];let beforeLast=null,lastIntent=null,paperBoundary=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(intent);if(intent.type==='COMBAT_ROUND'&&s.clown.paperSpent>beforeLast.clown.paperSpent)paperBoundary={before:structuredClone(beforeLast),intent,after:structuredClone(s)};console.log(JSON.stringify({step:commands.length,type:intent.command?.type??intent.type,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,sequence:s.progression.sequence,check:s.lastCheck?.tier,paper:s.clown.paperSheets}));}
const clown=command=>go({type:'CLOWN',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const choice=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(choice,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:choice});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
while(s.cash<180)ordinary();clown({type:'LEARN_FORMULA'});
for(const b of s.clown.batches){
 if(s.progression.sequence===8)break;
 for(let i=0;i<3;i++){clear();clown({type:'MATERIAL_WORK',batchId:b.id});clear();}
 while(s.cash<170)ordinary();clown({type:'BUY_MATERIALS',batchId:b.id});clown({type:'BREW',batchId:b.id});clear();
 while(s.week-s.progression.promotionWeek<6||s.mind<=0||s.health<=0)ordinary();
 clown({type:'CONSUME',bottleId:s.clown.bottles.find(x=>x.batchId===b.id).id,confirmed:true});
 if(s.progression.sequence!==8)while(s.seer.pollution>0||s.mind<80||s.health<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,8,'All finite real batches failed; do not change the seed.');
const promoted=structuredClone(s);clown({type:'BUY_PAPER'});
for(const id of ['balance-rehearsal','paper-target','composed-apology']){
 for(let i=0;i<30&&!s.clown.practices.includes(id);i++){
  clear();if(s.clown.trainingAttempts[id]===s.week||s.spirituality<2){ordinary();continue;}
  clown({type:'PRACTICE',practiceId:id});
 }
 assert(s.clown.practices.includes(id),'Practice not completed within finite real attempts.');
}
clear();const beforeRescue=structuredClone(s);clown({type:'RESCUE_FIGHT'});const combatStart=structuredClone(s);
for(let i=0;s.combat&&i<60;i++)go({type:'COMBAT_ROUND',stance:'ATTACK'});
assert.equal(s.combat,null);assert.notEqual(s.clown.rescue.status,'FIGHTING');
assert.equal(s.clown.paperStock+s.clown.paperSheets+s.clown.paperSpent,30);
writeFileSync('output/play/clown-stage-natural.json',JSON.stringify({creation:origin.creation,seed:origin.seed,commands:[...origin.commands,...commands],stageCommands:commands,promoted,beforeRescue,combatStart,paperBoundary,beforeLast,lastIntent,final:s}));
console.log(JSON.stringify({passed:true,totalCommands:origin.commands.length+commands.length,newCommands:commands.length,week:s.week,status:s.status,rescue:s.clown.rescue,paper:{stock:s.clown.paperStock,held:s.clown.paperSheets,spent:s.clown.paperSpent},bottles:s.clown.bottles,mastery:s.progression.mastery}));
