import { PSYCHOLOGIST_GUIDE } from '../psychologist/content.js';
import type { HypnotistAbilityId } from './types.js';
export { HYPNOTIST_CASE_IDS } from './types.js';

/** Canon: Book 4 ch.127, Book 5 ch.57 and ch.72. Supply and all numerical rules are original G. */
export const HYPNOTIST_GUIDE = PSYCHOLOGIST_GUIDE;
export const HYPNOTIST_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const HYPNOTIST_MIN_PSYCHOLOGIST_WEEKS = 12;
export const HYPNOTIST_LABOUR_STEPS = 5;
export const HYPNOTIST_BOTTLE_IDS = ['hypnotist-potion-1', 'hypnotist-potion-2', 'hypnotist-potion-3'] as const;
export const HYPNOTIST_SOURCE_STATUS = '第四部第127章《新的蘑菇》支持催眠师新晋时的体能增强和鳞片，以及非战斗催眠须真正集中注意、触及生命或最珍视之物会激起强烈反抗、坚定心智可抵抗的边界。战斗催眠短暂，不能命令自杀。第五部第72章的心理学隐身是认知忽略，讲话或大动静会破除，实体仍会碰撞；第五部第57章支持预先约定钟声结束。保留观众、读心者与心理医生的全部原ID能力和掌握；本阶段只新增催眠、战斗催眠、心理学隐身与鳞片，不下放序列5梦境引导、修改和穿梭。导师沿已认识的成年阅览室观察导师渠道；三项自愿练习、成人角色、原会所后门争议、独立成品、成熟周数与全部数值均为本作原创G。没有全知供词、洗脑、医疗保证或现实催眠教程。';
export const HYPNOTIST_FORMULA_STATUS = '催眠师完整配方尚未核实：部分主材已核，但完整辅料、用量与调配顺序不能拼补。指导不解锁配方、采购材料或调配；目前仅能取得本作原创G渠道实际供应的序列6独立成品原瓶。';
export const HYPNOTIST_POTION_SOURCES = HYPNOTIST_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${HYPNOTIST_GUIDE}经独立催眠师成品联络渠道实际取得的第${index + 1}瓶序列6催眠师成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非观众、读心者或心理医生旧瓶改装，未声称掌握完整配方。`,
}));
export const HYPNOTIST_LABOUR_TASKS = ['核对本瓶独立封签', '整理阅览室公开借阅册', '清点原会谈室普通座椅', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const HYPNOTIST_ABILITIES: { id: HypnotistAbilityId; label: string; description: string }[] = [
  { id: 'audience.s6.hypnosis', label: '催眠', description: '非战斗催眠需要对象真正集中注意。坚定心智能够抵抗，触及生命或最珍视之物会激起强烈反抗。本阶段练习只做本人同意的短时任务，按已约定信号停止；不强取供词或承诺治疗。具体判定为G。' },
  { id: 'audience.s6.combat-hypnosis', label: '战斗催眠', description: '在战斗中施加可被抵抗的短暂精神影响，不要求长时准备，也不等于永久控制。不能命令目标自杀或任意伤害最珍视之物；本轮效果由共享战斗结算，具体数值为G。' },
  { id: 'audience.s6.psychological-invisibility', label: '心理学隐身', description: '让观察者在认知上忽略自己；身体仍在原处，仍需绕开原物。本人讲话或大动静会破除，不能穿墙、隐去物体或保证无人注意。具体判定为G。' },
  { id: 'audience.s6.scales', label: '鳞片', description: '催眠师可在体表浮现鳞片，提供有限防护。不是无敌、钢铁实体化或免费治疗，不抹去既有伤势；本作战斗数值为G。' },
];
export const HYPNOTIST_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；心理医生消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年观察导师在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留心理医生消化及全部原掌握；成功只新增四项0掌握，四属性各+1，灵性上限80但当前灵性不补满。';
