/** Isolated, deterministic town-ritual prototype. No repository/runtime imports.
 * Numbers, names, species and timing below are internal game defaults, not canon.
 * Host facts are supplied by the trusted transaction adapter, never by the UI. */
export const SITE_IDS = ['quarry', 'reed-cave', 'ash-grove', 'salt-vault', 'rain-ruin', 'hollow-bank'] as const;
export const FACILITY_IDS = ['mill', 'bakery', 'workshop', 'clinic', 'post', 'market'] as const;
export const PLOT_IDS = ['new-alder-clearing', 'new-flint-clearing'] as const;
export const RESERVE_IDS = ['quarry-reserve', 'reed-reserve', 'ash-reserve', 'salt-reserve', 'rain-reserve', 'hollow-reserve'] as const;
export type SiteId = typeof SITE_IDS[number];
export type FacilityId = typeof FACILITY_IDS[number];
export type PlotId = typeof PLOT_IDS[number];
export type ReserveId = typeof RESERVE_IDS[number];
export type Place = SiteId | PlotId | ReserveId | 'base';
export type PhaseId = 'reserve-phase-3' | 'reserve-phase-4';
export type Material = 'timber' | 'stone' | 'grain' | 'herbs' | 'ore' | 'paper' | 'ink' | 'flour' | 'bread' | 'tools' | 'salt' | 'cloth';
export type Goods = Record<Material, number>;
export type VisitorId = 'merchant-ada' | 'courier-neri' | 'weaver-iven';
export type Purpose = 'GOODS' | 'LETTER' | 'TRADE';
export interface HostFacts {
  week: number; active: boolean; sequence: 2 | 1; health: number; mind: number;
  spirituality: number; cash: number; actions: number;
  /** Live worms outside this town, including split but unassigned worms. */
  externalLiveWorms: number; controlPower: number; die: number | null;
}
export interface Cost { actions: number; cash: number; spirituality: number; mind: number; health: number; pollution: number }
export interface Original {
  id: string; bodyId: string; site: SiteId; species: string; nature: 'LIVING_NONHUMAN_HUMANOID_SUPERNATURAL';
  resistance: number; health: number; alive: boolean; status: 'WILD' | 'INITIAL_CONTROL' | 'CONTROLLED' | 'INERT' | 'DEAD';
  location: Place; surveyedWeek: number | null; attemptedWeek: number | null; initialControlWeek: number | null;
  convertedWeek: number | null; wormId: string | null; facility: FacilityId | null;
  fatigue: number; earnings: number; workCount: number; fateIds: string[];
  controlHistory: { week: number; startSecond: number; seconds: number; step: 'INITIAL' | 'CONTINUE'; success: boolean }[];
}
export interface Facility { id: FacilityId; builtWeek: number | null; location: PlotId | null; staff: string[]; condition: number; output: number }
export interface Worm { id: string; originalId: string; status: 'ASSIGNED' | 'RECALLED' | 'LOST' }
export interface Visitor {
  id: VisitorId; bodyId: string; age: number; human: true; alive: true; controlled: false; purpose: Purpose;
  location: PlotId | 'outside'; trust: number; receivedBread: number; receivedTools: number;
  stockIds: string[]; spentStockIds: string[]; deliveredLetters: string[];
  consent: { epoch: number; week: number; purpose: Purpose; status: 'GRANTED' | 'REFUSED' | 'USED' | 'WITHDRAWN' } | null;
}
export interface Letter { id: string; authorId: string; intendedRecipient: string; holder: 'post' | VisitorId | 'recipient'; dueWeek: number | null; deliveredWeek: number | null; epoch: number; createdWeek: number; content: string }
export interface Fate {
  id: string; phaseId: string; eventIndex: number; epoch: number; week: number; plot: PlotId; choice: 'FULFILL' | 'CUT_CORNERS';
  participants: string[]; facilities: FacilityId[]; input: Partial<Goods>; output: Partial<Goods>;
  effects: { originalId: string; task: string; fatigueDelta: number; earningsDelta: number; healthDelta: number }[];
  links: [string, string][];
}
export interface ExternalInteraction {
  id: string; epoch: number; week: number; visitorId: VisitorId; purpose: Purpose; plot: PlotId;
  townOriginalIds: string[]; exported: Partial<Goods>; importedObjectId: string | null;
  letterId: string | null; completedWeek: number | null;
}
export interface Region { id: string; epoch: number; plot: PlotId; formedWeek: number; lastVerifiedWeek: number; fateIds: string[]; interactionIds: string[] }
export interface Role { id: string; facilityId: FacilityId; currentOriginalId: string; occupancyHistory: { originalId: string; week: number }[] }
export interface Phase { id: 'initial' | PhaseId; status: 'COMMISSIONED' | 'LOADED' | 'DELIVERED' | 'ACTIVE' | 'ABANDONED' | 'COMPLETED'; commissionedWeek: number; activatedWeek: number | null; deliveredWeek: number | null; epoch: number; roster: string[]; nextEvent: number; limit: number }
export const PHASE_SUPPLIES: Partial<Goods> = { timber: 4, grain: 8, herbs: 8, ore: 8, paper: 6, ink: 6 };
export interface TownState {
  schema: 1; originWeek: number; lastObservedWeek: number; operatorAt: Place; epoch: number;
  surveyedPlots: PlotId[]; plot: PlotId | null; foundedWeek: number | null;
  proofSinceWeek: number | null; controlElapsedSeconds: number; roles: Role[];
  plotHistory: { id: PlotId; everSettled: boolean; regionId: string | null }[];
  replacements: { sourceId: ReserveId; roleId: string; oldOriginalId: string; commissionedWeek: number; verifiedWeek: number | null; originalId: string | null }[];
  phases: Phase[]; activePhaseId: 'initial' | PhaseId;
  cart: { id: 'town-cart-1'; hired: boolean; holder: 'SUPPLIER' | 'PLAYER'; location: Place; capacityKg: 600; goods: Goods; cargo: { id: string; phaseId: PhaseId | null; goods: Goods }[] };
  cargoReceipts: { id: string; unloadedWeek: number; plot: PlotId; goods: Goods }[];
  relocations: { week: number; from: PlotId; to: PlotId; status: 'FAILED' | 'COMPLETED'; repairedWeek: number | null; damage: { facilityId: FacilityId; amount: number; beforeCondition: number }[] }[];
  sites: { id: SiteId; surveyedWeek: number | null }[]; originals: Original[]; facilities: Facility[];
  goods: Goods; boughtLots: string[]; worms: Worm[]; visitors: Visitor[]; letters: Letter[];
  fates: Fate[]; interactions: ExternalInteraction[]; region: Region | null; retiredRegions: Region[];
  journeys: { week: number; from: Place | 'outside'; to: Place | 'outside'; metres: number; bodyIds: string[]; objectIds: string[] }[];
  journal: { command: TownCommand; host: HostFacts; cost: Cost }[];
}
export type TownCommand =
  | { type: 'TRAVEL'; to: Place }
  | { type: 'SURVEY_SITE'; siteId: SiteId }
  | { type: 'SURVEY_PLOT'; plotId: PlotId }
  | { type: 'BUY_LOT'; lotId: string }
  | { type: 'BEGIN_CONTROL' | 'ASSIGN_WORM' | 'TRANSPORT' | 'RECALL_WORM' | 'RELEASE_INITIAL'; originalId: string }
  | { type: 'CONVERT'; originalId: string; confirmedIrreversibleDeath: true }
  | { type: 'END_CONTROL'; originalId: string; confirmedLoss: true }
  | { type: 'BUILD'; facilityId: FacilityId }
  | { type: 'STAFF'; originalId: string; facilityId: FacilityId }
  | { type: 'FOUND' | 'FORM_REGION' | 'REVERIFY_REGION' | 'HIRE_CART' | 'UNLOAD_CART' | 'REPAIR_RELOCATION' }
  | { type: 'COMMISSION_REPLACEMENT'; roleId: string; sourceId: ReserveId }
  | { type: 'VERIFY_REPLACEMENT'; sourceId: ReserveId }
  | { type: 'OCCUPY_ROLE'; roleId: string; originalId: string }
  | { type: 'COMMISSION_PHASE' | 'VERIFY_PHASE_SUPPLY'; phaseId: PhaseId }
  | { type: 'START_PHASE'; phaseId: PhaseId; confirmedAbandon: true }
  | { type: 'LIVE_WEEK'; eventIndex: number; choice: 'FULFILL' | 'CUT_CORNERS' }
  | { type: 'MEET_VISITOR' | 'EXCHANGE' | 'WITHDRAW_VISITOR' | 'SEND_VISITOR_HOME'; visitorId: VisitorId }
  | { type: 'CONFIRM_DELIVERY'; letterId: string }
  | { type: 'MOVE_TOWN'; plotId: PlotId; confirmedBrokenLinks: true };

