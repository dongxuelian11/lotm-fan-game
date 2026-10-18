import { computeCheckChance } from '../../resolution/normal-check.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { WizardSpellId } from '../wizard/types.js';
import type { ScrollProfessorScroll } from '../scroll-professor/types.js';
import { hasStarMysticDisputeOpponent } from './encounter.js';

/** All weights, budgets, resource costs and finite durations are explicit G adaptation. */
export const STAR_MYSTIC_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }), Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }), Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 14 }), Object.freeze({ id: '6', label: '6次', weight: 6 }),
]);
export type StarMysticMoveId = 'hermit.s6.scrollcraft' | 'BODY_FOLLOWUP' | 'BRIEF_WARD'
  | 'hermit.s5.star-cage' | 'hermit.s5.mystic-sight' | 'ACCIDENT';
const ABILITIES: readonly { id: StarMysticMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'hermit.s6.scrollcraft', label: '已有已授权冲力原卷轴1灵性／本人已学冲力2灵性／原棍或身体（H；G继承预算）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承实练次击（J；G20.475×旧掌握×身体；独立一槽）', weight: 15, stance: 'ATTACK' },
  { id: 'BRIEF_WARD', label: '已有已授权防护原卷轴1灵性／本人已学防护2灵性／普通格挡（B；G）', weight: 20, stance: 'DEFEND' },
  { id: 'hermit.s5.star-cage', label: '直接有限星光牢笼（K；G3灵性、知识14；下一次正贡献打击×0.5，本轮结束即散）', weight: 20, stance: 'CONTROL' },
  { id: 'hermit.s5.mystic-sight', label: '抬起本人原厚眼镜有限聚焦（R；G3灵性、2精神；下次K阈值+5百分点）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '视线或动作偏差（A；G固定−22.5，不另抽正负）', weight: 5, stance: null },
];
export function isStarMystic(s: SliceState): boolean { return s.progression?.pathwayId === 'hermit' && s.progression.sequence === 5; }
function tickets(stance: SliceStance | null): number[] { return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4)); }
export function starMysticAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.id === 'hermit.s5.mystic-sight' && state?.starMystic.practice.lenses === 'SUPPLIER'
    ? '尚未拥有原厚眼镜：普通观察（R；0贡献、0灵性、0精神；不赠送眼镜）' : a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawStarMysticAbility(random: ActionRandomStream, stance: SliceStance | null): StarMysticMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('星象师能力盘权重无效');
}
export function starMysticActionCount(roll: number): number { return roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6; }

/** Bound to this actual arrival and current round, never a first-case disguise. */
export interface StarMysticCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'STAR_MYSTIC_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'BRYCE_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN'; body: 'CURRENT_REACHABLE_BODY';
  weapon: 'BRYCES_OWN_ORDINARY_SHORT_CLUB'; space: 'ORIGINAL_STAR_MYSTIC_EMPTY_COURTYARD';
  visibility: 'MUTUALLY_VISIBLE'; distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND';
  bystanders: 'NONE'; ally: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
}
export function currentStarMysticCombatSource(s: SliceState): StarMysticCombatSource | null {
  if (!hasStarMysticDisputeOpponent(s)) return null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round,
    encounterId: 'STAR_MYSTIC_DISPUTE', attemptWeek: s.starMystic.encounter.attemptWeek!, startHistoryIndex: s.starMystic.encounter.startHistoryIndex!,
    target: 'BRYCE_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'BRYCES_OWN_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_STAR_MYSTIC_EMPTY_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND',
    bystanders: 'NONE', ally: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(s: SliceState, source: StarMysticCombatSource | null): boolean {
  const current = currentStarMysticCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(value: number): number { return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0)) / 500; }
