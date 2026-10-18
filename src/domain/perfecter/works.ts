import { stableStringify } from '../canonical.js';
import { emptyPerfecterEffect, type PerfecterEffect, type PerfecterHost, type PerfecterModuleResult } from './ports.js';
import type { PerfecterEpilogueOrigin } from './epilogue.js';
import { PERFECTER_ARCHIVE_RESIDENTS, PERFECTER_WORKS_STATIONS, PERFECTER_WORKS_STATION_IDS,
  WORKS_LOCATIONS, type PerfecterWorksStationId } from './works-content.js';
export { WORKS_LOCATIONS, PERFECTER_WORKS_LOCATIONS, WORKS_STATIONS, PERFECTER_WORKS_STATIONS } from './works-content.js';
export type { PerfecterWorksStationId } from './works-content.js';
export type PerfecterWorksCommand = { type: 'WORKS_TRAVEL' | 'WORKS_INSPECT' | 'WORKS_BUY_PARTS' | 'WORKS_REPAIR' | 'WORKS_CALIBRATE' | 'WORKS_TRIAL' | 'WORKS_VERIFY'; stationId: PerfecterWorksStationId };
export interface PerfecterWorksOperation {
  recordId: string; apparatusId: string; operatorId: string; week: number;
  kind: 'TRIAL' | 'SERVICE'; cycles: number; consumedStock: number;
  residents: string[]; result: string;
}
export interface PerfecterWorksStation {
  id: PerfecterWorksStationId; apparatusId: string; owner: 'MUNICIPAL'; operatorId: string; originalRecordId: string;
  durability: number; inspectedWeek: number | null; repairedWeek: number | null; calibratedWeek: number | null;
  trialWeek: number | null; verifiedWeek: number | null;
  supplierStock: number; purchasedParts: number; partsStock: number; installedParts: number;
  serviceStock: number; operations: PerfecterWorksOperation[]; receipts: string[];
}
export interface PerfecterWorksReceipt {
  id: string; actorId: string; revision: number; week: number; command: PerfecterWorksCommand;
  effect: PerfecterEffect; notes: string[];
}
export interface PerfecterWorksState {
  version: 1; runId: string; startWeek: number; week: number; actorId: string | null;
  stations: PerfecterWorksStation[]; journal: PerfecterWorksReceipt[]; epilogueOrigin: PerfecterEpilogueOrigin;
}
export interface PerfecterWorksAction { id: string; label: string; command: PerfecterWorksCommand; enabled: boolean; reason: string | null; cost: PerfecterEffect }
const definition = (id: PerfecterWorksStationId) => PERFECTER_WORKS_STATIONS.find(s => s.id === id)!;
const stationAt = (s: PerfecterWorksState, id: PerfecterWorksStationId) => s.stations.find(st => st.id === id)!;
const integer = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const keys = (v: Record<string, unknown>, expected: string[]) => Object.keys(v).length === expected.length && expected.every(k => Object.hasOwn(v, k));
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 400;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const commandTypes = ['WORKS_TRAVEL', 'WORKS_INSPECT', 'WORKS_BUY_PARTS', 'WORKS_REPAIR', 'WORKS_CALIBRATE', 'WORKS_TRIAL', 'WORKS_VERIFY'] as const;
export function validatePerfecterWorksCommand(v: unknown): v is PerfecterWorksCommand {
  return record(v) && keys(v, ['type', 'stationId']) && commandTypes.includes(v.type as PerfecterWorksCommand['type']) && PERFECTER_WORKS_STATION_IDS.includes(v.stationId as PerfecterWorksStationId);
}
function originFor(stations: PerfecterWorksStation[]): PerfecterEpilogueOrigin {
  const archive = stations.find(s => s.id === 'ARCHIVE')!;
  return {
    id: 'backlund:old-archive-overflow', location: WORKS_LOCATIONS.ARCHIVE,
    operators: PERFECTER_WORKS_STATIONS.map(s => ({ id: s.operatorId, name: s.operator, age: s.operatorAge })),
    patients: PERFECTER_ARCHIVE_RESIDENTS.map(p => ({ ...p })),
    apparatus: { id: archive.apparatusId, title: '旧市政档案馆纸带检索机', durability: archive.durability,
      modelId: 'BC-ARC-17:measured-feed-model', modelVerified: archive.verifiedWeek !== null, supplierPartsStock: archive.supplierStock },
    objects: [
      { id: archive.apparatusId, title: '旧市政档案馆纸带检索机' },
      { id: 'BC-ARC-17:secondary-feed', title: '待修的封闭副送纸口' },
      { id: 'archive-original-stretcher', title: '馆内救护担架' },
      { id: 'archive-original-shutoff', title: '副送纸口机械隔离闸' },
    ],
    flow: { id: 'archive-index-feedback', title: '副送纸口溢出的目录回送信息',
      sourceObjectId: 'BC-ARC-17:secondary-feed', totalUnits: 6, status: 'ISOLATED_PENDING' },
  };
}
export function createPerfecterWorks(runId: string, startWeek: number): PerfecterWorksState {
  if (!text(runId) || !integer(startWeek, 1) || startWeek > Number.MAX_SAFE_INTEGER - 100) throw new TypeError('Invalid civic works origin.');
  const stations: PerfecterWorksStation[] = PERFECTER_WORKS_STATIONS.map(d => ({ id: d.id, apparatusId: d.apparatusId,
    owner: 'MUNICIPAL', operatorId: d.operatorId, originalRecordId: d.recordId, durability: d.initialDurability,
    inspectedWeek: null, repairedWeek: null, calibratedWeek: null, trialWeek: null, verifiedWeek: null,
    supplierStock: d.stock, purchasedParts: 0, partsStock: 0, installedParts: 0,
    serviceStock: d.serviceStock, operations: [], receipts: [] }));
  return { version: 1, runId, startWeek, week: startWeek, actorId: null, stations, journal: [], epilogueOrigin: originFor(stations) };
}
function operationFor(station: PerfecterWorksStation, index: number): PerfecterWorksOperation {
  const d = definition(station.id);
  return { recordId: `${d.recordId}:service-${index + 1}`, apparatusId: d.apparatusId, operatorId: d.operatorId,
    week: station.trialWeek! + index, kind: index === 0 ? 'TRIAL' : 'SERVICE', cycles: 2, consumedStock: 1,
    residents: [...d.residents.slice(index * 2, index * 2 + 2)], result: `${d.function}；两名登记居民实际收到服务。` };
}
/** Local whitelists and conservation checks supplement the central owned
 * journal replay. No raw host, seed or check receipt is copied into this state. */
