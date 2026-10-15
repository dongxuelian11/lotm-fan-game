import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  R2_FIXTURE_DEFAULTS,
  RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
  type BootstrapProjection,
  type BridgeResult,
  type CommitReceipt,
  type PublicCharacterCreationCatalogue,
  type PublicError,
  type PublicGameState,
  type PublicRunSummary,
} from "../shared/contracts.js";
import {
  applyWeeklyAction,
  createR2CharacterRunState,
  hasValidStateChecksum,
  LEGACY_FIXTURE,
} from "../domain/fixture.js";
import { isValidGameDate } from "../domain/game-calendar.js";
import { stableStringify } from "../domain/canonical.js";
import { makePublicError } from "../domain/public-error.js";
import {
  LEGACY_NO_SPECIALIZATION,
  LEGACY_NO_SPECIALIZATION_ID,
  R2_FIXTURE_CATALOGUE,
} from "../content/r2-catalogue.js";
import {
  validateCharacterCreationCatalogue,
  validateR2Intent,
  type ValidatedR2Intent,
} from "../content/r2-validation.js";

type DatabaseRow = Record<string, unknown>;

const R1_CONTRACT_VERSION = "r1-v1" as const;
const PUBLIC_STATE_KEYS = [
  "activeEvent",
  "availableActions",
  "cashPence",
  "character",
  "clues",
  "chronicle",
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
] as const;
const PUBLIC_CHARACTER_KEYS = [
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
] as const;
const PUBLIC_CORE_STATS_KEYS = ["knowledge", "perception", "physique", "will"] as const;
const PUBLIC_RESOURCES_KEYS = ["health", "mind", "pollution", "spirituality"] as const;
const PUBLIC_RESOURCE_METER_KEYS = ["current", "max"] as const;
const PUBLIC_CHOICE_KEYS = ["id", "label"] as const;
const PUBLIC_PORTRAIT_KEYS = ["appearanceTags", "id", "label"] as const;
const PUBLIC_ORIGIN_KEYS = ["id", "label", "tier"] as const;
const PUBLIC_PROFESSION_KEYS = ["id", "label", "legality"] as const;
const PUBLIC_ACTION_RESULT_KEYS = [
  "action",
  "availableActionsAfter",
  "availableActionsBefore",
  "consequences",
  "dateAfter",
  "dateBefore",
  "feedbackEntryId",
  "resolution",
  "summary",
  "title",
  "weekAdvanced",
  "weekAfter",
  "weekBefore",
] as const;
const PUBLIC_CHRONICLE_KEYS = ["date", "id", "summary", "title", "week"] as const;
const PUBLIC_CHECK_KEYS = [
  "ability",
  "baseAbility",
  "chance",
  "difficulty",
  "effectiveAbility",
  "modifiers",
  "roll",
  "tier",
] as const;
const PUBLIC_KNOWLEDGE_KEYS = [
  "acquiredOn",
  "id",
  "sourceLabel",
  "summary",
  "title",
  "visibility",
] as const;
const PUBLIC_FEEDBACK_KEYS = ["date", "id", "kind", "summary", "title", "visibility"] as const;
const RECEIPT_KEYS = [
  "committedAt",
  "intentId",
  "newRevision",
  "previousRevision",
  "publicState",
  "replayed",
  "runId",
  "stateChecksum",
] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/u;

class PublicOperationError extends Error {
  public constructor(public readonly publicError: PublicError) {
    super(publicError.code);
    this.name = "PublicOperationError";
  }
}

interface ActiveRun {
  readonly state: PublicGameState;
}

function isRecord(value: unknown): value is DatabaseRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: DatabaseRow, expectedKeys: readonly string[]): boolean {
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

function isSafeText(value: unknown, maximumLength: number, requireTrimmed = false): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximumLength &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    (!requireTrimmed || value === value.trim())
  );
}

function isSafeId(value: unknown): value is string {
  return isSafeText(value, 128, true);
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

function isChoice(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, PUBLIC_CHOICE_KEYS) &&
    isResolvedChoiceFields(value)
  );
}

function isResolvedChoiceFields(value: DatabaseRow): boolean {
  return isSafeId(value.id) && isSafeText(value.label, 128);
}

