import { describe, expect, it } from "vitest";

import { computeCheckChance, resolveNormalCheck } from "../../src/resolution/normal-check.js";

describe("BA2 normal check", () => {
  it("adds signed modifiers before clamping the chance", () => {
    expect(computeCheckChance({
      baseAbility: 15,
      difficulty: 15,
      modifiers: [{ source: "准备", value: 2 }, { source: "疲惫", value: -1 }],
    })).toBe(52);
    expect(computeCheckChance({ baseAbility: 40, difficulty: 15, modifiers: [] })).toBe(95);
    expect(computeCheckChance({ baseAbility: 1, difficulty: 40, modifiers: [] })).toBe(5);
  });

  it("uses one d100 result for four ordered tiers", () => {
    const input = { ability: "knowledge" as const, baseAbility: 15, difficulty: 15, modifiers: [] };
    expect(resolveNormalCheck({ ...input, roll: 1 }).tier).toBe("GREAT_SUCCESS");
    expect(resolveNormalCheck({ ...input, roll: 50 }).tier).toBe("SUCCESS");
    expect(resolveNormalCheck({ ...input, roll: 51 }).tier).toBe("FAILURE");
    expect(resolveNormalCheck({ ...input, roll: 100 }).tier).toBe("GREAT_FAILURE");
  });
});
