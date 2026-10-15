import { PAIN_GUIDE, PAIN_VOLUNTEER } from '../pain/content.js';
import type { DespairAbilityId } from './types.js';

/** Source boundaries are kept separate from this finite original G implementation. */
export const DESPAIR_GUIDE = PAIN_GUIDE;
export const DESPAIR_VOLUNTEER = PAIN_VOLUNTEER;
export const DESPAIR_STORAGE_KEEPER = '成年保管员玛拉·维尔';
export const DESPAIR_PRICES = { guidance: 540, potion: 6800, labourCredit: 5300 } as const;
export const DESPAIR_MIN_PAIN_WEEKS = 12;
export const DESPAIR_LABOUR_STEPS = 5;
export const DESPAIR_BOTTLE_IDS = ['despair-potion-1', 'despair-potion-2', 'despair-potion-3'] as const;
export const DESPAIR_SOURCE_STATUS = '魔女途径序列4绝望的超自然疾病与瘟疫会随持续暴露逐渐加深，可影响实际动作及能力施展；离开区域或使用纸替身不自动消除已有感染。原著成熟角色的城市级灾难展示不能当作所有新晋绝望魔女的统一半径；风雨可以驱散暴露环境，不保证每个既有病例立刻恢复。主动撤回疾病或瘟疫有依据，但不据此承诺所有感染者瞬间痊愈，也没有友军天然免疫。潘娜蒂亚制造雾霾时已经是序列4，其消化行为不能冒充5→4晋升仪式。不完整神话形态可能污染旁观者并使自身失控，本有限切片不开放变身、石化或镜中迷宫；下一序列3不老魔女的寿命、镜界逃离与高阶复生未获得。原成年导师诺艾拉·温瑟、成年演员拉维妮、原刺客至痛苦魔女的全部能力ID与掌握、身体变化、原药瓶、原材料、粉剂、小镜、蛛丝、原奥伦的真实生死与病势都完整保留。新成年保管员玛拉·维尔、原空推车DP4-CART-1、原路牌DP4-BOARD-1、纸覆盖片DP4-OVERLAY-1、三张编号情境卡DP4-CARD-1/2/3、原文件夹DP4-FOLDER-1及成年对手瓦伦·霍尔特均为本作原创G。三项和平练习只作双方明确愿意的普通应急演练；症状纯属纸面虚构，不对参与者施加疾病、不把模拟算成疾病能力掌握，不提供现实病原体、传播操作或医疗配方。全部场景数值、10米有限战斗场、成熟周数与专业准备流程均为G，不宣称完整还原原著扮演与仪式。';
export const DESPAIR_FORMULA_STATUS = '绝望魔女完整配方与晋升仪式细节尚未核实；不能据未知细节断言无需仪式。材料、用量、调配顺序及仪式步骤保持未知，潘娜蒂亚已晋4后的雾霾消化不能充当5→4仪式。本作原创G渠道只提供独立成品原瓶；原成年导师诺艾拉·温瑟实际核对本次原瓶、准备原独立练习场的安静服药场地并在场照护，再指导本次服药。这是明确的G专业准备流程，不冒充已还原原著仪式，不要求制造雾霾或伤害人群，也不解锁完整配方、材料采购或魔药调配。此前欢愉魔女七项已知配方及其原材料与真实调配记录保留。';
export const DESPAIR_POTION_SOURCES = DESPAIR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${DESPAIR_GUIDE}经独立绝望魔女成品交接渠道实际取得的第${index + 1}瓶序列4绝望魔女成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非刺客、教唆者、女巫、欢愉魔女或痛苦魔女旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const DESPAIR_LABOUR_TASKS = ['核对本瓶独立封签', '整理原练习场公开交接册', '清点原附室普通路牌', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const DESPAIR_ABILITIES: { id: DespairAbilityId; label: string; description: string }[] = [
  { id: 'assassin.s4.plague', label: '渐进瘟疫与有限施法干扰', description: '本有限G空院实战只有4米外的成年原对手，没有旁观者；10米限域不是原著统一半径，更不代表友军免疫。实际抽中K后花4灵性、知识18成功才开启场并使这一个原目标病势1；每个后续真实回合维持实付2灵性才增长，最多6。防御或撤退在本轮增长前明确撤场，不再付维持费；已有病势保留。病势达到3后，每轮第一项真实符合条件的敌方施法可接受有限症状干扰检定，仍可能抵抗，不能封死整轮或编造已经支付的法术。身体正向贡献最多减少30%，不直接扣健康或绕过共同伤势盘杀死目标。终局停场不治愈；尚活着的原目标经不同真实周的实际专业照护逐次降低2病势，死亡不复原。继承黑焰、冰霜、原镜、原粉剂与实体丝线仍有各自成本和原ID。和平练习不启动瘟疫场、不奖励此能力掌握。' },
];
export const DESPAIR_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原独立练习场安静场地并照护；服药必耗选定原瓶，0行动，意志难度28。服药前健康须高于20、精神须高于40，痛苦魔女消化100且晋升后满12整周，并先结束旧实践、新接触、事件和战斗。大成功：晋升、精神−4；成功：晋升、精神−8、灵性−15（最低0）；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。仅本次G指导服药的健康与精神最低保留1，导师照护后仍须休养；原瓶不会复原，此保护不适用于战斗或其它危险。失败保留痛苦魔女消化与全部旧掌握；成功四属性各+1，只新增assassin.s4.plague一项0掌握，扮演从0开始，痛苦魔女消化100快照保留，灵性上限120且当前灵性不补满。原身体与性别变化记录不变，不发生第二次身体转变；旧ID、原药瓶、材料、工具、同意与拒绝记录、真实感染和敌人生死均完整保留。没有附赠神话变身或序列3不老魔女能力。';
