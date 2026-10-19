import { computeCheckChance } from '../../resolution/normal-check.js';
import { hasPainDisputeOpponent } from './encounter.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Finite supernatural S5 G profile. No real pathogens or medical protocols. Inherited budgets remain S6. */
export const PAIN_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 14 }),
  Object.freeze({ id: '6', label: '6次', weight: 6 }),
]);
export type PainMoveId = 'assassin.s7.black-flame' | 'assassin.s7.frost' | 'assassin.s7.substitute'
  | 'assassin.s5.disease' | 'assassin.s6.charm' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: PainMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'assassin.s7.black-flame', label: '继承近距黑焰（H；2灵性；实际持原短棍时以普通16替换）', weight: 30, stance: 'ATTACK' },
  { id: 'assassin.s7.frost', label: '继承冰霜牵制（J；2灵性；仅共同减势）', weight: 15, stance: 'ATTACK' },
  { id: 'assassin.s7.substitute', label: '实际已备原镜替身／原粉剂隐形／普通避让（B）', weight: 20, stance: 'DEFEND' },
  { id: 'assassin.s5.disease', label: '有限超自然疾病（K；首次4灵性、知识14；随后每轮2灵性维持，强度1→3）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '本场实际布丝，再次抽中才尝试丝缚（R；每步3灵性，0即时贡献）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡（A；±22.5；0灵性；不判伤）', weight: 5, stance: null },
];
export function isPain(state: SliceState): boolean {
  return state.progression?.pathwayId === 'demoness' && state.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
function canPay(state: SliceState, amount: number): boolean {
  return Number.isFinite(state.spirituality) && state.spirituality >= amount;
}
function hasDose(value: number): boolean { return Number.isSafeInteger(value) && value > 0; }
function defence(state: SliceState): 'MIRROR' | 'POWDER' | 'ORDINARY' {
  const tools = state.witch.tools;
  if (tools.mirrorPrepared === true && hasDose(tools.mirrorsHeld) && canPay(state, 3)) return 'MIRROR';
  if (hasDose(tools.powderHeld) && canPay(state, 2)) return 'POWDER';
  return 'ORDINARY';
}
export function painAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'assassin.s7.black-flame' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（普通16×身体系数替换黑焰；0灵性）'
      : ability.id === 'assassin.s7.substitute' ? !state
        ? '实际已备原镜（3灵性＋1面）；否则实际原粉（2灵性＋1剂）；否则普通避让（0灵性）'
        : defence(state) === 'MIRROR' ? '实际已备原镜替身（3灵性＋1面原镜；仅共同减势）'
        : defence(state) === 'POWDER' ? '已备镜条件不足，实际原粉剂隐形（2灵性＋1剂原粉；仅共同减势）'
        : '镜／粉不足，普通避让（0灵性；不生成物品）'
      : ability.id === 'OBSERVE' && state?.pain.encounter.silkPrepared
        ? '牵引本场已备原丝（R；另耗3灵性、身体抵抗成功后仅下一实际打击×0.50）'
      : ability.id === 'assassin.s5.disease' && (stance === 'DEFEND' || state && state.pain.encounter.enemyDisease > 0)
        ? '停止新增暴露或已有原疾病：普通自保10、0灵性，不重启、不刷新疾病'
      : ability.label + (stance === 'DEFEND' ? '；本轮明确停止新暴露与维持，既有疾病不治愈' : ''),
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawPainAbility(random: ActionRandomStream, stance: SliceStance | null): PainMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('痛苦魔女能力盘权重无效');
}
export function painActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6;
}

