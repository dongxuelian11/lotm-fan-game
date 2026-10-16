import { MAGICIAN_GUIDE } from '../magician/content.js';
import type { FacelessAbilityId } from './types.js';
export { FACELESS_CASE_IDS } from './types.js';

export const FACELESS_GUIDE = MAGICIAN_GUIDE;
export const FACELESS_PRICES = { formula: 360, mainMaterials: 3000, auxiliaryMaterials: 240, brewing: 80 } as const;
export const FACELESS_BATCH_IDS = ['faceless-batch-1', 'faceless-batch-2', 'faceless-batch-3'] as const;
export const FACELESS_MIN_MAGICIAN_WEEKS = 12;
export const FACELESS_LABOUR_STEPS = 5;
export const FACELESS_LABOUR_TASKS = ['核对六料名称', '检查主材封签', '量取辅材备份记录', '整理原批次领用记录', '清理独立调配台'] as const;
export const FACELESS_FORMULA_SOURCE = '《诡秘之主》第二部第238章已核六项配方。主材为千面狩猎者脑部异变垂体、人皮幽影特性，原著未给两项主材明确重量；本作采购各1份只是G供货计量。辅材为千面狩猎者的血液80mL、黑色曼陀罗汁5滴、龙牙草粉末10g、深海娜迦的头发3根，无纯水。材料排列不声称是原著投料顺序。指导、价格、劳动、成熟周数、属性和全部判定数值为本作玩法G。';
export const FACELESS_FORMULA = [
  { id: 'thousand-faced-hunter-pituitary', name: '千面狩猎者脑部异变垂体', quantity: null, supplyQuantity: 1, unit: '份', note: '原著未给明确重量；本作G每批供货1份。' },
  { id: 'human-skin-shadow-characteristic', name: '人皮幽影特性', quantity: null, supplyQuantity: 1, unit: '份', note: '原著未给明确重量；本作G每批供货1份。' },
  { id: 'thousand-faced-hunter-blood', name: '千面狩猎者的血液', quantity: 80, supplyQuantity: 80, unit: 'mL' },
  { id: 'black-mandrake-juice', name: '黑色曼陀罗汁', quantity: 5, supplyQuantity: 5, unit: '滴' },
  { id: 'dragon-tooth-grass', name: '龙牙草粉末', quantity: 10, supplyQuantity: 10, unit: 'g' },
  { id: 'deep-sea-naga-hair', name: '深海娜迦的头发', quantity: 3, supplyQuantity: 3, unit: '根' },
] as const;
export const FACELESS_SOURCE_STATUS = '无面人可改变自己的容貌、发色、瞳色、毛发，重现亲自见过的气质与气味，并模仿听过的普通人声音。新晋身高变化不超过正负10厘米，头部大小变化有限；跨性别外表不改变生理器官，也不复制记忆、知识、衣物、法律身份、关系或非凡能力。变化持久且无需维持，必须主动复原。本切片只有本人和两个获同意的原创成年角色模板，模板身高只偏移正负5厘米；目前不能在Scene任意换成已知NPC。原占卜家、小丑、魔术师能力全部继承，不开放序列5灵体之线或秘偶。模板、成人故事、自我反思分组、费用和判定为本作G。';
export const FACELESS_ABILITIES: { id: FacelessAbilityId; label: string; description: string }[] = [
  { id: 'diviner.s6.appearance-change', label: '体貌变化', description: '只改变自己的有限外貌、发瞳与毛发及已观察的气质气味。新晋身高限正负10厘米，本作两模板只正负5厘米；头部变化有限，生理器官、记忆、知识和衣物不变。变化2灵性、0行动，无维持费且离场不自动复原；显式复原1灵性、0行动（G）。' },
  { id: 'diviner.s6.voice-imitation', label: '普通人声音模仿', description: '仅重现亲耳听过的普通成年志愿者的固定示范短句；不复制其记忆、口音知识、习惯或语言能力。声音像不等于熟人不会识破举止；具体原声来源、短句与实践判定为G。' },
  { id: 'diviner.s6.self-anchor', label: '记住本人', description: '扮演别人时区分外貌、举止与自己原有的姓名和经历；这是本作G的扮演反思分组，不是额外的原著超能力或心智免疫。真实身份与角色原有生理器官不被外貌模板改写。' },
];
export const FACELESS_CONSUMPTION_RISK = '本段数值为本作玩法改编G：服药必定消耗所选无面人原瓶，0行动，意志难度24；魔术师扮演须达100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。指导者处理本次服药排异，不随机即死；休养每次消退至多10排异，用过原瓶不恢复。这项保护不适用于战斗或其它危险。晋升四属性各+1，灵性上限80但当前灵性不补满。';

/** Both are adult volunteers seen and heard in the original rehearsal room. */
export const FACELESS_TEMPLATES = {
  STAGE_DOUBLE: {
    label: '获同意的舞台替身', sourceCaseId: 'stage-double', heightOffsetCm: 5,
    source: '原创成年演员阿伦·贝尔当面展示脸、棕发、灰瞳、步态与普通声音，并同意这次排练；只取有限舞台外貌，身高相对本人+5厘米。',
  },
  PORTER_PART: {
    label: '获同意的搬运工角色', sourceCaseId: 'familiar-manner', heightOffsetCm: -5,
    source: '原创成年搬运工乔纳·里德在排练室当面展示短发、黑瞳、工作姿态与普通声音，并同意有限角色练习；身高相对本人−5厘米。',
  },
} as const;
