import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/werewolf-v0590/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<650,'finite natural command bound');beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/zombie-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='ZOMBIE'?c.command.type:null;const key=t==='CONSUME'?(s.progression.sequence===6?'promotion':'consume'):t==='HANDLE_MOON'?'moon':t==='PERFORM'?'effect':t==='CLOSE'?'close':t==='REPORT'?'report':c.type==='COMBAT_ROUND'&&!s.combat?'combat':null;if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,ap:s.actionsRemaining,S:s.spirituality,health:s.health,tier:s.lastCheck?.tier}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'ZOMBIE',command});
function clear(){while(s.activeEvent||s.werewolf.moon.pendingWeek!==null||s.zombie.moon.pendingWeek!==null){if(s.zombie.moon.pendingWeek!==null){rd({type:'HANDLE_MOON',method:s.zombie.moon.history.length%2===0?'GUARDED':'ALONE'});continue;}if(s.werewolf.moon.pendingWeek!==null){go({type:'WEREWOLF',command:{type:'HANDLE_MOON',method:'GUARDED'}});continue;}const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
if(s.status==='SLICE_COMPLETE')go({type:'CONTINUE_LIFE'});clear();while(s.cash<360)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<12&&s.progression.sequence===7;n++){
 let b=s.zombie.bottles.find(b=>b.status==='SUPPLIER');if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.zombie.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.zombie.bottles.find(b=>b.status==='SUPPLIER');}
 for(let k=b.labourSteps;k<5;k++){rd({type:'POTION_WORK',bottleId:b.id});clear();}
 while(s.cash<320||s.week-s.werewolf.promotionWeek<12||s.health<60||s.mind<60)ordinary();rd({type:'BUY_POTION',bottleId:b.id});clear();rd({type:'CONSUME',bottleId:b.id,confirmed:true});clear();
 if(s.progression.sequence===7)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,6);const promoted=structuredClone(s);
for(const caseId of ['narrow-load','cold-tray','willing-spirit']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<120&&s.zombie.cases[caseId].status!=='RESOLVED';n++){
  const r=s.zombie.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<8||s.mind<30){ordinary();continue;}
   rd({type:'PREPARE',caseId,method:'ABILITY'});clear();
  }
  if(s.zombie.cases[caseId].status==='PREPARED'){
   rd({type:'PERFORM',caseId});if(s.zombie.cases[caseId].contactOpen)rd({type:'CLOSE',caseId});clear();
  }
  if(s.zombie.cases[caseId].status==='EXAMINED'){rd({type:'REPORT',caseId});clear();}
 }
 assert.equal(s.zombie.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
for(let n=0;s.zombie.moon.history.length<1&&n<120;n++)ordinary();assert(s.zombie.moon.history.length>=1,'actual new-curse moon event');while(s.health<90||s.mind<80||s.spirituality<75)ordinary();rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK',madmanPolicy:n%2===0?'BURST_FIRST':'HOLD'});
assert.equal(s.combat,null);
writeFileSync('output/play/zombie-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));
for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/zombie-${k}-save-boundary.json`,JSON.stringify(b));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,rounds:s.combatHistory.length-practiced.combatHistory.length,health:s.health,moon:s.zombie.moon,practice:s.zombie.practice,encounter:s.zombie.encounter,bottles:s.zombie.bottles.map(b=>b.outcome),boundaries:Object.keys(boundaries)}));