function isPortrait(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, PUBLIC_PORTRAIT_KEYS) &&
    isResolvedChoiceFields(value) &&
    Array.isArray(value.appearanceTags) &&
    value.appearanceTags.length <= 16 &&
    value.appearanceTags.every((tag) => isSafeText(tag, 64, true)) &&
    new Set(value.appearanceTags).size === value.appearanceTags.length
  );
}

function isOrigin(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, PUBLIC_ORIGIN_KEYS) &&
    isResolvedChoiceFields(value) &&
    (value.tier === "POOR" ||
      value.tier === "LABOR" ||
      value.tier === "LOWER_MIDDLE" ||
      value.tier === "UPPER_MIDDLE" ||
      value.tier === "UPPER")
  );
}

function isProfession(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, PUBLIC_PROFESSION_KEYS) &&
    isResolvedChoiceFields(value) &&
    (value.legality === "LEGAL" || value.legality === "GRAY" || value.legality === "ILLEGAL")
  );
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

function isPublicAction(value: unknown): value is "WORK" | "LEARN" | "INVESTIGATE" | "REST" {
  return value === "WORK" || value === "LEARN" || value === "INVESTIGATE" || value === "REST";
}

function isPublicModifier(value: unknown): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["source", "value"]) &&
    isSafeText(value.source, 128, true) &&
    isBoundedInteger(value.value, -500, 500);
}

function isPublicCheckResult(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, PUBLIC_CHECK_KEYS)) return false;
  return (
    value.ability === "physique" || value.ability === "perception" ||
    value.ability === "will" || value.ability === "knowledge"
  ) && isBoundedInteger(value.baseAbility, 0, 500) &&
    isBoundedInteger(value.difficulty, 0, 500) &&
    Array.isArray(value.modifiers) && value.modifiers.length <= 16 && value.modifiers.every(isPublicModifier) &&
    isBoundedInteger(value.effectiveAbility, 0, 1000) &&
    isBoundedInteger(value.chance, 5, 95) &&
    isBoundedInteger(value.roll, 1, 100) &&
    (value.tier === "GREAT_SUCCESS" || value.tier === "SUCCESS" ||
      value.tier === "FAILURE" || value.tier === "GREAT_FAILURE");
}

function isPublicConsequence(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const actualKeys = Object.keys(value);
  const requiredKeys = ["applied", "change", "condition", "id", "source", "summary", "target"];
  const optionalKeys = ["numericValue", "referenceId"];
  if (actualKeys.some((key) => !requiredKeys.includes(key) && !optionalKeys.includes(key)) ||
    requiredKeys.some((key) => !actualKeys.includes(key))) return false;
  return isSafeId(value.id) && isSafeText(value.source, 128) && isSafeText(value.summary, 512) &&
    typeof value.applied === "boolean" &&
    (value.target === "CORE_STAT" || value.target === "RESOURCE" || value.target === "CASH" ||
      value.target === "KNOWLEDGE" || value.target === "CLUE" || value.target === "EVENT" ||
      value.target === "WORLD_STATE") &&
    (value.change === "ADD" || value.change === "SET" || value.change === "CREATE" ||
      value.change === "QUEUE" || value.change === "REMOVE") &&
    (value.condition === "ALWAYS" || value.condition === "GREAT_SUCCESS" || value.condition === "SUCCESS" ||
      value.condition === "FAILURE" || value.condition === "GREAT_FAILURE") &&
    (!Object.prototype.hasOwnProperty.call(value, "numericValue") || isSafeInteger(value.numericValue)) &&
    (!Object.prototype.hasOwnProperty.call(value, "referenceId") || isSafeId(value.referenceId));
}

function isPublicKnowledgeRecord(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, PUBLIC_KNOWLEDGE_KEYS) &&
    isSafeId(value.id) && isSafeText(value.title, 256) && isSafeText(value.summary, 512) &&
    (value.visibility === "CONFIRMED" || value.visibility === "RUMOR") &&
    isValidGameDate(value.acquiredOn) && isSafeText(value.sourceLabel, 128);
}

function isPublicFeedback(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, PUBLIC_FEEDBACK_KEYS) &&
    isSafeId(value.id) && isValidGameDate(value.date) &&
    (value.kind === "ACTION" || value.kind === "WORLD_PULSE" || value.kind === "EVENT_RESULT") &&
    (value.visibility === "CONFIRMED" || value.visibility === "RUMOR") &&
    isSafeText(value.title, 256) && isSafeText(value.summary, 512);
}

