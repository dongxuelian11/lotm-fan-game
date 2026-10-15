import {
  BA2_EVENT_DEFINITIONS,
  type BA2EventDefinition,
} from "../content/ba2-events.js";
import { addGameWeeks } from "../domain/game-calendar.js";
import { computeCheckChance } from "../resolution/normal-check.js";
import type { ActionRandomStream } from "../resolution/deterministic-random.js";
import type {
  PublicActionKind,
  PublicEventCard,
  PublicGameDate,
  PublicGameState,
  PublicPendingEvent,
} from "../shared/contracts.js";

export type BA2EventTrigger = PublicActionKind | "WORLD_PULSE";

const EVENT_INSTANCE_PREFIX = "ba2-event-instance-";

function eventHasBeenResolvedRecently(
  state: PublicGameState,
  definition: BA2EventDefinition,
): boolean {
  const marker = `ba2-event-resolution-${definition.id}-`;
  return state.chronicle.some((entry) =>
    entry.id.startsWith(marker) && entry.week >= state.week - definition.cooldownWeeks,
  );
}

function eventIsOutstanding(state: PublicGameState, definitionId: string): boolean {
  if (state.activeEvent?.definitionId === definitionId) return true;
  return state.pendingEvents.some((event) => event.eventInstanceId.includes(`-${definitionId}-`));
}

function chooseWeightedDefinition(
  candidates: readonly BA2EventDefinition[],
  random: ActionRandomStream | undefined,
): BA2EventDefinition | null {
  if (candidates.length === 0) return null;
  const totalWeight = candidates.reduce((total, candidate) => total + candidate.weight, 0);
  if (random === undefined) return candidates[0] ?? null;
  const draw = random.nextInt(1, totalWeight);
  let cumulative = 0;
  for (const candidate of candidates) {
    cumulative += candidate.weight;
    if (draw <= cumulative) return candidate;
  }
  return candidates[candidates.length - 1] ?? null;
}

export function findBA2EventDefinition(definitionId: string): BA2EventDefinition | undefined {
  return BA2_EVENT_DEFINITIONS.find((definition) => definition.id === definitionId);
}

export function selectBA2EventDefinition(
  state: PublicGameState,
  action: BA2EventTrigger,
  random?: ActionRandomStream,
): BA2EventDefinition | null {
  if (state.activeEvent !== null) return null;
  const candidates = BA2_EVENT_DEFINITIONS.filter((definition) =>
    definition.triggerActions.includes(action) &&
    !eventIsOutstanding(state, definition.id) &&
    !eventHasBeenResolvedRecently(state, definition),
  );
  return chooseWeightedDefinition(candidates, random);
}

export function eventInstanceId(definitionId: string, revision: number): string {
  return `${EVENT_INSTANCE_PREFIX}${definitionId}-${revision}`;
}

export function toPublicEventCard(
  definition: BA2EventDefinition,
  instanceId: string,
  date: PublicGameDate,
  state: PublicGameState,
): PublicEventCard {
  return {
    eventInstanceId: instanceId,
    definitionId: definition.id,
    kind: definition.kind,
    title: definition.title,
    body: definition.body,
    date: { ...date },
    sourceLabel: definition.sourceLabel,
    choices: definition.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      resolutionMode: choice.resolutionMode,
      hardCostPreview: choice.hardCostPreview,
      foreseeableConsequences: [...choice.foreseeableConsequences],
      ...(choice.check === undefined ? {} : { checkPreview: {
        ability: choice.check.ability,
        baseAbility: state.character.coreStats[choice.check.ability],
        modifiers: choice.check.modifiers.map((modifier) => ({ ...modifier })),
        effectiveAbility: state.character.coreStats[choice.check.ability] +
          choice.check.modifiers.reduce((total, modifier) => total + modifier.value, 0),
        difficulty: choice.check.difficulty,
        chance: computeCheckChance({
          ability: choice.check.ability,
          baseAbility: state.character.coreStats[choice.check.ability],
          difficulty: choice.check.difficulty,
          modifiers: choice.check.modifiers,
        }),
      } }),
      ...(choice.resolutionMode === "COMBAT" || choice.resolutionMode === "TRADE"
        ? { unavailableReason: "这个选项目前还无法处理。" }
        : {}),
    })),
  };
}

export function toPendingEvent(
  definition: BA2EventDefinition,
  instanceId: string,
  createdOn: PublicGameDate,
): PublicPendingEvent {
  return {
    eventInstanceId: instanceId,
    title: definition.title,
    sourceLabel: definition.sourceLabel,
    createdOn: { ...createdOn },
    expiresOn: addGameWeeks(createdOn, 1),
  };
}

export function shouldAttemptNonInvestigativeEvent(
  action: BA2EventTrigger,
  random?: ActionRandomStream,
): boolean {
  if (action === "INVESTIGATE") return true;
  if (action === "WORLD_PULSE") return random !== undefined;
  return random !== undefined && random.nextInt(1, 4) === 2;
}

export function pruneExpiredPendingEvents(
  pendingEvents: readonly PublicPendingEvent[],
  currentDate: PublicGameDate,
): readonly PublicPendingEvent[] {
  const currentKey = currentDate.year * 10_000 + currentDate.month * 100 + currentDate.day;
  return pendingEvents.filter((event) => {
    if (event.expiresOn === null) return true;
    const expiry = event.expiresOn.year * 10_000 + event.expiresOn.month * 100 + event.expiresOn.day;
    return expiry > currentKey;
  });
}
