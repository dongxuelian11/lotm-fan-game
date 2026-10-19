/** R217 static candidate. Pure finite scene, no RNG, resurrection or free stock. */
import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import { stableStringify } from '../canonical.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { emptyDeathEffect, type DeathEffect, type DeathHost } from './ports.js';
import { DEATH_ABILITY_IDS, type DeathAbilityId, type DeathEpilogueCommand, type DeathEpilogueState,
  type DeathServicesState, type DeathMovementReceipt, type DeathPermission, type DeathWindow } from './types.js';
import { deathServiceVerifiedReceipts, deathServiceConditionVersions,
  type DeathWharfRuntimeSite, type DeathResidueRuntimeSite, type DeathServiceResident } from './services.js';
import { DEATH_EPILOGUE_POLICY as POLICY, DEATH_EPILOGUE_SCENE as SCENE } from './epilogue-content.js';

export type DeathEpiloguePhase = import('./types.js').DeathEpiloguePhase;
export type DeathEpilogueObjectChange = import('./types.js').DeathEpilogueObjectChange;
export type DeathEpilogueRuntimeState = DeathEpilogueState;
export interface DeathEpilogueResult {
  state: DeathEpilogueRuntimeState; effect: DeathEffect; injuries: SliceState['injuries'];
  movements: DeathMovementReceipt[]; notes: string[]; masteryGains: Partial<Record<DeathAbilityId, number>>;
}
export interface DeathEpilogueCheckInput {
  ability: PublicCoreStatKey; difficulty: number; modifier: number; source: string;
}
const clone = <T>(value: T): T => structuredClone(value);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (value: unknown, minimum = 0): value is number => Number.isSafeInteger(value) && (value as number) >= minimum;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function need(value: unknown, reason: string): asserts value { if (!value) throw Error(reason); }
const at = (location: string, position: number) => `${location}@${position}m`;
const WEEK_SECONDS = 604800;
const commands = ['OBSERVE', 'ASK_PASSAGE_PERMISSION', 'ASK_BARRIER_PERMISSION', 'SURVEY_ENDPOINTS',
  'OBSERVE_PROPAGATION', 'PARTIAL_SPIRIT_PASSAGE', 'TRAVERSE_PASSAGE', 'PROPAGATION_BARRIER',
  'APPLY_BARRIER', 'LOWER_SCREEN', 'STOP_EFFECTS', 'MANUAL_SEAL', 'ORDINARY_EXIT', 'WITHDRAW', 'REPORT'];
const isCast = (c: DeathEpilogueCommand) => c.type === 'PARTIAL_SPIRIT_PASSAGE' || c.type === 'PROPAGATION_BARRIER';
const passageCast = (c: DeathEpilogueCommand) => c.type === 'PARTIAL_SPIRIT_PASSAGE';
const person = (s: DeathEpilogueRuntimeState, passage: boolean) => s.wharf.workers[passage ? 1 : 0];
const cost = (passage: boolean) => passage ? POLICY.passage : POLICY.barrier;
const consentStatus = (p: DeathServiceResident): DeathPermission['status'] =>
  p.consent?.status === 'REFUSED' || p.consent?.status === 'WITHDRAWN' ? p.consent.status : p.willingness;
const window = (abilityId: DeathAbilityId): DeathWindow => ({ abilityId, attempted: false, passed: false,
  applied: false, targetId: null, openedEventId: null, appliedEventId: null, conditionVersion: null,
  permissionEventId: null, openedSecond: null, expiresSecond: null, counter: 'NONE' });
const live = (p: DeathServiceResident) => p.status === 'ACTIVE' && p.health > 0;
const version = (s: DeathEpilogueRuntimeState, passage: boolean) => passage
  ? s.wharf.bridge.version + s.wharf.rope.version + s.screen.version + person(s, true).conditionVersion
  : s.vessel.version + s.residue.conditionVersion + s.propagation.version + s.screen.version + s.wharf.rope.version;

export function validateDeathEpilogueCommand(value: unknown): value is DeathEpilogueCommand {
  return record(value) && Object.keys(value).length === 1 && typeof value.type === 'string' && commands.includes(value.type);
}
function host(h: DeathHost): void {
  need(h.status === 'ACTIVE' && h.sequence === 0 && h.health > 0 && h.mind > 0,
    '只有原本人真实晋升且仍活着，才能处理这件近岸事务。');
  need([h.health, h.mind, h.spirituality, h.cash, h.actions].every(n => integer(n)), '当前身体与费用必须来自完整实际资源。');
  need(h.location === SCENE.location && integer(h.nowSecond) && integer(h.weekAnchor) && integer(h.week) &&
    h.nowSecond >= h.weekAnchor && h.nowSecond < h.weekAnchor + WEEK_SECONDS && integer(h.revision, 1) &&
    typeof h.eventId === 'string' && h.eventId.length > 0, '本人须使用同一真实现场、周界与动作次序。');
}
function permission(h: DeathHost, p: DeathServiceResident, purpose: DeathPermission['purpose'],
  second: number, location: string): DeathPermission {
  return { personId: p.id, actorId: h.actorId, purpose,
    status: live(p) && p.location === location ? consentStatus(p) : 'REFUSED', eventId: h.eventId,
    revision: h.revision, week: h.week + Math.floor((second - h.weekAnchor) / WEEK_SECONDS),
    location, conditionVersion: p.conditionVersion };
}
/** One macro-action, with ordered physical intermediate positions and clock.
 * No claim that the engine simulates individual walking frames. */
