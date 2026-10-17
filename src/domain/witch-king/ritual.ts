import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { WitchKingAction } from './types.js';

/** This appointment, price and sealed preparation kit are an original G implementation. */
export const WITCH_KING_RITUAL_PRICE = 240;
export const WITCH_KING_EXPERT_ID = 'WK4-GRACE';
export const WITCH_KING_HALL_ID = 'WK4-HALL';
export const WITCH_KING_EXPERT_SOURCE = '原创G：格蕾丝·维尔，214岁的成年血族伯爵、序列4巫王，成年外貌；经原联系人艾琳介绍，自愿在自己原有的持照私人仪式厅监督。本作有限原人物，不把艾琳推定为半神，也不搬用原著人物。';
export const WITCH_KING_HALL_SOURCE = '原创G：贝克兰德持照私人仪式厅WK4-HALL，格蕾丝原本在此提供自愿监督；玩家沿普通道路和原厅门亲自出入，预约不传送任何人。';
export const WITCH_KING_RITUAL_BOUNDARY = '原著明确血族到序列4仍需晋升仪式；完整配方与完整仪式步骤尚未核实。本作专业指导方案G：独立付费预约、下一真实周亲自到原厅、原巫王实际准备、本人核验后自由选择服药。此流程不是原著完整仪式，不虚构新材料配方或真实月相门槛，也不是血族免仪式。';
export const WITCH_KING_RITUAL_CONSEQUENCE = '预约1行动、240便士，实际入厅及专业准备1行动，核验与结束0行动。每次服药实际耗尽本次独立原封装仪式包，失败同样耗尽；取消不退费，未用包留在实际供应方或原桌，不归玩家随身持有。旧场和旧包不能复用，下次须另付费并等待下一真实周。';

export interface WitchKingRitualExpert {
  id: string; name: string; age: number; adultAppearance: true; sequence: 4; source: string;
  alive: boolean; willing: boolean; location: 'WK4-HALL' | 'AWAY';
}
export interface WitchKingRitualKit {
  id: string; source: string; location: 'SUPPLIER' | 'TABLE' | 'MISSING';
  status: 'SEALED' | 'CONSUMED'; sealsIntact: boolean; consumedWeek: number | null;
}
export interface WitchKingRitualVisit {
  id: string; source: string; hallId: string; expertId: string; paidPennies: number;
  status: 'BOOKED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
  bookedWeek: number; plannedWeek: number; enteredWeek: number | null;
  preparedWeek: number | null; preparedById: string | null; checkedWeek: number | null;
  proceedConfirmed: boolean; windowWeek: number | null; closedWeek: number | null;
  consumedBottleId: string | null; kit: WitchKingRitualKit;
}
export interface WitchKingRitualState {
  playerLocation: 'OUTSIDE' | 'HALL'; activeVisitId: string | null;
  expert: WitchKingRitualExpert; visits: WitchKingRitualVisit[];
}
export type WitchKingRitualCommand =
  | { type: 'BOOK_RITUAL' | 'BEGIN_RITUAL' | 'END_RITUAL' | 'CANCEL_RITUAL' }
  | { type: 'CHECK_PREPARATION'; confirmed: true };
