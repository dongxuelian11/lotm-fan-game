import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { fileEvidence, inspectSources, parseArguments } from './sage-save.mjs';

// Recheck the exact frozen producer and the observed named-boundary count.
// Exact718 living source uses boundary.beforeLast, never the whole724 death.
// Independently replay and seal both old724 and older592 terminal histories.
// Every observed unique transition and every alias must be accounted for.
const SOURCE = 'tests/fixtures/blood-duke-v01800/natural.json';
const SOURCE_SHA = '7762560089c03487c1dd4432fd367998d4874c165e3cce8d012d200d56222363';
const SOURCE_BOUNDARY = 'tests/fixtures/blood-duke-v01800/boundary-real-combat-preparation.json';
const SOURCE_BOUNDARY_SHA = 'c9c82f892d21d1cf68d955d75220da06334a9bea7e99b106f41c83e06e152e2c';
const PREFIX_SHA = '6f57b3aafe3469b3293ee5c2e6b700b834cebab7f091faa1468a096ec3291da7';
const PREFIX_COUNT = 718, INHERITED_COUNT = 583, SEED = 'criminal-natural-v054';
const PRESERVED = [SOURCE, 'tests/fixtures/blatherer-v01560/natural.json'];
const PRESERVED_SHA = [SOURCE_SHA, '796a7efabb26d5db70a24eeb509d7bbe2d80aa33e864f2ff45eba65016abaf7b'];
const ROOTS = ['criminal', 'unwinged', 'serialKiller', 'demon', 'desireApostle', 'devil', 'blatherer', 'bloodDuke'];
const NEW_IDS = ['abyss.s1.impulse-binding', 'abyss.s1.focused-interference'];
const CASES = ['measured-reading', 'observed-tension', 'withdrawn-input'];
const STAGES = ['NATURAL718_PREFIX_PUBLIC_UNCLEAN_MONARCH_CONTINUATION', 'SAME_SEED_FINITE_POTION_FAILURES_ALIVE_S2',
  'ACTUAL_FINITE_ENCOUNTER_UNRESOLVED', 'ACTUAL_TERMINAL_WITH_NATURAL718_HISTORY'];
const STRATEGY = {source:'EXACT718_LIVING_BLOOD_DUKE_BOUNDARY_BEFORE_LAST',sourceSeed:'criminal-natural-v054',sourceCursor:112,
  caseMethod:'ABILITY',caseRoute:'CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS',
  encounterPolicy:'ALL',combatStance:'CONTROL',combatRoundCap:90,potionAttemptCap:12,maxCommands:3500,ordinaryPreparationCap:600,
  sourceInjuryRecovery:'NONE_HEALTHY_ORIGINAL718',ordinaryActions:'WORK_ONCE_PER_WEEK_THEN_REST',
  recovery:{health:100,mind:100,spirituality:120,pollution:0},caseReadiness:{ap:3,cash:20,mind:4,spirituality:8},
  encounterReadiness:{ap:2,cash:30},afterCases:'NO_OPTIONAL_MAXIMUM_RECOVERY_ONE_PUBLIC_WORK_AFTER_LIVING_EXIT',
  eventChoices:{ORIGIN:'.decline','LIFE-BILL-01':'PAY_PART','DEBT-NOTICE-01':'DECLINE','DEBT-SETTLE-01':'DEFER','LIFE-CARE-01':'PAY','CARE-WORK-OFFER':'DECLINE'}};
// Before promotion the current original scene is blatherer.life. Promotion
// initializes one new copy, and an actual encounter advances that same copy.
const currentSite = s => s.uncleanMonarch.promotionWeek === null ? s.blatherer.life : s.uncleanMonarch.encounter.currentSite ?? s.uncleanMonarch.life.site;
const originalResources = s => ({ site: s.blatherer.life, operation: s.bloodDuke.life.operation, strain: s.demon.strain });
const currentOriginals = s => ({ site: currentSite(s), operation: s.uncleanMonarch.promotionWeek === null ? s.bloodDuke.life.operation : s.uncleanMonarch.life.operation,
  strain: s.uncleanMonarch.encounter.strain ?? s.demon.strain });
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const body = s => ({ status: s.status, revision: s.revision, week: s.week, date: s.date, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining,
  pollution: s.seer.pollution, injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery, sequence: s.progression.sequence, acting: s.progression.acting,
  finance: { weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit, pulse: s.pulse, billAmount: s.billAmount } });
function compact(s) {
  const life = s.uncleanMonarch.life, encounter = s.uncleanMonarch.encounter;
  return { ...body(s), activeEvent: s.activeEvent?.instanceId ?? null, site: currentSite(s),
    life: { activeCase: life.activeCase, pending: life.pending, clockSeconds: currentSite(s).clockSeconds },
    encounter: { status: encounter.status, currentSite: encounter.currentSite, terminal: encounter.terminal } };
}

function combatAbilityUse(rounds) {
 const actions=rounds.flatMap(r=>r.uncleanMonarchOutcome.playerActions);
 return Object.fromEntries(NEW_IDS.map(id=>{const selected=actions.filter(a=>a.id===id);return[id,{
  selectedSlots:selected.length,paidAttempts:selected.filter(a=>a.attempted).length,
  castingSuccesses:selected.filter(a=>a.succeeded).length,preparedWindows:selected.filter(a=>a.chargeGranted).length,
  actualApplications:selected.filter(a=>a.applied&&a.appliedAmount>0).length,
  masteryApplications:selected.filter(a=>a.masteryApplied.includes(id)).length,
  spiritualitySpent:selected.reduce((n,a)=>n+a.paidCost,0),mindSpent:selected.reduce((n,a)=>n+a.mindCost,0)
 }];}));
}

async function loadRuntime() {
  const modules = await Promise.all([
    import('../../dist/persistence/slice-store.js'), import('../../dist/domain/slice/index.js'),
    import('../../dist/domain/slice/migration.js'), import('../../dist/domain/slice/validation.js'),
    import('../../dist/domain/canonical.js'), import('../../dist/domain/unclean-monarch/index.js'),
    import('../../dist/domain/unclean-monarch/life.js'), import('../../dist/domain/unclean-monarch/encounter.js'),
  ]);
  return Object.assign({}, ...modules);
}

