import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

/** NEW216 rebuilt evidence only: the exact restored194 living853 is retained, not replayed.
 * Import and --preflight-only do not import game/dist modules, open SQLite or write.
 * Run --help for the pinned input/output contract. No seed/draw/source override.
 * Specialized from verify-tyrant-real-saves.mjs; no product/runtime changes.
 */
import * as producer from './sun-stage.mjs';
const SELF = fileURLToPath(import.meta.url);
export const FORMAT = 'NEW216_SUN_SELECTED_REAL_SQLITE_AUDIT_V1';
export const INPUT_FORMAT = 'NEW216_SUN_CAPTURE_FILES_V1';
const PRODUCER = 'scripts/play/sun-stage.mjs';
export const OUTPUT = 'output/rebuild-0216/sqlite-natural-v1';
export const SOURCE = producer.SOURCE, SOURCE_SHA256 = producer.SOURCE_SHA256;
export const SOURCE_STATE_SHA256 = producer.SOURCE_STATE_SHA256, PREFIX_SHA256 = producer.PREFIX_SHA256;
export const PREFIX = producer.PREFIX_COUNT, BOUNDARY_LIMIT = producer.POLICY.selectedBoundaryLimit;
const INPUTS = producer.INPUTS, POLICY = producer.POLICY;
const INITIAL_TIME = '2026-10-18T00:00:00.000Z', COMMIT_TIME = '2026-10-18T00:00:01.000Z';
export const CHECKS = ['strict-before-save', 'read-only-bootstrap-no-write-hook', 'beforeWrite-rollback', 'COMMIT-rollback',
  'private-head-rng-receipts-selection-timestamps-backups-unchanged', 'rollback-reopen', 'exact-same-intent-retry',
  'exact-private-rng-chapter-and-global-public', 'commit-reopen-load', 'duplicate-idempotent', 'actual-death-seal-if-present', 'final-reopen'];
