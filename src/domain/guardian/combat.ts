import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasGuardianDisputeOpponent, hasGuardianOpenPractice } from './encounter.js';

/** Finite S5 G profile. These weights and reductions are not quoted canon. */
export const GUARDIAN_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 14 }),
  Object.freeze({ id: '6', label: '6次', weight: 6 }),
]);
export type GuardianMoveId = 'warrior.s6.dawn-weapon' | 'warrior.s6.light-storm'
  | 'warrior.s5.guard-state' | 'warrior.s5.damage-sharing' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: GuardianMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'warrior.s6.dawn-weapon', label: '晨曦剑主攻（H；已有剑时2灵性；无剑用实际原棍16或身体12）', weight: 30, stance: 'ATTACK' },
  { id: 'warrior.s6.light-storm', label: '光之风暴（J；已有剑时4灵性；单一实际目标，失剑并冲散自身光甲）', weight: 15, stance: 'ATTACK' },
  { id: 'warrior.s5.guard-state', label: '守护自保（B；35.1×守护掌握系数减势，0灵性；不另叠防御倍率）', weight: 20, stance: 'DEFEND' },
  { id: 'warrior.s5.damage-sharing', label: '分担附近同伴伤害（K；本场没有同伴，实际分担0，普通格挡10、0灵性）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '凝聚／重凝晨曦剑（R；双手空出时3灵性、0即时贡献；风暴失剑当回合不能重凝）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '守住或失衡（A；±22.5，0灵性，不是致伤攻击）', weight: 5, stance: null },
];
export function isGuardian(s: SliceState): boolean {
  return s.progression?.pathwayId === 'warrior' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function guardianAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => {
    const firstCase = state?.combat?.encounterId === 'FIRST_CASE';
    const attacking = a.id === 'warrior.s6.dawn-weapon' || a.id === 'warrior.s6.light-storm';
    const label = stance === 'DEFEND' && attacking ? '保持守护，不执行攻击；本槽0贡献、0灵性'
      : firstCase && a.id === 'warrior.s6.dawn-weapon' ? '原携铃者前的普通主攻（H；自身身体12／实际原棍16，0灵性）'
      : firstCase && a.id === 'warrior.s6.light-storm' ? '原携铃者前的普通次击（J；自身身体8，0灵性，无晨曦剑）'
      : firstCase && a.id === 'OBSERVE' ? '普通观察（R；只观察实际原携铃者与原出口，0贡献、0灵性）'
      : a.id === 'OBSERVE' && state?.guardian.encounter.swordReady ? '复核原握持与原出口（R；已有晨曦剑，0贡献、0灵性，不追加攻击）'
      : a.label;
    return { id: a.id, weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100,
      label: `${label}；${stance === 'DEFEND'
        ? '本轮全程放弃攻击，开轮3灵性守护防御×0.35，不足时普通防御'
        : stance === 'RETREAT' ? '沿实际原出口尝试撤退，不凝剑或建立全力守护'
        : '迎战防御降低至实际普通打击×0.75（G）'}` };
  });
}
export function drawGuardianAbility(random: ActionRandomStream, stance: SliceStance | null): GuardianMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('守护者能力盘权重无效');
}
export function guardianActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 32 ? 2 : roll <= 57 ? 3 : roll <= 80 ? 4 : roll <= 94 ? 5 : 6;
}

