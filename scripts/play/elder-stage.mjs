import assert from 'node:assert/strict';
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
// The original 500-command Three Headed Templar run is the sole natural S3 source.
// Replay every command from its original creation and exact seed before continuing.
// Never load a fabricated promoted character, rewrite the source, or tune the random stream.
const source='tests/fixtures/three-headed-templar-v01550/natural.json';
const old=Object.fromEntries(['creation','seed','commands','final'].map(k=>[k,readObjectEntry(source,k)]));
const sourceHash=fileDigest(source), commands=[], boundaries={}, treatments=[];
mkdirSync('output/play',{recursive:true});
const outputDir=mkdtempSync('output/play/elder-01790-');
const write=(name,value)=>writeFileSync(`${outputDir}/${name}`,JSON.stringify(value),{flag:'wx'});
const roots=['secretSupplicant','listener','shadowAscetic','shepherd','blackKnight'];
let s=createSliceRun(old.final.runId,old.creation,old.seed), beforeLast=null,lastIntent=null,pendingIntent=null,prefixVerified=false;
const initial=structuredClone(s), snapshots={};
const view=()=>projectSliceState(s).elder;
function originals(){
 for(const root of roots)assert.deepEqual(s[root],old.final[root],`Preserve original ${root}`);
 const {reserve:oldReserve,...oldRose}=old.final.roseBishop;
 const {reserve:currentReserve,...currentRose}=s.roseBishop;
 assert.deepEqual(currentRose,oldRose,'Preserve all old Rose Bishop history outside actual paid combat reserve use');
 // Do not ignore the changing reserve. Derive every point spent from the new
 // domain-validated combat records, preserving the exact packets and their history.
 let expectedReserve=structuredClone(oldReserve);
 for(const round of s.combatHistory.slice(old.final.combatHistory.length)){
  const outcome=round.elderOutcome;assert(outcome,'Only actual Elder combat may extend the original history');
  assert.deepEqual(outcome.source.reserve,expectedReserve,'Each new round starts from the same finite original reserve');
  const spent=outcome.playerActions.reduce((total,action)=>total+action.reserveCost,0);
  assert(Number.isSafeInteger(spent)&&spent>=0&&spent<=expectedReserve.points);
  const after={...expectedReserve,points:expectedReserve.points-spent};
  assert.deepEqual(outcome.reserveAfter,after,'No new packets, refill or undocumented reserve loss');
  expectedReserve=structuredClone(outcome.reserveAfter);
 }
 assert.deepEqual(currentReserve,expectedReserve,'Actual original reserve equals replay-proven spending');
 assert.deepEqual(s.combatHistory.slice(0,old.final.combatHistory.length),old.final.combatHistory);
 assert.deepEqual(s.seer.completedSources.slice(0,old.final.seer.completedSources.length),old.final.seer.completedSources);
 const {life:_oldLife,...oldTemplar}=old.final.threeHeadedTemplar;const {life:_currentLife,...currentTemplar}=s.threeHeadedTemplar;assert.deepEqual(currentTemplar,oldTemplar);
 for(const [id,mastery] of Object.entries(old.final.progression.mastery))assert.equal(s.progression.mastery[id],mastery);
 const lifeSource=s.elder.life.source;
 if(lifeSource)assert.deepEqual(lifeSource.snapshot,old.final.threeHeadedTemplar.life,'Elder starts from the same real original court, adult, card and two grazed spirits');
 else assert.deepEqual(s.threeHeadedTemplar.life,old.final.threeHeadedTemplar.life);
 assert.equal(s.random.seed,old.seed);assert.equal(s.character.gender,old.final.character.gender);
 assert.equal(s.progression.promotionWeek,old.final.progression.promotionWeek);
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
 pendingIntent={type:'ELDER',command:structuredClone(command)};
 const available=view().actions.find(action=>isDeepStrictEqual(action.command,command));
 assert(available,`No current public Elder control for ${JSON.stringify(command)}`);assert(available.enabled,available.reason);
 go({type:'ELDER',command},key);
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
 write('natural.json',{provenance:{kind:'SAME_SEED_PUBLIC_NATURAL_PREFIX',source,sourceSha256:sourceHash,newRandomChanges:false},creation:old.creation,seed:old.seed,prefixCount:old.commands.length,prefixVerified,commands,initial,snapshots,treatments,stage,pendingIntent,error:error?String(error):null,final:s});
 write('boundaries.index.json',boundaries);
 write('summary.json',{stage,commands:commands.length,prefixCount:old.commands.length,status:s.status,sequence:s.progression.sequence,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,cursor:s.random.cursor,injuries:s.injuries,injuryRisk:s.injuryRisk,treatments:treatments.length,lifeCases:Object.fromEntries(Object.entries(s.elder.life.cases).map(([id,row])=>[id,{status:row.status,result:row.result,whisperTier:row.attempts.at(-1)?.whisperTier??null,chorusTier:row.attempts.at(-1)?.chorusTier??null,interrupted:row.attempts.at(-1)?.interrupted??false}])),encounter:s.elder.encounter.status,bottles:s.elder.bottles.map(b=>({id:b.id,outcome:b.outcome})),boundaries:Object.keys(boundaries),snapshots});
 console.log(JSON.stringify({outputDir,stage,commands:commands.length,status:s.status,sequence:s.progression.sequence,week:s.week}));
}

