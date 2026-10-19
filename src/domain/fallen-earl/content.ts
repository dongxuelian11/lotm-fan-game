import { MENTOR_DISORDER_CLERK, MENTOR_DISORDER_GUIDE, MENTOR_DISORDER_VOLUNTEER } from '../mentor-disorder/content.js';
import type { FallenEarlAbilityId } from './types.js';

/** The ability categories are source-backed. Every scene, number and procedure below is original G. */
export const FALLEN_EARL_GUIDE = MENTOR_DISORDER_GUIDE;
export const FALLEN_EARL_CLERK = MENTOR_DISORDER_CLERK;
export const FALLEN_EARL_VOLUNTEER = MENTOR_DISORDER_VOLUNTEER;
export const FALLEN_EARL_CRATE_ID = 'FE4-CRATE-1';
export const FALLEN_EARL_PAD_ID = 'FE4-PAD-1';
export const FALLEN_EARL_PRICES = { guidance: 540, potion: 6800, labourCredit: 5300 } as const;
export const FALLEN_EARL_MIN_MENTOR_DISORDER_WEEKS = 12;
export const FALLEN_EARL_LABOUR_STEPS = 5;
export const FALLEN_EARL_BOTTLE_IDS = ['fallen-earl-potion-1', 'fallen-earl-potion-2', 'fallen-earl-potion-3'] as const;
export const FALLEN_EARL_SOURCE_STATUS = '堕落伯爵是黑皇帝途径序列4，承接混乱导师5，下一阶为狂乱法师3；第二部第110章明确编号。第五部第79章至第87章支持赠予负面心理状态、放大自身行为、利用已有状态的延长或提前结束，并继承扭曲、混乱与贿赂。赠予不要求先有同种负面状态或交付物品，不能向没有独立心智的已死秘偶生效；不赠送物品、死亡或世界法则。放大通常不能直接增强别人的行为，本切片仅放大自己实际推箱或自己的本次击打，不把原文持物负面及本人所致伤口的案例泛化为任意万能强化。利用只改变已经存在的状态，本次延长自己的普通低跳上升或同一份原赠物已生效的有限削弱；不凭空造状态、停住时间、无限飞行或下放序列2跃月。律师、野蛮人、贿赂者、腐化男爵与混乱导师的原能力、原ID与掌握完整保留，不把特定手表的禁止或随机异变当职业通用能力，也不免费开放神话形态。原米蕾·沃德、原成年伊芙和赛恩仍是同一人，旧里斯不复活。FE4-CRATE-1原轻木箱、FE4-PAD-1原低位软垫、新成年马洛·文恩与净空原外院是本作原创G；所有费用、时长、距离、数值、判定与练习同意同为G，不冒充原著定值或无风险消化保证。';
export const FALLEN_EARL_FORMULA_STATUS = '堕落伯爵完整配方与晋升仪式细节尚未核实，不能据未知细节断言无需仪式。主辅材料、用量、调配顺序与完整仪式步骤保持未知。本作原创G渠道只交付三瓶独立成品原瓶；同一位原成年导师米蕾·沃德实际核对本次原瓶、准备原契约铺安静服药位置并在场照护。这是明确的G专业准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或魔药调配。律师、野蛮人、贿赂者、腐化男爵与混乱导师五个旧阶段的原瓶、晋升、原人物、原物、能力、风险、赠物库存和历史完整保留。';
export const FALLEN_EARL_POTION_SOURCES = FALLEN_EARL_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${FALLEN_EARL_GUIDE}经独立堕落伯爵成品交接渠道实际取得的第${index + 1}瓶序列4堕落伯爵成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非律师、野蛮人、贿赂者、腐化男爵或混乱导师旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const FALLEN_EARL_LABOUR_TASKS = ['核对本瓶独立封签', '整理原契约铺公开交接册', '清点原木箱与普通记录用品', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const FALLEN_EARL_ABILITIES: { id: FallenEarlAbilityId; label: string; description: string }[] = [
  {
    id: 'black-emperor.s4.bestow', label: '有限赠予',
    description: '对仍有独立心智的活人赠予短暂负面心理状态，可抵抗。本次原成年伊芙在原柜台重新明确同意一次有限试验：1行动4灵性、知识18，成功为本人报告缺乏热情30秒，失败照付但没有效果；0行动等待真实剩余秒数后自然恢复。撤回同意停止新增影响，已经生效的状态仍须等完，不是瞬间治疗；普通方法知识10、0灵性只是本人自主暂停。实战K另耗4灵性、知识18，成功仅使下一次实际正贡献BODY或ARC乘0.55一次；本轮镇定可抵抗或清除，已有待生效赠予时不重付。未用状态轮末到期，不控制永久人格，不对已死秘偶生效，不需赠物或已有相同心理状态。所有秒数、成本、比例与判定均为G。',
  },
  {
    id: 'black-emperor.s4.magnify', label: '有限放大',
    description: '本切片只放大自己的实际行为。原导师的同一FE4-CRATE-1轻木箱在无人净空原地轨0至1米内，1行动4灵性、知识18，成功放大自己的当次推力使箱到1米，失败箱留0；普通知识10、0灵性自行推箱。若实际移至1米，必须本人走去1米、抱同一轻箱走回1米并归还原主人；未移动不虚记路程。实战H每次独立花4灵性，把继承徒手或实际手持原棍的单次贡献乘以1+0.25×本项掌握系数，不叠徒手与武器、不叠多层、不送额外攻击；灵性不足用原普通H且不收费。不能随意增强他人或所有事物，所有距离、成本、倍率与判定均为G。',
  },
  {
    id: 'black-emperor.s4.exploit', label: '有限利用',
    description: '只延长已经存在的状态。本人在净空原低位FE4-PAD-1软垫先作普通低跳，再以1行动3灵性、知识18尝试延长已开始的上升运动：成功剩余4秒，失败保留普通1秒，普通方法知识10、0灵性也剩1秒；LAND必须实际经过剩余秒数并落回同一0米原垫，然后收好归还原主人。实战R只在同一份真实原赠物的待生效削弱尚有1次时花3灵性，延至2次且每份限一次；没有现成状态或最后一次已用完则0贡献、不收费。每次实际以玩家为目标的敌方动作消耗一次，敌人自用防御或镇定不消耗；原赠物仍留地面，所有状态轮末到期。不追补、不停时、不无限飞行、不带另一人或提前下放跃月；所有秒数、次数与判定均为G。',
  },
];
export const FALLEN_EARL_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年米蕾在场核对本次原瓶、实际准备原契约铺安静位置并照护；服药必耗选定原瓶，0行动，意志难度28。服药前健康须高于20、精神须高于40，混乱导师消化100且晋升后满12整周，并先结束全部新旧接触、事件和战斗。大成功：晋升、精神−4；成功：晋升、精神−8、灵性−15（最低0）；失败：未晋升、精神−25、健康−15、排异+30；灾难：中断晋升、精神−45、健康−25、排异+60。仅本次G指导服药的健康与精神最低1，保护不适用于战斗或其它危险；原瓶必耗，失败保留混乱导师消化及所有旧掌握，休养后另购新原瓶。成功四属性各+1，灵性上限120但当前灵性不补满，堕落伯爵扮演从0开始，仅新增赠予、放大、利用三项0掌握。原五个阶段、原人物、原物和唯一briber.gifts库存完全不改，既不重新初始化，也不赠送新礼物。';
