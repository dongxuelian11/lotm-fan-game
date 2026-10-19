import type { DemonessEffect, DemonessHost, DemonessMaterialCommand, DemonessMaterials, DemonessPlace, DemonessSource } from './types.js';
import { DEMONESS_ORIGINAL_IDS } from './types.js';
import { DEMONESS_PRICES, DEMONESS_SUCCESSION } from './content.js';
import { sameDemoness } from './source.js';
const clone = <T>(v: T): T => structuredClone(v);
const exact = (v: object, keys: string[]) => sameDemoness(Object.keys(v).sort(), keys.sort());
export function validateDemonessMaterialCommand(v: unknown): v is DemonessMaterialCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  if (['LABOUR', 'ASK_RECOVERY_PERMISSION', 'INVESTIGATE_REMAINS', 'SEAL_ORIGINAL', 'ACQUIRE_CHARACTERISTIC'].includes(String(c.type))) return exact(c, ['type', 'originalId']) && DEMONESS_ORIGINAL_IDS.includes(c.originalId as typeof DEMONESS_ORIGINAL_IDS[number]);
  if (['SEAL_REMAINS', 'RECOVER_REMAINS'].includes(String(c.type))) return exact(c, ['type', 'compoundId']) && typeof c.compoundId === 'string' && c.compoundId.length > 0 && c.compoundId.length <= 300;
  return exact(c, ['type']) && ['VERIFY_CUSTODY', 'ACQUIRE_UNIQUENESS', 'BUY_CARRIER', 'COMPOSE'].includes(String(c.type));
}
export function createDemonessMaterials(source: DemonessSource): DemonessMaterials {
  return { characteristics: source.originalCharacteristics.characteristics.map(item => {
    const bottle = source.bottles.find(b => b.id === item.latestBottleId)!;
    return { id: item.characteristicId, originalId: item.originalBottleId as typeof DEMONESS_ORIGINAL_IDS[number], latestBottleId: item.latestBottleId,
      holder: item.holder, location: item.holder === 'EMBODIED' ? null : item.holder === 'SUPPLIER' ? 'DM221-SUPPLIER' : 'DM221-GALLERY-EXIT',
      labourSteps: bottle.labourSteps, newLabourEventIds: [], acquiredEventId: null,
      failedConsumptionRevision: item.holder === 'FAILED_REMNANT' ? item.consumptionHistory.at(-1)!.revision : null,
      recoveryPermissionEventId: null, permissionWeek: null, investigatedEventId: null, sealedEventId: null, sealedWeek: null };
  }), succession: clone(DEMONESS_SUCCESSION), uniqueness: { id: 'DM221-ORIGINAL-UNIQUENESS', holder: 'CUSTODIAN', location: 'DM221-VAULT', verifiedEventId: null, verifiedWeek: null, acquiredEventId: null },
    carriers: [1, 2, 3].map(n => ({ id: `demoness-carrier-${n}`, status: 'SUPPLIER', boughtEventId: null })), compounds: [] };
}
function quote(m: DemonessMaterials, c: DemonessMaterialCommand): DemonessEffect {
  const e: DemonessEffect = { actions: 0, cash: 0, spirituality: 0, mind: 0, health: 0, seconds: 600, mastery: {}, injury: null };
  const item = 'originalId' in c ? m.characteristics.find(x => x.originalId === c.originalId)! : null;
  if (c.type === 'LABOUR') Object.assign(e, { actions: 1, seconds: 28800 });
  if (c.type === 'ASK_RECOVERY_PERMISSION') e.seconds = 30;
  if (c.type === 'INVESTIGATE_REMAINS') Object.assign(e, { actions: 1, cash: DEMONESS_PRICES.residueInspection, seconds: 1800 });
  if (c.type === 'ACQUIRE_CHARACTERISTIC') Object.assign(e, { actions: 1, cash: item!.holder === 'SUPPLIER' ? item!.labourSteps === 5 ? DEMONESS_PRICES.supplyLabour : DEMONESS_PRICES.supplyFull : DEMONESS_PRICES.originalRecovery, seconds: 1800 });
  if (c.type === 'VERIFY_CUSTODY') Object.assign(e, { actions: 1, cash: DEMONESS_PRICES.uniquenessVerification, seconds: 1800 });
  if (c.type === 'ACQUIRE_UNIQUENESS') Object.assign(e, { actions: 1, cash: DEMONESS_PRICES.uniquenessHandover, seconds: 1800 });
  if (c.type === 'BUY_CARRIER') Object.assign(e, { actions: 1, cash: DEMONESS_PRICES.carrier, seconds: 1800 });
  if (c.type === 'COMPOSE') Object.assign(e, { actions: 1, cash: DEMONESS_PRICES.compose, seconds: 3600 });
  if (c.type === 'RECOVER_REMAINS') Object.assign(e, { actions: 1, cash: DEMONESS_PRICES.sealedRecovery, seconds: 1800 });
  return e;
}
export function demonessMaterialBlock(m: DemonessMaterials, c: DemonessMaterialCommand, h: DemonessHost, passageReportEventId: string | null, source: DemonessSource): string | null {
  if (!validateDemonessMaterialCommand(c) || h.budget.sequence !== 1) return '须由尚未晋升的末日魔女本人处理这些原物。';
  const e = quote(m, c);
  if (h.budget.actions < e.actions || h.budget.cash < e.cash) return '实际行动或现款不足，可以先按原职业工作并结算生活费用。';
  const item = 'originalId' in c ? m.characteristics.find(x => x.originalId === c.originalId)! : null;
  if (item) {
    if (item.holder === 'EMBODIED' || item.holder === 'FUSED' || item.holder === 'COMPOUND' || item.holder === 'EXPOSED' || item.holder === 'SEALED') return '这份原特性已经在本人或同一成药之中，不能再次领取。';
    if (h.location !== item.location) return '本人须实际抵达这份原物当前所在处。';
    if (c.type === 'LABOUR') return item.holder !== 'SUPPLIER' || item.labourSteps >= 5 ? '只可为仍在供应方的这份原物完成尚未做过的五项有限劳动。' : null;
    if (c.type === 'ASK_RECOVERY_PERMISSION') return !['FAILED_REMNANT', 'LOCATED', 'SEALED_ORIGINAL'].includes(item.holder) || item.failedConsumptionRevision === null || !source.originals.liveSite.marcus?.alive || source.originals.liveSite.marcus.location !== 'OUTSIDE' ? '须有这份原瓶的真实失败遗留，并在原展廊出口向仍在场的马库斯询问本次查验与交接。' : item.permissionWeek === h.week && item.recoveryPermissionEventId ? '本周已当面取得这份原残余的查验与交接许可。' : null;
    if (c.type === 'INVESTIGATE_REMAINS') return item.holder !== 'FAILED_REMNANT' || item.permissionWeek !== h.week || !item.recoveryPermissionEventId ? '先当面取得本周许可，再查验对应原失败回执的同一残余。' : null;
    if (c.type === 'SEAL_ORIGINAL') return item.holder !== 'LOCATED' || item.permissionWeek !== h.week || !item.investigatedEventId ? '须已在本周许可下实际查见同一残余，才能原地封存。' : null;
    if (c.type === 'ACQUIRE_CHARACTERISTIC') {
      if (item.holder === 'PLAYER') return item.acquiredEventId ? '这份已经在本人手中的原特性已完成有价提取，不会再收费或补发。' : null;
      if (item.holder === 'SUPPLIER') return null;
      return item.holder !== 'SEALED_ORIGINAL' || item.sealedWeek === null || h.week <= item.sealedWeek || item.permissionWeek !== h.week || !item.recoveryPermissionEventId ? '同一残余封存至少跨一真实周，重新取得当前交接许可后，才能付费回收。' : null;
    }
    return '这份原物当前不能这样处理。';
  }
  if (c.type === 'VERIFY_CUSTODY') return h.location !== 'DM221-VAULT' || m.uniqueness.holder !== 'CUSTODIAN' ? '须亲自到伊妮德保管室核对仍在那里封存的同一唯一性。' : m.uniqueness.verifiedWeek === h.week ? '本周已经实际核对原死亡、析出、封存链与当前原件。' : !sameDemoness(m.succession, DEMONESS_SUCCESSION) ? '原唯一性封存链不一致。' : null;
  if (c.type === 'ACQUIRE_UNIQUENESS') return h.location !== 'DM221-VAULT' || m.uniqueness.holder !== 'CUSTODIAN' || m.uniqueness.verifiedWeek !== h.week || !m.uniqueness.verifiedEventId ? '在保管室完成本周原件核验及当前交接许可后，才能付费取得。' : null;
  if (c.type === 'BUY_CARRIER') return h.location !== 'DM221-SUPPLIER' || !m.carriers.some(x => x.status === 'SUPPLIER') || m.carriers.some(x => x.status === 'PLAYER') || m.compounds.some(x => x.status === 'PREPARED') ? '须在供应处购买尚存的一件有限载体；已有未用载体或成药时不能多领。' : null;
  if (c.type === 'COMPOSE') {
    if (h.location !== 'DM221-WORKSHOP' || !passageReportEventId) return '须带原物到封闭调配室，并已取得两位成人真实通行与退出的结果。';
    if (m.compounds.some(x => ['PREPARED', 'FAILED_EXPOSED', 'FAILED_SEALED', 'SUCCESS', 'DEATH_EXPOSED'].includes(x.status)) || !m.carriers.some(x => x.status === 'PLAYER')) return '已有成药或未回收残余，或没有实购未耗载体。';
    if (m.characteristics.filter(x => x.holder === 'EMBODIED').length !== 1 || m.characteristics.some(x => x.holder !== 'EMBODIED' && (x.holder !== 'PLAYER' || !x.acquiredEventId || x.location !== h.location)) || m.uniqueness.holder !== 'PLAYER' || m.uniqueness.location !== h.location) return '须是体内原份、实取的另外两份，以及本人携到现场的同一唯一性。';
    return null;
  }
  if (c.type === 'SEAL_REMAINS' || c.type === 'RECOVER_REMAINS') {
    const p = m.compounds.find(x => x.id === c.compoundId);
    if (!p || p.location !== h.location) return '须本人实际回到同一成药失败的原处。';
    if (c.type === 'SEAL_REMAINS') return p.status !== 'FAILED_EXPOSED' ? '只有本人仍活着的真实失败残余可原地封存。' : null;
    return p.status !== 'FAILED_SEALED' || p.sealedWeek === null || h.week <= p.sealedWeek ? '同一失败残余须实际封存并跨过一整周，才能付费回收。' : null;
  }
  return '当前没有这项原物处理。';
}
export function applyDemonessMaterial(input: DemonessMaterials, c: DemonessMaterialCommand, h: DemonessHost, passageReportEventId: string | null, source: DemonessSource) {
  const reason = demonessMaterialBlock(input, c, h, passageReportEventId, source); if (reason) throw Error(reason);
  const m = clone(input), effect = quote(m, c), notes: string[] = [], item = 'originalId' in c ? m.characteristics.find(x => x.originalId === c.originalId)! : null;
  if (c.type === 'LABOUR') { item!.labourSteps++; item!.newLabourEventIds.push(h.eventId); notes.push('本人实际工作八小时完成这份原物的一项交接劳动，只抵扣本份费用，不发额外工资、不生成新特性。'); }
  if (c.type === 'ASK_RECOVERY_PERMISSION') { item!.recoveryPermissionEventId = h.eventId; item!.permissionWeek = h.week; notes.push('马库斯在原展廊出口亲自许可本周查验与交接这份残余；旧镜面与原箱许可不被重开。'); }
  if (c.type === 'INVESTIGATE_REMAINS') { item!.holder = 'LOCATED'; item!.investigatedEventId = h.eventId; notes.push('实付120便士查验原失败回执、原瓶编号与现存同一特性，没有把第四独立份改标。'); }
  if (c.type === 'SEAL_ORIGINAL') { item!.holder = 'SEALED_ORIGINAL'; item!.sealedEventId = h.eventId; item!.sealedWeek = h.week; notes.push('在原处封存实际查见的同一残余，封签和原失败结果保留。'); }
  if (c.type === 'ACQUIRE_CHARACTERISTIC') { const supplier = item!.holder === 'SUPPLIER'; item!.holder = 'PLAYER'; item!.acquiredEventId = h.eventId; notes.push(supplier ? `实付${effect.cash}便士取得仍在原供应方的这一份特性，已做有限劳动按原账抵扣。` : '实付30便士回收或提取这份原特性；原耗瓶、伤势和旧失败回执不改写。'); }
  if (c.type === 'VERIFY_CUSTODY') { m.uniqueness.verifiedEventId = h.eventId; m.uniqueness.verifiedWeek = h.week; notes.push('伊妮德亲自展示同一封存原件并准许本周交接。档案记载前任1352年3月24日实际死亡并退出神位，原唯一性与三份末日特性析出；3月25日分别封存交接。她只保管原唯一性，并未容纳；三份原特性对应原供应瓶，原履历不改写。'); }
  if (c.type === 'ACQUIRE_UNIQUENESS') { m.uniqueness.holder = 'PLAYER'; m.uniqueness.acquiredEventId = h.eventId; notes.push('实付150便士完成当前保管交接，同一唯一性成为本人实际持有原物。'); }
  if (c.type === 'BUY_CARRIER') { const carrier = m.carriers.find(x => x.status === 'SUPPLIER')!; carrier.status = 'PLAYER'; carrier.boughtEventId = h.eventId; notes.push('实付50便士购买一份普通调配载体；三件有限载体之外没有免费补货。'); }
  if (c.type === 'COMPOSE') { const carrier = m.carriers.find(x => x.status === 'PLAYER')!; carrier.status = 'SPENT';
    m.compounds.push({ id: `${h.eventId}:compound`, carrierId: carrier.id, status: 'PREPARED', location: h.location, characteristicIds: m.characteristics.map(x => x.id), uniquenessId: m.uniqueness.id, preparedEventId: h.eventId, passageReportEventId: passageReportEventId!, consumedEventId: null, sealedEventId: null, sealedWeek: null, recoveredEventId: null });
    for (const item of m.characteristics) if (item.holder === 'PLAYER') item.holder = 'COMPOUND'; m.uniqueness.holder = 'COMPOUND';
    notes.push('实付40便士调配服务，外部两份原特性与同一唯一性进入成药；第三份仍在本人原身体内，没有先取出或另造一份。'); }
  if (c.type === 'SEAL_REMAINS') { const p = m.compounds.find(x => x.id === c.compoundId)!; p.status = 'FAILED_SEALED'; p.sealedEventId = h.eventId; p.sealedWeek = h.week;
    for (const item of m.characteristics) if (item.holder === 'EXPOSED') item.holder = 'SEALED'; m.uniqueness.holder = 'SEALED'; notes.push('本人在原处封存同一失败残余，无需行动或现款；已耗载体和真实损伤保留。'); }
  if (c.type === 'RECOVER_REMAINS') { const p = m.compounds.find(x => x.id === c.compoundId)!; p.status = 'RECOVERED'; p.recoveredEventId = h.eventId;
    for (const item of m.characteristics) if (item.holder === 'SEALED') { item.holder = 'PLAYER'; item.location = h.location; item.acquiredEventId = h.eventId; }
    m.uniqueness.holder = 'PLAYER'; m.uniqueness.location = h.location; notes.push('跨周后实付60便士取回同一两份原特性和唯一性；本人原S1仍在体内，仍须另购剩余载体和实际重新调配。'); }
  return { state: m, effect, notes };
}
export function transportDemonessMaterials(m: DemonessMaterials, from: DemonessPlace, to: DemonessPlace): void {
  for (const item of m.characteristics) if (['PLAYER', 'COMPOUND'].includes(item.holder) && item.location === from) item.location = to;
  if (['PLAYER', 'COMPOUND'].includes(m.uniqueness.holder) && m.uniqueness.location === from) m.uniqueness.location = to;
  for (const p of m.compounds) if (p.status === 'PREPARED' && p.location === from) p.location = to;
}
export function settleDemonessConsumption(m: DemonessMaterials, compoundId: string, h: DemonessHost, success: boolean, alive: boolean): void {
  const p = m.compounds.find(x => x.id === compoundId)!; p.consumedEventId = h.eventId; p.status = success ? 'SUCCESS' : alive ? 'FAILED_EXPOSED' : 'DEATH_EXPOSED'; p.location = h.location;
  for (const item of m.characteristics) {
    if (success) { item.holder = 'FUSED'; item.location = null; }
    else if (!alive || item.holder !== 'EMBODIED') { item.holder = 'EXPOSED'; item.location = h.location; }
  }
  m.uniqueness.holder = success ? 'FUSED' : 'EXPOSED'; m.uniqueness.location = success ? null : h.location;
}
export function preserveDemonessDeathResidue(m: DemonessMaterials, location: DemonessPlace): void {
  // Death is terminal. Expose only the same already-owned original identities.
  for (const item of m.characteristics) if (['EMBODIED', 'FUSED', 'PLAYER', 'COMPOUND'].includes(item.holder)) { item.holder = 'EXPOSED'; item.location = location; }
  if (['FUSED', 'PLAYER', 'COMPOUND'].includes(m.uniqueness.holder)) { m.uniqueness.holder = 'EXPOSED'; m.uniqueness.location = location; }
  for (const p of m.compounds) if (p.status === 'SUCCESS' || p.status === 'PREPARED') { p.status = 'DEATH_EXPOSED'; p.location = location; }
}
