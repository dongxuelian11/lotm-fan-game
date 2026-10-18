import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  computeSliceCreation,
  previewSliceCreation,
  sliceCreationCatalogue,
  sliceDefaultCreationSelection,
  validateSliceCreation,
  type SliceCreationSelection,
} from "../../src/content/slice-creation.js";
import type { PublicCoreStatKey } from "../../src/shared/contracts.js";

const catalogue = sliceCreationCatalogue;
const professionIds = [
  "profession-factory-worker", "profession-dock-worker", "profession-estate-servant", "profession-craft-apprentice",
  "profession-shop-clerk", "profession-company-clerk", "profession-junior-police-officer", "profession-private-detective",
  "profession-company-accountant", "profession-lawyer", "profession-bounty-hunter", "profession-gang-runner",
];
// The original V1 table in roster order, independently encoded from the selection implementation.
const expectedMatrix = [
  "DDCCCCCCFFDD", "DDDDDCCCFFCD", "DDCDDCCCFFDD", "CCDCDDCCFFCD", "CCCDDCCDCFCC",
  "CCCCDDDCDFCC", "FFCCCDDDDDFF", "CCCCDDCCDCFF", "FFCFCDDCCDFF", "CCCCDDCCDDFF",
];
const statuses = { D: "DIRECT", C: "CONDITIONAL", F: "FORBIDDEN" } as const;
const expectedConditionCosts = [
  30, 60, 30, 60, 60, 60, 60, 60, 60, 90, 30, 60, 60, 60, 60, 30, 60, 60, 60, 90,
  60, 30, 30, 60, 60, 120, 90, 60, 60, 60, 30, 60, 60, 90, 60, 120, 60, 30, 120, 60,
  60, 60, 60, 90, 360, 240, 240, 120, 120, 240, 240, 240, 120, 120, 120,
];

function selectionFor(originIndex: number, professionId: string): SliceCreationSelection {
  const origin = catalogue.origins[originIndex]!;
  const rule = catalogue.compatibility.find((entry) => entry.originId === origin.id && entry.professionId === professionId)!;
  return {
    ...sliceDefaultCreationSelection,
    originId: origin.id,
    professionId,
    educationLevel: origin.opening.defaultEducation,
    livingStandardId: origin.opening.defaultLivingStandardId,
    acceptedConditionIds: rule.conditionId === undefined ? [] : [rule.conditionId],
  };
}
function expectInvalid(selection: unknown, message?: string): void {
  const result = validateSliceCreation(selection);
  expect(result.ok).toBe(false);
  if (!result.ok && message !== undefined) expect(result.errors.join(" ")).toContain(message);
}

