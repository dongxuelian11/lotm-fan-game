import type { ApprenticeAbilityId } from './types.js';
export { APPRENTICE_CASE_IDS } from './types.js';

/** B1 chapter 107 verifies self-only passage through a locked door, then opening it normally.
 * The adult mentor, archive locksmith channel, sealed supply, jobs, cases and numerical rules are G. */
export const APPRENTICE_GUIDE = '独立档案锁匠诺拉·维恩';
export const APPRENTICE_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const APPRENTICE_BOTTLE_IDS = ['apprentice-potion-1', 'apprentice-potion-2', 'apprentice-potion-3'] as const;
export const APPRENTICE_SOURCE_STATUS = '能力边界据《诡秘之主》第一部第107章：佛尔思独自穿过上锁的门，再从另一侧打开原门；她明确不能带休一起穿过。本阶段学徒只获得开门能力，限本人通过眼前可适用的有限障碍，不让同伴自动同行。能穿过不代表原锁已经打开；原门须从内侧实际开启，普通退路与他人的位置分别保留。厚度数值与负重上限尚未核定，不把本作场景条件冒充原著通用极限；没有远距离传送、记录法术或序列8戏法。诺拉·维恩为本作原创成年独立导师；档案锁匠身份、成品供给、场景及数值均为本作原创G，不强制加入任何家族或组织。';
export const APPRENTICE_POTION_SOURCES = APPRENTICE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${APPRENTICE_GUIDE}独立保管的第${index + 1}瓶学徒成品魔药，原瓶独立封存；导师与档案工作间的独立供给为本作原创G，未声称现场配制。取得此瓶不建立任何家族或组织身份。`,
}));
export const APPRENTICE_FORMULA_STATUS = '学徒完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const APPRENTICE_ABILITIES: { id: ApprenticeAbilityId; label: string; description: string }[] = [
  { id: 'door.s9.door-opening', label: '开门', description: '本人穿过眼前可适用的有限障碍，位置实际变到另一侧。穿过原门不会自动开锁；须从内侧实际打开原门，外面的同伴才可走普通通道。第一部第107章中佛尔思不能带休穿门，本阶段不携人穿越、不远距离传送、不记录法术，也没有序列8戏法。原障碍的适用性与普通退路须先确认，厚度数值与负重上限未核，不能承诺穿透任意障碍或替别人判断绝对安全。' },
];
export const APPRENTICE_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
