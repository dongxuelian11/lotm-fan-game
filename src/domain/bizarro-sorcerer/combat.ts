import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceState, SliceStance, SliceWheelEntry } from '../slice/types.js';
import { MAGICIAN_COUNT_WHEEL, magicianActionCount, resolveMagicianCombatAbility, type MagicianCombatEffect } from '../magician/combat.js';
import type { MarionettistMoveId } from '../marionettist/combat.js';
import { hasBizarroRitualOpponent } from './ritual.js';

/** G: new S4 1250/floor125 and max120/regen12 are selected by the shared
 * engine. No donated resources, new bodies, faster damage or guaranteed win. */
export const BIZARRO_SORCERER_COUNT_WHEEL = MAGICIAN_COUNT_WHEEL;
export type BizarroSorcererMoveId = MarionettistMoveId | 'diviner.s4.worm-assignment' | 'diviner.s4.puppet-swap';
interface Ability { id: BizarroSorcererMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'STRIKE', label: '本人普通打击（G；12/原棍16×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'diviner.s8.body-control', label: '继承体术（G；30×身体）', weight: 8, stance: 'ATTACK' },
  { id: 'diviner.s7.air-bullet', label: '继承空气弹（G；60，2灵性）', weight: 12, stance: 'ATTACK' },
  { id: 'diviner.s8.paper-dagger', label: '原纸飞刀（G；34×身体，纸1/灵性1）', weight: 4, stance: 'ATTACK' },
  { id: 'diviner.s7.paper-weapon', label: '原纸武器（G；22×身体，纸1/灵性1）', weight: 3, stance: 'ATTACK' },
  { id: 'diviner.s7.flame-control', label: '同场原火操纵（G；31.2，2灵性）', weight: 3, stance: 'ATTACK' },
  { id: 'diviner.s8.balance', label: '继承平衡（G；28）', weight: 8, stance: 'DEFEND' },
  { id: 'diviner.s7.flame-jump', label: '真实原灯局部火跳（G；31.2，3灵性）', weight: 9, stance: 'DEFEND' },
  { id: 'diviner.s7.illusion', label: '有限幻术诱导（G；2灵性）', weight: 8, stance: 'DEFEND' },
  { id: 'diviner.s5.spirit-threads', label: '同阶强敌灵体线辨真（G；12×掌握，2灵性）', weight: 20, stance: 'CONTROL' },
  { id: 'diviner.s4.worm-assignment', label: '灵之虫赋能：须真实原秘偶与已布置灵体线；携笼中未部署则0', weight: 5, stance: 'PREPARE' },
  { id: 'diviner.s4.puppet-swap', label: '秘偶换位：须本人/同一原秘偶的已知异位端点；未布置则0', weight: 5, stance: 'PREPARE' },
];
export function isBizarroSorcerer(s: SliceState): boolean { return s.progression.pathwayId === 'diviner' && s.progression.sequence === 4; }
export function currentBizarroSorcererCombatSource(s: SliceState) {
  if (!isBizarroSorcerer(s) || !hasBizarroRitualOpponent(s)) return null;
  const r = s.bizarroSorcerer.ritual;
  return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round,
    encounterId: 'BIZARRO_RITUAL' as const, targetId: r.currentTargetId!, attemptId: r.attemptId!, startHistoryIndex: r.startHistoryIndex!,
    nature: 'ORIGINAL_LIVING_S4_EQUIVALENT_BEAST' as const, distanceMetres: 2 as const, exit: 'ORIGINAL_OPEN_BELL_COURT_EXIT' as const };
}
function abilities(s: SliceState): readonly Ability[] {
  return s.injuries.some(i => i.severity === 'HEAVY' && !s.magician.damageTransfers.includes(i.id))
    ? ABILITIES.map<Ability>(a => a.id === 'diviner.s8.balance' ? { ...a, id: 'diviner.s7.damage-transfer', label: '同一原重伤一次体内转移（G；3灵性）' } : a) : ABILITIES;
}
export function bizarroSorcererAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const entries = abilities(s), weights = entries.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4)), total = weights.reduce((a, b) => a + b, 0);
  return entries.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawBizarroSorcererAbility(random: ActionRandomStream, s: SliceState, stance: SliceStance | null): BizarroSorcererMoveId {
  const entries = abilities(s), weights = entries.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
  let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < entries.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return entries[i]!.id; }
  throw new Error('诡法师能力盘权重无效');
}
export const bizarroSorcererActionCount = magicianActionCount;
const none = (label: string): MagicianCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
export function resolveBizarroSorcererCombatAbility(s: SliceState, id: BizarroSorcererMoveId, physical: number,
  source = currentBizarroSorcererCombatSource(s)): MagicianCombatEffect {
  const current = currentBizarroSorcererCombatSource(s);
  if (!current || !source || Object.entries(current).some(([k, v]) => (source as unknown as Record<string, unknown>)[k] !== v)) return none('诡法师：缺少本场唯一原活体、原钟院或连续回合来源，贡献0、消耗0');
  if (id === 'diviner.s4.worm-assignment' || id === 'diviner.s4.puppet-swap') return none(id === 'diviner.s4.worm-assignment'
    ? '灵之虫赋能：本场没有已部署的原秘偶与赋能灵体线；已有原鼠仍须依其真实携笼状态，没有战场布置，贡献0、消耗0，不赠送50只秘偶或虫体'
    : '秘偶换位：没有已部署在另一已知原位置的同一原秘偶；携笼内原鼠不是远端落点，贡献0、消耗0，不与空地、植物或幻象换位');
  if (id === 'diviner.s5.spirit-threads') {
    if (s.spirituality < 2) return none('灵体线辨真：本人灵性不足2，普通观察0贡献，不重抽');
    s.spirituality -= 2; const learned = s.progression.mastery[id] ?? 0;
    return { ...none('灵体线：本人耗2灵性，牵动同阶强敌真实灵体线，仅有限迟缓12×掌握（G）；不把15秒当任何目标自动转化，不初控或制造秘偶'), enemyReduction: 12 * (0.65 + 0.35 * Math.max(0, Math.min(500, learned)) / 500) };
  }
  if (id === 'diviner.s5.marionette-control') return none('本场没有部署的原秘偶，无额外行动');
  if (id === 'ACCIDENT') return { ...none('专注失衡（G）'), selfGain: -22.5 };
  return resolveMagicianCombatAbility(s, id, Math.max(0, Math.min(1, physical)));
}
