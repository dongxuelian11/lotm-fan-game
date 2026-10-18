import { PLAYER_FIXED_NAME_COPY, PLAYER_FRAGMENT_COPY, PLAYER_PARAGRAPH_COPY, PLAYER_SCAN_COPY } from './player-text-copy.js';

/**
 * Read-only player copy adapter. Keep research attribution in authored content and saves.
 * Call only for display prose, never for an identifier, command, enum or user-entered name.
 * The replacements below are known authoring labels and phrases, not general word filters.
 */
const HAS_EDITORIAL_MARKER = /G|候选|原著|原文|原创|已核|未核|待核|原核|编号推断|《诡秘之主》|第[一二三四五六七八九十]+部/;
const EXACT_PARAGRAPHS = new Map(PLAYER_PARAGRAPH_COPY);
const EXACT_AUTHORED_NAMES = new Map(PLAYER_FIXED_NAME_COPY);
const MIN_PARAGRAPH_LENGTH = Math.min(...PLAYER_PARAGRAPH_COPY.map(([source]) => source.length));

function playerParagraphText(value: string): string {
  if (!HAS_EDITORIAL_MARKER.test(value)) return value;
  const exact = EXACT_PARAGRAPHS.get(value);
  if (exact !== undefined) return exact;
  if (value.length < MIN_PARAGRAPH_LENGTH) return value;
  let text = value;
  for (const [source, display] of PLAYER_PARAGRAPH_COPY) {
    if (text.length >= source.length && text.includes(source)) text = text.split(source).join(display);
  }
  return text;
}

