import {
  BROWSER_ALPHA_CONTRACT_VERSION,
  CONTENT_VERSION,
  PUBLIC_CONDITION_ARCHETYPES,
  PUBLIC_EDUCATION_LEVELS,
  type CharacterCreationSelection,
  type PublicCharacterCreationCatalogue,
  type PublicCompatibilityRule,
  type PublicCoreStats,
  type PublicOriginOption,
  type PublicProfessionOption,
  type PublicTraitOption,
  type PublicConditionArchetypeId,
  type PublicEducationLevel,
} from "../shared/contracts.js";

// BA1 keeps the shared R2 specialization fields only as a wire-compatibility
// concern. The public browser catalogue deliberately has no ordinary skill
// or free-specialization entries.
export const LEGACY_NO_SPECIALIZATION_ID = "legacy-none" as const;
export const LEGACY_NO_SPECIALIZATION = {
  id: LEGACY_NO_SPECIALIZATION_ID,
  label: "无独立专长",
} as const;

export const BROWSER_ALPHA_EDUCATION_LEVELS = PUBLIC_EDUCATION_LEVELS;
export const R2_EDUCATION_LEVELS = BROWSER_ALPHA_EDUCATION_LEVELS;
export type R2EducationLevel = PublicEducationLevel;

/**
 * Education remains a four-level data shape in BA1. Per-origin levels and
 * alternatives are intentionally absent until their balance review is locked.
 */
export interface R2OriginEducationProfile {
  readonly originId: string;
  readonly defaultLevel?: PublicEducationLevel;
  readonly conditionalAlternative?: PublicEducationLevel;
  readonly status: "BALANCE_REVIEW_CANDIDATE";
}

export const BROWSER_ALPHA_CONDITION_ARCHETYPES = PUBLIC_CONDITION_ARCHETYPES;
export const R2_CONDITION_ARCHETYPES = BROWSER_ALPHA_CONDITION_ARCHETYPES;
export type R2ConditionArchetypeId = PublicConditionArchetypeId;

/** No conditional pair mapping or cost is asserted in BA1. */
export interface R2ConditionRequirementCandidate {
  readonly originId: string;
  readonly professionId: string;
  readonly archetypeId?: PublicConditionArchetypeId;
  readonly costSummary?: string;
  readonly status: "CONTENT_PENDING";
}

export const R2_CONDITION_REQUIREMENT_CANDIDATES: readonly R2ConditionRequirementCandidate[] = [];

const BIRTHPLACES = [
  { id: "birthplace-backlund", label: "贝克兰德", summary: "鲁恩王国的首都。" },
  { id: "birthplace-tingen", label: "廷根市", summary: "阿霍瓦郡的大学城。" },
  { id: "birthplace-constant", label: "康斯顿市", summary: "间海郡的煤钢工业首府。" },
  { id: "birthplace-pritz-port", label: "普利兹港", summary: "鲁恩王国的重要港口。" },
] as const;

const PORTRAITS = [
  {
    id: "portrait-plain-1",
    label: "短发的面容",
    summary: "短发、朴素衣着的外观描述；最终肖像素材尚未批准。",
    appearanceTags: ["短发", "朴素衣着"],
  },
  {
    id: "portrait-plain-2",
    label: "侧分的面容",
    summary: "侧分发式、朴素衣着的外观描述；最终肖像素材尚未批准。",
    appearanceTags: ["侧分发式", "朴素衣着"],
  },
  {
    id: "portrait-plain-3",
    label: "围巾的面容",
    summary: "围巾、朴素衣着的外观描述；最终肖像素材尚未批准。",
    appearanceTags: ["围巾", "朴素衣着"],
  },
] as const;

