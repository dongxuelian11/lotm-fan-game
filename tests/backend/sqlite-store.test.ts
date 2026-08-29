import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteGameStore } from "../../src/persistence/sqlite-store.js";
import { computeStateChecksum } from "../../src/domain/checksum.js";
import { stableStringify } from "../../src/domain/canonical.js";
import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
  type IntentEnvelope,
} from "../../src/shared/contracts.js";

function fixtureIntent(
  intentId: string,
  overrides: Partial<IntentEnvelope> = {},
): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId: null,
    expectedRevision: 0,
    payload: {
      kind: "CREATE_R1_FIXTURE_RUN",
      fixtureId: "ordinary-week-one",
      displayName: "Ada",
    },
    ...overrides,
  };
}

function mutateStoredState(
  databasePath: string,
  mutate: (state: Record<string, unknown>) => void,
): void {
  const database = new DatabaseSync(databasePath);
  const row = database.prepare("SELECT state_json FROM runs LIMIT 1").get() as {
    state_json: string;
  };
  const state = JSON.parse(row.state_json) as Record<string, unknown>;
  mutate(state);
  const { stateChecksum: _stateChecksum, ...stateWithoutChecksum } = state;
  const nextChecksum = computeStateChecksum(
    stateWithoutChecksum as Parameters<typeof computeStateChecksum>[0],
  );
  state.stateChecksum = nextChecksum;
  database
    .prepare("UPDATE runs SET state_json = ?, state_checksum = ?")
    .run(stableStringify(state), nextChecksum);
  database.close();
}

function mutateStoredReceipt(
  databasePath: string,
  mutate: (receipt: Record<string, unknown>) => void,
): void {
  const database = new DatabaseSync(databasePath);
  const row = database.prepare("SELECT receipt_json FROM intent_receipts LIMIT 1").get() as {
    receipt_json: string;
  };
  const receipt = JSON.parse(row.receipt_json) as Record<string, unknown>;
  mutate(receipt);
  database
    .prepare("UPDATE intent_receipts SET receipt_json = ?")
    .run(stableStringify(receipt));
  database.close();
}

