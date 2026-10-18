import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

/** Exact actual688 living S2 continuation. Importing this module never loads the game.
 * Invoke only after the parent validates and freezes src/dist. Required:
 * --source tests/fixtures/apocalypse-demoness-v01990/boundary-step-688-action.json
 * --out <new directory>; --max-new-actions=0/1/N counts this invocation (default32).
 * Source is the wrapper's .final, never the old854 sixth-bottle success archive.
 * The original688 commands are retained, never replayed. Public-only fixed resource
 * rules pay for purification, same-original recovery, optional support, and S1 life;
 * after real S0 guidance, only the owned chapter's exact public preferred action.
 * Persist intent -> prepare action -> atomic complete checkpoint -> compact receipt
 * and sparse key snapshots -> owned commit. No build, future draw, seed/cursor edit,
 * alternate strategy, outcome reload, copied per-action full history or upload.
 * Resume repairs only a known incomplete receipt from its saved COMPLETE result.
 * --resume --max-new-actions=0 is strictly read-only at a closed action boundary.
 * Retain this WHOLE directory, the source wrapper, archive and frozen src/dist.
 */
export const FORMAT = 'NEW221_ACTUAL688_RECOVERY_COMPACT_OWNED_V1';
export const HASH_ENCODING = 'SORTED_KEYS_CANONICAL_JSON_UTF8_SHA256';
export const SOURCE = 'tests/fixtures/apocalypse-demoness-v01990/boundary-step-688-action.json';
export const HISTORY = 'tests/fixtures/apocalypse-demoness-v01990/natural.json';
export const HISTORY_SHA256 = 'baf997edd399bee66132fc7278a741968063dee012e960c9e2fc80ae1f1f4339';
export const PREFIX_SHA256 = 'e7020f05603b64ded38f60da0fea7bb5c2031c0bb40ad1de9328a969a1b30a23';
export const SOURCE_SHA256 = '34e43b3cb872a7c43851e5d3d583983e06b2081d8645bc42cd10b6d243a5bb67';
export const SOURCE_STATE_SHA256 = '8af32e14eb3c151815f6ec8a0bf215e701e4f01945d417c04312fb5a6bf1f3f0';
export const PREFIX_COUNT = 688;
export const SOURCE_REVISION = 689;
export const SNAPSHOT_INTERVAL = 16;
const SELF = fileURLToPath(import.meta.url), TEST = 'scripts/play/demoness-stage.test.mjs';
const HOME = 'DM221-GALLERY-EXIT', clone = value => structuredClone(value);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function stable(value) {
  const canonical = node => {
    if (node === null || typeof node === 'string' || typeof node === 'boolean') return node;
    if (typeof node === 'number') { assert(Number.isFinite(node)); return Object.is(node, -0) ? 0 : node; }
    if (Array.isArray(node)) return node.map(canonical);
    assert(node && typeof node === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(node)), 'Expected canonical JSON');
    return Object.fromEntries(Object.keys(node).sort().map(key => [key, canonical(node[key])]));
  };
  return JSON.stringify(canonical(value));
}
export const stateHash = value => sha(stable(value));
export function portableSourcePath(root, source) {
  const name = relative(resolve(root), resolve(root, source)).split(sep).join('/');
  assert(name && name !== '..' && !name.startsWith('../') && !isAbsolute(name), 'Source must remain inside the repository');
  assert.equal(name, SOURCE, 'Use the canonical actual688 boundary wrapper location');
  return name;
}
export function sealRow(payload) { return { ...payload, rowSha256: stateHash(payload) }; }
export function verifyRow(row) {
  const { rowSha256, ...payload } = row;
  assert.equal(rowSha256, stateHash(payload), 'Receipt checksum mismatch');
  assert.equal(row.commandSha256, stateHash(row.intent), 'Command checksum mismatch');
}
export function snapshotReasons({ newCount, beforeIntent = null, afterIntent = null, terminal = false }) {
  assert(Number.isSafeInteger(newCount) && newCount >= 0);
  const promotion = intent => ['DEMONESS', 'APOCALYPSE_DEMONESS'].includes(intent?.type) && intent.command?.type === 'CONSUME';
  return [newCount === 0 && !beforeIntent && !afterIntent && !terminal ? 'initial' : null,
    newCount > 0 && newCount % SNAPSHOT_INTERVAL === 0 && afterIntent ? 'periodic' : null,
    promotion(beforeIntent) ? 'before-consume' : null, promotion(afterIntent) ? 'after-consume' : null,
    afterIntent?.type === 'DEMONESS' && afterIntent.command?.type === 'LEARN_GUIDANCE' ? 's0-guidance' : null,
    afterIntent?.type === 'APOCALYPSE_DEMONESS' && afterIntent.command?.type === 'REFLECT' ? 's1-reflection' : null,
    afterIntent?.type === 'APOCALYPSE_DEMONESS' && afterIntent.command?.type === 'RECOVER_CHARACTERISTIC_V1' ? 'same-original-recovery' : null,
    terminal ? 'terminal' : null].filter(Boolean);
}
const block = reason => ({ stop: 'PUBLIC_ACTION_BLOCKED', reason });
const ordinary = (view, rule, forceRest = false) => {
  if (!view.canAct || view.apocalypseDemoness?.insideCase || view.apocalypseDemoness?.preparedWeek !== null)
    return block(view.actionBlockedReason ?? 'Real scene or prepared promotion forbids ordinary recovery');
  const action = forceRest || view.wagePaid ? 'REST' : 'WORK';
  return { intent: { type: 'ACTION', action }, publicAction: { kind: 'ORDINARY_RESOURCE', action, enabled: true,
    preferredAction: false, label: action, rule, publicBudget: publicBudget(view) } };
};
export const publicBudget = view => ({ week: view.week, health: view.health, mind: view.mind,
  spirituality: view.spirituality, cash: view.cash, actionsRemaining: view.actionsRemaining,
  pollution: view.pollution, wagePaid: view.wagePaid });
const budgetReady = (view, { cash = 0, ap = 1, health = 0, mind = 0, spirituality = 0, pollution = 100 } = {}) =>
  view.cash >= cash && view.actionsRemaining >= ap && view.health >= health && view.mind >= mind && view.spirituality >= spirituality && view.pollution <= pollution;
const fullBudget = cash => ({ cash, health: 100, mind: 100, spirituality: 120, pollution: 0 });
const selected = (type, action, rule) => ({ intent: { type, command: clone(action.command) },
  publicAction: { ...clone(action), selectionRule: rule } });
const newestBottle = actions => [...actions].sort((a, b) => Number(b.command.bottleId.split('-').at(-1)) - Number(a.command.bottleId.split('-').at(-1)))[0];
/** Only the current public projection and previous committed public intent choose
 * a command. No private state, random stream, source digest or future result enters.
 * Paid support is a fixed policy. Never silently drink without that support.
 * Real failures continue through newly paid recovery of that same original only.
 */
