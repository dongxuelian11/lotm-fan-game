import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { marauderPlayerHoldsClub } from '../marauder/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import {
  currentSwindlerCombatSource, resolveSwindlerCombatAbility, swindlerAbilityWheel,
  type SwindlerActionRemainder, type SwindlerCombatEffect, type SwindlerCombatSource,
} from '../swindler/combat.js';

/** ERROR_NUMERIC_BASELINE_V1 S7: U45, A1/E0.7. All contribution budgets are G. */
export const CRYPTOLOGIST_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 20 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
  Object.freeze({ id: '6', label: '6次', weight: 12 }),
]);
export type CryptologistMoveId = 'BODY_STRIKE' | 'MISDIRECT' | 'error.s7.decryption'
  | 'DECEIT' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: CryptologistMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '针对已解动作弱点行动（仅本轮已实际发生的普通打击/寻找空当；45f；否则普通身体12；0灵性）', weight: 18, stance: 'ATTACK' },
  { id: 'MISDIRECT', label: '承接误导', weight: 12, stance: 'ATTACK' },
  { id: 'error.s7.decryption', label: '识破已见战术（至多31.5f且不超过本轮已观察尚未抵消的正向贡献；无来源则普通格挡10；0灵性）', weight: 32, stance: 'DEFEND' },
  { id: 'DECEIT', label: '让对手误判已知信息', weight: 25, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '解读本轮已观察普通事实', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '普通动作解读偏差（±11.25；当前无危险解密源，0灵性、不判伤）', weight: 5, stance: null },
];
export function isCryptologist(state: SliceState): boolean {
  return state.progression?.pathwayId === 'error' && state.progression.sequence === 7;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function cryptologistAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  const inherited = swindlerAbilityWheel(stance, state);
  return ABILITIES.map((ability, index) => {
    const inheritedLabel = inherited.find(entry => entry.id === ability.id)?.label;
    return { id: ability.id, label: ability.id === 'MISDIRECT' || ability.id === 'DECEIT'
      ? `${ability.label}；${inheritedLabel}`
      : ability.id === 'OBSERVE'
      ? `${ability.label}（只复述已发生动作；不揭示隐藏信息）；${inheritedLabel}；解读不另获即时贡献`
      : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 };
  });
}
export function drawCryptologistAbility(random: ActionRandomStream, stance: SliceStance | null): CryptologistMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('解密学者能力盘权重无效');
}
export function cryptologistActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 45 ? 3 : roll <= 68 ? 4 : roll <= 88 ? 5 : 6;
}
export function currentCryptologistCombatSource(state: SliceState): SwindlerCombatSource | null {
  return isCryptologist(state) ? currentSwindlerCombatSource(state) : null;
}
function validSource(state: SliceState, source: SwindlerCombatSource | null): boolean {
  const current = currentCryptologistCombatSource(state);
  return current !== null && source !== null && current.runId === source.runId &&
    current.revision === source.revision && current.week === source.week && current.round === source.round &&
    current.encounterId === source.encounterId && current.target === source.target &&
    current.nature === source.nature && current.body === source.body && current.speech === source.speech &&
    current.space === source.space && current.exit === source.exit;
}

type ObservedMoveId = 'STRIKE' | 'BLOCK' | 'OPENING' | 'DISTANCE' | 'MISS';
const OBSERVED_FACTS: Readonly<Record<ObservedMoveId, string>> = Object.freeze({
  STRIKE: '已实际近身打击，出手接近的动作已经显露',
  BLOCK: '已实际格挡护身，护持姿态已经显露',
  OPENING: '已实际寻找空当，调整站位的动作已经显露',
  DISTANCE: '已实际拉开距离，退开的动作已经显露',
  MISS: '刚才的普通动作已经落空',
});
/**
 * FIRST_CASE has no authored dangerous artifact or hidden-ability puzzle.
 * G: the only decodable combat facts are ordinary moves already resolved in
 * this round. Each B can offset at most its budget and the accumulated positive
 * contribution of those STRIKE/OPENING moves, never the same contribution twice.
 * H can use each observed attack's exposed approach at most once; it does not
 * predict its next use. This ledger is resolver-local, never rebuilt from labels, old history,
 * daily knowledge, a future ability draw, or the opponent's hidden pool.
 * The inherited K/R preparation separately remains valid for the whole fight.
 */
