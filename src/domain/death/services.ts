/** R217 isolated finite-service candidate. No RNG, healing, wages or product wiring. */
import type { SliceState } from '../slice/types.js';
import type { DeathHost, DeathEffect } from './ports.js';
import { emptyDeathEffect } from './ports.js';
import { DEATH_SERVICE_IDS, DEATH_WORKER_IDS, type DeathServicesState, type DeathResident,
  type DeathResidueSite, type DeathWharfSite, type DeathServiceCommand, type DeathServiceId,
  type DeathServiceEvent, type DeathServiceReceipt, type DeathServiceCompletion,
  type DeathPermission, type DeathMovementReceipt } from './types.js';
import { DEATH_SERVICE_SCENE as SCENE, DEATH_RESIDENT_IDENTITIES as PEOPLE } from './service-content.js';

/** Compatibility aliases for the single persisted finite-scene contract. */
export type DeathServiceResident = DeathResident;
type Visit = import('./types.js').DeathServiceVisit;
export type DeathResidueRuntimeSite = DeathResidueSite;
export type DeathWharfRuntimeSite = DeathWharfSite;
export type DeathServiceStockChange = import('./types.js').DeathServiceStockChange;
export type DeathServiceRuntimeEvent = DeathServiceEvent;
export type DeathServicesRuntimeState = DeathServicesState;
export interface DeathServicesResult {
  state: DeathServicesRuntimeState; effect: DeathEffect; injuries: SliceState['injuries'];
  movements: DeathMovementReceipt[]; notes: string[];
}
const clone = <T>(value: T): T => structuredClone(value);
const integer = (value: unknown, minimum = 0): value is number => Number.isSafeInteger(value) && (value as number) >= minimum;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 300;
function need(condition: unknown, reason: string): asserts condition { if (!condition) throw Error(reason); }
const exact = (value: object, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const room = SCENE.residue, wharf = SCENE.wharf;
const WEEK_SECONDS = 604800;
const at = (location: string, position: number) => `${location}@${position}m`;

function resident(identity: typeof PEOPLE.residueCustodian | typeof PEOPLE.firstWorker | typeof PEOPLE.secondWorker,
  location: string, position: number, injuries: string[] = []): DeathServiceResident {
  return { id: identity.id, name: identity.name, age: identity.age, bodyId: identity.bodyId, status: 'ACTIVE',
    health: identity.health, energy: identity.energy, injuries, location, position, consent: null,
    travelledMetres: 0, elapsedSeconds: 0, willingness: SCENE.initialWillingness, conditionVersion: 1 };
}
export function createDeathServices(runId: string, actorId: string, week: number, second: number): DeathServicesRuntimeState {
  need(text(runId) && text(actorId) && integer(week) && integer(second), '有限服务缺少同一周目、本人或真实起始时间。');
  const state: DeathServicesRuntimeState = {
    version: 1, runId, actorId, startWeek: week, startSecond: second, lastSecond: second, journal: [],
    residue: {
      id: 'residue-sealing', location: room.location, playerPosition: room.entrancePosition,
      custodian: resident(PEOPLE.residueCustodian, room.location, room.keeperPosition),
      residue: { id: 'DE0-RESIDUE-1', intelligent: false, total: room.total, exposed: room.initiallyExposed,
        contained: room.initiallyContained, dissipated: room.initialDissipated,
        containerId: 'DE0-RESIDUE-CONTAINER', location: room.location, conditionVersion: 1 },
      apparatus: { containerId: 'DE0-RESIDUE-CONTAINER', lidId: 'DE0-RESIDUE-LID', screenId: 'DE0-RESIDUE-SCREEN',
        lid: 'OPEN', screen: 'ASIDE', seal: 'NONE', location: room.location, version: 1,
        containerPosition: room.workbenchPosition, lidPosition: room.workbenchPosition, screenPosition: room.workbenchPosition,
        ownerId: room.containerOwner, containerHolder: room.containerOwner, returnedEventId: null,
        containerVersion: 1, lidVersion: 1, screenVersion: 1 },
      propagation: { id: 'DE0-RESIDUE-LINE-1', from: 'DE0-RESIDUE-CONTAINER', to: 'DE0-RESIDUE-WORKBENCH',
        visible: false, blocked: false, version: 1 },
      supply: { id: 'DE0-RESIDUE-SEAL-1', stock: 1, boughtEventId: null, usedEventId: null, holder: 'SUPPLIER', version: 1,
        location: room.location, position: room.entrancePosition },
      survey: null, shielded: null, completion: null, review: null, ordinaryExit: 'OPEN',
      visitId: null, accessVersion: 1, stopped: false, surveyVisitId: null, observedEventId: null, observedVisitId: null,
    },
    wharf: {
      id: 'old-wharf-exit', location: wharf.location, playerPosition: wharf.safePosition,
      workers: [
        { ...resident(PEOPLE.firstWorker, wharf.location, wharf.unsafePosition), id: 'DE0-WHARF-WORKER-1' },
        { ...resident(PEOPLE.secondWorker, wharf.location, wharf.unsafePosition, [wharf.secondWorkerInjury]), id: 'DE0-WHARF-WORKER-2' },
      ],
      bridge: { id: 'DE0-WHARF-BRIDGE', condition: wharf.initialBridgeCondition, version: 1, supported: false, passable: true },
      rope: { id: 'DE0-WHARF-ROPE-1', stock: 1, condition: wharf.initialRopeCondition, version: 1,
        boughtEventId: null, installedEventId: null, spentMetres: 0, holder: 'SUPPLIER',
        location: wharf.location, position: wharf.safePosition, installedSpan: null },
      endpoints: { unsafeId: wharf.unsafeId, safeId: wharf.safeId, unsafePosition: wharf.unsafePosition,
        safePosition: wharf.safePosition, surveyedEventId: null, routeMetres: wharf.bridgeMetres, routeSeconds: wharf.bridgeMetres },
      ordinaryExit: 'OPEN', fallback: 'STOP_AND_RETREAT', survey: null, arrivals: [], completion: null, review: null,
      visitId: null, accessVersion: 1, stopped: false, surveyVisitId: null,
      retreat: { id: wharf.retreatPathId, open: true, metres: wharf.retreatMetres, version: 1 },
    },
  };
  assertServices(state); return state;
}
export function validateDeathServiceCommand(value: unknown): value is DeathServiceCommand {
  if (!record(value) || typeof value.type !== 'string' || !DEATH_SERVICE_IDS.some(id => id === value.serviceId)) return false;
  if (value.type === 'ESCORT_WORKER') return value.serviceId === 'old-wharf-exit' &&
    exact(value, ['type', 'serviceId', 'workerId']) && DEATH_WORKER_IDS.some(id => id === value.workerId);
  if (!exact(value, ['type', 'serviceId'])) return false;
  if (['ASK_PERMISSION', 'SURVEY', 'BUY_SUPPLIES', 'VERIFY_SERVICE', 'STOP_SERVICE', 'RETURN_ON_FOOT'].includes(String(value.type))) return true;
  return value.serviceId === 'residue-sealing'
    ? ['OBSERVE_PROPAGATION', 'POSITION_SCREEN', 'CLOSE_LID', 'SEAL_CONTAINER', 'RETURN_CONTAINER'].includes(String(value.type))
    : ['LAY_ROPE', 'SUPPORT_BRIDGE'].includes(String(value.type));
}
function assertPerson(person: DeathServiceResident, identity: typeof PEOPLE.residueCustodian | typeof PEOPLE.firstWorker | typeof PEOPLE.secondWorker): void {
  need(person.id === identity.id && person.bodyId === identity.bodyId && person.name === identity.name && person.age === identity.age && person.age > 18,
    '必须保留原成年人的同一身体和身份。');
  need(integer(person.health) && person.health <= 100 && integer(person.energy) && person.energy <= identity.energy &&
    integer(person.conditionVersion, 1) && integer(person.travelledMetres) && integer(person.elapsedSeconds) &&
    Array.isArray(person.injuries) && person.injuries.every(text) && ['ALLOW', 'REFUSED', 'WITHDRAWN'].includes(person.willingness), '居民身体、原伤、精力或意愿无效。');
  need(person.status === 'ACTIVE' && person.health > 0 || person.status === 'DEAD' && person.health === 0, '同一身体的死亡状态不一致。');
  if (person.consent) need(person.consent.personId === person.id && person.consent.purpose === 'SERVICE' &&
    ['ALLOW', 'REFUSED', 'WITHDRAWN'].includes(person.consent.status) && integer(person.consent.conditionVersion, 1), '当次许可不属于同一居民。');
}
function assertServices(input: DeathServicesState): asserts input is DeathServicesRuntimeState {
  const s = input as DeathServicesRuntimeState, r = s.residue, w = s.wharf;
  need(s.version === 1 && text(s.runId) && text(s.actorId) && integer(s.startWeek) && integer(s.startSecond) &&
    integer(s.lastSecond, s.startSecond) && Array.isArray(s.journal), '有限服务的完整来源或单时钟缺失。');
  need(r.id === 'residue-sealing' && r.location === room.location && w.id === 'old-wharf-exit' && w.location === wharf.location,
    '只能处理登记的两处原现场。');
  for (const site of [r, w]) need(integer(site.accessVersion, 1) && typeof site.stopped === 'boolean' &&
    ['OPEN', 'BLOCKED'].includes(site.ordinaryExit) && (site.visitId === null || text(site.visitId)) &&
    (site.surveyVisitId === null || text(site.surveyVisitId)), '当次现场访问状态缺失。');
  assertPerson(r.custodian, PEOPLE.residueCustodian); assertPerson(w.workers[0], PEOPLE.firstWorker); assertPerson(w.workers[1], PEOPLE.secondWorker);
  need(text(r.custodian.location) && r.custodian.position === room.keeperPosition &&
    w.workers.every(person => text(person.location) && [0, 12].includes(person.position)) &&
    w.workers[1].injuries.includes(wharf.secondWorkerInjury), '不能远程借用居民、移走身体或治疗旧脚踝伤。');
  need([room.entrancePosition, room.workbenchPosition].some(value => value === r.playerPosition) &&
    [wharf.unsafePosition, wharf.safePosition].some(value => value === w.playerPosition), '本人不在实际登记端点。');
  const residue = r.residue, apparatus = r.apparatus;
  need(residue.id === 'DE0-RESIDUE-1' && residue.intelligent === false && residue.total === 4 &&
    [residue.exposed, residue.contained, residue.dissipated].every(value => integer(value)) &&
    residue.exposed + residue.contained + residue.dissipated === residue.total && residue.containerId === 'DE0-RESIDUE-CONTAINER' &&
    residue.location === room.location && integer(residue.conditionVersion, 1), '原四份无智能残余必须守恒，不能补活性或制造灵魂。');
  need(apparatus.containerId === 'DE0-RESIDUE-CONTAINER' && apparatus.lidId === 'DE0-RESIDUE-LID' && apparatus.screenId === 'DE0-RESIDUE-SCREEN' &&
    apparatus.ownerId === room.containerOwner && apparatus.containerHolder === room.containerOwner && apparatus.location === room.location &&
    [0, 6].includes(apparatus.containerPosition) && apparatus.lidPosition === apparatus.containerPosition && apparatus.screenPosition === 6 &&
    [apparatus.version, apparatus.containerVersion, apparatus.lidVersion, apparatus.screenVersion, r.propagation.version].every(value => integer(value, 1)),
    '必须保留原容器、盖、屏、物权和各自实际位置。');
  need(['OPEN', 'CLOSED'].includes(apparatus.lid) && ['ASIDE', 'SHIELDING'].includes(apparatus.screen) &&
    ['NONE', 'INTACT', 'BROKEN'].includes(apparatus.seal), '原器件当前状态无效。');
  need(r.supply.id === 'DE0-RESIDUE-SEAL-1' && [0, 1].includes(r.supply.stock) && integer(r.supply.version, 1) &&
    r.supply.location === room.location && [0, 6].includes(r.supply.position) &&
    (r.supply.holder === 'SUPPLIER' ? r.supply.position === 0 && r.supply.stock === 1 && r.supply.boughtEventId === null && r.supply.usedEventId === null :
      r.supply.holder === 'PLAYER' ? r.supply.stock === 1 && text(r.supply.boughtEventId) && r.supply.usedEventId === null :
        r.supply.holder === 'USED' && r.supply.position === apparatus.containerPosition && r.supply.stock === 0 && text(r.supply.boughtEventId) && text(r.supply.usedEventId)), '唯一封材的购买、位置、库存与实际使用不一致。');
  need(w.bridge.id === 'DE0-WHARF-BRIDGE' && integer(w.bridge.condition) && w.bridge.condition <= wharf.initialBridgeCondition &&
    integer(w.bridge.version, 1) && typeof w.bridge.passable === 'boolean' && typeof w.bridge.supported === 'boolean' &&
    w.rope.id === 'DE0-WHARF-ROPE-1' && integer(w.rope.condition) && w.rope.condition <= 100 && integer(w.rope.version, 1), '原桥绳不能被换新或凭空恢复。');
  need(w.rope.location === wharf.location && (w.rope.holder === 'INSTALLED' ? w.rope.position === null &&
    w.rope.installedSpan?.from === 0 && w.rope.installedSpan.to === 12 && w.rope.installedSpan.metres === 16 :
    w.rope.position !== null && [0, 12].includes(w.rope.position) && w.rope.installedSpan === null), '原绳的实际存放处或铺设跨度缺失。');
  need(w.rope.holder === 'SUPPLIER' ? w.rope.position === 12 && w.rope.stock === 1 && w.rope.boughtEventId === null && w.rope.installedEventId === null && w.rope.spentMetres === 0 :
    w.rope.holder === 'PLAYER' ? w.rope.stock === 1 && text(w.rope.boughtEventId) && w.rope.installedEventId === null && w.rope.spentMetres === 0 :
      w.rope.holder === 'INSTALLED' && w.rope.stock === 0 && text(w.rope.boughtEventId) && text(w.rope.installedEventId) && w.rope.spentMetres === 16,
    '唯一绳段不能重复购买、重复铺设或重新长出库存。');
  need(w.endpoints.unsafeId === wharf.unsafeId && w.endpoints.safeId === wharf.safeId &&
    w.endpoints.unsafePosition === 0 && w.endpoints.safePosition === 12 && w.endpoints.routeMetres === 12 && w.endpoints.routeSeconds === 12 &&
    w.retreat.id === wharf.retreatPathId && w.retreat.open === true && w.retreat.metres === 18 && integer(w.retreat.version, 1), '原桥两端或普通绕行退路被替换。');
  need(Array.isArray(w.arrivals) && w.arrivals.length <= 2 && new Set(w.arrivals.map(row => row.workerId)).size === w.arrivals.length, '同一工人不能重复到岸。');
  for (const person of w.workers) {
    const arrival = w.arrivals.find(row => row.workerId === person.id);
    need(arrival ? person.position === 12 && arrival.from === 0 && arrival.to === 12 && arrival.metres === 12 && arrival.seconds === 12 && arrival.route === 'BRIDGE_ROPE'
      : person.position === 0, '到岸记录必须对应原身体的实际位置。');
  }
  if (r.completion) need(apparatus.returnedEventId === r.completion.eventId && apparatus.containerPosition === 0 &&
    apparatus.lid === 'CLOSED' && apparatus.seal === 'INTACT' && residue.exposed === 0 && residue.contained === 4 && r.supply.stock === 0,
    '归还完成不能替代原容器、实耗封材或四份残余。');
  if (w.completion) need(w.arrivals.length === 2 && w.workers.every(person => person.position === 12), '两人都实际到岸后才能完成。');
  need(s.journal.every((event, index) => text(event.id) && integer(event.revision, 1) && validateDeathServiceCommand(event.command) &&
    integer(event.beforeSecond, s.startSecond) && integer(event.afterSecond, event.beforeSecond + 1) &&
    event.afterSecond - event.beforeSecond === event.effect.seconds && event.effect.cashGain === 0 &&
    (index === 0 || event.revision > s.journal[index - 1]!.revision && event.beforeSecond >= s.journal[index - 1]!.afterSecond)), '服务日志不是同一真实时钟上的顺序操作。');
  need(new Set(s.journal.map(event => event.id)).size === s.journal.length &&
    (!s.journal.length || s.lastSecond === s.journal[s.journal.length - 1]!.afterSecond), '同一服务事件不能重复，末时刻不能被重置。');
}
export function deathServiceConditionVersions(input: DeathServicesState): Record<string, number> {
  assertServices(input); const r = input.residue, w = input.wharf;
  return { [r.residue.id]: r.residue.conditionVersion, [r.apparatus.containerId]: r.apparatus.containerVersion,
    [r.apparatus.lidId]: r.apparatus.lidVersion, [r.apparatus.screenId]: r.apparatus.screenVersion,
    [r.propagation.id]: r.propagation.version, [r.supply.id]: r.supply.version,
    [r.custodian.bodyId]: r.custodian.conditionVersion, 'residue-sealing:access': r.accessVersion,
    [w.bridge.id]: w.bridge.version, [w.rope.id]: w.rope.version, [w.retreat.id]: w.retreat.version,
    [w.workers[0].bodyId]: w.workers[0].conditionVersion, [w.workers[1].bodyId]: w.workers[1].conditionVersion,
    'old-wharf-exit:access': w.accessVersion };
}
function currentPermission(person: DeathServiceResident, site: Visit & { location: string }, h: DeathHost): boolean {
  const permit = person.consent;
  return person.status === 'ACTIVE' && person.health > 0 && person.location === site.location && person.willingness === 'ALLOW' && site.visitId !== null && !site.stopped &&
    permit !== null && permit.status === 'ALLOW' && permit.actorId === h.actorId && permit.personId === person.id &&
    permit.purpose === 'SERVICE' && permit.location === site.location && permit.eventId === site.visitId &&
    permit.conditionVersion === person.conditionVersion && permit.week <= h.week && permit.revision < h.revision;
}
function clearPermission(person: DeathServiceResident): void {
  if (person.consent?.status === 'REFUSED' || person.consent?.status === 'WITHDRAWN') person.willingness = person.consent.status;
  if (person.consent?.status === 'ALLOW') person.consent = null;
}
function stopSite(s: DeathServicesRuntimeState, id: DeathServiceId): void {
  const site = id === 'residue-sealing' ? s.residue : s.wharf;
  const changed = site.visitId !== null || !site.stopped;
  site.visitId = null; site.stopped = true; site.surveyVisitId = null;
  if (changed) site.accessVersion += 1;
  if (id === 'residue-sealing') {
    clearPermission(s.residue.custodian); s.residue.observedVisitId = null;
  } else for (const person of s.wharf.workers) clearPermission(person);
}
function sitePeople(s: DeathServicesRuntimeState, id: DeathServiceId): DeathServiceResident[] {
  if (id === 'residue-sealing') return [s.residue.custodian];
  return s.wharf.completion ? s.wharf.workers : s.wharf.workers.filter(person => person.position === wharf.unsafePosition);
}
function versionsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  return Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([key, value]) => right[key] === value);
}

