import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { awardSeerMastery, type SeerContext } from '../../src/domain/seer/index.js';
import { applyHunterCommand, createHunterState, validateHunterState } from '../../src/domain/hunter/index.js';
import {
  applyHunterAdventure, hunterAdventureActions, settleHunterCargo,
  HUNTER_CARGO_STORY, HUNTER_PRACTICE_IDS, validateHunterAdventure,
} from '../../src/domain/hunter/adventure.js';
import { HUNTER_ABILITY_IDS, type HunterCommand } from '../../src/domain/hunter/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('hunter-adventure', sliceDefaultCreationSelection, 'hunter-adventure-seed');
  s.hunter = createHunterState();
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 7;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.cash = 10000;
  for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 15;
  return s;
}

function context(s: SliceState, checkRoll = 20) {
  const checks: [PublicCoreStatKey, number][] = [], draws: [number, number][] = [];
  const notes: { title: string; text: string }[] = [], awards: [string, 5 | 8 | 25][] = [];
  const ctx: SeerContext = {
    check(stat, difficulty) {
      checks.push([stat, difficulty]);
      const result = resolveNormalCheck({ ability: stat, baseAbility: s.character.coreStats[stat], difficulty, modifiers: [], roll: checkRoll });
      s.lastCheck = result;
      return result;
    },
    roll(min, max) { draws.push([min, max]); return min; },
    note(title, text) { notes.push({ title, text }); },
  };
  return { ctx, checks, draws, notes, awards, award(source: string, amount: 5 | 8 | 25) {
    awards.push([source, amount]);
    awardSeerMastery(s, source, amount, ctx);
  } };
}

function ready(): SliceState {
  const s = ordinary(), c = context(s, 1).ctx;
  applyHunterCommand(s, { type: 'DISCOVER' }, c);
  applyHunterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  const bottleId = s.hunter.bottles[0]!.id;
  applyHunterCommand(s, { type: 'BUY_POTION', bottleId }, c);
  applyHunterCommand(s, { type: 'CONSUME', bottleId, confirmed: true }, c);
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  return s;
}

function apply(s: SliceState, command: HunterCommand, checkRoll = 20) {
  const c = context(s, checkRoll);
  applyHunterAdventure(s, command, c.ctx, c.award);
  return c;
}
function buy(s: SliceState) { applyHunterCommand(s, { type: 'BUY_TRAP_KIT' }, context(s).ctx); }
function prepared(): SliceState {
  const s = ready();
  apply(s, { type: 'PRACTICE', practiceId: 'muddy-cart' });
  return s;
}
function trapped(): SliceState {
  const s = prepared();
  buy(s);
  apply(s, { type: 'SET_TRAP', location: 'HUNTER_CARGO' });
  return s;
}
function rejection(s: SliceState, command: HunterCommand, message?: RegExp) {
  const before = JSON.stringify(s), c = context(s);
  if (message) expect(() => applyHunterAdventure(s, command, c.ctx, c.award)).toThrow(message);
  else expect(() => applyHunterAdventure(s, command, c.ctx, c.award)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
  expect([c.checks, c.draws, c.notes, c.awards]).toEqual([[], [], [], []]);
}
const stock = (s: SliceState) => [s.hunter.trapStock, s.hunter.trapHeld, s.hunter.trapDeployed, s.hunter.trapSpent];
const original = (s: SliceState) => ({ originalId: s.hunter.cargo.originalId, owner: s.hunter.cargo.owner, holder: s.hunter.cargo.holder });
const totalMastery = (s: SliceState) => Object.values(s.progression.mastery).reduce((sum, value) => sum + value, 0);

/** Synthetic round fixtures isolate settlement from the shared combat's own tests. */
function round(overrides: Partial<SliceCombatRound> = {}): SliceCombatRound {
  return {
    round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1,
    playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'PLAYER', label: '有效近身动作', selfGain: 12, enemyReduction: 0 }],
    playerAdvantage: 200, enemyAdvantage: 100, winChance: 66.66, winner: 'PLAYER',
    consequence: '测试用已结算回合', consequenceWeights: null, retreat: 'NONE', ...overrides,
  };
}
function settle(s: SliceState, outcome: string) {
  const c = context(s);
  settleHunterCargo(s, outcome, c.ctx, c.award);
  return c;
}

