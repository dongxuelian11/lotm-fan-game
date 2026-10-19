import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {SqliteSliceStore} from '../../dist/persistence/slice-store.js';
import {projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const key=process.argv[2]??'boundaries',tag=process.argv[3]??'first',root='tests/fixtures/knowledge-mentor-v01670';
const names=JSON.parse(readFileSync(`${root}/natural.json`,'utf8')).boundaryManifest.map(b=>b.key);
const all=names.map(name=>[name,null]);
const dir='output/qa-0167/sqlite';mkdirSync(dir,{recursive:true});const file=`${dir}/${key}-${tag}.sqlite`,checks=[];
// One bounded verification DB per fixture set. Completed input/output pairs remain in immutable fixture JSON.
// A subsequent boundary clears only this script's already-verified test rows, never any player save.
for(const [name]of all){
 const raw=readEntry(`${root}/${key}.json`,name);
 const before=migrateSliceState(raw.beforeLast),after=migrateSliceState(raw.final);assertValidSliceState(before);assertValidSliceState(after);
 let init=new SqliteSliceStore(file);init.close();let db=new DatabaseSync(file);db.exec('DELETE FROM slice_receipts;DELETE FROM slice_runs;DELETE FROM slice_meta;');db.close();
 // Terminal sidecars for the same run cannot be reused for different independent directed branches.
 // Each branch retains the real runId; use a fresh uniquely named database when this pair ends in DEAD.
 const dbFile=after.status==='DEAD'?`${dir}/${key}-${name}-${tag}.sqlite`:file;
 let fail=false,app=new SqliteSliceStore(dbFile,{beforeWrite:()=>{if(fail)throw Error('simulated write failure');}});
 app.repository.transaction(()=>{app.repository.put({state:before,updatedAt:'2026-10-13T20:00:00.000Z'});app.repository.selectRun(before.runId);});
 const envelope={intentId:`km167:${key}:${name}`,runId:before.runId,expectedRevision:before.revision,payload:raw.lastIntent};
 fail=true;const rejected=app.submitIntent(envelope);assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'SAVE_FAILED');assert.deepEqual(app.repository.get(before.runId).state,before);assert.equal(app.repository.receipt(envelope.intentId),null);app.close();
 app=new SqliteSliceStore(dbFile);assert.deepEqual(app.repository.get(before.runId).state,before);const result=app.submitIntent(envelope);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.value.state,projectSliceState(after));assert.deepEqual(app.repository.get(before.runId).state,after);app.close();
 app=new SqliteSliceStore(dbFile);assert.deepEqual(app.repository.get(before.runId).state,after);const replay=app.submitIntent(envelope);assert.equal(replay.ok,true);assert.equal(replay.value.replayed,true);assert.deepEqual(replay.value.state,result.value.state);app.close();
 const row={name,status:after.status,revision:after.revision,sha256:createHash('sha256').update(JSON.stringify(after)).digest('hex'),checks:['rollback','reopen-before','public-private-equality','reopen-after','idempotent-retry']};checks.push(row);console.log(JSON.stringify(row));
}
writeFileSync(`${dir}/${key}-${tag}-summary.json`,JSON.stringify({passed:true,boundaries:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,boundaries:checks.length}));

/** Read one top-level object entry without allocating every large saved-state tree. */
function readEntry(path, wanted) {
  const text = readFileSync(path, 'utf8');
  let i = 0;
  const whitespace = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  whitespace();
  if (text[i++] !== '{') throw new Error('Expected a top-level JSON object');
  while (i < text.length) {
    whitespace();
    if (text[i] === '}') break;
    if (text[i] === ',') { i++; whitespace(); }
    const keyStart = i;
    if (text[i++] !== '"') throw new Error('Expected a JSON property name');
    let escaped = false;
    while (i < text.length) {
      const c = text[i++];
      if (escaped) { escaped = false; continue; }
      if (c === '\\') escaped = true;
      else if (c === '"') break;
    }
    const key = JSON.parse(text.slice(keyStart, i));
    whitespace(); if (text[i++] !== ':') throw new Error('Expected JSON colon'); whitespace();
    const valueStart = i;
    let depth = 0, quoted = false; escaped = false;
    for (; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') quoted = false;
        continue;
      }
      if (c === '"') { quoted = true; continue; }
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') { if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0) break;
    }
    if (key === wanted) return JSON.parse(text.slice(valueStart, i));
  }
  throw new Error(`Missing JSON object entry: ${wanted}`);
}
