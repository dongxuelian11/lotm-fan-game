import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { resolveThunderGodCombatRound } from '../../src/domain/slice/thunder-god-combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { CATASTROPHE_COUNT_WHEEL } from '../../src/domain/catastrophe/combat.js';
import { createThunderGodLifeState } from '../../src/domain/thunder-god/life.js';
import { createThunderGodEncounterState, applyThunderGodEncounterCommand, validateThunderGodEncounter,
  validateThunderGodEncounterCommand, projectThunderGodEncounter, settleThunderGodEncounter,
  thunderGodEncounterOriginalEvents, thunderGodCompletedBudgetMatches, thunderGodEncounterBudget,
  thunderGodFinanceSnapshot, blockThunderGodEncounter, type ThunderGodEncounterCommand, type ThunderGodPolicy } from '../../src/domain/thunder-god/encounter.js';
import { GUIDED_THUNDER, STORM_BRACE, THUNDER_GOD_INHERITED_SKILL_IDS, THUNDER_GOD_NEW_ABILITY_IDS,
  THUNDER_GOD_COUNT_WHEEL, THUNDER_GOD_ENEMY_COUNT_WHEEL, THUNDER_GOD_ENEMY_ABILITY_WHEEL, THUNDER_GOD_COMBAT_CONSTANTS,
  thunderGodActionCount, thunderGodAbilityWheel, drawThunderGodEnemyAbility, currentThunderGodCombatSource,
  createThunderGodRuntime, declareThunderGodEnemyAction, resolveThunderGodPlayerSlot, resolveThunderGodEnemySlot,
  advanceThunderGodCombatClock, resolveThunderGodConsequences, replayThunderGodCombatRound,
  validThunderGodCombatSource, validateThunderGodCombatRound, validateThunderGodRoundOutcome,
  nextThunderGodCombatSource, type ThunderGodCombatSource } from '../../src/domain/thunder-god/combat.js';

const path='tests/fixtures/catastrophe-v01710/original-enemy-approach.json';
const naturalPath='tests/fixtures/catastrophe-v01710/natural.json';
/** Real historical fixture migration; raw version and hash remain independent
 * assertions. This isolated unit setup never changes a natural campaign. */
function original():SliceState{return migrateSliceState(readObjectEntry<SliceState>(path,'beforeLast'));}
function context(s:SliceState):SeerContext{return{roll(){throw new Error('Encounter commands must not draw.');},check(){throw new Error('Encounter commands must not check.');},note(title,text){s.chronicle.push({id:`record-${s.revision+1}-${s.chronicle.length}`,week:s.week,title,text});}};}
function readyUnit():SliceState {
 const s=original();s.progression.sequence=1;s.thunderGod.promotionWeek=s.week;
 for(const id of THUNDER_GOD_NEW_ABILITY_IDS)s.progression.mastery[id]=0;
 s.thunderGod.life=createThunderGodLifeState();s.thunderGod.life.reflected=true;
 s.thunderGod.encounter=createThunderGodEncounterState();return s;
}
function encounter(s:SliceState,c:ThunderGodEncounterCommand):SliceState{applyThunderGodEncounterCommand(s,c,context(s));s.revision++;return s;}
function fighting(policy:ThunderGodPolicy='ALL'):SliceState {
 const s=readyUnit();encounter(s,{type:'ENCOUNTER_TALK'});encounter(s,{type:'ENCOUNTER_POLICY',policy});encounter(s,{type:'ENCOUNTER_FIGHT'});
 expect(validateThunderGodEncounter(s)).toBe(true);return s;
}
function source(policy:ThunderGodPolicy='ALL'):ThunderGodCombatSource{const x=currentThunderGodCombatSource(fighting(policy));if(!x)throw new Error('Missing unit encounter source.');expect(validThunderGodCombatSource(x)).toBe(true);return x;}
function random(...values:number[]):ActionRandomStream{let i=0;return{get cursor(){return i;},nextInt(min:number,max:number){const n=values[i++]??100;if(n<min||n>max)throw new Error(`Bad isolated draw ${n} outside ${min}..${max}`);return n;}};}
function tickRound(s:SliceState,stance:'ATTACK'|'CONTROL'|'RETREAT'='CONTROL'){
 const result=resolveThunderGodCombatRound(s,stance);s.combatHistory.push(result.round);
 if(result.outcome!=='CONTINUE'){settleThunderGodEncounter(s,result.outcome,context(s));if(result.outcome==='PLAYER_DEAD')s.status='DEAD';}
 s.revision++;return result;
}

