import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasWitchKingDisputeOpponent } from './encounter.js';
import { consumeWitchKingPaper, preparedWitchKingPaper, WITCH_KING_PAPER_SOURCE } from './life.js';

/** Explicit S4 game budgets; finite paper and failed paid checks never get a free replacement. */
export const WITCH_KING_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const witchKingActionCount = pyromaniacActionCount;
export type WitchKingMoveId = 'moon.s4.blood-moon-arrow' | 'moon.s4.moon-paper-substitute' | 'moon.s7.abyss-shackles' | 'STRIKE' | 'EVADE' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: WitchKingMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'moon.s4.blood-moon-arrow', label: '血月之箭／本人普通打击（H；4灵性、感知16，成功45×掌握G；不足灵性普通身体12/原棍16）', weight: 25, stance: 'ATTACK' },
  { id: 'STRIKE', label: '本人普通打击（身体12/原棍16×身体G）', weight: 5, stance: 'ATTACK' },
  { id: 'moon.s4.moon-paper-substitute', label: '已备原纸替身／普通避让（J；3灵性＋同一PREPARED原纸，减势35G；无资源普通减势10）', weight: 25, stance: 'DEFEND' },
  { id: 'EVADE', label: '普通身体避让（B；减势10G，不免伤）', weight: 20, stance: 'DEFEND' },
  { id: 'moon.s7.abyss-shackles', label: '继承深渊枷锁（K；3灵性、意志16，成功有限减势14G；不是完全定身）', weight: 10, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '眼前普通观察（R；0灵性、0贡献）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const isWitchKing = (s: SliceState): boolean => s.progression.pathwayId === 'moon' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function witchKingAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] { const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 })); }
export function drawWitchKingAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): WitchKingMoveId { const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0)); for (let i = 0; i < weights.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; } throw new Error('巫王能力盘无效。'); }
export interface WitchKingCombatSource { runId: string; revision: number; week: number; round: number; encounterId: 'WITCH_KING_DISPUTE'; attemptWeek: number; startHistoryIndex: number; enemyId: 'WK4-DORIAN'; nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN'; weaponId: 'WK4-DORIAN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; visible: true; exit: 'ORIGINAL_OPEN_PRACTICE_YARD_EXIT'; pursuit: false }
export function currentWitchKingCombatSource(s: SliceState): WitchKingCombatSource | null { if (!hasWitchKingDisputeOpponent(s)) return null; const e = s.witchKing.encounter; return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round, encounterId: 'WITCH_KING_DISPUTE', attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, enemyId: 'WK4-DORIAN', nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN', weaponId: 'WK4-DORIAN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, visible: true, exit: 'ORIGINAL_OPEN_PRACTICE_YARD_EXIT', pursuit: false }; }
const validSource = (s: SliceState, source: WitchKingCombatSource | null): boolean => { const now = currentWitchKingCombatSource(s); return now !== null && source !== null && Object.entries(now).every(([key, value]) => (source as unknown as Record<string, unknown>)[key] === value); };
export interface WitchKingRoundOutcome { enemyId: 'WK4-DORIAN'; enemyHealth: number; enemyMind: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; paperId: string | null; papersConsumed: string[] }
export interface WitchKingRoundContext { source: WitchKingCombatSource; round: number; outcome: WitchKingRoundOutcome }
export function beginWitchKingCombatRound(s: SliceState): WitchKingRoundContext {
  const source = currentWitchKingCombatSource(s); if (!source) throw new Error('缺少当前原多里安与原院连续回合来源。');
  const c = s.combat!; return { source, round: c.round, outcome: { enemyId: 'WK4-DORIAN', enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, paperId: preparedWitchKingPaper(s)?.id ?? null, papersConsumed: [] } };
}
export interface WitchKingCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
const none = (label: string): WitchKingCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const mastery = (s: SliceState, id: string) => 0.65 + 0.35 * Math.max(0, Math.min(500, s.progression.mastery[id] ?? 0)) / 500;
export function resolveWitchKingCombatAbility(s: SliceState, id: WitchKingMoveId, physicalStateFactor: number, random: ActionRandomStream, ctx: WitchKingRoundContext, source: WitchKingCombatSource | null = ctx.source): WitchKingCombatEffect {
  if (ctx.round !== s.combat?.round || !validSource(s, source)) return none('缺少当前原多里安、原短棍或连续回合，0贡献、0消耗，不重抽。');
  if (!ABILITIES.some(a => a.id === id)) return none('这不是当前已实现的巫王动作，0贡献、0消耗。');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const ordinary = (reason: string): WitchKingCombatEffect => ({ ...none(`${reason}本人以${s.town.clubLocation === 'HAND' ? '实际自持原短棍' : '自己的原身体'}普通打击，12/16×身体（G），0灵性；没有自动变成血月之箭。`), selfGain: (s.town.clubLocation === 'HAND' ? 16 : 12) * physical, threatens: physical > 0 });
  if (id === 'ACCIDENT') return { ...none('判断失衡，本槽固定优势−22.5（G），不另抽、不增加次数。'), selfGain: -22.5 };
  if (id === 'STRIKE') return ordinary('');
  if (id === 'EVADE') return { ...none('本人普通身体避让，有限减势10（G），不消除真实伤势。'), enemyReduction: 10 };
  if (id === 'OBSERVE') return none('本人观察眼前原人、原棍和净空出口，0灵性、0贡献；不凭空恢复或召唤。');
  if (id === 'moon.s4.moon-paper-substitute') {
    const paper = preparedWitchKingPaper(s);
    if (!paper || paper.id !== ctx.outcome.paperId || paper.source !== WITCH_KING_PAPER_SOURCE || s.spirituality < 3) return { ...none('没有战前明确准备的同一原纸，或不足3灵性。本槽本人作普通避让，减势10（G）；不消耗HELD纸、不自动准备或生成纸影。'), enemyReduction: 10 };
    s.spirituality -= 3; consumeWitchKingPaper(s, paper, 'COMBAT', ctx.round); ctx.outcome.papersConsumed.push(paper.id);
    return { ...none(`本人3灵性与同一${paper.id}已实际消耗。本槽形成短暂月光纸影，有限减势35（G），随后纸影结束；没有永久替身、灵魂复制、完全免伤或死亡复活。后续J无新PREPARED纸时普通避让。`), enemyReduction: 35 };
  }
  const cost = id === 'moon.s4.blood-moon-arrow' ? 4 : 3;
  if (s.spirituality < cost) return id === 'moon.s4.blood-moon-arrow' ? ordinary('灵性不足4，不能施放血月之箭。') : none('灵性不足3，继承深渊枷锁本槽0贡献、0消耗，不重抽或自动定身。');
  s.spirituality -= cost;
  const ability = id === 'moon.s4.blood-moon-arrow' ? 'perception' : 'will';
  const chance = computeCheckChance({ ability, baseAbility: s.character.coreStats[ability], difficulty: 16, modifiers: [] }), roll = random.nextInt(1, 100);
  if (roll > chance) return none(`${id === 'moon.s4.blood-moon-arrow' ? '血月之箭' : '继承深渊枷锁'}实际检验${roll}>${chance}，${cost}灵性照耗，0效果、0贡献，不再附送普通打击、返还费用或重抽。原人仍能抵抗。`);
  return id === 'moon.s4.blood-moon-arrow'
    ? { ...none(`血月之箭实耗4灵性，感知检验${roll}≤${chance}，对当前可见2米原敌取得45×掌握的有限优势（G）；真实伤势仍由共同战盘结算，不保证命中任何闪现目标。`), selfGain: 45 * mastery(s, id), threatens: true }
    : { ...none(`继承moon.s7.abyss-shackles实耗3灵性，意志检验${roll}≤${chance}，原多里安受一次有限牵制，减势14（G）。考虑当前抵抗，不删行动、不完全定身、不获得新序列4锁链。`), enemyReduction: 14 };
}
export function finishWitchKingCombatRound(s: SliceState, ctx: WitchKingRoundContext, _continues: boolean): string {
  const e = s.witchKing.encounter, c = s.combat!;
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus;
  if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  Object.assign(ctx.outcome, { enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus });
  return `本轮所有纸影、血月之箭及有限枷锁已结束；实耗原纸${ctx.outcome.papersConsumed.length}张，原记录保留，回灵不补纸。原身体不因月光化而免疫死亡。`;
}
export function projectWitchKingCombat(s: SliceState) { return { enemyName: '原42岁多里安', papers: s.witchKing.life.papers.map(p => ({ ...p })), preparedPaperId: preparedWitchKingPaper(s)?.id ?? null, source: currentWitchKingCombatSource(s), summary: '4阶核心1250/底线125，灵性上限120、继续回合恢复12（G）。J只使用战前明确准备的同一原纸；不足资源H普通打击、J普通避让，能力付费检验失败则0效果。没有常驻无敌或召唤门。' }; }
