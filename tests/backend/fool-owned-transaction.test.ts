/** Transaction boundary tests use real domain sessions and original fixture actions.
 * Instrumentation injects failures; it never mints a trusted candidate or edits a save to win. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { SqliteSliceStore } from "../../src/persistence/slice-store.js";
import { SliceApplication, summarizeSlice, type SliceRepository, type StoredSlice } from "../../src/application/slice-application.js";
import type { FoolRepositoryDraft } from "../../src/application/slice-owned-runtime.js";
import { MemorySliceRepository } from "../../src/simulation/slice-browser-bridge.js";
import { applySliceIntent, createSliceRun, projectSliceState } from "../../src/domain/slice/index.js";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation.js";
import { migrateSliceState } from "../../src/domain/slice/migration.js";
import type { SliceIntent, SliceState } from "../../src/domain/slice/types.js";
import { stableStringify } from "../../src/domain/canonical.js";
import { FOOL_SOURCE_MATERIAL_IDS } from "../../src/domain/fool/materials.js";
import { readObjectEntry } from "../helpers/read-object-entry.js";
import type { SliceEnvelope, SliceResult } from "../../src/shared/slice-contracts.js";

const observed = vi.hoisted(() => ({
  opens: 0, prepares: 0, commits: 0, failPrepare: false, failProjection: false,
  failBackup: false, backups: 0, failLoadProjection: false, migrations: 0,
  revisions: [] as (() => number)[],
}));
vi.mock("node:fs", async importOriginal => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return { ...fs, copyFileSync: (...args: Parameters<typeof fs.copyFileSync>) => {
    if (String(args[1]).endsWith(".bak.tmp")) {
      observed.backups++;
      if (observed.failBackup) throw Error("Injected post-COMMIT backup failure");
    }
    return fs.copyFileSync(...args);
  } };
});
vi.mock("../../src/domain/slice/migration.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/domain/slice/migration.js")>();
  return { ...actual, migrateSliceState: (input: unknown) => {
    observed.migrations++;
    return actual.migrateSliceState(input);
  } };
});
vi.mock("../../src/domain/fool/owned-session.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/domain/fool/owned-session.js")>();
  return { ...actual, openFoolRuntimeSession: (input: unknown) => {
    const session = actual.openFoolRuntimeSession(input);
    observed.opens++;
    observed.revisions.push(() => session.inspect().revision);
    return Object.freeze({ ...session,
      project: () => {
        const view = session.project();
        if (observed.failLoadProjection) throw Error("Injected cold load projection failure");
        return view;
      },
      prepare: (...args: Parameters<typeof session.prepare>) => {
        observed.prepares++;
        const draft = session.prepare(...args);
        if (observed.failPrepare) { session.discard(draft); throw Error("Injected reducer failure after isolated work"); }
        return draft;
      },
      projectDraft: (...args: Parameters<typeof session.projectDraft>) => {
        const view = session.projectDraft(...args);
        if (observed.failProjection) throw Error("Injected projection failure");
        return view;
      },
      commit: (...args: Parameters<typeof session.commit>) => { session.commit(...args); observed.commits++; },
    });
  } };
});

const now = "2026-10-16T20:00:00.000Z";
const trace: SliceIntent = { type: "FOOL", command: { type: "MATERIAL", command: { type: "TRACE_REJECTION", itemId: FOOL_SOURCE_MATERIAL_IDS[0]! } } };
let initial: SliceState, expected: SliceState, unguided: SliceState;
let originalLegacy: unknown;
const dirs: string[] = [], stores: SqliteSliceStore[] = [];
function unwrap<T>(result: SliceResult<T>): T { if (!result.ok) throw Error(result.error.message); return result.value; }
function envelope(id = "owned-trace"): SliceEnvelope {
  return { intentId: id, runId: initial.runId, expectedRevision: initial.revision, payload: structuredClone(trace) };
}
function seed(repository: SliceRepository): void {
  repository.transaction(() => { repository.put({ state: initial, updatedAt: now }); repository.selectRun("previous-selected-slot"); });
  expect(repository.foolHead(initial.runId)?.revision).toBe(initial.revision);
}
function disk(beforeWrite?: () => void): { file: string; store: SqliteSliceStore } {
  const dir = mkdtempSync(join(tmpdir(), "lotm-owned-transaction-")); dirs.push(dir);
  const file = join(dir, "save.sqlite");
  const store = new SqliteSliceStore(file, { now: () => now, ...(beforeWrite ? { beforeWrite } : {}) });
  stores.push(store); seed(store.repository); return { file, store };
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
function replace(file: string, value: StoredSlice, runId = initial.runId): void {
  const payload = stableStringify(value);
  const encoded = JSON.stringify({ format: 1, checksum: createHash("sha256").update(payload).digest("hex"), payload });
  const db = new DatabaseSync(file);
  try { db.prepare("UPDATE slice_runs SET current_json=? WHERE id=?").run(encoded, runId); }
  finally { db.close(); }
}
function replaceRaw(file: string, encoded: string, terminal = 0): void {
  const db = new DatabaseSync(file);
  try { db.prepare("UPDATE slice_runs SET current_json=?, terminal=? WHERE id=?").run(encoded, terminal, initial.runId); }
  finally { db.close(); }
}
function unchanged(repository: SliceRepository, before: number): void {
  expect(observed.revisions.at(-1)!()).toBe(initial.revision);
  expect(observed.commits).toBe(before);
  expect(repository.receipt("owned-trace")).toBeNull();
  expect(repository.activeRun()).toBe("previous-selected-slot");
}
beforeAll(() => {
  originalLegacy = readObjectEntry<unknown>("tests/fixtures/attendant-mysteries-v01860/natural-battle.json", "final");
  let state = migrateSliceState(originalLegacy);
  unguided = structuredClone(state);
  const commands: SliceIntent[] = [
    { type: "FOOL", command: { type: "LEARN_GUIDANCE" } },
    ...Array.from({ length: 3 }, (): SliceIntent => ({ type: "FOOL", command: { type: "RECEPTION_WORK" } })),
    { type: "FOOL", command: { type: "RECEPTION_NEXT_WEEK" } },
    { type: "FOOL", command: { type: "FOG", command: { type: "TRAVEL", to: "new-alder-clearing" } } },
  ];
  for (const command of commands) state = applySliceIntent(state, command);
  initial = state;
  expected = applySliceIntent(initial, trace);
  expect(expected.random.cursor).toBeGreaterThan(initial.random.cursor);
}, 120_000);
beforeEach(() => {
  observed.opens = 0; observed.prepares = 0; observed.commits = 0;
  observed.failPrepare = false; observed.failProjection = false; observed.revisions.length = 0;
  observed.failBackup = false; observed.backups = 0;
  observed.failLoadProjection = false; observed.migrations = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const store of stores.splice(0)) store.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  observed.revisions.length = 0;
});

describe("repository-owned Fool transactions", () => {
  it("uses the real owned session, publishes only after COMMIT, and checks duplicate receipts before apply", () => {
    let watch = false;
    const { file, store } = disk(() => {
      if (watch) {
        expect(observed.revisions.at(-1)!()).toBe(initial.revision);
        expect(observed.commits).toBe(0);
      }
    });
    const opens = observed.opens; watch = true;
    const receipt = unwrap(store.submitIntent(envelope())); watch = false;
    expect(stored(file).state).toEqual(expected);
    expect(receipt.state).toEqual(projectSliceState(expected));
    expect(observed.opens).toBe(opens);
    expect(observed.commits).toBe(1);
    expect(observed.revisions.at(-1)!()).toBe(expected.revision);
    const prepares = observed.prepares;
    expect(unwrap(store.submitIntent(envelope())).replayed).toBe(true);
    expect(store.submitIntent({ ...envelope(), payload: { type: "FOOL", command: { type: "RECEPTION_WORK" } } }))
      .toMatchObject({ ok: false, error: { code: "DUPLICATE_INTENT_CONFLICT" } });
    expect(store.submitIntent(envelope("stale"))).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect(observed.prepares).toBe(prepares);
    expect(observed.commits).toBe(1);
  }, 120_000);

  it.each(["reducer", "projection", "snapshot", "receipt", "beforeWrite", "commit"] as const)(
    "rolls back the actual RNG draft, row, receipt and selection after %s failure; retry is identical", failure => {
      let fail = false;
      const { file, store } = disk(() => { if (fail && failure === "beforeWrite") throw Error("Injected beforeWrite failure"); });
      const before = raw(file), commits = observed.commits;
      observed.failPrepare = failure === "reducer"; observed.failProjection = failure === "projection";
      let restore: (() => void) | undefined;
      if (failure === "snapshot") {
        const original = store.repository.putFoolDraft.bind(store.repository);
        const spy = vi.spyOn(store.repository, "putFoolDraft").mockImplementation((...args) => { original(...args); throw Error("Injected snapshot write failure"); });
        restore = () => spy.mockRestore();
      }
      if (failure === "receipt") {
        const original = store.repository.putReceipt.bind(store.repository);
        const spy = vi.spyOn(store.repository, "putReceipt").mockImplementation((...args) => { original(...args); throw Error("Injected receipt write failure"); });
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
      expect(store.submitIntent(envelope()).ok).toBe(false);
      expect(raw(file)).toBe(before); unchanged(store.repository, commits);
      fail = false; observed.failPrepare = false; observed.failProjection = false; restore?.();
      expect(unwrap(store.submitIntent(envelope())).replayed).toBe(false);
      expect(stored(file).state).toEqual(expected);
      expect(observed.commits).toBe(commits + 1);
    }, 120_000,
  );

  it("rejects forged, copied, cross-store, expired and raw-write-superseded draft capabilities", () => {
    const first = disk().store, second = disk().store;
    let stale: FoolRepositoryDraft;
    first.repository.transaction(() => {
      const draft = first.repository.prepareFool(initial.runId, trace, initial.revision); stale = draft;
      expect(() => first.repository.putFoolDraft(draft, "not-a-date")).toThrow("timestamp");
      const view = first.repository.projectFoolDraft(draft); view.revision = 0; view.character.name = "changed-view";
      expect(first.repository.projectFoolDraft(draft).revision).toBe(expected.revision);
      for (const forged of [{ ...draft }, { ...draft, runId: "different-run" }, structuredClone(draft), {}, { runId: initial.runId, revision: expected.revision }])
        expect(() => first.repository.putFoolDraft(forged as FoolRepositoryDraft, now)).toThrow();
      second.repository.transaction(() => expect(() => second.repository.putFoolDraft(draft, now)).toThrow());
    });
    expect(() => first.repository.transaction(() => first.repository.putFoolDraft(stale!, now))).toThrow();
    first.repository.transaction(() => {
      const draft = first.repository.prepareFool(initial.runId, trace, initial.revision);
      first.repository.put({ state: initial, updatedAt: now });
      expect(() => first.repository.putFoolDraft(draft, now)).toThrow();
    });
    expect(first.repository.get(initial.runId)!.state).toEqual(initial);
    expect(observed.commits).toBe(0);
  }, 120_000);

  it("invalidates exact-row trust on a same-revision replacement and fully rejects forged replacement bytes", () => {
    const { file, store } = disk(), opens = observed.opens;
    replace(file, { state: initial, updatedAt: "2026-10-16T20:01:00.000Z" });
    expect(unwrap(store.submitIntent(envelope())).newRevision).toBe(expected.revision);
    expect(observed.opens).toBe(opens + 1);
    const committed = stored(file), beforeCorruption = raw(file);
    const bad = structuredClone(committed); bad.state.random.cursor++;
    replace(file, bad);
    expect(store.submitIntent({ ...envelope("forged-row"), expectedRevision: expected.revision }).ok).toBe(false);
    expect(store.repository.receipt("forged-row")).toBeNull();
    expect(() => store.repository.get(initial.runId)).toThrow();
    replace(file, committed); expect(raw(file)).toBe(beforeCorruption);
    const openings = observed.opens;
    expect(store.repository.foolHead(initial.runId)?.revision).toBe(expected.revision);
    expect(observed.opens).toBe(openings + 1);
  }, 120_000);

  it("invalidates after a strict raw put only on commit and forces explicit load and reopen through strict hydration", () => {
    const { file, store } = disk(), opens = observed.opens;
    expect(() => store.repository.transaction(() => {
      store.repository.put({ state: initial, updatedAt: now }); throw Error("Abort raw write");
    })).toThrow();
    expect(store.repository.foolHead(initial.runId)?.revision).toBe(initial.revision);
    expect(observed.opens).toBe(opens);
    store.repository.transaction(() => store.repository.put({ state: initial, updatedAt: now }));
    expect(store.repository.foolHead(initial.runId)?.revision).toBe(initial.revision);
    expect(observed.opens).toBe(opens + 1);
    unwrap(store.loadRun(initial.runId)); expect(observed.opens).toBe(opens + 2);
    store.close(); stores.splice(stores.indexOf(store), 1);
    const reopened = new SqliteSliceStore(file); stores.push(reopened);
    unwrap(reopened.loadRun(initial.runId)); expect(observed.opens).toBe(opens + 3);
    const bad = structuredClone(initial); bad.random.cursor++;
    expect(() => reopened.repository.transaction(() => reopened.repository.put({ state: bad, updatedAt: now }))).toThrow();
    expect(() => reopened.repository.transaction(() => reopened.repository.put({ state: initial, updatedAt: "invalid-date" }))).toThrow();
    expect(reopened.repository.get(initial.runId)!.state).toEqual(initial);
  }, 120_000);

  it.each(["desktop", "browser"] as const)(
    "%s explicit load has one strict session entry, no preliminary get/migration, and never reuses a prior load", mode => {
      const store = mode === "desktop" ? disk().store : null;
      const repository = store?.repository ?? new MemorySliceRepository();
      if (!store) seed(repository);
      const app = store ?? new SliceApplication(repository, "browser", () => "unused", () => now);
      const opens = observed.opens, migrations = observed.migrations;
      // Only this repository exists while the absence spy is active. Observe
      // the browser prototype so Vitest's restore closure cannot retain its save.
      const get = vi.spyOn(mode === "browser" ? MemorySliceRepository.prototype : repository, "get");
      // These cases assert opens/current repository behavior, not old-session
      // revision callbacks. Do not let instrumentation retain replaced engines.
      observed.revisions.length = 0;
      {
        const expectedView = projectSliceState(initial);
        {
          const first = unwrap(app.loadRun(initial.runId));
          expect(first).toEqual(expectedView);
          expect(observed.opens).toBe(opens + 1);
          first.character.name = "detached-load-view";
        }
        observed.revisions.length = 0;
        expect(unwrap(app.loadRun(initial.runId))).toEqual(expectedView);
        expect(observed.opens).toBe(opens + 2);
      }
      observed.revisions.length = 0;
      expect(observed.migrations).toBe(migrations);
      expect(get).not.toHaveBeenCalled();
      get.mockRestore(); // Also clears calls, contexts and results after their assertion.
      expect(app.loadRun("missing-slot")).toMatchObject({ ok: false, error: { code: "RUN_NOT_FOUND" } });
      expect(repository.activeRun()).toBe(initial.runId);
      expect(() => repository.loadRunProjection(initial.runId)).toThrow("transaction");

      // A projection failure cannot publish the newly opened candidate.
      observed.failLoadProjection = true;
      expect(app.loadRun(initial.runId)).toMatchObject({ ok: false, error: { code: "SAVE_UNAVAILABLE" } });
      observed.failLoadProjection = false;
      expect(observed.opens).toBe(opens + 3);
      observed.revisions.length = 0;
      expect(repository.foolHead(initial.runId)?.revision).toBe(initial.revision);
      expect(observed.opens).toBe(opens + 3); // The previous committed session remains current.
      expect(unwrap(app.submitIntent(envelope())).newRevision).toBe(expected.revision);
      expect(observed.opens).toBe(opens + 3);
    }, 120_000,
  );

  it("cold loads retain all envelope/state/sealed gates and discard failed changed-row candidates", () => {
    const { file, store } = disk(), bytes = raw(file), opens = observed.opens;
    observed.revisions.length = 0; // This case checks counts/state, never old revision callbacks.
    const outer = JSON.parse(bytes) as { format: number; checksum: string; payload: string };
    for (const encoded of [JSON.stringify({ ...outer, format: 2 }), JSON.stringify({ ...outer, checksum: "bad-checksum" })]) {
      replaceRaw(file, encoded);
      expect(store.loadRun(initial.runId)).toMatchObject({ ok: false, error: { code: "SAVE_UNAVAILABLE" } });
      expect(store.getBootstrap()).toMatchObject({ ok: false, error: { code: "SAVE_UNAVAILABLE" } });
      expect(raw(file)).toBe(encoded);
    }
    // Keep only one detached malformed history live at a time. These are the
    // same five failures; the timestamp-only case never mutates the shared save.
    for (const failure of ["timestamp", "future", "content", "rng", "malformed"] as const) {
      const candidate: StoredSlice = { state: failure === "timestamp" ? initial : structuredClone(initial),
        updatedAt: failure === "timestamp" ? "invalid-date" : now };
      if (failure === "future") (candidate.state as { schemaVersion: number }).schemaVersion++;
      if (failure === "content") (candidate.state as { contentVersion: string }).contentVersion = "unknown-content";
      if (failure === "rng") candidate.state.random.cursor++;
      if (failure === "malformed") candidate.state.cash = -1;
      replace(file, candidate); const badBytes = raw(file);
      expect(store.loadRun(initial.runId)).toMatchObject({ ok: false, error: { code: "SAVE_UNAVAILABLE" } });
      expect(store.getBootstrap()).toMatchObject({ ok: false, error: { code: "SAVE_UNAVAILABLE" } });
      expect(raw(file)).toBe(badBytes);
      expect(store.repository.activeRun()).toBe("previous-selected-slot");
    }
    expect(observed.opens).toBe(opens);
    replaceRaw(file, bytes);
    expect(store.repository.foolHead(initial.runId)?.revision).toBe(initial.revision);
    expect(observed.opens).toBe(opens + 1); // Restored bytes cannot revive invalidated authority.
    observed.revisions.length = 0;

    replace(file, { state: initial, updatedAt: "2026-10-16T20:01:00.000Z" });
    observed.failLoadProjection = true;
    expect(store.loadRun(initial.runId).ok).toBe(false);
    observed.failLoadProjection = false;
    const failedOpens = observed.opens;
    observed.revisions.length = 0;
    expect(store.repository.foolHead(initial.runId)?.revision).toBe(initial.revision);
    expect(observed.opens).toBe(failedOpens + 1); // Failed projection retained no new head.
    observed.revisions.length = 0;

    const liveBytes = raw(file);
    replaceRaw(file, liveBytes, 1);
    expect(store.loadRun(initial.runId).ok).toBe(false);
    observed.revisions.length = 0;
    expect(store.getBootstrap().ok).toBe(false);
    expect(store.repository.activeRun()).toBe("previous-selected-slot");
    observed.revisions.length = 0;
    replaceRaw(file, liveBytes);
    writeFileSync(`${file}.sealed`, JSON.stringify([initial.runId]));
    expect(store.loadRun(initial.runId).ok).toBe(false);
    observed.revisions.length = 0;
    expect(store.getBootstrap().ok).toBe(false);
    expect(store.repository.activeRun()).toBe("previous-selected-slot");
    expect(raw(file)).toBe(liveBytes);
  }, 120_000);

  it("loads current non-Fool and genuine legacy rows through the unchanged strict migration path", () => {
    const { file, store } = disk(), expectedView = projectSliceState(unguided), opens = observed.opens;
    for (const state of [unguided, originalLegacy as SliceState]) {
      replace(file, { state, updatedAt: now }); const bytes = raw(file), migrations = observed.migrations;
      expect(unwrap(store.loadRun(initial.runId))).toEqual(expectedView);
      expect(observed.migrations).toBe(migrations + 1);
      expect(observed.opens).toBe(opens);
      expect(raw(file)).toBe(bytes);
      const bootstrapMigrations = observed.migrations;
      const bootstrap = unwrap(store.getBootstrap());
      expect(bootstrap.activeState).toEqual(expectedView);
      expect(bootstrap.runs).toEqual([summarizeSlice({ state: expectedView, updatedAt: now })]);
      expect(observed.migrations).toBe(bootstrapMigrations + 1);
      expect(observed.opens).toBe(opens);
      expect(raw(file)).toBe(bytes);
    }
  }, 120_000);

  it.each(["desktop", "browser"] as const)(
    "%s bootstrap validates the selected Fool once and preserves selection, fallback ordering and detached summaries", mode => {
      const store = mode === "desktop" ? disk().store : null;
      const repository = store?.repository ?? new MemorySliceRepository();
      if (!store) seed(repository);
      const app = store ?? new SliceApplication(repository, "browser", () => "unused", () => now);
      const older = createSliceRun("bootstrap-older", sliceDefaultCreationSelection, "bootstrap-older");
      const newer = createSliceRun("bootstrap-newer", sliceDefaultCreationSelection, "bootstrap-newer");
      const tied = createSliceRun("bootstrap-tied", sliceDefaultCreationSelection, "bootstrap-tied");
      const a = { state: older, updatedAt: "2026-10-16T20:02:00.000Z" };
      const b = { state: newer, updatedAt: "2026-10-16T20:01:00.000Z" };
      const c = { state: tied, updatedAt: a.updatedAt };
      repository.transaction(() => {
        repository.put(a); repository.put(c); repository.put(b); repository.selectRun(initial.runId);
      });
      const expectedRuns = (mode === "desktop" ? [c, a, b] : [b, c, a]).map(summarizeSlice);
      expectedRuns.push(summarizeSlice({ state: initial, updatedAt: now }));
      const opens = observed.opens, migrations = observed.migrations;
      observed.revisions.length = 0;
      // There is one browser repository until these absence spies are restored
      // below, before the separate empty-bootstrap repository is constructed.
      const observationTarget = mode === "browser" ? MemorySliceRepository.prototype : repository;
      const list = vi.spyOn(observationTarget, "list"), get = vi.spyOn(observationTarget, "get"), project = vi.spyOn(observationTarget, "projectFoolRun");
      {
        const view = unwrap(app.getBootstrap());
        expect(view.runs).toEqual(expectedRuns);
        expect(view.activeState).toEqual(projectSliceState(initial));
        expect(observed.opens).toBe(opens + 1);
        expect(observed.migrations).toBe(migrations + (mode === "desktop" ? 3 : 0));
        view.runs[0]!.name = "changed-summary";
        // Deliberately mutate the detached readonly public value to test ownership.
        (view.runs[0]!.date as { day: number }).day = 1;
        view.activeState!.character.name = "changed-projection";
      }
      observed.revisions.length = 0;
      {
        const again = unwrap(app.getBootstrap());
        expect(again.runs).toEqual(expectedRuns);
        expect(again.activeState!.character.name).toBe(initial.character.name);
        expect(observed.opens).toBe(opens + 2);
      }
      observed.revisions.length = 0;
      expect(list).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled(); expect(project).not.toHaveBeenCalled();
      list.mockRestore(); get.mockRestore(); project.mockRestore();
      repository.transaction(() => repository.selectRun("missing-selected-slot"));
      const fallback = unwrap(app.getBootstrap());
      expect(fallback.runs).toEqual(expectedRuns);
      expect(fallback.activeState).toEqual(projectSliceState(mode === "desktop" ? tied : newer));
      expect(repository.activeRun()).toBe("missing-selected-slot");
      expect(observed.opens).toBe(opens + 2);
      let empty: SliceApplication;
      if (mode === "desktop") {
        const dir = mkdtempSync(join(tmpdir(), "lotm-empty-bootstrap-")); dirs.push(dir);
        const emptyStore = new SqliteSliceStore(join(dir, "save.sqlite")); stores.push(emptyStore);
        empty = emptyStore;
      } else empty = new SliceApplication(new MemorySliceRepository(), "browser", () => "unused", () => now);
      expect(unwrap(empty.getBootstrap())).toEqual({ mode, runs: [], activeState: null });
    }, 120_000,
  );

  it("keeps bootstrap readable under write and backup failures without changing rows, selection or the sealed marker", () => {
    let fail = false;
    const beforeWrite = vi.fn(() => { if (fail) throw Error("Writes unavailable"); });
    const { file, store } = disk(beforeWrite);
    writeFileSync(`${file}.sealed`, '["previous-sealed-slot"]\n');
    fail = true; observed.failBackup = true;
    expect(store.submitIntent(envelope())).toMatchObject({ ok: false, error: { code: "SAVE_FAILED" } });
    beforeWrite.mockClear();
    const before = persisted(file), backups = observed.backups, opens = observed.opens;
    const notice = store.repository.recoveryNotice;
    const view = unwrap(store.getBootstrap());
    expect(view.activeState).toEqual(projectSliceState(initial));
    expect(view.runs).toEqual([summarizeSlice({ state: initial, updatedAt: now })]);
    expect(beforeWrite).not.toHaveBeenCalled();
    expect(observed.backups).toBe(backups);
    expect(persisted(file)).toBe(before);
    expect(store.repository.recoveryNotice).toBe(notice);
    expect(store.repository.activeRun()).toBe("previous-selected-slot");
    expect(store.repository.receipt("owned-trace")).toBeNull();
    expect(observed.commits).toBe(0);
    expect(observed.opens).toBe(opens + 1);
    expect(store.repository.foolHead(initial.runId)?.revision).toBe(initial.revision);
    expect(observed.opens).toBe(opens + 1); // Successful read COMMIT published this exact candidate.
  }, 120_000);

  it.each(["begin", "begin-ack", "read", "projection", "other-slot", "commit", "commit-ack"] as const)(
    "bootstrap publishes no new session when %s fails", failure => {
      const { file, store } = disk();
      const other = createSliceRun("bootstrap-other", sliceDefaultCreationSelection, "bootstrap-other");
      store.repository.transaction(() => {
        store.repository.put({ state: initial, updatedAt: now });
        store.repository.put({ state: other, updatedAt: "2026-10-15T20:00:00.000Z" });
        store.repository.selectRun(initial.runId);
      });
      const bytes = raw(file), opens = observed.opens;
      observed.revisions.length = 0;
      if (failure === "other-slot") {
        const bad = structuredClone(other); bad.cash = -1;
        replace(file, { state: bad, updatedAt: now }, other.runId);
      }
      writeFileSync(`${file}.sealed`, '["previous-sealed-slot"]\n');
      const before = persisted(file), backups = observed.backups;
      observed.failLoadProjection = failure === "projection";
      const exec = DatabaseSync.prototype.exec;
      const spy = vi.spyOn(DatabaseSync.prototype, "exec").mockImplementation(function (this: DatabaseSync, sql: string) {
        if (failure === "begin" && sql === "BEGIN") throw Error("Bootstrap BEGIN failure");
        if (failure === "commit" && sql === "COMMIT") throw Error("Bootstrap COMMIT failure");
        const result = exec.call(this, sql);
        if (failure === "begin-ack" && sql === "BEGIN") throw Error("Lost bootstrap BEGIN acknowledgement");
        if (failure === "commit-ack" && sql === "COMMIT") throw Error("Lost bootstrap COMMIT acknowledgement");
        return result;
      });
      const prepare = DatabaseSync.prototype.prepare;
      const read = failure === "read" ? vi.spyOn(DatabaseSync.prototype, "prepare").mockImplementation(function (this: DatabaseSync, sql: string) {
        if (sql === "SELECT id, current_json, terminal FROM slice_runs ORDER BY updated_at DESC, rowid DESC")
          throw Error("Bootstrap snapshot read failure");
        return prepare.call(this, sql);
      }) : null;
      expect(store.getBootstrap()).toMatchObject({ ok: false, error: { code: "SAVE_UNAVAILABLE" } });
      const candidates = failure === "begin" || failure === "begin-ack" || failure === "read" ? 0 : 1;
      expect(observed.opens).toBe(opens + candidates);
      expect(raw(file)).toBe(bytes);
      expect(persisted(file)).toBe(before);
      expect(observed.backups).toBe(backups);
      expect(store.repository.activeRun()).toBe(initial.runId);
      expect(store.repository.receipt("owned-trace")).toBeNull();
      observed.failLoadProjection = false; spy.mockRestore(); read?.mockRestore();
      observed.revisions.length = 0;
      expect(store.repository.foolHead(initial.runId)?.revision).toBe(initial.revision);
      expect(observed.opens).toBe(opens + candidates + 1);
      observed.revisions.length = 0;
      if (failure === "other-slot") {
        // Both rows are independently valid here; only persisted identity differs.
        const wrong = createSliceRun("wrong-bootstrap-slot", sliceDefaultCreationSelection, "wrong-bootstrap-slot");
        replace(file, { state: wrong, updatedAt: now }, other.runId);
        expect(store.getBootstrap().ok).toBe(false);
        observed.revisions.length = 0;
        replace(file, { state: other, updatedAt: now }, other.runId);
        writeFileSync(`${file}.sealed`, JSON.stringify([other.runId]));
        expect(store.getBootstrap().ok).toBe(false);
      }
    }, 120_000,
  );

  it("rolls back an unprimed browser bootstrap session after projection failure", () => {
    const repository = new MemorySliceRepository();
    repository.transaction(() => repository.put({ state: initial, updatedAt: now }));
    const app = new SliceApplication(repository, "browser", () => "unused", () => now);
    const opens = observed.opens;
    observed.failLoadProjection = true;
    expect(app.getBootstrap().ok).toBe(false);
    expect(repository.activeRun()).toBeNull();
    expect(observed.opens).toBe(opens + 1);
    observed.failLoadProjection = false; observed.revisions.length = 0;
    expect(repository.foolHead(initial.runId)?.revision).toBe(initial.revision);
    expect(observed.opens).toBe(opens + 2);
  }, 120_000);

  it("does not guess publication when COMMIT succeeds and then reports an uncertain exception", () => {
    const { file, store } = disk(), original = DatabaseSync.prototype.exec;
    const spy = vi.spyOn(DatabaseSync.prototype, "exec").mockImplementation(function (this: DatabaseSync, sql: string) {
      const result = original.call(this, sql);
      if (sql === "COMMIT") throw Error("Lost COMMIT acknowledgement");
      return result;
    });
    expect(store.submitIntent(envelope())).toMatchObject({ ok: false, error: { code: "SAVE_UNCERTAIN" } });
    spy.mockRestore();
    expect(observed.commits).toBe(0);
    expect(stored(file).state).toEqual(expected);
    expect(unwrap(store.submitIntent(envelope())).replayed).toBe(true);
    expect(store.repository.foolHead(initial.runId)?.revision).toBe(expected.revision);
  }, 120_000);

  it("publishes the durable owned head and successful receipt when only the post-COMMIT backup fails", () => {
    const { file, store } = disk(); observed.failBackup = true;
    const receipt = unwrap(store.submitIntent(envelope()));
    expect(receipt.newRevision).toBe(expected.revision);
    expect(stored(file).state).toEqual(expected);
    expect(observed.commits).toBe(1);
    expect(observed.revisions.at(-1)!()).toBe(expected.revision);
    expect(store.repository.recoveryNotice).toContain("备份暂时不可用");
    expect(unwrap(store.submitIntent(envelope())).replayed).toBe(true);
    expect(observed.commits).toBe(1);
  }, 120_000);

  it("keeps browser memory rollback/publication, capability isolation and strict raw put equivalent", () => {
    const repository = new MemorySliceRepository(); seed(repository);
    const app = new SliceApplication(repository, "browser", () => "unused", () => now);
    const original = repository.putReceipt.bind(repository);
    const spy = vi.spyOn(repository, "putReceipt").mockImplementation((...args) => { original(...args); throw Error("Memory receipt failure"); });
    expect(app.submitIntent(envelope()).ok).toBe(false);
    unchanged(repository, 0); expect(repository.get(initial.runId)!.state).toEqual(initial);
    spy.mockRestore();
    const committed = unwrap(app.submitIntent(envelope()));
    expect(repository.get(initial.runId)!.state).toEqual(expected);
    expect(observed.commits).toBe(1);
    expect(unwrap(app.submitIntent(envelope())).replayed).toBe(true);
    expect(observed.commits).toBe(1);
    committed.state.character.name = "caller-mutation";
    expect(repository.projectFoolRun(initial.runId)!.character.name).toBe(expected.character.name);
    const bad = structuredClone(expected); bad.random.cursor++;
    expect(() => repository.transaction(() => repository.put({ state: bad, updatedAt: now }))).toThrow();
    expect(() => repository.transaction(() => repository.put({ state: expected, updatedAt: "invalid-date" }))).toThrow("timestamp");
    repository.transaction(() => {
      const draft = repository.prepareFool(initial.runId, { type: "FOOL", command: { type: "FOG", command: { type: "TRAVEL", to: "base" } } }, expected.revision);
      expect(() => repository.putFoolDraft(draft, "invalid-date")).toThrow("timestamp");
    });
    expect(() => repository.transaction(() => repository.transaction(() => undefined))).toThrow("Nested");
  }, 120_000);
});
