import { BALANCER_ABILITIES, BALANCER_INHERITED_ABILITIES } from '../balancer/content.js';
import type { HandOfOrderAbilityId, HandOfOrderPreparationId, HandOfOrderPrices } from './types.js';

/** L194714 directly names S1 秩序之手. L201050–201058 describes William's
 * projection dividing a battlefield and controlling its aftermath. This does
 * not establish a complete formula, ritual or universal power catalogue.
 * All finite windows, paid supplies, checks, numerical effects and exercises
 * below are original game design. No 0-02 omnipotent laws or borrowed
 * five-minute spirituality duration is inferred from those scenes. */
export const HAND_OF_ORDER_GUIDE = '薇娜·贝尔介绍的专业交接处';
export const HAND_OF_ORDER_PRICES = { guidance: 500, potion: 7200, labourCredit: 6000, labourBalance: 1200, preparation: 180, resupply: 100 } as const;
export const handOfOrderPrices = (): HandOfOrderPrices => HAND_OF_ORDER_PRICES;
export const handOfOrderSourceLabel = (): string => `${HAND_OF_ORDER_GUIDE}的独立秩序之手成品渠道`;
export const HAND_OF_ORDER_MIN_BALANCER_WEEKS = 12;
export const HAND_OF_ORDER_LABOUR_STEPS = 5;
export const HAND_OF_ORDER_BOTTLE_IDS = ['hand-of-order-potion-1', 'hand-of-order-potion-2', 'hand-of-order-potion-3'] as const;
export const HAND_OF_ORDER_POTION_SOURCES = HAND_OF_ORDER_BOTTLE_IDS.map(id => ({ id, source: `尚未当面登记来源的秩序之手独立封存原瓶${id}；原瓶分别交付和耗用。` }));
export const handOfOrderPotionSource = (number: number, week: number): string => `${handOfOrderSourceLabel()}第${Math.ceil(number / 3)}批、第${week}周实际登记的第${number}瓶序列1成品，独立封存编号hand-of-order-potion-${number}；本瓶独立劳动、交付与耗用，不补回旧瓶。`;
export const HAND_OF_ORDER_FORMULA_STATUS = '交接处只交付独立封存的秩序之手成品，不提供完整配方或自行调配方案。先核对仲裁人至平衡者八阶真实经历与同一原人原物，检查待执行交接及本人可见冲量的有限边界，并走查停止与普通返程。三项准备完成后，另付费用检查本周服药场地，再独立确认饮用所选原瓶。也可以继续作为平衡者生活。';
export const HAND_OF_ORDER_SOURCE_STATUS = '仍是同一演练房、薇娜、43岁的米拉、350克原封包、原标条、原纸与本人原护板。本人先从门口实际走四米到室外，再另付费设置近旁相距四米的两处标记，原室内B桌保持原位。每案重新取得许可，记录真实协作耗力；原封包、标条和原纸须实际携行、取回、归还。撤回停止新施术，普通等候与返回始终可行，已付成本和经过时间不倒退。两位成年人实际离开后才可处理新的独立遭遇；旧卡斯帕、埃德里克和罗温的伤势、意愿、位置及原杖保留。';
export const HAND_OF_ORDER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const HAND_OF_ORDER_PREPARATIONS: { id: HandOfOrderPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶经历与同一原物', description: '核对仲裁人至平衡者八阶真实晋升、已耗原瓶、旧报告与反思，以及同一薇娜、米拉、原封包、原标条、原纸、B桌和本人原护板。原护板完整度、旧伤、人物生死、抵抗和投降不改写。' },
  { id: 'CHECK_LIMITS', title: '检查待执行交接与可见冲量', description: '划分只影响明确、可见且尚未执行的一次交接或身体动作；余波控制只缓冲本人接下来一次可见的有限冲量，最多二十秒。实际施术消耗灵性、精神与购入的有限支撑片，失败成本保留。普通收件者独立等候或拒绝，撤回停止新输入，已经发生的动作不重开。' },
  { id: 'CHECK_RETURN', title: '走查邻近标记与普通归途', description: '核对门口至室外四米的真实路线，确认邻近两处标记须另付费用、实际放置和检查，不能拿原室内B桌冒充新设施。本人实际取回并当面归还原物，再沿普通路线离开；成本不退，服药照护只处理本次排异，不治疗旧伤或修复原护板。' },
];
export const HAND_OF_ORDER_ABILITIES: { id: HandOfOrderAbilityId; label: string; description: string }[] = [
  { id: 'justiciar.s1.battlefield-division', label: '有限战场划分', description: '支付8灵性与2精神，知识18检定；失败总计损4精神，消耗一片已购有限支撑片。成功仅准备二十秒的一次有限影响：本案明确待执行的四米交接按实际一侧停下，或因失败、抵抗按普通路线通过；收件者保持独立意愿。实战对一次待执行身体动作贡献+35，须结算实际抵抗并真正应用才获经历。' },
  { id: 'justiciar.s1.aftermath-control', label: '有限余波控制', description: '支付8灵性与2精神，知识18检定；失败总计损4精神，消耗一片已购有限支撑片。最多二十秒，只缓冲一次选定可见冲量。生活中本人原护板实耗15完整度，成功将5健康损失降至2；普通承托同样可降至2但不获能力掌握。实战仅对下一次可见身体或弧光冲击减少30贡献，不抵挡精神作用；原护板不足15时不能施术，旧伤不消失。' },
];
export const HAND_OF_ORDER_INHERITED_ABILITIES = [...BALANCER_INHERITED_ABILITIES, ...BALANCER_ABILITIES];
export function handOfOrderConsumptionRisk(): string {
  return '平衡者消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，17项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，性别与既有身体保持。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。';
}
export const HAND_OF_ORDER_CONSUMPTION_RISK = handOfOrderConsumptionRisk();
