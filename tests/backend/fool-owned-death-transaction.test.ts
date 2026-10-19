/** Directed, deliberately fatal verification branch from the unchanged original
 * 1868 endpoint. This is NOT the recorded 2083-command natural campaign outcome.
 * Every resource, wound, week, commission and terminal state comes from real
 * public commands. No state/RNG edits, seed search or synthetic death authority. */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SqliteSliceStore } from "../../src/persistence/slice-store.js";
import { SliceApplication } from "../../src/application/slice-application.js";
import { MemorySliceRepository } from "../../src/simulation/slice-browser-bridge.js";
import { applySliceIntent, assertValidSliceState } from "../../src/domain/slice/index.js";
import { openFoolRuntimeSession } from "../../src/domain/fool/owned-session.js";
import { migrateSliceState } from "../../src/domain/slice/migration.js";
import type { SliceState, SliceIntent } from "../../src/domain/slice/types.js";
import type { FoolCommand } from "../../src/domain/fool/types.js";
import type { SliceEnvelope, SliceResult } from "../../src/shared/slice-contracts.js";
import { readObjectEntry } from "../helpers/read-object-entry.js";

const observed = vi.hoisted(() => ({
  handles: new Map<number, string>(), failMarker: false, commits: 0, opens: 0,
  snapshots: [] as (() => SliceState)[],
}));
vi.mock("node:fs", async importOriginal => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return { ...fs,
    openSync: (...args: Parameters<typeof fs.openSync>) => {
      const fd = fs.openSync(...args); observed.handles.set(fd, String(args[0])); return fd;
    },
    fsyncSync: (fd: number) => {
      if (observed.failMarker && observed.handles.get(fd)?.endsWith(".sealed.tmp"))
        throw Error("Injected real terminal marker flush failure");
      return fs.fsyncSync(fd);
    },
    closeSync: (fd: number) => { try { fs.closeSync(fd); } finally { observed.handles.delete(fd); } },
  };
});
vi.mock("../../src/domain/fool/owned-session.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/domain/fool/owned-session.js")>();
  return { ...actual, openFoolRuntimeSession: (input: unknown) => {
    const session = actual.openFoolRuntimeSession(input);
    observed.opens++;
    observed.snapshots.push(() => session.snapshot());
    return Object.freeze({ ...session,
      commit: (...args: Parameters<typeof session.commit>) => { session.commit(...args); observed.commits++; },
    });
  } };
});

const now = "2026-10-16T20:00:00.000Z";
const fatalIntent: SliceIntent = { type: "FOOL", command: { type: "FATE", command: { type: "CASE", action: { type: "WAIT", seconds: 140 } } } };
let before: SliceState, dead: SliceState;
const dirs: string[] = [], stores: SqliteSliceStore[] = [];
function unwrap<T>(result: SliceResult<T>): T { if (!result.ok) throw Error(result.error.message); return result.value; }
function currentRaw(file: string): string {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return String(db.prepare("SELECT current_json FROM slice_runs WHERE id=?").get(before.runId)!.current_json); }
  finally { db.close(); }
}
function databaseState(file: string): SliceState { return JSON.parse(JSON.parse(currentRaw(file)).payload).state as SliceState; }

beforeAll(() => {
  const original = migrateSliceState(readObjectEntry<unknown>("tests/fixtures/attendant-mysteries-v01860/natural-battle.json", "final"));
  expect(original.health).toBe(90);
  const guided = applySliceIntent(original, { type: "FOOL", command: { type: "LEARN_GUIDANCE" } });
  const session = openFoolRuntimeSession(guided);
  const act = (command: FoolCommand): void => {
    const draft = session.prepare({ type: "FOOL", command }, session.inspect().revision);
    session.commit(draft);
  };
  // One paid work advances the real clock past the first original departure window.
  act({ type: "RECEPTION_WORK" });
  act({ type: "ENTER_FATE" });
  for (let commission = 1; commission <= 3; commission++) {
    act({ type: "FATE", command: { type: "CASE", action: { type: "TRANSIT", route: "MAIN" } } });
    if (commission === 3) break;
    // No graft and no retreat before the bell: each actual failure costs 35 health.
    act({ type: "FATE", command: { type: "CASE", action: { type: "WAIT", seconds: 140 } } });
    expect(session.snapshot().health).toBe(90 - commission * 35);
    act({ type: "FATE", command: { type: "CASE", action: { type: "WITHDRAW" } } });
    act({ type: "LEAVE_FATE" });
    const commissionId = commission === 1 ? "F208-COMMISSION-2" : "F208-COMMISSION-3";
    act({ type: "FATE", command: { type: "INVESTIGATE_RECOVERY", commissionId } });
    const actions = session.snapshot().actionsRemaining;
    for (let i = 0; i < actions; i++) act({ type: "RECEPTION_WORK" });
    act({ type: "RECEPTION_NEXT_WEEK" });
    // Walk 20 real seconds back to the old canal before the on-site inspection.
    // Verification enters the next original case, so the next loop is already on site.
    act({ type: "ENTER_FATE" });
    act({ type: "FATE", command: { type: "VERIFY_RECOVERY", commissionId } });
  }
  before = session.snapshot();
  expect(before.status).toBe("ACTIVE"); expect(before.health).toBe(20);
  expect(before.random.seed).toBe(original.random.seed);
  assertValidSliceState(before);
  // Independently use the strict public reducer for the expected terminal result.
  dead = applySliceIntent(before, fatalIntent);
  assertValidSliceState(dead);
  expect(dead.status).toBe("DEAD"); expect(dead.health).toBe(0);
  expect(dead.revision).toBe(before.revision + 1);
  observed.snapshots.length = 0;
}, 180_000);