export interface CryptologistRoundObservations {
  source: SwindlerCombatSource | null;
  lastMove: ObservedMoveId | null;
  lastAttack: 'STRIKE' | 'OPENING' | null;
  attackWindows: ('STRIKE' | 'OPENING')[];
  unansweredThreat: number;
}
export function createCryptologistRoundObservations(state: SliceState): CryptologistRoundObservations {
  return { source: currentCryptologistCombatSource(state), lastMove: null, lastAttack: null, attackWindows: [], unansweredThreat: 0 };
}
/** Call only after an actual, unsuppressed ordinary action. Does not draw or inspect another slot. */
export function observeCryptologistEnemyAction(
  state: SliceState, observations: CryptologistRoundObservations, id: string, actualSelfGain: number,
): void {
  if (!validSource(state, observations.source) || !Object.hasOwn(OBSERVED_FACTS, id)) return;
  observations.lastMove = id as ObservedMoveId;
  if ((id === 'STRIKE' || id === 'OPENING') && Number.isFinite(actualSelfGain) && actualSelfGain > 0) {
    observations.lastAttack = id;
    observations.attackWindows.push(id);
    observations.unansweredThreat += Math.min(id === 'STRIKE' ? 16 : 8, actualSelfGain);
  }
}
function masteryFactor(state: SliceState): number {
  const value = state.progression.mastery['error.s7.decryption'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0)) / 500;
}
function noEffect(label: string): SwindlerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function validAttack(observations: CryptologistRoundObservations): boolean {
  return observations.lastAttack === 'STRIKE' || observations.lastAttack === 'OPENING';
}
export function resolveCryptologistCombatAbility(
  state: SliceState, id: CryptologistMoveId, physicalStateFactor: number, random: ActionRandomStream,
  remaining: SwindlerActionRemainder,
  observations: CryptologistRoundObservations = createCryptologistRoundObservations(state),
  source: SwindlerCombatSource | null = currentCryptologistCombatSource(state),
): SwindlerCombatEffect {
  if (!validSource(state, source)) return noEffect('解密学者行动：缺少本场存活、可见且可交流的普通对手，本次贡献0、不耗灵性、不重抽');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const observed = validSource(state, observations.source);
  switch (id) {
    case 'BODY_STRIKE': {
      const stolenClub = marauderPlayerHoldsClub(state), armed = state.town.clubLocation === 'HAND' || stolenClub;
      const exposedAttack = observed ? observations.attackWindows[0] : undefined;
      const qualified = exposedAttack === 'STRIKE' || exposedAttack === 'OPENING';
      if (qualified && !armed) observations.attackWindows.shift();
      const selfGain = (armed ? 16 : qualified ? 45 * masteryFactor(state) : 12) * physical;
      return { label: stolenClub
        ? `针对已见动作行动：持握塞蒙原短棍${state.marauder.dispute.weapon.id} v${state.marauder.dispute.weapon.version}，普通短棍16贡献（G）替换而不叠加主攻预算，所有权仍属塞蒙；耗0灵性`
        : armed ? '针对已见动作行动：持握原短棍打击，普通16贡献（G）替换而不叠加主攻预算；耗0灵性'
        : qualified ? `针对已解弱点行动：${OBSERVED_FACTS[exposedAttack!]}；只解读该已见身体接近方式后实际近身打击，45×解密掌握系数×身体状态（G），耗0灵性；该已见动作的主攻机会已消费，不重复领取；不预知下一动作、不复制或窃取能力`
        : '针对已解弱点行动：本轮尚无可解读的已发生普通打击/寻找空当，按预写保底进行普通身体打击12×身体状态（G）；耗0灵性、不重抽、不凭空揭示弱点',
      selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'error.s7.decryption': {
      if (!observed || !validAttack(observations)) return {
        ...noEffect('识破已见战术：本轮尚无合格的已发生正向普通动作，按预写保底普通格挡10（G）；耗0灵性，不读取隐藏池或未来技能'),
        enemyReduction: 10,
      };
      const available = Number.isFinite(observations.unansweredThreat) ? Math.max(0, observations.unansweredThreat) : 0;
      const enemyReduction = Math.min(31.5 * masteryFactor(state), available);
      observations.unansweredThreat = available - enemyReduction;
      return { ...noEffect(`识破已见战术：${OBSERVED_FACTS[observations.lastAttack!]}；一次解明这项普通已见事实，用31.5×解密掌握系数预算抵消尚未抵消的已观察正向贡献，实际减势${enemyReduction}（G），剩余${observations.unansweredThreat}；耗0灵性、不重复领取、不抹除已经发生的动作、不取消下一次能力、不揭示秘密或复制技能`), enemyReduction };
    }
    case 'MISDIRECT':
    case 'DECEIT':
      return resolveSwindlerCombatAbility(state, id, physical, random, remaining, source);
    case 'OBSERVE': {
      const inherited = resolveSwindlerCombatAbility(state, 'OBSERVE', physical, random, remaining, source);
      const fact = observed && observations.lastMove !== null && Object.hasOwn(OBSERVED_FACTS, observations.lastMove)
        ? `已解读本轮普通事实：${OBSERVED_FACTS[observations.lastMove]}`
        : '本轮尚无可复述的已实际发生普通事实，不补造线索';
      return { ...inherited, label: `${fact}；${inherited.label}；本槽只使用上述一份K/R预算，解读不另获贡献、不读取未来动作或隐藏能力池` };
    }
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`普通动作解读偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G）；当前普通携铃者没有登记危险解密源，耗0灵性，不触发反向注视、定位或污染，不构成致伤攻击、不建立骗局准备`), selfGain };
    }
  }
}
