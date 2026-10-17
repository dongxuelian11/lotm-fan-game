import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { resolveSliceCombatRound, playerAbilityWheel } from '../../src/domain/slice/combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createSecretsSorcererState } from '../../src/domain/secrets-sorcerer/index.js';
import { canConsumeSecretsSorcererRitual, currentSecretsSorcererAttempt, currentSecretsSorcererCase,
  currentSecretsSorcererTarget, handleSecretsSorcererRitualCommand, hasSecretsSorcererOpponent,
  hasSecretsSorcererRitualLock, markSecretsSorcererPotionConsumed, projectSecretsSorcererRitual,
  settleSecretsSorcererRitual, validateSecretsSorcererRitualCommand, validateSecretsSorcererRitualState,
  type SecretsSorcererRitualCommand } from '../../src/domain/secrets-sorcerer/ritual.js';
import { createSecretsSorcererRecorderRound, currentSecretsSorcererCombatSource, drawSecretsSorcererAbility,
  drawSecretsSorcererEnemyAbility, resolveSecretsSorcererCombatAbility, resolveSecretsSorcererEnemyAbility,
  secretsSorcererAbilityWheel, secretsSorcererEnemyActionCount } from '../../src/domain/secrets-sorcerer/combat.js';

/** Bounded fixtures and directed random branches, not natural-play evidence. */
function fixture(): SliceState {
  const s=createSliceRun('secrets-ritual-directed',sliceDefaultCreationSelection,'secrets-ritual-directed');
  s.activeEvent=null;s.eventQueue=[];s.world.city='BACKLUND';s.week=24;s.revision=10;s.arc.stage='ENDED';
  s.progression={pathwayId:'door',sequence:5,mastery:{'door.s5.travel':0,'door.s6.release':0},acting:100,promotionWeek:1};
  s.traveler.promotionWeek=1;s.secretsSorcerer=createSecretsSorcererState();s.secretsSorcerer.guidanceKnown=true;
  s.character.coreStats={physique:20,perception:20,will:20,knowledge:20};
  s.health=100;s.mind=100;s.spirituality=100;s.cash=1000;s.actionsRemaining=4;
  Object.assign(s.secretsSorcerer.bottles[0]!,{status:'PLAYER',acquiredWeek:23});
  return s;
}
function command(s:SliceState,c:SecretsSorcererRitualCommand){const out=handleSecretsSorcererRitualCommand(s,c);expect(out.error).toBeUndefined();return out;}
function prepared(s=fixture()) {command(s,{type:'SURVEY_RITUAL',targetId:'SS4-ARCH-A'});command(s,{type:'PREPARE_SEAL'});return s;}
function start(s=prepared()){command(s,s.progression.sequence===4?{type:'START_CHALLENGE',targetId:'SS4-ARCH-A',confirmed:true}:{type:'START_RITUAL',bottleId:s.secretsSorcerer.bottles[0]!.id,confirmed:true});return s;}
function fixed(...values:number[]):ActionRandomStream {let cursor=0;return {seed:'directed-only',get cursor(){return cursor;},nextInt(min,max){const v=values[cursor++];if(v===undefined||v<min||v>max)throw new Error(`Unexpected directed draw ${cursor}:${v}/${min}-${max}`);return v;}};}
function round(s:SliceState,stance:SliceStance,...values:number[]){
  const original=DeterministicActionRandomStream.prototype.nextInt;let n=0;
  const spy=vi.spyOn(DeterministicActionRandomStream.prototype,'nextInt').mockImplementation(function(this:DeterministicActionRandomStream,min,max){original.call(this,min,max);const v=values[n++];if(v===undefined||v<min||v>max)throw new Error(`Unexpected directed shared draw ${n}:${v}/${min}-${max}`);return v;});
  try {const out=resolveSliceCombatRound(s,stance);s.combatHistory.push(structuredClone(out.round));expect(spy).toHaveBeenCalledTimes(values.length);settleSecretsSorcererRitual(s,out.outcome);return out;}finally{spy.mockRestore();}
}
function captured(s=start()) {const out=round(s,'CONTROL',51,1,261,1,100,261,1,100,361,1);expect(out.outcome).toBe('ENEMY_SEALED');return s;}
function travel(s:SliceState,roll=1){return resolveSecretsSorcererCombatAbility(s,'door.s5.travel',1,fixed(roll));}
function addRecord(s:SliceState){s.recorder.demonstrations.push({id:'recorder-demo-1',sample:'FLASH',actor:'NORA',week:21,revision:5,success:true});s.recorder.records.push({id:'recorder-record-1',sample:'FLASH',sequence:8,status:'STORED',sourceDemoId:'recorder-demo-1',createdWeek:21,releasedWeek:null});}
afterEach(()=>vi.restoreAllMocks());

