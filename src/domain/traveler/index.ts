import {PLANESWALKER_ABILITY_IDS} from '../planeswalker/types.js';
import {WANDERER_ABILITY_IDS} from '../wanderer/types.js';
import {SECRETS_SORCERER_ABILITY_IDS} from '../secrets-sorcerer/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APPRENTICE_ABILITY_IDS } from '../apprentice/types.js';
import { TRICKMASTER_ABILITY_IDS } from '../trickmaster/types.js';
import { ASTROLOGER_ABILITY_IDS } from '../astrologer/types.js';
import { RECORDER_ABILITY_IDS } from '../recorder/types.js';
import { recorderInside } from '../recorder/life.js';
import { validateTravelerLife } from './life.js';
import { validateTravelerEncounter } from './encounter.js';
import {
  TRAVELER_ABILITIES, TRAVELER_BOTTLE_IDS, TRAVELER_CONSUMPTION_RISK, TRAVELER_FORMULA_STATUS,
  TRAVELER_GUIDE, TRAVELER_LABOUR_TASKS, TRAVELER_MIN_RECORDER_WEEKS, TRAVELER_POTION_SOURCES, TRAVELER_PRICES, TRAVELER_SOURCE_STATUS,
  TRAVELER_ESCORT, TRAVELER_ESCORT_MAX_SPIRITUALITY, TRAVELER_RITUAL_FEE, TRAVELER_RITUAL_SITES, TRAVELER_RITUAL_STATUS,
} from './content.js';
import {
  TRAVELER_ABILITY_IDS, TRAVELER_CASE_IDS, TRAVELER_RITUAL_SITE_IDS, type TravelerAcquisitionCommand, type TravelerAction,
  type TravelerBottle, type TravelerCommand, type TravelerProjection, type TravelerState, type TravelerRitual, type TravelerRitualProjection,
} from './types.js';

