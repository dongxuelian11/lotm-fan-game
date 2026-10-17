import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

/** Static producer. Importing this file does not import or run the game.
 * Run ONLY after source, mechanics, this policy and compiled bytes are frozen:
 *   node scripts/play/red-priest-stage.mjs --out output/play/red-priest-natural
 *   node scripts/play/red-priest-stage.mjs --resume <out>/checkpoint.json
 *   node scripts/play/red-priest-stage.mjs --continue-from <original-out> --out <new-out>
 * --max-new N pauses after N newly committed actions in this invocation. It is
 * an operator pause, never a failed game rule or permission to change strategy.
 *
 * Original source bytes and all 795 commands are immutable. We migrate its exact
 * living final, rather than replaying/replacing its historical natural capture.
 * A separate historical full replay is required to audit that original prefix.
 *
 * Only public projections enter chooseAction(). Private snapshots/RNG are for
 * validation and durable audit, never decision-making. No preview/discard/search
 * for a favorable result; the single selected enabled action is always committed.
 *
 * checkpoint.json is the ONLY action-boundary authority. It contains one full
 * current state plus all new commands and small audit rows. commands.ndjson is
 * derived from it, not a second commit log. A pending boundary is saved BEFORE
 * prepare. After interruption its exact command is completed with the same
 * frozen state/runtime, even if its outcome is negative. A complete .next is
 * adopted before resume; an incomplete .next is retained for inspection.
 * Disk errors preserve the last durable checkpoint and never cause a new choice.
 */
export const SOURCE = 'tests/fixtures/conqueror-v01870/natural.json';
export const SOURCE_SHA256 = '469a6ac77052f92ac0dbd8e6ea39164592de6b4c8d8ea0405b080c1a015f7973';
export const PREFIX_SHA256 = '88211e592c4714058c3e8b45eab02fa0f0ae73b35c2526288503329ec1d52f2e';
export const PREFIX_COUNT = 795;
const FORMAT = 'RED_PRIEST_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
const SELF = fileURLToPath(import.meta.url);
export const POLICY = Object.freeze({
  id: 'RED_PRIEST_ORIGINAL_PUBLIC_FINITE_V1',
  maximumNewCommands: 900, attemptsPerMaterialOperation: 6,
  authorityAttemptsPerPolity: 5, battleAttemptsPerNode: 4, armisticeAttempts: 5,
  maximumSupportCommandsWithoutProgress: 70, maximumUnchangedWeeklyWaits: 4,
  cashBeforeDeclaration: 1600, preparationHealth: 100,
  preparationMind: 100, preparationSpirituality: 120,
  materialOrder: 'LOCAL_WORK_BEFORE_FIRST_PUBLIC_MATERIAL_DESTINATION',
  warOrder: 'COALITION_THEN_REAL_MARCH_BATTLE_CONSOLIDATE_THEN_ACHIEVED_TRUCE',
  recovery: 'ENABLED_CLINIC_REST_WORK_MILITARY_LABOUR_AND_REAL_NEXT_WEEK_ONLY',
  rescue: 'REAL_RETURN_ROUTE_THEN_COORDINATE_ONCE_THEN_EVACUATE_OR_WITHDRAW_AND_REPORT; FLAME_ONLY_IF_AN_EXTRA_ACTION_REMAINS_AFTER_RESCUE',
  noReroll: true, snapshots: 'ONE_ROLLING_CHECKPOINT_AND_FINAL_CAPTURE_ONLY',
});
// Explicitly approved continuation of the actual living 836-command boundary.
// This raises only the cumulative material-attempt cap; the old six attempts,
// their draws, losses, wages and all other commands remain part of this run.
export const CONTINUATION_POLICY = Object.freeze({ ...POLICY, attemptsPerMaterialOperation: 12 });
export const CONTINUATION = Object.freeze({
  format: 'RED_PRIEST_APPROVED_EXACT_836_CONTINUATION_V1', commandCount: 836,
  checkpointPayloadSha256: '1e12bab7df3acdae9717e68f84cf2b4e2a95433437470ef5363a0a11c7478180',
  policyStateSha256: 'afc9f285472bfe3f0ef205cce4e3f188e9c77c82b6fe51cbca7f2e42f98f5844',
  terminal: { stage: 'FINITE_MATERIAL_ATTEMPTS', reason: 'Finite attempts exhausted for 净化已核验原残余' },
  stateSha256: 'ce66e5141b397cc89ef843a225d43f9cd5e04895fabdcdf9ecf520d58defd0a7',
  publicSha256: '19c8038ab331415db672c9efce5335f7f840f03a9d50771847cd09d4c7473189',
  freezeSha256: '2d833ab92f7ca3ca5ffc7ada05d8f0b62f5538b9d73c3533c2a5cac8256e43f0',
  producer: { file: '$natural-producer', bytes: 41116, sha256: '1624ea7cd4cf7cfff738755a1d19a1b3bde2b041420828656be5df9aee79b7a3' },
  originalFiles: [
    { file: 'checkpoint.json', bytes: 1994679, sha256: '42548cdae14c82d40c066524d4e560d57597259b2914f949b99f572881fc24fd' },
    { file: 'commands.ndjson', bytes: 37130, sha256: '7b4ca7fff4db7e24d7a882705d87e5c91138332f60427cf0dc37ef5ea7705247' },
    { file: 'freeze.json', bytes: 549730, sha256: 'bc155d14878f26516e7c27e4248174b70c50c24b3713f1ee3db20688606ee11b' },
    { file: 'natural.json', bytes: 3999700, sha256: '299852d1d271e33531db5456a60797c81cd43ca21a51df6ea72c64870a3ce988' },
    { file: 'summary.json', bytes: 8904, sha256: 'ef0e44a4b747e608f91788d226cd95f4a1f75434680f85294499c0f22c513607' },
  ],
});
const ORIGINAL_PRODUCER_ARCHIVE = 'output/play/red-priest-02090-original.producer.mjs';
export const AUTHORITY_CONTINUATION_POLICY = Object.freeze({ ...CONTINUATION_POLICY, authorityAttemptsPerPolity: 12 });
export const AUTHORITY_CONTINUATION = Object.freeze({
  format: 'RED_PRIEST_APPROVED_EXACT_915_CONTINUATION_V1', commandCount: 915,
  checkpointPayloadSha256: 'cf768632559c637fb2bafc94385eb6e3b141311bc218850776077e010280dea5',
  policyStateSha256: '53fe8c9290ad29304ce04e894cd6ac5f7c8b837079c74ebb393856a53f3d7dd1',
  terminal: { stage: 'FINITE_AUTHORITY_ATTEMPTS', reason: 'Actual coalition permission was not obtained within the finite public policy' },
  stateSha256: '040db02f43169b0e913c77c1adb39fff31293a2947f9d90c8fea06b61b7ecd4a',
  publicSha256: '4b9777b46c624336024dfa8472a677757fd5dedba887dbab588f296c9fd6cb70',
  freezeSha256: 'be967f07d9a912627b5c21fb1746247b4d2ba3797ee1dce532108748e1eeb11e',
  producer: { file: '$natural-producer', bytes: 52076, sha256: 'fa5afd4e7c6b6263d452d3aa59c34a43252d80b9269f851c7b1e7081f986ae02' },
  originalFiles: [
    { file: 'checkpoint.json', bytes: 2827692, sha256: '34b88f24f49b8977e8445d6b4b79c2213ca622e598054980b7ada3c663780beb' },
    { file: 'commands.ndjson', bytes: 107858, sha256: '9c7895aeba9c4e210fb1c4842a6aee29758a4972e3bf1a4aabcc6e2f7b055f55' },
    { file: 'freeze.json', bytes: 549730, sha256: '2f4779ed6fe48f8a1b5f11bfae7378160bba6eeff29eb95e136860230f0850a1' },
    { file: 'natural.json', bytes: 4760983, sha256: 'de517f04ce6eec4e1c33f0b9678c478867d556d0923100708cd6fffc3caa4da1' },
    { file: 'summary.json', bytes: 8957, sha256: '0fbe1a19830227cb35fbcfa0bd8db3ad987253cbe541bd4fb106535712cb7dca' },
  ],
});
export const LOGISTICS_CONTINUATION_POLICY = Object.freeze({ ...AUTHORITY_CONTINUATION_POLICY, logisticsRecovery: true });
export const LOGISTICS_CONTINUATION = Object.freeze({
  format: 'RED_PRIEST_APPROVED_EXACT_941_LOGISTICS_CONTINUATION_V1', commandCount: 941,
  checkpointPayloadSha256: 'cf1675b04822d635b46931f1d5ff9b84c85b5279e080b670070f0cbb989834dd',
  policyStateSha256: 'd84ddb3e627b7633e6bad677fce5422b0d4a1a604a8029e728da1931ee7e0f7a',
  terminal: { stage: 'FINITE_PUBLIC_NO_PROGRESS', reason: 'Finite recovery limit reached: Recover actual resources for 在灰脊北关执行会战' },
  stateSha256: '5e92f155fbeadf38dd22722831489bf7176865858b58d3254e1025725bfe1751',
  publicSha256: '86f1b384408032f77881fd95db91a22c36079cdd45fce3c57901047e4cda09f0',
  freezeSha256: '4fd9123b33f55edd661b3155b4cd645c46f2d8ee5f7c5b69c76bdb777e73cb62',
  producer: { file: '$natural-producer', bytes: 55887, sha256: '4811bb5c3b801c1b45a582a825094f4fb3ee9a43191baa4a5be4dc4279f47f65' },
  originalFiles: [
    { file: 'checkpoint.json', bytes: 3151328, sha256: '287f4290b38649d7d90a1c87a9ee38c7e73dda40b5f2ca2c1621f873d286ee4f' },
    { file: 'commands.ndjson', bytes: 130732, sha256: '4c9c8b2952d881c87c3595edc7d43b29e8a032fe18fe3b997475bf8d726521fe' },
    { file: 'freeze.json', bytes: 549730, sha256: '842f0c30841178918294ebba9ebed4f76d907a4fc8c33fe2ed8b4e77ba047935' },
    { file: 'natural.json', bytes: 5061123, sha256: '990b93bddb1374f35da9d5de2761eeb6867379d469f8e2edc8ae94ffbac0b71e' },
    { file: 'summary.json', bytes: 9038, sha256: '2971902254edec100b6f0fe08595d675a69a9f17d6c523ffe65f351d72731db3' },
  ],
});
// Pins the independent frozen-runtime proof: all 146 historical commands retain
// exact private state/RNG; public projection only appends the logistics action.
export const LOGISTICS_TRANSITION_SHA256 = '3dbc170abff8c7310dd384677469a19d9f9e217a0653dfe8d6a78a18587b4b66';
export const LOGISTICS_CHANGED_FILES = Object.freeze(['src/domain/red-priest/campaign.ts', 'src/domain/red-priest/index.ts',
  'dist/domain/red-priest/campaign.js', 'dist/domain/red-priest/campaign.js.map', 'dist/domain/red-priest/index.js', 'dist/domain/red-priest/index.js.map']);
