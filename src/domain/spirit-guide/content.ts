import { SPIRITMEDIUM_GUIDE } from '../spiritmedium/content.js';
import type { SpiritGuideAbilityId } from './types.js';
export { SPIRIT_GUIDE_CASE_IDS } from './types.js';

/** Canon boundaries are separate from the original G people, room, agreement, costs and checks. */
export const SPIRIT_GUIDE_GUIDE = SPIRITMEDIUM_GUIDE;
export const SPIRIT_GUIDE_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const SPIRIT_GUIDE_MIN_SPIRITMEDIUM_WEEKS = 12;
export const SPIRIT_GUIDE_LABOUR_STEPS = 5;
export const SPIRIT_GUIDE_MESSENGER_FEE = 12;
export const SPIRIT_GUIDE_BOTTLE_IDS = ['spirit-guide-potion-1', 'spirit-guide-potion-2', 'spirit-guide-potion-3'] as const;
export const SPIRIT_GUIDE_SOURCE_STATUS = '第四部第186章《猜测与想法》支持序列6沟通扩展至灵界、自行招募信使、借助某些灵的力量及增强控灵；亡者之语直接针对灵体、绕过血肉保护，并不等于无条件命中或控制所有灵。原文亦有阿兹克铜哨克制控灵，序列5才有冥界之门和体内亡灵监狱。第一部第148章《信使》提示召唤与本人实力有关，描述错误可能引来危险对象；戴莉在序列6已有信使，传话小灵会疲倦。本阶段只邀请原创弱小鸟形灵灰羽，真实准备、检定并获得本人接受的有限条款后才招募；一封原信、两间相邻已知房间、已在场同意的收件人，递送一次后休息。不是免费随从、任意传送或战斗亡灵军团。继承收尸人、掘墓人、通灵者全部原ID与掌握。导师、灰羽、房间、约定、原信、费用、检定与全部数值均为本作原创G。';
export const SPIRIT_GUIDE_FORMULA_STATUS = '死灵导师完整配方尚未核实，不拼补材料名称、剂量或调配顺序。本阶段G用药指导不解锁配方、材料采购或调配，只提供独立成品原瓶，不能沿用收尸人、掘墓人或通灵者旧药。';
export const SPIRIT_GUIDE_POTION_SOURCES = SPIRIT_GUIDE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SPIRIT_GUIDE_GUIDE}经独立死灵导师成品交接渠道实际取得的第${index + 1}瓶序列6死灵导师成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非收尸人、掘墓人或通灵者旧瓶改装，未声称掌握完整配方。`,
}));
export const SPIRIT_GUIDE_LABOUR_TASKS = ['核对本瓶独立封签', '整理原纪念工作室公开交接册', '清点原工作室普通隔栏', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const SPIRIT_GUIDE_ABILITIES: { id: SpiritGuideAbilityId; label: string; description: string }[] = [
  { id: 'death.s6.spirit-recruitment', label: '有限灵界沟通与招募', description: '沟通范围扩展至灵界，可自行招募信使、借助某些灵的力量并增强控灵。本段只在原导师房间谨慎邀请弱小鸟形灵灰羽，知识14成功且本人接受限定条款、实际支付12便士后建立一次相邻房间递信约定；另付3灵性并独立检定才实际往返，完成后休息。不统御所有灵，不任意召唤，不携带战斗随从。具体目标、成本和规则为G。' },
  { id: 'death.s6.dead-words', label: '亡者之语', description: '直接针对灵体并绕过血肉保护，不能据此忽略灵体抵抗或保证控制。本段以3灵性、意志14短暂降低原房间一缕轻度躁动亡魂的当前躁动；不杀灭、复活或永久净化。战斗只能针对实际在场且适用的原敌、按公开有限判定结算，不招来幽灵军队；不下放序列5冥界之门。' },
];
export const SPIRIT_GUIDE_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；通灵者消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年导师在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留通灵者消化及全部原掌握；成功只新增两项0掌握，四属性各+1，灵性上限80但当前灵性不补满。';
