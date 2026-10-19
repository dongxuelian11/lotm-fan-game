import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {sliceDefaultCreationSelection} from '../../dist/content/slice-creation.js';
const creation={...sliceDefaultCreationSelection,displayName:'艾琳'},seed='apothecary-rebuild-first';
let s=createSliceRun('apothecary-rebuild-natural',creation,seed),beforeLast=null,lastIntent=null,careBoundary=null;
const commands=[];
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(intent);if(intent.type==='APOTHECARY'&&intent.command.type==='CARE'&&!careBoundary)careBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};console.log(JSON.stringify({step:commands.length,type:intent.command?.type??intent.type,choice:intent.choiceId,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,check:s.lastCheck?.tier,acting:s.progression.acting}));}
const apothecary=command=>go({type:'APOTHECARY',command});
const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){let k=0;while(s.activeEvent&&k++<20){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;if(!id)break;pick(id);}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
clear();go({type:'SET_LIFESTYLE',tier:'DESTITUTE'});apothecary({type:'DISCOVER'});while(s.cash<120)ordinary();apothecary({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<12&&!s.progression.pathwayId;n++){
 let b=s.apothecary.bottles.find(x=>x.status==='SUPPLIER');
 if(!b){apothecary({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.apothecary.resupply.requestedWeek)ordinary();apothecary({type:'RECEIVE_SUPPLY'});b=s.apothecary.bottles.find(x=>x.status==='SUPPLIER');}
 const id=b.id;for(let i=0;i<2;i++){apothecary({type:'POTION_WORK',bottleId:id});clear();}
 while(s.cash<60||s.week<5||s.mind<=0||s.health<=0)ordinary();apothecary({type:'BUY_POTION',bottleId:id});apothecary({type:'CONSUME',bottleId:id,confirmed:true});
 if(!s.progression.pathwayId)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.pathwayId,'moon');const promoted=structuredClone(s);
function medicine(kind){for(let n=0;n<30&&s.apothecary.clinic[kind==='HEALING'?'healing':'calming']<1;n++){clear();if(s.apothecary.clinic.materials===0){while(s.cash<36||s.apothecary.clinic.supplyWeek===s.week)ordinary();apothecary({type:'BUY_SUPPLIES'});}apothecary({type:'PREPARE_MEDICINE',kind});clear();}assert(s.apothecary.clinic[kind==='HEALING'?'healing':'calming']>0);}
medicine('HEALING');medicine('CALMING');
for(const caseId of ['workshop-cut','night-fever','shaken-courier']){clear();apothecary({type:'EXAMINE',caseId});clear();apothecary({type:'CARE',caseId,choice:caseId==='night-fever'?'REFER':'CARE'});clear();}
apothecary({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const cared=structuredClone(s);
go({type:'TOWN',command:{type:'VISIT_SHOP'}});clear();while(s.cash<80)ordinary();go({type:'TOWN',command:{type:'BUY_CLUB'}});go({type:'TOWN',command:{type:'EQUIP_CLUB'}});
go({type:'ACTION',action:'INVESTIGATE',targetId:'LIFE-LEAD-NIGHTSHIFT'});pick('A_LEDGER');
while(!s.activeEvent&&s.arc.stage==='WAIT_B')ordinary();if(s.activeEvent?.id==='ARC-B')pick('B_SHARE');if(s.activeEvent?.id==='ARC-REPORT')pick('SKIP');clear();
go({type:'ACTION',action:'INVESTIGATE',targetId:'ARC-C'});pick('C_PURSUIT');const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});assert.equal(s.combat,null);assert.notEqual(s.status,'ACTIVE');
writeFileSync('output/play/apothecary-stage-natural.json',JSON.stringify({creation,seed,commands,promoted,cared,combatStart,beforeLast,lastIntent,final:s}));
writeFileSync('output/play/apothecary-care-save-boundary.json',JSON.stringify(careBoundary));
console.log(JSON.stringify({passed:true,commands:commands.length,week:s.week,status:s.status,rounds:s.combatHistory.length,acting:s.progression.acting,mastery:s.progression.mastery}));
