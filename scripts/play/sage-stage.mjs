import assert from 'node:assert/strict';
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
// One deterministic public continuation. Never rewrites the original fixture or tunes its random stream.
const source='tests/fixtures/prophecy-master-v01540/natural.json';
const old=Object.fromEntries(['creation','seed','commands','final'].map(k=>[k,readObjectEntry(source,k)]));
const sourceHash=fileDigest(source), commands=[], boundaries={};
mkdirSync('output/play',{recursive:true});
const outputDir=mkdtempSync('output/play/sage-01780-');
const write=(name,value)=>writeFileSync(`${outputDir}/${name}`,JSON.stringify(value),{flag:'wx'});
const roots=['pryer','combatScholar','wizard','scrollProfessor','starMystic','mystic','prophecyMaster'];
let s=createSliceRun(old.final.runId,old.creation,old.seed), beforeLast=null,lastIntent=null,pendingIntent=null,prefixVerified=false;
const initial=structuredClone(s), snapshots={};
const view=()=>projectSliceState(s).sage;
function originals(){
 for(const root of roots)assert.deepEqual(s[root],old.final[root],`Preserve original ${root}`);
 assert.equal(s.random.seed,old.seed);assert.equal(s.character.gender,old.final.character.gender);
}
function capture(key){
 if(!key||!prefixVerified||boundaries[key])return;
 const file=`boundary-${key}.json`;write(file,{beforeLast,lastIntent,final:s});boundaries[key]=file;
}
function go(intent,key=null){
 assert(commands.length<3500,'Finite strategy exhausted; preserve actual outcome');
 pendingIntent=structuredClone(intent);beforeLast=s;lastIntent=structuredClone(intent);
 s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(structuredClone(intent));pendingIntent=null;
 if(prefixVerified){originals();capture(key);appendFileSync(`${outputDir}/commands.jsonl`,JSON.stringify({step:commands.length,intent,revision:s.revision,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,sequence:s.progression.sequence,acting:s.progression.acting,cursor:s.random.cursor})+'\n');}
 if(prefixVerified&&s.status!=='ACTIVE')throw new ActualTerminalStop(`Actual ${s.status}`);
}
class ActualTerminalStop extends Error{}
const sg=(command,key)=>go({type:'SAGE',command},key);
function clear(){for(let n=0;s.activeEvent&&n<20;n++){
 const e=projectSliceState(s).activeEvent;
 const choiceId=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?(s.cash>=60?'PAY':'DECLINE'):e.id==='CARE-WORK-OFFER'?'DECLINE':null;
 assert(choiceId,`Unplanned event ${e.id}`);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
}assert.equal(s.activeEvent,null);}
function ordinary(key=null){clear();assert(!view().insideCase&&!s.combat);go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'},key);clear();}
function ready({ap=1,cash=0,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}){
 clear();for(let n=0;s.actionsRemaining<ap||s.cash<cash||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek;n++){assert(n<600,'Ordinary preparation budget exhausted');ordinary();}
}
function action(command,key=null){ready();sg(command,key);clear();}
function snapshot(name){const file=`snapshot-${name}.json`;write(file,s);snapshots[name]=file;}
function save(stage,error=null){
 assert.equal(fileDigest(source),sourceHash);
 write('natural.json',{provenance:{kind:'SAME_SEED_PUBLIC_NATURAL_PREFIX',source,sourceSha256:sourceHash,newRandomChanges:false},creation:old.creation,seed:old.seed,prefixCount:old.commands.length,prefixVerified,commands,initial,snapshots,stage,pendingIntent,error:error?String(error):null,final:s});
 write('boundaries.index.json',boundaries);
 write('summary.json',{stage,commands:commands.length,prefixCount:old.commands.length,status:s.status,sequence:s.progression.sequence,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,cursor:s.random.cursor,injuries:s.injuries,injuryRisk:s.injuryRisk,bottles:s.sage.bottles.map(b=>({id:b.id,outcome:b.outcome})),boundaries:Object.keys(boundaries),snapshots});
 console.log(JSON.stringify({outputDir,stage,commands:commands.length,status:s.status,sequence:s.progression.sequence,week:s.week}));
}
// The main strategy is below; scene actions mirror the player-visible controls.

function ritualAction(type,key){
 if(s.sage.ritual.location!=='OUTSIDE')sg({type:'RITUAL_RETREAT'});
 ready({ap:1,health:100,mind:100,spirituality:30,pollution:0,cash:120});
 if(['RITUAL_CUT_PLATE','RITUAL_CUT_INDEX','RITUAL_CONTAIN'].includes(type)&&!s.sage.ritual.seals.some(x=>x.status==='HELD'))sg({type:'RITUAL_BUY_SEALS'},'seal-resupply');
 sg({type:'RITUAL_VISIT'});sg({type},key);
 if(s.sage.ritual.location!=='OUTSIDE')sg({type:'RITUAL_RETREAT'});
 clear();
}
function practice(caseId){
 action({type:'OBSERVE',caseId},`${caseId}-observe`);
 ready({ap:3,cash:20,health:100,mind:100,spirituality:30,pollution:0});
 sg({type:'CONSENT_OWNER',caseId});sg({type:'PREPARE',caseId,method:'ABILITY'},`${caseId}-prepare`);
 const step=(type,key)=>sg({type,caseId},key),walk=to=>sg({type:'WALK',caseId,to});
 const attempt=()=>s.sage.life.cases[caseId].attempts.at(-1);
 if(caseId==='joint-verification')step('INVITE_OWNER','same-adult-actually-arrives');
 walk('A');
 if(caseId!=='onsite-sift'){
  step('INSTALL_ANCHOR');step('INFORMATION_FORM',`${caseId}-form-check`);
  if(s.sage.life.site.body==='INFORMATION'){step('TRAVERSE_CONDUIT',`${caseId}-actual-conduit`);step('REASSEMBLE',`${caseId}-same-body-reassembled`);}
  else walk('B');
 }else walk('B');
 if(caseId!=='information-route')step('SIFT_INFORMATION',`${caseId}-sift-check`);
 if(caseId!=='information-route'||!attempt().traversed){if(!attempt().read)step('READ_ARCHIVE',`${caseId}-ordinary-source-read`);step('VERIFY_INFORMATION',`${caseId}-real-information-verification`);}
 walk('A');if(attempt().anchorInstalled)step('REMOVE_ANCHOR');walk('ENTRY');
 if(caseId==='joint-verification')step('RETURN_OWNER','same-adult-ordinary-return');
 step('RETURN_ITEMS',`${caseId}-original-items-return`);step('INSPECT');step('LEAVE');
 action({type:'REPORT',caseId},`${caseId}-report`);
}
try{
 assert.equal(old.commands.length,507);
 for(const intent of old.commands)go(intent);
 assert.deepEqual(s,migrateSliceState(old.final));assert.deepEqual(commands,old.commands);prefixVerified=true;originals();snapshot('departure');
 // Existing LIGHT injuries are handled by ordinary rest; no direct healing or gratuitous clinic fee.
 ready({cash:500,health:100,mind:100,spirituality:30});sg({type:'LEARN_GUIDANCE'},'guidance');
 ritualAction('RITUAL_STUDY','actual-high-level-source-study');
 ritualAction('RITUAL_EVACUATE','same-injured-adults-evacuated');
 assert.equal(s.sage.ritual.status,'ACTIVE');assert.equal(s.sage.ritual.stoppedRecord,null);
 for(const [type,key,done] of [
  ['RITUAL_CUT_PLATE','plate-route',()=>!s.sage.ritual.routes.plate.active],
  ['RITUAL_CUT_INDEX','index-route',()=>!s.sage.ritual.routes.index.active],
  ['RITUAL_CONTAIN','core-containment',()=>!s.sage.ritual.core.active],
 ]){
  for(let n=0;!done()&&n<20;n++)ritualAction(type,`${key}-attempt-${n+1}`);
  assert(done(),'Finite actual ritual attempts exhausted; preserve this still-active disaster');
 }
 sg({type:'RITUAL_REVIEW'},'actual-disaster-stopped-and-reviewed');snapshot('ritualStopped');
 for(const taskId of ['REVIEW_DISASTER','CHECK_IDENTITY','CHECK_RETURN'])action({type:'PREPARE_TASK',taskId},`preparation-${taskId}`);
 for(let n=0;s.progression.sequence===3&&n<12;n++){
  let b=s.sage.bottles.find(x=>x.status==='PLAYER')??s.sage.bottles.find(x=>x.status==='SUPPLIER');
  if(!b){action({type:'REQUEST_SUPPLY'},'request-next-independent-supply');ready({afterWeek:s.sage.resupply.requestedWeek});sg({type:'RECEIVE_SUPPLY'},'actual-next-week-supply');b=s.sage.bottles.find(x=>x.status==='SUPPLIER');}
  assert(b);const bottleId=b.id;
  if(b.status==='SUPPLIER'){while(s.sage.bottles.find(x=>x.id===bottleId).labourSteps<5)action({type:'POTION_WORK',bottleId});ready({cash:1040});sg({type:'BUY_POTION',bottleId},`buy-${bottleId}`);}
  ready({ap:1,cash:140,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.prophecyMaster.promotionWeek+11});
  sg({type:'PREPARE_PROMOTION'},`prepare-${bottleId}`);sg({type:'CONSUME',bottleId,confirmed:true},`consume-${bottleId}`);
  if(s.progression.sequence===3)ready({health:100,mind:100,spirituality:120,pollution:0});
 }
 if(s.progression.sequence!==2){save('NATURAL_FINITE_POTION_FAILURES_ALIVE_S3');}
 else{
  snapshot('promoted');for(const id of ['hermit.s2.information-form','hermit.s2.information-sift'])assert.equal(s.progression.mastery[id],0);
  for(const id of ['information-route','onsite-sift','joint-verification'])practice(id);
  action({type:'REFLECT'},'three-cases-reflected');assert.equal(s.progression.acting,100);snapshot('practiced');
  ready({ap:2,health:100,mind:100,spirituality:120,pollution:0});sg({type:'PREPARE_ENCOUNTER'},'real-combat-preparation');
  sg({type:'ENCOUNTER_TALK'},'adult-leaves-actual-yard-entry');sg({type:'ENCOUNTER_FIGHT'},'independent-optional-fight');snapshot('combatStart');
  const oldInjuries=new Set(s.injuries.map(x=>x.id));let retreat=false;
  for(let n=0;s.combat&&n<90;n++){
   retreat ||=s.health<=40||s.injuries.some(x=>x.severity==='HEAVY'&&!oldInjuries.has(x.id));
   go({type:'COMBAT_ROUND',stance:retreat?'RETREAT':['DEFEND','CONTROL','ATTACK'][n%3]},`combat-round-${n+1}`);
  }
  assert.equal(s.combat,null,'Finite combat budget exhausted with original unresolved state');
  ordinary('ordinary-life-after-actual-exit');save('NATURAL_SAGE_PUBLIC_CONTINUATION');
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
