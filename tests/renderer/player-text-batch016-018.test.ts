import { describe, expect, it } from "vitest";
import { playerText, projectPlayerText } from "../../src/shared/player-text.js";
const copies = [
  [
    "直接听到对应隐秘存在的耳语，不等于可靠理解或证明真相。可能获得的独特或扭曲力量不是自动赐予，也不是通用法术。本页的指导者、成品渠道、情境和数值为游戏设定（G）；晋升不自动加入组织。",
    "直接听到对应隐秘存在的耳语，不等于可靠理解或证明真相。可能获得的独特或扭曲力量不是自动赐予，也不是通用法术。本页显示指导者、成品渠道、情境与实际数值；晋升不自动加入组织。"
  ],
  [
    "取得渠道或晋升不会自动加入组织。成年指导者艾妲·芬恩、成品供给、三项实践与数值为本作原创G。记录片段、普通核实与承认未知是本阶段G扮演解释，可完成本阶段消化；偶发预兆不等于确定未来，也不是原著保证。",
    "取得渠道或晋升不会自动加入组织。成年指导者艾妲·芬恩、成品供给、三项实践与数值以当前说明为准。记录片段、普通核实与承认未知是本阶段的扮演方式，可完成本阶段消化；偶发预兆不等于确定未来。"
  ],
  [
    "取得有来源的成品原瓶，由当前自愿且在场的专家主持原创G专业准备；不编造原著材料清单或操作步骤。",
    "取得有来源的成品原瓶，由当前自愿且在场的专家主持专业准备；当前渠道不提供完整配方、材料清单或操作步骤。"
  ],
  [
    "完整晋升配方与仪式细节尚未核实；本作采用原创G专业指导准备，不等于还原原著完整仪式。特殊跨途径晋升个例不能当作守夜人的通用配方。",
    "完整晋升配方与仪式细节尚未掌握；服药前须完成专业指导准备，不提供完整仪式步骤。特殊跨途径晋升个例不能当作守夜人的通用配方。"
  ],
  [
    "完整配方与原著晋升仪式细节仍未知。原导师艾妲·芬恩的专业准备、指导、成品与数值都是本作原创G，不能据此断言无需仪式。",
    "完整配方与晋升仪式细节尚未掌握。原导师艾妲·芬恩提供独立成品、专业准备与指导，具体数值以本页说明为准；服药前仍须满足本次准备要求。"
  ],
  [
    "完整配方与原著晋升仪式细节仍未知。艾妲·芬恩的专业准备、成品、指导与数值属于本作原创G，不能据此断言无需仪式。确认仅服用这一原瓶，无论成败均实际耗用。",
    "完整配方与晋升仪式细节尚未掌握。艾妲·芬恩提供独立成品、专业准备与指导，具体数值以本页说明为准；服药前仍须满足本次准备要求。确认仅服用这一原瓶，无论成败均实际耗用。"
  ]
] as const;
describe("exact player paragraphs for batches sixteen through eighteen", () => {
  it.each(copies)("preserves bounded facts without editorial markers for %s", (source, expected) => {
    const original = { description: source, random: { seed: "G-SEED", cursor: 19 }, command: { type: "UNCHANGED", label: source }, character: { name: "候选G玩家" }, originalItem: { id: source, paidPence: 7200, count: 3 } };
    const bytes = JSON.stringify(original), actual = projectPlayerText(original, original.character.name);
    expect(playerText(source)).toBe(expected); expect(playerText(expected)).toBe(expected); expect(actual.description).toBe(expected);
    expect(actual.random).toBe(original.random); expect(actual.command).toBe(original.command); expect(actual.character).toBe(original.character); expect(actual.originalItem).toBe(original.originalItem); expect(JSON.stringify(original)).toBe(bytes);
  });
});
