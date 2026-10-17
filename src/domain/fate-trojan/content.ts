import type { FateTrojanAbilityId, FateTrojanPreparationId } from './types.js';

/** The finished-potion channel, preparations, finite scenes and all quantities are original G.
 * The complete original recipe and promotion rite remain unverified; these support steps
 * neither assert that a rite is unnecessary nor claim to reproduce the original rite. */
export const FATE_TROJAN_GUIDE = '贝克兰德命运木马专业交接处';
export const FATE_TROJAN_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const FATE_TROJAN_MIN_DECEIT_MENTOR_WEEKS = 12;
export const FATE_TROJAN_LABOUR_STEPS = 5;
export const FATE_TROJAN_BOTTLE_IDS = ['fate-trojan-potion-1', 'fate-trojan-potion-2', 'fate-trojan-potion-3'] as const;
export const FATE_TROJAN_FORMULA_STATUS = '交接处供应分别封存的命运木马成品魔药。领取药瓶后，仍须亲自完成三项专业准备，并在服用当周检查场地。';
export const FATE_TROJAN_SOURCE_STATUS = '登记室会分别核对眼前的人、当前身份关联和已安排的具体责任。每次实践都要重新取得当事人的明确同意，记录原物位置、实际耗费和最后的归还。';
export const FATE_TROJAN_POTION_SOURCES = FATE_TROJAN_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${FATE_TROJAN_GUIDE}初始批次第${index + 1}瓶序列2命运木马成品魔药，封存编号${id}。本瓶有独立的交付与耗用记录。`,
}));
export const FATE_TROJAN_LABOUR_TASKS = ['核验本瓶封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const FATE_TROJAN_PREPARATIONS: { id: FateTrojanPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_PERSON', title: '当面核对本人和参与者', description: '本人亲自核对参与者的身份、身体所在和当前意愿，区分各人已有的许可和此次尚待确认的同意。' },
  { id: 'TRACE_LINK', title: '追查已有的身份关联与责任', description: '本人核读登记室既有记录，确认原柜识别的对象、原包裹的主人、已安排的搬运责任及约定报酬。每项关联都须有眼前的实际来源。' },
  { id: 'PLAN_RETURN', title: '走查停止与归还路线', description: '本人沿原通道检查停止、返程、恢复身份关联和归还封签的顺序，确认归还所需的灵性与实际路程。已发生的损耗、报酬和伤害持续留存。' },
];
export const FATE_TROJAN_ABILITIES: { id: FateTrojanAbilityId; label: string; description: string }[] = [
  { id: 'error.s2.identity-link', label: '身份关联', description: '在当前同意和准备齐备时，花8灵性、1行动，以知识难度20尝试暂接同一原柜对原主的身份识别，最长20秒。期间原主不能使用该关联；你须亲自到柜前实际验证，随后回到原桌恢复关联，归还另需4灵性。原身体、姓名、装备和所有权仍分别属于原人。' },
  { id: 'error.s2.fate-assumption', label: '命运承担', description: '先记录原主已经承担的一次包裹搬运和对应报酬，再花8灵性、1行动，以意志难度20尝试承担这一具体责任。成功后由你亲自搬运，实际付出5健康与5精力，完成后才领取约定的12便士。撤回或等待不会抹去已经发生的后果。' },
];
export const FATE_TROJAN_CONSUMPTION_RISK = '欺瞒导师消化100、从实际晋升周起经过12整周，且健康>20、精神>40。三项专业准备各需1行动，服药当周另花1行动与140便士检查场地，再以0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和本次场地准备都会耗尽。专业支持仅将本次药物排异后的健康与精神保底到1，普通死亡与战斗照常结算。已有三项准备经历保留，休养后须另筹原瓶并重新检查场地。成功后四属性各+1，旧消化与全部12项掌握保留，两项新掌握从0开始；灵性上限120、当前不补满，身体性别保持。';
