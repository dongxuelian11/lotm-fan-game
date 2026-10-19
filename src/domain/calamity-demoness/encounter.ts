import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { projectDemonessPublicFields, projectCalamityDemonessPublicSite, type CalamityDemonessPublicSite, calamityDemonessLifeClosed, validateCalamityDemonessSiteState, type CalamityDemonessSiteState } from './life.js';
import { currentCalamityDemonessCombatSource, validateCalamityDemonessRoundOutcome, validateCalamityDemonessCombatRound, type CalamityDemonessCombatSource, type CalamityDemonessRoundOutcome } from './combat.js';

export const CALAMITY_DEMONESS_TARGET_ID = 'CD2-IRIS' as const;
export const CALAMITY_DEMONESS_POWER_IDS = ['FORCE_STRIKE', 'GUARD', 'DISRUPT'] as const;
export type CalamityDemonessPowerId = typeof CALAMITY_DEMONESS_POWER_IDS[number];
export type CalamityDemonessEnemyIntent = CalamityDemonessPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const CALAMITY_DEMONESS_POWERS = [
  { id: 'FORCE_STRIKE', label: '灵性冲击', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'GUARD', label: '一次屏护', cost: 4, selfGain: 0, enemyReduction: 0 },
  { id: 'DISRUPT', label: '扰断镜幕', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
interface PreparationBudget { cash: number; actions: number; health: number; mind: number; spirituality: number }
export interface CalamityDemonessPreparation {
  week: number; revision: number; runId: string; randomSeed: string; randomCursor: number;
  plateId: 'CD2-COMBAT-PLATE'; paidPennies: 20; initialCharges: 3; ownerId: 'PLAYER';
  lifeJournalLength: number; lifeClockSeconds: number; before: PreparationBudget; after: PreparationBudget;
}
export interface CalamityDemonessCombatPlate { id: 'CD2-COMBAT-PLATE'; ownerId: 'PLAYER'; quantity: 1; location: 'PLAYER'; initialCharges: 3; charges: number; paidPennies: 20 }
export interface CalamityDemonessClearance {
  week: number; veraConsent: 'GRANTED'; marcusConsent: 'GRANTED'; veraMetres: 2; marcusMetres: 2;
  veraEnergyPaid: 2; marcusEnergyPaid: 2; playerMetres: 4; playerEnergyPaid: 4; elapsedSeconds: 8;
}
export interface CalamityDemonessEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  exitMetres: 0 | 2; exitSeconds: 0 | 2; playerEnergyPaid: 0 | 2;
}
export interface CalamityDemonessEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof CALAMITY_DEMONESS_TARGET_ID;
  preparation: CalamityDemonessPreparation | null; plate: CalamityDemonessCombatPlate | null;
  approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  /** life.site freezes after its final report/reflection. startSite is that exact historical snapshot;
   * currentSite is the sole continuation of those bodies and objects, not another live gallery. */
  startSite: CalamityDemonessSiteState | null; currentSite: CalamityDemonessSiteState | null;
  startSource: CalamityDemonessCombatSource | null; clearance: CalamityDemonessClearance | null;
  yardId: 'CD2-YARD'; ordinaryExit: 'OPEN'; enemyPosition: 'YARD'; enemyDistanceMetres: 2;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<CalamityDemonessPowerId, number>;
  terminal: CalamityDemonessEncounterTerminal | null;
}
export type CalamityDemonessEncounterCommand = { type: 'PREPARE_ENCOUNTER' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface CalamityDemonessEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CalamityDemonessEncounterCommand }
export type CalamityDemonessPublicPreparation = Omit<CalamityDemonessPreparation, 'runId' | 'randomSeed' | 'randomCursor'>;
export function projectCalamityDemonessPreparation(p: CalamityDemonessPreparation): CalamityDemonessPublicPreparation {
  const budget = (b: PreparationBudget) => projectDemonessPublicFields(b, ['cash', 'actions', 'health', 'mind', 'spirituality']);
  return { ...projectDemonessPublicFields(p, ['week', 'revision', 'plateId', 'paidPennies', 'initialCharges', 'ownerId', 'lifeJournalLength', 'lifeClockSeconds']),
    before: budget(p.before), after: budget(p.after) };
}
export const projectCalamityDemonessCombatPlate = (p: CalamityDemonessCombatPlate): CalamityDemonessCombatPlate =>
  projectDemonessPublicFields(p, ['id', 'ownerId', 'quantity', 'location', 'initialCharges', 'charges', 'paidPennies']);