function isPublicActionResult(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, PUBLIC_ACTION_RESULT_KEYS)) {
    return false;
  }

  if (
    !isPublicAction(value.action) ||
    !isSafeText(value.title, 256) ||
    !isSafeText(value.summary, 512) ||
    !isBoundedInteger(value.weekBefore, 1, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(value.weekAfter, 1, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(value.availableActionsBefore, 1, 3) ||
    !isBoundedInteger(value.availableActionsAfter, 0, 3) ||
    typeof value.weekAdvanced !== "boolean" ||
    !isValidGameDate(value.dateBefore) ||
    !isValidGameDate(value.dateAfter) ||
    !isSafeId(value.feedbackEntryId) ||
    (value.resolution !== null && !isPublicCheckResult(value.resolution)) ||
    !Array.isArray(value.consequences) || value.consequences.length > 64 ||
    !value.consequences.every(isPublicConsequence)
  ) {
    return false;
  }

  return value.weekAdvanced
    ? value.weekAfter === value.weekBefore + 1 &&
        value.availableActionsBefore === 1 &&
        value.availableActionsAfter === 3
    : value.weekAfter === value.weekBefore &&
        value.availableActionsAfter === value.availableActionsBefore - 1;
}

function isPublicChronicle(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= 4096 &&
    value.every((entry) => {
      if (!isRecord(entry) || !hasExactKeys(entry, PUBLIC_CHRONICLE_KEYS)) {
        return false;
      }

      return (
        isSafeId(entry.id) &&
        isSafeText(entry.summary, 512) &&
        isSafeText(entry.title, 256) &&
        isBoundedInteger(entry.week, 1, Number.MAX_SAFE_INTEGER) &&
        isValidGameDate(entry.date)
      );
    })
  );
}

function matchesFixtureChoiceReferences(character: DatabaseRow): boolean {
  const birthplace = character.birthplace as DatabaseRow;
  const portrait = character.portrait as DatabaseRow;
  const origin = character.origin as DatabaseRow;
  const profession = character.profession as DatabaseRow;
  const flaw = character.flaw as DatabaseRow;
  const specialization = character.specialization as DatabaseRow;
  const traits = character.traits as DatabaseRow[];
  const expectedBirthplace = R2_FIXTURE_CATALOGUE.birthplaces.find(
    (choice) => choice.id === birthplace.id,
  );
  const expectedPortrait = R2_FIXTURE_CATALOGUE.portraits.find(
    (choice) => choice.id === portrait.id,
  );
  const expectedOrigin = R2_FIXTURE_CATALOGUE.origins.find((choice) => choice.id === origin.id);
  const expectedProfession = R2_FIXTURE_CATALOGUE.professions.find(
    (choice) => choice.id === profession.id,
  );
  const expectedFlaw = R2_FIXTURE_CATALOGUE.flaws.find((choice) => choice.id === flaw.id);
  const hasLegacySpecialization = isChoice(specialization) &&
    specialization.id === LEGACY_NO_SPECIALIZATION_ID &&
    specialization.label === LEGACY_NO_SPECIALIZATION.label;
  const expectedTraits = traits.map((trait) =>
    R2_FIXTURE_CATALOGUE.traits.find((choice) => choice.id === trait.id),
  );
  return (
    expectedBirthplace !== undefined &&
    expectedBirthplace.label === birthplace.label &&
    expectedPortrait !== undefined &&
    expectedPortrait.label === portrait.label &&
    JSON.stringify(expectedPortrait.appearanceTags) === JSON.stringify(portrait.appearanceTags) &&
    expectedOrigin !== undefined &&
    expectedOrigin.label === origin.label &&
    expectedOrigin.tier === origin.tier &&
    expectedProfession !== undefined &&
    expectedProfession.label === profession.label &&
    expectedProfession.legality === profession.legality &&
    expectedFlaw !== undefined &&
    expectedFlaw.label === flaw.label &&
    hasLegacySpecialization &&
    expectedTraits.length === 2 &&
    expectedTraits.every(
      (trait, index) => trait !== undefined && trait.label === traits[index]!.label,
    )
  );
}

