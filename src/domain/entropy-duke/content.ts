import { FRENZY_MAGE_GUIDE } from '../frenzy-mage/content.js';
import type { EntropyDukeAbilityId, EntropyDukePreparationId } from './types.js';

/** Source boundary: the Black Emperor card directly names S2 熵之公爵 and
 * S1 弑序亲王. Its complete formula, ritual and a complete S2 ability catalogue
 * remain unknown. The two finite skills, all costs, ranges, durations, scenes
 * and professional finished-potion procedure below are original game design.
 * They do not imply thermodynamic omnipotence, S1 powers, resurrection, rewind,
 * permanent obedience, universal action cancellation or ship spirit travel. */
export const ENTROPY_DUKE_GUIDE = FRENZY_MAGE_GUIDE;
export const ENTROPY_DUKE_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const ENTROPY_DUKE_MIN_FRENZY_MAGE_WEEKS = 12;
export const ENTROPY_DUKE_LABOUR_STEPS = 5;
export const ENTROPY_DUKE_BOTTLE_IDS = ['entropy-duke-potion-1', 'entropy-duke-potion-2', 'entropy-duke-potion-3'] as const;
export const ENTROPY_DUKE_FORMULA_STATUS = '米蕾介绍独立封存的熵之公爵成品魔药。须核对本人律师至狂乱法师的七阶原瓶与既往报告，检查动作放大和效果延续的使用边界，并实际走查本次服药处的普通出口。三项准备完成后，另行付费检查当周安静房间，再独立确认饮用所选原瓶。';
export const ENTROPY_DUKE_SOURCE_STATUS = '晋升后仍回到原协会净空投递演练房，米蕾、42岁达里安、400克封包、80克软布球、路线原纸和接收垫保持各自身份。只对当次明确而尚未执行的原动作作有限放大，延续只能用于本案仍持续的同一效果。已经发生的投球、落点、赠物与伤势不会倒转。逐案重新取得同意，撤回即停止新输入，空中原球仍须实际落地、取回和归还；不能强迫独立心智、复活旧人或补充旧赠物。';
export const ENTROPY_DUKE_POTION_SOURCES = ENTROPY_DUKE_BOTTLE_IDS.map((id, index) => ({
  id, source: `${ENTROPY_DUKE_GUIDE}介绍的专业交接处初始批次第${index + 1}瓶序列2熵之公爵成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回过去已耗尽的原瓶。`,
}));
export const ENTROPY_DUKE_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const ENTROPY_DUKE_PREPARATIONS: { id: EntropyDukePreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对七阶原瓶与既往记录', description: '本人核读律师至狂乱法师的七阶真实晋升、原瓶耗尽与旧报告，核对米蕾、达里安、原封包、原球、原纸、旧马洛与原阿尔登的实际记录。旧伤、旧拒绝与撤回、人物生死、赠物去向和原有掌握继续保留。' },
  { id: 'CHECK_LIMITS', title: '检查有限动作与延续边界', description: '放大只能作用于本案当前明确且尚未执行的同一动作，须随后亲手真实执行。延续只能作用于本案仍在持续的同一效果，不能重新开始已落地的投球、清掉旧结果或无止境延长。逐案征求同意，撤回停止新输入，原球仍须实际落地，成功也不保证以后结果。' },
  { id: 'MARK_EXIT', title: '标明原物归还与普通出口', description: '本人走查原安静房、协会净空投递演练房及门口至A四米、A至B和C各四米的普通去返路线，核对两个空垫与原物主人。投球后本人须普通步行至落点，取回同一原球与原纸，带回交给米蕾并沿原路离场。退出不退款、不治疗或传送，专业照护只处理本次服药排异。' },
];
export const ENTROPY_DUKE_ABILITIES: { id: EntropyDukeAbilityId; label: string; description: string }[] = [
  { id: 'black-emperor.s2.action-amplification', label: '有限动作放大', description: '本人当场亲手投出同一80克软布球，同时尝试有限放大。耗1行动、6灵性、2精神，知识难度20；失败总计损4精神。成功时原球实际飞行四米用2秒，失败或普通投球用4秒，须真实落地并步行取回。逐案取得同意，实际距离、原物和旧伤仍有效；成本不退，不倒改落点、复制动作或强迫他人。' },
  { id: 'black-emperor.s2.effect-prolongation', label: '同一效果的有限延续', description: '只对本人本案已真实投出且仍在空中的同一原球，尝试一次延长飞行。耗1行动、4灵性、2精神，知识难度20；失败总计损4精神。成功只将从本次投出算起的总飞行时间延至30秒，不能叠加，普通投球或放大失败后的实际飞行也须确实尚未结束。停止或撤回后不再输入，原球仍须实际落地、取回归主；已落地不能重开，不悬停、回滚或永久控制。' },
];
export const ENTROPY_DUKE_CONSUMPTION_RISK = '狂乱法师消化100、实际晋升后12整周、三份旧生活报告与反思完成，健康>20、精神>40。三项专业准备各1行动，当周另1行动140便士检查服药场地，0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和当次场地准备耗尽；专业支持仅将这次药物排异后的健康、精神保底到1，普通死亡及战斗照常结算。失败保留旧经历和三项准备，休养后须筹新原瓶并重做当周检查。成功四属性各+1，旧12项掌握与七阶消化保留，两项新掌握从0开始，共14项；灵性上限120，当前不补满。身体、性别、旧伤、原人物生死、原物与旧赠物去向不改写。';
export const ENTROPY_DUKE_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  { id: 'black-emperor.s9.rule-analysis', label: '规则分析', description: '核对已经看到的条款和适用条件，未见材料须实际查阅，不制造证据或改写原纸。' },
  { id: 'black-emperor.s9.persuasive-argument', label: '说服论证', description: '向能够交流的对象提出有限论证，对方仍能拒绝，不替代本人意愿。' },
  { id: 'black-emperor.s9.weak-point-insight', label: '弱点识别', description: '根据眼前动作与事实识别有限破绽，保留原有成本和边界，不自动命中。' },
  { id: 'black-emperor.s8.enhanced-body', label: '非凡体能', description: '同一身体处理实际重物与打击，原伤、实际距离和资源仍然有效。' },
  { id: 'black-emperor.s8.mental-resistance', label: '精神抗性', description: '有限抵抗当前精神压力，原有消耗和失败保留，不提供普遍免疫。' },
  { id: 'black-emperor.s7.bribery-weakening', label: '原赠物的有限削弱', description: '只能实际给出仍随身的同一旧赠物，已给出的原物不召回、不复制，不另建库存。' },
  { id: 'black-emperor.s6.distortion', label: '有限扭曲', description: '沿原对象、当前条件和真实资源使用，已发生的事实不能倒改。' },
  { id: 'black-emperor.s5.disorder', label: '有限混乱', description: '只在原有许可、范围与抵抗规则内施用，当前接触仍须实际收束。' },
  { id: 'black-emperor.s4.bestow', label: '有限赋予', description: '保留本人和原对象的独立身份，实际效果与成本仍须核对，不能无限强化或补资源。' },
  { id: 'black-emperor.s4.magnify', label: '原动作放大', description: '沿原规则放大本人当次真实击打，原攻击只计算一次，不免费复制主攻。' },
  { id: 'black-emperor.s4.exploit', label: '有限利用', description: '只延续当下仍存在的原赠物削弱窗口，不能召回赠物或重开已经结束的效果。' },
  { id: 'black-emperor.s3.ordered-deviation', label: '既有待行动作的有限偏转', description: '只影响当前已明确且尚未执行的一次原动作，成功检定须后来实际应用；停止、撤回或到期清掉未用影响，原纸和已成事实不改。' },
];
