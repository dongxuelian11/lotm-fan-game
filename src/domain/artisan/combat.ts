import type { SliceState } from '../slice/types.js';

/** S6 retains the ordinary body/tool moves; its three craft abilities are daily projects. */
export function isArtisan(state: SliceState): boolean {
  return state.progression.pathwayId === 'paragon' && state.progression.sequence === 6;
}

export interface ArtisanCombatSource {
  encounterId: 'ARTISAN_DISPUTE';
  round: number;
  attemptWeek: number;
  startHistoryIndex: number;
  target: 'DEVIN_SINGLE_ADULT';
  weapon: 'DEVINS_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_WORKSHOP_OUTER_COURTYARD';
  distanceMetres: 2;
  ground: 'ORDINARY';
  bystanders: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT';
  pursuit: false;
}

/** Only the paid visit's present adult supplies this scene, never an old first-case carrier. */
export function currentArtisanCombatSource(state: SliceState): ArtisanCombatSource | null {
  const combat = state.combat;
  if (!isArtisan(state) || state.status !== 'ACTIVE' || state.health <= 0 ||
      state.activeEvent !== null || state.world.city !== 'BACKLUND' ||
      !combat || combat.encounterId !== 'ARTISAN_DISPUTE' ||
      combat.enemyStatus !== 'RESISTING' || combat.enemyHealth <= 0 ||
      !Number.isSafeInteger(combat.round) || combat.round < 1) return null;
  const encounter = state.artisan.encounter;
  if (encounter.status !== 'FIGHTING' || encounter.attemptWeek !== state.week ||
      encounter.startHistoryIndex === null || !Number.isSafeInteger(encounter.startHistoryIndex) ||
      encounter.startHistoryIndex < 0 ||
      state.combatHistory.length - encounter.startHistoryIndex !== combat.round - 1) return null;
  return {
    encounterId: 'ARTISAN_DISPUTE', round: combat.round,
    attemptWeek: encounter.attemptWeek, startHistoryIndex: encounter.startHistoryIndex,
    target: 'DEVIN_SINGLE_ADULT', weapon: 'DEVINS_ORDINARY_SHORT_CLUB',
    space: 'ORIGINAL_WORKSHOP_OUTER_COURTYARD', distanceMetres: 2,
    ground: 'ORDINARY', bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false,
  };
}
