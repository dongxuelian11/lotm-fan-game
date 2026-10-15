import { WRITER_ABILITY_IDS } from '../writer/types.js';
import {DISCERNER_ABILITY_IDS} from '../discerner/types.js';
import {DREAM_WEAVER_ABILITY_IDS} from '../dream-weaver/types.js';
import {MANIPULATOR_ABILITY_IDS} from '../manipulator/types.js';
import {DREAMWALKER_ABILITY_IDS} from '../dreamwalker/types.js';
import {HYPNOTIST_ABILITY_IDS} from '../hypnotist/types.js';
import {PSYCHOLOGIST_ABILITY_IDS} from '../psychologist/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { AUDIENCE_ABILITY_IDS } from '../audience/types.js';
import {
  MINDREADER_ABILITIES, MINDREADER_BATCH_IDS, MINDREADER_CONSUMPTION_RISK, MINDREADER_FORMULA,
  MINDREADER_FORMULA_SOURCE, MINDREADER_GUIDE, MINDREADER_MIN_AUDIENCE_WEEKS, MINDREADER_PRICES,
} from './content.js';
import {
  MINDREADER_ABILITY_IDS, MINDREADER_CASE_IDS, type MindreaderCommand, type MindreaderAcquisitionCommand, type MindreaderAction, type MindreaderBatch,
  type MindreaderProjection, type MindreaderState,
} from './types.js';

