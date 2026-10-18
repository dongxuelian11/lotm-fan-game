import { describe, expect, it } from 'vitest';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { LIFE_GIVER_COUNT_WHEEL } from '../../src/domain/life-giver/combat.js';
import { BEAUTY_GODDESS_CASE_IDS } from '../../src/domain/beauty-goddess/life.js';
import { validateBeautyGoddessEncounter, validateBeautyGoddessEncounterCommand, projectBeautyGoddessEncounter,
  beautyGoddessEncounterOriginalEvents, type BeautyGoddessPolicy } from '../../src/domain/beauty-goddess/encounter.js';
import { SELF_POISE, BOUNDED_MOONFORM, BEAUTY_GODDESS_INHERITED_SKILL_IDS, BEAUTY_GODDESS_COMBAT_CONSTANTS,
  BEAUTY_GODDESS_COUNT_WHEEL, BEAUTY_GODDESS_ENEMY_COUNT_WHEEL, beautyGoddessAbilityWheel,
  currentBeautyGoddessCombatSource, createBeautyGoddessRuntime, declareBeautyGoddessEnemyAction,
  resolveBeautyGoddessPlayerSlot, resolveBeautyGoddessEnemySlot, advanceBeautyGoddessCombatClock,
  replayBeautyGoddessCombatRound, validBeautyGoddessCombatSource, validateBeautyGoddessCombatRound,
  validateBeautyGoddessRoundOutcome, type BeautyGoddessCombatSource } from '../../src/domain/beauty-goddess/combat.js';
import { bg, promoted, originalLifeGiver, recoverResources, rejectBeautyGoddess, step } from './beauty-goddess-directed-helper.js';

let readyCache:SliceState|undefined;
/** Declared unit setup is supplied by the acquisition helper before its journal.
 * The raw historical final fixture is explicitly migrated by that helper.
 * Everything below is an actual public command; no natural outcome is invented. */
function ready():SliceState {
  if(!readyCache){let s=recoverResources(promoted());
    for(const caseId of BEAUTY_GODDESS_CASE_IDS){
      s=bg(s,{type:'OBSERVE',caseId});s=bg(s,{type:'INVITE',caseId,method:'ORDINARY'});s=bg(s,{type:'VISIT_HOME'});
      s=bg(s,{type:'CONSENT',permission:'CARETAKER'});s=bg(s,{type:'CONSENT',permission:'GUEST'});s=bg(s,{type:'DECLINE_CONSENT',permission:'SELF_POWER'});s=bg(s,{type:'BORROW_WEIGHT'});
      if(caseId==='withdrawn-moonlight'){s=bg(s,{type:'LOWER_SHUTTER'});s=bg(s,{type:'REVOKE_CONSENT',permission:'GUEST'});s=bg(s,{type:'RAISE_SHUTTER'});}
      s=bg(s,{type:'ORDINARY_PLACE'});s=bg(s,{type:'RETURN_WEIGHT'});s=bg(s,{type:'RETURN_HOME'});s=bg(s,{type:'REPORT',caseId});
    }
    readyCache=bg(s,{type:'REFLECT'});assertValidSliceState(readyCache);
  }return structuredClone(readyCache);
}
const fightingCache=new Map<string,SliceState>();
function fighting(policy:BeautyGoddessPolicy='ALL',materials=true):SliceState {
 const key=`${policy}:${materials}`;if(!fightingCache.has(key)){let s=ready();if(materials){s=bg(s,{type:'BUY_BATTLE_LAMP'});for(let n=0;n<3;n++)s=bg(s,{type:'PREPARE_BATTLE_PIECE'});}s=bg(s,{type:'ENCOUNTER_TALK'});s=bg(s,{type:'ENCOUNTER_POLICY',policy});s=bg(s,{type:'ENCOUNTER_FIGHT'});assertValidSliceState(s);fightingCache.set(key,s);}return structuredClone(fightingCache.get(key)!);
}
function source(policy:BeautyGoddessPolicy='ALL',materials=true):BeautyGoddessCombatSource {const x=currentBeautyGoddessCombatSource(fighting(policy,materials));if(!x)throw new Error('Actual directed public encounter is absent.');expect(validBeautyGoddessCombatSource(x)).toBe(true);return x;}
/** Isolated declared slot rolls are never written into a campaign RNG. */
function random(...rolls:number[]):ActionRandomStream {let cursor=0;return{seed:'declared-isolated-slot',get cursor(){return cursor;},nextInt(min,max){const n=rolls[cursor++];if(n===undefined||n<min||n>max)throw new Error(`Unexpected slot draw ${n} for ${min}..${max}`);return n;}};}

