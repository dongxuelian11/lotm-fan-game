import type { PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { findIronBloodMember, dismissIronBloodMembers, hasIronBloodRite } from '../iron-blood-knight/team.js';
import { ironBloodInside } from '../iron-blood-knight/life.js';
import type { WarBishopAction } from './types.js';

export const WAR_BISHOP_MEMBER_IDS = ['IB4-01', 'IB4-02', 'IB4-03', 'IB4-04', 'IB4-05'] as const;
export const WAR_BISHOP_CASE_IDS = ['glass-cart', 'fork-signals', 'lateral-load'] as const;
export type WarBishopCaseId = typeof WAR_BISHOP_CASE_IDS[number];
export type WarBishopNode = 'NEAR' | 'MID_A' | 'MID_B' | 'FAR';
export type WarBishopActivityCommand =
  | { type: 'OBSERVE' | 'INVITE_TEAM' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: WarBishopCaseId }
  | { type: 'PREPARE'; caseId: WarBishopCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'START_LINK' | 'STOP_LINK' | 'CARRY_OUT' | 'CARRY_BACK' | 'CHECK_SIGNALS' | 'PASS_FIRST' | 'PASS_SECOND' | 'WARN_LOAD' | 'SUPPORT_LOAD' | 'RELEASE_LOAD' | 'RETURN_NEAR' | 'RETURN_TOOL' | 'DISMISS_TEAM' | 'REFLECT' };
export interface WarBishopAttempt {
  invitedWeek: number; initialCargo: 'SEALED' | 'HALF' | 'DELIVERED'; method: 'ABILITY' | 'ORDINARY'; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  performed: boolean; closed: boolean; returned: boolean; dismissed: boolean; failed: boolean;
  linkStarted: boolean; abilityAttempted: boolean; elapsedSeconds: number; linkedSeconds: number;
  toolTravelMetres: number; completedTrips: number; signalStage: number; signalChecked: boolean;
  loadSupported: boolean; loadReleased: boolean; ownerDamage: number;
  /** Costs are an immutable account of expenditure, never a second current health/energy authority. */
  memberCosts: { id: string; healthLoss: number; energySpent: number }[];
}
export interface WarBishopCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; closes: number; withdrawals: number;
  attempts: WarBishopAttempt[];
}
export interface WarBishopPractice {
  activeCase: WarBishopCaseId | null; ownerNode: 'NEAR' | 'FAR';
  memberNodes: { id: string; node: WarBishopNode }[]; linkedMemberIds: string[]; linkRemainingSeconds: number;
  frame: { id: 'WB3-FRAME-1'; source: string; holder: 'RACK' | 'TEAM_NEAR' | 'TEAM_FAR'; cargo: 'SEALED' | 'HALF' | 'DELIVERED' };
  card: { id: 'WB3-CARD-1'; source: string; holder: string };
  load: { id: 'WB3-LOAD-1'; source: string; holder: 'RACK' | 'RIG'; phase: 'IDLE' | 'ARMED' | 'WARNED' | 'HELD' | 'RELEASED' };
}
export interface WarBishopLifeState { practice: WarBishopPractice; cases: Record<WarBishopCaseId, WarBishopCaseState>; reflected: boolean }
export interface WarBishopLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; reflected: boolean;
  practice: WarBishopPractice & { elapsedSeconds: number };
  invitationWeeks: number[];
  members: { id: string; name: string; health: number; energy: number; willing: boolean; present: boolean; location: 'HOME' | 'YARD'; eligible: boolean; node: WarBishopNode | null }[];
  cases: { id: WarBishopCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: boolean; returned: boolean; closes: number; attempts: WarBishopAttempt[] }[];
}
const FRAME_SOURCE = '原创G：原石院登记出借的唯一带封闭玻璃匣搬运框；编号WB3-FRAME-1，借用后原框归架，原玻璃匣送到三米远端承台。';
const CARD_SOURCE = '原创G：原石院两条净空岔路共用的唯一实体通行牌WB3-CARD-1，由近端保管架取借并归还。';
const LOAD_SOURCE = '原创G：原石院工具架登记的唯一带安全止挡侧向训练机械WB3-LOAD-1；从近端架推到固定工位，预告一次有限机械力，卸载后推回原架。';
const CASES = [
  { id: 'glass-cart', title: '碎玻璃车：五个实际受力点', story: '原车上的玻璃匣需要送到三米外的承台。五位原同伴分别托住同一登记搬运框的受力点，联系帮助彼此调整承托，而不是把五人的力量全塞进你一个身体。普通方式可分两趟送完。（原创G）', facts: ['取借同一WB3-FRAME-1；能力整框去3米、空框回3米，普通拆为两趟，每趟去回6米。', '能力去程知识14；实际失败本人及原01/02各受1健康小伤，安全承台接住原框，不让玻璃伤人致死。', '每次去程及空框返程，五人各耗1精力；返程不需要能力，不能用收束按钮搬回远端原框。'] },
  { id: 'fork-signals', title: '岔口：同一通行牌的两路接力', story: '净空石院两条各三米普通路在近远端相会。原01/05在近端、02在A路中点、03在远端、04在B路中点；目光和可见手势配合原通行牌的真实接手。联系不提供看不见的消息，也不传送牌或人。（原创G）', facts: ['先由01亲走A路前半段把原牌交02，再由02走到远端交03；之后03沿B路交04，04回近端交05。', '能力第一段感知14；普通方式必须先叫停、目视核对两路才放行。失败保留真实疲劳，可沿普通路退回。', '两段原牌各移动3米，身体分别沿所在净空路退回；最终05把同一原牌交本人，再亲手归架。'] },
  { id: 'lateral-load', title: '侧向机械：五人分点支撑', story: '把唯一登记训练机械推入近端固定工位，原01/02、03/04与05分守三个支点。先发出可见负载预告，再选择协同抵抗一次受控侧向力，或普通卸载后退回。这里没有天气术。（原创G）', facts: ['WB3-LOAD-1只有一次明确预告的机械负载；能力体魄14，五位原同伴真正分点受力。', '支撑每人1精力；失败本人及原01/02各受1健康小伤，机械安全止挡接住负载。', '必须明确卸载，再让身体回近端并把原机械归架；普通直接卸载/退回同样形成比较结果。'] },
] as const;
export const WAR_BISHOP_LIFE_ENVIRONMENT = '三场原创G有限实践；只引用原G1五位成年人，H/E/意愿/位置唯一保存在原队伍表。观察、准备各1行动；每场重新邀请1行动40便士，包含有限作业及普通收束时间，实施和子步骤0行动仍真实付资源。每人每真实周只参加一场；原结束邀请不等于当前在场。一次联结5灵性、每人2精力，60秒、6米均G；没有军职授予、全军复制能力或天气权柄。每报告扮演25，三案反思25；仅真实成功的新能力获得指定掌握8。';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 3;
const sameIds = (ids: unknown, expected: readonly string[]) => Array.isArray(ids) && ids.length === expected.length && ids.every((id, i) => id === expected[i]);
const freshCase = (): WarBishopCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, closes: 0, withdrawals: 0, attempts: [] });
const lastAttempt = (s: SliceState): WarBishopAttempt | null => { const l = s.warBishop.life; return l.practice.activeCase ? l.cases[l.practice.activeCase].attempts.at(-1) ?? null : null; };
const allNear = (s: SliceState) => s.warBishop.life.practice.ownerNode === 'NEAR' && s.warBishop.life.practice.memberNodes.every(m => m.node === 'NEAR');
const toolsReturned = (s: SliceState) => { const p = s.warBishop.life.practice; return p.frame.holder === 'RACK' && p.card.holder === 'RACK' && p.load.holder === 'RACK'; };
export function createWarBishopLifeState(): WarBishopLifeState {
  return { practice: { activeCase: null, ownerNode: 'NEAR', memberNodes: [], linkedMemberIds: [], linkRemainingSeconds: 0,
    frame: { id: 'WB3-FRAME-1', source: FRAME_SOURCE, holder: 'RACK', cargo: 'SEALED' },
    card: { id: 'WB3-CARD-1', source: CARD_SOURCE, holder: 'RACK' }, load: { id: 'WB3-LOAD-1', source: LOAD_SOURCE, holder: 'RACK', phase: 'IDLE' } },
    cases: { 'glass-cart': freshCase(), 'fork-signals': freshCase(), 'lateral-load': freshCase() }, reflected: false };
}
export function hasWarBishopLifeLock(s: SliceState): boolean {
  const l = s.warBishop?.life; return !!l && (l.practice.activeCase !== null || Object.values(l.cases).some(c => c.status === 'PREPARED') || l.practice.memberNodes.length > 0 || l.practice.linkedMemberIds.length > 0 || !toolsReturned(s));
}
export function warBishopTeamReady(s: SliceState, where: 'HOME' | 'YARD', minimumEnergy = 6): boolean {
  return WAR_BISHOP_MEMBER_IDS.every(id => { const m = findIronBloodMember(s, id); return !!m && m.joined && m.willing && m.health >= 50 && m.energy >= minimumEnergy && m.location === where && m.present === (where === 'YARD'); });
}
/** Shared by life and encounter: callers validate their own scene and record their own invitation. */
export function blockWarBishopTeamInvite(s: SliceState): string | null {
  if (s.status !== 'ACTIVE' || !active(s) || s.health <= 0 || s.mind <= 0) return '本人须仍活着且已晋战争主教，身心能够承担邀请。';
  if (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat) return '先处理事件/战斗，并实际回贝克兰德原石院。';
  if (s.ironBloodKnight.team.restRequestedWeek !== null || hasIronBloodRite(s) || ironBloodInside(s) || Object.values(s.ironBloodKnight.life.cases).some(c => c.status === 'PREPARED') || ['READY', 'FIGHTING'].includes(s.ironBloodKnight.encounter.status) || s.warBishop.preparedWeek !== null) return '先结束原准备、仪式、旧现场或跨周休整。';
  if (s.ironBloodKnight.team.members.some(m => m.present) || !warBishopTeamReady(s, 'HOME')) return '五位原同伴须当前自愿、已加入、健康至少50、精力至少6且在家；不能借旧邀请当当前到场。';
  if (Object.values(s.warBishop.life.cases).some(c => c.attempts.some(a => a.invitedWeek === s.week)) || s.warBishop.encounter.invitedWeek === s.week) return '原五人本真实周已参加另一场或本场；须真实下一周再邀请，不重置伤势和疲劳。';
  if (s.actionsRemaining < 1 || s.cash < 40) return '本次重新邀请需要1行动和40便士。';
  return null;
}
export function arriveWarBishopMembers(s: SliceState): void { for (const id of WAR_BISHOP_MEMBER_IDS) { const m = findIronBloodMember(s, id); if (!m) throw new Error('缺少原G1成员。'); m.present = true; m.location = 'YARD'; } }
export function dismissWarBishopMembers(s: SliceState): void { dismissIronBloodMembers(s, WAR_BISHOP_MEMBER_IDS); }
export function validateWarBishopActivityCommand(v: unknown): v is WarBishopActivityCommand {
  if (!record(v)) return false;
  if (['START_LINK', 'STOP_LINK', 'CARRY_OUT', 'CARRY_BACK', 'CHECK_SIGNALS', 'PASS_FIRST', 'PASS_SECOND', 'WARN_LOAD', 'SUPPORT_LOAD', 'RELEASE_LOAD', 'RETURN_NEAR', 'RETURN_TOOL', 'DISMISS_TEAM', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (!WAR_BISHOP_CASE_IDS.includes(v.caseId as WarBishopCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'INVITE_TEAM', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export function blockWarBishopActivity(s: SliceState, c: WarBishopActivityCommand): string | null {
  if (!validateWarBishopActivityCommand(c)) return '战争主教生活命令无效。';
  if (s.status !== 'ACTIVE' || !active(s)) return '须本人仍活着且已成为战争主教。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理事件/战斗并实际回原石院。';
  if (hasIronBloodRite(s) || ironBloodInside(s) || Object.values(s.ironBloodKnight.life.cases).some(r => r.status === 'PREPARED') || ['READY', 'FIGHTING'].includes(s.ironBloodKnight.encounter.status) || ['READY', 'FIGHTING'].includes(s.warBishop.encounter.status) || s.warBishop.preparedWeek !== null || Object.values(s.reaper.cases).some(r => r.contactOpen || r.status === 'PREPARED' || r.practice.windowOpen) || Object.values(s.conspirator.cases).some(r => r.contactOpen || r.status === 'PREPARED')) return '先结束另一个实际现场、晋升准备或旧接触。';
  const l = s.warBishop.life, p = l.practice, r = 'caseId' in c ? l.cases[c.caseId] : p.activeCase ? l.cases[p.activeCase] : null, a = lastAttempt(s);
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    if (!r?.contactOpen || p.activeCase !== c.caseId || !a) return '没有这一项尚未收束的本次现场。';
    return !allNear(s) || !toolsReturned(s) || p.linkedMemberIds.length || p.memberNodes.length || !a.dismissed ? '先普通返回、归还三件原物、解除联系并明确散场；结束按钮不移动人或物。' : null;
  }
  if (c.type === 'RETURN_NEAR') return !a || !a.performed || a.dismissed ? '须本次实际取借后仍在场。' : p.activeCase === 'lateral-load' && !a.loadReleased ? '先明确卸下机械负载，再沿原路退回。' : allNear(s) && (p.activeCase !== 'fork-signals' || p.card.holder === 'OWNER') ? '原身体和原物已经在近端，不重复移动刷消耗。' : null;
  if (c.type === 'RETURN_TOOL') return !a || !a.performed || !allNear(s) || toolsReturned(s) ? '本人、原同伴和待归还原物须实际在近端。' : p.activeCase === 'lateral-load' && !a.loadReleased ? '先卸下原机械负载。' : null;
  if (c.type === 'STOP_LINK') return p.linkedMemberIds.length === 0 ? '没有尚在持续的本次联系。' : !allNear(s) || p.frame.holder === 'TEAM_FAR' ? '先让所有原身体与原物沿普通路回近端，再解除联系。' : null;
  if (c.type === 'DISMISS_TEAM') return !a || a.dismissed || p.memberNodes.length !== 5 ? '没有本次尚在场的原五位同伴。' : !allNear(s) || !toolsReturned(s) || p.linkedMemberIds.length ? '先普通返回、归还原物并解除联系，散场才回家。' : null;
  if (c.type === 'CARRY_BACK') return !a || p.activeCase !== 'glass-cart' || p.frame.holder !== 'TEAM_FAR' ? '原五人与同一搬运框须实际在远端。' : null;
  if (c.type === 'RELEASE_LOAD') return !a || p.activeCase !== 'lateral-load' || !['WARNED', 'HELD'].includes(p.load.phase) ? '先实际取借、明确预告原机械负载，不能重复卸载。' : null;
  if (s.health < 50 || s.mind <= 0) return '本场安全作业须本人健康至少50且精神尚存；普通返回、还物、卸载和散场仍可完成。';
  if (c.type === 'PERFORM') return !a || p.activeCase !== c.caseId || a.performed || a.dismissed ? '须这次付费邀请到场后再实际取借原物，且只实施一次。' : !warBishopTeamReady(s, 'YARD') ? '当前五位实际同伴须仍同意、健康至少50且精力至少6。' : null;
  if (c.type === 'START_LINK') return !a || !a.performed || a.dismissed || a.linkStarted || a.failed || a.abilityAttempted || a.method !== 'ABILITY' || a.returned ? '须本次能力准备、实际实施且尚未施术；一场只开启一次联系。' : !warBishopTeamReady(s, 'YARD') ? '五位原同伴当前须同意、健康至少50且精力至少6并实际在院。' : s.spirituality < 5 ? '实际联结需要5灵性。' : null;
  const work = ['CARRY_OUT', 'CHECK_SIGNALS', 'PASS_FIRST', 'PASS_SECOND', 'WARN_LOAD', 'SUPPORT_LOAD'].includes(c.type);
  if (work) {
    if (!a || !a.performed || a.returned || a.dismissed || a.failed || !r?.contactOpen || !warBishopTeamReady(s, 'YARD', 1)) return '须原五人仍同意且当前健康/精力足够；失败后先实际收束，本周不能重试。';
    if (c.type === 'CARRY_OUT') {
      if (p.activeCase !== 'glass-cart' || p.frame.holder !== 'TEAM_NEAR' || !allNear(s) || a.completedTrips >= (a.method === 'ABILITY' || a.initialCargo === 'HALF' ? 1 : 2)) return '须同一原框与五人在近端，且还有本次未送完的原玻璃匣。';
      return a.method === 'ABILITY' && (p.linkRemainingSeconds < 15 || p.linkedMemberIds.length !== 5) ? '本次能力承托需要仍有效的实际联系和至少15秒；也可安全还物后改下周普通方式。' : null;
    }
    if (c.type === 'CHECK_SIGNALS') return p.activeCase !== 'fork-signals' || a.method !== 'ORDINARY' || a.signalChecked ? '普通路线在通行前实际叫停核对一次。' : null;
    if (c.type === 'PASS_FIRST' || c.type === 'PASS_SECOND') {
      if (p.activeCase !== 'fork-signals' || a.signalStage !== (c.type === 'PASS_FIRST' ? 0 : 1) || p.card.holder !== (c.type === 'PASS_FIRST' ? 'IB4-01' : 'IB4-03')) return '原牌必须由本段起点那位原同伴实际持有，并按两路先后接力。';
      return a.method === 'ORDINARY' ? a.signalChecked ? null : '先实际叫停，目视核对两条三米净空路。' : p.linkRemainingSeconds < 10 || p.linkedMemberIds.length !== 5 ? '须本次仍有效的五人联系，且有至少10秒完成本段。' : null;
    }
    if (c.type === 'WARN_LOAD') return p.activeCase !== 'lateral-load' || p.load.phase !== 'ARMED' ? '须原机械已实际移入工位，且本场尚未预告负载。' : null;
    if (c.type === 'SUPPORT_LOAD') return p.activeCase !== 'lateral-load' || p.load.phase !== 'WARNED' || a.method !== 'ABILITY' || a.loadSupported ? '须已经预告的原机械、能力准备和本次尚未进行的分点支撑。' : p.linkRemainingSeconds < 15 || p.linkedMemberIds.length !== 5 ? '须真实五人联系并剩余至少15秒，不能把普通卸载伪称能力抵抗。' : null;
  }
  if (p.activeCase !== null) return '先收束当前实际现场。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一项已支付准备。';
  if (c.type === 'INVITE_TEAM') return r?.status !== 'PREPARED' ? '先观察并明确准备本项方法。' : blockWarBishopTeamInvite(s);
  if (s.ironBloodKnight.team.restRequestedWeek !== null || s.ironBloodKnight.team.members.some(m => m.present)) return '先完成跨周休整或让已有到场人员散场。';
  if (s.actionsRemaining < 1) return '这项观察、准备、报告或反思需要1行动。';
  if (c.type === 'REFLECT') return l.reflected || !WAR_BISHOP_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? '先完成三项真实报告；反思只结算一次。' : null;
  if (!('caseId' in c)) return '当前没有对应原现场。';
  const index = WAR_BISHOP_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return r?.status !== 'AVAILABLE' || index > 0 && l.cases[WAR_BISHOP_CASE_IDS[index - 1]!].status !== 'RESOLVED' ? '依序观察新情境，已经观察的原情境不重复收费。' : null;
  if (c.type === 'PREPARE') return r?.status !== 'OBSERVED' ? '须已经观察且当前没有准备或已结案。' : r.attempts.some(t => t.invitedWeek === s.week) ? '本周真实尝试已留档，须下一真实周再准备。' : s.actionsRemaining < 2 ? '准备实际消耗1行动，须本周至少余2行动，另留1行动给原五人本次邀请。' : null;
  if (c.type === 'REPORT') return r?.status === 'EXAMINED' && r.result !== 'NONE' ? null : '先完成真实结果、还物、散场并收束，失败不能报告成功。';
  return '本项命令当前不可用。';
}
function elapse(s: SliceState, seconds: number): void {
  const a = lastAttempt(s)!, p = s.warBishop.life.practice;
  a.elapsedSeconds += seconds;
  if (p.linkedMemberIds.length) { const used = Math.min(seconds, p.linkRemainingSeconds); a.linkedSeconds += used; p.linkRemainingSeconds -= used; if (!p.linkRemainingSeconds) p.linkedMemberIds = []; }
}
function spendEnergy(s: SliceState, ids: readonly string[], amount: number): void {
  const a = lastAttempt(s)!;
  for (const id of ids) { const m = findIronBloodMember(s, id)!, spent = Math.min(m.energy, amount); m.energy -= spent; a.memberCosts.find(v => v.id === id)!.energySpent += spent; }
}
function minorFailure(s: SliceState): void {
  const a = lastAttempt(s)!; a.failed = true; s.health -= 1; a.ownerDamage += 1;
  for (const id of WAR_BISHOP_MEMBER_IDS.slice(0, 2)) { const m = findIronBloodMember(s, id)!; m.health -= 1; a.memberCosts.find(v => v.id === id)!.healthLoss += 1; }
}
function result(s: SliceState, value: 'ABILITY' | 'ORDINARY'): void { const l = s.warBishop.life, a = lastAttempt(s)!; a.result = value; l.cases[l.practice.activeCase!].result = value; }
function moveNear(s: SliceState): void {
  const p = s.warBishop.life.practice, a = lastAttempt(s)!;
  if (p.frame.holder === 'TEAM_FAR') { p.frame.holder = 'TEAM_NEAR'; a.toolTravelMetres += 3; spendEnergy(s, WAR_BISHOP_MEMBER_IDS, 1); }
  if (p.activeCase === 'fork-signals') { if (p.card.holder !== 'OWNER' && p.card.holder !== 'RACK') { if (p.card.holder === 'IB4-03') a.toolTravelMetres += 3; p.card.holder = 'OWNER'; } }
  p.ownerNode = 'NEAR'; for (const member of p.memberNodes) member.node = 'NEAR'; elapse(s, 10);
}
export function applyWarBishopActivity(s: SliceState, c: WarBishopActivityCommand, ctx: SeerContext): void {
  const reason = blockWarBishopActivity(s, c); if (reason) throw new Error(reason);
  const l = s.warBishop.life, p = l.practice, r = 'caseId' in c ? l.cases[c.caseId] : p.activeCase ? l.cases[p.activeCase] : null, a = lastAttempt(s);
  if (c.type === 'WITHDRAW' && r!.status === 'PREPARED') { r!.status = 'OBSERVED'; r!.method = null; r!.withdrawals++; ctx.note('取消尚未邀请的准备', '准备行动不返还；原五人仍在家，原物未取借。'); return; }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a!.closed = true; r!.contactOpen = false; r!.closes++; r!.status = r!.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; if (c.type === 'WITHDRAW') r!.withdrawals++; p.activeCase = null; p.linkRemainingSeconds = 0; ctx.note('原五人和原物已实际收束', '同伴已沿原路回家、原工具已归架；本次成本、失败和小伤保留，没有治疗或费用返还。'); return; }
  if (c.type === 'RETURN_NEAR' || c.type === 'CARRY_BACK') { moveNear(s); ctx.note('原身体与原物沿普通路回近端', '实际走过净空原路；同一搬运框/通行牌随持有人移动，没有传送、复制或补回健康精力。'); return; }
  if (c.type === 'RETURN_TOOL') { if (p.activeCase === 'glass-cart') p.frame.holder = 'RACK'; if (p.activeCase === 'fork-signals') p.card.holder = 'RACK'; if (p.activeCase === 'lateral-load') p.load.holder = 'RACK'; a!.returned = true; elapse(s, 5); ctx.note('亲手归还本次同一原件', '唯一登记原件回到原保管架，借用关系结束；旧铁血梁与箱的原归属完全未改。'); return; }
  if (c.type === 'STOP_LINK') { p.linkedMemberIds = []; p.linkRemainingSeconds = 0; ctx.note('在近端明确解除本次联系', '五位原身体和原物都已在近端。解除不移动身体，不恢复伤势、精力或灵性；同伴仍在院，尚须明确散场。'); return; }
  if (c.type === 'DISMISS_TEAM') { dismissWarBishopMembers(s); p.memberNodes = []; a!.dismissed = true; if (!a!.performed) a!.returned = true; ctx.note('原五人实际散场回家', '本次到场已结束。原H/E与当前意愿保留；历史邀请不再代表当前在场，本真实周不能换场再邀请。'); return; }
  if (c.type === 'START_LINK') { s.spirituality -= 5; spendEnergy(s, WAR_BISHOP_MEMBER_IDS, 2); p.linkedMemberIds = [...WAR_BISHOP_MEMBER_IDS]; p.linkRemainingSeconds = 60; a!.linkStarted = true; ctx.note('五个实际受力身体建立有限联系', '实际支付5灵性与原五人各2精力；G联系最多60秒、6米。五人仍各有原身体与普通动作，不获职业能力，不把力量全部集中到本人。'); return; }
  if (c.type === 'CARRY_OUT') {
    spendEnergy(s, WAR_BISHOP_MEMBER_IDS, 1); elapse(s, 15);
    if (a!.method === 'ABILITY') { a!.abilityAttempted = true; if (!success(ctx.check('knowledge', 14).tier)) { minorFailure(s); ctx.note('承托节奏失配，安全承台接住原框', '未离开近端；本人及原01/02各健康−1，五人各付1精力与实际联系成本。没有成功，原框须归还并散场。'); return; } }
    a!.completedTrips++; a!.toolTravelMetres += 3; p.ownerNode = 'FAR'; for (const member of p.memberNodes) member.node = 'FAR'; p.frame.holder = 'TEAM_FAR';
    p.frame.cargo = a!.method === 'ORDINARY' && a!.initialCargo === 'SEALED' && a!.completedTrips === 1 ? 'HALF' : 'DELIVERED'; if (p.frame.cargo === 'DELIVERED') result(s, a!.method);
    ctx.note('五人承托同一原框到三米远端', p.frame.cargo === 'HALF' ? '普通第一趟实际送达一半玻璃匣；须空框回近端，再送剩余原匣。' : '原玻璃匣全部送到原承台；原五人与同一空框仍在远端，须明确返程。'); return;
  }
  if (c.type === 'CHECK_SIGNALS') { a!.signalChecked = true; elapse(s, 15); ctx.note('叫停并目视核对两路', '五人逐一以可见手势确认当前净空，再同意先A路后B路；没有远知或心灵读取。'); return; }
  if (c.type === 'PASS_FIRST' || c.type === 'PASS_SECOND') {
    const first = c.type === 'PASS_FIRST'; spendEnergy(s, first ? ['IB4-01', 'IB4-02'] : ['IB4-03', 'IB4-04'], 1); elapse(s, 10);
    if (first && a!.method === 'ABILITY') { a!.abilityAttempted = true; if (!success(ctx.check('perception', 14).tier)) { a!.failed = true; ctx.note('原信号未能可靠接续', '01仍持原牌停在近端，已经付出的联系与疲劳保留；其余人在原位置，须逐人沿普通路退回，不补写成功。'); return; } }
    a!.signalStage++; a!.toolTravelMetres += 3;
    if (first) { p.memberNodes[0]!.node = 'MID_A'; p.memberNodes[1]!.node = 'FAR'; p.card.holder = 'IB4-03'; }
    else { p.memberNodes[2]!.node = 'MID_B'; p.memberNodes[3]!.node = 'NEAR'; p.card.holder = 'IB4-05'; result(s, a!.method); }
    ctx.note(first ? 'A路原牌接力到远端' : 'B路原牌接力回近端', first ? '01亲走1.5米交02，02再亲走1.5米交03；同一原牌现在03手中。' : '03亲走B路1.5米交04，04再走1.5米交05；同一原牌现在近端05手中，其他原身体尚须实际退回。'); return;
  }
  if (c.type === 'WARN_LOAD') { p.load.phase = 'WARNED'; elapse(s, 5); ctx.note('明确预告一次侧向机械力', '五个原身体在三个支点看见预告；机械安全止挡已就位。可明确支撑或普通卸载退出，没有无预告天气攻击。'); return; }
  if (c.type === 'SUPPORT_LOAD') { a!.abilityAttempted = true; a!.loadSupported = true; spendEnergy(s, WAR_BISHOP_MEMBER_IDS, 1); elapse(s, 15); p.load.phase = 'HELD'; const ok = success(ctx.check('physique', 14).tier); if (ok) result(s, 'ABILITY'); else minorFailure(s); ctx.note('五人分点抵抗原机械侧向负载', ok ? '五人实际协同托住三个支点，各付1精力；这是有限机械协作，仍须明确卸载。' : '本次失配，安全止挡承接；本人及原01/02各健康−1，已付疲劳保留，仍须明确卸载。'); return; }
  if (c.type === 'RELEASE_LOAD') { p.load.phase = 'RELEASED'; a!.loadReleased = true; if (a!.method === 'ORDINARY' && !a!.loadSupported) { spendEnergy(s, WAR_BISHOP_MEMBER_IDS, 1); result(s, 'ORDINARY'); } elapse(s, 5); ctx.note('实际卸下原机械负载', '机械力已解除；原身体仍在三个支点，须沿原地面退回近端并把同一机械推回保管架。卸载没有治疗。'); return; }
  if (c.type === 'INVITE_TEAM') {
    s.actionsRemaining--; s.cash -= 40; arriveWarBishopMembers(s); p.activeCase = c.caseId; p.memberNodes = WAR_BISHOP_MEMBER_IDS.map(id => ({ id, node: 'NEAR' }));
    r!.status = 'ACTIVE'; r!.contactOpen = true; r!.result = 'NONE';
    r!.attempts.push({ invitedWeek: s.week, initialCargo: c.caseId === 'glass-cart' ? p.frame.cargo : 'SEALED', method: r!.method!, result: 'NONE', performed: false, closed: false, returned: false, dismissed: false, failed: false, linkStarted: false, abilityAttempted: false, elapsedSeconds: 0, linkedSeconds: 0, toolTravelMetres: 0, completedTrips: 0, signalStage: 0, signalChecked: false, loadSupported: false, loadReleased: false, ownerDamage: 0, memberCosts: WAR_BISHOP_MEMBER_IDS.map(id => ({ id, healthLoss: 0, energySpent: 0 })) });
    ctx.note('重新邀请原G1五人实际到院', '1行动、40便士已付；逐一核对当前意愿、健康和精力后，同一01至05从HOME实际到YARD。邀请预算包含本次有限操作和普通安全收束；尚未借原物或建立联系。'); return;
  }
  if (c.type === 'PERFORM') {
    a!.performed = true;
    if (c.caseId === 'glass-cart') { p.frame.holder = 'TEAM_NEAR'; }
    if (c.caseId === 'fork-signals') { p.card.holder = 'IB4-01'; p.memberNodes[1]!.node = 'MID_A'; p.memberNodes[2]!.node = 'FAR'; p.memberNodes[3]!.node = 'MID_B'; }
    if (c.caseId === 'lateral-load') { p.load.holder = 'RIG'; p.load.phase = 'ARMED'; p.memberNodes[2]!.node = 'MID_A'; p.memberNodes[3]!.node = 'MID_A'; p.memberNodes[4]!.node = 'MID_B'; }
    elapse(s, 5); ctx.note('同一原件实际取借与分工', `${c.caseId === 'glass-cart' ? FRAME_SOURCE : c.caseId === 'fork-signals' ? CARD_SOURCE : LOAD_SOURCE}五人按本场有限位置亲自站好；能力还未启动。`); return;
  }
  s.actionsRemaining--;
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('war-bishop-reflection'); ctx.note('反思五个身体的有限协作', '真实托框、依次交牌、预告负载各有不同反馈；有限联系不会赋予全军法术或替代普通退路。G扮演+25，不额外赠掌握。'); return; }
  if (!('caseId' in c)) throw new Error('未知战争主教生活命令。');
  const story = CASES.find(v => v.id === c.caseId)!;
  if (c.type === 'OBSERVE') { r!.status = 'OBSERVED'; r!.observedWeek = s.week; ctx.note(story.title, story.story + story.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r!.status = 'PREPARED'; r!.method = c.method; ctx.note('准备有限方法，原同伴仍在家', c.method === 'ABILITY' ? '准备实际五人联系和普通安全退路；尚未邀请、扣灵性或触碰原工具。' : '准备普通分趟、先停核对或卸载退回；不会把普通成果伪称施术。'); return; }
  if (c.type === 'REPORT') {
    r!.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`war-bishop-case:${c.caseId}`);
    if (r!.result === 'ABILITY') { const id = c.caseId === 'lateral-load' ? 'hunter.s3.formation-link' : 'hunter.s3.coordinated-action'; s.progression.mastery[id] = Math.min(500, s.progression.mastery[id]! + 8); }
    ctx.note(story.title, `已经真实收束的${r!.result === 'ABILITY' ? '能力' : '普通'}结果形成G扮演+25。${r!.result === 'ABILITY' ? '实际用到的新能力掌握+8。' : '没有能力掌握奖励。'}原同伴伤势、疲劳与失败记录继续保留。`);
  }
}
export function warBishopLifeActions(s: SliceState): WarBishopAction[] {
  if (!active(s)) return [];
  const out: WarBishopAction[] = [], l = s.warBishop.life;
  const add = (command: WarBishopActivityCommand, label: string, cost: string) => { const reason = blockWarBishopActivity(s, command); out.push({ id: `war-bishop-life-${'caseId' in command ? `${command.caseId}-` : ''}${command.type.toLowerCase()}${'method' in command ? `-${command.method.toLowerCase()}` : ''}`, command, label, cost, enabled: reason === null, reason }); };
  for (const item of CASES) {
    const r = l.cases[item.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: item.id }, `观察：${item.title}`, '1行动');
    if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: item.id, method: 'ABILITY' }, '准备五人实际能力协作', '1行动 · 本周须余2行动，另留1邀请 · 尚未到场或施术'); add({ type: 'PREPARE', caseId: item.id, method: 'ORDINARY' }, '准备普通实物比较', '1行动 · 本周须余2行动，另留1邀请 · 不施术'); }
    if (r.status === 'PREPARED') { add({ type: 'INVITE_TEAM', caseId: item.id }, '重新邀请原G1五人到场', '1行动 · 40便士 · 含有限作业和普通收束时间'); add({ type: 'WITHDRAW', caseId: item.id }, '取消未实施准备', '0行动 · 不退款'); }
    if (r.contactOpen) {
      const a = r.attempts.at(-1)!;
      if (!a.performed) add({ type: 'PERFORM', caseId: item.id }, '实际取借原件并逐人站位', '0行动 · 已付本次预算 · 实际5秒');
      else if (!a.returned) {
        if (a.method === 'ABILITY' && !a.linkStarted) add({ type: 'START_LINK' }, '联结本次真正到场的五位原成员', '0行动 · 5灵性 · 每人2精力 · 60秒/6米G');
        if (item.id === 'glass-cart') { add({ type: 'CARRY_OUT' }, a.completedTrips ? '普通第二趟托原框送余下玻璃匣' : '五人共同承托原框去三米远端', '0行动 · 15秒 · 每人1精力 · 能力知识14'); add({ type: 'CARRY_BACK' }, '五人与同一空框普通走回三米', '0行动 · 10秒 · 每人1精力'); }
        if (item.id === 'fork-signals') { if (a.method === 'ORDINARY') add({ type: 'CHECK_SIGNALS' }, '先叫停并目视核对两路', '0行动 · 15秒'); add({ type: 'PASS_FIRST' }, '沿A路把原牌依次交02和03', '0行动 · 原牌3米 · 10秒 · 01/02各1精力'); add({ type: 'PASS_SECOND' }, '沿B路把同一原牌交04和05', '0行动 · 原牌3米 · 10秒 · 03/04各1精力'); }
        if (item.id === 'lateral-load') { add({ type: 'WARN_LOAD' }, '发出原机械本次负载预告', '0行动 · 5秒'); if (a.method === 'ABILITY') add({ type: 'SUPPORT_LOAD' }, '原五人分点抵抗侧向机械力', '0行动 · 15秒 · 各1精力 · 体魄14'); add({ type: 'RELEASE_LOAD' }, '明确卸下原机械负载', '0行动 · 5秒 · 普通每人1精力'); }
        add({ type: 'RETURN_NEAR' }, '逐人沿普通路带原物退回近端', '0行动 · 10秒 · 不靠联系/灵性'); add({ type: 'RETURN_TOOL' }, '亲手归还本次同一原件', '0行动 · 5秒');
      }
      if (l.practice.linkedMemberIds.length) add({ type: 'STOP_LINK' }, '在近端明确解除五人联系', '0行动 · 伤势精力不返还');
      if (!a.dismissed) add({ type: 'DISMISS_TEAM' }, '让本次原五人真正散场回家', '0行动 · 须返近端、还原物、断联');
      add({ type: 'CLOSE', caseId: item.id }, '收束已实际还物和散场的现场', '0行动 · 不移动人或物');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: item.id }, '报告真实完成的本场结果', '1行动 · 扮演25 · 真能力成功才有掌握8');
  }
  if (!l.reflected) add({ type: 'REFLECT' }, '反思三个不同的有限协作经历', '1行动 · 三报告后扮演25');
  return out;
}
export function projectWarBishopLife(s: SliceState): WarBishopLifeProjection {
  const l = s.warBishop.life;
  const known = s.progression.pathwayId === 'hunter' && [4, 3].includes(s.progression.sequence ?? 0) && s.ironBloodKnight.promotionWeek !== null;
  if (!known) return { title: '战争主教生活实践', source: '', environment: '', insideCase: false, reflected: false, practice: { ...createWarBishopLifeState().practice, elapsedSeconds: 0 }, invitationWeeks: [], members: [], cases: [] };
  return { title: '原五人的有限协作', source: '原著支持真实所属编队的血铁联结与协同抵抗；五人规模、距离、时间、预算与三场故事均为原创G。', environment: WAR_BISHOP_LIFE_ENVIRONMENT, insideCase: hasWarBishopLifeLock(s), reflected: l.reflected,
    practice: { ...structuredClone(l.practice), elapsedSeconds: lastAttempt(s)?.elapsedSeconds ?? 0 }, invitationWeeks: WAR_BISHOP_CASE_IDS.flatMap(id => l.cases[id].attempts.map(a => a.invitedWeek)),
    members: WAR_BISHOP_MEMBER_IDS.map(id => { const m = findIronBloodMember(s, id)!; return { id, name: m.name, health: m.health, energy: m.energy, willing: m.willing, present: m.present, location: m.location, eligible: m.joined && m.willing && m.health >= 50 && m.energy >= 6 && !m.present && m.location === 'HOME', node: l.practice.memberNodes.find(n => n.id === id)?.node ?? null }; }),
    cases: CASES.map(item => { const r = l.cases[item.id], a = r.attempts.at(-1); return { id: item.id, title: item.title, story: item.story, observations: r.status === 'AVAILABLE' ? [] : [...item.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? '准备本次真实五人联系，尚未邀请或施术。' : '准备普通实物方式。' : null, result: r.result === 'NONE' ? a ? '本次尚无成功结果，所有实际成本与失败保留。' : null : `${r.result === 'ABILITY' ? '实际能力' : '普通'}结果已发生${r.contactOpen ? '，尚须还物、断联和散场。' : '，原人原物已收束。'}`, status: r.status, contactOpen: r.contactOpen, returned: a?.returned ?? false, closes: r.closes, attempts: structuredClone(r.attempts) }; }) };
}
export function validateWarBishopLife(s: SliceState): boolean {
  const l = s.warBishop?.life;
  if (!record(l) || !shape(l, ['practice', 'cases', 'reflected']) || typeof l.reflected !== 'boolean' || !record(l.cases) || !shape(l.cases, WAR_BISHOP_CASE_IDS)) return false;
  const p = l.practice;
  if (!record(p) || !shape(p, ['activeCase', 'ownerNode', 'memberNodes', 'linkedMemberIds', 'linkRemainingSeconds', 'frame', 'card', 'load']) || ![null, ...WAR_BISHOP_CASE_IDS].includes(p.activeCase) || !['NEAR', 'FAR'].includes(p.ownerNode) || !Array.isArray(p.memberNodes) || ![0, 5].includes(p.memberNodes.length) || !Array.isArray(p.linkedMemberIds) || ![0, 5].includes(p.linkedMemberIds.length) || p.linkedMemberIds.length > 0 && !sameIds(p.linkedMemberIds, WAR_BISHOP_MEMBER_IDS) || !integer(p.linkRemainingSeconds, 0, 60) || (p.linkedMemberIds.length > 0) !== (p.linkRemainingSeconds > 0)) return false;
  if (p.memberNodes.some((m, i) => !record(m) || !shape(m, ['id', 'node']) || m.id !== WAR_BISHOP_MEMBER_IDS[i] || !['NEAR', 'MID_A', 'MID_B', 'FAR'].includes(m.node))) return false;
  if (!record(p.frame) || !shape(p.frame, ['id', 'source', 'holder', 'cargo']) || p.frame.id !== 'WB3-FRAME-1' || p.frame.source !== FRAME_SOURCE || !['RACK', 'TEAM_NEAR', 'TEAM_FAR'].includes(p.frame.holder) || !['SEALED', 'HALF', 'DELIVERED'].includes(p.frame.cargo)) return false;
  if (!record(p.card) || !shape(p.card, ['id', 'source', 'holder']) || p.card.id !== 'WB3-CARD-1' || p.card.source !== CARD_SOURCE || !['RACK', 'OWNER', ...WAR_BISHOP_MEMBER_IDS].includes(p.card.holder)) return false;
  if (!record(p.load) || !shape(p.load, ['id', 'source', 'holder', 'phase']) || p.load.id !== 'WB3-LOAD-1' || p.load.source !== LOAD_SOURCE || !['RACK', 'RIG'].includes(p.load.holder) || !['IDLE', 'ARMED', 'WARNED', 'HELD', 'RELEASED'].includes(p.load.phase)) return false;
  let open = 0, prepared = 0, resolved = 0;
  const invitationWeeks: number[] = [], promotion = s.warBishop.promotionWeek;
  for (const [index, id] of WAR_BISHOP_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, ['status', 'observedWeek', 'method', 'result', 'contactOpen', 'closes', 'withdrawals', 'attempts']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || typeof r.contactOpen !== 'boolean' || !integer(r.closes) || !integer(r.withdrawals) || !Array.isArray(r.attempts)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; }
    else if (promotion === null || !integer(r.observedWeek, promotion, s.week) || index > 0 && l.cases[WAR_BISHOP_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'PREPARED') { prepared++; if (r.method === null) return false; }
    if (r.contactOpen) { open++; if (p.activeCase !== id || !active(s) || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.combat || s.activeEvent || s.warBishop.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.warBishop.encounter.status) || ironBloodInside(s) || hasIronBloodRite(s) || s.ironBloodKnight.team.restRequestedWeek !== null) return false; }
    if ((r.status === 'ACTIVE') !== r.contactOpen) return false;
    for (const [i, a] of r.attempts.entries()) {
      if (!record(a) || !shape(a, ['invitedWeek', 'initialCargo', 'method', 'result', 'performed', 'closed', 'returned', 'dismissed', 'failed', 'linkStarted', 'abilityAttempted', 'elapsedSeconds', 'linkedSeconds', 'toolTravelMetres', 'completedTrips', 'signalStage', 'signalChecked', 'loadSupported', 'loadReleased', 'ownerDamage', 'memberCosts']) || !integer(a.invitedWeek, r.observedWeek ?? 0, s.week) || !['SEALED', 'HALF', 'DELIVERED'].includes(a.initialCargo) || !['ABILITY', 'ORDINARY'].includes(a.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(a.result) || ![a.performed, a.closed, a.returned, a.dismissed, a.failed, a.linkStarted, a.abilityAttempted, a.signalChecked, a.loadSupported, a.loadReleased].every(v => typeof v === 'boolean')) return false;
      if (!integer(a.elapsedSeconds, 0, 120) || !integer(a.linkedSeconds, 0, 60) || !integer(a.toolTravelMetres, 0, 12) || !integer(a.completedTrips, 0, a.method === 'ABILITY' ? 1 : 2) || !integer(a.signalStage, 0, 2) || !integer(a.ownerDamage, 0, 1) || !Array.isArray(a.memberCosts) || a.memberCosts.length !== 5) return false;
      if (a.memberCosts.some((v, n) => !record(v) || !shape(v, ['id', 'healthLoss', 'energySpent']) || v.id !== WAR_BISHOP_MEMBER_IDS[n] || !integer(v.healthLoss, 0, n < 2 ? 1 : 0) || !integer(v.energySpent, 0, 4))) return false;
      if (i > 0 && a.invitedWeek <= r.attempts[i - 1]!.invitedWeek || a.closed !== (i < r.attempts.length - 1 || !r.contactOpen) || a.closed && (!a.returned || !a.dismissed) || a.result === 'ABILITY' && (!a.linkStarted || !a.abilityAttempted || a.method !== 'ABILITY' || a.failed) || a.result === 'ORDINARY' && a.method !== 'ORDINARY' || a.linkStarted && (a.method !== 'ABILITY' || !a.performed) || a.abilityAttempted && !a.linkStarted || a.failed && a.result !== 'NONE') return false;
      if (!a.performed && (a.linkStarted || a.elapsedSeconds || a.completedTrips || a.signalStage || a.signalChecked || a.loadSupported || a.loadReleased || a.result !== 'NONE')) return false;
      if (id !== 'glass-cart' && a.completedTrips !== 0 || id !== 'fork-signals' && (a.signalStage !== 0 || a.signalChecked) || id !== 'lateral-load' && (a.loadSupported || a.loadReleased)) return false;
      if (a.result !== 'NONE' && (id === 'glass-cart' ? a.completedTrips !== (a.method === 'ABILITY' || a.initialCargo === 'HALF' ? 1 : 2) : id === 'fork-signals' ? a.signalStage !== 2 : a.method === 'ABILITY' ? !a.loadSupported : !a.loadReleased)) return false;
      invitationWeeks.push(a.invitedWeek);
    }
    const a = r.attempts.at(-1);
    if (r.result !== (a?.result ?? 'NONE') || r.closes !== r.attempts.filter(a => a.closed).length || r.contactOpen && (!a || a.invitedWeek !== s.week || a.method !== r.method)) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (!a || !a.closed || r.result === 'NONE') || r.status === 'RESOLVED' && r.contactOpen) return false;
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(v => v === `war-bishop-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
  }
  if (new Set(invitationWeeks).size !== invitationWeeks.length || s.warBishop.encounter.invitedWeek !== null && invitationWeeks.includes(s.warBishop.encounter.invitedWeek) || open > 1 || prepared > 1 || open > 0 && prepared > 0 || (p.activeCase !== null) !== (open === 1)) return false;
  if (p.activeCase === null) { if (p.ownerNode !== 'NEAR' || p.memberNodes.length || p.linkedMemberIds.length || !toolsReturned(s)) return false; }
  else {
    const a = lastAttempt(s)!;
    if (a.dismissed !== (p.memberNodes.length === 0) || a.returned && !toolsReturned(s) || !a.performed && !toolsReturned(s) || a.linkStarted === false && p.linkedMemberIds.length > 0 || p.linkRemainingSeconds > 0 && p.linkRemainingSeconds + a.linkedSeconds !== 60) return false;
    if (p.memberNodes.some(n => { const m = findIronBloodMember(s, n.id); return !m?.joined || !m.present || m.location !== 'YARD' || m.health <= 0; })) return false;
    if (p.activeCase !== 'glass-cart' && p.frame.holder !== 'RACK' || p.activeCase !== 'fork-signals' && p.card.holder !== 'RACK' || p.activeCase !== 'lateral-load' && p.load.holder !== 'RACK') return false;
    if (p.frame.holder === 'TEAM_FAR' && (p.ownerNode !== 'FAR' || p.memberNodes.some(m => m.node !== 'FAR')) || p.ownerNode === 'FAR' && p.frame.holder !== 'TEAM_FAR') return false;
    if (a.dismissed && WAR_BISHOP_MEMBER_IDS.some(id => findIronBloodMember(s, id)?.present)) return false;
    if (a.performed && !a.returned) {
      if (p.activeCase === 'glass-cart' && (p.frame.holder === 'RACK' || p.frame.holder === 'TEAM_NEAR' && !allNear(s))) return false;
      if (p.activeCase === 'fork-signals') {
        const expected = a.signalStage === 0 ? ['NEAR', 'MID_A', 'FAR', 'MID_B', 'NEAR'] : a.signalStage === 1 ? ['MID_A', 'FAR', 'FAR', 'MID_B', 'NEAR'] : ['MID_A', 'FAR', 'MID_B', 'NEAR', 'NEAR'];
        if (allNear(s) ? p.card.holder !== 'OWNER' : p.card.holder !== (a.signalStage === 0 ? 'IB4-01' : a.signalStage === 1 ? 'IB4-03' : 'IB4-05') || p.memberNodes.some((m, i) => m.node !== expected[i])) return false;
      }
      if (p.activeCase === 'lateral-load' && (p.load.holder !== 'RIG' || p.load.phase === 'IDLE' || a.loadReleased !== (p.load.phase === 'RELEASED') || !a.loadReleased && allNear(s))) return false;
    }
    if (a.returned && !allNear(s)) return false;
  }
  if (l.reflected && resolved !== 3 || s.seer.completedSources.filter(v => v === 'war-bishop-reflection').length !== (l.reflected ? 1 : 0)) return false;
  if (promotion === null && stableStringify(l) !== stableStringify(createWarBishopLifeState())) return false;
  return true;
}
