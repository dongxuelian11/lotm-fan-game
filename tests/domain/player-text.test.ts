import { describe, expect, it } from 'vitest';
import { playerText, projectPlayerText } from '../../src/shared/player-text.js';

describe('read-only player display copy', () => {
  it.each([
    ['被动幸运（G）', '被动幸运'],
    ['正义导师G · 原工作院交战', '正义导师 · 原工作院交战'],
    ['精神75 / 100 · 游戏数值（G）', '精神75 / 100'],
    ['条件综合（G候选）', '条件综合'],
    ['智慧天使·阅读者序列2候选（G扩展）', '智慧天使·阅读者序列2'],
    ['候选厄运法师扮演从0开始', '厄运法师扮演从0开始'],
    ['隐秘之仆（名称编号待核G） · 序列2', '隐秘之仆 · 序列2'],
    ['临时庇护（G，可停止），花费4灵性', '临时庇护（可停止），花费4灵性'],
    ['护持（2S/减26G，须原架实际赋灵）', '护持（2S/减26，须原架实际赋灵）'],
    ['固定−22.5G；失败也付4灵性，原瓶不可恢复。', '固定−22.5；失败也付4灵性，原瓶不可恢复。'],
    ['完整配方尚未核实。原瓶取得与确认服用是两个步骤。', '当前渠道只提供成品魔药，不提供完整配方。原瓶取得与确认服用是两个步骤。'],
    ['和平100不保证原著安全消化，不清除旧伤。', '和平100不保证安全消化，不清除旧伤。'],
  ])('adapts the known display phrase %s', (source, expected) => {
    expect(playerText(source)).toBe(expected);
    expect(playerText(expected)).toBe(expected);
  });

  it('does not erase ordinary narrative uncertainty or arithmetic/IDs', () => {
    const text = '候选嫌疑人尚未知，原文书室仍关闭；原创手稿未核验，不能继续。ITEM12G/SG6-GRAY-FEATHER、60便士、20秒、0.5×掌握。';
    expect(playerText(text)).toBe(text);
  });

  it('adapts display fields without rewriting stored records or commands', () => {
    const command = Object.freeze({ type: 'CONSUME', bottleId: 'wisdom-angel-potion-1', confirmed: true });
    const character = Object.freeze({ name: '候选G', appearanceDescription: '原创G', traits: [{ id: 'trait-G', label: 'G候选' }] });
    const random = Object.freeze({ seed: 'seed-G候选', cursor: 321 });
    const privateRecord = Object.freeze({ id: 'record-G候选', week: 12, title: '智慧天使候选', text: '候选G听完了G专业指导；失败也耗原瓶。' });
    const input = Object.freeze({
      character, random, runId: 'run-G候选', status: 'ACTIVE', progression: { pathwayId: 'white-tower', sequence: 2, mastery: { 'reader.s2.conditional-synthesis': 8 } },
      wisdomAngel: { title: '智慧天使候选', formulaKnown: false, formula: [],
        actions: [{ id: 'action-G候选', label: '候选晋升', cost: '0行动 · 6200便士', command }],
        risk: 'G支持仅将药物排异后的健康与精神保底到1，不保护普通死亡或战斗。',
        observations: ['减势45G，失配时无效'], inheritedHistory: ['条件综合（G候选）'],
        bottles: [{ id: 'wisdom-angel-potion-1', name: '候选G', status: '原瓶已耗尽 · 排异，仍为洞悉者候选', source: '本作原创G渠道只交付独立成品原瓶', command }],
      },
      chronicle: [privateRecord], lastCombatRound: { stance: 'DEFEND', playerCountRoll: 34, moves: [{ actor: 'PLAYER', label: '原身体打击（G）', selfGain: 12, enemyReduction: 0 }], consequence: '永久死亡，不复活（G）' },
    });
    const before = JSON.stringify(input);
    const output = projectPlayerText(input, character.name);
    expect(JSON.stringify(input)).toBe(before);
    expect(privateRecord.text).toContain('G专业指导');
    expect(output.chronicle[0].text).toBe('候选G听完了专业指导；失败也耗原瓶。');
    expect(output.wisdomAngel.title).toBe('智慧天使');
    expect(output.wisdomAngel.bottles[0].status).toBe('原瓶已耗尽 · 排异，仍为洞悉者');
    expect(output.wisdomAngel.bottles[0].name).toBe('候选G');
    expect(output.wisdomAngel.actions[0].command).toBe(command);
    expect(output.character).toBe(character);
    expect(output.random).toBe(random);
    expect(output.runId).toBe(input.runId);
    expect(output.progression).toBe(input.progression);
    expect(output.wisdomAngel.actions[0].cost).toBe(input.wisdomAngel.actions[0].cost);
    expect(output.wisdomAngel.formulaKnown).toBe(false);
    expect(output.wisdomAngel.formula).toBe(input.wisdomAngel.formula);
    expect(output.wisdomAngel.risk).toBe('支持仅将药物排异后的健康与精神保底到1，不保护普通死亡或战斗。');
    expect(output.lastCombatRound.moves[0]).toEqual({ actor: 'PLAYER', label: '原身体打击', selfGain: 12, enemyReduction: 0 });
    expect(output.lastCombatRound.consequence).toBe('永久死亡，不复活');
    expect(output.lastCombatRound.playerCountRoll).toBe(34);
  });
});

