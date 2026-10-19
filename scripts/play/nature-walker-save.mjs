import assert from 'node:assert/strict';
import { closeSync, fsyncSync, openSync, existsSync, mkdtempSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  SOURCE, SOURCE_SHA, PREDECESSOR, PREDECESSOR_SHA, INHERITED_SHA, PREFIX_SHA, PREFIX_COUNT, INHERITED_COUNT, SEED, CASES, ROOTS, NEW_IDS, STRATEGY, STAGES,
  json, fileEvidence, fileHash, compactHash, stateHash, stable, inspectFreeze, loadRuntime, migrateCurrent, readSource,
  originalResources, currentResources, currentSite, currentPad, body, compact, checkOriginals, publicControl,
  lifeAbilityUse, combatAbilityUse, boundaryAliases, publicSnapshot, assertPublicEvidence, readObjectEntry, readJsonLines, assertSafeOutput,
} from './nature-walker-stage.mjs';

// Run only after freezing, compiling
// and producing actual natural evidence. Derive names/count from the actual
// boundary index; no predeclared successes or fabricated missing boundaries.
// Every unique transition is checked. Aliases are accounted for separately.
// --resume-directory continues the one atomic completed.index.json, bound to
// these exact capture/source/freeze/script hashes. No ranges, omissions or
// reordered transactions. An interrupted/unrecorded transaction is retried.
// Only freshly allocated verification DBs may be reset. Never open a player DB.
const METADATA = ['natural.json', 'commands.jsonl', 'public.jsonl', 'summary.json', 'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', 'source-prefix.json'];
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
  assertLiveBefore(before, intent); assertPublicEvidence(runtime, after);
  for (const name of readdirSync(dirname(database)).filter(name => name.startsWith(basename(database)))) {
    const path = join(dirname(database), name); assert.equal(realpathSync(path), path, 'A verification DB or its recovery sidecar cannot be an external symlink');
  }
  if (existsSync(database) && existsSync(`${database}.sealed`)) {
    // Crash after a terminal commit but before the atomic checkpoint: preserve the
    // actual sealed attempt and retry the verification in a fresh owned DB.
    // A sealed player run is never reset, even inside this verification directory.
    assert.equal(after.status, 'DEAD'); assert.deepEqual(json(`${database}.sealed`), [after.runId]);
    let committed;
    try { committed = new runtime.SqliteSliceStore(database); assert.deepEqual(committed.repository.get(after.runId).state, after);
      const receipt = committed.repository.receipt(intentId); assert(receipt); assert.deepEqual(receipt.receipt.state, runtime.projectSliceState(after));
      assert.equal(receipt.fingerprint, stable({ intentId, runId: before.runId, expectedRevision: before.revision, payload: intent }));
    } finally { committed?.close(); }
    let retry = 1; while (existsSync(`${database}.retry-${retry}.sqlite`)) retry++;
    return checkSqlite(runtime, `${database}.retry-${retry}.sqlite`, before, intent, after, intentId);
  }
  if (existsSync(database)) {
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
      const blockedPayloads = [{ type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' }, { type: 'NATURE_WALKER', command: { type: 'OBSERVE', caseId: CASES[0] } }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }];
      for (const payload of blockedPayloads) {
        const id = `${intentId}:sealed:${payload.type}`, blocked = app.submitIntent({ intentId: id, runId: after.runId, expectedRevision: after.revision, payload });
        assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED', JSON.stringify(blocked)); assert.equal(app.repository.receipt(id), null);
        assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(storedRows(database), committedRows); assert.deepEqual(json(`${database}.sealed`), [after.runId]);
      }
    } else assert.equal(existsSync(`${database}.sealed`), false, 'A living completed slice or an opponent terminal outcome must not seal the player');
    app.close(); app = undefined; app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(storedRows(database), committedRows); assert.deepEqual(app.repository.get(after.runId).state, after); assert.equal(app.repository.receipt(staleId), null);
  } finally { app?.close(); }
  return database;
}
function safeInput(root, filename) {
  assert.equal(filename, basename(filename)); assert(filename.endsWith('.json') || filename.endsWith('.jsonl')); assert(!isAbsolute(filename));
  const path = join(root, filename); assert.equal(realpathSync(path), path, 'No external capture symlink');
  const inside = relative(root, path); assert(inside && inside !== '..' && !inside.startsWith(`..${sep}`)); return path;
}
function checkWeeklySettlement(runtime, before, after, paidBudget, finance) {
  assert.deepEqual(finance, runtime.natureWalkerFinanceSnapshot(before));
  const locked = runtime.hasNatureWalkerLifeLock(after) || runtime.hasNatureWalkerEncounterLock(after) || after.natureWalker.preparedWeek !== null || after.combat !== null;
  if (paidBudget.actions > 0 || locked || after.status !== 'ACTIVE') {
    assert.equal(after.cash, paidBudget.cash); assert.equal(after.actionsRemaining, paidBudget.actions);
    assert.equal(after.week, before.week); assert.deepEqual(runtime.natureWalkerFinanceSnapshot(after), finance); return;
  }
  assert.equal(paidBudget.actions, 0);
  const result = runtime.resolveSliceWeeklyFinance({ ...finance, cash: paidBudget.cash, week: before.week, revision: before.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE';
  assert.equal(after.cash, result.state.cash); assert.equal(after.actionsRemaining, advanced ? before.weeklyBudget : 0);
  assert.equal(after.week, before.week + (advanced ? 1 : 0)); assert.deepEqual(after.date, advanced ? runtime.addGameWeeks(before.date, 1) : before.date);
  assert.equal(after.pulse, advanced ? 'NONE' : result.state.pulse); assert.equal(after.billAmount, advanced ? 0 : result.state.billAmount);
  assert.deepEqual(runtime.natureWalkerFinanceSnapshot(after), runtime.natureWalkerFinanceSnapshot({ ...finance, ...result.state, weeklyBudget: before.weeklyBudget, lifeTier: advanced ? result.state.nextLifeTier : before.lifeTier }));
  if (result.eventId) assert.equal(after.activeEvent?.id, result.eventId);
  const expected = result.receipts.map(r => ({ week: before.week, ...r }));
  if (advanced) expected.push({ week: before.week + 1, title: '新的一周', text: `日期推进7天，本周${before.weeklyBudget}次行动。` });
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const actual = after.chronicle.filter((row, i) => row.id === `record-${after.revision}-${i}` && titles.includes(row.title));
  assert.deepEqual(actual.map(({ week, title, text }) => ({ week, title, text })), expected);
}
function checkActualCosts(runtime, before, intent, after) {
  if (intent.type === 'ACTION') { assert.equal(intent.action, before.wagePaidWeek === before.week ? 'REST' : 'WORK', 'Actual work once per week, then rest; no forced medical access'); return; }
  if (intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01') {
    assert.equal(intent.choiceId, 'PAY'); assert(after.cash <= before.cash - 60); assert.equal(after.health, before.health); assert.equal(after.injuryRisk, before.injuryRisk);
    for (const injury of before.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)) { const same = after.injuries.find(i => i.id === injury.id); assert(same); assert.equal(same.acquiredRevision, injury.acquiredRevision); assert.equal(same.treatedRevision, before.revision + 1); } return;
  }
  if (intent.type !== 'NATURE_WALKER') return;
  const c = intent.command, state = after.natureWalker;
  const acquisition = state.acquisitionJournal.length > before.natureWalker.acquisitionJournal.length ? state.acquisitionJournal.at(-1) : null;
  const life = state.life.journal.length > before.natureWalker.life.journal.length ? state.life.journal.at(-1) : null;
  if (acquisition) {
    assert.deepEqual(acquisition.command, c); assert.deepEqual(acquisition.before, runtime.natureWalkerAcquisitionBudget(before));
    const fee = c.type === 'LEARN_GUIDANCE' ? 500 : c.type === 'BUY_POTION' ? 1200 : c.type === 'PREPARE_PROMOTION' ? 180 : c.type === 'REQUEST_SUPPLY' ? 100 : 0;
    const ap = ['LEARN_GUIDANCE', 'PREPARE_TASK', 'POTION_WORK', 'PREPARE_PROMOTION', 'REQUEST_SUPPLY'].includes(c.type) ? 1 : 0;
    assert.equal(acquisition.after.cash, acquisition.before.cash - fee); assert.equal(acquisition.after.actions, acquisition.before.actions - ap);
    checkWeeklySettlement(runtime, before, after, acquisition.after, acquisition.finance);
    if (c.type === 'POTION_WORK') { const old = before.natureWalker.bottles.find(b => b.id === c.bottleId), now = state.bottles.find(b => b.id === c.bottleId); assert.equal(now.labourSteps, old.labourSteps + 1); }
    if (c.type === 'BUY_POTION') assert.equal(state.bottles.find(b => b.id === c.bottleId).labourSteps, 5);
    if (c.type === 'PREPARE_PROMOTION' || c.type === 'CONSUME') assert(before.week - before.barrenMatriarch.promotionWeek >= 12, 'Wait from actual BarrenMatriarch W202, never original Cultivator W6');
    if (c.type === 'CONSUME') {
      assert.equal(before.natureWalker.preparedWeek, before.week); assert.equal(after.random.cursor, before.random.cursor + 1); assert.equal(state.preparedWeek, null);
      const b = state.bottles.find(b => b.id === c.bottleId); assert.equal(b.status, 'CONSUMED'); assert.equal(b.preparationWeek, b.consumedWeek);
      assert.deepEqual(currentResources(after), currentResources(before)); assert.deepEqual(after.injuries, before.injuries);
      if (after.progression.sequence === 1) { assert.equal(after.health, before.health); assert.equal(after.spirituality, before.spirituality); assert.deepEqual(after.progression.mastery, { ...before.progression.mastery, ...Object.fromEntries(NEW_IDS.map(id => [id, 0])) }); }
    }
    if (c.type === 'REQUEST_SUPPLY') assert(before.natureWalker.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome)));
    if (c.type === 'RECEIVE_SUPPLY') { assert(before.week > before.natureWalker.resupply.requestedWeek); assert.equal(state.bottles.length, before.natureWalker.bottles.length + 3); assert.deepEqual(state.bottles.slice(0, -3), before.natureWalker.bottles); }
  }
  if (life) {
    assert.deepEqual(life.command, c); assert.equal(life.before.cash, before.cash); assert.equal(life.before.actions, before.actionsRemaining);
    assert.equal(life.after.cash, life.before.cash - life.paid.pennies); assert.equal(life.after.actions, life.before.actions - life.paid.actions);
    assert.equal(life.after.spirituality, life.before.spirituality - life.paid.spirituality); assert.equal(life.after.mind, life.before.mind - life.paid.mind); assert.equal(life.after.health, life.before.health - life.paid.health);
    assert.deepEqual(life.padBefore, currentPad(before)); assert.deepEqual(life.padAfter, currentPad(after)); assert.equal(life.clockBefore, currentSite(before).clockSeconds); assert.equal(life.clockAfter, currentSite(after).clockSeconds);
    assert.equal(currentSite(after).paper.text, currentSite(before).paper.text);
    checkWeeklySettlement(runtime, before, after, life.after, runtime.natureWalkerFinanceSnapshot(before));
    if (c.type === 'EXIT_ORIGINAL') { assert.equal(life.paid.actions, 0); assert.equal(life.clockAfter - life.clockBefore, 4); assert.equal(currentSite(before).playerLocation, 'START'); assert.equal(currentSite(after).playerLocation, 'OUTSIDE'); assert.equal(currentSite(after).playerTravelMetres - currentSite(before).playerTravelMetres, 4); }
    if (['INITIALISE_WORKAREA', 'RENT_ANNEX'].includes(c.type)) { assert.equal(life.paid.pennies, 40); assert.equal(life.paid.actions, 1); assert.equal(state.life.annex.id, 'NW1-NEIGHBOR-WORKAREA'); assert.equal(state.life.annex.supportPieces, 3); assert.equal(state.life.annex.marks.length, 2); assert.equal(state.life.annex.placementConsent, 'GRANTED'); }
    if (c.type === 'PREPARE') { assert(['ABILITY','ORDINARY'].includes(c.method)); assert.equal(life.paid.pennies, 0); assert.equal(life.paid.actions, 1); }
    if (c.type === 'SETUP_OBJECTS') { assert.equal(state.life.annex.effortSpent, before.natureWalker.life.annex.effortSpent + 3); assert.equal(currentSite(after).recipient.mind, currentSite(before).recipient.mind - 1); }
    if (['LIVING_RESPONSE', 'ROOT_BEARING'].includes(c.type)) {
      assert.equal(life.paid.spirituality, 8); assert.equal(life.paid.mind, ['FAILURE', 'GREAT_FAILURE'].includes(life.tier) ? 4 : 2); assert.equal(life.paid.actions, 1);
      assert.equal(after.random.cursor, before.random.cursor + 1); assert.equal(state.life.annex.supportPieces, before.natureWalker.life.annex.supportPieces - 1);
      assert.deepEqual(after.progression.mastery, before.progression.mastery, 'Casting alone grants no mastery');
      const ability = c.type === 'LIVING_RESPONSE' ? 'livingResponse' : 'rootBearing', effect = state.life.operation[ability];
      if (effect) { assert.equal(effect.expiresAt - effect.createdAt, 20); assert.equal(effect.remainingUses, 1); assert.equal(effect.sourceCaseId, c.caseId); }
    }
    if (c.type === 'CARE_CHECK') { const a = state.life.cases[c.caseId].attempts[0]; assert.equal(after.random.cursor, before.random.cursor + 1); assert.equal(life.source.assistance, a.careAssisted ? 35 : 0); }
    if (c.type === 'ORDINARY_CARE') { assert.equal(after.random.cursor, before.random.cursor); assert.equal(life.source, null); }
    if (['APPLY_IMPACT', 'ORDINARY_SUPPORT', 'CANCEL_IMPACT'].includes(c.type)) {
      const impact = state.life.cases[c.caseId].attempts[0].impact; assert(impact); assert.equal(impact.padId, 'BM2-ROOT-PAD'); assert.equal(impact.baseHealthLoss, 5);
      assert.equal(after.health, before.health - impact.healthLoss); assert.equal(currentPad(after).integrity, currentPad(before).integrity - impact.padWear);
      assert.equal(impact.healthLoss, c.type === 'CANCEL_IMPACT' ? 0 : c.type === 'ORDINARY_SUPPORT' || impact.rootBearingApplied ? 2 : 5); assert.equal(impact.padWear, c.type === 'CANCEL_IMPACT' ? 0 : 15);
    }
    if (c.type === 'WITHDRAW_PERMISSION') { assert.equal(state.life.operation.livingResponse, null); assert.equal(state.life.operation.rootBearing, null); assert.deepEqual(after.progression.mastery, before.progression.mastery); }
    for (const [i, sample] of currentSite(after).samples.entries()) { assert.equal(sample.alive, currentSite(before).samples[i].alive); assert.equal(sample.vitality, currentSite(before).samples[i].vitality); }
  }
  if (c.type === 'PREPARE_ENCOUNTER') {
    const p = state.encounter.preparation; assert.equal(p.pricePaid, 30); assert.equal(p.actionsPaid, 0); assert.equal(p.mindPaid, 2);
    assert.equal(p.after.cash, p.before.cash - 30); assert.equal(p.after.actions, p.before.actions); assert.equal(p.after.mind, p.before.mind - 2);
    assert.equal(state.encounter.supportPieces.length, 3); assert(state.encounter.supportPieces.every(p => p.status === 'HELD' && p.wear === 0)); assert.deepEqual(p.rootPad, currentPad(before));
    checkWeeklySettlement(runtime, before, after, p.after, p.finance);
  }
}

