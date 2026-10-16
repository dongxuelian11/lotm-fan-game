import type { AssassinAbilityId, AssassinOriginalDraft } from './types.js';
export { ASSASSIN_CASE_IDS } from './types.js';

/** B1 ch65 bounds S9: brief lightness, keen/dark vision, shadow concealment,
 * agile steps, and concentrating strength into one hit. All game numbers,
 * the adult independent mentor, supply and peaceful exercises are original G. */
export const ASSASSIN_GUIDE = '独立身法导师诺艾拉·温瑟';
export const ASSASSIN_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const ASSASSIN_BOTTLE_IDS = ['assassin-potion-1', 'assassin-potion-2', 'assassin-potion-3'] as const;
export const ASSASSIN_SOURCE_STATUS = '刺客序列9的短暂轻身、鹰般视力与黑暗视觉、藏入阴影、敏捷步伐和将全身力量集中为一击，据《诡秘之主》第一部第65章限定。诺艾拉·温瑟是本作原创成年独立导师；她保管的成品药渠道、劳务、和平练习及全部游戏数值均为本作原创G，不要求加入魔女教派或其它组织，也不以伤害他人作为消化条件。轻身只能短时辅助本人移动，不是飞行；藏影不是绝对隐形，声响、光线与旁人观察仍会暴露位置；集中爆发不是必中或必杀。序列7的黑焰、冰霜、镜替与身体转变不属于序列9。';
export const ASSASSIN_POTION_SOURCES = ASSASSIN_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${ASSASSIN_GUIDE}独立保管的第${index + 1}瓶刺客成品魔药，原瓶独立封存；导师与练习场的独立供给为本作原创G，未声称现场配制。取得此瓶不建立魔女教派或其它组织身份。`,
}));
export const ASSASSIN_FORMULA_STATUS = '刺客完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const ASSASSIN_ABILITIES: { id: AssassinAbilityId; label: string; description: string }[] = [
  { id: 'assassin.s9.lightness', label: '短暂轻身与敏捷步伐', description: '短时减轻本人移动负担，配合敏捷步伐越过已观察的有限高差。必须检查落点并实际返回，不能飞行、滞空或携带旁人；普通楼梯始终保留为退路。' },
  { id: 'assassin.s9.vision', label: '鹰视与黑暗视觉', description: '看清眼前远处或昏暗处的真实标记，仍须核对原物。不会透视遮挡、读心或凭空知道真相；普通移灯近看也能完成核查。' },
  { id: 'assassin.s9.shadow', label: '藏影', description: '利用现有阴影降低自己的显眼程度，依靠观察与步伐通过有限区域。不是绝对隐形；亮处、声响和观察者仍会揭示位置，不能穿墙或无条件隐去。' },
  { id: 'assassin.s9.burst', label: '集中力量的一击', description: '将本人力量集中于一次受控动作，在软垫练习中辨认停止信号并及时收力。不是必中或必杀，也不凭空获得武器；后果仍服从实际判定与共同伤势规则。' },
];
export const ASSASSIN_ORIGINAL_DRAFT: Readonly<AssassinOriginalDraft> = {
  id: 'assassin-original-draft', owner: '诺艾拉·温瑟', custodian: 'NOAELA', location: 'upper-tray', version: 1,
};
export const ASSASSIN_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
