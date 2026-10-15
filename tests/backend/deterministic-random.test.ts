import { describe, expect, it } from "vitest";

import { DeterministicActionRandomStream } from "../../src/resolution/deterministic-random.js";

describe("deterministic action random stream", () => {
  it("replays the same bounded sequence from a seed and cursor", () => {
    const first = new DeterministicActionRandomStream("ba2-seed");
    const second = new DeterministicActionRandomStream("ba2-seed");
    const values = [first.nextInt(1, 100), first.nextInt(1, 12), first.nextInt(0, 5)];
    expect(values).toEqual([second.nextInt(1, 100), second.nextInt(1, 12), second.nextInt(0, 5)]);
    expect(first.cursor).toBe(3);
    expect(new DeterministicActionRandomStream("ba2-seed", 3).nextInt(1, 100)).toBe(first.nextInt(1, 100));
  });
});
