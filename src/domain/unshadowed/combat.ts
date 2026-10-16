import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasUnshadowedDisputeOpponent } from './encounter.js';

export const UNSHADOWED_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const unshadowedActionCount = pyromaniacActionCount;
export type UnshadowedMoveId = 'unshadowed-spear' | 'sun.s4.unshadowed-domain' | 'EVADE' | 'sun.s4.purification' | 'sun.s4.sunflare' | 'ACCIDENT';
const ABILITIES: readonly { id: UnshadowedMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'unshadowed-spear', label: '有限无暗光矛（H；5灵性/意志18；32×净化掌握G）', weight: 30, stance: 'ATTACK' },
  { id: 'sun.s4.unshadowed-domain', label: '有限无暗领域（J；5灵性/意志16；减势18×掌握G，无物理墙）', weight: 15, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（B；0灵性，減势10G）', weight: 20, stance: 'DEFEND' },
  { id: 'sun.s4.purification', label: '有限净化光（K；6灵性/意志18；34×掌握G，普通人无邪恶加成）', weight: 20, stance: 'CONTROL' },
  { id: 'sun.s4.sunflare', label: '有限太阳耀斑（R；6灵性/意志18；38×掌握G，原地面留焦痕）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const isUnshadowed = (s: SliceState): boolean => s.progression.pathwayId === 'sun' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function unshadowedAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] { const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 })); }
export function drawUnshadowedAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): UnshadowedMoveId { const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0)); for (let i = 0; i < weights.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; } throw new Error('无暗者能力盘无效。'); }
export interface UnshadowedCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'UNSHADOWED_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  enemyId: 'UD4-EDMUND'; nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN'; weaponId: 'UD4-EDMUND-CLUB'; weaponLocation: 'HAND';
  distanceMetres: 2; visible: true; sunVulnerable: false; othersOutside: true; groundId: 'UD4-COURTYARD-GROUND';
  space: 'ORIGINAL_CLEAR_STONE_COURTYARD'; exit: 'ORIGINAL_ORDINARY_OPEN_EXIT'; pursuit: false;
}
export function currentUnshadowedCombatSource(s: SliceState): UnshadowedCombatSource | null {
  if (!hasUnshadowedDisputeOpponent(s)) return null; const e = s.unshadowed.encounter;
  return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round, encounterId: 'UNSHADOWED_DISPUTE', attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, enemyId: 'UD4-EDMUND', nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN', weaponId: 'UD4-EDMUND-CLUB', weaponLocation: 'HAND', distanceMetres: 2, visible: true, sunVulnerable: false, othersOutside: true, groundId: 'UD4-COURTYARD-GROUND', space: 'ORIGINAL_CLEAR_STONE_COURTYARD', exit: 'ORIGINAL_ORDINARY_OPEN_EXIT', pursuit: false };
}
const validSource = (s: SliceState, source: UnshadowedCombatSource | null): boolean => { const now = currentUnshadowedCombatSource(s); return now !== null && source !== null && Object.entries(now).every(([key, value]) => (source as unknown as Record<string, unknown>)[key] === value); };
export interface UnshadowedRoundOutcome { enemyId: 'UD4-EDMUND'; enemyHealth: number; enemyMind: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; domainUses: number; purificationUses: number; sunflareUses: number; groundScorchMarks: number }
export interface UnshadowedRoundContext { source: UnshadowedCombatSource; round: number; outcome: UnshadowedRoundOutcome }
export function beginUnshadowedCombatRound(s: SliceState): UnshadowedRoundContext { const source = currentUnshadowedCombatSource(s); if (!source) throw new Error('缺少原埃德蒙、原短棍、实际净空院落或连续回合来源。'); const c = s.combat!; return { source, round: c.round, outcome: { enemyId: 'UD4-EDMUND', enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, domainUses: 0, purificationUses: 0, sunflareUses: 0, groundScorchMarks: s.unshadowed.encounter.groundScorchMarks } }; }
export interface UnshadowedCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
const none = (label: string): UnshadowedCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
function mastery(s: SliceState, id: string): number { const n = s.progression.mastery[id] ?? 0; return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(n) ? n : 0)) / 500; }
function ordinaryStrike(s: SliceState, physical: number): UnshadowedCombatEffect { const factor = Number.isFinite(physical) ? Math.max(0, Math.min(1, physical)) : 0; return { ...none(`不足5灵性，本槽只用${s.town.clubLocation === 'HAND' ? '自己实际持握的原普通短棍' : '自己的原身体'}普通打击，12/16×身体G，0灵性；不偷用原埃德蒙的棍、不免费施光矛、不重抽。`), selfGain: (s.town.clubLocation === 'HAND' ? 16 : 12) * factor, threatens: factor > 0 }; }
export function resolveUnshadowedCombatAbility(s: SliceState, id: UnshadowedMoveId, physicalStateFactor: number, random: ActionRandomStream, ctx: UnshadowedRoundContext, source: UnshadowedCombatSource | null = ctx.source): UnshadowedCombatEffect {
  if (ctx.round !== s.combat?.round || !validSource(s, source)) return none('缺少当前原人、原棍、净空原场或连续回合来源，0贡献、0消耗，不重抽、不替换人物或赋予友军免疫。');
  if (!ABILITIES.some(a => a.id === id)) return none('这不是本阶段已实现动作，0贡献、0消耗；没有正义导师能力或免费特性抽取。');
  if (id === 'ACCIDENT') return { ...none('判断失衡，本槽固定优势−22.5G，不另抽或增加行动。'), selfGain: -22.5 };
  if (id === 'EVADE') return { ...none('本人在原石院用原身体普通避让，减势10G、0灵性；没有免费神光防御或免伤。'), enemyReduction: 10 };
  const spear = id === 'unshadowed-spear', domain = id === 'sun.s4.unshadowed-domain', flare = id === 'sun.s4.sunflare', cost = spear || domain ? 5 : 6;
  if (!Number.isFinite(s.spirituality) || s.spirituality < cost) return spear ? ordinaryStrike(s, physicalStateFactor) : domain ? { ...none('不足5灵性，本槽以原身体普通避让，减势10G、0灵性；不制造免费领域、不重抽。'), enemyReduction: 10 } : none('不足6灵性，本槽只作普通观察，0贡献、0消耗，无免费净化光或耀斑、不重抽。');
  s.spirituality -= cost;
  const difficulty = domain ? 16 : 18, chance = computeCheckChance({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty, modifiers: [] }), roll = random.nextInt(1, 100), success = roll <= chance;
  const name = spear ? '有限无暗光矛' : domain ? '有限无暗领域' : flare ? '有限太阳耀斑' : '有限净化光';
  if (!success) return none(`${name}已耗${cost}灵性，意志${roll}>${chance}失败或被抵抗，0效果；成本保留，不补普通动作、不重抽，没有新焦痕或持续效果。`);
  if (domain) ctx.outcome.domainUses++; else if (flare) { ctx.outcome.sunflareUses++; ctx.outcome.groundScorchMarks++; } else ctx.outcome.purificationUses++;
  const label = `${name}已耗${cost}灵性，意志${roll}≤${chance}成功：` + (spear ? '向2米原埃德蒙尝试一次光矛攻击，优势+32×净化掌握G。' : domain ? '照亮本段原场以干扰眼前攻击，减势18×掌握G；原普通出口仍畅通，没有物理墙或强迫囚禁。' : flare ? '只在本次已净空8米G范围尝试一次耀斑攻击，优势+38×掌握G；同一UD4-COURTYARD-GROUND实际新增一处焦痕，不自动清除环境后果。' : '向2米当前可见原埃德蒙尝试一次有限净化光，优势+34×掌握G；对普通活人只按普通攻击，无邪恶标签倍率。') + '目标是原普通成年人，不自动成为亡灵或邪恶；实际伤势由共同胜负与后果盘结算，不保证命中、投降或获胜。其余原身体确实留在8米界外，此具体场景不意味着友军普遍免疫。单次有限作用结束，不跨轮维持免费领域，不抽取自身或对方特性。';
  return { ...none(label), selfGain: domain ? 0 : (spear ? 32 : flare ? 38 : 34) * mastery(s, spear ? 'sun.s4.purification' : id), enemyReduction: domain ? 18 * mastery(s, id) : 0, threatens: !domain };
}
export function finishUnshadowedCombatRound(s: SliceState, ctx: UnshadowedRoundContext, _continues: boolean): string {
  const e = s.unshadowed.encounter, c = s.combat!; e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus; e.groundScorchMarks = ctx.outcome.groundScorchMarks; if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'COURTYARD';
  Object.assign(ctx.outcome, { enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus });
  return '本轮有限领域、光矛、净化光与耀斑均已结束；领域不封锁原普通出口，同一原地面的焦痕、原身体伤势和原棍归属保留，不治伤、复活、免费抽取特性或退回灵性。';
}
export function projectUnshadowedCombat(s: SliceState) { return { enemyName: '原47岁埃德蒙·塔尔', source: currentUnshadowedCombatSource(s), groundScorchMarks: s.unshadowed.encounter.groundScorchMarks, summary: '4阶核心35/25/25/15、1250/底线125，灵性上限120、继续回合恢复12G，行动1–6。H有限光矛5灵性/意志18；J有限领域5灵性/意志16；B普通避让0灵性；K净化光6灵性/意志18；R耀斑6灵性/意志18。原普通人没有邪恶倍率，缺灵性仅普通回退，检定失败成本照耗。领域没有物理墙，耀斑不自动豁免同伴；同一原地面焦痕保留。' }; }
