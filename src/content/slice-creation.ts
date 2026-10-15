import {
  PUBLIC_CONDITION_ARCHETYPES,
  type CharacterCreationSelection,
  type PublicCharacterProjection,
  type PublicChoiceOption,
  type PublicCompatibilityRule,
  type PublicConditionArchetypeId,
  type PublicCoreStats,
  type PublicEducationLevel,
  type PublicOriginOption,
  type PublicPortraitOption,
  type PublicProfessionOption,
  type PublicTraitOption,
} from "../shared/contracts.js";
import { R2_COMPATIBILITY_MATRIX, R2_FIXTURE_CATALOGUE } from "./r2-catalogue.js";

/** Approved slice candidates, not a claim about historical wages or canon qualifications. */
export const SLICE_CREATION_CONTENT_VERSION = "playable-slice-creation-v1" as const;
export type SliceLivingStandardId = "DESTITUTE" | "POOR" | "ORDINARY" | "RESPECTABLE" | "LUXURIOUS";
export interface SliceCreationSelection extends CharacterCreationSelection {
  readonly portraitId: string;
  readonly educationLevel: PublicEducationLevel;
  readonly livingStandardId: SliceLivingStandardId;
}
export interface SliceEducationOption extends PublicChoiceOption {
  readonly id: PublicEducationLevel;
  readonly openingKnowledgeBonus: number;
  readonly learningKnowledgeBonus: number;
}
export interface SliceLivingStandardOption extends PublicChoiceOption {
  readonly id: SliceLivingStandardId;
  readonly weeklyCostPence: number;
  readonly restHealth: number;
  readonly restMind: number;
  readonly restSpiritualityFraction: number;
}
export interface SliceAlternativeEducation {
  readonly level: PublicEducationLevel;
  readonly costPence: number;
  readonly prerequisite: string;
}
export interface SliceOriginOption extends PublicOriginOption {
  readonly originCode: string;
  readonly opening: PublicOriginOption["opening"] & {
    readonly familyTransferPence: number;
    readonly initialDebtPence: number;
    readonly debtWeeklyRepaymentPence: number;
    readonly defaultLivingStandardId: SliceLivingStandardId;
    readonly alternativeEducation?: SliceAlternativeEducation;
    readonly supportLabel: string;
    readonly obligationLabel: string;
    readonly originOpeningId: string;
    readonly eventHooks: readonly string[];
  };
}
export interface SliceProfessionOption extends PublicProfessionOption {
  readonly incomeTier: "LOW" | "MIDDLE" | "HIGH";
  readonly auditStatus: "GAME_ADAPTATION" | "APPROVED_ROSTER";
}
export interface SlicePersonalityOption extends PublicTraitOption {
  readonly coreStatModifiers: PublicCoreStats;
  readonly situationTag: string;
}
export interface SliceConditionRequirement {
  readonly id: string;
  readonly originId: string;
  readonly professionId: string;
  readonly archetypeId: PublicConditionArchetypeId;
  readonly prerequisite: string;
  readonly costPence: number;
}
export interface SliceCompatibilityRule extends PublicCompatibilityRule {
  readonly archetypeId?: PublicConditionArchetypeId;
  readonly prerequisite?: string;
  readonly costPence?: number;
}
export interface SliceCreationCatalogue {
  readonly contentVersion: typeof SLICE_CREATION_CONTENT_VERSION;
  readonly status: "BALANCE_REVIEW_CANDIDATE";
  readonly notice: string;
  readonly birthplaces: readonly PublicChoiceOption[];
  readonly portraits: readonly PublicPortraitOption[];
  readonly origins: readonly SliceOriginOption[];
  readonly professions: readonly SliceProfessionOption[];
  readonly traits: readonly SlicePersonalityOption[];
  readonly flaws: readonly SlicePersonalityOption[];
  readonly compatibility: readonly SliceCompatibilityRule[];
  readonly conditions: readonly SliceConditionRequirement[];
  readonly educations: readonly SliceEducationOption[];
  readonly livingStandards: readonly SliceLivingStandardOption[];
  readonly conditionArchetypes: typeof PUBLIC_CONDITION_ARCHETYPES;
}

const ZERO_STATS: PublicCoreStats = { physique: 0, perception: 0, will: 0, knowledge: 0 };
const BASE_STATS: PublicCoreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
const EDUCATIONS: readonly SliceEducationOption[] = [
  { id: "NONE_FORMAL", label: "无正式学历", summary: "无正式学历不等于文盲；不自动获得秘密。", openingKnowledgeBonus: 0, learningKnowledgeBonus: 0 },
  { id: "BASIC", label: "基础教育", summary: "开局知识+1；成功学习无额外加值。", openingKnowledgeBonus: 1, learningKnowledgeBonus: 0 },
  { id: "SECONDARY_VOCATIONAL", label: "中等/职业教育", summary: "开局知识+2；成功学习额外知识+1。", openingKnowledgeBonus: 2, learningKnowledgeBonus: 1 },
  { id: "HIGHER", label: "高等教育", summary: "开局知识+3；成功学习额外知识+1。", openingKnowledgeBonus: 3, learningKnowledgeBonus: 1 },
];
const LIVING_STANDARDS: readonly SliceLivingStandardOption[] = [
  { id: "DESTITUTE", label: "赤贫", summary: "贝克兰德个人周费用30便士。", weeklyCostPence: 30, restHealth: 8, restMind: 10, restSpiritualityFraction: 0.1 },
  { id: "POOR", label: "贫困", summary: "贝克兰德个人周费用120便士。", weeklyCostPence: 120, restHealth: 12, restMind: 15, restSpiritualityFraction: 0.15 },
  { id: "ORDINARY", label: "普通", summary: "贝克兰德个人周费用300便士。", weeklyCostPence: 300, restHealth: 18, restMind: 20, restSpiritualityFraction: 0.2 },
  { id: "RESPECTABLE", label: "体面", summary: "贝克兰德个人周费用600便士。", weeklyCostPence: 600, restHealth: 22, restMind: 25, restSpiritualityFraction: 0.25 },
  { id: "LUXURIOUS", label: "奢华", summary: "贝克兰德个人周费用6000便士。", weeklyCostPence: 6000, restHealth: 25, restMind: 30, restSpiritualityFraction: 0.3 },
];

interface OriginProfile {
  readonly originId: string;
  readonly originCode: string;
  readonly coreStatModifiers: PublicCoreStats;
  readonly defaultEducation: PublicEducationLevel;
  readonly alternativeEducation?: SliceAlternativeEducation;
  readonly familyTransferPence: number;
  readonly initialDebtPence: number;
  readonly debtWeeklyRepaymentPence: number;
  readonly defaultLivingStandardId: SliceLivingStandardId;
  readonly familyEconomyLabel: string;
  readonly supportLabel: string;
  readonly obligationLabel: string;
  readonly eventHooks: readonly string[];
}

