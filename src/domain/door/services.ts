/** Actual ordinary work with finite material, bodies and physical routes. */
import { DOOR_JOBS, DOOR_SERVICE_TERMS as T } from './service-content.js';
import { DOOR_JOB_IDS, type DoorEnd, type DoorJobId, type DoorJobState,
  type DoorPermission, type DoorPerson, type DoorRole, type DoorServiceCommand,
  type DoorServiceEffect, type DoorServiceEvent, type DoorServiceHost,
  type DoorServiceResult, type DoorServicesState, type DoorSiteChange,
  type DoorMovement } from './service-types.js';
import type { DoorHost, DoorModuleResult } from './ports.js';
import type { DoorServiceReceipt } from './types.js';
import { stableStringify } from '../canonical.js';
export type { DoorServiceCommand, DoorServicesState, DoorJobId, DoorSiteChange } from './service-types.js';
export { DOOR_JOBS } from './service-content.js';

const clone = <V>(value: V): V => structuredClone(value);
const integer = (v: unknown, minimum = 0): v is number => Number.isSafeInteger(v) && (v as number) >= minimum;
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300;
function need(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
const emptyEffect = (): DoorServiceEffect => ({ cashCost: 0, cashGain: 0, actions: 0,
  seconds: 0, health: 0, mind: 0, spirituality: 0, randomDraws: 0 });
const endVersions = (j: DoorJobState) => ({ FROM: j.ends.FROM.version, TO: j.ends.TO.version });
const sameEnds = (a: Record<DoorEnd, number>, j: DoorJobState) =>
  a.FROM === j.ends.FROM.version && a.TO === j.ends.TO.version;
const payloadId = (j: DoorJobState) => j.payload.kind === 'PERSON' ? j.payload.person.id : j.payload.id;
const payloadAt = (j: DoorJobState) => j.payload.kind === 'PERSON' ? j.payload.person.position : j.payload.position;
const personAtRole = (j: DoorJobState, role: DoorRole): DoorPerson => {
  if (role === 'OWNER') return j.owner;
  if (role === 'RECEIVER') return j.receiver;
  need(j.payload.kind === 'PERSON', '这项货物工作没有可被替换成搬运者的居民。');
  return j.payload.person;
};
function person(identity: { id: string; bodyId: string; name: string; age: number }, position: DoorEnd): DoorPerson {
  return { ...identity, status: 'ACTIVE', health: 100, energy: 80, injuries: [],
    position, willingness: 'ALLOW', version: 1, travelledMetres: 0 };
}
function createJob(id: DoorJobId): DoorJobState {
  const d = DOOR_JOBS[id];
  return { id, visitId: null, stopped: true,
    ends: { FROM: { id: d.ends.FROM.id, access: 'OPEN', version: 1 }, TO: { id: d.ends.TO.id, access: 'OPEN', version: 1 } },
    owner: person(d.owner, 'FROM'), receiver: person(d.receiver, 'TO'),
    payload: d.payload.kind === 'PERSON' ? { kind: 'PERSON', person: person(d.payload, 'FROM') }
      : { kind: 'CARGO', id: d.payload.id, ownerId: d.payload.ownerId, units: 1,
        position: 'FROM', holderId: d.payload.ownerId, version: 1 },
    permission: { OWNER: null, RECEIVER: null, TRAVELLER: null }, surveyed: { FROM: null, TO: null },
    route: { id: d.apparatusId, version: 1, condition: d.initialCondition, repaired: false,
      passable: false, oldPartId: d.oldPartId, oldPartPosition: 'BLOCKING', repairEventId: null },
    bypass: { id: d.bypassId, version: 1, open: true, metres: d.bypassMetres },
    supply: { id: d.supplyId, units: 1, holder: 'SUPPLIER', position: 'FROM', version: 1,
      boughtEventId: null, usedEventId: null }, arrivals: [], review: null };
}
export function createDoorServices(runId: string, actorId: string, week: number, second: number): DoorServicesState {
  need(text(runId) && text(actorId) && integer(week, 1) && integer(second), '缺少同一周目、本人或真实起点。');
  const state: DoorServicesState = { version: 1, runId, actorId,
    startWeek: week, startSecond: second, lastSecond: second, activeJobId: null, playerPosition: 'OUTSIDE',
    jobs: { 'ledger-threshold': createJob('ledger-threshold'), 'courtyard-stair': createJob('courtyard-stair'),
      'warehouse-gate': createJob('warehouse-gate') }, journal: [] };
  assertDoorServices(state); return state;
}
/** Narrow invariant guard, not a product save decoder or historical replay. */
export function assertDoorServices(s: DoorServicesState): void {
  need(s.version === 1 && text(s.runId) && text(s.actorId) &&
    integer(s.startWeek, 1) && integer(s.startSecond) && integer(s.lastSecond) && s.lastSecond >= s.startSecond,
    '服务状态起点无效。');
  need(Object.keys(s.jobs).sort().join('|') === [...DOOR_JOB_IDS].sort().join('|'), '只能有三件原事务。');
  need(s.activeJobId === null ? s.playerPosition === 'OUTSIDE'
    : DOOR_JOB_IDS.includes(s.activeJobId) && (s.playerPosition === 'FROM' || s.playerPosition === 'TO'),
    '本人不能同时出现在三处现场。');
  const originalIds: string[] = [];
  for (const id of DOOR_JOB_IDS) {
    const j = s.jobs[id], d = DOOR_JOBS[id];
    need(j.id === id && j.ends.FROM.id === d.ends.FROM.id && j.ends.TO.id === d.ends.TO.id,
      '不能把原两端静默改名为另一条路线。');
    for (const end of ['FROM', 'TO'] as const) need(integer(j.ends[end].version, 1) &&
      ['OPEN', 'CLOSED'].includes(j.ends[end].access), '原端点版本或通行状态无效。');
    const pairs = [[j.owner, d.owner], [j.receiver, d.receiver]] as const;
    for (const [p, identity] of pairs) {
      need(p.id === identity.id && p.bodyId === identity.bodyId && p.name === identity.name && p.age === identity.age,
        '同一委托人和接收人不能被替换或复制。');
    }
    need((j.owner.position === 'FROM' || j.owner.position === 'AWAY') &&
      (j.receiver.position === 'TO' || j.receiver.position === 'AWAY'), '两端原人不能凭改字段对调接收位置。');
    const people = [j.owner, j.receiver];
    if (j.payload.kind === 'PERSON') {
      need(d.payload.kind === 'PERSON' && j.payload.person.id === d.payload.id &&
        j.payload.person.bodyId === d.payload.bodyId && j.payload.person.name === d.payload.name && j.payload.person.age === d.payload.age,
        '陪行者必须是原成年人的同一身体。');
      people.push(j.payload.person);
    } else {
      need(d.payload.kind === 'CARGO' && j.payload.id === d.payload.id && j.payload.ownerId === d.payload.ownerId &&
        j.payload.units === 1 && ['FROM', 'TO'].includes(j.payload.position) && integer(j.payload.version, 1) &&
        [j.owner.id, j.receiver.id, s.actorId].includes(j.payload.holderId), '原箱数量、所有权、位置或持有人无效。');
      originalIds.push(j.payload.id);
      if (j.payload.holderId === s.actorId) need(s.activeJobId === id && s.playerPosition === j.payload.position,
        '本人持有的原箱必须与本人同处一端，不能远程携带。');
    }
    for (const p of people) {
      need(p.age > 18 && integer(p.health) && p.health <= 100 && integer(p.energy) && p.energy <= 80 &&
        integer(p.version, 1) && integer(p.travelledMetres) && ['FROM', 'TO', 'AWAY'].includes(p.position) &&
        ['ACTIVE', 'DEAD'].includes(p.status) && ['ALLOW', 'REFUSED', 'WITHDRAWN'].includes(p.willingness) &&
        Array.isArray(p.injuries), '原人的身体、精力、位置或意愿无效。');
      originalIds.push(p.id, p.bodyId);
    }
    need(j.route.id === d.apparatusId && j.route.oldPartId === d.oldPartId && integer(j.route.version, 1) &&
      integer(j.route.condition) && j.route.condition <= d.initialCondition &&
      j.bypass.id === d.bypassId && j.bypass.metres === d.bypassMetres && j.bypass.open === true &&
      integer(j.bypass.version, 1), '原通路、旧件和始终存在的普通退路不能被换新。');
    need(j.supply.id === d.supplyId && j.supply.position === 'FROM' && integer(j.supply.version, 1) &&
      ['SUPPLIER', 'PLAYER', 'INSTALLED'].includes(j.supply.holder), '只能有这一份原普通修料。');
    need(j.supply.holder === 'INSTALLED'
      ? j.supply.units === 0 && text(j.supply.boughtEventId) && text(j.supply.usedEventId) &&
        j.route.repaired && text(j.route.repairEventId) && j.route.oldPartPosition === 'ASIDE'
      : j.supply.units === 1 && j.supply.usedEventId === null && !j.route.repaired &&
        j.route.repairEventId === null && j.route.oldPartPosition === 'BLOCKING' &&
        (j.supply.holder === 'PLAYER' ? text(j.supply.boughtEventId) : j.supply.boughtEventId === null),
      '修料必须经过唯一实购、实耗与原旧件移位，不能补货或倒流。');
    need(!j.route.passable || j.route.repaired, '未修好的原短路不能被标成通行。');
    originalIds.push(j.route.id, j.route.oldPartId, j.supply.id, j.bypass.id, j.ends.FROM.id, j.ends.TO.id);
    if (j.review) need(j.arrivals.some(a => a.eventId === j.review!.arrivalEventId && a.subjectId === payloadId(j)) &&
      j.review.receiverId === j.receiver.id && j.review.subjectId === payloadId(j), '交接必须引用原人原物的真实到达。');
  }
  need(new Set(originalIds).size === originalIds.length, '不能在不同事务中复制任何原身份。');
  need(new Set(s.journal.map(e => e.id)).size === s.journal.length, '同一服务回执不得重复。');
}
export function validateDoorServiceCommand(value: unknown): value is DoorServiceCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  if (!DOOR_JOB_IDS.some(id => id === c.jobId) || typeof c.type !== 'string') return false;
  const keys = Object.keys(c).sort().join('|');
  if (c.type === 'WALK_BYPASS' || c.type === 'SURVEY_END')
    return keys === 'end|jobId|type' && (c.end === 'FROM' || c.end === 'TO');
  if (c.type === 'ASK_PERSON') return keys === 'jobId|role|type' &&
    ['OWNER', 'RECEIVER', 'TRAVELLER'].includes(String(c.role)) && (c.role !== 'TRAVELLER' || c.jobId === 'courtyard-stair');
  if (keys !== 'jobId|type') return false;
  const d = DOOR_JOBS[c.jobId as DoorJobId];
  return ['ENTER', 'BUY_SUPPLIES', 'VERIFY_ARRIVAL', 'STOP', 'RETURN_ON_FOOT', 'LEAVE', d.repair, d.transfer].includes(c.type);
}
function hostGuard(s: DoorServicesState, h: DoorServiceHost): void {
  need(h.runId === s.runId && h.actorId === s.actorId && h.status === 'ACTIVE' && h.sequence === 1 && h.health > 0,
    '必须是同一在世星之匙本人。');
  need(text(h.eventId) && !s.journal.some(e => e.id === h.eventId) && integer(h.revision, 1) &&
    h.revision > (s.journal.at(-1)?.revision ?? 0) && integer(h.week, s.journal.at(-1)?.endWeek ?? s.startWeek) &&
    integer(h.nowSecond, s.lastSecond) && integer(h.secondsIntoWeek) && h.secondsIntoWeek < 604800 &&
    integer(h.cash) && integer(h.actions) && integer(h.health) && integer(h.mind) && integer(h.spirituality),
    '当前动作、资源或实际时序无效，不能重复结算。');
}
function permissionCurrent(j: DoorJobState, role: DoorRole): boolean {
  const p = personAtRole(j, role), receipt = j.permission[role];
  return !!receipt && !j.stopped && receipt.visitId === j.visitId && receipt.personId === p.id &&
    receipt.personVersion === p.version && receipt.response === 'ALLOW' && sameEnds(receipt.endVersions, j) &&
    p.status === 'ACTIVE' && p.health > 0 && p.position !== 'AWAY' && p.willingness === 'ALLOW';
}
function requireSurvey(j: DoorJobState): void {
  for (const end of ['FROM', 'TO'] as const) {
    const x = j.surveyed[end];
    need(x && x.visitId === j.visitId && x.endVersion === j.ends[end].version &&
      x.routeVersion === j.route.version && x.bypassId === j.bypass.id && x.bypassVersion === j.bypass.version,
      '须亲自重查当前两端与普通退路；旧路线版本的观察不能沿用。');
  }
}
function requirePermission(j: DoorJobState): void {
  need(permissionCurrent(j, 'OWNER') && permissionCurrent(j, 'RECEIVER'), '两端原人须保持本次明确许可。');
}
function finish(s: DoorServicesState, h: DoorServiceHost, command: DoorServiceCommand | DoorSiteChange,
  kind: DoorServiceEvent['kind'], effect: DoorServiceEffect, movements: DoorMovement[], consumedIds: string[],
  permission: DoorPermission | null, notes: string[]): DoorServiceResult {
  need(h.cash >= effect.cashCost && h.actions >= effect.actions, '原操作的现金或行动不足；普通停工和返回仍可执行。');
  need(integer(effect.seconds, 1) && integer(effect.cashCost) && integer(effect.actions) &&
    effect.cashGain === 0 && effect.health === 0 && effect.mind === 0 && effect.spirituality === 0 && effect.randomDraws === 0,
    '普通工作不能暗中发钱、疗伤、补灵性或消费随机数。');
  const event: DoorServiceEvent = { id: h.eventId, revision: h.revision, command: clone(command), kind,
    week: h.week, endWeek: h.week + Math.floor((h.secondsIntoWeek + effect.seconds) / 604800),
    beforeSecond: h.nowSecond, afterSecond: h.nowSecond + effect.seconds,
    host: clone(h), effect: clone(effect), movements,
    consumedIds, permission, notes };
  s.journal.push(event); s.lastSecond = event.afterSecond; assertDoorServices(s);
  return { state: s, effect, event };
}
function reduceDoorService(input: DoorServicesState, command: DoorServiceCommand, h: DoorServiceHost): DoorServiceResult {
  assertDoorServices(input); need(validateDoorServiceCommand(command), '只接受这三件事务的具体操作。'); hostGuard(input, h);
  const s = clone(input), j = s.jobs[command.jobId], d = DOOR_JOBS[command.jobId];
  need(h.location === d.location, '本人必须已经普通到达同一现场，服务不能代替城内旅行。');
  const effect = emptyEffect(), movements: DoorMovement[] = [], consumedIds: string[] = [], notes: string[] = [];
  let permission: DoorPermission | null = null;
  const at = (end: DoorEnd) => need(s.playerPosition === end, '先沿真实普通路线走到该端。');
  const move = (to: DoorEnd, routeId: string, metres: number) => {
    need(s.playerPosition === 'FROM' || s.playerPosition === 'TO', '本人尚未进入现场。');
    const from = s.playerPosition;
    need(from !== to, '已经在该端，不能用零距离刷移动回执。');
    movements.push({ subjectId: s.actorId, fromId: j.ends[from].id, toId: j.ends[to].id,
      routeId, metres, seconds: metres, carriedWithActor: false });
    effect.seconds += metres; s.playerPosition = to; return from;
  };
  if (command.type === 'ENTER') {
    need(s.activeJobId === null && s.playerPosition === 'OUTSIDE' && !j.review, '先实际离开当前现场，已完成事务不重置。');
    s.activeJobId = j.id; s.playerPosition = 'FROM'; j.visitId = h.eventId; j.stopped = false;
    j.permission = { OWNER: null, RECEIVER: null, TRAVELLER: null }; j.surveyed = { FROM: null, TO: null };
    effect.seconds = T.enterSeconds; notes.push('从发件端入口走进现场；居民和货物仍留在各自原处。');
  } else {
    need(s.activeJobId === j.id && j.visitId !== null, '只可操作本人当前所在的同一事务。');
    if (command.type === 'STOP') {
      j.stopped = true; j.permission = { OWNER: null, RECEIVER: null, TRAVELLER: null };
      j.surveyed = { FROM: null, TO: null }; effect.seconds = T.stopSeconds;
      notes.push('停止作业并关闭本次许可；已付费用、安装件、实际位置与历史到达都保留。');
    } else if (command.type === 'RETURN_ON_FOOT') {
      at('TO'); const carried = j.payload.kind === 'CARGO' && j.payload.holderId === s.actorId;
      move('FROM', j.bypass.id, j.bypass.metres);
      if (carried && j.payload.kind === 'CARGO') {
        movements.push({ subjectId: j.payload.id, fromId: j.ends.TO.id, toId: j.ends.FROM.id,
          routeId: j.bypass.id, metres: j.bypass.metres, seconds: j.bypass.metres, carriedWithActor: true });
        j.payload.position = 'FROM'; j.payload.holderId = j.payload.ownerId; j.payload.version += 1;
        notes.push('沿原绕行道带回同一未交接箱，放回原发件台；原所有权不变。');
      }
      notes.push('本人沿实际普通退路返回；不耗现金、行动或能力，不把留下的居民算作陪行到达。');
    } else if (command.type === 'LEAVE') {
      at('FROM'); need(j.payload.kind !== 'CARGO' || j.payload.holderId !== s.actorId, '先把实际持有的原箱放回发件台。');
      j.stopped = true; j.permission = { OWNER: null, RECEIVER: null, TRAVELLER: null };
      j.surveyed = { FROM: null, TO: null }; s.activeJobId = null; s.playerPosition = 'OUTSIDE';
      effect.seconds = T.leaveSeconds; notes.push('由同一发件端普通离场；城内下一段旅行另算。');
    } else {
      need(!j.stopped && !j.review, '当前作业已停或已经真实交接；仍能普通返回离场。');
      if (command.type === 'WALK_BYPASS') {
        need(j.payload.kind !== 'CARGO' || j.payload.holderId !== s.actorId, '携带未交接原箱时须明确选择普通归还。');
        move(command.end, j.bypass.id, j.bypass.metres); notes.push('本人实际绕行至另一端；没有移动任何货物或居民。');
      } else if (command.type === 'ASK_PERSON') {
        const p = personAtRole(j, command.role);
        need(p.status === 'ACTIVE' && p.health > 0 && p.position !== 'AWAY' && p.position === s.playerPosition,
          '必须当面询问仍在这一端的原人，不能替不在场者同意。');
        permission = { eventId: h.eventId, visitId: j.visitId, personId: p.id, personVersion: p.version,
          endVersions: endVersions(j), response: p.willingness };
        j.permission[command.role] = clone(permission); effect.seconds = T.askSeconds;
        notes.push(`${p.name}${p.willingness === 'ALLOW' ? '当面同意继续这件工作' : p.willingness === 'REFUSED' ? '当面拒绝了这件工作' : '撤回了先前的同意'}。`);
      } else if (command.type === 'SURVEY_END') {
        at(command.end); j.surveyed[command.end] = { eventId: h.eventId, visitId: j.visitId,
          endVersion: j.ends[command.end].version, routeVersion: j.route.version,
          bypassId: j.bypass.id, bypassVersion: j.bypass.version };
        effect.seconds = T.surveySeconds; notes.push('亲见该原端点与当前通路条件，只更新这一端的实际观察。');
      } else if (command.type === 'BUY_SUPPLIES') {
        at('FROM'); requirePermission(j); requireSurvey(j);
        need(j.supply.holder === 'SUPPLIER' && j.supply.units === 1 && j.supply.boughtEventId === null,
          '只有这一份尚未买下的真实修料，不能重复购入或补货。');
        j.supply.holder = 'PLAYER'; j.supply.boughtEventId = h.eventId; j.supply.version += 1;
        effect.cashCost = d.pricePennies; effect.seconds = T.buySeconds;
        notes.push(`实付${d.pricePennies}便士，把同一${d.supplyName}接到原发件端。`);
      } else if (command.type === d.repair) {
        at('FROM'); requirePermission(j); requireSurvey(j);
        need(j.supply.holder === 'PLAYER' && j.supply.units === 1 && !j.route.repaired &&
          j.ends.FROM.access === 'OPEN' && j.ends.TO.access === 'OPEN', '须持有已付原修料且当前两端允许操作。');
        j.supply.holder = 'INSTALLED'; j.supply.units = 0; j.supply.usedEventId = h.eventId; j.supply.version += 1;
        j.route.repaired = true; j.route.passable = true; j.route.oldPartPosition = 'ASIDE';
        j.route.repairEventId = h.eventId; j.route.version += 1; j.surveyed = { FROM: null, TO: null };
        effect.actions = 1; effect.seconds = d.repairSeconds; consumedIds.push(j.supply.id);
        notes.push(d.repairedDescription, '真实路线条件已改变，搬运前须重新亲查两端。');
      } else if (command.type === d.transfer) {
        at('FROM'); requirePermission(j); requireSurvey(j);
        need(j.route.repaired && j.route.passable && j.route.condition >= 40 &&
          j.ends.FROM.access === 'OPEN' && j.ends.TO.access === 'OPEN' && payloadAt(j) === 'FROM',
          '原人原物必须仍在起点，当前已修原路与两端均须可用。');
        if (j.payload.kind === 'PERSON') need(permissionCurrent(j, 'TRAVELLER') &&
          j.payload.person.energy >= T.travellerEnergyCost, '原陪行者须本次同意且仍有实际行走精力。');
        else need(j.payload.holderId === j.payload.ownerId, '同一原箱须仍在原所有人的发件台。');
        effect.actions = 1; effect.seconds = d.handlingSeconds;
        move('TO', j.route.id, d.directMetres);
        movements.push({ subjectId: payloadId(j), fromId: j.ends.FROM.id, toId: j.ends.TO.id,
          routeId: j.route.id, metres: d.directMetres, seconds: d.directMetres, carriedWithActor: true });
        if (j.payload.kind === 'PERSON') {
          j.payload.person.position = 'TO'; j.payload.person.energy -= T.travellerEnergyCost;
          j.payload.person.travelledMetres += d.directMetres; j.payload.person.version += 1;
        } else { j.payload.position = 'TO'; j.payload.holderId = s.actorId; j.payload.version += 1; }
        j.route.condition -= T.directConditionWear;
        // Wear does not alter the surveyed route geometry; repair/obstruction does.
        j.arrivals.push({ eventId: h.eventId, subjectId: payloadId(j), fromId: j.ends.FROM.id, toId: j.ends.TO.id,
          week: h.week + Math.floor((h.secondsIntoWeek + effect.seconds) / 604800), second: h.nowSecond + effect.seconds,
          metres: d.directMetres, seconds: d.directMetres, routeVersion: j.route.version, endVersions: endVersions(j) });
        notes.push('同一实际身体与原箱或原人走完命名的短路，计一次行动及真实磨损；尚未替接收人确认到达。');
      } else if (command.type === 'VERIFY_ARRIVAL') {
        at('TO'); requirePermission(j); requireSurvey(j);
        const arrival = j.arrivals.at(-1);
        need(arrival && arrival.subjectId === payloadId(j) && arrival.toId === j.ends.TO.id && payloadAt(j) === 'TO' &&
          j.receiver.position === 'TO' && j.receiver.status === 'ACTIVE' && j.receiver.health > 0 &&
          j.ends.TO.access === 'OPEN', '须现场看到同一原人原物和真实接收人，不能仅凭旧到达句子交接。');
        if (j.payload.kind === 'PERSON') need(permissionCurrent(j, 'TRAVELLER'), '到岸后重新询问原人当前的交接意愿。');
        else { need(j.payload.holderId === s.actorId, '只有本人正实际持有的同一原箱可当面交接。');
          j.payload.holderId = j.receiver.id; j.payload.version += 1; }
        effect.seconds = T.verifySeconds;
        j.review = { eventId: h.eventId, arrivalEventId: arrival.eventId, receiverId: j.receiver.id,
          subjectId: payloadId(j), endVersions: endVersions(j),
          week: h.week + Math.floor((h.secondsIntoWeek + effect.seconds) / 604800), second: h.nowSecond + effect.seconds };
        notes.push('当面核对原身份、原箱数量与接收人。对方签下交接记录，这件普通工作至此完成。');
      } else need(false, '该事务没有这项操作。');
    }
  }
  return finish(s, h, command, 'PLAYER', effect, movements, consumedIds, permission, notes);
}
/** A future trusted world adapter can invalidate current conditions. These
 * facts cannot grant player consent, move cargo, restore stock or resurrect. */
