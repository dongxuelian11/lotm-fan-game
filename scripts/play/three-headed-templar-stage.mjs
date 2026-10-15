import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/black-knight-v01320/natural.json','utf8'));
const creation=old.creation,seed=old.seed,provenance={kind:'SAME_SEED_PUBLIC_NATURAL_PREFIX',source:'tests/fixtures/black-knight-v01320/natural.json',newRandomChanges:false};
let s=createSliceRun(old.final.runId,creation,seed);
const initial=structuredClone(s),commands=[],prefixCount=old.commands.length,boundaries={};
let beforeLast=null,lastIntent=null,departureStart=null,guidanceStart=null,prepared=null,promoted=null,practiced=null,combatStart=null,prefixVerified=false;
const root='tests/fixtures/three-headed-templar-v01550',oldRoots=['secretSupplicant','listener','shadowAscetic','roseBishop','shepherd','blackKnight'];
mkdirSync(root,{recursive:true});mkdirSync('output/play',{recursive:true});

function originals(){for(const key of oldRoots){if(key==='roseBishop'&&combatStart){const a=structuredClone(s.roseBishop),b=structuredClone(old.final.roseBishop);assert(a.reserve.points<=b.reserve.points);a.reserve.points=b.reserve.points;assert.deepEqual(a,b,'Original reserve source and packets');}else assert.deepEqual(s[key],old.final[key],`Original ${key}`);}assert.equal(s.random.seed,seed);assert.equal(s.character.gender,old.final.character.gender);}

