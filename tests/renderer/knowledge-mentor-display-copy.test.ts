import { describe, expect, it } from 'vitest';
import { playerText, projectPlayerText } from '../../src/shared/player-text';
import { KNOWLEDGE_MENTOR_POWERS } from '../../src/domain/knowledge-mentor/encounter';
import { KNOWLEDGE_MENTOR_FORMULA_STATUS } from '../../src/domain/knowledge-mentor/content';
const copies = [
  [
    "成功或失败都会耗尽这一原瓶与当次准备；当前灵性不补满、原物不充能不修复，旧伤、旧园与旧人结局保留。本阶身份映射及专业支持均G，原著配方与仪式未知。",
    "成功或失败都会耗尽这一原瓶与当次准备；当前灵性不补满、原物不充能不修复，旧伤、旧园与旧人结局保留。尚未掌握完整配方，服用前须完成专业准备。"
  ],
  [
    "候选有限弧光术（G）",
    "有限弧光术"
  ],
  [
    "候选有限护术（G）",
    "有限护术"
  ],
  [
    "候选有限定向干扰（G）",
    "有限定向干扰"
  ],
  [
    "候选现场校准知识",
    "现场校准知识"
  ],
  [
    "缺少实际准备的READY原指令片、原件各1储能或本人5S，候选有限封装未施展；",
    "缺少实际准备的READY原指令片、原件各1储能或本人5S，有限封装未施展；"
  ],
  [
    "候选知识导师2映射、能力及数值全为G，原著配方仪式未知。",
    "知识导师序列2的能力范围与数值见本次记录；尚未掌握完整配方，服用前须完成专业准备。"
  ]
] as const;
describe('Knowledge Mentor exact authored display boundaries', () => {
  it('preserves the raw formula and power constants independently of display', () => {
    expect(KNOWLEDGE_MENTOR_FORMULA_STATUS).toBe("知识导师作为通识者序列2的名称与编号，本次上传原文未核实，当前职业映射为本作候选G；完整配方、晋升仪式与专属能力也未知，不能断言原著无需仪式。本阶段使用明确G专业支持、独立序列2原瓶与实际准备，不重复炼金术士抽取原园生命的旧仪式。");
    expect(KNOWLEDGE_MENTOR_POWERS).toEqual([
      { id: 'ARC_BOLT', label: '候选有限弧光术（G）', cost: 7, selfGain: 105, enemyReduction: 0 },
      { id: 'WARD', label: '候选有限护术（G）', cost: 6, selfGain: 0, enemyReduction: 60 },
      { id: 'JAM', label: '候选有限定向干扰（G）', cost: 3, selfGain: 0, enemyReduction: 0 },
    ]);
    expect(playerText(KNOWLEDGE_MENTOR_FORMULA_STATUS)).toBe("知识导师为通识者序列2。当前渠道只提供成品魔药，不提供完整配方；服用前须完成专业准备。本阶段使用明确专业支持、独立序列2原瓶与实际准备，不重复炼金术士抽取原园生命的旧仪式。");
  });
  it.each(copies)('adapts only the exact authored clause %s', (source, expected) => {
    const input = { character: { name: '候选G' }, random: { seed: 'KM2-G', cursor: 691 },
      command: { type: 'KEEP', label: source }, id: 'KM2-ROWAN-HALE',
      lastCombatRound: { moves: [{ label: source, selfGain: 105, enemyReduction: 60 }], consequence: source } };
    const before = structuredClone(input), output = projectPlayerText(input, input.character.name);
    expect(output.lastCombatRound).toEqual({ moves: [{ label: expected, selfGain: 105, enemyReduction: 60 }], consequence: expected });
    expect(output.character).toBe(input.character); expect(output.random).toBe(input.random); expect(output.command).toBe(input.command);
    expect(input).toEqual(before); expect(output.id).toBe('KM2-ROWAN-HALE');
    expect(playerText(source)).toBe(expected); expect(playerText(expected)).toBe(expected);
    const named = { character: { name: source }, label: source, command: { label: source }, random: { seed: source } };
    expect(projectPlayerText(named, source)).toEqual(named);
  });
});
