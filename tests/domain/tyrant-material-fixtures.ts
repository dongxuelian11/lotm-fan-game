import { THUNDER_GOD_RECOVERY_SCHEMA_VERSION } from '../../src/domain/thunder-god/content.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyThunderGodAcquisition, thunderGodOriginals } from '../../src/domain/thunder-god/index.js';
import type { ThunderGodAcquisitionCommand } from '../../src/domain/thunder-god/types.js';
import { THUNDER_GOD_PREPARATION_IDS } from '../../src/domain/thunder-god/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { TYRANT_ORIGINAL_IDS, type TyrantMaterialsState, type TyrantOriginalId } from '../../src/domain/tyrant/material-types.js';

export const TYRANT_193_BOUNDARY = 'tests/fixtures/thunder-god-v01930/boundary-step-701-action.json';
export const actualFailedTyrantSource = () => readObjectEntry<SliceState>(TYRANT_193_BOUNDARY, 'final');
export const original = (n: 1 | 2 | 3): TyrantOriginalId => `thunder-god-potion-${n}`;
export const originOf = (s: SliceState): TyrantMaterialsState['origin'] => {
  const acquisition = { bottles: structuredClone(s.thunderGod.bottles), acquisitionJournal: structuredClone(s.thunderGod.acquisitionJournal),
    resupply: structuredClone(s.thunderGod.resupply), promotionWeek: s.thunderGod.promotionWeek!,
    ...(s.thunderGod.promotionStability ? { promotionStability: structuredClone(s.thunderGod.promotionStability) } : {}) };
  return { ...acquisition, actorId: `${s.runId}:original-player`, sourceDigest: sha256Hex(stableStringify(acquisition)), inheritanceLocation: 'component:original-exit' };
};
export type SourceMode = 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'RECOVERED_SUCCESS' | 'RECOVERED_SUPPLIER';
const cache = new Map<string, SliceState>();
/** Controlled reducer component cases only. Scripted check rolls exercise custody
 * branches; these are never asserted as natural RNG, valid full saves or a played
 * victory. The independent integration trace must use its untouched random stream. */
export function componentSource(n: 1 | 2 | 3, mode: SourceMode): SliceState {
  const key = `${n}:${mode}`, cached = cache.get(key); if (cached) return structuredClone(cached);
  const s = readObjectEntry<SliceState>('tests/fixtures/thunder-god-v01930/boundary-actual500p-guidance-and-frozen-eight-root-source.json', 'beforeLast');
  const weeks = 169 - s.week; s.week += weeks; s.date = addGameWeeks(s.date, weeks); s.revision += 2;
  s.schemaVersion = THUNDER_GOD_RECOVERY_SCHEMA_VERSION; s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  const apply = (command: ThunderGodAcquisitionCommand, roll = 30) => {
    applyThunderGodAcquisition(s, command, { note() {}, roll() { throw Error('No auxiliary draw'); }, check(ability, difficulty) {
      s.random.cursor++; return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll });
    } }); s.revision++;
  };
  const bodyGap = () => { s.revision += 2; s.health = 100; s.mind = 100; s.spirituality = 120; s.seer.pollution = 0; s.actionsRemaining = 100; };
  const consume = (id: string, roll: number) => {
    bodyGap(); if (s.thunderGod.bottles.find(b => b.id === id)!.status === 'SUPPLIER') apply({ type: 'BUY_POTION', bottleId: id });
    apply({ type: 'PREPARE_PROMOTION' }); apply({ type: 'CONSUME', bottleId: id, confirmed: true }, roll);
  };
  const recover = (id: string) => {
    apply({ type: 'REQUEST_RECOVERY_V1', bottleId: id }); s.week++; s.date = addGameWeeks(s.date, 1); s.revision += 2;
    apply({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: id }); return s.thunderGod.bottles.at(-1)!.id;
  };
  apply({ type: 'LEARN_GUIDANCE' }); for (const taskId of THUNDER_GOD_PREPARATION_IDS) apply({ type: 'PREPARE_TASK', taskId });
  if (mode === 'PLAYER') for (const id of TYRANT_ORIGINAL_IDS) apply({ type: 'BUY_POTION', bottleId: id });
  if (mode === 'FAILED_REMAINS') for (const id of TYRANT_ORIGINAL_IDS.filter(id => id !== original(n))) consume(id, 70);
  if (mode === 'RECOVERED_SUCCESS' || mode === 'RECOVERED_SUPPLIER') {
    for (const id of TYRANT_ORIGINAL_IDS) consume(id, 70);
    if (mode === 'RECOVERED_SUPPLIER') recover(TYRANT_ORIGINAL_IDS.find(id => id !== original(n))!);
    consume(recover(original(n)), 30);
  } else consume(original(n), 30);
  cache.set(key, structuredClone(s)); return s;
}
export { thunderGodOriginals };
