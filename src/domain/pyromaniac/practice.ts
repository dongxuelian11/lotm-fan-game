import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {PyromaniacCommand,PyromaniacActivityCommand,PyromaniacAction,PyromaniacProjection} from './types.js';
type Award=(source:string,amount:5|8|25)=>void;
const PRACTICES=[
 {id:'kiln-heat',title:'修补窑口的火候',story:'窑工米娅请你在砖砌练习炉前控制一小团本人凝聚的火焰。她把待烧的普通试片放在原炉台上，清开干草，手边留着沙桶。你必须按她说明缓缓加热；这不是凭空懂得制陶，也不替正式窑炉无限供能。',stat:'will' as const,cost:2,result:'你维持合适的火候，米娅实际检视原试片并收回。你记下了加热过快会开裂的限度。'},
 {id:'arc-target',title:'转过标杆的火球',story:'在指导者开放的砖砌训练院，原沙地上竖着一根不燃标杆，后方8米处是原砖挡墙。场内没有旁人。你凝聚并压缩一枚小火球，沿眼前空隙控制其弧线，落在指定沙地。8米与本次威力是G训练安排，不是原著极限或隔墙必中。',stat:'perception' as const,cost:3,result:'火球沿实际空隙飞行并在沙地终止，热痕留在原处。你没有把弧线攻击说成穿越砖墙。'},
 {id:'night-warmth',title:'渡口的片刻暖意',story:'夜班巡查员乔安等渡船时衣服受潮。他同意你在开放石台一侧维持一只小火鸦，保持与衣物的安全间隔；原船班照常，不能用温暖代替休息或治疗。你只练习这段有限持续控制，不召出拦下所有子弹的高阶火鸦群。',stat:'will' as const,cost:3,result:'你维持了这一小段温暖，船到后主动收束火鸦。乔安自行登船，衣物仍归本人，没有因一次取暖恢复全部健康。'},
] as const;
const ACTIVE=['PRACTICE','SURVEY_ENCOUNTER','CLEAR_LANE','ENCOUNTER_TALK','ENCOUNTER_FIGHT','REFLECT'];
export const isPyromaniacActivity=(c:PyromaniacCommand):c is PyromaniacActivityCommand=>ACTIVE.includes(c.type);
export const PYROMANIAC_STORY='仓房旁的公开砖院里，成年工人哈恩拿着短棍堵住原出口，坚持让库管艾娃再付一份无单据的通行费。艾娃站在安全的门廊，原棉布箱停在院边。你可以先看清环境并当面核对手续，再决定交涉或有风险的介入。火焰可能引燃附近货物，不能把所有场地都当空旷靶场。';
const source=(id:string)=>`pyromaniac-practice:${id}`;
function blocked(s:SliceState,c:PyromaniacActivityCommand):string|null{
 if(s.status!=='ACTIVE')return '当前周目已结束。';if(s.progression.pathwayId!=='hunter'||(s.progression.sequence!==7&&s.progression.sequence!==6))return '先成为纵火家。';
 if(s.activeEvent||s.combat)return '先处理当前事件或战斗。';if(s.world.city!=='BACKLUND')return '需本人返回贝克兰德。';if(s.health<=0||s.mind<=0)return '先休养恢复身体与精神。';if(s.actionsRemaining<1)return '需要1行动。';
 const m=s.pyromaniac,e=m.encounter;
 if(c.type==='PRACTICE'){const p=PRACTICES.find(x=>x.id===c.practiceId);return !p?'未知实践。':m.practices.includes(p.id)?'本项已经完成，不重复成长。':m.practiceAttempts[p.id]===s.week?'本周已经尝试，整理记录后下周再来。':s.spirituality<p.cost?`需要${p.cost}点灵性。`:null;}
 if(c.type==='REFLECT')return m.reflected?'已经反思本次实践。':m.practices.length!==PRACTICES.length||e.status!=='RESOLVED'?'先完成三次实践和本场争议。':null;
 if(e.status!=='AVAILABLE')return '原争议已有结果，不重开刷取。';
 if(c.type==='SURVEY_ENCOUNTER')return e.surveyed?'已亲见当前院落与原货物。':null;
 if(!e.surveyed)return '先亲自观察砖院、出口和附近货物。';
 if(c.type==='CLEAR_LANE')return e.safeLane?'艾娃已把自己的原布箱搬离射线。':null;
 if(c.type==='ENCOUNTER_TALK')return e.attemptWeek===s.week?'本周交涉没有奏效，下周再谈或明确承担介入风险。':null;
 return m.practices.length===0?'先完成一项有限火焰实践，确认基本控制。':null;
}
export function applyPyromaniacPractice(s:SliceState,c:PyromaniacActivityCommand,ctx:SeerContext,award:Award):void{
 const reason=blocked(s,c);if(reason)throw new Error(reason);s.actionsRemaining--;const m=s.pyromaniac,e=m.encounter;
 if(c.type==='PRACTICE'){const p=PRACTICES.find(x=>x.id===c.practiceId)!;m.practiceAttempts[p.id]=s.week;s.spirituality-=p.cost;const r=ctx.check(p.stat,14);if(r.tier==='SUCCESS'||r.tier==='GREAT_SUCCESS'){m.practices.push(p.id);s.progression.acting=Math.min(100,s.progression.acting+20);award(source(p.id),8);ctx.note(p.title,`${p.story} ${p.result} 扮演+20，已知能力中单项掌握+8。`);}else ctx.note(p.title,`${p.story} 本次控制不稳，你停止输出，指导者沿原安全办法收场。已花1行动与${p.cost}灵性，无成长奖励，下周可再尝试；没有自动恢复已耗灵性。`);return;}
 if(c.type==='SURVEY_ENCOUNTER'){e.surveyed=true;ctx.note('亲见砖院的火险',PYROMANIAC_STORY+' 你亲见到哈恩约6米处的空地前仍有艾娃的原棉布箱，不能安全施放本阶段火焰术。原出口与门廊正常可走，观察没有移动他人或物品。');return;}
 if(c.type==='CLEAR_LANE'){e.safeLane=true;ctx.note('原货物由原主人移开','你当面向艾娃说明射线旁的棉布风险。她同意，用自己的原手推车沿侧边普通路线将原箱移入砖墙隔开的库房并关上库门；所有权和保管人不变。眼前6米砖院射线现已清空，门廊里的艾娃不在射线上。此清场用掉1行动，没有直接伤害哈恩，也没有取得布箱。');return;}
 if(c.type==='REFLECT'){m.reflected=true;s.seer.completedSources.push('pyromaniac-reflection');s.progression.acting=Math.min(100,s.progression.acting+20);ctx.note('力量也需要选地方','你对照火候、弧线、持续输出和砖院风险，记下何时可以用火、何时应该停止。掌握火焰不意味着免疫火灾或能无条件保护所有人。扮演+20，仅一次。');return;}
 e.attemptWeek=s.week;
 if(c.type==='ENCOUNTER_TALK'){const r=ctx.check('will',14);if(r.tier==='SUCCESS'||r.tier==='GREAT_SUCCESS'){e.status='RESOLVED';s.progression.acting=Math.min(100,s.progression.acting+20);award('pyromaniac-dispute',8);ctx.note('库管按原手续离开','你与艾娃当面出示已付费用的原票据，哈恩最后让开。她沿公开出口离开并保管原货物；不使用火焰强制改写他的意愿。扮演+20，掌握+8。');}else ctx.note('哈恩没有让开','他拒绝承认票据，没有被直接控制。原院落与货物状态保留，下周可再谈，或明确承担战斗风险。');return;}
 e.status='FIGHTING';e.startHistoryIndex=s.combatHistory.length;s.combat={encounterId:'PYROMANIAC_DISPUTE',round:1,enemyHealth:100,enemyMind:100,enemyInjuries:[],enemyRisk:0,enemyStatus:'RESISTING',lastRound:null};ctx.note('砖院介入',PYROMANIAC_STORY+(e.safeLane?' 原货物已实际移开，砖院6米射线可用于本阶段有限火焰术。':' 原布箱尚在射线旁，本阶段火焰术不能安全使用，会回退为同次普通动作。')+' 你已花1行动走到院内，战斗可能导致受伤或死亡。');
}
export function pyromaniacActions(s:SliceState):PyromaniacAction[]{
 if(s.progression.pathwayId!=='hunter'||(s.progression.sequence!==7&&s.progression.sequence!==6))return [];
 const add=(id:string,label:string,cost:string,command:PyromaniacActivityCommand):PyromaniacAction=>{const reason=blocked(s,command);return{id,label,cost,command,reason,enabled:reason===null};};
 const a=PRACTICES.filter(p=>!s.pyromaniac.practices.includes(p.id)).map(p=>add(p.id,p.title,`1行动 · ${p.cost}灵性 · 难度14`,{type:'PRACTICE',practiceId:p.id}));
 if(s.pyromaniac.encounter.status==='AVAILABLE'){
  if(!s.pyromaniac.encounter.surveyed)a.push(add('pyro-survey','亲自查看砖院与原货物','1行动 · 取得眼前环境事实',{type:'SURVEY_ENCOUNTER'}));
  else {if(!s.pyromaniac.encounter.safeLane)a.push(add('pyro-clear','请库管沿原路移开原布箱','1行动 · 原主人实际搬运 · 不转移产权',{type:'CLEAR_LANE'}));a.push(add('pyro-talk','陪库管当面核对原票据','1行动 · 意志难度14',{type:'ENCOUNTER_TALK'}),add('pyro-fight','介入砖院争议','1行动 · 真实战斗风险 · 无自动战利品',{type:'ENCOUNTER_FIGHT'}));}
 }
 if(!s.pyromaniac.reflected)a.push(add('pyro-reflect','整理火焰使用边界','1行动 · 三实践与本场争议完成后',{type:'REFLECT'}));return a;
}
export function pyromaniacPractices(s:SliceState):PyromaniacProjection['practices']{if(s.progression.pathwayId!=='hunter'||(s.progression.sequence!==7&&s.progression.sequence!==6&&s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==1))return [];return [...PRACTICES.map(p=>({id:p.id,title:p.title,story:p.story,status:s.pyromaniac.practices.includes(p.id)?'已完成':s.pyromaniac.practiceAttempts[p.id]===s.week?'本周未成，下周重试':'尚未完成'})),{id:'pyromaniac-dispute',title:'原布箱旁的争议',story:PYROMANIAC_STORY,status:({AVAILABLE:'尚待处理',FIGHTING:'正在战斗',RESOLVED:'原争议已解决',RETREATED:'已退出，原争议未解决',LOST:'死亡，原争议未解决'} as const)[s.pyromaniac.encounter.status]}];}
export function pyromaniacEnvironment(s:SliceState):string{return !s.pyromaniac.encounter.surveyed?'砖院尚未亲自观察，火焰使用条件待现场确认。':s.pyromaniac.encounter.safeLane?'原布箱已由库管实际移入库房；6米砖院射线清空，旁人留在门廊。':'亲见原棉布箱靠近射线；应先请库管实际移开，当前战斗火焰术会回退为普通动作。';}
export function settlePyromaniacEncounter(s:SliceState,outcome:string,ctx:SeerContext,award:Award){if(outcome==='CONTINUE')return;const e=s.pyromaniac.encounter;e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';if(e.status==='RESOLVED'){s.progression.acting=Math.min(100,s.progression.acting+20);if(s.combatHistory.slice(e.startHistoryIndex??s.combatHistory.length).some(r=>r.retreat==='NONE'&&r.moves.some(m=>m.actor==='PLAYER'&&(m.selfGain>0||m.enemyReduction>0))))award('pyromaniac-dispute',25);}ctx.note('砖院争议结果',e.status==='RESOLVED'?'哈恩的抵抗结束。艾娃沿原出口离开并继续保管原货物，你没有获得战利品。扮演+20；实际有效战斗按已有规则给予单项掌握成长。':e.status==='RETREATED'?'你从公开出口实际退出。艾娃与原货物未被自动带走，原清场及已耗灵性保留。':'你已死亡，原争议未记作完成，也不发成长。');s.combat=null;}
export function validatePyromaniacPractice(s:SliceState):boolean{const m=s.pyromaniac;if(!m||!Array.isArray(m.practices)||!m.practiceAttempts||!m.encounter)return false;if(new Set(m.practices).size!==m.practices.length||m.practices.some(id=>!PRACTICES.some(p=>p.id===id)))return false;for(const p of PRACTICES)if(m.practices.includes(p.id)!==s.seer.completedSources.includes(source(p.id))||m.practices.includes(p.id)&&!Object.hasOwn(m.practiceAttempts,p.id))return false;if(Object.entries(m.practiceAttempts).some(([id,w])=>!PRACTICES.some(p=>p.id===id)||!Number.isSafeInteger(w)||w<(m.promotionWeek??1)||w>s.week))return false;if(m.encounter.safeLane&&!m.encounter.surveyed)return false;if((m.encounter.status==='FIGHTING')!==(s.combat?.encounterId==='PYROMANIAC_DISPUTE'))return false;if(m.encounter.status!=='AVAILABLE'&&(!m.encounter.surveyed||m.encounter.attemptWeek===null))return false;if(m.reflected!==s.seer.completedSources.includes('pyromaniac-reflection')||m.reflected&&(m.practices.length!==3||m.encounter.status!=='RESOLVED'))return false;if(m.encounter.startHistoryIndex!==null&&(m.encounter.startHistoryIndex<0||m.encounter.startHistoryIndex>s.combatHistory.length))return false;return true;}
