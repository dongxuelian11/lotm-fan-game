import { SLEEPLESS_GUIDE } from '../sleepless/content.js';
import type { MidnightAbilityId } from './types.js';
export { MIDNIGHT_CASE_IDS } from './types.js';

/** S8 retains S9 darkvision and night enhancement, strengthens physical technique, and
 * voices poems that can calm or induce drowsiness. Nearby allies can also be affected;
 * resistance and interruption remain possible. No dream entry before S7, and no invented
 * fear/courage catalogue. Mentor, finished supply, jobs and all numeric defaults are G.
 * The complete recipe is unverified; this slice never fabricates ingredients or brewing. */
export const MIDNIGHT_GUIDE = SLEEPLESS_GUIDE;
export const MIDNIGHT_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const MIDNIGHT_MIN_SLEEPLESS_WEEKS = 4;
export const MIDNIGHT_BOTTLE_IDS = ['midnight-potion-1', 'midnight-potion-2', 'midnight-potion-3'] as const;
export const MIDNIGHT_POTION_SOURCES = MIDNIGHT_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${MIDNIGHT_GUIDE}从新值班室交接渠道实际购入的第${index + 1}瓶序列8午夜诗人成品魔药，独立封存原瓶${id}；这批现货并非不眠者旧瓶改装，导师与成品供应为本作G原创。取得此瓶不建立教会或其它组织身份。`,
}));
export const MIDNIGHT_FORMULA_STATUS = '午夜诗人完整配方资料待核；目前未开放配方学习与制造，只能取得新渠道实际供应的序列8独立成品原瓶，不编造配方材料。';
export const MIDNIGHT_LABOUR_TASKS = ['核验值班室来货封记', '整理夜班普通灯具交接记录', '复核值班室收货清单'] as const;
export const MIDNIGHT_ABILITIES: { id: MidnightAbilityId; label: string; description: string }[] = [
  { id: 'darkness.s8.poetry', label: '有声诗歌', description: '实际出声吟诵诗歌，使听见的人趋于平静、倦怠或昏昏欲睡；附近同伴也可能受影响。须考虑能否听见、环境噪声与当事人意愿，目标可以抵抗，吟诵可以被打断。没有自动恐惧、勇气歌曲目录，也不能进入或读取梦境。' },
  { id: 'darkness.s8.physical-training', label: '格斗与身体技巧', description: '继承黑暗视物、夜间强化与有限危险感应，并获得更好的格斗、攀爬和身体协调能力；只能处理真实在场、可触及的障碍与对手。依然会受伤、疲惫，不能隐身、瞬移或获得不死保护。' },
];
export const MIDNIGHT_CONSUMPTION_RISK = '服药必定消耗所选午夜诗人原瓶，0行动，意志难度12；不眠者扮演须达100且首次晋升不眠者后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。所有金额、行动、成熟周数与判定数值均为本作G平衡设定。';
