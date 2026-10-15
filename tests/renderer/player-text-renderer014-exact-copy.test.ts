import { describe, expect, it } from "vitest";
import { playerText, projectPlayerText } from "../../src/shared/player-text";

const cases = [
  [
    "完整魔药配方与剂量仍未核实，指导仅说明有来源的独立成品原瓶。催眠与心理学隐身只按当前公开条件使用，不能保证控制他人或证明供词真相。具体故事、判定、费用与消化数值为本作原创G。",
    "尚未掌握完整魔药配方与剂量，指导仅说明有来源的独立成品原瓶。催眠与心理学隐身只按当前公开条件使用，不能保证控制他人或证明供词真相。具体故事、判定、费用与消化数值以当前说明为准。"
  ],
  [
    "。名称与序列3对应、三项新增实践均为候选G；完整配方与原著晋升仪式仍未核。",
    "。本次晋升仍须完成三项专业准备与当次场地检查；当前渠道不提供完整配方，晋升仪式细节尚未掌握。"
  ],
  [
    "仪式需要至少30名真正共同成长、互相信任并默契协作的成员。完整配方与完整仪式布置尚未核实；本作G成品供给不取消仪式，也不能付款购买战友情谊。",
    "仪式需要至少30名真正共同成长、互相信任并默契协作的成员。完整配方与完整仪式布置尚未掌握；成品供给不取消仪式，也不能付款购买战友情谊。"
  ],
  [
    "完整配方与原著晋升仪式细节仍未知。原导师薇娜·贝尔的专业准备、指导、成品与数值都是本作原创G，不能据此断言无需仪式。",
    "完整配方与晋升仪式细节尚未掌握。原导师薇娜·贝尔提供独立成品、专业准备与指导，具体数值以本页说明为准；服药前仍须满足本次准备要求。"
  ],
  [
    "继承的身体禁令、惩戒、囚禁与伤口宣判继续保留，但不凭名称生成任意效果、自动免疫或免费资源。本作未开放免费神话形态；完整配方和原著晋升仪式未知，不显示未核材料清单。",
    "继承的身体禁令、惩戒、囚禁与伤口宣判继续保留，但不凭名称生成任意效果、自动免疫或免费资源。这里不提供免费神话形态；尚未掌握完整配方和晋升仪式，不显示未掌握的材料清单。"
  ]
] as const;

describe("renderer014 exact authored player copy", () => {
  it.each(cases)("adapts the exact authored paragraph %s without dropping conditions", (source, display) => {
    expect(playerText(source)).toBe(display);
    expect(playerText(display)).toBe(display);
    const saved = { story: source, character: { name: "候选G原名" }, command: { type: "UNTOUCHED", text: source } };
    const before = structuredClone(saved), projection = projectPlayerText(saved);
    expect(projection.story).toBe(display);
    expect(saved).toEqual(before);
    expect(projection.character).toBe(saved.character);
    expect(projection.command).toBe(saved.command);
  });

  it("preserves real group identifiers", () => {
    expect(playerText("G1、G2、G3、G4、G5、G6")).toBe("G1、G2、G3、G4、G5、G6");
  });
});
