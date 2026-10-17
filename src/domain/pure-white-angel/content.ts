import { LIGHT_SEEKER_GUIDE } from '../light-seeker/content.js';
import type { PureWhiteAngelAbilityId, PureWhiteAngelPreparationId } from './types.js';

/** Source evidence: Pure White Angel S1 is jointly supported at L236405 and
 * L236478; Sun S0 is directly named at L48172–L48174/L48209. Aucuses' true-name
 * burning and the 3-0782 charm are not ordinary S1 abilities. Complete formula,
 * ritual, finite powers and all numerical rules below are original game design. */
export const PURE_WHITE_ANGEL_GUIDE = LIGHT_SEEKER_GUIDE;
export const PURE_WHITE_ANGEL_PRICES = { guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100 } as const;
export const PURE_WHITE_ANGEL_MIN_LIGHT_SEEKER_WEEKS = 12;
export const PURE_WHITE_ANGEL_LABOUR_STEPS = 5;
export const PURE_WHITE_ANGEL_BOTTLE_IDS = ['pure-white-angel-potion-1', 'pure-white-angel-potion-2', 'pure-white-angel-potion-3'] as const;
export const PURE_WHITE_ANGEL_FORMULA_STATUS = '米瑞尔·赫斯介绍独立封存的纯白天使成品魔药。当前渠道只交付成品，不提供可自行调配的完整配方。服用前须核对歌颂者至逐光者八阶原瓶、三份实际报告与反思，亲自确认采光廊中已有目标与遮挡，再走查停止、收物和返回路线。完成三项准备后，另付费检查当周服药场地，再独立确认饮用所选原瓶。';
export const PURE_WHITE_ANGEL_SOURCE_STATUS = '继续使用玛拉保管的同一六米采光廊。原遮板、油灯、遮罩、屏板和字牌保留。每案重新询问玛拉和43岁的技师伊文·梅罗，参与许可与施术许可分别记录；芦影也可明确拒绝本次来访。另行买下的一份超自然残留样本与本人护片各只有一件。净光定向只辅助随后一次实际清理；温光护持只保护本人随后一次已声明的小规模练习冲击。遮挡、到时或撤回使旧窗口失效，仍须普通停止、收物并步行离开。';
export const PURE_WHITE_ANGEL_POTION_SOURCES = PURE_WHITE_ANGEL_BOTTLE_IDS.map((id, index) => ({ id, source: `${PURE_WHITE_ANGEL_GUIDE}介绍的独立供货处初始批次第${index + 1}瓶序列1纯白天使成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回以前已耗尽的原瓶。` }));
export const PURE_WHITE_ANGEL_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const PURE_WHITE_ANGEL_PREPARATIONS: { id: PureWhiteAngelPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶原瓶与既往记录', description: '本人核对真实晋升、失败原瓶、调配材料、仪式及逐光者三份报告与反思。原采光廊物件与玛拉、芦影保留当前状态；过去人物的伤势、死亡、投降与离场不改写。' },
  { id: 'VERIFY_TARGET', title: '核对原目标与有限作用范围', description: '亲自核对六米采光廊、三米处原遮板与本人护片的登记方式。能力只开启随后一次真实清理或本人冲击的短暂窗口；条件改变须重新观察，成功开窗不等于实际应用，也不提前取得未来许可。' },
  { id: 'PLAN_RETURN', title: '走查停止、收物与普通返程', description: '本人走查采光廊通路和廊外四米前庭。每案重新确认许可，撤回后停止新能力；亲手处理原遮板、收回同一样本与护片，再沿开放普通路线离开。专业支持只处理本次服药排异，已付费用与行动不退。' },
];
export const PURE_WHITE_ANGEL_ABILITIES: { id: PureWhiteAngelAbilityId; label: string; description: string }[] = [
  { id: 'sun.s1.focused-purification', label: '净光定向', description: '支付8灵性与2精神，意志18。对近距离观察过、当前无遮挡的同一原样本开启30秒窗口，为随后独立的意志18清理检定加10。成功实际清理才把该样本的一份超自然残留减为零，不能复制或重新填充；只开窗不增掌握。实战只帮助同一已见目标上随后一次真实威胁攻击加30，不保证命中。' },
  { id: 'sun.s1.warm-radiance-guard', label: '温光护持', description: '支付6灵性与2精神，知识18。须实际佩戴原护片并声明本人的小规模练习冲击，开启30秒窗口。释放冲击始终磨损护片10耐久；有效护持防止本次5健康损失，并只记录一次实际应用。实战只减轻随后一次可见身体效果30，不能抵消精神压力。遮挡、到时、条件变化或撤回使旧窗口失效。' },
];
export const PURE_WHITE_ANGEL_INHERITED_ABILITIES = [
  ['sun.s9.praise', '歌颂', '原有歌颂须实际表现并尊重旁人当前意愿。'],
  ['sun.s9.courage', '勇气鼓舞', '有限鼓舞仍有真实对象和条件，不能替人决定。'],
  ['sun.s8.light', '制造光亮', '只照亮真实可达范围；遮挡和灵性成本保留。'],
  ['sun.s8.solar-flame', '太阳火焰', '有限超自然火焰仍须支付成本并独立结算抵抗。'],
  ['sun.s8.ritual', '祈光仪式', '只使用已掌握的实际仪式条件，不凭空取得符咒或材料。'],
  ['sun.s7.holy-light', '神圣之光', '有限照射保留真实视线、成本与抵抗。'],
  ['sun.s7.sacred-oath', '神圣誓言', '誓言仍须当前自愿的本人确认，不能强加承诺。'],
  ['sun.s7.sun-aura', '太阳光环', '当前作用范围内的对象和风险仍须逐一核对。'],
  ['sun.s7.holy-water', '圣水制备', '只使用实际持有的原材料与存量，不凭空补充圣水。'],
  ['sun.s6.notarization', '公证', '只对有限已知事项结算实际效果，不自动保证真假。'],
  ['sun.s6.signed-contract', '签订契约', '需当事人的真实同意及现有原物，旧契约不会重开。'],
  ['sun.s5.holy-light', '强化圣光', '有限光照仍会受遮挡，不使友善灵体自动免疫。'],
  ['sun.s5.purification-aura', '净化光环', '须核对实际范围、污染对象与旁人风险，不能任意净化灵魂。'],
  ['sun.s4.unshadowed-domain', '无暗领域', '只在当前有限范围内结算；不穿透不透明遮挡或制造无限安全。'],
  ['sun.s4.purification', '净化', '对实际可作用的有限目标独立结算成本与抵抗。'],
  ['sun.s4.sunflare', '太阳耀斑', '有限超自然攻击保留自身代价、视线及对手抵抗。'],
  ['sun.s3.shared-radiance', '共照', '仍须现有参与者的当次意愿与实际站位。'],
  ['sun.s3.clarity-mark', '明辨记号', '对已观察对象留下有限记号，不揭示未知秘密。'],
  ['sun.s2.guided-radiance', '定向辉光', '只照向已知且光路通畅的同一目标，实际成本与抵抗继续结算。'],
  ['sun.s2.limited-light', '限光', '只对有限的当前光效起作用，不能代替身体护持或精神防护。'],
].map(([id, label, description]) => ({ id: id!, label: label!, description: description! }));
export const PURE_WHITE_ANGEL_CONSUMPTION_RISK = '逐光者消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。分别完成三项1行动专业准备，再付1行动与150便士检查当周场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与本次准备均耗尽，专业支持只把本次排异后的健康与精神保底到1。成功四属性各+1，原20项掌握和逐光者消化100留存，两项新掌握从0开始；灵性上限120且当前不补满。性别、姓名、年龄、性格与取向不变，旧伤须普通诊疗与休养。原廊物件损耗与玛拉、芦影精力均保留，不复制、修复或补充。全部原瓶失败后须付1行动与100便士申请下一批，至少跨一真实周才有新三瓶到货。';
