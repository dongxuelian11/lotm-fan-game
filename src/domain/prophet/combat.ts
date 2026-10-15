import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { MysticismMagisterCraft } from '../mysticism-magister/types.js';
import { hasProphetDisputeOpponent } from './encounter.js';

/** All costs, wheels and reductions here are bounded game values (G), never oracle facts. */
export const PROPHET_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const prophetActionCount = pyromaniacActionCount;
export type ProphetMoveId = 'STRIKE' | 'reader.s4.fragmentary-foresight' | 'EVADE' | 'reader.s6.limited-imitation' | 'reader.s5.material-imitation' | 'ACCIDENT';
const ABILITIES: readonly { id: ProphetMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'STRIKE', label: '普通主攻（H；原身体12/自有原棍16×身体G）', weight: 30, stance: 'ATTACK' },
  { id: 'reader.s4.fragmentary-foresight', label: '有限片段预警（J；4灵性、意志16；成功减势22G，失败0）', weight: 15, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（B；减势10G，不保证免伤）', weight: 20, stance: 'DEFEND' },
  { id: 'reader.s6.limited-imitation', label: '继承原FLASH弱闪光（K；真实已学、2灵性、知识14）', weight: 20, stance: 'CONTROL' },
  { id: 'reader.s5.material-imitation', label: '实际耗用最早原微光片（R；旧原材料与固定效力，额外0灵性）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const isProphet = (s: SliceState): boolean => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function prophetAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] { const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 })); }
export function drawProphetAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ProphetMoveId { const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0)); for (let i = 0; i < weights.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; } throw new Error('预言家能力盘无效。'); }
export interface ProphetCombatSource { runId: string; revision: number; week: number; round: number; encounterId: 'PROPHET_DISPUTE'; attemptWeek: number; startHistoryIndex: number; enemyId: 'PF4-HAROLD'; nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN'; weaponId: 'PF4-HAROLD-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; visible: true; exit: 'ORIGINAL_OPEN_ARCHIVE_YARD_EXIT'; pursuit: false }
export function currentProphetCombatSource(s: SliceState): ProphetCombatSource | null { if (!hasProphetDisputeOpponent(s)) return null; const e = s.prophet.encounter; return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round, encounterId: 'PROPHET_DISPUTE', attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, enemyId: 'PF4-HAROLD', nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN', weaponId: 'PF4-HAROLD-CLUB', weaponLocation: 'HAND', distanceMetres: 2, visible: true, exit: 'ORIGINAL_OPEN_ARCHIVE_YARD_EXIT', pursuit: false }; }
const validSource = (s: SliceState, source: ProphetCombatSource | null): boolean => { const now = currentProphetCombatSource(s); return now !== null && source !== null && Object.entries(now).every(([key, value]) => (source as unknown as Record<string, unknown>)[key] === value); };
export interface ProphetRoundOutcome { enemyId: 'PF4-HAROLD'; enemyHealth: number; enemyMind: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; consumedCraftIds: string[]; foresightSuccesses: number }
export interface ProphetRoundContext { source: ProphetCombatSource; round: number; outcome: ProphetRoundOutcome }
export function beginProphetCombatRound(s: SliceState): ProphetRoundContext { const source = currentProphetCombatSource(s); if (!source) throw new Error('缺少原哈罗德、原短棍或连续回合来源。'); const c = s.combat!; return { source, round: c.round, outcome: { enemyId: 'PF4-HAROLD', enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, consumedCraftIds: [], foresightSuccesses: 0 } }; }

// These inherited source checks and fixed effects match the original S5 resolver.
function hasLearnedFlash(s: SliceState): boolean {
  const sample = s.polymath.samples.FLASH;
  const { observedWeek, understoodWeek, learnedWeek, analysisAttemptWeek } = sample;
  return [observedWeek, understoodWeek, learnedWeek, analysisAttemptWeek].every(week =>
    week !== null && Number.isSafeInteger(week) && week >= 1 && week <= s.week) &&
    observedWeek! <= understoodWeek! && understoodWeek! <= learnedWeek! &&
    observedWeek! <= analysisAttemptWeek! && analysisAttemptWeek! <= learnedWeek!;
}
/** Original identity, one real consumed source kit, fixed manufacture power.
 * This never repairs invalid inventory or fabricates an item on a drawn slot. */
function oldestPreparedFlash(s: SliceState): MysticismMagisterCraft | null {
  const m = s.mysticismMagister;
  const eligible = m.crafts.filter(c => {
    const kit = /^MM5-KIT-([1-9]\d*)$/.exec(c.sourceKitId);
    return /^MM5-FLASH-[1-9]\d*$/.test(c.id) && kit !== null &&
      Number.isSafeInteger(Number(kit[1])) && c.id === `MM5-FLASH-${kit[1]}` &&
      Number.isSafeInteger(m.practice.kitsUsed) && Number(kit[1]) <= m.practice.kitsUsed &&
      c.status === 'PLAYER' && c.usedWeek === null && Number.isSafeInteger(c.createdWeek) &&
      m.promotionWeek !== null && c.createdWeek >= m.promotionWeek && c.createdWeek <= s.week &&
      Number.isFinite(c.power) && c.power >= 0.65 && c.power <= 1 &&
      m.crafts.filter(other => other.id === c.id || other.sourceKitId === c.sourceKitId).length === 1;
  });
  return eligible.sort((a, b) => a.createdWeek - b.createdWeek ||
    Number(a.id.slice('MM5-FLASH-'.length)) - Number(b.id.slice('MM5-FLASH-'.length)))[0] ?? null;
}
export interface ProphetCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
const none = (label: string): ProphetCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
export function resolveProphetCombatAbility(s: SliceState, id: ProphetMoveId, physicalStateFactor: number, random: ActionRandomStream, ctx: ProphetRoundContext, source: ProphetCombatSource | null = ctx.source): ProphetCombatEffect {
  if (ctx.round !== s.combat?.round || !validSource(s, source)) return none('缺少当前原哈罗德、原短棍或连续回合来源，0贡献、0消耗，不重抽。');
  if (!ABILITIES.some(a => a.id === id)) return none('这不是本阶段已实现的预言家动作，0贡献、0消耗。');
  if (id === 'ACCIDENT') return { ...none('判断失衡，本槽固定优势−22.5（G），不另抽或新增行动。'), selfGain: -22.5 };
  if (id === 'STRIKE') { const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0; return { ...none(`本人使用${s.town.clubLocation === 'HAND' ? '自己实际持握的原短棍' : '自己的原身体'}普通打击，12/16×身体（G）；由共同胜负与伤势盘结算。`), selfGain: (s.town.clubLocation === 'HAND' ? 16 : 12) * physical, threatens: physical > 0 }; }
  if (id === 'EVADE') return { ...none('本人普通避让，减势10（G），0灵性；没有预言保证、护盾或免伤。'), enemyReduction: 10 };
  if (id === 'reader.s4.fragmentary-foresight') {
    if (!Number.isFinite(s.spirituality) || s.spirituality < 4) return none('不足4灵性，本槽只作普通观察，0贡献、0消耗；不读隐藏轮盘、不重抽。');
    s.spirituality -= 4;
    const chance = computeCheckChance({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 16, modifiers: [] }), roll = random.nextInt(1, 100);
    if (roll > chance) return none(`有限预警实际意志${roll}>${chance}失败，4灵性照耗，0效果；不补普通避让、不替换未来结果。`);
    ctx.outcome.foresightSuccesses++;
    return { ...none(`有限预警实耗4灵性、意志${roll}≤${chance}：只据自身片段谨慎调整本槽行动，减势22（G）。没有读取后续能力盘、胜负盘或伤势盘，不改变随机抽取、删敌行动、保证免伤或命运改写。`), enemyReduction: 22 };
  }
  if (id === 'reader.s6.limited-imitation') {
    if (!hasLearnedFlash(s) || !Number.isFinite(s.spirituality) || s.spirituality < 2) return none('继承有限闪光：缺少早先实际学会的原FLASH样本或不足2灵性，普通观察0贡献、0消耗；不补知识库或重抽。');
    s.spirituality -= 2;
    const chance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 14, modifiers: [] }), succeeded = random.nextInt(1, 100) <= chance;
    const learned = s.progression.mastery['reader.s6.limited-imitation'] ?? 0, mastery = 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(learned) ? learned : 0)) / 500;
    return { ...none(`继承有限闪光实耗2灵性、知识14检定${chance}%，${succeeded ? '成功：对2米内可见的原哈罗德作一次短暂低强干扰，减势12×原博学者掌握（G）' : '失败0效果，成本保留'}；完全沿用原弱FLASH，不造成伤害、删除行动、创造样本或即时入梦。`), enemyReduction: succeeded ? 12 * mastery : 0 };
  }
  if (s.mysticismMagister.cases['modest-craft']?.status !== 'RESOLVED') return none('原制造案未完成安全测试与报告，首件原试作品仍须留给真实TEST_TOKEN；本槽普通观察0贡献、0消耗。');
  const craft = oldestPreparedFlash(s);
  if (!craft) return none('没有真实制成且仍由本人持有的合格MM5-FLASH原件，本槽普通观察0贡献、0消耗；不现场制造、不补库存、不重抽。');
  craft.status = 'CONSUMED'; craft.usedWeek = s.week; ctx.outcome.consumedCraftIds.push(craft.id);
  return { ...none(`实际一次耗尽最早原片${craft.id}（原材料${craft.sourceKitId}），对可见2米原哈罗德作低强闪光，减势18×制作时固定效力${craft.power}（G）。沿用原S5效果，额外灵性0；不按当前掌握重算、不造成伤害、删行动或补原片。`), enemyReduction: 18 * craft.power };
}
export function finishProphetCombatRound(s: SliceState, ctx: ProphetRoundContext, _continues: boolean): string {
  const e = s.prophet.encounter, c = s.combat!;
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus; if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  Object.assign(ctx.outcome, { enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus });
  return '本轮有限预警与弱闪光已经结束；实际耗掉的原微光片保留CONSUMED历史，不返灵性、补原片、治疗或复活，下一轮仍按原随机源抽取。';
}
export function projectProphetCombat(s: SliceState) { return { enemyName: '原46岁哈罗德·布伦特', source: currentProphetCombatSource(s), crafts: s.mysticismMagister.crafts.map(c => ({ ...c })), remainingCraftIds: s.mysticismMagister.crafts.filter(c => c.status === 'PLAYER').map(c => c.id), summary: '4阶核心35/25/25/15、1250/底线125，灵性上限120、继续回合恢复12（G），行动1–6。片段预警可失败，只减当前优势，不检查或替换未来轮盘；继承FLASH与原微光片均须真实旧来源，R一次消耗最早合格原件。没有保证预言获胜、改写命运或更高阶能力。' }; }