const MATERIALS: Material[] = ['timber', 'stone', 'grain', 'herbs', 'ore', 'paper', 'ink', 'flour', 'bread', 'tools', 'salt', 'cloth'];
const SPECIES = ['stone-horn strider', 'reed-faced lurker', 'ash-skin stalker', 'salt-eyed crawler', 'rain-hollow watcher', 'hollow-bark prowler'];
const VISITORS: { id: VisitorId; age: number; purpose: Purpose }[] = [
  { id: 'merchant-ada', age: 34, purpose: 'GOODS' }, { id: 'courier-neri', age: 29, purpose: 'LETTER' }, { id: 'weaver-iven', age: 52, purpose: 'TRADE' },
];
export const LOTS: readonly { id: string; price: number; goods: Partial<Goods> }[] = [
  { id: 'timber-stack-1', price: 96, goods: { timber: 28 } }, { id: 'stone-stack-1', price: 48, goods: { stone: 12 } },
  { id: 'grain-sacks-1', price: 36, goods: { grain: 32 } }, { id: 'herb-box-1', price: 24, goods: { herbs: 16 } },
  { id: 'ore-crate-1', price: 36, goods: { ore: 20 } }, { id: 'post-case-1', price: 24, goods: { paper: 12, ink: 12 } },
];
const emptyGoods = (): Goods => Object.fromEntries(MATERIALS.map(k => [k, 0])) as Goods;
const zeroCost = (): Cost => ({ actions: 0, cash: 0, spirituality: 0, mind: 0, health: 0, pollution: 0 });
const fail = (message: string): never => { throw new Error(message); };
const ensure = (condition: unknown, message: string): void => { if (!condition) fail(message); };
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join('|') === keys.sort().join('|');
const places: readonly string[] = ['base', ...SITE_IDS, ...PLOT_IDS, ...RESERVE_IDS];
const originalIds = Array.from({ length: 24 }, (_, i) => `town-being-${String(i + 1).padStart(2, '0')}`);
const reserveOriginalIds = RESERVE_IDS.map(id => `town-being-${id}-01`);
const roleIds = Array.from({ length: 24 }, (_, i) => `resident-slot-${String(i + 1).padStart(2, '0')}`);
const phases: PhaseId[] = ['reserve-phase-3', 'reserve-phase-4'];
/** Metre coordinates in one bounded district; every pair is below 1,000 m. */
export const COORDINATES: Record<Place, readonly [number, number]> = {
  base: [0, 0], quarry: [-180, 60], 'reed-cave': [-120, 160], 'ash-grove': [40, 200], 'salt-vault': [160, 100], 'rain-ruin': [180, -80], 'hollow-bank': [-80, -180],
  'new-alder-clearing': [60, 40], 'new-flint-clearing': [-40, 60], 'quarry-reserve': [-200, 60], 'reed-reserve': [-120, 180], 'ash-reserve': [40, 220],
  'salt-reserve': [180, 100], 'rain-reserve': [200, -80], 'hollow-reserve': [-80, -200],
};
const distance = (a: Place, b: Place) => Math.ceil(Math.hypot(COORDINATES[a][0] - COORDINATES[b][0], COORDINATES[a][1] - COORDINATES[b][1]));
const WEIGHT: Goods = { timber: 3, stone: 4, grain: 3, herbs: 1, ore: 2, paper: 1, ink: 1, flour: 1, bread: 1, tools: 2, salt: 1, cloth: 1 };
export const cargoWeight = (g: Goods): number => MATERIALS.reduce((sum, key) => sum + g[key] * WEIGHT[key], 0);
const currentOriginalIds = (s: TownState) => s.roles.map(r => r.currentOriginalId);
const roleOriginal = (s: TownState, index: number): string => s.roles[index]!.currentOriginalId;

export function createTownState(originWeek: number): TownState {
  ensure(integer(originWeek, 1), 'Invalid origin week.');
  return {
    schema: 1, originWeek, lastObservedWeek: originWeek, operatorAt: 'base', epoch: 0, surveyedPlots: [], plot: null, foundedWeek: null,
    proofSinceWeek: null, controlElapsedSeconds: 0,
    roles: roleIds.map((id, i) => ({ id, facilityId: FACILITY_IDS[Math.floor(i / 4)]!, currentOriginalId: originalIds[i]!, occupancyHistory: [{ originalId: originalIds[i]!, week: originWeek }] })),
    plotHistory: PLOT_IDS.map(id => ({ id, everSettled: false, regionId: null })), replacements: [],
    phases: [{ id: 'initial', status: 'ACTIVE', commissionedWeek: originWeek, activatedWeek: null, deliveredWeek: null, epoch: 0, roster: [], nextEvent: 0, limit: 24 }], activePhaseId: 'initial',
    cart: { id: 'town-cart-1', hired: false, holder: 'SUPPLIER', location: 'base', capacityKg: 600, goods: emptyGoods(), cargo: [] }, cargoReceipts: [], relocations: [],
    sites: SITE_IDS.map(id => ({ id, surveyedWeek: null })),
    originals: originalIds.map((id, i) => ({ id, bodyId: `${id}:body`, site: SITE_IDS[Math.floor(i / 4)]!, species: SPECIES[Math.floor(i / 4)]!,
      nature: 'LIVING_NONHUMAN_HUMANOID_SUPERNATURAL', resistance: 28 + i, health: 100, alive: true, status: 'WILD', location: SITE_IDS[Math.floor(i / 4)]!,
      surveyedWeek: null, attemptedWeek: null, initialControlWeek: null, convertedWeek: null, wormId: null, facility: null, fatigue: 0, earnings: 0, workCount: 0, fateIds: [], controlHistory: [] })),
    facilities: FACILITY_IDS.map(id => ({ id, builtWeek: null, location: null, staff: [], condition: 0, output: 0 })),
    goods: emptyGoods(), boughtLots: [], worms: [],
    visitors: VISITORS.map(v => ({ ...v, bodyId: `${v.id}:body`, human: true, alive: true, controlled: false, location: 'outside', trust: 0, receivedBread: 0, receivedTools: 0,
      stockIds: v.purpose === 'LETTER' ? [] : [`${v.id}:original-stock-1`, `${v.id}:original-stock-2`], spentStockIds: [], deliveredLetters: [], consent: null })),
    letters: [], fates: [], interactions: [], region: null, retiredRegions: [], journeys: [], journal: [],
  };
}

