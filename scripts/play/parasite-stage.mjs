import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/dream-stealer-v01060/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1800);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/parasite-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='PARASITE'?c.command.type:null;let key=({CONSUME:s.progression.sequence===4?'promotion':'consume',PREPARE:'prepare',CONSENT_BASIC:'basic-consent',CONSENT_FULL:'full-consent',PERFORM:c.command?.caseId==='deferred-seat'?'thought':'enter',WALK_ROUTE:'walk',TAKE_TOKEN:'take-token',RETURN_TOKEN:'return-token',EXIT_HOST:'separate',RETURN_TO_START:'return',STEP_TO_CHAIR:'chair',RELEASE_THOUGHT:'release-thought',CLOSE:'close',REPORT:'report',RETURN_POWERS:'return-powers',WAIT_POWER_EXPIRY:'expire-powers'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,H:s.health,M:s.mind,S:s.spirituality,sequence:s.progression.sequence,acting:s.progression.acting}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'PARASITE',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
const view=()=>projectSliceState(s).parasite;
clear();while(s.cash<540)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<15&&s.progression.sequence===5;n++){
 let b=s.parasite.bottles.find(b=>b.status==='SUPPLIER');if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.parasite.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.parasite.bottles.find(b=>b.status==='SUPPLIER');}
 for(let k=b.labourSteps;k<5;k++){rd({type:'POTION_WORK',bottleId:b.id});clear();}
 while(s.cash<1600||s.week-s.dreamStealer.promotionWeek<12||s.health<80||s.mind<80)ordinary();rd({type:'BUY_POTION',bottleId:b.id});clear();rd({type:'CONSUME',bottleId:b.id,confirmed:true});clear();
 if(s.progression.sequence===5)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,4);const promoted=structuredClone(s);
for(const caseId of ['shared-senses','limited-control','deferred-seat']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<100&&s.parasite.life.cases[caseId].status!=='RESOLVED';n++){
  const r=s.parasite.life.cases[caseId];
  if(r.status==='OBSERVED'&&!r.contactOpen){if(r.attemptWeek===s.week||s.spirituality<8||s.mind<20||s.cash<80||s.actionsRemaining<2){ordinary();continue;}rd({type:'PREPARE',caseId,method:'ABILITY'});clear();}
  const doEnabled=(type,predicate=()=>true)=>{const a=view().actions.find(a=>a.enabled&&a.command.type===type&&(!('caseId'in a.command)||a.command.caseId===caseId)&&predicate(a.command));if(a){rd(a.command);clear();return true;}return false;};
  for(const type of ['CONSENT_BASIC','PERFORM','WALK_ROUTE','CONSENT_FULL','TAKE_TOKEN','RETURN_TOKEN','EXIT_HOST','STEP_TO_CHAIR'])doEnabled(type);
  doEnabled('RELEASE_THOUGHT',c=>c.mode==='EXECUTE');
  for(const type of ['RETURN_TO_START','CLOSE','REPORT'])doEnabled(type);
 }
 assert.equal(s.parasite.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
while(s.health<100||s.mind<100||s.spirituality<120)ordinary();rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<100;n++)go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':'CONTROL'});assert.equal(s.combat,null);
if(s.status==='ACTIVE'){const wait=view().actions.find(a=>a.enabled&&a.command.type==='WAIT_POWER_EXPIRY');if(wait)rd(wait.command);clear();}
const capture={creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s};
writeFileSync('output/play/parasite-stage-natural.json',JSON.stringify(capture));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/parasite-${k}-save-boundary.json`,JSON.stringify(b));
mkdirSync('tests/fixtures/parasite-v01280',{recursive:true});writeFileSync('tests/fixtures/parasite-v01280/natural.json',JSON.stringify(capture));writeFileSync('tests/fixtures/parasite-v01280/boundaries.json',JSON.stringify(boundaries));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,spirituality:s.spirituality,bottles:s.parasite.bottles.map(b=>b.outcome),life:s.parasite.life,encounter:s.parasite.encounter,boundaries:Object.keys(boundaries)}));
