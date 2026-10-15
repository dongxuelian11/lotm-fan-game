import assert from 'node:assert/strict';
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
// Continue the original living 555-command FrenzyMage prefix with its original seed.
// The separate original558 death remains preserved; this branch declines that optional old fight.
// Replay every command from its original creation and exact seed before continuing.
// Never load a fabricated promoted character, rewrite the source, or tune the random stream.
const source='tests/fixtures/frenzy-mage-v01590/natural.json';
const old=Object.fromEntries(['creation','seed','commands','final'].map(k=>[k,readObjectEntry(source,k)]));
const sourceHash=fileDigest(source), commands=[], boundaries={}, treatments=[];
mkdirSync('output/play',{recursive:true});
const outputDir=mkdtempSync('output/play/entropy-duke-01830-');
const write=(name,value)=>writeFileSync(`${outputDir}/${name}`,JSON.stringify(value),{flag:'wx'});
const roots=['lawyer','barbarian','corruptionBaron','mentorDisorder','fallenEarl'];
const prefixCount=555;let original=null;
let s=createSliceRun(old.final.runId,old.creation,old.seed), beforeLast=null,lastIntent=null,pendingIntent=null,prefixVerified=false;
const initial=structuredClone(s), snapshots={};
const view=()=>projectSliceState(s).entropyDuke;
function originals(){
 assert(original,'The exact living 555-command prefix must exist');
 for(const root of roots)assert.deepEqual(s[root],original[root],`Preserve original ${root}`);
 const {gifts:oldGifts,...oldBriber}=original.briber;
 const {gifts:currentGifts,...currentBriber}=s.briber;
 assert.deepEqual(currentBriber,oldBriber,'Same original Briber history');
 assert.equal(currentGifts.length,oldGifts.length,'No free gifts');
 for(const gift of oldGifts)if(gift.location==='GIVEN')assert.deepEqual(currentGifts.find(row=>row.id===gift.id),gift,'Original given objects stay given');
 const {life:oldLife,...oldHistory}=original.frenzyMage;
 const {life:currentLife,...currentHistory}=s.frenzyMage;
 assert.deepEqual(currentHistory,oldHistory,'Same original S3 history');
 if(s.entropyDuke.life.source){assert.deepEqual(s.entropyDuke.life.source.snapshot,oldLife);assert.deepEqual(currentLife.cases,oldLife.cases);}
 else assert.deepEqual(currentLife,oldLife);
 assert.deepEqual(s.combatHistory.slice(0,original.combatHistory.length),original.combatHistory);
 for(const [id,mastery] of Object.entries(original.progression.mastery))assert(s.progression.mastery[id]>=mastery,'Never erase legitimate old mastery');
 assert.equal(s.random.seed,old.seed);assert.equal(s.character.gender,original.character.gender);
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
 pendingIntent={type:'ENTROPY_DUKE',command:structuredClone(command)};
 const available=view().actions.find(action=>isDeepStrictEqual(action.command,command));
 assert(available,`No current public EntropyDuke control for ${JSON.stringify(command)}`);assert(available.enabled,available.reason);
 go({type:'ENTROPY_DUKE',command},key);
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
 write('natural.json',{provenance:{kind:'SAME_SEED_ORIGINAL_LIVING_PREFIX_PUBLIC_CONTINUATION',source,sourceSha256:sourceHash,newRandomChanges:false},creation:old.creation,seed:old.seed,prefixCount,prefixVerified,commands,initial,prefixFinal:original,snapshots,treatments,stage,pendingIntent,error:error?String(error):null,final:s});
 write('boundaries.index.json',boundaries);
 write('summary.json',{stage,commands:commands.length,prefixCount,status:s.status,sequence:s.progression.sequence,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,cursor:s.random.cursor,injuries:s.injuries,injuryRisk:s.injuryRisk,treatments:treatments.length,lifeCases:Object.fromEntries(Object.entries(s.entropyDuke.life.cases).map(([id,row])=>[id,{status:row.status,result:row.result,attempt:row.attempts.at(-1)??null}])),encounter:s.entropyDuke.encounter.status,bottles:s.entropyDuke.bottles.map(b=>({id:b.id,outcome:b.outcome})),boundaries:Object.keys(boundaries),snapshots});
 console.log(JSON.stringify({outputDir,stage,commands:commands.length,status:s.status,sequence:s.progression.sequence,week:s.week}));
}