export function chooseAction(view, lastIntent = null) {
  if (view.status !== 'ACTIVE') return { stop: 'NATURAL_TERMINAL', reason: `Actual runtime status ${view.status}` };
  if (view.activeEvent || view.combat) return block('An inherited event or combat cannot be bypassed');
  if (view.demoness.guidanceKnown) {
    const preferred = view.demoness.actions.filter(action => action.preferredAction === true);
    if (preferred.length !== 1) return block(`Expected exactly one public preferred action; found ${preferred.length}. ${view.demoness.nextStep ?? ''}`);
    return preferred[0].enabled ? selected('DEMONESS', preferred[0], 'EXACT_PUBLIC_PREFERRED') : block(`${preferred[0].label}: ${preferred[0].reason ?? 'Public prerequisite unresolved'}`);
  }
  const apoc = view.apocalypseDemoness, actions = apoc?.actions ?? [];
  const byType = type => actions.filter(action => action.command.type === type);
  const use = (action, rule) => action?.enabled ? selected('APOCALYPSE_DEMONESS', action, rule) : block(action?.reason ?? `Missing public action: ${rule}`);
  if (view.progression.pathwayId !== 'demoness') return block('The original demoness pathway must remain unchanged');
  if (view.progression.sequence === 2) {
    if (apoc.preparedWeek !== null) {
      const consume = byType('CONSUME').find(a => a.enabled);
      if (!consume) return block('Prepared original dose has no enabled public consumption control');
      const supported = lastIntent?.type === 'APOCALYPSE_DEMONESS' && lastIntent.command.type === 'STABILIZE_PROMOTION' && lastIntent.command.bottleId === consume.command.bottleId;
      return supported ? use(consume, 'PAID_SUPPORTED_SAME_ORIGINAL_CONSUMPTION') : use(byType('STABILIZE_PROMOTION').find(a => a.command.bottleId === consume.command.bottleId), 'PAY_SAME_BOTTLE_STABILITY');
    }
    if (apoc.insideCase) return block('S2 recovery cannot bypass an inherited physical scene');
    if (view.pollution > 0) return ordinary(view, 'ACTUAL_S2_PURIFICATION_REST', true);
    const recover = byType('RECOVER_CHARACTERISTIC_V1')[0];
    if (recover) return recover.enabled ? use(recover, 'ACTUAL_PAID_SAME_ORIGINAL_RECOVERY') : ordinary(view, 'REAL_WEEK_AND_AP_FOR_PENDING_RECOVERY');
    const labour = newestBottle(byType('POTION_WORK'));
    if (labour) return budgetReady(view) ? use(labour, 'FIVE_REAL_SAME_ORIGINAL_LABOUR_STEPS') : ordinary(view, 'REAL_AP_FOR_POTION_LABOUR');
    const buy = newestBottle(byType('BUY_POTION'));
    if (buy) return budgetReady(view, fullBudget(330)) ? use(buy, 'PAY_NEW_DRUGS_AFTER_FIVE_REAL_LABOURS') : ordinary(view, 'REAL_WAGES_AND_REST_FOR_DRUGS_SITE_SUPPORT_AND_BILL');
    const held = byType('CONSUME')[0];
    if (held) return budgetReady(view, fullBudget(240)) ? use(byType('PREPARE_PROMOTION')[0], 'PAY_CURRENT_WEEK_ORIGINAL_SITE') : ordinary(view, 'REAL_BUDGET_FOR_SITE_SUPPORT_AND_BILL');
    const request = newestBottle(byType('REQUEST_RECOVERY_V1'));
    if (request) return budgetReady(view, fullBudget(150)) ? use(request, 'PAY_RECOVERY_OF_LATEST_ACTUAL_FAILED_ORIGINAL') : ordinary(view, 'REAL_RECOVERY_REQUEST_BUDGET');
    return block('No public same-original recovery route; never request independent new characteristics');
  }
  if (view.progression.sequence !== 1) return block('S0 guidance requires a real living S1 promotion');
  if (!apoc.life.reflected) {
    if (!apoc.insideCase && !budgetReady(view, fullBudget(300))) return ordinary(view, 'REAL_S1_LIFE_BUDGET');
    const preferred = apoc.life.actions.filter(a => a.id === apoc.life.preferredActionId);
    if (preferred.length !== 1) return block('S1 life has no unique public preferred action');
    return use(preferred[0], 'EXACT_PUBLIC_S1_LIFE_PREFERRED');
  }
  if (!budgetReady(view, fullBudget(100))) return ordinary(view, 'REAL_S0_GUIDANCE_BUDGET');
  const guidance = view.demoness.actions.filter(a => a.command.type === 'LEARN_GUIDANCE');
  if (guidance.length !== 1 || !guidance[0].enabled) return block(guidance[0]?.reason ?? 'Actual S1 reflection must open S0 guidance');
  return selected('DEMONESS', guidance[0], 'ACTUAL_S1_HANDOFF_TO_S0_GUIDANCE');
}
/** Mirror the core helper's exact public physical references, never admission identity. */
export function demonessPublicPhysicalActor(path, value) {
  const resident = value === null || value === 'GL2-CELIA' || value === 'GL2-EVAN';
  if (/^\$\.(?:unagingDemoness|calamityDemoness|apocalypseDemoness)\.(?:life|encounter)\..*(?:actorMoves|playerMoves|moves)\.\d+\.actorId$/.test(path)) return ['PLAYER', 'UD3-VERA', 'UD3-MARCUS'].includes(value);
  if (/^\$\.(?:divineHand|glory)\.(?:life\.(?:site|currentAttempt\.siteAt(?:Start|Close)|cases\.\d+\.attempts\.\d+\.siteAt(?:Start|Close)|ledger\.\d+\.originals(?:Before|After)\.site)|encounter\.(?:site|startSite))\.guard\.actorId$/.test(path)) return resident;
  if (/^\$\.glory\.life\.(?:currentAttempt|cases\.\d+\.attempts\.\d+)\.actorId$/.test(path)) return resident;
  return /^\$\.glory\.life\.(?:currentAttempt|cases\.\d+\.attempts\.\d+)\.(?:playerMoves|actorMoves)\.\d+\.actorId$/.test(path) &&
    (value === 'PLAYER' || value === 'GL2-CELIA' || value === 'GL2-EVAN');
}
export function assertPublicOnly(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter',
    'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'randomReceipts', 'sourceDigest', 'historyDigest',
    'originalWorldDigest', 'combatHistoryDigest', 'originalsDigest', 'acquisitionDigest', 'compoundDigest', 'beforeDigest', 'afterDigest',
    'actorId', 'predecessorActorId', 'incumbentActorId', 'custodianActorId', 'preparationRoll', 'futureRoll', 'nextRoll', 'privateSource']);
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}.${key}`, physicalActor = key === 'actorId' && demonessPublicPhysicalActor(next, child);
    assert(!(forbidden.has(key) && !physicalActor) && !(key === 'source' && child !== null && typeof child === 'object'), `Private public field ${next}`);
    assertPublicOnly(child, next);
  }
}
export function auditPublic(view, state) {
  assertPublicOnly(view); const text = JSON.stringify(view), secrets = new Set([state.random.seed, state.demoness.source?.actorId].filter(Boolean));
  // These inherited on-screen body labels are not private identities. The
  // actual admission actor above is always secret, regardless of its spelling.
  const physicalBodies = new Set(['PLAYER', 'GL2-CELIA', 'GL2-EVAN', 'UD3-VERA', 'UD3-MARCUS']);
  const collect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'actorId' && !physicalBodies.has(child) || ['predecessorActorId', 'incumbentActorId', 'custodianActorId'].includes(key) || key.endsWith('Digest')) && typeof child === 'string' && child)
        secrets.add(child);
      collect(child);
    }
  };
  collect(state.demoness);
  for (const secret of secrets) assert(!text.includes(secret), 'Whole public projection leaked an actual private identity, digest or seed');
}
const anchor = (state, view) => ({ revision: state.revision, privateStateSha256: stateHash(state),
  publicStateSha256: stateHash(view), random: clone(state.random), randomSha256: stateHash(state.random) });

/** Integrity check only: no historical/new-action replay. Revision is separate
 * from archived command count. The original688 commands stay in order; the separate full854 success archive is never replayed. */
export function verifyCommandChain(rows, { prefixCommands, initial }) {
  let previous = null, current = initial, newCount = 0;
  for (const [index, row] of rows.entries()) {
    verifyRow(row); assert.equal(row.previousRowSha256, previous, 'Broken receipt chain');
    assert.equal(row.commandCount, index + 1, 'Non-contiguous command count');
    if (index < prefixCommands.length) {
      assert.equal(row.kind, 'HISTORICAL_COMMAND'); assert.deepEqual(row.intent, prefixCommands[index]);
    } else {
      newCount++; assert.equal(row.kind, 'DEMONESS_CONTINUATION_ACTION'); assert.equal(row.newCount, newCount);
      assert(['DEMONESS', 'APOCALYPSE_DEMONESS', 'ACTION'].includes(row.intent.type)); assert.deepEqual(row.before, current, 'Broken private/public/RNG boundary');
      assert.equal(row.after.revision, initial.revision + newCount, 'Revision is not command count');
      assert.equal(row.after.randomSha256, stateHash(row.after.random)); assert.equal(row.before.randomSha256, stateHash(row.before.random));
      assert.equal(row.after.random.seed, row.before.random.seed);
      assert(Number.isSafeInteger(row.after.random.cursor) && row.after.random.cursor >= row.before.random.cursor);
      for (const side of [row.before, row.after]) for (const key of ['privateStateSha256', 'publicStateSha256', 'randomSha256'])
        assert(/^[a-f0-9]{64}$/.test(side[key]));
      assert.equal(row.publicAction.enabled, true);
      if (row.intent.type === 'ACTION') { assert.equal(row.publicAction.kind, 'ORDINARY_RESOURCE'); assert(['WORK', 'REST'].includes(row.intent.action)); assert.equal(row.intent.action, row.publicAction.action); }
      else { assert.deepEqual(row.intent.command, row.publicAction.command); assert.equal(typeof row.publicAction.selectionRule, 'string'); }
      if (row.intent.type === 'DEMONESS' && row.intent.command.type !== 'LEARN_GUIDANCE') assert.equal(row.publicAction.preferredAction, true);
      current = row.after;
    }
    previous = row.rowSha256;
  }
  assert(rows.length >= prefixCommands.length, 'Missing original command prefix');
  return { commandCount: rows.length, newCount, rowSha256: previous, anchor: current };
}
export function shouldPauseAtBoundary({ pending, completed, maxNewActions, pauseRequested = false }) {
  assert(Number.isSafeInteger(completed) && completed >= 0 && Number.isSafeInteger(maxNewActions) && maxNewActions >= 0);
  return !pending && (completed >= maxNewActions || pauseRequested);
}
export function parseOptions(args, root = process.cwd()) {
  const result = { source: null, out: null, resume: false, maxNewActions: 32 }, seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const split = args[i].indexOf('='), flag = split < 0 ? args[i] : args[i].slice(0, split);
    assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--resume') { assert.equal(split, -1, '--resume takes no value'); result.resume = true; continue; }
    assert(['--source', '--out', '--max-new-actions'].includes(flag), `Unsupported ${flag}: no seed, roll, strategy or outcome overrides`);
    const value = split < 0 ? args[++i] : args[i].slice(split + 1); assert(value && !value.startsWith('--'), `Missing value for ${flag}`);
    if (flag === '--max-new-actions') { assert(/^\d+$/.test(value)); result.maxNewActions = Number(value); assert(Number.isSafeInteger(result.maxNewActions)); }
    else result[flag.slice(2)] = resolve(root, value);
  }
  assert(result.source && result.out, 'Explicit --source and --out are required'); return result;
}
function regular(path) { const stat = lstatSync(path); assert(stat.isFile() && !stat.isSymbolicLink(), `Expected regular file: ${path}`); }
function fileEvidence(path) {
  regular(path); const before = lstatSync(path, { bigint: true });
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(65536); let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; hash.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  const after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(after[key], before[key], `File changed while hashing: ${path}`);
  assert.equal(BigInt(bytes), after.size); return { bytes, sha256: hash.digest('hex') };
}
function inspectFreeze(root, source) {
  const files = [], walk = name => {
    const path = join(root, name), stat = lstatSync(path); assert(!stat.isSymbolicLink(), `Frozen symlink: ${name}`);
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(join(name, child));
    else files.push({ file: name.split(sep).join('/'), ...fileEvidence(path) });
  };
  assert(existsSync(join(root, 'dist/domain/demoness/owned-session.js')), 'Build and freeze the reviewed runtime first; this producer never builds');
  for (const name of ['package.json', 'package-lock.json', 'src', 'dist', 'node_modules/@noble/hashes', 'scripts/play/demoness-stage.mjs', TEST]) walk(name);
  const payload = { nodeVersion: process.version, source: { path: portableSourcePath(root, source), ...fileEvidence(source) },
    history: { path: HISTORY, ...fileEvidence(join(root, HISTORY)) }, files };
  assert.equal(payload.source.sha256, SOURCE_SHA256); assert.equal(payload.history.sha256, HISTORY_SHA256);
  return { ...payload, sha256: stateHash(payload) };
}
function stamps(root, freeze) {
  return [...freeze.files.map(file => join(root, file.file)), join(root, freeze.source.path), join(root, freeze.history.path)].map(path => {
    const s = lstatSync(path, { bigint: true }); return { path, size: s.size, mtimeNs: s.mtimeNs, ctimeNs: s.ctimeNs, ino: s.ino };
  });
}
function unchanged(frozen) {
  for (const before of frozen) {
    const after = lstatSync(before.path, { bigint: true }); assert(after.isFile() && !after.isSymbolicLink());
    for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(after[key], before[key], `Frozen file changed: ${before.path}`);
  }
}
const syncDirectory = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
function durableWrite(path, bytes, mode = 'wx') {
  const fd = openSync(path, mode); try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
}
function unpack(path) { regular(path); return JSON.parse(gunzipSync(readFileSync(path)).toString('utf8')); }
function checkpointRead(path) {
  const saved = unpack(path); assert.equal(saved.sha256, stateHash(saved.payload), 'Full checkpoint checksum mismatch');
  assert.equal(saved.payload.format, FORMAT); return saved;
}
function checkpointSave(path, payload, predecessorSha256) {
  assert(!existsSync(`${path}.next`), 'Preserve and recover the checkpoint successor');
  const saved = { payload: { ...payload, predecessorSha256 } }; saved.sha256 = stateHash(saved.payload);
  durableWrite(`${path}.next`, gzipSync(JSON.stringify(saved), { level: 6 }));
  renameSync(`${path}.next`, path); syncDirectory(dirname(path)); return saved;
}
function checkpointRecover(path, validate) {
  if (!existsSync(`${path}.next`)) return;
  const current = existsSync(path) ? checkpointRead(path) : null, next = checkpointRead(`${path}.next`);
  assert.equal(next.payload.predecessorSha256, current?.sha256 ?? null, 'Unknown checkpoint successor; preserve for inspection');
  validate(next.payload, current?.payload ?? null);
  renameSync(`${path}.next`, path); syncDirectory(dirname(path));
}
/** The checkpoint file is a boundary wrapper. Accept only its COMPLETE .final,
 * never beforeLast or the old archive's later successful sixth independent dose. */
export function unwrapSource(wrapper) {
  assert(wrapper && typeof wrapper === 'object' && !Array.isArray(wrapper), 'Expected complete boundary wrapper');
  assert.equal(wrapper.commandCount, PREFIX_COUNT);
  assert(wrapper.final && wrapper.beforeLast && wrapper.lastIntent, 'Incomplete boundary wrapper');
  assert.equal(wrapper.final.revision, SOURCE_REVISION); assert.equal(wrapper.beforeLast.revision, SOURCE_REVISION - 1);
  assert.equal(wrapper.final.status, 'ACTIVE'); assert.equal(wrapper.final.progression.pathwayId, 'demoness');
  assert.equal(wrapper.final.progression.sequence, 2); return wrapper.final;
}
export function verifySourceProvenance(wrapper, archive) {
  const source = unwrapSource(wrapper); assert.equal(stateHash(source), SOURCE_STATE_SHA256);
  assert.equal(archive.commands.length, 854); assert.equal(archive.final.status, 'ACTIVE'); assert.equal(archive.final.progression.sequence, 1);
  assert.equal(archive.prefixCount, 585); assert.equal(archive.prefixFinal.revision, 586); assert.equal(archive.prefixVerified, true);
  assert.equal(archive.provenance.inheritedDirectedPrefix, false); assert.equal(archive.provenance.newRandomChanges, false);
  const prefixCommands = archive.commands.slice(0, PREFIX_COUNT);
  assert.equal(stateHash(prefixCommands), PREFIX_SHA256, 'Original688 command prefix changed');
  assert.deepEqual(wrapper.lastIntent, prefixCommands.at(-1)); assert.deepEqual(wrapper.lastIntent, { type: 'ACTION', action: 'WORK' });
  assert.deepEqual(archive.commands[PREFIX_COUNT], { type: 'APOCALYPSE_DEMONESS', command: { type: 'REQUEST_SUPPLY' } });
  assert.equal(source.revision, archive.prefixFinal.revision + PREFIX_COUNT - archive.prefixCount);
  assert.equal(archive.final.revision, source.revision + archive.commands.length - PREFIX_COUNT);
  assert.equal(source.week, 174); assert.equal(source.progression.acting, 100); assert.deepEqual(source.injuries, []);
  assert.deepEqual([source.health, source.mind, source.spirituality, source.cash, source.actionsRemaining, source.seer.pollution], [83, 65, 120, 230, 2, 50]);
  assert.deepEqual(source.random, { seed: 'assassin-natural-v045', cursor: 210 });
  assert.equal(source.apocalypseDemoness.bottles.length, 3); assert(source.apocalypseDemoness.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome)));
  assert.equal(source.calamityDemoness.encounter.currentSite.playerLocation, 'OUTSIDE'); assert.equal(source.calamityDemoness.encounter.currentSite.playerEnergy, 22);
  return { prefixCommands, provenance: { kind: 'EXACT688_BOUNDARY_FINAL_THEN_SAME_ORIGINAL_RECOVERY',
    snapshotPath: SOURCE, snapshotRoot: 'final', snapshotSha256: SOURCE_SHA256, snapshotStateSha256: SOURCE_STATE_SHA256,
    historyPath: HISTORY, historySha256: HISTORY_SHA256, originalArchiveCommandCount: archive.commands.length,
    originalArchiveTerminalStatus: archive.final.status, archiveRole: 'READ_ONLY_OLD_SIXTH_INDEPENDENT_BOTTLE_SUCCESS_NOT_SOURCE',
    prefixCommandCount: PREFIX_COUNT, prefixCommandsSha256: PREFIX_SHA256, sourceRevision: SOURCE_REVISION,
    nextCommandCount: PREFIX_COUNT + 1, nextRevision: SOURCE_REVISION + 1,
    originalProvenance: clone(archive.provenance), originalContinuation: clone(archive.continuation),
    historicalPrefixReplayed: false, inheritedDirectedPrefix: false, fullNaturalS9ToS0: false } };
}
function readSource(path, historyPath) {
  regular(path); regular(historyPath); const bytes = readFileSync(path), historyBytes = readFileSync(historyPath);
  assert.equal(sha(bytes), SOURCE_SHA256, 'Only the exact actual688 boundary wrapper is admitted');
  assert.equal(sha(historyBytes), HISTORY_SHA256, 'Preserve the exact separate854-command old success archive');
  const wrapper = JSON.parse(bytes), archive = JSON.parse(historyBytes);
  return { source: unwrapSource(wrapper), bytes, historyBytes, ...verifySourceProvenance(wrapper, archive) };
}
async function loadRuntime(root) {
  const [slice, migration, owned, source, content] = await Promise.all(['domain/slice/index', 'domain/slice/migration',
    'domain/demoness/owned-session', 'domain/demoness/source', 'domain/demoness/content']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  assert(content.DEMONESS_PLACES.some(place => place.id === HOME));
  assert.deepEqual(source.DEMONESS_FROZEN_SOURCE_KEYS, ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'despair', 'unagingDemoness', 'calamityDemoness', 'apocalypseDemoness']);
  return { ...slice, migrateSliceState: migration.migrateSliceState, openDemonessRuntimeSession: owned.openDemonessRuntimeSession,
    frozenSourceKeys: [...source.DEMONESS_FROZEN_SOURCE_KEYS] };
}
function migrate(runtime, original) {
  const state = runtime.migrateSliceState(original); assert.equal(stateHash(original), SOURCE_STATE_SHA256);
  for (const [key, value] of Object.entries(original)) if (!['schemaVersion', 'contentVersion'].includes(key))
    assert.deepEqual(state[key], value, `Migration changed original root ${key}`);
  assert.equal(state.schemaVersion, 218); assert.equal(state.contentVersion, 'demoness-v218');
  runtime.assertValidSliceState(state); return state;
}
/** Before real S0 guidance, S1 must evolve. Freeze its completed ninth root
 * only at the actual handoff, represented by compact hashes rather than another
 * full history copy. The first eight roots and all original688 receipts stay exact. */
export function freezePredecessors(state, sourceKeys) {
  assert.equal(state.demoness.guidanceKnown, true);
  return { revision: state.demoness.source.revision,
    roots: Object.fromEntries(sourceKeys.map(key => [key, stateHash(state[key])])) };
}
export function assertOriginalRoots(state, original, sourceKeys, predecessorFreeze = null) {
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, original.random.seed);
  for (const key of [...sourceKeys.filter(key => key !== 'apocalypseDemoness'), 'world', 'combatHistory']) {
    assert(Object.hasOwn(original, key), `Missing inherited root: ${key}`);
    assert.deepEqual(state[key], original[key], `Inherited root changed: ${key}`);
  }
  const prior = original.apocalypseDemoness, current = state.apocalypseDemoness;
  for (const key of ['sourceHistory', 'sourceScene']) assert.deepEqual(current[key], prior[key], `Original S1 ${key} changed`);
  assert.deepEqual(current.bottles.slice(0, 3), prior.bottles, 'Original three failures were rewritten');
  assert.deepEqual(current.acquisitionJournal.slice(0, prior.acquisitionJournal.length), prior.acquisitionJournal, 'Original acquisition receipts changed');
  assert.deepEqual(current.life.journal.slice(0, prior.life.journal.length), prior.life.journal, 'Original life receipts changed');
  if (state.demoness.guidanceKnown) {
    assert(predecessorFreeze, 'Missing actual S0-guidance predecessor freeze');
    assert.deepEqual(freezePredecessors(state, sourceKeys), predecessorFreeze, 'Post-guidance predecessor roots changed');
    const sourceCharacter = clone(original.character);
    for (const key of Object.keys(sourceCharacter.coreStats)) sourceCharacter.coreStats[key] = Math.min(500, sourceCharacter.coreStats[key] + 1);
    assert.deepEqual(state.demoness.source.character, sourceCharacter, 'Actual S1 source character changed');
  } else assert.equal(predecessorFreeze, null, 'Cannot freeze evolving S1 before actual S0 guidance');
  const promotions = 2 - state.progression.sequence; assert([0, 1, 2].includes(promotions));
  const expectedCharacter = clone(original.character);
  for (const key of Object.keys(expectedCharacter.coreStats)) expectedCharacter.coreStats[key] = Math.min(500, expectedCharacter.coreStats[key] + promotions);
  assert.deepEqual(state.character, expectedCharacter, 'Unexpected live character change');
  for (const [key, value] of Object.entries(original.progression.mastery)) assert.equal(state.progression.mastery[key], value, `Old mastery changed: ${key}`);
}
export function assertOriginals(state, original, before, sourceKeys, intent, predecessorFreeze) {
  assertOriginalRoots(state, original, sourceKeys, predecessorFreeze);
  assert(state.random.cursor >= before.random.cursor); assert.equal(state.revision, before.revision + 1);
  if (before.progression.sequence !== state.progression.sequence) {
    assert.equal(state.progression.sequence, before.progression.sequence - 1); assert.equal(intent.command?.type, 'CONSUME');
    assert.equal(intent.type, before.progression.sequence === 2 ? 'APOCALYPSE_DEMONESS' : 'DEMONESS');
    assert.equal(state[state.progression.sequence === 1 ? 'apocalypseDemoness' : 'demoness'].promotionWeek, state.week);
  }
  if (state.status === 'DEAD') assert.equal(state.ending?.kind, 'DEATH');
}
function receipt(next, before) {
  const latest = next.demoness.journal.at(-1);
  if (latest?.revision === next.revision) return { id: latest.id, checks: clone(latest.checks), finance: clone(latest.financeReceipts), notes: clone(latest.notes), beforeDigest: latest.beforeDigest, afterDigest: latest.afterDigest };
  // The full real result is already in the rolling checkpoint. This bounded
  // receipt references only the newly appended acquisition/life facts.
  const apoc = next.apocalypseDemoness, old = before.apocalypseDemoness;
  const acquisition = apoc.acquisitionJournal.slice(old.acquisitionJournal.length).map(e => ({ revision: e.revision, command: clone(e.command),
    before: clone(e.before), after: clone(e.after), check: clone(e.check), cursorBefore: e.cursorBefore, cursorAfter: e.cursorAfter }));
  const life = apoc.life.journal.slice(old.life.journal.length).map(e => ({ revision: e.revision, command: clone(e.command),
    before: clone(e.before), after: clone(e.after), check: clone(e.check), outcome: e.outcome }));
  return { id: null, acquisition, life, notes: clone(next.chronicle.slice(before.chronicle.length)) };
}
function snapshotContent(cp, view, reasons) {
  return { format: FORMAT, commandCount: cp.commandCount, newCount: cp.newCount, reasons, anchor: cp.anchor,
    final: cp.state, random: cp.state.random, public: view };
}
function planSnapshot(cp, view, reasons) {
  if (!reasons.length || reasons.length === 1 && reasons[0] === 'terminal' && cp.snapshots.some(item => item.commandCount === cp.commandCount && item.reasons.includes('terminal'))) return cp;
  const file = `key-${cp.commandCount}-${reasons.join('-')}.json.gz`;
  if (cp.snapshots.some(item => item.file === file)) return cp;
  return { ...cp, snapshots: [...cp.snapshots, { file, commandCount: cp.commandCount, newCount: cp.newCount,
    reasons, stateSha256: cp.anchor.privateStateSha256, publicSha256: cp.anchor.publicStateSha256,
    contentSha256: stateHash(snapshotContent(cp, view, reasons)) }] };
}
function materializeSnapshots(out, cp, view, { readOnly = false, verifyAll = false } = {}) {
  for (const item of cp.snapshots) {
    assert.equal(item.file, `key-${item.commandCount}-${item.reasons.join('-')}.json.gz`);
    const path = join(out, item.file), present = existsSync(path);
    if (!present) {
      assert(!readOnly, 'Zero-action resume will not repair a missing snapshot');
      assert.equal(item.stateSha256, cp.anchor.privateStateSha256, 'An older required snapshot is missing; do not replay it');
      const content = snapshotContent(cp, view, item.reasons); assert.equal(stateHash(content), item.contentSha256);
      if (existsSync(`${path}.next`)) assert.equal(stateHash(unpack(`${path}.next`)), item.contentSha256, 'Unknown snapshot successor');
      else durableWrite(`${path}.next`, gzipSync(JSON.stringify(content), { level: 6 }));
      renameSync(`${path}.next`, path); syncDirectory(out);
    }
    assert(!existsSync(`${path}.next`), 'Unexpected extra snapshot successor');
    if (present && !verifyAll) continue;
    const content = unpack(path); assert.equal(stateHash(content), item.contentSha256);
    assert.equal(content.commandCount, item.commandCount); assert.equal(content.newCount, item.newCount);
    assert.equal(stateHash(content.final), item.stateSha256); assert.equal(stateHash(content.public), item.publicSha256);
    assert.deepEqual(content.random, content.final.random); auditPublic(content.public, content.final);
  }
}
function traceRead(path) {
  regular(path); const text = readFileSync(path, 'utf8'), end = text.lastIndexOf('\n');
  return { complete: text.slice(0, end + 1), tail: text.slice(end + 1), rows: end < 0 ? [] : text.slice(0, end).split('\n').filter(Boolean).map(line => JSON.parse(line)) };
}
function reconcileTrace(path, cp, prefixCommands, initial, readOnly) {
  let trace = traceRead(path), chain = verifyCommandChain(trace.rows, { prefixCommands, initial });
  if (trace.rows.length === cp.commandCount - 1 && cp.lastRow) {
    assert(!readOnly, 'Zero-action resume will not append a missing completed receipt');
    assert.equal(cp.lastRow.previousRowSha256, chain.rowSha256); assert.deepEqual(cp.lastRow.before, chain.anchor);
    const line = `${JSON.stringify(cp.lastRow)}\n`; assert(line.startsWith(trace.tail), 'Unknown trailing bytes; preserve without replay');
    const pending = `${path}.next`;
    if (trace.tail || existsSync(pending)) {
      const repaired = trace.complete + line;
      if (existsSync(pending)) assert.equal(readFileSync(pending, 'utf8'), repaired, 'Unknown repaired trace successor');
      else durableWrite(pending, repaired);
      renameSync(pending, path); syncDirectory(dirname(path));
    } else durableWrite(path, line, 'a');
    trace = traceRead(path); chain = verifyCommandChain(trace.rows, { prefixCommands, initial });
  }
  assert(!existsSync(`${path}.next`), 'Unknown extra trace successor');
  assert.equal(trace.tail, '', 'Incomplete/unknown receipt tail; preserve for inspection');
  assert.equal(chain.commandCount, cp.commandCount); assert.equal(chain.newCount, cp.newCount);
  assert.equal(chain.rowSha256, cp.rowSha256); assert.deepEqual(chain.anchor, cp.anchor); return trace.rows;
}
export function outcome(state) {
  const root = state.demoness, passage = root.passage;
  return { status: state.status, sequence: state.progression.sequence,
    s1Promoted: state.apocalypseDemoness.promotionWeek !== null, s1Reflected: state.apocalypseDemoness.life.reflected,
    promoted: state.progression.sequence === 0 && root.promotionWeek !== null, promotionWeek: root.promotionWeek,
    passagePhase: passage?.phase ?? null, reported: !!passage?.returnReportEventId,
    ordinaryExit: passage?.position === -2 && passage.residents.length === 2 && passage.residents.every(person => person.position === -2 && !!person.returnPassage?.crossing && !!person.returnPassage?.exit),
    location: root.frame?.location ?? null, petrificationApplied: !!passage?.petrificationAppliedEventId,
    reshapingApplied: !!passage?.reshapingAppliedEventId, week: state.week, health: state.health, mind: state.mind, spirituality: state.spirituality };
}
/** Any death stops absolutely, including a death during the legitimate prelude.
 * A real closed, reported S0 return is terminal without inventing further work. */
export function terminal(state, view) {
  const actual = outcome(state);
  if (actual.status !== 'ACTIVE') return { stage: actual.status === 'DEAD' ? 'NATURAL_DEATH' : 'NATURAL_TERMINAL', reason: `Actual runtime status ${actual.status}` };
  if (!state.demoness.guidanceKnown || view.demoness.actions.some(action => action.preferredAction)) return null;
  if (actual.promoted && actual.reported && actual.ordinaryExit && actual.passagePhase === 'CLOSED')
    return { stage: 'NATURAL_S0_REPORTED_EXIT', reason: 'Actual S0 return reported after all participants used the ordinary exit' };
  return null;
}
function safeOutput(root, options) {
  assert.notEqual(options.out, root); assert(!root.startsWith(options.out + sep), 'Output cannot contain the runtime');
  for (const name of ['src', 'dist', 'scripts', 'tests', 'test-inputs', 'docs', 'node_modules', '.git']) {
    const protectedPath = join(root, name); assert(options.out !== protectedPath && !options.out.startsWith(protectedPath + sep), 'Output overlaps a protected input');
  }
  assert(!options.source.startsWith(options.out + sep), 'Original source must remain outside the output');
  for (let path = options.out; ; path = dirname(path)) {
    if (existsSync(path)) assert(lstatSync(path).isDirectory() && !lstatSync(path).isSymbolicLink(), `Unsafe output ancestor: ${path}`);
    if (dirname(path) === path) break;
  }
  if (!existsSync(options.out)) { assert(!options.resume, 'Missing resume directory'); mkdirSync(options.out, { recursive: true }); }
  for (const file of readdirSync(options.out)) regular(join(options.out, file));
}
function writeSummary(out, summary) {
  const path = join(out, 'summary.json'), next = `${path}.next`;
  assert(!existsSync(next), 'Preserve the interrupted summary successor before continuing');
  durableWrite(next, JSON.stringify(summary, null, 2) + '\n'); renameSync(next, path); syncDirectory(out);
}
export async function main(args = process.argv.slice(2)) {
  const root = process.cwd(), options = parseOptions(args, root);
  assert.equal(resolve(root, 'scripts/play/demoness-stage.mjs'), SELF, 'Run the reviewed producer from its matching repository root');
  portableSourcePath(root, options.source);
  const old = readSource(options.source, join(root, HISTORY)), freeze = inspectFreeze(root, options.source), frozen = stamps(root, freeze);
  const runtime = await loadRuntime(root), initialState = migrate(runtime, old.source), initialView = runtime.projectSliceState(initialState);
  auditPublic(initialView, initialState); const initial = anchor(initialState, initialView); safeOutput(root, options);
  const checkpoint = join(options.out, 'checkpoint.json.gz'), tracePath = join(options.out, 'commands.jsonl');
  const readOnly = options.resume && options.maxNewActions === 0;
  let saved, session = null, count = 0, pauseRequested = false;
  if (options.resume) {
    assert.deepEqual(JSON.parse(readFileSync(join(options.out, 'runtime-freeze.json'), 'utf8')), freeze, 'Source/runtime/producer fingerprint drift');
    assert.equal(sha(gunzipSync(readFileSync(join(options.out, 'source-snapshot.json.gz')))), SOURCE_SHA256);
    assert.equal(sha(gunzipSync(readFileSync(join(options.out, 'original854-natural.json.gz')))), HISTORY_SHA256);
    for (const [retained, original] of [['producer.mjs', SELF], ['producer-tests.mjs', join(root, TEST)]])
      assert.deepEqual(readFileSync(join(options.out, retained)), readFileSync(original));
    if (readOnly) assert(!readdirSync(options.out).some(name => name.endsWith('.next')), 'Zero-action resume requires a closed boundary without successors');
    else checkpointRecover(checkpoint, (candidate, previous) => {
      assert.equal(candidate.sourceSha256, SOURCE_SHA256); assert.equal(candidate.sourceStateSha256, SOURCE_STATE_SHA256);
      assert.equal(candidate.historySha256, HISTORY_SHA256); assert.equal(candidate.prefixCommandsSha256, PREFIX_SHA256);
      assert.deepEqual(candidate.provenance, old.provenance); assert.deepEqual(candidate.frozenSourceKeys, runtime.frozenSourceKeys);
      assert.equal(candidate.freezeSha256, freeze.sha256); assert.deepEqual(candidate.initial, initial);
      assert(Number.isSafeInteger(candidate.newCount) && candidate.newCount >= 0);
      assert.equal(candidate.commandCount, PREFIX_COUNT + candidate.newCount); assert.equal(candidate.state.revision, SOURCE_REVISION + candidate.newCount);
      if (previous) {
        const advance = candidate.commandCount - previous.commandCount;
        assert(advance === 0 || advance === 1, 'Unknown successor action jump');
        if (advance) {
          assert(previous.pending, 'Completed successor lacks its durable intent');
          assert.deepEqual(candidate.lastRow.intent, previous.pending.intent); assert.deepEqual(candidate.lastRow.before, previous.anchor);
        } else assert.deepEqual(candidate.anchor, previous.anchor, 'Action-free successor changed state');
      }
      assertOriginalRoots(candidate.state, old.source, runtime.frozenSourceKeys, candidate.predecessorFreeze);
      runtime.assertValidSliceState(candidate.state);
      const projection = runtime.projectSliceState(candidate.state); auditPublic(projection, candidate.state);
      assert.deepEqual(anchor(candidate.state, projection), candidate.anchor);
    });
    saved = checkpointRead(checkpoint);
  } else {
    assert.equal(readdirSync(options.out).length, 0, 'Refuse to overwrite old capture; use --resume');
    durableWrite(join(options.out, 'runtime-freeze.json'), JSON.stringify(freeze));
    durableWrite(join(options.out, 'source-snapshot.json.gz'), gzipSync(old.bytes, { level: 6 }));
    durableWrite(join(options.out, 'original854-natural.json.gz'), gzipSync(old.historyBytes, { level: 6 }));
    durableWrite(join(options.out, 'producer.mjs'), readFileSync(SELF)); durableWrite(join(options.out, 'producer-tests.mjs'), readFileSync(join(root, TEST)));
    let previous = null;
    const rows = old.prefixCommands.map((intent, index) => {
      const row = sealRow({ kind: 'HISTORICAL_COMMAND', commandCount: index + 1, intent, commandSha256: stateHash(intent), previousRowSha256: previous }); previous = row.rowSha256; return row;
    });
    durableWrite(tracePath, rows.map(row => JSON.stringify(row) + '\n').join(''));
    const cp = planSnapshot({ format: FORMAT, hashEncoding: HASH_ENCODING, sourceSha256: SOURCE_SHA256, sourceStateSha256: SOURCE_STATE_SHA256,
      historySha256: HISTORY_SHA256, prefixCommandsSha256: PREFIX_SHA256, provenance: old.provenance, frozenSourceKeys: runtime.frozenSourceKeys,
      freezeSha256: freeze.sha256, initial, state: initialState, anchor: initial, commandCount: PREFIX_COUNT, newCount: 0,
      rowSha256: previous, lastRow: null, pending: null, predecessorFreeze: null, snapshots: [], terminal: null,
      migration: { fromSchema: old.source.schemaVersion, toSchema: initialState.schemaVersion, initialStateSha256: initial.privateStateSha256 } }, initialView, ['initial']);
    saved = checkpointSave(checkpoint, cp, null);
  }
  const checkHeader = () => {
    const cp = saved.payload;
    assert.equal(cp.sourceSha256, SOURCE_SHA256); assert.equal(cp.sourceStateSha256, SOURCE_STATE_SHA256); assert.equal(cp.hashEncoding, HASH_ENCODING);
    assert.equal(cp.historySha256, HISTORY_SHA256); assert.equal(cp.prefixCommandsSha256, PREFIX_SHA256);
    assert.deepEqual(cp.provenance, old.provenance); assert.deepEqual(cp.frozenSourceKeys, runtime.frozenSourceKeys);
    assert.equal(cp.freezeSha256, freeze.sha256); assert.deepEqual(cp.initial, initial);
    assert(Number.isSafeInteger(cp.newCount) && cp.newCount >= 0);
    assert.equal(cp.commandCount, PREFIX_COUNT + cp.newCount); assert.equal(cp.state.revision, SOURCE_REVISION + cp.newCount);
    assertOriginalRoots(cp.state, old.source, runtime.frozenSourceKeys, cp.predecessorFreeze);
    assert.equal(stateHash(cp.state), cp.anchor.privateStateSha256); assert.deepEqual(cp.state.random, cp.anchor.random);
    if (cp.pending) { assert.deepEqual(cp.pending.before, cp.anchor); assert.equal(cp.pending.commandCount, cp.commandCount + 1); }
  };
  checkHeader();
  if (saved.payload.state.demoness.guidanceKnown) session = runtime.openDemonessRuntimeSession(saved.payload.state);
  const project = () => {
    const view = session ? session.project() : runtime.projectSliceState(saved.payload.state); auditPublic(view, saved.payload.state); return view;
  };
  let view = project(); assert.deepEqual(anchor(saved.payload.state, view), saved.payload.anchor);
  if (readOnly) assert.equal(saved.payload.pending, null, 'Zero-action resume cannot execute an uncommitted pending intent');
  reconcileTrace(tracePath, saved.payload, old.prefixCommands, initial, readOnly);
  materializeSnapshots(options.out, saved.payload, view, { readOnly, verifyAll: true }); unchanged(frozen);
  assert(!readdirSync(options.out).some(name => name.endsWith('.next')), 'Unrecognized/incomplete successor preserved; inspect before any new action');
  if (readOnly) {
    assert.deepEqual(inspectFreeze(root, options.source), freeze); runtime.assertValidSliceState(saved.payload.state);
    const result = { stage: 'STRICT_RESUME_VERIFIED_ZERO_ACTIONS', commandCount: saved.payload.commandCount, newActions: 0,
      revision: saved.payload.state.revision, changedCaptureBytes: false, actual: outcome(saved.payload.state) };
    console.log(JSON.stringify(result)); return result;
  }
  const requestPause = () => { pauseRequested = true; };
  process.on('SIGINT', requestPause); process.on('SIGTERM', requestPause);
  let stop = saved.payload.terminal;
  try {
    while (!stop) {
      await new Promise(resolve => setImmediate(resolve)); unchanged(frozen);
      const cp = saved.payload;
      stop = terminal(cp.state, view); if (stop) break;
      if (shouldPauseAtBoundary({ pending: cp.pending, completed: count, maxNewActions: options.maxNewActions, pauseRequested })) {
        stop = { stage: 'MANUAL_PAUSE', reason: 'Requested completed-action boundary; same frozen capture can resume' }; break;
      }
      if (!cp.pending) {
        const decision = chooseAction(view, cp.lastRow?.intent ?? null);
        if (decision.stop) { stop = { stage: decision.stop, reason: decision.reason }; break; }
        const pending = { ...decision, before: cp.anchor, commandCount: cp.commandCount + 1 };
        saved = checkpointSave(checkpoint, planSnapshot({ ...cp, pending }, view,
          snapshotReasons({ newCount: cp.newCount, beforeIntent: decision.intent })), saved.sha256);
        materializeSnapshots(options.out, saved.payload, view);
      }
      const before = saved.payload.state, pending = saved.payload.pending;
      assert.deepEqual(chooseAction(view, saved.payload.lastRow?.intent ?? null), { intent: pending.intent, publicAction: pending.publicAction }, 'Pending command is no longer the exact public recommendation');
      assert.deepEqual(anchor(before, view), pending.before);
      let draft = null, next, afterView;
      if (session) {
        draft = session.prepare(pending.intent, before.revision); next = session.snapshotDraft(draft); afterView = session.projectDraft(draft);
      } else {
        next = runtime.applySliceIntent(before, pending.intent);
        if (next.demoness.guidanceKnown) session = runtime.openDemonessRuntimeSession(next);
        afterView = session ? session.project() : runtime.projectSliceState(next);
      }
      const predecessorFreeze = saved.payload.predecessorFreeze ?? (next.demoness.guidanceKnown ? freezePredecessors(next, runtime.frozenSourceKeys) : null);
      assertOriginals(next, old.source, before, runtime.frozenSourceKeys, pending.intent, predecessorFreeze); auditPublic(afterView, next);
      const nextAnchor = anchor(next, afterView), newCount = saved.payload.newCount + 1;
      const row = sealRow({ kind: 'DEMONESS_CONTINUATION_ACTION', commandCount: pending.commandCount, newCount,
        previousRowSha256: saved.payload.rowSha256, intent: pending.intent, commandSha256: stateHash(pending.intent),
        publicAction: pending.publicAction, before: pending.before, after: nextAnchor, receipt: receipt(next, before), actual: outcome(next) });
      const completed = planSnapshot({ ...saved.payload, state: next, anchor: nextAnchor, commandCount: pending.commandCount,
        newCount, rowSha256: row.rowSha256, lastRow: row, pending: null, predecessorFreeze }, afterView,
      snapshotReasons({ newCount, afterIntent: pending.intent, terminal: next.status !== 'ACTIVE' }));
      saved = checkpointSave(checkpoint, completed, saved.sha256);
      // Result is durable now. A crash below is repaired from this checkpoint.
      reconcileTrace(tracePath, saved.payload, old.prefixCommands, initial, false);
      materializeSnapshots(options.out, saved.payload, afterView);
      if (draft) session.commit(draft);
      count++; view = afterView;
      console.log(JSON.stringify({ commandCount: saved.payload.commandCount, newCount, revision: next.revision, action: pending.publicAction.label, actual: outcome(next) }));
    }
    checkHeader(); unchanged(frozen); assert.deepEqual(inspectFreeze(root, options.source), freeze);
    runtime.assertValidSliceState(saved.payload.state);
    if (session) assert.equal(stateHash(session.snapshot()), saved.payload.anchor.privateStateSha256);
    if (stop.stage !== 'MANUAL_PAUSE') {
      const finished = planSnapshot({ ...saved.payload, terminal: stop.stage.startsWith('NATURAL_') ? stop : null }, view, ['terminal']);
      saved = checkpointSave(checkpoint, finished, saved.sha256);
    }
    materializeSnapshots(options.out, saved.payload, view, { verifyAll: true });
    reconcileTrace(tracePath, saved.payload, old.prefixCommands, initial, false);
    const summary = { format: FORMAT, hashEncoding: HASH_ENCODING, ...stop, commandCount: saved.payload.commandCount, originalCommandCount: PREFIX_COUNT,
      newCount: saved.payload.newCount, newActionsThisInvocation: count, revision: saved.payload.state.revision, actual: outcome(saved.payload.state),
      finalPrivateStateSha256: saved.payload.anchor.privateStateSha256, finalWholePublicSha256: saved.payload.anchor.publicStateSha256,
      sourceSha256: SOURCE_SHA256, historySha256: HISTORY_SHA256, prefixCommandsSha256: PREFIX_SHA256,
      provenance: old.provenance, frozenSourceKeys: runtime.frozenSourceKeys, runtimeFreezeSha256: freeze.sha256, strictFinalValidation: true,
      evidence: 'Exact actual688 boundary .final + separate old854 success archive + original688 ordered prefix + public real recovery/S1/S0 actions with private/RNG/whole-public hash chain + sparse gzip snapshots + one rolling full checkpoint',
      historicalPrefixReplayed: false, randomOverridden: false, futureDrawInspected: false, selectedPublicControlsOnly: true, selectedS0PublicPreferredOnly: true, preludePolicy: 'FIXED_REAL_RESOURCE_AND_SAME_ORIGINAL_RECOVERY_THEN_PUBLIC_LIFE', predecessorFreeze: saved.payload.predecessorFreeze,
      sqliteReopen: 'NOT_RUN_BY_PRODUCER', packageReopen: 'NOT_RUN_BY_PRODUCER', keySnapshots: saved.payload.snapshots };
    writeSummary(options.out, summary); console.log(JSON.stringify({ outputDir: options.out, ...stop, commandCount: summary.commandCount, revision: summary.revision }));
    return summary;
  } finally { process.off('SIGINT', requestPause); process.off('SIGTERM', requestPause); }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
