import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/druid-v01160/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1800);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/ancient-alchemist-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='ANCIENT_ALCHEMIST'?c.command.type:null;const key=({CONSUME:s.progression.sequence===4?'promotion':'consume',PREPARE:'prepare',PERFORM:c.command?.caseId,OBSERVE_RECOVERY:'observe-recovery',TEST_MATRIX:'test-matrix',STOP_MATRIX:'stop-matrix',RETURN_SAMPLE:'return-sample',HAND_OVER:'hand-over',BUY_KIT:'buy-kit',PREPARE_GUARD:'prepare-guard',CLOSE:'close',REPORT:'report',ENCOUNTER_FIGHT:'fight-start'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':c.type==='COMBAT_ROUND'?'combat-round':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,H:s.health,M:s.mind,S:s.spirituality,sequence:s.progression.sequence,acting:s.progression.acting}));}
for(const c of old.commands)go(c);
const expectedPrefix=migrateSliceState(old.final);
// The historical capture predates this one already-fixed punctuation typo. Keep every other original field exact.
const historicalEntry=expectedPrefix.chronicle.find(e=>e.id==='record-305-496');
const oldText='马伦仍活着并自行停止抵抗，，原棍仍归本人，各自原身体在稳定的原地面。任何已用的短地下潜行均已当次再出，不把人留在地下；仅本人存活且实际有效参战才给予一次单项掌握25，不增加扮演、不治疗或补灵性。';
assert.equal(historicalEntry?.text,oldText);historicalEntry.text=oldText.replace('停止抵抗，，','停止抵抗，');
assert.deepEqual(s,expectedPrefix);const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'ANCIENT_ALCHEMIST',command});
function clear(){for(let k=0;k<20;k++){if(!s.activeEvent)return;const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}throw new Error('pending event loop');}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
const view=()=>projectSliceState(s).ancientAlchemist;
clear();while(s.cash<540)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<15&&s.progression.sequence===5;n++){
 let b=s.ancientAlchemist.bottles.find(b=>b.status==='SUPPLIER');if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.ancientAlchemist.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.ancientAlchemist.bottles.find(b=>b.status==='SUPPLIER');}
 for(let k=b.labourSteps;k<5;k++){rd({type:'POTION_WORK',bottleId:b.id});clear();}
 while(s.cash<1500||s.week-s.druid.promotionWeek<12||s.health<80||s.mind<80)ordinary();rd({type:'BUY_POTION',bottleId:b.id});clear();rd({type:'CONSUME',bottleId:b.id,confirmed:true});clear();
 if(s.progression.sequence===5)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,4);const promoted=structuredClone(s);
for(const caseId of ['living-stem','living-fibre','honest-handover']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<160&&s.ancientAlchemist.life.cases[caseId].status!=='RESOLVED';n++){
  const preferred=['OBSERVE_RECOVERY','TEST_MATRIX','STOP_MATRIX','RETURN_SAMPLE','HAND_OVER','CLOSE','REPORT','PERFORM','PREPARE','BUY_KIT','RECEIVE_KITS','REQUEST_KITS','OBSERVE'];
  const a=preferred.map(type=>view().actions.find(a=>a.enabled&&a.command.type===type&&(!('caseId'in a.command)||a.command.caseId===caseId)&&(!('method'in a.command)||a.command.method===(caseId==='honest-handover'?'ORDINARY':'ABILITY')))).find(Boolean);
  if(a){rd(a.command);clear();}else{assert(!view().insideCase,'locked without exit: '+JSON.stringify(view().actions));const recover=view().actions.find(a=>a.enabled&&a.command.type==='WITHDRAW'&&a.command.caseId===caseId);if(recover){rd(recover.command);clear();}ordinary();}
 }
 assert.equal(s.ancientAlchemist.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
while(s.health<100||s.mind<100||s.spirituality<120)ordinary();
const guard=view().actions.find(a=>a.enabled&&a.command.type==='PREPARE_GUARD');assert(guard,'real guard preparation unavailable');rd(guard.command);clear();
rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<100;n++)go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':n<3?'CONTROL':'ATTACK'});
assert.equal(s.combat,null);if(s.status==='ACTIVE')clear();
const capture={creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s};
writeFileSync('output/play/ancient-alchemist-stage-natural.json',JSON.stringify(capture));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/ancient-alchemist-${k}-save-boundary.json`,JSON.stringify(b));
mkdirSync('tests/fixtures/ancient-alchemist-v01380',{recursive:true});writeFileSync('tests/fixtures/ancient-alchemist-v01380/natural.json',JSON.stringify(capture));writeFileSync('tests/fixtures/ancient-alchemist-v01380/boundaries.json',JSON.stringify(boundaries));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,spirituality:s.spirituality,bottles:s.ancientAlchemist.bottles.map(b=>b.outcome),life:s.ancientAlchemist.life,encounter:s.ancientAlchemist.encounter,boundaries:Object.keys(boundaries)}));
