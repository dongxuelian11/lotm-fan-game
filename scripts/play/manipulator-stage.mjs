import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/dreamwalker-v0970/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent,guidanceStart,promoted=null,practiced=null,combatStart=null;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1400);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/manipulator-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='MANIPULATOR'?c.command.type:null;const key=t==='CONSUME'?(s.progression.sequence===4?'promotion':'consume'):({BUY_MATERIALS:'materials',COLLECT_TEAR:'tear',BREW:'brew',BOOK_GATHERING:'book',OPEN_GATHERING:'open',ARRIVE_GROUP:'arrival',RESONATE:'resonance',LEAVE_GATHERING:'leave',PERFORM:'effect',CLOSE:'close',REPORT:'report',VERIFY:'verify',CREATE_PERSONA:'persona',WITHDRAW_PERSONA:'rejoin',AID_ENEMY:'aid'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,health:s.health,mind:s.mind,S:s.spirituality,sequence:s.progression.sequence}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'MANIPULATOR',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
function view(){return projectSliceState(s).manipulator;}
function finish(){writeFileSync('output/play/manipulator-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/manipulator-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,complete:!!practiced,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,bottles:s.manipulator.bottles.map(b=>b.outcome),gatherings:s.manipulator.ritual.gatherings.map(g=>({id:g.id,status:g.status,arrived:g.groups.reduce((n,x)=>n+x.arrivedCount,0),resonance:g.resonanceOutcome,window:g.windowWeek,bottle:g.consumedBottleId})),boundaries:Object.keys(boundaries)}));}
clear();while(s.cash<520)ordinary();guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let attempt=0;s.progression.sequence===5&&attempt<12;attempt++){
 let bottle=s.manipulator.bottles.find(b=>b.status==='PLAYER');
 if(!bottle){
  let batch=s.manipulator.batches.find(b=>b.status!=='BREWED');
  if(!batch){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.manipulator.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});batch=s.manipulator.batches.find(b=>b.status==='SUPPLIER');}
  if(batch.status==='SUPPLIER'){for(let n=batch.labourSteps;n<5;n++){rd({type:'MATERIAL_WORK',batchId:batch.id});clear();}while(s.cash<1200)ordinary();rd({type:'BUY_MATERIALS',batchId:batch.id});clear();}
  for(const donorId of ['MP4-D1','MP4-D2','MP4-D3','MP4-D4','MP4-D5','MP4-D6','MP4-D7']){rd({type:'COLLECT_TEAR',batchId:batch.id,donorId});clear();}
  rd({type:'BREW',batchId:batch.id});clear();bottle=s.manipulator.bottles.find(b=>b.status==='PLAYER');
 }
 while(s.health<100||s.mind<100||s.spirituality<100||s.seer.pollution>0||s.week-s.dreamwalker.promotionWeek<12||s.cash<300)ordinary();
 for(let eventAttempt=0;eventAttempt<20;eventAttempt++){
  while(s.cash<300)ordinary();rd({type:'BOOK_GATHERING'});clear();const g=s.manipulator.ritual.gatherings.at(-1);while(s.week<g.plannedWeek)ordinary();rd({type:'OPEN_GATHERING'});
  for(const groupId of ['MP4-NORTH','MP4-EAST','MP4-SOUTH','MP4-WEST'])rd({type:'ARRIVE_GROUP',groupId});
  const resonance=view().actions.find(a=>a.command.type==='RESONATE'&&a.enabled);if(resonance)rd(resonance.command);
  if(view().ritual.windowOpen){rd({type:'CONSUME',bottleId:bottle.id,confirmed:true});clear();break;}
  rd({type:'LEAVE_GATHERING'});clear();ordinary();
 }
}
if(s.progression.sequence!==4){finish();process.exit(0);}promoted=structuredClone(s);
// Actual finite practice and encounter commands are appended after their interfaces freeze.
for(const caseId of ['consenting-island','divided-attention','plague-model']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<80&&s.manipulator.life.cases[caseId].status!=='RESOLVED';n++){
  const r=s.manipulator.life.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<8||s.mind<35||s.health<30){ordinary();continue;}
   rd({type:'PREPARE',caseId,method:caseId==='plague-model'?'ORDINARY':'ABILITY'});clear();
  }
  if(s.manipulator.life.cases[caseId].status==='PREPARED'){
   if(caseId==='consenting-island')rd({type:'CONSENT'});
   rd({type:'PERFORM',caseId});
   if(caseId==='consenting-island')rd({type:'STOP'});
   if(caseId==='divided-attention'){rd({type:'CREATE_PERSONA'});rd({type:'PERSONA_TASK'});rd({type:'WITHDRAW_PERSONA'});rd({type:'RETURN_PAPER'});}
   if(s.manipulator.life.cases[caseId].result!=='NONE')rd({type:'VERIFY',caseId});
   rd({type:'CLOSE',caseId});clear();
  }
  if(s.manipulator.life.cases[caseId].status==='EXAMINED'){rd({type:'REPORT',caseId});clear();}
 }
 assert.equal(s.manipulator.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);practiced=structuredClone(s);
while(s.health<95||s.mind<95||s.spirituality<115||s.actionsRemaining<2)ordinary();
rd({type:'ENCOUNTER_TALK'});rd({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'CONTROL'});
assert.equal(s.combat,null);
while(s.status==='ACTIVE'&&s.manipulator.encounter.enemy.status!=='DEAD'&&s.manipulator.encounter.mentalPlague>0){
 const help=view().actions.find(a=>a.command.type==='AID_ENEMY'&&a.enabled);if(help){rd(help.command);clear();}else ordinary();
}
finish();
