import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/mystic-v01310/natural.json','utf8'));
const creation=old.creation,seed=old.seed,provenance={kind:'SAME_SEED_PUBLIC_NATURAL_PREFIX',source:'tests/fixtures/mystic-v01310/natural.json',newRandomChanges:false};
let s=createSliceRun(old.final.runId,creation,seed);
const initial=structuredClone(s),commands=[],prefixCount=old.commands.length,boundaries={};
let beforeLast=null,lastIntent=null,departureStart=null,guidanceStart=null,prepared=null,promoted=null,practiced=null,combatStart=null,prefixVerified=false,craftStart=null;
const root='tests/fixtures/prophecy-master-v01540',oldRoots=['pryer','combatScholar','wizard','scrollProfessor','starMystic','mystic'];
mkdirSync(root,{recursive:true});mkdirSync('output/play',{recursive:true});

function originals(){for(const key of oldRoots){if(key==='scrollProfessor'&&craftStart){const a=structuredClone(s.scrollProfessor),b=structuredClone(old.final.scrollProfessor);delete a.workshop;delete b.workshop;assert.deepEqual(a,b,'Original scroll professor history');const w=s.scrollProfessor.workshop,u=old.final.scrollProfessor.workshop;assert.deepEqual(w.materials.slice(0,11),u.materials.slice(0,11));assert.deepEqual(w.scrolls.slice(0,8),u.scrolls);assert.equal(w.kitsBought,u.kitsBought);}else assert.deepEqual(s[key],old.final[key],`Original ${key}`);}assert.equal(s.random.seed,seed);assert.equal(s.character.gender,old.final.character.gender);}

