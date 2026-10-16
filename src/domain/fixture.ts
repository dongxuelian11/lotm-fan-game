import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  R2_FIXTURE_DEFAULTS,
  RULE_VERSION,
  type CharacterCreationSelection,
  type PublicActionKind,
  type PublicActionResult,
  type PublicCharacterCreationCatalogue,
  type PublicCharacterProjection,
  type PublicGameState,
} from "../shared/contracts.js";
import {
  LEGACY_NO_SPECIALIZATION,
  R2_ORIGIN_OPENING_CANDIDATES,
  R2_PROFESSION_OPENING_CANDIDATES,
} from "../content/r2-catalogue.js";
import { computeWeeklyActionBudget } from "../resolution/action-budget.js";
import { addGameWeeks } from "./game-calendar.js";
import { computeStateChecksum, type PublicGameStateWithoutChecksum } from "./checksum.js";
import { applyBrowserAlphaAction } from "./action-resolution.js";


export const LEGACY_FIXTURE = "LEGACY_FIXTURE" as const;
export const BROWSER_ALPHA_CANDIDATE = "BROWSER_ALPHA_CANDIDATE" as const;
export type FixtureRunConfig = typeof LEGACY_FIXTURE | typeof BROWSER_ALPHA_CANDIDATE;

const CHARACTER_CREATED_CHRONICLE = {
  id: "r2-character-created",
  week: 1,
  date: R2_FIXTURE_DEFAULTS.currentDate,
  title: "普通人周目建立",
  summary: "角色选择已确认，第一周从普通人的日常开始。",
} as const;

function assertFixtureRunConfig(config: FixtureRunConfig): void {
  if (config !== LEGACY_FIXTURE && config !== BROWSER_ALPHA_CANDIDATE) {
    throw new Error("Unknown fixture run configuration");
  }
}
const ACTION_COPY: Record<PublicActionKind, { readonly title: string; readonly summary: string }> = {
  WORK: { title: "完成工作", summary: "完成一次工作安排，处理今天的职责与琐事。" },
  LEARN: { title: "进行学习", summary: "完成一次学习安排，整理手头的材料。" },
  INVESTIGATE: { title: "进行调查", summary: "完成一次调查安排，梳理眼前的线索与迹象。" },
  REST: { title: "安排休养", summary: "完成一次休养安排，安静度过一段空闲时间。" },
};

function resolvedChoice(option: { readonly id: string; readonly label: string }): { id: string; label: string } {
  return { id: option.id, label: option.label };
}

function findChoice<T extends { readonly id: string }>(values: readonly T[], id: string): T {
  const value = values.find((candidate) => candidate.id === id);
  if (value === undefined) {
    throw new Error("Validated catalogue reference is missing");
  }

  return value;
}

function withChecksum(state: PublicGameStateWithoutChecksum): PublicGameState {
  return { ...state, stateChecksum: computeStateChecksum(state) };
}

function openingStat(base: number, originModifier: number, professionModifier: number, educationBonus = 0): number {
  return Math.max(10, Math.min(20, base + originModifier + professionModifier + educationBonus));
}