function matchesFixtureDefaults(state: PublicGameState): boolean {
  return (
    state.cashPence === R2_FIXTURE_DEFAULTS.cashPence &&
    state.character.coreStats.physique === R2_FIXTURE_DEFAULTS.coreStats.physique &&
    state.character.coreStats.perception === R2_FIXTURE_DEFAULTS.coreStats.perception &&
    state.character.coreStats.will === R2_FIXTURE_DEFAULTS.coreStats.will &&
    state.character.coreStats.knowledge === R2_FIXTURE_DEFAULTS.coreStats.knowledge &&
    state.character.resources.health.current === R2_FIXTURE_DEFAULTS.resources.health.current &&
    state.character.resources.health.max === R2_FIXTURE_DEFAULTS.resources.health.max &&
    state.character.resources.mind.current === R2_FIXTURE_DEFAULTS.resources.mind.current &&
    state.character.resources.mind.max === R2_FIXTURE_DEFAULTS.resources.mind.max &&
    state.character.resources.spirituality.current === R2_FIXTURE_DEFAULTS.resources.spirituality.current &&
    state.character.resources.spirituality.max === R2_FIXTURE_DEFAULTS.resources.spirituality.max &&
    state.character.resources.pollution === R2_FIXTURE_DEFAULTS.resources.pollution
  );
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

  const traits = character.traits;
  if (
    !Array.isArray(traits) ||
    traits.length !== 2 ||
    !traits.every(isChoice) ||
    new Set(traits.map((trait) => (trait as DatabaseRow).id)).size !== traits.length
  ) {
    return false;
  }

  if (
    !isBoundedInteger(character.age, 18, 45) ||
    !isSafeText(character.displayName, 80, true) ||
    !isSafeText(character.appearanceDescription, 240, true) ||
    !isChoice(character.birthplace) ||
    !isPortrait(character.portrait) ||
    !isOrigin(character.origin) ||
    !isProfession(character.profession) ||
    !isChoice(character.flaw) ||
    !isChoice(character.specialization) ||
    (character.sex !== "FEMALE" && character.sex !== "MALE") ||
    character.originCountry !== "LOEN" ||
    character.sequence !== "ORDINARY"
  ) {
    return false;
  }

  if (
    !isPublicChronicle(value.chronicle) ||
    !isValidGameDate(value.currentDate) ||
    !Array.isArray(value.knowledgeRecords) || value.knowledgeRecords.length !== 0 ||
    !value.knowledgeRecords.every(isPublicKnowledgeRecord) ||
    !Array.isArray(value.clues) || value.clues.length !== 0 ||
    !value.clues.every(isPublicKnowledgeRecord) ||
    !Array.isArray(value.worldFeedback) || value.worldFeedback.length > 4096 ||
    !value.worldFeedback.every(isPublicFeedback) ||
    value.activeEvent !== null || !Array.isArray(value.pendingEvents) || value.pendingEvents.length !== 0 ||
    value.lastEventResolution !== null ||
    (value.lastAction !== null && !isPublicActionResult(value.lastAction))
  ) {
    return false;
  }

  if (
    value.contractVersion !== CONTRACT_VERSION ||
    value.ruleVersion !== RULE_VERSION ||
    value.contentVersion !== CONTENT_VERSION ||
    !isUuid(value.runId) ||
    value.lifecycle !== "ACTIVE" ||
    !isBoundedInteger(value.revision, 1, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(value.week, 1, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(value.availableActions, 0, 3) ||
    !isBoundedInteger(value.cashPence, 0, Number.MAX_SAFE_INTEGER) ||
    !matchesFixtureDefaults(value as unknown as PublicGameState) ||
    !matchesFixtureChoiceReferences(character) ||
    !CHECKSUM_PATTERN.test(typeof value.stateChecksum === "string" ? value.stateChecksum : "")
  ) {
    return false;
  }

  if (
    !(value.chronicle as readonly DatabaseRow[]).every(
      (entry) => {
        const stateWeek = value.week as number;
        return isBoundedInteger(entry.week, 1, stateWeek) && entry.week <= stateWeek;
      },
    )
  ) {
    return false;
  }

  if (value.lastAction !== null) {
    const lastAction = value.lastAction as DatabaseRow;
    if (
      lastAction.weekAfter !== value.week ||
      lastAction.availableActionsAfter !== value.availableActions
    ) {
      return false;
    }
  }

  return true;
}

export function parsePersistedState(value: string): PublicGameState {
  const state = JSON.parse(value) as unknown;
  if (!isPublicGameState(state) || !hasValidStateChecksum(state)) {
    throw new Error("Invalid persisted public state");
  }

  return state;
}

export function parsePersistedReceipt(value: string): CommitReceipt {
  const receipt = JSON.parse(value) as unknown;
  if (!isRecord(receipt) || !hasExactKeys(receipt, RECEIPT_KEYS)) {
    throw new Error("Invalid persisted receipt");
  }

  const publicState = receipt.publicState;
  if (
    !isSafeId(receipt.intentId) ||
    !isUuid(receipt.runId) ||
    !isBoundedInteger(receipt.previousRevision, 0, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(receipt.newRevision, 1, Number.MAX_SAFE_INTEGER) ||
    !isPublicGameState(publicState) ||
    receipt.newRevision !== (publicState as PublicGameState).revision ||
    receipt.previousRevision + 1 !== receipt.newRevision ||
    typeof receipt.stateChecksum !== "string" ||
    !CHECKSUM_PATTERN.test(receipt.stateChecksum) ||
    !isIsoTimestamp(receipt.committedAt) ||
    receipt.replayed !== false ||
    !hasValidStateChecksum(publicState as PublicGameState) ||
    receipt.stateChecksum !== (publicState as PublicGameState).stateChecksum ||
    receipt.runId !== (publicState as PublicGameState).runId
  ) {
    throw new Error("Invalid persisted receipt");
  }

  return receipt as unknown as CommitReceipt;
}

function parseJsonRecord(value: string): DatabaseRow {
  const parsed = JSON.parse(value) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Invalid persisted JSON record");
  }

  return parsed;
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

function requiredString(row: DatabaseRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`Invalid persisted ${column}`);
  }

  return value;
}

function requiredInteger(row: DatabaseRow, column: string): number {
  const value = row[column];
  if (!isSafeInteger(value)) {
    throw new Error(`Invalid persisted ${column}`);
  }

  return value;
}

function tableColumns(database: DatabaseSync, tableName: string): Set<string> {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all() as DatabaseRow[];
  return new Set(rows.map((row) => row.name).filter((name): name is string => typeof name === "string"));
}

function cloneFixtureCatalogue(): PublicCharacterCreationCatalogue {
  return {
    ...R2_FIXTURE_CATALOGUE,
    birthplaces: R2_FIXTURE_CATALOGUE.birthplaces.map((choice) => ({ ...choice })),
    portraits: R2_FIXTURE_CATALOGUE.portraits.map((choice) => ({
      ...choice,
      appearanceTags: [...choice.appearanceTags],
    })),
    origins: R2_FIXTURE_CATALOGUE.origins.map((choice) => ({ ...choice })),
    professions: R2_FIXTURE_CATALOGUE.professions.map((choice) => ({ ...choice })),
    traits: R2_FIXTURE_CATALOGUE.traits.map((choice) => ({
      ...choice,
      incompatibleTraitIds: [...choice.incompatibleTraitIds],
    })),
    flaws: R2_FIXTURE_CATALOGUE.flaws.map((choice) => ({ ...choice })),
    compatibility: R2_FIXTURE_CATALOGUE.compatibility.map((rule) => ({ ...rule })),
  } as unknown as PublicCharacterCreationCatalogue;
}

function isR1ActiveFixtureState(value: string): boolean {
  const state = parseJsonRecord(value);
  return state.contractVersion === R1_CONTRACT_VERSION && state.lifecycle === "ACTIVE";
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
    if (!validateCharacterCreationCatalogue(R2_FIXTURE_CATALOGUE)) {
      throw new Error("R2 fixture catalogue is invalid");
    }

    const rows = this.database
      .prepare(
        `SELECT run_id, lifecycle, display_name, week, revision, updated_at, state_schema_version
         FROM runs
         ORDER BY updated_at DESC, run_id DESC`,
      )
      .all() as DatabaseRow[];

    const runs = rows.map((row) => this.toRunSummary(row));
    const activeRows = rows.filter((row) => row.lifecycle === "ACTIVE");
    if (activeRows.length > 1) {
      throw new Error("Multiple active runs are not supported");
    }
    const activeState = activeRows.length === 1
      ? this.readActiveState(requiredString(activeRows[0]!, "run_id"))
      : null;

    return {
      appVersion: this.appVersion,
      contractVersion: CONTRACT_VERSION,
      storageSchemaVersion: STORAGE_SCHEMA_VERSION,
      storageStatus: "READY",
      lifecycle: activeState === null ? "NO_RUN" : "ACTIVE",
      runs,
      activeState,
      characterCreation: cloneFixtureCatalogue(),
    };
  }

  public submitIntent(input: unknown): BridgeResult<CommitReceipt> {
    const validation = validateR2Intent(input);
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

    if (!isSafeInteger(version) || version < 0) {
      throw new Error("Invalid SQLite schema version");
    }

    if (version > STORAGE_SCHEMA_VERSION) {
      throw new Error("Unsupported SQLite schema version");
    }

    if (version === 0) {
      this.applySchemaVersionOne();
      this.applySchemaVersionTwo();
      return;
    }

    if (version === 1) {
      this.assertSchemaVersionOne();
      this.applySchemaVersionTwo();
      return;
    }

    this.assertSchemaVersionTwo();
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
        .run(1, new Date().toISOString());
      this.database.exec("PRAGMA user_version = 1");
      this.database.exec("COMMIT");
    } catch (error) {
      rollback(this.database);
      throw error;
    }
  }

  private applySchemaVersionTwo(): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const runsColumns = tableColumns(this.database, "runs");
      const receiptsColumns = tableColumns(this.database, "intent_receipts");
      if (!runsColumns.has("state_schema_version")) {
        this.database.exec(
          "ALTER TABLE runs ADD COLUMN state_schema_version INTEGER NOT NULL DEFAULT 1",
        );
      }
      if (!receiptsColumns.has("contract_version")) {
        this.database.exec(
          "ALTER TABLE intent_receipts ADD COLUMN contract_version TEXT NOT NULL DEFAULT 'r1-v1'",
        );
      }

      const activeRows = this.database
        .prepare("SELECT run_id, state_json FROM runs WHERE lifecycle = 'ACTIVE'")
        .all() as DatabaseRow[];
      for (const row of activeRows) {
        const stateJson = requiredString(row, "state_json");
        if (!isR1ActiveFixtureState(stateJson)) {
          throw new Error("Unsupported active schema-one run");
        }

        this.database
          .prepare(
            "UPDATE runs SET lifecycle = 'ARCHIVED', state_schema_version = 1 WHERE run_id = ?",
          )
          .run(requiredString(row, "run_id"));
      }

      this.database
        .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(2, new Date().toISOString());
      this.database.exec("PRAGMA user_version = 2");
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

    const runsColumns = tableColumns(this.database, "runs");
    const receiptsColumns = tableColumns(this.database, "intent_receipts");
    if (
      !["run_id", "lifecycle", "display_name", "week", "revision", "updated_at", "state_json", "state_checksum"]
        .every((column) => runsColumns.has(column)) ||
      !["intent_id", "envelope_json", "run_id", "receipt_json", "committed_at"]
        .every((column) => receiptsColumns.has(column))
    ) {
      throw new Error("SQLite schema-one columns are incomplete");
    }
  }

  private assertSchemaVersionTwo(): void {
    this.assertSchemaVersionOne();
    const runsColumns = tableColumns(this.database, "runs");
    const receiptsColumns = tableColumns(this.database, "intent_receipts");
    if (!runsColumns.has("state_schema_version") || !receiptsColumns.has("contract_version")) {
      throw new Error("SQLite schema-two columns are incomplete");
    }

    const migrationRows = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version IN (1, 2)")
      .all() as DatabaseRow[];
    const versions = new Set(migrationRows.map((row) => row.version));
    if (!versions.has(1) || !versions.has(2)) {
      throw new Error("SQLite migration history is incomplete");
    }
  }

  private submitValidatedIntent(intent: ValidatedR2Intent): BridgeResult<CommitReceipt> {
    this.ensureOpen();
    const envelopeJson = stableStringify(intent);
    this.database.exec("BEGIN IMMEDIATE");

    try {
      const existing = this.database
        .prepare(
          `SELECT intent_id, envelope_json, run_id, receipt_json, committed_at, contract_version
           FROM intent_receipts WHERE intent_id = ?`,
        )
        .get(intent.intentId) as DatabaseRow | undefined;

      if (existing !== undefined) {
        const storedEnvelope = requiredString(existing, "envelope_json");
        if (storedEnvelope !== envelopeJson) {
          throw new PublicOperationError(makePublicError("DUPLICATE_INTENT_CONFLICT"));
        }

        const storedIntentId = requiredString(existing, "intent_id");
        const persistedRunId = requiredString(existing, "run_id");
        const persistedContractVersion = requiredString(existing, "contract_version");
        if (
          persistedContractVersion !== CONTRACT_VERSION ||
          storedIntentId !== intent.intentId ||
          !isUuid(persistedRunId)
        ) {
          throw new Error("Persisted intent row identity is invalid");
        }

        const receipt = parsePersistedReceipt(requiredString(existing, "receipt_json"));
        const committedAt = requiredString(existing, "committed_at");
        if (
          receipt.intentId !== intent.intentId ||
          receipt.intentId !== storedIntentId ||
          receipt.runId !== persistedRunId ||
          receipt.committedAt !== committedAt
        ) {
          throw new Error("Persisted receipt identity does not match intent row");
        }

        this.readRunState(persistedRunId, true);

        this.database.exec("COMMIT");
        return { ok: true, value: { ...receipt, replayed: true } };
      }

      if (intent.payload.kind === "CREATE_CHARACTER_RUN") {
        const active = this.readActiveRun();
        const currentRevision = active?.state.revision ?? 0;
        if (active !== undefined || intent.expectedRevision !== currentRevision) {
          throw new PublicOperationError(makePublicError("REVISION_CONFLICT", currentRevision));
        }

        const runId = randomUUID();
        const committedAt = new Date().toISOString();
        const publicState = createR2CharacterRunState(
          runId,
          intent.payload.selection,
          R2_FIXTURE_CATALOGUE,
          LEGACY_FIXTURE,
        );
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
             (run_id, lifecycle, display_name, week, revision, updated_at, state_json, state_checksum, state_schema_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            STORAGE_SCHEMA_VERSION,
          );
        this.insertReceipt(intent, envelopeJson, receipt, committedAt);
        this.database.exec("COMMIT");
        return { ok: true, value: receipt };
      }

      if (intent.payload.kind !== "PERFORM_WEEKLY_ACTION") {
        throw new PublicOperationError(makePublicError("ACTION_UNAVAILABLE"));
      }

      const actionRunId = intent.runId;
      if (!isUuid(actionRunId)) {
        throw new Error("Validated action run id is invalid");
      }
      const active = this.readActiveRun(actionRunId);
      if (active === undefined) {
        throw new PublicOperationError(makePublicError("RUN_NOT_FOUND"));
      }
      if (intent.expectedRevision !== active.state.revision) {
        throw new PublicOperationError(
          makePublicError("REVISION_CONFLICT", active.state.revision),
        );
      }
      if (active.state.availableActions < 1) {
        throw new PublicOperationError(
          makePublicError("ACTION_UNAVAILABLE", active.state.revision),
        );
      }

      const publicState = applyWeeklyAction(active.state, intent.payload.action, LEGACY_FIXTURE);
      const committedAt = new Date().toISOString();
      const receipt: CommitReceipt = {
        intentId: intent.intentId,
        runId: active.state.runId,
        previousRevision: active.state.revision,
        newRevision: publicState.revision,
        stateChecksum: publicState.stateChecksum,
        committedAt,
        replayed: false,
        publicState,
      };

      this.database
        .prepare(
          `UPDATE runs
           SET display_name = ?, week = ?, revision = ?, updated_at = ?, state_json = ?, state_checksum = ?, state_schema_version = ?
           WHERE run_id = ? AND lifecycle = 'ACTIVE'`,
        )
        .run(
          publicState.character.displayName,
          publicState.week,
          publicState.revision,
          committedAt,
          stableStringify(publicState),
          publicState.stateChecksum,
          STORAGE_SCHEMA_VERSION,
          active.state.runId,
        );
      this.insertReceipt(intent, envelopeJson, receipt, committedAt);
      this.database.exec("COMMIT");
      return { ok: true, value: receipt };
    } catch (error) {
      rollback(this.database);
      throw error;
    }
  }

  private insertReceipt(
    intent: ValidatedR2Intent,
    envelopeJson: string,
    receipt: CommitReceipt,
    committedAt: string,
  ): void {
    this.database
      .prepare(
        `INSERT INTO intent_receipts
         (intent_id, envelope_json, run_id, receipt_json, committed_at, contract_version)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        intent.intentId,
        envelopeJson,
        receipt.runId,
        stableStringify(receipt),
        committedAt,
        CONTRACT_VERSION,
      );
  }

  private readActiveRun(runId?: string): ActiveRun | undefined {
    const row = runId === undefined
      ? this.database
        .prepare(
          `SELECT run_id, lifecycle, state_json, state_checksum, state_schema_version
           , display_name, week, revision, updated_at
           FROM runs WHERE lifecycle = 'ACTIVE' ORDER BY updated_at DESC, run_id DESC LIMIT 2`,
        )
        .all() as DatabaseRow[]
      : [
        this.database
          .prepare(
            `SELECT run_id, lifecycle, state_json, state_checksum, state_schema_version
             , display_name, week, revision, updated_at
             FROM runs WHERE run_id = ? AND lifecycle = 'ACTIVE'`,
          )
          .get(runId) as DatabaseRow | undefined,
      ].filter((value): value is DatabaseRow => value !== undefined);

    if (row.length === 0) {
      return undefined;
    }
    if (runId === undefined && row.length > 1) {
      throw new Error("Multiple active runs are not supported");
    }

    const selected = row[0]!;
    const state = this.readStateFromRow(selected);
    return { state };
  }

  private readActiveState(runId: string): PublicGameState {
    const active = this.readActiveRun(runId);
    if (active === undefined) {
      throw new Error("Active run is missing");
    }

    return active.state;
  }

  private readRunState(runId: string, activeOnly = false): PublicGameState {
    const row = this.database
      .prepare(
        activeOnly
          ? `SELECT run_id, lifecycle, state_json, state_checksum, state_schema_version,
                    display_name, week, revision, updated_at
             FROM runs WHERE run_id = ? AND lifecycle = 'ACTIVE'`
          : `SELECT run_id, lifecycle, state_json, state_checksum, state_schema_version,
                    display_name, week, revision, updated_at
             FROM runs WHERE run_id = ?`,
      )
      .get(runId) as DatabaseRow | undefined;

    if (row === undefined) {
      throw new Error("Persisted run is missing");
    }

    return this.readStateFromRow(row);
  }

  private readStateFromRow(row: DatabaseRow): PublicGameState {
    if (
      requiredString(row, "lifecycle") !== "ACTIVE" ||
      requiredInteger(row, "state_schema_version") !== STORAGE_SCHEMA_VERSION
    ) {
      throw new Error("Persisted R2 run metadata is invalid");
    }

    const runId = requiredString(row, "run_id");
    const state = parsePersistedState(requiredString(row, "state_json"));
    if (
      !isUuid(runId) ||
      state.runId !== runId ||
      requiredString(row, "state_checksum") !== state.stateChecksum ||
      requiredString(row, "display_name") !== state.character.displayName ||
      requiredInteger(row, "week") !== state.week ||
      requiredInteger(row, "revision") !== state.revision ||
      !isIsoTimestamp(requiredString(row, "updated_at"))
    ) {
      throw new Error("Persisted run identity does not match state");
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
    const week = requiredInteger(row, "week");
    const revision = requiredInteger(row, "revision");
    const updatedAt = requiredString(row, "updated_at");
    const stateSchemaVersion = requiredInteger(row, "state_schema_version");
    if (
      !isUuid(runId) ||
      !isSafeText(displayName, 80, true) ||
      !isBoundedInteger(week, 1, Number.MAX_SAFE_INTEGER) ||
      !isBoundedInteger(revision, 1, Number.MAX_SAFE_INTEGER) ||
      !isIsoTimestamp(updatedAt) ||
      (stateSchemaVersion !== 1 && stateSchemaVersion !== STORAGE_SCHEMA_VERSION)
    ) {
      throw new Error("Invalid persisted run summary");
    }

    return {
      runId,
      lifecycle,
      displayName,
      week,
      currentDate: { ...R2_FIXTURE_DEFAULTS.currentDate },
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
    characterCreation: cloneFixtureCatalogue(),
  };
}
