import { CATASTROPHE_ABILITY_IDS } from '../catastrophe/types.js';
import {SEA_KING_ABILITY_IDS} from '../sea-king/types.js';
import {CATACLYSM_PRIEST_ABILITY_IDS} from '../cataclysm-priest/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SAILOR_ABILITY_IDS } from '../sailor/types.js';
import { RAGER_ABILITY_IDS } from '../rager/types.js';
import { validateOceanSingerLife, oceanSingerInside } from './life.js';
import { validateOceanSingerEncounter } from './encounter.js';
import { windBlessedInside } from '../wind-blessed/life.js';
import { WIND_BLESSED_ABILITY_IDS } from '../wind-blessed/types.js';
import { NAVIGATOR_ABILITY_IDS } from '../navigator/types.js';
import {
  OCEAN_SINGER_ABILITIES, OCEAN_SINGER_BOTTLE_IDS, OCEAN_SINGER_CONSUMPTION_RISK, OCEAN_SINGER_FORMULA_STATUS,
  OCEAN_SINGER_GUIDE, OCEAN_SINGER_LABOUR_TASKS, OCEAN_SINGER_MIN_WIND_BLESSED_WEEKS, OCEAN_SINGER_POTION_SOURCES, OCEAN_SINGER_PRICES, OCEAN_SINGER_SOURCE_STATUS, OCEAN_SINGER_RITUAL_SOURCE,
} from './content.js';
import {
  OCEAN_SINGER_ABILITY_IDS, OCEAN_SINGER_CASE_IDS, type OceanSingerAcquisitionCommand, type OceanSingerAction,
  type OceanSingerBottle, type OceanSingerCommand, type OceanSingerProjection, type OceanSingerState,
} from './types.js';

