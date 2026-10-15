import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteSliceStore } from "../../src/persistence/slice-store";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import type { SliceResult } from "../../src/shared/slice-contracts";

const io = vi.hoisted(() => ({
  handles: new Map<number, { path: string; flags: string | number }>(),
  flushed: [] as { path: string; flags: string | number }[],
  rejectReadOnly: false,
  failSuffix: "",
}));
vi.mock("node:fs", async importOriginal => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return { ...fs,
    openSync: (...args: Parameters<typeof fs.openSync>) => {
      const fd = fs.openSync(...args);
      io.handles.set(fd, { path: String(args[0]), flags: args[1] });
      return fd;
    },
    fsyncSync: (fd: number) => {
      const entry = io.handles.get(fd);
      if (entry) {
        io.flushed.push(entry);
        if (io.rejectReadOnly && entry.flags === "r")
          throw Object.assign(new Error("Windows read-only flush rejected"), { code: "EPERM" });
        if (io.failSuffix && entry.path.endsWith(io.failSuffix))
          throw Object.assign(new Error("Injected storage flush failure"), { code: "EIO" });
      }
      fs.fsyncSync(fd);
    },
    closeSync: (fd: number) => { try { fs.closeSync(fd); } finally { io.handles.delete(fd); } },
  };
});
const dirs: string[] = [], stores: SqliteSliceStore[] = [];
function open(file: string) {
  const store = new SqliteSliceStore(file, { identity: () => "flush-run", now: () => "2026-10-15T00:00:00Z" });
  stores.push(store); return store;
}
function unwrap<T>(value: SliceResult<T>): T { if (!value.ok) throw new Error(value.error.message); return value.value; }
function create(store: SqliteSliceStore) {
  return unwrap(store.submitIntent({ intentId: "flush-create", runId: null, expectedRevision: 0,
    payload: { type: "CREATE", selection: sliceDefaultCreationSelection } }));
}
function close(store: SqliteSliceStore) { store.close(); stores.splice(stores.indexOf(store), 1); }
function path() { const dir = mkdtempSync(join(tmpdir(), "lotm-flush-")); dirs.push(dir); return join(dir, "save.sqlite"); }
function death(store: SqliteSliceStore) {
  const value = structuredClone(store.repository.get("flush-run")!);
  Object.assign(value.state, { status: "DEAD", revision: value.state.revision + 1, activeEvent: null, eventQueue: [], combat: null,
    ending: { kind: "DEATH", title: "死亡封存", summary: "持久性回归", workers: "未知", accountability: "未知", hazard: "未知", relationship: "未知" } });
  return value;
}
beforeEach(() => { io.flushed.length = 0; io.rejectReadOnly = false; io.failSuffix = ""; });
afterEach(() => { for (const store of stores.splice(0)) store.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); expect(io.handles.size).toBe(0); });
describe("durable file flush handles", () => {
  it.each([false, true])("preserves backups, recovery and death markers when read-only flush rejection is %s", rejectReadOnly => {
    io.rejectReadOnly = rejectReadOnly;
    const file = path(), store = open(file), initial = create(store);
    expect(existsSync(`${file}.bak`)).toBe(true);
    expect(readFileSync(`${file}.bak`)).toEqual(readFileSync(file));
    close(store); writeFileSync(file, "corrupt original database");
    const recovered = open(file);
    expect(unwrap(recovered.getBootstrap()).activeState).toEqual(initial.state);
    recovered.repository.transaction(() => recovered.repository.put(death(recovered)));
    expect(JSON.parse(readFileSync(`${file}.sealed`, "utf8"))).toEqual(["flush-run"]);
    close(recovered);
    expect(unwrap(open(file).getBootstrap()).activeState?.status).toBe("DEAD");
    for (const suffix of [".bak.tmp", ".recovery.tmp", ".sealed.tmp"])
      expect(io.flushed.some(entry => entry.path.endsWith(suffix))).toBe(true);
    expect(io.flushed.every(entry => entry.flags === "r+")).toBe(true);
  }, 10_000);
  it("propagates a real marker flush error and rolls back the living snapshot and marker", () => {
    io.rejectReadOnly = true;
    const file = path(), store = open(file), initial = create(store);
    io.failSuffix = ".sealed.tmp";
    expect(() => store.repository.transaction(() => store.repository.put(death(store)))).toThrow("SQLite commit failed");
    expect(existsSync(`${file}.sealed`)).toBe(false);
    expect(unwrap(store.getBootstrap()).activeState).toEqual(initial.state);
    expect(io.handles.size).toBe(0);
    io.failSuffix = "";
    store.repository.transaction(() => store.repository.put(death(store)));
    expect(unwrap(store.getBootstrap()).activeState?.status).toBe("DEAD");
  });
  it("reports post-commit backup flush failure without claiming a rollback or publishing a partial backup", () => {
    const file = path(), store = open(file);
    io.failSuffix = ".bak.tmp";
    const initial = create(store);
    expect(existsSync(`${file}.bak`)).toBe(false);
    expect(existsSync(`${file}.bak.tmp`)).toBe(false);
    expect(unwrap(store.getBootstrap()).activeState).toEqual(initial.state);
    expect(unwrap(store.getBootstrap()).recoveryNotice).toContain("备份暂时不可用");
    close(store); io.failSuffix = "";
    expect(unwrap(open(file).getBootstrap()).activeState).toEqual(initial.state);
  });
});