function checkPublic(runtime, state, intent, proof, strategy) {
  assert(runtime.validateSlicePayload(intent), 'Strict public intent payload');
  const view = runtime.projectSliceState(state);
  assert.equal(view.status, 'ACTIVE', 'New S1 continuation commands never reopen terminal history');
  if (intent.type === 'UNCLEAN_MONARCH') {
    const control = view.uncleanMonarch.actions.find(row => runtime.stableStringify(row.command) === runtime.stableStringify(intent.command));
    assert(control?.enabled, control?.reason ?? `Missing offered Unclean Monarch control: ${JSON.stringify(intent)}`);
    assert.deepEqual(proof.control, control);
    if (intent.command.type === 'LEARN_GUIDANCE') {
      assert.equal(state.injuries.length, 0, 'Original718 is genuinely uninjured');
      assert.equal(state.health, 100); assert.equal(state.mind, 100); assert.equal(state.spirituality, 120);
    }
    const lifeControl = view.uncleanMonarch.life.actions.find(row => runtime.stableStringify(row.command) === runtime.stableStringify(intent.command));
    if (lifeControl) {
      const nextCase = CASES.find(id => state.uncleanMonarch.life.cases[id].status !== 'RESOLVED');
      if ('caseId' in intent.command) assert.equal(intent.command.caseId, nextCase, 'One declared case at a time in frozen order');
      if (!['OBSERVE', 'REPORT', 'REFLECT'].includes(intent.command.type)) assert.equal(lifeControl.preferredAction, true, 'Use the actual enabled preferred path, including ordinary failed-spell completion');
      if (intent.command.type === 'PREPARE') assert.equal(intent.command.method, strategy.caseMethod);
    }
    if (intent.command.type === 'SET_COMBAT_POLICY') assert.equal(intent.command.policy, strategy.encounterPolicy);
    if (intent.command.type === 'ENCOUNTER_FIGHT') assert.equal(state.uncleanMonarch.encounter.policy, strategy.encounterPolicy);
  } else if (intent.type === 'ACTION') {
    assert(['WORK', 'REST'].includes(intent.action), 'Only the declared ordinary work/rest preparation is allowed');
    assert(view.canAct, view.actionBlockedReason);
    assert(!view.uncleanMonarch.insideCase && !state.combat && state.uncleanMonarch.preparedWeek === null);
    assert.deepEqual(proof.control, { kind: 'ACTION', action: intent.action, ...(intent.targetId ? { targetId: intent.targetId } : {}), enabled: true });
  } else if (intent.type === 'EVENT_CHOICE') {
    assert.equal(state.activeEvent?.instanceId, intent.eventInstanceId);
    const control = view.activeEvent?.choices.find(row => row.id === intent.choiceId); assert(control?.enabled);
    assert.equal(intent.choiceId, strategy.eventChoices[view.activeEvent.id.startsWith('ORIGIN') ? 'ORIGIN' : view.activeEvent.id]);
    assert.deepEqual(proof.control, control);
  } else {
    assert.equal(intent.type, 'COMBAT_ROUND'); assert.equal(intent.stance, strategy.combatStance);
    assert.equal(state.uncleanMonarch.encounter.policy, strategy.encounterPolicy);
    assert.equal(view.status, 'ACTIVE'); assert.equal(view.activeEvent, null); assert(view.combat?.stances.some(row => row.id === intent.stance));
    assert.deepEqual(proof.control, { kind: 'COMBAT_ROUND', stance: intent.stance, round: state.combat.round });
  }
}

function checkOriginals(runtime, state, original) {
  for (const key of ROOTS) assert.deepEqual(state[key], original[key], `Exact immutable original eight-root history: ${key}`);
  const site = currentSite(state), old = original.blatherer.life;
  assert(old, 'The source current scene is blatherer.life, never bloodDuke.life.source.snapshot');
  if (state.uncleanMonarch.promotionWeek !== null) assert.deepEqual(site, runtime.getUncleanMonarchCurrentSite(state));
  const sourceOriginals = originalResources(original), now = currentOriginals(state);
  if (state.uncleanMonarch.guidanceKnown) {
    assert.deepEqual(state.uncleanMonarch.sourceHistory, Object.fromEntries(ROOTS.map(key => [key, original[key]])));
    assert.deepEqual(state.uncleanMonarch.sourceScene.originals, sourceOriginals);
    assert(runtime.validateUncleanMonarchSource(state), 'Authenticated acquisition history');
  }
  if (state.uncleanMonarch.promotionWeek === null) {
    assert.equal(state.uncleanMonarch.life.sourceWeek, null);
    assert.deepEqual(state.uncleanMonarch.life, runtime.createUncleanMonarchLifeState()); assert.deepEqual(site, old);
  } else {
    assert.equal(state.uncleanMonarch.life.sourceWeek, state.uncleanMonarch.promotionWeek);
    assert(runtime.validateUncleanMonarchCurrentSite(site, sourceOriginals));
  }
  assert(runtime.validateUncleanMonarchLifeState(state)); assert(runtime.validateUncleanMonarchEncounterState(state));
  assert.equal(Object.hasOwn(site, 'playerEnergy'), false); assert.equal(Object.hasOwn(site.volunteer, 'energy'), false);
  assert.equal(site.siteId, old.siteId);
  for (const key of ['id', 'owner', 'quantity']) assert.deepEqual(site.card[key], old.card[key]);
  for (const key of ['id', 'name', 'age', 'alive', 'willing']) assert.deepEqual(site.volunteer[key], old.volunteer[key]);
  assert.deepEqual(site.guide, old.guide); assert.deepEqual(site.bell, old.bell); assert.deepEqual(site.note, old.note);
  assert.equal(now.operation.door, 'OPEN'); assert(now.operation.bellRehearsals >= original.bloodDuke.life.operation.bellRehearsals);
  assert(Number.isInteger(now.strain) && now.strain >= 0 && now.strain <= 3);
  const life = state.uncleanMonarch.life, efforts = CASES.flatMap(id => life.cases[id].attempts).reduce((n, a) => n + a.volunteerEffortSpent, 0);
  assert.equal(life.volunteerEffortSpent, efforts); assert(efforts <= 12, 'Only new actual collaboration is counted, with no reset or refill');
  assert(site.clockSeconds >= old.clockSeconds); assert(site.playerTravelMetres >= old.playerTravelMetres);
  assert.deepEqual(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  assert.deepEqual(state.seer.completedSources.slice(0, original.seer.completedSources.length), original.seer.completedSources);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of NEW_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(runtime.uncleanMonarchLifeMasteryGains(state))) mastery[id] += gain;
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    assert(round.uncleanMonarchOutcome);
    for (const action of [...round.uncleanMonarchOutcome.playerActions, ...round.uncleanMonarchOutcome.enemyActions]) for (const id of action.masteryApplied) {
      assert(Object.hasOwn(mastery, id)); mastery[id] = Math.min(500, mastery[id] + 8);
    }
  }
  assert.deepEqual(state.progression.mastery, mastery, 'Only actual applications reported once or actually applied in combat grant mastery');
  const { coreStats, ...identity } = state.character, { coreStats: stats, ...oldIdentity } = original.character;
  assert.deepEqual(identity, oldIdentity);
  for (const [key, value] of Object.entries(stats)) assert.equal(coreStats[key], Math.min(500, value + (state.progression.sequence === 1 ? 1 : 0)));
  assert.equal(state.progression.promotionWeek, original.progression.promotionWeek);
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, SEED);
}

// Stored SQL rows prove rollback of backup bytes, receipt JSON, timestamps and
// active-run selection. Merely comparing the projected state is insufficient.
function storedRows(database) {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    return {
      runs: db.prepare('SELECT id,current_json,backup_json,terminal,updated_at FROM slice_runs ORDER BY id').all(),
      receipts: db.prepare('SELECT id,fingerprint,receipt_json FROM slice_receipts ORDER BY id').all(),
      meta: db.prepare('SELECT key,value FROM slice_meta ORDER BY key').all(),
    };
  } finally { db.close(); }
}

