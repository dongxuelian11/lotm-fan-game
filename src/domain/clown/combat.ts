import { hasBizarroRitualOpponent } from '../bizarro-sorcerer/ritual.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Playable S8 balance values, not claims about quantitative canon. */
export const CLOWN_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 25 }),
  Object.freeze({ id: '3', label: '3次', weight: 30 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
  Object.freeze({ id: '5', label: '5次', weight: 10 }),
]);

export type ClownMoveId = 'diviner.s8.body-control' | 'diviner.s8.balance'
  | 'diviner.s8.agility' | 'diviner.s8.danger-prediction' | 'diviner.s8.paper-dagger'
  | 'diviner.s9.spiritual-sight' | 'OBSERVE' | 'MISS';

interface ClownAbility {
  id: ClownMoveId;
  label: string;
  weight: number;
  stance: SliceStance | null;
}

// No firearm exists in this slice. Inherited divination and knowledge remain
// event abilities; neither becomes free rapid casting or an extra combat turn.
const CLOWN_ABILITIES: readonly ClownAbility[] = [
  { id: 'diviner.s8.body-control', label: '体术/身体控制', weight: 24, stance: 'ATTACK' },
  { id: 'diviner.s8.balance', label: '平衡闪避', weight: 16, stance: 'DEFEND' },
  { id: 'diviner.s8.agility', label: '敏捷调位', weight: 14, stance: 'PREPARE' },
  { id: 'diviner.s8.danger-prediction', label: '危险预感', weight: 14, stance: 'CONTROL' },
  { id: 'diviner.s8.paper-dagger', label: '纸飞刀', weight: 14, stance: 'ATTACK' },
  { id: 'diviner.s9.spiritual-sight', label: '灵视', weight: 6, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察', weight: 8, stance: 'PREPARE' },
  { id: 'MISS', label: '失误', weight: 4, stance: null },
];

export function isClown(state: SliceState): boolean {
  return state.progression?.pathwayId === 'diviner' && state.progression.sequence === 8;
}

function tickets(stance: SliceStance | null): number[] {
  return CLOWN_ABILITIES.map((ability) => ability.weight * (
    stance !== null && ability.stance === stance ? 5 : 4
  ));
}

export function clownAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return CLOWN_ABILITIES.map((ability, index) => ({
    id: ability.id, label: ability.label, weight: weights[index]! / total * 100,
  }));
}

export function drawClownAbility(random: ActionRandomStream, stance: SliceStance | null): ClownMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < CLOWN_ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return CLOWN_ABILITIES[index]!.id;
  }
  throw new Error('小丑能力盘权重无效');
}

export function clownActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 40 ? 2 : roll <= 70 ? 3 : roll <= 90 ? 4 : 5;
}

type ClownEncounterId = 'HYPNOTIST_DISPUTE' | 'FIRST_CASE' | 'CLOWN_RESCUE' | 'HUNTER_CARGO' | 'PROVOKER_DISPUTE' | 'MAGICIAN_DISPUTE' | 'FACELESS_DISPUTE' | 'MARIONETTIST_DISPUTE' | 'BIZARRO_RITUAL';
export interface ClownDangerSource {
  encounterId: ClownEncounterId;
  round: number;
  action: 'VISIBLE_CLUB_MOVEMENT' | 'VISIBLE_ORIGINAL_BEAST_MOVEMENT';
}

function hasLiveOpponent(state: SliceState): boolean {
  const combat = state.combat;
  if (state.status !== 'ACTIVE' || state.health <= 0 || !combat ||
      combat.enemyStatus !== 'RESISTING' || combat.enemyHealth <= 0) return false;
  if (combat.encounterId === 'BIZARRO_RITUAL') return hasBizarroRitualOpponent(state);
  // The rescue encounter has its own living opponent. A dead first-case
  // carrier must neither disable that encounter nor be resurrected in its text.
  return combat.encounterId === 'CLOWN_RESCUE' || combat.encounterId === 'MAGICIAN_DISPUTE' || combat.encounterId === 'FACELESS_DISPUTE' || combat.encounterId === 'MARIONETTIST_DISPUTE' ||
    (state.world.carrierAlive && state.world.carrierCanResist);
}