function reduceDoorSiteChange(input: DoorServicesState, change: DoorSiteChange, h: DoorServiceHost): DoorServiceResult {
  assertDoorServices(input); hostGuard(input, h);
  need(DOOR_JOB_IDS.includes(change.jobId), '未知原事务。');
  const s = clone(input), j = s.jobs[change.jobId], effect = emptyEffect();
  if (change.type === 'END_CHANGED') {
    need((change.end === 'FROM' || change.end === 'TO') && ['OPEN', 'CLOSED'].includes(change.access), '端点变化无效。');
    j.ends[change.end].access = change.access; j.ends[change.end].version += 1;
    j.permission = { OWNER: null, RECEIVER: null, TRAVELLER: null }; j.surveyed = { FROM: null, TO: null };
  } else if (change.type === 'PERSON_DECISION') {
    need(['OWNER', 'RECEIVER', 'TRAVELLER'].includes(change.role), '原人角色无效。');
    const p = personAtRole(j, change.role);
    need(['ALLOW', 'REFUSED', 'WITHDRAWN'].includes(change.response), '当前意愿无效。');
    p.willingness = change.response;
    p.version += 1; j.permission[change.role] = null;
  } else {
    need(change.type === 'DIRECT_ROUTE_BLOCKED', '未知世界变化。');
    j.route.passable = false; j.route.version += 1; j.surveyed = { FROM: null, TO: null };
  }
  effect.seconds = 1;
  return finish(s, h, change, 'WORLD', effect, [], [], null,
    ['记录新的现场事实并作废相关当前许可或端点观察；原完成记录、实耗、普通退路和真实位置不重写。']);
}

