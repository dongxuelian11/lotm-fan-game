import { CONQUEROR_ABILITY_IDS } from '../conqueror/types.js';
import {WEATHER_WARLOCK_ABILITY_IDS} from '../weather-warlock/types.js';
import { WAR_BISHOP_ABILITY_IDS } from '../war-bishop/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { HUNTER_ABILITY_IDS } from '../hunter/types.js';
import { PROVOKER_ABILITY_IDS } from '../provoker/types.js';
import { PYROMANIAC_ABILITY_IDS } from '../pyromaniac/types.js';
import { CONSPIRATOR_ABILITY_IDS } from '../conspirator/types.js';
import { REAPER_ABILITY_IDS } from '../reaper/types.js';
import {
  createIronBloodTeamState, validateIronBloodTeamState, projectIronBloodTeam, ironBloodTeamActions,
  validateIronBloodTeamCommand, applyIronBloodTeamCommand, hasIronBloodRite, canConsumeIronBloodRite, closeIronBloodRite,
} from './team.js';
import {
  createIronBloodLifeState, validateIronBloodLife, projectIronBloodLife, ironBloodActions,
  validateIronBloodActivityCommand, ironBloodInside,
} from './life.js';
import {
  createIronBloodEncounterState, validateIronBloodEncounter, projectIronBloodEncounter,
  ironBloodEncounterActions, validateIronBloodEncounterCommand, applyIronBloodEncounterCommand, isInsideIronBloodEncounter,
} from './encounter.js';
import {
  IRON_BLOOD_KNIGHT_ABILITIES, IRON_BLOOD_KNIGHT_BODY_CHANGE, IRON_BLOOD_KNIGHT_BOTTLE_IDS,
  IRON_BLOOD_KNIGHT_CONSUMPTION_RISK, IRON_BLOOD_KNIGHT_FORMULA_STATUS, IRON_BLOOD_KNIGHT_GUIDE,
  IRON_BLOOD_KNIGHT_LABOUR_STEPS, IRON_BLOOD_KNIGHT_LABOUR_TASKS, IRON_BLOOD_KNIGHT_MIN_REAPER_WEEKS,
  IRON_BLOOD_KNIGHT_POTION_SOURCES, IRON_BLOOD_KNIGHT_PRICES, IRON_BLOOD_KNIGHT_RITUAL_SOURCE,
  IRON_BLOOD_KNIGHT_SOURCE_STATUS,
} from './content.js';
import {
  IRON_BLOOD_KNIGHT_ABILITY_IDS, type IronBloodKnightAcquisitionCommand, type IronBloodKnightAction,
  type IronBloodKnightBottle, type IronBloodKnightCommand, type IronBloodKnightProjection, type IronBloodKnightState,
} from './types.js';