export function validatePerfecterWorksState(v: unknown): v is PerfecterWorksState {
  try {
    if (!record(v) || !keys(v, ['version', 'runId', 'startWeek', 'week', 'actorId', 'stations', 'journal', 'epilogueOrigin'])) return false;
    const s = v as unknown as PerfecterWorksState;
    if (s.version !== 1 || !text(s.runId) || !integer(s.startWeek, 1) || !integer(s.week, s.startWeek) || (s.actorId !== null && !text(s.actorId)) || !Array.isArray(s.stations) || s.stations.length !== 3 || !Array.isArray(s.journal) || s.journal.length > 256) return false;
    const ids = new Set<string>(); let revision = -1, week = s.startWeek;
    for (const r of s.journal) {
      if (!record(r) || !keys(r, ['id', 'actorId', 'revision', 'week', 'command', 'effect', 'notes']) || !text(r.id) || ids.has(r.id) || r.actorId !== s.actorId || !integer(r.revision, revision + 1) || !integer(r.week, week) || r.week > s.week || !validatePerfecterWorksCommand(r.command)) return false;
      if (!record(r.effect) || !keys(r.effect, ['cashCost', 'cashGain', 'actions', 'spirituality', 'mind', 'health', 'weeks', 'toLocation']) || !['cashCost', 'cashGain', 'actions', 'spirituality', 'mind', 'health', 'weeks'].every(k => integer((r.effect as unknown as Record<string, unknown>)[k])) || !same(r.effect, costFor(r.command))) return false;
      if (!Array.isArray(r.notes) || !r.notes.every(text)) return false;
      ids.add(r.id); revision = r.revision; week = r.week;
    }
    if ((s.journal.length === 0) !== (s.actorId === null)) return false;
    for (let index = 0; index < s.stations.length; index++) {
      const st = s.stations[index]!, d = PERFECTER_WORKS_STATIONS[index]!;
      if (!record(st) || !keys(st, ['id', 'apparatusId', 'owner', 'operatorId', 'originalRecordId', 'durability', 'inspectedWeek', 'repairedWeek', 'calibratedWeek', 'trialWeek', 'verifiedWeek', 'supplierStock', 'purchasedParts', 'partsStock', 'installedParts', 'serviceStock', 'operations', 'receipts']) || st.id !== d.id || st.apparatusId !== d.apparatusId || st.owner !== 'MUNICIPAL' || st.operatorId !== d.operatorId || st.originalRecordId !== d.recordId) return false;
      if (![st.durability, st.supplierStock, st.purchasedParts, st.partsStock, st.installedParts, st.serviceStock].every(n => integer(n)) || st.durability > 100 || st.supplierStock + st.purchasedParts !== d.stock || st.partsStock + st.installedParts !== st.purchasedParts) return false;
      if (!Array.isArray(st.receipts) || new Set(st.receipts).size !== st.receipts.length || !Array.isArray(st.operations) || st.operations.length > 3) return false;
      const events = s.journal.filter(r => r.command.stationId === st.id && r.command.type !== 'WORKS_TRAVEL');
      if (!same(st.receipts, events.map(r => r.id))) return false;
      const eventFor = (type: PerfecterWorksCommand['type']) => events.filter(r => r.command.type === type);
      for (const [field, type] of [['inspectedWeek', 'WORKS_INSPECT'], ['repairedWeek', 'WORKS_REPAIR'], ['calibratedWeek', 'WORKS_CALIBRATE'], ['trialWeek', 'WORKS_TRIAL'], ['verifiedWeek', 'WORKS_VERIFY']] as const) {
        const eventsOfType = eventFor(type);
        if (eventsOfType.length > 1 || st[field] !== (eventsOfType[0]?.week ?? null)) return false;
      }
      const purchases = eventFor('WORKS_BUY_PARTS');
      if (purchases.length > 1 || st.purchasedParts !== purchases.length * 3) return false;
      const stageTypes = ['WORKS_INSPECT', 'WORKS_BUY_PARTS', 'WORKS_REPAIR', 'WORKS_CALIBRATE', 'WORKS_TRIAL', 'WORKS_VERIFY'];
      if (!events.every((r, i) => r.command.type === stageTypes[i])) return false;
      if (st.installedParts !== (st.repairedWeek === null ? 0 : 2) + (st.calibratedWeek === null ? 0 : 1)) return false;
      const expectedOperations = st.trialWeek === null ? 0 : Math.min(3, s.week - st.trialWeek + 1);
      if (st.operations.length !== expectedOperations || st.serviceStock + st.operations.length !== d.serviceStock || st.operations.some((op, i) => !same(op, operationFor(st, i)))) return false;
      const expectedDurability = (st.calibratedWeek !== null ? 98 : st.repairedWeek !== null ? 92 : d.initialDurability) - st.operations.length * 2;
      if (st.durability !== expectedDurability || (st.verifiedWeek !== null && (st.trialWeek === null || st.verifiedWeek < st.trialWeek + 2 || st.verifiedWeek > s.week || st.operations.length !== 3))) return false;
    }
    return same(s.epilogueOrigin, originFor(s.stations));
  } catch { return false; }
}
const assertState = (s: PerfecterWorksState): void => { if (!validatePerfecterWorksState(s)) throw new TypeError('Invalid civic works state or material conservation.'); };
/** Independent adult operators carry out two already assigned, finite service
 * batches over actual weeks. VERIFY only reads their existing paper results. */
