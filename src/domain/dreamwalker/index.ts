import {DISCERNER_ABILITY_IDS} from '../discerner/types.js';
import {DREAM_WEAVER_ABILITY_IDS} from '../dream-weaver/types.js';
import {MANIPULATOR_ABILITY_IDS} from '../manipulator/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { AUDIENCE_ABILITY_IDS } from '../audience/types.js';
import { MINDREADER_ABILITY_IDS } from '../mindreader/types.js';
import { PSYCHOLOGIST_ABILITY_IDS } from '../psychologist/types.js';
import { HYPNOTIST_ABILITY_IDS } from '../hypnotist/types.js';
import { validateDreamwalkerLife } from './life.js';
import { validateDreamwalkerEncounter } from './encounter.js';
import {
  DREAMWALKER_ABILITIES, DREAMWALKER_BOTTLE_IDS, DREAMWALKER_CONSUMPTION_RISK, DREAMWALKER_FEATHER_ID,
  DREAMWALKER_FORMULA_STATUS, DREAMWALKER_GUIDE, DREAMWALKER_LABOUR_TASKS, DREAMWALKER_MIN_HYPNOTIST_WEEKS,
  DREAMWALKER_POTION_SOURCES, DREAMWALKER_PRICES, DREAMWALKER_SOURCE_STATUS,
} from './content.js';
import {
  DREAMWALKER_ABILITY_IDS, DREAMWALKER_CASE_IDS, type DreamwalkerAcquisitionCommand, type DreamwalkerAction,
  type DreamwalkerBottle, type DreamwalkerCommand, type DreamwalkerProjection, type DreamwalkerState,
} from './types.js';

