import { publicPryerFields } from '../sage/life.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import type { ThreeHeadedTemplarLifeState } from '../three-headed-templar/life.js';
import type { ThreeHeadedTemplarEncounterState } from '../three-headed-templar/encounter.js';
import { elderLifeClosed, replayElderLifeRoot } from './life.js';
import { currentElderCombatSource, validateElderRoundOutcome, validateElderCombatRound, type ElderCombatSource, type ElderRoundOutcome } from './combat.js';

export const ELDER_TARGET_ID = 'EL2-BASTIAN' as const;
export const ELDER_POWER_IDS = ['SILVER_THRUST', 'SILVER_ARMOR'] as const;
export type ElderPowerId = typeof ELDER_POWER_IDS[number];
export type ElderEnemyIntent = ElderPowerId | 'BODY_STRIKE' | 'ACCIDENT';
/** An independently introduced Silver Knight uses his own learned methods and finite resources.
 * Existing warrior.s3.silver-thrust / silver-armor are the named skill sources; values are bounded adaptation. */
export const ELDER_POWERS = [
  { id: 'SILVER_THRUST', abilityId: 'warrior.s3.silver-thrust', label: '有限银白细剑', cost: 6, selfGain: 70, enemyReduction: 0 },
  { id: 'SILVER_ARMOR', abilityId: 'warrior.s3.silver-armor', label: '有限实体银甲', cost: 6, selfGain: 0, enemyReduction: 36 },
] as const;
interface PreparationBudget { cash: number; actions: number; health: number; mind: number; spirituality: number }
export interface ElderPreparation {
  week: number; revision: number; runId: string; randomSeed: string; randomCursor: number;
  mindPaid: 2; lifeJournalLength: number; lifeClockSeconds: number; before: PreparationBudget; after: PreparationBudget;
}
export interface ElderClearance { week: number; maraId: 'THT3-MARA'; maraConsent: 'GRANTED'; maraFrom: 'START'; maraTo: 'OUTSIDE'; maraMetres: 2; playerMetres: 4; elapsedSeconds: 6 }
export interface ElderEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; exitMetres: 0 | 4; exitSeconds: 0 | 4;
}
export interface ElderEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof ELDER_TARGET_ID;
  preparation: ElderPreparation | null; approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  startRoot: ThreeHeadedTemplarLifeState | null; startSource: ElderCombatSource | null; originalEncounter: ThreeHeadedTemplarEncounterState | null; clearance: ElderClearance | null;
  yardId: 'THT3-SEALED-COURT'; skyLight: 'DAYLIGHT'; ordinaryExit: 'OPEN'; enemyPosition: 'A'; enemyDistanceMetres: 2;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'COURT'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<ElderPowerId, number>; terminal: ElderEncounterTerminal | null;
}
export type ElderEncounterCommand = { type: 'PREPARE_ENCOUNTER' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface ElderEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ElderEncounterCommand }
export interface ElderEncounterProjection {
  title: string; story: string; status: ElderEncounterState['status']; inside: boolean; preparation: ElderPublicPreparation | null;
  scene: null | { courtId: 'THT3-SEALED-COURT'; playerLocation: string; maraLocation: string; ordinaryExit: 'OPEN'; distanceMetres: 2; clockSeconds: number; playerTravelMetres: number };
  enemy: null | { id: typeof ELDER_TARGET_ID; name: '巴斯蒂安·沃德'; age: 46; pathway: 'warrior'; sequence: 3; health: number; mind: number; spirituality: number;
    status: ElderEncounterState['enemyStatus']; weaponId: 'EL2-BASTIAN-SWORD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<ElderPowerId, number>; abilities: string[] };
  actions: ElderEncounterAction[]; facts: string[];
}
export const ELDER_ENCOUNTER_STORY = '46岁的银骑士巴斯蒂安·沃德在白昼来到原院，提出独立的保管通行争议。他有自己的身体、判断、钢剑和有限灵性，实际掌握银甲与银白细剑。完成三次实践并反思后，你可先整理注意力，再征得同一玛拉此次离场同意；她会亲自走到院外。到场交谈后仍可和平离开，交战是可能受伤或死亡的额外选择，不是晋升条件。';
export function createElderEncounterState(): ElderEncounterState {
  return { status: 'AVAILABLE', targetId: ELDER_TARGET_ID, preparation: null, approachWeek: null, approachRevision: null, attemptWeek: null, startHistoryIndex: null,
    startRoot: null, startSource: null, originalEncounter: null, clearance: null, yardId: 'THT3-SEALED-COURT', skyLight: 'DAYLIGHT', ordinaryExit: 'OPEN', enemyPosition: 'A', enemyDistanceMetres: 2,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { SILVER_THRUST: 0, SILVER_ARMOR: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function validateElderEncounterCommand(v: unknown): v is ElderEncounterCommand {
  return shape(v, ['type']) && ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isElderEncounterCommand = validateElderEncounterCommand;
export const hasElderEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.elder.encounter.status);
export const isInsideElderEncounter = hasElderEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  const root = s.elder.encounter.startRoot ?? s.threeHeadedTemplar.life;
  const shadow = { ...s, threeHeadedTemplar: { ...s.threeHeadedTemplar, life: root } };
  return s.elder.preparedWeek !== null || !elderLifeClosed(shadow) || !s.elder.life.reflected;
}
function closedRoot(p: ThreeHeadedTemplarLifeState): boolean {
  return p.siteId === 'THT3-SEALED-COURT' && p.introducedWeek !== null && p.playerLocation === 'START' && p.owner.id === 'THT3-MARA' && p.owner.age === 51 && p.owner.alive && p.owner.willing && p.owner.location === 'START' &&
    p.card.location === 'TABLE' && p.shutter.state === 'CLOSED' && !p.lamp.on && p.activeCase === null && Object.values(p.spirits).every(sp => ['INTERNAL', 'RELEASED', 'DISSIPATED', 'SEALED'].includes(sp.location));
}
const clearance = (week: number): ElderClearance => ({ week, maraId: 'THT3-MARA', maraConsent: 'GRANTED', maraFrom: 'START', maraTo: 'OUTSIDE', maraMetres: 2, playerMetres: 4, elapsedSeconds: 6 });
export function elderApproachedRoot(start: ThreeHeadedTemplarLifeState, week: number): ThreeHeadedTemplarLifeState {
  if (!closedRoot(start) || !integer(week, 1) || start.introducedWeek! > week) throw new Error('须先收口原院并征得同一玛拉此次离场同意。');
  const p = structuredClone(start); p.owner.location = 'OUTSIDE'; p.clockSeconds += 2;
  p.playerLocation = 'A'; p.playerTravelMetres += 4; p.clockSeconds += 4; return p;
}
export function leaveElderCombatRoot(p: ThreeHeadedTemplarLifeState): void {
  if (p.playerLocation !== 'A' || p.owner.location !== 'OUTSIDE') throw new Error('须本人在原院且玛拉已离场，才能沿普通出口离开。');
  p.playerLocation = 'START'; p.playerTravelMetres += 4; p.clockSeconds += 4;
}
const budget = (s: SliceState): PreparationBudget => ({ cash: s.cash, actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality });
export function validateElderPreparation(value: unknown): value is ElderPreparation {
  try { const p = value as ElderPreparation;
    if (!shape(p, ['week', 'revision', 'runId', 'randomSeed', 'randomCursor', 'mindPaid', 'lifeJournalLength', 'lifeClockSeconds', 'before', 'after']) ||
      !integer(p.week, 1) || !integer(p.revision, 1) || typeof p.runId !== 'string' || !p.runId || typeof p.randomSeed !== 'string' || !p.randomSeed || !integer(p.randomCursor) ||
      p.mindPaid !== 2 || !integer(p.lifeJournalLength, 1) || !integer(p.lifeClockSeconds)) return false;
    for (const b of [p.before, p.after]) if (!shape(b, ['cash', 'actions', 'health', 'mind', 'spirituality']) || !integer(b.cash) || !integer(b.actions, 0, 100) || !integer(b.health, 1, 100) || !integer(b.mind, 1, 100) || !integer(b.spirituality, 0, 120)) return false;
    return p.before.mind > 2 && same(p.after, { ...p.before, mind: p.before.mind - 2 });
  } catch { return false; }
}
function actualCourt(s: SliceState): boolean {
  const e = s.elder.encounter, p = s.threeHeadedTemplar.life;
  return !!e.startRoot && closedRoot(e.startRoot) && !!e.preparation && e.approachWeek === s.week && same(e.clearance, clearance(s.week)) && p.siteId === 'THT3-SEALED-COURT' && p.playerLocation === 'A' &&
    p.owner.id === 'THT3-MARA' && p.owner.age === 51 && p.owner.alive && p.owner.willing && p.owner.location === 'OUTSIDE' && p.card.location === 'TABLE' && p.shutter.state === 'CLOSED' && !p.lamp.on &&
    Object.values(p.spirits).every(sp => ['INTERNAL', 'RELEASED', 'DISSIPATED', 'SEALED'].includes(sp.location)) && same(e.originalEncounter, s.threeHeadedTemplar.encounter);
}
export function blockElderEncounter(s: SliceState, c: ElderEncounterCommand): string | null {
  if (!validateElderEncounterCommand(c)) return '遭遇命令无效。'; const e = s.elder.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并完成本次晋升。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.elder.guidanceKnown || s.elder.promotionWeek === null) return '须已经获得指导并完成本次晋升。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德。';
  if (otherSceneOpen(s)) return '先收尾三次实践、原物和原灵并完成反思。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && actualCourt(s) ? null : '先实际到场交谈，才能沿普通出口离开。';
  if (s.mind <= 0) return '先恢复精神；交谈后仍可普通离开。';
  if (c.type === 'PREPARE_ENCOUNTER') {
    if (e.status !== 'AVAILABLE' || e.preparation) return '这次准备已有记录，不能重置原对手。';
    const end = replayElderLifeRoot(s); if (!end || !same(end, s.threeHeadedTemplar.life) || !closedRoot(end)) return '先收口原院，确认本人、玛拉和同一原物的实际位置。';
    return s.mind <= 2 ? '整理注意力须付2精神并保持清醒。' : null;
  }
  if (s.actionsRemaining < 1) return '这次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') {
    if (e.status !== 'AVAILABLE' || !e.preparation) return '先整理注意力；已有结局的对手不会重新生成。';
    if (!closedRoot(s.threeHeadedTemplar.life)) return '须先让本人和同一玛拉回到入口，收回原物与原灵。';
    return s.actionsRemaining < 2 ? '交谈需要1行动，另留1行动决定是否交战；到场后也可和平离开。' : null;
  }
  return e.status === 'READY' && actualCourt(s) ? null : '先实际交谈，并让玛拉按此次同意亲自离场。';
}
export const elderEncounterReason = blockElderEncounter;
export function applyElderEncounterCommand(s: SliceState, c: ElderEncounterCommand, ctx: SeerContext): void {
  const reason = blockElderEncounter(s, c); if (reason) throw new Error(reason); const e = s.elder.encounter;
  if (c.type === 'PREPARE_ENCOUNTER') {
    const before = budget(s); s.mind -= 2;
    e.preparation = { week: s.week, revision: s.revision + 1, runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, mindPaid: 2,
      lifeJournalLength: s.elder.life.journal.length, lifeClockSeconds: s.threeHeadedTemplar.life.clockSeconds, before, after: budget(s) };
    e.originalEncounter = structuredClone(s.threeHeadedTemplar.encounter);
    ctx.note('整理注意力并核对出口', '你实际付2精神，核对同一原物与普通出口；没有补充灵性、储备或原灵完整度。'); return;
  }
  if (c.type === 'LEAVE_ENCOUNTER') { leaveElderCombatRoot(s.threeHeadedTemplar.life); e.status = 'RESOLVED'; ctx.note('和平离开原院', '本人沿原路走4米、花4秒回到入口；同一玛拉仍在院外，巴斯蒂安与自己的钢剑留在院内。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.startRoot = structuredClone(s.threeHeadedTemplar.life); e.clearance = clearance(s.week); s.threeHeadedTemplar.life = elderApproachedRoot(e.startRoot, s.week);
    e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1;
    ctx.note('让玛拉离场后交谈', '同一51岁玛拉明确同意这次离场，亲自走2米、花2秒到院外。你再步行4米、花4秒到原院A点，与巴斯蒂安相距2米。尚未交战，可以普通离开。'); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'ELDER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  const source = currentElderCombatSource(s); if (!source) throw new Error('开战来源不完整。'); e.startSource = { ...source, revision: s.revision + 1 };
  ctx.note('选择独立的院内交战', '巴斯蒂安使用自己的原钢剑、实际银骑士方法和有限灵性。玛拉已实际在院外，保护只作用本人。原布拉姆仍保有此前撤离后的身体、灵性与伤势；本次交战不属于晋升条件。');
}
export const applyElderEncounter = applyElderEncounterCommand;
export const handleElderEncounter = applyElderEncounterCommand;
export function startElderEncounter(s: SliceState, ctx: SeerContext): void { applyElderEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasElderDisputeOpponent(s: SliceState): boolean {
  const e = s.elder?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    s.elder.guidanceKnown && s.elder.promotionWeek !== null && !!e && e.status === 'FIGHTING' && e.targetId === ELDER_TARGET_ID && e.terminal === null &&
    e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' && actualCourt(s) && e.attemptWeek === s.week &&
    c?.encounterId === 'ELDER_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && integer(e.enemySpirituality, 0, 120) && ELDER_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - ELDER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleElderEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.elder.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'ELDER_DISPUTE') throw new Error('当前没有这场原院战斗。'); if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知战斗结果。');
  const last = c.lastRound, o = last?.elderOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateElderRoundOutcome(o) || !validateElderCombatRound(last) || o.continuing || c.round !== last.round + 1 ||
    s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || !same(o.rootAfter, s.threeHeadedTemplar.life) || !same(o.reserveAfter, s.roseBishop.reserve) ||
    o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) || (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER')))
    throw new Error('原院、身体、原灵或战斗后果不符。');
  const exit = s.health > 0 ? 4 : 0; if (exit) leaveElderCombatRoot(s.threeHeadedTemplar.life);
  e.terminal = { outcome: outcome as ElderEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, exitMetres: exit, exitSeconds: exit };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原院冲突结束', `${outcome === 'PLAYER_DEAD' ? '本人身体实际死亡，原身体与所持物留在A点。' : '本人沿原路走4米、花4秒回到入口。'}玛拉仍在院外；巴斯蒂安与自己的钢剑留在院内，所有费用、灵性、原灵完整度和双方伤势保留。`);
}
export const finishElderEncounter = settleElderEncounter;
export function elderEncounterActions(s: SliceState): ElderEncounterAction[] {
  if (!stage(s)) return [];
  return ([['PREPARE_ENCOUNTER', '整理注意力与出口', '2精神；0行动'], ['ENCOUNTER_TALK', '让玛拉离场后交谈', '1行动；玛拉2米/2秒，本人4米/4秒'],
    ['ENCOUNTER_FIGHT', '选择与巴斯蒂安交战', '1行动；可能受伤或死亡'], ['LEAVE_ENCOUNTER', '沿原路和平离开', '0行动；4米/4秒']] as const).map(([type, label, cost]) => {
    const command: ElderEncounterCommand = { type }, reason = blockElderEncounter(s, command); return { id: `elder-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectElderEncounter(s: SliceState): ElderEncounterProjection {
  const e = s.elder.encounter, root = s.threeHeadedTemplar.life;
  if (!stage(s)) return { title: '尚未开放的原院争议', story: '', status: e.status, inside: false, scene: null, preparation: null, enemy: null, actions: [], facts: [] };
  return { title: '原院中的独立争议', story: ELDER_ENCOUNTER_STORY, status: e.status, inside: hasElderEncounterLock(s), preparation: e.preparation ? projectElderPreparation(e.preparation) : null,
    scene: { courtId: 'THT3-SEALED-COURT', playerLocation: root.playerLocation, maraLocation: root.owner.location, ordinaryExit: 'OPEN', distanceMetres: 2, clockSeconds: root.clockSeconds, playerTravelMetres: root.playerTravelMetres },
    enemy: { id: ELDER_TARGET_ID, name: '巴斯蒂安·沃德', age: 46, pathway: 'warrior', sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      weaponId: 'EL2-BASTIAN-SWORD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, abilities: ELDER_POWERS.map(p => p.abilityId) },
    actions: elderEncounterActions(s), facts: [e.clearance ? '同一玛拉已按本次同意亲自步行到院外；保护只作用本人。' : '交谈时将先征得玛拉此次离场同意，由她亲自步行到院外。',
      '低语每轮最多尝试一次，实际付6灵性与2精神，可被抵抗；成功只准备随后一次有限减势，不凭名字杀死或控制对方。',
      '聚声每轮最多尝试一次，只用一个已放牧原灵实际已选方法；本人6灵性、成功2精神／失败4精神，原灵3灵性，不能补满或恢复完整度。未取得、释放、消散或耗尽者不能施术。',
      '所有物与原灵仍保留在原库存；最多7个放牧原灵、2个外放与同时1个借用效果。旧伊芮斯选择保留，聚声不复制永久能力。',
      '巴斯蒂安使用自己的实际银甲和银白细剑，最多120灵性且不恢复；原布拉姆的旧身体、原棍与撤离后的结局不变。双方每轮至多6动作；真实伤势、死亡和投降仍按共同身体后果规则。'] };
}
function nextSource(o: ElderRoundOutcome): ElderCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, clockSeconds: o.clockSecondsAfter, root: structuredClone(o.rootAfter), reserve: structuredClone(o.reserveAfter),
    playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter, playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality,
    playerInjuries: structuredClone(o.playerInjuriesAfter), enemyInjuries: structuredClone(o.enemyInjuriesAfter), playerRisk: o.playerRiskAfter, enemyRisk: o.enemyRiskAfter, powerUses: { ...o.powerUses }, randomCursor: o.randomCursorAfter };
}
/** Derive the sole live original court from the exact life-end root and ordered combat replay.
 * This helper never calls the old S3 validator, avoiding recursive or permissive continuation. */
export function replayElderEncounterRoot(s: SliceState, lifeEnd: ThreeHeadedTemplarLifeState): ThreeHeadedTemplarLifeState | null {
  try {
    const e = s.elder?.encounter, initial = createElderEncounterState();
    if (!e || !shape(e, Object.keys(initial)) || e.targetId !== ELDER_TARGET_ID || e.yardId !== 'THT3-SEALED-COURT' || e.skyLight !== 'DAYLIGHT' || e.ordinaryExit !== 'OPEN' || e.enemyPosition !== 'A' || e.enemyDistanceMetres !== 2 ||
      !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !integer(e.enemyHealth, 0, 100) || e.enemyMind !== 100 || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !Array.isArray(e.enemyInjuries) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'COURT') ||
      !shape(e.powerUses, ELDER_POWER_IDS) || !ELDER_POWER_IDS.every(id => integer(e.powerUses[id])) || e.enemySpirituality !== 120 - ELDER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return null;
    const allNew = s.combatHistory.flatMap((r, i) => r.elderOutcome ? [i] : []);
    if (!e.preparation) return same(e, initial) && allNew.length === 0 && s.combat?.encounterId !== 'ELDER_DISPUTE' ? structuredClone(lifeEnd) : null;
    const prep = e.preparation;
    if (!stage(s) || !s.elder.guidanceKnown || s.elder.promotionWeek === null || !validateElderPreparation(prep) || prep.runId !== s.runId || prep.randomSeed !== s.random.seed || prep.randomCursor > s.random.cursor ||
      !integer(prep.week, s.elder.promotionWeek, s.week) || !integer(prep.revision, 1, s.revision) || prep.lifeJournalLength !== s.elder.life.journal.length || prep.lifeClockSeconds !== lifeEnd.clockSeconds || otherSceneOpen(s) || !same(e.originalEncounter, s.threeHeadedTemplar.encounter)) return null;
    if (e.status === 'AVAILABLE') return same({ ...e, preparation: null, originalEncounter: null }, initial) && closedRoot(lifeEnd) && allNew.length === 0 && s.combat?.encounterId !== 'ELDER_DISPUTE' ? structuredClone(lifeEnd) : null;
    if (e.approachWeek === null || e.approachWeek < prep.week || !integer(e.approachRevision, prep.revision + 1, s.revision) || !e.startRoot || !closedRoot(e.startRoot) || !same(e.startRoot, lifeEnd) || !same(e.clearance, clearance(e.approachWeek))) return null;
    const approached = elderApproachedRoot(e.startRoot, e.approachWeek);
    const adjacentApproach = e.approachRevision === prep.revision + 1 && e.approachWeek === prep.week;
    if (e.status === 'READY' && s.revision === e.approachRevision && adjacentApproach &&
      (!same(budget(s), { ...prep.after, actions: prep.after.actions - 1 }) || s.random.cursor !== prep.randomCursor)) return null;
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED', expected = structuredClone(approached); if (peaceful) leaveElderCombatRoot(expected);
      return (ready || peaceful) && e.attemptWeek === null && e.startSource === null && e.terminal === null && allNew.length === 0 &&
        same({ ...e, status: initial.status, preparation: null, originalEncounter: null, approachWeek: null, approachRevision: null, startRoot: null, clearance: null }, initial) && s.combat?.encounterId !== 'ELDER_DISPUTE' && (!ready || s.status === 'ACTIVE' && !otherSceneOpen(s) && e.approachWeek === s.week) ? expected : null;
    }
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek !== e.approachWeek || !e.startSource || e.startSource.round !== 1 || !same(e.startSource.root, approached) || !same(e.startSource.preparation, prep) ||
      e.startSource.runId !== s.runId || e.startSource.targetId !== e.targetId || e.startSource.randomSeed !== s.random.seed || e.startSource.attemptWeek !== e.attemptWeek || e.startSource.startHistoryIndex !== e.startHistoryIndex || e.startSource.revision <= e.approachRevision || e.startSource.revision > s.revision || e.startSource.randomCursor < prep.randomCursor) return null;
    if (e.startSource.revision !== e.approachRevision + 1) return null;
    if (adjacentApproach && (e.startSource.playerHealth !== prep.after.health || e.startSource.playerMind !== prep.after.mind || e.startSource.playerSpirituality !== prep.after.spirituality || e.startSource.randomCursor !== prep.randomCursor)) return null;
    if (e.status === 'FIGHTING' && s.revision === e.startSource.revision && adjacentApproach &&
      (!same(budget(s), { ...prep.after, actions: prep.after.actions - 2 }) || s.random.cursor !== prep.randomCursor)) return null;
    if (e.terminal && (!shape(e.terminal, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'exitMetres', 'exitSeconds']) || !integer(e.terminal.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1))) return null;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (!same(allNew, rounds.map((_r, i) => e.startHistoryIndex! + i))) return null;
    let expected = structuredClone(approached);
    for (const [i, round] of rounds.entries()) {
      const o = round.elderOutcome, previous = rounds[i - 1]?.elderOutcome;
      if (!validateElderRoundOutcome(o) || !validateElderCombatRound(round) || round.round !== i + 1 || o.source.runId !== s.runId || o.source.targetId !== e.targetId || o.source.randomSeed !== s.random.seed ||
        o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || !same(o.source.root, expected) || !same(o.source.preparation, prep) || (i < rounds.length - 1 && !o.continuing)) return null;
      if (previous ? !same(o.source, nextSource(previous)) : !same(o.source, e.startSource) || o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.source.enemySpirituality !== 120 || o.source.enemyRisk !== 0 || o.source.enemyInjuries.length !== 0 || !same(o.source.powerUses, initial.powerUses)) return null;
      expected = structuredClone(o.rootAfter);
    }
    const last = rounds.at(-1), o = last?.elderOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk)) return null;
    if (e.status === 'FIGHTING') {
      if (e.terminal !== null || !hasElderDisputeOpponent(s)) return null;
      if (!o) return s.combat!.lastRound === null && same(currentElderCombatSource(s), e.startSource) && same(e.powerUses, initial.powerUses) && e.enemyHealth === 100 && e.enemySpirituality === 120 && e.enemyRisk === 0 && e.enemyInjuries.length === 0 ? expected : null;
      return o.continuing && same(last, s.combat!.lastRound) && same(currentElderCombatSource(s), nextSource(o)) ? expected : null;
    }
    const t = e.terminal;
    if (s.combat?.encounterId === 'ELDER_DISPUTE' || !t || !last || !o || o.continuing || t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return null;
    const exit = o.playerHealthAfter > 0 ? 4 : 0;
    if (t.exitMetres !== exit || t.exitSeconds !== exit) return null; if (exit) leaveElderCombatRoot(expected);
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0 ? expected : null;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' ? expected : null;
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED') ? expected : null;
  } catch { return null; }
}
export function validateElderEncounter(s: SliceState): boolean {
  try {
    const end = replayElderLifeRoot(s);
    if (!end) return same(s.elder.encounter, createElderEncounterState()) && s.elder.life.source === null && !s.combatHistory.some(r => r.elderOutcome) && s.combat?.encounterId !== 'ELDER_DISPUTE';
    const expected = replayElderEncounterRoot(s, end); return expected !== null && same(expected, s.threeHeadedTemplar.life);
  } catch { return false; }
}
export const validateElderEncounterState = validateElderEncounter;


export function projectElderPreparation(p: ElderPreparation) { return {
  ...publicPryerFields(p, ['week', 'revision', 'mindPaid', 'lifeClockSeconds']),
  before: publicPryerFields(p.before, ['cash', 'actions', 'health', 'mind', 'spirituality']),
  after: publicPryerFields(p.after, ['cash', 'actions', 'health', 'mind', 'spirituality']),
}; }
export type ElderPublicPreparation = ReturnType<typeof projectElderPreparation>;