// Exact source/ritual prose is adapted even when embedded in a historical log.
import { PLAYER_PARAGRAPH_COPY } from '../../src/shared/player-text-copy.js';
describe('historical research paragraph copy', () => {
  it('keeps the lethal ritual requirements and irreversible outcomes', () => {
    const entry = PLAYER_PARAGRAPH_COPY.find(([source]) => source.startsWith('原著晋升仪式：'))!;
    expect(entry).toBeDefined();
    const value = playerText('第30周付费准备。' + entry[0] + '本次仍花费120便士。');
    for (const warning of ['谋杀一名真实半神', '真实受伤和死亡风险', '原死者不复活', '36名成人', '120便士']) expect(value).toContain(warning);
    expect(value).not.toMatch(/原著|原创G|本作G/);
    expect(entry[0]).toContain('原著晋升仪式');
  });
  it('preserves the formula lock and the required real preparation', () => {
    const entry = PLAYER_PARAGRAPH_COPY.find(([source]) => source.startsWith('智慧天使·阅读者序列2候选'))!;
    const value = playerText(entry[0]);
    expect(value).toContain('当前渠道只提供成品魔药');
    expect(value).toContain('服用前须完成专业准备');
    expect(value).toContain('不复用已耗尽的预言家仪式包');
    expect(value).not.toMatch(/候选|原著|未核|本作G/);
  });
});

describe('explicit public display slots', () => {
  it('cleans formula alternatives, ritual people and counted objects while keeping quantities', () => {
    const raw = { formulaAlternatives: '原著主材三选一：原材料，不可购买另两项。', qualification: '重新核对、付款和14天G隔绝才可再试。', people: ['艾琳32岁G；同一原人'], objects: ['实际接水20G份；冷却10秒G'], ordinaryLife: '本机构G处置休养', materials: 'G低强教学灵性材料4份；失败不退料。', formula: [{ name: '未核余项的专业封装支持G', quantity: 1, unit: '原封包' }], participant: { name: '候选G' } };
    const out = projectPlayerText(raw);
    expect(out.formulaAlternatives).toBe('主材三选一：原材料，不可购买另两项。');
    expect(out.qualification).toContain('付款和14天隔绝');
    expect(out.people).toEqual(['艾琳32岁；同一原人']);
    expect(out.objects).toEqual(['实际接水20份；冷却10秒']);
    expect(out.ordinaryLife).toBe('本机构处置休养');
    expect(out.materials).toBe('低强教学灵性材料4份；失败不退料。');
    expect(out.formula[0]).toEqual({ name: '专业封装支持包', quantity: 1, unit: '原封包' });
    expect(out.participant.name).toBe('候选G');
  });
});