describe('six finite hunter practices', () => {
  it('has six different grounded stories, no unowned equipment and no ordinary-person entry', () => {
    const s = ready(), actions = hunterAdventureActions(s).filter(action => action.command.type === 'PRACTICE');
    expect(actions.map(action => action.id)).toEqual(HUNTER_PRACTICE_IDS);
    expect(new Set(actions.map(action => action.label)).size).toBe(6);
    expect(actions.filter(action => action.enabled)).toHaveLength(5);
    expect(actions.find(action => action.id === 'rope-inspection')!.reason).toMatch(/实际持有/);
    expect(actions.every(action => action.cost.includes('1行动') && action.cost.includes('0灵性'))).toBe(true);
    expect(hunterAdventureActions(ordinary())).toEqual([]);
    expect(validateHunterAdventure(s)).toBe(true);
    expect(validateHunterState(s)).toBe(true);
    expect(HUNTER_CARGO_STORY).toMatch(/短棍/);
    expect(HUNTER_CARGO_STORY).toMatch(/只能单人通过的狭口/);
  });

  it.each(HUNTER_PRACTICE_IDS)('%s costs one action and awards 12 acting plus one 8-point mastery packet only once', id => {
    const s = ready();
    if (id === 'rope-inspection') buy(s);
    const before = { ap: s.actionsRemaining, cash: s.cash, spirit: s.spirituality, stock: stock(s), world: structuredClone(s.world), arc: structuredClone(s.arc) };
    const action = hunterAdventureActions(s).find(candidate => candidate.id === id)!, c = apply(s, action.command);
    expect([s.actionsRemaining, s.cash, s.spirituality]).toEqual([before.ap - 1, before.cash, before.spirit]);
    expect(s.hunter.observations).toEqual([id]);
    expect(s.hunter.practiceAttempts).toEqual({ [id]: 7 });
    expect(s.progression.acting).toBe(12);
    expect(totalMastery(s)).toBe(8);
    expect(Object.values(s.progression.mastery).filter(value => value !== 0)).toHaveLength(1);
    expect(Object.keys(s.progression.mastery)).toEqual([...HUNTER_ABILITY_IDS]);
    expect(c.awards).toEqual([[`hunter-practice:${id}`, 8]]);
    expect(c.draws).toEqual([[1, 20]]);
    expect(action.cost).toContain(`成功率${s.lastCheck!.chance}%`);
    expect(stock(s)).toEqual(before.stock);
    expect([s.world, s.arc]).toEqual([before.world, before.arc]);
    expect(validateHunterAdventure(s)).toBe(true);
    rejection(s, action.command, /已经完成/);
    s.week += 1;
    rejection(s, action.command, /已经完成/);
    expect(hunterAdventureActions(s).some(candidate => candidate.id === id)).toBe(false);
  });

  it.each([80, 100])('failed roll %i spends an action without invented progress and permits a later-week retry', roll => {
    const s = ready(), command: HunterCommand = { type: 'PRACTICE', practiceId: 'muddy-cart' };
    const c = apply(s, command, roll);
    expect([s.actionsRemaining, s.progression.acting, totalMastery(s)]).toEqual([39, 0, 0]);
    expect(s.hunter.practiceAttempts).toEqual({ 'muddy-cart': 7 });
    expect(s.hunter.observations).toEqual([]);
    expect([c.awards, c.draws]).toEqual([[], []]);
    expect(validateHunterAdventure(s)).toBe(true);
    rejection(s, command, /下周/);
    s.week += 1;
    apply(s, command);
    expect(s.hunter.practiceAttempts['muddy-cart']).toBe(8);
    expect(s.progression.acting).toBe(12);
  });

  it('checks the actual held kit, leaves training originals unchanged and cannot inspect deployed material', () => {
    const s = ready(), command: HunterCommand = { type: 'PRACTICE', practiceId: 'rope-inspection' };
    rejection(s, command, /实际持有/);
    buy(s);
    const kit = stock(s);
    apply(s, command, 100);
    expect(stock(s)).toEqual(kit);
    s.week += 1;
    apply(s, { type: 'PRACTICE', practiceId: 'muddy-cart' });
    apply(s, { type: 'SET_TRAP', location: 'HUNTER_CARGO' });
    rejection(s, command, /实际持有/);
    apply(s, { type: 'RECOVER_TRAP' });
    apply(s, command);
    expect(stock(s)).toEqual(kit);
  });

  it('reaches full digestion through six practices, peaceful cargo resolution and one reflection without first-case rewards or combat', () => {
    const s = ready();
    buy(s);
    for (const id of HUNTER_PRACTICE_IDS) apply(s, { type: 'PRACTICE', practiceId: id });
    expect(s.progression.acting).toBe(72);
    expect(totalMastery(s)).toBe(48);
    expect(hunterAdventureActions(s).filter(action => action.command.type === 'PRACTICE')).toEqual([]);
    apply(s, { type: 'CARGO_TALK' });
    expect(s.progression.acting).toBe(92);
    expect(s.combatHistory).toEqual([]);
    expect(s.seer.completedSources).not.toContain('first-case-tracking');
    expect(s.seer.completedSources).not.toContain('first-case-combat');
    const before = { ap: s.actionsRemaining, cash: s.cash, spirit: s.spirituality, mastery: structuredClone(s.progression.mastery), cargo: structuredClone(s.hunter.cargo), stock: stock(s), arc: structuredClone(s.arc), world: structuredClone(s.world) };
    const action = hunterAdventureActions(s).find(candidate => candidate.command.type === 'REFLECT')!;
    expect(action.enabled).toBe(true);
    const c = apply(s, action.command);
    expect(s.progression.acting).toBe(100);
    expect(s.actionsRemaining).toBe(before.ap - 1);
    expect([s.cash, s.spirituality, s.progression.mastery, s.hunter.cargo, stock(s), s.arc, s.world]).toEqual([before.cash, before.spirit, before.mastery, before.cargo, before.stock, before.arc, before.world]);
    expect([c.awards, c.checks, c.draws]).toEqual([[], [], []]);
    expect(c.notes[0]!.text).toContain('和平交涉同样是真实经历');
    expect(c.notes[0]!.text).toContain('追踪只依据真实痕迹');
    expect(s.seer.completedSources.filter(source => source === 'hunter-reflection')).toHaveLength(1);
    expect(validateHunterAdventure(s)).toBe(true);
    expect(hunterAdventureActions(s).some(candidate => candidate.command.type === 'REFLECT')).toBe(false);
    rejection(s, { type: 'REFLECT' }, /已经复盘/);
    s.week += 1;
    rejection(s, { type: 'REFLECT' }, /已经复盘/);
  });

  it('requires all six successes and a completed cargo before reflection, without reopening failed practices', () => {
    const s = ready();
    expect(hunterAdventureActions(s).some(action => action.command.type === 'REFLECT')).toBe(false);
    rejection(s, { type: 'REFLECT' }, /六项/);
    buy(s);
    for (const id of HUNTER_PRACTICE_IDS.filter(id => id !== 'muddy-cart')) apply(s, { type: 'PRACTICE', practiceId: id });
    apply(s, { type: 'PRACTICE', practiceId: 'muddy-cart' }, 100);
    rejection(s, { type: 'REFLECT' }, /六项/);
    const attempts = structuredClone(s.hunter.practiceAttempts);
    apply(s, { type: 'CARGO_TALK' });
    rejection(s, { type: 'REFLECT' }, /六项/);
    expect(s.hunter.practiceAttempts).toEqual(attempts);
    rejection(s, { type: 'PRACTICE', practiceId: 'muddy-cart' }, /下周/);
    s.week += 1;
    apply(s, { type: 'PRACTICE', practiceId: 'muddy-cart' });
    apply(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100);
    expect(s.hunter.practiceAttempts['muddy-cart']).toBe(8);
  });

  it('cannot reflect before resolving cargo and still caps acting when other real sources already completed digestion', () => {
    const s = ready();
    buy(s);
    for (const id of HUNTER_PRACTICE_IDS) apply(s, { type: 'PRACTICE', practiceId: id });
    rejection(s, { type: 'REFLECT' }, /解决货运/);
    apply(s, { type: 'CARGO_TALK' }, 100);
    rejection(s, { type: 'REFLECT' }, /解决货运/);
    s.week += 1;
    apply(s, { type: 'CARGO_TALK' });
    s.progression.acting = 100;
    const mastery = totalMastery(s);
    apply(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100);
    expect(totalMastery(s)).toBe(mastery);
  });

  const blockers: [string, (s: SliceState) => void][] = [
    ['ordinary', s => { s.progression.pathwayId = null; s.progression.sequence = null; }],
    ['other pathway', s => { s.progression.pathwayId = 'diviner'; }],
    ['wrong city', s => { s.world.city = 'ELSEWHERE'; }],
    ['no actions', s => { s.actionsRemaining = 0; }],
    ['no health', s => { s.health = 0; }],
    ['no mind', s => { s.mind = 0; }],
    ['closed run', s => { s.status = 'DEAD'; }],
    ['active event', s => { s.activeEvent = { id: 'BLOCK', instanceId: 'block' }; }],
    ['active combat', s => { s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null }; }],
  ];
  it.each(blockers)('rejects %s before spending resources or drawing randomness', (_label, mutate) => {
    const s = ready();
    mutate(s);
    rejection(s, { type: 'PRACTICE', practiceId: 'muddy-cart' });
  });

  it('rejects forged practice IDs and acquisition commands in this handler', () => {
    const s = ready();
    rejection(s, { type: 'PRACTICE', practiceId: 'secret-identity' }, /未知/);
    rejection(s, { type: 'BUY_TRAP_KIT' }, /未知/);
  });
});