export function validateTownCommand(value: unknown): value is TownCommand {
  if (!record(value) || typeof value.type !== 'string') return false;
  const c = value;
  if (['FOUND', 'FORM_REGION', 'REVERIFY_REGION', 'HIRE_CART', 'UNLOAD_CART', 'REPAIR_RELOCATION'].includes(c.type as string)) return exact(c, ['type']);
  if (c.type === 'COMMISSION_REPLACEMENT') return exact(c, ['type', 'roleId', 'sourceId']) && roleIds.includes(String(c.roleId)) && RESERVE_IDS.includes(c.sourceId as ReserveId);
  if (c.type === 'VERIFY_REPLACEMENT') return exact(c, ['type', 'sourceId']) && RESERVE_IDS.includes(c.sourceId as ReserveId);
  if (c.type === 'OCCUPY_ROLE') return exact(c, ['type', 'roleId', 'originalId']) && roleIds.includes(String(c.roleId)) && reserveOriginalIds.includes(String(c.originalId));
  if (['COMMISSION_PHASE', 'VERIFY_PHASE_SUPPLY'].includes(String(c.type))) return exact(c, ['type', 'phaseId']) && phases.includes(c.phaseId as PhaseId);
  if (c.type === 'START_PHASE') return exact(c, ['type', 'phaseId', 'confirmedAbandon']) && phases.includes(c.phaseId as PhaseId) && c.confirmedAbandon === true;
  if (c.type === 'TRAVEL') return exact(c, ['type', 'to']) && places.includes(String(c.to));
  if (c.type === 'SURVEY_SITE') return exact(c, ['type', 'siteId']) && SITE_IDS.includes(c.siteId as SiteId);
  if (c.type === 'SURVEY_PLOT') return exact(c, ['type', 'plotId']) && PLOT_IDS.includes(c.plotId as PlotId);
  if (c.type === 'MOVE_TOWN') return exact(c, ['type', 'plotId', 'confirmedBrokenLinks']) && PLOT_IDS.includes(c.plotId as PlotId) && c.confirmedBrokenLinks === true;
  if (c.type === 'BUY_LOT') return exact(c, ['type', 'lotId']) && LOTS.some(l => l.id === c.lotId);
  if (c.type === 'BUILD') return exact(c, ['type', 'facilityId']) && FACILITY_IDS.includes(c.facilityId as FacilityId);
  if (c.type === 'LIVE_WEEK') return exact(c, ['type', 'eventIndex', 'choice']) && integer(c.eventIndex, 0, 23) && ['FULFILL', 'CUT_CORNERS'].includes(String(c.choice));
  if (['MEET_VISITOR', 'EXCHANGE', 'WITHDRAW_VISITOR', 'SEND_VISITOR_HOME'].includes(c.type as string)) return exact(c, ['type', 'visitorId']) && VISITORS.some(v => v.id === c.visitorId);
  if (c.type === 'CONFIRM_DELIVERY') return exact(c, ['type', 'letterId']) && typeof c.letterId === 'string' && /^(town-letter-(4|10|16|22)|reserve-phase-[34]:letter-(4|10))$/.test(c.letterId);
  if (![...originalIds, ...reserveOriginalIds].includes(String(c.originalId))) return false;
  if (c.type === 'CONVERT') return exact(c, ['type', 'originalId', 'confirmedIrreversibleDeath']) && c.confirmedIrreversibleDeath === true;
  if (c.type === 'END_CONTROL') return exact(c, ['type', 'originalId', 'confirmedLoss']) && c.confirmedLoss === true;
  if (c.type === 'STAFF') return exact(c, ['type', 'originalId', 'facilityId']) && FACILITY_IDS.includes(c.facilityId as FacilityId);
  return ['BEGIN_CONTROL', 'ASSIGN_WORM', 'TRANSPORT', 'RECALL_WORM', 'RELEASE_INITIAL'].includes(c.type as string) && exact(c, ['type', 'originalId']);
}

function validateHost(h: HostFacts, s: TownState): void {
  ensure(record(h) && exact(h as unknown as Record<string, unknown>, ['week', 'active', 'sequence', 'health', 'mind', 'spirituality', 'cash', 'actions', 'externalLiveWorms', 'controlPower', 'die']), 'Invalid host facts.');
  ensure(integer(h.week, s.lastObservedWeek) && h.active === true && [2, 1].includes(h.sequence) && integer(h.health, 1, 100), 'Requires a living active Sequence 2 or 1 character and monotonic actual game week.');
  ensure(integer(h.mind, 0, 100) && integer(h.spirituality) && integer(h.cash) && integer(h.actions, 0, 10) && integer(h.externalLiveWorms, 0, 50) && integer(h.controlPower, 0, 100), 'Invalid host resources.');
  ensure(h.die === null || integer(h.die, 1, 100), 'Invalid recorded authoritative die.');
  ensure(h.externalLiveWorms + s.worms.filter(w => w.status === 'ASSIGNED').length <= 50, 'Shared 50-worm capacity exceeded.');
}
function settleCost(h: HostFacts, c: Cost): void {
  ensure(h.actions >= c.actions && h.cash >= c.cash && h.spirituality >= c.spirituality && h.mind >= c.mind && h.health > c.health,
    'Insufficient actual actions, cash, spirituality, mind, or health; this module supplies no free recovery.');
}
function consume(s: TownState, goods: Partial<Goods>): void {
  for (const [key, amount] of Object.entries(goods)) ensure(s.goods[key as Material] >= amount, `Missing finite ${key}.`);
  for (const [key, amount] of Object.entries(goods)) s.goods[key as Material] -= amount;
}
function produce(s: TownState, goods: Partial<Goods>): void {
  for (const [key, amount] of Object.entries(goods)) s.goods[key as Material] += amount;
}
function loadCart(s: TownState, id: string, goods: Partial<Goods>, phaseId: PhaseId | null): void {
  ensure(s.cart.hired && s.cart.holder === 'PLAYER' && s.cart.location === 'base' && s.operatorAt === 'base', 'Hire and physically collect the original cart at base first.');
  const cargo = { ...emptyGoods(), ...goods };
  ensure(cargoWeight(s.cart.goods) + cargoWeight(cargo) <= s.cart.capacityKg, 'The original cart would exceed its 600 kg limit.');
  for (const key of MATERIALS) s.cart.goods[key] += cargo[key];
  s.cart.cargo.push({ id, phaseId, goods: cargo });
}
function move(s: TownState, to: Place, week: number, bodyIds: string[]): void {
  const from = s.operatorAt;
  ensure(from !== to, 'Already at this place.');
  ensure(s.originals.filter(o => o.status === 'CONTROLLED').every(o => distance(to, o.location) <= 1000), 'The real route would break the original control lines.');
  const objectIds: string[] = [];
  if (s.cart.hired) {
    ensure(s.cart.location === from && cargoWeight(s.cart.goods) <= s.cart.capacityKg, 'The original cart must be present and within its actual load limit.');
    s.cart.location = to; objectIds.push(s.cart.id, ...s.cart.cargo.map(x => x.id));
  }
  s.journeys.push({ week, from, to, metres: distance(from, to), bodyIds: ['player-body', ...bodyIds], objectIds });
  s.operatorAt = to;
}
const controlledTown = (s: TownState) => s.originals.filter(o => currentOriginalIds(s).includes(o.id) && o.status === 'CONTROLLED' && !o.alive && o.health > 0 && o.location === s.plot && o.wormId !== null);
function requireTown(s: TownState): void {
  ensure(s.plot !== null && s.operatorAt === s.plot && s.foundedWeek !== null, 'Must be at the actually founded town.');
}

