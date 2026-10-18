import type { BardAbilityId } from './types.js';
export { BARD_CASE_IDS } from './types.js';

/** S9 boundaries are source-verified; no later-sequence holy magic is granted here.
 * Mentor, public music room, finished-potion supply, jobs, cases and all gameplay numbers are G. */
export const BARD_GUIDE = '独立公共音乐室导师米瑞尔·赫斯';
export const BARD_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const BARD_BOTTLE_IDS = ['bard-potion-1', 'bard-potion-2', 'bard-potion-3'] as const;
export const BARD_SOURCE_STATUS = '能力边界据《诡秘之主》第二部第186章《被污染者》：原文明确归于序列9的歌声或短句可增强本人及同伴的勇气、力量与敏捷，并有缓解反胃的有限表现。当事人在该段已是序列8，不能将其强度直接套给新晋歌颂者。必须实际发声、让本人或同伴听见；有限鼓舞不改变他人的核心意愿，不是强制服从、灵性回满或万能解除污染。导师米瑞尔·赫斯为本作原创成年独立导师；公共音乐室、成品供给、场景及数值均为本作原创G，不强制加入永恒烈阳教会或其它组织。';
export const BARD_POTION_SOURCES = BARD_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${BARD_GUIDE}在公共音乐室独立保管的第${index + 1}瓶歌颂者成品魔药，原瓶独立封存；导师与音乐室的独立供给为本作原创G，未声称现场配制。音乐室对自愿来访的成年人开放，取得此瓶不建立永恒烈阳教会或其它组织身份。`,
}));
export const BARD_FORMULA_STATUS = '已核《诡秘之主》第一部第140章《作死能手》及第144章《三方交易》的歌颂者材料片段：结晶太阳花1朵、海妖之石1块；可见辅料为仲夏草1根、七月酒汁液5滴、精灵暗叶1片。但替代清单仍有省略，也未完整核定溶剂与投料顺序。这些片段不构成完整制造配方；当前只开放本作原创G的独立成品原瓶，用药指导不解锁配方学习、材料采购或调配。';
export const BARD_ABILITIES: { id: BardAbilityId; label: string; description: string }[] = [
  { id: 'sun.s9.praise', label: '歌声赞颂', description: '通过实际歌声或可听见的短句，有限增强自己与同伴的勇气、力量和敏捷。需要真实发声和共同声场；不会隔墙锁定或无声生效。生活场景先取得本次同意，旁人可以拒绝或退出；不能改写核心意愿、强制服从或替听众作决定。该阶段没有神圣光束、圣水、复活或高序列净化。' },
  { id: 'sun.s9.courage', label: '勇气与协调', description: '在本人能实际发声并听见的条件下，以歌声支持自己的勇气、力量与敏捷，能力分别积累掌握。鼓舞不等于免疫恐惧、无敌、防弹或无限体力；原著的有限缓解反胃不代表治疗承诺、清除污染或灵性回满。普通谈话仍可提供帮助，未使用歌声就不冒记非凡效果。' },
];
export const BARD_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
