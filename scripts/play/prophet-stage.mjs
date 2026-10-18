import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/mysticism-magister-v01010/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent,guidanceStart,promoted=null,practiced=null,combatStart=null;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1400);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/prophet-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='PROPHET'?c.command.type:null;const key=t==='CONSUME'?(s.progression.sequence===4?'promotion':'consume'):({BOOK_RITUAL:'book',BEGIN_RITUAL:'open',CHECK_PREPARATION:'check',END_RITUAL:'end',PERFORM:c.command?.caseId==='blue-door'?'dream':'omen',INTERPRET:'interpret',VERIFY:c.command?.caseId==='blue-door'?'parcel':c.command?.caseId==='uncertain-helper'?'helper-verify':'verify',MEET_HELPER:'meet',ASK_HELP:c.command?.personId==='PF4-JONAS'?'help':'decline',RETURN_PAGES:'return',CLOSE:'close',REPORT:'report',STOP_EFFECT:'stop',MAKE_FLASH:'make'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(t==='CLOSE'&&s.prophet.life.cases[c.command.caseId].status==='WAITING'&&!boundaries.waiting)boundaries.waiting={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,health:s.health,mind:s.mind,S:s.spirituality,sequence:s.progression.sequence}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'PROPHET',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
function view(){return projectSliceState(s).prophet;}
function finish(){writeFileSync('output/play/prophet-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/prophet-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,complete:!!practiced,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,bottles:s.prophet.bottles.map(b=>b.outcome),visits:s.prophet.ritual.visits.map(v=>({id:v.id,status:v.status,kit:v.kit.status,bottle:v.consumedBottleId})),crafts:s.mysticismMagister.crafts,boundaries:Object.keys(boundaries)}));}
clear();while(s.cash<520)ordinary();guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let attempt=0;s.progression.sequence===5&&attempt<12;attempt++){
 let bottle=s.prophet.bottles.find(b=>b.status==='PLAYER');
 if(!bottle){
  bottle=s.prophet.bottles.find(b=>b.status==='SUPPLIER');
  if(!bottle){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.prophet.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});bottle=s.prophet.bottles.find(b=>b.status==='SUPPLIER');}
  for(let n=bottle.labourSteps;n<5;n++){rd({type:'POTION_WORK',bottleId:bottle.id});clear();}
  while(s.cash<1700)ordinary();rd({type:'BUY_POTION',bottleId:bottle.id});clear();
 }
 while(s.health<100||s.mind<100||s.spirituality<100||s.seer.pollution>0||s.week-s.mysticismMagister.promotionWeek<12||s.cash<240)ordinary();
 rd({type:'BOOK_RITUAL'});clear();const visit=s.prophet.ritual.visits.at(-1);while(s.week<visit.plannedWeek)ordinary();
 rd({type:'BEGIN_RITUAL'});rd({type:'CHECK_PREPARATION',confirmed:true});assert.equal(view().ritual.windowOpen,true);rd({type:'CONSUME',bottleId:bottle.id,confirmed:true});clear();
}
assert.equal(s.progression.sequence,4);promoted=structuredClone(s);
for(const caseId of ['loose-shutter','blue-door','uncertain-helper']){
 clear();while(s.spirituality<15)ordinary();rd({type:'OBSERVE',caseId});clear();
 const hypothesis=caseId==='loose-shutter'?'LOOSE_FASTENER':caseId==='blue-door'?'DELAYED_DELIVERY':'RECENT_CONTACT';
 const action=(type,match=()=>true)=>view().actions.find(a=>a.command.type===type&&(!('caseId'in a.command)||a.command.caseId===caseId)&&match(a.command)&&a.enabled);
 for(let n=0;n<100&&s.prophet.life.cases[caseId].status!=='RESOLVED';n++){
  let r=s.prophet.life.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<10){ordinary();continue;}
   rd({type:'PREPARE',caseId,method:'ABILITY'});clear();
  }
  if(s.prophet.life.cases[caseId].status==='PREPARED')rd({type:'PERFORM',caseId});
  for(const type of ['INTERPRET','STOP_EFFECT','CLOSE']){
   const a=action(type,c=>type!=='INTERPRET'||c.hypothesis===hypothesis);if(a)rd(a.command);
  }
  clear();r=s.prophet.life.cases[caseId];
  if(r.status==='WAITING'){
   if(caseId==='uncertain-helper'){
    for(const personId of ['PF4-NORA','PF4-JONAS'])for(const type of ['MEET_HELPER','ASK_HELP']){
     const a=action(type,c=>c.personId===personId);if(a){rd(a.command);clear();}
    }
   }
   const a=action('VERIFY');if(a){rd(a.command);clear();}else{ordinary();continue;}
  }
  for(const type of ['RETURN_PAGES','CLOSE','REPORT']){const a=action(type);if(a){rd(a.command);clear();}}
 }
 assert.equal(s.prophet.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);practiced=structuredClone(s);
while(s.health<100||s.mind<90||s.spirituality<110||s.cash<40||s.actionsRemaining<2)ordinary();
rd({type:'ENCOUNTER_TALK'});rd({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'CONTROL'});
assert.equal(s.combat,null);finish();
