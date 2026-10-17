import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  SOURCE, SOURCE_SHA, PREDECESSOR, PREDECESSOR_SHA, ORIGINAL_DEATH, ORIGINAL_DEATH_SHA, DEATH_COUNT, COMMON_COUNT, INHERITED_SHA, PREFIX_SHA, PREFIX_COUNT, INHERITED_COUNT, SEED, CASES, ROOTS, NEW_IDS, STRATEGY, STAGES,
  json, fileEvidence, fileHash, compactHash, stateHash, stable, inspectFreeze, loadRuntime, migrateCurrent, readSource,
  originalResources, currentResources, currentSite, currentPlate, body, compact, checkOriginals, publicControl,
  lifeAbilityUse, combatAbilityUse, boundaryAliases, readObjectEntry, readJsonLines, assertSafeOutput,
} from './hand-of-order-stage.mjs';

// Run only after freezing, compiling
// and producing actual natural evidence. Derive names/count from the actual
// boundary index; no predeclared successes or fabricated missing boundaries.
// Every unique transition is checked. Aliases are accounted for separately.
// --resume-directory continues the one atomic completed.index.json, bound to
// these exact capture/source/freeze/script hashes. No ranges, omissions or
// reordered transactions. An interrupted/unrecorded transaction is retried.
// Only freshly allocated verification DBs may be reset. Never open a player DB.
const METADATA = ['natural.json', 'commands.jsonl', 'public.jsonl', 'summary.json', 'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', 'source-prefix.json', 'original-death-source.json'];
const CHECKS = ['after-apply-rollback-no-receipt', 'rows-backups-timestamps-selection-unchanged', 'reopen-before-no-receipt', 'public-private-equality', 'reopen-after', 'same-intent-idempotent', 'stale-revision-no-mutation', 'reopen-after-stale'];
const assertLiveBefore = (before, intent) => assert(before.status === 'ACTIVE' || before.status === 'SLICE_COMPLETE' && intent.type === 'CONTINUE_LIFE', 'Only a real living SLICE_COMPLETE may use CONTINUE_LIFE; a DEAD run stays sealed');

