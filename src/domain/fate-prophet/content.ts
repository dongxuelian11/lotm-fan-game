import { CHAOS_WALKER_GUIDE } from '../chaos-walker/content.js';
import type { FateProphetAbilityId, FateProphetPreparationId } from './types.js';

/** Developer evidence boundary: L43514/L43536/L146058 directly support Wheel S2
 * Prophet. A complete potion formula, canonical ritual and precise new ability
 * specification are unknown. All bounded mechanics, people, scenes, costs and
 * timings below are original implementation; no S1 restart, revival, rewind,
 * universal foreknowledge or reading a future RNG result is inferred. */
export const FATE_PROPHET_GUIDE = CHAOS_WALKER_GUIDE;
export const FATE_PROPHET_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const FATE_PROPHET_MIN_CHAOS_WALKER_WEEKS = 12;
export const FATE_PROPHET_LABOUR_STEPS = 5;
export const FATE_PROPHET_BOTTLE_IDS = ['fate-prophet-potion-1', 'fate-prophet-potion-2', 'fate-prophet-potion-3'] as const;
export const FATE_PROPHET_FORMULA_STATUS = '艾妲介绍独立封存的先知成品魔药。须核对本人七阶原瓶与旧报告，检查单一未来事件的预感和有限调整边界，并实际走查本次服药处的普通出口。三项准备完成后，另付费检查当周安静房间，再独立确认饮用所选原瓶。';
export const FATE_PROPHET_SOURCE_STATUS = '晋升后继续使用原机械工坊、薇拉、原车和封包、原袋和两签、原盘及记录纸。每次只处理当前在场、尚未发生的一件物理事件，预感可以出错，有限调整仍须付费并面对实际结果。每案重新取得当前同意，撤回即停止新输入，真实归物后沿普通路线离开。唯一幸运储备及旧消耗继续保留，晋升不补充幸运、不重抽、不改写已经发生的事，也不复活旧人物。';
export const FATE_PROPHET_POTION_SOURCES = FATE_PROPHET_BOTTLE_IDS.map((id, index) => ({
  id, source: `${FATE_PROPHET_GUIDE}介绍的专业交接处初始批次第${index + 1}瓶序列2先知成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回过去已耗尽的原瓶。`,
}));
export const FATE_PROPHET_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const FATE_PROPHET_PREPARATIONS: { id: FateProphetPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对七阶原瓶与既往记录', description: '本人核读怪物至混乱行者的七阶实际晋升经历、耗尽原瓶与旧报告，核对原薇拉、艾妲、原车和封包、原袋和两签、原盘及原纸，确认加雷斯与费里斯的真实结局。原伤与唯一幸运的积累、实耗记录保留，晋升不重开旧现场。' },
  { id: 'CHECK_LIMITS', title: '检查单一未来事件与当前同意边界', description: '只对当前亲见、尚未发生的一件物理事件作有限预感或调整。预感可以错误，实际事件另行发生且只结算一次，预感不能保证后来结果。每案重新取得成年人当前同意，撤回阻止新输入，已花行动、精神、灵性与幸运不退。旧幸运上限仍为三份，没有第二池或免费补充。' },
  { id: 'MARK_EXIT', title: '标明原物归还与普通出口', description: '本人实际走查原工坊门口到操作处四米、操作处到左右终点各四米的轨道与普通去返路线。原车、唯一四百克封包、原袋、两签、原盘与原纸各有唯一身份和实际地点。归还同一原物后普通步行离开，不复制、传送或治疗；专业照护只处理本次服药排异。' },
];
export const FATE_PROPHET_ABILITIES: { id: FateProphetAbilityId; label: string; description: string }[] = [
  { id: 'wheel.s2.event-foresight', label: '单次事件预感', description: '只观察当前在场、尚未发生的一件物理事件。耗1行动、5灵性、1精神，以知识难度20检定；预感不是事实，预感不能保证后来结果。原事件随后独立发生一次，错误预感也照实保留，不重抽、不追改。实战支付5灵性、1精神并通过知识20检定后，仅削弱之后下一次实际攻击三成；对手仍可凝神抵抗，轮末未用效果结束。' },
  { id: 'wheel.s2.hazard-adjustment', label: '有限风险调整', description: '只对一次尚未发生的当前物理事件预备有限调整，耗1行动、5灵性、1精神和唯一旧幸运1份，以知识难度20检定。成功仅在30秒内为该次事件增加15个百分点，最高80%，目标仍能抵抗。成功不保证后续结果；撤回、停止或到期清掉未应用影响，原费用不返。实战只有明确选择动用原储备后才能支付1份幸运、5灵性、1精神并作知识20检定，成功仅将下一次实际身体打击或法术冲击减半；本轮至多使用1份原储备，与旧技巧共用一个待用效果。没有新幸运池、回溯、重启或免死。' },
];
export const FATE_PROPHET_CONSUMPTION_RISK = '混乱行者消化100、实际晋升后12整周、三份旧生活报告与反思完成，健康>20、精神>40。三项专业准备各1行动，当周另1行动140便士检查服药场地，0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和当次场地准备耗尽；专业支持仅将这次药物排异后的健康、精神保底到1，普通死亡及战斗照常结算。失败保留旧经历和三项准备，休养后须筹新原瓶并重做当周检查。成功四属性各+1，旧15项掌握与七阶消化保留，两项新掌握从0开始，共17项；灵性上限120，当前不补满。身体、性别、旧伤、人物生死、原物与唯一幸运账本不改写。';
export const FATE_PROPHET_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  { id: 'wheel.s9.spirit-sensitivity', label: '灵性感知', description: '有限感知当前真实线索，依实际资源与原规则使用，预感不能保证后来结果。' },
  { id: 'wheel.s9.fragmentary-omen', label: '片段预兆', description: '原有片段仍可能误解，须用实际发生的事核对，不成为全知。' },
  { id: 'wheel.s9.danger-intuition', label: '危险直觉', description: '有限察觉当前风险，不保证免伤或免死。' },
  { id: 'wheel.s8.calculation-control', label: '计算与身体控制', description: '沿原身体和成本进行有限计算与动作，旧伤持续有效。' },
  { id: 'wheel.s8.divination-guard', label: '有限占卜防护', description: '保留原有防护边界，不给予普遍免疫。' },
  { id: 'wheel.s7.passive-luck', label: '被动幸运波动', description: '保留原有被动波动，不强制成功或重抽失败。' },
  { id: 'wheel.s6.disaster-awareness', label: '有限灾祸感知', description: '依当前线索感知风险，不能宣告尚未发生的事实。' },
  { id: 'wheel.s6.disaster-attraction', label: '有限灾祸牵引', description: '沿原范围、真实对象与成本使用，不能任意制造灾难。' },
  { id: 'wheel.s6.mental-storm', label: '精神风暴', description: '保留实际灵性消耗、目标抵抗与有限精神压力，失败照付。' },
  { id: 'wheel.s5.luck-reserve', label: '节制积累幸运', description: '继续使用唯一容量三份的原账本，须真实积累，不能升阶补满或复制。' },
  { id: 'wheel.s5.ill-fortune', label: '有限厄运影响', description: '只在原有效条件内有限影响，消耗真实幸运且不保证结果。' },
  { id: 'wheel.s4.precaution-practice', label: '有限预防实践', description: '原风险核验、成本与伤势继续保存，不能改写已经发生的损失。' },
  { id: 'wheel.s4.bounded-misfortune', label: '有限厄运', description: '依原对象与资源有限施用，目标保留抵抗，旧费里斯的结局不重开。' },
  { id: 'wheel.s3.deviation-buffer', label: '未来分支有限偏移', description: '保留原有限待用影响及唯一幸运成本，不倒改已发生动作或免费补偿。' },
  { id: 'wheel.s3.future-impediment', label: '未来输入有限阻滞', description: '只影响原规则允许的后续一次输入，未用影响须真实停止或到期，旧加雷斯不复活。' },
];