const ORIGINS: readonly Omit<PublicOriginOption, "opening">[] = [
  {
    id: "origin-poor-1",
    label: "无依街巷长大",
    summary: "在没有固定依靠的街巷环境中长大。",
    tier: "POOR",
  },
  {
    id: "origin-poor-2",
    label: "负债失业家庭",
    summary: "家庭背负债务且主要劳动力失业。",
    tier: "POOR",
  },
  {
    id: "origin-labor-1",
    label: "工厂工资家庭",
    summary: "来自依靠工厂工资维持日常生活的家庭。",
    tier: "LABOR",
  },
  {
    id: "origin-labor-2",
    label: "雇主依附的服务家庭",
    summary: "来自依附雇主安排、以服务工作维生的家庭。",
    tier: "LABOR",
  },
  {
    id: "origin-lower-middle-1",
    label: "自营小店/小作坊家庭",
    summary: "来自经营自营小店或小作坊的家庭。",
    tier: "LOWER_MIDDLE",
  },
  {
    id: "origin-lower-middle-2",
    label: "受教育的基层职员家庭",
    summary: "来自受过教育、从事基层职员工作的家庭。",
    tier: "LOWER_MIDDLE",
  },
  {
    id: "origin-upper-middle-1",
    label: "高等教育专业人士家庭",
    summary: "来自接受高等教育并从事专业工作的家庭。",
    tier: "UPPER_MIDDLE",
  },
  {
    id: "origin-upper-middle-2",
    label: "中型商贸/产业经营家庭",
    summary: "来自经营中型商贸或产业的家庭。",
    tier: "UPPER_MIDDLE",
  },
  {
    id: "origin-upper-1",
    label: "贵族家系",
    summary: "来自拥有贵族家系身份的家庭。",
    tier: "UPPER",
  },
  {
    id: "origin-upper-2",
    label: "获社会承认的实业/金融精英家庭",
    summary: "来自在实业或金融领域获得社会承认的家庭。",
    tier: "UPPER",
  },
];


const PROFESSIONS: readonly Omit<PublicProfessionOption, "opening">[] = [
  {
    id: "profession-factory-worker",
    label: "工厂工人",
    summary: "在工厂承担日常生产工作。",
    legality: "LEGAL",
  },
  {
    id: "profession-dock-worker",
    label: "码头工人",
    summary: "在港口承担装卸与搬运工作。",
    legality: "LEGAL",
  },
  {
    id: "profession-estate-servant",
    label: "宅邸仆役",
    summary: "在宅邸中负责日常服务工作。",
    legality: "LEGAL",
  },
  {
    id: "profession-craft-apprentice",
    label: "手工业学徒",
    summary: "在作坊中学习并承担手工业杂务。",
    legality: "LEGAL",
  },
  {
    id: "profession-shop-clerk",
    label: "商店店员",
    summary: "在商店负责接待、整理与售卖。",
    legality: "LEGAL",
  },
  {
    id: "profession-company-clerk",
    label: "公司文员",
    summary: "在公司处理日常文书与联络事务。",
    legality: "LEGAL",
  },
  {
    id: "profession-junior-police-officer",
    label: "基层警员",
    summary: "在基层岗位执行秩序维护与巡查。",
    legality: "LEGAL",
  },
  {
    id: "profession-private-detective",
    label: "私家侦探",
    summary: "受托查访普通纠纷与失物线索。",
    legality: "LEGAL",
  },
  {
    id: "profession-company-accountant",
    label: "公司会计",
    summary: "在公司负责账目记录与核对。",
    legality: "LEGAL",
  },
  {
    id: "profession-lawyer",
    label: "律师",
    summary: "为委托人处理法律文书与诉务。",
    legality: "LEGAL",
  },
  {
    id: "profession-bounty-hunter",
    label: "赏金猎人",
    summary: "接受委托追查目标并领取报酬。",
    legality: "GRAY",
  },
  {
    id: "profession-gang-runner",
    label: "帮派跑腿",
    summary: "替地下团体传递消息与物件。",
    legality: "ILLEGAL",
  },
];

export interface R2OriginOpeningCandidate {
  readonly originId: string;
  readonly coreStatModifiers: PublicCoreStats;
  readonly defaultEducation: PublicEducationLevel;
  readonly educationLabel: string;
  readonly openingKnowledgeBonus: number;
  readonly familyEconomyLabel: string;
  readonly status: "BALANCE_REVIEW_CANDIDATE";
}

export interface R2ProfessionOpeningCandidate {
  readonly professionId: string;
  readonly coreStatModifiers: PublicCoreStats;
  readonly initialCashPence: number;
  readonly weeklyWorkPayPence: number;
  readonly status: "BALANCE_REVIEW_CANDIDATE";
}

