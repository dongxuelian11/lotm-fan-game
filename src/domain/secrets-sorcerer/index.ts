import {PLANESWALKER_ABILITY_IDS} from '../planeswalker/types.js';
import {WANDERER_ABILITY_IDS} from '../wanderer/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import { APPRENTICE_ABILITY_IDS } from '../apprentice/types.js';
import { TRICKMASTER_ABILITY_IDS } from '../trickmaster/types.js';
import { ASTROLOGER_ABILITY_IDS } from '../astrologer/types.js';
import { RECORDER_ABILITY_IDS } from '../recorder/types.js';
import { TRAVELER_ABILITY_IDS } from '../traveler/types.js';
import { travelerInside } from '../traveler/life.js';
import { recorderInside, recorderActions, applyRecorderActivity } from '../recorder/life.js';
import {
  createSecretsSorcererRitualState, currentSecretsSorcererAttempt, hasSecretsSorcererRitualLock,
  canConsumeSecretsSorcererRitual, markSecretsSorcererPotionConsumed, validateSecretsSorcererRitualState,
  validateSecretsSorcererRitualCommand, applySecretsSorcererRitualCommand, secretsSorcererRitualActions,
  secretsSorcererRitualCommandReason, projectSecretsSorcererRitual,
} from './ritual.js';
import {
  createSecretsSorcererLifeState, validateSecretsSorcererLife, projectSecretsSorcererLife, secretsSorcererLifeActions,
  hasSecretsSorcererLifeLock, validateSecretsSorcererActivityCommand, secretsSorcererActivityReason, applySecretsSorcererActivity,
} from './life.js';
import {
  SECRETS_SORCERER_ABILITIES, SECRETS_SORCERER_BOTTLE_IDS, SECRETS_SORCERER_CONSUMPTION_RISK, SECRETS_SORCERER_FORMULA_STATUS,
  SECRETS_SORCERER_GUIDE, SECRETS_SORCERER_LABOUR_STEPS, SECRETS_SORCERER_LABOUR_TASKS, SECRETS_SORCERER_MIN_TRAVELER_WEEKS,
  SECRETS_SORCERER_POTION_SOURCES, SECRETS_SORCERER_PRICES, SECRETS_SORCERER_RITUAL_SOURCE, SECRETS_SORCERER_SOURCE_STATUS,
} from './content.js';
import {
  SECRETS_SORCERER_ABILITY_IDS, type SecretsSorcererAcquisitionCommand, type SecretsSorcererAction, type SecretsSorcererBottle,
  type SecretsSorcererCommand, type SecretsSorcererProjection, type SecretsSorcererState, type SecretsSorcererRecordCommand,
} from './types.js';

const freshBottle = (id: string, source: string, stockedWeek: number | null): SecretsSorcererBottle => ({
  id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null, ritualAttemptId: null,
});
export function createSecretsSorcererState(): SecretsSorcererState {
  return {
    guidanceKnown: false, bottles: SECRETS_SORCERER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, travelerActingAtPromotion: null,
    ritual: createSecretsSorcererRitualState(), life: createSecretsSorcererLifeState(),
  };
}
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isSecretsSorcerer = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 4;
const hasSecretsSorcererHistory=(s:SliceState)=>s.progression.pathwayId==='door'&&[4,3,2].includes(s.progression.sequence!);
const isTraveler = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.apprentice.discovered && s.apprentice.guidanceKnown && s.trickmaster.formulaKnown
  && s.astrologer.guidanceKnown && s.recorder.guidanceKnown && s.traveler.guidanceKnown && s.traveler.promotionWeek !== null
  && (isTraveler(s) || hasSecretsSorcererHistory(s));