/** 24 finite authored events, two twelve-week cycles; no refill or event-ID reset. */
export function weeklyEvent(index: number): { title: string; producer: FacilityId; receiver: FacilityId; participants: string[]; input: Partial<Goods>; output: Partial<Goods> } {
  ensure(integer(index, 0, 23), 'Unknown finite event.');
  const phase = index % 6, secondHalf = Math.floor(index / 6) % 2;
  const producer = FACILITY_IDS[phase]!, receiver = FACILITY_IDS[(phase + 1) % 6]!;
  const p = phase * 4, r = ((phase + 1) % 6) * 4;
  const participants = [originalIds[p + secondHalf * 2]!, originalIds[p + secondHalf * 2 + 1]!, originalIds[p + (secondHalf ? 0 : 2)]!, originalIds[r + secondHalf * 2]!, originalIds[r + secondHalf * 2 + 1]!];
  const plans: { title: string; input: Partial<Goods>; output: Partial<Goods> }[] = [
    { title: 'Millers grind the bakery order', input: { grain: 2 }, output: { flour: 5 } },
    { title: 'Bakers feed the workshop shift', input: { flour: 3 }, output: { bread: 5 } },
    { title: 'Craftspeople repair the clinic fittings', input: { ore: 2, timber: 1 }, output: { tools: 3 } },
    { title: 'The clinic treats a postal worker', input: { herbs: 2, bread: 1 }, output: {} },
    { title: 'Postal workers carry a market order', input: { paper: 1, ink: 1 }, output: {} },
    { title: 'Market workers supply the mill', input: { bread: 1, tools: 1 }, output: {} },
  ];
  return { ...plans[phase]!, title: `${plans[phase]!.title} (${index + 1})`, producer, receiver, participants };
}

/** Evidence thresholds are game defaults. Twelve weeks alone never pass. */
export function townEvidence(s: TownState, week: number): { ready: boolean; blockers: string[]; fateIds: string[]; interactionIds: string[] } {
  const blockers: string[] = [];
  const currentIds = currentOriginalIds(s);
  const current = s.fates.filter(f => f.epoch === s.epoch && f.plot === s.plot && f.choice === 'FULFILL' && f.week > (s.proofSinceWeek ?? week) && f.participants.every(id => currentIds.includes(id)));
  const interactions = s.interactions.filter(x => x.epoch === s.epoch && x.plot === s.plot && x.completedWeek !== null && x.week >= (s.proofSinceWeek ?? week) && x.townOriginalIds.every(id => currentIds.includes(id)));
  const live = controlledTown(s), workers = new Set(current.flatMap(f => f.participants));
  const epochsWeeks = [...new Set(current.map(f => f.week))].sort((a, b) => a - b);
  if (live.length !== 24) blockers.push('All 24 actual converted bodies must remain controlled, assigned, healthy, and physically here.');
  if (s.facilities.some(f => f.builtWeek === null || f.location !== s.plot || f.staff.length !== 4 || f.condition <= 0)) blockers.push('Six operational facilities with four actual workers each are required.');
  if (s.proofSinceWeek === null || week - s.proofSinceWeek < 12 || epochsWeeks.length < 12) blockers.push('At least twelve actual lived game weeks with successful consequential events are required.');
  if (workers.size !== 24 || live.some(o => !workers.has(o.id))) blockers.push('Every individual needs an actual fate in this location history.');
  const graph = new Map<string, Set<string>>(currentIds.map(id => [id, new Set()]));
  for (const fate of current) for (const [a, b] of fate.links) { graph.get(a)?.add(b); graph.get(b)?.add(a); }
  const seen = new Set<string>(), todo = [currentIds[0]!];
  while (todo.length) { const id = todo.pop()!; if (seen.has(id)) continue; seen.add(id); for (const other of graph.get(id) ?? []) todo.push(other); }
  if (seen.size !== 24) blockers.push('The individual fate graph must connect all 24 residents.');
  if (new Set(current.flatMap(f => f.facilities)).size !== 6) blockers.push('All six facilities must contribute to lived history.');
  if (VISITORS.some(v => !interactions.some(x => x.visitorId === v.id && x.purpose === v.purpose))) blockers.push('Three independent adults must complete their goods, delivered-letter, and trade interactions at this location.');
  return { ready: blockers.length === 0, blockers, fateIds: current.map(f => f.id), interactionIds: interactions.map(x => x.id) };
}

/** Formation is historical; current ritual eligibility must still be checked.
 * Recalling a necessary worm or ending a resident's control blocks consumption. */
export function hasUsableTownRegion(s: TownState, week: number): boolean {
  return s.region !== null && s.region.epoch === s.epoch && s.region.plot === s.plot && s.region.lastVerifiedWeek >= (s.proofSinceWeek ?? week) && townEvidence(s, week).ready;
}

