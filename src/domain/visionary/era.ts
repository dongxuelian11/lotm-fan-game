import { emptyVisionaryEffect, type VisionaryEffect, type VisionaryHost, type VisionaryModuleResult } from './ports.js';
import {
  VISIONARY_ERA_CITIES, VISIONARY_ERA_CITY_IDS, VISIONARY_ERA_GOVERNMENTS,
  VISIONARY_ERA_GOVERNMENT_IDS, VISIONARY_ERA_INCIDENTS, VISIONARY_ERA_LOCATIONS,
  VISIONARY_ERA_NODE_IDS, VISIONARY_ERA_QUARTER_OFFSETS,
  type VisionaryEraCityId, type VisionaryEraGovernmentId, type VisionaryEraIncidentId, type VisionaryEraNodeId,
} from './era-content.js';
export { VISIONARY_ERA_LOCATIONS } from './era-content.js';
export type { VisionaryEraCityId, VisionaryEraGovernmentId, VisionaryEraIncidentId, VisionaryEraNodeId } from './era-content.js';

export type VisionaryEraCommand =
  | { type: 'ERA_SURVEY' | 'ERA_PILOT' | 'ERA_CONNECT' | 'ERA_REPAIR' | 'ERA_TRAVEL'; cityId: VisionaryEraCityId }
  | { type: 'ERA_FORECAST'; plan: 'PUBLIC_RELAY' }
  | { type: 'ERA_ADOPT'; governmentId: VisionaryEraGovernmentId }
  | { type: 'ERA_RESPOND'; incidentId: VisionaryEraIncidentId; mode: 'COORDINATED' | 'ORDINARY' }
  | { type: 'ERA_VERIFY'; nodeId: VisionaryEraNodeId };
