import { beforeAll, describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const legacyRecoveryError = 'Unexpected PaleEmperor recovery state in a legacy save';
type Pale = SliceState['paleEmperor'];
type Legacy = Record<string, unknown> & { paleEmperor: Pale };
let natural: SliceState;
let current: SliceState;
let sun: Legacy;
beforeAll(() => {
  natural = readObjectEntry<SliceState>('tests/fixtures/pale-emperor-v01950/natural.json', 'final');
  current = createSliceRun('death-legacy-recovery-schema', sliceDefaultCreationSelection, 'death-legacy-recovery-schema');
  const { death: _death, ...previous } = current;
  sun = { ...previous, schemaVersion: 213, contentVersion: 'sun-v213' };
});

const fields: [string, (pale: Pale, value: unknown) => unknown][] = [
  ['own recoveryScene', (pale, value) => ({ ...pale, recoveryScene: value })],
  ['own resupply.recovery', (pale, value) => ({ ...pale, resupply: { ...pale.resupply, recovery: value } })],
  ['own recovery on the last bottle', (pale, value) => ({ ...pale, bottles: pale.bottles.map((bottle, index) =>
    index === pale.bottles.length - 1 ? { ...bottle, recovery: value } : bottle) })],
  ['own recoverySite on a later acquisition event', (pale, value) => ({ ...pale,
    acquisitionJournal: [...pale.acquisitionJournal, { ...pale.acquisitionJournal.at(-1), recoverySite: value }] })],
  ['own recoverySite on a later era event', (pale, value) => ({ ...pale,
    eraJournal: [...pale.eraJournal, { ...pale.eraJournal.at(-1), recoverySite: value }] })],
];

describe('Death recovery evidence cannot be backdated by legacy migration', () => {
  for (const version of [192, 213]) {
    describe(`legacy schema ${version}`, () => {
      const legacy = (): Legacy => version === 192 ? natural as unknown as Legacy : sun;
      for (const [field, inject] of fields) {
        it.each([undefined, null, { version: 1 }])(`rejects ${field} even when its value is %j`, value => {
          const input = legacy();
          // These are immutable narrow changes. The real old roots and their
          // entire history stay present, and must not acquire new authority.
          const forged = { ...input, paleEmperor: inject(input.paleEmperor, value) };
          expect(() => migrateSliceState(forged)).toThrow(legacyRecoveryError);
          expect(input.paleEmperor).not.toHaveProperty('recoveryScene');
          expect(input.paleEmperor.resupply).not.toHaveProperty('recovery');
          expect(input.paleEmperor.bottles.every(bottle => !Object.hasOwn(bottle, 'recovery'))).toBe(true);
        });
      }
      it.each(['REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1'])(
        'rejects a new %s command even without any recovery payload', type => {
          const input = legacy();
          const forged = { ...input, paleEmperor: { ...input.paleEmperor,
            acquisitionJournal: [...input.paleEmperor.acquisitionJournal, {
              ...input.paleEmperor.acquisitionJournal.at(-1), command: { type, bottleId: 'pale-emperor-potion-1' },
            }],
          } };
          expect(() => migrateSliceState(forged)).toThrow(legacyRecoveryError);
        },
      );
    });
  }

  it('preserves an untouched schema213 snapshot and only adds the exact current root and versions', () => {
    expect(migrateSliceState(sun)).toEqual(current);
    expect(sun).not.toHaveProperty('death');
    expect(sun.schemaVersion).toBe(213);
    expect(sun.contentVersion).toBe('sun-v213');
  });

  it('leaves schema214 recovery admission to the full current validator', () => {
    expect(migrateSliceState(current)).toEqual(current);
    const malformed = { ...current, paleEmperor: { ...current.paleEmperor, recoveryScene: null } };
    expect(() => migrateSliceState(malformed)).toThrow();
    try {
      migrateSliceState(malformed);
    } catch (error) {
      expect(error).not.toHaveProperty('message', legacyRecoveryError);
    }
  });
});