const { assertGlobalPublic, assertPublicOnly, capturePublic, selectionOutcome } = producer;
export { assertGlobalPublic, assertPublicOnly, capturePublic, selectionOutcome };
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const whole = value => Number.isSafeInteger(value) && value >= 0;
const sha = value => createHash('sha256').update(value).digest('hex');
const compactHash = value => sha(JSON.stringify(value));
export const stable = producer.stable, stateHash = producer.stateHash;
const json = path => JSON.parse(readFileSync(path, 'utf8'));
function keys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), label);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
}
function regular(path) {
  assert.equal(realpathSync(path), path, `No symlink input or output: ${path}`);
  assert(lstatSync(path).isFile(), `Expected regular file: ${path}`); return path;
}
function directory(path) {
  const result = resolve(path); assert.equal(realpathSync(result), result, 'No directory symlinks');
  assert(lstatSync(result).isDirectory()); return result;
}
function contains(root, path) { const r = relative(root, path); return r === '' || r !== '..' && !r.startsWith(`..${sep}`) && !r.startsWith(sep); }
export function safeRelativeFile(file) {
  assert(typeof file === 'string' && file.length > 0 && !file.includes('\\') && !file.includes('\0'));
  assert(!file.startsWith('/') && !/^[A-Za-z]:/.test(file));
  assert(file.split('/').every(part => part && part !== '.' && part !== '..'), 'Only normalized relative file paths'); return file;
}
export function fileEvidence(path) {
  regular(path); const before = lstatSync(path, { bigint: true }), fd = openSync(path, 'r'), h = createHash('sha256'), buffer = Buffer.allocUnsafe(65536); let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; h.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  const after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(after[key], before[key], 'Input changed while hashing');
  assert.equal(BigInt(bytes), after.size); return { bytes, sha256: h.digest('hex') };
}
/** A terminal derived summary is the first gate; never touch a live checkpoint. */
export function assertCaptureReady(root) {
  root = directory(root);
  const summary = readCapture(regular(join(root, 'summary.json')));
  assert(['NATURAL_ACTUAL_TERMINAL','NATURAL_FINITE_SUN_REPORTED'].includes(summary.stage),
    'Only a quiescent terminal Sun capture is eligible; leave active, paused and diagnostic captures alone');
  assert.equal(summary.paused, false); assert.equal(summary.diagnostic, false);
  for (const name of readdirSync(root)) assert(!name.endsWith('.next') && !name.endsWith('.incomplete') && name !== 'PAUSE',
    `Unfinished capture artifact retained: ${name}`);
  return summary;
}
export function inspectCaptureInputs(root) {
  root = directory(root); assertCaptureReady(root); const files = [];
  const walk = name => {
    const path = join(root, name), stat = lstatSync(path); assert(!stat.isSymbolicLink(), 'No capture symlinks');
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(name ? `${name}/${child}` : child);
    else { assert(stat.isFile(), 'Only regular capture files'); files.push({ file: safeRelativeFile(name), ...captureFileEvidence(path) }); }
  };
  walk(''); return { format: INPUT_FORMAT, files: files.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0) };
}
export function assertInputManifest(actual, expected) {
  for (const manifest of [actual, expected]) {
    keys(manifest, ['format', 'files'], 'Exact capture manifest'); assert.equal(manifest.format, INPUT_FORMAT);
    assert(Array.isArray(manifest.files) && manifest.files.length > 0, 'Empty capture is not evidence'); const names = [];
    for (const row of manifest.files) {
      const compressed = typeof row.file === 'string' && row.file.endsWith('.gz');
      keys(row, compressed ? ['file','bytes','sha256','originalBytes','originalSha256'] : ['file','bytes','sha256'], 'Capture file evidence'); names.push(safeRelativeFile(row.file));
      assert(whole(row.bytes) && digest(row.sha256));
      if (compressed) assert(whole(row.originalBytes) && digest(row.originalSha256));
    }
    assert.equal(new Set(names).size, names.length, 'Duplicate capture filename'); assert.deepEqual(names, [...names].sort());
  }
  assert.deepEqual(actual, expected, 'Exact complete capture file/hash set changed');
}
export function assertFreeze(captured, current) {
  for (const freeze of [captured, current]) {
    keys(freeze, ['sha256', 'nodeVersion', 'files'], 'Exact frozen runtime'); assert(digest(freeze.sha256)); assert(/^v\d+\.\d+\.\d+$/.test(freeze.nodeVersion));
    assert(Array.isArray(freeze.files) && freeze.files.length > 0); const names = new Set();
    for (const row of freeze.files) {
      keys(row, ['file', 'bytes', 'sha256'], 'Frozen file');
      if (row.file !== '$natural-producer') safeRelativeFile(row.file);
      assert(!names.has(row.file), 'Duplicate frozen file'); names.add(row.file); assert(whole(row.bytes) && digest(row.sha256));
    }
    assert.equal(compactHash(freeze.files), freeze.sha256);
  }
  assert.deepEqual(current, captured, 'Source, compiled runtime, producer and dependencies must match exactly');
}
export function assertResumeManifest(saved, current) { assert.deepEqual(saved, current, 'Resume requires the exact capture, selection, source, runtime and verifier'); }
/** Gzip is a transport only. Both stored bytes and every decoded byte are bound. */
export function readCaptureBytes(path) {
  const fingerprint = fileEvidence(path), bytes = readFileSync(path), compressed = path.endsWith('.gz');
  assert.equal(bytes.length, fingerprint.bytes); assert.equal(sha(bytes), fingerprint.sha256);
  const magic = bytes[0] === 0x1f && bytes[1] === 0x8b;
  assert.equal(magic, compressed, 'Capture encoding must match its explicit .gz filename');
  const decoded = compressed ? gunzipSync(bytes) : bytes;
  assert.deepEqual(fileEvidence(path), fingerprint, 'Capture changed while decoding');
  return decoded;
}
export const readCapture = path => JSON.parse(readCaptureBytes(path).toString('utf8'));
export function captureFileEvidence(path) {
  const evidence = fileEvidence(path);
  if (!path.endsWith('.gz')) return evidence;
  const decoded = readCaptureBytes(path);
  assert.deepEqual(fileEvidence(path), evidence, 'Compressed input changed during inspection');
  return { ...evidence, originalBytes: decoded.length, originalSha256: sha(decoded) };
}
export function assertSelectionOutcome(value) {
  keys(value, ['status','sequence','promoted','guidance'], 'Exact public selection outcome');
  assert(['ACTIVE','DEAD','SLICE_COMPLETE','REVIVAL_PENDING'].includes(value.status));
  assert([0,1].includes(value.sequence));
  for (const key of ['promoted','guidance']) assert.equal(typeof value[key], 'boolean');
}
/** Independent copy of the frozen Sun producer taxonomy; never invent a case. */
export function boundaryKind(intent, outcome) {
  assertSelectionOutcome(outcome); assert.equal(intent.type, 'SUN');
  const c = intent.command; let key = null;
  if (['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','STABILIZE_PROMOTION','START_EPILOGUE','RETURN_ON_FOOT'].includes(c.type)) key = `sun-${c.type.toLowerCase()}`;
  if (c.type === 'SERVICE') key = `service-${c.command.serviceId}-${c.command.type.toLowerCase()}`;
  if (c.type === 'MATERIAL') key = `material-${c.command.type.toLowerCase()}-${c.command.bottleId ?? c.command.step ?? c.command.batchId ?? c.command.compoundId ?? 'unique'}`;
  if (c.type === 'CONSUME') key = outcome.status !== 'ACTIVE' ? 'sun-actual-terminal-dose' : outcome.promoted ? 'sun-actual-promotion' : `sun-failed-dose-${c.compoundId}`;
  if (c.type === 'EPILOGUE') key = `epilogue-${c.command.type.toLowerCase()}`;
  if (outcome.status !== 'ACTIVE') key = 'sun-actual-terminal';
  return key;
}
export function selectBoundaries(index, readBoundary) {
  assert(Array.isArray(index) && index.length > 0 && index.length <= BOUNDARY_LIMIT, 'One to64 actual selected transitions');
  const selected = [], filenames = new Set(), kinds = new Set(), commands = new Set(); let prior = PREFIX;
  for (const item of index) {
    keys(item, ['file', 'kind', 'commandCount', 'bytes', 'sha256'], 'Captured boundary index'); safeRelativeFile(item.file);
    assert(typeof item.kind === 'string' && /^[A-Za-z0-9_-]+$/.test(item.kind), 'Named actual semantic boundary');
    assert(!filenames.has(item.file) && !kinds.has(item.kind) && !commands.has(item.commandCount), 'Selected filenames, kinds and command counts must be unique');
    assert(whole(item.commandCount) && item.commandCount > prior && whole(item.bytes) && digest(item.sha256));
    assert.equal(item.file, `action-${item.commandCount}.json.gz`, 'Exact producer full-action gzip filename');
    filenames.add(item.file); kinds.add(item.kind); commands.add(item.commandCount); prior = item.commandCount;
    const boundary = readBoundary(item);
    assertActionCaptureShape(boundary);
    assert.equal(boundary.commandCount, item.commandCount);
    selected.push({ commandCount: item.commandCount, kinds: [item.kind], files: [item.file], boundarySha256: stateHash(boundary) });
  }
  return selected;
}
export function assertBoundarySelection(rows, selected) {
  assert(Array.isArray(rows) && rows.length > 0); const expected = [], seen = new Set();
  for (const [i, row] of rows.entries()) {
    assert.equal(row.commandCount, PREFIX + i + 1, 'Complete continuous command ledger');
    const kind = boundaryKind(row.intent, row.selectionOutcome);
    if (kind && !seen.has(kind) && expected.length < BOUNDARY_LIMIT) {
      seen.add(kind); expected.push({ commandCount: row.commandCount, kinds: [kind] });
    }
  }
  assert.deepEqual(selected.map(({ commandCount, kinds }) => ({ commandCount, kinds })), expected,
    'Exactly the first actual instance of each selected kind, in ledger order, bounded at64');
}
export function assertActionCaptureShape(content) {
  keys(content, ['commandCount','beforeLast','lastIntent','final','randomBefore','randomAfter','publicBefore','public',
    'globalPublicBefore','globalPublic','policyBefore','policyAfter','audit'], 'Exact full actual action capture');
}
export const actualReceipts = producer.actualReceipts;
export function assertActionCapture(content, row) {
  assertActionCaptureShape(content); producer.verifyActionCapture(content, row); assertSelectionOutcome(row.selectionOutcome);
  assert.equal(content.beforeLast.status, 'ACTIVE'); assert.equal(content.beforeLast.revision, row.commandCount);
  assert.equal(content.final.revision, row.commandCount + 1); assert.equal(content.final.week, row.week);
  assert.equal(content.final.status, row.selectionOutcome.status);
  assert.deepEqual(row.receipts, actualReceipts(content.final, content.beforeLast), 'Exact actual Sun receipts');
  const latest = content.final.sun.journal.at(-1);
  if (latest?.revision === content.final.revision) assert.deepEqual(latest.command, row.intent.command);
  for (const [state, projection] of [[content.beforeLast,content.globalPublicBefore],[content.final,content.globalPublic]]) {
    assert.equal(state.schemaVersion,213); assert.equal(state.contentVersion,'sun-v213');
    for (const key of ['runId','revision','status','week']) assert.equal(projection[key],state[key]);
  }
}
export function assertCaptureStatus(capture, cp, summary) {
  const paused = capture.stage === 'MANUAL_PAUSE', diagnostic = capture.stage.startsWith('PUBLIC_');
  assert(['MANUAL_PAUSE','PUBLIC_ACTION_BLOCKED','PUBLIC_NO_PROGRESS_DIAGNOSTIC',
    'NATURAL_ACTUAL_TERMINAL','NATURAL_FINITE_SUN_REPORTED'].includes(capture.stage));
  assert.equal(summary.paused,paused); assert.equal(summary.diagnostic,diagnostic);
  assert.deepEqual(cp.terminal, paused || diagnostic ? null : {stage:capture.stage,reason:capture.reason});
  if (capture.stage === 'NATURAL_ACTUAL_TERMINAL') {
    assert(['DEAD','SLICE_COMPLETE','REVIVAL_PENDING'].includes(cp.state.status));
    assert.equal(capture.reason,`Actual runtime status ${cp.state.status}`);
  } else assert.equal(cp.state.status,'ACTIVE');
  if (capture.stage === 'NATURAL_FINITE_SUN_REPORTED') assert.equal(cp.policy.reported,true);
}
export function assertCaptureComplete(capture, cp) {
  assert(['NATURAL_ACTUAL_TERMINAL','NATURAL_FINITE_SUN_REPORTED'].includes(capture.stage),
    'A complete terminal capture is required even for preflight; never inspect an active or paused capture');
  assert.deepEqual(cp.terminal,{stage:capture.stage,reason:capture.reason}); assert.equal(cp.pending,null);
  assertCaptureStatus(capture,cp,{paused:false,diagnostic:false});
}
export function inspectCapture(root, repo, freeze) {
  assertCaptureReady(root);
  const retained = ['archived-original194-natural.json.gz'];
  const old = producer.readSource(repo), { source, commands: prefix, inputFreeze } = old;
  for (const [i,pin] of INPUTS.entries()) {
    assert.deepEqual(fileEvidence(join(repo,pin.file)),{bytes:old.buffers[i].length,sha256:pin.sha256});
    assert(readCaptureBytes(join(root,retained[i])).equals(old.buffers[i]), 'Complete original194 source files stay byte-exact');
  }
  assert.deepEqual(readCapture(join(root,'input-freeze.json')),inputFreeze);
  const migration = readCapture(join(root,'migration-initial.json.gz'));
  keys(migration,['originalStateSha256','migratedStateSha256','publicSha256','globalPublicSha256','final','random','public','globalPublic'],'Exact captured migration');
  assert.equal(migration.originalStateSha256,SOURCE_STATE_SHA256); assert.equal(migration.migratedStateSha256,stateHash(migration.final));
  assert.equal(migration.final.schemaVersion,213); assert.equal(migration.final.contentVersion,'sun-v213');
  for (const [key,value] of Object.entries(source)) if (!['schemaVersion','contentVersion'].includes(key)) assert.deepEqual(migration.final[key],value,`Historical migration preserves ${key}`);
  assert.deepEqual(migration.random,source.random); assert.deepEqual(migration.final.random,migration.random);
  assert.equal(migration.publicSha256,stateHash(migration.public)); assert.equal(migration.globalPublicSha256,stateHash(migration.globalPublic));
  assertPublicOnly(migration.public); assertGlobalPublic(migration.globalPublic,migration.final); assert.deepEqual(capturePublic(migration.globalPublic),migration.public);
  const wrapped = readCapture(join(root,'checkpoint.json.gz')), cp = wrapped.payload;
  keys(wrapped,['sha256','payload'],'Durable checkpoint'); assert.equal(wrapped.sha256,stateHash(cp));
  keys(cp,['format','source','sourceSha256','prefixSha256','inputFreezeSha256','runtimeFreezeSha256','policyDefinition','policy','migration','createdAt','commandCount',
    'commands','rows','boundaries','state','initialStateSha256','finalStateSha256','initialPublicSha256','publicStateSha256','initialGlobalPublicSha256','globalPublicStateSha256','initialRandomSha256',
    'pending','terminal','predecessorSha256','prefixHashEncoding','stateHashEncoding'],'Exact producer checkpoint');
  producer.verifyCheckpoint(cp,freeze,migration.migratedStateSha256,inputFreeze);
  assert.equal(cp.initialPublicSha256,migration.publicSha256); assert.equal(cp.initialGlobalPublicSha256,migration.globalPublicSha256);
  assert.equal(cp.initialRandomSha256,stateHash(source.random)); assert.equal(cp.pending,null,'A pending action is not completed evidence');
  assert(typeof cp.createdAt==='string' && Number.isFinite(Date.parse(cp.createdAt))); assert(digest(cp.predecessorSha256));
  assert(cp.rows.length>0); assert.equal(cp.state.schemaVersion,213); assert.equal(cp.state.contentVersion,'sun-v213');
  const capture = readCapture(join(root,'natural.json.gz')), summary = readCapture(join(root,'summary.json'));
  keys(capture,['provenance','creation','seed','prefixCount','commands','policy','stage','reason','pendingIntent','boundaries','final'],'Exact natural capture');
  assert(typeof capture.reason==='string'); assert.equal(capture.prefixCount,PREFIX); assert.deepEqual(capture.final,cp.state);
  assert.deepEqual(capture.policy,POLICY); assert.deepEqual(capture.commands,[...prefix,...cp.commands]);
  assert.deepEqual(capture.creation,old.creation); assert.equal(capture.seed,old.seed); assert.equal(capture.pendingIntent,null); assert.deepEqual(capture.boundaries,cp.boundaries);
  assert.deepEqual(capture.provenance,{kind:'NEW216_FROM_RESTORED194_LIVING853_PUBLIC_SUN_CONTINUATION',
    format:'NEW216_REBUILD_PROVENANCE_V1',newNatural216:true,rebuiltFromRestoredVolume194:true,
    source:SOURCE,sourceSha256:SOURCE_SHA256,sourceRoot:'final',originalStateSha256:SOURCE_STATE_SHA256,originalEvidence:retained,
    prefixCommandsSha256:PREFIX_SHA256,prefixCommandsHashEncoding:producer.PREFIX_HASH_ENCODING,stateHashEncoding:producer.STATE_HASH_ENCODING,inputFreezeSha256:inputFreeze.sha256,runtimeFreezeSha256:freeze.sha256,
    historicalPrefixReplayedByThisProducer:false,originalPrefixRetainedExactly:true,completeOriginalSourceRetainedExactly:true,alternateSourceUsed:false,
    privateAudit:true,seedChanged:false,randomOverridden:false,futureDrawInspected:false,selectedFromEnabledPublicActionsOnly:true,
    everyActionEvidence:'FULL_PRIVATE_RNG_CHAPTER_PUBLIC_AND_GLOBAL_PUBLIC_BEFORE_AND_AFTER_GZIP',
    selectedSQLiteBoundaries:'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER',globalPublicScope:'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH',projectionScope:'POSITIVE_SUN_AND_ORDINARY_PUBLIC_DASHBOARD'});
  assert.deepEqual(summary,{stage:capture.stage,reason:capture.reason,commands:cp.commandCount,originalCommands:PREFIX,
    newCommands:cp.commands.length,rebuild:'NEW216',newNatural216:true,controlledStop:capture.stage==='MANUAL_PAUSE',week:cp.policy.week,
    paused:capture.stage==='MANUAL_PAUSE',diagnostic:capture.stage.startsWith('PUBLIC_'),strictFinalValidation:true,
    sqliteReopenValidation:'NOT_RUN_BY_PRODUCER',checkpoint:'checkpoint.json.gz',public:summary.public});
  assert.equal(stateHash(summary.public),cp.publicStateSha256); assertPublicOnly(summary.public); assertCaptureStatus(capture,cp,summary);
  assert.equal(readCaptureBytes(join(root,'commands.ndjson.gz')).toString('utf8'),cp.rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
  assert.deepEqual(readCapture(join(root,'boundaries.index.json')),cp.boundaries);
  const producerFile = freeze.files.find(row=>row.file==='$natural-producer'); assert(producerFile);
  assert.deepEqual(fileEvidence(join(root,'producer.mjs')),{bytes:producerFile.bytes,sha256:producerFile.sha256});
  assert.deepEqual(cp.rows.at(-1).selectionOutcome,selectionOutcome(summary.public));
  for (const [i,row] of cp.rows.entries()) {
    keys(row,['commandCount','intent','commandSha256','reason','publicLabel','publicCost','startedAt','elapsedMilliseconds','revision','week',
      'beforeStateSha256','afterStateSha256','publicBeforeSha256','publicAfterSha256','globalPublicBeforeSha256','globalPublicAfterSha256',
      'selectionOutcome','randomBefore','randomAfter','randomBeforeSha256','randomAfterSha256','policyBeforeSha256','policyAfterSha256','receipts','capture'],'Exact completed action ledger');
    assert(whole(row.week) && whole(row.elapsedMilliseconds));
    assert(typeof row.startedAt==='string' && Number.isFinite(Date.parse(row.startedAt)));
    for (const key of ['reason','publicLabel','publicCost']) assert.equal(typeof row[key],'string');
    if (i<cp.rows.length-1) assert.equal(row.selectionOutcome.status,'ACTIVE','No action follows an actual terminal');
    const path = join(root,safeRelativeFile(row.capture.file));
    assert.deepEqual(fileEvidence(path),{bytes:row.capture.bytes,sha256:row.capture.sha256});
    const action = readCapture(path); assertActionCapture(action,row);
    producer.checkOriginals(action.final,source,action.beforeLast);
    if (i===0) assert.deepEqual(action.beforeLast,migration.final);
    if (i===cp.rows.length-1) assert.deepEqual(action.final,cp.state);
  }
  const selected = selectBoundaries(cp.boundaries,item=>{
    const row = cp.rows[item.commandCount-PREFIX-1]; assert(row);
    assert.deepEqual({file:item.file,bytes:item.bytes,sha256:item.sha256},row.capture);
    return readCapture(join(root,item.file));
  });
  assertBoundarySelection(cp.rows,selected); assert.equal(selected[0].commandCount,PREFIX+1);
  if (cp.state.status === 'DEAD') assert(selected.some(row=>row.commandCount===cp.commandCount),
    'Actual death must be a producer-selected SQLite boundary; never silently claim its seal when the64-case cap omitted it');
  assert.deepEqual(cp.commands[0],{type:'SUN',command:{type:'LEARN_GUIDANCE'}});
  const expected = new Set(['runtime-freeze.json','input-freeze.json','producer.mjs',...retained,'migration-initial.json.gz',
    'checkpoint.json.gz','commands.ndjson.gz','boundaries.index.json','natural.json.gz','summary.json','error.json',
    ...cp.rows.map(row=>row.capture.file)]);
  for (const file of readdirSync(root)) {
    assert(expected.has(file),`Unknown or unfinished capture artifact retained: ${file}`);
    regular(join(root,file));
  }
  return {cp,source,inputFreeze,initial:migration.final,capture,selected};
}
function sync(path) { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } }
function atomic(path, value) {
  writeFileSync(`${path}.next`, JSON.stringify(value), { flag: 'wx' }); sync(`${path}.next`); renameSync(`${path}.next`, path); sync(dirname(path));
}
export function assertOutputPath(output, forbidden) {
  const target = resolve(output);
  for (const path of forbidden.map(resolvePath => resolve(resolvePath))) assert(!contains(path, target) && !contains(target, path), 'Output overlaps immutable input');
  let existing = target; while (!existsSync(existing)) { const parent = dirname(existing); assert.notEqual(existing, parent); existing = parent; }
  directory(existing); return target;
}
export function claimAuditLock(out, manifestSha256, approvedPid) {
  const path = join(out, 'audit.lock.json'), owner = { format: FORMAT, manifestSha256, pid: process.pid };
  if (existsSync(path)) {
    const prior = json(regular(path)); keys(prior, ['format', 'manifestSha256', 'pid'], 'Audit lock');
    assert.equal(prior.format, FORMAT); assert.equal(prior.manifestSha256, manifestSha256);
    assert(whole(prior.pid) && prior.pid > 0); assert.equal(prior.pid, approvedPid, 'Stale lock removal requires --remove-stale-lock-pid EXACT_PID');
    let dead = false; try { process.kill(prior.pid, 0); } catch (error) { if (error.code === 'ESRCH') dead = true; else throw error; }
    assert(dead, 'Never take over a live or uncertain PID'); rmSync(path);
  } else assert.equal(approvedPid, undefined, 'Approved stale lock does not exist');
  writeFileSync(path, JSON.stringify(owner), { flag: 'wx' }); sync(path); sync(out);
  return () => { assert.deepEqual(json(regular(path)), owner); rmSync(path); sync(out); };
}
function databaseRows(DatabaseSync, path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const result = {};
    for (const [key, sql] of Object.entries({ runs: 'SELECT id,current_json,backup_json,terminal,updated_at FROM slice_runs ORDER BY id',
      receipts: 'SELECT id,fingerprint,receipt_json FROM slice_receipts ORDER BY id', meta: 'SELECT key,value FROM slice_meta ORDER BY key' })) {
      const rows = db.prepare(sql).all(); result[key] = { count: rows.length, sha256: compactHash(rows) };
    }
    assert.equal(Object.values(db.prepare('PRAGMA quick_check').get())[0], 'ok'); return result;
  } finally { db.close(); }
}
function databaseFiles(work) {
  const result = {};
  for (const file of readdirSync(directory(work)).sort()) {
    assert(['phase.json', 'phase.json.next', 'archive.json', 'archive.json.next', 'case.sqlite', 'case.sqlite.bak', 'case.sqlite.sealed',
      'case.sqlite.gz', 'case.sqlite.bak.gz', 'case.sqlite.sealed.gz', 'case.sqlite-journal', 'case.sqlite.bak.tmp', 'case.sqlite.sealed.tmp', 'case.sqlite.sealed.rollback.tmp'].includes(file), `Unknown case artifact retained: ${file}`);
    regular(join(work, file)); if (file.startsWith('case.sqlite') && !file.endsWith('.gz')) result[file] = fileEvidence(join(work, file));
  }
  return result;
}
export function archiveCompletedCase(work, result, completedIndexPath) {
  // The fsynced completed index, VERIFIED phase and exact generated paths are
  // prerequisites. This function cannot discard an unfinished transaction DB.
  work = directory(work); completedIndexPath = regular(resolve(completedIndexPath));
  assert(!existsSync(join(work,'phase.json.next')), 'Unresolved phase successor retained before archive');
  const index = json(completedIndexPath), phase = json(regular(join(work, 'phase.json')));
  assert(whole(result.commandCount) && result.commandCount > PREFIX, 'Only actual completed Sun transition results');
  assert(Array.isArray(index.results));
  const matches = index.results.filter(row => row.commandCount === result.commandCount);
  assert.equal(matches.length,1,'Exactly one durably indexed transition; duplicate results never authorize raw deletion');
  const saved = matches[0];
  assert.deepEqual(saved, result, 'Only a durable completed-index result authorizes lossless archival');
  assert.equal(work, join(dirname(completedIndexPath), `case-${result.commandCount}`));
  assert.equal(phase.phase, 'VERIFIED', 'Incomplete case stays raw'); assert.equal(phase.input.manifestSha256, index.manifestSha256);
  const present = databaseFiles(work), expected = result.databaseFiles, names = Object.keys(expected).sort();
  assert(names.includes('case.sqlite') && names.includes('case.sqlite.bak'));
  assert(names.every(name => ['case.sqlite', 'case.sqlite.bak', 'case.sqlite.sealed'].includes(name)), 'No unfinished sidecar may be archived');
  for (const name of Object.keys(present)) assert(Object.hasOwn(expected, name), 'Unindexed raw evidence retained');
  for (const name of readdirSync(work).filter(file => file.endsWith('.gz'))) assert(Object.hasOwn(expected, name.slice(0, -3)), 'Unindexed compressed evidence retained');
  const archivePath = join(work, 'archive.json'), recorded = existsSync(archivePath) ? json(regular(archivePath)) : null;
  const archive = { format: 'NEW216_SUN_COMPLETED_SQLITE_GZIP_V1', manifestSha256: index.manifestSha256, files: {} };
  for (const name of names) {
    const rawPath = join(work, name), gzipPath = `${rawPath}.gz`, hasRaw = existsSync(rawPath);
    let raw;
    if (hasRaw) { assert.deepEqual(fileEvidence(rawPath), expected[name]); raw = readFileSync(rawPath); }
    else assert(recorded, 'Missing raw bytes require the already-durable archive manifest');
    if (!existsSync(gzipPath)) {
      assert(raw, 'Missing both original and compressed evidence');
      writeFileSync(gzipPath, gzipSync(raw, { level: 9 }), { flag: 'wx' }); sync(gzipPath); sync(work);
    }
    const compressed = fileEvidence(gzipPath);
    assert.deepEqual(verifyPackedDatabase(raw ?? null,readFileSync(gzipPath),expected[name]),compressed);
    assert.deepEqual(fileEvidence(gzipPath), compressed, 'Compressed archive changed during verification');
    archive.files[name] = { original: expected[name], gzip: { file: `${name}.gz`, ...compressed } };
  }
  if (recorded) assert.deepEqual(recorded, archive, 'Compressed evidence or original fingerprint changed');
  if (result.databaseArchives) assert.deepEqual(result.databaseArchives, archive);
  if (existsSync(`${archivePath}.next`)) {
    assert.deepEqual(json(regular(`${archivePath}.next`)), archive, 'Unknown interrupted archive manifest retained');
    renameSync(`${archivePath}.next`, archivePath); sync(work);
  } else if (!recorded) atomic(archivePath, archive);
  // No deletion precedes durable index + archive and complete round-trip checks.
  for (const name of names) if (existsSync(join(work, name))) {
    assert.deepEqual(fileEvidence(join(work, `${name}.gz`)),
      { bytes: archive.files[name].gzip.bytes, sha256: archive.files[name].gzip.sha256 }, 'Verified gzip changed before raw retirement');
    assert.deepEqual(fileEvidence(join(work, name)), expected[name]); rmSync(join(work, name));
  }
  sync(work); return archive;
}
/** A recovered durable COMMIT must never be sent as a fresh transaction again. */
export function shouldSubmitCommit(phase, saved, envelope, receipt) {
  assert(['COMMIT_ROLLBACK_VERIFIED','COMMITTED','VERIFIED'].includes(phase));
  if (saved === null) {
    assert.equal(phase,'COMMIT_ROLLBACK_VERIFIED','A committed phase must have its exact durable receipt'); return true;
  }
  assert.deepEqual(saved,{fingerprint:stable(envelope),receipt},'Reconcile the exact committed envelope and receipt before any resubmission');
  return false;
}
/** Lossless transport proof, independent of SQLite and application runtime. */
export function verifyPackedDatabase(original, packed, expected) {
  keys(expected,['bytes','sha256'],'Exact original database fingerprint'); assert(whole(expected.bytes) && digest(expected.sha256));
  assert(Buffer.isBuffer(packed)); const restored = gunzipSync(packed);
  assert.deepEqual({bytes:restored.length,sha256:sha(restored)},expected,'Every decompressed original byte must match');
  if (original !== null) { assert(Buffer.isBuffer(original)); assert(restored.equals(original),'Full gunzip round-trip must be byte-identical'); }
  return {bytes:packed.length,sha256:sha(packed)};
}
/** Actual terminal transitions seal only DEAD and reject any continuation. */
export function assertDeathSeal(state, projection, sealedRunIds, blocked) {
  assert.equal(state.status,'DEAD'); assert.equal(projection.canAct,false);
  assert.deepEqual(sealedRunIds,[state.runId]); assert.equal(blocked.ok,false);
  assert.equal(blocked.error.code,'ARCHIVED');
}
function equalState(actual, expected) { assert.equal(stateHash(actual), stateHash(expected), 'Exact complete private state'); }
function checkSqlite(runtime, DatabaseSync, work, manifestSha256, transition, boundary) {
  const { beforeLast: before, lastIntent: intent, final: after } = boundary;
  runtime.assertValidSliceState(before); runtime.assertValidSliceState(after); assert.equal(before.status,'ACTIVE');
  runtime.checkOriginals(before,runtime.originalSource,before); runtime.checkOriginals(after,runtime.originalSource,before);
  const beforeSession = before.sun.guidanceKnown ? runtime.openSunRuntimeSession(before) : null;
  const afterSession = after.sun.guidanceKnown ? runtime.openSunRuntimeSession(after) : null;
  if (beforeSession) equalState(beforeSession.snapshot(),before); if (afterSession) equalState(afterSession.snapshot(),after);
  const publicBefore = beforeSession ? beforeSession.project() : runtime.projectSliceState(before);
  const publicAfter = afterSession ? afterSession.project() : runtime.projectSliceState(after);
  assert.deepEqual(publicBefore,runtime.projectSliceState(before)); assert.deepEqual(publicAfter,runtime.projectSliceState(after));
  assert.deepEqual(publicBefore,boundary.globalPublicBefore); assert.deepEqual(publicAfter,boundary.globalPublic);
  const authoredBefore = capturePublic(publicBefore), authoredAfter = capturePublic(publicAfter);
  assert.equal(stateHash(authoredBefore),boundary.audit.publicBeforeSha256); assert.deepEqual(authoredBefore,boundary.publicBefore); assert.deepEqual(authoredAfter,boundary.public);
  producer.verifyActionCapture(boundary, boundary.audit); assert.deepEqual(selectionOutcome(authoredAfter),boundary.audit.selectionOutcome);
  assert.deepEqual(boundary.audit.receipts,actualReceipts(after,before),'Every actual Sun receipt stays exact');
  assertGlobalPublic(publicBefore,before); assertGlobalPublic(publicAfter,after);
  assert.equal(stateHash(publicBefore),boundary.audit.globalPublicBeforeSha256); assert.equal(stateHash(publicAfter),boundary.audit.globalPublicAfterSha256); assert.equal(stateHash(publicAfter),stateHash(boundary.globalPublic));
  if (afterSession) assert.deepEqual(runtime.projectPlayerText(structuredClone(afterSession.projectSun()),after.character.name),publicAfter.sun);
  const input = { manifestSha256, transition, beforeStateSha256: stateHash(before), stateSha256: stateHash(after), publicStateSha256: stateHash(publicAfter) };
  const path = join(work, 'case.sqlite'), phasePath = join(work, 'phase.json');
  const previousSelection = 'new216-sun-audit-previous-selection'; let pending;
  if (!existsSync(work)) { mkdirSync(work); atomic(phasePath, { input, phase: 'ALLOCATED', beforeRows: null, beforeFiles: null, committedRows: null }); }
  else { directory(work); databaseFiles(work); assert(!readdirSync(work).some(file => file.endsWith('.gz') || file.startsWith('archive.json')), 'An unindexed case may not contain archived databases'); }
  assert(!existsSync(`${phasePath}.next`), 'Interrupted phase write retained; inspect before resuming');
  pending = json(regular(phasePath)); keys(pending, ['input', 'phase', 'beforeRows', 'beforeFiles', 'committedRows'], 'Case phase');
  assert.deepEqual(pending.input, input); assert(['ALLOCATED', 'BEFORE_SAVED', 'WRITE_ROLLBACK_VERIFIED', 'COMMIT_ROLLBACK_VERIFIED', 'COMMITTED', 'VERIFIED'].includes(pending.phase));
  const checkpoint = phase => { pending.phase = phase; atomic(phasePath, pending); };
  const envelope = { intentId: `new216-sun:${transition.commandCount}`, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const receipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision, newRevision: after.revision, committedAt: COMMIT_TIME, replayed: false, state: publicAfter };
  const rows = () => databaseRows(DatabaseSync, path);
  let app, injection = null, injected = 0, hooks = 0, beforeHead;
  const expectedHead = state => state.sun.guidanceKnown ? { runId: state.runId, revision: state.revision, status: state.status } : null;
  const checkHead = expected => {
    assert.deepEqual(app.repository.ownedHead(before.runId), expected);
    if (expected) assert.deepEqual(app.repository.projectFoolRun(before.runId), expected.revision === before.revision ? publicBefore : publicAfter, 'Private owned head projection is unchanged until COMMIT');
  };
  const exact = (expected, committed) => {
    const saved = app.repository.get(expected.runId); equalState(saved.state, expected); assert.deepEqual(saved.state.random, expected.random);
    assert.equal(saved.updatedAt, committed ? COMMIT_TIME : INITIAL_TIME); assert.equal(app.repository.activeRun(), committed ? expected.runId : previousSelection);
    assert.deepEqual(app.repository.receipt(envelope.intentId), committed ? { fingerprint: stable(envelope), receipt } : null);
  };
  const fault = () => { exact(after, true); checkHead(beforeHead); injected++; throw Error(`Injected ${injection} after actual state, receipt and selection`); };
  const open = () => {
    const store = new runtime.SqliteSliceStore(path, { now: () => COMMIT_TIME, beforeWrite: () => { hooks++; if (injection === 'beforeWrite') fault(); } });
    const db = store.repository.db; assert(db instanceof DatabaseSync, 'Use the actual repository SQLite connection'); const exec = db.exec;
    db.exec = function (sql) { if (injection === 'COMMIT' && sql === 'COMMIT') fault(); return exec.call(this, sql); };
    return store;
  };
  const close = () => { app?.close(); app = undefined; };
  const bootstrap = expected => {
    const beforeHooks = hooks, beforeRows = rows(), beforeFiles = databaseFiles(work), boot = app.getBootstrap();
    assert.equal(boot.ok, true); assert.deepEqual(boot.value.activeState, expected); assert.equal(hooks, beforeHooks, 'Bootstrap is a read transaction without write-fault hooks');
    assert.deepEqual(rows(), beforeRows); assert.deepEqual(databaseFiles(work), beforeFiles);
  };
  const assertBefore = () => { exact(before, false); checkHead(expectedHead(before)); assert.deepEqual(rows(), pending.beforeRows); assert.deepEqual(databaseFiles(work), pending.beforeFiles); };
  try {
    app = open();
    if (pending.phase === 'ALLOCATED') {
      if (!app.repository.get(before.runId)) {
        assert.deepEqual(Object.fromEntries(Object.entries(rows()).map(([key, value]) => [key, value.count])), { runs: 0, receipts: 0, meta: 0 });
        app.repository.transaction(() => { app.repository.put({ state: before, updatedAt: INITIAL_TIME }); app.repository.selectRun(previousSelection); });
      }
      exact(before, false); close(); app = open(); exact(before, false); bootstrap(publicBefore);
      pending.beforeRows = rows(); pending.beforeFiles = databaseFiles(work); checkpoint('BEFORE_SAVED');
    }
    for (const [phase, mode, next] of [['BEFORE_SAVED', 'beforeWrite', 'WRITE_ROLLBACK_VERIFIED'], ['WRITE_ROLLBACK_VERIFIED', 'COMMIT', 'COMMIT_ROLLBACK_VERIFIED']]) {
      if (pending.phase !== phase) continue;
      assertBefore(); beforeHead = app.repository.ownedHead(before.runId); injected = 0; injection = mode;
      let rejected; try { rejected = app.submitIntent(envelope); } finally { injection = null; }
      assert.equal(rejected.ok, false); assert.equal(rejected.error.code, 'SAVE_FAILED'); assert.equal(injected, 1);
      assertBefore(); close(); app = open(); assertBefore(); bootstrap(publicBefore); checkpoint(next);
    }
    if (pending.phase === 'COMMIT_ROLLBACK_VERIFIED') {
      // A crash can occur after durable COMMIT but before the phase fsync.
      // Reconcile an exact saved receipt; never submit an already committed ID.
      if (shouldSubmitCommit(pending.phase,app.repository.receipt(envelope.intentId),envelope,receipt)) {
        assertBefore(); const committed = app.submitIntent(envelope); assert.equal(committed.ok, true); assert.deepEqual(committed.value, receipt);
      }
      exact(after, true); checkHead(expectedHead(after)); pending.committedRows = rows(); checkpoint('COMMITTED');
    }
    if (pending.phase === 'COMMITTED') {
      assert.equal(shouldSubmitCommit(pending.phase,app.repository.receipt(envelope.intentId),envelope,receipt),false);
      exact(after, true); assert.deepEqual(rows(), pending.committedRows); close(); app = open(); exact(after, true); bootstrap(publicAfter);
      const loaded = app.loadRun(after.runId); assert.equal(loaded.ok, true); assert.deepEqual(loaded.value, publicAfter); assert.deepEqual(rows(), pending.committedRows);
      const duplicateFiles = databaseFiles(work);
      const duplicate = app.submitIntent(envelope); assert.equal(duplicate.ok, true); assert.deepEqual(duplicate.value, { ...receipt, replayed: true });
      exact(after, true); checkHead(expectedHead(after)); assert.deepEqual(rows(), pending.committedRows);
      assert.deepEqual(databaseFiles(work),duplicateFiles,'Duplicate receipt cannot mutate DB, backup or seal bytes');
      if (after.status === 'DEAD') {
        const blocked = app.submitIntent({ ...envelope, intentId: `${envelope.intentId}:archived`, expectedRevision: after.revision, payload: { type: 'SUN', command: { type: 'REST' } } });
        assertDeathSeal(after,publicAfter,json(regular(`${path}.sealed`)),blocked);
        assert.deepEqual(rows(), pending.committedRows); assert.deepEqual(databaseFiles(work),duplicateFiles,'Archived continuation cannot mutate any saved artifact');
      } else {
        assert.equal(existsSync(`${path}.sealed`), false, 'SLICE_COMPLETE is not a death seal');
        if (after.status === 'SLICE_COMPLETE') assert.equal(publicAfter.canAct, false);
      }
      close(); app = open(); exact(after, true); bootstrap(publicAfter); assert.deepEqual(rows(), pending.committedRows); close(); checkpoint('VERIFIED');
    } else { assert.equal(pending.phase, 'VERIFIED'); exact(after, true); assert.deepEqual(rows(), pending.committedRows); close(); }
    // Every store and inspection connection is closed before fsync and hashing.
    for (const name of Object.keys(databaseFiles(work))) sync(join(work,name)); sync(work);
    return { ...transition, beforeStateSha256: input.beforeStateSha256, stateSha256: input.stateSha256, publicStateSha256: input.publicStateSha256,
      authoredPublicSha256: stateHash(authoredAfter), playerChapterSha256: stateHash(publicAfter.sun), random: after.random,
      revision: after.revision, status: after.status, checks: CHECKS, databaseRows: pending.committedRows, databaseFiles: databaseFiles(work) };
  } finally { injection = null; close(); }
}
export function assertCompletedIndex(index, manifestSha256, selected) {
  keys(index,['manifestSha256','results','complete'],'Completed audit index'); assert.equal(index.manifestSha256,manifestSha256);
  assert(Array.isArray(selected) && selected.length>0 && selected.length<=BOUNDARY_LIMIT);
  assert(Array.isArray(index.results) && index.results.length<=selected.length); assert.equal(typeof index.complete,'boolean');
  const counts = new Set();
  for (const [i,result] of index.results.entries()) {
    assert(!counts.has(result.commandCount),'Duplicate completed transition'); counts.add(result.commandCount);
    for (const key of ['commandCount','kinds','files','boundarySha256']) assert.deepEqual(result[key],selected[i][key],'Completed results are an exact ordered selection prefix');
  }
  if (index.complete) assert.equal(index.results.length,selected.length,'A partial selected audit must never be marked complete');
}
export function assertPartialResumePaths(out, selected, completedCount) {
  assert(whole(completedCount) && completedCount<=selected.length);
  for (const selectedCase of selected.slice(completedCount+1))
    assert(!existsSync(join(out,`case-${selectedCase.commandCount}`)),'Only the first incomplete case can have unindexed evidence');
}
export function assertVerifyOptions(options) {
  assert(options && typeof options === 'object' && !Array.isArray(options));
  const allowed = new Set(['repo','sourceDirectory','inputManifest','inputManifestSha256','freezeSha256','verifierSha256',
    'outputDirectory','resumeDirectory','expectedBoundaries','removeStaleLockPid','limit','preflight','help']);
  for (const key of Object.keys(options)) assert(allowed.has(key), `Unsupported verification option ${key}`);
  assert(!(options.outputDirectory && options.resumeDirectory), 'Use one exact output directory');
  if (options.preflight !== undefined) assert.equal(typeof options.preflight,'boolean');
  assert(!options.preflight || !options.outputDirectory && !options.resumeDirectory && !options.removeStaleLockPid, 'Preflight never writes or alters a lock');
  if (options.expectedBoundaries !== undefined) assert(whole(options.expectedBoundaries) && options.expectedBoundaries > 0 && options.expectedBoundaries <= BOUNDARY_LIMIT);
  if (options.limit !== undefined) assert(whole(options.limit) && options.limit > 0 && options.limit <= BOUNDARY_LIMIT);
  if (options.preflight) assert.equal(options.limit,undefined,'Preflight does not execute a limited case selection');
  if (options.removeStaleLockPid !== undefined) assert(whole(options.removeStaleLockPid) && options.removeStaleLockPid > 0);
}
export async function verifySunCapture(options) {
  assertVerifyOptions(options);
  const repo = directory(options.repo ?? process.cwd()), root = directory(options.sourceDirectory ?? join(repo,producer.OUTPUT));
  assert.equal(join(repo,'scripts/play/verify-sun-real-saves.mjs'),SELF,'Run the verifier from its exact frozen repository');
  for (const key of ['freezeSha256', 'verifierSha256', 'inputManifestSha256']) assert(digest(options[key]), `Required reviewed ${key}`);
  assert.equal(fileEvidence(SELF).sha256, options.verifierSha256);
  const manifestPath = regular(resolve(options.inputManifest)); assert(!contains(root, manifestPath), 'Reviewed input manifest lives outside its own capture');
  assert.equal(fileEvidence(manifestPath).sha256, options.inputManifestSha256);
  const inputManifest = json(manifestPath); assertInputManifest(inspectCaptureInputs(root), inputManifest);
  const freeze = json(join(root, 'runtime-freeze.json')), runtimeFreeze = producer.inspectFreeze(repo);
  assert.equal(freeze.sha256, options.freezeSha256); assertFreeze(freeze, runtimeFreeze);
  const data = inspectCapture(root, repo, freeze); assertCaptureComplete(data.capture,data.cp);
  if (options.expectedBoundaries !== undefined) assert.equal(data.selected.length, options.expectedBoundaries, 'Unique actual transition count');
  const manifest = { format: FORMAT, databaseRetention: 'VERIFIED_COMPLETED_CASE_GZIP_V1', sourceDirectory: root, repo, inputs: inputManifest, inputManifest: fileEvidence(manifestPath),
    freeze, runtimeFreeze, historicalInputFreeze: data.inputFreeze,
    producer: fileEvidence(join(repo,PRODUCER)), verifier: fileEvidence(SELF), verifierTests: fileEvidence(`${SELF.slice(0,-4)}.test.mjs`), selected: data.selected, node: process.version };
  const manifestSha256 = stateHash(manifest);
  const recheck = () => {
    assertInputManifest(inspectCaptureInputs(root), inputManifest); assertFreeze(runtimeFreeze, producer.inspectFreeze(repo));
    assert.equal(fileEvidence(SELF).sha256, options.verifierSha256);
    assert.deepEqual(fileEvidence(`${SELF.slice(0,-4)}.test.mjs`),manifest.verifierTests,'Verifier test contract changed during audit');
    for (const pin of data.inputFreeze.files) assert.deepEqual(fileEvidence(join(repo,pin.file)),{bytes:pin.bytes,sha256:pin.sha256},'Historical source changed during audit');
    assert.deepEqual(fileEvidence(manifestPath), manifest.inputManifest, 'Reviewed manifest changed during audit');
  };
  if (options.preflight) {
    recheck();
    return { preflight: 'PASSED_NO_GAME_NO_SQLITE_NO_WRITES', manifestSha256, stage: data.capture.stage,
      captureFreezeSha256: freeze.sha256, runtimeFreezeSha256: runtimeFreeze.sha256,
      naturalCaptureComplete: data.cp.terminal !== null, completedActionEvidence: data.cp.rows.length, newCommands: data.cp.commands.length, uniqueTransitions: data.selected.length, boundaryAliases: data.cp.boundaries.length - data.selected.length,
      selected: data.selected.map(({commandCount,kinds,files})=>({commandCount,kinds,files})), finalNaturalStatus: data.cp.state.status };
  }
  assertCaptureComplete(data.capture,data.cp);
  recheck();
  const forbidden = [root, manifestPath, ...['src', 'dist', 'scripts', 'tests', 'test-inputs', 'docs', 'node_modules', '.git'].map(file => join(repo, file))];
  const out = assertOutputPath(options.resumeDirectory ?? options.outputDirectory ?? join(repo,OUTPUT), forbidden);
  if (options.resumeDirectory) directory(out);
  else { if (existsSync(out)) assert.equal(readdirSync(directory(out)).length, 0, 'New output directory must be empty'); else mkdirSync(out, { recursive: true }); }
  const unlock = claimAuditLock(out, manifestSha256, options.removeStaleLockPid), manifestFile = join(out, 'manifest.json'), indexFile = join(out, 'completed.json');
  let index;
  try {
    if (options.resumeDirectory) { assertResumeManifest(json(regular(manifestFile)), manifest); recheck(); index = json(regular(indexFile)); }
    else { atomic(manifestFile, manifest); index = { manifestSha256, results: [], complete: false }; atomic(indexFile, index); }
    assertCompletedIndex(index,manifestSha256,data.selected);
    const expectedFiles = new Set(['manifest.json', 'completed.json', 'audit.lock.json', 'report.json', 'status.json', 'failure.json', ...data.selected.map(item => `case-${item.commandCount}`)]);
    for (const file of readdirSync(out)) assert(expectedFiles.has(file), `Unknown or interrupted audit artifact retained: ${file}`);
    assertPartialResumePaths(out,data.selected,index.results.length);
    for (const [i, result] of index.results.entries()) {
      keys(result, ['commandCount','kinds','files','boundarySha256','beforeStateSha256','stateSha256','publicStateSha256',
        'authoredPublicSha256','playerChapterSha256','random','revision','status','checks','databaseRows','databaseFiles',
        ...(Object.hasOwn(result,'databaseArchives') ? ['databaseArchives'] : [])], 'Exact completed transition result');
      const selected = data.selected[i]; assert.equal(result.commandCount, selected.commandCount); assert.deepEqual(result.files, selected.files); assert.deepEqual(result.kinds, selected.kinds); assert.equal(result.boundarySha256, selected.boundarySha256);
      const row = data.cp.rows[result.commandCount - PREFIX - 1]; assert.equal(result.beforeStateSha256, row.beforeStateSha256); assert.equal(result.stateSha256, row.afterStateSha256);
      assert.equal(result.authoredPublicSha256, row.publicAfterSha256); assert.equal(result.revision, row.revision); assert.deepEqual(result.random, row.randomAfter); assert.equal(result.status,row.selectionOutcome.status); assert.deepEqual(result.checks, CHECKS);
      assert.equal(result.publicStateSha256,row.globalPublicAfterSha256);
      const boundary = readCapture(join(root,selected.files[0])); assert.equal(result.playerChapterSha256,stateHash(boundary.public.sun));
      const work = join(out, `case-${result.commandCount}`), phase = json(regular(join(work, 'phase.json')));
      assert.equal(phase.phase, 'VERIFIED'); assert.equal(phase.input.manifestSha256, manifestSha256); assert.deepEqual(phase.input.transition, selected);
      assert.equal(phase.input.beforeStateSha256, result.beforeStateSha256); assert.equal(phase.input.stateSha256, result.stateSha256); assert.equal(phase.input.publicStateSha256, result.publicStateSha256);
      assert.deepEqual(phase.committedRows, result.databaseRows);
      const archive = archiveCompletedCase(work, result, indexFile);
      if (!result.databaseArchives) { result.databaseArchives = archive; atomic(indexFile, index); }
    }
    const status = phase => atomic(join(out,'status.json'), { format: FORMAT, manifestSha256, phase,
      complete: index.complete, completedTransitions: index.results.length, selectedUniqueTransitions: data.selected.length,
      lastVerifiedCommandCount: index.results.at(-1)?.commandCount ?? null,
      nextCommandCount: data.selected[index.results.length]?.commandCount ?? null, updatedAt: new Date().toISOString() });
    status('VERIFYING');
    let runtime, sqlite;
    if (index.results.length < data.selected.length) {
      const modules = await Promise.all(['dist/domain/slice/index.js','dist/domain/slice/migration.js','dist/persistence/slice-store.js',
        'dist/shared/player-text.js','dist/domain/sun/owned-session.js'].map(file => import(pathToFileURL(join(repo,file)).href)).concat(import('node:sqlite')));
      const [slice,migration,store,playerText,session,database] = modules; sqlite = database;
      runtime = { ...slice,...migration,...store,...playerText,...session, checkOriginals: producer.checkOriginals, originalSource: data.source };
      runtime.assertValidSliceState(data.cp.state);
      const finalSession = data.cp.state.sun.guidanceKnown ? runtime.openSunRuntimeSession(data.cp.state) : null;
      if (finalSession) equalState(finalSession.snapshot(),data.cp.state);
      const finalPublic = finalSession ? finalSession.project() : runtime.projectSliceState(data.cp.state); assertGlobalPublic(finalPublic,data.cp.state);
      assert.equal(stateHash(capturePublic(finalPublic)),data.cp.publicStateSha256); assert.equal(stateHash(finalPublic),data.cp.globalPublicStateSha256);
      const initial = runtime.migrateSliceState(data.source); assert.equal(stateHash(initial),data.cp.initialStateSha256); equalState(initial,data.initial);
      assert.equal(initial.schemaVersion,213); assert.equal(initial.contentVersion,'sun-v213'); runtime.assertValidSliceState(initial);
      for (const [key,value] of Object.entries(data.source)) if (!['schemaVersion','contentVersion'].includes(key)) assert.deepEqual(initial[key],value,`Original853 migration preserves ${key}`);
      producer.verifyCheckpoint(data.cp,freeze,stateHash(initial),data.inputFreeze);
      const initialPublic = runtime.projectSliceState(initial); assertGlobalPublic(initialPublic,initial);
      assert.equal(stateHash(initialPublic),data.cp.initialGlobalPublicSha256); assert.equal(stateHash(capturePublic(initialPublic)),data.cp.initialPublicSha256); assert.equal(stateHash(initial.random),data.cp.initialRandomSha256);
      const first = readCapture(join(root,data.selected[0].files[0])); equalState(first.beforeLast,initial);
      // Each selected transition is checked below; the unselected tail is not replayed.
    }
    const invocationEnd = Math.min(data.selected.length,index.results.length + (options.limit ?? BOUNDARY_LIMIT));
    for (const transition of data.selected.slice(index.results.length,invocationEnd)) {
      recheck(); const boundary = readCapture(join(root, transition.files[0])); assert.equal(stateHash(boundary), transition.boundarySha256);
      const result = checkSqlite(runtime, sqlite.DatabaseSync, join(out, `case-${transition.commandCount}`), manifestSha256, transition, boundary);
      recheck();
      index.results.push(result); atomic(indexFile, index);
      result.databaseArchives = archiveCompletedCase(join(out, `case-${transition.commandCount}`), result, indexFile); atomic(indexFile, index);
      status('BOUNDARY_VERIFIED');
      console.log(JSON.stringify({ event: 'SQLITE_CASE_VERIFIED', commandCount: transition.commandCount, completed: index.results.length, total: data.selected.length })); global.gc?.();
    }
    recheck();
    if (index.results.length < data.selected.length) {
      const report = { format: FORMAT, passed: null, complete: false, controlledStop: true, exitCode: 0,
        manifestSha256, completedTransitions: index.results.length, selectedUniqueTransitions: data.selected.length,
        lastVerifiedCommandCount: index.results.at(-1)?.commandCount ?? null,
        nextCommandCount: data.selected[index.results.length].commandCount, resumeDirectory: out };
      status('LIMIT_REACHED'); atomic(join(out,'report.json'),report); return report;
    }
    assert.equal(index.results.length, data.selected.length); index.complete = true; atomic(indexFile, index); status('COMPLETE');
    const report = { format: FORMAT, passed: true, complete: true, exitCode: 0, manifestSha256, stage: data.capture.stage, naturalCaptureComplete: true,
      captureFreezeSha256: freeze.sha256, runtimeFreezeSha256: runtimeFreeze.sha256, historicalInputFreezeSha256: data.inputFreeze.sha256,
      finalNaturalStatus: data.cp.state.status, finalSequence: data.cp.state.progression.sequence, sunPromoted: data.cp.state.progression.sequence === 0,
      deathSealsVerified: index.results.filter(row=>row.status==='DEAD').length,
      capturedCommandCount: data.cp.commandCount, retainedTailCommands: data.cp.commands.length, finalStateSha256: data.cp.finalStateSha256,
      finalChapterPublicSha256: data.cp.publicStateSha256, finalGlobalPublicSha256: data.cp.globalPublicStateSha256,
      publicProjection: 'FULL_RETAINED_CHAPTER_AND_GLOBAL_BEFORE_AFTER_EVERY_ACTION_SELECTED_SQLITE_TRANSITIONS',
      completedActionEvidence: data.cp.rows.length, completeOriginalPrefixCommands: PREFIX, originalSourceRoot: 'final',
      completedTransitions: index.results.length, selectedUniqueTransitions: data.selected.length, aliases: data.cp.boundaries.length - data.selected.length,
      original853HistoricalReplay: 'NOT_RUN', alternateSourceUsed: false, originalSchema191To213: 'EXACT_RETAINED_MIGRATION', newTailSequentialReplay: 'NOT_RUN_SELECTED_CAPTURED_TRANSITIONS_ONLY',
      producerVersion: 'SUN_NATURAL_V1', rebuild: 'NEW216', newNatural216: true, rebuiltFromRestoredVolume194: true, syntheticTransitions: 'NONE', retainedDatabases: 'LOSSLESS_GZIP_ORIGINAL_AND_COMPRESSED_SHA256', restoreDatabase: 'gunzip -c case.sqlite.gz > restored.sqlite', desktop: 'NOT_RUN', results: index.results };
    atomic(join(out, 'report.json'), report); return report;
  } catch (error) {
    try {
      if (!existsSync(join(out, 'failure.json.next'))) atomic(join(out, 'failure.json'), { format: FORMAT, complete: false, exitCode: 1, manifestSha256,
        completedTransitions: index?.results.length ?? 0, selectedUniqueTransitions: data.selected.length, error: String(error), databasesRetained: true });
    } catch { /* Preserve the original error and evidence if storage is exhausted. */ }
    throw error;
  } finally { unlock(); }
}
export function parseOptions(args) {
  const result = {}, seen = new Set(), fields = { '--source-directory': 'sourceDirectory', '--input-manifest': 'inputManifest',
    '--input-manifest-sha256': 'inputManifestSha256', '--freeze-sha256': 'freezeSha256', '--verifier-sha256': 'verifierSha256',
    '--output-directory': 'outputDirectory', '--resume-directory': 'resumeDirectory', '--expected-boundaries': 'expectedBoundaries', '--limit': 'limit', '--remove-stale-lock-pid': 'removeStaleLockPid' };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i] === '--preflight-only' ? '--preflight' : args[i]; assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--preflight' || flag === '--help') { result[flag.slice(2)] = true; continue; }
    const key = fields[flag]; assert(key, `Unsupported ${flag}`); const value = args[++i]; assert(value && !value.startsWith('--'), `Missing value for ${flag}`);
    if (key === 'expectedBoundaries' || key === 'removeStaleLockPid' || key === 'limit') { assert(/^[1-9]\d*$/.test(value)); result[key] = Number(value); assert(Number.isSafeInteger(result[key])); }
    else result[key] = value;
  }
  assert(!(result.outputDirectory && result.resumeDirectory), 'Use one exact output directory');
  assert(!result.preflight || !result.outputDirectory && !result.resumeDirectory && !result.removeStaleLockPid, 'Preflight never writes or alters a lock');
  if (result.expectedBoundaries !== undefined) assert(result.expectedBoundaries <= BOUNDARY_LIMIT, 'At most64 selected transitions');
  assertVerifyOptions(result); return result;
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log('node --expose-gc scripts/play/verify-sun-real-saves.mjs --input-manifest EXTERNAL_MANIFEST --input-manifest-sha256 SHA --freeze-sha256 SHA --verifier-sha256 SHA [--source-directory CAPTURE] [--preflight-only | --output-directory EMPTY_NEW_DIR | --resume-directory SAME_DIR] [--expected-boundaries N] [--limit N] [--remove-stale-lock-pid DEAD_PID]. Defaults: capture output/rebuild-0216/natural-v1; audit output/rebuild-0216/sqlite-natural-v1. Only after the producer has finished a terminal capture, prepare and review the external manifest with inspectCaptureInputs(CAPTURE), then pin its exact SHA. No active, paused, diagnostic or pending capture is eligible, including for preflight. Preflight discovers the complete exact unique boundary count and list without importing the game, opening SQLite or writing. Every producer-selected boundary receives strict actual-before import, beforeWrite and COMMIT rollback, identical-intent commit retry, exact private/RNG/chapter/global-public checks, cold reopen and idempotent duplicate checks. Genuine terminal death must be selected and seal/forbid continuation. --limit pauses after N additional fully verified and archived boundaries; complete stays false and the next exact command is reported. Resume requires every original input, runtime, producer, verifier, Node version and selection to match; an already committed case is reconciled before duplicate-only submission. A single durable lock refuses live or uncertain owners. Only owned, closed, fsynced and durably indexed completed DB/bak/seal duplicates are losslessly gzip-retained with raw and packed hashes plus full decompression comparison before raw retirement. No hard links, seed changes, synthetic CREATE, alternate histories, source/build changes, historical853 replay, unselected-tail replay, desktop proof or natural-success claim. Unknown or unfinished artifacts stop without cleanup. Restore gzip only to a NEW destination.');
    else { const report = await verifySunCapture(options); console.log(JSON.stringify(options.preflight ? report : { passed: report.passed, complete: report.complete, controlledStop: report.controlledStop ?? false, exitCode: 0, completedTransitions: report.completedTransitions, selectedUniqueTransitions: report.selectedUniqueTransitions })); }
  } catch (error) { console.error(JSON.stringify({ passed: false, complete: false, exitCode: 1, error: String(error) })); process.exitCode = 1; }
}
