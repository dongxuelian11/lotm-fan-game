import { CONCEALMENT_SERVANT_GUIDE } from '../concealment-servant/content.js';
import type { MisfortuneKnightAbilityId, MisfortuneKnightPreparationId } from './types.js';

/** 厄难骑士 is attested; Darkness S1 is inferred from formula ordering, not
 * a direct numbered sentence. Formula, ritual and ordinary S1 abilities remain
 * unknown. The finite room activities below are original game mechanics. */
export const MISFORTUNE_KNIGHT_GUIDE = CONCEALMENT_SERVANT_GUIDE;
export const MISFORTUNE_KNIGHT_PRICES = { guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100 } as const;
export const MISFORTUNE_KNIGHT_MIN_CONCEALMENT_SERVANT_WEEKS = 12;
export const MISFORTUNE_KNIGHT_LABOUR_STEPS = 5;
export const MISFORTUNE_KNIGHT_BOTTLE_IDS = ['misfortune-knight-potion-1', 'misfortune-knight-potion-2', 'misfortune-knight-potion-3'] as const;
export const MISFORTUNE_KNIGHT_FORMULA_STATUS = '原指导者介绍独立封存的厄难骑士成品魔药。当前渠道只交付成品，服用前须完成专业准备。本人核对不眠者至隐秘之仆八阶原瓶、三份实际报告与反思，分别了解有限能力和随时停止的边界，亲自走查普通返回路线。三项准备完成后，另付费检查当周场地，再独立确认饮用所选原瓶。';
export const MISFORTUNE_KNIGHT_SOURCE_STATUS = '原六米房间、原门、原封签盒与纸页保留。艾琳和米洛分别决定是否授权本次原物与工具用途，并站在畅通出口。厄势导引只帮助随后一次真实接盒；隐夜护持只减轻随后一次校准轻载对本人手持木板的实际冲击。撤回或受阻后须普通停载、拾取、还物并沿原路离开。';
export const MISFORTUNE_KNIGHT_POTION_SOURCES = MISFORTUNE_KNIGHT_BOTTLE_IDS.map((id, index) => ({ id, source: `${MISFORTUNE_KNIGHT_GUIDE}介绍的独立供货处初始批次第${index + 1}瓶序列1厄难骑士成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回以前已耗尽的原瓶。` }));
export const MISFORTUNE_KNIGHT_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const MISFORTUNE_KNIGHT_PREPARATIONS: { id: MisfortuneKnightPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对八阶原瓶与三份旧报告', description: '本人核对真实晋升、失败原瓶、隐秘之仆三份报告与反思，以及原卷叶封存、派出和召回记录。旧人物的实际结局与已耗物品不改变。' },
  { id: 'CHECK_LIMITS', title: '核对待发生动作与护持边界', description: '只处理眼前尚未发生的有限动作；开窗本身不算应用，失败不改写过去。木板、托盘和倾斜板须有实际来源；物主、工具使用者和本人用力意愿分别确认。' },
  { id: 'MARK_EXIT', title: '走查原门与普通返回路线', description: '本人检查原六米房间和庭院至入口四十米通路，演练普通停载、拾取与归还。门受阻先停用能力再普通疏通；现场帮助只处理本次服药排异，费用和行动不退。' },
];
export const MISFORTUNE_KNIGHT_ABILITIES: { id: MisfortuneKnightAbilityId; label: string; description: string }[] = [
  { id: 'darkness.s1.guided-mishap', label: '厄势导引', description: '支付6灵性与2精神，意志18，30秒内为四米内一次尚未发生的原盒接取加10；失败或未实际接取不增加掌握。实战每轮至多一次，须观察到可见待发身体攻击及实际空地或托盘线，受抵抗后只减少该次未来冲击25。' },
  { id: 'darkness.s1.bounded-night-guard', label: '隐夜护持', description: '支付8灵性与3精神，知识18，须实际可用原木板；每次尝试消耗10耐久，失败也保留磨损。30秒内只减轻一次待发生的实际冲击，实战每轮至多一次减少30身体威力。不能抵消精神压力；过期、离开、门受阻或撤回即取消未用窗口。' },
];
export const MISFORTUNE_KNIGHT_INHERITED_ABILITIES = [
  ['darkness.s9.night-vision', '夜视', '依照实际环境辨认有限暗处线索。'], ['darkness.s9.night-vigor', '夜间精力', '保留实际疲劳、灵性与受伤限制。'], ['darkness.s9.danger-sense', '危险直觉', '只提供有限危险线索，不保证安全。'],
  ['darkness.s8.poetry', '午夜诗歌', '对真实目标施加有限影响，使用原成本。'], ['darkness.s8.physical-training', '体能训练', '保留原身体与实际训练结果。'],
  ['darkness.s7.dream-entry', '入梦', '须真实可接触目标与原有施术条件。'], ['darkness.s7.dream-discernment', '梦境辨识', '只辨识实际梦境线索，不改写记忆。'],
  ['darkness.s6.spirit-sight', '灵视', '观察实际存在的灵性线索。'], ['darkness.s6.spirit-pacification', '灵性安抚', '须真实对象，不凭空制造或控制灵体。'],
  ['darkness.s5.spirit-shelter', '灵体庇护', '须同一原卷叶真实可用，并保留原成本。'], ['darkness.s5.spirit-assistance', '原灵协助', '只调用已实际取得且未失去的原卷叶。'], ['darkness.s5.spirit-coordination', '灵体协调', '派出与召回都在同一原卷叶记录中发生。'],
  ['darkness.s4.limited-misfortune', '有限厄运', '只影响原规则允许的有限局部动作。'], ['darkness.s4.area-dream', '区域入梦', '作用于实际范围和真实目标，保留精神消耗。'],
  ['darkness.s3.dark-dissolution', '黑暗消融', '只有原规则支持的实际目标可受影响。'], ['darkness.s3.sleep-fear', '睡眠与恐惧', '作用于真实精神，受抵抗和资源条件限制。'],
  ['darkness.s2.bounded-concealment', '有限隐秘', '暂时遮蔽有限原场，不删除身体、所有权或历史。'], ['darkness.s2.trace-veil', '有限遮踪', '只延迟实际存在的弱检索，不凭空创造灵体。'],
].map(([id, label, description]) => ({ id: id!, label: label!, description: description! }));
export const MISFORTUNE_KNIGHT_CONSUMPTION_RISK = '隐秘之仆消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。分别完成三项1行动专业准备，再付1行动与150便士检查当周场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与本次准备均耗尽，专业支持只把本次排异后的健康与精神保底到1。成功四属性各+1，原18项掌握和隐秘之仆消化100留存，两项新掌握从0开始；灵性上限120且当前不补满。性别、姓名、年龄、性格与取向不变，旧伤须普通休养。原人、卷叶和旧材料不补充。全部原瓶失败后须付1行动与100便士申请下一批，至少跨一真实周才有新瓶到货。';
