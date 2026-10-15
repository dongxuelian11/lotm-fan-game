import { WRITER_ABILITY_IDS } from '../writer/types.js';
import {DISCERNER_ABILITY_IDS} from '../discerner/types.js';
import {DREAM_WEAVER_ABILITY_IDS} from '../dream-weaver/types.js';
import {MANIPULATOR_ABILITY_IDS} from '../manipulator/types.js';
import {DREAMWALKER_ABILITY_IDS} from '../dreamwalker/types.js';
import {HYPNOTIST_ABILITY_IDS} from '../hypnotist/types.js';
import {PSYCHOLOGIST_ABILITY_IDS} from '../psychologist/types.js';
import {MINDREADER_ABILITY_IDS} from '../mindreader/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  AUDIENCE_ABILITIES, AUDIENCE_BATCH_IDS, AUDIENCE_CONSUMPTION_RISK, AUDIENCE_FORMULA,
  AUDIENCE_FORMULA_SOURCE, AUDIENCE_GUIDE, AUDIENCE_PRICES,
} from './content.js';
import {
  AUDIENCE_ABILITY_IDS, AUDIENCE_CASE_IDS, type AudienceAcquisitionCommand, type AudienceAction,
  type AudienceBatch, type AudienceCommand, type AudienceProjection, type AudienceState,
} from './types.js';

function createBatch(number: number): AudienceBatch {
  const id = `audience-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: AUDIENCE_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.quantity, unit: material.unit,
      source: `阅览室导师备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createAudienceState(): AudienceState {
  return {
    discovered: false, formulaKnown: false, resupply: { requestedWeek: null, deliveries: 0 },
    batches: AUDIENCE_BATCH_IDS.map((_, index) => createBatch(index + 1)), bottles: [],
    social: {
      cases: Object.fromEntries(AUDIENCE_CASE_IDS.map(id => [id, {
        status: 'AVAILABLE' as const, attemptWeek: null, approach: null, verified: false,
      }])),
      trust: 0, reflected: false,
    },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'audience' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))));
