import {
  BA2_EVENT_DEFINITIONS,
  type BA2ConsequenceDefinition,
  type BA2EventChoiceDefinition,
  type BA2EventDefinition,
} from "../content/ba2-events.js";
import {
  R2_PROFESSION_OPENING_CANDIDATES,
} from "../content/r2-catalogue.js";
import { addGameWeeks } from "./game-calendar.js";
import {
  eventInstanceId,
  findBA2EventDefinition,
  pruneExpiredPendingEvents,
  selectBA2EventDefinition,
  shouldAttemptNonInvestigativeEvent,
  toPendingEvent,
  toPublicEventCard,
} from "../simulation/event-engine.js";
import type { ActionRandomStream } from "../resolution/deterministic-random.js";
import { resolveNormalCheck } from "../resolution/normal-check.js";
import type {
  PublicActionKind,
  PublicActionResult,
  PublicCheckResult,
  PublicClueRecord,
  PublicConsequenceItem,
  PublicCoreStatKey,
  PublicEventResolutionResult,
  PublicGameDate,
  PublicGameState,
  PublicKnowledgeRecord,
  PublicResourceMeter,
  PublicResources,
  PublicResolutionTier,
} from "../shared/contracts.js";
import { R2_FIXTURE_DEFAULTS } from "../shared/contracts.js";
import { computeStateChecksum, type PublicGameStateWithoutChecksum } from "./checksum.js";

export interface ActionResolutionContext {
  readonly random?: ActionRandomStream;
  readonly roll?: number;
}

export class BlockingEventUnavailableError extends Error {
  public constructor() {
    super("A blocking event must be resolved first");
    this.name = "BlockingEventUnavailableError";
  }
}

export class EventResolutionUnavailableError extends Error {
  public constructor() {
    super("This event resolution mode is not available");
    this.name = "EventResolutionUnavailableError";
  }
}

const ACTION_COPY: Record<PublicActionKind, { readonly title: string; readonly summary: string }> = {
  WORK: { title: "完成工作", summary: "你完成了一段工作，处理好眼前的职责与琐事。" },
  LEARN: { title: "进行学习", summary: "你整理材料并把注意力放在一项可核对的知识上。" },
  INVESTIGATE: { title: "进行调查", summary: "你沿着眼前的迹象查访，留下了可以继续核对的记录。" },
  REST: { title: "安排休养", summary: "你留出时间休息，让身体和精神慢慢恢复。" },
};

const LEARNING_CHECK = { ability: "knowledge" as const, difficulty: 10, modifiers: [] as const };
const INVESTIGATION_CHECK = { ability: "perception" as const, difficulty: 15, modifiers: [] as const };
const RESTORE_CANDIDATE = {
  health: 10,
  mind: 10,
  spirituality: 5,
} as const;

function formatCashPence(totalPence: number): string {
  const pounds = Math.floor(totalPence / 240);
  const remainder = totalPence % 240;
  return `${pounds} 镑 ${Math.floor(remainder / 12)} 苏勒 ${remainder % 12} 便士`;
}

function stateWithoutChecksum(state: PublicGameState): PublicGameStateWithoutChecksum {
  const { stateChecksum: _stateChecksum, ...withoutChecksum } = state;
  return withoutChecksum;
}

function withChecksum(state: PublicGameStateWithoutChecksum): PublicGameState {
  return { ...state, stateChecksum: computeStateChecksum(state) };
}

function cloneDate(date: PublicGameDate): PublicGameDate {
  return { ...date };
}

function nextRoll(context: ActionResolutionContext): number {
  return context.random?.nextInt(1, 100) ?? context.roll ?? 50;
}

function isSuccessTier(tier: PublicResolutionTier): boolean {
  return tier === "GREAT_SUCCESS" || tier === "SUCCESS";
}

function conditionApplies(
  condition: BA2ConsequenceDefinition["condition"],
  tier: PublicResolutionTier | null,
): boolean {
  if (condition === "ALWAYS") return true;
  if (tier === null) return false;
  if (condition === "GREAT_SUCCESS" || condition === "GREAT_FAILURE") return condition === tier;
  return condition === "SUCCESS"
    ? isSuccessTier(tier)
    : tier === "FAILURE" || tier === "GREAT_FAILURE";
}

