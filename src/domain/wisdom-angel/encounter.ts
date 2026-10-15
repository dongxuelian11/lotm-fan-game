import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import type { MysticismMagisterCraft } from '../mysticism-magister/types.js';
import { hasProphetLifeLock } from '../prophet/life.js';
import { hasInsightScholarLifeLock } from '../insight-scholar/life.js';
import { hasWisdomAngelLifeLock } from './life.js';
import { validateWisdomAngelRoundOutcome, validateWisdomAngelCombatRound, validateWisdomAngelAbilityUses, validateWisdomAngelObservations } from './combat.js';

export const WISDOM_ANGEL_TARGET_ID = 'WA2-VICTOR' as const;
export const WISDOM_ANGEL_POWER_IDS = ['FLASH', 'WARD', 'FEINT'] as const;
export type WisdomAngelPowerId = typeof WISDOM_ANGEL_POWER_IDS[number];
export type WisdomAngelEnemyIntent = WisdomAngelPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const WISDOM_ANGEL_POWERS = [
  { id: 'FLASH', label: '有限闪光', cost: 7, selfGain: 105, enemyReduction: 0 },
  { id: 'WARD', label: '有限护术', cost: 6, selfGain: 0, enemyReduction: 60 },
  { id: 'FEINT', label: '本轮实际改变节奏', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface WisdomAngelEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface WisdomAngelAbilityUse { attempts: number; successes: number; effects: number }
export interface WisdomAngelAbilityUses { SYNTHESIS: WisdomAngelAbilityUse; RESPONSE: WisdomAngelAbilityUse }
export interface WisdomAngelObservation { power: 'FLASH' | 'WARD'; round: number; order: number; atSeconds: number; conditionVersion: number; paidCost: 7 | 6 }
export interface WisdomAngelResponseWindow { openedRound: number; openedOrder: number; expiresAt: number; conditionVersion: number; targetPower: 'FLASH' | 'WARD'; observation: WisdomAngelObservation }
export interface WisdomAngelEncounterRoom { id: 'WA2-COURT'; doorId: 'WA2-COURT-DOOR'; doorStatus: 'OPEN' }
export interface WisdomAngelEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof WISDOM_ANGEL_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<WisdomAngelPowerId, number>;
  terminal: WisdomAngelEncounterTerminal | null;
  room: WisdomAngelEncounterRoom; playerLocation: 'OUTSIDE' | 'DOORSTEP'; playerTravelMetres: number; clockSeconds: number; abilityUses: WisdomAngelAbilityUses; conditionVersion: number; observations: WisdomAngelObservation[]; responseWindow: WisdomAngelResponseWindow | null;
}
export type WisdomAngelEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface WisdomAngelEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WisdomAngelEncounterCommand }
export interface WisdomAngelEncounterProjection {
  title: string; story: string; status: WisdomAngelEncounterState['status']; inside: boolean;
  enemy: null | { id: typeof WISDOM_ANGEL_TARGET_ID; name: '维克托'; age: 49; source: 'ORIGINAL_OPEN_COURT_ADULT'; sequence: 2;
    health: number; mind: number; spirituality: number; status: WisdomAngelEncounterState['enemyStatus'];
    weaponId: 'WA2-VICTOR-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<WisdomAngelPowerId, number> };
  actions: WisdomAngelEncounterAction[]; facts: string[];
  room: WisdomAngelEncounterRoom | null; playerLocation: 'OUTSIDE' | 'DOORSTEP'; playerTravelMetres: number; clockSeconds: number; abilityUses: WisdomAngelAbilityUses; conditionVersion: number; observations: WisdomAngelObservation[]; responseWindow: WisdomAngelResponseWindow | null;
}
export const WISDOM_ANGEL_ENCOUNTER_STORY = '原创49岁维克托WA2-VICTOR（有限G2，身体核心24）持自己的唯一原棍WA2-VICTOR-CLUB，独立H100/M100/S120，站在WA2-COURT普通开放门口。本人实际步行2米/2秒到原门槛，双方原身体始终2米可达；离开同样须实际步行，不是房间或能力瞬移。智慧天使·阅读者序列2候选的名称编号、新能力与数值均为未原著核实G。条件综合5S/知识20只能比较当前条件已经实际亲见的FLASH和WARD，成功65G站位优势，本身不是致伤攻击；已见方法应对6S/知识20只能据最近实际已见原术开≤20秒窗口，本槽0贡献，下一真实敌槽消费，只有当前条件相符的实付原术减45G。维克托FLASH7S/105G、WARD6S/60G、变招3S每轮一次，真实改变动作节奏和条件版本，结束当前窗口但不回滚此前结果。继承原方法辨析5S/知识18减35，真实学会原FLASH2S/知识14减12×旧掌握，实际持有微光片耗尽减18×制作固定效力。双方六槽与敌五类轮盘使用公开真实权重，共同胜负、伤势与死亡规则；旧阿尔顿和平结局、哈罗德原身体和全部原物保持。';

export function createWisdomAngelEncounterState(): WisdomAngelEncounterState {
  return { status: 'AVAILABLE', targetId: WISDOM_ANGEL_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { FLASH: 0, WARD: 0, FEINT: 0 }, terminal: null,
    room: { id: 'WA2-COURT', doorId: 'WA2-COURT-DOOR', doorStatus: 'OPEN' },
    playerLocation: 'OUTSIDE', playerTravelMetres: 0, clockSeconds: 0, abilityUses: { SYNTHESIS: { attempts: 0, successes: 0, effects: 0 }, RESPONSE: { attempts: 0, successes: 0, effects: 0 } }, conditionVersion: 1, observations: [], responseWindow: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateWisdomAngelEncounterCommand(v: unknown): v is WisdomAngelEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isWisdomAngelEncounterCommand = validateWisdomAngelEncounterCommand;
export const hasWisdomAngelEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.wisdomAngel.encounter.status);
export const isInsideWisdomAngelEncounter = hasWisdomAngelEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return s.wisdomAngel.preparedWeek !== null || hasWisdomAngelLifeLock(s) ||
    s.insightScholar.preparedWeek !== null || hasInsightScholarLifeLock(s) || Object.values(s.insightScholar.life.cases).some(r => r.status === 'PREPARED') ||
    ['READY','FIGHTING'].includes(s.insightScholar.encounter.status) || hasProphetLifeLock(s) || Object.values(s.prophet.life.cases).some(r => r.status === 'PREPARED') ||
    ['READY','FIGHTING'].includes(s.prophet.encounter.status) || s.prophet.ritual.playerLocation !== 'OUTSIDE' || s.prophet.life.pages.location !== 'TABLE' ||
    Object.values(s.mysticismMagister.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    Object.values(s.polymath.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    s.mysticismMagister.practice.token !== 'OWNER' || s.mysticismMagister.practice.dreamOpen;
}
export function blockWisdomAngelEncounter(s: SliceState, c: WisdomAngelEncounterCommand): string | null {
  if (!validateWisdomAngelEncounterCommand(c)) return '智慧天使候选G遭遇命令无效。';
  const e = s.wisdomAngel.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为智慧天使候选G2。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德维克托原庭WA2-COURT的普通门口。';
  if (otherSceneOpen(s)) return '先实际收束当前及旧实践、准备和原物借还。';
  if (e.room.doorStatus !== 'OPEN') return '原门受阻，不能伪称普通离场。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && e.playerLocation === 'DOORSTEP' ? null : '须先到场交谈，才能普通和平离开。';
  if (s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原维克托已有进展或结局，不重新生成或补充资源。'
    : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍和普通出口。';
}
export const wisdomAngelEncounterReason = blockWisdomAngelEncounter;
export function applyWisdomAngelEncounterCommand(s: SliceState, c: WisdomAngelEncounterCommand, ctx: SeerContext): void {
  const reason = blockWisdomAngelEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.wisdomAngel.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; e.playerLocation = 'OUTSIDE'; e.playerTravelMetres += 2; e.clockSeconds += 2; ctx.note('沿原门实际步行2米和平离开', '本人普通步行2米/2秒离开，没有追逐或战斗奖励；原维克托及自己的原棍留场，旧阿尔顿和平结局、哈罗德原身体和全部旧原物历史保留。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.playerLocation = 'DOORSTEP'; e.playerTravelMetres += 2; e.clockSeconds += 2; ctx.note('与原维克托实际交谈', WISDOM_ANGEL_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'WISDOM_ANGEL_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原门口的真实冲突', '双方用同一原身体、原棍与独立实际灵性交战。原FLASH须真实已学，旧原片须实际持有；共同伤势、死亡、撤退无豁免。');
}
export const applyWisdomAngelEncounter = applyWisdomAngelEncounterCommand;
export function startWisdomAngelEncounter(s: SliceState, ctx: SeerContext): void { applyWisdomAngelEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasWisdomAngelDisputeOpponent(s: SliceState): boolean {
  const e = s.wisdomAngel?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === WISDOM_ANGEL_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    same(e.room, createWisdomAngelEncounterState().room) && e.playerLocation === 'DOORSTEP' && e.playerTravelMetres === 2 && e.clockSeconds === 2 + ((c?.round ?? 0) - 1) * 60 &&
    e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'WISDOM_ANGEL_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(e.enemySpirituality, 0, 120) && WISDOM_ANGEL_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    validateWisdomAngelObservations(e.observations,e.conditionVersion,e.powerUses,c.round) &&
    e.enemySpirituality === 120 - WISDOM_ANGEL_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleWisdomAngelEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.wisdomAngel.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'WISDOM_ANGEL_DISPUTE') throw new Error('没有同一原维克托的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原庭战斗结果。');
  const last = c.lastRound, o = last?.wisdomAngelOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateWisdomAngelRoundOutcome(o) || !validateWisdomAngelCombatRound(last) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.craftsAfter, s.mysticismMagister.crafts) ||
      !same(o.abilityUses, e.abilityUses) || !same(o.observations,e.observations) || o.conditionVersion !== e.conditionVersion || e.responseWindow !== null || o.playerLocationAfter !== e.playerLocation || o.playerTravelMetresAfter !== e.playerTravelMetres || o.clockSecondsAfter !== e.clockSeconds ||
      !same(o.playerInjuriesAfter, s.injuries) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyRiskAfter !== e.enemyRisk ||
      o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('真实原身体、旧原片或资源与已保存战斗结果不符。');
  e.terminal = { outcome: outcome as WisdomAngelEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原庭冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，条件综合与应对不复活。' : outcome === 'RETREATED' ? '本人沿净空普通出口离开，无追逐或瞬移。' : outcome === 'ENEMY_DEAD' ? '原维克托真实死亡，自己的唯一原棍留场。' : '原维克托仍活着，因真实重伤停止抵抗，把自己的唯一原棍放在原院。'}本轮窗口已实际收束，旧观察与原片消耗保留；实付灵性及共同伤势保留，旧阿尔顿、哈罗德及原人原物不改。`);
}
export function wisdomAngelEncounterActions(s: SliceState): WisdomAngelEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '步行到原门口交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原维克托的真实冲突', '1行动 · 真实受伤或死亡风险'],
    ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => {
    const command: WisdomAngelEncounterCommand = { type }, reason = blockWisdomAngelEncounter(s, command);
    return { id: `wisdomAngel-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectWisdomAngelEncounter(s: SliceState): WisdomAngelEncounterProjection {
  const e = s.wisdomAngel.encounter;
  if (!stage(s)) return { title: '尚未开放的智慧天使候选G遭遇', story: '', status: e.status, inside: false, enemy: null, actions: [], facts: [], room: null, playerLocation: e.playerLocation, playerTravelMetres: e.playerTravelMetres, clockSeconds: e.clockSeconds, abilityUses: structuredClone(e.abilityUses), conditionVersion: e.conditionVersion, observations: structuredClone(e.observations), responseWindow: structuredClone(e.responseWindow) };
  return { title: '原门口与独立的维克托', story: WISDOM_ANGEL_ENCOUNTER_STORY, status: e.status, inside: hasWisdomAngelEncounterLock(s),
    enemy: { id: WISDOM_ANGEL_TARGET_ID, name: '维克托', age: 49, source: 'ORIGINAL_OPEN_COURT_ADULT', sequence: 2, health: e.enemyHealth,
      mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'WA2-VICTOR-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    room: { ...e.room }, playerLocation: e.playerLocation, playerTravelMetres: e.playerTravelMetres, clockSeconds: e.clockSeconds, abilityUses: structuredClone(e.abilityUses), conditionVersion: e.conditionVersion, observations: structuredClone(e.observations), responseWindow: structuredClone(e.responseWindow),
    actions: wisdomAngelEncounterActions(s), facts: ['普通原庭WA2-COURT与实际开放门口，普通进出各2米/2秒',
      '当前条件的真实已见记录才可用于新能力；变招保留旧观察但使当前模型失效', '成功开窗不等于应用；下一真实敌槽消费，匹配实付原术才减45G',
      '双方独立S120、共同次数与伤势盘；旧阿尔顿和平结局、哈罗德原身体和全部旧原物不改'] };

}
/** Original pieces may be consumed later, never regenerated or replaced after this encounter. */
function preservesOriginalCrafts(history: MysticismMagisterCraft[], current: MysticismMagisterCraft[], week: number): boolean {
  return history.every(old => {
    const actual = current.find(c => c.id === old.id);
    return actual !== undefined && actual.sourceKitId === old.sourceKitId && actual.createdWeek === old.createdWeek && actual.power === old.power &&
      (old.status === 'CONSUMED' ? same(actual,old) : actual.status === 'PLAYER' ? same(actual,old) : actual.status === 'CONSUMED' && integer(actual.usedWeek,week));
  });
}
/** Validate only this original encounter's bounded history; later fights never extend its terminal window. */
export function validateWisdomAngelEncounter(s: SliceState): boolean {
  try {
    const e = s.wisdomAngel?.encounter, initial = createWisdomAngelEncounterState();
    if (!e || !same(Object.keys(e).sort(),Object.keys(initial).sort()) || e.targetId !== WISDOM_ANGEL_TARGET_ID || !same(e.room,initial.room) ||
        !['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status) || !['OUTSIDE','DOORSTEP'].includes(e.playerLocation) ||
        !integer(e.playerTravelMetres) || !integer(e.clockSeconds) || !validateWisdomAngelAbilityUses(e.abilityUses) || e.responseWindow !== null ||
        !integer(e.enemyHealth,0,100) || e.enemyMind !== 100 || !integer(e.enemySpirituality,0,120) || !integer(e.enemyRisk) ||
        !['RESISTING','SURRENDERED','DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
        e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD') || !Array.isArray(e.enemyInjuries) ||
        !e.powerUses || !same(Object.keys(e.powerUses).sort(),[...WISDOM_ANGEL_POWER_IDS].sort()) || !WISDOM_ANGEL_POWER_IDS.every(id => integer(e.powerUses[id])) ||
        e.enemySpirituality !== 120 - WISDOM_ANGEL_POWERS.reduce((n,p) => n + e.powerUses[p.id]*p.cost,0) ||
        !validateWisdomAngelObservations(e.observations,e.conditionVersion,e.powerUses,Math.max(0,Math.floor((e.clockSeconds-2)/60))) ||
        [e.approachWeek,e.attemptWeek].some(w => w !== null && !integer(w,1,s.week))) return false;
    const allNew = s.combatHistory.flatMap((r,i) => r.wisdomAngelOutcome ? [i] : []);
    if (e.status === 'AVAILABLE') return same(e,initial) && allNew.length === 0 && s.combat?.encounterId !== 'WISDOM_ANGEL_DISPUTE';
    if (!stage(s) || s.wisdomAngel.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.wisdomAngel.promotionWeek) return false;
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED';
      return (ready || peaceful) && e.attemptWeek === null && e.terminal === null && allNew.length === 0 &&
        e.playerLocation === (ready ? 'DOORSTEP' : 'OUTSIDE') && e.playerTravelMetres === (ready ? 2 : 4) && e.clockSeconds === (ready ? 2 : 4) &&
        same({ ...e,status: initial.status,approachWeek: null,playerLocation: initial.playerLocation,playerTravelMetres: 0,clockSeconds: 0 },initial) &&
        s.combat?.encounterId !== 'WISDOM_ANGEL_DISPUTE' && (!ready || s.status === 'ACTIVE' && s.world.city === 'BACKLUND' && !otherSceneOpen(s));
    }
    if (!integer(e.startHistoryIndex,0,s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    if (e.terminal && (!same(Object.keys(e.terminal).sort(),['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus'].sort()) ||
        !integer(e.terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1))) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex,end);
    if (!same(allNew,rounds.map((_r,i) => e.startHistoryIndex! + i))) return false;
    for (const [i,round] of rounds.entries()) {
      const o = round.wisdomAngelOutcome, previous = rounds[i-1]?.wisdomAngelOutcome;
      if (!validateWisdomAngelRoundOutcome(o) || !validateWisdomAngelCombatRound(round) || round.round !== i+1 ||
          o.source.runId !== s.runId || o.source.randomSeed !== s.random.seed || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor ||
          o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
          (i < rounds.length-1 && !o.continuing)) return false;
      if (previous) {
        if (o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind ||
            o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
            o.playerSpiritualityBefore !== Math.min(120,previous.playerSpiritualityAfter+12) || o.enemySpiritualityBefore !== previous.enemySpirituality ||
            !same(o.source.powerUses,previous.powerUses) || !same(o.source.abilityUses,previous.abilityUses) || !same(o.source.crafts,previous.craftsAfter) || !same(o.source.observations,previous.observations) || o.source.conditionVersion !== previous.conditionVersion ||
            !same(o.source.playerInjuries,previous.playerInjuriesAfter) || !same(o.source.enemyInjuries,previous.enemyInjuriesAfter) ||
            o.source.playerRisk !== previous.playerRiskAfter || o.source.enemyRisk !== previous.enemyRiskAfter ||
            o.source.clockSeconds !== previous.clockSecondsAfter || o.source.playerTravelMetres !== previous.playerTravelMetresAfter ||
            o.source.randomCursor !== previous.randomCursorAfter || o.source.revision !== previous.source.revision+1 ||
            !['physique','perception','knowledge','will','imitationMastery','clubHeld','craftingPromotionWeek','craftingCaseStatus','kitsUsed','flashSample'].every(key =>
              same(o.source[key as keyof typeof o.source],previous.source[key as keyof typeof previous.source]))) return false;
      } else if (o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || o.source.enemyRisk !== 0 || o.source.enemyInjuries.length !== 0 ||
          !same(o.source.powerUses,initial.powerUses) || !same(o.source.abilityUses,initial.abilityUses) || o.source.conditionVersion !== 1 || o.source.observations.length !== 0) return false;
    }
    const last = rounds.at(-1), o = last?.wisdomAngelOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus ||
        !same(o.powerUses,e.powerUses) || !same(o.abilityUses,e.abilityUses) || !same(o.observations,e.observations) || o.conditionVersion !== e.conditionVersion || !same(o.enemyInjuriesAfter,e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk ||
        o.playerLocationAfter !== e.playerLocation || o.playerTravelMetresAfter !== e.playerTravelMetres || o.clockSecondsAfter !== e.clockSeconds)) return false;
    if (e.status === 'FIGHTING') {
      if (e.terminal !== null || !hasWisdomAngelDisputeOpponent(s)) return false;
      if (!o) return s.combat!.lastRound === null && same(e.powerUses,initial.powerUses) && same(e.abilityUses,initial.abilityUses) && e.conditionVersion === 1 && e.observations.length === 0 &&
        e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyRisk === 0 && e.enemyInjuries.length === 0;
      return o.continuing && same(o.craftsAfter,s.mysticismMagister.crafts) && same(last,s.combat!.lastRound) &&
        same(o.playerInjuriesAfter,s.injuries) && o.playerRiskAfter === s.injuryRisk && o.playerHealthAfter === s.health && o.playerMindAfter === s.mind &&
        Math.min(120,o.playerSpiritualityAfter+12) === s.spirituality && o.randomCursorAfter === s.random.cursor;
    }
    if (o && (!preservesOriginalCrafts(o.craftsAfter,s.mysticismMagister.crafts,o.source.week) || !same(o.source.flashSample,s.polymath.samples.FLASH))) return false;
    const t = e.terminal;
    if (s.combat?.encounterId === 'WISDOM_ANGEL_DISPUTE' || !t || !last || !o || o.continuing || t.round !== last.round || rounds.length !== t.round ||
        t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
