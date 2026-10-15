import { FACELESS_GUIDE } from '../faceless/content.js';
import type { MarionettistAbilityId } from './types.js';
export { MARIONETTIST_CASE_IDS } from './types.js';
export const MARIONETTIST_GUIDE = FACELESS_GUIDE;
export const MARIONETTIST_PRICES = { formula: 420, mainMaterials: 4200, auxiliaryMaterials: 280, brewing: 100, ritualTravel: 80 } as const;
export const MARIONETTIST_BATCH_IDS = ['marionettist-batch-1', 'marionettist-batch-2', 'marionettist-batch-3'] as const;
export const MARIONETTIST_MIN_FACELESS_WEEKS = 12;
export const MARIONETTIST_LABOUR_STEPS = 5;
export const MARIONETTIST_LABOUR_TASKS = ['核对本批六料', '检查本批封签', '整理本批辅材计量', '登记本批领用记录', '清理本批独立调配台'] as const;
export const MARIONETTIST_FORMULA_SOURCE = '《诡秘之主》第二部第38章已核六项配方：古老怨灵粉尘、六翼石像鬼核心结晶、苏尼亚岛金色泉泉水80mL、龙纹树树皮10g、古老怨灵残余灵性、六翼石像鬼眼睛1对。两项主材及古老怨灵残余灵性未给明确用量，本作G供货各1份，不冒称原著精确重量。材料列表不是投料次序，实际采用本作G导师调配规程。';
export const MARIONETTIST_FORMULA = [
  { id: 'ancient-wraith-dust', name: '古老怨灵粉尘', quantity: null, supplyQuantity: 1, unit: '份', note: '原著未给明确用量；本作G每批供货1份。' },
  { id: 'six-winged-gargoyle-core', name: '六翼石像鬼核心结晶', quantity: null, supplyQuantity: 1, unit: '份', note: '原著未给明确用量；本作G每批供货1份。' },
  { id: 'sonia-golden-spring-water', name: '苏尼亚岛金色泉泉水', quantity: 80, supplyQuantity: 80, unit: 'mL' },
  { id: 'dragon-pattern-tree-bark', name: '龙纹树树皮', quantity: 10, supplyQuantity: 10, unit: 'g' },
  { id: 'ancient-wraith-spirituality', name: '古老怨灵残余灵性', quantity: null, supplyQuantity: 1, unit: '份', note: '原著未给明确用量；本作G每批供货1份。' },
  { id: 'six-winged-gargoyle-eyes', name: '六翼石像鬼眼睛', quantity: 1, supplyQuantity: 1, unit: '对' },
] as const;
export const MARIONETTIST_RITUAL_SOURCE = '原著仪式是在真实美人鱼歌声中服药，录音、模仿和普通人歌声不能替代。以下渠道、人物、行程与价格为原创G：指导者向成年、自愿且健康的美人鱼“涟”预约有限海岸水湾会面。请求需1行动，最早下一真实周出发；实际普通往返行程共1行动、80便士，先到水湾再现场开歌，0行动结束歌声或按已付原路返俱乐部。只移动玩家，不传送任何其它NPC；每次到访最多服一原瓶，失败也要重新预约下一次。';
export const MARIONETTIST_SOURCE_STATUS = '能在有限范围感知生灵的灵体之线，无生命普通木偶没有灵体之线；感知不是读取后台或全知。新晋参考约5米开始控制、约20秒初步控制、约5分钟完整转化、100米控偶范围、1具容量，个体抗性与实际条件会改变过程。初控使目标思维与动作迟缓，施术者专注时自身动作受限；可被适当干扰打断，不能推成所有伤害必然解除。完整转化意味着原人死亡且不可逆，和平练习只短暂初控并真实解除，不产秘偶。原占卜家、小丑、魔术师、无面人能力全部保留，外貌与衣物历史不改写。不提前获得序列4的秘偶能力赋予或互换位置。具体实践、计时、判定、费用、消化奖励与战斗量化均为本作G。';
export const MARIONETTIST_ABILITIES: { id: MarionettistAbilityId; label: string; description: string }[] = [
  { id: 'diviner.s5.spirit-threads', label: '灵体之线感知', description: '有限感知100米内生灵的灵体之线，不能透读后台秘密；无生命木偶没有真实灵体之线。原创和平练习只对原现场自愿成年人和原普通木偶对照，实际实践3灵性，可能失败。' },
  { id: 'diviner.s5.marionette-control', label: '灵体之线操纵', description: '新晋参考5米起控、20秒初控使思维动作变慢、约5分钟完整转化、100米控偶、1具容量；抗性会改变过程。专注限制自身动作，适当干扰能中断，不保证任何伤害都解除。完整转化使原人不可逆死亡；和平实践只短暂初控并实际释放。' },
];
export const MARIONETTIST_CONSUMPTION_RISK = '以下数值为本作G：无面人扮演100且晋升后12整周，真实现场美人鱼歌声中才能独立确认服药。0行动、意志难度26，原瓶必耗尽。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、健康−10、精神−20、排异+25；灾难：中断晋升、健康−20、精神−40、排异+50。导师仅保护本次排异不随机即死，休养每次至多消退10排异；原瓶不恢复，不保护战斗。晋升四属性各+1、灵性上限100，当前灵性不补满；继承全部旧能力，仅新增两项从0。';
