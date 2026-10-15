import {MIRACLE_WORKER_ABILITY_IDS} from '../miracle-worker/content.js';
import {ANCIENT_SCHOLAR_ABILITY_IDS} from '../ancient-scholar/types.js';
import { BIZARRO_SORCERER_ABILITY_IDS } from '../bizarro-sorcerer/types.js';
import {MARIONETTIST_ABILITY_IDS} from '../marionettist/types.js';
import {FACELESS_ABILITY_IDS} from '../faceless/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CLOWN_ABILITY_IDS } from '../clown/types.js';
import { SEER_ABILITY_IDS } from '../seer/types.js';
import {
  MAGICIAN_ABILITIES, MAGICIAN_BATCH_IDS, MAGICIAN_CONSUMPTION_RISK, MAGICIAN_FORMULA,
  MAGICIAN_FORMULA_SOURCE, MAGICIAN_GUIDE, MAGICIAN_MIN_CLOWN_WEEKS, MAGICIAN_PRICES, MAGICIAN_LABOUR_STEPS, MAGICIAN_OIL_STOCK,
} from './content.js';
import {
  MAGICIAN_ABILITY_IDS, type MagicianCommand, type MagicianAcquisitionCommand, type MagicianAction, type MagicianBatch,
  type MagicianProjection, type MagicianState,
} from './types.js';

