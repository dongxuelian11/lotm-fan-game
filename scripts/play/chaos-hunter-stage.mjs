import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/imperative-mage-v01370/natural.json','utf8'));
const creation=old.creation,seed=old.seed,provenance={kind:'SAME_SEED_PUBLIC_NATURAL_PREFIX',source:'tests/fixtures/imperative-mage-v01370/natural.json',newRandomChanges:false};
let s=createSliceRun(old.final.runId,creation,seed);
const initial=structuredClone(s),commands=[],prefixCount=old.commands.length,boundaries={};
let beforeLast=null,lastIntent=null,departureStart=null,guidanceStart=null,prepared=null,promoted=null,practiced=null,combatStart=null,prefixVerified=false;
const root='tests/fixtures/chaos-hunter-v01600',oldRoots=['arbiter','sheriff','interrogator','judge','punishmentKnight','imperativeMage'];
mkdirSync(root,{recursive:true});mkdirSync('output/play',{recursive:true});

function originals(){for(const key of oldRoots)assert.deepEqual(s[key],old.final[key],`Original ${key}`);assert.equal(s.random.seed,seed);assert.equal(s.character.gender,old.final.character.gender);}

function capture(key){if(prefixVerified&&key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};}
function go(intent,key=null){assert(commands.length<1500,'Keep actual exhausted branch');beforeLast=structuredClone(s);lastIntent=structuredClone(intent);s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(structuredClone(intent));capture(key);if(prefixVerified)console.log(JSON.stringify({step:commands.length,command:intent,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,sequence:s.progression.sequence,acting:s.progression.acting}));}
const wd=(command,key=null)=>go({type:'CHAOS_HUNTER',command},key);
function clear(){for(let i=0;s.activeEvent&&i<20;i++){const e=projectSliceState(s).activeEvent;const choiceId=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?(s.cash>=60?'PAY':'DECLINE'):e.id==='CARE-WORK-OFFER'?'DECLINE':null;assert(choiceId,`Unexpected event ${e.id}`);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});}assert.equal(s.activeEvent,null);}
function ordinary(key=null){assert.equal(s.status,'ACTIVE');clear();assert(!s.combat&&!projectSliceState(s).chaosHunter.insideCase);go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'},key);clear();}
function ready({ap=1,cash=0,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}){clear();while(s.actionsRemaining<ap||s.cash<cash||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek)ordinary();}
function action(command,key=null){ready();wd(command,key);clear();}
function practice(caseId){
 ready({ap:3,spirituality:12,mind:20});
 wd({type:'OBSERVE',caseId});wd({type:'PREPARE',caseId,method:'ABILITY'});wd({type:'START_CASE',caseId});
 const step=(type,key=null)=>wd({type,caseId},key);
 const enabled=(type)=>projectSliceState(s).chaosHunter.life.actions.some(a=>a.enabled&&a.command.type===type&&a.command.caseId===caseId);
 step('GO_A');step('CHECK_OBJECT');step('PERFORM',`${caseId}-actual-attempt`);
 if(caseId==='withdrawn-line')step('STOP_RULE',`${caseId}-withdrawn-rule-cancel`);
 step('TRY_PLAYER',`${caseId}-actual-player-step`);
 if(caseId!=='own-line')step('TRY_PARTNER',`${caseId}-actual-partner-step`);
 step('READ_RESULT');if(enabled('STOP_RULE'))step('STOP_RULE',`${caseId}-stop-unused-rule`);
 if(enabled('RETURN_PERSON'))step('RETURN_PERSON',`${caseId}-original-person-return`);
 if(enabled('WALK_B'))step('WALK_B');
 step('TAKE_OBJECT',`${caseId}-original-parcel-pickup`);step('RETURN_A');step('RETURN_OBJECT',`${caseId}-original-object-return`);
 if(caseId==='own-line')wd({type:'CONFIRM_LIMITED',caseId,claim:'LIMITED'},'acknowledge-equal-finite-rule');
 step('RECORD_OUTCOME');step('RETURN_START');step('LEAVE_CASE',`${caseId}-physical-exit`);
 ready();step('REPORT_CASE',`${caseId}-report`);
}

function save(stage){const data={provenance,creation,seed,initial,commands,prefixCount,stage,departureStart,guidanceStart,prepared,promoted,practiced,combatStart,beforeLast,lastIntent,final:s};writeFileSync(`${root}/natural.json`,JSON.stringify(data));writeFileSync(`${root}/boundaries.json`,JSON.stringify(boundaries));writeFileSync('output/play/chaos-hunter-stage-natural.json',JSON.stringify(data));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/chaos-hunter-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,stage,provenance,commands:commands.length,prefixCount,week:s.week,status:s.status,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,bottles:s.chaosHunter.bottles.map(b=>({id:b.id,outcome:b.outcome,week:b.consumedWeek})),encounter:s.chaosHunter.encounter,boundaries:Object.keys(boundaries)}));}
try{
 assert.equal(prefixCount,352);for(const intent of old.commands)go(intent);assert.deepEqual(commands,old.commands);assert.deepEqual(s,migrateSliceState(old.final));prefixVerified=true;departureStart=structuredClone(s);originals();
 ready({cash:500});guidanceStart=structuredClone(s);wd({type:'LEARN_GUIDANCE'},'guidance');
 for(const taskId of ['REVIEW_RECORDS','CHECK_LIMITS','MARK_EXIT'])action({type:'PREPARE_TASK',taskId},`preparation-${taskId.toLowerCase()}`);
 for(let attempt=0;s.progression.sequence===4&&attempt<12;attempt++){
  let bottle=s.chaosHunter.bottles.find(b=>b.status==='PLAYER')??s.chaosHunter.bottles.find(b=>b.status==='SUPPLIER');
  if(!bottle){action({type:'REQUEST_SUPPLY'},'request-supply');const week=s.chaosHunter.resupply.requestedWeek;ready({afterWeek:week});wd({type:'RECEIVE_SUPPLY'},'receive-next-week-supply');bottle=s.chaosHunter.bottles.find(b=>b.status==='SUPPLIER');}
  assert(bottle);const bottleId=bottle.id;
  if(bottle.status==='SUPPLIER'){while(s.chaosHunter.bottles.find(b=>b.id===bottleId).labourSteps<5){const n=s.chaosHunter.bottles.find(b=>b.id===bottleId).labourSteps+1;action({type:'POTION_WORK',bottleId},n===5?'potion-work-5':null);}ready({cash:1040});const cash=s.cash;wd({type:'BUY_POTION',bottleId},'buy-independent-potion');assert.equal(s.cash,cash-900);}
  ready({cash:140,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.imperativeMage.promotionWeek+11});const before={cash:s.cash,ap:s.actionsRemaining,mastery:structuredClone(s.progression.mastery)};
  wd({type:'PREPARE_PROMOTION'},'prepare-current-week');assert.equal(s.actionsRemaining,before.ap-1);assert.equal(s.cash,before.cash-140);prepared=structuredClone(s);
  wd({type:'CONSUME',bottleId,confirmed:true});capture(s.progression.sequence===3?'promotion':'consume-failure');assert.equal(s.chaosHunter.preparedWeek,null);for(const[id,m]of Object.entries(before.mastery))assert.equal(s.progression.mastery[id],m);originals();
  if(s.progression.sequence===4)ready({health:100,mind:100,spirituality:120,pollution:0});
 }
 assert.equal(s.progression.sequence,3,'Twelve real bottles failed; never force success');promoted=structuredClone(s);
 for(const caseId of ['paired-line','withdrawn-line','own-line'])practice(caseId);
 action({type:'REFLECT'},'reflection');assert.equal(s.progression.acting,100);practiced=structuredClone(s);originals();
 ready({ap:2,health:100,mind:100,spirituality:120,pollution:0});wd({type:'ENCOUNTER_TALK'});wd({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);assert.equal(s.combat.encounterId,'CHAOS_HUNTER_DISPUTE');
 for(let i=0;s.combat&&i<100;i++){go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':i<2?'CONTROL':'ATTACK'},i===0?'combat-first':null);if(!s.combat)capture('combat-terminal');}
 assert.equal(s.combat,null);assert(s.chaosHunter.encounter.terminal);originals();if(s.status==='ACTIVE')ordinary('ordinary-life-after-exit');save(s.status==='ACTIVE'?'SAME_SEED_FULL_PUBLIC_S3':'ACTUAL_COMBAT_DEATH');
}catch(error){writeFileSync('output/play/chaos-hunter-blocker.json',JSON.stringify({provenance,creation,seed,initial,commands,prefixCount,prefixVerified,departureStart,guidanceStart,prepared,promoted,practiced,combatStart,beforeLast,lastIntent,final:s,boundaries,error:String(error),stack:error.stack}));throw error;}
