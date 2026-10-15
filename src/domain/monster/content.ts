import type { MonsterAbilityId } from './types.js';
export { MONSTER_CASE_IDS } from './types.js';

/** Verified chapter summary only. Guide, supply, cases and all numerical rules are original G. */
export const MONSTER_GUIDE = '报时铺记录员艾妲·芬恩';
export const MONSTER_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const MONSTER_BOTTLE_IDS = ['monster-potion-1', 'monster-potion-2', 'monster-potion-3'] as const;
export const MONSTER_SOURCE_STATUS = '《诡秘之主》第四部第178章支持怪物序列9拥有极高的灵性与感知，偶尔看到未来片段或产生危险直觉，同时承受感官负担；这些征兆不由本人任意选择，不保证每次出现，也不提供全部真相。序列8机器人的计算、精确控制、身体天赋与占卜不下放；序列7幸运儿的被动且不可控幸运不下放，序列5胜利者才有的可控幸运与积运也不下放。怪物是虚构序列名称，不自动改变身体外形，也不把现实感官敏感或心理症状认定为超自然能力。艾妲·芬恩是本作原创成年报时铺记录员；独立成品药渠道、普通劳务、三项有限核实与反思、全部游戏数值均为本作原创G，不自动建立生命学派或其它组织身份。';
export const MONSTER_POTION_SOURCES = MONSTER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${MONSTER_GUIDE}独立保管的第${index + 1}瓶怪物成品魔药，原瓶独立封存；记录员与报时铺供给为本作原创G，未声称现场配制。取得此瓶不建立生命学派或其它组织身份。`,
}));
export const MONSTER_FORMULA_STATUS = '怪物完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const MONSTER_ABILITIES: { id: MonsterAbilityId; label: string; description: string }[] = [
  { id: 'wheel.s9.spirit-sensitivity', label: '超常灵性感知', description: '极高的灵性与感知可能带来局部的异常感受和感官负担。关注已在场的有限迹象，再用普通事实核实；不把敏感当成全知，不获得机器人的精确控制或身体天赋。' },
  { id: 'wheel.s9.fragmentary-omen', label: '偶发未来片段', description: '偶尔出现难以主动选择的未来片段，可能不完整或难以解释。不能指定未来事件、反复查询答案，也不能把片段直接写成已经查实的事实；不开放机器人占卜或高序列预言。' },
  { id: 'wheel.s9.danger-intuition', label: '有限危险直觉', description: '偶发危险感只提醒谨慎、停下或核实眼前退路，不保证辨明来源或成功避险；没有征兆也不表示绝对安全。不获得幸运儿的被动幸运、胜利者的可控幸运或积运。' },
];
export const MONSTER_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。记录员在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗、异常接触及其它危险。实际停止本次集中关注不保证感官负担消失，也不能关闭所有被动感知；未来片段与危险直觉均不保证出现、正确解释或绝对安全。';