export const R2_ORIGIN_OPENING_CANDIDATES: readonly R2OriginOpeningCandidate[] = [
  { originId: "origin-poor-1", coreStatModifiers: { physique: 0, perception: 2, will: 1, knowledge: -1 }, defaultEducation: "NONE_FORMAL", educationLabel: "无正式学历", openingKnowledgeBonus: 0, familyEconomyLabel: "无稳定家庭资产", status: "BALANCE_REVIEW_CANDIDATE" },
  { originId: "origin-poor-2", coreStatModifiers: { physique: 1, perception: 0, will: 2, knowledge: -1 }, defaultEducation: "BASIC", educationLabel: "基础教育", openingKnowledgeBonus: 1, familyEconomyLabel: "负债且缺少稳定收入", status: "BALANCE_REVIEW_CANDIDATE" },
  { originId: "origin-labor-1", coreStatModifiers: { physique: 2, perception: 0, will: 1, knowledge: -1 }, defaultEducation: "BASIC", educationLabel: "基础教育", openingKnowledgeBonus: 1, familyEconomyLabel: "依靠固定工资", status: "BALANCE_REVIEW_CANDIDATE" },
  { originId: "origin-labor-2", coreStatModifiers: { physique: -1, perception: 2, will: 0, knowledge: 1 }, defaultEducation: "BASIC", educationLabel: "基础教育", openingKnowledgeBonus: 1, familyEconomyLabel: "依附雇主供给", status: "BALANCE_REVIEW_CANDIDATE" },
  { originId: "origin-lower-middle-1", coreStatModifiers: { physique: 0, perception: 1, will: -1, knowledge: 2 }, defaultEducation: "SECONDARY_VOCATIONAL", educationLabel: "中等/职业教育", openingKnowledgeBonus: 2, familyEconomyLabel: "拥有少量经营资产", status: "BALANCE_REVIEW_CANDIDATE" },
  { originId: "origin-lower-middle-2", coreStatModifiers: { physique: -1, perception: 0, will: 1, knowledge: 2 }, defaultEducation: "SECONDARY_VOCATIONAL", educationLabel: "中等/职业教育", openingKnowledgeBonus: 2, familyEconomyLabel: "固定薪资与基础教育投入", status: "BALANCE_REVIEW_CANDIDATE" },
  { originId: "origin-upper-middle-1", coreStatModifiers: { physique: -1, perception: 1, will: 0, knowledge: 2 }, defaultEducation: "HIGHER", educationLabel: "高等教育", openingKnowledgeBonus: 3, familyEconomyLabel: "稳定专业收入与教育资源", status: "BALANCE_REVIEW_CANDIDATE" },
  { originId: "origin-upper-middle-2", coreStatModifiers: { physique: 0, perception: -1, will: 2, knowledge: 1 }, defaultEducation: "SECONDARY_VOCATIONAL", educationLabel: "中等/职业教育", openingKnowledgeBonus: 2, familyEconomyLabel: "中型经营资产与流动资金", status: "BALANCE_REVIEW_CANDIDATE" },
  { originId: "origin-upper-1", coreStatModifiers: { physique: -1, perception: 0, will: 2, knowledge: 1 }, defaultEducation: "HIGHER", educationLabel: "高等教育", openingKnowledgeBonus: 3, familyEconomyLabel: "家族资产与社会关系", status: "BALANCE_REVIEW_CANDIDATE" },
  { originId: "origin-upper-2", coreStatModifiers: { physique: 0, perception: -1, will: 1, knowledge: 2 }, defaultEducation: "HIGHER", educationLabel: "高等教育", openingKnowledgeBonus: 3, familyEconomyLabel: "较强产业或金融资产", status: "BALANCE_REVIEW_CANDIDATE" },
];

