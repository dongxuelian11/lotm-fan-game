import { beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import { resolveLifeGiverCombatRound, validateLifeGiverRecordedRound } from '../../src/domain/slice/life-giver-combat.js';
import { validateLifeGiverRoundOutcome, currentLifeGiverCombatSource } from '../../src/domain/life-giver/combat.js';
import { LIFE_GIVER_POWERS, createLifeGiverEncounterState, validateLifeGiverEncounter, validateLifeGiverEncounterCommand,
  hasLifeGiverGuestPermit, projectLifeGiverEncounter } from '../../src/domain/life-giver/encounter.js';
import { lifeGiverSnapshot, lifeGiverBoundary, lg, rejectLg } from './life-giver-test-fixture.js';
let original: SliceState, final: SliceState, ready: SliceState;
beforeAll(() => { original=lifeGiverSnapshot('combatStart'); final=lifeGiverSnapshot('final'); ready=lifeGiverBoundary('combat-start').beforeLast; },20000);
const roundsOf = (s: SliceState) => s.combatHistory.filter(r => r.lifeGiverOutcome);
/** Directed unit-only terminal branch. Search the production adapter first,
 * then execute the selected cursor through valid public fight/round commands.
 * Only a pre-fight RNG cursor is changed; no wound/death, source, person or
 * resource is injected into the public input and no natural fixture is edited. */
function directedTerminal(wanted: string, stance: SliceStance): SliceState {
  for(let offset=0;offset<2000;offset++) {
    const probe=structuredClone(original); probe.random.cursor=ready.random.cursor+offset;
    const result=resolveLifeGiverCombatRound(probe,stance); if(result.outcome!==wanted) continue;
    const input=structuredClone(ready); input.random.cursor+=offset; assertValidSliceState(input);
    const untouched=structuredClone(input), fighting=lg(input,{type:'ENCOUNTER_FIGHT'}), beforeRound=structuredClone(fighting);
    const next=applySliceIntent(fighting,{type:'COMBAT_ROUND',stance});
    expect(input).toEqual(untouched); expect(fighting).toEqual(beforeRound); assertValidSliceState(next);
    expect(next.lifeGiver.encounter.terminal?.outcome).toBe(wanted); return next;
  }
  throw new Error(`No directed ${wanted} cursor found; natural evidence remains unchanged`);
}

describe('Life Giver natural source continuity, strict RNG and real terminal replay', () => {
  it('uses a distinct original Adrian and freezes old resisting Edwin and surrendered Dorian exactly', () => {
    const source=currentLifeGiverCombatSource(original); expect(source).toMatchObject({targetId:'LG2-ADRIAN-VALE',targetAge:46,targetSequence:2,enemyPhysique:24,enemyWeapon:'LG2-ADRIAN-CLUB',actualOriginalBody:true,independentMind:true,enemyHealth:100,enemyMind:100,enemySpirituality:120});
    expect(final.summoningMaster.encounter).toEqual(original.summoningMaster.encounter);
    expect(final.summoningMaster.encounter).toMatchObject({targetId:'SM3-EDWIN',enemyStatus:'RESISTING'});
    expect(final.witchKing.encounter).toEqual(original.witchKing.encounter);
    expect(final.witchKing.encounter.enemy).toMatchObject({id:'WK4-DORIAN',status:'SURRENDERED'});
    expect(final.progression.mastery).toEqual(original.progression.mastery);
    expect(final.character.gender).toBe(original.character.gender);
    expect(final.summoningMaster.life.partner).toMatchObject({id:original.summoningMaster.life.partner.id,bodyId:original.summoningMaster.life.partner.bodyId,chime:original.summoningMaster.life.partner.chime});
  });

  it('replays the actual eight-round natural retreat without claiming natural shared-load or guest death', () => {
    const rounds=roundsOf(final),e=final.lifeGiver.encounter; expect(rounds).toHaveLength(8);
    expect(e).toMatchObject({status:'RETREATED',enemyHealth:80,enemyMind:100,enemySpirituality:1,enemyStatus:'RESISTING',weaponLocation:'HAND',vitalityUses:1,vitalitySuccesses:0,shelterUses:2,shelterSuccesses:1,shelterEffects:0,totalPlayerHealthSpent:0});
    expect(e.enemySpirituality).toBe(120-LIFE_GIVER_POWERS.reduce((n,p)=>n+e.powerUses[p.id]*p.cost,0));
    for(const r of rounds) {expect(validateLifeGiverRoundOutcome(r.lifeGiverOutcome)).toBe(true);expect(validateLifeGiverRecordedRound(r)).toBe(true);}
    expect(validateLifeGiverEncounter(original)).toBe(true); expect(validateLifeGiverEncounter(final)).toBe(true);
    expect(final.summoningMaster.life.partner).toMatchObject({health:100,mind:92,stamina:88,status:'ALIVE',location:'HOME'});
    expect(final.lifeGiver.life.beads.filter(b=>b.purpose==='COMBAT')).toHaveLength(3);
    expect(final.lifeGiver.life.beads.filter(b=>b.purpose==='COMBAT').every(b=>b.status==='SPENT')).toBe(true);
    expect(final.witchKing.life.papers.find(p=>p.id==='WK4-PAPER-1-3')).toMatchObject({status:'CONSUMED',consumedBy:'COMBAT',combatRound:4});
    assertValidSliceState(final);
  });

  it('carries exact source costs, actual original items, injury risks and RNG cursors across every round', () => {
    const rounds=roundsOf(final);
    expect(rounds[0]!.lifeGiverOutcome!.source).toEqual({...original.lifeGiver.encounter.startSource,revision:original.lifeGiver.encounter.startSource!.revision+1});
    for(let i=1;i<rounds.length;i++) {
      const previous=rounds[i-1]!.lifeGiverOutcome!,next=rounds[i]!.lifeGiverOutcome!,source=next.source;
      expect(source.randomCursor).toBe(previous.randomCursorAfter);expect(source.revision).toBe(previous.source.revision+1);
      expect(source.playerSpirituality).toBe(Math.min(120,previous.playerSpiritualityAfter+12));expect(source.enemySpirituality).toBe(previous.enemySpirituality);
      expect(source.partner).toEqual(previous.partnerAfter);expect(source.papers).toEqual(previous.papersAfter);expect(source.combatBeads).toEqual(previous.combatBeads);
      expect(source.playerHealth).toBe(previous.playerHealthAfter);expect(source.playerInjuries).toEqual(previous.playerInjuriesAfter);expect(source.playerRisk).toBe(previous.playerRiskAfter);
      expect(source.enemyHealth).toBe(previous.enemyHealth);expect(source.enemyInjuries).toEqual(previous.enemyInjuriesAfter);expect(source.enemyRisk).toBe(previous.enemyRiskAfter);
      expect(source.powerUses).toEqual(previous.powerUses);expect(source.lifeAnchor).toBe(previous.source.lifeAnchor);
    }
  });

  it('rejects count, ability, random cursor, winner, injury and unknown-key record tampering', () => {
    const natural=roundsOf(final).find(r=>r.consequenceRoll!==undefined && r.lifeGiverOutcome!.playerActions.length>0)!; expect(natural).toBeDefined();
    const changes: ((r:typeof natural)=>void)[]=[r=>{r.playerCountRoll=r.playerCountRoll===100?99:r.playerCountRoll+1;},r=>{r.enemyCount++;},r=>{r.first=r.first==='PLAYER'?'ENEMY':'PLAYER';},
      r=>{r.playerAdvantage++;},r=>{r.winChance++;},r=>{r.winner=r.winner==='PLAYER'?'ENEMY':'PLAYER';},r=>{r.consequenceRoll=r.consequenceRoll===100?99:r.consequenceRoll!+1;},
      r=>{r.lifeGiverOutcome!.randomCursorAfter++;},r=>{r.lifeGiverOutcome!.source.randomCursor++;},r=>{r.lifeGiverOutcome!.playerActions[0]!.id='OBSERVE';},
      r=>{r.lifeGiverOutcome!.playerRiskAfter++;},r=>{(r as unknown as Record<string,unknown>).extra='forged';}];
    for(const change of changes){const bad=structuredClone(natural);change(bad);expect(validateLifeGiverRecordedRound(bad)).toBe(false);}
    expect(validateLifeGiverRecordedRound(natural)).toBe(true);
  });

  it('rejects terminal/source laundering, revived spent beads, swapped original paper and altered consent history', () => {
    const changes: ((s:SliceState)=>void)[]=[s=>{s.lifeGiver.encounter.startSource!.partner.bodyId='COPY' as 'SM3-LUMEN-BODY';},
      s=>{s.lifeGiver.encounter.terminal!.historyIndex--;},s=>{s.lifeGiver.encounter.terminal!.outcome='ENEMY_SURRENDERED';},
      s=>{s.lifeGiver.encounter.enemySpirituality++;},s=>{s.lifeGiver.encounter.exitTravelMetres=0;},s=>{s.lifeGiver.encounter.retrievedBeadIds.pop();},
      s=>{s.lifeGiver.life.beads.find(b=>b.purpose==='COMBAT')!.status='READY';},s=>{s.witchKing.life.papers.find(p=>p.id==='WK4-PAPER-1-3')!.status='PREPARED';},
      s=>{s.lifeGiver.encounter.invitationHistory[0]!.paidPence=0 as 20;},s=>{s.lifeGiver.encounter.guestPermit!.encounterId='SUMMONING_MASTER_DISPUTE' as 'LIFE_GIVER_DISPUTE';}];
    for(const change of changes){const bad=structuredClone(final);change(bad);expect(validateLifeGiverEncounter(bad)).toBe(false);}
  });

  it('freezes independent paid20p current consent with real60m/60sec travel and no automatic arrival', () => {
    const b=lifeGiverBoundary('new-current-battle-invitation'),before=b.beforeLast,after=b.final;
    expect(before.lifeGiver.encounter.guestPolicy).toBe('HOME');expect(before.lifeGiver.encounter.guestPermit).toBeNull();
    expect(after.cash).toBe(before.cash-20);expect(after.actionsRemaining).toBe(before.actionsRemaining);expect(after.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner);
    expect(after.lifeGiver.life.playerTravelMetres).toBe(before.lifeGiver.life.playerTravelMetres+60);expect(after.lifeGiver.life.clockSeconds).toBe(before.lifeGiver.life.clockSeconds+60);
    expect(hasLifeGiverGuestPermit(after)).toBe(true);expect(after.lifeGiver.encounter.guestPermit).not.toEqual(after.summoningMaster.encounter.guestPermit);
    rejectLg(after,{type:'SET_GUEST_POLICY',policy:'ASK_HELP'});
    const withdrawn=lg(after,{type:'SET_GUEST_POLICY',policy:'HOME'});expect(withdrawn.cash).toBe(after.cash);expect(withdrawn.lifeGiver.encounter.guestPermit).toBeNull();expect(withdrawn.lifeGiver.encounter.invitationVisits).toBe(1);
  });

  it('requires an explicit fight and allows peaceful4m/4sec exit while retaining every same paid original', () => {
    expect(ready.combat).toBeNull();const before=structuredClone(ready),next=lg(ready,{type:'LEAVE_ENCOUNTER'}),e=next.lifeGiver.encounter;
    expect(ready).toEqual(before);expect(e).toMatchObject({status:'RESOLVED',enemyHealth:100,enemySpirituality:120,enemyStatus:'RESISTING',weaponLocation:'HAND',terminal:null,exitTravelMetres:4,exitSeconds:4});
    expect(next.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner);expect(next.witchKing.life.papers).toEqual(before.witchKing.life.papers);
    expect(next.lifeGiver.life.beads.filter(b=>b.purpose==='COMBAT')).toEqual(before.lifeGiver.life.beads.filter(b=>b.purpose==='COMBAT').map(b=>({...b,location:'RETURN_TRAY'})));
    expect(next.progression.mastery).toEqual(before.progression.mastery);rejectLg(next,{type:'ENCOUNTER_TALK'});
  });

  it('preserves natural ordinary retreat with enemy original club still HAND and all spent bead physicals returned', () => {
    const s=lifeGiverBoundary('combat-terminal').final,e=s.lifeGiver.encounter;expect(e).toMatchObject({status:'RETREATED',exitTravelMetres:4,exitSeconds:4,playerLocation:'OUTSIDE',enemyStatus:'RESISTING',weaponLocation:'HAND'});
    expect(e.retrievedBeadIds).toEqual(e.entryBeads.map(b=>b.id));expect(s.lifeGiver.life.beads.filter(b=>b.purpose==='COMBAT').every(b=>b.location==='RETURN_TRAY')).toBe(true);
    expect(s.progression.mastery).toEqual(original.progression.mastery);assertValidSliceState(s);rejectLg(s,{type:'ENCOUNTER_TALK'});
  });

  it('rejects malformed encounter commands rather than silently dropping extra fields', () => {
    for(const command of [{type:'ENCOUNTER_FIGHT',force:true},{type:'SET_GUEST_POLICY',policy:'FORCE'},{type:'SET_GUEST_POLICY',policy:'ASK_HELP',free:true},[],null]) expect(validateLifeGiverEncounterCommand(command)).toBe(false);
    expect(createLifeGiverEncounterState()).toMatchObject({guestPolicy:'HOME',guestPermit:null,enemySpirituality:120});
    const lower=structuredClone(original);lower.progression.sequence=3;expect(projectLifeGiverEncounter(lower)).toMatchObject({enemy:null,story:'',actions:[],facts:[]});
  });

  it('directed public player death leaves all original beads at YARD, with no exit, revival or free mastery', () => {
    const s=directedTerminal('PLAYER_DEAD','ATTACK'),e=s.lifeGiver.encounter;expect(s).toMatchObject({status:'DEAD',health:0,combat:null});
    expect(e).toMatchObject({status:'LOST',playerLocation:'YARD',exitTravelMetres:0,exitSeconds:0,retrievedBeadIds:[]});
    expect(s.lifeGiver.life.beads.filter(b=>b.purpose==='COMBAT').every(b=>b.location==='YARD')).toBe(true);
    expect(s.progression.mastery).toEqual(original.progression.mastery);expect(s.summoningMaster.encounter).toEqual(original.summoningMaster.encounter);expect(s.witchKing.encounter).toEqual(original.witchKing.encounter);
    if(s.summoningMaster.life.partner.status==='ALIVE')expect(s.summoningMaster.life.partner.location).toBe('HOME');
    rejectLg(s,{type:'LEAVE_ENCOUNTER'});expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  },60000);

  it.each(['ENEMY_DEAD','ENEMY_SURRENDERED'] as const)('directed public %s preserves actual injury/death and leaves enemy original club at YARD', outcome => {
    const s=directedTerminal(outcome,'ATTACK'),e=s.lifeGiver.encounter;expect(e).toMatchObject({status:'RESOLVED',weaponLocation:'YARD',exitTravelMetres:4,exitSeconds:4});
    expect(e.enemyStatus).toBe(outcome==='ENEMY_DEAD'?'DEAD':'SURRENDERED');if(outcome==='ENEMY_DEAD')expect(e.enemyHealth).toBe(0);else expect(e.enemyHealth).toBeGreaterThan(0);
    expect(e.retrievedBeadIds).toEqual(e.entryBeads.map(b=>b.id));expect(s.lifeGiver.life.beads.filter(b=>b.purpose==='COMBAT').every(b=>b.location==='RETURN_TRAY')).toBe(true);
    expect(s.summoningMaster.encounter).toEqual(original.summoningMaster.encounter);expect(s.witchKing.encounter).toEqual(original.witchKing.encounter);expect(s.progression.mastery).toEqual(original.progression.mastery);
    rejectLg(s,{type:'ENCOUNTER_TALK'});
  },60000);
});