function createBatch(number: number): MindreaderBatch {
  const id = `mindreader-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: MINDREADER_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.quantity, unit: material.unit,
      source: `阅览室读心者备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createMindreaderState(): MindreaderState {
  return {
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: MINDREADER_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, audienceActingAtPromotion: null,
    cases: Object.fromEntries(MINDREADER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', readWeek: null, readSucceeded: false, attemptWeek: null, approach: null }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'audience' && (s.progression.sequence === 8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))));
const isAudience = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.audience.discovered && s.audience.formulaKnown && (isAudience(s) || promoted(s));
const materialPrice = (batch: MindreaderBatch) => MINDREADER_PRICES.auxiliaryMaterials + (batch.labourSteps === 3 ? 0 : MINDREADER_PRICES.mainMaterials);
const bottleId = (batch: MindreaderBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<MindreaderBatch, 'id'>) => Number(batch.id.slice('mindreader-batch-'.length));
const audienceWeeks = (s: SliceState) => Math.max(0, (s.mindreader.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const failedBatch = (mindreader: MindreaderState, batch: MindreaderBatch) => batch.brewed && mindreader.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (mindreader: MindreaderState) => mindreader.batches.length >= 3 && mindreader.bottles.length === mindreader.batches.length && mindreader.batches.every(batch => failedBatch(mindreader, batch));

function commandBlock(s: SliceState, command: MindreaderAcquisitionCommand): string | null {
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的阅览室。';
  if (!knownChannel(s)) return '成为观众并保有指导者渠道后，才能继续读心者之路。';
  if (promoted(s)) return '你已完成读心者晋升，不能重复服用或继续准备这份魔药。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.mindreader.formulaKnown) return '已经掌握读心者配方。';
    return s.cash < MINDREADER_PRICES.formula ? '读心者配方指导需要180便士。' : null;
  }
  if (!s.mindreader.formulaKnown) return '先完成读心者配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.mindreader.resupply.requestedWeek !== null) return '已经向指导者申请下一轮读心者材料，请等到下一个真实周。';
    return exhaustedSupply(s.mindreader) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.mindreader.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮读心者材料并完成备料准备。';
    if (!exhaustedSupply(s.mindreader)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.mindreader.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选读心者原瓶不存在或已经用完。';
    if (s.progression.acting < 100) return `观众魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || audienceWeeks(s) < MINDREADER_MIN_AUDIENCE_WEEKS) return `成为观众后已度过${audienceWeeks(s)}/${MINDREADER_MIN_AUDIENCE_WEEKS}整周，尚不能服药。`;
    return null;
  }
  const batch = s.mindreader.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批读心者材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= 3 ? '这批三次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成读心者原瓶。';
  if (batch.materials.length !== MINDREADER_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = MINDREADER_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.unit && material.holder === 'PLAYER' && material.quantity === expected.quantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < MINDREADER_PRICES.brewing ? '调配台使用需要60便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applyMindreaderCommand(s: SliceState, command: MindreaderAcquisitionCommand, c: SeerContext): void {
  rule(validateMindreaderCommand(command) && !['OBSERVE', 'READ', 'DISCUSS', 'REFLECT'].includes(command.type), '读心者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= MINDREADER_PRICES.formula;
      s.mindreader.formulaKnown = true;
      c.note('记下读心者配方', `花费1行动、180便士，向同一位${MINDREADER_GUIDE}学习六项材料。${MINDREADER_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.mindreader.resupply.requestedWeek = s.week;
      c.note('申请下一轮读心者材料', `花费1行动，向原${MINDREADER_GUIDE}申请下一轮三批材料，并核对六料清单、整理备料记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批三次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.mindreader.batches.length + 1;
      s.mindreader.batches.push(...MINDREADER_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.mindreader.resupply.deliveries += 1;
      s.mindreader.resupply.requestedWeek = null;
      c.note('读心者新一轮备料到货', `原${MINDREADER_GUIDE}确认第${firstNumber}至${firstNumber + 2}批六料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成三次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.mindreader.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      const tasks = ['抄录配方目录', '整理备料记录', '清理调配场地'];
      c.note(`完成${tasks[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/3。${batch.labourSteps === 3 ? '三次劳动抵本批1200便士主材费；仍须支付110便士辅材费，才会交付整批材料。' : '完成全部三次才能抵本批1200便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.mindreader.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('读心者材料交付', `第${batchNumber(batch)}批六项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === 3 ? '三次劳动已抵本批主材费，仅支付110便士辅材费。' : '主材1200便士、辅材110便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.mindreader.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= MINDREADER_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.mindreader.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶读心者魔药', `花费1行动、60便士，在导师指导下将第${batchNumber(batch)}批六项原材料调配成药。此处不宣称尚未核实的原著投料顺序。六项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。观众扮演100且晋升后满6整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.mindreader.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.mindreader.audienceActingAtPromotion = s.progression.acting;
        s.mindreader.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of MINDREADER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['perception', 3], ['will', 3], ['knowledge', 2]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为读心者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质不变、感知+3、意志+3、知识+2。三项观众掌握完整继承，新增读心能力从0开始；观众消化成果保留，读心者扮演从0开始。灵性上限提高到45，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了读心者晋升' : '读心者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是观众，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }

  }
}

export function projectMindreader(s: SliceState): MindreaderProjection {
  const actions: MindreaderAction[] = [];
  const available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: MindreaderAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.mindreader.formulaKnown) add('learn-mindreader-formula', '请指导者讲解读心者配方', '1行动 · 180便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.mindreader.resupply.requestedWeek !== null) {
        add('receive-mindreader-supply', '确认下一轮三批读心者材料到货', `0行动 · 最早第${s.mindreader.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.mindreader)) {
        add('request-mindreader-supply', '向原指导者申请下一轮读心者材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      const workLabels = ['抄录配方目录', '整理备料记录', '清理调配场地'];
      for (const batch of s.mindreader.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < 3) add(`work-${batch.id}`, `第${number}批 · ${workLabels[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/3，完成三次抵1200便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取六项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === 3 ? '（仅付四项辅材）' : '（主材1200＋辅材110）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配读心者魔药`, '1行动 · 60便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.mindreader.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批读心者原瓶`, `0行动 · 独立确认 · 观众扮演${s.progression.acting}/100 · 晋升后${audienceWeeks(s)}/6整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.mindreader.batches.filter(batch => !batch.acquired).length;
  const prepared = s.mindreader.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '读心者 · 序列8' : '读心者之路', discovered: available,
    formulaKnown: available && s.mindreader.formulaKnown, promoted: isPromoted,
    formula: available && s.mindreader.formulaKnown ? MINDREADER_FORMULA.map(({ name, quantity, unit }) => ({ name, quantity, unit })) : [],
    actions,
    bottles: available ? s.mindreader.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 读心者魔药`,
      source: `${MINDREADER_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的六项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? MINDREADER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?s.psychologist.mindreaderActingAtPromotion??100:s.progression.acting) : 0,
    digestion:s.progression.pathwayId==='audience'&&(s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?'读心者魔药已消化，原有谈话与浅层读取记录保留。':isPromoted ? `观众消化成果${s.mindreader.audienceActingAtPromotion}/100已保留；读心者扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成观众消化（${s.progression.acting}/100），并在观众晋升后度过6整周（${audienceWeeks(s)}/6）。配方与材料可以提前准备。` : '先走完观众之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：配方指导 → 采购或三次劳动后领取材料 → 调配 → 独立确认服药。读心者材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${MINDREADER_CONSUMPTION_RISK}` : '成为观众后，可向原有指导者了解下一序列。',
    scenes: [],
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Exact command boundaries are shared by the renderer bridge and acquisition entry point. */
export function validateMindreaderCommand(value: unknown): value is MindreaderCommand {
  if (!record(value)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^mindreader-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^mindreader-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  if (['OBSERVE', 'READ'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && MINDREADER_CASE_IDS.includes(value.caseId as typeof MINDREADER_CASE_IDS[number]);
  if (value.type === 'DISCUSS') return shape(value, ['type', 'caseId', 'approach']) && MINDREADER_CASE_IDS.includes(value.caseId as typeof MINDREADER_CASE_IDS[number]) && ['ASK', 'VERIFY'].includes(value.approach as string);
  return false;
}

/** Acquisition owns finite batches, original bottles and promotion. Social history is validated separately. */
export function validateMindreaderState(s: SliceState): boolean {
  const raw: unknown = s.mindreader;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'audienceActingAtPromotion', 'cases', 'reflected']) || typeof raw.formulaKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.audience)) return false;
  const firstConsumptionWeek = (s.progression.promotionWeek ?? s.week) + MINDREADER_MIN_AUDIENCE_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries as number;
  if (!Array.isArray(raw.batches) || raw.batches.length !== 3 * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (!record(raw.cases) || !shape(raw.cases, MINDREADER_CASE_IDS)) return false;
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'readWeek', 'readSucceeded', 'attemptWeek', 'approach']) || !['AVAILABLE', 'OBSERVED', 'RESOLVED'].includes(value.status as string) || typeof value.readSucceeded !== 'boolean') return false;
    if (value.readWeek !== null && !integer(value.readWeek, firstConsumptionWeek, s.week) || value.attemptWeek !== null && !integer(value.attemptWeek, firstConsumptionWeek, s.week)) return false;
    if (value.approach !== null && !['ASK', 'VERIFY'].includes(value.approach as string)) return false;
    if (value.readSucceeded && value.readWeek === null || (value.attemptWeek === null) !== (value.approach === null)) return false;
    if (value.status === 'AVAILABLE' && (value.readWeek !== null || value.readSucceeded || value.attemptWeek !== null || value.approach !== null)) return false;
    if (value.status === 'RESOLVED' && value.attemptWeek === null) return false;
  }
  const mindreader = raw as unknown as MindreaderState, isPromoted = promoted(s);
  if (mindreader.formulaKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!mindreader.formulaKnown || !integer(s.progression.promotionWeek, 5, s.week) || !integer(mindreader.promotionWeek, firstConsumptionWeek, s.week) || mindreader.audienceActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?WRITER_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?DISCERNER_ABILITY_IDS:[]),...AUDIENCE_ABILITY_IDS, ...MINDREADER_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?PSYCHOLOGIST_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?HYPNOTIST_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?DREAMWALKER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?MANIPULATOR_ABILITY_IDS:[]),...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?DREAM_WEAVER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
    if (Object.values(mindreader.cases).some(value => value.readWeek !== null && value.readWeek < mindreader.promotionWeek! || value.attemptWeek !== null && value.attemptWeek < mindreader.promotionWeek!)) return false;
  } else {
    if (mindreader.promotionWeek !== null || mindreader.audienceActingAtPromotion !== null || MINDREADER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (mindreader.reflected || Object.values(mindreader.cases).some(value => value.status !== 'AVAILABLE' || value.readWeek !== null || value.readSucceeded || value.attemptWeek !== null || value.approach !== null)) return false;
  }
  // Validate all records before traversing bottle references, including malicious or truncated saves.
  for (const [index, batch] of mindreader.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `mindreader-batch-${index + 1}` || !integer(batch.labourSteps, 0, 3) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== MINDREADER_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !mindreader.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = MINDREADER_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || material.source !== `阅览室读心者备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.quantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of mindreader.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, s.progression.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  }
  let successfulBottles = 0;
  for (const batch of mindreader.batches) if (mindreader.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  for (const bottle of mindreader.bottles) {
    if (isPromoted && bottle.brewedWeek > mindreader.promotionWeek!) return false;
    const batch = mindreader.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== MINDREADER_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.progression.promotionWeek === null || s.week < firstConsumptionWeek || !isPromoted && s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successfulBottles += 1;
      if (mindreader.promotionWeek === null || bottle.brewedWeek > mindreader.promotionWeek) return false;
    }
  }
  if (!mindreader.batches.slice(0, deliveries * 3).every(batch => failedBatch(mindreader, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(mindreader.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = mindreader.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.brewedWeek)) + 1;
  }
  if (mindreader.resupply.requestedWeek !== null && (!mindreader.formulaKnown || isPromoted || !exhaustedSupply(mindreader) || mindreader.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...mindreader.bottles.map(bottle => bottle.brewedWeek)))) return false;
  return successfulBottles === (isPromoted ? 1 : 0);
}
