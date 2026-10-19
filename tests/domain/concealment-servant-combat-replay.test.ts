import { beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { baseAdvantage, consequenceWeights } from '../../src/domain/slice/combat.js';
import { resolveConcealmentServantCombatRound } from '../../src/domain/slice/concealment-servant-combat.js';
import type { SliceState, SliceStance, SliceCombatRound } from '../../src/domain/slice/types.js';
import { validateConcealmentServantRoundOutcome, validateConcealmentServantCombatRound, projectConcealmentServantCombat,
  type ConcealmentServantRoundOutcome } from '../../src/domain/concealment-servant/combat.js';
import { validateConcealmentServantEncounter } from '../../src/domain/concealment-servant/encounter.js';
import { concealmentServantSnapshot, concealmentServantBoundary, darknessLegacyKeys } from './concealment-servant-test-fixture.js';
let original: SliceState, naturalFinal: SliceState, naturalRounds: SliceCombatRound[];
beforeAll(() => {
  original=concealmentServantSnapshot('combatStart'); naturalFinal=concealmentServantBoundary('combat-terminal').final;
  naturalRounds=naturalFinal.combatHistory.slice(original.combatHistory.length);
});
const outcome=(r:SliceCombatRound)=>r.concealmentServantOutcome!;
const sum=(xs:{selfGain:number;enemyReduction:number}[],key:'selfGain'|'enemyReduction')=>xs.reduce((n,a)=>n+a[key],0);
const empty={concealment:null,veil:null,anchorReady:false,anchorUsed:false};
/** Explicit directed UNIT branch: only a copied first-round input cursor changes.
 * Probe the real adapter on independently owned mutable combat fields to bound
 * allocation, then obtain and validate the actual result via the PUBLIC command.
 * No saved fixture, RNG method, recorded outcome or natural history is changed. */
function directed(wanted:(r:SliceCombatRound,result:string)=>boolean,stance:SliceStance='CONTROL'):{before:SliceState;after:SliceState;round:SliceCombatRound}{
  for(let offset=0;offset<20000;offset++){
    const probe:SliceState={...original,random:{...original.random,cursor:original.random.cursor+offset},
      concealmentServant:{...original.concealmentServant,encounter:structuredClone(original.concealmentServant.encounter)},
      combat:structuredClone(original.combat),injuries:structuredClone(original.injuries),
      spiritWarlock:{...original.spiritWarlock,companion:structuredClone(original.spiritWarlock.companion)}};
    const result=resolveConcealmentServantCombatRound(probe,stance);
    if(!wanted(result.round,result.outcome))continue;
    const before=structuredClone(original);before.random.cursor+=offset;assertValidSliceState(before);
    const frozen=structuredClone(before),after=applySliceIntent(before,{type:'COMBAT_ROUND',stance});
    expect(before).toEqual(frozen);assertValidSliceState(after);
    const round=after.combatHistory.at(-1)!;expect(round).toEqual(result.round);
    expect(validateConcealmentServantRoundOutcome(outcome(round))).toBe(true);expect(validateConcealmentServantCombatRound(round)).toBe(true);
    expect(validateConcealmentServantEncounter(after)).toBe(true);return{before,after,round};
  }
  throw new Error('No deterministic directed unit branch found; natural fixture remains untouched');
}
function assertAccounting(before:SliceState,after:SliceState,r:SliceCombatRound):void{
  const o=outcome(r),x=o.source,ordered=[...o.playerActions,...o.enemyActions].sort((a,b)=>a.order-b.order);
  expect(o.playerSpiritualityAfter).toBe(x.playerSpirituality-o.playerActions.reduce((n,a)=>n+a.paidCost,0));
  expect(o.enemySpirituality).toBe(x.enemySpirituality-o.enemyActions.reduce((n,a)=>n+a.paidCost,0));
  expect(after.spirituality).toBe(o.continuing?Math.min(120,o.playerSpiritualityAfter+12):o.playerSpiritualityAfter);
  expect(after.concealmentServant.encounter.enemySpirituality).toBe(o.enemySpirituality);
  let playerS=x.playerSpirituality,enemyS=x.enemySpirituality;
  for(const [i,a] of ordered.entries()){
    expect(a.order).toBe(i);expect(a.atSeconds).toBe(i*5);
    if('id' in a)playerS-=a.paidCost;else enemyS-=a.paidCost;
    expect(a.playerSpiritualityAfter).toBe(playerS);expect(a.enemySpiritualityAfter).toBe(enemyS);
    expect(a.randomCursorAfter-a.randomCursorBefore).toBe(a.rolls.length);
    expect(a.label).toContain(`本人S${playerS}/120`);expect(a.label).toContain(`原敌S${enemyS}/120`);
  }
  for(const [key,id] of [['BOUNDED_CONCEALMENT','darkness.s2.bounded-concealment'],['TRACE_VEIL','darkness.s2.trace-veil']] as const){
    const actions=o.playerActions.filter(a=>a.id===id);
    expect(o.abilityUses[key].attempts).toBe(x.abilityUses[key].attempts+actions.filter(a=>a.attempted).length);
    expect(o.abilityUses[key].successes).toBe(x.abilityUses[key].successes+actions.filter(a=>a.succeeded).length);
    expect(o.abilityUses[key].effects).toBe(x.abilityUses[key].effects+o.enemyActions.filter(a=>a.applied.includes(key)).length);
  }
  for(const id of ['DARK_BOLT','WARD','ANCHOR_LIGHT'] as const)expect(o.powerUses[id]).toBe(x.powerUses[id]+o.enemyActions.filter(a=>a.actual===id).length);
  const core=x.physique*.35+x.perception*.25+x.will*.25+x.knowledge*.15;
  expect(r.playerAdvantage).toBe(Math.max(125,baseAdvantage(core,x.playerHealth,x.playerMind,x.playerSpirituality,1250,120)+sum(o.playerActions,'selfGain')-sum(o.enemyActions,'enemyReduction')));
  expect(r.enemyAdvantage).toBe(Math.max(125,baseAdvantage(24,x.enemyHealth,x.enemyMind,x.enemySpirituality,1250,120)+sum(o.enemyActions,'selfGain')-sum(o.playerActions,'enemyReduction')));
  expect(r.winChance).toBe(r.playerAdvantage/(r.playerAdvantage+r.enemyAdvantage)*100);
  if(r.consequenceWeights)expect(r.consequenceWeights).toEqual(consequenceWeights(r.winner==='PLAYER'?o.enemyRiskAfter:o.playerRiskAfter));
  expect(o.windowsAfter).toEqual(empty);expect(after.random.seed).toBe(before.random.seed);expect(after.random.cursor).toBe(o.randomCursorAfter);
  expect(after.combatHistory.slice(0,-1)).toEqual(before.combatHistory);expect(after.progression.mastery).toEqual(before.progression.mastery);
  for(const key of darknessLegacyKeys)expect(after[key]).toEqual(before[key]);
  const deployments=o.playerActions.filter(a=>a.spiritOperation==='DEPLOY').length;
  expect(after.spiritWarlock).toEqual({...before.spiritWarlock,companion:{...before.spiritWarlock.companion,
    deployments:before.spiritWarlock.companion.deployments+deployments,recalls:before.spiritWarlock.companion.recalls+(o.recalled?1:0)}});
  expect(o.playerTravelMetresAfter).toBe(o.source.playerTravelMetres+(!o.continuing&&o.playerHealthAfter>0?2:0));
  expect(o.elapsedSeconds).toBe(!o.continuing&&o.playerHealthAfter>0?62:60);
}

describe('Concealment Servant authentic public combat replay and strict historical evidence',()=>{
  it('replays all eight actual natural rounds with unchanged seed/cursor and exact final death',()=>{
    expect(naturalRounds).toHaveLength(8);let s=original;
    for(const expected of naturalRounds){const before=s;s=applySliceIntent(s,{type:'COMBAT_ROUND',stance:expected.stance});
      expect(s.combatHistory.at(-1)).toEqual(expected);expect(validateConcealmentServantRoundOutcome(outcome(expected))).toBe(true);
      expect(validateConcealmentServantCombatRound(expected)).toBe(true);assertValidSliceState(s);assertAccounting(before,s,expected);
    }
    expect(s).toEqual(naturalFinal);expect(s).toMatchObject({status:'DEAD',health:0,mind:100,spirituality:115,random:{seed:'sleepless-natural-v020',cursor:432}});
    expect(s.concealmentServant.encounter).toMatchObject({status:'LOST',enemyHealth:90,enemyMind:100,enemySpirituality:8,enemyStatus:'RESISTING',weaponLocation:'HAND',
      playerLocation:'DOORSTEP',playerTravelMetres:2,clockSeconds:482,powerUses:{DARK_BOLT:8,WARD:8,ANCHOR_LIGHT:2},
      abilityUses:{BOUNDED_CONCEALMENT:{attempts:4,successes:4,effects:1},TRACE_VEIL:{attempts:3,successes:3,effects:0}}});
  });
  it('preserves the actual anchor-before-opening resistance and later real35G application',()=>{
    const resisted=outcome(naturalRounds[2]!),applied=outcome(naturalRounds[3]!);
    expect(resisted.enemyActions[0]).toMatchObject({actual:'ANCHOR_LIGHT',order:1,paidCost:4,anchorGranted:true});
    expect(resisted.playerActions[1]).toMatchObject({id:'darkness.s2.bounded-concealment',order:2,paidCost:6,succeeded:true,resisted:true});
    expect(resisted.enemyActions.find(a=>a.planned==='ANCHOR_LIGHT'&&a.order===7)).toMatchObject({actual:'BODY_STRIKE',paidCost:0,anchorGranted:false});
    const bolt=applied.enemyActions.find(a=>a.applied.includes('BOUNDED_CONCEALMENT'))!;
    expect(bolt).toMatchObject({actual:'DARK_BOLT',order:5,paidCost:7,selfGain:70,threatens:true});
    expect(applied.playerActions.find(a=>a.id==='darkness.s2.bounded-concealment')).toMatchObject({order:3,succeeded:true,resisted:false});
    expect(applied.playerHealthAfter).toBe(70);expect(applied.playerInjuriesAfter.at(-1)?.severity).toBe('HEAVY');
  });
  it('reports zero active windows and the actual sorted last-slot sequence at every saved boundary',()=>{
    const b=concealmentServantBoundary('combat-first'),p=projectConcealmentServantCombat(b.final),o=outcome(b.final.combatHistory.at(-1)!);
    expect(p.windows).toEqual(empty);expect(p.concealmentRemainingSeconds).toBe(0);expect(p.veilRemainingSeconds).toBe(0);
    expect(p.lastWindowSequence.map(a=>a.order)).toEqual([...o.playerActions,...o.enemyActions].map(a=>a.order).sort((a,b)=>a-b));
    expect(p.playerSpirituality).toBe(b.final.spirituality);expect(p.enemySpirituality).toBe(o.enemySpirituality);expect(p.abilityUses).toEqual(o.abilityUses);
  });
  it.each([
    ['target',(o:ConcealmentServantRoundOutcome)=>{o.targetId='NW4-BRAM' as never;}],
    ['source-body',(o:ConcealmentServantRoundOutcome)=>{o.source.actualOriginalBody=false as never;}],
    ['source-door',(o:ConcealmentServantRoundOutcome)=>{o.source.doorStatus='BLOCKED' as never;}],
    ['source-seed',(o:ConcealmentServantRoundOutcome)=>{o.source.randomSeed+='-forged';}],
    ['source-cursor',(o:ConcealmentServantRoundOutcome)=>{o.source.randomCursor++;}],
    ['source-spirit',(o:ConcealmentServantRoundOutcome)=>{o.source.companion.source='NEW-LEAF' as never;}],
    ['target-core',(o:ConcealmentServantRoundOutcome)=>{o.source.targetCore=25 as never;}],
    ['cost',(o:ConcealmentServantRoundOutcome)=>{o.playerActions[1]!.paidCost=0;}],
    ['cost-and-final-S',(o:ConcealmentServantRoundOutcome)=>{o.playerActions[1]!.paidCost=0;o.playerSpiritualityAfter+=6;}],
    ['check-roll',(o:ConcealmentServantRoundOutcome)=>{o.playerActions[1]!.rolls[0]=100;}],
    ['order',(o:ConcealmentServantRoundOutcome)=>{o.playerActions[1]!.order=0;}],
    ['slot-time',(o:ConcealmentServantRoundOutcome)=>{o.playerActions[1]!.atSeconds++;}],
    ['slot-cursor',(o:ConcealmentServantRoundOutcome)=>{o.playerActions[1]!.randomCursorAfter++;}],
    ['window-expiry',(o:ConcealmentServantRoundOutcome)=>{o.playerActions[1]!.windowsAfter.concealment!.expiresAt++;}],
    ['window-open-order',(o:ConcealmentServantRoundOutcome)=>{o.playerActions[1]!.windowsAfter.concealment!.openedOrder++;}],
    ['invented-resistance',(o:ConcealmentServantRoundOutcome)=>{o.playerActions[1]!.resisted=true;}],
    ['bolt-price',(o:ConcealmentServantRoundOutcome)=>{o.enemyActions.find(a=>a.applied.length)!.paidCost=0;}],
    ['bolt-threat',(o:ConcealmentServantRoundOutcome)=>{o.enemyActions.find(a=>a.applied.length)!.threatens=false;}],
    ['retroactive-anchor',(o:ConcealmentServantRoundOutcome)=>{o.enemyActions.find(a=>a.applied.length)!.selfGain=105;}],
    ['unearned-application',(o:ConcealmentServantRoundOutcome)=>{o.abilityUses.TRACE_VEIL.effects++;}],
    ['forgotten-application',(o:ConcealmentServantRoundOutcome)=>{o.abilityUses.BOUNDED_CONCEALMENT.effects--;}],
    ['enemy-pool',(o:ConcealmentServantRoundOutcome)=>{o.enemySpirituality++;}],
    ['enemy-power-count',(o:ConcealmentServantRoundOutcome)=>{o.powerUses.DARK_BOLT++;}],
    ['health',(o:ConcealmentServantRoundOutcome)=>{o.playerHealthAfter++;}],
    ['injury',(o:ConcealmentServantRoundOutcome)=>{o.playerInjuriesAfter=[];}],
    ['risk',(o:ConcealmentServantRoundOutcome)=>{o.playerRiskAfter++;}],
    ['free-refill',(o:ConcealmentServantRoundOutcome)=>{o.playerSpiritualityAfter=120;}],
    ['early-exit',(o:ConcealmentServantRoundOutcome)=>{o.playerLocationAfter='OUTSIDE';}],
    ['teleport',(o:ConcealmentServantRoundOutcome)=>{o.playerTravelMetresAfter+=2;}],
    ['clock',(o:ConcealmentServantRoundOutcome)=>{o.clockSecondsAfter++;}],
    ['final-cursor',(o:ConcealmentServantRoundOutcome)=>{o.randomCursorAfter++;}],
    ['undeclared-field',(o:ConcealmentServantRoundOutcome)=>{Object.assign(o,{freeConcealment:true});}],
  ] as const)('rejects %s tampering in an actual natural outcome',(label,mutate)=>{
    const round=structuredClone(naturalRounds[3]!),o=outcome(round);expect(validateConcealmentServantRoundOutcome(o)).toBe(true);mutate(o);
    expect(validateConcealmentServantRoundOutcome(o),label).toBe(false);expect(validateConcealmentServantCombatRound(round),label).toBe(false);
  });
  it.each(['winner','count','count-roll','chance','advantage','threat-wheel','moves'] as const)('rejects forged public round %s even with a genuine nested outcome',field=>{
    const r=structuredClone(naturalRounds[3]!);
    if(field==='winner')r.winner='PLAYER';if(field==='count')r.playerCount++;if(field==='count-roll')r.playerCountRoll++;
    if(field==='chance')r.winChance++;if(field==='advantage')r.enemyAdvantage++;if(field==='threat-wheel')r.consequenceWeights={light:100,heavy:0,death:0};
    if(field==='moves')r.moves[0]!.selfGain++;
    expect(validateConcealmentServantRoundOutcome(outcome(r))).toBe(true);expect(validateConcealmentServantCombatRound(r)).toBe(false);
  });
  it('binds original Leaf deployment/recall, and refuses a copied historical round after terminal',()=>{
    const r=structuredClone(naturalRounds[1]!);expect(outcome(r).recalled).toBe(true);outcome(r).companionAfter.recalls--;
    expect(validateConcealmentServantCombatRound(r)).toBe(false);
    const s=structuredClone(naturalFinal);s.combatHistory.push(structuredClone(naturalRounds[0]!));expect(validateConcealmentServantEncounter(s)).toBe(false);expect(()=>assertValidSliceState(s)).toThrow();
  });
  it.each(['playerTravelMetres','clockSeconds','enemySpirituality'] as const)('rejects terminal %s edits without rewriting earlier histories',field=>{
    const s=structuredClone(naturalFinal);s.concealmentServant.encounter[field]++;expect(validateConcealmentServantEncounter(s)).toBe(false);expect(()=>assertValidSliceState(s)).toThrow();
  });
});

describe('Concealment Servant explicitly directed unit-only public branches',()=>{
  it('a real veil application is paid and does not change older random outcomes',()=>{
    const b=directed(r=>outcome(r).enemyActions.some(a=>a.applied.includes('TRACE_VEIL')));assertAccounting(b.before,b.after,b.round);
    const o=outcome(b.round),bolt=o.enemyActions.find(a=>a.applied.includes('TRACE_VEIL'))!;
    expect(bolt.selfGain).toBe(105-20-(bolt.applied.includes('BOUNDED_CONCEALMENT')?35:0));expect(o.abilityUses.TRACE_VEIL.effects).toBeGreaterThan(0);
  });
  it('a later anchor cannot rewrite an earlier real application',()=>{
    const b=directed(r=>{const e=outcome(r).enemyActions;return e.some(a=>a.applied.length>0&&e.some(later=>later.actual==='ANCHOR_LIGHT'&&later.order>a.order));});
    assertAccounting(b.before,b.after,b.round);const o=outcome(b.round),applied=o.enemyActions.find(a=>a.applied.length>0)!;
    expect(applied.selfGain).toBe(105-(applied.applied.includes('BOUNDED_CONCEALMENT')?35:0)-(applied.applied.includes('TRACE_VEIL')?20:0));
  });
  it.each(['RETREATED','ENEMY_SURRENDERED','ENEMY_DEAD','PLAYER_DEAD'] as const)('reaches authentic deterministic %s consequences without free terminal restoration',wanted=>{
    const b=directed((_r,result)=>result===wanted,wanted==='RETREATED'?'RETREAT':'ATTACK');assertAccounting(b.before,b.after,b.round);
    const o=outcome(b.round);expect(b.after.concealmentServant.encounter.terminal?.outcome).toBe(wanted);expect(b.after.combat).toBeNull();expect(o.continuing).toBe(false);
    expect(b.after.spirituality).toBe(o.playerSpiritualityAfter);
    if(wanted==='PLAYER_DEAD'){expect(b.after.status).toBe('DEAD');expect(o.playerHealthAfter).toBe(0);expect(o.playerLocationAfter).toBe('DOORSTEP');expect(o.elapsedSeconds).toBe(60);}
    else{expect(o.playerHealthAfter).toBeGreaterThan(0);expect(o.playerLocationAfter).toBe('OUTSIDE');expect(o.playerTravelMetresAfter).toBe(4);expect(o.elapsedSeconds).toBe(62);}
    if(wanted==='RETREATED'){expect(b.round.retreat).toBe('SUCCESS');expect(b.round.winner).toBe('ENEMY');expect(o.enemyStatus).toBe('RESISTING');expect(b.after.concealmentServant.encounter.weaponLocation).toBe('HAND');}
    if(wanted==='ENEMY_SURRENDERED'){expect(o.enemyHealth).toBe(70);expect(o.enemyStatus).toBe('SURRENDERED');expect(b.after.concealmentServant.encounter.weaponLocation).toBe('YARD');}
    if(wanted==='ENEMY_DEAD')expect(o.enemyHealth).toBe(0);
  });
  it('a failed ordinary retreat consumes its true roll and enemy slots instead of forcing an exit',()=>{
    const b=directed((r,result)=>r.retreat==='FAILURE'&&result==='CONTINUE','RETREAT');assertAccounting(b.before,b.after,b.round);
    expect(outcome(b.round).playerActions).toEqual([]);expect(outcome(b.round).enemyActions.length).toBeGreaterThan(0);
    expect(b.after.concealmentServant.encounter).toMatchObject({status:'FIGHTING',playerLocation:'DOORSTEP',playerTravelMetres:2});
  });
});
