import { FEAR_BISHOP_GUIDE } from '../fear-bishop/content.js';
import type { ConcealmentServantAbilityId, ConcealmentServantPreparationId } from './types.js';

/** The S2 title is a high-confidence inference; all quantities and playable limits below are original G. */
export const CONCEALMENT_SERVANT_GUIDE = FEAR_BISHOP_GUIDE;
export const CONCEALMENT_SERVANT_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const CONCEALMENT_SERVANT_MIN_FEAR_BISHOP_WEEKS = 12;
export const CONCEALMENT_SERVANT_LABOUR_STEPS = 5;
export const CONCEALMENT_SERVANT_BOTTLE_IDS = ['concealment-servant-potion-1', 'concealment-servant-potion-2', 'concealment-servant-potion-3'] as const;
export const CONCEALMENT_SERVANT_FORMULA_STATUS = '隐秘之仆的完整配方与晋升仪式仍未知：材料、用量、调配顺序及仪式要求尚未核实，不能断言原著无需仪式。本阶段只采用本作原创G专业指导与独立序列2成品渠道，不开放虚构配方或调配。三项专业准备与当周场地检查均为G支持，不冒充原著仪式，不将旧守夜人已消耗的仪式包或恐惧主教原瓶改装为新阶段来源。';
export const CONCEALMENT_SERVANT_SOURCE_STATUS = '已核人物资料中，阿里安娜的隐秘之仆称谓、天使身份及克莱恩对其可能序列2的判断，支持“隐秘之仆对应序列2”的高置信推断；它不是原文直接给出的编号声明。隐秘世界存在、可以解除并回到正常位置，以及高阶规则能阻挡隐秘、改变大范围环境可能伤及旁人的方向已有依据；完整能力清单、统一范围、持续与费用仍未知。此处6米原房间、60秒上限、一次20秒弱标记检索阻延、判定与反制、成年保管员和所有物件均为原创G，不是量化原著结论。身体与原物仍在原场，必须经原门普通往返，不删除记忆、物权、旧记录或因果，不保证隐藏于所有观察，也不提供治疗、复活或新灵体。下一阶称谓与能力尚未在此实现；厄难骑士对应序列1仅保留跨链推断，不冒称已核直接编号。';
export const CONCEALMENT_SERVANT_POTION_SOURCES = CONCEALMENT_SERVANT_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${CONCEALMENT_SERVANT_GUIDE}的独立隐秘之仆成品交接渠道本作G初始批次第${index + 1}瓶序列2成品魔药，独立封存原瓶${id}；非恐惧主教或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`,
}));
export const CONCEALMENT_SERVANT_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const CONCEALMENT_SERVANT_PREPARATIONS: { id: ConcealmentServantPreparationId; title: string; description: string }[] = [
  { id: 'CHECK_BOUNDARY', title: '实际核对房间边界与原门', description: '在原导师赛琳指导下，亲自检查专业练习场的普通边界、原门与门闩，区分有限隐秘和身体实际位置。这是普通专业准备；晋升后仍须到场核对CS2-ROOM同一6米房间，不提前隐秘房间、不搬动艾琳的原盒与原页。' },
  { id: 'AGREE_RETURN', title: '实际演练当次许可、撤回与原路返程', description: '本人普通演练分别确认原物主许可与参与者本人意愿、收到撤回后停止、解除效果、归还同一原物并沿原门返程。准备不等于新现场的任何当次同意，不使人或原物复制、复活、瞬移或永久失踪。' },
  { id: 'TRACE_LIMIT', title: '实际核对弱追踪来源与反制界限', description: '向原导师实际核对有限弱标记的来源、一次检索阻延与照明锚反制，区分尝试、成功窗口和真实应用；普通记录完整保留。这是专业讲解和普通核对，不提前获得遮踪效果，不触碰旧已消散痕迹、不削改记忆或旧经历。' },
];
export const CONCEALMENT_SERVANT_ABILITIES: { id: ConcealmentServantAbilityId; label: string; description: string }[] = [
  { id: 'darkness.s2.bounded-concealment', label: '有限房间隐秘（G）', description: '原创G：一次6灵性、知识18尝试，成功最多60秒令本场同一6米房间进入有限隐秘状态，外部暂不能看见其中原人原物；身体、所有权、原记录及原门均保留。本人和保管员实际步入、搬动同一原盒及普通返程分别发生，原门受阻须解除效果并普通解闩，不穿墙。失败不转换空间；强照明锚可反制，战斗只给本场有限效果，仍过共同胜负与伤势盘。只开成功窗口而未实际应用不奖掌握。' },
  { id: 'darkness.s2.trace-veil', label: '有限弱踪遮蔽（G）', description: '原创G：一次5灵性、意志18尝试，成功只对本场已登记、无生命无意识的同一弱追踪标记暂缓一次20秒检索。尝试、成功、真实阻延分别记录；原强照明锚可使窗口失效，失败保留原标记与普通收尾。它不删除标记、记忆、物权、身份或旧历史，不提供全知、永远隐藏或无条件逃跑；每案仅真实应用才最多增加8掌握。' },
];
export const CONCEALMENT_SERVANT_CONSUMPTION_RISK = '以下全部具体规则均为本作G：恐惧主教消化100、从恐惧主教实际晋升周起12整周、健康>20且精神>40；三项不同的1行动专业准备完成后，另付1行动与120便士检查当周场地，再0行动独立确认饮用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和当次场地准备均消耗，三项专业经历保留；再次服药须休养筹瓶并重新实际检查。G专业支持仅将此次药物排异后的健康和精神保底到1，不保护普通死亡或战斗。成功四属性各+1、原恐惧主教消化100与全部旧16项掌握原值保留，两项新掌握从0开始；灵性上限仍120且当前不补满，身体性别不改变。本人旧伤和累计风险不治疗、不重置；原卷叶取得、释放、再邀请、派出和召回记录、旧人物伤亡与原物去向全部保留。旧伤护理须真实发现诊所、支付实际医疗费用并后续休养，晋升不代做。';
