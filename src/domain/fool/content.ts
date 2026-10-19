/** Authored future branch and bounded implementation. Canon references and
 * unknown numerical limits belong in the stage document, not player labels. */
export const FOOL_ABILITY_IDS = ['diviner.s0.momentary-blindness', 'diviner.s0.prior-place'] as const;
export type FoolAbilityId = typeof FOOL_ABILITY_IDS[number];
export const FOOL_ABILITIES = [
  { id: FOOL_ABILITY_IDS[0], label: '片刻盲愚', description: '尝试打断眼前一个尚未执行的查看动作，最多维持三秒。目标可以抵抗，提前形成的本能动作仍可能执行；已经发生的事不改变。' },
  { id: FOOL_ABILITY_IDS[1], label: '前刻留影', description: '维持自己实际观察过的原位影像，最多二十秒，尝试误导下一次尚未落定的追踪。身体和随身原物仍须真实移动；环境改变或失去联系会使窗口失效。' },
] as const;
export const FOOL_FORMULA = [
  { name: '愚者唯一性', quantity: 1, unit: '件', note: '世界中的同一件原物，必须查明现有封存和交接。' },
  { name: '本人之外的诡秘侍者特性', quantity: 2, unit: '份', note: '连同自身已整合的一份，总共三份；旧失败原瓶不返还，须追查原特性的实际去向。' },
  { name: '历史迷雾', quantity: 25, unit: '%以上实控', note: '当前有效控制，依据真实原锚、灵之虫和维护时限核验；读过资料不计入。' },
] as const;
export const FOOL_STORY = '第五纪1652年，守护北部旧航路的前任愚者埃莱诺·赛伦在封闭失控灵界裂口时陨落。保管人把析出的三份诡秘侍者特性分别封存，次年才进入阿德里安核验的三份遗产。唯一性则留在独立封库，完整交接簿记录了同一件原物的去向。如今神位空缺，继承并不会免去真实仪式和失控风险。';
export const FOOL_GOAL = '查明并取得原材料，改变一场真实受约束的商运结局，再用四站原锚维持至少四分之一历史迷雾，最后在窗口内服药。';
export const FOOL_RISK = '服药耗尽本瓶普通药液和封材。失败会造成真实身心伤害与污染，可能死亡；只有仍活着且原残余确实可定位、封存时，才可能重筹。旧复起次数不会在本次仪式中自动抵死。';
export const FOOL_SOURCE_RULES = {
  formula: 'L226441–226451：唯一性、本人之外两份S1、至少四分之一历史迷雾、真正愚弄时间/历史/命运一次。',
  ritual: 'L238648–238654：容纳唯一性的简化仪式不能替完整晋0。原书未给普通角色可复用的充分判定步骤；本作撤运约束与实控分母为独立原创实现。',
  abilities: 'L242958–242962、L243392–243421：盲愚及本能反制。L243590–243614：历史影像脱身个例。3秒、20秒及消耗均为本作平衡，不是原文通用数值。',
  limits: '不授予源堡、邻途径权限、免费实体复制、完整复活/回滚或概念恒星攻击；仅此处有限仪式与后续撤离段。',
} as const;
export const FOOL_RECEPTION_PRICES = { workIncome: 24, rest: 8, week: 24 } as const;
export const FOOL_CONSUMPTION = { seconds: 60, difficulty: 35, failureHealth: 35, failureMind: 45, failurePollution: 35, greatFailureHealth: 60, greatFailureMind: 80, greatFailurePollution: 70 } as const;
export const FOOL_ESCAPE_RULES = { blindSeconds: 3, echoSeconds: 20, blindSpirituality: 12, blindMind: 4, echoSpirituality: 12, echoMind: 4, aid: 35, mitigation: 30 } as const;
