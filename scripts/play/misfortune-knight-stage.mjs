import assert from 'node:assert/strict';
import { appendFileSync, copyFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { validateMisfortuneKnightSource } from '../../dist/domain/misfortune-knight/index.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
// Replay the exact original518-command peaceful boundary, preserving the separate528-command death branch.
const source='tests/fixtures/concealment-servant-v01690/natural.json';
const peacefulSource='tests/fixtures/concealment-servant-v01690/original-enemy-approach.json',peacefulHash=fileDigest(peacefulSource);
const peaceful=readObjectEntry(peacefulSource,'beforeLast');
const old=Object.fromEntries(['creation','seed','commands','final'].map(k=>[k,readObjectEntry(source,k)]));
const sourceHash=fileDigest(source),commands=[],boundaries={},treatments=[];
assert.equal(sourceHash,'b1edff5df12aa0b3a88aa16b2feee5ff63766ea15d4c7346b9ccb294f1c8c7b4');
assert.equal(peacefulHash,'667f41064ca3aedc76365a66a05bd26ec2fb47a20d6cbf74ffa744a88b778dba');
// Declared before play. Never search seeds/cursors, choose a winning result,
// switch stance after damage, or replace a failed spell with another attempt.
const strategy=Object.freeze({caseMethod:'ABILITY',encounterPolicy:'ALL',combatStance:'CONTROL',combatRoundCap:90,potionAttemptCap:12});
mkdirSync('output/play',{recursive:true});
const outputDir=mkdtempSync('output/play/misfortune-knight-01910-');
const write=(name,value)=>writeFileSync(`${outputDir}/${name}`,JSON.stringify(value),{flag:'wx'});
const prefixCount=518;let original=null;
let s=createSliceRun(old.final.runId,old.creation,old.seed),beforeLast=null,lastIntent=null,pendingIntent=null,prefixVerified=false;
let initial=structuredClone(s);const snapshots={};
const resumeDirectory=process.argv[2]==='--resume-from'?process.argv[3]:null;
if(process.argv.length>2&&!resumeDirectory)throw new Error('Usage: misfortune-knight-stage.mjs [--resume-from actual-capture-directory]');
let continuationSource=null;
const view=()=>projectSliceState(s).misfortuneKnight;
function originals(){
 assert(original);
 for(const root of ['sleepless','midnight','nightmare','soother','spiritWarlock','nightwatcher','fearBishop','concealmentServant']) {
  const live=structuredClone(s[root]);
  if(root==='spiritWarlock')live.companion=structuredClone(original.spiritWarlock.companion);
  if(root==='concealmentServant') {
   live.life.playerLocation=original.concealmentServant.life.playerLocation;
   live.life.playerTravelMetres=original.concealmentServant.life.playerTravelMetres;
   live.life.clockSeconds=original.concealmentServant.life.clockSeconds;
   live.life.room.doorBlocked=original.concealmentServant.life.room.doorBlocked;
   live.life.box.location=original.concealmentServant.life.box.location;
   live.life.box.travelMetres=original.concealmentServant.life.box.travelMetres;
  }
  assert.deepEqual(live,original[root],`Preserve original ${root}`);
 }
 if(s.misfortuneKnight.guidanceKnown)assert(validateMisfortuneKnightSource(s),'Original resources reconcile with actual receipts');
 assert.deepEqual(s.combatHistory.slice(0,original.combatHistory.length),original.combatHistory);
 for(const[id,value]of Object.entries(original.progression.mastery))assert.equal(s.progression.mastery[id],value,`Preserve original mastery ${id}`);
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
 if(prefixVerified&&intent.type==='COMBAT_ROUND'){
  const p=projectSliceState(s);
  assert.equal(p.status,'ACTIVE');assert.equal(p.activeEvent,null);assert(p.combat,'No current public battle');
  assert(p.combat.stances.some(stance=>stance.id===intent.stance),'The declared stance must be publicly offered');
 }
 beforeLast=s;lastIntent=structuredClone(intent);
 s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(structuredClone(intent));pendingIntent=null;
 if(prefixVerified){originals();capture(key);appendFileSync(`${outputDir}/commands.jsonl`,JSON.stringify({step:commands.length,intent,revision:s.revision,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,sequence:s.progression.sequence,acting:s.progression.acting,cursor:s.random.cursor})+'\n');}
 if(prefixVerified&&s.status!=='ACTIVE')throw new ActualTerminalStop(`Actual ${s.status}`);
}
class ActualTerminalStop extends Error{}
class FiniteEncounterStop extends Error{}
function eg(command,key=null){
 pendingIntent={type:'MISFORTUNE_KNIGHT',command:structuredClone(command)};
 const available=view().actions.find(action=>isDeepStrictEqual(action.command,command));
 assert(available,`No current public MisfortuneKnight control for ${JSON.stringify(command)}`);assert(available.enabled,available.reason);
 go({type:'MISFORTUNE_KNIGHT',command},key);
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
function ordinary(key=null,forceRest=false){clear();assert(!view().insideCase&&!view().encounter.inside&&!s.combat);go({type:'ACTION',action:forceRest||s.wagePaidWeek===s.week?'REST':'WORK'},key);clear();}
function ready({ap=1,cash=0,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}){
 assert(!view().insideCase&&!view().encounter.inside&&!s.combat,'Real preparation must happen outside any active scene');
 clear();for(let n=0;s.actionsRemaining<ap||s.cash<cash||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek;n++){assert(n<600,'Ordinary preparation budget exhausted');ordinary();}
}
function action(command,key=null){ready();eg(command,key);clear();}
function snapshot(name){if(snapshots[name])return;const file=`snapshot-${name}.json`;write(file,s);snapshots[name]=file;}
function save(stage,error=null){
 assert.equal(fileDigest(source),sourceHash);assert.equal(fileDigest(peacefulSource),peacefulHash);
 write('natural.json',{provenance:{kind:'SAME_SEED_ORIGINAL_PEACEFUL_BOUNDARY_BRANCH',source,sourceSha256:sourceHash,peacefulSource,peacefulSha256:peacefulHash,originalDeathPreserved:true,newRandomChanges:false},strategy,creation:old.creation,seed:old.seed,prefixCount,prefixVerified,continuationSource,commands,initial,prefixFinal:original,snapshots,treatments,stage,pendingIntent,error:error?String(error):null,final:s});
 write('boundaries.index.json',boundaries);
 write('summary.json',{stage,strategy,commands:commands.length,prefixCount,status:s.status,sequence:s.progression.sequence,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,cursor:s.random.cursor,injuries:s.injuries,injuryRisk:s.injuryRisk,treatments:treatments.length,lifeCases:Object.fromEntries(Object.entries(s.misfortuneKnight.life.cases).map(([id,row])=>[id,{status:row.status,result:row.result,attempt:row}])),encounter:s.misfortuneKnight.encounter.status,encounterTerminal:s.misfortuneKnight.encounter.terminal,encounterMaterials:s.misfortuneKnight.encounter.materials,bottles:s.misfortuneKnight.bottles.map(b=>({id:b.id,outcome:b.outcome})),boundaries:Object.keys(boundaries),snapshots});
 console.log(JSON.stringify({outputDir,stage,commands:commands.length,status:s.status,sequence:s.progression.sequence,week:s.week}));
}

function practice(caseId){
 // State guards resume only the unexecuted tail of this same fixed procedure.
 // They do not inspect future rolls, retry checks, or choose another strategy.
 const row=()=>s.misfortuneKnight.life.cases[caseId],room=()=>s.misfortuneKnight.life.practice;
 if(row().status==='RESOLVED')return;
 assert(['AVAILABLE','OBSERVED','ACTIVE','EXAMINED'].includes(row().status),'Do not replace an interrupted case with a new attempt');
 if(row().status==='AVAILABLE')action({type:'OBSERVE',caseId},`${caseId}-observe-original`);
 if(row().status==='OBSERVED'){
  ready({ap:2,cash:150,health:100,mind:100,spirituality:120});
  eg({type:'INVITE',caseId,method:strategy.caseMethod},`${caseId}-fresh-paid-invitation`);
 }
 if(row().status==='ACTIVE'){
  assert.equal(room().activeCase,caseId);assert.equal(row().method,strategy.caseMethod);
  if(!row().visited)eg({type:'VISIT_ROOM'},`${caseId}-actual40metre-walk`);
  for(const[permission,key]of [['OWNER','owner'],['TECHNICIAN','technician'],['SELF_POWER','selfPower']]){
   if(row().permission[key]==='UNASKED')eg({type:'CONSENT',permission},`${caseId}-consent-${permission}`);
  }
  if(row().result==='NONE'){
   if(!room().rig.borrowed)eg({type:'SETUP_TOOLS'},`${caseId}-actual-original-tool-setup`);
   if(!row().boxBorrowed)eg({type:'BORROW_BOX'},`${caseId}-same-original-box`);
   if(caseId==='pending-parcel'){
    if(!row().parcelArmed)eg({type:'ARM_PARCEL'},`${caseId}-actual-pending-original-box`);
    if(!row().guidedAttempted)eg({type:'GUIDED_MISHAP'},`${caseId}-paid-guided-mishap-attempt`);
    if(!row().parcelAttempted)eg({type:'CATCH_PARCEL'},`${caseId}-actual-independent-catch`);
    // A failed spell still permits one real catch. A failed catch leaves the
    // same box on the pad; ordinary pickup retains both actual check results.
    if(row().result==='NONE')eg({type:'ORDINARY_CARRY'},`${caseId}-ordinary-pickup-after-failure`);
   }else{
    if(room().plate.holder==='OWNER')eg({type:'BORROW_PLATE'},`${caseId}-same-finite-wood-plate`);
    if(!row().guardArmed)eg({type:'ARM_IMPACT'},`${caseId}-actual-unreleased-calibration-weight`);
    if(!row().guardAttempted)eg({type:'BOUNDED_NIGHT_GUARD'},`${caseId}-paid-guard-and-real-wear`);
    if(caseId==='personal-dark-guard'){
     if(!row().impactReleased)eg({type:'RELEASE_WEIGHT'},`${caseId}-actual-light-impact`);
     if(room().rig.weightState==='RELEASED')eg({type:'MANUAL_STOP'},`${caseId}-ordinary-stop-after-failed-guard`);
    }else{
     assert.equal(caseId,'withdrawn-path');assert.equal(row().impactReleased,false);
     if(!row().obstructionObserved)eg({type:'BLOCK_DOOR'},`${caseId}-actual-original-door-obstruction`);
     if(!row().withdrawalObserved)eg({type:'REVOKE_CONSENT',permission:'OWNER'},`${caseId}-current-owner-withdrawal`);
     if(room().rig.weightState==='ARMED')eg({type:'STOP_RELEASE'},`${caseId}-actual-unreleased-weight-stop`);
     if(s.concealmentServant.life.room.doorBlocked)eg({type:'CLEAR_DOOR'},`${caseId}-ordinary-clear-original-door`);
     if(row().result==='NONE')eg({type:'ORDINARY_CARRY'},`${caseId}-ordinary-safe-handling-after-withdrawal`);
    }
   }
  }
  assert.notEqual(row().result,'NONE','Keep the actual completed operation or ordinary fallback');
  if(room().rig.weightState==='ARMED')eg({type:'STOP_RELEASE'},`${caseId}-stop-unused-weight`);
  if(s.concealmentServant.life.room.doorBlocked)eg({type:'CLEAR_DOOR'},`${caseId}-clear-original-exit`);
  if(room().boxHolder!=='START')eg({type:'RETURN_BOX'},`${caseId}-same-original-box-returned`);
  if(room().plate.holder==='PLAYER')eg({type:'RETURN_PLATE'},`${caseId}-same-worn-plate-returned`);
  if(room().rig.borrowed)eg({type:'RETURN_TOOLS'},`${caseId}-same-tray-and-tools-returned`);
  eg({type:'RETURN_HOME'},`${caseId}-actual40metre-return`);
 }
 assert.equal(row().status,'EXAMINED');
 action({type:'REPORT',caseId},`${caseId}-honest-report`);
 assert.deepEqual(s.spiritWarlock.companion,original.spiritWarlock.companion,'Life keeps the same sealed twelve-deployment leaf');
}
function encounter(){
 const current=()=>s.misfortuneKnight.encounter;
 if(current().status==='AVAILABLE'){
  if(current().materials.plate===null){
   ready({ap:1,cash:40});
   const offered=view().actions.find(a=>a.command.type==='BUY_BATTLE_PLATE');
   assert(offered,'The actual battle-plate control must be projected');
   if(offered.enabled)eg({type:'BUY_BATTLE_PLATE'},'actual-paid40p-independent-battle-plate');
  }
  // Both arrival and fight consume real AP. No work/rest or inventory edits
  // are inserted after arriving in the locked independent encounter.
  ready({ap:2,health:100,mind:100,spirituality:120,pollution:0});
  assert.deepEqual(s.spiritWarlock.companion,original.spiritWarlock.companion);
  eg({type:'ENCOUNTER_TALK'},'actual4metre-arrival-and-alden-name-exchange');
 }
 if(current().status==='READY'){
  if(!view().encounter.policyConfirmed)eg({type:'ENCOUNTER_POLICY',policy:strategy.encounterPolicy},'fixed-all-policy-before-fight');
  assert.equal(current().policy,strategy.encounterPolicy);
  eg({type:'ENCOUNTER_FIGHT'},'independent-optional-fight');snapshot('combatStart');
 }
 if(current().status==='FIGHTING'){
  assert.equal(current().policy,strategy.encounterPolicy);
  for(const round of s.combatHistory.slice(current().startHistoryIndex))assert.equal(round.stance,strategy.combatStance,'A resumed encounter keeps the declared stance');
  while(s.combat&&s.combat.round<=strategy.combatRoundCap){
   const round=s.combat.round;
   go({type:'COMBAT_ROUND',stance:strategy.combatStance},`combat-round-${round}`);
  }
  if(s.combat){snapshot('combatFiniteCap');throw new FiniteEncounterStop('Declared ninety-round cap reached; actual unfinished combat preserved');}
 }
 assert.equal(s.combat,null);assert(current().terminal,'A completed fight must retain its actual terminal receipt');
 // Combat settlement itself performs the actual surviving exit and plate
 // return. LEAVE_ENCOUNTER exists only for a pre-fight READY peaceful exit;
 // never invent a second visit or send its disabled post-terminal control.
 assert.equal(current().terminal.exitMetres,4);assert.equal(current().terminal.exitSeconds,4);
 assert.equal(current().scene.playerLocation,'OUTSIDE');assert.equal(current().scene.playerCoordinate,0);
 if(current().materials.plate)assert.equal(current().materials.plate.location,'RETURN_TRAY');
 assert.equal(view().encounter.inside,false);capture('actual-ordinary-encounter-exit');snapshot('combatTerminal');
}
try{
 if(resumeDirectory){
  const file=`${resumeDirectory}/natural.json`,entry=k=>readObjectEntry(file,k);
  const provenance=entry('provenance');assert.equal(provenance.sourceSha256,sourceHash);assert.equal(provenance.peacefulSha256,peacefulHash);
  const previous=entry('commands');assert.deepEqual(previous.slice(0,prefixCount),old.commands.slice(0,prefixCount));
  assert.equal(entry('seed'),old.seed);assert.equal(entry('prefixVerified'),true);
  s=migrateSliceState(entry('final'));assertValidSliceState(s);assert.equal(s.status,'ACTIVE');
  initial=migrateSliceState(entry('initial'));original=migrateSliceState(entry('prefixFinal'));commands.push(...previous);prefixVerified=true;
  assert.deepEqual(original,migrateSliceState(peaceful));originals();treatments.push(...entry('treatments'));
  Object.assign(snapshots,entry('snapshots'));
  const priorIndex=JSON.parse(readFileSync(`${resumeDirectory}/boundaries.index.json`));Object.assign(boundaries,priorIndex);
  for(const name of new Set([...Object.values(snapshots),...Object.values(boundaries)]))copyFileSync(`${resumeDirectory}/${name}`,`${outputDir}/${name}`);
  copyFileSync(`${resumeDirectory}/commands.jsonl`,`${outputDir}/commands.jsonl`);
  continuationSource={sha256:fileDigest(file),commands:previous.length,status:'ACTIVE',revision:s.revision,randomCursor:s.random.cursor};
 }else{
 assert.equal(old.commands.length,528);assert.equal(old.final.status,'DEAD');assert.equal(peaceful.status,'ACTIVE');
 assert.deepEqual(readObjectEntry(peacefulSource,'lastIntent'),old.commands[prefixCount]);
 for(const intent of old.commands.slice(0,prefixCount))go(intent);
 assert.deepEqual(commands,old.commands.slice(0,prefixCount));assert.deepEqual(s,migrateSliceState(peaceful));
 assert.equal(s.status,'ACTIVE');assert.equal(s.progression.sequence,2);assert.equal(s.week,121);
 assert.equal(s.random.seed,'sleepless-natural-v020');assert.equal(s.random.cursor,341);
 assert.equal(s.health,100);assert.equal(s.mind,100);assert.equal(s.injuries.length,0);assert.equal(s.injuryRisk,0);
 assert.equal(Object.keys(s.progression.mastery).length,18);assert.equal(Object.values(s.progression.mastery).filter(v=>v===0).length,5);
 assert.equal(s.concealmentServant.encounter.status,'AVAILABLE');assert.equal(s.concealmentServant.encounter.enemyStatus,'RESISTING');
 original=structuredClone(s);prefixVerified=true;originals();snapshot('departure');
 }
 if(s.progression.sequence===2){
  if(!s.misfortuneKnight.guidanceKnown){ready({ap:1,cash:500,health:100,mind:100,spirituality:120,pollution:0});eg({type:'LEARN_GUIDANCE'},'guidance');}
  for(const taskId of ['REVIEW_RECORDS','CHECK_LIMITS','MARK_EXIT'])if(!s.misfortuneKnight.preparations.some(row=>row.taskId===taskId))action({type:'PREPARE_TASK',taskId},`preparation-${taskId}`);
 }
 for(let number=s.misfortuneKnight.bottles.filter(b=>b.status==='CONSUMED').length;s.progression.sequence===2&&number<strategy.potionAttemptCap;number++){
  let bottle=s.misfortuneKnight.bottles.find(row=>row.status==='PLAYER')??s.misfortuneKnight.bottles.find(row=>row.status==='SUPPLIER');
  if(!bottle){
   if(s.misfortuneKnight.resupply.requestedWeek===null){ready({cash:100});action({type:'REQUEST_SUPPLY'},`request-after-${number}-failures`);}
   ready({afterWeek:s.misfortuneKnight.resupply.requestedWeek});eg({type:'RECEIVE_SUPPLY'},`receive-real-later-week-${number}`);bottle=s.misfortuneKnight.bottles.find(row=>row.status==='SUPPLIER');
  }
  assert(bottle);const bottleId=bottle.id;
  if(bottle.status==='SUPPLIER'){
   while(s.misfortuneKnight.bottles.find(row=>row.id===bottleId).labourSteps<5)action({type:'POTION_WORK',bottleId});
   ready({cash:1250});eg({type:'BUY_POTION',bottleId},`buy-${bottleId}`);
  }
  if(s.misfortuneKnight.preparedWeek===null){
   ready({ap:1,cash:150,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.concealmentServant.promotionWeek+11});
   eg({type:'PREPARE_PROMOTION'},`prepare-${bottleId}`);
  }
  assert.equal(s.misfortuneKnight.preparedWeek,s.week);assert(s.week-s.concealmentServant.promotionWeek>=12);
  const prior=structuredClone(s.progression.mastery);
  eg({type:'CONSUME',bottleId,confirmed:true},`consume-${bottleId}`);
  if(s.progression.sequence===1)for(const[id,value]of Object.entries(prior))assert.equal(s.progression.mastery[id],value);
 }
 if(s.progression.sequence!==1)save('NATURAL_FINITE_POTION_FAILURES_ALIVE_S2');
 else{
  if(s.misfortuneKnight.life.journal.length===0){
   for(const id of ['darkness.s1.guided-mishap','darkness.s1.bounded-night-guard'])assert.equal(s.progression.mastery[id],0);
   snapshot('promoted');
  }
  for(const caseId of ['pending-parcel','personal-dark-guard','withdrawn-path'])practice(caseId);
  if(!s.misfortuneKnight.life.reflected)action({type:'REFLECT'},'three-honest-reports-reflected');
  assert.equal(s.progression.acting,100);snapshot('practiced');
  assert.equal(s.concealmentServant.life.erin.location,'EXIT');assert.equal(s.misfortuneKnight.life.practice.technician.location,'EXIT');
  assert.equal(s.misfortuneKnight.life.practice.playerLocation,'YARD');
  encounter();
  if(!boundaries['ordinary-life-after-exit'])ordinary('ordinary-life-after-exit');
  save('NATURAL_MISFORTUNE_KNIGHT_PUBLIC_CONTINUATION');
 }
}catch(error){
 if(error instanceof ActualTerminalStop){if(s.misfortuneKnight.encounter.terminal)snapshot('combatTerminal');snapshot('actualTerminal');save('NATURAL_ACTUAL_TERMINAL');}
 else if(error instanceof FiniteEncounterStop)save('NATURAL_FINITE_ENCOUNTER_UNRESOLVED',error);
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