function learnedFactor(s: SliceState, id: string): number { return masteryFactor(s.progression.mastery[id] ?? 0); }
function canPay(s: SliceState, amount: number): boolean { return Number.isFinite(s.spirituality) && s.spirituality >= amount; }
function canCast(s: SliceState, id: WizardSpellId): boolean { return s.wizard.lessons[id]?.learned === true && canPay(s, 2); }
/** Existing original maker6 and actual newly made maker5 share the unchanged inherited sealed budget. */
function authorizedOriginal(s: SliceState, kind: ScrollProfessorScroll['kind']): ScrollProfessorScroll | null {
  const { scrolls, materials } = s.scrollProfessor.workshop;
  return scrolls.find(scroll => {
    if (scroll.kind !== kind || scroll.authorized !== true || scroll.status !== 'HELD' || scroll.usedWeek !== null ||
        (scroll.makerSequence !== 6 && scroll.makerSequence !== 5) || !Number.isFinite(scroll.inscriptionMastery) ||
        scroll.inscriptionMastery < 0 || scroll.inscriptionMastery > 500 ||
        !Number.isSafeInteger(scroll.createdWeek) || scroll.createdWeek < 1 || scroll.createdWeek > s.week ||
        !/^scroll-professor-scroll-[1-9]\d*$/.test(scroll.id) || !/^scroll-professor-material-[1-9]\d*$/.test(scroll.materialId) ||
        scrolls.filter(x => x.id === scroll.id).length !== 1 || scrolls.filter(x => x.materialId === scroll.materialId).length !== 1) return false;
    const inputs = materials.filter(x => x.id === scroll.materialId), input = inputs[0];
    return inputs.length === 1 && input !== undefined && input.status === 'SPENT' &&
      Number.isSafeInteger(input.acquiredWeek) && input.acquiredWeek >= 1 && input.acquiredWeek <= scroll.createdWeek && input.spentWeek === scroll.createdWeek;
  }) ?? null;
}
function burn(s: SliceState, scroll: ScrollProfessorScroll): void { s.spirituality -= 1; scroll.status = 'USED'; scroll.usedWeek = s.week; scroll.authorized = false; }
export interface StarMysticCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
function noEffect(label: string): StarMysticCombatEffect { return { label, selfGain: 0, enemyReduction: 0, threatens: false }; }

