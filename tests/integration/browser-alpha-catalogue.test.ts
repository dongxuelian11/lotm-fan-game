import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { R2_FIXTURE_CATALOGUE } from "../../src/content/r2-catalogue.js";
import { sha256Hex } from "../../src/domain/checksum.js";

describe("browser alpha public character catalogue", () => {
  it("keeps the shared checksum implementation synchronous and browser safe", () => {
    const checksumSource = readFileSync(new URL("../../src/domain/checksum.ts", import.meta.url), "utf8");

    // BA1 browser regression, 2026-08-31: node:crypto bundled successfully but crashed at runtime.
    expect(checksumSource).not.toMatch(/from ["']node:/);
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("诡秘之主")).toBe("9720b145e6a402b036a5a4f02543128f89837727617ca880fbafa78572796995");
  });

  it("publishes the locked locations, origins, professions and compatibility coverage without ordinary skills", () => {
    expect(R2_FIXTURE_CATALOGUE.birthplaces.map((entry) => entry.label)).toEqual([
      "贝克兰德",
      "廷根市",
      "康斯顿市",
      "普利兹港",
    ]);
    expect(R2_FIXTURE_CATALOGUE.origins.map((entry) => entry.label)).toEqual([
      "无依街巷长大",
      "负债失业家庭",
      "工厂工资家庭",
      "雇主依附的服务家庭",
      "自营小店/小作坊家庭",
      "受教育的基层职员家庭",
      "高等教育专业人士家庭",
      "中型商贸/产业经营家庭",
      "贵族家系",
      "获社会承认的实业/金融精英家庭",
    ]);
    expect(R2_FIXTURE_CATALOGUE.professions.map((entry) => entry.label)).toEqual([
      "工厂工人",
      "码头工人",
      "宅邸仆役",
      "手工业学徒",
      "商店店员",
      "公司文员",
      "基层警员",
      "私家侦探",
      "公司会计",
      "律师",
      "赏金猎人",
      "帮派跑腿",
    ]);

    expect(R2_FIXTURE_CATALOGUE.origins.every((entry) => {
      return entry.opening.status === "BALANCE_REVIEW_CANDIDATE" &&
        Number.isInteger(entry.opening.openingKnowledgeBonus);
    })).toBe(true);
    expect(R2_FIXTURE_CATALOGUE.professions.every((entry) => {
      return entry.opening.status === "BALANCE_REVIEW_CANDIDATE" &&
        Number.isInteger(entry.opening.initialCashPence) &&
        Number.isInteger(entry.opening.weeklyWorkPayPence);
    })).toBe(true);

    expect(R2_FIXTURE_CATALOGUE.compatibility).toHaveLength(120);
    expect(R2_FIXTURE_CATALOGUE.compatibility.filter((entry) => entry.status === "CONDITIONAL")).toHaveLength(55);
    for (const origin of R2_FIXTURE_CATALOGUE.origins) {
      expect(R2_FIXTURE_CATALOGUE.compatibility.filter((entry) => entry.originId === origin.id)).toHaveLength(12);
    }
    expect("specializations" in R2_FIXTURE_CATALOGUE).toBe(false);
  });
});