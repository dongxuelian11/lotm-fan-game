import { describe, expect, it } from 'vitest';
import { playerText, projectPlayerText } from '../../src/shared/player-text.js';

const copies = [
  [
    "原著已核内容只确认“格斗学者”的序列名称。本页的训练分类、观察与演练规则、情境、成品渠道和数值均为游戏设定（G），不作为已核原著能力。晋升不自动加入组织。",
    "格斗学者为序列8。本页只开放当前说明列出的训练、观察与演练，情境、成品渠道和数值以当前说明为准。晋升不自动加入组织。"
  ],
  [
    "完整配方尚未核实。本阶段只使用独立成品原瓶，不提供未核材料或调配。每瓶来源、劳动与供应条件以公开记录为准。",
    "本阶段只使用独立成品原瓶，不提供完整配方、材料或调配。每瓶来源、劳动与供应条件以公开记录为准。"
  ],
  [
    "完整配方未公开，不以专业成品费用冒充原著配方或仪式。",
    "本渠道只提供独立成品，不提供完整配方；服用前仍须完成专业准备。"
  ],
  [
    "这一独立原瓶和当次准备无论成功或失败都耗尽；旧16掌握、旧死亡、原人原物、伤势与风险保留，不免费治疗或补灵。完整配方及原著仪式仍未知。",
    "这一独立原瓶和当次准备无论成功或失败都耗尽；旧16掌握、旧死亡、原人原物、伤势与风险保留，不免费治疗或补灵。完整配方尚未掌握，服用前仍须完成专业准备。"
  ]
] as const;

describe('renderer008 exact authored player copy', () => {
  it.each(copies)('retains gameplay boundaries while adapting %s', (source, expected) => {
    const input = { description: source, character: { name: '候选G玩家' }, command: { type: 'UNCHANGED', label: source }, random: { seed: source, cursor: 334 }, original: { id: source, count: 16, cost: 120, duration: 60 } };
    const bytes = JSON.stringify(input), output = projectPlayerText(input, input.character.name);
    expect(playerText(source)).toBe(expected); expect(playerText(expected)).toBe(expected);
    expect(output.description).toBe(expected); expect(output.character).toBe(input.character);
    expect(output.command).toBe(input.command); expect(output.random).toBe(input.random);
    expect(output.original).toBe(input.original); expect(JSON.stringify(input)).toBe(bytes);
  });
});