function storedRows(database) {
  const db = new DatabaseSync(database, { readOnly: true });
  try { return {
    runs: db.prepare('SELECT id,current_json,backup_json,terminal,updated_at FROM slice_runs ORDER BY id').all(),
    receipts: db.prepare('SELECT id,fingerprint,receipt_json FROM slice_receipts ORDER BY id').all(),
    meta: db.prepare('SELECT key,value FROM slice_meta ORDER BY key').all(),
  }; } finally { db.close(); }
}
function checkSqlite(runtime, database, before, intent, after, intentId) {
  assertLiveBefore(before, intent);
  for (const name of readdirSync(dirname(database)).filter(name => name.startsWith(basename(database)))) {
    const path = join(dirname(database), name); assert.equal(realpathSync(path), path, 'A verification DB or its recovery sidecar cannot be an external symlink');
  }
  if (existsSync(database)) {
    assert(!existsSync(`${database}.sealed`), 'Never reset a sealed verification database');
    const db = new DatabaseSync(database);
    try { db.exec('BEGIN IMMEDIATE; DELETE FROM slice_receipts; DELETE FROM slice_runs; DELETE FROM slice_meta; COMMIT;'); }
    finally { db.close(); }
  }
  let app, inject = false, injectedAfterApply = 0;
  const envelope = { intentId, runId: before.runId, expectedRevision: before.revision, payload: intent }, expectedPublic = runtime.projectSliceState(after);
  try {
    app = new runtime.SqliteSliceStore(database, { beforeWrite: () => {
      if (!inject) return;
      assert.deepEqual(app.repository.get(after.runId).state, after, 'Inject only after complete actual application');
      const row = app.repository.receipt(intentId); assert(row);
      assert.equal(row.fingerprint, stable(envelope)); assert.deepEqual(row.receipt.state, expectedPublic); assert.equal(app.repository.activeRun(), before.runId);
      injectedAfterApply++; throw Error('injected write failure after actual apply, receipt and run selection');
    } });
    app.repository.transaction(() => { app.repository.put({ state: before, updatedAt: '2026-10-16T00:00:00.000Z' }); app.repository.selectRun(before.runId); });
    const beforeRows = storedRows(database); inject = true;
    const rejected = app.submitIntent(envelope);
    assert.equal(rejected.ok, false); assert.equal(rejected.error.code, 'SAVE_FAILED', JSON.stringify(rejected)); assert.equal(injectedAfterApply, 1);
    assert.deepEqual(app.repository.get(before.runId).state, before); assert.equal(app.repository.receipt(intentId), null);
    assert.deepEqual(storedRows(database), beforeRows); assert.equal(existsSync(`${database}.sealed`), false, 'Rolled-back death cannot leave a sealed marker');
    app.close(); app = undefined; app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(storedRows(database), beforeRows); assert.deepEqual(app.repository.get(before.runId).state, before);
    assert.equal(app.repository.receipt(intentId), null); assert.equal(app.repository.activeRun(), before.runId);
    const committed = app.submitIntent(envelope); assert.equal(committed.ok, true, JSON.stringify(committed)); assert.equal(committed.value.replayed, false);
    assert.deepEqual(committed.value.state, expectedPublic); assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(app.repository.receipt(intentId).receipt, committed.value);
    const committedRows = storedRows(database); assert.equal(committedRows.runs.length, 1); assert.equal(committedRows.receipts.length, 1);
    app.close(); app = undefined; app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(storedRows(database), committedRows); assert.deepEqual(app.repository.get(after.runId).state, after); assert.equal(app.repository.activeRun(), after.runId);
    assert.deepEqual(runtime.projectSliceState(app.repository.get(after.runId).state), expectedPublic);
    const replay = app.submitIntent(envelope); assert.equal(replay.ok, true, JSON.stringify(replay)); assert.deepEqual(replay.value, { ...committed.value, replayed: true });
    assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(storedRows(database), committedRows);
    const staleId = `${intentId}:stale`, stale = app.submitIntent({ ...envelope, intentId: staleId });
    assert.equal(stale.ok, false); assert.equal(stale.error.code, 'REVISION_CONFLICT', JSON.stringify(stale)); assert.equal(app.repository.receipt(staleId), null);
    assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(storedRows(database), committedRows);
    if (after.status === 'DEAD') {
      assert.deepEqual(json(`${database}.sealed`), [after.runId]); assert.equal(expectedPublic.canAct, false);
      const blockedPayloads = [{ type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' }, { type: 'HAND_OF_ORDER', command: { type: 'OBSERVE', caseId: CASES[0] } }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }];
      for (const payload of blockedPayloads) {
        const id = `${intentId}:sealed:${payload.type}`, blocked = app.submitIntent({ intentId: id, runId: after.runId, expectedRevision: after.revision, payload });
        assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED', JSON.stringify(blocked)); assert.equal(app.repository.receipt(id), null);
        assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(storedRows(database), committedRows); assert.deepEqual(json(`${database}.sealed`), [after.runId]);
      }
    } else assert.equal(existsSync(`${database}.sealed`), false, 'A living completed slice or an opponent terminal outcome must not seal the player');
    app.close(); app = undefined; app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(storedRows(database), committedRows); assert.deepEqual(app.repository.get(after.runId).state, after); assert.equal(app.repository.receipt(staleId), null);
  } finally { app?.close(); }
}
function safeInput(root, filename) {
  assert.equal(filename, basename(filename)); assert(filename.endsWith('.json') || filename.endsWith('.jsonl')); assert(!isAbsolute(filename));
  const path = join(root, filename); assert.equal(realpathSync(path), path, 'No external capture symlink');
  const inside = relative(root, path); assert(inside && inside !== '..' && !inside.startsWith(`..${sep}`)); return path;
}
function checkWeeklySettlement(runtime, before, after, paidBudget, finance) {
  assert.deepEqual(finance, runtime.handOfOrderFinanceSnapshot(before));
  const locked = runtime.hasHandOfOrderLock(after) || after.combat !== null;
  if (paidBudget.actions > 0 || locked || after.status !== 'ACTIVE') {
    assert.equal(after.cash, paidBudget.cash); assert.equal(after.actionsRemaining, paidBudget.actions);
    assert.equal(after.week, before.week); assert.deepEqual(runtime.handOfOrderFinanceSnapshot(after), finance); return;
  }
  assert.equal(paidBudget.actions, 0);
  const result = runtime.resolveSliceWeeklyFinance({ ...finance, cash: paidBudget.cash, week: before.week, revision: before.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE';
  assert.equal(after.cash, result.state.cash); assert.equal(after.actionsRemaining, advanced ? before.weeklyBudget : 0);
  assert.equal(after.week, before.week + (advanced ? 1 : 0)); assert.deepEqual(after.date, advanced ? runtime.addGameWeeks(before.date, 1) : before.date);
  assert.equal(after.pulse, advanced ? 'NONE' : result.state.pulse); assert.equal(after.billAmount, advanced ? 0 : result.state.billAmount);
  assert.deepEqual(runtime.handOfOrderFinanceSnapshot(after), runtime.handOfOrderFinanceSnapshot({ ...finance, ...result.state, weeklyBudget: before.weeklyBudget, lifeTier: advanced ? result.state.nextLifeTier : before.lifeTier }));
  if (result.eventId) assert.equal(after.activeEvent?.id, result.eventId);
  const expected = result.receipts.map(r => ({ week: before.week, ...r }));
  if (advanced) expected.push({ week: before.week + 1, title: '新的一周', text: `日期推进7天，本周${before.weeklyBudget}次行动。` });
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const actual = after.chronicle.filter((row, i) => row.id === `record-${after.revision}-${i}` && titles.includes(row.title));
  assert.deepEqual(actual.map(({ week, title, text }) => ({ week, title, text })), expected);
}
function checkActualCosts(runtime, before, intent, after) {
  if (intent.type === 'ACTION') {
    if (intent.action === 'INVESTIGATE') { assert.equal(intent.targetId, 'CARE-ACCESS-01'); assert.equal(before.careKnown, false); assert.equal(after.careKnown, true); assert.equal(after.health, before.health); assert.deepEqual(after.injuries, before.injuries); return; }
    const originalRecovery = !before.handOfOrder.guidanceKnown && (before.injuries.length > 0 || before.health < 100);
    assert.equal(intent.action, originalRecovery || before.wagePaidWeek === before.week ? 'REST' : 'WORK', 'Source injury care uses real rest; subsequent readiness works once per week, then rests'); return;
  }
  if (intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01') {
    assert.equal(intent.choiceId, 'PAY'); assert(after.cash <= before.cash - 60); assert.equal(after.health, before.health); assert.equal(after.injuryRisk, before.injuryRisk);
    for (const injury of before.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)) { const same = after.injuries.find(i => i.id === injury.id); assert(same); assert.equal(same.acquiredRevision, injury.acquiredRevision); assert.equal(same.treatedRevision, before.revision + 1); } return;
  }
  if (intent.type !== 'HAND_OF_ORDER') return;
  const c = intent.command, state = after.handOfOrder;
  const acquisition = state.acquisitionJournal.length > before.handOfOrder.acquisitionJournal.length ? state.acquisitionJournal.at(-1) : null;
  const life = state.life.journal.length > before.handOfOrder.life.journal.length ? state.life.journal.at(-1) : null;
  if (acquisition) {
    assert.deepEqual(acquisition.command, c); assert.deepEqual(acquisition.before, runtime.handOfOrderAcquisitionBudget(before));
    const fee = c.type === 'LEARN_GUIDANCE' ? 500 : c.type === 'BUY_POTION' ? 1200 : c.type === 'PREPARE_PROMOTION' ? 180 : c.type === 'REQUEST_SUPPLY' ? 100 : 0;
    const ap = ['LEARN_GUIDANCE', 'PREPARE_TASK', 'POTION_WORK', 'PREPARE_PROMOTION', 'REQUEST_SUPPLY'].includes(c.type) ? 1 : 0;
    assert.equal(acquisition.after.cash, acquisition.before.cash - fee); assert.equal(acquisition.after.actions, acquisition.before.actions - ap);
    checkWeeklySettlement(runtime, before, after, acquisition.after, acquisition.finance);
    if (c.type === 'POTION_WORK') { const old = before.handOfOrder.bottles.find(b => b.id === c.bottleId), now = state.bottles.find(b => b.id === c.bottleId); assert.equal(now.labourSteps, old.labourSteps + 1); }
    if (c.type === 'BUY_POTION') assert.equal(state.bottles.find(b => b.id === c.bottleId).labourSteps, 5);
    if (c.type === 'PREPARE_PROMOTION' || c.type === 'CONSUME') assert(before.week - before.balancer.promotionWeek >= 12, 'Wait from actual Balancer W126, never original Arbiter W9');
    if (c.type === 'CONSUME') {
      assert.equal(before.handOfOrder.preparedWeek, before.week); assert.equal(after.random.cursor, before.random.cursor + 1); assert.equal(state.preparedWeek, null);
      const b = state.bottles.find(b => b.id === c.bottleId); assert.equal(b.status, 'CONSUMED'); assert.equal(b.preparationWeek, b.consumedWeek);
      assert.deepEqual(currentResources(after), currentResources(before)); assert.deepEqual(after.injuries, before.injuries);
      if (after.progression.sequence === 1) { assert.equal(after.health, before.health); assert.equal(after.spirituality, before.spirituality); assert.deepEqual(after.progression.mastery, { ...before.progression.mastery, ...Object.fromEntries(NEW_IDS.map(id => [id, 0])) }); }
    }
    if (c.type === 'REQUEST_SUPPLY') assert(before.handOfOrder.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome)));
    if (c.type === 'RECEIVE_SUPPLY') { assert(before.week > before.handOfOrder.resupply.requestedWeek); assert.equal(state.bottles.length, before.handOfOrder.bottles.length + 3); assert.deepEqual(state.bottles.slice(0, -3), before.handOfOrder.bottles); }
  }
  if (life) {
    assert.deepEqual(life.command, c); assert.equal(life.before.cash, before.cash); assert.equal(life.before.actions, before.actionsRemaining);
    assert.equal(life.after.cash, life.before.cash - life.paid.pennies); assert.equal(life.after.actions, life.before.actions - life.paid.actions);
    assert.equal(life.after.spirituality, life.before.spirituality - life.paid.spirituality); assert.equal(life.after.mind, life.before.mind - life.paid.mind); assert.equal(life.after.health, life.before.health - life.paid.health);
    assert.deepEqual(life.plateBefore, currentPlate(before)); assert.deepEqual(life.plateAfter, currentPlate(after)); assert.equal(life.clockBefore, currentSite(before).clockSeconds); assert.equal(life.clockAfter, currentSite(after).clockSeconds);
    assert.deepEqual(currentSite(after).table, currentSite(before).table); assert.equal(currentSite(after).paper.text, currentSite(before).paper.text);
    checkWeeklySettlement(runtime, before, after, life.after, runtime.handOfOrderFinanceSnapshot(before));
    if (c.type === 'EXIT_ORIGINAL') { assert.equal(life.paid.actions, 0); assert.equal(life.clockAfter - life.clockBefore, 4); assert.equal(currentSite(before).playerLocation, 'START'); assert.equal(currentSite(after).playerLocation, 'OUTSIDE'); assert.equal(currentSite(after).playerTravelMetres - currentSite(before).playerTravelMetres, 4); }
    if (c.type === 'RENT_ANNEX') { assert.equal(life.paid.pennies, 40); assert.equal(life.paid.actions, 1); assert.equal(state.life.annex.id, 'HO1-NEIGHBOR-ANNEX'); assert.equal(state.life.annex.supportPieces, 3); assert.equal(state.life.annex.placementConsent, 'GRANTED'); assert(currentSite(after).playerTravelMetres > currentSite(before).playerTravelMetres); }
    if (c.type === 'PREPARE') { assert.equal(c.method, 'ABILITY'); assert.equal(life.paid.pennies, 0); assert.equal(life.paid.actions, 1); }
    if (c.type === 'SETUP_OBJECTS') { assert.equal(state.life.annex.effortSpent, before.handOfOrder.life.annex.effortSpent + 3); assert.equal(currentSite(after).volunteer.mind, currentSite(before).volunteer.mind - 1); }
    if (['BATTLEFIELD_DIVISION', 'AFTERMATH_CONTROL'].includes(c.type)) {
      assert.equal(life.paid.spirituality, 8); assert.equal(life.paid.mind, ['FAILURE', 'GREAT_FAILURE'].includes(life.tier) ? 4 : 2); assert.equal(life.paid.actions, 1);
      assert.equal(after.random.cursor, before.random.cursor + 1); assert.equal(state.life.annex.supportPieces, before.handOfOrder.life.annex.supportPieces - 1);
      assert.deepEqual(after.progression.mastery, before.progression.mastery, 'Casting alone grants no mastery');
      const ability = c.type === 'BATTLEFIELD_DIVISION' ? 'division' : 'aftermath', effect = state.life.operation[ability];
      if (effect) { assert.equal(effect.expiresAt - effect.createdAt, 20); assert.equal(effect.remainingUses, 1); assert.equal(effect.pendingId, state.life.operation.pending.id); }
    }
    if (['APPLY_IMPACT', 'ORDINARY_BRACE', 'CANCEL_IMPULSE'].includes(c.type)) {
      const impact = state.life.cases[c.caseId].attempts[0].impact; assert(impact); assert.equal(impact.plateId, 'BA2-GUARD-PLATE'); assert.equal(impact.baseHealthLoss, 5);
      assert.equal(after.health, before.health - impact.healthLoss); assert.equal(currentPlate(after).integrity, currentPlate(before).integrity - impact.plateWear);
      assert.equal(impact.healthLoss, c.type === 'CANCEL_IMPULSE' ? 0 : c.type === 'ORDINARY_BRACE' || impact.aftermathApplied ? 2 : 5); assert.equal(impact.plateWear, c.type === 'CANCEL_IMPULSE' ? 0 : 15);
    }
    if (c.type === 'WITHDRAW_PERMISSION') { assert.equal(state.life.operation.division, null); assert.equal(state.life.operation.aftermath, null); assert.equal(state.life.operation.pending.status, 'PENDING'); assert.deepEqual(after.progression.mastery, before.progression.mastery); }
  }
  if (c.type === 'PREPARE_ENCOUNTER') {
    const p = state.encounter.preparation; assert.equal(p.pricePaid, 30); assert.equal(p.actionsPaid, 0); assert.equal(p.mindPaid, 2);
    assert.equal(p.after.cash, p.before.cash - 30); assert.equal(p.after.actions, p.before.actions); assert.equal(p.after.mind, p.before.mind - 2);
    assert.equal(state.encounter.supportPieces.length, 3); assert(state.encounter.supportPieces.every(p => p.status === 'HELD' && p.wear === 0)); assert.deepEqual(p.guardPlate, currentPlate(before));
    checkWeeklySettlement(runtime, before, after, p.after, p.finance);
  }
}

function verifyCompletion(summary, s, checks) {
  const l = s.handOfOrder.life, e = s.handOfOrder.encounter;
  assert(s.handOfOrder.bottles.filter(b => b.status === 'CONSUMED').length <= STRATEGY.potionAttemptCap);
  for (const id of CASES) { assert(l.cases[id].attempts.length <= 1, 'No retry to select a favorable result'); assert(l.journal.filter(r => ['BATTLEFIELD_DIVISION', 'AFTERMATH_CONTROL'].includes(r.command.type) && r.command.caseId === id).length <= 1); }
  for (const round of summary.rounds) { assert.equal(round.stance, 'CONTROL'); assert.equal(round.handOfOrderOutcome.source.policy, 'ALL'); assert.equal(round.handOfOrderOutcome.source.targetId, 'HO1-BRAM'); }
  assert(e.journal.filter(row => row.command.type === 'ENCOUNTER_FIGHT').length <= 1, 'One new optional Bram encounter; old opponents remain frozen');
  assert.equal(summary.treatments.length, 1, 'The H60 source requires exactly one real paid heavy-wound treatment before the new work');
  if (summary.stage === STAGES[0]) {
    assert.equal(s.status, 'ACTIVE'); assert.equal(s.progression.sequence, 1); assert.equal(s.progression.acting, 100);
    assert.equal(l.reflected, true); assert.equal(l.activeCase, null); assert.equal(l.operation.pending, null); assert.equal(l.operation.division, null); assert.equal(l.operation.aftermath, null); assert.equal(l.annex.effortSpent, 9);
    assert.equal(CASES.flatMap(id => l.cases[id].attempts).reduce((n, a) => n + a.volunteerMindSpent, 0), 3);
    for (const id of CASES) { const r = l.cases[id], a = r.attempts[0]; assert.equal(r.status, 'RESOLVED'); assert.equal(r.attempts.length, 1); assert(a.closed && a.inspected && a.objectsReturned && a.resultRead && a.objectRetrieved); }
    assert.equal(l.annex.placementConsent, 'GRANTED'); assert(l.annex.paidWeek !== null); assert.equal(l.journal.filter(e => e.command.type === 'RENT_ANNEX').length, 1);
    const withdrawn = l.cases['withdrawn-boundary'].attempts[0]; assert.equal(withdrawn.permissionWithdrawn, true); assert.equal(withdrawn.result, 'ORDINARY'); assert.equal(withdrawn.appliedAbilityIds.length, 0);
    assert.equal(s.combat, null); assert(e.terminal); assert.notEqual(e.terminal.outcome, 'PLAYER_DEAD'); assert.equal(e.terminal.exitMetres, 4); assert.equal(e.terminal.exitSeconds, 4);
    assert.equal(currentSite(s).playerLocation, 'OUTSIDE'); assert.equal(currentSite(s).guide.location, 'OUTSIDE'); assert.equal(currentSite(s).volunteer.location, 'OUTSIDE');
    for (const object of [currentSite(s).parcel, currentSite(s).line, currentSite(s).paper]) { assert.equal(object.holder, 'GUIDE'); assert.equal(object.location, 'OUTSIDE'); }
    assert(summary.boundaries.includes('actual-ordinary-encounter-exit'));
  } else if (summary.stage === STAGES[1]) {
    assert.equal(s.status, 'ACTIVE'); assert.equal(s.progression.sequence, 2); assert.equal(summary.rounds.length, 0);
    const consumed = s.handOfOrder.bottles.filter(b => b.status === 'CONSUMED'); assert.equal(consumed.length, STRATEGY.potionAttemptCap); assert(consumed.every(b => ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome)));
  } else if (summary.stage === STAGES[2]) {
    assert.equal(s.status, 'ACTIVE'); assert.equal(e.status, 'FIGHTING'); assert.equal(e.terminal, null); assert(s.combat); assert.equal(summary.rounds.length, STRATEGY.combatRoundCap);
  } else {
    assert.equal(summary.stage, STAGES[3]); assert.equal(s.status, 'DEAD'); assert.equal(s.health, 0); assert.equal(checks.at(-1).status, 'DEAD'); assert.equal(checks.filter(c => c.status === 'DEAD').length, 1);
    if (e.terminal?.outcome === 'PLAYER_DEAD') { assert.equal(e.terminal.exitMetres, 0); assert.equal(e.terminal.exitSeconds, 0); assert.equal(currentSite(s).playerLocation, 'ANNEX_A'); }
  }
}
// Capture, producer and mechanics bytes remain immutable. The sole reviewed
// UI revision keeps HAND_OF_ORDER in the drawer; this verifier is its only other
// changed frozen file. The proof binds both exact byte changes and the full runtime.
const CAPTURE_FREEZE = '82595e0577e1408fe3343da02116e90f99f4ac129af355b3ad57947655dc8b90';
const UI_REVISION_FILES = ['src/renderer/SliceApp.tsx', 'scripts/play/hand-of-order-save.mjs'];
export function assertHandOfOrderFreezeCompatibility(captured, runtime, revision = null) {
  assert.equal(compactHash(captured.files), captured.sha256, 'Capture freeze list/hash mismatch');
  assert.equal(compactHash(runtime.files), runtime.sha256, 'Runtime freeze list/hash mismatch');
  assert.deepEqual(runtime.files.map(f => f.file), captured.files.map(f => f.file), 'Frozen file set changed');
  const changes = captured.files.flatMap((before, i) => stable(before) === stable(runtime.files[i]) ? [] : [{ before, after: runtime.files[i] }]);
  if (changes.length || revision !== null) {
    assert(revision && revision.kind === 'HAND_OF_ORDER206_REVIEWED_UI_DRAWER_REVISION', 'Unreviewed runtime change');
    assert.equal(revision.captureFreezeSha256, captured.sha256, 'Original capture hash changed');
    assert.equal(revision.runtimeFreezeSha256, runtime.sha256, 'Reviewed runtime hash changed');
    assert.deepEqual(revision.changes, changes, 'Reviewed UI/verifier file bytes changed');
  }
  if (changes.length) assert.deepEqual(changes.map(row => row.before.file).sort(), [...UI_REVISION_FILES].sort(), 'Only the exact reviewed drawer and verifier changes are permitted');
  return { captureFreezeSha256: captured.sha256, runtimeFreezeSha256: runtime.sha256, changedFiles: changes.map(row => row.before.file) };
}
export function assertHandOfOrderInputEvidence(actual, expected, path) { assert.deepEqual(actual, expected, `Changed immutable input: ${path}`); }
export function assertHandOfOrderResumeManifest(stored, current) { assert.deepEqual(stored, current, 'Resume requires identical full capture, runtime, source, prefix, and verifier bytes'); }

