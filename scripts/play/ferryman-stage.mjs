import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const mode=process.argv[2]==='original'?'original':'post-cycle';
const old=JSON.parse(readFileSync(mode==='original'?'tests/fixtures/undying-v01260/natural.json':'tests/fixtures/long-chapter-v01390/natural.json','utf8'));
const creation=old.creation,seed=old.seed,prefixCount=old.commands.length,commands=[],boundaries={};
const directory='tests/fixtures/ferryman-v01490';
const boundaryNames=new Set(['handoff','guidance','prepare-task','potion-work-5','buy-potion','prepare-promotion','consume-failure','promotion','passage-out-ability','passage-out-return','quiet-jar-ability','quiet-jar-sealed','passage-return-ability','passage-return-delivered','reflection','combat-first','combat-terminal','ordinary-after']);
let s=null,beforeLast=null,lastIntent=null,prefixVerified=false,departureStart=null,handoffStart=null,guidanceStart=null,promoted=null,practiced=null,combatStart=null;
mkdirSync('output/play',{recursive:true});mkdirSync(directory,{recursive:true});
const originalRoots=['corpsecollector','gravedigger','spiritmedium','spiritGuide','gatekeeper','undying'];
function originals(){for(const key of originalRoots)assert.deepEqual(s[key],old.final[key],`Original ${key} retained`);assert.equal(s.random.seed,seed);assert.equal(s.runId,old.final.runId);assert.equal(s.character.gender,old.final.character.gender);}
function capture(key){if(prefixVerified&&boundaryNames.has(key)&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};}
function go(intent,key=null){beforeLast=structuredClone(s);lastIntent=structuredClone(intent);assert(commands.length<2200,'Public branch exhausted; keep actual result');s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(structuredClone(intent));capture(key);if(prefixVerified)console.log(JSON.stringify({step:commands.length,command:intent,week:s.week,date:s.date,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,sequence:s.progression.sequence,acting:s.progression.acting}));}
const dw=(command,key=null)=>go({type:'FERRYMAN',command},key);
const channel=()=>s.ferryman.channels.find(c=>c.agreementClosedDate===null);
function clear(){for(let i=0;s.activeEvent&&i<20;i++){const event=projectSliceState(s).activeEvent;const choiceId=event.id.startsWith('ORIGIN')?'.decline':event.id==='LIFE-BILL-01'?'PAY_PART':event.id==='DEBT-NOTICE-01'?'DECLINE':event.id==='DEBT-SETTLE-01'?'DEFER':event.id==='LIFE-CARE-01'?'DECLINE':null;assert(choiceId,`Keep unexpected event ${event.id}`);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});}assert.equal(s.activeEvent,null);}
function ordinary(key=null,rest=false){assert.equal(s.status,'ACTIVE');assert(!s.combat&&!projectSliceState(s).ferryman.insideCase);if(mode==='post-cycle'){if(s.ferryman.era.location==='OUTSIDE')dw({type:'ERA_ENTER'});if(s.actionsRemaining===0){if(s.cash<24)dw({type:'ERA_WORK'});dw({type:'ERA_NEXT_WEEK'},key);}else dw({type:rest&&s.cash>=8?'ERA_REST':'ERA_WORK'},key);}else {clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'},key);clear();}}
function ready({ap=1,cash=0,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}){clear();while(s.actionsRemaining<ap||s.cash<cash||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek){const rest=s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution;ordinary(null,rest);}}
function action(command,key=null){ready();dw(command,key);clear();}
function practice(caseId){
 ready({ap:2,spirituality:6});dw({type:'PREPARE',caseId,method:'ABILITY'});dw({type:'PERFORM',caseId});
 const step=(type,key=null)=>dw({type,caseId},key);
 const stop=()=>{if(s.ferryman.life.cases[caseId].attempts.at(-1).effectActive)step('STOP_EFFECT');};
 if(caseId==='passage-out'){
  for(const type of ['CONSENT_OWNER','GO_SITE','CHECK_ENDPOINTS','CONSENT_SPIRIT','HAND_TAG'])step(type);
  step('OPEN_PASSAGE','passage-out-ability');for(const type of ['CROSS_SPIRIT','GO_RECIPIENT','DELIVER_TAG'])step(type);stop();step('RETURN_PLAYER','passage-out-return');
 }else if(caseId==='quiet-jar'){
  step('GO_SITE');step('CONSENT_OWNER');step('QUIET_JAR','quiet-jar-ability');step('SEAL_JAR','quiet-jar-sealed');stop();step('RETURN_PLAYER');
 }else{
  for(const type of ['CONSENT_OWNER','GO_SITE','CHECK_ENDPOINTS','CONSENT_SPIRIT','WRITE_REPLY'])step(type);
  step('OPEN_PASSAGE','passage-return-ability');for(const type of ['CROSS_SPIRIT','GO_RECIPIENT','TAKE_REPLY'])step(type);stop();step('RETURN_PLAYER');step('DELIVER_REPLY','passage-return-delivered');
 }
 step('INSPECT');step('CLOSE');
}
function save(stage){const out={mode,creation,seed,commands,prefixCount,stage,departureStart,handoffStart,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s};const suffix=mode==='original'?'original':'natural';writeFileSync(`${directory}/${suffix}.json`,JSON.stringify(out));writeFileSync(`output/play/ferryman-stage-${suffix}.json`,JSON.stringify(out));writeFileSync(`${directory}/${mode==='original'?'original-boundaries':'boundaries'}.json`,JSON.stringify(boundaries));for(const [key,value]of Object.entries(boundaries))writeFileSync(`output/play/ferryman-${mode}-${key}-save-boundary.json`,JSON.stringify(value));console.log(JSON.stringify({passed:true,mode,stage,commands:commands.length,prefixCount,week:s.week,date:s.date,status:s.status,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,bottles:channel().bottles.map(b=>({id:b.id,outcome:b.outcome,week:b.consumedWeek})),encounter:s.ferryman.encounter,boundaries:Object.keys(boundaries)}));}
try{
 assert.equal(prefixCount,mode==='original'?422:428);
 s=createSliceRun(old.final.runId,creation,seed);for(const intent of old.commands)go(intent);
 const expected=migrateSliceState(old.final);
 // Stage0.139 already updated two old ritual notices when the real60-year chapter shipped.
 // Verify precisely those two narrative-only updates; all gameplay and all other log fields remain exact.
 if(mode==='original')for(const [index,id]of [[606,'record-370-606'],[611,'record-373-611']]){assert.equal(s.chronicle[index].id,id);assert.equal(expected.chronicle[index].id,id);assert(s.chronicle[index].text.includes('完成原记忆准备后，可在长期章节'));assert(expected.chronicle[index].text.includes('六十年周期尚未实际经历'));expected.chronicle[index].text=s.chronicle[index].text;}
 assert.deepEqual(s,expected);assert.deepEqual(commands,old.commands);prefixVerified=true;departureStart=structuredClone(s);
 if(mode==='post-cycle'){const before=structuredClone(s);go({type:'LONG_CHAPTER',command:{type:'CONTINUE_FERRYMAN'}},'handoff');handoffStart=structuredClone(s);for(const key of ['cash','health','mind','spirituality','actionsRemaining','date','week'])assert.deepEqual(s[key],before[key]);assert(s.longChapter.handoff);}
 ready({ap:1,cash:mode==='original'?500:120});guidanceStart=structuredClone(s);dw({type:'LEARN_GUIDANCE'},'guidance');assert.equal(channel().id,mode==='original'?'ORIGINAL':'POST_CYCLE');
 for(const taskId of ['CHECK_ROUTE','REVIEW_IDENTITY','PLAN_RETURN'])action({type:'PREPARE_TASK',taskId},taskId==='PLAN_RETURN'?'prepare-task':null);
 for(let attempt=0;s.progression.sequence===4&&attempt<12;attempt++){
  let bottle=channel().bottles.find(b=>b.status==='PLAYER')??channel().bottles.find(b=>b.status==='SUPPLIER');
  if(!bottle){action({type:'REQUEST_SUPPLY'});const week=channel().resupply.requestedWeek;ready({afterWeek:week});dw({type:'RECEIVE_SUPPLY'});bottle=channel().bottles.find(b=>b.status==='SUPPLIER');}
  assert(bottle);const bottleId=bottle.id;
  if(bottle.status==='SUPPLIER'){while(channel().bottles.find(b=>b.id===bottleId).labourSteps<5){const step=channel().bottles.find(b=>b.id===bottleId).labourSteps+1;action({type:'POTION_WORK',bottleId},step===5?'potion-work-5':null);}ready({cash:mode==='original'?920:100});const cash=s.cash;dw({type:'BUY_POTION',bottleId},'buy-potion');assert.equal(s.cash,cash-(mode==='original'?800:80));}
  ready({cash:mode==='original'?120:20,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.undying.promotionWeek+11});
  const before={week:s.week,ap:s.actionsRemaining,cash:s.cash,mastery:structuredClone(s.progression.mastery)};
  dw({type:'PREPARE_PROMOTION'},'prepare-promotion');assert.equal(s.actionsRemaining,before.ap-1);assert.equal(s.cash,before.cash-(mode==='original'?120:20));assert.equal(channel().preparedWeek,s.week);
  dw({type:'CONSUME',bottleId,confirmed:true});capture(s.progression.sequence===3?'promotion':'consume-failure');assert.equal(channel().preparedWeek,null);assert.equal(channel().bottles.find(b=>b.id===bottleId).status,'CONSUMED');for(const[id,m]of Object.entries(before.mastery))assert.equal(s.progression.mastery[id],m);originals();
  if(s.progression.sequence===4)ready({health:100,mind:100,spirituality:120,pollution:0});
 }
 assert.equal(s.progression.sequence,3,'Twelve actual bottles failed; no forced promotion');promoted=structuredClone(s);assert.equal(s.ferryman.undyingActingAtPromotion,100);originals();
 if(mode==='original'){ordinary('ordinary-after');save('ORIGINAL_ERA_PROMOTION');}else{
  for(const caseId of ['passage-out','quiet-jar','passage-return']){action({type:'OBSERVE',caseId});practice(caseId);assert.equal(s.ferryman.life.cases[caseId].status,'EXAMINED');action({type:'REPORT',caseId});}
  action({type:'REFLECT'},'reflection');assert.equal(s.progression.acting,100);practiced=structuredClone(s);originals();
  ready({ap:2,cash:120,health:100,mind:100,spirituality:120,pollution:0});dw({type:'ENCOUNTER_TALK'});dw({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);assert.equal(s.combat.encounterId,'FERRYMAN_DISPUTE');
  for(let i=0;s.combat&&i<100;i++){go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':i<2?'CONTROL':'ATTACK'},i===0?'combat-first':null);if(!s.combat)capture('combat-terminal');}
  assert.equal(s.combat,null);assert(s.ferryman.encounter.terminal);originals();if(s.status==='ACTIVE')ordinary('ordinary-after');save(s.status==='ACTIVE'?'FULL_POST_CYCLE_BRANCH':'ACTUAL_COMBAT_DEATH');
 }
}catch(error){writeFileSync(`output/play/ferryman-${mode}-blocker.json`,JSON.stringify({mode,creation,seed,commands,prefixCount,prefixVerified,departureStart,handoffStart,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s,boundaries,error:String(error),stack:error.stack}));throw error;}
