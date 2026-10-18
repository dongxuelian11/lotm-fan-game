import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { computeStateChecksum } from "../../src/domain/checksum.js";
import { stableStringify } from "../../src/domain/canonical.js";
import {
  R2_FIXTURE_CATALOGUE,
  R2_FIXTURE_DEFAULT_SELECTION,
} from "../../src/content/r2-catalogue.js";
import { SqliteGameStore } from "../../src/persistence/sqlite-store.js";
import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  R2_FIXTURE_DEFAULTS,
  RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
  type IntentEnvelope,
  type PublicGameState,
} from "../../src/shared/contracts.js";

const RUN_ID = "550e8400-e29b-41d4-a716-446655440000";

function createIntent(intentId: string, overrides: Record<string, unknown> = {}): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId: null,
    expectedRevision: 0,
    payload: { kind: "CREATE_CHARACTER_RUN", selection: R2_FIXTURE_DEFAULT_SELECTION },
    ...overrides,
  } as IntentEnvelope;
}

function actionIntent(
  intentId: string,
  runId: string,
  expectedRevision: number,
  action: "WORK" | "LEARN" | "INVESTIGATE" | "REST" = "WORK",
): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId,
    expectedRevision,
    payload: { kind: "PERFORM_WEEKLY_ACTION", action },
  };
}

