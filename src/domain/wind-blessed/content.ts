import { NAVIGATOR_GUIDE } from '../navigator/content.js';
import type { WindBlessedAbilityId } from './types.js';
export { WIND_BLESSED_CASE_IDS } from './types.js';

/** Canon boundaries are distinct from the original G channel, scenes, costs and checks. */
export const WIND_BLESSED_GUIDE = NAVIGATOR_GUIDE;
export const WIND_BLESSED_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const WIND_BLESSED_MIN_NAVIGATOR_WEEKS = 12;
export const WIND_BLESSED_LABOUR_STEPS = 5;
export const WIND_BLESSED_BOTTLE_IDS = ['wind-blessed-potion-1', 'wind-blessed-potion-2', 'wind-blessed-potion-3'] as const;
export const WIND_BLESSED_SOURCE_STATUS = '第一部第190章《能力的搭配》支持以自身为中心的狂风、风刃与短程借风飞行；第三部第152章有浮空个例；第二部第212章的短距携一人个例不能推广成无限载重或任意携人。本阶段只在本人、原物与获准现场有限使用控风、风刃和短程风托，不改变全城天气，不携其他人，不额外搬运原场物或大件；本人原随身物仍在原保管中。保留水手、暴怒之民、航海家全部原ID与掌握；不下放序列5海洋歌者的歌声或雷击。潜深、航程、距离、费用、检定、成年角色和成品供给均是本作原创G，不声称原著固定数值或现实安全保证。';
export const WIND_BLESSED_FORMULA_STATUS = '风眷者完整配方尚未核实：已核正文只支持主材料蓝影隼结晶羽毛6根与龙眼海雕眼珠1对，不能据此拼补辅料、剂量或调配顺序。本阶段G用药指导不解锁配方、材料采购或调配，仅交付独立成品原瓶。';
export const WIND_BLESSED_POTION_SOURCES = WIND_BLESSED_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${WIND_BLESSED_GUIDE}经独立风眷者成品交接渠道实际取得的第${index + 1}瓶序列6风眷者成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非水手、暴怒之民或航海家旧瓶改装，未声称掌握完整配方。`,
}));
export const WIND_BLESSED_LABOUR_TASKS = ['核对本瓶独立封签', '整理原维修院公开交接册', '清点原维修院普通支杆', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const WIND_BLESSED_ABILITIES: { id: WindBlessedAbilityId; label: string; description: string }[] = [
  { id: 'tyrant.s6.wind-control', label: '有限控风', description: '可引动自身周围的风，本阶段只在获准原工作框内稳定一块原帆布；有限控风可以失败，不操控全城天气。目标、距离、成本与判定为G。' },
  { id: 'tyrant.s6.wind-blade', label: '风刃', description: '形成有限风刃，本阶段和平实践只切获准的原普通薄木条，不能据此宣称穿甲或打击远处NPC。战斗仅使用实际在场的原敌与公开盘；不下放歌声或雷击。成本与判定为G。' },
  { id: 'tyrant.s6.short-flight', label: '短程借风飞行', description: '借风托举本人短程移动。本阶段原低台水平6米、高2米，原8米普通楼梯回路始终开放，不携其他人，不额外搬运原场物或大件；本人原随身物仍在原保管中。去程3灵性、体质14；返程另选2灵性、独立体质14，失败留在原台面，或沿原楼梯0灵性返回。没有永久飞行、免费返程或隐式位置跳转，全部距离与判定为G。' },
];
export const WIND_BLESSED_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；航海家消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年导师在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留航海家消化及全部原掌握；成功只新增三项0掌握，四属性各+1，灵性上限80但当前灵性不补满。';
