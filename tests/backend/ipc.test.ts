import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import {
  IPC_CHANNELS,
  isTrustedIpcSender,
  registerIpcHandlers,
  type IpcMainLike,
} from "../../src/main/ipc.js";
import { computeStateChecksum } from "../../src/domain/checksum.js";
import { stableStringify } from "../../src/domain/canonical.js";
import { SqliteGameStore, unavailableBootstrap } from "../../src/persistence/sqlite-store.js";
import { CONTRACT_VERSION, type IntentEnvelope } from "../../src/shared/contracts.js";

type Handler = (event: { sender: unknown; senderFrame?: unknown }, ...args: unknown[]) => Promise<unknown>;

function intent(): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId: "ipc-intent",
    runId: null,
    expectedRevision: 0,
    payload: {
      kind: "CREATE_R1_FIXTURE_RUN",
      fixtureId: "ordinary-week-one",
      displayName: "Ada",
    },
  };
}

function tamperState(databasePath: string, mutate: (state: Record<string, unknown>) => void): void {
  const database = new DatabaseSync(databasePath);
  const row = database.prepare("SELECT state_json FROM runs LIMIT 1").get() as {
    state_json: string;
  };
  const state = JSON.parse(row.state_json) as Record<string, unknown>;
  mutate(state);
  const { stateChecksum: _stateChecksum, ...withoutChecksum } = state;
  const checksum = computeStateChecksum(withoutChecksum as Parameters<typeof computeStateChecksum>[0]);
  state.stateChecksum = checksum;
  database.prepare("UPDATE runs SET state_json = ?, state_checksum = ?").run(
    stableStringify(state),
    checksum,
  );
  database.close();
}

function tamperReceipt(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  const row = database.prepare("SELECT receipt_json FROM intent_receipts LIMIT 1").get() as {
    receipt_json: string;
  };
  const receipt = JSON.parse(row.receipt_json) as Record<string, unknown>;
  receipt.secret = "must-not-leak";
  database.prepare("UPDATE intent_receipts SET receipt_json = ?").run(stableStringify(receipt));
  database.close();
}

