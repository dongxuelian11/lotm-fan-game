import type { LawyerAbilityId } from './types.js';
export { LAWYER_CASE_IDS } from './types.js';

/** Verified chapter summaries only. Guide, finished supply, cases and numbers are original G. */
export const LAWYER_GUIDE = '契约文书员米蕾·沃德';
export const LAWYER_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const LAWYER_BOTTLE_IDS = ['lawyer-potion-1', 'lawyer-potion-2', 'lawyer-potion-3'] as const;
export const LAWYER_SOURCE_STATUS = '《诡秘之主》第二部第110章《开启咒文》支持律师善于发现规则漏洞、抓住对手弱点，并拥有出色口才与思维能力；第五部第87章支持律师的说服表现。序列9只能围绕实际掌握的条款、可观察行为与可交流对象进行分析和说服，不自动获得真相，不强制他人服从，不改写现实。序列8野蛮人的非凡体能与精神抗性、序列7贿赂者的贿赂、序列6腐化男爵的扭曲均不下放。米蕾·沃德是本作原创成年契约文书员；独立成品药渠道、普通劳务、三项有限核实与反思、全部游戏数值均为本作原创G，不自动建立王室、教会或其它组织身份。';
export const LAWYER_POTION_SOURCES = LAWYER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${LAWYER_GUIDE}独立保管的第${index + 1}瓶律师成品魔药，原瓶独立封存；文书员与契约铺供给为本作原创G，未声称现场配制。取得此瓶不建立王室、教会或其它组织身份。`,
}));
export const LAWYER_FORMULA_STATUS = '律师完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const LAWYER_ABILITIES: { id: LawyerAbilityId; label: string; description: string }[] = [
  { id: 'black-emperor.s9.rule-analysis', label: '规则分析', description: '分析已经读到的条款、规程和适用条件，寻找措辞漏洞与前后矛盾。未见条款仍须查阅，不能凭分析制造证据、自动知晓真相或改写既有规则。' },
  { id: 'black-emperor.s9.persuasive-argument', label: '说服论证', description: '以出色口才和思维整理理由，向能够交流的对象提出有限说服。对方仍能拒绝；不强制服从、不支配人格，也没有贿赂或扭曲效果。' },
  { id: 'black-emperor.s9.weak-point-insight', label: '弱点识别', description: '从眼前行为与对方已经提出的理由中抓住弱点，再以事实核对。没有自动读心、测谎、洞悉隐藏身份或保证命中的能力，不下放野蛮人体能与精神抗性。' },
];
export const LAWYER_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。文书员在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗、异常接触及其它危险。分析不能凭空发现未知事实，说服有被拒绝的可能；停止本次交涉不会抹除已经说过的话、达成的约定或造成的后果。';
