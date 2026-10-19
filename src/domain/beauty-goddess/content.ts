import { LIFE_GIVER_GUIDE } from '../life-giver/content.js';
import type { BeautyGoddessAbilityId, BeautyGoddessPreparationId } from './types.js';

/** Canon establishes Moon S1 美神 and the successful bodily transformation to
 * female. Complete formula, ritual and ordinary S1 ability specifications are
 * unknown. The porch, finite powers, checks and costs are original game design;
 * no divine Lilith power, forced love, personality rewriting or infinite life. */
export const BEAUTY_GODDESS_GUIDE = LIFE_GIVER_GUIDE;
export const BEAUTY_GODDESS_PRICES = { guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100, recovery: 120, recoveryDrug: 900, recoveryLabourBalance: 90 } as const;
export const BEAUTY_GODDESS_MIN_LIFE_GIVER_WEEKS = 12;
export const BEAUTY_GODDESS_LABOUR_STEPS = 5;
export const BEAUTY_GODDESS_BOTTLE_IDS = ['beauty-goddess-potion-1', 'beauty-goddess-potion-2', 'beauty-goddess-potion-3'] as const;
export const BEAUTY_GODDESS_FORMULA_STATUS = '原指导者介绍独立封存的美神成品魔药。本人核对药师至创生者的八阶原瓶、三份实际报告与反思，了解晋升成功后的女性身体以及能力的实际边界，亲自走查普通返回路线。三项准备分别完成，单独知情确认身体变化后，另付费检查当周服药场地，最后独立确认饮用所选原瓶。';
export const BEAUTY_GODDESS_SOURCE_STATUS = '辉映调息只帮助本人随后一次实际精细操作。月辉定形需要原灯的实际光线和一枚付费月片，只暂时稳定眼前尚未完成的具体动作。流灯与达莉娅各自决定是否参与，可以随时撤回；失效后仍能普通拾取、归还和离开，不改变任何人的爱意、思想或性格。';
export const BEAUTY_GODDESS_POTION_SOURCES = BEAUTY_GODDESS_BOTTLE_IDS.map((id, index) => ({ id, source: `${BEAUTY_GODDESS_GUIDE}介绍的独立供货处初始批次第${index + 1}瓶序列1美神成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回以前已耗尽的原瓶。` }));
export const BEAUTY_GODDESS_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const BEAUTY_GODDESS_PREPARATIONS: { id: BeautyGoddessPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对八阶原瓶与三份旧报告', description: '本人读取八阶真实晋升、失败原瓶及创生者三份实际报告与反思，核对旧伤、全部原掌握、原来客同一身体与声片、旧人的实际结局和已耗月珠。' },
  { id: 'CHECK_LIMITS', title: '了解身体变化与有限能力边界', description: '成功晋升时身体成为女性，原本女性保持女性；失败仍保留原身体。姓名、年龄、性格与取向不改写。本人调息与作用于他人的许可分开，原灯及月片都需要实际来源，不能凭空创造生命、物品或情感。此项学习不代替单独知情确认。' },
  { id: 'MARK_EXIT', title: '走查原遮板与普通返回路线', description: '本人检查玻璃暖房旁的两米通路和六十米普通回家路，演练关闭窗口、普通拾取并亲手归还原物。失败不强迫伤害来客；专业支持只应对本次服药排异，已付费用和行动不退。' },
];
export const BEAUTY_GODDESS_ABILITIES: { id: BeautyGoddessAbilityId; label: string; description: string }[] = [
  { id: 'moon.s1.self-poise', label: '辉映调息', description: '支付6灵性与2精神，意志18，为本人随后一次真实精细操作提供30秒的有限稳定窗口；生活操作加10，战斗每轮至多一次且只为随后一次实际可用原动作加25威力。失败、过期和未应用仍保留费用，不凭开窗获得掌握。' },
  { id: 'moon.s1.bounded-moonform', label: '月辉定形', description: '支付8灵性与3精神及一枚真实月片，感知18；原灯须实际点亮且遮板未挡光。生活中30秒内只稳定一次待完成的过渡或摆放，遮光或撤回许可即取消。战斗每轮至多一次，受对方抵抗，只减少一个尚未发生的可见身体攻击30威力，不抵消精神攻击。' },
];
/** Preserve every actual old skill ID, but keep internal provenance out of player prose. */
export const BEAUTY_GODDESS_INHERITED_ABILITIES = [
  ['moon.s9.pharmacy', '药物配制', '使用真实材料与原有药物，不能凭空治疗。'], ['moon.s9.aura-observation', '身体与气场观察', '观察眼前有限身体线索，不能绝对诊断。'], ['moon.s9.toxin-resistance', '毒素抗性', '保留原抗性，不获得无条件免疫。'],
  ['moon.s8.taming', '驯兽', '真实动物仍属于原主人，合作需要实际接触。'], ['moon.s8.animal-intent', '理解动物意图', '只理解实际观察支持的简单意图。'], ['moon.s8.physical-enhancement', '强健体魄', '保留原体魄与真实疲劳、受伤风险。'],
  ['moon.s7.blood-scent', '血气辨识', '依照实际存在的有限线索辨识。'], ['moon.s7.abyss-shackles', '深渊枷锁', '有限束缚真实目标，不控制思想。'], ['moon.s7.dark-wings', '黑暗之翼', '只沿真实可达路线有限移动。'], ['moon.s7.regeneration', '再生', '须有真实血食与原消耗，不能复活。'],
  ['moon.s6.support-potions', '有限辅助药剂', '分别使用真实原瓶及实际材料。'], ['moon.s6.potion-teaching', '药剂研究与教学', '依照原实际结果向自愿成年人说明。'],
  ['moon.s5.regional-moon', '区域月相', '只影响有限实际区域，不改变真实天体。'], ['moon.s5.moonlight-step', '月光化移动', '需要真实可达的落点和原消耗。'], ['moon.s5.moonlight-reassembly', '月光化重组', '保留原身体与资源条件，不复活。'],
  ['moon.s4.moon-paper-substitute', '月亮纸人', '只有实际准备且未耗尽的原纸才能使用。'], ['moon.s4.blood-moon-arrow', '血月之箭', '有限攻击真实可见、可达目标。'],
  ['moon.s3.bounded-summoning', '有限召唤之门', '须原来客当次愿意并沿已知两地移动同一身体。'], ['moon.s3.guest-cooperation', '来客有限合作', '同一原来客在场、自愿且实际精力足够才可合作。'],
  ['moon.s2.bounded-vitality', '有限活性支持', '须活着的同一原身体、自愿和实际未耗月珠。'], ['moon.s2.shared-shelter', '有限共同庇护', '只保护当前许可内的真实合作，消耗原月珠与实际资源。'],
].map(([id, label, description]) => ({ id: id!, label: label!, description: description! }));
export const BEAUTY_GODDESS_CONSUMPTION_RISK = '创生者消化100、实际晋2后12整周、健康>20且精神>40。分别完成三项1行动专业准备，单独知情确认成功后的女性身体，再付1行动与150便士检查当周场地。0行动独立确认服所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与本次准备均耗尽，专业支持只把本次排异后的健康与精神保底到1。只有成功才成为女性，原本女性仍为女性；失败身体不变，姓名、年龄、性格与取向不改变。成功四属性各+1、原21项掌握与创生者消化100留存，两项新掌握从0开始；灵性上限120且当前不补满。旧伤须正常休养，原来客和旧材料不补充。可以不服药并继续作为创生者生活。最初三份原特性固定，全部失败后可付1行动、120便士调查指定失败原瓶，隔一真实周另付1行动在原处回收同一份特性。每次新普通药物与调配服务另付900便士，或五项新劳动后90便士；当次场地检查仍需150便士。新载体不产生第四份特性，旧原瓶、费用与失败记录全部保留。';
