import type { TimeWormAbilityId, TimeWormPreparationId } from './types.js';

/** L238467 names Error S1 Time Worm. L243580–584 supports short theft of
 * time, anchors and authority, without a universal numerical limit. This
 * scene supplies only one consenting adult's real forthcoming ordinary look;
 * it supplies no anchor or authority. The complete formula and promotion
 * ritual remain unverified. Finished-potion supply, professional preparation
 * and the paid/checkable three-second scene are bounded original gameplay. */
export const TIME_WORM_GUIDE = '贝克兰德时之虫独立成品交接处';
export const TIME_WORM_PRICES = { guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100 } as const;
export const TIME_WORM_MIN_FATE_TROJAN_WEEKS = 12;
export const TIME_WORM_LABOUR_STEPS = 5;
export const TIME_WORM_BOTTLE_IDS = ['time-worm-potion-1', 'time-worm-potion-2', 'time-worm-potion-3'] as const;
export const TIME_WORM_FORMULA_STATUS = '交接处供应分别封存的时之虫成品魔药。服用前先核对偷盗者至命运木马的八阶原瓶、三份实际报告与反思，写明一次尚未发生的查看动作，再走查停止和普通返回路线。三项专业准备分别完成后，另付费检查当周场地，再独立确认饮用所选原瓶。';
export const TIME_WORM_SOURCE_STATUS = '莉娜、维克托与同一登记室、原柜和原包裹保留当前状态。每案重新征得两位成人的许可。维克托在门外原包旁声明一次尚未执行的查看，莉娜在登记桌旁见证，本人与目标相距四米。短时窃取只推迟这一次动作三秒；暂存时段只能用于自己随后一次实际核对。到期、停止或撤回都不会退回已经流逝的时间、已付费用或伤势，所有人最终沿普通路离开。';
export const TIME_WORM_POTION_SOURCES = TIME_WORM_BOTTLE_IDS.map((id, index) => ({ id, source: `${TIME_WORM_GUIDE}初始批次第${index + 1}瓶序列1时之虫成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装旧命运木马原瓶，也不补回以前耗尽的原瓶。` }));
export const TIME_WORM_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const TIME_WORM_PREPARATIONS: { id: TimeWormPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶原瓶与既往记录', description: '本人核对八阶真实晋升、失败原瓶、命运木马三份报告与反思。原身份联系已经归还，唯一搬运已经履行并结清12便士，原包不复制，原封签仍属于莉娜。托马斯保持自主，旧敌人的身体与结局不重置。' },
  { id: 'DECLARE_PENDING_ACTION', title: '写明尚未发生的动作与有限时段', description: '分别记录维克托自己的新查看意向、当前视线、四米距离和三秒延迟。只能针对尚待执行的一次真实动作，不能窃取已经结束的动作或重试同一声明。自己暂存的同一时段须真实使用，不能变成周行动、额外物资或重新结算旧结果。' },
  { id: 'PLAN_RETURN', title: '走查停止与普通返回路线', description: '本人检查登记桌、入口和门外的普通路线。每次尝试重新确认两位成人的许可；撤回后停止新施术并销毁未用时段，目标仍须等已经成立的延迟到期或取消查看。每个人真正步行离开，原柜、身份、包裹和已结报酬保持原状。专业支持只处理本次服药排异，已付费用与行动不退。' },
];
export const TIME_WORM_ABILITIES: { id: TimeWormAbilityId; label: string; description: string }[] = [
  { id: 'error.s1.short-time-theft', label: '短时窃取', description: '支付8灵性与2精神，感知18。只对当前看见、尚未执行且获本次同意的一次查看尝试窃取短时段。施术实际过1秒，成功后目标须再等待3秒；失败也付成本，同一声明不能重试。自己仅暂存这同一3秒，目标真正延迟后执行才计掌握。实战只可能削弱下一次真实身体或精神作用30，不撤销已经发生的攻击。' },
  { id: 'error.s1.time-release', label: '暂存时段释放', description: '支付6灵性与2精神，意志18。只能使用自己实际取得、尚未用过且未到期的时段，施术实际过1秒，同一声明仅一次尝试。成功后在到期前亲自对同一原包标签做一次知识16核对，花1精力与1秒，获得8点检定辅助；实际检定才计应用。实战只为随后一次真实普通打击增加30。释放、到期、停止或撤回都不退回目标已经失去的时间。' },
];
/** Keep all fourteen actual source IDs; player labels omit development tags. */
export const TIME_WORM_INHERITED_ABILITIES = [
  ['error.s9.agility', '敏捷', '使用本人的实际身体移动和避让，仍受距离、障碍、精力与伤势影响。'],
  ['error.s9.dexterity', '灵巧', '只有原物真正可接触时才进行稳定手指和持握操作，不穿透封套或凭空取得原件。'],
  ['error.s9.theft', '偷取', '对眼前可接触的真实普通原物尝试取走；所有权、被注意和归还后果分别保留。'],
  ['error.s8.deceit', '骗术', '依据已知情境作有限误导，对方仍能核实、拒绝或识破，不改记忆和意愿。'],
  ['error.s7.decryption', '解密', '根据实际接触的材料和经历查找不一致，再与原记录核对；不会自动知道未知真相。'],
  ['error.s6.power-theft', '偷取非凡能力', '只对亲见且符合原条件的目标能力尝试窃取，来源、抵抗、实际结果和原主暂时受限分别记录。'],
  ['error.s6.borrowed-power', '有限借用所偷能力', '必须先真正偷到适用能力，再在原有效时段内支付成本使用；没有真实借用来源时不能施用。'],
  ['error.s5.thought-theft', '当前念头窃取与立即执行', '只能针对独立心智目标当下待执行的真实念头；成功后本人立即承担对应行动，不能凭念头获得物品或能力。'],
  ['error.s4.parasitism', '有限寄生与共享感官', '须有真实宿主和当前明确许可，按实际寄生程度处理感官与身体控制；托马斯当前自主，不附赠第二身体。'],
  ['error.s4.deferred-thought', '当前念头暂存与延后显现', '仅对实际取得的当前念头在原有限场景内选择执行或释放，原主的身体、人格和恢复决定仍须核实。'],
  ['error.s3.law-deceit', '规则欺瞒', '支付6灵性、知识18，只在真实原物和适用条件内尝试有限规律作用。已熄灭的原灯不重新燃起，耗尽的燃料不补回。'],
  ['error.s3.deep-deception', '深层欺瞒', '支付6灵性、知识18，对实际独立心智作有限注意偏移，对方可以识破。实战仅削弱一次作用30，不修改真实物品、记忆或长期同意。'],
  ['error.s2.identity-link', '身份关联', '只有适用的原身份联系与当前许可才可尝试暂接，原主受限与真实归还必须分别记录；已经归还的原柜联系不会再次免费取得。'],
  ['error.s2.fate-assumption', '命运承担', '只能承担事先存在的具体责任及其真实负担和报酬；同一原包搬运已完成，不能重开、免除代价或再领12便士。'],
].map(([id, label, description]) => ({ id: id!, label: label!, description: description! }));
export const TIME_WORM_CONSUMPTION_RISK = '要求命运木马消化100、从其实际晋升周起满12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动；另付1行动与150便士检查当周场地，再以0行动独立确认饮用所选原瓶，意志30。大成功晋升、精神−8；成功晋升、精神−15；失败仍为命运木马、健康−15精神−25排异+30；严重排异仍为命运木马、健康−25精神−45排异+60。原瓶与本次准备均耗尽；专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。成功四属性各+1，十四项旧掌握保持原值，两项新掌握从0开始，灵性上限120且当前不补满。姓名、性别、年龄、性格、取向、原伤势与旧人的结局不变。三瓶全部失败耗尽后，可花1行动与100便士申请下一批，至少跨一真实周再接收三瓶；各瓶费用与准备单独结算。';