export const R2_PROFESSION_OPENING_CANDIDATES: readonly R2ProfessionOpeningCandidate[] = [
  { professionId: "profession-factory-worker", coreStatModifiers: { physique: 2, perception: 0, will: 1, knowledge: 0 }, initialCashPence: 120, weeklyWorkPayPence: 72, status: "BALANCE_REVIEW_CANDIDATE" },
  { professionId: "profession-dock-worker", coreStatModifiers: { physique: 2, perception: 1, will: 0, knowledge: 0 }, initialCashPence: 96, weeklyWorkPayPence: 84, status: "BALANCE_REVIEW_CANDIDATE" },
  { professionId: "profession-estate-servant", coreStatModifiers: { physique: 0, perception: 2, will: 1, knowledge: 0 }, initialCashPence: 144, weeklyWorkPayPence: 72, status: "BALANCE_REVIEW_CANDIDATE" },
  { professionId: "profession-craft-apprentice", coreStatModifiers: { physique: 1, perception: 0, will: 0, knowledge: 2 }, initialCashPence: 72, weeklyWorkPayPence: 60, status: "BALANCE_REVIEW_CANDIDATE" },
  { professionId: "profession-shop-clerk", coreStatModifiers: { physique: 0, perception: 2, will: 0, knowledge: 1 }, initialCashPence: 144, weeklyWorkPayPence: 72, status: "BALANCE_REVIEW_CANDIDATE" },
  { professionId: "profession-company-clerk", coreStatModifiers: { physique: 0, perception: 0, will: 1, knowledge: 2 }, initialCashPence: 240, weeklyWorkPayPence: 120, status: "BALANCE_REVIEW_CANDIDATE" },
  { professionId: "profession-junior-police-officer", coreStatModifiers: { physique: 2, perception: 1, will: 0, knowledge: 0 }, initialCashPence: 240, weeklyWorkPayPence: 132, status: "BALANCE_REVIEW_CANDIDATE" },
  { professionId: "profession-private-detective", coreStatModifiers: { physique: 0, perception: 2, will: 0, knowledge: 1 }, initialCashPence: 360, weeklyWorkPayPence: 180, status: "BALANCE_REVIEW_CANDIDATE" },
  { professionId: "profession-company-accountant", coreStatModifiers: { physique: 0, perception: 0, will: 1, knowledge: 2 }, initialCashPence: 480, weeklyWorkPayPence: 180, status: "BALANCE_REVIEW_CANDIDATE" },
  { professionId: "profession-lawyer", coreStatModifiers: { physique: 0, perception: 0, will: 1, knowledge: 2 }, initialCashPence: 720, weeklyWorkPayPence: 240, status: "BALANCE_REVIEW_CANDIDATE" },
  { professionId: "profession-bounty-hunter", coreStatModifiers: { physique: 1, perception: 2, will: 0, knowledge: 0 }, initialCashPence: 120, weeklyWorkPayPence: 192, status: "BALANCE_REVIEW_CANDIDATE" },
  { professionId: "profession-gang-runner", coreStatModifiers: { physique: 0, perception: 2, will: 1, knowledge: 0 }, initialCashPence: 96, weeklyWorkPayPence: 84, status: "BALANCE_REVIEW_CANDIDATE" },
];

const PLAYER_ORIGINS: readonly PublicOriginOption[] = ORIGINS.map((origin) => {
  const opening = R2_ORIGIN_OPENING_CANDIDATES.find((candidate) => candidate.originId === origin.id);
  if (opening === undefined) throw new Error("Origin opening projection is missing");
  return {
    ...origin,
    opening: {
      coreStatModifiers: { ...opening.coreStatModifiers },
      defaultEducation: opening.defaultEducation,
      educationLabel: opening.educationLabel,
      openingKnowledgeBonus: opening.openingKnowledgeBonus,
      familyEconomyLabel: opening.familyEconomyLabel,
      status: opening.status,
    },
  };
});

const PLAYER_PROFESSIONS: readonly PublicProfessionOption[] = PROFESSIONS.map((profession) => {
  const opening = R2_PROFESSION_OPENING_CANDIDATES.find((candidate) => candidate.professionId === profession.id);
  if (opening === undefined) throw new Error("Profession opening projection is missing");
  return {
    ...profession,
    opening: {
      coreStatModifiers: { ...opening.coreStatModifiers },
      initialCashPence: opening.initialCashPence,
      weeklyWorkPayPence: opening.weeklyWorkPayPence,
      status: opening.status,
    },
  };
});
/** Default levels are replaceable balance candidates; alternatives remain undesigned. */
export const R2_ORIGIN_EDUCATION_PROFILES: readonly R2OriginEducationProfile[] = R2_ORIGIN_OPENING_CANDIDATES.map((candidate) => ({
  originId: candidate.originId,
  defaultLevel: candidate.defaultEducation,
  status: candidate.status,
}));

