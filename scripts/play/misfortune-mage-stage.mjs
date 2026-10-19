import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/winner-v01130/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1800);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/misfortune-mage-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='MISFORTUNE_MAGE'?c.command.type:null;const key=({CONSUME:s.progression.sequence===4?'promotion':'consume',PREPARE:'prepare',PERFORM:c.command?.caseId,SECURE_WEIGHT:'secure-weight',RETURN_BAG:'return-bag',CONFIRM_ACCOUNT:'account-'+c.command?.claim,ACCUMULATE:'accumulate',CLOSE:'close',REPORT:'report',ENCOUNTER_FIGHT:'fight-start'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':c.type==='COMBAT_ROUND'?'combat-round':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,H:s.health,M:s.mind,S:s.spirituality,sequence:s.progression.sequence,acting:s.progression.acting}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'MISFORTUNE_MAGE',command});
function clear(){for(let k=0;k<20;k++){if(!s.activeEvent)return;const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}throw new Error('pending event loop');}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
const view=()=>projectSliceState(s).misfortuneMage;
clear();while(s.cash<540)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<15&&s.progression.sequence===5;n++){
 let b=s.misfortuneMage.bottles.find(b=>b.status==='SUPPLIER');if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.misfortuneMage.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.misfortuneMage.bottles.find(b=>b.status==='SUPPLIER');}
 for(let k=b.labourSteps;k<5;k++){rd({type:'POTION_WORK',bottleId:b.id});clear();}
 while(s.cash<1500||s.week-s.winner.promotionWeek<12||s.health<80||s.mind<80)ordinary();rd({type:'BUY_POTION',bottleId:b.id});clear();rd({type:'CONSUME',bottleId:b.id,confirmed:true});clear();
 if(s.progression.sequence===5)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,4);const promoted=structuredClone(s);
for(const caseId of ['uncertain-weight','willing-throw','honest-forecast']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<160&&s.misfortuneMage.life.cases[caseId].status!=='RESOLVED';n++){
  if(caseId==='willing-throw'&&s.winner.luck.stored<1&&!view().insideCase){const recover=['WITHDRAW','ACCUMULATE'].map(type=>view().actions.find(a=>a.enabled&&a.command.type===type&&(!('caseId'in a.command)||a.command.caseId===caseId))).find(Boolean);if(recover){rd(recover.command);clear();}else ordinary();continue;}
  const preferred=['SECURE_WEIGHT','RETURN_BAG','CONFIRM_ACCOUNT','CLOSE','REPORT','PERFORM','PREPARE','OBSERVE'];
  const a=preferred.map(type=>view().actions.find(a=>a.enabled&&a.command.type===type&&(!('caseId'in a.command)||a.command.caseId===caseId)&&(!('method'in a.command)||a.command.method===(caseId==='honest-forecast'?'ORDINARY':'ABILITY'))&&(!('claim'in a.command)||a.command.claim==='LIMITED'))).find(Boolean);
  if(a){rd(a.command);clear();}else{assert(!view().insideCase,'locked without exit: '+JSON.stringify(view().actions));const a=view().actions.find(a=>a.enabled&&a.command.type==='ACCUMULATE');if(caseId==='willing-throw'&&s.winner.luck.stored<1&&a){rd(a.command);clear();}else ordinary();}
 }
 assert.equal(s.misfortuneMage.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
while(s.health<100||s.mind<100||s.spirituality<120)ordinary();
while(s.winner.luck.stored<3){const a=view().actions.find(a=>a.enabled&&a.command.type==='ACCUMULATE');if(a){rd(a.command);clear();}else ordinary();}rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<100;n++)go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':n<3?'CONTROL':'ATTACK',winnerPolicy:'SPEND_FIRST'});
assert.equal(s.combat,null);if(s.status==='ACTIVE')clear();
const capture={creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s};
writeFileSync('output/play/misfortune-mage-stage-natural.json',JSON.stringify(capture));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/misfortune-mage-${k}-save-boundary.json`,JSON.stringify(b));
mkdirSync('tests/fixtures/misfortune-mage-v01350',{recursive:true});writeFileSync('tests/fixtures/misfortune-mage-v01350/natural.json',JSON.stringify(capture));writeFileSync('tests/fixtures/misfortune-mage-v01350/boundaries.json',JSON.stringify(boundaries));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,spirituality:s.spirituality,bottles:s.misfortuneMage.bottles.map(b=>b.outcome),luck:s.winner.luck,life:s.misfortuneMage.life,encounter:s.misfortuneMage.encounter,boundaries:Object.keys(boundaries)}));
