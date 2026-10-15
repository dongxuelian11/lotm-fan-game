import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { WizardSpellId } from './types.js';

/** S7 G balance. These three teaching spells are not a canon spell catalogue. */
export const WIZARD_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);

export type WizardMoveId = 'hermit.s7.spellcraft' | 'BODY_FOLLOWUP' | 'BRIEF_WARD'
  | 'BLUR_MARK' | 'hermit.s9.ritual-lore' | 'ACCIDENT';
const ABILITIES: readonly {
  id: WizardMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'hermit.s7.spellcraft', label: '已学有限冲力或普通打击（G）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承的实练次击（G）', weight: 15, stance: 'ATTACK' },
  { id: 'BRIEF_WARD', label: '已学短暂防护或继承灵视（G）', weight: 25, stance: 'DEFEND' },
  { id: 'BLUR_MARK', label: '已学局部遮扰或实练牵制（G）', weight: 15, stance: 'CONTROL' },
  { id: 'hermit.s9.ritual-lore', label: '核实仪式准备条件', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作或施法偏差（G）', weight: 5, stance: null },
];

export function isWizard(state: SliceState): boolean {
  return state.progression?.pathwayId === 'hermit' && state.progression.sequence === 7;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function wizardAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'hermit.s7.spellcraft' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawWizardAbility(random: ActionRandomStream, stance: SliceStance | null): WizardMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('巫师能力盘权重无效');
}
export function wizardActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}

export interface WizardCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): WizardCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasPresentFirstCaseOpponent(state: SliceState): boolean {
  return isWizard(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING' &&
    state.arc.stage === 'COMBAT' && state.world.city === 'BACKLUND' &&
    state.combat.encounterId === 'FIRST_CASE' && state.world.carrierAlive && state.world.carrierCanResist;
}
function masteryFactor(state: SliceState, id: string): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
function canCast(state: SliceState, spellId: WizardSpellId): boolean {
  return state.wizard.lessons[spellId]?.learned === true &&
    Number.isFinite(state.spirituality) && state.spirituality >= 2;
}

/**
 * Learned G spells use only spellcraft mastery; teaching objects are not combat
 * consumables. Promotion, old occult knowledge and practice do not teach spells.
 * B/K reduce shared advantage without removing actions or granting immunity.
 */
export function resolveWizardCombatAbility(
  state: SliceState, id: WizardMoveId, physicalStateFactor: number, random: ActionRandomStream,
): WizardCombatEffect {
  if (!hasPresentFirstCaseOpponent(state)) {
    return noEffect('巫师行动：当前没有本场仍在抵抗的活体对手，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const spellcraft = masteryFactor(state, 'hermit.s7.spellcraft');
  const training = masteryFactor(state, 'hermit.s8.combat-study');
  switch (id) {
    case 'hermit.s7.spellcraft': {
      if (state.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：实际持握的普通短棍以16贡献替换本次有限冲力或徒手打击，不叠加、不耗灵性',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      if (canCast(state, 'light-touch')) {
        state.spirituality -= 2;
        return { label: '有限冲力（G教学法术）：消耗2灵性，以本人实际学会的术式作用于眼前对手，45贡献只受法术掌握影响；不消耗教学器具、不生成卷轴',
          selfGain: 45 * spellcraft, enemyReduction: 0, threatens: true };
      }
      const selfGain = 12 * physical;
      return { label: '有限冲力尚未学会或灵性不足：回退普通徒手打击，贡献12受身体状态影响，不透支灵性、不借用格斗增幅',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 16.8 * training * physical;
      return { label: '继承的实练次击（G）：普通动作贡献16.8受原格斗训练掌握与身体状态影响，独立占一次行动，不附赠攻击、不耗灵性',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BRIEF_WARD':
      if (canCast(state, 'brief-ward')) {
        state.spirituality -= 2;
        return { ...noEffect('短暂防护（G教学法术）：消耗2灵性，54贡献只受法术掌握影响并进入共同减势；不无敌、不取消对手行动'),
          enemyReduction: 54 * spellcraft };
      }
      if (Number.isFinite(state.spirituality) && state.spirituality >= 1) {
        state.spirituality -= 1;
        return { ...noEffect('短暂防护尚未学会或灵性不足：回退继承的有限灵视，消耗1灵性，27贡献只受原灵视掌握影响；不预知、不读心'),
          enemyReduction: 27 * masteryFactor(state, 'hermit.s9.spirit-vision') };
      }
      return { ...noEffect('短暂防护与有限灵视所需灵性均不足：回退普通格挡，贡献10受身体状态影响，不透支灵性'),
        enemyReduction: 10 * physical };
    case 'BLUR_MARK':
      if (canCast(state, 'blur-mark')) {
        state.spirituality -= 2;
        return { ...noEffect('局部遮扰（G教学法术）：消耗2灵性，仅干扰眼前局部视线，37.8贡献只受法术掌握影响并进入共同减势；不绝对隐形、不取消对手行动'),
          enemyReduction: 37.8 * spellcraft };
      }
      return { ...noEffect('局部遮扰尚未学会或灵性不足：回退继承的实练走位牵制（G），贡献18.9受原格斗训练掌握与身体状态影响，不耗灵性、不保证控制'),
        enemyReduction: 18.9 * training * physical };
    case 'hermit.s9.ritual-lore':
      return noEffect('核实仪式准备条件：本场没有额外已准备并获准使用的仪式来源，本次贡献0、消耗0；不自动学会法术、不生成卷轴、不积累增益');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`动作或施法偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G），不构成致伤攻击`), selfGain };
    }
  }
}
