import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  R1_FIXTURE_DEFAULTS,
  RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
  type BootstrapProjection,
  type BridgeResult,
  type CommitReceipt,
  type IntentEnvelope,
  type PublicError,
  type PublicGameState,
  type PublicRunSummary,
} from "../shared/contracts.js";
import { createR1FixtureState, hasValidStateChecksum } from "../domain/fixture.js";
import { stableStringify } from "../domain/canonical.js";
import { makePublicError } from "../domain/public-error.js";
import { validateR1Intent, type ValidatedR1Intent } from "../content/r1-validation.js";

type DatabaseRow = Record<string, unknown>;

const PUBLIC_STATE_KEYS = [
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
];
const PUBLIC_CHARACTER_KEYS = ["coreStats", "displayName", "origin", "resources", "sequence"];
const PUBLIC_CORE_STATS_KEYS = ["knowledge", "perception", "physique", "will"];
const PUBLIC_RESOURCES_KEYS = ["health", "mind", "pollution", "spirituality"];
const PUBLIC_RESOURCE_METER_KEYS = ["current", "max"];
const PUBLIC_CHRONICLE_KEYS = ["id", "summary", "title", "week"];
const RECEIPT_KEYS = [
  "committedAt",
  "intentId",
  "newRevision",
  "previousRevision",
  "publicState",
  "replayed",
  "runId",
  "stateChecksum",
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/u;

class PublicOperationError extends Error {
  public constructor(public readonly publicError: PublicError) {
    super(publicError.code);
    this.name = "PublicOperationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  return (
    actualKeys.length === expected.length &&
    actualKeys.every((key, index) => key === expected[index])
  );
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return isSafeInteger(value) && value >= minimum && value <= maximum;
}

function isSafeText(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximumLength &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) && timestamp.toISOString() === value;
}

function isResourceMeter(value: unknown, maximum: number): boolean {
  if (!isRecord(value) || !hasExactKeys(value, PUBLIC_RESOURCE_METER_KEYS)) {
    return false;
  }

  return (
    isBoundedInteger(value.current, 0, maximum) &&
    isBoundedInteger(value.max, 0, maximum) &&
    value.current <= value.max
  );
}

function requiredString(row: DatabaseRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`Invalid persisted ${column}`);
  }

  return value;
}

