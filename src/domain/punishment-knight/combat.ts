import { computeCheckChance } from '../../resolution/normal-check.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { InterrogatorCombatSource } from '../interrogator/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasPunishmentKnightDisputeOpponent, hasPunishmentKnightOpenPractice } from './encounter.js';

/** S5 finite G profile. The original S6 gate and random stream remain unchanged. */
export const PUNISHMENT_KNIGHT_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 14 }),
  Object.freeze({ id: '6', label: '6次', weight: 6 }),
]);
export type PunishmentKnightMoveId = 'justiciar.s9.combat-training' | 'justiciar.s5.wound-verdict'
  | 'justiciar.s7.mental-puncture' | 'justiciar.s6.prohibition' | 'justiciar.s5.confinement' | 'ACCIDENT';
type MasteryId = Exclude<PunishmentKnightMoveId, 'ACCIDENT'> | 'justiciar.s8.trace-sensing' | 'justiciar.s5.punishment';
const ABILITIES: readonly { id: PunishmentKnightMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'justiciar.s9.combat-training', label: '继承格斗／实际违令后有限惩戒（G；可另付3灵性）', weight: 30, stance: 'ATTACK' },
  { id: 'justiciar.s5.wound-verdict', label: '实际既有敌伤的伤口裁断／普通侧击（G；3灵性、知识14）', weight: 15, stance: 'ATTACK' },
  { id: 'justiciar.s7.mental-puncture', label: '继承精神刺穿／痕迹护身（G；3灵性）', weight: 25, stance: 'ATTACK' },
  { id: 'justiciar.s6.prohibition', label: '有限单次禁令：双方身体近击禁止（G；3灵性，下次动作才抵抗）', weight: 10, stance: 'CONTROL' },
  { id: 'justiciar.s5.confinement', label: '有限囚禁下一次实际打击（G；3灵性、知识14；成功后×0.6一次）', weight: 15, stance: 'CONTROL' },
  { id: 'ACCIDENT', label: '时机或失衡（G；固定−22.5，不另掷正负）', weight: 5, stance: null },
];
export function isPunishmentKnight(s: SliceState): boolean {
  return s.progression?.pathwayId === 'justiciar' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function punishmentKnightAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((a, i) => ({ id: a.id,
    label: a.id === 'justiciar.s9.combat-training' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍／实际违令后有限惩戒（可另付3灵性）' : a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawPunishmentKnightAbility(random: ActionRandomStream, stance: SliceStance | null): PunishmentKnightMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) return ABILITIES[i]!.id;
  }
  throw new Error('惩戒骑士能力盘权重无效');
}
export function punishmentKnightActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6;
}
export type PunishmentKnightCombatSource = InterrogatorCombatSource | {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'PUNISHMENT_KNIGHT_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'DEAN_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'DEANS_OWN_ORDINARY_SHORT_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_CLEAR_COURTYARD'; visibility: 'MUTUALLY_VISIBLE'; distanceMetres: 2;
  ground: 'CLEAR_ORDINARY_GROUND'; daylight: true; bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
};
export function currentPunishmentKnightCombatSource(s: SliceState): PunishmentKnightCombatSource | null {
  const c = s.combat;
  if (!isPunishmentKnight(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || s.world.city !== 'BACKLUND' ||
      hasPunishmentKnightOpenPractice(s) || !Number.isSafeInteger(c.round) || c.round < 1 ||
      !Number.isSafeInteger(s.revision) || s.revision < 0 || !Number.isSafeInteger(s.week) || s.week < 1) return null;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist) return null;
    return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'FIRST_CASE',
      target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
  }
  if (!hasPunishmentKnightDisputeOpponent(s)) return null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    encounterId: 'PUNISHMENT_KNIGHT_DISPUTE', attemptWeek: s.week, startHistoryIndex: s.punishmentKnight.encounter.startHistoryIndex!,
    target: 'DEAN_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'DEANS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', space: 'ORIGINAL_CLEAR_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', daylight: true,
    bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(s: SliceState, source: PunishmentKnightCombatSource | null): boolean {
  const current = currentPunishmentKnightCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryValue(s: SliceState, id: MasteryId): number {
  const value = s.progression.mastery[id] ?? 0;
  return Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0));
}
function masteryFactor(s: SliceState, id: MasteryId): number { return 0.65 + 0.35 * masteryValue(s, id) / 500; }
function canPay(s: SliceState): boolean { return Number.isFinite(s.spirituality) && s.spirituality >= 3; }
export interface PunishmentKnightCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
function noEffect(label: string): PunishmentKnightCombatEffect { return { label, selfGain: 0, enemyReduction: 0, threatens: false }; }
/** Exactly three synchronous local flags, never stored in combat or a generic legal framework. */
export interface PunishmentKnightRoundContext {
  source: PunishmentKnightCombatSource | null;
  prohibitionPending: boolean;
  breachReady: boolean;
  confinementPending: boolean;
}
export function createPunishmentKnightRoundContext(s: SliceState): PunishmentKnightRoundContext {
  return { source: currentPunishmentKnightCombatSource(s), prohibitionPending: false, breachReady: false, confinementPending: false };
}
interface ProhibitionResponse { blocked: boolean; resisted: boolean; label: string }
/** A real body slot has already been drawn; one resistance draw consumes the declaration. */
function consumeProhibition(s: SliceState, context: PunishmentKnightRoundContext,
  actor: 'PLAYER' | 'ENEMY', random: ActionRandomStream): ProhibitionResponse | null {
  if (!context.prohibitionPending || !validSource(s, context.source)) return null;
  context.prohibitionPending = false;
  const threshold = 55 + 20 * masteryValue(s, 'justiciar.s6.prohibition') / 500;
  const roll = random.nextInt(1, 100), blocked = roll <= threshold;
  return { blocked, resisted: !blocked,
    label: `有限单次禁令在${actor === 'PLAYER' ? '你的本次身体近击' : '敌方本次实际STRIKE'}才判定：抵抗盘${roll}/100、阈值${threshold}（G）；${blocked
      ? '禁令生效，本次原槽已消耗，贡献0、不形成致伤威胁，不构成实际违令'
      : '禁令被抵抗，本次原动作照常结算；仅敌方实际正贡献STRIKE结束后才记录违令，意图、落空或本人违令不算惩戒来源'}。本条单次禁令现在结束，不重抽、不追加行动` };
}
export function punishmentKnightEnemyProhibition(s: SliceState, context: PunishmentKnightRoundContext,
  moveId: string, random: ActionRandomStream, suppressed = false): ProhibitionResponse | null {
  if (moveId !== 'STRIKE' || suppressed) return null;
  return consumeProhibition(s, context, 'ENEMY', random);
}
/** Called only after the same actual allowed strike's positive contribution was resolved. */
export function recordPunishmentKnightBreach(s: SliceState, context: PunishmentKnightRoundContext,
  moveId: string, selfGain: number, resisted: boolean): string | null {
  if (moveId !== 'STRIKE' || !resisted || !Number.isFinite(selfGain) || selfGain <= 0 ||
      !validSource(s, context.source)) return null;
  context.breachReady = true;
  return '已记录本次原敌实际正贡献STRIKE违令；只待本轮下一次实际H另付3灵性使用有限惩戒预算，不追补攻击、不立即致伤';
}
export function consumePunishmentKnightConfinement(s: SliceState, context: PunishmentKnightRoundContext,
  moveId: string, selfGain: number, suppressed = false): { physicalMultiplier: number; label: string } | null {
  if (!context.confinementPending || moveId !== 'STRIKE' || suppressed || !Number.isFinite(selfGain) || selfGain <= 0 ||
      !validSource(s, context.source)) return null;
  context.confinementPending = false;
  return { physicalMultiplier: 0.6,
    label: '有限囚禁仅用于本轮下一次实际正贡献STRIKE（G）：本次原打击×0.6后立即结束，不取消攻击或其它动作，不重抽、不追加行动；被禁令阻止的0贡献动作不会消耗它' };
}
export function finishPunishmentKnightCombatRound(context: PunishmentKnightRoundContext): string | null {
  const pending = context.prohibitionPending || context.breachReady || context.confinementPending;
  context.prohibitionPending = false; context.breachReady = false; context.confinementPending = false;
  return pending ? '本轮结束，未用单次禁令、实际违令后的待用惩戒与有限囚禁全部结束，不跨轮保留，不追加攻击、不治疗或返还实付灵性。' : null;
}
export function resolvePunishmentKnightCombatAbility(s: SliceState, id: PunishmentKnightMoveId,
  physicalStateFactor: number, random: ActionRandomStream, context: PunishmentKnightRoundContext,
  source: PunishmentKnightCombatSource | null = currentPunishmentKnightCombatSource(s)): PunishmentKnightCombatEffect {
  if (!validSource(s, source) || !validSource(s, context.source)) {
    return noEffect('惩戒骑士行动：缺少当前原现场存活对手、连续回合或实践收束来源；本次贡献0、消耗0，不抽判定、不虚构违令或伤口');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const woundEligible = Array.isArray(s.combat!.enemyInjuries) && s.combat!.enemyInjuries.length > 0;
  const woundVerdict = id === 'justiciar.s5.wound-verdict' && woundEligible && canPay(s);
  // Settle the player's own body restriction before H can spend a punishment budget.
  const prohibition = id === 'justiciar.s9.combat-training' || (id === 'justiciar.s5.wound-verdict' && !woundVerdict)
    ? consumeProhibition(s, context, 'PLAYER', random) : null;
  if (prohibition?.blocked) return noEffect(prohibition.label);
  const bodyPrefix = prohibition ? `${prohibition.label}；` : '';
  switch (id) {
    case 'justiciar.s9.combat-training': {
      const held = s.town.clubLocation === 'HAND';
      let selfGain = (held ? 16 : 50.7 * masteryFactor(s, id)) * physical;
      let punishment = '没有已记录的本场实际违令，0惩戒预算、0灵性';
      if (context.breachReady && canPay(s)) {
        s.spirituality -= 3; context.breachReady = false;
        selfGain += 20 * masteryFactor(s, 'justiciar.s5.punishment') * physical;
        punishment = '依据此前原敌实际正贡献STRIKE违令，另付3灵性并消耗待用来源，在同一次H加入20×新惩戒掌握×身体的有限惩戒预算（G）；不是额外行动或必定破防';
      } else if (context.breachReady) punishment = '灵性不足3，实际违令来源暂留至本轮结束；本次只有普通H，没有免费惩戒预算';
      return { label: `${bodyPrefix}${held ? '实际持握玩家原普通短棍16×身体，不取得对方原棍' : '继承格斗50.7×原格斗掌握×身体'}（G）；${punishment}。伤势与死亡只走共同后果盘`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'justiciar.s5.wound-verdict': {
      if (!woundVerdict) {
        const selfGain = 35.49 * masteryFactor(s, 'justiciar.s9.combat-training') * physical;
        return { label: `${bodyPrefix}${!woundEligible ? '没有实际已记录的敌方既有伤口' : '灵性不足3'}：回退普通格斗侧击35.49×原格斗掌握×身体（G），0灵性、0裁断判定；不宣告死亡，不借用玩家自己的伤势，不制造隐藏伤口`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      s.spirituality -= 3;
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 14, modifiers: [] });
      const roll = random.nextInt(1, 100), success = roll <= chance;
      const selfGain = success ? 45 * masteryFactor(s, id) : 0;
      return { label: `伤口裁断：仅以当前仍存活原敌实际已记录的既有伤口为来源，耗3灵性、知识14判定${roll}/${chance}（G）；${success ? '45×新伤口裁断掌握形成有限致伤战势，伤势与死亡仍由共同后果盘结算' : '被抵抗或未能作用，已付成本不退，本次贡献0'}。这不是身体近击，不消耗待用身体禁令；不直接改健康、不设低血处决、不保证一句话杀死`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'justiciar.s7.mental-puncture': {
      if (!canPay(s)) return { ...noEffect('精神刺穿灵性不足3：继承痕迹辨认与护身42.25×原痕迹掌握×身体（G），0消耗、不抽命中盘，不读取心智或未来'), enemyReduction: 42.25 * masteryFactor(s, 'justiciar.s8.trace-sensing') * physical };
      s.spirituality -= 3;
      const threshold = 55 + Math.floor(20 * masteryValue(s, id) / 500), roll = random.nextInt(1, 100), success = roll <= threshold;
      return { ...noEffect(`继承精神刺穿：耗3灵性、命中盘${roll}/100、阈值${threshold}（G）；${success ? '42.25×原精神刺穿掌握形成短暂战势' : '对方避开或抵抗，贡献0'}。不乘身体、不形成物理致伤威胁，不保证真话，不受身体近击禁令影响`), selfGain: success ? 42.25 * masteryFactor(s, id) : 0 };
    }
    case 'justiciar.s6.prohibition':
      if (context.prohibitionPending) return noEffect('已有本轮待用单次身体近击禁令：重复K占用原槽，0贡献、0消耗、0抵抗抽签，不叠加、不续期');
      if (!canPay(s)) return { ...noEffect('禁令灵性不足3：普通走位6×身体（G），0消耗、不宣布禁令、不抽抵抗盘'), enemyReduction: 6 * physical };
      s.spirituality -= 3; context.prohibitionPending = true;
      return noEffect('实际耗3灵性，宣布有限单次双方身体近击禁止（G）：本次不抽抵抗、增势0、减势0；只待本轮下一次实际身体H、普通J或敌方STRIKE时判定一次抵抗，随后本条结束。双方同受限制是本作G；不是绝对命令、法定权限或序列4能力');
    case 'justiciar.s5.confinement': {
      if (context.confinementPending) return noEffect('本轮已有待用有限囚禁：重复R占用原槽，0贡献、0消耗、0判定，不叠加或延长');
      if (!canPay(s)) return noEffect('有限囚禁灵性不足3：0贡献、0消耗、0判定，不制造控制效果');
      s.spirituality -= 3;
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 14, modifiers: [] });
      const roll = random.nextInt(1, 100), success = roll <= chance;
      context.confinementPending = success;
      return noEffect(`有限囚禁：耗3灵性、知识14判定${roll}/${chance}（G）；${success ? '只使本轮下一次实际正贡献敌方STRIKE×0.6一次，当前增势0、减势0' : '对方挣脱或抵抗，贡献0，成本不退，没有待用效果'}。不停止全部行动，不保证绝对拘禁，不改变本人意愿，不跨轮保留`);
    }
    case 'ACCIDENT': return { ...noEffect('时机或失衡：固定−22.5战势（G），0灵性，不另掷正负、不形成致伤威胁'), selfGain: -22.5 };
  }
}
