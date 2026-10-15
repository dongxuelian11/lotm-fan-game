import assert from 'node:assert/strict';
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { validateCivilizationEnlightenerSource } from '../../dist/domain/civilization-enlightener/index.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
// Replay the complete original691-command living KnowledgeMentor route before continuing.
// This source already preserves its earlier living branch and original death evidence.
const source='tests/fixtures/knowledge-mentor-v01670/natural.json';
const old=Object.fromEntries(['creation','seed','commands','final'].map(k=>[k,readObjectEntry(source,k)]));
const sourceHash=fileDigest(source),commands=[],boundaries={},treatments=[];
mkdirSync('output/play',{recursive:true});
const outputDir=mkdtempSync('output/play/civilization-enlightener-01890-');
const write=(name,value)=>writeFileSync(`${outputDir}/${name}`,JSON.stringify(value),{flag:'wx'});
const prefixCount=691;let original=null;
let s=createSliceRun(old.final.runId,old.creation,old.seed),beforeLast=null,lastIntent=null,pendingIntent=null,prefixVerified=false;
const initial=structuredClone(s),snapshots={};
const view=()=>projectSliceState(s).civilizationEnlightener;
function originals(){
 assert(original);for(const root of ['savant','archaeologist','appraiser','artisan','astronomer','alchemist','arcaneScholar','knowledgeMentor']) {
  const live=structuredClone(s[root]);
  if(root==='alchemist')live.life.creations=structuredClone(original.alchemist.life.creations);
  assert.deepEqual(live,original[root],`Preserve original ${root}`);
 }
 if(s.civilizationEnlightener.guidanceKnown)assert(validateCivilizationEnlightenerSource(s),'Original live resources must reconcile with actual receipts');
 assert.deepEqual(s.combatHistory.slice(0,original.combatHistory.length),original.combatHistory);
 for(const[id,value]of Object.entries(original.progression.mastery))assert(s.progression.mastery[id]>=value);
 assert.equal(s.random.seed,old.seed);assert.deepEqual(s.character.name,original.character.name);assert.equal(s.character.gender,original.character.gender);
 assert.equal(s.progression.promotionWeek,original.progression.promotionWeek);
}
function capture(key){
 if(!key||!prefixVerified||boundaries[key])return;
 const file=`boundary-${key}.json`;write(file,{beforeLast,lastIntent,final:s});boundaries[key]=file;
}
function go(intent,key=null){
 assert(commands.length<3500,'Finite strategy exhausted; preserve actual outcome');
 pendingIntent=structuredClone(intent);
 if(prefixVerified&&intent.type==='ACTION'){
  const p=projectSliceState(s);assert(p.canAct,p.actionBlockedReason??'Current public action is unavailable');
  if(intent.action==='INVESTIGATE')assert(p.investigateTargets.some(target=>target.id===intent.targetId));
 }
 beforeLast=s;lastIntent=structuredClone(intent);
 s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(structuredClone(intent));pendingIntent=null;
 if(prefixVerified){originals();capture(key);appendFileSync(`${outputDir}/commands.jsonl`,JSON.stringify({step:commands.length,intent,revision:s.revision,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,sequence:s.progression.sequence,acting:s.progression.acting,cursor:s.random.cursor})+'\n');}
 if(prefixVerified&&s.status!=='ACTIVE')throw new ActualTerminalStop(`Actual ${s.status}`);
}
class ActualTerminalStop extends Error{}
function eg(command,key=null){
 pendingIntent={type:'CIVILIZATION_ENLIGHTENER',command:structuredClone(command)};
 const available=view().actions.find(action=>isDeepStrictEqual(action.command,command));
 assert(available,`No current public CivilizationEnlightener control for ${JSON.stringify(command)}`);assert(available.enabled,available.reason);
 go({type:'CIVILIZATION_ENLIGHTENER',command},key);
}
function clear(){for(let n=0;s.activeEvent&&n<20;n++){
 const e=projectSliceState(s).activeEvent;
 const choiceId=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'PAY':e.id==='CARE-WORK-OFFER'?'DECLINE':null;
 assert(choiceId,`Unplanned event ${e.id}`);assert(e.choices.some(choice=>choice.id===choiceId&&choice.enabled),`Unavailable public event choice ${e.id}/${choiceId}`);
 const before=e.id==='LIFE-CARE-01'?{cash:s.cash,health:s.health,risk:s.injuryRisk,week:s.week,revision:s.revision,injuries:structuredClone(s.injuries)}:null;
 go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId},before?'clinic-actual-pay60':null);
 if(before){
  assert(s.cash<=before.cash-60,'Treatment and any due weekly costs are actually paid');
  assert.equal(s.health,before.health,'Payment treats the same injury without free healing');assert.equal(s.injuryRisk,before.risk);
  for(const injury of before.injuries.filter(row=>row.severity==='HEAVY'&&row.treatedRevision===null)){
   const treated=s.injuries.find(row=>row.id===injury.id);assert(treated,'The same wound remains immediately after treatment');
   assert.equal(treated.treatedRevision,before.revision+1);assert.equal(treated.acquiredRevision,injury.acquiredRevision);
  }
  treatments.push({paidPennies:60,before,cashAfter:s.cash,healthAfter:s.health,injuriesAfter:structuredClone(s.injuries)});
 }
}assert.equal(s.activeEvent,null);}
function ordinary(key=null,forceRest=false){clear();assert(!view().insideCase&&!s.combat);go({type:'ACTION',action:forceRest||s.wagePaidWeek===s.week?'REST':'WORK'},key);clear();}
function ready({ap=1,cash=0,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}){
 clear();for(let n=0;s.actionsRemaining<ap||s.cash<cash||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek;n++){assert(n<600,'Ordinary preparation budget exhausted');ordinary();}
}
function action(command,key=null){ready();eg(command,key);clear();}
function snapshot(name){const file=`snapshot-${name}.json`;write(file,s);snapshots[name]=file;}
function save(stage,error=null){
 assert.equal(fileDigest(source),sourceHash);
 write('natural.json',{provenance:{kind:'SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION',source,sourceSha256:sourceHash,newRandomChanges:false},creation:old.creation,seed:old.seed,prefixCount,prefixVerified,commands,initial,prefixFinal:original,snapshots,treatments,stage,pendingIntent,error:error?String(error):null,final:s});
 write('boundaries.index.json',boundaries);
 write('summary.json',{stage,commands:commands.length,prefixCount,status:s.status,sequence:s.progression.sequence,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,cursor:s.random.cursor,injuries:s.injuries,injuryRisk:s.injuryRisk,treatments:treatments.length,lifeCases:Object.fromEntries(Object.entries(s.civilizationEnlightener.life.cases).map(([id,row])=>[id,{status:row.status,result:row.result,attempt:row}])),encounter:s.civilizationEnlightener.encounter.status,bottles:s.civilizationEnlightener.bottles.map(b=>({id:b.id,outcome:b.outcome})),boundaries:Object.keys(boundaries),snapshots});
 console.log(JSON.stringify({outputDir,stage,commands:commands.length,status:s.status,sequence:s.progression.sequence,week:s.week}));
}

