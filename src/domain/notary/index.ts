import { PURE_WHITE_ANGEL_ABILITY_IDS } from '../pure-white-angel/types.js';
import { LIGHT_SEEKER_ABILITY_IDS } from '../light-seeker/types.js';
import {JUSTICE_MENTOR_ABILITY_IDS} from '../justice-mentor/types.js';
import {UNSHADOWED_ABILITY_IDS} from '../unshadowed/types.js';
import {PRIEST_OF_LIGHT_ABILITY_IDS} from '../priest-of-light/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { BARD_ABILITY_IDS } from '../bard/types.js';
import { LIGHTPRAYER_ABILITY_IDS } from '../lightprayer/types.js';
import { SUNPRIEST_ABILITY_IDS } from '../sunpriest/types.js';
import { notaryInside, notaryActions, notaryCases, NOTARY_ENVIRONMENT, validateNotaryActivityCommand, validateNotaryLife } from './life.js';
import {
  NOTARY_ABILITIES, NOTARY_BATCH_IDS, NOTARY_CONSUMPTION_RISK, NOTARY_FORMULA,
  NOTARY_FORMULA_SOURCE, NOTARY_GUIDE, NOTARY_MIN_SUNPRIEST_WEEKS, NOTARY_PRICES, NOTARY_LABOUR_STEPS,
  NOTARY_LABOUR_TASKS, NOTARY_SOURCE_STATUS,
} from './content.js';
import {
  NOTARY_ABILITY_IDS, NOTARY_CASE_IDS, type NotaryCommand, type NotaryAcquisitionCommand, type NotaryAction, type NotaryBatch,
  type NotaryProjection, type NotaryState,
} from './types.js';

function createBatch(number: number): NotaryBatch {
  const id = `notary-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: NOTARY_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.quantity, unit: material.unit,
      source: `原礼拜堂工作间公证人备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createNotaryState(): NotaryState {
  return {
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: NOTARY_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, sunpriestActingAtPromotion: null,
    cases: Object.fromEntries(NOTARY_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0, notes: 0, revised: false }])) as NotaryState['cases'],
    reflected: false,
    contract: { signed: false, active: false, tool: 'TABLE', fulfilled: false },
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'sun' && (s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))));
const isSunpriest = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.bard.discovered && s.bard.guidanceKnown && s.lightprayer.guidanceKnown && s.sunpriest.formulaKnown && (isSunpriest(s) || promoted(s));
const materialPrice = (batch: NotaryBatch) => NOTARY_PRICES.auxiliaryMaterials + (batch.labourSteps === NOTARY_LABOUR_STEPS ? 0 : NOTARY_PRICES.mainMaterials);
const bottleId = (batch: NotaryBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<NotaryBatch, 'id'>) => Number(batch.id.slice('notary-batch-'.length));
const sunpriestWeeks = (s: SliceState) => Math.max(0, (s.notary.promotionWeek ?? s.week) - (s.sunpriest.promotionWeek ?? s.week));
const failedBatch = (notary: NotaryState, batch: NotaryBatch) => batch.brewed && notary.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (notary: NotaryState) => notary.batches.length >= 3 && notary.bottles.length === notary.batches.length && notary.batches.every(batch => failedBatch(notary, batch));

