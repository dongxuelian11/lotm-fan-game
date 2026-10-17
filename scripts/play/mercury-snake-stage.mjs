import assert from 'node:assert/strict';
import { appendFileSync, closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Install both scripts and finish all source
// and compiled-module changes, then explicitly freeze those bytes BEFORE any
// natural command. --inspect-freeze only reads files; it does not import or run
// the game. Supply its reviewed hash with --freeze-sha256 for a natural run.
// No seed, cursor, strategy, resource, outcome, fixture-copy or packaging options.
// --replay DIR verifies the same complete strategy without writing any files.
export const SOURCE = 'tests/fixtures/fate-prophet-v01820/natural.json';
export const SOURCE_SHA = '52688eebc9ef8bf3d548195aa174b1f04a517adcce5d2fc6a3bef57a901f86cb';
export const PREFIX_SHA = '4df6da64c0f6577694da6e21122a02b86730d74eb672780d87e8e22854f8b2fe';
export const PREFIX_COUNT = 703, INHERITED_COUNT = 551, SEED = 'monster-natural-v060';
export const CASES = ['cart-return', 'maintained-contact', 'withdrawn-contact'];
export const ROOTS = ['monster', 'machine', 'lucky', 'calamityPriest', 'winner', 'misfortuneMage', 'chaosWalker', 'fateProphet'];
export const NEW_IDS = ['wheel.s1.local-restart', 'wheel.s1.moment-anchor'];
export const STAGES = ['NATURAL703_PREFIX_PUBLIC_MERCURY_SNAKE_CONTINUATION', 'SAME_SEED_FINITE_POTION_FAILURES_ALIVE_S2', 'ACTUAL_FINITE_ENCOUNTER_UNRESOLVED', 'ACTUAL_TERMINAL_WITH_NATURAL703_HISTORY'];
export const STRATEGY = deepFreeze({
  source: 'EXACT703_FULL_LIVING_FATE_PROPHET_FINAL', sourceSeed: SEED, sourceCursor: 269,
  caseMethod: 'ABILITY', caseRoute: 'CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS',
  encounterPolicy: 'ALL', combatStance: 'CONTROL', winnerPolicy: 'HOLD', combatRoundCap: 90,
  potionAttemptCap: 12, maxCommands: 3500, ordinaryPreparationCap: 600, caseCommandCap: 80,
  sourceInjuryRecovery: 'ORDINARY_REST_MAY_CLEAR_ORIGINAL_ONE_LIGHT_NO_COMPULSORY_CLINIC',
  ordinaryActions: 'WORK_ONCE_PER_WEEK_THEN_REST', recovery: { health: 100, mind: 100, spirituality: 120, pollution: 0 },
  caseReadiness: { ap: 3, cash: 20, mind: 8, spirituality: 16 }, encounterReadiness: { ap: 2, cash: 30 },
  afterCases: 'NO_OPTIONAL_MAXIMUM_RECOVERY_STOP_AFTER_ACTUAL_LIVING_EXIT_AND_DUE_SETTLEMENT',
  luck: 'NO_ACCUMULATION_OR_SPENDING_ON_THIS_ROUTE_ORIGINAL_ZERO_REMAINS_ZERO',
  eventChoices: { ORIGIN: '.decline', 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' },
});

export const json = path => JSON.parse(readFileSync(path, 'utf8'));
export const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const stateHash = value => createHash('sha256').update(stable(value)).digest('hex');
function deepFreeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
export function fileEvidence(path) {
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024); let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; hash.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  assert.equal(bytes, lstatSync(path).size, `File changed while read: ${path}`);
  return { bytes, sha256: hash.digest('hex') };
}
export const fileHash = path => fileEvidence(path).sha256;
export function inspectFreeze() {
  const files = [];
  const walk = path => {
    const stat = lstatSync(path); assert(!stat.isSymbolicLink(), `Frozen inputs cannot be symlinks: ${path}`);
    if (stat.isDirectory()) { for (const name of readdirSync(path).sort()) walk(join(path, name)); }
    else if (stat.isFile()) files.push({ file: path.split(sep).join('/'), ...fileEvidence(path) });
  };
  // Include original mechanics, central migration/validation, the renderer, and
  // all compiled domain dependencies. A source-only change also breaks freeze.
  for (const path of ['src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation', 'scripts/play/mercury-snake-stage.mjs', 'scripts/play/mercury-snake-save.mjs']) walk(path);
  assert(existsSync('dist/domain/mercury-snake/index.js'), 'Coordinator must compile the final module before freeze');
  return { sha256: compactHash(files), files };
}
export async function loadRuntime({ sqlite = false } = {}) {
  const names = ['domain/slice/index', 'domain/slice/migration', 'domain/slice/validation', 'domain/mercury-snake/index', 'domain/mercury-snake/life', 'domain/mercury-snake/encounter', 'domain/mercury-snake/combat'];
  if (sqlite) names.push('persistence/slice-store');
  return Object.assign({}, ...await Promise.all(names.map(name => import(pathToFileURL(resolve(`dist/${name}.js`)).href))));
}
export function migrateCurrent(runtime, raw) {
  const state = runtime.migrateSliceState(raw);
  assert.equal(state.schemaVersion, 201, 'Use the explicit current-schema migration');
  assert.equal(state.contentVersion, 'mercury-snake-v201'); runtime.assertValidSliceState(state); return state;
}
export function readSource() {
  assert.equal(fileHash(SOURCE), SOURCE_SHA);
  const old = Object.fromEntries(['provenance', 'creation', 'seed', 'initial', 'commands', 'prefixCount', 'final'].map(k => [k, readObjectEntry(SOURCE, k)]));
  assert.equal(old.commands.length, PREFIX_COUNT); assert.equal(compactHash(old.commands), PREFIX_SHA);
  assert.equal(old.prefixCount, INHERITED_COUNT); assert.equal(old.seed, SEED);
  assert.equal(old.provenance.kind, 'SAME_SEED_COMPLETE_PUBLIC_CONTINUATION'); assert.equal(old.provenance.newRandomChanges, false);
  for (const raw of [old.initial, old.final]) { assert.equal(raw.schemaVersion, 179); assert.equal(raw.contentVersion, 'fate-prophet-v179'); }
  assert.equal(old.initial.progression.sequence, null); assert.equal(old.final.status, 'ACTIVE');
  assert.equal(old.final.revision, 704); assert.equal(old.final.week, 177); assert.equal(old.final.health, 90); assert.equal(old.final.mind, 95);
  assert.equal(old.final.spirituality, 119); assert.equal(old.final.cash, 1060); assert.equal(old.final.actionsRemaining, 2);
  assert.deepEqual(old.final.random, { seed: SEED, cursor: 269 }); assert.equal(old.final.fateProphet.promotionWeek, 166);
  assert.equal(old.final.progression.sequence, 2); assert.equal(old.final.progression.acting, 100);
  assert.equal(Object.keys(old.final.progression.mastery).length, 17); assert.equal(Object.values(old.final.progression.mastery).filter(n => n === 0).length, 6);
  assert.equal(old.final.injuries.length, 1); assert.equal(old.final.injuries[0].severity, 'LIGHT');
  assert.deepEqual(old.final.winner.luck, { stored: 0, lastAccumulateWeek: 176, accumulated: 14, spent: 14 });
  const site = old.final.chaosWalker.life;
  assert.equal(site.clockSeconds, 713); assert.equal(site.playerTravelMetres, 124); assert.equal(site.playerLocation, 'START');
  assert.equal(site.guide.location, 'OUTSIDE'); assert.equal(site.volunteer.location, 'OUTSIDE'); assert.equal(site.volunteer.age, 39);
  assert.equal(site.cart.location, 'A'); assert.equal(site.parcel.location, 'CW3-CART'); assert.equal(site.parcel.massGrams, 400); assert.equal(site.parcel.sealed, true);
  assert.equal(site.disc.location, 'A'); assert.equal(site.disc.pointer, 'A'); assert(site.tags.every(t => t.location === 'POUCH'));
  assert.deepEqual(old.final.fateProphet.life.operation, { door: 'OPEN', mechanical: { objectId: 'CW3-DISC', caseId: 'finite-disc', preparedAt: 477, preparationRoll: 41, bias: 'B', version: 1 }, forecast: null, correction: null });
  const rowan = old.final.fateProphet.encounter;
  assert.equal(rowan.targetId, 'FP2-ROWAN'); assert.equal(rowan.enemyStatus, 'SURRENDERED');
  assert.deepEqual([rowan.enemyHealth, rowan.enemyMind, rowan.enemySpirituality], [60, 100, 83]);
  return old;
}
export const originalResources = s => ({ site: s.chaosWalker.life, operation: s.fateProphet.life.operation, luck: s.winner.luck });
export const currentSite = s => s.mercurySnake.promotionWeek === null ? s.chaosWalker.life : s.mercurySnake.encounter.currentSite ?? s.mercurySnake.life.site;
export const currentLuck = s => s.mercurySnake.guidanceKnown ? s.mercurySnake.luck : s.winner.luck;
export const currentResources = s => ({ site: currentSite(s), operation: s.mercurySnake.promotionWeek === null ? s.fateProphet.life.operation : s.mercurySnake.life.operation, luck: currentLuck(s) });
export const body = s => ({ status: s.status, revision: s.revision, week: s.week, date: s.date, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining,
  pollution: s.seer.pollution, injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, sequence: s.progression.sequence, acting: s.progression.acting, mastery: s.progression.mastery,
  finance: { weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit, pulse: s.pulse, billAmount: s.billAmount } });
export function compact(s) {
  const life = s.mercurySnake.life, e = s.mercurySnake.encounter;
  return { ...body(s), activeEvent: s.activeEvent?.instanceId ?? null, current: currentResources(s),
    life: { activeCase: life.activeCase, conditionVersion: life.conditionVersion, captured: life.captured, pending: life.pending, pieces: life.pieces,
      volunteerMindSpent: life.volunteerMindSpent, currentAttempt: life.activeCase ? life.cases[life.activeCase].attempts[0] ?? null : null },
    encounter: { status: e.status, policy: e.policy, currentSite: e.currentSite, piece: e.piece, plates: e.plates, restart: e.restart, anchor: e.anchor,
      conditionVersion: e.conditionVersion, playerLocalMetres: e.playerLocalMetres, terminal: e.terminal } };
}
export function checkOriginals(runtime, s, original) {
  for (const key of ROOTS) assert.deepEqual(s[key], original[key], `Immutable original ${key} history`);
  assert.deepEqual(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  assert.deepEqual(s.seer.completedSources.slice(0, original.seer.completedSources.length), original.seer.completedSources);
  const old = originalResources(original), now = currentResources(s), l = s.mercurySnake.life;
  if (s.mercurySnake.guidanceKnown) {
    assert.deepEqual(s.mercurySnake.sourceHistory, Object.fromEntries(ROOTS.map(k => [k, original[k]])));
    assert.deepEqual(s.mercurySnake.sourceScene.originals, old); assert(runtime.validateMercurySnakeSource(s));
  }
  if (s.mercurySnake.promotionWeek === null) assert.deepEqual(l, runtime.createMercurySnakeLifeState());
  else { assert.equal(l.sourceWeek, s.mercurySnake.promotionWeek); assert(runtime.validateMercurySnakeCurrentSite(now.site, old)); }
  assert(runtime.validateMercurySnakeLifeState(s)); assert(runtime.validateMercurySnakeEncounterState(s));
  assert.deepEqual(now.operation, old.operation, 'The original non-null mechanical disc receipt is historical, not a pending effect to erase');
  assert.deepEqual(now.luck, old.luck, 'HOLD and no accumulation keep sole current luck 0/14/14, without duplicate history spending');
  assert.equal(Object.hasOwn(now.site, 'playerEnergy'), false); assert.equal(Object.hasOwn(now.site.volunteer, 'energy'), false);
  assert.equal(l.volunteerMindSpent, CASES.flatMap(id => l.cases[id].attempts).reduce((n, a) => n + a.volunteerMindSpent, 0));
  assert.equal(now.site.volunteer.mind, old.site.volunteer.mind - l.volunteerMindSpent);
  assert(now.site.clockSeconds >= old.site.clockSeconds); assert(now.site.playerTravelMetres >= old.site.playerTravelMetres);
  const mastery = { ...original.progression.mastery };
  if (s.progression.sequence === 1) { for (const id of NEW_IDS) mastery[id] = 0; for (const [id, gain] of Object.entries(runtime.mercurySnakeLifeMasteryGains(s))) mastery[id] += gain; }
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const o = round.mercurySnakeOutcome; assert(o); assert.equal(o.winnerPolicy, STRATEGY.winnerPolicy);
    for (const a of [...o.playerActions, ...o.enemyActions]) for (const id of a.masteryApplied) { assert(Object.hasOwn(mastery, id)); mastery[id] = Math.min(500, mastery[id] + 8); }
  }
  assert.deepEqual(s.progression.mastery, mastery, 'Only real reported/applied ability gains, never invented success');
  const { coreStats, ...identity } = s.character, { coreStats: priorStats, ...priorIdentity } = original.character;
  assert.deepEqual(identity, priorIdentity); for (const [k, v] of Object.entries(priorStats)) assert.equal(coreStats[k], Math.min(500, v + (s.progression.sequence === 1 ? 1 : 0)));
  assert.equal(s.progression.promotionWeek, original.progression.promotionWeek); assert.equal(s.random.seed, SEED); assert.equal(s.runId, original.runId);
}
export function publicControl(runtime, s, intent) {
  assert(runtime.validateSlicePayload(intent), `Strict public payload: ${JSON.stringify(intent)}`);
  const p = runtime.projectSliceState(s);
  if (intent.type === 'CONTINUE_LIFE') {
    assert.equal(s.status, 'SLICE_COMPLETE'); assert(s.ending && s.ending.kind !== 'DEATH' && s.caseArchive.length === 0);
    return { kind: 'CONTINUE_LIFE', status: p.status, enabled: true };
  }
  assert.equal(s.status, 'ACTIVE', 'A sealed death never continues');
  if (intent.type === 'MERCURY_SNAKE') {
    const a = p.mercurySnake.actions.find(x => isDeepStrictEqual(x.command, intent.command)); assert(a, `Missing public control ${JSON.stringify(intent.command)}`); assert(a.enabled, a.reason);
    const l = p.mercurySnake.life.actions.find(x => isDeepStrictEqual(x.command, intent.command));
    if (l) {
      const nextCase = CASES.find(id => s.mercurySnake.life.cases[id].status !== 'RESOLVED');
      if ('caseId' in intent.command) assert.equal(intent.command.caseId, nextCase);
      if (!['OBSERVE', 'REPORT', 'REFLECT'].includes(intent.command.type)) assert.equal(l.preferredAction, true, 'Use the actual recommended route');
      if (intent.command.type === 'PREPARE') assert.equal(intent.command.method, STRATEGY.caseMethod);
    }
    if (intent.command.type === 'SET_COMBAT_POLICY') assert.equal(intent.command.policy, STRATEGY.encounterPolicy);
    if (intent.command.type === 'ENCOUNTER_FIGHT') assert.equal(s.mercurySnake.encounter.policy, STRATEGY.encounterPolicy);
    return structuredClone(a);
  }
  if (intent.type === 'ACTION') { assert(['WORK', 'REST'].includes(intent.action)); assert(p.canAct, p.actionBlockedReason); assert(!p.mercurySnake.insideCase && !s.combat && s.mercurySnake.preparedWeek === null); return { kind: 'ACTION', action: intent.action, enabled: true }; }
  if (intent.type === 'EVENT_CHOICE') {
    assert.equal(s.activeEvent?.instanceId, intent.eventInstanceId); const a = p.activeEvent?.choices.find(x => x.id === intent.choiceId); assert(a?.enabled);
    assert.equal(intent.choiceId, STRATEGY.eventChoices[p.activeEvent.id.startsWith('ORIGIN') ? 'ORIGIN' : p.activeEvent.id]); return structuredClone(a);
  }
  assert.equal(intent.type, 'COMBAT_ROUND'); assert.equal(intent.stance, STRATEGY.combatStance); assert.equal(intent.winnerPolicy, STRATEGY.winnerPolicy);
  assert.equal(s.mercurySnake.encounter.policy, STRATEGY.encounterPolicy); assert(p.combat?.stances.some(x => x.id === intent.stance));
  return { kind: 'COMBAT_ROUND', stance: intent.stance, winnerPolicy: intent.winnerPolicy, round: s.combat.round };
}
export function lifeAbilityUse(s) {
  const l = s.mercurySnake.life;
  return Object.fromEntries(NEW_IDS.map((id, i) => { const attempts = CASES.flatMap(key => l.cases[key].attempts), field = i === 0 ? 'restartTier' : 'anchorTier';
    return [id, { paidAttempts: attempts.filter(a => a[field] !== null).length, castingSuccesses: attempts.filter(a => ['SUCCESS', 'GREAT_SUCCESS'].includes(a[field])).length,
      actualApplications: attempts.filter(a => a.appliedAbilityIds.includes(id)).length, reportedApplications: CASES.filter(key => l.cases[key].status === 'RESOLVED').flatMap(key => l.cases[key].attempts).filter(a => a.appliedAbilityIds.includes(id)).length }]; }));
}
export function combatAbilityUse(rounds) {
  const actions = rounds.flatMap(r => [...r.mercurySnakeOutcome.playerActions, ...r.mercurySnakeOutcome.enemyActions]);
  return Object.fromEntries(NEW_IDS.map((id, i) => { const selected = actions.filter(a => a.actor === 'PLAYER' && a.id === id), kind = i === 0 ? 'RESTART' : 'ANCHOR';
    return [id, { selectedSlots: selected.length, paidAttempts: selected.filter(a => a.attempted).length, castingSuccesses: selected.filter(a => a.succeeded).length,
      preparedWindows: selected.filter(a => a.windowGranted?.kind === kind).length, actualApplications: actions.flatMap(a => a.windowsApplied).filter(w => w.kind === kind).length,
      contributionReduction: actions.flatMap(a => a.windowsApplied).filter(w => w.kind === kind).reduce((n, w) => n + w.amount, 0),
      masteryApplications: actions.filter(a => a.masteryApplied.includes(id)).length, spiritualitySpent: selected.reduce((n, a) => n + a.paidCost, 0), mindSpent: selected.reduce((n, a) => n + a.mindCost, 0) }]; }));
}
// Observed aliases are produced from the real transition, never promises that a
// power will apply. The verifier independently reconstructs this exact list.
export function boundaryAliases(before, intent, after) {
  const names = [], c = intent.type === 'MERCURY_SNAKE' ? intent.command : null;
  if (before.week !== after.week) names.push('actual-week-finance-settlement');
  if (before.actionsRemaining === 0) names.push('actual-zero-ap-command');
  if (after.status === 'SLICE_COMPLETE') names.push('living-slice-complete');
  if (intent.type === 'CONTINUE_LIFE') names.push('real-living-continue-life');
  if (after.status === 'DEAD') names.push('actual-sealed-player-death');
  if (c?.type === 'CONSUME') names.push(after.progression.sequence === 1 ? 'promotion' : 'actual-potion-failure');
  if (c && 'caseId' in c) {
    const id = c.caseId, l = after.mercurySnake.life, a = l.cases[id].attempts[0];
    if (c.type === 'LOCAL_RESTART') names.push(`${id}-restart-${a.restartApplied ? 'actual-application' : 'actual-nonapplication'}`);
    if (c.type === 'MOMENT_ANCHOR') names.push(`${id}-anchor-${l.pending ? 'actual-window' : 'actual-failed-window'}`);
    if (c.type === 'WITHDRAW_CONSENT') names.push(`${id}-permission-${c.permission.toLowerCase()}-withdrawn`);
    if (c.type === 'LEAVE') names.push(`${id}-ordinary-closure-${a.returnKind.toLowerCase()}`);
    const oldPiece = before.mercurySnake.life.pieces.find(p => p.caseId === id), newPiece = l.pieces.find(p => p.caseId === id);
    if (oldPiece && newPiece && oldPiece.charges !== newPiece.charges) names.push(`${id}-actual-charge-consumption`);
  }
  if (intent.type === 'COMBAT_ROUND') {
    const o = after.combatHistory.at(-1)?.mercurySnakeOutcome; assert(o);
    if (o.restartApplications > before.mercurySnake.encounter.restartApplications) names.push('combat-actual-local-restart');
    if (o.anchorApplications > before.mercurySnake.encounter.anchorApplications) names.push('combat-actual-anchor-assisted-restart');
    if (!after.combat && after.status !== 'DEAD') names.push('actual-ordinary-encounter-exit');
  }
  return names;
}

class ActualTerminalStop extends Error {}
class FiniteEncounterStop extends Error {}
export async function runNatural(options) {
  const frozen = inspectFreeze(); assert.equal(frozen.sha256, options.freezeSha256, 'Coordinator freeze mismatch; do not start gameplay');
  const runtime = await loadRuntime(), old = readSource(), originalExpected = migrateCurrent(runtime, old.final);
  const producerSha256 = fileHash(fileURLToPath(import.meta.url)), replayOnly = !!options.replay;
  if (!replayOnly) mkdirSync('output/play', { recursive: true });
  const outputDir = replayOnly ? realpathSync(options.replay) : mkdtempSync('output/play/mercury-snake-02040-');
  if (replayOnly) { const i = json(join(outputDir, 'capture-integrity.json')); assert.equal(i.producerSha256, producerSha256); assert.equal(i.freezeSha256, frozen.sha256); }
  const replayRows = replayOnly ? new Map(['commands.jsonl', 'public.jsonl'].map(name => [name, readJsonLines(join(outputDir, name))])) : null;
  const write = (name, value) => { if (replayOnly) assert.equal(fileHash(join(outputDir, name)), compactHash(value), `Capture-free replay differs: ${name}`); else writeFileSync(join(outputDir, name), JSON.stringify(value), { flag: 'wx' }); };
  const append = (name, value) => { if (replayOnly) { const row = replayRows.get(name).next(); assert.equal(row.done, false); assert.deepEqual(row.value, value, `${name}:${value.step}`); } else appendFileSync(join(outputDir, name), `${JSON.stringify(value)}\n`); };
  if (!replayOnly) for (const name of ['commands.jsonl', 'public.jsonl']) writeFileSync(join(outputDir, name), '', { flag: 'wx' });
  const commands = [], boundaries = {}, boundarySteps = {}, transitions = [], snapshots = {}, treatments = [], captured = new Map(), snapshotSteps = new Map();
  let s = runtime.createSliceRun(old.final.runId, old.creation, old.seed), original = null, beforeLast = null, lastIntent = null, pendingIntent = null, prefixVerified = false, saved = false, failurePhase = 'INITIALIZATION';
  const initial = structuredClone(s), view = () => runtime.projectSliceState(s).mercurySnake;
  const unusedName = key => { let name = key, number = 2; while (Object.hasOwn(boundaries, name)) name = `${key}-${number++}`; return name; };
  function capture(key) {
    if (!prefixVerified) return; const name = unusedName(key);
    let file = captured.get(commands.length);
    if (!file) { file = `boundary-${name}.json`; write(file, { commandCount: commands.length, beforeLast, lastIntent, final: s }); captured.set(commands.length, file); transitions.push({ key: name, file, commandIndex: commands.length, beforeRevision: beforeLast.revision, afterRevision: s.revision }); }
    boundaries[name] = file; boundarySteps[name] = commands.length;
  }
  function snapshot(name) { assert(!snapshots[name]); let file = snapshotSteps.get(commands.length); if (!file) { file = `snapshot-${name}.json`; write(file, s); snapshotSteps.set(commands.length, file); } snapshots[name] = file; }
  function go(intent, key = null) {
    pendingIntent = structuredClone(intent); failurePhase = 'PUBLIC_PREFLIGHT'; assert(commands.length < STRATEGY.maxCommands); assert(runtime.validateSlicePayload(intent));
    const control = prefixVerified ? publicControl(runtime, s, intent) : { kind: 'IMMUTABLE703_SOURCE_PREFIX', enabled: true };
    const prior = s, beforePublic = prefixVerified ? compact(s) : null; beforeLast = s; lastIntent = structuredClone(intent); failurePhase = 'APPLY';
    s = runtime.applySliceIntent(s, intent); commands.push(structuredClone(intent)); pendingIntent = null; failurePhase = 'AFTER_APPLY_VALIDATION';
    const boundaryKey = prefixVerified ? unusedName(key ?? `step-${commands.length}-${intent.type === 'MERCURY_SNAKE' ? intent.command.type.toLowerCase() : intent.type.toLowerCase()}`) : null;
    append('commands.jsonl', { step: commands.length, intent, sourcePrefix: commands.length <= PREFIX_COUNT, boundaryKey, before: body(prior), after: body(s) });
    if (prefixVerified) append('public.jsonl', { step: commands.length, revision: prior.revision, command: intent, control, randomBefore: prior.random, randomAfter: s.random, before: beforePublic, after: compact(s) });
    runtime.assertValidSliceState(s); assert.equal(s.revision, prior.revision + 1); assert.equal(s.random.seed, SEED); assert(s.random.cursor >= prior.random.cursor);
    if (prefixVerified) { checkOriginals(runtime, s, original); capture(boundaryKey); for (const name of boundaryAliases(prior, intent, s)) capture(name); }
    failurePhase = 'IDLE'; if (prefixVerified && s.status === 'DEAD') throw new ActualTerminalStop('Actual player death; no continuation, rescue, reroll or state patch');
  }
  const ms = (command, key = null) => go({ type: 'MERCURY_SNAKE', command }, key);
  function clear() {
    for (let count = 0; (s.activeEvent || s.status === 'SLICE_COMPLETE') && count < 30; count++) {
      if (s.status === 'SLICE_COMPLETE') { go({ type: 'CONTINUE_LIFE' }, 'living-slice-real-continue'); continue; }
      const e = runtime.projectSliceState(s).activeEvent, choiceId = STRATEGY.eventChoices[e.id.startsWith('ORIGIN') ? 'ORIGIN' : e.id]; assert(choiceId, `Unplanned actual event: ${e.id}`);
      const prior = e.id === 'LIFE-CARE-01' ? structuredClone(body(s)) : null;
      go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId }, `actual-event-${e.id.toLowerCase()}`);
      if (prior) treatments.push({ paidPennies: 60, before: prior, after: structuredClone(body(s)) });
    }
    assert.equal(s.status, 'ACTIVE'); assert.equal(s.activeEvent, null); assert.equal(s.pulse, 'NONE');
  }
  function ordinary() { clear(); assert(!view().insideCase && !s.combat && s.mercurySnake.preparedWeek === null); go({ type: 'ACTION', action: s.wagePaidWeek === s.week ? 'REST' : 'WORK' }); clear(); }
  function ready({ ap = 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
    clear(); assert(!view().insideCase && !s.combat && s.mercurySnake.preparedWeek === null); assert(ap <= s.weeklyBudget);
    for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek; n++) { assert(n < STRATEGY.ordinaryPreparationCap, 'Finite real work/rest readiness limit'); ordinary(); }
  }
  function action(command, key = null) { ready(); ms(command, key); clear(); }
  function practice(caseId) {
    ready(STRATEGY.caseReadiness); const before = structuredClone(currentSite(s)); ms({ type: 'OBSERVE', caseId }, `${caseId}-observe-original-room`);
    for (let n = 0; s.mercurySnake.life.cases[caseId].status !== 'EXAMINED'; n++) {
      assert(n < STRATEGY.caseCommandCap, 'Finite preferred-case route exhausted');
      const l = view().life, next = l.actions.find(a => a.id === l.preferredActionId && a.preferredAction && a.enabled);
      assert(next, `No enabled public preferred step: ${l.nextStep}`); assert.equal(next.command.caseId, caseId);
      const suffix = 'permission' in next.command ? `-${next.command.permission.toLowerCase()}` : '';
      ms(next.command, `${caseId}-${next.command.type.toLowerCase()}${suffix}`);
    }
    clear(); const l = s.mercurySnake.life, a = l.cases[caseId].attempts[0];
    assert.equal(l.cases[caseId].attempts.length, 1); assert(a.closed && a.returned && a.verified); assert.equal(currentSite(s).playerLocation, 'START');
    assert(currentSite(s).playerTravelMetres > before.playerTravelMetres); assert.equal(currentSite(s).cart.location, 'A'); assert.equal(currentSite(s).parcel.location, 'CW3-CART');
    const piece = l.pieces.find(p => p.caseId === caseId); assert(piece); assert.equal(piece.initialCharges, caseId === 'maintained-contact' ? 2 : 1); assert.equal(piece.location, 'RETURNED');
    assert.equal(piece.wear, piece.initialCharges - piece.charges); assert.equal(piece.returnUses, a.restartApplied ? 1 : 0); assert.equal(piece.anchorUses, a.anchorApplied ? 1 : 0);
    if (caseId === 'withdrawn-contact') { assert(a.withdrawn); assert.equal(a.appliedAbilityIds.length, 0); assert.equal(a.returnKind, 'ORDINARY'); }
    action({ type: 'REPORT', caseId }, `${caseId}-honest-report`); assert.equal(s.mercurySnake.life.cases[caseId].status, 'RESOLVED');
  }
  function consume(bottleId) {
    const prior = structuredClone(body(s)), resources = structuredClone(currentResources(s));
    ms({ type: 'CONSUME', bottleId, confirmed: true }, `consume-${bottleId}`);
    const b = s.mercurySnake.bottles.find(b => b.id === bottleId); assert.equal(b.status, 'CONSUMED'); assert.equal(s.random.cursor, prior.random.cursor + 1);
    assert.deepEqual(currentResources(s), resources); assert.deepEqual(s.injuries, prior.injuries); assert.equal(s.mercurySnake.preparedWeek, null);
    if (s.progression.sequence === 1) { assert.equal(s.health, prior.H); assert.equal(s.spirituality, prior.S); assert.deepEqual(s.progression.mastery, { ...prior.mastery, ...Object.fromEntries(NEW_IDS.map(id => [id, 0])) }); }
    clear();
  }
  function encounter() {
    ready(STRATEGY.encounterReadiness); snapshot('beforeEncounter'); ms({ type: 'PREPARE_ENCOUNTER' }, 'paid30-independent-three-charge-combat-piece');
    ms({ type: 'ENCOUNTER_TALK' }, 'original-adults-actually-leave-player-walks-to-new-yard');
    assert.equal(currentSite(s).guide.location, 'OUTSIDE'); assert.equal(currentSite(s).volunteer.location, 'OUTSIDE'); assert.equal(currentSite(s).playerLocation, 'YARD');
    if (s.mercurySnake.encounter.policy !== STRATEGY.encounterPolicy) ms({ type: 'SET_COMBAT_POLICY', policy: STRATEGY.encounterPolicy }, 'explicit-all-policy');
    ms({ type: 'ENCOUNTER_FIGHT' }, 'independent-optional-oswin-fight'); snapshot('combatStart');
    while (s.combat && s.combat.round <= STRATEGY.combatRoundCap) go({ type: 'COMBAT_ROUND', stance: STRATEGY.combatStance, winnerPolicy: STRATEGY.winnerPolicy }, `combat-round-${s.combat.round}`);
    if (s.combat) throw new FiniteEncounterStop('Actual encounter still running at the declared90-round limit; no outcome invented');
    assert(s.mercurySnake.encounter.terminal); assert.equal(currentSite(s).playerLocation, 'START'); snapshot('combatTerminal'); clear();
  }
  function save(stage, error = null) {
    assert(!saved); saved = true; assert.equal(fileHash(SOURCE), SOURCE_SHA); assert.deepEqual(inspectFreeze(), frozen, 'Frozen source/runtime changed during capture');
    const rounds = s.combatHistory.slice(original?.combatHistory.length ?? s.combatHistory.length);
    write('natural.json', { provenance: { kind: 'EXACT703_PUBLIC_FATE_PROPHET_THEN_PUBLIC_MERCURY_SNAKE', prior: old.provenance, source: SOURCE, sourceSha256: SOURCE_SHA, sourceRoot: 'final', inheritedDirectedPrefix: false, fullNaturalS9ToS1: s.progression.sequence === 1, newRandomChanges: false },
      producerSha256, freezeSha256: frozen.sha256, strategy: STRATEGY, creation: old.creation, seed: SEED, prefixCount: PREFIX_COUNT, inheritedPrefixCount: INHERITED_COUNT, prefixVerified,
      commands, initial, prefixFinal: original, beforeLast, lastIntent, pendingIntent, failurePhase, snapshots, treatments, stage, error: error ? String(error) : null, final: s });
    write('boundaries.index.json', boundaries); write('boundaries.steps.json', boundarySteps); write('transitions.json', transitions);
    write('summary.json', { stage, producerSha256, freezeSha256: frozen.sha256, strategy: STRATEGY, source: { prefixCount: PREFIX_COUNT, prefixVerified, sourceSha256: SOURCE_SHA, prefixCompactSha256: PREFIX_SHA, migratedWholeSourceSha256: original ? stateHash(original) : null },
      commands: commands.length, final: body(s), originalMastery: original?.progression.mastery ?? null, sourceOriginals: original ? originalResources(original) : null,
      currentOriginals: currentResources(s), life: s.mercurySnake.life, lifeAbilityUse: lifeAbilityUse(s), combatAbilityUse: combatAbilityUse(rounds), encounter: s.mercurySnake.encounter, rounds,
      bottles: s.mercurySnake.bottles, treatments, boundaries: Object.keys(boundaries), uniqueTransitions: transitions.length, snapshots });
    write('capture-integrity.json', { producerSha256, freezeSha256: frozen.sha256, frozenFiles: frozen.files,
      metadata: Object.fromEntries(['natural.json', 'commands.jsonl', 'public.jsonl', 'summary.json', 'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', ...(prefixVerified ? ['source-prefix.json'] : [])].map(name => [name, fileEvidence(join(outputDir, name))])),
      files: Object.fromEntries([...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].map(name => [name, fileEvidence(join(outputDir, name))])) });
    if (replayOnly) for (const [name, rows] of replayRows) assert.equal(rows.next().done, true, `Missing replay rows: ${name}`);
    console.log(JSON.stringify({ outputDir, replayOnly, replayMatched: replayOnly && stage !== 'ACTUAL_BLOCKER', stage, commands: commands.length, namedBoundaries: Object.keys(boundaries).length, uniqueTransitions: transitions.length, status: s.status, sequence: s.progression.sequence, week: s.week }));
  }
  try {
    assert.deepEqual(s, migrateCurrent(runtime, old.initial)); runtime.assertValidSliceState(s);
    for (const intent of old.commands) go(intent);
    assert.deepEqual(commands, old.commands); assert.deepEqual(s, originalExpected, 'Full703 replay equals the entire migrated actual living source');
    original = structuredClone(s); prefixVerified = true; checkOriginals(runtime, s, original);
    write('source-prefix.json', { source: SOURCE, sourceSha256: SOURCE_SHA, sourceRoot: 'final', prefixCount: PREFIX_COUNT, rawInitial: old.initial, rawFinal: old.final, commands: old.commands, rawCommandsSha256: PREFIX_SHA, migratedWholeStateSha256: stateHash(original), inheritedDirectedPrefix: false });
    snapshot('departure'); capture('exact-original703-living-source');
    ready({ ap: 1, cash: 500 }); ms({ type: 'LEARN_GUIDANCE' }, 'paid500-guidance-freezes-eight-roots-and-original-luck'); clear(); snapshot('guidance');
    for (const taskId of ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN']) action({ type: 'PREPARE_TASK', taskId }, `preparation-${taskId.toLowerCase()}`);
    for (let number = 0; s.progression.sequence === 2 && number < STRATEGY.potionAttemptCap; number++) {
      let bottle = s.mercurySnake.bottles.find(b => b.status === 'PLAYER') ?? s.mercurySnake.bottles.find(b => b.status === 'SUPPLIER');
      if (!bottle) { ready({ ap: 1, cash: 100 }); ms({ type: 'REQUEST_SUPPLY' }, 'paid100-after-all-original-bottles-failed'); const week = s.mercurySnake.resupply.requestedWeek; clear(); ready({ afterWeek: week }); ms({ type: 'RECEIVE_SUPPLY' }, 'next-real-week-three-new-bottle-identities'); bottle = s.mercurySnake.bottles.find(b => b.status === 'SUPPLIER'); }
      assert(bottle); const id = bottle.id;
      if (bottle.status === 'SUPPLIER') { while (s.mercurySnake.bottles.find(b => b.id === id).labourSteps < 5) action({ type: 'POTION_WORK', bottleId: id }, `${id}-actual-labour`); ready({ ap: 0, cash: 1200 }); ms({ type: 'BUY_POTION', bottleId: id }, `paid1200-${id}`); }
      ready({ ap: 1, cash: 180, ...STRATEGY.recovery, afterWeek: s.fateProphet.promotionWeek + 11 });
      ms({ type: 'PREPARE_PROMOTION' }, `paid180-current-week-prepare-${id}`); consume(id);
    }
    if (s.progression.sequence !== 1) save(STAGES[1]);
    else { snapshot('promoted'); for (const id of CASES) practice(id); action({ type: 'REFLECT' }, 'three-honest-reports-reflected'); assert.equal(s.progression.acting, 100); snapshot('practiced'); encounter(); checkOriginals(runtime, s, original); save(STAGES[0]); }
  } catch (error) {
    if (replayOnly && !(error instanceof ActualTerminalStop) && !(error instanceof FiniteEncounterStop)) throw error;
    if (saved) throw error;
    if (error instanceof ActualTerminalStop) { snapshot('actualTerminal'); save(STAGES[3]); }
    else if (error instanceof FiniteEncounterStop) save(STAGES[2], error);
    else { save('ACTUAL_BLOCKER', error); throw error; }
  } finally { for (const rows of replayRows?.values() ?? []) rows.return?.(); }
}

