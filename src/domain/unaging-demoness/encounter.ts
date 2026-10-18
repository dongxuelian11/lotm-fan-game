import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasUnagingDemonessRitualLock, hasUnagingDemonessOldPractice } from './index.js';
import { hasUnagingDemonessLifeLock } from './life.js';
import { unagingDemonessActionCount, unagingDemonessEnemyActionCount, validateUnagingDemonessRoundOutcome } from './combat.js';

export const UNAGING_DEMONESS_TARGET_ID = 'UD3-CORBIN' as const;
export const UNAGING_DEMONESS_POWER_IDS = ['FORCE_STRIKE', 'SEAL_MIRROR', 'BREAK_MIRROR'] as const;
export type UnagingDemonessPowerId = typeof UNAGING_DEMONESS_POWER_IDS[number];
export type UnagingDemonessEnemyIntent = UnagingDemonessPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const UNAGING_DEMONESS_POWERS = [
  { id: 'FORCE_STRIKE', label: '原创G有限灵性冲击', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'SEAL_MIRROR', label: '原创G原三次预算有限封镜', cost: 4, selfGain: 0, enemyReduction: 0 },
  { id: 'BREAK_MIRROR', label: '原创G实际击碎唯一原镜B一次', cost: 5, selfGain: 0, enemyReduction: 0 },
] as const;
export interface UnagingDemonessEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface UnagingDemonessEncounterScene {
  courtId: 'UD3-COURT'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean; playerPosition: 'A' | 'B' | 'EXIT';
  mirrorA: { id: 'UD3-COMBAT-A'; intact: true }; mirrorB: { id: 'UD3-COMBAT-B'; intact: boolean };
  mirrorsDistanceMetres: 2; exits: { A: 2; B: 4 }; ordinaryWalkedMetres: number; mirrorPassedMetres: number;
}
export interface UnagingDemonessEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof UNAGING_DEMONESS_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: UnagingDemonessEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'COURT'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<UnagingDemonessPowerId, number>;
  sealReady: boolean; silkPrepared: boolean; terminal: UnagingDemonessEncounterTerminal | null;
}
export type UnagingDemonessEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface UnagingDemonessEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UnagingDemonessEncounterCommand }
export interface UnagingDemonessEncounterProjection {
  title: string; story: string; status: UnagingDemonessEncounterState['status']; inside: boolean; scene: UnagingDemonessEncounterScene | null;
  enemy: null | { id: typeof UNAGING_DEMONESS_TARGET_ID; name: '科宾·里德'; age: 49; source: 'ORIGINAL_LIMITED_G'; sequence: 3;
    health: number; mind: number; spirituality: number; status: UnagingDemonessEncounterState['enemyStatus'];
    weaponId: 'UD3-CORBIN-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<UnagingDemonessPowerId, number> };
  actions: UnagingDemonessEncounterAction[]; facts: string[];
}
export const UNAGING_DEMONESS_ENCOUNTER_STORY = '成年科宾·里德（49岁，UD3-CORBIN）在净空原小院UD3-COURT持自己的唯一原棍UD3-CORBIN-ROD提出争议。他是独立原创有限G3等效对手，H100/M100/S120，并非旧瓦伦复活。两面原镜UD3-COMBAT-A/B确在场、相距2米，科宾位于两点各2米的原位置；普通出口距A2米、B4米，无追逐、没有第三人在场。玩家只将旧瘟疫20槽换成镜路20，保留黑焰30/冰霜15/旧小镜或粉替身20/实体丝线10/失衡5及真实原成本。镜路6S/知识18，成功同一身体经2米原路换位，仅本轮减势36G，不同时攻击；失败实耗，封/碎镜回退原地普通避让0S。敌冲击5S/70G，封镜4S仅下一次原通行、最多三次，碎B5S仅一次；已碎原镜不可反复付费打碎、不免费修复。双方1–6行动、共同伤势/死亡/撤退，所有人物、场景、距离与定量G；不提供任意全球传送、自动免伤或新免费复活。';
export function createUnagingDemonessEncounterState(): UnagingDemonessEncounterState {
  return { status: 'AVAILABLE', targetId: UNAGING_DEMONESS_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    scene: { courtId: 'UD3-COURT', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: 'A',
      mirrorA: { id: 'UD3-COMBAT-A', intact: true }, mirrorB: { id: 'UD3-COMBAT-B', intact: true }, mirrorsDistanceMetres: 2,
      exits: { A: 2, B: 4 }, ordinaryWalkedMetres: 0, mirrorPassedMetres: 0 },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { FORCE_STRIKE: 0, SEAL_MIRROR: 0, BREAK_MIRROR: 0 }, sealReady: false, silkPrepared: false, terminal: null };
}
export const createUnagingDemonessEncounter = createUnagingDemonessEncounterState;
const stage = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 3;
const hasUnagingDemonessHistory = (s: SliceState) => s.progression.pathwayId === 'demoness' && [3, 2].includes(s.progression.sequence ?? 0);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateUnagingDemonessEncounterCommand(v: unknown): v is UnagingDemonessEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isUnagingDemonessEncounterCommand = validateUnagingDemonessEncounterCommand;
export const hasUnagingDemonessEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.unagingDemoness.encounter.status);
export const isInsideUnagingDemonessEncounter = hasUnagingDemonessEncounterLock;
function otherSceneOpen(s: SliceState): boolean { return hasUnagingDemonessRitualLock(s) || hasUnagingDemonessLifeLock(s) || Object.values(s.unagingDemoness.life.cases).some(r => r.status === 'PREPARED') || hasUnagingDemonessOldPractice(s); }
function actualCourt(e: UnagingDemonessEncounterState, confirmed = true): boolean {
  const v = e.scene;
  return !!v && v.courtId === 'UD3-COURT' && v.ordinaryExit === 'OPEN' && v.thirdPartiesInArea === 0 && ['A', 'B', 'EXIT'].includes(v.playerPosition) &&
    (!confirmed || v.clearanceConfirmed === true) && v.mirrorA?.id === 'UD3-COMBAT-A' && v.mirrorA.intact === true && v.mirrorB?.id === 'UD3-COMBAT-B' && typeof v.mirrorB.intact === 'boolean' &&
    v.mirrorsDistanceMetres === 2 && same(v.exits, { A: 2, B: 4 }) && integer(v.ordinaryWalkedMetres) && integer(v.mirrorPassedMetres) && v.mirrorPassedMetres % 2 === 0;
}
export function blockUnagingDemonessEncounter(s: SliceState, c: UnagingDemonessEncounterCommand): string | null {
  if (!validateUnagingDemonessEncounterCommand(c)) return '不老魔女遭遇命令无效。';
  const e = s.unagingDemoness.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为不老魔女·魔女序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.unagingDemoness.guidanceKnown || s.unagingDemoness.promotionWeek === null) return '须保有米蕾尔的实际指导并完成不老魔女晋升。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原净空小院。';
  if (otherSceneOpen(s)) return '先实际收束当前实践、准备与原物借还。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status !== 'READY' ? '须先到场交谈，才能沿原普通出口和平离开。' : e.scene.ordinaryExit !== 'OPEN' ? '原普通出口须确实畅通。' : null;
  if (!actualCourt(e, e.status === 'READY')) return '须原两镜、原小院与普通出口实际存在，并确认第三人在界外。';
  if (s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原科宾已有进展或结局，不重新生成或补充资源。' : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原科宾、原棍、原镜和普通出口。';
}
export const unagingDemonessEncounterReason = blockUnagingDemonessEncounter;
export function applyUnagingDemonessEncounterCommand(s: SliceState, c: UnagingDemonessEncounterCommand, ctx: SeerContext): void {
  const reason = blockUnagingDemonessEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.unagingDemoness.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; e.scene.ordinaryWalkedMetres += e.scene.playerPosition === 'B' ? 4 : 2; e.scene.playerPosition = 'EXIT';
    ctx.note('沿原普通出口和平离开', '本人从A实际普通走2米离开，无追逐、瞬移或奖励；原科宾H100/M100/S120、原棍与两镜留原场，旧瓦伦投降和照护历史不改。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原科宾实际交谈', UNAGING_DEMONESS_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'UNAGING_DEMONESS_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原小院的真实冲突', '双方使用同一原身体、独立原武器与实际灵性。两原镜可反制、可永久破损；共同伤势、死亡与普通撤退无豁免。');
}
export const applyUnagingDemonessEncounter = applyUnagingDemonessEncounterCommand;
export function startUnagingDemonessEncounter(s: SliceState, ctx: SeerContext): void { applyUnagingDemonessEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasUnagingDemonessDisputeOpponent(s: SliceState): boolean {
  const e = s.unagingDemoness?.encounter, c = s.combat;
  return s.unagingDemoness.guidanceKnown && s.unagingDemoness.promotionWeek !== null && stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === UNAGING_DEMONESS_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' && actualCourt(e) && e.scene.playerPosition !== 'EXIT' &&
    e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'UNAGING_DEMONESS_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(s.unagingDemoness.life.clockSeconds) && integer(e.enemySpirituality, 0, 120) && UNAGING_DEMONESS_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.powerUses.SEAL_MIRROR <= 3 && e.powerUses.BREAK_MIRROR <= 1 && e.scene.mirrorB.intact === (e.powerUses.BREAK_MIRROR === 0) &&
    e.enemySpirituality === 120 - UNAGING_DEMONESS_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleUnagingDemonessEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.unagingDemoness.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'UNAGING_DEMONESS_DISPUTE') throw new Error('没有同一原科宾的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原小院战斗结果。');
  const last = c.lastRound, o = last?.unagingDemonessOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateUnagingDemonessRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
    s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
    !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk || !same(o.sceneAfter, e.scene) || !same(o.toolsAfter, s.witch.tools) || e.sealReady || e.silkPrepared ||
    o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || o.lifeClockSecondsAfter !== s.unagingDemoness.life.clockSeconds ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
    (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE'))) throw new Error('真实原身体、原镜与资源不符已保存回合结果。');
  e.terminal = { outcome: outcome as UnagingDemonessEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原小院冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，留实际原点，不复活或自动返回。' : '仍活着的本人从实际原点经A2米/B4米普通开放出口离开，无追逐、瞬移或夺棍。'}科宾原健康${e.enemyHealth}、灵性${e.enemySpirituality}、原伤势与原镜B${e.scene.mirrorB.intact ? '完好' : '已碎'}保持；本轮定位优势/封镜/丝线停止，不治疗、不修镜。旧瓦伦H60/S12投降与实际照护史不改。`);
}
export function unagingDemonessEncounterActions(s: SliceState): UnagingDemonessEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原小院交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原科宾真实冲突', '1行动 · 真实受伤或死亡风险'], ['LEAVE_ENCOUNTER', '沿A外2米原出口和平离开', '0行动 · 实际普通走路']] as const).map(([type, label, cost]) => {
    const command: UnagingDemonessEncounterCommand = { type }, reason = blockUnagingDemonessEncounter(s, command);
    return { id: `unagingDemoness-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectUnagingDemonessEncounter(s: SliceState): UnagingDemonessEncounterProjection {
  const e = s.unagingDemoness.encounter;
  if (!hasUnagingDemonessHistory(s)) return { title: '尚未开放的不老魔女遭遇', story: '', status: e.status, inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { title: '原小院与独立的科宾·里德', story: UNAGING_DEMONESS_ENCOUNTER_STORY, status: e.status, inside: hasUnagingDemonessEncounterLock(s), scene: structuredClone(e.scene),
    enemy: { id: UNAGING_DEMONESS_TARGET_ID, name: '科宾·里德', age: 49, source: 'ORIGINAL_LIMITED_G', sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality,
      status: e.enemyStatus, weaponId: 'UD3-CORBIN-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: unagingDemonessEncounterActions(s),
    facts: ['不老与镜界通行方向有原核；本场技巧、原人物和所有距离、资源与数值均为有限原创G',
      '两原镜相距2米；A普通出口2米，B普通出口4米；无墙体穿越或追逐',
      '镜路成功只减势36G，不同时攻击；失败实耗6S，封/碎镜0S普通回退。原碎镜持久，不免费修复',
      `科宾已用冲击${e.powerUses.FORCE_STRIKE}次、封镜${e.powerUses.SEAL_MIRROR}/3次、碎B${e.powerUses.BREAK_MIRROR}/1次；封镜${e.sealReady ? '等待下一次原通行触发' : '未生效'}`,
      '继承替身只耗实际旧库存小镜/粉，不消费院内原镜；旧瓦伦投降与疾病照护历史保留',
      `原科宾保留${e.enemyInjuries.length}处真实伤势；结局${e.terminal?.outcome ?? (e.status === 'RESOLVED' ? '普通和平离开' : '尚未终结')}，原棍${e.weaponLocation === 'HAND' ? '本人持有' : '留原院'}`,
      `本人累计镜路${e.scene.mirrorPassedMetres}米、普通离场${e.scene.ordinaryWalkedMetres}米；战斗累计${s.combatHistory.reduce((n, r) => n + (r.unagingDemonessOutcome?.elapsedSeconds ?? 0), 0)}秒，无免费治疗或复活`] };
}
/** Save validation replays the ordered original actions, their cost and spatial consequences. */
export function validateUnagingDemonessEncounter(s: SliceState): boolean {
  try {
    const e = s.unagingDemoness?.encounter, initial = createUnagingDemonessEncounterState();
    if (!e || !same(Object.keys(e).sort(), Object.keys(initial).sort()) || e.targetId !== UNAGING_DEMONESS_TARGET_ID ||
      !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !actualCourt(e, e.status !== 'AVAILABLE') || !same(Object.keys(e.scene).sort(), Object.keys(initial.scene).sort()) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'COURT') || !Array.isArray(e.enemyInjuries) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || !UNAGING_DEMONESS_POWER_IDS.every(id => integer(e.powerUses[id])) || e.powerUses.SEAL_MIRROR > 3 || e.powerUses.BREAK_MIRROR > 1 ||
      e.scene.mirrorB.intact !== (e.powerUses.BREAK_MIRROR === 0) || typeof e.sealReady !== 'boolean' || typeof e.silkPrepared !== 'boolean' || (e.sealReady && (!e.scene.mirrorB.intact || e.powerUses.SEAL_MIRROR === 0)) ||
      e.enemySpirituality !== 120 - UNAGING_DEMONESS_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'UNAGING_DEMONESS_DISPUTE';
    if (!hasUnagingDemonessHistory(s) || !s.unagingDemoness.guidanceKnown || s.unagingDemoness.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.unagingDemoness.promotionWeek) return false;
    if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
      (e.status === 'READY' ? e.scene.playerPosition === 'A' && e.scene.ordinaryWalkedMetres === 0 : e.scene.playerPosition === 'EXIT' && e.scene.ordinaryWalkedMetres === 2) &&
      same({ ...e, status: initial.status, approachWeek: null, scene: { ...e.scene, clearanceConfirmed: false, playerPosition: 'A', ordinaryWalkedMetres: 0 } }, initial) && s.combat?.encounterId !== 'UNAGING_DEMONESS_DISPUTE';
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    for (const [i, round] of rounds.entries()) {
      const o = round.unagingDemonessOutcome, previous = rounds[i - 1]?.unagingDemonessOutcome;
      if (!validateUnagingDemonessRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null ||
        o.source.runId !== s.runId || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || (i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS'))) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
        o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality || !same(o.source.powerUses, previous.powerUses) ||
        !same(o.source.scene, previous.sceneAfter) || !same(o.source.tools, previous.toolsAfter) || o.source.sealReady !== previous.sealReadyAfter || o.source.silkPrepared !== previous.silkPreparedAfter ||
        !same(o.source.enemyInjuries, previous.enemyInjuriesAfter) || o.source.enemyRisk !== previous.enemyRiskAfter || o.source.lifeClockSeconds !== previous.lifeClockSecondsAfter ||
        ['knowledge', 'perception', 'mastery', 'clubHeld'].some(k => !same(o.source[k as keyof typeof o.source], previous.source[k as keyof typeof previous.source]))
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.enemyInjuries.length !== 0 || o.source.enemyRisk !== 0 ||
          o.source.sealReady || o.source.silkPrepared || !same(o.source.scene, { ...initial.scene, clearanceConfirmed: true })) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      const first = round.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
      if (!integer(round.playerCountRoll, 1, 100) || !integer(round.enemyCountRoll, 1, 100) || round.first !== first || round.playerCount !== unagingDemonessActionCount(round.playerCountRoll) ||
        round.enemyCount !== unagingDemonessEnemyActionCount(round.enemyCountRoll) || !same(moves, round.moves)) return false;
      const expectedActors: ('PLAYER' | 'ENEMY')[] = [], remaining = { PLAYER: round.playerCount, ENEMY: round.enemyCount };
      const order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
      let retreated = false;
      while (!retreated && (remaining.PLAYER > 0 || remaining.ENEMY > 0)) {
        for (const actor of order) {
          if (remaining[actor] === 0) continue;
          if (actor === 'PLAYER' && round.stance === 'RETREAT') { remaining.PLAYER = 0;
            if (round.retreat === 'SUCCESS') { retreated = true; break; }
            if (round.retreat !== 'FAILURE') return false;
          } else { remaining[actor]--; expectedActors.push(actor); }
        }
      }
      if ((round.stance !== 'RETREAT' && round.retreat !== 'NONE') || !same(expectedActors, moves.map(a => a.actor))) return false;
    }
    const last = rounds.at(-1), o = last?.unagingDemonessOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses) ||
      !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk || !same(o.sceneAfter, e.scene) || o.sealReadyAfter !== e.sealReady || o.silkPreparedAfter !== e.silkPrepared)) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasUnagingDemonessDisputeOpponent(s) &&
      (o ? o.continuing && same(last, s.combat!.lastRound) && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter &&
        s.unagingDemoness.life.clockSeconds === o.lifeClockSecondsAfter && same(s.witch.tools, o.toolsAfter)
        : s.combat!.lastRound === null && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyInjuries.length === 0 && e.enemyRisk === 0 &&
          !e.sealReady && !e.silkPrepared && same(e.scene, { ...initial.scene, clearanceConfirmed: true }));
    const t = e.terminal;
    if (s.combat?.encounterId === 'UNAGING_DEMONESS_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
      t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus || e.sealReady || e.silkPrepared) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0 && e.scene.playerPosition === 'EXIT';
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && e.scene.playerPosition !== 'EXIT';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && e.scene.playerPosition === 'EXIT' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
