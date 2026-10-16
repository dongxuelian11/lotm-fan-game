import { HYPNOTIST_GUIDE } from '../hypnotist/content.js';
import type { DreamwalkerAbilityId } from './types.js';
export { DREAMWALKER_CASE_IDS } from './types.js';

/** Dreamwalker acquisition ritual: Book 5 chapter 69. Angel substitution in chapter 115 is an exceptional case. */
export const DREAMWALKER_GUIDE = HYPNOTIST_GUIDE;
export const DREAMWALKER_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200, ritual: 120 } as const;
export const DREAMWALKER_MIN_HYPNOTIST_WEEKS = 12;
export const DREAMWALKER_LABOUR_STEPS = 5;
export const DREAMWALKER_BOTTLE_IDS = ['dreamwalker-potion-1', 'dreamwalker-potion-2', 'dreamwalker-potion-3'] as const;
export const DREAMWALKER_FEATHER_ID = 'DW5-FEATHER';
export const DREAMWALKER_RITUAL_PARTICIPANT = '铃尾';
export const DREAMWALKER_SOURCE_STATUS = '第五部第69章核实晋升梦境行者的必要仪式：与灵界人头鸟妖签订契约，持有其一根尾羽，在激烈情绪中服药，并由外力唤醒，防止永久沉睡。第五部第115章的天使替代属于个例，本作不把它变成可复制的捷径。铃尾是原阅览室观察导师已有专业联系的一位有智慧的灵界人头鸟妖，为本作原创G固定角色；它实际到场、自主接受约定，仅在预约会面中承担唤醒职责，玩家没有召唤任意鸟妖的能力。保留观众、读心者、心理医生、催眠师全部原能力及原ID掌握，只新增梦境引导、梦境修改、梦境穿梭。具体练习、固定成人对象、双房间边界、供给、成熟周数与数值均为本作原创G；梦境不能直接当作事实证词，修改不保证治疗或永久改变人格，穿梭不是灵界旅游或任意传送。';
export const DREAMWALKER_FORMULA_STATUS = '梦境行者完整配方尚未核实，不能拼补缺失材料、用量或调配顺序。指导不解锁配方、材料采购或调配；本作仅提供原创G渠道实际供应的序列5独立成品原瓶。';
export const DREAMWALKER_POTION_SOURCES = DREAMWALKER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${DREAMWALKER_GUIDE}经独立梦境行者成品联络渠道实际取得的第${index + 1}瓶序列5梦境行者成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非观众、读心者、心理医生或催眠师旧瓶改装，未声称掌握完整配方。`,
}));
export const DREAMWALKER_LABOUR_TASKS = ['核对本瓶独立封签', '整理原阅览室公开目录', '清点原会所专室普通座椅', '校对本瓶交付日期', '复核本瓶独立供货凭据'] as const;
export const DREAMWALKER_ABILITIES: { id: DreamwalkerAbilityId; label: string; description: string }[] = [
  { id: 'audience.s5.dream-guidance', label: '梦境引导', description: '有限引导梦中情境，梦境内容仍可能混合记忆、想象与暗示，必须回到清醒现实核验，不把梦话当作事实或无误证词。具体自愿练习与判定为G。' },
  { id: 'audience.s5.dream-modification', label: '梦境修改', description: '修改局部梦境以形成有限反馈，本作须跨真实周复访并在清醒后核验；不能保证治疗、清除创伤、永久控制思想或改写他人现实经历。具体数值为G。' },
  { id: 'audience.s5.dream-travel', label: '梦境穿梭', description: '借助相互关联的梦境进行有限穿梭；本作只允许已建立、本人同意的两名成人与两间固定房间之间往返，必须返回源房间并清醒核验。不是任意传送、灵界旅游或凭空生成通路。' },
];
export const DREAMWALKER_CONSUMPTION_RISK = '以下安排、代价与判定均为原创G：预约1行动，下一真实周起可花1行动、120便士在原会所专室进行一次铃尾实际到场的会面。唯一契约与唯一原尾羽DW5-FEATHER不会复制；本次会面只可服一瓶。须催眠师消化100、晋升后满12整周、健康>20且精神>40，再独立确认本次服药。持原尾羽、铃尾在场可唤醒、契约有效及本人真实喜悦回忆激起明确强烈情绪，四者均不可省略。服药耗原瓶，0行动，意志难度26；大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。铃尾实际将你唤醒，导师处理排异，不随机即死；休养可恢复，原瓶不会复原。失败须先结束会面、归还同一根尾羽，再另行预约下一真实周会面。成功保留全部旧掌握，只新增三项0掌握，四属性各+1，灵性上限100且当前灵性不补满。';
