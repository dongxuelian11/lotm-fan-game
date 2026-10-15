import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { oceanSingerInside } from '../ocean-singer/life.js';
import { windBlessedInside } from '../wind-blessed/life.js';
import type { CataclysmPriestAction } from './types.js';

export const CATACLYSM_PRIEST_RITUAL_PRICE = 420;
export const CATACLYSM_PRIEST_EXPERT_ID = 'CP4-ALMA';
export const CATACLYSM_PRIEST_RITUAL_BOUNDARY = '原著边界：引发地震与海啸，在其中服药并撑至结束。此为持照无人海湾中的有限原创G场景，完整布置、规模与时长未核；只推进本次真实岸边事件，不模拟任意城市灾害。上侧回阶是普通地形通路，高脊只在本场明确波及范围外，不是免灾结界。';
export const CATACLYSM_PRIEST_RITUAL_SOURCE = '原创G：贝克兰德外持照无人海湾；每次另付新原场地、新潮尺、新下步道与独立原包，工作人员预先清空边界，阿尔玛在高脊实际施行有限安排。旧场损坏永久保留，不免费修复或换名复活。';
export const CATACLYSM_PRIEST_RITUAL_CONSEQUENCE = '预约1行动420便士，下一真实周实际赴场1行动。原海水退去、地震裂尺毁路后才能独立饮药。饮药耗原瓶原包；两次持守各60秒各体质16，伤害大成功0/成功4/失败12/灾难25，无海浪保命下限。成功药效仍须撑至退潮才晋升。撤退沿上侧回阶真实走到高脊，原损失不返还，海潮继续结束；死亡留在原平台，不传送离场。';
export interface CataclysmPriestRitualPerson {
  id: string; name: string; age: number; adultAppearance: true; sequence: 4 | null;
  alive: boolean; willing: boolean; location: 'RIDGE' | 'PLATFORM' | 'AWAY';
}
export interface CataclysmPriestRitualKit {
  id: string; source: string; location: 'SUPPLIER' | 'PLATFORM' | 'MISSING';
  status: 'SEALED' | 'CONSUMED'; sealsIntact: boolean; consumedWeek: number | null;
}
export interface CataclysmPriestRitualSite {
  id: string; source: string; uninhabited: true; waterSource: 'SEAWATER';
  gaugeId: string; gauge: 'INTACT' | 'CRACKED' | 'BROKEN';
  walkwayId: string; lowerWalkway: 'INTACT' | 'DAMAGED' | 'WASHED_OUT';
  upperBackstairs: 'CLEAR'; sea: 'CALM' | 'DRAWDOWN' | 'FIRST_WAVE' | 'RECEDED';
  earthquakeOccurred: boolean; platformFlooded: boolean;
}
export type CataclysmPriestRitualPhase = 'BOOKED' | 'ENTERED' | 'CLEARED' | 'CHECKED' | 'SURGE' | 'DRUNK' | 'FIRST_WAVE' | 'ENDED' | 'ABORTED' | 'DEAD';
export interface CataclysmPriestRitualHazard {
  stage: 1 | 2; elapsedSeconds: 60 | 120; tier: PublicResolutionTier;
  healthBefore: number; healthDamage: number; healthAfter: number;
}
export interface CataclysmPriestRitualVisit {
  id: string; source: string; siteId: string; expertId: string; assistantIds: string[]; paidPennies: number;
  phase: CataclysmPriestRitualPhase; bookedWeek: number; plannedWeek: number; enteredWeek: number | null;
  checkedWeek: number | null; proceedConfirmed: boolean; quakeTriggeredWeek: number | null; windowWeek: number | null;
  closedWeek: number | null; elapsedSeconds: 0 | 60 | 120; rawOutcome: PublicResolutionTier | null;
  pendingBottleId: string | null; finishedSuccess: boolean; abortedReason: 'WITHDRAWN' | 'DIED' | null;
  kit: CataclysmPriestRitualKit; site: CataclysmPriestRitualSite; hazards: CataclysmPriestRitualHazard[];
}
export interface CataclysmPriestRitualState {
  playerLocation: 'OUTSIDE' | 'PLATFORM' | 'RIDGE'; activeVisitId: string | null;
  expert: CataclysmPriestRitualPerson; assistants: CataclysmPriestRitualPerson[]; visits: CataclysmPriestRitualVisit[];
}
export type CataclysmPriestRitualCommand =
  | { type: 'BOOK_RITUAL' | 'BEGIN_RITUAL' | 'CLEAR_COAST' | 'HOLD_POSITION' | 'END_RITUAL' | 'LEAVE_RITUAL' }
  | { type: 'CHECK_PREPARATION' | 'START_QUAKE'; confirmed: true };