const LOGISTICS_PROOF_SOURCE = 'output/qa-0209/logistics-equivalence/proof.json';
export const RESTORATION_CONTINUATION_POLICY = Object.freeze({ ...LOGISTICS_CONTINUATION_POLICY, fieldArmyRecovery: true, finiteSupplyRecovery: true, postwarFootReturn: true,
  verifiedPersonnelExit: '现有人员已经不足以完成剩余目标。继续交战不能补回损失，可以真实停战或保护撤离。' });
export const RESTORATION_CONTINUATION = Object.freeze({
  "format": "RED_PRIEST_APPROVED_EXACT_974_FIELD_ARMY_CONTINUATION_V1",
  "commandCount": 974,
  "checkpointPayloadSha256": "020a3b8e3cc38e071b01b20c94a74bf60ce240019787091e3a624443b2e08e8e",
  "policyStateSha256": "a6d727a990575227544231fe1bbd77770cfdba89f36dcffb550225b13ed7311b",
  "terminal": {
    "stage": "FINITE_CAMPAIGN_REVIEW_REQUIRED",
    "reason": "No enabled forward route, objective or finite reinforcement remains"
  },
  "stateSha256": "47b56cc7d857dd18d157628b55fb6de56fcb7d5b4c4097b34aa0a42df1a0d73a",
  "publicSha256": "89b59e830d4ca6bdfee64c6edc990fa8ea032b0ae553c313880679ef5ee7f3c4",
  "freezeSha256": "bc9ab45457e5173f3b72adf6585c19d233f6b79b1be5f165981dd44e8b90d5f9",
  "producer": {
    "file": "$natural-producer",
    "bytes": 65014,
    "sha256": "e6fc50ac046b9634870989968558cd21efcbbb7154caf86b15f54fcb963f445f"
  },
  "originalFiles": [
    {
      "file": "checkpoint.json",
      "bytes": 3553388,
      "sha256": "ea1d6d03ef8f129ea5c0d14300cd3dbe88a4a20c4d506b729443e54242089ec6"
    },
    {
      "file": "commands.ndjson",
      "bytes": 160040,
      "sha256": "f3c77f0a870584e2284cdf058b30d5a1171857611cfc3152a386f83dd3b895a7"
    },
    {
      "file": "freeze.json",
      "bytes": 549730,
      "sha256": "ef2df8da7cbfdb298ff2dfa5f13db5d8f8ad82f3a3e8017cbdac90a5a1e7eb59"
    },
    {
      "file": "natural.json",
      "bytes": 5433797,
      "sha256": "f8017e64be594512cce88c7c2c2ff0e25a001fa4943e15a1880ea9f034e1d7e3"
    },
    {
      "file": "summary.json",
      "bytes": 9030,
      "sha256": "2a981d763de851b399f26064330eb2b8fe1c4aa4a13c3124ab706fe971ae311a"
    }
  ]
});
export const RESTORATION_TRANSITION_SHA256 = 'c5fa12707cde98bba0a775475d274c369f68267fe5d2991e5a04acaabb3ad201';
// Diagnostic filter-operation count, not the number of replayed commands.
export const RESTORATION_PROJECTION_CHECKS = 382;
export const RESTORATION_CHANGED_FILES = Object.freeze(["src/domain/red-priest/campaign.ts","src/domain/red-priest/engine.ts","src/domain/red-priest/index.ts","src/domain/red-priest/types.ts","src/renderer/RedPriestPanel.tsx","src/renderer/SliceApp.tsx","dist/domain/red-priest/campaign.js","dist/domain/red-priest/campaign.js.map","dist/domain/red-priest/engine.js","dist/domain/red-priest/engine.js.map","dist/domain/red-priest/index.js","dist/domain/red-priest/index.js.map"]);
function transitionDefinition(commandCount) {
  if (commandCount === 941) return { sha256: LOGISTICS_TRANSITION_SHA256, files: LOGISTICS_CHANGED_FILES,
    format: 'RED_PRIEST941_LOGISTICS_TRANSITION_V1', projectionChecks: 18, difference: 'Only appended RETURN_TO_HEADQUARTERS action', cursor: 425,
    proofSource: LOGISTICS_PROOF_SOURCE, beforeSource: 'output/qa-0209/pre-logistics' };
  assert.equal(commandCount, 974, 'Only the two exact runtime transitions are supported');
  return { sha256: RESTORATION_TRANSITION_SHA256, files: RESTORATION_CHANGED_FILES,
    format: 'RED_PRIEST974_FIELD_ARMY_TRANSITION_V1', projectionChecks: RESTORATION_PROJECTION_CHECKS, difference: 'Only appended recovery actions and campaign-readiness section; historical RETURN_TO_HEADQUARTERS projection preserved', cursor: 426,
    proofSource: 'output/qa-0209/headquarters-rest-equivalence/proof.json', beforeSource: 'output/qa-0209/pre-headquarters-rest' };
}
function readRuntimeTransition(path, rows, pin) {
  const definition = transitionDefinition(pin.commandCount), count = pin.commandCount - PREFIX_COUNT;
  const bytes = readFileSync(path); assert.equal(sha(bytes), definition.sha256, 'The exact independently verified runtime transition proof is required');
  const proof = JSON.parse(bytes);
  assert.equal(proof.format, definition.format); assert.equal(proof.commandCount, pin.commandCount);
  assert.equal(proof.originalFreezeSha256, pin.freezeSha256);
  assert.equal(proof.stateSha256, pin.stateSha256); assert.equal(proof.originalPublicSha256, pin.publicSha256);
  assert.deepEqual(proof.random, { seed: 'hunter-rebuild-first', cursor: definition.cursor });
  assert.deepEqual(proof.changedFiles.map(file => file.file), definition.files);
  assert.equal(proof.checkpointSha256, pin.originalFiles.find(file => file.file === 'checkpoint.json').sha256);
  assert.equal(proof.replay.commands, count); assert.equal(proof.replay.first, 796); assert.equal(proof.replay.last, pin.commandCount);
  assert.equal(proof.replay.allPrivateAndRngEqual, true); assert.equal(proof.replay.publicDifference, definition.difference);
  assert.equal(proof.replay.addedProjectionChecks, definition.projectionChecks);
  assert(Number.isSafeInteger(proof.replay.addedProjectionChecks) && proof.replay.addedProjectionChecks >= 0 && proof.replay.addedProjectionChecks <= 10 * count + 10);
  assert.equal(proof.replay.rows.length, count); assert.equal(rows.length, count);
  for (const [index, check] of proof.replay.rows.entries()) {
    const row = rows[index]; assert.equal(check.commandCount, row.commandCount); assert.equal(check.stateSha256, row.afterStateSha256);
    assert.deepEqual(check.random, row.randomAfter); assert.equal(check.capturedPublicSha256, row.publicAfterSha256);
    assert.match(check.publicSha256, /^[a-f0-9]{64}$/);
    if (pin.commandCount === 974) {
      assert.match(check.priorRuntimePublicSha256, /^[a-f0-9]{64}$/);
      if (row.commandCount > 941) assert.equal(check.priorRuntimePublicSha256, row.publicAfterSha256);
    }
  }
  assert.equal(proof.replay.rows.at(-1).publicSha256, proof.continuedPublicSha256);
  assert.notEqual(proof.continuedPublicSha256, proof.originalPublicSha256);
  return { bytes, proof };
}
function previousFreezeFiles(freeze, pin, transition = null) {
  assert.equal(transition !== null, [941, 974].includes(pin.commandCount), 'Runtime changes are allowed only at the exact reviewed boundaries');
  if (transition) for (const file of transitionDefinition(pin.commandCount).files) assert(freeze.files.some(entry => entry.file === file));
  return freeze.files.map(file => {
    if (file.file === '$natural-producer') return pin.producer;
    const change = transition?.changedFiles.find(change => change.file === file.file);
    if (!change) return file;
    assert.deepEqual({ bytes: file.bytes, sha256: file.sha256 }, change.after, `Unapproved runtime bytes: ${file.file}`);
    return { file: file.file, ...change.before };
  });
}
function continuationDefinition(commandCount) {
  if (commandCount === 836) return { pin: CONTINUATION, previousPolicy: POLICY, nextPolicy: CONTINUATION_POLICY, cursor: 392, archive: ORIGINAL_PRODUCER_ARCHIVE };
  if (commandCount === 915) return { pin: AUTHORITY_CONTINUATION, previousPolicy: CONTINUATION_POLICY, nextPolicy: AUTHORITY_CONTINUATION_POLICY, cursor: 420,
    archive: 'output/play/red-priest-02090-continued.producer.mjs' };
  if (commandCount === 941) return { pin: LOGISTICS_CONTINUATION, previousPolicy: AUTHORITY_CONTINUATION_POLICY, nextPolicy: LOGISTICS_CONTINUATION_POLICY, cursor: 425,
    archive: 'output/play/red-priest-02090-authority.producer.mjs' };
  assert.equal(commandCount, 974, 'Only the four exact reviewed observation boundaries may be continued');
  return { pin: RESTORATION_CONTINUATION, previousPolicy: LOGISTICS_CONTINUATION_POLICY, nextPolicy: RESTORATION_CONTINUATION_POLICY, cursor: 426,
    archive: 'output/play/red-priest-02090-logistics.producer.mjs' };
}
const clone = value => structuredClone(value);
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const sha = value => createHash('sha256').update(value).digest('hex');
export const stateHash = value => sha(stable(value));
const compactHash = value => sha(JSON.stringify(value));
export function fileEvidence(path) {
  const before = lstatSync(path, { bigint: true });
  assert(before.isFile() && !before.isSymbolicLink(), `Not a frozen regular file: ${path}`);
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(65536);
  let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; hash.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  const after = lstatSync(path, { bigint: true });
  assert.equal(before.size, after.size); assert.equal(before.mtimeNs, after.mtimeNs); assert.equal(BigInt(bytes), after.size);
  return { bytes, sha256: hash.digest('hex') };
}
export function inspectFreeze(root = process.cwd()) {
  const files = [];
  const walk = name => {
    const path = join(root, name), stat = lstatSync(path);
    assert(!stat.isSymbolicLink(), `Frozen input cannot be a symlink: ${name}`);
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(join(name, child));
    else if (stat.isFile()) files.push({ file: name.split(sep).join('/'), ...fileEvidence(path) });
  };
  assert(existsSync(join(root, 'dist/domain/red-priest/owned-session.js')), 'Build reviewed mechanics before capture; no game was loaded');
  for (const name of ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation']) walk(name);
  files.push({ file: '$natural-producer', ...fileEvidence(SELF) }, { file: SOURCE, ...fileEvidence(join(root, SOURCE)) });
  return { sha256: compactHash(files), files };
}
function stampFreeze(root, freeze) {
  return freeze.files.map(file => {
    const path = file.file === '$natural-producer' ? SELF : join(root, file.file), stat = lstatSync(path, { bigint: true });
    return { path, size: stat.size, mtimeNs: stat.mtimeNs, ctimeNs: stat.ctimeNs, ino: stat.ino };
  });
}
function unchangedSinceFreeze(stamps) {
  for (const before of stamps) {
    const after = lstatSync(before.path, { bigint: true });
    assert(after.isFile() && !after.isSymbolicLink(), `Frozen input replaced: ${before.path}`);
    for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(after[key], before[key], `Frozen input changed: ${before.path}`);
  }
}
export function readSource(root = process.cwd()) {
  const path = join(root, SOURCE), bytes = readFileSync(path);
  assert.equal(sha(bytes), SOURCE_SHA256, 'Original natural capture bytes have changed; do not regenerate/replace them');
  const old = JSON.parse(bytes), s = old.final;
  assert.equal(old.commands.length, PREFIX_COUNT); assert.equal(compactHash(old.commands), PREFIX_SHA256);
  assert.equal(old.seed, 'hunter-rebuild-first'); assert.equal(s.runId, 'hunter-rebuild-natural');
  assert.equal(s.schemaVersion, 184); assert.equal(s.contentVersion, 'conqueror-v184');
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.revision, 796); assert.equal(s.week, 200);
  assert.deepEqual([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining], [80, 100, 120, 536, 3]);
  assert.deepEqual(s.random, { seed: old.seed, cursor: 376 });
  assert.equal(s.progression.pathwayId, 'hunter'); assert.equal(s.progression.sequence, 1); assert.equal(s.progression.acting, 100);
  assert.equal(Object.keys(s.progression.mastery).length, 23); assert.equal(Object.values(s.progression.mastery).filter(n => n === 0).length, 6);
  assert.equal(s.injuries.length, 2); assert(s.injuries.every(i => i.severity === 'LIGHT'));
  assert.deepEqual(s.conqueror.bottles.map(b => [b.id, b.status, b.outcome]), [
    ['conqueror-potion-1', 'CONSUMED', 'FAILURE'], ['conqueror-potion-2', 'CONSUMED', 'FAILURE'], ['conqueror-potion-3', 'CONSUMED', 'SUCCESS'],
  ]);
  assert.equal(s.combat, null); assert.equal(s.activeEvent, null);
  return Object.fromEntries(['provenance', 'creation', 'seed', 'commands', 'initial', 'final'].map(key => [key, old[key]]));
}
async function loadRuntime(root) {
  const [slice, migration, session] = await Promise.all(['domain/slice/index', 'domain/slice/migration', 'domain/red-priest/owned-session']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  return { ...slice, migrateSliceState: migration.migrateSliceState, openRedPriestRuntimeSession: session.openRedPriestRuntimeSession };
}
function verifyMigration(runtime, raw) {
  const current = runtime.migrateSliceState(raw);
  assert.equal(current.contentVersion, 'red-priest-v206'); assert.equal(current.schemaVersion, 206);
  for (const [key, value] of Object.entries(raw)) {
    if (['schemaVersion', 'contentVersion', 'fool', 'redPriest'].includes(key)) continue;
    assert.deepEqual(current[key], value, `Migration changed original ${key}`);
  }
  runtime.assertValidSliceState(current); return current;
}
function checkOriginals(state, old) {
  assert.equal(state.runId, old.final.runId); assert.equal(state.random.seed, old.seed);
  assert(state.random.cursor >= old.final.random.cursor);
  for (const key of ['hunter', 'provoker', 'pyromaniac', 'conspirator', 'reaper', 'ironBloodKnight', 'warBishop', 'weatherWarlock', 'conqueror', 'combatHistory', 'world'])
    assert.deepEqual(state[key], old.final[key], `Original ${key} must not change`);
  const { coreStats: _now, ...identity } = state.character, { coreStats: _then, ...original } = old.final.character;
  assert.deepEqual(identity, original);
  for (const [id, value] of Object.entries(old.final.progression.mastery)) assert.equal(state.progression.mastery[id], value, `Original mastery changed: ${id}`);
  if (state.redPriest?.source) {
    const source = state.redPriest.source, raw = old.final;
    assert.equal(source.revision, raw.revision); assert.deepEqual(source.random, raw.random); assert.deepEqual(source.character, raw.character);
    assert.deepEqual(source.finance, Object.fromEntries(['weeklyBudget', 'wagePaidWeek', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit'].map(key => [key, raw[key]])));
    assert.deepEqual(source.budget, { week: raw.week, date: raw.date, actions: raw.actionsRemaining, cash: raw.cash,
      health: raw.health, mind: raw.mind, spirituality: raw.spirituality, pollution: raw.seer.pollution,
      injuries: raw.injuries, injuryRisk: raw.injuryRisk, status: raw.status, sequence: raw.progression.sequence,
      acting: raw.progression.acting, mastery: raw.progression.mastery, coreStats: raw.character.coreStats, completedSources: raw.seer.completedSources });
  }
}
function syncDirectory(path) {
  const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
}
function durableCreate(path, contents) {
  const fd = openSync(path, 'wx'); try { writeFileSync(fd, contents); fsyncSync(fd); } finally { closeSync(fd); }
}
function encodeCheckpoint(payload) { return JSON.stringify({ sha256: stateHash(payload), payload }); }
function decodeCheckpoint(bytes) {
  const wrapped = JSON.parse(bytes); assert.equal(wrapped.sha256, stateHash(wrapped.payload), 'Checkpoint checksum mismatch');
  assert.equal(wrapped.payload.format, FORMAT); return wrapped;
}
/** A complete next boundary is never thrown away merely because rename was interrupted. */
function recoverAtomicNext(path) {
  const nextPath = `${path}.next`; if (!existsSync(nextPath)) return;
  const current = existsSync(path) ? decodeCheckpoint(readFileSync(path, 'utf8')) : null;
  let next;
  try { next = decodeCheckpoint(readFileSync(nextPath, 'utf8')); }
  catch {
    const retained = `${path}.incomplete`;
    assert(!existsSync(retained), 'A prior incomplete checkpoint already exists; preserve both files and inspect before resuming');
    renameSync(nextPath, retained); syncDirectory(dirname(path)); return;
  }
  assert.equal(next.payload.predecessorSha256, current?.sha256 ?? null, 'Unrecognized next checkpoint; preserve files for inspection');
  renameSync(nextPath, path); syncDirectory(dirname(path));
}
function saveCheckpoint(path, payload, predecessorSha256) {
  assert(!existsSync(`${path}.next`), 'A pending atomic replacement must be recovered first');
  const next = { ...payload, predecessorSha256 }, text = encodeCheckpoint(next);
  durableCreate(`${path}.next`, text); renameSync(`${path}.next`, path); syncDirectory(dirname(path));
  return decodeCheckpoint(text);
}
function replaceDerived(path, value) {
  // Derived outputs are only written at a manual/terminal boundary, not per step.
  const temp = `${path}.derived-next`, fd = openSync(temp, 'w');
  try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, path); syncDirectory(dirname(path));
}
const section = (view, id) => view.sections.find(s => s.id === id)?.lines ?? [];
const commandKey = command => JSON.stringify(command);
const nestedType = action => action.command.command?.type;
const injuryCount = view => Number(section(view, 'finance').join(' ').match(/当前伤势(\d+)份/)?.[1] ?? 0);
const cash = view => Number(view.resources.cash.match(/^\d+/)?.[0] ?? 0);
const achievement = view => {
  const match = section(view, 'campaign-status').join(' ').match(/独立胜利(\d+)\/5；交战战区(\d+)\/3；受控战区(\d+)\/3/);
  return match ? { victories: Number(match[1]), engaged: Number(match[2]), controlled: Number(match[3]) } : null;
};
const materialReady = view => section(view, 'materials').filter(line => line.includes('本人持有原件')).length === 3;
const materialUnavailable = view => section(view, 'materials').some(line => line.includes('当前无法取回'));
function startingPolicy() { return { phase: 'GUIDANCE', attempts: {}, supportSinceProgress: 0, unchangedWaits: 0, lastProgress: null, stopAfterWithdrawal: null }; }
function progressSignature(view) {
  return stateHash({ promoted: view.promoted, guidance: view.guidanceKnown,
    materials: section(view, 'materials'), campaign: section(view, 'campaign-status'), epilogue: section(view, 'epilogue'),
    actions: view.actions.filter(a => !['REST', 'WORK', 'CLINIC', 'NEXT_WEEK'].includes(a.command.type))
      .map(a => ({ command: a.command, label: a.label })) });
}
function price(action) {
  const text = action.cost;
  return { actions: Number(text.match(/(\d+)行动/)?.[1] ?? 1), cash: Number(text.match(/(\d+)便士/)?.[1] ?? 0), spirituality: Number(text.match(/(\d+)灵性/)?.[1] ?? 0) };
}
/** This function receives no private state, RNG, checks or outcome receipts. */
export function chooseAction(view, previous, definition = POLICY) {
  const policy = clone(previous), all = view.actions, enabled = all.filter(a => a.enabled);
  const find = type => enabled.find(a => a.command.type === type);
  const campaign = type => all.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === type);
  const choose = (action, reason) => { assert(action?.enabled, 'Policy may select only an enabled public action'); return { action: clone(action), reason, policy }; };
  const stop = (code, reason) => ({ stop: code, reason, policy });
  const count = action => policy.attempts[commandKey(action.command)] ?? 0;
  const support = (reason, need = {}, allowArmyWork = true) => {
    const clinic = find('CLINIC'), work = find('WORK'), rest = find('REST'), wait = find('NEXT_WEEK');
    const armyWork = enabled.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'MILITARY_LABOUR');
    const requiredCash = need.cash ?? 0;
    const headquartersReturn = enabled.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'RETURN_TO_HEADQUARTERS');
    if (definition.logisticsRecovery && cash(view) < requiredCash && !work && !(allowArmyWork && armyWork) && headquartersReturn)
      return choose(headquartersReturn, 'Return along the real military route to earn legal income; retain war, losses, time and personal debts');
    if (policy.supportSinceProgress >= POLICY.maximumSupportCommandsWithoutProgress || policy.unchangedWaits >= POLICY.maximumUnchangedWeeklyWaits)
      return stop('FINITE_PUBLIC_NO_PROGRESS', `Finite recovery limit reached: ${reason}`);
    if (injuryCount(view) > 0 && clinic) return choose(clinic, `Pay actual treatment before recovery: ${reason}`);
    if (cash(view) < requiredCash) {
      if (work) return choose(work, `Earn the one legal occupational wage this week: ${reason}`);
      if (allowArmyWork && armyWork) return choose(armyWork, `Perform the enabled, treasury-funded weekly military task: ${reason}`);
    }
    if (rest && (injuryCount(view) > 0 || view.resources.health < (need.health ?? 0) || view.resources.mind < (need.mind ?? 0) || view.resources.spirituality < (need.spirituality ?? 0)))
      return choose(rest, `Use ordinary paid-life recovery, preserving actual wounds: ${reason}`);
    if (wait) return choose(wait, `Actually pass seven days and settle costs: ${reason}`);
    return stop('PUBLIC_RECOVERY_UNAVAILABLE', reason);
  };
  const prepare = (reason, need, allowArmyWork = true) => {
    if (cash(view) < (need.cash ?? 0) || view.resources.actionsRemaining < (need.actions ?? 1) || view.resources.health < (need.health ?? 0)
      || view.resources.mind < (need.mind ?? 0) || view.resources.spirituality < (need.spirituality ?? 0) || need.uninjured && injuryCount(view) > 0)
      return support(reason, need, allowArmyWork);
    return null;
  };
  const atFullHealth = { health: POLICY.preparationHealth, mind: POLICY.preparationMind, spirituality: POLICY.preparationSpirituality, uninjured: true };
  const pursue = (action, reason, extra = {}) => {
    const needs = { ...price(action), ...extra };
    const preparation = prepare(reason, needs); if (preparation) return preparation;
    if (action.enabled) return choose(action, reason);
    if (/无法按当前保管线|已经用尽|无法取回|后备.*不足/.test(action.reason ?? '')) return stop('PUBLIC_FINITE_RESOURCE_LOSS', action.reason);
    // Return-route prices are deliberately prose rather than a numeric total.
    // A public insufficient-funds block authorizes seeking actual legal income,
    // never reading the private route cost or repeatedly waiting into debt.
    if (/费用|资源/.test(action.reason ?? '') && cash(view) >= needs.cash) needs.cash = cash(view) + 1;
    return support(`${reason}; public block: ${action.reason ?? 'unavailable'}`, needs);
  };
  const materials = afterWar => {
    if (materialUnavailable(view)) return stop('ORIGINAL_MATERIAL_UNAVAILABLE', 'An original material is publicly unavailable; no replacement, reset or reroll is permitted');
    const local = all.find(a => a.command.type === 'MATERIAL' && nestedType(a) !== 'PREPARE_COMPOUND');
    if (local) {
      if (count(local) >= definition.attemptsPerMaterialOperation) return stop('FINITE_MATERIAL_ATTEMPTS', `Finite attempts exhausted for ${local.label}`);
      return pursue(local, `Complete the current original-material operation at this actual location: ${local.label}`, atFullHealth);
    }
    if (materialReady(view) || all.some(a => a.command.type === 'CONSUME')) return null;
    // Projection order is public; local work always wins, so preferred travel
    // cannot bounce the actor between the two original residue destinations.
    const travel = all.find(a => a.command.type === 'TRAVEL' && a.command.to !== 'loen-headquarters' && a.command.to !== 'backlund:sealed-compounding-room');
    return travel ? pursue(travel, `Follow the first publicly offered remaining material lead: ${travel.label}`)
      : stop(afterWar ? 'NO_RECOVERABLE_MATERIAL_ROUTE' : 'NO_PUBLIC_MATERIAL_ROUTE', 'No public route to the remaining original materials is available');
  };
  for (let transitions = 0; transitions < 8; transitions++) {
    if (policy.phase === 'WITHDRAWN_PERSONNEL') {
      const ended = section(view, 'campaign-status').includes('战事已停，原有损失和经历继续保留。') && !campaign('WITHDRAW_PROTECT');
      return stop(ended ? 'FINITE_CAMPAIGN_WITHDRAWN' : 'FINITE_CAMPAIGN_REVIEW_REQUIRED', ended
        ? 'Executed the real protective withdrawal after the exact public warning that remaining personnel cannot complete the remaining objectives; all losses and costs remain'
        : 'The selected protective withdrawal did not publicly confirm a stopped war; preserve the actual result for review');
    }
    if (policy.stopAfterWithdrawal) {
      if (definition.logisticsRecovery) return stop('FINITE_CAMPAIGN_REVIEW_REQUIRED', policy.stopAfterWithdrawal);
      const withdrawal = campaign('WITHDRAW_PROTECT');
      if (withdrawal) return pursue(withdrawal, `End the actual failed campaign by its ordinary route: ${policy.stopAfterWithdrawal}`);
      return stop('FINITE_CAMPAIGN_WITHDRAWN', policy.stopAfterWithdrawal);
    }
    if (view.promoted) policy.phase = 'RESCUE';
    if (policy.phase === 'GUIDANCE') {
      if (view.guidanceKnown) { policy.phase = 'MATERIALS'; continue; }
      const action = find('LEARN_GUIDANCE'); return action ? choose(action, 'Learn guidance publicly from the exact migrated living original') : stop('GUIDANCE_UNAVAILABLE', 'Original public guidance is unavailable');
    }
    if (policy.phase === 'MATERIALS') {
      const preparation = prepare('Heal the original light wounds before material investigation', { ...atFullHealth, actions: 1 });
      if (preparation) return preparation;
      const next = materials(false); if (next) return next;
      policy.phase = 'FUND_WAR'; continue;
    }
    if (policy.phase === 'FUND_WAR') {
      const preparation = prepare('Accumulate a finite personal campaign reserve through actual weekly wages', { ...atFullHealth, actions: 1, cash: POLICY.cashBeforeDeclaration }, false);
      if (preparation) return preparation;
      const home = all.find(a => a.command.type === 'TRAVEL' && a.command.to === 'loen-headquarters');
      if (home) return pursue(home, 'Personally return to the coalition headquarters before requesting authority');
      policy.phase = 'WAR'; continue;
    }
    if (policy.phase === 'WAR') {
      if (definition.verifiedPersonnelExit && section(view, 'campaign-readiness').includes(definition.verifiedPersonnelExit)) {
        const withdrawal = campaign('WITHDRAW_PROTECT');
        if (withdrawal?.enabled) {
          policy.phase = 'WITHDRAWN_PERSONNEL';
          return choose(withdrawal, 'The exact public readiness warning confirms insufficient remaining original personnel for the remaining objectives; execute the approved real protective withdrawal');
        }
        return withdrawal ? support('Obtain the real action needed for the publicly justified protective withdrawal', { actions: 1 })
          : stop('FINITE_CAMPAIGN_REVIEW_REQUIRED', 'Public personnel exhaustion has no enabled protective withdrawal route');
      }
      if (/将两份外在原特性/.test(view.nextStep)) { policy.phase = 'POSTWAR'; continue; }
      const authority = campaign('REQUEST_AUTHORITY');
      if (authority) {
        if (count(authority) >= definition.authorityAttemptsPerPolity) return stop('FINITE_AUTHORITY_ATTEMPTS', 'Actual coalition permission was not obtained within the finite public policy');
        return pursue(authority, `Obtain this polity's actual coalition authority: ${authority.label}`, atFullHealth);
      }
      const declaration = campaign('DECLARE_OFFENSIVE');
      if (declaration) return pursue(declaration, 'Issue the actual offensive only after the three public authorizations',
        definition.logisticsRecovery ? { ...atFullHealth, cash: POLICY.cashBeforeDeclaration } : atFullHealth);
      const achieved = achievement(view), truce = campaign('SEEK_ARMISTICE');
      if (truce && achieved && achieved.victories >= 5 && achieved.engaged === 3 && achieved.controlled === 3 && /完整经历/.test(view.nextStep)) {
        if (count(truce) >= POLICY.armisticeAttempts) { policy.stopAfterWithdrawal = 'Actual truce was refused within the finite negotiation policy'; continue; }
        return pursue(truce, 'Negotiate actual truce after the publicly recorded five victories and three controlled theaters');
      }
      const legionNeeds = section(view, 'campaign-losses').flatMap(line => {
        const match = line.match(/^(.+)：现员(\d+)，阵亡\d+，伤员\d+，补给(\d+)，士气(\d+)/);
        return match ? [{ name: match[1], personnel: Number(match[2]), supply: Number(match[3]), morale: Number(match[4]) }] : [];
      });
      const depletedSupply = legionNeeds.filter(l => l.supply < 20);
      if (definition.finiteSupplyRecovery && depletedSupply.length) {
        const forDepleted = a => depletedSupply.some(l => a.label.includes(l.name.slice(0, 2)));
        const reinforcement = enabled.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'REORGANIZE' && forDepleted(a));
        const supplies = all.filter(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'SUPPLY_ONLY' && forDepleted(a));
        const supply = supplies.find(a => a.enabled);
        if (!reinforcement && supply) return choose(supply, 'Pay the actual finite supply convoy when the original manpower reserve cannot reinforce this publicly undersupplied army');
        if (!reinforcement && supplies.some(a => /仍在途中/.test(a.reason ?? '')))
          return support('Wait for the actual already-dispatched original-supply convoy');
        const resourceBlockedSupply = supplies.find(a => /行动|费用|灵性/.test(a.reason ?? ''));
        if (!reinforcement && resourceBlockedSupply) return pursue(resourceBlockedSupply, 'Earn or recover the actual personal resources for the finite original-supply convoy');
      }
      if (definition.fieldArmyRecovery && legionNeeds.some(l => l.morale < 50)) {
        const armyRest = campaign('REST_FIELD_ARMIES'), returnHome = campaign('RETURN_TO_HEADQUARTERS');
        if (armyRest?.enabled) return choose(armyRest, 'Pay the actual headquarters rest costs to recover original-army morale; preserve all casualties, reserves and battle attempts');
        if (returnHome?.enabled) return choose(returnHome, 'Return the same original armies along the real route for headquarters rest; retain the active war and all losses');
        if (/行动/.test(armyRest?.reason ?? returnHome?.reason ?? '')) return support('Actually pass time for the headquarters rest action', { actions: 1 });
        return stop('PUBLIC_FIELD_ARMY_RECOVERY_UNAVAILABLE', armyRest?.reason ?? 'No enabled actual route or headquarters rest is available for the exhausted original armies');
      }
      const depleted = legionNeeds.filter(l => l.personnel < 1200 || l.supply < 20 || l.morale < 50);
      if (depleted.length) {
        const reinforcement = enabled.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'REORGANIZE' && depleted.some(l => a.label.includes(l.name.slice(0, 2))));
        if (reinforcement) return pursue(reinforcement, 'Request real finite reserves for a publicly depleted legion');
      }
      const consolidation = campaign('CONSOLIDATE'), battle = campaign('BATTLE'), march = campaign('MARCH');
      if (definition.logisticsRecovery && march && /本人在鲁恩联合协商处；原军团在鲁恩联合协商处/.test(section(view, 'campaign-status')[0] ?? '')) {
        const reserve = prepare('Earn the existing 1600-penny operating reserve before leaving headquarters again',
          { ...atFullHealth, actions: 1, cash: POLICY.cashBeforeDeclaration }, false);
        if (reserve) return reserve;
      }
      if (consolidation?.enabled) return pursue(consolidation, 'Consolidate the genuinely won local transport objective');
      if (battle?.enabled) {
        if (count(battle) >= POLICY.battleAttemptsPerNode) { policy.stopAfterWithdrawal = 'Finite attempts at the same real battle are exhausted'; continue; }
        return pursue(battle, 'Fight the actual opposing legion at this independent objective', { health: 90, mind: 90, spirituality: 30, uninjured: true });
      }
      if (march?.enabled) return pursue(march, 'March along the next enabled real route after local consolidation');
      const resourceBlocked = [battle, consolidation, march].find(a => a && /行动|费用|灵性|休养|重伤/.test(a.reason ?? ''));
      if (resourceBlocked) return pursue(resourceBlocked, `Recover actual resources for ${resourceBlocked.label}`, { health: 90, mind: 90, spirituality: 30, uninjured: true });
      const reinforcement = enabled.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'REORGANIZE');
      if (reinforcement) return pursue(reinforcement, 'Use the remaining legal finite reinforcement when forward action is blocked');
      const pending = all.some(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'REORGANIZE' && /仍在途中/.test(a.reason ?? ''));
      if (pending) return support('Wait for the actual already-dispatched reinforcement convoy');
      policy.stopAfterWithdrawal = 'No enabled forward route, objective or finite reinforcement remains'; continue;
    }
    if (policy.phase === 'POSTWAR') {
      const footReturn = definition.postwarFootReturn ? all.find(a => a.command.type === 'RETURN_ON_FOOT') : null;
      if (footReturn) {
        const paidReturn = enabled.find(a => a.command.type === 'TRAVEL' && a.command.to === 'loen-headquarters');
        if (paidReturn) return choose(paidReturn, 'Use the affordable real paid return route after actual armistice, retaining the original armies at their postwar station');
        if (footReturn.enabled) return choose(footReturn, 'Walk the actual postwar return route without advance fare; pay real extra weeks and living debts while the original armies remain stationed');
        return support('Wait for a legal public postwar return action', { actions: 1 });
      }
      // Failure may leave real recoverable original boxes, or permanently lose
      // them. Treat the actual living patient before considering another bottle.
      const preparation = prepare('Recover actual postwar or failed-consumption injuries', { ...atFullHealth, actions: 1, cash: injuryCount(view) ? 60 : 0 });
      if (preparation) return preparation;
      const next = materials(true); if (next) return next;
      const consumption = all.find(a => a.command.type === 'CONSUME');
      if (consumption) return pursue(consumption, 'Drink this actual prepared compound once, accepting its genuine result', atFullHealth);
      const compound = all.find(a => a.command.type === 'MATERIAL' && nestedType(a) === 'PREPARE_COMPOUND');
      if (compound) return pursue(compound, 'Consume one finite ordinary supply pack to prepare the original materials');
      const destinations = all.filter(a => a.command.type === 'TRAVEL' && ['backlund:sealed-compounding-room', 'loen-headquarters'].includes(a.command.to));
      const travel = destinations.find(a => a.enabled) ?? destinations.find(a => a.command.to === 'loen-headquarters') ?? destinations[0];
      return travel ? pursue(travel, 'Transport the actual originals along the public return route to the workshop')
        : stop('POSTWAR_PUBLIC_ROUTE_UNAVAILABLE', 'No legal public preparation or transport action remains');
    }
    if (policy.phase === 'RESCUE') {
      const epilogue = enabled.filter(a => a.command.type === 'EPILOGUE');
      // A real rescue, not an ability checklist. With the inherited 3 AP,
      // START leaves 2: attempt coordination, then carry the actual patients.
      // Never sacrifice the only remaining evacuation action to test flame.
      for (const type of ['COORDINATE', 'EVACUATE', 'REPORT', 'CONTAIN_FIRE', 'WITHDRAW']) {
        const action = epilogue.find(a => nestedType(a) === type);
        if (type === 'CONTAIN_FIRE' && epilogue.some(a => nestedType(a) === 'EVACUATE')) continue;
        if (action) return choose(action, type === 'WITHDRAW' ? 'Ordinarily withdraw when the remaining real rescue actions are unavailable' : `Resolve the one actual return-route rescue: ${action.label}`);
      }
      if (section(view, 'epilogue').length) return stop('NATURAL_RESCUE_REPORTED', 'The actual rescue/withdrawal and casualties have been reported');
      const preparation = prepare('Recover before returning to the original route for coordination and actual evacuation', { ...atFullHealth, actions: 3 });
      if (preparation) return preparation;
      const start = find('START_EPILOGUE');
      if (start) return choose(start, 'Dispatch the actual six-person detachment at its original postwar location');
      const travel = all.find(a => a.command.type === 'TRAVEL');
      return travel ? pursue(travel, 'Actually traverse the original continent route back to the postwar legion') : stop('RESCUE_ROUTE_UNAVAILABLE', 'No public route or real detachment is available');
    }
  }
  return stop('PUBLIC_POLICY_PHASE_BLOCKED', 'No bounded phase transition produced an enabled action');
}
function advancePolicy(decision, publicAfter) {
  const policy = clone(decision.policy), key = commandKey(decision.action.command);
  policy.attempts[key] = (policy.attempts[key] ?? 0) + 1;
  const progress = progressSignature(publicAfter), unchanged = policy.lastProgress === progress;
  const supportAction = ['REST', 'WORK', 'CLINIC', 'NEXT_WEEK'].includes(decision.action.command.type)
    || decision.action.command.command?.type === 'MILITARY_LABOUR';
  policy.supportSinceProgress = unchanged && supportAction ? policy.supportSinceProgress + 1 : 0;
  // Wage/health progress makes another weekly cycle meaningful. Pure consecutive
  // waiting on an unchanged public problem remains bounded.
  policy.unchangedWaits = unchanged && decision.action.command.type === 'NEXT_WEEK' ? policy.unchangedWaits + 1 : 0;
  policy.lastProgress = progress; return policy;
}
function verifyCheckpoint(checkpoint, old, freeze, initialStateSha256) {
  const seams = checkpoint.lineage?.original.commandCount === 974
    ? [checkpoint.lineage.inheritedRuntimeTransition, checkpoint.lineage.runtimeTransition]
    : checkpoint.lineage?.original.commandCount === 941 ? [checkpoint.lineage.runtimeTransition] : [];
  assert.equal(checkpoint.sourceSha256, SOURCE_SHA256); assert.equal(checkpoint.prefixSha256, PREFIX_SHA256);
  assert.equal(checkpoint.freezeSha256, freeze.sha256, 'Runtime or producer changed; a natural resume cannot switch rules');
  assert.deepEqual(checkpoint.policyDefinition, checkpoint.lineage ? continuationDefinition(checkpoint.lineage.original.commandCount).nextPolicy : POLICY);
  assert.equal(checkpoint.initialStateSha256, initialStateSha256, 'Checkpoint is not rooted in the exact migrated source');
  assert.equal(checkpoint.finalStateSha256, stateHash(checkpoint.state)); checkOriginals(checkpoint.state, old);
  assert.equal(checkpoint.commandCount, PREFIX_COUNT + checkpoint.commands.length);
  assert.equal(checkpoint.commands.length, checkpoint.rows.length);
  assert.equal(checkpoint.state.revision, old.final.revision + checkpoint.commands.length);
  const actualAttempts = {};
  for (const intent of checkpoint.commands) {
    const key = commandKey(intent.command); actualAttempts[key] = (actualAttempts[key] ?? 0) + 1;
  }
  assert.deepEqual(checkpoint.policy.attempts, actualAttempts, 'Cumulative policy counters must equal every recorded original and continued command');
  for (const [index, row] of checkpoint.rows.entries()) {
    assert.equal(row.commandCount, PREFIX_COUNT + index + 1); assert.equal(row.revision, old.final.revision + index + 1);
    assert.deepEqual(row.intent, checkpoint.commands[index]); assert.equal(row.commandSha256, compactHash(row.intent));
    if (index > 0) {
      assert.equal(row.beforeStateSha256, checkpoint.rows[index - 1].afterStateSha256);
      const seam = seams.find(seam => row.commandCount === seam.commandCount + 1);
      if (seam) {
        assert.equal(checkpoint.rows[index - 1].commandCount, seam.commandCount);
        assert.equal(checkpoint.rows[index - 1].publicAfterSha256, seam.originalPublicSha256);
        assert.equal(row.publicBeforeSha256, seam.continuedPublicSha256);
      } else assert.equal(row.publicBeforeSha256, checkpoint.rows[index - 1].publicAfterSha256);
      assert.deepEqual(row.randomBefore, checkpoint.rows[index - 1].randomAfter);
    } else { assert.equal(row.beforeStateSha256, initialStateSha256); assert.deepEqual(row.randomBefore, old.final.random); }
    assert.equal(row.randomBefore.seed, old.seed); assert.equal(row.randomAfter.seed, old.seed);
  }
  if (checkpoint.rows.length) {
    assert.equal(checkpoint.rows.at(-1).afterStateSha256, checkpoint.finalStateSha256);
    const seam = seams.find(seam => checkpoint.commandCount === seam.commandCount);
    if (seam) {
      assert.equal(checkpoint.rows.at(-1).publicAfterSha256, seam.originalPublicSha256);
      assert.equal(checkpoint.publicStateSha256, seam.continuedPublicSha256);
    } else assert.equal(checkpoint.rows.at(-1).publicAfterSha256, checkpoint.publicStateSha256);
    assert.deepEqual(checkpoint.rows.at(-1).randomAfter, checkpoint.state.random);
  } else assert.equal(checkpoint.finalStateSha256, initialStateSha256);
  if (checkpoint.pending) {
    assert.equal(checkpoint.pending.commandCount, checkpoint.commandCount + 1);
    assert.equal(checkpoint.pending.beforeStateSha256, checkpoint.finalStateSha256);
    assert.equal(checkpoint.pending.publicBeforeSha256, checkpoint.publicStateSha256);
    assert.deepEqual(checkpoint.pending.intent, { type: 'RED_PRIEST', command: checkpoint.pending.decision.action.command });
  }
}
function verifyOriginalFiles(directory, pin = CONTINUATION) {
  for (const { file, ...expected } of pin.originalFiles) assert.deepEqual(fileEvidence(join(directory, file)), expected, `Immutable original capture changed: ${file}`);
  assert(!existsSync(join(directory, 'checkpoint.json.next')), 'Original capture must be a complete terminal boundary');
}
function verifyContinuationLineage(checkpoint, directory, freeze, depth = 0) {
  if (!checkpoint.lineage) return;
  assert(depth < 4, 'Only the four reviewed historical layers are supported');
  const { pin, previousPolicy, nextPolicy, cursor } = continuationDefinition(checkpoint.lineage.original.commandCount);
  const { proofFile, proofSha256, ...proof } = checkpoint.lineage;
  assert.equal(proofFile, 'prior-proof/lineage.json'); assert.equal(sha(readFileSync(join(directory, proofFile))), proofSha256);
  assert.deepEqual(JSON.parse(readFileSync(join(directory, proofFile), 'utf8')), proof);
  assert.deepEqual(proof.original, pin); assert.equal(proof.newFreezeSha256, freeze.sha256);
  assert.deepEqual(proof.onlyAllowedFreezeChange, [941, 974].includes(pin.commandCount) ? ['$natural-producer', ...transitionDefinition(pin.commandCount).files] : ['$natural-producer']);
  assert.equal(proof.originalFilesDirectory, 'prior-observation');
  const originalDirectory = join(directory, proof.originalFilesDirectory);
  verifyOriginalFiles(originalDirectory, pin);
  const originalBoundary = decodeCheckpoint(readFileSync(join(originalDirectory, 'checkpoint.json'), 'utf8'));
  assert.equal(originalBoundary.sha256, pin.checkpointPayloadSha256);
  assert.equal(stateHash(originalBoundary.payload.state), pin.stateSha256);
  assert.deepEqual(originalBoundary.payload.policy, proof.priorPolicyState);
  assert.equal(proof.producerFile, 'prior-proof/producer.mjs'); assert.equal(proof.ledgerFile, 'prior-proof/commands.ndjson');
  assert.deepEqual(fileEvidence(join(directory, proof.producerFile)), { bytes: pin.producer.bytes, sha256: pin.producer.sha256 });
  const originalLedger = readFileSync(join(directory, proof.ledgerFile), 'utf8');
  assert.equal(sha(originalLedger), pin.originalFiles.find(f => f.file === 'commands.ndjson').sha256);
  const rows = originalLedger.trimEnd().split('\n').map(JSON.parse), count = pin.commandCount - PREFIX_COUNT;
  assert.equal(rows.length, count); assert.deepEqual(checkpoint.rows.slice(0, count), rows);
  assert.deepEqual(checkpoint.commands.slice(0, count), rows.map(row => row.intent));
  assert.equal(rows.at(-1).afterStateSha256, pin.stateSha256); assert.equal(rows.at(-1).publicAfterSha256, pin.publicSha256);
  assert.deepEqual(rows.at(-1).randomAfter, { seed: 'hunter-rebuild-first', cursor });
  assert.equal(compactHash(checkpoint.commands.slice(0, count)), proof.priorCommandsSha256);
  assert.equal(compactHash(rows), proof.priorRowsSha256);
  let transition = null;
  if ([941, 974].includes(pin.commandCount)) {
    const definition = transitionDefinition(pin.commandCount);
    const expectedPath = 'prior-proof/runtime-transition.json', runtimeBeforeDirectory = 'prior-proof/runtime-before';
    const loaded = readRuntimeTransition(join(directory, expectedPath), rows, pin); transition = loaded.proof;
    assert.deepEqual(proof.runtimeTransition, { proofFile: expectedPath, proofSha256: definition.sha256, commandCount: pin.commandCount,
      originalPublicSha256: pin.publicSha256, continuedPublicSha256: transition.continuedPublicSha256, runtimeBeforeDirectory });
    for (const change of transition.changedFiles)
      assert.deepEqual(fileEvidence(join(directory, runtimeBeforeDirectory, change.file)), change.before, `Original runtime file was not preserved: ${change.file}`);
  } else assert(!Object.hasOwn(proof, 'runtimeTransition'));
  if (pin.commandCount === 974) {
    assert.equal(originalBoundary.payload.lineage.original.commandCount, 941);
    assert.deepEqual(proof.inheritedRuntimeTransition, originalBoundary.payload.lineage.runtimeTransition);
    const priorProjection = readRuntimeTransition(join(originalDirectory, 'prior-proof/runtime-transition.json'), rows.slice(0, 146), LOGISTICS_CONTINUATION).proof;
    for (const [index, row] of priorProjection.replay.rows.entries())
      assert.equal(transition.replay.rows[index].priorRuntimePublicSha256, row.publicSha256, 'Historical941 runtime projection must remain exact');
  } else assert(!Object.hasOwn(proof, 'inheritedRuntimeTransition'));
  assert.deepEqual(proof.previousPolicy, previousPolicy); assert.deepEqual(proof.continuedPolicy, nextPolicy);
  assert.equal(proof.priorTerminal.stage, pin.terminal.stage);
  const originalFreezeFiles = previousFreezeFiles(freeze, pin, transition);
  assert.equal(compactHash(originalFreezeFiles), pin.freezeSha256, 'Product/runtime/source changed across continuation');
  const originalFreeze = JSON.parse(readFileSync(join(originalDirectory, 'freeze.json'), 'utf8'));
  assert.deepEqual(originalFreeze, { sha256: pin.freezeSha256, files: originalFreezeFiles });
  // All restored-capture dependencies are local relative files, including exact
  // original observation bytes. No private output path is required on restore.
  assert.equal(stateHash(proof.priorPolicyState), pin.policyStateSha256);
  assert.deepEqual(proof.priorTerminal, pin.terminal);
  verifyContinuationLineage(originalBoundary.payload, originalDirectory, originalFreeze, depth + 1);
}
// Copy each prior observation once, including only its already-verified relative
// proof tree. No arbitrary output tree, snapshots or duplicate history copies.
function copyPriorEvidence(source, target, checkpoint, depth = 0) {
  if (!checkpoint.lineage) return;
  assert(depth < 4);
  const lineage = checkpoint.lineage, { pin } = continuationDefinition(lineage.original.commandCount);
  for (const file of [lineage.producerFile, lineage.ledgerFile, lineage.proofFile]) {
    mkdirSync(dirname(join(target, file)), { recursive: true }); durableCreate(join(target, file), readFileSync(join(source, file)));
  }
  if (lineage.runtimeTransition) {
    const transition = readRuntimeTransition(join(source, lineage.runtimeTransition.proofFile), checkpoint.rows.slice(0, pin.commandCount - PREFIX_COUNT), pin);
    durableCreate(join(target, lineage.runtimeTransition.proofFile), transition.bytes);
    for (const change of transition.proof.changedFiles) {
      const name = join(lineage.runtimeTransition.runtimeBeforeDirectory, change.file);
      mkdirSync(dirname(join(target, name)), { recursive: true }); durableCreate(join(target, name), readFileSync(join(source, name)));
      syncDirectory(dirname(join(target, name)));
    }
  }
  syncDirectory(join(target, 'prior-proof'));
  const from = join(source, lineage.originalFilesDirectory), to = join(target, lineage.originalFilesDirectory);
  mkdirSync(to);
  for (const { file } of pin.originalFiles) durableCreate(join(to, file), readFileSync(join(from, file)));
  syncDirectory(to); verifyOriginalFiles(to, pin);
  copyPriorEvidence(from, to, decodeCheckpoint(readFileSync(join(from, 'checkpoint.json'), 'utf8')).payload, depth + 1);
}
function prepareContinuation(directory, output, root, old, freeze, runtime, initialStateSha256) {
  assert.notEqual(resolve(directory), resolve(output), 'Continuation must use a new directory');
  assert(!resolve(output).startsWith(resolve(directory) + sep), 'Do not create continuation files inside the immutable original capture');
  assert.equal(readdirSync(output).length, 0, 'Continuation output must be empty');
  const original = decodeCheckpoint(readFileSync(join(directory, 'checkpoint.json'), 'utf8'));
  const { pin, previousPolicy, nextPolicy, cursor, archive } = continuationDefinition(original.payload.commandCount);
  const portableTransition = join(dirname(directory), 'prior-proof/runtime-transition.json');
  const definition = [941, 974].includes(pin.commandCount) ? transitionDefinition(pin.commandCount) : null;
  const transition = definition ? readRuntimeTransition(existsSync(portableTransition) ? portableTransition : join(root, definition.proofSource), original.payload.rows, pin) : null;
  verifyOriginalFiles(directory, pin);
  const priorFreeze = JSON.parse(readFileSync(join(directory, 'freeze.json'), 'utf8'));
  assert.equal(original.sha256, pin.checkpointPayloadSha256); assert.equal(priorFreeze.sha256, pin.freezeSha256);
  assert.equal(compactHash(priorFreeze.files), priorFreeze.sha256);
  assert.deepEqual(priorFreeze.files, previousFreezeFiles(freeze, pin, transition?.proof ?? null), 'Only the exact reviewed producer/runtime changes may differ');
  const prior = original.payload; verifyCheckpoint(prior, old, priorFreeze, initialStateSha256);
  verifyContinuationLineage(prior, directory, priorFreeze);
  assert.equal(prior.commandCount, pin.commandCount); assert.equal(prior.state.status, 'ACTIVE'); assert.equal(prior.state.revision, pin.commandCount + 1);
  assert.equal(prior.pending, null); assert.deepEqual(prior.terminal, pin.terminal);
  assert.equal(prior.finalStateSha256, pin.stateSha256); assert.equal(prior.publicStateSha256, pin.publicSha256);
  assert.deepEqual(prior.state.random, { seed: old.seed, cursor });
  runtime.assertValidSliceState(prior.state);
  const strict = runtime.openRedPriestRuntimeSession(prior.state);
  const continuedPublicSha256 = transition?.proof.continuedPublicSha256 ?? pin.publicSha256;
  assert.equal(stateHash(strict.snapshot()), pin.stateSha256); assert.equal(stateHash(strict.projectRedPriest()), continuedPublicSha256);
  const natural = JSON.parse(readFileSync(join(directory, 'natural.json'), 'utf8'));
  assert.deepEqual(natural.commands, [...old.commands, ...prior.commands]); assert.deepEqual(natural.final, prior.state);
  assert.equal(natural.stage, prior.terminal.stage); assert.deepEqual(natural.policy, previousPolicy);
  const ledger = readFileSync(join(directory, 'commands.ndjson'), 'utf8');
  assert.equal(ledger, prior.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const portableProducer = join(dirname(directory), 'prior-proof/producer.mjs');
  const producer = readFileSync(existsSync(portableProducer) ? portableProducer : join(root, archive));
  assert.equal(producer.length, pin.producer.bytes); assert.equal(sha(producer), pin.producer.sha256);
  const proof = { original: pin, newFreezeSha256: freeze.sha256, originalFilesDirectory: 'prior-observation',
    onlyAllowedFreezeChange: transition ? ['$natural-producer', ...definition.files] : ['$natural-producer'],
    producerFile: 'prior-proof/producer.mjs', ledgerFile: 'prior-proof/commands.ndjson',
    priorCommandsSha256: compactHash(prior.commands), priorRowsSha256: compactHash(prior.rows), priorPolicyState: prior.policy,
    priorTerminal: prior.terminal, previousPolicy, continuedPolicy: nextPolicy };
  if (transition) proof.runtimeTransition = { proofFile: 'prior-proof/runtime-transition.json', proofSha256: definition.sha256,
    commandCount: pin.commandCount, originalPublicSha256: pin.publicSha256, continuedPublicSha256, runtimeBeforeDirectory: 'prior-proof/runtime-before' };
  if (pin.commandCount === 974) proof.inheritedRuntimeTransition = clone(prior.lineage.runtimeTransition);
  mkdirSync(join(output, proof.originalFilesDirectory));
  for (const { file } of pin.originalFiles)
    durableCreate(join(output, proof.originalFilesDirectory, file), readFileSync(join(directory, file)));
  syncDirectory(join(output, proof.originalFilesDirectory)); verifyOriginalFiles(join(output, proof.originalFilesDirectory), pin);
  copyPriorEvidence(directory, join(output, proof.originalFilesDirectory), prior);
  mkdirSync(join(output, 'prior-proof'));
  durableCreate(join(output, proof.producerFile), producer); durableCreate(join(output, proof.ledgerFile), ledger);
  if (transition) {
    durableCreate(join(output, proof.runtimeTransition.proofFile), transition.bytes);
    const portableBefore = join(dirname(directory), proof.runtimeTransition.runtimeBeforeDirectory);
    const beforeRoot = existsSync(portableBefore) ? portableBefore : join(root, definition.beforeSource);
    for (const change of transition.proof.changedFiles) {
      const from = join(beforeRoot, change.file), to = join(output, proof.runtimeTransition.runtimeBeforeDirectory, change.file);
      assert.deepEqual(fileEvidence(from), change.before); mkdirSync(dirname(to), { recursive: true });
      durableCreate(to, readFileSync(from)); syncDirectory(dirname(to));
    }
  }
  const proofText = JSON.stringify(proof); durableCreate(join(output, 'prior-proof/lineage.json'), proofText); syncDirectory(join(output, 'prior-proof'));
  const lineage = { ...proof, proofFile: 'prior-proof/lineage.json', proofSha256: sha(proofText) };
  const continued = { ...prior, freezeSha256: freeze.sha256, publicStateSha256: continuedPublicSha256, policyDefinition: nextPolicy, lineage, terminal: null };
  verifyContinuationLineage(continued, output, freeze);
  return continued;
}
function parseOptions(args) {
  const options = { out: null, resume: null, continueFrom: null, maxNew: Infinity };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index], value = args[++index];
    assert(value !== undefined, `Missing value for ${flag}`);
    if (flag === '--out') { assert.equal(options.out, null); options.out = resolve(value); }
    else if (flag === '--resume') { assert.equal(options.resume, null); options.resume = resolve(value); }
    else if (flag === '--continue-from') { assert.equal(options.continueFrom, null); options.continueFrom = resolve(value); }
    else if (flag === '--max-new') { assert.equal(options.maxNew, Infinity); assert(/^\d+$/.test(value)); options.maxNew = Number(value); assert(Number.isSafeInteger(options.maxNew)); }
    else throw Error(`Unsupported option ${flag}; no seed, outcome, source, resource or policy overrides exist`);
  }
  if (options.resume) { assert(!options.out || options.out === dirname(options.resume), 'Resume must use the original output directory'); options.out = dirname(options.resume); }
  if (options.continueFrom) { assert(!options.resume, 'Choose continuation or same-runtime resume'); assert(options.out, 'Continuation requires an explicit new --out directory'); }
  return options;
}
export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args), root = process.cwd();
  assert.equal(resolve(root, 'scripts/play/red-priest-stage.mjs'), SELF, 'Run from the matching frozen repository root');
  const old = readSource(root), freeze = inspectFreeze(root), stamps = stampFreeze(root, freeze);
  const runtime = await loadRuntime(root), initialState = verifyMigration(runtime, old.final), initialStateSha256 = stateHash(initialState);
  if (!options.out) { mkdirSync(join(root, 'output/play'), { recursive: true }); options.out = mkdtempSync(join(root, 'output/play/red-priest-02090-')); }
  mkdirSync(options.out, { recursive: true });
  const checkpointPath = options.resume ?? join(options.out, 'checkpoint.json'), freezePath = join(options.out, 'freeze.json');
  assert(!relative(options.out, checkpointPath).startsWith('..'));
  let saved, session = null, stage = null, reason = null, committedThisInvocation = 0;
  if (options.resume) {
    recoverAtomicNext(checkpointPath); saved = decodeCheckpoint(readFileSync(checkpointPath, 'utf8'));
    assert.deepEqual(JSON.parse(readFileSync(freezePath, 'utf8')), freeze, 'Original freeze manifest must remain unchanged');
    verifyCheckpoint(saved.payload, old, freeze, initialStateSha256);
    verifyContinuationLineage(saved.payload, options.out, freeze);
    if (saved.payload.terminal) { stage = saved.payload.terminal.stage; reason = saved.payload.terminal.reason; }
  } else if (options.continueFrom) {
    const continued = prepareContinuation(options.continueFrom, options.out, root, old, freeze, runtime, initialStateSha256);
    durableCreate(freezePath, JSON.stringify(freeze)); syncDirectory(options.out);
    saved = saveCheckpoint(checkpointPath, continued, null);
  } else {
    assert(!existsSync(checkpointPath) && !existsSync(`${checkpointPath}.next`) && !existsSync(freezePath), 'Refuse to overwrite an existing natural run; use --resume');
    const state = initialState, publicState = runtime.projectSliceState(state).redPriest;
    durableCreate(freezePath, JSON.stringify(freeze)); syncDirectory(options.out);
    saved = saveCheckpoint(checkpointPath, { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, prefixSha256: PREFIX_SHA256,
      freezeSha256: freeze.sha256, policyDefinition: POLICY, policy: startingPolicy(), createdAt: new Date().toISOString(),
      commandCount: PREFIX_COUNT, commands: [], rows: [], state, initialStateSha256, finalStateSha256: initialStateSha256, publicStateSha256: stateHash(publicState),
      pending: null, terminal: null }, null);
  }
  try {
    if (saved.payload.state.redPriest.guidanceKnown) session = runtime.openRedPriestRuntimeSession(saved.payload.state);
    const project = () => session ? session.projectRedPriest() : runtime.projectSliceState(saved.payload.state).redPriest;
    assert.equal(stateHash(project()), saved.payload.publicStateSha256, 'Resume public projection differs from its captured boundary');
    while (!stage) {
      unchangedSinceFreeze(stamps);
      const boundary = saved.payload;
      if (boundary.state.status !== 'ACTIVE') { stage = 'NATURAL_ACTUAL_TERMINAL'; reason = `Actual ${boundary.state.status}`; break; }
      // Complete a durable pending intent before honoring a newly supplied pause.
      if (!boundary.pending && committedThisInvocation >= options.maxNew) { stage = 'MANUAL_PAUSE_COMPLETED_ACTION_BOUNDARY'; reason = 'Requested action-boundary pause'; break; }
      if (!boundary.pending && boundary.commands.length >= POLICY.maximumNewCommands) { stage = 'FINITE_COMMAND_BUDGET'; reason = 'Finite public strategy exhausted'; break; }
      let pending = boundary.pending;
      if (!pending) {
        const view = project(), decision = chooseAction(view, boundary.policy, boundary.policyDefinition);
        if (decision.stop) { stage = decision.stop; reason = decision.reason; break; }
        pending = { commandCount: boundary.commandCount + 1, intent: { type: 'RED_PRIEST', command: clone(decision.action.command) }, decision,
          beforeStateSha256: boundary.finalStateSha256, publicBeforeSha256: stateHash(view), startedAt: new Date().toISOString() };
        saved = saveCheckpoint(checkpointPath, { ...boundary, pending }, saved.sha256);
      }
      const view = project(), offered = view.actions.find(a => isDeepStrictEqual(a.command, pending.intent.command));
      assert(offered?.enabled, `Captured public action is not enabled: ${offered?.reason ?? 'missing'}`);
      assert.equal(stateHash(view), pending.publicBeforeSha256);
      const before = saved.payload.state, started = performance.now();
      let draft = null, next, after;
      if (session) {
        draft = session.prepare(pending.intent, before.revision);
        next = session.snapshotDraft(draft); after = session.projectDraftRedPriest(draft);
      } else {
        assert.deepEqual(pending.intent.command, { type: 'LEARN_GUIDANCE' });
        next = runtime.applySliceIntent(before, pending.intent);
        session = runtime.openRedPriestRuntimeSession(next); after = session.projectRedPriest();
      }
      assert.equal(next.revision, before.revision + 1); checkOriginals(next, old);
      const row = { commandCount: pending.commandCount, intent: clone(pending.intent), commandSha256: compactHash(pending.intent),
        reason: pending.decision.reason, publicLabel: offered.label, startedAt: pending.startedAt, elapsedMilliseconds: Math.round(performance.now() - started),
        revision: next.revision, beforeStateSha256: pending.beforeStateSha256, afterStateSha256: stateHash(next),
        publicBeforeSha256: pending.publicBeforeSha256, publicAfterSha256: stateHash(after),
        randomBefore: clone(before.random), randomAfter: clone(next.random) };
      const completed = { ...saved.payload, state: next, finalStateSha256: row.afterStateSha256, publicStateSha256: row.publicAfterSha256,
        commandCount: pending.commandCount, commands: [...saved.payload.commands, clone(pending.intent)], rows: [...saved.payload.rows, row],
        policy: advancePolicy(pending.decision, after), pending: null };
      // Write the complete prepared result BEFORE the in-memory commit. An
      // interrupted commit opens this already-durable exact state on resume.
      saved = saveCheckpoint(checkpointPath, completed, saved.sha256);
      if (draft) session.commit(draft);
      committedThisInvocation++;
      console.log(JSON.stringify({ completed: pending.commandCount, action: offered.label, week: next.week, sequence: next.progression.sequence, milliseconds: row.elapsedMilliseconds }));
    }
    unchangedSinceFreeze(stamps); assert.deepEqual(inspectFreeze(root), freeze, 'Frozen input bytes changed during the natural run');
    assert.equal(fileEvidence(join(root, SOURCE)).sha256, SOURCE_SHA256);
    verifyCheckpoint(saved.payload, old, freeze, initialStateSha256);
    verifyContinuationLineage(saved.payload, options.out, freeze);
    if (options.continueFrom) verifyOriginalFiles(options.continueFrom, saved.payload.lineage.original);
    runtime.assertValidSliceState(saved.payload.state); // Full strict raw-state replay/validation at the final boundary.
    if (saved.payload.state.redPriest.guidanceKnown) {
      const strict = runtime.openRedPriestRuntimeSession(saved.payload.state);
      assert.equal(stateHash(strict.snapshot()), saved.payload.finalStateSha256);
      assert.equal(stateHash(strict.projectRedPriest()), saved.payload.publicStateSha256);
    }
    const paused = stage === 'MANUAL_PAUSE_COMPLETED_ACTION_BOUNDARY';
    if (!paused && !saved.payload.terminal) saved = saveCheckpoint(checkpointPath, { ...saved.payload, terminal: { stage, reason } }, saved.sha256);
    const finalView = project();
    replaceDerived(join(options.out, 'commands.ndjson'), saved.payload.rows.map(row => JSON.stringify(row)).join('\n') + (saved.payload.rows.length ? '\n' : ''));
    replaceDerived(join(options.out, 'natural.json'), JSON.stringify({ provenance: { kind: 'EXACT_ORIGINAL_LIVING_PUBLIC_RED_PRIEST_CONTINUATION',
      source: SOURCE, sourceSha256: SOURCE_SHA256, prefixCommandsSha256: PREFIX_SHA256, runtimeFreezeSha256: freeze.sha256,
      historicalPrefixReplayedByThisProducer: false, historicalPrefixRetainedExactly: true, originalCaptureMayNotChange: true,
      privateAudit: true, seedChanged: false, selectedFromEnabledPublicActionsOnly: true,
      ...(saved.payload.lineage ? { continuation: { proofFile: saved.payload.lineage.proofFile, proofSha256: saved.payload.lineage.proofSha256, originalCommandCount: saved.payload.lineage.original.commandCount } } : {}) },
      creation: old.creation, seed: old.seed, prefixCount: PREFIX_COUNT, commands: [...old.commands, ...saved.payload.commands],
      initial: old.initial, prefixFinal: old.final, policy: saved.payload.policyDefinition, ...(saved.payload.lineage ? { lineage: saved.payload.lineage } : {}),
      stage, reason, pendingIntent: null, final: saved.payload.state }));
    // No private state, seed/cursor, receipts, hidden source details or digests in
    // the public summary. The private checkpoint/freeze/ledger are separate files.
    replaceDerived(join(options.out, 'summary.json'), JSON.stringify({ stage, reason, commands: saved.payload.commandCount,
      originalCommands: PREFIX_COUNT, newCommands: saved.payload.commands.length, paused, strictFinalValidation: true,
      public: { title: finalView.title, promoted: finalView.promoted, nextStep: finalView.nextStep,
        resources: finalView.resources, abilities: finalView.abilities, sections: finalView.sections } }));
    console.log(JSON.stringify({ outputDir: options.out, stage, commands: saved.payload.commandCount, paused }));
    return { outputDir: options.out, stage, commands: saved.payload.commandCount, paused };
  } catch (error) {
    // Preserve checkpoint.json and any complete/incomplete .next. The error file
    // is diagnostic only; it can never authorize a different action or state.
    try { replaceDerived(join(options.out, 'error.json'), JSON.stringify({ stage: 'CAPTURE_INTERRUPTED', error: String(error),
      checkpoint: checkpointPath, resumeExactPendingRequired: true, commandCount: saved?.payload.commandCount ?? null, at: new Date().toISOString() })); } catch { /* original error and durable checkpoint remain authoritative */ }
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