export function startDeathEpilogue(input: DeathServicesState, h: DeathHost): DeathEpilogueResult {
  host(h); need(h.check === null && input.actorId === h.actorId && h.nowSecond >= input.lastSecond,
    '原服务身份或真实时钟不匹配，普通运输不抽骰。');
  deathServiceConditionVersions(input); // Fail closed when service runtime fields are missing.
  const receipts = deathServiceVerifiedReceipts(input);
  need(receipts.length === 2 && same(receipts, h.serviceReceipts), '两件实际服务的完整当面复核回执必须仍然存在。');
  const room = clone(input.residue) as DeathResidueRuntimeSite, wharf = clone(input.wharf) as DeathWharfRuntimeSite;
  need(wharf.playerPosition === SCENE.shorePosition && wharf.workers.every(p => live(p) && p.location === SCENE.location &&
    p.position === SCENE.shorePosition) && wharf.retreat.open, '承接原已到岸的两人；不得把他们放回桥上、换身体或补精力。');
  need(room.apparatus.containerHolder === room.custodian.id && room.apparatus.containerPosition === room.custodian.position &&
    room.apparatus.location === room.location && room.apparatus.lid === 'CLOSED' && room.apparatus.seal === 'INTACT' &&
    room.supply.holder === 'USED' && room.supply.stock === 0 && room.residue.exposed === 0,
    '只能接续已归还的同罐、原盖和已用封条，不制造替代库存。');
  const effect = emptyDeathEffect(), movements: DeathMovementReceipt[] = [], phases: DeathEpiloguePhase[] = [];
  const changes: DeathEpilogueObjectChange[] = [];
  const stage = (kind: DeathEpiloguePhase['kind'], location: string, seconds: number,
    permit: DeathPermission | null = null, moves: DeathMovementReceipt[] = [], notes: string[] = []) => {
    const start = h.nowSecond + effect.seconds; effect.seconds += seconds;
    phases.push({ kind, location, startedSecond: start, endedSecond: h.nowSecond + effect.seconds,
      permission: permit ? clone(permit) : null, movements: clone(moves), notes }); movements.push(...moves);
  };
  const receiver = permission(h, wharf.workers[0], 'HANDOVER', h.nowSecond, SCENE.location);
  stage('ASK_RECEIVER', SCENE.location, SCENE.receiverAskSeconds, receiver, [], [SCENE.receivingPurpose]);
  let keeper: DeathPermission | null = null, delivered = false;
  if (receiver.status === 'ALLOW') {
    stage('WALK_TO_KEEPER', SCENE.roomLocation, SCENE.cityLegSeconds, null,
      [{ actorId: h.actorId, from: SCENE.location, to: SCENE.roomLocation, metres: SCENE.cityLegMetres,
        seconds: SCENE.cityLegSeconds, energyCost: 0 }], ['本人实际沿普通道路到原保管室；两工人留在已到达的岸边。']);
    keeper = permission(h, room.custodian, 'HANDOVER', h.nowSecond + effect.seconds, SCENE.roomLocation);
    stage('ASK_KEEPER', SCENE.roomLocation, SCENE.keeperAskSeconds, keeper, [], ['当面询问将同罐交给岸边埃文的本次运输许可。']);
    if (keeper.status === 'ALLOW') {
      need(h.mind > SCENE.playerCarryMind, '实际运输需2精神且保留清醒；可以不接取送委托。');
      stage('LOAD_ORIGINAL', SCENE.roomLocation, SCENE.loadingSeconds, null, [], ['亲手拿起原罐、原盖和附着的已用封材；原屏留在六米工作台。']);
      const ids = [h.actorId, room.apparatus.containerId, room.apparatus.lidId, room.supply.id, room.residue.id];
      stage('CARRY_ORIGINAL', SCENE.location, SCENE.cityLegSeconds, null, ids.map(id => ({ actorId: id,
        from: SCENE.roomLocation, to: SCENE.location, metres: SCENE.cityLegMetres, seconds: SCENE.cityLegSeconds, energyCost: 0 })),
      ['所有携带物随同一身体同程到岸，不把并行携带的秒数重复相加。']);
      stage('HANDOVER_ORIGINAL', SCENE.location, SCENE.unloadingSeconds, receiver, [], ['把已封原罐放上既有安全转运架，由已实际同意的埃文接管。']);
      delivered = true; effect.mind = SCENE.playerCarryMind;
      changes.push({ objectId: room.apparatus.containerId, before: room.custodian.id, after: wharf.workers[0].id, cause: '当前两方许可下的实际取送与交接' });
    } else stage('RETURN_EMPTY', SCENE.location, SCENE.cityLegSeconds, null,
      [{ actorId: h.actorId, from: SCENE.roomLocation, to: SCENE.location, metres: SCENE.cityLegMetres,
        seconds: SCENE.cityLegSeconds, energyCost: 0 }], ['未获许可，原罐及所有原物留在保管室；本人空手沿原路回岸。']);
  }
  const residue = clone(room.residue), beforeCondition = wharf.bridge.condition;
  const incidentOccurred = delivered && wharf.rope.holder === 'INSTALLED' && wharf.rope.installedSpan !== null &&
    wharf.rope.condition >= SCENE.tideRopeWear && wharf.bridge.condition >= SCENE.bridgeWear &&
    residue.contained > 0;
  if (delivered) { residue.location = SCENE.location; residue.conditionVersion += 1; }
  if (incidentOccurred) {
    wharf.bridge.condition -= SCENE.bridgeWear; wharf.bridge.version += 1;
    wharf.rope.condition -= SCENE.tideRopeWear; wharf.rope.version += 1;
    wharf.bridge.passable = wharf.bridge.passable && wharf.bridge.condition >= 20;
    wharf.bridge.supported = wharf.bridge.supported && wharf.rope.condition > 0;
    residue.contained -= SCENE.finiteExposedPortions; residue.exposed += SCENE.finiteExposedPortions; residue.conditionVersion += 1;
    changes.push({ objectId: wharf.bridge.id, before: beforeCondition, after: wharf.bridge.condition, cause: SCENE.tideCause },
      { objectId: wharf.rope.id, before: wharf.rope.condition + SCENE.tideRopeWear, after: wharf.rope.condition, cause: '同一次独立涌潮真实拉磨原绳' },
      { objectId: room.supply.id, before: 'INTACT', after: 'BROKEN', cause: '原绳尾扫到原盖，撕开已用封条' },
      { objectId: residue.id, before: residue.exposed - 1, after: residue.exposed, cause: '原有一份从盖下暴露，未增加总量' });
    stage('TIDE_INCIDENT', SCENE.location, SCENE.tideSeconds, null, [], [SCENE.tideCause]);
  }
  const end = h.nowSecond + effect.seconds, target = wharf.workers[1];
  const state: DeathEpilogueRuntimeState = {
    id: SCENE.id, actorId: h.actorId, location: SCENE.location, startedWeek: h.week, startedSecond: h.nowSecond,
    lastSecond: end, playerLocation: SCENE.location, status: 'ACTIVE', position: wharf.playerPosition, observed: false, reported: false, conditionVersion: 1,
    origin: { wharf: clone(input.wharf), residue: clone(input.residue), receipts: clone(receipts) }, wharf,
    incident: { eventId: h.eventId, cause: incidentOccurred ? SCENE.tideCause : '未发生事故；拒绝、原物未到场、已耗尽或原受力条件不足不会生成替代危险。',
      happenedSecond: end, objectId: wharf.bridge.id, conditionBefore: beforeCondition, conditionAfter: wharf.bridge.condition, movements: [] },
    residue, propagation: { id: input.residue.propagation.id, from: residue.containerId, to: target.bodyId,
      visible: false, remainingPulses: incidentOccurred ? 1 : 0, blockedPulses: 0, version: input.residue.propagation.version + 1 },
    passage: { targetWorkerId: target.id, from: at(SCENE.location, SCENE.shorePosition), to: at(SCENE.location, SCENE.clearPosition),
      distanceMetres: POLICY.passage.distanceMetres, traverseSeconds: POLICY.passage.traverseSeconds,
      endpointsVerifiedEventId: null, permission: null, window: window(DEATH_ABILITY_IDS[0]) },
    barrier: { permission: null, window: window(DEATH_ABILITY_IDS[1]) },
    screen: { id: room.apparatus.lidId, opaque: true, lowered: !incidentOccurred, condition: 1,
      version: room.apparatus.lidVersion + (delivered ? 1 : 0) + (incidentOccurred ? 1 : 0) },
    arrivals: [], vessel: { keeper: clone(room.custodian),
      roomScreen: { id: room.apparatus.screenId, location: room.location, position: room.apparatus.screenPosition, version: room.apparatus.screenVersion },
      ownerId: room.apparatus.ownerId, holderId: delivered ? wharf.workers[0].id : room.custodian.id,
      location: delivered ? SCENE.location : SCENE.roomLocation, position: delivered ? SCENE.shorePosition : room.apparatus.containerPosition,
      delivered, lid: incidentOccurred ? 'TILTED' : 'CLOSED', seal: incidentOccurred ? 'BROKEN' : 'INTACT',
      sealId: room.supply.id, sealVersion: room.supply.version + (delivered ? 1 : 0) + (incidentOccurred ? 1 : 0),
      version: room.apparatus.containerVersion + (delivered ? 1 : 0) + (incidentOccurred ? 1 : 0),
      keeperPermission: keeper, receiverPermission: receiver, manuallyContainedEventId: null },
    introduction: { phases, effect: clone(effect), movements: clone(movements), objectChanges: changes, incidentOccurred },
    pulse: { dueSecond: incidentOccurred ? end + SCENE.pulseDelaySeconds : null, settledSecond: null,
      outcome: incidentOccurred ? 'PENDING' : 'NONE', targetBodyId: target.bodyId, targetPosition: target.position, healthLost: 0 },
    observedPropagationEventId: null, journeys: [], stopped: false, journal: [],
  };
  assertState(state);
  return { state, effect, injuries: [], movements, masteryGains: {}, notes: [SCENE.receivingPurpose,
    delivered ? '同罐真实送达并交接，原四份、原盖、已用封材和产权逐项保留；两人未离开原安全岸，身体与旧伤未重置。' : '交接未获准，原罐未移动，没有新的残余或技能练习目标。',
    state.incident.cause] };
}

