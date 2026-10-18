import assert from 'node:assert/strict';
import { constants, closeSync, copyFileSync, existsSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import * as v1 from './tyrant-stage.mjs';
import * as v2 from './tyrant-stage-cooldown-v2.mjs';

/** One-time, exact835 metadata handoff. This tool never imports the game,
 * dispatches an action, rewrites the predecessor, or consumes a random draw. */
const SELF = fileURLToPath(import.meta.url);
const FORMAT = 'NEW215_REVIEWED_EXACT835_CONTINUATION_MANIFEST_V1';
const shaPattern = /^[a-f0-9]{64}$/;
export function parseContinuationOptions(args) {
  const result = { source: null, out: null, auditOnly: false, producerSha256: null, toolSha256: null }, seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]; assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--audit-only') { result.auditOnly = true; continue; }
    const value = args[++index]; assert(value !== undefined, `Missing ${flag}`);
    if (flag === '--source') result.source = resolve(value);
    else if (flag === '--out') result.out = resolve(value);
    else if (flag === '--producer-sha256') { assert(shaPattern.test(value)); result.producerSha256 = value; }
    else if (flag === '--tool-sha256') { assert(shaPattern.test(value)); result.toolSha256 = value; }
    else throw Error(`Unsupported ${flag}; no state, seed, resources, outcome or source-hash override`);
  }
  assert(result.source && result.producerSha256 && result.toolSha256, 'Exact source and both reviewed code hashes are required');
  assert(result.auditOnly || result.out, 'A fresh output directory is required');
  if (result.out) {
    assert(result.source !== result.out && !result.out.startsWith(result.source + sep) && !result.source.startsWith(result.out + sep), 'Source and output must be disjoint');
    assert(!existsSync(result.out), 'Never overwrite a continuation or original directory');
  }
  return result;
}
function syncDirectory(path) { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } }
function createFile(path, bytes) { const fd = openSync(path, 'wx'); try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); } }
function copyFile(source, target) {
  copyFileSync(source, target, constants.COPYFILE_EXCL);
  const fd = openSync(target, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
}
const directoryEvidence = directory => readdirSync(directory).sort().map(file => {
  assert(/^[A-Za-z0-9.-]+$/.test(file), 'Unexpected predecessor filename');
  return { file, ...v1.fileEvidence(join(directory, file)) };
});

export function audit835Source(source, root, expectedProducer, expectedTool) {
  assert.equal(v1.fileEvidence(join(root, 'scripts/play/tyrant-stage.mjs')).sha256, v2.CONTINUATION_835.producerSha256);
  const producerPath = join(root, 'scripts/play/tyrant-stage-cooldown-v2.mjs'), producer = v2.fileEvidence(producerPath), tool = v2.fileEvidence(SELF);
  assert.equal(producer.sha256, expectedProducer, 'Unreviewed V2 producer bytes');
  assert.equal(tool.sha256, expectedTool, 'Unreviewed one-time handoff tool bytes');
  const predecessorFiles = directoryEvidence(source), checkpointPath = join(source, 'checkpoint.json.gz');
  assert.equal(predecessorFiles.length, 145, 'Exact835 capture file set changed');
  const predecessor = v1.decodeCheckpoint(readFileSync(checkpointPath));
  v2.assert835Predecessor(predecessor, v1.fileEvidence(checkpointPath));
  assert.equal(v1.fileEvidence(join(source, 'producer.mjs')).sha256, v2.CONTINUATION_835.producerSha256);
  assert.equal(v1.fileEvidence(join(source, 'runtime-freeze.json')).sha256, v2.CONTINUATION_835.runtimeFreezeFileSha256);
  const beforeFreeze = v1.readCapture(join(source, 'runtime-freeze.json')), afterFreeze = v2.inspectFreeze(root);
  assert.deepEqual(v1.inspectFreeze(root), beforeFreeze, 'Original V1 runtime changed before handoff');
  v2.assertOnlyProducerFreezeChanged(beforeFreeze, afterFreeze, producer);
  const inputs = v1.readSource(root), inputFreeze = v1.readCapture(join(source, 'input-freeze.json'));
  assert.deepEqual(inputs.inputFreeze, inputFreeze);
  v1.verifyCheckpoint(predecessor.payload, beforeFreeze, predecessor.payload.initialStateSha256, inputFreeze);
  assert.deepEqual(v1.readCapture(join(source, 'archived-original701.json.gz')), JSON.parse(inputs.buffers[0].toString('utf8')));
  assert.deepEqual(v1.readCapture(join(source, 'archived-original193-natural.json.gz')), JSON.parse(inputs.buffers[1].toString('utf8')));
  for (const row of predecessor.payload.rows) {
    const path = join(source, row.capture.file);
    assert.deepEqual(v1.fileEvidence(path), { bytes: row.capture.bytes, sha256: row.capture.sha256 });
    const capture = v1.readCapture(path);
    v1.verifyActionCapture(capture, row); v2.verifyActionCapture(capture, row);
    assert.deepEqual(v2.chooseAction(capture.publicBefore, capture.policyBefore), v1.chooseAction(capture.publicBefore, capture.policyBefore), 'V2 changes an inherited policy decision');
  }
  const summary = v1.readCapture(join(source, 'summary.json')), last = v1.readCapture(join(source, 'action-835.json.gz'));
  assert.equal(summary.stage, 'PUBLIC_ACTION_BLOCKED'); assert.equal(summary.commands, 835); assert.equal(summary.strictFinalValidation, true);
  assert.deepEqual(summary.public, last.public); assert.equal(v1.stateHash(summary.public), predecessor.payload.publicStateSha256);
  assert.deepEqual(last.final, predecessor.payload.state);
  const natural = v1.readCapture(join(source, 'natural.json.gz'));
  assert.deepEqual(natural.final, predecessor.payload.state);
  assert.deepEqual(natural.commands, [...inputs.commands, ...predecessor.payload.commands]);
  assert.deepEqual(natural.policy, v1.POLICY); assert.equal(natural.stage, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(natural.provenance.runtimeFreezeSha256, beforeFreeze.sha256);
  assert.equal(natural.provenance.lostOriginal215Restored, false);
  const beforeDecision = v1.chooseAction(last.public, predecessor.payload.policy), afterDecision = v2.chooseAction(last.public, predecessor.payload.policy);
  assert.equal(beforeDecision.stop, 'PUBLIC_ACTION_BLOCKED');
  assert(v2.isExactCoastPermissionCooldown(last.public.tyrant.actions.find(a => a.preferredAction)));
  assert.equal(afterDecision.stop, undefined); assert(v2.publicActionStillAvailable(last.public, afterDecision.action));
  assert(['WORK','NEXT_WEEK'].includes(afterDecision.action.intent.command.type), 'Only existing actual budget/wait may follow835');
  assert.deepEqual(directoryEvidence(source), predecessorFiles, 'Original directory changed during readonly audit');
  return { predecessor, predecessorFiles, beforeFreeze, afterFreeze, inputFreeze, producerPath, producer, tool, afterDecision };
}

export function build835Payload(predecessor, freeze, proof) {
  const payload = { ...structuredClone(predecessor.payload), runtimeFreezeSha256: freeze.sha256,
    policyDefinition: v2.POLICY, continuation835: proof, predecessorSha256: predecessor.sha256 };
  v2.assert835InheritedPayload(payload, predecessor.payload);
  return payload;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseContinuationOptions(args), root = process.cwd();
  assert.equal(resolve(root, 'scripts/play/tyrant-stage-continue-835.mjs'), SELF, 'Run only the fixed reviewed handoff tool');
  if (options.out) for (const name of ['src','dist','scripts','tests','test-inputs','docs','node_modules','.git']) {
    const protectedPath = join(root, name);
    assert(options.out !== root && options.out !== protectedPath && !options.out.startsWith(protectedPath + sep), 'Output cannot overwrite frozen inputs');
  }
  const audit = audit835Source(options.source, root, options.producerSha256, options.toolSha256);
  const { predecessor, predecessorFiles, afterFreeze, inputFreeze, producer, tool } = audit;
  if (options.auditOnly) {
    const result = { stage: 'EXACT835_READONLY_AUDIT_PASSED', inheritedCommands: 134, fullStateSha256: predecessor.payload.finalStateSha256,
      oldRuntimeFreezeSha256: audit.beforeFreeze.sha256, newRuntimeFreezeSha256: afterFreeze.sha256, producer, tool,
      nextPublicAction: audit.afterDecision.action.intent };
    console.log(JSON.stringify(result)); return result;
  }
  const proof = { format: FORMAT, anchor: v2.CONTINUATION_835, createdAt: new Date().toISOString(),
    firstPossibleNewCommand: 836, inheritedCommandsVerifiedByBothPolicies: 134, oldOutcomesRetained: true, runtimeRulesChanged: false,
    change: v2.POLICY.cooldown, predecessorDirectory: 'predecessor-835', predecessorFiles,
    predecessorFilesSha256: v2.stateHash(predecessorFiles), newRuntimeFreezeSha256: afterFreeze.sha256, producer, tool };
  const payload = build835Payload(predecessor, afterFreeze, proof);
  v2.verifyCheckpoint(payload, afterFreeze, predecessor.payload.initialStateSha256, inputFreeze);
  const staging = `${options.out}.staging-${process.pid}`;
  assert(!existsSync(staging), 'Preserve an existing interrupted handoff for review');
  mkdirSync(dirname(options.out), { recursive: true }); mkdirSync(staging);
  const archive = join(staging, 'predecessor-835'); mkdirSync(archive);
  for (const file of predecessorFiles) copyFile(join(options.source, file.file), join(archive, file.file));
  // Links are created from the independent archived copies, never the original
  // source inodes. Parent835 directory contents and metadata stay untouched.
  for (const file of predecessorFiles) if (/^action-\d+\.json\.gz$/.test(file.file) ||
    ['archived-original701.json.gz','archived-original193-natural.json.gz','migration-initial.json.gz','input-freeze.json'].includes(file.file))
    linkSync(join(archive, file.file), join(staging, file.file));
  for (const file of ['commands.ndjson.gz','boundaries.index.json']) copyFile(join(archive, file), join(staging, file));
  createFile(join(staging, 'runtime-freeze.json'), JSON.stringify(afterFreeze));
  createFile(join(staging, 'producer.mjs'), readFileSync(audit.producerPath));
  createFile(join(staging, 'continuation-tool.mjs'), readFileSync(SELF));
  createFile(join(staging, 'continuation-835.json'), JSON.stringify(proof));
  createFile(join(staging, 'checkpoint.json.gz'), gzipSync(v2.encodeCheckpoint(payload), { level: 6 }));
  const reason = 'Metadata-only reviewed continuation from exact835; no new action or random draw has occurred';
  const natural = v1.readCapture(join(archive, 'natural.json.gz'));
  natural.provenance = { ...natural.provenance, format: 'NEW215_REBUILD_PROVENANCE_COOLDOWN_V2', runtimeFreezeSha256: afterFreeze.sha256, continuation835: proof };
  natural.policy = v2.POLICY; natural.stage = 'MANUAL_PAUSE'; natural.reason = reason;
  createFile(join(staging, 'natural.json.gz'), gzipSync(JSON.stringify(natural), { level: 6 }));
  const summary = v1.readCapture(join(archive, 'summary.json'));
  createFile(join(staging, 'summary.json'), JSON.stringify({ ...summary, stage: 'MANUAL_PAUSE', reason, paused: true, diagnostic: false, controlledStop: true, continuation835: proof }));
  syncDirectory(archive); syncDirectory(staging);
  v2.verify835Continuation(staging, payload, afterFreeze);
  assert.deepEqual(directoryEvidence(options.source), predecessorFiles, 'Original835 source changed during handoff');
  assert.deepEqual(v2.inspectFreeze(root), afterFreeze, 'Frozen bytes changed during handoff');
  renameSync(staging, options.out); syncDirectory(dirname(options.out));
  const result = { stage: 'EXACT835_METADATA_HANDOFF_COMPLETE_NO_ACTIONS', outputDir: options.out, commands: 835,
    checkpoint: v2.fileEvidence(join(options.out, 'checkpoint.json.gz')), fullStateSha256: payload.finalStateSha256,
    runtimeFreezeSha256: afterFreeze.sha256, random: payload.state.random, nextStep: 'Run the fixed V2 producer --resume with --max-new-actions 0 before any real action' };
  console.log(JSON.stringify(result)); return result;
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