/** Runs only on a private clone, including preview/block calls. A failed
 * precondition throws before any caller-owned state can change. The engine
 * alone deducts the returned cost, advances its single clock and writes SQLite. */
function execute(input: DeathServicesState, command: DeathServiceCommand, h: DeathHost): DeathServicesResult {
  need(validateDeathServiceCommand(command), '未知服务命令或命令夹带了身体、许可、现金、骰等权威字段。');
  assertServices(input); const s = clone(input), r = s.residue, w = s.wharf;
  const site = command.serviceId === 'residue-sealing' ? r : w;
  need(h.actorId === s.actorId && h.status === 'ACTIVE' && h.health > 0 && h.mind > 0 && h.sequence === 1,
    '必须由原本人活着处理这两件当代事务。');
  need(h.location === site.location && integer(h.nowSecond, s.lastSecond) && integer(h.week, s.startWeek) && integer(h.weekAnchor) &&
    h.nowSecond >= h.weekAnchor && h.nowSecond < h.weekAnchor + WEEK_SECONDS && integer(h.revision, 1) && text(h.eventId) &&
    h.check === null && !s.journal.some(event => event.id === h.eventId) &&
    (!s.journal.length || h.revision > s.journal[s.journal.length - 1]!.revision), '必须在实际现场使用当前单时钟；普通服务不接受骰或旧事件。');
  const effect = emptyDeathEffect(), movements: DeathMovementReceipt[] = [], notes: string[] = [];
  const permissionEvents: DeathPermission[] = [], stockChanges: DeathServiceStockChange[] = [];
  const before = deathServiceConditionVersions(s);
  const wait = (seconds: number) => { need(integer(seconds), '物件操作时间无效。'); effect.seconds += seconds; };
  const endWeek = () => h.week + Math.floor((h.nowSecond + effect.seconds - h.weekAnchor) / WEEK_SECONDS);
  // Validation of the partially built event must not depend on lastSecond yet.
  const completion = (): DeathServiceCompletion => ({ eventId: h.eventId, week: endWeek(),
    second: h.nowSecond + effect.seconds, conditionVersions: deathServiceConditionVersions(s) });
  const moveRoom = (to: number, carry = false, carrySupply = false) => {
    const from = r.playerPosition, metres = Math.abs(to - from); if (!metres) return;
    movements.push({ actorId: s.actorId, from: at(r.location, from), to: at(r.location, to), metres, seconds: metres, energyCost: 0 });
    if (carry) {
      need(r.apparatus.containerPosition === from && r.apparatus.lidPosition === from, '不能远程移动原容器或原盖。');
      for (const id of [r.apparatus.containerId, r.apparatus.lidId, r.residue.id, r.supply.id])
        movements.push({ actorId: id, from: at(r.location, from), to: at(r.location, to), metres, seconds: metres, energyCost: 0 });
      r.apparatus.containerPosition = to; r.apparatus.lidPosition = to;
      r.apparatus.containerVersion += 1; r.apparatus.lidVersion += 1; r.apparatus.version += 1; r.residue.conditionVersion += 1;
      r.supply.position = to; r.supply.version += 1;
    } else if (carrySupply) {
      need(r.supply.holder === 'PLAYER' && r.supply.position === from, '封材必须从实际存放处拿取。');
      movements.push({ actorId: r.supply.id, from: at(r.location, from), to: at(r.location, to), metres, seconds: metres, energyCost: 0 });
      r.supply.position = to; r.supply.version += 1;
    }
    r.playerPosition = to; wait(metres);
  };
  const crossWharf = (to: number, escorted?: DeathServiceResident, carryRope = false) => {
    const from = w.playerPosition, metres = Math.abs(to - from); if (!metres) return;
    need(metres === wharf.bridgeMetres && w.bridge.passable && w.bridge.condition >= wharf.minimumSoloBridgeCondition,
      '原桥当前不能通行；可以停止作业，沿岸边公共绕行道退回入口。');
    const bridgeWear = escorted ? wharf.escortedBridgeWear : wharf.soloBridgeWear;
    const ropeWear = escorted ? wharf.escortedRopeWear : w.rope.installedEventId ? wharf.soloRopeWear : 0;
    if (escorted) need(w.bridge.supported && w.bridge.condition - bridgeWear >= wharf.minimumEscortBridgeCondition &&
      w.rope.holder === 'INSTALLED' && w.rope.condition - ropeWear >= wharf.minimumEscortRopeCondition,
      '原桥或原绳的剩余承载条件不足，不能冒充实际护送成功。');
    need(!ropeWear || w.rope.condition >= ropeWear, '原绳已经损坏，停止并使用普通退路。');
    w.bridge.condition -= bridgeWear; w.bridge.version += 1;
    if (ropeWear) { w.rope.condition -= ropeWear; w.rope.version += 1; }
    movements.push({ actorId: s.actorId, from: at(w.location, from), to: at(w.location, to), metres, seconds: metres, energyCost: 0 });
    if (carryRope) {
      need(w.rope.holder === 'PLAYER' && w.rope.position === from, '必须从原绳真实存放处带上同一绳段。');
      movements.push({ actorId: w.rope.id, from: at(w.location, from), to: at(w.location, to), metres, seconds: metres, energyCost: 0 });
      w.rope.position = to; w.rope.version += 1;
    }
    if (escorted) {
      need(escorted.position === from && to === wharf.safePosition, '同一个身体必须从原工作岸亲自走到安全岸。');
      const energyCost = escorted.id === PEOPLE.firstWorker.id ? wharf.firstWorkerEnergyCost : wharf.secondWorkerEnergyCost;
      need(escorted.energy >= energyCost, '这名工人当前精力不足，不能赠送精力或替他完成移动。');
      movements.push({ actorId: escorted.id, from: at(w.location, from), to: at(w.location, to), metres, seconds: metres, energyCost });
      escorted.position = to; escorted.energy -= energyCost; escorted.travelledMetres += metres;
      escorted.elapsedSeconds += metres; escorted.conditionVersion += 1;
      clearPermission(escorted);
    }
    w.playerPosition = to; wait(metres);
  };
  const permitted = () => {
    for (const person of sitePeople(s, command.serviceId)) need(currentPermission(person, site, h),
      `${person.name}未给予当前现场同意，已拒绝、撤回、离场或身体条件已变；不能通过重问重置。`);
  };
  const surveyed = () => need(site.survey !== null && site.visitId !== null && site.surveyVisitId === site.visitId,
    '先在本次实际访问中重新查看原现场与退路。');
  const residueWorking = () => {
    permitted(); surveyed(); need(r.observedEventId !== null && r.observedVisitId === r.visitId && r.propagation.visible,
      '先亲眼观察同一条有限残余传播线。');
    moveRoom(room.workbenchPosition);
  };
  const purchase = (objectId: string, stock: { stock: 0 | 1; holder: string; version: number; boughtEventId: string | null }, price: number) => {
    need(stock.stock === 1 && stock.holder === 'SUPPLIER' && stock.boughtEventId === null, '唯一耗材已购买或已使用，不能重新补货或再收费。');
    const versionBefore = stock.version;
    stock.boughtEventId = h.eventId; stock.holder = 'PLAYER'; stock.version += 1; effect.cashCost = price;
    stockChanges.push({ objectId, stockBefore: 1, stockAfter: 1, holderBefore: 'SUPPLIER', holderAfter: 'PLAYER', versionBefore, versionAfter: stock.version });
  };

  if (command.type === 'STOP_SERVICE' || command.type === 'RETURN_ON_FOOT') {
    need(command.type === 'RETURN_ON_FOOT' || !site.stopped, '当前已停手；可直接普通步行退回入口。');
    need(command.type !== 'RETURN_ON_FOOT' || !site.stopped || site.playerPosition !==
      (command.serviceId === 'residue-sealing' ? room.entrancePosition : wharf.safePosition), '本人已经停手并站在本处入口，不会重复计一次返程。');
    stopSite(s, command.serviceId); wait(SCENE.stopSeconds);
    if (command.type === 'RETURN_ON_FOOT') {
      if (command.serviceId === 'residue-sealing') {
        need(r.ordinaryExit === 'OPEN', '本处登记出口当前不可用。'); moveRoom(room.entrancePosition);
      } else if (w.playerPosition !== wharf.safePosition) {
        need(w.ordinaryExit === 'OPEN' && w.retreat.open, '岸边普通绕行道当前不可用。');
        movements.push({ actorId: s.actorId, from: at(w.location, w.playerPosition), to: at(w.location, wharf.safePosition),
          metres: w.retreat.metres, seconds: w.retreat.metres, energyCost: 0 });
        w.playerPosition = wharf.safePosition; wait(w.retreat.metres);
      }
    }
    notes.push(command.type === 'STOP_SERVICE' ? '实际停手并结束本次许可；原器件、已用耗材和已到岸工人不重置。'
      : '实际停手并步行回到本处入口，不扣行动或现金；居民与原物留在其真实位置，城内返回仍需沿公共路另行步行。');
  } else {
    need(site.review === null, '这件居民事务已经当面复核，不会重新刷新危险、居民、耗材或奖励。');
    if (command.type === 'ASK_PERMISSION') {
      const people = sitePeople(s, command.serviceId);
      need(people.length > 0 && people.some(person => person.consent === null), '本次询问已有回答；拒绝或撤回不能靠重问恢复。');
      need(people.every(person => person.consent === null || person.consent.status === 'ALLOW'), '已有拒绝或撤回；只能停工并使用普通退路。');
      if (command.serviceId === 'residue-sealing') moveRoom(room.keeperPosition);
      else crossWharf(w.completion ? wharf.safePosition : wharf.unsafePosition);
      site.visitId = h.eventId; site.accessVersion += 1; site.stopped = false; site.surveyVisitId = null;
      for (const person of people) {
        need(person.status === 'ACTIVE' && person.health > 0 && person.location === site.location &&
          person.position === site.playerPosition, '本人必须面对在场的同一活居民询问，不能远程取得同意。');
        const permission: DeathPermission = { personId: person.id, actorId: h.actorId, purpose: 'SERVICE', status: person.willingness,
          eventId: h.eventId, week: h.week, revision: h.revision, location: site.location, conditionVersion: person.conditionVersion };
        person.consent = permission; permissionEvents.push(clone(permission));
      }
      wait(command.serviceId === 'residue-sealing' ? room.permissionSeconds : wharf.permissionSeconds);
      notes.push('逐人当面询问本次现场作业；原有意愿只形成这次实际回答，不预先颁发许可，也不消除拒绝或撤回。');
    } else if (command.type === 'SURVEY') {
      permitted(); need(!site.completion && site.surveyVisitId !== site.visitId, '本次已勘查，或原事务已实际完成。');
      if (command.serviceId === 'residue-sealing') { moveRoom(room.workbenchPosition); wait(room.surveySeconds); }
      else { crossWharf(wharf.safePosition); crossWharf(wharf.unsafePosition); wait(wharf.surveySeconds); w.endpoints.surveyedEventId = h.eventId; }
      site.surveyVisitId = site.visitId; site.survey = completion();
      notes.push(command.serviceId === 'residue-sealing' ? '本人走到六米外，实查同一容器、原盖、原屏与入口。'
        : '本人实际走过原十二米桥，分别检查两端、木料和锚点；脚步造成的原桥绳磨损已经记录。');
    } else if (command.type === 'BUY_SUPPLIES') {
      permitted(); need(!site.completion, '已经完成的原事务不再采购耗材。');
      if (command.serviceId === 'residue-sealing') {
        moveRoom(room.entrancePosition); purchase(r.supply.id, r.supply, room.supplyPrice); wait(wharf.purchaseSeconds);
        moveRoom(room.workbenchPosition, false, true);
      } else {
        crossWharf(wharf.safePosition); purchase(w.rope.id, w.rope, wharf.supplyPrice); wait(wharf.purchaseSeconds);
      }
      notes.push('实际在入口交接唯一一份新耗材，4便士由引擎扣除；封材另亲手送到工作台，绳存于岸边交接点，未用物资在现场保留本人所有权，不随城内离场瞬移。');
    } else if (command.type === 'OBSERVE_PROPAGATION') {
      permitted(); surveyed(); need(!r.completion && r.observedVisitId !== r.visitId, '本次已经观察，或原容器已经归还。');
      moveRoom(room.workbenchPosition); wait(room.observationSeconds); r.observedEventId = h.eventId; r.observedVisitId = r.visitId;
      r.propagation.visible = true; r.propagation.version += 1;
      notes.push('亲见同一容器到工作台的有限传播线；四份残余不增生，观察不会制造灵魂或自动封存。');
    } else if (command.type === 'POSITION_SCREEN') {
      residueWorking(); need(r.shielded === null && r.apparatus.screen === 'ASIDE' && !r.completion, '原屏已实际架起，不能再次扣行动或重复完成。');
      r.apparatus.screen = 'SHIELDING'; r.apparatus.screenVersion += 1; r.apparatus.version += 1;
      r.propagation.blocked = true; r.propagation.version += 1; effect.actions = 1; wait(room.screenSeconds); r.shielded = completion();
      notes.push('实用1行动、120秒架起原屏，拦住当前有限传播；不施术、不抽骰、不吸取灵魂。');
    } else if (command.type === 'CLOSE_LID') {
      residueWorking(); need(r.shielded !== null && r.apparatus.screen === 'SHIELDING' && r.propagation.blocked &&
        r.apparatus.lid === 'OPEN' && r.apparatus.seal === 'NONE', '先手动屏蔽；原盖只能从真实敞开状态合上。');
      r.apparatus.lid = 'CLOSED'; r.apparatus.lidVersion += 1; r.apparatus.containerVersion += 1; r.apparatus.version += 1;
      r.residue.contained += r.residue.exposed; r.residue.exposed = 0; r.residue.conditionVersion += 1;
      wait(room.lidSeconds); notes.push('用原盖实际罩住同一容器的全部四份残余，耗时60秒；不增加行动费用，也不改变总量。');
    } else if (command.type === 'SEAL_CONTAINER') {
      residueWorking(); need(r.apparatus.lid === 'CLOSED' && r.apparatus.seal === 'NONE' && r.apparatus.screen === 'SHIELDING' &&
        r.supply.stock === 1 && r.supply.holder === 'PLAYER' && r.supply.position === room.workbenchPosition && r.supply.boughtEventId !== null && r.supply.usedEventId === null,
        '必须先合原盖，并持有已实际付费且尚未使用的唯一封材。');
      const versionBefore = r.supply.version;
      r.supply.stock = 0; r.supply.holder = 'USED'; r.supply.usedEventId = h.eventId; r.supply.version += 1;
      r.apparatus.seal = 'INTACT'; r.apparatus.containerVersion += 1; r.apparatus.lidVersion += 1; r.apparatus.version += 1;
      stockChanges.push({ objectId: r.supply.id, stockBefore: 1, stockAfter: 0, holderBefore: 'PLAYER', holderAfter: 'USED', versionBefore, versionAfter: r.supply.version });
      effect.actions = 1; wait(room.sealSeconds); notes.push('实用第二个行动和唯一已付4便士封材封住原盖，90秒完成；耗材用尽，不另收费。');
    } else if (command.type === 'RETURN_CONTAINER') {
      permitted(); need(r.apparatus.seal === 'INTACT' && r.apparatus.lid === 'CLOSED' && r.supply.usedEventId !== null &&
        r.apparatus.returnedEventId === null && r.apparatus.containerPosition === room.workbenchPosition,
        '只有这只实际合盖封好的原容器可以归还，不能以一句完成替代搬运。');
      moveRoom(room.workbenchPosition); moveRoom(room.returnedPosition, true); wait(room.handoverSeconds);
      r.apparatus.returnedEventId = h.eventId; r.completion = completion();
      notes.push('本人将同一封存容器、原盖和其中四份残余实际搬回六米外保管人处，当面交还；原屏仍在工作台。');
    } else if (command.type === 'LAY_ROPE') {
      permitted(); surveyed(); need(w.rope.holder === 'PLAYER' && w.rope.stock === 1 && w.rope.boughtEventId !== null &&
        w.rope.installedEventId === null && w.rope.spentMetres === 0 && !w.completion, '须持有唯一已买的新绳段，不能重复铺设或补绳。');
      crossWharf(wharf.safePosition); crossWharf(wharf.unsafePosition, undefined, true); wait(wharf.layingSeconds);
      const versionBefore = w.rope.version;
      w.rope.stock = 0; w.rope.holder = 'INSTALLED'; w.rope.spentMetres = wharf.ropeMetres;
      w.rope.position = null; w.rope.installedSpan = { from: 0, to: 12, metres: 16 };
      w.rope.installedEventId = h.eventId; w.rope.condition -= wharf.ropeLayingWear; w.rope.version += 1;
      stockChanges.push({ objectId: w.rope.id, stockBefore: 1, stockAfter: 0, holderBefore: 'PLAYER', holderAfter: 'INSTALLED', versionBefore, versionAfter: w.rope.version });
      notes.push('实际布好原十六米绳段，横跨十二米，两端各系两米；库存用尽且绳实际磨损2，不新增绳段或行动费用。');
    } else if (command.type === 'SUPPORT_BRIDGE') {
      permitted(); surveyed(); need(w.rope.installedEventId !== null && w.rope.holder === 'INSTALLED' && !w.bridge.supported &&
        w.rope.condition >= wharf.minimumEscortRopeCondition + wharf.ropeTensionWear + 2 && !w.completion, '先实际布绳；原桥只稳定一次，损坏绳不能提供支撑。');
      crossWharf(wharf.safePosition); crossWharf(wharf.unsafePosition); wait(wharf.supportSeconds);
      w.rope.condition -= wharf.ropeTensionWear; w.rope.version += 1; w.bridge.supported = true; w.bridge.version += 1;
      notes.push('本人分别检查两端并拉紧同一绳段扶稳原桥，绳再磨损2；旧木料条件不回升，不产生替代桥。');
    } else if (command.type === 'ESCORT_WORKER') {
      surveyed(); const person = w.workers.find(worker => worker.id === command.workerId)!;
      need(currentPermission(person, w, h) && person.position === wharf.unsafePosition && !w.arrivals.some(row => row.workerId === person.id),
        '这名原工人须仍在工作岸并保持本次同意；已到岸者不能刷新回去再护送。');
      crossWharf(wharf.unsafePosition); wait(wharf.escortHandlingSeconds);
      const ropeBefore = w.rope.condition;
      crossWharf(wharf.safePosition, person); effect.actions = 1;
      w.arrivals.push({ workerId: person.id as typeof DEATH_WORKER_IDS[number], eventId: h.eventId, week: endWeek(), second: h.nowSecond + effect.seconds,
        route: 'BRIDGE_ROPE', from: 0, to: 12, metres: 12, seconds: 12,
        energyCost: person.id === PEOPLE.firstWorker.id ? wharf.firstWorkerEnergyCost : wharf.secondWorkerEnergyCost,
        ropeConditionBefore: ropeBefore, ropeConditionAfter: w.rope.condition });
      if (w.arrivals.length === 2) w.completion = completion();
      notes.push(`${person.name}与本人实际走完原十二米桥，单独使用1行动；精力实际减少，身体、健康与原伤不被治疗或替换。`);
    } else if (command.type === 'VERIFY_SERVICE') {
      need(site.completion !== null, '先完成原容器实际归还，或让两名原工人分别实际到岸。');
      if (command.serviceId === 'residue-sealing') {
        permitted(); moveRoom(room.keeperPosition); need(r.apparatus.returnedEventId === r.completion!.eventId && r.apparatus.seal === 'INTACT' &&
          r.residue.contained === 4 && r.residue.exposed === 0 && r.residue.dissipated === 0, '当面复核必须看到同一完整封存容器和原四份残余。');
        wait(room.reviewSeconds);
      } else {
        // Arrival fulfils the agreed crossing. Review asks no new physical
        // movement and cannot require or reconstruct a spent escort consent.
        crossWharf(wharf.safePosition);
        need(w.arrivals.length === 2 && w.workers.every(person => person.status === 'ACTIVE' && person.health > 0 &&
          person.location === w.location && person.position === wharf.safePosition),
          '必须在安全岸亲见两名原工人的实际身体与各自到岸记录。');
        wait(wharf.reviewSeconds);
      }
      site.review = completion(); notes.push('当面复核原人原物的真实末态，形成永久完成记录；不发现金、灵魂、治疗、额外掌握或行动点。');
    } else need(false, '当前服务没有这项实际操作。');
  }
  need(integer(h.cash) && integer(h.actions) && h.cash >= effect.cashCost && h.actions >= effect.actions,
    `本次实际操作需要${effect.cashCost}便士与${effect.actions}行动；停工和普通退回入口均不需要现金或行动。`);
  need(effect.seconds > 0 && effect.cashGain === 0 && effect.spirituality === 0 && effect.mind === 0 && effect.health === 0 && effect.toLocation === null,
    '普通服务不得暗中施术、治疗、发钱或远程移到城内另一地点。');
  const after = deathServiceConditionVersions(s);
  const event: DeathServiceRuntimeEvent = { id: h.eventId, revision: h.revision, command: clone(command), week: h.week, endWeek: endWeek(),
    beforeSecond: h.nowSecond, afterSecond: h.nowSecond + effect.seconds, conditionVersionsBefore: before, conditionVersionsAfter: after,
    movements: clone(movements), consumedIds: stockChanges.filter(row => row.stockAfter < row.stockBefore).map(row => row.objectId),
    effect: clone(effect), notes: clone(notes), permissionEvents, stockChanges };
  s.journal.push(event); s.lastSecond = event.afterSecond; assertServices(s);
  return { state: s, effect, injuries: [], movements, notes };
}
export function deathServicesBlock(state: DeathServicesState, command: DeathServiceCommand, host: DeathHost): string | null {
  try { execute(state, command, host); return null; }
  catch (error) { return error instanceof Error ? error.message : '同一服务的当前身体、原物或记录无效。'; }
}
export function applyDeathServices(state: DeathServicesState, command: DeathServiceCommand, host: DeathHost): DeathServicesResult {
  return execute(state, command, host);
}
export function deathServiceVerifiedReceipts(input: DeathServicesState): DeathServiceReceipt[] {
  assertServices(input); const receipts: DeathServiceReceipt[] = [];
  for (const site of [input.residue, input.wharf]) {
    if (site.review === null) continue;
    need(site.completion !== null, '复核不能凭空补一件完成事务。');
    const passed = input.journal.find(event => event.id === site.completion!.eventId);
    const reviewed = input.journal.find(event => event.id === site.review!.eventId);
    need(passed && reviewed && passed.command.serviceId === site.id && reviewed.command.serviceId === site.id &&
      passed.command.type === (site.id === 'residue-sealing' ? 'RETURN_CONTAINER' : 'ESCORT_WORKER') &&
      reviewed.command.type === 'VERIFY_SERVICE' && reviewed.revision > passed.revision &&
      passed.afterSecond === site.completion.second && reviewed.afterSecond === site.review.second &&
      passed.endWeek === site.completion.week && reviewed.endWeek === site.review.week &&
      versionsEqual(site.completion.conditionVersions, passed.conditionVersionsAfter) &&
      versionsEqual(site.review.conditionVersions, reviewed.conditionVersionsAfter), '完成与复核必须来自这件原事务的真实顺序回执。');
    const events = input.journal.filter(event => event.command.serviceId === site.id);
    need(events.reduce((sum, event) => sum + event.effect.cashCost, 0) === 4 &&
      events.reduce((sum, event) => sum + event.effect.actions, 0) === 2 &&
      events.filter(event => event.command.type === 'BUY_SUPPLIES').length === 1, '两件普通服务各只能实付4便士与2行动。');
    const residentIds = site.id === 'residue-sealing' ? [input.residue.custodian.id] : input.wharf.workers.map(person => person.id);
    const apparatusIds = site.id === 'residue-sealing' ? [input.residue.apparatus.containerId, input.residue.apparatus.lidId, input.residue.apparatus.screenId, input.residue.supply.id]
      : [input.wharf.bridge.id, input.wharf.rope.id];
    receipts.push({ serviceId: site.id, residentIds, apparatusIds, passedEventId: site.completion.eventId,
      passedWeek: site.completion.week, reviewedEventId: site.review.eventId, reviewedWeek: site.review.week,
      conditionVersions: clone(site.review.conditionVersions) });
  }
  return receipts;
}
export function canLeaveDeathServices(input: DeathServicesState, location: string): boolean {
  try {
    assertServices(input);
    if (location === input.residue.location) return input.residue.ordinaryExit === 'OPEN' && input.residue.playerPosition === room.entrancePosition;
    if (location === input.wharf.location) return input.wharf.ordinaryExit === 'OPEN' && input.wharf.retreat.open && input.wharf.playerPosition === wharf.safePosition;
    return true;
  } catch { return false; }
}
export function leaveDeathServices(input: DeathServicesState, from: string, to: string, eventId: string): DeathServicesRuntimeState {
  assertServices(input); need(text(from) && text(to) && text(eventId), '离场须记录同一实际出入口和事件。');
  const s = clone(input); if (from === to) return s;
  need(canLeaveDeathServices(s, from), '先停手，并沿已登记普通路线实际走回入口；不能通过城内旅行跳过现场移动。');
  if (from === s.residue.location) stopSite(s, 'residue-sealing');
  if (from === s.wharf.location) stopSite(s, 'old-wharf-exit');
  // Arrival cannot renew permission or relocate a worker/container. The engine
  // separately records the city walking distance and its actual elapsed time.
  assertServices(s); return s;
}