/** The outer chapter owns identity, time and budgets. No player intent carries
 * these facts, and this adapter never imports or mutates the full campaign. */
function serviceHost(s: DoorServicesState, h: DoorHost): DoorServiceHost {
  need(h.check === null, '普通工作无需施术检定。');
  need(integer(h.weekAnchor) && h.nowSecond >= h.weekAnchor && h.nowSecond < h.weekAnchor + 604800,
    '当前周起点与实际时间不一致。');
  return { runId: s.runId, actorId: h.actorId, eventId: h.eventId, revision: h.revision,
    status: h.status, sequence: h.sequence, location: h.location, week: h.week,
    nowSecond: h.nowSecond, secondsIntoWeek: h.nowSecond - h.weekAnchor,
    cash: h.cash, actions: h.actions, health: h.health, mind: h.mind, spirituality: h.spirituality };
}
function moduleResult(result: DoorServiceResult): DoorModuleResult<DoorServicesState> {
  const { randomDraws: _draws, ...effect } = result.effect;
  return { state: result.state, effect: { ...effect, toLocation: null }, notes: [...result.event.notes] };
}
export function applyDoorService(s: DoorServicesState, command: DoorServiceCommand, h: DoorHost): DoorModuleResult<DoorServicesState> {
  return moduleResult(reduceDoorService(s, command, serviceHost(s, h)));
}
/** Trusted world-fact entry, deliberately excluded from DoorServiceCommand. */
export function applyDoorSiteChange(s: DoorServicesState, change: DoorSiteChange, h: DoorHost): DoorModuleResult<DoorServicesState> {
  return moduleResult(reduceDoorSiteChange(s, change, serviceHost(s, h)));
}
export function doorServicesBlock(s: DoorServicesState, command: DoorServiceCommand, h: DoorHost): string | null {
  try { applyDoorService(s, command, h); return null; }
  catch (error) { return error instanceof Error ? error.message : '当前原人、原物或现场条件无效。'; }
}
export const doorServiceLocation = (id: DoorJobId): string => DOOR_JOBS[id].location;
export const DOOR_SERVICES = DOOR_JOB_IDS.map(id => DOOR_JOBS[id]);
export function canLeaveDoorServices(s: DoorServicesState, _location?: string): boolean {
  return s.activeJobId === null && s.playerPosition === 'OUTSIDE';
}
function surveyCurrent(j: DoorJobState, end: DoorEnd): boolean {
  const x = j.surveyed[end];
  return !!x && x.visitId === j.visitId && x.endVersion === j.ends[end].version &&
    x.routeVersion === j.route.version && x.bypassId === j.bypass.id && x.bypassVersion === j.bypass.version;
}
function operation(id: DoorJobId, kind: 'repair' | 'transfer'): DoorServiceCommand {
  if (id === 'ledger-threshold') return { type: kind === 'repair' ? 'FIT_THRESHOLD' : 'CARRY_LEDGER', jobId: id };
  if (id === 'courtyard-stair') return { type: kind === 'repair' ? 'CLEAR_STAIR' : 'ESCORT_PORTER', jobId: id };
  return { type: kind === 'repair' ? 'REFIT_GATE' : 'CARRY_TOOL_CHEST', jobId: id };
}
function conditionsAllowWork(j: DoorJobState): boolean {
  const people = [j.owner, j.receiver, ...(j.payload.kind === 'PERSON' ? [j.payload.person] : [])];
  return people.every(p => p.status === 'ACTIVE' && p.health > 0 && p.position !== 'AWAY' && p.willingness === 'ALLOW') &&
    j.ends.FROM.access === 'OPEN' && j.ends.TO.access === 'OPEN' &&
    (!j.route.repaired || (j.route.passable && (payloadAt(j) === 'TO' || j.route.condition >= 40))) &&
    (j.payload.kind !== 'PERSON' || j.payload.person.position === 'TO' || j.payload.person.energy >= T.travellerEnergyCost);
}
function needsResources(j: DoorJobState, h: DoorHost): boolean {
  return (j.supply.holder === 'SUPPLIER' && h.cash < DOOR_JOBS[j.id].pricePennies) ||
    ((!j.route.repaired || payloadAt(j) === 'FROM') && h.actions < 1);
}
/** A concrete next step may name another site; the chapter performs the actual
 * city travel before ENTER. An active site always has a free ordinary retreat. */
