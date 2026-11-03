import type { SliceProjection } from "../domain/slice/types";

function bookmark(state: SliceProjection): { key: string; value: string } | null {
  if (state.status !== "ACTIVE" || state.progression.pathwayId !== "hunter"
    || state.progression.sequence !== 9 || !state.hunter.promoted
    || state.combat !== null || !state.lastCombatRound) return null;
  return {
    key: `slice-ui:hunter-read-round:${state.runId}`,
    value: JSON.stringify([state.lastCombatRound, state.combatHistory]),
  };
}

export function hasReadHunterRound(state: SliceProjection): boolean {
  const mark = bookmark(state);
  if (!mark) return false;
  try { return window.localStorage.getItem(mark.key) === mark.value; }
  catch { return false; }
}

export function rememberHunterRound(state: SliceProjection): void {
  const mark = bookmark(state);
  if (!mark) return;
  // Explicit acknowledgement is a UI preference, never a saved-game mutation.
  try { window.localStorage.setItem(mark.key, mark.value); }
  catch { /* Unavailable storage preserves the existing replay-on-load behavior. */ }
}
