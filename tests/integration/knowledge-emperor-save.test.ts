import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { KNOWLEDGE_CAPTURE as ROOT, KNOWLEDGE_SOURCE as SOURCE, KNOWLEDGE_PRIOR as PRIOR,
  KNOWLEDGE_SOURCE_SHA as SOURCE_SHA, KNOWLEDGE_PRIOR_SHA as PRIOR_SHA,
  KNOWLEDGE_PREFIX_COUNT as PREFIX_COUNT, KNOWLEDGE_PREFIX_SHA as PREFIX_SHA,
  knowledgeCaptureExpected as expected, knowledgeBoundaries as boundaries, knowledgeSteps as steps,
  knowledgeEntry as entry, knowledgeSnapshots as snapshots, knowledgeCapturePath as capturePath,
  currentKnowledgeCapture as current, knowledgeBoundary } from '../helpers/knowledge-emperor-capture.js';

interface CaptureIntegrity {
  naturalSha256: string; producerSha256: string; commandsSha256: string; publicSha256: string;
  boundaryIndexSha256: string; boundaryStepsSha256: string; transitionsSha256: string;
  summarySha256: string; sourcePrefixSha256: string; files: Record<string, string>;
}
interface CaptureTransition { key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number }
const integrity = JSON.parse(readFileSync(`${ROOT}/capture-integrity.json`, 'utf8')) as CaptureIntegrity;
const transitions = JSON.parse(readFileSync(`${ROOT}/transitions.json`, 'utf8')) as CaptureTransition[];
const source = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);
const commands = entry<SliceIntent[]>('commands');
const captureValueHash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const same = (actual: unknown, wanted: unknown) => expect(captureValueHash(actual)).toBe(captureValueHash(wanted));
async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256'); for await (const chunk of createReadStream(path)) digest.update(chunk); return digest.digest('hex');
}
const representatives: { name: string; step: number; intent: SliceIntent; status: SliceState['status'] }[] = [
  { name: 'exact-original651-living-source', step: 651, intent: { type: 'ACTION', action: 'WORK' }, status: 'ACTIVE' },
  { name: 'step-654-event_choice', step: 654, intent: { type: 'EVENT_CHOICE', eventInstanceId: 'pryer-rebuild-natural:LIFE-CARE-01:654:1002', choiceId: 'PAY' }, status: 'ACTIVE' },
  { name: 'paid500-guidance-freezes-eight-roots', step: 664, intent: { type: 'KNOWLEDGE_EMPEROR', command: { type: 'LEARN_GUIDANCE' } }, status: 'ACTIVE' },
  { name: 'consume-knowledge-emperor-potion-1', step: 692, intent: { type: 'KNOWLEDGE_EMPEROR', command: { type: 'CONSUME', bottleId: 'knowledge-emperor-potion-1', confirmed: true } }, status: 'ACTIVE' },
  { name: 'consume-knowledge-emperor-potion-3', step: 760, intent: { type: 'KNOWLEDGE_EMPEROR', command: { type: 'CONSUME', bottleId: 'knowledge-emperor-potion-3', confirmed: true } }, status: 'ACTIVE' },
  { name: 'knowledge-power-apply_power', step: 775, intent: { type: 'KNOWLEDGE_EMPEROR', command: { type: 'APPLY_POWER', caseId: 'knowledge-power' } }, status: 'ACTIVE' },
  { name: 'power-knowledge-verify_reaction', step: 797, intent: { type: 'KNOWLEDGE_EMPEROR', command: { type: 'VERIFY_REACTION', caseId: 'power-knowledge' } }, status: 'ACTIVE' },
  { name: 'independent-optional-fight', step: 830, intent: { type: 'KNOWLEDGE_EMPEROR', command: { type: 'ENCOUNTER_FIGHT' } }, status: 'ACTIVE' },
  { name: 'combat-round-1', step: 831, intent: { type: 'COMBAT_ROUND', stance: 'CONTROL' }, status: 'DEAD' },
];
function publicControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent)).toBe(true); const view = projectSliceState(state);
  if (intent.type === 'KNOWLEDGE_EMPEROR') {
    const offered = view.knowledgeEmperor.actions.find(a => stableStringify(a.command) === stableStringify(intent.command));
    expect(offered).toBeDefined(); expect(offered!.enabled, offered!.reason ?? '').toBe(true);
  } else if (intent.type === 'ACTION') { expect(['WORK', 'REST']).toContain(intent.action); expect(view.canAct).toBe(true); }
  else if (intent.type === 'EVENT_CHOICE') { expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId); expect(view.activeEvent?.choices.find(c => c.id === intent.choiceId)?.enabled).toBe(true); }
  else if (intent.type === 'COMBAT_ROUND') { expect(intent.stance).toBe('CONTROL'); expect(view.combat?.stances.some(s => s.id === intent.stance)).toBe(true); }
  else throw new Error(`Unexpected representative command: ${JSON.stringify(intent)}`);
}

