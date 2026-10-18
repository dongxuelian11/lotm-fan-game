import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { sageLifeClosed, validateSageSiteState, type SageSiteState } from './life.js';
import { currentSageCombatSource, validateSageRoundOutcome, validateSageCombatRound, type SageCombatSource, type SageRoundOutcome } from './combat.js';

/** Original individual G opponent. The 120S budget is individual, not a rule for all S3 people. */
export const SAGE_TARGET_ID = 'SG2-MERRIN' as const;
export const SAGE_POWER_IDS = ['ARC_BOLT', 'WARD', 'FEINT'] as const;
export type SagePowerId = typeof SAGE_POWER_IDS[number];
export type SageEnemyIntent = SagePowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const SAGE_POWERS = [
  { id: 'ARC_BOLT', label: '有限弧光', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '一次屏护', cost: 4, selfGain: 0, enemyReduction: 0 },
  { id: 'FEINT', label: '假动作', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
interface PreparationBudget { cash: number; actions: number; health: number; mind: number; spirituality: number }
export interface SagePreparation {
  week: number; revision: number; runId: string; randomSeed: string; randomCursor: number;
  mindPaid: 2; lifeJournalLength: number; lifeClockSeconds: number; before: PreparationBudget; after: PreparationBudget;
}
export interface SageClearance { week: number; irisConsent: 'GRANTED'; irisMetres: 2; irisEnergyPaid: 2; playerMetres: 4; playerEnergyPaid: 4; elapsedSeconds: 6 }
export interface SageEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  exitMetres: 0 | 2; exitSeconds: 0 | 2; playerEnergyPaid: 0 | 2;
}
export interface SageEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof SAGE_TARGET_ID;
  preparation: SagePreparation | null; approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  startSite: SageSiteState | null; currentSite: SageSiteState | null; startSource: SageCombatSource | null; clearance: SageClearance | null;
  yardId: 'SG2-ARCHIVE-YARD'; ordinaryExit: 'OPEN'; enemyPosition: 'YARD'; enemyDistanceMetres: 2;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<SagePowerId, number>;
  terminal: SageEncounterTerminal | null;
}
export type SageEncounterCommand = { type: 'PREPARE_ENCOUNTER' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface SageEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SageEncounterCommand }
export interface SageEncounterProjection {
  title: string; story: string; status: SageEncounterState['status']; inside: boolean; site: SageSiteState | null; startSite: SageSiteState | null;
  preparation: SagePreparation | null;
  enemy: null | { id: typeof SAGE_TARGET_ID; name: '梅林·阿什'; age: 47; sequence: 3; health: number; mind: number; spirituality: number;
    status: SageEncounterState['enemyStatus']; weaponId: 'SG2-MERRIN-ROD'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<SagePowerId, number> };
  actions: SageEncounterAction[]; facts: string[];
}
export const SAGE_ENCOUNTER_STORY = '档案馆后院的47岁护档人梅林·阿什提出独立通行争议。他有自己的身体、判断、原棍与有限灵性。收尾实践并反思后，你可以先整理注意力，再征得艾瑞丝此次离场同意，让她亲自走到院外。交谈后仍可和平离开；交战是额外选择，可能受伤或死亡，与此前晋升仪式无关。';
export function createSageEncounterState(): SageEncounterState {
  return { status: 'AVAILABLE', targetId: SAGE_TARGET_ID, preparation: null, approachWeek: null, approachRevision: null, attemptWeek: null, startHistoryIndex: null,
    startSite: null, currentSite: null, startSource: null, clearance: null, yardId: 'SG2-ARCHIVE-YARD', ordinaryExit: 'OPEN', enemyPosition: 'YARD', enemyDistanceMetres: 2,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, FEINT: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function validateSageEncounterCommand(v: unknown): v is SageEncounterCommand {
  return shape(v, ['type']) && ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isSageEncounterCommand = validateSageEncounterCommand;
export const hasSageEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.sage.encounter.status);
export const isInsideSageEncounter = hasSageEncounterLock;
function otherSceneOpen(s: SliceState): boolean { return s.sage.preparedWeek !== null || !sageLifeClosed(s) || !s.sage.life.reflected; }
function closedSite(p: SageSiteState): boolean {
  return validateSageSiteState(p) && p.siteId === 'SG2-ARCHIVE' && p.introducedWeek !== null && p.source !== null && p.playerLocation === 'ENTRY' && integer(p.playerEnergy, 6, 100) &&
    p.iris?.id === 'PM3-IRIS' && p.iris.age === 49 && p.iris.alive && p.iris.willing && p.iris.location === 'ENTRY' && integer(p.iris.energy, 2, 100) &&
    p.body === 'SOLID' && !p.form.active && p.record?.location === 'OWNER' && p.materials.every(x => x.status === 'RETURNED' && x.location === 'OWNER');
}
const clearance = (week: number): SageClearance => ({ week, irisConsent: 'GRANTED', irisMetres: 2, irisEnergyPaid: 2, playerMetres: 4, playerEnergyPaid: 4, elapsedSeconds: 6 });
export function sageApproachedSite(start: SageSiteState, week: number): SageSiteState {
  if (!closedSite(start) || !integer(week, 1) || start.introducedWeek! > week) throw new Error('先收尾档案馆；艾瑞丝须有2精力，你须有6精力往返。');
  const p = structuredClone(start), iris = p.iris!;
  iris.consent = 'GRANTED'; iris.location = 'OUTSIDE'; iris.travelMetres += 2; iris.energy -= 2; p.clockSeconds += 2;
  p.actorMoves.push({ actorId: iris.id, from: 'ENTRY', to: 'OUTSIDE', mode: 'WALK', metres: 2, seconds: 2 });
  p.playerLocation = 'YARD'; p.playerTravelMetres += 4; p.playerEnergy -= 4; p.clockSeconds += 4; return p;
}
export function leaveSageCombatSite(p: SageSiteState): void {
  if (p.playerLocation !== 'YARD' || p.playerEnergy < 2) throw new Error('须本人在后院并保有2精力，才能沿普通出口离开。');
  p.playerLocation = 'OUTSIDE'; p.playerTravelMetres += 2; p.playerEnergy -= 2; p.clockSeconds += 2;
}
const budget = (s: SliceState): PreparationBudget => ({ cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality });
export function validateSagePreparation(value: unknown): value is SagePreparation {
  try {
    const p = value as SagePreparation;
    if (!shape(p, ['week', 'revision', 'runId', 'randomSeed', 'randomCursor', 'mindPaid', 'lifeJournalLength', 'lifeClockSeconds', 'before', 'after']) ||
      !integer(p.week, 1) || !integer(p.revision, 1) || typeof p.runId !== 'string' || !p.runId || typeof p.randomSeed !== 'string' || !p.randomSeed || !integer(p.randomCursor) ||
      p.mindPaid !== 2 || !integer(p.lifeJournalLength, 1) || !integer(p.lifeClockSeconds)) return false;
    for (const b of [p.before, p.after]) if (!shape(b, ['cash', 'actions', 'health', 'mind', 'spirituality']) || !integer(b.cash) || !integer(b.actions, 0, 100) || !integer(b.health, 1, 100) || !integer(b.mind, 1, 100) || !integer(b.spirituality, 0, 120)) return false;
    return p.before.mind > 2 && same(p.after, { ...p.before, mind: p.before.mind - 2 });
  } catch { return false; }
}
function actualYard(s: SliceState): boolean {
  const e = s.sage.encounter, p = e.currentSite;
  if (!p || !e.startSite || !closedSite(e.startSite) || e.approachWeek === null || !e.preparation || !validateSagePreparation(e.preparation) || !validateSageSiteState(p)) return false;
  const expected = sageApproachedSite(e.startSite, e.approachWeek);
  expected.clockSeconds = p.clockSeconds; expected.playerEnergy = p.playerEnergy; expected.formEnergySpent = p.formEnergySpent; expected.assimilationExposure = p.assimilationExposure;
  return same(p, expected) && same(e.startSite, s.sage.life.site) && e.yardId === 'SG2-ARCHIVE-YARD' && e.ordinaryExit === 'OPEN' && e.enemyPosition === 'YARD' && e.enemyDistanceMetres === 2 &&
    p.playerLocation === 'YARD' && p.iris?.location === 'OUTSIDE' && p.iris.alive && p.playerEnergy >= 2 && e.approachWeek === s.week && same(e.clearance, clearance(s.week));
}
export function blockSageEncounter(s: SliceState, c: SageEncounterCommand): string | null {
  if (!validateSageEncounterCommand(c)) return '后院遭遇命令无效。'; const e = s.sage.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为贤者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.sage.guidanceKnown || s.sage.promotionWeek === null) return '须已获得指导并完成本次晋升。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德。';
  if (otherSceneOpen(s)) return '先收尾三次实践、归还本案物品并完成反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && actualYard(s) ? null : '先到后院交谈，才能沿普通出口离开。';
  if (s.mind <= 0) return '先恢复精神；交谈后仍可普通离开。';
  if (c.type === 'PREPARE_ENCOUNTER') {
    if (e.status !== 'AVAILABLE' || e.preparation) return '这次注意力整理已有记录，不能重置遭遇。';
    if (!closedSite(s.sage.life.site)) return '先安全收尾档案馆，确认本人和艾瑞丝在入口且有离场精力。';
    return s.mind <= 2 ? '整理注意力须付2精神并保持清醒。' : null;
  }
  if (s.actionsRemaining < 1) return '这次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') {
    if (e.status !== 'AVAILABLE' || !e.preparation) return '先整理注意力；已有结局的对手不会重新生成。';
    if (!closedSite(s.sage.life.site)) return '艾瑞丝须在入口有2精力，你须有6精力往返。';
    return s.actionsRemaining < 2 ? '交谈需1行动，另留1行动决定是否交战；到场后也能和平离开。' : null;
  }
  return e.status === 'READY' && actualYard(s) ? null : '先实际交谈，让艾瑞丝按此次同意亲自离开。';
}
export const sageEncounterReason = blockSageEncounter;
export function applySageEncounterCommand(s: SliceState, c: SageEncounterCommand, ctx: SeerContext): void {
  const reason = blockSageEncounter(s, c); if (reason) throw new Error(reason); const e = s.sage.encounter;
  if (c.type === 'PREPARE_ENCOUNTER') {
    const before = budget(s); s.mind -= 2;
    e.preparation = { week: s.week, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor,
      mindPaid: 2, lifeJournalLength: s.sage.life.journal.length, lifeClockSeconds: s.sage.life.site.clockSeconds, before, after: budget(s) };
    ctx.note('整理交谈前的注意力', '你付出2精神，核对本人仍握持的物品与出口；没有生成卷轴、补充灵性或恢复旧物。'); return;
  }
  if (c.type === 'LEAVE_ENCOUNTER') { leaveSageCombatSite(e.currentSite!); e.status = 'RESOLVED'; ctx.note('和平离开档案馆后院', '你步行2米，耗时2秒、支付2精力；艾瑞丝仍在院外，梅林与自己的棍仍在后院。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.startSite = structuredClone(s.sage.life.site); e.clearance = clearance(s.week); e.currentSite = sageApproachedSite(e.startSite, s.week);
    e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1;
    ctx.note('在档案馆后院交谈', '艾瑞丝明确同意此次离场，亲自步行2米、花2秒与2精力到院外。你随后步行4米、花4秒与4精力进入后院。尚未交战，可以普通离开。'); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'SAGE_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentSageCombatSource(s); if (!source) throw new Error('开战来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('选择后院交战', '梅林是独立护档人，持自己的原棍并使用自己的有限灵性。艾瑞丝已实际离开；原奥斯里克的死亡与原卢坎的投降都没有被改写。这次战斗不是晋升仪式条件。');
}
export const applySageEncounter = applySageEncounterCommand;
export const handleSageEncounter = applySageEncounterCommand;
export function startSageEncounter(s: SliceState, ctx: SeerContext): void { applySageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasSageDisputeOpponent(s: SliceState): boolean {
  const e = s.sage?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    s.sage.guidanceKnown && s.sage.promotionWeek !== null && !!e && e.status === 'FIGHTING' && e.targetId === SAGE_TARGET_ID && e.terminal === null &&
    e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' && actualYard(s) && e.approachWeek !== null && e.attemptWeek === s.week &&
    c?.encounterId === 'SAGE_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(e.enemySpirituality, 0, 120) && SAGE_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - SAGE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) && integer(c.round, 1) &&
    e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleSageEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.sage.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'SAGE_DISPUTE') throw new Error('当前没有后院战斗。'); if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知战斗结果。');
  const last = c.lastRound, o = last?.sageOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateSageRoundOutcome(o) || !validateSageCombatRound(last) || o.continuing || c.round !== last.round + 1 ||
    s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || !same(o.siteAfter, e.currentSite) || !same(o.workshopAfter, s.scrollProfessor.workshop) ||
    o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) || (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER')))
    throw new Error('现场、身体、原卷或战斗后果不符。');
  const exit = s.health > 0 ? 2 : 0; if (exit) leaveSageCombatSite(e.currentSite!);
  e.terminal = { outcome: outcome as SageEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: exit, exitSeconds: exit, playerEnergyPaid: exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('档案馆后院冲突结束', `${outcome === 'PLAYER_DEAD' ? '你已死亡，原身体与所持原物留在后院。' : '你沿普通出口走2米、花2秒与2精力回到院外。'}艾瑞丝在院外；梅林和自己的原棍留在后院，费用、原卷耗尽、同化暴露与双方伤势保留。`);
}
export const finishSageEncounter = settleSageEncounter;
export function sageEncounterActions(s: SliceState): SageEncounterAction[] {
  if (!stage(s)) return [];
  return ([['PREPARE_ENCOUNTER', '整理注意力与出口', '2精神；0行动；不补给物品'], ['ENCOUNTER_TALK', '征得同意并到后院交谈', '1行动；艾瑞丝2米/秒/精力，你4米/秒/精力'],
    ['ENCOUNTER_FIGHT', '选择与梅林交战', '1行动；可能受伤或死亡'], ['LEAVE_ENCOUNTER', '沿出口和平离开', '0行动；2米/2秒/2精力']] as const).map(([type, label, cost]) => {
    const command: SageEncounterCommand = { type }, reason = blockSageEncounter(s, command); return { id: `sage-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectSageEncounter(s: SliceState): SageEncounterProjection {
  const e = s.sage.encounter;
  if (!stage(s)) return { title: '尚未开放的档案馆后院', story: '', status: e.status, inside: false, site: null, startSite: null, preparation: null, enemy: null, actions: [], facts: [] };
  return { title: '档案馆后院的争议', story: SAGE_ENCOUNTER_STORY, status: e.status, inside: hasSageEncounterLock(s), site: structuredClone(e.currentSite ?? s.sage.life.site), startSite: structuredClone(e.startSite), preparation: structuredClone(e.preparation),
    enemy: { id: SAGE_TARGET_ID, name: '梅林·阿什', age: 47, sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'SG2-MERRIN-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    actions: sageEncounterActions(s), facts: [e.clearance ? '艾瑞丝已依此次同意亲自到院外；原记录与三份归还物资留在主人处。' : '交谈前将征求艾瑞丝此次离场同意，再由她亲自步行到院外；原记录与归还物资留在主人处。', '信息化尝试每轮一次，付6灵性、2精神、6精力并增加一次同化暴露；成功只减随后一次身体攻势，不能免伤或复活。',
      '信息筛取每轮一次，付6灵性、2精神并增加一次暴露；只读取眼前真实棍势，可能误读或被抵抗。成功仅准备下一次真实攻击的有限加成。',
      '旧法术、牢笼、迟钟回声与模糊预兆保留原成本和预算。旧卷只消耗实际持有且已授权的原件，没有赠卷或回填旧库存。',
      '双方每轮最多6次动作，各动作5秒、每轮60秒；伤势、死亡、撤离与投降都进入共同后果规则。该冲突不是晋升条件。'] };
}
function nextSource(o: SageRoundOutcome): SageCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, clockSeconds: o.clockSecondsAfter, site: structuredClone(o.siteAfter), workshop: structuredClone(o.workshopAfter),
    playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter, playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality,
    playerInjuries: structuredClone(o.playerInjuriesAfter), enemyInjuries: structuredClone(o.enemyInjuriesAfter), playerRisk: o.playerRiskAfter, enemyRisk: o.enemyRiskAfter, powerUses: { ...o.powerUses }, randomCursor: o.randomCursorAfter };
}
/** Whole deterministic history binds ordered costs, actual source objects and terminal consequences. */
export function validateSageEncounter(s: SliceState): boolean {
  try {
    const e = s.sage?.encounter, initial = createSageEncounterState();
    if (!e || !validateSageSiteState(s.sage.life.site) || !shape(e, Object.keys(initial)) || e.targetId !== SAGE_TARGET_ID || e.yardId !== 'SG2-ARCHIVE-YARD' || e.ordinaryExit !== 'OPEN' || e.enemyPosition !== 'YARD' || e.enemyDistanceMetres !== 2 ||
      !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !integer(e.enemyHealth, 0, 100) || e.enemyMind !== 100 || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !Array.isArray(e.enemyInjuries) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD') ||
      !shape(e.powerUses, SAGE_POWER_IDS) || !SAGE_POWER_IDS.every(id => integer(e.powerUses[id])) || e.enemySpirituality !== 120 - SAGE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    const allNew = s.combatHistory.flatMap((r, i) => r.sageOutcome ? [i] : []);
    if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'SAGE_DISPUTE';
    const prep = e.preparation;
    if (!stage(s) || !s.sage.guidanceKnown || s.sage.promotionWeek === null || !validateSagePreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor ||
      !integer(prep.week, s.sage.promotionWeek, s.week) || !integer(prep.revision, 1, s.revision) || prep.lifeJournalLength !== s.sage.life.journal.length || prep.lifeClockSeconds !== s.sage.life.site.clockSeconds || !sageLifeClosed(s) || !s.sage.life.reflected) return false;
    if (e.status === 'AVAILABLE') return same({ ...e, preparation: null }, initial) && closedSite(s.sage.life.site) && allNew.length === 0 && s.combat?.encounterId !== 'SAGE_DISPUTE';
    if (e.approachWeek === null || e.approachWeek < prep.week || !integer(e.approachRevision, prep.revision + 1, s.revision) || !e.startSite || !closedSite(e.startSite) || !same(e.startSite, s.sage.life.site) || !same(e.clearance, clearance(e.approachWeek)) || !e.currentSite || !validateSageSiteState(e.currentSite)) return false;
    const approached = sageApproachedSite(e.startSite, e.approachWeek);
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED', expected = structuredClone(approached); if (peaceful) leaveSageCombatSite(expected);
      return (ready || peaceful) && e.attemptWeek === null && e.startSource === null && e.terminal === null && allNew.length === 0 && same(e.currentSite, expected) &&
        same({ ...e, status: initial.status, preparation: null, approachWeek: null, approachRevision: null, startSite: null, currentSite: null, clearance: null }, initial) && s.combat?.encounterId !== 'SAGE_DISPUTE' && (!ready || s.status === 'ACTIVE' && !otherSceneOpen(s) && e.approachWeek === s.week);
    }
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek !== e.approachWeek || !e.startSource || e.startSource.round !== 1 || !same(e.startSource.site, approached) || !same(e.startSource.preparation, prep) ||
      e.startSource.runId !== s.runId || e.startSource.targetId !== e.targetId || e.startSource.randomSeed !== s.random.seed || e.startSource.attemptWeek !== e.attemptWeek || e.startSource.startHistoryIndex !== e.startHistoryIndex || e.startSource.revision <= e.approachRevision || e.startSource.revision > s.revision) return false;
    if (e.terminal && (!shape(e.terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds', 'playerEnergyPaid']) || !integer(e.terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return false;
    let liveExpected = structuredClone(approached);
    for (const [i, round] of rounds.entries()) {
      const o = round.sageOutcome, previous = rounds[i - 1]?.sageOutcome;
      if (!validateSageRoundOutcome(o) || !validateSageCombatRound(round) || round.round !== i + 1 || o.source.runId !== s.runId || o.source.targetId !== e.targetId || o.source.randomSeed !== s.random.seed ||
        o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || !same(o.source.site, liveExpected) || !same(o.source.preparation, prep) || (i < rounds.length - 1 && !o.continuing)) return false;
      if (previous ? !same(o.source, nextSource(previous)) : !same(o.source, e.startSource) || o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.source.enemySpirituality !== 120 || o.source.enemyRisk !== 0 || o.source.enemyInjuries.length !== 0 || !same(o.source.powerUses, initial.powerUses)) return false;
      liveExpected = structuredClone(o.siteAfter);
    }
    const last = rounds.at(-1), o = last?.sageOutcome;
    // Later legitimate crafting may append inventory, but a witnessed burned original
    // or its spent material can never be restored, substituted or re-authorized.
    if (o && (o.workshopAfter.scrolls.filter(v => v.status === 'USED').some(v => !same(s.scrollProfessor.workshop.scrolls.find(current => current.id === v.id), v)) ||
      o.workshopAfter.materials.filter(v => v.status === 'SPENT').some(v => !same(s.scrollProfessor.workshop.materials.find(current => current.id === v.id), v)))) return false;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk)) return false;
    if (e.status === 'FIGHTING') {
      if (e.terminal !== null || !hasSageDisputeOpponent(s) || !same(liveExpected, e.currentSite)) return false;
      if (!o) return s.combat!.lastRound === null && same(currentSageCombatSource(s), e.startSource) && same(e.powerUses, initial.powerUses) && e.enemyHealth === 100 && e.enemySpirituality === 120 && e.enemyRisk === 0 && e.enemyInjuries.length === 0;
      return o.continuing && same(last, s.combat!.lastRound) && same(currentSageCombatSource(s), nextSource(o));
    }
    const t = e.terminal;
    if (s.combat?.encounterId === 'SAGE_DISPUTE' || !t || !last || !o || o.continuing || t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    const exit = o.playerHealthAfter > 0 ? 2 : 0;
    if (t.exitMetres !== exit || t.exitSeconds !== exit || t.playerEnergyPaid !== exit) return false;
    if (exit) leaveSageCombatSite(liveExpected); if (!same(e.currentSite, liveExpected)) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
export const validateSageEncounterState = validateSageEncounter;
