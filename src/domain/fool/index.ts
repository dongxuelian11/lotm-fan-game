import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { FoolCommand, FoolProjection, FoolState } from './types.js';
import { createFoolState, startFool, replayFool, transitionPreparedFool, blockPreparedFool, sameFool, foolFogHost, foolFateAuthority, foolFateContext, openFoolOwnedEngine, snapshotFoolOwnedEngine, advanceFoolOwnedEngine, blockFoolOwnedEngine, projectFoolOwnedFog, projectFoolOwnedFate, type FoolOwnedEngine } from './engine.js';
import { foolBudget, foolSourceBlock, validateFoolSource } from './source.js';
import { FOOL_ABILITIES, FOOL_STORY, FOOL_GOAL, FOOL_RISK, FOOL_FORMULA } from './content.js';
import { validateFoolMaterialCommand, projectFoolMaterials, FOOL_MATERIAL_COSTS, type FoolMaterialItem } from './materials.js';
import { validateFogCommand, fogProjection, fogTravelMetres, FOG_ROUTE } from './fog.js';
import { FOG_STATION_CONTENT, type FogStationId } from './fog-content.js';
import { projectFoolFateHost, type FoolFateHostPublicView } from './fate-host.js';
import { FATE_COMMISSIONS } from './fate-content.js';
import { validateFoolEscapeCommand, projectFoolEscape } from './escape.js';
import { SEER_ABILITIES } from '../seer/content.js';
import { CLOWN_ABILITIES } from '../clown/content.js';
import { MAGICIAN_ABILITIES } from '../magician/content.js';
import { FACELESS_ABILITIES } from '../faceless/content.js';
import { MARIONETTIST_ABILITIES } from '../marionettist/content.js';
import { BIZARRO_SORCERER_ABILITIES } from '../bizarro-sorcerer/content.js';
import { ANCIENT_SCHOLAR_ABILITIES } from '../ancient-scholar/content.js';
import { MIRACLE_WORKER_ABILITIES } from '../miracle-worker/content.js';
import { ATTENDANT_MYSTERIES_ABILITIES } from '../attendant-mysteries/content.js';

export { createFoolState } from './engine.js';
export { foolSourceView } from './source.js';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: object, fields: readonly string[]): boolean => sameFool(Object.keys(value).sort(), [...fields].sort());
const id = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 160;
const whole = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const inherited = [...SEER_ABILITIES, ...CLOWN_ABILITIES, ...MAGICIAN_ABILITIES, ...FACELESS_ABILITIES, ...MARIONETTIST_ABILITIES, ...BIZARRO_SORCERER_ABILITIES, ...ANCIENT_SCHOLAR_ABILITIES, ...MIRACLE_WORKER_ABILITIES, ...ATTENDANT_MYSTERIES_ABILITIES];
type PreparedFool = ReturnType<typeof replayFool>;

/** Public commands contain intent only. Actor/world facts, generated IDs, checks
 * and receipts can never be supplied through this entry point. */
