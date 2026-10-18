import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  MENTOR_DISORDER_COUNT_WHEEL, mentorDisorderAbilityWheel, mentorDisorderActionCount,
  consumeMentorDisorderWeakening, consumeMentorDisorderStrike, createMentorDisorderRoundContext,
  currentMentorDisorderCombatSource, drawMentorDisorderAbility, finishMentorDisorderCombatRound,
  isMentorDisorder, resolveMentorDisorderCombatAbility, type MentorDisorderCombatSource, type MentorDisorderMoveId,
} from '../../src/domain/mentor-disorder/combat.js';
import * as mentorCombat from '../../src/domain/mentor-disorder/combat.js';
import { createMentorDisorderState } from '../../src/domain/mentor-disorder/index.js';
import { applyMentorDisorderEncounter, blockMentorDisorderEncounter, hasMentorDisorderDisputeOpponent,
  settleMentorDisorderEncounter, validateMentorDisorderEncounter } from '../../src/domain/mentor-disorder/encounter.js';
import { CORRUPTION_BARON_COUNT_WHEEL, corruptionBaronAbilityWheel, currentCorruptionBaronCombatSource } from '../../src/domain/corruption-baron/combat.js';
import { createCorruptionBaronState } from '../../src/domain/corruption-baron/index.js';
import { currentBriberCombatSource } from '../../src/domain/briber/combat.js';
import { applyLawyerCommand, createLawyerState } from '../../src/domain/lawyer/index.js';
import { applyBarbarianCommand, createBarbarianState } from '../../src/domain/barbarian/index.js';
import { applyBriberCommand, createBriberState } from '../../src/domain/briber/index.js';
import { applyBriberActivity } from '../../src/domain/briber/life.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'black-emperor.s8.enhanced-body', J = 'BODY_FOLLOWUP', B = 'black-emperor.s7.bribery-weakening';
const K = 'black-emperor.s5.disorder', R = 'black-emperor.s8.mental-resistance', A = 'ACCIDENT';
const insight = 'black-emperor.s9.weak-point-insight', ids = [H, J, B, K, R, A] as const;
/** Original S9 bottle and separately crafted/consumed S8/S7 bottles, plus purchased originals. */
function fixture(firstCase = false): SliceState {
  const state = createSliceRun('mentor-disorder-combat-test', sliceDefaultCreationSelection, 'mentor-disorder-combat');
  state.activeEvent = null; state.eventQueue = []; state.world.city = 'BACKLUND';
  state.week = 5; state.cash = 10_000; state.actionsRemaining = 40; state.weeklyBudget = 40;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.lawyer = createLawyerState(); state.barbarian = createBarbarianState(); state.briber = createBriberState();
  const context: SeerContext = {
    roll: minimum => minimum, note() {},
    check: (ability, difficulty) => resolveNormalCheck({ ability,
      baseAbility: state.character.coreStats[ability], difficulty, modifiers: [], roll: 20 }),
  };
  applyLawyerCommand(state, { type: 'DISCOVER' }, context);
  applyLawyerCommand(state, { type: 'LEARN_GUIDANCE' }, context);
  applyLawyerCommand(state, { type: 'BUY_POTION', bottleId: 'lawyer-potion-1' }, context);
  applyLawyerCommand(state, { type: 'CONSUME', bottleId: 'lawyer-potion-1', confirmed: true }, context);
  state.progression.acting = 100; state.week += 4;
  applyBarbarianCommand(state, { type: 'LEARN_FORMULA' }, context);
  applyBarbarianCommand(state, { type: 'BUY_MATERIALS', batchId: 'barbarian-batch-1' }, context);
  applyBarbarianCommand(state, { type: 'BREW', batchId: 'barbarian-batch-1' }, context);
  applyBarbarianCommand(state, { type: 'CONSUME', bottleId: 'barbarian-batch-1:bottle', confirmed: true }, context);
  state.progression.acting = 100; state.week += 8;
  applyBriberCommand(state, { type: 'LEARN_FORMULA' }, context);
  applyBriberCommand(state, { type: 'BUY_MATERIALS', batchId: 'briber-batch-1' }, context);
  applyBriberCommand(state, { type: 'BREW', batchId: 'briber-batch-1' }, context);
  applyBriberCommand(state, { type: 'CONSUME', bottleId: 'briber-batch-1:bottle', confirmed: true }, context);
  applyBriberActivity(state, { type: 'BUY_GIFTS' }, context, () => {});
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.arc.stage = 'COMBAT'; state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 60;
  state.corruptionBaron = createCorruptionBaronState();
  state.progression.sequence = 5; state.progression.mastery[K] = 0;
  state.progression.mastery['black-emperor.s6.distortion'] = 100;
  state.mentorDisorder = createMentorDisorderState(); state.mentorDisorder.promotionWeek = state.week;
  state.mentorDisorder.encounter = { status: 'FIGHTING', attemptWeek: state.week, startHistoryIndex: 0 };
  Object.assign(Object.values(state.mentorDisorder.cases)[0]!, { status: 'RESOLVED', method: 'ORDINARY', closes: 1 });
  state.corruptionBaron.encounter = { status: 'FIGHTING', attemptWeek: state.week, startHistoryIndex: 0 };
  Object.assign(Object.values(state.corruptionBaron.cases)[0]!, { status: 'RESOLVED', method: 'ORDINARY' });
  state.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  state.combat!.encounterId = firstCase ? 'FIRST_CASE' : 'MENTOR_DISORDER_DISPUTE';
  state.spirituality = 100; state.town.clubLocation = 'SHOP';
  return state;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-corruption-baron-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(state: SliceState, id: MentorDisorderMoveId, physical = 1,
  context = createMentorDisorderRoundContext(state), source = currentMentorDisorderCombatSource(state), random = fixedRolls()) {
  return resolveMentorDisorderCombatAbility(state, id, physical, random, context, source);
}
function nextRound(state: SliceState): void {
  const round: SliceCombatRound = { round: state.combat!.round, stance: 'PREPARE', first: 'PLAYER',
    playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [], playerAdvantage: 665,
    enemyAdvantage: 114, winChance: 80, winner: 'PLAYER', consequence: '', consequenceWeights: null, retreat: 'NONE' };
  state.combatHistory.push(round); state.combat!.lastRound = round; state.combat!.round += 1;
}
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum); expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Mentor of Disorder exact S5 wheel and original S6 isolation', () => {
  it('routes exact S5 to six30/15/25/10/15/5 slots and detached12/20/25/23/14/6 counts', () => {
    const s = fixture(); expect(isMentorDisorder(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(mentorDisorderAbilityWheel(null, s));
    expect(playerAbilityWheel(s, null).map(e => e.id)).toEqual(ids);
    expect(playerAbilityWheel(s, null).map(e => e.weight)).toEqual([30, 15, 25, 10, 15, 5]);
    expect(playerCountWheel(s)).toEqual(MENTOR_DISORDER_COUNT_WHEEL);
    expect(playerCountWheel(s).map(e => e.weight)).toEqual([12, 20, 25, 23, 14, 6]);
    playerCountWheel(s)[0]!.weight = 0; playerAbilityWheel(s, null)[0]!.weight = 0;
    expect(playerCountWheel(s)[0]!.weight).toBe(12); expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30);
    expect(Object.keys(s.progression.mastery).filter(id => id.includes('.s5.'))).toEqual([K]);
    expect(Object.keys(s.progression.mastery).some(id => id.includes('.s4.'))).toBe(false);
    s.progression.pathwayId = 'wheel'; expect(isMentorDisorder(s)).toBe(false);
  });
  it('retains every count boundary and exact1.25 stance tickets with one draw per slot', () => {
    for (const [roll, count] of [[1,1],[12,1],[13,2],[32,2],[33,3],[57,3],[58,4],[80,4],[81,5],[94,5],[95,6],[100,6]])
      expect(mentorDisorderActionCount(roll!)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0,1] : stance === 'DEFEND' ? [2] : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const weights = [30,15,25,10,15,5].map((w,i) => w * (boosted.includes(i) ? 5 : 4));
      const total = weights.reduce((a,b) => a+b,0); let boundary = 0;
      mentorDisorderAbilityWheel(stance).forEach((entry, i) => {
        expect(entry.weight).toBe(total === 400 ? weights[i]! / 4 : weights[i]! / total * 100);
        const first = boundary + 1; boundary += weights[i]!; const random = fixedRolls(first,boundary);
        expect(drawMentorDisorderAbility(random,stance)).toBe(ids[i]);
        expect(drawMentorDisorderAbility(random,stance)).toBe(ids[i]); expect(random.cursor).toBe(2);
      });
    }
  });
  it('does not broaden original S6 or S7 source gates', () => {
    const s = fixture(); expect(currentCorruptionBaronCombatSource(s)).toBeNull(); expect(currentBriberCombatSource(s)).toBeNull();
    s.progression.sequence = 6; s.combat!.encounterId = 'CORRUPTION_BARON_DISPUTE';
    expect(playerCountWheel(s)).toEqual(CORRUPTION_BARON_COUNT_WHEEL);
    expect(playerAbilityWheel(s,null)).toEqual(corruptionBaronAbilityWheel(null,s));
    expect(currentMentorDisorderCombatSource(s)).toBeNull(); expect(currentCorruptionBaronCombatSource(s)).not.toBeNull();
    s.progression.sequence = 5; expect(currentCorruptionBaronCombatSource(s)).toBeNull();
    expect(currentMentorDisorderCombatSource(s)).toBeNull();
  });
});