function verifyCompletion(summary, s, checks) {
  const l = s.natureWalker.life, e = s.natureWalker.encounter;
  assert(s.natureWalker.bottles.filter(b => b.status === 'CONSUMED').length <= STRATEGY.potionAttemptCap);
  for (const id of CASES) { assert(l.cases[id].attempts.length <= 1, 'No retry to select a favorable result'); assert(l.journal.filter(r => ['LIVING_RESPONSE', 'ROOT_BEARING'].includes(r.command.type) && r.command.caseId === id).length <= 1); }
  for (const [i, round] of summary.rounds.entries()) { assert.equal(round.stance, i < STRATEGY.combatRoundCap ? 'CONTROL' : 'RETREAT'); assert.equal(round.natureWalkerOutcome.source.policy, 'ALL'); assert.equal(round.natureWalkerOutcome.source.targetId, 'NW1-ELIAS'); }
  assert(summary.rounds.length <= STRATEGY.combatRoundCap + 1);
  assert(e.journal.filter(row => row.command.type === 'ENCOUNTER_FIGHT').length <= 1, 'One optional independent encounter; old opponents remain frozen');
  if (summary.stage === STAGES[0]) {
    assert.equal(s.status, 'ACTIVE'); assert.equal(s.progression.sequence, 1); assert.equal(s.progression.acting, 100);
    assert.equal(l.reflected, true); assert.equal(l.activeCase, null); assert.deepEqual(l.operation, { dormancy: null, buffer: null, livingResponse: null, rootBearing: null }); assert.equal(l.annex.effortSpent, 9);
    assert.equal(CASES.flatMap(id => l.cases[id].attempts).reduce((n, a) => n + a.recipientMindSpent, 0), 3);
    for (const id of CASES) { const r = l.cases[id], a = r.attempts[0]; assert.equal(r.status, 'RESOLVED'); assert.equal(r.attempts.length, 1); assert(a.closed && a.inspected && a.objectsReturned && a.resultRead); }
    assert.equal(l.annex.placementConsent, 'GRANTED'); assert(l.annex.paidWeek !== null); assert.equal(l.journal.filter(e => ['INITIALISE_WORKAREA', 'RENT_ANNEX'].includes(e.command.type)).length, 1);
    const withdrawn = l.cases['withdrawn-care'].attempts[0]; assert.equal(withdrawn.permissionWithdrawn, true); assert.equal(withdrawn.result, 'ORDINARY'); assert.equal(withdrawn.appliedAbilityIds.length, 0);
    assert.equal(s.combat, null); assert(e.terminal); assert.notEqual(e.terminal.outcome, 'PLAYER_DEAD'); assert.equal(e.terminal.exitMetres, 4); assert.equal(e.terminal.exitSeconds, 4);
    assert.equal(currentSite(s).playerLocation, 'OUTSIDE'); assert.equal(currentSite(s).owner.location, 'OUTSIDE'); assert.equal(currentSite(s).recipient.location, 'OUTSIDE');
    for (const object of [currentSite(s).paper, currentSite(s).box, currentSite(s).tag, ...currentSite(s).pads]) { assert.equal(object.holder, 'OWNER'); assert.equal(object.location, 'OUTSIDE'); }
    assert(currentSite(s).samples.every(x => x.location === 'OUTSIDE')); assert.equal(e.livingResponseApplications, 0);
    assert(summary.boundaries.includes('actual-ordinary-encounter-exit')); assert(summary.boundaries.includes('ordinary-life-after-actual-exit')); assert(summary.snapshots.livingContinuation);
  } else if (summary.stage === STAGES[1]) {
    assert.equal(s.status, 'ACTIVE'); assert.equal(s.progression.sequence, 2); assert.equal(summary.rounds.length, 0);
    const consumed = s.natureWalker.bottles.filter(b => b.status === 'CONSUMED'); assert.equal(consumed.length, STRATEGY.potionAttemptCap); assert(consumed.every(b => ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome)));
  } else if (summary.stage === STAGES[2]) {
    assert.equal(s.status, 'ACTIVE'); assert.equal(e.status, 'FIGHTING'); assert.equal(e.terminal, null); assert(s.combat); assert(summary.rounds.length >= STRATEGY.combatRoundCap);
  } else {
    assert.equal(summary.stage, STAGES[3]); assert.equal(s.status, 'DEAD'); assert.equal(s.health, 0); assert.equal(checks.at(-1).status, 'DEAD'); assert.equal(checks.filter(c => c.status === 'DEAD').length, 1);
    if (e.terminal?.outcome === 'PLAYER_DEAD') { assert.equal(e.terminal.exitMetres, 0); assert.equal(e.terminal.exitSeconds, 0); assert.equal(currentSite(s).playerLocation, 'ANNEX_A'); }
  }
}
// Initial207 has one strict mechanics/source/UI/producer/verifier freeze. No206 UI exception.
export function assertNatureWalkerFreezeCompatibility(captured, runtime) {
  assert.equal(compactHash(captured.files), captured.sha256, 'Capture freeze list/hash mismatch');
  assert.equal(compactHash(runtime.files), runtime.sha256, 'Runtime freeze list/hash mismatch');
  assert.deepEqual(runtime, captured, 'Every frozen byte must equal the initial207 capture freeze');
  return { captureFreezeSha256: captured.sha256, runtimeFreezeSha256: runtime.sha256, changedFiles: [] };
}
export function assertNatureWalkerInputEvidence(actual, expected, path) { assert.deepEqual(actual, expected, `Changed immutable input: ${path}`); }
export function assertNatureWalkerResumeManifest(stored, current) { assert.deepEqual(stored, current, 'Resume requires identical full capture, runtime, source, prefix, and verifier bytes'); }

