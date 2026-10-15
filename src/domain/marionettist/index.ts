import { ATTENDANT_MYSTERIES_ABILITY_IDS } from '../attendant-mysteries/types.js';
import {MIRACLE_WORKER_ABILITY_IDS} from '../miracle-worker/content.js';
import {ANCIENT_SCHOLAR_ABILITY_IDS} from '../ancient-scholar/types.js';
import { BIZARRO_SORCERER_ABILITY_IDS } from '../bizarro-sorcerer/types.js';
import { createMarionettistPuppetState, projectMarionettistPuppet, validateMarionettistPuppet, hasMarionettistOpenCapture } from './puppet.js';
import { validateMarionettistEncounter } from './encounter.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SEER_ABILITY_IDS } from '../seer/types.js';
import { CLOWN_ABILITY_IDS } from '../clown/types.js';
import { MAGICIAN_ABILITY_IDS } from '../magician/types.js';
import { FACELESS_ABILITY_IDS } from '../faceless/types.js';
import { marionettistInside, marionettistActions, marionettistCases, MARIONETTIST_ENVIRONMENT, validateMarionettistActivityCommand, validateMarionettistPractice } from './practice.js';
import {
  MARIONETTIST_ABILITIES, MARIONETTIST_BATCH_IDS, MARIONETTIST_CONSUMPTION_RISK, MARIONETTIST_FORMULA,
  MARIONETTIST_FORMULA_SOURCE, MARIONETTIST_GUIDE, MARIONETTIST_MIN_FACELESS_WEEKS, MARIONETTIST_PRICES, MARIONETTIST_LABOUR_STEPS,
  MARIONETTIST_LABOUR_TASKS, MARIONETTIST_SOURCE_STATUS, MARIONETTIST_RITUAL_SOURCE,
} from './content.js';
import {
  MARIONETTIST_ABILITY_IDS, MARIONETTIST_CASE_IDS, type MarionettistCommand, type MarionettistAcquisitionCommand, type MarionettistAction, type MarionettistBatch,
  type MarionettistProjection, type MarionettistState,
} from './types.js';

