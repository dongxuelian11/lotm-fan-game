import { WINNER_GUIDE, WINNER_VOLUNTEER } from '../winner/content.js';
import type { MisfortuneMageAbilityId } from './types.js';

/** Candidate mapping only. Every new S4 exercise, upgrade, number and scene is game-original G. */
export const MISFORTUNE_MAGE_GUIDE = WINNER_GUIDE;
export const MISFORTUNE_MAGE_VOLUNTEER = WINNER_VOLUNTEER;
export const MISFORTUNE_MAGE_WEIGHT_ID = 'MM4-WEIGHT-1';
export const MISFORTUNE_MAGE_CORD_ID = 'MM4-CORD-1';
export const MISFORTUNE_MAGE_BAG_ID = 'MM4-BAG-1';
export const MISFORTUNE_MAGE_NOTE_ID = 'MM4-NOTE-1';
export const MISFORTUNE_MAGE_PRICES = { guidance: 540, potion: 6800, labourCredit: 5300 } as const;
export const MISFORTUNE_MAGE_MIN_WINNER_WEEKS = 12;
export const MISFORTUNE_MAGE_LABOUR_STEPS = 5;
export const MISFORTUNE_MAGE_BOTTLE_IDS = ['misfortune-mage-potion-1', 'misfortune-mage-potion-2', 'misfortune-mage-potion-3'] as const;
export const MISFORTUNE_MAGE_SOURCE_STATUS = '本作沿用既有候选映射：命运之轮序列4厄运法师，下一阶候选序列3混乱行者。本次上传原著正文尚未直接核实这两个编号及厄运法师的职业新增技能表；第六部第77章仅在1级封印物的混合特性描述中以推测方式提到厄运法师与混乱行者，不能把整件封印物的权能全部授予职业。本切片两项新增“预防延伸实践”和“有界厄运延伸实践”、强化、场地、同意、数值、时长与判定全部明确为本作原创G，不声称原著序列4已完整还原。继承已核实的幸运者7被动幸运波动、灾祸教士6有限灾难感知/招灾/精神风暴、赢家5节制积累与有限幸运和厄运；继承不等于升级成无条件成功。原winner.luck是唯一幸运账本，容量仍3，每真实周最多实际积累1份，消耗失败不退，晋升不重置、不复制、不自动补满；不会附加普遍等量厄运债。没有概率之骰、重掷、重启、改写过去、无限预知、强迫意志或永久诅咒。原艾妲·芬恩、成年塞拉、旧奥德里结果及旧木筹/原环/原纸保持原状态；MM4-WEIGHT-1、MM4-CORD-1、MM4-BAG-1、MM4-NOTE-1是本次独立有主原物。新的成年费里斯·洛恩与净空原后院对抗同为G，不重新激活旧敌。三项有限实践均有普通方法；和平100仍需真实成本、原物归还与诚实报告，不是无风险消化的原著保证。';
export const MISFORTUNE_MAGE_FORMULA_STATUS = '厄运法师的候选序列编号、完整配方与晋升仪式细节尚未核实，不能据未知细节断言无需仪式。主辅材料、用量、调配顺序与完整仪式步骤保持未知。本作原创G渠道只交付三瓶独立成品原瓶；同一位原成年导师艾妲·芬恩实际核对本次原瓶、准备原报时铺安静服药位置并在场照护。这是明确的G专业准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或魔药调配。怪物、机器、幸运者、灾祸教士与赢家五个旧阶段的原瓶、晋升、原人物、原物、能力、风险和幸运账本完整保留。';
export const MISFORTUNE_MAGE_POTION_SOURCES = MISFORTUNE_MAGE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${MISFORTUNE_MAGE_GUIDE}经独立厄运法师成品交接渠道实际取得的第${index + 1}瓶候选序列4厄运法师成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非怪物、机器、幸运者、灾祸教士或赢家旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const MISFORTUNE_MAGE_LABOUR_TASKS = ['核对本瓶独立封签', '整理原报时铺公开交接册', '清点原软盘与普通记录用品', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const MISFORTUNE_MAGE_ABILITIES: { id: MisfortuneMageAbilityId; label: string; description: string }[] = [
  {
    id: 'wheel.s4.precaution-practice', label: '预防延伸实践（原创G）',
    description: '此项为继承灾难感知的有限原创G延伸实践，尚未核实为原著序列4新增职业能力。原艾妲允许一次无人在坠物下的受控观察：1行动、3灵性、知识18，成功只记录同一小钟锤MM4-WEIGHT-1存在可能滑落的征兆，失败如实记为未能确定，不读取未来随机数或创造灾难。之后成败均须以原绳MM4-CORD-1把同一锤降到原软盘，再交还主人；普通知识10、0灵性检查同物，不奖励超凡掌握。实战本轮明确选择SPEND_FIRST时，首个有资格B/K才能花原储备1份与4灵性；B仅提供40×本项掌握系数的有限减势，不回血、不取消敌方行动、不保证无伤。',
  },
  {
    id: 'wheel.s4.bounded-misfortune', label: '有界厄运延伸实践（原创G）',
    description: '此项为继承赢家有限厄运的原创G延伸实践，尚未核实为原著序列4新增职业能力。原成年塞拉为一次低桩软垫上的原豆袋MM4-BAG-1投掷重新明确同意；1行动、5灵性、1份原幸运，知识18，成功仅使本次实际投掷偏离，失败为未受影响的实际命中，失败不退款。普通观察知识10、0灵性、0幸运，不改变投掷；同一袋每次落在2米外原垫，玩家实际去回4米拾取并亲手归还。撤回同意立即结束效果，已投出的袋仍须取回。实战首个有资格B/K共用本轮1份限额，K另付4灵性并作知识18判定；成功仅使本轮下一次实际正贡献BODY或ARC减半一次，目标本轮镇定可抵抗但成本保留。WARD、COMPOSE、ACCIDENT和0贡献不消耗待生效状态，轮末或终局未用即到期，不追补、不重掷或产生永久诅咒。',
  },
];
export const MISFORTUNE_MAGE_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年艾妲在场核对本次原瓶、实际准备原报时铺安静位置并照护；服药必耗选定原瓶，0行动，意志难度28。服药前健康须高于20、精神须高于40，赢家消化100且晋升后满12整周，并先结束全部新旧接触、事件和战斗。大成功：晋升、精神−4；成功：晋升、精神−8、灵性−15（最低0）；失败：未晋升、精神−25、健康−15、排异+30；灾难：中断晋升、精神−45、健康−25、排异+60。仅本次G指导服药的健康与精神最低1，保护不适用于战斗或其它危险；原瓶必耗，失败保留赢家消化及所有旧掌握，休养后另购新原瓶。成功四属性各+1，灵性上限120但当前灵性不补满，候选厄运法师扮演从0开始，只新增两项原创G延伸实践0掌握。原五个阶段和唯一winner.luck幸运账本完全不改，既不重新初始化也不赠送幸运或附加等量厄运债。';
