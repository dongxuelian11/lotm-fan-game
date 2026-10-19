import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { openAbyssRuntimeSession } from '../../src/domain/abyss/owned-session.js';
import { createAbyssState,validateAbyssState,validateAbyssCommand } from '../../src/domain/abyss/index.js';
import { ABYSS_ABILITY_IDS,ABYSS_ORIGINAL_IDS } from '../../src/domain/abyss/content.js';
import { abyssHost } from '../../src/domain/abyss/engine.js';
import { abyssSceneBlock } from '../../src/domain/abyss/scene.js';
import { assertAbyssSourceUnmodified,controlledAbyssRolls,executeAbyss,abyssHash,abyssInheritedHash,abyssPublicLeaks,preparedAbyssScenario } from '../helpers/abyss-scenario.js';
let route:ReturnType<typeof preparedAbyssScenario>,restore:(()=>void)|undefined;
const rolls:Record<number,number>={};
beforeAll(()=>{restore=controlledAbyssRolls(rolls);route=preparedAbyssScenario();},300_000);
afterAll(()=>{restore?.();assertAbyssSourceUnmodified();});
describe('Abyss224 actual paid originals, warehouse and bounded runtime',()=>{
 it('preserves the first embodied original and real spent objects while moving two workers and their cargo',()=>{
  const {source,guided,beforeConsume:s}=route,root=s.abyss,scene=root.scene!;
  expect(guided.abyss.scene!.playerPosition).toBe('ORIGINAL_ENTRY');
  expect(root.journal[0]!.command).toEqual({type:'LEAVE_ORIGINAL_COURT'});
  expect(root.journal[0]!.after.location).toBe('AB224-COURT-OUTSIDE');
  expect(scene.originalDepartureEventId).toBeTruthy();expect(scene.originalStrain).toBe(3);
  expect(scene.evacuationReportEventId).toBeTruthy();
  expect(scene.workers.every(w=>w.position==='OUTSIDE'&&w.passage.a&&w.passage.b&&w.passage.exit)).toBe(true);
  expect(scene.cargo.filter(c=>c.carrierId!=='PLAYER').every(c=>c.position==='OUTSIDE'&&c.passage.a&&c.passage.b&&c.passage.exit)).toBe(true);
  expect(scene.originalOperation).toEqual(source.uncleanMonarch.life.operation);
  expect(root.materials!.originals.map(o=>o.originalId)).toEqual([...ABYSS_ORIGINAL_IDS]);
  expect(root.materials!.originals.map(o=>o.holder)).toEqual(['EMBODIED','COMPOUND','COMPOUND']);
  for(const o of root.materials!.originals.filter(o=>o.originalId!=='unclean-monarch-potion-1')){
   expect(o.labourSteps).toBe(5);expect(o.labourEventIds).toHaveLength(5);
  }
  expect(s.week-source.uncleanMonarch.promotionWeek!).toBeGreaterThanOrEqual(12);
  expect(s.progression.mastery).toEqual(source.progression.mastery);
  expect(abyssInheritedHash(s)).toBe(abyssInheritedHash(source));
  expect(root.promotionStability.preparations.at(-1)!.status).toBe('READY');
 });
 it('keeps owned drafts isolated and rejects forged sources, S0 and hidden-roll commands',()=>{
  const session=route.session,hash=abyssHash(session.snapshot());
  expect(abyssPublicLeaks(session.project())).toEqual([]);expect(session.project()).toMatchObject({canAct:false,maxSpirituality:120});
  expect(validateAbyssCommand({type:'CONSUME',compoundId:'x',confirmed:true,roll:1})).toBe(false);
  const draft=session.prepare({type:'ABYSS',command:{type:'NEXT_WEEK'}},session.inspect().revision);
  const copy=session.snapshotDraft(draft);copy.cash=999999;
  expect(session.snapshotDraft(draft).cash).not.toBe(999999);session.discard(draft);
  expect(()=>session.commit(draft)).toThrow();expect(abyssHash(session.snapshot())).toBe(hash);
  expect(()=>session.prepare({type:'ACTION',action:'REST'},session.inspect().revision)).toThrow();
  const forged=structuredClone(route.source);forged.progression.sequence=0;forged.abyss=createAbyssState();expect(validateAbyssState(forged)).toBe(false);
  const tampered=structuredClone(route.beforeConsume);tampered.demon.strain++;expect(validateAbyssState(tampered)).toBe(false);
 },300_000);
 it('pays for two finite techniques, respects withdrawn permission and target changes, and leaves by the ordinary route',()=>{
  const before=route.beforeConsume,s=executeAbyss(route.session,{type:'CONSUME',compoundId:before.abyss.materials!.compounds[0]!.id,confirmed:true});
  expect(s.progression).toMatchObject({pathwayId:'abyss',sequence:0,acting:0});
  expect(s.spirituality).toBe(before.spirituality-30);expect(s.mind).toBe(before.mind-12);expect(s.health).toBe(before.health);
  expect(s.random.cursor).toBe(before.random.cursor+1);expect(s.lastCheck).toMatchObject({chance:70,roll:1});
  expect(s.abyss.materials!.originals.every(o=>o.holder==='FUSED')).toBe(true);expect(s.abyss.materials!.uniqueness.holder).toBe('FUSED');
  expect(route.session.project()).toMatchObject({canAct:false,maxSpirituality:150,abyss:{promoted:true}});assertValidSliceState(s);
  let corrosion=false,sense=false;
  for(let n=0;n<100;n++){
   const current=route.session.snapshot(),scene=current.abyss.scene!;if(scene.returnReportEventId)break;
   const action=route.session.projectAbyss().actions.find(a=>a.preferredAction);
   if(!action?.enabled)throw Error(`S0 warehouse route blocked ${JSON.stringify({scene,ap:current.actionsRemaining,cash:current.cash,action})}`);
   const command=action.command;
   if(command.type==='CORRODE_PIN'||command.type==='SENSE_DANGER'){
    const host=abyssHost(current.abyss,'test',current.revision+1),withdrawn=structuredClone(scene);withdrawn.owner.consent='WITHDRAWN';
    expect(abyssSceneBlock(withdrawn,command,host)).not.toBeNull();
    if(command.type==='CORRODE_PIN')corrosion=true;else sense=true;
   }
   const next=executeAbyss(route.session,command);
   if(command.type==='CORRODE_PIN'||command.type==='SENSE_DANGER'){
    expect(next.spirituality).toBe(current.spirituality-12);expect(next.mind).toBe(current.mind-5);
    expect(next.abyss.scene!.window!.expiresAt-next.abyss.scene!.window!.createdAt).toBe(20);
   }
   if(command.type==='MOVE_CARGO'&&scene.window?.kind==='DANGER_SENSE')expect(next.health).toBe(current.health-3);
  }
  const final=route.session.snapshot();expect(final.abyss.scene!.returnReportEventId).toBeTruthy();expect(corrosion).toBe(true);expect(sense).toBe(true);
  expect(ABYSS_ABILITY_IDS.map(id=>final.progression.mastery[id])).toEqual([8,8]);
  expect(abyssInheritedHash(final)).toBe(abyssInheritedHash(route.source));expect(abyssPublicLeaks(route.session.project())).toEqual([]);
 },300_000);
 it('retains living failure materials and permanent fatal loss without a fourth original',()=>{
  const before=route.beforeConsume,id=before.abyss.materials!.compounds[0]!.id,cursor=before.random.cursor;
  try{
   rolls[cursor]=80;const failed=openAbyssRuntimeSession(before),s=executeAbyss(failed,{type:'CONSUME',compoundId:id,confirmed:true});
   expect(s.status).toBe('ACTIVE');expect(s.progression.sequence).toBe(1);expect(s.health).toBe(before.health-45);expect(s.seer.pollution).toBe(35);
   expect(s.abyss.materials!.originals).toHaveLength(3);expect(s.abyss.materials!.uniqueness.holder).toBe('EXPOSED');
   executeAbyss(failed,{type:'NEXT_WEEK'});const sealed=executeAbyss(failed,{type:'SEAL_REMAINS',compoundId:id});expect(sealed.abyss.materials!.compounds[0]!.status).toBe('FAILED_SEALED');
   rolls[cursor]=100;const dying=openAbyssRuntimeSession(before),dead=executeAbyss(dying,{type:'CONSUME',compoundId:id,confirmed:true});
   expect(dead.status).toBe('DEAD');expect(dead.abyss.materials!.originals.every(o=>o.holder==='DEATH_REMAINS')).toBe(true);
   expect(()=>dying.prepare({type:'ABYSS',command:{type:'REST'}},dead.revision)).toThrow();assertValidSliceState(dead);
  }finally{delete rolls[cursor];}
 },300_000);
});