/** The authored ordinary opponent owns this club; life contacts and FIRST_CASE never supply this source. */
export interface PainCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'PAIN_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'OREN_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'ORENS_OWN_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_INDEPENDENT_PRACTICE_COURTYARD'; visibility: 'MUTUALLY_VISIBLE';
  lighting: 'ORIGINAL_FIXED_LIGHT'; distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND';
  targetRank: -1; targetPhysique: 14; correspondingSpecialDefence: 'NONE';
  bystanders: 'NONE'; spiritualFire: 'NONE'; drowsinessSource: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
}
export function currentPainCombatSource(state: SliceState): PainCombatSource | null {
  if (!hasPainDisputeOpponent(state)) return null;
  const combat = state.combat!, e = state.pain.encounter;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'PAIN_DISPUTE', attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!,
    target: 'OREN_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'ORENS_OWN_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_INDEPENDENT_PRACTICE_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', lighting: 'ORIGINAL_FIXED_LIGHT', distanceMetres: 2,
    ground: 'CLEAR_ORDINARY_GROUND', targetRank: -1, targetPhysique: 14, correspondingSpecialDefence: 'NONE',
    bystanders: 'NONE', spiritualFire: 'NONE', drowsinessSource: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(state: SliceState, source: PainCombatSource | null): source is PainCombatSource {
  const current = currentPainCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function bounded(value: number): number { return Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0)); }
function masteryFactor(state: SliceState, id: string): number {
  return 0.65 + 0.35 * bounded(state.progression.mastery[id] ?? 0) / 500;
}
export interface PainCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
function noEffect(label: string): PainCombatEffect { return { label, selfGain: 0, enemyReduction: 0, threatens: false }; }