afterEach(() => {
  observed.failMarker = false;
  for (const store of stores.splice(0)) store.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  expect(observed.handles.size).toBe(0);
  observed.snapshots.length = 0;
});

describe("actual Fool death and terminal marker transaction", () => {
  it("keeps the living owned head on fsync failure, then commits the same fatal intent and reopens sealed", () => {
    const dir = mkdtempSync(join(tmpdir(), "lotm-fool-death-")); dirs.push(dir);
    const file = join(dir, "save.sqlite"), store = new SqliteSliceStore(file, { now: () => now }); stores.push(store);
    store.repository.transaction(() => {
      store.repository.put({ state: before, updatedAt: now });
      store.repository.selectRun("prior-selected-slot");
    });
    expect(store.repository.foolHead(before.runId)?.revision).toBe(before.revision);
    const head = observed.snapshots.at(-1)!, commits = observed.commits, bytes = currentRaw(file);
    const intent: SliceEnvelope = { intentId: "actual-fool-terminal", runId: before.runId, expectedRevision: before.revision, payload: fatalIntent };
    observed.failMarker = true;
    expect(store.submitIntent(intent)).toMatchObject({ ok: false, error: { code: "SAVE_FAILED" } });
    expect(currentRaw(file)).toBe(bytes);
    expect(head()).toEqual(before);
    expect(databaseState(file).random).toEqual(before.random);
    expect(observed.commits).toBe(commits);
    expect(store.repository.receipt(intent.intentId)).toBeNull();
    expect(store.repository.activeRun()).toBe("prior-selected-slot");
    expect(existsSync(`${file}.sealed`)).toBe(false);

    observed.failMarker = false;
    const receipt = unwrap(store.submitIntent(intent));
    expect(receipt.replayed).toBe(false); expect(receipt.state.status).toBe("DEAD");
    expect(databaseState(file)).toEqual(dead); expect(head()).toEqual(dead);
    expect(observed.commits).toBe(commits + 1);
    expect(JSON.parse(readFileSync(`${file}.sealed`, "utf8"))).toContain(before.runId);
    expect(store.repository.activeRun()).toBe(before.runId);
    expect(unwrap(store.submitIntent(intent)).replayed).toBe(true);
    expect(observed.commits).toBe(commits + 1);

    store.close(); stores.splice(stores.indexOf(store), 1);
    const reopened = new SqliteSliceStore(file); stores.push(reopened);
    expect(unwrap(reopened.loadRun(before.runId)).status).toBe("DEAD");
    expect(reopened.submitIntent({ ...intent, intentId: "no-fool-revival", expectedRevision: dead.revision }))
      .toMatchObject({ ok: false, error: { code: "ARCHIVED" } });
    observed.snapshots.length = 0;
    const opens = observed.opens;
    const bootstrap = unwrap(reopened.getBootstrap());
    expect(bootstrap.activeState).toEqual(receipt.state);
    expect(bootstrap.runs).toMatchObject([{ runId: dead.runId, status: "DEAD", revision: dead.revision }]);
    expect(observed.opens).toBe(opens + 1); // Sealed status uses this same strict session.
    reopened.close(); stores.splice(stores.indexOf(reopened), 1);
    observed.snapshots.length = 0;

    const memory = new MemorySliceRepository();
    memory.transaction(() => memory.put({ state: dead, updatedAt: now }));
    const app = new SliceApplication(memory, "browser", () => "unused", () => now);
    expect(unwrap(app.getBootstrap()).activeState).toEqual(receipt.state);
    expect(observed.opens).toBe(opens + 2);
  }, 180_000);
});