const SERVICE_LABELS: Record<DeathServiceCommand['type'], string> = {
  ASK_PERMISSION: '当面询问本次许可', SURVEY: '实查原物与普通退路', BUY_SUPPLIES: '购买并搬运唯一耗材',
  VERIFY_SERVICE: '当面复核真实完成', STOP_SERVICE: '停止本次作业', RETURN_ON_FOOT: '普通步行回入口',
  OBSERVE_PROPAGATION: '观察原罐有限传播', POSITION_SCREEN: '架起原屏', CLOSE_LID: '合上原盖',
  SEAL_CONTAINER: '使用已付封材封罐', RETURN_CONTAINER: '搬回并归还同一原罐', LAY_ROPE: '铺设同一绳段',
  SUPPORT_BRIDGE: '检查并拉紧原绳', ESCORT_WORKER: '陪同原工人实际过桥',
};
function serviceCommands(id: DeathServiceId): DeathServiceCommand[] {
  const common: DeathServiceCommand[] = [{ type: 'ASK_PERMISSION', serviceId: id }, { type: 'SURVEY', serviceId: id }];
  const work: DeathServiceCommand[] = id === 'residue-sealing'
    ? (['OBSERVE_PROPAGATION', 'BUY_SUPPLIES', 'POSITION_SCREEN', 'CLOSE_LID', 'SEAL_CONTAINER', 'RETURN_CONTAINER'] as const)
      .map(type => ({ type, serviceId: id }))
    : [{ type: 'BUY_SUPPLIES', serviceId: id }, { type: 'LAY_ROPE', serviceId: id }, { type: 'SUPPORT_BRIDGE', serviceId: id },
      ...DEATH_WORKER_IDS.map(workerId => ({ type: 'ESCORT_WORKER' as const, serviceId: id, workerId }))];
  return [...common, ...work, { type: 'VERIFY_SERVICE', serviceId: id }, { type: 'RETURN_ON_FOOT', serviceId: id }, { type: 'STOP_SERVICE', serviceId: id }];
}
/** Suggestions are derived afresh from this finite scene. The engine still
 * validates the actual intent and current economy before execution. */