describe('physical hunter cargo trap conservation', () => {
  it('requires a successful practice and a real kit before preparing the known narrow entrance', () => {
    const s = ready();
    for (const command of [{ type: 'CARGO_TALK' }, { type: 'CARGO_FIGHT' }, { type: 'SET_TRAP', location: 'HUNTER_CARGO' }] as const) rejection(s, command, /至少一项/);
    apply(s, { type: 'PRACTICE', practiceId: 'muddy-cart' });
    rejection(s, { type: 'SET_TRAP', location: 'HUNTER_CARGO' }, /实际持有/);
    buy(s);
    const ap = s.actionsRemaining, health = s.health;
    const c = apply(s, { type: 'SET_TRAP', location: 'HUNTER_CARGO' });
    expect(stock(s)).toEqual([2, 0, 1, 0]);
    expect(s.hunter.trapLocation).toBe('HUNTER_CARGO');
    expect(s.actionsRemaining).toBe(ap - 1);
    expect(s.combat).toBeNull();
    expect(s.health).toBe(health);
    expect([c.checks, c.draws, c.awards]).toEqual([[], [], []]);
    expect(c.notes[0]!.text).toMatch(/此时没有敌人踏入/);
    expect(validateHunterAdventure(s)).toBe(true);
    buy(s);
    rejection(s, { type: 'SET_TRAP', location: 'HUNTER_CARGO' }, /已有原件/);
  });

  it('pays for an actual return trip and restores only the same untriggered kit', () => {
    const s = trapped(), ap = s.actionsRemaining, c = apply(s, { type: 'RECOVER_TRAP' });
    expect(stock(s)).toEqual([2, 1, 0, 0]);
    expect(s.hunter.trapLocation).toBeNull();
    expect(s.actionsRemaining).toBe(ap - 1);
    expect(c.notes[0]!.text).toContain('亲自回到货运狭口');
    rejection(s, { type: 'RECOVER_TRAP' }, /没有未触发/);
    apply(s, { type: 'SET_TRAP', location: 'HUNTER_CARGO' });
    expect(stock(s)).toEqual([2, 0, 1, 0]);
    expect(s.actionsRemaining).toBe(ap - 2);
  });

  it('does not teleport a trap from another city or erase the original left at the sealed first case', () => {
    const s = trapped();
    s.world.city = 'ELSEWHERE';
    rejection(s, { type: 'RECOVER_TRAP' }, /亲自到场/);
    s.world.city = 'BACKLUND';
    s.hunter.trapLocation = 'FIRST_CASE';
    const before = stock(s);
    rejection(s, { type: 'RECOVER_TRAP' }, /封存/);
    rejection(s, { type: 'SET_TRAP', location: 'HUNTER_CARGO' }, /已有原件/);
    expect(stock(s)).toEqual(before);
    expect(s.hunter.trapLocation).toBe('FIRST_CASE');
  });

  it('leaves unused originals on site after a peaceful resolution until a paid clear-scene recovery', () => {
    const s = trapped();
    apply(s, { type: 'CARGO_TALK' });
    expect(stock(s)).toEqual([2, 0, 1, 0]);
    expect(s.hunter.cargo.enemyStatus).toBe('SURRENDERED');
    const ap = s.actionsRemaining;
    apply(s, { type: 'RECOVER_TRAP' });
    expect(stock(s)).toEqual([2, 1, 0, 0]);
    expect(s.actionsRemaining).toBe(ap - 1);
    expect(s.hunter.cargo.status).toBe('RESCUED');
    expect(validateHunterAdventure(s)).toBe(true);
  });

  it('cannot reclaim a spent trap, replenish the three-kit stock or start a second cargo', () => {
    const s = trapped();
    s.hunter.trapDeployed = 0;
    s.hunter.trapSpent = 1;
    s.hunter.trapLocation = null;
    rejection(s, { type: 'RECOVER_TRAP' }, /没有未触发/);
    buy(s); buy(s);
    expect(stock(s)).toEqual([0, 2, 0, 1]);
    expect(() => buy(s)).toThrow(/售罄/);
    apply(s, { type: 'CARGO_TALK' });
    rejection(s, { type: 'CARGO_FIGHT' }, /不能重开/);
    rejection(s, { type: 'SET_TRAP', location: 'HUNTER_CARGO' }, /不能重开/);
    expect(stock(s)).toEqual([0, 2, 0, 1]);
  });
});