describe('Secrets Sorcerer same-original demigod ritual',()=>{
  it('keeps three unknown independent originals and requires exact confirmed commands',()=>{
    const s=fixture(),r=s.secretsSorcerer.ritual,p=projectSecretsSorcererRitual(s);
    expect(r.targets.map(t=>t.id)).toEqual(['SS4-ARCH-A','SS4-ARCH-B','SS4-ARCH-C']);
    expect(new Set(r.targets.map(t=>t.entityId)).size).toBe(3);expect(p.enemySpirituality).toBeNull();expect(p.hostileVerified).toBe(false);expect(p.equipment).not.toContain('刃切2');
    expect(validateSecretsSorcererRitualState(s)).toBe(true);
    expect(validateSecretsSorcererRitualCommand({type:'START_RITUAL',bottleId:'x',confirmed:true})).toBe(true);
    expect(validateSecretsSorcererRitualCommand({type:'START_RITUAL',bottleId:'x'})).toBe(false);
    expect(validateSecretsSorcererRitualCommand({type:'END_RITUAL',captured:true})).toBe(false);
  });
  it('requires paid actual survey then the same one-grade frame physically on the floor',()=>{
    const s=prepared(),r=s.secretsSorcerer.ritual,c=currentSecretsSorcererCase(s)!;
    expect(s.actionsRemaining).toBe(2);expect(s.cash).toBe(700);expect(s.spirituality).toBe(100);
    expect(c).toMatchObject({grade:1,capacity:1,charges:3,custody:'PLAYER',location:'FLOOR',targetId:null});
    expect(r.targets[0]).toMatchObject({status:'AVAILABLE',hostileVerified:true,surveyedWeek:24});
    expect(validateSecretsSorcererRitualState(s)).toBe(true);c.location='ARCHIVE';
    const before=structuredClone(s);expect(handleSecretsSorcererRitualCommand(s,{type:'START_RITUAL',bottleId:s.secretsSorcerer.bottles[0]!.id,confirmed:true}).error).toContain('原框箱');expect(s).toEqual(before);
  });
  it('checks real S5 age, acting and own current sources even through the direct handler',()=>{
    const s=prepared();s.progression.acting=99;
    expect(handleSecretsSorcererRitualCommand(s,{type:'START_RITUAL',bottleId:s.secretsSorcerer.bottles[0]!.id,confirmed:true}).error).toContain('扮演100');
    s.progression.acting=100;s.traveler.promotionWeek=20;
    expect(handleSecretsSorcererRitualCommand(s,{type:'START_RITUAL',bottleId:s.secretsSorcerer.bottles[0]!.id,confirmed:true}).error).toContain('12周');
    s.traveler.promotionWeek=1;s.traveler.practice.consent=true;
    expect(handleSecretsSorcererRitualCommand(s,{type:'START_RITUAL',bottleId:s.secretsSorcerer.bottles[0]!.id,confirmed:true}).error).toContain('收束');
  });
  it('allows a real zero-action exit and returns the unused frame without creating a captured target',()=>{
    const s=prepared();s.actionsRemaining=0;command(s,{type:'END_RITUAL'});
    expect(currentSecretsSorcererCase(s)).toMatchObject({custody:'ARCHIVE',location:'ARCHIVE',charges:3,targetId:null});
    expect(s.secretsSorcerer.bottles[0]!.status).toBe('PLAYER');expect(hasSecretsSorcererRitualLock(s)).toBe(false);expect(validateSecretsSorcererRitualState(s)).toBe(true);
  });
  it('seals the same original alive through two real travels and a paid R, ending before unused slots and injury RNG',()=>{
    const s=captured(),last=s.combatHistory.at(-1)!;
    expect(last.playerCount).toBe(4);expect(last.moves.filter(m=>m.actor==='PLAYER')).toHaveLength(3);
    expect(last.winner).toBe('PLAYER');expect(last.consequenceWeights).toBeNull();expect(last.consequenceRoll).toBeUndefined();
    expect(last.secretsSorcererOutcome).toMatchObject({targetId:'SS4-ARCH-A',enemyStatus:'SEALED',enemyHealth:100,enemySpirituality:40,charges:2,restraintMarks:2});
    expect(s.spirituality).toBe(86);expect(s.mind).toBe(98);expect(s.combat).toBeNull();
    expect(currentSecretsSorcererCase(s)).toMatchObject({targetId:'SS4-ARCH-A',sealsIntact:true,custody:'PLAYER',charges:2});
    expect(canConsumeSecretsSorcererRitual(s,s.secretsSorcerer.bottles[0]!.id)).toBeNull();expect(validateSecretsSorcererRitualState(s)).toBe(true);
  });
  it('keeps the sealed live target in the same frame after failed drinking and physical archive return',()=>{
    const s=captured(),b=s.secretsSorcerer.bottles[0]!,a=currentSecretsSorcererAttempt(s)!;
    b.status='CONSUMED';b.consumedWeek=s.week;b.outcome='FAILURE';b.ritualAttemptId=a.id;markSecretsSorcererPotionConsumed(s,b.id);
    expect(s.secretsSorcerer.ritual.phase).toBe('SEALED');expect(hasSecretsSorcererRitualLock(s)).toBe(true);expect(validateSecretsSorcererRitualState(s)).toBe(true);
    s.actionsRemaining=0;command(s,{type:'END_RITUAL'});
    expect(currentSecretsSorcererCase(s)).toMatchObject({targetId:'SS4-ARCH-A',sealsIntact:true,custody:'ARCHIVE',location:'ARCHIVE',charges:2});
    expect(currentSecretsSorcererTarget(s)?.body.health).toBe(100);expect(canConsumeSecretsSorcererRitual(s,b.id)).not.toBeNull();expect(validateSecretsSorcererRitualState(s)).toBe(true);
  });
  it('can decline drinking and return a genuinely sealed target while keeping the original unconsumed potion',()=>{
    const s=captured();command(s,{type:'END_RITUAL'});expect(s.progression.sequence).toBe(5);expect(s.secretsSorcerer.bottles[0]!.status).toBe('PLAYER');
    expect(currentSecretsSorcererCase(s)?.targetId).toBe('SS4-ARCH-A');expect(validateSecretsSorcererRitualState(s)).toBe(true);
    s.actionsRemaining=4;expect(handleSecretsSorcererRitualCommand(s,{type:'SURVEY_RITUAL',targetId:'SS4-ARCH-B'}).error).toContain('下一真实周');
    s.week+=1;expect(handleSecretsSorcererRitualCommand(s,{type:'SURVEY_RITUAL',targetId:'SS4-ARCH-A'}).error).toContain('不会刷新');
    command(s,{type:'SURVEY_RITUAL',targetId:'SS4-ARCH-B'});expect(s.secretsSorcerer.ritual.cases[0]!.targetId).toBe('SS4-ARCH-A');
  });
  it('validates exact seal, original body and historical outcome rather than accepting asserted success',()=>{
    const base=captured();
    const mutate:((s:SliceState)=>void)[]=[s=>{currentSecretsSorcererCase(s)!.targetId='SS4-ARCH-B';},s=>{currentSecretsSorcererCase(s)!.charges=3;},
      s=>{currentSecretsSorcererCase(s)!.sealsIntact=false;},s=>{currentSecretsSorcererTarget(s)!.body.health=0;},
      s=>{s.combatHistory[0]!.secretsSorcererOutcome!.enemyStatus='DEAD';},s=>{s.combatHistory[0]!.consequenceRoll=42;},
      s=>{currentSecretsSorcererAttempt(s)!.captureEvidence!.ownTravelControls=0;},s=>{s.combatHistory=[];}];
    for(const change of mutate){const s=structuredClone(base);change(s);expect(validateSecretsSorcererRitualState(s)).toBe(false);}
    const sorted=(v:unknown):unknown=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,sorted(x)])):v;
    expect(validateSecretsSorcererRitualState(JSON.parse(JSON.stringify(sorted(base))) as SliceState)).toBe(true);
  });
  it('real killing permanently fails the live seal requirement, preserves the corpse and never calls it surrender',()=>{
    const s=start(),out=round(s,'ATTACK',1,1,1,1,1,1,100);
    expect(out.outcome).toBe('ENEMY_DEAD');expect(s.secretsSorcerer.ritual.phase).toBe('FINISHED');expect(currentSecretsSorcererTarget(s)?.body.health).toBe(0);
    expect(currentSecretsSorcererCase(s)?.targetId).toBeNull();expect(canConsumeSecretsSorcererRitual(s,s.secretsSorcerer.bottles[0]!.id)).not.toBeNull();
    command(s,{type:'END_RITUAL'});expect(validateSecretsSorcererRitualState(s)).toBe(true);
  });
  it('retreat takes the same empty frame out through the ground route and preserves injured hostile source/SP',()=>{
    const s=start();travel(s);resolveSecretsSorcererEnemyAbility(s,'SS4-EDGE-CUT',1);
    const out=round(s,'RETREAT',1,1,1);expect(out.outcome).toBe('RETREATED');
    expect(currentSecretsSorcererCase(s)?.location).toBe('PLAYER');expect(currentSecretsSorcererTarget(s)).toMatchObject({status:'LEFT_ALIVE',body:{spirituality:38}});
    command(s,{type:'END_RITUAL'});expect(validateSecretsSorcererRitualState(s)).toBe(true);
  });
  it('gives actual combat death no potion guidance survival floor or free rescue',()=>{
    const s=start(),out=round(s,'ATTACK',1,1,1,1,1,1_000_000,100);
    expect(out.outcome).toBe('PLAYER_DEAD');expect(s.health).toBe(0);expect(s.secretsSorcerer.ritual.phase).toBe('LOST');expect(currentSecretsSorcererCase(s)?.location).toBe('FLOOR');expect(validateSecretsSorcererRitualState(s)).toBe(true);
  });
  it('heavy injury does not automatically make the hostile demigod surrender and finite enemy SP persists',()=>{
    const s=start(),out=round(s,'ATTACK',1,1,1,1,1,1,66);
    expect(out.outcome).toBe('CONTINUE');expect(s.combat?.enemyStatus).toBe('RESISTING');expect(s.combat?.enemyHealth).toBe(70);
    expect(s.secretsSorcerer.ritual.enemySpirituality).toBe(36);expect(currentSecretsSorcererTarget(s)?.body.spirituality).toBe(36);expect(hasSecretsSorcererOpponent(s)).toBe(true);expect(validateSecretsSorcererRitualState(s)).toBe(true);
  });
  it('uses the same original source for post-promotion challenge but creates no ritual potion claim',()=>{
    const s=fixture();s.progression.sequence=4;s.progression.acting=0;s.secretsSorcerer.promotionWeek=23;
    start(prepared(s));expect(currentSecretsSorcererAttempt(s)?.bottleId).toBeNull();expect(s.secretsSorcerer.ritual.mode).toBe('CHALLENGE');
    captured(s);expect(canConsumeSecretsSorcererRitual(s,s.secretsSorcerer.bottles[0]!.id)).not.toBeNull();expect(validateSecretsSorcererRitualState(s)).toBe(true);
  });
});