const materialPrice = (batch: AudienceBatch) => AUDIENCE_PRICES.auxiliaryMaterials + (batch.labourSteps === 2 ? 0 : AUDIENCE_PRICES.mainMaterials);
const bottleId = (batch: AudienceBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<AudienceBatch, 'id'>) => Number(batch.id.slice('audience-batch-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const failedBatch = (audience: AudienceState, batch: AudienceBatch) => batch.brewed && audience.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (audience: AudienceState) => audience.batches.length >= 3 && audience.bottles.length === audience.batches.length && audience.batches.every(batch => failedBatch(audience, batch));

/** Exact boundary validation prevents unknown commands or smuggled targets from becoming acquisitions. */
export function validateAudienceCommand(value: unknown): value is AudienceCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^audience-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^audience-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  if (value.type === 'OBSERVE') return shape(value, ['type', 'caseId']) && AUDIENCE_CASE_IDS.includes(value.caseId as typeof AUDIENCE_CASE_IDS[number]);
  if (value.type === 'DISCUSS') return shape(value, ['type', 'caseId', 'approach']) && AUDIENCE_CASE_IDS.includes(value.caseId as typeof AUDIENCE_CASE_IDS[number]) && ['ASK', 'VERIFY', 'ACCUSE'].includes(value.approach as string);
  return false;
}

function commandBlock(s: SliceState, command: AudienceAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择非凡途径，不能改服观众魔药；未服原瓶仍会保留。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的阅览室。';
  if (command.type === 'DISCOVER') return s.audience.discovered ? '已经认识这位观察导师。' : null;
  if (!s.audience.discovered) return '先拜访阅览室观察导师。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.audience.formulaKnown) return '已经掌握这份配方。';
    return s.cash < AUDIENCE_PRICES.formula ? '配方指导需要120便士。' : null;
  }
  if (!s.audience.formulaKnown) return '先完成配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.audience.resupply.requestedWeek !== null) return '已经申请下一轮材料，请等到下一个真实周。';
    return exhaustedSupply(s.audience) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.audience.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原导师申请下一轮材料。';
    if (!exhaustedSupply(s.audience)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.audience.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选原瓶不存在或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  const batch = s.audience.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= 2 ? '这批两步劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成原瓶。';
  if (batch.materials.length !== AUDIENCE_FORMULA.length || !batch.materials.every((material, index) => material.holder === 'PLAYER' && material.quantity === AUDIENCE_FORMULA[index]!.quantity)) return '这一批现有材料数量不足。';
  return s.cash < AUDIENCE_PRICES.brewing ? '调配台使用需要60便士。' : null;
}

/** Mutates only the caller's working copy. Social commands are dispatched separately by the slice. */
export function applyAudienceCommand(s: SliceState, command: AudienceAcquisitionCommand, c: SeerContext): void {
  rule(validateAudienceCommand(command) && !['OBSERVE', 'DISCUSS', 'REFLECT'].includes(command.type), '观众准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.audience.discovered = true;
      c.note('在阅览室相识', `你拜访了${AUDIENCE_GUIDE}，花费1行动。对方说明现有三批备料、配方指导与劳动交换的办法。这次会面没有赋予非凡能力；导师与渠道为本作原创。`);
      return;
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= AUDIENCE_PRICES.formula;
      s.audience.formulaKnown = true;
      c.note('记下观众配方', `花费1行动、120便士，在导师指导下核对六项材料与用量。先混合四项辅材，再加入成年曼哈尔鱼眼睛，最后加入羊角黑鱼血液。${AUDIENCE_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.audience.resupply.requestedWeek = s.week;
      c.note('申请下一轮观众材料', `花费1行动，向原${AUDIENCE_GUIDE}核对六料清单并准备存放位置。现有三批原瓶均已服用且未晋升，下一轮三批材料最早第${s.week + 1}周到货；材料、调配费用与每批两步劳动仍按原规则。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.audience.batches.length + 1;
      s.audience.batches.push(...AUDIENCE_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.audience.resupply.deliveries += 1;
      s.audience.resupply.requestedWeek = null;
      c.note('观众下一轮备料到货', `原${AUDIENCE_GUIDE}确认第${firstNumber}至${firstNumber + 2}批六料实际到货，0行动。材料仍由供应方持有；须购买，或分别完成两步劳动后付辅材费，再实际调配。旧材料的消耗、原瓶与失败记录全部保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.audience.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      c.note(batch.labourSteps === 1 ? '整理阅览室目录' : '完成备料盘点', batch.labourSteps === 1
        ? `你完成一次公开藏书目录整理，花费1行动，第${batchNumber(batch)}批劳动进度1/2。再完成一次备料盘点，才可抵本批600便士主材费；材料仍归供应方。`
        : `你实际清点第${batchNumber(batch)}批备料，花费1行动。两步劳动只抵本批600便士主材费；仍须支付60便士四项辅材费才会交付整批材料。`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.audience.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('观众六项材料交付', `第${batchNumber(batch)}批六项材料已实际交到你手中，支付${paid}便士，0行动。${batch.labourSteps === 2 ? '两步劳动已抵扣本批600便士主材费。' : '主材600便士、辅材60便士；未完成的劳动不折现。'}每项材料都属于本批，调配消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.audience.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= AUDIENCE_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.audience.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶观众魔药', `第${batchNumber(batch)}批六项材料已全部投入调配：先混合四项辅材，再放入成年曼哈尔鱼眼睛，最后加入羊角黑鱼血液。花费1行动、60便士，所得原瓶单独保存，尚未服用；普通生活需满4整周后才能独立确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.audience.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'audience';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(AUDIENCE_ABILITY_IDS.map(id => [id, 0]));
        s.character.coreStats.perception = Math.min(500, s.character.coreStats.perception + 4);
        s.character.coreStats.will = Math.min(500, s.character.coreStats.will + 3);
        s.character.coreStats.knowledge = Math.min(500, s.character.coreStats.knowledge + 3);
        c.note('成为观众', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，感知+4、意志+3、知识+3，体质不变。三项能力从0掌握开始，灵性上限提高到30，当前灵性没有补满。你可以更细致地观察并作出推断，仍须当面接触、询问或核实。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了晋升' : '观众魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；须休养恢复，重试需要另一瓶真实魔药。`);
      }
      return;
    }
  }
}

export function projectAudience(s: SliceState): AudienceProjection {
  const actions: AudienceAction[] = [];
  const add = (id: string, label: string, cost: string, command: AudienceAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  const isPromoted = promoted(s);
  if (!s.audience.discovered) {
    add('discover-audience', `拜访${AUDIENCE_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  } else if (!s.audience.formulaKnown) {
    add('learn-audience-formula', '请导师讲解观众配方', '1行动 · 120便士', { type: 'LEARN_FORMULA' });
  } else if (!isPromoted) {
    if (s.audience.resupply.requestedWeek !== null) {
      add('receive-audience-supply', '确认下一轮三批材料到货', `0行动 · 最早第${s.audience.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
    } else if (exhaustedSupply(s.audience)) {
      add('request-audience-supply', '向原导师申请下一轮材料', '1行动 · 核对清单并准备存放 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
    }
    for (const batch of s.audience.batches) {
      const number = batchNumber(batch);
      if (!batch.acquired) {
        if (batch.labourSteps < 2) add(`work-${batch.id}`, `第${number}批 · ${batch.labourSteps === 0 ? '整理阅览室目录' : '盘点备料'}`, `1行动 · 劳动${batch.labourSteps}/2，完成两步抵600便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
        add(`buy-${batch.id}`, `第${number}批 · 领取六项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === 2 ? '（仅付四项辅材）' : '（主材600＋辅材60）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
      } else if (!batch.brewed) {
        add(`brew-${batch.id}`, `第${number}批 · 使用调配台`, '1行动 · 60便士 · 按顺序消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
    }
  }
  if (s.audience.formulaKnown) {
    for (const bottle of s.audience.bottles) if (bottle.status === 'PREPARED') {
      add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批原瓶`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.audience.batches.filter(batch => !batch.acquired).length;
  const prepared = s.audience.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '观众 · 序列9' : s.audience.discovered ? '观众之路' : '观众渠道',
    discovered: s.audience.discovered, formulaKnown: s.audience.formulaKnown, promoted: isPromoted,
    formula: s.audience.formulaKnown ? AUDIENCE_FORMULA.map(({ name, quantity, unit }) => ({ name, quantity, unit })) : [],
    actions: isPromoted && s.progression.sequence!==9 ? [] : actions,
    bottles: s.audience.discovered ? s.audience.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 观众魔药`,
      source: `${AUDIENCE_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的六项材料按辅材→眼睛→血液顺序调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? AUDIENCE_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? (s.progression.sequence!==9?s.mindreader.audienceActingAtPromotion??100:s.progression.acting) : 0,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : s.progression.sequence!==9 ? '观众魔药已消化，原有观察与核实经历保留。' : s.progression.acting >= 100 ? '观众魔药已消化；人物经历与能力掌握分别保留。'
        : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先看见事实，再审视自己的推断。' : `已留下扮演经历（${s.progression.acting}/100）。观察、核实与反思继续推动消化；能力掌握单独记录。`,
    pollution: s.seer.pollution,
    risk: s.audience.discovered ? `步骤：配方指导 → 采购或两步劳动后领取材料 → 辅材、眼睛、血液依次调配 → 第5周起独立确认服药。每轮仅有3批，不自动补货；全已服用且失败后，可花1行动申请下一轮，最早下一个真实周到货。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${AUDIENCE_CONSUMPTION_RISK}` : '先接触可靠的观察导师，了解获得配方与材料的办法。',
    scenes: [], trust: s.audience.social.trust,
  };
}

/** Acquisition provenance and conservation. Social progression is additionally checked by its own module. */
export function validateAudienceState(s: SliceState): boolean {
  const raw: unknown = s.audience;
  if (!record(raw) || !shape(raw, ['discovered', 'formulaKnown', 'resupply', 'batches', 'bottles', 'social']) || typeof raw.discovered !== 'boolean' || typeof raw.formulaKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  const deliveries = raw.resupply.deliveries as number;
  if (!Array.isArray(raw.batches) || raw.batches.length !== 3 * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (raw.formulaKnown && !raw.discovered) return false;
  if (!record(raw.social) || !shape(raw.social, ['cases', 'trust', 'reflected']) || !record(raw.social.cases) || !shape(raw.social.cases, AUDIENCE_CASE_IDS) || !Number.isSafeInteger(raw.social.trust) || typeof raw.social.reflected !== 'boolean') return false;
  for (const value of Object.values(raw.social.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'approach', 'verified']) || !['AVAILABLE', 'OBSERVED', 'RESOLVED'].includes(value.status as string) || typeof value.verified !== 'boolean' || value.attemptWeek !== null && !integer(value.attemptWeek, 1, s.week) || value.approach !== null && !['ASK', 'VERIFY', 'ACCUSE'].includes(value.approach as string)) return false;
  }
  const audience = raw as unknown as AudienceState;
  for (const [index, batch] of audience.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `audience-batch-${index + 1}` || !integer(batch.labourSteps, 0, 2) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== AUDIENCE_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !audience.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = AUDIENCE_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || material.source !== `阅览室导师备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.quantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
    if (audience.bottles.filter(bottle => record(bottle) && bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  }
  const isPromoted = promoted(s);
  if (s.progression.pathwayId === 'audience' && (!isPromoted || !integer(s.progression.promotionWeek, 5, s.week) || !record(s.progression.mastery) || !shape(s.progression.mastery, [...(s.progression.sequence===1?WRITER_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?DISCERNER_ABILITY_IDS:[]),...AUDIENCE_ABILITY_IDS,...(s.progression.sequence!==9?MINDREADER_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?PSYCHOLOGIST_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?HYPNOTIST_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?DREAMWALKER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?MANIPULATOR_ABILITY_IDS:[]),...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?DREAM_WEAVER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500)))) return false;
  let successfulBottles = 0;
  for (const bottle of audience.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, 1, s.week) || !Array.isArray(bottle.inputIds)) return false;
    const batch = audience.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== AUDIENCE_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') { if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.week < 5 || isPromoted && bottle.brewedWeek > s.progression.promotionWeek!) return false; }
    else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') successfulBottles += 1;
  }
  if (successfulBottles !== (isPromoted ? 1 : 0) || !audience.batches.slice(0, deliveries * 3).every(batch => failedBatch(audience, batch))) return false;
  // Supply round N cannot exist until all earlier bottles failed and a real week passed.
  let earliestRoundWeek = 5;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(audience.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = audience.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.brewedWeek)) + 1;
  }
  if (audience.resupply.requestedWeek !== null && (!audience.formulaKnown || isPromoted || !exhaustedSupply(audience) || audience.resupply.requestedWeek < Math.max(5 + deliveries, ...audience.bottles.map(bottle => bottle.brewedWeek)))) return false;
  return true;
}
