import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasSilverKnightOldPractice, hasSilverKnightRitualLock } from './index.js';
import { hasSilverKnightLifeLock } from './life.js';
import { validateSilverKnightRoundOutcome } from './combat.js';

/** All six species, sites, budgets and individual identities below are original limited G. */
export const SILVER_KNIGHT_SPECIES = ['ROCK_HUSK', 'EMBER_WING', 'MIST_ANTLER', 'THORN_SHADOW', 'RESONANT_BONE', 'FROST_SPINE'] as const;
export type SilverKnightSpeciesId = typeof SILVER_KNIGHT_SPECIES[number];
export const SILVER_KNIGHT_TARGET_ID = 'SK3-LORCAN' as const;
export const SILVER_KNIGHT_ALTAR_SLOTS = ['NORTH', 'NORTH_EAST', 'SOUTH_EAST', 'SOUTH', 'SOUTH_WEST', 'NORTH_WEST'] as const;
export const SILVER_KNIGHT_HUNTS = [
  { speciesId: 'ROCK_HUSK', label: '岩壳兽', locationId: 'SK3-QUARRY-RIDGE', maxSpirituality: 90, trait: '原岩甲仅2次，每次5S减势45；裂尽后只能普通格挡。石槌6S/64G，碎岩6S/52G。' },
  { speciesId: 'EMBER_WING', label: '烬翼兽', locationId: 'SK3-QUARRY-KILN', maxSpirituality: 120, trait: '火冲8S/76G，连续两次后下一原行动必须冷却；翼护4S减28，烬扑6S/60G。' },
  { speciesId: 'MIST_ANTLER', label: '雾角兽', locationId: 'SK3-QUARRY-MIST', maxSpirituality: 100, trait: '幻幕最多3次、每次5S，只抵下一次实际瞄准；晨曦辨察可破。角击6S/62G，雾音3S减18。' },
  { speciesId: 'THORN_SHADOW', label: '棘影兽', locationId: 'SK3-QUARRY-ARCH', maxSpirituality: 100, trait: '影缚6S约束本轮后续两槽；观察/准备槽或退避可实付3S解开，也可用原行动等到期。棘击6S/64G，根护4S减32。' },
  { speciesId: 'RESONANT_BONE', label: '鸣骨兽', locationId: 'SK3-QUARRY-HALL', maxSpirituality: 110, trait: '骨鸣8S直接精神压迫至多4M，本种有限G震荡最低只压到1M，不能制造昏迷；身体守护不自动免疫，不凭精神技掷身体伤势。骨击6S/58G，骨护4S减30。' },
  { speciesId: 'FROST_SPINE', label: '霜脊兽', locationId: 'SK3-QUARRY-CISTERN', maxSpirituality: 80, trait: '寒刺6S/20G并使本轮下一实攻×0.65，目标准备中的一份原保温包可抵一次寒缓。脊击6S/62G，冰护4S减32。' },
] as const satisfies readonly { speciesId: SilverKnightSpeciesId; label: string; locationId: string; maxSpirituality: number; trait: string }[];
export type SilverKnightEnemyIntent = 'PRIMARY' | 'DEFENSE' | 'TRAIT' | 'BODY_STRIKE' | 'ACCIDENT';
export type SilverKnightActualEnemyIntent = SilverKnightEnemyIntent | 'COOL_DOWN' | 'ORDINARY_BLOCK';
export interface SilverKnightCoating { id: string; targetId: string; status: 'SEALED' | 'SPENT'; usedHistoryIndex: number | null }
export interface SilverKnightBattleResources {
  enemySpirituality: number; powerUses: Record<SilverKnightEnemyIntent, number>; spentSpirituality: number;
  stoneArmorCharges: number; mistCharges: number; fireStreak: number; frostWardAvailable: boolean;
  coatings: SilverKnightCoating[]; preparationWeek: number | null; preparationCostPence: number;
  weaknessObserved: boolean; swordReady: boolean; swordExpiresHistoryIndex: number | null;
}
export interface SilverKnightTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface SilverKnightAttempt { week: number; startHistoryIndex: number; terminal: SilverKnightTerminal | null }
export interface SilverKnightBody {
  /** Omitted means the historical surrender rule; newly investigated v2 wild bodies keep resisting while alive. */
  huntBehaviorVersion?: 2;
  id: string; speciesId: SilverKnightSpeciesId | null; instance: number; locationId: string; originLocationId: string;
  source: 'ORIGINAL_LIMITED_G'; status: 'UNSEEN' | 'TRACKED' | 'FIGHTING' | 'RETREATED' | 'DEAD' | 'SURRENDERED' | 'LEFT';
  appearedWeek: number | null; investigatedWeek: number | null;
  enemyHealth: number; enemyMind: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  resources: SilverKnightBattleResources; attempts: SilverKnightAttempt[]; remainsId: string | null;
}
export interface SilverKnightHuntRemains {
  id: string; instanceId: string; speciesId: SilverKnightSpeciesId; killedBy: 'PLAYER'; outcome: 'ENEMY_DEAD';
  killedWeek: number; collectedWeek: number; locationId: string; originLocationId: string;
  status: 'OWNER_PLAYER' | 'ALTAR' | 'CONSUMED'; slotId: string | null; consumedWeek: number | null;
}
export interface SilverKnightEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING'; activeTargetId: string | null; hunts: SilverKnightBody[]; post: SilverKnightBody;
  remains: SilverKnightHuntRemains[];
  scene: { locationId: string | null; playerPosition: 'OUTSIDE' | 'ORIGIN'; distanceMetres: 2; ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; clearanceConfirmed: boolean; lampSeconds: number };
}
export type SilverKnightEncounterCommand = { type: 'INVESTIGATE_HUNT'; speciesId: SilverKnightSpeciesId; huntBehaviorVersion?: 2 }
  | { type: 'PREPARE_HUNT' | 'HUNT_FIGHT' | 'COLLECT_REMAINS'; speciesId: SilverKnightSpeciesId }
  | { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface SilverKnightEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SilverKnightEncounterCommand }
