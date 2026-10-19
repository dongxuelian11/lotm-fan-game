import { ROSE_BISHOP_GUIDE } from '../rose-bishop/content.js';
import type { ShepherdAbilityId, ShepherdSpiritSource } from './types.js';
export { SHEPHERD_CASE_IDS, SHEPHERD_CAPACITY, SHEPHERD_MAX_SELECTED_ABILITIES, SHEPHERD_SPIRIT_IDS } from './types.js';

export const SHEPHERD_GUIDE = ROSE_BISHOP_GUIDE;
export const SHEPHERD_VOLUNTEER = '成年志愿者文森（Venson）';
export const SHEPHERD_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const SHEPHERD_MIN_ROSE_BISHOP_WEEKS = 12;
export const SHEPHERD_LABOUR_STEPS = 5;
export const SHEPHERD_BOTTLE_IDS = ['shepherd-potion-1', 'shepherd-potion-2', 'shepherd-potion-3'] as const;
export const SHEPHERD_SOURCE_STATUS = '牧羊人是倒吊人途径的序列5。第一部第190章支持最多放牧7个灵魂，每灵可挑选至多3项能力，同一时刻只驱使1灵并配合自身能力，灵魂间可瞬间切换；放弃并换掉原灵不可逆。容量不是晋升赠送的七灵，也不是任意职业技能库。放牧是将真实灵魂吞入体内驱使，不是目击学习；普通灵魂不默认获得外部独立身体。高序列灵魂极难取得并有失控危险，本阶段没有免费半神。蠕动的饥饿的五槽、随机能力数、切换延迟和物品饥饿不能移作职业规则；职业固定食人频率、耗灵冷却与失控百分比均未核，不予捏造。序列4黑骑士的灵肉之刃与统御阴影尚未获得。原导师、两名已故成年原灵、有限约定、原纸和原笔记、实际在场者及全部距离、费用、判定和效果数值为原创G；有限同意是这条原创路线的约定，不冒充所有原著放牧都需同意的魔法条件。具体原灵来源只有实际会面后才公开。';
export const SHEPHERD_FORMULA_STATUS = '牧羊人完整配方、主辅材料及其用量、调配顺序与6→5晋升仪式细节尚未核实，不能据未知细节断言无需仪式。本作原创G渠道只交付独立成品原瓶；同一原成年导师伊森·洛弗实际核对本次原瓶、准备原旧物间的安静服药位置并在场照护。这是明确的G准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。此前秘祈人、倾听者、隐修士与蔷薇主教原瓶、原份额、储备与实践历史完整保留。';
export const SHEPHERD_POTION_SOURCES = SHEPHERD_BOTTLE_IDS.map((id, index) => ({
  id, source: `${SHEPHERD_GUIDE}经独立牧羊人成品交接渠道实际取得的第${index + 1}瓶序列5牧羊人成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非秘祈人、倾听者、隐修士或蔷薇主教旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const SHEPHERD_LABOUR_TASKS = ['核对本瓶独立封签', '整理原旧物间公开交接册', '清点原旧物间普通器具', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const SHEPHERD_ABILITIES: { id: ShepherdAbilityId; label: string; description: string }[] = [
  { id: 'hanged-man.s5.grazing', label: '有限放牧', description: '最多容纳7个实际原灵，每灵挑选至多3项它确实掌握的能力，不能由空位生成灵魂。当前原创渠道只有两名故事开始前已经死亡的成年原灵，需实际会面并逐一放牧；知识14，1行动3灵性，失败照耗且每灵每真实周至多一次。成功不自动启用。主动释放永久失去本原灵来源，不能撤销、重新取得、退款或变成另一灵；不涉及复活。' },
  { id: 'hanged-man.s5.borrowed-arts', label: '借用原灵能力', description: '每次实际施用仅能借当前1个已放牧原灵的已选能力，加上自己原有能力，灵性由本人支付。两灵间瞬时切换，切换本身0行动0灵性，本切片在回合边界选择，不复制永久掌握、不创造外部独立同伴。只实现来源明确的微力触动、短促防护、模糊标记与勇气歌声四个低阶G模板；不由一灵获取其途径所有技能。' },
];
export const SHEPHERD_SPIRITS: ShepherdSpiritSource[] = [
  { id: 'SH5-IRIS-1', name: '已故成年巫师伊芮斯（Iris）', pathwayId: 'hermit', sequence: 7,
    source: '原创原灵SH5-IRIS-1，成年巫师伊芮斯在本段故事开始前已经死亡，原灵一直在伊森保管的独立原容器内；与仍活着的伊蕾及其他导师无关。伊森实际介绍后，伊芮斯只对本段有限练习与本人明确选择的借用给出有限约定。未杀死或制造活人，没有转移尸体、衣物、装备或其它灵魂。以下三项是她在生前已经实际学会的低阶G方法，不是完整原著巫师技能表。',
    knownAbilities: [
      { id: 'light-touch', label: '微力触动', description: '原灵已学的低阶G方法；有限推动获准原纸，或针对当前真实可见敌人的有限冲击。每次由本人支付2灵性，不移动人或所有物件。' },
      { id: 'brief-ward', label: '短促防护', description: '原灵已学的低阶G方法；由本人支付2灵性作有限本轮自保，不保证免伤，也不生成物理盾或替身。' },
      { id: 'blur-mark', label: '模糊标记', description: '原灵已学的低阶G方法；2灵性、知识14，成功只把当前敌人下一次正贡献普通身体攻击减为80%，一用或回合结束即止，不控制思想。' },
    ] },
  { id: 'SH5-CEDRIC-1', name: '已故成年歌颂者塞德里克（Cedric）', pathwayId: 'sun', sequence: 9,
    source: '原创原灵SH5-CEDRIC-1，成年歌颂者塞德里克在本段故事开始前已经死亡，原灵一直在伊森保管的另一独立原容器内。实际介绍后，他仅对本段有限练习与本人明确选择的借用给出有限约定；没有现场死亡、生成尸体或转移装备。他在生前实际只学会本切片列出的勇气歌声，不自动补足三项能力。',
    knownAbilities: [
      { id: 'courage-song', label: '勇气歌声', description: '本人的真实声音借原灵已会的低阶G歌声作有限鼓舞，2灵性、知识14。和平场合只有明确同意的原成年文森及他的实际公开反馈；实战只增加本人有限胜势，不攻击、不直接加健康、不强迫信仰或控制思想。' },
    ] },
];
export const SHEPHERD_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原旧物间安静位置并照护；服药必耗选定原瓶，0行动，意志难度26。服药前健康须高于20、精神须高于40，不足时先休养；蔷薇主教消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊森·洛弗处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留蔷薇主教消化及全部原掌握；成功仅新增hanged-man.s5.grazing与hanged-man.s5.borrowed-arts两项0掌握，四属性各+1，灵性上限100但当前灵性不补满。全部旧ID、原瓶、原份额与储备、已解决敌人记录完整保留；不免费填满7灵、不赠法术、血肉补给或序列4能力。';
