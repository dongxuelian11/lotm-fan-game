import { RAGER_GUIDE } from '../rager/content.js';
import type { NavigatorAbilityId } from './types.js';
export { NAVIGATOR_CASE_IDS, NAVIGATOR_PLAN_IDS } from './types.js';

/** Canon anchors: book one ch65 describes magnetic/current/wind/cloud intuition,
 * improvement at sea, underwater endurance exceeding half an hour and limited water
 * magic. Book one ch157 depicts suffocating water film, not an air-bubble rescue power.
 * Book two ch153's waves belong to a mature, fully digested Navigator, not a newly
 * promoted character's automatic tsunami. Mentor, finished supply, jobs, cases,
 * numerical rules and guided-potion protection are explicitly G adaptations. */
export const NAVIGATOR_GUIDE = RAGER_GUIDE;
export const NAVIGATOR_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const NAVIGATOR_MIN_RAGER_WEEKS = 8;
export const NAVIGATOR_BOTTLE_IDS = ['navigator-potion-1', 'navigator-potion-2', 'navigator-potion-3'] as const;
export const NAVIGATOR_SOURCE_STATUS = '原著能力边界：第一部第65章涉及对磁场、海流、风与云的航海直觉，海上表现改善、超过半小时的水下活动能力以及有限水系法术；超过半小时是原文能力描述，不是固定上限，也不是任何水况下的安全保证。第一部第157章出现的是会造成窒息的水膜，不能改写成供气泡救援。第二部第153章的掀浪表现属于成熟、完全消化的航海家，不能直接授予刚晋升者制造海啸。导师、成品渠道、劳务、场景、全部数值和指导服药保护为本作G改编。';
export const NAVIGATOR_POTION_SOURCES = NAVIGATOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${NAVIGATOR_GUIDE}从新航道记录交接渠道实际购入的第${index + 1}瓶序列7航海家成品魔药，独立封存原瓶${id}；这批现货并非水手或暴怒之民旧瓶改装，导师与成品供应为本作G原创。取得此瓶不建立风暴教会或其它组织身份。`,
}));
export const NAVIGATOR_FORMULA_STATUS = '航海家完整配方资料待核；目前未开放配方学习与制造，只能取得新渠道实际供应的序列7独立成品原瓶，不编造配方材料或剂量。';
export const NAVIGATOR_LABOUR_TASKS = ['核验维修站本批原瓶封记', '整理获准查阅的航道记录', '按原编号归还潮汐记录册', '复核本批成品交接清单'] as const;
export const NAVIGATOR_ABILITIES: { id: NavigatorAbilityId; label: string; description: string }[] = [
  { id: 'tyrant.s7.navigation', label: '航海直觉', description: '依据第一部第65章，对磁场、海流、风与云具备航海直觉，在海上更能发挥能力；本作结合现场观察判断有限航路和天气趋势。仍要核实水况、人员与撤离路线，不能获知未见海域的一切或保证航行安全。超过半小时的水下活动是能力描述，不是固定上限或安全保证，不等于永久水下呼吸。' },
  { id: 'tyrant.s7.water-control', label: '有限控水', description: '第一部第65章支持有限水系法术，本作在现场实际存在且获准使用的水源上表现有限水流控制，范围、资源成本和清洁任务为玩法G。不会在陆地凭空创造海域、暴雨或海啸；第二部第153章完全消化的成熟航海家掀浪表现不能直接套给刚晋升者。原水、原物和环境后果必须保留。' },
  { id: 'tyrant.s7.water-binding', label: '水缚与水膜', description: '第一部第157章存在包裹头部并造成窒息的水膜；本作将有限水缚与再次控制后的窒息实时对抗拆成两步玩法G，不能自动命中或保证窒息。水膜不是供气泡，也不提供气泡救援；无呼吸需求或明确免疫的目标不进入假窒息对抗，日常清洁不能拿无辜者试验。' },
];
export const NAVIGATOR_CONSUMPTION_RISK = '以下金额、时间与判定均为本作G游戏平衡：服药必定消耗所选航海家原瓶，0行动，意志难度18；暴怒之民扮演须达100且晋升暴怒之民后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、涉水与其它危险。人类服药成为航海家后仍须扮演并消化魔药，也不会自动加入教会或其它组织。';
