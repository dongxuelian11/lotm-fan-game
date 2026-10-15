import { ATTENDANT_MYSTERIES_ABILITY_IDS } from '../attendant-mysteries/types.js';
import {MIRACLE_WORKER_ABILITY_IDS} from '../miracle-worker/content.js';
import {ANCIENT_SCHOLAR_ABILITY_IDS} from '../ancient-scholar/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SEER_ABILITY_IDS } from '../seer/types.js';
import { CLOWN_ABILITY_IDS } from '../clown/types.js';
import { MAGICIAN_ABILITY_IDS } from '../magician/types.js';
import { FACELESS_ABILITY_IDS } from '../faceless/types.js';
import { MARIONETTIST_ABILITY_IDS } from '../marionettist/types.js';
import { marionettistInside } from '../marionettist/practice.js';
import {
  createBizarroRitualState, projectBizarroRitual, validateBizarroRitualState, validateBizarroRitualCommand,
  handleBizarroRitualCommand, canConsumeBizarroFinale, consumeBizarroFinale, hasBizarroRitualLock,
} from './ritual.js';
import {
  createBizarroLifeState, projectBizarroLife, validateBizarroLife, validateBizarroActivityCommand,
  bizarroInside, bizarroActions, BIZARRO_ENVIRONMENT,
} from './life.js';
import {
  BIZARRO_SORCERER_ABILITIES, BIZARRO_SORCERER_BATCH_IDS, BIZARRO_SORCERER_CONSUMPTION_RISK,
  BIZARRO_SORCERER_FORMULA, BIZARRO_SORCERER_FORMULA_SOURCE, BIZARRO_SORCERER_GUIDE,
  BIZARRO_SORCERER_MIN_MARIONETTIST_WEEKS, BIZARRO_SORCERER_PRICES, BIZARRO_SORCERER_LABOUR_STEPS,
  BIZARRO_SORCERER_LABOUR_TASKS, BIZARRO_SORCERER_SOURCE_STATUS, BIZARRO_SORCERER_RITUAL_SOURCE,
} from './content.js';
import {
  BIZARRO_SORCERER_ABILITY_IDS, type BizarroSorcererAcquisitionCommand, type BizarroSorcererAction,
  type BizarroSorcererBatch, type BizarroSorcererCommand, type BizarroSorcererProjection, type BizarroSorcererState,
} from './types.js';

function createBatch(number: number): BizarroSorcererBatch {
  const id = `bizarro-sorcerer-batch-${number}`;
  return { id, labourSteps: 0, acquired: false, brewed: false, materials: BIZARRO_SORCERER_FORMULA.map(material => ({
    id: `${id}:${material.id}`, name: material.name, quantity: material.supplyQuantity, unit: material.unit,
    source: `占卜俱乐部诡法师备料第${number}批`, holder: 'SUPPLIER',
  })) };
}
export function createBizarroSorcererState(): BizarroSorcererState {
  return { formulaKnown: false, resupply: { requestedWeek: null, deliveries: 0 },
    batches: BIZARRO_SORCERER_BATCH_IDS.map((_, index) => createBatch(index + 1)), bottles: [],
    promotionWeek: null, marionettistActingAtPromotion: null,
    ritual: createBizarroRitualState(), life: createBizarroLifeState(),
  };
}
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isBizarroSorcerer = (s: SliceState) => s.progression.pathwayId === 'diviner' && (s.progression.sequence === 4||(s.progression.sequence===3||s.progression.sequence===2));
const isMarionettist = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.seer.discovered && s.marionettist.formulaKnown && s.marionettist.promotionWeek !== null && (isMarionettist(s) || isBizarroSorcerer(s));
const materialPrice = (batch: BizarroSorcererBatch) => BIZARRO_SORCERER_PRICES.auxiliaryMaterials + (batch.labourSteps === BIZARRO_SORCERER_LABOUR_STEPS ? 0 : BIZARRO_SORCERER_PRICES.mainMaterials);
const bottleId = (batch: BizarroSorcererBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<BizarroSorcererBatch, 'id'>) => Number(batch.id.slice('bizarro-sorcerer-batch-'.length));
const marionettistWeeks = (s: SliceState) => Math.max(0, (s.bizarroSorcerer.promotionWeek ?? s.week) - (s.marionettist.promotionWeek ?? s.week));
const failedBatch = (state: BizarroSorcererState, batch: BizarroSorcererBatch) => batch.brewed && state.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (state: BizarroSorcererState) => state.batches.length >= 3 && state.bottles.length === state.batches.length && state.batches.every(batch => failedBatch(state, batch));

