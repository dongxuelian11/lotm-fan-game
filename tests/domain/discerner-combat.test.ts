import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { PSYCHOLOGIST_COUNT_WHEEL } from '../../src/domain/psychologist/combat.js';
import { resolveDiscernerCombatRound } from '../../src/domain/slice/discerner-combat.js';
import { settleDiscernerEncounter, validateDiscernerEncounter } from '../../src/domain/discerner/encounter.js';
import {
  DISCERNER_ABILITIES, DISCERNER_COUNT_WHEEL, DISCERNER_ENEMY_COUNT_WHEEL, DISCERNER_ENEMY_ABILITY_WHEEL,
  discernerActionCount, discernerEnemyActionCount, discernerAbilityWheel, drawDiscernerAbility, drawDiscernerEnemyAbility,
  beginDiscernerCombatRound, currentDiscernerCombatSource, resolveDiscernerCombatAbility, resolveDiscernerEnemyAbility,
  finishDiscernerCombatRound, validateDiscernerRoundOutcome,
  type DiscernerMoveId, type DiscernerCombatSource,
} from '../../src/domain/discerner/combat.js';
import { audienceLegacyKeys, discernerContext, discernerSnapshot } from './discerner-test-fixture.js';

const IMPRINT = 'audience.s2.mental-imprint', INSIGHT = 'audience.s2.insight-window';
const noRandom: ActionRandomStream = { seed: 'discerner-unit-no-draw', cursor: 0, nextInt() { throw new Error('Unexpected extra draw'); } };
/** Explicit unit-only directed checks. Never persisted as a natural fixture or campaign result. */
const random = (...values: number[]): ActionRandomStream => {
  let index = 0;
  return { seed: 'discerner-unit-directed', cursor: 0, nextInt(min, max) {
    const value = values[index++]; if (value === undefined || value < min || value > max) throw new Error('Unexpected directed draw'); return value;
  } };
};
const begin = (s: SliceState) => beginDiscernerCombatRound(s, 'ATTACK', noRandom);
const effect = (s: SliceState, id: DiscernerMoveId, r: ReturnType<typeof begin>, rng = noRandom, source: DiscernerCombatSource | null = r.source) => resolveDiscernerCombatAbility(s, id, 1, rng, r, source);
const enemy = (s: SliceState, id: Parameters<typeof resolveDiscernerEnemyAbility>[1], r: ReturnType<typeof begin>) => resolveDiscernerEnemyAbility(s, id, 1, noRandom, r);
function finish(s: SliceState, r: ReturnType<typeof begin>, continuing = true) {
  const outcome = finishDiscernerCombatRound(s, r, continuing); expect(validateDiscernerRoundOutcome(outcome)).toBe(true); return outcome;
}
/** Directed RNG through the real adapter, consuming the real stream and saving
 * real round evidence. The selected winner does not threaten the losing enemy,
 * so depletion does not need a fabricated heal or history rewrite. */