// Every following step is a currently exposed player command. Finite failures,
// rejection, injury, retreat and death remain their actual outcomes in the output.
function recoverOriginalInjuries(){
 assert.equal(s.health,40);assert.equal(s.careKnown,false);
 assert(s.injuries.some(row=>row.severity==='HEAVY'&&row.treatedRevision===null));
 ready({ap:2,cash:60});
 const before={health:s.health,cash:s.cash,injuries:structuredClone(s.injuries)};
 go({type:'ACTION',action:'INVESTIGATE',targetId:'CARE-ACCESS-01'},'clinic-actual-discovery');
 assert.equal(s.careKnown,true);assert.equal(s.health,before.health);assert.equal(s.cash,before.cash);assert.deepEqual(s.injuries,before.injuries);clear();
 for(let count=0;s.injuries.length;count++){
  assert(count<60,'Actual medical recovery did not finish; never erase the original wounds');
  const untreated=s.injuries.some(row=>row.severity==='HEAVY'&&row.treatedRevision===null);
  ready({cash:untreated?60:0});ordinary(untreated?'clinic-invitation-actual-rest':'treated-original-wounds-subsequent-rest',true);
 }
 assert.equal(treatments.length,1);assert(s.health>=80);assert.equal(s.injuryRisk,0);snapshot('originalInjuriesRecovered');
}
function practice(caseId){
 action({type:'OBSERVE',caseId},`${caseId}-observe`);
 // The last case spends one preparation AP plus two real casts in one week.
 // Recovery happens before entering; cleanup can always use the ordinary route.
 ready({ap:3,cash:24,health:100,mind:100,spirituality:30,pollution:0});
 const step=(type,key=null)=>eg({type,caseId},key),walk=to=>eg({type:'WALK',caseId,to});
 const attempt=()=>s.elder.life.cases[caseId].attempts.at(-1);
 const operation=()=>s.elder.life.operation;
 step('CONSENT_OWNER',`${caseId}-current-owner-consent`);eg({type:'PREPARE',caseId,method:'ABILITY'},`${caseId}-paid-materials`);
 walk('A');step('TAKE_CARD',`${caseId}-same-original-card`);walk('B');step('INSPECT_SEAL');step('INSTALL_SEAL');
 if(caseId!=='single-chorus')step('LOW_WHISPER',`${caseId}-single-natural-whisper-attempt`);
 if(caseId!=='sealed-whisper'){
  // Roland is already truly grazed with STEADY_HOLD in the original 500-command
  // record. Helena's original interrupted state is not silently cleared.
  const spirit=s.threeHeadedTemplar.life.spirits['THT3-ROLAND'];
  assert.equal(spirit.status,'GRAZED');assert(spirit.selectedAbilities.includes('STEADY_HOLD'));
  eg({type:'FOCUSED_CHORUS',caseId,spiritId:spirit.id,method:'STEADY_HOLD'},`${caseId}-single-natural-chorus-attempt`);
 }
 const effectReady=caseId==='sealed-whisper'?operation().suppressedUntil!==null:caseId==='single-chorus'?operation().focus!==null:operation().suppressedUntil!==null&&operation().focus!==null;
 if(effectReady)step('PERFORM_OPERATION',`${caseId}-actual-short-window-operation`);
 // Only a currently running chorus can be interrupted by the same real lamp.
 // A failed chorus stays failed; it is never retried or relabeled as a light hit.
 if(caseId==='interrupted-chorus'&&operation().focus!==null)step('INTERRUPT_CHORUS',`${caseId}-original-lamp-interruption`);
 if(s.threeHeadedTemplar.life.lamp.on)step('CLOSE_LIGHT',`${caseId}-same-lamp-closed`);
 if(operation().focus!==null||operation().suppressedUntil!==null)step('END_FOCUS',`${caseId}-actual-effects-stopped`);
 if(!attempt().performed)step('MANUAL_OPERATION',`${caseId}-ordinary-fallback`);
 step('REMOVE_SEAL');walk('A');step('RETURN_CARD',`${caseId}-same-card-returned`);walk('START');
 step('RETURN_ITEMS',`${caseId}-spent-original-materials-returned`);step('INSPECT');step('LEAVE',`${caseId}-actual-contact-closed`);
 action({type:'REPORT',caseId},`${caseId}-honest-report`);
}
try{
 assert.equal(old.commands.length,500,'The untouched natural S3 source has exactly 500 public commands');
 for(const intent of old.commands)go(intent);
 assert.deepEqual(s,migrateSliceState(old.final),'All 500 commands reproduce the migrated original terminal with the same seed');
 assert.deepEqual(commands,old.commands);prefixVerified=true;originals();snapshot('departure');
 recoverOriginalInjuries();
 ready({ap:1,cash:500,health:100,mind:100,spirituality:120,pollution:0});eg({type:'LEARN_GUIDANCE'},'guidance');
 for(const taskId of ['REVIEW_RECORDS','CHECK_LIMITS','MARK_EXIT'])action({type:'PREPARE_TASK',taskId},`preparation-${taskId}`);
 for(let number=0;s.progression.sequence===3&&number<12;number++){
  let bottle=s.elder.bottles.find(row=>row.status==='PLAYER')??s.elder.bottles.find(row=>row.status==='SUPPLIER');
  if(!bottle){
   assert(s.elder.bottles.every(row=>row.status==='CONSUMED'&&['FAILURE','GREAT_FAILURE'].includes(row.outcome)));
   action({type:'REQUEST_SUPPLY'},`request-supply-after-${number}-actual-failures`);
   ready({afterWeek:s.elder.resupply.requestedWeek});eg({type:'RECEIVE_SUPPLY'},`receive-next-week-supply-${number+1}`);
   bottle=s.elder.bottles.find(row=>row.status==='SUPPLIER');
  }
  assert(bottle);const bottleId=bottle.id;
  if(bottle.status==='SUPPLIER'){
   while(s.elder.bottles.find(row=>row.id===bottleId).labourSteps<5)action({type:'POTION_WORK',bottleId});
   ready({cash:1040});eg({type:'BUY_POTION',bottleId},`buy-${bottleId}`);
  }
  ready({ap:1,cash:140,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.threeHeadedTemplar.promotionWeek+11});
  eg({type:'PREPARE_PROMOTION'},`prepare-${bottleId}`);eg({type:'CONSUME',bottleId,confirmed:true},`consume-${bottleId}`);
  if(s.progression.sequence===3)ready({health:100,mind:100,spirituality:120,pollution:0});
 }
 if(s.progression.sequence!==2)save('NATURAL_FINITE_POTION_FAILURES_ALIVE_S3');
 else{
  snapshot('promoted');for(const id of ['hanged-man.s2.low-whisper','hanged-man.s2.focused-chorus'])assert.equal(s.progression.mastery[id],0);
  for(const caseId of ['sealed-whisper','single-chorus','interrupted-chorus'])practice(caseId);
  action({type:'REFLECT'},'three-cases-reflected');assert.equal(s.progression.acting,100);snapshot('practiced');
  ready({ap:2,health:100,mind:100,spirituality:120,pollution:0});eg({type:'PREPARE_ENCOUNTER'},'real-combat-preparation');
  eg({type:'ENCOUNTER_TALK'},'same-mara-ordinary-clearance');eg({type:'ENCOUNTER_FIGHT'},'independent-optional-fight');snapshot('combatStart');
  const priorInjuryIds=new Set(s.injuries.map(row=>row.id));let retreat=false;
  for(let round=0;s.combat&&round<90;round++){
   retreat ||=s.health<=40||s.injuries.some(row=>row.severity==='HEAVY'&&!priorInjuryIds.has(row.id));
   go({type:'COMBAT_ROUND',stance:retreat?'RETREAT':['DEFEND','CONTROL','ATTACK'][round%3]},`combat-round-${round+1}`);
  }
  assert.equal(s.combat,null,'Finite combat budget exhausted; preserve the actual unresolved state');
  snapshot('combatTerminal');ordinary('ordinary-life-after-actual-exit');save('NATURAL_ELDER_PUBLIC_CONTINUATION');
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