describe("complete approved slice creation catalogue", () => {
  it("keeps 10 origins in five pairs, 12 professions and all original 120 statuses", () => {
    expect(catalogue.origins).toHaveLength(10);
    expect(catalogue.professions.map((entry) => entry.id)).toEqual(professionIds);
    expect(catalogue.compatibility).toHaveLength(120);
    expect(new Set(catalogue.compatibility.map((entry) => `${entry.originId}/${entry.professionId}`)).size).toBe(120);
    for (const tier of ["POOR", "LABOR", "LOWER_MIDDLE", "UPPER_MIDDLE", "UPPER"]) expect(catalogue.origins.filter((entry) => entry.tier === tier)).toHaveLength(2);
    const counts = { DIRECT: 0, CONDITIONAL: 0, FORBIDDEN: 0 };
    catalogue.origins.forEach((origin, originIndex) => {
      expect(expectedMatrix[originIndex]).toHaveLength(12);
      professionIds.forEach((professionId, professionIndex) => {
        const rule = catalogue.compatibility.find((entry) => entry.originId === origin.id && entry.professionId === professionId)!;
        const symbol = expectedMatrix[originIndex]![professionIndex] as keyof typeof statuses;
        expect(rule.status, `${origin.originCode}/${professionId}`).toBe(statuses[symbol]);
        counts[rule.status] += 1;
        const selection = selectionFor(originIndex, professionId);
        if (rule.status === "FORBIDDEN") {
          expectInvalid(selection, "付钱也不能解锁");
          expectInvalid({ ...selection, acceptedConditionIds: ["C01"] }, "付钱也不能解锁");
        } else {
          const validated = validateSliceCreation(selection);
          expect(validated.ok, `${origin.originCode}/${professionId}`).toBe(true);
          expect(computeSliceCreation(selection).character.profession.id).toBe(professionId);
        }
      });
    });
    expect(counts).toEqual({ DIRECT: 42, CONDITIONAL: 55, FORBIDDEN: 23 });
  });

  it("assigns every conditional cell one unique C01–C55 prerequisite and one exact cost", () => {
    expect(catalogue.conditions).toHaveLength(55);
    expect(catalogue.conditions.map((entry) => entry.id)).toEqual(expectedConditionCosts.map((_, index) => `C${String(index + 1).padStart(2, "0")}`));
    expect(catalogue.conditions.map((entry) => entry.costPence)).toEqual(expectedConditionCosts);
    expect(new Set(catalogue.conditions.map((entry) => entry.prerequisite)).size).toBe(55);
    expect(new Set(catalogue.conditions.map((entry) => `${entry.originId}/${entry.professionId}`)).size).toBe(55);
    expect(catalogue.conditionArchetypes).toHaveLength(6);
    const documentedConditions = readFileSync(new URL("../../docs/ORIGIN_AND_CAREER_PACK.md", import.meta.url), "utf8")
      .split("\n").filter((line) => /^\| C\d\d \|/u.test(line)).map((line) => line.replace(/^\| | \|$/gu, "").split(" | "));
    expect(documentedConditions).toHaveLength(55);
    const archetypeIds = { E: "education-qualification", R: "recommendation-guarantee", X: "relevant-history-trial", T: "funds-tools", F: "family-class-compromise", G: "gray-introduction-risk" } as const;
    for (const condition of catalogue.conditions) {
      const documented = documentedConditions.find((row) => row[0] === condition.id)!;
      expect(catalogue.origins.find((origin) => origin.id === condition.originId)?.originCode).toBe(documented[1]);
      expect(catalogue.professions.find((profession) => profession.id === condition.professionId)?.label).toBe(documented[2]);
      expect(condition.archetypeId).toBe(archetypeIds[documented[3] as keyof typeof archetypeIds]);
      expect(condition.prerequisite).toBe(documented[4]);
      expect(condition.costPence).toBe(Number(documented[5]));
      const rule = catalogue.compatibility.find((entry) => entry.originId === condition.originId && entry.professionId === condition.professionId)!;
      expect(rule).toMatchObject({ status: "CONDITIONAL", conditionId: condition.id, costPence: condition.costPence, prerequisite: condition.prerequisite, archetypeId: condition.archetypeId });
      expect(catalogue.conditionArchetypes.some((entry) => entry.id === condition.archetypeId)).toBe(true);
      expect(rule.conditionCostSummary).toContain(`${condition.costPence}便士`);
      const index = catalogue.origins.findIndex((origin) => origin.id === condition.originId);
      expectInvalid({ ...selectionFor(index, condition.professionId), acceptedConditionIds: [] }, "需接受");
      expectInvalid({ ...selectionFor(index, condition.professionId), acceptedConditionIds: [condition.id, condition.id] }, "不能重复");
    }
    for (const rule of catalogue.compatibility.filter((entry) => entry.status !== "CONDITIONAL")) {
      expect(rule.conditionId).toBeUndefined();
      expect(rule.costPence).toBeUndefined();
      expect(rule.prerequisite).toBeUndefined();
    }
  });

  it("uses approved origin vectors and complete relationship/economy/opening profiles", () => {
    const expectedStats = [
      [1, 2, 0, -1], [1, 0, 2, -1], [2, 0, 1, -1], [-1, 2, 1, 0], [-1, 2, 0, 1],
      [-1, 0, 1, 2], [-1, 0, 1, 2], [-1, 0, 2, 1], [-1, 1, 2, 0], [-1, 1, 0, 2],
    ];
    expect(catalogue.origins.map((entry) => Object.values(entry.opening.coreStatModifiers))).toEqual(expectedStats);
    expect(catalogue.origins.map((entry) => entry.opening.familyTransferPence)).toEqual([0, 30, 120, 120, 360, 360, 1200, 1200, 2400, 2400]);
    expect(catalogue.origins.map((entry) => entry.opening.initialDebtPence)).toEqual([0, 240, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(catalogue.origins.map((entry) => entry.opening.debtWeeklyRepaymentPence)).toEqual([0, 30, 0, 0, 0, 0, 0, 0, 0, 0]);
    for (const origin of catalogue.origins) {
      expect(Object.values(origin.opening.coreStatModifiers).sort()).toEqual([-1, 0, 1, 2]);
      expect(origin.opening.supportLabel).not.toBe("");
      expect(origin.opening.obligationLabel).not.toBe("");
      expect(origin.opening.eventHooks).toHaveLength(2);
      expect(origin.opening.originOpeningId).toBe(`ORIGIN-${origin.originCode}-START`);
    }
  });

  it("uses the life package profession vectors and exact low/middle/high cash and wages", () => {
    const expectedStats = [
      [2, 0, 1, 0], [2, 1, 0, 0], [0, 2, 1, 0], [1, 2, 0, 0], [0, 2, 0, 1], [0, 0, 1, 2],
      [2, 1, 0, 0], [0, 2, 0, 1], [0, 1, 0, 2], [0, 0, 1, 2], [2, 1, 0, 0], [2, 1, 0, 0],
    ];
    expect(catalogue.professions.map((entry) => Object.values(entry.opening.coreStatModifiers))).toEqual(expectedStats);
    for (const profession of catalogue.professions) {
      expect(Object.values(profession.opening.coreStatModifiers).sort()).toEqual([0, 0, 1, 2]);
      expect(profession.opening.initialCashPence).toBe({ LOW: 120, MIDDLE: 360, HIGH: 720 }[profession.incomeTier]);
      expect(profession.opening.weeklyWorkPayPence).toBe({ LOW: 180, MIDDLE: 360, HIGH: 720 }[profession.incomeTier]);
    }
    expect(catalogue.professions.filter((entry) => entry.auditStatus === "GAME_ADAPTATION").map((entry) => entry.label)).toEqual(["手工业学徒", "商店店员", "帮派跑腿"]);
  });

  it("provides four education levels, five chosen life tiers and pure eight-portrait choices", () => {
    expect(catalogue.educations.map((entry) => [entry.openingKnowledgeBonus, entry.learningKnowledgeBonus])).toEqual([[0, 0], [1, 0], [2, 1], [3, 1]]);
    expect(catalogue.livingStandards.map((entry) => entry.weeklyCostPence)).toEqual([30, 120, 300, 600, 6000]);
    expect(catalogue.livingStandards.map((entry) => [entry.restHealth, entry.restMind, entry.restSpiritualityFraction])).toEqual([[8, 10, 0.1], [12, 15, 0.15], [18, 20, 0.2], [22, 25, 0.25], [25, 30, 0.3]]);
    expect(catalogue.portraits.map((entry) => entry.id)).toEqual(["portrait-01", "portrait-02", "portrait-03", "portrait-04", "portrait-05", "portrait-06", "portrait-07", "portrait-08"]);
    const defaultResult = computeSliceCreation(sliceDefaultCreationSelection);
    for (const portrait of catalogue.portraits) {
      const result = computeSliceCreation({ ...sliceDefaultCreationSelection, portraitId: portrait.id });
      expect(result.character.portrait?.id).toBe(portrait.id);
      expect(result.coreStats).toEqual(defaultResult.coreStats);
      expect(result.cashPence).toBe(defaultResult.cashPence);
      expect(result.weeklyWorkPayPence).toBe(defaultResult.weeklyWorkPayPence);
    }
  });
});

describe("personality effects and incompatibility", () => {
  it("has exactly 12 positive cards and 8 real flaws with one +/-1 effect each", () => {
    expect(catalogue.traits).toHaveLength(12);
    expect(catalogue.flaws).toHaveLength(8);
    for (const stat of ["physique", "perception", "will", "knowledge"] as const) {
      expect(catalogue.traits.filter((entry) => entry.coreStatModifiers[stat] === 1)).toHaveLength(3);
      expect(catalogue.flaws.filter((entry) => entry.coreStatModifiers[stat] === -1)).toHaveLength(2);
    }
    for (const trait of catalogue.traits) expect(Object.values(trait.coreStatModifiers).sort()).toEqual([0, 0, 0, 1]);
    for (const flaw of catalogue.flaws) expect(Object.values(flaw.coreStatModifiers).sort()).toEqual([-1, 0, 0, 0]);
    for (const card of [...catalogue.traits, ...catalogue.flaws]) expect(card.situationTag.length).toBeGreaterThan(0);
  });

  it("rejects every documented incompatible pair, permits all other trait–flaw pairs", () => {
    for (const trait of catalogue.traits) {
      for (const flaw of catalogue.flaws) {
        const other = catalogue.traits.find((entry) => entry.id !== trait.id && !entry.incompatibleTraitIds.includes(flaw.id))!;
        const result = validateSliceCreation({ ...sliceDefaultCreationSelection, traitIds: [trait.id, other.id], flawId: flaw.id });
        expect(result.ok, `${trait.id}/${flaw.id}`).toBe(!trait.incompatibleTraitIds.includes(flaw.id));
        expect(flaw.incompatibleTraitIds.includes(trait.id)).toBe(trait.incompatibleTraitIds.includes(flaw.id));
      }
    }
  });

  it("allows same-attribute traits to stack and the flaw remains a separate -1", () => {
    const result = computeSliceCreation({ ...sliceDefaultCreationSelection, traitIds: ["trait.diligent", "trait.hardy"], flawId: "flaw.careless" });
    expect(result.character.coreStats).toEqual({ physique: 21, perception: 14, will: 17, knowledge: 15 });
    expect(result.statSources.filter((entry) => entry.id.startsWith("trait."))).toHaveLength(2);
    expect(result.statSources.find((entry) => entry.id === "flaw.careless")?.modifiers.perception).toBe(-1);
  });
});

describe("pure preview and final materialization", () => {
  it("matches all documented cash examples with costs deducted exactly once", () => {
    const artisan = selectionFor(0, "profession-craft-apprentice");
    expect(computeSliceCreation(artisan).cashPence).toBe(60);
    const literateArtisan = { ...artisan, educationLevel: "BASIC" as const };
    const zero = computeSliceCreation(literateArtisan);
    expect(zero.cashPence).toBe(0);
    expect(zero.cashBreakdown).toEqual({ professionInitialPence: 120, familyTransferPence: 0, conditionCostPence: 60, educationCostPence: 60, totalPence: 0 });
    expect(zero.initialDebtPence).toBe(0);
    const clerk = computeSliceCreation(selectionFor(1, "profession-company-clerk"));
    expect(clerk.cashPence).toBe(330);
    expect(clerk.initialDebtPence).toBe(240);
    expect(clerk.debtWeeklyRepaymentPence).toBe(30);
    expect(clerk.cashPence + clerk.weeklyWorkPayPence - 30 - clerk.debtWeeklyRepaymentPence).toBe(630);
    expect(computeSliceCreation(selectionFor(8, "profession-estate-servant")).cashPence).toBe(2280);
  });

  it("shows a selected career prerequisite cost before accepting it without paying", () => {
    const selected = { ...selectionFor(0, "profession-craft-apprentice"), acceptedConditionIds: [] };
    const before = JSON.stringify(selected);
    expect(previewSliceCreation(selected).cashBreakdown.conditionCostPence).toBe(60);
    expect(previewSliceCreation(selected).cashBreakdown.totalPence).toBe(60);
    expectInvalid(selected, "需接受");
    expect(JSON.stringify(selected)).toBe(before);
  });

  it("uses explicitly selected alternative education, never grants it from qualification costs", () => {
    const lawyer = selectionFor(7, "profession-lawyer");
    const base = computeSliceCreation(lawyer);
    expect(base.educationLevel).toBe("SECONDARY_VOCATIONAL");
    expect(base.cashBreakdown.educationCostPence).toBe(0);
    expect(base.cashBreakdown.conditionCostPence).toBe(360);
    const higher = computeSliceCreation({ ...lawyer, educationLevel: "HIGHER" });
    expect(higher.character.coreStats.knowledge - base.character.coreStats.knowledge).toBe(1);
    expect(higher.cashPence).toBe(base.cashPence - 360);
    expect(higher.learningKnowledgeBonus).toBe(1);
    expectInvalid({ ...selectionFor(0, "profession-dock-worker"), educationLevel: "HIGHER" }, "学历只能");
  });

  it("shares all preview values with final computation for each valid cell and education variant", () => {
    const catalogueBefore = JSON.stringify(catalogue);
    for (let index = 0; index < catalogue.origins.length; index += 1) {
      const origin = catalogue.origins[index]!;
      for (const rule of catalogue.compatibility.filter((entry) => entry.originId === origin.id && entry.status !== "FORBIDDEN")) {
        const levels = [origin.opening.defaultEducation, ...(origin.opening.alternativeEducation === undefined ? [] : [origin.opening.alternativeEducation.level])];
        for (const educationLevel of levels) {
          const selection = { ...selectionFor(index, rule.professionId), educationLevel };
          const before = JSON.stringify(selection);
          const preview = previewSliceCreation(selection);
          const final = computeSliceCreation(selection);
          expect(final.character.coreStats).toEqual(preview.coreStats);
          expect(final.statSources).toEqual(preview.statSources);
          expect(final.cashBreakdown).toEqual(preview.cashBreakdown);
          expect(final.cashPence).toBe(preview.cashBreakdown.totalPence);
          expect(computeSliceCreation(selection)).toEqual(final);
          expect(JSON.stringify(selection)).toBe(before);
          for (const key of Object.keys(final.coreStats) as PublicCoreStatKey[]) expect(final.coreStats[key]).toBe(final.statSources.reduce((sum, source) => sum + source.modifiers[key], 0));
        }
      }
    }
    expect(JSON.stringify(catalogue)).toBe(catalogueBefore);
  });

  it("does not change stats for age, sex or birthplace, and does not emit origin secrets", () => {
    const base = computeSliceCreation(sliceDefaultCreationSelection);
    for (const birthplace of catalogue.birthplaces) {
      const result = computeSliceCreation({ ...sliceDefaultCreationSelection, age: 45, sex: "MALE", birthplaceId: birthplace.id });
      expect(result.character.coreStats).toEqual(base.character.coreStats);
      expect(result.cashPence).toBe(base.cashPence);
      expect(result.knownEntryClues.map((entry) => entry.id)).toEqual(["LIFE-LEAD-NIGHTSHIFT", "CARE-ACCESS-01"]);
      expect(result.character.sequence).toBe("ORDINARY");
      expect(result.character).not.toHaveProperty("organization");
      expect(result.character).not.toHaveProperty("secret");
      expect(result.character).not.toHaveProperty("specialization");
      expect(result.character.resources).toEqual({ health: { current: 100, max: 100 }, mind: { current: 100, max: 100 }, spirituality: { current: 15, max: 15 }, pollution: 0 });
    }
  });

  it("has an incomplete pure preview and permits chosen living tier without an automatic payment", () => {
    expect(previewSliceCreation({}).coreStats).toEqual({ physique: 15, perception: 15, will: 15, knowledge: 15 });
    const result = computeSliceCreation({ ...sliceDefaultCreationSelection, livingStandardId: "LUXURIOUS" });
    expect(result.livingStandardId).toBe("LUXURIOUS");
    expect(result.cashPence).toBe(240);
    expect(result.initialAvailableActions).toBe(3);
  });
});

describe("authoritative selection validation", () => {
  it("rejects missing, extra, fabricated or malformed selections", () => {
    expect(validateSliceCreation(sliceDefaultCreationSelection).ok).toBe(true);
    for (const selection of [null, [], "character", { ...sliceDefaultCreationSelection, cashPence: 999999 }, { ...sliceDefaultCreationSelection, coreStats: { knowledge: 500 } }]) expectInvalid(selection);
    const noPortrait: Partial<SliceCreationSelection> = { ...sliceDefaultCreationSelection };
    delete noPortrait.portraitId;
    expectInvalid(noPortrait);
    for (const age of [17, 46, 18.5, Number.NaN]) expectInvalid({ ...sliceDefaultCreationSelection, age });
    for (const displayName of ["", " ", "A".repeat(81), "A\nB"]) expectInvalid({ ...sliceDefaultCreationSelection, displayName });
    for (const traitIds of [[], ["trait.diligent"], ["trait.diligent", "trait.diligent"], ["trait.diligent", "trait.watchful", "trait.patient"], ["trait.not-real", "trait.watchful"]]) expectInvalid({ ...sliceDefaultCreationSelection, traitIds });
    expectInvalid({ ...sliceDefaultCreationSelection, flawId: "trait.patient" });
    expectInvalid({ ...sliceDefaultCreationSelection, acceptedConditionIds: ["C01"] }, "直达职业");
    expectInvalid({ ...sliceDefaultCreationSelection, portraitId: "portrait-09" });
    expectInvalid({ ...sliceDefaultCreationSelection, livingStandardId: "FREE" });
    expectInvalid({ ...sliceDefaultCreationSelection, appearanceDescription: "A".repeat(241) });
    expectInvalid({ ...sliceDefaultCreationSelection, specializationId: "free-power" });
    expect(() => computeSliceCreation({ ...sliceDefaultCreationSelection, traitIds: [] })).toThrow("2个");
  });

  it("normalizes safe text and drops the ignored legacy specialization field", () => {
    const result = validateSliceCreation({ ...sliceDefaultCreationSelection, displayName: "  艾达  ", appearanceDescription: "  朴素衣着  ", specializationId: "legacy-none" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.displayName).toBe("艾达");
      expect(result.value.appearanceDescription).toBe("朴素衣着");
      expect(result.value).not.toHaveProperty("specializationId");
    }
  });
});