export interface SilverKnightEncounterProjection {
  title: string; story: string; status: SilverKnightEncounterState['status']; inside: boolean; activeTargetId: string | null;
  enemy: null | { id: string; name: string; age: number | null; source: 'ORIGINAL_LIMITED_G'; speciesId: SilverKnightSpeciesId | null; health: number; mind: number;
    spirituality: number; maxSpirituality: number; status: SilverKnightBody['status']; locationId: string; tier: number; powerUses: Record<SilverKnightEnemyIntent, number>; injuries: number; coatingsRemaining: number };
  hunts: { speciesId: SilverKnightSpeciesId; label: string; instanceId: string | null; locationId: string | null; status: SilverKnightBody['status'];
    health: number | null; mind: number | null; spirituality: number | null; maxSpirituality: number | null; trait: string | null; remainsId: string | null; injuries: number | null; coatingsRemaining: number | null }[];
  remains: SilverKnightHuntRemains[]; actions: SilverKnightEncounterAction[]; facts: string[];
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
export const silverKnightHuntDefinition = (species: SilverKnightSpeciesId) => SILVER_KNIGHT_HUNTS.find(h => h.speciesId === species)!;
export const silverKnightEnemyMaxSpirituality = (b: SilverKnightBody) => b.speciesId ? silverKnightHuntDefinition(b.speciesId).maxSpirituality : 120;
export const silverKnightEnemyTier = (b: SilverKnightBody) => b.speciesId ? 1100 : 1250;
function body(speciesId: SilverKnightSpeciesId | null, instance: number, week: number | null): SilverKnightBody {
  const def = speciesId ? silverKnightHuntDefinition(speciesId) : null;
  const location = def ? `${def.locationId}${instance === 1 ? '' : `-SIGHTING-${instance}`}` : 'SK3-LORCAN-COURT';
  return { id: speciesId ? `SK3-HUNT-${speciesId}-${instance}` : SILVER_KNIGHT_TARGET_ID, speciesId, instance, locationId: location, originLocationId: location,
    source: 'ORIGINAL_LIMITED_G', status: 'UNSEEN', appearedWeek: week, investigatedWeek: null, enemyHealth: 100, enemyMind: 100,
    enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, resources: { enemySpirituality: def?.maxSpirituality ?? 120,
      powerUses: { PRIMARY: 0, DEFENSE: 0, TRAIT: 0, BODY_STRIKE: 0, ACCIDENT: 0 }, spentSpirituality: 0,
      stoneArmorCharges: speciesId === 'ROCK_HUSK' ? 2 : 0, mistCharges: speciesId === 'MIST_ANTLER' ? 3 : 0, fireStreak: 0, frostWardAvailable: false,
      coatings: [], preparationWeek: null, preparationCostPence: 0, weaknessObserved: false, swordReady: false, swordExpiresHistoryIndex: null }, attempts: [], remainsId: null };
}
export function createSilverKnightEncounterState(): SilverKnightEncounterState {
  return { status: 'AVAILABLE', activeTargetId: null, hunts: SILVER_KNIGHT_SPECIES.map(id => body(id, 1, null)), post: body(null, 1, null), remains: [],
    scene: { locationId: null, playerPosition: 'OUTSIDE', distanceMetres: 2, ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, clearanceConfirmed: false, lampSeconds: 180 } };
}
export const createSilverKnightEncounter = createSilverKnightEncounterState;
export const currentSilverKnightHunt = (s: SliceState, species: SilverKnightSpeciesId): SilverKnightBody => s.silverKnight.encounter.hunts.filter(h => h.speciesId === species).at(-1)!;
export function currentSilverKnightBody(s: SliceState): SilverKnightBody | null {
  const e = s.silverKnight.encounter; return e.activeTargetId === e.post.id ? e.post : e.hunts.find(h => h.id === e.activeTargetId) ?? null;
}
export const hasSilverKnightEncounterLock = (s: SliceState) => s.silverKnight.encounter.status !== 'AVAILABLE';
export const isInsideSilverKnightEncounter = hasSilverKnightEncounterLock;
export function validateSilverKnightEncounterCommand(v: unknown): v is SilverKnightEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  if (c.type === 'INVESTIGATE_HUNT' && Object.hasOwn(c, 'huntBehaviorVersion'))
    return Object.keys(c).length === 3 && c.huntBehaviorVersion === 2 && SILVER_KNIGHT_SPECIES.includes(c.speciesId as SilverKnightSpeciesId);
  return ['INVESTIGATE_HUNT', 'PREPARE_HUNT', 'HUNT_FIGHT', 'COLLECT_REMAINS'].includes(String(c.type))
    ? Object.keys(c).length === 2 && SILVER_KNIGHT_SPECIES.includes(c.speciesId as SilverKnightSpeciesId)
    : Object.keys(c).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String(c.type));
}
export const isSilverKnightEncounterCommand = validateSilverKnightEncounterCommand;
function otherSceneOpen(s: SliceState) { return hasSilverKnightOldPractice(s) || hasSilverKnightRitualLock(s) || hasSilverKnightLifeLock(s); }
const stage = (s: SliceState) => s.progression.pathwayId === 'warrior' && [4, 3].includes(s.progression.sequence ?? -1);
function replacementEligible(s: SliceState, b: SilverKnightBody) {
  const r = s.silverKnight.encounter.remains.find(r => r.id === b.remainsId);
  const attempt = b.attempts.at(-1);
  return r?.status === 'CONSUMED' && r.consumedWeek !== null && s.week > r.consumedWeek ||
    b.status === 'SURRENDERED' && attempt?.terminal?.outcome === 'ENEMY_SURRENDERED' && s.week > attempt.week;
}
export function blockSilverKnightEncounter(s: SliceState, c: SilverKnightEncounterCommand): string | null {
  if (!validateSilverKnightEncounterCommand(c)) return '银骑士遭遇命令无效。';
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着，且在战士序列4或3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.silverKnight.guidanceKnown) return '先取得奥斯里克的实际指导。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原矿区或原院。';
  if (otherSceneOpen(s)) return '先沿原路结束当前祭坛、会见或原物实践。';
  const e = s.silverKnight.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && e.scene.ordinaryExit === 'OPEN' ? null : '须本人确在原院，原普通出口畅通。';
  if (s.mind <= 0 || s.actionsRemaining < 1) return '需要清醒并保有1行动。';
  if ('speciesId' in c) {
    if (s.progression.sequence !== 4) return '六种仪式亲猎在晋升前由原猎魔者本人完成。';
    if (e.status !== 'AVAILABLE') return '先从当前原院普通离开。';
    const b = currentSilverKnightHunt(s, c.speciesId);
    if (c.type === 'INVESTIGATE_HUNT') return b.status === 'UNSEEN' || replacementEligible(s, b) ? null
      : b.status === 'DEAD' ? '保留原尸与原遗骸；只有遗骸实际消耗后的下一真实周才有新目击，可再花行动调查新个体。' : b.status === 'SURRENDERED' ? '这周须保留同一活着的投降者；下一真实周才可调查另一原个体，不得补刀或凭投降取遗骸。' : '此原个体已调查，不能刷新它的资源。';
    if (c.type === 'COLLECT_REMAINS') {
      const t = b.attempts.at(-1)?.terminal;
      return b.status === 'DEAD' && b.enemyHealth === 0 && t?.outcome === 'ENEMY_DEAD' && b.remainsId === null ? null : '只能采集本人本场真正杀死、尚未采过的同一原尸；投降、购买与旧哨卫不计。';
    }
    if (!['TRACKED', 'RETREATED'].includes(b.status) || b.enemyStatus !== 'RESISTING') return '先实查仍活着、仍抵抗的原个体；死亡或投降者不再出战。';
    if (c.type === 'PREPARE_HUNT') return b.resources.preparationWeek !== null ? '本原个体的两份涂层已备，不能补货。' : s.cash < 120 ? '两份原目标专用涂层与一份保温包需120便士。' : null;
    return null;
  }
  if (s.progression.sequence !== 3 || s.silverKnight.promotionWeek === null) return '先实际晋升银骑士，洛肯才是独立晋后遭遇。';
  if (c.type === 'ENCOUNTER_TALK') return e.status === 'AVAILABLE' && ['UNSEEN', 'RETREATED'].includes(e.post.status) ? s.actionsRemaining >= 2 ? null : '交谈需1行动，另留明确开战1行动。' : '同一原洛肯已有结局，不复活或补充资源。';
  return e.status === 'READY' && e.activeTargetId === SILVER_KNIGHT_TARGET_ID ? null : '先到原净空院实际交谈并核实原洛肯、原棍与出口。';
}
export const silverKnightEncounterReason = blockSilverKnightEncounter;
function openCombat(s: SliceState, b: SilverKnightBody) {
  const e = s.silverKnight.encounter; e.status = 'FIGHTING'; e.activeTargetId = b.id; b.status = 'FIGHTING';
  e.scene.locationId = b.locationId; e.scene.playerPosition = 'ORIGIN'; e.scene.clearanceConfirmed = true;
  b.attempts.push({ week: s.week, startHistoryIndex: s.combatHistory.length, terminal: null });
  s.combat = { encounterId: b.speciesId ? 'SILVER_KNIGHT_HUNT' : 'SILVER_KNIGHT_DISPUTE', round: 1, enemyHealth: b.enemyHealth,
    enemyMind: b.enemyMind, enemyInjuries: structuredClone(b.enemyInjuries), enemyRisk: b.enemyRisk, enemyStatus: b.enemyStatus, lastRound: null };
}
export function applySilverKnightEncounterCommand(s: SliceState, c: SilverKnightEncounterCommand, ctx: SeerContext): void {
  const reason = blockSilverKnightEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.silverKnight.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.post.status = 'LEFT'; e.status = 'AVAILABLE'; e.activeTargetId = null; e.scene.playerPosition = 'OUTSIDE'; e.scene.locationId = null;
    ctx.note('沿原院普通出口离开', '本人实际普通离开；洛肯与自己的原棍留原处，资源、旧伤与所有旧途径人物历史不变。'); return; }
  s.actionsRemaining--;
  if ('speciesId' in c) {
    let b = currentSilverKnightHunt(s, c.speciesId);
    if (c.type === 'INVESTIGATE_HUNT') {
      if (b.status !== 'UNSEEN') { b = body(c.speciesId, b.instance + 1, s.week); e.hunts.push(b); }
      if (c.huntBehaviorVersion === 2) b.huntBehaviorVersion = 2;
      b.status = 'TRACKED'; b.appearedWeek ??= s.week; b.investigatedWeek = s.week;
      ctx.note('实查原创强生物的原身体与原地点', `本人实付1行动沿原路调查，核实${b.id}在${b.locationId}，H100/M100/S${b.resources.enemySpirituality}。${silverKnightHuntDefinition(c.speciesId).trait} 普通地面出口开放，无追击；不会把原死者复活。${b.huntBehaviorVersion === 2 ? ' 本原体采用G猎物行为v2：重伤仍可能继续真实抵抗，保留伤势和消耗；本人可尝试普通撤离，只有真实死亡才可采遗骸。' : ''}`); return;
    }
    if (c.type === 'PREPARE_HUNT') {
      s.cash -= 120; b.resources.preparationWeek = s.week; b.resources.preparationCostPence = 120; b.resources.frostWardAvailable = true;
      b.resources.coatings = [1, 2].map(n => ({ id: `${b.id}-COATING-${n}`, targetId: b.id, status: 'SEALED', usedHistoryIndex: null }));
      ctx.note('准备同一原目标的两份有限涂层', `实付1行动120便士，取得两份只对${b.id}有效的G涂层及一份普通保温包；须现场观察、实持原剑棍并付2S才可实击。旧灰烬哨卫剩余涂层不移动。`); return;
    }
    if (c.type === 'COLLECT_REMAINS') {
      const t = b.attempts.at(-1)!.terminal!, id = `${b.id}-REMAINS`;
      e.remains.push({ id, instanceId: b.id, speciesId: c.speciesId, killedBy: 'PLAYER', outcome: 'ENEMY_DEAD', killedWeek: b.attempts.at(-1)!.week,
        collectedWeek: s.week, locationId: 'PLAYER', originLocationId: b.originLocationId, status: 'OWNER_PLAYER', slotId: null, consumedWeek: null });
      b.remainsId = id;
      ctx.note('本人从原尸采集唯一遗骸', `实付1行动，沿原路到${b.locationId}，从本人战斗历史${t.historyIndex}真实杀死的${b.id}采得${id}并带回；原尸其余部分仍留原址，不复制物品。`); return;
    }
    openCombat(s, b); ctx.note('本人接近原强生物并开战', `实付1行动，实际到${b.locationId}与同一${b.id}相距2米。保留原H/M/S、伤势与库存；不刷新，同用共同伤势、死亡与地面退避。`); return;
  }
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'READY'; e.activeTargetId = e.post.id; e.post.status = 'TRACKED'; e.post.appearedWeek ??= s.week; e.post.investigatedWeek ??= s.week;
    e.scene.locationId = e.post.locationId; e.scene.playerPosition = 'ORIGIN'; e.scene.clearanceConfirmed = true;
    ctx.note('与原洛肯实际交谈', '原48岁洛肯·里德SK3-LORCAN在净空院持唯一原棍SK3-LORCAN-ROD；原创G3等效H100/M100/S120，冲击5S/70、屏护4S减40并挡一次传送剑、辨光4S破本轮借光。原灯仅180秒灯油，原普通出口开放。尚未替本人开战。'); return;
  }
  openCombat(s, e.post); ctx.note('承担原洛肯的真实冲突', '只由本人、原洛肯及各自原物实际交战；普通退出与双方真实伤亡保留。');
}
export const applySilverKnightEncounter = applySilverKnightEncounterCommand;
export function hasSilverKnightDisputeOpponent(s: SliceState): boolean {
  const e = s.silverKnight?.encounter, c = s.combat; if (!e || !c) return false;
  const b = currentSilverKnightBody(s), a = b?.attempts.at(-1);
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    s.silverKnight.guidanceKnown && e.status === 'FIGHTING' && !!b && b.status === 'FIGHTING' && b.enemyStatus === 'RESISTING' && !!a && a.week === s.week && a.terminal === null &&
    (b.speciesId ? s.progression.sequence === 4 && c.encounterId === 'SILVER_KNIGHT_HUNT' : s.progression.sequence === 3 && s.silverKnight.promotionWeek !== null && c.encounterId === 'SILVER_KNIGHT_DISPUTE') &&
    c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.scene.locationId === b.locationId && e.scene.playerPosition === 'ORIGIN' &&
    e.scene.clearanceConfirmed && e.scene.ordinaryExit === 'OPEN' && e.scene.thirdPartiesInArea === 0 && !e.scene.pursuit &&
    c.enemyHealth === b.enemyHealth && c.enemyMind === b.enemyMind && same(c.enemyInjuries, b.enemyInjuries) && c.enemyRisk === b.enemyRisk &&
    integer(c.round, 1) && s.combatHistory.length - a.startHistoryIndex === c.round - 1 && integer(b.resources.enemySpirituality, 0, silverKnightEnemyMaxSpirituality(b));
}
export const hasSilverKnightHuntOpponent = (s: SliceState) => hasSilverKnightDisputeOpponent(s) && currentSilverKnightBody(s)?.speciesId !== null;
export function settleSilverKnightEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void) {
  if (outcome === 'CONTINUE') return;
  const e = s.silverKnight.encounter, c = s.combat, b = currentSilverKnightBody(s), a = b?.attempts.at(-1), last = c?.lastRound, o = last?.silverKnightOutcome;
  if (!b || !a || a.terminal || !c || !last || !validateSilverKnightRoundOutcome(o) || o.continuing || e.status !== 'FIGHTING' ||
      o.targetId !== b.id || o.source.startHistoryIndex !== a.startHistoryIndex || !same(last, s.combatHistory.at(-1)) ||
      c.round !== last.round + 1 || s.combatHistory.length - a.startHistoryIndex !== last.round ||
      o.enemyHealth !== b.enemyHealth || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || !same(o.resourcesAfter, b.resources) ||
      o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      (outcome === 'PLAYER_DEAD' ? s.health !== 0 || last.winner !== 'ENEMY' : outcome === 'RETREATED' ? last.retreat !== 'SUCCESS' || s.health <= 0 :
       outcome === 'ENEMY_DEAD' ? c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || last.winner !== 'PLAYER' || last.retreat !== 'NONE' :
       outcome === 'ENEMY_SURRENDERED' ? c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || last.winner !== 'PLAYER' || last.retreat !== 'NONE' : true))
    throw new Error('真实原个体、原身体资源与已保存战斗终局不符。');
  a.terminal = { outcome: outcome as SilverKnightTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: b.enemyHealth, enemyMind: b.enemyMind, enemySpirituality: b.resources.enemySpirituality, enemyStatus: b.enemyStatus };
  b.status = outcome === 'ENEMY_DEAD' ? 'DEAD' : outcome === 'ENEMY_SURRENDERED' ? 'SURRENDERED' : 'RETREATED';
  e.status = 'AVAILABLE'; e.activeTargetId = outcome === 'PLAYER_DEAD' ? b.id : null;
  e.scene.playerPosition = outcome === 'PLAYER_DEAD' ? 'ORIGIN' : 'OUTSIDE'; e.scene.locationId = outcome === 'PLAYER_DEAD' ? b.locationId : null; s.combat = null;
  ctx.note('原身体冲突结束', `${outcome === 'PLAYER_DEAD' ? '本人原身体真实死亡，不能自动复活或采集。' : outcome === 'RETREATED' ? '本人沿原地面出口退出，同一原生物的H/M/S与伤势仍留场，下次仍是它。' : outcome === 'ENEMY_DEAD' ? '同一原个体真正死亡；须本人另花1行动到原尸采集，尚无遗骸进库存。' : '原个体仍活着并已停止抵抗；绝不将投降算亲猎死亡或允许补刀。'} 已耗资源与原物去向保存。`);
}
/** Read-only snapshots; ritual inventory is references to these original records, never a second copy. */
export function getSilverKnightHuntRemains(s: SliceState): readonly SilverKnightHuntRemains[] { return structuredClone(s.silverKnight.encounter.remains); }
export function placeSilverKnightHuntRemains(s: SliceState, remainsId: string, slotId: string): boolean {
  const e = s.silverKnight.encounter, r = e.remains.find(r => r.id === remainsId);
  if (!r || r.status !== 'OWNER_PLAYER' || slotId !== SILVER_KNIGHT_ALTAR_SLOTS[SILVER_KNIGHT_SPECIES.indexOf(r.speciesId)] || e.remains.some(r => r.status === 'ALTAR' && r.slotId === slotId)) return false;
  r.status = 'ALTAR'; r.locationId = `SK3-CHAPEL:ALTAR:${slotId}`; r.slotId = slotId; return true;
}
export function consumeSilverKnightHuntRemains(s: SliceState, remainsIds: readonly string[]): boolean {
  const e = s.silverKnight.encounter, chosen = remainsIds.map(id => e.remains.find(r => r.id === id));
  if (remainsIds.length !== 6 || new Set(remainsIds).size !== 6 || chosen.some(r => !r || r.status !== 'ALTAR') ||
      new Set(chosen.map(r => r!.speciesId)).size !== 6 || chosen.some(r => r!.slotId !== SILVER_KNIGHT_ALTAR_SLOTS[SILVER_KNIGHT_SPECIES.indexOf(r!.speciesId)])) return false;
  for (const r of chosen) { r!.status = 'CONSUMED'; r!.consumedWeek = s.week; } return true;
}
export function silverKnightEncounterActions(s: SliceState): SilverKnightEncounterAction[] {
  if (!stage(s) || !s.silverKnight.guidanceKnown) return [];
  const items: [SilverKnightEncounterCommand, string, string][] = [];
  if (s.progression.sequence === 4) for (const def of SILVER_KNIGHT_HUNTS) {
    const b = currentSilverKnightHunt(s, def.speciesId);
    if (b.status === 'UNSEEN' || replacementEligible(s, b)) items.push([{ type: 'INVESTIGATE_HUNT', speciesId: def.speciesId, huntBehaviorVersion: 2 }, `实查${def.label}${b.instance > 1 || b.remainsId || b.status === 'SURRENDERED' ? '的新目击' : '原个体'}`, '1行动']);
    else if (['TRACKED', 'RETREATED'].includes(b.status)) {
      if (b.resources.preparationWeek === null) items.push([{ type: 'PREPARE_HUNT', speciesId: def.speciesId }, `准备${def.label}专用涂层`, '1行动 · 120便士']);
      items.push([{ type: 'HUNT_FIGHT', speciesId: def.speciesId }, `亲自接近并猎战${def.label}`, '1行动 · 真实伤亡风险']);
    } else if (b.status === 'DEAD' && b.remainsId === null) items.push([{ type: 'COLLECT_REMAINS', speciesId: def.speciesId }, `从原尸采集${def.label}遗骸`, '1行动']);
  }
  else if (s.silverKnight.encounter.status === 'READY') items.push([{ type: 'ENCOUNTER_FIGHT' }, '承担原洛肯的真实冲突', '1行动 · 真实伤亡风险'], [{ type: 'LEAVE_ENCOUNTER' }, '沿原院普通出口离开', '0行动']);
  else if (['UNSEEN', 'RETREATED'].includes(s.silverKnight.encounter.post.status)) items.push([{ type: 'ENCOUNTER_TALK' }, '前往原净空院与洛肯交谈', '1行动 · 另留开战1行动']);
  return items.map(([command, label, cost]) => { const reason = blockSilverKnightEncounter(s, command); return { id: `silverKnight-${command.type}-${'speciesId' in command ? command.speciesId : 'POST'}`, label, cost, command, enabled: reason === null, reason }; });
}
export function projectSilverKnightEncounter(s: SliceState): SilverKnightEncounterProjection {
  const e = s.silverKnight.encounter, visible = (stage(s) || s.progression.pathwayId === 'warrior' && s.progression.sequence === 2) && s.silverKnight.guidanceKnown,
    b = currentSilverKnightBody(s) ?? ([3, 2].includes(s.progression.sequence ?? 0) && e.post.investigatedWeek !== null ? e.post : null);
  return { title: '六种本人亲猎与银骑士原院', story: visible ? '六种强生物及其能力、原地点与定量均为原创G。原灰烬哨卫保持投降；只有本人真实战死敌人的原尸可采集。' : '', status: e.status,
    inside: hasSilverKnightEncounterLock(s), activeTargetId: visible ? e.activeTargetId : null,
    enemy: !visible || !b ? null : { id: b.id, name: b.speciesId ? silverKnightHuntDefinition(b.speciesId).label : '洛肯·里德', age: b.speciesId ? null : 48,
      source: b.source, speciesId: b.speciesId, health: b.enemyHealth, mind: b.enemyMind, spirituality: b.resources.enemySpirituality,
      maxSpirituality: silverKnightEnemyMaxSpirituality(b), status: b.status, locationId: b.locationId, tier: silverKnightEnemyTier(b), powerUses: { ...b.resources.powerUses }, injuries: b.enemyInjuries.length, coatingsRemaining: b.resources.coatings.filter(c => c.status === 'SEALED').length },
    hunts: !visible ? [] : SILVER_KNIGHT_HUNTS.map(d => { const h = currentSilverKnightHunt(s, d.speciesId), known = h.status !== 'UNSEEN';
      return { speciesId: d.speciesId, label: d.label, instanceId: known ? h.id : null, locationId: known ? h.locationId : null, status: h.status,
        health: known ? h.enemyHealth : null, mind: known ? h.enemyMind : null, spirituality: known ? h.resources.enemySpirituality : null, maxSpirituality: known ? d.maxSpirituality : null,
        trait: known ? `${d.trait} ${h.huntBehaviorVersion === 2 ? '本原体G行为v2：重伤仍抵抗，可尝试撤离；伤势/资源不重置。' : '本原体保留历史G行为v1；已有投降不可补刀。'}` : null, remainsId: h.remainsId, injuries: known ? h.enemyInjuries.length : null, coatingsRemaining: known ? h.resources.coatings.filter(c => c.status === 'SEALED').length : null }; }),
    remains: visible ? structuredClone(e.remains) : [], actions: silverKnightEncounterActions(s), facts: visible ? [
      '0.163起公开调查登记新原体行为v2：六类非人猎物重伤后继续真实抵抗，普通撤离仍有检定；既存实例保留其记录版本，投降原体绝不转换或补刀，人类洛肯仍可投降',
      '每个原身体仅一份遗骸，实际死亡→本人采集→原祭坛正确槽→消耗，绝不复制或把投降当亲猎',
      '原生物G1100/底110，H100/M100与各自80–120S；玩家沿原45/20/25/10核心、1250/底125、S上限120，双方1–6行动，共同真实伤势与死亡',
      '退场保同一原身体H/M/S、伤势和涂层；遗骸消耗或原个体投降后的下一真实周才出现不同原个体线索，须再花1行动实查，原投降者仍活着',
      ...([3, 2].includes(s.progression.sequence ?? 0) && e.post.investigatedWeek !== null ? [`原48岁洛肯·里德保有唯一SK3-LORCAN-ROD，${e.post.enemyStatus === 'RESISTING' ? '原棍仍在手' : '原棍留在原院'}；冲击5S/70G，屏护4S/减40并抵一次传送剑，辨光4S；原灯余${e.scene.lampSeconds}秒，无免费补油，普通出口开放`] : []),
      `原猎战及晋后战斗已实际经过${s.combatHistory.reduce((n, r) => n + (r.silverKnightOutcome?.elapsedSeconds ?? 0), 0)}秒；旧六阶段人物与原物不改`] : [] };
}
/** A first paid preparation may occur between two encounters; all combat budgets remain unchanged. */
function resourcesFollow(before: SilverKnightBattleResources, after: SilverKnightBattleResources, b: SilverKnightBody): boolean {
  if (same(before, after)) return true;
  if (before.preparationWeek !== null || after.preparationWeek === null || after.preparationCostPence !== 120 || after.coatings.length !== 2 || !after.frostWardAvailable ||
      after.coatings.some((c, i) => c.id !== `${b.id}-COATING-${i + 1}` || c.targetId !== b.id || c.status !== 'SEALED' || c.usedHistoryIndex !== null)) return false;
  return same({ ...before, preparationWeek: after.preparationWeek, preparationCostPence: 120, coatings: after.coatings, frostWardAvailable: true }, after);
}
export function validateSilverKnightEncounter(s: SliceState): boolean {
  try {
    const e = s.silverKnight?.encounter; if (!e || !Array.isArray(e.hunts) || !Array.isArray(e.remains) || !['AVAILABLE', 'READY', 'FIGHTING'].includes(e.status) ||
      e.scene.ordinaryExit !== 'OPEN' || e.scene.pursuit !== false || e.scene.thirdPartiesInArea !== 0 || e.scene.distanceMetres !== 2 || !integer(e.scene.lampSeconds, 0, 180)) return false;
    const bodies = [...e.hunts, e.post]; if (new Set(bodies.map(b => b.id)).size !== bodies.length || new Set(e.remains.map(r => r.id)).size !== e.remains.length) return false;
    for (const species of SILVER_KNIGHT_SPECIES) {
      const group = e.hunts.filter(h => h.speciesId === species); if (!group.length) return false;
      for (const [i, b] of group.entries()) {
        if (b.instance !== i + 1) return false;
        if (i > 0) { const previous = group[i - 1]!, r = e.remains.find(r => r.id === previous.remainsId), a = previous.attempts.at(-1);
          const eligibleWeek = r?.status === 'CONSUMED' ? r.consumedWeek : previous.status === 'SURRENDERED' && a?.terminal?.outcome === 'ENEMY_SURRENDERED' ? a.week : null;
          if (eligibleWeek === null || b.appearedWeek === null || b.appearedWeek <= eligibleWeek) return false; }
      }
    }
    for (const b of bodies) {
      const initial = body(b.speciesId, b.instance, b.appearedWeek), r = b.resources;
      if (Object.hasOwn(b, 'huntBehaviorVersion') && (b.huntBehaviorVersion !== 2 || b.speciesId === null || b.status === 'UNSEEN' || b.status === 'SURRENDERED')) return false;
      if (b.id !== initial.id || b.locationId !== initial.locationId || b.originLocationId !== initial.originLocationId || b.source !== 'ORIGINAL_LIMITED_G' ||
          !integer(b.enemyHealth, 0, 100) || !integer(b.enemyMind, 1, 100) || !integer(b.enemyRisk) || !Array.isArray(b.enemyInjuries) ||
          !['UNSEEN', 'TRACKED', 'FIGHTING', 'RETREATED', 'DEAD', 'SURRENDERED', 'LEFT'].includes(b.status) ||
          !['RESISTING', 'DEAD', 'SURRENDERED'].includes(b.enemyStatus) || (b.enemyStatus === 'DEAD') !== (b.enemyHealth === 0) ||
          (b.status === 'DEAD') !== (b.enemyStatus === 'DEAD') || (b.status === 'SURRENDERED') !== (b.enemyStatus === 'SURRENDERED') ||
          !integer(r.enemySpirituality, 0, silverKnightEnemyMaxSpirituality(b)) || !integer(r.spentSpirituality) || r.enemySpirituality + r.spentSpirituality !== silverKnightEnemyMaxSpirituality(b) ||
          !r.powerUses || !same(Object.keys(r.powerUses).sort(), Object.keys(initial.resources.powerUses).sort()) || !Object.values(r.powerUses).every(n => integer(n)) ||
          !integer(r.stoneArmorCharges, 0, b.speciesId === 'ROCK_HUSK' ? 2 : 0) || !integer(r.mistCharges, 0, b.speciesId === 'MIST_ANTLER' ? 3 : 0) || !integer(r.fireStreak, 0, b.speciesId === 'EMBER_WING' ? 2 : 0) ||
          !Array.isArray(r.coatings) || ![0, 2].includes(r.coatings.length) || r.preparationCostPence !== (r.preparationWeek === null ? 0 : 120) ||
          r.coatings.some((c, i) => c.id !== `${b.id}-COATING-${i + 1}` || c.targetId !== b.id || !['SEALED', 'SPENT'].includes(c.status) || (c.status === 'SEALED' ? c.usedHistoryIndex !== null : !integer(c.usedHistoryIndex, 0, s.combatHistory.length - 1))) ||
          !Array.isArray(b.attempts)) return false;
      if (b.status === 'UNSEEN' && !same(b, initial)) return false;
      let previousOutcome: ReturnType<typeof outcomeAt> = undefined;
      for (const a of b.attempts) {
        if (!integer(a.week, 1, s.week) || !integer(a.startHistoryIndex, 0, s.combatHistory.length)) return false;
        const end = a.terminal ? a.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(a.startHistoryIndex, end);
        for (const [i, round] of rounds.entries()) {
          const o = round.silverKnightOutcome;
          if (!validateSilverKnightRoundOutcome(o) || o.source.huntBehaviorVersion !== b.huntBehaviorVersion || o.targetId !== b.id || o.source.locationId !== b.locationId || o.source.originLocationId !== b.originLocationId || o.source.runId !== s.runId || o.source.attemptWeek !== a.week || o.source.startHistoryIndex !== a.startHistoryIndex || o.round !== i + 1 || round.round !== i + 1) return false;
          if (previousOutcome ? o.source.enemyHealth !== previousOutcome.enemyHealth || o.source.enemyMind !== previousOutcome.enemyMind ||
              !resourcesFollow(previousOutcome.resourcesAfter, o.source.resources, b) || !same(o.source.enemyInjuries, previousOutcome.enemyInjuriesAfter) || o.source.enemyRisk !== previousOutcome.enemyRiskAfter
            : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.source.enemyInjuries.length !== 0 || o.source.enemyRisk !== 0 || !resourcesFollow(initial.resources, o.source.resources, b)) return false;
          if (i > 0 && previousOutcome && (o.source.playerHealth !== previousOutcome.playerHealthAfter || o.source.playerMind !== previousOutcome.playerMindAfter ||
              o.source.playerSpirituality !== Math.min(120, previousOutcome.playerSpiritualityAfter + 12) || o.source.lifeClockSeconds !== previousOutcome.lifeClockSecondsAfter)) return false;
          if (i < rounds.length - 1 && !o.continuing) return false;
          previousOutcome = o;
        }
        if (a.terminal) { const last = rounds.at(-1), o = last?.silverKnightOutcome, t = a.terminal;
          if (!last || !o || o.continuing || t.round !== last.round || t.enemyHealth !== o.enemyHealth || t.enemyMind !== o.enemyMind || t.enemySpirituality !== o.resourcesAfter.enemySpirituality ||
              t.enemyStatus !== o.enemyStatus || (t.outcome === 'ENEMY_DEAD' ? o.enemyHealth !== 0 || last.winner !== 'PLAYER' :
                t.outcome === 'ENEMY_SURRENDERED' ? o.enemyStatus !== 'SURRENDERED' || last.winner !== 'PLAYER' : t.outcome === 'RETREATED' ? last.retreat !== 'SUCCESS' : o.playerHealthAfter !== 0)) return false; }
      }
      if (previousOutcome && (previousOutcome.enemyHealth !== b.enemyHealth || previousOutcome.enemyMind !== b.enemyMind || !resourcesFollow(previousOutcome.resourcesAfter, r, b) || !same(previousOutcome.enemyInjuriesAfter, b.enemyInjuries) || previousOutcome.enemyRiskAfter !== b.enemyRisk)) return false;
      if (!previousOutcome && !resourcesFollow(initial.resources, r, b)) return false;
      if (b.remainsId !== null && !e.remains.some(r => r.id === b.remainsId && r.instanceId === b.id)) return false;
    }
    for (const r of e.remains) {
      const b = e.hunts.find(b => b.id === r.instanceId), t = b?.attempts.at(-1)?.terminal;
      if (!b || b.status !== 'DEAD' || b.remainsId !== r.id || r.id !== `${b.id}-REMAINS` || r.speciesId !== b.speciesId || r.originLocationId !== b.originLocationId ||
          r.killedBy !== 'PLAYER' || r.outcome !== 'ENEMY_DEAD' || t?.outcome !== 'ENEMY_DEAD' || r.killedWeek !== b.attempts.at(-1)?.week ||
          !integer(r.collectedWeek, r.killedWeek, s.week) || !['OWNER_PLAYER', 'ALTAR', 'CONSUMED'].includes(r.status) ||
          (r.status === 'OWNER_PLAYER' ? r.locationId !== 'PLAYER' || r.slotId !== null || r.consumedWeek !== null :
           r.slotId !== SILVER_KNIGHT_ALTAR_SLOTS[SILVER_KNIGHT_SPECIES.indexOf(r.speciesId)] || r.locationId !== `SK3-CHAPEL:ALTAR:${r.slotId}` ||
           (r.status === 'CONSUMED' ? !integer(r.consumedWeek, r.collectedWeek, s.week) : r.consumedWeek !== null))) return false;
    }
    const placed = e.remains.filter(r => r.status === 'ALTAR'); if (new Set(placed.map(r => r.slotId)).size !== placed.length) return false;
    if (e.status === 'FIGHTING') return hasSilverKnightDisputeOpponent(s);
    if (s.combat?.encounterId === 'SILVER_KNIGHT_HUNT' || s.combat?.encounterId === 'SILVER_KNIGHT_DISPUTE') return false;
    if (e.status === 'AVAILABLE' && s.health === 0 && e.activeTargetId !== null) {
      const b = currentSilverKnightBody(s); return !!b && b.attempts.at(-1)?.terminal?.outcome === 'PLAYER_DEAD' && e.scene.playerPosition === 'ORIGIN' && e.scene.locationId === b.locationId;
    }
    return e.status === 'AVAILABLE' ? e.activeTargetId === null && e.scene.playerPosition === 'OUTSIDE' : e.activeTargetId === SILVER_KNIGHT_TARGET_ID && e.scene.locationId === e.post.locationId && e.scene.playerPosition === 'ORIGIN';
  } catch { return false; }
}
function outcomeAt(s: SliceState, i: number) { return s.combatHistory[i]?.silverKnightOutcome; }
