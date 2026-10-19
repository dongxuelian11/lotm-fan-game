import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { advanceSilverKnightLifeClock } from './life.js';
import { currentSilverKnightBody, hasSilverKnightDisputeOpponent, silverKnightEnemyMaxSpirituality, silverKnightEnemyTier, silverKnightHuntDefinition,
  SILVER_KNIGHT_SPECIES, SILVER_KNIGHT_TARGET_ID, type SilverKnightActualEnemyIntent, type SilverKnightBattleResources, type SilverKnightEnemyIntent, type SilverKnightSpeciesId } from './encounter.js';

export const SILVER_KNIGHT_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const SILVER_KNIGHT_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const silverKnightActionCount = pyromaniacActionCount;
export const silverKnightEnemyActionCount = pyromaniacActionCount;
const DAWN = 'warrior.s6.dawn-weapon', COAT = 'warrior.s4.targeted-preparation', GUARD = 'warrior.s5.guard-state', OBSERVE = 'warrior.s4.discern-corruption', VEIL = 'warrior.s4.veil-intent';
const ARMOR = 'warrior.s3.silver-armor', LIGHT = 'warrior.s3.light-concealment', THRUST = 'warrior.s3.silver-thrust';
export type SilverKnightMoveId = typeof DAWN | typeof COAT | typeof GUARD | typeof OBSERVE | typeof VEIL | typeof ARMOR | typeof LIGHT | typeof THRUST | 'ACCIDENT';
interface Ability { id: SilverKnightMoveId; label: string; weight: number; stance: SliceStance | null }
const HUNT_ABILITIES: readonly Ability[] = [
  { id: DAWN, label: '继承晨曦剑实击：召剑4S＋每击2S，不能则原棍16/徒手12', weight: 30, stance: 'ATTACK' },
  { id: COAT, label: '同一目标原涂层实击：已观察＋原剑棍＋涂层1＋2S，否则普通次击8', weight: 15, stance: 'ATTACK' },
  { id: GUARD, label: '继承守护：减势35.1×原掌握，不抵精神震荡', weight: 20, stance: 'DEFEND' },
  { id: OBSERVE, label: '实际晨曦观察：4S/感知18，记录此原身体弱点并破一次幻幕', weight: 20, stance: 'CONTROL' },
  { id: VEIL, label: '隐藏一次进攻意图：3S/意志18，身体仍可见', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡：固定−22.5G', weight: 5, stance: null },
];
const POST_ABILITIES: readonly Ability[] = [
  { id: DAWN, label: '继承可维持晨曦剑：召剑4S＋实击2S，不能则普通原棍/徒手', weight: 30, stance: 'ATTACK' },
  { id: THRUST, label: '定点传送细剑：6S/知识18，绕普通屏障、不保证命中，高位屏护可反制', weight: 15, stance: 'ATTACK' },
  { id: ARMOR, label: '实体银甲：6S/知识18，原完整度36，实际受击消耗', weight: 20, stance: 'DEFEND' },
  { id: LIGHT, label: '借原光隐藏：6S/知识18，有原光才可用，可被辨光', weight: 20, stance: 'CONTROL' },
  { id: GUARD, label: '继承守护格挡：35.1×原掌握，不叠加无限护甲', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡：固定−22.5G', weight: 5, stance: null },
];
export const SILVER_KNIGHT_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'PRIMARY', label: '原体主攻 / 洛肯原创灵性冲击', weight: 35 },
  { id: 'DEFENSE', label: '本种有限防御 / 洛肯原屏护', weight: 25 },
  { id: 'TRAIT', label: '本种真实特性 / 洛肯辨光', weight: 15 },
  { id: 'BODY_STRIKE', label: '原身体普通攻击 / 唯一原棍', weight: 20 },
  { id: 'ACCIDENT', label: '判断失衡−22.5G', weight: 5 },
];
export const isSilverKnight = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 3;
const abilities = (sequence: number) => sequence === 4 ? HUNT_ABILITIES : POST_ABILITIES;
const tickets = (sequence: number, stance: SliceStance | null) => abilities(sequence).map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function silverKnightAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(s.progression.sequence ?? 3, stance), sum = weights.reduce((a, b) => a + b, 0);
  return abilities(s.progression.sequence ?? 3).map((a, i) => ({ id: a.id, label: stance === 'DEFEND' && [DAWN, COAT, THRUST].includes(a.id) ? '本整轮全力守护，不执行攻击槽，0消耗0贡献' : a.label, weight: weights[i]! / sum * 100 }));
}
export function drawSilverKnightAbility(random: ActionRandomStream, s: SliceState, stance: SliceStance | null): SilverKnightMoveId {
  const a = abilities(s.progression.sequence ?? 3), w = tickets(s.progression.sequence ?? 3, stance); let roll = random.nextInt(1, w.reduce((x, y) => x + y, 0));
  for (const [i, action] of a.entries()) { roll -= w[i]!; if (roll <= 0) return action.id; } throw new Error('银骑士六槽盘无效。');
}
export function drawSilverKnightEnemyAbility(random: ActionRandomStream): SilverKnightEnemyIntent {
  let roll = random.nextInt(1, 100); for (const a of SILVER_KNIGHT_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as SilverKnightEnemyIntent; } throw new Error('原生物行动盘无效。');
}
export interface SilverKnightCombatSource {
  huntBehaviorVersion?: 2;
  runId: string; revision: number; week: number; round: number; historyIndex: number; encounterId: 'SILVER_KNIGHT_HUNT' | 'SILVER_KNIGHT_DISPUTE';
  mode: 'HUNT' | 'POST'; targetId: string; speciesId: SilverKnightSpeciesId | null; targetAge: 48 | null;
  targetInstance: number; locationId: string; originLocationId: string; attemptWeek: number; startHistoryIndex: number;
  actualOriginalBody: true; independentMind: true; abilitySource: 'ORIGINAL_LIMITED_G'; distanceMetres: 2; playerPosition: 'ORIGIN';
  ordinaryExit: true; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false; enemyWeapon: 'ORIGINAL_BODY' | 'SK3-LORCAN-ROD';
  playerSequence: 4 | 3; playerMaxSpirituality: 120; enemyMaxSpirituality: number; enemyTier: number; enemyCore: 20;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemyInjuries: SliceInjury[]; enemyRisk: number;
  clubHeld: boolean; knowledge: number; perception: number; will: number; mastery: Record<string, number>;
  resources: SilverKnightBattleResources; lifeClockSeconds: number; lampSeconds: number; lightAvailable: boolean;
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const bounded = (v: number, max: number) => Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function currentSilverKnightCombatSource(s: SliceState): SilverKnightCombatSource | null {
  if (!hasSilverKnightDisputeOpponent(s)) return null;
  const e = s.silverKnight.encounter, b = currentSilverKnightBody(s)!, c = s.combat!, a = b.attempts.at(-1)!;
  const club = s.warrior.practiceClub;
  return { ...(b.huntBehaviorVersion === 2 ? { huntBehaviorVersion: 2 as const } : {}), runId: s.runId, revision: s.revision, week: s.week, round: c.round, historyIndex: s.combatHistory.length,
    encounterId: b.speciesId ? 'SILVER_KNIGHT_HUNT' : 'SILVER_KNIGHT_DISPUTE', mode: b.speciesId ? 'HUNT' : 'POST', targetId: b.id, speciesId: b.speciesId, targetAge: b.speciesId ? null : 48,
    targetInstance: b.instance, locationId: b.locationId, originLocationId: b.originLocationId, attemptWeek: a.week, startHistoryIndex: a.startHistoryIndex,
    actualOriginalBody: true, independentMind: true, abilitySource: 'ORIGINAL_LIMITED_G', distanceMetres: 2, playerPosition: 'ORIGIN', ordinaryExit: true, pursuit: false,
    thirdPartiesInArea: 0, automaticAllyImmunity: false, enemyWeapon: b.speciesId ? 'ORIGINAL_BODY' : 'SK3-LORCAN-ROD', playerSequence: s.progression.sequence as 4 | 3,
    playerMaxSpirituality: 120, enemyMaxSpirituality: silverKnightEnemyMaxSpirituality(b), enemyTier: silverKnightEnemyTier(b), enemyCore: 20,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk,
    clubHeld: s.town.clubLocation === 'HAND' || club.id === 'warrior-training-club' && club.owner === '奥斯温·布莱克特' && club.custodian === 'PLAYER' && club.location === 'player:hand',
    knowledge: s.character.coreStats.knowledge, perception: s.character.coreStats.perception, will: s.character.coreStats.will,
    mastery: Object.fromEntries([DAWN, COAT, GUARD, OBSERVE, VEIL, ARMOR, LIGHT, THRUST].map(id => [id, bounded(s.progression.mastery[id] ?? 0, 500)])),
    resources: structuredClone(b.resources), lifeClockSeconds: s.silverKnight.life.clockSeconds, lampSeconds: e.scene.lampSeconds, lightAvailable: b.speciesId !== null || e.scene.lampSeconds > 0 };
}
export interface SilverKnightCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends SilverKnightCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[]; mindDamage: number }
export interface SilverKnightPlayerAction extends ActionEvidence { id: SilverKnightMoveId; actual: SilverKnightMoveId | 'ORDINARY' | 'WAIT_BOUND' | 'RELEASE_BOUND' | 'HOLD_GUARD'; resisted: boolean }
export interface SilverKnightEnemyAction extends ActionEvidence { planned: SilverKnightEnemyIntent; actual: SilverKnightActualEnemyIntent }
export interface SilverKnightRetreatAction { order: number; paidCost: number; roll: number | null; success: boolean; boundBefore: number }
export interface SilverKnightRoundLedger {
  resources: SilverKnightBattleResources; playerS: number; playerM: number; paidGuard: boolean; armorIntegrity: number; hidden: boolean;
  veilReady: boolean; mistReady: boolean; boundSlots: number; frostPending: boolean; barrierReady: boolean; discernReady: boolean;
}
export interface SilverKnightRoundContext {
  source: SilverKnightCombatSource; stance: SliceStance; finished: boolean; liveState: string; ledger: SilverKnightRoundLedger;
  playerActions: SilverKnightPlayerAction[]; enemyActions: SilverKnightEnemyAction[]; retreatActions: SilverKnightRetreatAction[]; label: string; outcome: SilverKnightRoundOutcome | null;
}
const none = (label: string): SilverKnightCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
const mastery = (x: SilverKnightCombatSource, id: string) => .65 + .35 * bounded(x.mastery[id] ?? 0, 500) / 500;
function ledger(x: SilverKnightCombatSource, stance: SliceStance): SilverKnightRoundLedger {
  const paidGuard = stance === 'DEFEND' && x.playerSpirituality >= 3;
  return { resources: structuredClone(x.resources), playerS: x.playerSpirituality - (paidGuard ? 3 : 0), playerM: x.playerMind, paidGuard,
    armorIntegrity: 0, hidden: false, veilReady: false, mistReady: false, boundSlots: 0, frostPending: false, barrierReady: false, discernReady: false };
}
function liveState(s: SliceState) { return stableStringify({ spirituality: s.spirituality, mind: s.mind, encounter: s.silverKnight.encounter, clock: s.silverKnight.life.clockSeconds,
  stats: s.character.coreStats, mastery: s.progression.mastery, sequence: s.progression.sequence, pathway: s.progression.pathwayId,
  club: s.town.clubLocation, practiceClub: s.warrior.practiceClub, status: s.status, city: s.world.city, event: s.activeEvent }); }
