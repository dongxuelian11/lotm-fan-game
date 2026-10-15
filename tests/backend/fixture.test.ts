import { describe, expect, it, vi } from "vitest";

import {
  applyWeeklyAction,
  BROWSER_ALPHA_CANDIDATE,
  createR2CharacterRunState,
  hasValidStateChecksum,
  LEGACY_FIXTURE,
} from "../../src/domain/fixture.js";
import { stableStringify } from "../../src/domain/canonical.js";
import {
  BROWSER_ALPHA_CONDITION_ARCHETYPES,
  R2_EDUCATION_LEVELS,
  R2_FIXTURE_CATALOGUE,
  R2_FIXTURE_DEFAULT_SELECTION,
  R2_ORIGIN_EDUCATION_PROFILES,
} from "../../src/content/r2-catalogue.js";
import {
  validateCharacterCreationCatalogue,
  validateCharacterCreationSelection,
  validateSyntheticCharacterCreationCatalogue,
} from "../../src/content/r2-validation.js";
import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  R2_FIXTURE_DEFAULTS,
  RULE_VERSION,
  type PublicCharacterCreationCatalogue,
} from "../../src/shared/contracts.js";

function cloneCatalogue(): PublicCharacterCreationCatalogue {
  return JSON.parse(JSON.stringify(R2_FIXTURE_CATALOGUE)) as PublicCharacterCreationCatalogue;
}

const EXPECTED_PROFESSIONS = [
  ["profession-factory-worker", "工厂工人"],
  ["profession-dock-worker", "码头工人"],
  ["profession-estate-servant", "宅邸仆役"],
  ["profession-craft-apprentice", "手工业学徒"],
  ["profession-shop-clerk", "商店店员"],
  ["profession-company-clerk", "公司文员"],
  ["profession-junior-police-officer", "基层警员"],
  ["profession-private-detective", "私家侦探"],
  ["profession-company-accountant", "公司会计"],
  ["profession-lawyer", "律师"],
  ["profession-bounty-hunter", "赏金猎人"],
  ["profession-gang-runner", "帮派跑腿"],
] as const;

