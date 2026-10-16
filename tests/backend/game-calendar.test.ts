import { describe, expect, it } from "vitest";

import { addGameWeeks } from "../../src/domain/game-calendar.js";

describe("Fifth Epoch game calendar", () => {
  it("adds whole weeks without using local time zones", () => {
    expect(addGameWeeks({ epoch: "FIFTH_EPOCH", year: 1349, month: 6, day: 28 }, 0)).toEqual({
      epoch: "FIFTH_EPOCH", year: 1349, month: 6, day: 28,
    });
    expect(addGameWeeks({ epoch: "FIFTH_EPOCH", year: 1349, month: 6, day: 28 }, 1)).toEqual({
      epoch: "FIFTH_EPOCH", year: 1349, month: 7, day: 5,
    });
  });

  it("carries month and leap-year boundaries", () => {
    expect(addGameWeeks({ epoch: "FIFTH_EPOCH", year: 1352, month: 2, day: 25 }, 1)).toEqual({
      epoch: "FIFTH_EPOCH", year: 1352, month: 3, day: 3,
    });
    expect(addGameWeeks({ epoch: "FIFTH_EPOCH", year: 1351, month: 12, day: 28 }, 1)).toEqual({
      epoch: "FIFTH_EPOCH", year: 1352, month: 1, day: 4,
    });
  });
});
