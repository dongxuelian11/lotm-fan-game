import { LIFE_GIVER_ABILITY_IDS } from '../life-giver/types.js';
import {SUMMONING_MASTER_ABILITY_IDS} from '../summoning-master/types.js';
import {WITCH_KING_ABILITY_IDS} from '../witch-king/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APOTHECARY_ABILITY_IDS } from '../apothecary/types.js';
import { TAMER_ABILITY_IDS } from '../tamer/types.js';
import { validateCrimsonScholarLife } from './life.js';
import { WEREWOLF_MOON_EVENTS } from '../werewolf/content.js';
import { validateCrimsonScholarEncounter } from './encounter.js';
import { POTION_PROFESSOR_ABILITY_IDS } from '../potion-professor/types.js';
import { VAMPIRE_ABILITY_IDS } from '../vampire/types.js';
import {
  CRIMSON_SCHOLAR_ABILITIES, CRIMSON_SCHOLAR_BOTTLE_IDS, CRIMSON_SCHOLAR_CONSUMPTION_RISK, CRIMSON_SCHOLAR_FORMULA_STATUS,
  CRIMSON_SCHOLAR_RITUAL_KIT_PRICE, CRIMSON_SCHOLAR_RITUAL_KIT_SOURCE, CRIMSON_SCHOLAR_GUIDE, CRIMSON_SCHOLAR_LABOUR_TASKS, CRIMSON_SCHOLAR_MIN_POTION_PROFESSOR_WEEKS, CRIMSON_SCHOLAR_POTION_SOURCES, CRIMSON_SCHOLAR_PRICES, CRIMSON_SCHOLAR_SOURCE_STATUS,
} from './content.js';
import {
  CRIMSON_SCHOLAR_ABILITY_IDS, CRIMSON_SCHOLAR_CASE_IDS, type CrimsonScholarAcquisitionCommand, type CrimsonScholarAction,
  type CrimsonScholarBottle, type CrimsonScholarCommand, type CrimsonScholarProjection, type CrimsonScholarState,
} from './types.js';

