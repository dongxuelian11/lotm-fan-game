import { WIND_BLESSED_GUIDE } from '../wind-blessed/content.js';
import type { OceanSingerAbilityId } from './types.js';
export { OCEAN_SINGER_CASE_IDS } from './types.js';

/** Canon boundaries only; this channel, crew, originals, prices and checks are G. */
export const OCEAN_SINGER_GUIDE = WIND_BLESSED_GUIDE;
export const OCEAN_SINGER_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200, ritualTravel: 180, waterFilm: 120 } as const;
export const OCEAN_SINGER_MIN_WIND_BLESSED_WEEKS = 12;
export const OCEAN_SINGER_LABOUR_STEPS = 5;
export const OCEAN_SINGER_BOTTLE_IDS = ['ocean-singer-potion-1', 'ocean-singer-potion-2', 'ocean-singer-potion-3'] as const;
export const OCEAN_SINGER_SOURCE_STATUS = '暴君途径序列5海洋歌者获得浅层雷击、更长的水下活动能力，以及具有不同效果的歌声。歌声可能影响同伴，捂耳不能保证隔绝，也不代表必中或无视全部防御；不会自动排除友军。本作仅以指定原场景的有限歌声、固定原炭靶上的一次低强雷击、旧水流感知与实际小水流核验来练习，不提前给予序列4的雷暴、海啸或大规模海怪统御。继承水手、暴怒之民、航海家与风眷者全部原ID、原掌握、原物与实际历史。原导师艾洛·芬奇、成年米娅、有限码头场景、成品渠道、距离、数值、成本和判定均为原创G，不是原著固定数值或现实安全保证。';
export const OCEAN_SINGER_FORMULA_STATUS = '海洋歌者完整配方尚未核实，材料、剂量和调配顺序保持未知。艾洛·芬奇提供的用药指导与独立成品供给为本作原创G，不解锁配方、材料采购或调配。已知晋升仪式必须在活着的奥布尼斯海怪腹中实际进行，腹内黏液对声音和灵性产生反弹，并有腐蚀危险；持有成品原瓶不能跳过这个真实位置条件。';
export const OCEAN_SINGER_RITUAL_SOURCE = '原著边界为活着的奥布尼斯海怪腹中晋升及黏液反弹、腐蚀危险。以下到访安排全部是原创G：原导师艾洛·芬奇向既有受训仪式船员预约，下一真实周起沿有限近海往返路线实际乘原船抵达近岸；原活海怪OS5-BEAST-1和原船员真实在场。船主使用自己保管的原船与原操纵装置完成本次有限靠近和进入安排，玩家没有获得海怪控制能力。180便士预付实际普通往返，另付120便士才实际施加专业外置密封护身水膜并进入原海怪腹中；这不是航海家的空气泡能力，也不是现实潜水操作指南。每次到访最多服一原瓶。原船员的0行动实际撤出和已付原路返程在成功、失败或放弃后始终可用，消耗不退，不自动治疗。';
export const OCEAN_SINGER_POTION_SOURCES = OCEAN_SINGER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${OCEAN_SINGER_GUIDE}经独立海洋歌者成品交接渠道实际取得的第${index + 1}瓶序列5海洋歌者成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非水手、暴怒之民、航海家或风眷者旧瓶改装，未声称掌握完整配方，仍须实际完成活海怪腹中仪式。`,
}));
export const OCEAN_SINGER_LABOUR_TASKS = ['核对本瓶独立封签', '整理原维修院公开交接册', '清点原码头普通空箱', '校对本瓶交接日期', '复核本瓶成品供货凭据'] as const;
export const OCEAN_SINGER_ABILITIES: { id: OceanSingerAbilityId; label: string; description: string }[] = [
  { id: 'tyrant.s5.sea-song', label: '有限海洋歌声', description: '不同歌声可有不同效果，也可能波及同伴，捂耳不能保证隔绝。原创G排练只在5米有限范围内尝试短暂分神，3灵性、意志14；米娅原位距你2米，须本人同意沿8米普通步道离开到掩蔽位才能安全核验。失败也须停止歌唱并实际恢复交流，不强制睡眠、控制或投降。' },
  { id: 'tyrant.s5.shallow-lightning', label: '浅层雷击', description: '可施行有限雷击，可能失败或被抵抗。本作G和平练习仅在清空的原私人凹间对3米外固定湿炭靶施一次低强雷击，4灵性、知识14；现场目标处没有其他身体或携带金属。没有气象召唤、无限破坏或额外战利品。' },
  { id: 'tyrant.s5.deep-water-activity', label: '较长水下活动', description: '海洋歌者的水下活动能力增强，但不代表无限潜水或任意潜深。本作G先观察原码头盆的实际潮流，至少等下一真实周再付2灵性、知识14，结合继承的水流感知与实际小水流作对照。此项限度知识不冒充一次未发生的水下旅行，也不赠海怪统御。' },
];
export const OCEAN_SINGER_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：必须实际处于原活奥布尼斯海怪腹中，原船员和原兽在场，专业外置护身水膜已施加，本次到访未服过原瓶。独立确认服药耗选定原瓶，0行动、意志26；风眷者消化100且晋升后满12整周，健康高于20、精神高于40。大成功晋升并精神−5；成功晋升并精神−10；失败未晋升、精神−20、健康−10、排异+25；灾难中断晋升、精神−40、健康−20、排异+50。导师和船员处理本次服药排异，不随机即死；失败仍需实际撤出后回原码头休养，原瓶不复原。成功只新增三项0掌握，四属性各+1，灵性上限100但当前灵性不补满；保留旧消化、原掌握和实际历史。服药不会自动离开腹中、补灵性或退款；保护不适用于战斗和其它危险。';
