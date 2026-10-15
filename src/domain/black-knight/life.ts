import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import { applyShepherdActivity, shepherdActions, shepherdInside } from '../shepherd/life.js';
import { validateShepherdCommand } from '../shepherd/index.js';
import type { ShepherdActivityCommand } from '../shepherd/types.js';
import { roseBishopInside } from '../rose-bishop/life.js';
import type { BlackKnightAbilityId } from './types.js';

export const BLACK_KNIGHT_CASE_IDS = ['shadow-boundary', 'blade-panel', 'one-spirit-account'] as const;
export type BlackKnightCaseId = typeof BLACK_KNIGHT_CASE_IDS[number];
export const BLACK_KNIGHT_SHADE_URGE = '想为快速获胜忽视原灵界限' as const;
type InheritedCommand = Extract<ShepherdActivityCommand, { type: 'MEET_SPIRITS' | 'GRAZE' | 'ACTIVATE_SPIRIT' | 'RELEASE_SPIRIT' | 'BUY_RATION' | 'TAKE_RATION' }>;
export type BlackKnightActivityCommand = InheritedCommand
  | { type: 'OBSERVE' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: BlackKnightCaseId }
  | { type: 'PREPARE'; caseId: BlackKnightCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'RETURN_ROUTE'; caseId: 'one-spirit-account' }
  | { type: 'REFLECT' | 'BUY_SHADE_KIT' | 'ENTER_SHADE_ROOM' | 'CAPTURE_SHADE' | 'RETURN_SHADE_ROUTE' | 'HANDOFF_SHADE' | 'SHADOW_EXIT' }
  | { type: 'SPAWN_SHADE'; confirmed: true; acknowledgedUrge: typeof BLACK_KNIGHT_SHADE_URGE };