export function createCrimsonScholarState(): CrimsonScholarState {
  return {
    guidanceKnown: false,
    bottles: CRIMSON_SCHOLAR_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, potionProfessorActingAtPromotion: null,
    cases: Object.fromEntries(CRIMSON_SCHOLAR_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { field: 'NONE', location: 'START', outboundTrips: 0, returns: 0, reassemblies: 0, reassembledWeek: null },
    ritual: { announcements: WEREWOLF_MOON_EVENTS.map(({ id, week, source }) => ({ id, week, source })), reservedEventId: null, activeVisitId: null, visits: [] },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, reassemblyRound: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'moon' && (s.progression.sequence === 5||([4, 3, 2].includes(s.progression.sequence ?? 0)));
const isPotionProfessor = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.apothecary.discovered && s.apothecary.guidanceKnown && s.tamer.guidanceKnown && s.vampire.guidanceKnown && s.potionProfessor.guidanceKnown && s.potionProfessor.promotionWeek !== null && (isPotionProfessor(s) || promoted(s));
const potionPrice = (bottle: CrimsonScholarBottle) => CRIMSON_SCHOLAR_PRICES.potion - (bottle.labourSteps === 5 ? CRIMSON_SCHOLAR_PRICES.labourCredit : 0);
const bottleNumber = (bottle: CrimsonScholarBottle) => Number(bottle.id.slice('crimson-scholar-potion-'.length));
const potionProfessorWeeks = (s: SliceState) => Math.max(0, (s.crimsonScholar.promotionWeek ?? s.week) - (s.potionProfessor.promotionWeek ?? s.week));
const supplyExhausted = (state: CrimsonScholarState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${CRIMSON_SCHOLAR_GUIDE}的独立深红学者成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5深红学者魔药，原瓶crimson-scholar-potion-${number}，非药师、驯兽师、吸血鬼或魔药教授旧瓶改装。完整配方及仪式材料具体清单、用量待核。`;

const mentorMoonSource = (publishedWeek: number, eventWeek: number) => `${CRIMSON_SCHOLAR_GUIDE}在第${publishedWeek}周公开发布的本作原创G有限城市满月事件：第${eventWeek}周原夜间药房露天屋顶有真实满月照耀；这是已发布的有限场景，不是现实天文学或每四周循环。取消预约不修改日期。`;
const activeVisit = (s: SliceState) => s.crimsonScholar.ritual.visits.find(visit => visit.id === s.crimsonScholar.ritual.activeVisitId);
const reservedMoon = (s: SliceState) => s.crimsonScholar.ritual.announcements.find(event => event.id === s.crimsonScholar.ritual.reservedEventId);
const nextMoon = (s: SliceState) => s.crimsonScholar.ritual.announcements.find(event => event.week > s.week && !s.crimsonScholar.ritual.visits.some(visit => visit.eventId === event.id));

function commandBlock(s: SliceState, command: CrimsonScholarAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'REQUEST_RITUAL', 'BEGIN_RITUAL'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (command.type === 'END_RITUAL') return activeVisit(s) ? null : '没有正在进行的仪式到访。';
  if (command.type === 'CANCEL_RITUAL') {
    if (s.crimsonScholar.ritual.activeVisitId !== null) return '已经到场并耗用仪式包，须实际结束本次仪式。';
    return s.crimsonScholar.ritual.reservedEventId !== null ? null : '没有尚未开始的预约。';
  }
  if (s.crimsonScholar.ritual.activeVisitId !== null && command.type !== 'CONSUME') return '先0行动实际结束本次露天屋顶仪式到访。';
  if (Object.values(s.crimsonScholar.cases).some(value => value.contactOpen) || Object.values(s.potionProfessor.cases).some(value => value.contactOpen)) return '先实际结束当前实践接触，再继续。';
  if (s.tamer.companionId !== null) return '先让当前同行动物安全回到原主人处。';
  if (Object.values(s.potionProfessor.laboratory.effects).some(Boolean)) return '先实际结束原辅助药剂效果，再继续。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原夜间药房，找到艾琳。';
  if (!knownChannel(s)) return '成为魔药教授并保有艾琳的指导渠道后，才能了解深红学者之路。';
  if (promoted(s)) return '你已完成深红学者晋升，不能重复服药或准备新仪式；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.crimsonScholar.guidanceKnown) return '已经听过深红学者成品魔药和真实满月仪式说明。';
    return s.cash < CRIMSON_SCHOLAR_PRICES.guidance ? '深红学者用药指导需要460便士。' : null;
  }
  if (!s.crimsonScholar.guidanceKnown) return '先听艾琳说明原瓶来源、满月仪式与服药风险。';
  if (command.type === 'REQUEST_RITUAL') return s.crimsonScholar.ritual.reservedEventId !== null ? '已有一个预约；取消或结束后才能另约未来事件。' : null;
  if (command.type === 'BEGIN_RITUAL') {
    const event = reservedMoon(s);
    if (!event) return '先预约一个严格未来的已公告真实满月事件。';
    if (event.week !== s.week) return `本次满月公告在第${event.week}周；仅该周可实际到访，错过后取消并另约未来事件。`;
    if (s.crimsonScholar.ritual.visits.some(visit => visit.eventId === event.id)) return '这场满月已经到访，不能重复使用同一事件。';
    return s.cash < CRIMSON_SCHOLAR_RITUAL_KIT_PRICE ? '本次实际到访需要150便士购买并耗用唯一封装仪式包。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.crimsonScholar.resupply.requestedWeek !== null) return '已有补给请求，等下一真实周实际到货。';
    return supplyExhausted(s.crimsonScholar) ? null : '须先用完现有全部深红学者原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.crimsonScholar.resupply.requestedWeek === null) return '尚未申请下一批深红学者补给。';
    if (s.week <= s.crimsonScholar.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.crimsonScholar) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.crimsonScholar.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选深红学者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `魔药教授魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.potionProfessor.promotionWeek === null || potionProfessorWeeks(s) < CRIMSON_SCHOLAR_MIN_POTION_PROFESSOR_WEEKS) return `成为魔药教授后已度过${potionProfessorWeeks(s)}/${CRIMSON_SCHOLAR_MIN_POTION_PROFESSOR_WEEKS}整周，尚不能服药。`;
    const visit = activeVisit(s), event = reservedMoon(s);
    if (!visit || !event || visit.eventId !== event.id || visit.week !== s.week || event.week !== s.week || visit.endedWeek !== null || visit.kitId !== `CS5-KIT-${visit.id}`) return '须当前已公告真实满月周，在原露天屋顶由艾琳在场，实际耗用本次仪式包后才能服药。';
    if (visit.consumedBottleId !== null) return '本次到访已经服过一瓶；先实际退出，另约未来真实满月。';
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原药房劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyCrimsonScholarCommand(s: SliceState, command: CrimsonScholarAcquisitionCommand, c: SeerContext): void {
  rule(validateCrimsonScholarCommand(command) && isCrimsonScholarAcquisitionCommand(command), '深红学者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'REQUEST_RITUAL': {
      let event = nextMoon(s);
      if (!event) {
        const number = s.crimsonScholar.ritual.announcements.length - WEREWOLF_MOON_EVENTS.length + 1;
        event = { id: `crimson-scholar-moon-${number}`, week: s.week + 5, source: mentorMoonSource(s.week, s.week + 5) };
        s.crimsonScholar.ritual.announcements.push(event);
        c.note('艾琳公布下一场有限满月', event.source);
      }
      s.actionsRemaining -= 1;
      s.crimsonScholar.ritual.reservedEventId = event.id;
      c.note('预约未来真实满月', `你花费1行动预约第${event.week}周的${event.id}。仅该周可实际到原夜间药房露天屋顶，由艾琳本人在场主持。此时尚未到访、未消费仪式包，也未服药；可0行动取消预约，已公布月相日期不变。`);
      return;
    }
    case 'BEGIN_RITUAL': {
      const event = reservedMoon(s)!;
      const id = s.crimsonScholar.ritual.visits.length + 1;
      s.actionsRemaining -= 1;
      s.cash -= CRIMSON_SCHOLAR_RITUAL_KIT_PRICE;
      s.crimsonScholar.ritual.visits.push({ id, eventId: event.id, week: s.week, kitId: `CS5-KIT-${id}`, consumedBottleId: null, endedWeek: null });
      s.crimsonScholar.ritual.activeVisitId = id;
      c.note('真实满月下的实际仪式准备', `第${s.week}周，你实际来到原夜间药房露天屋顶，已公告${event.id}的真实满月正在照耀，艾琳本人在场。花费1行动和150便士，唯一原包CS5-KIT-${id}已拆封、准备并实际耗尽。${CRIMSON_SCHOLAR_RITUAL_KIT_SOURCE}现在可以独立确认本次唯一一瓶服药，或0行动实际退出。`);
      return;
    }
    case 'END_RITUAL': {
      const visit = activeVisit(s)!;
      visit.endedWeek = s.week;
      s.crimsonScholar.ritual.activeVisitId = null;
      s.crimsonScholar.ritual.reservedEventId = null;
      c.note('实际结束满月仪式并退出屋顶', `0行动实际停止本次仪式并离开原露天屋顶。到访${visit.id}和唯一原包${visit.kitId}的实际消耗保留，${visit.consumedBottleId === null ? '本次未服药，持有的未服原瓶保留' : `原瓶${visit.consumedBottleId}已耗尽，结果保留`}。没有退款、恢复或治疗；同一满月事件不能再次到访，下次须另约严格未来事件。`);
      return;
    }
    case 'CANCEL_RITUAL': {
      const event = reservedMoon(s)!;
      s.crimsonScholar.ritual.reservedEventId = null;
      c.note('取消尚未开始的满月预约', `0行动取消${event.id}预约，已发布的第${event.week}周真实满月日期和来源保持不变。本次没有到访、没有拆封材料包、没有服药；已付预约行动不退。`);
      return;
    }
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= CRIMSON_SCHOLAR_PRICES.guidance;
      s.crimsonScholar.guidanceKnown = true;
      c.note('听取深红学者用药说明', `花费1行动、460便士，你向已认识的本作原创成年${CRIMSON_SCHOLAR_GUIDE}继续请教，他向你说明从独立深红学者成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险。这些不是原来的药师、驯兽师、吸血鬼或魔药教授存药。${CRIMSON_SCHOLAR_FORMULA_STATUS}魔药教授消化须达100，晋升魔药教授后满12整周才能服用；可提前筹备。${CRIMSON_SCHOLAR_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.crimsonScholar.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = CRIMSON_SCHOLAR_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在艾琳的原夜间药房实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.crimsonScholar.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('深红学者原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原夜间药房劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；魔药教授消化100且晋升魔药教授后满12整周时，再独立确认服药。${CRIMSON_SCHOLAR_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.crimsonScholar.resupply.requestedWeek = s.week;
      c.note('申请下一批深红学者魔药', `现有深红学者原瓶全部耗尽且未晋升。你花费1行动，请${CRIMSON_SCHOLAR_GUIDE}从同一新渠道订下一批三瓶，并实际核验原夜间药房的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.crimsonScholar.bottles.length + 1;
      s.crimsonScholar.resupply.deliveries += 1;
      for (let offset = 0; offset < CRIMSON_SCHOLAR_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.crimsonScholar.bottles.push({ id: `crimson-scholar-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.crimsonScholar.resupply.requestedWeek = null;
      c.note('下一批深红学者原瓶到货', `第${s.week}周，艾琳的独立深红学者成品交接渠道本作G成品供给第${s.crimsonScholar.resupply.deliveries + 1}批三瓶实际到货，原瓶crimson-scholar-potion-${firstNumber}至crimson-scholar-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.crimsonScholar.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      activeVisit(s)!.consumedBottleId = bottle.id;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.crimsonScholar.potionProfessorActingAtPromotion = s.progression.acting;
        s.crimsonScholar.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of CRIMSON_SCHOLAR_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为深红学者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。药师、驯兽师、吸血鬼与魔药教授全部原ID和掌握完整继承，新增区域月相、月光闪现和月光重组三项，从0掌握开始。魔药教授消化和晋升周保留，深红学者扮演从0开始；灵性上限100，当前灵性不补满。区域效果不改变真实天体，能力实际强度依赖知识，具体费用和范围均为原创G。当前仍在实际满月仪式现场，须0行动实际退出；本次材料和原瓶不可恢复。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了深红学者晋升' : '深红学者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是魔药教授，消化与全部原有掌握保留，没有获得深红学者能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectCrimsonScholar(s: SliceState): CrimsonScholarProjection {
  const actions: CrimsonScholarAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? (([4, 3, 2].includes(s.progression.sequence ?? 0))?s.witchKing.crimsonScholarActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: CrimsonScholarAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && s.crimsonScholar.guidanceKnown) {
    if (s.crimsonScholar.ritual.activeVisitId !== null) add('end-crimson-scholar-ritual', '实际结束仪式并离开原屋顶', '0行动 · 已耗材料和原瓶不恢复', { type: 'END_RITUAL' });
    else if (s.crimsonScholar.ritual.reservedEventId !== null) {
      add('begin-crimson-scholar-ritual', '按公告在真实满月下实际准备仪式', '1行动 · 150便士 · 唯一原材料包实际耗尽', { type: 'BEGIN_RITUAL' });
      add('cancel-crimson-scholar-ritual', '取消尚未开始的预约', '0行动 · 已公布满月日期不变', { type: 'CANCEL_RITUAL' });
    } else if (!isPromoted) add('request-crimson-scholar-ritual', '预约下一场已公告的真实满月', '1行动 · 严格未来日期 · 未到场不耗材料', { type: 'REQUEST_RITUAL' });
  }
  if (available && !isPromoted) {
    if (!s.crimsonScholar.guidanceKnown) add('learn-crimson-scholar-guidance', '请艾琳说明深红学者成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.crimsonScholar.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${CRIMSON_SCHOLAR_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶深红学者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.crimsonScholar.resupply.requestedWeek !== null) add('receive-crimson-scholar-supply', '确认下一批三瓶深红学者到货', `0行动 · 第${s.crimsonScholar.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.crimsonScholar)) add('request-crimson-scholar-supply', '向艾琳订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.crimsonScholar.guidanceKnown) {
    for (const bottle of s.crimsonScholar.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶深红学者魔药`, `0行动 · 独立确认 · 魔药教授消化${isPromoted ? s.crimsonScholar.potionProfessorActingAtPromotion : s.progression.acting}/100 · 晋升后${potionProfessorWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.crimsonScholar.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.crimsonScholar.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '深红学者 · 序列5' : '深红学者之路', discovered: available,
    guidanceKnown: available && s.crimsonScholar.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: isPromoted ? { ...s.crimsonScholar.practice } : null,
    cases: [], environment: '', insideCase: s.crimsonScholar.ritual.activeVisitId !== null || s.crimsonScholar.practice.field !== 'NONE' || s.crimsonScholar.practice.location === 'END' || Object.values(s.crimsonScholar.cases).some(value => value.contactOpen),
    ritual: available && s.crimsonScholar.guidanceKnown ? {
      summary: `仅已公告周的真实满月照耀可用于晋升；区域满月能力不能替代。${CRIMSON_SCHOLAR_RITUAL_KIT_SOURCE}`,
      announcements: s.crimsonScholar.ritual.announcements.map(event => `${event.id} · 第${event.week}周 · ${event.source}`),
      reservation: reservedMoon(s) ? `已约${reservedMoon(s)!.id}，第${reservedMoon(s)!.week}周；${reservedMoon(s)!.week < s.week ? '已错过，取消后另约未来事件' : reservedMoon(s)!.week === s.week ? '本周可实际到访' : '尚未到公告周'}。` : '尚无预约。',
      activeVisit: activeVisit(s) ? `到访${activeVisit(s)!.id}：第${activeVisit(s)!.week}周原露天屋顶真实满月照耀，艾琳本人在场；唯一原包${activeVisit(s)!.kitId}已实际耗尽；${activeVisit(s)!.consumedBottleId === null ? '尚未服药' : `已服原瓶${activeVisit(s)!.consumedBottleId}`}，仍须实际退出。` : '当前不在仪式现场。',
      history: s.crimsonScholar.ritual.visits.map(visit => `到访${visit.id} · ${visit.eventId} · 第${visit.week}周 · 原包${visit.kitId}已耗尽 · ${visit.consumedBottleId === null ? '未服药' : `已服${visit.consumedBottleId}`} · ${visit.endedWeek === null ? '尚未退出' : `第${visit.endedWeek}周已实际退出`}`),
    } : { summary: '', announcements: [], reservation: '', activeVisit: '', history: [] },
    ...(available ? { story: CRIMSON_SCHOLAR_SOURCE_STATUS } : {}),
    supplies: available ? `${CRIMSON_SCHOLAR_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.crimsonScholar.resupply.requestedWeek === null ? `已实际接收后续供给${s.crimsonScholar.resupply.deliveries}批。` : `第${s.crimsonScholar.resupply.requestedWeek}周提出请求，第${s.crimsonScholar.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.crimsonScholar.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 深红学者魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? CRIMSON_SCHOLAR_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `魔药教授消化成果${s.crimsonScholar.potionProfessorActingAtPromotion}/100已保留；深红学者扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成魔药教授消化（${s.progression.acting}/100），并在晋升魔药教授后度过12整周（${potionProfessorWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完魔药教授之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 预约未来真实满月 → 公告周实到屋顶并耗用仪式包 → 独立确认服用本次选定原瓶 → 实际退出。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${CRIMSON_SCHOLAR_CONSUMPTION_RISK}` : '成为魔药教授后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REQUEST_RITUAL', 'BEGIN_RITUAL', 'END_RITUAL', 'CANCEL_RITUAL'];
export function isCrimsonScholarAcquisitionCommand(command: unknown): command is CrimsonScholarAcquisitionCommand {
  return validateCrimsonScholarCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateCrimsonScholarCommand(value: unknown): value is CrimsonScholarCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REQUEST_RITUAL', 'BEGIN_RITUAL', 'END_RITUAL', 'CANCEL_RITUAL', 'RETURN', 'REASSEMBLE', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^crimson-scholar-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^crimson-scholar-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && CRIMSON_SCHOLAR_CASE_IDS.includes(value.caseId as typeof CRIMSON_SCHOLAR_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && CRIMSON_SCHOLAR_CASE_IDS.includes(value.caseId as typeof CRIMSON_SCHOLAR_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Announcements are immutable authored events; a created visit is the spent unique kit record. */
function validateRitual(s: SliceState): boolean {
  const raw: unknown = s.crimsonScholar.ritual;
  if (!record(raw) || !shape(raw, ['announcements', 'reservedEventId', 'activeVisitId', 'visits']) || !Array.isArray(raw.announcements) || !Array.isArray(raw.visits)) return false;
  if (raw.announcements.length < WEREWOLF_MOON_EVENTS.length) return false;
  const firstWeek = s.potionProfessor.promotionWeek ?? s.week;
  for (const [index, event] of raw.announcements.entries()) {
    if (!record(event) || !shape(event, ['id', 'week', 'source']) || !integer(event.week, 1) || typeof event.source !== 'string') return false;
    if (index < WEREWOLF_MOON_EVENTS.length) {
      const original = WEREWOLF_MOON_EVENTS[index]!;
      if (event.id !== original.id || event.week !== original.week || event.source !== original.source) return false;
    } else {
      const publishedWeek = (event.week as number) - 5;
      if (!s.crimsonScholar.guidanceKnown || !integer(publishedWeek, Math.max(firstWeek, raw.announcements[index - 1].week as number), s.week)) return false;
      if (event.id !== `crimson-scholar-moon-${index - WEREWOLF_MOON_EVENTS.length + 1}` || event.source !== mentorMoonSource(publishedWeek, event.week as number)) return false;
      if (s.crimsonScholar.promotionWeek !== null && publishedWeek > s.crimsonScholar.promotionWeek) return false;
    }
  }
  const ritual = s.crimsonScholar.ritual;
  if (ritual.reservedEventId !== null && (typeof ritual.reservedEventId !== 'string' || !ritual.announcements.some(event => event.id === ritual.reservedEventId && event.week > firstWeek))) return false;
  if (ritual.activeVisitId !== null && !integer(ritual.activeVisitId, 1, ritual.visits.length)) return false;
  if (!s.crimsonScholar.guidanceKnown && (ritual.announcements.length !== WEREWOLF_MOON_EVENTS.length || ritual.reservedEventId !== null || ritual.activeVisitId !== null || ritual.visits.length !== 0)) return false;
  const eventIds = new Set<string>(), bottleIds = new Set<string>();
  for (const [index, visit] of ritual.visits.entries()) {
    if (!record(visit) || !shape(visit, ['id', 'eventId', 'week', 'kitId', 'consumedBottleId', 'endedWeek'])) return false;
    if (visit.id !== index + 1 || typeof visit.eventId !== 'string' || visit.kitId !== `CS5-KIT-${index + 1}` || !integer(visit.week, firstWeek + 1, s.week)) return false;
    const event = ritual.announcements.find(item => item.id === visit.eventId);
    if (!event || event.week !== visit.week || eventIds.has(visit.eventId)) return false;
    eventIds.add(visit.eventId);
    if (index > 0 && ritual.visits[index - 1]!.week >= visit.week) return false;
    if (s.crimsonScholar.promotionWeek !== null && visit.week > s.crimsonScholar.promotionWeek) return false;
    if (visit.endedWeek === null) {
      if (ritual.activeVisitId !== visit.id || index !== ritual.visits.length - 1 || ritual.reservedEventId !== visit.eventId || visit.week !== s.week) return false;
    } else if (visit.endedWeek !== visit.week || ritual.activeVisitId === visit.id) return false;
    if (visit.consumedBottleId !== null) {
      if (typeof visit.consumedBottleId !== 'string' || bottleIds.has(visit.consumedBottleId)) return false;
      const bottle = s.crimsonScholar.bottles.find(item => item.id === visit.consumedBottleId);
      if (!bottle || bottle.status !== 'CONSUMED' || bottle.consumedWeek !== visit.week) return false;
      bottleIds.add(visit.consumedBottleId);
    }
  }
  if (ritual.activeVisitId !== null) {
    const visit = ritual.visits.find(item => item.id === ritual.activeVisitId);
    if (!visit || visit.endedWeek !== null || s.world.city !== 'BACKLUND' || s.combat !== null || s.activeEvent !== null) return false;
    if (Object.values(s.crimsonScholar.cases).some(item => item.contactOpen || item.status === 'PREPARED')) return false;
  } else if (ritual.reservedEventId !== null && eventIds.has(ritual.reservedEventId)) return false;
  if (s.crimsonScholar.promotionWeek !== null && ritual.reservedEventId !== null && ritual.activeVisitId === null) return false;
  return s.crimsonScholar.bottles.every(bottle => bottle.status !== 'CONSUMED' || bottleIds.has(bottle.id));
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateCrimsonScholarState(s: SliceState): boolean {
  const raw: unknown = s.crimsonScholar;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'potionProfessorActingAtPromotion', 'cases', 'practice', 'ritual', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.apothecary) || !record(s.tamer) || !record(s.vampire) || !record(s.potionProfessor)) return false;
  const firstPotionProfessorWeek = s.potionProfessor.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstPotionProfessorWeek + CRIMSON_SCHOLAR_MIN_POTION_PROFESSOR_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== CRIMSON_SCHOLAR_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, CRIMSON_SCHOLAR_CASE_IDS) || Object.values(raw.cases).some(value => !record(value))) return false;
  if (!record(raw.practice) || !record(raw.encounter) || !record(raw.ritual)) return false;
  if (!validateCrimsonScholarLife(s)) return false;
  const crimsonScholar = raw as unknown as CrimsonScholarState, isPromoted = promoted(s);
  if (crimsonScholar.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!crimsonScholar.guidanceKnown || !integer(s.potionProfessor.promotionWeek, 1, s.week) || !integer(crimsonScholar.promotionWeek, firstConsumptionWeek, s.week) || crimsonScholar.potionProfessorActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS, ...VAMPIRE_ABILITY_IDS, ...POTION_PROFESSOR_ABILITY_IDS, ...CRIMSON_SCHOLAR_ABILITY_IDS,...(([4, 3, 2].includes(s.progression.sequence ?? 0))?WITCH_KING_ABILITY_IDS:[]),...([3, 2].includes(s.progression.sequence ?? 0) ? SUMMONING_MASTER_ABILITY_IDS : []),...(s.progression.sequence === 2 ? LIFE_GIVER_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (crimsonScholar.promotionWeek !== null || crimsonScholar.potionProfessorActingAtPromotion !== null || CRIMSON_SCHOLAR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (crimsonScholar.practice.field !== 'NONE' || crimsonScholar.practice.location !== 'START' || crimsonScholar.practice.outboundTrips !== 0 || crimsonScholar.practice.returns !== 0 || crimsonScholar.practice.reassemblies !== 0 || crimsonScholar.practice.reassembledWeek !== null) return false;
    if (crimsonScholar.reflected || Object.values(crimsonScholar.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of crimsonScholar.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `crimson-scholar-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of crimsonScholar.bottles.entries()) {
    let stockWeek = firstPotionProfessorWeek;
    if (index < CRIMSON_SCHOLAR_BOTTLE_IDS.length) {
      if (bottle.source !== CRIMSON_SCHOLAR_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!crimsonScholar.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / CRIMSON_SCHOLAR_BOTTLE_IDS.length) - 1;
      if (index % CRIMSON_SCHOLAR_BOTTLE_IDS.length === 0) {
        const previous = crimsonScholar.bottles.slice(index - CRIMSON_SCHOLAR_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > crimsonScholar.promotionWeek!) return false;
    }
    if (!crimsonScholar.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > crimsonScholar.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > crimsonScholar.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== crimsonScholar.promotionWeek) return false;
    }
  }
  if (crimsonScholar.resupply.requestedWeek !== null && (!crimsonScholar.guidanceKnown || isPromoted || !supplyExhausted(crimsonScholar) || crimsonScholar.bottles.some(bottle => bottle.consumedWeek! > crimsonScholar.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek', 'reassemblyRound']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = crimsonScholar.encounter;
  if (e.reassemblyRound !== null && (!integer(e.reassemblyRound, 1) || e.status !== 'FIGHTING')) return false;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, crimsonScholar.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'CRIMSON_SCHOLAR_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(crimsonScholar.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && Object.values(crimsonScholar.cases).some(r => r.contactOpen || r.status === 'PREPARED')) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'crimson-scholar-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateRitual(s) && validateCrimsonScholarEncounter(s);
}

export { CRIMSON_SCHOLAR_ABILITIES } from './content.js';
export type * from './types.js';
