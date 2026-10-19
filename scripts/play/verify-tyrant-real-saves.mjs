import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

/** NEW215 rebuilt evidence only: this never restores or claims the lost original215.
 * Import and --preflight do not import game/dist modules, open SQLite or write.
 * Run --help for the pinned input/output contract. No seed/draw/source override.
 * Adapted from scripts/verify-white-tower-sqlite.mjs; no product/runtime changes.
 */
import * as producer from './tyrant-stage-cooldown-v2.mjs';
const SELF = fileURLToPath(import.meta.url);
export const FORMAT = 'NEW215_TYRANT_SELECTED_REAL_SQLITE_AUDIT_V1';
export const INPUT_FORMAT = 'NEW215_TYRANT_CAPTURE_FILES_V1';
const PRODUCER = 'scripts/play/tyrant-stage-cooldown-v2.mjs';
const CONTINUATION_TOOL = 'scripts/play/tyrant-stage-continue-835.mjs';
export const SOURCE = producer.SOURCE, SOURCE_SHA256 = producer.SOURCE_SHA256;
export const SOURCE_STATE_SHA256 = producer.SOURCE_STATE_SHA256, PREFIX_SHA256 = producer.PREFIX_SHA256;
export const PREFIX = 701, BOUNDARY_LIMIT = 64;
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
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const stateHash = value => sha(stable(value));
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
export function inspectCaptureInputs(root) {
  root = directory(root); const files = [];
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
  keys(value, ['status','sequence','promoted','guidance','s1Reflected'], 'Exact public selection outcome');
  assert(['ACTIVE','DEAD','SLICE_COMPLETE','REVIVAL_PENDING'].includes(value.status));
  assert([0,1,2].includes(value.sequence));
  for (const key of ['promoted','guidance','s1Reflected']) assert.equal(typeof value[key], 'boolean');
}
/** Independent copy of the frozen producer taxonomy; never invent a missing case. */
export function boundaryKind(intent, outcome) {
  assertSelectionOutcome(outcome);
  assert(['TYRANT','THUNDER_GOD','ACTION','EVENT_CHOICE'].includes(intent.type));
  const c = intent.command; let key = null;
  if (intent.type === 'EVENT_CHOICE' && intent.choiceId === 'PAY') key = 'ordinary-paid-treatment';
  if (intent.type === 'THUNDER_GOD') {
    if (['REQUEST_RECOVERY_V1','RECOVER_CHARACTERISTIC_V1','BUY_POTION','PREPARE_PROMOTION','STABILIZE_PROMOTION','REFLECT'].includes(c.type)) key = `s1-${c.type.toLowerCase()}`;
    if (c.type === 'REPORT') key = `s1-report-${c.caseId}`;
    if (c.type === 'CONSUME') key = outcome.status !== 'ACTIVE' ? 's1-actual-terminal-dose' : outcome.sequence === 1 ? 's1-actual-promotion' : 's1-first-recovered-dose-failure';
  }
  if (intent.type === 'TYRANT') {
    if (['LEARN_GUIDANCE','CLINIC','STABILIZE_PROMOTION','START_EPILOGUE'].includes(c.type)) key = `tyrant-${c.type.toLowerCase()}`;
    if (c.type === 'COAST' && ['FULFILL','RENEW','REVIEW_NEXT_WEEK','LOAD_TRANSFER','DELIVER_TRANSFER'].includes(c.command.type)) key = `coast-${c.command.coastId}-${c.command.type.toLowerCase()}`;
    if (c.type === 'MATERIAL') {
      if (['ACQUIRE_CHARACTERISTIC','INVESTIGATE_LEGACY_REMAINS','RECOVER_LEGACY_REMAINS'].includes(c.command.type)) key = `material-${c.command.type.toLowerCase()}-${c.command.bottleId}`;
      if (['ACQUIRE_UNIQUENESS','COMPOSE_POTION','SEAL_REMAINS','RECOVER_SEALED'].includes(c.command.type)) key = `material-${c.command.type.toLowerCase()}`;
      if (c.command.type === 'VERIFY_UNIQUENESS') key = `uniqueness-${c.command.step.toLowerCase()}`;
    }
    if (c.type === 'CONSUME') key = outcome.status !== 'ACTIVE' ? 'tyrant-actual-terminal-dose' : outcome.promoted ? 'tyrant-actual-promotion' : 'tyrant-first-failed-dose';
    if (c.type === 'CHALLENGE') key = `challenge-${c.command.type.toLowerCase()}`;
    if (c.type === 'EPILOGUE') key = `epilogue-${c.command.type.toLowerCase()}`;
  }
  if (outcome.status !== 'ACTIVE') key = `${intent.type.toLowerCase()}-actual-terminal`;
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
export function actualReceipts(after, before) {
  const latest = after.tyrant.journal.at(-1);
  if (latest?.revision === after.revision) return { checks: latest.randomReceipts, finance: latest.financeReceipts, notes: latest.notes };
  const acquisition = after.thunderGod.acquisitionJournal.slice(before.thunderGod.acquisitionJournal.length);
  const life = after.thunderGod.life.journal.slice(before.thunderGod.life.journal.length);
  return { checks: [...acquisition,...life].filter(row => row.check).map(row => row.check), acquisition, life,
    finance: [], notes: after.chronicle.slice(before.chronicle.length) };
}
export function assertActionCapture(content, row) {
  assertActionCaptureShape(content); producer.verifyActionCapture(content, row); assertSelectionOutcome(row.selectionOutcome);
  assert.equal(content.beforeLast.status, 'ACTIVE'); assert.equal(content.beforeLast.revision, row.commandCount);
  assert.equal(content.final.revision, row.commandCount + 1); assert.equal(content.final.week, row.week);
  assert.equal(content.final.status, row.selectionOutcome.status);
  assert.deepEqual(row.receipts, actualReceipts(content.final, content.beforeLast), 'Exact actual S1 or Tyrant receipts');
  const latest = content.final.tyrant.journal.at(-1);
  if (latest?.revision === content.final.revision) assert.deepEqual(latest.command, row.intent.command);
  for (const [state, projection] of [[content.beforeLast,content.globalPublicBefore],[content.final,content.globalPublic]]) {
    assert.equal(state.schemaVersion,212); assert.equal(state.contentVersion,'tyrant-v212');
    for (const key of ['runId','revision','status','week']) assert.equal(projection[key],state[key]);
  }
}
export function assertCaptureStatus(capture, cp, summary) {
  const paused = capture.stage === 'MANUAL_PAUSE', diagnostic = capture.stage.startsWith('PUBLIC_');
  assert(['MANUAL_PAUSE','PUBLIC_ACTION_BLOCKED','PUBLIC_NO_PROGRESS_DIAGNOSTIC','NATURAL_FINITE_CARRIERS_UNAVAILABLE',
    'NATURAL_ACTUAL_TERMINAL','NATURAL_FINITE_TYRANT_REPORTED'].includes(capture.stage));
  assert.equal(summary.paused,paused); assert.equal(summary.diagnostic,diagnostic);
  assert.deepEqual(cp.terminal, paused || diagnostic ? null : {stage:capture.stage,reason:capture.reason});
  if (capture.stage === 'NATURAL_ACTUAL_TERMINAL') {
    assert(['DEAD','SLICE_COMPLETE','REVIVAL_PENDING'].includes(cp.state.status));
    assert.equal(capture.reason,`Actual runtime status ${cp.state.status}`);
  } else assert.equal(cp.state.status,'ACTIVE');
  if (capture.stage === 'NATURAL_FINITE_TYRANT_REPORTED') assert.equal(cp.policy.reported,true);
}
export function assertCaptureComplete(capture, cp) {
  assert(['NATURAL_FINITE_CARRIERS_UNAVAILABLE','NATURAL_ACTUAL_TERMINAL','NATURAL_FINITE_TYRANT_REPORTED'].includes(capture.stage),
    'Paused or diagnostic capture is incomplete; only read-only preflight is allowed');
  assert.deepEqual(cp.terminal,{stage:capture.stage,reason:capture.reason}); assert.equal(cp.pending,null);
}
export function assertContinuation835(root, cp, freeze) {
  const proof = producer.verify835Continuation(root,cp,freeze), ancestor = join(root,'predecessor-835');
  assert.equal(proof.predecessorFiles.length,145,'The complete exact835 predecessor file set is retained');
  const names = proof.predecessorFiles.map(row=>safeRelativeFile(row.file));
  assert.equal(new Set(names).size,names.length); assert.deepEqual(readdirSync(directory(ancestor)).sort(),[...names].sort());
  for (const row of proof.predecessorFiles) regular(join(ancestor,row.file));
  for (const row of cp.rows.slice(0,134)) {
    const expected={bytes:row.capture.bytes,sha256:row.capture.sha256};
    assert.deepEqual(fileEvidence(join(ancestor,row.capture.file)),expected,'Inherited packed action bytes changed');
    assert.deepEqual(fileEvidence(join(root,row.capture.file)),expected,'Root action no longer matches exact835 predecessor');
  }
  assert.deepEqual(fileEvidence(join(root,'producer.mjs')),fileEvidence(join(dirname(SELF),'tyrant-stage-cooldown-v2.mjs')));
  assert.deepEqual(fileEvidence(join(root,'continuation-tool.mjs')),fileEvidence(join(dirname(SELF),'tyrant-stage-continue-835.mjs')));
  return proof;
}
export function inspectCapture(root, repo, freeze) {
  const retained = ['archived-original701.json.gz','archived-original193-natural.json.gz'];
  const old = producer.readSource(repo), { source, commands: prefix, inputFreeze } = old;
  for (const [i,pin] of INPUTS.entries()) {
    assert.deepEqual(fileEvidence(join(repo,pin.file)),{bytes:old.buffers[i].length,sha256:pin.sha256});
    assert(readCaptureBytes(join(root,retained[i])).equals(old.buffers[i]), 'Complete original193 source files stay byte-exact');
  }
  assert.deepEqual(readCapture(join(root,'input-freeze.json')),inputFreeze);
  const migration = readCapture(join(root,'migration-initial.json.gz'));
  keys(migration,['originalStateSha256','migratedStateSha256','publicSha256','globalPublicSha256','final','random','public','globalPublic'],'Exact captured migration');
  assert.equal(migration.originalStateSha256,SOURCE_STATE_SHA256); assert.equal(migration.migratedStateSha256,stateHash(migration.final));
  assert.equal(migration.final.schemaVersion,212); assert.equal(migration.final.contentVersion,'tyrant-v212');
  for (const [key,value] of Object.entries(source)) if (!['schemaVersion','contentVersion'].includes(key)) assert.deepEqual(migration.final[key],value,`Historical migration preserves ${key}`);
  assert.deepEqual(migration.random,source.random); assert.deepEqual(migration.final.random,migration.random);
  assert.equal(migration.publicSha256,stateHash(migration.public)); assert.equal(migration.globalPublicSha256,stateHash(migration.globalPublic));
  assertPublicOnly(migration.public); assertGlobalPublic(migration.globalPublic,migration.final); assert.deepEqual(capturePublic(migration.globalPublic),migration.public);
  const wrapped = readCapture(join(root,'checkpoint.json.gz')), cp = wrapped.payload;
  keys(wrapped,['sha256','payload'],'Durable checkpoint'); assert.equal(wrapped.sha256,stateHash(cp));
  keys(cp,['format','source','sourceSha256','prefixSha256','inputFreezeSha256','runtimeFreezeSha256','policyDefinition','policy','migration','createdAt','commandCount',
    'commands','rows','boundaries','state','initialStateSha256','finalStateSha256','initialPublicSha256','publicStateSha256','initialGlobalPublicSha256','globalPublicStateSha256','initialRandomSha256',
    'pending','terminal','predecessorSha256','continuation835'],'Exact producer checkpoint');
  producer.verifyCheckpoint(cp,freeze,migration.migratedStateSha256,inputFreeze);
  assertContinuation835(root,cp,freeze);
  assert.equal(cp.initialPublicSha256,migration.publicSha256); assert.equal(cp.initialGlobalPublicSha256,migration.globalPublicSha256);
  assert.equal(cp.initialRandomSha256,stateHash(source.random)); assert.equal(cp.pending,null,'A pending action is not completed evidence');
  assert(typeof cp.createdAt==='string' && Number.isFinite(Date.parse(cp.createdAt))); assert(digest(cp.predecessorSha256));
  assert(cp.rows.length>0); assert.equal(cp.state.schemaVersion,212); assert.equal(cp.state.contentVersion,'tyrant-v212');
  const capture = readCapture(join(root,'natural.json.gz')), summary = readCapture(join(root,'summary.json'));
  keys(capture,['provenance','creation','seed','prefixCount','commands','policy','stage','reason','pendingIntent','boundaries','final'],'Exact natural capture');
  assert(typeof capture.reason==='string'); assert.equal(capture.prefixCount,PREFIX); assert.deepEqual(capture.final,cp.state);
  assert.deepEqual(capture.policy,POLICY); assert.deepEqual(capture.commands,[...prefix,...cp.commands]);
  assert.deepEqual(capture.creation,old.creation); assert.equal(capture.seed,old.seed); assert.equal(capture.pendingIntent,null); assert.deepEqual(capture.boundaries,cp.boundaries);
  assert.deepEqual(capture.provenance,{kind:'NEW215_FROM_RESTORED193_LIVING701_PUBLIC_TYRANT_CONTINUATION',
    format:'NEW215_REBUILD_PROVENANCE_COOLDOWN_V2',continuation835:cp.continuation835,lostOriginal215Restored:false,rebuiltFromRestoredVolume193:true,
    source:SOURCE,sourceSha256:SOURCE_SHA256,sourceRoot:'final',originalStateSha256:SOURCE_STATE_SHA256,originalEvidence:retained,
    prefixCommandsSha256:PREFIX_SHA256,inputFreezeSha256:inputFreeze.sha256,runtimeFreezeSha256:freeze.sha256,
    historicalPrefixReplayedByThisProducer:false,originalPrefixRetainedExactly:true,completeOriginalSourceRetainedExactly:true,alternateSourceUsed:false,
    privateAudit:true,seedChanged:false,randomOverridden:false,futureDrawInspected:false,selectedFromEnabledPublicActionsOnly:true,
    everyActionEvidence:'FULL_PRIVATE_RNG_CHAPTER_PUBLIC_AND_GLOBAL_PUBLIC_BEFORE_AND_AFTER_GZIP',
    selectedSQLiteBoundaries:'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER',globalPublicScope:'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH',projectionScope:'POSITIVE_S1_THEN_TYRANT_AND_ORDINARY_PUBLIC_DASHBOARD'});
  assert.deepEqual(summary,{stage:capture.stage,reason:capture.reason,commands:cp.commandCount,originalCommands:PREFIX,
    newCommands:cp.commands.length,rebuild:'NEW215',lostOriginal215Restored:false,controlledStop:capture.stage==='MANUAL_PAUSE',week:cp.policy.week,
    paused:capture.stage==='MANUAL_PAUSE',diagnostic:capture.stage.startsWith('PUBLIC_'),strictFinalValidation:true,
    continuation835:cp.continuation835,sqliteReopenValidation:'NOT_RUN_BY_PRODUCER',checkpoint:'checkpoint.json.gz',public:summary.public});
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
  assert.deepEqual(cp.commands[0],{type:'THUNDER_GOD',command:{type:'REQUEST_RECOVERY_V1',bottleId:'thunder-god-potion-1'}});
  const expected = new Set(['runtime-freeze.json','input-freeze.json','producer.mjs',...retained,'migration-initial.json.gz',
    'checkpoint.json.gz','commands.ndjson.gz','boundaries.index.json','natural.json.gz','summary.json','error.json',
    'continuation-835.json','continuation-tool.mjs','predecessor-835',...cp.rows.map(row=>row.capture.file)]);
  for (const file of readdirSync(root)) {
    assert(expected.has(file),`Unknown or unfinished capture artifact retained: ${file}`);
    if (file === 'predecessor-835') directory(join(root,file)); else regular(join(root,file));
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
  assert(whole(result.commandCount) && result.commandCount > PREFIX, 'Only actual completed Tyrant transition results');
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
  const archive = { format: 'NEW215_TYRANT_COMPLETED_SQLITE_GZIP_V1', manifestSha256: index.manifestSha256, files: {} };
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
function equalState(actual, expected) { assert.equal(stateHash(actual), stateHash(expected), 'Exact complete private state'); }
function checkSqlite(runtime, DatabaseSync, work, manifestSha256, transition, boundary) {
  const { beforeLast: before, lastIntent: intent, final: after } = boundary;
  runtime.assertValidSliceState(before); runtime.assertValidSliceState(after); assert.equal(before.status,'ACTIVE');
  runtime.checkOriginals(before,runtime.originalSource,before); runtime.checkOriginals(after,runtime.originalSource,before);
  const beforeSession = before.tyrant.guidanceKnown ? runtime.openTyrantRuntimeSession(before) : null;
  const afterSession = after.tyrant.guidanceKnown ? runtime.openTyrantRuntimeSession(after) : null;
  if (beforeSession) equalState(beforeSession.snapshot(),before); if (afterSession) equalState(afterSession.snapshot(),after);
  const publicBefore = beforeSession ? beforeSession.project() : runtime.projectSliceState(before);
  const publicAfter = afterSession ? afterSession.project() : runtime.projectSliceState(after);
  assert.deepEqual(publicBefore,runtime.projectSliceState(before)); assert.deepEqual(publicAfter,runtime.projectSliceState(after));
  assert.deepEqual(publicBefore,boundary.globalPublicBefore); assert.deepEqual(publicAfter,boundary.globalPublic);
  const authoredBefore = capturePublic(publicBefore), authoredAfter = capturePublic(publicAfter);
  assert.equal(stateHash(authoredBefore),boundary.audit.publicBeforeSha256); assert.deepEqual(authoredBefore,boundary.publicBefore); assert.deepEqual(authoredAfter,boundary.public);
  producer.verifyActionCapture(boundary, boundary.audit); assert.deepEqual(selectionOutcome(authoredAfter),boundary.audit.selectionOutcome);
  assert.deepEqual(boundary.audit.receipts,actualReceipts(after,before),'Every actual S1 or Tyrant receipt stays exact');
  assertGlobalPublic(publicBefore,before); assertGlobalPublic(publicAfter,after);
  assert.equal(stateHash(publicBefore),boundary.audit.globalPublicBeforeSha256); assert.equal(stateHash(publicAfter),boundary.audit.globalPublicAfterSha256); assert.equal(stateHash(publicAfter),stateHash(boundary.globalPublic));
  if (afterSession) assert.deepEqual(runtime.projectPlayerText(structuredClone(afterSession.projectTyrant()),after.character.name),publicAfter.tyrant);
  const input = { manifestSha256, transition, beforeStateSha256: stateHash(before), stateSha256: stateHash(after), publicStateSha256: stateHash(publicAfter) };
  const path = join(work, 'case.sqlite'), phasePath = join(work, 'phase.json'); let pending;
  if (!existsSync(work)) { mkdirSync(work); atomic(phasePath, { input, phase: 'ALLOCATED', beforeRows: null, beforeFiles: null, committedRows: null }); }
  else { directory(work); databaseFiles(work); assert(!readdirSync(work).some(file => file.endsWith('.gz') || file.startsWith('archive.json')), 'An unindexed case may not contain archived databases'); }
  assert(!existsSync(`${phasePath}.next`), 'Interrupted phase write retained; inspect before resuming');
  pending = json(regular(phasePath)); keys(pending, ['input', 'phase', 'beforeRows', 'beforeFiles', 'committedRows'], 'Case phase');
  assert.deepEqual(pending.input, input); assert(['ALLOCATED', 'BEFORE_SAVED', 'WRITE_ROLLBACK_VERIFIED', 'COMMIT_ROLLBACK_VERIFIED', 'COMMITTED', 'VERIFIED'].includes(pending.phase));
  const checkpoint = phase => { pending.phase = phase; atomic(phasePath, pending); };
  const envelope = { intentId: `new215-tyrant:${transition.commandCount}`, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const receipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision, newRevision: after.revision, committedAt: COMMIT_TIME, replayed: false, state: publicAfter };
  const rows = () => databaseRows(DatabaseSync, path);
  let app, injection = null, injected = 0, hooks = 0, beforeHead;
  const expectedHead = state => state.tyrant.guidanceKnown ? { runId: state.runId, revision: state.revision, status: state.status } : null;
  const checkHead = expected => {
    assert.deepEqual(app.repository.ownedHead(before.runId), expected);
    if (expected) assert.deepEqual(app.repository.projectFoolRun(before.runId), expected.revision === before.revision ? publicBefore : publicAfter, 'Private owned head projection is unchanged until COMMIT');
  };
  const exact = (expected, committed) => {
    const saved = app.repository.get(expected.runId); equalState(saved.state, expected); assert.deepEqual(saved.state.random, expected.random);
    assert.equal(saved.updatedAt, committed ? COMMIT_TIME : INITIAL_TIME); assert.equal(app.repository.activeRun(), expected.runId);
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
        app.repository.transaction(() => { app.repository.put({ state: before, updatedAt: INITIAL_TIME }); app.repository.selectRun(before.runId); });
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
      const duplicate = app.submitIntent(envelope); assert.equal(duplicate.ok, true); assert.deepEqual(duplicate.value, { ...receipt, replayed: true });
      exact(after, true); checkHead(expectedHead(after)); assert.deepEqual(rows(), pending.committedRows);
      if (after.status === 'DEAD') {
        assert.deepEqual(json(`${path}.sealed`), [after.runId]); assert.equal(publicAfter.canAct, false);
        const blocked = app.submitIntent({ ...envelope, intentId: `${envelope.intentId}:archived`, expectedRevision: after.revision, payload: { type: 'TYRANT', command: { type: 'REST' } } });
        assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED'); assert.deepEqual(rows(), pending.committedRows);
      } else {
        assert.equal(existsSync(`${path}.sealed`), false, 'SLICE_COMPLETE is not a death seal');
        if (after.status === 'SLICE_COMPLETE') assert.equal(publicAfter.canAct, false);
      }
      close(); app = open(); exact(after, true); bootstrap(publicAfter); assert.deepEqual(rows(), pending.committedRows); close(); checkpoint('VERIFIED');
    } else { assert.equal(pending.phase, 'VERIFIED'); exact(after, true); assert.deepEqual(rows(), pending.committedRows); close(); }
    return { ...transition, beforeStateSha256: input.beforeStateSha256, stateSha256: input.stateSha256, publicStateSha256: input.publicStateSha256,
      authoredPublicSha256: stateHash(authoredAfter), playerChapterSha256: stateHash(publicAfter.tyrant), random: after.random,
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
    'outputDirectory','resumeDirectory','expectedBoundaries','removeStaleLockPid','preflight','help']);
  for (const key of Object.keys(options)) assert(allowed.has(key), `Unsupported verification option ${key}`);
  assert(!(options.outputDirectory && options.resumeDirectory), 'Use one exact output directory');
  if (options.preflight !== undefined) assert.equal(typeof options.preflight,'boolean');
  assert(!options.preflight || !options.outputDirectory && !options.resumeDirectory && !options.removeStaleLockPid, 'Preflight never writes or alters a lock');
  if (options.expectedBoundaries !== undefined) assert(whole(options.expectedBoundaries) && options.expectedBoundaries > 0 && options.expectedBoundaries <= BOUNDARY_LIMIT);
  if (options.removeStaleLockPid !== undefined) assert(whole(options.removeStaleLockPid) && options.removeStaleLockPid > 0);
}
export async function verifyTyrantCapture(options) {
  assertVerifyOptions(options);
  const repo = directory(options.repo ?? process.cwd()), root = directory(options.sourceDirectory);
  assert.equal(join(repo,'scripts/play/verify-tyrant-real-saves.mjs'),SELF,'Run the verifier from its exact frozen repository');
  for (const key of ['freezeSha256', 'verifierSha256', 'inputManifestSha256']) assert(digest(options[key]), `Required reviewed ${key}`);
  assert.equal(fileEvidence(SELF).sha256, options.verifierSha256);
  const manifestPath = regular(resolve(options.inputManifest)); assert(!contains(root, manifestPath), 'Reviewed input manifest lives outside its own capture');
  assert.equal(fileEvidence(manifestPath).sha256, options.inputManifestSha256);
  const inputManifest = json(manifestPath); assertInputManifest(inspectCaptureInputs(root), inputManifest);
  const freeze = json(join(root, 'runtime-freeze.json')), runtimeFreeze = producer.inspectFreeze(repo);
  assert.equal(freeze.sha256, options.freezeSha256); assertFreeze(freeze, runtimeFreeze);
  const data = inspectCapture(root, repo, freeze);
  if (options.expectedBoundaries !== undefined) assert.equal(data.selected.length, options.expectedBoundaries, 'Unique actual transition count');
  const manifest = { format: FORMAT, databaseRetention: 'VERIFIED_COMPLETED_CASE_GZIP_V1', sourceDirectory: root, repo, inputs: inputManifest, inputManifest: fileEvidence(manifestPath),
    freeze, runtimeFreeze, historicalInputFreeze: data.inputFreeze, continuation835: data.cp.continuation835,
    producer: fileEvidence(join(repo,PRODUCER)), continuationTool: fileEvidence(join(repo,CONTINUATION_TOOL)), verifier: fileEvidence(SELF), selected: data.selected, node: process.version };
  const manifestSha256 = stateHash(manifest);
  const recheck = () => {
    assertInputManifest(inspectCaptureInputs(root), inputManifest); assertFreeze(runtimeFreeze, producer.inspectFreeze(repo));
    assert.equal(fileEvidence(SELF).sha256, options.verifierSha256);
    assert.deepEqual(fileEvidence(join(repo,CONTINUATION_TOOL)),manifest.continuationTool,'Reviewed continuation-tool changed during audit');
    for (const pin of data.inputFreeze.files) assert.deepEqual(fileEvidence(join(repo,pin.file)),{bytes:pin.bytes,sha256:pin.sha256},'Historical source changed during audit');
    assert.deepEqual(fileEvidence(manifestPath), manifest.inputManifest, 'Reviewed manifest changed during audit');
  };
  if (options.preflight) {
    recheck();
    return { preflight: 'PASSED_NO_GAME_NO_SQLITE_NO_WRITES', manifestSha256, stage: data.capture.stage,
      captureFreezeSha256: freeze.sha256, runtimeFreezeSha256: runtimeFreeze.sha256,
      naturalCaptureComplete: data.cp.terminal !== null, completedActionEvidence: data.cp.rows.length, newCommands: data.cp.commands.length, uniqueTransitions: data.selected.length, boundaryAliases: data.cp.boundaries.length - data.selected.length };
  }
  assertCaptureComplete(data.capture,data.cp);
  assert(options.outputDirectory || options.resumeDirectory, 'Choose an explicit output or resume directory');
  recheck();
  const forbidden = [root, manifestPath, ...['src', 'dist', 'scripts', 'tests', 'test-inputs', 'docs', 'node_modules', '.git'].map(file => join(repo, file))];
  const out = assertOutputPath(options.resumeDirectory ?? options.outputDirectory, forbidden);
  if (options.resumeDirectory) directory(out);
  else { if (existsSync(out)) assert.equal(readdirSync(directory(out)).length, 0, 'New output directory must be empty'); else mkdirSync(out, { recursive: true }); }
  const unlock = claimAuditLock(out, manifestSha256, options.removeStaleLockPid), manifestFile = join(out, 'manifest.json'), indexFile = join(out, 'completed.json');
  let index;
  try {
    if (options.resumeDirectory) { assertResumeManifest(json(regular(manifestFile)), manifest); recheck(); index = json(regular(indexFile)); }
    else { atomic(manifestFile, manifest); index = { manifestSha256, results: [], complete: false }; atomic(indexFile, index); }
    assertCompletedIndex(index,manifestSha256,data.selected);
    const expectedFiles = new Set(['manifest.json', 'completed.json', 'audit.lock.json', 'report.json', 'failure.json', ...data.selected.map(item => `case-${item.commandCount}`)]);
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
      const boundary = readCapture(join(root,selected.files[0])); assert.equal(result.playerChapterSha256,stateHash(boundary.public.tyrant));
      const work = join(out, `case-${result.commandCount}`), phase = json(regular(join(work, 'phase.json')));
      assert.equal(phase.phase, 'VERIFIED'); assert.equal(phase.input.manifestSha256, manifestSha256); assert.deepEqual(phase.input.transition, selected);
      assert.equal(phase.input.beforeStateSha256, result.beforeStateSha256); assert.equal(phase.input.stateSha256, result.stateSha256); assert.equal(phase.input.publicStateSha256, result.publicStateSha256);
      assert.deepEqual(phase.committedRows, result.databaseRows);
      const archive = archiveCompletedCase(work, result, indexFile);
      if (!result.databaseArchives) { result.databaseArchives = archive; atomic(indexFile, index); }
    }
    let runtime, sqlite;
    if (index.results.length < data.selected.length) {
      const modules = await Promise.all(['dist/domain/slice/index.js','dist/domain/slice/migration.js','dist/persistence/slice-store.js',
        'dist/shared/player-text.js','dist/domain/tyrant/owned-session.js'].map(file => import(pathToFileURL(join(repo,file)).href)).concat(import('node:sqlite')));
      const [slice,migration,store,playerText,session,database] = modules; sqlite = database;
      runtime = { ...slice,...migration,...store,...playerText,...session, checkOriginals: producer.checkOriginals, originalSource: data.source };
      runtime.assertValidSliceState(data.cp.state);
      const finalSession = data.cp.state.tyrant.guidanceKnown ? runtime.openTyrantRuntimeSession(data.cp.state) : null;
      if (finalSession) equalState(finalSession.snapshot(),data.cp.state);
      const finalPublic = finalSession ? finalSession.project() : runtime.projectSliceState(data.cp.state); assertGlobalPublic(finalPublic,data.cp.state);
      assert.equal(stateHash(capturePublic(finalPublic)),data.cp.publicStateSha256); assert.equal(stateHash(finalPublic),data.cp.globalPublicStateSha256);
      const initial = runtime.migrateSliceState(data.source); assert.equal(stateHash(initial),data.cp.initialStateSha256); equalState(initial,data.initial);
      assert.equal(initial.schemaVersion,212); assert.equal(initial.contentVersion,'tyrant-v212'); runtime.assertValidSliceState(initial);
      for (const [key,value] of Object.entries(data.source)) if (!['schemaVersion','contentVersion'].includes(key)) assert.deepEqual(initial[key],value,`Original701 migration preserves ${key}`);
      producer.verifyCheckpoint(data.cp,freeze,stateHash(initial),data.inputFreeze);
      const initialPublic = runtime.projectSliceState(initial); assertGlobalPublic(initialPublic,initial);
      assert.equal(stateHash(initialPublic),data.cp.initialGlobalPublicSha256); assert.equal(stateHash(capturePublic(initialPublic)),data.cp.initialPublicSha256); assert.equal(stateHash(initial.random),data.cp.initialRandomSha256);
      const first = readCapture(join(root,data.selected[0].files[0])); equalState(first.beforeLast,initial);
      // Each selected transition is checked below; the unselected tail is not replayed.
    }
    for (const transition of data.selected.slice(index.results.length)) {
      recheck(); const boundary = readCapture(join(root, transition.files[0])); assert.equal(stateHash(boundary), transition.boundarySha256);
      const result = checkSqlite(runtime, sqlite.DatabaseSync, join(out, `case-${transition.commandCount}`), manifestSha256, transition, boundary);
      recheck();
      index.results.push(result); atomic(indexFile, index);
      result.databaseArchives = archiveCompletedCase(join(out, `case-${transition.commandCount}`), result, indexFile); atomic(indexFile, index);
      console.log(JSON.stringify({ event: 'SQLITE_CASE_VERIFIED', commandCount: transition.commandCount, completed: index.results.length, total: data.selected.length })); global.gc?.();
    }
    recheck();
    assert.equal(index.results.length, data.selected.length); index.complete = true; atomic(indexFile, index);
    const report = { format: FORMAT, passed: true, complete: true, exitCode: 0, manifestSha256, stage: data.capture.stage, naturalCaptureComplete: true,
      captureFreezeSha256: freeze.sha256, runtimeFreezeSha256: runtimeFreeze.sha256, historicalInputFreezeSha256: data.inputFreeze.sha256,
      finalNaturalStatus: data.cp.state.status, finalSequence: data.cp.state.progression.sequence, tyrantPromoted: data.cp.state.progression.sequence === 0,
      deathSealsVerified: index.results.filter(row=>row.status==='DEAD').length,
      capturedCommandCount: data.cp.commandCount, retainedTailCommands: data.cp.commands.length, finalStateSha256: data.cp.finalStateSha256,
      finalChapterPublicSha256: data.cp.publicStateSha256, finalGlobalPublicSha256: data.cp.globalPublicStateSha256,
      publicProjection: 'FULL_RETAINED_CHAPTER_AND_GLOBAL_BEFORE_AFTER_EVERY_ACTION_SELECTED_SQLITE_TRANSITIONS',
      completedActionEvidence: data.cp.rows.length, completeOriginalPrefixCommands: PREFIX, originalSourceRoot: 'final',
      completedTransitions: index.results.length, selectedUniqueTransitions: data.selected.length, aliases: data.cp.boundaries.length - data.selected.length,
      original701HistoricalReplay: 'NOT_RUN', alternateSourceUsed: false, originalSchema190To212: 'EXACT_RETAINED_MIGRATION', newTailSequentialReplay: 'NOT_RUN_SELECTED_CAPTURED_TRANSITIONS_ONLY',
      continuation835: data.cp.continuation835, producerVersion: 'FIXED_COOLDOWN_V2_AFTER835', rebuild: 'NEW215', lostOriginal215Restored: false, rebuiltFromRestoredVolume193: true, syntheticTransitions: 'NONE', retainedDatabases: 'LOSSLESS_GZIP_ORIGINAL_AND_COMPRESSED_SHA256', restoreDatabase: 'gunzip -c case.sqlite.gz > restored.sqlite', desktop: 'NOT_RUN', results: index.results };
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
    '--output-directory': 'outputDirectory', '--resume-directory': 'resumeDirectory', '--expected-boundaries': 'expectedBoundaries', '--remove-stale-lock-pid': 'removeStaleLockPid' };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]; assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--preflight' || flag === '--help') { result[flag.slice(2)] = true; continue; }
    const key = fields[flag]; assert(key, `Unsupported ${flag}`); const value = args[++i]; assert(value && !value.startsWith('--'), `Missing value for ${flag}`);
    if (key === 'expectedBoundaries' || key === 'removeStaleLockPid') { assert(/^[1-9]\d*$/.test(value)); result[key] = Number(value); assert(Number.isSafeInteger(result[key])); }
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
    if (options.help) console.log('node --expose-gc scripts/play/verify-tyrant-real-saves.mjs --source-directory CAPTURE --input-manifest EXTERNAL_MANIFEST --input-manifest-sha256 SHA --freeze-sha256 SHA --verifier-sha256 SHA [--preflight | --output-directory EMPTY_NEW_DIR | --resume-directory SAME_DIR] [--expected-boundaries N] [--remove-stale-lock-pid DEAD_PID]. Prepare and review the external manifest using exported inspectCaptureInputs(CAPTURE), then pin its exact SHA. Use only the quiescent NEW215 restored193/living701 capture continued from the exact pinned835 boundary by the fixed reviewed cooldown-v2 producer. Product source/runtime, all134 inherited action receipts and original fixed seed stay exact; only the explicitly checked producer freeze row changes from V1. The complete predecessor835 subtree and continuation manifest/tool are pinned. Captured script copies are never imported or executed. No build or game execution occurs in preflight. Paused/diagnostic/pending captures cannot become complete SQLite results. Each of all producer-selected unique boundaries (maximum64), including S1 recovery and genuine death if present, receives beforeWrite and COMMIT rollback, exact same-intent retry, private/RNG/chapter-public/global-public equality, reopen and duplicate checks. Durable completed-index and case phases govern resume; an already-COMMITTED case is checked before any duplicate-only submission. Completed script-created DB/bak/seal bytes are losslessly gzip-retained with original and packed hashes and exact round-trip verification before retiring only those raw duplicates; unfinished raw evidence stays. Restore to a NEW destination with gunzip -c case.sqlite.gz > restored.sqlite. No historical701 replay, unselected-tail sequential replay, lost-original215 restoration, desktop proof or natural success is claimed. Unknown artifacts and live locks stop without cleanup.');
    else { const report = await verifyTyrantCapture(options); console.log(JSON.stringify(options.preflight ? report : { passed: report.passed, complete: report.complete, exitCode: 0, completedTransitions: report.completedTransitions, selectedUniqueTransitions: report.selectedUniqueTransitions })); }
  } catch (error) { console.error(JSON.stringify({ passed: false, complete: false, exitCode: 1, error: String(error) })); process.exitCode = 1; }
}