describe('Mentor of Disorder inherited budgets and finite new K', () => {
  it('keeps H59.15/J41.405 on original body mastery, and only actual HAND club substitutes16', () => {
    for (const mastery of [0,100,500]) for (const location of ['SHOP','BAG','HAND'] as const) {
      const s = fixture(); s.town.clubLocation = location; s.progression.mastery[H] = mastery; s.progression.mastery[K] = 500;
      const before = structuredClone(s), f = 0.65 + 0.35 * mastery / 500;
      expect(resolve(s,H,0.8).selfGain).toBe((location === 'HAND' ? 16 : 59.15 * f) * 0.8);
      expect(resolve(s,J,0.8).selfGain).toBe(41.405 * f * 0.8); expect(s).toEqual(before);
    }
  });
  it('pays3 for knowledge14 success or failure, grants no instant contribution, and ignores physical damage', () => {
    for (const [roll, success] of [[52,true],[53,false]] as const) {
      const s = fixture(), context = createMentorDisorderRoundContext(s), random = fixedRolls(roll), before = structuredClone(s);
      const effect = resolve(s,K,0,context,undefined,random);
      expect(effect).toMatchObject({ selfGain:0, enemyReduction:0, threatens:false });
      expect(effect.label).toContain(success ? '混乱成功' : '混乱失败');
      expect(context.pendingDisorder).toBe(success); before.spirituality -= 3;
      expect(s).toEqual(before); expect(random.cursor).toBe(1);
      expect(effect.label).not.toContain('3分钟');
    }
  });
  it('already-pending K does not pay, stack or draw; insufficient S falls back6×body', () => {
    const s = fixture(), c = createMentorDisorderRoundContext(s); resolve(s,K,1,c,undefined,fixedRolls(1));
    const paid = s.spirituality, forbidden = fixedRolls();
    expect(resolve(s,K,1,c,undefined,forbidden).label).toContain('0贡献、0消耗');
    expect(s.spirituality).toBe(paid); expect(forbidden.cursor).toBe(0); expect(c.pendingDisorder).toBe(true);
    for (const spirituality of [0,2.99,Number.NaN,Infinity]) {
      const dry = fixture(); dry.spirituality = spirituality; const before = structuredClone(dry), random = fixedRolls();
      expect(resolve(dry,K,0.8,undefined,undefined,random).enemyReduction).toBe(6 * 0.8);
      expect(dry).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
  it('has no R mental source and fixed A−22.5 with no draw, refund or threat', () => {
    const s = fixture(); Object.assign(s.combat!,{ mentalAttack:true, futureOutcome:'UNREADABLE' });
    const before = structuredClone(s), random = fixedRolls();
    expect(resolve(s,R,1,undefined,undefined,random)).toMatchObject({selfGain:0,enemyReduction:0,threatens:false});
    expect(resolve(s,A,0,undefined,undefined,random)).toMatchObject({selfGain:-22.5,enemyReduction:0,threatens:false});
    expect(s).toEqual(before); expect(random.cursor).toBe(0);
  });
  it('bounds malformed original mastery and body without new-mastery inflation', () => {
    for (const mastery of [-1,Number.NaN,Infinity,900]) for (const physical of [-1,Number.NaN,Infinity,0,0.8,1,3]) {
      const s = fixture(); s.briber.gifts = []; s.progression.mastery[H] = mastery; s.progression.mastery[insight] = mastery;
      const f = mastery === 900 ? 1 : 0.65, p = Number.isFinite(physical) ? Math.max(0,Math.min(1,physical)) : 0;
      expect(resolve(s,H,physical).selfGain).toBe(59.15*f*p); expect(resolve(s,J,physical).selfGain).toBe(41.405*f*p);
      expect(resolve(s,B,physical).enemyReduction).toBe(36.45*f*p);
    }
  });
});

describe('Mentor of Disorder real pending sources, factors and expiry', () => {
  it('only consumes disorder on an actual positive unsuppressed ordinary STRIKE once', () => {
    const s = fixture(), c = createMentorDisorderRoundContext(s); resolve(s,K,1,c,undefined,fixedRolls(1));
    for (const id of ['MISS','OPENING','BLOCK','DISTANCE','MAGIC']) expect(consumeMentorDisorderStrike(s,c,id,16)).toBeNull();
    for (const contribution of [0,-1,Number.NaN,Infinity]) expect(consumeMentorDisorderStrike(s,c,'STRIKE',contribution)).toBeNull();
    expect(consumeMentorDisorderStrike(s,c,'STRIKE',16,true)).toBeNull(); expect(c.pendingDisorder).toBe(true);
    expect(consumeMentorDisorderStrike(s,c,'STRIKE',16)).toMatchObject({physicalMultiplier:0.6});
    expect(c.pendingDisorder).toBe(false); expect(consumeMentorDisorderStrike(s,c,'STRIKE',16)).toBeNull();
    expect(finishMentorDisorderCombatRound(c)).toBeNull(); expect(s.spirituality).toBe(97);
  });
  it('gives one same original from old inventory at3S and usual gift effect consumes even a MISS', () => {
    const s = fixture(), c = createMentorDisorderRoundContext(s), originals = s.briber.gifts.map(g => g.id);
    const effect = resolve(s,B,1,c); expect(effect.label).toContain('无需对方自愿接住');
    expect(s.briber.gifts[0]).toEqual({id:originals[0],location:'GIVEN',destination:'BATTLE:MENTOR_DISORDER_DISPUTE:GROUND',givenWeek:s.week});
    expect(s.briber.gifts.map(g => g.id)).toEqual(originals); expect(s.spirituality).toBe(97);
    expect(consumeMentorDisorderWeakening(s,c,'OTHER',16,0)).toBeNull();
    expect(consumeMentorDisorderWeakening(s,c,'PLAYER',0,0)).toMatchObject({selfGain:0,enemyReduction:0});
    expect(c.pendingWeakening).toBeNull(); expect(s.briber.gifts[0]!.location).toBe('GIVEN');
    expect(consumeMentorDisorderWeakening(s,c,'PLAYER',16,0)).toBeNull();
  });
  it('both truly pending factors multiply once with both actual factor logs', () => {
    for (const order of [[B,K],[K,B]] as const) {
      const s = fixture(), c = createMentorDisorderRoundContext(s); s.progression.mastery[B] = 500;
      for (const id of order) resolve(s,id,1,c,undefined,id === K ? fixedRolls(1) : fixedRolls());
      const disorder = consumeMentorDisorderStrike(s,c,'STRIKE',16)!;
      const gift = consumeMentorDisorderWeakening(s,c,'PLAYER',16*disorder.physicalMultiplier,0)!;
      expect(gift.selfGain).toBeCloseTo(16*0.6*0.65,10); expect(disorder.label).toContain('×0.6'); expect(gift.label).toContain('×0.65');
      expect(c.pendingDisorder).toBe(false); expect(c.pendingWeakening).toBeNull(); expect(s.spirituality).toBe(94);
    }
  });
  it('already-pending B, empty stock or insufficient S keeps old36.45 weakpoint fallback', () => {
    for (const variant of ['PENDING','EMPTY','DRY']) {
      const s = fixture(), c = createMentorDisorderRoundContext(s); s.progression.mastery[insight] = 100;
      if (variant === 'PENDING') resolve(s,B,1,c); else if (variant === 'EMPTY') s.briber.gifts = []; else s.spirituality = 2;
      const before = structuredClone(s); expect(resolve(s,B,0.8,c).enemyReduction).toBe(36.45*(0.65+0.35*100/500)*0.8);
      expect(s).toEqual(before);
    }
  });
  it('expires both pending at round end without backdating, refunds or returning the gift', () => {
    const s = fixture(), c = createMentorDisorderRoundContext(s); resolve(s,B,1,c); resolve(s,K,1,c,undefined,fixedRolls(1));
    const end = finishMentorDisorderCombatRound(c)!;
    expect(end).toContain('待用贿赂削弱已失效'); expect(end).toContain('有限混乱已到期'); expect(end).toContain('不追溯');
    expect(c.pendingDisorder).toBe(false); expect(c.pendingWeakening).toBeNull(); expect(finishMentorDisorderCombatRound(c)).toBeNull();
    expect(s.spirituality).toBe(94); expect(s.briber.gifts[0]!.location).toBe('GIVEN');
    expect(createMentorDisorderRoundContext(s)).toMatchObject({pendingDisorder:false,pendingWeakening:null});
  });
  it('rejects changed gift destination/week/custody and stale round sources', () => {
    for (const mutate of [
      (s:SliceState) => {s.briber.gifts[0]!.location='PLAYER';},
      (s:SliceState) => {s.briber.gifts[0]!.destination='BATTLE:CORRUPTION_BARON_DISPUTE:GROUND';},
      (s:SliceState) => {s.briber.gifts[0]!.givenWeek=s.week-1;},
      (s:SliceState) => {s.briber.gifts=[];}, (s:SliceState) => {nextRound(s);},
    ]) {
      const s=fixture(), c=createMentorDisorderRoundContext(s); resolve(s,B,1,c); mutate(s); const before=structuredClone(s);
      expect(consumeMentorDisorderWeakening(s,c,'PLAYER',16,0)).toBeNull(); expect(s).toEqual(before);
    }
    const s=fixture(), c=createMentorDisorderRoundContext(s); resolve(s,K,1,c,undefined,fixedRolls(1)); nextRound(s);
    expect(consumeMentorDisorderStrike(s,c,'STRIKE',16)).toBeNull();
  });
});

describe('Mentor of Disorder original Rees and inherited carrier source gates', () => {
  it('binds original adult Rees, own HAND club,2m daylight clear ground and nonpursuit exit', () => {
    const s=fixture(); expect(currentMentorDisorderCombatSource(s)).toMatchObject({
      encounterId:'MENTOR_DISORDER_DISPUTE',target:'REES_SINGLE_ADULT_ORDINARY_HUMAN',nature:'ORDINARY_HUMAN',
      weapon:'REESS_OWN_ORDINARY_SHORT_CLUB',weaponLocation:'HAND',distanceMetres:2,daylight:true,
      bystanders:'NONE',exit:'ORIGINAL_OPEN_EXIT',pursuit:false,
    });
    const first=fixture(true); expect(currentMentorDisorderCombatSource(first)).toMatchObject({encounterId:'FIRST_CASE',target:'CURRENT_VISIBLE_ORDINARY_CARRIER'});
    const c=createMentorDisorderRoundContext(first); resolve(first,B,1,c);
    expect(first.briber.gifts[0]!.destination).toBe('BATTLE:FIRST_CASE:GROUND');
    expect(resolve(first,H,1,c,currentMentorDisorderCombatSource(s)).selfGain).toBe(0);
  });
  it('rejects forged source identities, revision, geometry, original weapon and daylight before RNG/payment', () => {
    const s=fixture(), source=currentMentorDisorderCombatSource(s)!, c=createMentorDisorderRoundContext(s);
    const sources:(MentorDisorderCombatSource|null)[]=[null,
      ...[{runId:'other'},{revision:s.revision+1},{week:s.week+1},{round:2},{target:'VAUGHN'},
        {weapon:'COPIED_CLUB'},{weaponLocation:'GROUND'},{distanceMetres:20},{daylight:false},{bystanders:'CROWD'},
        {exit:'CLOSED'},{pursuit:true},{body:'REMOTE'},{startHistoryIndex:1},{attemptWeek:0},{encounterId:'FIRST_CASE'}]
        .map(patch=>({...source,...patch}) as unknown as MentorDisorderCombatSource)];
    const before=structuredClone(s), random=fixedRolls();
    for(const src of sources) for(const id of ids)
      expect(resolve(s,id,1,c,src,random)).toMatchObject({selfGain:0,enemyReduction:0,threatens:false});
    expect(s).toEqual(before); expect(random.cursor).toBe(0); expect(c.pendingDisorder).toBe(false);
  });
  it('rejects absent/dead sources, unclosed new or original practices and broken real round history', () => {
    for(const mutate of [
      (s:SliceState)=>{s.combat=null;},(s:SliceState)=>{s.health=0;},(s:SliceState)=>{s.mind=Number.NaN;},
      (s:SliceState)=>{s.status='DEAD';},(s:SliceState)=>{s.combat!.enemyHealth=0;},(s:SliceState)=>{s.combat!.enemyMind=Infinity;},
      (s:SliceState)=>{s.combat!.enemyStatus='SURRENDERED';},(s:SliceState)=>{s.world.city='ELSEWHERE';},
      (s:SliceState)=>{s.combat!.round=2;},(s:SliceState)=>{s.mentorDisorder.encounter.status='AVAILABLE';},
      (s:SliceState)=>{s.mentorDisorder.encounter.attemptWeek=null;},(s:SliceState)=>{s.mentorDisorder.encounter.startHistoryIndex=-1;},
      (s:SliceState)=>{s.mentorDisorder.practice.markers='MIXED';},(s:SliceState)=>{s.mentorDisorder.practice.markers='COLLECTED';},
      (s:SliceState)=>{s.mentorDisorder.practice.route='MARKED';},(s:SliceState)=>{s.mentorDisorder.practice.note='WRITTEN';},
      (s:SliceState)=>{Object.values(s.mentorDisorder.cases)[0]!.contactOpen=true;},
      (s:SliceState)=>{Object.values(s.mentorDisorder.cases)[0]!.status='PREPARED';},
      (s:SliceState)=>{Object.values(s.mentorDisorder.cases)[0]!.status='AVAILABLE';},
      (s:SliceState)=>{Object.values(s.mentorDisorder.cases)[0]!.closes=0;},
      (s:SliceState)=>{s.corruptionBaron.practice.clauseOrder='PENDING';},
      (s:SliceState)=>{s.corruptionBaron.practice.marker='ROLLING';},(s:SliceState)=>{s.corruptionBaron.practice.route='DIVERTED';},
      (s:SliceState)=>{nextRound(s);s.combatHistory[0]!.winner=null;},
      (s:SliceState)=>{nextRound(s);s.combatHistory[0]!.retreat='SUCCESS';},
    ]) {
      const s=fixture(), c=createMentorDisorderRoundContext(s);mutate(s);const before=structuredClone(s),random=fixedRolls();
      expect(currentMentorDisorderCombatSource(s)).toBeNull();
      for(const id of ids) expect(resolve(s,id,1,c,undefined,random)).toMatchObject({selfGain:0,enemyReduction:0,threatens:false});
      expect(()=>resolveSliceCombatRound(s,'ATTACK')).toThrow();expect(s).toEqual(before);expect(random.cursor).toBe(0);
    }
  });
  it('retains carrier-specific living/present/combat arc gates independently', () => {
    for(const mutate of [(s:SliceState)=>{s.world.carrierAlive=false;},(s:SliceState)=>{s.world.carrierCanResist=false;},
      (s:SliceState)=>{s.arc.stage='ENDED';}]) {
      const s=fixture(true);mutate(s);expect(currentMentorDisorderCombatSource(s)).toBeNull();
      expect(()=>resolveSliceCombatRound(s,'ATTACK')).toThrow();
    }
  });
});

describe('Mentor of Disorder actual shared alternating rounds', () => {
  it('uses inherited core35/15/20/30 with tier900/cap180/floor90 and S100/continuing regen10', () => {
    const s=fixture();s.character.coreStats={physique:10,perception:20,will:30,knowledge:40};s.spirituality=92;
    scriptRolls(1,1,366,400,1);expect(resolveSliceCombatRound(s,'ATTACK').round.playerAdvantage).toBe(924.5);expect(s.spirituality).toBe(100);
    vi.restoreAllMocks();const dry=fixture();dry.spirituality=0;scriptRolls(1,1,366,400,1);
    expect(resolveSliceCombatRound(dry,'ATTACK').round.playerAdvantage).toBe(915*0.8);expect(dry.spirituality).toBe(10);
    vi.restoreAllMocks();const cap=fixture();cap.character.coreStats={physique:1000,perception:1000,will:1000,knowledge:1000};
    scriptRolls(1,1,366,400,1);expect(resolveSliceCombatRound(cap,'ATTACK').round.playerAdvantage).toBe(1080);
    vi.restoreAllMocks();vi.spyOn(mentorCombat,'resolveMentorDisorderCombatAbility').mockReturnValue({label:'controlled negative',selfGain:-10000,enemyReduction:0,threatens:false});
    scriptRolls(1,1,366,400,1);expect(resolveSliceCombatRound(fixture(),'ATTACK').round.playerAdvantage).toBe(90);
  });
  it('real K→MISS→B→STRIKE multiplies both factors without extra enemy draws or added actions', () => {
    const s=fixture(), before=structuredClone(s);s.spirituality=50;
    const draws=scriptRolls(13,46,326,1,400,226,1,1), result=resolveSliceCombatRound(s,'ATTACK');
    expect(result.round.moves.map(m=>m.actor)).toEqual(['PLAYER','ENEMY','PLAYER','ENEMY']);
    expect(result.round.moves[1]!.selfGain).toBe(0);expect(result.round.moves[1]!.label).not.toContain('×0.6');
    expect(result.round.moves[3]!.selfGain).toBeCloseTo(16*0.6*(1-0.35*0.65),10);
    expect(result.round.moves[3]!.label).toContain('×0.6');expect(result.round.moves[3]!.label).toContain('×0.7725');
    expect(result.round.enemyAdvantage).toBeCloseTo(114+16*0.6*(1-0.35*0.65),10);
    expect(result.outcome).toBe('CONTINUE');expect(result.round.consequenceWeights).toBeNull();
    expect(s.combat!.enemyHealth).toBe(100);expect(s.spirituality).toBe(54);expect(draws).toHaveBeenCalledTimes(8);
    expect(s.mentorDisorder).toEqual(before.mentorDisorder);expect(s.progression).toEqual(before.progression);
    expect(Object.keys(s.combat!)).not.toContain('pendingDisorder');expect(Object.keys(s.mentorDisorder.encounter)).toEqual(['status','attemptWeek','startHistoryIndex']);
  });
  it('real B→MISS→K→STRIKE does not resurrect the already-consumed gift weakening', () => {
    const s=fixture();scriptRolls(13,46,226,400,326,1,1,1);const {round}=resolveSliceCombatRound(s,'ATTACK');
    expect(round.moves[1]!.label).toContain('本次后失效');expect(round.moves[3]!.selfGain).toBe(16*0.6);
    expect(round.moves[3]!.label).not.toContain('本次实际因子');expect(s.briber.gifts[0]!.location).toBe('GIVEN');
  });
  it('K does not consume on OPENING, block or MISS, or repeatedly charge while pending', () => {
    const s=fixture();s.spirituality=30;
    scriptRolls(95,100,326,1,241,326,161,326,400,326,326,326,1);
    const {round}=resolveSliceCombatRound(s,'ATTACK');
    expect(round.playerCount).toBe(6);expect(round.enemyCount).toBe(3);
    expect(round.moves.filter(m=>m.actor==='ENEMY').map(m=>[m.selfGain,m.enemyReduction])).toEqual([[8,0],[0,10],[0,0]]);
    expect(round.moves.filter(m=>m.actor==='PLAYER'&&m.label.startsWith('有限混乱成功'))).toHaveLength(1);
    expect(round.consequence).toContain('有限混乱已到期');expect(s.spirituality).toBe(37);
  });
  it('even-round enemy-first action is not backdated and pending cannot carry to next round', () => {
    const s=fixture();nextRound(s);s.spirituality=20;scriptRolls(1,1,1,326,1,1);
    const first=resolveSliceCombatRound(s,'ATTACK').round;expect(first.first).toBe('ENEMY');expect(first.moves[0]!.selfGain).toBe(16);
    expect(first.consequence).toContain('不追溯此前动作');s.combatHistory.push(first);vi.restoreAllMocks();
    scriptRolls(1,1,366,1,1);const second=resolveSliceCombatRound(s,'ATTACK').round;
    expect(second.moves[1]!.selfGain).toBe(16);expect(second.moves[1]!.label).not.toContain('×0.6');
  });
  it('failure K pays but cannot wound, drain mind, force surrender, add consequences or retry', () => {
    const s=fixture();s.spirituality=30;const draws=scriptRolls(1,1,326,100,1,1);const {round,outcome}=resolveSliceCombatRound(s,'ATTACK');
    expect(round.moves[0]!.label).toContain('混乱失败');expect(round.moves[1]!.selfGain).toBe(16);
    expect(round.consequenceWeights).toBeNull();expect(outcome).toBe('CONTINUE');expect(draws).toHaveBeenCalledTimes(6);
    expect(s.combat).toMatchObject({enemyHealth:100,enemyMind:100,enemyStatus:'RESISTING',enemyInjuries:[]});expect(s.spirituality).toBe(37);
  });
  it('terminal health consequences stay shared and unused paid K expires without regeneration', () => {
    for(const [ticket,consequence,outcome,health] of [[1,66,'ENEMY_SURRENDERED',70],[151,96,'ENEMY_DEAD',0]] as const) {
      const s=fixture();s.spirituality=30;const draws=scriptRolls(13,1,ticket,400,326,1,1,consequence);
      const result=resolveSliceCombatRound(s,'ATTACK');expect(result.outcome).toBe(outcome);expect(s.combat!.enemyHealth).toBe(health);
      expect(result.round.consequence).toContain('里斯');expect(result.round.consequence).not.toContain('箱子');
      expect(result.round.consequence).toContain('有限混乱已到期');expect(result.round.consequenceWeights).toEqual({light:65,heavy:30,death:5});
      expect(s.spirituality).toBe(27);expect(draws).toHaveBeenCalledTimes(8);vi.restoreAllMocks();
    }
  });
  it('a weakened strike still permits real player death and preserves original costs and injuries', () => {
    const s=fixture();s.health=40;s.mind=25;s.spirituality=5;s.injuryRisk=1;
    s.injuries=[{id:'prior',severity:'HEAVY',acquiredRevision:1,treatedRevision:2}];
    scriptRolls(1,1,326,1,1,1000000,96);const result=resolveSliceCombatRound(s,'ATTACK');
    expect(result.round.moves[1]!.selfGain).toBe(16*0.6);expect(result.outcome).toBe('PLAYER_DEAD');expect(s.health).toBe(0);
    expect(s.spirituality).toBe(2);expect(s.injuryRisk).toBe(2);expect(result.round.consequence).toContain('里斯');
    const dead=structuredClone(s);expect(resolve(s,K).selfGain).toBe(0);expect(s).toEqual(dead);
  });
  it('retreat is an ordinary50% exit with no extra action, pursuit, gift return or terminal regen', () => {
    const s=fixture();s.spirituality=10;scriptRolls(1,1,226,400,1);
    const prior=resolveSliceCombatRound(s,'ATTACK').round;s.combatHistory.push(prior);vi.restoreAllMocks();
    const gifts=structuredClone(s.briber.gifts),spirituality=s.spirituality;
    const draws=scriptRolls(100,100,400,50),result=resolveSliceCombatRound(s,'RETREAT');
    expect(result.outcome).toBe('RETREATED');expect(result.round.moves.map(m=>m.actor)).toEqual(['ENEMY']);
    expect(result.round.consequence).toContain('里斯');expect(result.round.consequence).toContain('原普通出口');
    expect(result.round.consequence).toContain('不退款、不归还');expect(s.briber.gifts).toEqual(gifts);expect(s.spirituality).toBe(spirituality);
    expect(draws).toHaveBeenCalledTimes(4);
  });
  it('keeps carrier terminal text and deterministically replays exact original gift/disorder use', () => {
    const first=fixture(true);scriptRolls(1,1,1,1,1,66);
    expect(resolveSliceCombatRound(first,'ATTACK').round.consequence).toContain('携铃者');vi.restoreAllMocks();
    const s=fixture(), restored=JSON.parse(JSON.stringify(s)) as SliceState;
    const forbidden=vi.spyOn(Math,'random').mockImplementation(()=>{throw new Error('forbidden');});
    const rolls=[13,46,326,1,400,226,1,1];scriptRolls(...rolls,...rolls);
    expect(resolveSliceCombatRound(s,'ATTACK')).toEqual(resolveSliceCombatRound(restored,'ATTACK'));
    expect(s).toEqual(restored);expect(forbidden).not.toHaveBeenCalled();
  });
});

describe('Mentor of Disorder original encounter lifecycle and validation', () => {
  function context(s:SliceState, roll=1):SeerContext {
    return {roll:minimum=>minimum,note(){},check:(ability,difficulty)=>resolveNormalCheck({
      ability,baseAbility:s.character.coreStats[ability],difficulty,modifiers:[],roll,
    })};
  }
  function available():SliceState {
    const s=fixture();s.combat=null;s.mentorDisorder.encounter={status:'AVAILABLE',attemptWeek:null,startHistoryIndex:null};return s;
  }
  it('starts only after an actual closed report at the original scene, paying1AP without changing originals', () => {
    const s=available(),ctx=context(s),ap=s.actionsRemaining,old=structuredClone(s.briber.gifts),club=s.town.clubLocation;
    expect(blockMentorDisorderEncounter(s,{type:'ENCOUNTER_FIGHT'})).toBeNull();
    applyMentorDisorderEncounter(s,{type:'ENCOUNTER_FIGHT'},ctx);
    expect(s.actionsRemaining).toBe(ap-1);expect(s.combat).toMatchObject({encounterId:'MENTOR_DISORDER_DISPUTE',round:1,enemyHealth:100,enemyMind:100});
    expect(hasMentorDisorderDisputeOpponent(s)).toBe(true);expect(validateMentorDisorderEncounter(s)).toBe(true);
    expect(s.briber.gifts).toEqual(old);expect(s.town.clubLocation).toBe(club);
    expect(()=>applyMentorDisorderEncounter(s,{type:'ENCOUNTER_FIGHT'},ctx)).toThrow();
  });
  it('rejected talk retains refusal and costs; next real week can clarify without powers or rewards', () => {
    const s=available(),initial=s.actionsRemaining;applyMentorDisorderEncounter(s,{type:'ENCOUNTER_TALK'},context(s,100));
    expect(s.mentorDisorder.encounter.status).toBe('AVAILABLE');expect(s.actionsRemaining).toBe(initial-1);
    expect(blockMentorDisorderEncounter(s,{type:'ENCOUNTER_TALK'})).toContain('本周已经交涉');
    expect(validateMentorDisorderEncounter(s)).toBe(true);s.week+=1;
    applyMentorDisorderEncounter(s,{type:'ENCOUNTER_TALK'},context(s));
    expect(s.mentorDisorder.encounter.status).toBe('RESOLVED');expect(s.combat).toBeNull();
    expect(s.seer.completedSources).not.toContain('mentor-disorder-dispute');expect(validateMentorDisorderEncounter(s)).toBe(true);
    expect(blockMentorDisorderEncounter(s,{type:'ENCOUNTER_FIGHT'})).toContain('不能重复');
  });
  it('rejects missing close, open original/new practice or replayed endpoint without mutation', () => {
    for(const mutate of [(s:SliceState)=>{Object.values(s.mentorDisorder.cases)[0]!.closes=0;},
      (s:SliceState)=>{s.mentorDisorder.practice.markers='COLLECTED';},(s:SliceState)=>{s.mentorDisorder.practice.note='WRITTEN';},
      (s:SliceState)=>{s.corruptionBaron.practice.route='DIVERTED';},(s:SliceState)=>{s.mentorDisorder.encounter.status='RETREATED';}]) {
      const s=available();mutate(s);const before=structuredClone(s);expect(blockMentorDisorderEncounter(s,{type:'ENCOUNTER_FIGHT'})).not.toBeNull();
      expect(()=>applyMentorDisorderEncounter(s,{type:'ENCOUNTER_FIGHT'},context(s))).toThrow();expect(s).toEqual(before);
    }
  });
  it('settles only real matching terminal history and gives effective survival reward once', () => {
    const s=fixture();scriptRolls(1,1,1,400,1,66);const result=resolveSliceCombatRound(s,'ATTACK');s.combatHistory.push(result.round);
    expect(result.outcome).toBe('ENEMY_SURRENDERED');const award=vi.fn((source:string)=>s.seer.completedSources.push(source));
    const before=structuredClone(s);expect(()=>settleMentorDisorderEncounter(s,'ENEMY_DEAD',context(s),award)).toThrow();expect(s).toEqual(before);
    settleMentorDisorderEncounter(s,result.outcome,context(s),award);
    expect(award).toHaveBeenCalledExactlyOnceWith('mentor-disorder-dispute',25);expect(s.combat).toBeNull();
    expect(s.mentorDisorder.encounter.status).toBe('RESOLVED');expect(validateMentorDisorderEncounter(s)).toBe(true);
    expect(()=>settleMentorDisorderEncounter(s,result.outcome,context(s),award)).toThrow();
  });
  it('a real ordinary retreat yields no reward and cannot reopen the same Rees', () => {
    const s=fixture();scriptRolls(1,1,1);const result=resolveSliceCombatRound(s,'RETREAT');s.combatHistory.push(result.round);
    const award=vi.fn();settleMentorDisorderEncounter(s,result.outcome,context(s),award);
    expect(result.outcome).toBe('RETREATED');expect(award).not.toHaveBeenCalled();expect(s.combat).toBeNull();
    expect(validateMentorDisorderEncounter(s)).toBe(true);expect(blockMentorDisorderEncounter(s,{type:'ENCOUNTER_FIGHT'})).toContain('不能重复');
  });
  it('validator rejects wrong start, false terminal, duplicate reward and prepromotion scene', () => {
    for(const mutate of [(s:SliceState)=>{s.mentorDisorder.encounter.startHistoryIndex=1;},
      (s:SliceState)=>{s.mentorDisorder.encounter.attemptWeek=s.week+1;},
      (s:SliceState)=>{s.mentorDisorder.encounter.status='RESOLVED';},
      (s:SliceState)=>{s.seer.completedSources.push('mentor-disorder-dispute','mentor-disorder-dispute');},
      (s:SliceState)=>{s.progression.sequence=6;}]) {const s=fixture();mutate(s);expect(validateMentorDisorderEncounter(s)).toBe(false);}
  });
});
