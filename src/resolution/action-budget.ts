import { R2_FIXTURE_DEFAULTS } from "../shared/contracts.js";

export interface ActionBudgetAdjustment {
  readonly sourceId: string;
  readonly amount: number;
}

/**
 * Computes a weekly action budget from explicit, deterministic adjustments.
 * BA1 supplies no adjustments; later systems can add them without changing
 * the action resolver or introducing an implicit random source.
 */
export function computeWeeklyActionBudget(
  baseActions = R2_FIXTURE_DEFAULTS.availableActions,
  adjustments: readonly ActionBudgetAdjustment[] = [],
): number {
  if (!Number.isSafeInteger(baseActions) || baseActions < 0) {
    throw new Error("Invalid weekly action budget base");
  }

  let total = baseActions;
  for (const adjustment of adjustments) {
    if (
      typeof adjustment.sourceId !== "string" ||
      adjustment.sourceId.length === 0 ||
      !Number.isSafeInteger(adjustment.amount)
    ) {
      throw new Error("Invalid weekly action budget adjustment");
    }
    total += adjustment.amount;
  }

  return Math.max(1, total);
}
