import { KNOWLEDGE_MENTOR_GUIDE } from '../knowledge-mentor/content.js';
import type { CivilizationEnlightenerAbilityId, CivilizationEnlightenerPreparationId } from './types.js';

/** Canon verifies the S1 name 文明启蒙者, not a complete formula, ritual, or
 * ordinary S1 ability specification. Industrial revolution was a digestion
 * experience, not this promotion ritual; the god's civilization painting is
 * unavailable. All finite workshop powers, costs and checks below are original
 * game design. Provenance belongs here, never in player-facing labels. */
export const CIVILIZATION_ENLIGHTENER_GUIDE = KNOWLEDGE_MENTOR_GUIDE;
export const CIVILIZATION_ENLIGHTENER_PRICES = { guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100, recovery: 120, recoveryDrug: 900, recoveryLabourBalance: 90 } as const;
export const CIVILIZATION_ENLIGHTENER_MIN_KNOWLEDGE_MENTOR_WEEKS = 12;
export const CIVILIZATION_ENLIGHTENER_LABOUR_STEPS = 5;
export const CIVILIZATION_ENLIGHTENER_BOTTLE_IDS = ['civilization-enlightener-potion-1', 'civilization-enlightener-potion-2', 'civilization-enlightener-potion-3'] as const;
export const CIVILIZATION_ENLIGHTENER_FORMULA_STATUS = '原指导者介绍独立封存的文明启蒙者成品魔药。本人核对通识者至知识导师的八阶原瓶、三份实际报告与反思，检查原工作台的有限诊断和普通操作教学边界，亲自走查停止及普通返回路线。三项准备分别完成后，另付费检查当周服药场地，最后独立确认饮用所选原瓶。';
export const CIVILIZATION_ENLIGHTENER_SOURCE_STATUS = '工艺析解只能辨识眼前已经观察的具体工序或缺陷，诊断之后仍须本人用真实工具与材料工作。操作启示只帮助愿意学习的成年人理解一项已经示范的普通操作，仍须由对方独立尝试；当前同意可以撤回，失败与真实费用保留。';
export const CIVILIZATION_ENLIGHTENER_POTION_SOURCES = CIVILIZATION_ENLIGHTENER_BOTTLE_IDS.map((id, index) => ({ id, source: `${CIVILIZATION_ENLIGHTENER_GUIDE}介绍的独立供货处初始批次第${index + 1}瓶序列1文明启蒙者成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回以前已耗尽的原瓶。` }));
export const CIVILIZATION_ENLIGHTENER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const CIVILIZATION_ENLIGHTENER_PREPARATIONS: { id: CivilizationEnlightenerPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对八阶原瓶与三份旧报告', description: '本人读取八阶真实晋升、失败原瓶及知识导师三份实际报告与反思，核对本人旧伤、全部原掌握、旧园和旧人的实际结局。原物制造记录与真实当前储能分别查验。' },
  { id: 'CHECK_LIMITS', title: '检查有限诊断与普通教学边界', description: '本人核对眼前原工序和实际缺陷。分析只提供有限线索，修理需要真实工具、材料与工作；教学需要当前成年人自愿参与、本人先示范和对方独立尝试，撤回立即生效。' },
  { id: 'MARK_EXIT', title: '走查原手柄与普通返回路线', description: '本人检查原工作台、既有手动停机柄和两米通路，演练停止负载、亲手收回原物并走回家。专业支持只应对本次服药排异，已付费用和行动不退。' },
];
export const CIVILIZATION_ENLIGHTENER_ABILITIES: { id: CivilizationEnlightenerAbilityId; label: string; description: string }[] = [
  { id: 'paragon.s1.process-analysis', label: '工艺析解', description: '观察实际原件后支付6灵性与2精神，知识18。一次分析只能识别本次可见磨损或待发生机械动作，失败仍付费；诊断不会修复、充能或创造材料。战斗每轮至多一次，成功仅削减一个仍未发生的已观察机械动作30威力。' },
  { id: 'paragon.s1.operational-guidance', label: '操作启示', description: '本人先示范一项普通操作，在对方当前愿意学习并同意时支付8灵性与3精神，知识20。对方随后独立尝试并可能失败；不赋予非凡能力。战斗每轮至多一次，有限自我操作窗口只为之后一次真实可用的原动作提供25威力，未应用便失效。' },
];
/** Plain descriptions avoid leaking predecessor provenance labels while retaining exact original IDs. */
export const CIVILIZATION_ENLIGHTENER_INHERITED_ABILITIES = [
  ['paragon.s9.memory', '记忆', '沿用实际记忆训练。'], ['paragon.s9.learning', '学习', '沿用实际学习经历。'], ['paragon.s9.practice', '实践', '沿用亲手完成的实践。'],
  ['paragon.s8.ancient-history', '古代知识', '保留已经学会的有限历史知识。'], ['paragon.s8.wilderness', '野外行动', '保留原野外行动经验。'], ['paragon.s8.ruin-caution', '遗迹警戒', '沿用原遗迹观察与警戒。'],
  ['paragon.s7.appraisal', '器物鉴定', '只依靠已有鉴定经历。'], ['paragon.s7.hazard-insight', '危险辨识', '辨识已有线索支持的风险。'], ['paragon.s7.cautious-use', '谨慎使用', '沿用已实际掌握的使用方式。'],
  ['paragon.s6.mechanical-craft', '机械工艺', '制造需要真实材料、工具和工作。'], ['paragon.s6.spiritual-craft', '灵性工艺', '沿用有限真实工艺和原消耗。'], ['paragon.s6.ritual-fixation', '仪式固化', '保留实际掌握与原材料限制。'],
  ['paragon.s5.precision-focus', '精准专注', '沿用本人实际观测与专注。'], ['paragon.s4.animate-made-object', '驱动原造物', '只驱动本人已有且具实际储能的原件。'], ['paragon.s4.direct-creation', '指挥原造物', '指挥真实存在的原件，储能与耐久照常耗用。'],
  ['paragon.s3.bounded-analysis', '有限分析', '只分析真实观察过的有限结构。'], ['paragon.s3.construct-coordination', '原件协作', '仅协调真实原盒与原架，实际资源必须足够。'],
  ['paragon.s2.protocol-binding', '有限工序封装', '需要真实可用指令片及两原件储能，原失败与已耗片保留。'], ['paragon.s2.bounded-calibration', '现场有限校准', '有限校准窗口只影响之后真实可用的原件动作，不修复或补能。'],
].map(([id, label, description]) => ({ id: id!, label: label!, description: description! }));
export const CIVILIZATION_ENLIGHTENER_CONSUMPTION_RISK = '知识导师消化100、实际晋2后12整周、健康>20且精神>40。分别完成三项1行动专业准备，再付1行动与150便士检查当周场地。0行动独立确认服所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与本次准备均耗尽，专业支持只把本次排异后的健康与精神保底到1。成功四属性各+1、原19项掌握与知识导师消化100留存，两项新掌握从0开始；上限120且当前灵性不补满。旧伤须正常诊疗休养，原物不充能，身体性别不改变。最初三瓶全部失败后，须付1行动与120便士调查指定原瓶遗留的同一份特性；至少跨一真实周再花1行动回原处核验封存。新普通药物和调配服务另付900便士，完成五项新劳务后90便士。旧失败和费用保留，未增加原特性。';