/** Both current encounters openly establish an opponent wielding a short club. */
export function currentClownDangerSource(state: SliceState): ClownDangerSource | null {
  const encounterId = state.combat?.encounterId;
  if (encounterId === 'BIZARRO_RITUAL') return hasBizarroRitualOpponent(state) ? { encounterId, round: state.combat!.round, action: 'VISIBLE_ORIGINAL_BEAST_MOVEMENT' } : null;
  // The Hunter S7 scene has its own source contract; it adds no Diviner source.
  if (encounterId === 'APOCALYPSE_DEMONESS_DISPUTE' || encounterId === 'DIVINE_HAND_DISPUTE' || encounterId === 'TIME_WORM_DISPUTE' || encounterId === 'STAR_KEY_DISPUTE' || encounterId === 'PALE_EMPEROR_DISPUTE' || encounterId === 'PURE_WHITE_ANGEL_DISPUTE' || encounterId === 'THUNDER_GOD_DISPUTE' || encounterId === 'ALL_KNOWING_EYE_DISPUTE' || encounterId === 'MISFORTUNE_KNIGHT_DISPUTE' || encounterId === 'BEAUTY_GODDESS_DISPUTE' || encounterId === 'CIVILIZATION_ENLIGHTENER_DISPUTE' || encounterId === 'WRITER_DISPUTE' || encounterId === 'CONQUEROR_DISPUTE' || encounterId === 'ATTENDANT_MYSTERIES_DISPUTE' || encounterId === 'BARREN_MATRIARCH_DISPUTE' || encounterId === 'BALANCER_DISPUTE' || encounterId === 'ENTROPY_DUKE_DISPUTE' || encounterId === 'FATE_PROPHET_DISPUTE' || encounterId === 'ANCIENT_EVIL_DISPUTE' || encounterId === 'BLOOD_DUKE_DISPUTE' || encounterId === 'ELDER_DISPUTE' || encounterId === 'SAGE_DISPUTE' || encounterId === 'CALAMITY_DEMONESS_DISPUTE' || encounterId === 'GLORY_DISPUTE' || encounterId === 'FATE_TROJAN_DISPUTE' || encounterId === 'PLANESWALKER_DISPUTE' || encounterId === 'DEATH_CONSUL_DISPUTE' || encounterId === 'LIGHT_SEEKER_DISPUTE' || encounterId === 'CATASTROPHE_DISPUTE' || encounterId === 'WISDOM_ANGEL_DISPUTE' || encounterId === 'CONCEALMENT_SERVANT_DISPUTE' || encounterId === 'LIFE_GIVER_DISPUTE' || encounterId === 'KNOWLEDGE_MENTOR_DISPUTE' || encounterId === 'DISCERNER_DISPUTE' || encounterId === 'WEATHER_WARLOCK_DISPUTE' || encounterId === 'MIRACLE_WORKER_DISPUTE' || encounterId === 'COFFIN_BEARER_DISPUTE' || encounterId === 'CHAOS_HUNTER_DISPUTE' || encounterId === 'FRENZY_MAGE_DISPUTE' || encounterId === 'CHAOS_WALKER_DISPUTE' || encounterId === 'SILENT_DISCIPLE_DISPUTE' || encounterId === 'BLATHERER_COURT' || encounterId === 'THREE_HEADED_TEMPLAR_DISPUTE' || encounterId === 'PROPHECY_MASTER_DISPUTE' || encounterId === 'UNAGING_DEMONESS_DISPUTE' || encounterId === 'SILVER_KNIGHT_DISPUTE' || encounterId === 'SILVER_KNIGHT_HUNT' || encounterId === 'DECEIT_MENTOR_DISPUTE' || encounterId === 'WANDERER_DISPUTE' || encounterId === 'FERRYMAN_DISPUTE' || encounterId === 'JUSTICE_MENTOR_DISPUTE' || encounterId === 'SEA_KING_DISPUTE' || encounterId === 'INSIGHT_SCHOLAR_DISPUTE' || encounterId === 'FEAR_BISHOP_DISPUTE' || encounterId === 'SUMMONING_MASTER_DISPUTE' || encounterId === 'ARCANE_SCHOLAR_DISPUTE' || encounterId === 'DREAM_WEAVER_DISPUTE' || encounterId === 'WAR_BISHOP_DISPUTE' || encounterId === 'ANCIENT_SCHOLAR_DISPUTE' || encounterId === 'ANCIENT_ALCHEMIST_DISPUTE' || encounterId === 'IMPERATIVE_MAGE_DISPUTE' || encounterId === 'FALLEN_EARL_DISPUTE' || encounterId === 'MISFORTUNE_MAGE_DISPUTE' || encounterId === 'PUPPET_DISPUTE' || encounterId === 'DEVIL_DISPUTE' || encounterId === 'BLACK_KNIGHT_DISPUTE' || encounterId === 'MYSTIC_DISPUTE' || encounterId === 'DESPAIR_DISPUTE' || encounterId === 'DEMON_HUNTER_DISPUTE' || encounterId === 'PARASITE_DISPUTE' || encounterId === 'SECRETS_SORCERER_RITUAL' || encounterId === 'UNDYING_DISPUTE' || encounterId === 'UNSHADOWED_DISPUTE' || encounterId === 'CATACLYSM_PRIEST_DISPUTE' || encounterId === 'PROPHET_DISPUTE' || encounterId === 'NIGHTWATCHER_DISPUTE' || encounterId === 'WITCH_KING_DISPUTE' || encounterId === 'ALCHEMIST_DISPUTE' || encounterId === 'MANIPULATOR_DISPUTE' || encounterId === 'IRON_BLOOD_DISPUTE' || encounterId === 'DRUID_DISPUTE' || encounterId === 'PUNISHMENT_KNIGHT_DISPUTE' || encounterId === 'MENTOR_DISORDER_DISPUTE' || encounterId === 'WINNER_DISPUTE' || encounterId === 'WRAITH_DISPUTE' || encounterId === 'DESIRE_APOSTLE_DISPUTE' || encounterId === 'SHEPHERD_DISPUTE' || encounterId === 'STAR_MYSTIC_DISPUTE' || encounterId === 'PAIN_DISPUTE' || encounterId === 'GUARDIAN_DISPUTE' || encounterId === 'DREAM_STEALER_DISPUTE' || encounterId === 'TRAVELER_DISPUTE' || encounterId === 'GATEKEEPER_DISPUTE' || encounterId === 'PRIEST_OF_LIGHT_DISPUTE' || encounterId === 'OCEAN_SINGER_DISPUTE' || encounterId === 'MYSTICISM_MAGISTER_DISPUTE' || encounterId === 'SPIRIT_WARLOCK_DISPUTE' || encounterId === 'CRIMSON_SCHOLAR_DISPUTE' || encounterId === 'ASTRONOMER_DISPUTE' || encounterId === 'DREAMWALKER_DISPUTE' || encounterId === 'REAPER_DISPUTE' || encounterId === 'BIOLOGIST_DISPUTE' || encounterId === 'JUDGE_DISPUTE' || encounterId === 'CORRUPTION_BARON_DISPUTE' || encounterId === 'CALAMITY_PRIEST_DISPUTE' || encounterId === 'ZOMBIE_DISPUTE' || encounterId === 'DEMON_DISPUTE' || encounterId === 'ROSE_BISHOP_DISPUTE' || encounterId === 'SCROLL_PROFESSOR_DISPUTE' || encounterId === 'PLEASURE_DISPUTE' || encounterId === 'DAWN_PALADIN_DISPUTE' || encounterId === 'FIRE_THIEF_DISPUTE' || encounterId === 'RECORDER_DISPUTE' || encounterId === 'SPIRIT_GUIDE_DISPUTE' || encounterId === 'NOTARY_DISPUTE' || encounterId === 'WIND_BLESSED_DISPUTE' || encounterId === 'POLYMATH_DISPUTE' || encounterId === 'SOOTHER_DISPUTE' || encounterId === 'POTION_PROFESSOR_DISPUTE' || encounterId === 'ARTISAN_DISPUTE' || encounterId === 'HYPNOTIST_DISPUTE' || encounterId === 'CONSPIRATOR_DISPUTE' || encounterId === 'PYROMANIAC_DISPUTE' || encounterId === 'PSYCHOLOGIST_DISPUTE' ||
      encounterId === 'VAMPIRE_DISPUTE' || encounterId === 'SLEEPLESS_WATCH' ||
      encounterId === 'MIDNIGHT_DISPUTE' || encounterId === 'NIGHTMARE_DISPUTE' || encounterId === 'MARAUDER_DISPUTE') return null;
  return hasLiveOpponent(state) ? {
    encounterId: encounterId ?? 'FIRST_CASE',
    round: state.combat!.round,
    action: 'VISIBLE_CLUB_MOVEMENT',
  } : null;
}

