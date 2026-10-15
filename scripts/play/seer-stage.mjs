import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {sliceDefaultCreationSelection} from '../../dist/content/slice-creation.js';
const creation={...sliceDefaultCreationSelection,displayName:'莉娜'};
let s=createSliceRun('seer-rebuild-natural',creation,'seer-rebuild-first');
const commands=[];let beforeLast=null,lastIntent=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(intent);console.log(JSON.stringify({step:commands.length,type:intent.command?.type??intent.type,choice:intent.choiceId,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,profile:s.progression.pathwayId,outcome:s.lastCheck?.tier}));}
const seer=command=>go({type:'SEER',command});
const act=action=>go({type:'ACTION',action});
const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){let i=0;while(s.activeEvent&&i++<15){const e=projectSliceState(s).activeEvent;const wanted=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;if(!wanted)break;pick(wanted);}}
function earn(){clear();if(s.wagePaidWeek!==s.week)act('WORK');else act('REST');clear();}
clear();go({type:'SET_LIFESTYLE',tier:'DESTITUTE'});seer({type:'DISCOVER'});while(s.cash<120)earn();seer({type:'LEARN_FORMULA'});
for(const batch of s.seer.batches.map(b=>b.id)){
 if(s.progression.pathwayId)break;
 for(let k=0;k<2;k++){clear();seer({type:'MATERIAL_WORK',batchId:batch});clear();}
 while(s.cash<120)earn();seer({type:'BUY_MATERIALS',batchId:batch});seer({type:'BREW',batchId:batch});clear();
 while(s.week<5||s.health<=0||s.mind<=0){earn();}
 const bottle=s.seer.bottles.find(b=>b.batchId===batch);seer({type:'CONSUME',bottleId:bottle.id,confirmed:true});
 if(!s.progression.pathwayId){while(s.seer.pollution>0||s.health<80||s.mind<80){act('REST');clear();}}
}
assert.equal(s.progression.pathwayId,'diviner','All actual finite batches failed; keep real outcome.');
const promoted=structuredClone(s);
clear();go({type:'ACTION',action:'LEARN',targetId:'learn.seer-notes'});clear();seer({type:'DIVINE',targetId:'FIRST_CASE'});clear();
go({type:'ACTION',action:'INVESTIGATE',targetId:'LIFE-LEAD-NIGHTSHIFT'});pick('A_WORKERS');
while(!s.activeEvent&&s.arc.stage==='WAIT_B')earn();
if(s.activeEvent?.id==='ARC-B')pick('B_SHARE');if(s.activeEvent?.id==='ARC-REPORT')pick('SKIP');clear();
go({type:'ACTION',action:'INVESTIGATE',targetId:'ARC-C'});pick('C_SIGHT');pick('C_PURSUIT');
const combatStart=structuredClone(s);for(let i=0;s.combat&&s.status==='ACTIVE'&&i<60;i++)go({type:'COMBAT_ROUND',stance:'ATTACK'});
assert.notEqual(s.status,'ACTIVE');
writeFileSync('output/play/seer-stage-natural.json',JSON.stringify({creation,seed:'seer-rebuild-first',commands,promoted,combatStart,beforeLast,lastIntent,final:s}));
console.log(JSON.stringify({passed:true,commands:commands.length,week:s.week,status:s.status,ending:s.ending,mastery:s.progression.mastery,originalBottles:s.seer.bottles}));
