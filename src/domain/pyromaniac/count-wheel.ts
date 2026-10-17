import type { SliceWheelEntry } from '../slice/types.js';

/** Finite S7 balance for this stage (G), not a quantitative claim about canon.
 * Pure shared counts have no runtime dependency on any combat adapter. */
export const PYROMANIAC_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
  Object.freeze({ id: '6', label: '6次', weight: 10 }),
]);

export function pyromaniacActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 75 ? 4 : roll <= 90 ? 5 : 6;
}
