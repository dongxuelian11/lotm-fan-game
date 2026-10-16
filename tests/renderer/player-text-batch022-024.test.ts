import { describe, expect, it } from "vitest";
import { playerText, projectPlayerText } from "../../src/shared/player-text.js";

const copies = [
  [
    "本阶段具体能力与成品药渠道属于游戏设定（G），原著细节与完整配方待核。取得渠道或晋升不会自动加入教会。",
    "本阶段具体能力与成品药渠道以当前说明为准，当前渠道只提供成品魔药，不提供完整配方。取得渠道或晋升不会自动加入教会。"
  ],
  [
    "具体能力按游戏设定（G）实现有限观察、假设比较与实际检验；原著正文细节与完整配方仍待核实。结论必须受已有资料约束，不能读心、凭空生成证据或自动得知真相。",
    "具体能力限于有限观察、假设比较与实际检验；当前渠道只提供成品魔药，不提供完整配方。结论必须受已有资料约束，不能读心、凭空生成证据或自动得知真相。"
  ],
  [
    "完整晋升配方、材料与剂量尚未核实；指导只说明有来源的独立成品原瓶，不展示虚构配方或开放晋升魔药调配。",
    "指导只说明有来源的独立成品原瓶，不提供完整晋升配方、材料与剂量；不展示虚构配方，也不开放晋升魔药调配。"
  ],
  [
    "已核范围是恶魔知识与仪式。本页指导者、成品渠道、三项不伤人的知识／仪式练习、成本与消化解释为游戏设定（G），不代表原著保证此途径可以无痛善良消化。本阶段不开放序列6的火焰、诅咒、巨大化、魔甲或危险预知。",
    "本页展示恶魔知识与仪式的有限实践。本页指导者、成品渠道、三项不伤人的知识／仪式练习、成本与消化解释以当前说明为准，不保证此途径可以无痛善良消化。本阶段不开放序列6的火焰、诅咒、巨大化、魔甲或危险预知。"
  ],
  [
    "先观察原物，再选择当前公开的有限仪式或普通对照。准备、实际尝试、收束和有限报告分别提交；准备或报告不能替代实际收束。三项不伤人练习与具体成本均为游戏设定（G），不保证未知来源可信。",
    "先观察原物，再选择当前公开的有限仪式或普通对照。准备、实际尝试、收束和有限报告分别提交；准备或报告不能替代实际收束。三项不伤人练习与具体成本以当前说明为准，不保证未知来源可信。"
  ],
  [
    "罪犯与折翼天使时期的原记录、能力掌握和消化继续保留，角色已失去的原有良知不会恢复。这里仅显示恶魔知识与仪式的有限掌握；不提供未核魔类法术、完整真相或保证安全的接触。G练习的消化进度不等于原著确认的普遍善良消化路线。",
    "罪犯与折翼天使时期的原记录、能力掌握和消化继续保留，角色已失去的原有良知不会恢复。这里仅显示恶魔知识与仪式的有限掌握；不提供额外魔类法术、完整真相或保证安全的接触。练习的消化进度不保证这是一条普遍适用的善良消化路线。"
  ],
  [
    "阴影藏匿不等于物理免疫、穿墙、瞬移或绝对隐形。灯位与现场条件变化可能暴露真实身体，即使已经暴露，也仍须实际结束本次实践并由普通退路离开。本页的指导者、成品渠道、情境和数值为游戏设定（G）；晋升不自动加入组织。",
    "阴影藏匿不等于物理免疫、穿墙、瞬移或绝对隐形。灯位与现场条件变化可能暴露真实身体，即使已经暴露，也仍须实际结束本次实践并由普通退路离开。本页的指导者、成品渠道、情境和数值以当前说明为准；晋升不自动加入组织。"
  ],
  [
    "先观察现场，再从当前公开方法中选择阴影藏匿或普通方法。没有可用阴影时使用普通方法；藏匿不会让堵塞路线通行，也不会移动身体穿过障碍。准备、实际尝试、显形退出和报告分别提交；退出准备不能替代实际退出。普通方法与练习情境均为游戏设定（G）。",
    "先观察现场，再从当前公开方法中选择阴影藏匿或普通方法。没有可用阴影时使用普通方法；藏匿不会让堵塞路线通行，也不会移动身体穿过障碍。准备、实际尝试、显形退出和报告分别提交；退出准备不能替代实际退出。普通方法与练习情境以当前说明为准。"
  ]
] as const;

describe("Exact renderer022-024 player copy", () => {
  it.each(copies)("preserves raw records and boundaries for %s", (source, display) => {
    const input = {
      character: { name: "候选G" }, command: { type: "KEEP", label: source },
      random: { seed: "G1-seed", cursor: 103 }, progression: { sequence: 7, mastery: { "G1": 33 } },
      title: source, history: [source],
      original: { id: source, cost: 360, bottlePrice: 3320, labour: 5, credit: 3000, balance: 320, will: 24 },
      wheel: [{ id: "G1", label: source, weight: 25 }, { id: "G6", label: "原G1五人", weight: 75 }],
    };
    const before = structuredClone(input), bytes = JSON.stringify(input);
    const output = projectPlayerText(input, input.character.name);
    expect(playerText(source)).toBe(display);
    expect(playerText(display)).toBe(display);
    expect(output.title).toBe(display);
    expect(output.history).toEqual([display]);
    expect(output.wheel).toEqual([{ id: "G1", label: display, weight: 25 }, { id: "G6", label: "原G1五人", weight: 75 }]);
    expect(output.character).toBe(input.character);
    expect(output.command).toBe(input.command);
    expect(output.random).toBe(input.random);
    expect(output.progression).toBe(input.progression);
    expect(output.original).toBe(input.original);
    expect(input).toEqual(before);
    expect(JSON.stringify(input)).toBe(bytes);
  });
});