function requiredRevision(row: DatabaseRow, column: string): number {
  const value = row[column];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid persisted ${column}`);
  }

  return value;
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function isPublicGameState(value: unknown): value is PublicGameState {
  if (!isRecord(value) || !hasExactKeys(value, PUBLIC_STATE_KEYS)) {
    return false;
  }

  const character = value.character;
  if (!isRecord(character) || !hasExactKeys(character, PUBLIC_CHARACTER_KEYS)) {
    return false;
  }

  const coreStats = character.coreStats;
  if (
    !isRecord(coreStats) ||
    !hasExactKeys(coreStats, PUBLIC_CORE_STATS_KEYS) ||
    !PUBLIC_CORE_STATS_KEYS.every((key) => isBoundedInteger(coreStats[key], 0, 500))
  ) {
    return false;
  }

  const resources = character.resources;
  if (
    !isRecord(resources) ||
    !hasExactKeys(resources, PUBLIC_RESOURCES_KEYS) ||
    !isResourceMeter(resources.health, 100) ||
    !isResourceMeter(resources.mind, 100) ||
    !isResourceMeter(resources.spirituality, 500) ||
    !isBoundedInteger(resources.pollution, 0, 100)
  ) {
    return false;
  }

  if (
    !Array.isArray(value.chronicle) ||
    !value.chronicle.every((entry) => {
      if (!isRecord(entry) || !hasExactKeys(entry, PUBLIC_CHRONICLE_KEYS)) {
        return false;
      }

      return (
        isSafeText(entry.id, 128) &&
        isSafeText(entry.summary, 512) &&
        isSafeText(entry.title, 256) &&
        isBoundedInteger(entry.week, 1, Number.MAX_SAFE_INTEGER)
      );
    })
  ) {
    return false;
  }

  return (
    value.contractVersion === CONTRACT_VERSION &&
    value.ruleVersion === RULE_VERSION &&
    value.contentVersion === CONTENT_VERSION &&
    isUuid(value.runId) &&
    value.lifecycle === "ACTIVE" &&
    isSafeInteger(value.revision) &&
    value.revision >= 1 &&
    isSafeInteger(value.week) &&
    value.week >= 1 &&
    isSafeInteger(value.availableActions) &&
    value.availableActions >= 0 &&
    isSafeInteger(value.cashPence) &&
    isSafeText(character.displayName, 80) &&
    character.origin === "LOEN" &&
    character.sequence === "ORDINARY" &&
    typeof value.stateChecksum === "string" &&
    CHECKSUM_PATTERN.test(value.stateChecksum)
  );
}

function parsePersistedState(value: string): PublicGameState {
  const state = parseJson(value);
  if (!isPublicGameState(state) || !hasValidStateChecksum(state)) {
    throw new Error("Invalid persisted public state");
  }

  return state;
}

function parsePersistedReceipt(value: string): CommitReceipt {
  const receipt = parseJson(value);
  if (!isRecord(receipt) || !hasExactKeys(receipt, RECEIPT_KEYS)) {
    throw new Error("Invalid persisted receipt");
  }

  const publicState = receipt.publicState;
  if (
    !isSafeText(receipt.intentId, 128) ||
    !isUuid(receipt.runId) ||
    typeof receipt.previousRevision !== "number" ||
    typeof receipt.newRevision !== "number" ||
    !Number.isSafeInteger(receipt.previousRevision) ||
    !Number.isSafeInteger(receipt.newRevision) ||
    receipt.previousRevision < 0 ||
    receipt.newRevision < 0 ||
    !isPublicGameState(publicState) ||
    receipt.newRevision !== publicState.revision ||
    receipt.previousRevision + 1 !== receipt.newRevision ||
    typeof receipt.stateChecksum !== "string" ||
    !CHECKSUM_PATTERN.test(receipt.stateChecksum) ||
    !isIsoTimestamp(receipt.committedAt) ||
    receipt.replayed !== false ||
    !hasValidStateChecksum(publicState) ||
    receipt.stateChecksum !== publicState.stateChecksum ||
    receipt.runId !== publicState.runId
  ) {
    throw new Error("Invalid persisted receipt");
  }

  return receipt as unknown as CommitReceipt;
}

function rollback(database: DatabaseSync): void {
  try {
    if (database.isTransaction) {
      database.exec("ROLLBACK");
    }
  } catch {
    // The original failure is the only one that can cross the persistence boundary.
  }
}

export class SqliteGameStore {
  private readonly database: DatabaseSync;

  public constructor(
    databasePath: string,
    private readonly appVersion = "0.1.0",
  ) {
    this.database = new DatabaseSync(databasePath, {
      enableForeignKeyConstraints: true,
      timeout: 5_000,
    });
    this.migrate();
  }

  public getBootstrap(): BootstrapProjection {
    this.ensureOpen();

    const rows = this.database
      .prepare(
        `SELECT run_id, lifecycle, display_name, week, revision, updated_at
         FROM runs
         ORDER BY updated_at DESC, run_id DESC`,
      )
      .all() as DatabaseRow[];

    const runs = rows.map((row) => this.toRunSummary(row));
    const activeRow = rows.find((row) => row.lifecycle === "ACTIVE");
    const activeState = activeRow
      ? this.readActiveState(requiredString(activeRow, "run_id"))
      : null;

    return {
      appVersion: this.appVersion,
      contractVersion: CONTRACT_VERSION,
      storageSchemaVersion: STORAGE_SCHEMA_VERSION,
      storageStatus: "READY",
      lifecycle: activeState === null ? "NO_RUN" : "ACTIVE",
      runs,
      activeState,
    };
  }

  public submitIntent(input: unknown): BridgeResult<CommitReceipt> {
    const validation = validateR1Intent(input);
    if (!validation.ok) {
      return validation;
    }

    try {
      return this.submitValidatedIntent(validation.value);
    } catch (error) {
      if (error instanceof PublicOperationError) {
        return { ok: false, error: error.publicError };
      }

      return { ok: false, error: makePublicError("PERSISTENCE_UNAVAILABLE") };
    }
  }

  public close(): void {
    if (this.database.isOpen) {
      this.database.close();
    }
  }

  private migrate(): void {
    this.ensureOpen();
    const row = this.database.prepare("PRAGMA user_version").get() as DatabaseRow | undefined;
    const version = row?.user_version;

    if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
      throw new Error("Invalid SQLite schema version");
    }

    if (version > STORAGE_SCHEMA_VERSION) {
      throw new Error("Unsupported SQLite schema version");
    }

    if (version === 0) {
      this.applySchemaVersionOne();
      return;
    }

    this.assertSchemaVersionOne();
  }

  private applySchemaVersionOne(): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS runs (
          run_id TEXT PRIMARY KEY NOT NULL,
          lifecycle TEXT NOT NULL CHECK (lifecycle IN ('ACTIVE', 'ARCHIVED')),
          display_name TEXT NOT NULL,
          week INTEGER NOT NULL,
          revision INTEGER NOT NULL,
          updated_at TEXT NOT NULL,
          state_json TEXT NOT NULL,
          state_checksum TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS intent_receipts (
          intent_id TEXT PRIMARY KEY NOT NULL,
          envelope_json TEXT NOT NULL,
          run_id TEXT NOT NULL,
          receipt_json TEXT NOT NULL,
          committed_at TEXT NOT NULL,
          FOREIGN KEY (run_id) REFERENCES runs(run_id)
        );

        CREATE INDEX IF NOT EXISTS runs_lifecycle_updated_at
          ON runs (lifecycle, updated_at DESC);
      `);

      this.database
        .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(STORAGE_SCHEMA_VERSION, new Date().toISOString());
      this.database.exec(`PRAGMA user_version = ${STORAGE_SCHEMA_VERSION}`);
      this.database.exec("COMMIT");
    } catch (error) {
      rollback(this.database);
      throw error;
    }
  }

  private assertSchemaVersionOne(): void {
    const requiredTables = ["schema_migrations", "runs", "intent_receipts"];
    const rows = this.database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN (?, ?, ?)`,
      )
      .all(...requiredTables) as DatabaseRow[];
    const names = new Set(rows.map((row) => row.name));

    if (requiredTables.some((table) => !names.has(table))) {
      throw new Error("SQLite schema is incomplete");
    }
  }

  private submitValidatedIntent(intent: ValidatedR1Intent): BridgeResult<CommitReceipt> {
    this.ensureOpen();
    const envelopeJson = stableStringify(intent);
    this.database.exec("BEGIN IMMEDIATE");

    try {
      const existing = this.database
        .prepare("SELECT envelope_json, receipt_json, run_id FROM intent_receipts WHERE intent_id = ?")
        .get(intent.intentId) as DatabaseRow | undefined;

      if (existing !== undefined) {
        const storedEnvelope = requiredString(existing, "envelope_json");
        if (storedEnvelope !== envelopeJson) {
          throw new PublicOperationError(makePublicError("DUPLICATE_INTENT_CONFLICT"));
        }

        const receipt = parsePersistedReceipt(requiredString(existing, "receipt_json"));
        const persistedRunId = requiredString(existing, "run_id");
        if (receipt.intentId !== intent.intentId || receipt.runId !== persistedRunId) {
          throw new Error("Persisted receipt identity does not match intent row");
        }

        const persistedState = this.readRunState(persistedRunId);
        if (stableStringify(persistedState) !== stableStringify(receipt.publicState)) {
          throw new Error("Persisted receipt and state disagree");
        }

        this.database.exec("COMMIT");
        return { ok: true, value: { ...receipt, replayed: true } };
      }

      const currentRevision = this.readCurrentRevision();
      if (this.hasActiveRun() || intent.expectedRevision !== currentRevision) {
        throw new PublicOperationError(makePublicError("REVISION_CONFLICT", currentRevision));
      }

      const runId = randomUUID();
      const committedAt = new Date().toISOString();
      const publicState = createR1FixtureState(runId, intent.payload.displayName);
      const receipt: CommitReceipt = {
        intentId: intent.intentId,
        runId,
        previousRevision: currentRevision,
        newRevision: publicState.revision,
        stateChecksum: publicState.stateChecksum,
        committedAt,
        replayed: false,
        publicState,
      };

      this.database
        .prepare(
          `INSERT INTO runs
           (run_id, lifecycle, display_name, week, revision, updated_at, state_json, state_checksum)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          runId,
          publicState.lifecycle,
          publicState.character.displayName,
          publicState.week,
          publicState.revision,
          committedAt,
          stableStringify(publicState),
          publicState.stateChecksum,
        );
      this.database
        .prepare(
          `INSERT INTO intent_receipts
           (intent_id, envelope_json, run_id, receipt_json, committed_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(intent.intentId, envelopeJson, runId, stableStringify(receipt), committedAt);
      this.database.exec("COMMIT");

      return { ok: true, value: receipt };
    } catch (error) {
      rollback(this.database);
      throw error;
    }
  }

  private readCurrentRevision(): number {
    const row = this.database
      .prepare(
        `SELECT run_id, revision FROM runs
         WHERE lifecycle = 'ACTIVE'
         ORDER BY updated_at DESC, run_id DESC
         LIMIT 1`,
      )
      .get() as DatabaseRow | undefined;

    if (row === undefined) {
      return 0;
    }

    const runId = requiredString(row, "run_id");
    const revision = requiredRevision(row, "revision");
    const state = this.readRunState(runId);
    if (state.revision !== revision) {
      throw new Error("Persisted run revision does not match state");
    }

    return revision;
  }

  private hasActiveRun(): boolean {
    const row = this.database
      .prepare("SELECT run_id FROM runs WHERE lifecycle = 'ACTIVE' LIMIT 1")
      .get() as DatabaseRow | undefined;

    return row !== undefined;
  }

  private readActiveState(runId: string): PublicGameState {
    return this.readRunState(runId, true);
  }

  private readRunState(runId: string, activeOnly = false): PublicGameState {
    const row = this.database
      .prepare(
        activeOnly
          ? "SELECT run_id, lifecycle, state_json, state_checksum FROM runs WHERE run_id = ? AND lifecycle = 'ACTIVE'"
          : "SELECT run_id, lifecycle, state_json, state_checksum FROM runs WHERE run_id = ?",
      )
      .get(runId) as DatabaseRow | undefined;

    if (row === undefined) {
      throw new Error("Active run is missing");
    }

    const state = parsePersistedState(requiredString(row, "state_json"));
    if (
      row.lifecycle !== "ACTIVE" &&
      row.lifecycle !== "ARCHIVED"
    ) {
      throw new Error("Invalid persisted lifecycle");
    }

    if (
      requiredString(row, "run_id") !== runId ||
      requiredString(row, "state_checksum") !== state.stateChecksum
    ) {
      throw new Error("Active run identity does not match");
    }

    return state;
  }

  private toRunSummary(row: DatabaseRow): PublicRunSummary {
    const lifecycle = row.lifecycle;
    if (lifecycle !== "ACTIVE" && lifecycle !== "ARCHIVED") {
      throw new Error("Invalid persisted lifecycle");
    }

    const runId = requiredString(row, "run_id");
    const displayName = requiredString(row, "display_name");
    const week = requiredRevision(row, "week");
    const revision = requiredRevision(row, "revision");
    const updatedAt = requiredString(row, "updated_at");
    if (
      !isUuid(runId) ||
      !isSafeText(displayName, 80) ||
      week < 1 ||
      !isIsoTimestamp(updatedAt)
    ) {
      throw new Error("Invalid persisted run summary");
    }

    return {
      runId,
      lifecycle,
      displayName,
      week,
      revision,
      updatedAt,
    };
  }

  private ensureOpen(): void {
    if (!this.database.isOpen) {
      throw new Error("SQLite database is closed");
    }
  }
}

export function unavailableBootstrap(appVersion: string): BootstrapProjection {
  return {
    appVersion,
    contractVersion: CONTRACT_VERSION,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    storageStatus: "UNAVAILABLE",
    lifecycle: "NO_RUN",
    runs: [],
    activeState: null,
  };
}