function consequenceItem(
  definition: BA2ConsequenceDefinition,
  applied: boolean,
  numericValue = definition.numericValue,
  referenceId = definition.referenceId,
): PublicConsequenceItem {
  return {
    id: definition.id,
    target: definition.target,
    change: definition.change,
    ...(numericValue === undefined ? {} : { numericValue }),
    ...(referenceId === undefined ? {} : { referenceId }),
    condition: definition.condition,
    applied,
    source: definition.source,
    summary: definition.summary,
  };
}

function recordTitle(target: "KNOWLEDGE" | "CLUE", summary: string): string {
  return target === "KNOWLEDGE" ? `知识记录：${summary}` : `线索记录：${summary}`;
}

function makeKnowledgeRecord(
  definition: BA2ConsequenceDefinition,
  date: PublicGameDate,
): PublicKnowledgeRecord {
  const summary = definition.summary;
  return {
    id: definition.referenceId ?? definition.id,
    title: recordTitle("KNOWLEDGE", summary),
    summary,
    visibility: "CONFIRMED",
    acquiredOn: cloneDate(date),
    sourceLabel: definition.source,
  };
}

function makeClueRecord(
  definition: BA2ConsequenceDefinition,
  date: PublicGameDate,
): PublicClueRecord {
  const summary = definition.summary;
  return {
    id: definition.referenceId ?? definition.id,
    title: recordTitle("CLUE", summary),
    summary,
    visibility: "CONFIRMED",
    acquiredOn: cloneDate(date),
    sourceLabel: definition.source,
  };
}

function updateCoreStat(
  state: PublicGameStateWithoutChecksum,
  key: PublicCoreStatKey,
  change: "ADD" | "SET",
  requested: number,
): { readonly state: PublicGameStateWithoutChecksum; readonly actual: number; readonly applied: boolean } {
  const before = state.character.coreStats[key];
  const after = change === "SET"
    ? Math.max(0, Math.min(500, requested))
    : Math.max(0, Math.min(500, before + requested));
  const actual = after - before;
  if (actual === 0) return { state, actual, applied: false };
  return {
    state: {
      ...state,
      character: {
        ...state.character,
        coreStats: { ...state.character.coreStats, [key]: after },
      },
    },
    actual,
    applied: true,
  };
}

function resourceKey(value: string | undefined): keyof PublicResources | undefined {
  return value === "health" || value === "mind" || value === "spirituality" ? value : undefined;
}

function updateResource(
  state: PublicGameStateWithoutChecksum,
  key: keyof PublicResources,
  change: "ADD" | "SET",
  requested: number,
): { readonly state: PublicGameStateWithoutChecksum; readonly actual: number; readonly applied: boolean } {
  if (key === "pollution") return { state, actual: 0, applied: false };
  const meter = state.character.resources[key] as PublicResourceMeter;
  const after = change === "SET"
    ? Math.max(0, Math.min(meter.max, requested))
    : Math.max(0, Math.min(meter.max, meter.current + requested));
  const actual = after - meter.current;
  if (actual === 0) return { state, actual, applied: false };
  return {
    state: {
      ...state,
      character: {
        ...state.character,
        resources: {
          ...state.character.resources,
          [key]: { ...meter, current: after },
        },
      },
    },
    actual,
    applied: true,
  };
}

type AppliedEventConsequence = {
  readonly state: PublicGameStateWithoutChecksum;
  readonly applied: boolean;
  readonly numericValue?: number | undefined;
  readonly referenceId?: string | undefined;
  readonly actual?: number | undefined;
};

