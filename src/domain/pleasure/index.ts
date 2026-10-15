import { CALAMITY_DEMONESS_ABILITY_IDS } from '../calamity-demoness/types.js';
import {UNAGING_DEMONESS_ABILITY_IDS} from '../unaging-demoness/types.js';
import {DESPAIR_ABILITY_IDS} from '../despair/types.js';
import {PAIN_ABILITY_IDS} from '../pain/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { ASSASSIN_ABILITY_IDS } from '../assassin/types.js';
import { INSTIGATOR_ABILITY_IDS } from '../instigator/types.js';
import { WITCH_ABILITY_IDS } from '../witch/types.js';
import { pleasureInside, pleasureActions, pleasureCases, PLEASURE_ENVIRONMENT, validatePleasureActivityCommand, validatePleasureLife } from './life.js';
import {
  PLEASURE_ABILITIES, PLEASURE_BATCH_IDS, PLEASURE_CONSUMPTION_RISK, PLEASURE_FORMULA,
  PLEASURE_FORMULA_SOURCE, PLEASURE_GUIDE, PLEASURE_MIN_WITCH_WEEKS, PLEASURE_PRICES, PLEASURE_LABOUR_STEPS,
  PLEASURE_LABOUR_TASKS, PLEASURE_SOURCE_STATUS,
} from './content.js';
import {
  PLEASURE_ABILITY_IDS, PLEASURE_CASE_IDS, type PleasureCommand, type PleasureAcquisitionCommand, type PleasureAction, type PleasureBatch,
  type PleasureProjection, type PleasureState,
} from './types.js';

