import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/secrets-sorcerer-v01270/directed.json','utf8'));
const creation=old.creation,provenance={kind:'DIRECTED_S4_PREFIX_THEN_PUBLIC_WANDERER',prior:old.provenance,source:'tests/fixtures/secrets-sorcerer-v01270/directed.json',newRandomChanges:false};
let s=migrateSliceState(old.sealed);assert.deepEqual(s.random,old.provenance.originalRandom);s.random=structuredClone(old.provenance.directedRandom);assertValidSliceState(s);
const initial=structuredClone(s),seed=s.random.seed,commands=[],prefixCount=old.commands.length,boundaries={};
let beforeLast=null,lastIntent=null,departureStart=null,guidanceStart=null,prepared=null,promoted=null,practiced=null,combatStart=null,prefixVerified=false;
const root='tests/fixtures/wanderer-v01500',oldRoots=['apprentice','trickmaster','astrologer','recorder','traveler','secretsSorcerer'];
mkdirSync(root,{recursive:true});mkdirSync('output/play',{recursive:true});
const selected=new Set(['guidance','preparation-plan_return','potion-work-5','buy-independent-potion','prepare-current-week','consume-failure','promotion','request-supply','receive-next-week-supply','anchor-ability','anchor-calibrated','offworld-depart','offworld-horizon','offworld-packet','offworld-return','suit-return','handoff-ability','handoff-packet','anchor-return','reflection','combat-first','combat-terminal','ordinary-life-after-exit','clinic-channel','clinic-rest']);
function originals(){for(const key of oldRoots)assert.deepEqual(s[key],old.final[key],`Original ${key}`);assert.equal(s.random.seed,seed);assert.equal(s.character.gender,old.final.character.gender);}
function capture(key){if(prefixVerified&&selected.has(key)&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};}
function go(intent,key=null){assert(commands.length<1500,'Keep actual exhausted branch');beforeLast=structuredClone(s);lastIntent=structuredClone(intent);s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(structuredClone(intent));capture(key);if(prefixVerified)console.log(JSON.stringify({step:commands.length,command:intent,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,sequence:s.progression.sequence,acting:s.progression.acting}));}
const wd=(command,key=null)=>go({type:'WANDERER',command},key);
function clear(){for(let i=0;s.activeEvent&&i<20;i++){const e=projectSliceState(s).activeEvent;const choiceId=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?(s.cash>=60?'PAY':'DECLINE'):e.id==='CARE-WORK-OFFER'?'DECLINE':null;assert(choiceId,`Unexpected event ${e.id}`);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});}assert.equal(s.activeEvent,null);}
function ordinary(key=null){assert.equal(s.status,'ACTIVE');clear();assert(!s.combat&&!projectSliceState(s).wanderer.insideCase);go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'},key);clear();}
function ready({ap=1,cash=0,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}){clear();while(s.actionsRemaining<ap||s.cash<cash||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek)ordinary();}
function action(command,key=null){ready();wd(command,key);clear();}
function practice(caseId){
 // Full health alone does not treat the two original heavy injuries. Use the existing clinic before any departure.
 if(caseId==='offworld-visit'&&s.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)){
  ready({ap:1,cash:60});
  if(!s.careKnown){go({type:'ACTION',action:'INVESTIGATE',targetId:'CARE-ACCESS-01'},'clinic-channel');clear();}
  while(s.injuries.some(i=>i.severity==='HEAVY')){ready({ap:1,cash:60});go({type:'ACTION',action:'REST'},'clinic-rest');clear();}
 }
 ready({ap:2,spirituality:caseId==='offworld-visit'?18:6});wd({type:'PREPARE',caseId,method:'ABILITY'});wd({type:'PERFORM',caseId});
 const step=(type,key=null)=>wd({type,caseId},key),a=()=>s.wanderer.life.cases[caseId].attempts.at(-1);
 if(caseId==='anchor-check'){
  for(const type of ['CONSENT_OWNER','TAKE_ANCHOR','GO_SITE','PLACE_ANCHOR','READ_COORDINATES'])step(type);
  step('ALIGN_ANCHOR','anchor-ability');if(s.wanderer.life.anchor.status!=='CALIBRATED')step('MANUAL_ALIGN');capture('anchor-calibrated');step('RETURN_PLAYER');
 }else if(caseId==='offworld-visit'){
  for(const type of ['CONSENT_OWNER','BORROW_SUIT','CHECK_SUIT','GO_SITE','CHECK_DEPARTURE'])step(type);
  wd({type:'DEPART',caseId,confirm:true},'offworld-depart');
  if(a().departed){step('CHECK_RETURN_MARKER');wd({type:'VIEW_HORIZON',caseId,confirm:true},'offworld-horizon');step('TAKE_PACKET','offworld-packet');step('RETURN_LOCAL','offworld-return');}
  else step('STOP_CONTACT');
  step('RETURN_PLAYER');step('RETURN_SUIT','suit-return');
 }else{
  for(const type of ['CONSENT_OWNER','GO_SITE','CONSENT_RECIPIENT','CHECK_PACKET_RECORDS'])step(type);
  if(s.wanderer.life.packet.location==='PLAYER'){step('COMPARE_RECORDS','handoff-ability');if(!a().recordsCompared)step('MANUAL_COMPARE');step('HAND_PACKET','handoff-packet');}
  else step('FILE_NONRETURN','handoff-packet');
  for(const type of ['RETURN_PLAYER','GO_ANCHOR','RECOVER_ANCHOR','RETURN_PLAYER'])step(type);step('RETURN_ANCHOR','anchor-return');
 }
 step('INSPECT');step('CLOSE');
}
function save(stage){const data={provenance,creation,seed,initial,commands,prefixCount,stage,departureStart,guidanceStart,prepared,promoted,practiced,combatStart,beforeLast,lastIntent,final:s};writeFileSync(`${root}/continued.json`,JSON.stringify(data));writeFileSync(`${root}/boundaries.json`,JSON.stringify(boundaries));writeFileSync('output/play/wanderer-stage-continued.json',JSON.stringify(data));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/wanderer-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,stage,provenance,commands:commands.length,prefixCount,week:s.week,status:s.status,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,bottles:s.wanderer.bottles.map(b=>({id:b.id,outcome:b.outcome,week:b.consumedWeek})),encounter:s.wanderer.encounter,boundaries:Object.keys(boundaries)}));}
try{
 assert.equal(prefixCount,60);for(const intent of old.commands)go(intent);assert.deepEqual(commands,old.commands);assert.deepEqual(s,migrateSliceState(old.final));prefixVerified=true;departureStart=structuredClone(s);originals();
 ready({cash:500});guidanceStart=structuredClone(s);wd({type:'LEARN_GUIDANCE'},'guidance');
 for(const taskId of ['VERIFY_DESTINATION','CHECK_PROTECTION','PLAN_RETURN'])action({type:'PREPARE_TASK',taskId},taskId==='PLAN_RETURN'?'preparation-plan_return':null);
 for(let attempt=0;s.progression.sequence===4&&attempt<12;attempt++){
  let bottle=s.wanderer.bottles.find(b=>b.status==='PLAYER')??s.wanderer.bottles.find(b=>b.status==='SUPPLIER');
  if(!bottle){action({type:'REQUEST_SUPPLY'},'request-supply');const week=s.wanderer.resupply.requestedWeek;ready({afterWeek:week});wd({type:'RECEIVE_SUPPLY'},'receive-next-week-supply');bottle=s.wanderer.bottles.find(b=>b.status==='SUPPLIER');}
  assert(bottle);const bottleId=bottle.id;
  if(bottle.status==='SUPPLIER'){while(s.wanderer.bottles.find(b=>b.id===bottleId).labourSteps<5){const n=s.wanderer.bottles.find(b=>b.id===bottleId).labourSteps+1;action({type:'POTION_WORK',bottleId},n===5?'potion-work-5':null);}ready({cash:1040});const cash=s.cash;wd({type:'BUY_POTION',bottleId},'buy-independent-potion');assert.equal(s.cash,cash-900);}
  ready({cash:140,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.secretsSorcerer.promotionWeek+11});const before={cash:s.cash,ap:s.actionsRemaining,mastery:structuredClone(s.progression.mastery)};
  wd({type:'PREPARE_PROMOTION'},'prepare-current-week');assert.equal(s.actionsRemaining,before.ap-1);assert.equal(s.cash,before.cash-140);prepared=structuredClone(s);
  wd({type:'CONSUME',bottleId,confirmed:true});capture(s.progression.sequence===3?'promotion':'consume-failure');assert.equal(s.wanderer.preparedWeek,null);for(const[id,m]of Object.entries(before.mastery))assert.equal(s.progression.mastery[id],m);originals();
  if(s.progression.sequence===4)ready({health:100,mind:100,spirituality:120,pollution:0});
 }
 assert.equal(s.progression.sequence,3,'Twelve real bottles failed; never force success');promoted=structuredClone(s);
 for(const caseId of ['anchor-check','offworld-visit','original-handoff']){action({type:'OBSERVE',caseId});practice(caseId);assert.equal(s.wanderer.life.cases[caseId].status,'EXAMINED');action({type:'REPORT',caseId});}
 action({type:'REFLECT'},'reflection');assert.equal(s.progression.acting,100);practiced=structuredClone(s);originals();
 ready({ap:2,cash:120,health:100,mind:100,spirituality:120,pollution:0});wd({type:'ENCOUNTER_TALK'});wd({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);assert.equal(s.combat.encounterId,'WANDERER_DISPUTE');
 for(let i=0;s.combat&&i<100;i++){go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':i<2?'CONTROL':'ATTACK'},i===0?'combat-first':null);if(!s.combat)capture('combat-terminal');}
 assert.equal(s.combat,null);assert(s.wanderer.encounter.terminal);originals();if(s.status==='ACTIVE')ordinary('ordinary-life-after-exit');save(s.status==='ACTIVE'?'DIRECTED_S4_PREFIX_FULL_PUBLIC_S3':'DIRECTED_S4_PREFIX_ACTUAL_COMBAT_DEATH');
}catch(error){writeFileSync('output/play/wanderer-blocker.json',JSON.stringify({provenance,creation,seed,initial,commands,prefixCount,prefixVerified,departureStart,guidanceStart,prepared,promoted,practiced,combatStart,beforeLast,lastIntent,final:s,boundaries,error:String(error),stack:error.stack}));throw error;}
