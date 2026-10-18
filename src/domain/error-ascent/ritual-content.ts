/** Limited original game branch, not a claim about canonical events or old saves. */
import type { PublicGameDate } from '../../shared/contracts.js';
import type { ErrorRitualPastEvent } from './ritual-types.js';
export const ERROR_RITUAL_SITE = 'ER219-TIDE-BELL-TOWER';
export const ERROR_RITUAL_OUTER = 'ER219-TIDE-BELL-OUTER-CONTACT';
export const ERROR_RITUAL_INNER = 'ER219-TIDE-BELL-INNER-VESSEL';
export const ERROR_RITUAL_CANDIDATE = 'ER219-CANDIDATE';
export const ERROR_RITUAL_SUN = 'ER219-SUN';
export const ERROR_RITUAL_CUSTODIAN = 'ER219-TYRANT-CUSTODIAN';
export const ERROR_RITUAL_THUNDER = ['ER219-THUNDER-1', 'ER219-THUNDER-2', 'ER219-THUNDER-3'] as const;
export const ERROR_RITUAL_TYRANT = 'ER219-TYRANT-UNIQUE';
export const ERROR_RITUAL_LIGHT = ['ER219-LIGHT-1', 'ER219-LIGHT-2', 'ER219-LIGHT-3'] as const;
export const ERROR_RITUAL_SUN_UNIQUE = 'ER219-SUN-UNIQUE';
export const ERROR_RITUAL_TERMS = {
  surveySeconds: 600, lineSeconds: 600, linePrice: 50, walkSeconds: 6, walkMetres: 6,
  assemblySeconds: 600, windowStart: 18, windowEnd: 30, actionSeconds: 4,
  actions: 1, spirituality: 30, mental: 8, difficulty: 56, stabilizationBonus: 40,
  failure: { health: 45, mental: 40, pollution: 35 }, severeFailure: { health: 110, mental: 100, pollution: 70 },
  resistanceSpirituality: 18, guardSeconds: 8, recoverySeconds: 600, recoveryCash: 30, recoverySpirituality: 8,
} as const;
const d = (year: number, month: number, day: number): PublicGameDate => ({ epoch: 'FIFTH_EPOCH', year, month, day });
const SUN_OBJECTS = [...ERROR_RITUAL_LIGHT, ERROR_RITUAL_SUN_UNIQUE];
const TYRANT_OBJECTS = [...ERROR_RITUAL_THUNDER, ERROR_RITUAL_TYRANT];
const members = [[1, 70000]] as const;
/** Replayed once by createErrorRitual. Every movement uses the same physical IDs. */
export const ERROR_RITUAL_PAST: readonly ErrorRitualPastEvent[] = [
  { id: 'ER219-SUN-PRIOR-DEATH', date: d(1349, 1, 2), kind: 'PREDECESSOR_DIED', predecessor: 'SUN', text: '前任太阳塞维安在圣所崩塌中死亡；原三份纯白天使与唯一性从同一遗体析出。' },
  { id: 'ER219-SUN-CUSTODY', date: d(1349, 1, 3), kind: 'HANDOVER', objects: SUN_OBJECTS, from: 'ER219-PRIOR-SUN', to: 'ER219-SUN-KEEPER', owner: 'ER219-SUN-KEEPER', place: 'ER219-SUN-VAULT', price: 0, text: '守库人佩拉亲手将四件原物从遗体现场移入圣所库房，未容纳。' },
  { id: 'ER219-SUN-FIRST-PURCHASE', date: d(1349, 1, 4), kind: 'HANDOVER', objects: [ERROR_RITUAL_LIGHT[0]], from: 'ER219-SUN-KEEPER', to: ERROR_RITUAL_SUN, owner: ERROR_RITUAL_SUN, place: 'ER219-SUN-SANCTUM', price: 6600, text: '奥雷利奥付6600便士取得第一份原纯白天使。' },
  { id: 'ER219-SUN-FIRST-EMBODIED', date: d(1349, 1, 4), kind: 'EMBODY_FIRST', actor: 'SUN', object: ERROR_RITUAL_LIGHT[0], text: '奥雷利奥实际饮用第一份原剂并完成序列1融合；空瓶不再含特性。' },
  { id: 'ER219-SUN-REMAINING-PURCHASE', date: d(1349, 6, 1), kind: 'HANDOVER', objects: [ERROR_RITUAL_LIGHT[1], ERROR_RITUAL_LIGHT[2], ERROR_RITUAL_SUN_UNIQUE], from: 'ER219-SUN-KEEPER', to: ERROR_RITUAL_SUN, owner: ERROR_RITUAL_SUN, place: 'ER219-SUN-SANCTUM', price: 15000, text: '奥雷利奥支付15000便士取得同两份外置特性与唯一性，原库位腾空。' },
  { id: 'ER219-SUN-ASCENSION', date: d(1349, 6, 4), kind: 'SUN_ASCENDED', text: '奥雷利奥在圣所真实饮下原两份纯白天使与唯一性，与体内原第一份完成太阳0融合。' },
  { id: 'ER219-TYRANT-DEATH', date: d(1350, 11, 2), kind: 'PREDECESSOR_DIED', predecessor: 'TYRANT', text: '前任陶伦死于海上神战，原三份雷神和唯一性从同一遗体析出，神位空缺。' },
  { id: 'ER219-TYRANT-CUSTODY', date: d(1350, 11, 3), kind: 'HANDOVER', objects: TYRANT_OBJECTS, from: 'ER219-PRIOR-TYRANT', to: ERROR_RITUAL_CUSTODIAN, owner: ERROR_RITUAL_CUSTODIAN, place: 'ER219-TYRANT-VAULT', price: 0, text: '海伦·里德在原现场封存四件原物并实运入库，自身未容纳。' },
  { id: 'ER219-CANDIDATE-FIRST-PURCHASE', date: d(1350, 12, 17), kind: 'HANDOVER', objects: [ERROR_RITUAL_THUNDER[0]], from: ERROR_RITUAL_CUSTODIAN, to: ERROR_RITUAL_CANDIDATE, owner: ERROR_RITUAL_CANDIDATE, place: 'ER219-COASTAL-HALL', price: 6600, text: '伊德里克·维尔用自己的财产支付6600便士，海伦交出第一份原雷神。' },
  { id: 'ER219-CANDIDATE-S1', date: d(1350, 12, 17), kind: 'EMBODY_FIRST', actor: 'CANDIDATE', object: ERROR_RITUAL_THUNDER[0], text: '伊德里克实际饮用并容纳第一份原雷神，另外两份仍封存于海伦处。' },
  { id: 'ER219-COHORT-FEAR', date: d(1351, 9, 6), kind: 'COHORT', state: 'fear', members, text: '北岸NC、东岸EC、南岸SC三个固定名册各00001至70000人亲历惩罚性风暴；这些原人均存活并形成对伊德里克的恐惧。' },
  { id: 'ER219-COHORT-OBEY', date: d(1351, 9, 20), kind: 'COHORT', state: 'obey', members, text: '同三个名册的原人实际依令撤离并缴纳征收，分别登记服从；其他居民不计入。' },
  { id: 'ER219-COHORT-BELIEVE', date: d(1351, 10, 11), kind: 'COHORT', state: 'believe', members, text: '同三个名册的原人目睹伊德里克平息外海风暴，此后持续参与祷告；信仰另行成立，不由恐惧或服从代填。' },
  { id: 'ER219-CANDIDATE-TITLE', date: d(1352, 3, 4), kind: 'HANDOVER', objects: [ERROR_RITUAL_THUNDER[1], ERROR_RITUAL_THUNDER[2], ERROR_RITUAL_TYRANT], from: ERROR_RITUAL_CUSTODIAN, to: ERROR_RITUAL_CUSTODIAN, owner: ERROR_RITUAL_CANDIDATE, place: 'ER219-TYRANT-VAULT', price: 15000, text: '伊德里克实付15000便士买下剩余三物，海伦保留实物代管；所有权与持有分开。' },
  { id: 'ER219-SUN-CHALLENGE-1', date: d(1352, 3, 18), kind: 'CHALLENGE', playerAttack: true, candidateHealthLoss: 8, candidateSpiritualityCost: 12, sunHealthLoss: 12, sunSpiritualityCost: 12, from: 0, to: 0, seconds: 30, breaksContact: false, text: '伊德里克独自雷击挑战仍在世的太阳0；奥雷利奥以太阳长枪真实反击。' },
  { id: 'ER219-SUN-CHALLENGE-2', date: d(1352, 3, 18), kind: 'CHALLENGE', playerAttack: false, candidateHealthLoss: 7, candidateSpiritualityCost: 4, sunHealthLoss: 0, sunSpiritualityCost: 16, from: 0, to: 20, seconds: 20, breaksContact: false, text: '伊德里克付灵性掩护，沿圣所实路后撤20米；太阳追猎反击。' },
  { id: 'ER219-SUN-CHALLENGE-3', date: d(1352, 3, 18), kind: 'CHALLENGE', playerAttack: false, candidateHealthLoss: 10, candidateSpiritualityCost: 0, sunHealthLoss: 0, sunSpiritualityCost: 16, from: 20, to: 60, seconds: 40, breaksContact: false, text: '伊德里克沿原通道再跑40米，遭焰光截击并留下实际灼伤。' },
  { id: 'ER219-SUN-CHALLENGE-4', date: d(1352, 3, 18), kind: 'CHALLENGE', playerAttack: false, candidateHealthLoss: 6, candidateSpiritualityCost: 0, sunHealthLoss: 0, sunSpiritualityCost: 20, from: 60, to: 60, seconds: 10, breaksContact: true, text: '伊德里克撑过最后一次地平线烙印，进入60米岩隙脱离；无协助者，真神仍敌对且存活。' },
  { id: 'ER219-CANDIDATE-CARE', date: d(1352, 3, 21), kind: 'CARE', price: 60, healthGain: 30, spiritualityGain: 16, restSeconds: 57600, text: '医师莱文收60便士治疗原灼伤；两次八小时休养使健康69→99、灵性104→120，旧伤事件保留。' },
  { id: 'ER219-CANDIDATE-INTENT', date: d(1352, 3, 22), kind: 'INTENT', text: '伊德里克决定在下一次潮汐钟塔集会完成暴君晋升，以统治沿海城邦；没有征询玩家，也不与玩家合作。' },
];