/** Effects are immediate; resource mutations travel with the caller's round draft. */
export function resolveClownCombatAbility(
  state: SliceState, id: ClownMoveId, physicalStateFactor: number,
  danger: ClownDangerSource | null = null,
): { label: string; selfGain: number; enemyReduction: number; threatens: boolean } {
  const opponent = state.combat?.encounterId === 'BIZARRO_RITUAL' ? '原钟下的同一活体帷幕兽' : state.combat?.encounterId === 'MARIONETTIST_DISPUTE' ? '持自己原普通短棍的多恩' : state.combat?.encounterId === 'FACELESS_DISPUTE' ? '持普通短棍的达恩' : state.combat?.encounterId === 'CLOWN_RESCUE' ? '勒索者'
    : state.combat?.encounterId === 'MAGICIAN_DISPUTE' ? '堵住剧场后巷的莫里' : '携铃者';
  switch (id) {
    case 'diviner.s8.body-control':
      return { label: '体术/身体控制', selfGain: 30 * physicalStateFactor, enemyReduction: 0, threatens: true };
    case 'diviner.s8.balance':
      return { label: state.combat?.encounterId === 'BIZARRO_RITUAL' ? '平衡闪避：稳住重心避让原兽身体/幕刃，不保证免伤' : '平衡闪避：稳住重心避让短棍，不保证免伤', selfGain: 0, enemyReduction: 28, threatens: false };
    case 'diviner.s8.agility':
      return { label: '敏捷调位：抢到更有利的位置，本次没有发动攻击', selfGain: 18, enemyReduction: 0, threatens: false };
    case 'diviner.s8.danger-prediction': {
      const combat = state.combat;
      const valid = hasLiveOpponent(state) && combat && danger &&
        danger.encounterId === (combat.encounterId ?? 'FIRST_CASE') && danger.round === combat.round &&
        danger.action === (combat.encounterId === 'BIZARRO_RITUAL' ? 'VISIBLE_ORIGINAL_BEAST_MOVEMENT' : 'VISIBLE_CLUB_MOVEMENT');
      return valid
        ? { label: `危险预感：从眼前${opponent}的${combat.encounterId === 'BIZARRO_RITUAL' ? '实际身体' : '短棍'}动作中预感下一步，判断未必准确`, selfGain: 0, enemyReduction: 22, threatens: false }
        : { label: '危险预感：当前没有仍然有效的可见对手动作，未形成优势', selfGain: 0, enemyReduction: 0, threatens: false };
    }
    case 'diviner.s8.paper-dagger': {
      const paperAvailable = state.clown.paperSheets >= 1;
      const spiritualityAvailable = state.spirituality >= 1;
      if (!paperAvailable || !spiritualityAvailable) {
        const reason = !paperAvailable && !spiritualityAvailable ? '纸张与灵性不足' : !paperAvailable ? '纸张不足' : '灵性不足';
        return { label: `纸飞刀：${reason}，本次改用普通体术，不重抽`, selfGain: 12 * physicalStateFactor, enemyReduction: 0, threatens: true };
      }
      state.clown.paperSheets -= 1;
      state.clown.paperSpent += 1;
      state.spirituality -= 1;
      return { label: '纸飞刀：掷出已携带的纸张，消耗纸张1、灵性1', selfGain: 34 * physicalStateFactor, enemyReduction: 0, threatens: true };
    }
    case 'diviner.s9.spiritual-sight': {
      if (!hasLiveOpponent(state)) {
        return { label: '灵视：当前没有可观察的目标', selfGain: 0, enemyReduction: 0, threatens: false };
      }
      const health = state.combat!.enemyHealth >= 100 ? '未显受伤' : '身上已有伤势';
      return { label: `灵视：眼前${opponent}${health}`, selfGain: 5, enemyReduction: 0, threatens: false };
    }
    case 'OBSERVE':
      return { label: '观察：重新确认眼前动静，本次未形成额外优势', selfGain: 0, enemyReduction: 0, threatens: false };
    case 'MISS':
      return { label: '失误：这次行动未形成有效优势', selfGain: 0, enemyReduction: 0, threatens: false };
  }
}