const ORIGIN_PROFILES: readonly OriginProfile[] = [
  {"originId": "origin-poor-1", "originCode": "O01", "coreStatModifiers": {"physique": 1, "perception": 2, "will": 0, "knowledge": -1}, "defaultEducation": "NONE_FORMAL", "familyTransferPence": 0, "initialDebtPence": 0, "debtWeeklyRepaymentPence": 0, "defaultLivingStandardId": "DESTITUTE", "familyEconomyLabel": "无稳定家庭资产", "supportLabel": "旧街坊", "obligationLabel": "居所不稳", "eventHooks": ["借住安排", "旧物买卖"], "alternativeEducation": {"level": "BASIC", "costPence": 60, "prerequisite": "曾参加识字夜课"}},
  {"originId": "origin-poor-2", "originCode": "O02", "coreStatModifiers": {"physique": 1, "perception": 0, "will": 2, "knowledge": -1}, "defaultEducation": "BASIC", "familyTransferPence": 30, "initialDebtPence": 240, "debtWeeklyRepaymentPence": 30, "defaultLivingStandardId": "DESTITUTE", "familyEconomyLabel": "负债且缺少稳定收入", "supportLabel": "共同生活的亲属", "obligationLabel": "家庭债务", "eventHooks": ["家庭周转", "失业后的熟人求助"], "alternativeEducation": {"level": "SECONDARY_VOCATIONAL", "costPence": 120, "prerequisite": "曾完成半工半读课程"}},
  {"originId": "origin-labor-1", "originCode": "O03", "coreStatModifiers": {"physique": 2, "perception": 0, "will": 1, "knowledge": -1}, "defaultEducation": "BASIC", "familyTransferPence": 120, "initialDebtPence": 0, "debtWeeklyRepaymentPence": 0, "defaultLivingStandardId": "POOR", "familyEconomyLabel": "依靠工厂工资", "supportLabel": "老工友", "obligationLabel": "工伤隐患", "eventHooks": ["工伤与休养", "器械流转"], "alternativeEducation": {"level": "SECONDARY_VOCATIONAL", "costPence": 120, "prerequisite": "曾修完工场技术课程"}},
  {"originId": "origin-labor-2", "originCode": "O04", "coreStatModifiers": {"physique": -1, "perception": 2, "will": 1, "knowledge": 0}, "defaultEducation": "BASIC", "familyTransferPence": 120, "initialDebtPence": 0, "debtWeeklyRepaymentPence": 0, "defaultLivingStandardId": "POOR", "familyEconomyLabel": "依附雇主供给", "supportLabel": "年长家人", "obligationLabel": "雇主依附", "eventHooks": ["服务圈传话", "雇主与家人请求"], "alternativeEducation": {"level": "SECONDARY_VOCATIONAL", "costPence": 120, "prerequisite": "曾完成记账与文书课程"}},
  {"originId": "origin-lower-middle-1", "originCode": "O05", "coreStatModifiers": {"physique": -1, "perception": 2, "will": 0, "knowledge": 1}, "defaultEducation": "SECONDARY_VOCATIONAL", "familyTransferPence": 360, "initialDebtPence": 0, "debtWeeklyRepaymentPence": 0, "defaultLivingStandardId": "ORDINARY", "familyEconomyLabel": "拥有少量经营资产", "supportLabel": "家中经营者", "obligationLabel": "家庭现金紧张", "eventHooks": ["供货纠纷", "家中现金紧张"], "alternativeEducation": {"level": "HIGHER", "costPence": 360, "prerequisite": "家庭曾负担高等课程"}},
  {"originId": "origin-lower-middle-2", "originCode": "O06", "coreStatModifiers": {"physique": -1, "perception": 0, "will": 1, "knowledge": 2}, "defaultEducation": "SECONDARY_VOCATIONAL", "familyTransferPence": 360, "initialDebtPence": 0, "debtWeeklyRepaymentPence": 0, "defaultLivingStandardId": "ORDINARY", "familyEconomyLabel": "固定薪资与教育积蓄", "supportLabel": "长辈", "obligationLabel": "体面压力", "eventHooks": ["普通进修消息", "体面与开销"], "alternativeEducation": {"level": "HIGHER", "costPence": 360, "prerequisite": "曾靠家庭积蓄完成学业"}},
  {"originId": "origin-upper-middle-1", "originCode": "O07", "coreStatModifiers": {"physique": -1, "perception": 0, "will": 1, "knowledge": 2}, "defaultEducation": "HIGHER", "familyTransferPence": 1200, "initialDebtPence": 0, "debtWeeklyRepaymentPence": 0, "defaultLivingStandardId": "ORDINARY", "familyEconomyLabel": "稳定专业收入与教育资源", "supportLabel": "专业人士家人", "obligationLabel": "家庭期待", "eventHooks": ["专业圈求证", "家庭期待"]},
  {"originId": "origin-upper-middle-2", "originCode": "O08", "coreStatModifiers": {"physique": -1, "perception": 0, "will": 2, "knowledge": 1}, "defaultEducation": "SECONDARY_VOCATIONAL", "familyTransferPence": 1200, "initialDebtPence": 0, "debtWeeklyRepaymentPence": 0, "defaultLivingStandardId": "ORDINARY", "familyEconomyLabel": "中型经营资产与商贸信用", "supportLabel": "商贸亲属", "obligationLabel": "利益纠葛", "eventHooks": ["交货与信用", "亲属利益纠葛"], "alternativeEducation": {"level": "HIGHER", "costPence": 360, "prerequisite": "曾外出完成专业学业"}},
  {"originId": "origin-upper-1", "originCode": "O09", "coreStatModifiers": {"physique": -1, "perception": 1, "will": 2, "knowledge": 0}, "defaultEducation": "HIGHER", "familyTransferPence": 2400, "initialDebtPence": 0, "debtWeeklyRepaymentPence": 0, "defaultLivingStandardId": "RESPECTABLE", "familyEconomyLabel": "家族资产与家名网络", "supportLabel": "家庭联络人", "obligationLabel": "家名约束", "eventHooks": ["家名与个人选择", "旧关系变化"]},
  {"originId": "origin-upper-2", "originCode": "O10", "coreStatModifiers": {"physique": -1, "perception": 1, "will": 0, "knowledge": 2}, "defaultEducation": "HIGHER", "familyTransferPence": 2400, "initialDebtPence": 0, "debtWeeklyRepaymentPence": 0, "defaultLivingStandardId": "RESPECTABLE", "familyEconomyLabel": "大型经营与资本网络", "supportLabel": "家庭代理人", "obligationLabel": "声誉期待", "eventHooks": ["商业名声", "代理人的求助"]},
];

interface ProfessionProfile { readonly professionId: string; readonly coreStatModifiers: PublicCoreStats; readonly incomeTier: "LOW" | "MIDDLE" | "HIGH"; readonly initialCashPence: number; readonly weeklyWorkPayPence: number; }

