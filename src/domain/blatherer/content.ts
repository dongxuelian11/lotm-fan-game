import { DEVIL_GUIDE } from '../devil/content.js';
import type { BlathererAbilityId, BlathererPreparationId } from './types.js';

/** The S3 mapping is a character inference; all new scenes, mechanics and numbers are explicit G. */
export const BLATHERER_GUIDE = DEVIL_GUIDE;
export const BLATHERER_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const BLATHERER_MIN_DEVIL_WEEKS = 12;
export const BLATHERER_LABOUR_STEPS = 5;
export const BLATHERER_BOTTLE_IDS = ['blatherer-potion-1', 'blatherer-potion-2', 'blatherer-potion-3'] as const;
export const BLATHERER_FORMULA_STATUS = '呓语者与深渊序列3的对应只有人物推断，按本作候选衔接开放；完整配方与晋升仪式尚未核实，新内生能力规则也未核实。主辅材料、用量、调配顺序和完整仪式均保持未知，不能因此断言无需仪式。本阶段只有明确原创G的独立成品渠道与专业支持，同一位原成年导师罗安·费里沿用原人。三项真实准备及当周安静原房检查不冒充原著完整仪式，不搭祭坛、不收血晶、不开放自制配方，也不把船上笑声当成已核职业能力。';
export const BLATHERER_SOURCE_STATUS = '原核Thirdpart205L123579及L123587–591只支持人物对呓语者可能为序列3的推断，不是直接明确的完整序列表。船上笑声、血晶与推断存在的献祭祭坛属于具体情节、物件和推测，不作为呓语者职业能力或通用晋升仪式。下一序列2鲜血大公未在本次核实，不授天使腐化、免费召唤、全域疯狂、远程声音或灵魂所有权。本阶段唯一新能力abyss.s3.limited-murmur“有限低语”及独立成年诺拉·温特46岁BL3-NORA、埃德里克·凯尔48岁BL3-EDRIC、三项原场、原物、同意安排、6米听距、2秒输入、30秒残留、4灵性1精神与知识18检定、战斗本轮下一正贡献身体或弧光攻击减半一次等全部新场景和数值均为原创G。旧罪犯至魔鬼的全部人物、原物、种子、原敌结果和道德及紧绷代价保留；普通和平扮演100仅是有成本G替代，不保证原著安全消化，不恢复原有良知。';
export const BLATHERER_POTION_SOURCES = BLATHERER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${BLATHERER_GUIDE}介绍的独立呓语者成品交接渠道本作G初始批次第${index + 1}瓶候选序列3成品魔药，独立封存原瓶${id}；非魔鬼或更早原瓶改装。名称与序列衔接仅有人物推断，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`,
}));
export const BLATHERER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const BLATHERER_PREPARATIONS: { id: BlathererPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对既有深渊经历与原记录', description: '本人核读原魔鬼晋升、原米蕾尔节目与蕾娜拒绝、旧种子与原奥里克实际伤势或结局；原罪犯至魔鬼的原瓶、掌握、原物和历史保留。明确角色已付道德与恶魔紧绷代价，不将新晋升或和平实践写成洗去原有良知变化。' },
  { id: 'CHECK_LIMITS', title: '核验有限听距、当前同意与残留边界', description: '与原罗安核对BL3-QUIET-ROOM的普通声学边界，只在真实6米可听范围内处理当前目标；本人同意是本场G伦理安排，不冒充原著施法条件。必须停止输入并另行实际等待残留消退，失败保成本；不能把一次同意扩成持续控制，不给旁人友军免疫。配方、仪式与职业能力全表仍未知。' },
  { id: 'MARK_EXIT', title: '标明原安静房与普通门口退出路线', description: '本人实际核对原安静房BL3-QUIET-ROOM及原普通门口，标出入口START、4米原桌A和8米声学凹室B的普通去返路线；不是祭坛或献祭布置。退出不退款、不治疗、不取消已经发生的拒绝；后续原卡归还、停声、等残留与普通步行须分别真实完成，0行动也不传送。' },
];
export const BLATHERER_ABILITIES: { id: BlathererAbilityId; label: string; description: string }[] = [
  { id: 'abyss.s3.limited-murmur', label: '有限低语（当前听者与真实收束G）', description: '本作原创G：当前实际6米内清醒听者，4灵性1精神、知识18四档检定，两成功档只产生一次轻微可见迟疑，两失败档仍扣成本。和平场景需成年诺拉当前明确同意，范围内原旁人先实际走离；2秒声音输入后STOP_VOICE只停声，成功残留仍须实际WAIT_CLEAR30秒，撤回不能重复施加。普通核实保真实失败与本人回答，原卡始终按原归属返还。实战限4米当前埃德里克，成功只使本轮下一正贡献身体打击或实付弧光贡献减半一次；不直接扣健康、不强迫移交原棍或投降，不永久改写人格。重复成功仅实付费刷新同一非叠加窗口，原敌真实凝神可以清除尚未使用窗口，不退款或撤销已经发生的减半。' },
];
export const BLATHERER_CONSUMPTION_RISK = '以下具体规则均为本作G：魔鬼消化100，从原魔鬼晋升周起12整周，健康>20且精神>40；三项不同1行动专业准备完成后，另付1行动140便士检查当周原安静房与普通门口，0行动独立确认服用选定原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶与本次准备耗尽，三项真实经历保留，可休养后重筹另一瓶并重做当次检查。G指导仅将这次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，魔鬼消化100与旧掌握保留，只新增abyss.s3.limited-murmur一项0掌握；灵性上限120且当前不补满。罪犯至魔鬼全部原瓶、原物、原人物、种子和原敌生死保留，原恶魔紧绷、良知变化与恶欲风险不清除。候选名阶仅有人物推断，完整配方与仪式未知，不送血晶、祭坛、免费召唤、天使腐化或全域疯狂。';