function applyEventConsequence(
  state: PublicGameStateWithoutChecksum,
  definition: BA2ConsequenceDefinition,
  date: PublicGameDate,
  nextRevision: number,
): AppliedEventConsequence {
  const requested = definition.numericValue ?? 0;
  if (definition.target === "CORE_STAT" && (definition.change === "ADD" || definition.change === "SET")) {
    const key = definition.referenceId as PublicCoreStatKey | undefined;
    if (key !== "physique" && key !== "perception" && key !== "will" && key !== "knowledge") {
      return { state, applied: false, numericValue: 0, referenceId: definition.referenceId };
    }
    const result = updateCoreStat(state, key, definition.change, requested);
    return { ...result, referenceId: definition.referenceId };
  }
  if (definition.target === "RESOURCE" && (definition.change === "ADD" || definition.change === "SET")) {
    const key = resourceKey(definition.referenceId);
    if (key === undefined) return { state, applied: false, numericValue: 0, referenceId: definition.referenceId };
    const result = updateResource(state, key, definition.change, requested);
    return { ...result, referenceId: definition.referenceId };
  }
  if (definition.target === "CASH" && (definition.change === "ADD" || definition.change === "SET")) {
    const before = state.cashPence;
    const after = definition.change === "SET"
      ? Math.max(0, requested)
      : Math.max(0, before + requested);
    return {
      state: after === before ? state : { ...state, cashPence: after },
      actual: after - before,
      applied: after !== before,
      numericValue: after - before,
      referenceId: definition.referenceId,
    };
  }
  if (definition.target === "KNOWLEDGE" && definition.change === "CREATE") {
    const record = makeKnowledgeRecord(definition, date);
    if (state.knowledgeRecords.some((candidate) => candidate.id === record.id)) {
      return { state, applied: false, referenceId: record.id };
    }
    return {
      state: { ...state, knowledgeRecords: [...state.knowledgeRecords, record] },
      applied: true,
      referenceId: record.id,
    };
  }
  if (definition.target === "CLUE" && definition.change === "CREATE") {
    const record = makeClueRecord(definition, date);
    if (state.clues.some((candidate) => candidate.id === record.id)) {
      return { state, applied: false, referenceId: record.id };
    }
    return {
      state: { ...state, clues: [...state.clues, record] },
      applied: true,
      referenceId: record.id,
    };
  }
  if (definition.target === "EVENT" && definition.change === "QUEUE" && definition.referenceId !== undefined) {
    const nextDefinition = findBA2EventDefinition(definition.referenceId);
    if (nextDefinition === undefined) return { state, applied: false, referenceId: definition.referenceId };
    const nextInstanceId = eventInstanceId(nextDefinition.id, nextRevision);
    if (state.pendingEvents.some((event) => event.eventInstanceId === nextInstanceId)) {
      return { state, applied: false, referenceId: nextInstanceId };
    }
    if (state.pendingEvents.length >= 3) return { state, applied: false, referenceId: nextInstanceId };
    return {
      state: {
        ...state,
        pendingEvents: [...state.pendingEvents, toPendingEvent(nextDefinition, nextInstanceId, date)],
      },
      applied: true,
      referenceId: nextInstanceId,
    };
  }
  return { state, applied: false, numericValue: definition.numericValue, referenceId: definition.referenceId };
}

function buildActionFeedback(
  id: string,
  date: PublicGameDate,
  title: string,
  summary: string,
): PublicGameState["worldFeedback"][number] {
  return {
    id,
    kind: "ACTION",
    visibility: "CONFIRMED",
    date: cloneDate(date),
    title,
    summary,
  };
}

function buildPulseFeedback(
  id: string,
  date: PublicGameDate,
): PublicGameState["worldFeedback"][number] {
  return {
    id,
    kind: "WORLD_PULSE",
    visibility: "CONFIRMED",
    date: cloneDate(date),
    title: "公共告示换新",
    summary: "街区公共栏撤下了过期告示，换上新的招工、租屋与货运通知；你目前只能确认这些公开变化。",
  };
}

function publicConsequenceForAction(
  id: string,
  target: PublicConsequenceItem["target"],
  change: PublicConsequenceItem["change"],
  summary: string,
  numericValue?: number,
  applied = true,
  referenceId?: string,
): PublicConsequenceItem {
  return {
    id,
    target,
    change,
    ...(numericValue === undefined ? {} : { numericValue }),
    ...(referenceId === undefined ? {} : { referenceId }),
    condition: "ALWAYS",
    applied,
    source: "本次行动",
    summary,
  };
}

