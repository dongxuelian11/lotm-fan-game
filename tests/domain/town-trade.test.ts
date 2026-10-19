import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyTownCommand, createTownState, projectTown, validateTownCommand, validateTownState } from '../../src/domain/town/index.js';
import { TOWN_CLUB_ID, type TownCommand } from '../../src/domain/town/types.js';

function state(): SliceState {
  const s = createSliceRun('town-trade', sliceDefaultCreationSelection, 'town-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.actionsRemaining = 10;
  s.weeklyBudget = 10;
  s.cash = 1000;
  s.town = createTownState();
  return s;
}
function context() {
  const notes: { title: string; text: string }[] = [];
  const c: SeerContext = {
    roll() { throw new Error('Ordinary goods must not consume random outcomes.'); },
    check() { throw new Error('Ordinary goods must not require a supernatural check.'); },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, notes };
}
function apply(s: SliceState, type: TownCommand['type']) { applyTownCommand(s, { type }, context().c); }
function knownShop() { const s = state(); apply(s, 'VISIT_SHOP'); return s; }
function stockedBag() { const s = knownShop(); apply(s, 'BUY_CLUB'); apply(s, 'BUY_BANDAGE'); s.health = 70; return s; }
function unchangedRejection(s: SliceState, type: TownCommand['type']) {
  const before = JSON.stringify(s), ctx = context();
  expect(() => applyTownCommand(s, { type }, ctx.c)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
  expect(ctx.notes).toEqual([]);
}
const commands: TownCommand['type'][] = ['VISIT_SHOP', 'BUY_CLUB', 'SELL_CLUB', 'EQUIP_CLUB', 'UNEQUIP_CLUB', 'BUY_BANDAGE', 'USE_BANDAGE'];

describe('finite ordinary town goods', () => {
  it('starts with one original club and three bandages, without exposing unvisited inventory', () => {
    const s = state(), p = projectTown(s);
    expect(s.town).toEqual({ shopKnown: false, clubLocation: 'SHOP', bandagesStock: 3, bandagesHeld: 0, bandagesUsed: 0 });
    expect(validateTownState(s)).toBe(true);
    expect(p.items).toEqual([]);
    expect(p.actions.map(action => action.command.type)).toEqual(['VISIT_SHOP']);
    const separate = createTownState();
    separate.clubLocation = 'HAND';
    separate.bandagesStock = 0;
    expect(s.town.clubLocation).toBe('SHOP');
    expect(s.town.bandagesStock).toBe(3);
  });

  it('spends one visit action establishing only a mundane shop channel', () => {
    const s = state(), oldWorld = structuredClone(s.world), progression = structuredClone(s.progression), ctx = context();
    applyTownCommand(s, { type: 'VISIT_SHOP' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.town.shopKnown]).toEqual([9, 1000, true]);
    expect(s.marketUnlocked).toBe(false);
    expect(s.world).toEqual(oldWorld);
    expect(s.progression).toEqual(progression);
    expect(ctx.notes[0]!.text).toContain('原创试玩数值');
    expect(projectTown(s).items.find(item => item.id === TOWN_CLUB_ID)).toMatchObject({ quantity: 1, location: 'SHOP', owner: 'SHOP', equipped: false });
    unchangedRejection(s, 'VISIT_SHOP');
  });

  it.each(['BUY_CLUB', 'SELL_CLUB', 'BUY_BANDAGE'] as const)('requires the actual known shop before %s', type => {
    const s = state();
    s.marketUnlocked = true;
    unchangedRejection(s, type);
  });

  it('buys, holds and equips the same club without mutating base stats or mastery', () => {
    const s = knownShop(), stats = structuredClone(s.character.coreStats), progression = structuredClone(s.progression), ap = s.actionsRemaining;
    apply(s, 'BUY_CLUB');
    expect([s.cash, s.actionsRemaining, s.town.clubLocation]).toEqual([920, ap, 'BAG']);
    expect(projectTown(s).items.find(item => item.id === TOWN_CLUB_ID)).toMatchObject({ quantity: 1, location: 'BAG', owner: 'PLAYER', equipped: false });
    unchangedRejection(s, 'BUY_CLUB');
    apply(s, 'EQUIP_CLUB');
    expect([s.cash, s.actionsRemaining, s.town.clubLocation]).toEqual([920, ap, 'HAND']);
    expect(projectTown(s).items.find(item => item.id === TOWN_CLUB_ID)).toMatchObject({ quantity: 1, location: 'HAND', owner: 'PLAYER', equipped: true });
    expect(s.character.coreStats).toEqual(stats);
    expect(s.progression).toEqual(progression);
    unchangedRejection(s, 'EQUIP_CLUB');
    unchangedRejection(s, 'BUY_CLUB');
    expect(validateTownState(s)).toBe(true);
  });

  it('requires unequipping before a real resale, preserves identity and never duplicates cash', () => {
    const s = knownShop(), ap = s.actionsRemaining;
    apply(s, 'BUY_CLUB');
    apply(s, 'EQUIP_CLUB');
    expect(projectTown(s).actions.find(action => action.command.type === 'SELL_CLUB')).toMatchObject({ enabled: false, reason: '先收起手中的短棍，再交给店主。' });
    unchangedRejection(s, 'SELL_CLUB');
    apply(s, 'UNEQUIP_CLUB');
    unchangedRejection(s, 'UNEQUIP_CLUB');
    apply(s, 'SELL_CLUB');
    expect([s.cash, s.actionsRemaining, s.town.clubLocation]).toEqual([960, ap, 'SHOP']);
    expect(projectTown(s).items.filter(item => item.id === TOWN_CLUB_ID)).toHaveLength(1);
    expect(projectTown(s).items.find(item => item.id === TOWN_CLUB_ID)!.owner).toBe('SHOP');
    unchangedRejection(s, 'SELL_CLUB');
    unchangedRejection(s, 'EQUIP_CLUB');
    apply(s, 'BUY_CLUB');
    expect([s.cash, s.town.clubLocation]).toEqual([880, 'BAG']);
    expect(validateTownState(s)).toBe(true);
  });

  it.each([['BUY_CLUB', 79], ['BUY_BANDAGE', 11]] as const)('rejects unaffordable %s without changing any state', (type, cash) => {
    const s = knownShop();
    s.cash = cash;
    unchangedRejection(s, type);
    expect(projectTown(s).actions.find(action => action.command.type === type)?.enabled).toBe(false);
    s.cash += 1;
    apply(s, type);
    expect(s.cash).toBe(0);
  });

  it('allows zero-action trading and equipment changes while reserving actions for visits and first aid', () => {
    const untouched = state();
    untouched.actionsRemaining = 0;
    unchangedRejection(untouched, 'VISIT_SHOP');
    const s = knownShop();
    s.actionsRemaining = 0;
    apply(s, 'BUY_CLUB');
    apply(s, 'EQUIP_CLUB');
    apply(s, 'UNEQUIP_CLUB');
    apply(s, 'SELL_CLUB');
    apply(s, 'BUY_BANDAGE');
    s.health = 80;
    unchangedRejection(s, 'USE_BANDAGE');
    expect([s.actionsRemaining, s.cash]).toEqual([0, 948]);
  });

  it('transfers only the actual three bandages and never replenishes consumed stock', () => {
    const s = knownShop(), ap = s.actionsRemaining;
    for (let index = 0; index < 3; index += 1) apply(s, 'BUY_BANDAGE');
    expect([s.cash, s.actionsRemaining, s.town.bandagesStock, s.town.bandagesHeld]).toEqual([964, ap, 0, 3]);
    unchangedRejection(s, 'BUY_BANDAGE');
    s.health = 50;
    for (let index = 0; index < 3; index += 1) apply(s, 'USE_BANDAGE');
    expect([s.health, s.actionsRemaining, s.town.bandagesStock, s.town.bandagesHeld, s.town.bandagesUsed]).toEqual([74, ap - 3, 0, 0, 3]);
    unchangedRejection(s, 'USE_BANDAGE');
    s.week += 1;
    unchangedRejection(s, 'BUY_BANDAGE');
    expect(validateTownState(s)).toBe(true);
  });

  it('caps first aid at 100 and refuses full-health waste atomically', () => {
    const s = knownShop();
    apply(s, 'BUY_BANDAGE');
    unchangedRejection(s, 'USE_BANDAGE');
    s.health = 97;
    const ctx = context();
    applyTownCommand(s, { type: 'USE_BANDAGE' }, ctx.c);
    expect([s.health, s.town.bandagesHeld, s.town.bandagesUsed]).toEqual([100, 0, 1]);
    expect(ctx.notes[0]!.text).toContain('健康恢复3点');
    apply(s, 'BUY_BANDAGE');
    unchangedRejection(s, 'USE_BANDAGE');
  });

  it('never treats or removes either injury severity, clears risk, or changes existing medical aid', () => {
    const s = stockedBag();
    s.health = 92;
    s.injuries = [
      { id: 'light', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null },
      { id: 'heavy', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null },
      { id: 'treated-heavy', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 },
    ];
    s.injuryRisk = 20;
    s.aid = 'ACCEPTED';
    s.aidInjuryIds = ['heavy'];
    const before = structuredClone(s.injuries);
    apply(s, 'USE_BANDAGE');
    expect(s.health).toBe(100);
    expect(s.injuries).toEqual(before);
    expect([s.injuryRisk, s.aid, s.aidInjuryIds]).toEqual([20, 'ACCEPTED', ['heavy']]);
  });

  it.each(['VISIT_SHOP', 'BUY_CLUB', 'SELL_CLUB', 'BUY_BANDAGE'] as const)('requires Backlund for %s', type => {
    const s = stockedBag();
    s.world.city = 'ELSEWHERE';
    unchangedRejection(s, type);
  });

  it('keeps owned equipment and first aid available outside the shop city', () => {
    const s = stockedBag();
    s.world.city = 'ELSEWHERE';
    apply(s, 'EQUIP_CLUB');
    apply(s, 'UNEQUIP_CLUB');
    apply(s, 'USE_BANDAGE');
    expect([s.health, s.town.clubLocation, s.town.bandagesUsed]).toEqual([78, 'BAG', 1]);
    expect(projectTown(s).actions.find(action => action.command.type === 'SELL_CLUB')?.enabled).toBe(false);
  });

  it.each(['event', 'combat', 'dead', 'finished', 'unconscious', 'exhausted'] as const)('blocks every command and projected action when %s', condition => {
    const s = stockedBag();
    if (condition === 'event') s.activeEvent = { id: 'ARC-A', instanceId: 'pending-event' };
    if (condition === 'combat') s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    if (condition === 'dead') s.status = 'DEAD';
    if (condition === 'finished') s.status = 'SLICE_COMPLETE';
    if (condition === 'unconscious') s.health = 0;
    if (condition === 'exhausted') s.mind = 0;
    for (const type of commands) unchangedRejection(s, type);
    expect(projectTown(s).actions.every(action => !action.enabled && action.reason)).toBe(true);
  });

  it('projects copied public facts without leaking other world or progression state', () => {
    const s = stockedBag(), before = JSON.stringify(s), projection = projectTown(s);
    expect(Object.keys(projection).sort()).toEqual(['actions', 'items', 'shopKnown', 'stockSummary', 'title']);
    expect(projection.items.find(item => item.id === TOWN_CLUB_ID)!.description).toContain('12→16');
    expect(projection.stockSummary).toContain('店内2份、随身1份、已用0份');
    projection.items[0]!.quantity = 999;
    projection.actions[0]!.enabled = false;
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('town command and conservation boundary', () => {
  it('accepts only exact typed commands and rejects malformed input before any mutation', () => {
    for (const type of commands) expect(validateTownCommand({ type })).toBe(true);
    const s = state(), before = JSON.stringify(s);
    for (const value of [null, [], {}, { type: 'BUY' }, { type: 'BUY_CLUB', price: 0 }, { type: 'USE_BANDAGE', amount: 3 }]) {
      expect(validateTownCommand(value)).toBe(false);
      expect(() => applyTownCommand(s, value as TownCommand, context().c)).toThrow('普通用品命令无效');
      expect(JSON.stringify(s)).toBe(before);
    }
  });

  it('rejects impossible counts, extra fields and invalid finite club locations', () => {
    const initial = createTownState();
    for (const value of [null, [], {}, { ...initial, duplicateClub: true }, { ...initial, clubLocation: 'BOTH' },
      { ...initial, shopKnown: 1 }, { ...initial, bandagesStock: 4 }, { ...initial, bandagesHeld: -1 },
      { ...initial, bandagesStock: 2 }, { ...initial, bandagesHeld: 1 }, { ...initial, bandagesStock: NaN },
      { ...initial, bandagesStock: Infinity }, { ...initial, bandagesStock: 2.5, bandagesHeld: 0.5 }]) {
      const s = state();
      s.town = value as SliceState['town'];
      expect(validateTownState(s)).toBe(false);
    }
    const s = state();
    s.town = { shopKnown: true, clubLocation: 'HAND', bandagesStock: 0, bandagesHeld: 1, bandagesUsed: 2 };
    expect(validateTownState(s)).toBe(true);
  });
});