function checkSqlite(runtime, database, before, intent, after, intentId) {
  // Only this run's freshly allocated scratch DB is reset between checks. Never
  // open/reset a supplied DB or any fixture; sealed terminal DBs remain separate.
  if (existsSync(database)) {
    assert(!existsSync(`${database}.sealed`), 'Never reset any sealed verification database');
    const db = new DatabaseSync(database);
    try { db.exec('BEGIN IMMEDIATE; DELETE FROM slice_receipts; DELETE FROM slice_runs; DELETE FROM slice_meta; COMMIT;'); }
    finally { db.close(); }
  }
  let app, inject = false, injectedAfterApply = 0;
  const envelope = { intentId, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const expectedPublic = runtime.projectSliceState(after);
  try {
    app = new runtime.SqliteSliceStore(database, { beforeWrite: () => {
      if (!inject) return;
      assert.deepEqual(app.repository.get(after.runId).state, after, 'Inject failure after complete actual apply');
      const receipt = app.repository.receipt(intentId); assert(receipt);
      assert.equal(receipt.fingerprint, runtime.stableStringify(envelope)); assert.deepEqual(receipt.receipt.state, expectedPublic);
      assert.equal(app.repository.activeRun(), before.runId); injectedAfterApply++;
      throw Error('injected boundary write failure after apply and receipt');
    } });
    app.repository.transaction(() => { app.repository.put({ state: before, updatedAt: '2026-10-15T00:00:00.000Z' }); app.repository.selectRun(before.runId); });
    const originalRows = storedRows(database);
    inject = true;
    const rejected = app.submitIntent(envelope);
    assert.equal(rejected.ok, false); assert.equal(rejected.error.code, 'SAVE_FAILED', JSON.stringify(rejected)); assert.equal(injectedAfterApply, 1);
    assert.deepEqual(app.repository.get(before.runId).state, before); assert.equal(app.repository.receipt(intentId), null);
    assert.deepEqual(storedRows(database), originalRows); assert.equal(existsSync(`${database}.sealed`), false);
    app.close(); app = undefined; app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(storedRows(database), originalRows); assert.deepEqual(app.repository.get(before.runId).state, before);
    assert.equal(app.repository.receipt(intentId), null); assert.equal(app.repository.activeRun(), before.runId);
    const committed = app.submitIntent(envelope);
    assert.equal(committed.ok, true, JSON.stringify(committed)); assert.equal(committed.value.replayed, false);
    assert.deepEqual(committed.value.state, expectedPublic); assert.deepEqual(app.repository.get(after.runId).state, after);
    assert.deepEqual(app.repository.receipt(intentId).receipt, committed.value);
    const committedRows = storedRows(database);
    assert.equal(committedRows.runs.length, 1); assert.equal(committedRows.receipts.length, 1);
    app.close(); app = undefined; app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(storedRows(database), committedRows); assert.deepEqual(app.repository.get(after.runId).state, after);
    assert.deepEqual(runtime.projectSliceState(app.repository.get(after.runId).state), expectedPublic); assert.equal(app.repository.activeRun(), after.runId);
    const replay = app.submitIntent(envelope);
    assert.equal(replay.ok, true, JSON.stringify(replay)); assert.deepEqual(replay.value, { ...committed.value, replayed: true });
    assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(storedRows(database), committedRows);
    const staleId = `${intentId}:stale`, stale = app.submitIntent({ ...envelope, intentId: staleId });
    assert.equal(stale.ok, false); assert.equal(stale.error.code, 'REVISION_CONFLICT', JSON.stringify(stale));
    assert.equal(app.repository.receipt(staleId), null); assert.deepEqual(app.repository.get(after.runId).state, after);
    assert.deepEqual(storedRows(database), committedRows, 'Stale request must not change body, backup, receipt, timestamp or active run');
    if (after.status === 'DEAD') {
      assert.deepEqual(json(`${database}.sealed`), [after.runId]); assert.equal(expectedPublic.canAct, false);
      for (const payload of [{ type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' }]) {
        const blockedId = `${intentId}:sealed:${payload.type}`, blocked = app.submitIntent({ intentId: blockedId, runId: after.runId, expectedRevision: after.revision, payload });
        assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED'); assert.equal(app.repository.receipt(blockedId), null);
        assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(storedRows(database), committedRows);
        assert.deepEqual(json(`${database}.sealed`), [after.runId]);
      }
    } else assert.equal(existsSync(`${database}.sealed`), false, 'A living result is not a sealed death');
    app.close(); app = undefined; app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(storedRows(database), committedRows); assert.deepEqual(app.repository.get(after.runId).state, after);
    assert.equal(app.repository.receipt(staleId), null);
  } finally { app?.close(); }
}

// Replay immutable old terminal lines independently. Their same-seed living
// forks do not change the source outcomes, and each death gets its own sealed DB.
function verifyPreservedDeaths(runtime, outputDir, migrate, hash, original) {
  const rows = [];
  for (const [index, file] of PRESERVED.entries()) {
    const commands = readObjectEntry(file, 'commands'), rawFinal = readObjectEntry(file, 'final');
    const seed = readObjectEntry(file, 'seed'), creation = readObjectEntry(file, 'creation');
    assert.equal(seed, SEED); assert.equal(rawFinal.status, 'DEAD'); assert.equal(rawFinal.health, 0);
    let state = runtime.createSliceRun(rawFinal.runId, creation, seed), beforeLast = null, lastIntent = null;
    assert.deepEqual(state, migrate(readObjectEntry(file, 'initial')));
    for (const [step, intent] of commands.entries()) {
      assert(runtime.validateSlicePayload(intent), `Strict immutable death-line command ${file}:${step + 1}`);
      assert(state.status === 'ACTIVE' || state.status === 'SLICE_COMPLETE' && intent.type === 'CONTINUE_LIFE');
      beforeLast = state; lastIntent = intent; state = runtime.applySliceIntent(state, intent); runtime.assertValidSliceState(state);
      assert.equal(state.revision, beforeLast.revision + 1); assert.equal(state.random.seed, seed); assert(state.random.cursor >= beforeLast.random.cursor);
      if (file === SOURCE && step + 1 === PREFIX_COUNT) assert.deepEqual(state, original);
      if (step + 1 < commands.length) assert.notEqual(state.status, 'DEAD', 'Death can only end an immutable original run');
    }
    assert(beforeLast && lastIntent); assert.equal(beforeLast.status, 'ACTIVE');
    assert.deepEqual(state, migrate(rawFinal), `Exact full immutable terminal replay: ${file}`);
    assert.equal(state.status, 'DEAD'); assert.equal(state.health, 0); assert.equal(state.ending.kind, 'DEATH');
    assert.equal(runtime.projectSliceState(state).canAct, false);
    const database = join(outputDir, `preserved-death-${commands.length}.sqlite`);
    checkSqlite(runtime, database, beforeLast, lastIntent, state, `unclean-monarch202:preserved:${index}:${commands.length}`);
    rows.push({ file, sourceSha256: PRESERVED_SHA[index], commands: commands.length, status: state.status, health: state.health,
      finalStateSha256: hash(state), random: state.random, database: relative(outputDir, database),
      checks: ['exact-original-creation-and-commands', 'full-migrated-terminal-equality', 'after-apply-rollback', 'receipt-idempotence', 'reopen-sealed', 'dead-action-and-continue-life-blocked'] });
    state = null; beforeLast = null; global.gc?.();
  }
  return rows;
}

export async function verifyUncleanMonarchBoundaries(options) {
  assert.equal(options.key, 'boundaries'); assert.equal(options.start, 0);
  assert(options.expectedBoundaries !== undefined, 'Supply the observed --expected-boundaries count; never guess it before the producer runs');
  const source = inspectSources(options), naturalPath = join(source.root, 'natural.json');
  const summary = json(join(source.root, 'summary.json')), integrity = json(join(source.root, 'capture-integrity.json'));
  assert.equal(source.count, source.entries.length, 'No partial verification');
  assert(Number.isSafeInteger(options.expectedBoundaries) && options.expectedBoundaries > 0);
  assert(STAGES.includes(summary.stage), 'An ACTUAL_BLOCKER is preserved evidence, not a completed continuation');
  const immutable = new Map();
  const pin = (path, sha) => { const evidence = fileEvidence(path); if (sha) assert.equal(evidence.sha256, sha, path); immutable.set(path, evidence); return evidence; };
  pin(SOURCE, SOURCE_SHA); pin(SOURCE_BOUNDARY, SOURCE_BOUNDARY_SHA);
  assert.match(integrity.producerSha256, /^[0-9a-f]{64}$/);
  pin(fileURLToPath(new URL('./unclean-monarch-stage.mjs', import.meta.url)), integrity.producerSha256);
  const metadataFiles = { 'natural.json': 'naturalSha256', 'summary.json': 'summarySha256', 'commands.jsonl': 'commandsSha256', 'public.jsonl': 'publicSha256',
    'boundaries.index.json': 'boundaryIndexSha256', 'boundaries.steps.json': 'boundaryStepsSha256', 'transitions.json': 'transitionsSha256', 'source-prefix.json': 'sourcePrefixSha256' };
  for (const [name, field] of Object.entries(metadataFiles)) {
    const path = join(source.root, name); assert.equal(realpathSync(path), path, 'Capture metadata cannot be an external symlink');
    assert.match(integrity[field], /^[0-9a-f]{64}$/, `Missing integrity hash: ${field}`); pin(path, integrity[field]);
  }
  const integrityPath = join(source.root, 'capture-integrity.json'); assert.equal(realpathSync(integrityPath), integrityPath); pin(integrityPath);
  assert.deepEqual(source.indexEvidence, immutable.get(source.indexPath));
  assert(summary.snapshots && typeof summary.snapshots === 'object' && !Array.isArray(summary.snapshots));
  assert(integrity.files && typeof integrity.files === 'object' && !Array.isArray(integrity.files));
  assert.deepEqual(readObjectEntry(naturalPath, 'snapshots'), summary.snapshots);
  const expectedFiles = [...new Set([...source.entries.map(row => row.filename), ...Object.values(summary.snapshots)])].sort();
  assert.deepEqual(Object.keys(integrity.files).sort(), expectedFiles, 'Every boundary and snapshot is hashed exactly once');
  for (const name of expectedFiles) {
    assert.equal(name, basename(name)); assert(name.endsWith('.json')); assert.match(integrity.files[name], /^[0-9a-f]{64}$/);
    const path = join(source.root, name); assert.equal(realpathSync(path), path, 'No external capture symlinks'); pin(path, integrity.files[name]);
  }
  const expectedMembers = [...Object.keys(metadataFiles), 'capture-integrity.json', ...expectedFiles].sort();
  assert.deepEqual(readdirSync(source.root).sort(), expectedMembers, 'No unaccounted or missing capture members');
  assert.deepEqual(source.entries.map(row => row.name), summary.boundaries);
  const steps = json(join(source.root, 'boundaries.steps.json')), transitions = json(join(source.root, 'transitions.json'));
  assert.deepEqual(Object.keys(steps), summary.boundaries); assert(Array.isArray(transitions));
  const commands = readObjectEntry(naturalPath, 'commands'), sourceCommands = readObjectEntry(SOURCE, 'commands'), prefix = sourceCommands.slice(0, PREFIX_COUNT);
  assert.equal(sourceCommands.length, 724);
  assert.equal(prefix.length, PREFIX_COUNT); assert.equal(compactHash(prefix), PREFIX_SHA);
  assert.deepEqual(commands.slice(0, PREFIX_COUNT), prefix); assert.equal(commands.length, summary.commands);
  assert(commands.length > PREFIX_COUNT && commands.length <= summary.strategy.maxCommands);
  assert.equal(readObjectEntry(SOURCE, 'prefixCount'), INHERITED_COUNT);
  const priorProvenance = readObjectEntry(SOURCE, 'provenance');
  assert.equal(priorProvenance.kind, 'SAME_SEED_PUBLIC_LIVING_FORK_BEFORE_OPTIONAL_COMBAT');
  assert.equal(priorProvenance.source, PRESERVED[1]); assert.equal(priorProvenance.sourceSha256, PRESERVED_SHA[1]);
  assert.equal(priorProvenance.newRandomChanges, false);
  const prefixPath = join(source.root, 'source-prefix.json'), provenance = readObjectEntry(naturalPath, 'provenance');
  assert.equal(provenance.kind, 'EXACT718_PUBLIC_BLOOD_DUKE_THEN_PUBLIC_UNCLEAN_MONARCH');
  assert.equal(provenance.inheritedDirectedPrefix, false); assert.equal(provenance.fullNaturalS9ToS1, summary.final.sequence === 1); assert.equal(provenance.newRandomChanges, false);
  assert.equal(provenance.source, SOURCE); assert.equal(provenance.sourceRoot, 'beforeLast'); assert.equal(provenance.sourceBoundary, SOURCE_BOUNDARY); assert.equal(provenance.sourceBoundarySha256, SOURCE_BOUNDARY_SHA); assert.equal(provenance.sourceSha256, SOURCE_SHA);
  assert.deepEqual(provenance.prior, priorProvenance);
  assert.deepEqual(readObjectEntry(naturalPath, 'continuation'), { kind: 'EXACT718_LIVING_PREFIX_THEN_PUBLIC_UNCLEAN_MONARCH', sourceFixture: SOURCE, sourceRoot: 'beforeLast', sourceBoundary: SOURCE_BOUNDARY, sourceBoundarySha256: SOURCE_BOUNDARY_SHA, sourceS2Setup: 'NATURAL_LIVING_PREFIX_OF_PRESERVED_DEATH', newRandomChanges: false });
  const preserved = PRESERVED.map((file, index) => ({ file, sha256: pin(file, PRESERVED_SHA[index]).sha256, commands: readObjectEntry(file, 'commands').length, status: readObjectEntry(file, 'final').status }));
  assert.deepEqual(provenance.preserved, preserved); assert.deepEqual(summary.source.preserved, preserved);
  assert.deepEqual(readObjectEntry(prefixPath, 'preserved'), preserved);
  // Both complete terminal captures remain independent immutable histories.
  assert.equal(new Set(preserved.map(row => realpathSync(row.file))).size, PRESERVED.length);
  assert.deepEqual(preserved.map(row => [row.commands, row.status]), [[724, 'DEAD'], [592, 'DEAD']]);
  assert.equal(readObjectEntry(naturalPath, 'producerSha256'), integrity.producerSha256); assert.equal(summary.producerSha256, integrity.producerSha256);
  assert.equal(readObjectEntry(naturalPath, 'prefixCount'), PREFIX_COUNT); assert.equal(readObjectEntry(naturalPath, 'inheritedPrefixCount'), INHERITED_COUNT);
  assert.equal(readObjectEntry(naturalPath, 'prefixVerified'), true); assert.equal(readObjectEntry(naturalPath, 'seed'), SEED);
  assert.equal(readObjectEntry(naturalPath, 'stage'), summary.stage); assert.equal(readObjectEntry(naturalPath, 'pendingIntent'), null);
  if (summary.stage === STAGES[2]) assert.equal(typeof readObjectEntry(naturalPath, 'error'), 'string'); else assert.equal(readObjectEntry(naturalPath, 'error'), null);
  assert.equal(readObjectEntry(naturalPath, 'failurePhase'), 'IDLE'); assert.deepEqual(readObjectEntry(naturalPath, 'strategy'), summary.strategy);
  assert.equal(summary.source.prefixCount, PREFIX_COUNT); assert.equal(summary.source.prefixVerified, true);
  assert.equal(summary.source.sourceSha256, SOURCE_SHA); assert.equal(summary.source.prefixCompactSha256, PREFIX_SHA);
  assert.equal(summary.source.sourceBoundary, SOURCE_BOUNDARY); assert.equal(summary.source.sourceBoundarySha256, SOURCE_BOUNDARY_SHA);
  assert.deepEqual(summary.strategy, STRATEGY, 'Exact frozen public strategy, including costs, finite limits and event choices');

  const runtime = await loadRuntime(), rawSource = readObjectEntry(SOURCE_BOUNDARY, 'beforeLast');
  const hash = value => createHash('sha256').update(runtime.stableStringify(value)).digest('hex');
  assert.equal(rawSource.schemaVersion, 177); assert.equal(rawSource.contentVersion, 'blood-duke-v177');
  const original = runtime.migrateSliceState(rawSource);
  const currentSchemaVersion = original.schemaVersion, currentContentVersion = original.contentVersion;
  assert.equal(currentSchemaVersion, 199); assert.equal(currentContentVersion, 'unclean-monarch-v199');
  const migrate = raw => { const state = runtime.migrateSliceState(raw); assert.equal(state.schemaVersion, currentSchemaVersion); assert.equal(state.contentVersion, currentContentVersion); runtime.assertValidSliceState(state); return state; };
  const capturedPrefix = readObjectEntry(naturalPath, 'prefixFinal'), captureSchemaVersion = capturedPrefix.schemaVersion, captureContentVersion = capturedPrefix.contentVersion;
  assert.equal(captureSchemaVersion, 199); assert.equal(captureContentVersion, 'unclean-monarch-v199');
  assert.deepEqual(migrate(capturedPrefix), original);
  const initial = migrate(readObjectEntry(naturalPath, 'initial')); assert.deepEqual(initial, migrate(readObjectEntry(SOURCE, 'initial')));
  assert.equal(initial.random.seed, SEED); assert.equal(initial.progression.sequence, null);
  assert.equal(original.status, 'ACTIVE'); assert.equal(original.revision, 719);
  assert.equal(original.revision, initial.revision + PREFIX_COUNT); assert.equal(original.week, 181); assert.deepEqual(original.random, { seed: SEED, cursor: 112 });
  assert.equal(original.health, 100); assert.equal(original.mind, 100); assert.equal(original.spirituality, 120); assert.equal(original.cash, 710); assert.equal(original.actionsRemaining, 3);
  assert.equal(original.progression.sequence, 2); assert.equal(original.progression.acting, 100); assert.equal(original.bloodDuke.promotionWeek, 172);
  assert.deepEqual(original.injuries, []); assert.equal(original.injuryRisk, 0); assert.equal(original.unwinged.conscienceLost, true); assert.equal(original.demon.strain, 3);
  assert.equal(Object.keys(original.progression.mastery).length, 16);
  assert.deepEqual(Object.keys(original.progression.mastery).filter(id => original.progression.mastery[id] === 0), ['abyss.s7.demonic-lore','abyss.s7.ritual-practice','abyss.s6.danger-premonition','abyss.s5.catalysis']);
  const originalSite = original.blatherer.life;
  assert.equal(originalSite.siteId, 'BL3-QUIET-ROOM'); assert.equal(originalSite.playerLocation, 'START'); assert.equal(originalSite.volunteer.location, 'A');
  assert.equal(originalSite.volunteer.id, 'BL3-NORA'); assert.equal(originalSite.volunteer.age, 46); assert.equal(originalSite.volunteer.alive, true); assert.equal(originalSite.volunteer.willing, true);
  assert.equal(Object.hasOwn(originalSite.volunteer, 'energy'), false); assert.equal(originalSite.playerTravelMetres, 96); assert.equal(originalSite.clockSeconds, 317);
  assert.equal(originalSite.card.location, 'NORA'); assert.equal(originalSite.card.travelMetres, 40); assert.equal(originalSite.guide.location, 'OUTSIDE'); assert.equal(originalSite.guide.travelMetres, 24);
  assert.deepEqual(original.bloodDuke.life.operation, {door:'OPEN',inputActive:false,impulse:null,emotion:null,restraintUntil:null,hesitationUntil:null,bellRehearsals:2});
  assert.equal(original.blatherer.encounter.status, 'AVAILABLE'); assert.equal(original.bloodDuke.encounter.status, 'AVAILABLE');
  assert.equal(original.devil.encounter.enemyStatus, 'SURRENDERED'); assert.equal(original.devil.encounter.enemyHealth, 70); assert.equal(original.devil.encounter.enemyMind, 100); assert.equal(original.devil.encounter.enemySpirituality, 32);
  assert.deepEqual(readObjectEntry(prefixPath, 'rawInitial'), readObjectEntry(SOURCE, 'initial')); assert.deepEqual(readObjectEntry(prefixPath, 'rawFinal'), rawSource);
  assert.deepEqual(readObjectEntry(prefixPath, 'commands'), prefix); assert.equal(readObjectEntry(prefixPath, 'rawCommandsSha256'), PREFIX_SHA);
  assert.equal(readObjectEntry(prefixPath, 'migratedWholeStateSha256'), hash(capturedPrefix)); assert.equal(summary.source.migratedWholeSourceSha256, hash(capturedPrefix));
  assert.equal(readObjectEntry(prefixPath, 'source'), SOURCE); assert.equal(readObjectEntry(prefixPath, 'sourceSha256'), SOURCE_SHA);
  assert.equal(readObjectEntry(prefixPath, 'sourceRoot'), 'beforeLast'); assert.equal(readObjectEntry(prefixPath, 'sourceBoundary'), SOURCE_BOUNDARY); assert.equal(readObjectEntry(prefixPath, 'sourceBoundarySha256'), SOURCE_BOUNDARY_SHA);
  assert.equal(readObjectEntry(prefixPath, 'prefixCount'), PREFIX_COUNT); assert.equal(readObjectEntry(prefixPath, 'inheritedDirectedPrefix'), false);
  assert.deepEqual(summary.originalMastery, original.progression.mastery);

  // Recreate the exact original creation and replay all718 original public
  // commands once. Keep only one replay state, rather than a prefix-state array.
  const creation = readObjectEntry(SOURCE, 'creation');
  assert.deepEqual(readObjectEntry(naturalPath, 'creation'), creation);
  assert.deepEqual(readObjectEntry(PRESERVED[1], 'creation'), creation);
  assert.deepEqual(readObjectEntry(PRESERVED[1], 'commands').slice(0, INHERITED_COUNT), prefix.slice(0, INHERITED_COUNT));
  let prefixState = runtime.createSliceRun(initial.runId, creation, SEED);
  assert.deepEqual(prefixState, initial, 'Current creation equals migrated immutable original initial');
  let ledgerCount = 0, ledgerTail = null, sourceRow = null, sourceBeforeLastSha256 = null;
  const sourceContinues = [];
  for (const row of readJsonLines(join(source.root, 'commands.jsonl'))) {
    assert.equal(row.step, ++ledgerCount); assert.deepEqual(row.intent, commands[ledgerCount - 1]); assert.equal(row.sourcePrefix, ledgerCount <= PREFIX_COUNT);
    assert.equal(row.after.revision, row.before.revision + 1); assert.equal(row.before.random.seed, SEED); assert.equal(row.after.random.seed, SEED);
    assert(row.after.random.cursor >= row.before.random.cursor);
    assert(row.before.status === 'ACTIVE' || (row.before.status === 'SLICE_COMPLETE' && row.intent.type === 'CONTINUE_LIFE'), 'Only the original completed slice may explicitly continue life; actual death never resumes');
    if (ledgerTail) assert.deepEqual(row.before, ledgerTail); else assert.deepEqual(row.before, body(initial));
    if (ledgerCount <= PREFIX_COUNT) {
      assert(runtime.validateSlicePayload(row.intent), `Strict original public command ${ledgerCount}`);
      assert.deepEqual(body(prefixState), row.before);
      if (row.intent.type === 'CONTINUE_LIFE') {
        const publicBefore = runtime.projectSliceState(prefixState);
        assert.equal(publicBefore.status, 'SLICE_COMPLETE');
        assert(publicBefore.ending && publicBefore.ending.kind !== 'DEATH');
        assert.equal(publicBefore.caseArchive.length, 0);
        sourceContinues.push({ step: ledgerCount, beforeRevision: prefixState.revision, endingKind: prefixState.ending.kind });
      }
      // Derive the immediately previous717 state from original creation;
      // the separately pinned boundary.beforeLast is the718 final state.
      if (ledgerCount === PREFIX_COUNT) sourceBeforeLastSha256 = hash(prefixState);
      prefixState = runtime.applySliceIntent(prefixState, row.intent); runtime.assertValidSliceState(prefixState);
      if (row.intent.type === 'CONTINUE_LIFE') assert.equal(prefixState.status, 'ACTIVE');
      assert.deepEqual(body(prefixState), row.after, `Exact source prefix body/RNG at command ${ledgerCount}`);
      if (ledgerCount === INHERITED_COUNT) assert.deepEqual(prefixState, migrate(readObjectEntry(SOURCE, 'prefixFinal')), 'Prior living583 is an exact replayed prefix');
      if (ledgerCount === PREFIX_COUNT) {
        assert.deepEqual(prefixState, original, 'All718 original commands produce the exact migrated boundary.beforeLast state');
        assert.deepEqual(runtime.projectSliceState(prefixState), runtime.projectSliceState(original));
        prefixState = null; global.gc?.();
      }
    }
    ledgerTail = row.after; if (ledgerCount === PREFIX_COUNT) sourceRow = row;
  }
  assert.equal(ledgerCount, commands.length); assert.deepEqual(sourceRow.after, body(original));
  assert.equal(transitions.length, commands.length - PREFIX_COUNT + 1, 'One source718 end transaction and every actual new command exactly once');
  assert.equal(summary.uniqueTransitions, transitions.length);
  const byStep = new Map(), byName = new Map(source.entries.map(row => [row.name, row])), uniqueFiles = new Set();
  for (const [index, transition] of transitions.entries()) {
    assert.deepEqual(Object.keys(transition).sort(), ['key', 'file', 'commandIndex', 'beforeRevision', 'afterRevision'].sort());
    const step = PREFIX_COUNT + index; assert.equal(transition.commandIndex, step);
    const entry = byName.get(transition.key); assert(entry); assert.equal(transition.file, entry.filename); assert.equal(steps[transition.key], step);
    assert.equal(transition.beforeRevision, initial.revision + step - 1); assert.equal(transition.afterRevision, initial.revision + step);
    assert(!byStep.has(step)); assert(!uniqueFiles.has(transition.file), 'Different transactions cannot reuse a capture file');
    byStep.set(step, transition); uniqueFiles.add(transition.file);
  }
  const named = [], firstNames = new Map();
  for (const entry of source.entries) {
    const step = steps[entry.name], transition = byStep.get(step); assert(transition, `Unknown alias transition: ${entry.name}`);
    assert.equal(entry.filename, transition.file, 'Aliases must reference the exact same transaction file');
    const aliasOf = firstNames.get(step) ?? null;
    if (aliasOf === null) { assert.equal(entry.name, transition.key); firstNames.set(step, entry.name); }
    named.push({ name: entry.name, source: entry.filename, step, aliasOf, sourceSha256: immutable.get(entry.path).sha256 });
  }
  assert.equal(firstNames.size, transitions.length);
  const snapshotsByHash = new Map();
  for (const [name, filename] of Object.entries(summary.snapshots)) {
    const snapshot = json(join(source.root, filename));
    assert.equal(snapshot.schemaVersion, captureSchemaVersion); assert.equal(snapshot.contentVersion, captureContentVersion);
    const state = migrate(snapshot), step = state.revision - initial.revision; assert(byStep.has(step)); checkOriginals(runtime, state, original);
    snapshotsByHash.set(name, { step, sha256: hash(state) });
  }
  assert.deepEqual(json(join(source.root, summary.snapshots.departure)), capturedPrefix);

  const outputPath = resolve(options.outputDirectory); let ancestor = outputPath;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const intendedOutput = resolve(realpathSync(ancestor), relative(ancestor, outputPath));
  for (const protectedRoot of [source.root, realpathSync('tests/fixtures'), realpathSync('scripts/play')]) {
    const inside = relative(protectedRoot, intendedOutput);
    assert(inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside), 'All writable verification files must remain outside immutable inputs');
  }
  mkdirSync(outputPath, { recursive: true }); const outputRoot = realpathSync(outputPath); assert.equal(outputRoot, intendedOutput);
  const outputDir = mkdtempSync(join(outputRoot, `boundaries-${options.tag}-`)), commonDatabase = join(outputDir, 'verification.sqlite');
  const checks = [], actualTreatments = [], publicRows = readJsonLines(join(source.root, 'public.jsonl')), ledger = readJsonLines(join(source.root, 'commands.jsonl'));
  let commandRow, current = null, previousFinalHash = null;
  for (let i = 0; i < PREFIX_COUNT; i++) commandRow = ledger.next().value;
  try {
    for (const [index, transition] of transitions.entries()) {
      current = transition.key; const step = transition.commandIndex, path = join(source.root, transition.file);
      assert.equal(readObjectEntry(path, 'commandCount'), step);
      const rawBefore = readObjectEntry(path, 'beforeLast'), rawAfter = readObjectEntry(path, 'final');
      for (const raw of [rawBefore, rawAfter]) { assert.equal(raw.schemaVersion, captureSchemaVersion); assert.equal(raw.contentVersion, captureContentVersion); }
      const before = migrate(rawBefore), after = migrate(rawAfter), intent = readObjectEntry(path, 'lastIntent');
      assert.equal(before.status, 'ACTIVE'); assert.equal(after.runId, before.runId); assert.equal(after.revision, before.revision + 1);
      assert.equal(before.revision, transition.beforeRevision); assert.equal(after.revision, transition.afterRevision);
      if (index > 0) commandRow = ledger.next().value;
      assert(commandRow); assert.equal(commandRow.step, step); assert.deepEqual(intent, commands[step - 1]);
      assert.deepEqual(body(before), commandRow.before); assert.deepEqual(body(after), commandRow.after);
      if (previousFinalHash) assert.equal(hash(before), previousFinalHash, 'Exact full-state chain, not only matching body totals');
      else { assert.equal(hash(before), sourceBeforeLastSha256, 'Exact replayed source717 state'); assert.deepEqual(after, original); }
      if (step > PREFIX_COUNT) {
        const proof = publicRows.next().value; assert(proof); assert.equal(proof.step, step); assert.equal(proof.revision, before.revision); assert.deepEqual(proof.command, intent);
        assert.deepEqual(proof.randomBefore, before.random); assert.deepEqual(proof.randomAfter, after.random);
        assert.deepEqual(proof.before, compact(before)); assert.deepEqual(proof.after, compact(after));
        checkPublic(runtime, before, intent, proof, summary.strategy); checkOriginals(runtime, before, original);
        if (intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01') {
          assert.equal(intent.choiceId, 'PAY');
          actualTreatments.push({ paidPennies: 60, before: body(before), after: body(after) });
        }
        if (intent.type === 'UNCLEAN_MONARCH' && intent.command.type === 'CONSUME') {
          assert.equal(after.random.cursor, before.random.cursor + 1); assert.equal(after.uncleanMonarch.preparedWeek, null);
          assert.deepEqual(currentOriginals(after), currentOriginals(before), 'No potion movement, invented effort, original strain reset or tool restoration');
          assert.deepEqual(after.injuries, before.injuries, 'A potion does not heal the original body');
          if (after.progression.sequence === 1) {
            assert.equal(after.health, before.health); assert.equal(after.spirituality, before.spirituality);
            assert.deepEqual(after.progression.mastery, { ...before.progression.mastery, ...Object.fromEntries(NEW_IDS.map(id => [id, 0])) });
          }
        }
        assert(after.uncleanMonarch.life.volunteerEffortSpent >= before.uncleanMonarch.life.volunteerEffortSpent, 'Actual new volunteer effort never resets');
        assert(currentSite(after).card.travelMetres >= currentSite(before).card.travelMetres);
        assert(currentSite(after).clockSeconds >= currentSite(before).clockSeconds);

      }
      checkOriginals(runtime, after, original);
      const finalSha256 = hash(after);
      for (const [name, snapshot] of snapshotsByHash) if (snapshot.step === step) assert.equal(snapshot.sha256, finalSha256, `Snapshot is actual transaction final: ${name}`);
      const database = after.status === 'DEAD' ? join(outputDir, `terminal-${step}.sqlite`) : commonDatabase;
      checkSqlite(runtime, database, before, intent, after, `unclean-monarch202:${step}`);
      const row = { name: transition.key, source: transition.file, step, sourceSha256: integrity.files[transition.file], finalSha256,
        status: after.status, revision: after.revision, database: relative(outputDir, database),
        checks: ['after-apply-rollback-no-receipt', 'original-rows-unchanged', 'reopen-before-no-receipt', 'public-private-equality', 'reopen-after', 'same-intent-idempotent', 'stale-revision-no-mutation', 'reopen-after-stale',
          ...(after.status === 'DEAD' ? ['sealed-reopen-no-further-action', 'dead-continue-life-archived'] : ['living-no-terminal-sidecar'])] };
      checks.push(row); previousFinalHash = finalSha256; console.log(JSON.stringify(row)); global.gc?.();
    }
    assert.equal(ledger.next().done, true); assert.equal(publicRows.next().done, true);
    const final = migrate(readObjectEntry(naturalPath, 'final')), life = final.uncleanMonarch.life, encounter = final.uncleanMonarch.encounter;
    assert.equal(hash(final), previousFinalHash); assert.deepEqual(body(final), summary.final); assert.deepEqual(body(final), ledgerTail);
    assert.deepEqual(summary.mastery, final.progression.mastery); assert.deepEqual(summary.sourceOriginals, originalResources(original));
    assert.deepEqual(summary.currentOriginals, currentOriginals(final)); assert.deepEqual(summary.life, life); assert.deepEqual(summary.lifeCases, life.cases);
    assert.deepEqual(summary.encounter, encounter); assert.deepEqual(summary.bottles, final.uncleanMonarch.bottles);
    assert.deepEqual(summary.rounds, final.combatHistory.slice(original.combatHistory.length));
    assert.deepEqual(summary.combatAbilityUse, combatAbilityUse(summary.rounds));
    assert.deepEqual(summary.treatments, readObjectEntry(naturalPath, 'treatments'));
    assert.deepEqual(summary.treatments, actualTreatments, 'Clinic claims must be actual captured PAY transitions');
    assert(final.uncleanMonarch.bottles.filter(b => b.status === 'CONSUMED').length <= summary.strategy.potionAttemptCap);
    for (const id of CASES) {
      assert(life.cases[id].attempts.length <= 1, 'No retries selecting a more favorable spell outcome');
      const castCommands = life.journal.filter(e => e.command.caseId === id && ['IMPULSE_BINDING', 'FOCUSED_INTERFERENCE'].includes(e.command.type));
      assert(castCommands.length <= 1, 'One attempt on the declared preferred route');
    }
    assert.deepEqual(summary.lifeAbilityUse, Object.fromEntries(NEW_IDS.map((id, index) => {
      const attempts = CASES.filter(c => index === 1 ? c === 'observed-tension' : c !== 'observed-tension').flatMap(c => life.cases[c].attempts);
      return [id, { attempts: attempts.filter(a => a.castTier !== null).length,
        checkSuccesses: attempts.filter(a => ['SUCCESS', 'GREAT_SUCCESS'].includes(a.castTier)).length,
        actualApplications: attempts.filter(a => a.appliedAbilityIds.includes(id)).length,
        reportedApplications: CASES.filter(c => life.cases[c].status === 'RESOLVED').flatMap(c => life.cases[c].attempts).filter(a => a.appliedAbilityIds.includes(id)).length }];
    })));
    const lastPath = join(source.root, transitions.at(-1).file);
    assert.deepEqual(migrate(readObjectEntry(naturalPath, 'beforeLast')), migrate(readObjectEntry(lastPath, 'beforeLast')));
    assert.deepEqual(readObjectEntry(naturalPath, 'lastIntent'), commands.at(-1));
    if (summary.stage === STAGES[0]) {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.progression.sequence, 1); assert.equal(final.progression.acting, 100);
      for (const id of CASES) { assert.equal(life.cases[id].status, 'RESOLVED'); assert.equal(life.cases[id].attempts.length, 1); }
      assert.equal(life.reflected, true); assert.equal(life.pending, null); assert.equal(life.activeCase, null);
      assert.equal(currentSite(final).playerLocation, 'START');
      assert.equal(currentSite(final).volunteer.location, 'OUTSIDE');
      assert.equal(currentSite(final).card.location, 'NORA'); assert.equal(life.volunteerEffortSpent, 9);
      assert.equal(life.impulse, null); assert.equal(life.emotion, null); assert.equal(life.operation.inputActive, false);
      assert.equal(life.cases['withdrawn-input'].attempts[0].withdrawn, true); assert.equal(life.cases['withdrawn-input'].attempts[0].appliedAbilityIds.length, 0);
      assert.equal(final.combat, null); assert.equal(encounter.currentSite.playerLocation, 'START');
      assert.equal(encounter.terminal.exitMetres, 4); assert.equal(encounter.terminal.exitSeconds, 4);
      assert(summary.boundaries.includes('actual-work-after-living-exit'));
    } else if (summary.stage === STAGES[1]) {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.progression.sequence, 2); assert.equal(summary.rounds.length, 0);
      const consumed = final.uncleanMonarch.bottles.filter(row => row.status === 'CONSUMED'); assert.equal(consumed.length, summary.strategy.potionAttemptCap);
      assert(consumed.every(row => ['FAILURE', 'GREAT_FAILURE'].includes(row.outcome)));
    } else if (summary.stage === STAGES[2]) {
      assert.equal(final.status, 'ACTIVE'); assert.equal(encounter.status, 'FIGHTING'); assert.equal(encounter.terminal, null); assert(final.combat);
      assert.equal(summary.rounds.length, summary.strategy.combatRoundCap); assert(summary.rounds.every(row => row.stance === 'CONTROL'));
    } else {
      assert.equal(final.status, 'DEAD'); assert.equal(final.health, 0); assert.equal(checks.at(-1).status, 'DEAD');
      assert.equal(checks.filter(row => row.status === 'DEAD').length, 1, 'A real death is the final and only terminal new transition');
      // A later ordinary death can retain an earlier living encounter result.
      if (encounter.terminal?.outcome === 'PLAYER_DEAD') { assert.equal(encounter.terminal.exitMetres, 0); assert.equal(encounter.terminal.exitSeconds, 0); }
    }
    const preservedTerminalReplays = verifyPreservedDeaths(runtime, outputDir, migrate, hash, original);
    for (const [path, evidence] of immutable) assert.deepEqual(fileEvidence(path), evidence, `Source bytes remain immutable: ${path}`);
    assert.deepEqual(readdirSync(source.root).sort(), expectedMembers);
    const result = { passed: true, stage: summary.stage, sourceDirectory: source.root, outputDir,
      producerSha256: integrity.producerSha256, captureNaturalSha256: integrity.naturalSha256, finalStateSha256: hash(final),
      currentSchemaVersion, currentContentVersion, captureSchemaVersion, captureContentVersion,
      fullNaturalS9ToS1: final.progression.sequence === 1, inheritedDirectedPrefix: false, inheritedDirectedCommands: 0, inheritedNaturalCommands: INHERITED_COUNT, exactSourceCommands: PREFIX_COUNT,
      commands: commands.length, allNamedCaptures: named.length, uniqueTransitions: checks.length, aliases: named.filter(row => row.aliasOf !== null).length,
      actualPlayerDeaths: checks.filter(row => row.status === 'DEAD').length,
      preservedOriginalEvidence: preserved, preservedTerminalReplays, sourceOriginals: originalResources(original), currentOriginals: currentOriginals(final),
      sourcePrefixReplayed: true, sourcePrefixReplayCommands: PREFIX_COUNT, sourceBeforeLastSha256, sourceContinues, actualTreatments,
      actualPotionConsumptions: final.uncleanMonarch.bottles.filter(b => b.status === 'CONSUMED').map(b => ({ id: b.id, outcome: b.outcome })),
      actualNewPublicCommands: [...new Set(commands.slice(PREFIX_COUNT).map(intent => intent.type === 'UNCLEAN_MONARCH' ? `${intent.type}:${intent.command.type}` : intent.type === 'ACTION' ? `${intent.type}:${intent.action}${intent.targetId ? `:${intent.targetId}` : ''}` : intent.type))],
      actualLifeLedgerEntries: life.journal.length, actualEncounterLedgerEntries: encounter.journal.length, actualNewCombatRounds: summary.rounds.length,
      lifeAbilityUse: summary.lifeAbilityUse, combatAbilityUse: summary.combatAbilityUse, named, checks };
    writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, stage: result.stage, allNamedCaptures: result.allNamedCaptures, uniqueTransitions: result.uniqueTransitions,
      aliases: result.aliases, actualPlayerDeaths: result.actualPlayerDeaths, fullNaturalS9ToS1: result.fullNaturalS9ToS1, preservedOriginalEvidence: preserved.length, outputDir }));
    return result;
  } catch (error) {
    writeFileSync(join(outputDir, 'failure.json'), JSON.stringify({ passed: false, failedBoundary: current, uniqueVerified: checks.length, error: String(error), named, checks }, null, 2), { flag: 'wx' });
    throw error;
  } finally { ledger.return?.(); publicRows.return?.(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (!args.includes('--source-directory')) args.push('--source-directory', 'tests/fixtures/unclean-monarch-v02020');
    if (!args.includes('--output-directory')) args.push('--output-directory', 'output/qa-0202/sqlite');
    const options = parseArguments(args);
    if (options.help) console.log('Usage: node --expose-gc scripts/play/unclean-monarch-save.mjs --expected-boundaries N [--source-directory DIR] [--output-directory DIR] [--tag NAME]\nN is the actual observed named capture count. Checks every unique transaction and alias while preserving the exact living718 source, complete724 and older592 deaths, and all eight original roots.');
    else await verifyUncleanMonarchBoundaries(options);
  } catch (error) { console.error(error); process.exitCode = 1; }
}

