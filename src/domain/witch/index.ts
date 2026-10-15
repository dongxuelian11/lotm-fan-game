import { CALAMITY_DEMONESS_ABILITY_IDS } from '../calamity-demoness/types.js';
import {UNAGING_DEMONESS_ABILITY_IDS} from '../unaging-demoness/types.js';
import {DESPAIR_ABILITY_IDS} from '../despair/types.js';
import {PAIN_ABILITY_IDS} from '../pain/types.js';
import {PLEASURE_ABILITY_IDS} from '../pleasure/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { INSTIGATOR_ABILITY_IDS } from '../instigator/types.js';
import { ASSASSIN_ABILITY_IDS } from '../assassin/types.js';
import {
  WITCH_ABILITIES, WITCH_BATCH_IDS, WITCH_CONSUMPTION_RISK, WITCH_FORMULA,
  WITCH_FORMULA_SOURCE, WITCH_GUIDE, WITCH_MIN_INSTIGATOR_WEEKS, WITCH_PRICES, WITCH_LABOUR_STEPS,
  WITCH_LABOUR_TASKS, WITCH_SOURCE_STATUS, WITCH_BODY_CHANGE,
} from './content.js';
import {
  WITCH_ABILITY_IDS, WITCH_CASE_IDS, type WitchCommand, type WitchAcquisitionCommand, type WitchAction, type WitchBatch,
  type WitchProjection, type WitchState,
} from './types.js';

