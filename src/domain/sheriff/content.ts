import type { SheriffAbilityId } from './types.js';
export { SHERIFF_CASE_IDS } from './types.js';

/** Verified chapter summaries only. Guide, finished supply, practice and numbers are original G. */
export const SHERIFF_GUIDE = '民间调解文书员薇娜·贝尔';
export const SHERIFF_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const SHERIFF_MIN_ARBITER_WEEKS = 4;
export const SHERIFF_BOTTLE_IDS = ['sheriff-potion-1', 'sheriff-potion-2', 'sheriff-potion-3'] as const;
export const SHERIFF_SOURCE_STATUS = '《诡秘之主》第四部第31章支持治安官按见过的特征重构图像；第四部第126章支持接近且没有有效屏蔽时，对与邪恶、混乱、疯狂相关目标的有条件感应，不等于读取人心、道德判罪或全域定位。第五部第53章中的序列7人物使用继承自治安官的追踪能力，依赖已知图像且不能跨越过长间隔；本作不编造固定原著距离、时限或必中效果。三项仲裁人能力与原ID掌握完整继承，不下放序列7审讯者的精神刺穿与审讯、序列6法官的禁止。薇娜·贝尔是已认识的本作原创成年民间调解文书员；独立进阶成品原瓶、劳务、价格、已见面容/屏蔽原箱/已知路线实践与全部数值均为本作原创G，不任命玩家为官方人员，不自动建立王室、教会或其它组织身份。';
export const SHERIFF_POTION_SOURCES = SHERIFF_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SHERIFF_GUIDE}从独立进阶成品渠道实际取得的第${index + 1}瓶序列8治安官成品魔药，独立封存原瓶${id}；文书员与供给均为本作原创G，不是仲裁人旧瓶改装，也未声称在调解处配制。取得此瓶不赋予官方身份，不建立王室、教会或其它组织身份。`,
}));
export const SHERIFF_FORMULA_STATUS = '第二部第17章仅核到治安官主材料片段：恐惧魔虫眼睛一对与银白战熊右掌。完整配方尚未核实；右掌的投料数量、辅材、完整用量和调配顺序不作为已知内容，不补造克数或辅材。片段不构成可制造配方，配方列表保持空且未知。当前只开放本作原创G的独立成品原瓶；用药指导不解锁配方学习、材料采购或调配。';
export const SHERIFF_LABOUR_TASKS = ['核验进阶原瓶封记', '整理独立成品交接记录', '复核调解处实收清单'] as const;
export const SHERIFF_ABILITIES: { id: SheriffAbilityId; label: string; description: string }[] = [
  { id: 'justiciar.s8.trace-sensing', label: '有条件感应与追踪', description: '对接近且未被有效屏蔽、与邪恶或混乱或疯狂相关的目标形成有限感应；结合已知图像追踪已有线索，不能跨越过长间隔。不能感应普通人的法律或道德罪责，不能从无目标、屏蔽原箱或断失线索得到全域定位与确定结论。距离、间隔与成败依场景核实，不伪造原著固定数值。' },
  { id: 'justiciar.s8.image-reconstruction', label: '图像重构', description: '在记忆中重构亲眼见过的外观特征，帮助记录和比对已有图像。不能补出从未看见的脸、被遮挡的特征、未知身份或隐藏动机；重构图像不是有罪证明，也不是读取他人的记忆。' },
];
export const SHERIFF_CONSUMPTION_RISK = '服药必定消耗本次选定治安官原瓶，0行动，意志难度12；仲裁人扮演须达100且首次晋升仲裁人后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。薇娜在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、异常接触或其它危险。失败保留仲裁人消化和三项掌握；成功只新增两项从0开始的治安官掌握，体质+2、感知+2、意志+1、知识+1，灵性上限45且当前灵性不补满。图像、感应与追踪均有限，不能认定道德或法律罪责，也不获得官方身份。金额、行动、成熟周数与判定数值均为本作原创G平衡设定。';
