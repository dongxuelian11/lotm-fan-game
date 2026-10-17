import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  PUBLIC_EDUCATION_LEVELS,
  type BridgeResult,
  type CharacterCreationSelection,
  type IntentEnvelope,
  type PublicCharacterCreationCatalogue,
  type PublicChoiceOption,
  type PublicCompatibilityRule,
  type PublicEducationLevel,
  type PublicOriginOption,
  type PublicPortraitOption,
  type PublicProfessionOption,
  type PublicTraitOption,
  type R2IntentPayload,
} from "../shared/contracts.js";
import { makePublicError } from "../domain/public-error.js";
import { LEGACY_NO_SPECIALIZATION_ID, R2_FIXTURE_CATALOGUE } from "./r2-catalogue.js";

export type ValidatedR2Intent = IntentEnvelope<R2IntentPayload>;

const ENVELOPE_KEYS = ["contractVersion", "expectedRevision", "intentId", "payload", "runId"] as const;
const CREATE_PAYLOAD_KEYS = ["kind", "selection"] as const;
const ACTION_PAYLOAD_KEYS = ["action", "kind"] as const;
const RESOLVE_EVENT_PAYLOAD_KEYS = ["choiceId", "eventInstanceId", "kind"] as const;

// The shared R2 envelope still carries this field for wire compatibility. BA1
// only checks that it is a safe opaque value; no ordinary skill is resolved,
// filtered, or projected by the domain.
const SELECTION_KEYS = [
  "acceptedConditionIds",
  "age",
  "birthplaceId",
  "displayName",
  "flawId",
  "appearanceDescription",
  "originId",
  "professionId",
  "sex",
  "traitIds",
] as const;
const LEGACY_SELECTION_KEYS = [
  ...SELECTION_KEYS,
  "portraitId",
  "specializationId",
] as const;
const CHOICE_KEYS = ["id", "label", "summary"] as const;
const PORTRAIT_KEYS = ["appearanceTags", ...CHOICE_KEYS] as const;
const CORE_STAT_KEYS = ["knowledge", "perception", "physique", "will"] as const;
const ORIGIN_OPENING_KEYS = [
  "coreStatModifiers",
  "defaultEducation",
  "educationLabel",
  "familyEconomyLabel",
  "openingKnowledgeBonus",
  "status",
] as const;
const PROFESSION_OPENING_KEYS = [
  "coreStatModifiers",
  "initialCashPence",
  "status",
  "weeklyWorkPayPence",
] as const;
const ORIGIN_KEYS = ["opening", "tier", ...CHOICE_KEYS] as const;
const PROFESSION_KEYS = ["legality", "opening", ...CHOICE_KEYS] as const;
const TRAIT_KEYS = ["incompatibleTraitIds", ...CHOICE_KEYS] as const;
const CORE_STAT_MODIFIER_MIN = -500;
const CORE_STAT_MODIFIER_MAX = 500;
const OPENING_KNOWLEDGE_BONUS_MAX = 500;
const OPENING_CURRENCY_MAX = Number.MAX_SAFE_INTEGER;
const COMPATIBILITY_BASE_KEYS = ["originId", "professionId", "publicReason", "status"] as const;
const COMPATIBILITY_CONDITIONAL_KEYS = [
  ...COMPATIBILITY_BASE_KEYS,
  "conditionCostSummary",
  "conditionId",
] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

type RecordValue = Record<string, unknown>;

const EXPECTED_BIRTHPLACES = [
  ["birthplace-backlund", "贝克兰德"],
  ["birthplace-tingen", "廷根市"],
  ["birthplace-constant", "康斯顿市"],
  ["birthplace-pritz-port", "普利兹港"],
] as const;