const PROFESSION_PROFILES: readonly ProfessionProfile[] = [
  {"professionId": "profession-factory-worker", "coreStatModifiers": {"physique": 2, "perception": 0, "will": 1, "knowledge": 0}, "incomeTier": "LOW", "initialCashPence": 120, "weeklyWorkPayPence": 180},
  {"professionId": "profession-dock-worker", "coreStatModifiers": {"physique": 2, "perception": 1, "will": 0, "knowledge": 0}, "incomeTier": "LOW", "initialCashPence": 120, "weeklyWorkPayPence": 180},
  {"professionId": "profession-estate-servant", "coreStatModifiers": {"physique": 0, "perception": 2, "will": 1, "knowledge": 0}, "incomeTier": "LOW", "initialCashPence": 120, "weeklyWorkPayPence": 180},
  {"professionId": "profession-craft-apprentice", "coreStatModifiers": {"physique": 1, "perception": 2, "will": 0, "knowledge": 0}, "incomeTier": "LOW", "initialCashPence": 120, "weeklyWorkPayPence": 180},
  {"professionId": "profession-shop-clerk", "coreStatModifiers": {"physique": 0, "perception": 2, "will": 0, "knowledge": 1}, "incomeTier": "LOW", "initialCashPence": 120, "weeklyWorkPayPence": 180},
  {"professionId": "profession-company-clerk", "coreStatModifiers": {"physique": 0, "perception": 0, "will": 1, "knowledge": 2}, "incomeTier": "MIDDLE", "initialCashPence": 360, "weeklyWorkPayPence": 360},
  {"professionId": "profession-junior-police-officer", "coreStatModifiers": {"physique": 2, "perception": 1, "will": 0, "knowledge": 0}, "incomeTier": "MIDDLE", "initialCashPence": 360, "weeklyWorkPayPence": 360},
  {"professionId": "profession-private-detective", "coreStatModifiers": {"physique": 0, "perception": 2, "will": 0, "knowledge": 1}, "incomeTier": "MIDDLE", "initialCashPence": 360, "weeklyWorkPayPence": 360},
  {"professionId": "profession-company-accountant", "coreStatModifiers": {"physique": 0, "perception": 1, "will": 0, "knowledge": 2}, "incomeTier": "HIGH", "initialCashPence": 720, "weeklyWorkPayPence": 720},
  {"professionId": "profession-lawyer", "coreStatModifiers": {"physique": 0, "perception": 0, "will": 1, "knowledge": 2}, "incomeTier": "HIGH", "initialCashPence": 720, "weeklyWorkPayPence": 720},
  {"professionId": "profession-bounty-hunter", "coreStatModifiers": {"physique": 2, "perception": 1, "will": 0, "knowledge": 0}, "incomeTier": "MIDDLE", "initialCashPence": 360, "weeklyWorkPayPence": 360},
  {"professionId": "profession-gang-runner", "coreStatModifiers": {"physique": 2, "perception": 1, "will": 0, "knowledge": 0}, "incomeTier": "LOW", "initialCashPence": 120, "weeklyWorkPayPence": 180},
];