function createBatch(number: number): PleasureBatch {
  const id = `pleasure-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: PLEASURE_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.supplyQuantity, unit: material.supplyUnit,
      source: `原独立练习场欢愉魔女备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createPleasureState(): PleasureState {
  return {
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: PLEASURE_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, witchActingAtPromotion: null,
    cases: Object.fromEntries(PLEASURE_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0, notes: 0, revised: false }])) as PleasureState['cases'],
    reflected: false,
    practice: { wrist: 'FREE', wristConsent: false, invitationWilling: false, fireSilk: 'NONE', fireBreak: 'NONE' },
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, silkPrepared: false, boundRound: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'demoness' && (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isWitch = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.assassin.discovered && s.assassin.guidanceKnown && s.instigator.guidanceKnown && s.witch.formulaKnown && (isWitch(s) || promoted(s));
const materialPrice = (batch: PleasureBatch) => PLEASURE_PRICES.auxiliaryMaterials + (batch.labourSteps === PLEASURE_LABOUR_STEPS ? 0 : PLEASURE_PRICES.mainMaterials);
const bottleId = (batch: PleasureBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<PleasureBatch, 'id'>) => Number(batch.id.slice('pleasure-batch-'.length));
const witchWeeks = (s: SliceState) => Math.max(0, (s.pleasure.promotionWeek ?? s.week) - (s.witch.promotionWeek ?? s.week));
const failedBatch = (pleasure: PleasureState, batch: PleasureBatch) => batch.brewed && pleasure.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (pleasure: PleasureState) => pleasure.batches.length >= 3 && pleasure.bottles.length === pleasure.batches.length && pleasure.batches.every(batch => failedBatch(pleasure, batch));

function commandBlock(s: SliceState, command: PleasureAcquisitionCommand): string | null {
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (Object.values(s.pleasure.cases).some(scene => scene.contactOpen)) return '先实际结束本次欢愉魔女实践的接触，再继续。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原独立练习场。';
  if (!knownChannel(s)) return '成为女巫并保有指导者渠道后，才能继续欢愉魔女之路。';
  if (promoted(s)) return '你已完成欢愉魔女晋升，不能重复服用或继续准备这份魔药。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.pleasure.formulaKnown) return '已经掌握欢愉魔女配方。';
    return s.cash < PLEASURE_PRICES.formula ? '欢愉魔女配方指导需要360便士。' : null;
  }
  if (!s.pleasure.formulaKnown) return '先完成欢愉魔女配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.pleasure.resupply.requestedWeek !== null) return '已经向指导者申请下一轮欢愉魔女材料，请等到下一个真实周。';
    return exhaustedSupply(s.pleasure) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.pleasure.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮欢愉魔女材料并完成备料准备。';
    if (!exhaustedSupply(s.pleasure)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.pleasure.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选欢愉魔女原瓶不存在或已经用完。';
    if (s.progression.acting < 100) return `女巫魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.witch.promotionWeek === null || witchWeeks(s) < PLEASURE_MIN_WITCH_WEEKS) return `成为女巫后已度过${witchWeeks(s)}/${PLEASURE_MIN_WITCH_WEEKS}整周，尚不能服药。`;
    return null;
  }
  const batch = s.pleasure.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批欢愉魔女材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= PLEASURE_LABOUR_STEPS ? '这批五次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成欢愉魔女原瓶。';
  if (batch.materials.length !== PLEASURE_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = PLEASURE_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.supplyUnit && material.source === `原独立练习场欢愉魔女备料第${batchNumber(batch)}批` && material.holder === 'PLAYER' && material.quantity === expected.supplyQuantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < PLEASURE_PRICES.brewing ? '调配台使用需要80便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applyPleasureAcquisition(s: SliceState, command: PleasureAcquisitionCommand, c: SeerContext): void {
  rule(validPleasureAcquisitionCommand(command), '欢愉魔女准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= PLEASURE_PRICES.formula;
      s.pleasure.formulaKnown = true;
      c.note('记下欢愉魔女配方', `花费1行动、360便士，向同一位${PLEASURE_GUIDE}学习七项材料。七项数量均已核；本次使用导师的本作G操作规程，不冒称原著投料次序。${PLEASURE_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.pleasure.resupply.requestedWeek = s.week;
      c.note('申请下一轮欢愉魔女材料', `花费1行动，向原${PLEASURE_GUIDE}申请下一轮三批材料，并核对七料清单、整理备料记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批五次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.pleasure.batches.length + 1;
      s.pleasure.batches.push(...PLEASURE_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.pleasure.resupply.deliveries += 1;
      s.pleasure.resupply.requestedWeek = null;
      c.note('欢愉魔女新一轮备料到货', `原${PLEASURE_GUIDE}确认第${firstNumber}至${firstNumber + 2}批七料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成五次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.pleasure.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      c.note(`完成${PLEASURE_LABOUR_TASKS[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/5。${batch.labourSteps === PLEASURE_LABOUR_STEPS ? '五次劳动抵本批3000便士主材费；仍须支付240便士辅材费，才会交付整批材料。' : '完成全部五次才能抵本批3000便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.pleasure.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('欢愉魔女材料交付', `第${batchNumber(batch)}批七项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === PLEASURE_LABOUR_STEPS ? '五次劳动已抵本批主材费，仅支付240便士辅材费。' : '主材3000便士、辅材240便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.pleasure.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= PLEASURE_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.pleasure.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶欢愉魔女魔药', `花费1行动、80便士，在导师指导下将第${batchNumber(batch)}批七项原材料调配成药。七项材料及数量均有原著依据；具体操作次序采用本作G导师规程，不把该次序称作原著事实。七项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。女巫扮演100且晋升后满12整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.pleasure.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.pleasure.witchActingAtPromotion = s.progression.acting;
        s.pleasure.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of PLEASURE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为欢愉魔女', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质、感知、意志与知识各+1。原刺客、教唆者与女巫的全部能力掌握完整继承，欢愉魔女新增两项从0开始；女巫消化成果保留，欢愉魔女扮演从0开始。灵性上限提高到80，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了欢愉魔女晋升' : '欢愉魔女魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是女巫，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }

  }
}

export function projectPleasure(s: SliceState): PleasureProjection {
  const actions: PleasureAction[] = [];
  const available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: PleasureAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.pleasure.formulaKnown) add('learn-pleasure-formula', '请指导者讲解欢愉魔女配方', '1行动 · 360便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.pleasure.resupply.requestedWeek !== null) {
        add('receive-pleasure-supply', '确认下一轮三批欢愉魔女材料到货', `0行动 · 最早第${s.pleasure.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.pleasure)) {
        add('request-pleasure-supply', '向原指导者申请下一轮欢愉魔女材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      for (const batch of s.pleasure.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < PLEASURE_LABOUR_STEPS) add(`work-${batch.id}`, `第${number}批 · ${PLEASURE_LABOUR_TASKS[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/5，完成五次抵3000便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取七项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === PLEASURE_LABOUR_STEPS ? '（仅付五项辅材）' : '（主材3000＋辅材240）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配欢愉魔女魔药`, '1行动 · 80便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.pleasure.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批欢愉魔女原瓶`, `0行动 · 独立确认 · 女巫扮演${s.progression.acting}/100 · 晋升后${witchWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.pleasure.batches.filter(batch => !batch.acquired).length;
  const prepared = s.pleasure.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '欢愉魔女 · 序列6' : '欢愉魔女之路', discovered: available,
    formulaKnown: available && s.pleasure.formulaKnown, promoted: isPromoted,
    formula: available && s.pleasure.formulaKnown ? PLEASURE_FORMULA.map(material => ({ name: material.name, quantity: material.quantity, unit: material.unit, ...('note' in material ? { note: material.note } : {}) })) : [],
    actions: [...actions, ...pleasureActions(s)],
    practice: { ...s.pleasure.practice },
    inheritedTools: `原女巫耗材仍可使用：粉末${s.witch.tools.powderHeld}份，小镜${s.witch.tools.mirrorsHeld}面；${s.witch.tools.mirrorPrepared ? '已单独准备一面替身镜' : '尚未单独准备替身镜'}。补给60便士、1行动；备镜0行动、0灵性，战斗实际消耗原镜。`,
    bodyChange: '保留原女巫晋升后的身体与性别记录；本阶段不再强制改变，不替玩家决定自称、关系或意愿。',
    bottles: available ? s.pleasure.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 欢愉魔女魔药`,
      source: `${PLEASURE_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的七项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? PLEASURE_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.pain.pleasureActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?'欢愉魔女魔药已消化，原丝线、本人意愿、工具和身体变化记录保留。':isPromoted ? `女巫消化成果${s.pleasure.witchActingAtPromotion}/100已保留；欢愉魔女扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成女巫消化（${s.progression.acting}/100），并在女巫晋升后度过12整周（${witchWeeks(s)}/12）。配方与材料可以提前准备。` : '先走完女巫之路。',
    pollution: s.seer.pollution,
    cases: isPromoted ? pleasureCases(s) : [], insideCase: pleasureInside(s), environment: PLEASURE_ENVIRONMENT,
    ...(available ? { story: `${s.pleasure.formulaKnown ? PLEASURE_FORMULA_SOURCE : '沿原独立导师渠道学习下一序列的完整配方；尚未完成配方指导。'}${PLEASURE_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。每批七项原料独立持有、消耗并制成唯一原瓶。${s.pleasure.resupply.requestedWeek === null ? `已实际接收后续材料${s.pleasure.resupply.deliveries}轮，每轮3批。` : `第${s.pleasure.resupply.requestedWeek}周申请，下一个真实周起收货。`}` : '',
    risk: available ? `步骤：配方指导 → 采购或五次劳动后领取材料 → 调配 → 独立确认服药。欢愉魔女材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${PLEASURE_CONSUMPTION_RISK}` : '成为女巫后，可向原有指导者了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validPleasureAcquisitionCommand(value: unknown): value is PleasureAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^pleasure-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^pleasure-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  return false;
}
export function isPleasureAcquisitionCommand(command: PleasureCommand): command is PleasureAcquisitionCommand { return validPleasureAcquisitionCommand(command); }
export function validPleasureCommand(value: unknown): value is PleasureCommand { return validPleasureAcquisitionCommand(value) || validatePleasureActivityCommand(value); }

/** Original materials, independent bottles, finite replenishment and inherited progression. */
export function validPleasureState(s: SliceState): boolean {
  const raw: unknown = s.pleasure;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'witchActingAtPromotion', 'cases', 'reflected', 'practice', 'encounter']) || typeof raw.formulaKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.seer) || !record(s.assassin) || !record(s.instigator) || !record(s.witch) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory)) return false;
  const firstConsumptionWeek = (s.witch.promotionWeek ?? s.week) + PLEASURE_MIN_WITCH_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries;
  if (!Array.isArray(raw.batches) || raw.batches.length !== PLEASURE_BATCH_IDS.length * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek', 'silkPrepared', 'boundRound']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  if (raw.encounter.startHistoryIndex !== null && !integer(raw.encounter.startHistoryIndex, 0, s.combatHistory.length) || raw.encounter.attemptWeek !== null && !integer(raw.encounter.attemptWeek, firstConsumptionWeek, s.week)) return false;
  const f = raw as unknown as PleasureState, isPromoted = promoted(s);
  if (f.formulaKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!f.formulaKnown || !integer(s.witch.promotionWeek, 1, s.week) || !integer(f.promotionWeek, firstConsumptionWeek, s.week) || f.witchActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS, ...WITCH_ABILITY_IDS, ...PLEASURE_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?PAIN_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DESPAIR_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?UNAGING_DEMONESS_ABILITY_IDS:[]),...(s.progression.sequence===2?CALAMITY_DEMONESS_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
    if (f.encounter.attemptWeek !== null && f.encounter.attemptWeek < f.promotionWeek) return false;
  } else {
    if (f.reflected || !record(f.cases) || Object.values(f.cases).some(r => !record(r) || r.status !== 'AVAILABLE' || r.attemptWeek !== null || r.method !== null || r.outcome !== 'NONE' || r.withdrawals !== 0 || r.contactOpen || r.closes !== 0 || r.notes !== 0 || r.revised)) return false;
    if (f.promotionWeek !== null || f.witchActingAtPromotion !== null || PLEASURE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (f.encounter.status !== 'AVAILABLE' || f.encounter.startHistoryIndex !== null || f.encounter.attemptWeek !== null || f.encounter.silkPrepared || f.encounter.boundRound !== null) return false;
  }
  if (!validatePleasureLife(s)) return false;
  const e = f.encounter;
  if (typeof e.silkPrepared !== 'boolean' || e.boundRound !== null && !integer(e.boundRound, 1, s.combat?.round ?? 0)) return false;
  if (e.status !== 'FIGHTING' && (e.silkPrepared || e.boundRound !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'PLEASURE_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(f.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || f.practice.wrist !== 'FREE' || f.practice.fireSilk === 'ON_FRAME' || Object.values(f.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'pleasure-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  // Check records before following cross-references; hostile saves return false, not a crash.
  for (const [index, batch] of f.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `pleasure-batch-${index + 1}` || !integer(batch.labourSteps, 0, PLEASURE_LABOUR_STEPS) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== PLEASURE_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !f.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = PLEASURE_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.supplyUnit || material.source !== `原独立练习场欢愉魔女备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.supplyQuantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of f.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, s.witch.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  }
  let successfulBottles = 0;
  for (const batch of f.batches) if (f.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  for (const bottle of f.bottles) {
    if (isPromoted && bottle.brewedWeek > f.promotionWeek!) return false;
    const batch = f.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== PLEASURE_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.witch.promotionWeek === null || s.week < firstConsumptionWeek || !isPromoted && s.progression.acting !== 100) return false;
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
export const applyPleasureCommand = applyPleasureAcquisition;
export const validatePleasureState = validPleasureState;
export const validatePleasureCommand = validPleasureCommand;
export const validatePleasureAcquisitionCommand = validPleasureAcquisitionCommand;
export { applyPleasureActivity } from './life.js';
export { PLEASURE_ABILITIES } from './content.js';
export type * from './types.js';
