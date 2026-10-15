import { beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  createConcealmentServantEncounterState, blockConcealmentServantEncounter, projectConcealmentServantEncounter,
  validateConcealmentServantEncounterCommand, validateConcealmentServantEncounter, hasConcealmentServantDisputeOpponent,
  hasConcealmentServantEncounterLock, settleConcealmentServantEncounter,
} from '../../src/domain/concealment-servant/encounter.js';
import { currentConcealmentServantCombatSource } from '../../src/domain/concealment-servant/combat.js';
import { FEAR_BISHOP_COUNT_WHEEL, FEAR_BISHOP_ENEMY_COUNT_WHEEL, FEAR_BISHOP_ENEMY_ABILITY_WHEEL } from '../../src/domain/fear-bishop/combat.js';
import { concealmentServantSnapshot, concealmentServantBoundary, cs, rejectCs, fearBishopFixturePath } from './concealment-servant-test-fixture.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
const noContext:SeerContext={note:()=>{},roll:()=>{throw new Error('Unexpected scene random draw');},check:()=>{throw new Error('Unexpected scene check');}};
let approach:SliceState,ready:SliceState,fighting:SliceState;
beforeAll(()=>{approach=concealmentServantBoundary('original-enemy-approach').beforeLast;ready=concealmentServantBoundary('original-enemy-fight').beforeLast;fighting=concealmentServantSnapshot('combatStart');});