function assertState(input: DeathEpilogueState): asserts input is DeathEpilogueRuntimeState {
  const s = input as DeathEpilogueRuntimeState;
  need(s.id === SCENE.id && s.location === SCENE.location && s.vessel && s.pulse && s.introduction &&
    typeof s.playerLocation === 'string' && (s.status !== 'ACTIVE' || s.playerLocation === s.location) &&
    integer(s.startedSecond) && integer(s.lastSecond, s.startedSecond) && integer(s.conditionVersion, 1) &&
    Array.isArray(s.journal) && Array.isArray(s.journeys) && Array.isArray(s.introduction.phases) &&
    typeof s.stopped === 'boolean', '有限事故的完整身体、原罐或时间证据缺失。');
  need(s.origin.receipts.length === 2 && same(s.wharf.completion, s.origin.wharf.completion) &&
    same(s.wharf.review, s.origin.wharf.review) && same(s.wharf.arrivals, s.origin.wharf.arrivals), '旧服务完成、复核与真实到岸记录不可重写。');
  need(s.wharf.bridge.id === s.origin.wharf.bridge.id && s.wharf.rope.id === s.origin.wharf.rope.id &&
    integer(s.wharf.bridge.condition) && s.wharf.bridge.condition <= s.origin.wharf.bridge.condition &&
    integer(s.wharf.rope.condition) && s.wharf.rope.condition <= s.origin.wharf.rope.condition &&
    s.wharf.retreat.open && s.wharf.retreat.metres === 18, '原桥绳实际损耗不能复原；不得隐藏普通退路。');
  need(s.position === s.wharf.playerPosition && [SCENE.shorePosition, SCENE.clearPosition].some(p => p === s.position), '本人必须位于真实当前端点。');
  s.wharf.workers.forEach((p, i) => {
    const origin = s.origin.wharf.workers[i]!;
    need(p.id === origin.id && p.bodyId === origin.bodyId && p.name === origin.name && p.age === origin.age &&
      p.location === origin.location && integer(p.health) && p.health <= origin.health && integer(p.energy) && p.energy <= origin.energy &&
      p.travelledMetres >= origin.travelledMetres && p.elapsedSeconds >= origin.elapsedSeconds &&
      origin.injuries.every(id => p.injuries.includes(id)) && integer(p.conditionVersion, 1) &&
      [SCENE.shorePosition, SCENE.clearPosition].some(pos => pos === p.position) &&
      (p.status === 'ACTIVE' && p.health > 0 || p.status === 'DEAD' && p.health === 0), '必须接续同一原成年身体、实际精力与未治伤；不复活、不换人。');
  });
  const r = s.residue, origin = s.origin.residue.residue;
  need(r.id === origin.id && r.containerId === origin.containerId && r.intelligent === false && r.total === origin.total &&
    [r.exposed, r.contained, r.dissipated].every(n => integer(n)) && r.exposed + r.contained + r.dissipated === r.total &&
    r.dissipated >= origin.dissipated && r.location === s.vessel.location, '这仍是原同罐有限残余；消散不能回补或生成灵魂。');
  need(s.vessel.ownerId === s.origin.residue.apparatus.ownerId && s.screen.id === s.origin.residue.apparatus.lidId &&
    s.vessel.sealId === s.origin.residue.supply.id && integer(s.vessel.sealVersion, 1) &&
    s.screen.condition === 1 && s.screen.opaque && same(s.vessel.keeper, s.origin.residue.custodian) &&
    s.vessel.roomScreen.id === s.origin.residue.apparatus.screenId && s.vessel.roomScreen.location === s.origin.residue.location &&
    s.vessel.roomScreen.position === (s.origin.residue as DeathResidueRuntimeSite).apparatus.screenPosition &&
    s.vessel.roomScreen.version === (s.origin.residue as DeathResidueRuntimeSite).apparatus.screenVersion,
    '原罐产权、原盖、原保管人及留在原室的原屏不能被替换或瞬移。');
  need([0, 1].includes(s.propagation.remainingPulses) && [0, 1].includes(s.propagation.blockedPulses) &&
    s.propagation.remainingPulses + s.propagation.blockedPulses <= 1 && s.passage.targetWorkerId === s.wharf.workers[1].id &&
    s.propagation.to === s.wharf.workers[1].bodyId && s.propagation.from === r.containerId, '只能处理同一人、同一条线、至多一个脉冲。');
  for (const [i, w] of [s.passage.window, s.barrier.window].entries()) {
    need(w.abilityId === DEATH_ABILITY_IDS[i] && (!w.passed || w.attempted) && (!w.applied || w.passed && w.appliedEventId !== null) &&
      (w.openedSecond === null ? w.expiresSecond === null : w.expiresSecond === w.openedSecond + POLICY.windowSeconds), '有限能力窗口缺失实际开窗或应用证据。');
  }
}
function permitted(s: DeathEpilogueRuntimeState, passage: boolean, h: DeathHost): boolean {
  const p = person(s, passage), permit = passage ? s.passage.permission : s.barrier.permission;
  return live(p) && consentStatus(p) === 'ALLOW' && p.location === s.location && permit !== null &&
    permit.status === 'ALLOW' && permit.personId === p.id && permit.actorId === h.actorId &&
    permit.purpose === (passage ? 'PASSAGE' : 'BARRIER') && permit.location === s.location &&
    permit.conditionVersion === p.conditionVersion && permit.revision < h.revision;
}
function refreshWindows(s: DeathEpilogueRuntimeState, h: DeathHost, second: number): void {
  for (const passage of [true, false]) {
    const w = passage ? s.passage.window : s.barrier.window;
    if (!w.passed || w.applied || w.counter !== 'NONE') continue;
    if (s.stopped) w.counter = 'STOPPED';
    else if (!permitted(s, passage, h)) w.counter = 'PERMISSION_WITHDRAWN';
    else if (s.screen.lowered) w.counter = 'OCCLUDED';
    else if (w.conditionVersion !== version(s, passage)) w.counter = 'ANCHOR_MOVED';
    else if (w.expiresSecond === null || second >= w.expiresSecond) w.counter = 'EXPIRED';
  }
}
function settlePulse(s: DeathEpilogueRuntimeState, second: number, changes: DeathEpilogueObjectChange[], notes: string[]): void {
  if (s.pulse.outcome !== 'PENDING' || s.pulse.dueSecond === null || second < s.pulse.dueSecond) return;
  need(s.propagation.remainingPulses === 1 && s.residue.exposed >= 1, '原单次脉冲缺少同一份暴露残余。');
  const p = person(s, true), hit = !s.screen.lowered && live(p) && p.position === s.pulse.targetPosition && p.location === s.location;
  s.propagation.remainingPulses = 0; s.propagation.version += 1;
  s.residue.exposed -= 1; s.residue.dissipated += 1; s.residue.conditionVersion += 1;
  s.pulse.settledSecond = s.pulse.dueSecond; s.pulse.outcome = hit ? 'HIT' : 'MISSED';
  if (hit) {
    const before = p.health, loss = Math.min(before, POLICY.barrier.propagationHealthCost);
    p.health -= loss; p.conditionVersion += 1; s.pulse.healthLost = loss;
    const injury = `${p.id}:TRANSFER-RESIDUE-ABRASION`;
    if (!p.injuries.includes(injury)) p.injuries.push(injury);
    if (p.health === 0) p.status = 'DEAD';
    changes.push({ objectId: p.bodyId, before, after: p.health, cause: '原单次残余脉冲实际接触仍在原站位的身体' });
    notes.push(`${p.name}实际受到${loss}健康损伤并保留新擦伤；原脚踝伤仍在，不会凭能力回溯。`);
  } else notes.push('仅有的一份暴露残余沿原线消散；原盖遮住或同一身体已经离开原站位，没有复制新的攻击。');
}
function base(input: DeathEpilogueState, c: DeathEpilogueCommand, h: DeathHost,
  changes: DeathEpilogueObjectChange[] = [], notes: string[] = []): DeathEpilogueRuntimeState {
  need(validateDeathEpilogueCommand(c), '未知意图，或夹带身体、许可、骰、材料等权威字段。');
  assertState(input); host(h); const s = clone(input);
  need(s.actorId === h.actorId && s.playerLocation === h.location && s.status === 'ACTIVE' && h.nowSecond >= s.lastSecond &&
    h.eventId !== s.incident.eventId && !s.journal.some(e => e.eventId === h.eventId) &&
    (!s.journal.length || h.revision > s.journal[s.journal.length - 1]!.revision), '事故已结束、本人不符或动作已经提交。');
  settlePulse(s, h.nowSecond, changes, notes); refreshWindows(s, h, h.nowSecond); return s;
}
function guard(s: DeathEpilogueRuntimeState, c: DeathEpilogueCommand, h: DeathHost): void {
  if (['WITHDRAW', 'ORDINARY_EXIT'].includes(c.type)) { need(s.wharf.retreat.open, '原岸边绕行道须实际存在。'); return; }
  if (c.type === 'OBSERVE') { need(!s.observed, '已观察此宗原现场，不会重复生成事故。'); return; }
  if (c.type === 'STOP_EFFECTS') { need(!s.stopped, '本次已停手，不会恢复已付材料或尝试次数。'); return; }
  need(s.observed, '先观察当前同一原罐、两人身体与岸边退路。');
  if (c.type === 'REPORT') { need(s.propagation.remainingPulses === 0 && s.residue.exposed === 0 &&
    (!s.vessel.delivered || s.vessel.lid === 'CLOSED'), '先实合原盖并处置唯一脉冲，再记录已交接的原罐结果。'); return; }
  if (c.type === 'ASK_PASSAGE_PERMISSION' || c.type === 'ASK_BARRIER_PERMISSION') {
    const passage = c.type === 'ASK_PASSAGE_PERMISSION', p = person(s, passage);
    need((passage ? s.passage.permission : s.barrier.permission) === null && !s.stopped &&
      live(p) && p.location === s.location && p.position === s.position, '只能当面问同一仍在场活人一次，拒绝和撤回不会被重问洗掉。'); return;
  }
  if (c.type === 'SURVEY_ENDPOINTS') { need(s.passage.endpointsVerifiedEventId === null && s.position === SCENE.shorePosition,
    '近岸两端只从实际岸边勘查一次，不把旧工人再送回桥上。'); return; }
  if (c.type === 'OBSERVE_PROPAGATION') { need(s.vessel.delivered && s.propagation.remainingPulses === 1 &&
    s.observedPropagationEventId === null && !s.screen.lowered, '没有当前暴露的原单线，不能凭空造一个练习目标。'); return; }
  if (c.type === 'LOWER_SCREEN' || c.type === 'MANUAL_SEAL') {
    need(s.vessel.delivered && s.vessel.lid === 'TILTED' &&
      s.vessel.receiverPermission?.status === 'ALLOW' && live(person(s, false)) && consentStatus(person(s, false)) === 'ALLOW' &&
      person(s, false).position === SCENE.shorePosition && person(s, false).location === s.location,
      '须实回原罐旁并有在场接管人的当前允许；未交接的远处容器不能远程处理。');
    if (c.type === 'LOWER_SCREEN') need(!s.screen.lowered, '原盖已经放低。'); return;
  }
  if (isCast(c)) {
    const passage = passageCast(c), w = passage ? s.passage.window : s.barrier.window, fees = cost(passage);
    need(!s.stopped && !w.attempted && !s.screen.lowered && s.position === SCENE.shorePosition && permitted(s, passage, h),
      '本次能力仅一次有价尝试；须当前本人同意，视线无遮挡且未停止。');
    need(s.vessel.delivered && s.introduction.incidentOccurred && s.wharf.rope.holder === 'INSTALLED' &&
      s.wharf.rope.condition >= SCENE.castRopeWear, '原绳须在场且尚可实际付出材料损耗；不补新绳或免费灵库。');
    need(h.actions >= fees.actions && h.cash >= fees.cash && h.spirituality >= fees.spirituality && h.mind > fees.mind,
      '当前灵性、精神或真实资源不足；失败也保留已付代价。');
    if (passage) need(s.position === SCENE.shorePosition && person(s, true).position === s.position &&
      s.passage.endpointsVerifiedEventId !== null && person(s, true).energy >= POLICY.passage.energyCost,
      '须原身体同处岸边、实查六米端点且有实际同行精力。');
    else need(s.observedPropagationEventId !== null && s.propagation.visible && s.propagation.remainingPulses === 1 &&
      s.residue.exposed >= 1 && s.pulse.dueSecond !== null && h.nowSecond + fees.seconds + SCENE.barrierApplySeconds < s.pulse.dueSecond,
      '须已看见同一未消散传播线，且当前仍有足够时间完成实际阻隔。');
    return;
  }
  const passage = c.type === 'TRAVERSE_PASSAGE', w = passage ? s.passage.window : s.barrier.window;
  need(c.type === 'TRAVERSE_PASSAGE' || c.type === 'APPLY_BARRIER', '未知现场操作。');
  need(!s.stopped && w.passed && !w.applied && w.counter === 'NONE' && permitted(s, passage, h) &&
    w.conditionVersion === version(s, passage) && w.permissionEventId === (passage ? s.passage.permission : s.barrier.permission)?.eventId &&
    w.expiresSecond !== null && h.nowSecond + (passage ? POLICY.passage.traverseSeconds : SCENE.barrierApplySeconds) < w.expiresSecond,
    '实际应用须在同一次二十秒窗口内完成；遮挡、移锚、撤回、失效或停止都不能补一次成功。');
  if (passage) need(s.position === SCENE.shorePosition && person(s, true).position === s.position &&
    person(s, true).energy >= POLICY.passage.energyCost, '只能带这一名真实同伴，身体仍须在原端点且精力足够。');
  else need(s.propagation.remainingPulses === 1 && s.residue.exposed >= 1 && s.propagation.visible &&
    s.pulse.dueSecond !== null && h.nowSecond + SCENE.barrierApplySeconds < s.pulse.dueSecond,
    '原脉冲已消散、被挡或改变，不能对空目标领取掌握。');
}
export function deathEpilogueBlock(input: DeathEpilogueState, c: DeathEpilogueCommand, h: DeathHost): string | null {
  try { const s = base(input, c, h); guard(s, c, h); return null; }
  catch (error) { return error instanceof Error ? error.message : '当前原现场或动作无效。'; }
}
export function deathEpilogueCheckInput(input: DeathEpilogueState, c: DeathEpilogueCommand, h: DeathHost): DeathEpilogueCheckInput | null {
  const s = base(input, c, h); guard(s, c, h);
  return isCast(c) ? { ability: 'will', difficulty: cost(passageCast(c)).difficulty,
    modifier: SCENE.castModifier, source: SCENE.castModifierSource } : null;
}
function check(c: DeathEpilogueCommand, value: PublicCheckResult | null): PublicCheckResult {
  need(value !== null && integer(value.baseAbility) && value.baseAbility <= 500 && integer(value.roll, 1) && value.roll <= 100,
    '施术须由本次引擎给出真实单骰回执，不能自动成功。');
  const actual = resolveNormalCheck({ ability: 'will', baseAbility: value.baseAbility,
    difficulty: cost(passageCast(c)).difficulty, modifiers: [{ source: SCENE.castModifierSource, value: SCENE.castModifier }], roll: value.roll });
  need(same(actual, value), '实际检定概率、修正、骰与结果不一致。'); return clone(actual);
}
export function applyDeathEpilogue(input: DeathEpilogueState, c: DeathEpilogueCommand, h: DeathHost): DeathEpilogueResult {
  const effect = emptyDeathEffect(), moves: DeathMovementReceipt[] = [], notes: string[] = [];
  const changes: DeathEpilogueObjectChange[] = [], permissions: DeathPermission[] = [], gains: Partial<Record<DeathAbilityId, number>> = {};
  const s = base(input, c, h, changes, notes); guard(s, c, h);
  need(isCast(c) || h.check === null, '普通行动及实际应用不抽取或接受额外骰。');
  const usedCheck = isCast(c) ? check(c, h.check) : null;
  const wait = (seconds: number) => { effect.seconds += seconds; };
  const stop = () => { s.stopped = true; for (const w of [s.passage.window, s.barrier.window])
    if (w.passed && !w.applied && w.counter === 'NONE') w.counter = 'STOPPED'; };
  const walk = (route: 'PARTIAL_SPIRIT' | 'SHORE_ROAD', withCompanion: boolean) => {
    const from = s.position, distance = route === 'PARTIAL_SPIRIT' ? POLICY.passage.distanceMetres : POLICY.ordinaryExit.metres;
    const seconds = route === 'PARTIAL_SPIRIT' ? POLICY.passage.traverseSeconds : POLICY.ordinaryExit.seconds;
    const energy = route === 'PARTIAL_SPIRIT' ? POLICY.passage.energyCost : POLICY.ordinaryExit.energyCost;
    if (from === SCENE.clearPosition) return;
    const playerMove = { actorId: h.actorId, from: at(s.location, from), to: at(s.location, SCENE.clearPosition), metres: distance, seconds, energyCost: 0 };
    moves.push(playerMove); s.journeys.push({ eventId: h.eventId, route, ...playerMove });
    if (withCompanion) {
      const p = person(s, true); need(live(p) && p.position === from && p.energy >= energy, '不移动不在场、死亡或精力不足的身体。');
      const companionMove = { actorId: p.id, from: at(s.location, from), to: at(s.location, SCENE.clearPosition), metres: distance, seconds, energyCost: energy };
      moves.push(companionMove); s.journeys.push({ eventId: h.eventId, route, ...companionMove });
      p.position = SCENE.clearPosition; p.energy -= energy; p.travelledMetres += distance; p.elapsedSeconds += seconds; p.conditionVersion += 1;
      if (route === 'PARTIAL_SPIRIT') s.arrivals.push({ workerId: p.id, eventId: h.eventId,
        second: h.nowSecond + effect.seconds + seconds, route, metres: distance, seconds, energyCost: energy });
    }
    s.position = SCENE.clearPosition; s.wharf.playerPosition = s.position; wait(seconds);
  };
  const returnToVessel = () => {
    if (s.position === SCENE.shorePosition) return;
    const movement = { actorId: h.actorId, from: at(s.location, s.position), to: at(s.location, SCENE.shorePosition),
      metres: POLICY.ordinaryExit.metres, seconds: POLICY.ordinaryExit.seconds, energyCost: 0 };
    moves.push(movement); s.journeys.push({ eventId: h.eventId, route: 'SHORE_ROAD', ...movement });
    wait(movement.seconds); s.position = SCENE.shorePosition; s.wharf.playerPosition = s.position;
    settlePulse(s, h.nowSecond + effect.seconds, changes, notes);
  };
  if (c.type === 'OBSERVE') { s.observed = true; wait(SCENE.observeSeconds); notes.push('观察原已到岸的两人及其实际伤势、旧桥绳、同罐原盖与公共退路，不移动任何身体。'); }
  else if (c.type === 'ASK_PASSAGE_PERMISSION' || c.type === 'ASK_BARRIER_PERMISSION') {
    const passage = c.type === 'ASK_PASSAGE_PERMISSION', p = person(s, passage);
    const permit = permission(h, p, passage ? 'PASSAGE' : 'BARRIER', h.nowSecond, s.location);
    if (passage) s.passage.permission = permit; else s.barrier.permission = permit;
    permissions.push(clone(permit)); wait(SCENE.permissionSeconds);
    notes.push(`${p.name}对本次${passage ? '沿普通岸路或六米短渡同行' : '近岸阻隔'}回答：${permit.status}。旧服务同意不代替本次回答。`);
  } else if (c.type === 'SURVEY_ENDPOINTS') {
    for (const [from, to] of [[SCENE.shorePosition, SCENE.clearPosition], [SCENE.clearPosition, SCENE.shorePosition]] as const) {
      const movement = { actorId: h.actorId, from: at(s.location, from), to: at(s.location, to),
        metres: POLICY.ordinaryExit.metres, seconds: POLICY.ordinaryExit.seconds, energyCost: 0 };
      moves.push(movement); s.journeys.push({ eventId: h.eventId, route: 'SHORE_ROAD', ...movement }); wait(movement.seconds);
    }
    wait(SCENE.surveySeconds); s.passage.endpointsVerifiedEventId = h.eventId;
    notes.push('本人沿六米普通岸路实际往返十二米并检查八秒，分别实查两端后回到原罐旁；两人不动，原十八米工作岸绕行道不改端点。');
  } else if (c.type === 'OBSERVE_PROPAGATION') {
    wait(SCENE.propagationObservationSeconds); s.observedPropagationEventId = h.eventId;
    s.propagation.visible = true; s.propagation.version += 1;
    notes.push('只看见原罐已暴露的一份到西蒙原站位的单线，原总量不增生。');
  } else if (isCast(c)) {
    const passage = passageCast(c), w = passage ? s.passage.window : s.barrier.window, fees = cost(passage);
    effect.actions = fees.actions; effect.cashCost = fees.cash; effect.spirituality = fees.spirituality; effect.mind = fees.mind; wait(fees.seconds);
    const before = s.wharf.rope.condition; s.wharf.rope.condition -= SCENE.castRopeWear; s.wharf.rope.version += 1;
    s.wharf.bridge.supported = s.wharf.bridge.supported && s.wharf.rope.condition > 0;
    changes.push({ objectId: s.wharf.rope.id, before, after: s.wharf.rope.condition, cause: '实际紧绷同一绳端作为近岸定位参照，磨耗两点，不产生新耗材' });
    w.attempted = true; w.passed = usedCheck!.tier === 'SUCCESS' || usedCheck!.tier === 'GREAT_SUCCESS';
    w.targetId = passage ? person(s, true).bodyId : s.propagation.id;
    w.permissionEventId = (passage ? s.passage.permission : s.barrier.permission)!.eventId;
    if (w.passed) { w.openedEventId = h.eventId; w.openedSecond = h.nowSecond + effect.seconds;
      w.expiresSecond = w.openedSecond + POLICY.windowSeconds; w.conditionVersion = version(s, passage); }
    notes.push(w.passed ? '真实检定通过，只形成二十秒有限窗口；尚未应用，不增加掌握。' : '真实检定失败，已付灵性、精神和原绳损耗保留，本次没有第二次施术。');
  } else if (c.type === 'TRAVERSE_PASSAGE') {
    walk('PARTIAL_SPIRIT', true); const w = s.passage.window; w.applied = true; w.appliedEventId = h.eventId;
    gains[DEATH_ABILITY_IDS[0]] = POLICY.passage.masteryGain;
    notes.push('本人和西蒙的同一身体实际走完六米短途，各自位置与时间入账；只这一名同伴，旧脚踝伤仍在。');
  } else if (c.type === 'APPLY_BARRIER') {
    wait(SCENE.barrierApplySeconds); s.propagation.remainingPulses = 0; s.propagation.blockedPulses = 1; s.propagation.version += 1;
    s.residue.exposed -= 1; s.residue.dissipated += 1; s.residue.conditionVersion += 1;
    s.pulse.outcome = 'BLOCKED'; s.pulse.settledSecond = h.nowSecond + effect.seconds;
    s.barrier.window.applied = true; s.barrier.window.appliedEventId = h.eventId;
    gains[DEATH_ABILITY_IDS[1]] = POLICY.barrier.masteryGain;
    changes.push({ objectId: s.residue.id, before: '一份暴露', after: '同一份消散', cause: '实际阻断同一原线的唯一脉冲；未吸收为灵库' });
    notes.push('同一有限脉冲实际遇到阻隔后消散，残余总量守恒；这次真实应用增加8掌握。');
  } else if (c.type === 'LOWER_SCREEN' || c.type === 'MANUAL_SEAL') {
    returnToVessel(); wait(SCENE.lowerLidSeconds); settlePulse(s, h.nowSecond + effect.seconds, changes, notes);
    const lidVersion = s.screen.version;
    s.screen.lowered = true; s.screen.version += 1; s.propagation.visible = false;
    changes.push({ objectId: s.screen.id, before: lidVersion, after: s.screen.version,
      cause: '亲手放低原盖遮断同一视线；房间原屏未移动' });
    if (c.type === 'MANUAL_SEAL') wait(SCENE.manualLidSeconds - SCENE.lowerLidSeconds);
    if (c.type === 'MANUAL_SEAL') {
      s.residue.contained += s.residue.exposed; s.residue.exposed = 0; s.residue.conditionVersion += 1;
      s.vessel.lid = 'CLOSED'; s.vessel.version += 1; s.vessel.manuallyContainedEventId = h.eventId;
      s.propagation.remainingPulses = 0; s.propagation.version += 1;
      if (s.pulse.outcome === 'PENDING') { s.pulse.outcome = 'CONTAINED'; s.pulse.settledSecond = h.nowSecond + effect.seconds; }
      changes.push({ objectId: s.screen.id, before: 'TILTED', after: 'CLOSED', cause: '使用同一原盖的机械闭合；旧封条仍破损，没有新封材' });
    }
    notes.push(c.type === 'MANUAL_SEAL' ? '用原盖零行动、零现金临时闭合；旧封条仍是BROKEN，不声称完成新的正式封材作业。'
      : '亲手放低原盖遮断视线；这会反制尚未应用的能力窗口，不生成第二块屏。');
  } else if (c.type === 'STOP_EFFECTS') { stop(); wait(SCENE.stopSeconds); notes.push('停止所有尚未应用的窗口；原费用、失败与磨损不退。'); }
  else if (c.type === 'WITHDRAW' || c.type === 'ORDINARY_EXIT') {
    const p = person(s, true), accompany = c.type === 'ORDINARY_EXIT' && permitted(s, true, h) && live(p) &&
      p.position === s.position && p.energy >= POLICY.ordinaryExit.energyCost;
    stop(); wait(SCENE.stopSeconds); walk('SHORE_ROAD', accompany);
    if (s.pulse.outcome === 'PENDING' && s.pulse.dueSecond !== null)
      wait(Math.max(0, s.pulse.dueSecond - (h.nowSecond + effect.seconds)));
    settlePulse(s, h.nowSecond + effect.seconds, changes, notes); s.status = 'WITHDRAWN';
    notes.push(accompany ? '两人沿六米普通岸路实际离开原站位，不施术；另一原工人留在原安全岸接管原罐。'
      : '本人零行动、零现金沿六米普通岸路退至路口，不替未同意的人移动身体；从安全处等唯一余波结束。');
    const homeWalk = { actorId: h.actorId, from: at(s.location, s.position), to: SCENE.homeLocation,
      metres: SCENE.cityLegMetres, seconds: SCENE.cityLegSeconds, energyCost: 0 };
    moves.push(homeWalk); s.journeys.push({ eventId: h.eventId, route: 'CITY_ROAD', ...homeWalk });
    wait(homeWalk.seconds); effect.toLocation = SCENE.homeLocation; s.playerLocation = SCENE.homeLocation;
    notes.push('本人继续实际步行一千八百米回接待处，两名工人分别留在已记录的岸边位置。');
  } else if (c.type === 'REPORT') {
    returnToVessel();
    stop(); wait(SCENE.reportSeconds); s.reported = true; s.status = 'RESOLVED';
    notes.push('记录同一身体、原罐余量、破封条、已付损耗与实际已发生结果；不为完成报告补骰或追加掌握。');
  }
  settlePulse(s, h.nowSecond + effect.seconds, changes, notes); refreshWindows(s, h, h.nowSecond + effect.seconds);
  need(effect.seconds > 0 && h.actions >= effect.actions && h.cash >= effect.cashCost && h.spirituality >= effect.spirituality && h.mind > effect.mind,
    '本次须有真实用时且付得起全部实际代价；不能通过不足资源提交半次施术。');
  s.lastSecond = h.nowSecond + effect.seconds; s.conditionVersion += 1;
  s.journal.push({ eventId: h.eventId, revision: h.revision, command: clone(c), beforeSecond: h.nowSecond,
    afterSecond: s.lastSecond, effect: clone(effect), check: usedCheck, movements: clone(moves), masteryGains: clone(gains), notes: [...notes],
    week: h.week, endWeek: h.week + Math.floor((s.lastSecond - h.weekAnchor) / WEEK_SECONDS), permissionEvents: permissions, objectChanges: changes });
  assertState(s); return { state: s, effect, injuries: [], movements: moves, notes, masteryGains: gains };
}