describe('ordinary cargo dispute, shared combat and original ownership', () => {
  it('settles a successful face-to-face negotiation for one action, 20 acting and one 8-point packet', () => {
    const s = prepared(), before = { original: original(s), ap: s.actionsRemaining, cash: s.cash, arc: structuredClone(s.arc), world: structuredClone(s.world), mastery: totalMastery(s) };
    const c = apply(s, { type: 'CARGO_TALK' });
    expect(c.checks).toEqual([['will', 14]]);
    expect(c.awards).toEqual([['hunter-cargo', 8]]);
    expect([s.actionsRemaining, s.progression.acting, totalMastery(s)]).toEqual([before.ap - 1, 32, before.mastery + 8]);
    expect(s.hunter.cargo).toMatchObject({ status: 'RESCUED', attemptWeek: 7, startHistoryIndex: null, enemyStatus: 'SURRENDERED' });
    expect(original(s)).toEqual(before.original);
    expect([s.cash, s.arc, s.world]).toEqual([before.cash, before.arc, before.world]);
    expect(s.combat).toBeNull();
    expect(validateHunterAdventure(s)).toBe(true);
    rejection(s, { type: 'CARGO_TALK' }, /不能重开/);
    rejection(s, { type: 'CARGO_FIGHT' }, /不能重开/);
  });

  it('failed negotiation retains the actual box and trap, prevents same-week rerolls and permits a new paid choice', () => {
    const s = trapped(), box = original(s), c = apply(s, { type: 'CARGO_TALK' }, 100);
    expect(s.hunter.cargo.status).toBe('AVAILABLE');
    expect(s.hunter.cargo.attemptWeek).toBe(7);
    expect(s.combat).toBeNull();
    expect(stock(s)).toEqual([2, 0, 1, 0]);
    expect(original(s)).toEqual(box);
    expect(c.awards).toEqual([]);
    rejection(s, { type: 'CARGO_TALK' }, /本周/);
    const ap = s.actionsRemaining;
    apply(s, { type: 'CARGO_FIGHT' });
    expect(s.actionsRemaining).toBe(ap - 1);
    expect(s.combat?.encounterId).toBe('HUNTER_CARGO');
    expect(stock(s)).toEqual([2, 0, 1, 0]);
    rejection(s, { type: 'RECOVER_TRAP' }, /战斗/);
    expect(validateHunterAdventure(s)).toBe(true);
  });

  it('permits another negotiation next week but never invents a fight or a cargo reward on failure', () => {
    const s = prepared();
    apply(s, { type: 'CARGO_TALK' }, 80);
    s.week += 1;
    apply(s, { type: 'CARGO_TALK' });
    expect(s.hunter.cargo.attemptWeek).toBe(8);
    expect(s.hunter.cargo.status).toBe('RESCUED');
    expect(s.seer.completedSources.filter(source => source === 'hunter-cargo')).toHaveLength(1);
  });

  it('starts the real ordinary encounter only after both sides arrive, without triggering an installed trap', () => {
    const s = trapped();
    s.combatHistory.push(round());
    const ap = s.actionsRemaining, box = original(s), c = apply(s, { type: 'CARGO_FIGHT' });
    expect(s.hunter.cargo.startHistoryIndex).toBe(1);
    expect(s.hunter.cargo.status).toBe('FIGHTING');
    expect(s.combat).toMatchObject({ encounterId: 'HUNTER_CARGO', round: 1, enemyHealth: 100, enemyStatus: 'RESISTING' });
    expect(s.actionsRemaining).toBe(ap - 1);
    expect(original(s)).toEqual(box);
    expect(stock(s)).toEqual([2, 0, 1, 0]);
    expect([c.checks, c.draws, c.awards]).toEqual([[], [], []]);
    expect(c.notes[0]!.text).toMatch(/双方在场/);
    expect(c.notes[0]!.text).toMatch(/开战本身不会触发/);
  });

  it.each(['ENEMY_SURRENDERED', 'ENEMY_DEAD'])('%s awards surviving effective combat once while preserving the cargo and unused kit', outcome => {
    const s = trapped(), box = original(s), mastery = totalMastery(s);
    apply(s, { type: 'CARGO_FIGHT' });
    s.combatHistory.push(round());
    s.combat!.enemyStatus = outcome === 'ENEMY_DEAD' ? 'DEAD' : 'SURRENDERED';
    const c = settle(s, outcome);
    expect(c.awards).toEqual([['hunter-cargo', 25]]);
    expect(totalMastery(s)).toBe(mastery + 25);
    expect(s.progression.acting).toBe(32);
    expect(s.hunter.cargo.status).toBe('RESCUED');
    expect(s.combat).toBeNull();
    expect(original(s)).toEqual(box);
    expect(stock(s)).toEqual([2, 0, 1, 0]);
    expect(validateHunterAdventure(s)).toBe(true);
    const before = JSON.stringify(s);
    expect(() => settle(s, outcome)).toThrow(/没有进行中/);
    expect(JSON.stringify(s)).toBe(before);
    apply(s, { type: 'RECOVER_TRAP' });
    expect(stock(s)).toEqual([2, 1, 0, 0]);
  });

  it('pure retreat earns nothing even with effective old combat history, and leaves untriggered originals at the resisted site', () => {
    const s = trapped(), box = original(s), mastery = totalMastery(s);
    s.combatHistory.push(round());
    apply(s, { type: 'CARGO_FIGHT' });
    s.combatHistory.push(round({ stance: 'RETREAT', moves: [], retreat: 'SUCCESS' }));
    const c = settle(s, 'RETREATED');
    expect(c.awards).toEqual([]);
    expect(totalMastery(s)).toBe(mastery);
    expect(s.progression.acting).toBe(12);
    expect(s.hunter.cargo.status).toBe('RETREATED');
    expect(original(s)).toEqual(box);
    expect(stock(s)).toEqual([2, 0, 1, 0]);
    expect(validateHunterAdventure(s)).toBe(true);
    rejection(s, { type: 'RECOVER_TRAP' }, /抵抗/);
    rejection(s, { type: 'CARGO_FIGHT' }, /不能重开/);
  });

  it('earns the survival packet for actual effective fighting before withdrawal but no completion acting', () => {
    const s = prepared();
    apply(s, { type: 'CARGO_FIGHT' });
    s.combatHistory.push(round(), round({ round: 2, stance: 'RETREAT', moves: [], retreat: 'SUCCESS' }));
    const c = settle(s, 'RETREATED');
    expect(c.awards).toEqual([['hunter-cargo', 25]]);
    expect(s.progression.acting).toBe(12);
    expect(s.hunter.cargo.status).toBe('RETREATED');
    expect(validateHunterAdventure(s)).toBe(true);
  });

  it('never awards combat growth or completion acting after the player dies', () => {
    const s = trapped(), box = original(s), mastery = totalMastery(s);
    apply(s, { type: 'CARGO_FIGHT' });
    s.combatHistory.push(round());
    s.health = 0;
    const c = settle(s, 'PLAYER_DEAD');
    expect(c.awards).toEqual([]);
    expect(totalMastery(s)).toBe(mastery);
    expect(s.progression.acting).toBe(12);
    expect(s.hunter.cargo.status).toBe('LOST');
    expect(original(s)).toEqual(box);
    expect(stock(s)).toEqual([2, 0, 1, 0]);
    expect(validateHunterAdventure(s)).toBe(true);
  });

  it('ignores enemy-only or ineffective player moves as growth evidence', () => {
    const s = prepared();
    apply(s, { type: 'CARGO_FIGHT' });
    s.combatHistory.push(round({ moves: [{ actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 }, { actor: 'PLAYER', label: '动作落空', selfGain: 0, enemyReduction: 0 }] }));
    const c = settle(s, 'RETREATED');
    expect(c.awards).toEqual([]);
    expect(s.progression.acting).toBe(12);
  });

  it('does not settle or award a still-running fight, and rejects unknown outcomes without changes', () => {
    const s = prepared();
    apply(s, { type: 'CARGO_FIGHT' });
    const before = JSON.stringify(s), c = settle(s, 'CONTINUE');
    expect(JSON.stringify(s)).toBe(before);
    expect([c.notes, c.awards]).toEqual([[], []]);
    expect(() => settle(s, 'MAGIC_WIN')).toThrow(/未知/);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('hunter adventure saved-state invariants', () => {
  const corruptions: [string, (s: SliceState) => void][] = [
    ['unknown practice', s => { s.hunter.observations.push('unknown'); }],
    ['duplicate practice', s => { s.hunter.observations.push('muddy-cart'); }],
    ['missing attempt', s => { delete s.hunter.practiceAttempts['muddy-cart']; }],
    ['future attempt', s => { s.hunter.practiceAttempts['muddy-cart'] = s.week + 1; }],
    ['unknown attempt', s => { s.hunter.practiceAttempts['unknown'] = s.week; }],
    ['unearned completion', s => { s.seer.completedSources = []; }],
    ['unrecorded completion', s => { s.seer.completedSources.push('hunter-practice:missing-hound'); }],
    ['fabricated kit', s => { s.hunter.trapHeld += 1; }],
    ['lost location', s => { s.hunter.trapLocation = null; }],
    ['double deployment', s => { s.hunter.trapStock -= 1; s.hunter.trapDeployed += 1; }],
    ['fake fight', s => { s.hunter.cargo.status = 'FIGHTING'; }],
    ['unearned cargo reward', s => { s.seer.completedSources.push('hunter-cargo'); }],
    ['unearned reflection', s => { s.seer.completedSources.push('hunter-reflection'); }],
    ['future cargo attempt', s => { s.hunter.cargo.attemptWeek = s.week + 1; }],
    ['out-of-bounds combat history', s => { s.hunter.cargo.startHistoryIndex = s.combatHistory.length + 1; }],
    ['changed original', s => { Object.assign(s.hunter.cargo, { originalId: 'replacement-box' }); }],
    ['changed owner', s => { Object.assign(s.hunter.cargo, { owner: 'player' }); }],
    ['transferred cargo', s => { Object.assign(s.hunter.cargo, { holder: 'PLAYER' }); }],
  ];
  it.each(corruptions)('rejects %s', (_label, mutate) => {
    const s = trapped();
    expect(validateHunterAdventure(s)).toBe(true);
    mutate(s);
    expect(validateHunterAdventure(s)).toBe(false);
  });

  it('requires an actual matching cargo encounter rather than borrowing another battle', () => {
    const s = prepared();
    apply(s, { type: 'CARGO_FIGHT' });
    s.combat!.encounterId = 'FIRST_CASE';
    expect(validateHunterAdventure(s)).toBe(false);
    expect(() => settle(s, 'RETREATED')).toThrow(/没有进行中/);
  });

  it('rejects a duplicate reflection source or a reflection after cargo was not completed', () => {
    const s = ready();
    buy(s);
    for (const id of HUNTER_PRACTICE_IDS) apply(s, { type: 'PRACTICE', practiceId: id });
    apply(s, { type: 'CARGO_TALK' });
    apply(s, { type: 'REFLECT' });
    expect(validateHunterAdventure(s)).toBe(true);
    s.seer.completedSources.push('hunter-reflection');
    expect(validateHunterAdventure(s)).toBe(false);
    s.seer.completedSources.pop();
    s.hunter.cargo.status = 'AVAILABLE';
    s.hunter.cargo.enemyStatus = 'RESISTING';
    s.seer.completedSources = s.seer.completedSources.filter(source => source !== 'hunter-cargo');
    expect(validateHunterAdventure(s)).toBe(false);
  });
});
