import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount, type PyromaniacCombatEffect } from '../pyromaniac/combat.js';
import { resolveProvokerCombatAbility } from '../provoker/combat.js';
import type { ReaperMoveId } from '../reaper/combat.js';
import { hasIronBloodDisputeOpponent, IRON_BLOOD_COMPANION_IDS } from './encounter.js';
import { dismissIronBloodMembers, findIronBloodMember } from './team.js';

/** Finite S4 G profile; old S9–5 and Diviner4 wheels are unchanged. */
export const IRON_BLOOD_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export type IronBloodSharePolicy = 'HOLD' | 'SHARE_FIRST';
export type IronBloodMoveId = ReaperMoveId | 'IRON_BLOOD_FLAME' | 'IRON_BLOOD_STEEL' | 'hunter.s4.comrade-link';
interface Ability { id: IronBloodMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'IRON_BLOOD_FLAME', label: '本人火焰形态攻击（H；4灵性，55×掌握×身体G）', weight: 15, stance: 'ATTACK' },
  { id: 'STRIKE', label: '本人原身体/原棍打击（H；12/16×身体G）', weight: 5, stance: 'ATTACK' },
  { id: 'IRON_BLOOD_STEEL', label: '本人短暂钢铁化（J；3灵性，有限减势18G）', weight: 10, stance: 'DEFEND' },
  { id: 'hunter.s5.precision-strike', label: '继承窗口精准打击（J；有效窗口2灵性，追加36×掌握×身体G）', weight: 10, stance: 'ATTACK' },
  { id: 'hunter.s9.physical-enhancement', label: '继承强化打击（J；28×身体G）', weight: 5, stance: 'ATTACK' },
  { id: 'hunter.s7.compressed-fireball', label: '继承压缩火球（J；3灵性，36G）', weight: 5, stance: 'ATTACK' },
  { id: 'EVADE', label: '继承身体避让（B；减势22G）', weight: 10, stance: 'DEFEND' },
  { id: 'BLOCK', label: '普通格挡（B；减势10G）', weight: 5, stance: 'DEFEND' },
  { id: 'hunter.s7.flame-control', label: '继承自身火焰牵制（K；2灵性，减势18G）', weight: 20, stance: 'CONTROL' },
  { id: 'hunter.s4.comrade-link', label: '借同场原战友力量（R；本人3灵性，每人3精力，各加12G）', weight: 5, stance: 'PREPARE' },
  { id: 'hunter.s5.weakness-observation', label: '继承实际弱点观察（R；2灵性，当前或下一轮窗口）', weight: 5, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '行动失衡（A；−22.5G）', weight: 5, stance: null },
];
export interface IronBloodCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'IRON_BLOOD_DISPUTE'; targetId: 'IB4-GARRICK'; nature: 'ORIGINAL_ADULT_HUMAN';
  weaponId: 'IB4-GARRICK-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2;
  space: 'ORIGINAL_OPEN_STONE_YARD'; lane: 'ORIGINAL_EMPTY_FIRE_LANE'; exit: 'ORIGINAL_OPEN_YARD_EXIT'; pursuit: false;
  startHistoryIndex: number; attemptWeek: number;
}
export interface IronBloodRoundOutcome {
  policy: IronBloodSharePolicy; enemyId: 'IB4-GARRICK'; enemyHealth: number; enemyMind: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; sharedHealthDamage: number;
  linkedMemberIds: string[]; payments: { memberId: string; healthDamage: number; energyCost: number }[];
}
export interface IronBloodRoundContext { round: number; source: IronBloodCombatSource; shareUsed: boolean; outcome: IronBloodRoundOutcome }
export interface IronBloodCombatProjection {
  enemyName: string; companions: { id: string; name: string; health: number; energy: number; present: boolean }[];
  linkedMemberIds: string[]; sharePolicy: IronBloodSharePolicy; summary: string;
}
export function isIronBloodKnight(s: SliceState): boolean { return s.progression.pathwayId === 'hunter' && s.progression.sequence === 4; }
export function currentIronBloodCombatSource(s: SliceState): IronBloodCombatSource | null {
  if (!isIronBloodKnight(s) || !hasIronBloodDisputeOpponent(s)) return null;
  const e = s.ironBloodKnight.encounter;
  return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round,
    encounterId: 'IRON_BLOOD_DISPUTE', targetId: 'IB4-GARRICK', nature: 'ORIGINAL_ADULT_HUMAN',
    weaponId: 'IB4-GARRICK-CLUB', weaponLocation: 'HAND', distanceMetres: 2,
    space: 'ORIGINAL_OPEN_STONE_YARD', lane: 'ORIGINAL_EMPTY_FIRE_LANE', exit: 'ORIGINAL_OPEN_YARD_EXIT', pursuit: false,
    startHistoryIndex: e.startHistoryIndex!, attemptWeek: e.attemptWeek! };
}
function validSource(s: SliceState, source: IronBloodCombatSource | null): boolean {
  const current = currentIronBloodCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([k, v]) => (source as unknown as Record<string, unknown>)[k] === v);
}
const none = (label: string): PyromaniacCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, angersEnemy: false });
const mastery = (s: SliceState, id: string) => 0.65 + 0.35 * Math.max(0, Math.min(500, s.progression.mastery[id] ?? 0)) / 500;
function strike(s: SliceState, physical: number, prefix = ''): PyromaniacCombatEffect {
  const armed = s.town.clubLocation === 'HAND';
  return { ...none(`${prefix}${armed ? '持自己原短棍' : '本人原身体'}普通打击`), selfGain: (armed ? 16 : 12) * physical, threatens: true };
}
function tickets(stance: SliceStance | null) { return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4)); }
export function ironBloodAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawIronBloodAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): IronBloodMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < weights.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('铁血骑士能力盘权重无效');
}
export const ironBloodActionCount = pyromaniacActionCount;
function presentMembers(s: SliceState) {
  return IRON_BLOOD_COMPANION_IDS.filter(id => s.ironBloodKnight.encounter.companionIds.includes(id))
    .map(id => findIronBloodMember(s, id)).filter(m => m !== undefined && m !== null)
    .filter(m => m.joined && m.willing && m.present && m.location === 'YARD' && m.health > 40);
}
function payment(ctx: IronBloodRoundContext, memberId: string) {
  let p = ctx.outcome.payments.find(p => p.memberId === memberId);
  if (!p) { p = { memberId, healthDamage: 0, energyCost: 0 }; ctx.outcome.payments.push(p); }
  return p;
}
export function beginIronBloodCombatRound(s: SliceState, policy: IronBloodSharePolicy): IronBloodRoundContext {
  const source = currentIronBloodCombatSource(s);
  if (!source || !['HOLD', 'SHARE_FIRST'].includes(policy)) throw new Error('铁血骑士当前原场景或本轮分担选择无效。');
  const e = s.ironBloodKnight.encounter;
  e.sharePolicy = policy; e.linkedMemberIds = policy === 'SHARE_FIRST' ? presentMembers(s).map(m => m.id) : [];
  return { source, round: s.combat!.round, shareUsed: false, outcome: { policy, enemyId: 'IB4-GARRICK',
    enemyHealth: s.combat!.enemyHealth, enemyMind: s.combat!.enemyMind, enemyStatus: 'RESISTING',
    sharedHealthDamage: 0, linkedMemberIds: [...e.linkedMemberIds], payments: [] } };
}
export function resolveIronBloodCombatAbility(s: SliceState, id: IronBloodMoveId, physicalStateFactor: number,
  random: ActionRandomStream, round?: IronBloodRoundContext,
  source: IronBloodCombatSource | null = currentIronBloodCombatSource(s)): PyromaniacCombatEffect {
  if (!validSource(s, source)) return none('缺少同场原加里克、原空院或当前回合来源，贡献0、消耗0。');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  if (id === 'IRON_BLOOD_STEEL') {
    if (s.spirituality < 3) return { ...none('短暂钢铁化：灵性不足3，未施展，本次普通格挡。'), enemyReduction: 10 };
    s.spirituality -= 3;
    return { ...none('本人耗3灵性短暂钢铁化，本次动作有限减势18（G）后恢复人形；不是免疫，旧伤与本轮真实后果仍结算。'), enemyReduction: 18 };
  }
  if (id === 'IRON_BLOOD_FLAME') {
    if (s.spirituality < 4) return strike(s, physical, '火焰形态：灵性不足4，本次只作');
    s.spirituality -= 4;
    return { ...none('本人耗4灵性，沿当前原2米净空通路短暂火焰化攻击后复为人形；优势55×掌握×身体（G），无瞬移、飞行、免伤或穿墙。'), selfGain: 55 * mastery(s, 'hunter.s4.flame-steel') * physical, threatens: true };
  }
  if (id === 'hunter.s4.comrade-link') {
    const members = presentMembers(s).filter(m => m.energy >= 3);
    if (!round || round.round !== s.combat!.round || !validSource(s, round.source) || !members.length || s.spirituality < 3) return none('战友联系：缺少当前回合、真实在场且有3精力的原队员或本人3灵性，贡献0、消耗0；不凭空调用30人。');
    s.spirituality -= 3;
    for (const m of members) {
      m.energy -= 3; payment(round, m.id).energyCost += 3;
      if (!s.ironBloodKnight.encounter.linkedMemberIds.includes(m.id)) s.ironBloodKnight.encounter.linkedMemberIds.push(m.id);
      if (!round.outcome.linkedMemberIds.includes(m.id)) round.outcome.linkedMemberIds.push(m.id);
    }
    return { ...none(`本人耗3灵性，${members.map(m => `${m.name}耗3精力（余${m.energy}）`).join('、')}，经真实联系借来有限力量，每人优势12（G）。不提供独立攻击、军团强化或免费精力恢复。`), selfGain: 12 * members.length };
  }
  const w = s.ironBloodKnight.encounter.weakness;
  if (id === 'hunter.s5.weakness-observation') {
    if (s.spirituality < 2) return none('继承弱点观察：灵性不足2，无窗口、无贡献、不重抽。');
    s.spirituality -= 2; w.available = true; w.sourceRound = s.combat!.round; w.observations += 1;
    return none('耗2灵性实际观察加里克的原棍与重心，建立当前或紧接下一轮的一次真实弱点窗口；本动作不攻击、优势0。');
  }
  if (id === 'hunter.s5.precision-strike') {
    if (!w.available || w.sourceRound === null || w.sourceRound > s.combat!.round || s.combat!.round > w.sourceRound + 1 || s.spirituality < 2)
      return strike(s, physical, '缺少有效原弱点窗口或2灵性，不消费窗口，本次只作');
    s.spirituality -= 2; w.available = false; w.sourceRound = null; w.uses += 1;
    const ordinary = strike(s, physical);
    return { ...ordinary, selfGain: ordinary.selfGain + 36 * mastery(s, id) * physical,
      label: '耗2灵性消费加里克的一次实际弱点窗口，本人原身体/原棍精准打击，原打击追加36×掌握×身体（G），不保证命中或致死。' };
  }
  if (id === 'STRIKE') return strike(s, physical);
  if (id === 'BLOCK') return { ...none('本人普通格挡'), enemyReduction: 10 };
  if (id === 'hunter.s9.hunting-instinct') return { ...none('继承猎杀直觉：观察原加里克当前持棍动作，不读未来。'), enemyReduction: 15 };
  if (['hunter.s7.flame-control', 'hunter.s7.compressed-fireball', 'hunter.s7.flame-lance', 'hunter.s7.fire-raven'].includes(id)) {
    const control = id === 'hunter.s7.flame-control', cost = control || id === 'hunter.s7.fire-raven' ? 2 : 3;
    if (s.spirituality < cost) return control ? { ...none(`继承火焰：灵性不足${cost}，未施法，只普通格挡。`), enemyReduction: 10 } : strike(s, physical, `继承火焰：灵性不足${cost}，未施法，只作`);
    s.spirituality -= cost;
    return { ...none(`继承自身火焰：耗${cost}灵性，沿原2米净空石院通道作用于唯一原加里克，原成本和有限效果不放大；火鸦只在本动作存在，没有独立行动者。`),
      selfGain: control ? 0 : id === 'hunter.s7.compressed-fireball' ? 36 : id === 'hunter.s7.flame-lance' ? 32 : 24,
      enemyReduction: control ? 18 : 0, threatens: !control };
  }
  if (id === 'ACCIDENT') return { ...none('行动失衡：本槽固定优势−22.5（G），没有免费分担或额外抽取。'), selfGain: -22.5 };
  if (id === 'hunter.s9.physical-enhancement' || id === 'EVADE' || id === 'hunter.s8.provocation' || id === 'hunter.s8.hostility-aura' || id === 'OBSERVE' || id === 'MISS')
    return resolveProvokerCombatAbility(s, id, physical, random);
  return none('不是本段已继承的有限动作，贡献0、消耗0。');
}
/** Intercepts only the current positive health loss, before its mutation. A DEATH
 * sector is never supplied here. Whole-player injury/risk remains untouched. */