function appendActionEvent(
  state: PublicGameStateWithoutChecksum,
  action: PublicActionKind,
  date: PublicGameDate,
  nextRevision: number,
  random: ActionRandomStream | undefined,
): { readonly state: PublicGameStateWithoutChecksum; readonly consequence: PublicConsequenceItem | null } {
  if (!shouldAttemptNonInvestigativeEvent(action, random)) {
    return { state, consequence: null };
  }
  const definition = selectBA2EventDefinition(state as PublicGameState, action, random);
  if (definition === null) return { state, consequence: null };
  const instanceId = eventInstanceId(definition.id, nextRevision);
  const card = toPublicEventCard(definition, instanceId, date, state as PublicGameState);
  return {
    state: { ...state, activeEvent: card },
    consequence: publicConsequenceForAction(
      `action-event-${nextRevision}`,
      "EVENT",
      "QUEUE",
      "一条新消息需要你作出选择。",
      undefined,
      true,
      instanceId,
    ),
  };
}

function appendWorldPulseEvent(
  state: PublicGameStateWithoutChecksum,
  date: PublicGameDate,
  nextRevision: number,
  random: ActionRandomStream | undefined,
): { readonly state: PublicGameStateWithoutChecksum; readonly consequence: PublicConsequenceItem | null } {
  if (state.activeEvent !== null || !shouldAttemptNonInvestigativeEvent("WORLD_PULSE", random)) {
    return { state, consequence: null };
  }
  const definition = selectBA2EventDefinition(state as PublicGameState, "WORLD_PULSE", random);
  if (definition === null) return { state, consequence: null };
  const instanceId = eventInstanceId(definition.id, nextRevision);
  const card = toPublicEventCard(definition, instanceId, date, state as PublicGameState);
  return {
    state: { ...state, activeEvent: card },
    consequence: publicConsequenceForAction(
      `pulse-event-${nextRevision}`,
      "EVENT",
      "QUEUE",
      "一条新的公开消息需要你作出选择。",
      undefined,
      true,
      instanceId,
    ),
  };
}

function applyLearning(
  state: PublicGameStateWithoutChecksum,
  date: PublicGameDate,
  nextRevision: number,
  context: ActionResolutionContext,
): { readonly state: PublicGameStateWithoutChecksum; readonly resolution: PublicCheckResult; readonly consequences: readonly PublicConsequenceItem[]; readonly summary: string } {
  const resolution = resolveNormalCheck({
    ...LEARNING_CHECK,
    baseAbility: state.character.coreStats.knowledge,
    roll: nextRoll(context),
  });
  const recordDefinition: BA2ConsequenceDefinition = {
    id: `learn-record-${nextRevision}`,
    target: "KNOWLEDGE",
    change: "CREATE",
    referenceId: `knowledge-learning-${nextRevision}`,
    condition: "ALWAYS",
    source: "学习记录",
    summary: isSuccessTier(resolution.tier)
      ? "你确认了一条关于公开记录整理方法的知识。"
      : "你记下了本次查阅的材料出处，之后可以继续核对。",
  };
  const record = makeKnowledgeRecord(recordDefinition, date);
  let next: PublicGameStateWithoutChecksum = {
    ...state,
    knowledgeRecords: [...state.knowledgeRecords, record],
  };
  const currentKnowledge = state.character.coreStats.knowledge;
  const candidateGain = isSuccessTier(resolution.tier) ? 5 : 0;
  const actualGain = Math.min(candidateGain, 500 - currentKnowledge);
  const knowledgeChange = publicConsequenceForAction(
    `learn-knowledge-${nextRevision}`,
    "CORE_STAT",
    "ADD",
    actualGain > 0
      ? `知识增加 ${actualGain}。`
      : candidateGain > 0
        ? "知识已达到500上限，本次没有额外增加。"
        : "本次检定未满足知识增长条件，知识数值没有变化。",
    actualGain,
    actualGain > 0,
    "knowledge",
  );
  if (actualGain > 0) {
    next = {
      ...next,
      character: {
        ...next.character,
        coreStats: { ...next.character.coreStats, knowledge: currentKnowledge + actualGain },
      },
    };
  }
  const recordConsequence = publicConsequenceForAction(
    `learn-record-consequence-${nextRevision}`,
    "KNOWLEDGE",
    "CREATE",
    recordDefinition.summary,
    undefined,
    true,
    record.id,
  );
  const summary = actualGain > 0
    ? `你完成了学习，整理出一条具体记录，知识增加 ${actualGain}。`
    : candidateGain > 0
      ? "你完成了学习，留下了一条具体记录；知识已达到500上限。"
      : "你完成了学习，留下了一条具体记录；本次检定未满足知识增长条件。";
  return { state: next, resolution, consequences: [recordConsequence, knowledgeChange], summary };
}

