import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/provoker-v070/natural.json','utf8'));
let s=createSliceRun(old.final.runId,old.creation,old.seed);for(const i of old.commands){s=applySliceIntent(s,i);assertValidSliceState(s);}const prior=migrateSliceState(old.final);for(const k of ['progression','hunter','provoker','injuries','random'])assert.deepEqual(s[k],prior[k]);
const stageCommands=[];let beforeLast=null,lastIntent=null,laneBoundary=null,fireBoundary=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);stageCommands.push(intent);if(intent.type==='PYROMANIAC'&&intent.command.type==='CLEAR_LANE')laneBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};if(intent.type==='COMBAT_ROUND'&&s.lastCombatRound.moves.some(m=>m.actor==='PLAYER'&&/压缩火球|火焰长枪|火鸦|控火|火焰控制/.test(m.label)&&m.selfGain+m.enemyReduction>0)&&!fireBoundary)fireBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};console.log(JSON.stringify({step:stageCommands.length,type:intent.command?.type??intent.type,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,check:s.lastCheck?.tier,acting:s.progression.acting,spirituality:s.spirituality}));}
const pyro=command=>go({type:'PYROMANIAC',command});const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);pick(id);}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
clear();while(s.cash<240)ordinary();pyro({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<12&&s.progression.sequence!==7;n++){
 let b=s.pyromaniac.bottles.find(x=>x.status==='SUPPLIER');if(!b){pyro({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.pyromaniac.resupply.requestedWeek)ordinary();pyro({type:'RECEIVE_SUPPLY'});b=s.pyromaniac.bottles.find(x=>x.status==='SUPPLIER');}
 const id=b.id;for(let k=0;k<4;k++){pyro({type:'POTION_WORK',bottleId:id});clear();}
 while(s.cash<210||s.week-s.provoker.promotionWeek<8||s.health<=0||s.mind<=0)ordinary();pyro({type:'BUY_POTION',bottleId:id});pyro({type:'CONSUME',bottleId:id,confirmed:true});
 if(s.progression.sequence!==7)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,7);const promoted=structuredClone(s);
for(const id of ['kiln-heat','arc-target','night-warmth']){
 for(let n=0;n<50&&!s.pyromaniac.practices.includes(id);n++){
  clear();if(s.pyromaniac.practiceAttempts[id]===s.week||s.spirituality<3||s.health<50||s.mind<30){ordinary();continue;}pyro({type:'PRACTICE',practiceId:id});clear();
 }assert(s.pyromaniac.practices.includes(id));
}
const practiced=structuredClone(s);pyro({type:'SURVEY_ENCOUNTER'});clear();const surveyed=structuredClone(s);pyro({type:'CLEAR_LANE'});clear();
while(s.health<90||s.mind<80||s.spirituality<45){go({type:'ACTION',action:'REST'});clear();}
pyro({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;n<60&&s.combat;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});
assert.equal(s.combat,null);const terminal=structuredClone(s);
if(s.status==='ACTIVE'&&s.pyromaniac.encounter.status==='RESOLVED'){clear();pyro({type:'REFLECT'});clear();}
writeFileSync('output/play/pyromaniac-stage-natural.json',JSON.stringify({creation:old.creation,seed:old.seed,commands:[...old.commands,...stageCommands],stageCommands,promoted,practiced,surveyed,combatStart,terminal,fireBoundary,beforeLast,lastIntent,final:s}));
assert(laneBoundary);writeFileSync('output/play/pyromaniac-lane-save-boundary.json',JSON.stringify(laneBoundary));if(fireBoundary)writeFileSync('output/play/pyromaniac-fire-save-boundary.json',JSON.stringify(fireBoundary));
console.log(JSON.stringify({passed:true,totalCommands:old.commands.length+stageCommands.length,newCommands:stageCommands.length,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,encounter:s.pyromaniac.encounter,rounds:s.combatHistory.length-combatStart.combatHistory.length,actualFire:fireBoundary!==null,bottles:s.pyromaniac.bottles.map(b=>b.outcome)}));
