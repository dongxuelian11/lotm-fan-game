import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  PUNISHMENT_KNIGHT_COUNT_WHEEL, createPunishmentKnightRoundContext, currentPunishmentKnightCombatSource,
  drawPunishmentKnightAbility, finishPunishmentKnightCombatRound, isPunishmentKnight,
  punishmentKnightAbilityWheel, punishmentKnightActionCount, punishmentKnightEnemyProhibition,
  recordPunishmentKnightBreach, consumePunishmentKnightConfinement, resolvePunishmentKnightCombatAbility,
  type PunishmentKnightCombatSource, type PunishmentKnightMoveId,
} from '../../src/domain/punishment-knight/combat.js';
import { createPunishmentKnightState } from '../../src/domain/punishment-knight/index.js';
import { applyPunishmentKnightEncounter, blockPunishmentKnightEncounter,
  settlePunishmentKnightEncounter, validatePunishmentKnightEncounter } from '../../src/domain/punishment-knight/encounter.js';
import { createJudgeState } from '../../src/domain/judge/index.js';
import { JUDGE_COUNT_WHEEL, currentJudgeCombatSource, judgeAbilityWheel } from '../../src/domain/judge/combat.js';
import { currentInterrogatorCombatSource } from '../../src/domain/interrogator/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'justiciar.s9.combat-training', J = 'justiciar.s5.wound-verdict', B = 'justiciar.s7.mental-puncture';
const K = 'justiciar.s6.prohibition', R = 'justiciar.s5.confinement', A = 'ACCIDENT';
const punishment = 'justiciar.s5.punishment', trace = 'justiciar.s8.trace-sensing';
const ids = [H, J, B, K, R, A] as const;
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('punishment-knight-combat-test', sliceDefaultCreationSelection, 'punishment-knight-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND';
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'justiciar', sequence: 5, mastery: {
    [H]: 0, 'justiciar.s9.authority': 0, 'justiciar.s9.persuasive-charisma': 0,
    [trace]: 0, 'justiciar.s8.image-reconstruction': 0, [B]: 0, 'justiciar.s7.mental-pressure': 0,
    [K]: 0, 'justiciar.s6.authority': 0, [punishment]: 0, [J]: 0, [R]: 0,
  }, acting: 0, promotionWeek: 1 };
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED'; s.world.carrierAlive = true; s.world.carrierCanResist = true;
  s.judge = createJudgeState();
  s.judge.encounter = { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 };
  Object.assign(s.judge.cases['calm-room']!, { status: 'RESOLVED', method: 'ORDINARY' });
  s.punishmentKnight = createPunishmentKnightState(); s.punishmentKnight.promotionWeek = s.week;
  s.punishmentKnight.encounter = { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 };
  Object.assign(s.punishmentKnight.cases['breach-and-pad']!, { status: 'RESOLVED', method: 'ORDINARY', closes: 1 });
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'PUNISHMENT_KNIGHT_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-punishment-test', get cursor() { return cursor; }, nextInt(min, max) {
    const value = rolls[cursor++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(s: SliceState, id: PunishmentKnightMoveId, physical = 1,
  context = createPunishmentKnightRoundContext(s), random = fixedRolls(), source = currentPunishmentKnightCombatSource(s)) {
  return resolvePunishmentKnightCombatAbility(s, id, physical, random, context, source);
}
function wound(s: SliceState, player = false): void {
  (player ? s.injuries : s.combat!.enemyInjuries).push({ id: 'actual-prior-wound', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null });
  if (player) s.health = 90; else s.combat!.enemyHealth = 90;
}
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, min, max,
  ) {
    original.call(this, min, max);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(min); expect(value).toBeLessThanOrEqual(max); return value;
  });
}
function encounterContext(s: SliceState, roll = 1): SeerContext {
  return { note: vi.fn(), roll: min => min, check: (ability, difficulty) => resolveNormalCheck({
    ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll,
  }) };
}
afterEach(() => vi.restoreAllMocks());

