import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { computeStateChecksum } from "../../src/domain/checksum.js";
import { stableStringify } from "../../src/domain/canonical.js";
import {
  IPC_CHANNELS,
  isTrustedIpcSender,
  registerIpcHandlers,
  type IpcMainLike,
} from "../../src/main/ipc.js";
import {
  R2_FIXTURE_DEFAULT_SELECTION,
} from "../../src/content/r2-catalogue.js";
import { SqliteGameStore, unavailableBootstrap } from "../../src/persistence/sqlite-store.js";
import { CONTRACT_VERSION, type IntentEnvelope } from "../../src/shared/contracts.js";

type Handler = (
  event: { sender: unknown; senderFrame?: unknown },
  ...args: unknown[]
) => Promise<unknown>;

function intent(intentId = "ipc-intent"): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId: null,
    expectedRevision: 0,
    payload: { kind: "CREATE_CHARACTER_RUN", selection: R2_FIXTURE_DEFAULT_SELECTION },
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
  const checksum = computeStateChecksum(
    withoutChecksum as Parameters<typeof computeStateChecksum>[0],
  );
  state.stateChecksum = checksum;
  database.prepare("UPDATE runs SET state_json = ?, state_checksum = ?, week = ?, revision = ?").run(
    stableStringify(state),
    checksum,
    state.week,
    state.revision,
  );
  database.close();
}

function tamperReceipt(databasePath: string, mutate: (receipt: Record<string, unknown>) => void): void {
  const database = new DatabaseSync(databasePath);
  const row = database.prepare("SELECT receipt_json FROM intent_receipts LIMIT 1").get() as {
    receipt_json: string;
  };
  const receipt = JSON.parse(row.receipt_json) as Record<string, unknown>;
  mutate(receipt);
  database.prepare("UPDATE intent_receipts SET receipt_json = ?").run(stableStringify(receipt));
  database.close();
}

function makeHandlers(store: SqliteGameStore | null) {
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
  return { dispose, frame, handlers, sender: window.webContents };
}

describe("R2 IPC boundary", () => {
  it("accepts only the registered main-frame sender", () => {
    const sender = {};
    const frame = {};

    expect(isTrustedIpcSender({ sender, senderFrame: frame }, sender, frame)).toBe(true);
    expect(isTrustedIpcSender({ sender: {}, senderFrame: frame }, sender, frame)).toBe(false);
    expect(isTrustedIpcSender({ sender, senderFrame: {} }, sender, frame)).toBe(false);
  });

  it("exposes only the fixed bridge handlers and routes public R2 results", async () => {
    const store = new SqliteGameStore(":memory:", "test-app");
    const { dispose, frame, handlers, sender } = makeHandlers(store);

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

  it("returns the precise public unavailable projection when storage cannot open", async () => {
    const { dispose, frame, handlers, sender } = makeHandlers(null);

    expect(
      await handlers.get(IPC_CHANNELS.GET_BOOTSTRAP)?.({ sender, senderFrame: frame }),
    ).toEqual({ ok: true, value: unavailableBootstrap("test-app") });
    expect(
      await handlers.get(IPC_CHANNELS.SUBMIT_INTENT)?.({ sender, senderFrame: frame }, intent()),
    ).toMatchObject({ ok: false, error: { code: "PERSISTENCE_UNAVAILABLE" } });

    dispose();
  });

  it.each([
    ["an extra state field", (state: Record<string, unknown>) => { state.secret = "must-not-leak"; }],
    ["a malformed meter", (state: Record<string, unknown>) => {
      ((state.character as Record<string, unknown>).resources as Record<string, unknown>).health = {
        current: "not-a-number",
        max: 100,
      };
    }],
    ["a negative meter", (state: Record<string, unknown>) => {
      ((state.character as Record<string, unknown>).resources as Record<string, unknown>).health = {
        current: -1,
        max: 100,
      };
    }],
  ])("maps corrupted persisted %s to a public unavailable bootstrap", async (_description, mutate) => {
    const directory = mkdtempSync(join(tmpdir(), "lotm-r2-ipc-"));
    const databasePath = join(directory, "mystery-game.sqlite");
    let store = new SqliteGameStore(databasePath, "test-app");
    expect(store.submitIntent(intent(`ipc-corrupt-${String(_description)}`)).ok).toBe(true);
    store.close();
    tamperState(databasePath, mutate);
    store = new SqliteGameStore(databasePath, "test-app");
    const { dispose, frame, handlers, sender } = makeHandlers(store);

    const result = await handlers.get(IPC_CHANNELS.GET_BOOTSTRAP)?.({ sender, senderFrame: frame });
    expect(result).toEqual({ ok: true, value: unavailableBootstrap("test-app") });

    dispose();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it.each([
    ["an extra receipt field", (receipt: Record<string, unknown>) => { receipt.secret = "must-not-leak"; }],
    ["a tampered receipt identity", (receipt: Record<string, unknown>) => { receipt.intentId = "tampered-intent"; }],
  ])("maps %s to a public persistence error", async (_description, mutate) => {
    const directory = mkdtempSync(join(tmpdir(), "lotm-r2-ipc-"));
    const databasePath = join(directory, "mystery-game.sqlite");
    let store = new SqliteGameStore(databasePath, "test-app");
    const intentId = `ipc-receipt-${String(_description)}`;
    expect(store.submitIntent(intent(intentId)).ok).toBe(true);
    store.close();
    tamperReceipt(databasePath, mutate);
    store = new SqliteGameStore(databasePath, "test-app");
    const { dispose, frame, handlers, sender } = makeHandlers(store);

    const result = await handlers.get(IPC_CHANNELS.SUBMIT_INTENT)?.(
      { sender, senderFrame: frame },
      intent(intentId),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "PERSISTENCE_UNAVAILABLE" } });
    if (result && typeof result === "object" && "ok" in result && result.ok === false) {
      expect(result.error.message).not.toMatch(/must-not-leak|secret|tampered|SQL|path|stack/i);
    }

    dispose();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