function createBatch(number: number): MagicianBatch {
  const id = `magician-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: MAGICIAN_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.quantity, unit: material.unit,
      source: `占卜俱乐部魔术师备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createMagicianState(): MagicianState {
  return {
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: MAGICIAN_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, clownActingAtPromotion: null,
    practices: [], practiceAttempts: {}, figurinesMade: 0, figurinesHeld: 0, figurinesUsed: 0,
    lantern: { oilStock: MAGICIAN_OIL_STOCK, oilHeld: 0, oilSpent: 0, prepared: false, deliveries: 0, lastSupplyWeek: null }, damageTransfers: [], reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'diviner' && (s.progression.sequence === 7||(s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isClown = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.seer.discovered && s.clown.formulaKnown && (isClown(s) || promoted(s));
const materialPrice = (batch: MagicianBatch) => MAGICIAN_PRICES.auxiliaryMaterials + (batch.labourSteps === MAGICIAN_LABOUR_STEPS ? 0 : MAGICIAN_PRICES.mainMaterials);
const bottleId = (batch: MagicianBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<MagicianBatch, 'id'>) => Number(batch.id.slice('magician-batch-'.length));
const clownWeeks = (s: SliceState) => Math.max(0, (s.magician.promotionWeek ?? s.week) - (s.clown.promotionWeek ?? s.week));
const failedBatch = (magician: MagicianState, batch: MagicianBatch) => batch.brewed && magician.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (magician: MagicianState) => magician.batches.length >= 3 && magician.bottles.length === magician.batches.length && magician.batches.every(batch => failedBatch(magician, batch));

function commandBlock(s: SliceState, command: MagicianAcquisitionCommand): string | null {
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的占卜俱乐部。';
  if (!knownChannel(s)) return '成为小丑并保有指导者渠道后，才能继续魔术师之路。';
  if (promoted(s)) return '你已完成魔术师晋升，不能重复服用或继续准备这份魔药。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.magician.formulaKnown) return '已经掌握魔术师配方。';
    return s.cash < MAGICIAN_PRICES.formula ? '魔术师配方指导需要240便士。' : null;
  }
  if (!s.magician.formulaKnown) return '先完成魔术师配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.magician.resupply.requestedWeek !== null) return '已经向指导者申请下一轮魔术师材料，请等到下一个真实周。';
    return exhaustedSupply(s.magician) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.magician.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮魔术师材料并完成备料准备。';
    if (!exhaustedSupply(s.magician)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.magician.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选魔术师原瓶不存在或已经用完。';
    if (s.progression.acting < 100) return `小丑魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.clown.promotionWeek === null || clownWeeks(s) < MAGICIAN_MIN_CLOWN_WEEKS) return `成为小丑后已度过${clownWeeks(s)}/${MAGICIAN_MIN_CLOWN_WEEKS}整周，尚不能服药。`;
    return null;
  }
  const batch = s.magician.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批魔术师材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= MAGICIAN_LABOUR_STEPS ? '这批四次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成魔术师原瓶。';
  if (batch.materials.length !== MAGICIAN_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = MAGICIAN_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.unit && material.source === `占卜俱乐部魔术师备料第${batchNumber(batch)}批` && material.holder === 'PLAYER' && material.quantity === expected.quantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < MAGICIAN_PRICES.brewing ? '调配台使用需要60便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applyMagicianCommand(s: SliceState, command: MagicianAcquisitionCommand, c: SeerContext): void {
  rule(validateMagicianAcquisitionCommand(command), '魔术师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= MAGICIAN_PRICES.formula;
      s.magician.formulaKnown = true;
      c.note('记下魔术师配方', `花费1行动、240便士，向同一位${MAGICIAN_GUIDE}学习六项材料。四项辅材先入，再加入邪纹黑豹全部脊髓液，最后投入迷雾树人真实根茎。${MAGICIAN_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.magician.resupply.requestedWeek = s.week;
      c.note('申请下一轮魔术师材料', `花费1行动，向原${MAGICIAN_GUIDE}申请下一轮三批材料，并核对六料清单、整理备料记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批四次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.magician.batches.length + 1;
      s.magician.batches.push(...MAGICIAN_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.magician.resupply.deliveries += 1;
      s.magician.resupply.requestedWeek = null;
      c.note('魔术师新一轮备料到货', `原${MAGICIAN_GUIDE}确认第${firstNumber}至${firstNumber + 2}批六料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成四次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.magician.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      const tasks = ['抄录六料清单', '核对原料封签', '整理调配顺序', '清理调配场地'];
      c.note(`完成${tasks[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/4。${batch.labourSteps === MAGICIAN_LABOUR_STEPS ? '四次劳动抵本批1800便士主材费；仍须支付150便士辅材费，才会交付整批材料。' : '完成全部四次才能抵本批1800便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.magician.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('魔术师材料交付', `第${batchNumber(batch)}批六项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === MAGICIAN_LABOUR_STEPS ? '四次劳动已抵本批主材费，仅支付150便士辅材费。' : '主材1800便士、辅材150便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.magician.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= MAGICIAN_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.magician.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶魔术师魔药', `花费1行动、60便士，在导师指导下将第${batchNumber(batch)}批六项原材料调配成药。先放入四项辅材，再加入邪纹黑豹全部脊髓液，最后投入迷雾树人真实根茎。六项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。小丑扮演100且晋升后满8整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.magician.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.magician.clownActingAtPromotion = s.progression.acting;
        s.magician.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of MAGICIAN_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 2], ['will', 3], ['knowledge', 2]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为魔术师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+2、意志+3、知识+2。占卜家与小丑的九项旧掌握完整继承，九项魔术师能力从0开始；小丑消化成果保留，魔术师扮演从0开始。灵性上限提高到60，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了魔术师晋升' : '魔术师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是小丑，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }

  }
}

export function projectMagician(s: SliceState): MagicianProjection {
  const actions: MagicianAction[] = [];
  const available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: MagicianAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.magician.formulaKnown) add('learn-magician-formula', '请指导者讲解魔术师配方', '1行动 · 240便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.magician.resupply.requestedWeek !== null) {
        add('receive-magician-supply', '确认下一轮三批魔术师材料到货', `0行动 · 最早第${s.magician.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.magician)) {
        add('request-magician-supply', '向原指导者申请下一轮魔术师材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      const workLabels = ['抄录六料清单', '核对原料封签', '整理调配顺序', '清理调配场地'];
      for (const batch of s.magician.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < MAGICIAN_LABOUR_STEPS) add(`work-${batch.id}`, `第${number}批 · ${workLabels[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/4，完成四次抵1800便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取六项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === MAGICIAN_LABOUR_STEPS ? '（仅付四项辅材）' : '（主材1800＋辅材150）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配魔术师魔药`, '1行动 · 60便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.magician.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批魔术师原瓶`, `0行动 · 独立确认 · 小丑扮演${s.progression.acting}/100 · 晋升后${clownWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.magician.batches.filter(batch => !batch.acquired).length;
  const prepared = s.magician.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '魔术师 · 序列7' : '魔术师之路', discovered: available,
    formulaKnown: available && s.magician.formulaKnown, promoted: isPromoted,
    formula: available && s.magician.formulaKnown ? MAGICIAN_FORMULA.map(({ name, quantity, unit }) => ({ name, quantity, unit })) : [],
    actions,
    bottles: available ? s.magician.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 魔术师魔药`,
      source: `${MAGICIAN_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的六项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? MAGICIAN_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.faceless.magicianActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?'魔术师魔药已消化，原材料、原瓶与实践记录保留。':isPromoted ? `小丑消化成果${s.magician.clownActingAtPromotion}/100已保留；魔术师扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成小丑消化（${s.progression.acting}/100），并在小丑晋升后度过8整周（${clownWeeks(s)}/8）。配方与材料可以提前准备。` : '先走完小丑之路。',
    pollution: s.seer.pollution,
    practices: [],
    supplies: {
      figurinesHeld: isPromoted ? s.magician.figurinesHeld : 0,
      paperSheets: isPromoted ? s.clown.paperSheets : 0,
      oilHeld: isPromoted ? s.magician.lantern.oilHeld : 0,
      lanternPrepared: isPromoted && s.magician.lantern.prepared,
    },
    risk: available ? `步骤：配方指导 → 采购或四次劳动后领取材料 → 调配 → 独立确认服药。魔术师材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${MAGICIAN_CONSUMPTION_RISK}` : '成为小丑后，可向原有指导者了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const boundedId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
const uniqueIds = (value: unknown): value is string[] => Array.isArray(value) && value.every(boundedId) && new Set(value).size === value.length;

/** Keep acquisition exact even when the wider command union includes activities. */
export function validateMagicianAcquisitionCommand(value: unknown): value is MagicianAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^magician-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^magician-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  return false;
}

export function validateMagicianCommand(value: unknown): value is MagicianCommand {
  if (validateMagicianAcquisitionCommand(value)) return true;
  if (!record(value)) return false;
  if (['BUY_OIL', 'PREPARE_LANTERN', 'PREPARE_FIGURINE', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (value.type === 'PRACTICE') return shape(value, ['type', 'practiceId']) && boundedId(value.practiceId);
  if (value.type === 'TRANSFER_INJURY') return shape(value, ['type', 'injuryId']) && boundedId(value.injuryId);
  return false;
}

/** Finite original materials, bottles, promotions and consumable conservation; activities own their outcomes. */
export function validateMagicianState(s: SliceState): boolean {
  const raw: unknown = s.magician;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'clownActingAtPromotion', 'practices', 'practiceAttempts', 'figurinesMade', 'figurinesHeld', 'figurinesUsed', 'lantern', 'damageTransfers', 'reflected', 'encounter']) || typeof raw.formulaKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.seer) || !record(s.clown)) return false;
  const firstConsumptionWeek = (s.clown.promotionWeek ?? s.week) + MAGICIAN_MIN_CLOWN_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries as number;
  if (!Array.isArray(raw.batches) || raw.batches.length !== 3 * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (!uniqueIds(raw.practices) || !uniqueIds(raw.damageTransfers) || !record(raw.practiceAttempts) || !Object.keys(raw.practiceAttempts).every(boundedId) || !Object.values(raw.practiceAttempts).every(week => integer(week, firstConsumptionWeek, s.week))) return false;
  if (![raw.figurinesMade, raw.figurinesHeld, raw.figurinesUsed].every(value => integer(value, 0, s.clown.paperSpent)) || raw.figurinesMade !== (raw.figurinesHeld as number) + (raw.figurinesUsed as number)) return false;
  if (!record(raw.lantern) || !shape(raw.lantern, ['oilStock', 'oilHeld', 'oilSpent', 'prepared', 'deliveries', 'lastSupplyWeek']) || typeof raw.lantern.prepared !== 'boolean') return false;
  if (!integer(raw.lantern.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.lantern.lastSupplyWeek !== null && !integer(raw.lantern.lastSupplyWeek, firstConsumptionWeek, s.week)) return false;
  const oilTotal = MAGICIAN_OIL_STOCK * ((raw.lantern.deliveries as number) + 1);
  if (!integer(raw.lantern.oilStock, 0, MAGICIAN_OIL_STOCK) || ![raw.lantern.oilHeld, raw.lantern.oilSpent].every(value => integer(value, 0, oilTotal)) || (raw.lantern.oilStock as number) + (raw.lantern.oilHeld as number) + (raw.lantern.oilSpent as number) !== oilTotal || raw.lantern.prepared && raw.lantern.oilSpent === 0) return false;
  if ((raw.lantern.lastSupplyWeek === null) !== (raw.lantern.deliveries === 0 && raw.lantern.oilStock === MAGICIAN_OIL_STOCK && raw.lantern.oilHeld === 0 && raw.lantern.oilSpent === 0)) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  if (raw.encounter.startHistoryIndex !== null && !integer(raw.encounter.startHistoryIndex, 0) || raw.encounter.attemptWeek !== null && !integer(raw.encounter.attemptWeek, firstConsumptionWeek, s.week)) return false;
  const magician = raw as unknown as MagicianState, isPromoted = promoted(s);
  if (magician.formulaKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!magician.formulaKnown || !integer(s.clown.promotionWeek, 1, s.week) || !integer(magician.promotionWeek, firstConsumptionWeek, s.week) || magician.clownActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...SEER_ABILITY_IDS, ...CLOWN_ABILITY_IDS, ...MAGICIAN_ABILITY_IDS,...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?FACELESS_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?MARIONETTIST_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?BIZARRO_SORCERER_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?ANCIENT_SCHOLAR_ABILITY_IDS:[]),...(s.progression.sequence===2?MIRACLE_WORKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
    if (Object.values(magician.practiceAttempts).some(week => week < magician.promotionWeek!) || magician.encounter.attemptWeek !== null && magician.encounter.attemptWeek < magician.promotionWeek!) return false;
    if (magician.lantern.deliveries > s.week - magician.promotionWeek! || magician.lantern.lastSupplyWeek !== null && magician.lantern.lastSupplyWeek < magician.promotionWeek! + magician.lantern.deliveries) return false;
  } else {
    if (magician.promotionWeek !== null || magician.clownActingAtPromotion !== null || MAGICIAN_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (magician.practices.length || Object.keys(magician.practiceAttempts).length || magician.damageTransfers.length || magician.figurinesMade || magician.figurinesHeld || magician.figurinesUsed || magician.lantern.oilStock !== MAGICIAN_OIL_STOCK || magician.lantern.oilHeld || magician.lantern.oilSpent || magician.lantern.prepared || magician.lantern.deliveries || magician.lantern.lastSupplyWeek !== null || magician.reflected || magician.encounter.status !== 'AVAILABLE' || magician.encounter.startHistoryIndex !== null || magician.encounter.attemptWeek !== null) return false;
  }
  // Validate every record before traversing cross-references, including truncated or hostile input.
  for (const [index, batch] of magician.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `magician-batch-${index + 1}` || !integer(batch.labourSteps, 0, MAGICIAN_LABOUR_STEPS) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== MAGICIAN_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !magician.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = MAGICIAN_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || material.source !== `占卜俱乐部魔术师备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.quantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of magician.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, s.clown.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  }
  let successfulBottles = 0;
  for (const batch of magician.batches) if (magician.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  for (const bottle of magician.bottles) {
    if (isPromoted && bottle.brewedWeek > magician.promotionWeek!) return false;
    const batch = magician.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== MAGICIAN_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.clown.promotionWeek === null || s.week < firstConsumptionWeek || !isPromoted && s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successfulBottles += 1;
      if (magician.promotionWeek === null || bottle.brewedWeek > magician.promotionWeek) return false;
    }
  }
  if (!magician.batches.slice(0, deliveries * 3).every(batch => failedBatch(magician, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(magician.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = magician.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.brewedWeek)) + 1;
  }
  if (magician.resupply.requestedWeek !== null && (!magician.formulaKnown || isPromoted || !exhaustedSupply(magician) || magician.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...magician.bottles.map(bottle => bottle.brewedWeek)))) return false;
  return successfulBottles === (isPromoted ? 1 : 0);
}
