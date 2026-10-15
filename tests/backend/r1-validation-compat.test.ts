import { describe, expect, it } from "vitest";
import { validateR1Intent } from "../../src/content/r1-validation.js";
import { validateR2Intent } from "../../src/content/r2-validation.js";
import { CONTRACT_VERSION } from "../../src/shared/contracts.js";

const legacyEnvelope = () => ({
  contractVersion: CONTRACT_VERSION,
  intentId: "11111111-1111-4111-8111-111111111111",
  runId: null,
  expectedRevision: 0,
  payload: { kind: "CREATE_R1_FIXTURE_RUN", fixtureId: "ordinary-week-one", displayName: "  艾琳  " },
});

describe("retained R1 validator compatibility", () => {
  it("retains its original local payload and trims the display name", () => {
    expect(validateR1Intent(legacyEnvelope())).toMatchObject({
      ok: true, value: { payload: { kind: "CREATE_R1_FIXTURE_RUN", displayName: "艾琳" } },
    });
  });
  it("does not make the current validator accept the historical intent", () => {
    expect(validateR2Intent(legacyEnvelope())).toMatchObject({ ok: false });
  });
  it("still rejects extra payload fields and invalid revisions", () => {
    const input = legacyEnvelope();
    expect(validateR1Intent({ ...input, payload: { ...input.payload, injected: true } })).toMatchObject({ ok: false });
    expect(validateR1Intent({ ...input, expectedRevision: -1 })).toMatchObject({ ok: false });
  });
  it("still rejects wrong versions, control characters and an existing run", () => {
    const input = legacyEnvelope();
    expect(validateR1Intent({ ...input, contractVersion: "wrong-version" })).toMatchObject({ ok: false });
    expect(validateR1Intent({ ...input, runId: "existing-run" })).toMatchObject({ ok: false });
    expect(validateR1Intent({ ...input, payload: { ...input.payload, displayName: "a\u0000b" } })).toMatchObject({ ok: false });
  });
});
