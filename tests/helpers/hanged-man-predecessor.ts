import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { darkAngelOriginalBottlePrice } from '../../src/domain/dark-angel/index.js';
import { da, ready } from '../domain/dark-angel-directed-helper.js';
import { readObjectEntry } from './read-object-entry.js';

export interface DarkAngelOriginalRecoveryOptions {
  original?: 1 | 2 | 3;
  support?: boolean;
  labour?: boolean;
  /** Receives only the new public continuation after the saved723-command checkpoint. */
  commands?: SliceIntent[];
  /** Optional real, already migrated three-failure checkpoint. Never mutated. */
  source?: SliceState;
}
/** The genuine failed source is retained. This returns the newly prepared
 * recovered dose before its future draw; controlled test outcomes belong to
 * the caller. Wages, ordinary care, next-week handover and all fees use public
 * commands, with no direct stat, cash, action, seed or cursor edits. */
export function prepareDarkAngelOriginalRecovery(options: DarkAngelOriginalRecoveryOptions = {}): SliceState {
  const { original = 1, support = true, labour = true, commands } = options;
  let s = options.source ? structuredClone(options.source) : migrateSliceState(readObjectEntry<unknown>(
    'tests/fixtures/dark-angel-v02010/boundary-consume-dark-angel-potion-3.json', 'final'));
  const bottleId = `dark-angel-potion-${original}`;
  s = ready(s, { ap: 2, cash: 150, health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
  s = da(s, { type: 'REQUEST_RECOVERY_V1', bottleId }, commands);
  s = ready(s, { ap: 1, cash: 30, afterWeek: s.darkAngel.resupply.requestedWeek! }, commands);
  s = da(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId }, commands);
  const carrier = s.darkAngel.bottles.at(-1)!;
  if (!carrier.recovery || carrier.recovery.originalBottleId !== bottleId) throw new Error('The actual recovered original was not handed over.');
  if (labour) for (let n = 0; n < 5; n++) s = da(ready(s, {}, commands), { type: 'POTION_WORK', bottleId: carrier.id }, commands);
  const price = darkAngelOriginalBottlePrice(s.darkAngel.bottles.find(b => b.id === carrier.id)!);
  s = ready(s, { ap: 1, cash: price + 180 + (support ? 60 : 0) + 90, health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
  s = da(s, { type: 'BUY_POTION', bottleId: carrier.id }, commands);
  s = da(s, { type: 'PREPARE_PROMOTION' }, commands);
  if (support) s = da(s, { type: 'STABILIZE_PROMOTION', bottleId: carrier.id }, commands);
  return s;
}
