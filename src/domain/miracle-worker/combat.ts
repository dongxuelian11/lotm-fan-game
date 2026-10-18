import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { MAGICIAN_COUNT_WHEEL, magicianActionCount } from '../magician/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasAncientScholarPastSample, hasAncientScholarTagSource, hasAncientScholarFragment,
  type AncientScholarPastSample, type AncientScholarHistoryFragment, type AncientScholarLifeState } from '../ancient-scholar/life.js';
import type { MiracleWorkerLifeState } from './life.js';
import { MIRACLE_WORKER_TARGET_ID, MIRACLE_WORKER_SITE, MIRACLE_WORKER_EXIT, MIRACLE_WORKER_POWERS,
  MIRACLE_WORKER_POWER_IDS, hasMiracleWorkerDisputeOpponent, isMiracleWorkerEncounterStage,
  type MiracleWorkerEnemyIntent, type MiracleWorkerPowerId, type MiracleWorkerCombatSupplies } from './encounter.js';

/** The initial S2 keeps the existing S3 four-core mean, 1250/floor125 and
 * max120/regen12 finite G model. The original S3 opponent independently uses
 * core22, H100/M100/S120 and never regenerates spirituality. These are not canon.
 * S2 probability and observed-scene actions share this paid-action replay;
 * wishes stay in their real-life wish chain. Revival belongs only to the common
 * actual PLAYER_DEAD hook, never to an action or a substitute injury roll. */
export const MIRACLE_WORKER_PLAYER_PROFILE = { ceiling: 1250, floor: 125, spiritualityMax: 120, spiritualityRecovery: 12 } as const;
export const MIRACLE_WORKER_ENEMY_PROFILE = { core: 22, ceiling: 1250, floor: 125, spiritualityMax: 120, spiritualityRecovery: 0 } as const;
export const MIRACLE_WORKER_S2_PROFILE = {
  probability: { spirituality: 5, mind: 1, usesPerRound: 1, winChanceBonus: 5, winChanceCeiling: 95 },
  scene: { spirituality: 10, usesPerRound: 1, capacity: 1, seconds: 30, contribution: 60 },
} as const;
export const MIRACLE_WORKER_COUNT_WHEEL = MAGICIAN_COUNT_WHEEL;
export const MIRACLE_WORKER_ENEMY_COUNT_WHEEL = MAGICIAN_COUNT_WHEEL;
export const miracleWorkerActionCount = magicianActionCount;
export const miracleWorkerEnemyActionCount = magicianActionCount;
/** The common adapter calls this before its one original winner roll. No bonus
 * touches retreat or the shared injury wheel, and there is no reroll. */
export function miracleWorkerWinChance(playerAdvantage: number, enemyAdvantage: number, winChanceBonus: 0 | 5): number {
  if (!Number.isFinite(playerAdvantage) || !Number.isFinite(enemyAdvantage) || playerAdvantage <= 0 || enemyAdvantage <= 0 || ![0, 5].includes(winChanceBonus))
    throw new Error('胜负概率必须来自同一真实回合的正优势与已付概率加值。');
  const base = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100;
  return winChanceBonus === 0 ? base : Math.min(95, base + winChanceBonus);
}
export const MIRACLE_WORKER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原灰弧术：6灵性/贡献85G', weight: 35 },
  { id: 'WARD', label: '原有限护术：5灵性/减势50G', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍：22×身体G', weight: 25 },
  { id: 'COMPOSE', label: '普通整理姿势：0贡献', weight: 10 },
  { id: 'ACCIDENT', label: '动作偏差：−22.5G', weight: 5 },
];
export type MiracleWorkerMoveId = 'STRIKE' | 'ACCIDENT' | 'S2_PROBABILITY' | 'S2_SCENE' | 'diviner.s8.body-control' | 'diviner.s8.balance' | 'diviner.s8.paper-dagger'
  | 'diviner.s7.air-bullet' | 'diviner.s7.paper-weapon' | 'diviner.s7.flame-control' | 'diviner.s7.flame-jump'
  | 'diviner.s7.illusion' | 'diviner.s7.damage-transfer' | 'diviner.s5.spirit-threads'
  | 'diviner.s4.worm-assignment' | 'diviner.s4.puppet-swap'
  | 'diviner.s3.borrow-past' | 'diviner.s3.historical-projection' | 'diviner.s3.history-shelter';
