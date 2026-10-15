import type { DeceitMentorAbilityId, DeceitMentorPreparationId } from './types.js';

/** Verified sequence and directions; the finite supply, preparation, scenarios and every quantity are original G. */
export const DECEIT_MENTOR_GUIDE = '54岁导师阿德里安·霍尔（DM3-ADRIAN，独立原创G人物）';
export const DECEIT_MENTOR_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const DECEIT_MENTOR_MIN_PARASITE_WEEKS = 12;
export const DECEIT_MENTOR_LABOUR_STEPS = 5;
export const DECEIT_MENTOR_BOTTLE_IDS = ['deceit-mentor-potion-1', 'deceit-mentor-potion-2', 'deceit-mentor-potion-3'] as const;
export const DECEIT_MENTOR_FORMULA_STATUS = '错误途径序列3欺瞒导师名称、诈骗师深化和涉及自然规律的欺瞒方向已原核，完整配方与晋升仪式尚未核实。材料、用量、调配顺序和完整仪式保持未知，不能断言无需仪式。本阶段只采用本作原创G独立成品渠道与专业指导；三项准备和当次场地检查均为G支持流程，不冒充原著仪式，不开放自制配方。';
export const DECEIT_MENTOR_SOURCE_STATUS = '第六部第12章《预言》明确涉及序列3欺瞒导师，阿蒙使无燃料灯笼亮一周，说明欺瞒可涉及自然规律，并深化诈骗师能力。一周来自阿蒙，不能当成初晋欺瞒导师的普遍时长。完整配方与仪式、寄生和偷能力的新容量尚未核实，保留旧寄生者4基础而不赠天使分身。以下无油续光16秒、同一轻纸签迟落8秒、同一原卡朝向误判最多6秒及所有具体场地、动作和数值均为原创G，不声称原著已有通用重力控制。序列2命运木马、换命、主辅颠倒、源堡复活骗局均不下放。';
export const DECEIT_MENTOR_POTION_SOURCES = DECEIT_MENTOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${DECEIT_MENTOR_GUIDE}介绍的独立欺瞒导师成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非寄生者或更早原瓶改装。完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`,
}));
export const DECEIT_MENTOR_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const DECEIT_MENTOR_PREPARATIONS: { id: DeceitMentorPreparationId; title: string; description: string }[] = [
  { id: 'CHECK_SOURCE', title: '亲自核对原来源与真实存量', description: '本人核读独立成品来源和原工坊记录，区分真实原物、已知来源与未知内容。这项准备不造新燃料、纸签或卡片，不预读后来原铭牌的文字，不取得现场人物的同意。' },
  { id: 'BOUND_EFFECT', title: '实际确认效力与时限边界', description: '本人复核有限规则欺瞒和注意力偏移的边界：阿蒙一周不是初晋统一阈值，具体16秒、8秒和6秒均为G。能力不等于改变物权、长期记忆、控制身体或改世界库存，不提供无限续光、悬人或千斤悬浮。' },
  { id: 'PLAN_RESTITUTION', title: '实际规划停止、纠正与原物返还', description: '本人沿指导场普通出口核对停止效力、现场核实、纠正记录与亲手返还的顺序。原身体和原物都须实际移动；普通退出不能远距收物，不治疗伤势，不给后来每案自动授权。' },
];
export const DECEIT_MENTOR_ABILITIES: { id: DeceitMentorAbilityId; label: string; description: string }[] = [
  { id: 'error.s3.law-deceit', label: '规则欺瞒（有限作用G）', description: '涉及自然规律的欺瞒方向已原核，具体本作G操作6灵性、知识18，失败照耗：仅在同一原灯还有20秒正常余辉时尝试一次额外16秒续光，不回填燃料、不重燃熄灯；或仅在自己松开同一轻纸签时尝试迟落8秒，再实际落在原毡盘。阿蒙一周不作为初晋阈值，不开放通用重力控制、复制物品或无限时长。战斗只有限偏转攻击时机、降低对方优势36，自身没有直接伤害。' },
  { id: 'error.s3.deep-deception', label: '深层欺瞒（有限注意偏移G）', description: '深化诈骗师的方向已核，具体本作G操作6灵性、知识18：本人和独立见证者明确同意这次演练后，对同一原卡朝向的判断最多偏移6秒，见证者仍可识破或拒绝。真实卡面、物权、记忆不改；终止后现场核实并纠正记录，不让长期错误充当真相，不强控身体。战斗仅对具有独立思维的实际目标降低优势30，没有直接伤害。' },
];
export const DECEIT_MENTOR_CONSUMPTION_RISK = '以下全部具体规则为本作G：寄生者消化100、从寄生者实际晋升周起12整周、健康>20且精神>40，三项不同的1行动专业准备完成后，另付1行动与140便士检查当周场地；0行动独立确认服用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和当次准备均消耗，三项已有专业经历保留，休养后须重新检查场地并筹另一瓶。G专业支持仅将此次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1、寄生者消化100和全部旧掌握保留，两项新能力掌握0；灵性上限120且当前不补满，身体性别不改变。旧偷盗者至寄生者的原瓶、存货、原身体、宿主自主权、念头记录、窃取窗口与旧代价全部保留，不送原能力，不复活旧死亡档，不获得天使分身或命运木马2。';