describe('Beauty Goddess actual inheritance and optional paid battlefield',()=>{
 it('keeps original Moon numeric profile, all twenty-one masteries and original material states',()=>{
  const old=originalLifeGiver(),s=ready(),x=source();expect(BEAUTY_GODDESS_COUNT_WHEEL).toBe(LIFE_GIVER_COUNT_WHEEL);expect(BEAUTY_GODDESS_ENEMY_COUNT_WHEEL).toBe(LIFE_GIVER_COUNT_WHEEL);
  expect(BEAUTY_GODDESS_COUNT_WHEEL.map(a=>a.weight)).toEqual([10,15,25,25,15,10]);expect(BEAUTY_GODDESS_COMBAT_CONSTANTS).toMatchObject({weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12});
  expect(BEAUTY_GODDESS_INHERITED_SKILL_IDS).toHaveLength(21);for(const id of BEAUTY_GODDESS_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(old.progression.mastery[id]);expect(BEAUTY_GODDESS_INHERITED_SKILL_IDS.filter(id=>s.progression.mastery[id]===0)).toHaveLength(7);
  expect(x.papers.map(p=>p.status)).toEqual(['CONSUMED','CONSUMED','CONSUMED']);expect(x.oldBeads).toEqual(old.lifeGiver.life.beads);expect(x.oldBeads.filter(p=>p.purpose==='COMBAT').map(p=>[p.status,p.location])).toEqual([['SPENT','RETURN_TRAY'],['SPENT','RETURN_TRAY'],['SPENT','RETURN_TRAY']]);
  expect(x.partner).toEqual(old.summoningMaster.life.partner);expect(x.partner.location).toBe('HOME');expect(x).toMatchObject({targetId:'BG1-OSWALD-REED',targetName:'奥斯瓦尔德·里德',targetAge:46,targetCore:24,thirdPartiesInArea:0,body:{enemyHealth:100,enemyMind:100,enemySpirituality:120}});
  expect(x.materials.weapon).toMatchObject({id:'BG1-OSWALD-ROD',owner:'BG1-OSWALD-REED',charge:4});expect(x.materials.lamp).toMatchObject({id:'BG1-BATTLE-LAMP',fuelSeconds:176,lit:true,blocked:false});expect(beautyGoddessAbilityWheel(s,null).reduce((n,a)=>n+a.weight,0)).toBeCloseTo(100);
 });
 it('has no free battle lamp or pieces; explicit preparation pays every object once',()=>{
  let s=ready();expect(s.beautyGoddess.encounter.materials).toMatchObject({lamp:null,pieces:[]});const cash=s.cash,ap=s.actionsRemaining;
  s=bg(s,{type:'BUY_BATTLE_LAMP'});rejectBeautyGoddess(s,{type:'BUY_BATTLE_LAMP'});for(let n=0;n<3;n++)s=bg(s,{type:'PREPARE_BATTLE_PIECE'});rejectBeautyGoddess(s,{type:'PREPARE_BATTLE_PIECE'});
  expect(s.cash).toBe(cash-250);expect(s.actionsRemaining).toBe(ap-4);expect(s.beautyGoddess.encounter.purchases).toHaveLength(4);expect(s.beautyGoddess.encounter.materials.pieces.map(p=>p.id)).toEqual(['BG1-BATTLE-MOON-PIECE-1','BG1-BATTLE-MOON-PIECE-2','BG1-BATTLE-MOON-PIECE-3']);expect(validateBeautyGoddessEncounter(s)).toBe(true);
  const changed=structuredClone(s);changed.beautyGoddess.encounter.purchases[0]!.after.cash++;expect(validateBeautyGoddessEncounter(changed)).toBe(false);
 });
 it('requires real life closure, talk and deliberate policy; default policy is not consent',()=>{
  rejectBeautyGoddess(promoted(),{type:'ENCOUNTER_TALK'});rejectBeautyGoddess(ready(),{type:'ENCOUNTER_FIGHT'});
  const arrived=bg(ready(),{type:'ENCOUNTER_TALK'}),p=projectBeautyGoddessEncounter(arrived);expect(p.policyConfirmed).toBe(false);expect(p.scene).toMatchObject({playerLocation:'YARD',playerCoordinate:4,enemyCoordinate:6,playerTravelMetres:4,clockSeconds:4,presentMemberIds:[]});rejectBeautyGoddess(arrived,{type:'ENCOUNTER_FIGHT'});
  const selected=bg(arrived,{type:'ENCOUNTER_POLICY',policy:'INHERITED_ONLY'});expect(projectBeautyGoddessEncounter(selected).policyConfirmed).toBe(true);const left=bg(selected,{type:'LEAVE_ENCOUNTER'});
  expect(left.beautyGoddess.encounter.scene).toMatchObject({playerLocation:'OUTSIDE',playerCoordinate:0,playerTravelMetres:8,clockSeconds:8});expect(validateBeautyGoddessEncounter(left)).toBe(true);rejectBeautyGoddess(left,{type:'ENCOUNTER_TALK'});rejectBeautyGoddess(fighting(),{type:'ENCOUNTER_POLICY',policy:'ORDINARY'});expect(JSON.stringify(p)).not.toMatch(/候选|\dG|（G）/);
 });
 it('rejects invented fields, recycled enemies, altered old values and resources',()=>{
  for(const c of [{type:'ENCOUNTER_POLICY',policy:'ALL',extra:true},{type:'ENCOUNTER_FIGHT',target:'LG2-ADRIAN-VALE'},{type:'REFILL_BATTLE_LAMP'}])expect(validateBeautyGoddessEncounterCommand(c)).toBe(false);
  for(const mutate of [(x:BeautyGoddessCombatSource)=>{(x as unknown as {targetId:string}).targetId='LG2-ADRIAN-VALE';},(x:BeautyGoddessCombatSource)=>{x.mastery['moon.s3.guest-cooperation']=1;},(x:BeautyGoddessCombatSource)=>{x.partner.location='YARD';},(x:BeautyGoddessCombatSource)=>{x.oldBeads[0]!.location='PLAYER';},(x:BeautyGoddessCombatSource)=>{x.root.presentMemberIds.push('BG1-DARIA42');},(x:BeautyGoddessCombatSource)=>{x.materials.lamp!.fuelSeconds++;},(x:BeautyGoddessCombatSource)=>{x.randomSeed='substituted';}]){const x=source();mutate(x);expect(validBeautyGoddessCombatSource(x)).toBe(false);}
 });
});

describe('finite paid self-poise and visible pending moonform',()=>{
 it('uses ordinary fallback for unavailable inherited guest, beads and consumed papers without a hidden body or refill',()=>{
  const x=source(),r=createBeautyGoddessRuntime(x),before=structuredClone(r);
  for(const id of ['moon.s3.bounded-summoning','moon.s3.guest-cooperation','moon.s2.bounded-vitality','moon.s2.shared-shelter','moon.s4.moon-paper-substitute'] as const){const a=resolveBeautyGoddessPlayerSlot(x,r,id,0,random());expect(a.paidCost).toBe(0);expect(a.masteryApplied).toEqual([]);expect(a.fallbackReason).not.toBeNull();}
  expect(r.playerS).toBe(before.playerS);expect(r.playerM).toBe(before.playerM);expect(r.papers).toEqual(x.papers);expect(x.partner.location).toBe('HOME');expect(r.mastery).toEqual(x.mastery);
 });
 it('pays six spirituality and two mind once; failed or empty windows never grant skill',()=>{
  const x=source(),r=createBeautyGoddessRuntime(x);expect(resolveBeautyGoddessPlayerSlot(x,r,SELF_POISE,0,random(100))).toMatchObject({paidCost:6,mindCost:2,finiteResult:'FAILED'});expect(r.mastery).toEqual(x.mastery);expect(resolveBeautyGoddessPlayerSlot(x,r,SELF_POISE,1,random())).toMatchObject({paidCost:0,finiteResult:'ALREADY_ATTEMPTED'});
  const r2=createBeautyGoddessRuntime(x);resolveBeautyGoddessPlayerSlot(x,r2,SELF_POISE,0,random(1));expect(r2.mastery).toEqual(x.mastery);advanceBeautyGoddessCombatClock(r2,30);expect(r2.windows.selfPoise).toBeNull();expect(r2.mastery).toEqual(x.mastery);expect(r2.playerS).toBe(x.playerSpirituality-6);expect(r2.playerM).toBe(x.playerMind-2);
 });
 it('only boosts one later actual usable own operation, not resource-ineligible fallback',()=>{
  const x=source(),r=createBeautyGoddessRuntime(x);resolveBeautyGoddessPlayerSlot(x,r,SELF_POISE,0,random(1));const unavailable=resolveBeautyGoddessPlayerSlot(x,r,'moon.s4.moon-paper-substitute',1,random());expect(unavailable.enemyReduction).toBe(10);expect(unavailable.masteryApplied).toEqual([]);expect(r.windows.selfPoise).not.toBeNull();
  const actual=resolveBeautyGoddessPlayerSlot(x,r,'STRIKE',2,random());expect(actual.selfGain).toBe((x.clubHeld?16:12)+25);expect(actual.masteryApplied).toEqual([SELF_POISE]);expect(r.body.selfPoiseSuccesses).toBe(1);expect(r.windows.selfPoise).toBeNull();expect(resolveBeautyGoddessPlayerSlot(x,r,'STRIKE',3,random()).masteryApplied).toEqual([]);for(const id of BEAUTY_GODDESS_INHERITED_SKILL_IDS)expect(r.mastery[id]).toBe(x.mastery[id]);
 });
 it('requires actual paid lamp, real piece, allowed policy and a visible pending BODY target',()=>{
  const x=source(),r=createBeautyGoddessRuntime(x);expect(resolveBeautyGoddessPlayerSlot(x,r,BOUNDED_MOONFORM,0,random())).toMatchObject({paidCost:0,finiteResult:'UNAVAILABLE'});declareBeautyGoddessEnemyAction(x,r,'MIND_PRESSURE',0);expect(resolveBeautyGoddessPlayerSlot(x,r,BOUNDED_MOONFORM,1,random()).paidCost).toBe(0);resolveBeautyGoddessEnemySlot(x,r,'MIND_PRESSURE',2,random());expect(resolveBeautyGoddessPlayerSlot(x,r,BOUNDED_MOONFORM,3,random()).paidCost).toBe(0);
  for(const [policy,materials] of [['INHERITED_ONLY',true],['ALL',false]] as const){const absent=source(policy,materials),model=createBeautyGoddessRuntime(absent);declareBeautyGoddessEnemyAction(absent,model,'MOON_BOLT',0);expect(resolveBeautyGoddessPlayerSlot(absent,model,BOUNDED_MOONFORM,0,random()).paidCost).toBe(0);expect(model.mastery).toEqual(absent.mastery);}
 });
 it('failed and resisted moonform consumes the same real piece and eight spirituality plus three mind',()=>{
  for(const rolls of [[100],[1,30]]){const x=source(),r=createBeautyGoddessRuntime(x);declareBeautyGoddessEnemyAction(x,r,'MOON_BOLT',0);const a=resolveBeautyGoddessPlayerSlot(x,r,BOUNDED_MOONFORM,0,random(...rolls));expect(a).toMatchObject({paidCost:8,mindCost:3,pieceId:'BG1-BATTLE-MOON-PIECE-1'});expect(['FAILED','RESISTED']).toContain(a.finiteResult);expect(r.materials.pieces[0]).toMatchObject({status:'SPENT',location:'YARD',spentWeek:x.week,combatRound:x.round});expect(r.windows.moonform).toBeNull();expect(r.mastery).toEqual(x.mastery);expect(resolveBeautyGoddessPlayerSlot(x,r,BOUNDED_MOONFORM,1,random()).finiteResult).toBe('ALREADY_ATTEMPTED');}
 });
 it('reduces only that actual pending BODY impact by thirty and does not cancel later or mental attacks',()=>{
  const x=source(),r=createBeautyGoddessRuntime(x),pending=declareBeautyGoddessEnemyAction(x,r,'MOON_BOLT',0);expect(pending).toMatchObject({bodyImpact:true,observationSeconds:1});expect(pending.observedAt).toBe(pending.declaredAt+1);
  const cast=resolveBeautyGoddessPlayerSlot(x,r,BOUNDED_MOONFORM,0,random(1,100));expect(cast).toMatchObject({finiteResult:'PENDING',paidCost:8,mindCost:3,selfGain:0});expect(r.mastery).toEqual(x.mastery);
  const actual=resolveBeautyGoddessEnemySlot(x,r,'MOON_BOLT',1,random());expect(actual).toMatchObject({paidCost:7,rodChargeSpent:1,rawContribution:105,selfGain:75,attackKind:'BODY',threatens:true,masteryApplied:[BOUNDED_MOONFORM]});expect(r.windows.moonform).toBeNull();expect(resolveBeautyGoddessEnemySlot(x,r,'MOON_BOLT',2,random()).selfGain).toBe(105);expect(resolveBeautyGoddessEnemySlot(x,r,'MIND_PRESSURE',3,random())).toMatchObject({selfGain:70,attackKind:'MENTAL',mentalPressure:true,threatens:false});
 });
 it('finite light can be blocked or exhausted; unblocking does not return fuel or expired effects',()=>{
  const x=source(),r=createBeautyGoddessRuntime(x);resolveBeautyGoddessEnemySlot(x,r,'SHADE',0,random());expect(r.materials.lamp!.blocked).toBe(true);declareBeautyGoddessEnemyAction(x,r,'MOON_BOLT',0);expect(resolveBeautyGoddessPlayerSlot(x,r,BOUNDED_MOONFORM,1,random()).paidCost).toBe(0);
  const fuel=r.materials.lamp!.fuelSeconds;resolveBeautyGoddessPlayerSlot(x,r,'OBSERVE',2,random());expect(r.materials.lamp!.blocked).toBe(false);expect(r.materials.lamp!.fuelSeconds).toBe(fuel-4);resolveBeautyGoddessPlayerSlot(x,r,BOUNDED_MOONFORM,3,random(1,100));advanceBeautyGoddessCombatClock(r,180);expect(r.materials.lamp).toMatchObject({fuelSeconds:0,lit:false});expect(r.windows.moonform).toBeNull();expect(resolveBeautyGoddessEnemySlot(x,r,'MOON_BOLT',4,random()).selfGain).toBe(105);expect(r.mastery).toEqual(x.mastery);expect(r.materials.pieces[0]!.status).toBe('SPENT');
 });
 it('exhausts four own rod charges, then falls back without recharging or repeating a draw',()=>{
  const x=source(),r=createBeautyGoddessRuntime(x);for(let n=0;n<4;n++)resolveBeautyGoddessEnemySlot(x,r,'MOON_BOLT',n,random());expect(r.materials.weapon.charge).toBe(0);expect(r.body.powerUses.MOON_BOLT).toBe(4);expect(resolveBeautyGoddessEnemySlot(x,r,'MOON_BOLT',4,random())).toMatchObject({selectedAbility:'BODY_STRIKE',paidCost:0,rodChargeSpent:0,attackKind:'BODY'});expect(r.body.enemySpirituality).toBe(92);
 });
});

describe('deterministic receipts and actual terminal resource continuity',()=>{
 it('replays exact RNG, costs, window applications and body/mental consequences',()=>{
  const x=source(),result=replayBeautyGoddessCombatRound(x,'CONTROL'),o=result.round.beautyGoddessOutcome!;expect(validateBeautyGoddessCombatRound(result.round)).toBe(true);expect(validateBeautyGoddessRoundOutcome(o)).toBe(true);expect(replayBeautyGoddessCombatRound(x,'CONTROL')).toEqual(result);expect(o.elapsedSeconds).toBe(60);expect(o.rootAfter.clockSeconds).toBe(x.root.clockSeconds+60);expect(o.materialsAfter.lamp!.fuelSeconds).toBe(116);expect(o.windowsAfter).toEqual({moonform:null,selfPoise:null,attention:null});expect(o.papers).toEqual(x.papers);
  for(const mutate of [(v:typeof result.round)=>{v.playerAdvantage++;},(v:typeof result.round)=>{v.beautyGoddessOutcome!.playerSpiritualityAfter++;},(v:typeof result.round)=>{v.beautyGoddessOutcome!.materialsAfter.lamp!.fuelSeconds++;},(v:typeof result.round)=>{v.beautyGoddessOutcome!.materialsAfter.pieces[0]!.sourceId+='-forged';},(v:typeof result.round)=>{(v.beautyGoddessOutcome as unknown as Record<string,unknown>).freeGuest=true;}]){const changed=structuredClone(result.round);mutate(changed);expect(validateBeautyGoddessCombatRound(changed)).toBe(false);}
 });
 it('resolves the public encounter and preserves actual old people, wounds, costs and original identities',()=>{
  let s=fighting();const old=originalLifeGiver(),partner=structuredClone(s.summoningMaster.life.partner),materials=structuredClone(s.beautyGoddess.encounter.materials);
  for(let n=0;s.combat&&n<64;n++)s=step(s,{type:'COMBAT_ROUND',stance:n>8?'RETREAT':'CONTROL'});
  expect(s.combat).toBeNull();expect(s.beautyGoddess.encounter.terminal).not.toBeNull();assertValidSliceState(s);expect(validateBeautyGoddessEncounter(s)).toBe(true);expect(s.summoningMaster.life.partner).toEqual(partner);expect(s.lifeGiver).toEqual(old.lifeGiver);expect(s.witchKing.life.papers).toEqual(old.witchKing.life.papers);for(const id of BEAUTY_GODDESS_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(old.progression.mastery[id]);
  const e=s.beautyGoddess.encounter,t=e.terminal!;expect(e.materials.pieces.map(p=>p.id)).toEqual(materials.pieces.map(p=>p.id));expect(e.materials.lamp!.id).toBe(materials.lamp!.id);expect(e.materials.lamp!.fuelSeconds).toBeLessThanOrEqual(materials.lamp!.fuelSeconds);expect(e.materials.lamp!.lit).toBe(false);expect(beautyGoddessEncounterOriginalEvents(s)).toHaveLength(t.round);
  if(t.outcome==='PLAYER_DEAD'){expect(s.status).toBe('DEAD');expect(s.health).toBe(0);expect(t.exitMetres).toBe(0);expect(e.materials.pieces.every(p=>p.location==='YARD')).toBe(true);}else{expect(t.exitMetres).toBe(4);expect(t.exitSeconds).toBe(4);expect(e.scene.playerLocation).toBe('OUTSIDE');expect(e.materials.pieces.every(p=>p.location==='RETURN_TRAY')).toBe(true);expect(e.materials.lamp!.location).toBe('RETURN_TRAY');}
  for(const mutate of [(v:SliceState)=>{v.cash++;},(v:SliceState)=>{v.actionsRemaining++;},(v:SliceState)=>{v.beautyGoddess.encounter.scene.clockSeconds++;},(v:SliceState)=>{v.beautyGoddess.encounter.materials.lamp!.fuelSeconds++;}]){const changed=structuredClone(s);mutate(changed);expect(validateBeautyGoddessEncounter(changed)).toBe(false);}
 },120000);
});
