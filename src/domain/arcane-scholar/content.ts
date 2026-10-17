import { ALCHEMIST_GUIDE } from '../alchemist/content.js';
import type { ArcaneScholarAbilityId, ArcaneScholarPreparationId } from './types.js';

export const ARCANE_SCHOLAR_GUIDE = ALCHEMIST_GUIDE;
export const ARCANE_SCHOLAR_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const ARCANE_SCHOLAR_MIN_ALCHEMIST_WEEKS = 12;
export const ARCANE_SCHOLAR_LABOUR_STEPS = 5;
export const ARCANE_SCHOLAR_BOTTLE_IDS = ['arcane-scholar-potion-1', 'arcane-scholar-potion-2', 'arcane-scholar-potion-3'] as const;
export const ARCANE_SCHOLAR_FORMULA_STATUS = '奥秘学者的完整配方与晋升仪式尚未核实：材料、用量、调配顺序及仪式要求保持未知，不能断言无需仪式。本阶段只采用本作原创G专业指导与独立序列3成品渠道，不解锁虚构配方或调配。三项专业准备和当次场地检查均为G支持流程，不冒充原著仪式，也不重复炼金术士的抽取区域生命。';
export const ARCANE_SCHOLAR_SOURCE_STATUS = '奥秘学者序列3编号仅为第二部24章与249章跨段推定，尚无本次直接编号句；本阶完整能力表未核实。本阶段的有限结构解析、两原造物协同均为明确原创G，不冒称原著能力。为自己制造的物品注入带引号的灵魂、赋予一定生命仍是继承炼金术士4的既有能力；抽取区域生命的仪式也仍属于4。只研究亲自取得的原制造记录和可见读数，同一原盒AL4-BOX-1与原护架AL4-FRAME-1各只有一份，旧储能、耐久和去向照实继承；没有隐藏真相读取、万能制造、免费神器、永久独立灵魂或无限军团。下一序列2名称与能力本次未核，不提前授予。';
export const ARCANE_SCHOLAR_POTION_SOURCES = ARCANE_SCHOLAR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${ARCANE_SCHOLAR_GUIDE}的独立奥秘学者成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非炼金术士或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`,
}));
export const ARCANE_SCHOLAR_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const ARCANE_SCHOLAR_PREPARATIONS: { id: ArcaneScholarPreparationId; title: string; description: string }[] = [
  { id: 'INSPECT_RECORDS', title: '亲自查阅原制造与成本记录', description: '本人实际阅读原工作台留存的制造及成本记录，区分亲手制造、赋灵、有限指挥与尚未验证的推测；只整理已经取得的原记录，不补写新的原件或隐藏知识，也不代做晋升后两次基准测量。' },
  { id: 'CHECK_ORIGINALS', title: '核对唯一原件与本人状态', description: '在专业指导下实际检查本人和已有原造物，逐件核对ID、所在位置、耐久与剩余储能；不新造第二份原件、不补充储能，不借海伦娜旧同意重新使用已归还的包裹或黄铜片。' },
  { id: 'PLAN_WITHDRAWAL', title: '实际演练停用与普通退出', description: '本人在原指导场沿普通路线演练停用、求助与离开；明确有限造物必须真实取回、损坏不会自动修复、旧园地损毁与旧人死亡不可重置。这是本作G专业准备，不完成原著未知的序列3仪式。' },
];
export const ARCANE_SCHOLAR_ABILITIES: { id: ArcaneScholarAbilityId; label: string; description: string }[] = [
  { id: 'paragon.s3.bounded-analysis', label: '有限结构解析（G）', description: '本作原创G：对本人已读的原制造记录及两次真实基准测量作有限匹配分析。生活一次4灵性、知识16，成功得到适用于当前两原件的具体设置；失败仍可普通比较读数。战斗一次4灵性、知识18，仅提供本轮有限可见弱处窗口，不能识破一切、读取隐藏真相或凭空制造物品。' },
  { id: 'paragon.s3.construct-coordination', label: '两原造物协同（G）', description: '本作原创G：仅让同时实际在场的AL4-BOX-1与AL4-FRAME-1在30秒、6米内作有限协同。一次5灵性、两原件各1储能、知识18，失败同样照实消耗；受干扰或失配可中止。生活必须当前知情同意并可用普通手柄停用，战斗成功仅有限贡献40、减势20，不生成额外行动者、第二轮盘、独立资源池或新装备。' },
];
export const ARCANE_SCHOLAR_CONSUMPTION_RISK = '以下全部具体规则为本作G：炼金术士消化100、从炼金术士实际晋升周起12整周、健康>20且精神>40，三项不同的1行动专业准备完成后，另付1行动与120便士检查当周场地；0行动独立确认服用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和当次准备均消耗，三项已有专业经历保留，休养后须重新检查场地并筹另一瓶。G专业支持仅将此次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，旧掌握与炼金术士消化100保留，两项新能力掌握0；灵性上限仍120且当前不补满，身体性别不改变，原造物不充能、不修复，旧园不复苏，旧人不复活。';