const B = 'diviner.s3.borrow-past', P = 'diviner.s3.historical-projection', H = 'diviner.s3.history-shelter';
const ABILITIES: readonly { id: MiracleWorkerMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'STRIKE', label: '本人空手12/本次原棍16×身体G', weight: 15, stance: 'ATTACK' },
  { id: 'diviner.s8.body-control', label: '继承体术30×身体G', weight: 8, stance: 'ATTACK' },
  { id: 'diviner.s7.air-bullet', label: '继承空气弹：2灵性/60G', weight: 12, stance: 'ATTACK' },
  { id: 'diviner.s8.paper-dagger', label: '继承纸飞刀：新原纸1/灵性1', weight: 4, stance: 'ATTACK' },
  { id: 'diviner.s7.paper-weapon', label: '继承纸武器：新原纸1/灵性1', weight: 3, stance: 'ATTACK' },
  { id: 'diviner.s7.flame-control', label: '继承火焰操纵：同场实付原灯/2灵性', weight: 3, stance: 'ATTACK' },
  { id: 'diviner.s8.balance', label: '继承平衡：减势28G', weight: 8, stance: 'DEFEND' },
  { id: 'diviner.s7.flame-jump', label: '继承局部火跳：同场原灯/3灵性', weight: 9, stance: 'DEFEND' },
  { id: 'diviner.s7.illusion', label: '继承有限幻术：2灵性/减势16G', weight: 8, stance: 'DEFEND' },
  { id: 'diviner.s5.spirit-threads', label: '原S3强敌灵体线有限迟缓：2灵性', weight: 20, stance: 'CONTROL' },
  { id: 'diviner.s4.worm-assignment', label: '继承赋能：无已部署原秘偶则普通观察', weight: 5, stance: 'PREPARE' },
  { id: 'diviner.s4.puppet-swap', label: '继承换位：无真实异位端点则普通观察', weight: 5, stance: 'PREPARE' },
  { id: B, label: '本人过去借力：真实样本/当下维持/有限一槽', weight: 10, stance: 'ATTACK' },
  { id: P, label: '亲历普通原签影像：4灵性/知识14/30秒G', weight: 8, stance: 'CONTROL' },
  { id: H, label: '本人藏入亲历历史再回界石：4灵性/10秒G', weight: 12, stance: 'DEFEND' },
  { id: 'S2_PROBABILITY', label: '有限概率：5灵性/1精神，本轮胜率+5百分点、上限95%G', weight: 4, stance: 'CONTROL' },
  { id: 'S2_SCENE', label: '亲观当代原庭院影像：10灵性/单幅30秒/贡献60G', weight: 6, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作失衡：−22.5G', weight: 2, stance: null },
];
export function isMiracleWorker(s: SliceState): boolean { return isMiracleWorkerEncounterStage(s); }
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const masteryFactor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
function entries(s: SliceState) {
  return s.injuries.some(i => i.severity === 'HEAVY' && !s.magician.damageTransfers.includes(i.id))
    ? ABILITIES.map(a => a.id === 'diviner.s8.balance'
      ? { ...a, id: 'diviner.s7.damage-transfer' as const, label: '继承同一原重伤一次体内转移：3灵性' } : a) : ABILITIES;
}
export function miracleWorkerAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const a = entries(s), weights = a.map(x => x.weight * (stance !== null && x.stance === stance ? 5 : 4));
  const total = weights.reduce((n, v) => n + v, 0);
  return a.map((x, i) => ({ id: x.id, label: x.label, weight: weights[i]! / total * 100 }));
}
export function drawMiracleWorkerAbility(random: ActionRandomStream, s: SliceState, stance: SliceStance | null): MiracleWorkerMoveId {
  const a = entries(s), weights = a.map(x => x.weight * (stance !== null && x.stance === stance ? 5 : 4));
  let n = random.nextInt(1, weights.reduce((sum, v) => sum + v, 0));
  for (const [i, x] of a.entries()) { n -= weights[i]!; if (n <= 0) return x.id; }
  throw new Error('奇迹师六槽能力盘权重无效。');
}
export function drawMiracleWorkerEnemyAbility(random: ActionRandomStream): MiracleWorkerEnemyIntent {
  let n = random.nextInt(1, 100);
  for (const x of MIRACLE_WORKER_ENEMY_ABILITY_WHEEL) { n -= x.weight; if (n <= 0) return x.id as MiracleWorkerEnemyIntent; }
  throw new Error('同一科文能力盘权重无效。');
}

export interface MiracleWorkerCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'MIRACLE_WORKER_DISPUTE'; targetId: typeof MIRACLE_WORKER_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; playerSequence: 2; bodyId: string;
  year: number; sceneSource: MiracleWorkerLifeState['scene']['source'];
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number;
  playerRisk: number; enemyRisk: number;
  enemyInjuries: SliceInjury[]; playerInjuries: SliceInjury[]; damageTransfers: string[]; knowledge: number;
  actualOriginalBody: true; targetAlive: true; independentMind: true; targetSequence: 3; targetAge: 46;
  targetPhysique: 22; enemyWeapon: 'MW2-CORVEN-CLUB'; distanceMetres: 3; noBystanders: true; ordinaryExit: true; pursuit: false;
  space: typeof MIRACLE_WORKER_SITE; presentReturnPoint: typeof MIRACLE_WORKER_SITE; exit: typeof MIRACLE_WORKER_EXIT;
  sample: AncientScholarPastSample | null; tagSource: AncientScholarLifeState['tagFamiliarity']; fragment: AncientScholarHistoryFragment | null;
  supplies: MiracleWorkerCombatSupplies; spiritThreadMastery: number; powerUses: Record<MiracleWorkerPowerId, number>;
}
export function currentMiracleWorkerCombatSource(s: SliceState): MiracleWorkerCombatSource | null {
  if (!hasMiracleWorkerDisputeOpponent(s)) return null;
  const e = s.miracleWorker.encounter, c = s.combat!, l = s.ancientScholar.life;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'MIRACLE_WORKER_DISPUTE', targetId: MIRACLE_WORKER_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerSequence: 2, bodyId: `${s.runId}:body`,
    year: s.date.year, sceneSource: hasMiracleWorkerCombatSceneSource(s) ? structuredClone(s.miracleWorker.life.scene.source) : null,
    playerHealth: s.health, playerMind: s.mind, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    playerRisk: s.injuryRisk, enemyRisk: c.enemyRisk,
    enemyInjuries: structuredClone(c.enemyInjuries), playerInjuries: structuredClone(s.injuries), damageTransfers: [...s.magician.damageTransfers],
    knowledge: s.character.coreStats.knowledge, actualOriginalBody: true, targetAlive: true, independentMind: true,
    targetSequence: 3, targetAge: 46, targetPhysique: 22, enemyWeapon: 'MW2-CORVEN-CLUB', distanceMetres: 3,
    noBystanders: true, ordinaryExit: true, pursuit: false, space: MIRACLE_WORKER_SITE, presentReturnPoint: MIRACLE_WORKER_SITE, exit: MIRACLE_WORKER_EXIT,
    sample: hasAncientScholarPastSample(s) ? structuredClone(l.sample) : null,
    tagSource: hasAncientScholarTagSource(s) ? structuredClone(l.tagFamiliarity) : null,
    fragment: hasAncientScholarFragment(s) ? structuredClone(l.fragment) : null,
    supplies: structuredClone(e.supplies), spiritThreadMastery: bounded(s.progression.mastery['diviner.s5.spirit-threads'] ?? 0, 500),
    powerUses: { ...e.powerUses } };
}
/** No external scene payload is accepted. The only eligible source was created
 * by the actual life OBSERVE and remains tied to this body's observation. */