const bottleNumber = (bottle: Pick<SecretsSorcererBottle, 'id'>) => Number(bottle.id.slice('secrets-sorcerer-potion-'.length));
const potionPrice = (bottle: SecretsSorcererBottle) => SECRETS_SORCERER_PRICES.potion - (bottle.labourSteps === SECRETS_SORCERER_LABOUR_STEPS ? SECRETS_SORCERER_PRICES.labourCredit : 0);
const travelerWeeks = (s: SliceState) => Math.max(0, (s.secretsSorcerer.promotionWeek ?? s.week) - (s.traveler.promotionWeek ?? s.week));
const exhaustedSupply = (state: SecretsSorcererState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SECRETS_SORCERER_GUIDE}联系持照档案渠道的本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实际入库；独立封存的序列4秘法师原瓶secrets-sorcerer-potion-${number}，非学徒至旅行家旧瓶改装。完整配方仍未知，不附送敌体、已完成封印或借用封框。`;
export const hasSecretsSorcererOldPractice = (s: SliceState) => travelerInside(s) || s.traveler.practice.consent || recorderInside(s)
  || Object.values(s.apprentice.cases).some(scene => scene.position === 'INSIDE')
  || [s.apprentice.cases, s.trickmaster.cases, s.astrologer.cases, s.recorder.cases, s.traveler.cases].some(cases => Object.values(cases).some(scene => scene.status === 'PREPARED'));
function promotionReadiness(s: SliceState): string | null {
  if (s.progression.acting !== 100) return `旅行家尚未完全消化，当前扮演${s.progression.acting}/100。`;
  if (s.traveler.promotionWeek === null || travelerWeeks(s) < SECRETS_SORCERER_MIN_TRAVELER_WEEKS) return `成为旅行家后已度过${travelerWeeks(s)}/12整周。`;
  return s.health <= 20 || s.mind <= 40 ? '秘法师指导与饮药前须健康>20且精神>40；可以退出当前现场后正常休养。' : null;
}
export function secretsSorcererAcquisitionBlock(s: SliceState, command: SecretsSorcererAcquisitionCommand): string | null {
  const state = s.secretsSorcerer, ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasSecretsSorcererOldPractice(s) || hasSecretsSorcererLifeLock(s)) return '先从旧门途径原现场实际返回、归还原物并结束同伴同意，或结束当前秘法师实践。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '须实际返回贝克兰德的原教学室与持照档案渠道。';
  if (!knownChannel(s)) return '先成为旅行家并保有诺拉·维恩的原指导渠道。';
  if (isSecretsSorcerer(s)) return '已经完成秘法师晋升，不能重复准备或服药；未用原瓶保留。';
  if (hasSecretsSorcererRitualLock(s) && command.type !== 'CONSUME') return '你仍在本次原石拱现场；可独立确认服药，或0行动沿原地面出口离开并交还同一原框。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (state.guidanceKnown) return '已经听过秘法师原瓶来源、真实敌对半神封印要求与四档风险。';
    return promotionReadiness(s) ?? (s.cash < SECRETS_SORCERER_PRICES.guidance ? '本次指导需要520便士。' : null);
  }
  if (!state.guidanceKnown) return '先听诺拉·维恩说明独立原瓶、本人封印与实际战斗风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (state.resupply.requestedWeek !== null) return '已申请后续三瓶，须等下一真实周实际到货。';
    return exhaustedSupply(state) ? null : '现有全部原瓶须真实耗尽且失败，才能申请后续供给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (state.resupply.requestedWeek === null) return '尚未申请后续秘法师原瓶。';
    if (s.week <= state.resupply.requestedWeek) return '下一真实周起才能实际接收后续原瓶。';
    return exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = state.bottles.find(item => item.id === command.bottleId);
  if (!bottle) return '所选秘法师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '须独立确认本次饮用这瓶原魔药；开战确认不能替代。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未实际交付，或已经耗尽。';
    return promotionReadiness(s) ?? canConsumeSecretsSorcererRitual(s, bottle.id);
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已交付，不能重复购买或追溯抵扣劳动。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= SECRETS_SORCERER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}
function recordSampleReason(s: SliceState, command: SecretsSorcererRecordCommand): string | null {
  if (!isSecretsSorcerer(s)) return '先完成秘法师晋升；旅行家仍使用原亲见记录入口。';
  if (hasSecretsSorcererRitualLock(s) || hasSecretsSorcererLifeLock(s) || hasSecretsSorcererOldPractice(s)) return '先从当前现场实际退出并归还原物，再亲访原教师。';
  const action = recorderActions(s).find(action => action.command.type === 'RECORD' && action.command.sample === command.sample);
  return action ? action.reason : '原教师本次实际示范不可用。';
}
export function secretsSorcererCommandReason(s: SliceState, command: SecretsSorcererCommand): string | null {
  if (validateSecretsSorcererRecordCommand(command)) return recordSampleReason(s, command);
  if (validateSecretsSorcererAcquisitionCommand(command)) return secretsSorcererAcquisitionBlock(s, command);
  if (validateSecretsSorcererRitualCommand(command)) return secretsSorcererRitualCommandReason(s, command);
  if (validateSecretsSorcererActivityCommand(command)) return secretsSorcererActivityReason(s, command);
  return '秘法师命令无效。';
}

/** Only the working copy supplied by the shared atomic intent boundary is mutated. */
export function applySecretsSorcererAcquisition(s: SliceState, command: SecretsSorcererAcquisitionCommand, c: SeerContext): void {
  rule(validateSecretsSorcererAcquisitionCommand(command), '秘法师准备命令无效。');
  const blocked = secretsSorcererAcquisitionBlock(s, command); rule(blocked === null, blocked ?? '当前无法继续。');
  const state = s.secretsSorcerer;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1; s.cash -= SECRETS_SORCERER_PRICES.guidance; state.guidanceKnown = true;
      c.note('听取秘法师真实封印要求', `花1行动、520便士，向原导师${SECRETS_SORCERER_GUIDE}了解独立原瓶、敌对半神与四档风险。${SECRETS_SORCERER_FORMULA_STATUS}${SECRETS_SORCERER_RITUAL_SOURCE}`); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!;
      s.actionsRemaining -= 1; bottle.labourSteps += 1;
      c.note(SECRETS_SORCERER_LABOUR_TASKS[bottle.labourSteps - 1]!, `为第${bottleNumber(bottle)}原瓶实际完成一次对应劳务，花1行动，现为${bottle.labourSteps}/5。五次只抵本瓶5100便士，仍须支付1500便士；部分劳动不折现或转移。原瓶仍在供应方，不产生配方、封框或已经封印的敌体。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      c.note('秘法师独立原瓶实际交付', `支付${paid}便士、0行动，实际取得${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五次劳动抵5100便士，另付1500便士。' : '原价6600便士，未完成五次劳动不部分抵扣。'}没有附送已封印敌体、借用封框或完整配方；尚未服用。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1; state.resupply.requestedWeek = s.week;
      c.note('申请后三瓶秘法师成品', `现有全部原瓶已耗尽失败。花1行动核对原记录，最早第${s.week + 1}周实际到货三瓶；此刻没有新瓶。每瓶仍需6600便士或本瓶五次劳动后1500便士，旧原瓶、原敌体与封框历史不重置。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < SECRETS_SORCERER_BOTTLE_IDS.length; offset += 1) {
        const number = first + offset; state.bottles.push(freshBottle(`secrets-sorcerer-potion-${number}`, deliverySource(number, s.week), s.week));
      }
      state.resupply.deliveries += 1; state.resupply.requestedWeek = null;
      c.note('后续三瓶秘法师成品实际到货', `第${s.week}周，第${first}至${first + 2}独立原瓶实际入供应方库存，0行动，尚未付费交付。旧失败原瓶、真实战斗与封印、学徒至旅行家全部原记录和实际旅行历史保留。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!, attempt = currentSecretsSorcererAttempt(s);
      rule(attempt !== null, '缺少本次真实封印记录。');
      const result = c.check('will', 28);
      bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.outcome = result.tier; bottle.ritualAttemptId = attempt.id;
      markSecretsSorcererPotionConsumed(s, bottle.id);
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mindCost = result.tier === 'GREAT_SUCCESS' ? 4 : 8, spiritualityCost = result.tier === 'GREAT_SUCCESS' ? 0 : 15;
        s.mind = Math.max(1, s.mind - mindCost); s.spirituality = Math.max(0, s.spirituality - spiritualityCost);
        state.travelerActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 4; s.progression.acting = 0;
        for (const id of SECRETS_SORCERER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        c.note('在本人实际封印后成为秘法师', `${bottle.id}在本次原封印${attempt.id}内耗尽；意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mindCost}${spiritualityCost ? '、当前灵性−15' : ''}，四属性各+1；旅行家消化100与旧掌握保留，三项新掌握从0，灵性上限120但当前不补满，原身体性别不变。原敌体仍活着并封在同一原框中，你仍在现场，须0行动沿原地面出口实际离开并交还原框。全部原记录、教师资源、原坐标与实际往返保留，没有赠送高序列记录。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        c.note(severe ? '秘法师魔药严重排异' : '秘法师魔药排异', `${bottle.id}在本次原封印${attempt.id}内耗尽；意志${result.roll}/${result.chance}，健康−${healthCost}、精神−${mindCost}、排异+${pollution}。本作G照护仅让此次药物排异保底1，真实战斗不受此保护；仍为旅行家，消化100、身体、旧掌握与原记录完整保留。原敌体仍封在同一原框中，须0行动沿原地面出口实际离开并交还；可保持旅行家，或正常休养后于下一真实周用另一原目标、新借原框和另一原瓶重试，不能复用本次封印。`);
      }
      return;
    }
  }
}
export function applySecretsSorcererCommand(s: SliceState, command: SecretsSorcererCommand, c: SeerContext): void {
  rule(validateSecretsSorcererCommand(command), '秘法师命令无效。');
  if (validateSecretsSorcererRecordCommand(command)) {
    const reason = recordSampleReason(s, command); rule(reason === null, reason ?? '当前不能亲见记录。');
    return applyRecorderActivity(s, { type: 'RECORD', sample: command.sample }, c, (source, amount) => awardSeerMastery(s, source, amount, c));
  }
  if (validateSecretsSorcererAcquisitionCommand(command)) return applySecretsSorcererAcquisition(s, command, c);
  if (validateSecretsSorcererRitualCommand(command)) return applySecretsSorcererRitualCommand(s, command, c);
  if (validateSecretsSorcererActivityCommand(command)) return applySecretsSorcererActivity(s, command, c, (source, amount) => awardSeerMastery(s, source, amount, c));
}

