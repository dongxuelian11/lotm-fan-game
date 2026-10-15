import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasCataclysmPriestDisputeOpponent } from './encounter.js';

/** Independent bounded S4 G profile. Original ordinary opponents use the shared ordinary resolver. */
export const CATACLYSM_PRIEST_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const cataclysmPriestActionCount = pyromaniacActionCount;
export type CataclysmPriestMoveId = 'tyrant.s4.sea-tornado' | 'tyrant.s6.wind-control' | 'EVADE' | 'tyrant.s4.great-lightning' | 'tyrant.s4.surge-control' | 'ACCIDENT';
const ABILITIES: readonly { id: CataclysmPriestMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'tyrant.s4.sea-tornado', label: '实际海水龙卷（H；5灵性/知识16；成功32×掌握G）', weight: 30, stance: 'ATTACK' },
  { id: 'tyrant.s6.wind-control', label: '继承有限控风（J；4灵性/意志16；成功减势18×旧掌握G）', weight: 15, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（B；0灵性、减势10G，无免费飞行）', weight: 20, stance: 'DEFEND' },
  { id: 'tyrant.s4.great-lightning', label: '有限强雷（K；6灵性/意志18；成功38×掌握G）', weight: 20, stance: 'CONTROL' },
  { id: 'tyrant.s4.surge-control', label: '实际海水涌浪（R；5灵性/意志16；成功26×掌握G）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const isCataclysmPriest = (s: SliceState): boolean => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function cataclysmPriestAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] { const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 })); }
export function drawCataclysmPriestAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): CataclysmPriestMoveId { const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0)); for (let i = 0; i < weights.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; } throw new Error('灾难主祭能力盘无效。'); }
export interface CataclysmPriestCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'CATACLYSM_PRIEST_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  enemyId: 'CP4-BENEDICT'; nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN'; weaponId: 'CP4-BENEDICT-CLUB'; weaponLocation: 'HAND';
  distanceMetres: 2; visible: true; waterSource: 'SEAWATER' | 'NONE'; space: 'ORIGINAL_EMPTY_STONE_QUAY'; exit: 'ORIGINAL_DRY_QUAY_EXIT'; pursuit: false;
}
export function currentCataclysmPriestCombatSource(s: SliceState): CataclysmPriestCombatSource | null {
  if (!hasCataclysmPriestDisputeOpponent(s)) return null; const e = s.cataclysmPriest.encounter;
  return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round, encounterId: 'CATACLYSM_PRIEST_DISPUTE', attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, enemyId: 'CP4-BENEDICT', nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN', weaponId: 'CP4-BENEDICT-CLUB', weaponLocation: 'HAND', distanceMetres: 2, visible: true, waterSource: e.waterSource, space: 'ORIGINAL_EMPTY_STONE_QUAY', exit: 'ORIGINAL_DRY_QUAY_EXIT', pursuit: false };
}
const validSource = (s: SliceState, source: CataclysmPriestCombatSource | null): boolean => { const now = currentCataclysmPriestCombatSource(s); return now !== null && source !== null && Object.entries(now).every(([key, value]) => (source as unknown as Record<string, unknown>)[key] === value); };
export interface CataclysmPriestRoundOutcome { enemyId: 'CP4-BENEDICT'; enemyHealth: number; enemyMind: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; waterSource: 'SEAWATER' | 'NONE'; windUses: number; waveUses: number; lightningUses: number }
export interface CataclysmPriestRoundContext { source: CataclysmPriestCombatSource; round: number; outcome: CataclysmPriestRoundOutcome }
export function beginCataclysmPriestCombatRound(s: SliceState): CataclysmPriestRoundContext { const source = currentCataclysmPriestCombatSource(s); if (!source) throw new Error('缺少原本尼迪克特、原短棍、实际空场或连续回合来源。'); const c = s.combat!; return { source, round: c.round, outcome: { enemyId: 'CP4-BENEDICT', enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, waterSource: source.waterSource, windUses: 0, waveUses: 0, lightningUses: 0 } }; }
export interface CataclysmPriestCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
const none = (label: string): CataclysmPriestCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
function mastery(s: SliceState, id: string): number { const n = s.progression.mastery[id] ?? 0; return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(n) ? n : 0)) / 500; }
function ordinaryStrike(s: SliceState, physical: number, reason: string): CataclysmPriestCombatEffect { const factor = Number.isFinite(physical) ? Math.max(0, Math.min(1, physical)) : 0; return { ...none(`${reason} 本槽只以${s.town.clubLocation === 'HAND' ? '自己实际持握的原短棍' : '自己的原身体'}普通打击，12/16×身体G；0灵性，无风、水或雷，不重抽。`), selfGain: (s.town.clubLocation === 'HAND' ? 16 : 12) * factor, threatens: factor > 0 }; }
export function resolveCataclysmPriestCombatAbility(s: SliceState, id: CataclysmPriestMoveId, physicalStateFactor: number, random: ActionRandomStream, ctx: CataclysmPriestRoundContext, source: CataclysmPriestCombatSource | null = ctx.source): CataclysmPriestCombatEffect {
  if (ctx.round !== s.combat?.round || !validSource(s, source)) return none('缺少当前原人、原棍或连续回合来源，0贡献、0消耗，不重抽，不把原场地替换成海岸。');
  if (!ABILITIES.some(a => a.id === id)) return none('这不是本阶段已实现动作，0贡献、0消耗。');
  if (id === 'ACCIDENT') return { ...none('判断失衡，本槽固定优势−22.5G，不另抽或增加行动。'), selfGain: -22.5 };
  if (id === 'EVADE') return { ...none('本人在原石码头普通避让，减势10G，0灵性；不是免费飞行、风墙或免伤。'), enemyReduction: 10 };
  const tornado = id === 'tyrant.s4.sea-tornado', wind = id === 'tyrant.s6.wind-control', lightning = id === 'tyrant.s4.great-lightning';
  const needsSea = tornado || id === 'tyrant.s4.surge-control', cost = wind ? 4 : lightning ? 6 : 5;
  if (needsSea && source!.waterSource !== 'SEAWATER') return tornado ? ordinaryStrike(s, physicalStateFactor, '当前原场没有实际海水，海水龙卷不能成立。') : none('当前原场没有实际海水，本槽只作普通观察，0贡献、0消耗；不从内陆造出涌浪、不重抽。');
  if (!Number.isFinite(s.spirituality) || s.spirituality < cost) return tornado ? ordinaryStrike(s, physicalStateFactor, '不足5灵性，不能形成海水龙卷。') : wind ? { ...none('不足4灵性，本槽改用原身体普通避让，减势10G、0灵性；不制造免费风防、不重抽。'), enemyReduction: 10 } : none(`不足${cost}灵性，本槽只作普通观察，0贡献、0消耗；无免费雷击或涌浪、不重抽。`);
  s.spirituality -= cost;
  const ability = tornado ? 'knowledge' : 'will', difficulty = lightning ? 18 : 16;
  const chance = computeCheckChance({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [] }), roll = random.nextInt(1, 100), success = roll <= chance;
  const name = tornado ? '原海水有限龙卷' : wind ? '继承有限控风' : lightning ? '有限强雷' : '原海水有限涌浪';
  if (!success) return none(`${name}已耗${cost}灵性，${ability === 'knowledge' ? '知识' : '意志'}${roll}>${chance}失败，0效果；成本保留，不补普通动作、不重抽、不留下持续效果。当前水源${source!.waterSource}。`);
  if (tornado || wind) ctx.outcome.windUses++; else if (lightning) ctx.outcome.lightningUses++; else ctx.outcome.waveUses++;
  const label = `${name}已耗${cost}灵性，${ability === 'knowledge' ? '知识' : '意志'}${roll}≤${chance}成功：` + (tornado ? '只卷起邻接原空水带的真实海水，对2米原敌尝试一次攻击，优势+32×掌握G。' : wind ? '以继承控风干扰眼前攻击，减势18×原控风掌握G。' : lightning ? '只对2米内当前可见原敌施一次强雷，优势+38×掌握G。' : '只推动邻接原空水带的真实海水形成一次有限涌浪，优势+26×掌握G。') + '有限作用当次结束、海水回落原水带；实际伤势仍由共同胜负与后果盘结算，不保证命中、投降或获胜，不豁免同伴与环境，不支配远方海域。';
  return { ...none(label), selfGain: wind ? 0 : (tornado ? 32 : lightning ? 38 : 26) * mastery(s, id), enemyReduction: wind ? 18 * mastery(s, id) : 0, threatens: !wind };
}
export function finishCataclysmPriestCombatRound(s: SliceState, ctx: CataclysmPriestRoundContext, _continues: boolean): string {
  const e = s.cataclysmPriest.encounter, c = s.combat!; e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus; if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'QUAY';
  Object.assign(ctx.outcome, { enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus });
  return '本轮有限风、水与雷均已结束，真实海水回落原水带；原身体伤势、原棍归属与实际消耗保留，不治疗、复活、返还灵性或跨轮维持免费效果。';
}
export function projectCataclysmPriestCombat(s: SliceState) { return { enemyName: '原48岁本尼迪克特·维尔', source: currentCataclysmPriestCombatSource(s), waterSource: s.cataclysmPriest.encounter.waterSource, summary: '4阶核心35/25/25/15、1250/底线125，灵性上限120、继续回合恢复12G，行动1–6。H海水龙卷5灵性/知识16；J继承控风4灵性/意志16；B普通避让0灵性；K强雷6灵性/意志18；R真实涌浪5灵性/意志16。H与R须真实海水；缺资源仅普通回退，检定失败成本照耗。原普通敌人与共同伤势、死亡、撤退规则不变。' }; }
