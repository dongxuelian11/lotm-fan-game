import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/crimson-scholar-v0990/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent,guidanceStart,promoted=null,practiced=null,combatStart=null;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1400);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/witch-king-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='WITCH_KING'?c.command.type:null;const key=t==='CONSUME'?(s.progression.sequence===4?'promotion':'consume'):({BOOK_RITUAL:'book',BEGIN_RITUAL:'open',CHECK_PREPARATION:'check',END_RITUAL:'end',PERFORM:'effect',CLOSE:'close',REPORT:'report',BUY_PAPERS:'paper-buy',PREPARE_PAPER:'paper-prepare',RETURN:'return',INSPECT:'inspect',STOP_EFFECT:'stop'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,health:s.health,mind:s.mind,S:s.spirituality,sequence:s.progression.sequence}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'WITCH_KING',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
function view(){return projectSliceState(s).witchKing;}
function finish(){writeFileSync('output/play/witch-king-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/witch-king-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,complete:!!practiced,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,bottles:s.witchKing.bottles.map(b=>b.outcome),visits:s.witchKing.ritual.visits.map(v=>({id:v.id,status:v.status,kit:v.kit.status,bottle:v.consumedBottleId})),papers:s.witchKing.life.papers.map(p=>({id:p.id,status:p.status,by:p.consumedBy})),boundaries:Object.keys(boundaries)}));}
clear();while(s.cash<520)ordinary();guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let attempt=0;s.progression.sequence===5&&attempt<12;attempt++){
 let bottle=s.witchKing.bottles.find(b=>b.status==='PLAYER');
 if(!bottle){
  bottle=s.witchKing.bottles.find(b=>b.status==='SUPPLIER');
  if(!bottle){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.witchKing.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});bottle=s.witchKing.bottles.find(b=>b.status==='SUPPLIER');}
  for(let n=bottle.labourSteps;n<5;n++){rd({type:'POTION_WORK',bottleId:bottle.id});clear();}
  while(s.cash<1700)ordinary();rd({type:'BUY_POTION',bottleId:bottle.id});clear();
 }
 while(s.health<100||s.mind<100||s.spirituality<100||s.seer.pollution>0||s.week-s.crimsonScholar.promotionWeek<12||s.cash<240)ordinary();
 rd({type:'BOOK_RITUAL'});clear();const visit=s.witchKing.ritual.visits.at(-1);while(s.week<visit.plannedWeek)ordinary();
 rd({type:'BEGIN_RITUAL'});rd({type:'CHECK_PREPARATION',confirmed:true});assert.equal(view().ritual.windowOpen,true);rd({type:'CONSUME',bottleId:bottle.id,confirmed:true});clear();
}
assert.equal(s.progression.sequence,4);promoted=structuredClone(s);
for(const caseId of ['paper-trial','arrow-target','moon-return']){
 clear();while(s.cash<60||s.spirituality<12)ordinary();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<80&&s.witchKing.life.cases[caseId].status!=='RESOLVED';n++){
  const r=s.witchKing.life.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<10||s.cash<60){ordinary();continue;}
   if(caseId==='paper-trial'&&!s.witchKing.life.papers.some(p=>p.status!=='CONSUMED')){const a=view().actions.find(a=>a.command.type==='BUY_PAPERS'&&a.enabled);if(!a){ordinary();continue;}rd(a.command);clear();}
   rd({type:'PREPARE',caseId,method:'ABILITY'});clear();
  }
  if(s.witchKing.life.cases[caseId].status==='PREPARED'){
   if(caseId==='paper-trial'&&!s.witchKing.life.papers.some(p=>p.status==='PREPARED')){const paper=s.witchKing.life.papers.find(p=>p.status==='HELD');assert(paper);rd({type:'PREPARE_PAPER',paperId:paper.id});}
   rd({type:'PERFORM',caseId});
  }
  if(s.witchKing.life.cases[caseId].contactOpen){
   if(s.witchKing.life.practice.location==='END'){
    const ability=view().actions.find(a=>a.command.type==='RETURN'&&a.command.method==='ABILITY'&&a.enabled);if(ability)rd(ability.command);
    if(s.witchKing.life.practice.location==='END')rd({type:'RETURN',method:'ORDINARY'});
   }
   for(const type of ['STOP_EFFECT','INSPECT','CLOSE']){const a=view().actions.find(a=>a.command.type===type&&a.command.caseId===caseId&&a.enabled);if(a)rd(a.command);}
   assert.equal(s.witchKing.life.cases[caseId].contactOpen,false);clear();
  }
  if(s.witchKing.life.cases[caseId].status==='EXAMINED'){rd({type:'REPORT',caseId});clear();}
 }
 assert.equal(s.witchKing.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);practiced=structuredClone(s);
while(s.health<100||s.mind<90||s.spirituality<110||s.cash<40)ordinary();
if(!s.witchKing.life.papers.some(p=>p.status!=='CONSUMED')){while(!view().actions.some(a=>a.command.type==='BUY_PAPERS'&&a.enabled))ordinary();rd({type:'BUY_PAPERS'});clear();}
const paper=s.witchKing.life.papers.find(p=>p.status==='HELD');if(paper){rd({type:'PREPARE_PAPER',paperId:paper.id});clear();}
rd({type:'ENCOUNTER_TALK'});rd({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'CONTROL'});
assert.equal(s.combat,null);finish();
