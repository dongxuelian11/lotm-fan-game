import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import {
  SqliteSliceStore,
  NewerSliceSaveError,
} from "../../src/persistence/slice-store.js";
import {
  SliceApplication,
  validateSliceEnvelope,
} from "../../src/application/slice-application.js";
import { MemorySliceRepository } from "../../src/simulation/slice-browser-bridge.js";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation.js";
import {
  createSliceRun,
  projectSliceState,
} from "../../src/domain/slice/index.js";
import { stableStringify } from "../../src/domain/canonical.js";
import type {
  SliceEnvelope,
  SliceReceipt,
  SliceResult,
} from "../../src/shared/slice-contracts.js";
const dirs: string[] = [];
const stores: SqliteSliceStore[] = [];
const clock = () => "2026-10-09T23:00:00.000Z";
function path() {
  const dir = mkdtempSync(join(tmpdir(), "lotm-slice-test-"));
  dirs.push(dir);
  return join(dir, "slice.sqlite");
}
function open(file: string, fail?: () => void) {
  let count = 0;
  const s = new SqliteSliceStore(file, {
    identity: () => `fixed-${++count}`,
    now: clock,
    beforeWrite: fail,
  });
  stores.push(s);
  return s;
}
function close(s: SqliteSliceStore) {
  s.close();
  stores.splice(stores.indexOf(s), 1);
}
function unwrap<T>(r: SliceResult<T>): T {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}
const create: SliceEnvelope = {
  intentId: "create-1",
  runId: null,
  expectedRevision: 0,
  payload: { type: "CREATE", selection: sliceDefaultCreationSelection },
};
function choose(state: SliceReceipt["state"], id = "origin-1"): SliceEnvelope {
  if (!state.activeEvent) throw new Error("Expected opening event");
  return {
    intentId: id,
    runId: state.runId,
    expectedRevision: state.revision,
    payload: {
      type: "EVENT_CHOICE",
      eventInstanceId: state.activeEvent.instanceId,
      choiceId: state.activeEvent.choices.find((c) => c.enabled)!.id,
    },
  };
}
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
describe("slice canonical storage", () => {
  it("uses the same rules in memory and desktop, persists pending origin and random state across reopen", () => {
    const file = path(),
      disk = open(file);
    let id = 0;
    const memory = new SliceApplication(
      new MemorySliceRepository(),
      "browser",
      () => `fixed-${++id}`,
      clock,
    );
    const d = unwrap(disk.submitIntent(create)),
      m = unwrap(memory.submitIntent(create));
    expect(d).toEqual(m);
    expect(d.state.activeEvent).not.toBeNull();
    const command = choose(d.state);
    expect(unwrap(disk.submitIntent(command))).toEqual(
      unwrap(memory.submitIntent(command)),
    );
    const before = unwrap(disk.getBootstrap()).activeState;
    close(disk);
    const reopened = open(file);
    expect(unwrap(reopened.getBootstrap()).activeState).toEqual(before);
    expect(unwrap(reopened.submitIntent(command)).replayed).toBe(true);
    expect(unwrap(reopened.getBootstrap()).activeState).toEqual(before);
  }, 10_000);
  it("replays duplicate creation without a second run and rejects changed duplicate or stale revision", () => {
    const s = open(path()),
      initial = unwrap(s.submitIntent(create));
    expect(unwrap(s.submitIntent(create)).replayed).toBe(true);
    expect(unwrap(s.getBootstrap()).runs).toHaveLength(1);
    expect(
      s.submitIntent({
        ...create,
        payload: {
          type: "CREATE",
          selection: {
            ...sliceDefaultCreationSelection,
            displayName: "另一人",
          },
        },
      }).ok,
    ).toBe(false);
    const command = choose(initial.state);
    unwrap(s.submitIntent(command));
    expect(
      s.submitIntent({ ...command, intentId: "stale-other" }),
    ).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
  });
  it("rolls back snapshot, receipt, selected slot and random cursor on a write failure; retry is identical", () => {
    let fail = false;
    const s = open(path(), () => {
      if (fail) throw new Error("disk full fixture");
    });
    const initial = unwrap(s.submitIntent(create)),
      command = choose(initial.state);
    fail = true;
    expect(s.submitIntent(command)).toMatchObject({
      ok: false,
      error: { code: "SAVE_FAILED", retryable: true },
    });
    expect(unwrap(s.getBootstrap()).activeState).toEqual(initial.state);
    fail = false;
    const committed = unwrap(s.submitIntent(command));
    expect(committed.replayed).toBe(false);
    expect(committed.newRevision).toBe(initial.newRevision + 1);
  });
  it("recovers a corrupt current snapshot from the latest physical backup, preserving exact revision", () => {
    const file = path(),
      s = open(file);
    const first = unwrap(s.submitIntent(create));
    const last = unwrap(s.submitIntent(choose(first.state)));
    close(s);
    const db = new DatabaseSync(file);
    db.prepare("UPDATE slice_runs SET current_json='broken'").run();
    db.close();
    const recovered = open(file),
      boot = unwrap(recovered.getBootstrap());
    expect(boot.activeState).toEqual(last.state);
    expect(boot.recoveryNotice).toContain("恢复");
    expect(
      readdirSync(join(file, "..")).some((name) =>
        name.includes("corrupt-snapshot"),
      ),
    ).toBe(true);
  });
  it("recovers an unreadable database from checked backup without overwriting the damaged source", () => {
    const file = path(),
      s = open(file),
      original = unwrap(s.submitIntent(create));
    close(s);
    writeFileSync(file, "not sqlite");
    const recovered = open(file);
    expect(unwrap(recovered.getBootstrap()).activeState).toEqual(
      original.state,
    );
    expect(
      readdirSync(join(file, "..")).some((n) => n.includes(".corrupt-")),
    ).toBe(true);
  });
  it("does not replace main with an invalid backup", () => {
    const file = path(),
      s = open(file);
    unwrap(s.submitIntent(create));
    close(s);
    writeFileSync(file, "broken-main");
    writeFileSync(`${file}.bak`, "broken-backup");
    expect(() => open(file)).toThrow();
    expect(readFileSync(file, "utf8")).toBe("broken-main");
  });
  it("refuses a future database version before writing or recovering it", () => {
    const file = path(),
      s = open(file);
    unwrap(s.submitIntent(create));
    close(s);
    const db = new DatabaseSync(file);
    db.exec("PRAGMA user_version=999");
    db.close();
    const before = readFileSync(file);
    expect(() => open(file)).toThrow(NewerSliceSaveError);
    // Native byte equality checks length and contents without expanding each byte into object entries.
    expect(readFileSync(file).equals(before)).toBe(true);
  });
  it("migrates the explicit v1 storage schema without changing domain or random state", () => {
    const file = path(),
      state = createSliceRun(
        "migrated",
        sliceDefaultCreationSelection,
        "migration-seed",
      );
    const payload = stableStringify({ state, updatedAt: clock() });
    const raw = JSON.stringify({
      format: 1,
      payload,
      checksum: createHash("sha256").update(payload).digest("hex"),
    });
    const db = new DatabaseSync(file);
    db.exec(
      "CREATE TABLE slice_runs(id TEXT PRIMARY KEY,current_json TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE slice_receipts(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,receipt_json TEXT NOT NULL); CREATE TABLE slice_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); PRAGMA user_version=1;",
    );
    db.prepare("INSERT INTO slice_runs VALUES(?,?,?)").run(
      "migrated",
      raw,
      clock(),
    );
    db.close();
    const s = open(file),
      boot = unwrap(s.getBootstrap());
    expect(boot.activeState).toEqual(projectSliceState(state));
    expect(boot.recoveryNotice).toContain("迁移");
  });
  it("keeps final death read-only with a same-death backup and prevents resurrecting old backup", () => {
    const file = path(),
      s = open(file);
    unwrap(s.submitIntent(create));
    const original = s.repository.get("fixed-1")!;
    const dead = structuredClone(original);
    dead.state.status = "DEAD";
    dead.state.revision += 1;
    dead.state.activeEvent = null;
    dead.state.eventQueue = [];
    dead.state.combat = null;
    dead.state.ending = {
      kind: "DEATH",
      title: "死亡封存",
      summary: "测试最终死亡",
      workers: "未知",
      accountability: "未知",
      hazard: "未知",
      relationship: "未知",
    };
    s.repository.transaction(() => s.repository.put(dead));
    close(s);
    expect(existsSync(`${file}.sealed`)).toBe(true);
    const reopened = open(file);
    const state = unwrap(reopened.getBootstrap()).activeState!;
    expect(state.status).toBe("DEAD");
    expect(
      reopened.submitIntent({
        intentId: "no-revival",
        runId: state.runId,
        expectedRevision: state.revision,
        payload: { type: "ACTION", action: "REST" },
      }),
    ).toMatchObject({ ok: false, error: { code: "ARCHIVED" } });
  });
  it("rolls back a terminal marker when a final-death transaction fails, then recovers the last living save", () => {
    const file = path();
    let shouldFail = false;
    const s = open(file, () => {
      if (shouldFail) throw new Error("simulated disk failure");
    });
    const alive = unwrap(s.submitIntent(create)).state;
    const dead = structuredClone(s.repository.get(alive.runId)!);
    dead.state.status = "DEAD";
    dead.state.revision++;
    dead.state.activeEvent = null;
    dead.state.eventQueue = [];
    dead.state.combat = null;
    dead.state.ending = {
      kind: "DEATH",
      title: "死亡封存",
      summary: "测试死亡",
      workers: "未知",
      accountability: "未知",
      hazard: "未知",
      relationship: "未知",
    };
    shouldFail = true;
    expect(() =>
      s.repository.transaction(() => s.repository.put(dead)),
    ).toThrow();
    expect(existsSync(`${file}.sealed`)).toBe(false);
    expect(unwrap(s.getBootstrap()).activeState).toEqual(alive);
    close(s);
    writeFileSync(file, "damaged after failed transaction");
    expect(unwrap(open(file).getBootstrap()).activeState).toEqual(alive);
  });
  it("exposes no private world or random data to the renderer", () => {
    const s = open(path()),
      result = unwrap(s.submitIntent(create));
    const json = JSON.stringify(result);
    expect(json).not.toContain("random");
    expect(json).not.toContain("audrey");
    expect(json).not.toContain("bellHolder");
  });
  it("validates exact bounded envelopes and rejects arbitrary fields before touching storage", () => {
    expect(validateSliceEnvelope(create).ok).toBe(true);
    expect(
      validateSliceEnvelope({ ...create, seed: "chosen-by-renderer" }).ok,
    ).toBe(false);
    expect(validateSliceEnvelope({ ...create, intentId: "../escape" }).ok).toBe(
      false,
    );
    expect(validateSliceEnvelope({ ...create, expectedRevision: NaN }).ok).toBe(
      false,
    );
  });
});
