import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/astronomer-v0980/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent,guidanceStart,promoted=null,practiced=null,combatStart=null;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1400);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/alchemist-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='ALCHEMIST'?c.command.type:null;const key=t==='CONSUME'?(s.progression.sequence===4?'promotion':'consume'):({PURCHASE_PLOT:'plot',OPEN_RITUAL:'open',SURVEY:'survey',DRAIN_LIFE:'drain',LEAVE_RITUAL:'leave',PERFORM:'effect',CLOSE:'close',REPORT:'report',ASSEMBLE:'build',BUY_KIT:'kit',MOVE_CREATION:'move',STOP_CREATION:'stop',RETURN_CREATION:'return',RETURN_MATERIAL:'material-return',GUARD_CREATION:'guard',RECHARGE_FRAME:'recharge'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,health:s.health,mind:s.mind,S:s.spirituality,sequence:s.progression.sequence}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'ALCHEMIST',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
function view(){return projectSliceState(s).alchemist;}
function finish(){writeFileSync('output/play/alchemist-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/alchemist-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,complete:!!practiced,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,bottles:s.alchemist.bottles.map(b=>b.outcome),plots:s.alchemist.ritual.plots.map(g=>({id:g.id,status:g.status,dead:g.plants.filter(p=>p.status==='DEAD').length,soil:g.soil.vitality,water:g.pool.waterLitres,bottle:g.consumedBottleId})),boundaries:Object.keys(boundaries)}));}
clear();while(s.cash<520)ordinary();guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let attempt=0;s.progression.sequence===5&&attempt<12;attempt++){
 let bottle=s.alchemist.bottles.find(b=>b.status==='PLAYER');
 if(!bottle){
  bottle=s.alchemist.bottles.find(b=>b.status==='SUPPLIER');
  if(!bottle){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.alchemist.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});bottle=s.alchemist.bottles.find(b=>b.status==='SUPPLIER');}
  for(let n=bottle.labourSteps;n<5;n++){rd({type:'POTION_WORK',bottleId:bottle.id});clear();}
  while(s.cash<1700)ordinary();rd({type:'BUY_POTION',bottleId:bottle.id});clear();
 }
 while(s.health<100||s.mind<100||s.spirituality<100||s.seer.pollution>0||s.week-s.astronomer.promotionWeek<12||s.cash<720)ordinary();
 rd({type:'PURCHASE_PLOT'});clear();const plot=s.alchemist.ritual.plots.at(-1);while(s.week<plot.plannedWeek)ordinary();
 rd({type:'OPEN_RITUAL'});rd({type:'SURVEY'});rd({type:'DRAIN_LIFE',confirmed:true});assert.equal(view().ritual.windowOpen,true);rd({type:'CONSUME',bottleId:bottle.id,confirmed:true});clear();
}
assert.equal(s.progression.sequence,4);promoted=structuredClone(s);
for(const caseId of ['messenger-box','guard-frame','maker-account']){
 clear();while(s.cash<120||s.spirituality<8)ordinary();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<80&&s.alchemist.life.cases[caseId].status!=='RESOLVED';n++){
  const r=s.alchemist.life.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<5||s.cash<120){ordinary();continue;}
   const buy=view().actions.find(a=>a.command.type==='BUY_KIT'&&a.command.caseId===caseId&&a.enabled);if(buy)rd(buy.command);
   rd({type:'PREPARE',caseId,method:caseId==='maker-account'?'ORDINARY':'ABILITY'});clear();
  }
  if(s.alchemist.life.cases[caseId].status==='PREPARED'){
   const assemble=view().actions.find(a=>a.command.type==='ASSEMBLE'&&a.command.caseId===caseId&&a.enabled);if(assemble)rd(assemble.command);
   rd({type:'PERFORM',caseId});
  }
  if(s.alchemist.life.cases[caseId].contactOpen){
   for(const type of ['MOVE_CREATION','GUARD_CREATION','STOP_CREATION','RETURN_CREATION','RETURN_MATERIAL','CLOSE']){
    const a=view().actions.find(a=>a.command.type===type&&a.command.caseId===caseId&&a.enabled);if(a)rd(a.command);
   }
   assert.equal(s.alchemist.life.cases[caseId].contactOpen,false);clear();
  }
  if(s.alchemist.life.cases[caseId].status==='EXAMINED'){rd({type:'REPORT',caseId});clear();}
 }
 assert.equal(s.alchemist.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);practiced=structuredClone(s);
while(s.health<100||s.mind<90||s.spirituality<110||s.cash<40)ordinary();
const recharge=view().actions.find(a=>a.command.type==='RECHARGE_FRAME'&&a.enabled);if(recharge){rd(recharge.command);clear();}
rd({type:'ENCOUNTER_TALK'});rd({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'CONTROL'});
assert.equal(s.combat,null);finish();
