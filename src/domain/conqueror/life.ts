import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { applyIronBloodTeamCommand, blockIronBloodTeamCommand, IRON_BLOOD_ROSTER, type IronBloodTeamState } from '../iron-blood-knight/team.js';
import type { ConquerorAction } from './types.js';

export const CONQUEROR_MEMBER_IDS = ['IB4-01', 'IB4-02', 'IB4-03', 'IB4-04', 'IB4-05'] as const;
export const CONQUEROR_CASE_IDS = ['yard-cart', 'iron-target', 'withdrawn-permission'] as const;
export type ConquerorCaseId = typeof CONQUEROR_CASE_IDS[number];
type Method = 'ABILITY' | 'ORDINARY';
type Result = 'NONE' | Method;
export type ConquerorActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: ConquerorCaseId }
  | { type: 'INVITE_TEAM'; caseId: ConquerorCaseId; method: Method }
  | { type: 'ENTER_WORK' | 'APPLY_POWER' | 'COOL_DOWN' | 'ORDINARY_WORK' | 'RETURN_HOME' | 'ABORT' | 'REFLECT' | 'REST_TEAM' | 'RECOVER_TEAM' };
export interface ConquerorLifeBudget { health: number; mind: number; spirituality: number; cash: number; actions: number }
export interface ConquerorLifeCost { id: string; energySpent: number; healthLoss: number; walkedMetres: number }
export interface ConquerorLifeReceipt {
  week: number; date: PublicGameDate; revision: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; command: ConquerorActivityCommand; outcome: PublicResolutionTier | null;
  before: ConquerorLifeBudget; after: ConquerorLifeBudget; elapsedSeconds: number;
  ownerWalkedMetres: number; toolTravelMetres: number; memberCosts: ConquerorLifeCost[];
}
export interface ConquerorLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'PAUSED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; invitedWeek: number | null; invitationWeeks: number[]; method: Method | null;
  permission: 'UNKNOWN' | 'GRANTED' | 'WITHDRAWN'; result: Result;
  entered: boolean; abilityAttempted: boolean; abilityApplied: boolean;
  outcome: PublicResolutionTier | null; returned: boolean;
}
export interface ConquerorLifePractice {
  activeCase: ConquerorCaseId | null; ownerNode: 'ENTRY' | 'WORK'; elapsedSeconds: number;
  /** These are positions of the original roster entries, never a second set of members. */
  memberPositions: { id: string; node: 'ENTRY' | 'WORK'; distanceMetres: number }[];
  tools: { id: string; caseId: ConquerorCaseId; holder: 'RACK' | 'WORK' }[];
  cart: { id: 'CQ1-CART-1'; resistance: number; movedMetres: number };
  iron: { id: 'CQ1-IRON-1'; integrity: number; heatDamage: number; temperature: number; cooldownSeconds: number; observed: boolean };
  backstop: { id: 'CQ1-BACKSTOP-1'; charred: boolean };
  crate: { id: 'CQ1-CRATE-1'; movedMetres: number };
  water: { id: 'CQ1-WATER-1'; wasteBasinId: 'CQ1-BASIN-1'; remainingMl: number; usedMl: number };
  abilityUses: Record<'hunter.s1.formation-momentum' | 'hunter.s1.focused-flame', { attempts: number; successes: number; applied: number }>;
}
export interface ConquerorLifeState {
  /** A sealed historical receipt, anchored by successful acquisition. It is never restored into live state. */
  sourceTeam: IronBloodTeamState | null; sourceWeek: number | null;
  practice: ConquerorLifePractice; cases: Record<ConquerorCaseId, ConquerorLifeCase>;
  reflected: boolean; journal: ConquerorLifeReceipt[];
}
export interface ConquerorLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; reflected: boolean;
  practice: ConquerorLifePractice;
  members: { id: string; name: string; health: number; energy: number; willing: boolean; present: boolean; location: 'HOME' | 'YARD'; eligible: boolean; distanceMetres: number | null }[];
  cases: { id: ConquerorCaseId; title: string; story: string; observations: string[]; status: string; contactOpen: boolean; preparation: string | null; result: string | null; returned: boolean; attempts: { invitedWeek: number; method: Method; outcome: PublicResolutionTier | null; evidence: { abilityAttempted: boolean; abilityApplied: boolean; returned: boolean; aborted: boolean; permission: ConquerorLifeCase['permission']; result: Result }; receipts: ConquerorLifeReceipt[] }[] }[];
  ledger: ConquerorLifeReceipt[]; restRequestedWeek: number | null;
}
const ABILITIES = ['hunter.s1.formation-momentum', 'hunter.s1.focused-flame'] as const;
const CASES = [
  { id: 'yard-cart', title: '院车：五人合力仍须各自承担', story: '同一辆训练院阻力车停在五米净空道边。艾达、本尼特、克拉拉、德里克和艾琳再次自愿到场，各站在你十五米内，试着把车推进三米。', facts: ['阵势合力仅支撑本次十秒同步推车；成功把原车推进三米，失败只推进一米。五人各耗2精力，本人耗8灵性与3精神；失败另损2精神。', '进入工位、到场与回家均实耗时间和各人精力。即使灵性不足，也能用原撬杆完成剩余路程；普通结果不增加能力掌握。', '本案不创造成员、不远程征调或代替意愿。已疲劳的旧成员须先付费休整，并经过下一真实周确认有限恢复。'] },
  { id: 'iron-target', title: '铁件：热损不会随火熄灭消失', story: '在原铁件五米外确认可见目标和后方挡板，再试一次短促焰势凝束。火束仅持续三秒；铁件仍在原支架，真实温度、热损与挡板焦痕都会留下。', facts: ['焰势凝束耗12灵性、2精神与五人各1精力；成功铁件完整度减30、升至80度，失败只减10、升至60度，同时本人及五人各受1健康热伤、原挡板焦黑。', '火束结束后须明确等待30秒冷却至20度，才能沿原路归还工具离开；冷却不会返还灵性或修复热损。', '普通方法用原水桶1000毫升水和原钳检查同一铁件，不制造火束。失败仍可这样完成；水从原桶实际流入同一废水盆，不复制或回满。'] },
  { id: 'withdrawn-permission', title: '收回许可：听到停止后改用双手', story: '同一批五位同伴再次到场，准备把原木箱移开两米。进入工位时，物主明确收回超凡作用许可，只同意用原绑带人工搬运；先前的邀请不能覆盖这次拒绝。', facts: ['物主撤回许可后不得施加阵势或火焰。五位同伴对普通搬运重新确认愿意，原木箱以人工方式移动两米。', '普通搬运耗20秒、每人2精力及本人1精神；原绑带与身体都沿原路归还。没有检定重抽、能力使用次数或新能力掌握。', '意愿不足时不强迫任何人工作；允许先安全离院，保留实际时间与已付成本，本案随后须重新邀请，只可普通办理。'] },
] as const;
export const CONQUEROR_LIFE_ENVIRONMENT = '三项有明确边界的训练院实践。每案观察1行动、重新邀请1行动40便士，一真实周最多一次邀请；到场和回家各20米，工位往返各5米。五位原成员逐次自愿到场，能力范围只到15米。报告各增加扮演25，三份报告后反思增加25；仅真实施加成功的新能力在对应报告时增加掌握8。热损、疲劳、灵性、精神和原水去向均保留，零行动的收尾仍支付实际时间和精力。';
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const successful = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 1;
const budget = (s: SliceState): ConquerorLifeBudget => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining });
const freshCase = (): ConquerorLifeCase => ({ status: 'AVAILABLE', observedWeek: null, invitedWeek: null, invitationWeeks: [], method: null, permission: 'UNKNOWN', result: 'NONE', entered: false, abilityAttempted: false, abilityApplied: false, outcome: null, returned: false });
function freshPractice(): ConquerorLifePractice {
  return { activeCase: null, ownerNode: 'ENTRY', elapsedSeconds: 0, memberPositions: [],
    tools: [{ id: 'CQ1-LEVER-1', caseId: 'yard-cart', holder: 'RACK' }, { id: 'CQ1-TONGS-1', caseId: 'iron-target', holder: 'RACK' }, { id: 'CQ1-STRAPS-1', caseId: 'withdrawn-permission', holder: 'RACK' }],
    cart: { id: 'CQ1-CART-1', resistance: 60, movedMetres: 0 }, iron: { id: 'CQ1-IRON-1', integrity: 100, heatDamage: 0, temperature: 20, cooldownSeconds: 0, observed: false },
    backstop: { id: 'CQ1-BACKSTOP-1', charred: false }, crate: { id: 'CQ1-CRATE-1', movedMetres: 0 }, water: { id: 'CQ1-WATER-1', wasteBasinId: 'CQ1-BASIN-1', remainingMl: 2000, usedMl: 0 },
    abilityUses: { 'hunter.s1.formation-momentum': { attempts: 0, successes: 0, applied: 0 }, 'hunter.s1.focused-flame': { attempts: 0, successes: 0, applied: 0 } } };
}
export function createConquerorLifeState(): ConquerorLifeState { return { sourceTeam: null, sourceWeek: null, practice: freshPractice(), cases: { 'yard-cart': freshCase(), 'iron-target': freshCase(), 'withdrawn-permission': freshCase() }, reflected: false, journal: [] }; }
export function initializeConquerorLife(s: SliceState): void {
  const l = s.conqueror.life;
  if (l.sourceTeam !== null || l.sourceWeek !== null || l.journal.length || !active(s)) throw new Error('征服者生活来源只能在实际晋升时登记一次。');
  l.sourceTeam = structuredClone(s.ironBloodKnight.team); l.sourceWeek = s.week;
}
export function validateConquerorActivityCommand(v: unknown): v is ConquerorActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && CONQUEROR_CASE_IDS.includes(v.caseId as ConquerorCaseId);
  if (v.type === 'INVITE_TEAM') return shape(v, ['type', 'caseId', 'method']) && CONQUEROR_CASE_IDS.includes(v.caseId as ConquerorCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return shape(v, ['type']) && ['ENTER_WORK', 'APPLY_POWER', 'COOL_DOWN', 'ORDINARY_WORK', 'RETURN_HOME', 'ABORT', 'REFLECT', 'REST_TEAM', 'RECOVER_TEAM'].includes(String(v.type));
}
export const hasConquerorLifeLock = (s: SliceState): boolean => !!s.conqueror?.life && (s.conqueror.life.practice.activeCase !== null || s.conqueror.life.practice.memberPositions.length > 0 || s.conqueror.life.practice.iron.cooldownSeconds > 0 || s.conqueror.life.practice.tools.some(t => t.holder !== 'RACK'));
interface ReplayModel { team: IronBloodTeamState; practice: ConquerorLifePractice; cases: Record<ConquerorCaseId, ConquerorLifeCase>; reflected: boolean }
interface Audit { date: PublicGameDate; revision: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const audit = (s: SliceState, power = false): Audit => ({ date: structuredClone(s.date), revision: s.revision, randomBefore: power ? s.random.cursor : null, randomAfter: power ? s.random.cursor + 1 : null, checkBase: power ? s.character.coreStats.knowledge : null, check: null });
interface Transition { model: ReplayModel; receipt: ConquerorLifeReceipt }
const group = (m: ReplayModel) => CONQUEROR_MEMBER_IDS.map(id => m.team.members.find(member => member.id === id)!);
const validBudget = (b: unknown): b is ConquerorLifeBudget => record(b) && shape(b, ['health', 'mind', 'spirituality', 'cash', 'actions']) && integer(b.health, 1, 100) && integer(b.mind, 1, 100) && integer(b.spirituality, 0, 10000) && integer(b.cash, 0) && integer(b.actions, 0, 10000);
/** Deterministic scene replay. It cannot roll, award mastery, or refill the live roster. */
function transition(input: ReplayModel, c: ConquerorActivityCommand, week: number, outcome: PublicResolutionTier | null, before: ConquerorLifeBudget, clock: Audit): Transition | null {
  if (!validateConquerorActivityCommand(c) || !validBudget(before) || !integer(week)) return null;
  if (c.type === 'APPLY_POWER' ? !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(outcome)) : outcome !== null) return null;
  const m = structuredClone(input), p = m.practice, members = group(m), id = 'caseId' in c ? c.caseId : p.activeCase, r = id ? m.cases[id] : null;
  if (members.some(member => !member)) return null;
  const receipt: ConquerorLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome, before: structuredClone(before), after: structuredClone(before), elapsedSeconds: 0, ownerWalkedMetres: 0, toolTravelMetres: 0, memberCosts: CONQUEROR_MEMBER_IDS.map(memberId => ({ id: memberId, energySpent: 0, healthLoss: 0, walkedMetres: 0 })) };
  const pay = (ap: number, cash = 0, spirituality = 0, mind = 0, health = 0) => { receipt.after.actions -= ap; receipt.after.cash -= cash; receipt.after.spirituality -= spirituality; receipt.after.mind -= mind; receipt.after.health -= health; };
  const spendMembers = (energy: number, damage = 0) => { members.forEach((member, i) => { member.energy -= energy; member.health -= damage; receipt.memberCosts[i]!.energySpent += energy; receipt.memberCosts[i]!.healthLoss += damage; }); };
  const walk = (metres: number, owner = false, tool = false) => { for (const cost of receipt.memberCosts) cost.walkedMetres += metres; if (owner) receipt.ownerWalkedMetres += metres; if (tool) receipt.toolTravelMetres += metres; };
  const inScene = p.activeCase !== null;
  const physical = inScene && !!r && r.status === 'ACTIVE' && r.invitedWeek === week && members.every(member => member.joined && member.health > 0 && member.present && member.location === 'YARD');
  const willing = members.every(member => member.willing);
  if (inScene && (!physical || 'caseId' in c && c.caseId !== p.activeCase)) return null;
  switch (c.type) {
    case 'REST_TEAM':
      if (inScene || m.team.rite || m.team.members.some(member => member.present) || m.team.restRequestedWeek !== null || !m.team.members.some(member => member.joined && member.health > 0 && (member.health < 100 || member.energy < 20))) return null;
      pay(0, 40); m.team.restRequestedWeek = week; break;
    case 'RECOVER_TEAM':
      if (inScene || m.team.rite || m.team.members.some(member => member.present) || m.team.restRequestedWeek === null || week <= m.team.restRequestedWeek) return null;
      for (const member of m.team.members) if (member.joined && member.health > 0) { member.health = Math.min(100, member.health + 20); member.energy = Math.min(20, member.energy + 8); }
      m.team.restRequestedWeek = null; break;
    case 'OBSERVE': {
      const index = CONQUEROR_CASE_IDS.indexOf(c.caseId);
      if (inScene || r!.status !== 'AVAILABLE' || index > 0 && m.cases[CONQUEROR_CASE_IDS[index - 1]!].status !== 'RESOLVED' || m.team.members.some(member => member.present)) return null;
      pay(1); r!.status = 'OBSERVED'; r!.observedWeek = week;
      if (c.caseId === 'iron-target') p.iron.observed = true;
      break;
    }
    case 'INVITE_TEAM':
      if (inScene || !['OBSERVED', 'PAUSED'].includes(r!.status) || r!.status === 'PAUSED' && c.method !== 'ORDINARY' || m.team.restRequestedWeek !== null || m.team.rite || m.team.members.some(member => member.present) || Object.values(m.cases).some(item => item.invitationWeeks.includes(week))) return null;
      if (!members.every(member => member.joined && member.willing && member.health >= 50 && member.energy >= 6 && !member.present && member.location === 'HOME')) return null;
      if (c.caseId === 'withdrawn-permission' && before.mind < 2) return null;
      pay(1, 40); spendMembers(1); walk(20); receipt.elapsedSeconds = 20;
      r!.status = 'ACTIVE'; r!.invitedWeek = week; r!.invitationWeeks.push(week); r!.method = c.method; r!.entered = false; r!.returned = false; if (r!.permission !== 'WITHDRAWN') r!.permission = 'GRANTED'; p.activeCase = c.caseId;
      for (const member of members) { member.present = true; member.location = 'YARD'; }
      p.memberPositions = CONQUEROR_MEMBER_IDS.map((memberId, index) => ({ id: memberId, node: 'ENTRY', distanceMetres: index + 1 }));
      break;
    case 'ENTER_WORK':
      if (!physical || r!.entered || !willing || p.ownerNode !== 'ENTRY') return null;
      r!.entered = true; p.ownerNode = 'WORK'; p.memberPositions.forEach(position => { position.node = 'WORK'; }); p.tools.find(tool => tool.caseId === id)!.holder = 'WORK';
      spendMembers(1); walk(5, true, true); receipt.elapsedSeconds = 10;
      if (id === 'withdrawn-permission') r!.permission = 'WITHDRAWN';
      break;
    case 'APPLY_POWER': {
      if (!physical || !r!.entered || !willing || r!.method !== 'ABILITY' || r!.permission !== 'GRANTED' || r!.abilityAttempted || r!.result !== 'NONE' || id === 'withdrawn-permission' || p.ownerNode !== 'WORK' || p.memberPositions.length !== 5 || p.memberPositions.some(position => position.node !== 'WORK' || position.distanceMetres > 15)) return null;
      const ok = successful(outcome), ability = id === 'yard-cart' ? ABILITIES[0] : ABILITIES[1];
      if (id === 'yard-cart') { pay(0, 0, 8, ok ? 3 : 5); spendMembers(2); p.cart.movedMetres = ok ? 3 : 1; p.cart.resistance = ok ? 0 : 40; receipt.elapsedSeconds = 10; }
      else {
        if (!p.iron.observed || p.iron.cooldownSeconds || p.iron.temperature !== 20) return null;
        pay(0, 0, 12, 2, ok ? 0 : 1); spendMembers(1, ok ? 0 : 1);
        p.iron.heatDamage += ok ? 30 : 10; p.iron.integrity -= ok ? 30 : 10; p.iron.temperature = ok ? 80 : 60; p.iron.cooldownSeconds = 30; if (!ok) p.backstop.charred = true; receipt.elapsedSeconds = 3;
      }
      r!.abilityAttempted = true; r!.abilityApplied = ok; r!.outcome = outcome; if (ok) r!.result = 'ABILITY';
      p.abilityUses[ability].attempts++; if (ok) { p.abilityUses[ability].successes++; p.abilityUses[ability].applied++; }
      break;
    }
    case 'COOL_DOWN':
      if (!physical || id !== 'iron-target' || !r!.abilityAttempted || p.iron.cooldownSeconds !== 30 || p.iron.temperature <= 20) return null;
      receipt.elapsedSeconds = p.iron.cooldownSeconds; p.iron.cooldownSeconds = 0; p.iron.temperature = 20; break;
    case 'ORDINARY_WORK':
      if (!physical || !r!.entered || !willing || r!.result !== 'NONE' || p.ownerNode !== 'WORK' || p.iron.cooldownSeconds || p.iron.temperature > 20) return null;
      if (id === 'yard-cart') { spendMembers(1); p.cart.movedMetres = 3; p.cart.resistance = 0; receipt.elapsedSeconds = 20; }
      else if (id === 'iron-target') { if (!p.iron.observed || p.water.remainingMl < 1000) return null; spendMembers(1); p.water.remainingMl -= 1000; p.water.usedMl += 1000; receipt.elapsedSeconds = 15; }
      else { if (r!.permission !== 'WITHDRAWN') return null; spendMembers(2); pay(0, 0, 0, 1); p.crate.movedMetres = 2; receipt.elapsedSeconds = 20; }
      r!.result = 'ORDINARY'; break;
    case 'ABORT':
    case 'RETURN_HOME':
      if (c.type === 'ABORT') {
        if (!physical || p.iron.cooldownSeconds !== 0 || p.iron.temperature > 20) return null;
        spendMembers(1); const atWork = p.ownerNode === 'WORK'; walk(atWork ? 25 : 20); receipt.ownerWalkedMetres = atWork ? 5 : 0; receipt.toolTravelMetres = atWork ? 5 : 0; receipt.elapsedSeconds = atWork ? 35 : 20;
        p.ownerNode = 'ENTRY'; p.tools.find(tool => tool.caseId === id)!.holder = 'RACK'; p.memberPositions = [];
        for (const member of members) { member.present = false; member.location = 'HOME'; }
        p.activeCase = null; r!.returned = true; r!.entered = false; r!.status = r!.result === 'NONE' ? 'PAUSED' : 'EXAMINED'; break;
      }
      if (!physical || !r!.entered || r!.result === 'NONE' || p.iron.cooldownSeconds !== 0 || p.iron.temperature > 20 || p.ownerNode !== 'WORK' || p.memberPositions.some(position => position.node !== 'WORK')) return null;
      // The only exit is the observed clear five-metre path, followed by the same twenty-metre road home.
      spendMembers(1); walk(25); receipt.ownerWalkedMetres = 5; receipt.toolTravelMetres = 5; receipt.elapsedSeconds = 35;
      p.ownerNode = 'ENTRY'; p.tools.find(tool => tool.caseId === id)!.holder = 'RACK'; p.memberPositions = [];
      for (const member of members) { member.present = false; member.location = 'HOME'; }
      p.activeCase = null; r!.returned = true; r!.status = 'EXAMINED'; break;
    case 'REPORT':
      if (inScene || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || m.team.members.some(member => member.present)) return null;
      pay(1); r!.status = 'RESOLVED'; break;
    case 'REFLECT':
      if (inScene || m.reflected || !CONQUEROR_CASE_IDS.every(caseId => m.cases[caseId].status === 'RESOLVED') || m.team.members.some(member => member.present)) return null;
      pay(1); m.reflected = true; break;
  }
  if (!validBudget(receipt.after) || members.some(member => member.energy < 0 || member.health <= 0)) return null;
  p.elapsedSeconds += receipt.elapsedSeconds;
  return { model: m, receipt };
}
const dateMatches = (from: PublicGameDate, weeks: number, to: PublicGameDate): boolean => { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } };
function replayLife(l: ConquerorLifeState, s: SliceState): ReplayModel | null {
  if (!l.sourceTeam || l.sourceWeek === null || !Array.isArray(l.journal)) return null;
  let model: ReplayModel = { team: structuredClone(l.sourceTeam), practice: freshPractice(), cases: { 'yard-cart': freshCase(), 'iron-target': freshCase(), 'withdrawn-permission': freshCase() }, reflected: false };
  let lastRandomAfter = 0;
  let lastWeek = l.sourceWeek, previous: ConquerorLifeReceipt | null = null;
  for (const entry of l.journal) {
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'command', 'outcome', 'before', 'after', 'elapsedSeconds', 'ownerWalkedMetres', 'toolTravelMetres', 'memberCosts']) || !validateConquerorActivityCommand(entry.command) || !integer(entry.week, lastWeek) || !integer(entry.revision, previous ? previous.revision + 1 : 0, s.revision) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date) || model.practice.activeCase !== null && (entry.week !== lastWeek || !previous || !same(entry.before, previous.after))) return null;
    if (entry.command.type === 'APPLY_POWER') {
      if (!integer(entry.checkBase, 0, 500) || !record(entry.check) || !integer(entry.randomBefore, lastRandomAfter, s.random.cursor) || entry.randomAfter !== entry.randomBefore + 1 || entry.randomAfter > s.random.cursor) return null;
      const random = new DeterministicActionRandomStream(s.random.seed, entry.randomBefore);
      const expected = resolveNormalCheck({ ability: 'knowledge', baseAbility: entry.checkBase, difficulty: model.practice.activeCase === 'yard-cart' ? 16 : 18, modifiers: [], roll: random.nextInt(1, 100) });
      if (entry.outcome !== expected.tier || !same(entry.check, expected)) return null;
      lastRandomAfter = entry.randomAfter;
    } else if (entry.randomBefore !== null || entry.randomAfter !== null || entry.checkBase !== null || entry.check !== null) return null;
    if (previous && entry.revision === previous.revision + 1 && entry.week === previous.week && !same(entry.before, previous.after)) return null;
    const next = transition(model, entry.command, entry.week, entry.outcome, entry.before, { date: entry.date, revision: entry.revision, randomBefore: entry.randomBefore, randomAfter: entry.randomAfter, checkBase: entry.checkBase, check: entry.check });
    if (!next || !same(next.receipt, entry)) return null;
    model = next.model; lastWeek = entry.week; previous = entry;
  }
  return model;
}
function oldSceneOpen(s: SliceState): boolean {
  return s.ironBloodKnight.team.rite !== null || s.weatherWarlock.preparedWeek !== null || s.warBishop.preparedWeek !== null ||
    ['READY', 'FIGHTING'].includes(s.ironBloodKnight.encounter.status) || ['READY', 'FIGHTING'].includes(s.warBishop.encounter.status) || ['READY', 'FIGHTING'].includes(s.weatherWarlock.encounter.status) ||
    s.weatherWarlock.life.practice.activeCase !== null || Object.values(s.warBishop.life.cases).some(item => item.contactOpen || item.status === 'PREPARED') ||
    Object.values(s.ironBloodKnight.life.cases).some(item => item.contactOpen || item.status === 'PREPARED') || Object.values(s.reaper.cases).some(item => item.contactOpen || item.status === 'PREPARED' || item.practice.windowOpen) || Object.values(s.conspirator.cases).some(item => item.contactOpen || item.status === 'PREPARED');
}
function historicalInvitationWeeks(s: SliceState): number[] {
  return [...Object.values(s.warBishop.life.cases).flatMap(item => item.attempts.map(a => a.invitedWeek)), ...Object.values(s.weatherWarlock.life.cases).flatMap(item => item.attempts.map(a => a.invitedWeek)), ...[s.warBishop.encounter.invitedWeek, s.weatherWarlock.encounter.invitedWeek].filter((week): week is number => week !== null)];
}
export function blockConquerorActivity(s: SliceState, c: ConquerorActivityCommand): string | null {
  if (!validateConquerorActivityCommand(c)) return '生活实践命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着并已实际成为征服者。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理事件或战斗，并实际回到贝克兰德训练院。';
  if (oldSceneOpen(s) || s.conqueror.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.conqueror.encounter.status)) return '先收束旧现场与当前准备或遭遇。';
  if (!validateConquerorLife(s)) return '当前真实成员、原物或实践收支记录不一致。';
  const l = s.conqueror.life, model = replayLife(l, s)!;
  if (c.type === 'REST_TEAM' || c.type === 'RECOVER_TEAM') {
    if (hasConquerorLifeLock(s)) return '先把实际到场的成员和原工具安全送回。';
    const reason = blockIronBloodTeamCommand(s, { type:c.type }); if (reason) return reason;
  }
  if (c.type === 'INVITE_TEAM' && historicalInvitationWeeks(s).includes(s.week)) return '原五人本真实周已接受另一场实际邀请，下一周再约。';
  // Reserve enough energy for a failed attempt, its ordinary fallback and the actual walk home.
  if (c.type === 'INVITE_TEAM' && !group(model).every(member => member.joined && member.willing && member.health >= 50 && member.energy >= 6 && !member.present && member.location === 'HOME')) return '五位原同伴须各自愿意、在家、健康至少50且精力至少6；疲劳须付费跨周休整。';
  if (c.type === 'APPLY_POWER' && model.practice.activeCase === 'withdrawn-permission') return '物主已经收回超凡作用许可；只能在普通许可范围内人工搬运。';
  if (c.type === 'RETURN_HOME' && model.practice.iron.cooldownSeconds > 0) return '原铁件仍烫，先明确等待30秒冷却，再沿已确认净空原路归还工具和回家。';
  const next = transition(model, c, s.week, c.type === 'APPLY_POWER' ? 'SUCCESS' : null, budget(s), audit(s, c.type === 'APPLY_POWER'));
  if (!next) return '先完成当前观察、当次邀请、实际进入、有效操作及安全收尾，并保留所需行动和资源。';
  if (c.type === 'APPLY_POWER' && !transition(model, c, s.week, 'GREAT_FAILURE', budget(s), audit(s, true))) return '本次能力失败也须承担实际身心成本，并保留安全退路。';
  return null;
}
const NOTES: Record<ConquerorActivityCommand['type'], [string, string]> = {
  OBSERVE: ['亲眼确认本案原物与退路', '观察耗1行动；物件没有更换，成员尚未到场。'],
  INVITE_TEAM: ['五位原同伴重新自愿到场', '实际花1行动40便士；每人耗1精力，沿原路走20米、20秒。意愿只覆盖本案，不形成新成员副本。'],
  ENTER_WORK: ['带原工具沿净空道进入工位', '五人各耗1精力；本人、原工具与五人实际走5米、10秒。五人均在本人15米内。'],
  APPLY_POWER: ['实际施加一次有限能力', '只有本次真实目标与在场身体参与；成功、失败和每项成本均写入原状态，不重抽。'],
  COOL_DOWN: ['明确等待原铁件冷却', '原火束早已结束，此处实等30秒降至20度。热损、热伤与焦黑挡板不修复，灵性和精力不返还。'],
  ORDINARY_WORK: ['用原工具完成普通操作', '同一原物和五位愿意的同伴实际完成工作，按本案支付精力、精神、时间或原水；不记作能力使用。'],
  ABORT: ['沿原路中止本次现场并实际回家', '确认火束结束且原件冷却后，原工具归架，五人实际走回原路，各耗1精力。已付成本、原物变化与能力失败不撤销；未完成案件下次须重新邀请，只能普通继续。'],
  RETURN_HOME: ['归还原工具，原五人实际回家', '确认无火、无余热且原路净空后，本人和原工具走回5米，五人继续走20米回家；各耗1精力、实际35秒。旧疲劳与伤势保留。'],
  REPORT: ['报告本案实际结果', '花1行动，增加扮演25；仅实际成功施加的对应新能力增加掌握8，普通操作和失败不获赠掌握。'],
  REFLECT: ['反思合力、热损与撤回许可', '三案原物和原身体已经收束；花1行动增加扮演25。许可可以撤回，协作和冷却都不能替人免去成本。'],
  REST_TEAM: ['安排同一批原成员在家休整', '实际付40便士，此刻不恢复；须经过下一真实周，再确认有限恢复。'],
  RECOVER_TEAM: ['确认跨真实周的有限恢复', '同一批已加入且存活的原成员最多恢复20健康、8精力，上限100/20；不改变意愿、身份或共同经历，也不自动到场。'],
};
export function applyConquerorActivity(s: SliceState, c: ConquerorActivityCommand, ctx: SeerContext): void {
  const reason = blockConquerorActivity(s, c); if (reason) throw new Error(reason);
  const l = s.conqueror.life, id = 'caseId' in c ? c.caseId : l.practice.activeCase;
  const clock = audit(s, c.type === 'APPLY_POWER');
  const check = c.type === 'APPLY_POWER' ? ctx.check('knowledge', id === 'yard-cart' ? 16 : 18) : null;
  const outcome = check?.tier ?? null; clock.check = check;
  if (c.type === 'APPLY_POWER') clock.randomAfter = s.random.cursor;
  const next = transition(replayLife(l, s)!, c, s.week, outcome, budget(s), clock)!;
  if (c.type === 'REST_TEAM' || c.type === 'RECOVER_TEAM') applyIronBloodTeamCommand(s, { type:c.type }, { ...ctx, note: () => undefined });
  // Keep all thirty original object references and every historical field. Change only paid physical deltas.
  for (const [i, current] of s.ironBloodKnight.team.members.entries()) {
    const expected = next.model.team.members[i]!;
    current.health = expected.health; current.energy = expected.energy; current.present = expected.present; current.location = expected.location;
  }
  s.ironBloodKnight.team.restRequestedWeek = next.model.team.restRequestedWeek;
  s.health = next.receipt.after.health; s.mind = next.receipt.after.mind; s.spirituality = next.receipt.after.spirituality; s.cash = next.receipt.after.cash; s.actionsRemaining = next.receipt.after.actions;
  l.practice = next.model.practice; l.cases = next.model.cases; l.reflected = next.model.reflected; l.journal.push(next.receipt);
  if (c.type === 'REPORT') {
    const r = l.cases[c.caseId]; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`conqueror-case:${c.caseId}`);
    if (r.abilityApplied && r.result === 'ABILITY' && c.caseId !== 'withdrawn-permission') { const ability = c.caseId === 'yard-cart' ? ABILITIES[0] : ABILITIES[1]; s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8); }
  }
  if (c.type === 'REFLECT') { s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('conqueror-reflection'); }
  const note = NOTES[c.type];
  let detail = note[1];
  if (c.type === 'OBSERVE') { const story = CASES.find(item => item.id === c.caseId)!; detail = story.story + story.facts.join(' '); }
  if (c.type === 'ENTER_WORK' && id === 'withdrawn-permission') detail += '物主此刻明确收回超凡许可，只同意普通绑带搬运；过去的同意不再适用。';
  if (c.type === 'APPLY_POWER') detail += successful(outcome) ? '本次成功，原目标已经发生可核对的实际变化。' : '本次失败，有限的真实变化与损耗保留；可以安全冷却后改用普通方法。';
  ctx.note(note[0], detail);
}
export function conquerorLifeActions(s: SliceState): ConquerorAction[] {
  if (!active(s)) return [];
  const out: ConquerorAction[] = [], l = s.conqueror.life;
  const add = (command: ConquerorActivityCommand, label: string, cost: string) => { const reason = blockConquerorActivity(s, command); out.push({ id: `conqueror-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}`, command, label, cost, enabled: reason === null, reason }); };
  if (l.practice.activeCase) {
    const r = l.cases[l.practice.activeCase];
    if (!r.entered) add({ type: 'ENTER_WORK' }, '带原工具与同伴实际进入工位', '0行动 · 各1精力 · 5米/10秒');
    else {
      if (r.result === 'NONE') {
        if (r.method === 'ABILITY' && !r.abilityAttempted) add({ type: 'APPLY_POWER' }, l.practice.activeCase === 'yard-cart' ? '施加一次阵势合力' : l.practice.activeCase === 'iron-target' ? '对已观察原铁件施加焰势凝束' : '超凡许可已撤回', l.practice.activeCase === 'yard-cart' ? '0行动 · 8灵性 · 3精神 · 各2精力 · 知识16' : '0行动 · 12灵性 · 2精神 · 各1精力 · 知识18');
        add({ type: 'ORDINARY_WORK' }, r.abilityAttempted ? '保留失败，改用普通方法完成' : '按当前许可用原工具普通完成', l.practice.activeCase === 'iron-target' ? '0行动 · 原水1000毫升 · 各1精力 · 15秒' : l.practice.activeCase === 'withdrawn-permission' ? '0行动 · 各2精力 · 1精神 · 20秒' : '0行动 · 各1精力 · 20秒');
      }
      if (l.practice.iron.cooldownSeconds) add({ type: 'COOL_DOWN' }, '明确等待原铁件冷却', '0行动 · 实等30秒 · 热损保留');
      add({ type: 'RETURN_HOME' }, '安全归还原工具并让五人实际回家', '0行动 · 各1精力 · 原路25米/35秒');
    }
    add({ type: 'ABORT' }, '安全中止本次现场，实际还物回家', '0行动 · 各1精力 · 20或35秒 · 不退款或重置');
    return out;
  }
  for (const item of CASES) {
    const r = l.cases[item.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: item.id }, `观察：${item.title}`, '1行动');
    if (r.status === 'OBSERVED' || r.status === 'PAUSED') {
      if (item.id !== 'withdrawn-permission' && r.status !== 'PAUSED') add({ type: 'INVITE_TEAM', caseId: item.id, method: 'ABILITY' }, '重新邀请原五人，准备有限能力与普通退路', '1行动 · 40便士 · 各1精力 · 每人须有6精力');
      add({ type: 'INVITE_TEAM', caseId: item.id, method: 'ORDINARY' }, '重新邀请原五人，准备普通操作', '1行动 · 40便士 · 各1精力 · 每人须有6精力');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: item.id }, '报告这次已经收束的真实实践', '1行动 · 扮演25 · 实际能力成功才掌握8');
  }
  if (!l.reflected) add({ type: 'REFLECT' }, '反思三案的协作成本与许可边界', '1行动 · 三份报告后扮演25');
  if (s.ironBloodKnight.team.restRequestedWeek === null) add({ type: 'REST_TEAM' }, '为原成员安排在家休整', '0行动 · 40便士 · 下一真实周才恢复');
  else add({ type: 'RECOVER_TEAM' }, '确认原成员跨周后的有限恢复', '0行动 · 至多健康+20、精力+8');
  return out;
}
function projectAttempts(l: ConquerorLifeState, id: ConquerorCaseId): ConquerorLifeProjection['cases'][number]['attempts'] {
  return l.journal.flatMap((entry, index) => {
    if (entry.command.type !== 'INVITE_TEAM' || entry.command.caseId !== id) return [];
    const end = l.journal.findIndex((candidate, i) => i > index && ['RETURN_HOME', 'ABORT'].includes(candidate.command.type));
    const receipts = l.journal.slice(index, end < 0 ? undefined : end + 1), power = receipts.find(candidate => candidate.command.type === 'APPLY_POWER');
    const outcome = power?.outcome ?? null, applied = successful(outcome), ordinary = receipts.some(candidate => candidate.command.type === 'ORDINARY_WORK');
    return [{ invitedWeek: entry.week, method: entry.command.method, outcome, evidence: { abilityAttempted: !!power, abilityApplied: applied, returned: end >= 0, aborted: end >= 0 && l.journal[end]!.command.type === 'ABORT', permission: id === 'withdrawn-permission' && receipts.some(candidate => candidate.command.type === 'ENTER_WORK') ? 'WITHDRAWN' as const : 'GRANTED' as const, result: applied ? 'ABILITY' as const : ordinary ? 'ORDINARY' as const : 'NONE' as const }, receipts: structuredClone(receipts) }];
  });
}
export function projectConquerorLife(s: SliceState): ConquerorLifeProjection {
  const l = s.conqueror.life;
  if (!active(s)) return { title: '征服者有限实践', source: '', environment: '', insideCase: false, reflected: false, practice: freshPractice(), members: [], cases: [], ledger: [], restRequestedWeek: null };
  return { title: '五个名字、同一原物与可撤回的许可', source: '训练院的三项有限实践，用于学习协作、集中火焰和尊重撤回许可。', environment: CONQUEROR_LIFE_ENVIRONMENT, insideCase: hasConquerorLifeLock(s), reflected: l.reflected, practice: structuredClone(l.practice),
    members: CONQUEROR_MEMBER_IDS.map(id => { const m = s.ironBloodKnight.team.members.find(member => member.id === id)!; return { id, name: m.name, health: m.health, energy: m.energy, willing: m.willing, present: m.present, location: m.location, eligible: m.joined && m.willing && m.health >= 50 && m.energy >= 6 && !m.present && m.location === 'HOME', distanceMetres: l.practice.memberPositions.find(position => position.id === id)?.distanceMetres ?? null }; }),
    cases: CASES.map(item => { const r = l.cases[item.id]; return { id: item.id, title: item.title, story: item.story, observations: r.status === 'AVAILABLE' ? [] : [...item.facts], status: r.status, contactOpen: r.status === 'ACTIVE', preparation: r.status === 'OBSERVED' ? '已观察原物与净空退路，尚须当次邀请原五位同伴。' : null,
      result: r.result === 'NONE' ? r.abilityAttempted ? '本次能力失败，真实损耗保留；安全冷却后可普通完成。' : null : `${r.result === 'ABILITY' ? '实际能力' : '普通'}结果已发生${r.returned ? '，原工具和五人均已收束。' : '，仍须安全归还工具并让同伴回家。'}`, returned: r.returned,
      attempts: projectAttempts(l, item.id) }; }), ledger: structuredClone(l.journal), restRequestedWeek: s.ironBloodKnight.team.restRequestedWeek };
}
function validSourceTeam(team: unknown, week: number): team is IronBloodTeamState {
  if (!record(team) || !shape(team, ['members', 'cohorts', 'exercises', 'firstJoinedWeek', 'restRequestedWeek', 'rite', 'riteHistory']) || !Array.isArray(team.members) || team.members.length !== 30 || team.rite !== null || !Array.isArray(team.cohorts) || !Array.isArray(team.exercises) || !Array.isArray(team.riteHistory)) return false;
  if (team.restRequestedWeek !== null && !integer(team.restRequestedWeek, 0, week)) return false;
  return team.members.every((v, i) => { const original = IRON_BLOOD_ROSTER[i]!; return record(v) && shape(v, ['id', 'name', 'age', 'source', 'cohortId', 'health', 'energy', 'location', 'present', 'willing', 'joined', 'joinedWeek', 'experience', 'cohortActivities', 'exerciseWeeks']) && v.id === original.id && v.name === original.name && v.age === original.age && v.source === original.source && v.cohortId === original.cohortId && integer(v.health, 0, 100) && integer(v.energy, 0, 20) && v.location === 'HOME' && v.present === false && typeof v.willing === 'boolean' && v.joined === true && integer(v.joinedWeek, 0, week) && Array.isArray(v.cohortActivities) && Array.isArray(v.exerciseWeeks); });
}
export function validateConquerorLife(s: SliceState): boolean {
  const l = s.conqueror?.life;
  if (!record(l) || !shape(l, ['sourceTeam', 'sourceWeek', 'practice', 'cases', 'reflected', 'journal']) || !Array.isArray(l.journal) || !record(l.practice) || !record(l.cases) || !shape(l.cases, CONQUEROR_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
  if (s.conqueror.promotionWeek === null) return same(l, createConquerorLifeState());
  if (!integer(l.sourceWeek, 0, s.week) || l.sourceWeek !== s.conqueror.promotionWeek || !validSourceTeam(l.sourceTeam, l.sourceWeek) || l.journal.some(entry => !record(entry) || !integer(entry.week, l.sourceWeek!, s.week))) return false;
  const replay = replayLife(l, s);
  if (!replay || !same(l.practice, replay.practice) || !same(l.cases, replay.cases) || l.reflected !== replay.reflected || !same(s.ironBloodKnight.team, replay.team)) return false;
  const invitationWeeks = Object.values(l.cases).flatMap(item => item.invitationWeeks);
  if (new Set(invitationWeeks).size !== invitationWeeks.length || invitationWeeks.some(week => historicalInvitationWeeks(s).includes(week))) return false;
  for (const id of CONQUEROR_CASE_IDS) {
    const r = l.cases[id], expectedSources = r.status === 'RESOLVED' ? 1 : 0;
    if (s.seer.completedSources.filter(source => source === `conqueror-case:${id}`).length !== expectedSources) return false;
    if (r.status === 'RESOLVED' && r.abilityApplied && id !== 'withdrawn-permission' && (s.progression.mastery[id === 'yard-cart' ? ABILITIES[0] : ABILITIES[1]] ?? 0) < 8) return false;
  }
  if (s.seer.completedSources.filter(source => source === 'conqueror-reflection').length !== (l.reflected ? 1 : 0)) return false;
  if (hasConquerorLifeLock(s)) {
    const last = l.journal.at(-1);
    if (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || oldSceneOpen(s) || s.conqueror.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.conqueror.encounter.status) || !last || last.week !== s.week || !same(budget(s), last.after)) return false;
  }
  return l.practice.water.remainingMl + l.practice.water.usedMl === 2000 && l.practice.iron.integrity + l.practice.iron.heatDamage === 100;
}