export function projectSecretsSorcerer(s: SliceState): SecretsSorcererProjection {
  const state = s.secretsSorcerer, available = knownChannel(s), promoted = hasSecretsSorcererHistory(s), known = available && state.guidanceKnown, actions: SecretsSorcererAction[] = [];
  const add = (id: string, label: string, cost: string, command: SecretsSorcererAcquisitionCommand) => {
    const reason = secretsSorcererAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!known) add('learn-secrets-sorcerer-guidance', '了解秘法师成品与本人封印敌对半神的风险', '1行动 · 520便士', { type: 'LEARN_GUIDANCE' });
    else {
      if (state.resupply.requestedWeek !== null) add('receive-secrets-sorcerer-supply', '确认后三瓶成品实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周 · 尚须逐瓶付费`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-secrets-sorcerer-supply', '申请后三瓶独立成品', '1行动 · 下一真实周起到货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${SECRETS_SORCERER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5100便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶秘法师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 不附送已完成封印`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `本人实际封印后服用第${bottleNumber(bottle)}瓶`, `0行动 · 独立确认 · 旅行家${s.progression.acting}/100 · ${travelerWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  if (promoted) for (const action of recorderActions(s)) {
    if (action.command.type !== 'RECORD') continue;
    const command: SecretsSorcererRecordCommand = { type: 'RECORD_SAMPLE', sample: action.command.sample }, reason = recordSampleReason(s, command);
    actions.push({ id: `secrets-sorcerer-${action.id}`, label: action.label, cost: action.cost, command, reason, enabled: reason === null });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  return {
    title: promoted ? '秘法师 · 序列4' : '秘法师之路', discovered: available, guidanceKnown: known, promoted,
    formulaKnown: false, formula: [], actions: available ? [...actions, ...secretsSorcererRitualActions(s), ...secretsSorcererLifeActions(s)] : [],
    bottles: known ? state.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 独立秘法师成品`, source: `${bottle.source}${bottle.ritualAttemptId ? `第${bottle.consumedWeek}周在本人实际原封印${bottle.ritualAttemptId}后服用，本瓶耗尽，原敌体与封框保留。` : ''}`,
      status: bottle.status === 'SUPPLIER' ? '原供应方持有，未交付' : bottle.status === 'PLAYER' ? '你实际持有，尚未服用' : `原瓶已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，仍为旅行家' : '排异，仍为旅行家'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? SECRETS_SORCERER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: promoted ? ((s.progression.sequence===3||s.progression.sequence===2)?s.wanderer.secretsSorcererActingAtPromotion??100:s.progression.acting) : 0,
    digestion: s.progression.pathwayId==='door'&&(s.progression.sequence===3||s.progression.sequence===2)?'秘法师消化100与原封印、原门、原包和已保存记录保留；漫游者不重做旧扮演。':promoted ? `旅行家消化${state.travelerActingAtPromotion}/100与原掌握保留；秘法师扮演${s.progression.acting}/100。` : available ? `旅行家消化需100（当前${s.progression.acting}/100），晋升后满12整周（${travelerWeeks(s)}/12）；本人实际封印仍须完成，可选择保持旅行家。` : '先完成旅行家之路。',
    pollution: s.seer.pollution, risk: known ? SECRETS_SORCERER_CONSUMPTION_RISK : '先通过原导师了解秘法师成品来源与真实封印风险。',
    supplies: known ? `供应方持有${state.bottles.filter(bottle => bottle.status === 'SUPPLIER').length}瓶，你持有未用原瓶${state.bottles.filter(bottle => bottle.status === 'PLAYER').length}瓶。${state.resupply.requestedWeek === null ? `后续实际到货${state.resupply.deliveries}批。` : `第${state.resupply.requestedWeek}周申请，下一真实周起实际到货。`}完整配方仍未知；成品原瓶、原封框与本人真实战斗分别结算。` : '',
    ...(available ? { story: `${SECRETS_SORCERER_FORMULA_STATUS}${SECRETS_SORCERER_RITUAL_SOURCE}${SECRETS_SORCERER_SOURCE_STATUS}` } : {}),
    ritual: projectSecretsSorcererRitual(s), life: projectSecretsSorcererLife(s),
    insideCase: hasSecretsSorcererRitualLock(s) || hasSecretsSorcererLifeLock(s),
    environment: available ? '贝克兰德原教学室、独立原石拱SS4-ARCH-A/B/C与地面出口、原教学房SS4-ROOM及其唯一原门SS4-DOOR。原诺拉仍为序列8，原教师灵性、已记录能力与原米拉既往旅行事实不重置。' : '',
  };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateSecretsSorcererAcquisitionCommand(v: unknown): v is SecretsSorcererAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(String(v.type))) return shape(v, ['type']);
  if (typeof v.bottleId !== 'string' || !/^secrets-sorcerer-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isSecretsSorcererAcquisitionCommand = validateSecretsSorcererAcquisitionCommand;
export function validateSecretsSorcererRecordCommand(v: unknown): v is SecretsSorcererRecordCommand {
  return record(v) && v.type === 'RECORD_SAMPLE' && shape(v, ['type', 'sample']) && (v.sample === 'FLASH' || v.sample === 'COURAGE');
}
export function validateSecretsSorcererCommand(v: unknown): v is SecretsSorcererCommand {
  return validateSecretsSorcererRecordCommand(v) || validateSecretsSorcererAcquisitionCommand(v) || validateSecretsSorcererRitualCommand(v) || validateSecretsSorcererActivityCommand(v);
}
export function validateSecretsSorcererState(s: SliceState): boolean {
  try { return validateState(s); } catch { return false; }
}
function validateState(s: SliceState): boolean {
  const raw: unknown = s.secretsSorcerer;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'travelerActingAtPromotion', 'ritual', 'life']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.traveler) || !record(s.apprentice)) return false;
  const firstWeek = s.traveler.promotionWeek ?? s.week, earliestConsumption = firstWeek + SECRETS_SORCERER_MIN_TRAVELER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - earliestConsumption))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, earliestConsumption, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1)) return false;
  const state = raw as unknown as SecretsSorcererState, promoted = hasSecretsSorcererHistory(s), latestAcquisition = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || s.week < earliestConsumption)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.traveler.promotionWeek, 1, s.week) || !integer(state.promotionWeek, earliestConsumption, s.week) || state.travelerActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...APPRENTICE_ABILITY_IDS, ...TRICKMASTER_ABILITY_IDS, ...ASTROLOGER_ABILITY_IDS, ...RECORDER_ABILITY_IDS, ...TRAVELER_ABILITY_IDS, ...SECRETS_SORCERER_ABILITY_IDS,...((s.progression.sequence===3||s.progression.sequence===2)?WANDERER_ABILITY_IDS:[]),...(s.progression.sequence===2?PLANESWALKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.travelerActingAtPromotion !== null || SECRETS_SORCERER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome', 'ritualAttemptId']) || bottle.id !== `secrets-sorcerer-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  if (!validateSecretsSorcererRitualState(s) || !validateSecretsSorcererLife(s)) return false;
  let successes = 0;
  const usedAttempts = new Set<string>();
  for (const [index, bottle] of state.bottles.entries()) {
    if (index < 3) {
      if (bottle.stockedWeek !== null || bottle.source !== SECRETS_SORCERER_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(bottle.stockedWeek, earliestConsumption + 1, latestAcquisition) || bottle.source !== deliverySource(index + 1, bottle.stockedWeek)) return false;
      const start = Math.floor(index / 3) * 3;
      if (bottle.stockedWeek !== state.bottles[start]!.stockedWeek || state.bottles.slice(0, start).some(old => old.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(old.outcome ?? '') || !integer(old.consumedWeek, earliestConsumption, bottle.stockedWeek! - 1))) return false;
    }
    const stockWeek = bottle.stockedWeek ?? earliestConsumption;
    if (!state.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(bottle.acquiredWeek, stockWeek, latestAcquisition)) return false;
      if (bottle.status === 'PLAYER') { if (bottle.consumedWeek !== null || bottle.outcome !== null) return false; }
      else if (bottle.status === 'CONSUMED') {
        if (!integer(s.traveler.promotionWeek, 1, s.week) || !integer(bottle.consumedWeek, Math.max(earliestConsumption, bottle.acquiredWeek), latestAcquisition) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome ?? '')) return false;
        if (!promoted && s.progression.acting !== 100) return false;
        if (typeof bottle.ritualAttemptId !== 'string' || usedAttempts.has(bottle.ritualAttemptId)) return false;
        usedAttempts.add(bottle.ritualAttemptId);
        const attempt = state.ritual.attempts.find(item => item.id === bottle.ritualAttemptId);
        if (!attempt || attempt.mode !== 'RITUAL' || attempt.outcome !== 'SEALED' || attempt.bottleId !== bottle.id || attempt.consumedBottleId !== bottle.id || attempt.week !== bottle.consumedWeek || !attempt.captureEvidence || (attempt.closedWeek !== null && attempt.closedWeek !== bottle.consumedWeek)) return false;
      } else return false;
    }
    if (bottle.status !== 'CONSUMED' && bottle.ritualAttemptId !== null) return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') { successes += 1; if (bottle.consumedWeek !== state.promotionWeek) return false; }
  }
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0);
}

export { SECRETS_SORCERER_ABILITIES } from './content.js';
export * from './ritual.js';
export type * from './types.js';
