export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

function canonicalValue(value: unknown): JsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON cannot contain a non-finite number");
    }

    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalValue(item));
  }

  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON accepts only plain records");
    }

    const record = value as Record<string, unknown>;
    const result: Record<string, JsonValue> = {};

    for (const key of Object.keys(record).sort()) {
      result[key] = canonicalValue(record[key]);
    }

    return result;
  }

  throw new TypeError("Canonical JSON cannot contain this value");
}

export function stableStringify(value: unknown): string {
  const serialized = JSON.stringify(canonicalValue(value));

  if (serialized === undefined) {
    throw new TypeError("Canonical JSON serialization failed");
  }

  return serialized;
}