const PLAYER_COPY: readonly (readonly [string, string])[] = [
  ['正义导师G · 原工作院交战', '正义导师 · 原工作院交战'],
  ['漫游者G · 原工作院交战', '漫游者 · 原工作院交战'],
  // Candidate names and formula status have different player-facing meanings.
  ['既有核验未找到“洞悉者”对应阅读者序列3的直接证据；“智慧天使”仅见圣典称号，尚无阅读者序列2编号证据。两阶名称编号均保持未核实候选，', ''],
  ['原文核验未命中“洞悉者”，尚无直接证据证明该名称对应阅读者序列3；', ''],
  ['下一“智慧天使”只见圣典称号，尚无阅读者序列2编号证据，本次不开放。', '下一阶段尚未开放。'],
  ['下一“全知之眼”序列1仅保留跨链推断，本阶段不开放，也不冒称已核原著直接编号。', '下一“全知之眼”序列1尚未开放。'],
  ['名称与序列2的对应、新能力、完整配方及晋升仪式均未核实。', '当前渠道只提供成品魔药，不提供完整配方。'],
  ['名称与序列3的对应、新增能力、完整配方与晋升仪式尚未核实。', '当前渠道只提供成品魔药，不提供完整配方。'],
  ['候选名称、编号与能力尚未核实，配方和原著仪式仍未知，', '当前渠道只提供成品魔药，不提供配方；'],
  ['候选名称、能力、配方和原著仪式仍未核实，', '当前渠道只提供成品魔药，不提供配方；'],
  ['名称与序列衔接仅有人物推断，完整配方和原著晋升仪式仍未核实，', '当前渠道只提供成品魔药，不提供配方；'],
  ['厄运法师的候选序列编号、完整配方与晋升仪式细节尚未核实，不能据未知细节断言无需仪式。', '当前渠道只提供成品魔药；服用前仍须完成专业准备。'],
  ['完整配方与晋升仪式细节待核', '当前渠道只提供成品魔药，服用前须完成专业准备'],
  ['完整配方与晋升仪式资料待核', '当前渠道只提供成品魔药，服用前须完成专业准备'],
  ['完整配方和原著晋升仪式仍未核实', '当前渠道只提供成品魔药，服用前须完成专业准备'],
  ['完整配方和原著晋升仪式未披露', '当前渠道只提供成品魔药，服用前须完成专业准备'],
  ['完整配方与晋升仪式尚未核实', '当前渠道只提供成品魔药，服用前须完成专业准备'],
  ['完整配方资料待核', '当前渠道只提供成品魔药，不提供完整配方'],
  ['完整配方尚未核实', '当前渠道只提供成品魔药，不提供完整配方'],
  ['完整配方仍未核实', '当前渠道只提供成品魔药，不提供完整配方'],
  ['完整配方仍待核实', '当前渠道只提供成品魔药，不提供完整配方'],
  ['完整魔药配方仍待核实', '当前渠道只提供成品魔药，不提供完整配方'],
  ['完整配方待核', '当前渠道只提供成品魔药，不提供完整配方'],
  ['配方和原著仪式仍未知', '尚未掌握配方，服用前须完成专业准备'],
  ['配方与原著仪式仍未知', '尚未掌握配方，服用前须完成专业准备'],
  ['这是明确的G专业准备流程，不冒充已还原原著仪式，也不解锁', '专业准备不提供'],
  ['这是明确的G准备流程，不冒充已还原原著仪式，也不解锁', '专业准备不提供'],
  ['这是明确的G专业准备流程，不冒充原著完整仪式，也不解锁', '专业准备不提供'],
  ['原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式', '仍须完成此渠道要求的服药准备'],
  ['原著仪式细节仍未知，不把这些准备冒充已还原原著仪式', '仍须完成此渠道要求的服药准备'],
  ['完整原著步骤未知，此准备不冒称原著全仪式', '仍须完成此渠道要求的服药准备'],
  ['本作专业准备方案G不声称已经还原原著仪式，也不声称无需仪式', '服用前须完成本渠道的专业准备'],
  ['未声称掌握完整配方或还原晋升仪式', '不提供完整配方，服用前仍须准备'],
  ['未声称掌握完整配方', '不提供完整配方'],
  ['未声称现场配制', '不提供现场调配'],
  ['不冒充原著仪式，', ''],
  ['不冒充原著完整仪式，', ''],
  ['具体操作次序采用本作G导师规程，不把该次序称作原著事实', '具体操作次序按导师规程执行'],
  ['本次使用导师的本作G操作规程，不冒称原著投料次序', '本次按导师的操作规程调配'],
  ['逐项投料顺序未获原著核定，本次按导师的本作G批次操作规程调配', '本次按导师的批次操作规程逐项投料'],
  ['完整六项配方有原著依据，', '已掌握完整六项配方，'],
  ['原著未给明确数量或重量', '具体数量或重量未记载'],
  ['原著未给明确用量', '具体用量未记载'],
  ['原著未给明确重量', '具体重量未记载'],
  ['原文未另列数量', '未另列数量'],
  // Preserve the safety condition while removing the research comparison.
  ['不是原著保证的无代价安全消化法', '不保证无代价安全消化'],
  ['不是原著保证的无风险消化法或诅咒解药', '不保证无风险消化，也不能解除诅咒'],
  ['不是无风险消化的原著保证', '不保证无风险消化'],
  ['不保证原著无风险消化', '不保证无风险消化'],
  ['不保证原著安全消化', '不保证安全消化'],
  ['不保证原著安全晋升', '不保证安全晋升'],
  ['尚未核实为原著序列4新增职业能力。', ''],
  ['不是已核实的原著序列3技能。', ''],
  // Known authoring-only introductions. The text after the colon is retained verbatim.
  ['以下准备、时间、代价与判定均为原创G：', '准备与风险：'],
  ['以下时间、代价与判定均为原创G：', '服药条件与风险：'],
  ['以下全部具体规则为本作G：', '服药条件与风险：'],
  ['以下具体规则均为本作G：', '服药条件与风险：'],
  ['以下数值均为原创G：', '条件与费用：'],
  ['以下数值为原创G：', '条件与费用：'],
  ['以下现场、流程与数值均为原创G：', '流程与费用：'],
  ['以下现场与全部成本是原创G：', '流程与费用：'],
  ['以下人物、原物、场地、距离、检定与费用为原创G：', '流程与费用：'],
  ['渠道与供给均为本作原创G，', ''],
  ['该成品药供给为本作原创G。', ''],
  ['金额、行动、成熟周数与判定数值均为本作原创G平衡设定。', ''],
  ['金额、行动、成熟周数与判定数值均为本作G平衡设定。', ''],
  ['全部事件和数值为原创G。', ''],
  ['场景与数值为原创G。', ''],
  ['这些数值为本作原创G。', ''],
  ['名称有原著依据，', ''],
  ['是本作G环境边界，不是原著施法必需绳子', '是当前场地限制'],
  ['是本作环境边界，不是原著施法必需绳子', '是当前场地限制'],
  // Final exact residuals from the same 22 saved-route display scan.
  ['受控G', '受控'], ['本场G', '本场'], ['G成功偷取', '成功偷取'],
  ['G欲望聚焦', '欲望聚焦'], ['G木牌实践', '木牌实践'], ['G灵性材料', '灵性材料'],
  ['G差异承受', '差异承受'], ['明确G固定对照', '明确固定对照'],
  ['G强化练习', '强化练习'], ['G练习', '练习'], ['G小闪', '小闪'],
  ['G定量', '定量'], ['G布置', '布置'], ['独立G制卷', '独立制卷'],
  ['有限作用G', '有限作用'], ['与定量G', '与定量'], ['一轮各一次G', '一轮各一次'],
  ['精神压迫G示范', '精神压迫示范'],
  // Do not remove plain “候选”, “原创”, “未知”, “原文” or “未核验”.
  ['G候选映射', ''], ['名称编号待核G', ''], ['未原著核实的G候选', ''],
  ['G候选', ''], ['候选G', ''], ['G扩展', ''], ['编号推断', ''],
  ['候选晋升', '晋升'], ['候选准备', '准备'], ['独立候选成品', '独立成品'],
  ['候选成品', '成品'], ['候选原瓶', '原瓶'],
  ['明确标记为游戏设定（G）的', ''], ['游戏设定（G）的', ''],
  ['游戏设定（G）', ''], ['游戏数值（G）', ''],
  ['本作原创G的', ''], ['本作原创G', ''], ['本作G原创', ''],
  ['本作玩法改编G', ''], ['本作玩法G', ''], ['原创G：', ''],
  ['本作G：', ''], ['本作G', ''], ['原创G', ''],
  ['原创有限G', '有限'], ['虚构G', ''], ['有限G', '有限'],
  ['G专业', '专业'], ['G支持', '支持'], ['G指导', '指导'], ['G监督', '监督'],
  ['G服药', '服药'], ['G准备', '准备'], ['G教学', '教学'], ['G独立', '独立'],
  ['G扮演', '扮演'], ['G玩法', '玩法'], ['G替代', '替代'], ['G场景', '场景'],
  ['G月相', '月相'], ['G计量', '计量'], ['G综合', '综合'], ['G仪式', '仪式'],
  ['G现场', '现场'], ['G规则', '规则'], ['G伦理', '伦理'], ['G初始', '初始'],
  ['明确标为原创G的', ''], ['G低强', '低强'], ['G处置', '处置'], ['G封闭', '封闭'],
  ['G设施', '设施'], ['现金G同额', '现金同额'], ['故去G', '故去'], ['原著主材三选一：', '主材三选一：'],
  ['G单位', '单位'], ['G基线', '基线'], ['G容量', '容量'], ['G数值', '数值'],
  ['G和平', '和平'], ['G延伸', '延伸'], ['本作原创成年', '成年'],
  ['独立原创成年', '独立成年'], ['原创成年', '成年'],
  ['原著边界：', '能力范围：'], ['能力边界依据原著', '能力范围'],
  ['候选封装', '封装'], ['本作推断候选呓语者', '呓语者'],
  ['有限低语G', '有限低语'], ['人物推断／', ''],
  ['候选名称与序列映射为推断。', ''],
  ['不宣称已核实超凡体魄', '不附加超凡体魄强化'],
  ['不是原著的无代价安全保证', '不保证无代价安全'],
  ['不是原著无代价安全保证', '不保证无代价安全'],
  ['不是原著的无代价安全消化保证', '不保证无代价安全消化'],
  ['或原著仪式', '或晋升准备'],
  ['六项材料已核', '已掌握六项材料'],
  ['确切投料顺序未核定', '具体投料顺序未记载'],
  ['已核原著未给明确用量', '具体用量未记载'],
  ['原著取全部血液，未给毫升或重量', '使用全部血液，未另列毫升或重量'],
  ['保留原著指头大小的形制', '保持指头大小的形制'],
  ['原著另可用另一奇迹师非凡特性替代主材', '也可用另一奇迹师非凡特性替代主材'],
  ['原著未给克数', '未另列克数'],
  ['不虚构原著未给出的重量', '不另列未记载的重量'],
  ['原著可见辅料清单末有省略号；本作不声称已知完整细项。', '辅料细项尚未全部掌握，本次使用专业封装支持包。'],
];

