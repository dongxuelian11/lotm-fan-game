import { CHAOS_HUNTER_GUIDE } from '../chaos-hunter/content.js';
import type { BalancerAbilityId, BalancerPreparationId } from './types.js';

/** Canon boundary: L194714 and L200569 name S2 平衡者, followed by S1 秩序之手.
 * L200547 is an individual local-anomaly observation; L200567–569 is an
 * individual finite light-resistance scene. Full formula and ritual are unknown.
 * Every numerical cost, range, window, procedure, scene and reward below is
 * original game design, not a complete canonical power catalogue. No universal
 * knowledge, equalize-all effect, teleportation or brass-book power is granted. */
export const BALANCER_GUIDE = CHAOS_HUNTER_GUIDE;
export const BALANCER_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const BALANCER_MIN_CHAOS_HUNTER_WEEKS = 12;
export const BALANCER_LABOUR_STEPS = 5;
export const BALANCER_BOTTLE_IDS = ['balancer-potion-1', 'balancer-potion-2', 'balancer-potion-3'] as const;
export const BALANCER_FORMULA_STATUS = '薇娜·贝尔介绍独立封存的平衡者成品魔药。须核对本人仲裁人至混乱猎手的七阶原瓶与既往报告，检查局部失衡感知和有限抗御的使用边界，并实际走查本次服药处的普通出口。三项准备完成后，另行付费检查当周安静房间，再独立确认饮用所选原瓶。';
export const BALANCER_SOURCE_STATUS = '晋升后回到原净空标线演练房，薇娜·贝尔、43岁米拉·佩恩、350克封包、原标条和原纸保持各自身份。只能核对眼前有限范围的实际偏移或遮挡；抗御只处理本人接下来一次可见的轻微实体冲量，须真实承受并检查后果。逐案重新取得同意，撤回即停止新输入，原物仍须亲手归还、本人普通步行离场。已发生的行走、碰撞、伤势和原埃德里克的投降继续保留。';
export const BALANCER_POTION_SOURCES = BALANCER_BOTTLE_IDS.map((id, index) => ({
  id, source: `${BALANCER_GUIDE}介绍的专业交接处初始批次第${index + 1}瓶序列2平衡者成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回过去已耗尽的原瓶。`,
}));
export const BALANCER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const BALANCER_PREPARATIONS: { id: BalancerPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对七阶原瓶与既往记录', description: '本人核读仲裁人至混乱猎手的七阶真实晋升、原瓶耗尽与旧报告，核对薇娜、米拉、原封包、原标条、原纸及罗温、埃德里克的实际记录。旧伤、拒绝与撤回、人物生死、原物去向和已有掌握继续保留。' },
  { id: 'CHECK_LIMITS', title: '检查局部感知与有限抗御边界', description: '感知只核对四米内可见的实体偏移或遮挡，遮住的细节仍须实际查看。抗御只为本人接下来一次可见轻微实体冲量预备三十秒窗口；不叠加、不替代实际护具，不保证免伤。逐案同意可撤回，停止即清除未用效力，已付成本、真实伤势及原物磨损不回退。' },
  { id: 'MARK_EXIT', title: '标明原物归还与普通出口', description: '本人走查原安静房和净空标线演练房，核对原门口至A四米、A至B四米的普通路线。原封包、原标条与原纸各只有一个，接触后须亲手归还，米拉自主回到A，本人和薇娜带回原物并沿原路离场。退出不退款、不治疗或传送，专业照护只处理本次服药排异。' },
];
export const BALANCER_ABILITIES: { id: BalancerAbilityId; label: string; description: string }[] = [
  { id: 'justiciar.s2.imbalance-sensing', label: '局部失衡感知', description: '核对四米内眼前实际的实体偏移或遮挡。耗1行动、5灵性、2精神，感知难度20；失败总计损4精神。同案只付费尝试一次；成功遇到遮挡也只确认遮挡，须随后亲眼检查原物，不能读取隐藏位置或保证以后判断。只有真实成功应用才增长掌握。' },
  { id: 'justiciar.s2.measured-resistance', label: '有限抗御', description: '为本人接下来一次可见轻微实体冲量预备抗御。耗1行动、6灵性、2精神，知识难度20；失败总计损4精神。成功窗口30秒、不叠加、只用一次；须实际持有已花30便士取得的唯一护板。演练真实冲量在成功抗御时损2健康，否则损5健康；每次实际冲量使同一护板磨损15。普通安全支撑不损健康或护板，也不奖掌握。停止、撤回、过期不退成本，旧伤与磨损保留。' },
];
export const BALANCER_CONSUMPTION_RISK = '混乱猎手消化100、实际晋升后12整周、三份旧生活报告与反思完成，健康>20、精神>40。三项专业准备各1行动，当周另1行动140便士检查服药场地，0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和当次场地准备耗尽；专业支持仅将这次药物排异后的健康、精神保底到1，普通死亡及战斗照常结算。失败保留旧经历和三项准备，休养后须筹新原瓶并重做当周检查。成功四属性各+1，旧15项掌握与七阶消化保留，两项新掌握从0开始，共17项；灵性上限120，当前不补满。身体、性别、旧伤、原人物生死与原物去向不改写。';
export const BALANCER_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  { id: 'justiciar.s9.authority', label: '仲裁威严', description: '保留原有有限威慑与当前许可，独立心智仍可拒绝，不因晋升获得普遍服从。' },
  { id: 'justiciar.s9.persuasive-charisma', label: '说服魅力', description: '根据已见事实交流，对方仍能拒绝，不改写原记录或凭空制造证据。' },
  { id: 'justiciar.s9.combat-training', label: '战斗训练', description: '由同一本体实际击打，原伤、距离和成本继续有效，原行动只结算一次。' },
  { id: 'justiciar.s8.trace-sensing', label: '痕迹感知', description: '核对当前可查的有限痕迹，未见事实仍须实际调查，不获得全知。' },
  { id: 'justiciar.s8.image-reconstruction', label: '影像还原', description: '沿原证据与来源有限还原，不能据此改写过去或断言尚未查明的事实。' },
  { id: 'justiciar.s7.mental-puncture', label: '精神穿刺', description: '对实际可及目标作有限精神攻击，支付原成本、结算真实抵抗，不保证命中。' },
  { id: 'justiciar.s7.mental-pressure', label: '精神压力', description: '只在原许可和范围内施加有限压力，不强迫真话或永久服从。' },
  { id: 'justiciar.s6.authority', label: '法官威严', description: '沿原对象、现场与真实消耗使用，不能以头衔免去对方抵抗或本人伤势。' },
  { id: 'justiciar.s6.prohibition', label: '有限禁令', description: '只影响当前允许限制的一次实际行动，原禁令、抵抗与消耗均保留，不追改过去。' },
  { id: 'justiciar.s5.punishment', label: '有限惩戒', description: '须有本案真实违规来源，沿原规则结算一次；无来源不能凭空处决或重开旧惩罚。' },
  { id: 'justiciar.s5.confinement', label: '有限禁锢', description: '只在原范围与时间内限制当前动作，真实抵抗、普通离场和原伤照常结算。' },
  { id: 'justiciar.s5.wound-verdict', label: '伤势裁定', description: '必须针对已有真实伤势；不能凭空造伤、治疗或把已发生后果重算。' },
  { id: 'justiciar.s4.intimidation', label: '有限震慑', description: '保留原成本、范围与一次实际抵抗，独立对象不因晋升失去自主意愿。' },
  { id: 'justiciar.s4.deprivation', label: '有限剥夺', description: '只能处理原规则允许的当前效果，不能概括为剥夺任何能力或取消所有行动。' },
  { id: 'justiciar.s3.bounded-order', label: '双方各一次的有限规则', description: '只约束双方当前各一次待执行的身体动作，本人同受限制；每次实际行动独立抵抗，未用效力到期清除。旧纸不改写，已发生的试走与战斗不倒转。' },
];