describe('observed 22-route player copy residuals', () => {
  it('removes explicit G labels without touching costs or temporary-effect warnings', () => {
    expect(playerText('G · 风暴演练')).toBe('风暴演练');
    expect(playerText('10秒G；50%G；失败仍扣7灵性，原瓶不退。')).toBe('10秒；50%；失败仍扣7灵性，原瓶不退。');
    expect(playerText('掌握系数G，全部明确G。')).toBe('掌握系数，以当前说明为准。');
  });

  it('keeps current potion provenance, actual preparation and current ability limits', () => {
    const source = '第42周交付catastrophe-potion-1。天灾2名称编号已核实，完整配方、原著晋升仪式与新权能精确边界仍未知，专业准备另行实际完成。失败不退6200便士，原瓶耗尽。';
    const output = playerText(source);
    expect(output).toContain('第42周交付catastrophe-potion-1。');
    expect(output).toContain('专业准备须另行完成');
    expect(output).toContain('失败不退6200便士，原瓶耗尽。');
    expect(output).not.toMatch(/原著|已核|未知/);
    const ability = playerText('第一部第65章支持有限水系法术，本作在现场实际存在且获准使用的水源上表现有限水流控制；实际20份水，花费7灵性，冷却10秒。');
    expect(ability).toContain('现场实际存在且获准使用的水源');
    expect(ability).toContain('实际20份水，花费7灵性，冷却10秒。');
    expect(ability).not.toContain('第65章');
  });

  it('retains real moon notices, required sacrifice and danger', () => {
    expect(playerText('木偶4的具体原著满月诅咒尚未核明；两个事件持续六小时，不回血。')).toContain('月相事件按当前告示处理；两个事件持续六小时，不回血。');
    const text = playerText('六种亲猎遗骸、复杂祭坛和祝福为已核核心；失败不可退回原瓶，原死者不复活。');
    for (const warning of ['本人亲猎六种强大生物', '复杂祭坛', '祝福', '失败不可退回原瓶', '原死者不复活']) expect(text).toContain(warning);
  });

  it('adapts only listed fixed NPC names and new explicit display slots', () => {
    const input = {
      character: { name: '候选G', appearanceDescription: 'G原创' },
      participant: { name: '候选G' }, cohortId: 'G1',
      encounter: { name: '鲁克·文恩（原创后世成人，41岁，G）' },
      clue: { name: '未核实原石拱目击', text: '梦中说法是待核线索；候选嫌疑人尚未确认。' },
      lifeAnchor: 'G有限支持，失败不复活',
      stepHistory: ['G · 实际耗材20份'], records: ['G · 已用6灵性'], counters: ['G · 暗矢2次'],
    };
    const before = JSON.stringify(input);
    const output = projectPlayerText(input, input.character.name);
    expect(output.encounter.name).toBe('鲁克·文恩（后世成人，41岁）');
    expect(output.participant.name).toBe('候选G');
    expect(output.cohortId).toBe('G1');
    expect(output.character).toBe(input.character);
    expect(output.clue).toBe(input.clue);
    expect(output.lifeAnchor).toBe('有限支持，失败不复活');
    expect(output.stepHistory).toEqual(['实际耗材20份']);
    expect(output.records).toEqual(['已用6灵性']);
    expect(output.counters).toEqual(['暗矢2次']);
    expect(JSON.stringify(input)).toBe(before);
  });
});


it('cleans the final saved-label residuals without altering cohort codes or numeric costs', () => {
  expect(playerText('G6米听距；G38.025×借用掌握；原生物G1100/底110；原G1五人；G灵性材料1；一轮各一次G')).toBe('6米听距；38.025×借用掌握；原生物1100/底110；原G1五人；灵性材料1；一轮各一次');
  expect(playerText('受控G撤回条件；本场G开门；精神压迫G示范；有限作用G')).toBe('受控撤回条件；本场开门；精神压迫示范；有限作用');
});


const currentCombatLabelCopies = [
  ["消耗最早合格自持原微光片（0S，减18×制作固定效力G）", "消耗最早合格自持原微光片（0S，减18×制作固定效力）"],
  ["实际耗用最早原微光片（R；0S，减18×制作固定效力G）", "实际耗用最早原微光片（R；0S，减18×制作固定效力）"],
  [
    "候选有限工序封装（每轮一次，原指令片+5S+原件各1储能/知识18，G）",
    "有限工序封装（每轮一次，原指令片+5S+原件各1储能/知识18）"
  ],
  [
    "候选现场有限校准（每轮一次，4S+1M/知识18，下一次成功原件效果+18G）",
    "现场有限校准（每轮一次，4S+1M/知识18，下一次成功原件效果+18）"
  ],
  [
    "有限结构解析（4S/知识18，下一次普通打击窗口G）",
    "有限结构解析（4S/知识18，下一次普通打击窗口）"
  ],
  [
    "有限活力（每轮一次，6S＋实付原珠/知识18，只恢复原来客至多12已失精力G）",
    "有限活力（每轮一次，6S＋实付原珠/知识18，只恢复原来客至多12已失精力）"
  ],
  [
    "当场许可的原来客召入（6S/知识18＋同体过门6精力G）",
    "当场许可的原来客召入（6S/知识18＋同体过门6精力）"
  ],
  [
    "有许可的有限召唤（B；6S/知识18＋同体过门6精力G）",
    "有许可的有限召唤（B；6S/知识18＋同体过门6精力）"
  ]
] as const;
describe('exact current combat label display boundaries', () => {
  it.each(currentCombatLabelCopies)('preserves all costs and limits while adapting %s', (source, expected) => {
    const input = { character: { name: '候选G' }, random: { seed: 'G-COMBAT', cursor: 31 },
      enemyAbilityWheel: [{ id: 'ABILITY-G-ID', weight: 35, label: source }],
      lastCombatRound: { moves: [{ label: source, selfGain: 105, enemyReduction: 60 }], consequence: '健康−5，来客精力−3；普通死亡不撤销。' } };
    const bytes = JSON.stringify(input), output = projectPlayerText(input, input.character.name);
    expect(output.enemyAbilityWheel).toEqual([{ id: 'ABILITY-G-ID', weight: 35, label: expected }]);
    expect(output.lastCombatRound).toEqual({ moves: [{ label: expected, selfGain: 105, enemyReduction: 60 }], consequence: input.lastCombatRound.consequence });
    expect(output.character).toBe(input.character); expect(output.random).toBe(input.random);
    expect(JSON.stringify(input)).toBe(bytes); expect(playerText(source)).toBe(expected); expect(playerText(expected)).toBe(expected);
  });
  it.each(currentCombatLabelCopies)('does not rewrite an exact custom player name matching %s', (name) => {
    const input = { character: { name }, participant: { name }, story: `${name}保留原身份。`,
      enemyAbilityWheel: [{ id: name, weight: 35, label: name }], random: { seed: name, cursor: 31 }, command: { type: 'KEEP', label: name } };
    const bytes = JSON.stringify(input), output = projectPlayerText(input, name);
    expect(output).toEqual(input); expect(output.character).toBe(input.character); expect(output.random).toBe(input.random); expect(output.command).toBe(input.command);
    expect(JSON.stringify(input)).toBe(bytes);
  });
});


