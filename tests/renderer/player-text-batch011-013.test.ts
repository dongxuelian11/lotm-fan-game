import { describe, expect, it } from "vitest";
import { playerText, projectPlayerText } from "../../src/shared/player-text.js";

const copies = [
  [
    "已核实的仪式部分要求积累多种普通动物与三种超凡生物的习性、身体构造知识，并亲笔写出知识和经历。完整配方、材料剂量与其余完整仪式步骤尚未核实；独立G成品不能代替这些实际学习与记录。",
    "晋升准备要求积累多种普通动物与三种超凡生物的习性、身体构造知识，并亲笔写出知识和经历。完整配方、材料剂量与其余完整仪式步骤尚未掌握；独立成品不能代替这些实际学习与记录。"
  ],
  [
    "本阶段新增地下潜行一项掌握，继承原九项能力与实际掌握。已核原著支持地下潜行及地面软化后恢复，未提供这里的具体距离、速度和消耗；已知1米土段、两端安全出口、费用与成长均为本作G原创适配。",
    "本阶段新增地下潜行一项掌握，继承原九项能力与实际掌握。地下潜行可在通过后恢复软化的地面；具体距离、速度和消耗以当前场地说明为准。当前仅限已知1米土段与两端安全出口，费用与成长按本页说明结算。"
  ],
  [
    "格斗技巧是本作新增的一项游戏设定（G）训练分类；原有战士能力与掌握记录继续继承。练习需要成年伙伴明确同意，停止信号必须落实为实际松开。格斗家仍会受到精神影响与恐惧干扰，不免伤、不徒手防弹；序列6晨曦铠甲、晨曦武器与光之风暴尚未开放。",
    "格斗技巧在本阶段新增为一项训练分类；原有战士能力与掌握记录继续继承。练习需要成年伙伴明确同意，停止信号必须落实为实际松开。格斗家仍会受到精神影响与恐惧干扰，不免伤、不徒手防弹；本页不提供序列6晨曦铠甲、晨曦武器与光之风暴。"
  ],
  [
    "原著能力边界之外，三项有限实践、软垫试探、距离、伤害、消耗、判定、导师准备、独立成品渠道与消化数值均为本作原创G。完整配方和晋升仪式细节仍待核实，不能断言无需仪式。",
    "三项有限实践、软垫试探、距离、伤害、消耗、判定、导师准备、独立成品渠道与消化数值以本页说明为准。完整配方和晋升仪式细节尚未掌握，服药前仍须完成当前渠道要求的准备。"
  ],
  [
    "完整配方与原著晋升仪式细节仍未知。原导师米蕾·沃德的专业准备、指导、成品与数值都是本作原创G，不能据此断言无需仪式。",
    "完整配方与晋升仪式细节尚未掌握。原导师米蕾·沃德提供独立成品、专业准备与指导，具体数值以本页说明为准；服药前仍须满足本次准备要求。"
  ]
] as const;

describe("exact renderer011–013 player paragraphs", () => {
  it.each(copies)("preserves preparation, costs and local ability scope for %s", (source, expected) => {
    const original = { description: source, random: { seed: "G-SEED", cursor: 19 }, command: { type: "UNCHANGED", label: source }, character: { name: "候选G玩家" }, originalItem: { id: source, paidPence: 460, count: 3 } };
    const bytes = JSON.stringify(original), actual = projectPlayerText(original, original.character.name);
    expect(playerText(source)).toBe(expected); expect(playerText(expected)).toBe(expected); expect(actual.description).toBe(expected);
    expect(actual.random).toBe(original.random); expect(actual.command).toBe(original.command); expect(actual.character).toBe(original.character);
    expect(actual.originalItem).toBe(original.originalItem); expect(JSON.stringify(original)).toBe(bytes);
  });
});