const EXPECTED_ORIGINS = [
  ["origin-poor-1", "无依街巷长大", "POOR"],
  ["origin-poor-2", "负债失业家庭", "POOR"],
  ["origin-labor-1", "工厂工资家庭", "LABOR"],
  ["origin-labor-2", "雇主依附的服务家庭", "LABOR"],
  ["origin-lower-middle-1", "自营小店/小作坊家庭", "LOWER_MIDDLE"],
  ["origin-lower-middle-2", "受教育的基层职员家庭", "LOWER_MIDDLE"],
  ["origin-upper-middle-1", "高等教育专业人士家庭", "UPPER_MIDDLE"],
  ["origin-upper-middle-2", "中型商贸/产业经营家庭", "UPPER_MIDDLE"],
  ["origin-upper-1", "贵族家系", "UPPER"],
  ["origin-upper-2", "获社会承认的实业/金融精英家庭", "UPPER"],
] as const;

const EXPECTED_PROFESSIONS = [
  ["profession-factory-worker", "工厂工人"],
  ["profession-dock-worker", "码头工人"],
  ["profession-estate-servant", "宅邸仆役"],
  ["profession-craft-apprentice", "手工业学徒"],
  ["profession-shop-clerk", "商店店员"],
  ["profession-company-clerk", "公司文员"],
  ["profession-junior-police-officer", "基层警员"],
  ["profession-private-detective", "私家侦探"],
  ["profession-company-accountant", "公司会计"],
  ["profession-lawyer", "律师"],
  ["profession-bounty-hunter", "赏金猎人"],
  ["profession-gang-runner", "帮派跑腿"],
] as const;

function isPlainRecord(value: unknown): value is RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: RecordValue, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  return (
    actualKeys.length === expected.length &&
    actualKeys.every((key, index) => key === expected[index])
  );
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

function isSafeStringArray(value: unknown, maximumItems: number, maximumLength: number): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximumItems &&
    value.every((item) => isSafeText(item, maximumLength, true)) &&
    new Set(value).size === value.length
  );
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return isSafeInteger(value) && value >= minimum && value <= maximum;
}

function isChoiceOption(value: unknown): value is PublicChoiceOption {
  if (!isPlainRecord(value) || !hasExactKeys(value, CHOICE_KEYS)) {
    return false;
  }

  return isSafeId(value.id) && isSafeText(value.label, 128) && isSafeText(value.summary, 512);
}

function isChoiceOptionWithKeys(value: unknown, expectedKeys: readonly string[]): boolean {
  return isPlainRecord(value) &&
    hasExactKeys(value, expectedKeys) &&
    isSafeId(value.id) &&
    isSafeText(value.label, 128) &&
    isSafeText(value.summary, 512);
}

function isPortraitOption(value: unknown): value is PublicPortraitOption {
  return isChoiceOptionWithKeys(value, PORTRAIT_KEYS) &&
    isSafeStringArray((value as RecordValue).appearanceTags, 16, 64);
}

function isCoreStatModifiers(value: unknown): boolean {
  return isPlainRecord(value) &&
    hasExactKeys(value, CORE_STAT_KEYS) &&
    CORE_STAT_KEYS.every((key) => isBoundedInteger(value[key], CORE_STAT_MODIFIER_MIN, CORE_STAT_MODIFIER_MAX));
}

function isEducationLevel(value: unknown): boolean {
  return PUBLIC_EDUCATION_LEVELS.includes(value as PublicEducationLevel);
}

function isOriginOpening(value: unknown): boolean {
  return isPlainRecord(value) &&
    hasExactKeys(value, ORIGIN_OPENING_KEYS) &&
    isCoreStatModifiers(value.coreStatModifiers) &&
    isEducationLevel(value.defaultEducation) &&
    isSafeText(value.educationLabel, 128, true) &&
    isSafeText(value.familyEconomyLabel, 256, true) &&
    isBoundedInteger(value.openingKnowledgeBonus, 0, OPENING_KNOWLEDGE_BONUS_MAX) &&
    value.status === "BALANCE_REVIEW_CANDIDATE";
}

function isProfessionOpening(value: unknown): boolean {
  return isPlainRecord(value) &&
    hasExactKeys(value, PROFESSION_OPENING_KEYS) &&
    isCoreStatModifiers(value.coreStatModifiers) &&
    isBoundedInteger(value.initialCashPence, 0, OPENING_CURRENCY_MAX) &&
    isBoundedInteger(value.weeklyWorkPayPence, 0, OPENING_CURRENCY_MAX) &&
    value.status === "BALANCE_REVIEW_CANDIDATE";
}