/** Consume once on the next actual positive STRIKE; defenses, misses and earlier actions are untouched. */
export function consumeStarMysticCage(
  s: SliceState, id: string, contribution: number, suppressed = false,
  source: StarMysticCombatSource | null = currentStarMysticCombatSource(s),
): { physicalMultiplier: number; label: string } | null {
  if (id !== 'STRIKE' || suppressed || !Number.isFinite(contribution) || contribution <= 0 ||
      !s.starMystic.encounter.cageReady || !validSource(s, source)) return null;
  s.starMystic.encounter.cageReady = false;
  return { physicalMultiplier: 0.5, label: '原星光牢笼实际限制布莱斯这一次打击，正打击贡献×0.5（G）；本次后消散，不取消该槽、不停止说话、思想或其它行动，不造成额外伤害' };
}
export function finishStarMysticCombatRound(s: SliceState): string | null {
  const e = s.starMystic.encounter, hadFocus = e.focused, hadCage = e.cageReady;
  if (hadFocus && s.starMystic.practice.lenses === 'HELD') s.starMystic.practice.lenses = 'WORN';
  e.focused = false; e.cageReady = false;
  return hadFocus || hadCage ? '本轮结束，未用的有限聚焦与星光牢笼实际结束；已抬原厚眼镜戴回，已付精神与灵性不退款，不把增益带到下轮。' : null;
}
export function resolveStarMysticCombatAbility(
  s: SliceState, id: StarMysticMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: StarMysticCombatSource | null = currentStarMysticCombatSource(s),
): StarMysticCombatEffect {
  if (!validSource(s, source)) return noEffect('星象师行动缺少本场真实到场、仍可行动的布莱斯原身体与原空院来源；0贡献、0消耗、不燃毁原卷轴、不重抽');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const spellcraft = learnedFactor(s, 'hermit.s7.spellcraft'), e = s.starMystic.encounter;
  switch (id) {
    case 'hermit.s6.scrollcraft': {
      const scroll = authorizedOriginal(s, 'IMPACT');
      if (scroll && canPay(s, 1)) {
        burn(s, scroll);
        return { label: `实际燃毁已授权冲力原卷轴${scroll.id}，耗1灵性；原材料${scroll.materialId}、实际制作者序列${scroll.makerSequence}、封存掌握${scroll.inscriptionMastery}保留，使用G继承38.025×刻录系数，本槽预算上限38.025，不因晋升复制或增强原卷轴`,
          selfGain: Math.min(38.025, 38.025 * masteryFactor(scroll.inscriptionMastery)), enemyReduction: 0, threatens: true };
      }
      if (canCast(s, 'light-touch')) {
        s.spirituality -= 2;
        return { label: '无可支付的已授权冲力原件，改用本人实际已学有限冲力，耗2灵性，G继承38.025×旧法术掌握；占同一槽，不附加攻击或生成原卷轴', selfGain: 38.025 * spellcraft, enemyReduction: 0, threatens: true };
      }
      const armed = s.town.clubLocation === 'HAND', selfGain = (armed ? 16 : 12) * physical;
      return { label: `${armed ? '使用实际手持的本人原短棍16' : '普通身体打击12'}×身体系数（G）；没有可支付的已授权冲力原件或实际已学法术，0灵性，不借用未知法术或布莱斯的原棍`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 20.475 * learnedFactor(s, 'hermit.s8.combat-study') * physical;
      return { label: '继承实练次击：G20.475×旧格斗掌握×身体，0灵性，独立占本次行动，不附赠攻击或使用未学法术', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BRIEF_WARD': {
      const scroll = authorizedOriginal(s, 'WARD');
      if (scroll && canPay(s, 1)) {
        burn(s, scroll);
        return { ...noEffect(`实际燃毁已授权防护原卷轴${scroll.id}，耗1灵性；原材料${scroll.materialId}、实际制作者序列${scroll.makerSequence}、封存掌握${scroll.inscriptionMastery}保留，G继承42.25×刻录系数，上限42.25；只进入共同减势，不取消敌方动作、不复制原件`), enemyReduction: Math.min(42.25, 42.25 * masteryFactor(scroll.inscriptionMastery)) };
      }
      if (canCast(s, 'brief-ward')) {
        s.spirituality -= 2;
        return { ...noEffect('无可支付的已授权防护原件，改用本人实际已学短暂防护，耗2灵性，G继承42.25×旧法术掌握；只进入共同减势，不额外免伤或取消行动'), enemyReduction: 42.25 * spellcraft };
      }
      return { ...noEffect('没有可支付的已授权防护原件或实际已学防护：普通格挡G10×身体，0灵性，不借用未知法术'), enemyReduction: 10 * physical };
    }
    case 'hermit.s5.star-cage': {
      if (e.cageReady) return noEffect('本轮原星光牢笼尚待下一正打击，不叠加、不刷新、不再次支付或额外抽判定');
      if (!canPay(s, 3)) return noEffect('灵性不足3，不能尝试原星光牢笼；0贡献、0消耗，不透支，不燃毁原卷轴');
      const focused = e.focused && s.starMystic.practice.lenses === 'HELD';
      const chance = Math.min(95, computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 14, modifiers: [] }) + (focused ? 5 : 0));
      s.spirituality -= 3;
      if (focused) { e.focused = false; s.starMystic.practice.lenses = 'WORN'; }
      const roll = random.nextInt(1, 100); e.cageReady = roll <= chance;
      return noEffect(`直接有限星光牢笼：实际耗3灵性，知识14判定${roll}/100、阈值${chance}（G）${focused ? '，原眼镜聚焦消耗一次，阈值+5百分点后实际戴回原镜' : ''}；${e.cageReady ? '限制眼前原布莱斯，等待本轮下一次正贡献打击×0.5，0即时贡献' : '未形成牢笼，已付灵性保留'}，不消耗卷轴、不控制思想、说话或所有动作，不直接扣健康或宣告死亡`);
    }
    case 'hermit.s5.mystic-sight': {
      if (e.focused) return noEffect('本轮已抬起原厚眼镜完成一次有限聚焦；不重复支付、不叠加阈值，也不窥读未来');
      if (s.starMystic.practice.lenses !== 'WORN') return noEffect('没有实际佩戴的本人原厚眼镜，普通观察当前可见布莱斯；0贡献、0灵性、0精神，不凭空赠送眼镜或读出隐藏物品');
      if (!canPay(s, 3) || !Number.isFinite(s.mind) || s.mind <= 2) return noEffect('不足3灵性或不能承担2精神，保留原厚眼镜佩戴并普通观察；0贡献、0消耗，不透支');
      s.spirituality -= 3; s.mind -= 2; s.starMystic.practice.lenses = 'HELD'; e.focused = true;
      return noEffect('实际抬起本人已买原厚眼镜SM5-LENS-1，针对眼前2米原布莱斯有限聚焦；G耗3灵性、2精神，承受额外杂乱视觉负担，本次0贡献，仅下次实际K阈值+5百分点；不读取未知能力、物品编号、未来抽签或高位存在，使用后或本轮结束戴回同一原镜');
    }
    case 'ACCIDENT': return { ...noEffect('本次视线或动作偏差固定−22.5战势（隐者G），0灵性、不另掷正负；不追加致伤攻击、不假造高位注视或污染、不损毁未使用原件'), selfGain: -22.5 };
  }
}
