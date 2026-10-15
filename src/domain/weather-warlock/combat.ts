import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import { findIronBloodMember } from '../iron-blood-knight/team.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { WEATHER_WARLOCK_TARGET_ID, WEATHER_WARLOCK_POWERS, WEATHER_WARLOCK_POWER_IDS, hasWeatherWarlockDisputeOpponent,
  type WeatherWarlockEnemyIntent, type WeatherWarlockPowerId, type WeatherWarlockWeakness } from './encounter.js';
import { WEATHER_WARLOCK_MEMBER_IDS } from './life.js';

/** Initial S2 G keeps the actual Hunter4 six-slot / 1250 / floor125 /
 * max120 / regen12 budget. Formation does not multiply the action count. */
export const WEATHER_WARLOCK_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const WEATHER_WARLOCK_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const weatherWarlockActionCount = pyromaniacActionCount;
export const weatherWarlockEnemyActionCount = pyromaniacActionCount;
export type WeatherWarlockPolicy = 'HOLD' | 'LINK_IF_READY';
export type WeatherWarlockMoveId = 'STRIKE' | 'BLOCK' | 'EVADE' | 'OBSERVE' | 'ACCIDENT'
  | 'IRON_BLOOD_FLAME' | 'IRON_BLOOD_STEEL' | 'hunter.s4.comrade-link'
  | 'hunter.s9.physical-enhancement' | 'hunter.s9.hunting-instinct'
  | 'hunter.s8.provocation' | 'hunter.s8.hostility-aura'
  | 'hunter.s7.flame-control' | 'hunter.s7.compressed-fireball' | 'hunter.s7.flame-lance' | 'hunter.s7.fire-raven'
  | 'hunter.s5.weakness-observation' | 'hunter.s5.precision-strike'
  | 'hunter.s3.formation-link' | 'hunter.s3.coordinated-action'
  | 'hunter.s2.battle-fog' | 'hunter.s2.frost' | 'hunter.s2.storm';