function applyInvestigation(
  state: PublicGameStateWithoutChecksum,
  date: PublicGameDate,
  nextRevision: number,
  context: ActionResolutionContext,
): { readonly state: PublicGameStateWithoutChecksum; readonly resolution: PublicCheckResult; readonly consequences: readonly PublicConsequenceItem[]; readonly summary: string } {
  const resolution = resolveNormalCheck({
    ...INVESTIGATION_CHECK,
    baseAbility: state.character.coreStats.perception,
    roll: nextRoll(context),
  });
  const clueDefinition: BA2ConsequenceDefinition = {
    id: `investigation-clue-${nextRevision}`,
    target: "CLUE",
    change: "CREATE",
    referenceId: `clue-investigation-${nextRevision}`,
    condition: "ALWAYS",
    source: "调查记录",
    summary: isSuccessTier(resolution.tier)
      ? "你确认了公开记录中的一处日期与编号联系。"
      : "你发现公开记录中有一处日期缺口，值得之后回头核对。",
  };
  const clue = makeClueRecord(clueDefinition, date);
  let next: PublicGameStateWithoutChecksum = {
    ...state,
    clues: [...state.clues, clue],
  };
  const clueConsequence = publicConsequenceForAction(
    `investigation-clue-consequence-${nextRevision}`,
    "CLUE",
    "CREATE",
    clueDefinition.summary,
    undefined,
    true,
    clue.id,
  );
  return {
    state: next,
    resolution,
    consequences: [clueConsequence],
    summary: `你完成了调查，留下了一条可追溯线索：${clue.summary}`,
  };
}

function applyRest(
  state: PublicGameStateWithoutChecksum,
  nextRevision: number,
): { readonly state: PublicGameStateWithoutChecksum; readonly consequences: readonly PublicConsequenceItem[]; readonly summary: string } {
  let next = state;
  const consequences: PublicConsequenceItem[] = [];
  for (const [key, amount] of Object.entries(RESTORE_CANDIDATE) as readonly [keyof typeof RESTORE_CANDIDATE, number][]) {
    const result = updateResource(next, key, "ADD", amount);
    next = result.state;
    consequences.push(publicConsequenceForAction(
      `rest-${key}-${nextRevision}`,
      "RESOURCE",
      "ADD",
      result.actual > 0 ? `${key === "health" ? "健康" : key === "mind" ? "精神" : "灵性"}恢复 ${result.actual}。` : `${key === "health" ? "健康" : key === "mind" ? "精神" : "灵性"}已满，本次没有额外变化。`,
      result.actual,
      result.applied,
      key,
    ));
  }
  const changed = consequences.some((consequence) => consequence.applied);
  return {
    state: next,
    consequences,
    summary: changed ? "你完成了休养，健康、精神与灵性都得到实际调整。" : "你完成了休养，三项状态都已处于当前上限。",
  };
}

function applyWork(
  state: PublicGameStateWithoutChecksum,
  nextRevision: number,
): { readonly state: PublicGameStateWithoutChecksum; readonly consequences: readonly PublicConsequenceItem[]; readonly summary: string } {
  const profession = R2_PROFESSION_OPENING_CANDIDATES.find((candidate) =>
    candidate.professionId === state.character.profession.id,
  );
  if (profession === undefined) throw new Error("Validated profession opening candidate is missing");
  const alreadySettled = state.chronicle.some((entry) =>
    entry.week === state.week && entry.id.startsWith("r2-action-work-paid-"),
  );
  const amount = alreadySettled ? 0 : profession.weeklyWorkPayPence;
  const summary = alreadySettled
    ? "你完成了工作；本周职业工资已经结算，本次没有重复入账。"
    : `你完成了工作，职业工资 ${formatCashPence(profession.weeklyWorkPayPence)} 已入账。`;
  return {
    state: amount === 0 ? state : { ...state, cashPence: state.cashPence + amount },
    consequences: [publicConsequenceForAction(
      `work-pay-${nextRevision}`,
      "CASH",
      "ADD",
      amount > 0 ? `职业工资增加 ${formatCashPence(amount)}。` : "本周职业工资已经结算，没有重复入账。",
      amount,
      amount > 0,
      "weekly-work-pay",
    )],
    summary,
  };
}