// Every immutable file is checked, but only nine literal observed transitions
// open SQLite here. The separate full-index verifier owns all 184 named / 181
// unique transactions. This test neither regenerates nor repairs the capture.
describe('Knowledge Emperor immutable natural capture and representative SQLite recovery', () => {
  it('pins all 198 files, original 651-command source, natural 507-command ancestry and 184/181 aliases', async () => {
    expect(await captureFileHash(SOURCE)).toBe(SOURCE_SHA); expect(await captureFileHash(PRIOR)).toBe(PRIOR_SHA);
    expect(await captureFileHash('scripts/play/knowledge-emperor-stage.mjs')).toBe(expected.producerSha256);
    for (const [name, sha256] of Object.entries(expected.metadataHashes)) {
      const path = join(ROOT, name); expect(realpathSync(path), name).toBe(resolve(path));
      expect(sha256, name).toMatch(/^[0-9a-f]{64}$/); expect(await captureFileHash(path), name).toBe(sha256);
    }
    expect(integrity).toMatchObject({ producerSha256: expected.producerSha256,
      naturalSha256: expected.metadataHashes['natural.json'], commandsSha256: expected.metadataHashes['commands.jsonl'], publicSha256: expected.metadataHashes['public.jsonl'],
      sourcePrefixSha256: expected.metadataHashes['source-prefix.json'], boundaryIndexSha256: expected.metadataHashes['boundaries.index.json'],
      boundaryStepsSha256: expected.metadataHashes['boundaries.steps.json'], transitionsSha256: expected.metadataHashes['transitions.json'], summarySha256: expected.metadataHashes['summary.json'] });
    expect(commands).toHaveLength(expected.commands); expect(Object.keys(boundaries)).toHaveLength(expected.namedBoundaries);
    same(Object.keys(steps), Object.keys(boundaries)); expect(transitions).toHaveLength(expected.uniqueTransitions);
    expect(transitions).toHaveLength(expected.commands - PREFIX_COUNT + 1);
    const uniqueFiles = [...new Set(Object.values(boundaries))]; expect(uniqueFiles).toHaveLength(expected.uniqueTransitions);
    expect(uniqueFiles).toEqual(transitions.map(r => r.file)); expect(new Set(transitions.map(r => r.file)).size).toBe(expected.uniqueTransitions);
    const members = [...new Set([...uniqueFiles, ...Object.values(snapshots)])].sort();
    expect(Object.keys(integrity.files).sort()).toEqual(members);
    expect(readdirSync(ROOT).sort()).toEqual([...Object.keys(expected.metadataHashes), ...members].sort());
    expect(members.length + Object.keys(expected.metadataHashes).length).toBe(expected.files);
    for (const filename of members) {
      const path = capturePath(filename); expect(realpathSync(path), filename).toBe(resolve(path));
      expect(integrity.files[filename], filename).toMatch(/^[0-9a-f]{64}$/); expect(await captureFileHash(path), filename).toBe(integrity.files[filename]);
    }
    const initialRevision = entry<SliceState>('initial').revision, byStep = new Map<number, CaptureTransition>();
    expect(initialRevision).toBe(1);
    for (const [index, transition] of transitions.entries()) {
      const step = PREFIX_COUNT + index;
      expect(Object.keys(transition).sort()).toEqual(['key', 'file', 'commandIndex', 'beforeRevision', 'afterRevision'].sort());
      expect(transition.commandIndex).toBe(step); expect(transition.beforeRevision).toBe(initialRevision + step - 1); expect(transition.afterRevision).toBe(initialRevision + step);
      expect(boundaries[transition.key]).toBe(transition.file); expect(steps[transition.key]).toBe(step); expect(byStep.has(step)).toBe(false); byStep.set(step, transition);
    }
    const firstNames = new Map<number, string>(); let aliases = 0;
    for (const [name, filename] of Object.entries(boundaries)) {
      const step = steps[name]!, transition = byStep.get(step); expect(transition, name).toBeDefined(); expect(filename).toBe(transition!.file);
      if (firstNames.has(step)) aliases++; else { expect(name).toBe(transition!.key); firstNames.set(step, name); }
    }
    expect(firstNames.size).toBe(expected.uniqueTransitions); expect(aliases).toBe(expected.aliases);
    for (const filename of Object.values(snapshots)) {
      expect(readObjectEntry(capturePath(filename), 'schemaVersion')).toBe(197);
      expect(readObjectEntry(capturePath(filename), 'contentVersion')).toBe('knowledge-emperor-v197');
    }
    const prefix = capturePath('source-prefix.json');
    expect(readObjectEntry(prefix, 'source')).toBe(SOURCE); expect(readObjectEntry(prefix, 'sourceSha256')).toBe(SOURCE_SHA);
    expect(readObjectEntry(prefix, 'prefixCount')).toBe(PREFIX_COUNT); expect(readObjectEntry(prefix, 'inheritedDirectedPrefix')).toBe(false);
    same(readObjectEntry(prefix, 'rawInitial'), source('initial')); same(readObjectEntry(prefix, 'rawFinal'), source('final'));
    same(readObjectEntry(prefix, 'commands'), source('commands')); expect(readObjectEntry(prefix, 'rawCommandsSha256')).toBe(PREFIX_SHA);
    expect(source<SliceState>('final')).toMatchObject({ schemaVersion: 175, contentVersion: 'sage-v175' });
    same(current(source('final')), current(entry('prefixFinal'))); same(commands.slice(0, 507), readObjectEntry(PRIOR, 'commands'));
    same(commands.slice(0, PREFIX_COUNT), source('commands'));
    expect(entry('stage')).toBe('ACTUAL_TERMINAL_WITH_NATURAL651_HISTORY'); expect(entry('prefixVerified')).toBe(true);
    const final = current(entry('final'));
    expect(final).toMatchObject({ status: 'DEAD', revision: 832, week: 194, health: 0, mind: 98, spirituality: 112, cash: 615, actionsRemaining: 1, combat: null });
    expect(final.lastCombatRound).toMatchObject({ round: 1, consequenceDomain: 'BODY', consequenceRoll: 97 });
    expect(final.knowledgeEmperor.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', round: 1, exitMetres: 0, playerEnergyPaid: 0 });
    expect(boundaries['actual-ordinary-encounter-exit']).toBeUndefined(); expect(boundaries['actual-work-after-living-exit']).toBeUndefined();
    const representativeSteps = representatives.map(row => { expect(boundaries[row.name], row.name).toBeDefined(); expect(steps[row.name]).toBe(row.step); return row.step; });
    expect(new Set(representativeSteps).size).toBe(representatives.length); expect(representatives.length).toBeLessThan(transitions.length);
  }, 240_000);

  it.each(representatives)('$name retains actual rollback, reopen, commit, idempotent retry and stale rejection', async observed => {
    const save = knowledgeBoundary(observed.name), originalHash = await captureFileHash(save.path);
    expect(originalHash).toBe(integrity.files[save.filename]);
    expect(save.count).toBe(observed.step); same(save.intent, commands[save.count - 1]); same(save.intent, observed.intent);
    expect(save.final.status).toBe(observed.status); expect(save.final.revision).toBe(save.before.revision + 1);
    if (save.count > PREFIX_COUNT) publicControl(save.before, save.intent); else same(save.final, current(source('final')));
    exerciseSqlite(save.before, save.intent, save.final, `knowledge-emperor200:${save.count}`);
    expect(await captureFileHash(save.path)).toBe(originalHash);
  }, 80_000);
});
// These bytes include current and rolling-backup snapshots, timestamps,
// receipts and active-run metadata. State equality alone cannot prove rollback.
function storedRows(database: string): Buffer {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    return Buffer.from(JSON.stringify({
      runs: db.prepare('SELECT id,current_json,backup_json,terminal,updated_at FROM slice_runs ORDER BY id').all(),
      receipts: db.prepare('SELECT id,fingerprint,receipt_json FROM slice_receipts ORDER BY id').all(),
      meta: db.prepare('SELECT key,value FROM slice_meta ORDER BY key').all(),
    }));
  } finally { db.close(); }
}
function sameStoredRows(database: string, expectedRows: Buffer): void {
  const actual = storedRows(database);
  expect(actual.length).toBe(expectedRows.length);
  expect(createHash('sha256').update(actual).digest('hex')).toBe(createHash('sha256').update(expectedRows).digest('hex'));
  expect(actual.equals(expectedRows), 'Exact persisted row bytes, including backup and receipt').toBe(true);
}

