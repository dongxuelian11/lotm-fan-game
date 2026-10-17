import { READER_GUIDE } from '../reader/content.js';
import type { ReasonerAbilityId } from './types.js';
export { REASONER_CASE_IDS } from './types.js';

/** Uses the approved White Tower gameplay direction, not independently verified novel
 * passages. Mentor, finite cases, finished supply, jobs and numeric defaults are G.
 * Observations must be accessible, hypotheses can fail, and tests consume real actions.
 * The complete recipe is unverified; no ingredients or brewing are fabricated. */
export const REASONER_GUIDE = READER_GUIDE;
export const REASONER_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const REASONER_MIN_READER_WEEKS = 4;
export const REASONER_BOTTLE_IDS = ['reasoner-potion-1', 'reasoner-potion-2', 'reasoner-potion-3'] as const;
export const REASONER_SOURCE_STATUS = '推理学员的观察、逻辑推理与仪式专精玩法沿用已确认的白塔设计，属于本作玩法改编G；现有小说查询未独立证实本阶段序列8的具体描述，不冒称原著已核。';
export const REASONER_POTION_SOURCES = REASONER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${REASONER_GUIDE}从新借阅馆交接渠道实际购入的第${index + 1}瓶序列8推理学员成品魔药，独立封存原瓶${id}；这批现货并非阅读者旧瓶改装，导师与成品供应为本作G原创。取得此瓶不建立知识与智慧教会或其它组织身份。`,
}));
export const REASONER_FORMULA_STATUS = '推理学员完整配方尚未在现有原著核验中找到；目前未开放配方学习与制造，只能取得新渠道实际供应的序列8独立成品原瓶，不编造配方材料。';
export const REASONER_LABOUR_TASKS = ['核验借阅馆来货封记', '整理原借阅册与归还记录', '复核借阅馆收货清单'] as const;
export const REASONER_ABILITIES: { id: ReasonerAbilityId; label: string; description: string }[] = [
  { id: 'reader.s8.observation', label: '细致观察', description: '依已确认玩法G，观察亲自在场且获准查看的有限痕迹，保留位置、来源与可见条件。不能看见未进入的房间、补出不存在的证据、读取内心或自动得知完整过去。' },
  { id: 'reader.s8.deduction', label: '逻辑推理', description: '依已确认玩法G，比较多个有证据依据的解释，再选择实际核实方法来排除矛盾。观察充分仍可能推断错误；资料缺失时必须保留未知，不能凭知识属性宣布唯一事实，也不能复制他人非凡能力。' },
  { id: 'reader.s8.ritual-specialism', label: '仪式专精', description: '依已确认玩法G，更细致地识别既有仪式记录的对象、步骤与条件。本阶段未新增可执行仪式；缺少真实对象、材料、时间或授权就不能施行，不凭空创造符咒、材料或仪式效果。' },
];
export const REASONER_CONSUMPTION_RISK = '服药必定消耗所选推理学员原瓶，0行动，意志难度12；阅读者扮演须达100且首次晋升阅读者后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。所有金额、行动、成熟周数与判定数值均为本作G平衡设定。';