const TRAITS: readonly PublicTraitOption[] = [
  {
    id: "trait-observant",
    label: "善于观察",
    summary: "习惯留意环境中的细节。",
    incompatibleTraitIds: ["trait-impulsive"],
  },
  {
    id: "trait-patient",
    label: "耐心",
    summary: "愿意花时间等待合适的时机。",
    incompatibleTraitIds: ["trait-impulsive"],
  },
  {
    id: "trait-impulsive",
    label: "冲动",
    summary: "更容易在压力下迅速行动。",
    incompatibleTraitIds: ["trait-observant", "trait-patient"],
  },
  {
    id: "trait-reserved",
    label: "寡言",
    summary: "不习惯主动透露自己的想法。",
    incompatibleTraitIds: [],
  },
];

const FLAWS = [
  { id: "flaw-sleeplessness", label: "睡眠不佳", summary: "经常难以获得完整休息。" },
  { id: "flaw-debt-pressure", label: "债务压力", summary: "日常决定会受到未清偿债务影响。" },
  { id: "flaw-short-temper", label: "脾气急躁", summary: "在冲突中更容易失去耐性。" },
] as const;

type CompatibilityStatus = PublicCompatibilityRule["status"];
type MatrixLists = Readonly<{
  readonly DIRECT: readonly string[];
  readonly CONDITIONAL: readonly string[];
  readonly FORBIDDEN: readonly string[];
}>;

const MATRIX_BY_ORIGIN: Readonly<Record<string, MatrixLists>> = {
  "origin-poor-1": {
    DIRECT: ["profession-factory-worker", "profession-dock-worker", "profession-bounty-hunter", "profession-gang-runner"],
    CONDITIONAL: ["profession-estate-servant", "profession-craft-apprentice", "profession-shop-clerk", "profession-company-clerk", "profession-junior-police-officer", "profession-private-detective"],
    FORBIDDEN: ["profession-company-accountant", "profession-lawyer"],
  },
  "origin-poor-2": {
    DIRECT: ["profession-factory-worker", "profession-dock-worker", "profession-estate-servant", "profession-craft-apprentice", "profession-shop-clerk", "profession-gang-runner"],
    CONDITIONAL: ["profession-company-clerk", "profession-junior-police-officer", "profession-private-detective", "profession-bounty-hunter"],
    FORBIDDEN: ["profession-company-accountant", "profession-lawyer"],
  },
  "origin-labor-1": {
    DIRECT: ["profession-factory-worker", "profession-dock-worker", "profession-craft-apprentice", "profession-shop-clerk", "profession-bounty-hunter", "profession-gang-runner"],
    CONDITIONAL: ["profession-estate-servant", "profession-company-clerk", "profession-junior-police-officer", "profession-private-detective"],
    FORBIDDEN: ["profession-company-accountant", "profession-lawyer"],
  },
  "origin-labor-2": {
    DIRECT: ["profession-estate-servant", "profession-shop-clerk", "profession-company-clerk", "profession-gang-runner"],
    CONDITIONAL: ["profession-factory-worker", "profession-dock-worker", "profession-craft-apprentice", "profession-junior-police-officer", "profession-private-detective", "profession-bounty-hunter"],
    FORBIDDEN: ["profession-company-accountant", "profession-lawyer"],
  },
  "origin-lower-middle-1": {
    DIRECT: ["profession-craft-apprentice", "profession-shop-clerk", "profession-private-detective"],
    CONDITIONAL: ["profession-factory-worker", "profession-dock-worker", "profession-estate-servant", "profession-company-clerk", "profession-junior-police-officer", "profession-company-accountant", "profession-bounty-hunter", "profession-gang-runner"],
    FORBIDDEN: ["profession-lawyer"],
  },
  "origin-lower-middle-2": {
    DIRECT: ["profession-shop-clerk", "profession-company-clerk", "profession-junior-police-officer", "profession-company-accountant"],
    CONDITIONAL: ["profession-factory-worker", "profession-dock-worker", "profession-estate-servant", "profession-craft-apprentice", "profession-private-detective", "profession-bounty-hunter", "profession-gang-runner"],
    FORBIDDEN: ["profession-lawyer"],
  },
  "origin-upper-middle-1": {
    DIRECT: ["profession-company-clerk", "profession-junior-police-officer", "profession-private-detective", "profession-company-accountant", "profession-lawyer"],
    CONDITIONAL: ["profession-estate-servant", "profession-craft-apprentice", "profession-shop-clerk"],
    FORBIDDEN: ["profession-factory-worker", "profession-dock-worker", "profession-bounty-hunter", "profession-gang-runner"],
  },
  "origin-upper-middle-2": {
    DIRECT: ["profession-shop-clerk", "profession-company-clerk", "profession-company-accountant"],
    CONDITIONAL: ["profession-factory-worker", "profession-dock-worker", "profession-estate-servant", "profession-craft-apprentice", "profession-junior-police-officer", "profession-private-detective", "profession-lawyer"],
    FORBIDDEN: ["profession-bounty-hunter", "profession-gang-runner"],
  },
  "origin-upper-1": {
    DIRECT: ["profession-company-clerk", "profession-junior-police-officer", "profession-lawyer"],
    CONDITIONAL: ["profession-estate-servant", "profession-shop-clerk", "profession-private-detective", "profession-company-accountant"],
    FORBIDDEN: ["profession-factory-worker", "profession-dock-worker", "profession-craft-apprentice", "profession-bounty-hunter", "profession-gang-runner"],
  },
  "origin-upper-2": {
    DIRECT: ["profession-shop-clerk", "profession-company-clerk", "profession-company-accountant", "profession-lawyer"],
    CONDITIONAL: ["profession-factory-worker", "profession-dock-worker", "profession-estate-servant", "profession-craft-apprentice", "profession-junior-police-officer", "profession-private-detective"],
    FORBIDDEN: ["profession-bounty-hunter", "profession-gang-runner"],
  },
};

