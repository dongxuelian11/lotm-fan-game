import { describe, expect, it } from 'vitest';
import { playerText, projectPlayerText } from '../../src/shared/player-text.js';
import { PLAYER_PARAGRAPH_COPY } from '../../src/shared/player-text-copy.js';

const exactRendererParagraphs = [
  ["召唤大师3名称已核实；本次来客、有限门与协作为本作G。完整配方与晋升仪式仍未知。", "召唤大师为月亮序列3。本阶段仅使用一位真实来客、有限门与有限协作；完整配方与晋升仪式细节尚未掌握。"],
  ["月亮序列3召唤大师与下一阶2创生者的名称已核实。完整配方、材料数量、原著晋升仪式与具体能力参数仍未知，不据名称推演创生者造物。", "月亮序列3为召唤大师，下一阶为创生者2。完整配方、材料数量与晋升仪式细节尚未掌握；当前能力范围与消耗以本页说明为准，不据名称推演创生者造物。"],
  ["有限门与有限合作参数为本作G；合作不冒称另一项已核实原著法术。每次只涉及同一位真实来客。", "有限门与有限合作的范围、持续时间和消耗以本页说明为准；有限合作不提供其它法术。每次只涉及同一位真实来客。"],
  ["完整配方与原著晋升仪式细节仍未知。原导师伊芙·莫兰的专业准备、指导、成品与数值都是本作原创G，不能据此断言无需仪式。", "完整配方与晋升仪式细节尚未掌握。原导师伊芙·莫兰提供独立成品、专业准备与指导，具体数值以本页说明为准；服药前仍须满足本次准备要求。"],
  ["六种亲猎遗骸、复杂祭坛与祝福的方向已核；本场生物、天使、布局和数值均为原创G。序列2及以上尚未开放。", "晋升仍须取得本人亲猎六种强大生物的遗骸、准备复杂祭坛并获得祝福；本场生物、天使、布局和数值以当前说明为准。本页不直接授予序列2及以上能力；发现荣耀者渠道后，可查看独立晋升准备，仍须满足其实际条件。"],
  ["原核支持突破一次只外放一位半神灵的限制；本作至多2位外放与全部精确范围、成本、数值均为原创G。完整配方与原著晋升仪式未知。", "三首圣堂在本阶段至多同时外放2位灵，主人同时仍只借1灵；具体范围、成本与数值以当前说明为准。完整配方与晋升仪式细节尚未掌握，服用前仍须完成专业准备。"],
  ["三项专业准备是原创G适配，不充当已核原著仪式。成品原瓶与原灵封存容器独立，购买魔药不会赠送灵魂。", "服药前须实际完成三项专业准备并检查当周场地；完整晋升仪式细节尚未掌握。成品原瓶与原灵封存容器独立，购买魔药不会赠送灵魂。"],
  ["已核长寿年轻外观与镜界道路方向；本场原镜、人物、有限路线与数值均为原创G。完整配方与原著晋升仪式未知，序列2及以上尚未开放。", "不老魔女为魔女途径序列3，具有长寿、年轻外观与有限镜界通行能力，不保证永生、逃脱或自动复活；本场原镜、人物、有限路线与数值以当前说明为准。完整配方与晋升仪式细节尚未掌握。本页不直接授予序列2及以上能力；发现灾难魔女渠道后，可查看独立晋升准备，仍须满足其实际条件。"],
] as const;

describe('batch004 exact authored paragraph copies', () => {
  it.each(exactRendererParagraphs)('maps the complete paragraph without changing saved input: %s', (source, expected) => {
    expect(PLAYER_PARAGRAPH_COPY.filter(([key]) => key === source)).toEqual([[source, expected]]);
    expect(playerText(source)).toBe(expected); expect(playerText(expected)).toBe(expected);
    const input = { character: { name: 'G1原玩家' }, command: { type: 'KEEP', source }, random: { seed: 'G1-original', cursor: 31 },
      story: source, id: source, participant: { name: source },
      resources: { health: 76, mind: 88, spirituality: 0, cash: 7200 }, history: ['原死亡档保留，原身体与原物不改写。'] };
    const before = structuredClone(input), output = projectPlayerText(input, input.character.name);
    expect(output.story).toBe(expected); expect(output.id).toBe(source); expect(output.participant.name).toBe(source);
    expect(output.character).toBe(input.character); expect(output.command).toBe(input.command); expect(output.random).toBe(input.random);
    expect(output.resources).toBe(input.resources); expect(output.history).toBe(input.history); expect(input).toEqual(before);
  });
  it('reuses only the existing exact adult-opponent conversion for the new raw JSX wrapper', () => {
    const source = "原创成年序列5对手奥斯里克·维尔在已知普通浅壤土原边庭2米外，持自己的AA4-OSRIC-CLUB原短棍，有40点有限灵性。原普通侧门开放、无旁人、无追逐；也可以普通拒绝交手后离开。", expected = "成年序列5对手奥斯里克·维尔在已知普通浅壤土原边庭2米外，持自己的AA4-OSRIC-CLUB原短棍，有40点有限灵性。原普通侧门开放、无旁人、无追逐；也可以普通拒绝交手后离开。";
    expect(playerText(source)).toBe(expected); expect(playerText(expected)).toBe(expected);
    const input = { story: source, command: { type: 'ENCOUNTER_FIGHT' }, health: 76, mind: 88, spirituality: 0 };
    const before = structuredClone(input), output = projectPlayerText(input);
    expect(output.story).toBe(expected); expect(output.command).toBe(input.command); expect(input).toEqual(before);
  });
});
