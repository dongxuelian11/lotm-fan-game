import { describe, expect, it } from "vitest";
import {
  BROWSER_ALPHA_CONTRACT_VERSION,
  CONTENT_VERSION,
  CONTRACT_VERSION,
  PUBLIC_CONDITION_ARCHETYPES,
  PUBLIC_EDUCATION_LEVELS,
  PUBLIC_ERROR_CODES,
  R2_FIXTURE_DEFAULTS,
  RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
} from "@shared/index";

describe("R2 shared authority contract", () => {
  it("publishes the browser-alpha character-creation vocabulary", () => {
    expect(BROWSER_ALPHA_CONTRACT_VERSION).toBe("browser-alpha-ba2-v1");
    expect(PUBLIC_EDUCATION_LEVELS).toEqual([
      "NONE_FORMAL",
      "BASIC",
      "SECONDARY_VOCATIONAL",
      "HIGHER",
    ]);
    expect(PUBLIC_CONDITION_ARCHETYPES.map((entry) => entry.id)).toEqual([
      "education-qualification",
      "recommendation-guarantee",
      "relevant-history-trial",
      "funds-tools",
      "family-class-compromise",
      "gray-introduction-risk",
    ]);
  });
  it("pins contract, rule, content and storage versions", () => {
    expect({ contract: CONTRACT_VERSION, rule: RULE_VERSION, content: CONTENT_VERSION, storage: STORAGE_SCHEMA_VERSION }).toEqual({
      contract: "r2-v2",
      rule: "browser-alpha-ba2",
      content: "fixture-ba2",
      storage: 2,
    });
  });
  it("keeps public errors finite and free of internal details", () => {
    expect(new Set(PUBLIC_ERROR_CODES).size).toBe(PUBLIC_ERROR_CODES.length);
    expect(PUBLIC_ERROR_CODES).not.toContain("SQL_ERROR");
    expect(PUBLIC_ERROR_CODES).not.toContain("STACK_TRACE");
  });
  it("pins a neutral ordinary-person fixture", () => {
    expect(R2_FIXTURE_DEFAULTS).toEqual({
      week: 1,
      currentDate: { epoch: "FIFTH_EPOCH", year: 1349, month: 6, day: 28 },
      availableActions: 3,
      cashPence: 0,
      coreStats: { physique: 15, perception: 15, will: 15, knowledge: 15 },
      resources: {
        health: { current: 100, max: 100 },
        mind: { current: 100, max: 100 },
        spirituality: { current: 15, max: 15 },
        pollution: 0,
      },
    });
  });
});
