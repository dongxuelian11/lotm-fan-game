import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
const old=JSON.parse(readFileSync('tests/fixtures/archaeologist-v0120/natural.json','utf8'));
const prefix=old.commands.slice(0,old.commands.findIndex(i=>i.type==='ARCHAEOLOGIST'&&i.command.type==='REFLECT')+1);
let s=createSliceRun(old.final.runId,old.creation,old.seed);for(const i of prefix){s=applySliceIntent(s,i);assertValidSliceState(s);}for(const k of ['progression','savant','archaeologist','random'])assert.deepEqual(s[k],old.explored[k]);
const stageCommands=[];let beforeLast=null,lastIntent=null,useBoundary=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);stageCommands.push(intent);if(intent.type==='APPRAISER'&&intent.command.type==='TEST'&&intent.command.itemId==='warm-lamp')useBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};console.log(JSON.stringify({step:stageCommands.length,type:intent.command?.type??intent.type,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,tier:s.lastCheck?.tier,acting:s.progression.acting,spirituality:s.spirituality}));}
const ap=command=>go({type:'APPRAISER',command});const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);pick(id);}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
clear();while(s.cash<240)ordinary();ap({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<12&&s.progression.sequence!==7;n++){
 let b=s.appraiser.bottles.find(x=>x.status==='SUPPLIER');if(!b){ap({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.appraiser.resupply.requestedWeek)ordinary();ap({type:'RECEIVE_SUPPLY'});b=s.appraiser.bottles.find(x=>x.status==='SUPPLIER');}
 const id=b.id;for(let k=0;k<4;k++){ap({type:'POTION_WORK',bottleId:id});clear();}
 while(s.cash<210||s.week-s.archaeologist.promotionWeek<8||s.health<=0||s.mind<=0)ordinary();ap({type:'BUY_POTION',bottleId:id});ap({type:'CONSUME',bottleId:id,confirmed:true});if(s.progression.sequence!==7)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,7);const promoted=structuredClone(s);
for(const itemId of ['echo-brooch','warm-lamp','needle-box']){clear();ap({type:'EXAMINE',itemId});clear();for(let n=0;n<50&&s.appraiser.cases[itemId].status!=='IDENTIFIED';n++){if(s.appraiser.cases[itemId].attemptWeek===s.week||s.spirituality<2||s.mind<30){ordinary();continue;}ap({type:'IDENTIFY',itemId});clear();}assert.equal(s.appraiser.cases[itemId].status,'IDENTIFIED');ap({type:itemId==='needle-box'?'REPORT':'TEST',itemId});clear();}
ap({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const appraised=structuredClone(s);
go({type:'TOWN',command:{type:'VISIT_SHOP'}});clear();while(s.cash<80)ordinary();go({type:'TOWN',command:{type:'BUY_CLUB'}});go({type:'TOWN',command:{type:'EQUIP_CLUB'}});
go({type:'ACTION',action:'INVESTIGATE',targetId:'LIFE-LEAD-NIGHTSHIFT'});pick('A_LEDGER');while(!s.activeEvent&&s.arc.stage==='WAIT_B')ordinary();if(s.activeEvent?.id==='ARC-B')pick('B_SHARE');if(s.activeEvent?.id==='ARC-REPORT')pick('SKIP');clear();go({type:'ACTION',action:'INVESTIGATE',targetId:'ARC-C'});pick('C_PURSUIT');const combatStart=structuredClone(s);for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});assert.equal(s.combat,null);
writeFileSync('output/play/appraiser-stage-natural.json',JSON.stringify({creation:old.creation,seed:old.seed,commands:[...prefix,...stageCommands],stageCommands,promoted,appraised,combatStart,beforeLast,lastIntent,final:s}));assert(useBoundary);writeFileSync('output/play/appraiser-use-save-boundary.json',JSON.stringify(useBoundary));
console.log(JSON.stringify({passed:true,commands:prefix.length+stageCommands.length,newCommands:stageCommands.length,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,rounds:s.combatHistory.length,cases:s.appraiser.cases,bottles:s.appraiser.bottles.map(b=>b.outcome)}));
