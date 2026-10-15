import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { REAPER_COUNT_WHEEL, reaperActionCount } from '../reaper/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasGatekeeperDisputeOpponent, hasGatekeeperOpenPractice } from './encounter.js';

/** Independent S5 G profile. Every draw consumes exactly one actual action. */
export const GATEKEEPER_COUNT_WHEEL: readonly SliceWheelEntry[] = REAPER_COUNT_WHEEL;
export const gatekeeperActionCount = reaperActionCount;
export type GatekeeperMoveId = 'STRIKE' | 'SECONDARY_STRIKE' | 'EVADE'
  | 'death.s5.underworld-door' | 'death.s5.inner-underworld' | 'ACCIDENT';
interface Ability { id: GatekeeperMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'STRIKE', label: '普通主攻（H，G；身体12/自有原棍16×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'SECONDARY_STRIKE', label: '普通次攻（J，G；身体12/自有原棍16×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'EVADE', label: '普通避让（B，G；对方−10，不耗灵性）', weight: 20, stance: 'DEFEND' },
  { id: 'death.s5.underworld-door', label: '短暂冥界门牵引（K，G；4灵性、意志14，成功对方−18×新门掌握）', weight: 20, stance: 'CONTROL' },
  { id: 'death.s5.inner-underworld', label: '体内原灰羽短助（R，G；真实在内才耗3灵性，对方−12×体内冥界掌握，当次召回）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，G；固定−22.5，只抽一次）', weight: 5, stance: null },
];
export function isGatekeeper(s: SliceState): boolean {
  return s.progression?.pathwayId === 'death' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function gatekeeperAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawGatekeeperAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): GatekeeperMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('看门人能力盘权重无效');
}

/** The old one-letter contract alone is never permission to deploy this spirit. */
export function hasGatekeeperResidentSpirit(s: SliceState): boolean {
  const p = s.gatekeeper.companion, promotion = s.gatekeeper.promotionWeek;
  return isGatekeeper(s) && p.source === 'SG6-GRAY-FEATHER' && p.status === 'INSIDE' &&
    Number.isSafeInteger(p.agreementWeek) && p.agreementWeek !== null && promotion !== null &&
    p.agreementWeek >= promotion && p.agreementWeek <= s.week &&
    Number.isSafeInteger(p.entries) && p.entries >= 1 && Number.isSafeInteger(p.releases) && p.releases >= 0 &&
    p.entries - p.releases === 1 && Number.isSafeInteger(p.deployments) && p.deployments >= 0 &&
    Number.isSafeInteger(p.recalls) && p.recalls === p.deployments && p.feePaid === p.entries * 12;
}
export interface GatekeeperCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'GATEKEEPER_DISPUTE';
  target: 'ORIGINAL_LIVING_CARRIER' | 'LOCKE_SINGLE_ADULT';
  nature: 'ADULT_LIVING_HUMAN'; visible: true; distanceMetres: 2;
  playerBody: 'ORIGINAL_PLAYER_BODY'; playerHealth: number; playerMind: number;
  enemyHealth: number; enemyMind: number;
  weapon: 'ORIGINAL_CARRIER_CLUB' | 'LOCKE_ORIGINAL_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_FIRST_CASE' | 'ORIGINAL_EMPTY_PRIVATE_COURTYARD';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false; bystanders: false;
  companionSource: 'SG6-GRAY-FEATHER'; companionStatus: 'OUTSIDE' | 'INSIDE' | 'DEPLOYED';
  agreementWeek: number | null; entries: number; releases: number; deployments: number; recalls: number; feePaid: number;
  attemptWeek: number | null; startHistoryIndex: number | null;
}
/** FIRST_CASE retains its original carrier, body and tools. Locke is supplied
 * only by the separate paid visit; resident gray-feather comes only from a new
 * voluntary, paid agreement and actual entry into this original player body. */
