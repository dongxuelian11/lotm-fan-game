import { FATE_PROPHET_ABILITY_IDS } from '../fate-prophet/types.js';
import {CHAOS_WALKER_ABILITY_IDS} from '../chaos-walker/types.js';
import {MISFORTUNE_MAGE_ABILITY_IDS} from '../misfortune-mage/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { MONSTER_ABILITY_IDS } from '../monster/types.js';
import { MACHINE_ABILITY_IDS } from '../machine/types.js';
import { LUCKY_ABILITY_IDS } from '../lucky/types.js';
import { CALAMITY_PRIEST_ABILITY_IDS } from '../calamity-priest/types.js';
import { winnerInside, validateWinnerLife } from './life.js';
import { validateWinnerEncounter } from './encounter.js';
import {
  WINNER_ABILITIES, WINNER_BOTTLE_IDS, WINNER_CONSUMPTION_RISK, WINNER_FORMULA_STATUS,
  WINNER_GUIDE, WINNER_LABOUR_TASKS, WINNER_MIN_CALAMITY_PRIEST_WEEKS, WINNER_POTION_SOURCES, WINNER_PRICES, WINNER_SOURCE_STATUS,
} from './content.js';
import {
  WINNER_ABILITY_IDS, WINNER_CASE_IDS, type WinnerAcquisitionCommand, type WinnerAction,
  type WinnerBottle, type WinnerCommand, type WinnerPractice, type WinnerProjection, type WinnerState,
} from './types.js';

export function freshWinnerPractice(): WinnerPractice {
  return { counter: 'GUIDE', ring: 'OWNER', note: 'BLANK' };
}