/** Each slot pays once; inherited mastery and the original Witch inventory are read directly. */
export function resolvePainCombatAbility(
  state: SliceState, id: PainMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: PainCombatSource | null = currentPainCombatSource(state),
  stance: SliceStance = 'ATTACK',
): PainCombatEffect {
  if (!validSource(state, source)) return noEffect('痛苦魔女行动：本场实际到场、原空院或仍抵抗的奥伦来源无效；0贡献、0灵性，不重抽');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const e = state.pain.encounter;
  switch (id) {
    case 'assassin.s7.black-flame': {
      if (state.town.clubLocation === 'HAND' || !canPay(state, 2)) {
        const held = state.town.clubLocation === 'HAND', selfGain = (held ? 16 : 12) * physical;
        return { label: `${held ? '实际持握原短棍，普通16' : '黑焰所需2灵性不足，普通身体12'}×当前身体系数替换本槽黑焰（G）；0灵性，不叠加两份预算、不生成武器`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      state.spirituality -= 2;
      const selfGain = 65 * 1.4 * 0.65 * masteryFactor(state, id);
      return { label: '继承近距黑焰：消耗2灵性，59.15×原黑焰掌握系数（G）；直接作用于眼前奥伦，仍走共同伤势盘，不凭空产生血液或远程诅咒媒介', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'assassin.s7.frost':
      if (!canPay(state, 2)) return { ...noEffect('冰霜所需2灵性不足，普通走位牵制6×当前身体系数（G）；0灵性，不透支'), enemyReduction: 6 * physical };
      state.spirituality -= 2;
      return { ...noEffect('继承有限冰霜牵制：消耗2灵性，31.85×原冰霜掌握系数（G），沿用原能力共同减势方向；本槽不增加致伤攻击，不冻结或跳过敌方行动'), enemyReduction: 65 * 1.4 * 0.35 * masteryFactor(state, id) };
    case 'assassin.s7.substitute': {
      const tools = state.witch.tools;
      switch (defence(state)) {
        case 'MIRROR':
          state.spirituality -= 3; tools.mirrorsHeld -= 1; tools.mirrorsUsed += 1; tools.mirrorPrepared = false;
          return { ...noEffect('已备原镜替身：消耗3灵性与1面实际已备原镜；原镜破碎，本次隐蔽结束，42.25×原替身掌握系数（G）仅计共同减势；不取消敌方行动或撤销伤势、死亡'), enemyReduction: 65 * 0.65 * masteryFactor(state, id) };
        case 'POWDER':
          state.spirituality -= 2; tools.powderHeld -= 1; tools.powderUsed += 1;
          return { ...noEffect('已备镜条件不足，消耗2灵性与1剂实际原粉剂；有限隐形21.125×原隐形掌握系数（G）仅计共同减势，不免疫所有感知与攻击'), enemyReduction: 65 * 0.65 * 0.5 * masteryFactor(state, 'assassin.s7.invisibility') };
        case 'ORDINARY':
          return { ...noEffect('已备镜和原粉剂条件不足，普通避让10×当前身体系数（G）；0灵性，不生成镜片、粉剂、结茧或替身'), enemyReduction: 10 * physical };
      }
    }
    case 'assassin.s5.disease': {
      if (stance === 'DEFEND' || stance === 'RETREAT' || e.fieldActive || e.enemyDisease > 0) {
        return { ...noEffect('明确停止新增暴露，或原敌已有疾病：本槽只普通自保10（G），0灵性；不重启、不刷新、不清除既有疾病'), enemyReduction: 10 };
      }
      if (!canPay(state, 4)) return noEffect('不足4灵性，未开始疾病场；0贡献、0灵性，不透支、不造成暴露');
      state.spirituality -= 4;
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: state.character.coreStats.knowledge, difficulty: 14, modifiers: [] });
      const roll = random.nextInt(1, 100), success = roll <= chance;
      if (success) {
        e.fieldActive = true; e.enemyDisease = 1; e.diseaseApplications += 1; e.lastDiseaseRound = state.combat!.round;
      }
      return noEffect(`有限超自然疾病：实付4灵性，知识14判定${roll}/100、阈值${chance}（G）；${success
        ? '眼前2米原奥伦实际暴露，强度1；本轮不会二次增长。只有原空院实际无人，无友军自动免疫保证'
        : '未建立疾病场，原敌暴露与强度保持0'}。本槽0即时贡献，不直接扣健康、自动杀死或伪造敌方施法；离开或停场不治疗已发生的疾病`);
    }
    case 'assassin.s6.charm':
      return noEffect('本场只有已确认的持棍身体对抗，没有可用的魅惑表现与感官引导情境；0贡献、0灵性，不读取心意，不强制服从、同意或亲密关系');
    case 'OBSERVE': {
      if (!canPay(state, 3)) return noEffect('当前不足3灵性，不能布丝或牵引已备丝线；0贡献、0灵性，原准备保留，不掷抵抗盘');
      state.spirituality -= 3;
      if (!e.silkPrepared) {
        e.silkPrepared = true;
        return noEffect('实际布丝：消耗3灵性，只在本场2米原空院建立一次丝线准备；0即时贡献。须后来再次抽中R另付3灵性才尝试丝缚，不借用旧欢愉或日常丝线');
      }
      e.silkPrepared = false;
      const attack = 0.5 * bounded(state.character.coreStats.perception) + 0.5 * bounded(state.progression.mastery['assassin.s6.silk-binding'] ?? 0);
      const chance = Math.max(5, Math.min(95, 50 + 8 * (3 - source.targetRank) + 0.08 * (attack - source.targetPhysique)));
      const roll = random.nextInt(1, 100), success = roll <= chance;
      if (success) e.boundRound = state.combat!.round;
      return noEffect(`实体丝缚：另付3灵性并使用本场已备原丝，身体抵抗盘${roll}/100、阈值${Number(chance.toFixed(2))}（G）；${success
        ? '成功，仅下一次本回合实际正向身体打击×0.50，触发即解除，与疾病取较强效果不相乘'
        : '奥伦挣脱，未建立新束缚'}。本槽0即时贡献，不影响意念或非实体能力，不删除动作；回合末解除，不能借用旧欢愉丝线状态`);
    }
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -22.5 : 22.5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}22.5（G）；0灵性，不构成致伤攻击，不生成或销毁原物`), selfGain };
    }
  }
}

/** Called once at a new round, before either side acts. A repeated call cannot pay or advance twice. */
export function beginPainCombatRound(state: SliceState, stance: SliceStance): string | null {
  if (!currentPainCombatSource(state)) return null;
  const e = state.pain.encounter, round = state.combat!.round;
  if (stance === 'DEFEND' || stance === 'RETREAT') {
    const active = e.fieldActive; e.fieldActive = false;
    return `${stance === 'DEFEND' ? '本轮明确防御' : '主动停止维持后尝试沿原出口撤退'}：停止新增暴露与疾病维持，0维持灵性；${active ? '原疾病场已经停止；' : ''}奥伦已有疾病强度${e.enemyDisease}保留，停止或离开都不等于治愈。`;
  }
  if (!e.fieldActive || e.lastDiseaseRound === round) return null;
  if (!canPay(state, 2)) {
    e.fieldActive = false;
    return `当前不足2灵性，无法继续维持疾病场，新增暴露停止；原奥伦疾病强度${e.enemyDisease}保留，不自动治疗或恢复健康。`;
  }
  state.spirituality -= 2; e.enemyDisease = Math.min(3, e.enemyDisease + 1); e.lastDiseaseRound = round;
  return `持续原超自然疾病：实际支付2灵性维持，原奥伦强度${e.enemyDisease}/3（G）；本轮只增长一次，仅对其实际普通打击生效，不直接扣健康、取消行动或自动杀死。`;
}
/** Only the original opponent's actual positive STRIKE is affected. One strongest modifier, never multiplied. */
export function consumePainEnemyStrike(
  state: SliceState, abilityId: string, actualContribution: number, suppressed = false,
): { physicalMultiplier: number; label: string } | null {
  if (suppressed || abilityId !== 'STRIKE' || !Number.isFinite(actualContribution) || actualContribution <= 0 ||
      !currentPainCombatSource(state)) return null;
  const e = state.pain.encounter, bound = e.boundRound === state.combat!.round;
  if (!bound && e.enemyDisease === 0) return null;
  const diseaseMultiplier = [1, 0.9, 0.8, 0.65][e.enemyDisease]!;
  if (bound) e.boundRound = null;
  const physicalMultiplier = bound ? Math.min(0.5, diseaseMultiplier) : diseaseMultiplier;
  return { physicalMultiplier, label: `原奥伦超自然疲乏／咳嗽强度${e.enemyDisease}，本次实际普通打击贡献×${physicalMultiplier}（G）${bound ? '；原实体丝缚已触发解除，只取较强效果，不与疾病相乘' : ''}；不直接扣健康，不伪造或取消普通对手的施法，不免除共同伤势与死亡风险` };
}
/** Sync original bodily results before the common caller can clear combat. No ending cures disease. */
export function finishPainCombatRound(state: SliceState, continuing: boolean): string | null {
  if (!isPain(state) || state.combat?.encounterId !== 'PAIN_DISPUTE') return null;
  const e = state.pain.encounter, c = state.combat;
  e.enemyHealth = c.enemyHealth; e.enemyStatus = c.enemyStatus;
  const bound = e.boundRound !== null; e.boundRound = null;
  if (continuing) return bound ? '本回合未触发的实体丝缚已实际解除，原消耗保留。' : null;
  e.fieldActive = false; e.silkPrepared = false;
  return `${state.health <= 0 || state.mind <= 0 ? '玩家已无法维持，疾病场停止' : '玩家实际停止施术并退出原接触范围，疾病场停止'}，本场原丝线也已解除；原奥伦健康${e.enemyHealth}、疾病强度${e.enemyDisease}与累计暴露${e.diseaseApplications}次保留。${e.enemyDisease > 0 && e.enemyHealth > 0 ? '仍活着的原患者需要照护，撤出不等于治愈；后续只能另行请求协助，不保证治疗结果。' : '没有自动补血、复活、返还灵性或恢复原物。'}`;
}
