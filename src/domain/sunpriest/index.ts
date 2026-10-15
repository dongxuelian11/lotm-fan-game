import { LIGHT_SEEKER_ABILITY_IDS } from '../light-seeker/types.js';
import {JUSTICE_MENTOR_ABILITY_IDS} from '../justice-mentor/types.js';
import {UNSHADOWED_ABILITY_IDS} from '../unshadowed/types.js';
import {PRIEST_OF_LIGHT_ABILITY_IDS} from '../priest-of-light/types.js';
import {NOTARY_ABILITY_IDS} from '../notary/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { LIGHTPRAYER_ABILITY_IDS } from '../lightprayer/types.js';
import { BARD_ABILITY_IDS } from '../bard/types.js';
import {
  SUNPRIEST_ABILITIES, SUNPRIEST_BATCH_IDS, SUNPRIEST_CONSUMPTION_RISK, SUNPRIEST_FORMULA,
  SUNPRIEST_FORMULA_SOURCE, SUNPRIEST_GUIDE, SUNPRIEST_MIN_LIGHTPRAYER_WEEKS, SUNPRIEST_PRICES, SUNPRIEST_LABOUR_STEPS,
  SUNPRIEST_LABOUR_TASKS, SUNPRIEST_SOURCE_STATUS,
} from './content.js';
import {
  SUNPRIEST_ABILITY_IDS, SUNPRIEST_CASE_IDS, type SunpriestCommand, type SunpriestAcquisitionCommand, type SunpriestAction, type SunpriestBatch,
  type SunpriestProjection, type SunpriestState,
} from './types.js';

