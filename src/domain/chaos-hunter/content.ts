import { IMPERATIVE_MAGE_GUIDE } from '../imperative-mage/content.js';
import type { ChaosHunterAbilityId, ChaosHunterPreparationId } from './types.js';

/** Sequence names are source-backed; every new bounded rule, scene and numerical procedure is original G. */
export const CHAOS_HUNTER_GUIDE = IMPERATIVE_MAGE_GUIDE;
export const CHAOS_HUNTER_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const CHAOS_HUNTER_MIN_IMPERATIVE_MAGE_WEEKS = 12;
export const CHAOS_HUNTER_LABOUR_STEPS = 5;
export const CHAOS_HUNTER_BOTTLE_IDS = ['chaos-hunter-potion-1', 'chaos-hunter-potion-2', 'chaos-hunter-potion-3'] as const;
export const CHAOS_HUNTER_FORMULA_STATUS = '原核直接确认序列3混乱猎手与下一阶序列2平衡者；混乱猎手完整主辅配方、材料用量、调配顺序与晋升仪式尚未披露，仍保持未知，不能因此断言无需仪式。同一位原成年导师薇娜·贝尔只经明确原创G的独立成品渠道交接本批三个独立原瓶，实际准备原调解处旁安静原房、普通退出路线与在场支持。三项真实专业准备和当周原房检查完全为G，不冒充原著完整仪式，不开放自制魔药。';
export const CHAOS_HUNTER_SOURCE_STATUS = '第五部200《真正的神棍》L200622直接确认3混乱猎手；L200624同时戴有0—36，不能将该个例的神器光枪或翼封空间赋予普通新晋3。L200996剥夺特莉丝黑焰为个例；L201014禁令被高阶灰白隔绝，不能据此承诺对任何目标必定生效。完整3配方、仪式、新增规则与范围次数未核；本阶段只有限继承旧禁令和剥夺，justiciar.s3.bounded-order为明确原创G的有限双方规则。L194714与L200569直接确认下一阶2平衡者，不下放天使光领域。43岁成年自主志愿者CH3-MIRA米拉·佩恩、44岁成年CH3-EDRIC埃德里克·梅森、场地、原纸原包原标条、当前许可、20秒窗口、全部距离、成本、检定、数值和奖励均为原创G。规则只管本次两人各一次尚未执行的A到B试走，双方同受约束，不改原纸、不追改过去、不传送或复位已发生动作；和平合作不等于敌人必服。没有全知识别罪恶、任意改规则、强制真话、死亡判决或永久控制。仲裁人至律令法师六个旧阶段全字段冻结，原罗温IM4-ROWAN-KELL原伤势、资源与投降结果保留；旧伙伴和原物不移动、不返能，原身体与普通死亡不因本次晋升重开。';
export const CHAOS_HUNTER_POTION_SOURCES = CHAOS_HUNTER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${CHAOS_HUNTER_GUIDE}介绍的独立混乱猎手成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非律令法师或更早原瓶改装。名称编号有直接原核，成品供给与专业准备均为G；完整配方和原著晋升仪式未披露，专业准备另行实际完成。`,
}));
export const CHAOS_HUNTER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const CHAOS_HUNTER_PREPARATIONS: { id: ChaosHunterPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对既有审判者经历与原记录', description: '本人核读原律令法师晋升、原罗温实际伤势与原投降结果，原阿伦和埃尔登当前状态、原卡原罩原线原标记片的已收束记录。仲裁人、治安官、审讯者、法官、惩戒骑士与律令法师六阶原瓶、掌握、人物与原物均保留；本次晋升不治疗、不复活、不返还伙伴灵性、不移动或复制旧原物。' },
  { id: 'CHECK_LIMITS', title: '核验双方同受约束与当前许可', description: '与原薇娜明确本场原创G安排：成功只预备20秒内两人各一次A到B试走的有限规则，必须本人随后实际尝试才形成止步或越线事实。原纸永久写本次从A到B的越线，不改写过去；双方自主心智不变，当次许可可撤回，停止规则清未用效力。失败、取消或过期成本不退，已实际行走不倒转，本人不自动豁免。' },
  { id: 'MARK_EXIT', title: '标明原安静房与普通退出路线', description: '本人实际核对CH3-QUIET-ROOM与净空标线演练房CH3-LINE-ROOM，标出START至A4米、A至B4米的普通去返路线，B的空桌放唯一350g原包CH3-PARCEL；唯一CH3-LINE是标条而非墙。原包、原标条和原纸CH3-RULE-PAPER各有唯一所有权与地点，导师必须本人摆放后返回，原人普通步行、亲取原物并归还，同伴也自主返A，最后本人与导师沿普通路返回START，伙伴始终留在A。' },
];
export const CHAOS_HUNTER_ABILITIES: { id: ChaosHunterAbilityId; label: string; description: string }[] = [
  { id: 'justiciar.s3.bounded-order', label: '双方各一次的有限规则（原创G）', description: '本作G有限延伸，不是已核实的原著3新增规则。和平1行动5灵性2精神、知识20四档；成功仅预备20秒内两人各一次A到B试走约束，须实际TRY_PLAYER与TRY_PARTNER分别核验，不因替对方止步而豁免本人。原纸不变，撤回须STOP_RULE后按当前普通意愿行走；失败和普通也实际走4米到B。成功且真正拦停的双方案或本人案各加8掌握，撤回、失败、普通无掌握，已付成本不退。实战K付5灵性、知识20四档，成功给本人和敌人各一份待用BODY约束；任一尚待用不叠加也不重付费。每次真实BODY各自独立抵抗，被挡则原动作贡献0，抵抗后继续原动作；只在敌人实际抵抗且产生正BODY贡献时留下可用一次的旧惩戒来源。本人抵抗不给敌人来源，ARC、WARD、COMPOSE与有原伤的J不受BODY规则限制；轮末未用即清，不以名称处决或获得额外行动。' },
];
export const CHAOS_HUNTER_CONSUMPTION_RISK = '以下具体规则均为本作G：律令法师消化100，从原律令法师晋升周起12整周，健康>20且精神>40；三项不同1行动专业准备完成后，另付1行动140便士检查当周原安静房与普通出口，0行动独立确认服用选定原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶与本次准备耗尽，三项真实经历保留，可休养后重筹另一瓶并重做当次检查。G指导仅将这次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，原律令法师消化100与旧掌握保留，只新增justiciar.s3.bounded-order一项0掌握；灵性上限120且当前不补满。六阶段原瓶、原物、原人物、旧伙伴实际灵性与原敌伤势生死不改，原罗温的投降不会重开；身体、身份、年龄与性别不变。序列3名称编号有原核，全部新增机制、成品与专业准备均G；完整配方与仪式未知。';