/** Explicit public whitelist. No origin, raw journal, private willingness,
 * source, digest, RNG state or future pulse timing is exposed. */
export function projectDeathEpilogue(input: DeathEpilogueState, nowSecond: number) {
  assertState(input); const s = input;
  const result = s.journal.filter(e => e.check !== null).map(e => {
    const c = e.check!;
    return { ability: c.ability, baseAbility: c.baseAbility, effectiveAbility: c.effectiveAbility,
      difficulty: c.difficulty, chance: c.chance, roll: c.roll, tier: c.tier,
      modifiers: c.modifiers.map(m => ({ label: m.source, value: m.value })) };
  });
  return {
    title: SCENE.title, status: s.status, observed: s.observed,
    playerLocation: s.playerLocation, currentScenePosition: s.playerLocation === s.location ? s.position : null, lastScenePosition: s.position,
    ordinaryExit: SCENE.ordinaryDescription,
    advice: '先完成当前窗口的实际应用；另一次施术磨损共同绳端，会使尚未应用的前一窗口失效。',
    workers: s.observed ? s.wharf.workers.map(p => ({ id: p.id, name: p.name, status: p.status,
      health: p.health, energy: p.energy, injuries: [...p.injuries], position: p.position })) : [],
    objects: s.observed ? { bridgeCondition: s.wharf.bridge.condition, ropeCondition: s.wharf.rope.condition,
      vesselPresent: s.vessel.delivered, vesselLid: s.vessel.lid, originalSeal: s.vessel.seal,
      exposed: s.residue.exposed, contained: s.residue.contained, dissipated: s.residue.dissipated,
      visibleLine: s.propagation.visible, alreadyBlockedPulses: s.propagation.blockedPulses } : null,
    abilities: [s.passage.window, s.barrier.window].map((w, i) => ({ id: w.abilityId, attempted: w.attempted,
      passed: w.passed, applied: w.applied, counter: w.counter,
      remainingWindowSeconds: w.passed && !w.applied && w.counter === 'NONE' && w.expiresSecond !== null
        ? Math.max(0, w.expiresSecond - nowSecond) : 0,
      spiritualityCost: cost(i === 0).spirituality, mindCost: cost(i === 0).mind,
      ropeConditionCost: SCENE.castRopeWear, formula: SCENE.checkFormula })),
    checks: result,
  };
}