function createBatch(number: number): MarionettistBatch {
  const id = `marionettist-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: MARIONETTIST_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.supplyQuantity, unit: material.unit,
      source: `占卜俱乐部秘偶大师备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createMarionettistState(): MarionettistState {
  return {
    puppet: createMarionettistPuppetState(),
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: MARIONETTIST_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, facelessActingAtPromotion: null,
    cases: Object.fromEntries(MARIONETTIST_CASE_IDS.map(id => [id, { status: 'AVAILABLE', observedWeek: null, attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0, linesObserved: false, initialControl: false, interrupted: false, autonomyVerified: false }])) as MarionettistState['cases'],
    reflected: false,
    ritual: { requestedWeek: null, visitWeek: null, location: 'CLUB', singerPresent: false, singerWilling: false, singerHealthy: false, singing: false, visits: 0, consumptions: 0, history: [] },
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'diviner' && (s.progression.sequence === 5 || (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isFaceless = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.seer.discovered && s.faceless.formulaKnown && (isFaceless(s) || promoted(s));
const materialPrice = (batch: MarionettistBatch) => MARIONETTIST_PRICES.auxiliaryMaterials + (batch.labourSteps === MARIONETTIST_LABOUR_STEPS ? 0 : MARIONETTIST_PRICES.mainMaterials);
const bottleId = (batch: MarionettistBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<MarionettistBatch, 'id'>) => Number(batch.id.slice('marionettist-batch-'.length));
const facelessWeeks = (s: SliceState) => Math.max(0, (s.marionettist.promotionWeek ?? s.week) - (s.faceless.promotionWeek ?? s.week));
const failedBatch = (marionettist: MarionettistState, batch: MarionettistBatch) => batch.brewed && marionettist.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (marionettist: MarionettistState) => marionettist.batches.length >= 3 && marionettist.bottles.length === marionettist.batches.length && marionettist.batches.every(batch => failedBatch(marionettist, batch));

function commandBlock(s: SliceState, command: MarionettistAcquisitionCommand): string | null {
  const r = s.marionettist.ritual;
  // Paid physical return and stopping the actual song remain available at zero AP,
  // including after promotion or a failed dose. They do not restore resources.
  if (command.type === 'RETURN_CLUB') return r.location === 'COAST' ? null : '你已在俱乐部，不需要重复返回。';
  if (command.type === 'END_SONG') return r.location === 'COAST' && r.singing ? null : '现场没有正在进行的歌声。';
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW', 'REQUEST_RITUAL', 'GO_RITUAL'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (Object.values(s.marionettist.cases).some(scene => scene.contactOpen || scene.status === 'PREPARED') || hasMarionettistOpenCapture(s)) return '先实际收束当前接触或取消尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (!knownChannel(s)) return '成为无面人并保有指导者渠道后，才能继续秘偶大师之路。';
  if (promoted(s)) return '你已完成秘偶大师晋升，不能重复服用或继续准备这份魔药。';
  if (command.type === 'BEGIN_SONG' || command.type === 'CONSUME') {
    if (r.location !== 'COAST' || s.world.city !== 'ELSEWHERE') return '须实际到达预约的海岸水湾，录音或远程声音不能替代。';
    if (!r.singerPresent || !r.singerWilling || !r.singerHealthy) return '现场歌者必须真实在场、健康且本人自愿。';
    if (r.history.at(-1)?.consumedBottleId !== null) return '本次预约已经用过；请结束歌声、返回俱乐部后重新预约。';
    if (command.type === 'BEGIN_SONG') return r.singing ? '涟正在现场歌唱。' : null;
    if (!r.singing) return '请先让自愿的美人鱼在现场开始真实歌唱。';
  } else if (r.location !== 'CLUB' || s.world.city !== 'BACKLUND') return '先按已付原路实际返回贝克兰德占卜俱乐部。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.marionettist.formulaKnown) return '已经掌握秘偶大师配方。';
    return s.cash < MARIONETTIST_PRICES.formula ? '秘偶大师配方指导需要420便士。' : null;
  }
  if (!s.marionettist.formulaKnown) return '先完成秘偶大师配方指导。';
  if (command.type === 'REQUEST_RITUAL') return r.requestedWeek !== null ? '已经预约，请等下一真实周再实际出发。' : null;
  if (command.type === 'GO_RITUAL') {
    if (r.requestedWeek === null) return '先向指导者请求涟本人的预约。';
    if (s.week <= r.requestedWeek) return `最早第${r.requestedWeek + 1}周出发，不能用本周预约假装跨周。`;
    return s.cash < MARIONETTIST_PRICES.ritualTravel ? '普通往返行程需要80便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.marionettist.resupply.requestedWeek !== null) return '已经向指导者申请下一轮秘偶大师材料，请等到下一个真实周。';
    return exhaustedSupply(s.marionettist) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.marionettist.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮秘偶大师材料并完成备料准备。';
    if (!exhaustedSupply(s.marionettist)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.marionettist.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选秘偶大师原瓶不存在或已经用完。';
    if (s.progression.acting < 100) return `无面人魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.faceless.promotionWeek === null || facelessWeeks(s) < MARIONETTIST_MIN_FACELESS_WEEKS) return `成为无面人后已度过${facelessWeeks(s)}/${MARIONETTIST_MIN_FACELESS_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (!('batchId' in command)) return '未知准备事项。';
  const batch = s.marionettist.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批秘偶大师材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= MARIONETTIST_LABOUR_STEPS ? '这批五次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成秘偶大师原瓶。';
  if (batch.materials.length !== MARIONETTIST_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = MARIONETTIST_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.unit && material.source === `占卜俱乐部秘偶大师备料第${batchNumber(batch)}批` && material.holder === 'PLAYER' && material.quantity === expected.supplyQuantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < MARIONETTIST_PRICES.brewing ? '调配台使用需要100便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applyMarionettistAcquisition(s: SliceState, command: MarionettistAcquisitionCommand, c: SeerContext): void {
  rule(validMarionettistAcquisitionCommand(command), '秘偶大师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'REQUEST_RITUAL':
      s.actionsRemaining -= 1; s.marionettist.ritual.requestedWeek = s.week;
      c.note('预约真实美人鱼歌声', `花1行动，由原指导者联系成年自愿歌者涟。记录第${s.week}周请求，最早第${s.week + 1}周实际前往海岸水湾。现在没有歌声、没有移动或服药。${MARIONETTIST_RITUAL_SOURCE}`); return;
    case 'GO_RITUAL': {
      const r = s.marionettist.ritual;
      s.actionsRemaining -= 1; s.cash -= MARIONETTIST_PRICES.ritualTravel;
      r.history.push({ number: r.visits + 1, requestedWeek: r.requestedWeek!, visitWeek: s.week, returned: false, consumedBottleId: null });
      r.requestedWeek = null; r.visitWeek = s.week; r.visits += 1; r.location = 'COAST';
      r.singerPresent = true; r.singerWilling = true; r.singerHealthy = true; r.singing = false;
      s.world.city = 'ELSEWHERE';
      c.note('沿普通行程抵达海岸水湾', '花1行动、80便士，实际普通往返行程均已付费。你已离开贝克兰德，抵达有限海岸水湾；成年美人鱼涟健康、本人自愿且真实在场，现在尚未唱歌。没有传送或移动其它NPC。即使行动用尽，也可0行动结束歌声、按已付原路返回；现场未收束不自动过周。'); return;
    }
    case 'BEGIN_SONG':
      s.marionettist.ritual.singing = true;
      c.note('涟在眼前开始歌唱', '成年、自愿、健康的美人鱼涟在同一水湾实际开口歌唱，0行动。本次是真实现场歌声，不是录音或无面人声音模仿；符合消化和周数门槛时，仍须对所选原瓶单独确认服用。'); return;
    case 'END_SONG':
      s.marionettist.ritual.singing = false;
      c.note('现场歌声实际结束', '你和涟结束本次歌唱，0行动。仍在同一水湾，可按已付原路返回；没有退款、治疗、回收药液或抹除服药失败。'); return;
    case 'RETURN_CLUB': {
      const r = s.marionettist.ritual;
      r.history.at(-1)!.returned = true; r.singing = false; r.singerPresent = false; r.singerWilling = false; r.singerHealthy = false;
      r.location = 'CLUB'; r.visitWeek = null; s.world.city = 'BACKLUND';
      c.note('按已付原路回到占卜俱乐部', '你结束现场歌声，沿此前已付普通返程实际回到贝克兰德占卜俱乐部，0行动；涟留在原水湾，未移动任何其它NPC。原瓶、消耗、伤势与结果全部保留，不自动治疗或补灵性。本次预约结束，未晋升时可另行预约下一次。'); return;
    }

    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= MARIONETTIST_PRICES.formula;
      s.marionettist.formulaKnown = true;
      c.note('记下秘偶大师配方', `花费1行动、420便士，向同一位${MARIONETTIST_GUIDE}学习六项材料。两项主材及一项辅材没有已核重量，本作供货各按1份；本次使用导师的本作G操作规程，不冒称原著投料次序。${MARIONETTIST_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.marionettist.resupply.requestedWeek = s.week;
      c.note('申请下一轮秘偶大师材料', `花费1行动，向原${MARIONETTIST_GUIDE}申请下一轮三批材料，并核对六料清单、整理备料记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批五次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.marionettist.batches.length + 1;
      s.marionettist.batches.push(...MARIONETTIST_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.marionettist.resupply.deliveries += 1;
      s.marionettist.resupply.requestedWeek = null;
      c.note('秘偶大师新一轮备料到货', `原${MARIONETTIST_GUIDE}确认第${firstNumber}至${firstNumber + 2}批六料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成五次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.marionettist.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      c.note(`完成${MARIONETTIST_LABOUR_TASKS[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/5。${batch.labourSteps === MARIONETTIST_LABOUR_STEPS ? '五次劳动抵本批4200便士主材费；仍须支付280便士辅材费，才会交付整批材料。' : '完成全部五次才能抵本批4200便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.marionettist.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('秘偶大师材料交付', `第${batchNumber(batch)}批六项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === MARIONETTIST_LABOUR_STEPS ? '五次劳动已抵本批主材费，仅支付280便士辅材费。' : '主材4200便士、辅材280便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.marionettist.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= MARIONETTIST_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.marionettist.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null, consumedWeek: null, ritualVisit: null });
      c.note('一瓶秘偶大师魔药', `花费1行动、100便士，在导师指导下将第${batchNumber(batch)}批六项原材料调配成药。六项材料有原著依据，两项主材及一项辅材各1份是本作G供货计量、非原著精确重量；具体操作次序采用本作G导师规程，不把该次序称作原著事实。六项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。无面人扮演100且晋升后满12整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.marionettist.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      bottle.consumedWeek = s.week; bottle.ritualVisit = s.marionettist.ritual.visits;
      s.marionettist.ritual.consumptions += 1;
      s.marionettist.ritual.history.at(-1)!.consumedBottleId = bottle.id;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.marionettist.facelessActingAtPromotion = s.progression.acting;
        s.marionettist.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of MARIONETTIST_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为秘偶大师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质、感知、意志与知识各+1。原占卜家、小丑、魔术师与无面人的全部能力掌握完整继承，秘偶大师新增两项从0开始；无面人消化成果保留，秘偶大师扮演从0开始。灵性上限提高到100，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了秘偶大师晋升' : '秘偶大师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是无面人，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }

  }
}

// Historical inheritance only; existing stage command predicates stay unchanged.
const hasAttendantHistory = (s: SliceState) => s.progression.pathwayId === 'diviner' &&
  s.progression.sequence === 1 && s.attendantMysteries?.promotionWeek != null;
const historicallyPromoted = (s: SliceState) => promoted(s) || hasAttendantHistory(s);
const historicallyKnownChannel = (s: SliceState) => s.seer.discovered && s.faceless.formulaKnown && (isFaceless(s) || historicallyPromoted(s));
export function projectMarionettist(s: SliceState): MarionettistProjection {
  const actions: MarionettistAction[] = [];
  const available = historicallyKnownChannel(s), isPromoted = historicallyPromoted(s);
  const add = (id: string, label: string, cost: string, command: MarionettistAcquisitionCommand) => {
    if (hasAttendantHistory(s)) return;
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.marionettist.formulaKnown) add('learn-marionettist-formula', '请指导者讲解秘偶大师配方', '1行动 · 420便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.marionettist.resupply.requestedWeek !== null) {
        add('receive-marionettist-supply', '确认下一轮三批秘偶大师材料到货', `0行动 · 最早第${s.marionettist.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.marionettist)) {
        add('request-marionettist-supply', '向原指导者申请下一轮秘偶大师材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      for (const batch of s.marionettist.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < MARIONETTIST_LABOUR_STEPS) add(`work-${batch.id}`, `第${number}批 · ${MARIONETTIST_LABOUR_TASKS[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/5，完成五次抵4200便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取六项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === MARIONETTIST_LABOUR_STEPS ? '（仅付四项辅材）' : '（主材4200＋辅材280）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配秘偶大师魔药`, '1行动 · 100便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.marionettist.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批秘偶大师原瓶`, `0行动 · 独立确认 · 无面人扮演${s.progression.acting}/100 · 晋升后${facelessWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const ritual = s.marionettist.ritual;
  if (available && ritual.location === 'COAST') {
    if (!ritual.singing && !isPromoted && ritual.history.at(-1)?.consumedBottleId === null) add('marionettist-begin-song', '请涟在现场开始真实歌唱', '0行动 · 本人健康、自愿且在场', { type: 'BEGIN_SONG' });
    if (ritual.singing) add('marionettist-end-song', '与涟结束现场歌声', '0行动 · 不退原瓶或成本', { type: 'END_SONG' });
    add('marionettist-return-club', '按已付原路返回占卜俱乐部', '0行动 · 普通返程已含原费用 · 自动结束现场歌声', { type: 'RETURN_CLUB' });
  } else if (available && !isPromoted && s.marionettist.formulaKnown) {
    if (ritual.requestedWeek === null) add('marionettist-request-ritual', '向涟预约真实美人鱼歌声', '1行动 · 最早下一真实周出发', { type: 'REQUEST_RITUAL' });
    else add('marionettist-go-ritual', '实际前往预约的海岸水湾', `1行动 · 80便士普通往返 · 最早第${ritual.requestedWeek + 1}周`, { type: 'GO_RITUAL' });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.marionettist.batches.filter(batch => !batch.acquired).length;
  const prepared = s.marionettist.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '秘偶大师 · 序列5' : '秘偶大师之路', discovered: available,
    formulaKnown: available && s.marionettist.formulaKnown, promoted: isPromoted,
    formula: available && s.marionettist.formulaKnown ? MARIONETTIST_FORMULA.map(material => ({ name: material.name, quantity: material.quantity, unit: material.quantity === null ? '' : material.unit, ...('note' in material ? { note: material.note } : {}) })) : [],
    actions: [...actions, ...marionettistActions(s)],
    ritual: projectMarionettistRitual(s), puppet: projectMarionettistPuppet(s),
    bottles: available ? s.marionettist.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 秘偶大师魔药`,
      source: `${MARIONETTIST_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的六项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? MARIONETTIST_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s)))) ? s.bizarroSorcerer.marionettistActingAtPromotion ?? 100 : s.progression.acting) : 0,
    digestion: isPromoted && (s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s)))) ? '秘偶大师魔药已消化；原现场歌声、实践、原身体与消耗记录保留。' : isPromoted ? `无面人消化成果${s.marionettist.facelessActingAtPromotion}/100已保留；秘偶大师扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成无面人消化（${s.progression.acting}/100），并在无面人晋升后度过12整周（${facelessWeeks(s)}/12）。配方与材料可以提前准备。` : '先走完无面人之路。',
    pollution: s.seer.pollution,
    cases: isPromoted ? marionettistCases(s) : [], insideCase: marionettistInside(s), environment: MARIONETTIST_ENVIRONMENT,
    ...(available ? { story: `${MARIONETTIST_FORMULA_SOURCE}${MARIONETTIST_RITUAL_SOURCE}${MARIONETTIST_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。两项主材及一项辅材按本作G每批各1份供货，原著未给明确重量。${s.marionettist.resupply.requestedWeek === null ? `已实际接收后续材料${s.marionettist.resupply.deliveries}轮，每轮3批。` : `第${s.marionettist.resupply.requestedWeek}周申请，下一个真实周起收货。`}` : '',
    risk: available ? `步骤：配方指导 → 采购或五次劳动后领取材料 → 调配 → 预约 → 真实跨周出行 → 现场开歌 → 独立确认服药 → 结束并按已付原路返回。秘偶大师材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${MARIONETTIST_CONSUMPTION_RISK}` : '成为无面人后，可向原有指导者了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validMarionettistAcquisitionCommand(value: unknown): value is MarionettistAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REQUEST_RITUAL', 'GO_RITUAL', 'BEGIN_SONG', 'END_SONG', 'RETURN_CLUB'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^marionettist-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^marionettist-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  return false;
}
export function isMarionettistAcquisitionCommand(command: MarionettistCommand): command is MarionettistAcquisitionCommand { return validMarionettistAcquisitionCommand(command); }
export function validMarionettistCommand(value: unknown): value is MarionettistCommand { return validMarionettistAcquisitionCommand(value) || validateMarionettistActivityCommand(value); }

/** Original materials, independent bottles, finite replenishment and inherited progression. */
export function validMarionettistState(s: SliceState): boolean {
  const raw: unknown = s.marionettist;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'facelessActingAtPromotion', 'cases', 'reflected', 'ritual', 'encounter', 'puppet']) || typeof raw.formulaKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.seer) || !record(s.clown) || !record(s.faceless)) return false;
  const firstConsumptionWeek = (s.faceless.promotionWeek ?? s.week) + MARIONETTIST_MIN_FACELESS_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries;
  if (!Array.isArray(raw.batches) || raw.batches.length !== MARIONETTIST_BATCH_IDS.length * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  if (raw.encounter.startHistoryIndex !== null && !integer(raw.encounter.startHistoryIndex, 0, s.combatHistory.length) || raw.encounter.attemptWeek !== null && !integer(raw.encounter.attemptWeek, firstConsumptionWeek, s.week)) return false;
  const f = raw as unknown as MarionettistState, isPromoted = historicallyPromoted(s);
  if (f.formulaKnown && !historicallyKnownChannel(s)) return false;
  if (isPromoted) {
    if (!f.formulaKnown || !integer(s.faceless.promotionWeek, 1, s.week) || !integer(f.promotionWeek, firstConsumptionWeek, s.week) || f.facelessActingAtPromotion !== 100) return false;
    if ((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s)))) && (!record(s.bizarroSorcerer) || !integer(s.bizarroSorcerer.promotionWeek, f.promotionWeek, s.week) || s.bizarroSorcerer.marionettistActingAtPromotion !== 100)) return false;
    if (!shape(s.progression.mastery, [...SEER_ABILITY_IDS, ...CLOWN_ABILITY_IDS, ...MAGICIAN_ABILITY_IDS, ...FACELESS_ABILITY_IDS, ...MARIONETTIST_ABILITY_IDS, ...((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s)))) ? BIZARRO_SORCERER_ABILITY_IDS:[]),...((s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s)))?ANCIENT_SCHOLAR_ABILITY_IDS:[]),...((s.progression.sequence===2||hasAttendantHistory(s))?MIRACLE_WORKER_ABILITY_IDS:[]),...(hasAttendantHistory(s)?ATTENDANT_MYSTERIES_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
    if (f.encounter.attemptWeek !== null && f.encounter.attemptWeek < f.promotionWeek) return false;
  } else {
    if (f.promotionWeek !== null || f.facelessActingAtPromotion !== null || MARIONETTIST_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (f.encounter.status !== 'AVAILABLE' || f.encounter.startHistoryIndex !== null || f.encounter.attemptWeek !== null) return false;
  }
  if (!validateMarionettistPractice(s) || !validateMarionettistPuppet(f.puppet)) return false;
  const e = f.encounter;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'MARIONETTIST_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(f.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (f.ritual?.location === 'COAST' || Object.values(f.cases).some(r => r.contactOpen))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  // Check records before following cross-references; hostile saves return false, not a crash.
  for (const [index, batch] of f.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `marionettist-batch-${index + 1}` || !integer(batch.labourSteps, 0, MARIONETTIST_LABOUR_STEPS) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== MARIONETTIST_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !f.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = MARIONETTIST_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || material.source !== `占卜俱乐部秘偶大师备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.supplyQuantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of f.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome', 'consumedWeek', 'ritualVisit']) || !integer(bottle.brewedWeek, s.faceless.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  }
  let successfulBottles = 0;
  for (const batch of f.batches) if (f.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  for (const bottle of f.bottles) {
    if (isPromoted && bottle.brewedWeek > f.promotionWeek!) return false;
    const batch = f.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== MARIONETTIST_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null || bottle.consumedWeek !== null || bottle.ritualVisit !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.faceless.promotionWeek === null || s.week < firstConsumptionWeek || !isPromoted && s.progression.acting !== 100) return false;
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.brewedWeek), s.week) || !integer(bottle.ritualVisit, 1)) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successfulBottles += 1;
      if (f.promotionWeek === null || bottle.consumedWeek !== f.promotionWeek) return false;
    }
  }
  if (!f.batches.slice(0, deliveries * 3).every(batch => failedBatch(f, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(f.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = f.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.consumedWeek ?? bottle.brewedWeek)) + 1;
  }
  if (f.resupply.requestedWeek !== null && (!f.formulaKnown || isPromoted || !exhaustedSupply(f) || f.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...f.bottles.map(bottle => bottle.consumedWeek ?? bottle.brewedWeek)))) return false;
  if (s.progression.pathwayId === 'diviner' && (s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s)))) && (f.ritual?.location !== 'CLUB' || hasMarionettistOpenCapture(s))) return false;
  return successfulBottles === (isPromoted ? 1 : 0) && validateMarionettistRitual(s) && validateMarionettistEncounter(s);
}

// Conventional aliases keep the domain entry points consistent with older stages.
export const applyMarionettistCommand = applyMarionettistAcquisition;
export const validateMarionettistState = validMarionettistState;
export const validateMarionettistCommand = validMarionettistCommand;
export const validateMarionettistAcquisitionCommand = validMarionettistAcquisitionCommand;
export { applyMarionettistActivity } from './practice.js';
export type * from './types.js';

function projectMarionettistRitual(s: SliceState): MarionettistProjection['ritual'] {
  const r = s.marionettist.ritual;
  return {
    location: r.location, singing: r.singing, visits: r.visits, consumptions: r.consumptions,
    source: historicallyKnownChannel(s) ? MARIONETTIST_RITUAL_SOURCE : '',
    status: r.location === 'COAST' ? r.singing ? '真实现场歌声正在进行' : '已到原水湾，当前没有歌声' : r.requestedWeek !== null ? `第${r.requestedWeek}周已请求，最早下一真实周出发` : '尚未预约下一次现场仪式',
    summary: r.location === 'COAST' ? `本次实际到访第${r.visits}次；歌者${r.singerPresent ? '真实在场' : '不在场'}、${r.singerHealthy ? '健康' : '目前不适'}、${r.singerWilling ? '本人自愿' : '未同意'}。${r.history.at(-1)?.consumedBottleId ? '本次已耗一原瓶，须返回后另约。' : '本次尚未服药。'}0行动按已付原路返程始终可用。` : '普通往返已付行程不会移动其它NPC；每次会面最多服一原瓶，结束后重新预约，不自动生成下一周歌声。',
  };
}
/** A consumed original bottle must point to a real visit after a prior-week request. */
export function validateMarionettistRitual(s: SliceState): boolean {
  const m = s.marionettist, r = m.ritual;
  if (!record(r) || !shape(r, ['requestedWeek', 'visitWeek', 'location', 'singerPresent', 'singerWilling', 'singerHealthy', 'singing', 'visits', 'consumptions', 'history'])) return false;
  if (!['CLUB', 'COAST'].includes(r.location) || ![r.singerPresent, r.singerWilling, r.singerHealthy, r.singing].every(v => typeof v === 'boolean') || !integer(r.visits, 0) || !integer(r.consumptions, 0, r.visits) || !Array.isArray(r.history) || r.history.length !== r.visits) return false;
  if (r.requestedWeek !== null && !integer(r.requestedWeek, s.faceless.promotionWeek ?? s.week, s.week)) return false;
  if (r.visitWeek !== null && !integer(r.visitWeek, (s.faceless.promotionWeek ?? s.week) + 1, s.week)) return false;
  if (!m.formulaKnown && (r.requestedWeek !== null || r.visits !== 0)) return false;
  let lastVisitWeek = 0, consumed = 0;
  for (const [i, h] of r.history.entries()) {
    if (!record(h) || !shape(h, ['number', 'requestedWeek', 'visitWeek', 'returned', 'consumedBottleId']) || h.number !== i + 1 || !integer(h.requestedWeek, Math.max(s.faceless.promotionWeek ?? s.week, lastVisitWeek), s.week) || !integer(h.visitWeek, h.requestedWeek + 1, s.week) || typeof h.returned !== 'boolean') return false;
    if (!h.returned && (i !== r.history.length - 1 || r.location !== 'COAST')) return false;
    lastVisitWeek = h.visitWeek;
    if (h.consumedBottleId !== null) {
      if (typeof h.consumedBottleId !== 'string') return false;
      const bottle = m.bottles.find(b => b.id === h.consumedBottleId);
      if (!bottle || bottle.status !== 'CONSUMED' || bottle.ritualVisit !== h.number || bottle.consumedWeek !== h.visitWeek) return false;
      consumed += 1;
    }
  }
  if (r.consumptions !== consumed || consumed !== m.bottles.filter(b => b.status === 'CONSUMED').length) return false;
  if (r.requestedWeek !== null && (r.location !== 'CLUB' || historicallyPromoted(s) || r.requestedWeek < lastVisitWeek)) return false;
  if (r.location === 'CLUB') return r.visitWeek === null && !r.singerPresent && !r.singerWilling && !r.singerHealthy && !r.singing && r.history.every(h => h.returned);
  return r.visits > 0 && r.requestedWeek === null && r.visitWeek === s.week && s.world.city === 'ELSEWHERE' && s.activeEvent === null && s.combat === null && r.singerPresent && r.singerWilling && r.singerHealthy && r.history.at(-1)?.returned === false && r.history.at(-1)?.visitWeek === r.visitWeek && !Object.values(m.cases).some(c => c.contactOpen || c.status === 'PREPARED');
}

export { marionettistInside } from "./practice.js";