function exerciseSqlite(before: SliceState, intent: SliceIntent, final: SliceState, intentId: string): void {
  expect(before.status).toBe('ACTIVE'); expect(final.revision).toBe(before.revision + 1); expect(final.runId).toBe(before.runId);
  assertValidSliceState(before); assertValidSliceState(final);
  const beforeHash = captureValueHash(before), finalHash = captureValueHash(final);
  const directory = mkdtempSync(join(tmpdir(), 'lotm-knowledge-emperor-representative-save-')), database = join(directory, 'boundary.sqlite');
  const envelope = { intentId, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const expectedPublic = projectSliceState(final);
  let app: SqliteSliceStore | undefined, fail = false, injectedAfterApply = 0;
  try {
    app = new SqliteSliceStore(database, { beforeWrite: () => {
      if (!fail) return;
      same(app!.repository.get(final.runId)!.state, final);
      const receipt = app!.repository.receipt(intentId);
      expect(receipt).not.toBeNull(); expect(receipt!.fingerprint).toBe(stableStringify(envelope));
      same(receipt!.receipt.state, expectedPublic); expect(app!.repository.activeRun()).toBe(before.runId);
      injectedAfterApply++;
      throw new Error('injected representative write failure after complete actual intent and receipt');
    } });
    app.repository.transaction(() => {
      app!.repository.put({ state: before, updatedAt: '2026-10-15T00:00:00.000Z' });
      app!.repository.selectRun(before.runId);
    });
    const originalRows = storedRows(database);
    fail = true;
    const rejected = app.submitIntent(envelope);
    expect(rejected.ok).toBe(false); if (rejected.ok) throw new Error('Injected rollback unexpectedly committed');
    expect(rejected.error.code).toBe('SAVE_FAILED'); expect(injectedAfterApply).toBe(1);
    same(app.repository.get(before.runId)!.state, before); expect(app.repository.receipt(intentId)).toBeNull();
    sameStoredRows(database, originalRows); expect(existsSync(`${database}.sealed`)).toBe(false);
    app.close(); app = undefined; app = new SqliteSliceStore(database);
    sameStoredRows(database, originalRows); same(app.repository.get(before.runId)!.state, before);
    expect(app.repository.receipt(intentId)).toBeNull(); expect(app.repository.activeRun()).toBe(before.runId);

    const committed = app.submitIntent(envelope);
    expect(committed.ok).toBe(true); if (!committed.ok) throw new Error(JSON.stringify(committed.error));
    expect(committed.value.replayed).toBe(false); same(committed.value.state, expectedPublic);
    same(app.repository.get(final.runId)!.state, final); same(app.repository.receipt(intentId)!.receipt, committed.value);
    const committedRows = storedRows(database);
    app.close(); app = undefined; app = new SqliteSliceStore(database);
    sameStoredRows(database, committedRows); same(app.repository.get(final.runId)!.state, final);
    same(projectSliceState(app.repository.get(final.runId)!.state), expectedPublic); expect(app.repository.activeRun()).toBe(final.runId);
    const retried = app.submitIntent(envelope);
    expect(retried.ok).toBe(true); if (!retried.ok) throw new Error(JSON.stringify(retried.error));
    same(retried.value, { ...committed.value, replayed: true }); same(app.repository.get(final.runId)!.state, final);
    sameStoredRows(database, committedRows);
    const staleId = `${intentId}:stale`;
    const stale = app.submitIntent({ ...envelope, intentId: staleId });
    expect(stale.ok).toBe(false); if (stale.ok) throw new Error('A stale representative unexpectedly committed');
    expect(stale.error.code).toBe('REVISION_CONFLICT'); expect(app.repository.receipt(staleId)).toBeNull();
    same(app.repository.get(final.runId)!.state, final); sameStoredRows(database, committedRows);
    app.close(); app = undefined; app = new SqliteSliceStore(database);
    sameStoredRows(database, committedRows); same(app.repository.get(final.runId)!.state, final);
    expect(app.repository.receipt(staleId)).toBeNull();
    if (final.status === 'DEAD') {
      const sealed = readFileSync(`${database}.sealed`);
      expect(JSON.parse(sealed.toString('utf8'))).toEqual([final.runId]); expect(expectedPublic.canAct).toBe(false);
      const bootstrap = app.getBootstrap(); expect(bootstrap.ok).toBe(true);
      if (!bootstrap.ok) throw new Error(JSON.stringify(bootstrap.error));
      expect(bootstrap.value.runs).toHaveLength(1); expect(bootstrap.value.runs[0]).toMatchObject({ runId: final.runId, status: 'DEAD' });
      same(bootstrap.value.activeState, expectedPublic);
      const forbidden: SliceIntent[] = [{ type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }];
      for (const [index, payload] of forbidden.entries()) {
        const blockedId = `${intentId}:sealed:${index}`;
        const blocked = app.submitIntent({ intentId: blockedId, runId: final.runId, expectedRevision: final.revision, payload });
        expect(blocked.ok).toBe(false); if (blocked.ok) throw new Error('A sealed original death accepted a new action');
        expect(blocked.error.code).toBe('ARCHIVED'); expect(app.repository.receipt(blockedId)).toBeNull();
        same(app.repository.get(final.runId)!.state, final); sameStoredRows(database, committedRows);
      }
      expect(readFileSync(`${database}.sealed`).equals(sealed), 'The actual observed death marker remains exact').toBe(true);
    } else expect(existsSync(`${database}.sealed`), 'A living representative never creates a death seal').toBe(false);
    expect(captureValueHash(before)).toBe(beforeHash); expect(captureValueHash(final)).toBe(finalHash);
  } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
}