describe('Secrets Sorcerer bounded real actions',()=>{
  it('has exact neutral six slots and enemy distribution without adding free recorded powers',()=>{
    const s=start();expect(secretsSorcererAbilityWheel(s,null).map(a=>a.weight)).toEqual([30,15,20,20,10,5]);
    expect(playerAbilityWheel(s,null).map(a=>a.id)).toEqual(['STRIKE','door.s6.release','EVADE','door.s5.travel','SS4-CAPTURE','ACCIDENT']);
    expect([1,20,21,70,71,100].map(secretsSorcererEnemyActionCount)).toEqual([2,2,3,3,4,4]);
    expect([45,46,80,81,95,96].map(n=>drawSecretsSorcererEnemyAbility(fixed(n)))).toEqual(['SS4-EDGE-CUT','SS4-REFRACTION','SS4-REFRACTION','SS4-DISPLACEMENT','SS4-DISPLACEMENT','SS4-STUMBLE']);
    expect(drawSecretsSorcererAbility(fixed(261),s,'CONTROL')).toBe('door.s5.travel');
  });
  it('reserves both travel costs upfront, preserves failures and makes no permanent control claim',()=>{
    const s=start();s.spirituality=3;const before=structuredClone(s);expect(resolveSecretsSorcererCombatAbility(s,'door.s5.travel',1,fixed()).enemyReduction).toBe(0);expect(s).toEqual(before);
    s.spirituality=100;expect(travel(s,100).enemyReduction).toBe(0);expect(s.spirituality).toBe(96);expect(s.secretsSorcerer.ritual.restraintMarks).toBe(0);
    expect(travel(s).enemyReduction).toBeCloseTo(10.4);expect(travel(s).enemyReduction).toBeCloseTo(10.4);expect(s.secretsSorcerer.ritual.restraintMarks).toBe(2);
    resolveSecretsSorcererEnemyAbility(s,'SS4-DISPLACEMENT',1);expect(s.secretsSorcerer.ritual.restraintMarks).toBe(0);expect(s.secretsSorcerer.ritual.enemySpirituality).toBe(35);
  });
  it('does not pay an ineligible capture, but paid failure consumes actual charge/SP/mind and clears restraints',()=>{
    const s=start(),before=structuredClone(s);expect(resolveSecretsSorcererCombatAbility(s,'SS4-CAPTURE',1,fixed()).captured).toBeUndefined();expect(s).toEqual(before);
    travel(s);travel(s);const effect=resolveSecretsSorcererCombatAbility(s,'SS4-CAPTURE',1,fixed(100));
    expect(effect.captured).toBeUndefined();expect(s.spirituality).toBe(86);expect(s.mind).toBe(98);expect(currentSecretsSorcererCase(s)?.charges).toBe(2);expect(s.secretsSorcerer.ritual.restraintMarks).toBe(0);expect(currentSecretsSorcererCase(s)?.targetId).toBeNull();
  });
  it('exhausts the same three frame charges and then refuses another capture without extra cost or a replacement box',()=>{
    const s=start();
    for(let i=0;i<3;i++){travel(s);travel(s);resolveSecretsSorcererCombatAbility(s,'SS4-CAPTURE',1,fixed(100));}
    expect(currentSecretsSorcererCase(s)?.charges).toBe(0);expect(currentSecretsSorcererAttempt(s)?.captureAttempts).toBe(3);
    expect(s.mind).toBe(94);expect(s.secretsSorcerer.ritual.cases).toHaveLength(1);
    travel(s);travel(s);const before=structuredClone(s);
    expect(resolveSecretsSorcererCombatAbility(s,'SS4-CAPTURE',1,fixed()).captured).toBeUndefined();expect(s).toEqual(before);
  });
  it('keeps independent finite enemy spells, one refraction layer and physical fallback without regeneration',()=>{
    const s=start();resolveSecretsSorcererEnemyAbility(s,'SS4-REFRACTION',1);resolveSecretsSorcererEnemyAbility(s,'SS4-REFRACTION',1);
    expect(s.secretsSorcerer.ritual.enemySpirituality).toBe(32);expect(resolveSecretsSorcererCombatAbility(s,'STRIKE',1,fixed()).selfGain).toBe(0);expect(resolveSecretsSorcererCombatAbility(s,'STRIKE',1,fixed()).selfGain).toBe(12);
    s.secretsSorcerer.ritual.enemySpirituality=1;expect(resolveSecretsSorcererEnemyAbility(s,'SS4-EDGE-CUT',1).selfGain).toBe(24);expect(resolveSecretsSorcererEnemyAbility(s,'SS4-DISPLACEMENT',1).selfGain).toBe(0);expect(s.secretsSorcerer.ritual.enemySpirituality).toBe(1);
  });
  it('consumes only the first actual old stored record once per round and weak flash does not capture',()=>{
    const s=start();addRecord(s);s.secretsSorcerer.ritual.refraction=true;const context=createSecretsSorcererRecorderRound(s);
    const e=resolveSecretsSorcererCombatAbility(s,'door.s6.release',1,fixed(),currentSecretsSorcererCombatSource(s),context);
    expect(e.enemyReduction).toBeCloseTo(7.8);expect(s.spirituality).toBe(98);expect(s.recorder.records[0]!.status).toBe('RELEASED');expect(s.secretsSorcerer.ritual.refraction).toBe(false);expect(s.secretsSorcerer.ritual.restraintMarks).toBe(0);
    expect(resolveSecretsSorcererCombatAbility(s,'door.s6.release',1,fixed(),currentSecretsSorcererCombatSource(s),context).enemyReduction).toBe(0);expect(s.spirituality).toBe(98);
  });
  it('does not grant a record when the old original demonstration is false',()=>{
    const s=start();addRecord(s);s.recorder.demonstrations[0]!.success=false;const before=structuredClone(s);
    expect(resolveSecretsSorcererCombatAbility(s,'door.s6.release',1,fixed()).enemyReduction).toBe(0);expect(s).toEqual(before);
  });
  it('has no stale, corpse, old carried witness, remote or invented source actions',()=>{
    const s=start(),source=currentSecretsSorcererCombatSource(s)!;s.revision+=1;const before=structuredClone(s);
    expect(resolveSecretsSorcererCombatAbility(s,'door.s5.travel',1,fixed(),source).enemyReduction).toBe(0);expect(s).toEqual(before);
    s.world.city='TINGEN';expect(hasSecretsSorcererOpponent(s)).toBe(false);expect(()=>resolveSliceCombatRound(s,'CONTROL')).toThrow();
  });
  it('S4 short hiding pays6, returns through the real original door in the same slot, and uses ordinary fallback when short',()=>{
    const s=fixture();s.progression.sequence=4;s.secretsSorcerer.promotionWeek=23;start(prepared(s));
    expect(resolveSecretsSorcererCombatAbility(s,'door.s4.space-hiding',1,fixed(1)).enemyReduction).toBeCloseTo(15.6);expect(s.spirituality).toBe(94);
    s.spirituality=5;expect(resolveSecretsSorcererCombatAbility(s,'door.s4.space-hiding',1,fixed()).enemyReduction).toBe(10);expect(s.spirituality).toBe(5);
    expect(s.secretsSorcerer.life.room.hidden).toBe(false);expect(s.secretsSorcerer.life.room.position).toBe('OUTSIDE');
  });
});
