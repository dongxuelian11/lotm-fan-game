import { CATACLYSM_PRIEST_GUIDE } from '../cataclysm-priest/content.js';
import type { SeaKingAbilityId, SeaKingPreparationId } from './types.js';

/** S3 Sea King is source-verified. Every supply, finite scene and numerical rule below is original G. */
export const SEA_KING_GUIDE = CATACLYSM_PRIEST_GUIDE;
export const SEA_KING_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const SEA_KING_MIN_CATACLYSM_PRIEST_WEEKS = 12;
export const SEA_KING_LABOUR_STEPS = 5;
export const SEA_KING_BOTTLE_IDS = ['sea-king-potion-1', 'sea-king-potion-2', 'sea-king-potion-3'] as const;
export const SEA_KING_FORMULA_STATUS = '暴君序列3海王已由原文核实，完整配方与晋升仪式尚未核实。材料、用量、调配顺序及完整仪式保持未知，不能断言无需仪式。本阶段只采用本作原创G独立成品渠道与专业指导；三项准备和当次场地检查均为G支持流程，不冒充原著仪式，不复用灾难主祭的旧地震海啸或原封装包，不开放自制配方。';
export const SEA_KING_SOURCE_STATUS = '第三部58章明确序列3海王；第四部83章给出灾难主祭4→海王3→天灾2，下一天灾2本阶段不开放，也不是猎人的天气术士。原文支持在自己掌控的海域远距离施加风力、操纵真实海水并带空气同行，以及从平静水面看有限过往；仍有看不清特定人、需要实际调查的限制。范围、水量、消耗和初晋强度未知，本作有限96米练习边界、20单位水量与全部定量均为原创G，不把普通所有权等同魔法掌控，不外推资深考特曼的能力。全海眼线的详细例证多来自海神权杖这一相关半神物品，不作为职业免费海生物或信徒库，也不一律把权杖说成天使能力。水面片段不是任意历史、全知或裁定谁有罪；需询问实际原人、核对原记录。全部旧人原物与过去后果保留，不因晋升复原。';
export const SEA_KING_POTION_SOURCES = SEA_KING_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SEA_KING_GUIDE}介绍的独立海王成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非灾难主祭或更早原瓶改装。序列3海王已核实，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`,
}));
export const SEA_KING_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const SEA_KING_PREPARATIONS: { id: SeaKingPreparationId; title: string; description: string }[] = [
  { id: 'CHECK_CHART', title: '亲自核对原海图与实际海水来源', description: '在指导场核对原海图所示边界、水域与干燥岸路，区分已核原著能力和未核距离。普通海图、所有权与购买原瓶不会授予魔法掌控，也不提前取得新案人物同意。' },
  { id: 'SET_BOUNDARY', title: '实际练习有限边界核验', description: '本人在指导场实测有限练习边界，确认域外对象不能获得信息或力量。新海湾仍须到场核对同一海图、原浮标与真实水源，本项没有使任何船出发、转移海水或改变旧海岸损毁。' },
  { id: 'PLAN_RETURN', title: '实际核对普通返程与停止次序', description: '本人核对指导场普通出口，演练取得当次同意、停止有限作用、归还原物和普通返程。新案仍须真实走到现场、确认原人并按实际物理位置收口，不能用旧同意代替或留下原人在海上。' },
];
export const SEA_KING_ABILITIES: { id: SeaKingAbilityId; label: string; description: string }[] = [
  { id: 'tyrant.s3.sea-domain', label: '有限海域控水', description: '本作G一次6灵性、知识18，须实测边界、当前许可与真实相连海水。浅凹槽成功把同一20单位水移入相连海湾，最多20秒窗口后全部流回；原短钩实际取同一标牌，不造永久干地、无限排海或深潜免疫。战斗成功减势32G且须实际海水；资源不足普通回退。' },
  { id: 'tyrant.s3.remote-tempest', label: '有限遥距风力', description: '本作G一次6灵性、意志18，只作用实测96米有限边界中的明确原艇。奥林须当次同意、实际划同艇60米到原浮标，成功助原艇沿水路返60米并由他付4精力；失败由同一原人普通划回并付12精力。战斗成功优势65G乘新掌握；不等于全海域控制，不保证必中或同伴免伤。' },
  { id: 'tyrant.s3.water-recollection', label: '平静水面有限过往', description: '本作G一次6灵性、意志18，只在获许可且亲眼确认平静的原水面调查昨天同一原浮桶。成功仅见有限片段，须实际观察后才知具体内容；失败无额外信息；先写可修正假说，再当面问两位真实原人并核对原交班签注。片段不辨任意人物、不自动定罪、不改写昨天或移动原桶，普通问询也能完成。' },
];
export const SEA_KING_CONSUMPTION_RISK = '以下全部具体规则为本作G：灾难主祭消化100、从灾难主祭实际晋升周起12整周、健康>20且精神>40，三项不同的1行动专业准备完成后，另付1行动与120便士检查当周场地；0行动独立确认服用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和当次准备均消耗，三项已有专业经历保留，休养后须重新检查场地并筹另一瓶。G专业支持仅将此次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1、灾难主祭消化100和全部旧掌握保留，三项新能力掌握0；灵性上限仍120且当前不补满，身体性别不改变。原本尼迪克特的伤势、死亡记录与原棍、原西尔瓦与浮具、原绳损耗、原盘积水、原石焦痕及原序列4海岸损毁保留，不免费修物或复活旧人。';
