import type { SliceProjection } from "../domain/slice/types";

function bookmark(state: SliceProjection, allowPromotedRead = false): { key: string; value: string } | null {
  if (state.status !== "ACTIVE" || state.progression.pathwayId !== "diviner"
    || state.combat !== null || !state.lastCombatRound) return null;
  const writableClown = state.progression.sequence === 8 && state.clown.rescueCombatStarted === true;
  // Promotion may recognize an existing exact bookmark, but must never write a new S7 one.
  const promotedRead = allowPromotedRead && state.progression.sequence === 7 && state.magician?.promoted;
  if (!writableClown && !promotedRead) return null;
  return {
    key: `slice-ui:clown-read-round:${state.runId}`,
    value: JSON.stringify([state.combatHistory.length, state.lastCombatRound]),
  };
}

export function hasReadClownRound(state: SliceProjection): boolean {
  const mark = bookmark(state, true);
  if (!mark) return false;
  try { return window.localStorage.getItem(mark.key) === mark.value; }
  catch { return false; }
}

export function rememberClownRound(state: SliceProjection): void {
  const mark = bookmark(state);
  if (!mark) return;
  // UI preference only: unavailable storage must never affect the saved game.
  try { window.localStorage.setItem(mark.key, mark.value); }
  catch { /* Keep the existing replay-on-load behavior. */ }
}