function practice(caseId){
 action({type:'OBSERVE',caseId},`${caseId}-observe-original`);
 ready({ap:2,cash:60,health:100,mind:100,spirituality:120});
 eg({type:'INVITE',caseId,method:caseId==='withdrawn-operation'?'ORDINARY':'ABILITY'},`${caseId}-fresh-invitation`);
 eg({type:caseId==='taught-stop'?'CONSENT':'DECLINE_CONSENT',permission:'TEACHING'},`${caseId}-current-learning-permission`);
 eg({type:caseId==='withdrawn-operation'?'DECLINE_CONSENT':'CONSENT',permission:'ABILITY'},`${caseId}-current-ability-permission`);
 eg({type:'BORROW_WRENCH'},`${caseId}-same-loan-tool`);eg({type:'ENTER_WORKSHOP'},`${caseId}-actual-two-metre-entry`);eg({type:'PLACE_ORIGINALS'},`${caseId}-same-two-originals`);
 if(caseId==='worn-bearing'){
  eg({type:'READ_RECORDS'},'actual-original-manufacture-records');eg({type:'INSPECT_FRAME'},'actual-original-90-durability');
  eg({type:'PROCESS_ANALYSIS'},'paid-limited-defect-analysis');
  eg({type:'HAND_INSPECT'},'hands-on-defect-confirmation');eg({type:'BUY_SHIM'},'paid-finite-original-shim');
  eg({type:'REPAIR_FRAME'},'explicit-frame90-to95-no-recharge');
 }else{
  eg({type:'DEMONSTRATE_STOP'},`${caseId}-actual-manual-demonstration`);
  if(caseId==='taught-stop')eg({type:'OPERATIONAL_GUIDANCE'},'paid-one-ordinary-step-guidance');
  eg({type:'ARM_MANUAL_LOAD'},`${caseId}-real-hand-set-load`);
  if(caseId==='taught-stop')eg({type:'LEARNER_TRY'},'adult-independent-single-attempt');
  if(s.civilizationEnlightener.life.cases[caseId].result==='NONE')eg({type:'MANUAL_STOP'},`${caseId}-ordinary-manual-stop`);
 }
 eg({type:'RETURN_ORIGINALS'},`${caseId}-same-originals-retrieved`);eg({type:'MOVE',to:'NEAR'},`${caseId}-actual-two-metre-return`);
 eg({type:'RETURN_WRENCH'},`${caseId}-same-loan-tool-returned`);eg({type:'RETURN_HOME'},`${caseId}-actual-participant-exit`);
 action({type:'REPORT',caseId},`${caseId}-honest-report`);
}
try{
 assert.equal(old.commands.length,prefixCount);assert.equal(old.final.status,'ACTIVE');
 for(const intent of old.commands)go(intent);
 assert.deepEqual(commands,old.commands);assert.deepEqual(s,migrateSliceState(old.final));
 assert.equal(s.status,'ACTIVE');assert.equal(s.progression.sequence,2);assert.equal(s.week,169);
 assert.equal(s.health,70);assert.equal(s.mind,99);assert.equal(s.injuries.length,1);assert.equal(s.injuries[0].severity,'HEAVY');assert.equal(s.injuries[0].treatedRevision,null);assert.equal(Object.keys(s.progression.mastery).length,19);assert.equal(Object.values(s.progression.mastery).filter(v=>v===0).length,7);
 assert.equal(s.knowledgeMentor.encounter.enemyStatus,'DEAD');assert.equal(s.arcaneScholar.encounter.enemyStatus,'SURRENDERED');
 original=structuredClone(s);prefixVerified=true;originals();snapshot('departure');
 for(let n=0;s.injuries.length>0;n++){assert(n<30,'Original wound care exhausted');ordinary(`original-wound-rest-${n}`,true);}
 ready({ap:1,cash:500,health:100,mind:100,spirituality:120,pollution:0});eg({type:'LEARN_GUIDANCE'},'guidance');
 for(const taskId of ['REVIEW_RECORDS','CHECK_LIMITS','MARK_EXIT'])action({type:'PREPARE_TASK',taskId},`preparation-${taskId}`);
 for(let number=0;s.progression.sequence===2&&number<12;number++){
  let bottle=s.civilizationEnlightener.bottles.find(row=>row.status==='PLAYER')??s.civilizationEnlightener.bottles.find(row=>row.status==='SUPPLIER');
  if(!bottle){action({type:'REQUEST_SUPPLY'},`request-after-${number}-failures`);ready({afterWeek:s.civilizationEnlightener.resupply.requestedWeek});eg({type:'RECEIVE_SUPPLY'},`receive-real-later-week-${number}`);bottle=s.civilizationEnlightener.bottles.find(row=>row.status==='SUPPLIER');}
  assert(bottle);const bottleId=bottle.id;
  if(bottle.status==='SUPPLIER'){
   while(s.civilizationEnlightener.bottles.find(row=>row.id===bottleId).labourSteps<5)action({type:'POTION_WORK',bottleId});
   ready({cash:1250});eg({type:'BUY_POTION',bottleId},`buy-${bottleId}`);
  }
  ready({ap:1,cash:150,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.knowledgeMentor.promotionWeek+11});
  eg({type:'PREPARE_PROMOTION'},`prepare-${bottleId}`);const prior=structuredClone(s.progression.mastery);
  eg({type:'CONSUME',bottleId,confirmed:true},`consume-${bottleId}`);
  if(s.progression.sequence===1)for(const[id,value]of Object.entries(prior))assert.equal(s.progression.mastery[id],value);
 }
 if(s.progression.sequence!==1)save('NATURAL_FINITE_POTION_FAILURES_ALIVE_S2');
 else{
  snapshot('promoted');for(const id of ['paragon.s1.process-analysis','paragon.s1.operational-guidance'])assert.equal(s.progression.mastery[id],0);
  for(const caseId of ['worn-bearing','taught-stop','withdrawn-operation'])practice(caseId);
  action({type:'REFLECT'},'three-honest-reports-reflected');assert.equal(s.progression.acting,100);snapshot('practiced');
  assert(!s.civilizationEnlightener.life.practice.participant.present,'Original adults actually left before combat');
  ready({ap:2,health:100,mind:100,spirituality:120,pollution:0});
  eg({type:'ENCOUNTER_TALK'},'independent-adrian-name-exchange');eg({type:'ENCOUNTER_POLICY',policy:'ALL'},'choose-limited-powers-before-fight');eg({type:'ENCOUNTER_FIGHT'},'independent-optional-fight');snapshot('combatStart');
  const priorInjuries=new Set(s.injuries.map(i=>i.id));let retreat=false;
  for(let round=0;s.combat&&round<90;round++){
   retreat ||=s.health<=40||s.injuries.some(i=>i.severity==='HEAVY'&&!priorInjuries.has(i.id));
   go({type:'COMBAT_ROUND',stance:retreat?'RETREAT':['DEFEND','CONTROL','ATTACK'][round%3]},`combat-round-${round+1}`);
  }
  assert.equal(s.combat,null,'Finite encounter remains unresolved');snapshot('combatTerminal');
  if(view().encounter.inside)eg({type:'LEAVE_ENCOUNTER'},'actual-ordinary-exit');
  ordinary('ordinary-life-after-exit');save('NATURAL_CIVILIZATION_ENLIGHTENER_PUBLIC_CONTINUATION');
 }
}catch(error){
 if(error instanceof ActualTerminalStop)save('NATURAL_ACTUAL_TERMINAL');
 else{save('ACTUAL_BLOCKER',error);throw error;}
}
function fileDigest(path) {
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; hash.update(buffer.subarray(0, count)); } }
  finally { closeSync(fd); }
  return hash.digest('hex');
}
// Streaming top-level entry reader: skipped historical snapshot trees are never
// retained or parsed. StringDecoder preserves UTF-8 across 64KiB chunks.
function readObjectEntry(path, wanted) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START';
  let key = '', selected = false, quoted = false, escaped = false, depth = 0;
  let kind = 'PRIMITIVE';
  const pieces = [];
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null);
      const text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let captureStart = selected && phase === 'VALUE' ? 0 : -1;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (phase === 'START') { if (/\s/.test(c)) continue; if (c !== '{') throw new Error('Expected a top-level JSON object'); phase = 'KEY'; continue; }
        if (phase === 'KEY' || phase === 'AFTER') {
          if (/\s/.test(c) || c === ',') continue;
          if (c === '}') throw new Error(`Missing JSON object entry: ${wanted}`);
          if (c !== '"') throw new Error('Expected a JSON property name');
          key = '"'; escaped = false; phase = 'KEY_STRING'; continue;
        }
        if (phase === 'KEY_STRING') {
          key += c;
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
          else if (c === '"') { selected = JSON.parse(key) === wanted; phase = 'COLON'; }
          continue;
        }
        if (phase === 'COLON') { if (/\s/.test(c)) continue; if (c !== ':') throw new Error('Expected JSON colon'); phase = 'VALUE_START'; continue; }
        if (phase === 'VALUE_START') {
          if (/\s/.test(c)) continue;
          if (selected) captureStart = i;
          depth = 0; quoted = false; escaped = false;
          kind = c === '{' || c === '[' ? 'CONTAINER' : c === '"' ? 'STRING' : 'PRIMITIVE'; phase = 'VALUE';
        }
        if (phase === 'VALUE') {
          let done = false, end = i + 1;
          if (quoted) {
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') { quoted = false; if (kind === 'STRING' && depth === 0) done = true; }
          } else if (c === '"') quoted = true;
          else if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') { if (depth > 0) { depth--; if (depth === 0) done = true; } else { done = true; end = i; } }
          else if (kind === 'PRIMITIVE' && (c === ',' || /\s/.test(c))) { done = true; end = i; }
          if (done) {
            if (selected) { pieces.push(text.slice(captureStart, end)); return JSON.parse(pieces.join('')); }
            phase = 'AFTER'; selected = false; captureStart = -1;
          }
        }
      }
      if (captureStart >= 0) pieces.push(text.slice(captureStart));
      if (!n) break;
    }
  } finally { closeSync(fd); }
  throw new Error(`Missing JSON object entry: ${wanted}`);
}
