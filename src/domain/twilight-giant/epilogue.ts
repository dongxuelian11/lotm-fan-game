/** Finite S0 ORIGINAL scene. Two abilities affect two concrete objects, never the city or old bodies. */
import { stableStringify } from '../canonical.js';
import { resolveNormalCheck, computeCheckChance, type NormalCheckInput } from '../../resolution/normal-check.js';
import type { PublicCheckResult } from '../../shared/contracts.js';
import { emptyTwilightWorksEffect, TWILIGHT_WORKER_IDS, type TwilightWorksHost, type TwilightWorksEffect, type TwilightWorksState, type TwilightWorker, type TwilightWorkerId, type TwilightBeam, type TwilightCart } from './works-types.js';
import { validateTwilightWorksState, twilightWorksVerifiedPassages, twilightWorksCurrentOriginals } from './works.js';
export const TWILIGHT_FINITE_ABILITIES = ['warrior.s0.giant-contact-hold', 'warrior.s0.twilight-axle-easing'] as const;
const GIANT = TWILIGHT_FINITE_ABILITIES[0], TWILIGHT = TWILIGHT_FINITE_ABILITIES[1];
const SIMPLE = ['BUY_REPLACEMENT_SUPPORT', 'ARRIVE_FAR_SIDE', 'TRY_CART_RETURN', 'CONTACT_BEAM', 'GIANT_CONTACT_HOLD', 'FIT_BRACE_IN_WINDOW', 'ORDINARY_SHORE', 'OBSERVE_AXLE', 'TWILIGHT_AXLE_EASING', 'APPLY_TWILIGHT', 'STEP_TO_CART', 'PUSH_CART', 'STOP_EFFECTS', 'WAIT_20', 'ORDINARY_EXIT', 'PAUSE_SHIFT', 'WITHDRAW', 'REST_OUTSIDE', 'REPAIR_DAMAGE', 'REPORT'] as const;
export type TwilightEpilogueCommand = { type: typeof SIMPLE[number] } | { type: 'ASK_WORKER' | 'WITHDRAW_CONSENT'; workerId: TwilightWorkerId };
interface Window { attempts: number; passed: boolean; applied: boolean; targetId: string; version: number; expiresSecond: number | null; lastCheck: PublicCheckResult | null }
interface SceneInjury { id: string; severity: 'LIGHT' | 'HEAVY'; acquiredRevision: number; treatedRevision: null }
export interface TwilightEpilogueState {
  id: 'TG220-FINITE-BRIDGE-EPILOGUE'; actorId: string; sourceDigest: string; location: 'GL2-REPAIR-ROOM';
  /** Frozen completed works; this incident owns the sole subsequent beam/cart/body state. */
  origin: TwilightWorksState; startedWeek: number; startedSecond: number; lastSecond: number;
  status: 'ACTIVE' | 'RESOLVED' | 'WITHDRAWN' | 'DEAD'; reported: boolean; position: -2 | 2 | 5 | 8;
  playerEnergy: number; playerTravelMetres: number; workers: TwilightWorker[]; beam: TwilightBeam;
  cart: Omit<TwilightCart, 'position'> & { position: 2 | 8 };
  arrivedEventId: string | null; incidentEventId: string | null; contact: boolean;
  brace: { id: string; paidPennies: 24; boughtEventId: string; fittedEventId: string | null; integrity: number } | null;
  sight: { targetId: string; version: number; observedEventId: string; clearUntilSecond: number } | null;
  giant: Window; twilight: Window; playerInjuries: SceneInjury[]; repairedEventIds: string[];
  exits: { eventId: string; workerId: TwilightWorkerId; from: -2 | 2 | 5 | 8; to: -2; metres: number; second: number }[];
  journal: { command: TwilightEpilogueCommand; host: TwilightWorksHost; effect: TwilightWorksEffect; check: PublicCheckResult | null; masteryGains: Record<string, number>; notes: string[] }[];
}
const clone = <T>(v: T): T => structuredClone(v);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const skill = (c: TwilightEpilogueCommand) => c.type === 'GIANT_CONTACT_HOLD' || c.type === 'TWILIGHT_AXLE_EASING';
const pass = (c: PublicCheckResult | null) => c?.tier === 'SUCCESS' || c?.tier === 'GREAT_SUCCESS';
const blankWindow = (targetId: string): Window => ({ attempts: 0, passed: false, applied: false, targetId, version: 0, expiresSecond: null, lastCheck: null });
const atCart = (s: TwilightEpilogueState) => s.position === s.cart.position;
const bothAgree = (s: TwilightEpilogueState, h: TwilightWorksHost) => s.workers.every(w => w.consent === 'GRANTED' && w.consentWeek === h.week);
const clearSight = (s: TwilightEpilogueState, at: number, duration: number) => s.sight !== null && s.sight.targetId === s.cart.axle.id && s.sight.version === s.cart.axle.version && Math.abs(s.position - s.cart.position) <= 3 && at + duration <= s.sight.clearUntilSecond;
const activeWindow = (w: Window, targetId: string, version: number, at: number, duration: number) => w.passed && !w.applied && w.targetId === targetId && w.version === version && w.expiresSecond !== null && at + duration <= w.expiresSecond;
const stop = (s: TwilightEpilogueState) => { s.contact = false; s.giant.expiresSecond = null; s.twilight.expiresSecond = null; };
const retreatMetres = (p: number) => p === 8 ? 12 : p === 5 ? 7 : p === 2 ? 4 : 0;
export function validateTwilightEpilogueCommand(v: unknown): v is TwilightEpilogueCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>, keys = Object.keys(c).sort().join('|');
  return keys === 'type' && SIMPLE.includes(c.type as typeof SIMPLE[number]) || keys === 'type|workerId' && ['ASK_WORKER', 'WITHDRAW_CONSENT'].includes(String(c.type)) && TWILIGHT_WORKER_IDS.includes(c.workerId as TwilightWorkerId);
}
function fromOrigin(works: TwilightWorksState, week: number, second: number): TwilightEpilogueState {
  if (twilightWorksVerifiedPassages(works).length !== 2 || works.position !== -2 || works.workers.some(w => w.position !== -2) || !Number.isSafeInteger(week) || week < works.origin.week || !Number.isSafeInteger(second) || second < works.lastSecond) throw Error('须从同一已复核两份通行且所有人已退出的原桥接续。');
  return { id: 'TG220-FINITE-BRIDGE-EPILOGUE', actorId: works.actorId, sourceDigest: works.sourceDigest, location: works.location, origin: clone(works), startedWeek: week, startedSecond: second, lastSecond: second,
    status: 'ACTIVE', reported: false, position: -2, playerEnergy: works.playerEnergy, playerTravelMetres: 0, workers: works.workers.map(w => ({ ...clone(w), consent: 'UNASKED', consentWeek: null, hireEventId: null, arrivalEventId: null })),
    beam: clone(works.beam), cart: clone(works.cart), arrivedEventId: null, incidentEventId: null, contact: false, brace: null, sight: null, giant: blankWindow(works.beam.id), twilight: blankWindow(works.cart.axle.id), playerInjuries: [], repairedEventIds: [], exits: [], journal: [] };
}
export function createTwilightEpilogue(works: TwilightWorksState, input: { actorId: string; week: number; nowSecond: number }) {
  if (!validateTwilightWorksState(works) || input.actorId !== works.actorId) throw Error('不能用投影、计数或他人的通行证明创建后日谈。');
  return fromOrigin(works, input.week, input.nowSecond);
}
/** Central engine uses THIS descriptor with its real random stream, then settles the returned effect once. */
export function twilightEpilogueCheck(s: TwilightEpilogueState, c: TwilightEpilogueCommand, h: TwilightWorksHost): NormalCheckInput | null {
  if (c.type === 'GIANT_CONTACT_HOLD') return { ability: 'physique', baseAbility: h.coreStats.physique, difficulty: 25, modifiers: [] };
  if (c.type === 'TWILIGHT_AXLE_EASING') return { ability: 'will', baseAbility: h.coreStats.will, difficulty: 24, modifiers: [{ source: `亲眼观察原轴${s.cart.axle.id}与近距站位；轴心抵抗已计入难度`, value: 8 }] };
  return null;
}
export function twilightEpilogueCost(s: TwilightEpilogueState, c: TwilightEpilogueCommand) {
  const e = emptyTwilightWorksEffect();
  if (c.type === 'ASK_WORKER') { e.cashCost = 12; e.seconds = 30; }
  if (c.type === 'WITHDRAW_CONSENT') e.seconds = 1;
  if (c.type === 'BUY_REPLACEMENT_SUPPORT') { e.cashCost = 24; e.seconds = 300; }
  if (c.type === 'ARRIVE_FAR_SIDE') { e.seconds = 12; e.playerEnergy = 3; }
  if (c.type === 'TRY_CART_RETURN') { e.seconds = 10; e.playerEnergy = 2; }
  if (c.type === 'CONTACT_BEAM' || c.type === 'STEP_TO_CART') { e.seconds = 3; e.playerEnergy = 1; }
  if (c.type === 'GIANT_CONTACT_HOLD') { e.actions = 1; e.seconds = 5; e.spirituality = 14; e.mind = 6; e.playerEnergy = 6; }
  if (c.type === 'FIT_BRACE_IN_WINDOW') { e.seconds = 8; e.playerEnergy = 4; }
  if (c.type === 'ORDINARY_SHORE') { e.actions = 1; e.seconds = 180; e.playerEnergy = 6; }
  if (c.type === 'OBSERVE_AXLE') e.seconds = 10;
  if (c.type === 'TWILIGHT_AXLE_EASING') { e.actions = 1; e.seconds = 5; e.spirituality = 12; e.mind = 5; e.playerEnergy = 3; }
  if (c.type === 'APPLY_TWILIGHT') e.seconds = 3;
  if (c.type === 'PUSH_CART') { e.seconds = 30; e.playerEnergy = Math.ceil(s.cart.axle.remainingPush / 2); }
  if (c.type === 'STOP_EFFECTS') e.seconds = 1;
  if (c.type === 'WAIT_20') e.seconds = 20;
  if (c.type === 'ORDINARY_EXIT' || c.type === 'PAUSE_SHIFT' || c.type === 'WITHDRAW') { e.seconds = 180; e.playerEnergy = Math.min(3, s.playerEnergy); }
  if (c.type === 'REST_OUTSIDE') { e.seconds = 1800; e.playerEnergyRecovered = Math.min(20, 100 - s.playerEnergy); }
  if (c.type === 'REPAIR_DAMAGE') { e.actions = 1; e.cashCost = 30; e.seconds = 900; e.playerEnergy = 2; }
  if (c.type === 'REPORT') e.seconds = 30;
  return e;
}
export function twilightEpilogueBlock(s: TwilightEpilogueState, c: TwilightEpilogueCommand, h: TwilightWorksHost): string | null {
  if (!validateTwilightEpilogueCommand(c)) return '无效动作；不能从命令写入能力结果、位置或材料。';
  if (h.actorId !== s.actorId || h.sourceDigest !== s.sourceDigest || h.status !== 'ACTIVE' || h.sequence !== 0 || h.location !== s.location || h.health <= 0 || h.mind <= 0) return '须同一存活序列0本人在原桥；死亡不能续行。';
  if (!h.eventId || !Number.isSafeInteger(h.nowSecond) || h.nowSecond < s.lastSecond || h.week < s.startedWeek || h.revision <= (s.journal.at(-1)?.host.revision ?? s.origin.journal.at(-1)!.host.revision) || s.journal.some(j => j.host.eventId === h.eventId)) return '真实时间或事件顺序无效。';
  if (s.status === 'DEAD') return '本人已死；原人、原物和尸体均留在真实位置。';
  if (c.type === 'REPORT') return s.status === 'ACTIVE' ? '先实际撤回，再交接现场。' : s.reported ? '已交接。' : null;
  if (c.type === 'ORDINARY_EXIT' && s.status === 'WITHDRAWN') return s.workers.every(w => w.position === -2) ? '所有人已在室外。' : null;
  if (c.type === 'REPAIR_DAMAGE') {
    if (!s.incidentEventId || s.position !== -2 || s.workers.some(w => w.position !== -2) || s.beam.integrity >= s.origin.beam.integrity && s.cart.integrity >= s.origin.cart.integrity) return '所有人须先撤出；只普通修复本次实际损伤，旧服务磨损保留。';
  } else if (c.type === 'REST_OUTSIDE') return s.position !== -2 ? '须先实际退出。' : s.playerEnergy >= 100 ? '精力已满。' : null;
  else if (s.status !== 'ACTIVE') return '本次已结束，仍可日后实付普通修复；不能再制造事故或施术。';
  if (c.type === 'STOP_EFFECTS' || c.type === 'WAIT_20') return null;
  if (c.type === 'WITHDRAW') return s.position === -2 ? '本人已在室外。' : null;
  if (c.type === 'ORDINARY_EXIT' || c.type === 'PAUSE_SHIFT') return s.position === -2 && s.workers.every(w => w.position === -2) ? '所有人已在室外。' : null;
  if (c.type === 'ASK_WORKER') { const w = s.workers.find(w => w.id === c.workerId)!; if (s.position !== -2 || w.position !== -2 || w.consent === 'GRANTED' && w.consentWeek === h.week) return '须本人仍在室外并尚无本周有效的新许可。'; }
  if (c.type === 'WITHDRAW_CONSENT') return s.workers.find(w => w.id === c.workerId)!.consent !== 'GRANTED' ? '没有该人的有效许可。' : null;
  if (c.type === 'BUY_REPLACEMENT_SUPPORT' && (s.brace || s.position !== -2)) return '须在室外实付接收唯一新支撑；本次不复制新件。';
  if (c.type === 'ARRIVE_FAR_SIDE' && (s.cart.position !== 8 || s.position !== -2 || !bothAgree(s, h) || s.workers.some(w => w.position !== -2 || w.energy < 12))) return '两位同一成人须本周分别同意、重新领工钱且留有返程精力，所有人从室外亲自沿侧路入场。';
  if (c.type === 'TRY_CART_RETURN' && (!s.arrivedEventId || s.incidentEventId || !atCart(s) || !bothAgree(s, h))) return '须亲自到原车处首次尝试普通返车，不得反复制造同一事故。';
  if (['CONTACT_BEAM', 'GIANT_CONTACT_HOLD', 'FIT_BRACE_IN_WINDOW', 'ORDINARY_SHORE', 'OBSERVE_AXLE', 'TWILIGHT_AXLE_EASING', 'APPLY_TWILIGHT', 'STEP_TO_CART', 'PUSH_CART'].includes(c.type) && (!s.incidentEventId || !bothAgree(s, h))) return '须原事故真实发生，且两名成人当前仍同意；撤回可随时普通退出。';
  if (c.type === 'CONTACT_BEAM' && (s.position !== 8 || s.beam.integrity < 40)) return '从原车处走三米到原梁旁；梁低于40完整度时改用安全侧普通撤回。';
  if (c.type === 'GIANT_CONTACT_HOLD' && (s.position !== 5 || !s.contact || s.beam.integrity < 40 || s.giant.attempts >= 2 || s.giant.applied || !s.brace || s.brace.fittedEventId)) return '须真实接触原梁、完整度至少40、已带来新支撑；最多两次付费消耗尝试，实际应用仅一次。';
  if (c.type === 'FIT_BRACE_IN_WINDOW' && (s.position !== 5 || !s.contact || !s.brace || s.brace.fittedEventId || s.beam.integrity < 40 || !activeWindow(s.giant, s.beam.id, s.beam.version, h.nowSecond, 8))) return '须保持接触同一原梁，在未中断的20秒窗口内花8秒真实安装已购新件。';
  if (c.type === 'ORDINARY_SHORE' && (s.position !== 5 || !s.brace || s.brace.fittedEventId || s.beam.integrity < 40)) return '须在原梁旁用安全侧长柄夹具安装已购新支撑；不靠能力也可施工。';
  if (c.type === 'OBSERVE_AXLE' && (!s.cart.axle.jammed || Math.abs(s.position - s.cart.position) > 3)) return '须亲眼看清三米以内同一根仍卡住的轴。';
  if (c.type === 'TWILIGHT_AXLE_EASING' && (s.twilight.attempts >= 2 || s.twilight.applied || !s.cart.axle.jammed || !clearSight(s, h.nowSecond, 5))) return '须同一可见原轴，观察仍在30秒内；最多两次实际消耗尝试，实际减负只准一次。';
  if (c.type === 'APPLY_TWILIGHT' && (!s.cart.axle.jammed || !clearSight(s, h.nowSecond, 3) || !activeWindow(s.twilight, s.cart.axle.id, s.cart.axle.version, h.nowSecond, 3))) return '须仍可见且卡阻未变的同一原轴，在15秒窗口内实际应用。';
  if (c.type === 'STEP_TO_CART' && s.position !== 5) return '须从原梁旁真实走回三米外原车。';
  if (c.type === 'PUSH_CART' && (!atCart(s) || s.cart.position !== 8 || !s.cart.axle.jammed || !s.brace?.fittedEventId || s.brace.integrity < 40 || s.workers.some(w => w.position !== 8 || w.energy < 8))) return '须两位本人在远端、原梁已获真实新支撑，才能以剩余推力手动推回同一原车；也可不推车而普通退出。';
  const e = twilightEpilogueCost(s, c);
  return h.actions < e.actions ? '行动不足，普通退出不消耗行动。' : h.cash < e.cashCost ? `须实付${e.cashCost}便士；普通退出不收费。` : h.spirituality < e.spirituality || h.mind <= e.mind ? '精神或灵性不足；停止与普通退出仍可用。' : s.playerEnergy < e.playerEnergy + 3 ? '先留足3精力普通退路；室外可用真实时间休息。' : null;
}
export function applyTwilightEpilogue(previous: TwilightEpilogueState, c: TwilightEpilogueCommand, h: TwilightWorksHost) {
  const reason = twilightEpilogueBlock(previous, c, h); if (reason) throw Error(reason);
  if (skill(c) !== (h.check !== null)) throw Error('只有两项有限施术接收中央真实检定。');
  const descriptor = twilightEpilogueCheck(previous, c, h);
  if (descriptor && (!h.check || !same(h.check, resolveNormalCheck({ ...descriptor, roll: h.check.roll })))) throw Error('检定须与当前原目标、本人属性及真实骰值完全一致。');
  const s = clone(previous), e = twilightEpilogueCost(s, c), notes: string[] = [], injuries: SceneInjury[] = [], masteryGains: Record<string, number> = {}, end = h.nowSecond + e.seconds;
  if (c.type !== 'GIANT_CONTACT_HOLD' && c.type !== 'FIT_BRACE_IN_WINDOW' && c.type !== 'CONTACT_BEAM') { s.contact = false; s.giant.expiresSecond = null; }
  if (c.type === 'ASK_WORKER') { const w = s.workers.find(w => w.id === c.workerId)!; w.consent = 'GRANTED'; w.consentWeek = h.week; w.hireEventId = h.eventId; notes.push(`${w.name}明确同意本次有限作业，重新实领12便士；旧许可没有自动延续。`); }
  else if (c.type === 'WITHDRAW_CONSENT') { s.workers.find(w => w.id === c.workerId)!.consent = 'WITHDRAWN'; stop(s); notes.push('本人撤回许可，立即停止能力与推车；各人留在原处，仍可自主沿普通侧路退出。'); }
  else if (c.type === 'BUY_REPLACEMENT_SUPPORT') { s.brace = { id: `TG220-EPILOGUE-SUPPORT:${h.eventId}`, paidPennies: 24, boughtEventId: h.eventId, fittedEventId: null, integrity: 100 }; notes.push('实付24便士，供应者将唯一新支撑实际交到室外本人手中；旧两件支撑仍保留已耗次数与损耗。'); }
  else if (c.type === 'ARRIVE_FAR_SIDE') { s.position = 8; s.playerTravelMetres += 12; s.arrivedEventId = h.eventId; for (const w of s.workers) { w.position = 8; w.travelledMetres += 12; w.energy -= 3; w.arrivalEventId = h.eventId; } notes.push('三人各沿四米门道与八米普通侧路步行到原车旁，原车未移动，旧两名工人仍未动。'); }
  else if (c.type === 'TRY_CART_RETURN') { s.incidentEventId = h.eventId; s.beam.integrity -= 10; s.beam.version++; s.cart.integrity -= 5; s.cart.axle = { ...s.cart.axle, jammed: true, remainingPush: 8, strain: 6, version: s.cart.axle.version + 1 }; for (const w of s.workers) w.energy -= 2; notes.push('三人真实尝试返回原车，旧轴套卡住，牵引使同一梁的接头松动10，原车损耗5；车仍在八米处。记录尚需8推力、6应变，普通侧路未被堵住。'); }
  else if (c.type === 'CONTACT_BEAM') { s.position = 5; s.playerTravelMetres += 3; s.contact = true; notes.push('本人沿安全侧走三米抵达五米处原梁，手掌实际接触它；此时还没有超常支撑。'); }
  else if (skill(c)) { const giant = c.type === 'GIANT_CONTACT_HOLD', w = giant ? s.giant : s.twilight; w.attempts++; w.passed = pass(h.check); w.lastCheck = clone(h.check); w.version = giant ? s.beam.version : s.cart.axle.version; w.expiresSecond = w.passed ? end + (giant ? 20 : 15) : null;
    notes.push(giant ? `本人花14灵性、6精神、6精力尝试接触巨人形；${w.passed ? '同一梁开始被本人实际稳持，最多20秒，还须真实安装新支撑。' : '稳持未建立，位置、原梁和新支撑仍在。'}` : `本人花12灵性、5精神、3精力尝试黄昏减负；轴心抵抗已进入检定。${w.passed ? '仅对同一可见原轴开出15秒窗口，尚未减少推力。' : '原轴卡阻没有改变。'}`);
    if (!w.passed) { const severe = h.check!.tier === 'GREAT_FAILURE'; e.health = severe ? 14 : 6; const injury: SceneInjury = { id: `${h.eventId}:TG220-strain`, severity: severe ? 'HEAVY' : 'LIGHT', acquiredRevision: h.revision, treatedRevision: null }; s.playerInjuries.push(injury); injuries.push(injury);
      if (giant) { s.beam.integrity -= severe ? 5 : 2; s.beam.version++; s.contact = false; } else { s.cart.axle.strain += severe ? 2 : 1; s.cart.axle.version++; s.sight = null; }
      notes.push(`失败实扣${e.health}健康并留下${injury.severity === 'HEAVY' ? '重伤' : '轻伤'}，可致死；第二次仍重新付全部行动、精神、灵性与精力，目标损坏保留。`); }
  }
  else if (c.type === 'FIT_BRACE_IN_WINDOW' || c.type === 'ORDINARY_SHORE') { s.brace!.fittedEventId = h.eventId; s.brace!.integrity -= 5; s.beam.integrity--; s.beam.version++;
    if (c.type === 'FIT_BRACE_IN_WINDOW') { s.giant.applied = true; masteryGains[GIANT] = 8; notes.push('本人持续接触并用4精力、8秒真实装好同一已购新支撑；巨人形只完成这次局部短时承重，掌握增8，原梁磨损1。'); }
    else notes.push('用普通长柄夹具花180秒、6精力与1行动装好同一已购新支撑；原梁磨损1，没有施术掌握收益。'); stop(s);
  }
  else if (c.type === 'OBSERVE_AXLE') { s.sight = { targetId: s.cart.axle.id, version: s.cart.axle.version, observedEventId: h.eventId, clearUntilSecond: end + 30 }; notes.push(`在三米内亲眼查明同一${s.cart.axle.id}，当前尚需${s.cart.axle.remainingPush}推力、${s.cart.axle.strain}应变；看清窗口30秒。`); }
  else if (c.type === 'APPLY_TWILIGHT') { const push = Math.min(4, s.cart.axle.remainingPush), strain = Math.min(3, s.cart.axle.strain); s.cart.axle.remainingPush -= push; s.cart.axle.strain -= strain; s.cart.axle.version++; s.twilight.applied = true; s.twilight.expiresSecond = null; s.sight = null; masteryGains[TWILIGHT] = 8;
    notes.push(`只对该根真实卡轴应用一次，尚需推力减少${push}、应变减少${strain}，掌握增8；车未移动、裂损未修，剩余阻力仍须普通推车承担。`); }
  else if (c.type === 'STEP_TO_CART') { s.position = 8; s.playerTravelMetres += 3; s.sight = null; s.twilight.expiresSecond = null; notes.push('本人实际走回原车，离开原梁即失去接触；变化站位中断旧观察和窗口，必要时重新观察。'); }
  else if (c.type === 'PUSH_CART') { const push = s.cart.axle.remainingPush, strain = s.cart.axle.strain; s.cart.integrity -= strain; s.cart.position = 2; s.cart.axle.jammed = false; s.cart.axle.remainingPush = 0; s.cart.axle.version++; s.brace!.integrity -= 10;
    s.position = 2; s.playerTravelMetres += 6; for (const w of s.workers) { w.position = 2; w.travelledMetres += 6; w.energy -= Math.ceil(push / 2); } stop(s); s.sight = null;
    notes.push(`本人和两位成人实际施加剩余${push}推力，将同一原车沿六米桥推到工作台；原车实承${strain}应变损耗，新支撑再磨损10。所有人仍须再走四米退出。`); }
  else if (c.type === 'STOP_EFFECTS') { stop(s); notes.push('立即停止临时能力；不移动人、车或梁，不退款。'); }
  else if (c.type === 'WAIT_20') { stop(s); s.sight = null; notes.push('真实经过20秒，接触与观察中断，临时窗口结束；原卡阻、损伤和所有位置保留。'); }
  else if (c.type === 'ORDINARY_EXIT' || c.type === 'PAUSE_SHIFT' || c.type === 'WITHDRAW') { stop(s); s.sight = null; s.playerTravelMetres += retreatMetres(s.position); s.position = -2;
    if (c.type === 'ORDINARY_EXIT' || c.type === 'PAUSE_SHIFT') { for (const w of s.workers) if (w.position !== -2) { const from = w.position, metres = retreatMetres(from); w.position = -2; w.travelledMetres += metres; w.energy = Math.max(0, w.energy - Math.ceil(metres / 4)); w.consent = 'CLOSED'; s.exits.push({ eventId: h.eventId, workerId: w.id, from, to: -2, metres, second: end }); } s.status = c.type === 'PAUSE_SHIFT' ? 'ACTIVE' : 'RESOLVED'; s.reported = false; notes.push('每位原成人自主步行沿普通侧路/门道安全退出，无需施术、现款或行动；没有推进原车就保留原车卡阻。'); if (c.type === 'PAUSE_SHIFT') notes.push('本次只暂停班次；可在室外正常过周后重新付工钱、逐人同意并步行回来，目标与次数不重置。'); }
    else { s.status = 'WITHDRAWN'; notes.push('只有本人实走普通退路退出；两名工人仍在各自原处，不能宣称已经撤走。'); }
  }
  else if (c.type === 'REST_OUTSIDE') notes.push(`本人在室外实休1800秒，恢复${e.playerEnergyRecovered}精力，不治疗伤势或恢复旧甲。`);
  else if (c.type === 'REPAIR_DAMAGE') { s.beam.integrity = Math.max(s.beam.integrity, s.origin.beam.integrity); s.beam.version++; s.cart.integrity = Math.max(s.cart.integrity, s.origin.cart.integrity); s.repairedEventIds.push(h.eventId); notes.push('所有人撤出后实付30便士新接头与轴套、1行动和900秒普通修复本次损坏；保留先前服务磨损、耗费支撑、人员伤势与原车当前位置，卡阻未另行排除就仍在。'); }
  else { s.reported = true; notes.push(`如实交接：本人室外；${s.workers.map(w => `${w.name}${w.position}米、精力${w.energy}`).join('；')}。同一梁完整度${s.beam.integrity}，同一车${s.cart.position}米、完整度${s.cart.integrity}、${s.cart.axle.jammed ? '仍卡住' : '已手动解卡'}；未应用技巧不增掌握。`); }
  s.playerEnergy = s.playerEnergy - e.playerEnergy + e.playerEnergyRecovered; s.lastSecond = end;
  for (const w of [s.giant, s.twilight]) if (w.expiresSecond !== null && end > w.expiresSecond) w.expiresSecond = null;
  if (h.health <= e.health || h.mind <= e.mind) { s.status = 'DEAD'; stop(s); notes.push('本人真实生命或精神耗尽，不能继续行动，也不替任何人自动撤离。'); }
  s.journal.push({ command: clone(c), host: clone(h), effect: clone(e), check: clone(h.check), masteryGains: { ...masteryGains }, notes: [...notes] });
  return { state: s, effect: e, notes, injuries, masteryGains };
}
export function validateTwilightEpilogueState(v: unknown): v is TwilightEpilogueState {
  try { const s = v as TwilightEpilogueState; if (!s || !Array.isArray(s.journal) || !validateTwilightWorksState(s.origin)) return false; let r = fromOrigin(s.origin, s.startedWeek, s.startedSecond); for (const j of s.journal) r = applyTwilightEpilogue(r, j.command, j.host).state; return same(r, s); } catch { return false; }
}
export function twilightEpilogueCurrentOriginals(s: TwilightEpilogueState) {
  const original = twilightWorksCurrentOriginals(s.origin); original.site.playerEnergy = s.playerEnergy; original.site.playerTravelMetres += s.playerTravelMetres; original.site.clockSeconds = s.lastSecond;
  original.site.playerLocation = s.position === -2 ? 'OUTSIDE' : s.position === 2 ? 'BENCH' : 'BRIDGE'; return { site: original.site, exactPlayerPosition: s.position, beam: clone(s.beam), cart: clone(s.cart), workers: clone(s.workers) };
}
export function projectTwilightEpilogue(s: TwilightEpilogueState) {
  return { title: '原梁与卡轴：有限序列0后日谈', status: s.status, lines: [`本人${s.position}米、精力${s.playerEnergy}；原梁${s.beam.integrity}完整度。`, `原车${s.cart.position}米；卡轴${s.cart.axle.jammed ? '尚卡住' : '已解卡'}，尚需${s.cart.axle.remainingPush}推力、${s.cart.axle.strain}应变。`, ...s.workers.map(w => `${w.name}仍为同一成人，${w.position}米、精力${w.energy}、${w.consent}。`), `巨人形尝试${s.giant.attempts}/2，实际承重安装${s.giant.applied ? 1 : 0}次；黄昏尝试${s.twilight.attempts}/2，实际减负${s.twilight.applied ? 1 : 0}次。`, '两种技巧只作用于近处指定原件；失败实耗且可致死。普通支撑、手动推车与普通侧路退出始终是独立路径。'] };
}
export function getTwilightEpilogueActions(s: TwilightEpilogueState, h: TwilightWorksHost) {
  const commands: TwilightEpilogueCommand[] = [...SIMPLE.map(type => ({ type })), ...TWILIGHT_WORKER_IDS.flatMap(workerId => [{ type: 'ASK_WORKER' as const, workerId }, { type: 'WITHDRAW_CONSENT' as const, workerId }])];
  const labels: Record<TwilightEpilogueCommand['type'], string> = { ASK_WORKER: '分别重新询问并实付本次工钱', WITHDRAW_CONSENT: '读取该人撤回同意并停止能力', BUY_REPLACEMENT_SUPPORT: '实付接收唯一新支撑', ARRIVE_FAR_SIDE: '三人沿普通侧路亲自到原车旁', TRY_CART_RETURN: '首次真实尝试普通返车', CONTACT_BEAM: '走三米并实际接触原梁', GIANT_CONTACT_HOLD: '巨人形短时接触稳梁', FIT_BRACE_IN_WINDOW: '保持接触并装好已购新支撑', ORDINARY_SHORE: '普通长柄夹具安装新支撑', OBSERVE_AXLE: '近距离看清同一原卡轴', TWILIGHT_AXLE_EASING: '尝试有限黄昏减负', APPLY_TWILIGHT: '对仍卡住的同一轴应用一次', STEP_TO_CART: '本人走回三米外原车', PUSH_CART: '真实施加剩余推力推回原车', STOP_EFFECTS: '立即停止所有临时能力', WAIT_20: '真实等待20秒并失去接触', ORDINARY_EXIT: '所有人自主沿普通路退出', PAUSE_SHIFT: '所有人退出暂歇，保留原事故待续', WITHDRAW: '仅本人沿普通路退出', REST_OUTSIDE: '本人室外真实休息半小时', REPAIR_DAMAGE: '实付修复本次梁与车损伤', REPORT: '如实交接当前人员与损耗' };
  return commands.map(command => { const effect = twilightEpilogueCost(s, command), reason = twilightEpilogueBlock(s, command, h), descriptor = twilightEpilogueCheck(s, command, h); return { command, label: `${labels[command.type]}${'workerId' in command ? `：${s.workers.find(w => w.id === command.workerId)!.name}` : ''}`, cost: `${effect.actions}行动、${effect.cashCost}便士、${effect.spirituality}灵性、${effect.mind}精神、${effect.playerEnergy}精力、${effect.seconds}秒${descriptor ? '；失败实伤6，严重失败14，可致死；最多尝试两次' : ''}`, chance: descriptor ? computeCheckChance(descriptor) : null, enabled: !reason, reason, preferredAction: false }; });
}
