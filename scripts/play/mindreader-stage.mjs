import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/audience-v080/peaceful.json','utf8'));
const prefix=old.commands.slice(0,old.commands.findIndex(i=>i.type==='AUDIENCE'&&i.command.type==='REFLECT')+1);
let s=createSliceRun(old.final.runId,old.creation,old.seed);for(const i of prefix){s=applySliceIntent(s,i);assertValidSliceState(s);}assert.deepEqual(s,migrateSliceState(old.socialFinal));
const stageCommands=[];let beforeLast=null,lastIntent=null,readingBoundary=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);try{assertValidSliceState(s);}catch(e){writeFileSync('output/play/mindreader-blocker.json',JSON.stringify({beforeLast,lastIntent,after:s}));throw e;}stageCommands.push(intent);if(intent.type==='MINDREADER'&&intent.command.type==='READ'&&s.mindreader.cases[intent.command.caseId].readSucceeded&&!readingBoundary)readingBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};console.log(JSON.stringify({step:stageCommands.length,type:intent.command?.type??intent.type,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,spirituality:s.spirituality,tier:s.lastCheck?.tier,sequence:s.progression.sequence,acting:s.progression.acting}));}
const mr=command=>go({type:'MINDREADER',command});
const act=action=>go({type:'ACTION',action});
const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;if(!id){assert(e.id.startsWith('ARC'),'Unexpected actual event '+e.id);break;}pick(id);}}
function ordinary(){clear();act(s.wagePaidWeek===s.week?'REST':'WORK');clear();}
while(s.cash<180)ordinary();mr({type:'LEARN_FORMULA'});clear();
for(let tries=0;tries<12&&s.progression.sequence!==8;tries++){
 let b=s.mindreader.batches.find(x=>!x.brewed);
 if(!b){mr({type:'REQUEST_SUPPLY'});clear();const w=s.mindreader.resupply.requestedWeek;while(s.week<=w)ordinary();mr({type:'RECEIVE_SUPPLY'});b=s.mindreader.batches.find(x=>!x.brewed);}
 for(let n=0;n<3;n++){mr({type:'MATERIAL_WORK',batchId:b.id});clear();}
 while(s.cash<170||s.week-s.progression.promotionWeek<6||s.health<=0||s.mind<=0)ordinary();
 mr({type:'BUY_MATERIALS',batchId:b.id});mr({type:'BREW',batchId:b.id});clear();mr({type:'CONSUME',bottleId:s.mindreader.bottles.find(x=>x.batchId===b.id).id,confirmed:true});
 if(s.progression.sequence!==8)while(s.seer.pollution>0||s.health<80||s.mind<80){act('REST');clear();}
}
assert.equal(s.progression.sequence,8,'Finite actual attempts failed, retain outcome');const promoted=structuredClone(s);
for(const caseId of ['lost-key','curtain-call','harbor-message']){
 mr({type:'OBSERVE',caseId});clear();
 for(let n=0;n<40&&!s.mindreader.cases[caseId].readSucceeded;n++){
  if(s.spirituality<2||s.mindreader.cases[caseId].readWeek===s.week){ordinary();continue;}
  mr({type:'READ',caseId});clear();
 }
 assert.equal(s.mindreader.cases[caseId].readSucceeded,true);
 for(let n=0;n<40&&s.mindreader.cases[caseId].status!=='RESOLVED';n++){
  if(s.mindreader.cases[caseId].attemptWeek===s.week){ordinary();continue;}
  mr({type:'DISCUSS',caseId,approach:caseId==='harbor-message'?'VERIFY':'ASK'});clear();
 }
 assert.equal(s.mindreader.cases[caseId].status,'RESOLVED');
}
mr({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const socialFinal=structuredClone(s);
go({type:'ACTION',action:'INVESTIGATE',targetId:'LIFE-LEAD-NIGHTSHIFT'});pick('A_OBSERVE');
while(!s.activeEvent&&s.arc.stage==='WAIT_B')ordinary();if(s.activeEvent?.id==='ARC-B')pick('B_SHARE');if(s.activeEvent?.id==='ARC-REPORT')pick('SKIP');clear();
go({type:'ACTION',action:'INVESTIGATE',targetId:'ARC-C'});pick('C_PURSUIT');const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'CONTROL'});
assert.equal(s.combat,null);assert.notEqual(s.status,'ACTIVE');
writeFileSync('output/play/mindreader-stage-natural.json',JSON.stringify({creation:old.creation,seed:old.seed,commands:[...prefix,...stageCommands],stageCommands,promoted,socialFinal,combatStart,beforeLast,lastIntent,final:s}));
writeFileSync('output/play/mindreader-reading-save-boundary.json',JSON.stringify(readingBoundary));
console.log(JSON.stringify({passed:true,commands:prefix.length+stageCommands.length,stageCommands:stageCommands.length,week:s.week,status:s.status,acting:s.progression.acting,mastery:s.progression.mastery}));