export interface CataclysmPriestRitualVisitProjection extends CataclysmPriestRitualVisit { status: string; summary: string }
export interface CataclysmPriestRitualProjection {
  title: string; status: string; boundary: string; source: string; consequence: string; appointment: string;
  currentVisitId: string | null; playerLocation: string; windowOpen: boolean;
  expert: CataclysmPriestRitualPerson | null; assistants: CataclysmPriestRitualPerson[]; visits: CataclysmPriestRitualVisitProjection[];
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const tiers: PublicResolutionTier[] = ['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'];
const damage: Record<PublicResolutionTier, number> = { GREAT_SUCCESS: 0, SUCCESS: 4, FAILURE: 12, GREAT_FAILURE: 25 };
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const kitSource = (id: string) => `原创G独立原封装仪式包${id}，420便士本次费用内实际配置；完整组成未知，不提供现实配方。`;
const person = (id: string, name: string, age: number, sequence: 4 | null): CataclysmPriestRitualPerson => ({ id, name, age, sequence, adultAppearance: true, alive: true, willing: true, location: 'RIDGE' });
export function createCataclysmPriestRitualState(): CataclysmPriestRitualState {
  return { playerLocation: 'OUTSIDE', activeVisitId: null, visits: [], expert: person(CATACLYSM_PRIEST_EXPERT_ID, '阿尔玛·伦恩', 61, 4), assistants: [person('CP4-ORRIN', '奥林·戴尔', 44, null), person('CP4-MABEL', '梅布尔·基恩', 39, null)] };
}
function freshVisit(number: number, week: number): CataclysmPriestRitualVisit {
  const id = `CP4-SITE-${number}`, kitId = `CP4-KIT-${number}`;
  return {
    id: `CP4-RITUAL-${number}`, source: CATACLYSM_PRIEST_RITUAL_SOURCE, siteId: id, expertId: CATACLYSM_PRIEST_EXPERT_ID, assistantIds: ['CP4-ORRIN', 'CP4-MABEL'], paidPennies: 420,
    phase: 'BOOKED', bookedWeek: week, plannedWeek: week + 1, enteredWeek: null, checkedWeek: null, proceedConfirmed: false,
    quakeTriggeredWeek: null, windowWeek: null, closedWeek: null, elapsedSeconds: 0, rawOutcome: null, pendingBottleId: null, finishedSuccess: false, abortedReason: null,
    kit: { id: kitId, source: kitSource(kitId), location: 'SUPPLIER', status: 'SEALED', sealsIntact: true, consumedWeek: null },
    site: { id, source: CATACLYSM_PRIEST_RITUAL_SOURCE, uninhabited: true, waterSource: 'SEAWATER', gaugeId: `CP4-GAUGE-${number}`, gauge: 'INTACT', walkwayId: `CP4-WALKWAY-${number}`, lowerWalkway: 'INTACT', upperBackstairs: 'CLEAR', sea: 'CALM', earthquakeOccurred: false, platformFlooded: false }, hazards: [],
  };
}
export const currentCataclysmPriestVisit = (s: SliceState) => s.cataclysmPriest.ritual.visits.find(v => v.id === s.cataclysmPriest.ritual.activeVisitId);
export const hasCataclysmPriestRitualLock = (s: SliceState) => s.cataclysmPriest.ritual.playerLocation === 'PLATFORM' && s.status === 'ACTIVE';
function staffReady(s: SliceState, assistantLocation: 'RIDGE' | 'PLATFORM'): boolean {
  const r = s.cataclysmPriest.ritual;
  return r.expert.id === CATACLYSM_PRIEST_EXPERT_ID && r.expert.alive && r.expert.willing && r.expert.location === 'RIDGE'
    && r.assistants.length === 2 && r.assistants.every((p, i) => p.id === ['CP4-ORRIN', 'CP4-MABEL'][i] && p.alive && p.willing && p.location === assistantLocation);
}
function kitReady(v: CataclysmPriestRitualVisit, location: 'SUPPLIER' | 'PLATFORM'): boolean {
  return v.kit.id === v.id.replace('RITUAL', 'KIT') && v.kit.source === kitSource(v.kit.id) && v.kit.status === 'SEALED' && v.kit.sealsIntact && v.kit.location === location && v.kit.consumedWeek === null;
}
export function canConsumeCataclysmPriestRitual(s: SliceState): boolean {
  const v = currentCataclysmPriestVisit(s);
  return !!v && s.status === 'ACTIVE' && s.world.city === 'BACKLUND' && s.progression.pathwayId === 'tyrant' && s.progression.sequence === 5 && s.cataclysmPriest.guidanceKnown
    && !s.activeEvent && !s.combat && s.cataclysmPriest.ritual.playerLocation === 'PLATFORM' && staffReady(s, 'RIDGE')
    && v.phase === 'SURGE' && v.enteredWeek === s.week && v.checkedWeek === s.week && v.quakeTriggeredWeek === s.week && v.windowWeek === s.week && v.proceedConfirmed
    && v.site.earthquakeOccurred && v.site.sea === 'DRAWDOWN' && v.elapsedSeconds === 0 && v.pendingBottleId === null && v.rawOutcome === null && kitReady(v, 'PLATFORM');
}
/** Called only after the actual raw roll and same original bottle have been recorded. No promotion here. */
export function recordCataclysmPriestRitualDrink(s: SliceState, bottleId: string): void {
  rule(canConsumeCataclysmPriestRitual(s), '须在本次实际地震海啸窗口服药。');
  const v = currentCataclysmPriestVisit(s)!, b = s.cataclysmPriest.bottles.find(item => item.id === bottleId);
  rule(b && b.status === 'CONSUMED' && b.consumedWeek === s.week && b.ritualId === v.id && b.ritualWindowWeek === s.week && tiers.includes(b.outcome!), '须同一原瓶已真实耗尽并记录本场原始结果。');
  v.pendingBottleId = bottleId; v.rawOutcome = b.outcome; v.phase = 'DRUNK';
  v.kit.status = 'CONSUMED'; v.kit.sealsIntact = false; v.kit.consumedWeek = s.week;
}
export function validateCataclysmPriestRitualCommand(v: unknown): v is CataclysmPriestRitualCommand {
  if (!record(v)) return false;
  if (v.type === 'CHECK_PREPARATION' || v.type === 'START_QUAKE') return shape(v, ['type', 'confirmed']) && v.confirmed === true;
  return ['BOOK_RITUAL', 'BEGIN_RITUAL', 'CLEAR_COAST', 'HOLD_POSITION', 'END_RITUAL', 'LEAVE_RITUAL'].includes(String(v.type)) && shape(v, ['type']);
}
export const isCataclysmPriestRitualCommand = validateCataclysmPriestRitualCommand;
export function blockCataclysmPriestRitualCommand(s: SliceState, command: CataclysmPriestRitualCommand): string | null {
  if (!validateCataclysmPriestRitualCommand(command)) return '仪式命令无效，核验与引发地震须分别明确确认。';
  const v = currentCataclysmPriestVisit(s);
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '本人须仍活着且能够行动；死亡不能沿路离场。';
  if (command.type === 'LEAVE_RITUAL') return v && v.phase !== 'ENDED' ? null : '没有可取消或中止的本次仪式；结束后须实际离场。';
  if (command.type === 'END_RITUAL') return v?.phase === 'ENDED' && s.cataclysmPriest.ritual.playerLocation === 'PLATFORM' ? null : '须先真实撑过两阶段至退潮，或选择中途撤退。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人在贝克兰德外这处真实近岸。';
  if (s.progression.pathwayId !== 'tyrant' || s.progression.sequence !== 5 || !s.cataclysmPriest.guidanceKnown || s.oceanSinger.promotionWeek === null) return '须成为海洋歌者并了解本次灾难主祭准备。';
  if (oceanSingerInside(s) || windBlessedInside(s)) return '先实际结束旧现场、返回原码头及停止旧效果。';
  if (command.type === 'HOLD_POSITION') return v && ['DRUNK', 'FIRST_WAVE'].includes(v.phase) && s.cataclysmPriest.ritual.playerLocation === 'PLATFORM' && v.enteredWeek === s.week && v.pendingBottleId !== null ? null : '须已在本场实际饮药，仍在原平台且危险阶段未结束。';
  if (!staffReady(s, command.type === 'CLEAR_COAST' ? 'PLATFORM' : 'RIDGE')) return '原阿尔玛与两名原助手须当前存活、自愿并在实际所需位置；不能以历史约定召回、复活或强迫。';
  if (command.type === 'BOOK_RITUAL') {
    if (v) return '先取消当前预约或完成本场实际退出。';
    if (!s.cataclysmPriest.bottles.some(b => b.status === 'PLAYER')) return '先实际取得一瓶灾难主祭原瓶。';
    if (s.actionsRemaining < 1) return '本次独立场地与新原包预约需要1行动。';
    return s.cash < 420 ? '预约需要420便士，取消或失败不退款。' : null;
  }
  if (!v) return '先付费预约本次新原场地与新原包。';
  if (command.type === 'BEGIN_RITUAL') {
    if (v.phase !== 'BOOKED') return '本场已实际进入，不能重复刷新。';
    if (s.week < v.plannedWeek) return `须等下一真实周，第${v.plannedWeek}周起赴场。`;
    if (!kitReady(v, 'SUPPLIER')) return '本次独立原包须实际在供应方且封条完好。';
    if (!s.cataclysmPriest.bottles.some(b => b.status === 'PLAYER')) return '须仍实际持有未用原瓶。';
    return s.actionsRemaining < 1 ? '本人沿原路赴场及原人员准备需要1行动。' : null;
  }
  if (s.cataclysmPriest.ritual.playerLocation !== 'PLATFORM' || v.enteredWeek !== s.week || !kitReady(v, 'PLATFORM')) return '本人须本周仍在原平台，原包当前在场完好。';
  if (command.type === 'CLEAR_COAST') return v.phase === 'ENTERED' ? null : '须刚实际赴场，尚未撤离两名助手。';
  if (command.type === 'CHECK_PREPARATION') return v.phase === 'CLEARED' ? null : '先使两名助手实际沿上侧回阶退至高脊。';
  return v.phase === 'CHECKED' && v.checkedWeek === s.week && v.proceedConfirmed ? null : '先明确核验当前人员、原包、无人边界及环境损毁风险。';
}
/** Event clock continues at the same original site, even after withdrawal or death. */
function finishSea(v: CataclysmPriestRitualVisit): void {
  if (!v.site.earthquakeOccurred) return;
  v.site.gauge = 'BROKEN'; v.site.lowerWalkway = 'WASHED_OUT'; v.site.platformFlooded = true; v.site.sea = 'RECEDED'; v.elapsedSeconds = 120;
}
export function applyCataclysmPriestRitualCommand(s: SliceState, command: CataclysmPriestRitualCommand, c: SeerContext): void {
  const blocked = blockCataclysmPriestRitualCommand(s, command); rule(blocked === null, blocked ?? '当前不能继续本次仪式。');
  const r = s.cataclysmPriest.ritual;
  if (command.type === 'BOOK_RITUAL') {
    const v = freshVisit(r.visits.length + 1, s.week); s.actionsRemaining -= 1; s.cash -= 420; r.visits.push(v); r.activeVisitId = v.id;
    c.note('付费预约新的原海湾场地', `1行动420便士，第${v.plannedWeek}周起本人亲赴${v.siteId}。独立${v.kit.id}留供应方，新潮尺与下步道属于本场；旧原件不修复、不复用。预约期间可以普通生活。`); return;
  }
  const v = currentCataclysmPriestVisit(s)!;
  if (command.type === 'BEGIN_RITUAL') {
    s.actionsRemaining -= 1; r.playerLocation = 'PLATFORM'; v.phase = 'ENTERED'; v.enteredWeek = s.week; v.kit.location = 'PLATFORM';
    for (const p of r.assistants) p.location = 'PLATFORM';
    c.note('本人及原助手沿普通道路赴原平台', `1行动，实际到${v.siteId}。当前活着自愿的两名原助手从高脊走到平台准备${v.kit.id}，阿尔玛仍在高脊。尚未清空海岸，不可引发地震；可沿上侧回阶立即离开。`); return;
  }
  if (command.type === 'CLEAR_COAST') {
    for (const p of r.assistants) p.location = 'RIDGE'; v.phase = 'CLEARED';
    c.note('两名原助手实际退至高脊', '0行动，奥林与梅布尔自愿沿仍通畅上侧回阶走到高脊观察位；这段普通移动确实发生。无人海湾边界已清空，玩家仍在平台，未触发地震。'); return;
  }
  if (command.type === 'CHECK_PREPARATION') {
    v.phase = 'CHECKED'; v.checkedWeek = s.week; v.proceedConfirmed = true;
    c.note('确认原人、原物与真实环境损伤风险', `0行动，原人员当前在高脊，${v.kit.id}在平台且封条完整；本人确认本次原尺、原下步道将受损。核验不引发灾害、不替代下一次启动确认或独立服药确认。${CATACLYSM_PRIEST_RITUAL_BOUNDARY}`); return;
  }
  if (command.type === 'START_QUAKE') {
    v.phase = 'SURGE'; v.quakeTriggeredWeek = s.week; v.windowWeek = s.week; v.site.earthquakeOccurred = true;
    v.site.gauge = 'CRACKED'; v.site.lowerWalkway = 'DAMAGED'; v.site.sea = 'DRAWDOWN';
    c.note('真实地震损坏原物，近岸海水开始退去', `0行动，阿尔玛在原高脊实施有限G安排；${v.site.gaugeId}实际裂开，${v.site.walkwayId}实际损坏。第一波到来前的当前窗口可独立饮一原瓶；不获得晋升或时间停止。之后每次持守推进60秒，也可立即沿上侧回阶撤离。`); return;
  }
  if (command.type === 'HOLD_POSITION') {
    const stage: 1 | 2 = v.phase === 'DRUNK' ? 1 : 2, result = c.check('physique', 16), before = s.health;
    s.health = Math.max(0, s.health - damage[result.tier]);
    v.hazards.push({ stage, elapsedSeconds: stage === 1 ? 60 : 120, tier: result.tier, healthBefore: before, healthDamage: before - s.health, healthAfter: s.health });
    v.elapsedSeconds = stage === 1 ? 60 : 120; v.site.gauge = 'BROKEN'; v.site.lowerWalkway = 'WASHED_OUT'; v.site.platformFlooded = true;
    v.site.sea = stage === 1 ? 'FIRST_WAVE' : 'RECEDED'; v.phase = stage === 1 ? 'FIRST_WAVE' : 'ENDED';
    if (s.health <= 0) { s.status = 'DEAD'; v.phase = 'DEAD'; v.closedWeek = s.week; v.abortedReason = 'DIED'; r.activeVisitId = null; finishSea(v); }
    c.note(s.health <= 0 ? '在原平台被真实海浪夺去生命' : stage === 1 ? '第一波实际覆盖平台，仍须撑至退潮' : '回浪经过，真实海潮终于退去', `0行动但实际经过60秒；体质${result.roll}/${result.chance}，${result.tier}，健康${before}→${s.health}。原${v.site.gaugeId}折断，原${v.site.walkwayId}冲毁，不随结束复原。${s.health <= 0 ? '药物监督不保护海浪。死亡留在原平台；海潮仍实际退去，未晋升、未传送或复活。' : stage === 1 ? '本人仍在原平台，可实际撤往高脊或继续第二次持守；药效结果仍是暂定。' : '本人活着撑到第120秒，是否晋升仅取决于本场原始药效成功与这两次真实生存记录；随后仍须沿原阶走出。'}`); return;
  }
  if (command.type === 'END_RITUAL') {
    v.closedWeek = s.week; r.activeVisitId = null; r.playerLocation = 'RIDGE';
    c.note('退潮后沿上侧原阶实际走到高脊', '0行动，实际离开平台；已发生的原瓶原包消耗、伤势与原环境破坏保留，不退钱、不补灵性、不修旧物。'); return;
  }
  const entered = v.enteredWeek !== null;
  if (entered) { r.playerLocation = 'RIDGE'; for (const p of r.assistants) if (p.location === 'PLATFORM' && p.alive && p.willing) p.location = 'RIDGE'; }
  finishSea(v); v.phase = 'ABORTED'; v.closedWeek = s.week; v.abortedReason = 'WITHDRAWN'; r.activeVisitId = null;
  c.note(entered ? '沿上侧回阶实际撤至高脊' : '取消本次付费预约', `0行动，${entered ? '本人实际步行到本场波及范围外的高脊' : '本人未曾入场，原包仍在供应方'}。${v.site.earthquakeOccurred ? '海潮没有被取消：剩余真实阶段继续至120秒退潮，原潮尺折断、下步道冲毁；本人已不在波及区，故没有平台检定。' : '尚未引发地震，原环境保持未损。'}原瓶、原包、420便士及已受伤害不回退；原始药效${v.rawOutcome ?? '未服药'}不构成晋升，仍须以后另付新场新包并等下一真实周。`);
}
const phaseLabel: Record<CataclysmPriestRitualPhase, string> = { BOOKED: '已预约，等待真实赴场', ENTERED: '本人和助手在平台，尚未清场', CLEARED: '助手已实际退至高脊', CHECKED: '已核验，尚未引发地震', SURGE: '真实地震后海水退去，可独立服药', DRUNK: '原药已耗，须撑过第一波', FIRST_WAVE: '第一波已过，仍须撑过回浪', ENDED: '真实退潮，仍须实际走出', ABORTED: '已实际撤离或取消，原损失保留', DEAD: '本人死于原平台，原海潮已结束' };
export function cataclysmPriestRitualActions(s: SliceState): CataclysmPriestAction[] {
  if (!s.cataclysmPriest.guidanceKnown) return [];
  const v = currentCataclysmPriestVisit(s), actions: CataclysmPriestAction[] = [];
  const add = (id: string, label: string, cost: string, command: CataclysmPriestRitualCommand) => { const reason = blockCataclysmPriestRitualCommand(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (!v && s.progression.pathwayId === 'tyrant' && s.progression.sequence === 5) add('book-cataclysm-priest-ritual', '预约本次新原海湾、新原包与原专家', '1行动 · 420便士 · 下一真实周赴场', { type: 'BOOK_RITUAL' });
  if (v?.phase === 'BOOKED') add('begin-cataclysm-priest-ritual', '沿原路实际赴海湾平台', `1行动 · 第${v.plannedWeek}周起`, { type: 'BEGIN_RITUAL' });
  if (v?.phase === 'ENTERED') add('clear-cataclysm-priest-coast', '请两名原助手实际撤至高脊', '0行动 · 普通移动 · 玩家仍在平台', { type: 'CLEAR_COAST' });
  if (v?.phase === 'CLEARED') add('check-cataclysm-priest-preparation', '核验当前人、原包与环境损毁风险', '0行动 · 明确确认 · 尚未触发灾害', { type: 'CHECK_PREPARATION', confirmed: true });
  if (v?.phase === 'CHECKED') add('start-cataclysm-priest-quake', '确认引发本场真实地震与海啸', '0行动 · 原潮尺裂开 · 原下步道损坏', { type: 'START_QUAKE', confirmed: true });
  if (v && ['DRUNK', 'FIRST_WAVE'].includes(v.phase)) add('hold-cataclysm-priest-position', v.phase === 'DRUNK' ? '留在原平台，撑过第一波' : '留在原平台，撑过回浪至退潮', '0行动 · 真实60秒 · 体质16 · 伤害0/4/12/25 · 可真实死亡', { type: 'HOLD_POSITION' });
  if (v) add('leave-cataclysm-priest-ritual', v.phase === 'ENDED' ? '退潮后沿上侧原阶实际离场' : v.phase === 'BOOKED' ? '取消本次预约' : '沿上侧原阶撤至高脊，放弃本次晋升', '0行动 · 不退费用、原瓶、原包或环境损失', { type: v.phase === 'ENDED' ? 'END_RITUAL' : 'LEAVE_RITUAL' });
  return actions;
}
export function projectCataclysmPriestRitual(s: SliceState): CataclysmPriestRitualProjection {
  const known = s.cataclysmPriest.guidanceKnown, r = s.cataclysmPriest.ritual, v = known ? currentCataclysmPriestVisit(s) : undefined;
  return {
    title: '地震海啸中实际服药并撑至结束', status: !known ? '尚未了解灾难主祭仪式' : v ? phaseLabel[v.phase] : '没有当前仪式，旧原场地与旧原包不复用',
    boundary: known ? CATACLYSM_PRIEST_RITUAL_BOUNDARY : '', source: known ? CATACLYSM_PRIEST_RITUAL_SOURCE : '', consequence: known ? CATACLYSM_PRIEST_RITUAL_CONSEQUENCE : '',
    appointment: v ? `第${v.bookedWeek}周支付420便士，第${v.plannedWeek}周起到${v.siteId}；${v.enteredWeek === null ? '尚未实际赴场' : `第${v.enteredWeek}周实际进入`}。` : '没有当前预约。',
    currentVisitId: v?.id ?? null, playerLocation: r.playerLocation, windowOpen: known && canConsumeCataclysmPriestRitual(s), expert: known ? { ...r.expert } : null, assistants: known ? r.assistants.map(p => ({ ...p })) : [],
    visits: known ? r.visits.map(value => ({ ...structuredClone(value), status: phaseLabel[value.phase], summary: `${value.siteId}，实际时间${value.elapsedSeconds}/120秒。${value.pendingBottleId ? `原瓶${value.pendingBottleId}、原包${value.kit.id}已耗；原始药效${value.rawOutcome}，${value.finishedSuccess ? '撑至退潮后已完成晋升' : value.phase === 'DRUNK' || value.phase === 'FIRST_WAVE' ? '只是暂定，尚未晋升' : '未完成晋升'}` : '尚未服药'}。原尺${value.site.gauge}，原下步道${value.site.lowerWalkway}，海水${value.site.sea}；历史损伤不会复原。` })) : [],
  };
}

function personValid(p: unknown, expected: CataclysmPriestRitualPerson): boolean {
  return record(p) && shape(p, ['id', 'name', 'age', 'adultAppearance', 'sequence', 'alive', 'willing', 'location']) && p.id === expected.id && p.name === expected.name && p.age === expected.age && p.adultAppearance === true && p.sequence === expected.sequence && typeof p.alive === 'boolean' && typeof p.willing === 'boolean' && ['RIDGE', 'PLATFORM', 'AWAY'].includes(String(p.location));
}
export function validateCataclysmPriestRitualState(s: SliceState): boolean {
  const raw: unknown = s.cataclysmPriest.ritual, base = createCataclysmPriestRitualState();
  if (!record(raw) || !shape(raw, ['playerLocation', 'activeVisitId', 'expert', 'assistants', 'visits']) || !['OUTSIDE', 'PLATFORM', 'RIDGE'].includes(String(raw.playerLocation)) || !personValid(raw.expert, base.expert) || !Array.isArray(raw.assistants) || raw.assistants.length !== 2 || !raw.assistants.every((p, i) => personValid(p, base.assistants[i]!)) || !Array.isArray(raw.visits)) return false;
  const r = raw as unknown as CataclysmPriestRitualState, week = (v: unknown) => integer(v, 1, s.week);
  if (r.visits.length && (!s.cataclysmPriest.guidanceKnown || s.progression.pathwayId !== 'tyrant' || ![5, 4, 3, 2].includes(s.progression.sequence ?? 0))) return false;
  let active: CataclysmPriestRitualVisit | undefined;
  for (const [i, v] of r.visits.entries()) {
    const expected = freshVisit(i + 1, v.bookedWeek);
    if (!record(v) || !shape(v, Object.keys(expected)) || v.id !== expected.id || v.source !== expected.source || v.siteId !== expected.siteId || v.expertId !== expected.expertId || JSON.stringify(v.assistantIds) !== JSON.stringify(expected.assistantIds) || v.paidPennies !== 420 || !Object.hasOwn(phaseLabel, v.phase) || !week(v.bookedWeek) || v.plannedWeek !== v.bookedWeek + 1 || !Array.isArray(v.hazards)) return false;
    if (v.bookedWeek < (s.oceanSinger.promotionWeek ?? s.week) || s.cataclysmPriest.promotionWeek !== null && v.bookedWeek > s.cataclysmPriest.promotionWeek) return false;
    if (i > 0 && (r.visits[i - 1]!.closedWeek === null || r.visits[i - 1]!.closedWeek! > v.bookedWeek)) return false;
    if (!s.cataclysmPriest.bottles.some(b => week(b.acquiredWeek) && b.acquiredWeek! <= v.bookedWeek && (b.consumedWeek === null || b.consumedWeek >= v.bookedWeek))) return false;
    if (!record(v.kit) || !shape(v.kit, Object.keys(expected.kit)) || v.kit.id !== expected.kit.id || v.kit.source !== expected.kit.source || !['SUPPLIER', 'PLATFORM', 'MISSING'].includes(v.kit.location) || typeof v.kit.sealsIntact !== 'boolean') return false;
    if (!record(v.site) || !shape(v.site, Object.keys(expected.site)) || v.site.id !== expected.site.id || v.site.source !== expected.site.source || v.site.uninhabited !== true || v.site.waterSource !== 'SEAWATER' || v.site.gaugeId !== expected.site.gaugeId || v.site.walkwayId !== expected.site.walkwayId || v.site.upperBackstairs !== 'CLEAR') return false;
    const entered = v.enteredWeek !== null, terminal = v.phase === 'ABORTED' || v.phase === 'DEAD' || v.phase === 'ENDED' && v.closedWeek !== null;
    if (entered ? !week(v.enteredWeek) || v.enteredWeek! < v.plannedWeek || v.phase === 'BOOKED' : !['BOOKED', 'ABORTED'].includes(v.phase)) return false;
    if (v.kit.location !== 'MISSING' && v.kit.location !== (entered ? 'PLATFORM' : 'SUPPLIER')) return false;
    if (terminal ? !week(v.closedWeek) || v.closedWeek! < v.bookedWeek || entered && v.closedWeek !== v.enteredWeek : v.closedWeek !== null) return false;
    if (!terminal) { if (active || i !== r.visits.length - 1) return false; active = v; if (entered && v.enteredWeek !== s.week) return false; }
    if (typeof v.proceedConfirmed !== 'boolean' || typeof v.finishedSuccess !== 'boolean' || ![0, 60, 120].includes(v.elapsedSeconds)) return false;
    if (['BOOKED', 'ENTERED', 'CLEARED', 'CHECKED', 'SURGE', 'DRUNK'].includes(v.phase) && v.elapsedSeconds !== 0 || v.phase === 'FIRST_WAVE' && v.elapsedSeconds !== 60 || v.phase === 'ENDED' && v.elapsedSeconds !== 120) return false;
    if (v.checkedWeek === null ? v.proceedConfirmed || !['BOOKED', 'ENTERED', 'CLEARED', 'ABORTED'].includes(v.phase) : !entered || v.checkedWeek !== v.enteredWeek || !v.proceedConfirmed || ['BOOKED', 'ENTERED', 'CLEARED'].includes(v.phase)) return false;
    const triggered = v.quakeTriggeredWeek !== null;
    if (triggered ? v.quakeTriggeredWeek !== v.checkedWeek || v.windowWeek !== v.quakeTriggeredWeek : v.windowWeek !== null || v.pendingBottleId !== null || !['BOOKED', 'ENTERED', 'CLEARED', 'CHECKED', 'ABORTED'].includes(v.phase)) return false;
    if (v.site.earthquakeOccurred !== triggered) return false;
    if (!triggered) {
      if (v.elapsedSeconds !== 0 || v.site.sea !== 'CALM' || v.site.gauge !== 'INTACT' || v.site.lowerWalkway !== 'INTACT' || v.site.platformFlooded !== false) return false;
    } else if (v.elapsedSeconds === 0) {
      if (!['SURGE', 'DRUNK'].includes(v.phase) || v.site.sea !== 'DRAWDOWN' || v.site.gauge !== 'CRACKED' || v.site.lowerWalkway !== 'DAMAGED' || v.site.platformFlooded !== false) return false;
    } else if (v.site.gauge !== 'BROKEN' || v.site.lowerWalkway !== 'WASHED_OUT' || v.site.platformFlooded !== true || v.site.sea !== (v.elapsedSeconds === 60 ? 'FIRST_WAVE' : 'RECEDED') || v.elapsedSeconds === 60 && v.phase !== 'FIRST_WAVE') return false;
    if (v.pendingBottleId === null) {
      if (v.rawOutcome !== null || v.kit.status !== 'SEALED' || v.kit.consumedWeek !== null || v.hazards.length !== 0 || v.finishedSuccess || ['DRUNK', 'FIRST_WAVE', 'ENDED', 'DEAD'].includes(v.phase)) return false;
    } else {
      const b = s.cataclysmPriest.bottles.find(b => b.id === v.pendingBottleId);
      if (!triggered || !b || b.status !== 'CONSUMED' || b.ritualId !== v.id || b.ritualWindowWeek !== v.windowWeek || b.consumedWeek !== v.enteredWeek || b.outcome !== v.rawOutcome || !tiers.includes(v.rawOutcome!) || v.kit.status !== 'CONSUMED' || v.kit.sealsIntact || v.kit.consumedWeek !== v.enteredWeek || v.kit.location !== 'PLATFORM') return false;
      if (!['DRUNK', 'FIRST_WAVE', 'ENDED', 'ABORTED', 'DEAD'].includes(v.phase)) return false;
    }
    if (v.hazards.length > 2) return false;
    for (const [n, h] of v.hazards.entries()) {
      if (!record(h) || !shape(h, ['stage', 'elapsedSeconds', 'tier', 'healthBefore', 'healthDamage', 'healthAfter']) || h.stage !== n + 1 || h.elapsedSeconds !== (n + 1) * 60 || !tiers.includes(h.tier) || !integer(h.healthBefore, 1, 100) || h.healthAfter !== Math.max(0, h.healthBefore - damage[h.tier]) || h.healthDamage !== h.healthBefore - h.healthAfter || n > 0 && h.healthBefore !== v.hazards[n - 1]!.healthAfter) return false;
    }
    if (v.phase === 'DRUNK' && v.hazards.length !== 0 || v.phase === 'FIRST_WAVE' && (v.hazards.length !== 1 || v.hazards[0]!.healthAfter <= 0) || v.phase === 'ENDED' && (v.hazards.length !== 2 || v.hazards[1]!.healthAfter <= 0 || v.elapsedSeconds !== 120)) return false;
    if (v.abortedReason !== (v.phase === 'ABORTED' ? 'WITHDRAWN' : v.phase === 'DEAD' ? 'DIED' : null)) return false;
    if (v.phase === 'DEAD' && (s.status !== 'DEAD' || s.health !== 0 || v.hazards.length === 0 || v.hazards.at(-1)!.healthAfter !== 0 || v.elapsedSeconds !== 120)) return false;
    if (v.phase === 'ABORTED' && (v.finishedSuccess || triggered && v.elapsedSeconds !== 120 || v.hazards.some(h => h.healthAfter <= 0))) return false;
    if (v.finishedSuccess !== (v.phase === 'ENDED' && (v.rawOutcome === 'SUCCESS' || v.rawOutcome === 'GREAT_SUCCESS'))) return false;
    if (v.finishedSuccess && (s.cataclysmPriest.promotionWeek !== v.enteredWeek || ![4,3,2].includes(s.progression.sequence??0))) return false;
  }
  if (r.activeVisitId !== (active?.id ?? null) || r.visits.length === 0 && r.playerLocation !== 'OUTSIDE') return false;
  const last = r.visits.at(-1);
  if (active && active.phase !== 'BOOKED') return r.playerLocation === 'PLATFORM' && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && s.world.city === 'BACKLUND' && !s.activeEvent && !s.combat;
  if (last?.phase === 'DEAD') return r.playerLocation === 'PLATFORM';
  return r.playerLocation !== 'PLATFORM';
}
