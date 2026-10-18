import { WISDOM_ANGEL_GUIDE } from '../wisdom-angel/content.js';
import type { AllKnowingEyeAbilityId, AllKnowingEyePreparationId } from './types.js';

/** The S1 name/mapping remains an unverified cross-chain inference. Complete
 * canon formula and ritual are unknown. This finite finished-bottle channel,
 * professional preparation, abilities, people and numerical parameters are
 * original game design; none establishes omniscience or unknown canon powers. */
export const ALL_KNOWING_EYE_GUIDE = WISDOM_ANGEL_GUIDE;
export const ALL_KNOWING_EYE_PRICES = { guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100, recovery: 120, recoveryDrug: 900, recoveryLabourBalance: 90 } as const;
export const ALL_KNOWING_EYE_RECOVERY_SCHEMA_VERSION = 211;
export const ALL_KNOWING_EYE_RECOVERY_SITE_ID = 'BACKLUND_ORIGINAL_READING_ROOM_EXIT' as const;
export const ALL_KNOWING_EYE_MIN_WISDOM_ANGEL_WEEKS = 12;
export const ALL_KNOWING_EYE_LABOUR_STEPS = 5;
export const ALL_KNOWING_EYE_BOTTLE_IDS = ['all-knowing-eye-potion-1', 'all-knowing-eye-potion-2', 'all-knowing-eye-potion-3'] as const;
export const ALL_KNOWING_EYE_FORMULA_STATUS = '塞缪尔介绍独立封存的全知之眼成品魔药。当前渠道只交付成品，服用前须完成专业准备：核对阅读者至智慧天使八阶原瓶、三份实际报告与反思，写明亲眼观察到的条件和检验方式，再亲自走查停止、还物与返回路线。三项准备完成后，另付费检查当周场地，再独立确认饮用所选原瓶。';
export const ALL_KNOWING_EYE_SOURCE_STATUS = '玛拉的原资料室、两张原纸和已耗尽的示范器保留。每次借阅重新取得她的许可；41岁的技师伊蕾娜·韦尔带来自己有偿提供的无动力滑块和止挡块，手动控制移动。现场洞察只帮助随后一次独立核验；先机预判只帮助尚未发生的一次接取。改变方向、遮住视线、到时或撤回许可后，旧窗口停止；仍可普通对照、停下、拾取、还物并步行离开。';
export const ALL_KNOWING_EYE_POTION_SOURCES = ALL_KNOWING_EYE_BOTTLE_IDS.map((id, index) => ({ id, source: `${ALL_KNOWING_EYE_GUIDE}介绍的独立供货处初始批次第${index + 1}瓶序列1全知之眼成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回以前已耗尽的原瓶。` }));
export const ALL_KNOWING_EYE_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const ALL_KNOWING_EYE_PREPARATIONS: { id: AllKnowingEyePreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶原瓶与既往原记录', description: '本人核对真实晋升、失败原瓶、智慧天使三份报告与反思。两张纸仍是同一原件，最初阅读周与原文保留；耗尽的示范器、旧微光片与材料不会恢复，旧人物的结局不变。' },
  { id: 'RECORD_CONDITIONS', title: '写明观察条件与实际检验方式', description: '把实际见过的有限条件与尚未核实的解释分开。能力窗口只作用于随后一次独立核验或尚未发生的动作；条件改变须重新观察，成功开窗不等于实际应用。' },
  { id: 'MARK_RETURN', title: '走查停止、还物与普通返回路线', description: '本人走查原资料室四米通路和庭院四米入口。每次接触重新确认许可，撤回后停止新能力，手动停止滑块、归还原纸和器具，再沿开放路线离开。专业支持只处理本次服药排异，已付费用与行动不退。' },
];
export const ALL_KNOWING_EYE_ABILITIES: { id: AllKnowingEyeAbilityId; label: string; description: string }[] = [
  { id: 'reader.s1.bounded-insight', label: '现场洞察', description: '支付6灵性与2精神，知识18。只对本人实读的原纸和当前已见条件尝试判断，30秒内为随后一次独立核验加10。实战只帮助同一已见条件下随后一次自己的实际结算；不能重掷过去结果，失败或未应用不增加掌握。' },
  { id: 'reader.s1.pending-forecast', label: '先机预判', description: '支付8灵性与3精神，感知18。须实际看见待发滑块和通畅视线，30秒内为随后一次真实接取加10，移动仍由人手控制。实战只减少随后一次可见身体效果30，不能豁免精神压力；过期、遮挡、条件变化或撤回即取消未用窗口。' },
];
export const ALL_KNOWING_EYE_INHERITED_ABILITIES = [
  ['reader.s9.memory', '文本记忆', '保留本人亲自读过的有限文本及其来源。'],
  ['reader.s9.understanding', '阅读理解与学习', '比较实际读到的记录和条件，未知内容仍须核实。'],
  ['reader.s9.ritual-procedure', '仪式步骤辨识', '核对实际记录中的对象、步骤和未满足条件。'],
  ['reader.s8.observation', '细致观察', '辨认亲自在场且可访问的有限痕迹。'],
  ['reader.s8.deduction', '逻辑推理', '比较有证据的解释，再实际检验。'],
  ['reader.s8.ritual-specialism', '仪式专精', '仍须真实对象、材料、时间与许可。'],
  ['reader.s7.reconstruction', '有限现场重构', '只依据已经存在且实际核实的痕迹。'],
  ['reader.s7.combat-training', '格斗与武器基础', '使用实际持有的普通工具与武器。'],
  ['reader.s7.agility', '身体敏捷', '在可见且通行的实际空间调整步伐。'],
  ['reader.s6.analysis', '非凡能力辨析', '只分析亲眼见过且来源明确的有限样本。'],
  ['reader.s6.limited-imitation', '有限弱化模仿', '使用确已理解并学会的样本，保留失败与消耗。'],
  ['reader.s5.secret-ritual', '联系物秘术仪式', '须本人实际物品、当次许可和原仪式条件。'],
  ['reader.s5.material-imitation', '材料依托制造模仿', '旧微光片逐件保留，使用耗尽同一原件。'],
  ['reader.s4.fragmentary-foresight', '片段预见', '有限提示须后续核实，不保证安全。'],
  ['reader.s4.symbolic-interpretation', '意象解释', '解释可被真实事实否定，不替代调查。'],
  ['reader.s3.evidence-link', '有限证据关联', '只关联实读原件与亲眼观察的条件。'],
  ['reader.s3.method-analysis', '已见方法辨析', '须本场实际看见有限方法，仍保留成本和抵抗。'],
  ['reader.s2.conditional-synthesis', '条件综合', '依实读资料和当前已见条件形成待核验解释。'],
  ['reader.s2.observed-response', '已见方法应对', '只应对实际见过的有限方法，不读取未来动作。'],
].map(([id, label, description]) => ({ id: id!, label: label!, description: description! }));
export const ALL_KNOWING_EYE_CONSUMPTION_RISK = '智慧天使消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。分别完成三项1行动专业准备，再付1行动与150便士检查当周场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与本次准备均耗尽，专业支持只把本次排异后的健康与精神保底到1。成功四属性各+1，原19项掌握和智慧天使消化100留存，两项新掌握从0开始；灵性上限120且当前不补满。性别、姓名、年龄、性格与取向不变，旧伤须普通休养。原纸不复制，原示范器不充能，旧样本、微光片与材料不补充。最初三瓶均真实失败后，可付1行动与120便士，在原资料室出口当面取得玛拉本次许可，调查指定最新失败载体遗留的同一份原特性；隔一真实周再以1行动原处核验交接。新普通药液与调配另付900便士或五项新劳动后90便士，本次场地准备仍须150便士、1行动；旧费用、失败与原瓶全部保留，不增加第四份特性。';