const CONDITIONS: readonly SliceConditionRequirement[] = [
  {"id": "C01", "originId": "origin-poor-1", "professionId": "profession-estate-servant", "archetypeId": "recommendation-guarantee", "prerequisite": "曾由熟悉你的旧街坊介绍到宅邸试任，支出了安置费用", "costPence": 30},
  {"id": "C02", "originId": "origin-poor-1", "professionId": "profession-craft-apprentice", "archetypeId": "funds-tools", "prerequisite": "曾攒下一套入门工具，得以进入小作坊学手艺", "costPence": 60},
  {"id": "C03", "originId": "origin-poor-1", "professionId": "profession-shop-clerk", "archetypeId": "relevant-history-trial", "prerequisite": "曾替街边小店看摊并完成试工，支出了试工期间食宿", "costPence": 30},
  {"id": "C04", "originId": "origin-poor-1", "professionId": "profession-company-clerk", "archetypeId": "education-qualification", "prerequisite": "曾学会岗位所需的誊写记账，积蓄用于专项课程", "costPence": 60},
  {"id": "C05", "originId": "origin-poor-1", "professionId": "profession-junior-police-officer", "archetypeId": "relevant-history-trial", "prerequisite": "曾完成基层勤务试用，承担了试用期间的安置开销", "costPence": 60},
  {"id": "C06", "originId": "origin-poor-1", "professionId": "profession-private-detective", "archetypeId": "recommendation-guarantee", "prerequisite": "曾获一名普通调查从业者引荐，支付了从业安置费用", "costPence": 60},
  {"id": "C07", "originId": "origin-poor-2", "professionId": "profession-company-clerk", "archetypeId": "education-qualification", "prerequisite": "曾在照料家庭期间修完文书训练，个人积蓄支付了课程", "costPence": 60},
  {"id": "C08", "originId": "origin-poor-2", "professionId": "profession-junior-police-officer", "archetypeId": "recommendation-guarantee", "prerequisite": "曾获熟悉家庭情况者担保进入勤务试任，支付了安置费", "costPence": 60},
  {"id": "C09", "originId": "origin-poor-2", "professionId": "profession-private-detective", "archetypeId": "relevant-history-trial", "prerequisite": "曾替人核实欠账与失物并完成试任，积蓄用于试任生活", "costPence": 60},
  {"id": "C10", "originId": "origin-poor-2", "professionId": "profession-bounty-hunter", "archetypeId": "funds-tools", "prerequisite": "曾备齐承接普通寻人委托的工具，开局积蓄已支付工具款", "costPence": 90},
  {"id": "C11", "originId": "origin-labor-1", "professionId": "profession-estate-servant", "archetypeId": "recommendation-guarantee", "prerequisite": "曾由工友亲属介绍转入宅邸服务，承担了搬住安置费用", "costPence": 30},
  {"id": "C12", "originId": "origin-labor-1", "professionId": "profession-company-clerk", "archetypeId": "education-qualification", "prerequisite": "曾把夜班之外的时间用于文书课程，积蓄支付了培训", "costPence": 60},
  {"id": "C13", "originId": "origin-labor-1", "professionId": "profession-junior-police-officer", "archetypeId": "relevant-history-trial", "prerequisite": "曾完成工场外的勤务试任，承担试任期间食宿", "costPence": 60},
  {"id": "C14", "originId": "origin-labor-1", "professionId": "profession-private-detective", "archetypeId": "relevant-history-trial", "prerequisite": "曾以工场寻人查账经历完成调查助理试任，支付试任开销", "costPence": 60},
  {"id": "C15", "originId": "origin-labor-2", "professionId": "profession-factory-worker", "archetypeId": "family-class-compromise", "prerequisite": "曾离开依附住所独立谋生，家庭转交中已扣出安置款", "costPence": 60},
  {"id": "C16", "originId": "origin-labor-2", "professionId": "profession-dock-worker", "archetypeId": "relevant-history-trial", "prerequisite": "曾通过熟悉的搬运队完成试工，支付试工期间食宿", "costPence": 30},
  {"id": "C17", "originId": "origin-labor-2", "professionId": "profession-craft-apprentice", "archetypeId": "funds-tools", "prerequisite": "曾购置手艺入门工具以离开服务岗位，支出工具款", "costPence": 60},
  {"id": "C18", "originId": "origin-labor-2", "professionId": "profession-junior-police-officer", "archetypeId": "recommendation-guarantee", "prerequisite": "曾经家庭服务圈的普通熟人推荐参加勤务试任，支付安置费", "costPence": 60},
  {"id": "C19", "originId": "origin-labor-2", "professionId": "profession-private-detective", "archetypeId": "relevant-history-trial", "prerequisite": "曾完成普通雇佣纠纷的调查助理试任，积蓄用于试任开销", "costPence": 60},
  {"id": "C20", "originId": "origin-labor-2", "professionId": "profession-bounty-hunter", "archetypeId": "gray-introduction-risk", "prerequisite": "曾经灰色联系人引荐获得普通委托机会，支付引荐支出", "costPence": 90},
  {"id": "C21", "originId": "origin-lower-middle-1", "professionId": "profession-factory-worker", "archetypeId": "family-class-compromise", "prerequisite": "曾离开家庭店面独立受雇，承担独立生活安置费", "costPence": 60},
  {"id": "C22", "originId": "origin-lower-middle-1", "professionId": "profession-dock-worker", "archetypeId": "relevant-history-trial", "prerequisite": "曾随店铺货运队完成码头试工，支付试工食宿", "costPence": 30},
  {"id": "C23", "originId": "origin-lower-middle-1", "professionId": "profession-estate-servant", "archetypeId": "recommendation-guarantee", "prerequisite": "曾由长期顾客介绍到宅邸服务，支付安置费用", "costPence": 30},
  {"id": "C24", "originId": "origin-lower-middle-1", "professionId": "profession-company-clerk", "archetypeId": "education-qualification", "prerequisite": "曾把店铺账目经验补为正式文书训练，支付课程费", "costPence": 60},
  {"id": "C25", "originId": "origin-lower-middle-1", "professionId": "profession-junior-police-officer", "archetypeId": "recommendation-guarantee", "prerequisite": "曾获街区熟人推荐进入勤务试任，承担安置费用", "costPence": 60},
  {"id": "C26", "originId": "origin-lower-middle-1", "professionId": "profession-company-accountant", "archetypeId": "education-qualification", "prerequisite": "曾完成超出家庭流水账的专业记账训练，支付培训费", "costPence": 120},
  {"id": "C27", "originId": "origin-lower-middle-1", "professionId": "profession-bounty-hunter", "archetypeId": "funds-tools", "prerequisite": "曾以个人资金准备独立委托工具，支出工具款", "costPence": 90},
  {"id": "C28", "originId": "origin-lower-middle-1", "professionId": "profession-gang-runner", "archetypeId": "gray-introduction-risk", "prerequisite": "曾经地下客户引荐承接跑腿，个人资金支付引荐开销", "costPence": 60},
  {"id": "C29", "originId": "origin-lower-middle-2", "professionId": "profession-factory-worker", "archetypeId": "family-class-compromise", "prerequisite": "曾放弃家庭安排的文职路线独立受雇，支出安置款", "costPence": 60},
  {"id": "C30", "originId": "origin-lower-middle-2", "professionId": "profession-dock-worker", "archetypeId": "family-class-compromise", "prerequisite": "曾离开家庭住处转做搬运，承担独立生活安置款", "costPence": 60},
  {"id": "C31", "originId": "origin-lower-middle-2", "professionId": "profession-estate-servant", "archetypeId": "recommendation-guarantee", "prerequisite": "曾由长辈同事介绍到宅邸，支付转入服务工作的安置费", "costPence": 30},
  {"id": "C32", "originId": "origin-lower-middle-2", "professionId": "profession-craft-apprentice", "archetypeId": "funds-tools", "prerequisite": "曾为改学手艺购买工具，开局积蓄承担工具款", "costPence": 60},
  {"id": "C33", "originId": "origin-lower-middle-2", "professionId": "profession-private-detective", "archetypeId": "relevant-history-trial", "prerequisite": "曾以文书基础完成调查助理试任，支付试任生活费", "costPence": 60},
  {"id": "C34", "originId": "origin-lower-middle-2", "professionId": "profession-bounty-hunter", "archetypeId": "gray-introduction-risk", "prerequisite": "曾通过灰色中间人接到普通委托，支付引荐费用", "costPence": 90},
  {"id": "C35", "originId": "origin-lower-middle-2", "professionId": "profession-gang-runner", "archetypeId": "gray-introduction-risk", "prerequisite": "曾离开机构圈经地下联系人获得差事，支付引荐费用", "costPence": 60},
  {"id": "C36", "originId": "origin-upper-middle-1", "professionId": "profession-estate-servant", "archetypeId": "family-class-compromise", "prerequisite": "曾拒绝家庭专业职业安排转入服务业，支出独立安置款", "costPence": 120},
  {"id": "C37", "originId": "origin-upper-middle-1", "professionId": "profession-craft-apprentice", "archetypeId": "funds-tools", "prerequisite": "曾另备一套手艺工具开始学徒生活，支付工具款", "costPence": 60},
  {"id": "C38", "originId": "origin-upper-middle-1", "professionId": "profession-shop-clerk", "archetypeId": "relevant-history-trial", "prerequisite": "曾独立完成零售岗位试工，承担试工期间生活费", "costPence": 30},
  {"id": "C39", "originId": "origin-upper-middle-2", "professionId": "profession-factory-worker", "archetypeId": "family-class-compromise", "prerequisite": "曾放弃家族经营安排转为普通受雇者，支付独立安置款", "costPence": 120},
  {"id": "C40", "originId": "origin-upper-middle-2", "professionId": "profession-dock-worker", "archetypeId": "relevant-history-trial", "prerequisite": "曾在家族商贸圈外完成搬运试工，支付试工生活费", "costPence": 60},
  {"id": "C41", "originId": "origin-upper-middle-2", "professionId": "profession-estate-servant", "archetypeId": "recommendation-guarantee", "prerequisite": "曾由商业往来中的熟人推荐服务岗位，支付安置费", "costPence": 60},
  {"id": "C42", "originId": "origin-upper-middle-2", "professionId": "profession-craft-apprentice", "archetypeId": "funds-tools", "prerequisite": "曾以个人资金购买学徒工具，不使用家族产业资产", "costPence": 60},
  {"id": "C43", "originId": "origin-upper-middle-2", "professionId": "profession-junior-police-officer", "archetypeId": "recommendation-guarantee", "prerequisite": "曾获非商业职位的勤务推荐，支付独立安置费", "costPence": 60},
  {"id": "C44", "originId": "origin-upper-middle-2", "professionId": "profession-private-detective", "archetypeId": "relevant-history-trial", "prerequisite": "曾在家族企业之外完成调查试任，承担试任开销", "costPence": 90},
  {"id": "C45", "originId": "origin-upper-middle-2", "professionId": "profession-lawyer", "archetypeId": "education-qualification", "prerequisite": "曾完成岗位所需专业教育与资格准备，家庭转交扣除对应支出", "costPence": 360},
  {"id": "C46", "originId": "origin-upper-1", "professionId": "profession-estate-servant", "archetypeId": "family-class-compromise", "prerequisite": "曾放下家名待遇以普通服务者身份谋生，支付独立安置款", "costPence": 240},
  {"id": "C47", "originId": "origin-upper-1", "professionId": "profession-shop-clerk", "archetypeId": "family-class-compromise", "prerequisite": "曾拒绝家族安排独立在店铺受雇，家庭转交扣出安置款", "costPence": 240},
  {"id": "C48", "originId": "origin-upper-1", "professionId": "profession-private-detective", "archetypeId": "relevant-history-trial", "prerequisite": "曾以本人而非家名完成普通调查试任，支付试任开销", "costPence": 120},
  {"id": "C49", "originId": "origin-upper-1", "professionId": "profession-company-accountant", "archetypeId": "education-qualification", "prerequisite": "曾补足实务会计训练而非只凭家族身份入职，支付培训费", "costPence": 120},
  {"id": "C50", "originId": "origin-upper-2", "professionId": "profession-factory-worker", "archetypeId": "family-class-compromise", "prerequisite": "曾离开家庭企业待遇成为普通工人，支付独立安置款", "costPence": 240},
  {"id": "C51", "originId": "origin-upper-2", "professionId": "profession-dock-worker", "archetypeId": "family-class-compromise", "prerequisite": "曾拒绝家族经营安排转做搬运，支付独立安置款", "costPence": 240},
  {"id": "C52", "originId": "origin-upper-2", "professionId": "profession-estate-servant", "archetypeId": "family-class-compromise", "prerequisite": "曾转入与家庭地位不同的服务岗位，支付独立安置款", "costPence": 240},
  {"id": "C53", "originId": "origin-upper-2", "professionId": "profession-craft-apprentice", "archetypeId": "funds-tools", "prerequisite": "曾用个人资金购置工具重新学手艺，支付工具款", "costPence": 120},
  {"id": "C54", "originId": "origin-upper-2", "professionId": "profession-junior-police-officer", "archetypeId": "relevant-history-trial", "prerequisite": "曾在家庭商业圈之外完成基层勤务试任，支付试任开销", "costPence": 120},
  {"id": "C55", "originId": "origin-upper-2", "professionId": "profession-private-detective", "archetypeId": "relevant-history-trial", "prerequisite": "曾独立完成调查委托试任，支付试任生活费", "costPence": 120},
];

