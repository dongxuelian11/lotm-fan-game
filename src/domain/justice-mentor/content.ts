import { UNSHADOWED_GUIDE } from '../unshadowed/content.js';
import type { JusticeMentorAbilityId, JusticeMentorPreparationId } from './types.js';

/** S3 Justice Mentor is name-verified. New abilities, supplied potions, scenes and all numerical rules are original G. */
export const JUSTICE_MENTOR_GUIDE = UNSHADOWED_GUIDE;
export const JUSTICE_MENTOR_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const JUSTICE_MENTOR_MIN_UNSHADOWED_WEEKS = 12;
export const JUSTICE_MENTOR_LABOUR_STEPS = 5;
export const JUSTICE_MENTOR_BOTTLE_IDS = ['justice-mentor-potion-1', 'justice-mentor-potion-2', 'justice-mentor-potion-3'] as const;
export const JUSTICE_MENTOR_FORMULA_STATUS = '太阳序列3正义导师名称已由原文核实，完整配方与晋升仪式尚未核实，序列3新增能力名录也未核实。材料、用量、调配顺序及完整仪式保持未知，不能断言无需仪式。本阶段只采用本作原创G独立成品渠道与专业指导；三项准备和当次场地检查均为G支持流程，不冒充原著仪式，不复用无暗者的旧情感剥离回输仪式，不开放自制配方。';
export const JUSTICE_MENTOR_SOURCE_STATUS = '第五部第88章《收获》直接明确序列3正义导师；本次没有核实其完整主辅方、晋升仪式、新增技能名录或定量。以下共享光辉、清晰标记仅是本作借太阳低阶根基拓展的两项原创G玩法，不宣称它们是原文技能。第五部卷末作者总结给出下一序列2逐光者、古称逐日者；这是作者卷末总结层级的名称依据，能力未核，本阶段不开放。继承公证签名仍须本人认可，契约不强迫原本不认可条款的人；净化和太阳能力仍有范围与友伤边界。没有善恶雷达、识心、凭空证据、自动定罪、强制契约、法律身份或依名称即死。全部新人物、有限场景、距离、强度、消耗与战斗定量均为原创G，旧原人原物与情感回输记录不因晋升改写。';
export const JUSTICE_MENTOR_POTION_SOURCES = JUSTICE_MENTOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${JUSTICE_MENTOR_GUIDE}介绍的独立正义导师成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非无暗者或更早原瓶改装。序列3正义导师名称已核实，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`,
}));
export const JUSTICE_MENTOR_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const JUSTICE_MENTOR_PREPARATIONS: { id: JusticeMentorPreparationId; title: string; description: string }[] = [
  { id: 'CHECK_TERMS', title: '亲自核对自愿条款与原渠道', description: '在独立指导场核对本次原成品记录与自愿条件，说明新能力、配方及仪式未核。本人逐项确认可拒绝、停止和普通退出；这不是强制签约、法律身份或原著晋升仪式，也未取得未来场景中任何人的同意。' },
  { id: 'REVIEW_BOUNDARIES', title: '实际复核太阳作用与证据边界', description: '本人在指导场复核有限鼓舞只支持已自愿的行动，显现原有标记也不能替代问询与原记录。太阳净化仍可能伤及友善灵，必须核对实际位置；本项不治疗原人物、不恢复精力、不净化旧物、不改写原情感。' },
  { id: 'PLAN_RETURN', title: '实际核对普通返程与停止次序', description: '本人沿指导场普通出口检查返程，演练取得当前同意、停止有限作用、归还同一原物后实际离开。新案仍须真实到场与按当前物理位置收口，旧同意不能替代本次许可，能力不封锁普通出口。' },
];
export const JUSTICE_MENTOR_ABILITIES: { id: JusticeMentorAbilityId; label: string; description: string }[] = [
  { id: 'sun.s3.shared-radiance', label: '共享光辉（本作G）', description: '新增能力未原核，这是本作借太阳低阶鼓舞根基拓展的有限G技巧。一次6灵性、意志18，仅支持已当前自愿且资源足够的两位原助手合作；成功本次8米出程每人耗3精力，失败各耗6，空手8米普通回程另各耗2。不迫使原本不愿或缺体力的人行动，不补满精力、不制造第三人或箱子副本。战斗只鼓舞本槽本人，成功优势65G，不赠队友。' },
  { id: 'sun.s3.clarity-mark', label: '清晰标记（本作G）', description: '新增能力未原核，这是本作借太阳低阶照明根基拓展的有限G技巧。一次6灵性、知识18，在当前原主人许可后仅辅助显现同一原物已存在的淡标记。字形不自动给出失主、真实用途、思想或罪责；须先写假说，再当面问实际原人及核对同一原记录，错误假说保留且可修正。失败可耗原灯资源普通核读，不重骰。战斗仅观察原棍的真实动作与已有标记，成功减势32G；不审判道德。' },
];
export const JUSTICE_MENTOR_CONSUMPTION_RISK = '以下全部具体规则为本作G：无暗者消化100、从无暗者实际晋升周起12整周、健康>20且精神>40，三项不同的1行动专业准备完成后，另付1行动与120便士检查当周场地；0行动独立确认服用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和当次准备均消耗，三项已有专业经历保留，休养后须重新检查场地并筹另一瓶。G专业支持仅将此次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1、无暗者消化100和全部旧掌握保留，两项本作G新能力掌握0；灵性上限仍120且当前不补满，身体性别不改变。原埃德蒙的伤势、投降或死亡记录与原棍、原奥尔登真实出入、原特性污染、原盒、原石板焦痕和60秒冷却经历保留。同一原情感的回输事实保留，不重新剥离，也不把旧4仪式当成3仪式。';