export function createWinnerState(): WinnerState {
  return {
    guidanceKnown: false,
    bottles: WINNER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, calamityPriestActingAtPromotion: null,
    cases: Object.fromEntries(WINNER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: freshWinnerPractice(),
    luck: { stored: 0, lastAccumulateWeek: null, accumulated: 0, spent: 0 },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, lastLuckRound: null, staggerReady: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'wheel' && (s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isCalamityPriest = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.monster.discovered && s.monster.guidanceKnown && s.machine.guidanceKnown && s.lucky.guidanceKnown && s.calamityPriest.guidanceKnown && s.calamityPriest.promotionWeek !== null && (isCalamityPriest(s) || promoted(s));
const potionPrice = (bottle: WinnerBottle) => WINNER_PRICES.potion - (bottle.labourSteps === 5 ? WINNER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: WinnerBottle) => Number(bottle.id.slice('winner-potion-'.length));
const calamityPriestWeeks = (s: SliceState) => Math.max(0, (s.winner.promotionWeek ?? s.week) - (s.calamityPriest.promotionWeek ?? s.week));
const inheritedContactOpen = (s: SliceState) => [s.monster.cases, s.machine.cases, s.lucky.cases, s.calamityPriest.cases].some(cases => Object.values(cases).some(value => value.contactOpen))
  || s.calamityPriest.practice.board === 'UNSTABLE' || s.calamityPriest.practice.board === 'FALLEN' || s.calamityPriest.practice.contact === 'FOCUSED';
const supplyExhausted = (state: WinnerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${WINNER_GUIDE}的独立赢家成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5赢家魔药，原瓶winner-potion-${number}，非怪物、机器、幸运者或灾祸教士旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: WinnerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (winnerInside(s) || inheritedContactOpen(s)) return '先实际结束当前训练实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原报时铺，找到艾妲·芬恩。';
  if (!knownChannel(s)) return '成为灾祸教士并保有艾妲·芬恩的指导渠道后，才能继续了解赢家之路。';
  if (promoted(s)) return '你已完成赢家晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.winner.guidanceKnown) return '已经听过赢家成品魔药的用药说明。';
    return s.cash < WINNER_PRICES.guidance ? '赢家用药指导需要460便士。' : null;
  }
  if (!s.winner.guidanceKnown) return '先听艾妲·芬恩说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.winner.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.winner) ? null : '须先用完现有全部赢家原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.winner.resupply.requestedWeek === null) return '尚未申请下一批赢家补给。';
    if (s.week <= s.winner.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.winner) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.winner.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选赢家原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting !== 100) return `灾祸教士魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.calamityPriest.promotionWeek === null || calamityPriestWeeks(s) < WINNER_MIN_CALAMITY_PRIEST_WEEKS) return `成为灾祸教士后已度过${calamityPriestWeeks(s)}/${WINNER_MIN_CALAMITY_PRIEST_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原报时铺劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyWinnerCommand(s: SliceState, command: WinnerAcquisitionCommand, c: SeerContext): void {
  rule(validateWinnerCommand(command) && isWinnerAcquisitionCommand(command), '赢家准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= WINNER_PRICES.guidance;
      s.winner.guidanceKnown = true;
      c.note('听取赢家用药说明', `花费1行动、460便士，你向已认识的本作原创成年${WINNER_GUIDE}继续请教，导师向你说明从独立赢家成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、准备原报时铺安静场地与在场照护安排。这些不是原来的怪物、机器、幸运者或灾祸教士存药。${WINNER_FORMULA_STATUS}灾祸教士消化须达100，晋升灾祸教士后满12整周才能服用；可提前筹备。${WINNER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.winner.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = WINNER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在艾妲·芬恩的原报时铺实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.winner.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('赢家原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原报时铺劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；灾祸教士消化100且晋升灾祸教士后满12整周时，再独立确认服药。${WINNER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.winner.resupply.requestedWeek = s.week;
      c.note('申请下一批赢家魔药', `现有赢家原瓶全部耗尽且未晋升。你花费1行动，请${WINNER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原报时铺的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.winner.bottles.length + 1;
      s.winner.resupply.deliveries += 1;
      for (let offset = 0; offset < WINNER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.winner.bottles.push({ id: `winner-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.winner.resupply.requestedWeek = null;
      c.note('下一批赢家原瓶到货', `第${s.week}周，艾妲·芬恩的独立赢家成品交接渠道本作G成品供给第${s.winner.resupply.deliveries + 1}批三瓶实际到货，原瓶winner-potion-${firstNumber}至winner-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.winner.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次赢家服药准备', `原成年${WINNER_GUIDE}在原报时铺实际核对你手中的原瓶${bottle.id}、检查本次安静场地并在场照护，按此前说明进行G指导服药准备。原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.winner.calamityPriestActingAtPromotion = s.progression.acting;
        s.winner.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of WINNER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为赢家', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。怪物、机器、幸运者和灾祸教士全部原能力及原ID掌握完整继承，仅新增wheel.s5.luck-reserve与wheel.s5.ill-fortune两项，从0掌握开始；灾祸教士消化成果、原晋升周、原瓶、已完成实践、原物交接、已解决敌人与风险记录均保持原样，赢家扮演从0开始。灵性上限提高到100，当前灵性没有补满。新幸运储备从0开始，容量3；必须在原报时铺指导室花费真实行动节制积累，不能靠晋升、休养或购买补满。部分掌控幸运与有限厄运仍可失败，不改写过去、不重掷、不保证胜利，也不施加普遍等量厄运偿还。旧幸运者被动幸运独立保留，不受储备强制控制。没有序列4、概率之骰或封印物混合高阶权能。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了赢家晋升' : '赢家魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是灾祸教士，消化与全部原有掌握保留，没有获得赢家能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectWinner(s: SliceState): WinnerProjection {
  const actions: WinnerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.misfortuneMage.winnerActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: WinnerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.winner.guidanceKnown) add('learn-winner-guidance', '请艾妲·芬恩说明赢家成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.winner.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${WINNER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶赢家魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.winner.resupply.requestedWeek !== null) add('receive-winner-supply', '确认下一批三瓶赢家到货', `0行动 · 第${s.winner.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.winner)) add('request-winner-supply', '向艾妲·芬恩订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.winner.guidanceKnown) {
    for (const bottle of s.winner.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶赢家魔药`, `0行动 · 独立确认 · 灾祸教士消化${isPromoted ? s.winner.calamityPriestActingAtPromotion : s.progression.acting}/100 · 晋升后${calamityPriestWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.winner.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.winner.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '赢家 · 序列5' : '赢家之路', discovered: available,
    guidanceKnown: available && s.winner.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: { ...s.winner.practice },
    luck: { ...s.winner.luck, capacity: 3, summary: available ? `当前幸运储备${s.winner.luck.stored}/3；已实际积累${s.winner.luck.accumulated}份、已耗用${s.winner.luck.spent}份。${s.winner.luck.lastAccumulateWeek === null ? '尚未实际积累。' : `最近一次实际积累在第${s.winner.luck.lastAccumulateWeek}周。`}每真实周最多在原报时铺实际节制积累1份；花费1行动、0灵性，不治疗、不自动充值，使用失败也不退还。容量、单位与恢复方式均为本作G；不是保证获胜，也没有普遍等量厄运债。` : '' },
    ...(isPromoted && s.winner.encounter.status === 'FIGHTING' && s.combat?.encounterId === 'WINNER_DISPUTE' ? { battle: { stored: s.winner.luck.stored, lastLuckRound: s.winner.encounter.lastLuckRound, staggerReady: s.winner.encounter.staggerReady } } : {}),
    cases: [], environment: '', insideCase: (winnerInside(s) || inheritedContactOpen(s)),
    ...(available ? { story: WINNER_SOURCE_STATUS } : {}),
    supplies: available ? `${WINNER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.winner.resupply.requestedWeek === null ? `已实际接收后续供给${s.winner.resupply.deliveries}批。` : `第${s.winner.resupply.requestedWeek}周提出请求，第${s.winner.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.winner.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 赢家魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? WINNER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `灾祸教士消化成果${s.winner.calamityPriestActingAtPromotion}/100已保留；赢家扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成灾祸教士消化（${s.progression.acting}/100），并在晋升灾祸教士后度过12整周（${calamityPriestWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完灾祸教士之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${WINNER_CONSUMPTION_RISK}` : '成为灾祸教士后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isWinnerAcquisitionCommand(command: unknown): command is WinnerAcquisitionCommand {
  return validateWinnerCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateWinnerCommand(value: unknown): value is WinnerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'ACCUMULATE', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^winner-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^winner-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && WINNER_CASE_IDS.includes(value.caseId as typeof WINNER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && WINNER_CASE_IDS.includes(value.caseId as typeof WINNER_CASE_IDS[number]) && (value.method === 'ORDINARY' || value.method === 'ABILITY' && value.caseId !== 'honest-account');
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateWinnerState(s: SliceState): boolean {
  const raw: unknown = s.winner;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'calamityPriestActingAtPromotion', 'cases', 'practice', 'luck', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.monster) || !record(s.machine) || !record(s.lucky) || !record(s.calamityPriest)) return false;
  if (![s.monster.cases, s.machine.cases, s.lucky.cases, s.calamityPriest.cases].every(value => record(value) && Object.values(value).every(record)) || !record(s.calamityPriest.practice)) return false;
  const firstCalamityPriestWeek = s.calamityPriest.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstCalamityPriestWeek + WINNER_MIN_CALAMITY_PRIEST_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== WINNER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, WINNER_CASE_IDS) || !record(raw.practice) || !record(raw.luck) || !record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek', 'lastLuckRound', 'staggerReady']) || typeof raw.encounter.staggerReady !== 'boolean' || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateWinnerLife(s)) return false;
  const winner = raw as unknown as WinnerState, isPromoted = promoted(s);
  if (winner.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (inheritedContactOpen(s)) return false;
    if (!winner.guidanceKnown || !integer(s.calamityPriest.promotionWeek, 1, s.week) || !integer(winner.promotionWeek, firstConsumptionWeek, s.week) || winner.calamityPriestActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...MONSTER_ABILITY_IDS, ...MACHINE_ABILITY_IDS, ...LUCKY_ABILITY_IDS, ...CALAMITY_PRIEST_ABILITY_IDS, ...WINNER_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?MISFORTUNE_MAGE_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?CHAOS_WALKER_ABILITY_IDS:[]),...(s.progression.sequence===2?FATE_PROPHET_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (winner.luck.stored !== 0 || winner.luck.lastAccumulateWeek !== null || winner.luck.accumulated !== 0 || winner.luck.spent !== 0) return false;
    if (winner.promotionWeek !== null || winner.calamityPriestActingAtPromotion !== null || WINNER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (Object.entries(freshWinnerPractice()).some(([key, value]) => winner.practice[key as keyof WinnerPractice] !== value)) return false;
    if (winner.reflected || Object.values(winner.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of winner.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `winner-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of winner.bottles.entries()) {
    let stockWeek = firstCalamityPriestWeek;
    if (index < WINNER_BOTTLE_IDS.length) {
      if (bottle.source !== WINNER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!winner.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / WINNER_BOTTLE_IDS.length) - 1;
      if (index % WINNER_BOTTLE_IDS.length === 0) {
        const previous = winner.bottles.slice(index - WINNER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > winner.promotionWeek!) return false;
    }
    if (!winner.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > winner.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > winner.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== winner.promotionWeek) return false;
    }
  }
  if (winner.resupply.requestedWeek !== null && (!winner.guidanceKnown || isPromoted || !supplyExhausted(winner) || winner.bottles.some(bottle => bottle.consumedWeek! > winner.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0) && validateWinnerEncounter(s);
}

export { WINNER_ABILITIES } from './content.js';
export type * from './types.js';