describe('Punishment Knight S5 profile and exact inherited isolation', () => {
  it('routes only justiciar5 to six30/15/25/10/15/5 slots and six12/20/25/23/14/6 counts', () => {
    const s = fixture(); expect(isPunishmentKnight(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(punishmentKnightAbilityWheel(null, s));
    expect(playerAbilityWheel(s, null).map(e => e.id)).toEqual(ids);
    expect(playerAbilityWheel(s, null).map(e => e.weight)).toEqual([30,15,25,10,15,5]);
    expect(playerCountWheel(s)).toEqual(PUNISHMENT_KNIGHT_COUNT_WHEEL);
    expect(playerCountWheel(s).map(e => e.weight)).toEqual([12,20,25,23,14,6]);
    playerCountWheel(s)[0]!.weight = 0; playerAbilityWheel(s, null)[0]!.weight = 0;
    expect(playerCountWheel(s)[0]!.weight).toBe(12); expect(playerAbilityWheel(s,null)[0]!.weight).toBe(30);
    expect(Object.isFrozen(PUNISHMENT_KNIGHT_COUNT_WHEEL)).toBe(true);
    expect(PUNISHMENT_KNIGHT_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
    expect(Object.keys(s.progression.mastery).filter(id => id.includes('.s5.')).sort()).toEqual([punishment,J,R].sort());
    s.progression.pathwayId = 'black-emperor'; expect(isPunishmentKnight(s)).toBe(false);
  });
  it('retains every count boundary and precise1.25 stance tickets, B attack and K/R control', () => {
    for (const [roll,count] of [[1,1],[12,1],[13,2],[32,2],[33,3],[57,3],[58,4],[80,4],[81,5],[94,5],[95,6],[100,6]])
      expect(punishmentKnightActionCount(roll!)).toBe(count);
    for (const stance of [null,'ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0,1,2] : stance === 'CONTROL' ? [3,4] : [];
      const weights = [30,15,25,10,15,5].map((w,i) => w * (boosted.includes(i) ? 5 : 4));
      const total = weights.reduce((a,b) => a+b,0); let boundary = 0;
      punishmentKnightAbilityWheel(stance).forEach((entry,i) => {
        expect(entry.weight).toBe(total === 400 ? weights[i]! / 4 : weights[i]! / total * 100);
        const first = boundary + 1; boundary += weights[i]!; const random = fixedRolls(first,boundary);
        expect(drawPunishmentKnightAbility(random,stance)).toBe(ids[i]);
        expect(drawPunishmentKnightAbility(random,stance)).toBe(ids[i]); expect(random.cursor).toBe(2);
      });
    }
  });
  it('does not broaden old Judge6 or Interrogator7 gates and preserves Judge wheels', () => {
    const s = fixture(); expect(currentJudgeCombatSource(s)).toBeNull(); expect(currentInterrogatorCombatSource(s)).toBeNull();
    s.progression.sequence = 6; s.combat!.encounterId = 'JUDGE_DISPUTE';
    expect(playerAbilityWheel(s,null)).toEqual(judgeAbilityWheel(null,s)); expect(playerCountWheel(s)).toEqual(JUDGE_COUNT_WHEEL);
    expect(currentJudgeCombatSource(s)).not.toBeNull(); expect(currentPunishmentKnightCombatSource(s)).toBeNull();
    s.progression.sequence = 5; expect(currentJudgeCombatSource(s)).toBeNull(); expect(currentPunishmentKnightCombatSource(s)).toBeNull();
  });
  it('uses G900 core and max100 recovery without changing original enemy core', () => {
    const s = fixture(); s.spirituality = 80; const rolls = scriptRolls(1,1,381,381,1);
    const {round,outcome} = resolveSliceCombatRound(s,'DEFEND');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(915 - 22.5);
    expect(round.enemyAdvantage).toBe(114); expect(s.spirituality).toBe(90); expect(rolls).toHaveBeenCalledTimes(5);
  });
});

describe('Inherited budgets and actual prior wound requirement', () => {
  it('keeps H50.7/J35.49 on original body mastery and actual HAND16 only', () => {
    for (const mastery of [0,100,500]) for (const location of ['SHOP','BAG','HAND'] as const) {
      const s = fixture(); s.progression.mastery[H] = mastery; s.progression.mastery[punishment] = 500; s.progression.mastery[J] = 500;
      s.town.clubLocation = location; const before = structuredClone(s), f = .65 + .35 * mastery / 500;
      expect(resolve(s,H,.8).selfGain).toBe((location === 'HAND' ? 16 : 50.7*f)*.8);
      expect(resolve(s,J,.8).selfGain).toBe(35.49*f*.8); expect(s).toEqual(before);
    }
  });
  it('never treats player injuries or low enemy health alone as a wound-verdict source', () => {
    const s = fixture(); wound(s,true); s.combat!.enemyHealth = 1; const before = structuredClone(s), random = fixedRolls();
    const effect = resolve(s,J,1,undefined,random);
    expect(effect.selfGain).toBe(35.49*.65); expect(effect.label).toContain('没有实际已记录的敌方既有伤口');
    expect(effect.label).toContain('不宣告死亡'); expect(s).toEqual(before); expect(random.cursor).toBe(0);
  });
  it('pays3 for existing-enemy-wound knowledge14 success/failure without directly changing health', () => {
    for (const mastery of [0,100,500]) for (const [roll,success] of [[52,true],[53,false]] as const) {
      const s = fixture(); wound(s); s.progression.mastery[J] = mastery;
      const before = structuredClone(s), random = fixedRolls(roll), effect = resolve(s,J,0,undefined,random);
      expect(effect.selfGain).toBe(success ? 45*(.65+.35*mastery/500) : 0); expect(effect.threatens).toBe(success);
      before.spirituality -= 3; expect(s).toEqual(before); expect(random.cursor).toBe(1);
      expect(effect.label).toContain('不直接改健康'); expect(effect.label).toContain('不设低血处决');
    }
  });
  it('treats insufficient-spirit wound J as ordinary body action, without paid check or free verdict', () => {
    const s = fixture(); wound(s); s.spirituality = 2; const context = createPunishmentKnightRoundContext(s);
    context.prohibitionPending = true; const random = fixedRolls(1), before = structuredClone(s);
    expect(resolve(s,J,1,context,random)).toMatchObject({selfGain:0,enemyReduction:0,threatens:false});
    expect(s).toEqual(before); expect(random.cursor).toBe(1); expect(context.prohibitionPending).toBe(false);
  });
  it('actual wound verdict is not a body close-strike and leaves the pending rule for the next body slot', () => {
    const s = fixture(); wound(s); const c = createPunishmentKnightRoundContext(s); resolve(s,K,1,c);
    const random = fixedRolls(1); expect(resolve(s,J,0,c,random).selfGain).toBe(45*.65);
    expect(c.prohibitionPending).toBe(true); expect(s.spirituality).toBe(94); expect(random.cursor).toBe(1);
    expect(resolve(s,H,1,c,fixedRolls(1)).selfGain).toBe(0); expect(c.prohibitionPending).toBe(false);
  });
  it('B keeps original55+floor20m/500 roll and42.25 budget without physical injury permission', () => {
    for (const mastery of [0,100,500]) for (const success of [true,false]) {
      const s = fixture(); s.progression.mastery[B] = mastery;
      const threshold = 55 + Math.floor(20*mastery/500), random = fixedRolls(threshold+(success?0:1));
      expect(resolve(s,B,0,undefined,random)).toMatchObject({ selfGain: success ? 42.25*(.65+.35*mastery/500) : 0, enemyReduction:0, threatens:false });
      expect(s.spirituality).toBe(97); expect(random.cursor).toBe(1); expect(s.combat!.enemyHealth).toBe(100);
    }
  });
  it('zero/nonfinite spirit pays nothing, draws nothing and uses only documented ordinary fallbacks', () => {
    for (const spirituality of [0,1,2.99,NaN,Infinity]) {
      const s = fixture(); s.spirituality = spirituality; const before = structuredClone(s), random = fixedRolls();
      expect(resolve(s,B,.8,undefined,random).enemyReduction).toBe(42.25*.65*.8);
      expect(resolve(s,K,.8,undefined,random).enemyReduction).toBe(6*.8);
      expect(resolve(s,R,.8,undefined,random).selfGain).toBe(0);
      expect(resolve(s,A,.8,undefined,random).selfGain).toBe(-22.5);
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Finite single-attempt prohibition, actual breach and paid punishment', () => {
  it('K pays3 with no immediate roll/contribution and duplicate pending declarations cost0/draw0', () => {
    const s = fixture(), c = createPunishmentKnightRoundContext(s), random = fixedRolls();
    expect(resolve(s,K,1,c,random)).toMatchObject({selfGain:0,enemyReduction:0,threatens:false});
    expect(c.prohibitionPending).toBe(true); expect(s.spirituality).toBe(97); expect(random.cursor).toBe(0);
    expect(resolve(s,K,1,c,random).label).toContain('重复K'); expect(s.spirituality).toBe(97); expect(random.cursor).toBe(0);
  });
  it('first real enemy STRIKE consumes one resistance and blocked action does not create breach', () => {
    for (const mastery of [0,100,500]) {
      const s = fixture(); s.progression.mastery[K] = mastery; const c = createPunishmentKnightRoundContext(s); resolve(s,K,1,c);
      const random = fixedRolls(55+20*mastery/500), response = punishmentKnightEnemyProhibition(s,c,'STRIKE',random)!;
      expect(response).toMatchObject({blocked:true,resisted:false}); expect(random.cursor).toBe(1);
      expect(c.prohibitionPending).toBe(false); expect(recordPunishmentKnightBreach(s,c,'STRIKE',0,response.resisted)).toBeNull();
      expect(c.breachReady).toBe(false); expect(punishmentKnightEnemyProhibition(s,c,'STRIKE',fixedRolls())).toBeNull();
      expect(resolve(s,H).selfGain).toBe(50.7*.65);
    }
  });
  it('MISS/OPENING/intention/suppressed action cannot trigger resistance or establish a real breach', () => {
    const s = fixture(), c = createPunishmentKnightRoundContext(s); resolve(s,K,1,c); const random = fixedRolls();
    for (const id of ['MISS','OPENING','BLOCK','DISTANCE','INTENT_STRIKE']) {
      expect(punishmentKnightEnemyProhibition(s,c,id,random)).toBeNull();
      expect(recordPunishmentKnightBreach(s,c,id,16,true)).toBeNull();
    }
    expect(punishmentKnightEnemyProhibition(s,c,'STRIKE',random,true)).toBeNull();
    expect(c.prohibitionPending).toBe(true); expect(c.breachReady).toBe(false); expect(random.cursor).toBe(0);
    for (const gain of [0,-1,NaN,Infinity]) expect(recordPunishmentKnightBreach(s,c,'STRIKE',gain,true)).toBeNull();
  });
  it('failed enemy resistance check only enables punishment after actual positive strike, then one H pays3', () => {
    for (const mastery of [0,100,500]) for (const location of ['SHOP','HAND'] as const) {
      const s = fixture(); s.progression.mastery[punishment] = mastery; s.town.clubLocation = location;
      const c = createPunishmentKnightRoundContext(s); resolve(s,K,1,c);
      const response = punishmentKnightEnemyProhibition(s,c,'STRIKE',fixedRolls(56))!;
      expect(response).toMatchObject({blocked:false,resisted:true}); expect(c.breachReady).toBe(false);
      expect(recordPunishmentKnightBreach(s,c,'STRIKE',16,response.resisted)).toContain('实际正贡献STRIKE');
      const effect = resolve(s,H,.8,c), base = (location === 'HAND' ? 16 : 50.7*.65)*.8;
      expect(effect.selfGain).toBe(base+20*(.65+.35*mastery/500)*.8); expect(effect.label).toContain('不是额外行动');
      expect(s.spirituality).toBe(94); expect(c.breachReady).toBe(false);
      expect(resolve(s,H,.8,c).selfGain).toBe(base); expect(s.spirituality).toBe(94);
    }
  });
  it('own H/J obey the same pending rule before any punishment and never reward own violation', () => {
    for (const id of [H,J] as const) for (const roll of [1,100]) {
      const s = fixture(), c = createPunishmentKnightRoundContext(s); resolve(s,K,1,c);
      const random = fixedRolls(roll), effect = resolve(s,id,1,c,random);
      expect(effect.selfGain).toBe(roll===1 ? 0 : (id===H ? 50.7 : 35.49)*.65);
      expect(c.breachReady).toBe(false); expect(c.prohibitionPending).toBe(false); expect(random.cursor).toBe(1); expect(s.spirituality).toBe(97);
    }
    const s = fixture(), c = createPunishmentKnightRoundContext(s); c.breachReady = true; resolve(s,K,1,c);
    expect(resolve(s,H,1,c,fixedRolls(1)).selfGain).toBe(0); expect(s.spirituality).toBe(97); expect(c.breachReady).toBe(true);
    expect(resolve(s,H,1,c).selfGain).toBe(50.7*.65+20*.65); expect(s.spirituality).toBe(94);
  });
  it('insufficient3 leaves pending real breach without granting free budget; round end erases all three flags', () => {
    const s = fixture(), c = createPunishmentKnightRoundContext(s); c.breachReady = true; s.spirituality = 2;
    expect(resolve(s,H,1,c).selfGain).toBe(50.7*.65); expect(c.breachReady).toBe(true); expect(s.spirituality).toBe(2);
    c.prohibitionPending = true; c.confinementPending = true;
    const before = structuredClone(s); expect(finishPunishmentKnightCombatRound(c)).toContain('不跨轮保留');
    expect(c).toMatchObject({prohibitionPending:false,breachReady:false,confinementPending:false});
    expect(Object.keys(c).sort()).toEqual(['source','prohibitionPending','breachReady','confinementPending'].sort());
    expect(finishPunishmentKnightCombatRound(c)).toBeNull(); expect(s).toEqual(before);
    expect(JSON.stringify(s.combat)).not.toMatch(/prohibitionPending|breachReady|confinementPending/);
  });
});

describe('Finite confinement', () => {
  it('pays3 on knowledge14 success/failure and never gains immediate advantage or threat', () => {
    for (const [roll,success] of [[52,true],[53,false]] as const) {
      const s = fixture(), c = createPunishmentKnightRoundContext(s), random = fixedRolls(roll);
      expect(resolve(s,R,0,c,random)).toMatchObject({selfGain:0,enemyReduction:0,threatens:false});
      expect(c.confinementPending).toBe(success); expect(s.spirituality).toBe(97); expect(random.cursor).toBe(1);
      if (success) { expect(resolve(s,R,1,c,fixedRolls()).selfGain).toBe(0); expect(s.spirituality).toBe(97); }
    }
  });
  it('consumes only a future allowed positive actual STRIKE once, preserving pending through blocked or missed slots', () => {
    const s = fixture(), c = createPunishmentKnightRoundContext(s); resolve(s,R,1,c,fixedRolls(1));
    for (const id of ['MISS','OPENING','BLOCK','DISTANCE']) expect(consumePunishmentKnightConfinement(s,c,id,16)).toBeNull();
    for (const gain of [0,-1,NaN,Infinity]) expect(consumePunishmentKnightConfinement(s,c,'STRIKE',gain)).toBeNull();
    expect(consumePunishmentKnightConfinement(s,c,'STRIKE',16,true)).toBeNull(); expect(c.confinementPending).toBe(true);
    expect(consumePunishmentKnightConfinement(s,c,'STRIKE',16)).toMatchObject({physicalMultiplier:.6});
    expect(c.confinementPending).toBe(false); expect(consumePunishmentKnightConfinement(s,c,'STRIKE',16)).toBeNull();
    expect(s.combat!.enemyHealth).toBe(100); expect(s.health).toBe(100);
  });
});

// Neutral DEFEND tickets: H1–120, J121–180, B181–280, K281–320, R321–380, A381–400.
describe('Actual common-round sequencing and physical consequences', () => {
  it('K → actual resisted enemy STRIKE → H consumes exactly the original slots and3+3S', () => {
    const s = fixture(); s.spirituality = 70; const rolls = scriptRolls(13,1,281,1,56,1,1,1);
    const {round,outcome} = resolveSliceCombatRound(s,'DEFEND');
    expect(round.moves.map(m=>m.actor)).toEqual(['PLAYER','ENEMY','PLAYER']);
    expect(round.moves.map(m=>m.selfGain)).toEqual([0,16,50.7*.65+20*.65]);
    expect(round.moves[1]!.label).toContain('已记录本次原敌'); expect(round.moves[2]!.label).toContain('另付3灵性');
    expect(outcome).toBe('CONTINUE'); expect(s.spirituality).toBe(74); expect(s.combat!.enemyHealth).toBe(90);
    expect(s.combat!.enemyInjuries).toHaveLength(1); expect(rolls).toHaveBeenCalledTimes(8); expect(s.random.cursor).toBe(8);
  });
  it('successful one-shot K blocks only the next body slot and gives no punishment on later H', () => {
    const s = fixture(); s.spirituality = 70; const rolls = scriptRolls(13,1,281,1,1,1,1,1);
    const {round} = resolveSliceCombatRound(s,'DEFEND');
    expect(round.moves.map(m=>m.selfGain)).toEqual([0,0,50.7*.65]);
    expect(round.moves[1]!.label).toContain('不构成实际违令'); expect(s.spirituality).toBe(77); expect(rolls).toHaveBeenCalledTimes(8);
  });
  it('own next H is blocked after enemy MISS; one-shot expiration lets the following H act', () => {
    const s = fixture(); const rolls = scriptRolls(33,1,281,381,1,1,1,1,1);
    const {round} = resolveSliceCombatRound(s,'DEFEND');
    expect(round.moves.map(m=>m.selfGain)).toEqual([0,0,0,50.7*.65]);
    expect(round.moves[2]!.label).toContain('你的本次身体近击'); expect(rolls).toHaveBeenCalledTimes(9);
  });
  it('duplicate pending K uses original slots with one3S cost and zero resistance draws', () => {
    const s = fixture(); s.spirituality = 70; const rolls = scriptRolls(33,1,281,381,281,281,1);
    const {round} = resolveSliceCombatRound(s,'DEFEND'); expect(round.moves).toHaveLength(4);
    expect(round.moves.every(m=>m.selfGain===0&&m.enemyReduction===0)).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(round.consequence).toContain('本轮结束');
    expect(s.spirituality).toBe(77); expect(rolls).toHaveBeenCalledTimes(7);
  });
  it('R survives MISS and K-blocked STRIKE, then reduces the next real positive strike exactly once', () => {
    const s = fixture(); s.spirituality = 70; const rolls = scriptRolls(33,86,321,1,381,281,1,1,381,1,1_000_000,1);
    const {round,outcome} = resolveSliceCombatRound(s,'DEFEND');
    expect(round.moves.map(m=>m.selfGain)).toEqual([0,0,0,0,-22.5,16*.6]);
    expect(round.moves[3]!.label).not.toContain('本次原打击×0.6'); expect(round.moves[5]!.label).toContain('本次原打击×0.6');
    expect(outcome).toBe('CONTINUE'); expect(s.health).toBe(90); expect(s.spirituality).toBe(74); expect(rolls).toHaveBeenCalledTimes(12);
  });
  it('paid wound J reaches only common consequences and failed J cannot open injury by itself', () => {
    for (const success of [true,false]) {
      const s = fixture(); wound(s); const rolls = scriptRolls(1,1,121,success?1:100,381,1,...(success?[1]:[]));
      const {round,outcome} = resolveSliceCombatRound(s,'DEFEND');
      expect(outcome).toBe('CONTINUE'); expect(round.moves[0]!.selfGain).toBe(success?45*.65:0);
      expect(s.combat!.enemyHealth).toBe(success?80:90); expect(s.combat!.enemyInjuries).toHaveLength(success?2:1);
      expect(round.consequenceWeights).toEqual(success?{light:55,heavy:30,death:15}:null);
      expect(rolls).toHaveBeenCalledTimes(success?7:6); vi.restoreAllMocks();
    }
  });
  it('mental B wins battle advantage without independently allowing physical injury or death', () => {
    const s = fixture(); const rolls = scriptRolls(1,1,181,1,381,1);
    const {round,outcome} = resolveSliceCombatRound(s,'DEFEND');
    expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull(); expect(s.combat!.enemyHealth).toBe(100);
    expect(round.moves[0]!.selfGain).toBe(42.25*.65); expect(rolls).toHaveBeenCalledTimes(6);
  });
  it('committed following round gets fresh flags and preserves real alternating first actor', () => {
    const s = fixture(); scriptRolls(1,1,281,381,1);
    const first = resolveSliceCombatRound(s,'DEFEND'); s.combatHistory.push(first.round);
    expect(first.round.consequence).toContain('本轮结束'); vi.restoreAllMocks();
    const rolls = scriptRolls(1,1,1,1,1,1), second = resolveSliceCombatRound(s,'DEFEND');
    expect(second.round.first).toBe('ENEMY'); expect(second.round.moves.map(m=>m.selfGain)).toEqual([16,50.7*.65]);
    expect(rolls).toHaveBeenCalledTimes(6); expect(s.random.cursor).toBe(11);
  });
});

describe('Dean original scene, source closure and every terminal branch', () => {
  it('uses real daylight2m Dean with his own HAND club, keeps FIRST_CASE separate and rejects Evan', () => {
    expect(currentPunishmentKnightCombatSource(fixture())).toMatchObject({ encounterId:'PUNISHMENT_KNIGHT_DISPUTE',
      target:'DEAN_SINGLE_ADULT_ORDINARY_HUMAN', weapon:'DEANS_OWN_ORDINARY_SHORT_CLUB', weaponLocation:'HAND',
      distanceMetres:2, daylight:true, bystanders:'NONE', pursuit:false, exit:'ORIGINAL_OPEN_EXIT' });
    expect(currentPunishmentKnightCombatSource(fixture(true))).toMatchObject({encounterId:'FIRST_CASE',target:'CURRENT_VISIBLE_ORDINARY_CARRIER'});
    const s = fixture(); s.combat!.encounterId = 'JUDGE_DISPUTE'; expect(currentPunishmentKnightCombatSource(s)).toBeNull();
  });
  it('rejects dead/stale/wrong target, week, history and open-practice sources before payment or draws', () => {
    const changes: ((s: SliceState)=>void)[] = [
      s=>{s.status='DEAD';},s=>{s.health=0;},s=>{s.health=NaN;},s=>{s.mind=0;},s=>{s.combat!.enemyHealth=0;},
      s=>{s.combat!.enemyMind=0;},s=>{s.combat!.enemyStatus='SURRENDERED';},s=>{s.combat!.enemyStatus='DEAD';},
      s=>{s.punishmentKnight.encounter.status='RETREATED';},s=>{s.punishmentKnight.encounter.attemptWeek=s.week-1;},
      s=>{s.punishmentKnight.encounter.startHistoryIndex=1;},s=>{s.combat!.round=2;},s=>{s.revision=-1;},s=>{s.week=0;},
      s=>{s.punishmentKnight.cases['breach-and-pad']!.status='AVAILABLE';},s=>{s.punishmentKnight.cases['breach-and-pad']!.closes=0;},
      s=>{s.punishmentKnight.cases['willing-pause']!.contactOpen=true;},s=>{s.punishmentKnight.cases['willing-pause']!.status='PREPARED';},
      s=>{s.punishmentKnight.practice.pad='MAT';},s=>{s.punishmentKnight.practice.partner='HELD';},
      s=>{s.punishmentKnight.practice.rule='DECLARED';},s=>{s.punishmentKnight.practice.rule='BREACHED';},s=>{s.punishmentKnight.practice.note='WRITTEN';},
      s=>{s.judge.practice.audience='ADDRESSED';},s=>{s.judge.practice.boundary='HELD';},s=>{s.judge.practice.token='OUTSIDE_TABLE';},
      s=>{s.judge.cases['marked-line']!.contactOpen=true;},s=>{s.world.city='ELSEWHERE';},
    ];
    for (const change of changes) {
      const s = fixture(), source = currentPunishmentKnightCombatSource(s), c = createPunishmentKnightRoundContext(s); change(s);
      const before = structuredClone(s), random = fixedRolls(); expect(currentPunishmentKnightCombatSource(s)).toBeNull();
      expect(resolve(s,K,1,c,random,source)).toMatchObject({selfGain:0,enemyReduction:0,threatens:false});
      expect(random.cursor).toBe(0); expect(s).toEqual(before); expect(()=>resolveSliceCombatRound(s,'DEFEND')).toThrow(); expect(s).toEqual(before);
    }
    const s = fixture(), c = createPunishmentKnightRoundContext(s), source = currentPunishmentKnightCombatSource(s)!;
    const wrong = {...source,target:'IMAGINED_PERSON'} as unknown as PunishmentKnightCombatSource;
    expect(resolve(s,K,1,c,fixedRolls(),wrong).selfGain).toBe(0); expect(s.spirituality).toBe(100);
    s.revision += 1; expect(resolve(s,K,1,c,fixedRolls(),source).selfGain).toBe(0); expect(s.spirituality).toBe(100);
  });
  it('FIRST_CASE retains original living-carrier and arc gates without replacing Dean', () => {
    for (const change of [(s:SliceState)=>{s.world.carrierAlive=false;},(s:SliceState)=>{s.world.carrierCanResist=false;},(s:SliceState)=>{s.arc.stage='ENDED';}]) {
      const s = fixture(true); change(s); expect(currentPunishmentKnightCombatSource(s)).toBeNull();
    }
  });
  it('talk/fight spends one real action at Dean scene, respects refusal and never regenerates opponent', () => {
    const s = fixture(); s.combat=null; s.punishmentKnight.encounter={status:'AVAILABLE',attemptWeek:null,startHistoryIndex:null};
    s.actionsRemaining=3; const failure=encounterContext(s,100); applyPunishmentKnightEncounter(s,{type:'ENCOUNTER_TALK'},failure);
    expect(s.actionsRemaining).toBe(2); expect(s.punishmentKnight.encounter.status).toBe('AVAILABLE');
    expect(blockPunishmentKnightEncounter(s,{type:'ENCOUNTER_TALK'})).toContain('本周已经交涉');
    applyPunishmentKnightEncounter(s,{type:'ENCOUNTER_FIGHT'},encounterContext(s));
    expect(s.actionsRemaining).toBe(1); expect(s.combat?.encounterId).toBe('PUNISHMENT_KNIGHT_DISPUTE');
    expect(currentPunishmentKnightCombatSource(s)).not.toBeNull(); expect(blockPunishmentKnightEncounter(s,{type:'ENCOUNTER_FIGHT'})).not.toBeNull();
  });
  it('successful original exit keeps objects and costs, no later actions or carrier/box narrative', () => {
    const s = fixture(); s.spirituality=44; const town=structuredClone(s.town), rolls=scriptRolls(95,86,1);
    const result=resolveSliceCombatRound(s,'RETREAT'); expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toHaveLength(0);
    expect(result.round.consequence).toContain('迪恩'); expect(result.round.consequence).toContain('原普通出口');
    expect(result.round.consequence).not.toMatch(/携铃|箱子|埃文/); expect(s.town).toEqual(town); expect(s.spirituality).toBe(44);
    s.combatHistory.push(result.round); const award=vi.fn(); settlePunishmentKnightEncounter(s,result.outcome,encounterContext(s),award);
    expect(s.combat).toBeNull(); expect(s.punishmentKnight.encounter.status).toBe('RETREATED'); expect(award).not.toHaveBeenCalled();
    expect(validatePunishmentKnightEncounter(s)).toBe(true); expect(rolls).toHaveBeenCalledTimes(3);
  });
  it('shared heavy surrender and shared death have Dean-only terminal text and retained original ownership', () => {
    for (const [roll,outcome,health] of [[70,'ENEMY_SURRENDERED',70],[100,'ENEMY_DEAD',0]] as const) {
      const s=fixture(); s.spirituality=50; const town=structuredClone(s.town), rolls=scriptRolls(13,1,1,381,281,1,roll);
      const result=resolveSliceCombatRound(s,'DEFEND'); expect(result.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health);
      expect(result.round.consequence).toContain('迪恩'); expect(result.round.consequence).not.toMatch(/携铃|箱子|埃文/);
      expect(result.round.consequence).toContain('本轮结束'); expect(s.spirituality).toBe(47); expect(s.town).toEqual(town);
      s.combatHistory.push(result.round); const award=vi.fn(); settlePunishmentKnightEncounter(s,outcome,encounterContext(s),award);
      expect(award).toHaveBeenCalledExactlyOnceWith('punishment-knight-dispute',25); expect(s.combat).toBeNull();
      expect(s.punishmentKnight.encounter.status).toBe('RESOLVED'); expect(validatePunishmentKnightEncounter(s)).toBe(true);
      expect(()=>settlePunishmentKnightEncounter(s,outcome,encounterContext(s),award)).toThrow();
      expect(rolls).toHaveBeenCalledTimes(7); vi.restoreAllMocks();
    }
  });
  it('real enemy strike can kill player through death wheel and leaves terminal S unrecovered', () => {
    const s=fixture(); s.spirituality=50; const rolls=scriptRolls(1,1,381,1,1_000_000,100);
    const result=resolveSliceCombatRound(s,'DEFEND'); expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0);
    expect(result.round.consequence).toContain('迪恩'); expect(result.round.consequence).not.toMatch(/携铃|箱子|埃文/); expect(s.spirituality).toBe(50);
    s.combatHistory.push(result.round); s.status='DEAD'; const award=vi.fn(); settlePunishmentKnightEncounter(s,result.outcome,encounterContext(s),award);
    expect(s.punishmentKnight.encounter.status).toBe('LOST'); expect(award).not.toHaveBeenCalled(); expect(validatePunishmentKnightEncounter(s)).toBe(true);
    expect(rolls).toHaveBeenCalledTimes(6);
  });
  it('health-zero injury terminal for both original bodies is distinct from automatic wound execution', () => {
    for (const player of [true,false]) {
      const s=fixture(); if(player)s.health=10; else s.combat!.enemyHealth=10;
      const rolls=scriptRolls(1,1,player?381:1,player?1:381,player?1_000_000:1,1);
      const result=resolveSliceCombatRound(s,'DEFEND'); expect(result.outcome).toBe(player?'PLAYER_DEAD':'ENEMY_DEAD');
      expect(result.round.consequence).toContain('原健康降至0'); expect(result.round.consequence).toContain('迪恩');
      expect(result.round.consequence).not.toMatch(/携铃|箱子|埃文/); expect(rolls).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });
  it('rejects fabricated terminal results and never rewards mere declarations', () => {
    const s=fixture(); scriptRolls(1,1,281,381,1); const result=resolveSliceCombatRound(s,'DEFEND'); s.combatHistory.push(result.round);
    const before=structuredClone(s), award=vi.fn(); expect(()=>settlePunishmentKnightEncounter(s,'ENEMY_SURRENDERED',encounterContext(s),award)).toThrow();
    expect(s).toEqual(before); expect(award).not.toHaveBeenCalled();
  });
});
