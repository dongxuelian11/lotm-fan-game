import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceState, SliceWheelEntry } from '../slice/types.js';
import type { MagicianCombatEffect } from '../magician/combat.js';
import type { MarionettistMoveId } from '../marionettist/combat.js';
import { currentBizarroAttempt, dismissBizarroWitnesses, hasBizarroRitualOpponent } from './ritual.js';

export const BIZARRO_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '2', label: '2次', weight: 20 }), Object.freeze({ id: '3', label: '3次', weight: 50 }), Object.freeze({ id: '4', label: '4次', weight: 30 }),
]);
export const BIZARRO_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: 'B4-CURTAIN-BLADE', label: '幕刃：2灵性，100×身体；不足时原爪24×身体（G）', weight: 45 }),
  Object.freeze({ id: 'B4-VEIL', label: '幻壳：4灵性，最多一层原身体诱像；不足则观察（G）', weight: 35 }),
  Object.freeze({ id: 'B4-EXTINGUISH', label: '灭灯息：5灵性，灭原灯；再次成功掀原幕遮视线（G）', weight: 15 }),
  Object.freeze({ id: 'B4-STUMBLE', label: '踉跄：0贡献，不回复灵性（G）', weight: 5 }),
]);
export type BizarroEnemyMove = 'B4-CURTAIN-BLADE' | 'B4-VEIL' | 'B4-EXTINGUISH' | 'B4-STUMBLE';
export interface BizarroRoundContext { diversion: boolean }
export const createBizarroRoundContext = (): BizarroRoundContext => ({ diversion: false });
export const bizarroEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export function drawBizarroEnemyAbility(random: ActionRandomStream): BizarroEnemyMove {
  const roll = random.nextInt(1, 100); return roll <= 45 ? 'B4-CURTAIN-BLADE' : roll <= 80 ? 'B4-VEIL' : roll <= 95 ? 'B4-EXTINGUISH' : 'B4-STUMBLE';
}
const none = (label: string): MagicianCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
export function resolveBizarroEnemyAbility(s: SliceState, id: BizarroEnemyMove, physical: number, round: BizarroRoundContext): MagicianCombatEffect {
  if (!hasBizarroRitualOpponent(s)) return none('帷幕兽：同场原身体来源失效，本槽不生成替身或攻击');
  const r = s.bizarroSorcerer.ritual, factor = Math.max(0, Math.min(1, Number.isFinite(physical) ? physical : 0));
  if (id === 'B4-CURTAIN-BLADE') {
    const powered = r.enemySpirituality >= 2; if (powered) r.enemySpirituality -= 2;
    const diverted = powered && round.diversion; if (diverted) round.diversion = false;
    return { label: `${powered ? '幕刃：原兽耗2灵性，以真实幕刃攻击，优势+100×身体' : '原兽灵性不足2：同一身体原爪攻击，优势+24×身体'}（G）${diverted ? '；此前本人的有限幻术诱导本次幕刃偏转，贡献减半，但仍有物理威胁' : ''}`,
      selfGain: (powered ? 100 : 24) * factor * (diverted ? 0.5 : 1), enemyReduction: 0, threatens: factor > 0 };
  }
  if (id === 'B4-VEIL') {
    if (r.enemySpirituality < 4) return none('幻壳：原兽剩余灵性不足4，本槽观察，不重抽、不恢复');
    r.enemySpirituality -= 4; r.veil = true;
    return none('幻壳：原兽耗4灵性，只维持同一原身体的一层诱像，不复制活体。下一普通/空气/纸攻击会击中幻壳；真实灵体线或原火可辨明烧穿');
  }
  if (id === 'B4-EXTINGUISH') {
    if (r.enemySpirituality < 5) return none('灭灯息：原兽灵性不足5，本槽观察，不重抽、不恢复');
    r.enemySpirituality -= 5;
    if (round.diversion) { round.diversion = false; return none('灭灯息：原兽耗5灵性，扑向先前本人耗2灵性造出的假灯；一次诱导已消耗，真实原灯与看台视线保留'); }
    if (s.magician.lantern.prepared) {
      s.magician.lantern.prepared = false;
      return none('灭灯息：原兽耗5灵性吹灭同一原油灯，已用灯油不退；真实火法失去落点。日光看台仍能亲见，本次灭灯不等于全场失明');
    }
    r.witnesses.viewObstructed = true;
    dismissBizarroWitnesses(s, '原灯已灭后的灭灯息掀起原舞台布幕，遮断看台与原战区的真实视线');
    return none('灭灯息：原兽耗5灵性，吹起8米场内同一原布幕遮断日光看台视线。36名原观众沿原石阶实际退出，本场仪式永久失效；不是30米外法术直伤或保护罩，战斗仍须真实自保或撤退');
  }
  return none('帷幕兽踉跄：本次贡献0，有限灵性不恢复');
}
/** Counterplay wraps an already-paid original inherited action; facts and
 * numeric costs, never descriptive labels, decide whether its spell happened. */
export function applyBizarroPlayerCounterplay(
  s: SliceState, id: MarionettistMoveId | 'diviner.s4.worm-assignment' | 'diviner.s4.puppet-swap',
  effect: MagicianCombatEffect, spiritualityBefore: number, round: BizarroRoundContext,
): MagicianCombatEffect {
  if (!hasBizarroRitualOpponent(s)) return effect;
  const r = s.bizarroSorcerer.ritual;
  let result = effect;
  if (id === 'diviner.s7.illusion' && spiritualityBefore - s.spirituality === 2) {
    round.diversion = true;
    result = none('有限幻术：本人已耗2灵性，留下本轮下一次幕刃/灭灯息的一次诱导；替换旧固定减势，不回改之前攻击、不叠层、不取消对方行动');
  }
  if (id === 'diviner.s5.spirit-threads' && spiritualityBefore - s.spirituality === 2) {
    r.veil = false; const learned = s.progression.mastery[id] ?? 0;
    result = { ...none('灵体线辨真：耗本人2灵性，从同一原实体的灵体线识破幻壳；高位原兽仅有限减势12×掌握（G），不初控、不积累转化、不强迫投降'), enemyReduction: 12 * (0.65 + 0.35 * Math.max(0, Math.min(500, learned)) / 500) };
  } else if (r.veil && id === 'diviner.s7.flame-control' && spiritualityBefore - s.spirituality === 2 && result.threatens) {
    r.veil = false; result = { ...result, label: `${result.label}；这同一次真实原火烧穿幻壳，仍只有一个已付费攻击` };
  } else if (r.veil && result.threatens && ['STRIKE', 'diviner.s8.body-control', 'diviner.s7.air-bullet', 'diviner.s8.paper-dagger', 'diviner.s7.paper-weapon'].includes(id)) {
    r.veil = false; result = none(`${result.label}；攻击击中一层幻壳，该次已付纸张/灵性保留，贡献与本次致伤许可0，幻壳消耗；不撤销此前攻击`);
  }
  if (result.threatens) { const a = currentBizarroAttempt(s); if (a) a.playerAttackCount += 1; }
  return result;
}
export function projectBizarroCombat(s: SliceState) {
  const r = s.bizarroSorcerer.ritual, t = r.targets.find(t => t.id === r.currentTargetId);
  return { enemyName: `${t?.name ?? '原钟帷幕兽'}（原创G，序列4等价超凡生物）`, enemySpirituality: r.enemySpirituality,
    veil: r.veil, witnessesPresent: r.witnesses.presentIds.length, invalidReason: r.invalidReason,
    originalBellId: t?.originalBellId ?? '', mode: r.mode };
}
