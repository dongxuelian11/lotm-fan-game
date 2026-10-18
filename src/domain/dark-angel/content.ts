import { ELDER_ABILITIES, ELDER_INHERITED_ABILITIES } from '../elder/content.js';
import type { DarkAngelAbilityId, DarkAngelPreparationId, DarkAngelPrices } from './types.js';

/** S1 name jointly supported at L236405/L236476. Formula, ritual and ordinary
 * S1 capacities are unknown. Sasrir's special two-characteristic/slate/Chaos
 * Sea state is not a generic power source. These finite original-game methods
 * coordinate one real, already selected SIGNAL or ward from an old spirit. */
export const DARK_ANGEL_GUIDE = '封存院交接处';
export const DARK_ANGEL_PRICES = { guidance: 500, potion: 7200, labourCredit: 6000, labourBalance: 1200, preparation: 180, resupply: 100 } as const;
export const darkAngelPrices = (): DarkAngelPrices => DARK_ANGEL_PRICES;
export const darkAngelSourceLabel = (): string => `${DARK_ANGEL_GUIDE}的独立暗天使成品渠道`;
export const DARK_ANGEL_MIN_ELDER_WEEKS = 12;
export const DARK_ANGEL_LABOUR_STEPS = 5;
export const DARK_ANGEL_BOTTLE_IDS = ['dark-angel-potion-1', 'dark-angel-potion-2', 'dark-angel-potion-3'] as const;
export const DARK_ANGEL_POTION_SOURCES = DARK_ANGEL_BOTTLE_IDS.map(id => ({ id, source: `尚未当面登记来源的暗天使独立封存原瓶${id}；原瓶分别交付和耗用。` }));
export const darkAngelPotionSource = (number: number, week: number): string => `${darkAngelSourceLabel()}第${Math.ceil(number / 3)}批、第${week}周实际登记的第${number}瓶序列1成品，独立封存编号dark-angel-potion-${number}；本瓶独立劳动、交付与耗用，不补回旧瓶。`;
export const DARK_ANGEL_FORMULA_STATUS = '封存院交接处只交付独立封存的暗天使成品，不提供完整配方。先核对秘祈人至秽语长老八阶真实经历、仍存续的原灵及其已选方法，并亲自走查停止和普通返程。三项准备完成后，另付费用检查本周服药场地，再独立确认饮用所选原瓶。也可以停留在秽语长老阶段。';
export const DARK_ANGEL_SOURCE_STATUS = '继续使用同一封存院、玛拉、原卡、左右箱、远端封条、原灯和原遮板。本人从入口走4米到原桌，再走4米到原封条；玛拉从院外到入口实际走2米。原残留仍被封存。赫莲娜与罗兰仅按仍存续的真实资源和已选方法参与，释放或消散者不能补回。每案重新征得许可，实际购入一张封条；旧原灵、储备、耗材与旧对手的身体结果不会刷新。';
export const DARK_ANGEL_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const DARK_ANGEL_PREPARATIONS: { id: DarkAngelPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶经历与封存原物', description: '逐一核对真实晋升、失败原瓶、秽语长老三份报告与反思，以及同一原卡、原箱、封条、灯与遮板。旧巴斯蒂安和布拉姆的撤退、释放记录、旧伤与耗用材料全部留存。' },
  { id: 'CHECK_SPIRITS', title: '核对现存原灵与已选方法', description: '核对赫莲娜和罗兰实际存续状态、灵性、完整度和已选方法。引导只用原信号，护持只用原短暂护持或遮护；一次只选一灵，不扩容放牧、外放或本人借用，不补充原灵资源。' },
  { id: 'CHECK_RETURN', title: '走查停止、归物与普通返程', description: '本人实查可撤回许可、停止窗口、归还原卡和封条、关闭原灯遮板与普通步行返程。已用成本不退；服药照护只处理本次排异，不治疗旧伤。' },
];
export const DARK_ANGEL_ABILITIES: { id: DarkAngelAbilityId; label: string; description: string }[] = [
  { id: 'hanged-man.s1.single-spirit-guidance', label: '单灵引导', description: '本人支付8灵性与2精神，明确选择仍存续、已放牧且内收的一位原灵，调用其实际已选信号并消耗3原灵灵性，知识18检定。成功开启20秒一次窗口，下一次实际阅读同一原卡的核对质量从3提高到6；实战仅为同一可见对象的下一次实际普通攻击增加35。实际应用才消耗新封条；失败总计损4精神，原费用不退。' },
  { id: 'hanged-man.s1.single-spirit-shelter', label: '单灵护持', description: '本人支付8灵性与2精神，明确选择赫莲娜已选的短暂护持或罗兰已选的遮护，消耗该原灵3灵性并作知识18检定。成功开启20秒一次窗口，下一次封存操作的局部感受压力从3降到1，原残留仍为3；实战仅抵减下一次可见身体或精神冲击30。实际应用才消耗封条；失败费用保留。移动、停止、撤回、强光或到期使未用窗口失效。' },
];
export const DARK_ANGEL_INHERITED_ABILITIES = [...ELDER_INHERITED_ABILITIES, ...ELDER_ABILITIES];
export function darkAngelConsumptionRisk(): string {
  return '秽语长老消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，15项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，性别与既有身体保持。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。';
}
export const DARK_ANGEL_CONSUMPTION_RISK = darkAngelConsumptionRisk();