/** Pure preview checks the complete real transfer before the start button is
 * enabled. Refusal still permits an actual asking/empty-return receipt. */
export function deathEpilogueStartPreview(services: DeathServicesState, h: DeathHost) {
  try {
    const result = startDeathEpilogue(services, h);
    const metres = result.movements.filter(row => row.actorId === h.actorId).reduce((sum, row) => sum + row.metres, 0);
    const crossedWeeks = Math.floor((h.nowSecond + result.effect.seconds - h.weekAnchor) / WEEK_SECONDS);
    return { enabled: true, reason: null, summary: SCENE.startSummary, metres, seconds: result.effect.seconds,
      mind: result.effect.mind, cash: result.effect.cashCost, actions: result.effect.actions,
      crossedWeeks, livingObligation: crossedWeeks * 24,
      cost: `${metres}米 / ${result.effect.seconds}秒 / ${result.effect.mind}精神 / 0行动 / 0便士；途中${crossedWeeks}次周结应付${crossedWeeks * 24}便士，现金不足只记本章实际欠费` };
  } catch (error) {
    return { enabled: false, reason: error instanceof Error ? error.message : '当前同人同物条件不足。', summary: SCENE.startSummary,
      metres: 3600, seconds: 3665, mind: 2, cash: 0, actions: 0, crossedWeeks: null, livingObligation: null,
      cost: '最多3600米 / 3665秒 / 2精神 / 0行动 / 0便士；真实跨周另结24便士生活费' };
  }
}
const EPILOGUE_LABELS: Record<DeathEpilogueCommand['type'], string> = {
  OBSERVE: '查看同人同罐与岸边退路', ASK_PASSAGE_PERMISSION: '当面询问西蒙本次同行意愿',
  ASK_BARRIER_PERMISSION: '当面询问埃文本次阻隔许可', SURVEY_ENDPOINTS: '实际往返查看六米两端',
  OBSERVE_PROPAGATION: '观察原罐当前有限传播线', PARTIAL_SPIRIT_PASSAGE: '尝试局部灵界通路',
  TRAVERSE_PASSAGE: '带同一身体实际通过短途', PROPAGATION_BARRIER: '尝试残余传播阻隔',
  APPLY_BARRIER: '实际拦下同一有限脉冲', LOWER_SCREEN: '亲手放低原盖遮断视线', STOP_EFFECTS: '停止当前能力窗口',
  MANUAL_SEAL: '实回原罐旁合上同一原盖', ORDINARY_EXIT: '沿普通岸路离开并步行回接待处',
  WITHDRAW: '本人普通退场并步行回接待处', REPORT: '记录同一原物与实际结果',
};
export function getDeathEpilogueActions(state: DeathEpilogueState, h: DeathHost) {
  const order: DeathEpilogueCommand['type'][] = ['OBSERVE', 'APPLY_BARRIER', 'TRAVERSE_PASSAGE',
    'ASK_BARRIER_PERMISSION', 'OBSERVE_PROPAGATION', 'PROPAGATION_BARRIER', 'ASK_PASSAGE_PERMISSION',
    'SURVEY_ENDPOINTS', 'PARTIAL_SPIRIT_PASSAGE', 'MANUAL_SEAL', 'REPORT', 'ORDINARY_EXIT', 'WITHDRAW', 'LOWER_SCREEN', 'STOP_EFFECTS'];
  const actions = order.map(type => {
    const command: DeathEpilogueCommand = { type }, reason = deathEpilogueBlock(state, command, h);
    let costText = '0便士 / 0行动；实际操作时间另计';
    if (isCast(command)) {
      const fees = cost(passageCast(command));
      costText = `${fees.spirituality}灵性 / ${fees.mind}精神 / 原绳损耗${SCENE.castRopeWear} / ${fees.seconds}秒；失败仍支付，仅实际应用加8掌握`;
    } else if (reason === null) {
      const effect = applyDeathEpilogue(state, command, { ...h, check: null }).effect;
      costText = `0便士 / 0行动 / ${effect.seconds}秒${effect.toLocation ? '；实际步行回接待处，真实跨周另结生活费' : ''}`;
    }
    return { command, label: EPILOGUE_LABELS[type], cost: costText, enabled: reason === null, reason, preferredAction: false };
  });
  // Each attempted ability and each application is finite. A blocked/refused
  // path falls through to ordinary closure/exit rather than re-asking forever.
  const preferred = actions.find(action => action.enabled);
  if (preferred) preferred.preferredAction = true;
  return actions;
}
export function nextDeathEpilogueCommand(state: DeathEpilogueState, h: DeathHost): DeathEpilogueCommand | null {
  return getDeathEpilogueActions(state, h).find(action => action.preferredAction)?.command ?? null;
}
