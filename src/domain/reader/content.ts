import type { ReaderAbilityId } from './types.js';
export { READER_CASE_IDS } from './types.js';

/** This slice adapts the approved White Tower design, not independently certified S9
 * novel passages. Mentor, finite case files, supply, jobs, prices and all numbers are G.
 * Memory is not understanding or source verification. No closed-document access,
 * S6 ability imitation, omniscience, or automatically completed ritual is granted. */
export const READER_GUIDE = '旧私人借阅馆导师塞缪尔·维克';
export const READER_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const READER_BOTTLE_IDS = ['reader-potion-1', 'reader-potion-2', 'reader-potion-3'] as const;
export const READER_SOURCE_STATUS = '阅读者的记忆、理解、学习与仪式步骤玩法沿用已确认的白塔设计，属于本作玩法改编G；现有小说核验未独立证实本阶段序列9的具体描述，不冒称原著已核。';
export const READER_POTION_SOURCES = READER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${READER_GUIDE}私下保管的第${index + 1}瓶阅读者成品魔药，原瓶独立封存；导师与私人借阅馆的独立供给为本作原创G，未声称现场配制。取得此瓶不建立知识与智慧教会或其它组织身份。`,
}));
export const READER_FORMULA_STATUS = '阅读者完整配方尚未在现有原著核验中找到；目前未开放配方学习与制造，只能取得导师现有的独立成品原瓶，不编造配方材料。';
export const READER_ABILITIES: { id: ReaderAbilityId; label: string; description: string }[] = [
  { id: 'reader.s9.memory', label: '文本记忆', description: '依已确认玩法G，记住亲自读过的可访问文本及其来源，整理有限案卷的措辞与缺页。记住不等于理解，不自动判断真伪，不能读取封闭文档、补出缺页或获得全知。' },
  { id: 'reader.s9.understanding', label: '阅读理解与学习', description: '依已确认玩法G，比较实际读到的记录、术语和条件，辨别已知内容与仍待核实的解释。阅读必须有可访问文档；知识属性不能生成秘密、唯一真相或序列6的能力模仿。当前只开放有限案卷。' },
  { id: 'reader.s9.ritual-procedure', label: '仪式步骤辨识', description: '依已确认玩法G，核对实际文档中的对象、步骤和未满足条件。本阶段只辨识有限案卷中的步骤缺口，不免费完成仪式；执行仍须另有明确对象、材料、时间与合法效果，也不凭记忆制造符咒。' },
];
export const READER_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