export function advancePerfecterWorks(state: PerfecterWorksState, toWeek: number): PerfecterWorksState {
  assertState(state);
  if (!integer(toWeek, state.week)) throw new RangeError('Civic works time cannot move backwards.');
  const next = structuredClone(state); next.week = toWeek;
  for (const st of next.stations) {
    if (st.trialWeek === null) continue;
    const target = Math.min(3, toWeek - st.trialWeek + 1);
    while (st.operations.length < target) {
      st.operations.push(operationFor(st, st.operations.length)); st.serviceStock--; st.durability -= 2;
    }
  }
  next.epilogueOrigin = originFor(next.stations); assertState(next); return next;
}
function costFor(command: PerfecterWorksCommand): PerfecterEffect {
  const effect = emptyPerfecterEffect(); effect.actions = 1;
  if (command.type === 'WORKS_TRAVEL') { effect.cashCost = 2; effect.toLocation = WORKS_LOCATIONS[command.stationId]; }
  if (command.type === 'WORKS_BUY_PARTS') effect.cashCost = 9;
  if (command.type === 'WORKS_REPAIR') effect.cashCost = 6;
  if (command.type === 'WORKS_CALIBRATE') effect.cashCost = 3;
  return effect;
}
export function perfecterWorksBlock(state: PerfecterWorksState, command: PerfecterWorksCommand, host: PerfecterHost): string | null {
  if (!validatePerfecterWorksCommand(command)) return '这项维修行动或地点无效。';
  if (!validatePerfecterWorksState(state)) return '维修实物、原账与服务记录不一致。';
  if (!text(host.eventId) || !text(host.actorId) || !integer(host.revision) || !integer(host.week, state.week) || ![host.cash, host.actions, host.health, host.mind, host.spirituality].every(n => integer(n))) return '行动来源或现有资源无效。';
  if (host.status !== 'ACTIVE' || host.health <= 0 || host.mind <= 0 || (host.sequence !== 1 && !(host.sequence === 0 && command.type === 'WORKS_TRAVEL'))) return '须由仍然存活、清醒的本人处理当前维修。';
  if (state.actorId !== null && state.actorId !== host.actorId) return '本次工程属于先前接手的同一人。';
  if (state.journal.some(r => r.id === host.eventId) || (state.journal.at(-1)?.revision ?? -1) >= host.revision) return '此行动已结算或行动次序已过期。';
  if (state.journal.length >= 256) return '本次维修行动记录已满。';
  if (host.check !== null) return '普通维修不需要随机结果。';
  const now = advancePerfecterWorks(state, host.week), st = stationAt(now, command.stationId), d = definition(st.id), cost = costFor(command);
  if (host.actions < cost.actions) return '需要一次行动；可以先休息到下周。';
  if (host.cash < cost.cashCost) return `需要实际支付${cost.cashCost}便士，可以回城完成本职工作筹款。`;
  if (command.type === 'WORKS_TRAVEL') return host.location === WORKS_LOCATIONS[st.id] ? '你已经在这里。' : null;
  if (host.location !== WORKS_LOCATIONS[st.id]) return `须亲自到达${d.name}，现场检查实物。`;
  if (command.type === 'WORKS_INSPECT') return st.inspectedWeek !== null ? '已核对这台装置的原维修册与故障。' : null;
  if (st.inspectedWeek === null) return '先查阅原维修册，并与值班员一起检查损坏的实物。';
  if (command.type === 'WORKS_BUY_PARTS') return st.purchasedParts > 0 ? '本次所需的三份零件已经付费领取。' : st.supplierStock < 3 ? '现存适配零件不足，不能凭账目补出。' : null;
  if (command.type === 'WORKS_REPAIR') return st.repairedWeek !== null ? '本次实际修复已经完成。' : st.partsStock < 2 ? '先购买适配的现存零件；修复需要两份。' : null;
  if (command.type === 'WORKS_CALIBRATE') return st.repairedWeek === null ? '先实际拆换损坏部件。' : st.calibratedWeek !== null ? '刻度与限位已经实际校准。' : st.partsStock < 1 ? '校准还需要一份已购买的垫片与封签。' : null;
  if (command.type === 'WORKS_TRIAL') return st.calibratedWeek === null ? '先按原记录完成实际校准。' : st.trialWeek !== null ? '值班员已经完成本次试用，后续服务按原班表继续。' : null;
  if (st.verifiedWeek !== null) return '三次实际运行及居民结果已经核验，记录仍然有效。';
  if (st.trialWeek === null) return '先让原值班员亲自试用修好的装置。';
  if (host.week < st.trialWeek + 2) return `还需等到第${st.trialWeek + 2}周，再查验两周实际服务的原记录。`;
  return st.operations.length === 3 && st.durability >= 80 ? null : '实际功能与居民领取记录尚未齐全。';
}
export function perfecterWorksChallenge(_state: PerfecterWorksState, _command: PerfecterWorksCommand): { difficulty: number; bonus: number } | null { return null; }
export function applyPerfecterWorks(state: PerfecterWorksState, command: PerfecterWorksCommand, host: PerfecterHost): PerfecterModuleResult<PerfecterWorksState> {
  const reason = perfecterWorksBlock(state, command, host); if (reason) throw new Error(reason);
  const next = advancePerfecterWorks(state, host.week), st = stationAt(next, command.stationId), d = definition(st.id), effect = costFor(command), notes: string[] = [];
  next.actorId = host.actorId;
  if (command.type === 'WORKS_TRAVEL') notes.push(`花费2便士乘车到达${d.name}，准备当面检查设备。`);
  else {
    st.receipts.push(host.eventId);
    if (command.type === 'WORKS_INSPECT') {
      st.inspectedWeek = host.week;
      notes.push(`${d.operator}打开原维修册，与你核对${d.apparatus}的编号和现存零件。${d.defect}这台装置属于市政设施，由${d.operatorAge}岁的原值班员操作。`);
      if (st.id === 'ARCHIVE') notes.push('艾琳与乔纳斯等六名成年居民正在等待住址证明；腕伤与腿伤仍需照护。副送纸口另有封闭待修的目录回送故障，隔离闸和馆内担架都在原处。');
    } else if (command.type === 'WORKS_BUY_PARTS') {
      st.supplierStock -= 3; st.purchasedParts += 3; st.partsStock += 3;
      notes.push(`支付9便士，从已清点的六份适配零件中领取三份，剩余${st.supplierStock}份仍由保管员保存。`);
    } else if (command.type === 'WORKS_REPAIR') {
      st.partsStock -= 2; st.installedParts += 2; st.repairedWeek = host.week; st.durability = 92;
      notes.push(`支付6便士工料费，${d.repair}；两份实物零件已装入这台设备，耐久恢复到92。`);
    } else if (command.type === 'WORKS_CALIBRATE') {
      st.partsStock--; st.installedParts++; st.calibratedWeek = host.week; st.durability = 98;
      notes.push(`支付3便士并用掉最后一份垫片与封签，${d.calibration}。校准后的耐久为98，尚须由原值班员实际试用。`);
    } else if (command.type === 'WORKS_TRIAL') {
      st.trialWeek = host.week; st.operations.push(operationFor(st, 0)); st.serviceStock--; st.durability -= 2;
      notes.push(`${d.operator}亲自操作${d.apparatus}完成两次实际作业：${d.function}，两名登记居民收到服务。消耗一批原耗材，耐久降到${st.durability}；余下两批将按既有班表在随后两周使用。`);
    } else {
      st.verifiedWeek = host.week;
      notes.push(`你当面核对第${st.trialWeek}至${st.trialWeek! + 2}周的三张作业单、实际装置和六名居民的领取回执。${d.outcome}。两周后的功能仍正常，耐久为${st.durability}，原耗材已用完；没有把签字本身当成运行。`);
    }
  }
  next.journal.push({ id: host.eventId, actorId: host.actorId, revision: host.revision, week: host.week,
    command: structuredClone(command), effect: { ...effect }, notes: [...notes] });
  next.epilogueOrigin = originFor(next.stations); assertState(next); return { state: next, effect, notes };
}
export function derivePerfecterWorksWindow(state: PerfecterWorksState, host: PerfecterHost): { id: string; startWeek: number; endWeek: number; receipts: string[] } | null {
  if (!validatePerfecterWorksState(state) || !integer(host.week, state.week) || host.status !== 'ACTIVE' || host.sequence !== 1 || host.actorId !== state.actorId || host.health <= 0 || host.mind <= 0) return null;
  const now = advancePerfecterWorks(state, host.week);
  if (now.stations.some(st => st.verifiedWeek === null || st.operations.length !== 3 || st.durability < 80)) return null;
  return { id: `${state.runId}:three-station-service-proof`, startWeek: Math.max(...now.stations.map(st => st.verifiedWeek!)),
    endWeek: Number.MAX_SAFE_INTEGER, receipts: now.stations.flatMap(st => [...st.receipts, ...st.operations.map(op => op.recordId)]) };
}
export const getPerfecterQualifyingWindow = derivePerfecterWorksWindow;
export function getPerfecterWorksActions(state: PerfecterWorksState, host: PerfecterHost): PerfecterWorksAction[] {
  const choices = [['WORKS_TRAVEL', '前往现场'], ['WORKS_INSPECT', '查阅原账并检查故障'], ['WORKS_BUY_PARTS', '购买三份适配零件'], ['WORKS_REPAIR', '实际拆换并修复'], ['WORKS_CALIBRATE', '对照原刻度校准'], ['WORKS_TRIAL', '请原值班员实际试用'], ['WORKS_VERIFY', '核验两周实际功能与居民结果']] as const;
  return PERFECTER_WORKS_STATIONS.flatMap(d => choices.map(([type, label]) => {
    const command: PerfecterWorksCommand = { type, stationId: d.id }, reason = perfecterWorksBlock(state, command, host);
    return { id: `works:${d.id}:${type}`, label: `${d.name}：${label}`, command, enabled: reason === null, reason, cost: costFor(command) };
  }));
}
export function projectPerfecterWorks(state: PerfecterWorksState): { story: string; nextStep: string; lines: string[] } {
  assertState(state);
  const next = state.stations.find(st => st.verifiedWeek === null), d = next ? definition(next.id) : null;
  const nextStep = !next ? '三处设备都留下了两周真实运行和居民结果，准备条件持续有效；可继续完成本人的配药与稳定准备。'
    : next.inspectedWeek === null ? `前往${d!.name}，查看原维修册并检查实物故障。`
    : next.purchasedParts === 0 ? `向${d!.name}保管员购买三份现存适配零件。`
    : next.repairedWeek === null ? `在${d!.name}实际拆换损坏部件。`
    : next.calibratedWeek === null ? `用${d!.name}的原刻度与参照物校准设备。`
    : next.trialWeek === null ? `让${d!.operator}独立操作修好的设备，完成真实服务。`
    : state.week < next.trialWeek + 2 ? `等到第${next.trialWeek + 2}周，再去${d!.name}检查按班表留下的实际服务记录。`
    : `回到${d!.name}，当面核验装置、作业单和居民领取回执。`;
  return { story: state.journal.at(-1)?.notes.join(' ') ?? '1353年的贝克兰德，三处公共设施因小故障停摆。原值班员、维修册、有限零件与等待服务的成年居民都还在，修复从查清实物开始。', nextStep,
    lines: state.stations.flatMap(st => {
      const def = definition(st.id);
      return [`${def.name}：${def.apparatus}，市政所有，${def.operator}（${def.operatorAge}岁）值守；${st.verifiedWeek === null ? '当前维修耐久' : '验收时耐久'}${st.durability}。`,
        `适配零件：保管员余${st.supplierStock}份，已购${st.purchasedParts}份，待用${st.partsStock}份，已装入${st.installedParts}份；原服务耗材余${st.serviceStock}批。`,
        `实际作业${st.operations.length}/3批，已服务${st.operations.reduce((sum, op) => sum + op.residents.length, 0)}/6名登记居民；${st.verifiedWeek === null ? '尚未完成两周后现场核验' : `第${st.verifiedWeek}周已核验`}。`,
        ...st.operations.map(op => `第${op.week}周${op.kind === 'TRIAL' ? '试用' : '值班作业'}：${def.operator}完成${op.cycles}次，消耗${op.consumedStock}批耗材。${op.result}`)];
    }) };
}
