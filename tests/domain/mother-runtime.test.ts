import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { openMotherRuntimeSession } from '../../src/domain/mother/owned-session.js';
import { motherSourceBlock } from '../../src/domain/mother/source.js';
import { MOTHER_ABILITY_IDS, MOTHER_ORIGINAL_IDS, MOTHER_SUCCESSION } from '../../src/domain/mother/content.js';
import { motherHost } from '../../src/domain/mother/engine.js';
import { motherSceneBlock } from '../../src/domain/mother/scene.js';
import { compareGameDates, gameDaysBetween } from '../../src/domain/game-calendar.js';
import { assertMotherSourceUnmodified, controlledMotherRolls, executeMother, motherHash, motherInheritedHash, motherPublicLeaks, preparedMotherScenario } from '../helpers/mother-scenario.js';
let route:ReturnType<typeof preparedMotherScenario>,restore:(()=>void)|undefined;
const rolls:Record<number,number>={};
beforeAll(()=>{restore=controlledMotherRolls(rolls);route=preparedMotherScenario();},300_000);
afterAll(()=>{restore?.();assertMotherSourceUnmodified();});
describe('Mother229 actual955 injured source and finite original greenhouse',()=>{
 it('really treats the original H40 body and pays for original materials, repair and plant round trips',()=>{
  const {source,guided,beforeConsume:s}=route,scene=s.mother.scene!;
  expect(motherSourceBlock(source)).toBeNull();expect(guided.health).toBe(40);expect(guided.injuries).toEqual(source.injuries);
  expect(guided.cash).toBe(source.cash-100);expect(guided.actionsRemaining).toBe(source.actionsRemaining-1);
  const clinic=s.mother.journal.find(e=>e.command.type==='CLINIC')!;
  expect(clinic.before.budget.injuries.filter(i=>i.severity==='HEAVY'&&i.treatedRevision===null)).toHaveLength(2);
  expect(clinic.after.budget.health).toBe(clinic.before.budget.health);expect(clinic.after.budget.cash).toBe(clinic.before.budget.cash-60);
  expect(clinic.after.budget.injuries).toHaveLength(4);expect(s.mother.journal.some(e=>e.command.type==='REST')).toBe(true);
  expect(s.mother.journal.some(e=>e.command.type==='WORK')).toBe(true);expect(s.mother.journal.some(e=>e.financeReceipts.length>0)).toBe(true);
  expect(s.health).toBeGreaterThanOrEqual(80);expect(s.injuries).toEqual([]);expect(s.week-source.natureWalker.promotionWeek!).toBeGreaterThanOrEqual(12);
  expect(gameDaysBetween(s.mother.source!.acquisition.promotionDate,s.date)).toBeGreaterThanOrEqual(84);
  const first=source.natureWalker.acquisitionJournal[0]!.date;
  for(const e of [MOTHER_SUCCESSION.death,MOTHER_SUCCESSION.separation,MOTHER_SUCCESSION.custody])expect(compareGameDates(e.date,first)).toBeLessThan(0);
  expect(scene.originalSite).toEqual(source.natureWalker.life.site);expect(scene.originalRootPad.integrity).toBe(5);
  expect(scene.originalSite.owner).toMatchObject({id:'CB3-ADA',age:46,location:'OUTSIDE',consent:'RECORD_ONLY'});
  expect(scene.originalSite.recipient).toMatchObject({id:'CB3-LENA',age:39,location:'OUTSIDE',consent:'RECORD_ONLY'});
  expect(scene.greenhouseReportEventId).toBeTruthy();expect(scene.greenhouse.repairEventId).toBeTruthy();
  expect(scene.plants.map(p=>[p.id,p.holder,p.location,p.vitality,p.travelMetres])).toEqual([['CB3-LIVE-1','RECIPIENT','OUTSIDE',47,8],['CB3-LIVE-2','OWNER','OUTSIDE',47,8]]);
  expect(scene.plants.every(p=>p.placedEventId&&p.wateredEventId&&p.supportedEventId&&p.returnedEventId)).toBe(true);
  expect(scene.originalSite.samples.find(p=>p.id==='CB3-DRY-1')).toMatchObject({alive:false,vitality:0,massGrams:100,holder:'OWNER',location:'OUTSIDE'});
  expect(s.mother.materials!.originals.map(p=>p.originalId)).toEqual([...MOTHER_ORIGINAL_IDS]);
  expect(s.mother.materials!.originals.map(p=>p.holder)).toEqual(['EMBODIED','COMPOUND','COMPOUND']);
  expect(s.mother.materials!.originals.slice(1).every(p=>p.labourSteps===5&&p.labourEventIds.length===5)).toBe(true);
  expect(s.progression.mastery).toEqual(source.progression.mastery);expect(motherInheritedHash(s)).toBe(motherInheritedHash(source));
  expect(motherPublicLeaks(route.session.project())).toEqual([]);
 },300_000);
 it('does not strand the actual borrowed plant when either adult withdraws, and private drafts stay isolated',()=>{
  const session=openMotherRuntimeSession(route.beforeConsume),beforeHash=motherHash(session.snapshot());
  const draft=session.prepare({type:'MOTHER',command:{type:'NEXT_WEEK'}},session.inspect().revision),copy=session.snapshotDraft(draft);copy.cash=999999;
  expect(session.snapshotDraft(draft).cash).not.toBe(999999);expect(motherHash(session.snapshot())).toBe(beforeHash);session.discard(draft);expect(()=>session.commit(draft)).toThrow();
  executeMother(session,{type:'CONSUME',compoundId:route.beforeConsume.mother.materials!.compounds[0]!.id,confirmed:true});
  let borrowed=false;
  for(let n=0;n<60;n++){
   const s=session.snapshot(),p=s.mother.scene!.plants[0]!;
   if(p.holder==='PLAYER'&&p.location==='GREENHOUSE'){borrowed=true;break;}
   const action=session.projectMother().actions.find(a=>a.preferredAction);expect(action?.enabled).toBe(true);executeMother(session,action!.command);
  }
  expect(borrowed).toBe(true);const before=session.snapshot();executeMother(session,{type:'WITHDRAW_PERMISSION',personId:'CB3-LENA'});
  for(let n=0;n<12&&!session.snapshot().mother.scene!.returnReportEventId;n++){const a=session.projectMother().actions.find(x=>x.preferredAction);expect(a?.enabled).toBe(true);executeMother(session,a!.command);}
  const end=session.snapshot(),scene=end.mother.scene!;expect(scene.status).toBe('ABORTED');expect(scene.returnReportEventId).toBeTruthy();expect(scene.playerPosition).toBe('OUTSIDE');
  expect(scene.plants.every(p=>p.holder===p.originalHolder&&p.location==='OUTSIDE')).toBe(true);expect(scene.plants.map(p=>p.vitality)).toEqual([47,47]);
  expect(end.cash).toBe(before.cash);expect(end.actionsRemaining).toBe(before.actionsRemaining);expect(motherInheritedHash(end)).toBe(motherInheritedHash(route.source));
 },300_000);
 it('pays for exact20second single-target windows and actual water, vitality and original-branch support before return',()=>{
  const before=route.beforeConsume,session=route.session,s=executeMother(session,{type:'CONSUME',compoundId:before.mother.materials!.compounds[0]!.id,confirmed:true});
  expect(s).toMatchObject({progression:{pathwayId:'mother',sequence:0,acting:0},lastCheck:{chance:70,roll:1}});
  expect(s.random.cursor).toBe(before.random.cursor+1);expect(s.spirituality).toBe(before.spirituality-30);expect(s.mind).toBe(before.mind-12);
  expect(MOTHER_ABILITY_IDS.map(id=>s.progression.mastery[id])).toEqual([0,0]);expect(s.mother.materials!.originals.every(p=>p.holder==='FUSED')).toBe(true);
  const used:string[]=[];
  for(let n=0;n<90;n++){
   const current=session.snapshot(),scene=current.mother.scene!;if(scene.returnReportEventId)break;
   const a=session.projectMother().actions.find(x=>x.preferredAction);if(!a?.enabled)throw Error(`Mother short inspection blocked: ${JSON.stringify(a)}`);
   const next=executeMother(session,a.command);
   if(a.command.type==='MAINTAIN_VITALITY'||a.command.type==='SUPPORT_BRANCH'){
    used.push(a.command.type);expect(next.spirituality).toBe(current.spirituality-12);expect(next.mind).toBe(current.mind-5);
    const window=next.mother.scene!.window!;expect(window.expiresAt-window.createdAt).toBe(20);
    const action={type:a.command.type==='MAINTAIN_VITALITY'?'APPLY_MAINTENANCE':'APPLY_BRANCH_SUPPORT',sampleId:a.command.sampleId}as const;
    const host=motherHost(next.mother,'test',next.revision+1);
    expect(motherSceneBlock(next.mother.scene!,action,host)).toBeNull();
    expect(motherSceneBlock(next.mother.scene!,{...action,sampleId:a.command.sampleId==='CB3-LIVE-1'?'CB3-LIVE-2':'CB3-LIVE-1'},host)).not.toBeNull();
    expect(motherSceneBlock(next.mother.scene!,action,{...host,second:window.expiresAt})).not.toBeNull();
    const withdrawn=structuredClone(next.mother.scene!);withdrawn.permissions['CB3-ADA'].consent='WITHDRAWN';expect(motherSceneBlock(withdrawn,action,host)).not.toBeNull();
   }
   if(a.command.type==='APPLY_MAINTENANCE')expect(next.mother.scene!.supplies.waterRemaining).toBe(scene.supplies.waterRemaining-1);
   if(a.command.type==='APPLY_BRANCH_SUPPORT'){expect(next.mother.scene!.supplies.waterRemaining).toBe(scene.supplies.waterRemaining-1);expect(next.mother.scene!.plants[1]!.vitality).toBe(scene.plants[1]!.vitality-2);}
  }
  const end=session.snapshot(),scene=end.mother.scene!;expect(used).toEqual(['MAINTAIN_VITALITY','SUPPORT_BRANCH']);
  expect(scene).toMatchObject({phase:'PRACTICE',status:'COMPLETED',playerPosition:'OUTSIDE',window:null,contactSampleId:null,maintenanceApplied:true,branchApplied:true,supplies:{waterRemaining:4,wedgesRemaining:0}});
  expect(scene.returnReportEventId).toBeTruthy();expect(scene.plants.map(p=>p.vitality)).toEqual([47,45]);expect(scene.plants.every(p=>p.quantity===1&&p.massGrams===500&&p.branch.growthCount===0&&p.holder===p.originalHolder&&p.location==='OUTSIDE'&&p.travelMetres===16)).toBe(true);
  expect(MOTHER_ABILITY_IDS.map(id=>end.progression.mastery[id])).toEqual([8,8]);expect(motherInheritedHash(end)).toBe(motherInheritedHash(route.source));expect(motherPublicLeaks(session.project())).toEqual([]);assertValidSliceState(end);
 },300_000);
 it('retains surviving-failure material custody and seals actual death without a fourth original',()=>{
  const before=route.beforeConsume,compoundId=before.mother.materials!.compounds[0]!.id,cursor=before.random.cursor;
  try{
   rolls[cursor]=80;const live=openMotherRuntimeSession(before),failed=executeMother(live,{type:'CONSUME',compoundId,confirmed:true});
   expect(failed.status).toBe('ACTIVE');expect(failed.health).toBe(before.health-45);expect(failed.mother.materials!.originals).toHaveLength(3);
   expect(failed.mother.materials!.originals[0]!.holder).toBe('EMBODIED');expect(failed.mother.materials!.compounds[0]!.status).toBe('FAILED_EXPOSED');
   executeMother(live,{type:'NEXT_WEEK'});expect(executeMother(live,{type:'SEAL_REMAINS',compoundId}).mother.materials!.compounds[0]!.status).toBe('FAILED_SEALED');
   expect(live.projectMother().actions.find(a=>a.command.type==='RECOVER_REMAINS')?.enabled).toBe(false);
   rolls[cursor]=100;const fatal=openMotherRuntimeSession(before),dead=executeMother(fatal,{type:'CONSUME',compoundId,confirmed:true});
   expect(dead.status).toBe('DEAD');expect(dead.mother.materials!.originals.every(p=>p.holder==='DEATH_REMAINS')).toBe(true);expect(dead.mother.materials!.uniqueness.holder).toBe('DEATH_REMAINS');
   expect(()=>fatal.prepare({type:'MOTHER',command:{type:'REST'}},dead.revision)).toThrow();assertValidSliceState(dead);
  }finally{delete rolls[cursor];}
 },300_000);
});
