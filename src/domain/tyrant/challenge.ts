import type { PublicCheckResult } from '../../shared/contracts.js';
import { emptyTyrantEffect, type TyrantEffect, type TyrantHost, type TyrantSceneInjury } from './coasts.js';

/** A genuine, independently hostile OTHER sequence-zero deity. The Tyrant seat
 * remains vacant; the Sun is neither its uniqueness nor a cooperative actor.
 * The bounded sixty-metre encounter and every cost below are original game rules. */
export const TYRANT_CHALLENGE_LOCATION = 'TYRANT0-SUN-CHALLENGE';
export const TYRANT_CHALLENGE_EXIT_METERS = 60;
export const TYRANT_CHALLENGE_COMMANDS = ['BEGIN', 'STRIKE', 'WITHDRAW', 'RETREAT', 'BREAK_CONTACT'] as const;
export type TyrantChallengeCommand = { type: typeof TYRANT_CHALLENGE_COMMANDS[number] };
export interface TyrantChallengeExchange {
  eventId: string; revision: number; week: number; second: number; command: TyrantChallengeCommand['type'];
  from: number; to: number; walkedMeters: number; check: PublicCheckResult;
  playerAttack: 'LIGHTNING_CHALLENGE' | 'LIGHTNING_STRIKE' | null;
  enemyAction: 'SOLAR_LANCE' | 'PURSUIT_FLARE' | 'HORIZON_BRAND';
  enemySpiritualityCost: number; enemyHealthLoss: number; playerHealthLoss: number; effect: TyrantEffect;
}
export interface TyrantChallengeState {
  version: 1; runId: string; actorId: string; startWeek: number; lastSecond: number;
  location: typeof TYRANT_CHALLENGE_LOCATION;
  status: 'UNSTARTED' | 'ENGAGED' | 'ESCAPED' | 'DEAD';
  position: number; totalWalkedMeters: number;
  opponent: { id: 'TYRANT0-OTHER-SUN'; name: string; pathway: 'sun'; sequence: 0; status: 'ACTIVE' | 'DEAD';
    health: number; spirituality: number; disposition: 'HOSTILE'; motive: string; pursuitCount: number };
  participants: { actorId: string; role: 'CHALLENGER' | 'HOSTILE_DEITY' }[];
  challengeEventId: string | null; startedWeek: number | null;
  escape: { eventId: string; week: number; second: number; health: number; position: 60; walkedMeters: number } | null;
  injuries: TyrantSceneInjury[]; exchanges: TyrantChallengeExchange[];
}
export function validateTyrantChallengeCommand(value: unknown): value is TyrantChallengeCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  return Object.keys(c).join('|') === 'type' && TYRANT_CHALLENGE_COMMANDS.some(t => t === c.type);
}
export function createTyrantChallenge(runId: string, actorId: string, startWeek: number, nowSecond: number): TyrantChallengeState {
  return { version: 1, runId, actorId, startWeek, lastSecond: nowSecond, location: TYRANT_CHALLENGE_LOCATION,
    status: 'UNSTARTED', position: 0, totalWalkedMeters: 0,
    opponent: { id: 'TYRANT0-OTHER-SUN', name: '太阳真神', pathway: 'sun', sequence: 0, status: 'ACTIVE', health: 1000, spirituality: 10000,
      disposition: 'HOSTILE', motive: '将闯入者视为对神权的真实挑战，主动攻击并拦截退路；不会配合完成仪式。', pursuitCount: 0 },
    participants: [], challengeEventId: null, startedWeek: null, escape: null, injuries: [], exchanges: [] };
}
export const tyrantChallengeNeedsCheck = (_c: TyrantChallengeCommand): boolean => true;
/** Preflight costs exclude contingent injury but include all committed debits.
 * The independently hostile action determines actual injury in the reducer. */
