import { POLYMATH_GUIDE } from '../polymath/content.js';
import type { MysticismMagisterAbilityId } from './types.js';
export { MYSTICISM_MAGISTER_CASE_IDS } from './types.js';

/** Canonical ability boundaries only; this study, people, originals, prices and checks are G. */
export const MYSTICISM_MAGISTER_GUIDE = POLYMATH_GUIDE;
export const MYSTICISM_MAGISTER_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const MYSTICISM_MAGISTER_MIN_POLYMATH_WEEKS = 12;
export const MYSTICISM_MAGISTER_LABOUR_STEPS = 5;
export const MYSTICISM_MAGISTER_BOTTLE_IDS = ['mysticism-magister-potion-1', 'mysticism-magister-potion-2', 'mysticism-magister-potion-3'] as const;
export const MYSTICISM_MAGISTER_SOURCE_STATUS = '白塔途径序列5秘术导师可借目标本人的实际物品施行入梦仪式，并以相关知识和实际非凡材料尝试制造模仿效果。第三部52章的仪式需要真实联系物，不是梦魇能力，不传送施术者或他人的身体；艾德雯娜一千海里的具体表现不是新晋序列5的默认距离。第三部53章的制造需要知识与真实非凡材料，可以失败；第三部220章模拟神圣之光只是具体实例，不赠免费技能库。本作只使用同一成年诺亚的普通原布MM5-CLOTH-1，诺亚所有权不变；目标休息室距原书房40米，普通通道可实际往返，施术时你的身体留在书房。有限梦中说法必须结束接触后实际走访醒来的本人核实。制造只使用已实际学会的博学者FLASH知识，每次购买并消耗一个独立MM5-KIT-N材料包，成功才生成一件一次性弱闪原件MM5-FLASH-N，不自动成为永久装备或能力。教学只由成年塔莉娅独立复述普通来源、退出和材料清单，不复制序列或强制学生。原导师塞缪尔、诺亚与塔莉娅、原书房、三项实践、可选原空工院冲突及所有供给、距离、数值、成本、判定均为原创G。继承阅读者、推理学员、守知者与博学者原ID、原掌握、全部实际样本和原物历史，不提前获得序列4预言家的未来预言。';
export const MYSTICISM_MAGISTER_FORMULA_STATUS = '秘术导师完整配方与晋升仪式尚未核实，材料、用量、调配顺序及仪式细节保持未知，不能据此断言无需仪式。塞缪尔提供的准备指导与本次指导服药是本作原创G流程，不解锁配方、魔药材料采购或调配；当前仅能取得原创G渠道实际供应的序列5独立成品原瓶。实践用的非凡材料包不属于晋升配方，不可替代成品原瓶。';
export const MYSTICISM_MAGISTER_POTION_SOURCES = MYSTICISM_MAGISTER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${MYSTICISM_MAGISTER_GUIDE}经独立秘术导师成品交接渠道实际取得的第${index + 1}瓶序列5秘术导师成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非阅读者、推理学员、守知者或博学者旧瓶改装，未声称掌握完整配方或仪式。`,
}));
export const MYSTICISM_MAGISTER_LABOUR_TASKS = ['核对本瓶独立封签', '整理原借阅馆公开交接册', '按原编号归还普通教学示意册', '校对本瓶交接日期', '复核本瓶成品供货凭据'] as const;
export const MYSTICISM_MAGISTER_ABILITIES: { id: MysticismMagisterAbilityId; label: string; description: string }[] = [
  { id: 'reader.s5.secret-ritual', label: '联系物秘术仪式', description: '以目标本人的实际物品建立有限仪式联系，不是梦魇，不移动任何身体。本作G实践须实际借同一成年诺亚的普通原布MM5-CLOTH-1，并在本次施术时取得同意、约定本人睡下；目标在40米外休息室，你的身体留原书房。仪式可能失败，仍须显式结束，梦中说法须普通往返与醒来本人核实；一千海里不是新晋默认范围。' },
  { id: 'reader.s5.material-imitation', label: '材料依托制造模仿', description: '用已掌握的相关知识和真实非凡材料制造有限模仿效果，可以失败。本作G只用旧博学者实际学会的FLASH知识，每次付160便士购买并立即耗尽一包独立MM5-KIT-N，耗4灵性、知识16；成功才制成一次性弱闪原件MM5-FLASH-N。效力在制造时按本项已有掌握固定，不回填旧件，不提供神圣之光或任意技能库。' },
];
export const MYSTICISM_MAGISTER_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度26；服药前健康须高于20、精神须高于40，不足时先休养；博学者消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年导师塞缪尔在场处理本次指导服药排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留博学者消化、全部原掌握与实际样本；成功只新增两项0掌握，四属性各+1，灵性上限100但当前灵性不补满。晋升不自动借来联系物，不赠材料、闪光原件或未学会的样本。';
