import { CONQUEROR_ABILITY_IDS } from '../conqueror/types.js';
import {WEATHER_WARLOCK_ABILITY_IDS} from '../weather-warlock/types.js';
import { WAR_BISHOP_ABILITY_IDS } from '../war-bishop/types.js';
import { IRON_BLOOD_KNIGHT_ABILITY_IDS } from '../iron-blood-knight/types.js';
import {REAPER_ABILITY_IDS} from '../reaper/types.js';
import {CONSPIRATOR_ABILITY_IDS} from '../conspirator/types.js';
import {PYROMANIAC_ABILITIES} from '../pyromaniac/content.js';
import {PROVOKER_ABILITIES} from '../provoker/content.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import {
  HUNTER_ABILITIES, HUNTER_BOTTLE_IDS, HUNTER_CONSUMPTION_RISK, HUNTER_FORMULA_STATUS,
  HUNTER_GUIDE, HUNTER_POTION_SOURCES, HUNTER_PRICES, HUNTER_TRAP_KIT, HUNTER_TRAP_STOCK,
} from './content.js';
import {
  HUNTER_ABILITY_IDS, type HunterAcquisitionCommand, type HunterAction, type HunterBottle,
  type HunterProjection, type HunterState,
} from './types.js';

export function createHunterState(): HunterState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: HUNTER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    observations: [], practiceAttempts: {},
    trapStock: HUNTER_TRAP_STOCK, trapHeld: 0, trapDeployed: 0, trapSpent: 0, trapLocation: null,
    cargo: { status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null, enemyStatus: 'RESISTING', originalId: 'milo-copper-crate', owner: 'cargo-owner-milo', holder: 'OWNER' },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'hunter' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))));
