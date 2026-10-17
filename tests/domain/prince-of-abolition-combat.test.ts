import { afterEach, describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { PRINCE_OF_ABOLITION_PREPARATION_IDS } from '../../src/domain/prince-of-abolition/types.js';
import { projectPrinceOfAbolitionLife } from '../../src/domain/prince-of-abolition/life.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { PrinceOfAbolitionOriginals, PrinceOfAbolitionSite } from '../../src/domain/prince-of-abolition/types.js';
import { DIRECTED, MAINTENANCE, AMPLIFICATION, PROLONGATION, PRINCE_OF_ABOLITION_COUNT_WHEEL, PRINCE_OF_ABOLITION_ENEMY_ABILITY_WHEEL, PRINCE_OF_ABOLITION_GIFT_GROUND,
  advancePrinceOfAbolitionCombatClock, createPrinceOfAbolitionRuntime, drawPrinceOfAbolitionAbility, princeOfAbolitionAbilityWheel, princeOfAbolitionActionCount,
  nextPrinceOfAbolitionCombatSource, replayPrinceOfAbolitionCombatRound, resolvePrinceOfAbolitionPlayerSlot, resolvePrinceOfAbolitionEnemySlot,
  validatePrinceOfAbolitionCombatRound, validatePrinceOfAbolitionRoundOutcome, validPrinceOfAbolitionCombatSource, projectPrinceOfAbolitionCombat, projectPrinceOfAbolitionRoundOutcome,
  type PrinceOfAbolitionCombatSource, type PrinceOfAbolitionRoundOutcome } from '../../src/domain/prince-of-abolition/combat.js';
import { createPrinceOfAbolitionBody, createPrinceOfAbolitionSupportPieces, createPrinceOfAbolitionEncounterState, princeOfAbolitionApproachedSite,
  leavePrinceOfAbolitionCombatSite, princeOfAbolitionCompletedBudgetMatches, validatePrinceOfAbolitionPreparation, validatePrinceOfAbolitionEncounterCommand, projectPrinceOfAbolitionEncounter, validatePrinceOfAbolitionEncounter,
  type PrinceOfAbolitionPreparation } from '../../src/domain/prince-of-abolition/encounter.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { oldBlackEmperorRoots, promotedDigested, directedInitial2, originalEntropyDuke, dose, poa, ready, step, rejectPrinceOfAbolition } from './prince-of-abolition-directed-helper.js';

/** Declared kernel UNIT. Actual original743-command endpoint and15 physical gifts are
 * copied as evidence; no fixture, historical root, natural draw or published save is edited. */
function source(): PrinceOfAbolitionCombatSource {
  const old=readObjectEntry<SliceState>('tests/fixtures/entropy-duke-v01830/natural.json','final');
  const originals:PrinceOfAbolitionOriginals={site:structuredClone(old.frenzyMage.life) as PrinceOfAbolitionSite,operation:structuredClone(old.entropyDuke.life.operation),gifts:structuredClone(old.briber.gifts)};
  const site=structuredClone(originals.site);site.playerLocation='OUTSIDE';site.playerTravelMetres+=4;site.clockSeconds+=4;
  const mastery={...old.progression.mastery,[DIRECTED]:0,[MAINTENANCE]:0},date=addGameWeeks(old.date,2),week=old.week+2;
  const before={cash:1000,actions:10,health:100,mind:100,spirituality:120,pollution:0,gender:old.character.gender,sequence:1 as const,acting:100,coreStats:{physique:30,perception:24,will:26,knowledge:24},mastery,completedSources:[...old.seer.completedSources],injuries:[],injuryRisk:0,gifts:structuredClone(originals.gifts)};
  const finance={weeklyBudget:10,lifeTier:'DESTITUTE' as const,nextLifeTier:'DESTITUTE' as const,debts:[],missedWeeks:0,credit:'NORMAL' as const};
  const prep:PrinceOfAbolitionPreparation={week,date,revision:old.revision+2,runId:old.runId,randomSeed:old.random.seed,randomCursor:old.random.cursor,pricePaid:30,mindPaid:2,actionsPaid:0,lifeJournalLength:1,lifeClockSeconds:site.clockSeconds,before,after:{...before,cash:970,mind:98},finance,site,operation:structuredClone(originals.operation),originals};
  return {runId:old.runId,revision:old.revision+4,week,date,round:1,encounterId:'PRINCE_OF_ABOLITION_DISPUTE',targetId:'PA1-EDMUND',attemptWeek:week,startHistoryIndex:old.combatHistory.length,
    targetName:'埃德蒙·维尔',targetAge:44,targetPathway:'independent-caster',targetSequence:2,targetCore:24,targetWill:22,maxActionCount:6,
    actualBody:true,independentMind:true,enemyWeapon:'PA1-EDMUND-ROD',weaponOwner:'PA1-EDMUND',yardId:'PA1-ADJACENT-YARD',playerPosition:'YARD',enemyPosition:'YARD',enemyDistanceMetres:2,
    ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,automaticAllyImmunity:false,freeSkillLibrary:false,
    playerHealth:100,playerMind:98,playerSpirituality:120,playerInjuries:[],playerRisk:0,...before.coreStats,mastery:{...mastery},clubHeld:false,gifts:structuredClone(originals.gifts),
    preparation:prep,site:princeOfAbolitionApproachedSite(site,originals),operation:structuredClone(originals.operation),originals,body:{...createPrinceOfAbolitionBody(),supportPieces:createPrinceOfAbolitionSupportPieces()},
    budget:{...prep.after,actions:8},finance,policy:'ALL',randomSeed:old.random.seed,randomCursor:old.random.cursor};
}
function random(...rolls:number[]):ActionRandomStream { let cursor=0;return {seed:'declared-slot-unit',get cursor(){return cursor;},nextInt(min,max){const n=rolls[cursor++];if(n===undefined||n<min||n>max)throw new Error(`Unexpected UNIT draw ${n} in ${min}..${max}`);return n;}}; }
function scripted(rolls:number[]) { let cursor=0;const original=DeterministicActionRandomStream.prototype.nextInt;vi.spyOn(DeterministicActionRandomStream.prototype,'nextInt').mockImplementation(function(this:DeterministicActionRandomStream,min,max){original.call(this,min,max);const n=rolls[cursor++];if(n===undefined||n<min||n>max)throw new Error(`Unexpected UNIT draw ${n} in ${min}..${max}`);return n;}); }
afterEach(()=>vi.restoreAllMocks());
const bribery='black-emperor.s7.bribery-weakening',deviation='black-emperor.s3.ordered-deviation';

describe('PrinceOfAbolition exact finite inherited combat kernel',()=>{
  it('samples the displayed six-count wheel and exact inherited30/15/25/10/15/5 plus20/20 ability tickets',()=>{
    const x=source();expect(validPrinceOfAbolitionCombatSource(x)).toBe(true);expect(validatePrinceOfAbolitionPreparation(x.preparation)).toBe(true);
    expect(PRINCE_OF_ABOLITION_COUNT_WHEEL.map(x=>x.weight)).toEqual([10,15,25,25,15,10]);
    expect(Array.from({length:100},(_,i)=>princeOfAbolitionActionCount(i+1)).reduce((counts,n)=>(counts[n-1]=(counts[n-1]??0)+1,counts),[0,0,0,0,0,0])).toEqual([10,15,25,25,15,10]);
    const wheel=princeOfAbolitionAbilityWheel({princeOfAbolition:{encounter:{policy:'ALL'}}} as SliceState,null),counts=new Map<string,number>();
    for(let n=1;n<=560;n++){const id=drawPrinceOfAbolitionAbility(random(n),null,null);counts.set(id,(counts.get(id)??0)+1);}
    expect(wheel.map(a=>counts.get(a.id))).toEqual([120,60,100,40,60,20,80,80]);
    wheel.forEach((a,i)=>expect(a.weight).toBeCloseTo([30,15,25,10,15,5,20,20][i]!/140*100));
    expect(PRINCE_OF_ABOLITION_ENEMY_ABILITY_WHEEL.reduce((n,a)=>n+a.weight,0)).toBe(100);
    expect(Object.keys(x.mastery)).toHaveLength(16);expect(validatePrinceOfAbolitionEncounterCommand({type:'ENCOUNTER_FIGHT',reset:true})).toBe(false);
  });
  it('rejects missing stock, resurrected oldgiven gifts, forged source positions, powers, seeds and unknown source fields',()=>{
    const changes:((x:PrinceOfAbolitionCombatSource)=>void)[]=[
      x=>{x.gifts=[];},x=>{x.gifts[0]={id:'BR7-GIFT-1',location:'PLAYER',destination:null,givenWeek:null};},x=>{x.gifts.push({...x.gifts[14]!,id:'BR7-GIFT-16'});},
      x=>{x.site.playerLocation='OUTSIDE';},x=>{x.site.guide.location='YARD';},x=>{x.body.enemySpirituality++;},x=>{x.body.enemyCharges=[];},x=>{x.randomSeed+='forged';},
      x=>{x.mastery['black-emperor.s0.black-emperor']=500;},x=>{(x as unknown as Record<string,unknown>).freeResurrection=true;},x=>{x.preparation.after.cash++;},x=>{x.preparation.after.mind++;},
    ];for(const mutate of changes){const bad=source();mutate(bad);expect(validPrinceOfAbolitionCombatSource(bad)).toBe(false);}
  });
  it('charges new failed casts8S4M and an actual original support even with no application',()=>{
    const x=source(),r=createPrinceOfAbolitionRuntime(x),a=resolvePrinceOfAbolitionPlayerSlot(x,r,DIRECTED,0,random(100));
    expect([a.paidCost,a.mindCost,a.supportWearPaid,r.playerS,r.playerM]).toEqual([8,4,1,112,94]);expect(a.succeeded).toBe(false);expect(r.body.directed).toBeNull();
    expect(r.body.supportPieces[0]).toMatchObject({id:'PA1-COMBAT-SUPPORT-1',status:'SPENT',wear:1,usedRound:1,usedOrder:0});expect(r.mastery[DIRECTED]).toBe(0);
    const resisted=resolvePrinceOfAbolitionPlayerSlot(x,r,MAINTENANCE,1,random(1,1));expect(resisted.resisted).toBe(true);expect([resisted.paidCost,resisted.mindCost,resisted.resistanceChance,resisted.resistanceRoll]).toEqual([8,4,57,1]);expect(r.body.maintenance).toBeNull();
  });
  it('amplifies only one later pending own BODY action, never the casting slot, a previous result, or guard',()=>{
    const x=source(),r=createPrinceOfAbolitionRuntime(x),earlier=resolvePrinceOfAbolitionPlayerSlot(x,r,'BODY_FOLLOWUP',0,random()),frozen=structuredClone(earlier);
    const cast=resolvePrinceOfAbolitionPlayerSlot(x,r,DIRECTED,1,random(1));expect(cast.selfGain).toBe(0);expect(cast.threatens).toBe(false);expect(r.mastery[DIRECTED]).toBe(0);
    const guard=resolvePrinceOfAbolitionPlayerSlot(x,r,bribery,2,random());expect(guard.windowsApplied).toEqual([]);expect(r.body.directed).not.toBeNull();
    const applied=resolvePrinceOfAbolitionPlayerSlot(x,r,'BODY_FOLLOWUP',3,random());expect(applied.selfGain).toBeCloseTo(applied.rawContribution+35);expect(applied.windowsApplied).toEqual([{kind:'DIRECTED',amount:35,supportId:cast.supportId}]);
    expect(r.body.directed).toBeNull();expect(r.mastery[DIRECTED]).toBe(8);expect(earlier).toEqual(frozen);
    const next=resolvePrinceOfAbolitionPlayerSlot(x,r,'BODY_FOLLOWUP',4,random());expect(next.selfGain).toBe(next.rawContribution);expect(next.windowsApplied).toEqual([]);
  });
  it('maintains only one still-pending BODY/ARC impact for20s, not mental or ward, with full target cost',()=>{
    const x=source(),r=createPrinceOfAbolitionRuntime(x),cast=resolvePrinceOfAbolitionPlayerSlot(x,r,MAINTENANCE,0,random(1,100));
    const mental=resolvePrinceOfAbolitionEnemySlot(x,r,'MENTAL_PRESSURE',1,random());expect([mental.selfGain,mental.attackKind,mental.paidCost]).toEqual([45,'MIND',5]);expect(mental.windowsApplied).toEqual([]);expect(r.body.maintenance).not.toBeNull();
    const ward=resolvePrinceOfAbolitionEnemySlot(x,r,'WARD',2,random());expect(ward.enemyReduction).toBe(30);expect(ward.windowsApplied).toEqual([]);
    const arc=resolvePrinceOfAbolitionEnemySlot(x,r,'ARC_BOLT',3,random());expect([arc.rawContribution,arc.selfGain,arc.paidCost]).toEqual([70,40,5]);expect(arc.windowsApplied).toEqual([{kind:'MAINTENANCE',amount:30,supportId:cast.supportId}]);expect(r.mastery[MAINTENANCE]).toBe(8);expect(r.body.maintenance).toBeNull();
  });
  it('fully absorbed ordinary body action has no remaining physical consequence source',()=>{
    const x=source(),r=createPrinceOfAbolitionRuntime(x);resolvePrinceOfAbolitionPlayerSlot(x,r,MAINTENANCE,0,random(1,100));
    const hit=resolvePrinceOfAbolitionEnemySlot(x,r,'BODY_STRIKE',1,random());expect([hit.rawContribution,hit.selfGain,hit.threatens]).toEqual([20,0,false]);expect(hit.windowsApplied[0]!.amount).toBe(20);
  });
  it('expires at the exact effective deadline, cannot refresh active windows, and refuses depleted support',()=>{
    const x=source(),r=createPrinceOfAbolitionRuntime(x),a=resolvePrinceOfAbolitionPlayerSlot(x,r,DIRECTED,0,random(1)),deadline=a.windowGranted!.expiresAt;
    const repeated=resolvePrinceOfAbolitionPlayerSlot(x,r,DIRECTED,1,random());expect(repeated.paidCost).toBe(0);expect(r.body.directed!.expiresAt).toBe(deadline);
    advancePrinceOfAbolitionCombatClock(r,deadline-r.root.clockSeconds);expect(r.body.directed).toBeNull();expect(r.expiredWindows).toHaveLength(1);
    const action=resolvePrinceOfAbolitionPlayerSlot(x,r,'BODY_FOLLOWUP',2,random());expect(action.selfGain).toBe(action.rawContribution);
    resolvePrinceOfAbolitionPlayerSlot(x,r,DIRECTED,3,random(100));resolvePrinceOfAbolitionPlayerSlot(x,r,MAINTENANCE,4,random(100));const dry=resolvePrinceOfAbolitionPlayerSlot(x,r,DIRECTED,5,random());
    expect(dry.paidCost).toBe(0);expect(dry.fallbackReason).toBe('INSUFFICIENT_RESOURCES');expect(r.body.supportPieces.every(p=>p.status==='SPENT')).toBe(true);
  });
  it('keeps finite target charges and independent composure; never creates a free enemy power',()=>{
    const x=source(),r=createPrinceOfAbolitionRuntime(x);resolvePrinceOfAbolitionPlayerSlot(x,r,MAINTENANCE,0,random(1,100));
    const calm=resolvePrinceOfAbolitionEnemySlot(x,r,'COMPOSE',1,random());expect(calm.paidCost).toBe(4);expect(r.body.maintenance).toBeNull();
    const denied=resolvePrinceOfAbolitionPlayerSlot(x,r,MAINTENANCE,2,random(1,100));expect(denied.resisted).toBe(true);expect(denied.mindCost).toBe(4);
    for(let n=0;n<3;n++){const arc=resolvePrinceOfAbolitionEnemySlot(x,r,'ARC_BOLT',n+3,random());expect(arc.enemyChargeId).toBe(`PA1-EDMUND-CHARGE-${n+1}`);expect(arc.paidCost).toBe(5);}
    const exhausted=resolvePrinceOfAbolitionEnemySlot(x,r,'MENTAL_PRESSURE',6,random());expect([exhausted.attackKind,exhausted.paidCost,exhausted.enemyChargeId,exhausted.fallbackReason]).toEqual(['BODY',0,null,'NO_HELD_CHARGE']);expect(r.body.enemySpirituality).toBe(101);
  });
  it('consumes only original held13/14/15 and never reuses oldgiven12 or changes immutable source history',()=>{
    const x=source(),before=structuredClone(x.originals),r=createPrinceOfAbolitionRuntime(x);
    for(let n=0;n<3;n++){const a=resolvePrinceOfAbolitionPlayerSlot(x,r,bribery,n*2,random());expect(a.giftId).toBe(`BR7-GIFT-${n+13}`);expect(a.paidCost).toBe(3);resolvePrinceOfAbolitionEnemySlot(x,r,'BODY_STRIKE',n*2+1,random());}
    expect(r.gifts.slice(0,12)).toEqual(before.gifts.slice(0,12));expect(r.gifts.slice(12).map(g=>g.destination)).toEqual([PRINCE_OF_ABOLITION_GIFT_GROUND,PRINCE_OF_ABOLITION_GIFT_GROUND,PRINCE_OF_ABOLITION_GIFT_GROUND]);
    const dry=resolvePrinceOfAbolitionPlayerSlot(x,r,bribery,6,random());expect(dry.paidCost).toBe(0);expect(dry.selectedAbility).toBe('black-emperor.s9.weak-point-insight');expect(r.gifts).toHaveLength(15);expect(x.originals).toEqual(before);expect(x.gifts).toEqual(before.gifts);
    const old=readObjectEntry<SliceState>('tests/fixtures/entropy-duke-v01830/natural.json','final');expect(old.briber.gifts).toEqual(before.gifts);expect(old.entropyDuke.encounter).toMatchObject({enemyHealth:60,enemyMind:100,enemySpirituality:85,enemyStatus:'SURRENDERED',weaponLocation:'HAND'});
  });
  it('retains exact inherited6S1M,4S,3S,5S and5S1M costs and existing strategy fallback',()=>{
    const x=source(),r=createPrinceOfAbolitionRuntime(x),amp=resolvePrinceOfAbolitionPlayerSlot(x,r,AMPLIFICATION,0,random(100));expect([amp.paidCost,amp.mindCost,amp.selfGain]).toEqual([6,1,amp.rawContribution]);
    r.playerS=4;r.playerM=0;const magnify=resolvePrinceOfAbolitionPlayerSlot(x,r,AMPLIFICATION,1,random());expect([magnify.selectedAbility,magnify.paidCost]).toEqual(['black-emperor.s4.magnify',4]);
    r.playerS=30;r.playerM=20;resolvePrinceOfAbolitionPlayerSlot(x,r,bribery,2,random());r.playerS=3;const exploit=resolvePrinceOfAbolitionPlayerSlot(x,r,PROLONGATION,3,random());expect([exploit.selectedAbility,exploit.paidCost]).toEqual(['black-emperor.s4.exploit',3]);expect(r.pending[0]!.remaining).toBe(2);
    r.playerS=30;const dev=resolvePrinceOfAbolitionPlayerSlot(x,r,deviation,4,random(1));expect(dev.paidCost).toBe(5);const ext=resolvePrinceOfAbolitionPlayerSlot(x,r,PROLONGATION,5,random(1));expect([ext.paidCost,ext.mindCost]).toEqual([5,1]);
  });
  it('keeps late20s windows across a60s boundary and expires them by actual clock without refunds',()=>{
    const x=source(),r=createPrinceOfAbolitionRuntime(x);advancePrinceOfAbolitionCombatClock(r,55);const a=resolvePrinceOfAbolitionPlayerSlot(x,r,DIRECTED,10,random(1));
    expect(r.root.clockSeconds).toBe(x.site.clockSeconds+60);expect(r.body.directed!.expiresAt).toBe(x.site.clockSeconds+75);expect(a.paidCost).toBe(8);
    advancePrinceOfAbolitionCombatClock(r,14);expect(r.body.directed).not.toBeNull();advancePrinceOfAbolitionCombatClock(r,1);expect(r.body.directed).toBeNull();expect(r.playerS).toBe(112);expect(r.body.supportPieces[0]!.status).toBe('SPENT');
  });
  it('carries a late successful window into the actual next round without another charge or extension',()=>{
    const rolls=[100,100];for(let n=0;n<5;n++)rolls.push(400,40);rolls.push(420,1,40,1000000);scripted(rolls);
    const x=source(),result=replayPrinceOfAbolitionCombatRound(x,'PREPARE'),o=result.round.princeOfAbolitionOutcome!;expect(result.outcome).toBe('CONTINUE');expect(o.directed).toMatchObject({round:1,order:10,castAt:x.site.clockSeconds+50,expiresAt:x.site.clockSeconds+70});
    const next=nextPrinceOfAbolitionCombatSource(o);expect(validPrinceOfAbolitionCombatSource(next)).toBe(true);expect(next.body.supportPieces.filter(p=>p.status==='SPENT')).toHaveLength(1);
    const r=createPrinceOfAbolitionRuntime(next),a=resolvePrinceOfAbolitionPlayerSlot(next,r,'BODY_FOLLOWUP',0,random());expect(a.windowsApplied[0]!.amount).toBe(35);expect(a.paidCost).toBe(0);expect(r.mastery[DIRECTED]).toBe(8);expect(r.body.directed).toBeNull();
  });
  it('replays the real seed and rejects outcome costs, gift history, mastery, elapsed time and target stock tampering',()=>{
    const {round}=replayPrinceOfAbolitionCombatRound(source(),'CONTROL'),o=round.princeOfAbolitionOutcome!;expect(validatePrinceOfAbolitionCombatRound(round)).toBe(true);expect(validatePrinceOfAbolitionRoundOutcome(o)).toBe(true);
    for(const mutate of [(v:PrinceOfAbolitionRoundOutcome)=>{v.enemySpirituality++;},(v:PrinceOfAbolitionRoundOutcome)=>{v.randomCursorAfter++;},(v:PrinceOfAbolitionRoundOutcome)=>{v.masteryAfter[DIRECTED]!++;},(v:PrinceOfAbolitionRoundOutcome)=>{v.giftsAfter[0]!.destination='forged';},(v:PrinceOfAbolitionRoundOutcome)=>{v.siteAfter.clockSeconds++;},(v:PrinceOfAbolitionRoundOutcome)=>{v.supportPieces=[];}]){const bad=structuredClone(o);mutate(bad);expect(validatePrinceOfAbolitionRoundOutcome(bad)).toBe(false);}
    if(o.continuing){const next=nextPrinceOfAbolitionCombatSource(o);expect(next.playerSpirituality).toBe(Math.min(120,o.playerSpiritualityAfter+12));expect(validPrinceOfAbolitionCombatSource(next)).toBe(true);}
  });
  it('uses exact inherited core weighting and separates MIND from BODY injury consequences',()=>{
    scripted([1,1,330,90,1000000]);const mental=replayPrinceOfAbolitionCombatRound(source(),'PREPARE');
    expect(mental.round.consequenceDomain).toBe('MENTAL');expect(mental.round.princeOfAbolitionOutcome!.playerHealthAfter).toBe(100);expect(mental.round.princeOfAbolitionOutcome!.playerMindAfter).toBe(88);expect(mental.round.consequenceWeights).toBeNull();
    expect(mental.round.playerAdvantage).toBeCloseTo(1250+30*.35+24*.15+26*.2+24*.3);vi.restoreAllMocks();
    scripted([1,1,1,1,1,1,100]);const physical=replayPrinceOfAbolitionCombatRound(source(),'ATTACK');expect(physical.outcome).toBe('ENEMY_DEAD');expect(physical.round.consequenceDomain).toBe('BODY');expect(physical.round.princeOfAbolitionOutcome!.weaponLocation).toBe('YARD');
  });
  it('redacts public round source/seed/preparation but preserves all actual outcome facts without mutating replay evidence',()=>{
    const o=replayPrinceOfAbolitionCombatRound(source(),'CONTROL').round.princeOfAbolitionOutcome!,before=JSON.stringify(o),p=projectPrinceOfAbolitionRoundOutcome(o);
    expect(p).not.toHaveProperty('source');expect(p).not.toHaveProperty('randomCursorAfter');expect(JSON.stringify(p)).not.toContain(o.source.randomSeed);
    for(const key of ['randomSeed','preparation','finance','before','after','originals','budget'])expect(JSON.stringify(p)).not.toContain(`"${key}"`);
    const {source:privateSource,randomCursorAfter:privateCursor,...facts}=o;const strip=(a:typeof o.playerActions[number])=>{const {randomCursorBefore:_before,randomCursorAfter:_after,...visible}=a;return visible;};expect(p).toEqual({...facts,playerActions:o.playerActions.map(strip),enemyActions:o.enemyActions.map(strip)});expect(JSON.stringify(p)).not.toContain('randomCursor');expect(privateSource.randomSeed).toBe(source().randomSeed);expect(privateCursor).toBe(o.randomCursorAfter);expect(JSON.stringify(o)).toBe(before);
    const forged=structuredClone(o) as PrinceOfAbolitionRoundOutcome & {privatePreparation:string};forged.privatePreparation='do-not-project';expect(JSON.stringify(projectPrinceOfAbolitionRoundOutcome(forged))).not.toContain('do-not-project');
    p.giftsAfter[0]!.destination='public-only';expect(JSON.stringify(o)).toBe(before);
  });
  it('walks the real4m exit with no random obstacle or teleport and displays current2m then6m separation',()=>{
    const x=source(),old=structuredClone(x.originals),{round,outcome}=replayPrinceOfAbolitionCombatRound(x,'RETREAT'),o=round.princeOfAbolitionOutcome!;
    expect(outcome).toBe('RETREATED');expect(o.elapsedSeconds).toBe(0);expect(o.playerActions).toEqual([]);expect(o.enemyActions).toEqual([]);expect(o.siteAfter.playerLocation).toBe('YARD');
    const site=structuredClone(o.siteAfter);leavePrinceOfAbolitionCombatSite(site);expect(site.playerLocation).toBe('OUTSIDE');expect(site.clockSeconds-o.siteAfter.clockSeconds).toBe(4);expect(site.playerTravelMetres-o.siteAfter.playerTravelMetres).toBe(4);expect(()=>leavePrinceOfAbolitionCombatSite(site)).toThrow();expect(x.originals).toEqual(old);
    const state={progression:{pathwayId:'black-emperor',sequence:1},princeOfAbolition:{encounter:{...createPrinceOfAbolitionEncounterState(),currentSite:site},gifts:structuredClone(x.gifts),life:{site}},combat:null,combatHistory:[]} as unknown as SliceState;
    expect(projectPrinceOfAbolitionCombat(state).enemyDistanceMetres).toBe(6);state.princeOfAbolition.encounter.currentSite=o.siteAfter;expect(projectPrinceOfAbolitionCombat(state).enemyDistanceMetres).toBe(2);
  });
});

let closedCache:SliceState|undefined;
function closed(){if(!closedCache)closedCache=ready(promotedDigested(),{ap:3,cash:30,mind:50,spirituality:100});return structuredClone(closedCache);}
const fight=(s=closed())=>poa(poa(poa(s,{type:'PREPARE_ENCOUNTER'}),{type:'ENCOUNTER_TALK'}),{type:'ENCOUNTER_FIGHT'});
/** UNIT-only source choice happens before the first new journal. It selects a paid
 * promotion and one first-slot gift, never a winner, injury, later result or natural run. */
function firstGiftFight():SliceState {
  let s=directedInitial2(),selected:number|null=null;const start=originalEntropyDuke().random.cursor,chance=computeCheckChance({baseAbility:s.character.coreStats.will,difficulty:30,modifiers:[]});
  for(let cursor=start;cursor<start+2048;cursor++){const rng=new DeterministicActionRandomStream(s.random.seed,cursor),potion=rng.nextInt(1,100);for(let n=0;n<5;n++)rng.nextInt(1,100);const first=rng.nextInt(1,605);if((potion<=5||potion<96&&potion<=chance)&&first>=181&&first<=305){selected=cursor;break;}}
  if(selected===null)throw new Error('No bounded pre-journal UNIT gift source.');s.random.cursor=selected;assertValidSliceState(s);
  s=poa(s,{type:'LEARN_GUIDANCE'});for(const taskId of PRINCE_OF_ABOLITION_PREPARATION_IDS)s=poa(s,{type:'PREPARE_TASK',taskId});s=poa(s,{type:'BUY_POTION',bottleId:dose.bottleId});s=poa(s,{type:'PREPARE_PROMOTION'});s=poa(s,dose);
  for(let n=0;n<256&&!s.princeOfAbolition.life.reflected;n++){const p=projectPrinceOfAbolitionLife(s),action=p.actions.find(a=>a.enabled&&a.command.type==='START_ORDINARY')??p.actions.find(a=>a.enabled&&a.id===p.preferredActionId);if(!action)throw new Error(`Ordinary UNIT life blocked: ${p.nextStep}`);s=poa(s,action.command);}
  expect(s.princeOfAbolition.life.reflected).toBe(true);return fight(s);
}
describe('PrinceOfAbolition public optional encounter continuity',()=>{
  it('charges actual preparation, walks only the player into an independent yard and preserves eight roots including oldOswin',()=>{
    const before=closed(),roots=oldBlackEmperorRoots(before),history=structuredClone(before.combatHistory),prepared=poa(before,{type:'PREPARE_ENCOUNTER'});
    expect([before.cash-prepared.cash,before.mind-prepared.mind,before.actionsRemaining-prepared.actionsRemaining]).toEqual([30,2,0]);expect(prepared.princeOfAbolition.encounter.supportPieces).toHaveLength(3);
    const s=poa(poa(prepared,{type:'ENCOUNTER_TALK'}),{type:'ENCOUNTER_FIGHT'});expect(validatePrinceOfAbolitionEncounter(s)).toBe(true);expect(s.princeOfAbolition.encounter.currentSite).toMatchObject({playerLocation:'YARD',volunteer:{location:'OUTSIDE'},guide:{location:'OUTSIDE'}});
    expect(s.princeOfAbolition.encounter.currentSite!.clockSeconds-before.princeOfAbolition.life.site.clockSeconds).toBe(4);expect(oldBlackEmperorRoots(s)).toEqual(roots);expect(s.combatHistory).toEqual(history);expect(s.princeOfAbolition.gifts).toEqual(before.briber.gifts);assertValidSliceState(s);
  },240_000);
  it('actually spends live rootgift13 in a public combat round while all eight old roots and oldgiven12 remain unchanged',()=>{
    const s=firstGiftFight(),before=oldBlackEmperorRoots(s),oldInventory=structuredClone(s.briber.gifts),next=step(s,{type:'COMBAT_ROUND',stance:'DEFEND'}),o=next.combatHistory.at(-1)!.princeOfAbolitionOutcome!;
    expect(o.playerActions[0]).toMatchObject({id:bribery,giftId:'BR7-GIFT-13',paidCost:3});expect(next.princeOfAbolition.gifts[12]).toMatchObject({id:'BR7-GIFT-13',location:'GIVEN',destination:PRINCE_OF_ABOLITION_GIFT_GROUND,givenWeek:s.week});
    expect(next.princeOfAbolition.gifts).toEqual(o.giftsAfter);expect(next.princeOfAbolition.gifts.slice(0,12)).toEqual(oldInventory.slice(0,12));expect(next.briber.gifts).toEqual(oldInventory);expect(oldBlackEmperorRoots(next)).toEqual(before);assertValidSliceState(next);
    const privateBefore=JSON.stringify(next),projection=projectSliceState(next),expectedPublic=projectPlayerText(projectPrinceOfAbolitionRoundOutcome(o),next.character.name);
    const inspectPublicKeys=(value:unknown,path:(string|number)[]=[]):void=>{
      if(Array.isArray(value)){value.forEach((item,index)=>inspectPublicKeys(item,[...path,index]));return;}
      if(value===null||typeof value!=='object')return;
      for(const [key,item] of Object.entries(value)){
        expect(key,`public key ${[...path,key].join('.')}`).not.toMatch(/seed|cursor|^(?:preparation|sourceHistory|sourceScene)$/i);
        if(key==='source'){
          expect(path.slice(-3,-1)).toEqual(['check','modifiers']);expect(typeof path.at(-1)).toBe('number');expect(typeof item).toBe('string');
        }
        inspectPublicKeys(item,[...path,key]);
      }
    };
    expect(next.combat).not.toBeNull();expect(projection.combat?.lastRound).not.toBeNull();
    for(const publicOutcome of [projection.combat?.lastRound?.princeOfAbolitionOutcome,projection.lastCombatRound?.princeOfAbolitionOutcome,projection.combatHistory.at(-1)?.princeOfAbolitionOutcome]){
      expect(publicOutcome).toEqual(expectedPublic);expect(publicOutcome).not.toHaveProperty('source');
      inspectPublicKeys(publicOutcome);expect(JSON.stringify(publicOutcome)).not.toContain(next.random.seed);
    }
    expect(JSON.stringify(next)).toBe(privateBefore);
  },240_000);
  it('projects only public preparation and current physical/resource summaries, never seed or finance snapshots',()=>{
    const s=fight(),snapshot=structuredClone(s),p=projectPrinceOfAbolitionEncounter(s),combat=projectPrinceOfAbolitionCombat(s);
    expect(p.preparation).toEqual({week:s.week,pricePaid:30,mindPaid:2,actionsPaid:0});expect(p.scene).toMatchObject({playerLocation:'YARD',distanceMetres:2,exitMetres:4,darianLocation:'OUTSIDE',guideLocation:'OUTSIDE'});expect(p.giftsHeld).toBe(3);
    const text=JSON.stringify({p,combat});for(const key of ['randomSeed','randomCursor','originals','sourceScene','sourceHistory','before','after','finance','weeklyBudget'])expect(text).not.toContain(`"${key}"`);expect(text).not.toContain(s.random.seed);expect(s).toEqual(snapshot);
  },240_000);
  it('permits peaceful exit with consumed preparation retained, prevents resetting either opponent, and keeps terminal current positions',()=>{
    const before=closed(),roots=oldBlackEmperorRoots(before),talk=poa(poa(before,{type:'PREPARE_ENCOUNTER'}),{type:'ENCOUNTER_TALK'}),left=poa(talk,{type:'LEAVE_ENCOUNTER'});
    expect(left.princeOfAbolition.encounter.currentSite!.playerLocation).toBe('OUTSIDE');expect(left.princeOfAbolition.encounter.currentSite!.clockSeconds-before.princeOfAbolition.life.site.clockSeconds).toBe(8);expect(left.cash).toBe(before.cash-30);expect(left.mind).toBe(before.mind-2);expect(oldBlackEmperorRoots(left)).toEqual(roots);rejectPrinceOfAbolition(left,{type:'PREPARE_ENCOUNTER'});assertValidSliceState(left);
    const battling=fight(before),ended=step(battling,{type:'COMBAT_ROUND',stance:'RETREAT'});expect(ended.princeOfAbolition.encounter.status).toBe('RETREATED');expect(ended.princeOfAbolition.encounter.terminal).toMatchObject({exitMetres:4,exitSeconds:4});expect(ended.princeOfAbolition.encounter.currentSite!.playerLocation).toBe('OUTSIDE');expect(projectPrinceOfAbolitionCombat(ended).enemyDistanceMetres).toBe(6);expect(oldBlackEmperorRoots(ended)).toEqual(roots);assertValidSliceState(ended);
  },240_000);
});

/** Exact zero-AP reconciliation declares only an isolated kernel budget; actual
 * shared finance code produces the receipts and interruption, with no free refill. */
function terminalFinance(cash:number,finance:Partial<PrinceOfAbolitionPreparation['finance']>={}){
  const x=source();x.preparation.before.actions=x.preparation.after.actions=2;x.budget.actions=0;x.preparation.before.cash=cash+30;x.preparation.after.cash=x.budget.cash=cash;Object.assign(x.preparation.finance,finance);x.finance=structuredClone(x.preparation.finance);
  const o=replayPrinceOfAbolitionCombatRound(x,'RETREAT').round.princeOfAbolitionOutcome!,expected={...structuredClone(x.budget),health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality:o.playerSpiritualityAfter,gifts:structuredClone(o.giftsAfter),mastery:{...o.masteryAfter},injuries:structuredClone(o.playerInjuriesAfter),injuryRisk:o.playerRiskAfter};
  const s={runId:x.runId,revision:x.revision+1,week:x.week,date:{...x.date},status:'ACTIVE',cash,actionsRemaining:0,health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality:o.playerSpiritualityAfter,injuries:structuredClone(o.playerInjuriesAfter),injuryRisk:o.playerRiskAfter,
    character:{gender:expected.gender,coreStats:{...expected.coreStats}},progression:{sequence:1,acting:expected.acting,mastery:{...o.masteryAfter}},princeOfAbolition:{gifts:structuredClone(o.giftsAfter)},seer:{pollution:expected.pollution,completedSources:[...expected.completedSources]},random:{cursor:o.randomCursorAfter},...structuredClone(x.finance),pulse:'NONE',billAmount:0,activeEvent:null,eventQueue:[],chronicle:[]} as unknown as SliceState;
  const title='埃德蒙的独立院落冲突结束';s.chronicle.push({id:`record-${s.revision}-0`,week:x.week,title,text:'实际沿4米普通路离场。'});
  const billing=resolveSliceWeeklyFinance({...x.finance,cash,week:x.week,revision:x.revision,pulse:'BILL',billAmount:0});Object.assign(s,billing.state);s.revision=x.revision+1;
  for(const receipt of billing.receipts)s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week:x.week,...receipt});
  if(billing.eventId)s.activeEvent={id:billing.eventId,instanceId:`${s.runId}:${billing.eventId}:${s.revision}:${s.chronicle.length}`};
  else {s.week++;s.date=addGameWeeks(x.date,1);s.actionsRemaining=x.finance.weeklyBudget;s.lifeTier=s.nextLifeTier;s.pulse='NONE';s.billAmount=0;s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week:s.week,title:'新的一周',text:`日期推进7天，本周${x.finance.weeklyBudget}次行动。`});}
  const valid=(state:SliceState)=>princeOfAbolitionCompletedBudgetMatches(state,expected,x.finance,x.week,x.date,x.revision+1,o.randomCursorAfter,title);return{s,valid};
}
describe('PrinceOfAbolition exact terminal weekly finance',()=>{
  it('reconciles paid bills, interrupted bills, old debt and suspension with no resource exemptions',()=>{
    const debt={id:'old-debt',source:'约定账目',remaining:100,weeklyPayment:30,createdWeek:1};
    for(const [cash,finance] of [[1000,{}],[0,{}],[30,{debts:[debt],missedWeeks:1}],[30,{debts:[debt],missedWeeks:3}],[0,{credit:'SUSPENDED',missedWeeks:4}]] as [number,Partial<PrinceOfAbolitionPreparation['finance']>][]){const {s,valid}=terminalFinance(cash,finance);expect(valid(s)).toBe(true);for(const mutate of [(v:SliceState)=>{v.cash++;},(v:SliceState)=>{v.spirituality++;},(v:SliceState)=>{v.mind++;},(v:SliceState)=>{v.actionsRemaining++;},(v:SliceState)=>{v.random.cursor++;},(v:SliceState)=>{v.princeOfAbolition.gifts[0]!.destination='forged';}]){const bad=structuredClone(s);mutate(bad);expect(valid(bad)).toBe(false);}}
  });
});