const FORM = 'hunter.s3.formation-link', COORD = 'hunter.s3.coordinated-action';
export const WEATHER_WARLOCK_WEATHER_IDS = ['hunter.s2.battle-fog', 'hunter.s2.frost', 'hunter.s2.storm'] as const;
export type WeatherWarlockWeatherId = typeof WEATHER_WARLOCK_WEATHER_IDS[number];
export type WeatherWarlockField = 'FOG' | 'FROST' | 'STORM';
export interface WeatherWarlockTerrain {
  waterLitres: number; wet: boolean; fixtureDamage: number; weatherUses: Record<WeatherWarlockField, number>;
}
const ABILITIES: readonly { id: WeatherWarlockMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'IRON_BLOOD_FLAME', label: '继承本人火焰形态（4灵性；55×掌握×身体G）', weight: 15, stance: 'ATTACK' },
  { id: 'STRIKE', label: '本人原身体/实际在手原棍（12/16×身体G）', weight: 5, stance: 'ATTACK' },
  { id: 'IRON_BLOOD_STEEL', label: '继承短暂钢铁化（3灵性；减势18G）', weight: 10, stance: 'DEFEND' },
  { id: 'hunter.s5.precision-strike', label: '继承真实弱点精准打击（有效窗口2灵性）', weight: 10, stance: 'ATTACK' },
  { id: 'hunter.s9.physical-enhancement', label: '继承强化打击（28×身体G）', weight: 5, stance: 'ATTACK' },
  { id: 'hunter.s7.compressed-fireball', label: '继承本人制造压缩火球（3灵性；36G）', weight: 5, stance: 'ATTACK' },
  { id: 'EVADE', label: '继承身体避让（减势22G）', weight: 10, stance: 'DEFEND' },
  { id: 'BLOCK', label: '普通格挡（减势10G）', weight: 5, stance: 'DEFEND' },
  { id: 'hunter.s7.flame-control', label: '继承本人制造火焰牵制（2灵性；减势18G）', weight: 10, stance: 'CONTROL' },
  { id: FORM, label: '真实编队协抗（先付联系；本轮团队共用20G上限）', weight: 5, stance: 'DEFEND' },
  { id: COORD, label: '原五人有限协作（先付联系；本轮团队共用20G上限）', weight: 5, stance: 'PREPARE' },
  { id: 'hunter.s4.comrade-link', label: '继承实际战友借力（另3灵性/各3精力；共用20G）', weight: 5, stance: 'PREPARE' },
  { id: 'hunter.s5.weakness-observation', label: '继承观察真实原棍重心（2灵性；窗口至下一轮）', weight: 5, stance: 'PREPARE' },
  { id: 'hunter.s2.battle-fog', label: '有限战雾（8灵性/2升原水；减势60，自身视线−10G）', weight: 10, stance: 'CONTROL' },
  { id: 'hunter.s2.frost', label: '有限霜冻（8灵性/1升原水；减势50，自身落脚−8G）', weight: 10, stance: 'DEFEND' },
  { id: 'hunter.s2.storm', label: '有限风暴（10灵性/4升原水；贡献90，自身风压−15G）', weight: 10, stance: 'ATTACK' },
  { id: 'ACCIDENT', label: '行动失衡（−22.5G）', weight: 5, stance: null },
];
export const WEATHER_WARLOCK_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'LIGHTNING', label: '原有限雷光术：8灵性、贡献95G', weight: 35 },
  { id: 'WIND_SCREEN', label: '原有限风屏：6灵性、减势55G', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍：20×身体G', weight: 25 },
  { id: 'COMPOSE', label: '普通整理持棍姿势：0贡献', weight: 10 },
  { id: 'ACCIDENT', label: '动作偏差：−22.5G', weight: 5 },
];
export const isWeatherWarlock = (s: SliceState): boolean => s.progression.pathwayId === 'hunter' && s.progression.sequence === 2;
function tickets(stance: SliceStance | null) { return ABILITIES.map(a => a.weight * (a.stance === stance && stance !== null ? 5 : 4)); }
export function weatherWarlockAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawWeatherWarlockAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): WeatherWarlockMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('天气术士能力盘无效。');
}
export function drawWeatherWarlockEnemyAbility(random: ActionRandomStream): WeatherWarlockEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of WEATHER_WARLOCK_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as WeatherWarlockEnemyIntent; } throw new Error('原奥伦能力盘无效。');
}
export interface WeatherWarlockMemberSnapshot { id: string; name: string; health: number; energy: number; joined: boolean; willing: boolean; present: boolean; location: 'HOME' | 'YARD' }
export interface WeatherWarlockCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'WEATHER_WARLOCK_DISPUTE'; targetId: typeof WEATHER_WARLOCK_TARGET_ID;
  attemptWeek: number; invitedWeek: number | null; startHistoryIndex: number;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number;
  targetAge: 49; targetSequence: 2; targetPhysique: 22; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'WW2-ORREN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; formationRadiusMetres: 6;
  space: 'WW2-OPEN-CISTERN-YARD'; ordinaryExit: true; pursuit: false; noBystanders: true;
  clubHeld: boolean; members: WeatherWarlockMemberSnapshot[]; weakness: WeatherWarlockWeakness;
  flameMastery: number; precisionMastery: number; weatherMastery: Record<WeatherWarlockWeatherId, number>;
  powerUses: Record<WeatherWarlockPowerId, number>; terrain: WeatherWarlockTerrain;
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const memberSnapshot = (s: SliceState, id: string): WeatherWarlockMemberSnapshot => {
  const m = findIronBloodMember(s, id)!;
  return { id, name: m.name, health: m.health, energy: m.energy, joined: m.joined, willing: m.willing, present: m.present, location: m.location };
};
export function currentWeatherWarlockCombatSource(s: SliceState): WeatherWarlockCombatSource | null {
  if (!hasWeatherWarlockDisputeOpponent(s)) return null;
  const e = s.weatherWarlock.encounter, c = s.combat!;
  const source: WeatherWarlockCombatSource = { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'WEATHER_WARLOCK_DISPUTE', targetId: WEATHER_WARLOCK_TARGET_ID,
    attemptWeek: e.attemptWeek!, invitedWeek: e.invitedWeek, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, targetAge: 49, targetSequence: 2, targetPhysique: 22, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'WW2-ORREN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, formationRadiusMetres: 6,
    space: 'WW2-OPEN-CISTERN-YARD', ordinaryExit: true, pursuit: false, noBystanders: true, clubHeld: s.town.clubLocation === 'HAND',
    members: e.companionIds.map(id => memberSnapshot(s, id)), weakness: { ...e.weakness },
    flameMastery: bounded(s.progression.mastery['hunter.s4.flame-steel'] ?? 0, 500), precisionMastery: bounded(s.progression.mastery['hunter.s5.precision-strike'] ?? 0, 500),
    weatherMastery: {
      'hunter.s2.battle-fog': bounded(s.progression.mastery['hunter.s2.battle-fog'] ?? 0, 500),
      'hunter.s2.frost': bounded(s.progression.mastery['hunter.s2.frost'] ?? 0, 500),
      'hunter.s2.storm': bounded(s.progression.mastery['hunter.s2.storm'] ?? 0, 500),
    }, powerUses: { ...e.powerUses }, terrain: structuredClone(e.terrain) };
  return source;
}
export interface WeatherWarlockCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
interface ActionEvidence extends WeatherWarlockCombatEffect {
  order: number; paidCost: number; physicalFactor: number; teamContribution: number; memberEnergyCosts: { memberId: string; amount: number }[];
  weatherField: WeatherWarlockField | null; waterLitresUsed: number; selfFieldPenalty: number;
}
export interface WeatherWarlockPlayerAction extends ActionEvidence { id: WeatherWarlockMoveId }
export interface WeatherWarlockEnemyAction extends ActionEvidence { planned: WeatherWarlockEnemyIntent; actual: WeatherWarlockEnemyIntent }
export interface WeatherWarlockPayment { memberId: string; healthDamage: number; energyCost: number }
interface RoundModel {
  playerSpirituality: number; enemySpirituality: number; powerUses: Record<WeatherWarlockPowerId, number>; members: WeatherWarlockMemberSnapshot[];
  weakness: WeatherWarlockWeakness; linkedMemberIds: string[]; linkCost: 0 | 5; teamContribution: number; payments: WeatherWarlockPayment[];
  terrain: WeatherWarlockTerrain; weatherFieldUsed: boolean;
}
export interface WeatherWarlockRoundContext {
  source: WeatherWarlockCombatSource; stance: SliceStance; policy: WeatherWarlockPolicy; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; model: RoundModel;
  playerActions: WeatherWarlockPlayerAction[]; enemyActions: WeatherWarlockEnemyAction[]; label: string;
  share: null | { originalDamage: number; ownerDamage: number; severity: 'LIGHT' | 'HEAVY'; sharedDamage: number };
}
const none = (label: string): WeatherWarlockCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const readyMember = (m: WeatherWarlockMemberSnapshot, energy = 0) => m.joined && m.willing && m.present && m.location === 'YARD' && m.health >= 50 && m.energy >= energy;
function payment(m: RoundModel, id: string): WeatherWarlockPayment {
  let p = m.payments.find(p => p.memberId === id); if (!p) { p = { memberId: id, healthDamage: 0, energyCost: 0 }; m.payments.push(p); } return p;
}
function initialModel(source: WeatherWarlockCombatSource, player: number, enemy: number, policy: WeatherWarlockPolicy): RoundModel {
  const m: RoundModel = { playerSpirituality: player, enemySpirituality: enemy, powerUses: { ...source.powerUses }, members: structuredClone(source.members),
    weakness: { ...source.weakness }, linkedMemberIds: [], linkCost: 0, teamContribution: 0, payments: [],
    terrain: structuredClone(source.terrain), weatherFieldUsed: false };
  if (policy === 'LINK_IF_READY' && player >= 5 && source.invitedWeek === source.week && m.members.length === 5 &&
      WEATHER_WARLOCK_MEMBER_IDS.every(id => m.members.some(x => x.id === id && readyMember(x, 2)))) {
    m.playerSpirituality -= 5; m.linkCost = 5; m.linkedMemberIds = [...WEATHER_WARLOCK_MEMBER_IDS];
    for (const member of m.members) { member.energy -= 2; payment(m, member.id).energyCost += 2; }
  }
  return m;
}
function liveState(s: SliceState) { const e = s.weatherWarlock.encounter; return stableStringify({ spirit: s.spirituality, enemySpirit: e.enemySpirituality,
  powerUses: e.powerUses, weakness: e.weakness, terrain: e.terrain, members: e.companionIds.map(id => memberSnapshot(s, id)), linkedMemberIds: e.linkedMemberIds, policy: e.policy }); }