function createBatch(number: number): WitchBatch {
  const id = `witch-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: WITCH_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.supplyQuantity, unit: material.supplyUnit,
      source: `独立练习场收货处女巫备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createWitchState(): WitchState {
  return {
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: WITCH_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, instigatorActingAtPromotion: null,
    cases: Object.fromEntries(WITCH_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE' }])),
    reflected: false, previousGender: null,
    tools: { kitsBought: 0, powderHeld: 0, powderUsed: 0, mirrorsHeld: 0, mirrorsUsed: 0, lastPurchaseWeek: null, mirrorPrepared: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'demoness' && (s.progression.sequence === 7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const isInstigator = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.assassin.discovered && s.assassin.guidanceKnown && s.instigator.guidanceKnown && (isInstigator(s) || promoted(s));
const materialPrice = (batch: WitchBatch) => WITCH_PRICES.auxiliaryMaterials + (batch.labourSteps === WITCH_LABOUR_STEPS ? 0 : WITCH_PRICES.mainMaterials);
const bottleId = (batch: WitchBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<WitchBatch, 'id'>) => Number(batch.id.slice('witch-batch-'.length));
const instigatorWeeks = (s: SliceState) => Math.max(0, (s.witch.promotionWeek ?? s.week) - (s.instigator.promotionWeek ?? s.week));
const failedBatch = (witch: WitchState, batch: WitchBatch) => batch.brewed && witch.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (witch: WitchState) => witch.batches.length >= 3 && witch.bottles.length === witch.batches.length && witch.batches.every(batch => failedBatch(witch, batch));

function commandBlock(s: SliceState, command: WitchAcquisitionCommand): string | null {
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的独立练习场收货处。';
  if (!knownChannel(s)) return '成为教唆者并保有指导者渠道后，才能继续女巫之路。';
  if (promoted(s)) return '你已完成女巫晋升，不能重复服用或继续准备这份魔药。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.witch.formulaKnown) return '已经掌握女巫配方。';
    return s.cash < WITCH_PRICES.formula ? '女巫配方指导需要240便士。' : null;
  }
  if (!s.witch.formulaKnown) return '先完成女巫配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.witch.resupply.requestedWeek !== null) return '已经向指导者申请下一轮女巫材料，请等到下一个真实周。';
    return exhaustedSupply(s.witch) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.witch.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮女巫材料并完成备料准备。';
    if (!exhaustedSupply(s.witch)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true || command.bodyChangeAccepted !== true) return '服药与成功晋升后的角色身体变化需要单独确认。';
    const bottle = s.witch.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选女巫原瓶不存在或已经用完。';
    if (s.progression.acting < 100) return `教唆者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.instigator.promotionWeek === null || instigatorWeeks(s) < WITCH_MIN_INSTIGATOR_WEEKS) return `成为教唆者后已度过${instigatorWeeks(s)}/${WITCH_MIN_INSTIGATOR_WEEKS}整周，尚不能服药。`;
    return null;
  }
  const batch = s.witch.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批女巫材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= WITCH_LABOUR_STEPS ? '这批四次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成女巫原瓶。';
  if (batch.materials.length !== WITCH_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = WITCH_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.supplyUnit && material.source === `独立练习场收货处女巫备料第${batchNumber(batch)}批` && material.holder === 'PLAYER' && material.quantity === expected.supplyQuantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < WITCH_PRICES.brewing ? '调配台使用需要60便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applyWitchCommand(s: SliceState, command: WitchAcquisitionCommand, c: SeerContext): void {
  rule(validateWitchAcquisitionCommand(command), '女巫准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= WITCH_PRICES.formula;
      s.witch.formulaKnown = true;
      c.note('记下女巫配方', `花费1行动、240便士，向同一位${WITCH_GUIDE}学习六项材料。完整六项配方已经核定；逐项投料顺序未获原著核定，本次按导师的本作G批次操作规程调配。${WITCH_FORMULA_SOURCE}${WITCH_BODY_CHANGE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.witch.resupply.requestedWeek = s.week;
      c.note('申请下一轮女巫材料', `花费1行动，向原${WITCH_GUIDE}申请下一轮三批材料，并核对六料清单、整理备料记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批四次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.witch.batches.length + 1;
      s.witch.batches.push(...WITCH_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.witch.resupply.deliveries += 1;
      s.witch.resupply.requestedWeek = null;
      c.note('女巫新一轮备料到货', `原${WITCH_GUIDE}确认第${firstNumber}至${firstNumber + 2}批六料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成四次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.witch.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      c.note(`完成${WITCH_LABOUR_TASKS[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/4。${batch.labourSteps === WITCH_LABOUR_STEPS ? '四次劳动抵本批1800便士主材费；仍须支付150便士辅材费，才会交付整批材料。' : '完成全部四次才能抵本批1800便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.witch.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('女巫材料交付', `第${batchNumber(batch)}批六项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === WITCH_LABOUR_STEPS ? '四次劳动已抵本批主材费，仅支付150便士辅材费。' : '主材1800便士、辅材150便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.witch.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= WITCH_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.witch.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶女巫魔药', `花费1行动、60便士，在导师指导下将第${batchNumber(batch)}批六项原材料调配成药。完整六项配方有原著依据，具体操作次序采用本作G导师规程，不把该次序称作原著事实。六项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。教唆者扮演100且晋升后满8整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.witch.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.witch.instigatorActingAtPromotion = s.progression.acting;
        s.witch.promotionWeek = s.week;
        s.witch.previousGender = s.character.gender;
        s.character.gender = 'FEMALE';
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of WITCH_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 2], ['will', 2], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为女巫', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+2、意志+2、知识+1。刺客与教唆者的五项旧掌握完整继承，六组女巫能力从0开始；教唆者消化成果保留，女巫扮演从0开始。灵性上限提高到60，当前灵性没有补满。${s.witch.previousGender === 'MALE' ? '原男性角色的身体已转为女性。' : '原女性角色的外貌与魅力发生变化。'}你的原外貌描述与自称不会被系统擅自重写。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了女巫晋升' : '女巫魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是教唆者，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }

  }
}

export function projectWitch(s: SliceState): WitchProjection {
  const actions: WitchAction[] = [];
  const available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: WitchAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.witch.formulaKnown) add('learn-witch-formula', '请指导者讲解女巫配方', '1行动 · 240便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.witch.resupply.requestedWeek !== null) {
        add('receive-witch-supply', '确认下一轮三批女巫材料到货', `0行动 · 最早第${s.witch.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.witch)) {
        add('request-witch-supply', '向原指导者申请下一轮女巫材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      for (const batch of s.witch.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < WITCH_LABOUR_STEPS) add(`work-${batch.id}`, `第${number}批 · ${WITCH_LABOUR_TASKS[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/4，完成四次抵1800便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取六项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === WITCH_LABOUR_STEPS ? '（仅付四项辅材）' : '（主材1800＋辅材150）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配女巫魔药`, '1行动 · 60便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.witch.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批女巫原瓶`, `0行动 · 独立确认 · 教唆者扮演${s.progression.acting}/100 · 晋升后${instigatorWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true, bodyChangeAccepted: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.witch.batches.filter(batch => !batch.acquired).length;
  const prepared = s.witch.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '女巫 · 序列7' : '女巫之路', discovered: available,
    formulaKnown: available && s.witch.formulaKnown, promoted: isPromoted,
    formula: available && s.witch.formulaKnown ? WITCH_FORMULA.map(material => ({ name: material.name, quantity: material.quantity, unit: material.unit, ...('note' in material ? { note: material.note } : {}) })) : [],
    actions,
    bodyChange: available ? WITCH_BODY_CHANGE : '',
    previousGender: isPromoted ? s.witch.previousGender : null,
    tools: available ? `术式耗材（本作G，非魔药六料）：已购${s.witch.tools.kitsBought}套，粉末持有${s.witch.tools.powderHeld}份、已用${s.witch.tools.powderUsed}份，小镜持有${s.witch.tools.mirrorsHeld}面、已用${s.witch.tools.mirrorsUsed}面；${s.witch.tools.mirrorPrepared ? '已备一面用于下次镜替' : '尚未单独准备镜替'}。` : '',
    bottles: available ? s.witch.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 女巫魔药`,
      source: `${WITCH_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的六项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true, bodyChangeAccepted: true },
    })) : [],
    abilities: isPromoted ? WITCH_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?s.pleasure.witchActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?'女巫魔药已消化，原粉剂、镜片、身体变化与五项有限术式经历保留。':isPromoted ? `教唆者消化成果${s.witch.instigatorActingAtPromotion}/100已保留；女巫扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成教唆者消化（${s.progression.acting}/100），并在教唆者晋升后度过8整周（${instigatorWeeks(s)}/8）。配方与材料可以提前准备。` : '先走完教唆者之路。',
    pollution: s.seer.pollution,
    cases: [], environment: '',
    ...(available ? { story: `${WITCH_FORMULA_SOURCE}${WITCH_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。独立术式粉末持有${s.witch.tools.powderHeld}份，小镜持有${s.witch.tools.mirrorsHeld}面；与魔药六料分开，须另购。${s.witch.resupply.requestedWeek === null ? `已实际接收后续材料${s.witch.resupply.deliveries}批。` : `第${s.witch.resupply.requestedWeek}周申请，下一个真实周起收货。`}` : '',
    risk: available ? `步骤：配方指导 → 采购或四次劳动后领取材料 → 调配 → 独立确认服药。女巫材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${WITCH_CONSUMPTION_RISK}` : '成为教唆者后，可向原有指导者了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validateWitchAcquisitionCommand(value: unknown): value is WitchAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^witch-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed', 'bodyChangeAccepted']) && value.confirmed === true && value.bodyChangeAccepted === true && typeof value.bottleId === 'string' && /^witch-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  return false;
}

export function isWitchAcquisitionCommand(command: WitchCommand): command is WitchAcquisitionCommand {
  return validateWitchAcquisitionCommand(command);
}

/** Reject unknown case IDs, methods and extra fields at both intent entry points. */
export function validateWitchCommand(value: unknown): value is WitchCommand {
  if (validateWitchAcquisitionCommand(value)) return true;
  if (!record(value)) return false;
  if (['REFLECT', 'BUY_SUPPLIES', 'PREPARE_MIRROR'].includes(value.type as string)) return shape(value, ['type']);
  if (['OBSERVE', 'PERFORM', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && WITCH_CASE_IDS.includes(value.caseId as typeof WITCH_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && WITCH_CASE_IDS.includes(value.caseId as typeof WITCH_CASE_IDS[number]) && ['MAGIC', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns physical materials, bottle lineage, promotion and stock conservation.
 * Life owns exact case transitions and the scene evidence behind actual tool use. */
export function validateWitchState(s: SliceState): boolean {
  const raw: unknown = s.witch;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'instigatorActingAtPromotion', 'cases', 'reflected', 'tools', 'previousGender']) || typeof raw.formulaKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.assassin) || !record(s.instigator)) return false;
  const firstConsumptionWeek = (s.instigator.promotionWeek ?? s.week) + WITCH_MIN_INSTIGATOR_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries as number;
  if (!Array.isArray(raw.batches) || raw.batches.length !== WITCH_BATCH_IDS.length * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (!record(raw.cases) || !shape(raw.cases, WITCH_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['MAGIC', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'SHADE_CHECKED', 'MIRROR_CHECKED', 'TEMPERATURE_TESTED', 'SIGN_COMPARED', 'SEAL_READ'].includes(value.outcome as string)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  if (!record(raw.tools) || !shape(raw.tools, ['kitsBought', 'powderHeld', 'powderUsed', 'mirrorsHeld', 'mirrorsUsed', 'lastPurchaseWeek', 'mirrorPrepared'])) return false;
  const tools = raw.tools;
  if (!['kitsBought', 'powderHeld', 'powderUsed', 'mirrorsHeld', 'mirrorsUsed'].every(key => integer(tools[key], 0)) || typeof tools.mirrorPrepared !== 'boolean') return false;
  if ((tools.kitsBought as number) * 3 !== (tools.powderHeld as number) + (tools.powderUsed as number) || tools.kitsBought !== (tools.mirrorsHeld as number) + (tools.mirrorsUsed as number)) return false;
  if (tools.mirrorPrepared && (tools.mirrorsHeld as number) < 1) return false;
  if (tools.kitsBought === 0 ? tools.lastPurchaseWeek !== null : !integer(tools.lastPurchaseWeek, firstActivityWeek, s.week) || !integer(tools.kitsBought, 1, (tools.lastPurchaseWeek as number) - firstActivityWeek + 1)) return false;
  if (raw.previousGender !== null && (typeof raw.previousGender !== 'string' || raw.previousGender.length === 0)) return false;
  const witch = raw as unknown as WitchState, isPromoted = promoted(s);
  if (witch.formulaKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!witch.formulaKnown || !integer(s.instigator.promotionWeek, 1, s.week) || !integer(witch.promotionWeek, firstConsumptionWeek, s.week) || witch.instigatorActingAtPromotion !== 100 || witch.previousGender === null || s.character.gender !== 'FEMALE') return false;
    if (!shape(s.progression.mastery, [...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS, ...WITCH_ABILITY_IDS,...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?PLEASURE_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?PAIN_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DESPAIR_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?UNAGING_DEMONESS_ABILITY_IDS:[]),...(s.progression.sequence===2?CALAMITY_DEMONESS_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (witch.promotionWeek !== null || witch.instigatorActingAtPromotion !== null || witch.previousGender !== null || WITCH_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (witch.reflected || witch.tools.kitsBought || witch.tools.mirrorPrepared || Object.values(witch.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0)) return false;
  }
  // Validate every record before following cross-references, including hostile save input.
  for (const [index, batch] of witch.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `witch-batch-${index + 1}` || !integer(batch.labourSteps, 0, WITCH_LABOUR_STEPS) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== WITCH_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !witch.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = WITCH_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.supplyUnit || material.source !== `独立练习场收货处女巫备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.supplyQuantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of witch.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, s.instigator.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  }
  let successfulBottles = 0;
  for (const batch of witch.batches) if (witch.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  for (const bottle of witch.bottles) {
    if (isPromoted && bottle.brewedWeek > witch.promotionWeek!) return false;
    const batch = witch.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== WITCH_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.instigator.promotionWeek === null || s.week < firstConsumptionWeek || !isPromoted && s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successfulBottles += 1;
      if (witch.promotionWeek === null || bottle.brewedWeek > witch.promotionWeek) return false;
    }
  }
  if (!witch.batches.slice(0, deliveries * 3).every(batch => failedBatch(witch, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(witch.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = witch.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.brewedWeek)) + 1;
  }
  if (witch.resupply.requestedWeek !== null && (!witch.formulaKnown || isPromoted || !exhaustedSupply(witch) || witch.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...witch.bottles.map(bottle => bottle.brewedWeek)))) return false;
  return successfulBottles === (isPromoted ? 1 : 0);
}

export type * from './types.js';
