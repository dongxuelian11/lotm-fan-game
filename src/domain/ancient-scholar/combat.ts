import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { MAGICIAN_COUNT_WHEEL, magicianActionCount } from '../magician/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasAncientScholarPastSample, hasAncientScholarTagSource, hasAncientScholarFragment, isAncientScholarStage,
  type AncientScholarPastSample, type AncientScholarHistoryFragment, type AncientScholarLifeState } from './life.js';
import { ANCIENT_SCHOLAR_TARGET_ID, ANCIENT_SCHOLAR_POWERS, ANCIENT_SCHOLAR_POWER_IDS, hasAncientScholarDisputeOpponent,
  type AncientScholarEnemyIntent, type AncientScholarPowerId, type AncientScholarCombatSupplies } from './encounter.js';

/** Finite G. This initial S3 slice retains the existing Diviner S4 1250/floor125,
 * max120/regen12 profile. It does not claim the novel gives identical S3 power. */
export const ANCIENT_SCHOLAR_COUNT_WHEEL = MAGICIAN_COUNT_WHEEL;
export const ANCIENT_SCHOLAR_ENEMY_COUNT_WHEEL = MAGICIAN_COUNT_WHEEL;
export const ancientScholarActionCount = magicianActionCount;
export const ancientScholarEnemyActionCount = magicianActionCount;
export const ANCIENT_SCHOLAR_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光：5灵性，贡献75G', weight: 35 },
  { id: 'WARD', label: '原有限护术：4灵性，减势45G', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍：20×身体G', weight: 25 },
  { id: 'COMPOSE', label: '普通整理持棍姿势：0贡献', weight: 10 },
  { id: 'ACCIDENT', label: '动作偏差：−22.5G', weight: 5 },
];
export type AncientScholarMoveId = 'STRIKE' | 'ACCIDENT' | 'diviner.s8.body-control' | 'diviner.s8.balance' | 'diviner.s8.paper-dagger'
  | 'diviner.s7.air-bullet' | 'diviner.s7.paper-weapon' | 'diviner.s7.flame-control' | 'diviner.s7.flame-jump' | 'diviner.s7.illusion' | 'diviner.s7.damage-transfer'
  | 'diviner.s5.spirit-threads' | 'diviner.s4.worm-assignment' | 'diviner.s4.puppet-swap'
  | 'diviner.s3.borrow-past' | 'diviner.s3.historical-projection' | 'diviner.s3.history-shelter';
const B = 'diviner.s3.borrow-past', P = 'diviner.s3.historical-projection', H = 'diviner.s3.history-shelter';
const ABILITIES: readonly { id: AncientScholarMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'STRIKE', label: '本人普通打击（12/本时代原棍16×身体G）', weight: 15, stance: 'ATTACK' },
  { id: 'diviner.s8.body-control', label: '继承体术（30×身体G）', weight: 8, stance: 'ATTACK' },
  { id: 'diviner.s7.air-bullet', label: '继承空气弹（2灵性，60G）', weight: 12, stance: 'ATTACK' },
  { id: 'diviner.s8.paper-dagger', label: '继承纸飞刀（仅新原纸1/灵性1）', weight: 4, stance: 'ATTACK' },
  { id: 'diviner.s7.paper-weapon', label: '继承纸武器（仅新原纸1/灵性1）', weight: 3, stance: 'ATTACK' },
  { id: 'diviner.s7.flame-control', label: '继承火焰操纵（仅本时代真实原灯，2灵性）', weight: 3, stance: 'ATTACK' },
  { id: 'diviner.s8.balance', label: '继承平衡闪避（28G）', weight: 8, stance: 'DEFEND' },
  { id: 'diviner.s7.flame-jump', label: '继承原灯局部火跳（3灵性，31.2G）', weight: 9, stance: 'DEFEND' },
  { id: 'diviner.s7.illusion', label: '继承有限幻术（2灵性，减势16G）', weight: 8, stance: 'DEFEND' },
  { id: 'diviner.s5.spirit-threads', label: '继承同阶强敌灵体线有限迟缓（2灵性）', weight: 20, stance: 'CONTROL' },
  { id: 'diviner.s4.worm-assignment', label: '继承赋能：须真实已部署原秘偶/虫，无来源普通观察', weight: 5, stance: 'PREPARE' },
  { id: 'diviner.s4.puppet-swap', label: '继承換位：须同一真实原秘偶，无来源普通观察', weight: 5, stance: 'PREPARE' },
  { id: B, label: '借过去自己：真实样本/当下1维持/一次临时2空气弹，知识14G', weight: 10, stance: 'ATTACK' },
  { id: P, label: '普通原签历史影像：4灵性/知识14/容量1/至多30秒G', weight: 8, stance: 'CONTROL' },
  { id: H, label: '本人有限藏身再出：4灵性/知识14/10秒/回同原垫G', weight: 12, stance: 'DEFEND' },
  { id: 'ACCIDENT', label: '专注失衡（−22.5G）', weight: 2, stance: null },
];
export const isAncientScholar = isAncientScholarStage;
function entries(s: SliceState) { return s.injuries.some(i => i.severity === 'HEAVY' && !s.magician.damageTransfers.includes(i.id))
  ? ABILITIES.map(a => a.id === 'diviner.s8.balance' ? { ...a, id: 'diviner.s7.damage-transfer' as const, label: '继承同一原重伤一次体内转移（3灵性）' } : a) : ABILITIES; }
