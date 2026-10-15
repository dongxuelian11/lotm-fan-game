import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const origin=JSON.parse(readFileSync('output/play/seer-stage-natural.json','utf8'));
let s=migrateSliceState(origin.final), beforeLast=null,lastIntent=null;
const commands=[];
const world=structuredClone(s.world), ending=structuredClone(s.ending);
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(intent);console.log(JSON.stringify({step:commands.length,type:intent.command?.type??intent.type,case:intent.command?.caseId,week:s.week,ap:s.actionsRemaining,acting:s.progression.acting,completed:s.seer.practice.cases.filter(x=>x.status==='COMPLETED').length,check:s.lastCheck?.tier}));}
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const choice=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(choice,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:choice});}}
go({type:'CONTINUE_LIFE'});
for(let i=0;i<180&&!s.seer.practice.reflected;i++){
 clear();
 const p=projectSliceState(s).seer.practice;
 if(p.reflection.enabled){go({type:'SEER',command:p.reflection.command});continue;}
 if(s.health<80||s.mind<80||s.spirituality<3){go({type:'ACTION',action:'REST'});continue;}
 if(s.wagePaidWeek!==s.week){go({type:'ACTION',action:'WORK'});continue;}
 const row=p.cases.find(x=>s.seer.practice.cases.find(y=>y.id===x.id)?.status!=='COMPLETED'&&x.choices.some(c=>c.enabled));
 if(row){const choice=row.choices.find(c=>c.enabled);go({type:'SEER',command:choice.command});}
 else go({type:'ACTION',action:'REST'});
}
assert(s.seer.practice.reflected,'Finite natural route did not finish; preserve actual outcome.');
assert.equal(s.progression.acting,100);assert.equal(s.seer.practice.cases.filter(x=>x.status==='COMPLETED').length,8);assert.deepEqual(s.caseArchive,[ending]);assert.deepEqual(s.world,world);
writeFileSync('output/play/seer-commissions-natural.json',JSON.stringify({creation:origin.creation,seed:origin.seed,commands:[...origin.commands,...commands],stageCommands:commands,beforeLast,lastIntent,final:s}));
console.log(JSON.stringify({passed:true,totalCommands:origin.commands.length+commands.length,newCommands:commands.length,week:s.week,acting:s.progression.acting,mastery:s.progression.mastery,cases:s.seer.practice.cases}));