describe('Concealment Servant one original Oswin, explicit choice and ordinary exit',()=>{
  it('introduces only the actual47-year-old originalG2 opponent and his own one club',()=>{
    const initial=createConcealmentServantEncounterState();expect(approach.concealmentServant.encounter).toEqual(initial);
    expect(initial).toMatchObject({targetId:'CS2-OSWIN',status:'AVAILABLE',enemyHealth:100,enemyMind:100,enemySpirituality:120,enemyStatus:'RESISTING',weaponLocation:'HAND',
      powerUses:{DARK_BOLT:0,WARD:0,ANCHOR_LIGHT:0},room:{id:'CS2-OSWIN-ROOM',widthMetres:6,doorId:'CS2-OSWIN-DOOR',doorStatus:'OPEN'},playerLocation:'OUTSIDE',playerTravelMetres:0,clockSeconds:0});
    expect(projectConcealmentServantEncounter(approach).enemy).toMatchObject({id:'CS2-OSWIN',name:'奥斯温',age:47,sequence:2,weaponId:'CS2-OSWIN-CLUB',health:100,mind:100,spirituality:120});
    expect(approach.soother.encounter).toEqual(fighting.soother.encounter);expect(approach.nightwatcher.encounter).toEqual(fighting.nightwatcher.encounter);
    expect(approach.nightwatcher.encounter.enemy).toMatchObject({id:'NW4-BRAM',health:0,status:'DEAD',weaponLocation:'YARD'});
    expect(approach.fearBishop.encounter).toEqual(fighting.fearBishop.encounter);expect(approach.spiritWarlock).toEqual(fighting.spiritWarlock);
  });
  it('replays actual approach and separately chosen fight with1AP each and no automatic spirit deployment',()=>{
    const a=concealmentServantBoundary('original-enemy-approach'),f=concealmentServantBoundary('original-enemy-fight');
    const talked=applySliceIntent(a.beforeLast,a.lastIntent);expect(talked).toEqual(a.final);expect(talked).toEqual(f.beforeLast);
    expect(talked.actionsRemaining).toBe(a.beforeLast.actionsRemaining-1);expect(talked.combat).toBeNull();expect(hasConcealmentServantEncounterLock(talked)).toBe(true);
    expect(talked.concealmentServant.encounter).toMatchObject({status:'READY',playerLocation:'DOORSTEP',playerTravelMetres:2,clockSeconds:2});
    const next=applySliceIntent(talked,f.lastIntent);expect(next).toEqual(f.final);expect(next).toEqual(fighting);expect(next.actionsRemaining).toBe(talked.actionsRemaining-1);
    expect(next.random).toEqual(a.beforeLast.random);expect(next.spiritWarlock.companion).toEqual(a.beforeLast.spiritWarlock.companion);
    expect(hasConcealmentServantDisputeOpponent(next)).toBe(true);expect(validateConcealmentServantEncounter(next)).toBe(true);
  });
  it('does not permit skipped talk or an approach without leaving the explicit fight action available',()=>{
    rejectCs(approach,{type:'ENCOUNTER_FIGHT'});rejectCs(approach,{type:'LEAVE_ENCOUNTER'});
    const s=structuredClone(approach);s.actionsRemaining=1;
    expect(blockConcealmentServantEncounter(s,{type:'ENCOUNTER_TALK'})).toContain('另留');rejectCs(s,{type:'ENCOUNTER_TALK'});
  });
  it('peacefully exits at zeroAP for2metres/2seconds, then pays the genuine ordinary week-end bill',()=>{
    const s=structuredClone(ready);s.actionsRemaining=0;const before=structuredClone(s),after=cs(s,{type:'LEAVE_ENCOUNTER'});
    expect(after.concealmentServant.encounter).toMatchObject({status:'RESOLVED',terminal:null,startHistoryIndex:null,playerLocation:'OUTSIDE',playerTravelMetres:4,clockSeconds:4,
      enemyHealth:100,enemyMind:100,enemySpirituality:120,enemyStatus:'RESISTING',weaponLocation:'HAND'});
    for(const key of ['health','mind','spirituality','injuryRisk','injuries','progression','town','random','combatHistory','spiritWarlock','fearBishop','nightwatcher'] as const)expect(after[key]).toEqual(before[key]);
    expect(after.week).toBe(before.week+1); expect(after.cash).toBe(before.cash-30); expect(after.actionsRemaining).toBe(3);
    expect(hasConcealmentServantEncounterLock(after)).toBe(false);expect(after.combat).toBeNull();rejectCs(after,{type:'ENCOUNTER_TALK'});rejectCs(after,{type:'ENCOUNTER_FIGHT'});
  });
  it('a zero-mind player may still choose the already-open peaceful ordinary exit',()=>{
    const s=structuredClone(ready);s.mind=0;s.actionsRemaining=0;
    expect(blockConcealmentServantEncounter(s,{type:'LEAVE_ENCOUNTER'})).toBeNull();const next=cs(s,{type:'LEAVE_ENCOUNTER'});
    expect(next.mind).toBe(0);expect(next.concealmentServant.encounter.playerLocation).toBe('OUTSIDE');
  });
  it('hides Oswin and all new encounter facts before the actualS2 promotion',()=>{
    const s=concealmentServantSnapshot('guidanceStart'),p=projectConcealmentServantEncounter(s);
    expect(s.progression.sequence).toBe(3);expect(p.enemy).toBeNull();expect(p.room).toBeNull();expect(p.actions).toEqual([]);expect(p.facts).toEqual([]);expect(p.story).toBe('');
    expect(JSON.stringify(p)).not.toMatch(/CS2-OSWIN|奥斯温|CS2-OSWIN-CLUB/);expect(currentConcealmentServantCombatSource(s)).toBeNull();
  });
  it.each([null,[],{}, {type:'ENCOUNTER_FIGHT',targetId:'NW4-BRAM'},{type:'LEAVE_ENCOUNTER',teleport:true},{type:'ENCOUNTER_TALK',extra:null},{type:'REFILL_ENEMY'}])('rejects malformed command %j',command=>{
    expect(validateConcealmentServantEncounterCommand(command)).toBe(false);rejectCs(approach,command);
  });
  it.each(['door','location','dead','foreign-stage','old-life','current-life','old-spirit','old-fight'] as const)('blocks an isolated %s source mismatch before encounter costs',kind=>{
    const s=structuredClone(ready);
    if(kind==='door')s.concealmentServant.encounter.room.doorStatus='BLOCKED' as never;
    if(kind==='location')s.world.city='ELSEWHERE';if(kind==='dead'){s.status='DEAD';s.health=0;}
    if(kind==='foreign-stage')s.progression.sequence=3;if(kind==='old-life')s.fearBishop.preparedWeek=s.week;
    if(kind==='current-life')s.concealmentServant.preparedWeek=s.week;
    if(kind==='old-spirit'){s.spiritWarlock.companion.status='DEPLOYED';s.spiritWarlock.companion.deployments++;}
    if(kind==='old-fight')s.fearBishop.encounter.status='FIGHTING';
    expect(blockConcealmentServantEncounter(s,{type:'ENCOUNTER_FIGHT'})).not.toBeNull();rejectCs(s,{type:'ENCOUNTER_FIGHT'});
  });
  it('an invented blocked door cannot be used as a concealment-assisted exit',()=>{
    const s=structuredClone(ready);s.concealmentServant.encounter.room.doorStatus='BLOCKED' as never;
    expect(blockConcealmentServantEncounter(s,{type:'LEAVE_ENCOUNTER'})).toContain('原门受阻');rejectCs(s,{type:'LEAVE_ENCOUNTER'});
    expect(validateConcealmentServantEncounter(s)).toBe(false);
  });
  it('combat cannot be bypassed with a peaceful leave or a repeated encounter command',()=>{
    for(const type of ['ENCOUNTER_TALK','ENCOUNTER_FIGHT','LEAVE_ENCOUNTER'] as const)rejectCs(fighting,{type});
    expect(currentConcealmentServantCombatSource(fighting)).not.toBeNull();
  });
  it('rejects fabricated terminal settlement before a real saved round and source agree',()=>{
    for(const outcome of ['PLAYER_DEAD','RETREATED','ENEMY_DEAD','ENEMY_SURRENDERED']){
      const s=structuredClone(fighting),before=structuredClone(s);expect(()=>settleConcealmentServantEncounter(s,outcome,noContext)).toThrow();expect(s).toEqual(before);
    }
  });
  it('the actual dead terminal cannot reopen/refill Oswin or start another ordinary command',()=>{
    const s=concealmentServantBoundary('combat-terminal').final;expect(validateConcealmentServantEncounter(s)).toBe(true);
    rejectCs(s,{type:'ENCOUNTER_TALK'});rejectCs(s,{type:'ENCOUNTER_FIGHT'});rejectCs(s,{type:'LEAVE_ENCOUNTER'});
    expect(()=>applySliceIntent(s,{type:'COMBAT_ROUND',stance:'RETREAT'})).toThrow();expect(currentConcealmentServantCombatSource(s)).toBeNull();
  });
  it('corrects the inherited Fear Bishop public enemy wheels without altering the old saved outcome or random state',()=>{
    const old=migrateSliceState(readObjectEntry<unknown>(fearBishopFixturePath,'combatStart')),before=structuredClone(old),p=projectSliceState(old).combat!;
    expect(p.playerCountWheel).toEqual(FEAR_BISHOP_COUNT_WHEEL);expect(p.enemyCountWheel).toEqual(FEAR_BISHOP_ENEMY_COUNT_WHEEL);
    const labels=['有限暗矢：5S/75','有限护术：4S/减45','同一原棍：20×身体','有限专注：4S/抵抗本轮下一次睡恐压力','判断偏差：−22.5'];expect(p.enemyAbilityWheel).toEqual(FEAR_BISHOP_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:labels[index]})));expect(p.enemyAbilityWheel.map(a=>a.weight)).toEqual([35,25,20,15,5]);
    expect(old).toEqual(before);assertValidSliceState(old);
  });
});
