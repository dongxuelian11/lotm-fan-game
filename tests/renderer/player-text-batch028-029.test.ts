import { describe, expect, it } from "vitest";
import { playerText, projectPlayerText } from "../../src/shared/player-text.js";
const copies = [
  [
    "完整配方、材料与6→5晋升仪式细节尚未核实；这里只提供有来源的G独立成品与导师准备，不解锁调配，也不宣称原著无需仪式。晋升须先结束旧灾祸教士接触；健康须高于20、精神须高于40，成功后灵性上限100但不补满。",
    "完整配方、材料与6→5晋升仪式细节尚未掌握；这里只提供有来源的独立成品与导师准备，不解锁调配，服药前仍须完成准备。晋升须先结束旧灾祸教士接触；健康须高于20、精神须高于40，成功后灵性上限100但不补满。"
  ],
  [
    "完整配方、材料与6→5晋升仪式细节尚未核实；这里只提供有来源的G独立成品与导师准备，不解锁调配，也不宣称原著无需仪式。晋升须先结束旧活尸接触并度过原待处理月圆。",
    "完整配方、材料与6→5晋升仪式细节尚未掌握；这里只提供有来源的独立成品与导师准备，不解锁调配，服药前仍须完成准备。晋升须先结束旧活尸接触并度过原待处理月圆。"
  ],
  [
    "完整配方与6→5晋升仪式细节仍待核实；本次只确认本作原创G导师准备与指导流程中的这一成品原瓶，不表示原著无需仪式。",
    "完整配方与6→5晋升仪式细节尚未掌握；本次只确认导师准备与指导流程中的这一成品原瓶，服药前仍须完成准备。"
  ],
  [
    "完整晋升配方、材料与剂量尚未核实；这里只提供有来源的G独立成品，用药指导不解锁调配。",
    "完整晋升配方、材料与剂量尚未掌握；这里只提供有来源的独立成品，用药指导不解锁调配。"
  ],
  [
    "三项报告各25扮演进度，反思25，属于本作原创G的有限和平成长；不保证原著中无代价完成扮演或解除月圆诅咒。本阶段不开放序列5怨魂的虚化、穿墙、镜面跳跃或附体。",
    "三项报告各25扮演进度，反思25，属于有限和平成长；不保证无代价完成扮演，也不能解除月圆诅咒。本页活尸阶段不提供序列5怨魂的虚化、穿墙、镜面跳跃或附体。"
  ],
  [
    "本瓶和当次准备成功失败均耗尽；旧17掌握、原人原物、旧死亡与和平结局、伤势及风险保留。当前灵性不补满，完整配方和原著仪式仍未知。",
    "本瓶和当次准备成功失败均耗尽；旧17掌握、原人原物、旧死亡与和平结局、伤势及风险保留。当前灵性不补满，完整配方与晋升仪式细节尚未掌握，服药前仍须完成专业准备。"
  ],
  [
    "完整晋升配方与仪式细节尚未核实；本作采用原创G专业指导准备，不等于还原原著完整仪式。血族晋升序列4仍需仪式，不能沿用低序列免仪式说法。",
    "完整晋升配方与仪式细节尚未掌握；服药前须完成专业指导准备，不提供完整仪式步骤。血族晋升序列4仍需仪式，不能沿用低序列免仪式说法。"
  ],
  [
    "消耗最早合格自持原微光片（0S，减18×制作固定效力G）",
    "消耗最早合格自持原微光片（0S，减18×制作固定效力）"
  ],
  [
    "本页三项有限法术、课程、实践情境、成品渠道和数值均为游戏设定（G），不作为原著已核法术。晋升不会自动学会所有法术，也不自动加入组织。",
    "本页显示三项有限法术、课程、实践情境与成品渠道，具体数值以当前说明为准。晋升不会自动学会所有法术，也不自动加入组织。"
  ],
  [
    "智慧天使 · 阅读者序列2候选（G扩展）",
    "智慧天使 · 阅读者序列2"
  ]
] as const;
describe("exact authored final renderer display", () => {
  it.each(copies)("preserves exact costs and scope for %s", (source, expected) => {
    const original = { description: source, random: { seed: "G-SEED", cursor: 19 }, command: { type: "UNCHANGED", label: source }, character: { name: "候选G玩家" }, originalItem: { id: source, paidPence: 4800, count: 3 } };
    const bytes = JSON.stringify(original), actual = projectPlayerText(original, original.character.name);
    expect(playerText(source)).toBe(expected); expect(playerText(expected)).toBe(expected); expect(actual.description).toBe(expected);
    expect(actual.random).toBe(original.random); expect(actual.command).toBe(original.command); expect(actual.character).toBe(original.character); expect(actual.originalItem).toBe(original.originalItem); expect(JSON.stringify(original)).toBe(bytes);
  });
});
