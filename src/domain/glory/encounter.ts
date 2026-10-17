import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { gloryLifeClosed, validateGlorySiteState, type GlorySiteState } from './life.js';
import { currentGloryCombatSource, validateGloryRoundOutcome, validateGloryCombatRound, type GloryCombatSource } from './combat.js';

export const GLORY_TARGET_ID = 'GL2-MARTIN' as const;
export const GLORY_POWER_IDS = ['FORCE_STRIKE', 'GUARD', 'DISCERN'] as const;
export type GloryPowerId = typeof GLORY_POWER_IDS[number];
export type GloryEnemyIntent = GloryPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const GLORY_POWERS = [
  { id: 'FORCE_STRIKE', label: '灵性冲击', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'GUARD', label: '一次屏护', cost: 4, selfGain: 0, enemyReduction: 0 },
  { id: 'DISCERN', label: '辨识防护', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface GloryClearance {
  week: number; celiaConsent: 'GRANTED'; evanConsent: 'GRANTED';
  celiaMetres: 4; evanMetres: 4; celiaEnergyPaid: 4; evanEnergyPaid: 4; playerMetres: 4; playerEnergyPaid: 4; armorId: 'SK3-LIFE-ARMOR' | null; armorDressingSeconds: 0 | 4; elapsedSeconds: 12 | 16;
}
export interface GloryEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  exitMetres: 0 | 2; exitSeconds: 0 | 2; playerEnergyPaid: 0 | 2;
}
export interface GloryEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof GLORY_TARGET_ID;
  approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  /** Historical snapshots only. life.site remains the one authoritative live body/object state. */
  startSite: GlorySiteState | null; startSource: GloryCombatSource | null; clearance: GloryClearance | null;
  yardId: 'GL2-YARD'; ordinaryExit: 'OPEN'; enemyPosition: 'YARD'; enemyDistanceMetres: 2;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<GloryPowerId, number>;
  terminal: GloryEncounterTerminal | null;
}
export type GloryEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface GloryEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: GloryEncounterCommand }
export interface GloryEncounterProjection {
  title: string; story: string; status: GloryEncounterState['status']; inside: boolean; site: GlorySiteState | null; startSite: GlorySiteState | null;
  enemy: null | { id: typeof GLORY_TARGET_ID; name: '马丁'; age: 45; sequence: 3; health: number; mind: number; spirituality: number;
    status: GloryEncounterState['enemyStatus']; weaponId: 'GL2-MARTIN-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<GloryPowerId, number> };
  actions: GloryEncounterAction[]; facts: string[];
}
export const GLORY_ENCOUNTER_STORY = '45岁的马丁在修护室外的独立后院提出通行争议，持有自己的一根棍，拥有自己的身体、判断与120灵性。先收尾三次实践并反思；取得西莉娅与埃文此次同意，让两人各步行4米到院外。你在门口花4秒穿好已经形成的同一银甲，再步行4米进入后院；未形成的银甲不能凭空出现。交谈后可普通步行2米和平离开，交战需要另作选择，可能受伤或死亡。院内没有同行者，近身护持只承担本人防守。';
export function createGloryEncounterState(): GloryEncounterState {
  return { status: 'AVAILABLE', targetId: GLORY_TARGET_ID, approachWeek: null, approachRevision: null, attemptWeek: null, startHistoryIndex: null,
    startSite: null, startSource: null, clearance: null, yardId: 'GL2-YARD', ordinaryExit: 'OPEN', enemyPosition: 'YARD', enemyDistanceMetres: 2,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { FORCE_STRIKE: 0, GUARD: 0, DISCERN: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function validateGloryEncounterCommand(v: unknown): v is GloryEncounterCommand { return shape(v, ['type']) && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type)); }
export const isGloryEncounterCommand = validateGloryEncounterCommand;
export const hasGloryEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.glory.encounter.status);
export const isInsideGloryEncounter = hasGloryEncounterLock;
function otherSceneOpen(s: SliceState): boolean { return s.glory.preparedWeek !== null || !gloryLifeClosed(s) || !s.glory.life.reflected; }
function closedSite(p: GlorySiteState): boolean {
  return validateGlorySiteState(p) && p.siteId === 'GL2-REPAIR-ROOM' && p.introducedWeek !== null && p.playerLocation === 'ENTRY' && integer(p.playerEnergy, 6, 100) &&
    p.celia.id === 'GL2-CELIA' && p.celia.alive && p.celia.location === 'BENCH' && integer(p.celia.energy, 4, 100) &&
    p.evan.id === 'GL2-EVAN' && p.evan.alive && p.evan.location === 'BENCH' && integer(p.evan.energy, 4, 100) &&
    p.armorSource !== null && p.armor !== null && !p.armorWorn && !p.temper.active && !p.guard.active && !p.pads.worn && p.pads.location === 'BENCH' && p.plates.every(x => x.location === 'BENCH');
}
const clearance = (week: number, p: GlorySiteState): GloryClearance => ({ week, celiaConsent: 'GRANTED', evanConsent: 'GRANTED', celiaMetres: 4, evanMetres: 4, celiaEnergyPaid: 4, evanEnergyPaid: 4, playerMetres: 4, playerEnergyPaid: 4,
  armorId: p.armor?.formed ? 'SK3-LIFE-ARMOR' : null, armorDressingSeconds: p.armor?.formed ? 4 : 0, elapsedSeconds: p.armor?.formed ? 16 : 12 });
/** Both original room actors physically leave before the player dresses and walks into the hostile yard.
 * Historical startSite is not another current scene. This result replaces the one live site. */
export function gloryApproachedSite(start: GlorySiteState, week: number): GlorySiteState {
  if (!closedSite(start) || !integer(week, 1) || start.introducedWeek! > week) throw new Error('先收尾修护室，两人各留4精力离开，你须留6精力往返。');
  const p = structuredClone(start);
  p.celia.location = 'OUTSIDE'; p.celia.travelMetres += 4; p.celia.energy -= 4; p.clockSeconds += 4;
  p.evan.location = 'OUTSIDE'; p.evan.travelMetres += 4; p.evan.energy -= 4; p.clockSeconds += 4;
  if (p.armor?.formed) { p.armorWorn = true; p.clockSeconds += 4; }
  p.playerLocation = 'YARD'; p.playerTravelMetres += 4; p.playerEnergy -= 4; p.clockSeconds += 4;
  return p;
}
export function leaveGloryCombatSite(p: GlorySiteState): void {
  if (p.playerLocation !== 'YARD' || p.playerEnergy < 2) throw new Error('须本人在庭院并保有2精力，才能沿普通出口离开。');
  p.playerLocation = 'OUTSIDE'; p.playerTravelMetres += 2; p.playerEnergy -= 2; p.clockSeconds += 2;
}
function actualYard(s: SliceState): boolean {
  const e = s.glory.encounter, p = s.glory.life.site;
  return e.yardId === 'GL2-YARD' && e.ordinaryExit === 'OPEN' && e.enemyPosition === 'YARD' && e.enemyDistanceMetres === 2 && p.playerLocation === 'YARD' &&
    p.celia.location === 'OUTSIDE' && p.evan.location === 'OUTSIDE' && p.celia.alive && p.evan.alive && p.playerEnergy >= 2 &&
    e.approachWeek === s.week && same(e.clearance, clearance(s.week, p)) && p.armorWorn === (p.armor?.formed === true) && !p.temper.active && !p.guard.active && !p.pads.worn && p.plates.every(x => x.location === 'BENCH');
}
export function blockGloryEncounter(s: SliceState, c: GloryEncounterCommand): string | null {
  if (!validateGloryEncounterCommand(c)) return '庭院遭遇命令无效。';
  const e = s.glory.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为荣耀者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.glory.guidanceKnown || s.glory.promotionWeek === null) return '须已获得指导并完成本次晋升。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德。';
  if (otherSceneOpen(s)) return '先收尾三次实践、归还本案物品并完成反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && actualYard(s) ? null : '先到庭院交谈，才能沿普通出口离开。';
  if (s.mind <= 0) return '先恢复精神；交谈后仍可普通离开。';
  if (s.actionsRemaining < 1) return '这次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') {
    if (e.status !== 'AVAILABLE') return '这位对手的接触已有进展或结局，不能重新生成。';
    if (!closedSite(s.glory.life.site)) return '先收尾修护室，两位成人须各留4精力离开，你须留6精力往返。';
    return s.actionsRemaining < 2 ? '交谈需1行动，请另留1行动决定是否交战；到场后也能和平离开。' : null;
  }
  return e.status === 'READY' && actualYard(s) ? null : '先实际交谈，让两名原成人按当次同意亲自离开。';
}
export const gloryEncounterReason = blockGloryEncounter;
export function applyGloryEncounterCommand(s: SliceState, c: GloryEncounterCommand, ctx: SeerContext): void {
  const reason = blockGloryEncounter(s, c); if (reason) throw new Error(reason); const e = s.glory.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { leaveGloryCombatSite(s.glory.life.site); e.status = 'RESOLVED'; ctx.note('和平离开庭院', '你沿普通出口步行2米，耗时2秒并消耗2精力。西莉娅与埃文仍在院外，马丁持棍留在庭院。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.startSite = structuredClone(s.glory.life.site); e.clearance = clearance(s.week, e.startSite); s.glory.life.site = gloryApproachedSite(e.startSite, s.week);
    e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1;
    ctx.note('与马丁交谈', `西莉娅与埃文都明确同意离开，各自行走4米、耗时4秒并消耗4精力。${e.clearance.armorDressingSeconds ? '你在门口花4秒穿好同一件已经形成的银甲。' : '原甲未形成，不会产生可穿用的新甲。'}你随后步行4米到后院，耗时4秒并消耗4精力。你尚未选择交战，也可沿2米普通出口和平离开。`); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'GLORY_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentGloryCombatSource(s); if (!source) throw new Error('庭院的开战来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('庭院交战', '你选择与马丁交战。两位成人已经亲自退到院外，双方各用自己的身体、武器和灵性。同一原甲保留实际完整度，护片与垫片留在修护室。');
}
export const applyGloryEncounter = applyGloryEncounterCommand;
export function startGloryEncounter(s: SliceState, ctx: SeerContext): void { applyGloryEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasGloryDisputeOpponent(s: SliceState): boolean {
  const e = s.glory?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    s.glory.guidanceKnown && s.glory.promotionWeek !== null && !!e && e.status === 'FIGHTING' && e.targetId === GLORY_TARGET_ID && e.terminal === null &&
    e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' && actualYard(s) && e.approachWeek !== null && e.attemptWeek === s.week &&
    c?.encounterId === 'GLORY_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(e.enemySpirituality, 0, 120) && GLORY_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - GLORY_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) && integer(c.round, 1) &&
    e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleGloryEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.glory.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'GLORY_DISPUTE') throw new Error('当前没有在庭院进行的战斗。'); if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知战斗结果。');
  const last = c.lastRound, o = last?.gloryOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateGloryRoundOutcome(o) || !validateGloryCombatRound(last) || o.continuing || c.round !== last.round + 1 ||
    s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || o.clockSecondsAfter !== s.glory.life.site.clockSeconds || o.armorIntegrityAfter !== (s.glory.life.site.armor?.integrity ?? 0) ||
    o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) || (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('身体、现场、资源或完整战斗结果不符。');
  const exit = s.health > 0 ? 2 : 0; if (exit) leaveGloryCombatSite(s.glory.life.site);
  e.terminal = { outcome: outcome as GloryEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: exit, exitSeconds: exit, playerEnergyPaid: exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('庭院冲突结束', `${outcome === 'PLAYER_DEAD' ? '你已死亡，身体留在庭院。' : '你沿普通出口步行2米、耗时2秒并消耗2精力，回到院外。'}西莉娅与埃文仍在院外，马丁和自己的棍留在庭院，同一银甲和已耗用物资保留实际状态。`);
}
export const finishGloryEncounter = settleGloryEncounter;
export function gloryEncounterActions(s: SliceState): GloryEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '取得同意并前往庭院交谈', '1行动；两人各4米/秒/精力，同一已形成银甲穿戴4秒，你4米/秒/精力'],
    ['ENCOUNTER_FIGHT', '选择与马丁交战', '1行动；有受伤和死亡风险'], ['LEAVE_ENCOUNTER', '沿出口和平离开', '0行动；2米/2秒/2精力']] as const).map(([type, label, cost]) => {
    const command: GloryEncounterCommand = { type }, reason = blockGloryEncounter(s, command); return { id: `glory-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectGloryEncounter(s: SliceState): GloryEncounterProjection {
  const e = s.glory.encounter;
  if (!stage(s)) return { title: '尚未开放的庭院遭遇', story: '', status: e.status, inside: false, site: null, startSite: null, enemy: null, actions: [], facts: [] };
  return { title: '庭院里的马丁', story: GLORY_ENCOUNTER_STORY, status: e.status, inside: hasGloryEncounterLock(s), site: structuredClone(s.glory.life.site), startSite: structuredClone(e.startSite),
    enemy: { id: GLORY_TARGET_ID, name: '马丁', age: 45, sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      weaponId: 'GL2-MARTIN-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: gloryEncounterActions(s),
    facts: ['西莉娅与埃文本人在当次同意后，各自步行4米退到院外，实际精力与路程保留。',
      '你在门口亲手穿好同一件已形成的银甲，耗时4秒；此前完整度与之后磨损连续保留。',
      '银甲淬护每轮最多一次6灵性、知识20尝试，只削弱随后一次实际身体攻击45，应用时同一银甲再磨损5。',
      '院内没有同行者。近身护持是本人防守，每轮最多一次6灵性、意志20尝试，成功进入后付5健康取得30防守优势，不声称保护虚构同伴。',
      '马丁的辨识只解除已存在的一次淬甲防护，屏护只削弱随后一次实际普通打击。',
      '各动作5秒、各回合60秒；离场另走2米、耗2秒和2精力。真实伤势、死亡与已支付成本保留，战斗不增长掌握。'] };
}
/** Life's independent journal validator proves startSite; this function proves its only live continuation.
 * Neither validator calls the other, avoiding recursion. Every subsequent site field is compared,
 * including exhausted energy, original actors, paid plates, consumed pads and the same original armor. */
export function validateGloryEncounter(s: SliceState): boolean {
  try {
    const e = s.glory?.encounter, initial = createGloryEncounterState();
    if (!e || !validateGlorySiteState(s.glory.life.site) || !shape(e, Object.keys(initial)) || e.targetId !== GLORY_TARGET_ID || e.yardId !== 'GL2-YARD' || e.ordinaryExit !== 'OPEN' || e.enemyPosition !== 'YARD' || e.enemyDistanceMetres !== 2 ||
      !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !integer(e.enemyHealth, 0, 100) || e.enemyMind !== 100 || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !Array.isArray(e.enemyInjuries) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD') ||
      !shape(e.powerUses, GLORY_POWER_IDS) || !GLORY_POWER_IDS.every(id => integer(e.powerUses[id])) || e.enemySpirituality !== 120 - GLORY_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    const allNew = s.combatHistory.flatMap((r, i) => r.gloryOutcome ? [i] : []);
    if (e.status === 'AVAILABLE') return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'GLORY_DISPUTE';
    if (!stage(s) || !s.glory.guidanceKnown || s.glory.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.glory.promotionWeek || !integer(e.approachRevision, 1, s.revision) ||
      !gloryLifeClosed(s) || !s.glory.life.reflected || !e.startSite || !closedSite(e.startSite) || !same(e.clearance, clearance(e.approachWeek, e.startSite))) return false;
    const approached = gloryApproachedSite(e.startSite, e.approachWeek);
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED', expected = structuredClone(approached); if (peaceful) leaveGloryCombatSite(expected);
      return (ready || peaceful) && e.attemptWeek === null && e.startSource === null && e.terminal === null && allNew.length === 0 && same(s.glory.life.site, expected) &&
        same({ ...e, status: initial.status, approachWeek: null, approachRevision: null, startSite: null, clearance: null }, initial) && s.combat?.encounterId !== 'GLORY_DISPUTE' &&
        (!ready || s.status === 'ACTIVE' && !otherSceneOpen(s) && e.approachWeek === s.week);
    }
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek !== e.approachWeek || !e.startSource || e.startSource.round !== 1 || e.startSource.clockSeconds !== approached.clockSeconds || e.startSource.armorIntegrity !== (approached.armor?.integrity ?? 0) || e.startSource.armorWorn !== approached.armorWorn || !same(e.startSource.armorSource, approached.armorSource) ||
      e.startSource.runId !== s.runId || e.startSource.targetId !== e.targetId || e.startSource.randomSeed !== s.random.seed || e.startSource.attemptWeek !== e.attemptWeek || e.startSource.startHistoryIndex !== e.startHistoryIndex || e.startSource.revision <= e.approachRevision || e.startSource.revision > s.revision) return false;
    if (e.terminal && (!shape(e.terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds', 'playerEnergyPaid']) || !integer(e.terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return false;
    const liveExpected = structuredClone(approached);
    for (const [i, round] of rounds.entries()) {
      const o = round.gloryOutcome, previous = rounds[i - 1]?.gloryOutcome;
      if (!validateGloryRoundOutcome(o) || !validateGloryCombatRound(round) || round.round !== i + 1 || o.source.runId !== s.runId || o.source.targetId !== e.targetId || o.source.randomSeed !== s.random.seed ||
        o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || o.source.clockSeconds !== liveExpected.clockSeconds || o.source.armorIntegrity !== (liveExpected.armor?.integrity ?? 0) || o.source.armorWorn !== liveExpected.armorWorn || !same(o.source.armorSource, liveExpected.armorSource) || (i < rounds.length - 1 && !o.continuing)) return false;
      if (previous) {
        const expected: GloryCombatSource = { ...structuredClone(previous.source), revision: previous.source.revision + 1, round: i + 1, clockSeconds: previous.clockSecondsAfter,
          armorIntegrity: previous.armorIntegrityAfter, playerHealth: previous.playerHealthAfter, playerMind: previous.playerMindAfter, playerSpirituality: Math.min(120, previous.playerSpiritualityAfter + 12), enemyHealth: previous.enemyHealth, enemyMind: previous.enemyMind, enemySpirituality: previous.enemySpirituality,
          playerInjuries: structuredClone(previous.playerInjuriesAfter), enemyInjuries: structuredClone(previous.enemyInjuriesAfter), playerRisk: previous.playerRiskAfter, enemyRisk: previous.enemyRiskAfter, powerUses: { ...previous.powerUses }, randomCursor: previous.randomCursorAfter };
        if (!same(o.source, expected)) return false;
      } else if (!same(o.source, e.startSource) || o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.source.enemySpirituality !== 120 || o.source.enemyRisk !== 0 || o.source.enemyInjuries.length !== 0 || !same(o.source.powerUses, initial.powerUses)) return false;
      liveExpected.clockSeconds = o.clockSecondsAfter; if (liveExpected.armor) liveExpected.armor.integrity = o.armorIntegrityAfter;
    }
    const last = rounds.at(-1), o = last?.gloryOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk)) return false;
    if (e.status === 'FIGHTING') {
      if (e.terminal !== null || !hasGloryDisputeOpponent(s) || !same(liveExpected, s.glory.life.site)) return false;
      if (!o) return s.combat!.lastRound === null && same(currentGloryCombatSource(s), e.startSource) && same(e.powerUses, initial.powerUses) && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyRisk === 0 && e.enemyInjuries.length === 0;
      const actual = currentGloryCombatSource(s), expected: GloryCombatSource = { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, clockSeconds: o.clockSecondsAfter,
        armorIntegrity: o.armorIntegrityAfter, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter, playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality,
        playerInjuries: structuredClone(o.playerInjuriesAfter), enemyInjuries: structuredClone(o.enemyInjuriesAfter), playerRisk: o.playerRiskAfter, enemyRisk: o.enemyRiskAfter, powerUses: { ...o.powerUses }, randomCursor: o.randomCursorAfter };
      return o.continuing && same(last, s.combat!.lastRound) && same(actual, expected);
    }
    const t = e.terminal;
    if (s.combat?.encounterId === 'GLORY_DISPUTE' || !t || !last || !o || o.continuing || t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    const exit = o.playerHealthAfter > 0 ? 2 : 0;
    if (t.exitMetres !== exit || t.exitSeconds !== exit || t.playerEnergyPaid !== exit) return false;
    if (exit) leaveGloryCombatSite(liveExpected);
    if (!same(s.glory.life.site, liveExpected)) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}

export const validateGloryEncounterState = validateGloryEncounter;
export const handleGloryEncounter = applyGloryEncounterCommand;