const SEQUENCE_NAMES = '厄运法师|混乱行者|呓语者|洞悉者|智慧天使|隐秘之仆|知识导师';
const CANDIDATE_BEFORE_NAME = new RegExp(`候选(?=${SEQUENCE_NAMES})`, 'g');
const CANDIDATE_AFTER_NAME = new RegExp(`((?:${SEQUENCE_NAMES})(?:·(?:阅读者|深渊|黑夜|通识者|命运之轮))?(?:序列[234])?)候选`, 'g');

/** Pure, deterministic prose conversion; numeric values, costs and warning clauses stay. */
export function playerText(value: string): string {
  if (!HAS_EDITORIAL_MARKER.test(value)) return value;
  let text = playerParagraphText(value);
  for (const [before, after] of PLAYER_FRAGMENT_COPY) {
    if (text.length >= before.length && text.includes(before)) text = text.split(before).join(after);
  }
  // These exact authoring suffixes carry no mechanical information. Keep their subjects.
  text = text
    .replace(/(?:均为|全为|同为|均是|全部为|为|是)(?:本作(?:原创|玩法改编)?|原创)?G(?=[。；，])/g, '以当前说明为准')
    .replace(/(?:均为|为)G支持流程/g, '属于服药准备')
    .replace(/属于游戏设定[（(]G[）)]/g, '以当前说明为准')
    .replace(/ · 游戏数值[（(]G[）)]/g, '')
    .replace(/均以当前说明为准支持流程/g, '属于服药准备');
  for (const [before, after] of PLAYER_COPY) text = text.split(before).join(after);
  text = text
    .replace(CANDIDATE_BEFORE_NAME, '')
    .replace(CANDIDATE_AFTER_NAME, '$1')
    .replace(/候选序列([234])/g, '序列$1')
    .replace(/([（(])(?:均)?G([）)])/g, '')
    .replace(/([（(])G[，；、]/g, '$1')
    .replace(/[，；、]G(?=[）)；，、])/g, '')
    .replace(/([（(])(?:G|均为G|全部为G|均G)(?=[）)])/g, '$1')
    // G after displayed arithmetic or units is a tag. Do not match part of an ASCII ID.
    .replace(/(?<![A-Za-z0-9_.-])([−+]?\d+(?:\.\d+)?)G(?=$|[\s，；。、：）)/××%\u3400-\u9fff])/g, '$1')
    .replace(/(身体|掌握|秒|米|天|岁|便士|单位|普通打击|专业准备|身体成长|有限风水|有限往返|有限离世往返|合作与核实)G(?=$|[\s，；。、：）)/\u3400-\u9fff])/g, '$1')
    .replace(/[（(]\s*[）)]/g, '')
    .replace(/([（(])[，；、]\s*/g, '$1')
    .replace(/[，；、]([）)])/g, '$1');
  return playerScanText(text);
}

