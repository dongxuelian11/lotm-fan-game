import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { resolveCivilizationEnlightenerOriginalCharacteristicsSnapshot, validateCivilizationEnlightenerAcquisitionCommand } from '../../src/domain/civilization-enlightener/index.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
const original = () => readObjectEntry<SliceState>('tests/fixtures/civilization-enlightener-v01890/natural.json', 'final').civilizationEnlightener;

describe('Civilization Enlightener narrow original-characteristic resolver', () => {
  it('reads the exact three originals from untouched schema186 acquisition history', () => {
    const source = original(), bytes = stableStringify(source);
    expect(resolveCivilizationEnlightenerOriginalCharacteristicsSnapshot(source)).toEqual({
      characteristics: [1, 2, 3].map(n => ({ characteristicId: `civilization-enlightener-potion-${n}:characteristic`,
        originalBottleId: `civilization-enlightener-potion-${n}`, latestBottleId: `civilization-enlightener-potion-${n}`,
        holder: n === 1 ? 'EMBODIED' : 'SUPPLIER' })),
      embodiedOriginalBottleId: 'civilization-enlightener-potion-1', embodiedBottleId: 'civilization-enlightener-potion-1',
    });
    expect(stableStringify(source)).toBe(bytes);
  });
  it('requires exact CE cursor pairs, costs and actor shape rather than Writer-shaped or fabricated evidence', () => {
    for (const mutate of [
      (s: ReturnType<typeof original>) => { s.acquisitionJournal.at(-1)!.cursorAfter++; },
      (s: ReturnType<typeof original>) => { s.acquisitionJournal[0]!.after.cash++; },
      (s: ReturnType<typeof original>) => { Object.assign(s.acquisitionJournal[0]!.actor, { audiencePromotionWeek: 5 }); },
      (s: ReturnType<typeof original>) => { s.bottles.push({ ...s.bottles[2]!, id: 'civilization-enlightener-potion-4' }); },
      (s: ReturnType<typeof original>) => { s.bottles[0]!.recovery = { version: 1, originalBottleId: 'civilization-enlightener-potion-2',
        sourceBottleId: 'civilization-enlightener-potion-2', characteristicId: 'civilization-enlightener-potion-2:characteristic', requestedWeek: 179, recoveredWeek: 180 }; },
    ]) { const source = original(); mutate(source); expect(resolveCivilizationEnlightenerOriginalCharacteristicsSnapshot(source)).toBeNull(); }
  });
  it('offers only versioned paid recovery commands, never another independent original batch', () => {
    expect(validateCivilizationEnlightenerAcquisitionCommand({ type: 'REQUEST_SUPPLY' })).toBe(false);
    expect(validateCivilizationEnlightenerAcquisitionCommand({ type: 'RECEIVE_SUPPLY' })).toBe(false);
    expect(validateCivilizationEnlightenerAcquisitionCommand({ type: 'REQUEST_RECOVERY_V1', bottleId: 'civilization-enlightener-potion-1' })).toBe(true);
    expect(validateCivilizationEnlightenerAcquisitionCommand({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: 'civilization-enlightener-potion-4' })).toBe(true);
    expect(validateCivilizationEnlightenerAcquisitionCommand({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: 'civilization-enlightener-potion-1', free: true })).toBe(false);
  });
});
