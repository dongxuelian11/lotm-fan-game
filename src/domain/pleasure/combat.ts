import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Pleasure S6 C profile: U65, A1.4/E1.0. All budgets, costs and duration are explicit G. */
export const PLEASURE_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 8 }),
  Object.freeze({ id: '2', label: '2次', weight: 12 }),
  Object.freeze({ id: '3', label: '3次', weight: 20 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 22 }),
  Object.freeze({ id: '6', label: '6次', weight: 15 }),
]);
export type PleasureMoveId = 'assassin.s7.black-flame' | 'assassin.s7.frost' | 'assassin.s7.substitute'
  | 'assassin.s6.silk-binding' | 'assassin.s6.charm' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: PleasureMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'assassin.s7.black-flame', label: '继承近距黑焰（2灵性；实际持原短棍时以普通16替换）', weight: 20, stance: 'ATTACK' },
  { id: 'assassin.s7.frost', label: '继承冰霜牵制（2灵性；31.85×原掌握系数，仅共同减势）', weight: 15, stance: 'ATTACK' },
  { id: 'assassin.s7.substitute', label: '实际已备原镜替身／原粉剂隐形／普通避让', weight: 20, stance: 'DEFEND' },
  { id: 'assassin.s6.silk-binding', label: '已备丝线接触后抵抗（3灵性；成功仅下一次身体打击×0.50；本槽0即时贡献）', weight: 30, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '本场实际布丝（3灵性；0即时贡献，不附送束缚）', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡（±16.25；0灵性；不判伤）', weight: 7, stance: null },
];
export function isPleasure(state: SliceState): boolean {
  return state.progression?.pathwayId === 'demoness' && state.progression.sequence === 6;
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
export function pleasureAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'assassin.s7.black-flame' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（普通16×身体系数替换黑焰；0灵性）'
      : ability.id === 'assassin.s7.substitute' ? !state
        ? '实际已备原镜（3灵性＋1面）；否则实际原粉（2灵性＋1剂）；否则普通避让（0灵性）'
        : defence(state) === 'MIRROR' ? '实际已备原镜替身（3灵性＋1面原镜；仅共同减势）'
        : defence(state) === 'POWDER' ? '已备镜条件不足，实际原粉剂隐形（2灵性＋1剂原粉；仅共同减势）'
        : '镜／粉不足，普通避让（0灵性；不生成物品）'
      : ability.id === 'assassin.s6.silk-binding' && state && !state.pleasure.encounter.silkPrepared
        ? '尚未本场实际布丝，抽中丝缚为0贡献、0灵性；不会自动准备或改成魅惑'
      : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawPleasureAbility(random: ActionRandomStream, stance: SliceStance | null): PleasureMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('欢愉魔女能力盘权重无效');
}
export function pleasureActionCount(roll: number): number {
  return roll <= 8 ? 1 : roll <= 20 ? 2 : roll <= 40 ? 3 : roll <= 63 ? 4 : roll <= 85 ? 5 : 6;
}

