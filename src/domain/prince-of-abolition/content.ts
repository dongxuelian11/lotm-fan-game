import { ENTROPY_DUKE_ABILITIES, ENTROPY_DUKE_INHERITED_ABILITIES } from '../entropy-duke/content.js';
import type { PrinceOfAbolitionAbilityId, PrinceOfAbolitionPreparationId, PrinceOfAbolitionPrices } from './types.js';

/** The Black Emperor card directly names S1 弑序亲王 (L58314–58326).
 * Its complete formula, ritual and universal new mechanics are unknown.
 * The finite +35 pending personal action and 20s maintenance window below,
 * their paid support, costs and professional supply are original game design.
 * No S0 mausoleums, nation, resurrection, rewind or universal control follows. */
export const PRINCE_OF_ABOLITION_GUIDE = '米蕾介绍的专业交接处';
export const PRINCE_OF_ABOLITION_PRICES = { guidance: 500, potion: 7200, labourCredit: 6000, labourBalance: 1200, preparation: 180, resupply: 100 } as const;
export const princeOfAbolitionPrices = (): PrinceOfAbolitionPrices => PRINCE_OF_ABOLITION_PRICES;
export const princeOfAbolitionSourceLabel = (): string => `${PRINCE_OF_ABOLITION_GUIDE}的独立弑序亲王成品渠道`;
export const PRINCE_OF_ABOLITION_MIN_ENTROPY_DUKE_WEEKS = 12;
export const PRINCE_OF_ABOLITION_LABOUR_STEPS = 5;
export const PRINCE_OF_ABOLITION_BOTTLE_IDS = ['prince-of-abolition-potion-1', 'prince-of-abolition-potion-2', 'prince-of-abolition-potion-3'] as const;
export const PRINCE_OF_ABOLITION_POTION_SOURCES = PRINCE_OF_ABOLITION_BOTTLE_IDS.map(id => ({ id, source: `尚未当面登记来源的弑序亲王独立封存原瓶${id}；原瓶分别交付和耗用。` }));
export const princeOfAbolitionPotionSource = (number: number, week: number): string => `${princeOfAbolitionSourceLabel()}第${Math.ceil(number / 3)}批、第${week}周实际登记的第${number}瓶序列1成品，独立封存编号prince-of-abolition-potion-${number}；本瓶独立劳动、交付与耗用，不补回旧瓶。`;
export const PRINCE_OF_ABOLITION_FORMULA_STATUS = '专业交接处只交付独立封存的弑序亲王成品，不提供完整配方或自行调配方案。先核对律师至熵之公爵八阶真实经历、同一原演练房与原包球纸，检查本人的待执行动作和未结束效果的有限边界，并走查停止与普通返程。三项准备完成后，另付费用检查本周服药场地，再独立确认饮用所选原瓶。也可以继续作为熵之公爵生活。';
export const PRINCE_OF_ABOLITION_SOURCE_STATUS = '仍是同一演练房、米蕾、42岁的达里安、400克原封包、80克原软球及写着从A到B的原纸。本人先从门口实际走四米到室外，另付费购置、放置并检查近旁的新接收处，室内B、C原垫保持原位。每案重新询问许可，记录真实协作耗力；同一原球须真实投出、等待、步行取回并归还。撤回停止新施术，已有轨迹照常落地，已付费用与经过时间不倒退。两位成年人实际离开后才可能出现新的独立遭遇；原奥斯温仍在旧房间投降，伤势和原杖保持原状。';
export const PRINCE_OF_ABOLITION_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const PRINCE_OF_ABOLITION_PREPARATIONS: { id: PrinceOfAbolitionPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶经历与同一原物', description: '核对律师至熵之公爵八阶真实晋升、失败原瓶、旧报告与反思，以及同一米蕾、达里安、原封包、原软球、原纸和室内两块原垫。旧赠物去向、原身体、旧伤、马洛死亡和奥斯温投降不改写。' },
  { id: 'CHECK_LIMITS', title: '检查待行动作与未结束效果', description: '只能有限强化本人当前明确、尚未执行的一次身体动作；维持只用于本人已经开始而尚未结束的同一效果，最长二十秒。实际施术消耗灵性、精神与购入的有限支撑片，失败成本保留。撤回停止新输入，已投出的原球仍须普通落地，已经结算的动作不重开。' },
  { id: 'CHECK_RETURN', title: '走查室外接收处与普通归途', description: '核对门口至室外四米的真实路线，确认近旁接收处须另行付费、放置和检查，不能把原室内垫当作新设施。本人实际走到同一原球旁取回，连同原纸当面归还米蕾，再沿普通路线离开；成本不退，服药照护只处理本次排异，不治疗旧伤。' },
];
export const PRINCE_OF_ABOLITION_ABILITIES: { id: PrinceOfAbolitionAbilityId; label: string; description: string }[] = [
  { id: 'black-emperor.s1.directed-amplification', label: '定向强化', description: '支付8灵性与2精神，知识18检定；失败总计损4精神。成功只强化本人当前明确且尚未执行的一次身体动作，生活投球检定+35，实战对应一次身体动作贡献+35，须实际执行才应用；不增加行动、不重算旧投球。生活演练须亲持同一原球、取得本案许可并购入有限支撑片；实际使用记录磨损，停止或到期清除未用影响，成本不退。' },
  { id: 'black-emperor.s1.effect-maintenance', label: '有限维持', description: '支付8灵性与2精神，知识18检定；失败总计损4精神。只维持本人已经开始而尚未结束的同一效果，最多二十秒、不可叠加；须有当次许可和真实购入的有限支撑片。实战仅针对下一次可见、尚未结算的冲击减少30贡献，保留敌方独立动作与成本；不消除旧伤，不恢复已经结束的效果。' },
];
export const PRINCE_OF_ABOLITION_INHERITED_ABILITIES = [...ENTROPY_DUKE_INHERITED_ABILITIES, ...ENTROPY_DUKE_ABILITIES];
export function princeOfAbolitionConsumptionRisk(): string {
  return '熵之公爵消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，14项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，性别与既有身体保持。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。';
}
export const PRINCE_OF_ABOLITION_CONSUMPTION_RISK = princeOfAbolitionConsumptionRisk();
