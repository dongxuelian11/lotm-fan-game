import type {
  PublicCheckModifier,
  PublicCheckResult,
  PublicCoreStatKey,
} from "../shared/contracts.js";

export interface NormalCheckInput {
  readonly ability?: PublicCoreStatKey;
  readonly baseAbility: number;
  readonly difficulty: number;
  readonly modifiers: readonly PublicCheckModifier[];
}

export interface NormalCheckResolutionInput extends NormalCheckInput {
  readonly roll: number;
}

const CORE_STAT_KEYS = new Set<PublicCoreStatKey>([
  "physique",
  "perception",
  "will",
  "knowledge",
]);
const MAX_ABILITY = 500;
const MAX_DIFFICULTY = 500;
const MAX_MODIFIERS = 16;
const MAX_MODIFIER_VALUE = 500;
const MAX_SOURCE_LENGTH = 128;

function assertSafeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
}

function assertRange(value: number, minimum: number, maximum: number, label: string): void {
  if (value < minimum || value > maximum) {
    throw new RangeError(`${label} is outside the supported range`);
  }
}

function assertBaseInput(input: NormalCheckInput): void {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("check input must be a record");
  }

  assertSafeInteger(input.baseAbility, "baseAbility");
  assertRange(input.baseAbility, 0, MAX_ABILITY, "baseAbility");
  assertSafeInteger(input.difficulty, "difficulty");
  assertRange(input.difficulty, 0, MAX_DIFFICULTY, "difficulty");
  if (!Array.isArray(input.modifiers) || input.modifiers.length > MAX_MODIFIERS) {
    throw new TypeError("modifiers must be a bounded array");
  }

  if (input.ability !== undefined && !CORE_STAT_KEYS.has(input.ability)) {
    throw new TypeError("ability is invalid");
  }

  for (const modifier of input.modifiers) {
    if (typeof modifier !== "object" || modifier === null || Array.isArray(modifier)) {
      throw new TypeError("modifier must be a record");
    }
    const keys = Object.keys(modifier).sort();
    if (keys.length !== 2 || keys[0] !== "source" || keys[1] !== "value") {
      throw new TypeError("modifier has an invalid shape");
    }
    if (
      typeof modifier.source !== "string" ||
      modifier.source.length === 0 ||
      modifier.source.length > MAX_SOURCE_LENGTH ||
      modifier.source !== modifier.source.trim()
    ) {
      throw new TypeError("modifier source is invalid");
    }
    assertSafeInteger(modifier.value, "modifier value");
    assertRange(modifier.value, -MAX_MODIFIER_VALUE, MAX_MODIFIER_VALUE, "modifier value");
  }
}

function effectiveAbility(input: NormalCheckInput): number {
  assertBaseInput(input);
  return input.baseAbility + input.modifiers.reduce((total, modifier) => total + modifier.value, 0);
}

export function computeCheckChance(input: NormalCheckInput): number {
  const effective = effectiveAbility(input);
  const rawChance = 50 + 2 * (effective - input.difficulty);
  return Math.max(5, Math.min(95, rawChance));
}

export function resolveNormalCheck(input: NormalCheckResolutionInput): PublicCheckResult {
  assertSafeInteger(input.roll, "roll");
  assertRange(input.roll, 1, 100, "roll");
  const chance = computeCheckChance(input);
  const effective = effectiveAbility(input);
  const tier = input.roll <= 5
    ? "GREAT_SUCCESS"
    : input.roll >= 96
      ? "GREAT_FAILURE"
      : input.roll <= chance
        ? "SUCCESS"
        : "FAILURE";

  return {
    ability: input.ability ?? "knowledge",
    baseAbility: input.baseAbility,
    modifiers: input.modifiers.map((modifier) => ({ ...modifier })),
    effectiveAbility: effective,
    difficulty: input.difficulty,
    chance,
    roll: input.roll,
    tier,
  };
}
