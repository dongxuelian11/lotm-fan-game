import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { RedPriestCommand, RedPriestProjection, RedPriestState } from './types.js';
import { createRedPriestState, startRedPriest, transitionRedPriest, sameRedPriest, redPriestDigest,
  openRedPriestOwnedEngine, snapshotRedPriestOwnedEngine, advanceRedPriestOwnedEngine, blockRedPriestOwnedEngine,
  getRedPriestPromotionStabilityPreview, getRedPriestEpilogueCheckPreview, type RedPriestOwnedEngine } from './engine.js';
import { redPriestBudget, redPriestHistoryDigest, redPriestAcquisitionSnapshot, redPriestSourceBlock, validateRedPriestSource } from './source.js';
import { RED_PRIEST_ABILITIES, RED_PRIEST_STORY, RED_PRIEST_GOAL, RED_PRIEST_RISK, RED_PRIEST_FORMULA, RED_PRIEST_CITY_PLACES, RED_PRIEST_PROMOTION_STABILITY } from './content.js';
import { validateRedPriestCampaignCommand, projectRedPriestCampaign, getRedPriestCampaignChallenge, deriveRedPriestCampaignAchievement,
  RED_PRIEST_HEADQUARTERS_REST, RED_PRIEST_SUPPLY_ONLY_CONVOY, RED_PRIEST_BATTLE_PLANNING, getRedPriestCampaignPlanPreview,
  type CampaignNodeId, type RedPriestBattleStance, type RedPriestCampaignState } from './campaign.js';
import { RED_PRIEST_CAMPAIGN_COALITION, RED_PRIEST_CAMPAIGN_NODES, RED_PRIEST_CAMPAIGN_ROUTES, RED_PRIEST_CAMPAIGN_POLITIES,
  RED_PRIEST_CAMPAIGN_LEGIONS, RED_PRIEST_CAMPAIGN_LIMITS } from './campaign-content.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { validateRedPriestMaterialCommand, projectRedPriestMaterials, type RedPriestMaterialCommand } from './materials.js';