export function shareIronBloodHealthDamage(s: SliceState, damage: number, ctx: IronBloodRoundContext,
  severity: 'LIGHT' | 'HEAVY' | 'DEATH'): { ownerDamage: number; label: string } {
  const actual = Math.max(0, Math.min(s.health, Number.isFinite(damage) ? damage : 0));
  if (severity === 'DEATH' || ctx.shareUsed || ctx.outcome.policy !== 'SHARE_FIRST' || !validSource(s, ctx.source) ||
      ctx.round !== s.combat?.round || actual <= 0) return { ownerDamage: actual, label: '' };
  ctx.shareUsed = true;
  let remaining = Math.min(10, Math.floor(actual * 0.2)), shared = 0;
  const details: string[] = [];
  for (const m of presentMembers(s).filter(m => s.ironBloodKnight.encounter.linkedMemberIds.includes(m.id))) {
    const amount = Math.min(5, remaining); if (amount <= 0) break;
    m.health -= amount; payment(ctx, m.id).healthDamage += amount; shared += amount; remaining -= amount;
    details.push(`${m.name}实付健康${amount}（余${m.health}）`);
    if (m.health <= 40) { dismissIronBloodMembers(s, [m.id]); s.ironBloodKnight.encounter.linkedMemberIds = s.ironBloodKnight.encounter.linkedMemberIds.filter(id => id !== m.id); }
  }
  ctx.outcome.sharedHealthDamage += shared;
  return { ownerDamage: actual - shared, label: shared ? `本轮明确分担一次：原健康伤害${actual}，本人承担${actual - shared}，${details.join('、')}；原伤势与带伤风险仍保留，未分担精神或死亡分支。` : '本轮没有仍符合条件的真实联系，健康伤害全部由本人承担。' };
}
export function finishIronBloodCombatRound(s: SliceState, ctx: IronBloodRoundContext, continues: boolean): string {
  const e = s.ironBloodKnight.encounter, c = s.combat!, w = e.weakness;
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus;
  if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  ctx.outcome.enemyHealth = c.enemyHealth; ctx.outcome.enemyMind = c.enemyMind; ctx.outcome.enemyStatus = c.enemyStatus;
  e.linkedMemberIds = [];
  if (w.available && (!continues || w.sourceRound === null || w.sourceRound < c.round)) { w.available = false; w.sourceRound = null; }
  return '本轮短暂形态已退出、战友联系已收束；原队员健康与精力保留，下轮仍须重新选择分担。';
}
export function projectIronBloodCombat(s: SliceState): IronBloodCombatProjection {
  const e = s.ironBloodKnight.encounter;
  return { enemyName: '加里克（原38岁成年看守）', companions: e.companionIds.map(id => { const m = findIronBloodMember(s, id)!;
    return { id, name: m.name, health: m.health, energy: m.energy, present: m.present && m.location === 'YARD' }; }),
    linkedMemberIds: [...e.linkedMemberIds], sharePolicy: e.sharePolicy,
    summary: '每轮默认不分担。明确选择分担时，仅实际在场且健康>40的原01/02承受一次最多20%健康伤害，每人最多5、合计最多10；不分担精神或死亡。借力另耗本人3灵性与各人3精力，原队员不会逐轮恢复。' };
}