// Bounded reader copied from the existing stage/save tooling. Never parse a
// whole natural/boundary document merely to retrieve one large state entry.
function readObjectEntry(path, wanted) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START', key = '', selected = false, quoted = false, escaped = false, depth = 0, kind = 'PRIMITIVE';
  const pieces = [];
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null), text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let captureStart = selected && phase === 'VALUE' ? 0 : -1;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (phase === 'START') { if (/\s/.test(c)) continue; if (c !== '{') throw new Error('Expected top-level JSON object'); phase = 'KEY'; continue; }
        if (phase === 'KEY' || phase === 'AFTER') {
          if (/\s/.test(c) || c === ',') continue;
          if (c === '}') throw new Error(`Missing JSON entry: ${wanted}`);
          if (c !== '"') throw new Error('Expected JSON property name');
          key = '"'; escaped = false; phase = 'KEY_STRING'; continue;
        }
        if (phase === 'KEY_STRING') {
          key += c;
          if (escaped) escaped = false; else if (c === '\\') escaped = true;
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
            if (escaped) escaped = false; else if (c === '\\') escaped = true;
            else if (c === '"') { quoted = false; if (kind === 'STRING' && depth === 0) done = true; }
          } else if (c === '"') quoted = true;
          else if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') { if (depth > 0) { depth--; if (depth === 0) done = true; } else { done = true; end = i; } }
          else if (kind === 'PRIMITIVE' && (c === ',' || /\s/.test(c))) { done = true; end = i; }
          if (done) { if (selected) { pieces.push(text.slice(captureStart, end)); return JSON.parse(pieces.join('')); } phase = 'AFTER'; selected = false; captureStart = -1; }
        }
      }
      if (captureStart >= 0) pieces.push(text.slice(captureStart));
      if (!n) break;
    }
  } finally { closeSync(fd); }
  throw new Error(`Missing JSON entry: ${wanted}`);
}

function* readJsonLines(path) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let pending = '';
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null); pending += n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let end;
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end); pending = pending.slice(end + 1); assert(line.length > 0, `Blank ledger row: ${path}`); yield JSON.parse(line);
      }
      if (!n) { assert.equal(pending, '', `Ledger must end in a complete newline: ${path}`); break; }
    }
  } finally { closeSync(fd); }
}