export function currentGatekeeperCombatSource(s: SliceState): GatekeeperCombatSource | null {
  const c = s.combat;
  if (!isGatekeeper(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasGatekeeperOpenPractice(s)) return null;
  const p = s.gatekeeper.companion;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ADULT_LIVING_HUMAN', visible: true, distanceMetres: 2,
    playerBody: 'ORIGINAL_PLAYER_BODY', playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, weaponLocation: 'HAND',
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, bystanders: false,
    companionSource: p.source, companionStatus: p.status, agreementWeek: p.agreementWeek,
    entries: p.entries, releases: p.releases, deployments: p.deployments, recalls: p.recalls, feePaid: p.feePaid } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist ||
        s.gatekeeper.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasGatekeeperDisputeOpponent(s)) return null;
  return { ...common, encounterId: 'GATEKEEPER_DISPUTE', target: 'LOCKE_SINGLE_ADULT',
    weapon: 'LOCKE_ORIGINAL_CLUB', space: 'ORIGINAL_EMPTY_PRIVATE_COURTYARD',
    attemptWeek: s.gatekeeper.encounter.attemptWeek, startHistoryIndex: s.gatekeeper.encounter.startHistoryIndex };
}
function validSource(s: SliceState, source: GatekeeperCombatSource | null): boolean {
  const current = currentGatekeeperCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function mastery(s: SliceState, id: 'death.s5.underworld-door' | 'death.s5.inner-underworld'): number {
  const learned = s.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(learned) ? learned : 0)) / 500;
}
export interface GatekeeperCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
const noEffect = (label: string): GatekeeperCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
export function resolveGatekeeperCombatAbility(
  s: SliceState, id: GatekeeperMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: GatekeeperCombatSource | null = currentGatekeeperCombatSource(s),
): GatekeeperCombatEffect {
  if (!validSource(s, source)) return noEffect('看门人行动：缺少当前原活敌、2米可见目标、原身体或回合来源，0效果、0消耗，不重抽、不替换原场景或原人物');
  const target = source!.encounterId === 'FIRST_CASE' ? '原携铃者' : '成年旧纪念院看守洛克';
  if (id === 'death.s5.underworld-door') {
    if (!Number.isFinite(s.spirituality) || s.spirituality < 4) {
      return noEffect('短暂冥界门：灵性不足4，0效果、0消耗，不重抽、不透支');
    }
    s.spirituality -= 4;
    const chance = computeCheckChance({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 14, modifiers: [] });
    const succeeded = random.nextInt(1, 100) <= chance;
    // Opening, resisted local pull, stopping maintenance and full closure all
    // happen in this single paid action. No transported entity or persistent gate.
    return {
      ...noEffect(`短暂冥界门：已耗4灵性，意志难度14检定${chance}%，${succeeded
        ? `成功；本槽短暂开启有限冥界门，对2米内当前可见的${target}原身体站位作可抵抗牵引，对方优势−18×新门掌握（G）`
        : '失败或被抵抗，0效果；实付灵性不退回'}；当次实际行动内停止维持并完全关门。对方原身体和自己的原短棍仍在原现场、原持有关系不变，没有拖入冥界、放逐、即死或免费招灵；共同胜负与后果盘仍决定实际伤亡，不遗留持续牵引或序列4复活`),
      enemyReduction: succeeded ? 18 * mastery(s, id) : 0, threatens: succeeded,
    };
  }
  if (id === 'death.s5.inner-underworld') {
    if (!hasGatekeeperResidentSpirit(s)) {
      return noEffect('普通准备：当前原体内没有以新约定实际进入的同一原灰羽，本槽0效果、0灵性；旧单封信约定不授权参战，不远程召来、不复制或追加自主行动');
    }
    if (!Number.isFinite(s.spirituality) || s.spirituality < 3) {
      return noEffect('体内原灰羽短助：灵性不足3，0效果、0消耗，不派出原灵、不重抽或透支');
    }
    s.spirituality -= 3;
    const p = s.gatekeeper.companion;
    p.status = 'DEPLOYED'; p.deployments += 1;
    const reduction = 12 * mastery(s, id);
    p.status = 'INSIDE'; p.recalls += 1;
    return {
      ...noEffect(`体内原灰羽短助：已耗3灵性，以本次本人自愿的新约定让同一原灰羽从当前原体内小冥界实际短暂出动，有限协助牵制${target}，对方优势−12×体内冥界掌握（G）；在这一次实际行动结束前原灰羽实际返回同一原身体内，出动与召回各记1次。没有额外自主行动、挡死、免费逃生、取走原棍或搬运人物，也不自动借到其他灵体的能力`),
      enemyReduction: reduction, threatens: true,
    };
  }
  if (id === 'ACCIDENT') return { ...noEffect('判断失衡：本槽固定优势−22.5（G），不另抽正负、不追加行动'), selfGain: -22.5 };
  if (id === 'STRIKE' || id === 'SECONDARY_STRIKE') {
    const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
    const armed = s.town.clubLocation === 'HAND';
    return { ...noEffect(`${id === 'STRIKE' ? '普通主攻' : '普通次攻'}：${armed ? '使用自己持握的原普通短棍' : '使用自己的原身体'}打击（G），由共同胜负与伤势盘结算，不偷用对方原棍、不追加冥界门或原灵协助`),
      selfGain: (armed ? 16 : 12) * physical, threatens: physical > 0 };
  }
  if (id === 'EVADE') return {
    ...noEffect('普通避让：用当前原身体避让眼前打击，对方优势−10（G），不耗灵性、不额外检定、不保证免伤，不虚构冥界跳跃或复活'), enemyReduction: 10,
  };
  return noEffect('看门人行动：不是本阶段已实现的战斗动作，0效果、0消耗；不自动获得灵体能力库、高位恶灵、特殊戒指或序列4不死');
}

/** Terminal death releases the same actual resident here, beside the player's
 * actual dead body. OUTSIDE records no teleport home or additional action. */
export function releaseGatekeeperSpiritOnDeath(s: SliceState): string | null {
  if (!isGatekeeper(s) || s.health !== 0 || s.gatekeeper.companion.status !== 'INSIDE') return null;
  const p = s.gatekeeper.companion;
  p.status = 'OUTSIDE'; p.releases += 1;
  return '原体内实际短驻的同一原灰羽在当前战场离开玩家原尸体，离体记1次；它仍在这个实际现场，没有自动返回工作室、复活玩家或提供免费逃生，也没有新奖励。';
}
