import { CATASTROPHE_GUIDE } from '../catastrophe/content.js';
import type { ThunderGodAbilityId, ThunderGodPreparationId } from './types.js';

/** Development evidence: S1 雷神 is directly named at L144740; adjacent S0 at
 * L144738–L144740. The complete S1 formula and ritual remain unknown. The
 * finished-bottle channel, professional preparation, finite supernatural powers
 * and all numerical rules below are original game design, not S0 ritual or
 * light-speed claims. No physical electrical construction is represented. */
export const THUNDER_GOD_GUIDE = CATASTROPHE_GUIDE;
export const THUNDER_GOD_PRICES = { guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100, recovery: 120, recoveryDrug: 900, recoveryLabourBalance: 90 } as const;
export const THUNDER_GOD_MIN_CATASTROPHE_WEEKS = 12;
export const THUNDER_GOD_LABOUR_STEPS = 5;
export const THUNDER_GOD_BOTTLE_IDS = ['thunder-god-potion-1', 'thunder-god-potion-2', 'thunder-god-potion-3'] as const;
export const THUNDER_GOD_FORMULA_STATUS = '艾洛·芬奇介绍独立封存的雷神成品魔药。当前渠道只交付成品，服用前须完成专业准备：核对水手至天灾八阶原瓶、三份实际报告与反思，亲自核定原小湾内的有限目标和当前视线，再走查停止、收物与返回路线。三项准备完成后，另付费检查当周场地，再独立确认饮用所选原瓶。';
export const THUNDER_GOD_SOURCE_STATUS = '诺拉的同一原小湾、20单位原水、原闸、浮标、系索与轮具保留。每案重新取得当前许可；44岁的技师芬恩·科尔带来自己独立持有的有限超自然练习靶架与可拆遮罩，你另行买下同一原靶和本人护片。两位成年人实际走出目标线后才可施术。雷势引导只帮助随后一次真正放电；风雷护持只保护本人随后一次已声明的小规模练习冲击。遮罩、视线变化、到时或撤回会使旧窗口失效，仍可普通停止、清除遮罩、收物并步行离开。';
export const THUNDER_GOD_POTION_SOURCES = THUNDER_GOD_BOTTLE_IDS.map((id, index) => ({ id, source: `${THUNDER_GOD_GUIDE}介绍的独立供货处初始批次第${index + 1}瓶序列1雷神成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回以前已耗尽的原瓶。` }));
export const THUNDER_GOD_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const THUNDER_GOD_PREPARATIONS: { id: ThunderGodPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶原瓶与既往原记录', description: '本人核对真实晋升、失败原瓶、天灾三份报告与反思。同一原湾的水、闸、浮标与轮具保留当前状态，诺拉过去消耗的精力不恢复；旧人物的死亡、投降与未接触状态不改写。' },
  { id: 'LOCATE_TARGET', title: '核定已见目标、本人护片与有限视线', description: '亲自核对原小湾十二米边界、固定目标位置及本人护片的登记方式。能力只为随后一次真实放电或本人冲击留下短暂窗口；条件改变须重新观察，开窗成功不等于实际应用，也不提前取得未来许可。' },
  { id: 'MARK_RETURN', title: '走查停止、收物与普通返回路线', description: '本人走查原小湾十二米通路和湾外平台四米入口。每次接触重新确认许可，撤回后停止新能力，普通清罩、收回同一原靶与护片，再沿开放路线离开。专业支持只处理本次服药排异，已付费用与行动不退。' },
];
export const THUNDER_GOD_ABILITIES: { id: ThunderGodAbilityId; label: string; description: string }[] = [
  { id: 'tyrant.s1.guided-thunder', label: '雷势引导', description: '支付8灵性与2精神，感知18。只对亲眼定位、当前可见的同一原靶开启30秒窗口，为随后独立的意志18放电检定加10。真实命中才在原靶留下痕迹并磨损5耐久；开窗或未用窗口不增掌握。实战只帮助同一已见目标上的随后一次真实威胁攻击，不能追溯过去或保证命中。' },
  { id: 'tyrant.s1.storm-brace', label: '风雷护持', description: '支付6灵性与2精神，意志18。须登记并实际佩戴本人的原护片，为随后一次已声明的小规模超自然冲击开启30秒窗口。释放冲击始终磨损护片10耐久；有效护持防止本次5健康损失并只记一次实际应用。实战只减轻随后一次可见身体效果30，不能抵消精神压力。遮挡、到时、条件变化或撤回后旧窗口失效。' },
];
export const THUNDER_GOD_INHERITED_ABILITIES = [
  ['tyrant.s9.aquatic-affinity', '水生亲和与幻鳞', '只在真实水域使用既有水中活动能力，仍须核对水情与退路。'],
  ['tyrant.s9.physique', '水手体魄', '对真实对象发挥体魄，有限冲击仍会造成伤害。'],
  ['tyrant.s9.balance', '船上平衡', '在当前实际支撑面上保持平衡，不自动闪避。'],
  ['tyrant.s8.fury', '怒意爆发', '短时力量与速度仍须实际结算、成本与抵抗。'],
  ['tyrant.s8.impact-resilience', '抗冲击', '有限减轻实际身体冲击，不提供完全免伤。'],
  ['tyrant.s7.navigation', '航海直觉', '依真实风、水流与可观察条件判断有限航路。'],
  ['tyrant.s7.water-control', '有限控水', '仍需当前真实且可用的水源，不在干地造水。'],
  ['tyrant.s7.water-binding', '水缚与水膜', '使用实际水源并分别结算控制与抵抗。'],
  ['tyrant.s6.wind-control', '有限控风', '只对当前有限范围内的实际对象施力。'],
  ['tyrant.s6.wind-blade', '风刃', '有限攻击保留灵性成本、视线与抵抗。'],
  ['tyrant.s6.short-flight', '短程借风飞行', '真实移动仍须支付代价并核对起落位置。'],
  ['tyrant.s5.sea-song', '有限海洋歌声', '精神作用会被抵抗，不能保证旁人免受影响。'],
  ['tyrant.s5.shallow-lightning', '浅层雷击', '有限超自然雷击须独立结算，不保证命中。'],
  ['tyrant.s5.deep-water-activity', '较长水下活动', '仍需真实水域与适当条件，不提供无限潜水。'],
  ['tyrant.s4.sea-tornado', '海水龙卷', '须当前真实海水，旧湾不会因战斗被复制。'],
  ['tyrant.s4.surge-control', '有限强浪', '须真实相连水体及原有有限范围。'],
  ['tyrant.s4.great-lightning', '强力闪电', '实际支付灵性并结算有限威胁与抵抗。'],
  ['tyrant.s3.sea-domain', '有限海域控水', '仍受实测边界与当前海水限制。'],
  ['tyrant.s3.remote-tempest', '有限遥距风力', '只作用当前实际观察且可到达的有限对象。'],
  ['tyrant.s3.water-recollection', '平静水面有限过往', '有限片段须真实原水与后续核验。'],
  ['tyrant.s2.storm-field', '有限风浪场', '同一原湾水与当前许可仍是前提。'],
  ['tyrant.s2.water-pressure', '原水有限压力', '只用当前开放水道中的同一原水，不能免费补水。'],
].map(([id, label, description]) => ({ id: id!, label: label!, description: description! }));
export const THUNDER_GOD_CONSUMPTION_RISK = '天灾消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。分别完成三项1行动专业准备，再付1行动与150便士检查当周场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与本次准备均耗尽，专业支持只把本次排异后的健康与精神保底到1。成功四属性各+1，原22项掌握和天灾消化100留存，两项新掌握从0开始；灵性上限120且当前不补满。性别、姓名、年龄、性格与取向不变，旧伤须普通休养。原湾水量、闸与轮具损耗、诺拉原精力均保留，不复制、修复或补充。最初三瓶失败后，可实付1行动与120便士调查同一原特性，隔真实一周再付1行动回原处封存交接；新普通药物900便士或五项新劳动后90便士，原特性总量不增加。另可在当周已检查的同一场地为指定未服瓶支付60便士、8灵性、6精神，获得仅本瓶本周有效的意志+13支持；离场、跨周或服用即失效，仍可失败。';

export const THUNDER_GOD_RECOVERY_SCHEMA_VERSION = 215;
export const THUNDER_GOD_RECOVERY_SITE_ID = 'BACKLUND_ORIGINAL_COVE_EXIT' as const;
export const THUNDER_GOD_PROMOTION_STABILITY = { cash: 60, spirituality: 8, mind: 6, bonus: 13 } as const;