function createBatch(number: number): SunpriestBatch {
  const id = `sunpriest-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: SUNPRIEST_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.quantity, unit: material.unit,
      source: `公共音乐室收货处太阳神官备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createSunpriestState(): SunpriestState {
  return {
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: SUNPRIEST_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, lightprayerActingAtPromotion: null,
    cases: Object.fromEntries(SUNPRIEST_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE' }])),
    reflected: false, holyWater: { prepared: 0, held: 0, used: 0 },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'sun' && (s.progression.sequence === 7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isLightprayer = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.bard.discovered && s.bard.guidanceKnown && s.lightprayer.guidanceKnown && (isLightprayer(s) || promoted(s));
const materialPrice = (batch: SunpriestBatch) => SUNPRIEST_PRICES.auxiliaryMaterials + (batch.labourSteps === SUNPRIEST_LABOUR_STEPS ? 0 : SUNPRIEST_PRICES.mainMaterials);
const bottleId = (batch: SunpriestBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<SunpriestBatch, 'id'>) => Number(batch.id.slice('sunpriest-batch-'.length));
const lightprayerWeeks = (s: SliceState) => Math.max(0, (s.sunpriest.promotionWeek ?? s.week) - (s.lightprayer.promotionWeek ?? s.week));
const failedBatch = (sunpriest: SunpriestState, batch: SunpriestBatch) => batch.brewed && sunpriest.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (sunpriest: SunpriestState) => sunpriest.batches.length >= 3 && sunpriest.bottles.length === sunpriest.batches.length && sunpriest.batches.every(batch => failedBatch(sunpriest, batch));

function commandBlock(s: SliceState, command: SunpriestAcquisitionCommand): string | null {
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的公共音乐室收货处。';
  if (!knownChannel(s)) return '成为祈光人并保有指导者渠道后，才能继续太阳神官之路。';
  if (promoted(s)) return '你已完成太阳神官晋升，不能重复服用或继续准备这份魔药。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.sunpriest.formulaKnown) return '已经掌握太阳神官配方。';
    return s.cash < SUNPRIEST_PRICES.formula ? '太阳神官配方指导需要240便士。' : null;
  }
  if (!s.sunpriest.formulaKnown) return '先完成太阳神官配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.sunpriest.resupply.requestedWeek !== null) return '已经向指导者申请下一轮太阳神官材料，请等到下一个真实周。';
    return exhaustedSupply(s.sunpriest) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.sunpriest.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮太阳神官材料并完成备料准备。';
    if (!exhaustedSupply(s.sunpriest)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.sunpriest.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选太阳神官原瓶不存在或已经用完。';
    if (s.progression.acting < 100) return `祈光人魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.lightprayer.promotionWeek === null || lightprayerWeeks(s) < SUNPRIEST_MIN_LIGHTPRAYER_WEEKS) return `成为祈光人后已度过${lightprayerWeeks(s)}/${SUNPRIEST_MIN_LIGHTPRAYER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  const batch = s.sunpriest.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批太阳神官材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= SUNPRIEST_LABOUR_STEPS ? '这批四次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成太阳神官原瓶。';
  if (batch.materials.length !== SUNPRIEST_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = SUNPRIEST_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.unit && material.source === `公共音乐室收货处太阳神官备料第${batchNumber(batch)}批` && material.holder === 'PLAYER' && material.quantity === expected.quantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < SUNPRIEST_PRICES.brewing ? '调配台使用需要60便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applySunpriestCommand(s: SliceState, command: SunpriestAcquisitionCommand, c: SeerContext): void {
  rule(validateSunpriestAcquisitionCommand(command), '太阳神官准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= SUNPRIEST_PRICES.formula;
      s.sunpriest.formulaKnown = true;
      c.note('记下太阳神官配方', `花费1行动、240便士，向同一位${SUNPRIEST_GUIDE}学习六项材料。完整六项配方已经核定；逐项投料顺序未获原著核定，本次按导师的本作G批次操作规程调配。${SUNPRIEST_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.sunpriest.resupply.requestedWeek = s.week;
      c.note('申请下一轮太阳神官材料', `花费1行动，向原${SUNPRIEST_GUIDE}申请下一轮三批材料，并核对六料清单、整理备料记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批四次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.sunpriest.batches.length + 1;
      s.sunpriest.batches.push(...SUNPRIEST_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.sunpriest.resupply.deliveries += 1;
      s.sunpriest.resupply.requestedWeek = null;
      c.note('太阳神官新一轮备料到货', `原${SUNPRIEST_GUIDE}确认第${firstNumber}至${firstNumber + 2}批六料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成四次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.sunpriest.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      c.note(`完成${SUNPRIEST_LABOUR_TASKS[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/4。${batch.labourSteps === SUNPRIEST_LABOUR_STEPS ? '四次劳动抵本批1800便士主材费；仍须支付150便士辅材费，才会交付整批材料。' : '完成全部四次才能抵本批1800便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.sunpriest.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('太阳神官材料交付', `第${batchNumber(batch)}批六项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === SUNPRIEST_LABOUR_STEPS ? '四次劳动已抵本批主材费，仅支付150便士辅材费。' : '主材1800便士、辅材150便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.sunpriest.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= SUNPRIEST_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.sunpriest.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶太阳神官魔药', `花费1行动、60便士，在导师指导下将第${batchNumber(batch)}批六项原材料调配成药。完整六项配方有原著依据，具体操作次序采用本作G导师规程，不把该次序称作原著事实。六项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。祈光人扮演100且晋升后满8整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.sunpriest.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.sunpriest.lightprayerActingAtPromotion = s.progression.acting;
        s.sunpriest.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of SUNPRIEST_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 2], ['will', 2], ['knowledge', 2]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为太阳神官', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+2、意志+2、知识+2。歌颂者与祈光人的五项旧掌握完整继承，四组太阳神官能力从0开始；祈光人消化成果保留，太阳神官扮演从0开始。灵性上限提高到60，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了太阳神官晋升' : '太阳神官魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是祈光人，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }

  }
}

export function projectSunpriest(s: SliceState): SunpriestProjection {
  const actions: SunpriestAction[] = [];
  const available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: SunpriestAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.sunpriest.formulaKnown) add('learn-sunpriest-formula', '请指导者讲解太阳神官配方', '1行动 · 240便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.sunpriest.resupply.requestedWeek !== null) {
        add('receive-sunpriest-supply', '确认下一轮三批太阳神官材料到货', `0行动 · 最早第${s.sunpriest.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.sunpriest)) {
        add('request-sunpriest-supply', '向原指导者申请下一轮太阳神官材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      for (const batch of s.sunpriest.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < SUNPRIEST_LABOUR_STEPS) add(`work-${batch.id}`, `第${number}批 · ${SUNPRIEST_LABOUR_TASKS[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/4，完成四次抵1800便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取六项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === SUNPRIEST_LABOUR_STEPS ? '（仅付四项辅材）' : '（主材1800＋辅材150）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配太阳神官魔药`, '1行动 · 60便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.sunpriest.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批太阳神官原瓶`, `0行动 · 独立确认 · 祈光人扮演${s.progression.acting}/100 · 晋升后${lightprayerWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.sunpriest.batches.filter(batch => !batch.acquired).length;
  const prepared = s.sunpriest.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '太阳神官 · 序列7' : '太阳神官之路', discovered: available,
    formulaKnown: available && s.sunpriest.formulaKnown, promoted: isPromoted,
    formula: available && s.sunpriest.formulaKnown ? SUNPRIEST_FORMULA.map(({ name, quantity, unit }) => ({ name, quantity, unit })) : [],
    actions,
    bottles: available ? s.sunpriest.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 太阳神官魔药`,
      source: `${SUNPRIEST_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的六项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SUNPRIEST_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.notary.sunpriestActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?'太阳神官魔药已消化，原圣水、誓约与隔离处置经历保留。':isPromoted ? `祈光人消化成果${s.sunpriest.lightprayerActingAtPromotion}/100已保留；太阳神官扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成祈光人消化（${s.progression.acting}/100），并在祈光人晋升后度过8整周（${lightprayerWeeks(s)}/8）。配方与材料可以提前准备。` : '先走完祈光人之路。',
    pollution: s.seer.pollution,
    cases: [], environment: '',
    ...(available ? { story: `${SUNPRIEST_FORMULA_SOURCE}${SUNPRIEST_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。圣水已制备${s.sunpriest.holyWater.prepared}份、持有${s.sunpriest.holyWater.held}份、使用${s.sunpriest.holyWater.used}份。${s.sunpriest.resupply.requestedWeek === null ? `已实际接收后续材料${s.sunpriest.resupply.deliveries}批。` : `第${s.sunpriest.resupply.requestedWeek}周申请，下一个真实周起收货。`}` : '',
    risk: available ? `步骤：配方指导 → 采购或四次劳动后领取材料 → 调配 → 独立确认服药。太阳神官材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${SUNPRIEST_CONSUMPTION_RISK}` : '成为祈光人后，可向原有指导者了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validateSunpriestAcquisitionCommand(value: unknown): value is SunpriestAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^sunpriest-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^sunpriest-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  return false;
}

export function isSunpriestAcquisitionCommand(command: SunpriestCommand): command is SunpriestAcquisitionCommand {
  return validateSunpriestAcquisitionCommand(command);
}

/** Reject unknown case IDs, methods and extra fields at both intent entry points. */
export function validateSunpriestCommand(value: unknown): value is SunpriestCommand {
  if (validateSunpriestAcquisitionCommand(value)) return true;
  if (!record(value)) return false;
  if (value.type === 'REFLECT') return shape(value, ['type']);
  if (['OBSERVE', 'PERFORM', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && SUNPRIEST_CASE_IDS.includes(value.caseId as typeof SUNPRIEST_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && SUNPRIEST_CASE_IDS.includes(value.caseId as typeof SUNPRIEST_CASE_IDS[number]) && ['LIGHT', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns physical materials, bottle lineage, promotion and stock conservation.
 * Life owns exact case transitions and the scene evidence behind holy-water use. */
export function validateSunpriestState(s: SliceState): boolean {
  const raw: unknown = s.sunpriest;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'lightprayerActingAtPromotion', 'cases', 'reflected', 'holyWater']) || typeof raw.formulaKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.bard) || !record(s.lightprayer)) return false;
  const firstConsumptionWeek = (s.lightprayer.promotionWeek ?? s.week) + SUNPRIEST_MIN_LIGHTPRAYER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries as number;
  if (!Array.isArray(raw.batches) || raw.batches.length !== SUNPRIEST_BATCH_IDS.length * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (!record(raw.cases) || !shape(raw.cases, SUNPRIEST_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['LIGHT', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'PREPARED', 'SUPPORTED', 'QUIET', 'REFERRED'].includes(value.outcome as string)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  if (!record(raw.holyWater) || !shape(raw.holyWater, ['prepared', 'held', 'used']) || !Object.values(raw.holyWater).every(value => integer(value, 0, 1)) || raw.holyWater.prepared !== (raw.holyWater.held as number) + (raw.holyWater.used as number)) return false;
  const sunpriest = raw as unknown as SunpriestState, isPromoted = promoted(s);
  if (sunpriest.formulaKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!sunpriest.formulaKnown || !integer(s.lightprayer.promotionWeek, 1, s.week) || !integer(sunpriest.promotionWeek, firstConsumptionWeek, s.week) || sunpriest.lightprayerActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...BARD_ABILITY_IDS, ...LIGHTPRAYER_ABILITY_IDS, ...SUNPRIEST_ABILITY_IDS,...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?NOTARY_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?PRIEST_OF_LIGHT_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?UNSHADOWED_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?JUSTICE_MENTOR_ABILITY_IDS:[]),...(s.progression.sequence===2?LIGHT_SEEKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (sunpriest.promotionWeek !== null || sunpriest.lightprayerActingAtPromotion !== null || SUNPRIEST_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (sunpriest.reflected || sunpriest.holyWater.prepared || Object.values(sunpriest.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0)) return false;
  }
  // Validate every record before following cross-references, including hostile save input.
  for (const [index, batch] of sunpriest.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `sunpriest-batch-${index + 1}` || !integer(batch.labourSteps, 0, SUNPRIEST_LABOUR_STEPS) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== SUNPRIEST_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !sunpriest.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = SUNPRIEST_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || material.source !== `公共音乐室收货处太阳神官备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.quantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of sunpriest.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, s.lightprayer.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  }
  let successfulBottles = 0;
  for (const batch of sunpriest.batches) if (sunpriest.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  for (const bottle of sunpriest.bottles) {
    if (isPromoted && bottle.brewedWeek > sunpriest.promotionWeek!) return false;
    const batch = sunpriest.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== SUNPRIEST_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.lightprayer.promotionWeek === null || s.week < firstConsumptionWeek || !isPromoted && s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successfulBottles += 1;
      if (sunpriest.promotionWeek === null || bottle.brewedWeek > sunpriest.promotionWeek) return false;
    }
  }
  if (!sunpriest.batches.slice(0, deliveries * 3).every(batch => failedBatch(sunpriest, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(sunpriest.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = sunpriest.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.brewedWeek)) + 1;
  }
  if (sunpriest.resupply.requestedWeek !== null && (!sunpriest.formulaKnown || isPromoted || !exhaustedSupply(sunpriest) || sunpriest.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...sunpriest.bottles.map(bottle => bottle.brewedWeek)))) return false;
  return successfulBottles === (isPromoted ? 1 : 0);
}

export type * from './types.js';