export async function verifyHandOfOrderBoundaries(options) {
  const root = realpathSync(options.sourceDirectory), integrity = json(join(root, 'capture-integrity.json')), summary = json(join(root, 'summary.json'));
  assert(STAGES.includes(summary.stage), 'An ACTUAL_BLOCKER remains failure evidence, never verified completion');
  const frozen = inspectFreeze(), capturedFreeze = { sha256: integrity.freezeSha256, files: integrity.frozenFiles };
  assert.equal(capturedFreeze.sha256, CAPTURE_FREEZE, 'Original capture freeze changed');
  const revisionPath = fileURLToPath(new URL('./hand-of-order-ui-revision.json', import.meta.url));
  const revision = existsSync(revisionPath) ? json(revisionPath) : null;
  const compatibility = assertHandOfOrderFreezeCompatibility(capturedFreeze, frozen, revision);
  if (options.freezeSha256) assert.equal(options.freezeSha256, frozen.sha256);
  assert.equal(summary.freezeSha256, capturedFreeze.sha256); assert.equal(fileHash(fileURLToPath(new URL('./hand-of-order-stage.mjs', import.meta.url))), integrity.producerSha256); assert.equal(summary.producerSha256, integrity.producerSha256);
  const immutable = new Map(), pin = (path, expected) => { const result = fileEvidence(path); if (expected) assertHandOfOrderInputEvidence(result, expected, path); immutable.set(path, result); return result; };
  if (revision !== null) { assert.equal(realpathSync(revisionPath), revisionPath, 'No external UI-revision symlink'); pin(revisionPath); }
  pin(SOURCE); assert.equal(immutable.get(SOURCE).sha256, SOURCE_SHA); pin(PREDECESSOR); assert.equal(immutable.get(PREDECESSOR).sha256, PREDECESSOR_SHA); pin(ORIGINAL_DEATH); assert.equal(immutable.get(ORIGINAL_DEATH).sha256, ORIGINAL_DEATH_SHA);
  assert.deepEqual(Object.keys(integrity.metadata), METADATA); for (const name of METADATA) pin(safeInput(root, name), integrity.metadata[name]); pin(safeInput(root, 'capture-integrity.json'));
  const index = json(join(root, 'boundaries.index.json')), steps = json(join(root, 'boundaries.steps.json')), transitions = json(join(root, 'transitions.json'));
  assert(index && typeof index === 'object' && !Array.isArray(index)); const names = Object.keys(index); assert(names.length > 0);
  if (options.expectedBoundaries !== undefined) assert.equal(names.length, options.expectedBoundaries, 'Supplied count must equal actual observed index count');
  assert.deepEqual(names, summary.boundaries); assert.deepEqual(Object.keys(steps), names); assert(Array.isArray(transitions));
  assert(summary.snapshots && typeof summary.snapshots === 'object' && !Array.isArray(summary.snapshots));
  const files = [...new Set([...Object.values(index), ...Object.values(summary.snapshots)])].sort(); assert.deepEqual(Object.keys(integrity.files).sort(), files);
  for (const name of files) pin(safeInput(root, name), integrity.files[name]);
  const members = [...METADATA, 'capture-integrity.json', ...files].sort(); assert.deepEqual(readdirSync(root).sort(), members, 'No unexplained or missing capture files');
  const old = readSource(), naturalPath = join(root, 'natural.json'), readNatural = key => readObjectEntry(naturalPath, key), commands = readNatural('commands');
  assert.deepEqual(commands.slice(0, PREFIX_COUNT), old.commands); assert.equal(commands.length, summary.commands); assert(commands.length > PREFIX_COUNT && commands.length <= STRATEGY.maxCommands);
  assert.equal(compactHash(commands.slice(0, PREFIX_COUNT)), PREFIX_SHA); assert.deepEqual(readNatural('creation'), old.creation); assert.equal(readNatural('seed'), SEED);
  assert.equal(readNatural('prefixCount'), PREFIX_COUNT); assert.equal(readNatural('inheritedPrefixCount'), INHERITED_COUNT); assert.equal(readNatural('prefixVerified'), true);
  assert.equal(readNatural('stage'), summary.stage); assert.deepEqual(readNatural('strategy'), STRATEGY); assert.deepEqual(summary.strategy, STRATEGY); assert.equal(readNatural('producerSha256'), integrity.producerSha256); assert.equal(readNatural('freezeSha256'), capturedFreeze.sha256);
  assert.equal(readNatural('pendingIntent'), null); assert.equal(readNatural('failurePhase'), 'IDLE');
  if (summary.stage === STAGES[2]) assert.equal(typeof readNatural('error'), 'string'); else assert.equal(readNatural('error'), null);
  assert.deepEqual(readNatural('snapshots'), summary.snapshots); assert.deepEqual(readNatural('treatments'), summary.treatments);
  assert.deepEqual(readNatural('provenance'), { kind: 'EXACT594_PUBLIC_BALANCER_THEN_PUBLIC_HAND_OF_ORDER', prior: old.provenance, source: SOURCE, sourceSha256: SOURCE_SHA, sourceRoot: 'final', inheritedDirectedPrefix: false, fullNaturalS9ToS1: summary.final.sequence === 1, newRandomChanges: false });
  const runtime = await loadRuntime({ sqlite: true }), original = migrateCurrent(runtime, old.final), initial = migrateCurrent(runtime, old.initial), prefix = readNatural('prefixFinal');
  assert.equal(prefix.schemaVersion, 203); assert.equal(prefix.contentVersion, 'hand-of-order-v203'); assert.deepEqual(migrateCurrent(runtime, prefix), original); assert.deepEqual(readNatural('initial'), initial);
  assert.deepEqual(summary.source, { prefixCount: PREFIX_COUNT, prefixVerified: true, sourceSha256: SOURCE_SHA, prefixCompactSha256: PREFIX_SHA, migratedWholeSourceSha256: stateHash(original) });
  const sourcePrefix = join(root, 'source-prefix.json');
  assert.deepEqual(readObjectEntry(sourcePrefix, 'rawInitial'), old.initial); assert.deepEqual(readObjectEntry(sourcePrefix, 'rawFinal'), old.final);
  assert.deepEqual(readObjectEntry(sourcePrefix, 'rawInheritedFinal'), old.prefixFinal); assert.equal(readObjectEntry(sourcePrefix, 'predecessorSource'), PREDECESSOR); assert.equal(readObjectEntry(sourcePrefix, 'predecessorSha256'), PREDECESSOR_SHA); assert.equal(readObjectEntry(sourcePrefix, 'inheritedCount'), INHERITED_COUNT); assert.equal(readObjectEntry(sourcePrefix, 'inheritedCommandsSha256'), INHERITED_SHA);
  assert.deepEqual(readObjectEntry(sourcePrefix, 'commands'), old.commands); assert.equal(readObjectEntry(sourcePrefix, 'rawCommandsSha256'), PREFIX_SHA); assert.equal(readObjectEntry(sourcePrefix, 'migratedWholeStateSha256'), stateHash(original));
  assert.equal(readObjectEntry(sourcePrefix, 'source'), SOURCE); assert.equal(readObjectEntry(sourcePrefix, 'sourceSha256'), SOURCE_SHA); assert.equal(readObjectEntry(sourcePrefix, 'sourceRoot'), 'final'); assert.equal(readObjectEntry(sourcePrefix, 'prefixCount'), PREFIX_COUNT); assert.equal(readObjectEntry(sourcePrefix, 'inheritedDirectedPrefix'), false);
  assert.deepEqual(json(join(root, 'original-death-source.json')), { source: ORIGINAL_DEATH, sourceSha256: ORIGINAL_DEATH_SHA, commonPrefixCount: COMMON_COUNT, commands: old.death.commands, creation: old.death.creation, seed: old.death.seed, rawInitial: old.death.initial, rawFinal: old.death.final });
  assert.deepEqual(summary.originalMastery, original.progression.mastery); assert.deepEqual(summary.sourceOriginals, originalResources(original));
  assert.equal(transitions.length, commands.length - PREFIX_COUNT + 1); assert.equal(summary.uniqueTransitions, transitions.length);
  const byStep = new Map(), primaryFiles = new Set();
  for (const [i, t] of transitions.entries()) {
    assert.deepEqual(Object.keys(t).sort(), ['key', 'file', 'commandIndex', 'beforeRevision', 'afterRevision'].sort()); const step = PREFIX_COUNT + i;
    assert.equal(t.commandIndex, step); assert.equal(t.beforeRevision, initial.revision + step - 1); assert.equal(t.afterRevision, initial.revision + step);
    assert.equal(index[t.key], t.file); assert.equal(steps[t.key], step); assert(!primaryFiles.has(t.file)); primaryFiles.add(t.file); byStep.set(step, t);
  }
  assert.equal(transitions[0].key, 'exact-original594-living-source');
  const named = names.map(name => { const t = byStep.get(steps[name]); assert(t); assert.equal(index[name], t.file); return { name, source: index[name], step: steps[name], aliasOf: name === t.key ? null : t.key, sourceSha256: integrity.files[index[name]].sha256 }; });
  const snapshotEvidence = Object.fromEntries(Object.entries(summary.snapshots).map(([name, file]) => {
    const raw = json(join(root, file)); assert.equal(raw.schemaVersion, 203); assert.equal(raw.contentVersion, 'hand-of-order-v203');
    const state = migrateCurrent(runtime, raw), step = state.revision - initial.revision; assert(byStep.has(step)); checkOriginals(runtime, state, original); return [name, { step, sha256: stateHash(state) }];
  }));
  assert.deepEqual(json(join(root, summary.snapshots.departure)), original);

  if (options.preflight) {
    assert(!options.resumeDirectory, 'Preflight does not open a verification directory');
    for (const [path, evidence] of immutable) assert.deepEqual(fileEvidence(path), evidence); assert.deepEqual(inspectFreeze(), frozen);
    const result = { preflightPassed: true, sourceDirectory: root, stage: summary.stage, freezeSha256: frozen.sha256, ...compatibility, sourceSha256: SOURCE_SHA,
      namedBoundaries: names.length, uniqueTransitions: transitions.length, sourceCommands: PREFIX_COUNT, currentSchemaVersion: 203,
      immutableFilesChecked: immutable.size, fullCommandReplay: false, sqliteRun: false, outputWritten: false };
    console.log(JSON.stringify(result)); return result;
  }

  const outputRoot = realpathSync(assertSafeOutput(options.outputDirectory, [root, 'tests/fixtures', 'scripts/play']));
  const outputDir = options.resumeDirectory ? realpathSync(options.resumeDirectory) : mkdtempSync(join(outputRoot, `boundaries-${options.tag}-`));
  if (options.resumeDirectory) {
    assert.equal(dirname(outputDir), outputRoot, 'Resume only a direct, previously allocated child of the configured verification output root');
    assert(/^boundaries-[A-Za-z0-9_-]+-[A-Za-z0-9]{6}$/.test(basename(outputDir)), 'Not a generated HandOfOrder verification directory');
  }
  const manifest = { kind: 'HAND_OF_ORDER_206_SQLITE_VERIFICATION', sourceDirectory: root, outputDirectory: outputDir, sourceSha256: SOURCE_SHA,
    naturalSha256: integrity.metadata['natural.json'].sha256, boundaryIndexSha256: integrity.metadata['boundaries.index.json'].sha256,
    boundaryStepsSha256: integrity.metadata['boundaries.steps.json'].sha256, transitionsSha256: integrity.metadata['transitions.json'].sha256,
    freezeSha256: frozen.sha256, ...compatibility, originalDeathSourceSha256: ORIGINAL_DEATH_SHA, fullInputEvidenceSha256: compactHash([...immutable]), sourcePrefixSha256: integrity.metadata['source-prefix.json'].sha256, predecessorSha256: PREDECESSOR_SHA, inheritedCommandsSha256: INHERITED_SHA, producerSha256: integrity.producerSha256, verifierSha256: fileHash(fileURLToPath(import.meta.url)),
    stage: summary.stage, namedBoundaries: names.length, uniqueTransitions: transitions.length };
  const manifestPath = join(outputDir, 'verification-manifest.json'), completedPath = join(outputDir, 'completed.index.json');
  const checkpoint = options.resumeDirectory ? json(completedPath) : { manifestSha256: compactHash(manifest), sourceChecks: [], completed: [] };
  if (options.resumeDirectory) {
    for (const path of [manifestPath, completedPath]) assert.equal(realpathSync(path), path, 'No external verification-index symlink');
    assertHandOfOrderResumeManifest(json(manifestPath), manifest);
    assert.deepEqual(Object.keys(checkpoint).sort(), ['manifestSha256', 'sourceChecks', 'completed'].sort()); assert.equal(checkpoint.manifestSha256, compactHash(manifest));
    assert(Array.isArray(checkpoint.sourceChecks) && Array.isArray(checkpoint.completed)); assert(checkpoint.completed.length <= transitions.length);
    for (const [i, row] of checkpoint.completed.entries()) { assert.equal(row.step, transitions[i].commandIndex); assert.equal(row.name, transitions[i].key); assert.equal(row.source, transitions[i].file); }
  } else writeFileSync(manifestPath, JSON.stringify(manifest), { flag: 'wx' });
  const resumedSourceChecks = checkpoint.sourceChecks.length, resumedTransitions = checkpoint.completed.length;
  const writeCheckpoint = () => {
    const next = `${completedPath}.next`; if (existsSync(next)) assert.equal(realpathSync(next), next, 'No external checkpoint temporary-file symlink');
    writeFileSync(next, JSON.stringify(checkpoint)); renameSync(next, completedPath);
  };
  if (!options.resumeDirectory) writeCheckpoint();
  const commonDatabase = join(outputDir, 'verification.sqlite'), ledger = readJsonLines(join(root, 'commands.jsonl')), proofs = readJsonLines(join(root, 'public.jsonl'));
  const checks = [], sourceTerminals = [], sourceContinues = [], actualTreatments = [], expectedNames = [], occupiedNames = new Set();
  let sourceChecksSeen = 0;
  const checkSourceSqlite = (key, result, before, intent, after, database) => {
    const row = { key, ...result }, prior = checkpoint.sourceChecks[sourceChecksSeen++];
    if (prior) assert.deepEqual(prior, row, 'Completed source transaction must equal the freshly replayed real source');
    else { checkSqlite(runtime, database, before, intent, after, `order206:source:${key}`); checkpoint.sourceChecks.push(row); writeCheckpoint(); }
  };
  let state = runtime.createSliceRun(original.runId, old.creation, SEED), current = null, sourceBeforeLastSha256 = null, preservedPredecessorDeath = null;
  assert.deepEqual(state, initial);
  const expectName = (key, step, file) => { let name = key, n = 2; while (occupiedNames.has(name)) name = `${key}-${n++}`; occupiedNames.add(name); expectedNames.push({ name, step, source: file }); };
  try {
    let dead = runtime.createSliceRun(old.death.final.runId, old.death.creation, old.death.seed), deadBefore = null, deadIntent = null;
    assert.deepEqual(dead, migrateCurrent(runtime, old.death.initial));
    for (const [i, intent] of old.death.commands.entries()) {
      assertLiveBefore(dead, intent); assert(runtime.validateSlicePayload(intent)); deadBefore = dead; deadIntent = intent;
      dead = runtime.applySliceIntent(dead, intent); runtime.assertValidSliceState(dead); assert.equal(dead.revision, deadBefore.revision + 1);
      if (i < COMMON_COUNT) assert.deepEqual(intent, commands[i]);
    }
    assert.equal(dead.status, 'DEAD'); assert.equal(dead.health, 0); assert.deepEqual(dead, migrateCurrent(runtime, old.death.final));
    const deathDatabase = join(outputDir, 'preserved-original477-player-death.sqlite');
    preservedPredecessorDeath = { source: ORIGINAL_DEATH, sourceSha256: ORIGINAL_DEATH_SHA, commonPrefixCommands: COMMON_COUNT, exactSourceCommands: DEATH_COUNT, allCommandsReplayedFromCreation: true,
      status: dead.status, revision: dead.revision, finalSha256: stateHash(dead), database: relative(outputDir, deathDatabase) };
    checkSourceSqlite('preserved-original477-player-death', preservedPredecessorDeath, deadBefore, deadIntent, dead, deathDatabase);
    for (const [i, intent] of commands.entries()) {
      const step = i + 1, row = ledger.next(); assert.equal(row.done, false); const log = row.value, before = state;
      assert.equal(log.step, step); assert.deepEqual(log.intent, intent); assert.equal(log.sourcePrefix, step <= PREFIX_COUNT); assert.deepEqual(log.before, body(before));
      assert(runtime.validateSlicePayload(intent)); assertLiveBefore(before, intent);
      let proof = null;
      if (step > PREFIX_COUNT) {
        const next = proofs.next(); assert.equal(next.done, false); proof = next.value;
        assert.equal(proof.step, step); assert.equal(proof.revision, before.revision); assert.deepEqual(proof.command, intent); assert.deepEqual(proof.control, publicControl(runtime, before, intent));
        assert.deepEqual(proof.randomBefore, before.random); assert.deepEqual(proof.before, compact(before)); checkOriginals(runtime, before, original);
      } else assert.equal(log.boundaryKey, null);
      state = runtime.applySliceIntent(before, intent); runtime.assertValidSliceState(state);
      assert.equal(state.revision, before.revision + 1); assert.equal(state.random.seed, SEED); assert(state.random.cursor >= before.random.cursor); assert.deepEqual(log.after, body(state));
      if (step <= PREFIX_COUNT) {
        if (step === INHERITED_COUNT) {
          assert.deepEqual(state, migrateCurrent(runtime, old.prefixFinal), 'The entire original483 paid-recovery predecessor is exact');
          assert.deepEqual(state, migrateCurrent(runtime, old.recovery.final));
        }
        if (intent.type === 'CONTINUE_LIFE') {
          assert.equal(before.status, 'SLICE_COMPLETE'); assert.equal(state.status, 'ACTIVE'); const database = join(outputDir, `source-real-continue-${step}.sqlite`);
          const result = { step, beforeStatus: before.status, afterStatus: state.status, database: relative(outputDir, database), finalSha256: stateHash(state) };
          checkSourceSqlite(`continue-${step}`, result, before, intent, state, database); sourceContinues.push(result);
        }
        for (const rootName of ROOTS) {
          const a = before[rootName]?.encounter, b = state[rootName]?.encounter;
          if (a && b && a.enemyStatus !== b.enemyStatus && ['DEAD', 'SURRENDERED'].includes(b.enemyStatus)) {
            assert.equal(state.status, 'ACTIVE'); assert.deepEqual(b, original[rootName].encounter, 'Original terminal opponent history must stay exact');
            const database = join(outputDir, `source-${rootName}-terminal-${step}.sqlite`);
            const result = { step, root: rootName, targetId: b.targetId ?? null, enemyStatus: b.enemyStatus, enemyHealth: b.enemyHealth, enemyMind: b.enemyMind, enemySpirituality: b.enemySpirituality,
              playerStatus: state.status, database: relative(outputDir, database), finalSha256: stateHash(state) };
            checkSourceSqlite(`${rootName}-terminal-${step}`, result, before, intent, state, database); sourceTerminals.push(result);
          }
        }
      }
      if (step < PREFIX_COUNT) continue;
      if (step === PREFIX_COUNT) { assert.deepEqual(state, original, 'Every594 source command replays to the entire migrated original final'); sourceBeforeLastSha256 = stateHash(before); assert.equal(sourceChecksSeen, checkpoint.sourceChecks.length, 'No missing or extra completed source transactions'); }
      const transition = byStep.get(step); assert(transition); current = transition.key;
      const path = join(root, transition.file); assert.equal(readObjectEntry(path, 'commandCount'), step); assert.deepEqual(readObjectEntry(path, 'lastIntent'), intent);
      const rawBefore = readObjectEntry(path, 'beforeLast'), rawAfter = readObjectEntry(path, 'final');
      for (const raw of [rawBefore, rawAfter]) { assert.equal(raw.schemaVersion, 203); assert.equal(raw.contentVersion, 'hand-of-order-v203'); }
      assert.deepEqual(migrateCurrent(runtime, rawBefore), before, 'Whole-state chain equals deterministic replay'); assert.deepEqual(migrateCurrent(runtime, rawAfter), state, 'Whole captured final equals real command application');
      assert.equal(transition.beforeRevision, before.revision); assert.equal(transition.afterRevision, state.revision);
      if (step > PREFIX_COUNT) {
        assert.equal(transition.key, log.boundaryKey); assert.deepEqual(proof.randomAfter, state.random); assert.deepEqual(proof.after, compact(state));
        checkActualCosts(runtime, before, intent, state);
        if (intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01') actualTreatments.push({ paidPennies: 60, before: body(before), after: body(state) });
        assert(currentSite(state).clockSeconds >= currentSite(before).clockSeconds); assert(currentSite(state).playerTravelMetres >= currentSite(before).playerTravelMetres);
      }
      checkOriginals(runtime, state, original);
      expectName(transition.key, step, transition.file); if (step > PREFIX_COUNT) for (const name of boundaryAliases(before, intent, state)) expectName(name, step, transition.file);
      const finalSha256 = stateHash(state);
      for (const [name, snapshot] of Object.entries(snapshotEvidence)) if (snapshot.step === step) assert.equal(snapshot.sha256, finalSha256, `Snapshot matches actual transition: ${name}`);
      const database = state.status === 'DEAD' ? join(outputDir, `terminal-${step}.sqlite`) : commonDatabase;
      const result = { name: transition.key, source: transition.file, step, sourceSha256: integrity.files[transition.file].sha256, finalSha256, status: state.status, revision: state.revision, database: relative(outputDir, database),
        checks: [...CHECKS, ...(state.status === 'DEAD' ? ['sealed-reopen-no-further-action', 'dead-continue-life-archived'] : state.status === 'SLICE_COMPLETE' ? ['living-slice-unsealed-can-only-really-continue'] : ['living-no-terminal-sidecar'])] };
      const completed = checkpoint.completed[checks.length];
      if (completed) assert.deepEqual(completed, result, 'Only identical already-completed SQLite transactions may be skipped');
      else { checkSqlite(runtime, database, before, intent, state, `order206:${step}`); checkpoint.completed.push(result); writeCheckpoint(); }
      checks.push(result); console.log(JSON.stringify({ ...result, resumed: !!completed })); global.gc?.();
    }
    assert.equal(ledger.next().done, true); assert.equal(proofs.next().done, true); assert.equal(checks.length, transitions.length); assert.deepEqual(checkpoint.completed, checks); assert.equal(sourceChecksSeen, checkpoint.sourceChecks.length);
    assert.deepEqual(named.map(({ name, step, source }) => ({ name, step, source })), expectedNames, 'Every observed primary/alias name is exact, with no invented or missing application');
    assert(sourceContinues.length > 0, 'Verify the real original living continuation transaction'); assert(preservedPredecessorDeath, 'Original477 sealed death is preserved separately from the chosen living474 branch');
    const edric = sourceTerminals.find(t => t.root === 'chaosHunter'); assert(edric); assert.equal(edric.targetId, 'CH3-EDRIC'); assert.equal(edric.enemyStatus, 'SURRENDERED');
    assert.equal(state.balancer.encounter.status, 'RETREATED'); assert.equal(state.balancer.encounter.enemyStatus, 'RESISTING'); assert.deepEqual(state.balancer.encounter, original.balancer.encounter);
    assert.deepEqual(migrateCurrent(runtime, readNatural('final')), state); assert.deepEqual(summary.final, body(state));
    const finalTransition = join(root, transitions.at(-1).file); assert.deepEqual(readNatural('beforeLast'), readObjectEntry(finalTransition, 'beforeLast')); assert.deepEqual(readNatural('lastIntent'), commands.at(-1));
    assert.deepEqual(summary.currentOriginals, currentResources(state)); assert.deepEqual(summary.life, state.handOfOrder.life); assert.deepEqual(summary.encounter, state.handOfOrder.encounter); assert.deepEqual(summary.bottles, state.handOfOrder.bottles);
    assert.deepEqual(summary.rounds, state.combatHistory.slice(original.combatHistory.length)); assert.deepEqual(summary.lifeAbilityUse, lifeAbilityUse(state)); assert.deepEqual(summary.combatAbilityUse, combatAbilityUse(summary.rounds));
    assert.deepEqual(summary.treatments, actualTreatments, 'Exact real post594 clinic treatment, separate from original483 paid care'); verifyCompletion(summary, state, checks);
    for (const [path, evidence] of immutable) assert.deepEqual(fileEvidence(path), evidence, `Input bytes remain unchanged: ${path}`); assert.deepEqual(readdirSync(root).sort(), members); assert.deepEqual(inspectFreeze(), frozen);
    const result = { passed: true, stage: summary.stage, sourceDirectory: root, outputDir, producerSha256: integrity.producerSha256, freezeSha256: frozen.sha256, ...compatibility,
      captureNaturalSha256: integrity.metadata['natural.json'].sha256, finalStateSha256: stateHash(state), rawSourceSchemaVersion: 181, currentSchemaVersion: 203, currentContentVersion: 'hand-of-order-v203',
      exactSourceCommands: PREFIX_COUNT, inheritedNaturalCommands: INHERITED_COUNT, inheritedDirectedCommands: 0, sourcePrefixReplayed: true, sourceBeforeLastSha256,
      commands: commands.length, sourceBoundaryCount: names.length, expectedBoundaryCount: options.expectedBoundaries ?? names.length, allNamedCaptures: named.length,
      uniqueTransitions: checks.length, aliases: named.filter(r => r.aliasOf !== null).length, fullIndexVerified: true, actualPlayerDeaths: checks.filter(r => r.status === 'DEAD').length,
      sourceContinues, sourceTerminals, preservedPredecessorDeath, actualTreatments, sourceOriginals: originalResources(original), currentOriginals: currentResources(state),
      actualPotionConsumptions: state.handOfOrder.bottles.filter(b => b.status === 'CONSUMED').map(b => ({ id: b.id, outcome: b.outcome })),
      lifeAbilityUse: summary.lifeAbilityUse, combatAbilityUse: summary.combatAbilityUse, actualLifeLedgerEntries: state.handOfOrder.life.journal.length,
      actualEncounterLedgerEntries: state.handOfOrder.encounter.journal.length, actualNewCombatRounds: summary.rounds.length, named, checks };
    const summaryPath = join(outputDir, 'summary.json');
    if (existsSync(summaryPath)) assert.deepEqual(json(summaryPath), result, 'An already completed verification summary stays exact');
    else writeFileSync(summaryPath, JSON.stringify(result, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, stage: summary.stage, allNamedCaptures: named.length, uniqueTransitions: checks.length, aliases: result.aliases, actualPlayerDeaths: result.actualPlayerDeaths, resumedSourceChecks, resumedTransitions, outputDir })); return result;
  } catch (error) {
    let attempt = 1; while (existsSync(join(outputDir, `failure-${attempt}.json`))) attempt++;
    writeFileSync(join(outputDir, `failure-${attempt}.json`), JSON.stringify({ passed: false, failedBoundary: current, verifiedTransitions: checkpoint.completed.length, sourceChecks: checkpoint.sourceChecks.length, error: String(error), sourceContinues, sourceTerminals, checks }, null, 2), { flag: 'wx' }); throw error;
  } finally { ledger.return?.(); proofs.return?.(); }
}

