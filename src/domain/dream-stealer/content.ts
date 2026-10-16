import { FIRE_THIEF_GUIDE } from '../fire-thief/content.js';
import type { DreamStealerAbilityId } from './types.js';
export { DREAM_STEALER_CASE_IDS } from './types.js';

/** Canonical boundaries are separate from this slice's explicitly original G people, costs and scenes. */
export const DREAM_STEALER_GUIDE = FIRE_THIEF_GUIDE;
export const DREAM_STEALER_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const DREAM_STEALER_MIN_FIRE_THIEF_WEEKS = 12;
export const DREAM_STEALER_LABOUR_STEPS = 5;
export const DREAM_STEALER_BOTTLE_IDS = ['dream-stealer-potion-1', 'dream-stealer-potion-2', 'dream-stealer-potion-3'] as const;
export const DREAM_STEALER_SOURCE_STATUS = '错误途径序列5窃梦家能够窃取目标当前将要执行的念头；窃取成功后，窃梦家本人会立即执行对应行动。目标暂时忘记该次念头，随后能够恢复决定，并非永久删除思想或任意控制意志。窃到使用非凡能力的念头，不等于同时偷到对应能力；序列6盗火人的能力窃取仍须有实际目标、真实能力来源与有限借用窗口，不能凭空取得全能力库。强大目标能够抵抗，假象不等于真实念头，没有自身心智的机械动作不能成为念头来源。梦境与理想属于已知窃取边界，但完整操作细节尚未核实，本阶段没有全局梦境操控、自由读取梦境或未经核实的梦境窃取主动按钮。念头储存、免除自身立即执行以及寄生属于更高序列边界，本阶段不提前获得序列4寄生者能力。原成年导师艾德温·洛克、原成年志愿者瑟蕾·芬恩与诺汀·布莱尔及各自原桌椅、诺汀自有蓝色木盘DS5-TOKEN-1、原机械木臂、原练习室、有限同意、10秒恢复观察、2米场景距离、供给、费用、成熟周数、灵性成本与判定均为本作原创G。只测试一次当前决定；准备同意不会提前让目标坐下、停顿或丢失念头。目标恢复后仍可自由拒绝继续参与。继承全部旧途径原ID掌握、真实演示、借用及恢复历史，不改写旧物位置或已解决敌人。';
export const DREAM_STEALER_FORMULA_STATUS = '窃梦家完整配方与晋升仪式细节尚未核实；不能据未知细节断言无需仪式。材料、用量、调配顺序及仪式步骤保持未知。本作原创G渠道只提供独立成品原瓶；原成年导师艾德温·洛克实际核对本次原瓶、准备原练习室的安静服药场地和在场照护，再指导本次服药。这是明确的G准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。';
export const DREAM_STEALER_POTION_SOURCES = DREAM_STEALER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${DREAM_STEALER_GUIDE}经独立窃梦家成品交接渠道实际取得的第${index + 1}瓶序列5窃梦家成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非偷盗者、诈骗师、解密学者或盗火人旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const DREAM_STEALER_LABOUR_TASKS = ['核对本瓶独立封签', '整理原练习室公开交接册', '清点原练习室普通桌椅', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const DREAM_STEALER_ABILITIES: { id: DreamStealerAbilityId; label: string; description: string }[] = [
  { id: 'error.s5.thought-theft', label: '当前念头窃取与立即执行', description: '尝试窃取真实目标当前将要执行的念头，成功后本人在同一动作立即执行对应行动，不能储存待用或免除执行。目标只暂时忘记该次念头，随后可以恢复决定；不永久删除思想、不强迫未来意愿，也不随念头获得非凡能力。强大目标能够抵抗，假象和无自身心智的机械动作不是合法来源。本段原创G实施1行动、3灵性、知识14，只用本人身体与现有原桌椅；窃取伸手念头不会把他人的蓝色木盘转移到你手中。' },
];
export const DREAM_STEALER_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原练习室安静场地并照护；服药必耗选定原瓶，0行动，意志难度26。服药前健康须高于20、精神须高于40，不足时先休养；盗火人消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。艾德温·洛克处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留盗火人消化及全部原掌握；成功只新增当前念头窃取一项0掌握，四属性各+1，灵性上限100但当前灵性不补满。没有附赠新的非凡能力、梦境解释或物品；旧借用来源、原主恢复与已解决敌人记录保持不变。';