function commit(s: SliceState, r: SilverKnightRoundContext) {
  const b = currentSilverKnightBody(s)!; b.resources = structuredClone(r.ledger.resources); s.spirituality = r.ledger.playerS; s.mind = r.ledger.playerM; r.liveState = liveState(s);
}
function validRound(s: SliceState, r: SilverKnightRoundContext, source: SilverKnightCombatSource | null) {
  const b = currentSilverKnightBody(s), c = s.combat;
  return !r.finished && !!b && !!c && same(source, r.source) && r.liveState === liveState(s) && b.id === r.source.targetId &&
    c.round === r.source.round && c.encounterId === r.source.encounterId && s.runId === r.source.runId && s.revision === r.source.revision && s.week === r.source.week &&
    s.combatHistory.length === r.source.historyIndex && s.health === r.source.playerHealth && c.enemyHealth === r.source.enemyHealth && c.enemyMind === r.source.enemyMind;
}
export function beginSilverKnightCombatRound(s: SliceState, stance: SliceStance, _random?: ActionRandomStream): SilverKnightRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('银骑士战术姿态无效。');
  const source = currentSilverKnightCombatSource(s); if (!source) throw new Error('缺少同一原生物、原地点或原身体的当前战斗来源。');
  const r: SilverKnightRoundContext = { source, stance, finished: false, liveState: '', ledger: ledger(source, stance), playerActions: [], enemyActions: [], retreatActions: [], outcome: null,
    label: `${source.targetId}在${source.locationId}原位置2米外。双方1–6次行动，共同伤势及死亡；${stance === 'DEFEND' ? '整轮放弃攻击，' + (source.playerSpirituality >= 3 ? '开轮实付3S守护。' : '不足3S只普通防守。') : '承接原猎魔者身体守护×0.75G，不免精神压迫。'}` };
  commit(s, r); return r;
}
export const createSilverKnightCombatRound = beginSilverKnightCombatRound;
function check(x: SilverKnightCombatSource, ability: 'knowledge' | 'perception' | 'will', roll: () => number) {
  return roll() <= computeCheckChance({ ability, baseAbility: x[ability], difficulty: 18, modifiers: [] });
}
function executePlayer(x: SilverKnightCombatSource, l: SilverKnightRoundLedger, stance: SliceStance, id: SilverKnightMoveId, physical: number, roll: () => number): Omit<SilverKnightPlayerAction, 'order' | 'rolls'> {
  const a: Omit<SilverKnightPlayerAction, 'order' | 'rolls'> = { ...none(''), id, actual: id, paidCost: 0, physicalFactor: physical, mindDamage: 0, resisted: false };
  const pay = (n: number) => { l.playerS -= n; a.paidCost += n; };
  const ordinary = (secondary = false, why = '') => { a.actual = 'ORDINARY'; a.selfGain = (secondary ? 8 : x.clubHeld ? 16 : 12) * physical; a.label = `${why}仅实际原${x.clubHeld ? '棍' : '身体'}普通${secondary ? '次击8' : x.clubHeld ? '打击16' : '打击12'}×身体G，0S，不重抽。`; };
  const damaging = [DAWN, COAT, THRUST].includes(id);
  if (stance === 'DEFEND' && damaging) { a.actual = 'HOLD_GUARD'; a.label = '本整轮放弃攻击；此槽只守护，0额外消耗，无剑击或普通偷袭。'; return a; }
  if (l.boundSlots > 0) {
    if ([OBSERVE, VEIL, LIGHT].includes(id) && l.playerS >= 3) { pay(3); l.boundSlots = 0; a.actual = 'RELEASE_BOUND'; a.label = '本槽实付3S解开当前原影缚，仅解除不追加原技能或攻击。'; return a; }
    l.boundSlots--;
    if (damaging) { a.actual = 'WAIT_BOUND'; a.label = `实际原影缚限制本槽动作；已耗此槽等待，剩${l.boundSlots}槽，0S不攻击。`; return a; }
  }
  if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本槽判断失衡固定−22.5G，不构成攻击、不重抽。'; }
  else if (id === GUARD) { a.enemyReduction = 35.1 * mastery(x, id); a.label = '继承实际守护，有限减势35.1×原掌握G，0S；没有同伴分伤或精神免疫。'; }
  else if (id === DAWN) {
    if (physical <= 0) a.label = '当前原身体不能实击，0S不召剑。';
    else if (!l.resources.swordReady && (x.clubHeld || l.playerS < 6)) ordinary(false, x.clubHeld ? '实际原棍占手；' : '不足召剑4＋实击2S；');
    else {
      if (!l.resources.swordReady) { pay(4); l.resources.swordReady = true; l.resources.swordExpiresHistoryIndex = x.playerSequence === 4 ? x.historyIndex + 2 : null; }
      if (l.playerS < 2) ordinary(false, '现有晨曦剑不足2S实击；');
      else { pay(2); a.selfGain = 71.825 * mastery(x, id) * physical; a.label = `同一原身体维持并实击晨曦剑，实付${a.paidCost}S（召4/击2）；71.825×原掌握×身体G，无复制原武器。`; }
    }
  } else if (id === COAT) {
    const c = l.resources.coatings.find(c => c.targetId === x.targetId && c.status === 'SEALED');
    if (!c || !l.resources.weaknessObserved || (!l.resources.swordReady && !x.clubHeld) || l.playerS < 2 || physical <= 0) ordinary(true, '缺少此原目标涂层、亲见弱点、实际剑棍或2S；');
    else { pay(2); c.status = 'SPENT'; c.usedHistoryIndex = x.historyIndex; a.selfGain = 61.175 * mastery(x, id) * physical;
      a.label = `实付2S，原${c.id}一次实际涂敷并击向亲见弱点，61.175×原掌握×身体G；空件与原使用历史保留。`; }
  } else if (id === OBSERVE) {
    if (l.resources.weaknessObserved && !l.mistReady) a.label = '只复核同一原身体已知弱点，0S，不凭观察造伤。';
    else if (l.playerS < 4) a.label = '不足4S，仅普通观察，无自动弱点知识。';
    else { pay(4); const success = check(x, 'perception', roll); if (success) { l.resources.weaknessObserved = true; l.mistReady = false; }
      a.label = `晨曦辨察实付4S/感知18${success ? '成功，亲见当前原体弱点并识破当前幻幕' : '失败，不退成本'}；没有攻击、尸体或材料奖励。`; }
  } else if (id === VEIL) {
    if (l.veilReady) a.label = '本轮已有一次原意图隐藏，不叠加，0S。';
    else if (l.playerS < 3) a.label = '不足3S，原进攻意图未隐藏。';
    else { pay(3); const success = check(x, 'will', roll); l.veilReady = success;
      a.label = `实付3S/意志18${success ? '成功，下一原攻击的意图可避一次雾幕预判' : '失败'}；身体与武器仍可见，不取消岩甲或一般防御。`; }
  } else if (id === ARMOR) {
    if (l.armorIntegrity > 0) a.label = '原银甲尚存，不叠加新甲，0S。';
    else if (l.playerS < 6) { a.enemyReduction = 10; a.label = '不足6S，只作普通格挡减10G；没有免费银甲。'; }
    else { pay(6); const success = check(x, 'knowledge', roll); if (success) l.armorIntegrity = 36;
      a.label = `凝聚实体银甲实付6S/知识18${success ? '成功，原完整度36G，仅由实际身体打击消耗防护' : '失败，成本不退'}；不抵灵性震荡的精神损失，不免共同死亡。`; }
  } else if (id === LIGHT) {
    if (!x.lightAvailable) { a.enemyReduction = 10; a.label = '原灯油已耗尽、无原光可借，只普通避让减10G，0S。'; }
    else if (l.hidden) a.label = '本人已在当前原位置借光隐藏，不叠加，0S。';
    else if (l.playerS < 6) { a.enemyReduction = 10; a.label = '不足6S，只普通避让减10G，无免费隐身。'; }
    else { pay(6); const success = check(x, 'knowledge', roll); a.resisted = success && l.discernReady;
      if (a.resisted) l.discernReady = false; else if (success) l.hidden = true;
      a.label = `借原灯光实付6S/知识18${success ? a.resisted ? '成功但被原洛肯本轮已付费辨光识破' : '成功，本人仍在原位置，仅下一真实攻势×0.6G' : '失败，成本不退'}；不穿墙、不传送本人、不保证友方看不见。`; }
  } else if (id === THRUST) {
    if (l.playerS < 6 || physical <= 0) ordinary(false, '不足6S或身体不能发起细剑；');
    else { pay(6); const success = check(x, 'knowledge', roll); a.resisted = success && l.barrierReady;
      if (a.resisted) l.barrierReady = false; else if (success) a.selfGain = 76 * mastery(x, id) * physical;
      a.label = `实付6S/知识18，把有限银白细剑传送至亲见的${x.targetId}原位置，${success ? a.resisted ? '被原洛肯已付费的本轮高位屏护反制，0贡献' : '成功获得76×原掌握×身体G攻势，仍由共同轮盘判定实际伤势' : '定位失败，0贡献、成本不退'}；可绕普通薄障，不必中、不穿所有封锁，不传送本人。`; }
  }
  if (a.selfGain > 0 && damaging) {
    if (l.frostPending) { l.frostPending = false; a.selfGain *= .65; a.label += '当前有限寒缓被这一次实际攻势消耗，贡献×0.65G。'; }
    if (l.mistReady && a.actual !== 'ORDINARY') {
      if (l.veilReady) { l.veilReady = false; a.label += '已付费的一次意图隐藏避过此幻幕预判，幻幕仍可能影响下一实攻。'; }
      else { l.mistReady = false; a.selfGain = 0; a.resisted = true; a.label += '本种原幻幕抵掉这一次瞄准，原幻幕随即用尽；已付成本不退。'; }
    }
  }
  a.threatens = damaging && a.selfGain > 0; return a;
}
function executeEnemy(x: SilverKnightCombatSource, l: SilverKnightRoundLedger, stance: SliceStance, planned: SilverKnightEnemyIntent, physical: number): Omit<SilverKnightEnemyAction, 'order' | 'rolls'> {
  const a: Omit<SilverKnightEnemyAction, 'order' | 'rolls'> = { ...none(''), planned, actual: planned, paidCost: 0, physicalFactor: physical, mindDamage: 0 };
  const resources = l.resources;
  const pay = (cost: number) => { if (resources.enemySpirituality < cost) return false; resources.enemySpirituality -= cost; resources.spentSpirituality += cost; resources.powerUses[planned]++; a.paidCost = cost; return true; };
  const ordinary = () => { a.actual = 'BODY_STRIKE'; a.selfGain = (x.mode === 'POST' ? 20 : 22) * physical; a.label = `${x.targetId}资源不足或原特性已耗尽，明确使用同一原${x.mode === 'POST' ? '棍20' : '身体22'}×身体普通攻击G，0S。`; };
  if (x.speciesId === 'EMBER_WING' && resources.fireStreak >= 2) { a.actual = 'COOL_DOWN'; resources.fireStreak = 0; a.label = '原烬翼兽连续两次火冲后的本行动必须冷却，0S/0攻势，不重抽，不回复灵性。'; return a; }
  if (x.speciesId === 'EMBER_WING' && planned !== 'PRIMARY') resources.fireStreak = 0;
  if (planned === 'ACCIDENT') { resources.powerUses.ACCIDENT++; a.selfGain = -22.5; a.label = '原对手判断失衡，本槽−22.5G，没有攻击或免费恢复。'; return a; }
  if (planned === 'BODY_STRIKE') { resources.powerUses.BODY_STRIKE++; ordinary(); }
  else if (x.mode === 'POST') {
    const cost = planned === 'PRIMARY' ? 5 : 4;
    if (!pay(cost)) ordinary();
    else if (planned === 'PRIMARY') { a.selfGain = 70; a.label = '原洛肯原创有限灵性冲击实付5S，真实攻势70G。'; }
    else if (planned === 'DEFENSE') { a.enemyReduction = 40; l.barrierReady = true; a.label = '原洛肯实付4S屏护，当前减势40G，并仅抵本轮下一成功传送细剑一次；不叠加或跨轮。'; }
    else { l.hidden = false; l.discernReady = true; a.label = '原洛肯实付4S辨光，识破当前借光隐藏，并防本轮下一次成功借光一次；无额外攻击，不抵普通剑棍。'; }
  } else if (planned === 'PRIMARY') {
    const cost = x.speciesId === 'EMBER_WING' ? 8 : 6;
    if (!pay(cost)) ordinary();
    else { const gain = { ROCK_HUSK: 64, EMBER_WING: 76, MIST_ANTLER: 62, THORN_SHADOW: 64, RESONANT_BONE: 58, FROST_SPINE: 62 }[x.speciesId!];
      a.selfGain = gain * physical; if (x.speciesId === 'EMBER_WING') resources.fireStreak++;
      a.label = `${silverKnightHuntDefinition(x.speciesId!).label}原主攻实付${cost}S，${gain}×原身体G，余${resources.enemySpirituality}S。`; }
  } else if (planned === 'DEFENSE') {
    if (x.speciesId === 'ROCK_HUSK') {
      if (resources.stoneArmorCharges === 0) { a.actual = 'ORDINARY_BLOCK'; a.enemyReduction = 12; a.label = '原岩甲两层已实际裂尽，此槽只能普通格挡减12G，0S。'; }
      else if (!pay(5)) ordinary(); else { resources.stoneArmorCharges--; a.enemyReduction = 45; a.label = `原岩壳兽实付5S以一层原石甲挡势45G；该层已裂，余${resources.stoneArmorCharges}/2层，绝不刷新。`; }
    } else if (x.speciesId === 'MIST_ANTLER') {
      if (resources.mistCharges === 0 || !pay(5)) ordinary(); else { resources.mistCharges--; l.mistReady = true; a.label = `原雾角兽实付5S展开一次原幻幕，余${resources.mistCharges}/3次；只抵本轮下一次瞄准，可被实际晨曦观察识破。`; }
    } else if (!pay(4)) ordinary();
    else { a.enemyReduction = x.speciesId === 'EMBER_WING' ? 28 : x.speciesId === 'RESONANT_BONE' ? 30 : 32; a.label = `原${silverKnightHuntDefinition(x.speciesId!).label}实付4S有限护持，当前减势${a.enemyReduction}G，不造成身体伤害。`; }
  } else if (x.speciesId === 'RESONANT_BONE') {
    if (!pay(8)) ordinary(); else { a.mindDamage = Math.min(4, Math.max(0, l.playerM - 1)); l.playerM -= a.mindDamage; a.mentalPressure = a.mindDamage > 0;
      a.label = `原鸣骨兽实付8S产生有限灵性震荡，本人原精神实际−${a.mindDamage}M；本种有限G震荡最低只压到1M，不能制造昏迷。身体勇气、银甲及守护不自动免疫，精神损失保留；该槽不掷身体伤势盘。`; }
  } else if (x.speciesId === 'THORN_SHADOW') {
    if (!pay(6)) ordinary(); else { l.boundSlots = 2; a.label = '原棘影兽实付6S原影缚，约束本轮之后两槽；观察/准备或退避可另付3S解开，否则用真实行动等到期，轮末结束，无免费伤害。'; }
  } else if (x.speciesId === 'FROST_SPINE') {
    if (!pay(6)) ordinary(); else { a.selfGain = 20 * physical; if (resources.frostWardAvailable) { resources.frostWardAvailable = false; a.label = '原霜脊兽实付6S寒刺20×身体G；本人先前实购的一份原保温包实耗，抵掉这一次寒缓，攻击仍存在。'; }
      else { l.frostPending = true; a.label = '原霜脊兽实付6S寒刺20×身体G，使本人本轮下一次实际攻势×0.65；不冻结永久行动或普通出口。'; } }
  } else if (x.speciesId === 'MIST_ANTLER') {
    if (!pay(3)) ordinary(); else { a.enemyReduction = 18; a.label = '原雾角兽实付3S有限雾音牵制减18G，不直接扣精神或健康。'; }
  } else {
    if (!pay(6)) ordinary(); else { a.selfGain = (x.speciesId === 'EMBER_WING' ? 60 : 52) * physical; a.label = `原${silverKnightHuntDefinition(x.speciesId!).label}实付6S作有限${x.speciesId === 'EMBER_WING' ? '烬扑60' : '碎岩52'}×身体攻势G。`; }
  }
  if (a.selfGain > 0) {
    const guard = stance === 'DEFEND' ? l.paidGuard ? .35 : 1 : .75;
    a.selfGain *= guard; a.label += `原身体守护对本次实际身体攻势×${guard}G。`;
    if (l.hidden) { a.selfGain *= .6; l.hidden = false; a.label += '本轮一次实际借光干扰已消耗，当前攻击×0.6，本人仍在原位置。'; }
    if (l.armorIntegrity > 0) { const absorbed = Math.min(l.armorIntegrity, a.selfGain); l.armorIntegrity -= absorbed; a.selfGain -= absorbed; a.label += `原实体银甲实际承压${absorbed}，余完整度${l.armorIntegrity}，不恢复。`; }
  }
  a.threatens = a.selfGain > 0; return a;
}
function actionOrder(r: SilverKnightRoundContext) { return r.playerActions.length + r.enemyActions.length + r.retreatActions.length; }
export function resolveSilverKnightCombatAbility(s: SliceState, id: SilverKnightMoveId, physical: number, random: ActionRandomStream,
  r: SilverKnightRoundContext, source: SilverKnightCombatSource | null = r.source): SilverKnightCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || !abilities(r.source.playerSequence).some(a => a.id === id)) return none('当前原来源不符或此阶段没有该能力，0效果0消耗。');
  const rolls: number[] = [], result = executePlayer(r.source, r.ledger, r.stance, id, bounded(physical, 1), () => { const n = random.nextInt(1, 100); rolls.push(n); return n; });
  const a: SilverKnightPlayerAction = { ...result, order: actionOrder(r), rolls }; r.playerActions.push(a); commit(s, r); return a;
}
export function resolveSilverKnightEnemyAbility(s: SliceState, id: SilverKnightEnemyIntent, physical: number, _random: ActionRandomStream,
  r: SilverKnightRoundContext, source: SilverKnightCombatSource | null = r.source): SilverKnightCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || !SILVER_KNIGHT_ENEMY_ABILITY_WHEEL.some(a => a.id === id)) return none('同一原敌来源不符，0效果0消耗。');
  const a: SilverKnightEnemyAction = { ...executeEnemy(r.source, r.ledger, r.stance, id, bounded(physical, 1)), order: actionOrder(r), rolls: [] };
  r.enemyActions.push(a); commit(s, r); return a;
}
export function attemptSilverKnightRetreat(s: SliceState, r: SilverKnightRoundContext, random: ActionRandomStream): boolean {
  if (!validRound(s, r, r.source) || r.stance !== 'RETREAT' || r.retreatActions.length > 0) throw new Error('没有当前原地面退避行动。');
  const boundBefore = r.ledger.boundSlots; let paidCost = 0, roll: number | null = null;
  if (boundBefore > 0 && r.ledger.playerS >= 3) { r.ledger.playerS -= 3; paidCost = 3; r.ledger.boundSlots = 0; }
  if (r.ledger.boundSlots > 0) r.ledger.boundSlots--; else roll = random.nextInt(1, 100);
  const success = roll !== null && roll <= 50; r.retreatActions.push({ order: actionOrder(r), paidCost, roll, success, boundBefore }); commit(s, r); return success;
}
export interface SilverKnightRoundOutcome {
  targetId: string; round: number; source: SilverKnightCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  resourcesAfter: SilverKnightBattleResources; playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number;
  enemySpiritualityBefore: number; enemySpirituality: number; paidGuard: boolean; armorIntegritySpent: number;
  elapsedSeconds: 60; lifeClockSecondsAfter: number; lampSecondsAfter: number; playerPositionAfter: 'ORIGIN'; enemyDistanceAfter: 2;
  playerActions: SilverKnightPlayerAction[]; enemyActions: SilverKnightEnemyAction[]; retreatActions: SilverKnightRetreatAction[];
  temporaryEffectsEnded: true;
}
export function finishSilverKnightCombatRound(s: SliceState, r: SilverKnightRoundContext, continuing = true): SilverKnightRoundOutcome {
  const b = currentSilverKnightBody(s), c = s.combat, e = s.silverKnight.encounter;
  if (r.finished || !b || !c || c.encounterId !== r.source.encounterId || c.round !== r.source.round || b.id !== r.source.targetId || r.liveState !== liveState(s)) throw new Error('原银骑士回合已结束或原资源被改写。');
  b.enemyHealth = c.enemyHealth; b.enemyMind = c.enemyMind; b.enemyStatus = c.enemyStatus; b.enemyInjuries = structuredClone(c.enemyInjuries); b.enemyRisk = c.enemyRisk;
  if (!continuing || b.resources.swordExpiresHistoryIndex !== null && b.resources.swordExpiresHistoryIndex <= r.source.historyIndex) { b.resources.swordReady = false; b.resources.swordExpiresHistoryIndex = null; }
  if (r.source.mode === 'POST') e.scene.lampSeconds = Math.max(0, e.scene.lampSeconds - 60);
  advanceSilverKnightLifeClock(s, 60); r.finished = true;
  r.outcome = { targetId: b.id, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, enemyInjuriesAfter: structuredClone(c.enemyInjuries), enemyRiskAfter: c.enemyRisk,
    resourcesAfter: structuredClone(b.resources), playerSpiritualityBefore: r.source.playerSpirituality, playerSpiritualityAfter: s.spirituality,
    playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.source.resources.enemySpirituality, enemySpirituality: b.resources.enemySpirituality,
    paidGuard: r.ledger.paidGuard, armorIntegritySpent: r.playerActions.filter(a => a.id === ARMOR && a.paidCost === 6 && a.rolls[0] !== undefined && a.rolls[0] <= computeCheckChance({ ability: 'knowledge', baseAbility: r.source.knowledge, difficulty: 18, modifiers: [] })).length * 36 - r.ledger.armorIntegrity,
    elapsedSeconds: 60, lifeClockSecondsAfter: s.silverKnight.life.clockSeconds, lampSecondsAfter: e.scene.lampSeconds, playerPositionAfter: 'ORIGIN', enemyDistanceAfter: 2,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions), retreatActions: structuredClone(r.retreatActions), temporaryEffectsEnded: true };
  return structuredClone(r.outcome);
}
export function silverKnightRoundOutcome(r: SilverKnightRoundContext): SilverKnightRoundOutcome { if (!r.outcome) throw new Error('先结束原回合。'); return structuredClone(r.outcome); }
export function projectSilverKnightCombat(s: SliceState) {
  const b = currentSilverKnightBody(s), x = currentSilverKnightCombatSource(s);
  return { enemyName: b ? b.speciesId ? `${silverKnightHuntDefinition(b.speciesId).label}（原创G强生物）` : '洛肯·里德（48岁，原创有限G3）' : '', targetId: b?.id ?? null,
    enemyMind: b?.enemyMind ?? null, enemySpirituality: b?.resources.enemySpirituality ?? null, powerUses: b ? { ...b.resources.powerUses } : null,
    scene: b ? { ...s.silverKnight.encounter.scene } : null, originalExit: true, pursuit: false, distanceMetres: 2, automaticAllyImmunity: false, source: x,
    summary: '沿原猎魔者45/20/25/10核心、1250/底125、S120；仅继续轮回12S。双方1–6行动10/15/25/25/15/10。原六槽30/15/20/20/10/5，晋前用原观察/涂层/守护/意图隐藏，晋后换为银甲/借光/有限传送剑，普通回退须实际原剑棍或徒手。只有真实仍有正贡献的攻击威胁共同身体伤势；原骨鸣独立实扣精神，无恐惧自动免疫。' };
}
function validResources(x: SilverKnightCombatSource, r: SilverKnightBattleResources): boolean {
  return !!r && integer(r.enemySpirituality, 0, x.enemyMaxSpirituality) && integer(r.spentSpirituality, 0, x.enemyMaxSpirituality) &&
    r.enemySpirituality + r.spentSpirituality === x.enemyMaxSpirituality && !!r.powerUses &&
    same(Object.keys(r.powerUses).sort(), ['PRIMARY', 'DEFENSE', 'TRAIT', 'BODY_STRIKE', 'ACCIDENT'].sort()) && Object.values(r.powerUses).every(n => integer(n)) &&
    integer(r.stoneArmorCharges, 0, x.speciesId === 'ROCK_HUSK' ? 2 : 0) && integer(r.mistCharges, 0, x.speciesId === 'MIST_ANTLER' ? 3 : 0) &&
    integer(r.fireStreak, 0, x.speciesId === 'EMBER_WING' ? 2 : 0) && typeof r.frostWardAvailable === 'boolean' && typeof r.weaknessObserved === 'boolean' && typeof r.swordReady === 'boolean' &&
    (r.swordReady ? x.playerSequence === 3 ? r.swordExpiresHistoryIndex === null : integer(r.swordExpiresHistoryIndex, x.historyIndex, x.historyIndex + 2) : r.swordExpiresHistoryIndex === null) &&
    (r.preparationWeek === null ? r.preparationCostPence === 0 && r.coatings.length === 0 && !r.frostWardAvailable : integer(r.preparationWeek, 1, x.week) && r.preparationCostPence === 120 && r.coatings.length === 2) &&
    Array.isArray(r.coatings) && r.coatings.every((c, i) => c.id === `${x.targetId}-COATING-${i + 1}` && c.targetId === x.targetId &&
      (c.status === 'SEALED' ? c.usedHistoryIndex === null : c.status === 'SPENT' && integer(c.usedHistoryIndex, 0, x.historyIndex)));
}
/** Replay costs, ordered failed checks, individual original budgets and actual effects. */
export function validateSilverKnightRoundOutcome(v: unknown): v is SilverKnightRoundOutcome {
  try {
    const o = v as SilverKnightRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || !integer(x.revision) || !integer(x.week, 1) || x.attemptWeek !== x.week || !integer(x.round, 1) ||
        !integer(x.startHistoryIndex) || x.historyIndex !== x.startHistoryIndex + x.round - 1 || o.round !== x.round || o.targetId !== x.targetId ||
        !['HUNT', 'POST'].includes(x.mode) || ![3, 4].includes(x.playerSequence) ||
        (x.mode === 'HUNT' ? x.encounterId !== 'SILVER_KNIGHT_HUNT' || x.playerSequence !== 4 || x.targetAge !== null || !SILVER_KNIGHT_SPECIES.includes(x.speciesId!) ||
           x.targetId !== `SK3-HUNT-${x.speciesId}-${x.targetInstance}` || x.enemyTier !== 1100 || x.enemyMaxSpirituality !== silverKnightHuntDefinition(x.speciesId!).maxSpirituality
          : x.encounterId !== 'SILVER_KNIGHT_DISPUTE' || x.playerSequence !== 3 || x.speciesId !== null || x.targetId !== SILVER_KNIGHT_TARGET_ID || x.targetAge !== 48 || x.enemyTier !== 1250 || x.enemyMaxSpirituality !== 120) ||
        x.actualOriginalBody !== true || x.independentMind !== true || x.abilitySource !== 'ORIGINAL_LIMITED_G' || x.playerPosition !== 'ORIGIN' || x.distanceMetres !== 2 ||
        x.ordinaryExit !== true || x.pursuit !== false || x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || x.playerMaxSpirituality !== 120 || x.enemyCore !== 20 ||
        !integer(x.targetInstance, 1) || x.enemyWeapon !== (x.mode === 'HUNT' ? 'ORIGINAL_BODY' : 'SK3-LORCAN-ROD') ||
        ![x.playerHealth, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) || !integer(x.playerMind, 0, 100) || !integer(x.playerSpirituality, 0, 120) ||
        ![x.knowledge, x.perception, x.will].every(n => integer(n, 0, 500)) || typeof x.clubHeld !== 'boolean' || !integer(x.lifeClockSeconds) ||
        !Array.isArray(x.enemyInjuries) || !integer(x.enemyRisk) || !integer(o.enemyHealth, 0, x.enemyHealth) || !integer(o.playerHealthAfter, 0, x.playerHealth) || o.enemyMind !== x.enemyMind ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' ||
        o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.resources.enemySpirituality || o.enemySpirituality !== o.resourcesAfter.enemySpirituality ||
        o.elapsedSeconds !== 60 || o.lifeClockSecondsAfter !== x.lifeClockSeconds + 60 || o.temporaryEffectsEnded !== true || o.playerPositionAfter !== 'ORIGIN' || o.enemyDistanceAfter !== 2 ||
        !integer(x.lampSeconds, 0, 180) || x.lightAvailable !== (x.mode === 'HUNT' || x.lampSeconds > 0) || o.lampSecondsAfter !== (x.mode === 'POST' ? Math.max(0, x.lampSeconds - 60) : x.lampSeconds) ||
        !validResources(x, x.resources) || !validResources(x, o.resourcesAfter) ||
        !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || !Array.isArray(o.retreatActions) || o.playerActions.length > 6 || o.enemyActions.length > 6 || o.retreatActions.length > 1 ||
        (o.stance !== 'RETREAT' && o.retreatActions.length !== 0) || (o.stance === 'RETREAT' && o.playerActions.length !== 0)) return false;
    if (Object.hasOwn(x, 'huntBehaviorVersion') && (x.huntBehaviorVersion !== 2 || x.mode !== 'HUNT' || o.enemyStatus === 'SURRENDERED')) return false;
    const l = ledger(x, o.stance); if (o.paidGuard !== l.paidGuard) return false;
    const actions = [...o.playerActions.map(a => ({ actor: 'PLAYER' as const, a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY' as const, a })), ...o.retreatActions.map(a => ({ actor: 'RETREAT' as const, a }))].sort((a, b) => a.a.order - b.a.order);
    let armorCreated = 0;
    for (const [index, entry] of actions.entries()) {
      if (entry.a.order !== index) return false;
      if (entry.actor === 'RETREAT') {
        const a = entry.a; if (a.boundBefore !== l.boundSlots) return false;
        const expectedPay = l.boundSlots > 0 && l.playerS >= 3 ? 3 : 0;
        if (a.paidCost !== expectedPay) return false;
        if (expectedPay) { l.playerS -= 3; l.boundSlots = 0; }
        if (l.boundSlots > 0) { l.boundSlots--; if (a.roll !== null || a.success) return false; }
        else if (!integer(a.roll, 1, 100) || a.success !== (a.roll <= 50)) return false;
        if (a.success && index !== actions.length - 1) return false; continue;
      }
      const a = entry.a; if (!Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      let expected: Omit<SilverKnightPlayerAction, 'order' | 'rolls'> | Omit<SilverKnightEnemyAction, 'order' | 'rolls'>;
      if (entry.actor === 'PLAYER') {
        if (!abilities(x.playerSequence).some(b => b.id === entry.a.id)) return false;
        let cursor = 0; const beforeArmor = l.armorIntegrity;
        expected = executePlayer(x, l, o.stance, entry.a.id, a.physicalFactor, () => { const v = a.rolls[cursor++]; if (v === undefined) throw new Error('Missing actual check'); return v; });
        if (cursor !== a.rolls.length) return false;
        if (l.armorIntegrity > beforeArmor) armorCreated += l.armorIntegrity - beforeArmor;
      } else {
        if (!SILVER_KNIGHT_ENEMY_ABILITY_WHEEL.some(b => b.id === entry.a.planned) || a.rolls.length !== 0) return false;
        expected = executeEnemy(x, l, o.stance, entry.a.planned, a.physicalFactor);
      }
      const { order: _order, rolls: _rolls, ...actual } = a; if (!same(expected, actual)) return false;
    }
    if (!o.continuing || l.resources.swordExpiresHistoryIndex !== null && l.resources.swordExpiresHistoryIndex <= x.historyIndex) { l.resources.swordReady = false; l.resources.swordExpiresHistoryIndex = null; }
    if ((!o.playerActions.some(a => a.threatens) && (o.enemyHealth !== x.enemyHealth || o.enemyStatus !== 'RESISTING' || !same(o.enemyInjuriesAfter, x.enemyInjuries))) ||
        (!o.enemyActions.some(a => a.threatens) && o.playerHealthAfter !== x.playerHealth)) return false;
    return same(l.resources, o.resourcesAfter) && l.playerS === o.playerSpiritualityAfter && l.playerM === o.playerMindAfter &&
      o.armorIntegritySpent === armorCreated - l.armorIntegrity && integer(o.enemyRiskAfter) && Array.isArray(o.enemyInjuriesAfter);
  } catch { return false; }
}
