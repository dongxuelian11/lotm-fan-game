import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { openHangedManRuntimeSession } from '../../src/domain/hanged-man/owned-session.js';
import { createHangedManState,validateHangedManState,validateHangedManCommand } from '../../src/domain/hanged-man/index.js';
import { HANGED_MAN_ABILITY_IDS,HANGED_MAN_ORIGINAL_IDS } from '../../src/domain/hanged-man/content.js';
import { hangedManHost } from '../../src/domain/hanged-man/engine.js';
import { hangedManSceneBlock } from '../../src/domain/hanged-man/scene.js';
import { assertHangedManSourceUnmodified,controlledHangedManRolls,executeHangedMan,hangedManHash,hangedManInheritedHash,hangedManPublicLeaks,preparedHangedManScenario } from '../helpers/hanged-man-scenario.js';
let route:ReturnType<typeof preparedHangedManScenario>,restore:(()=>void)|undefined;
const rolls:Record<number,number>={};
beforeAll(()=>{restore=controlledHangedManRolls(rolls);route=preparedHangedManScenario();},300_000);
afterAll(()=>{restore?.();assertHangedManSourceUnmodified();});
describe('Hanged Man223 actual original recovery, corridor and runtime',()=>{
 it('preserves three historical failures, walks the original exit, pays actual workers and binds only three originals',()=>{
  const {predecessor,source,guided,beforeConsume:s}=route,root=s.hangedMan,scene=root.scene!;
  expect(source.darkAngel.bottles.slice(0,3)).toEqual(predecessor.darkAngel.bottles);
  expect(source.darkAngel.resupply.deliveries).toBe(1);
  expect(source.darkAngel.acquisitionJournal.filter(e=>e.command.type==='RECOVER_CHARACTERISTIC_V1')).toHaveLength(1);
  expect(source.darkAngel.bottles.at(-1)!.recovery?.originalBottleId).toBe('dark-angel-potion-1');
  expect(guided.hangedMan.scene!.playerPosition).toBe('ORIGINAL_ENTRY');
  expect(root.journal[0]!.command).toEqual({type:'LEAVE_ORIGINAL_COURT'});
  expect(root.journal[0]!.after.location).toBe('HM223-COURT-OUTSIDE');
  expect(scene.originalDepartureEventId).toBeTruthy();
  expect(scene.evacuationReportEventId).toBeTruthy();
  expect(scene.workers.every(w=>w.position==='OUTSIDE'&&w.passage.a&&w.passage.b&&w.passage.exit)).toBe(true);
  expect(scene.workers.map(w=>[w.walkedMetres,w.energy])).toEqual([[16,64],[16,64]]);
  expect(scene.originalOperation).toEqual(source.darkAngel.life.operation);
  expect(scene.spirits).toEqual(root.source!.originals.site.spirits);
  expect(root.materials!.originals.map(o=>o.originalId)).toEqual([...HANGED_MAN_ORIGINAL_IDS]);
  expect(root.materials!.originals.map(o=>o.holder)).toEqual(['EMBODIED','COMPOUND','COMPOUND']);
  expect(s.week-source.darkAngel.promotionWeek!).toBeGreaterThanOrEqual(12);
  expect(s.progression.mastery).toEqual(source.progression.mastery);
  expect(hangedManInheritedHash(s)).toBe(hangedManInheritedHash(source));
  expect(root.promotionStability.preparations.at(-1)!.status).toBe('READY');
 });
 it('keeps public state clean and draft ownership private, rejects forged histories and plain old actions',()=>{
  const session=route.session,hash=hangedManHash(session.snapshot());
  expect(hangedManPublicLeaks(session.project())).toEqual([]);
  expect(session.project()).toMatchObject({canAct:false,maxSpirituality:120});
  expect(validateHangedManCommand({type:'CONSUME',compoundId:'x',confirmed:true,roll:1})).toBe(false);
  const draft=session.prepare({type:'HANGED_MAN',command:{type:'NEXT_WEEK'}},session.inspect().revision);
  const copy=session.snapshotDraft(draft);copy.cash=999999;
  expect(session.snapshotDraft(draft).cash).not.toBe(999999);session.discard(draft);
  expect(()=>session.commit(draft)).toThrow();expect(hangedManHash(session.snapshot())).toBe(hash);
  expect(()=>session.prepare({type:'ACTION',action:'REST'},session.inspect().revision)).toThrow();
  const forged=structuredClone(route.source);forged.progression.sequence=0;forged.hangedMan=createHangedManState();expect(validateHangedManState(forged)).toBe(false);
  const tampered=structuredClone(route.beforeConsume);tampered.darkAngel.life.operation.sealWear++;expect(validateHangedManState(tampered)).toBe(false);
 },300_000);
 it('promotes without a refill and uses bounded actual pressure and one eligible original spirit before ordinary exit',()=>{
  const before=route.beforeConsume,s=executeHangedMan(route.session,{type:'CONSUME',compoundId:before.hangedMan.materials!.compounds[0]!.id,confirmed:true});
  expect(s.progression).toMatchObject({pathwayId:'hanged-man',sequence:0,acting:0});
  expect(s.spirituality).toBe(before.spirituality-30);expect(s.mind).toBe(before.mind-12);expect(s.health).toBe(before.health);
  expect(s.random.cursor).toBe(before.random.cursor+1);expect(s.lastCheck).toMatchObject({chance:70,roll:1});
  expect(s.hangedMan.materials!.originals.every(o=>o.holder==='FUSED')).toBe(true);
  expect(s.hangedMan.materials!.uniqueness.holder).toBe('FUSED');
  expect(route.session.project()).toMatchObject({canAct:false,maxSpirituality:150,hangedMan:{promoted:true}});
  assertValidSliceState(s);
  let bearing=false,sealing=false;
  for(let n=0;n<100;n++){
   const current=route.session.snapshot(),scene=current.hangedMan.scene!;if(scene.returnReportEventId)break;
   const action=route.session.projectHangedMan().actions.find(a=>a.preferredAction);
   if(!action?.enabled)throw Error(`S0 route blocked ${JSON.stringify({scene,ap:current.actionsRemaining,cash:current.cash,action})}`);
   const command=action.command;
   if(command.type==='BEAR_PRESSURE'||command.type==='COOPERATIVE_SEAL'){
    const host=hangedManHost(current.hangedMan,'test',current.revision+1),withdrawn=structuredClone(scene);withdrawn.owner.consent='WITHDRAWN';
    expect(hangedManSceneBlock(withdrawn,command,host)).not.toBeNull();
    if(command.type==='COOPERATIVE_SEAL'){sealing=true;const released=structuredClone(scene);released.spirits[command.spiritId].status='RELEASED';expect(hangedManSceneBlock(released,command,host)).not.toBeNull();}else bearing=true;
   }
   const next=executeHangedMan(route.session,command);
   if(command.type==='BEAR_PRESSURE'||command.type==='COOPERATIVE_SEAL'){expect(next.spirituality).toBe(current.spirituality-12);expect(next.mind).toBe(current.mind-5);expect(next.hangedMan.scene!.window!.expiresAt-next.hangedMan.scene!.window!.createdAt).toBe(20);}
   if(command.type==='TEST_PRESSURE'&&scene.window?.kind==='PRESSURE_BEARING')expect(next.health).toBe(current.health-3);
   if(command.type==='COOPERATIVE_SEAL')expect(next.hangedMan.scene!.spirits[command.spiritId].spirituality).toBe(scene.spirits[command.spiritId].spirituality-3);
  }
  const final=route.session.snapshot();expect(final.hangedMan.scene!.returnReportEventId).toBeTruthy();expect(bearing).toBe(true);expect(sealing).toBe(true);
  expect(HANGED_MAN_ABILITY_IDS.map(id=>final.progression.mastery[id])).toEqual([8,8]);
  expect(hangedManInheritedHash(final)).toBe(hangedManInheritedHash(route.source));expect(hangedManPublicLeaks(route.session.project())).toEqual([]);
 },300_000);
 it('retains living failure remnants and seals severe death without granting a fourth original',()=>{
  const before=route.beforeConsume,id=before.hangedMan.materials!.compounds[0]!.id,cursor=before.random.cursor;
  try{
   rolls[cursor]=80;const failed=openHangedManRuntimeSession(before),s=executeHangedMan(failed,{type:'CONSUME',compoundId:id,confirmed:true});
   expect(s.status).toBe('ACTIVE');expect(s.progression.sequence).toBe(1);expect(s.health).toBe(before.health-45);expect(s.seer.pollution).toBe(35);
   expect(s.hangedMan.materials!.originals).toHaveLength(3);expect(s.hangedMan.materials!.uniqueness.holder).toBe('EXPOSED');
   expect(failed.projectHangedMan().actions.find(a=>a.command.type==='SEAL_REMAINS')?.reason).toContain('行动');
   executeHangedMan(failed,{type:'NEXT_WEEK'});
   const sealed=executeHangedMan(failed,{type:'SEAL_REMAINS',compoundId:id});expect(sealed.hangedMan.materials!.compounds[0]!.status).toBe('FAILED_SEALED');
   rolls[cursor]=100;const dying=openHangedManRuntimeSession(before),dead=executeHangedMan(dying,{type:'CONSUME',compoundId:id,confirmed:true});
   expect(dead.status).toBe('DEAD');expect(dead.hangedMan.materials!.originals.every(o=>o.holder==='DEATH_REMAINS')).toBe(true);
   expect(()=>dying.prepare({type:'HANGED_MAN',command:{type:'REST'}},dead.revision)).toThrow();assertValidSliceState(dead);
  }finally{delete rolls[cursor];}
 },300_000);
});
