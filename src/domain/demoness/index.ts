import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { DemonessCommand, DemonessMaterialCommand, DemonessPassageCommand, DemonessPlace, DemonessProjection, DemonessSlice, DemonessState } from './types.js';
import { DEMONESS_ORIGINAL_IDS, DEMONESS_RESIDENT_IDS } from './types.js';
import { createDemonessState, startDemoness, validateDemonessCommand, openDemonessOwnedEngine, snapshotDemonessOwnedEngine, advanceDemonessOwnedEngine, blockDemonessOwnedEngine, assertDemonessEndpoint, demonessInsideCase, getDemonessPromotionStabilityPreview, type DemonessOwnedEngine } from './engine.js';
import { demonessBudget, demonessSourceBlock, validateDemonessSource, sameDemoness } from './source.js';
import { DEMONESS_ABILITIES, DEMONESS_PLACES, DEMONESS_STORY, DEMONESS_GOAL, DEMONESS_RISK, DEMONESS_GUIDANCE, DEMONESS_SPIRITUALITY_CAP, DEMONESS_PRICES, DEMONESS_PREPARATION } from './content.js';
import { demonessPassagesComplete } from './passage.js';
import { APOCALYPSE_DEMONESS_INHERITED_ABILITIES, APOCALYPSE_DEMONESS_ABILITIES } from '../apocalypse-demoness/content.js';
export { createDemonessState, createDefaultDemonessState, validateDemonessCommand } from './engine.js';
export { demonessSourceView } from './source.js';
export type { DemonessOwnedEngine } from './engine.js';
export type { DemonessState, DemonessCommand, DemonessProjection } from './types.js';
const clone = <T>(v: T): T => structuredClone(v);
function guidanceBlock(s: DemonessSlice): string | null {
  if (!sameDemoness(s.demoness, createDemonessState())) return '已有本章记录，不能重新开始或补发原物。';
  const reason = demonessSourceBlock(s); if (reason) return reason;
  return s.cash < DEMONESS_GUIDANCE.cash || s.actionsRemaining < DEMONESS_GUIDANCE.actions ? '指导需要1行动与100便士，可先按原生活工作与休养。' : null;
}
function publicReason(reason: string | null): string | null { return reason === null ? null : /[\u3400-\u9fff]/.test(reason) && !/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason) ? reason : '当前原物、所在地或前一步条件尚未满足。'; }
export function validateDemonessState(s: DemonessSlice): boolean {
  try { if (sameDemoness(s.demoness, createDemonessState())) return s.progression.pathwayId !== 'demoness' || s.progression.sequence !== 0; openDemonessOwnedEngine(s); return true; } catch { return false; }
}
export function hasDemonessHistory(s: DemonessSlice): boolean {
  try { return s.demoness.guidanceKnown && s.demoness.source !== null && s.progression.pathwayId === 'demoness' && validateDemonessSource(s, s.demoness.source, 'COLD_REOPEN'); } catch { return false; }
}
export const hasDemonessLock = hasDemonessHistory;
export function openDemonessOwnedHead(s: DemonessSlice): DemonessOwnedEngine { const head = openDemonessOwnedEngine(s); assertDemonessEndpoint(s, snapshotDemonessOwnedEngine(head)); return head; }
export function assertOwnedDemonessCurrent(s: DemonessSlice, head: DemonessOwnedEngine): void { const root = snapshotDemonessOwnedEngine(head); if (!sameDemoness(root, s.demoness)) throw Error('当前会话与实际存档版本不一致。'); assertDemonessEndpoint(s, root); }
export function demonessCommandBlock(s: DemonessSlice, command: DemonessCommand): string | null {
  if (!validateDemonessCommand(command)) return '这项行动的内容无效。'; if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return publicReason(guidanceBlock(s));
  try { return publicReason(blockDemonessOwnedEngine(openDemonessOwnedHead(s), command, s.revision + 1)); } catch { return '当前记录未通过核验，不能继续行动。'; }
}
export function ownedDemonessCommandBlock(s: DemonessSlice, command: DemonessCommand, head: DemonessOwnedEngine): string | null {
  try { if (!validateDemonessCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE') return '当前不能执行这项行动。'; assertOwnedDemonessCurrent(s, head); return publicReason(blockDemonessOwnedEngine(head, command, s.revision + 1)); } catch { return '当前记录未通过核验，不能继续行动。'; }
}
function publish(s: DemonessSlice, command: DemonessCommand, root: DemonessState, ctx: SeerContext): void {
  const b = root.frame!.budget; s.demoness = clone(root); s.week = b.week; s.date = clone(b.date); s.actionsRemaining = b.actions;
  s.cash = b.cash; s.health = b.health; s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status; s.injuries = clone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting; s.progression.mastery = { ...b.mastery }; s.character.coreStats = { ...b.coreStats };
  s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources]; s.random = { ...root.frame!.random }; Object.assign(s, clone(root.frame!.finance));
  const event = command.type === 'LEARN_GUIDANCE' ? null : root.journal.at(-1)!; s.lastCheck = event?.checks.length ? clone(event.checks.at(-1)!.check) : null;
  if (!event) ctx.note('旧石拱通道与魔女指导', '实付100便士与1行动，核对本人完整末日魔女履历和三份原特性。本人仍在原展廊出口，两位新成人在旧石拱通道外等待；旧人旧物、当前性别与实际资源未被改变。');
  else { for (const receipt of event.financeReceipts) ctx.note(receipt.title, receipt.text); ctx.note(b.sequence === 0 ? '魔女当前行动' : '旧石拱通道当前行动', event.notes.join('')); }
}
export function applyDemonessCommand(s: DemonessSlice, command: DemonessCommand, ctx: SeerContext): void {
  if (!validateDemonessCommand(command) || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  let root: DemonessState;
  if (command.type === 'LEARN_GUIDANCE') { const reason = guidanceBlock(s); if (reason) throw Error(reason); root = startDemoness(s); }
  else root = snapshotDemonessOwnedEngine(advanceDemonessOwnedEngine(openDemonessOwnedHead(s), command, s.revision + 1));
  publish(s, command, root, ctx);
}
export function applyOwnedDemonessCommand(s: DemonessSlice, command: DemonessCommand, ctx: SeerContext, head: DemonessOwnedEngine): DemonessOwnedEngine {
  assertOwnedDemonessCurrent(s, head); if (!validateDemonessCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  const next = advanceDemonessOwnedEngine(head, command, s.revision + 1); publish(s, command, snapshotDemonessOwnedEngine(next), ctx); return next;
}
export function projectDemoness(s: DemonessSlice): DemonessProjection { return projection(s, sameDemoness(s.demoness, createDemonessState()) ? null : openDemonessOwnedHead(s)); }
export function projectOwnedDemoness(s: DemonessSlice, head: DemonessOwnedEngine): DemonessProjection { assertOwnedDemonessCurrent(s, head); return projection(s, head); }

/** A recommendation chooses only a real enabled command; it never supplies a result. */
function desiredCommand(root: DemonessState): DemonessCommand | null {
  const f = root.frame!, b = f.budget, p = root.passage!, m = root.materials!;
  const passage = (command: DemonessPassageCommand): DemonessCommand => ({ type: 'PASSAGE', command });
  const material = (command: DemonessMaterialCommand): DemonessCommand => ({ type: 'MATERIAL', command });
  const at = (to: DemonessPlace, c: DemonessCommand): DemonessCommand => f.location === to ? c : { type: 'TRAVEL', to };
  // Reserve the real next work before paying for attendance or a short-lived
  // permission. These recommendations never supply AP, cash or check results.
  const reserve = (actions: number, cash: number, seconds = 0): DemonessCommand | null => {
    if (b.actions >= actions && b.cash >= cash && f.nowSecond + seconds < f.weekAnchor + 604800) return null;
    if (b.cash < cash && f.finance.wagePaidWeek !== b.week && b.actions > 0) return { type: 'WORK' };
    return { type: 'NEXT_WEEK' };
  };
  if (b.status !== 'ACTIVE' || p.phase === 'CLOSED') return null;
  const ready = m.compounds.find(c => c.status === 'PREPARED' && getDemonessPromotionStabilityPreview(root, c.id).prepared);
  if (ready) return { type: 'CONSUME', compoundId: ready.id, confirmed: true };
  if (!demonessInsideCase(root)) {
    const unsealed = m.compounds.find(c => c.status === 'FAILED_EXPOSED'); if (unsealed) return at(unsealed.location, material({ type: 'SEAL_REMAINS', compoundId: unsealed.id }));
    if (b.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null)) return { type: 'CLINIC' };
    if (b.health < 80 || b.mind < 78 || b.spirituality < 42 || b.injuries.length || b.pollution > 20) return { type: 'REST' };
  }
  if (!demonessPassagesComplete(p) || b.sequence === 0) {
    if (f.location !== 'DM221-ARCH') return { type: 'TRAVEL', to: 'DM221-ARCH' };
    if (!p.surveyEventId) return passage({ type: 'SURVEY' });
    if (!p.sidePathEventId) return passage({ type: p.playerEnergy >= 24 ? 'WALK_SIDE_PATH' : 'REST_OUTSIDE' });
    if (b.sequence === 0 && p.phase === 'PREPARED') return passage({ type: 'START_RETURN' });
    const returning = p.phase === 'RETURN';
    const complete = (r: typeof p.residents[number]) => returning ? !!r.returnPassage?.exit : !!r.passage?.exit;
    for (const r of p.residents) if (r.position === 6) return passage({ type: 'EXIT_RESIDENT', residentId: r.id });
    if (p.residents.every(complete)) return p.position === -2 ? passage({ type: returning ? 'REPORT_RETURN' : 'REPORT_PASSAGE' }) : passage({ type: 'WALK', to: -2 });
    if (p.position === -2 && p.residents.every(r => r.position === -2) && (p.playerEnergy < 45 || p.residents.some(r => r.energy < 24))) return passage({ type: 'REST_OUTSIDE' });
    if (demonessInsideCase(root) && (p.playerEnergy < 7 || p.residents.some(r => r.consent !== 'GRANTED' || r.consentWeek !== b.week))) return passage({ type: 'PAUSE_SHIFT' });
    if (!returning) for (const segment of ['A', 'B'] as const) if (!p.supports.some(s => s.segment === segment)) return p.position === -2 ? passage({ type: 'BUY_SUPPORT', segment }) : passage({ type: 'WALK', to: -2 });
    if (returning && !p.returnKit) return passage({ type: 'BUY_RETURN_KIT' });
    if (!demonessInsideCase(root)) {
      const unfinished = p.residents.filter(r => !complete(r));
      const fittingActions = returning ? Number(p.stone.state === 'LANDED') + Number(!p.returnKit!.fittedEventId)
        + Number(p.stone.state === 'LOOSE' && p.petrificationAttempts === 0)
        + Number(!p.returnKit!.fittedEventId && p.reshapingAttempts === 0)
        : p.supports.filter(s => !s.fittedEventId).length;
      const cleanupCash = returning && ['LOOSE', 'LANDED'].includes(p.stone.state) ? 20 : 0;
      const recovery = reserve(Math.min(fittingActions, f.finance.weeklyBudget),
        unfinished.length * DEMONESS_PRICES.residentService + cleanupCash, 3600);
      if (recovery) return recovery;
    }
    for (const r of p.residents) if (r.consent !== 'GRANTED' || r.consentWeek !== b.week) return passage({ type: 'ASK_RESIDENT', residentId: r.id });
    if (returning) {
      for (const r of p.residents) if (!complete(r) && r.position === -2) return passage({ type: 'ARRIVE_RESIDENT', residentId: r.id });
      if (p.stone.state === 'LANDED') return p.position === 0 ? passage({ type: 'CLEAR_FALLEN_STONE' }) : passage({ type: 'WALK', to: 0 });
      if (p.position !== 3) return passage({ type: 'WALK', to: 3 });
      if (p.stone.state === 'LOOSE') return passage({ type: 'OBSERVE_STONE' });
      if (p.stone.state === 'FALLING') {
        if (p.window?.kind === 'PETRIFICATION' && f.nowSecond + 2 <= p.window.expiresAt) return passage({ type: 'CATCH_STONE' });
        return p.petrificationAttempts < 2 && b.actions > Number(!p.returnKit!.fittedEventId) + Number(!p.returnKit!.fittedEventId && p.reshapingAttempts === 0) && b.spirituality >= 12 && b.mind > 5 ? passage({ type: 'PETRIFY_STONE' }) : passage({ type: 'CATCH_STONE' });
      }
      if (!p.returnKit!.fittedEventId) {
        if (p.window?.kind === 'RESHAPING' && f.nowSecond + 8 <= p.window.expiresAt) return passage({ type: 'FIT_WEDGE' });
        if (p.reshapingAttempts < 2 && b.actions > 1 && b.spirituality >= 14 && b.mind > 6) return passage({ type: p.contact ? 'RESHAPE_STRUT' : 'TOUCH_STRUT' });
        return passage({ type: 'ORDINARY_SHORE' });
      }
      const r = p.residents.find(r => r.position === 0 && !complete(r)); return r ? passage({ type: 'CROSS_RETURN', residentId: r.id }) : passage({ type: 'PAUSE_SHIFT' });
    }
    for (const segment of ['A', 'B'] as const) if (!p.supports.find(s => s.segment === segment)!.fittedEventId) {
      if (!p.residents.some(r => r.position !== -2)) return passage({ type: 'ARRIVE_RESIDENT', residentId: p.residents.find(r => !complete(r))!.id });
      return p.position === 0 ? passage({ type: 'FIT_SUPPORT', segment }) : passage({ type: 'WALK', to: 0 });
    }
    const resident = p.residents.find(r => !complete(r))!;
    if (resident.position === -2) return passage({ type: 'ARRIVE_RESIDENT', residentId: resident.id });
    const segment = resident.passage?.a ? 'B' : 'A', position = segment === 'A' ? 0 : 3;
    return p.position === position ? passage({ type: 'CROSS', residentId: resident.id, segment }) : passage({ type: 'WALK', to: position });
  }
  const failed = m.compounds.find(c => c.status === 'FAILED_SEALED');
  if (failed) return b.week > failed.sealedWeek! ? at(failed.location, material({ type: 'RECOVER_REMAINS', compoundId: failed.id })) : { type: 'NEXT_WEEK' };
  const item = m.characteristics.find(x => x.holder !== 'EMBODIED' && (x.holder !== 'PLAYER' || !x.acquiredEventId) && x.holder !== 'COMPOUND');
  if (item) {
    let command: DemonessMaterialCommand;
    if (item.holder === 'SUPPLIER') command = { type: item.labourSteps < 5 ? 'LABOUR' : 'ACQUIRE_CHARACTERISTIC', originalId: item.originalId };
    else if (item.holder === 'PLAYER') command = { type: 'ACQUIRE_CHARACTERISTIC', originalId: item.originalId };
    else if (item.holder === 'SEALED_ORIGINAL' && b.week <= item.sealedWeek!) return { type: 'NEXT_WEEK' };
    else command = { type: item.permissionWeek !== b.week ? 'ASK_RECOVERY_PERMISSION' : item.holder === 'FAILED_REMNANT' ? 'INVESTIGATE_REMAINS' : item.holder === 'LOCATED' ? 'SEAL_ORIGINAL' : 'ACQUIRE_CHARACTERISTIC', originalId: item.originalId };
    return at(item.location!, material(command));
  }
  if (m.uniqueness.holder === 'CUSTODIAN') {
    if (f.location !== 'DM221-VAULT') return { type: 'TRAVEL', to: 'DM221-VAULT' };
    const verified = m.uniqueness.verifiedWeek === b.week, actions = verified ? 1 : 2;
    if (f.finance.weeklyBudget < actions) return null;
    const recovery = reserve(actions, DEMONESS_PRICES.uniquenessHandover + (verified ? 0 : DEMONESS_PRICES.uniquenessVerification), actions * 1800);
    return recovery ?? material({ type: verified ? 'ACQUIRE_UNIQUENESS' : 'VERIFY_CUSTODY' });
  }
  const compound = m.compounds.find(c => c.status === 'PREPARED');
  if (compound) {
    if (b.week - root.source!.actualS1PromotionWeek < 12) return { type: 'NEXT_WEEK' };
    if (f.location !== 'DM221-WORKSHOP') return { type: 'TRAVEL', to: 'DM221-WORKSHOP' };
    const preview = getDemonessPromotionStabilityPreview(root, compound.id);
    if (!preview.prepared) {
      if (f.finance.weeklyBudget < 2) return null;
      const recovery = reserve(2, DEMONESS_PREPARATION.cash, DEMONESS_PREPARATION.seconds + 3600);
      if (recovery) return recovery;
    }
    return preview.prepared ? { type: 'CONSUME', compoundId: compound.id, confirmed: true } : { type: 'STABILIZE_PROMOTION', compoundId: compound.id };
  }
  if (m.carriers.some(x => x.status === 'PLAYER')) return at('DM221-WORKSHOP', material({ type: 'COMPOSE' }));
  return m.carriers.some(x => x.status === 'SUPPLIER') ? at('DM221-SUPPLIER', material({ type: 'BUY_CARRIER' })) : null;
}
function projection(s: DemonessSlice, head: DemonessOwnedEngine | null): DemonessProjection {
  const root = head ? snapshotDemonessOwnedEngine(head) : s.demoness, f = root.frame, b = f?.budget ?? demonessBudget(s), promoted = s.progression.pathwayId === 'demoness' && b.sequence === 0 && root.promotionWeek !== null;
  const definitions = s.progression.pathwayId === 'demoness' ? [...APOCALYPSE_DEMONESS_INHERITED_ABILITIES, ...APOCALYPSE_DEMONESS_ABILITIES, ...(promoted ? DEMONESS_ABILITIES : [])] : [];
  const result: DemonessProjection = { title: '序列0 魔女', available: root.guidanceKnown || demonessSourceBlock(s) === null, guidanceKnown: root.guidanceKnown, promoted,
    story: DEMONESS_STORY, nextStep: DEMONESS_GOAL, risk: DEMONESS_RISK, insideCase: demonessInsideCase(root),
    resources: { health: b.health, maxHealth: 100, mind: b.mind, maxMind: 100, spirituality: b.spirituality, maxSpirituality: promoted ? DEMONESS_SPIRITUALITY_CAP : 120, cash: `${b.cash}便士`, actionsRemaining: b.actions, weeklyBudget: f?.finance.weeklyBudget ?? s.weeklyBudget },
    abilities: definitions.filter(a => Object.hasOwn(b.mastery, a.id)).map(a => ({ id: a.id, label: a.label, description: a.description, mastery: b.mastery[a.id] ?? 0 })),
    injuries: b.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })), injuryRisk: b.injuryRisk, sections: [], actions: [] };
  const add = (command: DemonessCommand, label: string, cost: string) => { const reason = publicReason(head ? blockDemonessOwnedEngine(head, command, s.revision + 1) : demonessCommandBlock(s, command)); result.actions.push({ id: `demoness:${result.actions.length}:${command.type}`, label, cost, command: clone(command), enabled: reason === null, reason }); };
  if (!root.guidanceKnown) { add({ type: 'LEARN_GUIDANCE' }, '听取旧石拱通道与三份原特性指导', '1行动、100便士'); result.actions[0]!.preferredAction = true; return result; }
  const p = root.passage!, m = root.materials!, source = root.source!;
  result.sections.push({ id: 'clock', title: '实际日期与所在地', lines: [`${DEMONESS_PLACES.find(x => x.id === f!.location)!.title}，第${b.week}周，${b.date.year}年${b.date.month}月${b.date.day}日。`, `距实际成为末日魔女${b.week - source.actualS1PromotionWeek}周；满十二个实际周才能服药。距下一周界${Math.ceil((f!.weekAnchor + 604800 - f!.nowSecond) / 3600)}小时，生活费与旧债照常结算。`] });
  const old = source.originals.inheritedAtGuidance.site, live = source.originals.liveSite;
  result.sections.push({ id: 'originals', title: '原人物与原物承接', lines: [
    `原末日指导承接灾难魔女实战后的现场：本人${old.playerLocation === 'OUTSIDE' ? '在室外' : '保留原位置'}、精力${old.playerEnergy}、步行${old.playerTravelMetres}米、现场时钟${old.clockSeconds}秒。`,
    `其后真正完成末日魔女生活与离场；接入本章时本人精力${live.playerEnergy}。维瑞娜精力${live.vera!.energy}，马库斯精力${live.marcus!.energy}，均保留实际身体、位置与各自许可。`,
    `原镜仍各有原主人；原负载剩${old.load.remainingLoads}次，旧残留保持实际耗用；三片旧护片剩余${old.plates.map(x => x.charges).join('、')}次。原姓名、当前性别、年龄、旧掌握及旧死伤不会因晋升重置。`,
  ] });
  const locationName = (pos: number) => pos === -2 ? '室外' : pos === 0 ? '入口' : pos === 3 ? '中段三米处' : '远端六米处';
  result.sections.push({ id: 'passage', title: '同一旧石拱通道', lines: [
    `本人在${locationName(p.position)}，精力${p.playerEnergy}，本章现场实际步行${p.playerWalkedMetres}米。普通十二米侧路${p.sidePathEventId ? '已亲自走查' : '尚未亲自走查'}。`,
    ...p.residents.map(r => `${r.name}，${r.age}岁，在${locationName(r.position)}，健康${r.health}、精力${r.energy}、已步行${r.walkedMetres}米；${r.consent === 'GRANTED' && r.consentWeek === b.week ? '本周当前同意' : r.consent === 'WITHDRAWN' ? '已经撤回许可' : '须重新询问'}，本章已付服务${r.services.length * 20}便士。`),
    ...(['A', 'B'] as const).map(segment => { const support = p.supports.find(x => x.segment === segment); return `${segment === 'A' ? '前' : '后'}三米支撑：${!support ? '尚未购买' : support.fittedEventId ? `已安装，剩${support.passagesRemaining}次承载` : '实购原件尚未安装'}。`; }),
    p.passageReportEventId ? '两位成人均已完成前后两段、亲自安全退出并核对结果。' : '只有每位成人亲自走过两段并真正退出，才算完成实际通行；停手或绕侧路离开不会冒充通行。',
  ] });
  const holderText: Record<string, string> = { SUPPLIER: '原供应方', PLAYER: '本人实际持有', FAILED_REMNANT: '原失败残余尚未查见', LOCATED: '原地查见', SEALED_ORIGINAL: '原地封存待回收', EMBODIED: '本人原身体内', COMPOUND: '同一成药内', EXPOSED: '实际失败地点', SEALED: '失败原处封存', FUSED: '本人已经融合', CUSTODIAN: '伊妮德封存保管' };
  result.sections.push({ id: 'materials', title: '三份原特性与同一唯一性', lines: [
    ...m.characteristics.map((x, i) => `原第${i + 1}份末日特性：${holderText[x.holder]}；真实原瓶交接劳动${x.labourSteps}/5${x.acquiredEventId ? '，本次实际交接完成' : ''}。`),
    `同一唯一性：${holderText[m.uniqueness.holder]}。有限普通载体：未购${m.carriers.filter(x => x.status === 'SUPPLIER').length}，持有${m.carriers.filter(x => x.status === 'PLAYER').length}，已耗${m.carriers.filter(x => x.status === 'SPENT').length}。`,
    m.uniqueness.verifiedEventId ? '原档案：前任1352年3月24日死亡退出，3月25日原唯一性与三份末日特性分别封存交接，早于原供货指导；伊妮德只保管唯一性。' : '须亲自核对前任退出、原物析出与当前封存交接；未核验的传言不能代替原件。',
    '原供应份6600便士，完成同份五项有限劳动后实付1100；已失败原份须120便士查验、原地封存隔周后30便士回收。成药失败后封存免费、隔周回收60便士，原载体不返还。',
  ] });
  const compound = m.compounds.find(x => x.status === 'PREPARED'), preview = compound ? getDemonessPromotionStabilityPreview(root, compound.id) : null;
  result.sections.push({ id: 'promotion', title: '同瓶准备、实际概率与后果', lines: [
    preview ? `当前同一成药的实际成功率${preview.chance}%；充分准备后的实际成功率${preview.preparedChance}%。${preview.prepared ? '本瓶准备当前有效。' : '本瓶尚无有效稳定准备。'}` : '须先实际取得体内原份、另外两份原特性与唯一性，使用一件实购载体完成有价调配。',
    '可选稳定准备：1行动、150便士、12灵性和8精神，一小时；绑定本人、同瓶与本处，七天内有效，离室或服药失效。实际意志改变时概率随之变化。',
    '独立服药：1行动、30灵性；成功再扣12精神，四属性各加1，新技巧从零开始、灵性上限150且当前值不补满。',
    '失败：45健康、40精神、35污染及真实重伤；严重失败：110健康、100精神、70污染，可以死亡。活人可原地封存同物、隔周付费回收；死亡封存周目。',
    '没有额外性别变化、旧伤清零、任何人的复活或新增原特性。所有同意、实际通行、费用和损伤均保留。',
  ] });
  if (promoted) result.sections.push({ id: 'return', title: '有限落石与原撑返程', lines: [
    `同一两公斤碎块：${({ LOOSE: '仍松动', FALLING: '正在缓慢剥落', CAUGHT: '已经实际接住', LANDED: '已落地待清理', CLEARED: '已普通清走' })[p.stone.state]}，实际阻力${p.stone.resistance}。同一原撑承载${p.strut.integrity}，整形阻力${p.strut.resistance}，旧裂痕保留。`,
    p.returnKit ? `有价承接盘剩${p.returnKit.catcherUses}次，木楔剩${p.returnKit.wedgeUses}次；${p.returnKit.fittedEventId ? '原木楔已经装入' : '原木楔尚未装入'}。` : '另购50便士的普通承接盘与木楔；原两件支撑不会补回次数。',
    p.window ? `当前有限施术窗口还剩${Math.max(0, p.window.expiresAt - f!.nowSecond)}秒，移位、目标变化、撤回、松手或到期都会中断。` : '当前没有可用施术窗口。',
    '石化只作用于眼前原碎块，仍须实际接住；原撑整形须持续触碰并实际装楔、真实承载。普通接住、退开后付费清理、普通木楔加撑和随时步行退出始终按实际条件可用。',
    p.returnReportEventId ? '两位成人已各自实际通过并走出，本人也已实际退出，结果已报告。' : '两位成人须重新取得本周许可、另付本次服务，并各自步行到场、走过和退出。',
  ] });
  for (const [type, label, cost] of [ ['WORK', '按原职业工作', '1行动、八小时，领取一次本周原工资'], ['REST', '按当前生活档休养', '1行动、八小时'], ['CLINIC', '普通诊治重伤', '1行动、60便士'], ['NEXT_WEEK', '走到下一实际周界', '生活费与旧债照常结算'], ['RETURN_ON_FOOT', '沿普通道路回街区接待处', '两小时，无行动和现款要求'] ] as const) add({ type }, label, cost);
  for (const place of DEMONESS_PLACES) add({ type: 'TRAVEL', to: place.id }, `步行到${place.title}`, '1行动、半小时');
  const addPassage = (command: DemonessPassageCommand, label: string, cost: string) => add({ type: 'PASSAGE', command }, label, cost);
  for (const [type, label, cost] of [ ['SURVEY', '调查同一原撑与落石', '1行动、十分钟'], ['WALK_SIDE_PATH', '亲自往返普通侧路', '24米、24精力'], ['REST_OUTSIDE', '在室外实际歇息', '一小时，本人20精力、成人各10精力'], ['END_CONTACT', '松手并停止当前施术', '一秒，旧费用不退'], ['PAUSE_SHIFT', '停工并逐人走普通侧路退出', '实际步行，无行动或现款要求'], ['REPORT_PASSAGE', '核对两位成人真实通行结果', '一分钟'], ['START_RETURN', '晋升后回看同一旧通道', '一秒，原物不重置'], ['BUY_RETURN_KIT', '实购有限承接盘与木楔', '1行动、50便士'], ['OBSERVE_STONE', '看清原处剥落的两公斤碎块', '一秒，随后须处理或退开'], ['PETRIFY_STONE', '有限石化眼前原碎块', '1行动、12灵性、5精神、3精力'], ['CATCH_STONE', '用原承接盘实际接住落石', '4精力；普通损8健康，石化成功后损3健康，均有轻伤'], ['CLEAR_FALLEN_STONE', '普通清走已落地的原石', '1行动、20便士、4精力'], ['TOUCH_STRUT', '近处持续触碰同一原撑', '一秒'], ['RESHAPE_STRUT', '局部整形同一原撑', '1行动、14灵性、6精神、6精力'], ['FIT_WEDGE', '保持接触并实际装入原木楔', '4精力、8秒，须有效窗口'], ['ORDINARY_SHORE', '用原木楔普通加撑', '1行动、6精力、30秒'], ['REPORT_RETURN', '核对原撑承载与逐人退出', '一分钟'] ] as const) addPassage({ type }, label, cost);
  for (const to of [-2, 0, 3] as const) addPassage({ type: 'WALK', to }, to === -2 ? '本人沿普通道路退出' : `本人步行到${locationName(to)}`, '实际距离与精力；退出不要求行动或现款');
  for (const segment of ['A', 'B'] as const) { addPassage({ type: 'BUY_SUPPORT', segment }, `实购${segment === 'A' ? '前' : '后'}段支撑`, '1行动、30便士，限一件'); addPassage({ type: 'FIT_SUPPORT', segment }, `实际安装${segment === 'A' ? '前' : '后'}段支撑`, '1行动、4精力、一分钟'); }
  for (const residentId of DEMONESS_RESIDENT_IDS) {
    const name = p.residents.find(r => r.id === residentId)!.name;
    addPassage({ type: 'ASK_RESIDENT', residentId }, `当面询问${name}当前许可`, '三十秒，旧许可不沿用');
    addPassage({ type: 'WITHDRAW_RESIDENT', residentId }, `记录${name}撤回许可`, '立即停止持续作用，费用不退');
    addPassage({ type: 'ARRIVE_RESIDENT', residentId }, `付本次服务费并让${name}实际到场`, '20便士，亲自沿普通道路步行');
    for (const segment of ['A', 'B'] as const) addPassage({ type: 'CROSS', residentId, segment }, `${name}实际走过${segment === 'A' ? '前' : '后'}三米`, '本人近处监督，消耗一次该段承载');
    addPassage({ type: 'CROSS_RETURN', residentId }, `${name}实际走过装楔后的六米`, '当前许可、原木楔与实际步行');
    addPassage({ type: 'EXIT_RESIDENT', residentId }, `${name}亲自走普通侧路退出`, '实际步行，无行动或现款要求');
  }
  for (const originalId of DEMONESS_ORIGINAL_IDS) for (const [type, label, cost] of [ ['LABOUR', '完成这份原物的一项有限交接劳动', '1行动、八小时，最多五项'], ['ASK_RECOVERY_PERMISSION', '询问这份原残余本周查验与交接许可', '原展廊出口当面询问'], ['INVESTIGATE_REMAINS', '查见同一失败原残余', '1行动、120便士'], ['SEAL_ORIGINAL', '原地封存这份原残余', '十分钟，无行动和现款要求'], ['ACQUIRE_CHARACTERISTIC', '实际取得这份原特性', '供应份6600或劳动后1100便士；已持有或回收份30便士；1行动'] ] as const) add({ type: 'MATERIAL', command: { type, originalId } }, `原第${DEMONESS_ORIGINAL_IDS.indexOf(originalId) + 1}份：${label}`, cost);
  for (const [type, label, cost] of [ ['VERIFY_CUSTODY', '核对原唯一性退出与封存链', '1行动、100便士'], ['ACQUIRE_UNIQUENESS', '从保管人实际取得同一唯一性', '1行动、150便士'], ['BUY_CARRIER', '实购下一件有限普通载体', '1行动、50便士，最多三件'], ['COMPOSE', '在封闭调配室完成本次调配', '1行动、40便士与一件实购载体'] ] as const) add({ type: 'MATERIAL', command: { type } }, label, cost);
  for (const c of m.compounds) {
    if (c.status === 'PREPARED') { add({ type: 'STABILIZE_PROMOTION', compoundId: c.id }, '为同一瓶实际准备稳定支持', '1行动、150便士、12灵性、8精神，一小时'); add({ type: 'CONSUME', compoundId: c.id, confirmed: true }, '独立确认饮用同一瓶成药', `1行动、30灵性；当前实际成功率${preview!.chance}%，失败可重伤或死亡`); }
    if (c.status === 'FAILED_EXPOSED') add({ type: 'MATERIAL', command: { type: 'SEAL_REMAINS', compoundId: c.id } }, '原地封存同一成药失败残余', '十分钟，无行动或现款要求');
    if (c.status === 'FAILED_SEALED') add({ type: 'MATERIAL', command: { type: 'RECOVER_REMAINS', compoundId: c.id } }, '隔周付费回收同一成药残余', '1行动、60便士，旧载体不返还');
  }
  const wanted = desiredCommand(root); let preferred = wanted ? result.actions.find(a => a.enabled && sameDemoness(a.command, wanted)) : undefined;
  if (wanted && !preferred) {
    if (demonessInsideCase(root)) preferred = result.actions.find(a => a.enabled && a.command.type === 'PASSAGE' && a.command.command.type === 'PAUSE_SHIFT');
    else preferred = result.actions.find(a => a.enabled && a.command.type === 'WORK') ?? result.actions.find(a => a.enabled && a.command.type === 'NEXT_WEEK');
  }
  if (preferred) { preferred.preferredAction = true; result.nextStep = preferred.label; }
  else if (p.phase === 'CLOSED') result.nextStep = '两位成人已经真实通过并退出，本人已在同一通道外完成报告。';
  else if (!m.carriers.some(c => c.status !== 'SPENT') && !m.compounds.some(c => c.status === 'PREPARED')) result.nextStep = '三件有价载体均已实际耗尽，原残余与伤势仍保留；可以继续普通生活，没有自动补货。';
  return result;
}
