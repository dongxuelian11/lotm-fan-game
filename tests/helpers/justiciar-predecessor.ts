import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { handOfOrderOriginalBottlePrice } from '../../src/domain/hand-of-order/index.js';
import { hoo, ready } from '../domain/hand-of-order-directed-helper.js';
import { readObjectEntry } from './read-object-entry.js';

export interface HandOfOrderOriginalRecoveryOptions {
  original?: 1 | 2 | 3;
  support?: boolean;
  labour?: boolean;
  /** Receives only the new public continuation after the saved706-command checkpoint. */
  commands?: SliceIntent[];
  /** Optional real, already migrated three-failure checkpoint. Never mutated. */
  source?: SliceState;
}
/** The genuine failed source is retained. This returns the newly prepared
 * recovered dose before its future draw; controlled test outcomes belong to
 * the caller. Wages, ordinary care, next-week handover and all fees use public
 * commands, with no direct stat, cash, action, seed or cursor edits. */
export function prepareHandOfOrderOriginalRecovery(options: HandOfOrderOriginalRecoveryOptions = {}): SliceState {
  const { original = 1, support = true, labour = true, commands } = options;
  let s = options.source ? structuredClone(options.source) : migrateSliceState(readObjectEntry<unknown>(
    'tests/fixtures/hand-of-order-v02060/boundary-step-706-action.json', 'final'));
  const bottleId = `hand-of-order-potion-${original}`;
  s = ready(s, { ap: 2, cash: 150, health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
  s = hoo(s, { type: 'REQUEST_RECOVERY_V1', bottleId }, commands);
  s = ready(s, { ap: 1, cash: 30, afterWeek: s.handOfOrder.resupply.requestedWeek! }, commands);
  s = hoo(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId }, commands);
  const carrier = s.handOfOrder.bottles.at(-1)!;
  if (!carrier.recovery || carrier.recovery.originalBottleId !== bottleId) throw new Error('The actual recovered original was not handed over.');
  if (labour) for (let n = 0; n < 5; n++) s = hoo(ready(s, {}, commands), { type: 'POTION_WORK', bottleId: carrier.id }, commands);
  const price = handOfOrderOriginalBottlePrice(s.handOfOrder.bottles.find(b => b.id === carrier.id)!);
  s = ready(s, { ap: 1, cash: price + 180 + (support ? 60 : 0) + 90, health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
  s = hoo(s, { type: 'BUY_POTION', bottleId: carrier.id }, commands);
  s = hoo(s, { type: 'PREPARE_PROMOTION' }, commands);
  if (support) s = hoo(s, { type: 'STABILIZE_PROMOTION', bottleId: carrier.id }, commands);
  return s;
}