describe('Thunder God exact independent original source',()=>{
 it('keeps raw source hashes/schema, the living599 boundary and original602 death separate',()=>{
  expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe('3ee5d4bfb9582aabb88a477bd5f0b5a47c335e8dbe5074b0eafbafff35d8b448');
  expect(createHash('sha256').update(readFileSync(naturalPath)).digest('hex')).toBe('cb8649c4d3dc15b5fa61601591eaed3f99579082f01bffa4f566afbf7ed8dc53');
  const raw=readObjectEntry<SliceState>(path,'beforeLast');expect(raw).toMatchObject({schemaVersion:168,contentVersion:'catastrophe-v168',revision:600,week:138,status:'ACTIVE',health:100,mind:100,spirituality:120,cash:350,actionsRemaining:3,random:{seed:'sailor-natural-v026',cursor:267},character:{name:'托林',gender:'FEMALE',age:26,coreStats:{physique:34,perception:27,will:27,knowledge:21}}});
  expect(readObjectEntry<unknown[]>(naturalPath,'commands')).toHaveLength(602);const dead=migrateSliceState(readObjectEntry<SliceState>(naturalPath,'final'));expect(dead.status).toBe('DEAD');expect(dead.health).toBe(0);expect(blockThunderGodEncounter(dead,{type:'ENCOUNTER_TALK'})).not.toBeNull();
 });
 it('retains all22 original mastery values including7 zeros and all eight old roots',()=>{
  const old=original(),s=readyUnit();expect(THUNDER_GOD_INHERITED_SKILL_IDS).toHaveLength(22);expect(THUNDER_GOD_INHERITED_SKILL_IDS.filter(id=>s.progression.mastery[id]===0)).toHaveLength(7);
  for(const id of THUNDER_GOD_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(old.progression.mastery[id]);for(const id of THUNDER_GOD_NEW_ABILITY_IDS)expect(s.progression.mastery[id]).toBe(0);
  for(const key of ['sailor','rager','navigator','windBlessed','oceanSinger','cataclysmPriest','seaKing','catastrophe'] as const)expect(s[key]).toEqual(old[key]);
  expect(s.catastrophe.life.site).toMatchObject({id:'CT2-COVE',clockSeconds:123,playerPosition:'EXIT',playerTravelMetres:12,keeper:{energy:88,travelMetres:36,position:'CONTROL'},water:{originalUnits:20,bayUnits:20,channelUnits:0},gate:{position:'CLOSED',durability:96,operations:4}});
 });
 it('uses exact inherited count boundaries, actual displayed enemy wheel and unchanged strength model',()=>{
  expect(THUNDER_GOD_COUNT_WHEEL).toBe(CATASTROPHE_COUNT_WHEEL);expect(THUNDER_GOD_ENEMY_COUNT_WHEEL).toBe(CATASTROPHE_COUNT_WHEEL);expect(THUNDER_GOD_COUNT_WHEEL.map(x=>x.weight)).toEqual([10,15,25,25,15,10]);
  for(const [roll,count]of [[1,1],[10,1],[11,2],[25,2],[26,3],[50,3],[51,4],[75,4],[76,5],[90,5],[91,6],[100,6]])expect(thunderGodActionCount(roll!)).toBe(count);
  expect(THUNDER_GOD_COMBAT_CONSTANTS).toMatchObject({weights:{physique:.35,perception:.25,will:.25,knowledge:.15},tier:1250,floor:125,maxSpirituality:120,continuingRecovery:12,slotSeconds:5,roundSeconds:60});
  expect(THUNDER_GOD_ENEMY_ABILITY_WHEEL.map(x=>[x.id,x.weight])).toEqual([['LIGHTNING',25],['WIND_WARD',20],['SEA_SONG',20],['BODY_STRIKE',20],['OBSCURE',10],['ACCIDENT',5]]);
  let boundary=0;for(const entry of THUNDER_GOD_ENEMY_ABILITY_WHEEL){const first=boundary+1;boundary+=entry.weight;expect(drawThunderGodEnemyAbility(random(first))).toBe(entry.id);expect(drawThunderGodEnemyAbility(random(boundary))).toBe(entry.id);}
  expect(thunderGodAbilityWheel(readyUnit(),null).reduce((n,a)=>n+a.weight,0)).toBeCloseTo(100);
 });
 it('walks4m to independent48-year-old Oren, demands policy and keeps all adults out',()=>{
  const s=readyUnit(),site=structuredClone(s.catastrophe.life.site);expect(()=>encounter(s,{type:'ENCOUNTER_FIGHT'})).toThrow();encounter(s,{type:'ENCOUNTER_TALK'});expect(()=>encounter(s,{type:'ENCOUNTER_FIGHT'})).toThrow();
  const p=projectThunderGodEncounter(s);expect(p.enemy).toMatchObject({id:'TG1-OREN-GAGE',age:48,sequence:1,health:100,mind:100,spirituality:120});expect(p.scene).toMatchObject({playerLocation:'PLATFORM',playerCoordinate:4,enemyCoordinate:6,clockSeconds:4,playerTravelMetres:4,presentMemberIds:[]});expect(p.materials.weapon).toMatchObject({id:'TG1-OREN-ROD',owner:'TG1-OREN-GAGE',massKg:2,charge:4});expect(p.materials.screen).toMatchObject({hood:'OPEN',durability:100,operations:0});
  encounter(s,{type:'ENCOUNTER_POLICY',policy:'ORDINARY'});encounter(s,{type:'LEAVE_ENCOUNTER'});expect(s.thunderGod.encounter.scene).toMatchObject({playerLocation:'OUTSIDE',playerCoordinate:0,clockSeconds:8,playerTravelMetres:8});expect(validateThunderGodEncounter(s)).toBe(true);expect(s.catastrophe.life.site).toEqual(site);expect(thunderGodEncounterOriginalEvents(s)).toEqual([]);expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('rejects present adults, forged original target/history, future data and extra command fields',()=>{
  for(const mutate of [(s:SliceState)=>{s.thunderGod.life.keeperPresent=true;},(s:SliceState)=>{s.thunderGod.life.finn.present=true;},(s:SliceState)=>{s.thunderGod.life.playerLocation='EXIT';}]){const s=readyUnit();mutate(s);expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();}
  for(const c of [{type:'ENCOUNTER_POLICY',policy:'ALL',extra:true},{type:'ENCOUNTER_FIGHT',target:'CT2-VAIL'},{type:'BUY_BATTLE_PLATE'}])expect(validateThunderGodEncounterCommand(c)).toBe(false);
  for(const mutate of [(x:ThunderGodCombatSource)=>{(x as unknown as {targetId:string}).targetId='CT2-VAIL';},(x:ThunderGodCombatSource)=>{x.mastery['tyrant.s9.aquatic-affinity']=1;},(x:ThunderGodCombatSource)=>{x.materials.weapon.charge=3;},(x:ThunderGodCombatSource)=>{x.root.presentMemberIds.push('CT2-NORA');},(x:ThunderGodCombatSource)=>{x.preparation.week=x.week+1;},(x:ThunderGodCombatSource)=>{x.randomSeed='replacement';},(x:ThunderGodCombatSource)=>{x.materials.screen.operations++;}]){const x=source();mutate(x);expect(validThunderGodCombatSource(x)).toBe(false);}
  const s=fighting();s.thunderGod.encounter.originalHistory![0]!.playerAdvantage++;expect(validateThunderGodEncounter(s)).toBe(false);
 });
});

describe('future-only finite windows with real player costs',()=>{
 it('opens guided thunder with no immediate reward and adds30 to one subsequent threatening attack',()=>{
  const x=source(),r=createThunderGodRuntime(x),old=resolveThunderGodPlayerSlot(x,r,'STRIKE',0,random()),copy=structuredClone(old),open=resolveThunderGodPlayerSlot(x,r,GUIDED_THUNDER,1,random(1,100));
  expect(open).toMatchObject({paidCost:8,mindCost:2,selfGain:0,enemyReduction:0,finiteResult:'PENDING',check:{ability:'perception',difficulty:18},elapsedSeconds:5});expect(r.mastery).toEqual(x.mastery);
  const block=resolveThunderGodPlayerSlot(x,r,'BLOCK',2,random());expect(block.masteryApplied).toEqual([]);expect(r.windows.guidedThunder).not.toBeNull();
  const next=resolveThunderGodPlayerSlot(x,r,'STRIKE',3,random());expect(next.selfGain).toBe(next.rawContribution+30);expect(next.masteryApplied).toEqual([GUIDED_THUNDER]);expect(old).toEqual(copy);expect(r.windows.guidedThunder).toBeNull();expect(resolveThunderGodPlayerSlot(x,r,'STRIKE',4,random()).selfGain).toBe(next.rawContribution);
 });
 it('does not turn a failed later inherited attack into a successful application',()=>{
  const x=source(),r=createThunderGodRuntime(x);resolveThunderGodPlayerSlot(x,r,GUIDED_THUNDER,0,random(1,100));expect(resolveThunderGodPlayerSlot(x,r,'tyrant.s4.great-lightning',1,random(100))).toMatchObject({paidCost:6,selfGain:0,finiteResult:'FAILED',masteryApplied:[]});expect(r.mastery).toEqual(x.mastery);advanceThunderGodCombatClock(r,30);expect(r.windows.guidedThunder).toBeNull();
 });
 it('failed and resisted openings pay once; same-round retries and insufficiency cannot farm rolls',()=>{
  for(const rolls of [[100],[1,30]]){const x=source(),r=createThunderGodRuntime(x),a=resolveThunderGodPlayerSlot(x,r,GUIDED_THUNDER,0,random(...rolls));expect(a).toMatchObject({paidCost:8,mindCost:2});expect(['FAILED','RESISTED']).toContain(a.finiteResult);expect(r.windows.guidedThunder).toBeNull();expect(r.mastery).toEqual(x.mastery);expect(resolveThunderGodPlayerSlot(x,r,GUIDED_THUNDER,1,random())).toMatchObject({finiteResult:'ALREADY_ATTEMPTED',paidCost:0,selectedAbility:'BLOCK'});}
  const x=source(),r=createThunderGodRuntime(x);r.playerS=7;expect(resolveThunderGodPlayerSlot(x,r,GUIDED_THUNDER,0,random())).toMatchObject({finiteResult:'INSUFFICIENT',paidCost:0,mindCost:0});expect(r.body.guidedThunderAttempts).toBe(0);r.playerS=120;r.playerM=2;expect(resolveThunderGodPlayerSlot(x,r,GUIDED_THUNDER,1,random()).paidCost).toBe(0);
 });
 it('brace cannot open without a declared visible BODY or against MENTAL',()=>{
  const x=source(),r=createThunderGodRuntime(x);expect(resolveThunderGodPlayerSlot(x,r,STORM_BRACE,0,random())).toMatchObject({finiteResult:'UNAVAILABLE',paidCost:0});declareThunderGodEnemyAction(x,r,'SEA_SONG',0);expect(resolveThunderGodPlayerSlot(x,r,STORM_BRACE,1,random()).paidCost).toBe(0);expect(resolveThunderGodEnemySlot(x,r,'SEA_SONG',2,random(100))).toMatchObject({selfGain:65,attackKind:'MENTAL',mentalPressure:true,threatens:false});expect(r.mastery).toEqual(x.mastery);
 });
 it('brace pays6S2M then reduces exactly one visible later BODY by30',()=>{
  const x=source(),r=createThunderGodRuntime(x);declareThunderGodEnemyAction(x,r,'LIGHTNING',0);expect(resolveThunderGodPlayerSlot(x,r,STORM_BRACE,0,random(1,100))).toMatchObject({paidCost:6,mindCost:2,finiteResult:'PENDING',check:{ability:'will',difficulty:18}});expect(r.mastery).toEqual(x.mastery);
  expect(resolveThunderGodEnemySlot(x,r,'LIGHTNING',1,random(100))).toMatchObject({selfGain:75,rawContribution:105,rodChargeSpent:1,masteryApplied:[STORM_BRACE]});expect(resolveThunderGodEnemySlot(x,r,'LIGHTNING',2,random(100)).selfGain).toBe(105);expect(r.mastery[STORM_BRACE]).toBe(x.mastery[STORM_BRACE]!+8);
 });
 it('failed/resisted brace retains costs; resisted incoming BODY consumes no successful guard credit',()=>{
  for(const rolls of [[100],[1,1]]){const x=source(),r=createThunderGodRuntime(x);declareThunderGodEnemyAction(x,r,'LIGHTNING',0);expect(resolveThunderGodPlayerSlot(x,r,STORM_BRACE,0,random(...rolls))).toMatchObject({paidCost:6,mindCost:2});expect(resolveThunderGodEnemySlot(x,r,'LIGHTNING',1,random(100)).selfGain).toBe(105);expect(r.mastery).toEqual(x.mastery);}
  const x=source(),r=createThunderGodRuntime(x);declareThunderGodEnemyAction(x,r,'LIGHTNING',0);resolveThunderGodPlayerSlot(x,r,STORM_BRACE,0,random(1,100));expect(resolveThunderGodEnemySlot(x,r,'LIGHTNING',1,random(30))).toMatchObject({selfGain:0,paidCost:7,rodChargeSpent:1,finiteResult:'RESISTED',masteryApplied:[]});expect(r.windows.stormBrace).toBeNull();expect(r.mastery).toEqual(x.mastery);
 });
 it('expiry, condition changes, obscuration and departure invalidate windows without refunds',()=>{
  for(const change of [(r:ReturnType<typeof createThunderGodRuntime>)=>advanceThunderGodCombatClock(r,30),(r:ReturnType<typeof createThunderGodRuntime>)=>{r.root.conditionVersion++;},(r:ReturnType<typeof createThunderGodRuntime>)=>{r.root.visibleBodyLine=false;},(r:ReturnType<typeof createThunderGodRuntime>)=>{r.root.playerLocation='OUTSIDE';r.root.playerCoordinate=0;}]){
   const x=source(),r=createThunderGodRuntime(x);resolveThunderGodPlayerSlot(x,r,GUIDED_THUNDER,0,random(1,100));change(r);expect(resolveThunderGodPlayerSlot(x,r,'STRIKE',1,random()).masteryApplied).toEqual([]);expect(r.mastery).toEqual(x.mastery);expect(r.playerS).toBe(x.playerSpirituality-8);
  }
  const x=source(),r=createThunderGodRuntime(x);declareThunderGodEnemyAction(x,r,'LIGHTNING',0);resolveThunderGodPlayerSlot(x,r,STORM_BRACE,0,random(1,100));advanceThunderGodCombatClock(r,30);expect(resolveThunderGodEnemySlot(x,r,'LIGHTNING',1,random(100)).selfGain).toBe(105);expect(r.mastery).toEqual(x.mastery);
 });
 it('the same original hood actually closes and can be walked to and opened, without reopening old windows',()=>{
  const x=source(),r=createThunderGodRuntime(x);resolveThunderGodPlayerSlot(x,r,GUIDED_THUNDER,0,random(1,100));expect(resolveThunderGodEnemySlot(x,r,'OBSCURE',1,random())).toMatchObject({paidCost:3,conditionVersionBefore:1,conditionVersionAfter:2,travelPath:[6,5,6]});expect(r.windows.guidedThunder).toBeNull();expect(r.materials.screen.hood).toBe('CLOSED');
  expect(resolveThunderGodPlayerSlot(x,r,'tyrant.s4.great-lightning',2,random())).toMatchObject({finiteResult:'UNAVAILABLE',paidCost:0});const before=r.root.playerTravelMetres;expect(resolveThunderGodPlayerSlot(x,r,'OBSERVE',3,random())).toMatchObject({travelMetres:2,travelPath:[4,5,4]});expect(r.root).toMatchObject({playerCoordinate:4,playerTravelMetres:before+2,visibleBodyLine:true,conditionVersion:3,observedConditionVersion:3});expect(r.materials.screen).toMatchObject({id:'TG1-OREN-SCREEN',hood:'OPEN',operations:2});expect(r.windows.guidedThunder).toBeNull();expect(resolveThunderGodEnemySlot(x,r,'OBSCURE',4,random())).toMatchObject({selectedAbility:'OBSERVE',paidCost:0});
 });
 it('ordinary/inherited-only policies preserve the explicit permission boundary',()=>{
  for(const policy of ['ORDINARY','INHERITED_ONLY'] as const){const x=source(policy),r=createThunderGodRuntime(x);declareThunderGodEnemyAction(x,r,'LIGHTNING',0);for(const id of [GUIDED_THUNDER,STORM_BRACE])expect(resolveThunderGodPlayerSlot(x,r,id,0,random())).toMatchObject({paidCost:0,selectedAbility:'BLOCK'});expect(r.mastery).toEqual(x.mastery);}
 });
});

describe('actual original resources, injuries and deterministic recorded outcomes',()=>{
 it('old sample-free powers pay real original costs and gain only on actual successful application',()=>{
  const x=source(),r=createThunderGodRuntime(x),id='tyrant.s4.great-lightning';expect(resolveThunderGodPlayerSlot(x,r,id,0,random(100))).toMatchObject({paidCost:6,selfGain:0,finiteResult:'FAILED',masteryApplied:[]});expect(r.mastery[id]).toBe(x.mastery[id]);
  const applied=resolveThunderGodPlayerSlot(x,r,id,1,random(1,100));expect(applied.paidCost).toBe(6);expect(applied.selfGain).toBe(38*(.65+.35*x.mastery[id]!/500));expect(applied.masteryApplied).toEqual([id]);expect(r.mastery[id]).toBe(x.mastery[id]!+8);
  for(const id of ['tyrant.s2.storm-field','tyrant.s2.water-pressure','tyrant.s3.sea-domain','tyrant.s6.short-flight','tyrant.s9.aquatic-affinity'] as const)expect(resolveThunderGodPlayerSlot(x,r,id,2,random())).toMatchObject({paidCost:0,selfGain:0,masteryApplied:[],selectedAbility:'OBSERVE'});
 });
 it('uses a club only if genuinely HAND, and never supplies an item for free',()=>{
  const x=source(),r=createThunderGodRuntime(x);expect(resolveThunderGodPlayerSlot(x,r,'STRIKE',0,random()).selfGain).toBe(x.clubHeld?16:12);expect(Object.keys(r.materials).sort()).toEqual(['screen','weapon']);expect(Object.keys(r.materials.weapon)).not.toContain('player');
 });
 it('spends all4 original rod charges even on resistance, then falls back with the same body/rod',()=>{
  const x=source(),r=createThunderGodRuntime(x);for(let n=0;n<4;n++)expect(resolveThunderGodEnemySlot(x,r,'LIGHTNING',n,random(30)).rodChargeSpent).toBe(1);expect(r.materials.weapon.charge).toBe(0);expect(r.body.enemySpirituality).toBe(92);expect(resolveThunderGodEnemySlot(x,r,'LIGHTNING',4,random())).toMatchObject({selectedAbility:'BODY_STRIKE',paidCost:0,rodChargeSpent:0,travelPath:[6,4,6],travelMetres:4});expect(r.materials.weapon.id).toBe('TG1-OREN-ROD');
 });
 it('enemy ward6, song7 and obscure3 are finite; depleted spirituality never regenerates',()=>{
  const x=source(),r=createThunderGodRuntime(x);expect(resolveThunderGodEnemySlot(x,r,'WIND_WARD',0,random(100))).toMatchObject({paidCost:6,enemyReduction:60});expect(resolveThunderGodEnemySlot(x,r,'SEA_SONG',1,random(100))).toMatchObject({paidCost:7,selfGain:65,attackKind:'MENTAL'});expect(resolveThunderGodEnemySlot(x,r,'OBSCURE',2,random()).paidCost).toBe(3);expect(r.body.enemySpirituality).toBe(104);advanceThunderGodCombatClock(r,60);expect(r.body.enemySpirituality).toBe(104);r.body.enemySpirituality=0;expect(resolveThunderGodEnemySlot(x,r,'SEA_SONG',3,random())).toMatchObject({selectedAbility:'BODY_STRIKE',paidCost:0});
 });
 it('MENTAL loss cannot create a body wound or body risk; true health death remains terminal',()=>{
  const x=source(),r=createThunderGodRuntime(x),mental=resolveThunderGodEnemySlot(x,r,'SEA_SONG',0,random(100)),m=resolveThunderGodConsequences(x,r,[],[mental],'ENEMY','NONE',random());expect(m).toMatchObject({playerHealth:x.playerHealth,playerRisk:x.playerRisk,playerInjuries:x.playerInjuries,consequenceDomain:'MENTAL',consequenceWeights:null,consequenceRoll:undefined,outcome:'CONTINUE'});expect(r.playerM).toBe(x.playerMind-10);
  const exhausted=createThunderGodRuntime(x);exhausted.playerM=10;const e=resolveThunderGodEnemySlot(x,exhausted,'SEA_SONG',0,random(100));expect(resolveThunderGodConsequences(x,exhausted,[],[e],'ENEMY','NONE',random()).outcome).toBe('RETREATED');expect(exhausted.playerM).toBe(0);expect(exhausted.playerH).toBe(100);
  const dying=createThunderGodRuntime(x),body=resolveThunderGodEnemySlot(x,dying,'BODY_STRIKE',0,random());expect(resolveThunderGodConsequences(x,dying,[],[body],'ENEMY','NONE',random(100))).toMatchObject({playerHealth:0,outcome:'PLAYER_DEAD',consequenceDomain:'BODY',consequenceWeights:{light:65,heavy:30,death:5}});
 });
 it('replays exact source/cursor/cost/action order and rejects forged outcomes or future records',()=>{
  const x=source(),before=structuredClone(x),result=replayThunderGodCombatRound(x,'CONTROL'),o=result.round.thunderGodOutcome!;expect(x).toEqual(before);expect(validateThunderGodCombatRound(result.round)).toBe(true);expect(validateThunderGodRoundOutcome(o)).toBe(true);expect(o.windowsAfter).toEqual({guidedThunder:null,stormBrace:null});expect(o.rootAfter.clockSeconds).toBe(x.root.clockSeconds+60);
  const actions=[...o.playerActions,...o.enemyActions].sort((a,b)=>a.order-b.order);expect(actions.map(a=>a.order)).toEqual(actions.map((_a,i)=>i));expect(actions.map(a=>a.atSeconds)).toEqual(actions.map((_a,i)=>4+5*i));expect(actions.every(a=>a.elapsedSeconds===5)).toBe(true);expect(result.round.moves.map(a=>a.actor)).toEqual(actions.map(a=>a.actor));
  for(const mutate of [(v:typeof o)=>{v.randomCursorAfter++;},(v:typeof o)=>{v.playerSpiritualityAfter++;},(v:typeof o)=>{v.materialsAfter.weapon.charge++;},(v:typeof o)=>{v.rootAfter.playerTravelMetres++;},(v:typeof o)=>{v.source.preparation.week++;}]){const forged=structuredClone(o);mutate(forged);expect(validateThunderGodRoundOutcome(forged)).toBe(false);}
  if(o.continuing){const next=nextThunderGodCombatSource(o);expect(next.playerSpirituality).toBe(Math.min(120,o.playerSpiritualityAfter+12));expect(next.body.enemySpirituality).toBe(o.enemySpirituality);expect(validThunderGodCombatSource(next)).toBe(true);}
 });
 it('ordinary open-route retreat reaches a real terminal4m exit without altering the original bay or history',()=>{
  const s=fighting(),old=original(),history=structuredClone(s.combatHistory),result=tickRound(s,'RETREAT');expect(result.outcome).toBe('RETREATED');expect(s.combat).toBeNull();expect(validateThunderGodEncounter(s)).toBe(true);expect(s.combatHistory.slice(0,history.length)).toEqual(history);expect(s.catastrophe).toEqual(old.catastrophe);expect(thunderGodEncounterOriginalEvents(s)).toEqual([]);
  const e=s.thunderGod.encounter,o=s.combatHistory.at(-1)!.thunderGodOutcome!;expect(e.terminal).toMatchObject({outcome:'RETREATED',exitMetres:4,exitSeconds:4});expect(e.scene.playerTravelMetres).toBe(o.rootAfter.playerTravelMetres+4);expect(e.scene.clockSeconds).toBe(o.rootAfter.clockSeconds+4);expect(e.scene.playerLocation).toBe('OUTSIDE');expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('fixed original-seed CONTROL reaches actual terminal without resetting people, mastery or injuries',()=>{
  const s=fighting(),old=original(),history=structuredClone(s.combatHistory);let rounds=0;
  while(s.combat&&rounds++<64){tickRound(s);expect(validateThunderGodEncounter(s)).toBe(true);}
  expect(s.combat).toBeNull();expect(s.thunderGod.encounter.terminal).not.toBeNull();expect(s.combatHistory.slice(0,history.length)).toEqual(history);expect(s.catastrophe).toEqual(old.catastrophe);expect(thunderGodEncounterOriginalEvents(s)).toEqual([]);
  const e=s.thunderGod.encounter,o=s.combatHistory.at(-1)!.thunderGodOutcome!,prep=e.preparation!;
  for(const id of THUNDER_GOD_INHERITED_SKILL_IDS)expect(s.progression.mastery[id]).toBe(Math.min(500,prep.after.mastery[id]!+8*(e.inheritedApplications[id]??0)));
  expect(e.scene.playerTravelMetres).toBe(o.rootAfter.playerTravelMetres+(s.health>0?4:0));expect(e.scene.clockSeconds).toBe(o.rootAfter.clockSeconds+(s.health>0?4:0));expect(e.scene.playerLocation).toBe(s.health>0?'OUTSIDE':'PLATFORM');expect(()=>encounter(s,{type:'ENCOUNTER_TALK'})).toThrow();
 });
 it('zero-AP arrival can cleanly leave then replay exact shared weekly finance',()=>{
  const s=readyUnit();s.actionsRemaining=1;encounter(s,{type:'ENCOUNTER_TALK'});expect(s.actionsRemaining).toBe(0);expect(blockThunderGodEncounter(s,{type:'LEAVE_ENCOUNTER'})).toBeNull();expect(blockThunderGodEncounter(s,{type:'ENCOUNTER_FIGHT'})).not.toBeNull();expect(validateThunderGodEncounter(s)).toBe(true);
  encounter(s,{type:'LEAVE_ENCOUNTER'});const entry=s.thunderGod.encounter.journal.at(-1)!,expected=thunderGodEncounterBudget(s),finance=thunderGodFinanceSnapshot(s),week=s.week,date={...s.date};
  const transition=resolveSliceWeeklyFinance({...finance,cash:expected.cash,week,revision:s.revision-1,pulse:'BILL',billAmount:0});expect(transition.eventId).toBeNull();const final=transition.state;s.cash=final.cash;s.debts=structuredClone(final.debts);s.missedWeeks=final.missedWeeks;s.credit=final.credit;s.nextLifeTier=final.nextLifeTier;s.lifeTier=final.nextLifeTier;s.week++;s.date=addGameWeeks(date,1);s.actionsRemaining=finance.weeklyBudget;s.pulse='NONE';s.billAmount=0;
  for(const receipt of transition.receipts)s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week,...receipt});s.chronicle.push({id:`record-${s.revision}-${s.chronicle.length}`,week:s.week,title:'新的一周',text:`日期推进7天，本周${finance.weeklyBudget}次行动。`});
  expect(thunderGodCompletedBudgetMatches(s,expected,finance,week,date,entry.revision,entry.randomCursor,'沿普通路和平离开干平台')).toBe(true);expect(validateThunderGodEncounter(s)).toBe(true);const forged=structuredClone(s);forged.cash++;expect(validateThunderGodEncounter(forged)).toBe(false);
 });
});