// Streaming top-level reader: no parsing/retaining unrelated snapshot trees.
export function readObjectEntry(path, wanted) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START', key = '', selected = false, quoted = false, escaped = false, depth = 0, kind = 'PRIMITIVE'; const pieces = [];
  try { for (;;) {
    const n = readSync(fd, buffer, 0, buffer.length, null), text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end(); let captureStart = selected && phase === 'VALUE' ? 0 : -1;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (phase === 'START') { if (/\s/.test(c)) continue; assert.equal(c, '{'); phase = 'KEY'; continue; }
      if (phase === 'KEY' || phase === 'AFTER') { if (/\s/.test(c) || c === ',') continue; if (c === '}') throw Error(`Missing JSON entry: ${wanted}`); assert.equal(c, '"'); key = '"'; escaped = false; phase = 'KEY_STRING'; continue; }
      if (phase === 'KEY_STRING') { key += c; if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') { selected = JSON.parse(key) === wanted; phase = 'COLON'; } continue; }
      if (phase === 'COLON') { if (/\s/.test(c)) continue; assert.equal(c, ':'); phase = 'VALUE_START'; continue; }
      if (phase === 'VALUE_START') { if (/\s/.test(c)) continue; if (selected) captureStart = i; depth = 0; quoted = false; escaped = false; kind = c === '{' || c === '[' ? 'CONTAINER' : c === '"' ? 'STRING' : 'PRIMITIVE'; phase = 'VALUE'; }
      if (phase === 'VALUE') {
        let done = false, end = i + 1;
        if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') { quoted = false; if (kind === 'STRING' && depth === 0) done = true; } }
        else if (c === '"') quoted = true; else if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') { if (depth > 0) { depth--; if (depth === 0) done = true; } else { done = true; end = i; } }
        else if (kind === 'PRIMITIVE' && (c === ',' || /\s/.test(c))) { done = true; end = i; }
        if (done) { if (selected) { pieces.push(text.slice(captureStart, end)); return JSON.parse(pieces.join('')); } phase = 'AFTER'; selected = false; captureStart = -1; }
      }
    }
    if (captureStart >= 0) pieces.push(text.slice(captureStart)); if (!n) break;
  } } finally { closeSync(fd); }
  throw Error(`Missing JSON entry: ${wanted}`);
}
export function* readJsonLines(path) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8'); let pending = '';
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); pending += n ? decoder.write(buffer.subarray(0, n)) : decoder.end(); let end;
    while ((end = pending.indexOf('\n')) !== -1) { const line = pending.slice(0, end); pending = pending.slice(end + 1); assert(line.length); yield JSON.parse(line); }
    if (!n) { assert.equal(pending, '', `Partial final ledger row: ${path}`); break; }
  } } finally { closeSync(fd); }
}
export function assertSafeOutput(output, protectedRoots) {
  const path = resolve(output); let ancestor = path; while (!existsSync(ancestor)) ancestor = resolve(ancestor, '..');
  const intended = resolve(realpathSync(ancestor), relative(ancestor, path));
  for (const root of protectedRoots.map(root => realpathSync(root))) { const inside = relative(root, intended); assert(inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside), 'Verification output must not overlap immutable inputs'); }
  mkdirSync(path, { recursive: true }); assert.equal(realpathSync(path), intended); return path;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), options = {}; const seen = new Set();
    for (let i = 0; i < args.length; i++) { const key = args[i]; assert(!seen.has(key)); seen.add(key);
      if (key === '--help' || key === '--inspect-freeze') options[key.slice(2)] = true;
      else { assert(['--freeze-sha256', '--replay'].includes(key), `Unknown option: ${key}`); assert(args[i + 1] && !args[i + 1].startsWith('--')); options[key === '--replay' ? 'replay' : 'freezeSha256'] = args[++i]; }
    }
    if (options.help) console.log('Coordinator only, after source and compiled mechanics freeze:\nnode scripts/play/mercury-snake-stage.mjs --inspect-freeze\nnode --max-old-space-size=768 scripts/play/mercury-snake-stage.mjs --freeze-sha256 REVIEWED_HASH\nnode --max-old-space-size=768 scripts/play/mercury-snake-stage.mjs --freeze-sha256 REVIEWED_HASH --replay EXISTING_CAPTURE_DIR');
    else if (options['inspect-freeze']) { assert.equal(args.length, 1); console.log(JSON.stringify(inspectFreeze())); }
    else { assert.match(options.freezeSha256 ?? '', /^[0-9a-f]{64}$/, 'Explicit coordinator freeze hash is required before natural gameplay'); assert.equal(realpathSync(fileURLToPath(import.meta.url)), realpathSync('scripts/play/mercury-snake-stage.mjs')); await runNatural(options); }
  } catch (error) { console.error(error); process.exitCode = 1; }
}
