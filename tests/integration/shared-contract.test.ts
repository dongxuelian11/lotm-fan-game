import { describe, expect, it } from "vitest";

import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  PUBLIC_ERROR_CODES,
  R1_FIXTURE_DEFAULTS,
  RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
} from "@shared/index";

describe("R1 shared authority contract", () => {
  it("pins independently visible contract, rule, content and storage versions", () => {
    expect({
      contract: CONTRACT_VERSION,
      rule: RULE_VERSION,
      content: CONTENT_VERSION,
      storage: STORAGE_SCHEMA_VERSION,
    }).toEqual({
      contract: "r1-v1",
      rule: "fixture-r1",
      content: "fixture-r1",
      storage: 1,
    });
  });

  it("keeps the public error vocabulary finite and free of internal stack details", () => {
    expect(new Set(PUBLIC_ERROR_CODES).size).toBe(PUBLIC_ERROR_CODES.length);
    expect(PUBLIC_ERROR_CODES).not.toContain("SQL_ERROR");
    expect(PUBLIC_ERROR_CODES).not.toContain("STACK_TRACE");
  });

  it("pins a neutral ordinary-person fixture without turning it into final game content", () => {
    expect(R1_FIXTURE_DEFAULTS).toEqual({
      week: 1,
      availableActions: 3,
      cashPence: 0,
      coreStats: {
        physique: 15,
        perception: 15,
        will: 15,
        knowledge: 15,
      },
      resources: {
        health: { current: 100, max: 100 },
        mind: { current: 100, max: 100 },
        spirituality: { current: 15, max: 15 },
        pollution: 0,
      },
    });
  });
});