const PUBLIC_REASONS: Readonly<Record<CompatibilityStatus, string>> = {
  DIRECT: "这段经历与当前职业可以直接衔接。",
  CONDITIONAL: "条件内容尚未接入，当前不能创建这条职业路径。",
  FORBIDDEN: "这段经历与当前职业暂不相容。",
};

function buildCompatibilityRules(): readonly PublicCompatibilityRule[] {
  return ORIGINS.flatMap((origin) =>
    PROFESSIONS.map((profession) => {
      const matrix = MATRIX_BY_ORIGIN[origin.id];
      if (matrix === undefined) {
        throw new Error("BA1 compatibility matrix is missing an origin");
      }
      const status = (Object.entries(matrix).find(([, professionIds]) => professionIds.includes(profession.id))?.[0] ?? "FORBIDDEN") as CompatibilityStatus;
      return {
        originId: origin.id,
        professionId: profession.id,
        status,
        publicReason: PUBLIC_REASONS[status],
      };
    }),
  );
}

const COMPATIBILITY = buildCompatibilityRules();

export const R2_COMPATIBILITY_MATRIX = COMPATIBILITY;

// The cast is intentional: the shared R2 wire type still contains the old
// specialization property, while BA1's public catalogue must omit it.
export const R2_FIXTURE_CATALOGUE = {
  contentVersion: CONTENT_VERSION,
  fixtureContent: true,
  notice: "本目录提供第一版角色开局所需的公开选择。",
  birthplaces: BIRTHPLACES,
  portraits: PORTRAITS,
  origins: PLAYER_ORIGINS,
  professions: PLAYER_PROFESSIONS,
  traits: TRAITS,
  flaws: FLAWS,
  compatibility: COMPATIBILITY,
} as unknown as PublicCharacterCreationCatalogue;

export const BROWSER_ALPHA_CATALOGUE = R2_FIXTURE_CATALOGUE;
export const BROWSER_ALPHA_CONTRACT = BROWSER_ALPHA_CONTRACT_VERSION;

export const R2_FIXTURE_DEFAULT_SELECTION: CharacterCreationSelection = {
  displayName: "Ada",
  sex: "FEMALE",
  age: 28,
  birthplaceId: "birthplace-backlund",
  appearanceDescription: "短发，衣着朴素，神情清醒。",
  portraitId: "portrait-plain-1",
  originId: "origin-labor-1",
  professionId: "profession-dock-worker",
  traitIds: ["trait-observant", "trait-patient"],
  flawId: "flaw-sleeplessness",
  // Required by the legacy shared envelope; deliberately ignored by BA1.
  specializationId: LEGACY_NO_SPECIALIZATION_ID,
  acceptedConditionIds: [],
};
