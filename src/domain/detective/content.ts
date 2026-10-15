import { REASONER_GUIDE } from '../reasoner/content.js';
import type { DetectiveAbilityId } from './types.js';
export { DETECTIVE_CASE_IDS } from './types.js';

/** Canon anchors: Book 2 chapters 202/206 describe Detective knowledge, reasoning,
 * combat and weapon basics; Book 3 chapter 46 shows Berg weighing finite possibilities.
 * Reconstruction remains evidence-bound, never omniscient replay. Ability imitation
 * through 2-081 is an external S6 effect, not an innate S7 power. Full recipe unverified.
 * Mentor, cases, independent finished originals, jobs, costs, maturity and safety are G. */
export const DETECTIVE_GUIDE = REASONER_GUIDE;
export const DETECTIVE_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const DETECTIVE_MIN_REASONER_WEEKS = 8;
export const DETECTIVE_BOTTLE_IDS = ['detective-potion-1', 'detective-potion-2', 'detective-potion-3'] as const;
export const DETECTIVE_SOURCE_STATUS = '守知者（侦探）的知识、推理、格斗与武器基础以第二部第202、206章为核验锚点；第三部第46章贝格对有限可能性的判断支持保留证据缺口，不能把现场重构写成无条件回放真相。封印物2-081带来的序列6能力效果属于外部物品，不能变成守知者自身的能力复制。具体情境和数值为本作G改编。';
export const DETECTIVE_POTION_SOURCES = DETECTIVE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${DETECTIVE_GUIDE}从新现场记录交接渠道实际购入的第${index + 1}瓶序列7守知者（侦探）成品魔药，独立封存原瓶${id}；这批现货并非阅读者或推理学员旧瓶改装，导师与成品供应为本作G原创。取得此瓶不建立知识与智慧教会或其它组织身份。`,
}));
export const DETECTIVE_FORMULA_STATUS = '守知者（侦探）完整配方资料待核；目前未开放配方学习与制造，只能取得新渠道实际供应的序列7独立成品原瓶，不编造配方材料或剂量。';
export const DETECTIVE_LABOUR_TASKS = ['核验借阅馆本批原瓶封记', '整理获准借阅的现场记录', '按原编号归还现场示意册', '复核本批成品交接清单'] as const;
export const DETECTIVE_ABILITIES: { id: DetectiveAbilityId; label: string; description: string }[] = [
  { id: 'reader.s7.reconstruction', label: '有限现场重构', description: '结合知识、推理与亲自在场核实的痕迹，比较有限的事件经过，再检查缺口。第三部第46章贝格式的可能性判断不等于无条件真相回放；没有留下的痕迹不能补出，未见的人物、动机与因果仍可未知。重构可能出错，不能自动读心、全知或把猜测当作定罪证据。' },
  { id: 'reader.s7.combat-training', label: '格斗与武器基础', description: '具备守知者的格斗和武器运用基础，能分析当前可见的交手动作。只能使用实际持有并装备的普通工具或武器，不能凭知识凭空生成装备、读出未来招式或复制他人非凡能力；封印物2-081的序列6外部效果不是自身能力。' },
  { id: 'reader.s7.agility', label: '身体敏捷', description: '更敏捷地协调身体，在实际可见、可通行的空间调整步伐与位置。不能瞬移、自动闪避所有攻击、隔墙追踪或穿过已封闭路线；使用实际现场边界和当前身体状态结算，失误与受伤仍会发生。' },
];
export const DETECTIVE_CONSUMPTION_RISK = '以下金额、时间与判定均为本作G游戏平衡：服药必定消耗所选守知者原瓶，0行动，意志难度18；推理学员扮演须达100且晋升推理学员后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。人类服药成为守知者后仍须扮演并消化魔药，也不会自动加入教会或其它组织。';
