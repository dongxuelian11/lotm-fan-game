import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { fateTrojanLifeClosed, type FateTrojanSiteState } from './life.js';
import { currentFateTrojanCombatSource, validateFateTrojanRoundOutcome, validateFateTrojanCombatRound, type FateTrojanCombatSource } from './combat.js';

export const FATE_TROJAN_TARGET_ID = 'FT2-ELIAS' as const;
export const FATE_TROJAN_POWER_IDS = ['FORCE_STRIKE', 'GUARD', 'DISCERN'] as const;
export type FateTrojanPowerId = typeof FATE_TROJAN_POWER_IDS[number];
export type FateTrojanEnemyIntent = FateTrojanPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const FATE_TROJAN_POWERS = [
  { id: 'FORCE_STRIKE', label: '灵性冲击', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'GUARD', label: '一次屏护', cost: 4, selfGain: 0, enemyReduction: 0 },
  { id: 'DISCERN', label: '辨识联系', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface FateTrojanClearance {
  week: number; linaConsent: 'GRANTED'; victorConsent: 'GRANTED';
  linaMetres: 4; victorMetres: 4; linaEnergyPaid: 4; victorEnergyPaid: 4; playerMetres: 4; playerEnergyPaid: 4; elapsedSeconds: 12;
}
export interface FateTrojanEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  exitMetres: 0 | 2; exitSeconds: 0 | 2; playerEnergyPaid: 0 | 2;
}
export interface FateTrojanEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof FATE_TROJAN_TARGET_ID;
  approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  /** Historical snapshots only. life.site remains the one authoritative live body/object state. */
  startSite: FateTrojanSiteState | null; startSource: FateTrojanCombatSource | null; clearance: FateTrojanClearance | null;
  yardId: 'FT2-YARD'; ordinaryExit: 'OPEN'; enemyPosition: 'YARD'; enemyDistanceMetres: 2;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<FateTrojanPowerId, number>;
  terminal: FateTrojanEncounterTerminal | null;
}
export type FateTrojanEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface FateTrojanEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FateTrojanEncounterCommand }
export interface FateTrojanEncounterProjection {
  title: string; story: string; status: FateTrojanEncounterState['status']; inside: boolean; site: FateTrojanSiteState | null; startSite: FateTrojanSiteState | null;
  enemy: null | { id: typeof FATE_TROJAN_TARGET_ID; name: '伊莱亚斯'; age: 46; sequence: 3; health: number; mind: number; spirituality: number;
    status: FateTrojanEncounterState['enemyStatus']; weaponId: 'FT2-ELIAS-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<FateTrojanPowerId, number> };
  actions: FateTrojanEncounterAction[]; facts: string[];
}
export const FATE_TROJAN_ENCOUNTER_STORY = '46岁的伊莱亚斯在登记所外的独立庭院提出通行争议，持有自己的一根棍。他拥有自己的身体、判断和120灵性。先收尾三次实践并反思，再征得莉娜与维克托本次同意，让两人各步行4米到院外；你从登记所门口步行4米进入庭院。柜子、包裹和已经归还的身份联系保持此前状态。交谈后可以沿普通出口和平离开，交战需要另作选择，可能受伤或死亡。';
export function createFateTrojanEncounterState(): FateTrojanEncounterState {
  return { status: 'AVAILABLE', targetId: FATE_TROJAN_TARGET_ID, approachWeek: null, approachRevision: null, attemptWeek: null, startHistoryIndex: null,
    startSite: null, startSource: null, clearance: null, yardId: 'FT2-YARD', ordinaryExit: 'OPEN', enemyPosition: 'YARD', enemyDistanceMetres: 2,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { FORCE_STRIKE: 0, GUARD: 0, DISCERN: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function validateFateTrojanEncounterCommand(v: unknown): v is FateTrojanEncounterCommand { return shape(v, ['type']) && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type)); }
export const isFateTrojanEncounterCommand = validateFateTrojanEncounterCommand;
export const hasFateTrojanEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.fateTrojan.encounter.status);
export const isInsideFateTrojanEncounter = hasFateTrojanEncounterLock;
function otherSceneOpen(s: SliceState): boolean { return s.fateTrojan.preparedWeek !== null || !fateTrojanLifeClosed(s) || !s.fateTrojan.life.reflected; }
function closedSite(p: FateTrojanSiteState): boolean {
  return !!p && p.siteId === 'FT2-REGISTRY' && p.introducedWeek !== null && p.playerLocation === 'ENTRY' && integer(p.playerEnergy, 6, 100) &&
    p.lina.id === 'FT2-LINA' && p.lina.alive === true && p.lina.location === 'DESK' && integer(p.lina.energy, 4, 100) && integer(p.lina.travelMetres) &&
    p.victor.id === 'FT2-VICTOR' && p.victor.alive === true && p.victor.location === 'DESK' && integer(p.victor.energy, 4, 100) && integer(p.victor.travelMetres) &&
    p.link.holder === 'OWNER' && p.link.returnPending === false && p.link.windowExpiresAt === null && p.cabinet.recognitionHolder === 'OWNER' && p.cabinet.open === false &&
    p.fate.status !== 'ASSUMED' && p.parcel.carriedBy === (p.parcel.location === 'OUTSIDE' ? 'PLAYER' : null) && p.seals.every(seal => seal.location === 'DESK') && integer(p.clockSeconds) && integer(p.playerTravelMetres);
}
const clearance = (week: number): FateTrojanClearance => ({ week, linaConsent: 'GRANTED', victorConsent: 'GRANTED', linaMetres: 4, victorMetres: 4, linaEnergyPaid: 4, victorEnergyPaid: 4, playerMetres: 4, playerEnergyPaid: 4, elapsedSeconds: 12 });
/** Frozen coordinates: ENTRY0, DESK2, CABINET6, OUTSIDE−2, separate YARD−4.
 * Authored adult consent is explicit in the approach record. It precedes each ordinary departure.
 * Clone here produces a historical replay result, which replaces the one live life.site on commit. */
export function fateTrojanApproachedSite(start: FateTrojanSiteState, week: number): FateTrojanSiteState {
  if (!closedSite(start) || !integer(week, 1) || start.introducedWeek! > week) throw new Error('先收尾登记所，两位成人须各留4精力离开，你须留6精力往返。');
  const p = structuredClone(start);
  p.lina.location = 'OUTSIDE'; p.lina.travelMetres += 4; p.lina.energy -= 4; p.clockSeconds += 4;
  p.victor.location = 'OUTSIDE'; p.victor.travelMetres += 4; p.victor.energy -= 4; p.clockSeconds += 4;
  p.playerLocation = 'YARD'; p.playerTravelMetres += 4; p.playerEnergy -= 4; p.clockSeconds += 4;
  return p;
}
export function leaveFateTrojanCombatSite(p: FateTrojanSiteState): void {
  if (p.playerLocation !== 'YARD' || p.playerEnergy < 2) throw new Error('须本人在庭院并保有2精力，才能沿普通出口离开。');
  p.playerLocation = 'OUTSIDE'; p.playerTravelMetres += 2; p.playerEnergy -= 2; p.clockSeconds += 2;
}
function actualYard(s: SliceState): boolean {
  const e = s.fateTrojan.encounter, p = s.fateTrojan.life.site;
  return e.yardId === 'FT2-YARD' && e.ordinaryExit === 'OPEN' && e.enemyPosition === 'YARD' && e.enemyDistanceMetres === 2 && p.playerLocation === 'YARD' &&
    p.lina.location === 'OUTSIDE' && p.victor.location === 'OUTSIDE' && p.lina.alive === true && p.victor.alive === true && p.playerEnergy >= 2 &&
    e.approachWeek === s.week && same(e.clearance, clearance(s.week)) && p.link.holder === 'OWNER' && !p.link.returnPending && p.link.windowExpiresAt === null && !p.cabinet.open && p.cabinet.recognitionHolder === 'OWNER';
}
export function blockFateTrojanEncounter(s: SliceState, c: FateTrojanEncounterCommand): string | null {
  if (!validateFateTrojanEncounterCommand(c)) return '庭院遭遇命令无效。';
  const e = s.fateTrojan.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为命运木马。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.fateTrojan.guidanceKnown || s.fateTrojan.promotionWeek === null) return '须已获得指导并完成本次晋升。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德。';
  if (otherSceneOpen(s)) return '先收尾三次实践、归还身份联系并完成反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && actualYard(s) ? null : '先到庭院交谈，才能沿普通出口离开。';
  if (s.mind <= 0) return '先恢复精神；交谈后仍可普通离开。';
  if (s.actionsRemaining < 1) return '这次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') {
    if (e.status !== 'AVAILABLE') return '这位对手的接触已有进展或结局，不能重新生成。';
    if (!closedSite(s.fateTrojan.life.site)) return '先收尾登记所，两位成人须各留4精力离开，你须留6精力往返。';
    return s.actionsRemaining < 2 ? '交谈需1行动，请另留1行动决定是否交战；到场后也能和平离开。' : null;
  }
  return e.status === 'READY' && actualYard(s) ? null : '先实际交谈，取得两人当次同意并让他们亲自离开。';
}
export const fateTrojanEncounterReason = blockFateTrojanEncounter;
export function applyFateTrojanEncounterCommand(s: SliceState, c: FateTrojanEncounterCommand, ctx: SeerContext): void {
  const reason = blockFateTrojanEncounter(s, c); if (reason) throw new Error(reason); const e = s.fateTrojan.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { leaveFateTrojanCombatSite(s.fateTrojan.life.site); e.status = 'RESOLVED'; ctx.note('和平离开庭院', '你沿普通出口步行2米，耗时2秒并消耗2精力。莉娜与维克托仍在院外，伊莱亚斯持棍留在庭院。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.startSite = structuredClone(s.fateTrojan.life.site); e.clearance = clearance(s.week); s.fateTrojan.life.site = fateTrojanApproachedSite(e.startSite, s.week);
    e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1;
    ctx.note('与伊莱亚斯交谈', '莉娜与维克托都明确同意离开，各自行走4米、耗时4秒并消耗4精力；你随后步行4米到庭院，耗时4秒并消耗4精力。' + FATE_TROJAN_ENCOUNTER_STORY + '你尚未选择交战。'); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'FATE_TROJAN_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentFateTrojanCombatSource(s); if (!source) throw new Error('庭院的开战来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('庭院交战', '你选择与伊莱亚斯交战。两位成人已经亲自退到院外，双方各用自己的身体、武器和灵性。柜子、包裹与身份联系保持原状。');
}
export const applyFateTrojanEncounter = applyFateTrojanEncounterCommand;
export function startFateTrojanEncounter(s: SliceState, ctx: SeerContext): void { applyFateTrojanEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasFateTrojanDisputeOpponent(s: SliceState): boolean {
  const e = s.fateTrojan?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    s.fateTrojan.guidanceKnown && s.fateTrojan.promotionWeek !== null && !!e && e.status === 'FIGHTING' && e.targetId === FATE_TROJAN_TARGET_ID && e.terminal === null &&
    e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' && actualYard(s) && e.approachWeek !== null && e.attemptWeek === s.week &&
    c?.encounterId === 'FATE_TROJAN_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(e.enemySpirituality, 0, 120) && FATE_TROJAN_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - FATE_TROJAN_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) && integer(c.round, 1) &&
    e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleFateTrojanEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.fateTrojan.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'FATE_TROJAN_DISPUTE') throw new Error('当前没有在庭院进行的战斗。'); if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知战斗结果。');
  const last = c.lastRound, o = last?.fateTrojanOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateFateTrojanRoundOutcome(o) || !validateFateTrojanCombatRound(last) || o.continuing || c.round !== last.round + 1 ||
    s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || o.clockSecondsAfter !== s.fateTrojan.life.site.clockSeconds ||
    o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) || (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('身体、现场、资源或完整战斗结果不符。');
  const exit = s.health > 0 ? 2 : 0; if (exit) leaveFateTrojanCombatSite(s.fateTrojan.life.site);
  e.terminal = { outcome: outcome as FateTrojanEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: exit, exitSeconds: exit, playerEnergyPaid: exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('庭院冲突结束', `${outcome === 'PLAYER_DEAD' ? '你已死亡，身体留在庭院。' : '你沿普通出口步行2米、耗时2秒并消耗2精力，回到院外。'}莉娜与维克托仍在院外，伊莱亚斯和自己的棍留在庭院，原物与既有身份联系保持实际状态。`);
}
export const finishFateTrojanEncounter = settleFateTrojanEncounter;
export function fateTrojanEncounterActions(s: SliceState): FateTrojanEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '取得同意并前往庭院交谈', '1行动；两人各4米/4秒/4精力，你4米/4秒/4精力'],
    ['ENCOUNTER_FIGHT', '选择与伊莱亚斯交战', '1行动；有受伤和死亡风险'], ['LEAVE_ENCOUNTER', '沿出口和平离开', '0行动；2米/2秒/2精力']] as const).map(([type, label, cost]) => {
    const command: FateTrojanEncounterCommand = { type }, reason = blockFateTrojanEncounter(s, command); return { id: `fate-trojan-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectFateTrojanEncounter(s: SliceState): FateTrojanEncounterProjection {
  const e = s.fateTrojan.encounter;
  if (!stage(s)) return { title: '尚未开放的庭院遭遇', story: '', status: e.status, inside: false, site: null, startSite: null, enemy: null, actions: [], facts: [] };
  return { title: '庭院里的伊莱亚斯', story: FATE_TROJAN_ENCOUNTER_STORY, status: e.status, inside: hasFateTrojanEncounterLock(s), site: structuredClone(s.fateTrojan.life.site), startSite: structuredClone(e.startSite),
    enemy: { id: FATE_TROJAN_TARGET_ID, name: '伊莱亚斯', age: 46, sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      weaponId: 'FT2-ELIAS-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: fateTrojanEncounterActions(s),
    facts: ['莉娜与维克托本人在取得当次同意后各步行4米退到院外，精力与路程实际保留。', '你本人在登记所与庭院之间普通步行，柜子、包裹和已归还的身份联系保持原状。',
      '身份联系偏移只针对伊莱亚斯当前瞄准联系，每轮最多一次尝试，成功后只削弱下一次实际身体攻击30。', '命运承担先支付7灵性和5健康，每轮最多一次尝试，成功后只加强随后一次实际普通打击85；未用或失败也不退款。',
      '对手的辨识只解除已经存在的一次联系偏移，屏护只削弱随后一次实际普通打击。', '各动作5秒、各回合60秒；离场另步行2米/2秒并支付2精力。伤势、死亡与已经支付的代价保留，战斗不增长掌握。'] };
}
/** Life's independent journal validator proves startSite; this function proves its only live continuation.
 * Neither validator calls the other, avoiding recursion. Every subsequent site field is compared,
 * including exhausted energy, existing seals, the cabinet's actual recognition link and the parcel. */
export function validateFateTrojanEncounter(s: SliceState): boolean {
  try {
    const e = s.fateTrojan?.encounter, initial = createFateTrojanEncounterState();
    if (!e || !shape(e, Object.keys(initial)) || e.targetId !== FATE_TROJAN_TARGET_ID || e.yardId !== 'FT2-YARD' || e.ordinaryExit !== 'OPEN' || e.enemyPosition !== 'YARD' || e.enemyDistanceMetres !== 2 ||
      !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !integer(e.enemyHealth, 0, 100) || e.enemyMind !== 100 || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !Array.isArray(e.enemyInjuries) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD') ||
      !shape(e.powerUses, FATE_TROJAN_POWER_IDS) || !FATE_TROJAN_POWER_IDS.every(id => integer(e.powerUses[id])) || e.enemySpirituality !== 120 - FATE_TROJAN_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    const allNew = s.combatHistory.flatMap((r, i) => r.fateTrojanOutcome ? [i] : []);
    if (e.status === 'AVAILABLE') return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'FATE_TROJAN_DISPUTE';
    if (!stage(s) || !s.fateTrojan.guidanceKnown || s.fateTrojan.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.fateTrojan.promotionWeek || !integer(e.approachRevision, 1, s.revision) ||
      !fateTrojanLifeClosed(s) || !s.fateTrojan.life.reflected || !e.startSite || !closedSite(e.startSite) || !same(e.clearance, clearance(e.approachWeek))) return false;
    const approached = fateTrojanApproachedSite(e.startSite, e.approachWeek);
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED', expected = structuredClone(approached); if (peaceful) leaveFateTrojanCombatSite(expected);
      return (ready || peaceful) && e.attemptWeek === null && e.startSource === null && e.terminal === null && allNew.length === 0 && same(s.fateTrojan.life.site, expected) &&
        same({ ...e, status: initial.status, approachWeek: null, approachRevision: null, startSite: null, clearance: null }, initial) && s.combat?.encounterId !== 'FATE_TROJAN_DISPUTE' &&
        (!ready || s.status === 'ACTIVE' && !otherSceneOpen(s) && e.approachWeek === s.week);
    }
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek !== e.approachWeek || !e.startSource || e.startSource.round !== 1 || e.startSource.clockSeconds !== approached.clockSeconds ||
      e.startSource.runId !== s.runId || e.startSource.targetId !== e.targetId || e.startSource.randomSeed !== s.random.seed || e.startSource.attemptWeek !== e.attemptWeek || e.startSource.startHistoryIndex !== e.startHistoryIndex || e.startSource.revision <= e.approachRevision || e.startSource.revision > s.revision) return false;
    if (e.terminal && (!shape(e.terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds', 'playerEnergyPaid']) || !integer(e.terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return false;
    const liveExpected = structuredClone(approached);
    for (const [i, round] of rounds.entries()) {
      const o = round.fateTrojanOutcome, previous = rounds[i - 1]?.fateTrojanOutcome;
      if (!validateFateTrojanRoundOutcome(o) || !validateFateTrojanCombatRound(round) || round.round !== i + 1 || o.source.runId !== s.runId || o.source.targetId !== e.targetId || o.source.randomSeed !== s.random.seed ||
        o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || o.source.clockSeconds !== liveExpected.clockSeconds || (i < rounds.length - 1 && !o.continuing)) return false;
      if (previous) {
        const expected: FateTrojanCombatSource = { ...structuredClone(previous.source), revision: previous.source.revision + 1, round: i + 1, clockSeconds: previous.clockSecondsAfter,
          playerHealth: previous.playerHealthAfter, playerMind: previous.playerMindAfter, playerSpirituality: Math.min(120, previous.playerSpiritualityAfter + 12), enemyHealth: previous.enemyHealth, enemyMind: previous.enemyMind, enemySpirituality: previous.enemySpirituality,
          playerInjuries: structuredClone(previous.playerInjuriesAfter), enemyInjuries: structuredClone(previous.enemyInjuriesAfter), playerRisk: previous.playerRiskAfter, enemyRisk: previous.enemyRiskAfter, powerUses: { ...previous.powerUses }, randomCursor: previous.randomCursorAfter };
        if (!same(o.source, expected)) return false;
      } else if (!same(o.source, e.startSource) || o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.source.enemySpirituality !== 120 || o.source.enemyRisk !== 0 || o.source.enemyInjuries.length !== 0 || !same(o.source.powerUses, initial.powerUses)) return false;
      liveExpected.clockSeconds = o.clockSecondsAfter;
    }
    const last = rounds.at(-1), o = last?.fateTrojanOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk)) return false;
    if (e.status === 'FIGHTING') {
      if (e.terminal !== null || !hasFateTrojanDisputeOpponent(s) || !same(liveExpected, s.fateTrojan.life.site)) return false;
      if (!o) return s.combat!.lastRound === null && same(currentFateTrojanCombatSource(s), e.startSource) && same(e.powerUses, initial.powerUses) && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyRisk === 0 && e.enemyInjuries.length === 0;
      const actual = currentFateTrojanCombatSource(s), expected: FateTrojanCombatSource = { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, clockSeconds: o.clockSecondsAfter,
        playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter, playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality,
        playerInjuries: structuredClone(o.playerInjuriesAfter), enemyInjuries: structuredClone(o.enemyInjuriesAfter), playerRisk: o.playerRiskAfter, enemyRisk: o.enemyRiskAfter, powerUses: { ...o.powerUses }, randomCursor: o.randomCursorAfter };
      return o.continuing && same(last, s.combat!.lastRound) && same(actual, expected);
    }
    const t = e.terminal;
    if (s.combat?.encounterId === 'FATE_TROJAN_DISPUTE' || !t || !last || !o || o.continuing || t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    const exit = o.playerHealthAfter > 0 ? 2 : 0;
    if (t.exitMetres !== exit || t.exitSeconds !== exit || t.playerEnergyPaid !== exit) return false;
    if (exit) leaveFateTrojanCombatSite(liveExpected);
    if (!same(s.fateTrojan.life.site, liveExpected)) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