import { RED_PRIEST_MATERIAL_COSTS, RED_PRIEST_MATERIAL_LOCATIONS } from './material-content.js';
import { validateRedPriestEpilogueCommand } from './epilogue.js';
import { HUNTER_ABILITIES } from '../hunter/content.js';
import { PROVOKER_ABILITIES } from '../provoker/content.js';
import { PYROMANIAC_ABILITIES } from '../pyromaniac/content.js';
import { CONSPIRATOR_ABILITIES } from '../conspirator/content.js';
import { REAPER_ABILITIES } from '../reaper/content.js';
import { IRON_BLOOD_KNIGHT_ABILITIES } from '../iron-blood-knight/content.js';
import { WAR_BISHOP_ABILITIES } from '../war-bishop/content.js';
import { WEATHER_WARLOCK_ABILITIES } from '../weather-warlock/content.js';
import { CONQUEROR_ABILITIES } from '../conqueror/content.js';
export { createRedPriestState } from './engine.js';
export { redPriestSourceView } from './source.js';
export type { RedPriestOwnedEngine } from './engine.js';
export type { RedPriestCommand, RedPriestState, RedPriestProjection } from './types.js';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: object, keys: string[]) => sameRedPriest(Object.keys(v).sort(), keys.sort());
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300 && v.trim() === v;
export function validateRedPriestCommand(v: unknown): v is RedPriestCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'WORK', 'REST', 'CLINIC', 'NEXT_WEEK', 'START_EPILOGUE', 'START_PREPARED_EPILOGUE', 'RETURN_ON_FOOT'].includes(String(v.type))) return exact(v, ['type']);
  if (v.type === 'TRAVEL') return exact(v, ['type', 'to']) && id(v.to) &&
    (RED_PRIEST_CITY_PLACES.some(p => p.id === v.to) || RED_PRIEST_CAMPAIGN_NODES.some(n => n.id === v.to));
  if (v.type === 'STABILIZE_PROMOTION') return exact(v, ['type', 'compoundId']) && id(v.compoundId);
  if (v.type === 'CONSUME') return exact(v, ['type', 'compoundId', 'confirmed']) && id(v.compoundId) && v.confirmed === true;
  if (!exact(v, ['type', 'command'])) return false;
  return v.type === 'CAMPAIGN' ? validateRedPriestCampaignCommand(v.command) : v.type === 'MATERIAL' ? validateRedPriestMaterialCommand(v.command)
    : v.type === 'EPILOGUE' ? validateRedPriestEpilogueCommand(v.command) : false;
}
function assertCurrent(s: SliceState, root: RedPriestState): void {
  const source = root.source!, frame = root.frame!;
  if (!source || !frame || s.progression.pathwayId !== 'hunter' || !sameRedPriest(redPriestBudget(s), frame.budget) || !sameRedPriest(s.random, frame.random)) throw Error('当前身体、资源与原动作记录不一致。');
  if (s.revision !== source.revision + 1 + root.journal.length || root.journal.some((e, i) => e.revision !== source.revision + 2 + i)) throw Error('当前动作次序不一致。');
  const { coreStats: _current, ...identity } = s.character, { coreStats: _source, ...originalIdentity } = source.character;
  if (!sameRedPriest(identity, originalIdentity) || Object.entries(frame.finance).some(([key, value]) => !sameRedPriest(s[key as keyof SliceState], value))) throw Error('当前身份或实际生活账本不一致。');
  if (source.historyDigest !== redPriestHistoryDigest(s) || source.originalWorldDigest !== redPriestDigest(s.world) ||
    s.combatHistory.length !== source.combatHistoryLength || source.combatHistoryDigest !== redPriestDigest(s.combatHistory) ||
    !sameRedPriest(source.acquisition, redPriestAcquisitionSnapshot(s))) throw Error('旧同伴、原战争或原瓶履历被改写。');
  if (s.combat !== null || s.activeEvent !== null || s.eventQueue.length !== 0 || s.pulse !== 'NONE') throw Error('本章不能同时开启旧现场。');
  if ((frame.budget.sequence === 0) !== (root.promotionWeek !== null)) throw Error('当前晋升与实际服药记录不一致。');
}
function guidanceBlock(s: SliceState): string | null {
  if (!sameRedPriest(s.redPriest, createRedPriestState())) return '已有本章记录，不能重新开始或补发原物。';
  return redPriestSourceBlock(s);
}
function publicReason(reason: string | null): string | null {
  if (reason === null) return null;
  if (/[\u3400-\u9fff]/.test(reason) && !/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)) return reason;
  if (/LATER_WEEK|NEXT_WEEK/.test(reason)) return '需要真实经过一周，原花费与调查结果保留。';
  if (/RESOURCES|INSUFFICIENT/.test(reason)) return '实际行动、费用或灵性不足，可先工作与休养。';
  if (/LOCATION|AT_LOCATION/.test(reason)) return '须先沿普通道路亲自到达原件所在地点。';
  if (/UNAVAILABLE|NOT_ACTIVE|BLOCKED/.test(reason)) return '原件已无法按当前保管线继续取得，原后果保留。';
  return '请先核对原件、实际所在地和前一步准备。';
}
export function validateRedPriestState(s: SliceState): boolean {
  try {
    if (sameRedPriest(s.redPriest, createRedPriestState())) return s.progression.pathwayId !== 'hunter' || s.progression.sequence !== 0;
    const head = openRedPriestOwnedEngine(s); assertCurrent(s, snapshotRedPriestOwnedEngine(head)); return true;
  } catch { return false; }
}
export function hasRedPriestHistory(s: SliceState): boolean {
  try { return s.redPriest.guidanceKnown && s.redPriest.source !== null && s.progression.pathwayId === 'hunter' && validateRedPriestSource(s, s.redPriest.source); } catch { return false; }
}
export function hasRedPriestLock(s: SliceState): boolean { return hasRedPriestHistory(s); }
export function openRedPriestOwnedHead(s: SliceState): RedPriestOwnedEngine {
  const head = openRedPriestOwnedEngine(s); assertCurrent(s, snapshotRedPriestOwnedEngine(head)); return head;
}
export function assertOwnedRedPriestCurrent(s: SliceState, head: RedPriestOwnedEngine): void {
  const root = snapshotRedPriestOwnedEngine(head);
  if (!sameRedPriest(root, s.redPriest)) throw Error('当前会话与实际存档版本不一致。');
  assertCurrent(s, root);
}
export function redPriestCommandBlock(s: SliceState, command: RedPriestCommand): string | null {
  if (!validateRedPriestCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return guidanceBlock(s);
  try { return publicReason(blockRedPriestOwnedEngine(openRedPriestOwnedHead(s), command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
export function ownedRedPriestCommandBlock(s: SliceState, command: RedPriestCommand, head: RedPriestOwnedEngine): string | null {
  if (!validateRedPriestCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return '已有本章记录，不能重新开始或补发原物。';
  try { assertOwnedRedPriestCurrent(s, head); return publicReason(blockRedPriestOwnedEngine(head, command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
function publish(s: SliceState, command: RedPriestCommand, root: RedPriestState, ctx: SeerContext): void {
  const b = root.frame!.budget; s.redPriest = root;
  s.week = b.week; s.date = clone(b.date); s.actionsRemaining = b.actions; s.cash = b.cash; s.health = b.health;
  s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status; s.injuries = clone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting; s.progression.mastery = { ...b.mastery }; s.character.coreStats = { ...b.coreStats };
  s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources]; s.random = { ...root.frame!.random };
  Object.assign(s, clone(root.frame!.finance));
  const event = command.type === 'LEARN_GUIDANCE' ? null : root.journal.at(-1)!;
  s.lastCheck = event?.randomReceipts.length ? clone(event.randomReceipts.at(-1)!.check) : null;
  if (!event) ctx.note('北大陆战争筹备', '已核对原活身份、三份特性和原军团历史；旧互助成员留在原来的生活中。伤势、个人欠款和全部资源继续保留。');
  else {
    for (const receipt of event.financeReceipts) ctx.note(receipt.title, receipt.text);
    ctx.note(b.sequence === 0 ? '红祭司当前行动' : '北大陆当前行动', event.notes.join('') || `健康${b.health}，精神${b.mind}，灵性${b.spirituality}；现款${b.cash}便士。`);
  }
}
const clone = <T>(v: T): T => structuredClone(v);
export function applyRedPriestCommand(s: SliceState, command: RedPriestCommand, ctx: SeerContext): void {
  if (!validateRedPriestCommand(command) || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  let root: RedPriestState;
  if (command.type === 'LEARN_GUIDANCE') { const reason = guidanceBlock(s); if (reason) throw Error(reason); root = startRedPriest(s); }
  else { const head = openRedPriestOwnedHead(s); root = snapshotRedPriestOwnedEngine(advanceRedPriestOwnedEngine(head, command, s.revision + 1)); }
  publish(s, command, root, ctx);
}
export function applyOwnedRedPriestCommand(s: SliceState, command: RedPriestCommand, ctx: SeerContext, head: RedPriestOwnedEngine): RedPriestOwnedEngine {
  assertOwnedRedPriestCurrent(s, head);
  if (!validateRedPriestCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  const next = advanceRedPriestOwnedEngine(head, command, s.revision + 1); publish(s, command, snapshotRedPriestOwnedEngine(next), ctx); return next;
}
const inherited = [...HUNTER_ABILITIES, ...PROVOKER_ABILITIES, ...PYROMANIAC_ABILITIES, ...CONSPIRATOR_ABILITIES, ...REAPER_ABILITIES,
  ...IRON_BLOOD_KNIGHT_ABILITIES, ...WAR_BISHOP_ABILITIES, ...WEATHER_WARLOCK_ABILITIES, ...CONQUEROR_ABILITIES];
const placeName = (place: string) => RED_PRIEST_CITY_PLACES.find(p => p.id === place)?.title ?? RED_PRIEST_CAMPAIGN_NODES.find(n => n.id === place)?.name ?? '原现场';
/** Derived, already visible readiness only: never rolls, seeds or future outcomes. */
export function redPriestCampaignReadiness(campaign: RedPriestCampaignState, will: number): string[] {
  if (campaign.planning) return plannedCampaignReadiness(campaign, will);
  const limits = RED_PRIEST_CAMPAIGN_LIMITS;
  const armies = RED_PRIEST_CAMPAIGN_LEGIONS.filter(l => l.role === 'FIELD').map(l => campaign.legions[l.id]);
  const personnel = armies.reduce((n, l) => n + l.personnel, 0);
  const losses = armies.reduce((n, l) => n + Math.min(l.personnel, limits.defeatLoss), 0);
  const remaining = Math.max(0, limits.independentVictories - deriveRedPriestCampaignAchievement(campaign).independentVictories.length);
  const minimumForRemaining = remaining === 0 ? 0 : limits.minimumArmyPersonnel + (remaining - 1) * armies.length * limits.victoryLoss;
  const reserves = RED_PRIEST_CAMPAIGN_COALITION.reduce((n, id) => n + campaign.polities[id].reservePersonnel, 0);
  const lines = [`现有原军${personnel}人；每次开战至少${limits.minimumArmyPersonnel}人，各军士气至少${limits.minimumLegionMorale}。`,
    `每次败仗最多损失${losses}现员并降低各军36士气；死者和伤员不能靠休整返还。每胜仍会损失各军至多${limits.victoryLoss}现员。`,
    `还需${remaining}处独立胜利；后备兵员剩${reserves}。不再补兵且之后全部获胜时，完成剩余目标至少需现有${minimumForRemaining}人。`];
  if (remaining > 0 && reserves === 0 && personnel < minimumForRemaining)
    lines.push('现有人员已经不足以完成剩余目标。继续交战不能补回损失，可以真实停战或保护撤离。');
  else if (remaining > 0 && reserves === 0 && personnel - losses < minimumForRemaining)
    lines.push('再败一次将不足以完成剩余目标。请结合实际胜率决定是否继续，休整不会补兵。');
  const node = RED_PRIEST_CAMPAIGN_NODES.find(n => n.id === campaign.location);
  if (node && campaign.nodes[node.id].victory === null && campaign.nodes[node.id].controller === 'feysac') {
    const challenge = getRedPriestCampaignChallenge(campaign, { type: 'BATTLE', nodeId: node.id })!;
    const chance = computeCheckChance({ ability: 'will', baseAbility: will, difficulty: challenge.difficulty, modifiers: [] });
    lines.push(`若当前出战条件满足，${node.name}的本次会战成功率为${chance}%。现有意志与实际兵员缺口决定此检定；额外等待不会重抽或保证成功。`);
  }
  return lines;
}
const stanceName = (stance: 'STANDARD' | 'COORDINATED' | 'PROTECTIVE') =>
  stance === 'COORDINATED' ? '三军协同' : stance === 'PROTECTIVE' ? '保护性准备' : '常规';
/** Compare a proposed choice using current visible facts, without paying, simulating time or drawing a roll. */
export function redPriestBattlePlanSelectionCost(campaign: RedPriestCampaignState, will: number, nodeId: CampaignNodeId,
  stance: RedPriestBattleStance, extraSupplies: boolean): string {
  const rules = RED_PRIEST_BATTLE_PLANNING, current = getRedPriestCampaignPlanPreview(campaign, nodeId);
  const challenge = getRedPriestCampaignChallenge(campaign, { type: 'PREPARED_BATTLE', nodeId })!;
  const bonus = (current.reconEffective ? rules.recon.effectiveBonus : 0) + (extraSupplies ? rules.extraSupplies.effectiveBonus : 0)
    + (stance === 'PROTECTIVE' ? rules.protective.effectiveBonus : stance === 'COORDINATED' && current.coordinatedEligible ? rules.coordinated.effectiveBonus : 0);
  const chance = computeCheckChance({ ability: 'will', baseAbility: will, difficulty: challenge.difficulty,
    modifiers: bonus === 0 ? [] : [{ source: '拟选筹备的当前条件估计', value: bonus }] });
  const cost = stance === 'PROTECTIVE' ? '1行动、实际1周；各原国库60，另结正常维持与个人生活账；本次加18'
    : stance === 'COORDINATED' ? '不花行动、时间或费用；三支原军各需至少1000人、60士气才加20' : '不花行动、时间或费用；无战术加值';
  return `${cost}${extraSupplies ? '；会战时每军另扣6补给、加12' : '；无额外作战补给'}。按当前兵员与已有效侦察估计${chance}%；跨周或实际条件改变后重算；须满足资源条件。`;
}
/** Selection is one-shot. Future fights in this estimate explicitly assume ordinary losses. */
function plannedCampaignReadiness(campaign: RedPriestCampaignState, will: number): string[] {
  const limits = RED_PRIEST_CAMPAIGN_LIMITS;
  const armies = RED_PRIEST_CAMPAIGN_LEGIONS.filter(l => l.role === 'FIELD').map(l => campaign.legions[l.id]);
  const personnel = armies.reduce((n, l) => n + l.personnel, 0);
  const remaining = Math.max(0, limits.independentVictories - deriveRedPriestCampaignAchievement(campaign).independentVictories.length);
  const reserves = RED_PRIEST_CAMPAIGN_COALITION.reduce((n, polity) => n + campaign.polities[polity].reservePersonnel, 0);
  const node = RED_PRIEST_CAMPAIGN_NODES.find(n => n.id === campaign.location);
  const preview = node ? getRedPriestCampaignPlanPreview(campaign, node.id) : null;
  const victoryLoss = preview?.hasSelection ? preview.victoryLossPerArmy : limits.victoryLoss;
  const defeatLoss = preview?.hasSelection ? preview.defeatLossPerArmy : limits.defeatLoss;
  const losses = armies.reduce((n, l) => n + Math.min(l.personnel, defeatLoss), 0);
  const minimum = remaining === 0 ? 0 : limits.minimumArmyPersonnel + Math.max(0, remaining - 2) * armies.length * limits.victoryLoss
    + (remaining > 1 ? armies.length * victoryLoss : 0);
  const lines = [`现有原军${personnel}人；开战至少${limits.minimumArmyPersonnel}人，各军士气至少${limits.minimumLegionMorale}。三军协同另需每支原军至少1000人、60士气。`,
    `${preview?.hasSelection ? `当前已选${stanceName(preview.stance)}` : '尚未选定本次方案，以下暂按常规估算'}：胜利每军至多损失${victoryLoss}现员；失败每军至多损失${defeatLoss}现员，当前合计至多${losses}人，并降低各军36士气。死伤不会靠休整返还。`,
    `还需${remaining}处独立胜利；后备兵员剩${reserves}。假设本次采用上述方案、之后各战采用常规且全部获胜，不补兵、不计断粮等额外损耗，进入最后一战所需起始现员至少${minimum}人；这是条件估算，不是完成保证。`];
  if (remaining > 0 && personnel < minimum) lines.push('现员低于上述条件估算；请先核对有限后备、保护性准备和后续补给。休整只恢复士气。');
  if (node && campaign.nodes[node.id].victory === null && campaign.nodes[node.id].controller === 'feysac') {
    const challenge = getRedPriestCampaignChallenge(campaign, { type: 'PREPARED_BATTLE', nodeId: node.id })!;
    const bonus = challenge.effectiveBonus ?? 0;
    const chance = computeCheckChance({ ability: 'will', baseAbility: will, difficulty: challenge.difficulty,
      modifiers: bonus === 0 ? [] : [{ source: '当前有效战争筹备', value: bonus }] });
    lines.push(`${node.name}当前方案成功率${chance}%；基础意志${will}，实际筹备加值${bonus}，难度${challenge.difficulty}。${preview?.hasSelection ? '仅在实际出战条件满足时可执行。' : '尚未选定方案，不能执行筹备会战。'}失败仍会发生；等待不会重抽或保证成功。`);
  }
  return lines;
}
/** Public chance wording is derived from the same paid preparation check as the engine.
 * A prospective value never grants the bonus or predicts a random result. */
export function redPriestPromotionStabilityReadiness(preview: ReturnType<typeof getRedPriestPromotionStabilityPreview>): string[] {
  const cost = preview.cost;
  const lines = [`这份原成药当前服用成功率${preview.currentChance}%；${preview.prepared ? `已生效稳定加值${preview.effectiveBonus}，仅用于此份原成药的下一次服用` : '尚无已生效的战后稳定加值'}。失败仍可能重伤、增加污染或死亡。`];
  if (preview.prepared) lines.push('本次稳定准备已经实际支付，只绑定这一份原成药。成功或失败都会用尽本次准备，不能叠加、转给另一份或再次沿用。');
  else {
    lines.push(`若真实见证、原件、地点与资源条件均满足，并支付${cost.cash}便士、${cost.actions}行动、${cost.spirituality}灵性、${cost.mind}精神，实际经过${cost.weeks}周完成稳定准备，取得仅本瓶一次的稳定加值${RED_PRIEST_PROMOTION_STABILITY.effectiveBonus}，按当前意志估计服用成功率${preview.stabilizedChance}%；这是有条件的准备后估计，当前仍为${preview.currentChance}%。`);
    lines.push('跨周照常结算生活费与旧还款，不自动恢复身体或返还过去失败的费用；也可以继续普通工作、休养，或自行决定承担未准备的服药风险。');
    if (preview.reason) lines.push(`当前不能准备：${preview.reason}`);
  }
  if (preview.witnesses.length > 0) lines.push(`已核实原战争独立胜利${preview.victoryCount}处；原受托见证：${preview.witnesses.map(w => `${w.name}的${w.legionName}（现员${w.personnel}）`).join('、')}。见证只据原委托、实际战果与原军团记录。`);
  return lines;
}
export function redPriestEpilogueStory(ep: Pick<NonNullable<RedPriestState['epilogue']>, 'patients' | 'status' | 'reported'>): string {
  const evacuated = ep.patients.filter(p => p.status === 'EVACUATED').length;
  const sheltered = ep.patients.filter(p => p.status === 'SHELTERED').length;
  const account = ep.reported ? '救援人数和原分队损失已经交接。'
    : ep.status === 'ACTIVE' ? '原分队仍受疲劳、伤势和现场抵抗限制。'
      : '救援已经收束，实际人数和原分队损失尚待交接。';
  return `停战后的原运输侧线起火；已转运原伤员${evacuated}名，${sheltered}名仍留在有遮蔽的原救护站。${account}`;
}
export function projectRedPriest(s: SliceState): RedPriestProjection {
  if (sameRedPriest(s.redPriest, createRedPriestState())) return projection(s, null);
  return projectOwnedRedPriest(s, openRedPriestOwnedHead(s));
}
export function projectOwnedRedPriest(s: SliceState, head: RedPriestOwnedEngine): RedPriestProjection { assertOwnedRedPriestCurrent(s, head); return clone(projection(s, head)); }
function projection(s: SliceState, owned: RedPriestOwnedEngine | null): RedPriestProjection {
  const result: RedPriestProjection = { title: '红祭司晋升筹备', guidanceKnown: false, promoted: false,
    story: RED_PRIEST_STORY, nextStep: RED_PRIEST_GOAL, risk: RED_PRIEST_RISK,
    resources: { health: s.health, mind: s.mind, spirituality: s.spirituality, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining },
    abilities: [], actions: [], sections: [], insideCase: false };
  if (s.progression.pathwayId === 'hunter') result.abilities = inherited.filter(a => Object.hasOwn(s.progression.mastery, a.id))
    .map(a => ({ id: a.id, label: a.label, description: a.description, mastery: s.progression.mastery[a.id]! }));
  if (!owned) {
    const reason = guidanceBlock(s); result.actions.push({ id: 'red-priest-guidance', label: '核对大陆战争与原材料', cost: '不花行动与费用',
      enabled: reason === null, reason, command: { type: 'LEARN_GUIDANCE' }, preferredAction: true });
    result.sections.push({ id: 'requirements', title: '成神所需', lines: [...RED_PRIEST_FORMULA.map(i => `${i.name}：${i.quantity}${i.unit}。`), '亲自发动真实北大陆战争；五处独立胜利、三大战区控制与实际停战共同证明经历。'] });
    return result;
  }
  const root = snapshotRedPriestOwnedEngine(owned), f = root.frame!, b = f.budget, campaign = projectRedPriestCampaign(root.campaign!), materials = projectRedPriestMaterials(root.materials!);
  result.guidanceKnown = true; result.promoted = b.sequence === 0; result.title = b.sequence === 0 ? '红祭司 · 战争之后' : '红祭司 · 北大陆战争';
  result.insideCase = !RED_PRIEST_CITY_PLACES.some(p => p.id === f.location) || root.epilogue?.status === 'ACTIVE';
  if (b.sequence === 0) result.abilities.push(...RED_PRIEST_ABILITIES.map(a => ({ ...a, mastery: b.mastery[a.id] ?? 0 })));
  const add = (command: RedPriestCommand, label: string, cost: string, preferred = false): void => {
    const reason = s.status !== 'ACTIVE' ? '已经死亡的角色不能继续行动。' : publicReason(blockRedPriestOwnedEngine(owned, command, s.revision + 1));
    result.actions.push({ id: `red-priest-action-${result.actions.length + 1}`, command, label, cost, enabled: reason === null, reason,
      ...(preferred && reason === null && !result.actions.some(a => a.preferredAction) ? { preferredAction: true } : {}) });
  };
  const travel = (to: string, preferred = false) => add({ type: 'TRAVEL', to }, `前往${placeName(to)}`, RED_PRIEST_CITY_PLACES.some(p => p.id === f.location) && RED_PRIEST_CITY_PLACES.some(p => p.id === to) ? '1行动、10便士；普通城市道路1小时' : '1行动；沿已行经大陆路线逐周结算旅费、生活费与旧还款', preferred);
  result.sections.push({ id: 'campaign-status', title: '当前战区与目标', lines: [`本人在${placeName(f.location)}；原军团在${campaign.locationName}。`, campaign.nextStep,
    `独立胜利${campaign.achievement.victories}/5；交战战区${campaign.achievement.engagedTheaters}/3；受控战区${campaign.achievement.controlledTheaters}/3。`,
    ...campaign.theaters.map(t => `${t.name}：${t.geography}；${t.engaged ? '实际发生交战' : '尚未交战'}，${t.controlled ? '已控制运输目标' : '运输目标尚未控制'}。`) ] });
  result.sections.push({ id: 'campaign-losses', title: '原军团与战争损失', lines: [
    ...campaign.legions.filter(l => l.role === 'FIELD').map(l => `${l.name}：现员${l.personnel}，阵亡${l.killed}，伤员${l.wounded}，补给${l.supply}，士气${l.morale}。`),
    ...campaign.polities.map(p => `${p.name}：国库${p.treasury}；动员${p.mobilizedPersonnel}人，迁离${p.displacedResidents}人，已疏散${p.evacuatedResidents}人，居民死亡${p.civilianDeaths}人。`) ] });
  result.sections.push({ id: 'materials', title: '三份原特性与唯一性', lines: [materials.rule, ...materials.items.map(i => `${i.title}：${i.status}${i.locationId ? `，${placeName(i.locationId)}` : ''}。`)] });
  const debt = f.finance.debts.reduce((n, d) => n + d.remaining, 0);
  result.sections.push({ id: 'finance', title: '个人生活与旧账', lines: [`现款${b.cash}便士；未付本金${debt}便士；下次约定还款${f.finance.debts.reduce((n, d) => n + Math.min(d.remaining, d.weeklyPayment), 0)}便士。`,
    '每次真实跨周继续支付生活费及旧约还款；不足的生活费如实计欠，次周采用赤贫生活。军团国库不属于个人。',
    `当前伤势${b.injuries.length}份；重伤先以60便士普通处置，再经之后休养达到80健康。`] });
  if (b.sequence === 1 && ['ORDERED', 'WAR'].includes(root.campaign!.phase))
    result.sections.push({ id: 'campaign-readiness', title: '胜算与有限兵员', lines: redPriestCampaignReadiness(root.campaign!, b.coreStats.will) });
  if (root.epilogue) {
    const ep = root.epilogue; result.story = redPriestEpilogueStory(ep);
    result.nextStep = ep.status === 'ACTIVE' ? '决定有限协同、现场控火与实际搬运，也可以沿原安全侧线撤出。' : ep.reported ? '战后救援已经交接，原战争与身体后果继续保留。' : '将实际救援与分队损失交回原军团。';
    result.sections.unshift({ id: 'epilogue', title: '原运输路救援', lines: [`火势${ep.fire}；运输路损坏${ep.routeDamage}；已转运伤员${ep.patients.filter(p => p.status === 'EVACUATED').length}/3。`,
      `原六人分队：阵亡${ep.killed}，受伤${ep.wounded}，已返队${ep.returned}；救出伤员没有被自动治愈。`, ep.journal.at(-1)?.summary ?? '本人已经实际抵达这处原火场。'] });
    if (ep.status === 'ACTIVE') {
      add({ type: 'EPILOGUE', command: { type: 'COORDINATE' } }, '以同袍战旌协同原分队', '1行动、8灵性、8精神；仅本次六人', true);
      add({ type: 'EPILOGUE', command: { type: 'CONTAIN_FIRE' } }, '以赤焰界限控制原火势', '1行动、12灵性、10精神；本火场仅一次', true);
      add({ type: 'EPILOGUE', command: { type: 'EVACUATE' } }, '沿实际侧线搬运伤员', '1行动；抵抗与伤亡照实结算', true);
      add({ type: 'EPILOGUE', command: { type: 'WITHDRAW' } }, '沿原安全侧线撤出', '0行动；保留未完成救援与全部后果');
      if (ep.rulesVersion === 2) {
        const checks = [
          ['COORDINATE', '同袍战旌'], ['CONTAIN_FIRE', '赤焰界限'], ['EVACUATE', '普通搬运'],
        ] as const;
        result.sections.push({ id: 'epilogue-readiness', title: '本次有限救援的胜算', lines: [
          ...checks.flatMap(([type, label]) => {
            const check = getRedPriestEpilogueCheckPreview(root, type);
            return check ? [`${label}当前成功率${check.chance}%，实际有效加值${check.effectiveBonus}，难度${check.difficulty}；须满足本项资源与现场条件，失败仍会造成伤亡。`] : [];
          }),
          `当前只剩${b.actions}行动；每次协同、控火或搬运均实耗1行动。可以选择一次技巧后搬运，或普通搬运；不必把两种技巧都用完。`,
          '行动不足或风险过高时仍可零行动沿原安全侧线撤出；尚未转运者留在原遮蔽救护站，原伤势与损失保留。',
        ] });
      }
      return result;
    }
    if (!ep.reported) add({ type: 'EPILOGUE', command: { type: 'REPORT' } }, '交接救援与分队损失', '不花行动与费用', true);
  }
  if (b.sequence === 0 && !root.epilogue) {
    result.nextStep = '沿原大陆运输路返回停战后的原军团驻地，参与一宗有限战后救援。';
    if (f.location === root.campaign!.location) add({ type: 'START_EPILOGUE' }, '到原运输路参加救援', '1行动；原军团实派六人、消耗2补给', true);
    else if (RED_PRIEST_CITY_PLACES.some(p => p.id === f.location)) travel(root.campaign!.location, true);
  }
  if (b.sequence === 1 && root.materials!.status === 'ACTIVE') {
    for (const item of root.materials!.items) {
      let c: RedPriestMaterialCommand | null = null, target = item.locationId, label = '';
      if (item.disposition === 'UNLOCATED' || item.disposition === 'SUPPLIER_BOTTLED') { c = { type: 'TRACE_DISPOSITION', itemId: item.id }; target = RED_PRIEST_MATERIAL_LOCATIONS.archive; label = '查原瓶处置与保管记录'; }
      else if (item.disposition === 'LOCATED_DIRTY' || item.disposition === 'LOCATED_SEALED') { c = { type: 'VERIFY_CONTAINER', itemId: item.id }; label = '亲自核验原封容器'; }
      else if (item.disposition === 'VERIFIED_DIRTY') { c = { type: 'PURIFY_REMAINS', itemId: item.id }; label = '净化已核验原残余'; }
      else if (item.disposition === 'CLEAN_SEALED') { c = { type: 'TRANSFER_CUSTODY', itemId: item.id }; label = '完成原件保管交接'; }
      else if (item.disposition === 'SEALED_RELIC') { c = { type: 'INSPECT_RELIC' }; target = RED_PRIEST_MATERIAL_LOCATIONS.relicArchive; label = '调查独立遗物的保管链'; }
      else if (item.disposition === 'INSPECTED_RELIC') { c = { type: 'VERIFY_RELIC' }; label = '亲赴原库核验唯一性'; }
      else if (item.disposition === 'VERIFIED_RELIC') { c = { type: 'TRANSFER_RELIC' }; label = '完成唯一性原件交接'; }
      if (c && target) {
        if (f.location !== target) { if (!result.actions.some(a => a.command.type === 'TRAVEL' && a.command.to === target)) travel(target, true); }
        else { const cost = RED_PRIEST_MATERIAL_COSTS[c.type]; add({ type: 'MATERIAL', command: c }, label, `${cost.actions}行动、${cost.cash}便士、${cost.spirituality}灵性；1小时`, true); }
      }
    }
    const ready = root.materials!.items.filter(i => i.disposition === 'PLAYER_HELD').length === 3;
    if (ready) {
      if (f.location !== RED_PRIEST_MATERIAL_LOCATIONS.workshop) travel(RED_PRIEST_MATERIAL_LOCATIONS.workshop, true);
      else add({ type: 'MATERIAL', command: { type: 'PREPARE_COMPOUND' } }, '用同批原件调配成药', '1行动、120便士、8灵性；消耗有限实际辅料', true);
    }
    for (const compound of root.materials!.compounds.filter(c => c.status === 'PREPARED'))
      add({ type: 'CONSUME', compoundId: compound.id, confirmed: true }, '确认风险并饮下原成药', '1行动、30灵性；失败可能重伤、污染或死亡', true);
    result.nextStep = campaign.achievement.achieved && campaign.achievement.ceased ? '将两份外在原特性与唯一性带回调配室；恢复实际伤势后再决定服药。' : campaign.nextStep;
    if (f.location !== root.campaign!.location && RED_PRIEST_CITY_PLACES.some(p => p.id === f.location)) travel('loen-headquarters');
    if (f.location === root.campaign!.location) {
      if (root.campaign!.phase === 'CRISIS') {
        for (const polityId of RED_PRIEST_CAMPAIGN_COALITION) if (root.campaign!.polities[polityId].authority !== 'GRANTED')
          add({ type: 'CAMPAIGN', command: { type: 'REQUEST_AUTHORITY', polityId } }, `与${RED_PRIEST_CAMPAIGN_POLITIES.find(p => p.id === polityId)!.name}协商实际委托`, '1行动、60便士；实际1周', true);
        add({ type: 'CAMPAIGN', command: { type: 'DECLARE_OFFENSIVE' } }, '签发大陆战争发动命令', '1行动、80便士；实际1周，原各国实付动员', true);
      }
      if (root.campaign!.phase === 'ORDERED' || root.campaign!.phase === 'WAR') {
        const node = RED_PRIEST_CAMPAIGN_NODES.find(n => n.id === f.location);
        if (node) {
          if (!root.campaign!.planning) {
            add({ type: 'CAMPAIGN', command: { type: 'BATTLE', nodeId: node.id } }, `在${node.name}执行会战`, '1行动、40便士、6灵性；实际1周，真实军团伤亡', true);
          } else if (root.campaign!.nodes[node.id].victory === null && root.campaign!.nodes[node.id].controller === 'feysac') {
            const plan = getRedPriestCampaignPlanPreview(root.campaign!, node.id);
            const originalArmies = RED_PRIEST_CAMPAIGN_LEGIONS.filter(l => l.role === 'FIELD').map(l => root.campaign!.legions[l.id]);
            result.sections.push({ id: 'campaign-planning', title: '本次会战筹备', lines: [
              plan.hasSelection ? `已生效方案：${stanceName(plan.stance)}；${plan.extraSupplies ? '会战时额外投入每军6补给' : '不额外投入补给'}。方案仅用于本次交战，打完不会自动沿用。` : '尚未选定本次方案。先核对敌军与代价，再选择战术并提交；不会自动出战。',
              plan.reconEffective ? '本次侦察仍对应当前守军：实际检定加值8，只用于该守军的下一次交战。' : '当前没有适用于本次守军的侦察。实地侦察需1行动、1周，每国库120与每军1补给，另结正常维持。',
              '常规没有战术加值；三军协同在三支原军均至少1000人、60士气时加20；保护性准备实际支付1行动、1周与各国库60，生效后加18。额外补给在交战时每军再付6，实际加12。',
              `当前方案直接作战补给每军${plan.battleSupplyPerArmy}，另付每周${RED_PRIEST_CAMPAIGN_LIMITS.weeklySupply}维持；胜／败迁离居民至多${plan.victoryDisplaced}／${plan.defeatDisplaced}人。`,
              ...originalArmies.map(l => {
                const cfg = RED_PRIEST_CAMPAIGN_LEGIONS.find(x => x.id === l.id)!;
                const deployed = Object.values(root.campaign!.legions).filter(x => x.polityId === l.polityId && x.mobilized && !x.retreated && x.personnel > 0).length;
                return `${cfg.name}现有补给${l.supply}，付本次作战与首周维持后${l.supply - plan.battleSupplyPerArmy - RED_PRIEST_CAMPAIGN_LIMITS.weeklySupply}；本国现库${root.campaign!.polities[l.polityId].treasury}，首周现有军费${deployed * RED_PRIEST_CAMPAIGN_LIMITS.weeklyTreasury}。`;
              }),
              `本人会战需1行动、40便士、6灵性；直接扣费后现款${b.cash - 40}便士、灵性${b.spirituality - 6}。另计实际跨周生活费和旧还款；败退可能多走数周并继续损耗。负数表示当前不足，须先补足。`,
            ] });
            result.nextStep = plan.hasSelection ? '核对已生效方案的实际胜率、补给和伤亡，再决定是否执行本次会战。' : '先侦察或选定本次战术。每项准备按实际代价结算，选好后才可决定出战。';
            add({ type: 'CAMPAIGN', command: { type: 'RECONNOITRE', nodeId: node.id } }, `侦察${node.name}当前守军`,
              '1行动、实际1周；每国库120、每军1补给，另结正常军费、补给与个人生活账；有效侦察加8', !plan.reconEffective);
            for (const stance of ['STANDARD', 'COORDINATED', 'PROTECTIVE'] as const) for (const extraSupplies of [false, true]) {
              add({ type: 'CAMPAIGN', command: { type: 'SELECT_BATTLE_PLAN', nodeId: node.id, stance, extraSupplies } },
                `采用${stanceName(stance)}${extraSupplies ? '并额外投入补给' : '方案'}`,
                redPriestBattlePlanSelectionCost(root.campaign!, b.coreStats.will, node.id, stance, extraSupplies));
            }
            add({ type: 'CAMPAIGN', command: { type: 'PREPARED_BATTLE', nodeId: node.id } }, `按已选方案在${node.name}执行会战`,
              `1行动、40便士、6灵性；通常1周，失败按实际退路结算；每军作战补给${plan.battleSupplyPerArmy}，另付正常维持；胜／败每军至多损失${plan.victoryLossPerArmy}／${plan.defeatLossPerArmy}现员`, plan.hasSelection);
          }
          add({ type: 'CAMPAIGN', command: { type: 'CONSOLIDATE', nodeId: node.id } }, `巩固${node.name}与原运输设施`, '1行动、30便士；实际1周', true);
        }
        for (const route of RED_PRIEST_CAMPAIGN_ROUTES.filter(r => r.from === f.location)) add({ type: 'CAMPAIGN', command: { type: 'MARCH', nodeId: route.to } }, `沿原路行军至${placeName(route.to)}`, `1行动、20便士；${route.weeks}周及真实补给`, true);
        for (const polityId of RED_PRIEST_CAMPAIGN_COALITION) add({ type: 'CAMPAIGN', command: { type: 'REORGANIZE', polityId } }, `申请${RED_PRIEST_CAMPAIGN_POLITIES.find(p => p.id === polityId)!.name}有限整补`, '1行动、20便士；国库实付，原后备跨周抵达');
        add({ type: 'CAMPAIGN', command: { type: 'SEEK_ARMISTICE' } }, '协商真实停战', '1行动、20便士；实际1周', campaign.achievement.achieved);
      }
      if (!['ARMISTICE', 'WITHDRAWN'].includes(root.campaign!.phase)) add({ type: 'CAMPAIGN', command: { type: 'WITHDRAW_PROTECT' } }, '保护撤离并结束本场战争', '1行动；原路真实返程，原伤亡保留');
      add({ type: 'CAMPAIGN', command: { type: 'MILITARY_LABOUR', taskId: campaign.labour.nextTask.id } }, campaign.labour.nextTask.title,
        '2行动；每周至多一次，获授权原国库实际支付60便士');
    }
  }
  if (!RED_PRIEST_CITY_PLACES.some(p => p.id === f.location) && ['ARMISTICE', 'WITHDRAWN'].includes(root.campaign!.phase)) travel('loen-headquarters', b.sequence === 1);
  if (RED_PRIEST_CITY_PLACES.some(p => p.id === f.location)) add({ type: 'WORK' }, '做本周原职业工作', `1行动；本周工资${root.source!.character.weeklyWage}便士仅一次`);
  add({ type: 'CLINIC' }, '支付普通重伤处置', '1行动、60便士；之后仍须休养');
  add({ type: 'REST' }, '按当前生活档休养', '1行动；旧重伤须先处置', b.injuries.length > 0);
  add({ type: 'NEXT_WEEK' }, '度过真实七天', '放弃本周余下行动；照常结算生活费与旧还款', b.actions === 0);
  if (b.sequence === 1 && f.location === root.campaign!.location &&
    f.location !== 'loen-headquarters' && ['ORDERED', 'WAR'].includes(root.campaign!.phase)) {
    let returnWeeks = 0;
    for (const route of RED_PRIEST_CAMPAIGN_ROUTES) {
      returnWeeks += route.weeks;
      if (route.to === f.location) break;
    }
    // Append without renumbering any existing action. This is a real logistics
    // journey, separate from permanent withdrawal and never an advance wage.
    add({ type: 'CAMPAIGN', command: { type: 'RETURN_TO_HEADQUARTERS' } }, '沿原路回总部整备',
      `1行动；实际返程${returnWeeks}周，无个人预付费用；原军费、补给与生活欠款照常，战争和伤亡保留`, b.cash < 70);
  }
  if (b.sequence === 1 && f.location === 'loen-headquarters' && f.location === root.campaign!.location &&
    ['ORDERED', 'WAR'].includes(root.campaign!.phase)) {
    const r = RED_PRIEST_HEADQUARTERS_REST;
    add({ type: 'CAMPAIGN', command: { type: 'REST_FIELD_ARMIES' } }, '让总部原军休整',
      `1行动、${r.weeks}周；每国原军需${r.treasury}、每军现有补给${r.supply}，另付正常周维持；士气增加${r.morale}至多${r.maximumMorale}，不返还死伤兵与后备`,
      campaign.legions.filter(l => l.role === 'FIELD' && l.polityId !== 'feysac').some(l => l.morale < 40));
  }
  if (['ARMISTICE', 'WITHDRAWN'].includes(root.campaign!.phase) &&
    RED_PRIEST_CAMPAIGN_NODES.some(n => n.id === f.location)) {
    let returnWeeks = 0;
    for (const route of RED_PRIEST_CAMPAIGN_ROUTES) { returnWeeks += route.weeks; if (route.to === f.location) break; }
    add({ type: 'RETURN_ON_FOOT' }, '停战后沿原路步行返总部',
      `1行动、${returnWeeks * 2}周；不预付车费，照付实际生活费与旧还款；原军团留在停战驻地`, b.cash < returnWeeks * 10);
  }
  if (b.sequence === 1 && f.location === root.campaign!.location && ['ORDERED', 'WAR'].includes(root.campaign!.phase)) {
    const supply = RED_PRIEST_SUPPLY_ONLY_CONVOY;
    for (const polityId of RED_PRIEST_CAMPAIGN_COALITION) add({ type: 'CAMPAIGN', command: { type: 'SUPPLY_ONLY', polityId } },
      `运输${RED_PRIEST_CAMPAIGN_POLITIES.find(p => p.id === polityId)!.name}原库存补给`,
      `1行动、20便士、1周下单；原国库${supply.treasury}，原补给${supply.supply}在${supply.weeks}周后抵达，不补兵或士气`);
  }
  // Append only: existing legacy action IDs and facts remain unchanged.
  if (b.sequence === 1 && root.campaign!.phase === 'CRISIS' && !root.campaign!.planning && f.location === root.campaign!.location)
    add({ type: 'CAMPAIGN', command: { type: 'ENABLE_PLANNING' } }, '启用本场战争筹备',
      '不花行动、时间或费用；须在签发发动命令前选择，之后每次侦察和保护性准备照实支付，不能补写过去战果');
  // New choices append only. Legacy action IDs, costs, order and sections stay exact.
  if (b.sequence === 1 && root.materials!.status === 'ACTIVE') {
    const compounds = root.materials!.compounds.filter(compound => compound.status === 'PREPARED');
    if (compounds.length > 0) {
      const lines: string[] = [];
      for (const compound of compounds) {
        const preview = getRedPriestPromotionStabilityPreview(root, compound.id), cost = preview.cost;
        lines.push(...redPriestPromotionStabilityReadiness(preview));
        add({ type: 'STABILIZE_PROMOTION', compoundId: compound.id }, '为这份原成药完成战后稳定准备',
          `${cost.actions}行动、${cost.cash}便士、${cost.spirituality}灵性、${cost.mind}精神；实际${cost.weeks}周，另结正常生活费与旧还款；只用于此份原成药的下一次服用`);
        if (preview.eligible && !preview.prepared) result.actions.at(-1)!.preferredAction = true;
      }
      result.sections.push({ id: 'promotion-stability', title: '这份原成药的服用风险与准备', lines });
    }
  }
  if (b.sequence === 0 && !root.epilogue && f.location === root.campaign!.location) {
    add({ type: 'START_PREPARED_EPILOGUE' }, '到原运输路开展有限战后救援',
      '1行动；原军团实派六人、消耗2补给；两项有限技巧只在本次现场获得实际序列0加值', true);
    if (result.actions.at(-1)!.enabled) result.actions.at(-1)!.preferredAction = true;
    result.sections.push({ id: 'epilogue-entry-readiness', title: '进入原火场前', lines: [
      `当前${b.actions}行动；入场实际消耗1行动，${b.actions >= 1 ? `之后剩${b.actions - 1}行动` : '当前行动不足，须先安排本周行动'}。协同、控火与搬运分别还需1行动，入场不会额外补行动。`,
      '本次由仍活着的红祭司本人对同一六人分队与原火场有限施术；只能选择实际付得起的行动，失败仍有伤亡。',
      '可以一次技巧后搬运，或直接普通搬运；也可零行动沿原安全侧线撤出。尚未转运的原伤员留在原遮蔽救护站，原伤势保留。',
    ] });
  }
  if (b.sequence === 1 && f.location === 'loen-headquarters' &&
    root.campaign!.location !== 'loen-headquarters' && ['ARMISTICE', 'WITHDRAWN'].includes(root.campaign!.phase))
    travel(root.campaign!.location);
  return result;
}