/** Known authoring-only G prefixes/suffixes observed in the 22-route exposure report. */
function playerScanText(value: string): string {
  let text = value;
  for (const [source, display] of PLAYER_SCAN_COPY) {
    if (text.length >= source.length && text.includes(source)) text = text.split(source).join(display);
  }
  text = text
    .replace(/(^|[\s：:（(，；。])G\s*·\s*/g, '$1')
    .replace(/(?:均|全|全部)(?:为)?(?:明确)?G(?=[，；。：）)]|$)/g, '以当前说明为准')
    .replace(/(?:为|是|属于)G(?=[，；。：）)]|$)/g, '以当前说明为准')
    .replace(/(?:均|全|全部)?(?:为|是)?明确G(?=[，；。：）)]|$)/g, '以当前说明为准')
    .replace(/明确标G的/g, '')
    .replace(/玩法G/g, '')
    .replace(/G原创/g, '')
    .replace(/(?<![A-Za-z0-9_.-])G(?=有限|低阶|用药|基准|成本|身体|衣物|静步|去味|短时|能力|帮助|血肉|范围|十秒|修正|程序|既存|供货|处理|照护|重审|训练|回合|时点|轻伤|轻微|涂层|负载|判定|实践|实战|对照|禁令|联系|窗口|模板|知识|精神|约束|原封|健康|实施|防护|秒数|掌握|继承|虚构|降温|效果|渠道|服务|动作为|动作与|动作|方法|预期|压力|六角|原双筹|冲力|栽培|歌声|状态|自身|修正|边界|确定|检查|名称|材料|迟钟|偏差|未发|工坊|保护封签|情境|原可|只在|只实践|只开放|只接纳|改编|事件|沿用|实际|结果|往返|行为|降低|可玩|分担|隔绝|静封|上限)/g, '')
    .replace(/(护术|暗矢|休养|游戏时间|外放|预兆|通行|祝福|原场景|规则欺瞒|原物欺瞒|引导|海域|等效|分担|路线|风暴|原灵协作|注意偏移|刻录系数|掌握系数|身体攻势|普通攻击|真实收束|轻微余留|消化|原瓶|预付|方案|六小时|小时|秒|托管|怨魂|赢家|新遭遇|关卡|释与核验)G(?=$|[\s，；。、：）)]|实际)/g, '$1')
    .replace(/G(?=\d+(?:\.\d+)?(?:米|×|\/底))/g, '')
    .replace(/(\d+(?:\.\d+)?%)G(?=$|[\s，；。、：）)])/g, '$1')
    .replace(/([（(])G[，；、]/g, '$1')
    .replace(/[，；、]G([）)])/g, '$1')
    .replace(/[（(]G[）)]/g, '')
    .replace(/([，；])(?:，|；)+/g, '$1')
    .replace(/[，；]。/g, '。');
  return text;
}