describe("R1 SQLite authority", () => {
  let directory: string;
  let databasePath: string;
  let store: SqliteGameStore;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "lotm-r1-"));
    databasePath = join(directory, "mystery-game.sqlite");
    store = new SqliteGameStore(databasePath, "test-app");
  });

  afterEach(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("creates schema version 1 and returns the exact no-run projection", () => {
    expect(store.getBootstrap()).toEqual({
      appVersion: "test-app",
      contractVersion: CONTRACT_VERSION,
      storageSchemaVersion: STORAGE_SCHEMA_VERSION,
      storageStatus: "READY",
      lifecycle: "NO_RUN",
      runs: [],
      activeState: null,
    });

    const database = new DatabaseSync(databasePath, { readOnly: true });
    expect(database.prepare("PRAGMA user_version").get()).toEqual({ user_version: 1 });
    database.close();
  });

  it("commits the first fixture in one authoritative revision", () => {
    const result = store.submitIntent(fixtureIntent("intent-1"));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected the fixture intent to commit");
    }

    expect(result.value).toMatchObject({
      intentId: "intent-1",
      previousRevision: 0,
      newRevision: 1,
      replayed: false,
      publicState: {
        contractVersion: CONTRACT_VERSION,
        ruleVersion: RULE_VERSION,
        contentVersion: CONTENT_VERSION,
        revision: 1,
        week: 1,
        availableActions: 3,
        cashPence: 0,
      },
    });
    expect(result.value.runId).toBe(result.value.publicState.runId);
    expect(result.value.stateChecksum).toBe(result.value.publicState.stateChecksum);
    expect(store.getBootstrap().activeState).toEqual(result.value.publicState);
  });

  it("replays an identical intent without a second state change", () => {
    const first = store.submitIntent(fixtureIntent("intent-replay"));
    const second = store.submitIntent(fixtureIntent("intent-replay"));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected both fixture submissions to succeed");
    }

    expect(second.value).toEqual({ ...first.value, replayed: true });
    expect(store.getBootstrap().activeState?.revision).toBe(1);
  });

  it("rejects a same-id envelope conflict and an old revision", () => {
    const first = store.submitIntent(fixtureIntent("intent-conflict"));
    expect(first.ok).toBe(true);

    const conflict = store.submitIntent(
      fixtureIntent("intent-conflict", {
        payload: {
          kind: "CREATE_R1_FIXTURE_RUN",
          fixtureId: "ordinary-week-one",
          displayName: "Beatrice",
        },
      }),
    );
    expect(conflict).toMatchObject({
      ok: false,
      error: { code: "DUPLICATE_INTENT_CONFLICT" },
    });

    const oldRevision = store.submitIntent(fixtureIntent("intent-old-revision"));
    expect(oldRevision).toMatchObject({
      ok: false,
      error: { code: "REVISION_CONFLICT", currentRevision: 1 },
    });

    expect(store.submitIntent(fixtureIntent("intent-second-run", { expectedRevision: 1 }))).toMatchObject({
      ok: false,
      error: { code: "REVISION_CONFLICT", currentRevision: 1 },
    });
  });

  it("rejects malformed input without exposing internal details", () => {
    const invalid = store.submitIntent({
      contractVersion: "wrong",
      intentId: "intent-invalid",
      runId: null,
      expectedRevision: 0,
      payload: {},
    });

    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "CONTRACT_VERSION_MISMATCH" },
    });
    if (invalid.ok) {
      throw new Error("expected malformed input to be rejected");
    }
    expect(invalid.error.message).not.toMatch(/SQL|sqlite|path|stack|Error/i);
  });

  it("validates the fixture payload and envelope field ranges at runtime", () => {
    const cases: unknown[] = [
      fixtureIntent("intent-empty-name", {
        payload: {
          kind: "CREATE_R1_FIXTURE_RUN",
          fixtureId: "ordinary-week-one",
          displayName: "   ",
        },
      }),
      fixtureIntent("intent-extra-field", { unexpected: true } as Partial<IntentEnvelope>),
      fixtureIntent("intent-negative-revision", { expectedRevision: -1 }),
      fixtureIntent("intent-wrong-fixture", {
        payload: {
          kind: "CREATE_R1_FIXTURE_RUN",
          fixtureId: "not-a-fixture",
          displayName: "Ada",
        },
      }),
    ];

    for (const input of cases) {
      expect(store.submitIntent(input)).toMatchObject({
        ok: false,
        error: { code: "SCHEMA_INVALID" },
      });
    }
  });

  it("keeps the public state limited to the shared whitelist", () => {
    const result = store.submitIntent(fixtureIntent("intent-public"));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected the fixture intent to commit");
    }

    expect(Object.keys(result.value.publicState).sort()).toEqual([
      "availableActions",
      "cashPence",
      "character",
      "chronicle",
      "contentVersion",
      "contractVersion",
      "lifecycle",
      "revision",
      "ruleVersion",
      "runId",
      "stateChecksum",
      "week",
    ]);
    expect(Object.keys(result.value.publicState.character).sort()).toEqual([
      "coreStats",
      "displayName",
      "origin",
      "resources",
      "sequence",
    ]);
  });

  it("recovers the same state after closing and reopening the database", () => {
    const first = store.submitIntent(fixtureIntent("intent-recover"));
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error("expected the fixture intent to commit");
    }

    const expected = store.getBootstrap();
    store.close();
    store = new SqliteGameStore(databasePath, "test-app");

    expect(store.getBootstrap()).toEqual(expected);

    const replay = store.submitIntent(fixtureIntent("intent-recover"));
    expect(replay).toMatchObject({
      ok: true,
      value: {
        runId: first.value.runId,
        stateChecksum: first.value.stateChecksum,
        committedAt: first.value.committedAt,
        replayed: true,
      },
    });
  });

  it.each([
    ["an extra public-state field", (state: Record<string, unknown>) => {
      state.secret = "must-not-leak";
    }],
    ["a malformed resource meter", (state: Record<string, unknown>) => {
      const character = state.character as Record<string, unknown>;
      const resources = character.resources as Record<string, unknown>;
      resources.health = { current: "not-a-number", max: 100 };
    }],
    ["a negative resource-meter current", (state: Record<string, unknown>) => {
      const character = state.character as Record<string, unknown>;
      const resources = character.resources as Record<string, unknown>;
      resources.health = { current: -1, max: 100 };
    }],
    ["an extra chronicle field", (state: Record<string, unknown>) => {
      const chronicle = state.chronicle as Array<Record<string, unknown>>;
      chronicle[0]!.secret = "must-not-leak";
    }],
  ])("fails closed when persisted state contains %s", (_description, mutate) => {
    const first = store.submitIntent(fixtureIntent(`intent-corrupt-${_description}`));
    expect(first.ok).toBe(true);
    store.close();
    mutateStoredState(databasePath, mutate);
    store = new SqliteGameStore(databasePath, "test-app");

    expect(() => store.getBootstrap()).toThrow();
  });

  it("does not replay a receipt with extra persisted fields", () => {
    const first = store.submitIntent(fixtureIntent("intent-corrupt-receipt"));
    expect(first.ok).toBe(true);
    store.close();
    mutateStoredReceipt(databasePath, (receipt) => {
      receipt.secret = "must-not-leak";
    });
    store = new SqliteGameStore(databasePath, "test-app");

    const replay = store.submitIntent(fixtureIntent("intent-corrupt-receipt"));
    expect(replay).toMatchObject({
      ok: false,
      error: { code: "PERSISTENCE_UNAVAILABLE" },
    });
    if (!replay.ok) {
      expect(replay.error.message).not.toMatch(/must-not-leak|secret|SQL|path|stack/i);
    }
  });

  it("fails closed when a persisted receipt identity differs from its intent row", () => {
    const first = store.submitIntent(fixtureIntent("intent-receipt-identity"));
    expect(first.ok).toBe(true);
    store.close();
    mutateStoredReceipt(databasePath, (receipt) => {
      receipt.intentId = "tampered-intent";
    });
    store = new SqliteGameStore(databasePath, "test-app");

    const replay = store.submitIntent(fixtureIntent("intent-receipt-identity"));
    expect(replay).toMatchObject({
      ok: false,
      error: { code: "PERSISTENCE_UNAVAILABLE" },
    });
    if (!replay.ok) {
      expect(replay.error.message).not.toMatch(/tampered-intent|SQL|path|stack/i);
    }
  });
});