export function validateFoolCommand(value: unknown): value is FoolCommand {
  if (!record(value) || typeof value.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'RECEPTION_WORK', 'RECEPTION_REST', 'RECEPTION_NEXT_WEEK', 'ENTER_FATE', 'LEAVE_FATE', 'START_ESCAPE'].includes(value.type)) return keys(value, ['type']);
  if (value.type === 'CONSUME') return keys(value, ['type', 'compoundId', 'confirmed']) && id(value.compoundId) && value.confirmed === true;
  if (!keys(value, ['type', 'command']) || !record(value.command)) return false;
  const c = value.command;
  if (value.type === 'MATERIAL') {
    if ('proofId' in c) return false;
    return validateFoolMaterialCommand({ ...c, proofId: 'public-intent-validation' });
  }
  if (value.type === 'FOG') return !['SYNC_HOST', 'ADVANCE_FOR_CONSUMPTION', 'APPLY_EVENT'].includes(String(c.type)) && validateFogCommand(c);
  if (value.type === 'ESCAPE') return validateFoolEscapeCommand(c);
  if (value.type !== 'FATE') return false;
  if (c.type === 'BUY_KIT') return keys(c, ['type', 'itemId']) && id(c.itemId);
  if (c.type === 'INVESTIGATE_RECOVERY' || c.type === 'VERIFY_RECOVERY') return keys(c, ['type', 'commissionId']) && FATE_COMMISSIONS.some(x => x.id === c.commissionId);
  if (c.type !== 'CASE' || !keys(c, ['type', 'action']) || !record(c.action)) return false;
  const a = c.action;
  if (['GRAFT', 'ARRIVE_AND_VERIFY', 'WITHDRAW', 'RETURN_TO_BERTH', 'ANCHOR'].includes(String(a.type))) return keys(a, ['type']);
  if (a.type === 'INSPECT_CONSTRAINT') return keys(a, ['type', 'branch', 'kitId']) && ['SHIELD_MAIN', 'SIDE_CHANNEL', 'HOLD_OR_MOVE'].includes(String(a.branch)) && id(a.kitId);
  if (a.type === 'PREPARE_ENDPOINTS') return keys(a, ['type', 'kitId']) && id(a.kitId);
  if (a.type === 'TRANSIT') return keys(a, ['type', 'route']) && (a.route === 'MAIN' || a.route === 'SIDE');
  if (a.type === 'RESCUE') return keys(a, ['type', 'crewId']) && id(a.crewId);
  return a.type === 'WAIT' && keys(a, ['type', 'seconds']) && whole(a.seconds, 1, 3600);
}