export function tyrantChallengeCost(_s: TyrantChallengeState, c: TyrantChallengeCommand, _h: TyrantHost): TyrantEffect {
  const e = emptyTyrantEffect();
  if (c.type === 'BEGIN') { e.actions = 1; e.spirituality = 12; e.seconds = 30; }
  else if (c.type === 'STRIKE') { e.spirituality = 8; e.seconds = 20; }
  else if (c.type === 'WITHDRAW') { e.spirituality = 4; e.seconds = 20; }
  else if (c.type === 'RETREAT') e.seconds = 30;
  else e.seconds = 10;
  return e;
}
export function tyrantChallengeBlock(s: TyrantChallengeState, c: TyrantChallengeCommand, h: TyrantHost): string | null {
  if (!validateTyrantChallengeCommand(c)) return '无效挑战指令；不能指定真神配合、同伴、伤害、走过的距离或逃脱结果。';
  if (h.actorId !== s.actorId || h.status !== 'ACTIVE' || h.health <= 0 || h.sequence !== 1 || h.location !== s.location) return '须同一在世序列1雷神亲自到真实太阳真神的敌对现场；序列2不能进入挑战。';
  if (s.status === 'ESCAPED' || s.status === 'DEAD') return '这次原挑战已经结束，不重置原神、伤势或逃生历史。';
  if (!Number.isSafeInteger(h.nowSecond) || h.nowSecond < s.lastSecond || h.week < s.startWeek || h.nowSecond < h.weekAnchor || h.nowSecond >= h.weekAnchor + 604800 || (s.exchanges.at(-1)?.revision ?? -1) >= h.revision || s.exchanges.some(x => x.eventId === h.eventId)) return '现场时间、版本或事件已失效，不能重用同一次交换。';
  if (s.opponent.id === (s.actorId as string) || s.opponent.sequence !== 0 || s.opponent.pathway !== 'sun' || s.opponent.disposition !== 'HOSTILE' || s.opponent.status !== 'ACTIVE' || s.opponent.health <= 0) return '对方必须是独立、仍在世且真正敌对的另一途径真神。';
  const e = tyrantChallengeCost(s, c, h);
  if (h.cash < e.cashCost || h.actions < e.actions || h.spirituality < e.spirituality) return '实际行动或灵性不足；普通撤退不耗行动或灵性，但仍遭真实截击。';
  if (c.type === 'BEGIN') return s.status !== 'UNSTARTED' || s.challengeEventId !== null ? '已作出真实挑战，不能再支付开场来重置敌人。' : null;
  if (s.status !== 'ENGAGED' || s.participants.length !== 2 || s.participants[0]?.actorId !== s.actorId || s.participants[0]?.role !== 'CHALLENGER' || s.participants[1]?.actorId !== s.opponent.id || s.participants[1]?.role !== 'HOSTILE_DEITY') return '先由本人单独发起实际敌对挑战；有其他协助者的记录不能冒充单独挑战。';
  if (c.type === 'BREAK_CONTACT') return s.position !== TYRANT_CHALLENGE_EXIT_METERS ? '须本人实际走到60米遮蔽出口，再面对最后一次敌对截击尝试脱离。' : null;
  if (s.position === TYRANT_CHALLENGE_EXIT_METERS) return '本人已到60米出口，须尝试实际脱离；未脱离前仍不算存活完成。';
  return null;
}
const ordinal = (c: PublicCheckResult) => c.tier === 'GREAT_SUCCESS' ? 0 : c.tier === 'SUCCESS' ? 1 : c.tier === 'FAILURE' ? 2 : 3;
export function applyTyrantChallenge(previous: TyrantChallengeState, c: TyrantChallengeCommand, h: TyrantHost): { state: TyrantChallengeState; effect: TyrantEffect; notes: string[]; injuries: TyrantSceneInjury[] } {
  const blocked = tyrantChallengeBlock(previous, c, h); if (blocked) throw Error(blocked);
  if (!h.check) throw Error('每次真实敌对交换必须消费中央随机流的独立检定。');
  const s = structuredClone(previous), e = tyrantChallengeCost(s, c, h), notes: string[] = [], injuries: TyrantSceneInjury[] = [];
  const tier = ordinal(h.check), from = s.position;
  const enemyAction: TyrantChallengeExchange['enemyAction'] = s.position < 20 ? 'SOLAR_LANCE' : s.position < 45 ? 'PURSUIT_FLARE' : 'HORIZON_BRAND';
  // Independent enemy policy spends its own finite power. No compliant answer,
  // encounter-count victory or user-provided damage is accepted.
  const enemySpiritualityCost = Math.min(s.opponent.spirituality, enemyAction === 'SOLAR_LANCE' ? 12 : enemyAction === 'PURSUIT_FLARE' ? 16 : 20);
  s.opponent.spirituality -= enemySpiritualityCost; s.opponent.pursuitCount++;
  const playerAttack = c.type === 'BEGIN' ? 'LIGHTNING_CHALLENGE' as const : c.type === 'STRIKE' ? 'LIGHTNING_STRIKE' as const : null;
  const enemyHealthLoss = playerAttack ? Math.min(s.opponent.health, [24, 12, 0, 0][tier]!) : 0;
  s.opponent.health -= enemyHealthLoss;
  if (s.opponent.health <= 0) s.opponent.status = 'DEAD';
  const healthByCommand = { BEGIN: [4, 8, 16, 26], STRIKE: [6, 10, 18, 28], WITHDRAW: [4, 7, 12, 20], RETREAT: [6, 10, 15, 24], BREAK_CONTACT: [3, 6, 12, 20] } as const;
  // Even a successful defence pays real health. Exhausting hostile spirituality
  // leaves physical divine retaliation, rather than a harmless inert prop.
  e.health = Math.max(1, healthByCommand[c.type][tier]! - (enemySpiritualityCost === 0 ? 2 : 0));
  if (c.type === 'BEGIN') { s.status = 'ENGAGED'; s.challengeEventId = h.eventId; s.startedWeek = h.week; s.participants = [{ actorId: s.actorId, role: 'CHALLENGER' }, { actorId: s.opponent.id, role: 'HOSTILE_DEITY' }]; }
  const movement = c.type === 'WITHDRAW' ? [20, 15, 5, 0][tier]! : c.type === 'RETREAT' ? [30, 20, 10, 5][tier]! : 0;
  const walkedMeters = Math.min(TYRANT_CHALLENGE_EXIT_METERS - s.position, movement);
  s.position += walkedMeters; s.totalWalkedMeters += walkedMeters;
  const newHealth = Math.max(0, h.health - e.health);
  if (tier >= 2 || e.health >= 10) {
    const injury: TyrantSceneInjury = { id: `${h.eventId}:solar-interception`, severity: tier === 3 || e.health >= 20 ? 'HEAVY' : 'LIGHT', acquiredRevision: h.revision, treatedRevision: null };
    s.injuries.push(injury); injuries.push(injury);
  }
  const completionWeek = h.week + Math.floor((h.nowSecond + e.seconds - h.weekAnchor) / 604800);
  if (newHealth <= 0) { s.status = 'DEAD'; notes.push('真实截击令本人健康归零，挑战以死亡终止；不能把走到出口、轮数或报告当成存活。'); }
  else if (c.type === 'BREAK_CONTACT' && tier < 2) { s.status = 'ESCAPED'; s.escape = { eventId: h.eventId, week: completionWeek, second: h.nowSecond + e.seconds, health: newHealth, position: 60, walkedMeters: s.totalWalkedMeters }; notes.push('本人实际走完60米并撑过最后截击，进入岩隙遮蔽后脱离；保留真实健康与伤势。太阳真神仍存活并敌对，不需要杀死祂。'); }
  else if (c.type === 'BREAK_CONTACT') { s.position = 45; s.totalWalkedMeters += 15; notes.push('最后截击封住出口，本人被迫沿实路退回15米至45米处；尚未脱离，可以继续真实冒险撤退。'); }
  notes.push(`${s.opponent.name}独立使用${enemyAction === 'SOLAR_LANCE' ? '太阳长枪' : enemyAction === 'PURSUIT_FLARE' ? '追猎焰光' : '地平线烙印'}，实耗自身${enemySpiritualityCost}灵性；本人付${e.spirituality}灵性、${e.health}健康和${e.seconds}秒。${playerAttack ? `本人实际发出雷击，对方损失${enemyHealthLoss}健康。` : ''}本人位置${from}→${s.position}米，出口60米。`);
  s.lastSecond = h.nowSecond + e.seconds;
  s.exchanges.push({ eventId: h.eventId, revision: h.revision, week: completionWeek, second: s.lastSecond, command: c.type,
    from, to: s.position, walkedMeters: walkedMeters + (c.type === 'BREAK_CONTACT' && tier >= 2 && newHealth > 0 ? 15 : 0), check: structuredClone(h.check),
    playerAttack, enemyAction, enemySpiritualityCost, enemyHealthLoss, playerHealthLoss: e.health, effect: structuredClone(e) });
  return { state: s, effect: e, notes, injuries };
}
export function tyrantChallengeReceipt(s: TyrantChallengeState) {
  const opening = s.exchanges.find(x => x.eventId === s.challengeEventId && x.command === 'BEGIN' && x.playerAttack === 'LIGHTNING_CHALLENGE');
  const exit = s.exchanges.find(x => x.eventId === s.escape?.eventId && x.command === 'BREAK_CONTACT' && (x.check.tier === 'SUCCESS' || x.check.tier === 'GREAT_SUCCESS'));
  let position = 0, walkedMeters = 0;
  const physicalHistory = s.exchanges.every(x => {
    const valid = x.from === position && Number.isSafeInteger(x.to) && x.to >= 0 && x.to <= 60 && x.walkedMeters === Math.abs(x.to - x.from)
      && x.playerHealthLoss > 0 && x.playerHealthLoss === x.effect.health && x.effect.seconds > 0;
    position = x.to; walkedMeters += x.walkedMeters; return valid;
  });
  if (!physicalHistory || position !== 60 || walkedMeters !== s.totalWalkedMeters || s.exchanges[0] !== opening || s.exchanges.at(-1) !== exit || s.opponent.id !== 'TYRANT0-OTHER-SUN' || s.status !== 'ESCAPED' || !s.escape || s.escape.health <= 0 || s.escape.position !== 60 || s.position !== 60 || s.totalWalkedMeters < 60 || !opening || !exit || s.participants.length !== 2 || s.participants[0]?.actorId !== s.actorId || s.participants[0]?.role !== 'CHALLENGER' || s.participants[1]?.actorId !== s.opponent.id || s.participants[1]?.role !== 'HOSTILE_DEITY' || s.opponent.id === (s.actorId as string) || s.opponent.sequence !== 0 || s.opponent.pathway !== 'sun' || s.opponent.disposition !== 'HOSTILE' || s.opponent.status !== 'ACTIVE' || s.opponent.health <= 0) return null;
  return { actorId: s.actorId, opponentId: s.opponent.id, opponentPathway: s.opponent.pathway, opponentSequence: 0 as const, challengeEventId: opening.eventId,
    escapedEventId: s.escape.eventId, escapedWeek: s.escape.week, escapedSecond: s.escape.second, healthOnEscape: s.escape.health,
    walkedMeters: s.totalWalkedMeters, hostileExchanges: s.exchanges.length };
}
export const canLeaveTyrantChallenge = (s: TyrantChallengeState): boolean => s.status !== 'ENGAGED';
export const tyrantChallengeComplete = (s: TyrantChallengeState): boolean => tyrantChallengeReceipt(s) !== null;
export function projectTyrantChallenge(s: TyrantChallengeState) {
  return { id: 'tyrant-challenge', title: '单独挑战另一真神并实际存活', lines: [
    `对手${s.opponent.name}：独立太阳途径序列0，${s.opponent.status === 'ACTIVE' ? '仍在世' : '已死'}，真实敌对；健康${s.opponent.health}，灵性${s.opponent.spirituality}。暴君唯一性仍属于空缺神位。`,
    `本人距开场${s.position}米，遮蔽出口60米；累计实际行走${s.totalWalkedMeters}米。${s.status === 'UNSTARTED' ? '尚未挑战' : s.status === 'ENGAGED' ? '敌对交换进行中，不能直接离场或领取存活证明' : s.status === 'ESCAPED' ? '已实际脱离并存活' : '本人死亡'}。`,
    `${s.exchanges.length}次实际敌对交换，${s.injuries.length}份原伤势记录；没有固定轮数自动胜利。普通撤退不耗行动或灵性，仍要付时间并承受真神截击。`,
    '可以还击、付灵性掩护后撤，或直接冒险撤退；到出口还需独立脱离检定。无需杀死对方。',
  ] };
}
export function getTyrantChallengeActions(s: TyrantChallengeState, h: TyrantHost) {
  const labels: Record<TyrantChallengeCommand['type'], string> = { BEGIN: '独自发出真实雷击挑战', STRIKE: '付灵性继续还击', WITHDRAW: '付灵性掩护并后撤', RETREAT: '沿原路普通撤退', BREAK_CONTACT: '撑过出口截击并脱离' };
  return TYRANT_CHALLENGE_COMMANDS.map(type => { const command: TyrantChallengeCommand = { type }, e = tyrantChallengeCost(s, command, h), reason = tyrantChallengeBlock(s, command, h); return {
    command, label: labels[type], cost: `${e.actions}行动、${e.spirituality}灵性、${e.seconds}秒；真实敌对截击仍会损失健康并可能受伤或死亡`, enabled: reason === null, reason,
    preferredAction: reason === null && (s.status === 'UNSTARTED' ? type === 'BEGIN' : s.position === 60 ? type === 'BREAK_CONTACT' : h.spirituality >= 4 ? type === 'WITHDRAW' : type === 'RETREAT'),
  }; });
}
// Narrow aliases ease chapter integration without introducing another reducer.
export const applyTyrantChallengeCommand = applyTyrantChallenge;
export const blockTyrantChallengeCommand = tyrantChallengeBlock;
