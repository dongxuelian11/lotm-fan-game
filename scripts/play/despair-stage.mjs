import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/pain-v01080/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1800);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/despair-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='DESPAIR'?c.command.type:null;let key=({CONSUME:s.progression.sequence===4?'promotion':'consume',PREPARE:'prepare',PERFORM:c.command?.caseId,WALK_OUT:'walk-out',FOLLOW_UP:'follow-up',RETURN_ROUTE:'return-route',CLOSE:'close',REPORT:'report',ENCOUNTER_AID:'aid',ENCOUNTER_FIGHT:'fight-start'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':c.type==='COMBAT_ROUND'?'combat-round':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,H:s.health,M:s.mind,S:s.spirituality,sequence:s.progression.sequence,acting:s.progression.acting}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'DESPAIR',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
const view=()=>projectSliceState(s).despair;
clear();while(s.cash<540)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<15&&s.progression.sequence===5;n++){
 let b=s.despair.bottles.find(b=>b.status==='SUPPLIER');if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.despair.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.despair.bottles.find(b=>b.status==='SUPPLIER');}
 for(let k=b.labourSteps;k<5;k++){rd({type:'POTION_WORK',bottleId:b.id});clear();}
 while(s.cash<1600||s.week-s.pain.promotionWeek<12||s.health<80||s.mind<80)ordinary();rd({type:'BUY_POTION',bottleId:b.id});clear();rd({type:'CONSUME',bottleId:b.id,confirmed:true});clear();
 if(s.progression.sequence===5)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,4);const promoted=structuredClone(s);
for(const caseId of ['room-clearance','stop-and-check','care-followup']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<100&&s.despair.life.cases[caseId].status!=='RESOLVED';n++){
  const preferred=['PREPARE','PERFORM','WALK_OUT','FOLLOW_UP','RETURN_ROUTE','CLOSE','REPORT'];
  const a=preferred.map(type=>view().actions.find(a=>a.enabled&&a.command.type===type&&(!('caseId'in a.command)||a.command.caseId===caseId)&&!JSON.stringify(a.command).includes('DECLARE_ALL_CURED'))).find(Boolean);
  if(a){rd(a.command);clear();}else{assert(!view().insideCase,'locked without exit: '+JSON.stringify(view().actions));ordinary();}
 }
 assert.equal(s.despair.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
while(s.health<100||s.mind<100||s.spirituality<120)ordinary();
if(!s.witch.tools.mirrorPrepared){if(s.witch.tools.mirrorsHeld<1){while(s.cash<60)ordinary();rd({type:'BUY_SUPPLIES'});clear();}rd({type:'PREPARE_MIRROR'});clear();}
rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
let stopped=false;
for(let n=0;s.combat&&n<100;n++){
 const strength=s.despair.encounter.enemyDisease;
 const stop=!stopped&&s.despair.encounter.fieldActive&&strength>=3;
 go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':stop?'DEFEND':n<4?'CONTROL':'ATTACK'});if(stop)stopped=true;
}
assert.equal(s.combat,null);if(s.status==='ACTIVE')clear();
for(let n=0;n<8&&s.status==='ACTIVE'&&s.despair.encounter.enemyDisease>0&&s.despair.encounter.enemyHealth>0;n++){
 const a=view().actions.find(a=>a.enabled&&a.command.type==='ENCOUNTER_AID');if(a){rd(a.command);clear();}else ordinary();
}
const capture={creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s};
writeFileSync('output/play/despair-stage-natural.json',JSON.stringify(capture));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/despair-${k}-save-boundary.json`,JSON.stringify(b));
mkdirSync('tests/fixtures/despair-v01300',{recursive:true});writeFileSync('tests/fixtures/despair-v01300/natural.json',JSON.stringify(capture));writeFileSync('tests/fixtures/despair-v01300/boundaries.json',JSON.stringify(boundaries));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,spirituality:s.spirituality,bottles:s.despair.bottles.map(b=>b.outcome),life:s.despair.life,encounter:s.despair.encounter,boundaries:Object.keys(boundaries)}));