const TRAITS: readonly SlicePersonalityOption[] = [
  {"id": "trait.diligent", "label": "勤勉", "summary": "勤勉，体魄+1；情境标签“肯做实事”不附额外数值或成本。", "coreStatModifiers": {"physique": 1, "perception": 0, "will": 0, "knowledge": 0}, "situationTag": "肯做实事", "incompatibleTraitIds": ["flaw.idle"]},
  {"id": "trait.disciplined", "label": "自律", "summary": "自律，体魄+1；情境标签“规律起居”不附额外数值或成本。", "coreStatModifiers": {"physique": 1, "perception": 0, "will": 0, "knowledge": 0}, "situationTag": "规律起居", "incompatibleTraitIds": ["flaw.indulgent"]},
  {"id": "trait.hardy", "label": "吃苦耐劳", "summary": "吃苦耐劳，体魄+1；情境标签“承担辛劳”不附额外数值或成本。", "coreStatModifiers": {"physique": 1, "perception": 0, "will": 0, "knowledge": 0}, "situationTag": "承担辛劳", "incompatibleTraitIds": []},
  {"id": "trait.attentive", "label": "细心", "summary": "细心，感知+1；情境标签“注意细节”不附额外数值或成本。", "coreStatModifiers": {"physique": 0, "perception": 1, "will": 0, "knowledge": 0}, "situationTag": "注意细节", "incompatibleTraitIds": ["flaw.careless"]},
  {"id": "trait.watchful", "label": "警觉", "summary": "警觉，感知+1；情境标签“留意异常”不附额外数值或成本。", "coreStatModifiers": {"physique": 0, "perception": 1, "will": 0, "knowledge": 0}, "situationTag": "留意异常", "incompatibleTraitIds": []},
  {"id": "trait.considerate", "label": "善察言色", "summary": "善察言色，感知+1；情境标签“留意言行”不附额外数值或成本。", "coreStatModifiers": {"physique": 0, "perception": 1, "will": 0, "knowledge": 0}, "situationTag": "留意言行", "incompatibleTraitIds": []},
  {"id": "trait.steadfast", "label": "坚毅", "summary": "坚毅，意志+1；情境标签“坚持承诺”不附额外数值或成本。", "coreStatModifiers": {"physique": 0, "perception": 0, "will": 1, "knowledge": 0}, "situationTag": "坚持承诺", "incompatibleTraitIds": ["flaw.timid"]},
  {"id": "trait.composed", "label": "沉着", "summary": "沉着，意志+1；情境标签“临危自持”不附额外数值或成本。", "coreStatModifiers": {"physique": 0, "perception": 0, "will": 1, "knowledge": 0}, "situationTag": "临危自持", "incompatibleTraitIds": ["flaw.impetuous"]},
  {"id": "trait.patient", "label": "耐心", "summary": "耐心，意志+1；情境标签“愿意等待”不附额外数值或成本。", "coreStatModifiers": {"physique": 0, "perception": 0, "will": 1, "knowledge": 0}, "situationTag": "愿意等待", "incompatibleTraitIds": ["flaw.impetuous"]},
  {"id": "trait.curious", "label": "好学", "summary": "好学，知识+1；情境标签“主动求证”不附额外数值或成本。", "coreStatModifiers": {"physique": 0, "perception": 0, "will": 0, "knowledge": 1}, "situationTag": "主动求证", "incompatibleTraitIds": ["flaw.closed"]},
  {"id": "trait.analytic", "label": "善于归纳", "summary": "善于归纳，知识+1；情境标签“整理依据”不附额外数值或成本。", "coreStatModifiers": {"physique": 0, "perception": 0, "will": 0, "knowledge": 1}, "situationTag": "整理依据", "incompatibleTraitIds": ["flaw.dogmatic"]},
  {"id": "trait.reflective", "label": "自省", "summary": "自省，知识+1；情境标签“反思经历”不附额外数值或成本。", "coreStatModifiers": {"physique": 0, "perception": 0, "will": 0, "knowledge": 1}, "situationTag": "反思经历", "incompatibleTraitIds": ["flaw.dogmatic"]},
];