function safeRound(s: SliceState, planned: 'PSYCHIC_STRIKE' | 'MENTAL_WARD' | 'COMPOSE', six = false) {
  const original = DeterministicActionRandomStream.prototype.nextInt, first = s.combat!.round % 2 === 1;
  let draws = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const index = draws++;
    if (index < 2) return six ? 96 : 1;
    if (max === 1_000_000) return 1;
    const isPlayer = (index - 2) % 2 === (first ? 0 : 1);
    if (!isPlayer) return planned === 'PSYCHIC_STRIKE' ? 1 : planned === 'MENTAL_WARD' ? 31 : 51;
    let before = 0;
    for (const ability of DISCERNER_ABILITIES) {
      if (ability.id === 'OBSERVE') return before + 1;
      before += ability.weight * (ability.stance === 'ATTACK' ? 5 : 4);
    }
    throw new Error('Missing original OBSERVE slot');
  });
  try {
    const result = resolveDiscernerCombatRound(s, 'ATTACK'); expect(result.outcome).toBe('CONTINUE');
    expect(draws).toBe(six ? 15 : 5);
    s.combatHistory.push(structuredClone(result.round)); settleDiscernerEncounter(s, result.outcome, discernerContext(s));
    expect(validateDiscernerEncounter(s)).toBe(true); expect(validateDiscernerRoundOutcome(result.round.discernerOutcome)).toBe(true);
    return result.round;
  } finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('Discerner paid finite combat with strict original-source replay', () => {
  it('uses the actual inherited six-count constants and exposes both own and enemy wheels exactly', () => {
    const s = discernerSnapshot('combatStart'), publicCombat = projectSliceState(s).combat!;
    expect(currentDiscernerCombatSource(s)).toMatchObject({ targetId: 'DCR2-ALRIC-VALE', targetAge: 47, targetSequence: 2, targetPhysique: 22, enemyWeapon: 'DCR2-ALRIC-CLUB', independentMind: true, actualOriginalBody: true });
    expect(DISCERNER_COUNT_WHEEL).toEqual(PSYCHOLOGIST_COUNT_WHEEL); expect(DISCERNER_ENEMY_COUNT_WHEEL).toEqual(PSYCHOLOGIST_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3], [61, 4], [80, 4], [81, 5], [95, 5], [96, 6], [100, 6]]) {
      expect(discernerActionCount(roll!)).toBe(count); expect(discernerEnemyActionCount(roll!)).toBe(count);
    }
    expect(publicCombat.playerCountWheel).toEqual(DISCERNER_COUNT_WHEEL); expect(publicCombat.enemyCountWheel).toEqual(DISCERNER_ENEMY_COUNT_WHEEL);
    const playerLabels = ["近距有限心灵印记（每轮一次6S+2M/意志18；抵抗有效/减势30）", "有限洞察窗口（每轮一次5S+1M/意志18；护持与抵抗有效/优势42×掌握）", "近真梦像（6S/意志18；实际信以为真才−6M/优势38×掌握）", "一具外部身份牵制（5S+2M/意志16；至多60秒6米/减势26）", "继承心灵岛屿（4S/意志16；−8M/优势42×掌握）", "继承本人防守人格（3S+1M；减势24）", "继承鳞片（2S/减势14×掌握；不足普通自保）", "继承有限精神瘟疫（4S/意志18；仅播种一次，离场不净化）", "本人原身体/实际在手原棍（12/16×身体）", "观察真实原人（0消耗/0贡献，不全知）", "判断失衡（固定−22.5）"];
    const enemyLabels = ["原有限心灵冲击：7S/贡献95", "原有限精神护持：6S/减势55；本轮抵挡新印记/窗口", "实际精神抵抗：3S/下一次梦像、印记或窗口抵抗30%→70%", "自己的唯一原棍：20×身体", "普通观察原身体与原出口：0贡献", "判断偏差：−22.5"];
    expect(publicCombat.playerAbilityWheel).toEqual(discernerAbilityWheel(s, null).map((entry,index)=>({...entry,label:playerLabels[index]})));
    expect(publicCombat.enemyAbilityWheel).toEqual(DISCERNER_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:enemyLabels[index]})));
    for (const stance of ['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE'] as const) {
      expect(publicCombat.playerAbilityWheels?.[stance]).toEqual(discernerAbilityWheel(s, stance).map((entry,index)=>({...entry,label:playerLabels[index]})));
      expect(discernerAbilityWheel(s, stance).reduce((sum, a) => sum + a.weight, 0)).toBeCloseTo(100);
    }
    expect(publicCombat.playerAbilityWheels?.RETREAT).toEqual([]);
    expect(discernerAbilityWheel(s, null).filter(a => a.id.startsWith('audience.s2.')).map(a => a.id)).toEqual([IMPRINT, INSIGHT]);
    expect(drawDiscernerAbility(random(1), s, 'ATTACK')).toBe(IMPRINT); expect(drawDiscernerEnemyAbility(random(1))).toBe('PSYCHIC_STRIKE');
  });

  it('charges and counts each new finite ability once without extra independent actions or corresponding free mastery', () => {
    const s = discernerSnapshot('combatStart'), old = structuredClone(s), r = begin(s), spirit = s.spirituality, mind = s.mind;
    expect(effect(s, IMPRINT, r, random(1, 100))).toMatchObject({ selfGain: 0, enemyReduction: 30 });
    expect(effect(s, INSIGHT, r, random(1, 100)).selfGain).toBe(42 * (1 + r.source.mastery[INSIGHT]! / 500));
    const paid = structuredClone(s);
    expect(effect(s, IMPRINT, r)).toMatchObject({ selfGain: 0, enemyReduction: 10 });
    expect(effect(s, INSIGHT, r)).toMatchObject({ selfGain: 0, enemyReduction: 10 }); expect(s).toEqual(paid);
    const o = finish(s, r);
    expect(o).toMatchObject({ mentalImprintUses: 1, mentalImprintSuccesses: 1, insightWindowUses: 1, insightWindowSuccesses: 1, ownerMindSpent: 3, totalOwnerMindSpent: 3, playerSpiritualityAfter: spirit - 11, playerMindAfter: mind - 3 });
    expect(o.playerActions.map(a => a.finiteResult)).toEqual(['APPLIED', 'APPLIED', 'ALREADY_ATTEMPTED', 'ALREADY_ATTEMPTED']);
    expect(o.playerActions.map(a => a.paidCost)).toEqual([6, 5, 0, 0]); expect(o.enemyActions).toEqual([]);
    expect(s.progression.mastery).toEqual(old.progression.mastery);
    for (const key of audienceLegacyKeys) expect(s[key]).toEqual(old[key]);
  });

  it.each([IMPRINT, INSIGHT] as const)('does not retry %s after a genuinely paid failed check', id => {
    const s = discernerSnapshot('combatStart'), r = begin(s);
    expect(effect(s, id, r, random(100))).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    effect(s, id, r); const o = finish(s, r);
    expect(o.playerActions.map(a => a.finiteResult)).toEqual(['FAILED', 'ALREADY_ATTEMPTED']);
    expect(o.playerActions[0]!.rolls).toEqual([100]); expect(o.playerActions[1]!.rolls).toEqual([]);
    expect(o.mentalImprintSuccesses + o.insightWindowSuccesses).toBe(0);
  });

  it('honors the enemy’s actually paid ward for both new attempts without a free resistance roll or advantage', () => {
    const s = discernerSnapshot('combatStart'), r = begin(s);
    expect(enemy(s, 'MENTAL_WARD', r)).toMatchObject({ enemyReduction: 55 });
    effect(s, IMPRINT, r, random(1)); effect(s, INSIGHT, r, random(1)); const o = finish(s, r);
    expect(o.enemySpirituality).toBe(114); expect(o.powerUses.MENTAL_WARD).toBe(1);
    expect(o.playerActions.map(a => [a.finiteResult, a.paidCost, a.ownerMindSpent, a.selfGain, a.enemyReduction])).toEqual([
      ['WARDED', 6, 2, 0, 0], ['WARDED', 5, 1, 0, 0],
    ]);
    expect(o).toMatchObject({ mentalImprintUses: 1, insightWindowUses: 1, mentalImprintSuccesses: 0, insightWindowSuccesses: 0, wardActiveAfter: false });
  });

  it.each([IMPRINT, INSIGHT] as const)('uses paid COMPOSE only for the next eligible %s resistance and does not stack it', id => {
    const s = discernerSnapshot('combatStart'), r = begin(s);
    enemy(s, 'COMPOSE', r); enemy(s, 'COMPOSE', r);
    effect(s, id, r, random(1, 50)); effect(s, id === IMPRINT ? INSIGHT : IMPRINT, r, random(1, 50)); const o = finish(s, r);
    expect(o.enemyActions.map(a => [a.actual, a.paidCost])).toEqual([['COMPOSE', 3], ['OBSERVE', 0]]);
    expect(o.playerActions.map(a => a.finiteResult)).toEqual(['RESISTED', 'APPLIED']);
    expect(o.enemySpirituality).toBe(117); expect(o.resistanceActiveAfter).toBe(false);
  });

  it.each(['spirit', 'mind'] as const)('uses ordinary self-protection when %s cannot pay, with no check, refund or use counter', cause => {
    const s = discernerSnapshot('combatStart');
    // Explicit unit-only exhausted starting resource, not natural-play evidence.
    if (cause === 'spirit') s.spirituality = 4; else s.mind = 1;
    const before = structuredClone(s), r = begin(s);
    expect(effect(s, IMPRINT, r)).toMatchObject({ selfGain: 0, enemyReduction: 10 });
    expect(effect(s, INSIGHT, r)).toMatchObject({ selfGain: 0, enemyReduction: 10 }); expect(s).toEqual(before);
    const o = finish(s, r); expect(o.playerActions.map(a => a.finiteResult)).toEqual(['INSUFFICIENT', 'INSUFFICIENT']);
    expect(o.mentalImprintUses + o.insightWindowUses).toBe(0); expect(o.playerActions.every(a => a.paidCost === 0 && a.ownerMindSpent === 0 && a.rolls.length === 0)).toBe(true);
  });

  it('preserves actual S3 identity/image and S4 personality/island/plague/scales as six paid old slots', () => {
    const s = discernerSnapshot('combatStart'), old = structuredClone(s), r = begin(s);
    effect(s, 'audience.s3.external-identity', r, random(1)); effect(s, 'audience.s3.woven-image', r, random(1, 100));
    effect(s, 'audience.s4.mind-island', r, random(1)); effect(s, 'audience.s4.virtual-persona', r);
    effect(s, 'audience.s6.scales', r); effect(s, 'audience.s4.mental-plague', r, random(1));
    const o = finish(s, r); expect(o.playerActions).toHaveLength(6);
    expect(o.playerActions.map(a => a.paidCost)).toEqual([5, 6, 4, 3, 2, 4]);
    expect(o).toMatchObject({ playerSpiritualityAfter: old.spirituality - 24, playerMindAfter: old.mind - 3, enemyMind: 86, wovenMindDamage: 6, islandMindDamage: 8, enemyMentalPlague: 1, plagueApplications: 1, identityUses: 1, wovenImageUses: 1, personaGuards: 1, identityActiveAfter: false, wovenImageActiveAfter: false, mentalImprintUses: 0, insightWindowUses: 0 });
    for (const key of audienceLegacyKeys) expect(s[key]).toEqual(old[key]);
    expect(s.progression.mastery).toEqual(old.progression.mastery);
  });

  it('spends the original independent 120 S through 17 genuine 7-S attacks before original-club fallback', () => {
    const s = discernerSnapshot('combatStart'), original = structuredClone(s);
    for (let i = 1; i <= 17; i++) {
      const o = safeRound(s, 'PSYCHIC_STRIKE').discernerOutcome!;
      expect(o.enemySpirituality).toBe(120 - 7 * i); expect(o.powerUses.PSYCHIC_STRIKE).toBe(i);
    }
    for (const id of ['PSYCHIC_STRIKE', 'MENTAL_WARD', 'COMPOSE'] as const) {
      const o = safeRound(s, id).discernerOutcome!;
      expect(o.enemyActions[0]).toMatchObject({ planned: id, actual: 'BODY_STRIKE', paidCost: 0, selfGain: 20 });
      expect(o.enemySpirituality).toBe(1); expect(o.powerUses).toEqual({ PSYCHIC_STRIKE: 17, MENTAL_WARD: 0, COMPOSE: 0 });
    }
    expect(s.health).toBe(original.health); expect(s.discerner.encounter.enemyHealth).toBe(100);
    for (const key of audienceLegacyKeys) expect(s[key]).toEqual(original[key]);
    expect(() => assertValidSliceState(s)).not.toThrow();
  });

  it('accepts all twelve actual slots and keeps only CONTINUE’s existing 12-S recovery', () => {
    const s = discernerSnapshot('combatStart'); s.spirituality = 60; // Unit-only starting budget.
    const round = safeRound(s, 'MENTAL_WARD', true), o = round.discernerOutcome!;
    expect([round.playerCount, round.enemyCount, round.moves.length]).toEqual([6, 6, 12]);
    expect(o.playerActions).toHaveLength(6); expect(o.enemyActions).toHaveLength(6);
    expect(o.enemySpirituality).toBe(84); expect(o.playerSpiritualityAfter).toBe(60); expect(s.spirituality).toBe(72);
    expect(() => assertValidSliceState(s)).not.toThrow();
  });

  it('rejects unknown moves, stale original source, altered live resources and double completion without hidden draws', () => {
    const s = discernerSnapshot('combatStart'), r = begin(s), before = structuredClone(s);
    for (const source of [null, { ...r.source, targetId: 'DWV3-OSMOND' }, { ...r.source, enemyWeapon: 'COPY' }, { ...r.source, revision: r.source.revision + 1 }])
      expect(effect(s, IMPRINT, r, noRandom, source as DiscernerCombatSource | null).selfGain).toBe(0);
    expect(effect(s, 'FREE_TRUTH' as DiscernerMoveId, r).selfGain).toBe(0); expect(s).toEqual(before);
    const o = finish(s, r); expect(o.playerActions).toEqual([]); expect(() => finishDiscernerCombatRound(s, r)).toThrow();
    const changed = discernerSnapshot('combatStart'), live = begin(changed); changed.spirituality--;
    const afterTamper = structuredClone(changed); expect(effect(changed, IMPRINT, live).selfGain).toBe(0);
    expect(enemy(changed, 'PSYCHIC_STRIKE', live).selfGain).toBe(0); expect(changed).toEqual(afterTamper);
    expect(() => finishDiscernerCombatRound(changed, live)).toThrow();
  });

  it('retains an actual directed public death with no resurrection, ordinary work or exit travel', () => {
    const s = discernerSnapshot('combatStart'), old = structuredClone(s), original = DeterministicActionRandomStream.prototype.nextInt;
    let observeTicket = 1;
    for (const a of DISCERNER_ABILITIES) { if (a.id === 'OBSERVE') break; observeTicket += a.weight * (a.stance === 'ATTACK' ? 5 : 4); }
    // Explicit unit-only RNG: one nonthreatening player observation, enemy psychic
    // strike, player loses, real shared 65/30/5 injury roll enters DEATH.
    const rolls = [1, 1, observeTicket, 1, 1_000_000, 100]; let index = 0;
    const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
      original.call(this, min, max); const n = rolls[index++];
      if (n === undefined || n < min || n > max) throw new Error('Unexpected directed death draw'); return n;
    });
    let dead: SliceState;
    try { dead = applySliceIntent(s, { type: 'COMBAT_ROUND', stance: 'ATTACK' }); } finally { spy.mockRestore(); }
    expect(index).toBe(6); assertValidSliceState(dead);
    expect(dead.status).toBe('DEAD'); expect(dead.health).toBe(0); expect(dead.combat).toBeNull();
    expect(dead.discerner.encounter).toMatchObject({ status: 'LOST', exitTravelMetres: 0, exitSeconds: 0, enemySpirituality: 113, weaponLocation: 'HAND', terminal: { outcome: 'PLAYER_DEAD' } });
    expect(dead.lastCombatRound!.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(dead.lastCombatRound!.consequenceRoll).toBe(100); expect(dead.spirituality).toBe(old.spirituality);
    for (const key of audienceLegacyKeys) expect(dead[key]).toEqual(old[key]);
    expect(s).toEqual(old);
    expect(() => applySliceIntent(dead, { type: 'ACTION', action: 'WORK' })).toThrow();
    expect(() => applySliceIntent(dead, { type: 'DISCERNER', command: { type: 'LEAVE_ENCOUNTER' } })).toThrow();
  });

  it('replays every cost/counter/result and rejects refunded, duplicated, forged or source-replaced outcomes', () => {
    const s = discernerSnapshot('combatStart'), r = begin(s); effect(s, IMPRINT, r, random(1, 100)); enemy(s, 'COMPOSE', r); effect(s, INSIGHT, r, random(1, 50));
    const o = finish(s, r), edits: ((value: typeof o) => void)[] = [
      x => { x.playerSpiritualityAfter++; }, x => { x.playerMindAfter++; }, x => { x.enemySpirituality++; },
      x => { x.mentalImprintUses = 0; }, x => { x.mentalImprintSuccesses = 0; }, x => { x.insightWindowSuccesses = 1; },
      x => { x.totalOwnerMindSpent = 0; }, x => { x.playerActions[0]!.paidCost = 0; },
      x => { x.playerActions[0]!.rolls.push(100); }, x => { x.playerActions[0]!.finiteResult = 'WARDED'; },
      x => { x.playerActions.push({ ...structuredClone(x.playerActions[0]!), order: 3 }); },
      x => { x.enemyActions[0]!.order = 0; }, x => { x.source.enemySpirituality = 119; },
      x => { (x.source as unknown as Record<string, unknown>).privateInventory = ['SECRET']; },
      x => { x.elapsedSeconds = 0 as 60; },
    ];
    for (const edit of edits) { const bad = structuredClone(o); edit(bad); expect(validateDiscernerRoundOutcome(bad)).toBe(false); }
    expect(validateDiscernerRoundOutcome(JSON.parse(stableStringify(o)))).toBe(true);
  });
});
