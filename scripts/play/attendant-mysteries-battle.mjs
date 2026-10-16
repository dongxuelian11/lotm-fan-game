import assert from 'node:assert/strict';
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
// A single optional encounter from the captured living S1 chapter endpoint.
// The full prior command prefix is retained; no seed, resource, mastery or body is edited.
const resume = process.argv[2] === '--resume';
const continueAfterExit = process.argv[2] === '--continue-after-exit';
const source = (resume || continueAfterExit ? process.argv[3] : process.argv[2]) ?? 'tests/fixtures/attendant-mysteries-v01860/natural.json';
const old = Object.fromEntries(['creation','seed','commands','final'].map(k=>[k,readObjectEntry(source,k)]));
const sourceHash=fileDigest(source), commands=[...old.commands], prefixCount=resume || continueAfterExit ? readObjectEntry(source,'prefixCount') : commands.length;
let s=old.final, beforeLast=null, lastIntent=null, pendingIntent=null;
if(resume){const before=readObjectEntry(source,'beforeLast'), intent=readObjectEntry(source,'lastIntent');assertValidSliceState(before);assert.deepEqual(intent,old.commands.at(-1));const replayed=applySliceIntent(before,intent);assert.deepEqual(replayed,s,'Validation-only repair preserves the complete original round, costs and random stream');s=replayed;beforeLast=before;lastIntent=intent;}
assertValidSliceState(s); assert.equal(s.status,'ACTIVE'); assert.equal(s.progression.sequence,1);
assert.equal(s.attendantMysteries.life.reflected,true); if(continueAfterExit){assert.equal(s.combat,null);assert(s.attendantMysteries.encounter.terminal);assert(['RESOLVED','RETREATED'].includes(s.attendantMysteries.encounter.status));}else assert.equal(s.attendantMysteries.encounter.status,resume?'FIGHTING':'AVAILABLE');
const initial=resume||continueAfterExit?readObjectEntry(source,'initial'):structuredClone(s), boundaries={};
mkdirSync('output/play',{recursive:true});const outputDir=mkdtempSync('output/play/attendant-mysteries-battle-01860-');
const write=(name,value)=>writeFileSync(`${outputDir}/${name}`,JSON.stringify(value),{flag:'wx'});
class ActualTerminal extends Error{}
function go(intent,key){
 pendingIntent=structuredClone(intent);beforeLast=s;lastIntent=structuredClone(intent);
 s=applySliceIntent(s,intent);commands.push(structuredClone(intent));
 appendFileSync(`${outputDir}/commands.jsonl`,JSON.stringify({step:commands.length,intent,revision:s.revision,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,cursor:s.random.cursor})+'\n');
 assertValidSliceState(s);pendingIntent=null;
 assert.equal(s.random.seed,old.seed); assert.equal(s.runId,initial.runId);
 assert.deepEqual(s.miracleWorker.revival,initial.miracleWorker.revival);
 assert.deepEqual(s.combatHistory.slice(0,initial.combatHistory.length),initial.combatHistory);
 if(key){const file=`boundary-${key}.json`;write(file,{beforeLast,lastIntent,final:s});boundaries[key]=file;}
 if(s.status!=='ACTIVE')throw new ActualTerminal(s.status);
}
function act(type,key){
 const a=projectSliceState(s).attendantMysteries.actions.find(a=>isDeepStrictEqual(a.command,{type}));
 assert(a&&a.enabled,`${type}: ${a?.reason}`);go({type:'ATTENDANT_MYSTERIES',command:structuredClone(a.command)},key);
}
function save(stage,error=null){
 assert.equal(fileDigest(source),sourceHash);
 write('natural-battle.json',{provenance:{kind:'ACTUAL_LIVING_S1_OPTIONAL_CONTINUATION',sourceSha256:sourceHash,sourcePrefixCount:prefixCount},creation:old.creation,seed:old.seed,prefixCount,commands,initial,beforeLast,lastIntent,pendingIntent,stage,error:error?String(error):null,final:s});
 write('boundaries.index.json',boundaries);
 const summary={stage,commands:commands.length,prefixCount,revision:s.revision,week:s.week,date:s.date,status:s.status,sequence:s.progression.sequence,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,cursor:s.random.cursor,injuries:s.injuries,injuryRisk:s.injuryRisk,encounter:s.attendantMysteries.encounter.terminal,rounds:s.combatHistory.slice(initial.combatHistory.length),boundaries:Object.keys(boundaries)};
 write('summary.json',summary);console.log(JSON.stringify({outputDir,...summary,rounds:summary.rounds.length}));
}
try{
 if(resume){const ordinal=s.lastCombatRound.round===1?'first':'second';const key=`same-${ordinal}-round-revalidated`;write(`boundary-${key}.json`,{beforeLast,lastIntent,final:s});boundaries[key]=`boundary-${key}.json`;}
 else if(!continueAfterExit){
 // Published preparation policy: finish actual work, pay the next week, rest once.
 for(let n=0;s.actionsRemaining>0;n++){assert(n<8);act('RECEPTION_WORK',`actual-work-${n+1}`);}
 act('RECEPTION_NEXT_WEEK','actual-next-week');act('RECEPTION_REST','actual-rest-before-fight');
 act('PREPARE_ENCOUNTER','paid-original-remnant');act('ENCOUNTER_TALK','ordinary-walk-to-empty-clearing');act('ENCOUNTER_FIGHT','independent-optional-fight');
 }
 const prior=new Set(s.injuries.map(i=>i.id));let retreat=false;
 for(let round=(s.combat?.round??1)-1;s.combat&&round<90;round++){
  retreat ||= s.health<=40||s.injuries.some(i=>i.severity==='HEAVY'&&!prior.has(i.id));
  go({type:'COMBAT_ROUND',stance:retreat?'RETREAT':['DEFEND','CONTROL','ATTACK'][round%3]},`actual-round-${round+1}`);
 }
 assert.equal(s.combat,null,'Finite combat limit reached');
 if(s.actionsRemaining===0)act('RECEPTION_NEXT_WEEK','actual-seven-days-after-real-exit');
 act('RECEPTION_WORK','ordinary-work-after-real-exit');save('NATURAL_OPTIONAL_ENCOUNTER_COMPLETED');
}catch(e){if(e instanceof ActualTerminal)save('NATURAL_ACTUAL_TERMINAL',e);else{save('ACTUAL_BLOCKER',e);throw e;}}

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
