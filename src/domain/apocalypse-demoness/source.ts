import { APOCALYPSE_DEMONESS_BOTTLE_IDS, APOCALYPSE_DEMONESS_RECOVERY_SITE_ID } from './content.js';
import type { ApocalypseDemonessBottle, ApocalypseDemonessState, ApocalypseDemonessRecoveryRequest, ApocalypseDemonessOriginalCharacteristics } from './types.js';
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const bottleNumber = (b: Pick<ApocalypseDemonessBottle, 'id'>) => Number(b.id.slice('apocalypse-demoness-potion-'.length));
export const legacySupply = (c: { type: string }) => c.type === 'REQUEST_SUPPLY' || c.type === 'RECEIVE_SUPPLY';
export const recoveryCommand = (c: { type: string }) => c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1';
export const characteristicId = (bottleId: string) => `${bottleId}:characteristic`;
export const recoverySourceText = (id: string, recovery: ApocalypseDemonessRecoveryRequest, week: number) => `马库斯在原展廊出口核验${recovery.sourceBottleId}排异后遗留的同一份末日魔女特性${recovery.characteristicId}，核对原失败回执并取得本次许可后当面交接，第${week}周回收封存到重配瓶${id}。原特性来自${recovery.originalBottleId}；本次新普通药物与调配服务另付，旧原瓶及实际结果不改写。`;
/** Follow actual vessel ancestry without treating an attempt number as a fourth original. */
export function originalBottleId(state: ApocalypseDemonessState, bottle: ApocalypseDemonessBottle): string | null {
  const seen = new Set<string>(); let current = bottle;
  while (current.recovery) {
    if (seen.has(current.id)) return null; seen.add(current.id);
    const r = current.recovery, previous = state.bottles.find(b => b.id === r.sourceBottleId);
    if (!previous || r.siteId !== APOCALYPSE_DEMONESS_RECOVERY_SITE_ID || r.custodian !== 'UD3-MARCUS' || !integer(r.sourceReceiptRevision) || bottleNumber(previous) >= bottleNumber(current) || r.version !== 1 ||
      !APOCALYPSE_DEMONESS_BOTTLE_IDS.includes(r.originalBottleId as typeof APOCALYPSE_DEMONESS_BOTTLE_IDS[number]) || r.characteristicId !== characteristicId(r.originalBottleId) ||
      previous.status !== 'CONSUMED' || !failed(previous.outcome) || previous.consumedWeek === null || previous.consumedWeek > r.requestedWeek ||
      r.recoveredWeek <= r.requestedWeek || current.stockedWeek !== r.recoveredWeek) return null;
    if (previous.recovery && (previous.recovery.originalBottleId !== r.originalBottleId || previous.recovery.characteristicId !== r.characteristicId)) return null;
    if (!previous.recovery && previous.id !== r.originalBottleId) return null;
    const receipts = state.acquisitionJournal.filter(e => e.command.type === 'CONSUME' && e.command.bottleId === previous.id);
    if (receipts.length !== 1 || receipts[0]!.revision !== r.sourceReceiptRevision || receipts[0]!.check?.tier !== previous.outcome || receipts[0]!.after.sequence !== 2) return null;
    current = previous;
  }
  return APOCALYPSE_DEMONESS_BOTTLE_IDS.includes(current.id as typeof APOCALYPSE_DEMONESS_BOTTLE_IDS[number]) ? current.id : null;
}
export function recoverySource(state: ApocalypseDemonessState, bottleId: string) {
  const bottle = state.bottles.find(b => b.id === bottleId);
  if (state.bottles.slice(3).some(b => !b.recovery)) return null;
  if (!bottle || bottle.status !== 'CONSUMED' || !failed(bottle.outcome) || bottle.consumedWeek === null) return null;
  const original = originalBottleId(state, bottle);
  if (!original || state.bottles.some(b => b.recovery?.sourceBottleId === bottleId)) return null;
  // Earlier consumed rows are receipts. A live vessel or an embodied original cannot be recovered again.
  if (state.bottles.some(b => originalBottleId(state, b) === original && (b.status !== 'CONSUMED' || success(b.outcome)))) return null;
  const consumed = state.acquisitionJournal.filter(e => e.command.type === 'CONSUME' && e.command.bottleId === bottleId);
  if (consumed.length !== 1 || consumed[0]!.week !== bottle.consumedWeek || consumed[0]!.check?.tier !== bottle.outcome || consumed[0]!.after.sequence !== 2) return null;
  return { bottle, receipt: consumed[0]!, originalBottleId: original, characteristicId: characteristicId(original) };
}

export const originalSupplyFailed = (state: ApocalypseDemonessState) => state.bottles.length >= 3 && state.bottles.slice(0, 3).every((b, index) => b.id === APOCALYPSE_DEMONESS_BOTTLE_IDS[index] && !b.recovery && b.status === 'CONSUMED' && failed(b.outcome));
/** Use only after the caller validates the complete acquisition replay. No legacy fourth source is relabelled. */
export function projectOriginalLineage(state: ApocalypseDemonessState): ApocalypseDemonessOriginalCharacteristics | null {
  if (state.bottles.length < 3 || state.bottles.slice(3).some(b => !b.recovery)) return null;
  const characteristics: ApocalypseDemonessOriginalCharacteristics['characteristics'] = [];
  let embodiedOriginalBottleId: string | null = null, embodiedBottleId: string | null = null;
  for (const id of APOCALYPSE_DEMONESS_BOTTLE_IDS) {
    const chain = state.bottles.filter(b => originalBottleId(state, b) === id);
    if (!chain.length || chain[0]!.id !== id || chain.some((b, i) => i > 0 && b.recovery?.sourceBottleId !== chain[i - 1]!.id)) return null;
    const latest = chain.at(-1)!;
    const consumed = chain.filter(b => b.status === 'CONSUMED');
    const consumptionHistory = consumed.map(b => {
      const e = state.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.command.bottleId === b.id)!;
      return { bottleId: b.id, revision: e.revision, week: e.week, outcome: e.check!.tier };
    });
    if (success(latest.outcome)) {
      if (embodiedBottleId !== null) return null;
      embodiedOriginalBottleId = id; embodiedBottleId = latest.id;
    }
    characteristics.push({ characteristicId: characteristicId(id), originalBottleId: id, latestBottleId: latest.id,
      holder: latest.status === 'SUPPLIER' ? 'SUPPLIER' : latest.status === 'PLAYER' ? 'PLAYER' : success(latest.outcome) ? 'EMBODIED' : 'FAILED_REMNANT', consumptionHistory });
  }
  return characteristics.reduce((n, c) => n + state.bottles.filter(b => originalBottleId(state, b) === c.originalBottleId).length, 0) === state.bottles.length
    ? { characteristics, embodiedOriginalBottleId, embodiedBottleId } : null;
}