export function ancientScholarAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const a = entries(s), weights = a.map(x => x.weight * (stance !== null && x.stance === stance ? 5 : 4)), total = weights.reduce((n, v) => n + v, 0);
  return a.map((x, i) => ({ id: x.id, label: x.label, weight: weights[i]! / total * 100 }));
}
export function drawAncientScholarAbility(random: ActionRandomStream, s: SliceState, stance: SliceStance | null): AncientScholarMoveId {
  const a = entries(s), weights = a.map(x => x.weight * (stance !== null && x.stance === stance ? 5 : 4)); let n = random.nextInt(1, weights.reduce((sum, v) => sum + v, 0));
  for (const [i, x] of a.entries()) { n -= weights[i]!; if (n <= 0) return x.id; } throw new Error('古代学者能力盘权重无效。');
}
export function drawAncientScholarEnemyAbility(random: ActionRandomStream): AncientScholarEnemyIntent {
  let n = random.nextInt(1, 100); for (const x of ANCIENT_SCHOLAR_ENEMY_ABILITY_WHEEL) { n -= x.weight; if (n <= 0) return x.id as AncientScholarEnemyIntent; } throw new Error('原鲁克能力盘无效。');
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const masteryFactor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
export interface AncientScholarCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'ANCIENT_SCHOLAR_DISPUTE'; targetId: typeof ANCIENT_SCHOLAR_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number;
  enemyInjuries: SliceInjury[]; playerInjuries: SliceInjury[]; damageTransfers: string[]; knowledge: number;
  actualOriginalBody: true; targetAlive: true; independentMind: true; targetSequence: 4; targetAge: 41;
  targetPhysique: 20; enemyWeapon: 'AS3-ROOK-CLUB'; distanceMetres: 2; noBystanders: true; ordinaryExit: true; pursuit: false;
  space: 'AS3-RECEPTION-COURTYARD'; presentReturnPoint: 'AS3-RECEPTION-MAT';
  sample: AncientScholarPastSample | null; tagSource: AncientScholarLifeState['tagFamiliarity']; fragment: AncientScholarHistoryFragment | null;
  supplies: AncientScholarCombatSupplies; spiritThreadMastery: number; powerUses: Record<AncientScholarPowerId, number>;
}
export function currentAncientScholarCombatSource(s: SliceState): AncientScholarCombatSource | null {
  if (!hasAncientScholarDisputeOpponent(s)) return null;
  const e = s.ancientScholar.encounter, c = s.combat!, l = s.ancientScholar.life;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'ANCIENT_SCHOLAR_DISPUTE', targetId: ANCIENT_SCHOLAR_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    enemyInjuries: structuredClone(c.enemyInjuries), playerInjuries: structuredClone(s.injuries), damageTransfers: [...s.magician.damageTransfers], knowledge: s.character.coreStats.knowledge,
    actualOriginalBody: true, targetAlive: true, independentMind: true, targetSequence: 4, targetAge: 41, targetPhysique: 20, enemyWeapon: 'AS3-ROOK-CLUB',
    distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false, space: 'AS3-RECEPTION-COURTYARD', presentReturnPoint: 'AS3-RECEPTION-MAT',
    sample: hasAncientScholarPastSample(s) ? structuredClone(l.sample) : null, tagSource: hasAncientScholarTagSource(s) ? structuredClone(l.tagFamiliarity) : null,
    fragment: hasAncientScholarFragment(s) ? structuredClone(l.fragment) : null, supplies: structuredClone(e.supplies), spiritThreadMastery: bounded(s.progression.mastery['diviner.s5.spirit-threads'] ?? 0, 500), powerUses: { ...e.powerUses } };
}
export interface AncientScholarCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
interface ActionEvidence extends AncientScholarCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[]; checkChance: number | null; checkRoll: number | null; succeeded: boolean }
export interface AncientScholarPlayerAction extends ActionEvidence {
  id: AncientScholarMoveId; paperSpent: number; borrowedReserve: number; reserveSpent: number; discardedReserve: number;
  sourceId: string | null; imageId: string | null; activeSeconds: 0 | 6 | 10 | 30; returnedToPresent: true; transferredInjuryId: string | null;
}
export interface AncientScholarEnemyAction extends ActionEvidence { planned: AncientScholarEnemyIntent; actual: AncientScholarEnemyIntent }
interface RoundModel {
  playerSpirituality: number; enemySpirituality: number; powerUses: Record<AncientScholarPowerId, number>; supplies: AncientScholarCombatSupplies;
  playerInjuries: SliceInjury[]; damageTransfers: string[]; borrowUsed: boolean; projectionUsed: boolean; shelterUsed: boolean;
}
export interface AncientScholarRoundContext {
  source: AncientScholarCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; model: RoundModel;
  playerActions: AncientScholarPlayerAction[]; enemyActions: AncientScholarEnemyAction[]; label: string;
}
const none = (label: string): AncientScholarCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
function liveState(s: SliceState) { return stableStringify({ spirit: s.spirituality, enemySpirit: s.ancientScholar.encounter.enemySpirituality, powerUses: s.ancientScholar.encounter.powerUses,
  supplies: s.ancientScholar.encounter.supplies, injuries: s.injuries, damageTransfers: s.magician.damageTransfers }); }
