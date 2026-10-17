import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CORPSECOLLECTOR_ABILITY_IDS } from '../corpsecollector/types.js';
import { GRAVEDIGGER_ABILITY_IDS } from '../gravedigger/types.js';
import { SPIRITMEDIUM_ABILITY_IDS } from '../spiritmedium/types.js';
import { SPIRIT_GUIDE_ABILITY_IDS } from '../spirit-guide/types.js';
import { GATEKEEPER_ABILITY_IDS } from '../gatekeeper/types.js';
import { UNDYING_ABILITY_IDS } from '../undying/types.js';
import { FERRYMAN_ABILITY_IDS } from '../ferryman/types.js';
import { DEATH_CONSUL_ABILITY_IDS } from '../death-consul/types.js';
import { validateCorpsecollectorState } from '../corpsecollector/index.js';
import { validateGravediggerState } from '../gravedigger/index.js';
import { validateSpiritmediumState } from '../spiritmedium/index.js';
import { validateSpiritGuideState } from '../spirit-guide/index.js';
import { validateGatekeeperState } from '../gatekeeper/index.js';
import { validateUndyingState } from '../undying/index.js';
import { validateFerrymanState, activeFerrymanChannel } from '../ferryman/index.js';
import { validateDeathConsulSiteState } from '../death-consul/resources.js';
import { validateDeathConsulState, hasDeathConsulLock, hasDeathConsulOldSceneLock, currentDeathConsulSourceEra } from '../death-consul/index.js';
import { FERRYMAN_PROVIDERS } from '../ferryman/content.js';
import { applyFerrymanEraCommand, validateFerrymanEraCommand, validateFerrymanEra, createFerrymanEraState, type FerrymanEraCommand, type FerrymanEraState } from '../ferryman/era.js';
import { validateLongChapterState } from '../long-chapter/index.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createPaleEmperorLifeState, initializePaleEmperorLifeState, applyPaleEmperorLifeCommand, projectPaleEmperorLife, paleEmperorLifeActions, validatePaleEmperorLifeState, validatePaleEmperorActivityCommand, hasPaleEmperorLifeLock, paleEmperorLifeLockedAtRevision, paleEmperorLifeMasteryGains } from './life.js';
import { createPaleEmperorEncounterState, applyPaleEmperorEncounterCommand, projectPaleEmperorEncounter, paleEmperorEncounterActions, validatePaleEmperorEncounterState, validatePaleEmperorEncounterCommand, hasPaleEmperorEncounterLock, paleEmperorEncounterCompletedBudget } from './encounter.js';
import { PALE_EMPEROR_ABILITIES, PALE_EMPEROR_INHERITED_ABILITIES, PALE_EMPEROR_BOTTLE_IDS, PALE_EMPEROR_FORMULA_STATUS, PALE_EMPEROR_LABOUR_STEPS, PALE_EMPEROR_LABOUR_TASKS, PALE_EMPEROR_MIN_DEATH_CONSUL_WEEKS, PALE_EMPEROR_POTION_SOURCES, PALE_EMPEROR_PREPARATIONS, paleEmperorPrices, paleEmperorSourceLabel, paleEmperorPotionSource, paleEmperorConsumptionRisk, PALE_EMPEROR_SOURCE_STATUS } from './content.js';
import { PALE_EMPEROR_ABILITY_IDS, PALE_EMPEROR_PREPARATION_IDS, PALE_EMPEROR_SOURCE_KEYS, type PaleEmperorEraEvent, type PaleEmperorSourceEra, type PaleEmperorOriginals, type PaleEmperorSourceHistory, type PaleEmperorAcquisitionBudget, type PaleEmperorAcquisitionEvent, type PaleEmperorAcquisitionCommand, type PaleEmperorAction, type PaleEmperorBottle, type PaleEmperorCommand, type PaleEmperorProjection, type PaleEmperorState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const PALE_EMPEROR_INHERITED_ABILITY_IDS = [...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS, ...SPIRITMEDIUM_ABILITY_IDS, ...SPIRIT_GUIDE_ABILITY_IDS, ...GATEKEEPER_ABILITY_IDS, ...UNDYING_ABILITY_IDS, ...FERRYMAN_ABILITY_IDS, ...DEATH_CONSUL_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = PALE_EMPEROR_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): PaleEmperorBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createPaleEmperorState(): PaleEmperorState {
  return { guidanceKnown: false, sourceEra: null, sourceWeek: null, bottles: PALE_EMPEROR_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, deathConsulActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], eraJournal: [], sourceHistory: null, sourceScene: null, life: createPaleEmperorLifeState(), encounter: createPaleEmperorEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isPaleEmperor = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 1;
export const isPaleEmperorAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 2;
export const hasPaleEmperorHistory = (s: SliceState) => isPaleEmperor(s) && s.paleEmperor.promotionWeek !== null;
/** Source stages retain their real purchase, brewing and ritual shapes. Detailed
 * predecessor validators run on the frozen S2 source, never an invented history. */
function sourceHistory(s: SliceState): boolean {
  if (!s.corpsecollector.discovered || !s.corpsecollector.guidanceKnown || !integer(s.progression.promotionWeek, 1, s.week)) return false;
  const channel = activeFerrymanChannel(s), era = currentDeathConsulSourceEra(s), provider = FERRYMAN_PROVIDERS[era];
  if (!channel || channel.id !== era || channel.provider.id !== provider.id || channel.provider.name !== provider.name ||
    channel.provider.ageAtIntroduction !== provider.ageAtIntroduction || s.ferryman.channels.filter(c => c.agreementClosedDate === null).length !== 1 ||
    !s.deathConsul.guidanceKnown || s.deathConsul.sourceEra !== era || !integer(s.deathConsul.promotionWeek, 1, s.week)) return false;
  // Each predecessor's own validator checks its actual purchase, ritual and channel shape.
  const promotion = s.deathConsul.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  return promotion.length === 1 && promotion[0]!.consumedWeek === s.deathConsul.promotionWeek &&
    s.gravedigger.corpsecollectorActingAtPromotion === 100 && s.spiritmedium.gravediggerActingAtPromotion === 100 &&
    s.spiritGuide.spiritmediumActingAtPromotion === 100 && s.gatekeeper.spiritGuideActingAtPromotion === 100 &&
    s.undying.gatekeeperActingAtPromotion === 100 && s.ferryman.undyingActingAtPromotion === 100 && s.deathConsul.ferrymanActingAtPromotion === 100;
}
export function paleEmperorSourceHistory(s: SliceState): PaleEmperorSourceHistory {
  return Object.fromEntries(PALE_EMPEROR_SOURCE_KEYS.map(key => [key, structuredClone(s[key])])) as PaleEmperorSourceHistory;
}
function sourceHistoryDigest(s: SliceState): string {
  return sha256Hex(stableStringify(s.paleEmperor.sourceHistory ?? paleEmperorSourceHistory(s)));
}
function sourceIdentityDigest(s: SliceState): string {
  const { coreStats: _stats, ...identity } = s.character;
  return sha256Hex(stableStringify(identity));
}
const knownChannel = (s: SliceState) => (isPaleEmperorAcquisitionStage(s) || isPaleEmperor(s)) && sourceHistory(s);
/** Once guidance freezes the source, old commands close and completed records stay exact. */
export function hasPaleEmperorOldPractice(s: SliceState): boolean {
  return hasDeathConsulOldSceneLock(s) || hasDeathConsulLock(s);
}
const deathConsulReportsComplete = (s: SliceState) => s.deathConsul.life.reflected &&
  Object.keys(s.deathConsul.life.cases).length === 3 && Object.values(s.deathConsul.life.cases).every(c =>
    c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.attempts.length > 0 && c.attempts.every(attempt => attempt.week <= s.week) &&
    c.attempts.at(-1)!.closed && c.attempts.at(-1)!.inspected && c.attempts.at(-1)!.siteAtClose?.playerLocation === 'ENTRY' && c.attempts.at(-1)!.siteAtClose?.effect.mode === 'OFF');
export const paleEmperorOriginals = (s: SliceState): PaleEmperorOriginals => structuredClone(s.deathConsul.life.site);
export const hasPaleEmperorOldSceneLock = hasPaleEmperorOldPractice;
export const hasPaleEmperorRitualLock = (s: SliceState): boolean => s.paleEmperor.preparedWeek !== null;
export const hasPaleEmperorLock = (s: SliceState): boolean => hasPaleEmperorRitualLock(s) || hasPaleEmperorLifeLock(s) || hasPaleEmperorEncounterLock(s);
const bottleNumber = (b: Pick<PaleEmperorBottle, 'id'>) => Number(b.id.slice('pale-emperor-potion-'.length));
const sourceEraFor = (s: SliceState): PaleEmperorSourceEra => s.paleEmperor.sourceEra ?? currentDeathConsulSourceEra(s);
const potionPrice = (s: SliceState, b: PaleEmperorBottle) => { const p = paleEmperorPrices(sourceEraFor(s)); return p.potion - (b.labourSteps === PALE_EMPEROR_LABOUR_STEPS ? p.labourCredit : 0); };
const deathConsulWeeks = (s: SliceState) => Math.max(0, (s.paleEmperor.promotionWeek ?? s.week) - (s.deathConsul.promotionWeek ?? s.week));
const exhaustedSupply = (state: PaleEmperorState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (s: SliceState, number: number, week: number) => paleEmperorPotionSource(sourceEraFor(s), number, week);
const hasPreparations = (s: SliceState) => PALE_EMPEROR_PREPARATION_IDS.every(id => s.paleEmperor.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `死亡执政官魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.deathConsul.promotionWeek === null || deathConsulWeeks(s) < PALE_EMPEROR_MIN_DEATH_CONSUL_WEEKS) return `成为死亡执政官后已过${deathConsulWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!deathConsulReportsComplete(s)) return '先完成死亡执政官的三份实际报告与反思，并收好旧核验现场。';
  return hasPreparations(s) ? null : '先分别核对八阶原瓶与当前来源、残响的有限作用边界和普通返回路线；领取药瓶不能代做专业准备。';
}
export function validatePaleEmperorAcquisitionCommand(v: unknown): v is PaleEmperorAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && PALE_EMPEROR_PREPARATION_IDS.includes(v.taskId as typeof PALE_EMPEROR_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^pale-emperor-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isPaleEmperorAcquisitionCommand = validatePaleEmperorAcquisitionCommand;
export function validatePaleEmperorCommand(v: unknown): v is PaleEmperorCommand {
  return validatePaleEmperorAcquisitionCommand(v) || validatePaleEmperorActivityCommand(v) || validatePaleEmperorEncounterCommand(v);
}
export function paleEmperorAcquisitionBlock(s: SliceState, command: PaleEmperorAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: PaleEmperorAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validatePaleEmperorAcquisitionCommand(command)) return '苍白皇帝准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasPaleEmperorOldPractice(s)) || hasPaleEmperorLifeLock(s) || hasPaleEmperorEncounterLock(s)) return '先停止旧现场的接触和能力、归还原物，再沿普通路线离开；旧人物、伤势与实战后果继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德当前时代的独立交接处。';
  if (s.deathConsul.life.site.playerLocation !== 'ENTRY' || s.deathConsul.life.site.effect.mode !== 'OFF') return '先实际回到旧封存室入口并停止作用，再进行服药交接。';
  if (!knownChannel(s)) return '实际成为死亡执政官并保留当前时代真实指导渠道后，才能了解苍白皇帝之路。';
  if (!isPaleEmperorAcquisitionStage(s)) return '已经晋升苍白皇帝1，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '收尸人至死亡执政官的17项掌握记录不完整，暂不能继续晋升。';
  const state = s.paleEmperor, era = sourceEraFor(s), prices = paleEmperorPrices(era);
  if (state.guidanceKnown && (state.sourceEra !== currentDeathConsulSourceEra(s) || state.sourceWeek === null)) return '已登记渠道与当前真实时代不符。';
  if (era === 'POST_CYCLE' && s.ferryman.era.location !== 'RECEPTION') return '先沿普通道路实际回到当代接待处。';
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE' && !deathConsulReportsComplete(s)) return '先完成死亡执政官三份生活报告与反思，再核对这次晋升的既往记录。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < prices.guidance ? `本次专业指导需要${prices.guidance}便士。` : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的苍白皇帝原瓶。';
    return s.cash < prices.preparation ? `当次场地检查需要${prices.preparation}便士。` : null;
  }
  if (command.type === 'REQUEST_SUPPLY' && s.cash < prices.resupply) return `申请下一批需要${prices.resupply}便士实际费用。`;
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批苍白皇帝原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的苍白皇帝准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选苍白皇帝独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : `须另付1行动与${prices.preparation}便士完成本周当次场地检查；旧准备不能使用。`;
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= PALE_EMPEROR_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(s, bottle) ? `领取本瓶需要${potionPrice(s, bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: PaleEmperorAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.paleEmperor, era = sourceEraFor(s), prices = paleEmperorPrices(era);
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      state.sourceHistory = paleEmperorSourceHistory(s);
      state.sourceScene = { week: s.week, date: structuredClone(s.date), revision: s.revision, random: { ...s.random },
        budget: paleEmperorAcquisitionBudget(s), identityDigest: sourceIdentityDigest(s), historyDigest: sourceHistoryDigest(s),
        character: structuredClone(s.character), originals: paleEmperorOriginals(s), combatHistoryLength: s.combatHistory.length, combatHistoryDigest: sha256Hex(stableStringify(s.combatHistory)), city: 'BACKLUND' };
      s.actionsRemaining--; s.cash -= prices.guidance; state.guidanceKnown = true; state.sourceEra = era; state.sourceWeek = s.week;
      state.bottles.forEach((b, i) => { b.stockedWeek = s.week; b.source = paleEmperorPotionSource(era, i + 1, s.week); });
      ctx.note('听取苍白皇帝独立成品与专业准备指导', `花1行动、${prices.guidance}便士。${paleEmperorSourceLabel(era)}说明当前渠道记录。${PALE_EMPEROR_FORMULA_STATUS}${paleEmperorConsumptionRisk(era)}`); return;
    case 'PREPARE_TASK': {
      const task = PALE_EMPEROR_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= prices.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', `花1行动、${prices.preparation}便士，按三项真实专业准备检查本周场地。须另外确认饮用所选原瓶；退出不退款、不治疗。`); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', `0行动实际退出，未服原瓶保留，已用行动与${prices.preparation}便士不返。可以继续真实生活休养。`); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(PALE_EMPEROR_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶${prices.labourCredit}便士，余款${prices.labourBalance}便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(s, bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('苍白皇帝独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? `本瓶五项劳务抵${prices.labourCredit}便士。` : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; s.cash -= prices.resupply; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批苍白皇帝成品', `原瓶全部失败耗尽，花1行动与${prices.resupply}便士核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < PALE_EMPEROR_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`pale-emperor-potion-${number}`, deliverySource(s, number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶苍白皇帝原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶${prices.potion}便士或对应五项劳动后${prices.labourBalance}便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.deathConsulActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 1; s.progression.acting = 0;
        if (!s.seer.completedSources.includes('death-s1')) s.seer.completedSources.push('death-s1');
        initializePaleEmperorLifeState(s);
        for (const id of PALE_EMPEROR_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为苍白皇帝', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；死亡执政官消化100与原17项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满。性别、姓名、年龄、性格与取向不改写。旧伤、原人及受托物、过去八阶的原瓶、劳务与实际结果全部留存。旧人物的死亡、伤势和离场不重开；原封存罐、门、灼痕与耗尽封材保留，里德与薇拉原精力不会恢复。历史欧文不成为当前敌人，诺兰的原伤势不消失；晋升不治疗本人或旧人，也不重开六十年周期。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '苍白皇帝魔药严重排异' : '苍白皇帝魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为死亡执政官，旧消化、掌握、服药前性别、身体伤势与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、${prices.preparation}便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
export function paleEmperorAcquisitionBudget(s: SliceState): PaleEmperorAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, era: structuredClone(s.ferryman.era) };
}
function acquisitionState(state: PaleEmperorState) {
  return { guidanceKnown: state.guidanceKnown, sourceEra: state.sourceEra, sourceWeek: state.sourceWeek, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, deathConsulActingAtPromotion: state.deathConsulActingAtPromotion, sourceHistory: state.sourceHistory, sourceScene: state.sourceScene,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyPaleEmperorAcquisition(s: SliceState, command: PaleEmperorAcquisitionCommand, ctx: SeerContext): void {
  const reason = paleEmperorAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const cursorBefore = s.random.cursor, before = paleEmperorAcquisitionBudget(s), actor: PaleEmperorAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, age: s.character.age, sourceIdentityDigest: sourceIdentityDigest(s), sourceHistoryDigest: ['LEARN_GUIDANCE', 'CONSUME'].includes(command.type) ? sourceHistoryDigest(s) : null, pathwayId: 'death',
    deathConsulPromotionWeek: s.deathConsul.promotionWeek!, corpsecollectorPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.paleEmperor.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: paleEmperorAcquisitionBudget(s), cursorBefore, cursorAfter: s.random.cursor, randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is PaleEmperorAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk', 'era']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    !['MALE', 'FEMALE'].includes(String(v.gender)) || (v.sequence !== 2 && v.sequence !== 1) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 1 ? PALE_EMPEROR_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk) || !record(v.era) || !shape(v.era, Object.keys(createFerrymanEraState()))) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validatePaleEmperorAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.paleEmperor.acquisitionJournal, expected = createPaleEmperorState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    let previous: PaleEmperorAcquisitionEvent | null = null, nextCursor = s.paleEmperor.sourceScene?.random.cursor ?? 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.deathConsul.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validatePaleEmperorAcquisitionCommand(raw.command) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 2 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'deathConsulPromotionWeek', 'corpsecollectorPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== raw.before.gender || raw.actor.age !== s.character.age ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || raw.actor.sourceIdentityDigest !== sourceIdentityDigest(s) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'death' || raw.actor.deathConsulPromotionWeek !== s.deathConsul.promotionWeek || raw.actor.corpsecollectorPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as PaleEmperorAcquisitionEvent;
      if (!integer(event.cursorBefore, nextCursor, s.random.cursor) || event.cursorAfter !== event.cursorBefore + (event.command.type === 'CONSUME' ? 1 : 0) || !integer(event.cursorAfter, 0, s.random.cursor) ||
        (event.command.type === 'CONSUME' && (event.randomBefore !== event.cursorBefore || event.randomAfter !== event.cursorAfter))) return false;
      if (event.actor.sourceHistoryDigest !== null && event.actor.sourceHistoryDigest !== sourceHistoryDigest(s)) return false;
      if (event.after.gender !== event.before.gender) return false;
      if ([...event.before.injuries, ...event.after.injuries].some(injury => injury.acquiredRevision > event.revision || injury.treatedRevision !== null && injury.treatedRevision > event.revision)) return false;
      if (previous) {
        if (event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || event.revision <= previous.revision || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id] !== previous!.after.mastery[id]) ||
          !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
        // A prepared site forbids intervening work or recovery; cancellation and drinking consume this exact budget.
        if (expected.preparedWeek !== null && (event.week !== previous.week || !same(event.date, previous.date) || !same(event.before, previous.after))) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && (!same(event.before, previous.after) || event.cursorBefore !== previous.cursorAfter)) return false;
        if (s.paleEmperor.sourceEra === 'POST_CYCLE' && !paleEmperorEraGapMatches(s, previous.after, { sourceEra: 'POST_CYCLE', era: previous.after.era }, previous.week, previous.date, previous.revision, event.revision, previous.cursorAfter, event.before, { sourceEra: 'POST_CYCLE', era: event.before.era }, event.week, event.date, event.cursorBefore)) return false;
      }
      const b = event.before;
      const shadow: SliceState = { ...s, ...(s.paleEmperor.sourceHistory ? structuredClone(s.paleEmperor.sourceHistory) : {}), status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, combatHistory: s.combatHistory.slice(0, s.paleEmperor.sourceScene?.combatHistoryLength ?? s.combatHistory.length), activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.cursorBefore },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        ferryman: { ...structuredClone(s.paleEmperor.sourceHistory?.ferryman ?? s.ferryman), era: structuredClone(b.era) },
        progression: { ...s.progression, pathwayId: 'death', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, paleEmperor: expected };
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
      if (!same(paleEmperorAcquisitionBudget(shadow), event.after)) return false;
      if (event.command.type === 'CONSUME' ? checks !== 1 : checks !== 0 || event.check !== null || event.randomBefore !== null || event.randomAfter !== null) return false;
      nextCursor = event.cursorAfter; previous = event;
    }
    if (!same(acquisitionState(expected), acquisitionState(s.paleEmperor))) return false;
    if (previous) {
      if (s.character.gender !== previous.after.gender) return false;
      // No post-guidance source-stage command may manufacture growth on the inherited skills.
      if (INHERITED_ABILITY_IDS.some(id => isPaleEmperor(s) ? !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500) : s.progression.mastery[id] !== previous!.after.mastery[id]) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.paleEmperor.preparedWeek !== null && (!same(paleEmperorAcquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && s.week === previous.week && previous.after.actions > 0 &&
        (!same(s.date, previous.date) || !same(paleEmperorAcquisitionBudget(s), previous.after) || s.random.cursor !== previous.cursorAfter)) return false;
      if (isPaleEmperorAcquisitionStage(s) && s.paleEmperor.sourceEra === 'POST_CYCLE' && !paleEmperorEraGapMatches(s, previous.after, { sourceEra: 'POST_CYCLE', era: previous.after.era }, previous.week, previous.date, previous.revision, s.revision, previous.cursorAfter, paleEmperorAcquisitionBudget(s), { sourceEra: 'POST_CYCLE', era: s.ferryman.era }, s.week, s.date, s.random.cursor)) return false;
      if (isPaleEmperor(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 1 || previous.after.acting !== 0 ||
        !PALE_EMPEROR_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.paleEmperor.deathConsulActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.paleEmperor.guidanceKnown || isPaleEmperor(s)) return false;
    return true;
  } catch { return false; }
}

export function applyPaleEmperorCommand(s: SliceState, command: PaleEmperorCommand, ctx: SeerContext): void {
  if (!validatePaleEmperorCommand(command)) throw new Error('苍白皇帝命令无效。');
  if (validatePaleEmperorAcquisitionCommand(command)) return applyPaleEmperorAcquisition(s, command, ctx);
  if (validatePaleEmperorActivityCommand(command)) return applyPaleEmperorLifeCommand(s, command, ctx);
  if (validatePaleEmperorEncounterCommand(command)) return applyPaleEmperorEncounterCommand(s, command, ctx);
  throw new Error('未知苍白皇帝命令。');
}

/** Acquisition actions remain separate so the panel can compose actual life
 * and encounter actions without duplicating the potion protocol. */
export function paleEmperorAcquisitionActions(s: SliceState): PaleEmperorAction[] {
  if (!knownChannel(s) || isPaleEmperor(s)) return [];
  const state = s.paleEmperor, prices = paleEmperorPrices(sourceEraFor(s)), actions: PaleEmperorAction[] = [];
  const add = (id: string, label: string, cost: string, command: PaleEmperorAcquisitionCommand) => {
    const reason = paleEmperorAcquisitionBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason, ...(['LEAVE_PREPARATION'].includes(command.type) ? { cleanup: true } : {}) });
  };
  if (!state.guidanceKnown) add('learn-pale-emperor-guidance', '听取苍白皇帝成品与专业准备指导', `1行动 · ${prices.guidance}便士`, { type: 'LEARN_GUIDANCE' });
  else {
    for (const task of PALE_EMPEROR_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`pale-emperor-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
    if (state.preparedWeek === null) add('prepare-pale-emperor-promotion', '实际检查本次服药场地', `1行动 · ${prices.preparation}便士 · 仅本周有效`, { type: 'PREPARE_PROMOTION' });
    else add('leave-pale-emperor-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
    if (state.resupply.requestedWeek !== null) add('receive-pale-emperor-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
    else if (exhaustedSupply(state)) add('request-pale-emperor-supply', '申请下一批独立苍白皇帝成品', `1行动 · ${prices.resupply}便士 · 下一真实周起收货`, { type: 'REQUEST_SUPPLY' });
    for (const bottle of state.bottles) {
      if (bottle.status === 'SUPPLIER') {
        if (bottle.labourSteps < PALE_EMPEROR_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${PALE_EMPEROR_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵${prices.labourCredit}便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶苍白皇帝魔药`, `0行动 · ${potionPrice(s, bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
      } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶苍白皇帝魔药`, `0行动 · 死亡执政官消化${s.progression.acting}/100 · ${deathConsulWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  return actions;
}
function preferredPaleEmperorAction(s: SliceState, actions: PaleEmperorAction[]): PaleEmperorAction | undefined {
  const enabled = actions.filter(action => action.enabled), life = projectPaleEmperorLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.preferredAction) ?? enabled.find(action => action.id === preferredId) ??
    enabled.find(action => !action.cleanup && !['LEAVE_PREPARATION', 'RETURN_HOME', 'LEAVE_ENCOUNTER', 'ABORT'].includes(action.command.type)) ?? enabled[0];
}
export function projectPaleEmperor(s: SliceState): PaleEmperorProjection {
  const state = s.paleEmperor, available = knownChannel(s), promoted = isPaleEmperor(s), era = sourceEraFor(s), prices = paleEmperorPrices(era);
  const actions = available ? [...paleEmperorAcquisitionActions(s), ...paleEmperorLifeActions(s), ...paleEmperorEncounterActions(s)] : [];
  const preferred = preferredPaleEmperorAction(s, actions), chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '苍白皇帝·死神序列1', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    sourceEra: state.sourceEra, sourceLabel: available ? paleEmperorSourceLabel(era) : '', prices: available ? prices : null,
    formulaKnown: false, formula: [], ...(available ? { story: `${PALE_EMPEROR_FORMULA_STATUS}${PALE_EMPEROR_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶${prices.potion}便士，或为本瓶完成五项真实劳动后支付${prices.labourBalance}便士；全部失败耗尽后才能申请下一批，跨真实周收货并逐瓶另行取得。` : '',
    actions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : actions.find(a => a.reason)?.reason ?? (promoted ? '已完成记录保留，可以继续正常生活。' : '先完成死亡执政官的实际经历。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 苍白皇帝成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周当次场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为死亡执政官' : '排异，仍为死亡执政官'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? PALE_EMPEROR_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...PALE_EMPEROR_INHERITED_ABILITIES, ...PALE_EMPEROR_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `死亡执政官消化${state.deathConsulActingAtPromotion}/100留存；苍白皇帝扮演${s.progression.acting}/100。三份生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。` : available ? `死亡执政官需消化100（当前${s.progression.acting}/100）、晋2后12整周（当前${deathConsulWeeks(s)}/12），完成三份旧报告与反思；另须三项专业准备和当周场地检查。` : '先完成死亡执政官的实际经历。',
    pollution: s.seer.pollution, risk: available ? paleEmperorConsumptionRisk(era) : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    characterName: s.character.name, currentGender: s.character.gender, originalGender: state.acquisitionJournal[0]?.before.gender ?? s.character.gender,
    appearanceRecord: available ? `${s.character.name}，原创建年龄${s.character.age}岁；当前${s.character.gender === 'FEMALE' ? '女性' : '男性'}。晋升不改变性别、姓名、年龄、性格与取向，旧伤仍须正常休养。` : '',
    injuries: available ? s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })) : [], injuryRisk: s.injuryRisk,
    inheritedTools: available ? '八阶原瓶、原记忆册与原回信保留。旧中转室、旧双室封存罐及其门、灼痕、耗尽封材和原人物位置均为历史；新附馆不复制或搬来旧物。' : '',
    inheritedHistory: available ? [
      `死亡执政官在第${s.deathConsul.promotionWeek}周实际晋升；${promoted ? `原消化${state.deathConsulActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从这次晋升计算。`,
      '前八阶17项掌握保持原值，原零项不补齐；成功晋升只增加两项零掌握。',
      `旧封存罐强度${s.deathConsul.life.site.residual.strength}、灼痕${s.deathConsul.life.site.residual.scorch}；薇拉原精力${s.deathConsul.life.site.operatorEnergy}，原门操作${s.deathConsul.life.site.door.operations}次。`,
      '一次真实六十年周期与有限记忆寻回保留；旧欧文在本支历史中未参战，不能据历史可用状态重开当前遭遇。灰羽已释放，旧许可不代表当前联系。',
    ] : [],
    life: projectPaleEmperorLife(s), encounter: projectPaleEmperorEncounter(s), insideCase: hasPaleEmperorLock(s),
    environment: available ? PALE_EMPEROR_SOURCE_STATUS : '',
  };
}

/** Chronology is checked separately from deterministic per-command replay. */
export function validatePaleEmperorJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.paleEmperor.acquisitionJournal;
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
    type SharedBudget = Pick<PaleEmperorAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { week: number; date: PublicGameDate; revision: number; before: SharedBudget; after: SharedBudget; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null };
    const shared = (budget: SharedBudget): SharedBudget => ({ actions: budget.actions, health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash });
    const timeline: Timeline[] = events.map(event => ({ week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.cursorAfter }));
    const promotion = events.find(event => event.after.sequence === 1);
    for (const event of s.paleEmperor.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      timeline.push({ week: event.week, date: event.date, revision: event.revision, before: shared(event.before), after: shared(event.after),
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.randomAfter ?? event.randomCursor });
    }
    const encounter = s.paleEmperor.encounter, preparation = encounter.preparation;
    const reflection = s.paleEmperor.life.journal.find(event => event.command.type === 'REFLECT');
    if (preparation) {
      // Encounter receipts store resulting revisions; acquisition/life store input revisions.
      if (!promotion || !reflection || preparation.revision - 1 <= reflection.revision || preparation.week < reflection.week || compareGameDates(preparation.date, reflection.date) < 0) return false;
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
      (!same(s.date, tail.date) || !same(shared(paleEmperorAcquisitionBudget(s)), tail.after) || exactCursor !== null && exactCursor !== s.random.cursor)) return false;
    return true;
  } catch { return false; }
}


/** Freeze all eight predecessor roots. Only audited original-site movement,
 * operator effort and clock changes may differ from the genuine source. */
export function validatePaleEmperorSource(s: SliceState): boolean {
  try {
    const state = s.paleEmperor, history = state.sourceHistory, scene = state.sourceScene, first = state.acquisitionJournal[0];
    if (!history || !scene || !first || !shape(history, PALE_EMPEROR_SOURCE_KEYS) ||
      !shape(scene, ['week', 'date', 'revision', 'random', 'budget', 'identityDigest', 'historyDigest', 'character', 'originals', 'combatHistoryLength', 'combatHistoryDigest', 'city']) ||
      !shape(scene.random, ['seed', 'cursor']) || scene.random.seed !== s.random.seed || !integer(scene.random.cursor, 0, s.random.cursor) ||
      !integer(scene.combatHistoryLength, 0, s.combatHistory.length) || scene.combatHistoryDigest !== sha256Hex(stableStringify(s.combatHistory.slice(0, scene.combatHistoryLength))) ||
      scene.city !== 'BACKLUND' || scene.identityDigest !== sourceIdentityDigest(s) || scene.historyDigest !== sourceHistoryDigest(s) ||
      !validateDeathConsulSiteState(scene.originals) || scene.originals.playerLocation !== 'ENTRY' || scene.originals.effect.mode !== 'OFF' ||
      !same(scene.originals, paleEmperorOriginals({ ...s, ...history })) ||
      scene.character.gender !== scene.budget.gender || !same(scene.character.coreStats, scene.budget.coreStats) ||
      sourceIdentityDigest({ ...s, character: scene.character }) !== scene.identityDigest || first.command.type !== 'LEARN_GUIDANCE' ||
      scene.week !== first.week || scene.revision !== first.revision || !same(scene.date, first.date) ||
      !same(scene.budget, first.before) || scene.random.cursor !== first.cursorBefore || first.actor.sourceHistoryDigest !== scene.historyDigest) return false;
    const historical = paleEmperorInheritedView(s);
    if (![validateCorpsecollectorState, validateGravediggerState, validateSpiritmediumState, validateSpiritGuideState, validateGatekeeperState,
      validateUndyingState, validateFerrymanState, validateDeathConsulState, validateLongChapterState].every(validate => validate(historical))) return false;
    const current = paleEmperorSourceHistory(s);
    current.ferryman.era = structuredClone(history.ferryman.era);
    return same(current, history) && same(paleEmperorOriginals(s), scene.originals);

  } catch { return false; }
}

export const validatePaleEmperorInheritedState = validatePaleEmperorSource;
/** Historical validation reads the genuine paid-guidance S2 checkpoint. This
 * view never writes to the live state, and never invents predecessor actions. */
export function paleEmperorInheritedView(s: SliceState): SliceState {
  const { sourceHistory: history, sourceScene: scene } = s.paleEmperor;
  if ((!isPaleEmperor(s) && !isPaleEmperorAcquisitionStage(s)) || !s.paleEmperor.guidanceKnown || !history || !scene) return s;
  const budget = scene.budget;
  return { ...s, ...structuredClone(history), status: 'ACTIVE', week: scene.week, date: structuredClone(scene.date), revision: scene.revision,
    health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash, actionsRemaining: budget.actions,
    injuries: structuredClone(budget.injuries), injuryRisk: budget.injuryRisk, random: { ...scene.random },
    activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE', ending: null,
    world: { ...s.world, city: 'BACKLUND' }, character: structuredClone(scene.character),
    progression: { ...s.progression, pathwayId: 'death', sequence: 2, acting: budget.acting, mastery: { ...budget.mastery } },
    seer: { ...s.seer, pollution: budget.pollution, completedSources: [...budget.completedSources] },
    combatHistory: s.combatHistory.slice(0, scene.combatHistoryLength), paleEmperor: createPaleEmperorState() };
}

/** Capture an actual shared-era operation, never a second economy. Central
 * dispatch calls this in place of the existing reducer only after guidance. */
export function recordPaleEmperorEraCommand(s: SliceState, command: FerrymanEraCommand, ctx: SeerContext): void {
  if (!s.paleEmperor.guidanceKnown) { applyFerrymanEraCommand(s, command, ctx); return; }
  if (s.paleEmperor.sourceEra !== 'POST_CYCLE' || !s.paleEmperor.sourceScene) throw new Error('未登记当代来源，不能记录当代生活。');
  const before = paleEmperorAcquisitionBudget(s), week = s.week, date = structuredClone(s.date), revision = s.revision, randomCursor = s.random.cursor;
  applyFerrymanEraCommand(s, command, ctx);
  s.paleEmperor.eraJournal.push({ command: structuredClone(command), week, date, revision, randomCursor, before,
    after: paleEmperorAcquisitionBudget(s), afterWeek: s.week, afterDate: structuredClone(s.date) });
}
export const applyPaleEmperorEraCommand = recordPaleEmperorEraCommand;
export interface PaleEmperorEraFinance { sourceEra: PaleEmperorSourceEra | null; era: FerrymanEraState }
type EraGapBudget = Omit<PaleEmperorAcquisitionBudget, 'era'> & { era?: FerrymanEraState };
const withEra = (budget: EraGapBudget, finance: PaleEmperorEraFinance): PaleEmperorAcquisitionBudget => ({ ...structuredClone(budget), era: structuredClone(finance.era) });
function eraReplayState(s: SliceState, budget: PaleEmperorAcquisitionBudget, week: number, date: PublicGameDate, revision: number, cursor: number): SliceState {
  const history = s.paleEmperor.sourceHistory;
  if (!history) throw new Error('没有冻结来源。');
  return { ...s, ...structuredClone(history), status: 'ACTIVE', week, date: structuredClone(date), revision,
    health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash, actionsRemaining: budget.actions, weeklyBudget: 4,
    injuries: structuredClone(budget.injuries), injuryRisk: budget.injuryRisk, random: { seed: s.random.seed, cursor },
    activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE', ending: null,
    ferryman: { ...structuredClone(history.ferryman), era: structuredClone(budget.era) },
    character: { ...structuredClone(s.paleEmperor.sourceScene!.character), coreStats: { ...budget.coreStats } },
    progression: { ...s.progression, pathwayId: 'death', sequence: budget.sequence, acting: budget.acting, mastery: { ...budget.mastery } },
    seer: { ...s.seer, pollution: budget.pollution, completedSources: [...budget.completedSources] },
    paleEmperor: { ...s.paleEmperor, preparedWeek: null, life: createPaleEmperorLifeState(), encounter: createPaleEmperorEncounterState() } };
}
const eraReplayContext: SeerContext = { note() {}, roll() { throw new Error('普通当代生活没有随机来源。'); }, check() { throw new Error('普通当代生活没有随机检定。'); } };
/** Shared chronological gap matcher. Revisions are command INPUT revisions;
 * encounter output receipts must subtract one before calling. Only actual ERA
 * receipts between the endpoints may change a POST_CYCLE ordinary-life gap. */
export function paleEmperorEraGapMatches(s: SliceState, beforeBudget: EraGapBudget, finance: PaleEmperorEraFinance,
  week: number, date: PublicGameDate, fromRevision: number, toRevision: number, beforeCursor: number,
  afterBudget: EraGapBudget, afterFinance: PaleEmperorEraFinance, afterWeek: number, afterDate: PublicGameDate, afterCursor: number): boolean {
  try {
    if (finance.sourceEra !== 'POST_CYCLE' || afterFinance.sourceEra !== 'POST_CYCLE' || toRevision <= fromRevision || beforeCursor !== afterCursor) return false;
    const shadow = eraReplayState(s, withEra(beforeBudget, finance), week, date, fromRevision + 1, beforeCursor);
    for (const event of s.paleEmperor.eraJournal.filter(e => e.revision > fromRevision && e.revision < toRevision)) {
      if (event.week !== shadow.week || !same(event.date, shadow.date) || event.randomCursor !== shadow.random.cursor || !same(event.before, paleEmperorAcquisitionBudget(shadow))) return false;
      shadow.revision = event.revision;
      applyFerrymanEraCommand(shadow, event.command, eraReplayContext);
      if (event.afterWeek !== shadow.week || !same(event.afterDate, shadow.date) || !same(event.after, paleEmperorAcquisitionBudget(shadow))) return false;
    }
    return shadow.week === afterWeek && same(shadow.date, afterDate) && shadow.random.cursor === afterCursor && same(paleEmperorAcquisitionBudget(shadow), withEra(afterBudget, afterFinance));
  } catch { return false; }
}
interface EraBoundary { budget: EraGapBudget; finance: PaleEmperorEraFinance; week: number; date: PublicGameDate; revision: number; randomCursor: number }
function eraBoundaries(s: SliceState): EraBoundary[] {
  const p = s.paleEmperor, result: EraBoundary[] = p.acquisitionJournal.map(e => ({ budget: e.after, finance: { sourceEra: p.sourceEra, era: e.after.era }, week: e.week, date: e.date, revision: e.revision, randomCursor: e.cursorAfter }));
  for (const e of p.life.journal) result.push({ budget: e.after, finance: e.finance, week: e.week, date: e.date, revision: e.revision, randomCursor: e.randomAfter ?? e.randomCursor });
  if (p.encounter.preparation) { const e = p.encounter.preparation; result.push({ budget: e.after, finance: e.finance, week: e.week, date: e.date, revision: e.revision - 1, randomCursor: e.randomCursor }); }
  for (const e of p.encounter.journal) result.push({ budget: e.after, finance: e.finance, week: e.week, date: e.date, revision: e.revision - 1, randomCursor: e.randomCursor });
  const completed = paleEmperorEncounterCompletedBudget(s); if (completed) result.push(completed);
  return result.sort((a, b) => a.revision - b.revision);
}
export function validatePaleEmperorEraJournal(s: SliceState): boolean {
  try {
    const state = s.paleEmperor, scene = state.sourceScene, events = state.eraJournal;
    if (!Array.isArray(events) || events.length > 10000) return false;
    if (!state.guidanceKnown || state.sourceEra !== 'POST_CYCLE') return events.length === 0;
    if (!scene || !validateFerrymanEra(s)) return false;
    let era = scene.budget.era, lastRevision = scene.revision, lastWeek = scene.week, lastDate = scene.date, cursor = scene.random.cursor;
    const boundaries = eraBoundaries(s), completedEncounter = paleEmperorEncounterCompletedBudget(s);
    const occupiedRevisions = new Set([...state.acquisitionJournal.map(e => e.revision), ...state.life.journal.map(e => e.revision),
      ...(state.encounter.preparation ? [state.encounter.preparation.revision - 1] : []), ...state.encounter.journal.map(e => e.revision - 1)]);
    for (const raw of events) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'randomCursor', 'before', 'after', 'afterWeek', 'afterDate']) ||
        !validateFerrymanEraCommand(raw.command) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) ||
        !integer(raw.revision, lastRevision + 1, s.revision - 1) || occupiedRevisions.has(raw.revision) || !integer(raw.week, lastWeek, s.week) ||
        !integer(raw.afterWeek, raw.week, raw.week + 1) || !isValidGameDate(raw.date) || !isValidGameDate(raw.afterDate) ||
        compareGameDates(raw.date, lastDate) < 0 || !integer(raw.randomCursor, cursor, s.random.cursor) || !same(raw.before.era, era)) return false;
      const event = raw as unknown as PaleEmperorEraEvent;
      if (paleEmperorLifeLockedAtRevision(s, event.revision) || state.encounter.preparation &&
        event.revision > state.encounter.preparation.revision - 1 && (!completedEncounter || event.revision < completedEncounter.revision)) return false;
      const boundary = boundaries.filter(b => b.revision < event.revision).at(-1);
      if (!boundary || !paleEmperorEraGapMatches(s, boundary.budget, boundary.finance, boundary.week, boundary.date, boundary.revision, event.revision,
        boundary.randomCursor, event.before, { sourceEra: state.sourceEra, era: event.before.era }, event.week, event.date, event.randomCursor)) return false;

      const beforePromotion = state.promotionWeek === null || !state.acquisitionJournal.some(e => e.after.sequence === 1 && e.revision < event.revision);
      if (event.before.sequence !== (beforePromotion ? 2 : 1)) return false;
      const priorAcquisition = state.acquisitionJournal.filter(e => e.revision < event.revision).at(-1);
      if (!priorAcquisition || priorAcquisition.command.type === 'PREPARE_PROMOTION') return false;
      const shadow = eraReplayState(s, event.before, event.week, event.date, event.revision, event.randomCursor);
      if (!validateFerrymanEra(shadow)) return false;
      applyFerrymanEraCommand(shadow, event.command, eraReplayContext);
      if (!same(paleEmperorAcquisitionBudget(shadow), event.after) || event.afterWeek !== shadow.week || !same(event.afterDate, shadow.date) || shadow.random.cursor !== event.randomCursor || !validateFerrymanEra(shadow)) return false;
      era = event.after.era; lastRevision = event.revision; lastWeek = event.afterWeek; lastDate = event.afterDate; cursor = event.randomCursor;
    }
    if (!same(s.ferryman.era, era) || s.week !== lastWeek || !same(s.date, lastDate)) return false;
    const boundary = boundaries.at(-1);
    if (boundary && !s.combat && s.health > 0 && !paleEmperorEraGapMatches(s, boundary.budget, boundary.finance, boundary.week, boundary.date,
      boundary.revision, s.revision, boundary.randomCursor, paleEmperorAcquisitionBudget(s), { sourceEra: state.sourceEra, era: s.ferryman.era }, s.week, s.date, s.random.cursor)) return false;
    return true;
  } catch { return false; }
}
/** Current cash reconciles the original source and every paid receipt. Income
 * and ordinary expenses come solely from the already validated shared era. */
