import { MARIONETTIST_GUIDE } from '../marionettist/content.js';
import type { BizarroSorcererAbilityId } from './types.js';
export const BIZARRO_SORCERER_GUIDE = MARIONETTIST_GUIDE;
export const BIZARRO_SORCERER_PRICES = { formula: 500, mainMaterials: 5000, auxiliaryMaterials: 320, brewing: 120 } as const;
export const BIZARRO_SORCERER_BATCH_IDS = ['bizarro-sorcerer-batch-1', 'bizarro-sorcerer-batch-2', 'bizarro-sorcerer-batch-3'] as const;
export const BIZARRO_SORCERER_MIN_MARIONETTIST_WEEKS = 12;
export const BIZARRO_SORCERER_LABOUR_STEPS = 5;
export const BIZARRO_SORCERER_LABOUR_TASKS = ['核对本批七料及来源', '检查两项主材原封签', '计量本批血液与粉尘', '整理本批树皮、葡萄藤和橡皮面具', '清理本批独立调配台并登记原料'] as const;
export const BIZARRO_SORCERER_FORMULA = [
  { id: 'bizarro-bane-main-eye', name: '诡术邪怪主眼', quantity: null, supplyQuantity: 1, unit: '份', note: '原著未给明确用量；本作G每批供货1份。' },
  { id: 'spirit-world-plunderer-soul', name: '灵界掠夺者真实魂体', quantity: null, supplyQuantity: 1, unit: '份', note: '原著未给明确用量；本作G每批供货1份。' },
  { id: 'bizarro-bane-blood', name: '诡术邪怪血', quantity: 200, supplyQuantity: 200, unit: 'mL' },
  { id: 'plunderer-dust', name: '掠夺者粉尘', quantity: 30, supplyQuantity: 30, unit: 'g' },
  { id: 'red-birch-bark', name: '红毛桦树皮', quantity: 10, supplyQuantity: 10, unit: 'g' },
  { id: 'golden-vine', name: '金色葡萄藤', quantity: 1, supplyQuantity: 1, unit: '截' },
  { id: 'homemade-rubber-mask', name: '指头大自制橡皮面具', quantity: 1, supplyQuantity: 1, unit: '个', note: '保留原著指头大小的形制；不是随手生成的新面具。' },
] as const;
export const BIZARRO_SORCERER_FORMULA_SOURCE = '《诡秘之主》第四部第113章已核七项配方：诡术邪怪主眼、灵界掠夺者真实魂体、诡术邪怪血200mL、掠夺者粉尘30g、红毛桦树皮10g、金色葡萄藤一截、指头大自制橡皮面具。两项主材没有明确用量，本作G按每批各1份独立供货，不冒称原著重量。原料清单不是投料次序；本次实际采用本作G指导者调配规程。';
export const BIZARRO_SORCERER_RITUAL_SOURCE = '原著晋升仪式：主要依靠自身力量和谋划，在众多实际见证者面前，以盛大戏剧的方式谋杀一名真实半神或同等位格超凡生物，并在谢幕时服药。和平练习、幻象死亡、秘偶表演、普通人改名或展示旧尸体不能替代。可保持序列5或尝试撤退；开战有真实受伤和死亡风险。每次服药均消耗独立原瓶并关闭原场次，失败必须另筹新药、另一原目标、实际见证和新演出，原死者不复活。原创场地、帷幕兽、36名成人、费用和战盘均为本作G。';
export const BIZARRO_SORCERER_SOURCE_STATUS = '新晋诡法师原著参考：火焰跳跃接近1000米，150米开始操纵灵体之线，1000米控偶与互换位置；有限弱目标可在3秒内初控、15秒内完全转化，不能推广为任意位格必然转化。新晋容量50具秘偶及50条灵之虫是上限，不凭空给予身体或已分离虫。灵之虫须沿实际灵体之线抵达原秘偶才能赋予自己的能力；这是单向赋予，主人不能反借秘偶天赋。完整转化意味着原生灵不可逆死亡，失去虫体有真实精神风险。继承全部旧能力，不新增重复火跳掌握，不提前获得序列3历史投影或借取过去力量。具体有限练习、成本、判定和消化奖励均为本作G。';
export const BIZARRO_SORCERER_ABILITIES: { id: BizarroSorcererAbilityId; label: string; description: string }[] = [
  { id: 'diviner.s4.worm-assignment', label: '灵之虫赋予', description: '实际分离的一条灵之虫沿真实灵体之线进入自己控制的原秘偶，单向赋予本人已有能力。上限50不等于免费50条虫或50具身体；原鼠保持小动物承载能力，不生成人形、武器或额外天赋。' },
  { id: 'diviner.s4.puppet-swap', label: '秘偶互换', description: '与1000米内实际受控原秘偶交换两具原身体所在位置，原携带物分别随原身体移动。有限练习只用真实近远落点和同一只原鼠，不能向空位传送、复制身体或改写过去。' },
];
export const BIZARRO_SORCERER_CONSUMPTION_RISK = '以下数值为本作G：秘偶大师扮演100、晋升后12整周、健康>20且精神>40，且当前真实谋杀仪式到达谢幕后，才能0行动单独确认服用本场原瓶。意志难度28，原瓶必耗尽。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。本作G现场监督仅将此次药物排异后的健康和精神保底到1，不保护真实战斗。晋升四属性各+1，灵性上限120，当前灵性不补满；继承全部旧能力，仅新增灵之虫赋予与秘偶互换两项掌握，从0开始。';