const dynamic = new Set(['supplies', 'powerUses', 'playerInjuries', 'damageTransfers']);
function validRound(s: SliceState, r: AncientScholarRoundContext, supplied: AncientScholarCombatSource | null): boolean {
  const actual = currentAncientScholarCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && stableStringify(supplied) === stableStringify(r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamic.has(k) || stableStringify(actual[k as keyof AncientScholarCombatSource]) === stableStringify(v)) && r.liveState === liveState(s);
}
function initialModel(source: AncientScholarCombatSource, player: number, enemy: number): RoundModel {
  return { playerSpirituality: player, enemySpirituality: enemy, powerUses: { ...source.powerUses }, supplies: structuredClone(source.supplies),
    playerInjuries: structuredClone(source.playerInjuries), damageTransfers: [...source.damageTransfers], borrowUsed: false, projectionUsed: false, shelterUsed: false };
}
function commit(s: SliceState, r: AncientScholarRoundContext) {
  const m = r.model, e = s.ancientScholar.encounter;
  s.spirituality = m.playerSpirituality; e.enemySpirituality = m.enemySpirituality; e.powerUses = { ...m.powerUses }; e.supplies = structuredClone(m.supplies);
  s.injuries = structuredClone(m.playerInjuries); s.magician.damageTransfers = [...m.damageTransfers]; r.liveState = liveState(s);
}
export function beginAncientScholarCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): AncientScholarRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const source = currentAncientScholarCombatSource(s); if (!source) throw new Error('缺少同一后世鲁克、本人、原现场与连续回合来源。');
  return { source, stance, finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality, enemySpiritualityBefore: s.ancientScholar.encounter.enemySpirituality,
    model: initialModel(source, s.spirituality, s.ancientScholar.encounter.enemySpirituality), playerActions: [], enemyActions: [],
    label: `原鲁克·文恩在新时代原净空外院2米外，真实灵性${s.ancientScholar.encounter.enemySpirituality}/120；本回合60秒G，借力一次动作6秒、普通唯一影像最多30秒、藏身10秒后均结束并返回同一原垫。` };
}
export const createAncientScholarCombatRound = beginAncientScholarCombatRound;
function evidence(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, physicalFactor: physical, rolls: [], checkChance: null, checkRoll: null, succeeded: false }; }
function check(source: AncientScholarCombatSource, a: ActionEvidence, random: ActionRandomStream) { a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: source.knowledge, difficulty: 14, modifiers: [] }); a.checkRoll = random.nextInt(1, 100); a.rolls.push(a.checkRoll); a.succeeded = a.checkRoll <= a.checkChance; }
function playerAction(source: AncientScholarCombatSource, m: RoundModel, id: AncientScholarMoveId, physical: number, order: number, random: ActionRandomStream): AncientScholarPlayerAction {
  const a: AncientScholarPlayerAction = { ...evidence(order, physical), id, paperSpent: 0, borrowedReserve: 0, reserveSpent: 0, discardedReserve: 0, sourceId: null, imageId: null, activeSeconds: 0, returnedToPresent: true, transferredInjuryId: null };
  const pay = (n: number) => { if (m.playerSpirituality < n) return false; m.playerSpirituality -= n; a.paidCost += n; return true; };
  const strike = (why: string) => { a.selfGain = (m.supplies.clubHeld ? 16 : 12) * physical; a.threatens = a.selfGain > 0; a.label = `${why}同一原槽普通${m.supplies.clubHeld ? '本时代自有AS3-NEW-CLUB' : '本人空手'}打击${m.supplies.clubHeld ? 16 : 12}×身体G，不重抽或借用旧库存。`; };
  const block = (why: string) => { a.enemyReduction = 10 * physical; a.label = `${why}同一原槽普通格挡10×身体G，0灵性，不重抽。`; };
  if (id === 'STRIKE') strike('');
  else if (id === 'diviner.s8.body-control') { a.selfGain = 30 * physical; a.threatens = a.selfGain > 0; a.label = '继承本人身体控制：30×身体G，原身体未改变，无额外攻击。'; }
  else if (id === 'diviner.s8.balance') { a.enemyReduction = 28; a.label = '继承平衡：避让眼前同一原鲁克的真实原棍，减势28G，不保证免伤。'; }
  else if (id === 'diviner.s7.air-bullet') { if (pay(2)) { a.selfGain = 60; a.threatens = true; a.label = '本人继承空气弹：当下实耗2灵性，贡献60G，仍受共同胜负与原伤势盘约束。'; } else strike('空气弹真实灵性不足2；'); }
  else if (id === 'diviner.s8.paper-dagger' || id === 'diviner.s7.paper-weapon') {
    if (m.supplies.paperSheets < 1 || m.playerSpirituality < 1) strike('本时代原纸或当下灵性不足；旧纸已经过时，');
    else { pay(1); m.supplies.paperSheets--; m.supplies.paperSpent++; a.paperSpent = 1; a.selfGain = (id === 'diviner.s8.paper-dagger' ? 34 : 22) * physical; a.threatens = a.selfGain > 0;
      a.label = `继承${id === 'diviner.s8.paper-dagger' ? '纸飞刀34' : '纸武器22'}×身体G：实耗本次120便士购入AS3-CURRENT-KIT-1的原纸1、当下1灵性；纸不回库存，旧纸/旧预制纸人不参与。`; }
  } else if (id === 'diviner.s7.flame-control' || id === 'diviner.s7.flame-jump') {
    const attack = id === 'diviner.s7.flame-control', cost = attack ? 2 : 3;
    if (m.supplies.lanternPreparedWeek !== source.week || m.supplies.oilSpent !== 1 || m.playerSpirituality < cost) { if (attack) strike('没有本时代当周实耗油的同场原灯，或当下灵性不足；'); else block('没有本时代当周实耗油的两米原灯，或当下灵性不足；'); }
    else { pay(cost); if (attack) { a.selfGain = 31.2; a.threatens = true; } else a.enemyReduction = 31.2;
      a.label = `继承${attack ? '火焰操纵' : '火焰跳跃'}：真实同场AS3-NEW-LAMP已实耗唯一原油，另付${cost}当下灵性，${attack ? '贡献' : '局部避让减势'}31.2G；只在原净空外院两米，不凭空生火、任意逃跑或使用旧油。`; }
  } else if (id === 'diviner.s7.illusion') { if (pay(2)) { a.enemyReduction = 16; a.label = '继承有限感官幻术：当下2灵性、减势16G；不改鲁克心智、记忆或物权。'; } else block('幻术当下灵性不足2；'); }
  else if (id === 'diviner.s5.spirit-threads') { if (pay(2)) { a.enemyReduction = 12 * masteryFactor(source.spiritThreadMastery); a.label = '继承同阶强敌灵体线有限迟缓：当下2灵性、12×原掌握G；不按弱鼠15秒自动转化原鲁克，不产生秘偶或额外动作。'; } else block('灵体线当下灵性不足2；'); }
  else if (id === 'diviner.s4.worm-assignment' || id === 'diviner.s4.puppet-swap') a.label = `${id === 'diviner.s4.worm-assignment' ? '继承灵之虫赋能' : '继承秘偶换位'}：本场没有实际部署的原秘偶、原虫与异位端点。普通观察0贡献、0消耗，不把历史影像当真实秘偶；原鼠失败活放生、多恩死亡不改。`;
  else if (id === 'diviner.s7.damage-transfer') {
    const injury = m.playerInjuries.find(i => i.severity === 'HEAVY' && !m.damageTransfers.includes(i.id));
    if (!injury || m.playerSpirituality < 3) block('没有尚未转移的同一原重伤，或不足3灵性；');
    else { pay(3); injury.severity = 'LIGHT'; m.damageTransfers.push(injury.id); a.transferredInjuryId = injury.id;
      a.label = `继承伤害转移：当下3灵性，将本人同一原伤${injury.id}重伤降轻一次G；只在本人体内，健康不恢复、风险不清，不转给鲁克或过去自己。`; }
  } else if (id === B) {
    if (m.borrowUsed || !source.sample?.airBulletKnown || source.sample.spirituality - (m.playerSpirituality - 1) < 2 || m.playerSpirituality < 1) strike('没有真实过去余力样本、当下1维持灵性，或本轮已经借过；');
    else { pay(1); m.borrowUsed = true; a.sourceId = source.sample.id; check(source, a, random);
      if (a.succeeded) { a.borrowedReserve = Math.min(6, source.sample.spirituality - m.playerSpirituality); a.reserveSpent = 2; a.discardedReserve = a.borrowedReserve - 2; a.activeSeconds = 6; a.selfGain = Math.min(60, source.sample.airBulletGain); a.threatens = true; }
      a.label = `本人过去借力：真实样本${a.sourceId}曾有S${source.sample.spirituality}；当下实付1灵性维持这一动作6秒G，知识14检定${a.checkRoll}/${a.checkChance}，${a.succeeded ? `只临时借到${a.borrowedReserve}，其中2实用于样本已有空气弹${a.selfGain}G，余${a.discardedReserve}在同槽结束即失去` : '失败贡献0，维持费用不退'}。真实灵性不增加、H/M不恢复，临时储备不供维持，不索取更强过去或追加动作。`; }
  } else if (id === P) {
    if (m.projectionUsed || !source.tagSource || m.playerSpirituality < 4) block('没有本人亲历原签来源、当下4灵性，或本轮唯一投影机会已用；');
    else { pay(4); m.projectionUsed = true; a.sourceId = source.tagSource.sourceId; check(source, a, random);
      if (a.succeeded) { a.imageId = `${source.runId}:AS3-BATTLE-IMAGE:${source.round}:${order}`; a.activeSeconds = 30; a.enemyReduction = 12; }
      a.label = `历史影像：实耗当下4灵性、知识14检定${a.checkRoll}/${a.checkChance}，${a.succeeded ? `召出唯一1克普通原签影像${a.imageId}，本人将它掷过眼前两米视野，只以可见飘动分散注意减势12G，最多30秒后消散` : '召唤失败，贡献0，费用不退'}。原BR4-TAG-1始终在原携笼，没有坚硬盾牌、独立活人、免费污染铜铃、未知秘密或永久库存。`; }
  } else if (id === H) {
    if (m.shelterUsed || !source.fragment || m.playerSpirituality < 4) block('没有本人已点亮片段、当下4灵性，或本轮藏身机会已用；');
    else { pay(4); m.shelterUsed = true; a.sourceId = source.fragment.id; check(source, a, random);
      if (a.succeeded) { a.activeSeconds = 10; a.enemyReduction = 35; }
      a.label = `历史藏身：实耗当下4灵性、知识14检定${a.checkRoll}/${a.checkChance}，${a.succeeded ? `同一本人暂离现实藏入亲历片段${a.sourceId}，10秒G后完整回到本场同一原垫，局部避让减势35G` : '失败，本人始终在现实原垫，贡献0且费用不退'}。没有留在现实的第二自我、永久失踪或任意落点，不让普通出口变成保证撤退，仍结算原伤与死亡风险。`; }
  } else { a.selfGain = -22.5; a.label = '专注失衡：固定−22.5G，0灵性，不是致伤攻击。'; }
  return a;
}
function enemyAction(m: RoundModel, planned: AncientScholarEnemyIntent, physical: number, order: number): AncientScholarEnemyAction {
  const p = ANCIENT_SCHOLAR_POWERS.find(x => x.id === planned), payable = !!p && m.enemySpirituality >= p.cost;
  const actual: AncientScholarEnemyIntent = planned === 'ACCIDENT' ? planned : payable ? planned : 'BODY_STRIKE';
  const a: AncientScholarEnemyAction = { ...evidence(order, physical), planned, actual };
  if (payable) { a.paidCost = p!.cost; m.enemySpirituality -= a.paidCost; m.powerUses[p!.id]++; }
  a.selfGain = actual === 'ACCIDENT' ? -22.5 : payable ? p!.selfGain : 20 * physical; a.enemyReduction = payable ? p!.enemyReduction : 0;
  a.threatens = (actual === 'BODY_STRIKE' || actual === 'ARC_BOLT') && a.selfGain > 0;
  a.label = actual === 'ACCIDENT' ? '同一原鲁克动作偏差：固定−22.5G，0灵性，不重抽。' : payable ? `同一原鲁克完成${p!.label}，实际支付${p!.cost}本人原灵性，余${m.enemySpirituality}/120；不补资源、不直接扣玩家健康。` : `${p ? '原鲁克法术灵性不足，' : ''}同一原槽用自己AS3-ROOK-CLUB普通打击20×身体G，0灵性，不重抽、不凭空补术。`;
  return a;
}
export function resolveAncientScholarCombatAbility(s: SliceState, id: AncientScholarMoveId, physical: number, random: ActionRandomStream,
  r: AncientScholarRoundContext, source: AncientScholarCombatSource | null = r.source): AncientScholarCombatEffect {
  if (!validRound(s, r, source) || ![...ABILITIES.map(a => a.id), 'diviner.s7.damage-transfer'].includes(id)) return none('本回合真实来源或当下原资源不符：普通观察0贡献、0消耗、不重抽。');
  const a = playerAction(r.source, r.model, id, bounded(physical, 1), r.playerActions.length + r.enemyActions.length, random); r.playerActions.push(a); commit(s, r);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export function resolveAncientScholarEnemyAbility(s: SliceState, planned: AncientScholarEnemyIntent, physical: number, _random: ActionRandomStream,
  r: AncientScholarRoundContext, source: AncientScholarCombatSource | null = r.source): AncientScholarCombatEffect {
  if (!validRound(s, r, source) || ![...ANCIENT_SCHOLAR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少同一原鲁克与本回合实际资源：0贡献、0消耗、不重抽。');
  const a = enemyAction(r.model, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length); r.enemyActions.push(a); commit(s, r);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export interface AncientScholarRoundOutcome {
  targetId: typeof ANCIENT_SCHOLAR_TARGET_ID; round: number; source: AncientScholarCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; playerHealthBeforeConsequence: number;
  enemySpiritualityBefore: number; powerUses: Record<AncientScholarPowerId, number>; suppliesAfter: AncientScholarCombatSupplies;
  playerInjuriesBeforeConsequence: SliceInjury[]; damageTransfersAfter: string[];
  borrowedReserveAfter: 0; activeImagesAfter: 0; ownerAt: 'PRESENT_MAT'; elapsedSeconds: 60;
  playerActions: AncientScholarPlayerAction[]; enemyActions: AncientScholarEnemyAction[];
}
export function finishAncientScholarCombatRound(s: SliceState, r: AncientScholarRoundContext, continuing = true): AncientScholarRoundOutcome {
  // The common consequence phase may already change health/injuries. It must not
  // change paid resources; compare those separately instead of overwriting it.
  const e = s.ancientScholar.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'ANCIENT_SCHOLAR_DISPUTE' || c.round !== r.source.round || s.spirituality !== r.model.playerSpirituality || e.enemySpirituality !== r.model.enemySpirituality || stableStringify(e.supplies) !== stableStringify(r.model.supplies) || stableStringify(e.powerUses) !== stableStringify(r.model.powerUses) || stableStringify(s.magician.damageTransfers) !== stableStringify(r.model.damageTransfers)) throw new Error('同一原回合已结束或真实资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk; r.finished = true;
  return { targetId: ANCIENT_SCHOLAR_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, playerHealthBeforeConsequence: r.source.playerHealth,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, suppliesAfter: structuredClone(e.supplies), playerInjuriesBeforeConsequence: structuredClone(r.model.playerInjuries), damageTransfersAfter: [...r.model.damageTransfers],
    borrowedReserveAfter: 0, activeImagesAfter: 0, ownerAt: 'PRESENT_MAT', elapsedSeconds: 60, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectAncientScholarCombat(s: SliceState) {
  const e = s.ancientScholar.encounter;
  return { enemyName: '鲁克·文恩（AS3-ROOK-VENN，后世成年原对手，41岁，G）', targetId: e.targetId, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, supplies: structuredClone(e.supplies), originalExit: true, pursuit: false, distanceMetres: 2, source: currentAncientScholarCombatSource(s),
    summary: `原鲁克S${e.enemySpirituality}/120；双方保原六槽与1250/底125有限G预算。借过去只用本人实录样本，当下1维持一次6秒，借2用于已有空气弹后立刻失去剩余；影像4灵性只投亲历1克原签、容量1/30秒；藏身4灵性仅10秒再回本场同一原垫。三项知识14且每轮各最多尝试一次，失败仍实耗。旧耗材不可用，新包纸剩${e.supplies.paperSheets}、油剩${e.supplies.oilHeld}。没有历史改写、双自我、未知秘密或免费高位影像。` };
}
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validSource(source: AncientScholarCombatSource): boolean {
  if (!source || source.encounterId !== 'ANCIENT_SCHOLAR_DISPUTE' || source.targetId !== ANCIENT_SCHOLAR_TARGET_ID || typeof source.runId !== 'string' || !integer(source.revision) || !integer(source.week, 1) || !integer(source.round, 1) || source.attemptWeek !== source.week || !integer(source.startHistoryIndex) || source.actualOriginalBody !== true || source.targetAlive !== true || source.independentMind !== true || source.targetSequence !== 4 || source.targetAge !== 41 || source.targetPhysique !== 20 || source.enemyWeapon !== 'AS3-ROOK-CLUB' || source.distanceMetres !== 2 || source.noBystanders !== true || source.ordinaryExit !== true || source.pursuit !== false || source.space !== 'AS3-RECEPTION-COURTYARD' || source.presentReturnPoint !== 'AS3-RECEPTION-MAT') return false;
  if (![source.playerHealth, source.playerMind, source.enemyHealth, source.enemyMind].every(n => integer(n, 1, 100)) || !integer(source.knowledge, 0, 500) || !integer(source.spiritThreadMastery, 0, 500) || !Array.isArray(source.playerInjuries) || !Array.isArray(source.enemyInjuries) || !Array.isArray(source.damageTransfers)) return false;
  const sample = source.sample, f = source.fragment, t = source.tagSource, p = source.supplies;
  if (sample && (sample.id !== `${source.runId}:AS3-SAMPLE:${sample.revision}` || sample.bodyId !== `${source.runId}:body` || !integer(sample.revision, 0, source.revision) || !integer(sample.week, 1, source.week) || sample.sequence !== 3 || !integer(sample.spirituality, 0, 120) || !integer(sample.health, 1, 100) || !integer(sample.mind, 1, 100) || sample.airBulletGain !== 60 || typeof sample.airBulletKnown !== 'boolean' || sample.source !== 'ACTUAL_RECEPTION_OBSERVATION')) return false;
  if (f && (f.id !== `${source.runId}:AS3-FRAGMENT:${f.revision}` || f.bodyId !== `${source.runId}:body` || !integer(f.revision, 0, source.revision) || !integer(f.week, 1, source.week) || f.place !== 'AS3-RECEPTION-MAT' || f.event !== 'PERSONALLY_OBSERVED_SAFE_MAT')) return false;
  if (t && (t.sourceId !== 'BR4-TAG-1' || t.massGrams !== 1 || t.source !== 'OWN_ORIGINAL_IN_CARRIER' || !integer(t.observedRevision, 0, source.revision) || !integer(t.observedWeek, 1, source.week))) return false;
  if (!p || p.kitId !== 'AS3-CURRENT-KIT-1' || p.clubId !== 'AS3-NEW-CLUB' || p.lampId !== 'AS3-NEW-LAMP' || !integer(p.paperSheets, 0, 4) || !integer(p.paperSpent, 0, 4) || ![0, 1].includes(p.oilHeld) || ![0, 1].includes(p.oilSpent)) return false;
  if (p.purchasedWeek === null ? p.pricePaid !== 0 || p.clubHeld || p.paperSheets !== 0 || p.paperSpent !== 0 || p.oilHeld !== 0 || p.oilSpent !== 0 || p.lanternPreparedWeek !== null : !integer(p.purchasedWeek, 1, source.week) || p.pricePaid !== 120 || !p.clubHeld || p.paperSheets + p.paperSpent !== 4 || p.oilHeld + p.oilSpent !== 1 || p.lanternPreparedWeek !== null && (!integer(p.lanternPreparedWeek, p.purchasedWeek, source.week) || p.oilSpent !== 1)) return false;
  return !!source.powerUses && Object.keys(source.powerUses).length === 3 && ANCIENT_SCHOLAR_POWER_IDS.every(id => integer(source.powerUses[id]));
}
/** Replay every paid action, its exact original source and the bounded temporary
 * resources. No supplied outcome can create extra spirit, paper, bodies or time. */
export function validateAncientScholarRoundOutcome(v: unknown): v is AncientScholarRoundOutcome {
  try {
    const o = v as AncientScholarRoundOutcome;
    if (!o || !validSource(o.source) || o.targetId !== ANCIENT_SCHOLAR_TARGET_ID || o.round !== o.source.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' || !integer(o.enemyHealth, 0, 100) || !integer(o.enemyMind, 1, 100) || !integer(o.enemySpirituality, 0, 120) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) || !integer(o.playerHealthAfter, 0, 100) || !integer(o.playerMindAfter, 0, 100) || !integer(o.playerSpiritualityBefore, 0, 120) || !integer(o.playerSpiritualityAfter, 0, 120) || !integer(o.enemySpiritualityBefore, 0, 120) || o.playerHealthBeforeConsequence !== o.source.playerHealth || o.playerMindAfter !== o.source.playerMind || o.borrowedReserveAfter !== 0 || o.activeImagesAfter !== 0 || o.ownerAt !== 'PRESENT_MAT' || o.elapsedSeconds !== 60 || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6) return false;
    if (o.enemySpiritualityBefore !== 120 - ANCIENT_SCHOLAR_POWERS.reduce((n, p) => n + o.source.powerUses[p.id] * p.cost, 0)) return false;
    const m = initialModel(o.source, o.playerSpiritualityBefore, o.enemySpiritualityBefore);
    const all = [...o.playerActions.map(a => ({ actor: 'PLAYER', action: a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY', action: a }))].sort((a, b) => a.action.order - b.action.order);
    for (const [index, item] of all.entries()) {
      const a = item.action;
      if (a.order !== index || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      let cursor = 0;
      const random: ActionRandomStream = { seed: 'as3-outcome-replay', get cursor() { return cursor; }, nextInt(min, max) { const roll = a.rolls[cursor++]; if (roll === undefined || roll < min || roll > max) throw new Error('invalid replay roll'); return roll; } };
      let expected: AncientScholarPlayerAction | AncientScholarEnemyAction;
      if (item.actor === 'PLAYER') {
        const x = a as AncientScholarPlayerAction;
        if (![...ABILITIES.map(z => z.id), 'diviner.s7.damage-transfer'].includes(x.id)) return false;
        expected = playerAction(o.source, m, x.id, x.physicalFactor, index, random);
      } else { const x = a as AncientScholarEnemyAction; if (![...ANCIENT_SCHOLAR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(x.planned)) return false; expected = enemyAction(m, x.planned, x.physicalFactor, index); }
      if (cursor !== a.rolls.length || stableStringify(expected) !== stableStringify(a)) return false;
    }
    return m.playerSpirituality === o.playerSpiritualityAfter && m.enemySpirituality === o.enemySpirituality && stableStringify(m.powerUses) === stableStringify(o.powerUses) && stableStringify(m.supplies) === stableStringify(o.suppliesAfter) && stableStringify(m.playerInjuries) === stableStringify(o.playerInjuriesBeforeConsequence) && stableStringify(m.damageTransfers) === stableStringify(o.damageTransfersAfter);
  } catch { return false; }
}
