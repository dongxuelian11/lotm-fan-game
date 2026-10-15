import { CALAMITY_PRIEST_GUIDE } from '../calamity-priest/content.js';
import type { WinnerAbilityId } from './types.js';
export { WINNER_CASE_IDS } from './types.js';

/** All numeric costs, recharge limits and scene procedures below are original G rules. */
export const WINNER_GUIDE = CALAMITY_PRIEST_GUIDE;
export const WINNER_VOLUNTEER = '成年志愿者塞拉（Sella）';
export const WINNER_COUNTER_ID = 'WN5-COUNTER-1';
export const WINNER_RING_ID = 'WN5-RING-1';
export const WINNER_NOTE_ID = 'WN5-NOTE-1';
export const WINNER_LUCK_CAPACITY = 3;
export const WINNER_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const WINNER_MIN_CALAMITY_PRIEST_WEEKS = 12;
export const WINNER_LABOUR_STEPS = 5;
export const WINNER_BOTTLE_IDS = ['winner-potion-1', 'winner-potion-2', 'winner-potion-3'] as const;
export const WINNER_SOURCE_STATUS = '赢家是命运之轮途径序列5，承接怪物9、机器8、幸运者7和灾祸教士6。第四部第178章支持一定程度掌控自己的幸运，通过平时节制积累，在关键时刻多次转危为安，并有限带来敌人厄运；占卜与反占卜的增强不等于获知一切真相。第四部第196章恩佐消耗剩余幸运施加厄运，攻击仍可能命中假目标，储备会耗尽，不能保证胜利。原低序列能力、污染、被动幸运波动与灾祸风险完整继承，不因晋升清除旧后果。此处新建的有限幸运储备初始为0、容量3，每真实周最多花1行动在原报时铺艾妲的指导室实际安静节制积累1份；不是原著给定的单位或恢复公式，不是休养自动充值、购买幸运或跨人转移，也不附加普遍等量厄运债。能力实践和战斗实付1份后失败仍不退还，不能重掷、改写过去或指定成功。序列7被动幸运独立保留，不能用储备强制触发。原艾妲·芬恩、成年塞拉、成年奥德里、轻木筹WN5-COUNTER-1、塞拉的原环WN5-RING-1、原记录纸WN5-NOTE-1、低桌软盘与软垫场地、全部数值与有限流程均为原创G。试验只限本人同意的本次安全瞄准，不是控制情绪、人格、意愿或永久诅咒；不将封印物的混合高阶权能、概率之骰或水银之蛇重启下放到赢家，也不提前实现序列4。和平100仍需真实行动、收束和报告，不是原著保证的无代价消化法。';
export const WINNER_FORMULA_STATUS = '赢家完整配方、主辅材料及其用量、调配顺序与6→5晋升仪式细节尚未核实，不能据未知细节断言无需仪式。本作原创G渠道只交付独立成品原瓶；同一位原成年导师艾妲·芬恩实际核对本次原瓶、准备原报时铺的安静服药位置并在场照护。这是明确的G准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。此前怪物、机器、幸运者和灾祸教士的原瓶、原晋升、实践事实、原物、原能力与风险历史完整保留。';
export const WINNER_POTION_SOURCES = WINNER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${WINNER_GUIDE}经独立赢家成品交接渠道实际取得的第${index + 1}瓶序列5赢家成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非怪物、机器、幸运者或灾祸教士旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const WINNER_LABOUR_TASKS = ['核对本瓶独立封签', '整理原报时铺公开交接册', '清点原软盘与普通记录用品', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const WINNER_ABILITIES: { id: WinnerAbilityId; label: string; description: string }[] = [
  { id: 'wheel.s5.luck-reserve', label: '幸运积累与有限运用', description: '平时节制积累幸运，在关键时刻部分引导自身幸运，不保证成功。有限G储备初始0、容量3；每真实周最多花1行动在原指导室实际积累1份，0灵性、不治疗、不自动充满。原轻木筹实践能力方法实付1行动、2灵性与1份幸运，以知识9代替本作G原难度14，等效成功机会增加10点，仍读取同一次真实判定；失败也落入同一软盘且必须归还。普通方法知识12、0灵性、0幸运，实际用原盘接取。战斗默认保留储备，只有当轮明确选择优先使用，首个合法B或K才可耗1份；B另耗2灵性仅提供该槽24有限防御贡献，不恢复健康或保证无伤。' },
  { id: 'wheel.s5.ill-fortune', label: '有限厄运', description: '有限影响敌人的运气，储备会耗尽，目标、来源和时机仍须真实有效。本次成年塞拉只同意用她原环在低桩与软垫进行一次安全瞄准，能力方法1行动、2灵性、1份幸运、知识14；失败同样付费，不能声称控制她的人格或让所有人必然失手。普通方法只是观察同一次实际瞄准并记录。实战每轮B/K合计最多耗1份，K另耗2灵性与知识14，成功仅削减本回合下一次实际正贡献普通攻击一半一次；失败没有削减，轮末与终局到期，不倒追已发生的攻击、不留下永久诅咒。' },
];
export const WINNER_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年艾妲在场核对本次原瓶、实际准备原报时铺安静位置并照护；服药必耗选定原瓶，0行动，意志难度26。服药前健康须高于20、精神须高于40，不足时先休养；灾祸教士消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。艾妲处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留灾祸教士消化及全部原掌握；成功仅新增wheel.s5.luck-reserve与wheel.s5.ill-fortune两项0掌握，四属性各+1，灵性上限100但当前灵性不补满，幸运储备从0开始。全部旧ID、原瓶、实践、原物、敌人结果和风险记录保留，必须先结束旧接触。储备容量3、每周实际积累1份和全部使用成本均为G，消化100不自动补充储备，不保证连续获胜，也不新增序列4或封印物混合权能。';