const freshBottle = (id: string, source: string): IronBloodKnightBottle => ({
  id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
  ritualId: null, ritualParticipantIds: [], ritualArrivalWeek: null,
});
export function createIronBloodKnightState(): IronBloodKnightState {
  return {
    guidanceKnown: false, bottles: IRON_BLOOD_KNIGHT_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, reaperActingAtPromotion: null, originalGender: null,
    team: createIronBloodTeamState(), life: createIronBloodLifeState(), encounter: createIronBloodEncounterState(),
  };
}
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isIronBloodKnight = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 4;
const hasIronBloodHistory = (s: SliceState) => isIronBloodKnight(s) || (s.progression.pathwayId === 'hunter' && (s.progression.sequence === 3 || (s.progression.sequence === 2 || s.progression.sequence === 1)));
const isReaper = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.hunter.discovered && s.reaper.guidanceKnown && s.reaper.promotionWeek !== null && (isReaper(s) || hasIronBloodHistory(s));
const bottleNumber = (bottle: Pick<IronBloodKnightBottle, 'id'>) => Number(bottle.id.slice('iron-blood-knight-potion-'.length));
const potionPrice = (bottle: IronBloodKnightBottle) => IRON_BLOOD_KNIGHT_PRICES.potion - (bottle.labourSteps === IRON_BLOOD_KNIGHT_LABOUR_STEPS ? IRON_BLOOD_KNIGHT_PRICES.labourCredit : 0);
const reaperWeeks = (s: SliceState) => Math.max(0, (s.ironBloodKnight.promotionWeek ?? s.week) - (s.reaper.promotionWeek ?? s.week));
const exhaustedSupply = (state: IronBloodKnightState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${IRON_BLOOD_KNIGHT_GUIDE}的独立铁血骑士成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4铁血骑士魔药，原瓶iron-blood-knight-potion-${number}，非猎人至收割者旧瓶改装。完整配方保持未知，真实队伍仪式另行完成。`;

export function ironBloodKnightAcquisitionBlock(s: SliceState, command: IronBloodKnightAcquisitionCommand): string | null {
  const state = s.ironBloodKnight;
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (Object.values(s.reaper.cases).some(scene => scene.contactOpen || scene.practice.windowOpen || scene.status === 'PREPARED') || ironBloodInside(s) || isInsideIronBloodEncounter(s)) return '先实际收束旧收割者练习、当前形态、同伴联系与现场接触。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要沿实际行程返回贝克兰德原货栈与独立训练院。';
  if (!knownChannel(s)) return '成为收割者并保有原指导者渠道后，才能了解铁血骑士之路。';
  if (hasIronBloodHistory(s)) return '已经完成铁血骑士晋升，不能重复准备或服药；未服原瓶保留。';
  if (hasIronBloodRite(s) && command.type !== 'CONSUME') return '30位原成员正在组成当前仪式；先独立确认饮药，或0行动让大家实际离场。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (state.guidanceKnown) return '已经听过铁血骑士用药、真实队伍仪式与身体变化说明。';
    return s.cash < IRON_BLOOD_KNIGHT_PRICES.guidance ? '本次用药与仪式指导需要500便士。' : null;
  }
  if (!state.guidanceKnown) return '先听原指导者说明成品来源、真实队伍仪式、四档风险与身体变化。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (state.resupply.requestedWeek !== null) return '已经申请下一批，必须等下一真实周实际到货。';
    return exhaustedSupply(state) ? null : '现有原瓶须全部真实服用且失败，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (state.resupply.requestedWeek === null) return '尚未申请下一批铁血骑士原瓶。';
    if (s.week <= state.resupply.requestedWeek) return '本周刚提出申请，下一真实周起才能确认收货。';
    return exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = state.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选铁血骑士原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true || command.acceptBodyChange !== true) return '须分别确认饮用本次原瓶，并明确接受晋升成功时的身体变化规则。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可0行动散场后休养，但重试须实际重新集合。';
    if (s.progression.acting !== 100) return `收割者魔药尚未完全消化，扮演${s.progression.acting}/100。`;
    if (s.reaper.promotionWeek === null || reaperWeeks(s) < IRON_BLOOD_KNIGHT_MIN_REAPER_WEEKS) return `成为收割者后已度过${reaperWeeks(s)}/12整周，尚不能服药。`;
    if (state.originalGender !== null && s.character.gender !== state.originalGender) return '当前身体与此前真实尝试记录不符，不能改写原身体记录。';
    return canConsumeIronBloodRite(s) ? null : '需要本周30位原成员实际到场组成合格仪式；名册、旧集合或不完整共同成长不能替代。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= IRON_BLOOD_KNIGHT_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice persists one complete intent. */
export function applyIronBloodKnightAcquisition(s: SliceState, command: IronBloodKnightAcquisitionCommand, c: SeerContext): void {
  rule(validateIronBloodKnightAcquisitionCommand(command), '铁血骑士准备命令无效。');
  const blocked = ironBloodKnightAcquisitionBlock(s, command); rule(blocked === null, blocked ?? '当前无法继续。');
  const state = s.ironBloodKnight;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1; s.cash -= IRON_BLOOD_KNIGHT_PRICES.guidance; state.guidanceKnown = true;
      c.note('听取铁血骑士用药与队伍仪式说明', `花1行动、500便士，向原${IRON_BLOOD_KNIGHT_GUIDE}了解独立原瓶与真实仪式。${IRON_BLOOD_KNIGHT_FORMULA_STATUS}${IRON_BLOOD_KNIGHT_RITUAL_SOURCE}${IRON_BLOOD_KNIGHT_BODY_CHANGE}`); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1; bottle.labourSteps += 1;
      c.note(IRON_BLOOD_KNIGHT_LABOUR_TASKS[bottle.labourSteps - 1]!, `在原货栈实际完成第${bottleNumber(bottle)}瓶对应劳务，花1行动，现为${bottle.labourSteps}/5。五次完成只抵本瓶5400便士，仍须支付800便士；部分劳动不折现，不产生团队成员、经历或完成的仪式。原瓶仍由导师保管。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(candidate => candidate.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      c.note('铁血骑士独立原瓶交付', `支付${paid}便士、0行动，实际取得原瓶${bottle.id}。${bottle.labourSteps === 5 ? '五次本瓶劳务抵5400便士，仅支付800便士余款。' : '本瓶完整药价6200便士，未完成劳动不部分抵扣。'}尚未饮用；不附赠队伍或仪式。${IRON_BLOOD_KNIGHT_FORMULA_STATUS}`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1; state.resupply.requestedWeek = s.week;
      c.note('申请下一批铁血骑士成品', `现有全部原瓶均已耗尽失败。花1行动核对旧记录，最早第${s.week + 1}周实际接收下一批三瓶；此刻没有新瓶，每瓶仍需6200便士或五次对应劳动后800便士。旧队伍经历与身体记录保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = state.bottles.length + 1;
      for (let offset = 0; offset < IRON_BLOOD_KNIGHT_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset; state.bottles.push(freshBottle(`iron-blood-knight-potion-${number}`, deliverySource(number, s.week)));
      }
      state.resupply.deliveries += 1; state.resupply.requestedWeek = null;
      c.note('后续铁血骑士三瓶实际到货', `第${s.week}周，第${firstNumber}至${firstNumber + 2}瓶实际收入原供应方库存，0行动，尚未交付给你。旧失败原瓶、队伍经历和已关闭集合完整保留；新瓶不复制旧瓶或附送新仪式。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(candidate => candidate.id === command.bottleId)!, rite = state.team.rite;
      rule(rite !== null, '缺少当前真实30人集合。');
      const result = c.check('will', 28);
      if (state.originalGender === null) state.originalGender = s.character.gender;
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week;
      bottle.ritualId = rite.id; bottle.ritualParticipantIds = [...rite.participantIds]; bottle.ritualArrivalWeek = rite.arrivedWeek;
      const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
      if (success) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.reaperActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 4; s.progression.acting = 0;
        for (const id of IRON_BLOOD_KNIGHT_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        if (state.originalGender === 'FEMALE') s.character.gender = 'MALE';
        closeIronBloodRite(s, bottle.id);
        c.note('在真实队伍仪式中成为铁血骑士', `原瓶${bottle.id}于${rite.id}耗尽，30位原成员实际组成仪式。意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}，精神−${mentalCost}，四属性各+1。${state.originalGender === 'FEMALE' ? '本次成功使原女性身体变为男性，先前明确接受的变化现已发生。' : '原身体性别保持不变。'}原创建与全部旧经历未重写；收割者消化100保留，两项新掌握从0开始，灵性上限120而当前不补满。原成员实际散场回家，健康与共同经历保留。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        closeIronBloodRite(s, bottle.id);
        c.note(severe ? '铁血骑士魔药严重排异' : '铁血骑士魔药排异', `原瓶${bottle.id}于${rite.id}耗尽，意志${result.roll}/${result.chance}。健康−${healthCost}、精神−${mindCost}、排异+${pollution}；本作G现场监督仅将此次药物排异后的健康与精神保底到1，不保护实际战斗。你仍是收割者，身体性别没有改变，旧掌握与消化保留。原成员实际散场；共同成长未抹去，重试须另一原瓶及重新花1行动、120便士集合。`);
      }
      return;
    }
  }
}

export function applyIronBloodKnightCommand(s: SliceState, command: IronBloodKnightCommand, c: SeerContext): void {
  rule(!(s.progression.pathwayId === 'hunter' && s.progression.sequence === 1), '征服者阶段请通过本阶段生活入口安排原队伍休整。');
  rule(validateIronBloodKnightCommand(command), '铁血骑士命令无效。');
  if (validateIronBloodKnightAcquisitionCommand(command)) return applyIronBloodKnightAcquisition(s, command, c);
  if (validateIronBloodTeamCommand(command)) return applyIronBloodTeamCommand(s, command, c);
  if (validateIronBloodEncounterCommand(command)) return applyIronBloodEncounterCommand(s, command, c);
  throw new Error('铁血骑士生活实践须由共享入口结算实际掌握与消化。');
}

export function projectIronBloodKnight(s: SliceState): IronBloodKnightProjection {
  const state = s.ironBloodKnight, available = knownChannel(s), promoted = hasIronBloodHistory(s), actions: IronBloodKnightAction[] = [];
  const add = (id: string, label: string, cost: string, command: IronBloodKnightAcquisitionCommand) => {
    const reason = ironBloodKnightAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-iron-blood-knight-guidance', '听取铁血骑士用药、身体变化与队伍仪式指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      if (state.resupply.requestedWeek !== null) add('receive-iron-blood-knight-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周 · 仍须逐瓶付款`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-iron-blood-knight-supply', '向原指导者申请下一批成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${IRON_BLOOD_KNIGHT_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶铁血骑士魔药`, `0行动 · ${potionPrice(bottle)}便士 · 不附赠仪式`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `在当前真实队伍仪式服用第${bottleNumber(bottle)}瓶`, `0行动 · 饮药与身体变化分别确认 · 收割者${s.progression.acting}/100 · ${reaperWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true, acceptBodyChange: true });
      }
    }
  }
  const team = projectIronBloodTeam(s), life = projectIronBloodLife(s), encounter = projectIronBloodEncounter(s);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  return {
    title: promoted ? '铁血骑士 · 序列4' : '铁血骑士之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    formulaKnown: false, formula: [], team, life, encounter,
    actions: available && s.progression.sequence!==3 && s.progression.sequence!==1 ? [...actions, ...ironBloodTeamActions(s), ...ironBloodActions(s), ...ironBloodEncounterActions(s)] : [],
    insideCase: hasIronBloodRite(s) || ironBloodInside(s) || isInsideIronBloodEncounter(s),
    environment: available ? '贝克兰德原货栈后的独立石院。30位有名字的成年成员平时各自回家；只有实际邀约或集合才到场。' : '',
    bottles: available ? state.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 铁血骑士成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周实际交付。`}${bottle.ritualId ? `实际服用仪式${bottle.ritualId}，原成员${bottle.ritualParticipantIds.length}人。` : ''}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5` : bottle.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，仍为收割者' : '排异，仍为收割者'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true, acceptBodyChange: true },
    })) : [],
    abilities: promoted ? IRON_BLOOD_KNIGHT_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: promoted ? ((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?s.warBishop.ironBloodActingAtPromotion??100:s.progression.acting) : 0,
    digestion: promoted ? `收割者消化成果${state.reaperActingAtPromotion}/100已保留；铁血骑士扮演${(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?s.warBishop.ironBloodActingAtPromotion??100:s.progression.acting}/100，原能力掌握全部继承。` : available ? `收割者扮演需100（当前${s.progression.acting}/100），晋升后需12整周（${reaperWeeks(s)}/12）；真实队伍共同成长与成员当次到场还须另外满足。` : '先走完收割者之路。',
    pollution: s.seer.pollution,
    bodyChange: available ? IRON_BLOOD_KNIGHT_BODY_CHANGE : '', originalGender: state.originalGender, currentGender: s.character.gender,
    ...(available ? { story: `${IRON_BLOOD_KNIGHT_FORMULA_STATUS}${IRON_BLOOD_KNIGHT_RITUAL_SOURCE}${IRON_BLOOD_KNIGHT_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(bottle => bottle.status === 'SUPPLIER').length}瓶，你持有未服原瓶${state.bottles.filter(bottle => bottle.status === 'PLAYER').length}瓶。每批3瓶。${state.resupply.requestedWeek === null ? `后续实际到货${state.resupply.deliveries}批。` : `第${state.resupply.requestedWeek}周申请，下一真实周起可确认到货。`}${IRON_BLOOD_KNIGHT_FORMULA_STATUS}` : '',
    risk: available ? IRON_BLOOD_KNIGHT_CONSUMPTION_RISK : '成为收割者后，可向原指导者了解下一序列。',
  };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateIronBloodKnightAcquisitionCommand(v: unknown): v is IronBloodKnightAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(v.type as string)) return shape(v, ['type']);
  if (typeof v.bottleId !== 'string' || !/^iron-blood-knight-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(v.type as string)) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed', 'acceptBodyChange']) && v.confirmed === true && v.acceptBodyChange === true;
}
export const isIronBloodKnightAcquisitionCommand = validateIronBloodKnightAcquisitionCommand;
export function validateIronBloodKnightCommand(v: unknown): v is IronBloodKnightCommand {
  return validateIronBloodKnightAcquisitionCommand(v) || validateIronBloodTeamCommand(v) || validateIronBloodActivityCommand(v) || validateIronBloodEncounterCommand(v);
}

/** Validate original bottle/rite identity, body transition and chronology without rewriting past scenes. */
export function validateIronBloodKnightState(s: SliceState): boolean {
  try { return validateState(s); } catch { return false; }
}
function validateState(s: SliceState): boolean {
  const raw: unknown = s.ironBloodKnight;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'reaperActingAtPromotion', 'originalGender', 'team', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.reaper) || !record(s.hunter) || !record(s.character)) return false;
  if (raw.originalGender !== null && (typeof raw.originalGender !== 'string' || raw.originalGender.length === 0 || raw.originalGender.length > 100)) return false;
  const firstReaperWeek = s.reaper.promotionWeek ?? s.week, firstConsumptionWeek = firstReaperWeek + IRON_BLOOD_KNIGHT_MIN_REAPER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1)) return false;
  const state = raw as unknown as IronBloodKnightState, promoted = hasIronBloodHistory(s);
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.reaper.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.reaperActingAtPromotion !== 100 || state.originalGender === null) return false;
    if (s.character.gender !== (state.originalGender === 'FEMALE' ? 'MALE' : state.originalGender)) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence === 1 ? CONQUEROR_ABILITY_IDS : []),...((s.progression.sequence===2||s.progression.sequence===1)?WEATHER_WARLOCK_ABILITY_IDS:[]),...HUNTER_ABILITY_IDS, ...PROVOKER_ABILITY_IDS, ...PYROMANIAC_ABILITY_IDS, ...CONSPIRATOR_ABILITY_IDS, ...REAPER_ABILITY_IDS, ...IRON_BLOOD_KNIGHT_ABILITY_IDS,...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?WAR_BISHOP_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.reaperActingAtPromotion !== null || IRON_BLOOD_KNIGHT_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || state.originalGender !== null && s.character.gender !== state.originalGender) return false;
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome', 'ritualId', 'ritualParticipantIds', 'ritualArrivalWeek']) || bottle.id !== `iron-blood-knight-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5) || !Array.isArray(bottle.ritualParticipantIds)) return false;
  }
  if (!validateIronBloodTeamState(s) || !validateIronBloodLife(s) || !validateIronBloodEncounter(s)) return false;
  let successes = 0, consumptions = 0;
  const ritualIds = new Set<string>(), deliveryWeeks: number[] = [];
  for (const [index, bottle] of state.bottles.entries()) {
    let stockWeek = firstReaperWeek;
    if (index < 3) {
      if (bottle.source !== IRON_BLOOD_KNIGHT_POTION_SOURCES[index]!.source) return false;
    } else {
      const match = bottle.source.match(/，第(\d+)周实收入库；/); stockWeek = match ? Number(match[1]) : 0;
      if (!state.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      if (index % 3 === 0) {
        const previous = state.bottles.slice(index - 3, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[Math.floor(index / 3) - 1] !== stockWeek) return false;
      if (promoted && stockWeek > state.promotionWeek!) return false;
    }
    if (!state.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else {
      if (!integer(bottle.acquiredWeek, stockWeek, s.week) || promoted && bottle.acquiredWeek > state.promotionWeek!) return false;
      if (bottle.status === 'PLAYER') { if (bottle.consumedWeek !== null || bottle.outcome !== null) return false; }
      else if (bottle.status === 'CONSUMED') {
        consumptions += 1;
        if (!integer(s.reaper.promotionWeek, 1, s.week) || !integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
        if (promoted ? bottle.consumedWeek > state.promotionWeek! : s.progression.acting !== 100) return false;
        if (typeof bottle.ritualId !== 'string' || ritualIds.has(bottle.ritualId) || bottle.ritualParticipantIds.length !== 30 || bottle.ritualArrivalWeek !== bottle.consumedWeek) return false;
        ritualIds.add(bottle.ritualId);
        const rite = state.team.riteHistory.find(candidate => candidate.id === bottle.ritualId);
        if (!rite || rite.consumedBottleId !== bottle.id || rite.arrivedWeek !== bottle.ritualArrivalWeek || rite.closedWeek !== bottle.consumedWeek || rite.participantIds.length !== 30 || !rite.participantIds.every((id, i) => id === bottle.ritualParticipantIds[i])) return false;
      } else return false;
    }
    if (bottle.status !== 'CONSUMED' && (bottle.ritualId !== null || bottle.ritualParticipantIds.length !== 0 || bottle.ritualArrivalWeek !== null)) return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') { successes += 1; if (bottle.consumedWeek !== state.promotionWeek) return false; }
  }
  if (consumptions === 0 ? state.originalGender !== null : state.originalGender === null) return false;
  if (state.team.riteHistory.some(rite => rite.consumedBottleId !== null && !state.bottles.some(bottle => bottle.id === rite.consumedBottleId && bottle.ritualId === rite.id && bottle.status === 'CONSUMED'))) return false;
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0);
}

export { IRON_BLOOD_KNIGHT_ABILITIES } from './content.js';
export type * from './types.js';
