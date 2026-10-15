import { CRYPTOLOGIST_GUIDE } from '../cryptologist/content.js';
import type { FireThiefAbilityId } from './types.js';
export { FIRE_THIEF_CASE_IDS } from './types.js';

export const FIRE_THIEF_GUIDE = CRYPTOLOGIST_GUIDE;
export const FIRE_THIEF_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const FIRE_THIEF_MIN_CRYPTOLOGIST_WEEKS = 12;
export const FIRE_THIEF_LABOUR_STEPS = 5;
export const FIRE_THIEF_BOTTLE_IDS = ['fire-thief-potion-1', 'fire-thief-potion-2', 'fire-thief-potion-3'] as const;
export const FIRE_THIEF_SOURCE_STATUS = '错误途径序列6的准确名称是盗火人。可以偷取非凡能力，使原拥有者暂时不能使用，自己在另一有限期限内使用；越了解目标能力，越有利于选择，但成功偷取仍可能偷错。原著有想偷生命力却得到毒雾、想偷开门却得到亡者之语的表现。第三部第130章火种手套所述50米、目标12小时与自身10分钟属于该物品的具体表现，不能直接当成序列6通用数值；本段距离、两种窗口、次数、消耗和检定全为原创G。没有只准使用一次的原著结论，也不获得永久掌握。序列5窃梦家的梦境、念头与行动偷取不下放；不能偷走污染或删除不想要的属性。导师、成年同意志愿者、原练习室和独立成品供给均为本作原创G。';
export const FIRE_THIEF_FORMULA_STATUS = '盗火人完整配方尚未核实，不编造材料、剂量或调配步骤。G用药说明只提供独立序列6成品原瓶，不解锁配方、材料采购或调配，也不改装偷盗者、诈骗师或解密学者旧药。';
export const FIRE_THIEF_POTION_SOURCES = FIRE_THIEF_BOTTLE_IDS.map((id, index) => ({
  id, source: `${FIRE_THIEF_GUIDE}经独立盗火人成品交接渠道实际取得的第${index + 1}瓶序列6盗火人成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非偷盗者、诈骗师或解密学者旧瓶改装，未声称掌握完整配方。`,
}));
export const FIRE_THIEF_LABOUR_TASKS = ['核对本瓶独立封签', '整理原练习室公开交接册', '清点原练习室普通遮光屏', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const FIRE_THIEF_ABILITIES: { id: FireThiefAbilityId; label: string; description: string }[] = [
  { id: 'error.s6.power-theft', label: '偷取非凡能力', description: '从实际已见的目标能力中尝试偷取；了解有利于选择，但成功也可能偷错。原拥有者暂时不能用该能力，不是失去全部能力。本段知识14、3灵性，闪光意向成功后再抽实际两能力池：70%闪光、30%冰霜；勇气只来自原歌颂者的实际已见能力。未知对象不开放能力路线，数值为G。' },
  { id: 'error.s6.borrowed-power', label: '有限借用所偷能力', description: '只能使用实际偷到的能力，不能把意向改成结果或转成永久掌握。本段G自身窗口2现场时段、原主受限3现场时段；每次实际使用2灵性并推进一时段，可在自身窗口内使用两次，等待也推进一时段。自身到期时原主仍可受限；结束前实际等待剩余时段并核实原主恢复。不是记录官的一次性记录，也不是原著通用小时数。' },
];
export const FIRE_THIEF_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗所选原瓶，0行动、意志24；解密学者消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年导师在场处理本次指导服药排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗。失败保留解密学者消化和全部原掌握；成功四属性各+1，新增两项掌握从0开始，灵性上限80但当前不补满。';