function applyUnchecked(s: TownState, c: TownCommand, h: HostFacts): Cost {
  ensure(validateTownCommand(c), 'Invalid command or missing irreversible confirmation.');
  validateHost(h, s);
  const cost = zeroCost();
  const o = 'originalId' in c ? s.originals.find(x => x.id === c.originalId)! : null;
  const v = 'visitorId' in c ? s.visitors.find(x => x.id === c.visitorId)! : null;
  const atOriginal = () => ensure(o && s.operatorAt === o.location, 'Must be physically with this original body.');
  if (c.type === 'HIRE_CART') {
    ensure(s.operatorAt === 'base' && !s.cart.hired, 'Collect the one original cart at base, once.');
    cost.actions = 1; cost.cash = 24; s.cart.hired = true; s.cart.holder = 'PLAYER';
  } else if (c.type === 'UNLOAD_CART') {
    ensure(s.plot !== null && s.operatorAt === s.plot && s.cart.location === s.plot && s.cart.cargo.length > 0, 'Bring the real loaded cart to the actual town plot before unloading.');
    for (const cargo of s.cart.cargo) {
      produce(s, cargo.goods); s.cargoReceipts.push({ id: cargo.id, unloadedWeek: h.week, plot: s.plot!, goods: structuredClone(cargo.goods) });
      if (cargo.phaseId) { const phase = s.phases.find(p => p.id === cargo.phaseId)!; phase.status = 'DELIVERED'; phase.deliveredWeek = h.week; }
    }
    s.cart.goods = emptyGoods(); s.cart.cargo = [];
  } else if (c.type === 'COMMISSION_REPLACEMENT') {
    ensure(s.operatorAt === 'base', 'Commission the finite independent source at base.');
    const role = s.roles.find(r => r.id === c.roleId)!, old = s.originals.find(x => x.id === role.currentOriginalId)!;
    ensure(['DEAD', 'INERT'].includes(old.status) && old.wormId === null, 'Only a genuinely vacant dead/inert role permits a replacement commission.');
    ensure(!s.replacements.some(r => r.sourceId === c.sourceId), 'This finite replacement source was already commissioned.');
    ensure(!s.replacements.some(r => r.roleId === role.id && r.oldOriginalId === old.id && (r.originalId === null || !['DEAD', 'INERT'].includes(s.originals.find(x => x.id === r.originalId)!.status))), 'Finish or genuinely lose the already commissioned replacement before seeking another.');
    cost.actions = 1; cost.cash = 48;
    s.replacements.push({ sourceId: c.sourceId, roleId: role.id, oldOriginalId: old.id, commissionedWeek: h.week, verifiedWeek: null, originalId: null });
  } else if (c.type === 'VERIFY_REPLACEMENT') {
    const request = s.replacements.find(r => r.sourceId === c.sourceId);
    ensure(request && request.verifiedWeek === null && h.week > request.commissionedWeek && s.operatorAt === c.sourceId, 'Visit the actual commissioned independent pocket in a later game week.');
    const index = RESERVE_IDS.indexOf(c.sourceId), id = reserveOriginalIds[index]!;
    ensure(!s.originals.some(x => x.id === id), 'The independently defined original already exists in the ledger.');
    cost.actions = 1; cost.cash = 48;
    const original = structuredClone(createTownState(s.originWeek).originals[index * 4]!);
    original.id = id; original.bodyId = `${id}:body`; original.location = c.sourceId; original.resistance = 38 + index; original.surveyedWeek = h.week;
    s.originals.push(original); request!.originalId = id; request!.verifiedWeek = h.week;
  } else if (c.type === 'OCCUPY_ROLE') {
    const role = s.roles.find(r => r.id === c.roleId)!, old = s.originals.find(x => x.id === role.currentOriginalId)!;
    const request = s.replacements.find(r => r.roleId === role.id && r.oldOriginalId === old.id && r.originalId === c.originalId);
    ensure(request && o && o.status === 'CONTROLLED' && o.wormId !== null && o.location === s.plot && s.operatorAt === s.plot && ['DEAD', 'INERT'].includes(old.status), 'Bring the actual commissioned converted replacement to the real vacant role.');
    ensure(!s.roles.some(r => r.currentOriginalId === o!.id), 'This original already occupies a role.');
    const facility = s.facilities.find(f => f.id === role.facilityId)!;
    facility.staff = facility.staff.filter(id => id !== old.id);
    role.currentOriginalId = o!.id; role.occupancyHistory.push({ originalId: o!.id, week: h.week });
    if (s.foundedWeek !== null) s.proofSinceWeek = h.week;
  } else if (c.type === 'COMMISSION_PHASE') {
    ensure(s.operatorAt === 'base' && s.foundedWeek !== null && !s.phases.some(p => p.id === c.phaseId), 'Commission one unused finite living phase at base for the existing town.');
    ensure(!s.phases.some(p => ['COMMISSIONED', 'LOADED', 'DELIVERED'].includes(p.status)), 'Finish the already commissioned phase delivery first.');
    cost.actions = 1; cost.cash = 48;
    s.phases.push({ id: c.phaseId, status: 'COMMISSIONED', commissionedWeek: h.week, activatedWeek: null, deliveredWeek: null, epoch: s.epoch, roster: [], nextEvent: 0, limit: 12 });
  } else if (c.type === 'VERIFY_PHASE_SUPPLY') {
    const phase = s.phases.find(p => p.id === c.phaseId);
    ensure(phase?.status === 'COMMISSIONED' && h.week > phase.commissionedWeek && s.operatorAt === 'base', 'Inspect the independent original crate at the supplier in a later game week.');
    ensure(s.visitors.every(v => v.location === 'outside'), 'Visitors must finish their current real town visits before the independent supply routes.');
    cost.actions = 1; cost.cash = 96; loadCart(s, `${c.phaseId}:supply-crate`, PHASE_SUPPLIES, c.phaseId); phase!.status = 'LOADED';
    for (const visitor of s.visitors.filter(v => v.purpose !== 'LETTER')) {
      const stockId = `${visitor.id}:${c.phaseId}:original-stock`;
      s.journeys.push({ week: h.week, from: 'outside', to: 'base', metres: 1200, bodyIds: [visitor.bodyId], objectIds: [] });
      s.journeys.push({ week: h.week, from: 'base', to: 'outside', metres: 1200, bodyIds: [visitor.bodyId], objectIds: [stockId] });
      visitor.stockIds.push(stockId);
    }
  } else if (c.type === 'START_PHASE') {
    requireTown(s); const phase = s.phases.find(p => p.id === c.phaseId), previous = s.phases.find(p => p.id === s.activePhaseId)!;
    ensure(phase?.status === 'DELIVERED' && controlledTown(s).length === 24 && s.facilities.every(f => f.staff.length === 4 && f.condition > 0), 'Actually deliver supplies and restore all 24 roles and six facilities first.');
    ensure(previous.nextEvent === previous.limit || previous.epoch !== s.epoch || previous.roster.some((id, i) => id !== roleOriginal(s, i)) || s.fates.some(f => f.phaseId === previous.id && f.choice === 'CUT_CORNERS'), 'A new finite phase follows exhaustion, genuine relocation/replacement, or actual failed work.');
    cost.actions = 1; if (previous.status !== 'COMPLETED') previous.status = 'ABANDONED';
    phase!.status = 'ACTIVE'; phase!.activatedWeek = h.week; phase!.epoch = s.epoch; phase!.roster = currentOriginalIds(s); s.activePhaseId = phase!.id;
  } else if (c.type === 'TRAVEL') {
    ensure(!s.originals.some(x => x.status === 'INITIAL_CONTROL'), 'Release or finish the current initial control before leaving.');
    cost.actions = c.to === 'base' ? 0 : 1; cost.cash = c.to === 'base' ? 0 : 4; move(s, c.to, h.week, []);
  } else if (c.type === 'SURVEY_SITE') {
    ensure(s.operatorAt === c.siteId, 'Survey requires actual presence at this site.');
    const site = s.sites.find(x => x.id === c.siteId)!;
    ensure(site.surveyedWeek === null, 'This finite site was already surveyed.');
    cost.actions = 1; cost.cash = 12; site.surveyedWeek = h.week;
    for (const original of s.originals.filter(x => x.site === c.siteId)) original.surveyedWeek = h.week;
  } else if (c.type === 'SURVEY_PLOT') {
    ensure(s.operatorAt === c.plotId && !s.surveyedPlots.includes(c.plotId), 'Survey this new, previously unsettled clearing in person.');
    cost.actions = 1; cost.cash = 24; s.surveyedPlots.push(c.plotId);
    if (s.plot === null) { s.plot = c.plotId; s.epoch = 1; }
  } else if (c.type === 'BUY_LOT') {
    ensure(s.operatorAt === 'base', 'Collect the finite original supplier lot at base.');
    ensure(!s.boughtLots.includes(c.lotId), 'The original lot is exhausted; no refreshed stock.');
    const lot = LOTS.find(x => x.id === c.lotId)!; cost.actions = 1; cost.cash = lot.price;
    loadCart(s, lot.id, lot.goods, null); s.boughtLots.push(lot.id);
  } else if (c.type === 'BEGIN_CONTROL') {
    atOriginal(); ensure(o!.surveyedWeek !== null && o!.alive && o!.health > 0 && o!.status === 'WILD', 'Only a surveyed living original supernatural humanoid can be acquired.');
    ensure(o!.attemptedWeek !== h.week && !s.originals.some(x => x.status === 'INITIAL_CONTROL'), 'Only one initial control; no same-week retry.');
    ensure(h.die !== null, 'The authoritative recorded control die is required.');
    cost.actions = 1; cost.spirituality = 3; o!.attemptedWeek = h.week;
    const success = h.die! <= Math.max(5, Math.min(95, h.controlPower - o!.resistance + 50));
    o!.controlHistory.push({ week: h.week, startSecond: s.controlElapsedSeconds, seconds: 10, step: 'INITIAL', success }); s.controlElapsedSeconds += 10;
    if (success) { o!.status = 'INITIAL_CONTROL'; o!.initialControlWeek = h.week; }
    else { o!.health = Math.max(0, o!.health - 25); cost.health = 4; if (o!.health === 0) { o!.alive = false; o!.status = 'DEAD'; } }
  } else if (c.type === 'CONVERT') {
    atOriginal(); ensure(o!.alive && o!.status === 'INITIAL_CONTROL' && o!.initialControlWeek === h.week, 'Continue the same living being’s actual initial control in the same week.');
    cost.spirituality = 8; o!.alive = false; o!.status = 'CONTROLLED'; o!.convertedWeek = h.week;
    o!.controlHistory.push({ week: h.week, startSecond: s.controlElapsedSeconds, seconds: 30, step: 'CONTINUE', success: true }); s.controlElapsedSeconds += 30;
  } else if (c.type === 'RELEASE_INITIAL') {
    atOriginal(); ensure(o!.alive && o!.status === 'INITIAL_CONTROL', 'Only this still-living initially controlled original can be released.');
    o!.status = 'WILD'; o!.initialControlWeek = null;
  } else if (c.type === 'ASSIGN_WORM') {
    atOriginal(); ensure(o!.status === 'CONTROLLED' && !o!.alive && o!.wormId === null, 'Requires this actual controlled original body without a worm.');
    ensure(h.externalLiveWorms + s.worms.filter(w => w.status === 'ASSIGNED').length < 50, 'No shared worm capacity remains.');
    ensure(h.mind > 2, 'A real split costs two mind and cannot be made at the collapse threshold.');
    cost.spirituality = 3; cost.mind = 2;
    const worm: Worm = { id: `town-worm-${s.worms.length + 1}`, originalId: o!.id, status: 'ASSIGNED' };
    s.worms.push(worm); o!.wormId = worm.id;
  } else if (c.type === 'TRANSPORT') {
    atOriginal(); ensure(s.plot !== null && o!.status === 'CONTROLLED' && o!.wormId !== null && o!.location !== s.plot, 'An assigned controlled original and surveyed destination are required.');
    cost.actions = 1; cost.cash = 4; move(s, s.plot!, h.week, [o!.bodyId]); o!.location = s.plot!;
  } else if (c.type === 'RECALL_WORM') {
    atOriginal(); ensure(o!.wormId !== null, 'No actual assigned worm to recall.'); cost.spirituality = 2;
    s.worms.find(w => w.id === o!.wormId)!.status = 'RECALLED'; o!.wormId = null;
  } else if (c.type === 'END_CONTROL') {
    atOriginal(); ensure(['INITIAL_CONTROL', 'CONTROLLED'].includes(o!.status), 'No current control to end.');
    if (o!.wormId !== null) { s.worms.find(w => w.id === o!.wormId)!.status = 'LOST'; o!.wormId = null; cost.mind = 10; cost.pollution = 10; }
    o!.status = o!.alive ? 'WILD' : 'INERT'; o!.initialControlWeek = null;
    // The original being stays dead after complete conversion. No corpse acquisition path exists.
  } else if (c.type === 'BUILD') {
    ensure(s.plot !== null && s.operatorAt === s.plot, 'Build on the actual surveyed empty plot.');
    const facility = s.facilities.find(f => f.id === c.facilityId)!;
    ensure(facility.builtWeek === null, 'This original facility is already built.');
    cost.actions = 1; cost.cash = 12; consume(s, { timber: 3, stone: 2 });
    facility.builtWeek = h.week; facility.location = s.plot; facility.condition = 100;
  } else if (c.type === 'STAFF') {
    ensure(s.plot !== null && s.operatorAt === s.plot && o!.location === s.plot && o!.status === 'CONTROLLED' && o!.wormId !== null, 'The real assigned body must be at the town.');
    const expected = s.roles.find(r => r.currentOriginalId === o!.id)?.facilityId;
    ensure(c.facilityId === expected && o!.facility === null, 'This finite role belongs to the specified original, and cannot be duplicated.');
    const f = s.facilities.find(x => x.id === c.facilityId)!; ensure(f.builtWeek !== null && f.staff.length < 4, 'Build this facility first.');
    f.staff.push(o!.id); o!.facility = f.id;
  } else if (c.type === 'FOUND') {
    ensure(s.plot !== null && s.operatorAt === s.plot && s.foundedWeek === null, 'Found the original town once on its surveyed plot.');
    ensure(controlledTown(s).length === 24 && s.facilities.every(f => f.builtWeek !== null && f.staff.length === 4), 'Twenty-four actual workers and six real facilities are required.');
    cost.actions = 1; cost.spirituality = 6; s.foundedWeek = h.week; s.proofSinceWeek = h.week;
    s.plotHistory.find(p => p.id === s.plot)!.everSettled = true;
    const phase = s.phases[0]!; phase.epoch = s.epoch; phase.roster = currentOriginalIds(s); phase.activatedWeek = h.week;
  } else if (c.type === 'LIVE_WEEK') {
    requireTown(s); ensure(controlledTown(s).length === 24, 'Inert, absent, or unassigned bodies cannot simulate a living town.');
    const phase = s.phases.find(p => p.id === s.activePhaseId)!;
    ensure(phase.status === 'ACTIVE' && c.eventIndex === phase.nextEvent && c.eventIndex < phase.limit, 'Use the next finite event once; no farming or event reset.');
    ensure(phase.epoch === s.epoch && phase.roster.every((id, i) => id === roleOriginal(s, i)), 'Commission an actual new phase for the changed location or original roster.');
    ensure(h.week > Math.max(s.foundedWeek!, phase.activatedWeek!) && !s.fates.some(f => f.week === h.week), 'Only one lived event per actual game week, after founding or actual phase activation.');
    const e = weeklyEvent(c.eventIndex), good = c.choice === 'FULFILL';
    e.participants = e.participants.map(id => roleOriginal(s, originalIds.indexOf(id)));
    if (phase.id !== 'initial') {
      const topics = ['replacement mill drive', 'disputed flour delivery', 'leaking clinic roof', 'injured sorting clerk', 'new cooperative supply order', 'settlement of the actual supply dispute'];
      e.title = `${phase.id}: ${topics[c.eventIndex % 6]} / ${c.eventIndex + 1}`;
    }
    cost.actions = 1; cost.cash = good ? 10 : 0; cost.spirituality = 4;
    consume(s, e.input); if (good) produce(s, e.output);
    const fate: Fate = { id: phase.id === 'initial' ? `town-fate-${c.eventIndex}` : `${phase.id}:fate-${c.eventIndex}`, phaseId: phase.id, eventIndex: c.eventIndex, epoch: s.epoch, week: h.week, plot: s.plot!, choice: c.choice,
      participants: e.participants, facilities: [e.producer, e.receiver], input: e.input, output: good ? e.output : {}, effects: [], links: [] };
    for (let i = 0; i < e.participants.length; i++) {
      const person = s.originals.find(x => x.id === e.participants[i])!;
      ensure(person.facility !== null && [e.producer, e.receiver].includes(person.facility), 'An actual worker is missing from this facility.');
      const healthBefore = person.health;
      person.fatigue += good ? 1 : 3; person.earnings += good ? 2 : 0; person.workCount++; person.fateIds.push(fate.id);
      // Worn hands and their later treatment remain individual physical consequences.
      person.health = Math.max(0, person.health - (good ? 1 : 8));
      if (good && c.eventIndex % 6 === 3 && i >= 3) person.health = Math.min(100, person.health + 6);
      if (person.health === 0) { person.status = 'INERT'; if (person.wormId) { s.worms.find(w => w.id === person.wormId)!.status = 'LOST'; person.wormId = null; cost.mind += 10; cost.pollution += 10; } }
      fate.effects.push({ originalId: person.id, task: i < 3 ? `Make and dispatch: ${e.title}` : `Receive and use: ${e.title}`, fatigueDelta: good ? 1 : 3, earningsDelta: good ? 2 : 0, healthDelta: person.health - healthBefore });
      if (i > 0) fate.links.push([e.participants[i - 1]!, person.id]);
    }
    const producer = s.facilities.find(f => f.id === e.producer)!, receiver = s.facilities.find(f => f.id === e.receiver)!;
    producer.output += good ? 1 : 0; producer.condition -= good ? 1 : 8; receiver.condition -= good ? 1 : 8;
    if (good && c.eventIndex % 6 === 2) receiver.condition = Math.min(100, receiver.condition + 6);
    if (good && c.eventIndex % 6 === 4) s.letters.push({ id: phase.id === 'initial' ? `town-letter-${c.eventIndex}` : `${phase.id}:letter-${c.eventIndex}`, authorId: e.participants[0]!, intendedRecipient: 'outside-cooperative-clerk', holder: 'post', dueWeek: null, deliveredWeek: null, epoch: s.epoch, createdWeek: h.week, content: `Actual local order: ${e.title}; completed work receipt ${fate.id}.` });
    s.fates.push(fate); phase.nextEvent++; if (phase.nextEvent === phase.limit) phase.status = 'COMPLETED';
  } else if (c.type === 'MEET_VISITOR') {
    requireTown(s); ensure(v!.location === 'outside', 'End the previous actual visit before arranging another.');
    cost.actions = 1; cost.cash = 3; v!.location = s.plot!;
    s.journeys.push({ week: h.week, from: 'outside', to: s.plot!, metres: 1200, bodyIds: [v!.bodyId], objectIds: v!.stockIds.filter(id => !v!.spentStockIds.includes(id)) });
    const willing = v!.trust >= 0 && (v!.purpose === 'LETTER' || v!.spentStockIds.length < v!.stockIds.length);
    v!.consent = { epoch: s.epoch, week: h.week, purpose: v!.purpose, status: willing ? 'GRANTED' : 'REFUSED' };
  } else if (c.type === 'WITHDRAW_VISITOR') {
    requireTown(s); ensure(v!.location === s.plot && v!.consent?.status === 'GRANTED', 'No current consent to withdraw.');
    v!.consent!.status = 'WITHDRAWN';
  } else if (c.type === 'SEND_VISITOR_HOME') {
    ensure(v!.location !== 'outside', 'The original visitor is already outside.');
    s.journeys.push({ week: h.week, from: v!.location, to: 'outside', metres: 1200, bodyIds: [v!.bodyId], objectIds: s.letters.filter(l => l.holder === v!.id).map(l => l.id) });
    v!.location = 'outside'; if (v!.consent?.status === 'GRANTED') v!.consent.status = 'WITHDRAWN';
  } else if (c.type === 'EXCHANGE') {
    requireTown(s); ensure(v!.location === s.plot && v!.consent?.status === 'GRANTED' && v!.consent.epoch === s.epoch && v!.consent.week === h.week && v!.consent.purpose === v!.purpose,
      'This independent adult’s current, location-specific consent is required.');
    ensure(controlledTown(s).length === 24 && s.fates.some(f => f.epoch === s.epoch && f.choice === 'FULFILL'), 'An actual inhabited town must make the exchange.');
    cost.actions = 1;
    const interaction: ExternalInteraction = { id: `town-exchange-${s.interactions.length + 1}`, epoch: s.epoch, week: h.week, visitorId: v!.id, purpose: v!.purpose, plot: s.plot!,
      townOriginalIds: [], exported: {}, importedObjectId: null, letterId: null, completedWeek: h.week };
    if (v!.purpose === 'LETTER') {
      const letter = s.letters.find(l => l.holder === 'post' && l.epoch === s.epoch && l.createdWeek > (s.proofSinceWeek ?? h.week)); ensure(letter, 'No actual locally authored letter is available.');
      letter!.holder = v!.id; letter!.dueWeek = h.week + 1; interaction.letterId = letter!.id; interaction.completedWeek = null;
      interaction.townOriginalIds = [letter!.authorId, ...s.facilities.find(f => f.id === 'post')!.staff.slice(0, 1)];
    } else {
      const stock = v!.stockIds.find(id => !v!.spentStockIds.includes(id)); ensure(stock, 'This visitor has no finite original stock left.');
      interaction.importedObjectId = stock!; v!.spentStockIds.push(stock!);
      if (v!.purpose === 'GOODS') { consume(s, { bread: 2 }); produce(s, { salt: 1 }); v!.receivedBread += 2; interaction.exported = { bread: 2 }; interaction.townOriginalIds = s.facilities.find(f => f.id === 'bakery')!.staff.slice(0, 2); }
      else { consume(s, { tools: 1 }); produce(s, { cloth: 1 }); v!.receivedTools++; interaction.exported = { tools: 1 }; interaction.townOriginalIds = s.facilities.find(f => f.id === 'workshop')!.staff.slice(0, 2); }
    }
    v!.trust++; v!.consent!.status = 'USED'; s.interactions.push(interaction);
  } else if (c.type === 'CONFIRM_DELIVERY') {
    const letter = s.letters.find(l => l.id === c.letterId);
    ensure(letter && letter.holder === 'courier-neri' && letter.dueWeek !== null && h.week >= letter.dueWeek && letter.deliveredWeek === null, 'Delivery requires the real entrusted letter and a later actual week.');
    const courier = s.visitors.find(x => x.id === 'courier-neri')!;
    ensure(courier.location === 'outside', 'The courier must actually leave before outside delivery.');
    letter!.holder = 'recipient'; letter!.deliveredWeek = h.week; courier.deliveredLetters.push(letter!.id);
    s.interactions.find(x => x.letterId === letter!.id)!.completedWeek = h.week;
  } else if (c.type === 'MOVE_TOWN') {
    requireTown(s); ensure(c.plotId !== s.plot && s.surveyedPlots.includes(c.plotId), 'A distinct actually surveyed empty plot is required.');
    const destination = s.plotHistory.find(p => p.id === c.plotId)!;
    ensure(!destination.everSettled && destination.regionId === null, 'A previously settled or Spirit World region plot cannot be treated as new empty land.');
    ensure(s.visitors.every(x => x.location === 'outside') && !s.originals.some(x => x.status === 'INITIAL_CONTROL'), 'Independent visitors must leave before relocation.');
    ensure(s.cart.hired && s.cart.location === s.plot && s.cart.cargo.length === 0 && cargoWeight(s.goods) + 102 <= s.cart.capacityKg, 'The original empty cart must support the actual town stores and dismantled facility cargo.');
    ensure(h.die !== null && !s.relocations.some(r => r.status === 'FAILED' && r.repairedWeek === null), 'Record the actual transport check and repair previous failed transport damage first.');
    cost.actions = 3; cost.cash = 72; cost.spirituality = 12;
    const oldPlot = s.plot!;
    if (h.die! > 80) {
      const damage = s.facilities.map(f => ({ facilityId: f.id, amount: Math.min(5, f.condition), beforeCondition: f.condition }));
      for (const part of damage) s.facilities.find(f => f.id === part.facilityId)!.condition -= part.amount;
      s.relocations.push({ week: h.week, from: oldPlot, to: c.plotId, status: 'FAILED', repairedWeek: null, damage });
    } else {
      move(s, c.plotId, h.week, s.originals.filter(x => x.location === oldPlot).map(x => x.bodyId));
      s.journeys.at(-1)!.objectIds.push(...s.facilities.map(f => `town-facility:${f.id}`), 'town-stores-1');
      for (const original of s.originals) if (original.location === oldPlot) original.location = c.plotId;
      for (const facility of s.facilities) if (facility.location === oldPlot) facility.location = c.plotId;
      if (s.region) s.retiredRegions.push(s.region); s.region = null;
      s.plot = c.plotId; s.epoch++; s.foundedWeek = h.week; s.proofSinceWeek = h.week; destination.everSettled = true;
      for (const visitor of s.visitors) if (visitor.consent) visitor.consent.status = 'WITHDRAWN';
      s.relocations.push({ week: h.week, from: oldPlot, to: c.plotId, status: 'COMPLETED', repairedWeek: null, damage: [] });
    }
    // Original goods, deaths, spent lots, finite events and letters are never reset.
  } else if (c.type === 'REPAIR_RELOCATION') {
    requireTown(s); const failed = s.relocations.find(r => r.status === 'FAILED' && r.repairedWeek === null);
    ensure(failed && failed.from === s.plot, 'No real failed transport damage remains here.');
    cost.actions = 1; cost.cash = 24; consume(s, { timber: 2 });
    for (const damage of failed!.damage) { const f = s.facilities.find(f => f.id === damage.facilityId)!; f.condition += Math.max(0, Math.min(damage.amount, damage.beforeCondition - f.condition)); }
    failed!.repairedWeek = h.week;
  } else if (c.type === 'FORM_REGION') {
    requireTown(s); ensure(s.region === null, 'A region already exists for this actual town location.');
    ensure(s.plotHistory.find(p => p.id === s.plot)!.regionId === null, 'This geographic plot already has a corresponding region.');
    const proof = townEvidence(s, h.week); ensure(proof.ready, proof.blockers.join(' '));
    cost.actions = 1; cost.spirituality = 12;
    s.region = { id: `town-spirit-region-${s.epoch}`, epoch: s.epoch, plot: s.plot!, formedWeek: h.week, lastVerifiedWeek: h.week, fateIds: proof.fateIds, interactionIds: proof.interactionIds };
    s.plotHistory.find(p => p.id === s.plot)!.regionId = s.region.id;
  } else if (c.type === 'REVERIFY_REGION') {
    requireTown(s); ensure(s.region !== null && s.region.epoch === s.epoch && s.region.plot === s.plot, 'Reverify the same actually existing local region, without a move or new region ID.');
    const proof = townEvidence(s, h.week); ensure(proof.ready, proof.blockers.join(' '));
    cost.actions = 1; cost.spirituality = 6; s.region!.lastVerifiedWeek = h.week; s.region!.fateIds = proof.fateIds; s.region!.interactionIds = proof.interactionIds;
  } else fail('Unknown command.');
  settleCost(h, cost); s.lastObservedWeek = h.week;
  return cost;
}

