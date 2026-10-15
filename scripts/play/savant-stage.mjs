import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {sliceDefaultCreationSelection} from '../../dist/content/slice-creation.js';
const creation={...sliceDefaultCreationSelection,displayName:'伊文'},seed='savant-rebuild-first';
let s=createSliceRun('savant-rebuild-natural',creation,seed),beforeLast=null,lastIntent=null,deliveryBoundary=null;
const commands=[];
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(intent);if(intent.type==='SAVANT'&&intent.command.type==='DELIVER'&&!deliveryBoundary)deliveryBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};console.log(JSON.stringify({step:commands.length,type:intent.command?.type??intent.type,choice:intent.choiceId,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,check:s.lastCheck?.tier,acting:s.progression.acting}));}
const savant=command=>go({type:'SAVANT',command});
const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){let k=0;while(s.activeEvent&&k++<20){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;if(!id)break;pick(id);}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
clear();go({type:'SET_LIFESTYLE',tier:'DESTITUTE'});savant({type:'DISCOVER'});while(s.cash<120)ordinary();savant({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<12&&!s.progression.pathwayId;n++){
 let b=s.savant.bottles.find(x=>x.status==='SUPPLIER');
 if(!b){savant({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.savant.resupply.requestedWeek)ordinary();savant({type:'RECEIVE_SUPPLY'});b=s.savant.bottles.find(x=>x.status==='SUPPLIER');}
 const id=b.id;for(let i=0;i<2;i++){savant({type:'POTION_WORK',bottleId:id});clear();}
 while(s.cash<60||s.week<5||s.mind<=0||s.health<=0)ordinary();savant({type:'BUY_POTION',bottleId:id});savant({type:'CONSUME',bottleId:id,confirmed:true});
 if(!s.progression.pathwayId)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.pathwayId,'paragon');const promoted=structuredClone(s);
for(const projectId of ['shelf-repair','handcart-wheel','lamp-shutter','dispatch-tray']){
 clear();savant({type:'STUDY',projectId});clear();while(s.cash<20)ordinary();savant({type:'PREPARE',projectId});
 if(projectId==='shelf-repair'){savant({type:'RETURN_TOOLS',projectId});savant({type:'PREPARE',projectId});}
 for(let n=0;n<40&&s.savant.projects[projectId].status!=='READY';n++){clear();if(s.savant.projects[projectId].attemptWeek===s.week){ordinary();continue;}savant({type:'CRAFT',projectId});clear();}
 assert.equal(s.savant.projects[projectId].status,'READY');savant({type:'DELIVER',projectId});
}
savant({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const crafted=structuredClone(s);
go({type:'TOWN',command:{type:'VISIT_SHOP'}});clear();while(s.cash<80)ordinary();go({type:'TOWN',command:{type:'BUY_CLUB'}});go({type:'TOWN',command:{type:'EQUIP_CLUB'}});
go({type:'ACTION',action:'INVESTIGATE',targetId:'LIFE-LEAD-NIGHTSHIFT'});pick('A_LEDGER');
while(!s.activeEvent&&s.arc.stage==='WAIT_B')ordinary();if(s.activeEvent?.id==='ARC-B')pick('B_SHARE');if(s.activeEvent?.id==='ARC-REPORT')pick('SKIP');clear();
go({type:'ACTION',action:'INVESTIGATE',targetId:'ARC-C'});pick('C_PURSUIT');const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});assert.equal(s.combat,null);assert.notEqual(s.status,'ACTIVE');
writeFileSync('output/play/savant-stage-natural.json',JSON.stringify({creation,seed,commands,promoted,crafted,combatStart,beforeLast,lastIntent,final:s}));
writeFileSync('output/play/savant-delivery-save-boundary.json',JSON.stringify(deliveryBoundary));
console.log(JSON.stringify({passed:true,commands:commands.length,week:s.week,status:s.status,rounds:s.combatHistory.length,acting:s.progression.acting,mastery:s.progression.mastery}));