const FLAWS: readonly SlicePersonalityOption[] = [
  {"id": "flaw.idle", "label": "怠惰", "summary": "怠惰，体魄-1；情境标签“回避辛劳”不强迫行动。", "coreStatModifiers": {"physique": -1, "perception": 0, "will": 0, "knowledge": 0}, "situationTag": "回避辛劳", "incompatibleTraitIds": ["trait.diligent"]},
  {"id": "flaw.indulgent", "label": "放纵", "summary": "放纵，体魄-1；情境标签“起居无度”不强迫行动。", "coreStatModifiers": {"physique": -1, "perception": 0, "will": 0, "knowledge": 0}, "situationTag": "起居无度", "incompatibleTraitIds": ["trait.disciplined"]},
  {"id": "flaw.careless", "label": "粗心", "summary": "粗心，感知-1；情境标签“疏漏细节”不强迫行动。", "coreStatModifiers": {"physique": 0, "perception": -1, "will": 0, "knowledge": 0}, "situationTag": "疏漏细节", "incompatibleTraitIds": ["trait.attentive"]},
  {"id": "flaw.absent", "label": "心不在焉", "summary": "心不在焉，感知-1；情境标签“容易分神”不强迫行动。", "coreStatModifiers": {"physique": 0, "perception": -1, "will": 0, "knowledge": 0}, "situationTag": "容易分神", "incompatibleTraitIds": []},
  {"id": "flaw.timid", "label": "畏缩", "summary": "畏缩，意志-1；情境标签“畏惧冲突”不强迫行动。", "coreStatModifiers": {"physique": 0, "perception": 0, "will": -1, "knowledge": 0}, "situationTag": "畏惧冲突", "incompatibleTraitIds": ["trait.steadfast"]},
  {"id": "flaw.impetuous", "label": "急躁", "summary": "急躁，意志-1；情境标签“急于行动”不强迫行动。", "coreStatModifiers": {"physique": 0, "perception": 0, "will": -1, "knowledge": 0}, "situationTag": "急于行动", "incompatibleTraitIds": ["trait.composed", "trait.patient"]},
  {"id": "flaw.closed", "label": "排斥新知", "summary": "排斥新知，知识-1；情境标签“抗拒新解释”不强迫行动。", "coreStatModifiers": {"physique": 0, "perception": 0, "will": 0, "knowledge": -1}, "situationTag": "抗拒新解释", "incompatibleTraitIds": ["trait.curious"]},
  {"id": "flaw.dogmatic", "label": "武断", "summary": "武断，知识-1；情境标签“仓促定论”不强迫行动。", "coreStatModifiers": {"physique": 0, "perception": 0, "will": 0, "knowledge": -1}, "situationTag": "仓促定论", "incompatibleTraitIds": ["trait.analytic", "trait.reflective"]},
];

const ORIGINS: readonly SliceOriginOption[] = R2_FIXTURE_CATALOGUE.origins.map(({ opening: _legacyOpening, ...origin }) => {
  const profile = ORIGIN_PROFILES.find((candidate) => candidate.originId === origin.id);
  if (profile === undefined) throw new Error(`Missing slice origin profile: ${origin.id}`);
  const education = EDUCATIONS.find((candidate) => candidate.id === profile.defaultEducation)!;
  return {
    ...origin,
    originCode: profile.originCode,
    opening: {
      coreStatModifiers: { ...profile.coreStatModifiers },
      defaultEducation: profile.defaultEducation,
      educationLabel: education.label,
      openingKnowledgeBonus: education.openingKnowledgeBonus,
      familyEconomyLabel: profile.familyEconomyLabel,
      status: "BALANCE_REVIEW_CANDIDATE",
      familyTransferPence: profile.familyTransferPence,
      initialDebtPence: profile.initialDebtPence,
      debtWeeklyRepaymentPence: profile.debtWeeklyRepaymentPence,
      defaultLivingStandardId: profile.defaultLivingStandardId,
      ...(profile.alternativeEducation === undefined ? {} : { alternativeEducation: { ...profile.alternativeEducation } }),
      supportLabel: profile.supportLabel,
      obligationLabel: profile.obligationLabel,
      originOpeningId: `ORIGIN-${profile.originCode}-START`,
      eventHooks: [...profile.eventHooks],
    },
  };
});
const PROFESSIONS: readonly SliceProfessionOption[] = R2_FIXTURE_CATALOGUE.professions.map(({ opening: _legacyOpening, ...profession }) => {
  const profile = PROFESSION_PROFILES.find((candidate) => candidate.professionId === profession.id);
  if (profile === undefined) throw new Error(`Missing slice profession profile: ${profession.id}`);
  return {
    ...profession,
    incomeTier: profile.incomeTier,
    auditStatus: ["profession-craft-apprentice", "profession-shop-clerk", "profession-gang-runner"].includes(profession.id) ? "GAME_ADAPTATION" : "APPROVED_ROSTER",
    opening: { coreStatModifiers: { ...profile.coreStatModifiers }, initialCashPence: profile.initialCashPence, weeklyWorkPayPence: profile.weeklyWorkPayPence, status: "BALANCE_REVIEW_CANDIDATE" },
  };
});
const COMPATIBILITY: readonly SliceCompatibilityRule[] = R2_COMPATIBILITY_MATRIX.map((rule) => {
  const condition = CONDITIONS.find((entry) => entry.originId === rule.originId && entry.professionId === rule.professionId);
  if (rule.status === "CONDITIONAL") {
    if (condition === undefined) throw new Error(`Missing slice condition: ${rule.originId}/${rule.professionId}`);
    return {
      ...rule,
      publicReason: condition.prerequisite,
      conditionId: condition.id,
      conditionCostSummary: `消耗开局资金${condition.costPence}便士；拒绝则返回其它职业。`,
      archetypeId: condition.archetypeId,
      prerequisite: condition.prerequisite,
      costPence: condition.costPence,
    };
  }
  if (condition !== undefined) throw new Error(`Unexpected slice condition: ${rule.originId}/${rule.professionId}`);
  return { ...rule, publicReason: rule.status === "DIRECT" ? "这段经历与当前职业可以直接衔接，无额外职业前置费用。" : "这段经历与当前职业不相容，不能用付钱改变职业可达性。" };
});
const PORTRAITS: readonly PublicPortraitOption[] = Array.from({ length: 8 }, (_, index) => ({
  id: `portrait-${String(index + 1).padStart(2, "0")}`,
  label: `肖像${index + 1}`,
  summary: "原创预设肖像，仅改变外观，不绑定身份、年龄或属性。",
  appearanceTags: [],
}));
export const sliceCreationCatalogue: SliceCreationCatalogue = {
  contentVersion: SLICE_CREATION_CONTENT_VERSION,
  status: "BALANCE_REVIEW_CANDIDATE",
  notice: "本次试玩采用已确认的创建候选；工资、资格和数值仍待真实游玩调整。",
  birthplaces: R2_FIXTURE_CATALOGUE.birthplaces.map((option) => ({ ...option })),
  portraits: PORTRAITS,
  origins: ORIGINS,
  professions: PROFESSIONS,
  traits: TRAITS,
  flaws: FLAWS,
  compatibility: COMPATIBILITY,
  conditions: CONDITIONS,
  educations: EDUCATIONS,
  livingStandards: LIVING_STANDARDS,
  conditionArchetypes: PUBLIC_CONDITION_ARCHETYPES,
};

