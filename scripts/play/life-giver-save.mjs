import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,openSync,readSync,closeSync} from 'node:fs';
import {StringDecoder} from 'node:string_decoder';
import {lifeGiverBoundaryFile} from './life-giver-boundary-files.mjs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {SqliteSliceStore} from '../../dist/persistence/slice-store.js';
import {projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const key=process.argv[2]??'boundaries',tag=process.argv[3]??'first',root='tests/fixtures/life-giver-v01680';
const names=key==='boundaries'?readEntry(`${root}/natural.json`,'boundaryManifest').map(b=>b.key):JSON.parse(readFileSync(`${root}/directed-summary.json`,'utf8')).keys;
const start=Number(process.argv[4]??0),count=Number(process.argv[5]??names.length);
assert(Number.isSafeInteger(start)&&start>=0&&Number.isSafeInteger(count)&&count>0);
const all=names.slice(start,start+count).map(name=>[name,null]);
const dir='output/qa-0168/sqlite';mkdirSync(dir,{recursive:true});const file=`${dir}/${key}-${tag}.sqlite`,checks=[];
// One bounded verification DB per fixture set. Completed input/output pairs remain in immutable fixture JSON.
// A subsequent boundary clears only this script's already-verified test rows, never any player save.
for(const [name]of all){
 const raw=readEntry(key==='boundaries'?lifeGiverBoundaryFile(root,name):`${root}/${key}.json`,name);
 const before=migrateSliceState(raw.beforeLast),after=migrateSliceState(raw.final);assertValidSliceState(before);assertValidSliceState(after);
 let init=new SqliteSliceStore(file);init.close();let db=new DatabaseSync(file);db.exec('DELETE FROM slice_receipts;DELETE FROM slice_runs;DELETE FROM slice_meta;');db.close();
 // Terminal sidecars for the same run cannot be reused for different independent directed branches.
 // Each branch retains the real runId; use a fresh uniquely named database when this pair ends in DEAD.
 const dbFile=after.status==='DEAD'?`${dir}/${key}-${name}-${tag}.sqlite`:file;
 let fail=false,app=new SqliteSliceStore(dbFile,{beforeWrite:()=>{if(fail)throw Error('simulated write failure');}});
 app.repository.transaction(()=>{app.repository.put({state:before,updatedAt:'2026-10-14T00:00:00.000Z'});app.repository.selectRun(before.runId);});
 const envelope={intentId:`lg168:${key}:${name}`,runId:before.runId,expectedRevision:before.revision,payload:raw.lastIntent};
 fail=true;const rejected=app.submitIntent(envelope);assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'SAVE_FAILED');assert.deepEqual(app.repository.get(before.runId).state,before);assert.equal(app.repository.receipt(envelope.intentId),null);app.close();
 app=new SqliteSliceStore(dbFile);assert.deepEqual(app.repository.get(before.runId).state,before);const result=app.submitIntent(envelope);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.value.state,projectSliceState(after));assert.deepEqual(app.repository.get(before.runId).state,after);app.close();
 app=new SqliteSliceStore(dbFile);assert.deepEqual(app.repository.get(before.runId).state,after);const replay=app.submitIntent(envelope);assert.equal(replay.ok,true);assert.equal(replay.value.replayed,true);assert.deepEqual(replay.value.state,result.value.state);app.close();
 const row={name,status:after.status,revision:after.revision,sha256:createHash('sha256').update(JSON.stringify(after)).digest('hex'),checks:['rollback','reopen-before','public-private-equality','reopen-after','idempotent-retry']};checks.push(row);console.log(JSON.stringify(row));global.gc?.();
}
writeFileSync(`${dir}/${key}-${tag}-summary.json`,JSON.stringify({passed:true,boundaries:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,boundaries:checks.length}));

/** Stream only one selected fixture entry under the 512MB verification cap. */
function readEntry(path, wanted) {
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