function isOriginOption(value: unknown): value is PublicOriginOption {
  const record = value as RecordValue;
  return isChoiceOptionWithKeys(value, ORIGIN_KEYS) &&
    isOriginOpening(record.opening) &&
    (record.tier === "POOR" ||
      record.tier === "LABOR" ||
      record.tier === "LOWER_MIDDLE" ||
      record.tier === "UPPER_MIDDLE" ||
      record.tier === "UPPER");
}

function isProfessionOption(value: unknown): value is PublicProfessionOption {
  const record = value as RecordValue;
  return isChoiceOptionWithKeys(value, PROFESSION_KEYS) &&
    isProfessionOpening(record.opening) &&
    (record.legality === "LEGAL" || record.legality === "GRAY" || record.legality === "ILLEGAL");
}

function isTraitOption(value: unknown): value is PublicTraitOption {
  return isChoiceOptionWithKeys(value, TRAIT_KEYS) &&
    isSafeStringArray((value as RecordValue).incompatibleTraitIds, 32, 128);
}

function isCompatibilityRule(value: unknown): value is PublicCompatibilityRule {
  if (!isPlainRecord(value) || !isSafeId(value.originId) || !isSafeId(value.professionId)) {
    return false;
  }

  if (value.status === "CONDITIONAL") {
    const hasConditionId = Object.prototype.hasOwnProperty.call(value, "conditionId");
    const hasConditionCost = Object.prototype.hasOwnProperty.call(value, "conditionCostSummary");
    if (hasConditionId !== hasConditionCost) {
      return false;
    }

    if (hasConditionId) {
      return hasExactKeys(value, COMPATIBILITY_CONDITIONAL_KEYS) &&
        isSafeId(value.conditionId) &&
        isSafeText(value.conditionCostSummary, 256) &&
        isSafeText(value.publicReason, 512);
    }

    return hasExactKeys(value, COMPATIBILITY_BASE_KEYS) && isSafeText(value.publicReason, 512);
  }

  if (value.status === "DIRECT" || value.status === "FORBIDDEN") {
    return hasExactKeys(value, COMPATIBILITY_BASE_KEYS) && isSafeText(value.publicReason, 512);
  }

  return false;
}

function hasUniqueIds(values: readonly { readonly id: string }[]): boolean {
  return new Set(values.map((value) => value.id)).size === values.length;
}

function hasOnlyKnownIds(values: readonly string[], knownIds: ReadonlySet<string>): boolean {
  return values.every((value) => knownIds.has(value));
}

function matchesOrderedPairList(
  values: readonly { readonly id: string; readonly label: string }[],
  expected: readonly (readonly [string, string])[],
): boolean {
  return values.length === expected.length && values.every((value, index) => {
    const pair = expected[index];
    return pair !== undefined && value.id === pair[0] && value.label === pair[1];
  });
}

function matchesOriginRoster(value: readonly PublicOriginOption[]): boolean {
  return value.length === EXPECTED_ORIGINS.length && value.every((origin, index) => {
    const expected = EXPECTED_ORIGINS[index];
    return expected !== undefined && origin.id === expected[0] && origin.label === expected[1] && origin.tier === expected[2];
  });
}

function matchesProfessionRoster(value: readonly PublicProfessionOption[]): boolean {
  return matchesOrderedPairList(value, EXPECTED_PROFESSIONS);
}

function hasFixtureCompatibilityCoverage(
  catalogue: PublicCharacterCreationCatalogue,
  originIds: ReadonlySet<string>,
  professionIds: ReadonlySet<string>,
): boolean {
  const pairKeys = new Set<string>();
  const countsByOrigin = new Map<string, number>();
  let conditionalCount = 0;
  for (const rule of catalogue.compatibility) {
    const key = `${rule.originId}\u0000${rule.professionId}`;
    if (pairKeys.has(key) || !originIds.has(rule.originId) || !professionIds.has(rule.professionId)) {
      return false;
    }
    pairKeys.add(key);
    countsByOrigin.set(rule.originId, (countsByOrigin.get(rule.originId) ?? 0) + 1);
    if (rule.status === "CONDITIONAL") {
      conditionalCount += 1;
      if (rule.conditionId !== undefined || rule.conditionCostSummary !== undefined) {
        return false;
      }
    }
  }

  return pairKeys.size === originIds.size * professionIds.size &&
    [...originIds].every((originId) => countsByOrigin.get(originId) === professionIds.size) &&
    conditionalCount === 55;
}