describe('exact material-label projection preserves the real-item consequence fields', () => {
  it.each(currentCombatLabelCopies.slice(0,2))('keeps original-item expenditure and manufacture power for %s', (source, expected) => {
    const craft={id:'MM5-FLASH-3',sourceKitId:'MM5-KIT-3',power:0.65,status:'CONSUMED',usedWeek:93};
    const input={playerAbilityWheel:[{id:'reader.s5.material-imitation',weight:15,label:source}],
      crafts:[craft],lastCombatRound:{moves:[{label:source,paidCost:0,enemyReduction:18*craft.power,consumedCraftId:craft.id}]},
      spirituality:120,random:{seed:'original-material-G',cursor:31}};
    const bytes=JSON.stringify(input),output=projectPlayerText(input);
    expect(output.playerAbilityWheel).toEqual([{id:'reader.s5.material-imitation',weight:15,label:expected}]);
    expect(output.lastCombatRound.moves).toEqual([{label:expected,paidCost:0,enemyReduction:18*0.65,consumedCraftId:'MM5-FLASH-3'}]);
    expect(output.crafts).toBe(input.crafts);expect(output.spirituality).toBe(120);expect(output.random).toBe(input.random);expect(JSON.stringify(input)).toBe(bytes);
  });
});


describe('player names are protected before exact paragraph conversion', () => {
  it.each(['消耗最早合格自持原微光片（0S，减18×制作固定效力G）', 'G'])('protects the original %s in a paragraph-matching label and immutable receipt', (name) => {
    const label = '消耗最早合格自持原微光片（0S，减18×制作固定效力G）';
    const paragraph = '本阶段具体能力与成品药渠道属于游戏设定（G），原著细节与完整配方待核。取得渠道或晋升不会自动加入教会。';
    const paragraphDisplay = '本阶段具体能力与成品药渠道以当前说明为准，当前渠道只提供成品魔药，不提供完整配方。取得渠道或晋升不会自动加入教会。';
    const receipt = Object.freeze({ id: 'RECEIPT-G-31', text: `${label}保留原身份。` });
    const input = { character: { name }, participant: { name }, chronicle: [receipt],
      enemyAbilityWheel: [{ id: 'MATERIAL-G-ID', weight: 15, label }],
      command: { type: 'KEEP', label }, random: { seed: 'original-G-seed', cursor: 31 } };
    const bytes = JSON.stringify(input), output = projectPlayerText(input, name);
    expect(output).toEqual(input);
    expect(output.character).toBe(input.character); expect(output.command).toBe(input.command); expect(output.random).toBe(input.random);
    expect(output.chronicle[0]).toBe(receipt); expect(receipt.text).toBe(`${label}保留原身份。`);
    expect(JSON.stringify(input)).toBe(bytes);
    if (name === label) {
      const mixed = { story: `${name}保留原身份。${paragraph}本次仍花费120便士；原瓶不退。${name}仍在场。` };
      const mixedBytes = JSON.stringify(mixed);
      expect(projectPlayerText(mixed, name).story).toBe(`${name}保留原身份。${paragraphDisplay}本次仍花费120便士；原瓶不退。${name}仍在场。`);
      expect(JSON.stringify(mixed)).toBe(mixedBytes);
    }
  });

  it.each(PLAYER_PARAGRAPH_COPY.map(([source, display], index) => [index, source, display] as const))(
    'keeps exact paragraph %i conversion when it does not overlap the player name', (_index, source, display) => {
      const name = '⟦用户自定义姓名G-KEEP⟧';
      expect(source).not.toContain(name);
      const input = { character: { name }, story: source };
      const bytes = JSON.stringify(input), output = projectPlayerText(input, name);
      expect(output.story).toBe(playerText(display));
      expect(output.character).toBe(input.character); expect(JSON.stringify(input)).toBe(bytes);
    },
  );
});