export function bizarroSorcererAcquisitionBlock(s: SliceState, command: BizarroSorcererAcquisitionCommand): string | null {
  const state = s.bizarroSorcerer;
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (marionettistInside(s) || Object.values(s.marionettist.cases).some(scene => scene.status === 'PREPARED') || bizarroInside(s)) return '先实际收束已有灵体之线、原秘偶或生活练习的接触。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (!knownChannel(s)) return '成为秘偶大师并保有原指导者渠道后，才能继续诡法师之路。';
  if (isBizarroSorcerer(s)) return '已经完成诡法师晋升，不能重复服药或继续准备这份魔药。';
  if (command.type !== 'CONSUME_FINALE') {
    if (['FIGHTING', 'FINALE', 'ASSEMBLED'].includes(state.ritual.phase)) return '先收束当前现场演出；谢幕只能服用本场原瓶或0行动退出。';
    if (s.world.city !== 'BACKLUND') return '先沿实际行程回到贝克兰德原占卜俱乐部。';
  }
  if (command.type === 'LEARN_FORMULA') {
    if (state.formulaKnown) return '已经掌握诡法师七料配方。';
    return s.cash < BIZARRO_SORCERER_PRICES.formula ? '诡法师配方指导需要500便士。' : null;
  }
  if (!state.formulaKnown) return '先完成诡法师配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (state.resupply.requestedWeek !== null) return '已经申请后续三批材料，请等下一真实周。';
    return exhaustedSupply(state) ? null : '现有各批须全部实际服用且失败；剩余原料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (state.resupply.requestedWeek === null) return '先向原指导者申请下一轮三批材料。';
    if (!exhaustedSupply(state)) return '仍有原料或未服原瓶，不能重复补给。';
    return s.week <= state.resupply.requestedWeek ? `最早第${state.resupply.requestedWeek + 1}周到货，必须跨过真实周末。` : null;
  }
  if (command.type === 'CONSUME_FINALE') {
    if (command.confirmed !== true) return '服用本场原瓶需要单独确认。';
    const bottle = state.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选诡法师原瓶不存在或已经耗尽。';
    if (s.progression.acting !== 100) return `秘偶大师魔药尚未完全消化，扮演${s.progression.acting}/100。`;
    if (s.marionettist.promotionWeek === null || marionettistWeeks(s) < BIZARRO_SORCERER_MIN_MARIONETTIST_WEEKS) return `成为秘偶大师后已度过${marionettistWeeks(s)}/12整周，尚不能服药。`;
    if (s.health <= 20 || s.mind <= 40) return '当前服药要求健康>20且精神>40；本次尾声可以0行动放弃，不能离场休养后补喝。';
    return canConsumeBizarroFinale(s, bottle.id) ? null : '只能在本人真实击杀原S4等价目标、实际见证与本人登场均成立的当前谢幕，服用开场携带的同一原瓶。旧尸体、幻象、未到场观众或已经关闭的演出都不能补用。';
  }
  if (!('batchId' in command)) return '未知诡法师备料事项。';
  const batch = state.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批诡法师材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣。';
    return batch.labourSteps >= BIZARRO_SORCERER_LABOUR_STEPS ? '这批五次实际劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '本批七料已经交付。';
    return s.cash < materialPrice(batch) ? `本批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批七项原材料。';
  if (batch.brewed) return '本批七项原料已调配成独立原瓶，不能重复调配。';
  if (batch.materials.length !== BIZARRO_SORCERER_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = BIZARRO_SORCERER_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.unit && material.source === `占卜俱乐部诡法师备料第${batchNumber(batch)}批` && material.holder === 'PLAYER' && material.quantity === expected.supplyQuantity;
  })) return '本批原材料不完整或被替换，不能混用其它批次。';
  return s.cash < BIZARRO_SORCERER_PRICES.brewing ? '实际调配需要120便士。' : null;
}

/** Mutates the slice's working copy; shared persistence commits the whole intent once. */
export function applyBizarroSorcererAcquisition(s: SliceState, command: BizarroSorcererAcquisitionCommand, c: SeerContext): void {
  rule(validBizarroSorcererAcquisitionCommand(command), '诡法师准备命令无效。');
  const blocked = bizarroSorcererAcquisitionBlock(s, command); rule(blocked === null, blocked ?? '当前无法继续。');
  const state = s.bizarroSorcerer;
  switch (command.type) {
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1; s.cash -= BIZARRO_SORCERER_PRICES.formula; state.formulaKnown = true;
      c.note('记下诡法师七料配方', `花1行动、500便士，向原${BIZARRO_SORCERER_GUIDE}实际学习配方。${BIZARRO_SORCERER_FORMULA_SOURCE}${BIZARRO_SORCERER_RITUAL_SOURCE}`); return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1; state.resupply.requestedWeek = s.week;
      c.note('申请下一轮诡法师材料', `花1行动核对七料并整理先前失败记录，最早第${s.week + 1}周交货。现在没有新材料或药瓶，新批次仍需实际劳动或购买和调配；也没有新目标、见证或已完成仪式。`); return;
    case 'RECEIVE_SUPPLY': {
      const number = state.batches.length + 1;
      state.batches.push(...BIZARRO_SORCERER_BATCH_IDS.map((_, i) => createBatch(number + i)));
      state.resupply.deliveries += 1; state.resupply.requestedWeek = null;
      c.note('下一轮独立七料到货', `第${number}至${number + 2}批实际进入原供应方库存，0行动；仍由供应方持有。旧瓶、失败、伤势及死亡目标记录全部保留。`); return;
    }
    case 'MATERIAL_WORK': {
      const batch = state.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1; batch.labourSteps += 1;
      c.note(BIZARRO_SORCERER_LABOUR_TASKS[batch.labourSteps - 1]!, `第${batchNumber(batch)}批实际劳动${batch.labourSteps}/5，花1行动。五次完成抵本批5000便士主材费，仍付320便士辅材费；未完成劳动不折现，材料现在仍由原供应方持有。`); return;
    }
    case 'BUY_MATERIALS': {
      const batch = state.batches.find(candidate => candidate.id === command.batchId)!, paid = materialPrice(batch);
      s.cash -= paid; batch.acquired = true; for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('诡法师七料实际交付', `支付${paid}便士、0行动，第${batchNumber(batch)}批七项原料交到你手中。${batch.labourSteps === 5 ? '本批五次劳动抵5000便士主材费，仅付320便士辅材。' : '主材5000便士与辅材320便士；部分劳动不折现。'}两项主材各1份是G供货量，不是原著给定重量。`); return;
    }
    case 'BREW': {
      const batch = state.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1; s.cash -= BIZARRO_SORCERER_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      state.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null, consumedWeek: null, ritualAttemptId: null });
      c.note('调配出独立诡法师原瓶', `花1行动、120便士，按本作G指导操作实际消耗第${batchNumber(batch)}批全部七项原料，得到原瓶${bottleId(batch)}。不是由战死敌人自动掉落魔药。原瓶尚未服用，须带到下一场本人筹划的真实谋杀仪式，在当前谢幕单独确认。`); return;
    }
    case 'CONSUME_FINALE': {
      const bottle = state.bottles.find(candidate => candidate.id === command.bottleId)!;
      const attemptId = state.ritual.attemptId;
      rule(typeof attemptId === 'string' && attemptId.length > 0, '缺少当前真实演出场次。');
      const result = c.check('will', 28);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.ritualAttemptId = attemptId;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost);
        state.marionettistActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 4; s.progression.acting = 0;
        for (const id of BIZARRO_SORCERER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        consumeBizarroFinale(s, bottle.id);
        c.note('在真实谢幕中成为诡法师', `原瓶${bottle.id}在原场次${attemptId}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}，四属性各+1；旧能力、旧人物和原尸体历史原样保留，仅两项新掌握从0开始。灵性上限120，当前灵性没有补满。容量50不是50具秘偶或50条免费虫，原演出现在关闭。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        consumeBizarroFinale(s, bottle.id);
        c.note(severe ? '诡法师魔药严重排异' : '诡法师魔药排异', `原瓶${bottle.id}已耗尽，意志${result.roll}/${result.chance}。健康−${healthCost}、精神−${mindCost}、排异+${pollution}；本作G现场监督处理仅将此次药物排异后的健康和精神保底到1，不保护实际战斗。你仍为秘偶大师。原目标死亡、实际见证和成本完整留档，但原尾声已关闭，不能补喝；重试必须另筹新原瓶、另一个实际目标及新的真实仪式。`);
      }
      return;
    }
  }
}

