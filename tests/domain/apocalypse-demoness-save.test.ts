import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateApocalypseDemonessAcquisitionJournal } from '../../src/domain/apocalypse-demoness/index.js';
import { apocalypseDemonessOriginalSnapshot, validateApocalypseDemonessLifeState } from '../../src/domain/apocalypse-demoness/life.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

const ROOT = 'tests/fixtures/apocalypse-demoness-v01990';
const SOURCE = 'tests/fixtures/calamity-demoness-v01770/natural.json';
const PRIOR = 'tests/fixtures/unaging-demoness-v01530/natural.json';
const SOURCE_SHA = 'cffe4b82ef1798b6bd8687b809efd58338692172bf88bebfecc3bd6ededd9932';
const PRIOR_SHA = 'e11152731ee89cb51c4c411864280a9dfb39c8452a33a898d94348f872d8a195';
const PREFIX_SHA = '703861b9fdc6e2c29f5fe173444bb2841f6d46167f7498cef029245b4147404b';
const PREFIX_COUNT = 585;
const expected = {
  "producerSha256": "f5236cc12868c44409760e0c9dba29b8eef95344b360fbecc2bd1cbbd333d174",
  "commands": 854,
  "namedBoundaries": 277,
  "uniqueTransitions": 270,
  "aliases": 7,
  "files": 286,
  "metadataHashes": {
    "natural.json": "baf997edd399bee66132fc7278a741968063dee012e960c9e2fc80ae1f1f4339",
    "summary.json": "f3a1b3b3b17beedea23df2f6cd5480dc57f598600c3e4bf44b2c3cb2c38a789b",
    "commands.jsonl": "aaab574eeba829b2f6a44c1b9148409d7e360dc104741e52895515433de4f704",
    "public.jsonl": "757c32d520a623a790286e619c9f727eba9d0e235f092d255262f5a2be368795",
    "boundaries.index.json": "f57575b15c23efb96ff3b9156020db9dd07003e82c1939eee093575218a3bd19",
    "boundaries.steps.json": "48e648facde69583a32bb112f77bc69f47da2ae001853b37c2ebf7277e0e8c8b",
    "transitions.json": "3cc061f1703f97825b83a86bafacb3b745c8cbd181b081e301bf227d9e6a389b",
    "source-prefix.json": "be14d0dfbb5fa2605010861c921ccb529f8088eb70eb7a13f1f5b79627d04327",
    "capture-integrity.json": "02d039456b32fad6f5da6d53acf992e6990fb7e44ab5cfdc7929801353ffdede"
  },
  "representatives": [
    {
      "name": "exact-original585-living-source",
      "step": 585,
      "intent": {
        "type": "ACTION",
        "action": "WORK"
      },
      "status": "ACTIVE",
      "beforeSha256": "b741b79a3ebc2aeeed4c1ad5939e9726238423a51edd5b53cc414d27296a6e9f",
      "finalSha256": "37e0cb5a31cdc0be703883c7187943525512c119046fe84a0e1a59a9de8b5d09"
    },
    {
      "name": "step-587-event_choice",
      "step": 587,
      "intent": {
        "type": "EVENT_CHOICE",
        "eventInstanceId": "witch-rebuild-natural:LIFE-CARE-01:587:925",
        "choiceId": "PAY"
      },
      "status": "ACTIVE",
      "beforeSha256": "113d37b07cda5ce1b8f49a7de4e026b4072976e25caa910f4f6647398c6abd64",
      "finalSha256": "22dd19e22dadd9fa4723b8c69a6ee287a0361e2259b6e47b075b0730099e1177"
    },
    {
      "name": "consume-apocalypse-demoness-potion-1",
      "step": 623,
      "intent": {
        "type": "APOCALYPSE_DEMONESS",
        "command": {
          "type": "CONSUME",
          "bottleId": "apocalypse-demoness-potion-1",
          "confirmed": true
        }
      },
      "status": "ACTIVE",
      "beforeSha256": "2b31de4ac81dee12f4c171db3e2c0b97b2ae7eb6e9619ac17b81f74b8c1afb68",
      "finalSha256": "c879a515fd2a56265673ffb59b31144af51ca3a489f41f971137d6d3de0200e3"
    },
    {
      "name": "consume-apocalypse-demoness-potion-6",
      "step": 781,
      "intent": {
        "type": "APOCALYPSE_DEMONESS",
        "command": {
          "type": "CONSUME",
          "bottleId": "apocalypse-demoness-potion-6",
          "confirmed": true
        }
      },
      "status": "ACTIVE",
      "beforeSha256": "11dd51f613c436e3b1289430b29dd3b0500a825a6f1bad2d62f0f2411b5044c5",
      "finalSha256": "6e270de14fe54ab380c87794ead9f72ce78b1ecae51f19fad5cc79f9bea41759"
    },
    {
      "name": "pulse-containment-apply_pulse",
      "step": 799,
      "intent": {
        "type": "APOCALYPSE_DEMONESS",
        "command": {
          "type": "APPLY_PULSE"
        }
      },
      "status": "ACTIVE",
      "beforeSha256": "0d7f17f37cc4a2a2758ad6a5cab390a027a68cc56e1b1198456fb834ff71a57f",
      "finalSha256": "0bb31e3d3a535ea2e286798d3e0c2f7bce59e897199c4a91b90572f03dbbfecf"
    },
    {
      "name": "mirror-buffer-apply_load",
      "step": 821,
      "intent": {
        "type": "APOCALYPSE_DEMONESS",
        "command": {
          "type": "APPLY_LOAD"
        }
      },
      "status": "ACTIVE",
      "beforeSha256": "ce9305376fa22e711114b06cfc50204b4695795856805bcc6027473e0fc2bba1",
      "finalSha256": "284436f47ce502bb9fd9ed08a711a96140be194a427c46bd7b00fc114b5d6964"
    },
    {
      "name": "combat-round-1",
      "step": 850,
      "intent": {
        "type": "COMBAT_ROUND",
        "stance": "CONTROL"
      },
      "status": "ACTIVE",
      "beforeSha256": "dd6272e99679218881cd4bb2264576afce4f3a98ea61b864dbf61c44a3c5c83d",
      "finalSha256": "336ce2adf1b6e874fe1f1d6831bef73e2007e5a1538050670a4062dd00502ce6"
    },
    {
      "name": "actual-ordinary-encounter-exit",
      "step": 853,
      "intent": {
        "type": "COMBAT_ROUND",
        "stance": "CONTROL"
      },
      "status": "ACTIVE",
      "beforeSha256": "d48d0661cae17c989eda51702064c1061c9975e90b7aacb32e575c3084846f89",
      "finalSha256": "e30c01fb648166c74d2836a277b4246302cb03cfa418f1329bba5ec149c9656b"
    },
    {
      "name": "actual-work-after-living-exit",
      "step": 854,
      "intent": {
        "type": "ACTION",
        "action": "WORK"
      },
      "status": "ACTIVE",
      "beforeSha256": "e30c01fb648166c74d2836a277b4246302cb03cfa418f1329bba5ec149c9656b",
      "finalSha256": "5ba5f97ac4c532f14663bca0d90bda75a25516ced74b9f9ab3edea655213b92f"
    }
  ]
};
const archivedRepresentatives = new Set([
  'consume-apocalypse-demoness-potion-6', 'pulse-containment-apply_pulse', 'mirror-buffer-apply_load',
]);
interface CaptureIntegrity {
  naturalSha256: string; producerSha256: string; commandsSha256: string; publicSha256: string;
  boundaryIndexSha256: string; boundaryStepsSha256: string; transitionsSha256: string;
  summarySha256: string; sourcePrefixSha256: string; files: Record<string, string>;
}
interface CaptureTransition { key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number }
const integrity = JSON.parse(readFileSync(`${ROOT}/capture-integrity.json`, 'utf8')) as CaptureIntegrity;
const transitions = JSON.parse(readFileSync(`${ROOT}/transitions.json`, 'utf8')) as CaptureTransition[];
const boundaries = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
const steps = JSON.parse(readFileSync(`${ROOT}/boundaries.steps.json`, 'utf8')) as Record<string, number>;
const entry = <T>(key: string): T => readObjectEntry<T>(`${ROOT}/natural.json`, key);
const source = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);
const snapshots = entry<Record<string, string>>('snapshots');
const commands = entry<SliceIntent[]>('commands');
const captureValueHash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const same = (actual: unknown, wanted: unknown) => expect(captureValueHash(actual)).toBe(captureValueHash(wanted));
const current = (value: unknown): SliceState => {
  const s = migrateSliceState(value); expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]); return s;
};
function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${ROOT}/${filename}`;
}
async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256'); for await (const chunk of createReadStream(path)) digest.update(chunk); return digest.digest('hex');
}
function boundaryFile(filename: string) {
  const path = capturePath(filename);
  return { count: readObjectEntry<number>(path, 'commandCount'), before: current(readObjectEntry(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: current(readObjectEntry(path, 'final')) };
}
function publicControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent)).toBe(true); const view = projectSliceState(state);
  if (intent.type === 'APOCALYPSE_DEMONESS') {
    const offered = view.apocalypseDemoness.actions.find(a => stableStringify(a.command) === stableStringify(intent.command));
    expect(offered).toBeDefined(); expect(offered!.enabled, offered!.reason ?? '').toBe(true);
  } else if (intent.type === 'ACTION') { expect(['WORK', 'REST']).toContain(intent.action); expect(view.canAct).toBe(true); }
  else if (intent.type === 'EVENT_CHOICE') { expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId); expect(view.activeEvent?.choices.find(c => c.id === intent.choiceId)?.enabled).toBe(true); }
  else if (intent.type === 'COMBAT_ROUND') { expect(intent.stance).toBe('CONTROL'); expect(view.combat?.stances.some(s => s.id === intent.stance)).toBe(true); }
  else throw new Error(`Unexpected representative command: ${JSON.stringify(intent)}`);
}

// The historical apocalypse-demoness-save.mjs capture verifier covers every
// named alias and unique transition. Current Vitest pins all immutable files,
// replays six still-legal representatives, and strictly imports/reopens the
// three archived fourth-plus-stock stage transitions without enabling them.
describe('Apocalypse Demoness all-member immutable capture integrity and representative SQLite recovery', () => {
  it('pins every member, exact585 source, natural487 ancestry, frozen producer and complete unique/alias index', async () => {
    expect(await captureFileHash(SOURCE)).toBe(SOURCE_SHA); expect(await captureFileHash(PRIOR)).toBe(PRIOR_SHA);
    expect(await captureFileHash('scripts/play/apocalypse-demoness-stage.mjs')).toBe(expected.producerSha256);
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
      // Captured196 is immutable historical input; migrated outputs use CURRENT.
      expect(readObjectEntry(capturePath(filename), 'schemaVersion')).toBe(196);
      expect(readObjectEntry(capturePath(filename), 'contentVersion')).toBe('apocalypse-demoness-v196');
    }
    const prefix = capturePath('source-prefix.json');
    expect(readObjectEntry(prefix, 'source')).toBe(SOURCE); expect(readObjectEntry(prefix, 'sourceSha256')).toBe(SOURCE_SHA);
    expect(readObjectEntry(prefix, 'prefixCount')).toBe(PREFIX_COUNT); expect(readObjectEntry(prefix, 'inheritedDirectedPrefix')).toBe(false);
    same(readObjectEntry(prefix, 'rawInitial'), source('initial')); same(readObjectEntry(prefix, 'rawFinal'), source('final'));
    same(readObjectEntry(prefix, 'commands'), source('commands')); expect(readObjectEntry(prefix, 'rawCommandsSha256')).toBe(PREFIX_SHA);
    expect(source<SliceState>('final')).toMatchObject({ schemaVersion: 174, contentVersion: 'calamity-demoness-v174' });
    same(current(source('final')), current(entry('prefixFinal'))); same(commands.slice(0, 487), readObjectEntry(PRIOR, 'commands'));
    const representativeSteps = expected.representatives.map(row => { expect(boundaries[row.name], row.name).toBeDefined(); expect(steps[row.name]).toBe(row.step); return row.step; });
    expect(new Set(representativeSteps).size).toBe(expected.representatives.length); expect(representativeSteps.length).toBeLessThan(transitions.length);
  }, 240_000);

  it.each(expected.representatives.map(observed => ({ ...observed, verification: archivedRepresentatives.has(observed.name)
    ? 'retains its historical receipt and strict SQLite reopen while live resubmission stays closed'
    : 'survives actual rollback, reopen, commit, idempotent retry and stale rejection' })))('$name $verification', async observed => {
    const filename = boundaries[observed.name]!;
    const path = capturePath(filename), originalHash = await captureFileHash(path); expect(originalHash).toBe(integrity.files[filename]);
    const rawBefore = readObjectEntry<SliceState>(path, 'beforeLast'), rawFinal = readObjectEntry<SliceState>(path, 'final');
    for (const raw of [rawBefore, rawFinal]) expect([raw.schemaVersion, raw.contentVersion]).toEqual([196, 'apocalypse-demoness-v196']);
    const save = boundaryFile(filename); expect(save.count).toBe(observed.step); same(save.intent, commands[save.count - 1]); same(save.intent, observed.intent);
    expect(captureValueHash(rawBefore)).toBe(observed.beforeSha256); expect(captureValueHash(rawFinal)).toBe(observed.finalSha256);
    expect(save.final.status).toBe(observed.status); expect(save.final.revision).toBe(save.before.revision + 1);
    if (archivedRepresentatives.has(observed.name)) {
      assertArchivedTransition(save.before, save.intent, save.final);
      exerciseArchivedSqlite(save.before, save.intent, save.final, `apocalypse-demoness199:${save.count}`);
    } else {
      if (save.count > PREFIX_COUNT) publicControl(save.before, save.intent); else same(save.final, current(source('final')));
      exerciseSqlite(save.before, save.intent, save.final, `apocalypse-demoness199:${save.count}`);
    }
    expect(await captureFileHash(path)).toBe(originalHash);
  }, 80_000);
});

/** Strict journal compatibility admits original fourth-plus captures as history,
 * never as new public actions or as three-original recovery carriers. */
function assertArchivedTransition(before: SliceState, intent: SliceIntent, final: SliceState): void {
  if (intent.type !== 'APOCALYPSE_DEMONESS') throw new Error('Only the three named archived stage actions use this path.');
  expect(validateSlicePayload(intent)).toBe(true);
  for (const state of [before, final]) {
    assertValidSliceState(state); expect(validateApocalypseDemonessAcquisitionJournal(state)).toBe(true);
    expect(validateApocalypseDemonessLifeState(state)).toBe(true);
    expect(state.apocalypseDemoness.bottles).toHaveLength(6);
    expect(state.apocalypseDemoness.bottles.slice(3).every(b => b.recovery === undefined)).toBe(true);
    expect(projectSliceState(state).apocalypseDemoness.actions).toEqual([]);
    const hash = captureValueHash(state);
    expect(() => applySliceIntent(state, intent)).toThrow(); expect(captureValueHash(state)).toBe(hash);
  }
  same(final.apocalypseDemoness.sourceHistory, before.apocalypseDemoness.sourceHistory);
  same(final.apocalypseDemoness.sourceScene, before.apocalypseDemoness.sourceScene);
  if (intent.command.type === 'CONSUME') {
    expect(intent.command.bottleId).toBe('apocalypse-demoness-potion-6');
    const receipt = final.apocalypseDemoness.acquisitionJournal.at(-1)!;
    expect(receipt.revision).toBe(before.revision); expect(receipt.week).toBe(before.week); same(receipt.date, before.date);
    same({ type: 'APOCALYPSE_DEMONESS', command: receipt.command }, intent);
    same(final.apocalypseDemoness.acquisitionJournal.slice(0, -1), before.apocalypseDemoness.acquisitionJournal);
    expect([receipt.cursorBefore, receipt.cursorAfter]).toEqual([before.random.cursor, final.random.cursor]);
  } else {
    expect(['APPLY_PULSE', 'APPLY_LOAD']).toContain(intent.command.type);
    const receipt = final.apocalypseDemoness.life.journal.at(-1)!;
    expect(receipt.revision).toBe(before.revision); expect(receipt.week).toBe(before.week); same(receipt.date, before.date);
    same({ type: 'APOCALYPSE_DEMONESS', command: receipt.command }, intent);
    same(final.apocalypseDemoness.life.journal.slice(0, -1), before.apocalypseDemoness.life.journal);
    same(final.apocalypseDemoness.acquisitionJournal, before.apocalypseDemoness.acquisitionJournal);
    expect([receipt.randomCursor, receipt.randomAfter ?? receipt.randomCursor]).toEqual([before.random.cursor, final.random.cursor]);
    same(receipt.originalsBefore, apocalypseDemonessOriginalSnapshot(before)); same(receipt.originalsAfter, apocalypseDemonessOriginalSnapshot(final));
  }
}

/** Import each immutable endpoint as a snapshot. This does not execute the
 * forbidden historical command or manufacture a successful intent receipt. */
function exerciseArchivedSqlite(before: SliceState, intent: SliceIntent, final: SliceState, intentId: string): void {
  for (const [endpoint, state] of [['before', before], ['final', final]] as const) {
    const hash = captureValueHash(state), expectedPublic = projectSliceState(state);
    const directory = mkdtempSync(join(tmpdir(), 'lotm-apocalypse-demoness-archived-save-')), database = join(directory, 'boundary.sqlite');
    const envelope = { intentId: `${intentId}:${endpoint}`, runId: state.runId, expectedRevision: state.revision, payload: intent };
    let app: SqliteSliceStore | undefined;
    try {
      app = new SqliteSliceStore(database);
      app.repository.transaction(() => {
        app!.repository.put({ state, updatedAt: '2026-10-15T00:00:00.000Z' });
        app!.repository.selectRun(state.runId);
      });
      const originalRows = storedRows(database);
      for (let attempt = 0; attempt < 2; attempt++) {
        app.close(); app = undefined; app = new SqliteSliceStore(database);
        sameStoredRows(database, originalRows); same(app.repository.get(state.runId)!.state, state);
        const bootstrap = app.getBootstrap(); expect(bootstrap.ok).toBe(true);
        if (!bootstrap.ok) throw new Error(JSON.stringify(bootstrap.error));
        same(bootstrap.value.activeState, expectedPublic); expect(app.repository.activeRun()).toBe(state.runId);
        const rejected = app.submitIntent(envelope);
        expect(rejected.ok).toBe(false); if (rejected.ok) throw new Error('An archived stage action unexpectedly committed');
        expect(rejected.error.code).toBe('ACTION_UNAVAILABLE'); expect(app.repository.receipt(envelope.intentId)).toBeNull();
        same(app.repository.get(state.runId)!.state, state); sameStoredRows(database, originalRows);
      }
      const staleId = `${envelope.intentId}:stale`;
      const stale = app.submitIntent({ ...envelope, intentId: staleId, expectedRevision: state.revision - 1 });
      expect(stale.ok).toBe(false); if (stale.ok) throw new Error('A stale archived action unexpectedly committed');
      expect(stale.error.code).toBe('REVISION_CONFLICT'); expect(app.repository.receipt(staleId)).toBeNull();
      app.close(); app = undefined; app = new SqliteSliceStore(database);
      same(app.repository.get(state.runId)!.state, state); sameStoredRows(database, originalRows);
      expect(app.repository.receipt(envelope.intentId)).toBeNull(); expect(app.repository.receipt(staleId)).toBeNull();
      expect(existsSync(`${database}.sealed`)).toBe(false); expect(captureValueHash(state)).toBe(hash);
    } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
  }
}

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
  const directory = mkdtempSync(join(tmpdir(), 'lotm-apocalypse-demoness-representative-save-')), database = join(directory, 'boundary.sqlite');
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
      const blocked = app.submitIntent({ intentId: `${intentId}:sealed`, runId: final.runId, expectedRevision: final.revision,
        payload: { type: 'ACTION', action: 'REST' } });
      expect(blocked.ok).toBe(false); if (blocked.ok) throw new Error('A sealed original death accepted a new action');
      expect(blocked.error.code).toBe('ARCHIVED'); expect(app.repository.receipt(`${intentId}:sealed`)).toBeNull();
      same(app.repository.get(final.runId)!.state, final); sameStoredRows(database, committedRows);
      expect(readFileSync(`${database}.sealed`).equals(sealed), 'The actual observed death marker remains exact').toBe(true);
    } else expect(existsSync(`${database}.sealed`), 'A living representative never creates a death seal').toBe(false);
    expect(captureValueHash(before)).toBe(beforeHash); expect(captureValueHash(final)).toBe(finalHash);
  } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
}
