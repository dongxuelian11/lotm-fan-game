import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/savant-v0110/natural.json','utf8'));
const prefix=old.commands.slice(0,old.commands.findIndex(i=>i.type==='SAVANT'&&i.command.type==='REFLECT')+1);
let s=createSliceRun(old.final.runId,old.creation,old.seed);for(const i of prefix){s=applySliceIntent(s,i);assertValidSliceState(s);}assert.deepEqual(s,migrateSliceState(old.crafted));
const stageCommands=[];let beforeLast=null,lastIntent=null,siteBoundary=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);stageCommands.push(intent);if(intent.type==='ARCHAEOLOGIST'&&intent.command.type==='EXPLORE'&&s.archaeologist.sites[intent.command.siteId].status==='RESOLVED'&&!siteBoundary)siteBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};console.log(JSON.stringify({step:stageCommands.length,type:intent.command?.type??intent.type,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,check:s.lastCheck?.tier,acting:s.progression.acting}));}
const arch=command=>go({type:'ARCHAEOLOGIST',command});const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);pick(id);}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
clear();while(s.cash<180)ordinary();arch({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<12&&s.progression.sequence!==8;n++){
 let b=s.archaeologist.bottles.find(x=>x.status==='SUPPLIER');if(!b){arch({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.archaeologist.resupply.requestedWeek)ordinary();arch({type:'RECEIVE_SUPPLY'});b=s.archaeologist.bottles.find(x=>x.status==='SUPPLIER');}
 const id=b.id;for(let k=0;k<3;k++){arch({type:'POTION_WORK',bottleId:id});clear();}
 while(s.cash<170||s.week-s.progression.promotionWeek<6||s.health<=0||s.mind<=0)ordinary();arch({type:'BUY_POTION',bottleId:id});arch({type:'CONSUME',bottleId:id,confirmed:true});
 if(s.progression.sequence!==8)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,8);const promoted=structuredClone(s);
for(const [siteId,approach] of [['cellar-arch','COMPARE'],['old-waypost','CAREFUL'],['sealed-store','COMPARE']]){clear();arch({type:'SURVEY',siteId});clear();for(let n=0;n<40&&s.archaeologist.sites[siteId].status!=='RESOLVED';n++){if(s.archaeologist.sites[siteId].attemptWeek===s.week){ordinary();continue;}arch({type:'EXPLORE',siteId,approach});clear();}assert.equal(s.archaeologist.sites[siteId].status,'RESOLVED');}
arch({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const explored=structuredClone(s);
go({type:'TOWN',command:{type:'VISIT_SHOP'}});clear();while(s.cash<80)ordinary();go({type:'TOWN',command:{type:'BUY_CLUB'}});go({type:'TOWN',command:{type:'EQUIP_CLUB'}});
go({type:'ACTION',action:'INVESTIGATE',targetId:'LIFE-LEAD-NIGHTSHIFT'});pick('A_LEDGER');while(!s.activeEvent&&s.arc.stage==='WAIT_B')ordinary();if(s.activeEvent?.id==='ARC-B')pick('B_SHARE');if(s.activeEvent?.id==='ARC-REPORT')pick('SKIP');clear();go({type:'ACTION',action:'INVESTIGATE',targetId:'ARC-C'});pick('C_PURSUIT');const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});assert.equal(s.combat,null);assert.notEqual(s.status,'ACTIVE');
writeFileSync('output/play/archaeologist-stage-natural.json',JSON.stringify({creation:old.creation,seed:old.seed,commands:[...prefix,...stageCommands],stageCommands,promoted,explored,combatStart,beforeLast,lastIntent,final:s}));writeFileSync('output/play/archaeologist-site-save-boundary.json',JSON.stringify(siteBoundary));console.log(JSON.stringify({passed:true,commands:prefix.length+stageCommands.length,stageCommands:stageCommands.length,week:s.week,status:s.status,rounds:s.combatHistory.length,acting:s.progression.acting}));