export const sliceDefaultCreationSelection: SliceCreationSelection = {
  displayName: "艾达",
  sex: "FEMALE",
  age: 26,
  birthplaceId: "birthplace-backlund",
  appearanceDescription: "",
  portraitId: "portrait-01",
  originId: "origin-labor-1",
  professionId: "profession-factory-worker",
  traitIds: ["trait.diligent", "trait.watchful"],
  flawId: "flaw.timid",
  acceptedConditionIds: [],
  educationLevel: "BASIC",
  livingStandardId: "POOR",
};

export interface SliceStatSource {
  readonly id: string;
  readonly label: string;
  readonly modifiers: PublicCoreStats;
}
export interface SliceCashBreakdown {
  readonly professionInitialPence: number;
  readonly familyTransferPence: number;
  readonly conditionCostPence: number;
  readonly educationCostPence: number;
  readonly totalPence: number;
}
export interface SliceCreationPreview {
  readonly coreStats: PublicCoreStats;
  readonly statSources: readonly SliceStatSource[];
  readonly cashBreakdown: SliceCashBreakdown;
  readonly educationLevel: PublicEducationLevel;
  readonly weeklyWorkPayPence: number;
  readonly initialDebtPence: number;
  readonly debtWeeklyRepaymentPence: number;
  readonly learningKnowledgeBonus: number;
  readonly livingStandardId: SliceLivingStandardId;
}
export interface SliceKnownEntryClue extends PublicChoiceOption {}
export interface SliceCreationComputation extends SliceCreationPreview {
  readonly selection: SliceCreationSelection;
  readonly character: PublicCharacterProjection;
  readonly cashPence: number;
  readonly originOpeningId: string;
  readonly knownEntryClues: readonly SliceKnownEntryClue[];
  readonly initialAvailableActions: 3;
}
const KNOWN_ENTRY_CLUES: readonly SliceKnownEntryClue[] = [
  { id: "LIFE-LEAD-NIGHTSHIFT", label: "街区夜班工钱告示", summary: "住所附近的一张公开招工告示，可以调查核对。" },
  { id: "CARE-ACCESS-01", label: "普通诊疗告示", summary: "住所公开告示提供普通诊疗点线索，须调查核实。" },
];

function findById<T extends { readonly id: string }>(options: readonly T[], id: unknown): T | undefined {
  return options.find((option) => option.id === id);
}
function addStats(sources: readonly SliceStatSource[]): PublicCoreStats {
  return sources.reduce<PublicCoreStats>((total, source) => ({
    physique: total.physique + source.modifiers.physique,
    perception: total.perception + source.modifiers.perception,
    will: total.will + source.modifiers.will,
    knowledge: total.knowledge + source.modifiers.knowledge,
  }), { ...ZERO_STATS });
}
/** Read-only preview. Selected costs appear before acceptance, but are paid only on creation. */
export function previewSliceCreation(selection: Partial<SliceCreationSelection>): SliceCreationPreview {
  const origin = findById(ORIGINS, selection.originId);
  const profession = findById(PROFESSIONS, selection.professionId);
  const rule = COMPATIBILITY.find((entry) => entry.originId === origin?.id && entry.professionId === profession?.id);
  const alternative = origin?.opening.alternativeEducation;
  const requestedEducation = findById(EDUCATIONS, selection.educationLevel);
  const education = requestedEducation !== undefined && (origin === undefined || requestedEducation.id === origin.opening.defaultEducation || requestedEducation.id === alternative?.level)
    ? requestedEducation
    : findById(EDUCATIONS, origin?.opening.defaultEducation ?? "NONE_FORMAL")!;
  const selectedTraits = Array.isArray(selection.traitIds) ? [...new Set(selection.traitIds)].map((id) => findById(TRAITS, id)).filter((entry): entry is SlicePersonalityOption => entry !== undefined) : [];
  const flaw = findById(FLAWS, selection.flawId);
  const statSources: SliceStatSource[] = [{ id: "base", label: "统一基线", modifiers: { ...BASE_STATS } }];
  if (origin !== undefined) statSources.push({ id: origin.id, label: origin.label, modifiers: { ...origin.opening.coreStatModifiers } });
  if (profession !== undefined) statSources.push({ id: profession.id, label: profession.label, modifiers: { ...profession.opening.coreStatModifiers } });
  statSources.push({ id: education.id, label: education.label, modifiers: { ...ZERO_STATS, knowledge: education.openingKnowledgeBonus } });
  for (const trait of selectedTraits) statSources.push({ id: trait.id, label: trait.label, modifiers: { ...trait.coreStatModifiers } });
  if (flaw !== undefined) statSources.push({ id: flaw.id, label: flaw.label, modifiers: { ...flaw.coreStatModifiers } });
  const professionInitialPence = profession?.opening.initialCashPence ?? 0;
  const familyTransferPence = origin?.opening.familyTransferPence ?? 0;
  const conditionCostPence = rule?.status === "CONDITIONAL" ? rule.costPence ?? 0 : 0;
  const educationCostPence = alternative?.level === education.id ? alternative.costPence : 0;
  return {
    coreStats: addStats(statSources),
    statSources,
    cashBreakdown: { professionInitialPence, familyTransferPence, conditionCostPence, educationCostPence, totalPence: professionInitialPence + familyTransferPence - conditionCostPence - educationCostPence },
    educationLevel: education.id,
    weeklyWorkPayPence: profession?.opening.weeklyWorkPayPence ?? 0,
    initialDebtPence: origin?.opening.initialDebtPence ?? 0,
    debtWeeklyRepaymentPence: origin?.opening.debtWeeklyRepaymentPence ?? 0,
    learningKnowledgeBonus: education.learningKnowledgeBonus,
    livingStandardId: findById(LIVING_STANDARDS, selection.livingStandardId)?.id ?? origin?.opening.defaultLivingStandardId ?? "DESTITUTE",
  };
}

export type SliceCreationValidationResult =
  | { readonly ok: true; readonly value: SliceCreationSelection }
  | { readonly ok: false; readonly errors: readonly string[] };
