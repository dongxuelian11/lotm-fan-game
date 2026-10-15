import { SUNPRIEST_GUIDE } from '../sunpriest/content.js';
import type { NotaryAbilityId } from './types.js';
export { NOTARY_CASE_IDS } from './types.js';

export const NOTARY_GUIDE = SUNPRIEST_GUIDE;
export const NOTARY_CARETAKER = '成年保管员米菈';
export const NOTARY_PRICES = { formula: 360, mainMaterials: 3000, auxiliaryMaterials: 240, brewing: 80 } as const;
export const NOTARY_BATCH_IDS = ['notary-batch-1', 'notary-batch-2', 'notary-batch-3'] as const;
export const NOTARY_MIN_SUNPRIEST_WEEKS = 12;
export const NOTARY_LABOUR_STEPS = 5;
export const NOTARY_LABOUR_TASKS = ['核对六项原料清单', '检查主材封签', '量记四项辅材', '整理独立批次记录', '清理原调配台'] as const;
/** B3 chapter 233 quantities; manifest order is not a claim about canonical mixing order. */
export const NOTARY_FORMULA = [
  { id: 'elder-tree-rhizome-crystal', name: '长者之树根茎结晶', quantity: 1, unit: '份' },
  { id: 'spirit-contract-bird-tail', name: '契灵鸟尾羽', quantity: 5, unit: '根' },
  { id: 'radiant-spirit-tree-juice', name: '光辉契灵树汁', quantity: 100, unit: 'mL' },
  { id: 'gold-edged-sunflower', name: '金边太阳花', quantity: 1, unit: '朵' },
  { id: 'white-edged-sunflower', name: '白边太阳花', quantity: 1, unit: '朵' },
  { id: 'water-fern-juice', name: '水蕨汁', quantity: 5, unit: '滴' },
] as const;
export const NOTARY_FORMULA_SOURCE = '《诡秘之主》第三部第233章已核公证人六项配方：长者之树根茎结晶1份、契灵鸟尾羽5根；光辉契灵树汁100mL、金边太阳花1朵、白边太阳花1朵、水蕨汁5滴。此处是备料清单，不声称材料排列就是原著投料顺序；具体导师操作规程、价格、五次劳动、成熟周数与判定数值均为本作玩法G。';
export const NOTARY_SOURCE_STATUS = '第四部第35章：公证现有能力为“有效”可暂时增强，为“无效”可削弱或消除；契约需要本人签名并认可。第四部第205章表现为增强已经存在的药剂、晨曦或药膏作用，不凭空创造对象和事实。本阶段保留原歌颂者、祈光人、太阳神官全部能力；日常只在已核现场增强本人已有有限圣光，签约只涉及当面同意的一次原工具借还。有限比例、时长、范围与消耗为玩法G；不是全知真假裁决、任意现实改写、强迫未签名者履约、污染清零或序列5光之祭司强度。';
export const NOTARY_ABILITIES: { id: NotaryAbilityId; label: string; description: string }[] = [
  { id: 'sun.s6.notarization', label: '能力公证', description: '以“有效”暂时增强已存在且范围清楚的能力，以“无效”削弱或消除适用效果。当前实践用本人已经掌握的有限神圣之光照原靶；成功只使这一次现有效果稍强，退出即停止，不制造真相、不净空污染。实施3灵性、知识14判定等为G。' },
  { id: 'sun.s6.signed-contract', label: '本人认可的签名契约', description: '只有本人实际读明、签名并认可的有限约定才能成为本次契约。原保管员当面同意一次借还；玩家另按签名，成功实施后仅约束离开前归还同一原测量工具。0行动实际归还即履行，不绑定未签名者、不生成金钱或物件、不附带后台惩罚；签名与履行状态为本作G。' },
];
export const NOTARY_CONSUMPTION_RISK = '本段数值为本作玩法G：服药必定消耗所选公证人原瓶，0行动，意志难度24；太阳神官扮演须达100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原导师在场处理本次排异，不随机即死；休养每次消退至多10排异，原瓶不恢复。这项保护不适用于战斗或其它危险。晋升四属性各+1，灵性上限80但当前灵性不补满。';
export const NOTARY_AGREEMENT = '我借用原工作间桌上的这把测量工具，并在离开本次现场前亲手将同一把工具归还原桌。';
export const NOTARY_TOOL_SOURCE = '原礼拜堂工作间桌上由米菈保管、属于原工房的同一把量尺（NT6-MEASURE-1）';