export function hasMiracleWorkerCombatSceneSource(s: SliceState): boolean {
  const scene = s.miracleWorker.life.scene, f = scene.source;
  return !!f && f.id === `${s.runId}:MW2-COURT:${f.revision}` && f.place === 'MW2-CURRENT-COURTYARD' &&
    f.bodyId === `${s.runId}:body` && Number.isSafeInteger(f.revision) && f.revision >= 0 && f.revision <= s.revision &&
    Number.isSafeInteger(f.week) && f.week >= (s.miracleWorker.promotionWeek ?? s.week) && f.week <= s.week &&
    f.week === s.miracleWorker.life.cases['familiar-court'].observedWeek && Number.isSafeInteger(f.year) &&
    f.year >= 1 && f.year <= s.date.year && f.source === 'PERSONALLY_OBSERVED_CURRENT_ORIGINAL' &&
    scene.image === null && s.miracleWorker.life.activeCase === null;
}
export interface MiracleWorkerCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
interface ActionEvidence extends MiracleWorkerCombatEffect {
  order: number; paidCost: number; paidMind: number; physicalFactor: number; rolls: number[];
  checkChance: number | null; checkRoll: number | null; succeeded: boolean;
}
export interface MiracleWorkerPlayerAction extends ActionEvidence {
  id: MiracleWorkerMoveId; paperSpent: number; borrowedReserve: number; reserveSpent: number; discardedReserve: number;
  sourceId: string | null; imageId: string | null; activeSeconds: 0 | 6 | 10 | 30;
  returnedToPresent: true; transferredInjuryId: string | null;
  winChanceBonus: 0 | 5; sceneSourceId: string | null; sceneImageId: string | null;
  originalObjectsMoved: 0; permanentItemsCreated: 0; newNpcCount: 0;
}
export interface MiracleWorkerEnemyAction extends ActionEvidence { planned: MiracleWorkerEnemyIntent; actual: MiracleWorkerEnemyIntent }
interface RoundModel {
  playerSpirituality: number; playerMind: number; enemySpirituality: number; powerUses: Record<MiracleWorkerPowerId, number>;
  supplies: MiracleWorkerCombatSupplies; playerInjuries: SliceInjury[]; damageTransfers: string[];
  borrowUsed: boolean; projectionUsed: boolean; shelterUsed: boolean;
  probabilityUses: 0 | 1; sceneUses: 0 | 1; winChanceBonus: 0 | 5; sceneSourceId: string | null;
}
export interface MiracleWorkerRoundContext {
  source: MiracleWorkerCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; model: RoundModel;
  winChanceBonus: 0 | 5;
  playerActions: MiracleWorkerPlayerAction[]; enemyActions: MiracleWorkerEnemyAction[]; label: string;
}
const none = (label: string): MiracleWorkerCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
function liveState(s: SliceState): string {
  return stableStringify({ spirit: s.spirituality, mind: s.mind, enemySpirit: s.miracleWorker.encounter.enemySpirituality,
    powerUses: s.miracleWorker.encounter.powerUses, supplies: s.miracleWorker.encounter.supplies,
    injuries: s.injuries, damageTransfers: s.magician.damageTransfers });
}
const dynamic = new Set(['supplies', 'powerUses', 'playerInjuries', 'damageTransfers', 'playerMind']);
function validRound(s: SliceState, r: MiracleWorkerRoundContext, supplied: MiracleWorkerCombatSource | null): boolean {
  const actual = currentMiracleWorkerCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && stableStringify(supplied) === stableStringify(r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamic.has(k) || stableStringify(actual[k as keyof MiracleWorkerCombatSource]) === stableStringify(v)) &&
    r.liveState === liveState(s);
}
function initialModel(source: MiracleWorkerCombatSource, player: number, enemy: number): RoundModel {
  return { playerSpirituality: player, playerMind: source.playerMind, enemySpirituality: enemy, powerUses: { ...source.powerUses }, supplies: structuredClone(source.supplies),
    playerInjuries: structuredClone(source.playerInjuries), damageTransfers: [...source.damageTransfers], borrowUsed: false, projectionUsed: false, shelterUsed: false,
    probabilityUses: 0, sceneUses: 0, winChanceBonus: 0, sceneSourceId: null };
}
function commit(s: SliceState, r: MiracleWorkerRoundContext): void {
  const m = r.model, e = s.miracleWorker.encounter;
  s.spirituality = m.playerSpirituality; s.mind = m.playerMind; e.enemySpirituality = m.enemySpirituality; e.powerUses = { ...m.powerUses };
  e.supplies = structuredClone(m.supplies); s.injuries = structuredClone(m.playerInjuries);
  s.magician.damageTransfers = [...m.damageTransfers]; r.winChanceBonus = m.winChanceBonus; r.liveState = liveState(s);
}
export function beginMiracleWorkerCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): MiracleWorkerRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const source = currentMiracleWorkerCombatSource(s); if (!source) throw new Error('缺少同一原科文、原界石、独立资源或连续回合来源。');
  return { source, stance, finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality,
    enemySpiritualityBefore: s.miracleWorker.encounter.enemySpirituality,
    model: initialModel(source, s.spirituality, s.miracleWorker.encounter.enemySpirituality), playerActions: [], enemyActions: [], winChanceBonus: 0,
    label: `同一当代原科文在旧采石场界石三米外，原S${s.miracleWorker.encounter.enemySpirituality}/120。本回合60秒G，双方最多六槽，实际攻击才进入共同伤势盘。` };
}
export const createMiracleWorkerCombatRound = beginMiracleWorkerCombatRound;
function evidence(order: number, physical: number): ActionEvidence {
  return { ...none(''), order, paidCost: 0, paidMind: 0, physicalFactor: physical, rolls: [], checkChance: null, checkRoll: null, succeeded: false };
}
function check(source: MiracleWorkerCombatSource, a: ActionEvidence, random: ActionRandomStream): void {
  a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: source.knowledge, difficulty: 14, modifiers: [] });
  a.checkRoll = random.nextInt(1, 100); a.rolls.push(a.checkRoll); a.succeeded = a.checkRoll <= a.checkChance;
}
function playerAction(source: MiracleWorkerCombatSource, m: RoundModel, id: MiracleWorkerMoveId, physical: number,
  order: number, random: ActionRandomStream): MiracleWorkerPlayerAction {
  const a: MiracleWorkerPlayerAction = { ...evidence(order, physical), id, paperSpent: 0, borrowedReserve: 0,
    reserveSpent: 0, discardedReserve: 0, sourceId: null, imageId: null, activeSeconds: 0, returnedToPresent: true, transferredInjuryId: null,
    winChanceBonus: 0, sceneSourceId: null, sceneImageId: null, originalObjectsMoved: 0, permanentItemsCreated: 0, newNpcCount: 0 };
  const pay = (n: number) => { if (m.playerSpirituality < n) return false; m.playerSpirituality -= n; a.paidCost += n; return true; };
  const strike = (why: string) => {
    a.selfGain = (m.supplies.clubHeld ? 16 : 12) * physical; a.threatens = a.selfGain > 0;
    a.label = `${why}同一原槽使用${m.supplies.clubHeld ? '本人实付原棍MW2-NEW-CLUB，16' : '本人空手，12'}×身体G；不重抽、不借敌棍或复制旧物。`;
  };
  const block = (why: string) => { a.enemyReduction = 10 * physical; a.label = `${why}原槽普通格挡10×身体G，0灵性，不重抽。`; };
  if (id === 'S2_PROBABILITY') {
    if (m.probabilityUses !== 0 || m.playerSpirituality < 5 || m.playerMind <= 1) block('本轮概率已用，或当下5灵性/1精神不足以保持正精神；');
    else { pay(5); m.playerMind--; a.paidMind = 1; m.probabilityUses = 1; m.winChanceBonus = 5; a.winChanceBonus = 5; a.succeeded = true;
      a.label = 'S2有限概率操纵：先实付5灵性和1精神，本轮唯一一次；随后共同胜负原骰的玩家胜率只加5个百分点、最终上限95%G。不重掷原骰、不改伤势盘、不能自许回血或保证胜利。'; }
  } else if (id === 'S2_SCENE') {
    if (m.sceneUses !== 0 || !source.sceneSource || m.playerSpirituality < 10) block('本轮场景影像已用，或没有本人亲观原庭院来源/当下10灵性；');
    else { pay(10); m.sceneUses = 1; m.sceneSourceId = source.sceneSource.id; a.sourceId = source.sceneSource.id;
      a.sceneSourceId = source.sceneSource.id; a.sceneImageId = `${source.runId}:MW2-COMBAT-SCENE:${source.round}:${order}`;
      a.imageId = a.sceneImageId; a.activeSeconds = 30; a.succeeded = true; a.selfGain = 60;
      a.label = `S2有限历史场景影像：实付10灵性，唯一亲历来源${a.sceneSourceId}，本轮唯一影像${a.sceneImageId}存在30秒G后消散。熟悉庭院石阶、空墙与地面的短时影像供本人局部掩护判断，贡献60G；本槽没有攻击，不独自触发致伤盘。原身体仍在同一界石，原庭院、物件、NPC均不搬来，不产生永久库存或传送出口。`; }
  } else if (id === 'STRIKE') strike('');
  else if (id === 'diviner.s8.body-control') { a.selfGain = 30 * physical; a.threatens = a.selfGain > 0; a.label = '继承身体控制30×身体G；本人原身体、一次实际原槽，不额外增加动作。'; }
  else if (id === 'diviner.s8.balance') { a.enemyReduction = 28; a.label = '本人继承平衡避让眼前原科文，减势28G；不保证免伤。'; }
  else if (id === 'diviner.s7.air-bullet') {
    if (pay(2)) { a.selfGain = 60; a.threatens = true; a.label = '本人继承空气弹实耗当下2灵性，贡献60G；由共同胜负和伤势盘结算，不直接改敌H。'; }
    else strike('空气弹真实灵性不足2；');
  } else if (id === 'diviner.s8.paper-dagger' || id === 'diviner.s7.paper-weapon') {
    if (m.supplies.paperSheets < 1 || m.playerSpirituality < 1) strike('没有本次真实原纸或当下1灵性；');
    else { pay(1); m.supplies.paperSheets--; m.supplies.paperSpent++; a.paperSpent = 1;
      a.selfGain = (id === 'diviner.s8.paper-dagger' ? 34 : 22) * physical; a.threatens = a.selfGain > 0;
      a.label = `继承${id === 'diviner.s8.paper-dagger' ? '纸飞刀34' : '纸武器22'}×身体G：实耗MW2-CURRENT-KIT-1原纸1和本人灵性1，纸不回库存，也不是免费纸人。`; }
  } else if (id === 'diviner.s7.flame-control' || id === 'diviner.s7.flame-jump') {
    const attack = id === 'diviner.s7.flame-control', cost = attack ? 2 : 3;
    if (m.supplies.lanternPreparedWeek !== source.week || m.supplies.oilSpent !== 1 || m.playerSpirituality < cost) {
      if (attack) strike('没有本周同场实付原灯或当下灵性；'); else block('没有本周同场实付原灯或当下灵性；');
    } else { pay(cost); if (attack) { a.selfGain = 31.2; a.threatens = true; } else a.enemyReduction = 31.2;
      a.label = `同场原灯已经实耗油；继承${attack ? '火焰操纵' : '局部火跳'}再付${cost}灵性，${attack ? '贡献' : '减势'}31.2G。仅界石三米内，不凭空生火或以火跳保证退场。`; }
  } else if (id === 'diviner.s7.illusion') {
    if (pay(2)) { a.enemyReduction = 16; a.label = '有限感官幻术实耗2灵性，减势16G；不改科文记忆、独立心智、既有HMS或物权。'; }
    else block('有限幻术不足2灵性；');
  } else if (id === 'diviner.s5.spirit-threads') {
    if (pay(2)) { a.enemyReduction = 12 * masteryFactor(source.spiritThreadMastery); a.label = '原S3非凡者灵体线有限迟缓：2灵性、12×掌握G；不是把旧弱鼠阈值套在原科文身上，不自动夺取身体或产生秘偶。'; }
    else block('灵体线不足2灵性；');
  } else if (id === 'diviner.s4.worm-assignment' || id === 'diviner.s4.puppet-swap') {
    a.label = '本场没有真实部署的原秘偶、分离原虫和异位端点；原槽普通观察0贡献、0消耗，不把历史影像当原秘偶。旧鼠与旧多恩结果不变。';
  } else if (id === 'diviner.s7.damage-transfer') {
    const injury = m.playerInjuries.find(i => i.severity === 'HEAVY' && !m.damageTransfers.includes(i.id));
    if (!injury || m.playerSpirituality < 3) block('缺少本人尚未转移的同一原重伤或3灵性；');
    else { pay(3); injury.severity = 'LIGHT'; m.damageTransfers.push(injury.id); a.transferredInjuryId = injury.id;
      a.label = `本人同一原伤${injury.id}实耗3灵性体内转移一次，重降轻G；H不恢复、风险不清，伤不转给科文、历史自己或新身体。`; }
  } else if (id === B) {
    if (m.borrowUsed || !source.sample?.airBulletKnown || source.sample.spirituality - (m.playerSpirituality - 1) < 2 || m.playerSpirituality < 1) strike('没有有效本人过去余力样本、当下维持费用，或本轮已借；');
    else { pay(1); m.borrowUsed = true; a.sourceId = source.sample.id; check(source, a, random);
      if (a.succeeded) { a.borrowedReserve = Math.min(6, source.sample.spirituality - m.playerSpirituality); a.reserveSpent = 2;
        a.discardedReserve = a.borrowedReserve - 2; a.activeSeconds = 6; a.selfGain = Math.min(60, source.sample.airBulletGain); a.threatens = true; }
      a.label = `继承过去借力，真实样本${a.sourceId}；当下先付1维持灵性，知识14检定${a.checkRoll}/${a.checkChance}（G）。${a.succeeded ? `6秒内临时借${a.borrowedReserve}，只付2用于样本已有空气弹60G，余${a.discardedReserve}同槽丢弃` : '失败贡献0，费用不退'}；不补永久S/H/M、不从更弱过去索取新S2力量或增加槽。`; }
  } else if (id === P) {
    if (m.projectionUsed || !source.tagSource || m.playerSpirituality < 4) block('缺少真实亲历原签、当下4灵性，或本轮投影机会已用；');
    else { pay(4); m.projectionUsed = true; a.sourceId = source.tagSource.sourceId; check(source, a, random);
      if (a.succeeded) { a.imageId = `${source.runId}:MW2-BATTLE-IMAGE:${source.round}:${order}`; a.activeSeconds = 30; a.enemyReduction = 12; }
      a.label = `继承普通原签历史影像，实付4灵性，知识14检定${a.checkRoll}/${a.checkChance}（G）。${a.succeeded ? `唯一1克影像${a.imageId}局部飘动，减势12G，至多30秒后消散` : '失败0贡献，实付不退'}。BR4-TAG-1原件仍在原携笼，不复制库存、活人、封印物或未知秘密。`; }
  } else if (id === H) {
    if (m.shelterUsed || !source.fragment || m.playerSpirituality < 4) block('缺少本人已点亮原片段、当下4灵性，或本轮已藏身；');
    else { pay(4); m.shelterUsed = true; a.sourceId = source.fragment.id; check(source, a, random);
      if (a.succeeded) { a.activeSeconds = 10; a.enemyReduction = 35; }
      a.label = `继承本人历史藏身，实付4灵性，知识14检定${a.checkRoll}/${a.checkChance}（G）。${a.succeeded ? '本人暂离现实10秒后返回出发处同一界石，减势35G' : '失败留原界石，0贡献且不退费用'}；亲历旧片段不充当异地出口，没有留在现实的第二个自己，仍有共同致伤与真实死亡风险。`; }
  } else { a.selfGain = -22.5; a.label = '本人动作失衡：固定−22.5G，0灵性，不是致伤攻击。'; }
  return a;
}
function enemyAction(m: RoundModel, planned: MiracleWorkerEnemyIntent, physical: number, order: number): MiracleWorkerEnemyAction {
  const p = MIRACLE_WORKER_POWERS.find(x => x.id === planned), payable = !!p && m.enemySpirituality >= p.cost;
  const actual: MiracleWorkerEnemyIntent = planned === 'ACCIDENT' ? planned : payable ? planned : 'BODY_STRIKE';
  const a: MiracleWorkerEnemyAction = { ...evidence(order, physical), planned, actual };
  if (payable) { a.paidCost = p!.cost; m.enemySpirituality -= a.paidCost; m.powerUses[p!.id]++; }
  a.selfGain = actual === 'ACCIDENT' ? -22.5 : payable ? p!.selfGain : 22 * physical;
  a.enemyReduction = payable ? p!.enemyReduction : 0;
  a.threatens = (actual === 'BODY_STRIKE' || actual === 'ARC_BOLT') && a.selfGain > 0;
  a.label = actual === 'ACCIDENT' ? '同一原科文动作偏差−22.5G，0灵性，不重抽。'
    : payable ? `同一真实S3科文使用${p!.label}，实耗本人原灵性${p!.cost}，余${m.enemySpirituality}/120；不再生、不补资源或直接扣玩家H。`
    : `${p ? '既有原法术灵性不足，' : ''}同一原槽使用自己MW2-CORVEN-CLUB普通打击22×身体G；0灵性，不重抽、不发免费法术。`;
  return a;
}
export function resolveMiracleWorkerCombatAbility(s: SliceState, id: MiracleWorkerMoveId, physical: number,
  random: ActionRandomStream, r: MiracleWorkerRoundContext, source: MiracleWorkerCombatSource | null = r.source): MiracleWorkerCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || ![...ABILITIES.map(a => a.id), 'diviner.s7.damage-transfer'].includes(id))
    return none('本回合真实来源、六槽或实际资源不符：0贡献、0消耗、不重抽。');
  const a = playerAction(r.source, r.model, id, bounded(physical, 1), r.playerActions.length + r.enemyActions.length, random);
  r.playerActions.push(a); commit(s, r);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export function resolveMiracleWorkerEnemyAbility(s: SliceState, planned: MiracleWorkerEnemyIntent, physical: number,
  _random: ActionRandomStream, r: MiracleWorkerRoundContext, source: MiracleWorkerCombatSource | null = r.source): MiracleWorkerCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...MIRACLE_WORKER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned))
    return none('缺少同一真实原科文、本回合资源或六槽：0贡献、0消耗、不重抽。');
  const a = enemyAction(r.model, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length);
  r.enemyActions.push(a); commit(s, r);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}