export const projectCalamityDemonessPowerUses = (p: Record<CalamityDemonessPowerId, number>) =>
  ({ FORCE_STRIKE: p.FORCE_STRIKE, GUARD: p.GUARD, DISRUPT: p.DISRUPT });
export interface CalamityDemonessEncounterProjection {
  title: string; story: string; status: CalamityDemonessEncounterState['status']; inside: boolean; site: CalamityDemonessPublicSite | null; startSite: CalamityDemonessPublicSite | null;
  preparation: CalamityDemonessPublicPreparation | null; plate: CalamityDemonessCombatPlate | null;
  enemy: null | { id: typeof CALAMITY_DEMONESS_TARGET_ID; name: '伊瑞丝'; age: 45; sequence: 3; health: number; mind: number; spirituality: number;
    status: CalamityDemonessEncounterState['enemyStatus']; weaponId: 'CD2-IRIS-ROD'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<CalamityDemonessPowerId, number> };
  actions: CalamityDemonessEncounterAction[]; facts: string[];
}
export const CALAMITY_DEMONESS_ENCOUNTER_STORY = '45岁的伊瑞丝在展廊附室外的独立后院提出通行争议，持自己的原棍，有独立身体、判断与120灵性。先收尾三项实践并反思，再另花20便士准备一片只有三次耐用次数的战斗镜片。取得维瑞娜与马库斯此次同意，两人各自步行2米到院外，你随后步行4米进入后院，另留2精力退出。馆内两面原镜、封闭容器与原记录都留在实际位置。交谈后可以和平离开；交战另作选择，可能受伤或死亡。';
const newPlate = (): CalamityDemonessCombatPlate => ({ id: 'CD2-COMBAT-PLATE', ownerId: 'PLAYER', quantity: 1, location: 'PLAYER', initialCharges: 3, charges: 3, paidPennies: 20 });
export function createCalamityDemonessEncounterState(): CalamityDemonessEncounterState {
  return { status: 'AVAILABLE', targetId: CALAMITY_DEMONESS_TARGET_ID, preparation: null, plate: null,
    approachWeek: null, approachRevision: null, attemptWeek: null, startHistoryIndex: null, startSite: null, currentSite: null, startSource: null, clearance: null,
    yardId: 'CD2-YARD', ordinaryExit: 'OPEN', enemyPosition: 'YARD', enemyDistanceMetres: 2,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { FORCE_STRIKE: 0, GUARD: 0, DISRUPT: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function validateCalamityDemonessEncounterCommand(v: unknown): v is CalamityDemonessEncounterCommand {
  return shape(v, ['type']) && ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isCalamityDemonessEncounterCommand = validateCalamityDemonessEncounterCommand;
export const hasCalamityDemonessEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.calamityDemoness.encounter.status);
export const isInsideCalamityDemonessEncounter = hasCalamityDemonessEncounterLock;
function otherSceneOpen(s: SliceState): boolean { return s.calamityDemoness.preparedWeek !== null || !calamityDemonessLifeClosed(s) || !s.calamityDemoness.life.reflected; }
function closedSite(p: CalamityDemonessSiteState): boolean {
  return validateCalamityDemonessSiteState(p) && p.siteId === 'CD2-GALLERY-ANNEX' && p.introducedWeek !== null && p.source !== null && p.playerLocation === 'ENTRY' && integer(p.playerEnergy, 6, 100) &&
    p.vera?.id === 'UD3-VERA' && p.vera.age === 46 && p.vera.alive && p.vera.willing && p.vera.location === 'ENTRY' && integer(p.vera.energy, 2, 100) &&
    p.marcus?.id === 'UD3-MARCUS' && p.marcus.age === 41 && p.marcus.alive && p.marcus.willing && p.marcus.location === 'ENTRY' && integer(p.marcus.energy, 2, 100) &&
    p.mirrorA?.id === 'UD3-MIRROR-A' && p.mirrorB?.id === 'UD3-MIRROR-B' && !p.screen.active && p.box.state === 'CLOSED' &&
    p.residue !== null && ['CONSUMED', 'HANDED_OVER'].includes(p.residue.status) && p.plates.every(x => x.status === 'RETURNED' && x.location === 'CUSTODIAN');
}
const clearance = (week: number): CalamityDemonessClearance => ({ week, veraConsent: 'GRANTED', marcusConsent: 'GRANTED', veraMetres: 2, marcusMetres: 2, veraEnergyPaid: 2, marcusEnergyPaid: 2, playerMetres: 4, playerEnergyPaid: 4, elapsedSeconds: 8 });
export function calamityDemonessApproachedSite(start: CalamityDemonessSiteState, week: number): CalamityDemonessSiteState {
  if (!closedSite(start) || !integer(week, 1) || start.introducedWeek! > week) throw new Error('先收尾展廊，两位原成人各留2精力离开，你须留6精力往返。');
  const p = structuredClone(start);
  for (const adult of [p.vera!, p.marcus!]) {
    adult.location = 'OUTSIDE'; adult.travelMetres += 2; adult.energy -= 2; p.clockSeconds += 2;
    p.actorMoves.push({ actorId: adult.id, from: 'ENTRY', to: 'OUTSIDE', mode: 'WALK', metres: 2, seconds: 2 });
  }
  p.playerLocation = 'YARD'; p.playerTravelMetres += 4; p.playerEnergy -= 4; p.clockSeconds += 4;
  return p;
}
export function leaveCalamityDemonessCombatSite(p: CalamityDemonessSiteState): void {
  if (p.playerLocation !== 'YARD' || p.playerEnergy < 2) throw new Error('须本人在庭院并保有2精力，才能沿普通出口离开。');
  p.playerLocation = 'OUTSIDE'; p.playerTravelMetres += 2; p.playerEnergy -= 2; p.clockSeconds += 2;
}
const budget = (s: SliceState): PreparationBudget => ({ cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality });
export function validateCalamityDemonessPreparation(value: unknown): value is CalamityDemonessPreparation {
  try {
    const p = value as CalamityDemonessPreparation;
    if (!shape(p, ['week', 'revision', 'runId', 'randomSeed', 'randomCursor', 'plateId', 'paidPennies', 'initialCharges', 'ownerId', 'lifeJournalLength', 'lifeClockSeconds', 'before', 'after']) ||
      !integer(p.week, 1) || !integer(p.revision, 1) || typeof p.runId !== 'string' || !p.runId || typeof p.randomSeed !== 'string' || !p.randomSeed || !integer(p.randomCursor) ||
      p.plateId !== 'CD2-COMBAT-PLATE' || p.paidPennies !== 20 || p.initialCharges !== 3 || p.ownerId !== 'PLAYER' || !integer(p.lifeJournalLength, 1) || !integer(p.lifeClockSeconds)) return false;
    for (const b of [p.before, p.after]) if (!shape(b, ['cash', 'actions', 'health', 'mind', 'spirituality']) || !integer(b.cash) || !integer(b.actions, 0, 100) || !integer(b.health, 1, 100) || !integer(b.mind, 1, 100) || !integer(b.spirituality, 0, 120)) return false;
    return p.before.cash >= 20 && same(p.after, { ...p.before, cash: p.before.cash - 20 });
  } catch { return false; }
}
function actualYard(s: SliceState): boolean {
  const e = s.calamityDemoness.encounter, p = e.currentSite;
  if (!p || !e.startSite || !closedSite(e.startSite) || e.approachWeek === null || !e.preparation || !validateCalamityDemonessPreparation(e.preparation)) return false;
  const expected = calamityDemonessApproachedSite(e.startSite, e.approachWeek); expected.clockSeconds = p.clockSeconds;
  return same(p, expected) && same(e.startSite, s.calamityDemoness.life.site) && e.yardId === 'CD2-YARD' && e.ordinaryExit === 'OPEN' && e.enemyPosition === 'YARD' && e.enemyDistanceMetres === 2 &&
    p.playerLocation === 'YARD' && p.vera?.location === 'OUTSIDE' && p.marcus?.location === 'OUTSIDE' && p.vera.alive && p.marcus.alive && p.playerEnergy >= 2 &&
    e.approachWeek === s.week && same(e.clearance, clearance(s.week)) && !p.screen.active && p.box.state === 'CLOSED' &&
    p.plates.every(x => x.status === 'RETURNED' && x.location === 'CUSTODIAN') && e.plate !== null && integer(e.plate.charges, 0, 3) && same(e.plate, { ...newPlate(), charges: e.plate.charges });
}
export function blockCalamityDemonessEncounter(s: SliceState, c: CalamityDemonessEncounterCommand): string | null {
  if (!validateCalamityDemonessEncounterCommand(c)) return '庭院遭遇命令无效。';
  const e = s.calamityDemoness.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为灾难魔女。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.calamityDemoness.guidanceKnown || s.calamityDemoness.promotionWeek === null) return '须已获得指导并完成本次晋升。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德。';
  if (otherSceneOpen(s)) return '先收尾三次实践、归还本案物品并完成反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && actualYard(s) ? null : '先到庭院交谈，才能沿普通出口离开。';
  if (s.mind <= 0) return '先恢复精神；交谈后仍可普通离开。';
  if (c.type === 'PREPARE_ENCOUNTER') {
    if (e.status !== 'AVAILABLE' || e.preparation || e.plate) return '本场独立镜片已经准备或遭遇已开始，不能重新购买、补充或修复。';
    if (!closedSite(s.calamityDemoness.life.site)) return '先安全收尾展廊，确认原成人与本人都在门口且有离场精力。';
    return s.cash < 20 ? '独立战斗镜片需要20便士。' : null;
  }
  if (s.actionsRemaining < 1) return '这次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') {
    if (e.status !== 'AVAILABLE') return '这位对手的接触已有进展或结局，不能重新生成。';
    if (!e.preparation || !e.plate || !same(e.plate, newPlate())) return '先实际另付20便士准备本场唯一的三次战斗镜片。';
    if (!closedSite(s.calamityDemoness.life.site)) return '两位原成人须在门口各留2精力离开，你须留6精力往返。';
    return s.actionsRemaining < 2 ? '交谈需1行动，请另留1行动决定是否交战；到场后也能和平离开。' : null;
  }
  return e.status === 'READY' && actualYard(s) ? null : '先实际交谈，让两名原成人按当次同意亲自离开。';
}
export const calamityDemonessEncounterReason = blockCalamityDemonessEncounter;
export function applyCalamityDemonessEncounterCommand(s: SliceState, c: CalamityDemonessEncounterCommand, ctx: SeerContext): void {
  const reason = blockCalamityDemonessEncounter(s, c); if (reason) throw new Error(reason); const e = s.calamityDemoness.encounter;
  if (c.type === 'PREPARE_ENCOUNTER') {
    const before = budget(s); s.cash -= 20;
    e.preparation = { week: s.week, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor,
      plateId: 'CD2-COMBAT-PLATE', paidPennies: 20, initialCharges: 3, ownerId: 'PLAYER', lifeJournalLength: s.calamityDemoness.life.journal.length,
      lifeClockSeconds: s.calamityDemoness.life.site.clockSeconds, before, after: budget(s) };
    e.plate = newPlate(); ctx.note('准备独立战斗镜片', '你实际另付20便士，取得本场唯一CD2-COMBAT-PLATE。只有三次耐用次数，生活案护片与馆内原镜没有被拿来替代；没有治疗或补充灵性。'); return;
  }
  if (c.type === 'LEAVE_ENCOUNTER') { leaveCalamityDemonessCombatSite(e.currentSite!); e.status = 'RESOLVED'; ctx.note('和平离开庭院', '你沿普通出口步行2米，耗时2秒并消耗2精力。维瑞娜与马库斯仍在院外，伊瑞丝持原棍留在庭院；已购镜片和支付记录保留。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.startSite = structuredClone(s.calamityDemoness.life.site); e.clearance = clearance(s.week); e.currentSite = calamityDemonessApproachedSite(e.startSite, s.week);
    e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1;
    ctx.note('与伊瑞丝交谈', '维瑞娜与马库斯都明确同意离开，各自步行2米、耗时2秒并消耗2精力。你随后步行4米到后院，耗时4秒并消耗4精力。双方尚未交战，你仍可沿2米普通出口和平离开。'); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'CALAMITY_DEMONESS_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentCalamityDemonessCombatSource(s); if (!source) throw new Error('庭院的开战来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('庭院交战', '你选择与伊瑞丝交战。两位原成人已实际离开，双方各用自己的身体、武器和灵性。原科宾仍保持既有投降结局，馆内原镜、原封闭容器与归还的生活护片都留在原处。');
}
export const applyCalamityDemonessEncounter = applyCalamityDemonessEncounterCommand;
export function startCalamityDemonessEncounter(s: SliceState, ctx: SeerContext): void { applyCalamityDemonessEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasCalamityDemonessDisputeOpponent(s: SliceState): boolean {
  const e = s.calamityDemoness?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    s.calamityDemoness.guidanceKnown && s.calamityDemoness.promotionWeek !== null && !!e && e.status === 'FIGHTING' && e.targetId === CALAMITY_DEMONESS_TARGET_ID && e.terminal === null &&
    e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' && actualYard(s) && e.approachWeek !== null && e.attemptWeek === s.week &&
    c?.encounterId === 'CALAMITY_DEMONESS_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(e.enemySpirituality, 0, 120) && CALAMITY_DEMONESS_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - CALAMITY_DEMONESS_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) && integer(c.round, 1) &&
    e.plate !== null && integer(e.plate.charges, 0, 3) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleCalamityDemonessEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.calamityDemoness.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'CALAMITY_DEMONESS_DISPUTE') throw new Error('当前没有在庭院进行的战斗。'); if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知战斗结果。');
  const last = c.lastRound, o = last?.calamityDemonessOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateCalamityDemonessRoundOutcome(o) || !validateCalamityDemonessCombatRound(last) || o.continuing || c.round !== last.round + 1 ||
    s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || o.clockSecondsAfter !== e.currentSite?.clockSeconds || o.plateChargesAfter !== e.plate?.charges ||
    o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) || (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('身体、现场、镜片、资源或完整战斗结果不符。');
  const exit = s.health > 0 ? 2 : 0; if (exit) leaveCalamityDemonessCombatSite(e.currentSite!);
  e.terminal = { outcome: outcome as CalamityDemonessEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: exit, exitSeconds: exit, playerEnergyPaid: exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('庭院冲突结束', `${outcome === 'PLAYER_DEAD' ? '你已死亡，身体与所持镜片留在庭院。' : '你沿普通出口步行2米、耗时2秒并消耗2精力，带着同一镜片回到院外。'}维瑞娜与马库斯仍在院外；伊瑞丝和自己的原棍留在庭院，耗去的镜片次数、灵性、伤势和既有物件状态保留。`);
}
export const finishCalamityDemonessEncounter = settleCalamityDemonessEncounter;
export function calamityDemonessEncounterActions(s: SliceState): CalamityDemonessEncounterAction[] {
  if (!stage(s)) return [];
  return ([['PREPARE_ENCOUNTER', '另备一片战斗镜片', '20便士；0行动；唯一镜片共3次耐用次数'],
    ['ENCOUNTER_TALK', '取得同意并前往庭院交谈', '1行动；两人各2米/秒/精力，你4米/秒/精力'],
    ['ENCOUNTER_FIGHT', '选择与伊瑞丝交战', '1行动；有受伤和死亡风险'], ['LEAVE_ENCOUNTER', '沿出口和平离开', '0行动；2米/2秒/2精力']] as const).map(([type, label, cost]) => {
    const command: CalamityDemonessEncounterCommand = { type }, reason = blockCalamityDemonessEncounter(s, command); return { id: `calamity-demoness-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectCalamityDemonessEncounter(s: SliceState): CalamityDemonessEncounterProjection {
  const e = s.calamityDemoness.encounter;
  if (!stage(s)) return { title: '尚未开放的庭院遭遇', story: '', status: e.status, inside: false, site: null, startSite: null, preparation: null, plate: null, enemy: null, actions: [], facts: [] };
  return { title: '庭院里的伊瑞丝', story: CALAMITY_DEMONESS_ENCOUNTER_STORY, status: e.status, inside: hasCalamityDemonessEncounterLock(s), site: projectCalamityDemonessPublicSite(e.currentSite ?? s.calamityDemoness.life.site), startSite: e.startSite ? projectCalamityDemonessPublicSite(e.startSite) : null,
    preparation: e.preparation ? projectCalamityDemonessPreparation(e.preparation) : null, plate: e.plate ? projectCalamityDemonessCombatPlate(e.plate) : null, enemy: { id: CALAMITY_DEMONESS_TARGET_ID, name: '伊瑞丝', age: 45, sequence: 3,
      health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'CD2-IRIS-ROD', weaponLocation: e.weaponLocation, powerUses: projectCalamityDemonessPowerUses(e.powerUses) },
    actions: calamityDemonessEncounterActions(s), facts: ['维瑞娜与马库斯是原馆舍的同两位成人，按此次同意各走2米离开；既有到场路程与精力不重置。',
      '两面原镜、原封闭容器和归还的三片生活护片留在馆内；旧素描、包裹与登记没有复制或重写。',
      '另付20便士的战斗镜片只有3次耐用次数。镜幕成功准备即耗一次，只缓冲随后一次身体攻击45；扰断、过期均不返还。',
      '黑焰每轮最多一次6灵性/知识20尝试，成功仅有85×身体状态攻势；冰霜沿用原掌握，以6灵性/知识18取得有限减势。',
      '全力防守整轮停止普通攻击和黑焰。伊瑞丝每轮屏护只削弱一次真实打击或黑焰，扰断只解除当前镜幕。',
      '各动作5秒、各回合60秒；离场另走2米、耗2秒和2精力。无同行者、友军免疫、自动修镜、免费治疗或复活。'] };
}
/** Every encounter site is reconstructed from the frozen, independently replayed life journal.
 * Ordered combat sources additionally bind the exact paid plate, original adults and objects,
 * all counts/actions/RNG cursors and the shared physical injury/death consequences. */
export function validateCalamityDemonessEncounter(s: SliceState): boolean {
  try {
    const e = s.calamityDemoness?.encounter, initial = createCalamityDemonessEncounterState();
    if (!e || !validateCalamityDemonessSiteState(s.calamityDemoness.life.site) || !shape(e, Object.keys(initial)) || e.targetId !== CALAMITY_DEMONESS_TARGET_ID || e.yardId !== 'CD2-YARD' || e.ordinaryExit !== 'OPEN' || e.enemyPosition !== 'YARD' || e.enemyDistanceMetres !== 2 ||
      !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !integer(e.enemyHealth, 0, 100) || e.enemyMind !== 100 || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !Array.isArray(e.enemyInjuries) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD') ||
      !shape(e.powerUses, CALAMITY_DEMONESS_POWER_IDS) || !CALAMITY_DEMONESS_POWER_IDS.every(id => integer(e.powerUses[id])) || e.enemySpirituality !== 120 - CALAMITY_DEMONESS_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    const allNew = s.combatHistory.flatMap((r, i) => r.calamityDemonessOutcome ? [i] : []);
    if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'CALAMITY_DEMONESS_DISPUTE';
    const prep = e.preparation;
    if (!stage(s) || !s.calamityDemoness.guidanceKnown || s.calamityDemoness.promotionWeek === null || !validateCalamityDemonessPreparation(prep) ||
      prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor || !integer(prep.week, s.calamityDemoness.promotionWeek, s.week) || !integer(prep.revision, 1, s.revision) ||
      prep.lifeJournalLength !== s.calamityDemoness.life.journal.length || prep.lifeClockSeconds !== s.calamityDemoness.life.site.clockSeconds || !calamityDemonessLifeClosed(s) || !s.calamityDemoness.life.reflected ||
      !e.plate || !integer(e.plate.charges, 0, 3) || !same(e.plate, { ...newPlate(), charges: e.plate.charges })) return false;
    if (e.status === 'AVAILABLE') return same({ ...e, preparation: null, plate: null }, initial) && same(e.plate, newPlate()) && closedSite(s.calamityDemoness.life.site) && allNew.length === 0 && s.combat?.encounterId !== 'CALAMITY_DEMONESS_DISPUTE';
    if (e.approachWeek === null || e.approachWeek < prep.week || !integer(e.approachRevision, prep.revision + 1, s.revision) || !e.startSite || !closedSite(e.startSite) ||
      !same(e.startSite, s.calamityDemoness.life.site) || !same(e.clearance, clearance(e.approachWeek)) || !e.currentSite || !validateCalamityDemonessSiteState(e.currentSite)) return false;
    const approached = calamityDemonessApproachedSite(e.startSite, e.approachWeek);
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED', expected = structuredClone(approached); if (peaceful) leaveCalamityDemonessCombatSite(expected);
      return (ready || peaceful) && e.attemptWeek === null && e.startSource === null && e.terminal === null && allNew.length === 0 && same(e.currentSite, expected) && same(e.plate, newPlate()) &&
        same({ ...e, status: initial.status, preparation: null, plate: null, approachWeek: null, approachRevision: null, startSite: null, currentSite: null, clearance: null }, initial) && s.combat?.encounterId !== 'CALAMITY_DEMONESS_DISPUTE' &&
        (!ready || s.status === 'ACTIVE' && !otherSceneOpen(s) && e.approachWeek === s.week);
    }
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek !== e.approachWeek || !e.startSource || e.startSource.round !== 1 || e.startSource.clockSeconds !== approached.clockSeconds ||
      e.startSource.plateCharges !== 3 || !same(e.startSource.site, approached) || !same(e.startSource.preparation, prep) ||
      e.startSource.runId !== s.runId || e.startSource.targetId !== e.targetId || e.startSource.randomSeed !== s.random.seed || e.startSource.attemptWeek !== e.attemptWeek || e.startSource.startHistoryIndex !== e.startHistoryIndex || e.startSource.revision <= e.approachRevision || e.startSource.revision > s.revision) return false;
    if (e.terminal && (!shape(e.terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds', 'playerEnergyPaid']) || !integer(e.terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return false;
    const liveExpected = structuredClone(approached); let charges = 3;
    for (const [i, round] of rounds.entries()) {
      const o = round.calamityDemonessOutcome, previous = rounds[i - 1]?.calamityDemonessOutcome;
      if (!validateCalamityDemonessRoundOutcome(o) || !validateCalamityDemonessCombatRound(round) || round.round !== i + 1 || o.source.runId !== s.runId || o.source.targetId !== e.targetId || o.source.randomSeed !== s.random.seed ||
        o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || o.source.clockSeconds !== liveExpected.clockSeconds ||
        o.source.plateCharges !== charges || !same(o.source.site, liveExpected) || !same(o.source.preparation, prep) || (i < rounds.length - 1 && !o.continuing)) return false;
      if (previous) {
        if (!same(o.source, nextSource(previous))) return false;
      } else if (!same(o.source, e.startSource) || o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.source.enemySpirituality !== 120 || o.source.enemyRisk !== 0 || o.source.enemyInjuries.length !== 0 || !same(o.source.powerUses, initial.powerUses)) return false;
      liveExpected.clockSeconds = o.clockSecondsAfter; charges = o.plateChargesAfter;
    }
    const last = rounds.at(-1), o = last?.calamityDemonessOutcome;
    if (e.plate.charges !== charges || o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk)) return false;
    if (e.status === 'FIGHTING') {
      if (e.terminal !== null || !hasCalamityDemonessDisputeOpponent(s) || !same(liveExpected, e.currentSite)) return false;
      if (!o) return s.combat!.lastRound === null && same(currentCalamityDemonessCombatSource(s), e.startSource) && same(e.powerUses, initial.powerUses) && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyRisk === 0 && e.enemyInjuries.length === 0;
      return o.continuing && same(last, s.combat!.lastRound) && same(currentCalamityDemonessCombatSource(s), nextSource(o));
    }
    const t = e.terminal;
    if (s.combat?.encounterId === 'CALAMITY_DEMONESS_DISPUTE' || !t || !last || !o || o.continuing || t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    const exit = o.playerHealthAfter > 0 ? 2 : 0;
    if (t.exitMetres !== exit || t.exitSeconds !== exit || t.playerEnergyPaid !== exit) return false;
    if (exit) leaveCalamityDemonessCombatSite(liveExpected);
    if (!same(e.currentSite, liveExpected)) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
function nextSource(o: CalamityDemonessRoundOutcome): CalamityDemonessCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, clockSeconds: o.clockSecondsAfter,
    site: { ...structuredClone(o.source.site), clockSeconds: o.clockSecondsAfter }, plateCharges: o.plateChargesAfter,
    playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter, playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality,
    playerInjuries: structuredClone(o.playerInjuriesAfter), enemyInjuries: structuredClone(o.enemyInjuriesAfter), playerRisk: o.playerRiskAfter, enemyRisk: o.enemyRiskAfter, powerUses: { ...o.powerUses }, randomCursor: o.randomCursorAfter };
}
export const validateCalamityDemonessEncounterState = validateCalamityDemonessEncounter;
export const handleCalamityDemonessEncounter = applyCalamityDemonessEncounterCommand;