export interface WitchKingRitualVisitProjection {
  id: string; status: string; source: string; hallId: string; expertId: string; paidPennies: number;
  bookedWeek: number; plannedWeek: number; enteredWeek: number | null; preparedWeek: number | null;
  checkedWeek: number | null; windowWeek: number | null; closedWeek: number | null; consumedBottleId: string | null;
  kit: { id: string; source: string; location: string; status: string; sealsIntact: boolean; consumedWeek: number | null };
  summary: string;
}
export interface WitchKingRitualProjection {
  title: string; status: string; boundary: string; source: string; appointment: string; consequence: string;
  currentVisitId: string | null; playerLocation: string; windowOpen: boolean;
  expert: (Omit<WitchKingRitualExpert, 'location'> & { location: string }) | null;
  visits: WitchKingRitualVisitProjection[];
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const kitSource = (id: string) => `原创G持照仪式用品供应方：独立原封装准备包${id}，240便士预约含本次专业准备与该原包；完整组成未知，不提供真实药物或仪式配方。`;
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function freshVisit(number: number, week: number): WitchKingRitualVisit {
  const kitId = `WK4-KIT-${number}`;
  return {
    id: `WK4-RITUAL-${number}`, source: WITCH_KING_HALL_SOURCE, hallId: WITCH_KING_HALL_ID,
    expertId: WITCH_KING_EXPERT_ID, paidPennies: WITCH_KING_RITUAL_PRICE,
    status: 'BOOKED', bookedWeek: week, plannedWeek: week + 1, enteredWeek: null,
    preparedWeek: null, preparedById: null, checkedWeek: null, proceedConfirmed: false,
    windowWeek: null, closedWeek: null, consumedBottleId: null,
    kit: { id: kitId, source: kitSource(kitId), location: 'SUPPLIER', status: 'SEALED', sealsIntact: true, consumedWeek: null },
  };
}
export function createWitchKingRitualState(): WitchKingRitualState {
  return {
    playerLocation: 'OUTSIDE', activeVisitId: null, visits: [],
    expert: { id: WITCH_KING_EXPERT_ID, name: '格蕾丝·维尔', age: 214, adultAppearance: true, sequence: 4, source: WITCH_KING_EXPERT_SOURCE, alive: true, willing: true, location: WITCH_KING_HALL_ID },
  };
}
export function currentWitchKingVisit(s: SliceState): WitchKingRitualVisit | undefined {
  return s.witchKing.ritual.visits.find(visit => visit.id === s.witchKing.ritual.activeVisitId);
}
/** A waiting appointment does not prevent the player from living normally or advancing time. */
export function hasWitchKingRitualLock(s: SliceState): boolean {
  return currentWitchKingVisit(s)?.status === 'OPEN' && s.witchKing.ritual.playerLocation === 'HALL';
}
function expertIdentityMatches(expert: WitchKingRitualExpert): boolean {
  return record(expert) && shape(expert, ['id', 'name', 'age', 'adultAppearance', 'sequence', 'source', 'alive', 'willing', 'location'])
    && expert.id === WITCH_KING_EXPERT_ID && expert.name === '格蕾丝·维尔' && expert.age === 214
    && expert.adultAppearance === true && expert.sequence === 4 && expert.source === WITCH_KING_EXPERT_SOURCE
    && typeof expert.alive === 'boolean' && typeof expert.willing === 'boolean' && ['WK4-HALL', 'AWAY'].includes(expert.location);
}
function expertPresent(s: SliceState): boolean {
  const expert = s.witchKing.ritual.expert;
  return expertIdentityMatches(expert) && expert.alive && expert.willing && expert.location === WITCH_KING_HALL_ID;
}
function visitSourceMatches(visit: WitchKingRitualVisit): boolean {
  const number = /^WK4-RITUAL-([1-9]\d*)$/.exec(visit.id)?.[1];
  return !!number && visit.source === WITCH_KING_HALL_SOURCE && visit.hallId === WITCH_KING_HALL_ID
    && visit.expertId === WITCH_KING_EXPERT_ID && visit.paidPennies === WITCH_KING_RITUAL_PRICE
    && record(visit.kit) && shape(visit.kit, ['id', 'source', 'location', 'status', 'sealsIntact', 'consumedWeek'])
    && visit.kit.id === `WK4-KIT-${number}` && visit.kit.source === kitSource(visit.kit.id);
}
function originalKitReady(visit: WitchKingRitualVisit, location: 'SUPPLIER' | 'TABLE'): boolean {
  return visitSourceMatches(visit) && visit.kit.location === location && visit.kit.status === 'SEALED'
    && visit.kit.sealsIntact === true && visit.kit.consumedWeek === null;
}
export function canConsumeWitchKingRitual(s: SliceState): boolean {
  const visit = currentWitchKingVisit(s);
  return !!visit && s.witchKing.guidanceKnown && s.progression.pathwayId === 'moon' && [5, 4, 3].includes(s.progression.sequence ?? 0)
    && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && !s.combat
    && s.world.city === 'BACKLUND' && s.witchKing.ritual.playerLocation === 'HALL' && expertPresent(s)
    && visit.status === 'OPEN' && visit.bookedWeek < s.week && visit.plannedWeek === visit.bookedWeek + 1
    && visit.enteredWeek === s.week && visit.preparedWeek === s.week && visit.preparedById === WITCH_KING_EXPERT_ID
    && visit.checkedWeek === s.week && visit.proceedConfirmed && visit.windowWeek === s.week
    && visit.closedWeek === null && visit.consumedBottleId === null && originalKitReady(visit, 'TABLE');
}
/** Closing never restores an old kit, moves Grace, refunds money or heals the player. */
export function closeWitchKingRitual(s: SliceState, bottleId: string | null = null): void {
  const ritual = s.witchKing.ritual, visit = currentWitchKingVisit(s);
  if (!visit) return;
  rule(visit.status === 'BOOKED' || visit.status === 'OPEN', '本次专业准备已经结束。');
  if (bottleId !== null) {
    rule(canConsumeWitchKingRitual(s), '须本人仍在本周原厅、原巫王当前自愿监督的实际准备窗口内服药。');
    const bottle = s.witchKing.bottles.find(value => value.id === bottleId);
    rule(bottle?.status === 'CONSUMED' && bottle.consumedWeek === s.week && bottle.ritualId === visit.id && bottle.ritualWindowWeek === visit.windowWeek,
      '须先实际耗尽绑定本次窗口的同一原瓶，不能只填写瓶号。');
    visit.kit.status = 'CONSUMED'; visit.kit.sealsIntact = false; visit.kit.consumedWeek = s.week;
  }
  visit.status = visit.status === 'BOOKED' ? 'CANCELLED' : 'CLOSED';
  visit.closedWeek = s.week; visit.consumedBottleId = bottleId;
  ritual.playerLocation = 'OUTSIDE'; ritual.activeVisitId = null;
}
export function validateWitchKingRitualCommand(value: unknown): value is WitchKingRitualCommand {
  if (!record(value)) return false;
  if (value.type === 'CHECK_PREPARATION') return shape(value, ['type', 'confirmed']) && value.confirmed === true;
  return ['BOOK_RITUAL', 'BEGIN_RITUAL', 'END_RITUAL', 'CANCEL_RITUAL'].includes(String(value.type)) && shape(value, ['type']);
}
export const isWitchKingRitualCommand = validateWitchKingRitualCommand;
export function blockWitchKingRitualCommand(s: SliceState, command: WitchKingRitualCommand): string | null {
  if (!validateWitchKingRitualCommand(command)) return '仪式命令无效；核验后须明确选择继续，不可输入专家意愿或材料替换。';
  const visit = currentWitchKingVisit(s);
  if (command.type === 'CANCEL_RITUAL' || command.type === 'END_RITUAL') return visit && ['BOOKED', 'OPEN'].includes(visit.status) ? null : '没有待取消的预约或本人仍在场的仪式。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，身体与精神能够行动。';
  if (s.progression.pathwayId !== 'moon' || s.progression.sequence !== 5 || s.crimsonScholar.promotionWeek === null || !s.witchKing.guidanceKnown) return '须成为深红学者并通过原联系人了解巫王专业准备方案G。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际回到贝克兰德原仪式厅所在城区。';
  if (s.crimsonScholar.ritual.activeVisitId !== null || s.crimsonScholar.practice.field !== 'NONE' || s.crimsonScholar.practice.location !== 'START'
    || Object.values(s.crimsonScholar.cases).some(scene => scene.contactOpen || scene.status === 'PREPARED')
    || Object.values(s.potionProfessor.cases).some(scene => scene.contactOpen || scene.status === 'PREPARED')
    || Object.values(s.potionProfessor.laboratory.effects).some(Boolean) || s.tamer.companionId !== null) return '先实际结束旧深红学者现场、月效并沿原路返回，不能隔空赴厅。';
  if (!expertPresent(s)) return '原格蕾丝须当前存活、自愿且实际在WK4-HALL；旧约定不能替代当前意愿与在场，也不能召来、复活或强迫她。';
  if (command.type === 'BOOK_RITUAL') {
    if (visit) return '已有待赴约或正在进行的本次仪式，先0行动取消或实际退出。';
    if (!s.witchKing.bottles.some(bottle => bottle.status === 'PLAYER')) return '须先实际持有一瓶巫王成品原瓶，再预约本次专业准备。';
    if (s.actionsRemaining < 1) return '安排本次独立原包与专家预约需要1行动。';
    return s.cash < WITCH_KING_RITUAL_PRICE ? '本次原包与专业准备预约需要240便士，取消不退费。' : null;
  }
  if (!visit) return '先实际付费预约独立原包，旧场与旧包不能复用。';
  if (command.type === 'BEGIN_RITUAL') {
    if (visit.status !== 'BOOKED') return '本次已实际入厅，不能重复进入或重置原包。';
    if (s.week < visit.plannedWeek) return `须到下一真实周，第${visit.plannedWeek}周起才能亲自赴原厅。`;
    if (!originalKitReady(visit, 'SUPPLIER')) return '本次供应方原包须仍实际存在、来源吻合且封条完好；旧包、失踪包或破封包不能替代。';
    if (!s.witchKing.bottles.some(bottle => bottle.status === 'PLAYER')) return '须仍实际持有可服原瓶，也可0行动取消本次预约。';
    return s.actionsRemaining < 1 ? '沿普通道路实际入厅并由原巫王亲自准备需要1行动。' : null;
  }
  if (visit.status !== 'OPEN' || s.witchKing.ritual.playerLocation !== 'HALL' || visit.enteredWeek !== s.week
    || visit.preparedWeek !== s.week || visit.preparedById !== WITCH_KING_EXPERT_ID) return '须本人本周实际在原厅，且同一原巫王已亲自完成本次专业准备。';
  if (!originalKitReady(visit, 'TABLE')) return '须本次原桌上的同一封装包仍实际存在、来源正确且封条完好；不能虚填材料或取回旧包。';
  return visit.checkedWeek !== null || visit.windowWeek !== null ? '本次已核验并选择继续，可另行确认服药或0行动沿原路离场。' : null;
}
export function applyWitchKingRitualCommand(s: SliceState, command: WitchKingRitualCommand, context: SeerContext): void {
  rule(validateWitchKingRitualCommand(command), '仪式命令无效；核验须明确选择继续。');
  const blocked = blockWitchKingRitualCommand(s, command); rule(blocked === null, blocked ?? '当前无法继续专业准备。');
  const ritual = s.witchKing.ritual;
  if (command.type === 'BOOK_RITUAL') {
    const visit = freshVisit(ritual.visits.length + 1, s.week);
    s.actionsRemaining -= 1; s.cash -= WITCH_KING_RITUAL_PRICE; ritual.visits.push(visit); ritual.activeVisitId = visit.id;
    context.note('付费预约原巫王与独立原包', `1行动、240便士。原格蕾丝当前存活、自愿并在${WITCH_KING_HALL_ID}，约定第${visit.plannedWeek}周起亲自到访；她没有被召到玩家身旁。${visit.kit.id}已实际独立封存于供应方，尚未消耗、未交入玩家行囊。预约不锁普通生活，也不产生服药窗口。${WITCH_KING_RITUAL_BOUNDARY}`); return;
  }
  const visit = currentWitchKingVisit(s)!;
  if (command.type === 'BEGIN_RITUAL') {
    s.actionsRemaining -= 1; ritual.playerLocation = 'HALL'; visit.status = 'OPEN'; visit.enteredWeek = s.week;
    visit.kit.location = 'TABLE'; visit.preparedWeek = s.week; visit.preparedById = ritual.expert.id;
    context.note('本人赴原厅，原巫王亲自准备', `1行动，沿普通道路与原门进入${visit.hallId}。当前存活且自愿的格蕾丝本人实际在厅，接收本次同一原包${visit.kit.id}至原桌并实施本作G专业准备；原封装尚未耗尽。完整原著步骤未知，此准备不冒称原著全仪式；仍须本人0行动核验原人、来源与封条后自由选择继续，也能立即0行动离开。`); return;
  }
  if (command.type === 'CHECK_PREPARATION') {
    visit.checkedWeek = s.week; visit.proceedConfirmed = true; visit.windowWeek = s.week;
    context.note('核验当场原人原包后自由选择继续', `0行动。当前原巫王${ritual.expert.id}仍活着、自愿并在${visit.hallId}；她本周亲自准备的原包${visit.kit.id}确在原桌，来源与封条均吻合。本人明确选择继续，仅第${s.week}周仍在此厅、原人仍在场且自愿时可另行确认服一原瓶；没有仪式随机检定。${WITCH_KING_RITUAL_CONSEQUENCE}${WITCH_KING_RITUAL_BOUNDARY}`); return;
  }
  const wasBooked = visit.status === 'BOOKED'; closeWitchKingRitual(s);
  context.note(wasBooked ? '取消本次预约，原包留在供应方' : '沿原厅门与普通道路实际退出', `0行动，本次${visit.id}结束，窗口关闭，本人在厅外。240便士不退；原瓶不耗，未用${visit.kit.id}仍${visit.kit.location === 'SUPPLIER' ? '在供应方' : visit.kit.location === 'TABLE' ? '在原厅桌上' : '失踪，未被恢复'}，不进入玩家库存。原格蕾丝的当前生死、意愿与位置不变；离场不恢复身心灵性。下次须另付费取得全新原包并等下一真实周。`);
}
export function witchKingRitualActions(s: SliceState): WitchKingAction[] {
  if (!s.witchKing.guidanceKnown) return [];
  const visit = currentWitchKingVisit(s), actions: WitchKingAction[] = [];
  const add = (id: string, label: string, cost: string, command: WitchKingRitualCommand) => {
    const reason = blockWitchKingRitualCommand(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!visit && s.progression.pathwayId === 'moon' && s.progression.sequence === 5) add('book-witch-king-ritual', '预约原巫王与本次独立原包', '1行动 · 240便士 · 下一真实周亲自赴厅', { type: 'BOOK_RITUAL' });
  if (visit?.status === 'BOOKED') add('begin-witch-king-ritual', '亲自赴原厅，请原巫王当场准备', `1行动 · 第${visit.plannedWeek}周起 · 当前存活、自愿与在场`, { type: 'BEGIN_RITUAL' });
  if (visit?.status === 'OPEN' && visit.checkedWeek === null) add('check-witch-king-preparation', '核验原人原包，明确选择继续', '0行动 · 不随机 · 仍可退出 · 服药须另行确认', { type: 'CHECK_PREPARATION', confirmed: true });
  if (visit) add('end-witch-king-ritual', visit.status === 'BOOKED' ? '取消预约，原包留在供应方' : '沿原路实际离开，关闭本次窗口', '0行动 · 不退费 · 不耗原瓶 · 不恢复或带走原包', { type: visit.status === 'BOOKED' ? 'CANCEL_RITUAL' : 'END_RITUAL' });
  return actions;
}
export function projectWitchKingRitual(s: SliceState): WitchKingRitualProjection {
  const known = s.witchKing.guidanceKnown, ritual = s.witchKing.ritual, visit = known ? currentWitchKingVisit(s) : undefined;
  return {
    title: '原巫王当场监督的专业准备G',
    status: !known ? '尚未了解巫王专业准备' : !visit ? '没有当前仪式，旧场与旧包不提供新窗口' : visit.status === 'BOOKED' ? '已付费预约，等待下一真实周亲自赴厅' : canConsumeWitchKingRitual(s) ? '本人本周在原厅，当前原人原包符合服药窗口' : visit.checkedWeek === null ? '已实际准备，须核验当前原人、原包与封条并选择继续' : '当前原人、原包或本人条件已变化，窗口不可用；可0行动退出',
    boundary: known ? WITCH_KING_RITUAL_BOUNDARY : '', source: known ? WITCH_KING_HALL_SOURCE : '', consequence: known ? WITCH_KING_RITUAL_CONSEQUENCE : '',
    appointment: !visit ? '没有当前预约。' : `第${visit.bookedWeek}周支付240便士，第${visit.plannedWeek}周起可赴原厅；${visit.enteredWeek === null ? '本人仍在厅外，普通生活与推进时间可用。' : `第${visit.enteredWeek}周本人实际入厅，继续普通生活前须0行动沿原路离开。`}`,
    currentVisitId: visit?.id ?? null, playerLocation: visit?.status === 'OPEN' ? `本人在${WITCH_KING_HALL_ID}原厅内` : '本人在原厅外',
    windowOpen: known && canConsumeWitchKingRitual(s),
    expert: known ? { ...ritual.expert, location: ritual.expert.location === WITCH_KING_HALL_ID ? `${WITCH_KING_HALL_ID}原厅内` : '当前不在原厅，不能以旧到访记录替代' } : null,
    visits: known ? ritual.visits.map(value => ({
      id: value.id, status: value.status === 'BOOKED' ? '已预约，未入厅' : value.status === 'OPEN' ? '本人当前在场' : value.status === 'CANCELLED' ? '已取消，未入厅' : '已实际结束并退出',
      source: value.source, hallId: value.hallId, expertId: value.expertId, paidPennies: value.paidPennies,
      bookedWeek: value.bookedWeek, plannedWeek: value.plannedWeek, enteredWeek: value.enteredWeek, preparedWeek: value.preparedWeek,
      checkedWeek: value.checkedWeek, windowWeek: value.windowWeek, closedWeek: value.closedWeek, consumedBottleId: value.consumedBottleId,
      kit: { ...value.kit, location: value.kit.location === 'SUPPLIER' ? '原供应方' : value.kit.location === 'TABLE' ? `${value.hallId}原桌` : '当前失踪，未恢复', status: value.kit.status === 'CONSUMED' ? '原包已耗尽，不能复用' : value.kit.sealsIntact ? '原封装未用，封条完好' : '原封装未用但封条已损，不合格' },
      summary: `第${value.bookedWeek}周付240便士；${value.enteredWeek === null ? '从未入厅' : `第${value.enteredWeek}周本人到原厅，由原格蕾丝当场专业准备G`}；${value.checkedWeek === null ? '未核验继续' : `第${value.checkedWeek}周核验后自由选择继续`}；${value.consumedBottleId === null ? '未服原瓶，未用包留在原实际位置' : `原瓶${value.consumedBottleId}与同一原包${value.kit.id}均已实际耗尽`}；${value.closedWeek === null ? '本场未结束' : `第${value.closedWeek}周已结束，旧窗口不可再用`}。过往到场记录不证明专家当前仍在场或自愿。`,
    })) : [],
  };
}

/** Validate finite original provenance and chronology without making past visits depend on current consent. */
export function validateWitchKingRitualState(s: SliceState): boolean {
  const raw: unknown = s.witchKing.ritual;
  if (!record(raw) || !shape(raw, ['playerLocation', 'activeVisitId', 'expert', 'visits']) || !['OUTSIDE', 'HALL'].includes(String(raw.playerLocation))
    || !Array.isArray(raw.visits) || !expertIdentityMatches(raw.expert as WitchKingRitualExpert)) return false;
  if (raw.activeVisitId !== null && typeof raw.activeVisitId !== 'string') return false;
  const ritual = raw as unknown as WitchKingRitualState, week = (value: unknown) => integer(value, 1, s.week);
  if (ritual.visits.length && (!s.witchKing.guidanceKnown || s.progression.pathwayId !== 'moon' || ![5, 4, 3, 2].includes(s.progression.sequence ?? 0) || !week(s.crimsonScholar.promotionWeek))) return false;
  if (s.progression.sequence === 2 && ritual.activeVisitId !== null) return false;
  let active: WitchKingRitualVisit | undefined;
  const usedBottles = new Set<string>();
  for (const [index, visit] of ritual.visits.entries()) {
    if (!record(visit) || !shape(visit, ['id', 'source', 'hallId', 'expertId', 'paidPennies', 'status', 'bookedWeek', 'plannedWeek', 'enteredWeek', 'preparedWeek', 'preparedById', 'checkedWeek', 'proceedConfirmed', 'windowWeek', 'closedWeek', 'consumedBottleId', 'kit'])) return false;
    if (visit.id !== `WK4-RITUAL-${index + 1}` || !visitSourceMatches(visit) || !['BOOKED', 'OPEN', 'CLOSED', 'CANCELLED'].includes(visit.status)
      || !week(visit.bookedWeek) || visit.bookedWeek < s.crimsonScholar.promotionWeek! || visit.plannedWeek !== visit.bookedWeek + 1) return false;
    if (s.witchKing.promotionWeek !== null && visit.bookedWeek > s.witchKing.promotionWeek) return false;
    if (!s.witchKing.bottles.some(bottle => week(bottle.acquiredWeek) && bottle.acquiredWeek! <= visit.bookedWeek && (bottle.consumedWeek === null || bottle.consumedWeek >= visit.bookedWeek))) return false;
    if (index > 0 && (ritual.visits[index - 1]!.closedWeek === null || ritual.visits[index - 1]!.closedWeek! > visit.bookedWeek)) return false;
    const entered = visit.status === 'OPEN' || visit.status === 'CLOSED', closed = visit.status === 'CANCELLED' || visit.status === 'CLOSED';
    if (entered ? !week(visit.enteredWeek) || visit.enteredWeek! < visit.plannedWeek || visit.preparedWeek !== visit.enteredWeek || visit.preparedById !== WITCH_KING_EXPERT_ID
      : visit.enteredWeek !== null || visit.preparedWeek !== null || visit.preparedById !== null) return false;
    if (closed ? !week(visit.closedWeek) || visit.closedWeek! < visit.bookedWeek : visit.closedWeek !== null) return false;
    if (visit.status === 'OPEN' && visit.enteredWeek !== s.week || visit.status === 'CLOSED' && visit.closedWeek !== visit.enteredWeek) return false;
    if (!closed) { if (active || index !== ritual.visits.length - 1) return false; active = visit; }
    if (typeof visit.proceedConfirmed !== 'boolean' || typeof visit.kit.sealsIntact !== 'boolean' || !['SUPPLIER', 'TABLE', 'MISSING'].includes(visit.kit.location)) return false;
    if (visit.checkedWeek === null) {
      if (visit.proceedConfirmed || visit.windowWeek !== null || visit.consumedBottleId !== null) return false;
    } else if (!entered || visit.checkedWeek !== visit.enteredWeek || !visit.proceedConfirmed || visit.windowWeek !== visit.checkedWeek) return false;
    if (visit.kit.location !== 'MISSING' && visit.kit.location !== (entered ? 'TABLE' : 'SUPPLIER')) return false;
    if (visit.consumedBottleId === null) {
      if (visit.kit.status !== 'SEALED' || visit.kit.consumedWeek !== null) return false;
    } else {
      if (typeof visit.consumedBottleId !== 'string' || usedBottles.has(visit.consumedBottleId) || visit.status !== 'CLOSED' || visit.windowWeek === null
        || visit.kit.status !== 'CONSUMED' || visit.kit.sealsIntact || visit.kit.location !== 'TABLE' || visit.kit.consumedWeek !== visit.closedWeek) return false;
      const bottle = s.witchKing.bottles.find(value => value.id === visit.consumedBottleId);
      if (!bottle || bottle.status !== 'CONSUMED' || bottle.consumedWeek !== visit.closedWeek || bottle.ritualId !== visit.id || bottle.ritualWindowWeek !== visit.windowWeek) return false;
      usedBottles.add(visit.consumedBottleId);
    }
  }
  if (ritual.activeVisitId !== (active?.id ?? null) || ritual.playerLocation !== (active?.status === 'OPEN' ? 'HALL' : 'OUTSIDE')) return false;
  if (active?.status === 'OPEN' && (s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0)) return false;
  return true;
}
