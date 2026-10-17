import { describe, expect, it } from "vitest";
import { playerText, projectPlayerText } from "../../src/shared/player-text.js";
const copies = [
  [
    "取得渠道或晋升不会自动加入组织。成年指导者罗安·费里、成品供给、三项实践与数值为本作原创G。守住良知的身体与判断实践是本阶段G扮演解释，不是原著保证，也不保证更高序列无需代价。",
    "取得渠道或晋升不会自动加入组织。成年指导者罗安·费里、成品供给、三项实践与数值以当前说明为准。守住良知的身体与判断实践是本阶段的扮演方式，不保证无代价消化，也不保证更高序列无需代价。"
  ],
  [
    "本阶段以耕作知识、时节观察与细致照护三项有界G能力承接耕种者主题，具体效果均以实际观察与行动结果为准。时节观察不控制天气；照护不即时催熟、不凭空创造收成，也不提供弗兰克的序列6杂交能力。原土、原种子、水与作物仍须真实投入和照料；不把候选设计或高序列能力写成已核实原著事实。普通武器、掩体与撤退沿用共同战斗界面。",
    "本阶段以耕作知识、时节观察与细致照护三项有界能力承接耕种者主题，具体效果均以实际观察与行动结果为准。时节观察不控制天气；照护不即时催熟、不凭空创造收成，也不提供弗兰克的序列6杂交能力。原土、原种子、水与作物仍须真实投入和照料；本阶段不直接获得更高序列能力。普通武器、掩体与撤退沿用共同战斗界面。"
  ],
  [
    "三项原创G实践保留普通方法。序列5守护者的代挡与分担伤害尚未开放。",
    "三项实践保留普通方法。本页不直接授予序列5守护者的代挡与分担伤害，须另行满足晋升条件。"
  ]
] as const;
describe("exact earlier-stage player scopes", () => {
  it.each(copies)("preserves all bounded consequences for %s", (source, expected) => {
    const original = { description: source, random: { seed: "G-SEED", cursor: 19 }, command: { type: "UNCHANGED", label: source }, character: { name: "候选G玩家" }, originalItem: { id: source, paidPence: 360, count: 3 } };
    const bytes = JSON.stringify(original), actual = projectPlayerText(original, original.character.name);
    expect(playerText(source)).toBe(expected); expect(playerText(expected)).toBe(expected); expect(actual.description).toBe(expected);
    expect(actual.random).toBe(original.random); expect(actual.command).toBe(original.command); expect(actual.character).toBe(original.character); expect(actual.originalItem).toBe(original.originalItem); expect(JSON.stringify(original)).toBe(bytes);
  });
});