export interface VisionaryEraCity {
  id: VisionaryEraCityId; surveyed: boolean; pilot: boolean; connected: boolean; facility: number;
  staffAssigned: number; stock: number; supplied: number; spoiled: number;
  residentsSafe: number; residentsDisplaced: number; residentsDeparted: number;
  receipts: string[];
}
export interface VisionaryEraGovernment {
  id: VisionaryEraGovernmentId; budget: number; spent: number; adopted: boolean; adoptedReceipt: string | null;
}
export interface VisionaryEraIncident {
  id: VisionaryEraIncidentId; phase: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'RESOLVED';
  releaseWeek: number; deadlineWeek: number; assisted: number; departed: number; delivered: number;
  resolution: 'COORDINATED' | 'ORDINARY' | null; resolvedWeek: number | null; receipt: string | null;
}
export interface VisionaryEraNode {
  id: VisionaryEraNodeId; startWeek: number; endWeek: number; verifiedReceipt: string | null; verifiedWeek: number | null;
}
export interface VisionaryEraReceipt {
  id: string; actorId: string; revision: number; week: number; command: VisionaryEraCommand;
  effect: VisionaryEffect; governmentSpend: { id: VisionaryEraGovernmentId; amount: number }[]; notes: string[];
}
export interface VisionaryEraEpilogueOrigin {
  id: 'tingen:west-relay-fault'; location: 'tingen:relay-station';
  rescuers: { id: string; name: string; age: number; status: string }[];
  patients: { id: string; name: string; age: number; injury: string; status: string }[];
  objects: { id: string; title: string; status: string }[];
}
export interface VisionaryEraState {
  version: 1; runId: string; startWeek: number; week: number; actorId: string | null;
  governments: VisionaryEraGovernment[]; cities: VisionaryEraCity[]; incidents: VisionaryEraIncident[]; nodes: VisionaryEraNode[];
  forecast: { plan: 'PUBLIC_RELAY'; week: number; receipt: string; minimumStations: 5; governments: VisionaryEraGovernmentId[]; rounds: 2 } | null;
  journal: VisionaryEraReceipt[]; messages: { id: string; week: number; text: string }[];
  epilogueOrigin: VisionaryEraEpilogueOrigin;
}
export interface VisionaryEraAction { id: string; label: string; command: VisionaryEraCommand; enabled: boolean; reason: string | null; cost: VisionaryEffect }
const cityDef = (id: VisionaryEraCityId) => VISIONARY_ERA_CITIES.find(city => city.id === id)!;
const incidentDef = (id: VisionaryEraIncidentId) => VISIONARY_ERA_INCIDENTS.find(incident => incident.id === id)!;
const cityAt = (state: VisionaryEraState, id: VisionaryEraCityId) => state.cities.find(city => city.id === id)!;
const governmentAt = (state: VisionaryEraState, id: VisionaryEraGovernmentId) => state.governments.find(government => government.id === id)!;
const operational = (city: VisionaryEraCity) => city.connected && city.pilot && city.staffAssigned === 2 && city.facility >= 60;
const integer = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const includes = (list: readonly string[], value: unknown): value is string => typeof value === 'string' && list.includes(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 400;

export function validateVisionaryEraCommand(value: unknown): value is VisionaryEraCommand {
  if (!record(value) || typeof value.type !== 'string') return false;
  if (['ERA_SURVEY', 'ERA_PILOT', 'ERA_CONNECT', 'ERA_REPAIR', 'ERA_TRAVEL'].includes(value.type))
    return keys(value, ['type', 'cityId']) && includes(VISIONARY_ERA_CITY_IDS, value.cityId);
  if (value.type === 'ERA_FORECAST') return keys(value, ['type', 'plan']) && value.plan === 'PUBLIC_RELAY';
  if (value.type === 'ERA_ADOPT') return keys(value, ['type', 'governmentId']) && includes(VISIONARY_ERA_GOVERNMENT_IDS, value.governmentId);
  if (value.type === 'ERA_RESPOND') return keys(value, ['type', 'incidentId', 'mode']) && includes(VISIONARY_ERA_INCIDENTS.map(item => item.id), value.incidentId) && (value.mode === 'COORDINATED' || value.mode === 'ORDINARY');
  return value.type === 'ERA_VERIFY' && keys(value, ['type', 'nodeId']) && includes(VISIONARY_ERA_NODE_IDS, value.nodeId);
}
function createEpilogueOrigin(): VisionaryEraEpilogueOrigin {
  return {
    id: 'tingen:west-relay-fault', location: 'tingen:relay-station',
    rescuers: [
      { id: 'era-rescuer-oswin', name: '奥斯温·莱特', age: 37, status: 'STANDING_BY' },
      { id: 'era-rescuer-clara', name: '克拉拉·里德', age: 32, status: 'STANDING_BY' },
    ],
    patients: [
      { id: 'era-patient-martin', name: '马丁·维尔', age: 46, injury: '原西室检修事故留下的腿伤', status: 'STABLE' },
      { id: 'era-patient-elsa', name: '艾尔莎·弗林', age: 29, injury: '原西室检修事故留下的肩伤', status: 'STABLE' },
    ],
    objects: [
      { id: 'era-west-beam', title: '原西室松动支梁', status: 'ISOLATED' },
      { id: 'era-west-stretcher', title: '原救援担架', status: 'STORED' },
      { id: 'era-west-junction', title: '原西室断线接线箱', status: 'DISCONNECTED' },
    ],
  };
}
export function createVisionaryEra(runId: string, startWeek: number): VisionaryEraState {
  if (!text(runId) || !integer(startWeek, 1) || startWeek > Number.MAX_SAFE_INTEGER - 100) throw new TypeError('Invalid era origin.');
  const nodes: VisionaryEraNode[] = VISIONARY_ERA_QUARTER_OFFSETS.map((offset, index) => ({ id: VISIONARY_ERA_NODE_IDS[index]!, startWeek: startWeek + offset, endWeek: startWeek + offset + 1, verifiedReceipt: null, verifiedWeek: null }));
  return {
    version: 1, runId, startWeek, week: startWeek, actorId: null,
    governments: VISIONARY_ERA_GOVERNMENTS.map(item => ({ id: item.id, budget: item.budget, spent: 0, adopted: false, adoptedReceipt: null })),
    cities: VISIONARY_ERA_CITIES.map(item => ({ id: item.id, surveyed: false, pilot: false, connected: false, facility: 100, staffAssigned: 0, stock: item.stock, supplied: 0, spoiled: 0, residentsSafe: item.population, residentsDisplaced: 0, residentsDeparted: 0, receipts: [] })),
    incidents: VISIONARY_ERA_INCIDENTS.map(item => ({ id: item.id, phase: 'PENDING', releaseWeek: nodes[item.node]!.startWeek - (item.round === 1 ? 7 : 3), deadlineWeek: nodes[item.node]!.startWeek - (item.round === 1 ? 4 : 0), assisted: 0, departed: 0, delivered: 0, resolution: null, resolvedWeek: null, receipt: null })),
    nodes, forecast: null, journal: [], epilogueOrigin: createEpilogueOrigin(),
    messages: [{ id: 'opening', week: startWeek, text: '四方原值班所继续各自收报。人员、库存与居民名册已经存在；原制度只报本地，无权互相调拨。四次季度会期已预定，廷根封闭西室的旧故障也在维修册中。' }],
  };
}

/** Cheap local invariants. The owned engine, not this module, authenticates every
 * journal host and replays the whole campaign exactly once. */
export function validateVisionaryEraState(value: unknown): value is VisionaryEraState {
  try {
    if (!record(value) || !keys(value, ['version', 'runId', 'startWeek', 'week', 'actorId', 'governments', 'cities', 'incidents', 'nodes', 'forecast', 'journal', 'messages', 'epilogueOrigin'])) return false;
    const state = value as unknown as VisionaryEraState;
    if (state.version !== 1 || !text(state.runId) || !integer(state.startWeek, 1) || !integer(state.week, state.startWeek) || (state.actorId !== null && !text(state.actorId))) return false;
    if (!Array.isArray(state.journal) || state.journal.length > 256 || !Array.isArray(state.cities) || state.cities.length !== 6 || !Array.isArray(state.governments) || state.governments.length !== 4 || !Array.isArray(state.incidents) || state.incidents.length !== 8 || !Array.isArray(state.nodes) || state.nodes.length !== 4) return false;
    const ids = new Set<string>(); let lastRevision = -1; let lastWeek = state.startWeek;
    for (const receipt of state.journal) {
      if (!record(receipt) || !keys(receipt, ['id', 'actorId', 'revision', 'week', 'command', 'effect', 'governmentSpend', 'notes']) || !text(receipt.id) || ids.has(receipt.id) || receipt.actorId !== state.actorId || !integer(receipt.revision, lastRevision + 1) || !integer(receipt.week, lastWeek) || receipt.week > state.week || !validateVisionaryEraCommand(receipt.command)) return false;
      if (!record(receipt.effect) || !keys(receipt.effect, ['cashCost', 'cashGain', 'actions', 'spirituality', 'mind', 'health', 'weeks', 'toLocation']) || !['cashCost', 'cashGain', 'actions', 'spirituality', 'mind', 'health', 'weeks'].every(key => integer((receipt.effect as unknown as Record<string, unknown>)[key])) || receipt.effect.cashGain !== 0 || (receipt.effect.toLocation !== null && !Object.values(VISIONARY_ERA_LOCATIONS).includes(receipt.effect.toLocation))) return false;
      if (!Array.isArray(receipt.governmentSpend) || receipt.governmentSpend.some(item => !record(item) || !keys(item, ['id', 'amount']) || !includes(VISIONARY_ERA_GOVERNMENT_IDS, item.id) || !integer(item.amount, 1)) || !Array.isArray(receipt.notes) || !receipt.notes.every(note => typeof note === 'string')) return false;
      ids.add(receipt.id); lastRevision = receipt.revision; lastWeek = receipt.week;
    }
    if ((state.journal.length === 0) !== (state.actorId === null)) return false;
    for (let index = 0; index < state.governments.length; index++) {
      const government = state.governments[index]!, definition = VISIONARY_ERA_GOVERNMENTS[index]!;
      if (!record(government) || !keys(government, ['id', 'budget', 'spent', 'adopted', 'adoptedReceipt']) || government.id !== definition.id || !integer(government.budget) || !integer(government.spent) || government.budget + government.spent !== definition.budget || typeof government.adopted !== 'boolean' || government.adopted !== (government.adoptedReceipt !== null) || (government.adoptedReceipt !== null && !ids.has(government.adoptedReceipt))) return false;
      if (government.spent !== state.journal.reduce((total, receipt) => total + receipt.governmentSpend.filter(item => item.id === government.id).reduce((amount, item) => amount + item.amount, 0), 0)) return false;
    }
    for (let index = 0; index < state.cities.length; index++) {
      const city = state.cities[index]!, definition = VISIONARY_ERA_CITIES[index]!;
      if (!record(city) || !keys(city, ['id', 'surveyed', 'pilot', 'connected', 'facility', 'staffAssigned', 'stock', 'supplied', 'spoiled', 'residentsSafe', 'residentsDisplaced', 'residentsDeparted', 'receipts']) || city.id !== definition.id || !['surveyed', 'pilot', 'connected'].every(key => typeof (city as unknown as Record<string, unknown>)[key] === 'boolean')) return false;
      if (!['facility', 'staffAssigned', 'stock', 'supplied', 'spoiled', 'residentsSafe', 'residentsDisplaced', 'residentsDeparted'].every(key => integer((city as unknown as Record<string, unknown>)[key])) || city.facility > 100 || city.staffAssigned !== (city.pilot ? 2 : 0) || city.staffAssigned > definition.staff || (city.pilot && !city.surveyed) || (city.connected && !city.pilot)) return false;
      if (city.stock + city.supplied + city.spoiled !== definition.stock || city.residentsSafe + city.residentsDisplaced + city.residentsDeparted !== definition.population || !Array.isArray(city.receipts) || new Set(city.receipts).size !== city.receipts.length || city.receipts.some(id => !ids.has(id))) return false;
    }
    for (let index = 0; index < state.incidents.length; index++) {
      const incident = state.incidents[index]!, definition = VISIONARY_ERA_INCIDENTS[index]!, start = state.startWeek + VISIONARY_ERA_QUARTER_OFFSETS[definition.node]!;
      if (!record(incident) || !keys(incident, ['id', 'phase', 'releaseWeek', 'deadlineWeek', 'assisted', 'departed', 'delivered', 'resolution', 'resolvedWeek', 'receipt']) || incident.id !== definition.id || !includes(['PENDING', 'ACTIVE', 'EXPIRED', 'RESOLVED'], incident.phase) || incident.releaseWeek !== start - (definition.round === 1 ? 7 : 3) || incident.deadlineWeek !== start - (definition.round === 1 ? 4 : 0) || !integer(incident.assisted) || !integer(incident.departed) || !integer(incident.delivered)) return false;
      if (incident.assisted + incident.departed > definition.residents || incident.delivered > definition.supplies || (incident.phase === 'PENDING' && (state.week >= incident.releaseWeek || incident.departed || incident.assisted || incident.delivered)) || (incident.phase !== 'PENDING' && state.week < incident.releaseWeek)) return false;
      if (incident.phase === 'ACTIVE' && state.week > incident.deadlineWeek) return false;
      if (incident.phase === 'RESOLVED') { if (!includes(['COORDINATED', 'ORDINARY'], incident.resolution) || !integer(incident.resolvedWeek, incident.releaseWeek) || incident.resolvedWeek > state.week || !incident.receipt || !ids.has(incident.receipt) || incident.assisted + incident.departed !== definition.residents || incident.delivered !== definition.supplies) return false; }
      else if (incident.resolution !== null || incident.resolvedWeek !== null || incident.receipt !== null || incident.assisted !== 0 || incident.delivered !== 0) return false;
    }
    for (const city of state.cities) {
      const incidents = state.incidents.filter(item => incidentDef(item.id).cityId === city.id);
      if (city.supplied !== incidents.reduce((total, item) => total + item.delivered, 0) || city.residentsDeparted !== incidents.reduce((total, item) => total + item.departed, 0) || city.residentsDisplaced !== incidents.filter(item => item.phase === 'ACTIVE' || item.phase === 'EXPIRED').reduce((total, item) => total + incidentDef(item.id).residents - item.departed, 0)) return false;
    }
    for (let index = 0; index < state.nodes.length; index++) {
      const node = state.nodes[index]!;
      if (!record(node) || !keys(node, ['id', 'startWeek', 'endWeek', 'verifiedReceipt', 'verifiedWeek']) || node.id !== VISIONARY_ERA_NODE_IDS[index] || node.startWeek !== state.startWeek + VISIONARY_ERA_QUARTER_OFFSETS[index]! || node.endWeek !== node.startWeek + 1 || (node.verifiedReceipt === null) !== (node.verifiedWeek === null)) return false;
      if (node.verifiedReceipt !== null && (!ids.has(node.verifiedReceipt) || !integer(node.verifiedWeek, node.startWeek) || node.verifiedWeek > node.endWeek || node.verifiedWeek > state.week)) return false;
    }
    if (state.forecast !== null && (!record(state.forecast) || !keys(state.forecast, ['plan', 'week', 'receipt', 'minimumStations', 'governments', 'rounds']) || state.forecast.plan !== 'PUBLIC_RELAY' || state.forecast.minimumStations !== 5 || state.forecast.rounds !== 2 || !integer(state.forecast.week, state.startWeek) || state.forecast.week >= state.incidents[6]!.releaseWeek || !ids.has(state.forecast.receipt) || JSON.stringify(state.forecast.governments) !== JSON.stringify(VISIONARY_ERA_GOVERNMENT_IDS))) return false;
    if (!Array.isArray(state.messages) || state.messages.length > 40 || new Set(state.messages.map(message => message.id)).size !== state.messages.length || state.messages.some(message => !record(message) || !keys(message, ['id', 'week', 'text']) || !text(message.id) || !integer(message.week, state.startWeek) || message.week > state.week || !text(message.text))) return false;
    return JSON.stringify(state.epilogueOrigin) === JSON.stringify(createEpilogueOrigin());
  } catch { return false; }
}
function assertState(state: VisionaryEraState): void { if (!validateVisionaryEraState(state)) throw new TypeError('Invalid era state or conservation proof.'); }
function addMessage(state: VisionaryEraState, id: string, week: number, message: string): void { state.messages.push({ id, week, text: message }); }

/** Time advances the original world even if the player does nothing. No retry,
 * season switch or sleep restores lost supplies or departed residents. */
export function advanceVisionaryEra(state: VisionaryEraState, toWeek: number): VisionaryEraState {
  assertState(state);
  if (!integer(toWeek, state.week)) throw new RangeError('Era time cannot move backwards.');
  const next = structuredClone(state); next.week = toWeek;
  for (const incident of next.incidents) {
    const definition = incidentDef(incident.id), city = cityAt(next, definition.cityId);
    if (incident.phase === 'PENDING' && toWeek >= incident.releaseWeek) {
      incident.phase = 'ACTIVE'; city.residentsSafe -= definition.residents; city.residentsDisplaced += definition.residents; city.facility = Math.max(0, city.facility - 10);
      addMessage(next, `${incident.id}:report`, incident.releaseWeek, definition.message);
    }
    if (incident.phase === 'ACTIVE' && toWeek > incident.deadlineWeek) {
      incident.phase = 'EXPIRED'; incident.departed = 4; city.residentsDisplaced -= 4; city.residentsDeparted += 4;
      const spoil = Math.min(2, city.stock); city.stock -= spoil; city.spoiled += spoil; city.facility = Math.max(0, city.facility - 15);
      addMessage(next, `${incident.id}:loss`, incident.deadlineWeek + 1, `${definition.title}错过及时转运：4名居民已自行离开原救济区，${spoil}份原物资失效。尚未安置的人仍在等待；这些损失不会随下季度恢复。`);
    }
  }
  assertState(next); return next;
}
function currentCity(host: VisionaryHost): VisionaryEraCityId | null { return VISIONARY_ERA_CITY_IDS.find(id => host.location === VISIONARY_ERA_LOCATIONS[id]) ?? null; }
function costFor(state: VisionaryEraState, command: VisionaryEraCommand, host: VisionaryHost): VisionaryEffect {
  const cost = emptyVisionaryEffect(); cost.actions = 1;
  if (command.type === 'ERA_PILOT') cost.cashCost = 12;
  if (command.type === 'ERA_CONNECT') cost.cashCost = 8;
  if (command.type === 'ERA_REPAIR') cost.cashCost = 10;
  if (command.type === 'ERA_RESPOND') { cost.cashCost = command.mode === 'COORDINATED' ? 4 : 12; cost.weeks = command.mode === 'ORDINARY' ? 2 : 0; }
  if (command.type === 'ERA_TRAVEL') {
    const from = currentCity(host) ?? VISIONARY_ERA_CITY_IDS.find(id => host.location.startsWith(VISIONARY_ERA_LOCATIONS[id].split(':')[0]! + ':')) ?? null, destination = cityDef(command.cityId);
    const domestic = from !== null && cityDef(from).governmentId === destination.governmentId;
    cost.weeks = from === command.cityId ? 0 : domestic ? 1 : 2; cost.cashCost = from === command.cityId ? 2 : domestic ? 6 : 12; cost.toLocation = VISIONARY_ERA_LOCATIONS[command.cityId];
  }
  return cost;
}
function nodeReadyBlock(state: VisionaryEraState, node: VisionaryEraNode): string | null {
  if (!state.forecast) return '须在目标季度首轮原灾报发生前锁定可核验的预想。';
  if (state.governments.some(government => !government.adopted)) return '四方须实际采用公共灾报与救援规则。';
  if (state.cities.filter(operational).length < 5) return '至少五处原站须有人值班、实际接通且设施仍可运行。';
  const index = state.nodes.findIndex(item => item.id === node.id);
  const incidents = state.incidents.filter(item => incidentDef(item.id).node === index);
  if (incidents.some(item => state.forecast!.week >= item.releaseWeek)) return '这一季度的首轮消息早于锁定预想，只能继续后面的原季度事务。';
  if (incidents.length !== 2 || incidents.some(item => item.phase !== 'RESOLVED' || item.resolution !== 'COORDINATED' || item.resolvedWeek === null || item.resolvedWeek > item.deadlineWeek)) return '本季度两轮原事件须由已运行的四方协作实际及时处置，原居民与原物资变化须有回执。';
  return null;
}
export function visionaryEraBlock(state: VisionaryEraState, command: VisionaryEraCommand, host: VisionaryHost): string | null {
  if (!validateVisionaryEraCommand(command)) return '未知的时代行动或多余参数。';
  if (!validateVisionaryEraState(state)) return '时代原账与回执不一致，不能继续。';
  if (!text(host.eventId) || !text(host.actorId) || !integer(host.revision) || !integer(host.week, state.week) || ![host.cash, host.actions, host.health, host.mind, host.spirituality].every(value => integer(value))) return '行动来源或真实资源无效。';
  if (host.status !== 'ACTIVE' || (host.sequence !== 1 && !(host.sequence === 0 && command.type === 'ERA_TRAVEL')) || host.health <= 0 || host.mind <= 0) return '须由仍然存活、清醒的序列1本人处理时代事务。';
  if (state.actorId !== null && state.actorId !== host.actorId) return '当前事务只属于原行动者。';
  const last = state.journal.at(-1);
  if (state.journal.some(receipt => receipt.id === host.eventId) || (last && host.revision <= last.revision)) return '此行动已结算或来源版本已经过期。';
  if (state.journal.length >= 256) return '本段时代事务已达到有限回执上限。';
  if (host.check !== null) return '本项已筹备事务不接受外部随机结果。';
  const now = advanceVisionaryEra(state, host.week), cost = costFor(now, command, host), location = currentCity(host);
  if (host.actions < cost.actions) return '本周需要1行动。';
  if (host.cash < cost.cashCost) return `需要实际支付${cost.cashCost}便士，现有资金不足。`;
  if (command.type === 'ERA_TRAVEL') {
    if (location === command.cityId) return '本人已经在这处原联络站。';
    if (now.incidents.some(item => incidentDef(item.id).cityId === command.cityId && item.phase === 'ACTIVE') && ['PRITZ', 'EINHORN'].includes(command.cityId)) return '目的港正执行原封港规则，须等本次封港解除；已接通的原值班员仍可转送救济。';
    return null;
  }
  if (location === null) return '须先沿实际行程到达一处公共灾报联络站。';
  if ('cityId' in command && location !== command.cityId) return `须本人实际到达${cityDef(command.cityId).name}原站，不能远方盖章。`;
  if ('cityId' in command) {
    const city = cityAt(now, command.cityId), government = governmentAt(now, cityDef(city.id).governmentId);
    if (command.type === 'ERA_SURVEY') return city.surveyed ? '原人员、库存与封闭规则已经核对。' : null;
    if (command.type === 'ERA_PILOT') {
      if (!city.surveyed || !now.forecast) return '先调查原站，并在灾报发生前锁定制度预想。';
      if (city.pilot) return '这处原站已经完成有偿试办，不能重复领账。';
      if (government.budget < 12) return '所属方原维修预算不足12，无法签出本次试办款。';
      return null;
    }
    if (command.type === 'ERA_CONNECT') return !city.pilot ? '先用原预算与原成年班组完成有偿试办。' : city.connected ? '原线已经接通，不可重复结算。' : city.facility < 60 ? '原设施已不能运行，先普通修复。' : government.budget < 8 ? '所属方原通报预算不足8。' : null;
    if (command.type === 'ERA_REPAIR') return city.facility === 100 ? '原设施完好，无需制造损坏再维修。' : government.budget < 10 ? '原维修预算不足10，不能凭空增加材料。' : null;
  }
  if (command.type === 'ERA_FORECAST') {
    if (now.forecast) return '预想已事前锁定，不能按结果改写。';
    if (host.week >= now.incidents[6]!.releaseWeek) return '最后一季度的首轮实际消息已经发生，不能事后写下预想。';
    if (location !== 'BACKLUND') return '须回贝克兰德原公共电报室锁定预想。已经发生的消息不能倒填为预见。';
    return VISIONARY_ERA_GOVERNMENT_IDS.every(id => now.cities.some(city => city.surveyed && cityDef(city.id).governmentId === id)) ? null : '先实地调查四方各至少一处原站的人员、库存与封闭规则。';
  }
  if (command.type === 'ERA_ADOPT') {
    const government = governmentAt(now, command.governmentId);
    if (government.adopted) return '该方已经正式采用，不能重复计作另一政权。';
    if (cityDef(location).governmentId !== command.governmentId) return '须本人实际在该方原联络站提交采用。';
    if (!now.forecast || !now.cities.some(city => cityDef(city.id).governmentId === command.governmentId && operational(city))) return '该方须先有一处真正能值班、收发与交接物资的原站。';
    return null;
  }
  if (command.type === 'ERA_RESPOND') {
    const incident = now.incidents.find(item => item.id === command.incidentId)!, definition = incidentDef(incident.id), city = cityAt(now, definition.cityId);
    if (incident.phase === 'PENDING') return '原事件尚未发生；不能为仪式提前制造灾情。';
    if (incident.phase === 'RESOLVED') return '这批原居民已经安置，原物资也已出库，不能重复救援。';
    if (city.stock < definition.supplies) return '该城原救济库存不足；不得用账面签字补出物资。';
    if (command.mode === 'ORDINARY') {
      if (location !== definition.cityId) return '普通修复与转运须本人到达原事发城市。';
      return governmentAt(now, cityDef(city.id).governmentId).budget < 12 ? '本地原救济预算不足12。' : null;
    }
    if (!now.forecast || now.governments.some(government => !government.adopted) || now.cities.filter(operational).length < 5 || !operational(cityAt(now, location))) return '须四方正式采用、至少五站运行，并由本人所在的已接通原站发出协同。';
    if (now.governments.some(government => government.budget < 4)) return '至少一方原救济预算不足4，不能签出四方共同调拨。';
    return null;
  }
  if (command.type === 'ERA_VERIFY') {
    const node = now.nodes.find(item => item.id === command.nodeId)!;
    if (location !== 'BACKLUND') return '季度协同核证须本人实际回贝克兰德原公共电报室。';
    if (node.verifiedReceipt) return '本次真实协同节点已经核证。';
    if (host.week < node.startWeek) return `原季度会期在第${node.startWeek}周，不能提前把资料当成果。`;
    if (host.week > node.endWeek) return '本次季度节点已经过去，不能补签或事后服药；只能继续仍未到来的原季度事务。';
    return nodeReadyBlock(now, node);
  }
  return null;
}
export function visionaryEraChallenge(_state: VisionaryEraState, _command: VisionaryEraCommand): { difficulty: number; bonus: number } | null { return null; }

export function applyVisionaryEra(state: VisionaryEraState, command: VisionaryEraCommand, host: VisionaryHost): VisionaryModuleResult<VisionaryEraState> {
  const blocked = visionaryEraBlock(state, command, host); if (blocked) throw new Error(blocked);
  let next = advanceVisionaryEra(state, host.week); const effect = costFor(next, command, host); const notes: string[] = [];
  const governmentSpend: VisionaryEraReceipt['governmentSpend'] = [];
  const spend = (id: VisionaryEraGovernmentId, amount: number) => { const government = governmentAt(next, id); government.budget -= amount; government.spent += amount; governmentSpend.push({ id, amount }); };
  next.actorId = host.actorId;
  if (command.type === 'ERA_TRAVEL') notes.push(`沿原道路与客运线路前往${cityDef(command.cityId).name}，花费${effect.cashCost}便士与${effect.weeks}周；途中其他城市的原灾报仍会继续。`);
  else if ('cityId' in command) {
    const city = cityAt(next, command.cityId), definition = cityDef(city.id); city.receipts.push(host.eventId);
    if (command.type === 'ERA_SURVEY') { city.surveyed = true; notes.push(`${definition.keeper}当面展示${definition.facility}原账：${definition.staff}名成年人员、${city.stock}份救济储备、${definition.population}名原居民。${definition.closure}`); }
    if (command.type === 'ERA_PILOT') { city.pilot = true; city.staffAssigned = 2; spend(definition.governmentId, 12); notes.push(`你支付12便士，${definition.name}另从原维修预算支出12；原班组抽调2人，完成一次实际班次交接与原货单核对，储备没有复制。`); }
    if (command.type === 'ERA_CONNECT') { city.connected = true; spend(definition.governmentId, 8); notes.push(`${definition.facility}接通原公共线路，原2人班组开始收转灾报；你支付8便士，该方从原通报预算另支出8。`); }
    if (command.type === 'ERA_REPAIR') { city.facility = 100; spend(definition.governmentId, 10); notes.push(`你支付10便士，当地原维修预算支出10，由原班组修复设施。已用物资与已离开的居民没有恢复。`); }
  } else if (command.type === 'ERA_FORECAST') {
    next.forecast = { plan: 'PUBLIC_RELAY', week: host.week, receipt: host.eventId, minimumStations: 5, governments: [...VISIONARY_ERA_GOVERNMENT_IDS], rounds: 2 };
    notes.push('事前锁定预想：四方正式采用公共灾报与救援制度，至少五处原站可运行；在一个真实季度内两轮原灾情均得到实际协同处置，之后才在原会期核证。');
  } else if (command.type === 'ERA_ADOPT') {
    const government = governmentAt(next, command.governmentId); government.adopted = true; government.adoptedReceipt = host.eventId;
    const definition = VISIONARY_ERA_GOVERNMENTS.find(item => item.id === government.id)!;
    notes.push(`${definition.name}将已试办的收报、核单与跨城救济班次写入原值班制度。${definition.rule}`);
  } else if (command.type === 'ERA_RESPOND') {
    // Ordinary work consumes two real weeks before delivery. If a deadline passes
    // during those weeks, the original losses apply before the survivors arrive.
    if (effect.weeks > 0) next = advanceVisionaryEra(nextWithPendingReceipt(next, command, host, effect, governmentSpend, notes), host.week + effect.weeks);
    const incident = next.incidents.find(item => item.id === command.incidentId)!, definition = incidentDef(incident.id), city = cityAt(next, definition.cityId);
    if (command.mode === 'COORDINATED') for (const government of next.governments) spend(government.id, 4); else spend(cityDef(city.id).governmentId, 12);
    city.stock -= definition.supplies; city.supplied += definition.supplies;
    const remaining = definition.residents - incident.departed; city.residentsDisplaced -= remaining; city.residentsSafe += remaining;
    incident.assisted = remaining; incident.delivered = definition.supplies; incident.phase = 'RESOLVED'; incident.resolution = command.mode; incident.resolvedWeek = host.week + effect.weeks; incident.receipt = host.eventId;
    notes.push(`${definition.title}：原仓库实际支出${definition.supplies}份物资，${remaining}名原居民得到安置。${incident.departed ? `${incident.departed}名先前离开的居民没有被补回。` : ''}${command.mode === 'COORDINATED' ? '四方原班组共同核对消息、货单与接收名册，各从原预算支出4。' : '按普通本地路线完成，两周与12便士已经花去；本次不计作四方协同轮次。'}`);
  } else if (command.type === 'ERA_VERIFY') {
    const node = next.nodes.find(item => item.id === command.nodeId)!; node.verifiedReceipt = host.eventId; node.verifiedWeek = host.week;
    notes.push('原季度会期对照事前预想、四方现行班表、五站以上实时回报，以及两轮原居民安置与原物资出库回执。公共救援制度的实际改变得到核证；只在本次仍开放的会期内存在服药窗口。');
  }
  // Replace the temporary ordinary receipt after delivery; no duplicate command.
  if (next.journal.at(-1)?.id === host.eventId) next.journal.pop();
  next.journal.push({ id: host.eventId, actorId: host.actorId, revision: host.revision, week: host.week, command: structuredClone(command), effect: structuredClone(effect), governmentSpend, notes: [...notes] });
  if (effect.weeks > 0 && next.week < host.week + effect.weeks) next = advanceVisionaryEra(next, host.week + effect.weeks);
  assertState(next); return { state: next, effect, notes };
}
/** A time-consuming action's original receipt must exist while advancing time;
 * it is completed atomically before the result leaves the reducer. */
function nextWithPendingReceipt(state: VisionaryEraState, command: VisionaryEraCommand, host: VisionaryHost, effect: VisionaryEffect, governmentSpend: VisionaryEraReceipt['governmentSpend'], notes: string[]): VisionaryEraState {
  const next = structuredClone(state);
  next.journal.push({ id: host.eventId, actorId: host.actorId, revision: host.revision, week: host.week, command: structuredClone(command), effect: structuredClone(effect), governmentSpend: structuredClone(governmentSpend), notes: [...notes] });
  return next;
}

export function deriveVisionaryEraWindow(state: VisionaryEraState, host: VisionaryHost): { id: string; startWeek: number; endWeek: number; receipts: string[] } | null {
  if (!validateVisionaryEraState(state) || !integer(host.week, state.week) || host.status !== 'ACTIVE' || host.sequence !== 1 || host.actorId !== state.actorId || host.health <= 0 || host.mind <= 0) return null;
  const now = advanceVisionaryEra(state, host.week), node = now.nodes.find(item => item.verifiedReceipt !== null && host.week >= item.startWeek && host.week <= item.endWeek);
  if (!node || nodeReadyBlock(now, node) !== null) return null;
  const index = now.nodes.findIndex(item => item.id === node.id);
  return { id: `${state.runId}:${node.id}`, startWeek: node.startWeek, endWeek: node.endWeek, receipts: [now.forecast!.receipt, ...now.governments.map(government => government.adoptedReceipt!), ...now.incidents.filter(item => incidentDef(item.id).node === index).map(item => item.receipt!), node.verifiedReceipt!] };
}
export function getVisionaryEraActions(state: VisionaryEraState, host: VisionaryHost): VisionaryEraAction[] {
  const actions: { label: string; command: VisionaryEraCommand }[] = [];
  for (const city of VISIONARY_ERA_CITIES) {
    actions.push({ label: `前往${city.name}原站`, command: { type: 'ERA_TRAVEL', cityId: city.id } });
    for (const [type, label] of [['ERA_SURVEY', '核对原账与封闭规则'], ['ERA_PILOT', '支付费用并试办原班次'], ['ERA_CONNECT', '接通原公共线路'], ['ERA_REPAIR', '普通修复原设施']] as const) actions.push({ label: `${city.name}：${label}`, command: { type, cityId: city.id } });
  }
  actions.push({ label: '事前锁定四方公共救援预想', command: { type: 'ERA_FORECAST', plan: 'PUBLIC_RELAY' } });
  for (const government of VISIONARY_ERA_GOVERNMENTS) actions.push({ label: `${government.name}正式采用原试办制度`, command: { type: 'ERA_ADOPT', governmentId: government.id } });
  for (const incident of VISIONARY_ERA_INCIDENTS.filter(item => state.incidents.find(entry => entry.id === item.id)!.releaseWeek <= host.week)) for (const mode of ['COORDINATED', 'ORDINARY'] as const) actions.push({ label: `${incident.title}：${mode === 'COORDINATED' ? '四方实际协同' : '普通本地转运（两周）'}`, command: { type: 'ERA_RESPOND', incidentId: incident.id, mode } });
  for (const node of state.nodes) actions.push({ label: `第${node.startWeek}周原季度协同核证`, command: { type: 'ERA_VERIFY', nodeId: node.id } });
  return actions.map((action, index) => { const reason = visionaryEraBlock(state, action.command, host); return { ...action, id: `era:${index}:${action.command.type}`, enabled: reason === null, reason, cost: costFor(state, action.command, host) }; });
}
export function projectVisionaryEra(state: VisionaryEraState): { story: string; nextStep: string; lines: string[] } {
  assertState(state);
  const upcoming = state.nodes.find(node => node.endWeek >= state.week), active = state.incidents.find(incident => incident.phase === 'ACTIVE');
  const working = state.cities.filter(operational).length, adopted = state.governments.filter(government => government.adopted).length;
  const nextStep = !upcoming ? '四个预先存在的季度节点均已过去。本段不再补开服药窗口，原损失与原成果继续保留。' : !state.forecast ? '先实地调查四方原站，再回贝克兰德于目标季度首轮灾报前锁定预想。' : adopted < 4 || working < 5 ? '用原预算有偿试办并接通原班组，促成四方采用，至少保有五站可运行。' : active ? `处理已经收到的原灾报：${incidentDef(active.id).title}。` : upcoming ? `维持原班表，等待并处理原事件；下次原季度会期为第${upcoming.startWeek}—${upcoming.endWeek}周。` : '四个预先存在的季度节点均已过去。本段不再补开服药窗口，原损失与原成果继续保留。';
  return {
    story: '四方公共灾报与救援制度转型：原来各管各地的电报室、货运班组与救济仓，开始面对同一份真实灾报。', nextStep,
    lines: [
      `四方采用 ${adopted}/4；原站运行 ${working}/6；事前预想${state.forecast ? `已于第${state.forecast.week}周锁定` : '尚未锁定'}。`,
      ...state.governments.map(government => `${VISIONARY_ERA_GOVERNMENTS.find(item => item.id === government.id)!.name}：原预算剩余${government.budget}，累计真实支出${government.spent}。`),
      ...state.cities.map(city => `${cityDef(city.id).name}：原班组${city.staffAssigned}/${cityDef(city.id).staff}人值守，设施${city.facility}，原储备${city.stock}，已送达${city.supplied}，失效${city.spoiled}；待安置${city.residentsDisplaced}人，原区已离开${city.residentsDeparted}人。`),
      ...state.nodes.map(node => `原季度节点：第${node.startWeek}—${node.endWeek}周，${node.verifiedReceipt ? '实际协同已核证' : state.week > node.endWeek ? '已过期，不能补签' : '尚未核证'}。`),
      ...state.messages.slice(-6).map(message => `第${message.week}周消息：${message.text}`),
    ],
  };
}
