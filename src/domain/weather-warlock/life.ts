import type { PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { findIronBloodMember, dismissIronBloodMembers, hasIronBloodRite } from '../iron-blood-knight/team.js';
import { ironBloodInside } from '../iron-blood-knight/life.js';
import { hasWarBishopLifeLock } from '../war-bishop/life.js';
import type { WeatherWarlockAction } from './types.js';

export const WEATHER_WARLOCK_MEMBER_IDS = ['IB4-01', 'IB4-02', 'IB4-03', 'IB4-04', 'IB4-05'] as const;
export const WEATHER_WARLOCK_CASE_IDS = ['fog-corridor', 'frost-tray', 'wind-rain'] as const;
export type WeatherWarlockCaseId = typeof WEATHER_WARLOCK_CASE_IDS[number];
export type WeatherWarlockNode = 'NEAR' | 'WORK';
type Method = 'ABILITY' | 'ORDINARY';
type Result = 'NONE' | Method;
export type WeatherWarlockStep = 'INVITE_TEAM' | 'PERFORM' | 'WARN_READ_EXIT' | 'CAST_WEATHER' | 'INSPECT_WEATHER' | 'STOP_WEATHER' | 'ORDINARY_WORK' | 'RETURN_NEAR' | 'RETURN_TOOL' | 'DISMISS_TEAM' | 'CLOSE';
export type WeatherWarlockActivityCommand =
  | { type: 'OBSERVE' | 'INVITE_TEAM' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: WeatherWarlockCaseId }
  | { type: 'PREPARE'; caseId: WeatherWarlockCaseId; method: Method }
  | { type: 'WARN_READ_EXIT' | 'CAST_WEATHER' | 'INSPECT_WEATHER' | 'STOP_WEATHER' | 'ORDINARY_WORK' | 'RETURN_NEAR' | 'RETURN_TOOL' | 'DISMISS_TEAM' | 'REFLECT' };
export interface WeatherWarlockCost { id: string; healthLoss: number; energySpent: number; walkedMetres: number }
export interface WeatherWarlockEvidence {
  performed: boolean; exitRead: boolean; warned: boolean; abilityAttempted: boolean; effectObserved: boolean;
  stopped: boolean; ordinaryDone: boolean; returned: boolean; dismissed: boolean; closed: boolean; failed: boolean;
  result: Result; elapsedSeconds: number; ownerWalkedMetres: number; toolTravelMetres: number;
  actionSpent: 1; cashSpent: 40; spiritualitySpent: number; ownerDamage: number; memberCosts: WeatherWarlockCost[];
}
export interface WeatherWarlockAttempt {
  invitedWeek: number; method: Method; outcome: PublicResolutionTier | null; steps: WeatherWarlockStep[];
  /** Immutable receipts only. Current health/energy remain solely in the original roster. Never restored from this record. */
  before: { health: number; spirituality: number; actions: number; cash: number; members: { id: string; health: number; energy: number }[] };
  evidence: WeatherWarlockEvidence;
}
export interface WeatherWarlockCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; method: Method | null; result: Result; contactOpen: boolean;
  closes: number; withdrawals: number; attempts: WeatherWarlockAttempt[];
}
export interface WeatherWarlockPractice {
  activeCase: WeatherWarlockCaseId | null; ownerNode: WeatherWarlockNode;
  memberNodes: { id: string; node: WeatherWarlockNode }[];
  tools: { id: string; caseId: WeatherWarlockCaseId; source: string; holder: 'RACK' | 'WORK' | 'NEAR' }[];
  reservoir: { id: 'WW2-RESERVOIR-1'; source: string; remainingMl: number };
  tray: { id: 'WW2-TRAY-1'; liquidMl: number; iceMl: number };
  basin: { id: 'WW2-BASIN-1'; waterMl: number; catchStatus: 'EMPTY' | 'CAUGHT' };
  fixture: { id: 'WW2-FIXTURE-1'; source: string; wetMl: number; damaged: boolean };
  airborneMl: number; groundMl: number;
  weather: { effect: 'NONE' | 'FOG' | 'FROST' | 'WIND_RAIN'; remainingSeconds: number; visibilityMetres: number; affectedBodyIds: string[] };
  exit: { id: 'WW2-EXIT-1'; distanceMetres: 4; open: true; source: string };
}
export interface WeatherWarlockLifeState { practice: WeatherWarlockPractice; cases: Record<WeatherWarlockCaseId, WeatherWarlockCaseState>; reflected: boolean }
export interface WeatherWarlockLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; reflected: boolean;
  practice: WeatherWarlockPractice & { elapsedSeconds: number }; invitationWeeks: number[];
  members: { id: string; name: string; health: number; energy: number; willing: boolean; present: boolean; location: 'HOME' | 'YARD'; eligible: boolean; node: WeatherWarlockNode | null }[];
  cases: { id: WeatherWarlockCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: boolean; returned: boolean; closes: number; attempts: { invitedWeek: number; method: Method; outcome: PublicResolutionTier | null; steps: WeatherWarlockStep[]; evidence: WeatherWarlockEvidence }[] }[];
}
const TOOL_SOURCES = {
  'fog-corridor': '原创G：新院登记的唯一观察尺WW2-SIGHT-1，只测原四米走廊可见距离，不能透雾看出口。',
  'frost-tray': '原创G：新院登记的唯一浅水盘WW2-TRAY-1，只盛本次从原水箱量出的1000毫升水；盘、水与冰均不复制。',
  'wind-rain': '原创G：新院登记的唯一导水槽WW2-CHANNEL-1，用于原水箱向原接水盆的有限水流；不是天气造水器。',
} as const;
const TOOL_IDS = { 'fog-corridor': 'WW2-SIGHT-1', 'frost-tray': 'WW2-TRAY-1', 'wind-rain': 'WW2-CHANNEL-1' } as const;
const SP_COST = { 'fog-corridor': 6, 'frost-tray': 8, 'wind-rain': 10 } as const;
const ABILITY_IDS = { 'fog-corridor': 'hunter.s2.battle-fog', 'frost-tray': 'hunter.s2.frost', 'wind-rain': 'hunter.s2.storm' } as const;
const CASES = [
  { id: 'fog-corridor', title: '雾廊：看不见的出口仍须亲自走回', story: '原五位同伴来到新院四米走廊。先在清晰视野中读原出口牌并警告每个人，再用同一观察尺检查有限雾区。你与同伴同受遮蔽，不能从旧读牌记录伪造穿雾新视野。（原创G）', facts: ['能力只把原水箱500毫升水形成局部雾；成功能见1米、失败2米，本人及原五人一视同仁。', '能力6灵性、知识16，本场只一次；失败本人及五人各健康−1，疲劳保留。实际观察后明确停止并等余雾凝回原盆。', '普通方法在清晰原廊核对同一观察尺与出口；失败也能等雾散后这样完成，不重抽能力。'] },
  { id: 'frost-tray', title: '霜盘：同一份水结冰也不会治愈伤口', story: '从唯一原水箱量出1000毫升水放进唯一浅盘。原五人亲自站在同一工位检查。有限寒霜只作用于此盘，失败的小伤与身体旧伤都不会随冰融化消失。（原创G）', facts: ['能力8灵性、知识16；成功原1000毫升结冰，失败仅250毫升冻结，本人及五人各健康−1。', '同一盘中水与冰总量永远1000毫升；明确停止、实际等待融化，再带原盘和原水回架，不添水、不克隆或治疗。', '普通方法只检查原水盘温度与液面，不宣称制造冰或授予能力掌握。'] },
  { id: 'wind-rain', title: '风雨：原水最终落在谁的身边', story: '在可见的新院原导水槽旁，把原水箱2000毫升有限水导向同一接水盆。原木挡板就在水流范围内，风雨会沾湿它，失败还会造成永久损坏；同伴不会因友军身份免除波及。（原创G）', facts: ['能力10灵性、知识16；成功盆接1800毫升、原木挡板湿200；失败盆接1000、地面800、挡板200且损坏，本人及五人各健康−1。', '停止不把水吸回水箱，也不修复挡板。失败可用原导水槽与普通清理把地面800毫升收进原盆；挡板仍湿且损坏。', '不施术可普通把原箱2000毫升经同一槽全送原盆。局部风雨不生成无限雨水，不改变城市或全球天气。'] },
] as const;
export const WEATHER_WARLOCK_LIFE_ENVIRONMENT = '三场新院原创G有限实践；天气迷雾、冰霜、风雨方向有原著依据，以下人数、效果、距离、时间、消耗、判定与结果全部为G。原G1五位成年人的当前H/E、意愿、在场与HOME/YARD位置只读写旧队伍表。每案观察1行动、准备1行动、重新邀请1行动40便士；一案一邀请、每真实周至多一场。0行动子步骤仍消耗实际资源与时间，不可重复施术。每场往返工位各4米/8秒，原家至院门各20米/20秒均G；到场、取物、施术、普通操作、返程、散场每次每人1精力。单次天气窗口30秒，施术10秒、观察5秒后须明确停止并等剩余时间，失败也不免除损耗。三案共用原6000毫升水、三件唯一工具与一个原盆；余水、落水、湿损永久保留。报告各扮演25，三案反思25；报告时仅真实成功且观察过的对应新能力掌握8。';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 2;
const freshCase = (): WeatherWarlockCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, closes: 0, withdrawals: 0, attempts: [] });
const lastAttempt = (s: SliceState): WeatherWarlockAttempt | null => { const l = s.weatherWarlock.life; return l.practice.activeCase ? l.cases[l.practice.activeCase].attempts[0] ?? null : null; };
function freshPractice(): WeatherWarlockPractice {
  return { activeCase: null, ownerNode: 'NEAR', memberNodes: [], tools: WEATHER_WARLOCK_CASE_IDS.map(caseId => ({ id: TOOL_IDS[caseId], caseId, source: TOOL_SOURCES[caseId], holder: 'RACK' })),
    reservoir: { id: 'WW2-RESERVOIR-1', source: '原创G：新院唯一封闭原水箱WW2-RESERVOIR-1，初始6000毫升；本切片不补水。', remainingMl: 6000 },
    tray: { id: 'WW2-TRAY-1', liquidMl: 0, iceMl: 0 }, basin: { id: 'WW2-BASIN-1', waterMl: 0, catchStatus: 'EMPTY' },
    fixture: { id: 'WW2-FIXTURE-1', source: '原创G：新院同一块可见木挡板；沾湿与损坏保留，不是会自动刷新的靶子。', wetMl: 0, damaged: false }, airborneMl: 0, groundMl: 0,
    weather: { effect: 'NONE', remainingSeconds: 0, visibilityMetres: 4, affectedBodyIds: [] },
    exit: { id: 'WW2-EXIT-1', distanceMetres: 4, open: true, source: '原创G：四米净空原路尽头的同一实体出口牌；施术前当面读取，能力停止后沿原地面走回。' } };
}
export function createWeatherWarlockLifeState(): WeatherWarlockLifeState { return { practice: freshPractice(), cases: { 'fog-corridor': freshCase(), 'frost-tray': freshCase(), 'wind-rain': freshCase() }, reflected: false }; }
function freshEvidence(): WeatherWarlockEvidence {
  return { performed: false, exitRead: false, warned: false, abilityAttempted: false, effectObserved: false, stopped: false, ordinaryDone: false, returned: false, dismissed: false, closed: false, failed: false, result: 'NONE', elapsedSeconds: 0, ownerWalkedMetres: 0, toolTravelMetres: 0,
    actionSpent: 1, cashSpent: 40, spiritualitySpent: 0, ownerDamage: 0, memberCosts: WEATHER_WARLOCK_MEMBER_IDS.map(id => ({ id, healthLoss: 0, energySpent: 0, walkedMetres: 0 })) };
}
/** Finite scene receipt replay. It creates no actors/resources and performs no random check. */
function replayAttempt(start: WeatherWarlockPractice, id: WeatherWarlockCaseId, method: Method, outcome: PublicResolutionTier | null, steps: WeatherWarlockStep[]): { practice: WeatherWarlockPractice; evidence: WeatherWarlockEvidence } | null {
  const p = structuredClone(start), e = freshEvidence(), tool = p.tools.find(t => t.caseId === id)!;
  const energy = () => { for (const m of e.memberCosts) m.energySpent++; };
  const walk = (metres: number, owner: boolean) => { for (const m of e.memberCosts) m.walkedMetres += metres; if (owner) e.ownerWalkedMetres += metres; };
  const catchWater = (ml: number) => { p.basin.waterMl += ml; p.basin.catchStatus = 'CAUGHT'; };
  if (!steps.length || steps.length > 11 || steps[0] !== 'INVITE_TEAM' || p.activeCase !== null || !['ABILITY', 'ORDINARY'].includes(method)) return null;
  if (![null, 'SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(outcome)) return null;
  for (const [index, step] of steps.entries()) {
    if (e.closed || index > 0 && p.activeCase !== id) return null;
    switch (step) {
      case 'INVITE_TEAM':
        if (index !== 0 || p.memberNodes.length || p.tools.some(t => t.holder !== 'RACK') || p.weather.effect !== 'NONE') return null;
        p.activeCase = id; p.memberNodes = WEATHER_WARLOCK_MEMBER_IDS.map(memberId => ({ id: memberId, node: 'NEAR' })); e.elapsedSeconds += 20; energy(); walk(20, false); break;
      case 'PERFORM':
        if (e.performed || e.dismissed || tool.holder !== 'RACK') return null;
        e.performed = true; p.ownerNode = 'WORK'; p.memberNodes.forEach(m => { m.node = 'WORK'; }); tool.holder = 'WORK'; e.elapsedSeconds += 8; e.toolTravelMetres += 4; energy(); walk(4, true);
        if (id === 'frost-tray') { if (p.tray.liquidMl || p.tray.iceMl || p.reservoir.remainingMl < 1000) return null; p.reservoir.remainingMl -= 1000; p.tray.liquidMl = 1000; } break;
      case 'WARN_READ_EXIT':
        if (!e.performed || e.warned || e.returned || p.ownerNode !== 'WORK' || p.weather.effect !== 'NONE' || p.weather.visibilityMetres < p.exit.distanceMetres) return null;
        e.warned = true; e.exitRead = true; e.elapsedSeconds += 5; break;
      case 'CAST_WEATHER':
        if (!e.warned || !e.exitRead || e.abilityAttempted || e.result !== 'NONE' || method !== 'ABILITY' || outcome === null || p.ownerNode !== 'WORK') return null;
        e.abilityAttempted = true; e.failed = !success(outcome); e.spiritualitySpent = SP_COST[id]; e.elapsedSeconds += 10; energy();
        p.weather = { effect: id === 'fog-corridor' ? 'FOG' : id === 'frost-tray' ? 'FROST' : 'WIND_RAIN', remainingSeconds: 20, visibilityMetres: id === 'fog-corridor' ? success(outcome) ? 1 : 2 : 4, affectedBodyIds: ['PLAYER', ...WEATHER_WARLOCK_MEMBER_IDS] };
        if (id === 'fog-corridor') { if (p.reservoir.remainingMl < 500) return null; p.reservoir.remainingMl -= 500; p.airborneMl = 500; }
        if (id === 'frost-tray') { const ml = success(outcome) ? 1000 : 250; p.tray.liquidMl -= ml; p.tray.iceMl += ml; }
        if (id === 'wind-rain') { if (p.reservoir.remainingMl < 2000) return null; p.reservoir.remainingMl -= 2000; catchWater(success(outcome) ? 1800 : 1000); p.fixture.wetMl += 200; if (!success(outcome)) { p.groundMl += 800; p.fixture.damaged = true; } }
        if (e.failed) { e.ownerDamage = 1; e.memberCosts.forEach(m => { m.healthLoss = 1; }); } break;
      case 'INSPECT_WEATHER':
        if (!e.abilityAttempted || e.effectObserved || p.weather.effect === 'NONE' || p.weather.remainingSeconds < 5) return null;
        e.effectObserved = true; e.elapsedSeconds += 5; p.weather.remainingSeconds -= 5; if (success(outcome)) e.result = 'ABILITY'; break;
      case 'STOP_WEATHER':
        if (!e.abilityAttempted || e.stopped || p.weather.effect === 'NONE') return null;
        e.stopped = true; e.elapsedSeconds += p.weather.remainingSeconds;
        if (id === 'fog-corridor') { catchWater(p.airborneMl); p.airborneMl = 0; }
        if (id === 'frost-tray') { p.tray.liquidMl += p.tray.iceMl; p.tray.iceMl = 0; }
        p.weather = { effect: 'NONE', remainingSeconds: 0, visibilityMetres: 4, affectedBodyIds: [] }; break;
      case 'ORDINARY_WORK':
        if (!e.warned || e.ordinaryDone || e.result !== 'NONE' || p.ownerNode !== 'WORK' || p.weather.effect !== 'NONE') return null;
        e.ordinaryDone = true; e.result = 'ORDINARY'; e.elapsedSeconds += 15; energy();
        if (id === 'wind-rain') { if (!e.abilityAttempted) { if (p.reservoir.remainingMl < 2000) return null; p.reservoir.remainingMl -= 2000; catchWater(2000); } else if (p.groundMl > 0) { catchWater(p.groundMl); p.groundMl = 0; } } break;
      case 'RETURN_NEAR':
        if (e.result === 'NONE' || p.weather.effect !== 'NONE' || p.ownerNode !== 'WORK' || tool.holder !== 'WORK') return null;
        p.ownerNode = 'NEAR'; p.memberNodes.forEach(m => { m.node = 'NEAR'; }); tool.holder = 'NEAR'; e.elapsedSeconds += 8; e.toolTravelMetres += 4; energy(); walk(4, true); break;
      case 'RETURN_TOOL':
        if (e.returned || e.result === 'NONE' || p.weather.effect !== 'NONE' || p.ownerNode !== 'NEAR' || tool.holder !== 'NEAR') return null;
        e.returned = true; tool.holder = 'RACK'; e.elapsedSeconds += 5; break;
      case 'DISMISS_TEAM':
        if (!e.returned || e.dismissed || p.memberNodes.length !== 5 || p.memberNodes.some(m => m.node !== 'NEAR') || p.weather.effect !== 'NONE') return null;
        e.dismissed = true; p.memberNodes = []; e.elapsedSeconds += 20; energy(); walk(20, false); break;
      case 'CLOSE':
        if (!e.dismissed || !e.returned || e.result === 'NONE' || p.tools.some(t => t.holder !== 'RACK') || p.weather.effect !== 'NONE') return null;
        e.closed = true; p.activeCase = null; break;
      default: return null;
    }
  }
  if ((outcome !== null) !== e.abilityAttempted) return null;
  return { practice: p, evidence: e };
}
function replayLife(l: WeatherWarlockLifeState): { practice: WeatherWarlockPractice; evidence: Partial<Record<WeatherWarlockCaseId, WeatherWarlockEvidence>> } | null {
  let p = freshPractice(); const evidence: Partial<Record<WeatherWarlockCaseId, WeatherWarlockEvidence>> = {};
  for (const id of WEATHER_WARLOCK_CASE_IDS) { const attempts = l.cases[id].attempts; if (attempts.length > 1) return null; if (!attempts.length) continue; const a = attempts[0]!, replay = replayAttempt(p, id, a.method, a.outcome, a.steps); if (!replay) return null; p = replay.practice; evidence[id] = replay.evidence; }
  return { practice: p, evidence };
}
function oldSceneOpen(s: SliceState): boolean {
  return hasIronBloodRite(s) || ironBloodInside(s) || hasWarBishopLifeLock(s) || s.warBishop.preparedWeek !== null ||
    Object.values(s.ironBloodKnight.life.cases).some(c => c.contactOpen || c.status === 'PREPARED') || ['READY', 'FIGHTING'].includes(s.ironBloodKnight.encounter.status) || ['READY', 'FIGHTING'].includes(s.warBishop.encounter.status) ||
    Object.values(s.reaper.cases).some(c => c.contactOpen || c.status === 'PREPARED' || c.practice.windowOpen) || Object.values(s.conspirator.cases).some(c => c.contactOpen || c.status === 'PREPARED');
}
export function hasWeatherWarlockLifeLock(s: SliceState): boolean { const l = s.weatherWarlock?.life; return !!l && (l.practice.activeCase !== null || Object.values(l.cases).some(c => c.status === 'PREPARED') || l.practice.memberNodes.length > 0 || l.practice.weather.effect !== 'NONE' || l.practice.tools.some(t => t.holder !== 'RACK')); }
export function weatherWarlockTeamReady(s: SliceState, where: 'HOME' | 'YARD', minimumEnergy = 6): boolean { return WEATHER_WARLOCK_MEMBER_IDS.every(id => { const m = findIronBloodMember(s, id); return !!m && m.joined && m.willing && m.health >= 50 && m.energy >= minimumEnergy && m.location === where && m.present === (where === 'YARD'); }); }
function usedInvitationWeeks(s: SliceState): number[] { return [...Object.values(s.warBishop.life.cases).flatMap(c => c.attempts.map(a => a.invitedWeek)), ...Object.values(s.weatherWarlock.life.cases).flatMap(c => c.attempts.map(a => a.invitedWeek)), ...[s.warBishop.encounter.invitedWeek, s.weatherWarlock.encounter.invitedWeek].filter((w): w is number => w !== null)]; }
/** Shared with the new encounter. Its caller owns the new scene's invitation record. */
export function blockWeatherWarlockTeamInvite(s: SliceState): string | null {
  if (s.status !== 'ACTIVE' || !active(s) || s.health < 50 || s.mind <= 0) return '须本人仍活着且已晋天气术士2，健康至少50、精神尚存。';
  if (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat) return '先处理事件或战斗，并实际回贝克兰德新院。';
  if (oldSceneOpen(s) || s.weatherWarlock.preparedWeek !== null || s.ironBloodKnight.team.restRequestedWeek !== null) return '先结束旧现场、晋升准备或跨周休整。';
  if (s.ironBloodKnight.team.members.some(m => m.present) || !weatherWarlockTeamReady(s, 'HOME')) return '须原01～05当前自愿、已加入、在家，健康至少50、精力至少6；不凭旧邀请到场、不复活死者。';
  if (usedInvitationWeeks(s).includes(s.week)) return '原五人本真实周已经实际参加一场；须真实下一周，不重置伤势或疲劳。';
  return s.actionsRemaining < 1 || s.cash < 40 ? '本次真实邀请需要1行动和40便士。' : null;
}
export function arriveWeatherWarlockMembers(s: SliceState): void { for (const id of WEATHER_WARLOCK_MEMBER_IDS) { const m = findIronBloodMember(s, id); if (!m || !m.joined || m.health <= 0) throw new Error('原G1成员缺失或已经死亡，不能生成替代身体。'); m.present = true; m.location = 'YARD'; } }
export function dismissWeatherWarlockMembers(s: SliceState): void { dismissIronBloodMembers(s, WEATHER_WARLOCK_MEMBER_IDS); }
export function validateWeatherWarlockActivityCommand(v: unknown): v is WeatherWarlockActivityCommand {
  if (!record(v)) return false;
  if (['WARN_READ_EXIT', 'CAST_WEATHER', 'INSPECT_WEATHER', 'STOP_WEATHER', 'ORDINARY_WORK', 'RETURN_NEAR', 'RETURN_TOOL', 'DISMISS_TEAM', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (!WEATHER_WARLOCK_CASE_IDS.includes(v.caseId as WeatherWarlockCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'INVITE_TEAM', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
const SCENE_STEPS: readonly string[] = ['PERFORM', 'WARN_READ_EXIT', 'CAST_WEATHER', 'INSPECT_WEATHER', 'STOP_WEATHER', 'ORDINARY_WORK', 'RETURN_NEAR', 'RETURN_TOOL', 'DISMISS_TEAM', 'CLOSE'];
function appendedReplay(s: SliceState, step: WeatherWarlockStep, castOutcome: PublicResolutionTier | null = null) {
  const l = structuredClone(s.weatherWarlock.life), id = l.practice.activeCase;
  if (id === null) return null;
  const a = l.cases[id].attempts[0]; if (!a) return null;
  a.steps.push(step); if (step === 'CAST_WEATHER') a.outcome = castOutcome ?? 'SUCCESS';
  return replayLife(l);
}
export function blockWeatherWarlockActivity(s: SliceState, c: WeatherWarlockActivityCommand): string | null {
  if (!validateWeatherWarlockActivityCommand(c)) return '天气术士生活命令无效。';
  if (s.status !== 'ACTIVE' || !active(s) || s.health <= 0 || s.mind <= 0) return '须本人仍活着且已成为天气术士2。';
  if (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat) return '先处理事件/战斗，并实际回新院。';
  if (oldSceneOpen(s) || s.weatherWarlock.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.weatherWarlock.encounter.status) || s.ironBloodKnight.team.restRequestedWeek !== null) return '先实际收束旧现场、新遭遇、晋升准备或跨周休整。';
  const l = s.weatherWarlock.life, p = l.practice, r = 'caseId' in c ? l.cases[c.caseId] : p.activeCase ? l.cases[p.activeCase] : null, a = lastAttempt(s);
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '只可取消尚未邀请的付费准备；已到场须普通完成、返程、还物与散场。';
  if (SCENE_STEPS.includes(c.type)) {
    if (!a || !p.activeCase || 'caseId' in c && c.caseId !== p.activeCase) return '没有对应的本次真实现场。';
    const next = appendedReplay(s, c.type as WeatherWarlockStep);
    if (!next) return '此步骤尚未满足或已完成：先警告并读出口，单次施术/观察，停止并消散，必要时普通完成，再普通返程、还原物、散场及收束。';
    const e = next.evidence[p.activeCase]!;
    if (c.type === 'CAST_WEATHER' && (s.health < 50 || !weatherWarlockTeamReady(s, 'YARD', 1))) return '施术前原五人须仍自愿、健康至少50且有精力；可直接选择普通完成。';
    if (s.spirituality < e.spiritualitySpent - a.evidence.spiritualitySpent) return '本次灵性不足；可普通完成，不重抽或透支施术。';
    if (e.memberCosts.some((m, i) => { const original = findIronBloodMember(s, m.id); return !original || original.health <= 0 || original.energy < m.energySpent - a.evidence.memberCosts[i]!.energySpent; })) return '原身体真实精力不足或已经死亡，不能复制或免费恢复。';
    return null;
  }
  if (p.activeCase !== null) return '先收束当前实际天气现场。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一项准备。';
  if (c.type === 'INVITE_TEAM') return r?.status !== 'PREPARED' || r.attempts.length ? '须先观察并准备；本案仅一次实际邀请。' : blockWeatherWarlockTeamInvite(s);
  if (s.ironBloodKnight.team.members.some(m => m.present)) return '先让已实际到场的原成员离院。';
  if (s.actionsRemaining < 1) return '观察、准备、报告或反思需要1行动。';
  if (c.type === 'REFLECT') return l.reflected || !WEATHER_WARLOCK_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? '须三个真实报告齐全，反思只结算一次。' : null;
  if (!('caseId' in c)) return '当前没有对应现场。';
  const index = WEATHER_WARLOCK_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return r?.status !== 'AVAILABLE' || index > 0 && l.cases[WEATHER_WARLOCK_CASE_IDS[index - 1]!].status !== 'RESOLVED' ? '按顺序观察尚未观察的新场景。' : null;
  if (c.type === 'PREPARE') return r?.status !== 'OBSERVED' || r.attempts.length ? '须已观察，且本案从未实际邀请。' : s.actionsRemaining < 2 ? '准备1行动，须另留本周1行动给实际邀请。' : null;
  if (c.type === 'REPORT') return r?.status === 'EXAMINED' && r.result !== 'NONE' ? null : '先取得真实能力或普通结果，停止天气、返程、还原物、散场并收束。';
  return '当前命令不可用。';
}
function applyReceiptDelta(s: SliceState, before: WeatherWarlockEvidence | null, after: WeatherWarlockEvidence): void {
  s.health -= after.ownerDamage - (before?.ownerDamage ?? 0); s.spirituality -= after.spiritualitySpent - (before?.spiritualitySpent ?? 0);
  for (const [i, cost] of after.memberCosts.entries()) { const m = findIronBloodMember(s, cost.id)!; m.health -= cost.healthLoss - (before?.memberCosts[i]?.healthLoss ?? 0); m.energy -= cost.energySpent - (before?.memberCosts[i]?.energySpent ?? 0); }
}
const STEP_NOTES: Record<Exclude<WeatherWarlockStep, 'INVITE_TEAM'>, [string, string]> = {
  PERFORM: ['原五人随同一原工具亲自走到工位', '每人实付1精力，原工具与本人走4米、8秒G；霜盘仅从原水箱量出1000毫升，尚未施术。'],
  WARN_READ_EXIT: ['先警告原五人并当面读原出口牌', '清晰视野下确认四米原路净空。每个在场身体都会受天气影响；这份事前记忆不提供穿雾新视野。5秒G。'],
  CAST_WEATHER: ['在明确范围内实际尝试一次天气', '实际付本案灵性与原五人各1精力，知识16只检定一次。失败与实际水量、受伤和湿损保留；仍须观察或直接停止，不能重抽。'],
  INSPECT_WEATHER: ['用原尺、原盘或原槽核对真实结果', '观察实际5秒G。雾中本人和原五人同样看不清四米出口；霜只在原水盘；风雨落入原盆、地面与原挡板，不能伪称友军免疫。'],
  STOP_WEATHER: ['明确停止并等待本次剩余天气散尽', '实际等满剩余G秒数：雾水凝回原盆，原盘冰化成同一份水，风雨停止。灵性、伤势和精力不返还；原挡板湿损不修复。'],
  ORDINARY_WORK: ['完成普通原物核对或导流收尾', '原五人各实付1精力、15秒G。雾廊清晰核对，原水盘普通检查，或把原水导进原盆；失败留档，不把普通结果冒充能力成功。'],
  RETURN_NEAR: ['本人和原五人带同一原物步行返回', '沿已停止天气后的原净空路走4米、8秒G，五人各1精力。原物随原身体移动，不传送、不治疗。'],
  RETURN_TOOL: ['亲手归还本场唯一原件', '原工具在近端原架交回，实耗5秒G；原盘仍装着同一份水，原盆存水及原挡板湿损继续保留。'],
  DISMISS_TEAM: ['原五人沿普通路实际回家', '每人再耗1精力，普通步行20米、20秒G离院；旧表位置回HOME，伤势、疲劳、意愿与旧经历不恢复。'],
  CLOSE: ['原身体、原工具与天气均已收束', '仅登记实际完成的收尾，不自动搬运人或物，不退款、不补水、不修复原物。'],
};
export function applyWeatherWarlockActivity(s: SliceState, c: WeatherWarlockActivityCommand, ctx: SeerContext): void {
  const reason = blockWeatherWarlockActivity(s, c); if (reason) throw new Error(reason);
  const l = s.weatherWarlock.life, id = 'caseId' in c ? c.caseId : l.practice.activeCase, r = id ? l.cases[id] : null;
  if (c.type === 'WITHDRAW') { r!.status = 'OBSERVED'; r!.method = null; r!.withdrawals++; ctx.note('取消尚未邀请的准备', '准备行动不退回；原五人仍在家，原物、水箱及旧伤未改变。'); return; }
  if (c.type === 'INVITE_TEAM') {
    const before: WeatherWarlockAttempt['before'] = { health: s.health, spirituality: s.spirituality, actions: s.actionsRemaining, cash: s.cash, members: WEATHER_WARLOCK_MEMBER_IDS.map(memberId => { const m = findIronBloodMember(s, memberId)!; return { id: memberId, health: m.health, energy: m.energy }; }) };
    const replay = replayAttempt(l.practice, c.caseId, r!.method!, null, ['INVITE_TEAM'])!;
    s.actionsRemaining--; s.cash -= 40; arriveWeatherWarlockMembers(s); applyReceiptDelta(s, null, replay.evidence);
    r!.attempts.push({ invitedWeek: s.week, method: r!.method!, outcome: null, steps: ['INVITE_TEAM'], before, evidence: replay.evidence }); r!.status = 'ACTIVE'; r!.contactOpen = true; l.practice = replay.practice;
    ctx.note('原五位成年人本次重新到新院', '实付1行动40便士；原01～05各耗1精力，20米/20秒G普通到场。没有新队伍副本；此案不再邀请或刷新，本周不能换案重复邀请。'); return;
  }
  if (SCENE_STEPS.includes(c.type)) {
    const a = r!.attempts[0]!, previous = a.evidence, step = c.type as WeatherWarlockStep;
    const outcome = step === 'CAST_WEATHER' ? ctx.check('knowledge', 16).tier : a.outcome;
    const replay = appendedReplay(s, step, outcome)!; a.steps.push(step); if (step === 'CAST_WEATHER') a.outcome = outcome;
    a.evidence = replay.evidence[id!]!; applyReceiptDelta(s, previous, a.evidence); l.practice = replay.practice; r!.result = a.evidence.result;
    if (step === 'DISMISS_TEAM') dismissWeatherWarlockMembers(s);
    if (step === 'CLOSE') { r!.contactOpen = false; r!.closes = 1; r!.status = 'EXAMINED'; }
    const note = STEP_NOTES[step as Exclude<WeatherWarlockStep, 'INVITE_TEAM'>]; ctx.note(note[0], note[1] + (step === 'CAST_WEATHER' ? ` 本次${success(outcome) ? '成功' : '失败'}；实付${SP_COST[id!]}灵性。${success(outcome) ? '仍须实际观察才计能力结果。' : '本人及原五人各健康−1，停止后可普通完成。'}` : '')); return;
  }
  s.actionsRemaining--;
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('weather-warlock-reflection'); ctx.note('反思看不清、同一份水与真实波及', '三场真实报告后G扮演+25；局部天气不区分友军，停止不修复损坏，普通退路不能被成功文字替代。'); return; }
  if (!('caseId' in c)) throw new Error('未知天气术士生活命令。');
  const story = CASES.find(v => v.id === c.caseId)!;
  if (c.type === 'OBSERVE') { r!.status = 'OBSERVED'; r!.observedWeek = s.week; ctx.note(story.title, story.story + story.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r!.status = 'PREPARED'; r!.method = c.method; ctx.note('为有限天气与普通退路做准备', c.method === 'ABILITY' ? '准备本案一次能力尝试与失败后的普通收尾；尚未邀请、施术或取水。' : '准备普通核对/导流，尚未邀请或触碰原物。'); return; }
  if (c.type === 'REPORT') { r!.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`weather-warlock-case:${c.caseId}`); if (r!.result === 'ABILITY') { const abilityId = ABILITY_IDS[c.caseId]; s.progression.mastery[abilityId] = Math.min(500, (s.progression.mastery[abilityId] ?? 0) + 8); } ctx.note(story.title, `真实${r!.result === 'ABILITY' ? '能力观察' : '普通'}结果已经还物、散场及收束，G扮演+25；${r!.result === 'ABILITY' ? '仅本案实际新能力掌握+8。' : '没有新能力掌握。'}原伤、疲劳、余水和湿损继续保留。`); }
}
export function weatherWarlockLifeActions(s: SliceState): WeatherWarlockAction[] {
  if (!active(s)) return [];
  const out: WeatherWarlockAction[] = [], l = s.weatherWarlock.life;
  const add = (command: WeatherWarlockActivityCommand, label: string, cost: string) => { const reason = blockWeatherWarlockActivity(s, command); out.push({ id: `weather-warlock-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}`, command, label, cost, enabled: reason === null, reason }); };
  for (const item of CASES) {
    const r = l.cases[item.id], e = r.attempts[0]?.evidence;
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: item.id }, `观察：${item.title}`, '1行动');
    if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: item.id, method: 'ABILITY' }, '准备一次有限天气与普通后备', '1行动 · 本周须余2行动'); add({ type: 'PREPARE', caseId: item.id, method: 'ORDINARY' }, '准备普通原物比较', '1行动 · 本周须余2行动'); }
    if (r.status === 'PREPARED') { add({ type: 'INVITE_TEAM', caseId: item.id }, '实际邀请原G1五人到新院', '1行动 · 40便士 · 各1精力 · 20秒G'); add({ type: 'WITHDRAW', caseId: item.id }, '取消尚未邀请的准备', '0行动 · 不退行动'); }
    if (r.contactOpen && e) {
      if (!e.performed) add({ type: 'PERFORM', caseId: item.id }, '同一原工具与五人实际到工位', '0行动 · 各1精力 · 4米/8秒G');
      if (e.performed && !e.returned) {
        if (!e.warned) add({ type: 'WARN_READ_EXIT' }, '警告所有人并先读四米原出口牌', '0行动 · 5秒G · 不给穿雾视野');
        if (r.method === 'ABILITY' && !e.abilityAttempted && e.result === 'NONE') add({ type: 'CAST_WEATHER' }, '实际尝试本案一次局部天气', `0行动 · ${SP_COST[item.id]}灵性 · 各1精力 · 知识16 · 10秒G`);
        if (e.abilityAttempted && !e.stopped) { if (!e.effectObserved) add({ type: 'INSPECT_WEATHER' }, '检查对本人、原五人与原物的真实效果', '0行动 · 5秒G'); add({ type: 'STOP_WEATHER' }, '停止并实际等余雾/寒霜/风雨散尽', `0行动 · 实际${l.practice.weather.remainingSeconds}秒G · 不退款/修复`); }
        if (e.result === 'NONE') add({ type: 'ORDINARY_WORK' }, e.failed ? '保留失败，改用普通原物方式完成' : '普通核对或导流完成', '0行动 · 各1精力 · 15秒G');
        add({ type: 'RETURN_NEAR' }, '原五人与本人带同一原物走回近端', '0行动 · 各1精力 · 4米/8秒G'); add({ type: 'RETURN_TOOL' }, '亲手把本次同一原件归架', '0行动 · 5秒G');
      }
      if (!e.dismissed) add({ type: 'DISMISS_TEAM' }, '让本次原五人真正步行回家', '0行动 · 各1精力 · 20米/20秒G');
      add({ type: 'CLOSE', caseId: item.id }, '登记已经停止、还物及散场的收尾', '0行动 · 不自动搬运或补水');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: item.id }, '报告本案真实天气或普通观察', '1行动 · 扮演25 · 实际能力成功且观察才掌握8');
  }
  if (!l.reflected) add({ type: 'REFLECT' }, '反思三个有限天气边界', '1行动 · 三报告后扮演25');
  return out;
}
export function projectWeatherWarlockLife(s: SliceState): WeatherWarlockLifeProjection {
  const l = s.weatherWarlock.life, known = s.progression.pathwayId === 'hunter' && [3, 2, 1].includes(s.progression.sequence ?? 0) && s.warBishop.promotionWeek !== null;
  if (!known) return { title: '天气术士有限实践', source: '', environment: '', insideCase: false, reflected: false, practice: { ...freshPractice(), elapsedSeconds: 0 }, invitationWeeks: [], members: [], cases: [] };
  return { title: '原五人、同一份水与有限天气', source: '原著支持天气术士的迷雾、冰霜与风雨方向；本院三项有限效果不是原著完整能力表，所有数量、时间、成本与结果为原创G。', environment: WEATHER_WARLOCK_LIFE_ENVIRONMENT, insideCase: hasWeatherWarlockLifeLock(s), reflected: l.reflected,
    practice: { ...structuredClone(l.practice), elapsedSeconds: lastAttempt(s)?.evidence.elapsedSeconds ?? 0 }, invitationWeeks: WEATHER_WARLOCK_CASE_IDS.flatMap(id => l.cases[id].attempts.map(a => a.invitedWeek)),
    members: WEATHER_WARLOCK_MEMBER_IDS.map(id => { const m = findIronBloodMember(s, id)!; return { id, name: m.name, health: m.health, energy: m.energy, willing: m.willing, present: m.present, location: m.location, eligible: m.joined && m.willing && m.health >= 50 && m.energy >= 6 && !m.present && m.location === 'HOME', node: l.practice.memberNodes.find(n => n.id === id)?.node ?? null }; }),
    cases: CASES.map(item => { const r = l.cases[item.id], a = r.attempts[0]; return { id: item.id, title: item.title, story: item.story, observations: r.status === 'AVAILABLE' ? [] : [...item.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? '准备本案一次能力与普通退路，尚未邀请或施术。' : '准备普通原物比较，尚未邀请。' : null, result: r.result === 'NONE' ? a ? a.evidence.failed ? '本次能力真实失败，成本与小伤保留；仍可停止后普通完成。' : '尚无已核对的实际结果。' : null : `${r.result === 'ABILITY' ? '实际能力' : '普通'}结果已发生${r.contactOpen ? '，仍须停止天气、归还原物、散场并收束。' : '，原身体和原物已经收束。'}`, status: r.status, contactOpen: r.contactOpen, returned: a?.evidence.returned ?? false, closes: r.closes, attempts: r.attempts.map(attempt => ({ invitedWeek: attempt.invitedWeek, method: attempt.method, outcome: attempt.outcome, steps: [...attempt.steps], evidence: structuredClone(attempt.evidence) })) }; }) };
}
function validReceipt(a: WeatherWarlockAttempt): boolean {
  if (!record(a) || !shape(a, ['invitedWeek', 'method', 'outcome', 'steps', 'before', 'evidence']) || !Array.isArray(a.steps) || !record(a.evidence) || !record(a.before) || !shape(a.before, ['health', 'spirituality', 'actions', 'cash', 'members'])) return false;
  const b = a.before;
  return integer(b.health, 50, 100) && integer(b.spirituality, 0, 1000) && integer(b.actions, 1, 100) && integer(b.cash, 40) && Array.isArray(b.members) && b.members.length === 5 && b.members.every((m, i) => record(m) && shape(m, ['id', 'health', 'energy']) && m.id === WEATHER_WARLOCK_MEMBER_IDS[i] && integer(m.health, 50, 100) && integer(m.energy, 6, 20));
}
export function validateWeatherWarlockLife(s: SliceState): boolean {
  const l = s.weatherWarlock?.life;
  if (!record(l) || !shape(l, ['practice', 'cases', 'reflected']) || typeof l.reflected !== 'boolean' || !record(l.cases) || !shape(l.cases, WEATHER_WARLOCK_CASE_IDS)) return false;
  const promotion = s.weatherWarlock.promotionWeek; let prepared = 0, open = 0, resolved = 0;
  const weeks: number[] = [];
  for (const [index, id] of WEATHER_WARLOCK_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, ['status', 'observedWeek', 'method', 'result', 'contactOpen', 'closes', 'withdrawals', 'attempts']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || typeof r.contactOpen !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (!same(r, freshCase())) return false; }
    else if (promotion === null || !integer(r.observedWeek, promotion, s.week) || index > 0 && l.cases[WEATHER_WARLOCK_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if ((r.status === 'ACTIVE') !== r.contactOpen || (['AVAILABLE', 'OBSERVED', 'PREPARED'].includes(r.status) ? r.attempts.length !== 0 : r.attempts.length !== 1)) return false;
    if (['AVAILABLE', 'OBSERVED'].includes(r.status) ? r.method !== null : r.method === null) return false;
    if (r.status === 'PREPARED') prepared++;
    if (r.contactOpen) { open++; if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0 || s.world.city !== 'BACKLUND' || s.activeEvent || s.combat || oldSceneOpen(s) || s.weatherWarlock.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.weatherWarlock.encounter.status) || s.ironBloodKnight.team.restRequestedWeek !== null) return false; }
    const a = r.attempts[0];
    if (a) { if (!validReceipt(a) || !integer(a.invitedWeek, r.observedWeek ?? 0, s.week) || a.method !== r.method || r.contactOpen && a.invitedWeek !== s.week) return false; weeks.push(a.invitedWeek); }
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(v => v === `weather-warlock-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
  }
  if (prepared > 1 || open > 1 || prepared && open || new Set(weeks).size !== weeks.length) return false;
  const historicalWeeks = [...Object.values(s.warBishop.life.cases).flatMap(c => c.attempts.map(a => a.invitedWeek)), ...[s.warBishop.encounter.invitedWeek, s.weatherWarlock.encounter.invitedWeek].filter((w): w is number => w !== null)];
  if (weeks.some(w => historicalWeeks.includes(w))) return false;
  const replay = replayLife(l); if (!replay || !same(l.practice, replay.practice)) return false;
  for (const id of WEATHER_WARLOCK_CASE_IDS) {
    const r = l.cases[id], a = r.attempts[0], expected = replay.evidence[id];
    if (!a) { if (r.result !== 'NONE' || r.closes !== 0) return false; continue; }
    if (!expected || !same(a.evidence, expected) || r.result !== expected.result || r.closes !== (expected.closed ? 1 : 0) || r.contactOpen === expected.closed || ['EXAMINED', 'RESOLVED'].includes(r.status) && (expected.result === 'NONE' || !expected.closed)) return false;
    if (a.before.spirituality < expected.spiritualitySpent || a.before.members.some((m, i) => m.energy < expected.memberCosts[i]!.energySpent)) return false;
    if (r.contactOpen) {
      if (s.health !== a.before.health - expected.ownerDamage || s.spirituality !== a.before.spirituality - expected.spiritualitySpent || s.cash !== a.before.cash - 40 || s.actionsRemaining !== a.before.actions - 1) return false;
      if (WEATHER_WARLOCK_MEMBER_IDS.some((memberId, i) => { const m = findIronBloodMember(s, memberId), b = a.before.members[i]!, cost = expected.memberCosts[i]!; return !m || !m.joined || m.health !== b.health - cost.healthLoss || m.energy !== b.energy - cost.energySpent || m.present === expected.dismissed || m.location !== (expected.dismissed ? 'HOME' : 'YARD'); })) return false;
      if (s.ironBloodKnight.team.members.some(m => m.present && !(WEATHER_WARLOCK_MEMBER_IDS as readonly string[]).includes(m.id))) return false;
    }
  }
  const p = l.practice;
  if (p.reservoir.remainingMl + p.tray.liquidMl + p.tray.iceMl + p.basin.waterMl + p.fixture.wetMl + p.airborneMl + p.groundMl !== 6000) return false;
  if (l.reflected && resolved !== 3 || s.seer.completedSources.filter(v => v === 'weather-warlock-reflection').length !== (l.reflected ? 1 : 0)) return false;
  if (promotion === null && !same(l, createWeatherWarlockLifeState())) return false;
  // A later S2 chapter cannot revive the original S3 opponent or the player's S3 death.
  const old = s.warBishop.encounter;
  if (promotion !== null && old.terminal?.outcome === 'PLAYER_DEAD') return false;
  if (old.terminal?.enemyStatus === 'DEAD' && (old.enemyStatus !== 'DEAD' || old.enemyHealth !== 0 || old.terminal.enemyHealth !== 0)) return false;
  return true;
}
