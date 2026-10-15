import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const continuing=true;
const firstHunt=continuing?JSON.parse(readFileSync('tests/fixtures/silver-knight-v01520/first-hunt.json','utf8')):null;
const old=JSON.parse(readFileSync('tests/fixtures/demon-hunter-v01290/natural.json','utf8'));
const creation=old.creation,seed=old.seed,provenance={kind:'SAME_SEED_PUBLIC_NATURAL_PREFIX',source:'tests/fixtures/demon-hunter-v01290/natural.json',newRandomChanges:false};
let s=JSON.parse(readFileSync('tests/fixtures/silver-knight-v01520/natural.json','utf8')).final;
const initial=structuredClone(s),commands=[],prefixCount=old.commands.length,boundaries={};
let beforeLast=null,lastIntent=null,departureStart=null,guidanceStart=null,prepared=null,promoted=null,practiced=null,combatStart=null,prefixVerified=true;
const root='tests/fixtures/silver-knight-v01520',oldRoots=['warrior','gladiator','weaponmaster','dawnPaladin','guardian','demonHunter'];
const species=['ROCK_HUSK','EMBER_WING','MIST_ANTLER','THORN_SHADOW','RESONANT_BONE','FROST_SPINE'];
const slots=['NORTH','NORTH_EAST','SOUTH_EAST','SOUTH','SOUTH_WEST','NORTH_WEST'];
mkdirSync(root,{recursive:true});mkdirSync('output/play',{recursive:true});
function originals(){for(const key of oldRoots)assert.deepEqual(s[key],old.final[key],`Original ${key}`);assert.equal(s.random.seed,seed);assert.equal(s.character.gender,old.final.character.gender);}
function capture(key){if(prefixVerified&&key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};}
function go(intent,key=null){assert(commands.length<3000,'Retain actual unfinished branch');beforeLast=structuredClone(s);lastIntent=structuredClone(intent);s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(structuredClone(intent));capture(key);if(prefixVerified)console.log(JSON.stringify({step:commands.length,command:intent,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,sequence:s.progression.sequence,acting:s.progression.acting}));}
const sk=(command,key=null)=>go({type:'SILVER_KNIGHT',command},key);
function clear(){for(let i=0;s.activeEvent&&i<20;i++){const e=projectSliceState(s).activeEvent;const choiceId=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?(s.cash>=60?'PAY':'DECLINE'):e.id==='CARE-WORK-OFFER'?'DECLINE':null;assert(choiceId,`Unexpected event ${e.id}`);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});}assert.equal(s.activeEvent,null);}
function ordinary(key=null){assert.equal(s.status,'ACTIVE');clear();assert(!s.combat&&!projectSliceState(s).silverKnight.insideCase);go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'},key);clear();}
function ready({ap=1,cash=0,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}){clear();while(s.actionsRemaining<ap||s.cash<cash||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek)ordinary();}
function action(command,key=null){ready();sk(command,key);clear();}
const current=speciesId=>s.silverKnight.encounter.hunts.filter(h=>h.speciesId===speciesId).at(-1);
function battle(key){combatStart??=structuredClone(s);for(let i=0;s.combat&&i<100;i++)go({type:'COMBAT_ROUND',stance:s.health<=40||s.mind<=20?'RETREAT':i===0&&!continuing?'CONTROL':'ATTACK'},i===0?`${key}-first`:null);assert.equal(s.combat,null);capture(`${key}-terminal`);originals();}
function hunt(speciesId){
 let b=current(speciesId);const key=speciesId.toLowerCase();
 if(b.status==='SURRENDERED'||s.silverKnight.encounter.remains.find(r=>r.id===b.remainsId)?.status==='CONSUMED')ready({afterWeek:Math.max(b.attempts.at(-1)?.week??0,s.silverKnight.encounter.remains.find(r=>r.id===b.remainsId)?.consumedWeek??0)});
 if(b.status==='UNSEEN'||b.status==='SURRENDERED'||s.silverKnight.encounter.remains.find(r=>r.id===b.remainsId)?.status==='CONSUMED')action({type:'INVESTIGATE_HUNT',speciesId},`${key}-investigate`);
 b=current(speciesId);if(b.resources.preparationWeek===null){ready({cash:120});sk({type:'PREPARE_HUNT',speciesId},`${key}-prepare`);clear();}
 ready({health:100,mind:100,spirituality:120,pollution:0});sk({type:'HUNT_FIGHT',speciesId},`${key}-fight`);battle(key);
 if(s.status!=='ACTIVE')return false;
 b=current(speciesId);if(b.status==='DEAD')action({type:'COLLECT_REMAINS',speciesId},`${key}-remains`);
 return !!current(speciesId).remainsId;
}
function buy(){let bottle=s.silverKnight.bottles.find(b=>b.status==='PLAYER')??s.silverKnight.bottles.find(b=>b.status==='SUPPLIER');
 if(!bottle){action({type:'REQUEST_SUPPLY'},'request-supply');ready({afterWeek:s.silverKnight.resupply.requestedWeek});sk({type:'RECEIVE_SUPPLY'},'receive-next-week-supply');bottle=s.silverKnight.bottles.find(b=>b.status==='SUPPLIER');}
 assert(bottle);const bottleId=bottle.id;
 if(bottle.status==='SUPPLIER'){while(s.silverKnight.bottles.find(b=>b.id===bottleId).labourSteps<5){const n=s.silverKnight.bottles.find(b=>b.id===bottleId).labourSteps+1;action({type:'POTION_WORK',bottleId},n===5?'potion-work-5':null);}ready({cash:1040});const cash=s.cash;sk({type:'BUY_POTION',bottleId},'buy-independent-potion');assert.equal(s.cash,cash-900);}
 return bottleId;
}
function ritual(bottleId){
 ready({ap:2,cash:140,health:100,mind:100,spirituality:120,pollution:0,afterWeek:Math.max(s.demonHunter.promotionWeek+11,s.silverKnight.ritual.meetings.at(-1)?.requestedWeek??-1)});
 for(const type of ['RITUAL_REQUEST_MEETING','RITUAL_GO_MEETING','RITUAL_SHOW_RECORDS','RITUAL_SEEK_BLESSING','RITUAL_RETURN_DOOR'])sk({type},type.toLowerCase());
 if(!s.silverKnight.ritual.meetings.at(-1).blessing)return false;
 sk({type:'RITUAL_GO_ALTAR'});
 for(const [i,speciesId]of species.entries()){const remains=s.silverKnight.encounter.remains.find(r=>r.speciesId===speciesId&&r.status==='OWNER_PLAYER');assert(remains);sk({type:'RITUAL_PLACE_REMAINS',remainsId:remains.id,slotId:slots[i]},`place-${speciesId.toLowerCase()}`);}
 sk({type:'PREPARE_PROMOTION'},'prepare-current-week');prepared=structuredClone(s);sk({type:'CONSUME',bottleId,confirmed:true});capture(s.progression.sequence===3?'promotion':'consume-failure');originals();return s.progression.sequence===3;
}
function practice(caseId){
 ready({ap:2,spirituality:6});sk({type:'PREPARE',caseId,method:'ABILITY'});sk({type:'PERFORM',caseId});
 const step=(type,key=null)=>sk({type,caseId},key);
 for(const type of ['CONSENT_OWNER','TAKE_ITEM','GO_SITE','CONSENT_OBSERVER'])step(type);
 const succeeded=()=>['SUCCESS','GREAT_SUCCESS'].includes(s.silverKnight.life.cases[caseId].attempts.at(-1).abilityTier);
 if(caseId==='armor-load'){step('WEAR_PAD');step('FORM_ARMOR','armor-ability');step('APPLY_LOAD','armor-load');step('STOP_EFFECT');step('REMOVE_PAD');}
 else if(caseId==='light-check'){step('PLACE_LAMP');step('LIGHT_LAMP');step('CONCEAL','light-ability');step('CHECK_VISIBILITY','light-check');step('EXTINGUISH');step('RECOVER_LAMP');}
 else{step('SIGHT_TARGET');step('SILVER_THRUST','thrust-ability');step('OPEN_SIDE_DOOR');step('WALK_TARGET');if(!succeeded())step('MARK_TARGET');step('VERIFY_TARGET','thrust-verify');step('RETURN_FROM_TARGET');step('CLOSE_SIDE_DOOR');}
 step('RETURN_PLAYER');step('RETURN_ITEM',`${caseId}-return`);step('INSPECT');step('CLOSE');
}
function save(stage){const data={provenance,creation,seed,initial,commands,prefixCount,stage,departureStart,guidanceStart,prepared,promoted,practiced,combatStart,beforeLast,lastIntent,final:s};writeFileSync(`${root}/natural.json`,JSON.stringify(data));writeFileSync(`${root}/boundaries.json`,JSON.stringify(boundaries));writeFileSync('output/play/silver-knight-stage-natural.json',JSON.stringify(data));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/silver-knight-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,stage,commands:commands.length,prefixCount,week:s.week,status:s.status,H:s.health,M:s.mind,S:s.spirituality,sequence:s.progression.sequence,remains:s.silverKnight.encounter.remains,hunts:s.silverKnight.encounter.hunts.map(h=>({id:h.id,status:h.status,H:h.enemyHealth,S:h.resources.enemySpirituality})),boundaries:Object.keys(boundaries)}));}
const segments=[];let directedStart=null,directedCommandOffset=0;
function selected(intent,predicate,reason){
 const cursorBefore=s.random.cursor;let selectedState=null;
 for(let offset=0;offset<5000;offset++){
  const candidate=structuredClone(s);candidate.random.cursor=cursorBefore+offset;
  const next=applySliceIntent(candidate,intent);
  if(predicate(next)){selectedState=candidate;break;}
 }
 assert(selectedState,`Directed outcome unavailable: ${reason}`);s=selectedState;assertValidSliceState(s);
 const before=structuredClone(s);go(intent);segments.push({commandIndex:commands.length-1,beforeLast:before,lastIntent:intent,final:structuredClone(s),reason,cursorBefore,selectedCursor:before.random.cursor});capture(`directed-${segments.length}`);
}
try{
 departureStart=structuredClone(s);guidanceStart=null;
 for(const speciesId of species){
  let b=current(speciesId);if(b.status==='SURRENDERED')ready({afterWeek:b.attempts.at(-1).week});
  action({type:'INVESTIGATE_HUNT',speciesId});ready({cash:120});sk({type:'PREPARE_HUNT',speciesId});ready({health:100,mind:100,spirituality:120,pollution:0});sk({type:'HUNT_FIGHT',speciesId});
  selected({type:'COMBAT_ROUND',stance:'ATTACK'},n=>n.combat===null&&n.silverKnight.encounter.hunts.find(h=>h.id===b.id)?.status==='DEAD'||n.combat===null&&n.silverKnight.encounter.hunts.filter(h=>h.speciesId===speciesId).at(-1).status==='DEAD',`${speciesId}: explicit RNG selection to exercise actual death/remains branch, not natural play`);
  assert.equal(s.status,'ACTIVE');action({type:'COLLECT_REMAINS',speciesId},`directed-${speciesId.toLowerCase()}-collect`);originals();
 }
 const bottleId=s.silverKnight.bottles.find(b=>b.status==='PLAYER').id;
 ready({ap:2,cash:140,health:100,mind:100,spirituality:120,pollution:0,afterWeek:s.demonHunter.promotionWeek+11});
 for(const type of ['RITUAL_REQUEST_MEETING','RITUAL_GO_MEETING','RITUAL_SHOW_RECORDS'])sk({type});
 selected({type:'SILVER_KNIGHT',command:{type:'RITUAL_SEEK_BLESSING'}},n=>!!n.silverKnight.ritual.meetings.at(-1).blessing,'explicit directed favorable angel response');
 sk({type:'RITUAL_RETURN_DOOR'});sk({type:'RITUAL_GO_ALTAR'});
 for(const [i,speciesId]of species.entries()){const r=s.silverKnight.encounter.remains.find(r=>r.speciesId===speciesId&&r.status==='OWNER_PLAYER');sk({type:'RITUAL_PLACE_REMAINS',remainsId:r.id,slotId:slots[i]});}
 sk({type:'PREPARE_PROMOTION'});prepared=structuredClone(s);
 selected({type:'SILVER_KNIGHT',command:{type:'CONSUME',bottleId,confirmed:true}},n=>n.progression.sequence===3,'explicit directed successful dose after six real resolved death transitions');
 directedStart=structuredClone(segments.at(-1).beforeLast);directedCommandOffset=commands.length-1;promoted=structuredClone(s);
 for(const caseId of ['armor-load','light-check','partition-thrust']){action({type:'OBSERVE',caseId});practice(caseId);action({type:'REPORT',caseId});}
 action({type:'REFLECT'},'directed-reflection');practiced=structuredClone(s);
 ready({ap:2,health:100,mind:100,spirituality:120});sk({type:'ENCOUNTER_TALK'});capture('directed-post-talk');sk({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);battle('directed-post');if(s.status==='ACTIVE')ordinary('directed-ordinary-after-exit');
 const provenance='DIRECTED: six explicit RNG-cursor selections for actual combat death branches plus angel response and dose success. No natural advancement claim. Every selected boundary and subsequent public transition is preserved; old natural two surrendered bodies stay alive.';
 writeFileSync(`${root}/directed-setup.json`,JSON.stringify({provenance,startingState:initial,commands,adjustments:segments.map(x=>({commandIndex:x.commandIndex,cursorBefore:x.cursorBefore,selectedCursor:x.selectedCursor,reason:x.reason})),final:s}));
 writeFileSync(`${root}/directed-segments.json`,JSON.stringify({provenance,segments}));writeFileSync(`${root}/directed.json`,JSON.stringify({provenance,startingState:directedStart,commands:commands.slice(directedCommandOffset),promoted,practiced,combatStart,final:s}));
 writeFileSync(`${root}/directed-boundaries.json`,JSON.stringify(boundaries));
 for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/silver-knight-${k}-save-boundary.json`,JSON.stringify(b));
 console.log(JSON.stringify({passed:true,provenance,segments:segments.length,commands:commands.length,directedCommands:commands.length-directedCommandOffset,week:s.week,status:s.status,H:s.health,M:s.mind,S:s.spirituality,sequence:s.progression.sequence,acting:s.progression.acting}));
}catch(error){writeFileSync('output/play/silver-knight-directed-blocker.json',JSON.stringify({startingState:directedStart,commands,directedCommandOffset,segments,prepared,promoted,practiced,beforeLast,lastIntent,final:s,boundaries,error:String(error),stack:error.stack}));throw error;}