function prepare(s: SliceState): PreparedFool {
  const prepared = replayFool(s, s.fool);
  assertCurrentFool(s, prepared.root); return prepared;
}
function assertCurrentFool(s: SliceState, root: FoolState): void {
  const source = root.source!, frame = root.frame!;
  if (s.progression.pathwayId !== 'diviner' || !sameFool(foolBudget(s), frame.budget) || !sameFool(s.random, frame.random)) throw Error('当前身体、资源或原动作记录不一致。');
  if (s.revision !== source.revision + 1 + root.journal.length || root.journal.some((event, index) => event.revision !== source.revision + 2 + index)) throw Error('当前动作次序不一致。');
  const { coreStats: _currentStats, ...currentIdentity } = s.character;
  const { coreStats: _sourceStats, ...sourceIdentity } = source.character;
  if (!sameFool(currentIdentity, sourceIdentity) || Object.entries(source.finance).some(([key, value]) => !sameFool(s[key as keyof SliceState], value))) throw Error('原身份或旧生活账本被改写。');
  if (s.combat !== null || s.activeEvent !== null || s.eventQueue.length !== 0 || s.pulse !== 'NONE') throw Error('本章不能同时开启旧现场。');
  if (frame.budget.sequence === 0 && root.promotionWeek === null || frame.budget.sequence === 1 && root.promotionWeek !== null) throw Error('当前晋升与实际服药记录不一致。');
}
export function validateFoolState(s: SliceState): boolean {
  try {
    if (sameFool(s.fool, createFoolState())) return s.progression.sequence !== 0 || s.progression.pathwayId === 'hunter' || s.progression.pathwayId === 'audience' || s.progression.pathwayId === 'paragon' || s.progression.pathwayId === 'moon' || s.progression.pathwayId === 'darkness' || s.progression.pathwayId === 'white-tower';
    prepare(s); return true;
  } catch { return false; }
}
export function hasFoolHistory(s: SliceState): boolean {
  try { return s.fool.guidanceKnown && s.fool.source !== null && s.progression.pathwayId === 'diviner' && validateFoolSource(s, s.fool.source); }
  catch { return false; }
}
export function hasFoolLock(s: SliceState): boolean { return hasFoolHistory(s); }
function publicReason(reason: string | null): string | null {
  if (reason === null) return null;
  if (/[\u3400-\u9fff]/.test(reason) && !/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)) return reason;
  if (/RESOURCE|INSUFFICIENT|Not enough original|budget/i.test(reason)) return '实际行动、费用或身心状态不足；可先回接待处筹备。';
  if (/LATER_WEEK|same week|later week|reroll/i.test(reason)) return '需要经过真实一周才能继续；旧支出和结果保留。';
  if (/LOCATION|LAST_SITE|at the actual|actual original station|real place|real body/i.test(reason)) return '须先沿普通路线到达原物所在地点。';
  return '当前条件尚未齐备，请先核对原物、所在位置和前一步准备。';
}
function guidanceBlock(s: SliceState): string | null {
  if (!sameFool(s.fool, createFoolState())) return '已有本章记录，不能重新开始或补发原物。';
  const reason = foolSourceBlock(s); if (reason) return reason;
  try { startFool(s); return null; } catch (error) { return publicReason(error instanceof Error ? error.message : 'INVALID_SOURCE'); }
}
export function foolCommandBlock(s: SliceState, command: FoolCommand): string | null {
  if (!validateFoolCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return guidanceBlock(s);
  try { return publicReason(blockPreparedFool(prepare(s), command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
/** The kernel owns one deterministic stream. Publishing its actual frame never
 * redraws through ctx, replenishes resources, or touches old revival records. */
export function applyFoolCommand(s: SliceState, command: FoolCommand, ctx: SeerContext): void {
  if (!validateFoolCommand(command) || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  let next: FoolState;
  if (command.type === 'LEARN_GUIDANCE') {
    const reason = guidanceBlock(s); if (reason) throw Error(reason); next = startFool(s);
  } else {
    next = transitionPreparedFool(prepare(s), command, s.revision + 1);
  }
  publishFoolState(s, command, next, ctx);
}
function publishFoolState(s: SliceState, command: FoolCommand, next: FoolState, ctx: SeerContext): void {
  const before = foolBudget(s), b = next.frame!.budget;
  s.fool = next;
  s.week = b.week; s.date = structuredClone(b.date); s.actionsRemaining = b.actions; s.cash = b.cash;
  s.health = b.health; s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status;
  s.injuries = structuredClone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting; s.progression.mastery = { ...b.mastery };
  s.character.coreStats = { ...b.coreStats }; s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources];
  s.random = { ...next.frame!.random };
  const checks = command.type === 'LEARN_GUIDANCE' ? [] : next.journal.at(-1)!.randomReceipts.filter(r => r.kind === 'CHECK');
  s.lastCheck = checks.length ? structuredClone(checks.at(-1)!.check) : null;
  if (command.type === 'LEARN_GUIDANCE') ctx.note('愚者晋升筹备', '已核对原来的三份特性、独立封存的唯一性和本人的实际经历。现有伤势、资源、掌握与复起次数全部保留。');
  else ctx.note(b.sequence === 0 ? '当前行动已结算' : '成神筹备已结算', `健康${before.health}→${b.health}，精神${before.mind}→${b.mind}，灵性${before.spirituality}→${b.spirituality}，现款${before.cash}→${b.cash}便士，本周行动${before.actions}→${b.actions}。${b.status === 'DEAD' ? '死亡已经成立。' : ''}`);
}

/** A genuine opaque engine is necessary for these owned-state operations.
 * Raw snapshot APIs above always reconstruct independently. */
export function openFoolOwnedHead(s: SliceState): FoolOwnedEngine {
  const head = openFoolOwnedEngine(s); assertCurrentFool(s, snapshotFoolOwnedEngine(head)); return head;
}
function assertOwnedFoolHead(s: SliceState, head: FoolOwnedEngine): void {
  const root = snapshotFoolOwnedEngine(head);
  if (!sameFool(root, s.fool)) throw Error('当前会话与实际存档版本不一致。');
  assertCurrentFool(s, root);
}
export function assertOwnedFoolCurrent(s: SliceState, head: FoolOwnedEngine): void { assertOwnedFoolHead(s, head); }
export function applyOwnedFoolCommand(s: SliceState, command: FoolCommand, ctx: SeerContext, head: FoolOwnedEngine): FoolOwnedEngine {
  assertOwnedFoolHead(s, head);
  if (!validateFoolCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  const next = advanceFoolOwnedEngine(head, structuredClone(command), s.revision + 1);
  publishFoolState(s, command, snapshotFoolOwnedEngine(next), ctx);
  return next;
}
export function ownedFoolCommandBlock(s: SliceState, command: FoolCommand, head: FoolOwnedEngine): string | null {
  if (!validateFoolCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return '已有本章记录，不能重新开始或补发原物。';
  try { assertOwnedFoolHead(s, head); return publicReason(blockFoolOwnedEngine(head, command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
export function projectOwnedFool(s: SliceState, head: FoolOwnedEngine): FoolProjection {
  assertOwnedFoolHead(s, head); return structuredClone(projectFoolInternal(s, head));
}

const stationName = (id: string) => FOG_STATION_CONTENT.find(x => x.id === id)?.title ?? (id === 'base' ? '接待处' : id === 'new-alder-clearing' ? '新白榆镇' : '原地点');
const fatePlace = (place: string): string => ({ BERTH: '泊位', MAIN_CHANNEL: '主航道', SIDE_CHANNEL: '侧航道', GATE: '闸口', WELL: '空井', REFUGE: '避难点', DOCK: '码头', BOAT_DECK: '甲板', RIGGING: '索具处' } as Record<string, string>)[place] ?? '现场';
const escapePlace = (place: string): string => ({ DOOR: '原门', CORRIDOR: '通廊', EXIT: '出口' } as Record<string, string>)[place] ?? '现场';
const materialCost = (type: keyof typeof FOOL_MATERIAL_COSTS): string => { const c = FOOL_MATERIAL_COSTS[type]; return `${c.actions}行动，${c.cash}便士${c.spirituality ? `，${c.spirituality}灵性` : ''}；60秒`; };
function materialNext(item: FoolMaterialItem): { command: Extract<FoolCommand, { type: 'MATERIAL' }>; label: string; cost: string } | null {
  const names = { UNLOCATED_REJECTION: ['TRACE_REJECTION', '追查原失败特性的去向'], RESIDUE_LOCATED: ['EXTRACT_RESIDUE', '提取已定位的原残余'], PLAYER_DIRTY: ['SEAL_RESIDUE', '清理并封存原残余'], LEGACY_HELD: ['TRANSFER_INHERITED', '核交随身原特性'], LEGACY_BOTTLED: ['TRANSFER_INHERITED', '核交原未用瓶中的特性'] } as const;
  if (!(item.disposition in names)) return null;
  const [type, label] = names[item.disposition as keyof typeof names];
  return { command: { type: 'MATERIAL', command: { type, itemId: item.id } }, label, cost: materialCost(type) };
}
function publicAbilities(s: SliceState, promoted: boolean): FoolProjection['abilities'] {
  if (s.progression.pathwayId !== 'diviner') return [];
  return [...inherited, ...(promoted ? FOOL_ABILITIES : [])].filter(a => Object.hasOwn(s.progression.mastery, a.id)).map(a => ({ id: a.id, label: a.label, description: a.description, mastery: s.progression.mastery[a.id]! }));
}

export function projectFool(s: SliceState): FoolProjection { return projectFoolInternal(s); }
function projectFoolInternal(s: SliceState, owned?: FoolOwnedEngine): FoolProjection {
  const base: FoolProjection = { title: '愚者晋升准备', guidanceKnown: false, promoted: false, story: FOOL_STORY, nextStep: FOOL_GOAL, risk: FOOL_RISK,
    resources: { health: s.health, mind: s.mind, spirituality: s.spirituality, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining },
    abilities: publicAbilities(s, false), actions: [], sections: [], insideCase: false };
  if (sameFool(s.fool, createFoolState())) {
    const reason = guidanceBlock(s);
    base.actions.push({ id: 'fool-guidance', label: '核对成神条件与原遗产', cost: '不花行动与费用', enabled: reason === null, reason, command: { type: 'LEARN_GUIDANCE' }, preferredAction: true });
    base.sections.push({ id: 'requirements', title: '成神所需', lines: [...FOOL_FORMULA.map(x => `${x.name}：${x.quantity}${x.unit}。${x.note}`), '须真实愚弄一次时间、历史或命运；普通预测错误不构成这次仪式。'] });
    return base;
  }
  const prepared = owned ? null : prepare(s), root = owned ? snapshotFoolOwnedEngine(owned) : prepared!.root, frame = root.frame!, b = frame.budget;
  base.guidanceKnown = true; base.promoted = b.sequence === 0; base.title = base.promoted ? '愚者 · 当前现场' : '愚者晋升准备';
  base.abilities = publicAbilities(s, base.promoted);
  base.insideCase = root.atFate || frame.location !== 'base' || !!root.escape && !root.escape.scene.reported;
  const add = (command: FoolCommand, label: string, cost: string, preferredAction = false, knownReason?: string | null): void => {
    if (!validateFoolCommand(command)) return;
    const raw = s.status !== 'ACTIVE' ? '已经死亡的角色不能继续行动。' : owned ? blockFoolOwnedEngine(owned, command, s.revision + 1) : blockPreparedFool(prepared!, command, s.revision + 1);
    const reason = publicReason(raw) ?? knownReason ?? null;
    base.actions.push({ id: `fool-action-${base.actions.length + 1}`, label, cost, enabled: reason === null, reason, command, ...(preferredAction ? { preferredAction: true } : {}) });
  };
  const reception = (): void => {
    add({ type: 'RECEPTION_WORK' }, '做一班当代劳动', b.actions > 0 ? '1行动，收入24便士；30分钟' : '本周有限补劳动：不花行动，收入24便士；30分钟');
    add({ type: 'RECEPTION_REST' }, '付费休养并处理伤势', '1行动、8便士；1小时，健康+5、精神+8、灵性+10，均受原上限限制');
    add({ type: 'RECEPTION_NEXT_WEEK' }, '度过七天', '行动用尽后支付24便士；下一周4行动');
  };
  const travel = (to: Parameters<typeof fogTravelMetres>[1], label?: string, preferred = false): void => add({ type: 'FOG', command: { type: 'TRAVEL', to } }, label ?? `带原车前往${stationName(to)}`, `${to === 'base' || ['RUNNING', 'ARRIVED'].includes(root.fog!.circuits.at(-1)?.status ?? '') ? 0 : 1}行动，步行${fogTravelMetres(frame.location, to)}米并经过同样秒数`, preferred);
  const recovery = (): void => {
    const circuit = root.fog!.circuits.at(-1);
    if (circuit && ['RUNNING', 'ARRIVED'].includes(circuit.status)) {
      add({ type: 'FOG', command: { type: 'CANCEL_CIRCUIT' } }, '结束四站维持，准备沿原路返回', '不花行动；原锚休眠，原虫仍需逐一回收', true);
      return;
    }
    const remaining = root.fog!.corridors.filter(c => root.fog!.worms.some(w => w.id === c.wormId && w.status !== 'LOST' && w.status !== 'RECALLED' && w.location.kind === 'HISTORY'));
    const local = remaining.find(c => c.stationId === frame.location);
    if (local) add({ type: 'FOG', command: { type: 'RECALL_WORM', domainId: local.domainId } }, `从${stationName(local.stationId)}收回一条原灵之虫`, '0行动、2灵性；沿入雾原路移动后归并本人');
    else if (remaining[0]) travel(remaining[0].stationId, `前往${stationName(remaining[0].stationId)}收回原灵之虫`);
    if (frame.location !== 'base') travel('base', '沿普通原路返回接待处', true);
  };
  if (root.escape) {
    const escape = projectFoolEscape(root.escape, { actions: b.actions, health: b.health, mind: b.mind, spirituality: b.spirituality });
    base.story = escape.story; base.nextStep = escape.reported ? '本次救人与撤离已留下实际结果，可继续接待处生活。' : '观察原门、两名信使与看守，选择当前行动或普通退路。';
    base.sections.push({ id: 'escape', title: escape.title, lines: [...escape.facts, ...escape.bodies.map(person => `${person.name}：健康${person.health}，在${escapePlace(person.place)}，实际走过${person.walkedMetres}米。`), ...(escape.lastSummary ? [escape.lastSummary] : [])] });
    for (const action of escape.actions) add({ type: 'ESCAPE', command: action.command }, action.label, action.cost, action.command.type === 'REPORT', action.reason);
    if (escape.reported && s.status === 'ACTIVE') { recovery(); if (frame.location === 'base') reception(); }
    return base;
  }
  if (base.promoted) {
    base.story = '成神结果已记录，原有身体、伤势、掌握和复起账本继续保留。封存库有人被困；眼前两项有限技巧可以实际用于救人与撤离。';
    base.nextStep = frame.location === 'base' ? '在准备好后进入接待处封存库，帮助两名已同意同行的成年信使撤离。' : '先带同一身体和随身原物沿普通路回接待处。';
    recovery();
    if (frame.location === 'base') { add({ type: 'START_ESCAPE' }, '进入封存库救人现场', '不花行动；从接待处封存库原门开始，当前身心状态保留', true); reception(); }
    return base;
  }
  const materials = projectFoolMaterials(root.materials!);
  base.sections.push({ id: 'materials', title: '原特性与唯一性', lines: [...materials.items.map((item, i) => `${item.name}${item.name === '原诡秘侍者特性' ? `（第${i + 1}份）` : ''}：${item.status}${item.workRequired ? `，已做${item.workCompleted}/${item.workRequired}项交接劳动` : ''}。`), materials.notice] });
  const fog = owned ? projectFoolOwnedFog(owned) : fogProjection(root.fog!, foolFogHost(root));
  base.sections.push({ id: 'fog', title: '四站与当前历史迷雾', lines: [`当前实控${fog.controlledUnits}/${fog.totalUnits}，占${(fog.ratio * 100).toFixed(2)}%；至少需要25%。`, `已占用灵之虫${fog.totalSharedWorms}/${fog.wormCapacity}；本次共同窗口还剩${fog.remainingSeconds}秒。`, ...fog.stations.map(station => `${station.title}：${station.preparedCorridors}/${station.totalCorridors}条原廊已备，${publicFogStatus(station.status)}。`)] });
  const fate = owned ? projectFoolOwnedFate(owned, s.revision + 1) : projectFoolFateHost(root.fate!, foolFateContext(root, s.revision + 1, 'public-view'), foolFateAuthority(root, prepared!.context.fateReceipts));
  appendFateSection(base, fate);
  if (root.atFate) {
    base.nextStep = fate.actions.find(action => action.recommended)?.label ?? '核对原船箱与同行人的实际结果，沿开放退路离开。';
    for (const action of fate.actions) {
      const { id: _id, ...command } = action.command;
      if (command.type !== 'ENTER_FIRST_CASE' && command.type !== 'SYNC_WORLD') add({ type: 'FATE', command }, action.label, action.costText, action.recommended, action.reason);
    }
    if (fate.returnToBase) add({ type: 'LEAVE_FATE' }, '沿原路返回接待处', '不花行动；步行20秒');
    return base;
  }
  const circuit = root.fog!.circuits.at(-1), running = !!circuit && (circuit.status === 'RUNNING' || circuit.status === 'ARRIVED');
  const compound = root.materials!.compounds.find(item => item.status === 'PREPARED');
  if (running) {
    base.nextStep = circuit.status === 'ARRIVED' ? '核对共同窗口能否覆盖整段服药，再决定服下原瓶或取消维持。' : '依次前往四站并启用原锚，最后真实返回原镇服药点。';
    const station = FOG_STATION_CONTENT.find(x => x.id === frame.location);
    if (station && !circuit.activatedStations.includes(station.id)) add({ type: 'FOG', command: { type: 'ACTIVATE_STATION', stationId: station.id } }, `启用${station.title}`, '0行动，4灵性，消耗本站已付费维护包；120秒', true);
    else if (circuit.status === 'RUNNING') { const to = FOG_ROUTE[circuit.routeIndex + 1]; if (to) travel(to, undefined, true); }
    if (compound && circuit.status === 'ARRIVED') add({ type: 'CONSUME', compoundId: compound.id, confirmed: true }, '确认风险并服下这瓶魔药', '1行动、60秒；耗尽本瓶普通药液和封材，失败仍可能死亡', true);
    add({ type: 'FOG', command: { type: 'CANCEL_CIRCUIT' } }, '取消维持，保留原物与已付费用', '不花行动；退出后原锚休眠');
    return base;
  }
  if (frame.location === 'base') {
    reception();
    const supplier = root.materials!.items.find(item => item.disposition === 'SUPPLIER');
    if (supplier) {
      if (supplier.supplierWork.length < 5) add({ type: 'MATERIAL', command: { type: 'SUPPLIER_WORK', itemId: supplier.id } }, `交接劳动${supplier.supplierWork.length + 1}/5：${materials.supplierWork[supplier.supplierWork.length]}`, materialCost('SUPPLIER_WORK'));
      add({ type: 'MATERIAL', command: { type: 'SUPPLIER_HANDOFF', itemId: supplier.id } }, '付清并接收供应方原特性', materialCost(supplier.supplierWork.length === 5 ? 'SUPPLIER_LABOUR_BALANCE' : 'SUPPLIER_HANDOFF'));
    }
    const uniqueness = root.materials!.items.find(item => item.kind === 'UNIQUENESS' && item.disposition === 'SEALED_EXTERNAL');
    if (uniqueness) { const type = uniqueness.sealInspectedRecordId ? 'TAKE_UNIQUENESS' : 'INSPECT_UNIQUENESS'; add({ type: 'MATERIAL', command: { type } }, type === 'TAKE_UNIQUENESS' ? '接收独立封存的唯一性' : '核查唯一性原封与交接簿', materialCost(type)); }
    if (!compound && materials.heldExternalCharacteristics === 2 && materials.uniquenessHeld) add({ type: 'MATERIAL', command: { type: 'PREPARE_COMPOUND' } }, '用这三份原特性与唯一性配制魔药', materialCost('PREPARE_COMPOUND'));
    for (const action of fate.actions.filter(x => ['INVESTIGATE_RECOVERY', 'VERIFY_RECOVERY'].includes(x.command.type))) { const { id: _id, ...command } = action.command; if (command.type === 'INVESTIGATE_RECOVERY' || command.type === 'VERIFY_RECOVERY') add({ type: 'FATE', command }, action.label, action.costText, false, action.reason); }
    if (fate.currentCase?.evaluation?.verdict !== 'VERIFIED_DEVIATION') add({ type: 'ENTER_FATE' }, '前往原商运泊位', '普通步行20秒，不花行动');
  }
  const remainingMaterial = root.materials!.items.find(item => materialNext(item) !== null);
  if (remainingMaterial) {
    const next = materialNext(remainingMaterial)!;
    const destination = ['TRACE_REJECTION', 'EXTRACT_RESIDUE'].includes(next.command.command.type) ? remainingMaterial.locationId ?? remainingMaterial.lastKnownLocationId : frame.location;
    if (destination === frame.location) add(next.command, next.label, next.cost, true);
    else if (destination === 'new-alder-clearing' && frame.location === 'base') travel('new-alder-clearing', '带原车回原镇追查残余');
  }
  appendFogActions(root, fog, add, travel);
  if (frame.location !== 'base') travel('base', '沿普通原路返回接待处');
  const preferred = base.actions.find(action => action.preferredAction && action.enabled) ?? base.actions.find(action => action.enabled && !action.command.type.startsWith('RECEPTION_'));
  base.nextStep = preferred?.label ?? '先在接待处劳动、休养或推进实际一周，再继续尚未完成的准备。';
  return base;
}

function publicFogStatus(status: string): string {
  if (['筹备中', '正在维持', '已准备，休眠中'].includes(status)) return status;
  return ({ DORMANT: '休眠中', TRAPPED: '受困，须沿原路回收', ACTIVE: '正在维持', RECALLED: '已归并本人', LOST: '原虫已损失' } as Record<string, string>)[status] ?? '当前情况待核实';
}
function publicFateOutcome(verdict: string): string[] {
  if (verdict === 'VERIFIED_DEVIATION') return ['原绑定未改，致毁传导已在空井留下真实撞击；同一原船、原箱和货物已完整交接。'];
  if (verdict === 'FAILED') return ['实际伤亡、原物损伤或普通撤离已记录，这次未完成仪式。'];
  if (verdict === 'ORDINARY_SURVIVAL') return ['原人原物的实际结果已记录；普通安全抵达尚不足以证明一次真实的命运偏离。'];
  return ['交接与结局尚未齐备，须继续观察和核实原人原物。'];
}
function appendFateSection(view: FoolProjection, fate: FoolFateHostPublicView): void {
  const current = fate.currentCase;
  if (!current) { view.sections.push({ id: 'fate', title: '原商运委托', lines: ['泊位已有独立原船、原箱和货主，须到场查明束缚及其真实作用。'] }); return; }
  view.sections.push({ id: 'fate', title: current.title, lines: [...current.explanation,
    `本人在${fatePlace(current.actorPlace)}；${current.boat.name}在${fatePlace(current.boat.place)}，${current.boat.intact ? '结构完整' : '已有损伤'}；${current.crate.name}${current.crate.intact ? '与封签、货物保持完整' : '已有实际损伤'}。`,
    ...current.crew.map(person => `${person.name}在${fatePlace(person.place)}，${person.alive ? `有${person.injuries}处已记录伤势` : '已经死亡'}。`),
    ...(current.evaluation ? publicFateOutcome(current.evaluation.verdict) : []), current.costsBeforeDeparture.note] });
}
function appendFogActions(root: FoolState, fog: ReturnType<typeof fogProjection>, add: (command: FoolCommand, label: string, cost: string, preferred?: boolean, reason?: string | null) => void,
  travel: (to: Parameters<typeof fogTravelMetres>[1], label?: string, preferred?: boolean) => void): void {
  const state = root.fog!, location = root.frame!.location;
  const local = FOG_STATION_CONTENT.find(station => station.id === location);
  if (local) {
    if (state.items.some(item => item.stationId === local.id && item.condition === 'INTACT' && item.location.kind === 'CART')) add({ type: 'FOG', command: { type: 'DELIVER_STATION', stationId: local.id } }, `卸下${local.title}的原物与维护包`, '0行动；30秒', true);
    if (fog.stations.find(x => x.id === local.id)!.preparedCorridors < 4) add({ type: 'FOG', command: { type: 'PREPARE_STATION', stationId: local.id } }, `准备${local.title}的原廊`, '最多3行动；每条新分虫3灵性、2精神，实际原路行进与抵抗均会结算', true);
    return;
  }
  if (location !== 'base') return;
  const firstUnready = fog.stations.find(station => station.preparedCorridors < 4);
  const needsMaintenance = (stationId: FogStationId): boolean => !state.items.some(item => item.stationId === stationId && item.kind === 'MAINTENANCE' && item.condition === 'INTACT');
  const targetId = firstUnready?.id ?? FOG_STATION_CONTENT.find(station => needsMaintenance(station.id) || state.items.some(item => item.stationId === station.id && item.kind === 'MAINTENANCE' && item.condition === 'INTACT' && item.location.kind === 'CART'))?.id;
  if (targetId) {
    const title = stationName(targetId);
    const station = state.stations.find(item => item.id === targetId)!;
    const needsBase = station.baseItemId === null && !state.items.some(item => item.stationId === targetId && item.kind === 'BASE' && item.condition === 'INTACT');
    const needsAnchors = state.corridors.filter(item => item.stationId === targetId && item.proofAttemptId === null).some(c => !state.items.some(item => item.domainId === c.domainId && item.kind === 'ANCHOR' && item.condition === 'INTACT'));
    if (needsBase || needsAnchors) add({ type: 'FOG', command: { type: 'BUY_ANCHOR_KIT', stationId: targetId } }, `购买${title}的原锚材料`, '48便士，0行动；20公斤原物装入原车，30秒');
    if (needsMaintenance(targetId)) add({ type: 'FOG', command: { type: 'BUY_MAINTENANCE', stationId: targetId } }, `购买${title}的维护包`, '8便士，0行动；1公斤原物装入原车，30秒');
    travel(targetId, `带原车前往${title}`, true);
  } else add({ type: 'FOG', command: { type: 'START_CIRCUIT' } }, '开始一次四站巡回维护', '1行动；四站共消耗16灵性与四份已交付维护包，原路返回后有共同服药时限', true);
}
