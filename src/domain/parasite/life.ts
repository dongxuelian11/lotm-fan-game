import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { ParasiteAbilityId } from './types.js';

export const PARASITE_CASE_IDS = ['shared-senses', 'limited-control', 'deferred-seat'] as const;
export type ParasiteCaseId = typeof PARASITE_CASE_IDS[number];
type HostCaseId = Exclude<ParasiteCaseId, 'deferred-seat'>;
export type ParasiteActivityCommand =
  | { type: 'OBSERVE'; caseId: ParasiteCaseId }
  | { type: 'PREPARE'; caseId: ParasiteCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW' | 'RETURN_TO_START'; caseId: ParasiteCaseId }
  | { type: 'CONSENT_BASIC'; caseId: HostCaseId; confirmed: true }
  | { type: 'CONSENT_FULL'; caseId: 'limited-control'; task: 'MOVE_TOKEN_AND_RETURN'; confirmed: true }
  | { type: 'WALK_ROUTE'; caseId: 'shared-senses' }
  | { type: 'TAKE_TOKEN' | 'RETURN_TOKEN'; caseId: 'limited-control' }
  | { type: 'EXIT_HOST'; caseId: HostCaseId }
  | { type: 'STEP_TO_CHAIR'; caseId: 'deferred-seat' }
  | { type: 'RELEASE_THOUGHT'; caseId: 'deferred-seat'; mode: 'EXECUTE' | 'DISCARD' }
  | { type: 'REFLECT' };
export interface ParasiteCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  method: 'ABILITY' | 'ORDINARY' | null;
  attemptWeek: number | null;
  attempts: number;
  withdrawals: number;
  closes: number;
  contactOpen: boolean;
  basicConsent: boolean;
  fullConsent: boolean;
  safetyReserved: boolean;
  checkedSuccess: boolean;
  taskComplete: boolean;
  lastOutcome: 'NONE' | 'SUCCESS' | 'FAILURE' | 'INTERRUPTED';
}
export interface ParasiteLifeState {
  cases: Record<ParasiteCaseId, ParasiteCaseState>;
  reflected: boolean;
  host: {
    id: 'PR4-THOMAS'; age: 34; location: 'DESK' | 'ROUTE_END';
    mode: 'NONE' | 'BASIC' | 'FULL'; awareness: 'AWARE';
    control: 'HOST' | 'BOUNDED_TOKEN_TASK'; exertion: number;
    token: 'DESK' | 'HOST_HAND'; tokenMoves: number; walks: number;
  };
  player: {
    presence: 'OUTSIDE' | 'INSIDE_HOST';
    location: 'DESK' | 'ROUTE_END' | 'CHAIR_FRONT';
    pose: 'STANDING' | 'SEATED'; entries: number; exits: number;
  };
  thought: {
    targetId: 'PR4-ALICE'; targetAge: 38; chairId: 'PR4-CHAIR-1';
    targetPose: 'STANDING' | 'SEATED'; targetPaused: boolean;
    pending: 'NONE' | 'SIT_ON_PR4_CHAIR_1';
    lastRelease: 'NONE' | 'EXECUTED' | 'DISCARDED';
    thefts: number; executions: number; discards: number; recoveries: number;
  };
  paidKits: number;
}
export interface ParasiteLifeAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ParasiteActivityCommand;
}
export interface ParasiteLifeProjection {
  cases: { id: ParasiteCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  insideCase: boolean;
  environment: string;
  practice: { host: string; consent: string; mode: string; location: string; awareness: string; control: string; token: string; thought: string; cost: string; history: string[] } | null;
}

const CASES = [
  { id: 'shared-senses', title: '同一双眼睛走过四米', story: '34岁的档案递送员托马斯·里德在艾德温·洛克的原练习室自愿参与一次有限接触。成年监督员艾琳·沃德在场；他本人从原桌沿原地面走到四米外标记，仍由他自己决定身体动作。人物、场地和安全协助均为原创G。', facts: ['浅层BASIC只共享宿主真实所见与所闻，不能读取或干涉隐藏内心；交流依靠宿主实际发声。', '准备与同意不会自动寄生。能力实施成功后才进入这位原宿主；只记录一个实际共享位置，外部没有另一个可操控玩家身体。', '宿主亲自走完四米；在终点分离仍在终点，之后必须实际走回原桌，不能用结束接触瞬移。'] },
  { id: 'limited-control', title: '只拿起并放回这一枚原木片', story: '托马斯另外面对自己的唯一木片PR4-TOKEN-1。浅层感官同意与这一次完全寄生的有限任务分开确认；没有完整同意也可以选择普通观察，由他自己拿起和放回原物。（原创G）', facts: ['BASIC同意不包含FULL。同意FULL只允许把托马斯原桌上的PR4-TOKEN-1拿到他自己的手里，再放回原桌。', '完全寄生有读取意图与控制身体的原著边界；本场只公开已说明的当前任务，不添加未表达的私人想法或长期控制权。', '始终只有同一具宿主、同一枚木片和同一物主；取回木片与监督分离都是真实步骤。'] },
  { id: 'deferred-seat', title: '现在偷取，稍后决定是否坐下', story: '38岁的艾莉丝·伍德在自己的唯一原椅PR4-CHAIR-1旁同意这一次念头试验。她只在实施时实际形成“现在坐上这把原椅”的念头；事前说明不是现成可偷取的思想。（原创G）', facts: ['成功只保存艾莉丝当下具体的坐下意图；她暂时停下，你仍站立，不触发旧窃梦家的同一行动立即执行。', '你可随后普通走到同一原椅前，再主动让已偷念头显现并坐下；必须确实空椅、她仍站立且你站在椅前。', '也可明确选择不执行而释放；这种有限放散、实际经过G十秒恢复决定与安全位置规则是原创G，不永久删除人格。'] },
] as const;
export const PARASITE_LIFE_ENVIRONMENT = '三项原创G有限实践。观察、准备、实施、报告各1行动；每项报告扮演25，三项后的反思25，普通方法也可和平100。寄生能力准备另付80便士给成年艾琳·沃德的本次安全包，提前留出监督分离容量；这不是原著通用驱离保证。能力实施4灵性、意志18，普通实施0灵性、知识10；失败成本保留，先实际收束，下一真实周再试。每次只开放有限原路线或一次取放任务，四米走路或一次取放各记1点实际劳动，累计保留；不模拟长期寄生，长期动物宿主可带来身份与生理影响的风险仍须警惕。没有天使分身、额外身体、远处装备操作或任意人物附身。';

const emptyCase = (): ParasiteCaseState => ({ status: 'AVAILABLE', method: null, attemptWeek: null, attempts: 0, withdrawals: 0, closes: 0, contactOpen: false, basicConsent: false, fullConsent: false, safetyReserved: false, checkedSuccess: false, taskComplete: false, lastOutcome: 'NONE' });
export function createParasiteLifeState(): ParasiteLifeState {
  return {
    cases: { 'shared-senses': emptyCase(), 'limited-control': emptyCase(), 'deferred-seat': emptyCase() }, reflected: false,
    host: { id: 'PR4-THOMAS', age: 34, location: 'DESK', mode: 'NONE', awareness: 'AWARE', control: 'HOST', exertion: 0, token: 'DESK', tokenMoves: 0, walks: 0 },
    player: { presence: 'OUTSIDE', location: 'DESK', pose: 'STANDING', entries: 0, exits: 0 },
    thought: { targetId: 'PR4-ALICE', targetAge: 38, chairId: 'PR4-CHAIR-1', targetPose: 'STANDING', targetPaused: false, pending: 'NONE', lastRelease: 'NONE', thefts: 0, executions: 0, discards: 0, recoveries: 0 }, paidKits: 0,
  };
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const shape = (x: Record<string, unknown>, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(x, k));
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const hostCase = (id: ParasiteCaseId): id is HostCaseId => id !== 'deferred-seat';
const promoted = (s: SliceState) => s.progression.pathwayId === 'error' && [4,3,2].includes(s.progression.sequence!);
export function validateParasiteActivityCommand(c: unknown): c is ParasiteActivityCommand {
  if (!record(c)) return false;
  if (c.type === 'REFLECT') return shape(c, ['type']);
  if (!PARASITE_CASE_IDS.includes(c.caseId as ParasiteCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  if (c.type === 'CONSENT_BASIC') return c.caseId !== 'deferred-seat' && shape(c, ['type', 'caseId', 'confirmed']) && c.confirmed === true;
  if (c.type === 'CONSENT_FULL') return c.caseId === 'limited-control' && shape(c, ['type', 'caseId', 'task', 'confirmed']) && c.task === 'MOVE_TOKEN_AND_RETURN' && c.confirmed === true;
  if (c.type === 'RELEASE_THOUGHT') return c.caseId === 'deferred-seat' && shape(c, ['type', 'caseId', 'mode']) && ['EXECUTE', 'DISCARD'].includes(c.mode as string);
  if (!shape(c, ['type', 'caseId'])) return false;
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'RETURN_TO_START'].includes(c.type as string)) return true;
  if (c.type === 'EXIT_HOST') return c.caseId !== 'deferred-seat';
  if (c.type === 'WALK_ROUTE') return c.caseId === 'shared-senses';
  if (['TAKE_TOKEN', 'RETURN_TOKEN'].includes(c.type as string)) return c.caseId === 'limited-control';
  return c.type === 'STEP_TO_CHAIR' && c.caseId === 'deferred-seat';
}
export function hasParasiteLifeLock(s: SliceState): boolean {
  const l = s.parasite.life;
  return Object.values(l.cases).some(r => r.contactOpen) || l.player.presence === 'INSIDE_HOST' || l.player.location !== 'DESK' || l.player.pose !== 'STANDING' || l.host.location !== 'DESK' || l.host.token !== 'DESK' || l.thought.pending !== 'NONE' || l.thought.targetPaused || l.thought.targetPose !== 'STANDING';
}
export function parasiteActivityReason(s: SliceState, c: ParasiteActivityCommand): string | null {
  if (!validateParasiteActivityCommand(c)) return '寄生者实践命令无效。';
  if (!promoted(s)||s.progression.sequence!==4) return '此处是原寄生者练习记录，当前阶段不重新开启。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.parasite.encounter.borrowed.some(power => power.closedSeconds === null)) return '先在原庭院明确归还或等到期收束暂窃能力，再开始新的生活事项。';
  if (s.world.city !== 'BACKLUND') return '需要留在贝克兰德原练习室，不能跨城分离或复位。';
  const l = s.parasite.life, h = l.host, p = l.player, t = l.thought, r = 'caseId' in c ? l.cases[c.caseId] : null;
  const thisOpen = r?.contactOpen === true;
  if (c.type === 'CLOSE') {
    if (!thisOpen) return '没有尚未结束的本次接触。';
    if (p.presence === 'INSIDE_HOST') return '先用已付安全包由艾琳监督实际分离。';
    if (h.token !== 'DESK') return '先把同一原木片放回原桌。';
    if (t.pending !== 'NONE') return '先明确选择显现或不执行释放已偷念头。';
    return p.location !== 'DESK' || h.location !== 'DESK' ? '先从实际当前位置普通走回原桌。' : null;
  }
  if (c.type === 'EXIT_HOST') return !thisOpen || p.presence !== 'INSIDE_HOST' ? '目前没有在这位原宿主体内。' : !r!.safetyReserved ? '没有本次已付监督分离容量。' : h.token !== 'DESK' ? '先放回原木片；这一步也不另收行动或灵性。' : null;
  if (c.type === 'RETURN_TOKEN') return thisOpen && h.token === 'HOST_HAND' ? null : '原木片不在托马斯手中。';
  if (c.type === 'RETURN_TO_START') return !thisOpen ? '没有本次实际接触。' : p.presence === 'INSIDE_HOST' ? '先在实际当前位置分离，再各自普通返回。' : p.location === 'DESK' && h.location === 'DESK' ? '双方已在原桌。' : t.pending !== 'NONE' ? '先决定已偷取念头的显现或不执行释放。' : null;
  if (c.type === 'RELEASE_THOUGHT') {
    if (!thisOpen || t.pending === 'NONE') return '没有保存中的真实坐下念头。';
    if (c.mode === 'DISCARD') return null;
    return p.presence !== 'OUTSIDE' || p.location !== 'CHAIR_FRONT' || p.pose !== 'STANDING' || t.targetPose !== 'STANDING' ? '必须本人实际站在空的PR4-CHAIR-1前，艾莉丝仍站在一侧。' : null;
  }
  if (c.type === 'STEP_TO_CHAIR') return thisOpen && t.pending !== 'NONE' && p.location === 'DESK' ? null : '只在保存本次坐下念头时普通走到原空椅前。';
  if (c.type === 'CONSENT_BASIC' || c.type === 'CONSENT_FULL') {
    if (!r || r.method !== 'ABILITY' || !['PREPARED', 'ACTIVE'].includes(r.status)) return '先准备这项能力方法。';
    if (Object.entries(l.cases).some(([id, other]) => other.contactOpen && id !== c.caseId)) return '先结束另一项实际接触。';
    if (c.type === 'CONSENT_BASIC') return r.basicConsent ? '本次浅层同意已确认。' : null;
    return r.fullConsent ? '本次有限取放任务的完整同意已单独确认。' : null;
  }
  if (c.type === 'WALK_ROUTE') return thisOpen && r!.status === 'ACTIVE' && p.presence === 'INSIDE_HOST' && h.mode === 'BASIC' && h.location === 'DESK' ? null : '需要本次浅层寄生成功、宿主仍在原桌且本次尚未走过路线。';
  if (c.type === 'TAKE_TOKEN') return !thisOpen || r!.status !== 'ACTIVE' || p.presence !== 'INSIDE_HOST' || h.mode !== 'BASIC' ? '需要本次浅层接触仍在进行。' : !r!.fullConsent ? 'BASIC不包括FULL；须独立确认唯一原木片取放任务。' : h.token !== 'DESK' || h.location !== 'DESK' ? '需要原桌上的唯一木片；本次只允许一次拿起并放回。' : null;
  if (hasParasiteLifeLock(s)) return '先实际结束当前接触、分离并返回原位置。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (Object.entries(l.cases).some(([id, other]) => other.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一项准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return l.reflected ? '已经完成反思。' : PARASITE_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r || r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场和有限边界已经观察。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.taskComplete && r.checkedSuccess && !r.contactOpen ? null : '先完成实际任务、恢复决定和位置，再报告。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原现场。' : r.attemptWeek === s.week ? '本周已实际尝试，下一真实周再准备。' : c.method === 'ABILITY' && hostCase(c.caseId) && s.cash < 80 ? '寄生准备需80便士预付本次安全包；普通方法不需要。' : null;
  if (c.type !== 'PERFORM' || r.status !== 'PREPARED') return '先准备本次方法。';
  if (r.attemptWeek === s.week) return '本周已实际尝试，下一真实周再试。';
  if (r.method === 'ABILITY' && hostCase(c.caseId) && (!r.basicConsent || !r.safetyReserved)) return '先明确本次BASIC同意并预付监督分离容量。';
  return r.method === 'ABILITY' && s.spirituality < 4 ? '实施需要4灵性；可0行动取消准备。' : null;
}

const sourceFor = (id: ParasiteCaseId) => `parasite-case:${id}`;
export function applyParasiteActivity(s: SliceState, c: ParasiteActivityCommand, ctx: SeerContext, award: (abilityId: ParasiteAbilityId, amount?: number) => void): void {
  const reason = parasiteActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.parasite.life, h = l.host, p = l.player, t = l.thought;
  if (c.type === 'REFLECT') {
    s.actionsRemaining -= 1; l.reflected = true; s.seer.completedSources.push('parasite-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('同意、单一身体与延后选择', '三项有限报告后的反思。浅层知觉不等于内心阅读，FULL同意不从BASIC推导；原物、当前位置与真正分离都必须保留。当前念头可以延后，不把无心智物体当来源。G扮演+25。'); return;
  }
  const r = l.cases[c.caseId], spec = CASES.find(item => item.id === c.caseId)!;
  if (c.type === 'CONSENT_BASIC') { r.basicConsent = true; ctx.note('单独确认BASIC同意', '托马斯本次只同意共享真实视听，保持清醒与自主身体控制；没有FULL授权，也没有立即进入。'); return; }
  if (c.type === 'CONSENT_FULL') { r.fullConsent = true; ctx.note('单独确认FULL有限任务', '托马斯另行明确同意本次将唯一PR4-TOKEN-1从自己的原桌拿到自己的手中并放回。此命令只保存该同意，不自动接管身体，不允许其他命令、永久控制或重复取物。'); return; }
  if (c.type === 'WITHDRAW') { r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1; r.basicConsent = false; r.fullConsent = false; r.safetyReserved = false; ctx.note('取消尚未实施的准备', '原观察与已付行动、安全包费用保留；没有发生进入、控制或念头偷取，本次同意结束。'); return; }
  if (c.type === 'WALK_ROUTE') { h.location = 'ROUTE_END'; p.location = 'ROUTE_END'; h.exertion += 1; h.walks += 1; r.status = 'EXAMINED'; r.taskComplete = true; ctx.note(spec.title, '托马斯本人沿真实地面走完四米，主动说出原窗口可见标记。你只共享他的真实视听；两者当前共同位置是四米终点，没有外部第二玩家身体，也没有读取隐藏想法。'); return; }
  if (c.type === 'TAKE_TOKEN') { h.mode = 'FULL'; h.control = 'BOUNDED_TOKEN_TASK'; h.token = 'HOST_HAND'; h.tokenMoves += 1; h.exertion += 1; ctx.note(spec.title, '在本次独立FULL同意内控制同一具托马斯身体，用他的原手拿起自己的唯一PR4-TOKEN-1。他清醒知情，当前身体控制仅限已说明的取放任务；物主仍是托马斯。'); return; }
  if (c.type === 'RETURN_TOKEN') { h.token = 'DESK'; h.tokenMoves += 1; h.exertion += 1; h.control = 'HOST'; if (h.mode === 'FULL') h.mode = 'BASIC'; r.fullConsent = false; r.taskComplete = r.checkedSuccess; if (r.checkedSuccess) r.status = 'EXAMINED'; ctx.note('同一原木片实际放回', '托马斯的原手把同一枚PR4-TOKEN-1放回原桌，有限FULL任务结束，身体控制回到本人；若仍浅层寄生，须另行监督分离。已付成本不返。'); return; }
  if (c.type === 'EXIT_HOST') { p.presence = 'OUTSIDE'; p.exits += 1; p.location = h.location; h.mode = 'NONE'; h.control = 'HOST'; r.basicConsent = false; r.fullConsent = false; r.safetyReserved = false; if (!r.taskComplete) { r.status = 'OBSERVED'; r.lastOutcome = 'INTERRUPTED'; } ctx.note('艾琳在当前位置监督分离', '消耗本次已付80便士安全包预留的原创G分离协助，不另收行动或灵性；你与托马斯实际结束寄生，玩家原有唯一身体状态在同一当前位置恢复，没有第二具活动身体或装备复制。这不是对任意寄生的原著驱离保证。当前位置：' + (p.location === 'ROUTE_END' ? '四米终点，仍须各自普通走回。' : '原桌旁。')); return; }
  if (c.type === 'STEP_TO_CHAIR') { p.location = 'CHAIR_FRONT'; ctx.note('普通走到唯一原椅前', '你从原桌旁沿地面普通走到一米外空的PR4-CHAIR-1前；艾莉丝仍在侧边站立，保存的念头尚未显现。'); return; }
  if (c.type === 'RELEASE_THOUGHT') { t.pending = 'NONE'; t.targetPaused = false; t.recoveries += 1; if (c.mode === 'EXECUTE') { t.executions += 1; t.lastRelease = 'EXECUTED'; p.pose = 'SEATED'; } else { t.discards += 1; t.lastRelease = 'DISCARDED'; } ctx.note('选择已偷念头的显现时机', (c.mode === 'EXECUTE' ? '你主动让先前保存的具体坐下念头现在显现，实际坐上空的同一PR4-CHAIR-1；这发生在偷取之后的另一步。' : '你选择不执行而放散这一次保存的念头，自己没有被迫坐下；这是明确标记的原创G安全释放。') + '本次已付场景实际经过G十秒，艾莉丝恢复该决定与自由选择；她看见当前椅位，仍自主站立，未永久丢失人格。'); return; }
  if (c.type === 'RETURN_TO_START') { p.pose = 'STANDING'; if (h.location === 'ROUTE_END') { h.walks += 1; h.exertion += 1; } h.location = 'DESK'; p.location = 'DESK'; ctx.note('沿原地面实际返回', '已分离的双方从真实四米终点各自普通走回原桌；若从原椅前返回，则你先从原椅普通起身，再沿原一米地面走回。没有换房、传送、返还成本或刷新宿主体力。'); return; }
  if (c.type === 'CLOSE') {
    // Sitting and recovery are actual local motions, not a position reset across the room.
    if (c.caseId === 'deferred-seat') { if (p.pose === 'SEATED') p.pose = 'STANDING'; t.targetPose = 'STANDING'; t.targetPaused = false; }
    r.contactOpen = false; r.closes += 1; r.basicConsent = false; r.fullConsent = false; r.safetyReserved = false;
    ctx.note('实际结束本次接触', '艾琳核对原人物清醒自主、原木片在原桌、没有保存中的念头和未分离寄生。已坐下的本人实际普通起身；所有人都在原场地安全位置。行动、灵性、费用、移动与失败历史保留，不治疗或另奖。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(spec.title, spec.story + ' ' + spec.facts.join(' ') + '观察不生成当前念头，不给予BASIC或FULL同意，不改变身体或原物。'); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.checkedSuccess = false; r.taskComplete = false; r.basicConsent = false; r.fullConsent = false;
    r.safetyReserved = c.method === 'ABILITY' && hostCase(c.caseId);
    if (r.safetyReserved) { s.cash -= 80; l.paidKits += 1; }
    ctx.note(spec.title, c.method === 'ABILITY' ? (hostCase(c.caseId) ? '已付80便士购买艾琳本次原创G安全包，预留无需额外资源的实际分离协助；尚未取得BASIC或FULL同意、尚未进入。' : '只准备这一次真实坐下念头试验；艾莉丝此刻仍站立，尚未形成或被偷取当前念头。') + '实施另耗1行动、4灵性，意志18。' : '准备普通观察与本人自愿演示；实施1行动、0灵性、知识10，没有寄生或心智控制。'); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.seer.completedSources.push(sourceFor(c.caseId)); s.progression.acting = Math.min(100, s.progression.acting + 25);
    if (r.method === 'ABILITY') award(c.caseId === 'deferred-seat' ? 'error.s4.deferred-thought' : 'error.s4.parasitism', 8);
    ctx.note(spec.title, '有限任务、真实分离、原物和位置恢复已经逐步核对。G扮演+25；' + (r.method === 'ABILITY' ? '本次实际成功能力掌握+8。' : '普通报告不冒充能力掌握。')); return;
  }
  r.attemptWeek = s.week; r.attempts += 1; r.contactOpen = true;
  if (r.method === 'ABILITY') s.spirituality -= 4;
  const result = ctx.check(r.method === 'ABILITY' ? 'will' : 'knowledge', r.method === 'ABILITY' ? 18 : 10);
  const success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
  r.checkedSuccess = success; r.lastOutcome = success ? 'SUCCESS' : 'FAILURE'; r.status = success ? 'EXAMINED' : 'OBSERVED';
  if (hostCase(c.caseId)) {
    if (r.method === 'ABILITY' && success) { p.presence = 'INSIDE_HOST'; p.location = h.location; p.entries += 1; h.mode = 'BASIC'; r.status = 'ACTIVE'; }
    if (r.method === 'ORDINARY') {
      if (c.caseId === 'shared-senses') { h.location = 'ROUTE_END'; p.location = 'ROUTE_END'; h.walks += 1; h.exertion += 1; r.taskComplete = success; }
      else { h.token = 'HOST_HAND'; h.tokenMoves += 1; h.exertion += 1; r.taskComplete = false; if (success) r.status = 'ACTIVE'; }
    }
  } else {
    t.lastRelease = 'NONE';
    if (r.method === 'ABILITY' && success) { t.pending = 'SIT_ON_PR4_CHAIR_1'; t.targetPaused = true; t.thefts += 1; }
    else t.targetPose = 'SEATED';
    r.taskComplete = success;
  }
  ctx.note(spec.title, r.method === 'ABILITY' && success ? hostCase(c.caseId) ? '能力检定成功并实际进入托马斯的BASIC浅层接触。只有同一宿主的当前位置、真实视听与本人自主控制；还须完成有限任务并实际分离。' : '艾莉丝刚形成坐下的当前念头，你成功偷取并保存这一项具体行动。她仍站立且暂时停下，你也仍站立，没有在同一行动立即执行；随后可选择显现或不执行释放。' : (r.method === 'ORDINARY' ? '原志愿者已实际自愿演示：走过四米、拿起原木片或坐上自己的原椅；普通检查' : '能力未成，没有进入宿主或保存念头；艾莉丝场景中她已经按自己原念头坐下。检定') + (success ? '成功。' : '失败；已付行动、灵性及安全包保留，先实际收束，下一真实周可再试。'));
}

export function parasiteLifeActions(s: SliceState): ParasiteLifeAction[] {
  if (!promoted(s) || s.progression.sequence !== 4) return [];
  const out: ParasiteLifeAction[] = [], l = s.parasite.life;
  const add = (id: string, label: string, cost: string, command: ParasiteActivityCommand) => { const reason = parasiteActivityReason(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const spec of CASES) {
    const id = spec.id, r = l.cases[id];
    if (r.status === 'AVAILABLE') add(id + '-observe', '观察原现场与本次边界', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED' && !r.contactOpen) {
      add(id + '-ability', id === 'deferred-seat' ? '准备保存当前坐下念头' : '准备本次寄生与监督分离', hostCase(id) ? '1行动 · 80便士安全包 · 实施另4灵性' : '1行动 · 实施另4灵性', { type: 'PREPARE', caseId: id, method: 'ABILITY' });
      add(id + '-ordinary', '选择普通观察与自愿演示', '1行动 · 0灵性 · 无寄生或控制', { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(id + '-perform', r.method === 'ABILITY' ? id === 'deferred-seat' ? '偷取并暂存此刻坐下念头' : '实际尝试进入BASIC浅层寄生' : '实际普通演示与检查', r.method === 'ABILITY' ? '1行动 · 4灵性 · 意志18' : '1行动 · 0灵性 · 知识10', { type: 'PERFORM', caseId: id });
      add(id + '-withdraw', '取消准备，再选择普通方法', '0行动 · 已付准备与费用保留', { type: 'WITHDRAW', caseId: id });
    }
    if (hostCase(id) && r.method === 'ABILITY' && ['PREPARED', 'ACTIVE'].includes(r.status)) {
      if (!r.basicConsent) add(id + '-consent-basic', '确认托马斯仅同意本次BASIC视听共享', '0行动 · 不含FULL · 此步不进入', { type: 'CONSENT_BASIC', caseId: id, confirmed: true });
      if (id === 'limited-control' && !r.fullConsent) add(id + '-consent-full', '另行确认FULL仅拿起并放回原木片', '0行动 · 独立同意 · 此步不接管', { type: 'CONSENT_FULL', caseId: id, task: 'MOVE_TOKEN_AND_RETURN', confirmed: true });
    }
    if (r.contactOpen) {
      if (id === 'shared-senses' && l.player.presence === 'INSIDE_HOST' && !r.taskComplete) add(id + '-walk', '让托马斯自主走完原四米路线', '0行动 · 宿主实际劳动+1 · 只共享真实视听', { type: 'WALK_ROUTE', caseId: id });
      if (id === 'limited-control') {
        if (l.player.presence === 'INSIDE_HOST' && !r.taskComplete && l.host.token === 'DESK') add(id + '-take', '按独立FULL同意用宿主原手拿起原木片', '0行动 · 宿主实际劳动+1 · 仅此一次任务', { type: 'TAKE_TOKEN', caseId: id });
        if (l.host.token === 'HOST_HAND') add(id + '-return-token', '用原手把同一原木片放回原桌', '0行动 · 宿主实际劳动+1 · 结束有限控制', { type: 'RETURN_TOKEN', caseId: id });
      }
      if (hostCase(id) && l.player.presence === 'INSIDE_HOST') add(id + '-exit', '由艾琳在当前位置监督实际分离', '0行动 · 0灵性 · 用已付安全包', { type: 'EXIT_HOST', caseId: id });
      if (id === 'deferred-seat' && l.thought.pending !== 'NONE') {
        if (l.player.location === 'DESK') add(id + '-step', '普通走到同一原空椅前', '0行动 · 实际一米 · 尚不显现念头', { type: 'STEP_TO_CHAIR', caseId: id });
        add(id + '-execute', '现在显现已保存念头并坐上原空椅', '0行动 · 真实椅位必须安全 · 此步才执行', { type: 'RELEASE_THOUGHT', caseId: id, mode: 'EXECUTE' });
        add(id + '-discard', '不执行，释放这一次保存的念头', '0行动 · 原创G放散 · 核对决定恢复', { type: 'RELEASE_THOUGHT', caseId: id, mode: 'DISCARD' });
      }
      if (l.player.location !== 'DESK' || l.host.location !== 'DESK') add(id + '-return', '从实际当前位置普通起身并走回原桌', '0行动 · 实际原路 · 不瞬移', { type: 'RETURN_TO_START', caseId: id });
      add(id + '-close', '核对自主、原物与位置并结束本次接触', '0行动 · 成本与历史保留', { type: 'CLOSE', caseId: id });
    }
    if (r.status === 'EXAMINED') add(id + '-report', '报告这次真实结果与边界', '1行动 · 先分离、恢复与收束 · G扮演+25', { type: 'REPORT', caseId: id });
  }
  if (!l.reflected) add('parasite-reflect', '回看同意、单一身体与延后选择', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  return out;
}

const place = (v: ParasiteLifeState['player']['location']) => v === 'DESK' ? '原桌旁' : v === 'ROUTE_END' ? '沿原地面四米外终点' : '一米外PR4-CHAIR-1前';
export function projectParasiteLife(s: SliceState): ParasiteLifeProjection {
  if (!promoted(s)) return { cases: [], insideCase: false, environment: '', practice: null };
  const l = s.parasite.life, h = l.host, p = l.player, t = l.thought;
  const active = Object.values(l.cases).find(r => r.contactOpen || r.status === 'PREPARED');
  return {
    insideCase: hasParasiteLifeLock(s), environment: PARASITE_LIFE_ENVIRONMENT,
    cases: CASES.map(spec => {
      const r = l.cases[spec.id];
      return { id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [...spec.facts], status: r.status,
        preparation: r.status === 'PREPARED' ? r.method === 'ORDINARY' ? '本次普通方法：知识10、0灵性，没有进入或偷取。' : hostCase(spec.id) ? '本次80便士安全包已付；BASIC与FULL同意分列，尚未实际进入。实施4灵性、意志18。' : '原目标仍站立，只有实施时的真实当前念头可以偷取。实施4灵性、意志18。' : null,
        result: r.attemptWeek === null ? r.withdrawals ? '尚未实施的准备已取消，已付成本保留。' : null : `第${r.attemptWeek}周实际尝试：${r.lastOutcome === 'SUCCESS' ? '检定成功' : r.lastOutcome === 'INTERRUPTED' ? '成功进入后主动中止未完成任务' : '检定未成'}；${r.taskComplete ? '有限任务已完成' : '没有可报告的完整任务'}，${r.contactOpen ? '接触仍须实际收束' : '本次接触已实际结束'}。已尝试${r.attempts}次、实际收束${r.closes}次；失败成本不返。`,
        contactOpen: r.contactOpen ? '本次接触仍在；按公开步骤分离、恢复决定和原物位置' : '没有本次未结束接触', closes: r.closes };
    }),
    practice: {
      host: '托马斯·里德 · 34岁 · 档案递送员 · 原创成年志愿者；艾琳·沃德为在场成年监督员（G）',
      consent: `BASIC：${active?.basicConsent ? '仅本次真实视听共享已同意' : '没有当前授权'}；FULL：${active?.fullConsent ? '已另行同意仅把PR4-TOKEN-1拿到托马斯手里并放回' : '没有当前授权，不能从BASIC推导'}。可取消准备并改普通方法；已进入则先监督分离。`,
      mode: h.mode === 'NONE' ? '未寄生；双方各有原本身体' : h.mode === 'BASIC' ? 'BASIC浅层：真实视听共享；不读隐藏思想、不控制身体' : 'FULL：只执行已同意的原木片取放任务；没有一般或永久命令权',
      location: p.presence === 'INSIDE_HOST' ? `同一宿主身体位于${place(h.location)}，玩家在其内共享这一实际位置；外部无可操控第二身体，携物不复制或远处操作。` : `玩家原本唯一身体在${place(p.location)}，${p.pose === 'STANDING' ? '站立' : '坐在原椅上'}；托马斯同一具身体在${place(h.location)}。`,
      awareness: '托马斯保持清醒、知道本次接触与限定任务；BASIC不公开隐藏内心。FULL只显示已宣布的有限任务意图。',
      control: `${h.control === 'HOST' ? '托马斯本人控制原身体' : '玩家暂控原身体，只可将原木片放回'}；宿主累计实际劳动${h.exertion}点，不因新准备清零。`,
      token: `唯一PR4-TOKEN-1，始终属于托马斯；${h.token === 'DESK' ? '在他的原桌上' : '在他的原手中'}；累计实际取放${h.tokenMoves}次，没有复制或转移物权。`,
      thought: `艾莉丝·伍德38岁；${t.targetPose === 'STANDING' ? '站立' : '已普通坐在自己的原椅'}；${t.targetPaused ? '当前坐下决定暂时停下，须恢复' : '当前可自由决定'}。${t.pending === 'NONE' ? '没有保存中的念头' : '只保存这一次SIT_ON_PR4_CHAIR_1：坐上同一PR4-CHAIR-1；玩家尚未执行'}。最近释放：${t.lastRelease === 'EXECUTED' ? '在后续独立步骤实际执行' : t.lastRelease === 'DISCARDED' ? '已明确不执行放散' : '尚无'}。`,
      cost: `已付安全包${l.paidKits}份，共${l.paidKits * 80}便士；${active?.safetyReserved ? '本次已预留0行动、0灵性的监督分离容量' : '没有尚待使用的本次分离容量'}。每次能力实施4灵性、1行动，失败不返。`,
      history: [`实际进入${p.entries}次，实际监督分离${p.exits}次；同一宿主四米单程移动${h.walks}次。`, `实际偷取${t.thefts}次，稍后显现${t.executions}次，不执行放散${t.discards}次，决定恢复${t.recoveries}次。`, '位置、退出与放散为本场明确G处理，不是通用无风险附身或驱离；长期动物宿主身份与生理影响风险不能忽略。'],
    },
  };
}

/** Reject impossible one-body, consent, original-token, delayed-thought and completion histories. */
export function validateParasiteLife(s: SliceState): boolean {
  try {
    const l = s.parasite.life;
    if (!record(l) || !shape(l, ['cases', 'reflected', 'host', 'player', 'thought', 'paidKits']) || !record(l.cases) || !shape(l.cases, PARASITE_CASE_IDS)) return false;
    if (!record(l.host) || !record(l.player) || !record(l.thought) || !Array.isArray(s.seer.completedSources)) return false;
    const h = l.host, p = l.player, t = l.thought;
    if (!shape(h, ['id', 'age', 'location', 'mode', 'awareness', 'control', 'exertion', 'token', 'tokenMoves', 'walks']) || !shape(p, ['presence', 'location', 'pose', 'entries', 'exits']) || !shape(t, ['targetId', 'targetAge', 'chairId', 'targetPose', 'targetPaused', 'pending', 'lastRelease', 'thefts', 'executions', 'discards', 'recoveries'])) return false;
    if (h.id !== 'PR4-THOMAS' || h.age !== 34 || h.awareness !== 'AWARE' || t.targetId !== 'PR4-ALICE' || t.targetAge !== 38 || t.chairId !== 'PR4-CHAIR-1') return false;
    if (!['DESK', 'ROUTE_END'].includes(h.location) || !['NONE', 'BASIC', 'FULL'].includes(h.mode) || !['HOST', 'BOUNDED_TOKEN_TASK'].includes(h.control) || !['DESK', 'HOST_HAND'].includes(h.token)) return false;
    if (!['OUTSIDE', 'INSIDE_HOST'].includes(p.presence) || !['DESK', 'ROUTE_END', 'CHAIR_FRONT'].includes(p.location) || !['STANDING', 'SEATED'].includes(p.pose) || !['STANDING', 'SEATED'].includes(t.targetPose)) return false;
    if (!['NONE', 'SIT_ON_PR4_CHAIR_1'].includes(t.pending) || !['NONE', 'EXECUTED', 'DISCARDED'].includes(t.lastRelease) || typeof t.targetPaused !== 'boolean' || typeof l.reflected !== 'boolean') return false;
    if (![h.tokenMoves, h.walks, p.entries, p.exits, t.thefts, t.executions, t.discards, t.recoveries, l.paidKits].every(n => integer(n)) || !integer(h.exertion)) return false;
    if (p.entries - p.exits !== Number(p.presence === 'INSIDE_HOST') || p.exits > p.entries || p.entries > l.paidKits) return false;
    if (t.thefts !== t.executions + t.discards + Number(t.pending !== 'NONE') || t.recoveries !== t.executions + t.discards || t.targetPaused !== (t.pending !== 'NONE')) return false;
    if (h.exertion !== h.tokenMoves + h.walks) return false;
    if (h.tokenMoves % 2 !== Number(h.token === 'HOST_HAND') || h.walks % 2 !== Number(h.location === 'ROUTE_END')) return false;
    const first = s.parasite.promotionWeek ?? s.week;
    let open = 0, prepared = 0, resolved = 0, attempts = 0;
    for (const id of PARASITE_CASE_IDS) {
      const r = l.cases[id];
      if (!record(r) || !shape(r, ['status', 'method', 'attemptWeek', 'attempts', 'withdrawals', 'closes', 'contactOpen', 'basicConsent', 'fullConsent', 'safetyReserved', 'checkedSuccess', 'taskComplete', 'lastOutcome'])) return false;
      if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || !['NONE', 'SUCCESS', 'FAILURE', 'INTERRUPTED'].includes(r.lastOutcome)) return false;
      if (![r.attempts, r.withdrawals, r.closes].every(n => integer(n)) || ![r.contactOpen, r.basicConsent, r.fullConsent, r.safetyReserved, r.checkedSuccess, r.taskComplete].every(v => typeof v === 'boolean')) return false;
      if (r.attemptWeek !== null && !integer(r.attemptWeek, first, s.week)) return false;
      if ((r.attemptWeek === null) !== (r.attempts === 0) || r.attempts !== r.closes + Number(r.contactOpen) || r.attempts > Math.max(0, s.week - first + 1)) return false;
      if (r.contactOpen && (r.method === null || r.attemptWeek !== s.week || !['OBSERVED', 'ACTIVE', 'EXAMINED'].includes(r.status))) return false;
      if (r.status === 'PREPARED' && (r.method === null || r.attemptWeek === s.week || r.contactOpen || r.checkedSuccess || r.taskComplete)) return false;
      if (r.status === 'ACTIVE' && (!r.contactOpen || r.method === null || !hostCase(id) || r.method === 'ORDINARY' && id !== 'limited-control' || !r.checkedSuccess || r.taskComplete)) return false;
      if (['EXAMINED', 'RESOLVED'].includes(r.status) && (!r.checkedSuccess || !r.taskComplete || r.method === null || r.attemptWeek === null || r.lastOutcome !== 'SUCCESS')) return false;
      if (r.status === 'RESOLVED' && r.contactOpen) return false;
      if (r.taskComplete && !r.checkedSuccess) return false;
      if (r.lastOutcome === 'NONE' && r.attempts !== 0 || r.lastOutcome === 'FAILURE' && r.checkedSuccess || r.lastOutcome === 'INTERRUPTED' && r.taskComplete) return false;
      if ((r.basicConsent || r.fullConsent || r.safetyReserved) && (!hostCase(id) || r.method !== 'ABILITY' || !(r.status === 'PREPARED' || r.contactOpen))) return false;
      if (r.fullConsent && id !== 'limited-control') return false;
      if (r.status === 'PREPARED' && r.safetyReserved !== (hostCase(id) && r.method === 'ABILITY')) return false;
      if (r.status === 'AVAILABLE' && Object.entries(emptyCase()).some(([key, value]) => r[key as keyof ParasiteCaseState] !== value)) return false;
      if (s.seer.completedSources.filter(x => x === sourceFor(id)).length !== Number(r.status === 'RESOLVED')) return false;
      open += Number(r.contactOpen); prepared += Number(r.status === 'PREPARED'); resolved += Number(r.status === 'RESOLVED'); attempts += r.attempts;
    }
    if (open > 1 || prepared > 1 || open && prepared || p.entries > attempts || t.thefts > l.cases['deferred-seat'].attempts) return false;
    const shared = l.cases['shared-senses'], limited = l.cases['limited-control'], seat = l.cases['deferred-seat'];
    const currentHost = shared.contactOpen ? shared : limited.contactOpen ? limited : null;
    if (p.presence === 'INSIDE_HOST') {
      if (!currentHost || currentHost.method !== 'ABILITY' || !currentHost.checkedSuccess || !currentHost.basicConsent || !currentHost.safetyReserved || !['ACTIVE', 'EXAMINED'].includes(currentHost.status) || h.mode === 'NONE' || p.location !== h.location || p.pose !== 'STANDING') return false;
    } else if (h.mode !== 'NONE' || h.control !== 'HOST') return false;
    if (h.mode === 'FULL' && (!limited.contactOpen || !limited.fullConsent || h.token !== 'HOST_HAND' || h.control !== 'BOUNDED_TOKEN_TASK')) return false;
    if ((h.control === 'BOUNDED_TOKEN_TASK') !== (h.mode === 'FULL')) return false;
    if (h.token === 'HOST_HAND' && (!limited.contactOpen || h.location !== 'DESK' || limited.method === 'ABILITY' && h.mode !== 'FULL')) return false;
    if (h.location === 'ROUTE_END' && (!shared.contactOpen || p.location !== 'ROUTE_END' || h.exertion < 1)) return false;
    if (p.location === 'ROUTE_END' && h.location !== 'ROUTE_END') return false;
    if (p.location === 'CHAIR_FRONT' && (!seat.contactOpen || seat.method !== 'ABILITY' || !seat.checkedSuccess)) return false;
    if (p.pose === 'SEATED' && (!seat.contactOpen || p.location !== 'CHAIR_FRONT' || t.lastRelease !== 'EXECUTED' || t.pending !== 'NONE' || t.targetPose !== 'STANDING')) return false;
    if (t.pending !== 'NONE' && (!seat.contactOpen || seat.method !== 'ABILITY' || !seat.checkedSuccess || p.pose !== 'STANDING' || t.targetPose !== 'STANDING')) return false;
    if (t.targetPose === 'SEATED' && (!seat.contactOpen || seat.method === 'ABILITY' && seat.checkedSuccess)) return false;
    if (!open && (p.presence !== 'OUTSIDE' || p.location !== 'DESK' || p.pose !== 'STANDING' || h.location !== 'DESK' || h.token !== 'DESK' || t.pending !== 'NONE' || t.targetPose !== 'STANDING')) return false;
    if (hasParasiteLifeLock(s) && (s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || s.combat || s.activeEvent || s.parasite.encounter.borrowed.some(power => power.closedSeconds === null))) return false;
    if (s.seer.completedSources.filter(x => x === 'parasite-reflection').length !== Number(l.reflected) || l.reflected && resolved !== 3) return false;
    if (promoted(s)) return ((s.progression.sequence===3||s.progression.sequence===2)?s.deceitMentor.parasiteActingAtPromotion:s.progression.acting) === resolved * 25 + (l.reflected ? 25 : 0);
    // Before promotion every nested fact must still be pristine, including the original bodies and object.
    const fresh = createParasiteLifeState();
    return !l.reflected && l.paidKits === 0 && PARASITE_CASE_IDS.every(id => l.cases[id].status === 'AVAILABLE') && [h, p, t].every((obj, i) => Object.entries([fresh.host, fresh.player, fresh.thought][i]!).every(([key, value]) => (obj as unknown as Record<string, unknown>)[key] === value));
  } catch { return false; }
}