export function applyBizarroSorcererCommand(s: SliceState, command: BizarroSorcererCommand, c: SeerContext): void {
  rule(validBizarroSorcererCommand(command), '诡法师命令无效。');
  if (validBizarroSorcererAcquisitionCommand(command)) return applyBizarroSorcererAcquisition(s, command, c);
  if (validateBizarroRitualCommand(command)) {
    const result = handleBizarroRitualCommand(s, command);
    rule(!result.error, result.error ?? '当前无法继续仪式。');
    if (result.message) c.note('诡法师现场演出', result.message);
    return;
  }
  throw new Error('诡法师生活实践须由共享入口结算实际掌握与消化。');
}

// Historical inheritance only; existing stage command predicates stay unchanged.
const hasAttendantHistory = (s: SliceState) => s.progression.pathwayId === 'diviner' &&
  s.progression.sequence === 1 && s.attendantMysteries?.promotionWeek != null;
const historicallyPromoted = (s: SliceState) => isBizarroSorcerer(s) || hasAttendantHistory(s);
const historicallyKnownChannel = (s: SliceState) => s.seer.discovered && s.marionettist.formulaKnown && s.marionettist.promotionWeek !== null && (isMarionettist(s) || historicallyPromoted(s));
export function projectBizarroSorcerer(s: SliceState): BizarroSorcererProjection {
  const state = s.bizarroSorcerer, available = historicallyKnownChannel(s), promoted = historicallyPromoted(s), actions: BizarroSorcererAction[] = [];
  const add = (id: string, label: string, cost: string, command: BizarroSorcererAcquisitionCommand) => {
    if (hasAttendantHistory(s)) return;
    const reason = bizarroSorcererAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!state.formulaKnown) add('learn-bizarro-sorcerer-formula', '学习诡法师七料配方', '1行动 · 500便士', { type: 'LEARN_FORMULA' });
    else {
      if (state.resupply.requestedWeek !== null) add('receive-bizarro-sorcerer-supply', '确认下一轮三批原材料到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-bizarro-sorcerer-supply', '向原指导者申请下一轮七料', '1行动 · 最早下一真实周到货 · 不附赠仪式', { type: 'REQUEST_SUPPLY' });
      for (const batch of state.batches) {
        if (!batch.acquired) {
          if (batch.labourSteps < 5) add(`work-${batch.id}`, `第${batchNumber(batch)}批 · ${BIZARRO_SORCERER_LABOUR_TASKS[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/5 · 五次抵5000便士主材`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${batchNumber(batch)}批 · 领取全部七料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === 5 ? '（仅付五项辅材）' : '（主材5000＋辅材320）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${batchNumber(batch)}批 · 实际调配诡法师魔药`, '1行动 · 120便士 · 消耗本批全部七料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of state.bottles) if (bottle.status === 'PREPARED') add(`consume-${bottle.id}`, `在当前谢幕服用第${batchNumber({ id: bottle.batchId })}批原瓶`, `0行动 · 单独确认 · 意志难度28 · 健康${s.health}>20、精神${s.mind}>40 · 秘偶大师${s.progression.acting}/100，${marionettistWeeks(s)}/12整周`, { type: 'CONSUME_FINALE', bottleId: bottle.id, confirmed: true });
    }
  }
  const ritual = projectBizarroRitual(s), life = projectBizarroLife(s);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  return {
    title: promoted ? '诡法师 · 序列4' : '诡法师之路', discovered: available, formulaKnown: available && state.formulaKnown, promoted,
    formula: available && state.formulaKnown ? BIZARRO_SORCERER_FORMULA.map(material => ({ name: material.name, quantity: material.quantity, unit: material.quantity === null ? '' : material.unit, ...('note' in material ? { note: material.note } : {}) })) : [],
    actions: [...actions, ...ritual.actions, ...bizarroActions(s)], ritual, life, insideCase: bizarroInside(s) || hasBizarroRitualLock(s), environment: BIZARRO_ENVIRONMENT,
    bottles: available ? state.bottles.map(bottle => ({ id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 诡法师魔药`,
      source: `第${bottle.brewedWeek}周在${BIZARRO_SORCERER_GUIDE}调配台实际消耗${bottle.batchId}七料；独立原瓶${bottle.id}${bottle.ritualAttemptId ? `，实际服药场次${bottle.ritualAttemptId}` : ''}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `原瓶已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，仍为序列5' : '排异，仍为序列5'}`,
      chance, command: { type: 'CONSUME_FINALE', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? BIZARRO_SORCERER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: promoted ? ((s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s)))?s.ancientScholar.bizarroActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s)))?'诡法师原消化100与原鼠/原虫/原仪式后果保留。':promoted ? `秘偶大师消化成果${state.marionettistActingAtPromotion}/100已保留；诡法师扮演${s.progression.acting}/100，旧掌握全部继承。` : available ? `服药前需秘偶大师扮演100（当前${s.progression.acting}/100），并在晋升后度过12整周（${marionettistWeeks(s)}/12）。备料可提前，饮药必须在新的真实谋杀谢幕。` : '先走完秘偶大师之路。',
    pollution: s.seer.pollution,
    ...(available ? { story: `${BIZARRO_SORCERER_FORMULA_SOURCE}${BIZARRO_SORCERER_RITUAL_SOURCE}${BIZARRO_SORCERER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.batches.filter(batch => !batch.acquired).length}批，已有未服原瓶${state.bottles.filter(bottle => bottle.status === 'PREPARED').length}瓶。每轮3批独立七料；两项主材原著未标用量，G供货各1份。${state.resupply.requestedWeek === null ? `后续实际到货${state.resupply.deliveries}轮。` : `第${state.resupply.requestedWeek}周申请，最早下一真实周到货。`}` : '',
    risk: available ? `配方→七料采购或五次劳动后付辅材→实际调配→调查新原目标、布置并跨周邀请真实见证→本人登场与真实战斗→原敌死亡后的当前谢幕单独饮药。可以不进入或0行动收场；战中撤退有风险。${BIZARRO_SORCERER_CONSUMPTION_RISK}` : '成为秘偶大师后，可向原指导者了解下一序列。',
  };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validBizarroSorcererAcquisitionCommand(v: unknown): v is BizarroSorcererAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(v.type as string)) return shape(v, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(v.type as string)) return shape(v, ['type', 'batchId']) && typeof v.batchId === 'string' && /^bizarro-sorcerer-batch-[1-9]\d{0,14}$/.test(v.batchId);
  return v.type === 'CONSUME_FINALE' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true && typeof v.bottleId === 'string' && /^bizarro-sorcerer-batch-[1-9]\d{0,14}:bottle$/.test(v.bottleId);
}
export function validBizarroSorcererCommand(v: unknown): v is BizarroSorcererCommand { return validBizarroSorcererAcquisitionCommand(v) || validateBizarroRitualCommand(v) || validateBizarroActivityCommand(v); }
export const isBizarroSorcererAcquisitionCommand = validBizarroSorcererAcquisitionCommand;

/** All bottle inputs and progression facts stay attached to their original batches and rite. */
export function validBizarroSorcererState(s: SliceState): boolean {
  try { return validateState(s); } catch { return false; }
}
function validateState(s: SliceState): boolean {
  const raw: unknown = s.bizarroSorcerer;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'marionettistActingAtPromotion', 'ritual', 'life']) || typeof raw.formulaKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.seer) || !record(s.marionettist)) return false;
  const firstConsumptionWeek = (s.marionettist.promotionWeek ?? s.week) + BIZARRO_SORCERER_MIN_MARIONETTIST_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.batches) || raw.batches.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  const state = raw as unknown as BizarroSorcererState, promoted = historicallyPromoted(s);
  if (state.formulaKnown && !historicallyKnownChannel(s)) return false;
  if (promoted) {
    if (!state.formulaKnown || !integer(s.marionettist.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.marionettistActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...SEER_ABILITY_IDS, ...CLOWN_ABILITY_IDS, ...MAGICIAN_ABILITY_IDS, ...FACELESS_ABILITY_IDS, ...MARIONETTIST_ABILITY_IDS, ...BIZARRO_SORCERER_ABILITY_IDS,...((s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s)))?ANCIENT_SCHOLAR_ABILITY_IDS:[]),...((s.progression.sequence===2||hasAttendantHistory(s))?MIRACLE_WORKER_ABILITY_IDS:[]),...(hasAttendantHistory(s)?ATTENDANT_MYSTERIES_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.marionettistActingAtPromotion !== null || BIZARRO_SORCERER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  for (const [i, batch] of state.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `bizarro-sorcerer-batch-${i + 1}` || !integer(batch.labourSteps, 0, 5) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== 7) return false;
    if (batch.brewed && !batch.acquired || !state.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [j, material] of batch.materials.entries()) {
      const expected = BIZARRO_SORCERER_FORMULA[j]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || material.source !== `占卜俱乐部诡法师备料第${i + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.supplyQuantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of state.bottles) if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome', 'consumedWeek', 'ritualAttemptId']) || !integer(bottle.brewedWeek, s.marionettist.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  for (const batch of state.batches) if (state.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  let successes = 0;
  const attempts = new Set<string>();
  for (const bottle of state.bottles) {
    const batch = state.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== 7 || !bottle.inputIds.every((id, i) => id === batch.materials[i]!.id) || promoted && bottle.brewedWeek > state.promotionWeek!) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null || bottle.consumedWeek !== null || bottle.ritualAttemptId !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.marionettist.promotionWeek === null || !integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.brewedWeek), s.week) || !promoted && s.progression.acting !== 100 || typeof bottle.ritualAttemptId !== 'string' || !bottle.ritualAttemptId || attempts.has(bottle.ritualAttemptId)) return false;
      attempts.add(bottle.ritualAttemptId);
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') { successes += 1; if (state.promotionWeek === null || bottle.consumedWeek !== state.promotionWeek) return false; }
  }
  const deliveries = state.resupply.deliveries;
  if (!state.batches.slice(0, deliveries * 3).every(batch => failedBatch(state, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(state.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = state.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.consumedWeek ?? bottle.brewedWeek)) + 1;
  }
  if (state.resupply.requestedWeek !== null && (!state.formulaKnown || promoted || !exhaustedSupply(state) || state.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...state.bottles.map(bottle => bottle.consumedWeek ?? bottle.brewedWeek)))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateBizarroRitualState(s) || !validateBizarroLife(s)) return false;
  for (const bottle of state.bottles.filter(b => b.status === 'CONSUMED')) {
    const attempt = state.ritual.attempts.find(a => a.id === bottle.ritualAttemptId);
    if (!attempt || attempt.mode !== 'RITUAL' || attempt.outcome !== 'CONSUMED' || attempt.bottleId !== bottle.id || attempt.consumedBottleId !== bottle.id || attempt.week !== bottle.consumedWeek || !attempt.killEvidence || attempt.invalidReason || attempt.deathWitnessIds.length !== 36) return false;
  }
  return true;
}
export const validateBizarroSorcererState = validBizarroSorcererState;
export const validateBizarroSorcererCommand = validBizarroSorcererCommand;
export const validateBizarroSorcererAcquisitionCommand = validBizarroSorcererAcquisitionCommand;
export type * from './types.js';
