import { FOOL_ESCAPE_WORLD_RECORD } from './escape-content.js';
import { FATE_COMMISSIONS, FATE_CONTENT_VERSION, FATE_ORIGIN, FATE_PURSUIT_TABLE } from './fate-content.js';
import { addGameDays, gameDaysBetween } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { FOOL_SUCCESSION, FOOL_UNIQUENESS_ID, type FoolMaterialStamp, type FoolUniquenessCustodyRecord } from './materials.js';

/** Fixed authored future history. These identities precede player investigation;
 * opening a page neither creates a characteristic nor changes its custodian. */
export const FOOL_PREDECESSOR = Object.freeze({
  id: 'F208-PREDECESSOR-ELENOR', name: '埃莱诺·赛伦', sequence: 0,
  fate: 'DIED_SEALING_NORTHERN_RIFT_IN_1652',
  fallRecord: FOOL_SUCCESSION.eventId,
  formerUniqueness: FOOL_UNIQUENESS_ID,
  successors: ['AM1-LEGACY-1', 'AM1-LEGACY-2', 'AM1-LEGACY-3'],
});
export const FOOL_VAULT = Object.freeze({
  id: 'F208-VAULT-NORTHERN-ARCHIVE', location: 'base', seal: 'F208-ORIGINAL-VAULT-SEAL',
  custodianId: 'F208-VERA', custodianName: '封库保管人维拉', age: 58,
  motive: '核实继承者实际承担旧裂口遗留风险后交接封物；保管费只用于原封检查和搬运，不出售或复制唯一性。',
});

/** The calendar uses the existing run's weekly phase. Both historical dates
 * remain in 1652, strictly before the observed original 1653 delivery. */
export function foolUniquenessCustody(checkpoint: FoolMaterialStamp): FoolUniquenessCustodyRecord[] {
  const beginning = { epoch: 'FIFTH_EPOCH', year: 1652, month: 7, day: 1 } as const;
  const weeks = Math.floor(gameDaysBetween(beginning, checkpoint.date) / 7);
  if (weeks < 8 || checkpoint.week <= weeks) throw new Error('当前年代尚未到达这份真实遗产的交接记录。');
  const first = { week: checkpoint.week - weeks, date: addGameDays(beginning, gameDaysBetween(beginning, checkpoint.date) - weeks * 7), revision: 0 };
  if (first.date.year !== 1652) throw new Error('原封存记录年代不符。');
  const second = { week: first.week + 4, date: addGameDays(first.date, 28), revision: 0 };
  return [
    { ...first, id: 'F208-VAULT-RECORD-1652-A', sourceEventId: FOOL_SUCCESSION.eventId, previousRecordId: null,
      uniquenessId: FOOL_UNIQUENESS_ID, sealId: FOOL_VAULT.seal, custodianId: 'F208-RIFT-RECOVERY-CUSTODIAN', locationId: 'salt-vault' },
    { ...second, id: 'F208-VAULT-RECORD-1652-B', sourceEventId: 'F208-VAULT-RECORD-1652-A', previousRecordId: 'F208-VAULT-RECORD-1652-A',
      uniquenessId: FOOL_UNIQUENESS_ID, sealId: FOOL_VAULT.seal, custodianId: FOOL_VAULT.custodianId, locationId: FOOL_VAULT.location },
  ];
}
export const foolWorldDigest = (checkpoint: FoolMaterialStamp): string => sha256Hex(stableStringify({ predecessor: FOOL_PREDECESSOR, custody: foolUniquenessCustody(checkpoint), vault: FOOL_VAULT, escape: FOOL_ESCAPE_WORLD_RECORD, fate: { commissions: FATE_COMMISSIONS, version: FATE_CONTENT_VERSION, origin: FATE_ORIGIN, pursuit: FATE_PURSUIT_TABLE } }));

export interface FoolCompoundSupply {
  id: string; providerId: 'F208-ARCHIVE-COMPOUND-WORKSHOP'; availableWeek: number;
  inputs: { id: string; role: 'CARRIER_FLUID' | 'ISOLATION_MATERIAL' | 'EMPTY_BOTTLE' }[];
}
/** Ordinary consumables have independent supply IDs. This does not manufacture
 * a fourth characteristic; later deliveries require a real later game week. */
export function foolCompoundSupply(index: number, originWeek: number): FoolCompoundSupply {
  if (!Number.isSafeInteger(index) || index < 1 || index > 1000 || !Number.isSafeInteger(originWeek) || originWeek < 1) throw new Error('普通配制批次无效。');
  const id = `F208-COMPOUND-SUPPLY-${index}`;
  return { id, providerId: 'F208-ARCHIVE-COMPOUND-WORKSHOP', availableWeek: originWeek + Math.max(0, index - 3),
    inputs: [{ id: `${id}:carrier`, role: 'CARRIER_FLUID' }, { id: `${id}:seal`, role: 'ISOLATION_MATERIAL' }, { id: `${id}:bottle`, role: 'EMPTY_BOTTLE' }] };
}