export function nextDoorServiceCommand(s: DoorServicesState, location: string, h: DoorHost): DoorServiceCommand | null {
  if (s.activeJobId === null) {
    const candidates = DOOR_JOB_IDS.filter(id => !s.jobs[id].review && conditionsAllowWork(s.jobs[id]) && !needsResources(s.jobs[id], h));
    const id = candidates.find(id => DOOR_JOBS[id].location === location) ?? candidates[0];
    return id ? { type: 'ENTER', jobId: id } : null;
  }
  const j = s.jobs[s.activeJobId], jobId = j.id;
  const retreat = (): DoorServiceCommand => s.playerPosition === 'TO'
    ? { type: 'RETURN_ON_FOOT', jobId } : { type: 'LEAVE', jobId };
  if (j.review || j.stopped) return retreat();
  if (needsResources(j, h) || !conditionsAllowWork(j))
    return { type: 'STOP', jobId };
  const end = s.playerPosition;
  if (end !== 'FROM' && end !== 'TO') return null;
  if (end === 'FROM' && !permissionCurrent(j, 'OWNER')) return { type: 'ASK_PERSON', jobId, role: 'OWNER' };
  if (end === 'TO' && !permissionCurrent(j, 'RECEIVER')) return { type: 'ASK_PERSON', jobId, role: 'RECEIVER' };
  if (j.payload.kind === 'PERSON' && j.payload.person.position === end && !permissionCurrent(j, 'TRAVELLER'))
    return { type: 'ASK_PERSON', jobId, role: 'TRAVELLER' };
  if (!surveyCurrent(j, end)) return { type: 'SURVEY_END', jobId, end };
  if (end === 'TO') {
    if (payloadAt(j) === 'TO' && permissionCurrent(j, 'OWNER') && surveyCurrent(j, 'FROM'))
      return { type: 'VERIFY_ARRIVAL', jobId };
    // An undelivered chest cannot be left behind while revisiting its owner.
    return j.payload.kind === 'CARGO' && j.payload.holderId === s.actorId
      ? { type: 'RETURN_ON_FOOT', jobId } : { type: 'WALK_BYPASS', jobId, end: 'FROM' };
  }
  if (!permissionCurrent(j, 'RECEIVER') || !surveyCurrent(j, 'TO') || payloadAt(j) === 'TO')
    return { type: 'WALK_BYPASS', jobId, end: 'TO' };
  if (j.supply.holder === 'SUPPLIER') return { type: 'BUY_SUPPLIES', jobId };
  return operation(jobId, j.route.repaired ? 'transfer' : 'repair');
}
export function doorServiceCost(c: DoorServiceCommand) {
  const d = DOOR_JOBS[c.jobId], effect = { cashCost: 0, cashGain: 0, actions: 0,
    spirituality: 0, mind: 0, health: 0, seconds: 0, toLocation: null };
  if (c.type === 'ENTER') effect.seconds = T.enterSeconds;
  else if (c.type === 'LEAVE') effect.seconds = T.leaveSeconds;
  else if (c.type === 'STOP') effect.seconds = T.stopSeconds;
  else if (c.type === 'WALK_BYPASS' || c.type === 'RETURN_ON_FOOT') effect.seconds = d.bypassMetres;
  else if (c.type === 'ASK_PERSON') effect.seconds = T.askSeconds;
  else if (c.type === 'SURVEY_END') effect.seconds = T.surveySeconds;
  else if (c.type === 'BUY_SUPPLIES') { effect.cashCost = d.pricePennies; effect.seconds = T.buySeconds; }
  else if (c.type === 'VERIFY_ARRIVAL') effect.seconds = T.verifySeconds;
  else if (c.type === d.repair) { effect.actions = 1; effect.seconds = d.repairSeconds; }
  else { effect.actions = 1; effect.seconds = d.handlingSeconds + d.directMetres; }
  return effect;
}
function commandsFor(id: DoorJobId): DoorServiceCommand[] {
  const common: DoorServiceCommand[] = [
    { type: 'ENTER', jobId: id }, { type: 'ASK_PERSON', jobId: id, role: 'OWNER' },
    { type: 'ASK_PERSON', jobId: id, role: 'RECEIVER' },
    { type: 'SURVEY_END', jobId: id, end: 'FROM' }, { type: 'SURVEY_END', jobId: id, end: 'TO' },
    { type: 'WALK_BYPASS', jobId: id, end: 'FROM' }, { type: 'WALK_BYPASS', jobId: id, end: 'TO' },
    { type: 'BUY_SUPPLIES', jobId: id }, operation(id, 'repair'), operation(id, 'transfer'),
    { type: 'VERIFY_ARRIVAL', jobId: id }, { type: 'STOP', jobId: id },
    { type: 'RETURN_ON_FOOT', jobId: id }, { type: 'LEAVE', jobId: id },
  ];
  if (id === 'courtyard-stair') common.splice(3, 0, { type: 'ASK_PERSON', jobId: id, role: 'TRAVELLER' });
  return common;
}
function commandLabel(c: DoorServiceCommand): string {
  const d = DOOR_JOBS[c.jobId];
  if (c.type === 'ASK_PERSON') return `当面询问${c.role === 'OWNER' ? d.owner.name : c.role === 'RECEIVER' ? d.receiver.name : d.payload.name}`;
  if (c.type === 'SURVEY_END') return `查看${d.ends[c.end].name}与当前通路`;
  if (c.type === 'WALK_BYPASS') return `沿${d.bypassMetres}米绕行道走到${d.ends[c.end].name}`;
  const labels: Record<Exclude<DoorServiceCommand['type'], 'ASK_PERSON' | 'SURVEY_END' | 'WALK_BYPASS'>, string> = {
    ENTER: '走进现场', BUY_SUPPLIES: `购买${d.supplyName}`, FIT_THRESHOLD: '换上门槛嵌条',
    CLEAR_STAIR: '移开空车并用木楔停稳', REFIT_GATE: '更换原门铰轴',
    CARRY_LEDGER: '沿六米原路搬运账箱', ESCORT_PORTER: '沿十米后阶陪本到院门',
    CARRY_TOOL_CHEST: '沿十四米原路搬运工具箱', VERIFY_ARRIVAL: '与接收人当面核对到达',
    STOP: '停止当前作业', RETURN_ON_FOOT: '沿普通退路返回发件端', LEAVE: '从入口普通离场',
  };
  return labels[c.type];
}
export function getDoorServiceActions(s: DoorServicesState, h: DoorHost) {
  const next = nextDoorServiceCommand(s, h.location, h);
  return DOOR_JOB_IDS.filter(id => DOOR_JOBS[id].location === h.location).flatMap(id => commandsFor(id).map(command => {
    const effect = doorServiceCost(command), reason = doorServicesBlock(s, command, h);
    return { command, label: `${DOOR_JOBS[id].title}：${commandLabel(command)}`,
      cost: `${effect.actions}行动、${effect.cashCost}便士，实际${effect.seconds}秒`,
      enabled: reason === null, reason, preferredAction: reason === null && stableStringify(command) === stableStringify(next) };
  }));
}
export function doorServiceVerifiedReceipts(s: DoorServicesState): DoorServiceReceipt[] {
  return DOOR_JOB_IDS.flatMap(id => {
    const j = s.jobs[id], d = DOOR_JOBS[id], review = j.review;
    if (!review || !j.route.repaired || j.supply.holder !== 'INSTALLED' || !j.supply.usedEventId ||
      review.subjectId !== payloadId(j) || review.receiverId !== j.receiver.id || payloadAt(j) !== 'TO') return [];
    const arrival = j.arrivals.find(a => a.eventId === review.arrivalEventId);
    const transport = s.journal.find(e => e.id === review.arrivalEventId && e.kind === 'PLAYER' && e.command.type === d.transfer);
    const verification = s.journal.find(e => e.id === review.eventId && e.kind === 'PLAYER' && e.command.type === 'VERIFY_ARRIVAL');
    if (!arrival || !transport || !verification || arrival.subjectId !== payloadId(j) ||
      arrival.fromId !== d.ends.FROM.id || arrival.toId !== d.ends.TO.id || arrival.metres !== d.directMetres ||
      review.second <= arrival.second || review.week < arrival.week ||
      (j.payload.kind === 'CARGO' && (j.payload.units !== 1 || j.payload.ownerId !== d.owner.id || j.payload.holderId !== j.receiver.id))) return [];
    return [{ serviceId: id, residentId: j.payload.kind === 'PERSON' ? j.payload.person.id : j.owner.id,
      apparatusId: j.route.id, passedEventId: arrival.eventId, passedWeek: arrival.week,
      reviewedEventId: review.eventId, reviewedWeek: review.week }];
  });
}
export const doorServicesComplete = (s: DoorServicesState): boolean => doorServiceVerifiedReceipts(s).length === 3;
export function validateDoorServicesState(value: unknown): value is DoorServicesState {
  try {
    const s = value as DoorServicesState;
    assertDoorServices(s);
    let replay = createDoorServices(s.runId, s.actorId, s.startWeek, s.startSecond);
    for (const event of s.journal) replay = event.kind === 'PLAYER'
      ? reduceDoorService(replay, event.command as DoorServiceCommand, event.host).state
      : reduceDoorSiteChange(replay, event.command as DoorSiteChange, event.host).state;
    return stableStringify(replay) === stableStringify(s);
  } catch { return false; }
}
export function projectDoorServices(s: DoorServicesState) {
  const positionName = (j: DoorJobState, position: DoorEnd | 'AWAY') => position === 'AWAY' ? '不在现场' : DOOR_JOBS[j.id].ends[position].name;
  return { id: 'door-services', title: '三处普通交接', lines: DOOR_JOB_IDS.flatMap(id => {
    const j = s.jobs[id], d = DOOR_JOBS[id];
    const status = j.review ? '已当面完成交接' : payloadAt(j) === 'TO' ? '已经实际到达，等待当面核对'
      : j.route.repaired ? '原路已经修好' : j.supply.holder === 'PLAYER' ? '修料已实付买下' : '等待查看现场';
    const subject = j.payload.kind === 'PERSON'
      ? `${j.payload.person.name}（${j.payload.person.age}岁）在${positionName(j, j.payload.person.position)}，精力${j.payload.person.energy}；${j.payload.person.injuries.join('；') || '没有伤势'}。`
      : `${d.payload.name}共一箱，在${positionName(j, j.payload.position)}；所有人仍为${j.owner.name}，${j.payload.holderId === j.receiver.id ? '已交给接收人' : j.payload.holderId === s.actorId ? '由你实际携带' : '留在原发件台'}。`;
    const willingness = (p: DoorPerson) => p.willingness === 'ALLOW' ? '愿意继续' : p.willingness === 'REFUSED' ? '尚不同意' : '已撤回同意';
    return [`${d.title}：${status}。`, subject,
      `${j.owner.name}${willingness(j.owner)}；${j.receiver.name}${willingness(j.receiver)}${j.payload.kind === 'PERSON' ? `；${j.payload.person.name}${willingness(j.payload.person)}` : ''}。`,
      `${d.directMetres}米直路${j.route.passable ? '可以通行' : '暂不能通行'}，状况${j.route.condition}；${d.bypassMetres}米普通绕行道始终可供退场。`,
      `${d.supplyName}：${j.supply.holder === 'INSTALLED' ? '已经实际安装，旧件留在现场一侧' : j.supply.holder === 'PLAYER' ? '已付款，留在发件端待用' : `供应方仅有一份，价${d.pricePennies}便士`}。`,
      ...(s.activeJobId === id ? [`你在${d.ends[s.playerPosition as DoorEnd].name}${j.stopped ? '，本次作业已停止' : ''}。`] : [])];
  }).concat('三件工作共需6行动、24便士修料。停止作业、沿普通退路返回和离场均不需要行动或现金。') };
}