// Every following step is a currently exposed player command. Finite failures,
// rejection, injury, retreat and death remain their actual outcomes in the output.
function practice(caseId){
 action({type:'OBSERVE',caseId},`${caseId}-observe-original-room`);
 ready({ap:3,health:100,mind:100,spirituality:30,pollution:0});
 eg({type:'PREPARE',caseId,method:'ABILITY'},`${caseId}-actual-preparation`);
 for(let count=0;s.entropyDuke.life.cases[caseId].status!=='EXAMINED';count++){
  assert(count<90,'Current public practice did not reach ordinary closure; retain actual blocker');
  const life=view().life;
  const next=life.actions.find(a=>a.id===life.preferredActionId);
  assert(next&&next.enabled,`No current public next action: ${life.nextStep}`);
  assert('caseId'in next.command&&next.command.caseId===caseId,'Remain on the same original case');
  const kind=next.command.type;
  eg(next.command,`${caseId}-${kind.toLowerCase()}-${count}-actual`);
 }
 action({type:'REPORT',caseId},`${caseId}-honest-report`);
}
try{
 assert.equal(old.commands.length,558);assert.equal(old.final.status,'DEAD');
 for(const intent of old.commands.slice(0,prefixCount))go(intent);
 assert.deepEqual(commands,old.commands.slice(0,prefixCount));
 assert.equal(s.status,'ACTIVE');assert.equal(s.progression.sequence,3);assert.equal(s.combat,null);
 assert.equal(s.fallenEarl.encounter.enemyStatus,'DEAD');assert.equal(s.frenzyMage.encounter.status,'AVAILABLE');assert.equal(s.week,141);assert.equal(s.health,100);assert.equal(s.injuries.filter(x=>x.severity==='HEAVY').length,2);
 original=structuredClone(s);prefixVerified=true;originals();snapshot('departure');
 // H100 still has both original untreated heavy wounds require actual care: discover the real clinic,
 // pay for that exact injury, then actually rest before any new promotion/encounter.
 ready({ap:1,cash:60});go({type:'ACTION',action:'INVESTIGATE',targetId:'CARE-ACCESS-01'},'clinic-real-discovery');clear();
 for(let n=0;s.injuries.some(i=>i.severity==='HEAVY')&&n<16;n++)ordinary(`clinic-real-rest-${n+1}`,true);
 assert.equal(s.injuries.filter(i=>i.severity==='HEAVY').length,0);assert.equal(treatments.length,1);snapshot('treated');
 ready({ap:1,cash:500,health:100,mind:100,spirituality:120,pollution:0});eg({type:'LEARN_GUIDANCE'},'guidance');
 for(const taskId of ['REVIEW_RECORDS','CHECK_LIMITS','MARK_EXIT'])action({type:'PREPARE_TASK',taskId},`preparation-${taskId}`);
 for(let number=0;s.progression.sequence===3&&number<12;number++){
  let bottle=s.entropyDuke.bottles.find(row=>row.status==='PLAYER')??s.entropyDuke.bottles.find(row=>row.status==='SUPPLIER');
  if(!bottle){
   assert(s.entropyDuke.bottles.every(row=>row.status==='CONSUMED'&&['FAILURE','GREAT_FAILURE'].includes(row.outcome)));
   action({type:'REQUEST_SUPPLY'},`request-supply-after-${number}-actual-failures`);
   ready({afterWeek:s.entropyDuke.resupply.requestedWeek});eg({type:'RECEIVE_SUPPLY'},`receive-next-week-supply-${number+1}`);
   bottle=s.entropyDuke.bottles.find(row=>row.status==='SUPPLIER');
  }
  assert(bottle);const bottleId=bottle.id;
  if(bottle.status==='SUPPLIER'){
   while(s.entropyDuke.bottles.find(row=>row.id===bottleId).labourSteps<5)action({type:'POTION_WORK',bottleId});
   ready({cash:1040});eg({type:'BUY_POTION',bottleId},`buy-${bottleId}`);
  }
  ready({ap:1,cash:140,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.frenzyMage.promotionWeek+11});
  eg({type:'PREPARE_PROMOTION'},`prepare-${bottleId}`);const priorMastery=structuredClone(s.progression.mastery);eg({type:'CONSUME',bottleId,confirmed:true},`consume-${bottleId}`);if(s.progression.sequence===2)for(const[id,value]of Object.entries(priorMastery))assert.equal(s.progression.mastery[id],value,'Promotion preserves each actual old mastery');
  if(s.progression.sequence===3)ready({health:100,mind:100,spirituality:120,pollution:0});
 }
 if(s.progression.sequence!==2)save('NATURAL_FINITE_POTION_FAILURES_ALIVE_S3');
 else{
  snapshot('promoted');for(const id of ['black-emperor.s2.action-amplification','black-emperor.s2.effect-prolongation'])assert.equal(s.progression.mastery[id],0);
  for(const caseId of ['measured-throw','withdrawn-flight','lasting-flight'])practice(caseId);
  action({type:'REFLECT'},'three-cases-reflected');assert.equal(s.progression.acting,100);snapshot('practiced');
  ready({ap:2,health:100,mind:100,spirituality:120,pollution:0});
  eg({type:'PREPARE_ENCOUNTER'},'real-combat-preparation');
  eg({type:'ENCOUNTER_TALK'},'same-darian-and-guide-ordinary-clearance');eg({type:'ENCOUNTER_FIGHT'},'independent-optional-fight');snapshot('combatStart');
  const priorInjuryIds=new Set(s.injuries.map(row=>row.id));let retreat=false;
  for(let round=0;s.combat&&round<90;round++){
   retreat ||=s.health<=40||s.injuries.some(row=>row.severity==='HEAVY'&&!priorInjuryIds.has(row.id));
   go({type:'COMBAT_ROUND',stance:retreat?'RETREAT':['DEFEND','CONTROL','ATTACK'][round%3]},`combat-round-${round+1}`);
  }
  assert.equal(s.combat,null,'Finite combat budget exhausted; preserve the actual unresolved state');
  snapshot('combatTerminal');ordinary('ordinary-life-after-actual-exit');save('NATURAL_ENTROPY_DUKE_PUBLIC_CONTINUATION');
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