export function applyBrowserAlphaAction(
  state: PublicGameState,
  action: PublicActionKind,
  context: ActionResolutionContext = {},
): PublicGameState {
  if (state.activeEvent !== null) throw new BlockingEventUnavailableError();
  if (state.availableActions < 1) throw new Error("No weekly action remains");
  const copy = ACTION_COPY[action];
  if (copy === undefined) throw new Error("Unknown weekly action");

  const dateBefore = cloneDate(state.currentDate);
  const weekBefore = state.week;
  const availableActionsBefore = state.availableActions;
  const weekAdvanced = availableActionsBefore === 1;
  const weekAfter = weekAdvanced ? weekBefore + 1 : weekBefore;
  const dateAfter = weekAdvanced ? addGameWeeks(dateBefore, 1) : dateBefore;
  const availableActionsAfter = weekAdvanced
    ? R2_FIXTURE_DEFAULTS.availableActions
    : availableActionsBefore - 1;
  const nextRevision = state.revision + 1;

  let next = stateWithoutChecksum(state);
  let resolution: PublicCheckResult | null = null;
  let consequences: readonly PublicConsequenceItem[] = [];
  let summary = copy.summary;
  if (action === "WORK") {
    const result = applyWork(next, nextRevision);
    next = result.state;
    consequences = result.consequences;
    summary = result.summary;
  } else if (action === "LEARN") {
    const result = applyLearning(next, dateBefore, nextRevision, context);
    next = result.state;
    resolution = result.resolution;
    consequences = result.consequences;
    summary = result.summary;
  } else if (action === "INVESTIGATE") {
    const result = applyInvestigation(next, dateBefore, nextRevision, context);
    next = result.state;
    resolution = result.resolution;
    consequences = result.consequences;
    summary = result.summary;
  } else {
    const result = applyRest(next, nextRevision);
    next = result.state;
    consequences = result.consequences;
    summary = result.summary;
  }

  const eventResult = appendActionEvent(next, action, dateBefore, nextRevision, context.random);
  next = eventResult.state;
  if (eventResult.consequence !== null) consequences = [...consequences, eventResult.consequence];

  if (weekAdvanced && next.activeEvent === null) {
    const pulseBase: PublicGameStateWithoutChecksum = {
      ...next,
      week: weekAfter,
      currentDate: dateAfter,
      pendingEvents: pruneExpiredPendingEvents(next.pendingEvents, dateAfter),
    };
    const pulseEvent = appendWorldPulseEvent(pulseBase, dateAfter, nextRevision, context.random);
    next = pulseEvent.state;
    if (pulseEvent.consequence !== null) consequences = [...consequences, pulseEvent.consequence];
  }

  const actionFeedbackId = `feedback-action-${nextRevision}`;
  const actionChronicleId = action === "WORK" && consequences.some((item) => item.id === `work-pay-${nextRevision}` && item.applied)
    ? `r2-action-work-paid-${nextRevision}`
    : `r2-action-${action.toLowerCase()}-${nextRevision}`;
  const actionFeedback = buildActionFeedback(actionFeedbackId, dateBefore, copy.title, summary);
  const actionResult: PublicActionResult = {
    action,
    title: copy.title,
    summary,
    weekBefore,
    weekAfter,
    availableActionsBefore,
    availableActionsAfter,
    weekAdvanced,
    dateBefore,
    dateAfter,
    resolution,
    consequences,
    feedbackEntryId: actionFeedbackId,
  };
  next = {
    ...next,
    revision: nextRevision,
    week: weekAfter,
    currentDate: dateAfter,
    availableActions: availableActionsAfter,
    pendingEvents: pruneExpiredPendingEvents(next.pendingEvents, dateAfter),
    chronicle: [
      ...next.chronicle,
      {
        id: actionChronicleId,
        week: weekBefore,
        date: dateBefore,
        title: copy.title,
        summary,
      },
    ],
    worldFeedback: [...next.worldFeedback, actionFeedback],
    lastAction: actionResult,
  };
  if (weekAdvanced) {
    const pulseId = `feedback-pulse-${nextRevision}`;
    next = {
      ...next,
      worldFeedback: [...next.worldFeedback, buildPulseFeedback(pulseId, dateAfter)],
    };
  }
  return withChecksum(next);
}