const REQUIRED_SELECTION_KEYS = ["displayName", "sex", "age", "birthplaceId", "appearanceDescription", "portraitId", "originId", "professionId", "traitIds", "flawId", "acceptedConditionIds", "educationLevel", "livingStandardId"] as const;
function isSafeText(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= maxLength && (allowEmpty || value.trim().length > 0) && !/[\u0000-\u001f\u007f]/u.test(value);
}
function isUniqueStringArray(value: unknown, count: number, exact = false): value is readonly string[] {
  return Array.isArray(value) && (exact ? value.length === count : value.length <= count) && value.every((id) => isSafeText(id, 128)) && new Set(value).size === value.length;
}
/** Validation remains authoritative even if a renderer offers an invalid selection. */
export function validateSliceCreation(selection: unknown): SliceCreationValidationResult {
  if (typeof selection !== "object" || selection === null || Array.isArray(selection) || ![Object.prototype, null].includes(Object.getPrototypeOf(selection) as object | null)) return { ok: false, errors: ["角色选择格式无效。"] };
  const value = selection as Record<string, unknown>;
  const errors: string[] = [];
  if (REQUIRED_SELECTION_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) || Object.keys(value).some((key) => ![...REQUIRED_SELECTION_KEYS, "specializationId"].includes(key as (typeof REQUIRED_SELECTION_KEYS)[number] | "specializationId"))) errors.push("角色选择包含缺失或未支持的字段。");
  if (!isSafeText(value.displayName, 80)) errors.push("姓名需为1—80个字符。");
  if (value.sex !== "FEMALE" && value.sex !== "MALE") errors.push("请选择有效性别。");
  if (!Number.isInteger(value.age) || (value.age as number) < 18 || (value.age as number) > 45) errors.push("年龄需为18—45岁的整数。");
  if (!isSafeText(value.appearanceDescription, 240, true)) errors.push("外貌补充需为至多240个字符的短文本。");
  if (!findById(sliceCreationCatalogue.birthplaces, value.birthplaceId)) errors.push("请选择有效出生地。");
  if (!findById(PORTRAITS, value.portraitId)) errors.push("请选择8款预设肖像之一。");
  const origin = findById(ORIGINS, value.originId);
  const profession = findById(PROFESSIONS, value.professionId);
  if (origin === undefined) errors.push("请选择有效出身。");
  if (profession === undefined) errors.push("请选择有效职业。");
  if (Object.prototype.hasOwnProperty.call(value, "specializationId") && value.specializationId !== "" && value.specializationId !== "legacy-none") errors.push("首版不选择普通技能或自由专精。");
  const traitsValid = isUniqueStringArray(value.traitIds, 2, true);
  if (!traitsValid) errors.push("恰好选择2个互不重复的性格特质。");
  const selectedTraitIds = isUniqueStringArray(value.traitIds, 2, true) ? value.traitIds : [];
  const traits = selectedTraitIds.map((id) => findById(TRAITS, id));
  if (traits.some((trait) => trait === undefined)) errors.push("性格特质不存在。");
  const flaw = findById(FLAWS, value.flawId);
  if (flaw === undefined) errors.push("请选择1个真实缺陷。");
  for (const trait of traits) {
    if (trait !== undefined && flaw !== undefined && trait.incompatibleTraitIds.includes(flaw.id)) errors.push(`${trait.label}与${flaw.label}不能同时选择。`);
  }
  if (!findById(EDUCATIONS, value.educationLevel) || (origin !== undefined && value.educationLevel !== origin.opening.defaultEducation && value.educationLevel !== origin.opening.alternativeEducation?.level)) errors.push("学历只能选出身默认档或该出身的一个条件替代档。");
  if (!findById(LIVING_STANDARDS, value.livingStandardId)) errors.push("请选择有效生活档位。");
  const acceptedValid = isUniqueStringArray(value.acceptedConditionIds, 1);
  if (!acceptedValid) errors.push("职业前置只能接受当前组合的一项条件，不能重复。");
  const acceptedConditionIds = isUniqueStringArray(value.acceptedConditionIds, 1) ? value.acceptedConditionIds : [];
  const rule = COMPATIBILITY.find((entry) => entry.originId === origin?.id && entry.professionId === profession?.id);
  if (origin !== undefined && profession !== undefined) {
    if (rule === undefined || rule.status === "FORBIDDEN") errors.push("该出身不能选择此职业，付钱也不能解锁。");
    else if (acceptedValid && rule.status === "DIRECT" && acceptedConditionIds.length !== 0) errors.push("直达职业不需要额外条件或费用。");
    else if (acceptedValid && rule.status === "CONDITIONAL" && (acceptedConditionIds.length !== 1 || acceptedConditionIds[0] !== rule.conditionId)) errors.push("需接受当前职业的明确前史及一次性现金代价。");
  }
  if (errors.length !== 0) return { ok: false, errors };
  const canonical: SliceCreationSelection = {
    displayName: (value.displayName as string).trim(), sex: value.sex as SliceCreationSelection["sex"], age: value.age as number,
    birthplaceId: value.birthplaceId as string, appearanceDescription: (value.appearanceDescription as string).trim(), portraitId: value.portraitId as string,
    originId: origin!.id, professionId: profession!.id, traitIds: [...value.traitIds as readonly string[]], flawId: flaw!.id,
    acceptedConditionIds: [...value.acceptedConditionIds as readonly string[]], educationLevel: value.educationLevel as PublicEducationLevel, livingStandardId: value.livingStandardId as SliceLivingStandardId,
  };
  if (previewSliceCreation(canonical).cashBreakdown.totalPence < 0) return { ok: false, errors: ["开局资金不足以承担已选职业和学历前置费用，请返回修改选择；不会自动借款补足。"] };
  return { ok: true, value: canonical };
}

/** Preview and final creation share one pure calculation; repeated calls never pay twice. */
export function computeSliceCreation(selection: SliceCreationSelection): SliceCreationComputation {
  const result = validateSliceCreation(selection);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const valid = result.value;
  const preview = previewSliceCreation(valid);
  const origin = findById(ORIGINS, valid.originId)!;
  const profession = findById(PROFESSIONS, valid.professionId)!;
  const birthplace = findById(sliceCreationCatalogue.birthplaces, valid.birthplaceId)!;
  const portrait = findById(PORTRAITS, valid.portraitId)!;
  const flaw = findById(FLAWS, valid.flawId)!;
  return {
    ...preview,
    selection: valid,
    cashPence: preview.cashBreakdown.totalPence,
    initialAvailableActions: 3,
    originOpeningId: origin.opening.originOpeningId,
    knownEntryClues: KNOWN_ENTRY_CLUES.map((clue) => ({ ...clue })),
    character: {
      displayName: valid.displayName, sex: valid.sex, age: valid.age, originCountry: "LOEN",
      birthplace: { id: birthplace.id, label: birthplace.label }, appearanceDescription: valid.appearanceDescription,
      portrait: { id: portrait.id, label: portrait.label, appearanceTags: [...portrait.appearanceTags] },
      origin: { id: origin.id, label: origin.label, tier: origin.tier },
      profession: { id: profession.id, label: profession.label, legality: profession.legality },
      traits: valid.traitIds.map((id) => { const trait = findById(TRAITS, id)!; return { id: trait.id, label: trait.label }; }),
      flaw: { id: flaw.id, label: flaw.label }, sequence: "ORDINARY", coreStats: { ...preview.coreStats },
      resources: { health: { current: 100, max: 100 }, mind: { current: 100, max: 100 }, spirituality: { current: 15, max: 15 }, pollution: 0 },
    },
  };
}
