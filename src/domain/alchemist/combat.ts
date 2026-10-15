import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasAlchemistDisputeOpponent } from './encounter.js';
import { findAlchemistFrame } from './life.js';

/** Existing S4 1250/floor125/max120/regen12 and ordinary 1–6 count budgets. */
export const ALCHEMIST_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const alchemistActionCount = pyromaniacActionCount;
export type AlchemistMoveId = 'paragon.s4.animate-made-object' | 'paragon.s4.direct-creation' | 'paragon.s5.precision-focus' | 'STRIKE' | 'EVADE' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: AlchemistMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'paragon.s4.animate-made-object', label: '原护架动作／本人普通打击（H；可赋灵时4灵性＋储能1次、知识16；无可用原架时普通12/16×身体G）', weight: 25, stance: 'ATTACK' },
  { id: 'STRIKE', label: '本人普通打击（H；身体12/原棍16×身体G）', weight: 5, stance: 'ATTACK' },
  { id: 'paragon.s4.direct-creation', label: '指挥原护架／普通避让（J；可指挥时2灵性＋储能1次、减势26；否则普通减势10G）', weight: 25, stance: 'DEFEND' },
  { id: 'EVADE', label: '普通身体避让（B；减势10G，不免伤）', weight: 20, stance: 'DEFEND' },
  { id: 'paragon.s5.precision-focus', label: '继承短时专注校准（K；2灵性，12×原掌握G）', weight: 10, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '眼前普通观察（R；0灵性、0贡献）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const isAlchemist = (s: SliceState): boolean => s.progression.pathwayId === 'paragon' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function alchemistAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] { const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 })); }
export function drawAlchemistAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): AlchemistMoveId { const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0)); for (let i = 0; i < weights.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; } throw new Error('炼金术士能力盘无效。'); }
export interface AlchemistCombatSource { runId: string; revision: number; week: number; round: number; encounterId: 'ALCHEMIST_DISPUTE'; attemptWeek: number; startHistoryIndex: number; enemyId: 'AL4-OSRIC'; nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN'; weaponId: 'AL4-OSRIC-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; visible: true; exit: 'ORIGINAL_OPEN_WORKSHOP_YARD_EXIT'; pursuit: false }
export function currentAlchemistCombatSource(s: SliceState): AlchemistCombatSource | null { if (!hasAlchemistDisputeOpponent(s)) return null; const e = s.alchemist.encounter; return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round, encounterId: 'ALCHEMIST_DISPUTE', attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, enemyId: 'AL4-OSRIC', nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN', weaponId: 'AL4-OSRIC-CLUB', weaponLocation: 'HAND', distanceMetres: 2, visible: true, exit: 'ORIGINAL_OPEN_WORKSHOP_YARD_EXIT', pursuit: false }; }
const validSource = (s: SliceState, source: AlchemistCombatSource | null): boolean => { const now = currentAlchemistCombatSource(s); return now !== null && source !== null && Object.entries(now).every(([key, value]) => (source as unknown as Record<string, unknown>)[key] === value); };
export interface AlchemistRoundOutcome { enemyId: 'AL4-OSRIC'; enemyHealth: number; enemyMind: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; creationId: string | null; charge: number | null; durability: number | null; active: boolean }
export interface AlchemistRoundContext { source: AlchemistCombatSource; round: number; pendingGuards: number; outcome: AlchemistRoundOutcome }
export function beginAlchemistCombatRound(s: SliceState): AlchemistRoundContext {
  const source = currentAlchemistCombatSource(s); if (!source) throw new Error('缺少当前原奥斯里克与原院连续回合来源。');
  const c = s.combat!, f = findAlchemistFrame(s); return { source, round: c.round, pendingGuards: 0, outcome: { enemyId: 'AL4-OSRIC', enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, creationId: f?.location === 'YARD' ? f.id : null, charge: f?.location === 'YARD' ? f.charge : null, durability: f?.location === 'YARD' ? f.durability : null, active: f?.location === 'YARD' ? f.active : false } };
}
export interface AlchemistCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
const none = (label: string): AlchemistCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const mastery = (s: SliceState, id: string) => 0.65 + 0.35 * Math.max(0, Math.min(500, s.progression.mastery[id] ?? 0)) / 500;
function originalFrame(s: SliceState) {
  const f = findAlchemistFrame(s), kit = s.alchemist.life.materials.find(k => k.id === 'AL4-FRAME-KIT-1');
  return f && kit?.status === 'CONSUMED' && f.kind === 'GUARD_FRAME' && f.madeBy === s.runId && f.owner === 'PLAYER' && f.custodian === 'PLAYER' && f.location === 'YARD' && f.durability > 0 && f.componentIds.length === kit.componentIds.length && f.componentIds.every((id, i) => id === kit.componentIds[i]) && f.source === kit.source && s.alchemist.life.pieceRecords.includes(f.id) ? f : null;
}
export function resolveAlchemistCombatAbility(s: SliceState, id: AlchemistMoveId, physicalStateFactor: number, random: ActionRandomStream, ctx: AlchemistRoundContext, source: AlchemistCombatSource | null = ctx.source): AlchemistCombatEffect {
  if (ctx.round !== s.combat?.round || !validSource(s, source)) return none('缺少当前原奥斯里克、原短棍或连续回合，0贡献、0消耗，不重抽。');
  if (!ABILITIES.some(a => a.id === id)) return none('这不是当前已实现的炼金术士动作，0贡献0消耗。');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  if (id === 'STRIKE') { const gain = (s.town.clubLocation === 'HAND' ? 16 : 12) * physical; return { ...none('本人以当前原身体或实际持有的原短棍作普通打击，12/16×身体（G）；原护架没有独立行动次数。'), selfGain: gain, threatens: gain > 0 }; }
  if (id === 'EVADE') return { ...none('本人在原地面普通避让，有限减势10（G），不免疫伤势或死亡。'), enemyReduction: 10 };
  if (id === 'OBSERVE') return none('只观察眼前原奥斯里克和原护架，0灵性0贡献；不自动制造、补充储能或发现未知真相。');
  if (id === 'ACCIDENT') return { ...none('判断失衡：本槽固定−22.5（G），不追加行动、不制造队友。'), selfGain: -22.5 };
  if (id === 'paragon.s5.precision-focus') { if (s.spirituality < 2) return none('继承短时专注需要2灵性，不足则普通观察0贡献。'); s.spirituality -= 2; return { ...none('本人耗2灵性继承天文学家短时专注，12×原掌握（G）；只校准自己的注意力，本槽后结束，不给原护架充能。'), selfGain: 12 * mastery(s, id) }; }
  const ordinary = (reason: string): AlchemistCombatEffect => id === 'paragon.s4.direct-creation'
    ? { ...none(`${reason}本槽由本人作普通身体避让，减势10（G），0灵性、0原架储能；没有新造物、防护法术或免伤。`), enemyReduction: 10 }
    : { ...none(`${reason}本槽由本人以原身体或实际持有的原棍普通打击，12/16×身体（G），0灵性、0原架储能；没有新造物、赋灵或额外次数。`), selfGain: (s.town.clubLocation === 'HAND' ? 16 : 12) * physical, threatens: physical > 0 };
  const frame = originalFrame(s);
  if (!frame || frame.charge < 1) return ordinary('没有当前本人亲手制造、实际携带且仍有储能的原护架。');
  if (id === 'paragon.s4.direct-creation') {
    if (!frame.active || s.spirituality < 2) return ordinary('同一原护架尚未真实赋灵，或本人不足2灵性。');
    s.spirituality -= 2; frame.charge--; ctx.pendingGuards++;
    if (frame.charge === 0) frame.active = false;
    return { ...none(`本人耗2灵性并消费同一原护架1次储能，原架在本人一米内实际调整防守位置，有限减势26（G）；原储能余${frame.charge}。若本轮后续实际承接原棍打击才耐久−5；未用的短时防守轮末结束，不加额外行动或保证免伤。`), enemyReduction: 26 };
  }
  if (s.spirituality < 4) return ordinary('本人不足4灵性，未对原护架施术。');
  s.spirituality -= 4; frame.charge--;
  const chance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 16, modifiers: [] }), roll = random.nextInt(1, 100);
  if (roll > chance) { if (frame.charge === 0) frame.active = false; return none(`本人4灵性及原护架1次储能已付，知识检验${roll}>${chance}，本槽有限动作失败，0贡献；原储能余${frame.charge}，不退款或重抽。`); }
  frame.active = frame.charge > 0;
  return { ...none(`本人4灵性与同一原护架1次储能已付，知识检验${roll}≤${chance}；亲手制造的原架沿眼前2米内地面作一次有限推挡动作，优势40×掌握（G）。原储能余${frame.charge}，没有补充或复制，没有额外队友次数。`), selfGain: 40 * mastery(s, id), threatens: true };
}
/** Durability is charged only on a real later enemy club strike, never on observation or an expired guard. */
export function consumeAlchemistGuard(s: SliceState, ctx: AlchemistRoundContext, abilityId: string, originalGain: number, suppressed: boolean): string | null {
  if (ctx.pendingGuards < 1 || abilityId !== 'STRIKE' || originalGain <= 0 || suppressed || ctx.round !== s.combat?.round || !validSource(s, ctx.source)) return null;
  const frame = originalFrame(s); if (!frame) return null;
  ctx.pendingGuards--; frame.durability = Math.max(0, frame.durability - 5); if (frame.durability === 0) frame.active = false;
  return `已支付的同一AL4-FRAME-1实际承接原奥斯里克本次原棍接触，耐久−5至${frame.durability}；已计有限减势不重复叠加，不取消敌方行动或免疫真实伤势。`;
}
export function finishAlchemistCombatRound(s: SliceState, ctx: AlchemistRoundContext, continues: boolean): string {
  const e = s.alchemist.encounter, c = s.combat!, f = findAlchemistFrame(s);
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus; if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  if (f?.location === 'YARD' && (!continues || f.charge === 0 || f.durability === 0)) f.active = false;
  Object.assign(ctx.outcome, { enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, creationId: f?.location === 'YARD' ? f.id : null, charge: f?.location === 'YARD' ? f.charge : null, durability: f?.location === 'YARD' ? f.durability : null, active: f?.location === 'YARD' ? f.active : false });
  const pending = ctx.pendingGuards; ctx.pendingGuards = 0;
  return (pending ? '本轮未承接实击的短时原架防守已结束，已付灵性和储能不退，不扣未发生的耐久伤。' : '') + (f?.location === 'YARD' ? `同一原护架储能${f.charge}/3、耐久${f.durability}/100、${f.active ? '仍有限赋灵' : '已停止赋灵'}；普通回合回灵不补原件储能。` : '本场没有可用原护架，未免费产生造物。');
}
export function projectAlchemistCombat(s: SliceState) { const f = findAlchemistFrame(s); return { enemyName: '原44岁奥斯里克', creation: f ? { ...f, componentIds: [...f.componentIds] } : null, source: currentAlchemistCombatSource(s), summary: '4阶核心1250/底线125，灵性上限120、继续回合恢复12（G）。护架是已付材料并亲手制造的同一原物；储能不随回灵恢复，耐久不自动修复。' }; }