export function createDreamwalkerState(): DreamwalkerState {
  return {
    guidanceKnown: false,
    bottles: DREAMWALKER_POTION_SOURCES.map(({ id, source }) => ({ id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, hypnotistActingAtPromotion: null,
    ritual: { requestedWeek: null, contractAcceptedWeek: null, featherHolder: 'LINGWEI', activeVisitId: null, visits: [] },
    cases: Object.fromEntries(DREAMWALKER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0, notes: [], sessions: 0, sessionWeeks: [], verified: false }])),
    practice: { location: 'SOURCE_ROOM', dream: 'NONE', outboundTrips: 0, returns: 0, wakingChecks: 0 },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'audience' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isHypnotist = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.audience.discovered && s.audience.formulaKnown && s.mindreader.formulaKnown && s.psychologist.guidanceKnown && s.hypnotist.guidanceKnown && s.hypnotist.promotionWeek !== null && (isHypnotist(s) || promoted(s));
const potionPrice = (bottle: DreamwalkerBottle) => DREAMWALKER_PRICES.potion - (bottle.labourSteps === 5 ? DREAMWALKER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: DreamwalkerBottle) => Number(bottle.id.slice('dreamwalker-potion-'.length));
const hypnotistWeeks = (s: SliceState) => Math.max(0, (s.dreamwalker.promotionWeek ?? s.week) - (s.hypnotist.promotionWeek ?? s.week));
const supplyExhausted = (state: DreamwalkerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${DREAMWALKER_GUIDE}的独立梦境行者成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5梦境行者魔药，原瓶dreamwalker-potion-${number}，非观众、读心者、心理医生或催眠师旧瓶改装。完整配方资料待核。`;
const currentVisit = (s: SliceState) => s.dreamwalker.ritual.visits.find(visit => visit.id === s.dreamwalker.ritual.activeVisitId);

function commandBlock(s: SliceState, command: DreamwalkerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'REQUEST_RITUAL', 'BEGIN_RITUAL'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.hypnotist.cases).some(value => value.contactOpen || value.status === 'PREPARED')) return '先实际结束催眠师接触或取消尚未实施的准备。';
  if (Object.values(s.dreamwalker.cases).some(value => value.contactOpen) || s.dreamwalker.practice.dream !== 'NONE' || s.dreamwalker.practice.location !== 'SOURCE_ROOM') return '先结束梦境实践，返回源房间并清醒核验。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德原会所，找到阅览室观察导师。';
  if (!knownChannel(s)) return '成为催眠师并保有原阅览室观察导师的指导渠道后，才能了解梦境行者之路。';
  const ritual = s.dreamwalker.ritual, visit = currentVisit(s);
  if (command.type === 'END_RITUAL') return visit ? null : '没有正在进行的铃尾会面。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (promoted(s)) return '你已完成梦境行者晋升；结束本次会面、归还原尾羽后再继续实践。未服原瓶仍保留。';
  if (visit && command.type !== 'CONSUME') return '先结束本次铃尾会面并归还同一根原尾羽，再处理其它准备。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.dreamwalker.guidanceKnown) return '已经听过梦境行者成品与必要仪式的说明。';
    return s.cash < DREAMWALKER_PRICES.guidance ? '梦境行者用药指导需要460便士。' : null;
  }
  if (!s.dreamwalker.guidanceKnown) return '先请原导师说明序列5原瓶来源、必要仪式与服药风险。';
  if (command.type === 'REQUEST_RITUAL') return ritual.requestedWeek !== null ? '已经预约铃尾，下一真实周起再进入原会所专室。' : null;
  if (command.type === 'BEGIN_RITUAL') {
    if (ritual.requestedWeek === null) return '先通过原导师预约已有专业联系的铃尾。';
    if (s.week <= ritual.requestedWeek) return '铃尾尚未到场，预约后的下一真实周起才能会面。';
    return s.cash < DREAMWALKER_PRICES.ritual ? '原会所专室本次会面需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.dreamwalker.resupply.requestedWeek !== null) return '已有补给请求，下一真实周起才能实际收货。';
    return supplyExhausted(s.dreamwalker) ? null : '须先用完现有全部梦境行者原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.dreamwalker.resupply.requestedWeek === null) return '尚未申请下一批梦境行者原瓶。';
    if (s.week <= s.dreamwalker.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.dreamwalker) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.dreamwalker.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选梦境行者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `催眠师魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.hypnotist.promotionWeek === null || hypnotistWeeks(s) < DREAMWALKER_MIN_HYPNOTIST_WEEKS) return `成为催眠师后已度过${hypnotistWeeks(s)}/12整周，尚不能服药。`;
    if (s.health <= 20 || s.mind <= 40) return '本次服药需要健康>20且精神>40；先休养，四档实际代价不会被免除。';
    if (!visit || !visit.participantPresent || visit.endedWeek !== null || visit.startedWeek !== s.week) return '须在预约后的实际会面中，由铃尾到场承担外力唤醒。';
    if (visit.consumedBottleId !== null) return '本次会面已经服过一瓶。须先归还原尾羽并结束会面，再另行预约下一真实周。';
    if (ritual.contractAcceptedWeek === null || !visit.contractConfirmed) return '尚未与自主同意的铃尾建立有效契约。';
    if (ritual.featherHolder !== 'PLAYER' || visit.featherReturned) return '须实际暂持铃尾唯一的原尾羽DW5-FEATHER。';
    return visit.emotionPrepared ? null : '须先回忆本人的真实喜悦经历，形成明确的强烈情绪准备。';
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原阅览室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy; slice commits the complete intent atomically. */
export function applyDreamwalkerCommand(s: SliceState, command: DreamwalkerAcquisitionCommand, c: SeerContext): void {
  rule(validateDreamwalkerCommand(command) && isDreamwalkerAcquisitionCommand(command), '梦境行者准备命令无效。');
  const blocked = commandBlock(s, command); rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1; s.cash -= DREAMWALKER_PRICES.guidance; s.dreamwalker.guidanceKnown = true;
      c.note('听取梦境行者用药与仪式说明', `花费1行动、460便士，${DREAMWALKER_GUIDE}说明实际独立取得的序列5原瓶，以及不可省略的鸟妖契约、原尾羽、强烈情绪与外力唤醒。催眠师须消化100且晋升后满12整周，可提前筹备。${DREAMWALKER_FORMULA_STATUS}${DREAMWALKER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.dreamwalker.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1; bottle.labourSteps += 1;
      c.note(`完成${DREAMWALKER_LABOUR_TASKS[bottle.labourSteps - 1]}`, `在原阅览室实际完成本瓶对应劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳务${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵本瓶4200便士，仍须支付600便士才会交付；不折现，不生成材料或别人的货物。' : '五次全部完成才抵本瓶4200便士，未完成不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.dreamwalker.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle); s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      c.note('梦境行者原瓶实际交付', `导师将序列5成品原瓶${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '本瓶五次劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}尚未服药，满足消化与成熟条件并完成必要仪式后再独立确认。${DREAMWALKER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_RITUAL':
      s.actionsRemaining -= 1; s.dreamwalker.ritual.requestedWeek = s.week;
      c.note('通过原导师预约铃尾', `花费1行动，原导师联系已有专业往来的智慧人头鸟妖铃尾，约定第${s.week + 1}周起在原会所专室会面。本周铃尾尚未到场，契约与尾羽尚未交付；这不是召唤能力。`);
      return;
    case 'BEGIN_RITUAL': {
      const ritual = s.dreamwalker.ritual, first = ritual.contractAcceptedWeek === null;
      s.actionsRemaining -= 1; s.cash -= DREAMWALKER_PRICES.ritual;
      const id = ritual.visits.length + 1;
      ritual.visits.push({ id, requestedWeek: ritual.requestedWeek!, startedWeek: s.week, endedWeek: null, contractConfirmed: true, participantPresent: true, emotionPrepared: true, featherReturned: false, consumedBottleId: null, awakened: false });
      ritual.requestedWeek = null; ritual.activeVisitId = id; ritual.featherHolder = 'PLAYER';
      if (first) ritual.contractAcceptedWeek = s.week;
      c.note('铃尾到场，契约与原尾羽就绪', `你花费1行动、120便士实际进入原会所专室。铃尾本人已经到场，在明白本次唤醒职责后自主同意${first ? '与你建立唯一的持续契约' : '继续履行原有的同一契约，没有复制新契约'}，将它的同一根原尾羽${DREAMWALKER_FEATHER_ID}交给你暂持。你回忆自己亲历的首次成功晋升、真实摆脱先前困境的喜悦，在此刻重新体验明确强烈的激动；这是本人的经历，不是改写他人梦境。铃尾保持在场，可在本次服药后实际唤醒你。本次会面只允许服用一瓶，也可未服即结束，归还同一原尾羽。`);
      return;
    }
    case 'END_RITUAL': {
      const ritual = s.dreamwalker.ritual, visit = currentVisit(s)!;
      visit.endedWeek = s.week; visit.participantPresent = false; visit.featherReturned = true;
      ritual.featherHolder = 'LINGWEI'; ritual.activeVisitId = null;
      c.note('归还同一原尾羽并结束会面', `你将唯一原尾羽${DREAMWALKER_FEATHER_ID}归还铃尾，铃尾本人离开原会所专室，本次会面实际结束，0行动。${visit.consumedBottleId === null ? '本次未服药，未耗原瓶，已付会面费用不退。' : `本次原瓶${visit.consumedBottleId}已耗尽，服药结果与铃尾实际唤醒记录保留；原瓶和费用不返还。`}原契约仍保留，但没有鸟妖在场或尾羽暂持，不能据此远程服药或召唤；再次尝试须重新预约，等待下一真实周。`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1; s.dreamwalker.resupply.requestedWeek = s.week;
      c.note('申请下一批梦境行者原瓶', `现有原瓶全部耗尽失败。你花费1行动请原导师向同一独立成品渠道订下三瓶并核对清单；本周未新增原瓶，第${s.week + 1}周起可实际收货。每瓶4800便士，或完成本瓶五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const first = s.dreamwalker.bottles.length + 1; s.dreamwalker.resupply.deliveries += 1;
      for (let offset = 0; offset < DREAMWALKER_BOTTLE_IDS.length; offset += 1) {
        const number = first + offset;
        s.dreamwalker.bottles.push({ id: `dreamwalker-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.dreamwalker.resupply.requestedWeek = null;
      c.note('下一批梦境行者原瓶到货', `第${s.week}周实际收到原瓶dreamwalker-potion-${first}至dreamwalker-potion-${first + 2}，0行动，仍由导师保管、逐瓶购买，费用与五次劳务条件不变。旧原瓶、失败、会面与实际唤醒记录完整保留，未免费交付。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.dreamwalker.bottles.find(candidate => candidate.id === command.bottleId)!, visit = currentVisit(s)!;
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.outcome = result.tier;
      visit.consumedBottleId = bottle.id; visit.awakened = true;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost; s.dreamwalker.hypnotistActingAtPromotion = s.progression.acting; s.dreamwalker.promotionWeek = s.week;
        s.progression.sequence = 5; s.progression.acting = 0;
        for (const id of DREAMWALKER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        c.note('铃尾实际唤醒你，成为梦境行者', `原瓶${bottle.id}耗尽。你在强烈情绪中持原尾羽服药，铃尾依原契约在场实施外力唤醒。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质、感知、意志、知识各+1。观众、读心者、心理医生和催眠师全部原ID与原掌握完整继承，仅新增梦境引导、梦境修改、梦境穿梭各0掌握，催眠师消化100成果与晋升周保留，梦境行者扮演从0开始。灵性上限100，当前灵性不补满。先归还同一原尾羽、结束本次会面，才能进行新的实践。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20; s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '铃尾唤醒你，导师中断晋升' : '铃尾唤醒你，梦境行者魔药发生排异', `原瓶${bottle.id}耗尽。铃尾实际依契约在场唤醒你，导师处理排异；意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是催眠师，消化100与全部原掌握保留，没有获得梦境行者能力，也没有随机即死。须归还同一原尾羽、结束会面后休养，再重新预约下一真实周的会面，领取另一独立原瓶；本次会面不能再服第二瓶。`);
      }
      return;
    }
  }
}

export function projectDreamwalker(s: SliceState): DreamwalkerProjection {
  const actions: DreamwalkerAction[] = [], available = knownChannel(s), isPromoted = promoted(s), ritual = s.dreamwalker.ritual;
  const visit = currentVisit(s), acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.manipulator.dreamwalkerActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: DreamwalkerAcquisitionCommand) => {
    const reason = commandBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.dreamwalker.guidanceKnown) add('learn-dreamwalker-guidance', '请原导师说明梦境行者成品与必要仪式', '1行动 · 460便士 · 配方仍未核实', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.dreamwalker.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${DREAMWALKER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳务${bottle.labourSteps}/5 · 五次抵本瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶梦境行者原瓶`, `0行动 · ${potionPrice(bottle)}便士 · 实际交付序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.dreamwalker.resupply.requestedWeek !== null) add('receive-dreamwalker-supply', '确认下一批三瓶梦境行者到货', `0行动 · 第${s.dreamwalker.resupply.requestedWeek + 1}周起 · 到货仍须购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.dreamwalker)) add('request-dreamwalker-supply', '向原导师订下下一批三瓶原瓶', '1行动 · 下一真实周到货 · 每瓶费用照常', { type: 'REQUEST_SUPPLY' });
      if (!visit) {
        if (ritual.requestedWeek === null) add('request-dreamwalker-ritual', '通过原导师预约铃尾', '1行动 · 下一真实周起会面 · 不获得召唤能力', { type: 'REQUEST_RITUAL' });
        else add('begin-dreamwalker-ritual', '实际进入原专室，与铃尾会面并准备仪式', `1行动 · 120便士 · 第${ritual.requestedWeek + 1}周起 · 同一契约与原尾羽`, { type: 'BEGIN_RITUAL' });
      }
    }
  }
  if (available && s.dreamwalker.guidanceKnown && !isPromoted) for (const bottle of s.dreamwalker.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶梦境行者魔药`, `0行动 · 独立确认 · 催眠师消化${s.progression.acting}/100 · ${hypnotistWeeks(s)}/12整周 · 本会面仅一瓶`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  if (available && visit) add('end-dreamwalker-ritual', '归还同一原尾羽，结束铃尾会面', '0行动 · 可取消未服药会面 · 已付费用与已耗原瓶不返还', { type: 'END_RITUAL' });
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  return {
    title: isPromoted ? '梦境行者 · 序列5' : '梦境行者之路', discovered: available,
    guidanceKnown: available && s.dreamwalker.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: Object.values(s.dreamwalker.cases).some(value => value.contactOpen),
    practice: isPromoted ? { ...s.dreamwalker.practice } : null,
    ...(available ? { story: DREAMWALKER_SOURCE_STATUS } : {}),
    supplies: available ? `${DREAMWALKER_FORMULA_STATUS}供应方剩余${s.dreamwalker.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持有未服原瓶${s.dreamwalker.bottles.filter(b => b.status === 'PLAYER').length}瓶。${s.dreamwalker.resupply.requestedWeek === null ? `实际接收后续供给${s.dreamwalker.resupply.deliveries}批。` : `第${s.dreamwalker.resupply.requestedWeek}周申请，第${s.dreamwalker.resupply.requestedWeek + 1}周起可实际收货。`}` : '',
    actions,
    bottles: available ? s.dreamwalker.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 梦境行者魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周实际交付；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳务${bottle.labourSteps}/5` : bottle.status === 'PLAYER' ? '已交付，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升，已唤醒' : '排异，未晋升，已唤醒'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? DREAMWALKER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `催眠师消化成果${s.dreamwalker.hypnotistActingAtPromotion}/100已保留；梦境行者扮演${acting}/100，能力掌握分别记录。` : available ? `服药前须催眠师消化100（目前${s.progression.acting}/100），晋升催眠师后满12整周（${hypnotistWeeks(s)}/12）。指导、成品与预约可提前准备。` : '先走完催眠师之路。',
    pollution: s.seer.pollution,
    risk: available ? `指导 → 原瓶交付 → 预约铃尾并等到下一真实周 → 实际专室会面、有效契约、暂持原尾羽、强烈情绪 → 独立确认服药 → 实际唤醒 → 归还原羽、结束会面。全部三瓶耗尽失败后可请求下一批，下一真实周到货。${DREAMWALKER_CONSUMPTION_RISK}` : '成为催眠师后，可向原导师了解下一序列。',
    ritual: {
      title: '铃尾与唯一原尾羽 · 必要晋升仪式',
      status: !available || !s.dreamwalker.guidanceKnown ? '尚未了解' : visit ? `第${visit.id}次实际会面${visit.consumedBottleId ? '，已服一瓶，须结束' : '，仪式已准备，可服一瓶或取消'}` : '当前没有鸟妖在场',
      participant: available && s.dreamwalker.guidanceKnown ? '铃尾：原导师已有专业联系的智慧灵界人头鸟妖；按预约自主到场，玩家无召唤权限。' : '',
      contract: ritual.contractAcceptedWeek === null ? '尚未建立契约' : `第${ritual.contractAcceptedWeek}周双方自主建立的同一持续契约；不复制，不提供远程唤醒。`,
      feather: `${DREAMWALKER_FEATHER_ID}始终只有1枚，${ritual.featherHolder === 'PLAYER' ? '本次由你实际暂持，结束时须原物归还' : '由铃尾持有，没有玩家副本'}。`,
      emotion: visit?.emotionPrepared ? '本人的真实喜悦经历已唤起明确强烈情绪，不借用或篡改他人记忆。' : '须在实际会面中回忆本人喜悦经历，明确准备强烈情绪。',
      appointment: ritual.requestedWeek === null ? '没有待赴预约' : `第${ritual.requestedWeek}周预约，第${ritual.requestedWeek + 1}周起可实际会面，1行动、120便士。`,
      visits: ritual.visits.map(item => ({ id: item.id, summary: `第${item.requestedWeek}周预约，第${item.startedWeek}周实际到场；${item.consumedBottleId === null ? '未服药' : `原瓶${item.consumedBottleId}已耗，${item.awakened ? '铃尾实际唤醒' : '尚未唤醒'}`}；${item.endedWeek === null ? '原羽暂持，会面尚未结束' : `第${item.endedWeek}周归还同一原羽并结束`}。` })),
    },
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REQUEST_RITUAL', 'BEGIN_RITUAL', 'END_RITUAL'];
export function isDreamwalkerAcquisitionCommand(command: unknown): command is DreamwalkerAcquisitionCommand {
  return validateDreamwalkerCommand(command) && acquisitionCommands.includes(command.type);
}
export function validateDreamwalkerCommand(value: unknown): value is DreamwalkerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REQUEST_RITUAL', 'BEGIN_RITUAL', 'END_RITUAL', 'RETURN', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^dreamwalker-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^dreamwalker-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'VERIFY', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && DREAMWALKER_CASE_IDS.includes(value.caseId as typeof DREAMWALKER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && DREAMWALKER_CASE_IDS.includes(value.caseId as typeof DREAMWALKER_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Validates identity, paid/prepared chronology, exactly one external waking per consumed original, and acquisition/life separation. */
export function validateDreamwalkerState(s: SliceState): boolean {
  const raw: unknown = s.dreamwalker;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'hypnotistActingAtPromotion', 'ritual', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.audience) || !record(s.mindreader) || !record(s.psychologist) || !record(s.hypnotist)) return false;
  const firstHypnotistWeek = s.hypnotist.promotionWeek ?? s.week, firstConsumptionWeek = firstHypnotistWeek + DREAMWALKER_MIN_HYPNOTIST_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== DREAMWALKER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, DREAMWALKER_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'notes', 'sessions', 'sessionWeeks', 'verified'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'EVIDENCE_CHECKED', 'REFLECTION_CHECKED', 'TRAVEL_CHECKED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0) || !Array.isArray(value.notes) || !value.notes.every(note => typeof note === 'string') || typeof value.verified !== 'boolean' || !integer(value.sessions, 0) || !Array.isArray(value.sessionWeeks) || !value.sessionWeeks.every(week => integer(week, firstActivityWeek, s.week))) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  if (!record(raw.practice) || !shape(raw.practice, ['location', 'dream', 'outboundTrips', 'returns', 'wakingChecks']) || !['SOURCE_ROOM', 'TARGET_ROOM'].includes(raw.practice.location as string) || !['NONE', 'NOEL', 'AMINA'].includes(raw.practice.dream as string) || !integer(raw.practice.outboundTrips, 0) || !integer(raw.practice.returns, 0) || !integer(raw.practice.wakingChecks, 0)) return false;
  const dreamwalker = raw as unknown as DreamwalkerState, isPromoted = promoted(s);
  if (dreamwalker.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!dreamwalker.guidanceKnown || !integer(s.hypnotist.promotionWeek, 1, s.week) || !integer(dreamwalker.promotionWeek, firstConsumptionWeek, s.week) || dreamwalker.hypnotistActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===2?DISCERNER_ABILITY_IDS:[]),...AUDIENCE_ABILITY_IDS, ...MINDREADER_ABILITY_IDS, ...PSYCHOLOGIST_ABILITY_IDS, ...HYPNOTIST_ABILITY_IDS, ...DREAMWALKER_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?MANIPULATOR_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?DREAM_WEAVER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (dreamwalker.promotionWeek !== null || dreamwalker.hypnotistActingAtPromotion !== null || DREAMWALKER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (dreamwalker.reflected || Object.values(dreamwalker.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0 || value.notes.length !== 0 || value.sessions !== 0 || value.sessionWeeks.length !== 0 || value.verified)) return false;
    if (dreamwalker.practice.location !== 'SOURCE_ROOM' || dreamwalker.practice.dream !== 'NONE' || dreamwalker.practice.outboundTrips !== 0 || dreamwalker.practice.returns !== 0 || dreamwalker.practice.wakingChecks !== 0) return false;
  }
  // Validate all bottle shapes before reading any previous batch or visit references.
  for (const [index, bottle] of dreamwalker.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome']) || bottle.id !== `dreamwalker-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0; const deliveryWeeks: number[] = [];
  for (const [index, bottle] of dreamwalker.bottles.entries()) {
    let stockWeek = firstHypnotistWeek;
    if (index < DREAMWALKER_BOTTLE_IDS.length) {
      if (bottle.source !== DREAMWALKER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/); stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!dreamwalker.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / DREAMWALKER_BOTTLE_IDS.length) - 1;
      if (index % DREAMWALKER_BOTTLE_IDS.length === 0) {
        const previous = dreamwalker.bottles.slice(index - DREAMWALKER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > dreamwalker.promotionWeek!) return false;
    }
    if (!dreamwalker.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') { if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false; continue; }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > dreamwalker.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') { if (bottle.consumedWeek !== null || bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > dreamwalker.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') { successes += 1; if (bottle.consumedWeek !== dreamwalker.promotionWeek) return false; }
  }
  if (dreamwalker.resupply.requestedWeek !== null && (!dreamwalker.guidanceKnown || isPromoted || !supplyExhausted(dreamwalker) || dreamwalker.bottles.some(bottle => bottle.consumedWeek! > dreamwalker.resupply.requestedWeek!))) return false;
  if (!record(raw.ritual) || !shape(raw.ritual, ['requestedWeek', 'contractAcceptedWeek', 'featherHolder', 'activeVisitId', 'visits']) || !Array.isArray(raw.ritual.visits) || !['LINGWEI', 'PLAYER'].includes(raw.ritual.featherHolder as string)) return false;
  const ritual = dreamwalker.ritual;
  if (ritual.requestedWeek !== null && (!dreamwalker.guidanceKnown || isPromoted || !integer(ritual.requestedWeek, firstHypnotistWeek, s.week))) return false;
  if (ritual.activeVisitId !== null && !integer(ritual.activeVisitId, 1, ritual.visits.length)) return false;
  if (ritual.activeVisitId !== null && (ritual.requestedWeek !== null || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || Object.values(dreamwalker.cases).some(value => value.contactOpen) || dreamwalker.practice.dream !== 'NONE' || dreamwalker.practice.location !== 'SOURCE_ROOM')) return false;
  if (ritual.featherHolder !== (ritual.activeVisitId === null ? 'LINGWEI' : 'PLAYER')) return false;
  if (ritual.visits.length === 0 ? ritual.contractAcceptedWeek !== null : !dreamwalker.guidanceKnown) return false;
  const referencedBottles = new Set<string>(); let openVisits = 0, previousEnd = firstHypnotistWeek, promotionVisitSeen = false;
  for (const [index, visit] of ritual.visits.entries()) {
    if (!record(visit) || !shape(visit, ['id', 'requestedWeek', 'startedWeek', 'endedWeek', 'contractConfirmed', 'participantPresent', 'emotionPrepared', 'featherReturned', 'consumedBottleId', 'awakened']) || visit.id !== index + 1) return false;
    if (!integer(visit.requestedWeek, previousEnd, s.week) || !integer(visit.startedWeek, visit.requestedWeek + 1, s.week) || visit.contractConfirmed !== true || visit.emotionPrepared !== true || typeof visit.participantPresent !== 'boolean' || typeof visit.featherReturned !== 'boolean' || typeof visit.awakened !== 'boolean') return false;
    if (promotionVisitSeen || isPromoted && visit.startedWeek > dreamwalker.promotionWeek!) return false;
    if (index === 0 && ritual.contractAcceptedWeek !== visit.startedWeek) return false;
    if (visit.endedWeek === null) {
      openVisits += 1;
      if (index !== ritual.visits.length - 1 || ritual.activeVisitId !== visit.id || visit.startedWeek !== s.week || !visit.participantPresent || visit.featherReturned) return false;
    } else {
      if (!integer(visit.endedWeek, visit.startedWeek, s.week) || visit.participantPresent || !visit.featherReturned) return false;
      previousEnd = visit.endedWeek;
    }
    if (visit.consumedBottleId === null) { if (visit.awakened) return false; }
    else {
      if (typeof visit.consumedBottleId !== 'string' || referencedBottles.has(visit.consumedBottleId) || !visit.awakened) return false;
      const bottle = dreamwalker.bottles.find(item => item.id === visit.consumedBottleId);
      if (!bottle || bottle.status !== 'CONSUMED' || !integer(bottle.consumedWeek, visit.startedWeek, visit.endedWeek ?? s.week)) return false;
      referencedBottles.add(visit.consumedBottleId);
      if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') promotionVisitSeen = true;
    }
  }
  if (openVisits !== (ritual.activeVisitId === null ? 0 : 1) || dreamwalker.bottles.filter(bottle => bottle.status === 'CONSUMED').length !== referencedBottles.size) return false;
  if (ritual.requestedWeek !== null && ritual.requestedWeek < previousEnd) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek'])) return false;
  return successes === (isPromoted ? 1 : 0) && validateDreamwalkerLife(s) && validateDreamwalkerEncounter(s);
}

export { DREAMWALKER_ABILITIES } from './content.js';
export type * from './types.js';
