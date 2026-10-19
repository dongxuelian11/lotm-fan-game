import type { MachineAbilityId } from './types.js';
export { MACHINE_CASE_IDS } from './types.js';

/** Verified chapter summary only. Guide, supply, practice and numerical rules are original G. */
export const MACHINE_GUIDE = '报时铺记录员艾妲·芬恩';
export const MACHINE_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const MACHINE_MIN_MONSTER_WEEKS = 4;
export const MACHINE_BOTTLE_IDS = ['machine-potion-1', 'machine-potion-2', 'machine-potion-3'] as const;
export const MACHINE_SOURCE_STATUS = '《诡秘之主》第四部第178章支持序列8机器的强大计算能力、精确控制、身体素质提升与格斗和射击天赋，以及占卜和反占卜能力。计算须有实际输入与核实，控制须有实际对象与执行；不等于无限记忆、自动制造、完美命中或万能反占卜，也不下放序列7幸运儿的被动幸运。三项怪物能力与原ID掌握完整继承，不把偶发片段改成任意未来查询，不自动改变身体为金属。艾妲·芬恩为已认识的本作原创成年报时铺记录员，沿同一指导渠道继续；新进阶成品原瓶、劳务、价格、计时板/指针/私密问题实践与全部数值均为本作原创G，不自动建立生命学派或其它组织身份。';
export const MACHINE_POTION_SOURCES = MACHINE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${MACHINE_GUIDE}从独立进阶成品渠道实际取得的第${index + 1}瓶序列8机器成品魔药，独立封存原瓶${id}；记录员与供给均为本作原创G，不是怪物旧瓶改装，也未声称在报时铺配制。取得此瓶不建立生命学派或其它组织身份。`,
}));
export const MACHINE_FORMULA_STATUS = '命运之轮途径序列8机器的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const MACHINE_LABOUR_TASKS = ['核验进阶原瓶封记', '整理独立成品交接记录', '复核报时铺实收清单'] as const;
export const MACHINE_ABILITIES: { id: MachineAbilityId; label: string; description: string }[] = [
  { id: 'wheel.s8.calculation-control', label: '计算与精确控制', description: '基于实际可知输入进行强大计算，并精确控制自身动作；身体素质、格斗与射击天赋有所提升。仍需观察、训练和实际执行，不获得无限记忆、自动制造、完美命中或不存在的信息。' },
  { id: 'wheel.s8.divination-guard', label: '占卜与反占卜', description: '围绕有限明确的问题进行占卜，并可采取受情境约束的反占卜措施。结果仍需核实，反占卜不是万能屏障，不保证瞒过任意位格，不读取任意人的隐私或完整未来，也不提供幸运儿的好运。' },
];
export const MACHINE_CONSUMPTION_RISK = '服药必定消耗本次选定机器原瓶，0行动，意志难度12；怪物扮演须达100且首次晋升怪物后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。艾妲在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、异常接触或其它危险。失败保留怪物消化和三项掌握；成功只新增两项从0开始的机器掌握，体质+1、感知+1、意志不增加、知识+2，灵性上限45且当前灵性不补满。计算、控制及占卜均有限，不等于万能预知或必中。金额、行动、成熟周数与判定数值均为本作原创G平衡设定。';
