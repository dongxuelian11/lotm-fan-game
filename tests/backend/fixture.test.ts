import { describe, expect, it, vi } from "vitest";

import { createR1FixtureState } from "../../src/domain/fixture.js";
import { stableStringify } from "../../src/domain/canonical.js";
import { R1_FIXTURE_DEFAULTS } from "../../src/shared/contracts.js";

describe("R1 fixture domain", () => {
  it("creates only the neutral ordinary-person public fixture", () => {
    const state = createR1FixtureState("run-1", "Ada");

    expect(state).toMatchObject({
      contractVersion: "r1-v1",
      ruleVersion: "fixture-r1",
      contentVersion: "fixture-r1",
      runId: "run-1",
      lifecycle: "ACTIVE",
      revision: 1,
      week: R1_FIXTURE_DEFAULTS.week,
      availableActions: R1_FIXTURE_DEFAULTS.availableActions,
      cashPence: R1_FIXTURE_DEFAULTS.cashPence,
      character: {
        displayName: "Ada",
        origin: "LOEN",
        sequence: "ORDINARY",
        coreStats: R1_FIXTURE_DEFAULTS.coreStats,
        resources: R1_FIXTURE_DEFAULTS.resources,
      },
    });
    expect(state.stateChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(state.chronicle).toHaveLength(1);
  });

  it("does not use gameplay randomness", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used by the fixture domain");
    });

    expect(() => createR1FixtureState("run-2", "Ada")).not.toThrow();
    random.mockRestore();
  });

  it("uses lexicographic object keys and preserves array order in canonical JSON", () => {
    expect(stableStringify({ z: 1, a: [{ b: 2, a: 1 }] })).toBe(
      '{"a":[{"a":1,"b":2}],"z":1}',
    );
  });

  it("rejects non-plain object values from authoritative serialization", () => {
    expect(() => stableStringify(new Date("2026-01-01T00:00:00.000Z"))).toThrow();
    expect(() => stableStringify(new Map([["secret", "value"]]))).toThrow();
    class NotPlain {}
    expect(() => stableStringify(new NotPlain())).toThrow();
  });
});
