import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {SqliteSliceStore} from '../../dist/persistence/slice-store.js';
import {projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const key=process.argv[2]??'boundaries',tag=process.argv[3]??'first',root='tests/fixtures/discerner-v01660';
const capture=JSON.parse(readFileSync(`${root}/${key}.json`,'utf8')),all=key==='directed-revival'?capture.boundaries:capture;
const dir='output/qa-0166/sqlite';mkdirSync(dir,{recursive:true});const file=`${dir}/${key}-${tag}.sqlite`,checks=[];
// One bounded verification DB per fixture set. Completed input/output pairs remain in immutable fixture JSON.
// A subsequent boundary clears only this script's already-verified test rows, never any player save.
for(const [name,raw]of Object.entries(all)){
 const before=migrateSliceState(raw.beforeLast),after=migrateSliceState(raw.final);assertValidSliceState(before);assertValidSliceState(after);
 let init=new SqliteSliceStore(file);init.close();let db=new DatabaseSync(file);db.exec('DELETE FROM slice_receipts;DELETE FROM slice_runs;DELETE FROM slice_meta;');db.close();
 // Terminal sidecars for the same run cannot be reused for different independent directed branches.
 // Each branch retains the real runId; use a fresh uniquely named database when this pair ends in DEAD.
 const dbFile=after.status==='DEAD'?`${dir}/${key}-${name}-${tag}.sqlite`:file;
 let fail=false,app=new SqliteSliceStore(dbFile,{beforeWrite:()=>{if(fail)throw Error('simulated write failure');}});
 app.repository.transaction(()=>{app.repository.put({state:before,updatedAt:'2026-10-13T20:00:00.000Z'});app.repository.selectRun(before.runId);});
 const envelope={intentId:`dcr166:${key}:${name}`,runId:before.runId,expectedRevision:before.revision,payload:raw.lastIntent};
 fail=true;const rejected=app.submitIntent(envelope);assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'SAVE_FAILED');assert.deepEqual(app.repository.get(before.runId).state,before);assert.equal(app.repository.receipt(envelope.intentId),null);app.close();
 app=new SqliteSliceStore(dbFile);assert.deepEqual(app.repository.get(before.runId).state,before);const result=app.submitIntent(envelope);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.value.state,projectSliceState(after));assert.deepEqual(app.repository.get(before.runId).state,after);app.close();
 app=new SqliteSliceStore(dbFile);assert.deepEqual(app.repository.get(before.runId).state,after);const replay=app.submitIntent(envelope);assert.equal(replay.ok,true);assert.equal(replay.value.replayed,true);assert.deepEqual(replay.value.state,result.value.state);app.close();
 const row={name,status:after.status,revision:after.revision,sha256:createHash('sha256').update(JSON.stringify(after)).digest('hex'),checks:['rollback','reopen-before','public-private-equality','reopen-after','idempotent-retry']};checks.push(row);console.log(JSON.stringify(row));
}
writeFileSync(`${dir}/${key}-${tag}-summary.json`,JSON.stringify({passed:true,boundaries:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,boundaries:checks.length}));
