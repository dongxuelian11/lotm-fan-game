import type { FerrymanAbilityId, FerrymanChannelId, FerrymanPreparationId } from './types.js';

/** Only S3/S2 names and the S4-only cycle boundary are source-verified. All playable additions below are original G. */
export const FERRYMAN_PROVIDERS = {
  ORIGINAL: { id: 'FR3-LEWIS', name: '路易斯·赛尔', ageAtIntroduction: 56 },
  POST_CYCLE: { id: 'FR3-HANNA', name: '汉娜·斯托克', ageAtIntroduction: 43 },
} as const;
export const FERRYMAN_GUIDE = '路易斯·赛尔（FR3-LEWIS，实际原时代介绍时56岁）';
export const FERRYMAN_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const FERRYMAN_POST_CYCLE_PRICES = { guidance: 120, potion: 1200, labourCredit: 1120, preparation: 20 } as const;
export const ferrymanPrices = (id: FerrymanChannelId) => id === 'POST_CYCLE' ? FERRYMAN_POST_CYCLE_PRICES : FERRYMAN_PRICES;
export const FERRYMAN_MIN_UNDYING_WEEKS = 12;
export const FERRYMAN_LABOUR_STEPS = 5;
export const ferrymanBottleId = (channel: FerrymanChannelId, number: number) => `ferryman-${channel.toLowerCase().replace('_', '-')}-potion-${number}`;
export const FERRYMAN_BOTTLE_IDS = [1, 2, 3].map(n => ferrymanBottleId('ORIGINAL', n));
export const FERRYMAN_FORMULA_STATUS = '死神序列3摆渡人名称已核实，完整配方与晋升仪式尚未核实，新增纯本体技能名录也未核实。材料、数量、调配顺序和完整仪式保持未知，不能断言无需仪式。以下独立成品渠道、三项专业准备及本周场地检查均为本作原创G支持流程，不冒充原著配方或晋升仪式，不复用序列4原纪念仪式。';
export const FERRYMAN_SOURCE_STATUS = '第四部第168章直接明确序列3摆渡人，第四部第187章直接明确下一序列2死亡执政官；序列2能力未核，本阶段不开放。第三部第106章说明六十年死亡、复起与失忆属于序列4不死者阶段：真实晋升3后不再触发该阶段周期，已发生的死亡、复起与有限寻回历史仍保留。这不提供即时战斗复活。受污染、跨途径前首席的河流陵寝不作为纯序列3技能。下面两项技巧、人物、供给、价格、距离、时长和战斗定量全部为原创G。';
export function ferrymanPotionSource(channel: FerrymanChannelId, number: number, week: number): string {
  const p = FERRYMAN_PROVIDERS[channel];
  return `${p.name}（${p.id}）在${channel === 'ORIGINAL' ? '原时代' : '首次周期后当前时代'}独立提供的本作G摆渡人成品，第${Math.ceil(number / 3)}批、第${week}周实际入库，独立封存原瓶${ferrymanBottleId(channel, number)}。非任何旧序列原瓶改装，非旧导师跨越六十年仍在等待；完整配方与原著晋升仪式仍未知。`;
}
export const FERRYMAN_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const FERRYMAN_PREPARATIONS: { id: FerrymanPreparationId; title: string; description: string }[] = [
  { id: 'CHECK_ROUTE', title: '亲自核对当前渠道与普通路线', description: '在本次真实介绍的供应人处核对同一原瓶、来源和普通出口。旧渠道结束后不能把旧同意、劳务或旧原瓶换成当前来源；此项并非原著仪式。' },
  { id: 'REVIEW_IDENTITY', title: '实际复核身份与记忆边界', description: '本人按当前已知原记录说明身份与有限记忆边界。晋升不重建失忆内容、不还原旧人物、不复活亡者；后世供应人是新原人，旧记忆知识不等于当前约定。' },
  { id: 'PLAN_RETURN', title: '实际检查停止次序与普通返程', description: '本人在本次指导场核对自愿许可、有限能力的停止次序和普通退路。成品与专业准备不带来任意冥界传送、永久控制或战斗复活。' },
];
export const FERRYMAN_ABILITIES: { id: FerrymanAbilityId; label: string; description: string }[] = [
  { id: 'death.s3.bounded-ferry', label: '有限摆渡（本作G）', description: '纯序列3新增技能未原核，本作原创G以6灵性、意志18有限引导一个实际且当前自愿的原灵经过已核实两端点。20秒窗口只容该原灵，本次原灵材照耗；失败可由同一原灵自愿沿16米普通迂回道行走。不能自动复活、强迫灵体、移动活人或任意冥界传送。战斗仅有限灵体迟滞减势36G，不直接威胁或控制人格。' },
  { id: 'death.s3.departure-ward', label: '离程屏护（本作G）', description: '纯序列3新增技能未原核，本作原创G以6灵性、知识18在20秒内压低同一原低强回响的躁动。期间须普通合盖封存；停止后回响本质仍在，失败可用原夹具普通收口。不是净化人格、消灭原灵或永久控制。战斗仅短暂压低攻击窗口减势32G，不直接扣健康或精神。' },
];
export const FERRYMAN_CONSUMPTION_RISK = '以下具体规则全部为本作G：不死者消化100、真实晋4后12整周、健康>20且精神>40；当前渠道三项不同的1行动准备之后，再付1行动检查本周场地（原时代120便士，后世20便士），0行动独立确认所选原瓶。意志难度30；大成功晋升精神−8，成功晋升精神−15；失败健康−15、精神−25、排异+30，灾难健康−25、精神−45、排异+60，均未晋升。原瓶与本次检查均耗尽；三项当前专业经历保留，休养后可重新检查并筹另一瓶。支持仅把本次药物排异的健康精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，新掌握0，灵性上限120且当前不补满，身体性别不改变。不死者原消化100、原灰羽、欧文、伊芙琳、原簿与原回信历史保留；序列4周期资格在真实晋升日期结束，不删除已发生的首次周期，不提供即时复活。';
