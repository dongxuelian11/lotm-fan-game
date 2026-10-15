import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasUndyingDisputeOpponent } from './encounter.js';

/** All numbers are bounded G. Neither slot is a resurrection or permanent soul seal. */
export const UNDYING_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const undyingActionCount = pyromaniacActionCount;
export type UndyingMoveId = 'death.s6.dead-words' | 'death.s4.underworld-seal' | 'EVADE' | 'DEAD_WORDS_FOCUS' | 'UNDERWORLD_SEAL_FOCUS' | 'ACCIDENT';
const ABILITIES: readonly { id: UndyingMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'death.s6.dead-words', label: '继承死者之语（H；5灵性、意志18，成功优势34×原掌握G，可抵抗）', weight: 30, stance: 'ATTACK' },
  { id: 'death.s4.underworld-seal', label: '有限冥界借力（J；6灵性、意志18，成功减势20×掌握G）', weight: 15, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（B；减势10G，没有免伤保证）', weight: 20, stance: 'DEFEND' },
  { id: 'DEAD_WORDS_FOCUS', label: '继承死者之语的本槽运用（K；6灵性、意志18，优势36×原掌握G）', weight: 20, stance: 'CONTROL' },
  { id: 'UNDERWORLD_SEAL_FOCUS', label: '有限攻击窗口约束（R；一次6灵性、意志18，减势24×掌握G）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const isUndying = (s: SliceState): boolean => s.progression.pathwayId === 'death' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function undyingAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] { const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 })); }
export function drawUndyingAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): UndyingMoveId { const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0)); for (let i = 0; i < weights.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; } throw new Error('不死者能力盘无效。'); }
export interface UndyingCombatSource { runId: string; revision: number; week: number; round: number; encounterId: 'UNDYING_DISPUTE'; attemptWeek: number; startHistoryIndex: number; enemyId: 'UDY4-OWEN'; nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN'; weaponId: 'UDY4-OWEN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; visible: true; exit: 'ORIGINAL_OPEN_ARCHIVE_YARD_EXIT'; pursuit: false; bystanders: false; playerBody: 'ORIGINAL_PLAYER_BODY' }
export function currentUndyingCombatSource(s: SliceState): UndyingCombatSource | null { if (!hasUndyingDisputeOpponent(s)) return null; const e = s.undying.encounter; return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round, encounterId: 'UNDYING_DISPUTE', attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, enemyId: 'UDY4-OWEN', nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN', weaponId: 'UDY4-OWEN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, visible: true, exit: 'ORIGINAL_OPEN_ARCHIVE_YARD_EXIT', pursuit: false, bystanders: false, playerBody: 'ORIGINAL_PLAYER_BODY' }; }
const validSource = (s: SliceState, source: UndyingCombatSource | null): boolean => { const now = currentUndyingCombatSource(s); return now !== null && source !== null && Object.entries(now).every(([key, value]) => (source as unknown as Record<string, unknown>)[key] === value); };
/** Uses count real paid attempts, including failures, not successful seals or deaths. */
export interface UndyingRoundOutcome { enemyId: 'UDY4-OWEN'; enemyHealth: number; enemyMind: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; sealUses: number; deadWordUses: number }
export interface UndyingRoundContext { source: UndyingCombatSource; round: number; outcome: UndyingRoundOutcome }
export function beginUndyingCombatRound(s: SliceState): UndyingRoundContext { const source = currentUndyingCombatSource(s); if (!source) throw new Error('缺少当前原欧文、原棍、原石院或连续回合来源。'); const c = s.combat!; return { source, round: c.round, outcome: { enemyId: 'UDY4-OWEN', enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, sealUses: 0, deadWordUses: 0 } }; }
export interface UndyingCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
const none = (label: string): UndyingCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const mastery = (s: SliceState, id: string) => 0.65 + 0.35 * Math.max(0, Math.min(500, s.progression.mastery[id] ?? 0)) / 500;
const learned = (s: SliceState, id: string) => Object.hasOwn(s.progression.mastery, id) && Number.isFinite(s.progression.mastery[id]) && s.progression.mastery[id]! >= 0;
function ordinaryStrike(s: SliceState, factor: number): UndyingCombatEffect { const physical = Number.isFinite(factor) ? Math.max(0, Math.min(1, factor)) : 0; return { ...none(`本槽资源不足或缺少真实旧掌握，仅由本人以${s.town.clubLocation === 'HAND' ? '实际持有的原短棍' : '原身体'}普通打击12/16×身体G；不施死者之语、不重抽。`), selfGain: (s.town.clubLocation === 'HAND' ? 16 : 12) * physical, threatens: physical > 0 }; }
export function resolveUndyingCombatAbility(s: SliceState, id: UndyingMoveId, physicalStateFactor: number, random: ActionRandomStream, ctx: UndyingRoundContext, source: UndyingCombatSource | null = ctx.source): UndyingCombatEffect {
  if (ctx.round !== s.combat?.round || !validSource(s, source)) return none('缺少当前原欧文、原短棍、本人或连续回合来源，0贡献、0消耗，不重抽。');
  if (!ABILITIES.some(a => a.id === id)) return none('该动作不是本阶段已实现的有限能力，0效果、0消耗。');
  if (id === 'ACCIDENT') return { ...none('判断失衡，本槽固定优势−22.5G，不另抽或新增行动。'), selfGain: -22.5 };
  if (id === 'EVADE') return { ...none('本人普通避让，减势10G，0灵性；没有不死免伤。'), enemyReduction: 10 };
  const words = id === 'death.s6.dead-words' || id === 'DEAD_WORDS_FOCUS', abilityId = words ? 'death.s6.dead-words' : 'death.s4.underworld-seal', cost = id === 'death.s6.dead-words' ? 5 : 6;
  if (!learned(s, abilityId) || words && s.spiritGuide.promotionWeek === null || !Number.isFinite(s.spirituality) || s.spirituality < cost) {
    if (id === 'death.s6.dead-words') return ordinaryStrike(s, physicalStateFactor);
    return id === 'death.s4.underworld-seal' ? { ...none('不足本次6灵性或缺少实际能力，本槽只普通避让，减势10G，不形成封印或重抽。'), enemyReduction: 10 } : none('缺少实际旧掌握或不足6灵性，本槽普通观察0贡献、0消耗，不免费施法或重抽。');
  }
  s.spirituality -= cost;
  if (words) ctx.outcome.deadWordUses++; else ctx.outcome.sealUses++;
  const chance = computeCheckChance({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] }), roll = random.nextInt(1, 100);
  if (roll > chance) return none(`${words ? '继承死者之语' : '有限冥界借力'}实付${cost}灵性，意志${roll}>${chance}失败；本轮已付尝试计数+1，0效果，不补普通动作、不自动成功。`);
  const power = mastery(s, abilityId);
  if (words) return { ...none(`继承同一death.s6.dead-words原掌握，实付${cost}灵性/意志${roll}≤${chance}，优势${id === 'death.s6.dead-words' ? 34 : 36}×原掌握G。原欧文仍是能抵抗的活人，最终伤势由共同盘结算，不是宣判即死。`), selfGain: (id === 'death.s6.dead-words' ? 34 : 36) * power, threatens: true };
  return { ...none(`从本人原体内小冥界有限借力，实付6灵性/意志${roll}≤${chance}，只约束当前短攻击窗口，减势${id === 'death.s4.underworld-seal' ? 20 : 24}×掌握G。并未调用原灰羽、生成新灵、剥离灵魂或永久控制，原身体仍在原石院。`), enemyReduction: (id === 'death.s4.underworld-seal' ? 20 : 24) * power };
}
export function finishUndyingCombatRound(s: SliceState, ctx: UndyingRoundContext, _continues: boolean): string {
  const e = s.undying.encounter, c = s.combat!;
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus; if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  Object.assign(ctx.outcome, { enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus });
  return `本轮短暂约束已结束；实付封印尝试${ctx.outcome.sealUses}次、死者之语尝试${ctx.outcome.deadWordUses}次（包括失败，不是成功次数）。原灰羽与六十年周期登记均未改变，不复活、治疗、退灵性或新造灵体。`;
}
export function projectUndyingCombat(s: SliceState) { return { enemyName: '原46岁欧文·戴尔', source: currentUndyingCombatSource(s), summary: '4阶G核心35/25/25/15、1250/底线125，灵性上限120、继续回合恢复12，行动1–6。H/K沿用真实死者之语掌握，J/R同一个新有限借力封印，只作用本轮短攻击窗口。次数记录实付尝试，包括失败。没有原灰羽自动派出、免费灵体、永久控制、普通死亡后复活或六十年周期已经历。' }; }