function commandBlock(s: SliceState, command: NotaryAcquisitionCommand): string | null {
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (Object.values(s.notary.cases).some(scene => scene.contactOpen)) return '先实际结束本次公证人实践的接触，再继续。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原礼拜堂工作间。';
  if (!knownChannel(s)) return '成为太阳神官并保有指导者渠道后，才能继续公证人之路。';
  if (promoted(s)) return '你已完成公证人晋升，不能重复服用或继续准备这份魔药。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.notary.formulaKnown) return '已经掌握公证人配方。';
    return s.cash < NOTARY_PRICES.formula ? '公证人配方指导需要360便士。' : null;
  }
  if (!s.notary.formulaKnown) return '先完成公证人配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.notary.resupply.requestedWeek !== null) return '已经向指导者申请下一轮公证人材料，请等到下一个真实周。';
    return exhaustedSupply(s.notary) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.notary.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮公证人材料并完成备料准备。';
    if (!exhaustedSupply(s.notary)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.notary.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选公证人原瓶不存在或已经用完。';
    if (s.progression.acting < 100) return `太阳神官魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.sunpriest.promotionWeek === null || sunpriestWeeks(s) < NOTARY_MIN_SUNPRIEST_WEEKS) return `成为太阳神官后已度过${sunpriestWeeks(s)}/${NOTARY_MIN_SUNPRIEST_WEEKS}整周，尚不能服药。`;
    return null;
  }
  const batch = s.notary.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批公证人材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= NOTARY_LABOUR_STEPS ? '这批五次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成公证人原瓶。';
  if (batch.materials.length !== NOTARY_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = NOTARY_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.unit && material.source === `原礼拜堂工作间公证人备料第${batchNumber(batch)}批` && material.holder === 'PLAYER' && material.quantity === expected.quantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < NOTARY_PRICES.brewing ? '调配台使用需要80便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applyNotaryAcquisition(s: SliceState, command: NotaryAcquisitionCommand, c: SeerContext): void {
  rule(validNotaryAcquisitionCommand(command), '公证人准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= NOTARY_PRICES.formula;
      s.notary.formulaKnown = true;
      c.note('记下公证人配方', `花费1行动、360便士，向同一位${NOTARY_GUIDE}学习六项材料。六项数量均已核；本次使用导师的本作G操作规程，不冒称原著投料次序。${NOTARY_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.notary.resupply.requestedWeek = s.week;
      c.note('申请下一轮公证人材料', `花费1行动，向原${NOTARY_GUIDE}申请下一轮三批材料，并核对六料清单、整理备料记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批五次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.notary.batches.length + 1;
      s.notary.batches.push(...NOTARY_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.notary.resupply.deliveries += 1;
      s.notary.resupply.requestedWeek = null;
      c.note('公证人新一轮备料到货', `原${NOTARY_GUIDE}确认第${firstNumber}至${firstNumber + 2}批六料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成五次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.notary.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      c.note(`完成${NOTARY_LABOUR_TASKS[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/5。${batch.labourSteps === NOTARY_LABOUR_STEPS ? '五次劳动抵本批3000便士主材费；仍须支付240便士辅材费，才会交付整批材料。' : '完成全部五次才能抵本批3000便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.notary.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('公证人材料交付', `第${batchNumber(batch)}批六项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === NOTARY_LABOUR_STEPS ? '五次劳动已抵本批主材费，仅支付240便士辅材费。' : '主材3000便士、辅材240便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.notary.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= NOTARY_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.notary.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶公证人魔药', `花费1行动、80便士，在导师指导下将第${batchNumber(batch)}批六项原材料调配成药。六项材料及数量均有原著依据；具体操作次序采用本作G导师规程，不把该次序称作原著事实。六项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。太阳神官扮演100且晋升后满12整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.notary.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.notary.sunpriestActingAtPromotion = s.progression.acting;
        s.notary.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of NOTARY_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为公证人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质、感知、意志与知识各+1。原歌颂者、祈光人与太阳神官的全部能力掌握完整继承，公证人新增两项从0开始；太阳神官消化成果保留，公证人扮演从0开始。灵性上限提高到80，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了公证人晋升' : '公证人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是太阳神官，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }

  }
}

export function projectNotary(s: SliceState): NotaryProjection {
  const actions: NotaryAction[] = [];
  const available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: NotaryAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.notary.formulaKnown) add('learn-notary-formula', '请指导者讲解公证人配方', '1行动 · 360便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.notary.resupply.requestedWeek !== null) {
        add('receive-notary-supply', '确认下一轮三批公证人材料到货', `0行动 · 最早第${s.notary.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.notary)) {
        add('request-notary-supply', '向原指导者申请下一轮公证人材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      for (const batch of s.notary.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < NOTARY_LABOUR_STEPS) add(`work-${batch.id}`, `第${number}批 · ${NOTARY_LABOUR_TASKS[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/5，完成五次抵3000便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取六项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === NOTARY_LABOUR_STEPS ? '（仅付四项辅材）' : '（主材3000＋辅材240）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配公证人魔药`, '1行动 · 80便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.notary.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批公证人原瓶`, `0行动 · 独立确认 · 太阳神官扮演${s.progression.acting}/100 · 晋升后${sunpriestWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.notary.batches.filter(batch => !batch.acquired).length;
  const prepared = s.notary.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '公证人 · 序列6' : '公证人之路', discovered: available,
    formulaKnown: available && s.notary.formulaKnown, promoted: isPromoted,
    formula: available && s.notary.formulaKnown ? NOTARY_FORMULA.map(material => ({ name: material.name, quantity: material.quantity, unit: material.unit })) : [],
    actions: [...actions, ...notaryActions(s)],
    contract: { ...s.notary.contract },
    bottles: available ? s.notary.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 公证人魔药`,
      source: `${NOTARY_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的六项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? NOTARY_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?s.priestOfLight.notaryActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?'公证人魔药已消化；原契约、本人签名与实际原尺归还记录保留。':isPromoted ? `太阳神官消化成果${s.notary.sunpriestActingAtPromotion}/100已保留；公证人扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成太阳神官消化（${s.progression.acting}/100），并在太阳神官晋升后度过12整周（${sunpriestWeeks(s)}/12）。配方与材料可以提前准备。` : '先走完太阳神官之路。',
    pollution: s.seer.pollution,
    cases: isPromoted ? notaryCases(s) : [], insideCase: notaryInside(s), environment: NOTARY_ENVIRONMENT,
    ...(available ? { story: `${NOTARY_FORMULA_SOURCE}${NOTARY_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。每批六项原料独立持有、消耗并制成唯一原瓶。${s.notary.resupply.requestedWeek === null ? `已实际接收后续材料${s.notary.resupply.deliveries}轮，每轮3批。` : `第${s.notary.resupply.requestedWeek}周申请，下一个真实周起收货。`}` : '',
    risk: available ? `步骤：配方指导 → 采购或五次劳动后领取材料 → 调配 → 独立确认服药。公证人材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${NOTARY_CONSUMPTION_RISK}` : '成为太阳神官后，可向原有指导者了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validNotaryAcquisitionCommand(value: unknown): value is NotaryAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^notary-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^notary-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  return false;
}
export function isNotaryAcquisitionCommand(command: NotaryCommand): command is NotaryAcquisitionCommand { return validNotaryAcquisitionCommand(command); }
export function validNotaryCommand(value: unknown): value is NotaryCommand { return validNotaryAcquisitionCommand(value) || validateNotaryActivityCommand(value); }

/** Original materials, independent bottles, finite replenishment and inherited progression. */
export function validNotaryState(s: SliceState): boolean {
  const raw: unknown = s.notary;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'sunpriestActingAtPromotion', 'cases', 'reflected', 'contract', 'encounter']) || typeof raw.formulaKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.seer) || !record(s.bard) || !record(s.lightprayer) || !record(s.sunpriest) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory)) return false;
  const firstConsumptionWeek = (s.sunpriest.promotionWeek ?? s.week) + NOTARY_MIN_SUNPRIEST_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries;
  if (!Array.isArray(raw.batches) || raw.batches.length !== NOTARY_BATCH_IDS.length * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  if (raw.encounter.startHistoryIndex !== null && !integer(raw.encounter.startHistoryIndex, 0, s.combatHistory.length) || raw.encounter.attemptWeek !== null && !integer(raw.encounter.attemptWeek, firstConsumptionWeek, s.week)) return false;
  const f = raw as unknown as NotaryState, isPromoted = promoted(s);
  if (f.formulaKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!f.formulaKnown || !integer(s.sunpriest.promotionWeek, 1, s.week) || !integer(f.promotionWeek, firstConsumptionWeek, s.week) || f.sunpriestActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?PURE_WHITE_ANGEL_ABILITY_IDS:[]),...BARD_ABILITY_IDS, ...LIGHTPRAYER_ABILITY_IDS, ...SUNPRIEST_ABILITY_IDS, ...NOTARY_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?PRIEST_OF_LIGHT_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?UNSHADOWED_ABILITY_IDS:[]),...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?JUSTICE_MENTOR_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?LIGHT_SEEKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
    if (f.encounter.attemptWeek !== null && f.encounter.attemptWeek < f.promotionWeek) return false;
  } else {
    if (f.reflected || !record(f.cases) || Object.values(f.cases).some(r => !record(r) || r.status !== 'AVAILABLE' || r.attemptWeek !== null || r.method !== null || r.outcome !== 'NONE' || r.withdrawals !== 0 || r.contactOpen || r.closes !== 0 || r.notes !== 0 || r.revised)) return false;
    if (f.promotionWeek !== null || f.sunpriestActingAtPromotion !== null || NOTARY_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (f.encounter.status !== 'AVAILABLE' || f.encounter.startHistoryIndex !== null || f.encounter.attemptWeek !== null) return false;
  }
  if (!validateNotaryLife(s)) return false;
  const e = f.encounter;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'NOTARY_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(f.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || f.contract.tool !== 'TABLE' || f.contract.active || Object.values(f.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'notary-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  // Check records before following cross-references; hostile saves return false, not a crash.
  for (const [index, batch] of f.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `notary-batch-${index + 1}` || !integer(batch.labourSteps, 0, NOTARY_LABOUR_STEPS) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== NOTARY_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !f.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = NOTARY_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || material.source !== `原礼拜堂工作间公证人备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.quantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of f.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, s.sunpriest.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  }
  let successfulBottles = 0;
  for (const batch of f.batches) if (f.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  for (const bottle of f.bottles) {
    if (isPromoted && bottle.brewedWeek > f.promotionWeek!) return false;
    const batch = f.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== NOTARY_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.sunpriest.promotionWeek === null || s.week < firstConsumptionWeek || !isPromoted && s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successfulBottles += 1;
      if (f.promotionWeek === null || bottle.brewedWeek > f.promotionWeek) return false;
    }
  }
  if (!f.batches.slice(0, deliveries * 3).every(batch => failedBatch(f, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(f.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = f.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.brewedWeek)) + 1;
  }
  if (f.resupply.requestedWeek !== null && (!f.formulaKnown || isPromoted || !exhaustedSupply(f) || f.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...f.bottles.map(bottle => bottle.brewedWeek)))) return false;
  return successfulBottles === (isPromoted ? 1 : 0);
}

// Conventional aliases keep the domain entry points consistent with older stages.
export const applyNotaryCommand = applyNotaryAcquisition;
export const validateNotaryState = validNotaryState;
export const validateNotaryCommand = validNotaryCommand;
export const validateNotaryAcquisitionCommand = validNotaryAcquisitionCommand;
export { applyNotaryActivity } from './life.js';
export { NOTARY_ABILITIES } from './content.js';
export type * from './types.js';