function validateCatalogueShape(
  value: unknown,
  requireFixtureCounts: boolean,
): value is PublicCharacterCreationCatalogue {
  if (!isPlainRecord(value)) {
    return false;
  }

  const catalogueKeys = [
    "birthplaces",
    "compatibility",
    "contentVersion",
    "fixtureContent",
    "flaws",
    "notice",
    "origins",
    "portraits",
    "professions",
    "traits",
  ] as const;
  if (
    !hasExactKeys(value, catalogueKeys) ||
    value.contentVersion !== CONTENT_VERSION ||
    value.fixtureContent !== true ||
    !isSafeText(value.notice, 512)
  ) {
    return false;
  }

  if (
    !Array.isArray(value.birthplaces) ||
    !Array.isArray(value.portraits) ||
    !Array.isArray(value.origins) ||
    !Array.isArray(value.professions) ||
    !Array.isArray(value.traits) ||
    !Array.isArray(value.flaws) ||
    !Array.isArray(value.compatibility) ||
    value.birthplaces.length === 0 ||
    value.portraits.length === 0 ||
    value.origins.length === 0 ||
    value.professions.length === 0 ||
    value.traits.length < 2 ||
    value.flaws.length === 0
  ) {
    return false;
  }

  if (
    !value.birthplaces.every(isChoiceOption) ||
    !value.portraits.every(isPortraitOption) ||
    !value.origins.every(isOriginOption) ||
    !value.professions.every(isProfessionOption) ||
    !value.traits.every(isTraitOption) ||
    !value.flaws.every(isChoiceOption) ||
    !value.compatibility.every(isCompatibilityRule) ||
    !hasUniqueIds(value.birthplaces) ||
    !hasUniqueIds(value.portraits) ||
    !hasUniqueIds(value.origins) ||
    !hasUniqueIds(value.professions) ||
    !hasUniqueIds(value.traits) ||
    !hasUniqueIds(value.flaws)
  ) {
    return false;
  }

  const originIds = new Set(value.origins.map((origin) => origin.id));
  const professionIds = new Set(value.professions.map((profession) => profession.id));
  const traitIds = new Set(value.traits.map((trait) => trait.id));
  if (
    !value.traits.every((trait) =>
      !trait.incompatibleTraitIds.includes(trait.id) &&
      hasOnlyKnownIds(trait.incompatibleTraitIds, traitIds),
    ) ||
    !value.compatibility.every((rule) => originIds.has(rule.originId) && professionIds.has(rule.professionId))
  ) {
    return false;
  }

  if (!requireFixtureCounts) {
    return true;
  }

  const birthplacePairs = value.birthplaces.map((choice) => [choice.id, choice.label] as const);
  const tierCounts = new Map<string, number>();
  for (const origin of value.origins) {
    tierCounts.set(origin.tier, (tierCounts.get(origin.tier) ?? 0) + 1);
  }
  const legalitySet = new Set(value.professions.map((profession) => profession.legality));
  return (
    matchesOrderedPairList(value.birthplaces, EXPECTED_BIRTHPLACES) &&
    birthplacePairs.length === EXPECTED_BIRTHPLACES.length &&
    matchesOriginRoster(value.origins) &&
    matchesProfessionRoster(value.professions) &&
    ["POOR", "LABOR", "LOWER_MIDDLE", "UPPER_MIDDLE", "UPPER"].every(
      (tier) => tierCounts.get(tier) === 2,
    ) &&
    legalitySet.size === 3 &&
    legalitySet.has("LEGAL") &&
    legalitySet.has("GRAY") &&
    legalitySet.has("ILLEGAL") &&
    value.compatibility.length === value.origins.length * value.professions.length &&
    hasFixtureCompatibilityCoverage(value as unknown as PublicCharacterCreationCatalogue, originIds, professionIds)
  );
}