const EXPECTED_MATRIX: Record<string, Record<string, readonly string[]>> = {
  "origin-poor-1": {
    DIRECT: ["profession-factory-worker", "profession-dock-worker", "profession-bounty-hunter", "profession-gang-runner"],
    CONDITIONAL: ["profession-estate-servant", "profession-craft-apprentice", "profession-shop-clerk", "profession-company-clerk", "profession-junior-police-officer", "profession-private-detective"],
    FORBIDDEN: ["profession-company-accountant", "profession-lawyer"],
  },
  "origin-poor-2": {
    DIRECT: ["profession-factory-worker", "profession-dock-worker", "profession-estate-servant", "profession-craft-apprentice", "profession-shop-clerk", "profession-gang-runner"],
    CONDITIONAL: ["profession-company-clerk", "profession-junior-police-officer", "profession-private-detective", "profession-bounty-hunter"],
    FORBIDDEN: ["profession-company-accountant", "profession-lawyer"],
  },
  "origin-labor-1": {
    DIRECT: ["profession-factory-worker", "profession-dock-worker", "profession-craft-apprentice", "profession-shop-clerk", "profession-bounty-hunter", "profession-gang-runner"],
    CONDITIONAL: ["profession-estate-servant", "profession-company-clerk", "profession-junior-police-officer", "profession-private-detective"],
    FORBIDDEN: ["profession-company-accountant", "profession-lawyer"],
  },
  "origin-labor-2": {
    DIRECT: ["profession-estate-servant", "profession-shop-clerk", "profession-company-clerk", "profession-gang-runner"],
    CONDITIONAL: ["profession-factory-worker", "profession-dock-worker", "profession-craft-apprentice", "profession-junior-police-officer", "profession-private-detective", "profession-bounty-hunter"],
    FORBIDDEN: ["profession-company-accountant", "profession-lawyer"],
  },
  "origin-lower-middle-1": {
    DIRECT: ["profession-craft-apprentice", "profession-shop-clerk", "profession-private-detective"],
    CONDITIONAL: ["profession-factory-worker", "profession-dock-worker", "profession-estate-servant", "profession-company-clerk", "profession-junior-police-officer", "profession-company-accountant", "profession-bounty-hunter", "profession-gang-runner"],
    FORBIDDEN: ["profession-lawyer"],
  },
  "origin-lower-middle-2": {
    DIRECT: ["profession-shop-clerk", "profession-company-clerk", "profession-junior-police-officer", "profession-company-accountant"],
    CONDITIONAL: ["profession-factory-worker", "profession-dock-worker", "profession-estate-servant", "profession-craft-apprentice", "profession-private-detective", "profession-bounty-hunter", "profession-gang-runner"],
    FORBIDDEN: ["profession-lawyer"],
  },
  "origin-upper-middle-1": {
    DIRECT: ["profession-company-clerk", "profession-junior-police-officer", "profession-private-detective", "profession-company-accountant", "profession-lawyer"],
    CONDITIONAL: ["profession-estate-servant", "profession-craft-apprentice", "profession-shop-clerk"],
    FORBIDDEN: ["profession-factory-worker", "profession-dock-worker", "profession-bounty-hunter", "profession-gang-runner"],
  },
  "origin-upper-middle-2": {
    DIRECT: ["profession-shop-clerk", "profession-company-clerk", "profession-company-accountant"],
    CONDITIONAL: ["profession-factory-worker", "profession-dock-worker", "profession-estate-servant", "profession-craft-apprentice", "profession-junior-police-officer", "profession-private-detective", "profession-lawyer"],
    FORBIDDEN: ["profession-bounty-hunter", "profession-gang-runner"],
  },
  "origin-upper-1": {
    DIRECT: ["profession-company-clerk", "profession-junior-police-officer", "profession-lawyer"],
    CONDITIONAL: ["profession-estate-servant", "profession-shop-clerk", "profession-private-detective", "profession-company-accountant"],
    FORBIDDEN: ["profession-factory-worker", "profession-dock-worker", "profession-craft-apprentice", "profession-bounty-hunter", "profession-gang-runner"],
  },
  "origin-upper-2": {
    DIRECT: ["profession-shop-clerk", "profession-company-clerk", "profession-company-accountant", "profession-lawyer"],
    CONDITIONAL: ["profession-factory-worker", "profession-dock-worker", "profession-estate-servant", "profession-craft-apprentice", "profession-junior-police-officer", "profession-private-detective"],
    FORBIDDEN: ["profession-bounty-hunter", "profession-gang-runner"],
  },
};