const potionPrice = (bottle: HunterBottle) => HUNTER_PRICES.potion - (bottle.labourSteps === 2 ? HUNTER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: HunterBottle) => Number(bottle.id.slice('hunter-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (hunter: HunterState) => hunter.bottles.length > 0 && hunter.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${HUNTER_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的深红色猎人魔药，原瓶hunter-potion-${number}。导师供给为本作原创，完整配方资料待核。`;

function commandBlock(s: SliceState, command: HunterAcquisitionCommand): string | null {
  if (s.progression.pathwayId === 'hunter' && s.progression.sequence === 1) return '征服者阶段只回看旧猎人记录；请使用本阶段实际行动。';
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到退役追踪员。';
  if (command.type === 'BUY_TRAP_KIT') {
    if (!promoted(s)) return '成为猎人后才能购买导师备好的陷阱原件。';
    if (s.hunter.trapStock < 1) return '陷阱原件已经售罄，这批货不会自动补充。';
    return s.cash < HUNTER_PRICES.trapKit ? '一套陷阱原件需要12便士。' : null;
  }
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服猎人魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.hunter.discovered ? '已经认识这位退役追踪员。' : null;
  if (!s.hunter.discovered) return '先拜访退役追踪员。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.hunter.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < HUNTER_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.hunter.guidanceKnown) return '先听导师说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.hunter.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.hunter) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.hunter.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.hunter.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.hunter) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.hunter.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选猎人原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次仓库劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Operates on the slice's working copy; the caller commits the whole intent. */
export function applyHunterCommand(s: SliceState, command: HunterAcquisitionCommand, c: SeerContext): void {
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.hunter.discovered = true;
      c.note('认识退役追踪员', `你在贝克兰德的仓库区拜访了${HUNTER_GUIDE}，消耗1行动。他有三瓶独立封存的深红色猎人成品魔药，愿意说明来源与用药风险，也接受实际仓库劳务抵扣部分药价。这次接触没有赋予非凡能力。导师与渠道为本作原创。`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= HUNTER_PRICES.guidance;
      s.hunter.guidanceKnown = true;
      c.note('听取猎人用药说明', `花费1行动、120便士，听导师说明三瓶现有魔药的来源、交付方式和指导服药的四档风险。${HUNTER_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.hunter.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成仓库巡检' : '完成仓库整理', bottle.labourSteps === 1
        ? `你跟随导师检查仓库门窗与地面痕迹，实际完成一次巡检，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由导师保管。完成第二次仓库整理后可抵该瓶600便士。`
        : `你实际整理了导师负责的仓库货位与过道，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，也不产生材料或陷阱原件。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.hunter.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('猎人原瓶交付', `导师将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次仓库劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${HUNTER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.hunter.resupply.requestedWeek = s.week;
      c.note('申请下一批猎人魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${HUNTER_GUIDE}订下下一批三瓶，并实际清点原仓库的收货位置。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由导师持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.hunter.resupply.deliveries += 1;
      const firstNumber = s.hunter.resupply.deliveries * HUNTER_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < HUNTER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.hunter.bottles.push({ id: `hunter-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.hunter.resupply.requestedWeek = null;
      c.note('下一批猎人原瓶到货', `第${s.week}周，导师本作G供给第${s.hunter.resupply.deliveries + 1}批三瓶实际送到仓库，原瓶hunter-potion-${firstNumber}至hunter-potion-${firstNumber + 2}由导师保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.hunter.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'hunter';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(HUNTER_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 5], ['perception', 3], ['will', 1], ['knowledge', 2]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为猎人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+5、感知+3、意志+1、知识+2。四项猎人能力从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。陷阱仍须购买实际原件、提前布置。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了猎人晋升' : '猎人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
    case 'BUY_TRAP_KIT':
      s.cash -= HUNTER_PRICES.trapKit;
      s.hunter.trapStock -= 1;
      s.hunter.trapHeld += 1;
      c.note('陷阱原件入袋', `支付12便士、0行动，实际取得${HUNTER_TRAP_KIT}，合计一套。现在持有${s.hunter.trapHeld}套，供应方剩余${s.hunter.trapStock}套。布置会把原件移到对应现场；触发后消耗，未触发可以回收。`);
      return;
  }
}

export function projectHunter(s: SliceState): HunterProjection {
  const actions: HunterAction[] = [], isPromoted = promoted(s), known = s.hunter.discovered;
  const add = (id: string, label: string, cost: string, command: HunterAcquisitionCommand) => {
    if (isPromoted && (s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))) && command.type !== 'BUY_TRAP_KIT') return;
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-hunter', `拜访${HUNTER_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.hunter.guidanceKnown) add('learn-hunter-guidance', '请导师说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.hunter.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '仓库巡检' : '仓库整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶猎人魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.hunter.resupply.requestedWeek !== null) add('receive-hunter-supply', '确认下一批三瓶到货', `0行动 · 第${s.hunter.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.hunter)) add('request-hunter-supply', '向导师订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.hunter.guidanceKnown) {
    for (const bottle of s.hunter.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶猎人魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  if (isPromoted) add('buy-hunter-trap-kit', '购买一套陷阱原件', `0行动 · 12便士 · ${HUNTER_TRAP_KIT} · 供应方剩${s.hunter.trapStock}套`, { type: 'BUY_TRAP_KIT' });
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.hunter.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.hunter.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '猎人 · 序列9' : '猎人之路', discovered: known, guidanceKnown: s.hunter.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${HUNTER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.hunter.resupply.requestedWeek === null ? `已实际接收后续供给${s.hunter.resupply.deliveries}批。` : `第${s.hunter.resupply.requestedWeek}周提出补给请求，第${s.hunter.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions: s.progression.sequence === 1 ? [] : actions,
    bottles: known ? s.hunter.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 深红色猎人魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? HUNTER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? (s.progression.sequence!==9?s.provoker.hunterActingAtPromotion??100:s.progression.acting) : 0,
    digestion: isPromoted&&s.progression.sequence!==9?'猎人魔药已消化，原四项能力和经历保留。':!isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : s.progression.acting >= 100 ? '猎人魔药已消化，能力掌握仍按实际经历分别记录。下一序列尚未开放。'
        : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。'
          : `已留下猎人扮演经历（${s.progression.acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解两条渠道，但成功晋升只能选择一条；另一途径未服的原瓶保留，不能改服。${HUNTER_CONSUMPTION_RISK}`
      : '拜访退役追踪员，了解猎人成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    trapStock: isPromoted ? s.hunter.trapStock : 0,
    trapHeld: isPromoted ? s.hunter.trapHeld : 0,
    trapDeployed: isPromoted ? s.hunter.trapDeployed : 0,
    trapSpent: isPromoted ? s.hunter.trapSpent : 0,
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Finite original bottles and physical trap stock. Adventure validates its own event history. */
export function validateHunterState(s: SliceState): boolean {
  const raw: unknown = s.hunter;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'observations', 'practiceAttempts', 'trapStock', 'trapHeld', 'trapDeployed', 'trapSpent', 'trapLocation', 'cargo'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered) return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== HUNTER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!Array.isArray(raw.observations) || !raw.observations.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) || new Set(raw.observations).size !== raw.observations.length) return false;
  if (!record(raw.practiceAttempts) || !Object.entries(raw.practiceAttempts).every(([id, week]) => id.length > 0 && id.length <= 200 && integer(week, 1, s.week))) return false;
  if (![raw.trapStock, raw.trapHeld, raw.trapDeployed, raw.trapSpent].every(value => integer(value, 0, HUNTER_TRAP_STOCK))) return false;
  const hunter = raw as unknown as HunterState, isPromoted = promoted(s);
  if (hunter.trapStock + hunter.trapHeld + hunter.trapDeployed + hunter.trapSpent !== HUNTER_TRAP_STOCK) return false;
  if (hunter.trapDeployed > 1 || (hunter.trapDeployed === 0 ? hunter.trapLocation !== null : !['FIRST_CASE', 'HUNTER_CARGO'].includes(hunter.trapLocation as string))) return false;
  if (!record(hunter.cargo) || !shape(hunter.cargo, ['status', 'attemptWeek', 'startHistoryIndex', 'enemyStatus', 'originalId', 'owner', 'holder'])) return false;
  if (hunter.cargo.originalId !== 'milo-copper-crate' || hunter.cargo.owner !== 'cargo-owner-milo' || hunter.cargo.holder !== 'OWNER') return false;
  if (!['AVAILABLE', 'FIGHTING', 'RESCUED', 'RETREATED', 'LOST'].includes(hunter.cargo.status) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(hunter.cargo.enemyStatus)) return false;
  if (hunter.cargo.attemptWeek !== null && !integer(hunter.cargo.attemptWeek, 1, s.week) || hunter.cargo.startHistoryIndex !== null && !integer(hunter.cargo.startHistoryIndex, 0, s.combatHistory.length)) return false;
  if (isPromoted) {
    if (!hunter.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...(s.progression.sequence === 1 ? CONQUEROR_ABILITY_IDS : []),...((s.progression.sequence===2||s.progression.sequence===1)?WEATHER_WARLOCK_ABILITY_IDS:[]),...HUNTER_ABILITY_IDS,...(s.progression.sequence!==9?PROVOKER_ABILITIES.map(a=>a.id):[]),...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?PYROMANIAC_ABILITIES.map(a=>a.id):[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?CONSPIRATOR_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?REAPER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?IRON_BLOOD_KNIGHT_ABILITY_IDS:[]),...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?WAR_BISHOP_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (HUNTER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || hunter.observations.length > 0 || Object.keys(hunter.practiceAttempts).length > 0 || hunter.trapStock !== HUNTER_TRAP_STOCK || hunter.trapHeld !== 0 || hunter.trapDeployed !== 0 || hunter.trapSpent !== 0 || hunter.cargo.status !== 'AVAILABLE' || hunter.cargo.attemptWeek !== null || hunter.cargo.startHistoryIndex !== null || hunter.cargo.enemyStatus !== 'RESISTING') return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of hunter.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `hunter-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < HUNTER_BOTTLE_IDS.length) {
      if (bottle.source !== HUNTER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!hunter.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / HUNTER_BOTTLE_IDS.length) - 1;
      if (index % HUNTER_BOTTLE_IDS.length === 0) {
        const previous = hunter.bottles.slice(index - HUNTER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!hunter.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week)) return false;
    if (s.progression.promotionWeek !== null && bottle.acquiredWeek! > s.progression.promotionWeek) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(5, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (s.progression.promotionWeek !== null && bottle.consumedWeek! > s.progression.promotionWeek) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== s.progression.promotionWeek) return false;
    }
  }
  if (hunter.resupply.requestedWeek !== null && (!hunter.guidanceKnown || !supplyExhausted(hunter) || hunter.bottles.some(bottle => bottle.consumedWeek! > hunter.resupply.requestedWeek!) || s.progression.promotionWeek !== null && hunter.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}
