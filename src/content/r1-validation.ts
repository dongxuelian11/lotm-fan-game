import {
  CONTRACT_VERSION,
  type BridgeResult,
  type IntentEnvelope,
  type R1IntentPayload,
} from "../shared/contracts.js";
import { makePublicError } from "../domain/public-error.js";

export type ValidatedR1Intent = IntentEnvelope<R1IntentPayload>;

const ENVELOPE_KEYS = ["contractVersion", "expectedRevision", "intentId", "payload", "runId"];
const PAYLOAD_KEYS = ["displayName", "fixtureId", "kind"];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function isSafeText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function isSafeRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function validateR1Intent(input: unknown): BridgeResult<ValidatedR1Intent> {
  try {
    if (!isPlainRecord(input) || !hasOnlyKeys(input, ENVELOPE_KEYS)) {
      return { ok: false, error: makePublicError("SCHEMA_INVALID") };
    }

    if (input.contractVersion !== CONTRACT_VERSION) {
      return { ok: false, error: makePublicError("CONTRACT_VERSION_MISMATCH") };
    }

    if (!isSafeText(input.intentId, 128) || input.runId !== null || !isSafeRevision(input.expectedRevision)) {
      return { ok: false, error: makePublicError("SCHEMA_INVALID") };
    }

    if (!isPlainRecord(input.payload) || !hasOnlyKeys(input.payload, PAYLOAD_KEYS)) {
      return { ok: false, error: makePublicError("SCHEMA_INVALID") };
    }

    if (
      input.payload.kind !== "CREATE_R1_FIXTURE_RUN" ||
      input.payload.fixtureId !== "ordinary-week-one" ||
      !isSafeText(input.payload.displayName, 80)
    ) {
      return { ok: false, error: makePublicError("SCHEMA_INVALID") };
    }

    const displayName = input.payload.displayName.trim();
    if (displayName.length === 0 || displayName.length > 80) {
      return { ok: false, error: makePublicError("SCHEMA_INVALID") };
    }

    return {
      ok: true,
      value: {
        contractVersion: CONTRACT_VERSION,
        intentId: input.intentId,
        runId: null,
        expectedRevision: input.expectedRevision,
        payload: {
          kind: "CREATE_R1_FIXTURE_RUN",
          fixtureId: "ordinary-week-one",
          displayName,
        },
      },
    };
  } catch {
    return { ok: false, error: makePublicError("SCHEMA_INVALID") };
  }
}
