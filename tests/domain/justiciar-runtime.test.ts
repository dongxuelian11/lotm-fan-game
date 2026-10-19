import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {assertValidSliceState} from '../../src/domain/slice/index.js';
import {openJusticiarRuntimeSession} from '../../src/domain/justiciar/owned-session.js';
import {createJusticiarState,validateJusticiarState} from '../../src/domain/justiciar/index.js';
import {JUSTICIAR_ABILITY_IDS,JUSTICIAR_ORIGINAL_IDS} from '../../src/domain/justiciar/content.js';
import {justiciarHost} from '../../src/domain/justiciar/engine.js';
import {justiciarSceneBlock} from '../../src/domain/justiciar/scene.js';
import {assertJusticiarSourceUnmodified,controlledJusticiarRolls,executeJusticiar,justiciarHash,justiciarInheritedHash,justiciarPublicLeaks,preparedJusticiarScenario} from '../helpers/justiciar-scenario.js';
let route:ReturnType<typeof preparedJusticiarScenario>,restore:(()=>void)|undefined;const rolls:Record<number,number>={};
beforeAll(()=>{restore=controlledJusticiarRolls(rolls);route=preparedJusticiarScenario();},300_000);
afterAll(()=>{restore?.();assertJusticiarSourceUnmodified();});
describe('Justiciar228 actual706 original recovery, dock and paid promotion',()=>{
 it('uses actual wages/recovery and S1 reports before moving the same three characteristics',()=>{
  const {predecessor,source,beforeConsume:s}=route,scene=s.justiciar.scene!;
  expect(predecessor.handOfOrder.bottles).toHaveLength(3);expect(predecessor.seer.pollution).toBe(20);
  expect(source.handOfOrder.life.reflected).toBe(true);expect(source.progression.acting).toBe(100);
  expect(source.handOfOrder.bottles.slice(0,3).every(b=>b.status==='CONSUMED'&&b.outcome==='FAILURE')).toBe(true);
  expect(source.handOfOrder.bottles.at(-1)!.recovery?.originalBottleId).toBe('hand-of-order-potion-1');
  expect(source.chaosHunter.life).toEqual(predecessor.chaosHunter.life);
  expect(scene.evacuationReportEventId).toBeTruthy();
  expect(scene.workers.every(w=>w.age>=18&&w.position==='OUTSIDE'&&w.passage.a&&w.passage.b&&w.passage.exit)).toBe(true);
  expect(scene.cargo.every(c=>c.carrierId==='PLAYER'||c.position==='OUTSIDE'&&c.passage.a&&c.passage.b&&c.passage.exit)).toBe(true);
  expect(s.justiciar.materials!.originals.map(o=>o.originalId)).toEqual([...JUSTICIAR_ORIGINAL_IDS]);
  expect(s.justiciar.materials!.originals.map(o=>o.holder)).toEqual(['EMBODIED','COMPOUND','COMPOUND']);
  expect(s.week-source.handOfOrder.promotionWeek!).toBeGreaterThanOrEqual(12);
  expect(s.progression.mastery).toEqual(source.progression.mastery);expect(justiciarInheritedHash(s)).toBe(justiciarInheritedHash(source));
 });
 it('keeps private drafts isolated, old commands closed and actual public fields clean',()=>{
  const session=route.session,hash=justiciarHash(session.snapshot()),view=session.project();
  expect(justiciarPublicLeaks(view)).toEqual([]);expect(view).toMatchObject({canAct:false,maxSpirituality:120,handOfOrder:{promoted:true}});
  expect(view.handOfOrder.actions.every(a=>!a.enabled)).toBe(true);
  const d=session.prepare({type:'JUSTICIAR',command:{type:'NEXT_WEEK'}},session.inspect().revision),copy=session.snapshotDraft(d);copy.cash=999999;
  expect(session.snapshotDraft(d).cash).not.toBe(999999);expect(justiciarHash(session.snapshot())).toBe(hash);session.discard(d);
  expect(()=>session.commit(d)).toThrow();expect(()=>session.prepare({type:'ACTION',action:'REST'},session.inspect().revision)).toThrow();
  const fake=structuredClone(route.source);fake.progression.sequence=0;fake.justiciar=createJusticiarState();expect(validateJusticiarState(fake)).toBe(false);
 },300_000);
 it('consumes one prepared70 roll and applies finite techniques with revocable permission before ordinary exit',()=>{
  const before=route.beforeConsume,s=executeJusticiar(route.session,{type:'CONSUME',compoundId:before.justiciar.materials!.compounds[0]!.id,confirmed:true});
  expect(s).toMatchObject({progression:{pathwayId:'justiciar',sequence:0,acting:0},lastCheck:{chance:70,roll:1}});
  expect(s.random.cursor).toBe(before.random.cursor+1);expect(s.spirituality).toBe(before.spirituality-30);expect(s.mind).toBe(before.mind-12);
  expect(s.justiciar.materials!.originals.every(o=>o.holder==='FUSED')).toBe(true);expect(s.justiciar.materials!.uniqueness.holder).toBe('FUSED');
  expect(route.session.project()).toMatchObject({canAct:false,maxSpirituality:150,justiciar:{promoted:true}});assertValidSliceState(s);
  const used:string[]=[];
  for(let n=0;n<100;n++){
   const current=route.session.snapshot(),scene=current.justiciar.scene!;if(scene.returnReportEventId)break;
   const a=route.session.projectJusticiar().actions.find(a=>a.preferredAction);if(!a?.enabled)throw Error(`Dock route blocked: ${JSON.stringify(a)}`);
   if(['CONSTRAIN_GATE','PRIORITIZE_ACTION'].includes(a.command.type)){
    const withdrawn=structuredClone(scene);withdrawn.owner.consent='WITHDRAWN';expect(justiciarSceneBlock(withdrawn,a.command,justiciarHost(current.justiciar,'test',current.revision+1))).not.toBeNull();used.push(a.command.type);
   }
   const next=executeJusticiar(route.session,a.command);
   if(['CONSTRAIN_GATE','PRIORITIZE_ACTION'].includes(a.command.type)){expect(next.spirituality).toBe(current.spirituality-12);expect(next.mind).toBe(current.mind-5);expect(next.justiciar.scene!.window!.expiresAt-next.justiciar.scene!.window!.createdAt).toBe(20);}
  }
  const end=route.session.snapshot();expect(used).toEqual(['CONSTRAIN_GATE','PRIORITIZE_ACTION']);expect(end.justiciar.scene!.returnReportEventId).toBeTruthy();expect(end.justiciar.scene!.playerPosition).toBe('OUTSIDE');
  expect(JUSTICIAR_ABILITY_IDS.map(id=>end.progression.mastery[id])).toEqual([8,8]);expect(justiciarInheritedHash(end)).toBe(justiciarInheritedHash(route.source));expect(justiciarPublicLeaks(route.session.project())).toEqual([]);
 },300_000);
 it('keeps living failure recoverable and seals actual death without creating new originals',()=>{
  const before=route.beforeConsume,compoundId=before.justiciar.materials!.compounds[0]!.id,cursor=before.random.cursor;
  try{
   rolls[cursor]=80;const live=openJusticiarRuntimeSession(before),failed=executeJusticiar(live,{type:'CONSUME',compoundId,confirmed:true});
   expect(failed.status).toBe('ACTIVE');expect(failed.health).toBe(before.health-45);expect(failed.justiciar.materials!.originals).toHaveLength(3);
   executeJusticiar(live,{type:'NEXT_WEEK'});expect(executeJusticiar(live,{type:'SEAL_REMAINS',compoundId}).justiciar.materials!.compounds[0]!.status).toBe('FAILED_SEALED');
   rolls[cursor]=100;const fatal=openJusticiarRuntimeSession(before),dead=executeJusticiar(fatal,{type:'CONSUME',compoundId,confirmed:true});
   expect(dead.status).toBe('DEAD');expect(dead.justiciar.materials!.originals.every(o=>o.holder==='DEATH_REMAINS')).toBe(true);expect(()=>fatal.prepare({type:'JUSTICIAR',command:{type:'REST'}},dead.revision)).toThrow();assertValidSliceState(dead);
  }finally{delete rolls[cursor];}
 },300_000);
});
