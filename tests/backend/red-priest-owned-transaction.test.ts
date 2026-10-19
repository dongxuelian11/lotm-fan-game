/** Real Conqueror history enters through migration and ordinary Red Priest
 * guidance. Instrumentation observes ownership or injects storage failures;
 * it never supplies a trusted head, successful roll, or edited winning save. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SqliteSliceStore } from "../../src/persistence/slice-store.js";
import { summarizeSlice, type SliceRepository, type StoredSlice } from "../../src/application/slice-application.js";
import type { OwnedRepositoryDraft } from "../../src/application/slice-owned-runtime.js";
import { applySliceIntent, projectSliceState } from "../../src/domain/slice/index.js";
import { migrateSliceState } from "../../src/domain/slice/migration.js";
import type { SliceIntent, SliceProjection, SliceState } from "../../src/domain/slice/types.js";
import { openRedPriestRuntimeSession } from "../../src/domain/red-priest/owned-session.js";
import { RED_PRIEST_CHARACTERISTIC_IDS, RED_PRIEST_MATERIAL_LOCATIONS } from "../../src/domain/red-priest/material-content.js";
import { stableStringify } from "../../src/domain/canonical.js";
import type { SliceEnvelope, SliceResult } from "../../src/shared/slice-contracts.js";
import { readObjectEntry } from "../helpers/read-object-entry.js";

const observed = vi.hoisted(() => ({
  opens: 0, prepares: 0, commits: 0, backups: 0, failBackup: false,
  revisions: [] as (() => number)[],
}));
vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, copyFileSync: (...args: Parameters<typeof actual.copyFileSync>) => {
    if (String(args[1]).endsWith(".bak.tmp")) {
      observed.backups++;
      if (observed.failBackup) throw Error("Injected backup failure");
    }
    return actual.copyFileSync(...args);
  } };
});
vi.mock("../../src/domain/red-priest/owned-session.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/domain/red-priest/owned-session.js")>();
  return { ...actual, openRedPriestRuntimeSession: (input: unknown) => {
    const session = actual.openRedPriestRuntimeSession(input);
    observed.opens++;
    observed.revisions.push(() => session.inspect().revision);
    return Object.freeze({ ...session,
      prepare: (...args: Parameters<typeof session.prepare>) => {
        observed.prepares++;
        return session.prepare(...args);
      },
      commit: (...args: Parameters<typeof session.commit>) => {
        session.commit(...args);
        observed.commits++;
      },
    });
  } };
});

const now = "2026-10-17T08:00:00.000Z";
const previousSelection = "previous-selected-slot";
const rest: SliceIntent = { type: "RED_PRIEST", command: { type: "REST" } };
const travel: SliceIntent = { type: "RED_PRIEST", command: { type: "TRAVEL", to: RED_PRIEST_MATERIAL_LOCATIONS.archive } };
const trace: SliceIntent = { type: "RED_PRIEST", command: { type: "MATERIAL", command: {
  type: "TRACE_DISPOSITION", itemId: RED_PRIEST_CHARACTERISTIC_IDS[0]!,
} } };
let initial: SliceState, expected: SliceState, traceInitial: SliceState, traceExpected: SliceState;
let initialProjection: SliceProjection, expectedProjection: SliceProjection;
const dirs: string[] = [], stores: SqliteSliceStore[] = [];
function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.message);
  return result.value;
}
function envelope(id = "red-priest-owned-rest", state = initial, payload = rest): SliceEnvelope {
  return { intentId: id, runId: state.runId, expectedRevision: state.revision, payload: structuredClone(payload) };
}
function disk(beforeWrite?: () => void, state = initial): { file: string; store: SqliteSliceStore } {
  const dir = mkdtempSync(join(tmpdir(), "lotm-red-priest-owned-")); dirs.push(dir);
  const file = join(dir, "save.sqlite");
  const store = new SqliteSliceStore(file, { now: () => now, ...(beforeWrite ? { beforeWrite } : {}) });
  stores.push(store);
  store.repository.transaction(() => {
    store.repository.put({ state, updatedAt: now });
    store.repository.selectRun(previousSelection);
  });
  expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  return { file, store };
}
function raw(file: string): string {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return String(db.prepare("SELECT current_json FROM slice_runs WHERE id=?").get(initial.runId)!.current_json); }
  finally { db.close(); }
}
function stored(file: string): StoredSlice { return JSON.parse(JSON.parse(raw(file)).payload) as StoredSlice; }
function persisted(file: string): string {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return stableStringify({
      runs: db.prepare("SELECT * FROM slice_runs ORDER BY id").all(),
      receipts: db.prepare("SELECT * FROM slice_receipts ORDER BY id").all(),
      meta: db.prepare("SELECT * FROM slice_meta ORDER BY key").all(),
      marker: existsSync(`${file}.sealed`) ? readFileSync(`${file}.sealed`, "utf8") : null,
      backup: existsSync(`${file}.bak`) ? createHash("sha256").update(readFileSync(`${file}.bak`)).digest("hex") : null,
    });
  } finally { db.close(); }
}
function replace(file: string, value: StoredSlice): void {
  const payload = stableStringify(value);
  const encoded = JSON.stringify({ format: 1, checksum: createHash("sha256").update(payload).digest("hex"), payload });
  const db = new DatabaseSync(file);
  try { db.prepare("UPDATE slice_runs SET current_json=? WHERE id=?").run(encoded, initial.runId); }
  finally { db.close(); }
}
function unchanged(repository: SliceRepository, state = initial, intentId = "red-priest-owned-rest"): void {
  expect(repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  expect(observed.revisions.at(-1)!()).toBe(state.revision);
  expect(observed.commits).toBe(0);
  expect(repository.receipt(intentId)).toBeNull();
  expect(repository.activeRun()).toBe(previousSelection);
}

beforeAll(() => {
  const legacy = readObjectEntry<unknown>("tests/fixtures/conqueror-v01870/natural.json", "final");
  initial = applySliceIntent(migrateSliceState(legacy), { type: "RED_PRIEST", command: { type: "LEARN_GUIDANCE" } });
  expected = applySliceIntent(initial, rest);
  initialProjection = projectSliceState(initial);
  expectedProjection = projectSliceState(expected);
  // Travel really pays and moves the originals before this actual material check.
  traceInitial = applySliceIntent(initial, travel);
  traceExpected = applySliceIntent(traceInitial, trace);
  expect(initial.redPriest.guidanceKnown).toBe(true);
  expect(expected.actionsRemaining).toBe(initial.actionsRemaining - 1);
  expect(expected.random).toEqual(initial.random); // REST itself does not draw RNG.
  expect(traceInitial.cash).toBe(initial.cash - 10);
  expect(traceExpected.random.cursor).toBeGreaterThan(traceInitial.random.cursor);
  expect(traceExpected.redPriest.journal.at(-1)!.randomReceipts).toHaveLength(1);
}, 60_000);
beforeEach(() => {
  observed.opens = 0; observed.prepares = 0; observed.commits = 0;
  observed.backups = 0; observed.failBackup = false; observed.revisions.length = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const store of stores.splice(0)) store.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  observed.revisions.length = 0;
});

describe("repository-owned Red Priest transactions", () => {
  it("commits real REST in SQLite and publishes its owned head only after durable COMMIT", () => {
    let watch = false;
    const { file, store } = disk(() => {
      if (watch) {
        expect(observed.revisions.at(-1)!()).toBe(initial.revision);
        expect(observed.commits).toBe(0);
        expect(store.repository.ownedHead(initial.runId)?.revision).toBe(initial.revision);
      }
    });
    const opens = observed.opens, exec = DatabaseSync.prototype.exec;
    let commitsChecked = 0;
    const commit = vi.spyOn(DatabaseSync.prototype, "exec").mockImplementation(function (this: DatabaseSync, sql: string) {
      if (sql === "COMMIT") {
        expect(observed.revisions.at(-1)!()).toBe(initial.revision);
        expect(observed.commits).toBe(0);
        commitsChecked++;
      }
      const result = exec.call(this, sql);
      if (sql === "COMMIT") expect(observed.commits).toBe(0);
      return result;
    });
    watch = true;
    const receipt = unwrap(store.submitIntent(envelope()));
    watch = false; commit.mockRestore();
    expect(commitsChecked).toBe(1);
    expect(stored(file).state).toEqual(expected);
    expect(receipt.state).toEqual(expectedProjection);
    expect(observed.opens).toBe(opens);
    expect(observed.commits).toBe(1);
    expect(store.repository.ownedHead(initial.runId)?.revision).toBe(expected.revision);
    expect(store.repository.activeRun()).toBe(initial.runId);
  }, 30_000);

  it("checks duplicates and revisions before preparing and never charges REST twice", () => {
    const { file, store } = disk();
    const first = unwrap(store.submitIntent(envelope())), bytes = raw(file), prepares = observed.prepares;
    expect(unwrap(store.submitIntent(envelope()))).toEqual({ ...first, replayed: true });
    expect(store.submitIntent(envelope("red-priest-owned-rest", initial, travel)))
      .toMatchObject({ ok: false, error: { code: "DUPLICATE_INTENT_CONFLICT" } });
    expect(store.submitIntent(envelope("stale-rest")))
      .toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect(observed.prepares).toBe(prepares);
    expect(observed.commits).toBe(1);
    expect(raw(file)).toBe(bytes);
    expect(stored(file).state.actionsRemaining).toBe(initial.actionsRemaining - 1);
    expect(stored(file).state.random).toEqual(expected.random);
  }, 30_000);

  it.each(["beforeWrite", "receipt", "commit"] as const)(
    "rolls back the row, receipt, RNG and selection after %s failure, then retries the same REST", failure => {
      let fail = false;
      const { file, store } = disk(() => { if (fail && failure === "beforeWrite") throw Error("Injected beforeWrite failure"); });
      const before = persisted(file);
      let restore: (() => void) | undefined;
      if (failure === "receipt") {
        const original = store.repository.putReceipt.bind(store.repository);
        const spy = vi.spyOn(store.repository, "putReceipt").mockImplementation((...args) => {
          original(...args); throw Error("Injected receipt failure after insert");
        });
        restore = () => spy.mockRestore();
      }
      if (failure === "commit") {
        const original = DatabaseSync.prototype.exec;
        const spy = vi.spyOn(DatabaseSync.prototype, "exec").mockImplementation(function (this: DatabaseSync, sql: string) {
          if (sql === "COMMIT") throw Error("Injected COMMIT failure");
          return original.call(this, sql);
        });
        restore = () => spy.mockRestore();
      }
      fail = true;
      expect(store.submitIntent(envelope())).toMatchObject({ ok: false, error: { code: "SAVE_FAILED" } });
      expect(persisted(file)).toBe(before);
      unchanged(store.repository);
      expect(stored(file).state.random).toEqual(initial.random);
      fail = false; restore?.();
      expect(unwrap(store.submitIntent(envelope())).replayed).toBe(false);
      expect(stored(file).state).toEqual(expected);
      expect(observed.commits).toBe(1);
    }, 30_000,
  );

  it("retries the genuine travelled-to-archive material roll with identical RNG and one expense", () => {
    const { file, store } = disk(undefined, traceInitial);
    const intent = envelope("red-priest-owned-trace", traceInitial, trace), before = persisted(file);
    const original = store.repository.putReceipt.bind(store.repository);
    const spy = vi.spyOn(store.repository, "putReceipt").mockImplementation((...args) => {
      original(...args); throw Error("Injected receipt failure after genuine random check");
    });
    expect(store.submitIntent(intent)).toMatchObject({ ok: false, error: { code: "SAVE_FAILED" } });
    expect(persisted(file)).toBe(before);
    unchanged(store.repository, traceInitial, intent.intentId);
    expect(stored(file).state.random).toEqual(traceInitial.random);
    spy.mockRestore();
    const receipt = unwrap(store.submitIntent(intent));
    const committed = stored(file).state;
    expect(committed).toEqual(traceExpected);
    expect(committed.random).toEqual(traceExpected.random);
    expect(committed.redPriest.journal.at(-1)!.randomReceipts).toEqual(traceExpected.redPriest.journal.at(-1)!.randomReceipts);
    expect(committed.cash).toBe(traceInitial.cash - 30);
    expect(committed.actionsRemaining).toBe(traceInitial.actionsRemaining - 1);
    expect(unwrap(store.submitIntent(intent))).toEqual({ ...receipt, replayed: true });
    expect(stored(file).state).toEqual(traceExpected);
    expect(observed.commits).toBe(1);
  }, 30_000);

  it("reopens the complete durable state and gives the same public projection and duplicate receipt", () => {
    const { file, store } = disk();
    const receipt = unwrap(store.submitIntent(envelope()));
    store.close(); stores.splice(stores.indexOf(store), 1);
    observed.revisions.length = 0;
    const reopened = new SqliteSliceStore(file, { now: () => now }); stores.push(reopened);
    expect(reopened.repository.get(initial.runId)!.state).toEqual(expected);
    expect(unwrap(reopened.loadRun(initial.runId))).toEqual(expectedProjection);
    expect(unwrap(reopened.getBootstrap()).activeState).toEqual(receipt.state);
    expect(unwrap(reopened.submitIntent(envelope()))).toEqual({ ...receipt, replayed: true });
    expect(stored(file).state).toEqual(expected);
  }, 30_000);

  it("rejects foreign repositories, wrong runs/revisions, copied handles and expired or superseded drafts", () => {
    const first = disk().store, second = disk().store;
    let expired: OwnedRepositoryDraft;
    expect(() => first.repository.prepareOwned(initial.runId, rest, initial.revision)).toThrow();
    first.repository.transaction(() => {
      expect(() => first.repository.prepareOwned("different-run", rest, initial.revision)).toThrow();
      expect(() => first.repository.prepareOwned(initial.runId, rest, initial.revision + 1)).toThrow();
      const draft = first.repository.prepareOwned(initial.runId, rest, initial.revision); expired = draft;
      expect(Object.isFrozen(draft)).toBe(true);
      expect(() => first.repository.putOwnedDraft(draft, "not-a-date")).toThrow("timestamp");
      for (const forged of [{ ...draft }, { ...draft, runId: "different-run" }, { ...draft, revision: initial.revision }, structuredClone(draft), {}]) {
        expect(() => first.repository.projectOwnedDraft(forged as OwnedRepositoryDraft)).toThrow();
        expect(() => first.repository.putOwnedDraft(forged as OwnedRepositoryDraft, now)).toThrow();
      }
      second.repository.transaction(() => expect(() => second.repository.putOwnedDraft(draft, now)).toThrow());
      const projection = first.repository.projectOwnedDraft(draft);
      projection.character.name = "caller-edited-draft";
      expect(first.repository.projectOwnedDraft(draft)).toEqual(expectedProjection);
    });
    expect(() => first.repository.transaction(() => first.repository.putOwnedDraft(expired!, now))).toThrow();
    first.repository.transaction(() => {
      const draft = first.repository.prepareOwned(initial.runId, rest, initial.revision);
      first.repository.put({ state: initial, updatedAt: now });
      expect(() => first.repository.putOwnedDraft(draft, now)).toThrow();
    });
    expect(first.repository.get(initial.runId)!.state).toEqual(initial);
    expect(second.repository.get(initial.runId)!.state).toEqual(initial);
    expect(observed.commits).toBe(0);
  }, 30_000);

  it("strictly reopens changed raw bytes even at the same revision and rejects checksummed forged history", () => {
    const { file, store } = disk(), opens = observed.opens;
    replace(file, { state: initial, updatedAt: "2026-10-17T08:01:00.000Z" });
    expect(unwrap(store.submitIntent(envelope())).newRevision).toBe(expected.revision);
    expect(observed.opens).toBe(opens + 1);
    const committed = stored(file), bytes = raw(file);
    const badRandom = structuredClone(committed); badRandom.state.random.cursor++;
    const badSource = structuredClone(committed); badSource.state.redPriest.source!.budget.cash++;
    for (const bad of [badRandom, badSource]) {
      replace(file, bad); const badBytes = raw(file);
      expect(store.submitIntent(envelope("forged-row", expected))).toMatchObject({ ok: false });
      expect(store.loadRun(initial.runId)).toMatchObject({ ok: false, error: { code: "SAVE_UNAVAILABLE" } });
      expect(store.repository.receipt("forged-row")).toBeNull();
      expect(raw(file)).toBe(badBytes);
    }
    replace(file, committed);
    expect(raw(file)).toBe(bytes);
    const reopened = observed.opens;
    expect(store.repository.ownedHead(initial.runId)?.revision).toBe(expected.revision);
    expect(observed.opens).toBe(reopened + 1);
  }, 30_000);

  it("keeps bootstrap read-only and detached when all write and backup hooks fail", () => {
    let fail = false;
    const beforeWrite = vi.fn(() => { if (fail) throw Error("Writes unavailable"); });
    const { file, store } = disk(beforeWrite);
    fail = true; observed.failBackup = true;
    expect(store.submitIntent(envelope())).toMatchObject({ ok: false, error: { code: "SAVE_FAILED" } });
    beforeWrite.mockClear();
    const before = persisted(file), backups = observed.backups, notice = store.repository.recoveryNotice;
    const bootstrap = unwrap(store.getBootstrap());
    expect(bootstrap.activeState).toEqual(initialProjection);
    expect(bootstrap.runs).toEqual([summarizeSlice({ state: initial, updatedAt: now })]);
    bootstrap.activeState!.character.name = "caller-edited-bootstrap";
    bootstrap.runs[0]!.name = "caller-edited-summary";
    expect(unwrap(store.getBootstrap()).activeState).toEqual(initialProjection);
    expect(beforeWrite).not.toHaveBeenCalled();
    expect(observed.backups).toBe(backups);
    expect(persisted(file)).toBe(before);
    expect(store.repository.recoveryNotice).toBe(notice);
    unchanged(store.repository);
  }, 30_000);

  it("detaches current/private snapshots and draft/public projections from all caller-owned references", () => {
    const input = structuredClone(initial), session = openRedPriestRuntimeSession(input);
    input.character.name = "caller-edited-input";
    input.redPriest.source!.budget.cash = -1;
    const snapshot = session.snapshot(), projection = session.project(), chapter = session.projectRedPriest();
    const expectedChapter = structuredClone(chapter);
    snapshot.random.cursor++;
    snapshot.redPriest.frame!.budget.cash = -1;
    snapshot.redPriest.materials!.items[0]!.containerId = "caller-edited-container";
    projection.character.name = "caller-edited-public-view";
    chapter.resources.health = 0;
    expect(session.snapshot()).toEqual(initial);
    expect(session.project()).toEqual(initialProjection);
    expect(session.projectRedPriest()).toEqual(expectedChapter);
    const intent = structuredClone(rest), draft = session.prepare(intent, initial.revision);
    if (intent.type === "RED_PRIEST") intent.command = { type: "NEXT_WEEK" };
    const privateDraft = session.snapshotDraft(draft), publicDraft = session.projectDraft(draft), chapterDraft = session.projectDraftRedPriest(draft);
    const expectedDraftChapter = structuredClone(chapterDraft);
    privateDraft.redPriest.journal[0]!.after.budget.cash = -1;
    privateDraft.redPriest.source!.budget.health = 0;
    publicDraft.character.name = "caller-edited-draft-view";
    chapterDraft.resources.health = 0;
    expect(session.snapshot()).toEqual(initial);
    expect(session.snapshotDraft(draft)).toEqual(expected);
    expect(session.projectDraft(draft)).toEqual(expectedProjection);
    expect(session.projectDraftRedPriest(draft)).toEqual(expectedDraftChapter);
    session.commit(draft);
    expect(session.snapshot()).toEqual(expected);
    expect(session.project()).toEqual(expectedProjection);
    expect(() => session.snapshotDraft(draft)).toThrow();
  }, 30_000);
});
