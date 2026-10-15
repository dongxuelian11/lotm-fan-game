import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/faceless-v0730/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){
 assert(commands.length<850,'finite natural command bound');beforeLast=structuredClone(s);lastIntent=c;
 try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/marionettist-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}
 commands.push(c);const t=c.type==='MARIONETTIST'?c.command.type:null;
 const key=t==='CONSUME'?(s.progression.sequence===5?'promotion':'consume'):({GO_RITUAL:'ritual',BEGIN_SONG:'song',RETURN_CLUB:'return',PREPARE:'prepare',PERFORM:'effect',CLOSE:'close',REPORT:'report',BEGIN_CAPTURE:'capture-begin',COMPLETE_CAPTURE:'capture-complete',PUPPET_DELIVER:'puppet-use',DISMISS_PUPPET:'puppet-release',RELEASE_CONTROL:'living-release',MOVE_BEYOND_RANGE:'range-release'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':null);
 if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};
 console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,ap:s.actionsRemaining,S:s.spirituality,health:s.health,tier:s.lastCheck?.tier}));
}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'MARIONETTIST',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
if(s.status==='SLICE_COMPLETE')go({type:'CONTINUE_LIFE'});clear();while(s.cash<420)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_FORMULA'});clear();
for(let n=0;n<12&&s.progression.sequence===6;n++){
 let batch=s.marionettist.batches.find(b=>!b.brewed);
 if(!batch){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.marionettist.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});batch=s.marionettist.batches.find(b=>!b.brewed);}
 for(let k=batch.labourSteps;k<5;k++){rd({type:'MATERIAL_WORK',batchId:batch.id});clear();}
 while(s.cash<460||s.week-s.faceless.promotionWeek<12||s.health<80||s.mind<80)ordinary();
 rd({type:'BUY_MATERIALS',batchId:batch.id});rd({type:'BREW',batchId:batch.id});clear();
 rd({type:'REQUEST_RITUAL'});clear();while(s.week<=s.marionettist.ritual.requestedWeek||s.cash<80)ordinary();
 rd({type:'GO_RITUAL'});rd({type:'BEGIN_SONG'});rd({type:'CONSUME',bottleId:`${batch.id}:bottle`,confirmed:true});rd({type:'END_SONG'});rd({type:'RETURN_CLUB'});clear();
 if(s.progression.sequence===6)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,5);const promoted=structuredClone(s);
for(const caseId of ['living-lines','controlled-release','break-contact']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<120&&s.marionettist.cases[caseId].status!=='RESOLVED';n++){
  const r=s.marionettist.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<8||s.mind<30){ordinary();continue;}
   rd({type:'PREPARE',caseId,method:'ABILITY'});clear();
  }
  if(s.marionettist.cases[caseId].status==='PREPARED'){
   rd({type:'PERFORM',caseId});if(s.marionettist.cases[caseId].contactOpen)rd({type:'CLOSE',caseId});clear();
  }
  if(s.marionettist.cases[caseId].status==='EXAMINED'){rd({type:'REPORT',caseId});clear();}
 }
 assert.equal(s.marionettist.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
while(s.health<90||s.mind<80||s.spirituality<90||s.actionsRemaining<3)ordinary();rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});
assert.equal(s.combat,null);const fought=structuredClone(s);
if(s.status==='ACTIVE'&&s.marionettist.puppet.target?.status==='SURRENDERED'){
 rd({type:'BEGIN_CAPTURE'});
 if(s.marionettist.puppet.target?.status==='INITIAL_CONTROL')rd({type:'COMPLETE_CAPTURE',confirmedDeath:true});
 if(s.marionettist.puppet.active){rd({type:'PUPPET_DELIVER'});rd({type:'DISMISS_PUPPET'});clear();}
}
writeFileSync('output/play/marionettist-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,fought,beforeLast,lastIntent,final:s}));
for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/marionettist-${k}-save-boundary.json`,JSON.stringify(b));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,rounds:s.combatHistory.length-practiced.combatHistory.length,health:s.health,encounter:s.marionettist.encounter,puppet:s.marionettist.puppet,bottles:s.marionettist.bottles.map(b=>b.outcome),boundaries:Object.keys(boundaries)}));
