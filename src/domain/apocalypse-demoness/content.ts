import type { ApocalypseDemonessAbilityId, ApocalypseDemonessPreparationId } from './types.js';
import { CALAMITY_DEMONESS_INHERITED_ABILITIES, CALAMITY_DEMONESS_ABILITIES } from '../calamity-demoness/content.js';

/** Internal source boundary: L236629–236631 gives the old-day formula's
 * “末日” and “征服者” mapping; the known Hunter S1 Conqueror mapping supports
 * the Demoness S1 name. “末日魔女” is this project's public expanded name.
 * Complete S1 formula, complete ritual and named S1 ability conditions remain
 * unknown. Finished bottles, three paid preparations, bounded pulse containment
 * and a one-impact mirror buffer are original gameplay. Ordinary practice is
 * not a canonical ritual. Trissy's special vessel, deity catastrophe, fourth
 * pillar, resurrection and global-disaster powers are expressly excluded. */
export const APOCALYPSE_DEMONESS_GUIDE = '贝克兰德末日魔女独立成品交接处';
export const APOCALYPSE_DEMONESS_PRICES = { guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100, recovery: 120, recoveryDrug: 900, recoveryLabourBalance: 90 } as const;
export const APOCALYPSE_DEMONESS_MIN_CALAMITY_DEMONESS_WEEKS = 12;
export const APOCALYPSE_DEMONESS_LABOUR_STEPS = 5;
export const APOCALYPSE_DEMONESS_BOTTLE_IDS = ['apocalypse-demoness-potion-1', 'apocalypse-demoness-potion-2', 'apocalypse-demoness-potion-3'] as const;
export const APOCALYPSE_DEMONESS_FORMULA_STATUS = '交接处供应分别封存的末日魔女成品魔药。服用前先核对刺客至灾难魔女的八阶实际来源、三份报告与反思，核实同一对原镜、原箱的当前状态与本次新来源，再走查停止和普通返回路线。三项专业准备分别完成后，另付费检查当周场地，再独立确认饮用所选原瓶。';
export const APOCALYPSE_DEMONESS_SOURCE_STATUS = '继续使用原展廊附室、同一对原镜与原箱。维瑞娜和马库斯保持各自真实位置、身体与精力，每案须重新询问当前同意并亲自走到现场。旧负载、旧残留和旧护片保留实际耗用与归还记录；本次只另购一份50便士的封装非生物残留、一份30便士的一次冲击负载，每案另付20便士取得一片单次护片。已经形成的焦痕与损耗不恢复。失败、到期或撤回仍保留成本，未结束的脉冲须按普通方法封存，物件实际归还后各自步行离开。';
export const APOCALYPSE_DEMONESS_POTION_SOURCES = APOCALYPSE_DEMONESS_BOTTLE_IDS.map((id, index) => ({ id, source: `${APOCALYPSE_DEMONESS_GUIDE}初始批次第${index + 1}瓶序列1末日魔女成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装旧灾难魔女原瓶，也不补回以前耗尽的原瓶。` }));
export const APOCALYPSE_DEMONESS_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const APOCALYPSE_DEMONESS_PREPARATIONS: { id: ApocalypseDemonessPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶来源与原镜原箱', description: '本人核对八阶真实晋升、失败原瓶、旧制药材料，以及灾难魔女三份报告与反思。同一对原镜、原箱、两名成人和本人都以当前实际位置与消耗为准；旧伤、投降者、死亡和遗物不会因晋升重置。' },
  { id: 'PLAN_CONTAINMENT', title: '核实有限脉冲与本人承受', description: '核对旧负载、残留、生活护片与独立战斗镜片的实际剩余。后续须另购一份有限非生物来源、一份一次冲击负载和各案独立护片，当前许可与实际安装分别完成。脉冲收束只处理下一次仍待发生的脉冲，镜面缓冲只处理本人下一次身体冲击，既有损伤保留。' },
  { id: 'CHECK_RETURN', title: '走查停手与普通返回路线', description: '本人核实原展廊的入口、两面原镜、封闭容器和普通出口。每个成人保持独立身体与意愿，旧许可不自动延续；撤回立即停止新施术，未结脉冲仍须普通封存，护片实际归还，所有人亲自步行离开。专业支持只处理当次服药排异，不退费用、不治疗旧伤。' },
];
export const APOCALYPSE_DEMONESS_ABILITIES: { id: ApocalypseDemonessAbilityId; label: string; description: string }[] = [
  { id: 'assassin.s1.pulse-containment', label: '脉冲收束', description: '花8灵性与2精神，以知识18尝试收束当前已观察到的有限来源。生活施术过1秒、实战动作过5秒，成功窗口最多20秒。生活只压低本次封装来源下一次尚未发生的脉冲，实际脉冲仍耗尽该份来源并留下护片和原箱的磨损、焦痕；实战只辅助针对已观察到待发来源的一次普通攻击30。不能撤销已有伤害、作用于任意目标或重复使用耗尽来源；实际应用才计掌握，失败仍可付出成本普通封存。' },
  { id: 'assassin.s1.mirror-buffer', label: '镜面缓冲', description: '花8灵性与2精神，以意志18尝试借实际安装的本案护片缓冲本人下一次可见身体冲击。生活施术过1秒、实战动作过5秒，成功窗口最多20秒。生活的一次有限负载将本人6健康损失降低3，普通承受或护持都耗尽负载与一片护片并留下5磨损；实战下一次可见身体作用减30，同时耗一枚新战斗镜片次数并留下5磨损。不能保护精神、撤销既有损伤或恢复旧器具；移动、遮挡、到期或撤回会使窗口失效，成本不退。' },
];
export const APOCALYPSE_DEMONESS_INHERITED_ABILITIES = [...CALAMITY_DEMONESS_INHERITED_ABILITIES, ...CALAMITY_DEMONESS_ABILITIES].map(a => ({ ...a }));
export const APOCALYPSE_DEMONESS_CONSUMPTION_RISK = '要求灾难魔女消化100、从其实际晋升周起满12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动；另付1行动与150便士检查当周场地，再以0行动独立确认饮用所选原瓶，意志30。大成功晋升、精神−8；成功晋升、精神−15；失败仍为灾难魔女、健康−15精神−25排异+30；严重排异仍为灾难魔女、健康−25精神−45排异+60。原瓶与本次准备均耗尽；专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。成功四属性各+1，十八项旧掌握保持原值，两项新掌握从0开始，灵性上限120且当前不补满。姓名、当前性别、年龄、性格、取向、原伤势与旧人的结局不变。三瓶全部失败耗尽后，可花1行动与100便士申请下一批，至少跨一真实周再接收三瓶；各瓶费用与准备单独结算。';

/** Future-only protocol; historical records keep their original schema and fields. */
export const APOCALYPSE_DEMONESS_RECOVERY_SCHEMA_VERSION = 218;
export const APOCALYPSE_DEMONESS_RECOVERY_SITE_ID = 'BACKLUND_ORIGINAL_GALLERY_EXIT' as const;
export const APOCALYPSE_DEMONESS_PROMOTION_STABILITY = { cash: 60, spirituality: 8, mind: 6, bonus: 13 } as const;
export const APOCALYPSE_DEMONESS_RECOVERY_RISK = '最初三份原特性总量保持三。三瓶真实失败后，可花1行动与120便士调查指定原失败回执，隔一真实周再花1行动回原展廊出口，当面重新取得马库斯本次许可并封存同一份原特性。重配容器不是第四份原特性，旧瓶及失败结果保留；本次新普通药物与调配服务900便士，或五项新劳动后90便士。另付150便士与1行动检查当周场地。可选择为指定未服瓶另付60便士、8灵性、6精神，获得只限本瓶、本场、本周的意志+13支持；按当前意志动态显示概率，仍会失败。退出、跨周或服药即失效，无退款、无补伤、无净化；污染须走正常净化、收入与休养流程。成功后仍从末日魔女生活实践0/100开始。';