function capture(key){if(prefixVerified&&key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};}
function go(intent,key=null){assert(commands.length<1500,'Keep actual exhausted branch');beforeLast=structuredClone(s);lastIntent=structuredClone(intent);s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(structuredClone(intent));capture(key);if(prefixVerified)console.log(JSON.stringify({step:commands.length,command:intent,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,sequence:s.progression.sequence,acting:s.progression.acting}));}
const wd=(command,key=null)=>go({type:'PROPHECY_MASTER',command},key);
function clear(){for(let i=0;s.activeEvent&&i<20;i++){const e=projectSliceState(s).activeEvent;const choiceId=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?(s.cash>=60?'PAY':'DECLINE'):e.id==='CARE-WORK-OFFER'?'DECLINE':null;assert(choiceId,`Unexpected event ${e.id}`);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});}assert.equal(s.activeEvent,null);}
function ordinary(key=null){assert.equal(s.status,'ACTIVE');clear();assert(!s.combat&&!projectSliceState(s).prophecyMaster.insideCase);go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'},key);clear();}
function ready({ap=1,cash=0,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}){clear();while(s.actionsRemaining<ap||s.cash<cash||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek)ordinary();}
function action(command,key=null){ready();wd(command,key);clear();}
function practice(caseId){
 ready({ap:2,spirituality:6,mind:10});wd({type:'PREPARE',caseId,method:'ABILITY'});wd({type:'PERFORM',caseId});
 const step=(type,key=null)=>wd({type,caseId},key);
 step('CONSENT_OWNER');step('TAKE_RECORD');step('GLIMPSE',`${caseId}-glimpse`);
 if(caseId!=='bounded-source')wd({type:'STATE_HYPOTHESIS',caseId,hypothesis:'ALARM'},`${caseId}-hypothesis`);
 step('GO_A');
 if(caseId==='bell-schedule'){step('READ_SCHEDULE','read-real-schedule');step('WITNESS_BELL','witness-actual-bell');}
 else if(caseId==='covered-door'){step('CHECK_DOOR','check-locked-door');step('WALK_B');step('DELIVER_PARCEL','real-delivery');step('READ_DELIVERY','read-receipt');}
 else{step('CHECK_WARNING');step('CLOSE_SHUTTER','close-original-shutter');step('STOP_INQUIRY','stop-inquiry');step('ORDINARY_CHECK','ordinary-source-check');}
 step('COMPARE_EVIDENCE',`${caseId}-compare`);if(caseId==='covered-door')step('RETURN_A');
 step('RETURN_START');step('RETURN_RECORD',`${caseId}-return`);step('INSPECT');step('CLOSE');
}

function save(stage){const data={provenance,creation,seed,initial,commands,prefixCount,stage,craftStart,departureStart,guidanceStart,prepared,promoted,practiced,combatStart,beforeLast,lastIntent,final:s};writeFileSync(`${root}/natural.json`,JSON.stringify(data));writeFileSync(`${root}/boundaries.json`,JSON.stringify(boundaries));writeFileSync('output/play/prophecy-master-stage-natural.json',JSON.stringify(data));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/prophecy-master-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,stage,provenance,commands:commands.length,prefixCount,week:s.week,status:s.status,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,bottles:s.prophecyMaster.bottles.map(b=>({id:b.id,outcome:b.outcome,week:b.consumedWeek})),encounter:s.prophecyMaster.encounter,boundaries:Object.keys(boundaries)}));}
try{
 assert.equal(prefixCount,411);for(const intent of old.commands)go(intent);assert.deepEqual(commands,old.commands);assert.deepEqual(s,migrateSliceState(old.final));prefixVerified=true;departureStart=structuredClone(s);originals();
 ready({cash:500});guidanceStart=structuredClone(s);wd({type:'LEARN_GUIDANCE'},'guidance');
 for(const taskId of ['REVIEW_RECORDS','CHECK_LIMITS','MARK_EXIT'])action({type:'PREPARE_TASK',taskId},`preparation-${taskId.toLowerCase()}`);
 for(let attempt=0;s.progression.sequence===4&&attempt<12;attempt++){
  let bottle=s.prophecyMaster.bottles.find(b=>b.status==='PLAYER')??s.prophecyMaster.bottles.find(b=>b.status==='SUPPLIER');
  if(!bottle){action({type:'REQUEST_SUPPLY'},'request-supply');const week=s.prophecyMaster.resupply.requestedWeek;ready({afterWeek:week});wd({type:'RECEIVE_SUPPLY'},'receive-next-week-supply');bottle=s.prophecyMaster.bottles.find(b=>b.status==='SUPPLIER');}
  assert(bottle);const bottleId=bottle.id;
  if(bottle.status==='SUPPLIER'){while(s.prophecyMaster.bottles.find(b=>b.id===bottleId).labourSteps<5){const n=s.prophecyMaster.bottles.find(b=>b.id===bottleId).labourSteps+1;action({type:'POTION_WORK',bottleId},n===5?'potion-work-5':null);}ready({cash:1040});const cash=s.cash;wd({type:'BUY_POTION',bottleId},'buy-independent-potion');assert.equal(s.cash,cash-900);}
  ready({cash:140,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.mystic.promotionWeek+11});const before={cash:s.cash,ap:s.actionsRemaining,mastery:structuredClone(s.progression.mastery)};
  wd({type:'PREPARE_PROMOTION'},'prepare-current-week');assert.equal(s.actionsRemaining,before.ap-1);assert.equal(s.cash,before.cash-140);prepared=structuredClone(s);
  wd({type:'CONSUME',bottleId,confirmed:true});capture(s.progression.sequence===3?'promotion':'consume-failure');assert.equal(s.prophecyMaster.preparedWeek,null);for(const[id,m]of Object.entries(before.mastery))assert.equal(s.progression.mastery[id],m);originals();
  if(s.progression.sequence===4)ready({health:100,mind:100,spirituality:120,pollution:0});
 }
 assert.equal(s.progression.sequence,3,'Twelve real bottles failed; never force success');promoted=structuredClone(s);
 for(const caseId of ['bell-schedule','covered-door','bounded-source']){action({type:'OBSERVE',caseId});practice(caseId);assert.equal(s.prophecyMaster.life.cases[caseId].status,'EXAMINED');action({type:'REPORT',caseId});}
 action({type:'REFLECT'},'reflection');assert.equal(s.progression.acting,100);practiced=structuredClone(s);originals();
 ready({ap:1,spirituality:2});craftStart=structuredClone(s);const oldScrolls=s.scrollProfessor.workshop.scrolls.length;
 go({type:'SCROLL_PROFESSOR',command:{type:'CRAFT_SCROLL',kind:'IMPACT'}},'craft-original-scroll');
 const made=s.scrollProfessor.workshop.scrolls[oldScrolls];if(made){assert.equal(made.makerSequence,3);go({type:'SCROLL_PROFESSOR',command:{type:'AUTHORIZE_SCROLL',scrollId:made.id,authorized:true}},'authorize-original-scroll');}
 ready({ap:2,cash:120,health:100,mind:100,spirituality:120,pollution:0});wd({type:'ENCOUNTER_TALK'});wd({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);assert.equal(s.combat.encounterId,'PROPHECY_MASTER_DISPUTE');
 for(let i=0;s.combat&&i<100;i++){go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':i<2?'PREPARE':'ATTACK'},i===0?'combat-first':null);if(!s.combat)capture('combat-terminal');}
 assert.equal(s.combat,null);assert(s.prophecyMaster.encounter.terminal);originals();if(s.status==='ACTIVE')ordinary('ordinary-life-after-exit');save(s.status==='ACTIVE'?'SAME_SEED_FULL_PUBLIC_S3':'ACTUAL_COMBAT_DEATH');
}catch(error){writeFileSync('output/play/prophecy-master-blocker.json',JSON.stringify({provenance,creation,seed,initial,commands,prefixCount,prefixVerified,craftStart,departureStart,guidanceStart,prepared,promoted,practiced,combatStart,beforeLast,lastIntent,final:s,boundaries,error:String(error),stack:error.stack}));throw error;}
