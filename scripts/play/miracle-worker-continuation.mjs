import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/miracle-worker-v01640/natural.json','utf8'));
const root='tests/fixtures/miracle-worker-v01640';mkdirSync(root,{recursive:true});mkdirSync('output/play',{recursive:true});
const creation=old.creation,seed=old.seed,commands=[],prefixCount=old.commands.length,boundaries={};let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent,departureStart,promoted,practiced,combatStart;
function capture(key){boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};}
function go(c,key){assert(commands.length<1200,'bounded run');beforeLast=structuredClone(s);lastIntent=c;s=applySliceIntent(s,c);assertValidSliceState(s);commands.push(c);if(key)capture(key);if(commands.length>prefixCount)console.log(JSON.stringify({step:commands.length,command:c,week:s.week,AP:s.actionsRemaining,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,sequence:s.progression.sequence,status:s.status,location:s.miracleWorker.ritual.location}));}
function mw(c,key){const match=projectSliceState(s).miracleWorker.actions.find(a=>JSON.stringify(a.command)===JSON.stringify(c));assert(match?.enabled,`Public action unavailable ${JSON.stringify(c)} ${match?.reason}`);go({type:'MIRACLE_WORKER',command:c},key);}
function future(){if(s.actionsRemaining===0){if(s.cash<24)mw({type:'WORK'});mw({type:'NEXT_WEEK'});}else mw({type:s.cash<500?'WORK':s.health<100||s.mind<100||s.spirituality<120||s.seer.pollution>0||s.injuryRisk>0?'REST':'WORK'});}
function ready({ap=1,cash=0,H=0,M=0,S=0,clean=false,afterWeek=-1}={}){let count=0;while(s.actionsRemaining<ap||s.cash<cash||s.health<H||s.mind<M||s.spirituality<S||clean&&(s.injuryRisk>0||s.injuries.some(i=>i.treatedRevision===null))||s.week<=afterWeek){assert(count++<250);future();}}
function action(c,key){ready();mw(c,key);}
function save(stage){const data={provenance:{kind:'SAME_SEED_FULL_PUBLIC_NATURAL_CONTINUATION',source:'tests/fixtures/miracle-worker-v01640/natural.json',randomChanges:false},creation,seed,commands,prefixCount,departureStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s,stage};writeFileSync(`${root}/continuation.json`,JSON.stringify(data));writeFileSync(`${root}/continuation-boundaries.json`,JSON.stringify(boundaries));writeFileSync('output/play/miracle-worker-continuation.json',JSON.stringify(data));console.log(JSON.stringify({passed:true,stage,commands:commands.length,status:s.status,sequence:s.progression.sequence,bottles:s.miracleWorker.bottles.map(b=>b.outcome),revival:s.miracleWorker.revival.used,boundaries:Object.keys(boundaries)}));}
try{
 for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));assert.equal(prefixCount,767);departureStart=structuredClone(s);
 if(s.ancientScholar.ritual.location==='OUTSIDE')go({type:'ANCIENT_SCHOLAR',command:{type:'ENTER_RECEPTION'}},'actual-reception-return');
 ready({cash:1100,H:100,M:100,S:120,clean:true});
 for(let attempt=0;attempt<3&&s.progression.sequence===3;attempt++){
  ready({ap:1,cash:96});mw({type:'REQUEST_NEW_LEAD'},`lead-paid-${attempt+1}`);const requestWeek=s.week;ready({afterWeek:requestWeek,cash:48});mw({type:'VERIFY_NEW_LEAD'},`lead-confirmed-next-week-${attempt+1}`);const i=s.miracleWorker.ritual.sources.length-1;
  const b=s.miracleWorker.batches[i],q=s.miracleWorker.ritual.sources[i];
  ready({cash:900,H:100,M:100,S:120,afterWeek:i?s.miracleWorker.ritual.sources[i-1].registeredWeek:-1});
  for(let n=0;n<3;n++)action({type:'MATERIAL_WORK',batchId:b.id});mw({type:'BUY_MATERIALS',batchId:b.id},`buy-materials-${i+1}`);action({type:'BREW',batchId:b.id},`brew-${i+1}`);
  for(const step of ['ARCHIVE','ANCHOR'])action({type:'INVESTIGATE_SOURCE',sourceId:q.id,step},`${i+1}-investigate-${step}`);
  action({type:'PREPARE_RETURN_KIT',sourceId:q.id},`kit-${i+1}`);mw({type:'REGISTER_RETURN_PLAN',sourceId:q.id,bottleId:`${b.id}:bottle`},`registered-${i+1}`);
  ready({H:100,M:100,S:120,cash:24});mw({type:'TRAVEL_TO_GATE',sourceId:q.id},`actual-arrival-${i+1}`);
  mw({type:'SURVEY_GATE'});mw({type:'CONTACT_SETTLEMENT'});mw({type:'REPAIR_ANCHOR'},`repair-original-${i+1}`);if(!s.miracleWorker.ritual.sources[i].repairDone)mw({type:'REWORK_ANCHOR'},`repair-failed-original-rework-${i+1}`);
  mw({type:'OPEN_PASSAGE',confirmed:true},`open-real-gate-${i+1}`);for(const destination of ['GATE_IN','COURTYARD','ARCHIVE'])mw({type:'MOVE',destination});
  mw({type:'VERIFY_GENERATIONS'},`generations-${i+1}`);mw({type:'INVITE_REPRESENTATIVES'},`adult-choices-${i+1}`);for(const destination of ['COURTYARD','GATE_IN','GATE_OUT'])mw({type:'MOVE',destination});
  for(let n=1;n<=7;n++)mw({type:'OBSERVE_EXCHANGE'},n===7?`irreversible-history-return-${i+1}`:n===4?`original-exchange-${i+1}`:undefined);
  mw({type:'CONSUME',bottleId:`${b.id}:bottle`,confirmed:true},s.miracleWorker.promotionWeek?'promotion':`consume-${i+1}`);if(s.progression.sequence===2){promoted=structuredClone(s);capture('promotion');}
  mw({type:'LEAVE_RITUAL'},`real-exit-${i+1}`);
 }
 if(s.progression.sequence!==2){save('CONTINUED_REAL_NEW_SOURCES_AND_POTION_FAILURES');process.exit(0);}
 ready({cash:240,H:100,M:100,S:120,clean:true});
 for(const caseId of ['small-repairs','limited-odds','familiar-court']){
  ready({ap:3,cash:100,S:20,M:30});mw({type:'OBSERVE',caseId});mw({type:'START',caseId},`life-start-${caseId}`);
  if(caseId==='small-repairs'){
   mw({type:'BUY_REPAIR_KIT'});for(const ownerId of ['mara','oswin','tessa'])for(const type of ['TAKE_ITEM','INSPECT_ITEM','FIX_ITEM','RETURN_ITEM'])mw({type,ownerId},type==='RETURN_ITEM'?`real-wish-${ownerId}`:undefined);
   mw({type:'BUY_OWN_BOX'});mw({type:'SELF_WISH'},'real-self-wish');if(s.miracleWorker.life.ownBox.repair==='NONE')mw({type:'FINISH_ORDINARY'});
  }else if(caseId==='limited-odds'){mw({type:'CHOOSE_PROBABILITY',direction:'UP'},'paid-probability-before-roll');mw({type:'ROLL_PROBABILITY'},'actual-probability-roll');if(s.miracleWorker.life.cases['limited-odds'].result==='NONE')mw({type:'FINISH_ORDINARY'},'actual-ordinary-probability-fallback');}
  else{mw({type:'SUMMON_SCENE'},'real-scene-attempt');if(s.miracleWorker.life.scene.image){mw({type:'LOOK_SCENE'});mw({type:'WAIT_SCENE'},'real-scene-expired');}else mw({type:'FINISH_ORDINARY'});}
  mw({type:'STOP',caseId});mw({type:'REPORT',caseId},`life-report-${caseId}`);
 }
 action({type:'REFLECT'},'reflection');assert.equal(s.progression.acting,100);practiced=structuredClone(s);
 ready({cash:200,H:100,M:100,S:120,clean:true});action({type:'BUY_CURRENT_KIT'},'new-original-combat-kit');action({type:'ENCOUNTER_INVESTIGATE'},'real-enemy-source');ready({ap:3,H:100,M:100,S:120,clean:true});mw({type:'ENCOUNTER_APPROACH'},'real-enemy-arrival');mw({type:'LIGHT_CURRENT_LANTERN'});mw({type:'ENCOUNTER_FIGHT'},'combat-start');combatStart=structuredClone(s);
 for(let i=0;s.combat&&i<100;i++)go({type:'COMBAT_ROUND',stance:s.health<=40||s.injuryRisk>=3?'RETREAT':i<2?'CONTROL':i===2?'PREPARE':'ATTACK'},i===0?'combat-first':undefined);
 assert.equal(s.combat,null);capture('combat-terminal');
 if(s.status==='REVIVAL_PENDING'){const deathId=s.miracleWorker.revival.pendingDeathId;mw({type:'REVIVE_NEARBY',deathId,confirmed:true},'natural-actual-revival');mw({type:'ENCOUNTER_RECOVER_ORIGINALS'},'actual-originals-picked');}
 if(s.status==='ACTIVE'&&s.miracleWorker.encounter.location==='MW2-OLD-QUARRY-STONE')mw({type:'ENCOUNTER_LEAVE'},'ordinary-walk-exit');
 if(s.status==='ACTIVE')future();save(s.status==='ACTIVE'?'FULL_NATURAL_S2_BRANCH':'ACTUAL_FINAL_DEATH');
}catch(error){writeFileSync('output/play/miracle-worker-continuation-blocker.json',JSON.stringify({creation,seed,commands,prefixCount,beforeLast,lastIntent,final:s,boundaries,error:String(error),stack:error.stack}));throw error;}