function createLegacyFixtureRunState(
  runId: string,
  selection: CharacterCreationSelection,
  catalogue: PublicCharacterCreationCatalogue,
): PublicGameState {
  const birthplace = findChoice(catalogue.birthplaces, selection.birthplaceId);
  const portrait = findChoice(catalogue.portraits, selection.portraitId ?? catalogue.portraits[0]!.id);
  const origin = findChoice(catalogue.origins, selection.originId);
  const profession = findChoice(catalogue.professions, selection.professionId);
  const traits = selection.traitIds.map((id) => resolvedChoice(findChoice(catalogue.traits, id)));
  const flaw = findChoice(catalogue.flaws, selection.flawId);
  const character: PublicCharacterProjection = {
    displayName: selection.displayName,
    sex: selection.sex,
    age: selection.age,
    originCountry: "LOEN",
    birthplace: resolvedChoice(birthplace),
    appearanceDescription: selection.appearanceDescription,
    portrait: {
      ...resolvedChoice(portrait),
      appearanceTags: [...portrait.appearanceTags],
    },
    origin: {
      ...resolvedChoice(origin),
      tier: origin.tier,
    },
    profession: {
      ...resolvedChoice(profession),
      legality: profession.legality,
    },
    traits,
    flaw: resolvedChoice(flaw),
    specialization: { ...LEGACY_NO_SPECIALIZATION },
    sequence: "ORDINARY",
    coreStats: { ...R2_FIXTURE_DEFAULTS.coreStats },
    resources: {
      health: { ...R2_FIXTURE_DEFAULTS.resources.health },
      mind: { ...R2_FIXTURE_DEFAULTS.resources.mind },
      spirituality: { ...R2_FIXTURE_DEFAULTS.resources.spirituality },
      pollution: R2_FIXTURE_DEFAULTS.resources.pollution,
    },
  };

  return withChecksum({
    contractVersion: CONTRACT_VERSION,
    ruleVersion: RULE_VERSION,
    contentVersion: CONTENT_VERSION,
    runId,
    lifecycle: "ACTIVE",
    revision: 1,
    week: R2_FIXTURE_DEFAULTS.week,
    currentDate: { ...R2_FIXTURE_DEFAULTS.currentDate },
    availableActions: R2_FIXTURE_DEFAULTS.availableActions,
    cashPence: R2_FIXTURE_DEFAULTS.cashPence,
    character,
    chronicle: [CHARACTER_CREATED_CHRONICLE],
    knowledgeRecords: [],
    clues: [],
    worldFeedback: [],
    activeEvent: null,
    pendingEvents: [],
    lastEventResolution: null,
    lastAction: null,
  });
}
export function createR2CharacterRunState(
  runId: string,
  selection: CharacterCreationSelection,
  catalogue: PublicCharacterCreationCatalogue,
  mode: FixtureRunConfig,
): PublicGameState {
  assertFixtureRunConfig(mode);
  if (mode === LEGACY_FIXTURE) {
    return createLegacyFixtureRunState(runId, selection, catalogue);
  }
  const birthplace = findChoice(catalogue.birthplaces, selection.birthplaceId);
  const portrait = selection.portraitId === undefined
    ? undefined
    : findChoice(catalogue.portraits, selection.portraitId);
  const origin = findChoice(catalogue.origins, selection.originId);
  const profession = findChoice(catalogue.professions, selection.professionId);
  const originOpening = R2_ORIGIN_OPENING_CANDIDATES.find((candidate) => candidate.originId === selection.originId);
  const professionOpening = R2_PROFESSION_OPENING_CANDIDATES.find((candidate) => candidate.professionId === selection.professionId);
  if (originOpening === undefined || professionOpening === undefined) {
    throw new Error("Validated opening candidate is missing");
  }
  const traits = selection.traitIds.map((id) => resolvedChoice(findChoice(catalogue.traits, id)));
  const flaw = findChoice(catalogue.flaws, selection.flawId);

  const character: PublicCharacterProjection = {
    displayName: selection.displayName,
    sex: selection.sex,
    age: selection.age,
    originCountry: "LOEN",
    birthplace: resolvedChoice(birthplace),
    appearanceDescription: selection.appearanceDescription,
    origin: {
      ...resolvedChoice(origin),
      tier: origin.tier,
    },
    profession: {
      ...resolvedChoice(profession),
      legality: profession.legality,
    },
    traits,
    flaw: resolvedChoice(flaw),
    sequence: "ORDINARY",
    coreStats: {
      physique: openingStat(R2_FIXTURE_DEFAULTS.coreStats.physique, originOpening.coreStatModifiers.physique, professionOpening.coreStatModifiers.physique),
      perception: openingStat(R2_FIXTURE_DEFAULTS.coreStats.perception, originOpening.coreStatModifiers.perception, professionOpening.coreStatModifiers.perception),
      will: openingStat(R2_FIXTURE_DEFAULTS.coreStats.will, originOpening.coreStatModifiers.will, professionOpening.coreStatModifiers.will),
      knowledge: openingStat(R2_FIXTURE_DEFAULTS.coreStats.knowledge, originOpening.coreStatModifiers.knowledge, professionOpening.coreStatModifiers.knowledge, originOpening.openingKnowledgeBonus),
    },
    resources: {
      health: { ...R2_FIXTURE_DEFAULTS.resources.health },
      mind: { ...R2_FIXTURE_DEFAULTS.resources.mind },
      spirituality: { ...R2_FIXTURE_DEFAULTS.resources.spirituality },
      pollution: R2_FIXTURE_DEFAULTS.resources.pollution,
    },
  };

  const projectedCharacter: PublicCharacterProjection = portrait === undefined
    ? character
    : {
        ...character,
        portrait: {
          ...resolvedChoice(portrait),
          appearanceTags: [...portrait.appearanceTags],
        },
      };

  return withChecksum({
    contractVersion: CONTRACT_VERSION,
    ruleVersion: RULE_VERSION,
    contentVersion: CONTENT_VERSION,
    runId,
    lifecycle: "ACTIVE",
    revision: 1,
    week: R2_FIXTURE_DEFAULTS.week,
    currentDate: { ...R2_FIXTURE_DEFAULTS.currentDate },
    availableActions: R2_FIXTURE_DEFAULTS.availableActions,
    cashPence: professionOpening.initialCashPence,
    character: projectedCharacter,
    chronicle: [{
      id: "r2-character-created",
      week: 1,
      date: R2_FIXTURE_DEFAULTS.currentDate,
      title: "普通人周目建立",
      summary: `角色选择已确认，默认学历为${originOpening.educationLabel}，第一周从普通人的日常开始。`,
    }],
    knowledgeRecords: [],
    clues: [],
    worldFeedback: [],
    activeEvent: null,
    pendingEvents: [],
    lastEventResolution: null,
    lastAction: null,
  });
}