export function getDeathServiceActions(state: DeathServicesState, h: DeathHost, serviceId?: DeathServiceId) {
  const ids = serviceId ? [serviceId] : DEATH_SERVICE_IDS.filter(id =>
    (id === 'residue-sealing' ? state.residue.location : state.wharf.location) === h.location);
  const actions = ids.flatMap(id => serviceCommands(id).map(command => {
    let reason: string | null = null, effect: DeathEffect | null = null;
    try { effect = execute(state, command, h).effect; }
    catch (error) { reason = error instanceof Error ? error.message : '当前不能操作。'; }
    const ap = command.type === 'POSITION_SCREEN' || command.type === 'SEAL_CONTAINER' || command.type === 'ESCORT_WORKER' ? 1 : 0;
    const cash = command.type === 'BUY_SUPPLIES' ? 4 : 0;
    const worker = command.type === 'ESCORT_WORKER' ? state.wharf.workers.find(p => p.id === command.workerId) : null;
    return { command, label: worker ? `陪${worker.name}实际过桥` : SERVICE_LABELS[command.type],
      cost: `${effect?.cashCost ?? cash}便士 / ${effect?.actions ?? ap}行动${effect ? ` / ${effect.seconds}秒` : '；含实际步行与操作时间'}`,
      enabled: reason === null, reason, preferredAction: false };
  }));
  // Do not re-open a visit just to rediscover the same unaffordable principal
  // step. From inside, take the real ordinary exit; from its entrance, retain
  // the blocked next step so the chapter can recommend actual work at home.
  let resourceStep: DeathServiceCommand | null = null;
  if (ids.includes('residue-sealing') && state.residue.review === null) {
    const r = state.residue;
    if (r.supply.holder === 'SUPPLIER' && h.cash < room.supplyPrice)
      resourceStep = { type: 'BUY_SUPPLIES', serviceId: r.id };
    else if (h.actions < 1 && !r.shielded) resourceStep = { type: 'POSITION_SCREEN', serviceId: r.id };
    else if (h.actions < 1 && r.apparatus.lid === 'CLOSED' && r.apparatus.seal === 'NONE')
      resourceStep = { type: 'SEAL_CONTAINER', serviceId: r.id };
  }
  if (ids.includes('old-wharf-exit') && state.wharf.review === null) {
    const w = state.wharf;
    if (w.rope.holder === 'SUPPLIER' && h.cash < wharf.supplyPrice)
      resourceStep = { type: 'BUY_SUPPLIES', serviceId: w.id };
    else if (h.actions < 1 && w.bridge.supported) {
      const worker = w.workers.find(p => p.position === wharf.unsafePosition);
      if (worker) resourceStep = { type: 'ESCORT_WORKER', serviceId: w.id, workerId: worker.id };
    }
  }
  const preferred = resourceStep
    ? canLeaveDeathServices(state, h.location)
      ? actions.find(action => action.command.type === resourceStep!.type && action.command.serviceId === resourceStep!.serviceId)
      : actions.find(action => action.enabled && action.command.type === 'RETURN_ON_FOOT')
    : actions.find(action => action.enabled && action.command.type !== 'STOP_SERVICE');
  if (preferred) preferred.preferredAction = true;
  return actions;
}
export function nextDeathServiceCommand(state: DeathServicesState, h: DeathHost, serviceId?: DeathServiceId): DeathServiceCommand | null {
  const pending = serviceId ? [serviceId] : DEATH_SERVICE_IDS.filter(id =>
    (id === 'residue-sealing' ? state.residue : state.wharf).review === null);
  const current = pending.find(id => (id === 'residue-sealing' ? state.residue : state.wharf).location === h.location);
  if (current) return getDeathServiceActions(state, h, current).find(action => action.preferredAction)?.command ?? null;
  // A travel suggestion is not execution authority. Once there, the full
  // current visit/body/permission guard selects the next real action again.
  const target = pending[0];
  return target ? { type: 'ASK_PERMISSION', serviceId: target } : null;
}
/** Completed service snapshots remain historical after the epilogue takes
 * ownership of the same bodies and vessel. The chapter projection selects it. */