function findChoice(definition: BA2EventDefinition, choiceId: string): BA2EventChoiceDefinition {
  const choice = definition.choices.find((candidate) => candidate.id === choiceId);
  if (choice === undefined) throw new EventResolutionUnavailableError();
  return choice;
}

function eventResolutionSummary(
  definition: BA2EventDefinition,
  choice: BA2EventChoiceDefinition,
  resolution: PublicCheckResult | null,
): string {
  if (resolution === null) return `你选择“${choice.label}”，${definition.title}暂时告一段落。`;
  const tier = resolution.tier === "GREAT_SUCCESS" ? "大成功"
    : resolution.tier === "SUCCESS" ? "成功"
      : resolution.tier === "GREAT_FAILURE" ? "大失败" : "失败";
  return `你选择“${choice.label}”，检定结果为${tier}，留下了可继续核对的记录。`;
}

export function resolveEventChoice(
  state: PublicGameState,
  eventInstanceIdValue: string,
  choiceId: string,
  context: ActionResolutionContext = {},
): PublicGameState {
  const activeEvent = state.activeEvent;
  if (activeEvent === null || activeEvent.eventInstanceId !== eventInstanceIdValue) {
    throw new EventResolutionUnavailableError();
  }
  const definition = findBA2EventDefinition(activeEvent.definitionId);
  if (definition === undefined) throw new EventResolutionUnavailableError();
  const choice = findChoice(definition, choiceId);
  if (choice.resolutionMode === "COMBAT" || choice.resolutionMode === "TRADE") {
    throw new EventResolutionUnavailableError();
  }
  const resolution = choice.check === undefined
    ? null
    : resolveNormalCheck({
        ...choice.check,
        baseAbility: state.character.coreStats[choice.check.ability],
        roll: nextRoll(context),
      });
  const nextRevision = state.revision + 1;
  let next = stateWithoutChecksum(state);
  const publicConsequences: PublicConsequenceItem[] = [];
  for (const consequence of choice.consequences) {
    if (!conditionApplies(consequence.condition, resolution?.tier ?? null)) {
      publicConsequences.push(consequenceItem(consequence, false));
      continue;
    }
    const applied = applyEventConsequence(next, consequence, state.currentDate, nextRevision);
    next = applied.state;
    publicConsequences.push(consequenceItem(
      consequence,
      applied.applied,
      applied.numericValue,
      applied.referenceId,
    ));
  }
  const summary = eventResolutionSummary(definition, choice, resolution);
  const feedbackId = `feedback-event-${nextRevision}`;
  const feedback = {
    id: feedbackId,
    kind: "EVENT_RESULT" as const,
    visibility: "CONFIRMED" as const,
    date: cloneDate(state.currentDate),
    title: definition.title,
    summary,
  };
  const resolutionResult: PublicEventResolutionResult = {
    eventInstanceId: activeEvent.eventInstanceId,
    choiceId: choice.id,
    title: definition.title,
    summary,
    resolution,
    consequences: publicConsequences,
  };
  next = {
    ...next,
    revision: nextRevision,
    activeEvent: null,
    chronicle: [...next.chronicle, {
      id: `ba2-event-resolution-${definition.id}-${nextRevision}`,
      week: state.week,
      date: state.currentDate,
      title: definition.title,
      summary,
    }],
    worldFeedback: [...next.worldFeedback, feedback],
    lastEventResolution: resolutionResult,
  };
  return withChecksum(next);
}