export function validatePaleEmperorFinancialContinuity(s: SliceState): boolean {
  try {
    const p = s.paleEmperor, source = p.sourceScene;
    if (!p.guidanceKnown || p.sourceEra !== 'POST_CYCLE') return true;
    if (!source) return false;
    let cash = source.budget.cash + s.ferryman.era.income - source.budget.era.income - (s.ferryman.era.expenses - source.budget.era.expenses);
    for (const e of p.acquisitionJournal) cash += e.after.cash - e.before.cash;
    for (const e of p.life.journal) cash += e.after.cash - e.before.cash;
    if (p.encounter.preparation) cash += p.encounter.preparation.after.cash - p.encounter.preparation.before.cash;
    for (const e of p.encounter.journal) cash += e.after.cash - e.before.cash;
    return s.cash === cash;
  } catch { return false; }
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validatePaleEmperorState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.paleEmperor;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'sourceEra', 'sourceWeek', 'bottles', 'resupply', 'promotionWeek', 'deathConsulActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'eraJournal', 'sourceHistory', 'sourceScene', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== PALE_EMPEROR_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal) || !Array.isArray(raw.eraJournal)) return false;
  const state = raw as unknown as PaleEmperorState, promoted = isPaleEmperor(s), acquisitionStage = isPaleEmperorAcquisitionStage(s);
  const firstWeek = s.deathConsul.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + PALE_EMPEROR_MIN_DEATH_CONSUL_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !validatePaleEmperorSource(s))) return false;
  if (state.guidanceKnown && (state.sourceEra !== currentDeathConsulSourceEra(s) || !integer(state.sourceWeek, firstWeek, lastAcquisitionWeek))) return false;
  if (!state.guidanceKnown && (state.sourceHistory !== null || state.sourceScene !== null || state.sourceEra !== null || state.sourceWeek !== null || state.eraJournal.length > 0)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > PALE_EMPEROR_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !PALE_EMPEROR_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasPaleEmperorOldPractice(s) || hasPaleEmperorLifeLock(s) || hasPaleEmperorEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.deathConsul.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.deathConsulActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !deathConsulReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...PALE_EMPEROR_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.deathConsulActingAtPromotion !== null || PALE_EMPEROR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `pale-emperor-potion-${index + 1}` || !integer(b.labourSteps, 0, PALE_EMPEROR_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < PALE_EMPEROR_BOTTLE_IDS.length) {
      if (state.guidanceKnown ? b.stockedWeek !== state.sourceWeek || b.source !== paleEmperorPotionSource(state.sourceEra!, index + 1, state.sourceWeek!) : b.stockedWeek !== null || b.source !== PALE_EMPEROR_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(s, index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % PALE_EMPEROR_BOTTLE_IDS.length;
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
        if (!integer(s.deathConsul.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validatePaleEmperorAcquisitionJournal(s) || !validatePaleEmperorJournalContinuity(s) || !validatePaleEmperorEraJournal(s) || !validatePaleEmperorFinancialContinuity(s) || !validatePaleEmperorLifeState(s) || !validatePaleEmperorEncounterState(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting || !s.seer.completedSources.includes('death-s1')) return false;
    const promotedReceipt = state.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
    if (!promotedReceipt) return false;
    const expectedMastery = { ...promotedReceipt.after.mastery };
    for (const [id, gain] of Object.entries(paleEmperorLifeMasteryGains(s))) {
      if (!PALE_EMPEROR_ABILITY_IDS.includes(id as typeof PALE_EMPEROR_ABILITY_IDS[number]) || !integer(gain, 0, 24)) return false;
      expectedMastery[id] = Math.min(500, expectedMastery[id]! + gain);
    }
    for (const round of s.combatHistory) if (round.paleEmperorOutcome) {
      for (const action of [...round.paleEmperorOutcome.playerActions, ...round.paleEmperorOutcome.enemyActions]) {
        for (const id of action.masteryApplied) expectedMastery[id] = Math.min(500, expectedMastery[id]! + 8);
      }
    }
    if (!same(s.progression.mastery, expectedMastery)) return false;
  }
  if (!promoted && s.seer.completedSources.includes('death-s1')) return false;
  return true;
}
export { PALE_EMPEROR_ABILITIES } from './content.js';
export { PALE_EMPEROR_ABILITY_IDS } from './types.js';
export type * from './types.js';

export const handlePaleEmperor = applyPaleEmperorCommand;

/** Historical membership accepts the actual sequence-one record; current commands remain exact-stage gated. */
export const validatePaleEmperorHistory = validatePaleEmperorState;