export async function verifyNatureWalkerBoundaries(options) {
  const root = realpathSync(options.sourceDirectory), integrity = json(join(root, 'capture-integrity.json')), summary = json(join(root, 'summary.json'));
  assert(STAGES.includes(summary.stage), 'An ACTUAL_BLOCKER remains failure evidence, never verified completion');
  const frozen = inspectFreeze(), capturedFreeze = { sha256: integrity.freezeSha256, files: integrity.frozenFiles };
  const compatibility = assertNatureWalkerFreezeCompatibility(capturedFreeze, frozen);
  if (options.freezeSha256) assert.equal(options.freezeSha256, frozen.sha256);
  assert.equal(summary.freezeSha256, capturedFreeze.sha256); assert.equal(fileHash(fileURLToPath(new URL('./nature-walker-stage.mjs', import.meta.url))), integrity.producerSha256); assert.equal(summary.producerSha256, integrity.producerSha256);
  const immutable = new Map(), pin = (path, expected) => { const result = fileEvidence(path); if (expected) assertNatureWalkerInputEvidence(result, expected, path); immutable.set(path, result); return result; };
  pin(SOURCE); assert.equal(immutable.get(SOURCE).sha256, SOURCE_SHA); pin(PREDECESSOR); assert.equal(immutable.get(PREDECESSOR).sha256, PREDECESSOR_SHA);
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
  assert.deepEqual(readNatural('provenance'), { kind: 'EXACT851_PUBLIC_BARREN_MATRIARCH_THEN_PUBLIC_NATURE_WALKER', prior: old.provenance, source: SOURCE, sourceSha256: SOURCE_SHA, sourceRoot: 'final', inheritedDirectedPrefix: false, fullNaturalS9ToS1: summary.final.sequence === 1, newRandomChanges: false });
  const runtime = await loadRuntime({ sqlite: true }), original = migrateCurrent(runtime, old.final), initial = migrateCurrent(runtime, old.initial), prefix = readNatural('prefixFinal');
  assert.equal(prefix.schemaVersion, 204); assert.equal(prefix.contentVersion, 'nature-walker-v204'); assert.deepEqual(migrateCurrent(runtime, prefix), original); assert.deepEqual(readNatural('initial'), initial);
  assert.deepEqual(summary.source, { prefixCount: PREFIX_COUNT, prefixVerified: true, sourceSha256: SOURCE_SHA, prefixCompactSha256: PREFIX_SHA, migratedWholeSourceSha256: stateHash(original) });
  const sourcePrefix = join(root, 'source-prefix.json');
  assert.deepEqual(readObjectEntry(sourcePrefix, 'rawInitial'), old.initial); assert.deepEqual(readObjectEntry(sourcePrefix, 'rawFinal'), old.final);
  assert.deepEqual(readObjectEntry(sourcePrefix, 'rawInheritedFinal'), old.prefixFinal); assert.equal(readObjectEntry(sourcePrefix, 'predecessorSource'), PREDECESSOR); assert.equal(readObjectEntry(sourcePrefix, 'predecessorSha256'), PREDECESSOR_SHA); assert.equal(readObjectEntry(sourcePrefix, 'inheritedCount'), INHERITED_COUNT); assert.equal(readObjectEntry(sourcePrefix, 'inheritedCommandsSha256'), INHERITED_SHA);
  assert.deepEqual(readObjectEntry(sourcePrefix, 'commands'), old.commands); assert.equal(readObjectEntry(sourcePrefix, 'rawCommandsSha256'), PREFIX_SHA); assert.equal(readObjectEntry(sourcePrefix, 'migratedWholeStateSha256'), stateHash(original));
  assert.equal(readObjectEntry(sourcePrefix, 'source'), SOURCE); assert.equal(readObjectEntry(sourcePrefix, 'sourceSha256'), SOURCE_SHA); assert.equal(readObjectEntry(sourcePrefix, 'sourceRoot'), 'final'); assert.equal(readObjectEntry(sourcePrefix, 'prefixCount'), PREFIX_COUNT); assert.equal(readObjectEntry(sourcePrefix, 'inheritedDirectedPrefix'), false);
  assert.deepEqual(summary.originalMastery, original.progression.mastery); assert.deepEqual(summary.sourceOriginals, originalResources(original));
  assert.equal(transitions.length, commands.length - PREFIX_COUNT + 1); assert.equal(summary.uniqueTransitions, transitions.length);
  const byStep = new Map(), primaryFiles = new Set();
  for (const [i, t] of transitions.entries()) {
    assert.deepEqual(Object.keys(t).sort(), ['key', 'file', 'commandIndex', 'beforeRevision', 'afterRevision'].sort()); const step = PREFIX_COUNT + i;
    assert.equal(t.commandIndex, step); assert.equal(t.beforeRevision, initial.revision + step - 1); assert.equal(t.afterRevision, initial.revision + step);
    assert.equal(index[t.key], t.file); assert.equal(steps[t.key], step); assert(!primaryFiles.has(t.file)); primaryFiles.add(t.file); byStep.set(step, t);
  }
  assert.equal(transitions[0].key, 'exact-original851-living-source');
  const named = names.map(name => { const t = byStep.get(steps[name]); assert(t); assert.equal(index[name], t.file); return { name, source: index[name], step: steps[name], aliasOf: name === t.key ? null : t.key, sourceSha256: integrity.files[index[name]].sha256 }; });
  const snapshotEvidence = Object.fromEntries(Object.entries(summary.snapshots).map(([name, file]) => {
    const raw = json(join(root, file)); assert.equal(raw.schemaVersion, 204); assert.equal(raw.contentVersion, 'nature-walker-v204');
    const state = migrateCurrent(runtime, raw), step = state.revision - initial.revision; assert(byStep.has(step)); checkOriginals(runtime, state, original); return [name, { step, sha256: stateHash(state) }];
  }));
  assert.deepEqual(json(join(root, summary.snapshots.departure)), original);

  if (options.preflight) {
    assert(!options.resumeDirectory, 'Preflight does not open a verification directory');
    for (const [path, evidence] of immutable) assert.deepEqual(fileEvidence(path), evidence); assert.deepEqual(inspectFreeze(), frozen);
    const result = { preflightPassed: true, sourceDirectory: root, stage: summary.stage, freezeSha256: frozen.sha256, ...compatibility, sourceSha256: SOURCE_SHA,
      namedBoundaries: names.length, uniqueTransitions: transitions.length, sourceCommands: PREFIX_COUNT, currentSchemaVersion: 204,
      immutableFilesChecked: immutable.size, fullCommandReplay: false, sqliteRun: false, outputWritten: false };
    console.log(JSON.stringify(result)); return result;
  }

  const outputRoot = realpathSync(assertSafeOutput(options.outputDirectory, [root, 'tests/fixtures', 'scripts/play']));
  const outputDir = options.resumeDirectory ? realpathSync(options.resumeDirectory) : mkdtempSync(join(outputRoot, `boundaries-${options.tag}-`));
  if (options.resumeDirectory) {
    assert.equal(dirname(outputDir), outputRoot, 'Resume only a direct, previously allocated child of the configured verification output root');
    assert(/^boundaries-[A-Za-z0-9_-]+-[A-Za-z0-9]{6}$/.test(basename(outputDir)), 'Not a generated NatureWalker verification directory');
  }
  const manifest = { kind: 'NATURE_WALKER_207_SQLITE_VERIFICATION', sourceDirectory: root, outputDirectory: outputDir, sourceSha256: SOURCE_SHA,
    naturalSha256: integrity.metadata['natural.json'].sha256, boundaryIndexSha256: integrity.metadata['boundaries.index.json'].sha256,
    boundaryStepsSha256: integrity.metadata['boundaries.steps.json'].sha256, transitionsSha256: integrity.metadata['transitions.json'].sha256,
    freezeSha256: frozen.sha256, ...compatibility, fullInputEvidenceSha256: compactHash([...immutable]), sourcePrefixSha256: integrity.metadata['source-prefix.json'].sha256, predecessorSha256: PREDECESSOR_SHA, inheritedCommandsSha256: INHERITED_SHA, producerSha256: integrity.producerSha256, verifierSha256: fileHash(fileURLToPath(import.meta.url)),
    stage: summary.stage, namedBoundaries: names.length, uniqueTransitions: transitions.length };
  const manifestPath = join(outputDir, 'verification-manifest.json'), completedPath = join(outputDir, 'completed.index.json');
  const checkpointExists = existsSync(completedPath);
  const checkpoint = options.resumeDirectory && checkpointExists ? json(completedPath) : { manifestSha256: compactHash(manifest), sourceChecks: [], completed: [] };
  if (options.resumeDirectory) {
    for (const path of [manifestPath, ...(checkpointExists ? [completedPath] : [])]) assert.equal(realpathSync(path), path, 'No external verification-index symlink');
    assertNatureWalkerResumeManifest(json(manifestPath), manifest);
    assert.deepEqual(Object.keys(checkpoint).sort(), ['manifestSha256', 'sourceChecks', 'completed'].sort()); assert.equal(checkpoint.manifestSha256, compactHash(manifest));
    assert(Array.isArray(checkpoint.sourceChecks) && Array.isArray(checkpoint.completed)); assert(checkpoint.completed.length <= transitions.length);
    for (const [i, row] of checkpoint.completed.entries()) { assert.equal(row.step, transitions[i].commandIndex); assert.equal(row.name, transitions[i].key); assert.equal(row.source, transitions[i].file); }
  } else writeFileSync(manifestPath, JSON.stringify(manifest), { flag: 'wx' });
  const resumedSourceChecks = checkpoint.sourceChecks.length, resumedTransitions = checkpoint.completed.length;
  const writeCheckpoint = () => {
    const next = `${completedPath}.next`; if (existsSync(next)) assert.equal(realpathSync(next), next, 'No external checkpoint temporary-file symlink');
    writeFileSync(next, JSON.stringify(checkpoint)); const fd = openSync(next, 'r+'); try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(next, completedPath); const directory = openSync(outputDir, 'r'); try { fsyncSync(directory); } finally { closeSync(directory); }
  };
  if (!options.resumeDirectory || !checkpointExists) writeCheckpoint();
  const commonDatabase = join(outputDir, 'verification.sqlite'), ledger = readJsonLines(join(root, 'commands.jsonl')), proofs = readJsonLines(join(root, 'public.jsonl'));
  const checks = [], sourceTerminals = [], sourceContinues = [], actualTreatments = [], expectedNames = [], occupiedNames = new Set();
  let sourceChecksSeen = 0;
  const checkSourceSqlite = (key, result, before, intent, after, database) => {
    const row = { key, ...result }, prior = checkpoint.sourceChecks[sourceChecksSeen++];
    if (prior) assert.deepEqual(prior, row, 'Completed source transaction must equal the freshly replayed real source');
    else { checkSqlite(runtime, database, before, intent, after, `nature207:source:${key}`); checkpoint.sourceChecks.push(row); writeCheckpoint(); }
  };
  let state = runtime.createSliceRun(original.runId, old.creation, SEED), current = null, sourceBeforeLastSha256 = null;
  assert.deepEqual(state, initial);
  const expectName = (key, step, file) => { let name = key, n = 2; while (occupiedNames.has(name)) name = `${key}-${n++}`; occupiedNames.add(name); expectedNames.push({ name, step, source: file }); };
  try {
    for (const [i, intent] of commands.entries()) {
      const step = i + 1, row = ledger.next(); assert.equal(row.done, false); const log = row.value, before = state;
      assert.equal(log.step, step); assert.deepEqual(log.intent, intent); assert.equal(log.sourcePrefix, step <= PREFIX_COUNT); assert.deepEqual(log.before, body(before));
      assert(runtime.validateSlicePayload(intent)); assertLiveBefore(before, intent);
      let proof = null;
      if (step > PREFIX_COUNT) {
        const next = proofs.next(); assert.equal(next.done, false); proof = next.value;
        assert.equal(proof.step, step); assert.equal(proof.revision, before.revision); assert.deepEqual(proof.command, intent); assert.deepEqual(proof.control, publicControl(runtime, before, intent));
        assert.deepEqual(Object.keys(proof).sort(), ['step','revision','command','control','before','after'].sort()); assert.deepEqual(proof.before, publicSnapshot(runtime, before)); checkOriginals(runtime, before, original);
      } else assert.equal(log.boundaryKey, null);
      state = runtime.applySliceIntent(before, intent); runtime.assertValidSliceState(state);
      assert.equal(state.revision, before.revision + 1); assert.equal(state.random.seed, SEED); assert(state.random.cursor >= before.random.cursor); assert.deepEqual(log.after, body(state));
      if (step <= PREFIX_COUNT) {
        if (step === INHERITED_COUNT) {
          assert.deepEqual(state, migrateCurrent(runtime, old.prefixFinal), 'The entire original674 living predecessor is exact');
          assert.deepEqual(state, migrateCurrent(runtime, old.predecessor.final));
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
      if (step === PREFIX_COUNT) { assert.deepEqual(state, original, 'Every851 source command replays to the entire migrated original final'); sourceBeforeLastSha256 = stateHash(before); assert.equal(sourceChecksSeen, checkpoint.sourceChecks.length, 'No missing or extra completed source transactions'); }
      const transition = byStep.get(step); assert(transition); current = transition.key;
      const path = join(root, transition.file); assert.equal(readObjectEntry(path, 'commandCount'), step); assert.deepEqual(readObjectEntry(path, 'lastIntent'), intent);
      const rawBefore = readObjectEntry(path, 'beforeLast'), rawAfter = readObjectEntry(path, 'final');
      for (const raw of [rawBefore, rawAfter]) { assert.equal(raw.schemaVersion, 204); assert.equal(raw.contentVersion, 'nature-walker-v204'); }
      assert.deepEqual(migrateCurrent(runtime, rawBefore), before, 'Whole-state chain equals deterministic replay'); assert.deepEqual(migrateCurrent(runtime, rawAfter), state, 'Whole captured final equals real command application');
      assert.equal(transition.beforeRevision, before.revision); assert.equal(transition.afterRevision, state.revision);
      if (step > PREFIX_COUNT) {
        assert.equal(transition.key, log.boundaryKey); assert.deepEqual(proof.after, publicSnapshot(runtime, state));
        checkActualCosts(runtime, before, intent, state);
        if (intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01') actualTreatments.push({ paidPennies: 60, before: body(before), after: body(state) });
        assert(currentSite(state).clockSeconds >= currentSite(before).clockSeconds); assert(currentSite(state).playerTravelMetres >= currentSite(before).playerTravelMetres);
      }
      checkOriginals(runtime, state, original);
      expectName(transition.key, step, transition.file); if (step > PREFIX_COUNT) for (const name of boundaryAliases(before, intent, state)) expectName(name, step, transition.file);
      const finalSha256 = stateHash(state);
      for (const [name, snapshot] of Object.entries(snapshotEvidence)) if (snapshot.step === step) assert.equal(snapshot.sha256, finalSha256, `Snapshot matches actual transition: ${name}`);
      const completed = checkpoint.completed[checks.length];
      let database = state.status === 'DEAD' ? join(outputDir, `terminal-${step}.sqlite`) : commonDatabase;
      if (completed) {
        assert.equal(completed.database, basename(completed.database));
        assert(state.status === 'DEAD' ? new RegExp(`^terminal-${step}\\.sqlite(?:\\.retry-[1-9][0-9]*\\.sqlite)*$`).test(completed.database) : completed.database === basename(commonDatabase));
        database = join(outputDir, completed.database); assert(existsSync(database)); assert.equal(realpathSync(database), database);
      }
      const result = { name: transition.key, source: transition.file, step, sourceSha256: integrity.files[transition.file].sha256, finalSha256, status: state.status, revision: state.revision, database: relative(outputDir, database),
        checks: [...CHECKS, ...(state.status === 'DEAD' ? ['sealed-reopen-no-further-action', 'dead-continue-life-archived'] : state.status === 'SLICE_COMPLETE' ? ['living-slice-unsealed-can-only-really-continue'] : ['living-no-terminal-sidecar'])] };
      if (completed) assert.deepEqual(completed, result, 'Only identical already-completed SQLite transactions may be skipped');
      else { result.database = relative(outputDir, checkSqlite(runtime, database, before, intent, state, `nature207:${step}`)); checkpoint.completed.push(result); writeCheckpoint(); }
      checks.push(result); console.log(JSON.stringify({ ...result, resumed: !!completed })); global.gc?.();
    }
    assert.equal(ledger.next().done, true); assert.equal(proofs.next().done, true); assert.equal(checks.length, transitions.length); assert.deepEqual(checkpoint.completed, checks); assert.equal(sourceChecksSeen, checkpoint.sourceChecks.length);
    assert.deepEqual(named.map(({ name, step, source }) => ({ name, step, source })), expectedNames, 'Every observed primary/alias name is exact, with no invented or missing application');
    assert(sourceContinues.length > 0, 'Verify the real original living continuation transaction');
    const nolan = sourceTerminals.find(t => t.root === 'coffinBearer'), martin = sourceTerminals.find(t => t.root === 'barrenMatriarch');
    assert(nolan); assert.equal(nolan.targetId, 'CB3-NOLAN'); assert.equal(nolan.enemyStatus, 'SURRENDERED');
    assert(martin); assert.equal(martin.targetId, 'BM2-MARTIN'); assert.equal(martin.enemyStatus, 'SURRENDERED');
    assert.deepEqual(state.coffinBearer.encounter, original.coffinBearer.encounter); assert.deepEqual(state.barrenMatriarch.encounter, original.barrenMatriarch.encounter);
    assert.deepEqual(migrateCurrent(runtime, readNatural('final')), state); assert.deepEqual(summary.final, body(state));
    const finalTransition = join(root, transitions.at(-1).file); assert.deepEqual(readNatural('beforeLast'), readObjectEntry(finalTransition, 'beforeLast')); assert.deepEqual(readNatural('lastIntent'), commands.at(-1));
    assert.deepEqual(summary.currentOriginals, currentResources(state)); assert.deepEqual(summary.life, state.natureWalker.life); assert.deepEqual(summary.encounter, state.natureWalker.encounter); assert.deepEqual(summary.bottles, state.natureWalker.bottles);
    assert.deepEqual(summary.rounds, state.combatHistory.slice(original.combatHistory.length)); assert.deepEqual(summary.lifeAbilityUse, lifeAbilityUse(state)); assert.deepEqual(summary.combatAbilityUse, combatAbilityUse(summary.rounds));
    assert.deepEqual(summary.treatments, actualTreatments, 'Only genuinely triggered current wound treatment, never an invented source injury'); verifyCompletion(summary, state, checks);
    for (const [path, evidence] of immutable) assert.deepEqual(fileEvidence(path), evidence, `Input bytes remain unchanged: ${path}`); assert.deepEqual(readdirSync(root).sort(), members); assert.deepEqual(inspectFreeze(), frozen);
    const result = { passed: true, stage: summary.stage, sourceDirectory: root, outputDir, producerSha256: integrity.producerSha256, freezeSha256: frozen.sha256, ...compatibility,
      captureNaturalSha256: integrity.metadata['natural.json'].sha256, finalStateSha256: stateHash(state), rawSourceSchemaVersion: 182, currentSchemaVersion: 204, currentContentVersion: 'nature-walker-v204',
      exactSourceCommands: PREFIX_COUNT, inheritedNaturalCommands: INHERITED_COUNT, inheritedDirectedCommands: 0, sourcePrefixReplayed: true, sourceBeforeLastSha256,
      commands: commands.length, sourceBoundaryCount: names.length, expectedBoundaryCount: options.expectedBoundaries ?? names.length, allNamedCaptures: named.length,
      uniqueTransitions: checks.length, aliases: named.filter(r => r.aliasOf !== null).length, fullIndexVerified: true, actualPlayerDeaths: checks.filter(r => r.status === 'DEAD').length,
      sourceContinues, sourceTerminals, actualTreatments, sourceOriginals: originalResources(original), currentOriginals: currentResources(state),
      actualPotionConsumptions: state.natureWalker.bottles.filter(b => b.status === 'CONSUMED').map(b => ({ id: b.id, outcome: b.outcome })),
      lifeAbilityUse: summary.lifeAbilityUse, combatAbilityUse: summary.combatAbilityUse, actualLifeLedgerEntries: state.natureWalker.life.journal.length,
      actualEncounterLedgerEntries: state.natureWalker.encounter.journal.length, actualNewCombatRounds: summary.rounds.length, named, checks };
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
  const options = { sourceDirectory: 'tests/fixtures/nature-walker-v02070', outputDirectory: 'output/qa-0207/sqlite', tag: 'natural' }, seen = new Set();
  const setters = { '--source-directory': x => { options.sourceDirectory = x; }, '--output-directory': x => { options.outputDirectory = x; }, '--tag': x => { options.tag = x; },
    '--resume-directory': x => { options.resumeDirectory = x; }, '--freeze-sha256': x => { assert.match(x, /^[0-9a-f]{64}$/); options.freezeSha256 = x; }, '--expected-boundaries': x => { const n = Number(x); assert(Number.isSafeInteger(n) && n > 0); options.expectedBoundaries = n; } };
  for (let i = 0; i < args.length; i++) { const key = args[i]; assert(!seen.has(key)); seen.add(key); if (key === '--help' || key === '--preflight') { options[key.slice(2)] = true; continue; } assert(setters[key], `Unknown option: ${key}`); assert(args[i + 1] && !args[i + 1].startsWith('--')); setters[key](args[++i]); }
  assert(/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(options.tag)); return options;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = argumentsForSave(process.argv.slice(2));
    if (options.help) console.log('node --expose-gc --max-old-space-size=768 scripts/play/nature-walker-save.mjs --source-directory ACTUAL_CAPTURE_DIR [--preflight] [--resume-directory EXISTING_VERIFICATION_DIR] [--expected-boundaries OBSERVED_N] [--freeze-sha256 REVIEWED_HASH] [--output-directory DIR] [--tag NAME]\nPreflight reads and validates inputs without writes or SQLite. Normal verification atomically records each completed transaction in completed.index.json. Resume replays and rechecks the full captured chain, skips only identical completed SQL transactions, and finishes all remaining ones. The observed index supplies the count; only a fully covered index produces a success summary.');
    else await verifyNatureWalkerBoundaries(options);
  } catch (error) { console.error(error); process.exitCode = 1; }
}