export function projectDeathServices(state: DeathServicesState) {
  assertServices(state);
  const r = state.residue, w = state.wharf;
  const answer = (p: DeathPermission | null) => p === null ? '尚未询问' : p.status === 'ALLOW' ? '同意' : p.status === 'REFUSED' ? '拒绝' : '已撤回';
  const place = (location: string) => location === r.location ? '街区保管室' : location === w.location ? '旧码头' : '已离开原现场';
  const lid = r.apparatus.lid === 'CLOSED' ? '已合上' : '敞开';
  const seal = r.apparatus.seal === 'INTACT' ? '完好' : r.apparatus.seal === 'BROKEN' ? '已破损' : '尚未封缄';
  const supply = r.supply.holder === 'SUPPLIER' ? '尚未购买' : r.supply.holder === 'PLAYER' ? '已购并存放现场' : '已经实耗';
  const rope = w.rope.holder === 'SUPPLIER' ? '尚未购买' : w.rope.holder === 'PLAYER' ? '已购并存放岸边' : '已经铺好';
  const sections = [{ id: r.id, title: '街区保管室', lines: [
    `原四份无智能残余：暴露${r.residue.exposed}、封存${r.residue.contained}、消散${r.residue.dissipated}；总量${r.residue.total}。`,
    `同罐在${r.apparatus.containerPosition}米处，原盖${lid}，封条${seal}；唯一封材${supply}。`,
    `本人在${r.playerPosition}米处；${r.custodian.name}在${place(r.custodian.location)}，本次回答${answer(r.custodian.consent)}。`,
    `费用4便士、两项各1行动；普通停工与步行退出不耗现金或行动。${r.review ? '已当面复核，记录永久保留。' : '尚未完成当面复核。'}`,
  ] }, { id: w.id, title: '旧码头绳桥', lines: [
    ...w.workers.map(p => `${p.name}：${place(p.location)}的${p.position === 0 ? '工作岸' : '安全岸'}（${p.position}米），健康${p.health}，精力${p.energy}，原伤${p.injuries.length}项；本次回答${answer(p.consent)}。`),
    `同一十二米桥条件${w.bridge.condition}，原十六米绳条件${w.rope.condition}、${rope}；实际到岸${w.arrivals.length}/2人。`,
    `本人在${w.playerPosition}米处；十八米公共岸路可普通退场。费用4便士，每人实际护送各1行动。${w.review ? '两人均已当面复核。' : '尚未完成当面复核。'}`,
  ] }];
  return { sections, lines: sections.flatMap(section => section.lines), completed: deathServiceVerifiedReceipts(state).length === 2 };
}

/** Minimum resources for the next unfinished principal step of the selected
 * original job. Closure/review after paid principal work need no new AP. */
export function deathServiceRequiredResources(state: DeathServicesState, location?: string) {
  const pending = [state.residue, state.wharf].filter(site => site.review === null);
  const site = pending.find(site => site.location === location) ?? pending[0];
  if (!site) return null;
  if (site.id === 'residue-sealing') return { serviceId: site.id, location: site.location,
    cash: state.residue.supply.holder === 'SUPPLIER' ? room.supplyPrice : 0,
    actions: state.residue.shielded === null || state.residue.apparatus.seal === 'NONE' ? 1 : 0 };
  return { serviceId: site.id, location: site.location,
    cash: state.wharf.rope.holder === 'SUPPLIER' ? wharf.supplyPrice : 0,
    actions: state.wharf.arrivals.length < 2 ? 1 : 0 };
}