export function transitionTown(state: TownState, command: TownCommand, host: HostFacts): { state: TownState; cost: Cost } {
  ensure(validateTownState(state), 'Invalid town ledger.');
  const next = structuredClone(state), cost = applyUnchecked(next, command, host);
  next.journal.push({ command: structuredClone(command), host: structuredClone(host), cost: structuredClone(cost) });
  return { state: next, cost };
}
/** Pure projection preview for an ALREADY VALIDATED authoritative state only.
 * Discard the large journal before cloning; this performs one bounded transition,
 * never replays prefixes, mutates the input, or weakens persistence validation. */
export function townCommandBlock(state: TownState, command: unknown, host: HostFacts): string | null {
  if (!validateTownCommand(command)) return 'Invalid command or missing irreversible confirmation.';
  try { applyUnchecked(structuredClone({ ...state, journal: [] }), command, host); return null; }
  catch (error) { return error instanceof Error ? error.message : 'The actual town command is blocked.'; }
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (record(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'undefined';
}
/** Rebuild derived state from every paid command and authoritative input. This
 * rejects invented deaths, fates, stock, consent, capacity, and region receipts.
 * Host input authenticity remains the transaction adapter's responsibility. */
export function validateTownState(value: unknown): value is TownState {
  if (!record(value) || value.schema !== 1 || !integer(value.originWeek, 1) || !Array.isArray(value.journal) || value.journal.length > 1024) return false;
  try {
    const rebuilt = createTownState(value.originWeek);
    for (const receipt of value.journal) {
      if (!record(receipt) || !exact(receipt, ['command', 'host', 'cost']) || !validateTownCommand(receipt.command)) return false;
      const cost = applyUnchecked(rebuilt, receipt.command, receipt.host as HostFacts);
      if (canonical(cost) !== canonical(receipt.cost)) return false;
      rebuilt.journal.push(structuredClone(receipt) as unknown as TownState['journal'][number]);
    }
    return canonical(rebuilt) === canonical(value);
  } catch { return false; }
}