export function createOceanSingerState(): OceanSingerState {
  return {
    guidanceKnown: false,
    bottles: OCEAN_SINGER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, ritualVisit: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, windBlessedActingAtPromotion: null,
    cases: Object.fromEntries(OCEAN_SINGER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { allyPosition: 'NEAR', songOpen: false, allyAffected: false, songChecks: 0, lightningMarks: 0, tideObservedWeek: null, tideVerified: false },
    ritual: { requestedWeek: null, visitWeek: null, location: 'DOCK', crewPresent: false, beastPresent: false, waterFilm: false, visits: 0, consumptions: 0, history: [] },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'tyrant' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isWindBlessed = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.sailor.discovered && s.sailor.guidanceKnown && s.rager.guidanceKnown && s.navigator.guidanceKnown && s.windBlessed.guidanceKnown && s.windBlessed.promotionWeek !== null && (isWindBlessed(s) || promoted(s));
const potionPrice = (bottle: OceanSingerBottle) => OCEAN_SINGER_PRICES.potion - (bottle.labourSteps === 5 ? OCEAN_SINGER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: OceanSingerBottle) => Number(bottle.id.slice('ocean-singer-potion-'.length));
const windBlessedWeeks = (s: SliceState) => Math.max(0, (s.oceanSinger.promotionWeek ?? s.week) - (s.windBlessed.promotionWeek ?? s.week));
const supplyExhausted = (state: OceanSingerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${OCEAN_SINGER_GUIDE}的独立海洋歌者成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5海洋歌者魔药，原瓶ocean-singer-potion-${number}，非水手、暴怒之民、航海家或风眷者旧瓶改装。完整配方资料待核，仍须实际完成活海怪腹中仪式。`;

function commandBlock(s: SliceState, command: OceanSingerAcquisitionCommand): string | null {
  const m = s.oceanSinger, r = m.ritual;
  // Paid extraction and return must never be stranded by promotion, AP, health, cash or a failed bottle.
  if (command.type === 'EXIT_RITUAL') return r.location === 'BELLY' ? null : '你当前不在原海怪腹中。';
  if (command.type === 'RETURN_DOCK') return r.location === 'COAST' ? null : r.location === 'BELLY' ? '先请原船员0行动实际撤出腹中，再按已付原路返程。' : '你已在原码头，无须重复返回。';
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'REQUEST_RITUAL', 'GO_RITUAL'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(m.cases).some(value => value.contactOpen) || m.practice.songOpen || m.practice.allyAffected || m.practice.allyPosition !== 'NEAR' || windBlessedInside(s)) return '先实际结束原练习接触、停止歌唱、让米娅恢复并沿原路回位，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德原维修院，找到艾洛·芬奇。';
  if (!knownChannel(s)) return '成为风眷者并保有艾洛·芬奇的指导渠道后，才能继续了解海洋歌者之路。';
  if (promoted(s)) return '你已完成海洋歌者晋升，不能重复服用或继续准备这份魔药；仍须实际撤出并返回原码头。';
  if (r.location !== 'DOCK' && !['ENTER_RITUAL', 'CONSUME'].includes(command.type)) return '先实际撤出腹中并按已付原路返回码头；不能在近岸仪式现场做普通筹备。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (m.guidanceKnown) return '已经听过海洋歌者成品魔药的用药说明。';
    return s.cash < OCEAN_SINGER_PRICES.guidance ? '海洋歌者用药指导需要460便士。' : null;
  }
  if (!m.guidanceKnown) return '先听艾洛·芬奇说明这批序列5原瓶的来源与腹中仪式风险。';
  if (command.type === 'REQUEST_RITUAL') return r.requestedWeek !== null ? '已有仪式预约，最早下一真实周实际出发。' : null;
  if (command.type === 'GO_RITUAL') {
    if (r.requestedWeek === null) return '先在原导师处预约本次原船与原船员。';
    if (s.week <= r.requestedWeek) return '预约后至少等到下一真实周，才可实际乘船前往近岸。';
    return s.cash < OCEAN_SINGER_PRICES.ritualTravel ? '原船实际普通往返须预付180便士。' : null;
  }
  if (command.type === 'ENTER_RITUAL') {
    if (r.location !== 'COAST' || !r.crewPresent || !r.beastPresent) return '须实际到达近岸，原船员和原活海怪OS5-BEAST-1真实在场。';
    if (r.history.at(-1)?.consumedBottleId !== null) return '本次到访已服用过一原瓶，不能重复进入服药。';
    return s.cash < OCEAN_SINGER_PRICES.waterFilm ? '本次专业外置密封护身水膜服务需要另付120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') {
    if (m.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(m) ? null : '须先用完现有全部海洋歌者原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (m.resupply.requestedWeek === null) return '尚未申请下一批海洋歌者补给。';
    if (s.week <= m.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(m) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = m.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选海洋歌者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (r.location !== 'BELLY' || !r.waterFilm || !r.crewPresent || !r.beastPresent || !r.history.at(-1)?.entered) return '必须实际进入原活奥布尼斯海怪腹中，原船员和原兽在场，且已付费施加专业外置护身水膜。';
    if (r.history.at(-1)?.consumedBottleId !== null) return '本次到访已耗一原瓶，须先撤出并返程，下一真实周另约。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先撤出返程休养，以保持可恢复。';
    if (s.progression.acting < 100) return `风眷者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.windBlessed.promotionWeek === null || windBlessedWeeks(s) < OCEAN_SINGER_MIN_WIND_BLESSED_WEEKS) return `成为风眷者后已度过${windBlessedWeeks(s)}/${OCEAN_SINGER_MIN_WIND_BLESSED_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原维修院劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyOceanSingerCommand(s: SliceState, command: OceanSingerAcquisitionCommand, c: SeerContext): void {
  rule(validateOceanSingerCommand(command) && isOceanSingerAcquisitionCommand(command), '海洋歌者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'REQUEST_RITUAL':
      s.actionsRemaining -= 1; s.oceanSinger.ritual.requestedWeek = s.week;
      c.note('预约活海怪腹中仪式', `花1行动，你在原导师艾洛·芬奇处预约本次原船与受训船员，记录第${s.week}周请求，最早第${s.week + 1}周实际前往近岸。现在尚未移动，也未进入海怪腹中。${OCEAN_SINGER_RITUAL_SOURCE}`); return;
    case 'GO_RITUAL': {
      const r = s.oceanSinger.ritual;
      s.actionsRemaining -= 1; s.cash -= OCEAN_SINGER_PRICES.ritualTravel;
      r.history.push({ number: r.visits + 1, requestedWeek: r.requestedWeek!, visitWeek: s.week, entered: false, returned: false, consumedBottleId: null });
      r.requestedWeek = null; r.visitWeek = s.week; r.visits += 1; r.location = 'COAST';
      r.crewPresent = true; r.beastPresent = true; r.waterFilm = false;
      c.note('实际乘原船抵达近岸仪式水湾', '花1行动、180便士，你沿约定普通步道登上原船，实际航行抵达本次有限近岸水湾；普通往返已经预付。原受训船员与原活奥布尼斯海怪OS5-BEAST-1真实在场，你仍在原船上，尚未施加水膜或进入腹中。这是贝克兰德原码头的一次封闭本地近岸行程，世界城市记录保持不变；没有传送、海怪召唤或玩家操纵海怪。即使行动用尽，也能0行动沿已付原路返程。'); return;
    }
    case 'ENTER_RITUAL': {
      const r = s.oceanSinger.ritual;
      s.cash -= OCEAN_SINGER_PRICES.waterFilm;
      r.waterFilm = true; r.location = 'BELLY'; r.history.at(-1)!.entered = true;
      c.note('实际进入原活海怪腹中', '另付120便士、0行动，原专业船员实际施加本次密封护身水膜；原船主操作自己保管的原船和原装置，在既有有限安排中将你的原身体实际送入原活奥布尼斯海怪OS5-BEAST-1腹中。黏液对声音与灵性反弹，腐蚀危险真实存在，外置仪式设备只服务本次G场景，不是你获得的航海家空气泡或海怪统御。原船员留在外侧接应，你仍须独立确认选定原瓶；可随时0行动请求实际撤出。'); return;
    }
    case 'EXIT_RITUAL': {
      const r = s.oceanSinger.ritual;
      r.location = 'COAST'; r.waterFilm = false;
      c.note('原船员实际将你撤出腹中', '0行动，原船员沿本次原装置实际将你的原身体撤出原海怪腹中，回到同一近岸原船；本次护身水膜解除并结束。成功、失败或放弃都可撤出，120便士不退，原瓶与伤势不复原，灵性不补满。你尚未回到原码头，仍须按已付行程实际返程。'); return;
    }
    case 'RETURN_DOCK': {
      const r = s.oceanSinger.ritual;
      r.history.at(-1)!.returned = true; r.location = 'DOCK'; r.visitWeek = null;
      r.crewPresent = false; r.beastPresent = false; r.waterFilm = false;
      c.note('按已付原路实际返回原码头', '0行动，原船实际航回，你沿原步道回到贝克兰德原码头。往返费用已付，不另收取、不退款；原海怪留在原近岸，船员结束本次仪式接应。可以不服药就返回，已耗原瓶、伤势、精神、灵性与到访记录全部保留。本次行程终结；未晋升时须另行预约，至少下一真实周才能再次出发。'); return;
    }
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= OCEAN_SINGER_PRICES.guidance;
      s.oceanSinger.guidanceKnown = true;
      c.note('听取海洋歌者用药说明', `花费1行动、460便士，你向已认识的本作原创成年${OCEAN_SINGER_GUIDE}继续请教，他向你说明从独立海洋歌者成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险。这些不是原来的水手、暴怒之民、航海家或风眷者存药。${OCEAN_SINGER_FORMULA_STATUS}风眷者消化须达100，晋升风眷者后满12整周才能服用；可提前筹备。${OCEAN_SINGER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.oceanSinger.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = OCEAN_SINGER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在艾洛·芬奇的原维修院实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.oceanSinger.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('海洋歌者原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原维修院劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；风眷者消化100且晋升风眷者后满12整周时，再独立确认服药。${OCEAN_SINGER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.oceanSinger.resupply.requestedWeek = s.week;
      c.note('申请下一批海洋歌者魔药', `现有海洋歌者原瓶全部耗尽且未晋升。你花费1行动，请${OCEAN_SINGER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原维修院的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.oceanSinger.bottles.length + 1;
      s.oceanSinger.resupply.deliveries += 1;
      for (let offset = 0; offset < OCEAN_SINGER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.oceanSinger.bottles.push({ id: `ocean-singer-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, ritualVisit: null, status: 'SUPPLIER', outcome: null });
      }
      s.oceanSinger.resupply.requestedWeek = null;
      c.note('下一批海洋歌者原瓶到货', `第${s.week}周，艾洛·芬奇的独立海洋歌者成品交接渠道本作G成品供给第${s.oceanSinger.resupply.deliveries + 1}批三瓶实际到货，原瓶ocean-singer-potion-${firstNumber}至ocean-singer-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.oceanSinger.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      bottle.ritualVisit = s.oceanSinger.ritual.visits;
      s.oceanSinger.ritual.consumptions += 1;
      s.oceanSinger.ritual.history.at(-1)!.consumedBottleId = bottle.id;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.oceanSinger.windBlessedActingAtPromotion = s.progression.acting;
        s.oceanSinger.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of OCEAN_SINGER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为海洋歌者', `第${s.oceanSinger.ritual.visits}次真实到访，在原活奥布尼斯海怪OS5-BEAST-1腹中耗尽原瓶${bottle.id}。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。水手、暴怒之民、航海家与风眷者全部原能力、原ID掌握、原物和实际历史完整继承，只新增有限海洋歌声、浅层雷击、较长水下活动三项，从0掌握开始；风眷者消化成果保留，海洋歌者扮演从0开始。灵性上限100，当前灵性没有补满。不赠雷暴、海啸或海怪统御；专业水膜不是玩家能力。你仍在原海怪腹中，须0行动实际撤出，再0行动沿已付原路返程。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了海洋歌者晋升' : '海洋歌者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是风眷者，消化与全部原有掌握保留，没有获得海洋歌者能力。导师和原船员处理了这次服药排异，未发生死亡；你仍在原海怪腹中，可0行动实际撤出并按已付原路返程休养。本次到访不能再服一瓶，重试须使用另一原瓶并重新预约实际到访。`);
      }
      return;
    }
  }
}

export function projectOceanSinger(s: SliceState): OceanSingerProjection {
  const actions: OceanSingerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.cataclysmPriest.oceanSingerActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: OceanSingerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.oceanSinger.guidanceKnown) add('learn-ocean-singer-guidance', '请艾洛·芬奇说明海洋歌者成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.oceanSinger.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${OCEAN_SINGER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶海洋歌者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.oceanSinger.resupply.requestedWeek !== null) add('receive-ocean-singer-supply', '确认下一批三瓶海洋歌者到货', `0行动 · 第${s.oceanSinger.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.oceanSinger)) add('request-ocean-singer-supply', '向艾洛·芬奇订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.oceanSinger.guidanceKnown) {
    for (const bottle of s.oceanSinger.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶海洋歌者魔药`, `0行动 · 独立确认 · 风眷者消化${isPromoted ? s.oceanSinger.windBlessedActingAtPromotion : s.progression.acting}/100 · 晋升后${windBlessedWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const ritual = s.oceanSinger.ritual;
  if (available && ritual.location === 'BELLY') add('ocean-singer-exit-ritual', '请原船员实际撤出原海怪腹中', '0行动 · 原水膜结束 · 不退款或补资源', { type: 'EXIT_RITUAL' });
  if (available && ritual.location === 'COAST') {
    if (!isPromoted && ritual.history.at(-1)?.consumedBottleId === null) add('ocean-singer-enter-ritual', '付水膜服务并实际进入原活海怪腹中', '0行动 · 120便士 · 专业外置原设备', { type: 'ENTER_RITUAL' });
    add('ocean-singer-return-dock', '乘原船并沿原步道实际回码头', '0行动 · 已预付普通返程 · 可未服药离开', { type: 'RETURN_DOCK' });
  }
  if (available && s.oceanSinger.guidanceKnown && !isPromoted && ritual.location === 'DOCK') {
    if (ritual.requestedWeek === null) add('ocean-singer-request-ritual', '向原导师预约活海怪腹中仪式', '1行动 · 最早下一真实周出发', { type: 'REQUEST_RITUAL' });
    else add('ocean-singer-go-ritual', '实际乘原船前往预约的近岸水湾', `1行动 · 180便士普通往返 · 最早第${ritual.requestedWeek + 1}周`, { type: 'GO_RITUAL' });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.oceanSinger.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.oceanSinger.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '海洋歌者 · 序列5' : '海洋歌者之路', discovered: available,
    guidanceKnown: available && s.oceanSinger.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: null, ritual: projectOceanSingerRitual(s),
    cases: [], environment: '', insideCase: oceanSingerInside(s),
    ...(available ? { story: `${OCEAN_SINGER_SOURCE_STATUS}${OCEAN_SINGER_RITUAL_SOURCE}` } : {}),
    supplies: available ? `${OCEAN_SINGER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.oceanSinger.resupply.requestedWeek === null ? `已实际接收后续供给${s.oceanSinger.resupply.deliveries}批。` : `第${s.oceanSinger.resupply.requestedWeek}周提出请求，第${s.oceanSinger.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.oceanSinger.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 海洋歌者魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? OCEAN_SINGER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `风眷者消化成果${s.oceanSinger.windBlessedActingAtPromotion}/100已保留；海洋歌者扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成风眷者消化（${s.progression.acting}/100），并在晋升风眷者后度过12整周（${windBlessedWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完风眷者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 预约并等到下一真实周 → 实际乘原船赴近岸 → 另付水膜并进入原活海怪腹中 → 满足消化与成熟条件独立服药 → 实际撤出 → 已付原路返程。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${OCEAN_SINGER_CONSUMPTION_RISK}` : '成为风眷者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REQUEST_RITUAL', 'GO_RITUAL', 'ENTER_RITUAL', 'EXIT_RITUAL', 'RETURN_DOCK'];
export function isOceanSingerAcquisitionCommand(command: unknown): command is OceanSingerAcquisitionCommand {
  return validateOceanSingerCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateOceanSingerCommand(value: unknown): value is OceanSingerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'MOVE_ALLY', 'RETURN_ALLY', 'CLEAR_ALLY', 'REQUEST_RITUAL', 'GO_RITUAL', 'ENTER_RITUAL', 'EXIT_RITUAL', 'RETURN_DOCK', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^ocean-singer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^ocean-singer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && OCEAN_SINGER_CASE_IDS.includes(value.caseId as typeof OCEAN_SINGER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && OCEAN_SINGER_CASE_IDS.includes(value.caseId as typeof OCEAN_SINGER_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateOceanSingerState(s: SliceState): boolean {
  const raw: unknown = s.oceanSinger;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'windBlessedActingAtPromotion', 'cases', 'practice', 'ritual', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.sailor) || !record(s.rager) || !record(s.navigator) || !record(s.windBlessed)) return false;
  const firstWindBlessedWeek = s.windBlessed.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstWindBlessedWeek + OCEAN_SINGER_MIN_WIND_BLESSED_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== OCEAN_SINGER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, OCEAN_SINGER_CASE_IDS) || !Object.values(raw.cases).every(record)) return false;
  if (!record(raw.practice) || !shape(raw.practice, ['allyPosition', 'songOpen', 'allyAffected', 'songChecks', 'lightningMarks', 'tideObservedWeek', 'tideVerified']) || !record(raw.ritual)) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !validateOceanSingerLife(s)) return false;
  const oceanSinger = raw as unknown as OceanSingerState, isPromoted = promoted(s);
  if (oceanSinger.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!oceanSinger.guidanceKnown || !integer(s.windBlessed.promotionWeek, 1, s.week) || !integer(oceanSinger.promotionWeek, firstConsumptionWeek, s.week) || oceanSinger.windBlessedActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...SAILOR_ABILITY_IDS, ...RAGER_ABILITY_IDS, ...NAVIGATOR_ABILITY_IDS, ...WIND_BLESSED_ABILITY_IDS, ...OCEAN_SINGER_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?CATACLYSM_PRIEST_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?SEA_KING_ABILITY_IDS:[]),...(s.progression.sequence===2?CATASTROPHE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (oceanSinger.promotionWeek !== null || oceanSinger.windBlessedActingAtPromotion !== null || OCEAN_SINGER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (oceanSinger.practice.allyPosition !== 'NEAR' || oceanSinger.practice.songOpen || oceanSinger.practice.allyAffected || oceanSinger.practice.songChecks !== 0 || oceanSinger.practice.lightningMarks !== 0 || oceanSinger.practice.tideObservedWeek !== null || oceanSinger.practice.tideVerified) return false;
    if (oceanSinger.reflected || Object.values(oceanSinger.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of oceanSinger.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'ritualVisit', 'status', 'outcome'])) return false;
    if (bottle.id !== `ocean-singer-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of oceanSinger.bottles.entries()) {
    let stockWeek = firstWindBlessedWeek;
    if (index < OCEAN_SINGER_BOTTLE_IDS.length) {
      if (bottle.source !== OCEAN_SINGER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!oceanSinger.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / OCEAN_SINGER_BOTTLE_IDS.length) - 1;
      if (index % OCEAN_SINGER_BOTTLE_IDS.length === 0) {
        const previous = oceanSinger.bottles.slice(index - OCEAN_SINGER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > oceanSinger.promotionWeek!) return false;
    }
    if (!oceanSinger.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.ritualVisit !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > oceanSinger.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.ritualVisit !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.ritualVisit, 1) || !integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > oceanSinger.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== oceanSinger.promotionWeek) return false;
    }
  }
  if (oceanSinger.resupply.requestedWeek !== null && (!oceanSinger.guidanceKnown || isPromoted || !supplyExhausted(oceanSinger) || oceanSinger.bottles.some(bottle => bottle.consumedWeek! > oceanSinger.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = oceanSinger.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, oceanSinger.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'OCEAN_SINGER_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(oceanSinger.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && oceanSingerInside(s)) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'ocean-singer-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateOceanSingerRitual(s) && validateOceanSingerEncounter(s);
}

export { OCEAN_SINGER_ABILITIES } from './content.js';
export type * from './types.js';

export function projectOceanSingerRitual(s: SliceState): OceanSingerProjection['ritual'] {
  const r = s.oceanSinger.ritual;
  return {
    location: r.location, waterFilm: r.waterFilm, visits: r.visits, consumptions: r.consumptions,
    source: knownChannel(s) ? OCEAN_SINGER_RITUAL_SOURCE : '',
    status: r.location === 'BELLY' ? '原身体实际在原活海怪腹中，专业外置水膜有效'
      : r.location === 'COAST' ? '已实际抵达原近岸水湾，当前在原船上'
        : r.requestedWeek !== null ? `第${r.requestedWeek}周已预约，最早第${r.requestedWeek + 1}周实际出发` : '当前在原码头，尚未预约下一次腹中仪式',
    summary: r.location !== 'DOCK' ? `本次为第${r.visits}次真实到访；原受训船员${r.crewPresent ? '在场' : '不在场'}，原活奥布尼斯海怪OS5-BEAST-1${r.beastPresent ? '在场' : '不在场'}。${r.history.at(-1)?.consumedBottleId ? `本次已耗原瓶${r.history.at(-1)!.consumedBottleId}，不能再服一瓶。` : '本次尚未服药，可以放弃后按原路返回。'}${r.location === 'BELLY' ? '先0行动请原船员实际撤出，水膜随之结束；' : ''}再0行动乘原船并沿原步道按已付行程返码头。没有退款、隐式返程或补资源。`
      : '180便士预付真实普通乘船往返；进入原活海怪腹中另付120便士专业外置水膜。每次最多服一原瓶，下一次须重新预约并至少等下一真实周。',
  };
}

/** A consumed original must have exactly one actual visit, entered belly and prior-week request. */
export function validateOceanSingerRitual(s: SliceState): boolean {
  const m = s.oceanSinger, r = m.ritual;
  if (!record(r) || !shape(r, ['requestedWeek', 'visitWeek', 'location', 'crewPresent', 'beastPresent', 'waterFilm', 'visits', 'consumptions', 'history'])) return false;
  if (!['DOCK', 'COAST', 'BELLY'].includes(r.location) || ![r.crewPresent, r.beastPresent, r.waterFilm].every(v => typeof v === 'boolean') || !integer(r.visits, 0) || !integer(r.consumptions, 0, r.visits) || !Array.isArray(r.history) || r.history.length !== r.visits) return false;
  const earliest = s.windBlessed.promotionWeek ?? s.week;
  if (r.requestedWeek !== null && !integer(r.requestedWeek, earliest, s.week)) return false;
  if (r.visitWeek !== null && !integer(r.visitWeek, earliest + 1, s.week)) return false;
  if (!m.guidanceKnown && (r.requestedWeek !== null || r.visits !== 0)) return false;
  let lastVisitWeek = 0, consumed = 0;
  const consumedIds = new Set<string>();
  for (const [i, h] of r.history.entries()) {
    if (!record(h) || !shape(h, ['number', 'requestedWeek', 'visitWeek', 'entered', 'returned', 'consumedBottleId']) || h.number !== i + 1 || !integer(h.requestedWeek, Math.max(earliest, lastVisitWeek), s.week) || !integer(h.visitWeek, h.requestedWeek + 1, s.week) || typeof h.entered !== 'boolean' || typeof h.returned !== 'boolean') return false;
    if (promoted(s) && h.visitWeek > m.promotionWeek!) return false;
    if (!h.returned && (i !== r.history.length - 1 || r.location === 'DOCK')) return false;
    lastVisitWeek = h.visitWeek;
    if (h.consumedBottleId !== null) {
      if (typeof h.consumedBottleId !== 'string' || !h.entered || consumedIds.has(h.consumedBottleId)) return false;
      const bottle = m.bottles.find(b => b.id === h.consumedBottleId);
      if (!bottle || bottle.status !== 'CONSUMED' || bottle.ritualVisit !== h.number || bottle.consumedWeek !== h.visitWeek) return false;
      consumedIds.add(h.consumedBottleId); consumed += 1;
    }
  }
  if (r.consumptions !== consumed || consumed !== m.bottles.filter(b => b.status === 'CONSUMED').length) return false;
  if (r.requestedWeek !== null && (r.location !== 'DOCK' || promoted(s) || r.requestedWeek < lastVisitWeek)) return false;
  if (r.location === 'DOCK') return r.visitWeek === null && !r.crewPresent && !r.beastPresent && !r.waterFilm && r.history.every(h => h.returned);
  if (r.waterFilm !== (r.location === 'BELLY')) return false;
  return r.visits > 0 && r.requestedWeek === null && r.visitWeek === s.week && s.world.city === 'BACKLUND' && s.activeEvent === null && s.combat === null && r.crewPresent && r.beastPresent && r.history.at(-1)?.returned === false && r.history.at(-1)?.visitWeek === r.visitWeek && (r.location !== 'BELLY' || r.history.at(-1)?.entered === true) && !Object.values(m.cases).some(c => c.contactOpen) && !m.practice.songOpen && !m.practice.allyAffected && m.practice.allyPosition === 'NEAR' && !windBlessedInside(s);
}