export class WeeklyActionUnavailableError extends Error {
  public constructor() {
    super("No weekly action remains");
    this.name = "WeeklyActionUnavailableError";
  }
}

function applyLegacyFixtureAction(state: PublicGameState, action: PublicActionKind): PublicGameState {
  if (state.availableActions < 1) {
    throw new WeeklyActionUnavailableError();
  }

  const copy = ACTION_COPY[action];
  if (copy === undefined) {
    throw new Error("Unknown weekly action");
  }

  const weekBefore = state.week;
  const availableActionsBefore = state.availableActions;
  const weekAdvanced = availableActionsBefore === 1;
  const weekAfter = weekAdvanced ? weekBefore + 1 : weekBefore;
  const availableActionsAfter = weekAdvanced
    ? computeWeeklyActionBudget(R2_FIXTURE_DEFAULTS.availableActions)
    : availableActionsBefore - 1;
  const dateBefore = state.currentDate;
  const dateAfter = weekAdvanced ? addGameWeeks(dateBefore, 1) : dateBefore;
  const nextRevision = state.revision + 1;
  const feedbackEntryId = `r2-feedback-${nextRevision}`;
  const result: PublicActionResult = {
    action,
    title: copy.title,
    summary: copy.summary,
    weekBefore,
    weekAfter,
    availableActionsBefore,
    availableActionsAfter,
    weekAdvanced,
    dateBefore,
    dateAfter,
    resolution: null,
    consequences: [],
    feedbackEntryId,
  };

  return withChecksum({
    ...stateWithoutChecksum(state),
    revision: nextRevision,
    week: weekAfter,
    availableActions: availableActionsAfter,
    chronicle: [
      ...state.chronicle,
      {
        id: `r2-action-${nextRevision}`,
        week: weekBefore,
        date: dateBefore,
        title: copy.title,
        summary: copy.summary,
      },
    ],
    currentDate: dateAfter,
    worldFeedback: [
      ...state.worldFeedback,
      {
        id: feedbackEntryId,
        kind: "ACTION",
        visibility: "CONFIRMED",
        date: dateBefore,
        title: copy.title,
        summary: copy.summary,
      },
    ],
    lastAction: result,
  });
}
export function applyWeeklyAction(
  state: PublicGameState,
  action: PublicActionKind,
  mode: FixtureRunConfig,
): PublicGameState {
  assertFixtureRunConfig(mode);
  if (mode === LEGACY_FIXTURE) {
    return applyLegacyFixtureAction(state, action);
  }
  return applyBrowserAlphaAction(state, action);
}
export function stateWithoutChecksum(state: PublicGameState): PublicGameStateWithoutChecksum {
  const { stateChecksum: _stateChecksum, ...withoutChecksum } = state;
  return withoutChecksum;
}

export function hasValidStateChecksum(state: PublicGameState): boolean {
  return state.stateChecksum === computeStateChecksum(stateWithoutChecksum(state));
}