function argumentsForSave(args) {
  const options = { sourceDirectory: 'tests/fixtures/hand-of-order-v02060', outputDirectory: 'output/qa-0206/sqlite', tag: 'natural' }, seen = new Set();
  const setters = { '--source-directory': x => { options.sourceDirectory = x; }, '--output-directory': x => { options.outputDirectory = x; }, '--tag': x => { options.tag = x; },
    '--resume-directory': x => { options.resumeDirectory = x; }, '--freeze-sha256': x => { assert.match(x, /^[0-9a-f]{64}$/); options.freezeSha256 = x; }, '--expected-boundaries': x => { const n = Number(x); assert(Number.isSafeInteger(n) && n > 0); options.expectedBoundaries = n; } };
  for (let i = 0; i < args.length; i++) { const key = args[i]; assert(!seen.has(key)); seen.add(key); if (key === '--help' || key === '--preflight') { options[key.slice(2)] = true; continue; } assert(setters[key], `Unknown option: ${key}`); assert(args[i + 1] && !args[i + 1].startsWith('--')); setters[key](args[++i]); }
  assert(/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(options.tag)); return options;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = argumentsForSave(process.argv.slice(2));
    if (options.help) console.log('node --expose-gc --max-old-space-size=768 scripts/play/hand-of-order-save.mjs --source-directory ACTUAL_CAPTURE_DIR [--preflight] [--resume-directory EXISTING_VERIFICATION_DIR] [--expected-boundaries OBSERVED_N] [--freeze-sha256 REVIEWED_HASH] [--output-directory DIR] [--tag NAME]\nPreflight reads and validates inputs without writes or SQLite. Normal verification atomically records each completed transaction in completed.index.json. Resume replays and rechecks the full captured chain, skips only identical completed SQL transactions, and finishes all remaining ones. The observed index supplies the count; only a fully covered index produces a success summary.');
    else await verifyHandOfOrderBoundaries(options);
  } catch (error) { console.error(error); process.exitCode = 1; }
}
