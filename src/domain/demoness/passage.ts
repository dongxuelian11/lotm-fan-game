import type { DemonessCheckSpec, DemonessEffect, DemonessHost, DemonessPassage, DemonessPassageCommand, DemonessPosition } from './types.js';
import { DEMONESS_ABILITY_IDS, DEMONESS_RESIDENT_IDS } from './types.js';
import { DEMONESS_PRICES } from './content.js';
import { sameDemoness } from './source.js';
const clone = <T>(v: T): T => structuredClone(v);
const success = (h: DemonessHost) => h.check?.tier === 'SUCCESS' || h.check?.tier === 'GREAT_SUCCESS';
const exact = (v: object, keys: string[]) => sameDemoness(Object.keys(v).sort(), keys.sort());
const position = (v: unknown): v is DemonessPosition => [-2, 0, 3, 6].includes(v as number);
export function validateDemonessPassageCommand(v: unknown): v is DemonessPassageCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  if (['BUY_SUPPORT', 'FIT_SUPPORT'].includes(String(c.type))) return exact(c, ['type', 'segment']) && (c.segment === 'A' || c.segment === 'B');
  if (['ASK_RESIDENT', 'WITHDRAW_RESIDENT', 'ARRIVE_RESIDENT', 'EXIT_RESIDENT', 'CROSS_RETURN'].includes(String(c.type))) return exact(c, ['type', 'residentId']) && DEMONESS_RESIDENT_IDS.includes(c.residentId as typeof DEMONESS_RESIDENT_IDS[number]);
  if (c.type === 'CROSS') return exact(c, ['type', 'residentId', 'segment']) && DEMONESS_RESIDENT_IDS.includes(c.residentId as typeof DEMONESS_RESIDENT_IDS[number]) && (c.segment === 'A' || c.segment === 'B');
  if (c.type === 'WALK') return exact(c, ['type', 'to']) && position(c.to);
  return exact(c, ['type']) && ['SURVEY', 'WALK_SIDE_PATH', 'REPORT_PASSAGE', 'START_RETURN', 'BUY_RETURN_KIT', 'OBSERVE_STONE', 'PETRIFY_STONE', 'CATCH_STONE', 'CLEAR_FALLEN_STONE', 'TOUCH_STRUT', 'RESHAPE_STRUT', 'FIT_WEDGE', 'ORDINARY_SHORE', 'END_CONTACT', 'PAUSE_SHIFT', 'REPORT_RETURN', 'REST_OUTSIDE'].includes(String(c.type));
}
export function createDemonessPassage(playerEnergy: number): DemonessPassage {
  return { id: 'DM221-DAMAGED-ARCH', phase: 'PREPARATION', position: -2, playerEnergy, playerWalkedMetres: 0,
    surveyEventId: null, sidePathEventId: null, passageReportEventId: null, returnReportEventId: null,
    residents: [
      { id: 'DM221-ENID', name: '伊妮德·沃德', age: 38, alive: true, health: 100, energy: 90, position: -2, walkedMetres: 0, consent: 'UNASKED', consentWeek: null, permissionEventId: null, arrivalEventId: null, services: [], passage: null, returnPassage: null },
      { id: 'DM221-ROWAN', name: '罗温·格雷', age: 44, alive: true, health: 100, energy: 85, position: -2, walkedMetres: 0, consent: 'UNASKED', consentWeek: null, permissionEventId: null, arrivalEventId: null, services: [], passage: null, returnPassage: null },
    ], supports: [], strut: { id: 'DM221-ORIGINAL-STRUT', version: 1, integrity: 70, resistance: 12, scarred: true, reshaped: false },
    stone: { id: 'DM221-ORIGINAL-STONE', version: 1, massKg: 2, resistance: 10, state: 'LOOSE', fallingUntil: null, observedAt: null, petrified: false },
    returnKit: null, contact: false, window: null, petrificationAttempts: 0, reshapingAttempts: 0,
    petrificationAppliedEventId: null, reshapingAppliedEventId: null };
}
export const demonessInsidePassage = (p: DemonessPassage | null): boolean => !!p && (p.position !== -2 || p.residents.some(r => r.position !== -2) || p.contact || p.stone.state === 'FALLING');
export const demonessPassagesComplete = (p: DemonessPassage): boolean => !!p.passageReportEventId && p.residents.every(r => !!r.passage?.a && !!r.passage.b && !!r.passage.exit && r.position === -2);
const permitted = (p: DemonessPassage, h: DemonessHost) => p.residents.every(r => r.alive && r.consent === 'GRANTED' && r.consentWeek === h.week && r.permissionEventId !== null);
const permissions = (p: DemonessPassage) => p.residents.map(r => r.permissionEventId!);
function usable(p: DemonessPassage, h: DemonessHost, kind: 'PETRIFICATION' | 'RESHAPING', seconds: number): boolean {
  const w = p.window, t = kind === 'PETRIFICATION' ? p.stone : p.strut;
  return !!w && w.kind === kind && w.targetId === t.id && w.version === t.version && w.playerPosition === p.position &&
    permitted(p, h) && sameDemoness(w.permissionEventIds, permissions(p)) && h.nowSecond + seconds <= w.expiresAt &&
    (kind === 'PETRIFICATION' ? p.stone.state === 'FALLING' && p.stone.fallingUntil !== null && h.nowSecond + seconds <= p.stone.fallingUntil : p.contact);
}
export function demonessPassageCheck(p: DemonessPassage, c: DemonessPassageCommand, h: DemonessHost): DemonessCheckSpec | null {
  if (c.type === 'PETRIFY_STONE') return { ability: 'will', difficulty: p.stone.resistance + 7, modifiers: [{ source: '同一碎块的实际施术掌握', value: Math.floor((h.budget.mastery[DEMONESS_ABILITY_IDS[0]] ?? 0) / 10) }] };
  if (c.type === 'RESHAPE_STRUT') return { ability: 'knowledge', difficulty: p.strut.resistance, modifiers: [{ source: '原撑局部整形掌握', value: Math.floor((h.budget.mastery[DEMONESS_ABILITY_IDS[1]] ?? 0) / 10) }] };
  return null;
}
const blank = (): DemonessEffect => ({ actions: 0, cash: 0, spirituality: 0, mind: 0, health: 0, seconds: 1, mastery: {}, injury: null });
function quote(p: DemonessPassage, c: DemonessPassageCommand): DemonessEffect {
  const e = blank();
  if (c.type === 'SURVEY') Object.assign(e, { actions: 1, seconds: 600 });
  if (c.type === 'WALK_SIDE_PATH') e.seconds = 24;
  if (c.type === 'BUY_SUPPORT') Object.assign(e, { actions: 1, cash: DEMONESS_PRICES.support, seconds: 600 });
  if (c.type === 'FIT_SUPPORT') Object.assign(e, { actions: 1, seconds: 60 });
  if (c.type === 'ASK_RESIDENT') e.seconds = 30;
  if (c.type === 'ARRIVE_RESIDENT') { const r = p.residents.find(r => r.id === c.residentId)!; Object.assign(e, { cash: DEMONESS_PRICES.residentService, seconds: p.phase === 'PREPARATION' && r.passage?.a && !r.passage.b ? 5 : 2 }); }
  if (c.type === 'CROSS') e.seconds = 3;
  if (c.type === 'EXIT_RESIDENT') { const r = p.residents.find(r => r.id === c.residentId)!; e.seconds = r.position === 6 ? 12 : Math.max(1, r.position + 2); }
  if (c.type === 'WALK') e.seconds = c.to === -2 && p.position === 6 ? 12 : Math.abs(c.to - p.position);
  if (c.type === 'BUY_RETURN_KIT') Object.assign(e, { actions: 1, cash: DEMONESS_PRICES.returnKit, seconds: 600 });
  if (c.type === 'PETRIFY_STONE') Object.assign(e, { actions: 1, spirituality: 12, mind: 5, seconds: 1 });
  if (c.type === 'CATCH_STONE') e.seconds = 2;
  if (c.type === 'CLEAR_FALLEN_STONE') Object.assign(e, { actions: 1, cash: 20, seconds: 300 });
  if (c.type === 'RESHAPE_STRUT') Object.assign(e, { actions: 1, spirituality: 14, mind: 6, seconds: 1 });
  if (c.type === 'FIT_WEDGE') e.seconds = 8;
  if (c.type === 'ORDINARY_SHORE') Object.assign(e, { actions: 1, seconds: 30 });
  if (c.type === 'CROSS_RETURN') e.seconds = 6;
  if (c.type === 'REST_OUTSIDE') e.seconds = 3600;
  if (c.type === 'PAUSE_SHIFT') e.seconds = 36;
  if (c.type === 'REPORT_PASSAGE' || c.type === 'REPORT_RETURN') e.seconds = 60;
  return e;
}
export function demonessPassageBlock(p: DemonessPassage, c: DemonessPassageCommand, h: DemonessHost): string | null {
  if (!validateDemonessPassageCommand(c) || h.location !== 'DM221-ARCH') return '须本人实际步行到同一旧石拱通道。';
  const e = quote(p, c), r = 'residentId' in c ? p.residents.find(r => r.id === c.residentId)! : null;
  if (h.budget.actions < e.actions || h.budget.cash < e.cash || h.budget.spirituality < e.spirituality || h.budget.mind <= e.mind) return '当前行动、实付费用、灵性或精神不足；仍可停手并沿侧路离开。';
  if (c.type === 'EXIT_RESIDENT') return r!.position === -2 ? '这位成人已经实际离开。' : null;
  if (c.type === 'WITHDRAW_RESIDENT') return r!.consent !== 'GRANTED' ? '这位成人当前没有尚可撤回的许可。' : null;
  if (c.type === 'PAUSE_SHIFT') return !demonessInsidePassage(p) ? '本人和两位成人已经在室外。' : null;
  if (c.type === 'END_CONTACT') return !p.contact && !p.window ? '当前没有持续接触或施术窗口。' : null;
  if (c.type === 'WALK' && c.to === -2) return p.position === -2 ? '本人已经在室外。' : null;
  if (c.type === 'REST_OUTSIDE') return p.position !== -2 || p.residents.some(r => r.position !== -2) || p.stone.state === 'FALLING' ? '先逐人沿普通侧路退出并等落石结束。' : p.playerEnergy >= 100 && p.residents.every(r => r.energy >= 100) ? '本人和两位成人的精力都已充足。' : null;
  if (c.type === 'SURVEY') return p.surveyEventId ? '同一原撑和落石已经调查过。' : null;
  if (!p.surveyEventId) return '先查看同一损坏撑杆、两公斤松石和普通出口。';
  if (c.type === 'WALK_SIDE_PATH') return p.sidePathEventId ? '普通侧路已经实际走查。' : p.position !== -2 || p.playerEnergy < 24 ? '本人须在室外并有24精力，亲自往返十二米侧路。' : null;
  if (!p.sidePathEventId) return '先亲自走查可随时退出的普通侧路。';
  if (c.type === 'ASK_RESIDENT') return !r!.alive || r!.position !== -2 ? '在室外亲自询问仍在世的这位成人。' : r!.consent === 'GRANTED' && r!.consentWeek === h.week ? '这位成人本周的当前许可已经取得。' : null;
  if (c.type === 'ARRIVE_RESIDENT') return !['PREPARATION', 'RETURN'].includes(p.phase) || r!.position !== -2 || r!.consent !== 'GRANTED' || r!.consentWeek !== h.week || r!.energy < 20 ? '须有当前许可、足够精力并尚在室外；本次有价服务另行支付。' : p.phase === 'PREPARATION' && r!.passage?.exit || p.phase === 'RETURN' && r!.returnPassage?.exit ? '这位成人已经完成本次实际通行。' : null;
  if (c.type === 'BUY_SUPPORT') return p.phase !== 'PREPARATION' || p.supports.some(x => x.segment === c.segment) || p.position !== -2 ? '只有尚未购买的这件支撑可在室外实购一次。' : null;
  if (c.type === 'WALK') return p.position === c.to ? '本人已经在这里。' : c.to === 6 ? '本人使用普通侧路退出，不独自走上没有任务的远端。' : !permitted(p, h) || !p.residents.some(r => r.position !== -2) ? '须有两位成人当前许可及至少一人实际在入口。' : p.playerEnergy < Math.abs(c.to - p.position) ? '本人精力不足，先沿普通道路退出休息。' : null;
  if (c.type === 'FIT_SUPPORT') { const s = p.supports.find(x => x.segment === c.segment); return p.phase !== 'PREPARATION' || p.position !== 0 || !permitted(p, h) || !s || s.fittedEventId || p.playerEnergy < 4 ? '本人须在入口，用4精力安装已购且尚未安装的原支撑。' : null; }
  if (c.type === 'CROSS') { const s = p.supports.find(x => x.segment === c.segment), expected = c.segment === 'A' ? 0 : 3;
    return p.phase !== 'PREPARATION' || p.position !== expected || r!.position !== expected || !permitted(p, h) || !r!.passage || !s?.fittedEventId || s.passagesRemaining < 1 || r!.energy < 3 || c.segment === 'A' && !!r!.passage.a || c.segment === 'B' && (!r!.passage.a || !!r!.passage.b) ? '本人须在同段近处监督，这位成人须有许可、已到段首，且实购支撑仍有承载次数。' : null; }
  if (c.type === 'REPORT_PASSAGE') return p.phase !== 'PREPARATION' || p.position !== -2 || p.residents.some(r => r.position !== -2 || !r.passage?.a || !r.passage.b || !r.passage.exit) ? '两位成人须各自真正走完两段并退出，本人也须走到室外。' : null;
  if (c.type === 'START_RETURN') return h.budget.sequence !== 0 || p.phase !== 'PREPARED' || !demonessPassagesComplete(p) ? '实际晋升后才能回到这根原撑，处理下一次通行。' : null;
  if (p.phase !== 'RETURN') return '这项行动用于晋升后的同一旧通道。';
  if (c.type === 'BUY_RETURN_KIT') return p.returnKit || p.position !== -2 ? '这份有限木楔与承接盘只能在室外另购一次。' : null;
  if (c.type === 'REPORT_RETURN') return p.position !== -2 || p.residents.some(r => r.position !== -2 || !r.returnPassage?.crossing || !r.returnPassage.exit) ? '两位成人须走过实际支撑的旧通道并亲自退出，本人也须在室外。' : null;
  if (!permitted(p, h) || p.residents.some(r => r.position === -2 && !r.returnPassage?.exit)) return '须取得本周当前许可，并让尚未通过的两位成人实际走到入口。';
  if (c.type === 'OBSERVE_STONE') return p.position !== 3 || p.stone.state !== 'LOOSE' || !p.returnKit ? '本人须到距原碎块三米内，先备好有价承接盘与木楔；只观察尚未剥落的同一原物。' : null;
  if (c.type === 'PETRIFY_STONE') return p.position !== 3 || p.stone.state !== 'FALLING' || p.stone.observedAt === null || p.stone.fallingUntil === null || h.nowSecond + 1 >= p.stone.fallingUntil || p.petrificationAttempts >= 2 || p.playerEnergy < 3 ? '只可作用于眼前仍在剥落的同一碎块，限两次，须有3精力并来得及收手。' : usable(p, h, 'PETRIFICATION', 2) ? '当前窗口仍可用于实际接住落石。' : null;
  if (c.type === 'CATCH_STONE') return p.position !== 3 || p.stone.state !== 'FALLING' || p.stone.fallingUntil === null || h.nowSecond + 2 > p.stone.fallingUntil || !p.returnKit?.catcherUses || p.playerEnergy < 4 ? '本人须在近处，趁落石尚未落地，用同一只未耗承接盘和4精力实际接住。' : null;
  if (c.type === 'CLEAR_FALLEN_STONE') return p.stone.state !== 'LANDED' || p.position !== 0 || p.playerEnergy < 4 ? '落石落定后，本人可在入口付费清走同一块石头，需4精力。' : null;
  if (!['CAUGHT', 'CLEARED'].includes(p.stone.state)) return '先实际接住或普通清走原落石，再处理同一根撑杆。';
  if (c.type === 'TOUCH_STRUT') return p.position !== 3 || p.contact || p.returnKit?.fittedEventId ? '本人须在近处，持续触碰尚未装楔的同一原撑。' : null;
  if (c.type === 'RESHAPE_STRUT') return p.position !== 3 || !p.contact || p.strut.reshaped || p.reshapingAttempts >= 2 || p.playerEnergy < 6 || !p.returnKit?.wedgeUses ? '须持续接触同一原撑，有6精力和未耗木楔，至多尝试两次。' : usable(p, h, 'RESHAPING', 8) ? '当前整形窗口仍可实际装楔。' : null;
  if (c.type === 'FIT_WEDGE') return !p.returnKit?.wedgeUses || p.playerEnergy < 4 || !usable(p, h, 'RESHAPING', 8) ? '须在同一原撑整形窗口内保持接触，用4精力和8秒实际装入已购木楔。' : null;
  if (c.type === 'ORDINARY_SHORE') return p.position !== 3 || !p.returnKit?.wedgeUses || p.playerEnergy < 6 ? '本人须到原撑近处，用1行动、6精力与实购木楔完成普通加撑。' : null;
  if (c.type === 'CROSS_RETURN') return p.position !== 3 || r!.position !== 0 || !r!.returnPassage || !p.returnKit?.fittedEventId || r!.energy < 6 ? '本人须在原撑近处，当前许可仍有效，木楔已经实际装好，这位成人才可亲自走完六米。' : null;
  return '当前无法这样行动。';
}
export function applyDemonessPassage(input: DemonessPassage, c: DemonessPassageCommand, h: DemonessHost) {
  const reason = demonessPassageBlock(input, c, h); if (reason) throw Error(reason);
  const p = clone(input), effect = quote(p, c), notes: string[] = [], r = 'residentId' in c ? p.residents.find(r => r.id === c.residentId)! : null;
  const movePlayer = (to: DemonessPosition, metres = Math.abs(to - p.position)) => { p.position = to; p.playerWalkedMetres += metres; p.playerEnergy = Math.max(0, p.playerEnergy - metres); p.contact = false; p.window = null; };
  const moveResident = (resident: typeof p.residents[number], to: DemonessPosition, metres: number) => { resident.position = to; resident.walkedMetres += metres; resident.energy = Math.max(0, resident.energy - metres); };
  if (!['PETRIFY_STONE', 'CATCH_STONE', 'RESHAPE_STRUT', 'FIT_WEDGE', 'TOUCH_STRUT'].includes(c.type)) { p.window = null; p.contact = false; }
  if (c.type === 'SURVEY') { p.surveyEventId = h.eventId; notes.push('亲眼查看同一损坏撑杆、两公斤松碎石及两段三米通道；旧裂痕与阻力已记下。'); }
  if (c.type === 'WALK_SIDE_PATH') { p.sidePathEventId = h.eventId; p.playerEnergy -= 24; p.playerWalkedMetres += 24; notes.push('本人亲自往返十二米普通侧路；没有施术、搬人或改动旧物。'); }
  if (c.type === 'ASK_RESIDENT') { r!.consent = 'GRANTED'; r!.consentWeek = h.week; r!.permissionEventId = h.eventId; notes.push(`${r!.name}亲自同意本周的通行、普通支撑，以及本人在场时对原石原撑进行有限施术；撤回后立即停止。`); }
  if (c.type === 'WITHDRAW_RESIDENT') { r!.consent = 'WITHDRAWN'; notes.push(`${r!.name}撤回许可；已付费用与实际位置保留，仍可从普通侧路退出。`); }
  if (c.type === 'BUY_SUPPORT') { p.supports.push({ id: `DM221-SUPPORT-${c.segment}`, segment: c.segment, boughtEventId: h.eventId, fittedEventId: null, passagesRemaining: 2 }); notes.push(`实付30便士取得这件新支撑，限两次实际承载。`); }
  if (c.type === 'FIT_SUPPORT') { p.supports.find(x => x.segment === c.segment)!.fittedEventId = h.eventId; p.playerEnergy -= 4; notes.push('付出一次行动、4精力和一分钟安装原件，未补回其他支撑。'); }
  if (c.type === 'ARRIVE_RESIDENT') { const resumeMiddle = p.phase === 'PREPARATION' && !!r!.passage?.a && !r!.passage.b; moveResident(r!, resumeMiddle ? 3 : 0, effect.seconds); r!.arrivalEventId = h.eventId; r!.services.push(h.eventId);
    if (p.phase === 'RETURN' && !r!.returnPassage) r!.returnPassage = { arrivalEventId: h.eventId, crossing: null, exit: null };
    else if (p.phase === 'PREPARATION' && !r!.passage) r!.passage = { arrivalEventId: h.eventId, a: null, b: null, exit: null };
    notes.push(`实付20便士，${r!.name}以自己的身体沿普通道路步行${effect.seconds}米${resumeMiddle ? '回到中段，保留已经实际走完的前段' : '到入口'}。`); }
  if (c.type === 'WALK') { movePlayer(c.to, effect.seconds); notes.push(`本人沿普通道路实际步行${effect.seconds}米；接触与施术窗口已停止。`); }
  if (c.type === 'CROSS') { moveResident(r!, c.segment === 'A' ? 3 : 6, 3); p.supports.find(x => x.segment === c.segment)!.passagesRemaining--;
    if (c.segment === 'A') r!.passage!.a = h.eventId; else r!.passage!.b = h.eventId;
    p.strut.integrity--; p.strut.version++; notes.push(`${r!.name}亲自走完三米，实际消耗一次支撑承载，原撑磨损继续留下。`); }
  if (c.type === 'EXIT_RESIDENT') { const from = r!.position; moveResident(r!, -2, effect.seconds);
    if (from === 6 && p.phase === 'PREPARATION' && r!.passage?.a && r!.passage.b) r!.passage.exit = h.eventId;
    if (from === 6 && p.phase === 'RETURN' && r!.returnPassage?.crossing) r!.returnPassage.exit = h.eventId;
    notes.push(`${r!.name}亲自沿普通侧路退出；若未走完通道，不会算作完成通行。`); }
  if (c.type === 'REPORT_PASSAGE') { p.passageReportEventId = h.eventId; p.phase = 'PREPARED'; notes.push('两位成人各自走过两段并真实退出，四次承载和两份结果均已核对。'); }
  if (c.type === 'START_RETURN') { p.phase = 'RETURN'; notes.push('回到同一原撑和原松石，旧支撑均已耗去两次承载；两位成人仍须当面同意、另付服务并实际走到入口。'); }
  if (c.type === 'BUY_RETURN_KIT') { p.returnKit = { boughtEventId: h.eventId, catcherUses: 1, wedgeUses: 1, fittedEventId: null, usedReshaping: false, appliedEventId: null }; notes.push('实付50便士取得一只普通承接盘与一枚新木楔，各只能实际使用一次。'); }
  if (c.type === 'OBSERVE_STONE') { p.stone.observedAt = h.nowSecond; p.stone.state = 'FALLING'; p.stone.fallingUntil = h.nowSecond + 8; p.stone.version++; notes.push('原两公斤碎块开始从裂缝缓慢剥落，八秒内会完全落下。两位成人停在入口护栏后，本人可接住，或立即退开再付费清理。'); }
  if (c.type === 'PETRIFY_STONE') { p.petrificationAttempts++; p.playerEnergy -= 3; p.contact = false; p.window = success(h) ? { kind: 'PETRIFICATION', targetId: p.stone.id, version: p.stone.version, playerPosition: p.position, createdAt: h.nowSecond, expiresAt: p.stone.fallingUntil!, permissionEventIds: permissions(p) } : null; notes.push(success(h) ? '同一碎块松碎表面的石化已开始，落势仍在，必须在窗口内用原承接盘实际接住。' : '原碎块抵抗了石化，施术费用已经付出；仍能普通接住或立刻退开。'); }
  if (c.type === 'CATCH_STONE') { const applied = usable(input, h, 'PETRIFICATION', effect.seconds); p.playerEnergy -= 4; p.returnKit!.catcherUses = 0; p.stone.state = 'CAUGHT'; p.stone.fallingUntil = null; p.stone.petrified = applied; p.stone.version++; p.window = null;
    effect.health = applied ? 3 : 8; effect.injury = 'LIGHT'; if (applied) { p.petrificationAppliedEventId = h.eventId; effect.mastery[DEMONESS_ABILITY_IDS[0]] = 8; }
    notes.push(applied ? '用同一承接盘真实接住已石化的碎块；仍损失3健康并留下轻伤，实际应用增加8掌握。' : '用同一承接盘普通接住落石，实际损失8健康并留下轻伤；没有施术掌握。'); }
  if (c.type === 'CLEAR_FALLEN_STONE') { p.playerEnergy -= 4; p.stone.state = 'CLEARED'; p.stone.version++; notes.push('实付20便士和一次行动，清走已经落地的同一块石头；既有损伤不消失。'); }
  if (c.type === 'TOUCH_STRUT') { p.contact = true; p.window = null; notes.push('本人在三米处持续触碰原损坏撑杆。'); }
  if (c.type === 'RESHAPE_STRUT') { p.reshapingAttempts++; p.playerEnergy -= 6; p.window = success(h) ? { kind: 'RESHAPING', targetId: p.strut.id, version: p.strut.version, playerPosition: p.position, createdAt: h.nowSecond, expiresAt: h.nowSecond + 20, permissionEventIds: permissions(p) } : null; notes.push(success(h) ? '原撑的受力阻力已克服，二十秒内可在保持接触时将局部端面整形并实际装楔。' : '原撑的阻力使本次整形失败，费用保留，仍能用同一已购木楔普通加撑。'); }
  if (c.type === 'FIT_WEDGE' || c.type === 'ORDINARY_SHORE') { const applied = c.type === 'FIT_WEDGE'; p.playerEnergy -= applied ? 4 : 6; p.returnKit!.wedgeUses = 0; p.returnKit!.fittedEventId = h.eventId; p.returnKit!.usedReshaping = applied;
    if (applied) { p.strut.integrity += 4; p.strut.reshaped = true; } p.strut.version++; p.contact = false; p.window = null; notes.push(applied ? '保持接触，局部整形并实际装入原木楔；只改善这处端面4点承载，裂痕保留，实际通行后才计掌握。' : '用一次行动普通加撑，实耗同一枚木楔，原撑裂痕和磨损保留。'); }
  if (c.type === 'CROSS_RETURN') { moveResident(r!, 6, 6); r!.returnPassage!.crossing = h.eventId;
    if (!p.returnKit!.appliedEventId) { p.returnKit!.appliedEventId = h.eventId; if (p.returnKit!.usedReshaping) { p.reshapingAppliedEventId = h.eventId; effect.mastery[DEMONESS_ABILITY_IDS[1]] = 8; } }
    p.strut.integrity--; p.strut.version++; notes.push(`${r!.name}以自己的身体实际走过六米原通道，已装木楔真正承载；普通安全退出仍须亲自走完。`); }
  if (c.type === 'REST_OUTSIDE') { p.playerEnergy = Math.min(100, p.playerEnergy + 20); for (const r of p.residents) r.energy = Math.min(100, r.energy + 10); notes.push('在室外实际休息一小时，本人恢复20精力、两位在场成人各恢复10精力；原展廊人物和伤势不改变。'); }
  if (c.type === 'PAUSE_SHIFT') { for (const r of p.residents) if (r.position !== -2) { const from = r.position; moveResident(r, -2, from === 6 ? 12 : from + 2); if (from === 6 && p.phase === 'PREPARATION' && r.passage?.a && r.passage.b) r.passage.exit = h.eventId; if (from === 6 && p.phase === 'RETURN' && r.returnPassage?.crossing) r.returnPassage.exit = h.eventId; } if (p.position !== -2) movePlayer(-2, p.position === 6 ? 12 : p.position + 2); notes.push('本人和仍在场的成人逐人沿普通侧路步行退出，低精力时放慢脚步；未走完的通行不算完成，服务费不退。'); }
  if (c.type === 'END_CONTACT') notes.push('本人松手并停止持续施术，费用、原物变化与当前落石仍保留。');
  if (c.type === 'REPORT_RETURN') { p.phase = 'CLOSED'; p.returnReportEventId = h.eventId; notes.push('核对两位成人实际通行和逐人退出。原撑、石头、用过的承接盘与木楔保持当前真实状态。'); }
  return { state: p, effect, notes };
}
/** Physical deadlines advance even on unrelated actions; the object cannot wait forever. */
export function advanceDemonessPassageClock(p: DemonessPassage, nowSecond: number): { health: number; injury: boolean; notes: string[] } {
  const result = { health: 0, injury: false, notes: [] as string[] };
  if (p.window && nowSecond > p.window.expiresAt) { p.window = null; p.contact = false; }
  if (p.stone.state === 'FALLING' && p.stone.fallingUntil !== null && nowSecond >= p.stone.fallingUntil) {
    p.stone.state = 'LANDED'; p.stone.fallingUntil = null; p.stone.version++; p.window = null;
    if (p.position === 3) { result.health = 8; result.injury = true; }
    result.notes.push(p.position === 3 ? '原石实际落地，本人仍在近处，承受8健康损失与轻伤；之后可普通清理。' : '原石实际落在空处，通道暂被堵住；本人和成人已避到安全位置，之后可付费清理同物。');
  }
  return result;
}