describe("R2 replaceable catalogue and domain", () => {
  it("publishes the locked BA1 catalogue shape and exact profession roster", () => {
    expect(validateCharacterCreationCatalogue(R2_FIXTURE_CATALOGUE)).toBe(true);
    expect(R2_FIXTURE_CATALOGUE.fixtureContent).toBe(true);
    expect(R2_FIXTURE_CATALOGUE.birthplaces).toHaveLength(4);
    expect(R2_FIXTURE_CATALOGUE.origins).toHaveLength(10);
    expect(R2_FIXTURE_CATALOGUE.professions).toHaveLength(12);
    expect(R2_FIXTURE_CATALOGUE.compatibility).toHaveLength(120);
    expect(R2_FIXTURE_CATALOGUE.professions.map(({ id, label }) => [id, label])).toEqual(EXPECTED_PROFESSIONS);
    expect(R2_FIXTURE_CATALOGUE.origins.every((origin) =>
      origin.opening.status === "BALANCE_REVIEW_CANDIDATE" &&
      origin.opening.educationLabel.length > 0 &&
      origin.opening.familyEconomyLabel.length > 0,
    )).toBe(true);
    expect(R2_FIXTURE_CATALOGUE.professions.every((profession) =>
      profession.opening.status === "BALANCE_REVIEW_CANDIDATE" &&
      !/开局加成|个人资金|每周工资/.test(profession.summary),
    )).toBe(true);
    expect(new Set(R2_FIXTURE_CATALOGUE.origins.map((origin) => origin.tier))).toEqual(
      new Set(["POOR", "LABOR", "LOWER_MIDDLE", "UPPER_MIDDLE", "UPPER"]),
    );
    expect("specializations" in (R2_FIXTURE_CATALOGUE as object)).toBe(false);
  });

  it("fails closed on malformed structured opening candidates", () => {
    const missingOpening = cloneCatalogue() as unknown as Record<string, unknown>;
    delete (missingOpening.origins as Array<Record<string, unknown>>)[0]!.opening;
    expect(validateCharacterCreationCatalogue(missingOpening)).toBe(false);

    const extraOpeningField = cloneCatalogue();
    (extraOpeningField.origins[0]!.opening as unknown as Record<string, unknown>).secret = "must-not-leak";
    expect(validateCharacterCreationCatalogue(extraOpeningField)).toBe(false);

    const invalidModifier = cloneCatalogue();
    ((invalidModifier.origins[0]!.opening as unknown as Record<string, unknown>).coreStatModifiers as Record<string, unknown>).physique = 501;
    expect(validateCharacterCreationCatalogue(invalidModifier)).toBe(false);

    const invalidPay = cloneCatalogue();
    (invalidPay.professions[0]!.opening as unknown as Record<string, unknown>).weeklyWorkPayPence = -1;
    expect(validateCharacterCreationCatalogue(invalidPay)).toBe(false);
  });
  it("maps each origin to one of the ten locked core prototypes", () => {
    expect(R2_FIXTURE_CATALOGUE.origins.map((origin) => [origin.tier, origin.label])).toEqual([
      ["POOR", "无依街巷长大"],
      ["POOR", "负债失业家庭"],
      ["LABOR", "工厂工资家庭"],
      ["LABOR", "雇主依附的服务家庭"],
      ["LOWER_MIDDLE", "自营小店/小作坊家庭"],
      ["LOWER_MIDDLE", "受教育的基层职员家庭"],
      ["UPPER_MIDDLE", "高等教育专业人士家庭"],
      ["UPPER_MIDDLE", "中型商贸/产业经营家庭"],
      ["UPPER", "贵族家系"],
      ["UPPER", "获社会承认的实业/金融精英家庭"],
    ]);
  });

  it("publishes four canonical birthplaces without birthplace-derived bonuses", () => {
    expect(R2_FIXTURE_CATALOGUE.birthplaces).toEqual([
      { id: "birthplace-backlund", label: "贝克兰德", summary: "鲁恩王国的首都。" },
      { id: "birthplace-tingen", label: "廷根市", summary: "阿霍瓦郡的大学城。" },
      { id: "birthplace-constant", label: "康斯顿市", summary: "间海郡的煤钢工业首府。" },
      { id: "birthplace-pritz-port", label: "普利兹港", summary: "鲁恩王国的重要港口。" },
    ]);

    const states = R2_FIXTURE_CATALOGUE.birthplaces.map((birthplace) => {
      const selection = { ...R2_FIXTURE_DEFAULT_SELECTION, birthplaceId: birthplace.id };
      expect(validateCharacterCreationSelection(selection)).toMatchObject({ ok: true });
      return createR2CharacterRunState(
        "550e8400-e29b-41d4-a716-446655440000",
        selection,
        R2_FIXTURE_CATALOGUE,
        BROWSER_ALPHA_CANDIDATE,
      );
    });
    const baseline = states[0]!;

    expect(states.map((state) => state.character.birthplace.id)).toEqual([
      "birthplace-backlund",
      "birthplace-tingen",
      "birthplace-constant",
      "birthplace-pritz-port",
    ]);
    for (const state of states) {
      expect(state.character.coreStats).toEqual(baseline.character.coreStats);
      expect(state.character.resources).toEqual(baseline.character.resources);
      expect(state.cashPence).toBe(baseline.cashPence);
      expect(hasValidStateChecksum(state)).toBe(true);
    }
  });

  it("publishes player-facing portrait labels without placeholder sketch copy", () => {
    expect(R2_FIXTURE_CATALOGUE.portraits).toHaveLength(3);
    expect(R2_FIXTURE_CATALOGUE.portraits.every(({ label, summary, appearanceTags }) => {
      return !/素描|占位|placeholder/i.test(`${label} ${summary}`) &&
        appearanceTags.every((tag) => !/[a-z]/i.test(tag));
    })).toBe(true);
    expect(R2_FIXTURE_CATALOGUE.portraits.every(({ summary }) => summary.includes("最终肖像素材尚未批准"))).toBe(true);
  });

  it("keeps the four education levels and one review-pending profile per origin", () => {
    expect(R2_EDUCATION_LEVELS).toEqual(["NONE_FORMAL", "BASIC", "SECONDARY_VOCATIONAL", "HIGHER"]);
    expect(R2_ORIGIN_EDUCATION_PROFILES).toHaveLength(R2_FIXTURE_CATALOGUE.origins.length);
    expect(R2_ORIGIN_EDUCATION_PROFILES.map(({ originId }) => originId)).toEqual(
      R2_FIXTURE_CATALOGUE.origins.map(({ id }) => id),
    );
    expect(R2_ORIGIN_EDUCATION_PROFILES.map(({ defaultLevel, conditionalAlternative, status }) => ({
      defaultLevel,
      conditionalAlternative,
      status,
    }))).toEqual([
      { defaultLevel: "NONE_FORMAL", conditionalAlternative: undefined, status: "BALANCE_REVIEW_CANDIDATE" },
      { defaultLevel: "BASIC", conditionalAlternative: undefined, status: "BALANCE_REVIEW_CANDIDATE" },
      { defaultLevel: "BASIC", conditionalAlternative: undefined, status: "BALANCE_REVIEW_CANDIDATE" },
      { defaultLevel: "BASIC", conditionalAlternative: undefined, status: "BALANCE_REVIEW_CANDIDATE" },
      { defaultLevel: "SECONDARY_VOCATIONAL", conditionalAlternative: undefined, status: "BALANCE_REVIEW_CANDIDATE" },
      { defaultLevel: "SECONDARY_VOCATIONAL", conditionalAlternative: undefined, status: "BALANCE_REVIEW_CANDIDATE" },
      { defaultLevel: "HIGHER", conditionalAlternative: undefined, status: "BALANCE_REVIEW_CANDIDATE" },
      { defaultLevel: "SECONDARY_VOCATIONAL", conditionalAlternative: undefined, status: "BALANCE_REVIEW_CANDIDATE" },
      { defaultLevel: "HIGHER", conditionalAlternative: undefined, status: "BALANCE_REVIEW_CANDIDATE" },
      { defaultLevel: "HIGHER", conditionalAlternative: undefined, status: "BALANCE_REVIEW_CANDIDATE" },
    ]);
  });
  it("validates every origin-profession pair exactly once with 55 conditional rows", () => {
    const rowsByOrigin = new Map<string, typeof R2_FIXTURE_CATALOGUE.compatibility>();
    for (const rule of R2_FIXTURE_CATALOGUE.compatibility) {
      const rows = rowsByOrigin.get(rule.originId) ?? [];
      rows.push(rule);
      rowsByOrigin.set(rule.originId, rows);
    }

    expect(R2_FIXTURE_CATALOGUE.compatibility.filter((rule) => rule.status === "CONDITIONAL")).toHaveLength(55);
    expect(new Set(R2_FIXTURE_CATALOGUE.compatibility.map((rule) => `${rule.originId}\u0000${rule.professionId}`)).size).toBe(120);
    for (const [originId, statuses] of Object.entries(EXPECTED_MATRIX)) {
      const rows = rowsByOrigin.get(originId);
      expect(rows).toHaveLength(12);
      for (const [status, professionIds] of Object.entries(statuses)) {
        expect(rows?.filter((row) => row.status === status).map((row) => row.professionId).sort()).toEqual([...professionIds].sort());
      }
    }
  });

  it("marks canonical conditional paths as content pending without fake requirements", () => {
    const conditionalRules = R2_FIXTURE_CATALOGUE.compatibility.filter((rule) => rule.status === "CONDITIONAL");
    expect(conditionalRules).toHaveLength(55);
    expect(conditionalRules.every((rule) => /待接入|未接入/.test(rule.publicReason))).toBe(true);
    expect(conditionalRules.every((rule) => rule.conditionId === undefined && rule.conditionCostSummary === undefined)).toBe(true);
  });
  it("exposes the six condition archetype shapes without inventing mappings or costs", () => {
    expect(BROWSER_ALPHA_CONDITION_ARCHETYPES.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "education-qualification", label: "教育/资格补足" },
      { id: "recommendation-guarantee", label: "推荐/担保" },
      { id: "relevant-history-trial", label: "相关履历/试用" },
      { id: "funds-tools", label: "资金/工具准备" },
      { id: "family-class-compromise", label: "家庭/阶层妥协" },
      { id: "gray-introduction-risk", label: "灰色引荐/风险承诺" },
    ]);
    expect(R2_FIXTURE_CATALOGUE.compatibility.filter((rule) => rule.status === "CONDITIONAL").every(
      (rule) => rule.conditionId === undefined && rule.conditionCostSummary === undefined,
    )).toBe(true);
  });

  it("rejects catalogue drift and keeps validation closed", () => {
    const extraField = cloneCatalogue() as unknown as Record<string, unknown>;
    extraField.secret = "must-not-leak";
    expect(validateCharacterCreationCatalogue(extraField)).toBe(false);

    const wrongCount = cloneCatalogue() as unknown as {
      origins: PublicCharacterCreationCatalogue["origins"];
    };
    wrongCount.origins = wrongCount.origins.slice(0, 9);
    expect(validateCharacterCreationCatalogue(wrongCount)).toBe(false);

    const wrongBirthplaceCount = cloneCatalogue() as unknown as {
      birthplaces: PublicCharacterCreationCatalogue["birthplaces"];
    };
    wrongBirthplaceCount.birthplaces = wrongBirthplaceCount.birthplaces.slice(0, 3);
    expect(validateCharacterCreationCatalogue(wrongBirthplaceCount)).toBe(false);

    const legacyField = cloneCatalogue() as unknown as Record<string, unknown>;
    legacyField.specializations = [];
    expect(validateCharacterCreationCatalogue(legacyField)).toBe(false);
  });

  it("does not use ordinary specialization filters beyond the legacy wire sentinel", () => {
    const catalogue = cloneCatalogue();
    expect(validateSyntheticCharacterCreationCatalogue(catalogue)).toBe(true);
    expect(validateCharacterCreationSelection(R2_FIXTURE_DEFAULT_SELECTION, catalogue)).toMatchObject({ ok: true });
    expect(validateCharacterCreationSelection({
      ...R2_FIXTURE_DEFAULT_SELECTION,
      specializationId: "ordinary-skill-ignored-by-ba1",
    }, catalogue)).toMatchObject({ ok: false, error: { code: "CONTENT_SELECTION_INVALID" } });
    expect(validateCharacterCreationSelection({
      ...R2_FIXTURE_DEFAULT_SELECTION,
      specializationId: "",
    }, catalogue)).toMatchObject({ ok: true });
  });

  it("validates distinct traits, one flaw, references, and compatibility status", () => {
    expect(validateCharacterCreationSelection(R2_FIXTURE_DEFAULT_SELECTION)).toMatchObject({ ok: true });
    expect(validateCharacterCreationSelection({
      ...R2_FIXTURE_DEFAULT_SELECTION,
      traitIds: ["trait-observant", "trait-observant"],
    })).toMatchObject({ ok: false, error: { code: "CONTENT_SELECTION_INVALID" } });
    expect(validateCharacterCreationSelection({
      ...R2_FIXTURE_DEFAULT_SELECTION,
      traitIds: ["trait-observant", "trait-impulsive"],
    })).toMatchObject({ ok: false, error: { code: "CONTENT_SELECTION_INVALID" } });
    expect(validateCharacterCreationSelection({
      ...R2_FIXTURE_DEFAULT_SELECTION,
      originId: "origin-upper-1",
    })).toMatchObject({ ok: false, error: { code: "CONTENT_SELECTION_INVALID" } });
    expect(validateCharacterCreationSelection({
      ...R2_FIXTURE_DEFAULT_SELECTION,
      unexpected: true,
    })).toMatchObject({ ok: false, error: { code: "CONTENT_SELECTION_INVALID" } });
  });

  it("keeps conditional and forbidden handling available for a synthetic catalogue", () => {
    const conditional = cloneCatalogue();
    conditional.compatibility = conditional.compatibility.map((rule) =>
      rule.originId === R2_FIXTURE_DEFAULT_SELECTION.originId &&
      rule.professionId === R2_FIXTURE_DEFAULT_SELECTION.professionId
        ? {
            originId: rule.originId,
            professionId: rule.professionId,
            status: "CONDITIONAL",
            publicReason: "需要确认一个公开条件。",
            conditionId: "condition-public-confirmation",
            conditionCostSummary: "确认公开条件。",
          }
        : rule,
    );
    expect(validateSyntheticCharacterCreationCatalogue(conditional)).toBe(true);
    expect(validateCharacterCreationSelection(R2_FIXTURE_DEFAULT_SELECTION, conditional)).toMatchObject({
      ok: false,
      error: { code: "CONTENT_SELECTION_INVALID" },
    });
    expect(validateCharacterCreationSelection({
      ...R2_FIXTURE_DEFAULT_SELECTION,
      acceptedConditionIds: ["condition-public-confirmation"],
    }, conditional)).toMatchObject({ ok: true });

    const forbidden = cloneCatalogue();
    forbidden.compatibility = forbidden.compatibility.map((rule) =>
      rule.originId === R2_FIXTURE_DEFAULT_SELECTION.originId &&
      rule.professionId === R2_FIXTURE_DEFAULT_SELECTION.professionId
        ? {
            originId: rule.originId,
            professionId: rule.professionId,
            status: "FORBIDDEN",
            publicReason: "该组合暂不可行。",
          }
        : rule,
    );
    expect(validateCharacterCreationSelection(R2_FIXTURE_DEFAULT_SELECTION, forbidden)).toMatchObject({
      ok: false,
      error: { code: "CONTENT_SELECTION_INVALID" },
    });
  });

  it("creates an ordinary-person state without gameplay randomness or birthplace effects", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used by the R2 domain");
    });

    const state = createR2CharacterRunState(
      "550e8400-e29b-41d4-a716-446655440000",
      R2_FIXTURE_DEFAULT_SELECTION,
      R2_FIXTURE_CATALOGUE,
      BROWSER_ALPHA_CANDIDATE,
    );

    expect(state).toMatchObject({
      contractVersion: CONTRACT_VERSION,
      ruleVersion: RULE_VERSION,
      contentVersion: CONTENT_VERSION,
      revision: 1,
      week: R2_FIXTURE_DEFAULTS.week,
      availableActions: R2_FIXTURE_DEFAULTS.availableActions,
      cashPence: 96,
      character: {
        displayName: "Ada",
        originCountry: "LOEN",
        sequence: "ORDINARY",
        coreStats: { physique: 19, perception: 16, will: 16, knowledge: 15 },
        resources: R2_FIXTURE_DEFAULTS.resources,
        traits: [{ id: "trait-observant", label: "善于观察" }, { id: "trait-patient", label: "耐心" }],
      },
      lastAction: null,
    });
    expect("specialization" in state.character).toBe(false);
    expect(state.chronicle).toHaveLength(1);
    expect(Object.keys(state.character.profession).sort()).toEqual(["id", "label", "legality"]);
    expect(state.stateChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(hasValidStateChecksum(state)).toBe(true);
    random.mockRestore();
  });

  it("derives distinct review-candidate opening stats and personal cash from origin and profession", () => {
    const laborDock = createR2CharacterRunState(
      "550e8400-e29b-41d4-a716-446655440000",
      R2_FIXTURE_DEFAULT_SELECTION,
      R2_FIXTURE_CATALOGUE,
      BROWSER_ALPHA_CANDIDATE,
    );
    const professionalLawyer = createR2CharacterRunState(
      "550e8400-e29b-41d4-a716-446655440001",
      {
        ...R2_FIXTURE_DEFAULT_SELECTION,
        originId: "origin-upper-middle-1",
        professionId: "profession-lawyer",
      },
      R2_FIXTURE_CATALOGUE,
      BROWSER_ALPHA_CANDIDATE,
    );

    expect(laborDock.character.coreStats).toEqual({ physique: 19, perception: 16, will: 16, knowledge: 15 });
    expect(laborDock.cashPence).toBe(96);
    expect(professionalLawyer.character.coreStats).toEqual({ physique: 14, perception: 16, will: 16, knowledge: 20 });
    expect(professionalLawyer.cashPence).toBe(720);
    expect(professionalLawyer.chronicle[0]?.summary).toContain("高等教育");
    expect(hasValidStateChecksum(laborDock)).toBe(true);
    expect(hasValidStateChecksum(professionalLawyer)).toBe(true);
  });

  it("uses canonical sorted keys and preserves array order", () => {
    expect(stableStringify({ z: 1, a: [{ b: 2, a: 1 }] })).toBe(
      '{"a":[{"a":1,"b":2}],"z":1}',
    );
    expect(() => stableStringify(new Date("2026-01-01T00:00:00.000Z"))).toThrow();
    expect(() => stableStringify(new Map([["secret", "value"]]))).toThrow();
  });

  it("consumes exactly one action and advances after the third action", () => {
    const initial = createR2CharacterRunState(
      "550e8400-e29b-41d4-a716-446655440000",
      R2_FIXTURE_DEFAULT_SELECTION,
      R2_FIXTURE_CATALOGUE,
      BROWSER_ALPHA_CANDIDATE,
    );
    const first = applyWeeklyAction(initial, "WORK", BROWSER_ALPHA_CANDIDATE);
    const second = applyWeeklyAction(first, "LEARN", BROWSER_ALPHA_CANDIDATE);
    const third = applyWeeklyAction(second, "INVESTIGATE", BROWSER_ALPHA_CANDIDATE);

    expect(first).toMatchObject({ revision: 2, week: 1, availableActions: 2 });
    expect(second).toMatchObject({ revision: 3, week: 1, availableActions: 1 });
    expect(third).toMatchObject({ revision: 4, week: 2, availableActions: 3 });
    expect(third.lastAction).toMatchObject({
      action: "INVESTIGATE",
      weekBefore: 1,
      weekAfter: 2,
      availableActionsBefore: 1,
      availableActionsAfter: 3,
      weekAdvanced: true,
    });
    expect(third.cashPence).toBe(initial.cashPence + 84);
    expect(third.character.coreStats).toEqual({ ...initial.character.coreStats, knowledge: initial.character.coreStats.knowledge + 5 });
    expect(third.character.resources).toEqual(initial.character.resources);
    expect(third.chronicle).toHaveLength(4);
    expect(hasValidStateChecksum(third)).toBe(true);
    for (const entry of third.chronicle.slice(1)) {
      expect(entry.summary).not.toMatch(/本轮|当前轮|fixture|工程/i);
    }
  });

  it("settles the candidate profession pay at most once per week", () => {
    const initial = createR2CharacterRunState(
      "550e8400-e29b-41d4-a716-446655440000",
      R2_FIXTURE_DEFAULT_SELECTION,
      R2_FIXTURE_CATALOGUE,
      BROWSER_ALPHA_CANDIDATE,
    );
    const firstWork = applyWeeklyAction(initial, "WORK", BROWSER_ALPHA_CANDIDATE);
    const repeatedWork = applyWeeklyAction(firstWork, "WORK", BROWSER_ALPHA_CANDIDATE);
    const nextWeek = applyWeeklyAction(repeatedWork, "REST", BROWSER_ALPHA_CANDIDATE);
    const nextWeekWork = applyWeeklyAction(nextWeek, "WORK", BROWSER_ALPHA_CANDIDATE);

    expect(firstWork.cashPence).toBe(initial.cashPence + 84);
    expect(firstWork.lastAction?.summary).toContain("0 镑 7 苏勒 0 便士");
    expect(repeatedWork.cashPence).toBe(firstWork.cashPence);
    expect(repeatedWork.lastAction?.summary).toContain("本周职业工资已经结算");
    expect(nextWeek).toMatchObject({ week: 2, availableActions: 3 });
    expect(nextWeekWork.cashPence).toBe(initial.cashPence + 168);
  });

  it("keeps the legacy fixture configuration at default stats and zero cash", () => {
    const initial = createR2CharacterRunState(
      "550e8400-e29b-41d4-a716-446655440000",
      R2_FIXTURE_DEFAULT_SELECTION,
      R2_FIXTURE_CATALOGUE,
      LEGACY_FIXTURE,
    );
    const afterWork = applyWeeklyAction(initial, "WORK", LEGACY_FIXTURE);

    expect(initial.cashPence).toBe(0);
    expect(initial.character.coreStats).toEqual({ physique: 15, perception: 15, will: 15, knowledge: 15 });
    expect(initial.chronicle[0]).toEqual({
      id: "r2-character-created",
      week: 1,
      date: R2_FIXTURE_DEFAULTS.currentDate,
      title: "普通人周目建立",
      summary: "角色选择已确认，第一周从普通人的日常开始。",
    });
    expect(afterWork.cashPence).toBe(0);
    expect(afterWork.chronicle[1]).toMatchObject({ id: "r2-action-2", week: 1 });
  });
  it("rejects action application when no action remains", () => {
    const initial = createR2CharacterRunState(
      "550e8400-e29b-41d4-a716-446655440000",
      R2_FIXTURE_DEFAULT_SELECTION,
      R2_FIXTURE_CATALOGUE,
      BROWSER_ALPHA_CANDIDATE,
    );
    const exhausted = { ...initial, availableActions: 0 };
    expect(() => applyWeeklyAction(exhausted, "REST", BROWSER_ALPHA_CANDIDATE)).toThrow("No weekly action remains");
  });
});