function commit(s: SliceState, r: WeatherWarlockRoundContext) {
  const e = s.weatherWarlock.encounter, m = r.model;
  s.spirituality = m.playerSpirituality; e.enemySpirituality = m.enemySpirituality; e.powerUses = { ...m.powerUses }; e.weakness = { ...m.weakness };
  e.terrain = structuredClone(m.terrain);
  e.linkedMemberIds = [...m.linkedMemberIds]; e.policy = r.policy;
  for (const x of m.members) { const original = findIronBloodMember(s, x.id)!; original.health = x.health; original.energy = x.energy; }
  r.liveState = liveState(s);
}
const dynamicSource = new Set(['members', 'weakness', 'powerUses', 'terrain']);
function validRound(s: SliceState, r: WeatherWarlockRoundContext, supplied: WeatherWarlockCombatSource | null): boolean {
  const actual = currentWeatherWarlockCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && stableStringify(supplied) === stableStringify(r.source) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || stableStringify(actual[key as keyof WeatherWarlockCombatSource]) === stableStringify(value)) && r.liveState === liveState(s);
}
export function beginWeatherWarlockCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream, policy: WeatherWarlockPolicy = 'HOLD'): WeatherWarlockRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance) || !['HOLD', 'LINK_IF_READY'].includes(policy)) throw new TypeError('天气术士本轮姿态或联系选择无效。');
  const source = currentWeatherWarlockCombatSource(s); if (!source || !validSource(source)) throw new Error('缺少原奥伦、实际原院与连续战斗来源。');
  const r: WeatherWarlockRoundContext = { source, stance, policy, finished: false, liveState: '', playerSpiritualityBefore: s.spirituality,
    enemySpiritualityBefore: s.weatherWarlock.encounter.enemySpirituality, model: initialModel(source, s.spirituality, s.weatherWarlock.encounter.enemySpirituality, policy),
    playerActions: [], enemyActions: [], label: '', share: null };
  commit(s, r);
  r.label = `原奥伦在独立净空水槽院2米外，独立灵性${r.enemySpiritualityBefore}/120；本轮60秒、联系范围6米G。${r.model.linkCost ? '本次本人5灵性、原五人各2精力已实付，60秒有限联系开启。' : policy === 'HOLD' ? '本轮选择保留联系，不耗联系资源。' : '本轮缺少全五人实际到场、自愿/安全状态、各2精力或本人5灵性，未建立联系，消耗0。'}`;
  return r;
}
export const createWeatherWarlockCombatRound = beginWeatherWarlockCombatRound;
function actionBase(order: number, physical: number): ActionEvidence {
  return { ...none(''), order, paidCost: 0, physicalFactor: physical, teamContribution: 0, memberEnergyCosts: [], weatherField: null, waterLitresUsed: 0, selfFieldPenalty: 0 };
}
function playerAction(source: WeatherWarlockCombatSource, m: RoundModel, id: WeatherWarlockMoveId, physical: number, order: number): WeatherWarlockPlayerAction {
  const a: WeatherWarlockPlayerAction = { ...actionBase(order, physical), id };
  const pay = (n: number) => { if (m.playerSpirituality < n) return false; m.playerSpirituality -= n; a.paidCost += n; return true; };
  const strike = (why = '') => { a.selfGain = (source.clubHeld ? 16 : 12) * physical; a.threatens = a.selfGain > 0; a.label = `${why}本人${source.clubHeld ? '真实在手自有原短棍' : '原身体空手'}普通打击${source.clubHeld ? 16 : 12}×身体G，不重抽或借用敌棍。`; };
  const block = (why = '') => { a.enemyReduction = 10; a.label = `${why}本人普通格挡减势10G，无免伤保证。`; };
  if (id === 'STRIKE') strike();
  else if (id === 'BLOCK') block();
  else if (id === 'EVADE') { a.enemyReduction = 22; a.label = '继承本人强化身体避让：有限减势22G，不保证免伤。'; }
  else if ((WEATHER_WARLOCK_WEATHER_IDS as readonly string[]).includes(id)) {
    const field: WeatherWarlockField = id === 'hunter.s2.battle-fog' ? 'FOG' : id === 'hunter.s2.frost' ? 'FROST' : 'STORM';
    const cost = field === 'STORM' ? 10 : 8, water = field === 'FOG' ? 2 : field === 'FROST' ? 1 : 4;
    // Every actual companion inside the field bears its effect, including an
    // unlinked/unwilling/tired member. No safe exclusion is inferred from policy.
    const exposed = m.members.filter(x => x.present && x.location === 'YARD');
    const fallback = (why: string) => { if (field === 'STORM') strike(why); else block(why); };
    if (m.weatherFieldUsed) fallback('本轮已产生一个实际天气场，三个天气共用每轮一次上限；不重复收费或叠场，');
    else if (m.playerSpirituality < cost || m.terrain.waterLitres < water || exposed.some(x => x.energy < 1)) {
      fallback(`真实灵性${cost}、原水${water}升或每位在场同伴1精力不足，天气未生效、所有资源消耗0；`);
    } else {
      pay(cost); m.weatherFieldUsed = true; m.terrain.waterLitres -= water; m.terrain.weatherUses[field]++;
      a.weatherField = field; a.waterLitresUsed = water;
      for (const x of exposed) {
        x.energy--; payment(m, x.id).energyCost++;
        a.memberEnergyCosts.push({ memberId: x.id, amount: 1 });
      }
      if (field === 'FOG') {
        a.selfFieldPenalty = 10; a.selfGain = -10; a.enemyReduction = 60;
        a.label = '有限战雾G：实付8灵性、消耗原水槽2升，减敌势60；本人同处雾中视线受阻−10贡献，不提供免费单向视野。';
      } else if (field === 'FROST') {
        a.selfFieldPenalty = 8; a.selfGain = -8; a.enemyReduction = 50;
        a.label = '有限霜冻G：实付8灵性、消耗原水槽1升，减敌势50；本人落脚同受冰霜影响−8贡献，不冻结时间或自动命中。';
      } else {
        a.selfFieldPenalty = 15; a.selfGain = 90 - a.selfFieldPenalty; a.threatens = true;
        m.terrain.wet = true; m.terrain.fixtureDamage++;
        a.label = '有限风暴G：实付10灵性、消耗原水槽4升，攻击贡献90减本人风压15后实际75；原院变湿，原木屏新增一处损伤，不自动修复，仍由共同胜负与伤势盘结算。';
      }
      a.label += `实际在场${exposed.length}位原同伴各耗1精力，已联结也不免费排除；本轮天气场名额已用，原水余${m.terrain.waterLitres}/40升。水槽与用量为本遭遇有限G实现，不宣称原著施术必须取水。`;
    }
  }
  else if (id === 'hunter.s9.physical-enhancement') { a.selfGain = 28 * physical; a.threatens = a.selfGain > 0; a.label = '继承本人强化身体打击28×身体G，没有编队法术复制。'; }
  else if (id === 'hunter.s9.hunting-instinct') { a.enemyReduction = 15; a.label = '继承猎杀直觉：观察眼前奥伦原棍实际动作，减势15G，不读取未来。'; }
  else if (id === 'IRON_BLOOD_FLAME') {
    if (!pay(4)) strike('本人真实灵性不足4，火焰形态未施展；');
    else { a.selfGain = 55 * (.65 + .35 * source.flameMastery / 500) * physical; a.threatens = a.selfGain > 0; a.label = '继承本人火焰形态：4灵性，沿当前2米净空通道短暂攻击后回原人形，55×原掌握×身体G；不借旧灯、不飞行、不瞬移、不免伤。'; }
  } else if (id === 'IRON_BLOOD_STEEL') {
    if (!pay(3)) block('本人真实灵性不足3，钢铁形态未施展；');
    else { a.enemyReduction = 18; a.label = '继承本人短暂钢铁化：3灵性、减势18G，本槽结束回人形，真实伤势仍结算。'; }
  } else if (['hunter.s7.flame-control', 'hunter.s7.compressed-fireball', 'hunter.s7.flame-lance', 'hunter.s7.fire-raven'].includes(id)) {
    const control = id === 'hunter.s7.flame-control', cost = control || id === 'hunter.s7.fire-raven' ? 2 : 3;
    if (!pay(cost)) { if (control) block(`当下灵性不足${cost}，未制造火焰；`); else strike(`当下灵性不足${cost}，未制造火焰；`); }
    else { a.selfGain = control ? 0 : id === 'hunter.s7.compressed-fireball' ? 36 : id === 'hunter.s7.flame-lance' ? 32 : 24; a.enemyReduction = control ? 18 : 0; a.threatens = !control;
      a.label = `继承本人纵火家制造自身火焰：实际${cost}灵性，原2米净空通路有限${control ? '牵制18' : `攻击${a.selfGain}`}G；没有旧纸灯或别人火源，火鸦只占本动作而非独立队员。`; }
  } else if (id === 'hunter.s5.weakness-observation') {
    if (!pay(2)) a.label = '真实灵性不足2，弱点观察没有窗口、无消耗、不重抽。';
    else { m.weakness.available = true; m.weakness.sourceRound = source.round; m.weakness.observations++; a.label = '继承真实弱点观察：2灵性观察奥伦原棍重心，0贡献，建立当前或下一轮一次窗口，不窥未知事实。'; }
  } else if (id === 'hunter.s5.precision-strike') {
    const w = m.weakness;
    if (!w.available || w.sourceRound === null || w.sourceRound > source.round || source.round > w.sourceRound + 1 || m.playerSpirituality < 2) strike('没有同一敌人的有效窗口或2灵性；');
    else { pay(2); w.available = false; w.sourceRound = null; w.uses++; strike(); a.selfGain += 36 * (.65 + .35 * source.precisionMastery / 500) * physical;
      a.label = '继承精准打击：真实2灵性消费同一奥伦窗口，本人原身体/原棍打击另加36×原掌握×身体G，仍走共同伤势盘。'; }
  } else if (id === FORM || id === COORD || id === 'hunter.s4.comrade-link') {
    const members = m.members.filter(x => m.linkedMemberIds.includes(x.id) && readyMember(x));
    const budget = Math.min(20 - m.teamContribution, members.length * 4);
    if (!m.linkCost || members.length !== 5 || budget <= 0) a.label = '没有本轮已付费的原五人实际联系，或本轮团队20G额度已耗尽；普通观察0贡献、0额外消耗，不自动开启、不增轮盘。';
    else if (id === 'hunter.s4.comrade-link' && (m.playerSpirituality < 3 || members.some(x => x.energy < 3))) a.label = '继承战友借力缺少本人3灵性或每位3精力，贡献0、额外消耗0。';
    else {
      if (id === 'hunter.s4.comrade-link') { pay(3); for (const x of members) { x.energy -= 3; payment(m, x.id).energyCost += 3; a.memberEnergyCosts.push({ memberId: x.id, amount: 3 }); } }
      m.teamContribution += budget; a.teamContribution = budget;
      if (id === FORM) a.enemyReduction = budget; else { a.selfGain = budget; a.threatens = id === COORD; }
      a.label = id === FORM ? `已联结的原五人各自实际支撑与错步协抗冲击，合计减势${budget}G，占用本轮团队共用20G；身体仍各在原院，不共享法术或免伤。`
        : id === COORD ? `已联结的原五人依本次眼神与动作在6米内配合包抄、普通推挡，合计贡献${budget}G，占用本轮团队共用20G；没有赋予非凡职业、武器或五份额外轮盘。`
        : `继承战友借力另付本人3灵性、原五人各3精力，汇聚有限力量${budget}G，与新协作共用本轮20G额度，不额外赠予队伍输出。`;
    }
  } else if (id === 'hunter.s8.provocation') a.label = '继承针对性挑衅：没有此人的已知可针对言行，普通观察0贡献、0消耗，不挪用旧威斯故事。';
  else if (id === 'hunter.s8.hostility-aura') a.label = '继承憎恶气息：眼前是可沟通成年原人，不能套用动物或怪物来源，0贡献、0消耗。';
  else if (id === 'OBSERVE') { a.selfGain = 8; a.label = '本人观察眼前原棍与实际空当，有限贡献8G。'; }
  else { a.selfGain = -22.5; a.label = '本槽行动失衡，有限贡献−22.5G，不重抽或转给队员。'; }
  return a;
}
function enemyAction(m: RoundModel, planned: WeatherWarlockEnemyIntent, physical: number, order: number): WeatherWarlockEnemyAction {
  const a: WeatherWarlockEnemyAction = { ...actionBase(order, physical), planned, actual: planned }, power = WEATHER_WARLOCK_POWERS.find(p => p.id === planned);
  if (power && m.enemySpirituality >= power.cost) { m.enemySpirituality -= power.cost; m.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction; a.threatens = power.selfGain > 0;
    a.label = `原创非凡者奥伦本人${power.label}：独立原灵性实耗${power.cost}，余${m.enemySpirituality}/120；贡献${a.selfGain}/减势${a.enemyReduction}G，不借玩家或队员资源。`; }
  else if (planned === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原奥伦动作失衡，贡献−22.5G，原槽不重抽。'; }
  else { a.actual = 'BODY_STRIKE'; a.selfGain = 20 * physical; a.threatens = a.selfGain > 0; a.label = `${power ? '原灵性不足，未施法、不重抽；' : ''}奥伦用自己的唯一原棍WW2-ORREN-CLUB普通打击20×身体G。`; }
  return a;
}
const allowed = (id: string): id is WeatherWarlockMoveId => ABILITIES.some(a => a.id === id) || ['hunter.s9.hunting-instinct', 'hunter.s8.provocation', 'hunter.s8.hostility-aura', 'hunter.s7.flame-lance', 'hunter.s7.fire-raven', 'OBSERVE'].includes(id);
export function resolveWeatherWarlockCombatAbility(s: SliceState, id: WeatherWarlockMoveId, physical: number, _random: ActionRandomStream,
  r: WeatherWarlockRoundContext, source: WeatherWarlockCombatSource | null = r.source): WeatherWarlockCombatEffect {
  if (!allowed(id) || r.playerActions.length >= 6 || !validRound(s, r, source)) return none('天气术士当前原身体、回合来源或真实资源不符：0贡献、0消耗、不重抽。');
  const a = playerAction(r.source, r.model, id, bounded(physical, 1), r.playerActions.length + r.enemyActions.length); r.playerActions.push(a); commit(s, r); return a;
}
export function resolveWeatherWarlockEnemyAbility(s: SliceState, planned: WeatherWarlockEnemyIntent, physical: number, _random: ActionRandomStream,
  r: WeatherWarlockRoundContext, source: WeatherWarlockCombatSource | null = r.source): WeatherWarlockCombatEffect {
  if (![...WEATHER_WARLOCK_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned) || r.enemyActions.length >= 6 || !validRound(s, r, source)) return none('缺少原奥伦本回合独立资源来源：0贡献、0消耗、不重抽。');
  const a = enemyAction(r.model, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length); r.enemyActions.push(a); commit(s, r); return a;
}
function shareModel(m: RoundModel, actual: number): number {
  let remaining = Math.min(10, Math.floor(actual * .2)), total = 0;
  for (const x of m.members.filter(x => m.linkedMemberIds.includes(x.id) && readyMember(x))) {
    const amount = Math.min(2, remaining, x.health - 48); if (amount <= 0) continue;
    x.health -= amount; payment(m, x.id).healthDamage += amount; remaining -= amount; total += amount;
  }
  return total;
}
/** Only the actual health consequence is redirected; original injury/risk stays
 * with the owner. Direct death and mental damage never enter this helper. */
export function shareWeatherWarlockHealthDamage(s: SliceState, damage: number, r: WeatherWarlockRoundContext, severity: 'LIGHT' | 'HEAVY' | 'DEATH'): { ownerDamage: number; label: string } {
  const actual = Math.max(0, Math.min(s.health, Number.isFinite(damage) ? Math.floor(damage) : 0));
  if (severity === 'DEATH' || r.share || actual <= 0 || !r.model.linkCost || !validRound(s, r, r.source)) return { ownerDamage: actual, label: '' };
  const shared = shareModel(r.model, actual); r.share = { originalDamage: actual, ownerDamage: actual - shared, severity, sharedDamage: shared }; commit(s, r);
  return { ownerDamage: actual - shared, label: shared ? `本轮原伤${actual}真实分担${shared}，本人承受${actual - shared}；原同伴逐人最多2H、合计最多10H且不超20%，健康低于50不参与，原伤势与累计风险保留，不分精神或死亡。` : '当前没有符合安全条件的原联系成员，实际健康伤害由本人承担。' };
}
export interface WeatherWarlockRoundOutcome {
  targetId: typeof WEATHER_WARLOCK_TARGET_ID; round: number; source: WeatherWarlockCombatSource; stance: SliceStance; policy: WeatherWarlockPolicy; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<WeatherWarlockPowerId, number>; weaknessAfter: WeatherWarlockWeakness; linkCost: 0 | 5; linkedMemberIds: string[]; linkedMemberIdsAfter: [];
  teamContribution: number; payments: WeatherWarlockPayment[]; membersAfter: WeatherWarlockMemberSnapshot[]; share: WeatherWarlockRoundContext['share']; sharedHealthDamage: number;
  terrainAfter: WeatherWarlockTerrain; weatherFieldUsed: boolean;
  elapsedSeconds: 60; playerActions: WeatherWarlockPlayerAction[]; enemyActions: WeatherWarlockEnemyAction[];
}
export function finishWeatherWarlockCombatRound(s: SliceState, r: WeatherWarlockRoundContext, continuing = true): WeatherWarlockRoundOutcome {
  const e = s.weatherWarlock.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'WEATHER_WARLOCK_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原天气术士回合已结束或真实资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  const w = r.model.weakness;
  if (w.available && (!continuing || w.sourceRound === null || w.sourceRound < c.round)) { w.available = false; w.sourceRound = null; }
  e.weakness = { ...w }; e.linkedMemberIds = []; r.finished = true;
  return { targetId: WEATHER_WARLOCK_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, policy: r.policy, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, weaknessAfter: { ...w }, linkCost: r.model.linkCost,
    linkedMemberIds: [...r.model.linkedMemberIds], linkedMemberIdsAfter: [], teamContribution: r.model.teamContribution,
    payments: structuredClone(r.model.payments), membersAfter: structuredClone(r.model.members), share: r.share ? { ...r.share } : null,
    terrainAfter: structuredClone(r.model.terrain), weatherFieldUsed: r.model.weatherFieldUsed,
    sharedHealthDamage: r.share?.sharedDamage ?? 0, elapsedSeconds: 60, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectWeatherWarlockCombat(s: SliceState) {
  const e = s.weatherWarlock.encounter;
  return { enemyName: '奥伦·沃斯（原创成年非凡者，49岁，S2等效G）', targetId: e.targetId, enemySpirituality: e.enemySpirituality,
    policy: e.policy, linkedMemberIds: [...e.linkedMemberIds], companions: e.companionIds.map(id => memberSnapshot(s, id)), powerUses: { ...e.powerUses },
    terrain: structuredClone(e.terrain),
    originalExit: true, pursuit: false, distanceMetres: 2, source: currentWeatherWarlockCombatSource(s),
    summary: '双方原六槽，保既有猎人1250/底125、35/30/20/15属性权重、本人灵性120/每持续轮恢复12的有限G；原奥伦独立灵性不自动恢复。默认保留旧联系；联结仍须原五人实际到场、自愿、H≥50与各2E，实付本人5SP和各2E，60秒/6米。旧协作与借力共用20G、实际H分担各2/总10且最多20%，不分精神或死亡。战雾/霜冻/风暴共用每轮一次场效果；8/8/10SP、2/1/4升原水、本人−10/−8/−15贡献，每位实际在场原同伴各1E，无免费排除。40升原水有限不补，风暴湿地与原木屏损伤永久留在本遭遇。所有天气仍走共同胜负和伤势盘，水量是有限G实现而非原著硬前提。' };
}
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (value: unknown, keys: readonly string[]): boolean => !!value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const totalWeatherUses = (t: WeatherWarlockTerrain) => t.weatherUses.FOG + t.weatherUses.FROST + t.weatherUses.STORM;
/** The original 40 L cistern is never reset between rounds. These are finite G
 * encounter quantities, not a claim about a canonical prerequisite of weather. */
export function validWeatherWarlockTerrain(value: unknown): value is WeatherWarlockTerrain {
  if (!shape(value, ['waterLitres', 'wet', 'fixtureDamage', 'weatherUses'])) return false;
  const t = value as WeatherWarlockTerrain;
  return shape(t.weatherUses, ['FOG', 'FROST', 'STORM']) &&
    [t.weatherUses.FOG, t.weatherUses.FROST, t.weatherUses.STORM].every(n => integer(n, 0, 40)) &&
    integer(t.waterLitres, 0, 40) && integer(t.fixtureDamage, 0, 10) && typeof t.wet === 'boolean' &&
    t.waterLitres === 40 - 2 * t.weatherUses.FOG - t.weatherUses.FROST - 4 * t.weatherUses.STORM &&
    t.wet === (t.weatherUses.STORM > 0) && t.fixtureDamage === t.weatherUses.STORM;
}
function validSource(source: WeatherWarlockCombatSource): boolean {
  return shape(source, ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'invitedWeek', 'startHistoryIndex',
      'playerHealth', 'playerMind', 'enemyHealth', 'enemyMind', 'targetAge', 'targetSequence', 'targetPhysique', 'actualOriginalBody', 'independentMind',
      'enemyWeapon', 'weaponLocation', 'distanceMetres', 'formationRadiusMetres', 'space', 'ordinaryExit', 'pursuit', 'noBystanders',
      'clubHeld', 'members', 'weakness', 'flameMastery', 'precisionMastery', 'weatherMastery', 'powerUses', 'terrain']) &&
    typeof source.runId === 'string' && integer(source.revision) && integer(source.week, 1) && integer(source.round, 1) && source.attemptWeek === source.week && integer(source.startHistoryIndex) &&
    source.encounterId === 'WEATHER_WARLOCK_DISPUTE' && source.targetId === WEATHER_WARLOCK_TARGET_ID && source.targetAge === 49 && source.targetSequence === 2 && source.targetPhysique === 22 && source.actualOriginalBody === true && source.independentMind === true &&
    source.enemyWeapon === 'WW2-ORREN-CLUB' && source.weaponLocation === 'HAND' && source.distanceMetres === 2 && source.formationRadiusMetres === 6 && source.space === 'WW2-OPEN-CISTERN-YARD' && source.ordinaryExit === true && source.pursuit === false && source.noBystanders === true &&
    [source.playerHealth, source.playerMind, source.enemyHealth, source.enemyMind].every(n => integer(n, 1, 100)) && typeof source.clubHeld === 'boolean' && integer(source.flameMastery, 0, 500) && integer(source.precisionMastery, 0, 500) &&
    shape(source.weatherMastery, WEATHER_WARLOCK_WEATHER_IDS) && WEATHER_WARLOCK_WEATHER_IDS.every(id => integer(source.weatherMastery[id], 0, 500)) &&
    Array.isArray(source.members) && [0, 5].includes(source.members.length) && new Set(source.members.map(m => m.id)).size === source.members.length && source.members.every(m =>
      shape(m, ['id', 'name', 'health', 'energy', 'joined', 'willing', 'present', 'location']) &&
      (WEATHER_WARLOCK_MEMBER_IDS as readonly string[]).includes(m.id) && typeof m.name === 'string' && integer(m.health, 0, 100) && integer(m.energy, 0, 20) && ['joined', 'willing', 'present'].every(k => typeof m[k as keyof WeatherWarlockMemberSnapshot] === 'boolean') && ['HOME', 'YARD'].includes(m.location)) &&
    (source.members.length ? source.invitedWeek === source.week : source.invitedWeek === null) &&
    shape(source.powerUses, WEATHER_WARLOCK_POWER_IDS) && WEATHER_WARLOCK_POWER_IDS.every(id => integer(source.powerUses[id])) &&
    WEATHER_WARLOCK_POWERS.reduce((n, p) => n + source.powerUses[p.id] * p.cost, 0) <= 120 &&
    WEATHER_WARLOCK_POWER_IDS.reduce((n, id) => n + source.powerUses[id], 0) <= 6 * (source.round - 1) &&
    validWeakness(source.weakness, source.round) && validWeatherWarlockTerrain(source.terrain) && totalWeatherUses(source.terrain) <= source.round - 1;
}
export function validWeatherWarlockWeakness(w: WeatherWarlockWeakness, round: number): boolean { return validWeakness(w, round); }
function validWeakness(w: WeatherWarlockWeakness, round: number): boolean {
  return shape(w, ['sourceRound', 'available', 'observations', 'uses']) && integer(w.observations) && integer(w.uses, 0, w.observations) && typeof w.available === 'boolean' &&
    (w.available ? integer(w.sourceRound, Math.max(1, round - 1), round) && w.observations > w.uses : w.sourceRound === null);
}
/** Audit only the finite paid actions/member effects, not a second injury engine. */
export function validateWeatherWarlockRoundOutcome(value: unknown): value is WeatherWarlockRoundOutcome {
  try {
    const o = value as WeatherWarlockRoundOutcome;
    if (!shape(o, ['targetId', 'round', 'source', 'stance', 'policy', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus',
          'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerMindAfter', 'enemySpiritualityBefore', 'powerUses',
          'weaknessAfter', 'linkCost', 'linkedMemberIds', 'linkedMemberIdsAfter', 'teamContribution', 'payments', 'membersAfter', 'share', 'sharedHealthDamage',
          'terrainAfter', 'weatherFieldUsed', 'elapsedSeconds', 'playerActions', 'enemyActions']) ||
        !validSource(o.source) || o.targetId !== WEATHER_WARLOCK_TARGET_ID || o.round !== o.source.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || !['HOLD', 'LINK_IF_READY'].includes(o.policy) || typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 ||
        ![o.enemyHealth, o.playerHealthAfter, o.playerMindAfter].every(n => integer(n, 0, 100)) || !integer(o.enemyMind, 1, 100) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        ![o.playerSpiritualityBefore, o.playerSpiritualityAfter, o.enemySpiritualityBefore, o.enemySpirituality].every(n => integer(n, 0, 120)) || o.playerMindAfter !== o.source.playerMind || o.playerHealthAfter > o.source.playerHealth ||
        o.enemyMind !== o.source.enemyMind || o.enemyHealth > o.source.enemyHealth ||
        (o.continuing && (o.playerHealthAfter === 0 || o.enemyStatus !== 'RESISTING')) ||
        !validWeatherWarlockTerrain(o.terrainAfter) || typeof o.weatherFieldUsed !== 'boolean' ||
        !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6 || !Array.isArray(o.linkedMemberIdsAfter) || o.linkedMemberIdsAfter.length !== 0 ||
        o.enemySpiritualityBefore !== 120 - WEATHER_WARLOCK_POWERS.reduce((n, p) => n + o.source.powerUses[p.id] * p.cost, 0)) return false;
    const m = initialModel(o.source, o.playerSpiritualityBefore, o.enemySpiritualityBefore, o.policy);
    const all = [...o.playerActions.map(a => ({ actor: 'PLAYER', action: a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY', action: a }))].sort((a, b) => a.action.order - b.action.order);
    for (const [i, item] of all.entries()) {
      const a = item.action; if (a.order !== i || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1) return false;
      let expected: WeatherWarlockPlayerAction | WeatherWarlockEnemyAction;
      if (item.actor === 'PLAYER') { const p = a as WeatherWarlockPlayerAction; if (!allowed(p.id)) return false; expected = playerAction(o.source, m, p.id, p.physicalFactor, i); }
      else { const e = a as WeatherWarlockEnemyAction; if (![...WEATHER_WARLOCK_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(e.planned)) return false; expected = enemyAction(m, e.planned, e.physicalFactor, i); }
      if (stableStringify(a) !== stableStringify(expected)) return false;
    }
    if (o.share) {
      if (!shape(o.share, ['originalDamage', 'ownerDamage', 'severity', 'sharedDamage']) || !m.linkCost || !['LIGHT', 'HEAVY'].includes(o.share.severity) ||
          o.share.originalDamage !== Math.min(o.source.playerHealth, o.share.severity === 'LIGHT' ? 10 : 30)) return false;
      const shared = shareModel(m, o.share.originalDamage);
      if (o.share.sharedDamage !== shared || o.share.ownerDamage !== o.share.originalDamage - shared || o.sharedHealthDamage !== shared || o.playerHealthAfter !== o.source.playerHealth - o.share.ownerDamage) return false;
    } else if (o.share !== null || o.sharedHealthDamage !== 0) return false;
    const w = m.weakness; if (w.available && (!o.continuing || w.sourceRound === null || w.sourceRound < o.round)) { w.available = false; w.sourceRound = null; }
    return o.playerSpiritualityAfter === m.playerSpirituality && o.enemySpirituality === m.enemySpirituality && o.linkCost === m.linkCost && o.teamContribution === m.teamContribution &&
      stableStringify(o.linkedMemberIds) === stableStringify(m.linkedMemberIds) && stableStringify(o.powerUses) === stableStringify(m.powerUses) && stableStringify(o.weaknessAfter) === stableStringify(w) &&
      stableStringify(o.payments) === stableStringify(m.payments) && stableStringify(o.membersAfter) === stableStringify(m.members) &&
      stableStringify(o.terrainAfter) === stableStringify(m.terrain) && o.weatherFieldUsed === m.weatherFieldUsed;
  } catch { return false; }
}