interface Attempt { week: number; method: 'ABILITY' | 'ORDINARY'; success: boolean; spiritId: string | null }
export interface BlackKnightCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  method: 'ABILITY' | 'ORDINARY' | null; contactOpen: boolean; preparations: number; withdrawals: number; closes: number; attempts: Attempt[];
}
export interface BlackKnightLifeState {
  cases: Record<BlackKnightCaseId, BlackKnightCaseState>; reflected: boolean;
  shadow: { lampId: 'BK4-LAMP-1'; lampLit: boolean; subjectId: 'VENSON'; consented: boolean; distanceMetres: 2; bound: boolean; durationSeconds: 0 | 60; releases: number };
  panel: { id: 'BK4-PANEL-1'; clubId: 'BK4-DULL-CLUB-1'; handToolId: 'BK4-HAND-TOOL-1'; toolLocation: 'GUIDE' | 'PLAYER'; bladeActive: boolean; cuts: number; notches: number; clearBehind: true };
  card: { id: 'BK4-CARD-1'; location: 'TABLE' | 'MARK'; playerNode: 'DESK' | 'MARK'; walks: number; distanceMetres: number; borrowing: boolean };
  shade: {
    kitPurchasedWeek: number | null; caskId: 'BK4-CASK-1' | null; caskLocation: 'NONE' | 'PLAYER' | 'BK4-STORE'; caskStatus: 'ABSENT' | 'EMPTY' | 'SEALED' | 'HANDED_OVER';
    captureSeals: { id: 'BK4-SEAL-1' | 'BK4-SEAL-2'; consumed: boolean }[];
    emergencySealId: 'BK4-EXIT-SEAL-1' | null; emergencySealUsed: boolean;
    creatureId: 'BK4-SHADE-1' | null; status: 'NOT_CREATED' | 'LOOSE' | 'SEALED' | 'ISOLATED' | 'TAKEN_AWAY';
    creatureLocation: 'NONE' | 'LAMP' | 'INNER_DOOR' | 'CASK' | 'BK4-STORE'; controlled: false;
    spawnWeek: number | null; acknowledgedUrge: typeof BLACK_KNIGHT_SHADE_URGE | null;
    captureAttempts: { week: number; sealId: 'BK4-SEAL-1' | 'BK4-SEAL-2'; success: boolean }[];
    glassHood: 'INTACT' | 'BROKEN'; lampExtinguished: boolean; creatureWalks: number; creatureDistanceMetres: number;
    playerNode: 'OUTSIDE' | 'ROOM'; playerWalks: number; playerDistanceMetres: number;
    ordinaryDoor: 'CLEAR' | 'BLOCKED' | 'SEALED'; roomStatus: 'AVAILABLE' | 'OCCUPIED' | 'QUARANTINED' | 'CLEARED'; handoffs: number;
  };
}
export interface BlackKnightLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BlackKnightActivityCommand }
export interface BlackKnightLifeProjection {
  cases: { id: BlackKnightCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  insideCase: boolean; environment: string;
  practice: { shadow: string; panel: string; card: string; route: string; history: string[] } | null;
  shade: { status: string; room: string; creature: string; kit: string; route: string; cost: string; warning: string } | null;
}
const inheritedTypes = ['MEET_SPIRITS', 'GRAZE', 'ACTIVATE_SPIRIT', 'RELEASE_SPIRIT', 'BUY_RATION', 'TAKE_RATION'];
const inherited = (c: { type: string }): c is InheritedCommand => inheritedTypes.includes(c.type);
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const shape = (x: object, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && [4,3].includes(s.progression.sequence!);
const last = (r: BlackKnightCaseState) => r.attempts.at(-1);
const completed = (r: BlackKnightCaseState) => r.status === 'EXAMINED' || r.status === 'RESOLVED';
const sourceFor = (id: BlackKnightCaseId) => `black-knight-case:${id}`;
const emptyCase = (): BlackKnightCaseState => ({ status: 'AVAILABLE', method: null, contactOpen: false, preparations: 0, withdrawals: 0, closes: 0, attempts: [] });
const CASES = [
  { id: 'shadow-boundary', title: '灯下原影与本人边界', story: '成年文森本次明确同意在原灯BK4-LAMP-1照亮的原房间内，核对两米外自己的原影与有限身体约束。本人可以抵抗或拒绝；普通方法只观察原影并请他自愿踏一步。（原创G）', facts: ['同一本人和自己的原影实际在灯下两米处；原灯必须真实点亮，没有隔墙或无限距离。', '统御阴影实施1行动、4灵性、知识18；成功才约束同一原影60秒G，身体只有有限牵制，没有读心或控制意志。', '普通方法1行动、0灵性、知识10，只观察与合作踏步，没有影缚或掌握奖励。', '实施后须另选0行动收束，实际解除本次约束；失败成本不退，下一真实周才可重试。'] },
  { id: 'blade-panel', title: '原练习隔板留下的真实切口', story: '伊森交出原钝棍BK4-DULL-CLUB-1与原手工工具BK4-HAND-TOOL-1，在相邻修缮间的同一原练习隔板BK4-PANEL-1前操作。隔板后确实无人，只对原隔板实施一次有限接触。（原创G）', facts: ['灵肉之刃实施1行动、5灵性、知识18，必须实际触及原隔板；成功留下真实切口，不把触及无生命物冒充杀死活人。', '普通方法1行动、0灵性、知识10，用同一原手工工具安全评估并作有限刻痕。', '成功切口或刻痕永久保留，不刷新完好原板，也没有击杀、现金或新装备奖励。', '0行动结束灵肉之刃并把同一原工具实际交还伊森，之后才可报告。'] },
  { id: 'one-spirit-account', title: '一位原灵与同一张原卡', story: '相邻普通桌上只有伊森的原卡BK4-CARD-1和一米外标记。核对原伊芮斯已放牧状态与当初所选轻触术；你可实际借用，或自己步行携带同一原卡。（原创G）', facts: ['能力路线只许当前驱使且确已放牧的原伊芮斯SH5-IRIS-1已选轻触术；2灵性、知识14，没有免费灵魂或法术库。', '普通路线0灵性、知识10，本人拿同一卡实际走一米；不要求拥有任何原灵。', '必须另选0行动原路取回同一卡并实际步行返回；原卡与原灵均不复制，借用不成为永久自有能力。', '收束保留当时原activeSpiritId，只有明确ACTIVATE_SPIRIT命令才能切换；塞德里克若已释放仍永久离开，没有第二个同时活跃原灵。'] },
] as const;
export const BLACK_KNIGHT_LIFE_ENVIRONMENT = '三项有限原创G实践，观察、准备、实施、报告各1行动；每份报告扮演25，三案后反思1行动另25，可全普通和平完成100。能力失败实际付费且下一真实周重试；所有收束、原路返回和安全退出0行动，不能瞬移。统御原影4灵性知识18，灵肉之刃5灵性知识18，借原伊芮斯轻触术2灵性知识14；普通知识10不奖励能力掌握。可选堕落阴影须独立确认，180便士工具包只一套、生成1行动5灵性5精神，产生真实独立且不受控制的生物；不是宠物、净化人格或清空污染。两枚有限捕获封条各尝试1行动3灵性知识18；失败原玻璃灯罩破损、精神−3最低1。退出必须实际走两米并耗原紧急封条永久隔离同一生物，或实际携原封桶走出交接；原生物不会删除。所有新增原人、物件、距离、成本、判定和效果数值为G。';
export function createBlackKnightLifeState(): BlackKnightLifeState {
  return {
    cases: { 'shadow-boundary': emptyCase(), 'blade-panel': emptyCase(), 'one-spirit-account': emptyCase() }, reflected: false,
    shadow: { lampId: 'BK4-LAMP-1', lampLit: true, subjectId: 'VENSON', consented: false, distanceMetres: 2, bound: false, durationSeconds: 0, releases: 0 },
    panel: { id: 'BK4-PANEL-1', clubId: 'BK4-DULL-CLUB-1', handToolId: 'BK4-HAND-TOOL-1', toolLocation: 'GUIDE', bladeActive: false, cuts: 0, notches: 0, clearBehind: true },
    card: { id: 'BK4-CARD-1', location: 'TABLE', playerNode: 'DESK', walks: 0, distanceMetres: 0, borrowing: false },
    shade: { kitPurchasedWeek: null, caskId: null, caskLocation: 'NONE', caskStatus: 'ABSENT', captureSeals: [], emergencySealId: null, emergencySealUsed: false, creatureId: null, status: 'NOT_CREATED', creatureLocation: 'NONE', controlled: false, spawnWeek: null, acknowledgedUrge: null, captureAttempts: [], glassHood: 'INTACT', lampExtinguished: false, creatureWalks: 0, creatureDistanceMetres: 0, playerNode: 'OUTSIDE', playerWalks: 0, playerDistanceMetres: 0, ordinaryDoor: 'CLEAR', roomStatus: 'AVAILABLE', handoffs: 0 },
  };
}
export function validateBlackKnightActivityCommand(c: unknown): c is BlackKnightActivityCommand {
  if (!record(c)) return false;
  if (inheritedTypes.includes(c.type as string)) return validateShepherdCommand(c);
  if (c.type === 'SPAWN_SHADE') return shape(c, ['type', 'confirmed', 'acknowledgedUrge']) && c.confirmed === true && c.acknowledgedUrge === BLACK_KNIGHT_SHADE_URGE;
  if (['REFLECT', 'BUY_SHADE_KIT', 'ENTER_SHADE_ROOM', 'CAPTURE_SHADE', 'RETURN_SHADE_ROUTE', 'HANDOFF_SHADE', 'SHADOW_EXIT'].includes(c.type as string)) return shape(c, ['type']);
  if (!BLACK_KNIGHT_CASE_IDS.includes(c.caseId as BlackKnightCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return shape(c, ['type', 'caseId']) && (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) || c.type === 'RETURN_ROUTE' && c.caseId === 'one-spirit-account');
}
export function hasBlackKnightLifeLock(s: SliceState): boolean {
  const l = s.blackKnight.life;
  return Object.values(l.cases).some(r => r.contactOpen) || l.card.playerNode !== 'DESK' || l.card.location !== 'TABLE' || l.shade.playerNode === 'ROOM' || l.shade.status === 'SEALED';
}
function irisSelected(s: SliceState): boolean {
  const iris = s.shepherd.grazing.spirits.find(x => x.id === 'SH5-IRIS-1');
  return s.shepherd.grazing.met && s.shepherd.grazing.activeSpiritId === 'SH5-IRIS-1' && iris?.status === 'GRAZED' && iris.acquiredWeek !== null && iris.releasedWeek === null && iris.selectedAbilities.includes('light-touch');
}
function caseCost(id: BlackKnightCaseId) { return id === 'shadow-boundary' ? 4 : id === 'blade-panel' ? 5 : 2; }
export function blackKnightActivityReason(s: SliceState, c: BlackKnightActivityCommand): string | null {
  if (!validateBlackKnightActivityCommand(c)) return '黑骑士实践命令无效，生成阴影须明确确认本次虚构角色冲动和独立生物后果。';
  if (!promoted(s)||s.progression.sequence!==4) return '原黑骑士实践和独立影体后果保留，当前阶段不重新开启。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '先实际返回贝克兰德伊森的原房间。';
  const l = s.blackKnight.life, sh = l.shade, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'RETURN_ROUTE') return r?.contactOpen && (l.card.location === 'MARK' || l.card.playerNode === 'MARK') ? null : '同一原卡与本人已经在原桌旁，无需虚构行走。';
  if (c.type === 'CLOSE') return !r?.contactOpen ? '没有尚待实际收束的原现场。' : c.caseId === 'one-spirit-account' && (l.card.location !== 'TABLE' || l.card.playerNode !== 'DESK') ? '先另选原路返回，实际取回同一卡并步行回桌旁。' : null;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' && !r.contactOpen ? null : '只能取消尚未实施的准备；已实施须真实返回和收束。';
  if (c.type === 'SHADOW_EXIT') return sh.playerNode !== 'ROOM' || sh.status !== 'LOOSE' ? '只有本人仍在原房间且独立阴影未封入原桶时，才能紧急退出隔离。' : sh.ordinaryDoor !== 'CLEAR' ? '原普通出口不净空，不能靠退出命令瞬移穿门。' : !sh.emergencySealId || sh.emergencySealUsed ? '没有尚未消耗的同一原紧急封条。' : null;
  if (c.type === 'RETURN_SHADE_ROUTE') return sh.playerNode !== 'ROOM' || !['NOT_CREATED', 'SEALED'].includes(sh.status) ? '须在原房间且尚未生成，或已经把同一阴影封入原桶。' : sh.ordinaryDoor !== 'CLEAR' ? '原普通门不净空，不能瞬移退出。' : null;
  if (c.type === 'HANDOFF_SHADE') return sh.status === 'SEALED' && sh.playerNode === 'OUTSIDE' && sh.caskLocation === 'PLAYER' ? null : '先将同一阴影实际封入原桶，再携桶普通步行两米走到门外导师面前。';
  const shadeOperation = c.type === 'SPAWN_SHADE' || c.type === 'CAPTURE_SHADE';
  if (hasBlackKnightLifeLock(s) && !shadeOperation) return '先0行动完成原现场真实收束、普通步行退出与原封桶交接，或实际紧急封门隔离。';
  if (shepherdInside(s) || roseBishopInside(s) || s.roseBishop.practice.shape !== 'NORMAL') return '先结束原低阶现场并恢复本人正常形态。';
  if (Object.entries(l.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || c.caseId !== id))) return '先实施或0行动取消另一项准备。';
  if (inherited(c)) { const action = shepherdActions(s).find(a => stableStringify(a.command) === stableStringify(c)); return action ? action.reason : c.type === 'GRAZE' ? null : '当前没有可执行的同一原灵或原份额操作。'; }
  if (c.type === 'ENTER_SHADE_ROOM') return sh.kitPurchasedWeek === null ? '先实际购买唯一一套原封桶和三枚有限封条。' : sh.status !== 'NOT_CREATED' || sh.roomStatus !== 'AVAILABLE' ? '这间原房间已经发生独立阴影后果，不能再用或再生成。' : sh.ordinaryDoor !== 'CLEAR' ? '原普通门不净空，不能穿门。' : null;
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；0行动安全收束仍可执行。';
  if (s.actionsRemaining < 1) return '需要1行动；安全返回、收束与紧急封门都不耗行动。';
  if (c.type === 'BUY_SHADE_KIT') return sh.kitPurchasedWeek !== null ? '同一套原物已经交付，不重复生成封桶或补充封条。' : !completed(l.cases['shadow-boundary']) || l.cases['shadow-boundary'].contactOpen ? '先成功完成并实际收束灯下原影实践，成年文森离开后才可准备独立阴影房间。' : s.cash < 180 ? '同一原封桶、两枚捕获封条与一枚紧急封条需要180便士。' : null;
  if (c.type === 'SPAWN_SHADE') return sh.playerNode !== 'ROOM' || sh.status !== 'NOT_CREATED' || sh.kitPurchasedWeek === null || sh.ordinaryDoor !== 'CLEAR' || Object.values(l.cases).some(x => x.contactOpen) ? '须本人沿净空原门走入已备妥且无其他人的同一原房间；同一阴影只可生成一次。' : s.spirituality < 5 || s.mind <= 5 ? '生成需要5灵性和5精神，精神须剩余至少1；已入室仍可0行动普通走回。' : null;
  if (c.type === 'CAPTURE_SHADE') return sh.playerNode !== 'ROOM' || sh.status !== 'LOOSE' || sh.caskStatus !== 'EMPTY' ? '须本人仍在原房间，对同一未受控阴影使用实际空原桶。' : !sh.captureSeals.some(x => !x.consumed) ? '两枚原捕获封条已耗尽，只能实际紧急退出并永久封门。' : s.spirituality < 3 ? '捕获需要3灵性，不能透支；0行动紧急退出可用。' : null;
  if (c.type === 'REFLECT') return l.reflected ? '已经反思这三份原报告。' : BLACK_KNIGHT_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三份实际报告。' : null;
  if (!r || !('caseId' in c)) return '未知原现场。';
  if (r.status === 'RESOLVED') return '这项有限报告已经完成。';
  const position = BLACK_KNIGHT_CASE_IDS.indexOf(c.caseId);
  if (position > 0 && l.cases[BLACK_KNIGHT_CASE_IDS[position - 1]!].status !== 'RESOLVED') return '先报告上一项真实结果。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '本次原物、原人和边界已观察。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && !r.contactOpen ? null : '先成功实施并真实收束，再报告。';
  if (c.type === 'PREPARE' || c.type === 'PERFORM') {
    if (c.type === 'PREPARE' ? r.status !== 'OBSERVED' : r.status !== 'PREPARED') return c.type === 'PREPARE' ? '先观察同一原现场。' : '先准备本次方法。';
    if (last(r)?.week === s.week) return '本真实周已经实施，失败须下一真实周重试。';
    const method = c.type === 'PREPARE' ? c.method : r.method;
    if (c.caseId === 'shadow-boundary' && (!l.shadow.lampLit || !l.shadow.consented || sh.roomStatus === 'QUARANTINED')) return '原灯、本人当前同意与可用原房间缺一不可。';
    if (method === 'ABILITY' && c.caseId === 'one-spirit-account' && !irisSelected(s)) return '须明确驱使实际已放牧且原选择含轻触术的同一伊芮斯，或采用普通方法。';
    if (c.type === 'PERFORM' && method === 'ABILITY' && s.spirituality < caseCost(c.caseId)) return `实施需要${caseCost(c.caseId)}灵性，不能透支；可0行动取消准备。`;
    return null;
  }
  return '本次命令不适用于当前现场。';
}
function walkCard(l: BlackKnightLifeState, node: 'DESK' | 'MARK') { if (l.card.playerNode !== node) { l.card.playerNode = node; l.card.walks += 1; l.card.distanceMetres += 1; } }
function walkShade(l: BlackKnightLifeState, node: 'ROOM' | 'OUTSIDE') { if (l.shade.playerNode !== node) { l.shade.playerNode = node; l.shade.playerWalks += 1; l.shade.playerDistanceMetres += 2; } }
export function applyBlackKnightActivity(s: SliceState, c: BlackKnightActivityCommand, ctx: SeerContext, award: (id: BlackKnightAbilityId, amount?: number) => void): void {
  const reason = blackKnightActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.blackKnight.life, sh = l.shade;
  if (inherited(c)) { applyShepherdActivity(s, c, ctx, () => {}); return; }
  if (c.type === 'RETURN_ROUTE') {
    if (l.card.location === 'MARK') { walkCard(l, 'MARK'); l.card.location = 'TABLE'; walkCard(l, 'DESK'); } else walkCard(l, 'DESK');
    ctx.note('同一卡与本人沿原一米路线实际返回', '你在原标记取起同一BK4-CARD-1，亲手携回原桌；若能力已把卡移动而本人仍在桌边，先普通走一米取卡再走一米回来。累计实际距离保留，没有传送、复制卡片或新原灵。'); return;
  }
  if (c.type === 'CLOSE') {
    const r = l.cases[c.caseId];
    if (c.caseId === 'shadow-boundary') { if (l.shadow.bound) l.shadow.releases += 1; l.shadow.bound = false; l.shadow.durationSeconds = 0; }
    if (c.caseId === 'blade-panel') { l.panel.bladeActive = false; l.panel.toolLocation = 'GUIDE'; }
    if (c.caseId === 'one-spirit-account') l.card.borrowing = false;
    r.contactOpen = false; r.closes += 1; if (!completed(r)) r.method = null;
    ctx.note('实际收束同一原现场', c.caseId === 'shadow-boundary' ? '0行动，实际解除同一原影约束并结束本次合作；文森本人自由离开，仍不读取或控制思想。' : c.caseId === 'blade-panel' ? '0行动，灵肉之刃实际结束，同一原钝棍或原手工工具交回伊森。原板切口与刻痕永久保留，不换成完好板。' : '0行动，同一原卡与本人已在原桌旁，结束这次借用。原activeSpiritId不自动更换，释放历史和当初选择保留。'); return;
  }
  if (c.type === 'WITHDRAW') { const r = l.cases[c.caseId]; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1; ctx.note('取消尚未实施的准备', '0行动，保留观察、原人原物与准备成本，没有施法、重置原板、移动原卡或完成奖励。'); return; }
  if (c.type === 'ENTER_SHADE_ROOM') { walkShade(l, 'ROOM'); ctx.note('本人沿普通门实际走入两米', '原普通门净空；你带唯一原空桶与剩余封条从OUTSIDE普通走两米到ROOM。文森已离场，导师在原门外；房间没有其他人。尚未生成阴影，可0行动原路走回。'); return; }
  if (c.type === 'RETURN_SHADE_ROUTE') { walkShade(l, 'OUTSIDE'); ctx.note('本人沿原普通门真实走出两米', sh.status === 'SEALED' ? '你携同一BK4-CASK-1普通走两米到导师面前；同一BK4-SHADE-1仍实际封在桶内，没有瞬移或删除。还须另选交接原桶。' : '你带原空桶沿净空原门普通走两米到OUTSIDE，保留原工具包与已走距离，没有生成阴影。'); return; }
  if (c.type === 'SHADOW_EXIT') {
    walkShade(l, 'OUTSIDE'); sh.emergencySealUsed = true; sh.ordinaryDoor = 'SEALED'; sh.roomStatus = 'QUARANTINED'; sh.status = 'ISOLATED';
    ctx.note('沿原普通门走出，再耗原紧急封条永久隔离', '你先从ROOM实际普通步行两米到OUTSIDE，随后消耗唯一BK4-EXIT-SEAL-1封住同一原门。同一BK4-SHADE-1仍在原房间原位置独立存在；原灯熄灭及可能的原玻璃灯罩破损保留。房间永久隔离，不能再用或生成第二只。门外可正常生活，相邻两项实践不受影响；这不是传送、消灭阴影或净化人格。'); return;
  }
  if (c.type === 'HANDOFF_SHADE') {
    sh.caskLocation = 'BK4-STORE'; sh.caskStatus = 'HANDED_OVER'; sh.status = 'TAKEN_AWAY'; sh.creatureLocation = 'BK4-STORE'; sh.roomStatus = 'CLEARED'; sh.handoffs += 1;
    ctx.note('伊森实际接过同一原封桶带去原存放处', '你已在原门外。伊森亲手接收BK4-CASK-1并带到BK4-STORE；同一独立生物BK4-SHADE-1仍在该原封桶内，没有消失或成为宠物。原灯熄灭和灯罩损坏不重置，已耗封条与成本不退；你现在可以正常生活。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'BUY_SHADE_KIT') { s.cash -= 180; sh.kitPurchasedWeek = s.week; sh.caskId = 'BK4-CASK-1'; sh.caskLocation = 'PLAYER'; sh.caskStatus = 'EMPTY'; sh.captureSeals = [{ id: 'BK4-SEAL-1', consumed: false }, { id: 'BK4-SEAL-2', consumed: false }]; sh.emergencySealId = 'BK4-EXIT-SEAL-1'; ctx.note('实际买到唯一一套有限原物', '已耗180便士和1行动；收到原空封桶BK4-CASK-1、两枚捕获封条BK4-SEAL-1/2和一枚紧急封条BK4-EXIT-SEAL-1。不是无限封条、免费生物或新能力库，尚未入室或生成阴影。'); return; }
  if (c.type === 'SPAWN_SHADE') {
    s.spirituality -= 5; s.mind -= 5; sh.creatureId = 'BK4-SHADE-1'; sh.status = 'LOOSE'; sh.creatureLocation = 'LAMP'; sh.spawnWeek = s.week; sh.acknowledgedUrge = c.acknowledgedUrge; sh.roomStatus = 'OCCUPIED'; sh.lampExtinguished = true; l.shadow.lampLit = false; sh.creatureWalks = 1; sh.creatureDistanceMetres = 2;
    s.seer.completedSources.push('black-knight-shade-spawn'); award('hanged-man.s4.fallen-shadow', 8);
    ctx.note('真实分出不受控制的独立堕落阴影', `你已明确承认本次虚构角色冲动“${BLACK_KNIGHT_SHADE_URGE}”，实际付出1行动、5灵性、5精神。自身能力G确定执行，产生唯一BK4-SHADE-1；它自主走两米到原BK4-LAMP-1并将灯熄灭。它不听指令、不是随从或宠物，也没有证明人格净化或污染清空。自身堕落阴影掌握一次+8；现在须处理真实捕获或普通退出隔离后果。`); return;
  }
  if (c.type === 'CAPTURE_SHADE') {
    const seal = sh.captureSeals.find(x => !x.consumed)!; seal.consumed = true; s.spirituality -= 3;
    const result = ctx.check('knowledge', 18), success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
    sh.captureAttempts.push({ week: s.week, sealId: seal.id, success });
    if (success) { sh.caskStatus = 'SEALED'; sh.status = 'SEALED'; sh.creatureLocation = 'CASK'; ctx.note('同一独立阴影实际封入原桶', `1行动、3灵性与同一${seal.id}已耗；同一BK4-SHADE-1现在实际在原BK4-CASK-1中，仍独立存在且不受控制。你仍在ROOM，必须0行动携桶普通走出两米，再实际交给门外伊森；不增加能力掌握或净化人格。`); }
    else { s.mind = Math.max(1, s.mind - 3); sh.glassHood = 'BROKEN'; if (sh.creatureLocation === 'LAMP') { sh.creatureLocation = 'INNER_DOOR'; sh.creatureWalks += 1; sh.creatureDistanceMetres += 1; } ctx.note('捕获失败，原灯罩损坏而原普通出口仍净空', `1行动、3灵性与同一${seal.id}已经实际消耗；精神−3最低1。独立BK4-SHADE-1撞坏原BK4-LAMP-1玻璃灯罩，并自主走一米到INNER_DOOR；若已在该内门则仍在原位置，不虚构重复路程。INNER_DOOR不是你的原普通EXIT，净空普通门仍可实际走出两米，再用唯一紧急封条永久隔离同一生物。没有人类伤害或向人群传播。`); }
    return;
  }
  if (c.type === 'REFLECT') { l.reflected = true; s.seer.completedSources.push('black-knight-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25); ctx.note('区分自身能力、同一原灵与独立后果', '三份有限报告实际收束：自己的影缚与灵肉之刃、原伊芮斯当初选择的借用能力和普通方法各有真实来源。G扮演+25；不奖励第二个活跃原灵、未知半神灵魂、受控阴影或净化人格。可选阴影不参与完成三案的要求。'); return; }
  if (!('caseId' in c)) throw new Error('未知原现场。');
  const r = l.cases[c.caseId], spec = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; if (c.caseId === 'shadow-boundary') l.shadow.consented = true; ctx.note(spec.title, spec.story + spec.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; r.preparations += 1; ctx.note(spec.title, `已用1行动准备${c.method === 'ABILITY' ? '来源明确的有限能力' : '普通方法'}；原物和本人未因准备移动，原工具仍由导师保管。实施才另耗1行动${c.method === 'ABILITY' ? `与${caseCost(c.caseId)}灵性` : '，0灵性'}，失败照耗。`); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.seer.completedSources.push(sourceFor(c.caseId)); s.progression.acting = Math.min(100, s.progression.acting + 25);
    if (r.method === 'ABILITY' && c.caseId !== 'one-spirit-account') award(c.caseId === 'shadow-boundary' ? 'hanged-man.s4.shadow-command' : 'hanged-man.s4.flesh-soul-blade', 8);
    ctx.note(spec.title, `真实结果已经实际收束，G扮演+25。${r.method === 'ABILITY' && c.caseId !== 'one-spirit-account' ? '本次自身能力成功报告一次掌握+8。' : '普通方法或借原灵轻触术不冒领黑骑士新能力掌握。'}原隔板现有切口${l.panel.cuts}、普通刻痕${l.panel.notches}，同一原卡在${l.card.location}；原灵当初选择、当前驱使者与释放历史保留。`); return;
  }
  const method = r.method!, cost = method === 'ABILITY' ? caseCost(c.caseId) : 0;
  s.spirituality -= cost; r.contactOpen = true;
  if (c.caseId === 'blade-panel') { l.panel.toolLocation = 'PLAYER'; l.panel.bladeActive = method === 'ABILITY'; }
  if (c.caseId === 'one-spirit-account') { l.card.borrowing = method === 'ABILITY'; if (method === 'ORDINARY') { walkCard(l, 'MARK'); l.card.location = 'MARK'; } }
  const outcome = ctx.check('knowledge', method === 'ABILITY' ? c.caseId === 'one-spirit-account' ? 14 : 18 : 10), success = outcome.tier === 'SUCCESS' || outcome.tier === 'GREAT_SUCCESS';
  r.attempts.push({ week: s.week, method, success, spiritId: c.caseId === 'one-spirit-account' && method === 'ABILITY' ? 'SH5-IRIS-1' : null }); r.status = success ? 'EXAMINED' : 'OBSERVED';
  if (success && c.caseId === 'shadow-boundary' && method === 'ABILITY') { l.shadow.bound = true; l.shadow.durationSeconds = 60; }
  if (success && c.caseId === 'blade-panel') { if (method === 'ABILITY') l.panel.cuts += 1; else l.panel.notches += 1; }
  if (success && c.caseId === 'one-spirit-account' && method === 'ABILITY') l.card.location = 'MARK';
  const action = c.caseId === 'shadow-boundary' ? method === 'ABILITY' ? success ? '同一原影实际受到60秒G有限约束；文森仍有自己的意志。' : '原影约束失败，本人可抵抗，没有假称控制成功。' : '只核对灯下原影并请文森自愿合作踏一步，没有非凡影缚。' : c.caseId === 'blade-panel' ? success ? method === 'ABILITY' ? '灵肉之刃通过原钝棍实际触及同一原板，留下真实切口。' : '同一原手工工具留下真实有限刻痕。' : '原工具已经握持并实际接触原板，但本次未形成合格切口或刻痕；仍须结束并交还。' : method === 'ABILITY' ? success ? '借当前原伊芮斯已选轻触术，将同一原卡移动一米到标记；本人仍在桌旁。' : '已借用并付费，但同一原卡仍在原桌，本人也在桌旁。' : '本人携同一原卡普通走一米到原标记；无论核对成功与否都实际在标记处。';
  ctx.note(spec.title, `实际消耗1行动与${cost}灵性。${action}${success ? '取得本次有限结果，仍须实际返回和收束才可报告。' : '本次核对失败，成本和动作不退；先0行动返回收束，下一真实周才能重试。'}`);
}

export function blackKnightLifeActions(s: SliceState): BlackKnightLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.blackKnight.life, sh = l.shade, actions: BlackKnightLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: BlackKnightActivityCommand) => { const reason = blackKnightActivityReason(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const action of shepherdActions(s)) if (inherited(action.command)) add(`black-knight-${action.id}`, action.label, action.cost, action.command);
  for (const spec of CASES) {
    const id = spec.id, r = l.cases[id];
    if (r.status === 'AVAILABLE') add(`${id}-observe`, `观察：${spec.title}`, '1行动 · 核对原物、本人同意与实际边界', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED' && !r.contactOpen) {
      add(`${id}-ability`, id === 'one-spirit-account' ? '准备借当前原伊芮斯已选轻触术' : id === 'shadow-boundary' ? '准备约束灯下同一原影' : '准备灵肉之刃实际触及原板', `1行动准备 · 实施另1行动${caseCost(id)}灵性 · 知识${id === 'one-spirit-account' ? 14 : 18}`, { type: 'PREPARE', caseId: id, method: 'ABILITY' });
      add(`${id}-ordinary`, '准备普通方法', '1行动准备 · 实施另1行动0灵性 · 知识10 · 无能力掌握', { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${id}-perform`, '实际实施本次有限方法', `1行动 · ${r.method === 'ABILITY' ? caseCost(id) : 0}灵性 · 失败照耗`, { type: 'PERFORM', caseId: id });
      add(`${id}-withdraw`, '取消尚未实施的准备', '0行动 · 已付成本不退', { type: 'WITHDRAW', caseId: id });
    }
    if (r.contactOpen) {
      if (id === 'one-spirit-account' && (l.card.location === 'MARK' || l.card.playerNode === 'MARK')) add(`${id}-return`, '沿原一米路线实际取卡并返回', '0行动 · 本人真实步行 · 同一卡回原桌', { type: 'RETURN_ROUTE', caseId: id });
      add(`${id}-close`, id === 'shadow-boundary' ? '实际解除原影约束并结束合作' : id === 'blade-panel' ? '结束灵肉之刃并交还同一原工具' : '结束本次借用并核对原卡原位', '0行动 · 无退款 · 原物损伤与原灵历史保留', { type: 'CLOSE', caseId: id });
    }
    if (r.status === 'EXAMINED' && !r.contactOpen) add(`${id}-report`, '报告同一原现场的真实结果', '1行动 · G扮演+25 · 仅自身成功影缚/灵刃报告掌握+8', { type: 'REPORT', caseId: id });
  }
  if (!l.reflected) add('black-knight-reflect', '反思自身能力、原灵与独立后果的区别', '1行动 · 三案报告后 · G扮演+25', { type: 'REFLECT' });
  if (sh.kitPurchasedWeek === null) add('black-knight-shade-kit', '购买可选独立阴影的唯一原工具包', '180便士 · 1行动 · 原封桶、两枚捕获封条与一枚紧急封条', { type: 'BUY_SHADE_KIT' });
  if (sh.status === 'NOT_CREATED' && sh.kitPurchasedWeek !== null) {
    if (sh.playerNode === 'OUTSIDE') add('black-knight-shade-enter', '带原工具包沿原门实际走入两米', '0行动 · 2米 · 导师留在门外 · 尚不生成', { type: 'ENTER_SHADE_ROOM' });
    else {
      add('black-knight-shade-spawn', '确认分出真实、不受控制的独立堕落阴影', '1行动 · 5灵性 · 5精神 · 原灯会被自主熄灭 · 不是宠物或人格净化', { type: 'SPAWN_SHADE', confirmed: true, acknowledgedUrge: BLACK_KNIGHT_SHADE_URGE });
      add('black-knight-shade-return-unused', '未生成，沿原门实际走回两米', '0行动 · 普通步行 · 原物保留', { type: 'RETURN_SHADE_ROUTE' });
    }
  }
  if (sh.status === 'LOOSE') {
    add('black-knight-shade-capture', '用同一原空桶与一枚剩余原封条捕获', '1行动 · 3灵性 · 知识18 · 失败封条照耗、灯罩破损、精神−3最低1', { type: 'CAPTURE_SHADE' });
    add('black-knight-shade-exit', '沿原普通出口走出两米，再耗紧急封条永久隔离', '0行动 · 原门必须净空 · 同一独立生物留在永久隔离原房间', { type: 'SHADOW_EXIT' });
  }
  if (sh.status === 'SEALED') add(sh.playerNode === 'ROOM' ? 'black-knight-shade-return' : 'black-knight-shade-handoff', sh.playerNode === 'ROOM' ? '携同一原封桶沿普通门实际走出两米' : '把同一原封桶交给门外伊森带往BK4-STORE', '0行动 · 同一生物仍在原桶 · 实际退出后交接', sh.playerNode === 'ROOM' ? { type: 'RETURN_SHADE_ROUTE' } : { type: 'HANDOFF_SHADE' });
  return actions;
}
export function projectBlackKnightLife(s: SliceState): BlackKnightLifeProjection {
  if (!promoted(s)) return { cases: [], insideCase: false, environment: '', practice: null, shade: null };
  const l = s.blackKnight.life, sh = l.shade;
  return {
    insideCase: hasBlackKnightLifeLock(s), environment: BLACK_KNIGHT_LIFE_ENVIRONMENT,
    cases: CASES.map(spec => { const r = l.cases[spec.id], attempt = last(r); return {
      id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [...spec.facts], status: r.status, closes: r.closes,
      preparation: r.status === 'PREPARED' ? `${r.method === 'ABILITY' ? '来源明确的有限能力' : '普通方法'}已准备；原物没有因准备移动，实施另耗1行动${r.method === 'ABILITY' ? `与${caseCost(spec.id)}灵性` : '，0灵性'}。` : null,
      result: attempt ? `第${attempt.week}周${attempt.method === 'ABILITY' ? '能力' : '普通'}实施${attempt.success ? '成功' : '失败'}；真实尝试${r.attempts.length}次。${attempt.spiritId ? `只借当时已选的同一${attempt.spiritId}轻触术，旧灵不复制。` : ''}` : null,
      contactOpen: r.contactOpen ? '现场仍开放，先0行动实际返回与收束；不能靠报告传送或重置原物。' : '原现场已关闭或尚未实施，可按当前实际条件生活与跨周。',
    }; }),
    practice: {
      shadow: `同一${l.shadow.lampId}：${l.shadow.lampLit ? '亮' : '灭'}；成年文森的原影距2米，本次同意${l.shadow.consented ? '已核对' : '待核对'}；原影${l.shadow.bound ? '正在60秒G有限约束' : '没有持续约束'}，已实际解除${l.shadow.releases}次。`,
      panel: `同一${l.panel.id}：真实灵刃切口${l.panel.cuts}、普通刻痕${l.panel.notches}，损伤永久保留；${l.panel.clubId}/${l.panel.handToolId}在${l.panel.toolLocation}；灵刃${l.panel.bladeActive ? '待实际结束' : '已结束或未开始'}，原板后无人。`,
      card: `同一${l.card.id}在${l.card.location}，本人在${l.card.playerNode}；${l.card.borrowing ? '本次借用待收束' : '没有本次持续借用'}。当前驱使者仍是${s.shepherd.grazing.activeSpiritId ?? '无'}，一次只有一位原灵；旧释放历史不改变。`,
      route: `原卡路线本人累计${l.card.walks}段、${l.card.distanceMetres}米；原阴影房间本人累计${sh.playerWalks}段、${sh.playerDistanceMetres}米。所有返回都是普通实际步行。`,
      history: BLACK_KNIGHT_CASE_IDS.map(id => `${id}：准备${l.cases[id].preparations}，实施${l.cases[id].attempts.length}，取消${l.cases[id].withdrawals}，真实收束${l.cases[id].closes}；报告${l.cases[id].status === 'RESOLVED' ? '完成' : '未完成'}。`),
    },
    shade: {
      status: sh.status,
      room: `原灯房间${sh.roomStatus}；原普通EXIT门${sh.ordinaryDoor}；INNER_DOOR另是一扇内门。原灯${l.shadow.lampLit ? '亮' : '灭'}，同一玻璃灯罩${sh.glassHood}。${sh.roomStatus === 'QUARANTINED' ? '永久隔离，原房间不再开放；相邻原板与原卡实践可继续。' : '导师在门外，房间没有其他人。'}`,
      creature: sh.creatureId ? `同一${sh.creatureId}：${sh.status}，位置${sh.creatureLocation}；独立、不受控制，自主实际走过${sh.creatureDistanceMetres}米。${sh.status === 'ISOLATED' ? '仍留在同一原房间，未被消灭。' : sh.status === 'TAKEN_AWAY' ? '仍在同一原桶中，被导师实际带往BK4-STORE。' : '没有命令它攻击、跟随或清除人格的操作。'}` : '尚未生成任何阴影生物，也没有免费随从。',
      kit: sh.kitPurchasedWeek === null ? '唯一一套原物尚未购买。' : `同一${sh.caskId}：${sh.caskStatus}，位置${sh.caskLocation}；捕获封条${sh.captureSeals.map(x => `${x.id}${x.consumed ? '已耗' : '未耗'}`).join('、')}；${sh.emergencySealId}${sh.emergencySealUsed ? '已耗' : '未耗'}。`,
      route: `本人${sh.playerNode}，沿原普通两米门路实际行走${sh.playerWalks}次共${sh.playerDistanceMetres}米；实际交接原桶${sh.handoffs}次。捕获不自动退出，退出不自动交接。`,
      cost: `原创G：工具包180便士1行动；生成1行动5灵性5精神；捕获每次1行动3灵性并耗一枚原封条，最多2次；实际捕获尝试${sh.captureAttempts.length}次，失败${sh.captureAttempts.filter(x => !x.success).length}次。所有退出、返回、交接0行动。`,
      warning: `生成须独立确认角色本次冲动“${BLACK_KNIGHT_SHADE_URGE}”。真实独立生物不是宠物，不受你控制；原灯会被熄灭，失败可能损坏原灯罩。没有人格净化、治愈或清空污染。此项可完全跳过，三案仍能完成100扮演。`,
    },
  };
}

/** Exact original identities and finite attempts are saved, including both irreversible shade endings. */
export function validateBlackKnightLife(s: SliceState): boolean {
  try {
    const l = s.blackKnight.life, start = s.blackKnight.promotionWeek ?? s.week;
    if (!record(l) || !shape(l, ['cases', 'reflected', 'shadow', 'panel', 'card', 'shade']) || !record(l.cases) || !shape(l.cases, BLACK_KNIGHT_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
    if (s.blackKnight.promotionWeek === null) return stableStringify(l) === stableStringify(createBlackKnightLifeState());
    let open = 0, prepared = 0, resolved = 0;
    for (const [i, id] of BLACK_KNIGHT_CASE_IDS.entries()) {
      const r = l.cases[id];
      if (!record(r) || !shape(r, ['status', 'method', 'contactOpen', 'preparations', 'withdrawals', 'closes', 'attempts']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || ![r.preparations, r.withdrawals, r.closes].every(x => integer(x)) || !Array.isArray(r.attempts)) return false;
      let prev = start - 1;
      for (const [n, attempt] of r.attempts.entries()) {
        if (!record(attempt) || !shape(attempt, ['week', 'method', 'success', 'spiritId']) || !integer(attempt.week, Math.max(start, prev + 1), s.week) || !['ABILITY', 'ORDINARY'].includes(attempt.method) || typeof attempt.success !== 'boolean' || attempt.spiritId !== (id === 'one-spirit-account' && attempt.method === 'ABILITY' ? 'SH5-IRIS-1' : null) || attempt.success && n !== r.attempts.length - 1) return false;
        prev = attempt.week;
      }
      const tail = last(r);
      if (r.closes !== r.attempts.length - Number(r.contactOpen) || r.preparations !== r.attempts.length + r.withdrawals + Number(r.status === 'PREPARED') || r.contactOpen && !tail || r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(emptyCase())) return false;
      if (completed(r) !== (tail?.success ?? false) || (r.status === 'PREPARED' || completed(r) || r.contactOpen) && r.method === null || (completed(r) || r.contactOpen) && r.method !== tail?.method || (r.status === 'OBSERVED' || r.status === 'AVAILABLE') && !r.contactOpen && r.method !== null || r.status === 'RESOLVED' && r.contactOpen) return false;
      if (i > 0 && r.status !== 'AVAILABLE' && l.cases[BLACK_KNIGHT_CASE_IDS[i - 1]!].status !== 'RESOLVED') return false;
      if (s.seer.completedSources.filter(x => x === sourceFor(id)).length !== Number(r.status === 'RESOLVED')) return false;
      open += Number(r.contactOpen); prepared += Number(r.status === 'PREPARED'); resolved += Number(r.status === 'RESOLVED');
    }
    if (open > 1 || prepared > 1 || open && prepared) return false;
    const shadow = l.shadow, panel = l.panel, card = l.card, sh = l.shade;
    const shadowCase = l.cases['shadow-boundary'], panelCase = l.cases['blade-panel'], cardCase = l.cases['one-spirit-account'];
    const shadowSuccess = shadowCase.attempts.filter(x => x.method === 'ABILITY' && x.success).length;
    if (!record(shadow) || !shape(shadow, ['lampId', 'lampLit', 'subjectId', 'consented', 'distanceMetres', 'bound', 'durationSeconds', 'releases']) || shadow.lampId !== 'BK4-LAMP-1' || typeof shadow.lampLit !== 'boolean' || shadow.subjectId !== 'VENSON' || shadow.consented !== (shadowCase.status !== 'AVAILABLE') || shadow.distanceMetres !== 2 || shadow.bound !== (shadowSuccess === 1 && shadowCase.contactOpen) || shadow.durationSeconds !== (shadow.bound ? 60 : 0) || shadow.releases !== shadowSuccess - Number(shadow.bound)) return false;
    if (!record(panel) || !shape(panel, ['id', 'clubId', 'handToolId', 'toolLocation', 'bladeActive', 'cuts', 'notches', 'clearBehind']) || panel.id !== 'BK4-PANEL-1' || panel.clubId !== 'BK4-DULL-CLUB-1' || panel.handToolId !== 'BK4-HAND-TOOL-1' || panel.toolLocation !== (panelCase.contactOpen ? 'PLAYER' : 'GUIDE') || panel.bladeActive !== (panelCase.contactOpen && panelCase.method === 'ABILITY') || panel.clearBehind !== true || panel.cuts !== panelCase.attempts.filter(x => x.success && x.method === 'ABILITY').length || panel.notches !== panelCase.attempts.filter(x => x.success && x.method === 'ORDINARY').length) return false;
    if (!record(card) || !shape(card, ['id', 'location', 'playerNode', 'walks', 'distanceMetres', 'borrowing']) || card.id !== 'BK4-CARD-1' || !['TABLE', 'MARK'].includes(card.location) || !['DESK', 'MARK'].includes(card.playerNode) || !integer(card.walks) || card.distanceMetres !== card.walks || card.borrowing !== (cardCase.contactOpen && cardCase.method === 'ABILITY')) return false;
    const previousCard = cardCase.contactOpen ? cardCase.attempts.slice(0, -1) : cardCase.attempts;
    const baseWalks = previousCard.reduce((sum, a) => sum + (a.method === 'ORDINARY' || a.success ? 2 : 0), 0), tailCard = last(cardCase);
    if (!cardCase.contactOpen || tailCard?.method === 'ABILITY' && !tailCard.success) {
      if (card.location !== 'TABLE' || card.playerNode !== 'DESK' || card.walks !== baseWalks) return false;
    } else if (card.location === 'MARK') {
      if (tailCard?.method === 'ABILITY' ? card.playerNode !== 'DESK' || card.walks !== baseWalks : card.playerNode !== 'MARK' || card.walks !== baseWalks + 1) return false;
    } else if (card.playerNode !== 'DESK' || card.walks !== baseWalks + 2) return false;
    if (!record(sh) || !shape(sh, ['kitPurchasedWeek', 'caskId', 'caskLocation', 'caskStatus', 'captureSeals', 'emergencySealId', 'emergencySealUsed', 'creatureId', 'status', 'creatureLocation', 'controlled', 'spawnWeek', 'acknowledgedUrge', 'captureAttempts', 'glassHood', 'lampExtinguished', 'creatureWalks', 'creatureDistanceMetres', 'playerNode', 'playerWalks', 'playerDistanceMetres', 'ordinaryDoor', 'roomStatus', 'handoffs']) || sh.controlled !== false || !['NOT_CREATED', 'LOOSE', 'SEALED', 'ISOLATED', 'TAKEN_AWAY'].includes(sh.status) || !Array.isArray(sh.captureSeals) || !Array.isArray(sh.captureAttempts) || sh.captureAttempts.length > 2 || !['OUTSIDE', 'ROOM'].includes(sh.playerNode) || !integer(sh.playerWalks) || sh.playerDistanceMetres !== sh.playerWalks * 2 || (sh.playerWalks % 2 === 1) !== (sh.playerNode === 'ROOM') || typeof sh.emergencySealUsed !== 'boolean') return false;
    const purchased = sh.kitPurchasedWeek !== null, spawned = sh.spawnWeek !== null, captured = sh.captureAttempts.some(x => x.success), failed = sh.captureAttempts.filter(x => !x.success).length;
    if (purchased && (!integer(sh.kitPurchasedWeek, start, s.week) || !completed(shadowCase) || shadowCase.contactOpen) || spawned && (!integer(sh.spawnWeek, sh.kitPurchasedWeek ?? start, s.week) || !purchased)) return false;
    if (sh.caskId !== (purchased ? 'BK4-CASK-1' : null) || sh.emergencySealId !== (purchased ? 'BK4-EXIT-SEAL-1' : null) || sh.captureSeals.length !== (purchased ? 2 : 0)) return false;
    if (!purchased && stableStringify(sh) !== stableStringify(createBlackKnightLifeState().shade)) return false;
    for (const [n, seal] of sh.captureSeals.entries()) if (!record(seal) || !shape(seal, ['id', 'consumed']) || seal.id !== `BK4-SEAL-${n + 1}` || seal.consumed !== (n < sh.captureAttempts.length)) return false;
    let previousCaptureWeek = sh.spawnWeek ?? start;
    for (const [n, a] of sh.captureAttempts.entries()) {
      if (!record(a) || !shape(a, ['week', 'sealId', 'success']) || !spawned || !integer(a.week, previousCaptureWeek, s.week) || a.sealId !== `BK4-SEAL-${n + 1}` || typeof a.success !== 'boolean' || a.success && n !== sh.captureAttempts.length - 1) return false;
      previousCaptureWeek = a.week;
    }
    if (sh.creatureId !== (spawned ? 'BK4-SHADE-1' : null) || sh.acknowledgedUrge !== (spawned ? BLACK_KNIGHT_SHADE_URGE : null) || sh.lampExtinguished !== spawned || shadow.lampLit === spawned || sh.glassHood !== (failed ? 'BROKEN' : 'INTACT') || sh.creatureWalks !== Number(spawned) + Number(failed > 0) || sh.creatureDistanceMetres !== Number(spawned) * 2 + Number(failed > 0)) return false;
    if ((sh.status !== 'NOT_CREATED') !== spawned || (sh.status === 'SEALED' || sh.status === 'TAKEN_AWAY') !== captured || sh.emergencySealUsed !== (sh.status === 'ISOLATED') || sh.ordinaryDoor !== (sh.status === 'ISOLATED' ? 'SEALED' : 'CLEAR') || sh.handoffs !== Number(sh.status === 'TAKEN_AWAY')) return false;
    const expectedRoom = sh.status === 'NOT_CREATED' ? 'AVAILABLE' : sh.status === 'ISOLATED' ? 'QUARANTINED' : sh.status === 'TAKEN_AWAY' ? 'CLEARED' : 'OCCUPIED';
    if (sh.roomStatus !== expectedRoom || sh.caskLocation !== (!purchased ? 'NONE' : sh.status === 'TAKEN_AWAY' ? 'BK4-STORE' : 'PLAYER') || sh.caskStatus !== (!purchased ? 'ABSENT' : sh.status === 'TAKEN_AWAY' ? 'HANDED_OVER' : sh.status === 'SEALED' ? 'SEALED' : 'EMPTY')) return false;
    const expectedLocation = !spawned ? 'NONE' : sh.status === 'TAKEN_AWAY' ? 'BK4-STORE' : sh.status === 'SEALED' ? 'CASK' : failed ? 'INNER_DOOR' : 'LAMP';
    if (sh.creatureLocation !== expectedLocation || spawned && sh.playerWalks < 1 || sh.status === 'LOOSE' && sh.playerNode !== 'ROOM' || (sh.status === 'ISOLATED' || sh.status === 'TAKEN_AWAY') && sh.playerNode !== 'OUTSIDE') return false;
    if ((sh.playerNode === 'ROOM' || sh.status === 'SEALED') && (open > 0 || prepared > 0) || hasBlackKnightLifeLock(s) && (s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || !!s.activeEvent || !!s.combat)) return false;
    if (s.seer.completedSources.filter(x => x === 'black-knight-shade-spawn').length !== Number(spawned) || s.seer.completedSources.filter(x => x === 'black-knight-reflection').length !== Number(l.reflected) || l.reflected && resolved !== 3) return false;
    return !promoted(s) || (s.progression.sequence===3?s.threeHeadedTemplar.blackKnightActingAtPromotion:s.progression.acting) === resolved * 25 + Number(l.reflected) * 25;
  } catch { return false; }
}