export function createTravelerState(): TravelerState {
  return {
    guidanceKnown: false,
    bottles: TRAVELER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, recorderActingAtPromotion: null,
    ritual: {
      coordinates: { BRONZE_STEPS: { placedWeek: null }, INVERTED_REEF: { placedWeek: null }, ASH_GARDEN: { placedWeek: null }, ECHO_WELL: { placedWeek: null } },
      at: 'HOME', escortSpirituality: TRAVELER_ESCORT_MAX_SPIRITUALITY, escortRestWeek: null,
      journeys: 0, returns: 0, feePaid: 0, drifts: 0,
    },
    cases: Object.fromEntries(TRAVELER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { position: 'ENTRY', card: 'DESK', companionPosition: 'ENTRY', consent: false, journeys: 0, returns: 0, cardTakes: 0, cardReturns: 0, companionTrips: 0 },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'door' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isRecorder = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.apprentice.discovered && s.apprentice.guidanceKnown && s.trickmaster.formulaKnown && s.astrologer.guidanceKnown && s.recorder.guidanceKnown && s.recorder.promotionWeek !== null && (isRecorder(s) || promoted(s));
const potionPrice = (bottle: TravelerBottle) => TRAVELER_PRICES.potion - (bottle.labourSteps === 5 ? TRAVELER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: TravelerBottle) => Number(bottle.id.slice('traveler-potion-'.length));
const recorderWeeks = (s: SliceState) => Math.max(0, (s.traveler.promotionWeek ?? s.week) - (s.recorder.promotionWeek ?? s.week));
const supplyExhausted = (state: TravelerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${TRAVELER_GUIDE}的独立旅行家成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5旅行家魔药，原瓶traveler-potion-${number}，非学徒、戏法大师、占星人或记录官旧瓶改装。完整配方待核，服药须使用本人已实际放置的四处灵界坐标。`;
export const travelerRitualInside = (s: SliceState): boolean => s.traveler.ritual.at !== 'HOME';
const practiceInside = (s: SliceState): boolean => Object.values(s.traveler.cases).some(value => value.contactOpen) || s.traveler.practice.position !== 'ENTRY' || s.traveler.practice.card !== 'DESK' || s.traveler.practice.companionPosition !== 'ENTRY' || s.traveler.practice.consent;
const placedCount = (r: TravelerRitual): number => TRAVELER_RITUAL_SITE_IDS.filter(id => r.coordinates[id].placedWeek !== null).length;
const restedEscortSpirituality = (s: SliceState): number => Math.min(TRAVELER_ESCORT_MAX_SPIRITUALITY, s.traveler.ritual.escortSpirituality + (s.traveler.ritual.escortRestWeek === null ? 0 : Math.max(0, s.week - s.traveler.ritual.escortRestWeek) * 2));

function commandBlock(s: SliceState, command: TravelerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'RITUAL_DEPART'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (command.type === 'RITUAL_RETURN') return travelerRitualInside(s) && s.traveler.ritual.escortSpirituality >= 3 ? null : '你没有正在进行的仪式出访，不能凭空返程。';
  if (command.type === 'PLACE_COORDINATE') {
    const at = s.traveler.ritual.at;
    if (at === 'HOME') return '先随护送人实际抵达所选灵界深处区域，再由本人放置坐标。';
    if (s.traveler.ritual.coordinates[at].placedWeek !== null) return '此处已经留下你本人的唯一坐标，不能重复或复制。';
    return s.spirituality >= 2 ? null : '本人放置坐标需要2灵性；仍可0行动实际返程。';
  }
  if (travelerRitualInside(s)) return '你的实际身体仍在灵界仪式地点，先0行动明确返程，不能办理原教学室事项或再次出发。';
  if (practiceInside(s) || recorderInside(s) || Object.values(s.apprentice.cases).some(value => value.position === 'INSIDE')) return '先实际结束原实践的接触并返回，再继续旅行家准备。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原教学室，找到诺拉·维恩。';
  if (!knownChannel(s)) return '成为记录官并保有诺拉·维恩的指导渠道后，才能继续了解旅行家之路。';
  if (promoted(s)) return '你已完成旅行家晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.traveler.guidanceKnown) return '已经听过旅行家成品魔药的用药说明。';
    return s.cash < TRAVELER_PRICES.guidance ? '旅行家用药指导需要460便士。' : null;
  }
  if (!s.traveler.guidanceKnown) return '先听诺拉·维恩说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'RITUAL_DEPART') {
    if (s.traveler.ritual.coordinates[command.site].placedWeek !== null) return '所选地点已有本人的唯一坐标，无须也不能重复出访放置。';
    if (s.spirituality < 2) return '出发前须保有2灵性，留给抵达后本人放置坐标。';
    if (s.cash < TRAVELER_RITUAL_FEE) return '本次有限仪式护送需要80便士。';
    return restedEscortSpirituality(s) >= 6 ? null : `护送人实际灵性不足一次去回的6点；当前${s.traveler.ritual.escortSpirituality}/24，须真实休息后再亲访，每周恢复2点。`;
  }
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.traveler.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.traveler) ? null : '须先用完现有全部旅行家原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.traveler.resupply.requestedWeek === null) return '尚未申请下一批旅行家补给。';
    if (s.week <= s.traveler.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.traveler) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.traveler.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选旅行家原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (placedCount(s.traveler.ritual) !== 4 || s.traveler.ritual.returns < 4) return `须本人在四处不同且相距极远的灵界深处各留唯一坐标并实际返程；现已放置${placedCount(s.traveler.ritual)}/4处、完成${s.traveler.ritual.returns}趟实际返程。`;
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `记录官魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.recorder.promotionWeek === null || recorderWeeks(s) < TRAVELER_MIN_RECORDER_WEEKS) return `成为记录官后已度过${recorderWeeks(s)}/${TRAVELER_MIN_RECORDER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原教学室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyTravelerCommand(s: SliceState, command: TravelerAcquisitionCommand, c: SeerContext): void {
  rule(validateTravelerCommand(command) && isTravelerAcquisitionCommand(command), '旅行家准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'RITUAL_DEPART': {
      const r = s.traveler.ritual;
      const previous = r.escortSpirituality;
      r.escortSpirituality = restedEscortSpirituality(s);
      const restored = r.escortSpirituality - previous;
      r.escortRestWeek = s.week;
      r.escortSpirituality -= 3;
      s.actionsRemaining -= 1;
      s.cash -= TRAVELER_RITUAL_FEE;
      r.feePaid += TRAVELER_RITUAL_FEE;
      r.at = command.site;
      r.journeys += 1;
      c.note('实际抵达灵界深处仪式地点', `本次你在原教学室与原创成年序列5旅行家${TRAVELER_ESCORT}当面确认有限护送，花费1行动与80便士。他此前实际休息恢复${restored}灵性，亲自耗3灵性经由已核实路径带你的实际身体抵达${TRAVELER_RITUAL_SITES[command.site].label}，当前余${r.escortSpirituality}/24，至少3点专供本趟返程。${TRAVELER_RITUAL_SITES[command.site].description}这是原有限G行程，不是你提前获得旅行能力；你尚未留下坐标。出发时保有的2灵性只供本人随后放置，仍可直接返回，不退费用。诺拉·维恩仍是序列8并留在原教学室，没有冒充护送人。`);
      return;
    }
    case 'PLACE_COORDINATE': {
      const r = s.traveler.ritual;
      rule(r.at !== 'HOME', '尚未实际抵达仪式地点。');
      s.spirituality -= 2;
      r.coordinates[r.at].placedWeek = s.week;
      c.note('本人留下唯一灵界坐标', `你的实际身体仍在${TRAVELER_RITUAL_SITES[r.at].label}，亲自付出2灵性、0行动留下属于自己的唯一特殊坐标；不是护送人代放，也不是远程勾选。现完成${placedCount(r)}/4处。护送人${TRAVELER_ESCORT}仍在身旁，身体没有自动返回；须明确0行动返程，他将实际支付预留的另3灵性。`);
      return;
    }
    case 'RITUAL_RETURN': {
      const r = s.traveler.ritual;
      rule(r.at !== 'HOME', '没有等待返程的实际出访。');
      const site = r.at;
      const placed = r.coordinates[site].placedWeek !== null;
      r.escortSpirituality -= 3;
      r.at = 'HOME';
      r.returns += 1;
      c.note('护送人带原身体实际返程', `从${TRAVELER_RITUAL_SITES[site].label}出发，${TRAVELER_ESCORT}实际耗掉预留的3灵性，将你与他自己的原身体沿已核实的灵界路径带回贝克兰德原教学室。返程0行动，玩家0运输灵性，护送人当前${r.escortSpirituality}/24；原费用与去回成本不退。${placed ? '刚才本人留下的同一坐标保留在原处，没有取回或复制。' : '本次没有放置坐标，仍须以后重新付费实际出访；护送人仅按真实休息周数恢复有限灵性。'}现完成${r.returns}趟实际返程。`);
      return;
    }
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= TRAVELER_PRICES.guidance;
      s.traveler.guidanceKnown = true;
      c.note('听取旅行家用药说明', `花费1行动、460便士，你向已认识的本作原创成年序列8导师${TRAVELER_GUIDE}继续请教，导师说明独立渠道实际取得的三瓶序列5原瓶、逐瓶交付与四档风险，并介绍另一位原创成年序列5旅行家${TRAVELER_ESCORT}的有限仪式护送。${TRAVELER_FORMULA_STATUS}记录官消化须达100，晋升记录官后满12整周才能服用；可提前筹备。${TRAVELER_RITUAL_STATUS}${TRAVELER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.traveler.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = TRAVELER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在诺拉·维恩的原教学室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.traveler.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('旅行家原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原教学室劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；记录官消化100且晋升记录官后满12整周时，再独立确认服药。${TRAVELER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.traveler.resupply.requestedWeek = s.week;
      c.note('申请下一批旅行家魔药', `现有旅行家原瓶全部耗尽且未晋升。你花费1行动，请${TRAVELER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原教学室的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.traveler.bottles.length + 1;
      s.traveler.resupply.deliveries += 1;
      for (let offset = 0; offset < TRAVELER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.traveler.bottles.push({ id: `traveler-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.traveler.resupply.requestedWeek = null;
      c.note('下一批旅行家原瓶到货', `第${s.week}周，诺拉·维恩的独立旅行家成品交接渠道本作G成品供给第${s.traveler.resupply.deliveries + 1}批三瓶实际到货，原瓶traveler-potion-${firstNumber}至traveler-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.traveler.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师核对四处原坐标与本次原瓶', `原成年序列8导师${TRAVELER_GUIDE}在原教学室实际核对你手中的原瓶${bottle.id}，以及本人已在四个完全不同、相距极远的灵界深处放置且四趟实际返回的原坐标。导师安排本次G照护；不是只在普通房间饮用而省略真实晋升旅程，也不冒称掌握完整配方。`);
      s.traveler.ritual.drifts += 1;
      c.note('服药后实际经历无法控制的灵界漂流', `你饮下原瓶${bottle.id}后，实际身体离开原教学室，进入无法自主控制的灵界漂流。四处属于你自己的原坐标共同帮助辨明位置、维持自我并找到返向；这不是付一次运输费就获得的通用安全保证。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      c.note('原坐标帮助实际返回并接受照护', `本次漂流实际结束，你借四处原坐标的定位与自我锚定帮助，原身体返回出发的原教学室，诺拉·维恩实际接续在场照护。四个原坐标仍在各自灵界地点，当前本人在HOME；结果为${result.tier}，接下来按该档结算真实代价。失败或灾难也经历了漂流与返回，不销毁坐标或返还原瓶。`);
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.traveler.recorderActingAtPromotion = s.progression.acting;
        s.traveler.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of TRAVELER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为旅行家', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。学徒、戏法大师、占星人与记录官全部原ID及掌握完整继承，只新增灵界旅行与定位、无形之手两项0掌握；记录官消化成果与原晋升周保留，旅行家扮演从0开始。灵性上限100，当前灵性没有补满。半神记录容量提高至4但没有赠送记录；低序列20、中序列8暂保留已有实现，不假称已核实新的上限。原记录、示范、教师灵性与旧案件完整保留。旅行可能失败或受阻；没有通用无限距离或人数保证，没有空间隐藏、空间口袋或放逐。新原图卡仍在导师桌上，米拉仍在原入口且尚未同意同行。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了旅行家晋升' : '旅行家魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是记录官，消化与全部原有掌握保留，没有获得旅行家能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectTravelerRitual(s: SliceState): TravelerRitualProjection | null {
  if (!knownChannel(s) || !s.traveler.guidanceKnown) return null;
  const r = s.traveler.ritual;
  return {
    at: r.at === 'HOME' ? 'HOME · 贝克兰德原教学室' : `${r.at} · 灵界深处${TRAVELER_RITUAL_SITES[r.at].label}`,
    coordinates: TRAVELER_RITUAL_SITE_IDS.map(id => ({ id, label: TRAVELER_RITUAL_SITES[id].label, status: r.coordinates[id].placedWeek === null ? `尚未由本人放置。${TRAVELER_RITUAL_SITES[id].description}` : `第${r.coordinates[id].placedWeek}周本人实际留下唯一坐标，原坐标持续保留。${TRAVELER_RITUAL_SITES[id].description}` })),
    escortSpirituality: r.escortSpirituality,
    history: [TRAVELER_RITUAL_STATUS, `实际出访${r.journeys}次、返程${r.returns}次，护送已实付${r.feePaid}便士；本人放置${placedCount(r)}/4处唯一坐标。`, `原成年序列5护送人${TRAVELER_ESCORT}当前实际灵性${r.escortSpirituality}/24；${r.escortRestWeek === null ? '尚未首次实际出访。' : `上次实际出访在第${r.escortRestWeek}周。`}`, `服药后已实际经历${r.drifts}次无法控制的灵界漂流，并借原坐标帮助返回；诺拉仍为序列8，在原教学室照护。`],
  };
}

export function projectTraveler(s: SliceState): TravelerProjection {
  const actions: TravelerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.secretsSorcerer.travelerActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: TravelerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.traveler.guidanceKnown) add('learn-traveler-guidance', '请诺拉·维恩说明旅行家成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      if (travelerRitualInside(s)) {
        const site = s.traveler.ritual.at;
        if (site !== 'HOME' && s.traveler.ritual.coordinates[site].placedWeek === null) add('place-traveler-coordinate', `本人在${TRAVELER_RITUAL_SITES[site].label}留下唯一坐标`, '0行动 · 本人2灵性 · 不自动返回', { type: 'PLACE_COORDINATE' });
        add('return-traveler-ritual', '请艾文·盖尔带原身体实际返回教学室', '0行动 · 护送人另耗预留3灵性 · 不退费用', { type: 'RITUAL_RETURN' });
      } else {
        for (const site of TRAVELER_RITUAL_SITE_IDS) if (s.traveler.ritual.coordinates[site].placedWeek === null) add(`depart-traveler-${site}`, `随艾文·盖尔实际前往${TRAVELER_RITUAL_SITES[site].label}`, '1行动 · 80便士 · 护送人去程3灵性、另留返程3 · 本人须保有2灵性', { type: 'RITUAL_DEPART', site });
      }
      for (const bottle of s.traveler.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${TRAVELER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶旅行家魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.traveler.resupply.requestedWeek !== null) add('receive-traveler-supply', '确认下一批三瓶旅行家到货', `0行动 · 第${s.traveler.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.traveler)) add('request-traveler-supply', '向诺拉·维恩订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.traveler.guidanceKnown) {
    for (const bottle of s.traveler.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶旅行家魔药`, `0行动 · 独立确认 · 记录官消化${isPromoted ? s.traveler.recorderActingAtPromotion : s.progression.acting}/100 · 晋升后${recorderWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.traveler.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.traveler.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '旅行家 · 序列5' : '旅行家之路', discovered: available,
    guidanceKnown: available && s.traveler.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    ritual: projectTravelerRitual(s), practice: null,
    cases: [], environment: '', insideCase: travelerRitualInside(s) || practiceInside(s),
    ...(available ? { story: TRAVELER_SOURCE_STATUS } : {}),
    supplies: available ? `${TRAVELER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.traveler.resupply.requestedWeek === null ? `已实际接收后续供给${s.traveler.resupply.deliveries}批。` : `第${s.traveler.resupply.requestedWeek}周提出请求，第${s.traveler.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.traveler.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 旅行家魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? TRAVELER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `记录官消化成果${s.traveler.recorderActingAtPromotion}/100已保留；旅行家扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成记录官消化（${s.progression.acting}/100），并在晋升记录官后度过12整周（${recorderWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完记录官之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 四次明确出发、本人放置唯一坐标并实际返程 → 满足消化与成熟条件 → 独立确认选定原瓶，实际经历灵界漂流及返回。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${TRAVELER_CONSUMPTION_RISK}` : '成为记录官后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'RITUAL_DEPART', 'PLACE_COORDINATE', 'RITUAL_RETURN'];
export function isTravelerAcquisitionCommand(command: unknown): command is TravelerAcquisitionCommand {
  return validateTravelerCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateTravelerCommand(value: unknown): value is TravelerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'PLACE_COORDINATE', 'RITUAL_RETURN', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (value.type === 'RITUAL_DEPART') return shape(value, ['type', 'site']) && TRAVELER_RITUAL_SITE_IDS.includes(value.site as typeof TRAVELER_RITUAL_SITE_IDS[number]);
  if (value.type === 'RECORD_SAMPLE') return shape(value, ['type', 'sample']) && ['FLASH', 'COURAGE'].includes(value.sample as string);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^traveler-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^traveler-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && TRAVELER_CASE_IDS.includes(value.caseId as typeof TRAVELER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && TRAVELER_CASE_IDS.includes(value.caseId as typeof TRAVELER_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Four distinct original anchors and the escort's finite, paid physical journeys. */
function validateTravelerRitual(s: SliceState): boolean {
  const raw: unknown = s.traveler.ritual;
  if (!record(raw) || !shape(raw, ['coordinates', 'at', 'escortSpirituality', 'escortRestWeek', 'journeys', 'returns', 'feePaid', 'drifts'])) return false;
  if (!record(raw.coordinates) || !shape(raw.coordinates, TRAVELER_RITUAL_SITE_IDS) || !['HOME', ...TRAVELER_RITUAL_SITE_IDS].includes(raw.at as string)) return false;
  for (const value of Object.values(raw.coordinates)) if (!record(value) || !shape(value, ['placedWeek']) || value.placedWeek !== null && !integer(value.placedWeek, s.recorder.promotionWeek ?? s.week, s.week)) return false;
  for (const key of ['journeys', 'returns', 'feePaid', 'drifts'] as const) if (!integer(raw[key], 0)) return false;
  if (!integer(raw.escortSpirituality, 0, TRAVELER_ESCORT_MAX_SPIRITUALITY)) return false;
  const r = raw as unknown as TravelerRitual, away = r.at !== 'HOME';
  if (r.journeys - r.returns !== (away ? 1 : 0) || r.feePaid !== r.journeys * TRAVELER_RITUAL_FEE) return false;
  if (placedCount(r) > r.journeys || placedCount(r) > r.returns + (away && r.at !== 'HOME' && r.coordinates[r.at].placedWeek !== null ? 1 : 0)) return false;
  if (r.journeys === 0) {
    if (r.escortRestWeek !== null || r.escortSpirituality !== TRAVELER_ESCORT_MAX_SPIRITUALITY || r.drifts !== 0) return false;
  } else {
    if (!s.traveler.guidanceKnown || !integer(r.escortRestWeek, s.recorder.promotionWeek ?? s.week, s.week)) return false;
    const spent = 3 * (r.journeys + r.returns), recovered = r.escortSpirituality + spent - TRAVELER_ESCORT_MAX_SPIRITUALITY;
    if (!integer(recovered, 0) || recovered % 2 !== 0 || recovered > 2 * (r.escortRestWeek! - (s.recorder.promotionWeek ?? s.week))) return false;
    if (Object.values(r.coordinates).some(value => value.placedWeek !== null && value.placedWeek > r.escortRestWeek!)) return false;
  }
  if (away && (s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || promoted(s) || r.escortSpirituality < 3 || r.escortSpirituality > 21 || r.escortRestWeek !== s.week || r.at !== 'HOME' && r.coordinates[r.at].placedWeek !== null && r.coordinates[r.at].placedWeek !== s.week)) return false;
  if (r.drifts > 0 && (away || placedCount(r) !== 4 || r.returns < 4)) return false;
  if (!s.traveler.guidanceKnown && (r.journeys !== 0 || r.drifts !== 0)) return false;
  return true;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateTravelerState(s: SliceState): boolean {
  const raw: unknown = s.traveler;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'recorderActingAtPromotion', 'ritual', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.apprentice) || !record(s.trickmaster) || !record(s.astrologer) || !record(s.recorder)) return false;
  const firstRecorderWeek = s.recorder.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstRecorderWeek + TRAVELER_MIN_RECORDER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== TRAVELER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, TRAVELER_CASE_IDS) || !record(raw.practice) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateTravelerRitual(s) || !validateTravelerLife(s)) return false;
  const traveler = raw as unknown as TravelerState, isPromoted = promoted(s);
  if (traveler.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!traveler.guidanceKnown || !integer(s.recorder.promotionWeek, 1, s.week) || !integer(traveler.promotionWeek, firstConsumptionWeek, s.week) || traveler.recorderActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...APPRENTICE_ABILITY_IDS, ...TRICKMASTER_ABILITY_IDS, ...ASTROLOGER_ABILITY_IDS, ...RECORDER_ABILITY_IDS, ...TRAVELER_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?SECRETS_SORCERER_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?WANDERER_ABILITY_IDS:[]),...(s.progression.sequence===2?PLANESWALKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (traveler.promotionWeek !== null || traveler.recorderActingAtPromotion !== null || TRAVELER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (traveler.practice.position !== 'ENTRY' || traveler.practice.card !== 'DESK' || traveler.practice.companionPosition !== 'ENTRY' || traveler.practice.consent || traveler.practice.journeys !== 0 || traveler.practice.returns !== 0 || traveler.practice.cardTakes !== 0 || traveler.practice.cardReturns !== 0 || traveler.practice.companionTrips !== 0) return false;
    if (traveler.reflected || Object.values(traveler.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of traveler.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `traveler-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of traveler.bottles.entries()) {
    let stockWeek = firstRecorderWeek;
    if (index < TRAVELER_BOTTLE_IDS.length) {
      if (bottle.source !== TRAVELER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!traveler.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / TRAVELER_BOTTLE_IDS.length) - 1;
      if (index % TRAVELER_BOTTLE_IDS.length === 0) {
        const previous = traveler.bottles.slice(index - TRAVELER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > traveler.promotionWeek!) return false;
    }
    if (!traveler.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > traveler.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > traveler.promotionWeek! : s.progression.acting !== 100) return false;
      if (Object.values(traveler.ritual.coordinates).some(value => value.placedWeek === null || value.placedWeek > bottle.consumedWeek!)) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== traveler.promotionWeek) return false;
    }
  }
  if (traveler.ritual.drifts !== traveler.bottles.filter(bottle => bottle.status === 'CONSUMED').length) return false;
  if (traveler.resupply.requestedWeek !== null && (!traveler.guidanceKnown || isPromoted || !supplyExhausted(traveler) || traveler.bottles.some(bottle => bottle.consumedWeek! > traveler.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = traveler.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, traveler.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'TRAVELER_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(traveler.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || Object.values(traveler.cases).some(r => r.contactOpen || r.status === 'PREPARED') || practiceInside(s) || travelerRitualInside(s))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'traveler-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateTravelerEncounter(s);
}

export { TRAVELER_ABILITIES } from './content.js';
export type * from './types.js';
