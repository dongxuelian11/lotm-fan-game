import assert from 'node:assert/strict';
import { appendFileSync, copyFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { validateBeautyGoddessSource } from '../../dist/domain/beauty-goddess/index.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
// Replay the complete original572-command living LifeGiver route before continuing.
// This source already preserves its earlier living branch and original death evidence.
const source='tests/fixtures/life-giver-v01680/natural.json';
const old=Object.fromEntries(['creation','seed','commands','final'].map(k=>[k,readObjectEntry(source,k)]));
const sourceHash=fileDigest(source),commands=[],boundaries={},treatments=[];
mkdirSync('output/play',{recursive:true});
const outputDir=mkdtempSync('output/play/beauty-goddess-01900-');
const write=(name,value)=>writeFileSync(`${outputDir}/${name}`,JSON.stringify(value),{flag:'wx'});
const prefixCount=572;let original=null;
let s=createSliceRun(old.final.runId,old.creation,old.seed),beforeLast=null,lastIntent=null,pendingIntent=null,prefixVerified=false;
let initial=structuredClone(s);const snapshots={};
const resumeDirectory=process.argv[2]==='--resume-from'?process.argv[3]:null;
if(process.argv.length>2&&!resumeDirectory)throw new Error('Usage: beauty-goddess-stage.mjs [--resume-from actual-capture-directory]');
let continuationSource=null;
const view=()=>projectSliceState(s).beautyGoddess;
function originals(){
 assert(original);for(const root of ['apothecary','tamer','vampire','potionProfessor','crimsonScholar','witchKing','summoningMaster','lifeGiver']) {
  const live=structuredClone(s[root]);
  if(root==='summoningMaster')live.life.partner=structuredClone(original.summoningMaster.life.partner);
  if(root==='witchKing')live.life.papers=structuredClone(original.witchKing.life.papers);
  assert.deepEqual(live,original[root],`Preserve original ${root}`);
 }
 if(s.beautyGoddess.guidanceKnown)assert(validateBeautyGoddessSource(s),'Original live resources must reconcile with actual receipts');
 assert.deepEqual(s.combatHistory.slice(0,original.combatHistory.length),original.combatHistory);
 for(const[id,value]of Object.entries(original.progression.mastery))assert(s.progression.mastery[id]>=value);
 assert.equal(s.random.seed,old.seed);assert.equal(s.character.name,original.character.name);assert.equal(s.character.gender,original.character.gender);
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
 pendingIntent={type:'BEAUTY_GODDESS',command:structuredClone(command)};
 const available=view().actions.find(action=>isDeepStrictEqual(action.command,command));
 assert(available,`No current public BeautyGoddess control for ${JSON.stringify(command)}`);assert(available.enabled,available.reason);
 go({type:'BEAUTY_GODDESS',command},key);
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
 write('natural.json',{provenance:{kind:'SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION',source,sourceSha256:sourceHash,newRandomChanges:false},creation:old.creation,seed:old.seed,prefixCount,prefixVerified,continuationSource,commands,initial,prefixFinal:original,snapshots,treatments,stage,pendingIntent,error:error?String(error):null,final:s});
 write('boundaries.index.json',boundaries);
 write('summary.json',{stage,commands:commands.length,prefixCount,status:s.status,sequence:s.progression.sequence,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,cursor:s.random.cursor,injuries:s.injuries,injuryRisk:s.injuryRisk,treatments:treatments.length,lifeCases:Object.fromEntries(Object.entries(s.beautyGoddess.life.cases).map(([id,row])=>[id,{status:row.status,result:row.result,attempt:row}])),encounter:s.beautyGoddess.encounter.status,bottles:s.beautyGoddess.bottles.map(b=>({id:b.id,outcome:b.outcome})),boundaries:Object.keys(boundaries),snapshots});
 console.log(JSON.stringify({outputDir,stage,commands:commands.length,status:s.status,sequence:s.progression.sequence,week:s.week}));
}

function practice(caseId){
 if(s.beautyGoddess.life.cases[caseId].status==='RESOLVED')return;
 if(s.beautyGoddess.life.practice.activeCase!==caseId){
  action({type:'OBSERVE',caseId},`${caseId}-observe-original`);
  ready({ap:2,cash:150,health:100,mind:100,spirituality:120});
  eg({type:'INVITE',caseId,method:'ABILITY'},`${caseId}-fresh-invitation`);
 }
 if(!s.beautyGoddess.life.cases[caseId].visited)eg({type:'VISIT_HOME'},`${caseId}-actual60metre-walk`);
 for(const permission of ['GUEST','CARETAKER','SELF_POWER'])eg({type:'CONSENT',permission},`${caseId}-consent-${permission}`);
 eg({type:'BORROW_WEIGHT'},`${caseId}-same-original-weight`);
 if(caseId==='steady-hands'){
  eg({type:'SELF_POISE'},'paid-self-only-poise');eg({type:'PRECISION_PLACE'},'actual-next-precision-operation');
 }else{
  eg({type:'BORROW_LAMP'},`${caseId}-same-real-lamp`);
  if(s.beautyGoddess.life.practice.lamp.oilPurchasedWeek===null)eg({type:'BUY_OIL'},'actual-paid-finite-oil');
  const pieceId=caseId==='lit-crossing'?'BG1-MOON-PIECE-1':'BG1-MOON-PIECE-2';
  eg({type:'BUY_PIECE',pieceId},`${caseId}-actual-paid-piece`);eg({type:'LIGHT_LAMP'},`${caseId}-actual-lamp-lit`);
  eg({type:'ARM_CROSSING'},`${caseId}-actual-pending-crossing`);eg({type:'BOUNDED_MOONFORM'},`${caseId}-paid-bounded-window`);
  if(caseId==='lit-crossing')eg({type:'GUEST_CARRY'},'same-guest-independent-carry');
  else{
   eg({type:'LOWER_SHUTTER'},'real-shutter-blocks-window');
   eg({type:'REVOKE_CONSENT',permission:'GUEST'},'same-guest-withdraws-current-permission');
   eg({type:'RAISE_SHUTTER'},'ordinary-reopen-original-path');
  }
 }
 if(s.beautyGoddess.life.cases[caseId].result==='NONE')eg({type:'ORDINARY_PLACE'},`${caseId}-ordinary-safe-handling`);
 if(s.beautyGoddess.life.practice.lamp.lit)eg({type:'EXTINGUISH_LAMP'},`${caseId}-actual-lamp-extinguished`);
 eg({type:'RETURN_WEIGHT'},`${caseId}-same-weight-returned`);
 if(s.beautyGoddess.life.practice.guestOffsetMetres===2)eg({type:'RETURN_GUEST'},'same-guest-real-two-metre-return');
 if(s.beautyGoddess.life.practice.pieces.some(x=>x.holder==='PLAYER'))eg({type:'RETURN_PIECES'},`${caseId}-physical-pieces-returned`);
 if(s.beautyGoddess.life.practice.lamp.holder==='PLAYER')eg({type:'RETURN_LAMP'},`${caseId}-same-lamp-returned`);
 eg({type:'RETURN_HOME'},`${caseId}-actual60metre-return`);action({type:'REPORT',caseId},`${caseId}-honest-report`);
}
try{
 if(resumeDirectory){
  const file=`${resumeDirectory}/natural.json`,entry=k=>readObjectEntry(file,k);
  const previous=entry('commands');assert.deepEqual(previous.slice(0,prefixCount),old.commands);
  assert.equal(entry('seed'),old.seed);assert.equal(entry('prefixVerified'),true);
  s=migrateSliceState(entry('final'));assertValidSliceState(s);assert.equal(s.status,'ACTIVE');
  initial=migrateSliceState(entry('initial'));original=migrateSliceState(entry('prefixFinal'));commands.push(...previous);prefixVerified=true;
  assert.deepEqual(original,migrateSliceState(old.final));originals();treatments.push(...entry('treatments'));
  Object.assign(snapshots,entry('snapshots'));
  const priorIndex=JSON.parse(readFileSync(`${resumeDirectory}/boundaries.index.json`));Object.assign(boundaries,priorIndex);
  for(const name of new Set([...Object.values(snapshots),...Object.values(boundaries)]))copyFileSync(`${resumeDirectory}/${name}`,`${outputDir}/${name}`);
  copyFileSync(`${resumeDirectory}/commands.jsonl`,`${outputDir}/commands.jsonl`);
  continuationSource={sha256:fileDigest(file),commands:previous.length,status:'ACTIVE',revision:s.revision,randomCursor:s.random.cursor};
 }else{
 assert.equal(old.commands.length,prefixCount);assert.equal(old.final.status,'ACTIVE');
 for(const intent of old.commands)go(intent);
 assert.deepEqual(commands,old.commands);assert.deepEqual(s,migrateSliceState(old.final));
 assert.equal(s.status,'ACTIVE');assert.equal(s.progression.sequence,2);assert.equal(s.week,131);
 assert.equal(s.health,70);assert.equal(s.mind,100);assert.equal(s.injuries.length,3);assert(s.injuries.every(w=>w.severity==='LIGHT'&&w.treatedRevision===null));
 assert.equal(Object.keys(s.progression.mastery).length,21);assert.equal(Object.values(s.progression.mastery).filter(v=>v===0).length,7);
 assert(s.witchKing.life.papers.every(p=>p.status==='CONSUMED'));assert.equal(s.lifeGiver.encounter.enemyStatus,'RESISTING');
 original=structuredClone(s);prefixVerified=true;originals();snapshot('departure');
 for(let n=0;s.injuries.length>0;n++){assert(n<30,'Original wound care exhausted');ordinary(`original-wound-rest-${n}`,true);}
 ready({ap:1,cash:500,health:100,mind:100,spirituality:120,pollution:0});eg({type:'LEARN_GUIDANCE'},'guidance');
 eg({type:'CONFIRM_TRANSFORMATION',confirmed:true},'explicit-successful-female-body-confirmation');
 for(const taskId of ['REVIEW_RECORDS','CHECK_LIMITS','MARK_EXIT'])action({type:'PREPARE_TASK',taskId},`preparation-${taskId}`);
 }
 for(let number=s.beautyGoddess.bottles.filter(b=>b.status==='CONSUMED').length;s.progression.sequence===2&&number<12;number++){
  let bottle=s.beautyGoddess.bottles.find(row=>row.status==='PLAYER')??s.beautyGoddess.bottles.find(row=>row.status==='SUPPLIER');
  if(!bottle){ready({cash:100});action({type:'REQUEST_SUPPLY'},`request-after-${number}-failures`);ready({afterWeek:s.beautyGoddess.resupply.requestedWeek});eg({type:'RECEIVE_SUPPLY'},`receive-real-later-week-${number}`);bottle=s.beautyGoddess.bottles.find(row=>row.status==='SUPPLIER');}
  assert(bottle);const bottleId=bottle.id;
  if(bottle.status==='SUPPLIER'){
   while(s.beautyGoddess.bottles.find(row=>row.id===bottleId).labourSteps<5)action({type:'POTION_WORK',bottleId});
   ready({cash:1250});eg({type:'BUY_POTION',bottleId},`buy-${bottleId}`);
  }
  ready({ap:1,cash:150,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.lifeGiver.promotionWeek+11});
  eg({type:'PREPARE_PROMOTION'},`prepare-${bottleId}`);const prior=structuredClone(s.progression.mastery);
  eg({type:'CONSUME',bottleId,confirmed:true},`consume-${bottleId}`);
  if(s.progression.sequence===1)for(const[id,value]of Object.entries(prior))assert.equal(s.progression.mastery[id],value);
 }
 if(s.progression.sequence!==1)save('NATURAL_FINITE_POTION_FAILURES_ALIVE_S2');
 else{
  if(!snapshots.promoted)snapshot('promoted');for(const id of ['moon.s1.self-poise','moon.s1.bounded-moonform'])assert.equal(s.progression.mastery[id],0);
  for(const caseId of ['steady-hands','lit-crossing','withdrawn-moonlight'])practice(caseId);
  action({type:'REFLECT'},'three-honest-reports-reflected');assert.equal(s.progression.acting,100);snapshot('practiced');
  assert.equal(s.summoningMaster.life.partner.location,'HOME');assert.equal(s.beautyGoddess.life.practice.playerLocation,'YARD');
  ready({cash:250});action({type:'BUY_BATTLE_LAMP'},'paid-independent-battle-lamp');
  for(let piece=1;piece<=3;piece++)action({type:'PREPARE_BATTLE_PIECE'},`paid-independent-battle-piece-${piece}`);
  ready({ap:2,health:100,mind:100,spirituality:120,pollution:0});
  eg({type:'ENCOUNTER_TALK'},'independent-oswald-name-exchange');eg({type:'ENCOUNTER_POLICY',policy:'ALL'},'choose-limited-powers-before-fight');eg({type:'ENCOUNTER_FIGHT'},'independent-optional-fight');snapshot('combatStart');
  const priorInjuries=new Set(s.injuries.map(i=>i.id));let retreat=false;
  for(let round=0;s.combat&&round<90;round++){
   retreat ||=s.health<=40||s.injuries.some(i=>i.severity==='HEAVY'&&!priorInjuries.has(i.id));
   go({type:'COMBAT_ROUND',stance:retreat?'RETREAT':['DEFEND','CONTROL','ATTACK'][round%3]},`combat-round-${round+1}`);
  }
  assert.equal(s.combat,null,'Finite encounter remains unresolved');snapshot('combatTerminal');
  if(view().encounter.inside)eg({type:'LEAVE_ENCOUNTER'},'actual-ordinary-exit');
  ordinary('ordinary-life-after-exit');save('NATURAL_BEAUTY_GODDESS_PUBLIC_CONTINUATION');
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
