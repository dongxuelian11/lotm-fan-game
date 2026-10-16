import type { SailorAbilityId } from './types.js';
export { SAILOR_CASE_IDS } from './types.js';

/** S9 capability boundaries: novel book one, chapter six, summarized without excerpts.
 * Mentor, finished-potion supply, jobs, prices, cases and every gameplay number are G.
 * S8 rage and S7 water magic remain outside this stage. */
export const SAILOR_GUIDE = '独立码头维修站导师艾洛·芬奇';
export const SAILOR_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const SAILOR_BOTTLE_IDS = ['sailor-potion-1', 'sailor-potion-2', 'sailor-potion-3'] as const;
export const SAILOR_SOURCE_STATUS = '能力边界据《诡秘之主》第一部第6章：水手拥有出色平衡、风暴中船上行动能力、强壮体魄、滑腻幻鳞与水中灵活性；小说描述可在水下活动至少十分钟。此为虚构非凡能力，不是现实潜水建议。导师、供药渠道、场景及数值均为本作原创G。';
export const SAILOR_POTION_SOURCES = SAILOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SAILOR_GUIDE}私下保管的第${index + 1}瓶水手成品魔药，原瓶独立封存；导师与维修站的独立供给为本作原创G，未声称现场配制。取得此瓶不建立风暴教会或其它组织身份。`,
}));
export const SAILOR_FORMULA_STATUS = '水手完整配方尚未在现有原著核验中找到；目前未开放配方学习与制造，只能取得导师现有的独立成品原瓶，不编造配方材料。';
export const SAILOR_ABILITIES: { id: SailorAbilityId; label: string; description: string }[] = [
  { id: 'tyrant.s9.aquatic-affinity', label: '水生亲和与幻鳞', description: '在实际水域中拥有水中灵活性，皮肤可呈滑腻幻鳞；小说第一部第6章描述至少十分钟的水下活动能力。虚构能力不提供无限呼吸、深水压免疫或防弹；现场仍要核对水情、原绳具、协作人与撤离路线，不把未知水域当作安全。' },
  { id: 'tyrant.s9.physique', label: '水手体魄', description: '强壮体魄用于已有对象的搬运、攀附与有限近战；不能凭力量省略绳具、专业维修步骤或救援协作，不免伤、不防弹。序列8暴怒与序列7水系法术不属于当前能力。' },
  { id: 'tyrant.s9.balance', label: '船上平衡', description: '出色平衡使人在风暴中晃动的船上仍能行动；在当前湿滑栈桥与码头实践中读取真实支撑点，不自动闪避、不无视坠落，也不凭空召来风浪或消除现场危险。' },
];
export const SAILOR_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