export interface MiracleWorkerRoundOutcome {
  targetId: typeof MIRACLE_WORKER_TARGET_ID; round: number; source: MiracleWorkerCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; playerHealthBeforeConsequence: number;
  enemySpiritualityBefore: number; powerUses: Record<MiracleWorkerPowerId, number>; suppliesAfter: MiracleWorkerCombatSupplies;
  playerInjuriesBeforeConsequence: SliceInjury[]; damageTransfersAfter: string[];
  playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  probabilityUses: 0 | 1; sceneUses: 0 | 1; winChanceBonus: 0 | 5; sceneSourceId: string | null;
  activeSceneImagesAfter: 0; playerMindBeforeConsequence: number;
  borrowedReserveAfter: 0; activeImagesAfter: 0; ownerAt: typeof MIRACLE_WORKER_SITE; elapsedSeconds: 60;
  playerActions: MiracleWorkerPlayerAction[]; enemyActions: MiracleWorkerEnemyAction[];
}
export function finishMiracleWorkerCombatRound(s: SliceState, r: MiracleWorkerRoundContext, continuing = true): MiracleWorkerRoundOutcome {
  const e = s.miracleWorker.encounter, c = s.combat;
  // Common injury/death is already applied. Never overwrite that consequence.
  if (r.finished || !c || c.encounterId !== 'MIRACLE_WORKER_DISPUTE' || c.round !== r.source.round ||
    s.spirituality !== r.model.playerSpirituality || s.mind !== r.model.playerMind || r.winChanceBonus !== r.model.winChanceBonus || e.enemySpirituality !== r.model.enemySpirituality ||
    stableStringify(e.supplies) !== stableStringify(r.model.supplies) || stableStringify(e.powerUses) !== stableStringify(r.model.powerUses) ||
    stableStringify(s.magician.damageTransfers) !== stableStringify(r.model.damageTransfers)) throw new Error('同一原回合已结束，或实付资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus;
  e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk; r.finished = true;
  return { targetId: MIRACLE_WORKER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality,
    playerHealthAfter: s.health, playerMindAfter: s.mind, playerHealthBeforeConsequence: r.source.playerHealth,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, suppliesAfter: structuredClone(e.supplies),
    playerInjuriesBeforeConsequence: structuredClone(r.model.playerInjuries), damageTransfersAfter: [...r.model.damageTransfers],
    playerInjuriesAfter: structuredClone(s.injuries), playerRiskAfter: s.injuryRisk,
    enemyInjuriesAfter: structuredClone(c.enemyInjuries), enemyRiskAfter: c.enemyRisk,
    probabilityUses: r.model.probabilityUses, sceneUses: r.model.sceneUses, winChanceBonus: r.model.winChanceBonus,
    sceneSourceId: r.model.sceneSourceId, activeSceneImagesAfter: 0, playerMindBeforeConsequence: r.model.playerMind,
    borrowedReserveAfter: 0, activeImagesAfter: 0, ownerAt: MIRACLE_WORKER_SITE, elapsedSeconds: 60,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectMiracleWorkerCombat(s: SliceState) {
  const e = s.miracleWorker.encounter;
  return { enemyName: '科文·黑尔（MW2-CORVEN-HALE，1651年原创成年原S3，G）', targetId: e.targetId,
    enemySpirituality: e.enemySpirituality, powerUses: { ...e.powerUses }, supplies: structuredClone(e.supplies),
    originalExit: '旧采石场北侧排水梯 → 旧采石场公共出口', pursuit: false, distanceMetres: 3,
    source: currentMiracleWorkerCombatSource(s),
    summary: `原科文S${e.enemySpirituality}/120，独立原棍/既有原术、原六槽；本人实际S2沿有限1250/底125 G预算。概率本轮最多一次实付5S/1M，仅共同胜率+5百分点且上限95%；亲观庭院场景本轮最多一幅，10S/30秒/60贡献G，轮末清。真实付费原纸余${e.supplies.paperSheets}、油余${e.supplies.oilHeld}，不送纸人。共同PLAYER_DEAD后冻结原尸位、物件与敌状态，由独立复起规则处理，不自动免伤、清场或重战。` };
}

const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const validInjuries = (v: SliceInjury[]) => Array.isArray(v) && v.every(i => !!i && typeof i.id === 'string' &&
  ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
function validSource(source: MiracleWorkerCombatSource): boolean {
  if (!source || source.encounterId !== 'MIRACLE_WORKER_DISPUTE' || source.targetId !== MIRACLE_WORKER_TARGET_ID ||
    typeof source.runId !== 'string' || !integer(source.revision) || !integer(source.week, 1) || !integer(source.round, 1) ||
    source.attemptWeek !== source.week || !integer(source.startHistoryIndex) || source.playerSequence !== 2 || source.bodyId !== `${source.runId}:body` || !integer(source.year, 1) ||
    source.actualOriginalBody !== true || source.targetAlive !== true || source.independentMind !== true || source.targetSequence !== 3 ||
    source.targetAge !== 46 || source.targetPhysique !== 22 || source.enemyWeapon !== 'MW2-CORVEN-CLUB' || source.distanceMetres !== 3 ||
    source.noBystanders !== true || source.ordinaryExit !== true || source.pursuit !== false || source.space !== MIRACLE_WORKER_SITE ||
    source.presentReturnPoint !== MIRACLE_WORKER_SITE || source.exit !== MIRACLE_WORKER_EXIT) return false;
  if (![source.playerHealth, source.playerMind, source.enemyHealth, source.enemyMind].every(n => integer(n, 1, 100)) ||
    !integer(source.knowledge, 0, 500) || !integer(source.spiritThreadMastery, 0, 500) ||
    !integer(source.playerRisk) || !integer(source.enemyRisk) ||
    !validInjuries(source.playerInjuries) || !validInjuries(source.enemyInjuries) || !Array.isArray(source.damageTransfers) || source.damageTransfers.some(id => typeof id !== 'string')) return false;
  const sample = source.sample, f = source.fragment, t = source.tagSource, p = source.supplies;
  const scene = source.sceneSource;
  if (scene && (scene.id !== `${source.runId}:MW2-COURT:${scene.revision}` || scene.place !== 'MW2-CURRENT-COURTYARD' ||
    scene.bodyId !== source.bodyId || !integer(scene.revision, 0, source.revision) || !integer(scene.week, 1, source.week) ||
    !integer(scene.year, 1, source.year) || scene.source !== 'PERSONALLY_OBSERVED_CURRENT_ORIGINAL')) return false;
  if (sample && (sample.id !== `${source.runId}:AS3-SAMPLE:${sample.revision}` || sample.bodyId !== `${source.runId}:body` ||
    !integer(sample.revision, 0, source.revision) || !integer(sample.week, 1, source.week) || sample.sequence !== 3 ||
    !integer(sample.spirituality, 0, 120) || !integer(sample.health, 1, 100) || !integer(sample.mind, 1, 100) ||
    sample.airBulletGain !== 60 || typeof sample.airBulletKnown !== 'boolean' || sample.source !== 'ACTUAL_RECEPTION_OBSERVATION')) return false;
  if (f && (f.id !== `${source.runId}:AS3-FRAGMENT:${f.revision}` || f.bodyId !== `${source.runId}:body` ||
    !integer(f.revision, 0, source.revision) || !integer(f.week, 1, source.week) || f.place !== 'AS3-RECEPTION-MAT' || f.event !== 'PERSONALLY_OBSERVED_SAFE_MAT')) return false;
  if (t && (t.sourceId !== 'BR4-TAG-1' || t.massGrams !== 1 || t.source !== 'OWN_ORIGINAL_IN_CARRIER' ||
    !integer(t.observedRevision, 0, source.revision) || !integer(t.observedWeek, 1, source.week))) return false;
  if (!p || p.kitId !== 'MW2-CURRENT-KIT-1' || p.clubId !== 'MW2-NEW-CLUB' || p.lampId !== 'MW2-NEW-LAMP' ||
    !integer(p.paperSheets, 0, 4) || !integer(p.paperSpent, 0, 4) || ![0, 1].includes(p.oilHeld) || ![0, 1].includes(p.oilSpent)) return false;
  if (p.purchasedWeek === null ? p.pricePaid !== 0 || p.clubHeld || p.paperSheets !== 0 || p.paperSpent !== 0 || p.oilHeld !== 0 || p.oilSpent !== 0 || p.lanternPreparedWeek !== null
    : !integer(p.purchasedWeek, 1, source.week) || p.pricePaid !== 120 || p.clubHeld !== true || p.paperSheets + p.paperSpent !== 4 || p.oilHeld + p.oilSpent !== 1 ||
      p.lanternPreparedWeek !== null && (!integer(p.lanternPreparedWeek, p.purchasedWeek, source.week) || p.oilSpent !== 1)) return false;
  return !!source.powerUses && Object.keys(source.powerUses).length === 3 && MIRACLE_WORKER_POWER_IDS.every(id => integer(source.powerUses[id]));
}
/** Replay exact paid slots; supplied outcome fields cannot mint paper, original
 * objects, spirituality, bodies or further original-NPC actions. */
export function validateMiracleWorkerRoundOutcome(v: unknown): v is MiracleWorkerRoundOutcome {
  try {
    const o = v as MiracleWorkerRoundOutcome;
    if (!o || !validSource(o.source) || o.targetId !== MIRACLE_WORKER_TARGET_ID || o.round !== o.source.round ||
      !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' ||
      !integer(o.enemyHealth, 0, 100) || !integer(o.enemyMind, 1, 100) || !integer(o.enemySpirituality, 0, 120) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
      !integer(o.playerHealthAfter, 0, 100) || !integer(o.playerMindAfter, 0, 100) ||
      !integer(o.playerRiskAfter, o.source.playerRisk) || !integer(o.enemyRiskAfter, o.source.enemyRisk) ||
      !validInjuries(o.playerInjuriesAfter) || !validInjuries(o.enemyInjuriesAfter) ||
      o.playerHealthAfter > o.source.playerHealth || o.enemyHealth > o.source.enemyHealth || o.enemyMind !== o.source.enemyMind ||
      !integer(o.playerSpiritualityBefore, 0, 120) || !integer(o.playerSpiritualityAfter, 0, 120) || !integer(o.enemySpiritualityBefore, 0, 120) ||
      o.playerHealthBeforeConsequence !== o.source.playerHealth || o.playerMindAfter !== o.playerMindBeforeConsequence ||
      !integer(o.playerMindBeforeConsequence, 1, o.source.playerMind) || o.borrowedReserveAfter !== 0 ||
      ![0, 1].includes(o.probabilityUses) || ![0, 1].includes(o.sceneUses) || o.winChanceBonus !== (o.probabilityUses ? 5 : 0) ||
      o.activeSceneImagesAfter !== 0 || o.sceneSourceId !== (o.sceneUses ? o.source.sceneSource?.id : null) ||
      o.activeImagesAfter !== 0 || o.ownerAt !== MIRACLE_WORKER_SITE || o.elapsedSeconds !== 60 ||
      !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6) return false;
    if (o.enemySpiritualityBefore !== 120 - MIRACLE_WORKER_POWERS.reduce((n, p) => n + o.source.powerUses[p.id] * p.cost, 0)) return false;
    const m = initialModel(o.source, o.playerSpiritualityBefore, o.enemySpiritualityBefore);
    const all = [...o.playerActions.map(a => ({ actor: 'PLAYER', action: a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY', action: a }))]
      .sort((a, b) => a.action.order - b.action.order);
    for (const [index, item] of all.entries()) {
      const a = item.action;
      if (a.order !== index || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 ||
        !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      let cursor = 0;
      const random: ActionRandomStream = { seed: 'mw2-outcome-replay', get cursor() { return cursor; },
        nextInt(min, max) { const roll = a.rolls[cursor++]; if (roll === undefined || roll < min || roll > max) throw new Error('invalid replay roll'); return roll; } };
      let expected: MiracleWorkerPlayerAction | MiracleWorkerEnemyAction;
      if (item.actor === 'PLAYER') {
        const x = a as MiracleWorkerPlayerAction;
        if (![...ABILITIES.map(z => z.id), 'diviner.s7.damage-transfer'].includes(x.id)) return false;
        expected = playerAction(o.source, m, x.id, x.physicalFactor, index, random);
      } else {
        const x = a as MiracleWorkerEnemyAction;
        if (![...MIRACLE_WORKER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(x.planned)) return false;
        expected = enemyAction(m, x.planned, x.physicalFactor, index);
      }
      if (cursor !== a.rolls.length || stableStringify(expected) !== stableStringify(a)) return false;
    }
    return m.playerSpirituality === o.playerSpiritualityAfter && m.playerMind === o.playerMindAfter && m.enemySpirituality === o.enemySpirituality &&
      m.probabilityUses === o.probabilityUses && m.sceneUses === o.sceneUses && m.winChanceBonus === o.winChanceBonus && m.sceneSourceId === o.sceneSourceId &&
      stableStringify(m.powerUses) === stableStringify(o.powerUses) && stableStringify(m.supplies) === stableStringify(o.suppliesAfter) &&
      stableStringify(m.playerInjuries) === stableStringify(o.playerInjuriesBeforeConsequence) && stableStringify(m.damageTransfers) === stableStringify(o.damageTransfersAfter);
  } catch { return false; }
}