function mutateStoredState(
  databasePath: string,
  mutate: (state: Record<string, unknown>) => void,
): void {
  const database = new DatabaseSync(databasePath);
  const row = database.prepare("SELECT state_json FROM runs WHERE lifecycle = 'ACTIVE'").get() as {
    state_json: string;
  };
  const state = JSON.parse(row.state_json) as Record<string, unknown>;
  mutate(state);
  const { stateChecksum: _stateChecksum, ...withoutChecksum } = state;
  const checksum = computeStateChecksum(
    withoutChecksum as Parameters<typeof computeStateChecksum>[0],
  );
  state.stateChecksum = checksum;
  database
    .prepare(
      "UPDATE runs SET state_json = ?, state_checksum = ?, week = ?, revision = ? WHERE lifecycle = 'ACTIVE'",
    )
    .run(
      stableStringify(state),
      checksum,
      state.week,
      state.revision,
    );
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

function createSchemaOneDatabase(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE runs (
      run_id TEXT PRIMARY KEY NOT NULL,
      lifecycle TEXT NOT NULL,
      display_name TEXT NOT NULL,
      week INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      state_json TEXT NOT NULL,
      state_checksum TEXT NOT NULL
    );
    CREATE TABLE intent_receipts (
      intent_id TEXT PRIMARY KEY NOT NULL,
      envelope_json TEXT NOT NULL,
      run_id TEXT NOT NULL,
      receipt_json TEXT NOT NULL,
      committed_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(run_id)
    );
    INSERT INTO schema_migrations VALUES (1, '2026-08-30T00:00:00.000Z');
    PRAGMA user_version = 1;
  `);
  const oldState = {
    contractVersion: "r1-v1",
    ruleVersion: "fixture-r1",
    contentVersion: "fixture-r1",
    runId: RUN_ID,
    lifecycle: "ACTIVE",
    revision: 1,
    week: 1,
    availableActions: 3,
    cashPence: 0,
    character: {
      displayName: "R1工程周目",
      origin: "LOEN",
      sequence: "ORDINARY",
      coreStats: { physique: 10, perception: 10, will: 10, knowledge: 10 },
      resources: {
        health: { current: 100, max: 100 },
        mind: { current: 100, max: 100 },
        spirituality: { current: 10, max: 10 },
        pollution: 0,
      },
    },
    chronicle: [{ id: "r1-fixture", week: 1, title: "R1", summary: "工程fixture" }],
    stateChecksum: "0".repeat(64),
  };
  database.prepare(
    `INSERT INTO runs
     (run_id, lifecycle, display_name, week, revision, updated_at, state_json, state_checksum)
     VALUES (?, 'ACTIVE', ?, 1, 1, ?, ?, ?)`,
  ).run(
    RUN_ID,
    "R1工程周目",
    "2026-08-30T00:00:00.000Z",
    JSON.stringify(oldState),
    oldState.stateChecksum,
  );
  database.prepare(
    `INSERT INTO intent_receipts
     (intent_id, envelope_json, run_id, receipt_json, committed_at)
     VALUES ('r1-intent', '{}', ?, '{}', '2026-08-30T00:00:00.000Z')`,
  ).run(RUN_ID);
  database.close();
}

describe("R2 SQLite authority", () => {
  let directory: string;
  let databasePath: string;
  let store: SqliteGameStore;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "lotm-r2-"));
    databasePath = join(directory, "mystery-game.sqlite");
    store = new SqliteGameStore(databasePath, "test-app");
  });

  afterEach(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("creates schema version 2 and returns the exact no-run projection", () => {
    expect(store.getBootstrap()).toEqual({
      appVersion: "test-app",
      contractVersion: CONTRACT_VERSION,
      storageSchemaVersion: STORAGE_SCHEMA_VERSION,
      storageStatus: "READY",
      lifecycle: "NO_RUN",
      runs: [],
      activeState: null,
      characterCreation: R2_FIXTURE_CATALOGUE,
    });

    const database = new DatabaseSync(databasePath, { readOnly: true });
    expect(database.prepare("PRAGMA user_version").get()).toEqual({ user_version: 2 });
    expect(database.prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toEqual([
      { version: 1 },
      { version: 2 },
    ]);
    database.close();
  });

  it("commits one ordinary-person creation with the shared fixture defaults", () => {
    const result = store.submitIntent(createIntent("intent-create"));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected character creation to commit");
    }

    expect(result.value).toMatchObject({
      intentId: "intent-create",
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
        character: { displayName: "Ada", sequence: "ORDINARY" },
      },
    });
    expect(result.value.runId).toBe(result.value.publicState.runId);
    expect(result.value.stateChecksum).toBe(result.value.publicState.stateChecksum);
    expect(store.getBootstrap().activeState).toEqual(result.value.publicState);
  });

  it("replays an identical create or action exactly once", () => {
    const first = store.submitIntent(createIntent("intent-replay"));
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error("expected creation to commit");
    }
    const second = store.submitIntent(createIntent("intent-replay"));
    expect(second).toEqual({ ok: true, value: { ...first.value, replayed: true } });

    const action = actionIntent("intent-action-replay", first.value.runId, 1, "REST");
    const actionFirst = store.submitIntent(action);
    const actionSecond = store.submitIntent(action);
    expect(actionFirst.ok).toBe(true);
    expect(actionSecond).toEqual(
      actionFirst.ok ? { ok: true, value: { ...actionFirst.value, replayed: true } } : actionFirst,
    );
    expect(store.getBootstrap().activeState?.revision).toBe(2);
    expect(store.getBootstrap().activeState?.availableActions).toBe(2);
  });

  it("replays an earlier committed action after later revisions without a second write", () => {
    const creation = store.submitIntent(createIntent("intent-history-create"));
    expect(creation.ok).toBe(true);
    if (!creation.ok) {
      throw new Error("expected creation to commit");
    }
    const firstAction = actionIntent("intent-history-first", creation.value.runId, 1, "WORK");
    const firstReceipt = store.submitIntent(firstAction);
    expect(firstReceipt.ok).toBe(true);
    if (!firstReceipt.ok) {
      throw new Error("expected first action to commit");
    }
    expect(store.submitIntent(actionIntent("intent-history-second", creation.value.runId, 2, "LEARN")).ok).toBe(true);

    expect(store.submitIntent(firstAction)).toEqual({
      ok: true,
      value: { ...firstReceipt.value, replayed: true },
    });
    expect(store.getBootstrap().activeState?.revision).toBe(3);
    expect(store.getBootstrap().activeState?.availableActions).toBe(1);
  });

  it("rejects duplicate envelope conflicts, stale revisions, wrong runs, and exhausted actions", () => {
    const first = store.submitIntent(createIntent("intent-conflict"));
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error("expected creation to commit");
    }

    expect(
      store.submitIntent(
        createIntent("intent-conflict", {
          payload: {
            kind: "CREATE_CHARACTER_RUN",
            selection: { ...R2_FIXTURE_DEFAULT_SELECTION, displayName: "Beatrice" },
          },
        }),
      ),
    ).toMatchObject({ ok: false, error: { code: "DUPLICATE_INTENT_CONFLICT" } });

    expect(store.submitIntent(actionIntent("intent-old", first.value.runId, 0))).toMatchObject({
      ok: false,
      error: { code: "REVISION_CONFLICT", currentRevision: 1 },
    });
    expect(
      store.submitIntent(actionIntent("intent-wrong-run", "650e8400-e29b-41d4-a716-446655440000", 1)),
    ).toMatchObject({ ok: false, error: { code: "RUN_NOT_FOUND" } });

    mutateStoredState(databasePath, (state) => {
      state.availableActions = 0;
    });
    store.close();
    store = new SqliteGameStore(databasePath, "test-app");
    expect(store.submitIntent(actionIntent("intent-exhausted", first.value.runId, 1))).toMatchObject({
      ok: false,
      error: { code: "ACTION_UNAVAILABLE", currentRevision: 1 },
    });
  });

  it("runs three actions in one revision sequence and persists week two", () => {
    const creation = store.submitIntent(createIntent("intent-week"));
    expect(creation.ok).toBe(true);
    if (!creation.ok) {
      throw new Error("expected creation to commit");
    }

    const actions = ["WORK", "LEARN", "INVESTIGATE"] as const;
    let revision = 1;
    let last: ReturnType<SqliteGameStore["submitIntent"]> = creation;
    for (const [index, action] of actions.entries()) {
      last = store.submitIntent(actionIntent(`intent-week-${index}`, creation.value.runId, revision, action));
      expect(last.ok).toBe(true);
      revision += 1;
    }
    expect(last).toMatchObject({
      ok: true,
      value: {
        previousRevision: 3,
        newRevision: 4,
        publicState: { week: 2, availableActions: 3 },
      },
    });
    expect(store.getBootstrap().activeState?.chronicle).toHaveLength(4);
  });

  it("recovers the same state and receipt after closing and reopening", () => {
    const first = store.submitIntent(createIntent("intent-recover"));
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error("expected creation to commit");
    }

    const expected = store.getBootstrap();
    store.close();
    store = new SqliteGameStore(databasePath, "test-app");
    expect(store.getBootstrap()).toEqual(expected);
    expect(store.submitIntent(createIntent("intent-recover"))).toMatchObject({
      ok: true,
      value: {
        runId: first.value.runId,
        stateChecksum: first.value.stateChecksum,
        committedAt: first.value.committedAt,
        replayed: true,
      },
    });
  });

  it("archives an active R1 fixture during the schema-one to schema-two migration", () => {
    store.close();
    rmSync(databasePath, { force: true });
    createSchemaOneDatabase(databasePath);
    store = new SqliteGameStore(databasePath, "test-app");

    const bootstrap = store.getBootstrap();
    expect(bootstrap.lifecycle).toBe("NO_RUN");
    expect(bootstrap.activeState).toBeNull();
    expect(bootstrap.runs).toEqual([
      {
        runId: RUN_ID,
        lifecycle: "ARCHIVED",
        displayName: "R1工程周目",
        week: 1,
        currentDate: R2_FIXTURE_DEFAULTS.currentDate,
        revision: 1,
        updatedAt: "2026-08-30T00:00:00.000Z",
      },
    ]);
    const database = new DatabaseSync(databasePath, { readOnly: true });
    expect(database.prepare("PRAGMA user_version").get()).toEqual({ user_version: 2 });
    expect(database.prepare("SELECT lifecycle, state_schema_version FROM runs").all()).toEqual([
      { lifecycle: "ARCHIVED", state_schema_version: 1 },
    ]);
    expect(database.prepare("SELECT contract_version FROM intent_receipts").all()).toEqual([
      { contract_version: "r1-v1" },
    ]);
    database.close();
  });

  it("rejects malformed input with public errors only", () => {
    const invalidInputs: unknown[] = [
      { ...createIntent("intent-version"), contractVersion: "wrong" },
      { ...createIntent("intent-extra"), secret: "nope" },
      { ...createIntent("intent-name"), payload: {
        kind: "CREATE_CHARACTER_RUN",
        selection: { ...R2_FIXTURE_DEFAULT_SELECTION, displayName: "   " },
      } },
      { ...createIntent("intent-traits"), payload: {
        kind: "CREATE_CHARACTER_RUN",
        selection: { ...R2_FIXTURE_DEFAULT_SELECTION, traitIds: ["trait-observant"] },
      } },
      { ...createIntent("intent-age"), payload: {
        kind: "CREATE_CHARACTER_RUN",
        selection: { ...R2_FIXTURE_DEFAULT_SELECTION, age: 17 },
      } },
      { ...actionIntent("intent-action-shape", RUN_ID, 0), payload: { kind: "PERFORM_WEEKLY_ACTION", action: "NOPE" } },
    ];

    for (const input of invalidInputs) {
      const result = store.submitIntent(input);
      expect(result).toMatchObject({ ok: false });
      if (!result.ok) {
        expect(result.error.message).not.toMatch(/SQL|sqlite|path|stack|secret|nope/i);
      }
    }
    expect(store.getBootstrap().activeState).toBeNull();
  });

  it("keeps persisted public state and character projections on the exact whitelist", () => {
    const result = store.submitIntent(createIntent("intent-public"));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected creation to commit");
    }
    const state = result.value.publicState;
    expect(Object.keys(state).sort()).toEqual([
      "activeEvent",
      "availableActions",
      "cashPence",
      "character",
      "chronicle",
      "clues",
      "contentVersion",
      "contractVersion",
      "currentDate",
      "knowledgeRecords",
      "lastAction",
      "lastEventResolution",
      "lifecycle",
      "pendingEvents",
      "revision",
      "ruleVersion",
      "runId",
      "stateChecksum",
      "week",
      "worldFeedback",
    ]);
    expect(Object.keys(state.character).sort()).toEqual([
      "age",
      "appearanceDescription",
      "birthplace",
      "coreStats",
      "displayName",
      "flaw",
      "origin",
      "originCountry",
      "portrait",
      "profession",
      "resources",
      "sequence",
      "sex",
      "specialization",
      "traits",
    ]);
    expect(Object.keys(state.character.resources.health).sort()).toEqual(["current", "max"]);
    expect(state.character.resources.health.current).toBeGreaterThanOrEqual(0);
  });

  it.each([
    ["extra top-level state field", (state: Record<string, unknown>) => { state.secret = "must-not-leak"; }],
    ["extra nested character field", (state: Record<string, unknown>) => {
      (state.character as Record<string, unknown>).secret = "must-not-leak";
    }],
    ["malformed meter", (state: Record<string, unknown>) => {
      ((state.character as Record<string, unknown>).resources as Record<string, unknown>).health = {
        current: "not-a-number",
        max: 100,
      };
    }],
    ["negative meter current", (state: Record<string, unknown>) => {
      ((state.character as Record<string, unknown>).resources as Record<string, unknown>).health = {
        current: -1,
        max: 100,
      };
    }],
    ["extra chronicle field", (state: Record<string, unknown>) => {
      ((state.chronicle as Array<Record<string, unknown>>)[0]!).secret = "must-not-leak";
    }],
  ])("fails closed when persisted state contains %s", (_description, mutate) => {
    const first = store.submitIntent(createIntent(`intent-corrupt-${String(_description)}`));
    expect(first.ok).toBe(true);
    store.close();
    mutateStoredState(databasePath, mutate);
    store = new SqliteGameStore(databasePath, "test-app");
    expect(() => store.getBootstrap()).toThrow();
  });

  it.each([
    ["extra receipt field", (receipt: Record<string, unknown>) => { receipt.secret = "must-not-leak"; }],
    ["tampered receipt intent identity", (receipt: Record<string, unknown>) => { receipt.intentId = "tampered-intent"; }],
  ])("fails closed on %s during replay", (_description, mutate) => {
    const intentId = `intent-receipt-${String(_description)}`;
    const first = store.submitIntent(createIntent(intentId));
    expect(first.ok).toBe(true);
    store.close();
    mutateStoredReceipt(databasePath, mutate);
    store = new SqliteGameStore(databasePath, "test-app");
    const replay = store.submitIntent(createIntent(intentId));
    expect(replay).toMatchObject({ ok: false, error: { code: "PERSISTENCE_UNAVAILABLE" } });
    if (!replay.ok) {
      expect(replay.error.message).not.toMatch(/must-not-leak|secret|tampered|SQL|path|stack/i);
    }
  });

  it("does not treat a self-consistent checksum as a schema bypass", () => {
    const first = store.submitIntent(createIntent("intent-schema-bypass"));
    expect(first.ok).toBe(true);
    store.close();
    mutateStoredState(databasePath, (state) => {
      (state.character as Record<string, unknown>).coreStats = {
        physique: 15,
        perception: 15,
        will: 15,
        knowledge: 15,
        hidden: 99,
      };
    });
    store = new SqliteGameStore(databasePath, "test-app");
    expect(() => store.getBootstrap()).toThrow();
  });

  it("rejects a self-consistent state that invents an R2 cash or stat change", () => {
    const first = store.submitIntent(createIntent("intent-default-bypass"));
    expect(first.ok).toBe(true);
    store.close();
    mutateStoredState(databasePath, (state) => {
      state.cashPence = 1;
    });
    store = new SqliteGameStore(databasePath, "test-app");
    expect(() => store.getBootstrap()).toThrow();
  });

  it("fails closed when SQLite summary columns disagree with the valid state", () => {
    const first = store.submitIntent(createIntent("intent-summary-drift"));
    expect(first.ok).toBe(true);
    store.close();
    const database = new DatabaseSync(databasePath);
    database.prepare("UPDATE runs SET revision = revision + 1 WHERE lifecycle = 'ACTIVE'").run();
    database.close();
    store = new SqliteGameStore(databasePath, "test-app");
    expect(() => store.getBootstrap()).toThrow();
  });

  it("keeps checksum and public state aligned after an action", () => {
    const first = store.submitIntent(createIntent("intent-checksum"));
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error("expected creation to commit");
    }
    const action = store.submitIntent(actionIntent("intent-checksum-action", first.value.runId, 1, "WORK"));
    expect(action.ok).toBe(true);
    if (!action.ok) {
      throw new Error("expected action to commit");
    }
    expect(action.value.stateChecksum).toBe(action.value.publicState.stateChecksum);
    expect(store.getBootstrap().activeState).toEqual(action.value.publicState);
    expect(action.value.publicState.lastAction).not.toBeNull();
  });
});
