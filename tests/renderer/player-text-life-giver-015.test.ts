import { describe, expect, it } from 'vitest';
import { playerText, projectPlayerText } from '../../src/shared/player-text.js';

const copies = [
  [
    "创生者2、美神1名称已核实。完整配方、原著仪式与具体新能力未知；本页新规则均为原创G。本阶不改变性别。",
    "创生者为序列2，下一阶为美神序列1。当前渠道只提供独立成品魔药，不提供完整配方；服用前须完成专业准备。本阶能力与限制以当前说明为准，不改变性别。"
  ],
  [
    "成功或失败都会耗尽这一原瓶与当次准备。旧消化、掌握、伤势、风险及原人原物保留；不补灵、不治疗、不变性、不产生新生命。完整配方与原著仪式仍未知。",
    "成功或失败都会耗尽这一原瓶与当次准备。旧消化、掌握、伤势、风险及原人原物保留；不补灵、不治疗、不变性、不产生新生命。当前渠道不提供完整配方，服用前须完成专业准备。"
  ],
  [
    "。准备不是已核实的原著仪式。",
    "。服用前须实际完成上述专业准备。"
  ]
] as const;

describe('Life Giver exact player-facing authored copy', () => {
  it.each(copies)('preserves restrictions and raw data for %s', (source, display) => {
    const input = { character: { name: '候选G' }, command: { type: 'KEEP', label: source }, random: { seed: 'LG2-G', cursor: 444 },
      title: source, history: [source], original: { id: source, cost: 120, seconds: 15, vitalityCost: 6, shelterCost: 4, healthCost: 5 },
      wheel: [{ id: 'G1', label: source, weight: 30 }, { id: 'G6', label: '原G1五人', weight: 70 }] };
    const before = structuredClone(input), bytes = JSON.stringify(input), output = projectPlayerText(input, input.character.name);
    expect(playerText(source)).toBe(display); expect(playerText(display)).toBe(display);
    expect(output.title).toBe(display); expect(output.history).toEqual([display]);
    expect(output.wheel).toEqual([{ id: 'G1', label: display, weight: 30 }, { id: 'G6', label: '原G1五人', weight: 70 }]);
    expect(output.character).toBe(input.character); expect(output.command).toBe(input.command); expect(output.random).toBe(input.random);
    expect(output.original).toBe(input.original); expect(input).toEqual(before); expect(JSON.stringify(input)).toBe(bytes);
  });
});