function capture(key){if(prefixVerified&&key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};}
function go(intent,key=null){assert(commands.length<1500,'Keep actual exhausted branch');beforeLast=structuredClone(s);lastIntent=structuredClone(intent);s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(structuredClone(intent));capture(key);if(prefixVerified)console.log(JSON.stringify({step:commands.length,command:intent,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,sequence:s.progression.sequence,acting:s.progression.acting}));}
const wd=(command,key=null)=>go({type:'THREE_HEADED_TEMPLAR',command},key);
function clear(){for(let i=0;s.activeEvent&&i<20;i++){const e=projectSliceState(s).activeEvent;const choiceId=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?(s.cash>=60?'PAY':'DECLINE'):e.id==='CARE-WORK-OFFER'?'DECLINE':null;assert(choiceId,`Unexpected event ${e.id}`);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});}assert.equal(s.activeEvent,null);}
function ordinary(key=null){assert.equal(s.status,'ACTIVE');clear();assert(!s.combat&&!projectSliceState(s).threeHeadedTemplar.insideCase);go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'},key);clear();}
function ready({ap=1,cash=0,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}){clear();while(s.actionsRemaining<ap||s.cash<cash||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek)ordinary();}
function action(command,key=null){ready();wd(command,key);clear();}
function practice(caseId){
 ready({ap:2,spirituality:20,mind:20});
 const canAbility=projectSliceState(s).threeHeadedTemplar.life.actions.some(a=>a.command.type==='PREPARE'&&a.command.caseId===caseId&&a.command.method==='ABILITY'&&a.enabled);
 wd({type:'PREPARE',caseId,method:canAbility?'ABILITY':'ORDINARY'});wd({type:'PERFORM',caseId});
 const step=(type,key=null)=>wd({type,caseId},key), spirit=(id)=>s.threeHeadedTemplar.life.spirits[id];
 const H='THT3-HELENA',R='THT3-ROLAND';step('CONSENT_OWNER');
 if(canAbility){wd({type:'EXTERNALIZE',spiritId:H},`${caseId}-externalize-helena`);if(caseId!=='two-end-seal')wd({type:'EXTERNALIZE',spiritId:R},`${caseId}-externalize-roland`);}
 const succeeded=spirit(H).location==='START'&&(caseId==='two-end-seal'||spirit(R).location==='START');
 const send=(spiritId,destination)=>wd({type:'SEND_SPIRIT',spiritId,destination});
 const assist=(spiritId,method,key=null)=>wd({type:'ASSIST',spiritId,method},key);
 const recall=()=>{for(const spiritId of [H,R])if(['START','A','B'].includes(spirit(spiritId).location))wd({type:'RECALL_SPIRIT',spiritId});};
 if(succeeded){
  if(caseId==='two-end-seal'){send(H,'A');assist(H,'SIGNAL');send(H,'B');assist(H,'SIGNAL','read-original-far-seal');recall();}
  else if(caseId==='paired-care'){send(R,'A');assist(R,'STEADY_HOLD');send(H,'B');assist(H,'LOW_GLOW','actual-two-spirit-care');recall();}
  else{send(H,'B');assist(H,'LOW_GLOW');send(R,'A');step('OPEN_LIGHT','actual-original-light');wd({type:'RECALL_SPIRIT',spiritId:H},'recall-interrupted-helena');assist(R,'SIGNAL','roland-continues');recall();step('CLOSE_SHUTTER');}
 }else{
  recall();step('WALK_A');step('TAKE_CARD');
  if(caseId==='two-end-seal')step('READ_CARD');else if(caseId==='paired-care')step('SECURE_LEFT');
  step('WALK_B');
  if(caseId==='two-end-seal')step('READ_FAR_SEAL');else if(caseId==='paired-care')step('CHECK_RIGHT');else{step('OPEN_LIGHT');step('CLOSE_SHUTTER');}
  step('WALK_A');step('RETURN_CARD');step('RETURN_START');
 }
 step('INSPECT',`${caseId}-inspection`);step('CLOSE');
}

function save(stage){const data={provenance,creation,seed,initial,commands,prefixCount,stage,departureStart,guidanceStart,prepared,promoted,practiced,combatStart,beforeLast,lastIntent,final:s};writeFileSync(`${root}/natural.json`,JSON.stringify(data));writeFileSync(`${root}/boundaries.json`,JSON.stringify(boundaries));writeFileSync('output/play/three-headed-templar-stage-natural.json',JSON.stringify(data));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/three-headed-templar-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,stage,provenance,commands:commands.length,prefixCount,week:s.week,status:s.status,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,bottles:s.threeHeadedTemplar.bottles.map(b=>({id:b.id,outcome:b.outcome,week:b.consumedWeek})),encounter:s.threeHeadedTemplar.encounter,boundaries:Object.keys(boundaries)}));}
try{
 assert.equal(prefixCount,339);for(const intent of old.commands)go(intent);assert.deepEqual(commands,old.commands);assert.deepEqual(s,migrateSliceState(old.final));prefixVerified=true;departureStart=structuredClone(s);originals();
 ready({cash:500});guidanceStart=structuredClone(s);wd({type:'LEARN_GUIDANCE'},'guidance');
 for(const taskId of ['REVIEW_RECORDS','CHECK_LIMITS','MARK_EXIT'])action({type:'PREPARE_TASK',taskId},`preparation-${taskId.toLowerCase()}`);
 for(let attempt=0;s.progression.sequence===4&&attempt<12;attempt++){
  let bottle=s.threeHeadedTemplar.bottles.find(b=>b.status==='PLAYER')??s.threeHeadedTemplar.bottles.find(b=>b.status==='SUPPLIER');
  if(!bottle){action({type:'REQUEST_SUPPLY'},'request-supply');const week=s.threeHeadedTemplar.resupply.requestedWeek;ready({afterWeek:week});wd({type:'RECEIVE_SUPPLY'},'receive-next-week-supply');bottle=s.threeHeadedTemplar.bottles.find(b=>b.status==='SUPPLIER');}
  assert(bottle);const bottleId=bottle.id;
  if(bottle.status==='SUPPLIER'){while(s.threeHeadedTemplar.bottles.find(b=>b.id===bottleId).labourSteps<5){const n=s.threeHeadedTemplar.bottles.find(b=>b.id===bottleId).labourSteps+1;action({type:'POTION_WORK',bottleId},n===5?'potion-work-5':null);}ready({cash:1040});const cash=s.cash;wd({type:'BUY_POTION',bottleId},'buy-independent-potion');assert.equal(s.cash,cash-900);}
  ready({cash:140,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.blackKnight.promotionWeek+11});const before={cash:s.cash,ap:s.actionsRemaining,mastery:structuredClone(s.progression.mastery)};
  wd({type:'PREPARE_PROMOTION'},'prepare-current-week');assert.equal(s.actionsRemaining,before.ap-1);assert.equal(s.cash,before.cash-140);prepared=structuredClone(s);
  wd({type:'CONSUME',bottleId,confirmed:true});capture(s.progression.sequence===3?'promotion':'consume-failure');assert.equal(s.threeHeadedTemplar.preparedWeek,null);for(const[id,m]of Object.entries(before.mastery))assert.equal(s.progression.mastery[id],m);originals();
  if(s.progression.sequence===4)ready({health:100,mind:100,spirituality:120,pollution:0});
 }
 assert.equal(s.progression.sequence,3,'Twelve real bottles failed; never force success');promoted=structuredClone(s);
 action({type:'MEET_SPIRITS'},'meet-two-sealed-sources');
 for(const [spiritId,abilityIds] of [['THT3-HELENA',['SIGNAL','BRIEF_WARD','LOW_GLOW']],['THT3-ROLAND',['SIGNAL','STEADY_HOLD','SCREEN']]]){
  for(let attempt=0;attempt<6&&s.threeHeadedTemplar.life.spirits[spiritId].status==='SEALED';attempt++){
   const original=s.threeHeadedTemplar.life.spirits[spiritId];ready({ap:2,cash:180,spirituality:6,mind:10,afterWeek:original.attemptWeek??-1});
   wd({type:'PREPARE_GRAZING',spiritId},`prepare-${spiritId}`);wd({type:'GRAZE',spiritId,abilityIds,confirmed:true},`graze-${spiritId}`);
  }
 }
 for(const caseId of ['two-end-seal','paired-care','interrupted-light']){action({type:'OBSERVE',caseId});practice(caseId);assert.equal(s.threeHeadedTemplar.life.cases[caseId].status,'EXAMINED');action({type:'REPORT',caseId});}
 action({type:'REFLECT'},'reflection');assert.equal(s.progression.acting,100);practiced=structuredClone(s);originals();
 ready({ap:2,cash:120,health:100,mind:100,spirituality:120,pollution:0});wd({type:'ENCOUNTER_TALK'});for(const spiritId of ['THT3-HELENA','THT3-ROLAND'])if(s.threeHeadedTemplar.life.spirits[spiritId].status==='GRAZED')wd({type:'EXTERNALIZE',spiritId},`court-release-${spiritId}`);wd({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);assert.equal(s.combat.encounterId,'THREE_HEADED_TEMPLAR_DISPUTE');
 for(let i=0;s.combat&&i<100;i++){go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':i<2?'PREPARE':'ATTACK'},i===0?'combat-first':null);if(!s.combat)capture('combat-terminal');}
 assert.equal(s.combat,null);assert(s.threeHeadedTemplar.encounter.terminal);originals();if(s.status==='ACTIVE')ordinary('ordinary-life-after-exit');save(s.status==='ACTIVE'?'SAME_SEED_FULL_PUBLIC_S3':'ACTUAL_COMBAT_DEATH');
}catch(error){writeFileSync('output/play/three-headed-templar-blocker.json',JSON.stringify({provenance,creation,seed,initial,commands,prefixCount,prefixVerified,departureStart,guidanceStart,prepared,promoted,practiced,combatStart,beforeLast,lastIntent,final:s,boundaries,error:String(error),stack:error.stack}));throw error;}
