import { TRICKMASTER_GUIDE } from '../trickmaster/content.js';
import type { AstrologerAbilityId } from './types.js';
export { ASTROLOGER_CASE_IDS } from './types.js';

/** B4 ch31 supports asking one's own spirituality whether two images depict the same
 * person; ch54 supports astrological knowledge with a helpful crystal ball, not
 * omniscience; ch63 supports divination interference including danger intuition.
 * Two mastery groups, mentor, original supplies, scenes and all numbers are G. */
export const ASTROLOGER_GUIDE = TRICKMASTER_GUIDE;
export const ASTROLOGER_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const ASTROLOGER_MIN_TRICKMASTER_WEEKS = 8;
export const ASTROLOGER_BOTTLE_IDS = ['astrologer-potion-1', 'astrologer-potion-2', 'astrologer-potion-3'] as const;
export const ASTROLOGER_SOURCE_STATUS = '《诡秘之主》第四部第31章支持借助自己的灵性询问两张画像是否为同一个人；第54章支持占星知识与水晶球的辅助作用，占星并非全知，不能从有限问题补出未得到的事实；第63章支持干扰占卜，并可影响危险直觉。继承学徒开门与戏法大师的有限戏法，占星与占卜干扰分别记为两组本作G掌握。不提前开放序列6记录或复制法术，也不开放旅行与远距离传送。诺拉·维恩仍是同一位本作原创成年独立导师；独立新供给、现场案例、固定范围、灵性成本与全部数值为本作玩法改编G，不建立家族或组织身份。';
export const ASTROLOGER_POTION_SOURCES = ASTROLOGER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${ASTROLOGER_GUIDE}从新观测器具档案交接渠道实际购入的第${index + 1}瓶序列7占星人成品魔药，独立封存原瓶${id}；这批现货并非学徒旧瓶或戏法大师材料改装，导师与成品供应为本作G原创，未声称掌握完整配方或现场配制。取得此瓶不建立任何家族或组织身份。`,
}));
export const ASTROLOGER_FORMULA_STATUS = '序列7占星人的完整配方尚未核定。《诡秘之主》第三部第198章可核主材线索：陨星水晶60g为求购量，拉瓦章鱼血液结晶一份为交易表述且未给重量；不能把60g求购量解释为完整配方的精确投料数量，也不能从一份交易补出重量。辅材与完整配方未核，不开放片段配方的材料采购或调配，不沿用学徒成品与戏法大师六料冒充占星人配方。当前只开放本作G独立成品原瓶，用药指导不解锁完整配方。';
export const ASTROLOGER_LABOUR_TASKS = ['核验本批独立原瓶封记', '整理获准查阅的观测器具借还簿', '按原编号归还星图档案', '复核本批成品交接清单'] as const;
export const ASTROLOGER_ABILITIES: { id: AstrologerAbilityId; label: string; description: string }[] = [
  { id: 'door.s7.astrology', label: '有限占星', description: '第四部第31章支持向自己的灵性询问两张画像是否为同一个人；第54章支持占星知识与水晶球辅助。只能处理有依据的有限问题，回应需要结合现场与普通记录核对，不保证完整真相、未来或人物动机，不是全知调查。本作将有限占星记为一组G掌握，场景、判定与灵性成本为G。' },
  { id: 'door.s7.divination-interference', label: '占卜干扰', description: '第四部第63章支持干扰占卜并影响危险直觉，干扰不等于绝对免疫或保证成功。本作以在场、知情同意的原创成年占卜家梅芙·柯林进行一次低强度对照：对方独立判定仍可能成功，真实消耗对方灵性；干扰只改变此次检查，不抹去记忆、控制意志或保证阻断。本作将其单独记为一组G掌握，不开放序列6记录或复制法术、旅行与远距离传送。' },
];
export const ASTROLOGER_CONSUMPTION_RISK = '服药必定消耗所选占星人原瓶，0行动，意志难度18；戏法大师扮演须达100且晋升戏法大师后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、占星接触与其它危险。所有金额、行动、成熟周数与判定数值均为本作G平衡设定。';