/** Explicit display slots from the public projection interfaces; no name/ID/enum blanket. */
const DISPLAY_TEXT_KEYS = new Set([
  'title', 'label', 'description', 'text', 'body', 'story', 'summary', 'source', 'unit',
  'cost', 'status', 'reason', 'disabledReason', 'actionBlockedReason', 'blockedReason',
  'risk', 'digestion', 'supplies', 'environment', 'preparation', 'result',
  'nextStep', 'preview', 'boundary', 'note', 'message', 'consequence', 'detail',
  'materials', 'ordinaryLife', 'qualification', 'formulaAlternatives', 'guidance', 'explanation', 'warning', 'irreversibleWarning', 'changeWarning',
  'bodyChange', 'interpretation', 'conclusion', 'finding', 'reportText',
  'stockSummary', 'bloodSummary', 'mentalDefence', 'publicWarning',
  'workers', 'accountability', 'hazard', 'relationship', 'inheritedTools',
  'lifeAnchor', 'verification', 'economy', 'rule', 'scope', 'venue', 'host', 'trait', 'moth', 'tools', 'program', 'report', 'outcome',
]);
const DISPLAY_TEXT_ARRAY_KEYS = new Set([
  'observations', 'facts', 'inheritedHistory', 'history', 'notes', 'labels',
  'consequences', 'formulaAlternatives', 'details', 'people', 'objects', 'stepHistory', 'records', 'counters',
]);
const UNTOUCHED_SUBTREES = new Set(['character', 'command', 'intent', 'random', 'progression', 'date']);

/**
 * Call once on the already-constructed SliceProjection, never on persisted SliceState.
 * Structural sharing keeps all untouched values/commands and arrays in original order.
 * An explicitly supplied player name is protected even when interpolated into log prose.
 */
export function projectPlayerText<T extends object>(projection: T, playerName = ''): T {
  const copy = (text: string): string => {
    // Protect the original name before either exact paragraphs or fragments can rewrite it.
    const adapt = (part: string) => playerText(playerParagraphText(part));
    return playerName ? text.split(playerName).map(adapt).join(playerName) : adapt(text);
  };
  const visit = (value: unknown, key: string): unknown => {
    if (UNTOUCHED_SUBTREES.has(key)) return value;
    if (typeof value === 'string') {
      if (key === 'name') return value === playerName ? value : EXACT_AUTHORED_NAMES.get(value) ?? value;
      return DISPLAY_TEXT_KEYS.has(key) ? copy(value) : value;
    }
    if (Array.isArray(value)) {
      const next = value.map(item => typeof item === 'string'
        ? DISPLAY_TEXT_ARRAY_KEYS.has(key) ? copy(item) : item
        : visit(item, key === 'formula' ? 'formulaItem' : ''));
      return next.some((item, index) => item !== value[index]) ? next : value;
    }
    if (value === null || typeof value !== 'object') return value;
    const record = value as Record<string, unknown>;
    let next: Record<string, unknown> | undefined;
    for (const field of Object.keys(record)) {
      const item = key === 'formulaItem' && field === 'name' && record[field] === '未核余项的专业封装支持G'
        ? '专业封装支持包'
        : visit(record[field], field);
      if (item !== record[field]) (next ??= { ...record })[field] = item;
    }
    return next ?? value;
  };
  return visit(projection, '') as T;
}