export function validateCharacterCreationCatalogue(value: unknown): boolean {
  return validateCatalogueShape(value, true);
}

export function validateSyntheticCharacterCreationCatalogue(value: unknown): boolean {
  return validateCatalogueShape(value, false);
}

function findById<T extends { readonly id: string }>(values: readonly T[], id: string): T | undefined {
  return values.find((value) => value.id === id);
}

export function validateCharacterCreationSelection(
  value: unknown,
  catalogue: unknown = R2_FIXTURE_CATALOGUE,
): BridgeResult<CharacterCreationSelection> {
  if (
    !validateCatalogueShape(catalogue, false) ||
    !isPlainRecord(value) ||
    (!hasExactKeys(value, SELECTION_KEYS) && !hasExactKeys(value, LEGACY_SELECTION_KEYS))
  ) {
    return { ok: false, error: makePublicError("CONTENT_SELECTION_INVALID") };
  }

  const hasPortraitId = Object.prototype.hasOwnProperty.call(value, "portraitId");
  const hasSpecializationId = Object.prototype.hasOwnProperty.call(value, "specializationId");
  if (
    !isSafeText(value.displayName, 80) ||
    value.displayName.trim().length === 0 ||
    value.displayName.trim().length > 80 ||
    !isSafeText(value.appearanceDescription, 240) ||
    value.appearanceDescription.trim().length === 0 ||
    (value.sex !== "FEMALE" && value.sex !== "MALE") ||
    !isSafeInteger(value.age) ||
    value.age < 18 ||
    value.age > 45 ||
    !isSafeId(value.birthplaceId) ||
    (hasPortraitId && !isSafeId(value.portraitId)) ||
    !isSafeId(value.originId) ||
    !isSafeId(value.professionId) ||
    !isSafeId(value.flawId) ||
    (hasSpecializationId && !(value.specializationId === "" || value.specializationId === LEGACY_NO_SPECIALIZATION_ID)) ||
    !isSafeStringArray(value.traitIds, 2, 128) ||
    value.traitIds.length !== 2 ||
    !isSafeStringArray(value.acceptedConditionIds, 8, 128)
  ) {
    return { ok: false, error: makePublicError("CONTENT_SELECTION_INVALID") };
  }

  const selectedTraitIds = value.traitIds as readonly string[];
  const acceptedConditionIds = value.acceptedConditionIds as readonly string[];
  const birthplace = findById(catalogue.birthplaces, value.birthplaceId);
  const portrait = hasPortraitId ? findById(catalogue.portraits, value.portraitId as string) : undefined;
  const origin = findById(catalogue.origins, value.originId);
  const profession = findById(catalogue.professions, value.professionId);
  const traits = selectedTraitIds.map((id) => findById(catalogue.traits, id));
  const flaw = findById(catalogue.flaws, value.flawId);
  if (
    birthplace === undefined ||
    (hasPortraitId && portrait === undefined) ||
    origin === undefined ||
    profession === undefined ||
    traits.some((trait) => trait === undefined) ||
    flaw === undefined ||
    selectedTraitIds.includes(value.flawId) ||
    traits.some((trait) => trait?.incompatibleTraitIds.some((id) => selectedTraitIds.includes(id)))
  ) {
    return { ok: false, error: makePublicError("CONTENT_SELECTION_INVALID") };
  }

  const matchingRules = catalogue.compatibility.filter(
    (rule) => rule.originId === origin.id && rule.professionId === profession.id,
  );
  if (matchingRules.length !== 1) {
    return { ok: false, error: makePublicError("CONTENT_SELECTION_INVALID") };
  }

  const rule = matchingRules[0]!;
  if (
    rule.status === "FORBIDDEN" ||
    (rule.status === "DIRECT" && acceptedConditionIds.length !== 0) ||
    (rule.status === "CONDITIONAL" && (
      rule.conditionId === undefined ||
      acceptedConditionIds.length !== 1 ||
      acceptedConditionIds[0] !== rule.conditionId
    ))
  ) {
    return { ok: false, error: makePublicError("CONTENT_SELECTION_INVALID") };
  }

  return {
    ok: true,
    value: {
      displayName: value.displayName.trim(),
      sex: value.sex,
      age: value.age,
      birthplaceId: birthplace.id,
      originId: origin.id,
      professionId: profession.id,
      traitIds: [...selectedTraitIds],
      flawId: flaw.id,
      acceptedConditionIds: [...acceptedConditionIds],
      appearanceDescription: value.appearanceDescription.trim(),
      ...(portrait === undefined ? {} : { portraitId: portrait.id }),
      ...(hasSpecializationId ? { specializationId: value.specializationId as string } : {}),
    },
  };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function validateR2Intent(
  input: unknown,
  catalogue: unknown = R2_FIXTURE_CATALOGUE,
): BridgeResult<ValidatedR2Intent> {
  try {
    if (!isPlainRecord(input) || !hasExactKeys(input, ENVELOPE_KEYS)) {
      return { ok: false, error: makePublicError("SCHEMA_INVALID") };
    }

    if (input.contractVersion !== CONTRACT_VERSION) {
      return { ok: false, error: makePublicError("CONTRACT_VERSION_MISMATCH") };
    }

    if (!isSafeId(input.intentId) || !isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
      return { ok: false, error: makePublicError("SCHEMA_INVALID") };
    }

    if (!isPlainRecord(input.payload)) {
      return { ok: false, error: makePublicError("SCHEMA_INVALID") };
    }

    if (input.payload.kind === "CREATE_CHARACTER_RUN") {
      if (input.runId !== null || !hasExactKeys(input.payload, CREATE_PAYLOAD_KEYS)) {
        return { ok: false, error: makePublicError("SCHEMA_INVALID") };
      }

      const selection = validateCharacterCreationSelection(input.payload.selection, catalogue);
      if (!selection.ok) {
        return selection;
      }

      return {
        ok: true,
        value: {
          contractVersion: CONTRACT_VERSION,
          intentId: input.intentId,
          runId: null,
          expectedRevision: input.expectedRevision,
          payload: { kind: "CREATE_CHARACTER_RUN", selection: selection.value },
        },
      };
    }

    if (input.payload.kind === "PERFORM_WEEKLY_ACTION") {
      if (!isUuid(input.runId) || !hasExactKeys(input.payload, ACTION_PAYLOAD_KEYS)) {
        return { ok: false, error: makePublicError("SCHEMA_INVALID") };
      }

      const action = input.payload.action;
      if (action !== "WORK" && action !== "LEARN" && action !== "INVESTIGATE" && action !== "REST") {
        return { ok: false, error: makePublicError("SCHEMA_INVALID") };
      }

      return {
        ok: true,
        value: {
          contractVersion: CONTRACT_VERSION,
          intentId: input.intentId,
          runId: input.runId,
          expectedRevision: input.expectedRevision,
          payload: { kind: "PERFORM_WEEKLY_ACTION", action },
        },
      };
    }

    if (input.payload.kind === "RESOLVE_EVENT_CHOICE") {
      if (
        !isUuid(input.runId) ||
        !hasExactKeys(input.payload, RESOLVE_EVENT_PAYLOAD_KEYS) ||
        !isSafeId(input.payload.eventInstanceId) ||
        !isSafeId(input.payload.choiceId)
      ) {
        return { ok: false, error: makePublicError("SCHEMA_INVALID") };
      }

      return {
        ok: true,
        value: {
          contractVersion: CONTRACT_VERSION,
          intentId: input.intentId,
          runId: input.runId,
          expectedRevision: input.expectedRevision,
          payload: {
            kind: "RESOLVE_EVENT_CHOICE",
            eventInstanceId: input.payload.eventInstanceId,
            choiceId: input.payload.choiceId,
          },
        },
      };
    }

    return { ok: false, error: makePublicError("SCHEMA_INVALID") };
  } catch {
    return { ok: false, error: makePublicError("SCHEMA_INVALID") };
  }
}