export interface GuardianCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'GUARDIAN_DISPUTE' | 'FIRST_CASE';
  target: 'EDWIN_SINGLE_ADULT_ORDINARY_HUMAN' | 'ORIGINAL_LIVING_CARRIER';
  nature: 'ORDINARY_HUMAN'; body: 'CURRENT_REACHABLE_BODY';
  weapon: 'EDWINS_OWN_ORDINARY_SHORT_CLUB' | 'ORIGINAL_CARRIER_CLUB';
  space: 'ORIGINAL_TRAINING_OUTER_COURTYARD' | 'ORIGINAL_FIRST_CASE';
  visibility: 'MUTUALLY_VISIBLE'; distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND';
  bystanders: 'NONE'; ally: 'NONE'; illusion: 'NONE'; holyVulnerable: false;
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false; attemptWeek: number | null; startHistoryIndex: number | null;
}
export function currentGuardianCombatSource(s: SliceState): GuardianCombatSource | null {
  const c = s.combat;
  if (!isGuardian(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasGuardianOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', visibility: 'MUTUALLY_VISIBLE',
    distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE', ally: 'NONE',
    illusion: 'NONE', holyVulnerable: false, exit: 'ORIGINAL_OPEN_EXIT', pursuit: false } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist ||
        s.guardian.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasGuardianDisputeOpponent(s)) return null;
  return { ...common, encounterId: 'GUARDIAN_DISPUTE', target: 'EDWIN_SINGLE_ADULT_ORDINARY_HUMAN',
    weapon: 'EDWINS_OWN_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_TRAINING_OUTER_COURTYARD',
    attemptWeek: s.guardian.encounter.attemptWeek, startHistoryIndex: s.guardian.encounter.startHistoryIndex };
}
function validSource(s: SliceState, source: GuardianCombatSource | null): boolean {
  const current = currentGuardianCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
export interface GuardianRoundContext {
  source: GuardianCombatSource | null; defending: boolean; paidGuard: boolean; label: string;
}
/** Called once at round start, before either actor acts. No free attack follows. */
export function beginGuardianCombatRound(s: SliceState, stance: SliceStance): GuardianRoundContext {
  const source = currentGuardianCombatSource(s), defending = stance === 'DEFEND';
  const paidGuard = source !== null && defending && Number.isFinite(s.spirituality) && s.spirituality >= 3;
  if (paidGuard) s.spirituality -= 3;
  return { source, defending, paidGuard, label: defending
    ? paidGuard ? '全力守护：开轮已付3灵性，本整轮放弃一切攻击；实际正向普通打击贡献×0.35（G），不减免既成伤势、不豁免死亡盘。'
      : '选择守护但不足3灵性：本整轮仍放弃攻击，只能普通防御×1；没有免费建立守护。'
    : stance === 'RETREAT' ? '本轮沿实际原出口尝试撤退，未付守护灵性；若仍遭实际普通打击，其贡献×0.75（G），不附送攻击。'
      : '本轮选择迎战，主动降低守护防御：实际正向普通打击贡献×0.75（G）；没有全力守护与进攻同时生效。' };
}
function validRound(s: SliceState, context: GuardianRoundContext): boolean {
  return validSource(s, context.source);
}
function masteryFactor(s: SliceState, id: GuardianMoveId): number {
  const value = s.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0)) / 500;
}
function heldClub(s: SliceState): string | null {
  if (s.town.clubLocation === 'HAND') return '实际持握自己的原短棍';
  const c = s.warrior.practiceClub;
  return c.id === 'warrior-training-club' && c.owner === '奥斯温·布莱克特' && c.custodian === 'PLAYER' &&
    c.location === 'player:hand' ? '实际持握奥斯温借出的原练习短棍' : null;
}
function handsOccupied(s: SliceState): boolean {
  return s.town.clubLocation === 'HAND' || s.warrior.practiceClub.location === 'player:hand';
}
export interface GuardianCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
function noEffect(label: string): GuardianCombatEffect { return { label, selfGain: 0, enemyReduction: 0, threatens: false }; }
function ordinary(s: SliceState, physical: number, reason: string, secondary = false): GuardianCombatEffect {
  const club = secondary ? null : heldClub(s), budget = secondary ? 8 : club ? 16 : 12, selfGain = budget * physical;
  return { label: `${reason}；${club ?? '自身原身体'}${secondary ? '次击' : '打击'}${budget}×当前身体系数（G），0灵性，不凝剑或叠加旧弱点预算`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
}
export function resolveGuardianCombatAbility(
  s: SliceState, id: GuardianMoveId, physicalStateFactor: number, random: ActionRandomStream,
  context: GuardianRoundContext, source: GuardianCombatSource | null = currentGuardianCombatSource(s),
): GuardianCombatEffect {
  if (!validSource(s, source) || !validRound(s, context)) return noEffect('缺少本场实际原敌、原身体与连续回合来源；0贡献、0灵性、不重抽');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const e = s.guardian.encounter, round = s.combat!.round;
  const canPay = (n: number) => Number.isFinite(s.spirituality) && s.spirituality >= n;
  if (context.defending && (id === 'warrior.s6.dawn-weapon' || id === 'warrior.s6.light-storm')) {
    return noEffect('本轮已选择全力守护并放弃攻击：本槽只保持原站位，0贡献、0灵性、不挥棍、不挥剑、不释放风暴；不会威胁或伤害原敌');
  }
  switch (id) {
    case 'warrior.s6.dawn-weapon': {
      if (source!.encounterId === 'FIRST_CASE') return ordinary(s, physical, '首案原携铃者当前可达，本槽只使用自身原身体或实际原棍');
      if (!e.swordReady) return ordinary(s, physical, '当前没有实际晨曦剑');
      if (!canPay(2) || physical <= 0) return ordinary(s, physical, '当前不足2灵性或身体无法执行晨曦剑主攻');
      s.spirituality -= 2;
      const selfGain = 65 * 1.7 * 0.65 * masteryFactor(s, id) * physical;
      return { label: '实际晨曦剑主攻：已耗2灵性，继承71.825×晨曦武器掌握系数×当前身体系数（G）；普通人埃德温没有神圣易伤，不叠加原棍或旧弱点，不直接判死', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'warrior.s6.light-storm': {
      if (source!.encounterId === 'FIRST_CASE') return ordinary(s, physical, '首案仍是实际原携铃者，未建立本场晨曦剑', true);
      if (!e.swordReady) return ordinary(s, physical, '没有实际晨曦剑，不能释放光之风暴', true);
      if (!canPay(4) || physical <= 0) return ordinary(s, physical, '不足4灵性或身体无法释放风暴，现有剑甲不消失', true);
      s.spirituality -= 4;
      const hadArmor = e.armorReady;
      e.swordReady = false; e.swordLostRound = round; e.armorReady = false; e.armorExpiresRound = null;
      const selfGain = 65 * 1.7 * 0.35 * masteryFactor(s, id) * physical;
      return { label: `光之风暴：已耗4灵性，继承38.675×本能力掌握系数×当前身体系数（G）；实际范围内只有普通人埃德温，数量不另抽、无神圣易伤；晨曦剑已散去，本回合不能重凝；${hadArmor ? '自身现有光甲也已冲散' : '现场没有现存光甲'}。没有同伴或额外目标，不虚构伤害，后果仍走共同盘`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'warrior.s5.guard-state':
      return { ...noEffect('守护自保：35.1×守护掌握系数减势（G），本槽0灵性；不攻击、不治疗、不额外叠加或刷新防御倍率'), enemyReduction: 90 * 0.6 * 0.65 * masteryFactor(s, id) };
    case 'warrior.s5.damage-sharing':
      return { ...noEffect('本场没有附近同伴：实际分担伤害0；只普通格挡10（G），0灵性，不把埃德温或首案原敌当友军，也不把生活同伴召入战斗'), enemyReduction: 10 };
    case 'OBSERVE':
      if (source!.encounterId === 'FIRST_CASE') return noEffect('首案只观察实际原携铃者与原出口；0贡献、0灵性，不借用外院装备或生成埃德温');
      if (e.swordReady) return noEffect('已有实际晨曦剑：只复核原握持与原出口，0贡献、0灵性，不再凝剑或追加攻击');
      if (e.swordLostRound === round) return noEffect('本回合刚由风暴失剑，低序列本回合不能重凝；0贡献、0灵性，须等下一回合实际抽中预备槽');
      if (handsOccupied(s)) return noEffect('原短棍实际占手，不能自动收物或同时持双手晨曦剑；0贡献、0灵性，原物归属与位置不变');
      if (!canPay(3)) return noEffect('不足3灵性，未凝聚晨曦剑；0贡献、0灵性，不重抽');
      s.spirituality -= 3; e.swordReady = true;
      return noEffect('实际凝聚晨曦剑：已耗3灵性，只建立本场持剑状态；0即时贡献，不附送攻击，之后抽中攻击槽另付成本；守护姿态下仍不得攻击');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -22.5 : 22.5;
      return { ...noEffect(`守住或失衡：意外贡献${selfGain > 0 ? '+' : '−'}22.5（G），0灵性；不是攻击，不威胁原敌，不生成剑甲`), selfGain };
    }
  }
}
/** One mitigation stage, only for an actual unsuppressed positive STRIKE.
 * Existing temporary armor is consumed normally, but strongest effect wins. */
export function consumeGuardianDefense(
  s: SliceState, context: GuardianRoundContext, abilityId: string, actualContribution: number, suppressed = false,
): { physicalMultiplier: number; label: string } | null {
  if (suppressed || abilityId !== 'STRIKE' || !Number.isFinite(actualContribution) || actualContribution <= 0 || !validRound(s, context)) return null;
  let physicalMultiplier = context.defending ? context.paidGuard ? 0.35 : 1 : 0.75;
  let armor = '';
  if (context.source!.encounterId === 'GUARDIAN_DISPUTE' && s.guardian.encounter.armorReady) {
    s.guardian.encounter.armorReady = false; s.guardian.encounter.armorExpiresRound = null;
    physicalMultiplier = Math.min(physicalMultiplier, 0.6);
    armor = '；现有临时光甲已消耗，只取较强防护，不相乘';
  }
  return { physicalMultiplier, label: `本次实际普通打击仅贡献×${physicalMultiplier}（G）${armor}；不另减健康、不取消后果盘或死亡风险` };
}
export function finishGuardianCombatRound(s: SliceState, continuing: boolean): string | null {
  if (!isGuardian(s) || s.combat?.encounterId !== 'GUARDIAN_DISPUTE') return null;
  const e = s.guardian.encounter;
  if (!continuing) {
    const hadGear = e.swordReady || e.armorReady || e.swordLostRound !== null;
    e.swordReady = false; e.swordLostRound = null; e.armorReady = false; e.armorExpiresRound = null;
    return hadGear ? '本场临时晨曦剑、光甲与失剑记录已清除；实际灵性消耗、伤势及原物归属保留。' : null;
  }
  if (e.armorReady && e.armorExpiresRound !== null && e.armorExpiresRound <= s.combat.round) {
    e.armorReady = false; e.armorExpiresRound = null;
    return '未触发的临时晨曦光甲已到原定期限并消散，不补灵性、不自动重凝。';
  }
  return null;
}
