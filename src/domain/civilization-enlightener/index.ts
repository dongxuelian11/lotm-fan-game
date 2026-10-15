import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SAVANT_ABILITY_IDS } from '../savant/types.js';
import { ARCHAEOLOGIST_ABILITY_IDS } from '../archaeologist/types.js';
import { APPRAISER_ABILITY_IDS } from '../appraiser/types.js';
import { ARTISAN_ABILITY_IDS } from '../artisan/types.js';
import { ASTRONOMER_ABILITY_IDS } from '../astronomer/types.js';
import { ALCHEMIST_ABILITY_IDS } from '../alchemist/types.js';
import { ARCANE_SCHOLAR_ABILITY_IDS } from '../arcane-scholar/types.js';
import { KNOWLEDGE_MENTOR_ABILITY_IDS } from '../knowledge-mentor/types.js';
import { hasKnowledgeMentorLock } from '../knowledge-mentor/index.js';
import { hasArcaneScholarLock } from '../arcane-scholar/index.js';
import { hasAlchemistRitualLock } from '../alchemist/ritual.js';
import { hasAlchemistLifeLock } from '../alchemist/life.js';
import { hasAlchemistEncounterLock } from '../alchemist/encounter.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createCivilizationEnlightenerLifeState, initializeCivilizationEnlightenerLife, applyCivilizationEnlightenerActivity, projectCivilizationEnlightenerLife, civilizationEnlightenerLifeActions, validateCivilizationEnlightenerLife, validateCivilizationEnlightenerActivityCommand, hasCivilizationEnlightenerLifeLock, civilizationEnlightenerLifeOriginalEvents } from './life.js';
import { createCivilizationEnlightenerEncounterState, applyCivilizationEnlightenerEncounterCommand, projectCivilizationEnlightenerEncounter, civilizationEnlightenerEncounterActions, validateCivilizationEnlightenerEncounter, validateCivilizationEnlightenerEncounterCommand, hasCivilizationEnlightenerEncounterLock, civilizationEnlightenerEncounterOriginalEvents } from './encounter.js';
import { CIVILIZATION_ENLIGHTENER_ABILITIES, CIVILIZATION_ENLIGHTENER_INHERITED_ABILITIES, CIVILIZATION_ENLIGHTENER_BOTTLE_IDS, CIVILIZATION_ENLIGHTENER_CONSUMPTION_RISK, CIVILIZATION_ENLIGHTENER_FORMULA_STATUS, CIVILIZATION_ENLIGHTENER_GUIDE, CIVILIZATION_ENLIGHTENER_LABOUR_STEPS, CIVILIZATION_ENLIGHTENER_LABOUR_TASKS, CIVILIZATION_ENLIGHTENER_MIN_KNOWLEDGE_MENTOR_WEEKS, CIVILIZATION_ENLIGHTENER_POTION_SOURCES, CIVILIZATION_ENLIGHTENER_PREPARATIONS, CIVILIZATION_ENLIGHTENER_PRICES, CIVILIZATION_ENLIGHTENER_SOURCE_STATUS } from './content.js';
import { CIVILIZATION_ENLIGHTENER_ABILITY_IDS, CIVILIZATION_ENLIGHTENER_PREPARATION_IDS, CIVILIZATION_ENLIGHTENER_SOURCE_KEYS, type CivilizationEnlightenerSourceHistory, type CivilizationEnlightenerAcquisitionBudget, type CivilizationEnlightenerAcquisitionEvent, type CivilizationEnlightenerAcquisitionCommand, type CivilizationEnlightenerAction, type CivilizationEnlightenerBottle, type CivilizationEnlightenerCommand, type CivilizationEnlightenerProjection, type CivilizationEnlightenerState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const CIVILIZATION_ENLIGHTENER_INHERITED_ABILITY_IDS = [...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS, ...APPRAISER_ABILITY_IDS, ...ARTISAN_ABILITY_IDS, ...ASTRONOMER_ABILITY_IDS, ...ALCHEMIST_ABILITY_IDS, ...ARCANE_SCHOLAR_ABILITY_IDS, ...KNOWLEDGE_MENTOR_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = CIVILIZATION_ENLIGHTENER_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): CivilizationEnlightenerBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createCivilizationEnlightenerState(): CivilizationEnlightenerState {
  return { guidanceKnown: false, bottles: CIVILIZATION_ENLIGHTENER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, knowledgeMentorActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], sourceHistory: null, sourceScene: null, life: createCivilizationEnlightenerLifeState(), encounter: createCivilizationEnlightenerEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isCivilizationEnlightener = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 1;
export const isCivilizationEnlightenerAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 2;
export const hasCivilizationEnlightenerHistory = (s: SliceState) => isCivilizationEnlightener(s) && s.civilizationEnlightener.promotionWeek !== null;
/** Validate each actual predecessor's consumed independent bottle without inventing past play. */
function sourceHistory(s: SliceState): boolean {
  if (!s.savant.discovered || !s.savant.guidanceKnown || !integer(s.progression.promotionWeek, 1, s.week)) return false;
  const first = s.savant.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || first[0]!.consumedWeek !== s.progression.promotionWeek || !integer(first[0]!.acquiredWeek, 1, s.progression.promotionWeek)) return false;
  let previous = s.progression.promotionWeek;
  for (const stage of [s.archaeologist, s.appraiser, s.artisan, s.astronomer, s.alchemist, s.arcaneScholar, s.knowledgeMentor]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.archaeologist.savantActingAtPromotion === 100 && s.appraiser.archaeologistActingAtPromotion === 100 &&
    s.artisan.appraiserActingAtPromotion === 100 && s.astronomer.artisanActingAtPromotion === 100 &&
    s.alchemist.astronomerActingAtPromotion === 100 && s.arcaneScholar.alchemistActingAtPromotion === 100 && s.knowledgeMentor.arcaneScholarActingAtPromotion === 100;
}
export function civilizationEnlightenerSourceHistory(s: SliceState): CivilizationEnlightenerSourceHistory {
  return Object.fromEntries(CIVILIZATION_ENLIGHTENER_SOURCE_KEYS.map(key => [key, structuredClone(s[key])])) as CivilizationEnlightenerSourceHistory;
}
function sourceHistoryDigest(s: SliceState): string {
  return sha256Hex(stableStringify(s.civilizationEnlightener.sourceHistory ?? civilizationEnlightenerSourceHistory(s)));
}
function sourceIdentityDigest(s: SliceState): string {
  const { coreStats: _stats, ...identity } = s.character;
  return sha256Hex(stableStringify(identity));
}
const knownChannel = (s: SliceState) => (isCivilizationEnlightenerAcquisitionStage(s) || isCivilizationEnlightener(s)) && sourceHistory(s);
/** Old commands close at S1; their completed records are retained exactly. */
export function hasCivilizationEnlightenerOldPractice(s: SliceState): boolean {
  return hasKnowledgeMentorLock(s) || hasArcaneScholarLock(s) || hasAlchemistRitualLock(s) || hasAlchemistLifeLock(s) || hasAlchemistEncounterLock(s) ||
    Object.values(s.alchemist.life.cases).some(c => c.status === 'PREPARED') ||
    Object.values(s.astronomer.cases).some(c => c.contactOpen || c.status === 'PREPARED') ||
    s.alchemist.life.creations.some(o => o.active || o.location !== 'PLAYER') ||
    s.alchemist.life.parcel.custodian !== 'AL4-HELENA' || s.alchemist.life.parcel.location !== 'OWNER' ||
    s.alchemist.life.entrustedMaterial.custodian !== 'AL4-HELENA' || s.alchemist.life.entrustedMaterial.location !== 'OWNER';
}
const knowledgeMentorReportsComplete = (s: SliceState) => s.knowledgeMentor.life.reflected &&
  Object.keys(s.knowledgeMentor.life.cases).length === 3 && Object.entries(s.knowledgeMentor.life.cases).every(([id, c]) =>
    c.status === 'RESOLVED' && c.attempts.length > 0 && c.attempts.every(attempt => attempt.week <= s.week) &&
    c.attempts.at(-1)!.steps.some(step => step.type === 'VERIFY') && c.attempts.at(-1)!.steps.at(-1)?.type === 'CLOSE' &&
    s.seer.completedSources.includes(`knowledge-mentor-case:${id}`)) && s.seer.completedSources.includes('knowledge-mentor-reflection');
export const hasCivilizationEnlightenerOldSceneLock = hasCivilizationEnlightenerOldPractice;
export const hasCivilizationEnlightenerRitualLock = (s: SliceState): boolean => s.civilizationEnlightener.preparedWeek !== null;
export const hasCivilizationEnlightenerLock = (s: SliceState): boolean => hasCivilizationEnlightenerRitualLock(s) || hasCivilizationEnlightenerLifeLock(s) || hasCivilizationEnlightenerEncounterLock(s);
const bottleNumber = (b: Pick<CivilizationEnlightenerBottle, 'id'>) => Number(b.id.slice('civilization-enlightener-potion-'.length));
const potionPrice = (b: CivilizationEnlightenerBottle) => CIVILIZATION_ENLIGHTENER_PRICES.potion - (b.labourSteps === CIVILIZATION_ENLIGHTENER_LABOUR_STEPS ? CIVILIZATION_ENLIGHTENER_PRICES.labourCredit : 0);
const knowledgeMentorWeeks = (s: SliceState) => Math.max(0, (s.civilizationEnlightener.promotionWeek ?? s.week) - (s.knowledgeMentor.promotionWeek ?? s.week));
const exhaustedSupply = (state: CivilizationEnlightenerState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${CIVILIZATION_ENLIGHTENER_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列1文明启蒙者成品，独立封存编号civilization-enlightener-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => CIVILIZATION_ENLIGHTENER_PREPARATION_IDS.every(id => s.civilizationEnlightener.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `知识导师魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.knowledgeMentor.promotionWeek === null || knowledgeMentorWeeks(s) < CIVILIZATION_ENLIGHTENER_MIN_KNOWLEDGE_MENTOR_WEEKS) return `成为知识导师后已过${knowledgeMentorWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!knowledgeMentorReportsComplete(s)) return '先完成知识导师的三份实际报告与反思，并收好旧核验现场。';
  return hasPreparations(s) ? null : '先分别核对八阶原瓶与既往报告、有限诊断及普通教学边界和普通返回路线；领取药瓶不能代做专业准备。';
}
export function validateCivilizationEnlightenerAcquisitionCommand(v: unknown): v is CivilizationEnlightenerAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && CIVILIZATION_ENLIGHTENER_PREPARATION_IDS.includes(v.taskId as typeof CIVILIZATION_ENLIGHTENER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^civilization-enlightener-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isCivilizationEnlightenerAcquisitionCommand = validateCivilizationEnlightenerAcquisitionCommand;
export function validateCivilizationEnlightenerCommand(v: unknown): v is CivilizationEnlightenerCommand {
  return validateCivilizationEnlightenerAcquisitionCommand(v) || validateCivilizationEnlightenerActivityCommand(v) || validateCivilizationEnlightenerEncounterCommand(v);
}
export function civilizationEnlightenerAcquisitionBlock(s: SliceState, command: CivilizationEnlightenerAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: CivilizationEnlightenerAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateCivilizationEnlightenerAcquisitionCommand(command)) return '文明启蒙者准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasCivilizationEnlightenerOldPractice(s)) || hasCivilizationEnlightenerLifeLock(s) || hasCivilizationEnlightenerEncounterLock(s)) return '先停止负载并收回原盒、原架和受托原物，沿普通路线离开旧现场；旧人物、伤势与实战后果继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德沃德工坊的安静房间与专业交接处。';
  if (!knownChannel(s)) return '实际成为知识导师并保留原指导渠道后，才能了解文明启蒙者之路。';
  if (!isCivilizationEnlightenerAcquisitionStage(s)) return '已经晋升文明启蒙者1，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '通识者至知识导师的19项掌握记录不完整，暂不能继续晋升。';
  const state = s.civilizationEnlightener;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE' && !knowledgeMentorReportsComplete(s)) return '先完成知识导师三份生活报告与反思，再核对这次晋升的既往记录。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < CIVILIZATION_ENLIGHTENER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的文明启蒙者原瓶。';
    return s.cash < CIVILIZATION_ENLIGHTENER_PRICES.preparation ? '当次场地检查需要150便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY' && s.cash < CIVILIZATION_ENLIGHTENER_PRICES.resupply) return '申请下一批需要100便士实际费用。';
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批文明启蒙者原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的文明启蒙者准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选文明启蒙者独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与150便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= CIVILIZATION_ENLIGHTENER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: CivilizationEnlightenerAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.civilizationEnlightener;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      state.sourceHistory = civilizationEnlightenerSourceHistory(s);
      state.sourceScene = { week: s.week, date: structuredClone(s.date), revision: s.revision, random: { ...s.random },
        budget: acquisitionBudget(s), identityDigest: sourceIdentityDigest(s), historyDigest: sourceHistoryDigest(s),
        creations: structuredClone(s.alchemist.life.creations), combatHistoryLength: s.combatHistory.length, combatHistoryDigest: sha256Hex(stableStringify(s.combatHistory)), city: 'BACKLUND' };
      s.actionsRemaining--; s.cash -= CIVILIZATION_ENLIGHTENER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取文明启蒙者独立成品与专业准备指导', `花1行动、500便士。${CIVILIZATION_ENLIGHTENER_GUIDE}说明原渠道记录。${CIVILIZATION_ENLIGHTENER_FORMULA_STATUS}${CIVILIZATION_ENLIGHTENER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = CIVILIZATION_ENLIGHTENER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= CIVILIZATION_ENLIGHTENER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、150便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与150便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(CIVILIZATION_ENLIGHTENER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款1100便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('文明启蒙者独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; s.cash -= CIVILIZATION_ENLIGHTENER_PRICES.resupply; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批文明启蒙者成品', `原瓶全部失败耗尽，花1行动与100便士核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < CIVILIZATION_ENLIGHTENER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`civilization-enlightener-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶文明启蒙者原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6600便士或对应五项劳动后1100便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.knowledgeMentorActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 1; s.progression.acting = 0;
        if (!s.seer.completedSources.includes('paragon-s1')) s.seer.completedSources.push('paragon-s1');
        initializeCivilizationEnlightenerLife(s);
        for (const id of CIVILIZATION_ENLIGHTENER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为文明启蒙者', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；知识导师消化100与原19项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满。角色性别与年龄不变，旧伤、原工坊人物及受托物、过去八阶的原瓶、劳务与实际结果全部留存。旧敌人的死亡或投降不重开，原造物不充能或修复；晋升不会治疗本人或旧人。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '文明启蒙者魔药严重排异' : '文明启蒙者魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为知识导师，旧消化、掌握、服药前性别、身体伤势与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、150便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function acquisitionBudget(s: SliceState): CivilizationEnlightenerAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: CivilizationEnlightenerState) {
  return { guidanceKnown: state.guidanceKnown, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, knowledgeMentorActingAtPromotion: state.knowledgeMentorActingAtPromotion, sourceHistory: state.sourceHistory, sourceScene: state.sourceScene,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyCivilizationEnlightenerAcquisition(s: SliceState, command: CivilizationEnlightenerAcquisitionCommand, ctx: SeerContext): void {
  const reason = civilizationEnlightenerAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const cursorBefore = s.random.cursor, before = acquisitionBudget(s), actor: CivilizationEnlightenerAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, age: s.character.age, sourceIdentityDigest: sourceIdentityDigest(s), sourceHistoryDigest: ['LEARN_GUIDANCE', 'CONSUME'].includes(command.type) ? sourceHistoryDigest(s) : null, pathwayId: 'paragon',
    knowledgeMentorPromotionWeek: s.knowledgeMentor.promotionWeek!, savantPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.civilizationEnlightener.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: acquisitionBudget(s), cursorBefore, cursorAfter: s.random.cursor, randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is CivilizationEnlightenerAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    !['MALE', 'FEMALE'].includes(String(v.gender)) || (v.sequence !== 2 && v.sequence !== 1) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 1 ? CIVILIZATION_ENLIGHTENER_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateCivilizationEnlightenerAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.civilizationEnlightener.acquisitionJournal, expected = createCivilizationEnlightenerState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    let previous: CivilizationEnlightenerAcquisitionEvent | null = null, nextCursor = s.civilizationEnlightener.sourceScene?.random.cursor ?? 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.knowledgeMentor.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateCivilizationEnlightenerAcquisitionCommand(raw.command) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 2 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'knowledgeMentorPromotionWeek', 'savantPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== raw.before.gender || raw.actor.age !== s.character.age ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || raw.actor.sourceIdentityDigest !== sourceIdentityDigest(s) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'paragon' || raw.actor.knowledgeMentorPromotionWeek !== s.knowledgeMentor.promotionWeek || raw.actor.savantPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as CivilizationEnlightenerAcquisitionEvent;
      if (!integer(event.cursorBefore, nextCursor, s.random.cursor) || event.cursorAfter !== event.cursorBefore + (event.command.type === 'CONSUME' ? 1 : 0) || !integer(event.cursorAfter, 0, s.random.cursor) ||
        (event.command.type === 'CONSUME' && (event.randomBefore !== event.cursorBefore || event.randomAfter !== event.cursorAfter))) return false;
      if (event.actor.sourceHistoryDigest !== null && event.actor.sourceHistoryDigest !== sourceHistoryDigest(s)) return false;
      if (event.after.sequence === 1 && event.after.gender !== event.before.gender) return false;
      if ([...event.before.injuries, ...event.after.injuries].some(injury => injury.acquiredRevision > event.revision || injury.treatedRevision !== null && injury.treatedRevision > event.revision)) return false;
      if (previous) {
        if (event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || event.revision <= previous.revision || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id] !== previous!.after.mastery[id]) ||
          !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
        // A prepared site forbids intervening work or recovery; cancellation and drinking consume this exact budget.
        if (expected.preparedWeek !== null && (event.week !== previous.week || !same(event.date, previous.date) || !same(event.before, previous.after))) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && (!same(event.before, previous.after) || event.cursorBefore !== previous.cursorAfter)) return false;
      }
      const b = event.before;
      const shadow: SliceState = { ...s, ...(s.civilizationEnlightener.sourceHistory ? structuredClone(s.civilizationEnlightener.sourceHistory) : {}), status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, combatHistory: s.combatHistory.slice(0, s.civilizationEnlightener.sourceScene?.combatHistoryLength ?? s.combatHistory.length), activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.cursorBefore },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'paragon', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, civilizationEnlightener: expected };
      let checks = 0;
      const context: SeerContext = { note() {}, roll() { throw new Error('购药准备没有额外随机来源。'); }, check(ability, difficulty) {
        if (++checks !== 1 || event.command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30 ||
          !integer(event.randomBefore, nextCursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) throw new Error('服药随机来源不一致。');
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore);
        const check = resolveNormalCheck({ ability: 'will', baseAbility: b.coreStats.will, difficulty: 30, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || random.cursor !== event.randomAfter) throw new Error('服药结果与原随机记录不符。');
        shadow.random.cursor = random.cursor; nextCursor = random.cursor; return check;
      } };
      applyAcquisitionMutation(shadow, event.command, context, true);
      if (!same(acquisitionBudget(shadow), event.after)) return false;
      if (event.command.type === 'CONSUME' ? checks !== 1 : checks !== 0 || event.check !== null || event.randomBefore !== null || event.randomAfter !== null) return false;
      nextCursor = event.cursorAfter; previous = event;
    }
    if (!same(acquisitionState(expected), acquisitionState(s.civilizationEnlightener))) return false;
    if (previous) {
      if (s.character.gender !== previous.after.gender) return false;
      // No post-guidance source-stage command may manufacture growth on the inherited skills.
      if (INHERITED_ABILITY_IDS.some(id => isCivilizationEnlightener(s) ? !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500) : s.progression.mastery[id] !== previous!.after.mastery[id]) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.civilizationEnlightener.preparedWeek !== null && (!same(acquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && s.week === previous.week && previous.after.actions > 0 &&
        (!same(s.date, previous.date) || !same(acquisitionBudget(s), previous.after) || s.random.cursor !== previous.cursorAfter)) return false;
      if (isCivilizationEnlightener(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 1 || previous.after.acting !== 0 ||
        !CIVILIZATION_ENLIGHTENER_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.civilizationEnlightener.knowledgeMentorActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.civilizationEnlightener.guidanceKnown || isCivilizationEnlightener(s)) return false;
    return true;
  } catch { return false; }
}

export function applyCivilizationEnlightenerCommand(s: SliceState, command: CivilizationEnlightenerCommand, ctx: SeerContext): void {
  if (!validateCivilizationEnlightenerCommand(command)) throw new Error('文明启蒙者命令无效。');
  if (validateCivilizationEnlightenerAcquisitionCommand(command)) return applyCivilizationEnlightenerAcquisition(s, command, ctx);
  if (validateCivilizationEnlightenerActivityCommand(command)) return applyCivilizationEnlightenerActivity(s, command, ctx);
  if (validateCivilizationEnlightenerEncounterCommand(command)) return applyCivilizationEnlightenerEncounterCommand(s, command, ctx);
  throw new Error('未知文明启蒙者命令。');
}

/** Acquisition actions remain separate so the panel can compose actual life
 * and encounter actions without duplicating the potion protocol. */
export function civilizationEnlightenerAcquisitionActions(s: SliceState): CivilizationEnlightenerAction[] {
  if (!knownChannel(s) || isCivilizationEnlightener(s)) return [];
  const state = s.civilizationEnlightener, actions: CivilizationEnlightenerAction[] = [];
  const add = (id: string, label: string, cost: string, command: CivilizationEnlightenerAcquisitionCommand) => {
    const reason = civilizationEnlightenerAcquisitionBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason, ...(command.type === 'LEAVE_PREPARATION' ? { cleanup: true } : {}) });
  };
  if (!state.guidanceKnown) add('learn-civilization-enlightener-guidance', '听取文明启蒙者成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
  else {
    for (const task of CIVILIZATION_ENLIGHTENER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`civilization-enlightener-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
    if (state.preparedWeek === null) add('prepare-civilization-enlightener-promotion', '实际检查本次服药场地', '1行动 · 150便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
    else add('leave-civilization-enlightener-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
    if (state.resupply.requestedWeek !== null) add('receive-civilization-enlightener-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
    else if (exhaustedSupply(state)) add('request-civilization-enlightener-supply', '申请下一批独立文明启蒙者成品', '1行动 · 100便士 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
    for (const bottle of state.bottles) {
      if (bottle.status === 'SUPPLIER') {
        if (bottle.labourSteps < CIVILIZATION_ENLIGHTENER_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${CIVILIZATION_ENLIGHTENER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶文明启蒙者魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
      } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶文明启蒙者魔药`, `0行动 · 知识导师消化${s.progression.acting}/100 · ${knowledgeMentorWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  return actions;
}
function preferredCivilizationEnlightenerAction(s: SliceState, actions: CivilizationEnlightenerAction[]): CivilizationEnlightenerAction | undefined {
  const enabled = actions.filter(action => action.enabled), life = projectCivilizationEnlightenerLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.preferredAction) ?? enabled.find(action => action.id === preferredId) ??
    enabled.find(action => !action.cleanup && !['LEAVE_PREPARATION', 'RETURN_HOME', 'LEAVE_ENCOUNTER', 'ABORT'].includes(action.command.type)) ?? enabled[0];
}
export function projectCivilizationEnlightener(s: SliceState): CivilizationEnlightenerProjection {
  const state = s.civilizationEnlightener, available = knownChannel(s), promoted = isCivilizationEnlightener(s);
  const actions = available ? [...civilizationEnlightenerAcquisitionActions(s), ...civilizationEnlightenerLifeActions(s), ...civilizationEnlightenerEncounterActions(s)] : [];
  const preferred = preferredCivilizationEnlightenerAction(s, actions), chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '文明启蒙者·通识者序列1', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    formulaKnown: false, formula: [], ...(available ? { story: `${CIVILIZATION_ENLIGHTENER_FORMULA_STATUS}${CIVILIZATION_ENLIGHTENER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6600便士，或为本瓶完成五项真实劳动后支付1100便士；全部失败耗尽后才能申请下一批，跨真实周收货并逐瓶另行取得。` : '',
    actions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : actions.find(a => a.reason)?.reason ?? (promoted ? '已完成记录保留，可以继续正常生活。' : '先完成知识导师的实际经历。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 文明启蒙者成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周当次场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为知识导师' : '排异，仍为知识导师'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? CIVILIZATION_ENLIGHTENER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...CIVILIZATION_ENLIGHTENER_INHERITED_ABILITIES, ...CIVILIZATION_ENLIGHTENER_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `知识导师消化${state.knowledgeMentorActingAtPromotion}/100留存；文明启蒙者扮演${s.progression.acting}/100。三份生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。` : available ? `知识导师需消化100（当前${s.progression.acting}/100）、晋2后12整周（当前${knowledgeMentorWeeks(s)}/12），完成三份旧报告与反思；另须三项专业准备和当周场地检查。` : '先完成知识导师的实际经历。',
    pollution: s.seer.pollution, risk: available ? CIVILIZATION_ENLIGHTENER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    characterName: s.character.name, currentGender: s.character.gender, originalGender: state.acquisitionJournal[0]?.before.gender ?? s.character.gender,
    appearanceRecord: available ? `${s.character.name}，原创建年龄${s.character.age}岁、当前角色性别${s.character.gender === 'FEMALE' ? '女性' : '男性'}。本次晋升不改变角色性别、年龄、特质或旧伤；原工坊人物、原制造记录及其经历继续保留。` : '',
    injuries: available ? s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })) : [], injuryRisk: s.injuryRisk,
    inheritedTools: available ? '原盒AL4-BOX-1与原架AL4-FRAME-1保留制造身份、当前储能和耐久；原客户灯仍属客户，旧原片保持已耗或失败回收。借用扳手须实际归还，修理垫片须付费取得并耗用。' : '',
    inheritedHistory: available ? [
      `知识导师在第${s.knowledgeMentor.promotionWeek}周实际晋升；${promoted ? `原消化${state.knowledgeMentorActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从该周计算。`,
      '前八阶19项技巧保持原有掌握，两项新技巧从0开始，共21项。原掌握0仍为0；原30/30/25/15能力权重继续沿用。',
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；现有伤势${s.injuries.length}处，累计风险${s.injuryRisk}。旧伤须真实诊疗和休养。`,
      ...s.alchemist.life.creations.map(o => `${o.id}：储能${o.charge}/3，耐久${o.durability}/100，所在${o.location}。`),
      `原罗温·黑尔：${s.knowledgeMentor.encounter.enemyStatus}，健康${s.knowledgeMentor.encounter.enemyHealth}；原科尔温：${s.arcaneScholar.encounter.enemyStatus}；原奥斯里克：${s.alchemist.encounter.enemy.status}。原人物结局保留。`,
      '旧园已关闭，死植和沙化原土保留。维拉的原包裹仍属于她；每项新教学需要本次明确同意。',
    ] : [],
    life: projectCivilizationEnlightenerLife(s), encounter: projectCivilizationEnlightenerEncounter(s), insideCase: hasCivilizationEnlightenerLock(s),
    environment: available ? '沃德原工作台AL4-WORKBENCH-1的近远两端相隔两米。原盒与原架保持实际资源，手动停机不需要给造物充能。维拉可决定是否学习，撤回后仍能普通停止、亲手归还原物并沿路线回家。' : '',
  };
}

/** Chronology is checked separately from deterministic per-command replay. */
export function validateCivilizationEnlightenerJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.civilizationEnlightener.acquisitionJournal;
    let cursor = 0;
    for (let n = 0; n < events.length; n++) {
      const event = events[n]!, previous = events[n - 1];
      if (previous) {
        if (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && (!same(event.before, previous.after) || event.cursorBefore !== previous.cursorAfter)) return false;
        if (previous.command.type === 'PREPARE_PROMOTION' && (event.week !== previous.week || !same(event.date, previous.date) || !['CONSUME', 'LEAVE_PREPARATION'].includes(event.command.type) || !same(event.before, previous.after))) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id] !== previous.after.mastery[id]) || !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      }
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) return false;
        cursor = event.randomAfter;
      }
    }
    // The three independent replays still share one public command sequence,
    // resource budget and random stream. Gaps permit actual ordinary play;
    // directly adjacent commits cannot manufacture recovery or another draw.
    type SharedBudget = Pick<CivilizationEnlightenerAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { week: number; date: PublicGameDate; revision: number; before: SharedBudget; after: SharedBudget; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null };
    const shared = (budget: SharedBudget): SharedBudget => ({ actions: budget.actions, health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash });
    const timeline: Timeline[] = events.map(event => ({ week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.cursorAfter }));
    const promotion = events.find(event => event.after.sequence === 1);
    for (const event of s.civilizationEnlightener.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      timeline.push({ week: event.week, date: event.date, revision: event.revision, before: shared(event.before), after: shared(event.after),
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.randomAfter ?? event.randomCursor });
    }
    const encounter = s.civilizationEnlightener.encounter, preparation = encounter.preparation;
    if (preparation) {
      const reflection = s.civilizationEnlightener.life.journal.find(event => event.command.type === 'REFLECT');
      // Encounter receipts store resulting revisions; acquisition/life store input revisions.
      if (!promotion || !reflection || preparation.revision - 1 <= reflection.revision || preparation.week < reflection.week) return false;
      timeline.push({ week: preparation.week, date: preparation.date, revision: preparation.revision - 1,
        before: shared(preparation.before), after: shared(preparation.after), randomBefore: null, randomAfter: null, recordedCursor: preparation.randomCursor });
      for (const event of encounter.journal) timeline.push({ week: event.week, date: event.date, revision: event.revision - 1,
        before: shared(event.before), after: shared(event.after), randomBefore: null, randomAfter: null, recordedCursor: event.randomCursor });
    }
    timeline.sort((a, b) => a.revision - b.revision);
    cursor = 0; let exactCursor: number | null = null;
    for (let n = 0; n < timeline.length; n++) {
      const event = timeline[n]!, previous = timeline[n - 1];
      const adjacent = !!previous && event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0;
      if (!adjacent) exactCursor = null;
      if (previous && (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || adjacent && !same(event.before, previous.after))) return false;
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor) || exactCursor !== null && event.randomBefore !== exactCursor) return false;
        cursor = event.randomAfter; exactCursor = event.randomAfter;
      }
      if (event.recordedCursor !== null) {
        if (!integer(event.recordedCursor, cursor, s.random.cursor) || exactCursor !== null && event.recordedCursor !== exactCursor) return false;
        cursor = event.recordedCursor; exactCursor = event.recordedCursor;
      }
    }
    const tail = timeline.at(-1);
    if (tail && s.revision === tail.revision + 1 && s.week === tail.week && tail.after.actions > 0 &&
      (!same(s.date, tail.date) || !same(shared(acquisitionBudget(s)), tail.after) || exactCursor !== null && exactCursor !== s.random.cursor)) return false;
    return true;
  } catch { return false; }
}


/** A single source snapshot seals every old field. Only four live resource
 * fields of the actual original creations are normalized for comparison;
 * those fields must independently reconcile through new validated receipts. */
export function validateCivilizationEnlightenerSource(s: SliceState): boolean {
  try {
    const state = s.civilizationEnlightener, history = state.sourceHistory, scene = state.sourceScene, first = state.acquisitionJournal[0];
    if (!history || !scene || !first || !shape(history, CIVILIZATION_ENLIGHTENER_SOURCE_KEYS) ||
      !shape(scene, ['week', 'date', 'revision', 'random', 'budget', 'identityDigest', 'historyDigest', 'creations', 'combatHistoryLength', 'combatHistoryDigest', 'city']) ||
      !shape(scene.random, ['seed', 'cursor']) || scene.random.seed !== s.random.seed || !integer(scene.random.cursor, 0, s.random.cursor) ||
      !integer(scene.combatHistoryLength, 0, s.combatHistory.length) || scene.combatHistoryDigest !== sha256Hex(stableStringify(s.combatHistory.slice(0, scene.combatHistoryLength))) ||
      scene.city !== 'BACKLUND' || scene.identityDigest !== sourceIdentityDigest(s) || scene.historyDigest !== sourceHistoryDigest(s) ||
      !same(scene.creations, history.alchemist.life.creations) || first.command.type !== 'LEARN_GUIDANCE' ||
      scene.week !== first.week || scene.revision !== first.revision || !same(scene.date, first.date) ||
      !same(scene.budget, first.before) || scene.random.cursor !== first.cursorBefore || first.actor.sourceHistoryDigest !== scene.historyDigest) return false;
    const current = civilizationEnlightenerSourceHistory(s);
    if (current.alchemist.life.creations.length !== scene.creations.length) return false;
    for (let n = 0; n < current.alchemist.life.creations.length; n++) {
      const original = scene.creations[n]!, live = current.alchemist.life.creations[n]!;
      if (live.id !== original.id) return false;
      for (const field of ['charge', 'durability', 'location', 'active'] as const) Object.assign(live, { [field]: original[field] });
    }
    if (!same(current, history)) return false;
    const snapshot = (objects: SliceState['alchemist']['life']['creations']) => objects.map(({ id, charge, durability, location, active }) => ({ id, charge, durability, location, active }));
    let expected = snapshot(scene.creations), previousRevision = scene.revision;
    const events = [...civilizationEnlightenerLifeOriginalEvents(s), ...civilizationEnlightenerEncounterOriginalEvents(s)].sort((a, b) => a.revision - b.revision);
    for (const event of events) {
      if (!integer(event.revision, previousRevision + 1, s.revision) || !integer(event.week, scene.week, s.week) || !same(event.before, expected)) return false;
      expected = structuredClone(event.after); previousRevision = event.revision;
    }
    return same(expected, snapshot(s.alchemist.life.creations));
  } catch { return false; }
}

export const validateCivilizationEnlightenerInheritedState = validateCivilizationEnlightenerSource;
/** Historical validation reads the genuine paid-guidance S2 checkpoint. This
 * view never writes to the live state, and never invents predecessor actions. */
export function civilizationEnlightenerInheritedView(s: SliceState): SliceState {
  const { sourceHistory: history, sourceScene: scene } = s.civilizationEnlightener;
  if (!isCivilizationEnlightener(s) || !s.civilizationEnlightener.guidanceKnown || !history || !scene) return s;
  const budget = scene.budget;
  return { ...s, ...structuredClone(history), status: 'ACTIVE', week: scene.week, date: structuredClone(scene.date), revision: scene.revision,
    health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash, actionsRemaining: budget.actions,
    injuries: structuredClone(budget.injuries), injuryRisk: budget.injuryRisk, random: { ...scene.random },
    activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE', ending: null,
    world: { ...s.world, city: 'BACKLUND' }, character: { ...s.character, coreStats: { ...budget.coreStats } },
    progression: { ...s.progression, pathwayId: 'paragon', sequence: 2, acting: budget.acting, mastery: { ...budget.mastery } },
    seer: { ...s.seer, pollution: budget.pollution, completedSources: [...budget.completedSources] },
    combatHistory: s.combatHistory.slice(0, scene.combatHistoryLength), civilizationEnlightener: createCivilizationEnlightenerState() };
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateCivilizationEnlightenerState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.civilizationEnlightener;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'knowledgeMentorActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'sourceHistory', 'sourceScene', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== CIVILIZATION_ENLIGHTENER_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as CivilizationEnlightenerState, promoted = isCivilizationEnlightener(s), acquisitionStage = isCivilizationEnlightenerAcquisitionStage(s);
  const firstWeek = s.knowledgeMentor.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + CIVILIZATION_ENLIGHTENER_MIN_KNOWLEDGE_MENTOR_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !validateCivilizationEnlightenerSource(s))) return false;
  if (!state.guidanceKnown && (state.sourceHistory !== null || state.sourceScene !== null)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > CIVILIZATION_ENLIGHTENER_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !CIVILIZATION_ENLIGHTENER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasCivilizationEnlightenerOldPractice(s) || hasCivilizationEnlightenerLifeLock(s) || hasCivilizationEnlightenerEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.knowledgeMentor.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.knowledgeMentorActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !knowledgeMentorReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...CIVILIZATION_ENLIGHTENER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.knowledgeMentorActingAtPromotion !== null || CIVILIZATION_ENLIGHTENER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `civilization-enlightener-potion-${index + 1}` || !integer(b.labourSteps, 0, CIVILIZATION_ENLIGHTENER_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < CIVILIZATION_ENLIGHTENER_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== CIVILIZATION_ENLIGHTENER_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % CIVILIZATION_ENLIGHTENER_BOTTLE_IDS.length;
      if (b.stockedWeek !== state.bottles[batchStart]!.stockedWeek || state.bottles.slice(0, batchStart).some(previous => previous.status !== 'CONSUMED' || !failed(previous.outcome) || !integer(previous.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
    }
    if (!state.guidanceKnown && (b.labourSteps !== 0 || b.status !== 'SUPPLIER')) return false;
    if (b.status === 'SUPPLIER') {
      if (b.acquiredWeek !== null || b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.acquiredWeek, stockWeek, lastAcquisitionWeek)) return false;
      if (b.status === 'PLAYER') {
        if (b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
      } else if (b.status === 'CONSUMED') {
        if (!integer(s.knowledgeMentor.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateCivilizationEnlightenerAcquisitionJournal(s) || !validateCivilizationEnlightenerJournalContinuity(s) || !validateCivilizationEnlightenerLife(s) || !validateCivilizationEnlightenerEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting || !s.seer.completedSources.includes('paragon-s1')) return false;
    const promotedReceipt = state.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
    if (!promotedReceipt) return false;
    const expectedMastery = { ...promotedReceipt.after.mastery };
    for (const [caseId, ability] of [['worn-bearing', CIVILIZATION_ENLIGHTENER_ABILITY_IDS[0]], ['taught-stop', CIVILIZATION_ENLIGHTENER_ABILITY_IDS[1]]] as const) {
      const r = state.life.cases[caseId];
      if (r.status === 'RESOLVED' && r.abilityApplied && r.result === 'ABILITY') expectedMastery[ability] = Math.min(500, expectedMastery[ability]! + 8);
    }
    for (const round of s.combatHistory) if (round.civilizationEnlightenerOutcome) {
      for (const action of [...round.civilizationEnlightenerOutcome.playerActions, ...round.civilizationEnlightenerOutcome.enemyActions]) {
        for (const id of action.masteryApplied) expectedMastery[id] = Math.min(500, expectedMastery[id]! + 8);
      }
    }
    if (!same(s.progression.mastery, expectedMastery)) return false;
  }
  if (!promoted && s.seer.completedSources.includes('paragon-s1')) return false;
  return true;
}
export { CIVILIZATION_ENLIGHTENER_ABILITIES } from './content.js';
export { CIVILIZATION_ENLIGHTENER_ABILITY_IDS } from './types.js';
export type * from './types.js';

export const handleCivilizationEnlightener = applyCivilizationEnlightenerCommand;

/** Historical membership accepts the actual sequence-one record; current commands remain exact-stage gated. */
export const validateCivilizationEnlightenerHistory = validateCivilizationEnlightenerState;