describe("R1 IPC boundary", () => {
  it("accepts only the registered main-frame sender", () => {
    const sender = {};
    const frame = {};

    expect(isTrustedIpcSender({ sender, senderFrame: frame }, sender, frame)).toBe(true);
    expect(isTrustedIpcSender({ sender: {}, senderFrame: frame }, sender, frame)).toBe(false);
    expect(isTrustedIpcSender({ sender, senderFrame: {} }, sender, frame)).toBe(false);
  });

  it("exposes only the two fixed bridge handlers and routes their public results", async () => {
    const handlers = new Map<string, Handler>();
    const ipcMain: IpcMainLike = {
      handle: (channel, handler) => handlers.set(channel, handler as Handler),
      removeHandler: (channel) => handlers.delete(channel),
    };
    const frame = {};
    const window = { webContents: { mainFrame: frame } };
    const sender = window.webContents;
    const store = new SqliteGameStore(":memory:", "test-app");
    const dispose = registerIpcHandlers({
      ipcMain,
      getWindow: () => window,
      getStore: () => store,
      appVersion: "test-app",
    });

    expect([...handlers.keys()].sort()).toEqual([
      IPC_CHANNELS.GET_BOOTSTRAP,
      IPC_CHANNELS.SUBMIT_INTENT,
    ].sort());

    const bootstrap = await handlers.get(IPC_CHANNELS.GET_BOOTSTRAP)?.({ sender, senderFrame: frame });
    expect(bootstrap).toMatchObject({ ok: true, value: { storageStatus: "READY", lifecycle: "NO_RUN" } });

    const submitted = await handlers.get(IPC_CHANNELS.SUBMIT_INTENT)?.(
      { sender, senderFrame: frame },
      intent(),
    );
    expect(submitted).toMatchObject({ ok: true, value: { newRevision: 1, replayed: false } });

    const rejected = await handlers.get(IPC_CHANNELS.GET_BOOTSTRAP)?.({ sender: {}, senderFrame: frame });
    expect(rejected).toMatchObject({ ok: false, error: { code: "SENDER_REJECTED" } });

    const malformed = await handlers.get(IPC_CHANNELS.SUBMIT_INTENT)?.(
      { sender, senderFrame: frame },
      { ...intent(), contractVersion: "wrong" },
    );
    expect(malformed).toMatchObject({ ok: false, error: { code: "CONTRACT_VERSION_MISMATCH" } });

    dispose();
    expect(handlers.size).toBe(0);
    store.close();
  });

  it("returns a precise public unavailable projection when storage cannot open", async () => {
    const handlers = new Map<string, Handler>();
    const ipcMain: IpcMainLike = {
      handle: (channel, handler) => handlers.set(channel, handler as Handler),
      removeHandler: (channel) => handlers.delete(channel),
    };
    const frame = {};
    const sender = { main: true };
    const window = { webContents: { mainFrame: frame } };
    const dispose = registerIpcHandlers({
      ipcMain,
      getWindow: () => window,
      getStore: () => null,
      appVersion: "test-app",
    });

    expect(
      await handlers.get(IPC_CHANNELS.GET_BOOTSTRAP)?.({ sender: window.webContents, senderFrame: frame }),
    ).toEqual({ ok: true, value: unavailableBootstrap("test-app") });
    expect(
      await handlers.get(IPC_CHANNELS.SUBMIT_INTENT)?.({ sender: window.webContents, senderFrame: frame }, intent()),
    ).toMatchObject({ ok: false, error: { code: "PERSISTENCE_UNAVAILABLE" } });

    dispose();
  });

  it("maps corrupted persisted state to the public unavailable projection", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lotm-r1-ipc-"));
    const databasePath = join(directory, "mystery-game.sqlite");
    let store = new SqliteGameStore(databasePath, "test-app");
    const first = store.submitIntent(intent());
    expect(first.ok).toBe(true);
    store.close();
    tamperState(databasePath, (state) => {
      state.secret = "must-not-leak";
    });
    store = new SqliteGameStore(databasePath, "test-app");

    const handlers = new Map<string, Handler>();
    const ipcMain: IpcMainLike = {
      handle: (channel, handler) => handlers.set(channel, handler as Handler),
      removeHandler: (channel) => handlers.delete(channel),
    };
    const frame = {};
    const window = { webContents: { mainFrame: frame } };
    const dispose = registerIpcHandlers({
      ipcMain,
      getWindow: () => window,
      getStore: () => store,
      appVersion: "test-app",
    });

    const result = await handlers.get(IPC_CHANNELS.GET_BOOTSTRAP)?.({
      sender: window.webContents,
      senderFrame: frame,
    });
    expect(result).toEqual({ ok: true, value: unavailableBootstrap("test-app") });

    dispose();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("maps a corrupted persisted receipt to a public persistence error", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lotm-r1-ipc-"));
    const databasePath = join(directory, "mystery-game.sqlite");
    let store = new SqliteGameStore(databasePath, "test-app");
    const first = store.submitIntent(intent());
    expect(first.ok).toBe(true);
    store.close();
    tamperReceipt(databasePath);
    store = new SqliteGameStore(databasePath, "test-app");

    const handlers = new Map<string, Handler>();
    const ipcMain: IpcMainLike = {
      handle: (channel, handler) => handlers.set(channel, handler as Handler),
      removeHandler: (channel) => handlers.delete(channel),
    };
    const frame = {};
    const window = { webContents: { mainFrame: frame } };
    const dispose = registerIpcHandlers({
      ipcMain,
      getWindow: () => window,
      getStore: () => store,
      appVersion: "test-app",
    });

    const result = await handlers.get(IPC_CHANNELS.SUBMIT_INTENT)?.(
      { sender: window.webContents, senderFrame: frame },
      intent(),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "PERSISTENCE_UNAVAILABLE" } });
    if (result && "ok" in result && !result.ok) {
      expect(result.error.message).not.toMatch(/must-not-leak|secret|SQL|path|stack/i);
    }

    dispose();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
