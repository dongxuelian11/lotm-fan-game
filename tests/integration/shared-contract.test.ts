import { describe, expect, it } from "vitest";

import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  PUBLIC_ERROR_CODES,
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
});