/** The authored ordinary opponent owns this club; life contacts and FIRST_CASE never supply this source. */
export interface PleasureCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'PLEASURE_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'MALEN_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'MALENS_OWN_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_INDEPENDENT_PRACTICE_COURTYARD'; visibility: 'MUTUALLY_VISIBLE';
  lighting: 'ORIGINAL_FIXED_LIGHT'; distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND';
  targetRank: -1; targetPhysique: 14; correspondingSpecialDefence: 'NONE';
  bystanders: 'NONE'; spiritualFire: 'NONE'; drowsinessSource: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
}
export function currentPleasureCombatSource(state: SliceState): PleasureCombatSource | null {
  const combat = state.combat, e = state.pleasure.encounter;
  if (!isPleasure(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !Number.isFinite(state.mind) || state.mind <= 0 || state.activeEvent !== null || state.world.city !== 'BACKLUND' ||
      !combat || combat.encounterId !== 'PLEASURE_DISPUTE' || combat.enemyStatus !== 'RESISTING' ||
      !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      Object.values(state.pleasure.cases).some(c => c.contactOpen || c.status === 'PREPARED') ||
      state.pleasure.practice.wrist !== 'FREE' || state.pleasure.practice.fireSilk === 'ON_FRAME' ||
      state.pleasure.practice.fireSilk === 'BROKEN' ||
      !Object.values(state.pleasure.cases).some(c => c.status === 'RESOLVED') ||
      e.status !== 'FIGHTING' || e.attemptWeek !== state.week || e.startHistoryIndex === null ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 ||
      state.combatHistory.length - e.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS') ||
      typeof e.silkPrepared !== 'boolean' || (e.boundRound !== null && e.boundRound !== combat.round)) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'PLEASURE_DISPUTE', attemptWeek: e.attemptWeek, startHistoryIndex: e.startHistoryIndex,
    target: 'MALEN_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'MALENS_OWN_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_INDEPENDENT_PRACTICE_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', lighting: 'ORIGINAL_FIXED_LIGHT', distanceMetres: 2,
    ground: 'CLEAR_ORDINARY_GROUND', targetRank: -1, targetPhysique: 14, correspondingSpecialDefence: 'NONE',
    bystanders: 'NONE', spiritualFire: 'NONE', drowsinessSource: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(state: SliceState, source: PleasureCombatSource | null): source is PleasureCombatSource {
  const current = currentPleasureCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function bounded(value: number): number { return Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0)); }
function masteryFactor(state: SliceState, id: string): number {
  return 0.65 + 0.35 * bounded(state.progression.mastery[id] ?? 0) / 500;
}
export interface PleasureCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
function noEffect(label: string): PleasureCombatEffect { return { label, selfGain: 0, enemyReduction: 0, threatens: false }; }

/** Each slot pays once; inherited mastery and the original Witch inventory are read directly. */
export function resolvePleasureCombatAbility(
  state: SliceState, id: PleasureMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: PleasureCombatSource | null = currentPleasureCombatSource(state),
): PleasureCombatEffect {
  if (!validSource(state, source)) return noEffect('欢愉魔女行动：本场实际到场、原空院或仍抵抗的马伦来源无效；0贡献、0灵性，不重抽');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const e = state.pleasure.encounter;
  switch (id) {
    case 'assassin.s7.black-flame': {
      if (state.town.clubLocation === 'HAND' || !canPay(state, 2)) {
        const held = state.town.clubLocation === 'HAND', selfGain = (held ? 16 : 12) * physical;
        return { label: `${held ? '实际持握原短棍，普通16' : '黑焰所需2灵性不足，普通身体12'}×当前身体系数替换本槽黑焰（G）；0灵性，不叠加两份预算、不生成武器`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      state.spirituality -= 2;
      const selfGain = 65 * 1.4 * 0.65 * masteryFactor(state, id);
      return { label: '继承近距黑焰：消耗2灵性，59.15×原黑焰掌握系数（G）；直接作用于眼前马伦，仍走共同伤势盘，不凭空产生血液或远程诅咒媒介', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
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
    case 'assassin.s6.silk-binding': {
      if (!e.silkPrepared) return noEffect('尚未本场实际布丝，无法建立实体丝线接触；0贡献、0灵性，不自动布丝，不改成无条件魅惑');
      if (!canPay(state, 3)) return noEffect('当前不足3灵性，不能牵引已备丝线；0贡献、0灵性，保留原准备，不掷抵抗盘');
      state.spirituality -= 3; e.silkPrepared = false;
      // Demoness candidate Q: perception versus the ordinary template's explicit physique14, with no special defence.
      const attack = 0.5 * bounded(state.character.coreStats.perception) + 0.5 * bounded(state.progression.mastery[id] ?? 0);
      const chance = Math.max(5, Math.min(95, 50 + 8 * (3 - source.targetRank) + 0.08 * (attack - source.targetPhysique)));
      const roll = random.nextInt(1, 100), success = roll <= chance;
      if (success) e.boundRound = state.combat!.round;
      return noEffect(`实体丝缚：消耗3灵性与本次已备丝线接触，抵抗盘${roll}/100、阈值${Number(chance.toFixed(2))}（G）；${success ? '成功，仅刷新一份本回合下一次实际正向身体打击×0.50，触发即解除，不叠乘' : '马伦挣脱本次丝线，本次0贡献，不新建束缚'}。本槽0即时贡献；不删除行动，不影响意念施法、精神或非实体能力；回合末解除。精神火焰或施术者昏沉能破坏连接，本场普通持棍对手没有这些已声明来源，不虚构反制`);
    }
    case 'assassin.s6.charm':
      return noEffect('本场只有已确认的持棍身体对抗，没有可用的魅惑表现与感官引导情境；0贡献、0灵性，不读取心意，不强制服从、同意或亲密关系');
    case 'OBSERVE':
      if (e.silkPrepared) return noEffect('本场已有未用丝线准备，复核原地接触范围；0贡献、0灵性，不堆叠丝线或附送束缚');
      if (!canPay(state, 3)) return noEffect('当前不足3灵性，实际布丝失败；0贡献、0灵性，不生成丝线，不重抽');
      state.spirituality -= 3; e.silkPrepared = true;
      return noEffect('实际布丝：消耗3灵性，仅在本场2米原空院建立一次丝线准备；0即时贡献，不借用日常练习残留，不附送束缚或魅惑');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -16.25 : 16.25;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}16.25（G）；0灵性，不构成致伤攻击，不生成或销毁原物`), selfGain };
    }
  }
}

/** Only this scene's STRIKE is a positive physical ability; mind/spell names never inherit this tag. */
export function consumePleasureSilkBinding(
  state: SliceState, abilityId: string, actualContribution: number, suppressed = false,
): { physicalMultiplier: number; label: string } | null {
  if (suppressed || abilityId !== 'STRIKE' || !Number.isFinite(actualContribution) || actualContribution <= 0 ||
      !currentPleasureCombatSource(state) || state.pleasure.encounter.boundRound !== state.combat!.round) return null;
  state.pleasure.encounter.boundRound = null;
  return { physicalMultiplier: 0.5, label: '实体丝缚仅令本次实际身体打击普通贡献×0.50，连接已解除；原行动次数保留，不另发减势，不豁免共同伤势或死亡盘' };
}
/** Explicitly leaving/releasing the physical connection cannot leave a hidden pending control effect. */
export function releasePleasureSilkBinding(state: SliceState): string | null {
  if (!isPleasure(state) || state.combat?.encounterId !== 'PLEASURE_DISPUTE') return null;
  const e = state.pleasure.encounter, hadSilk = e.silkPrepared || e.boundRound !== null;
  e.silkPrepared = false; e.boundRound = null;
  return hadSilk ? '实际解除本场丝线准备与连接；原消耗保留，不再维持束缚。' : null;
}
export function finishPleasureCombatRound(state: SliceState, continuing: boolean): string | null {
  if (!isPleasure(state) || state.combat?.encounterId !== 'PLEASURE_DISPUTE') return null;
  if (!continuing) return releasePleasureSilkBinding(state);
  if (state.pleasure.encounter.boundRound !== null) {
    state.pleasure.encounter.boundRound = null;
    return '本回合结束，尚未触发的实体丝缚连接已解除；不跨轮控制、不返还灵性。';
  }
  return null;
}
