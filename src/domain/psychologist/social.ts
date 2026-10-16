import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {PsychologistCommand,PsychologistActivityCommand,PsychologistAction,PsychologistProjection} from './types.js';
type Award=(source:string,amount:5|8|25)=>void;
const CASES=[
 {id:'night-watch',title:'夜班后的敲门声',story:'成年守夜人伊凡在一次普通仓门事故后总被夜响惊醒。他本人来会所求助，同意先谈自己的感受，再决定是否接受一次安抚。你没有证据把事故诊断成超凡污染。',facts:['他反复看向门口，握杯的手轻颤。','他明确愿意接受有限安抚，也可以随时结束谈话。'],method:'SOOTHE' as const,result:'伊凡平静下来，自己决定请同事替一班，并在不适持续时继续寻求帮助。事故没有被抹去，也未自动治好身体。'},
 {id:'stage-fright',title:'开演前的一句话',story:'成年演员罗莎明天要第一次担任报幕。她不愿被强迫上台，但同意尝试一句事先商定的提示：先看熟悉的台口，再自己决定是否开口。',facts:['她在排练时能流畅说话，一提观众便捏紧袖口。','她只同意这一句有限提示，保留停止排练的选择。'],method:'SUGGEST' as const,result:'罗莎自己复述了提示，并选择先做一段短排练。她没有失去拒绝正式演出的权利。'},
 {id:'unsettled-letter',title:'没有拆开的信',story:'成年抄写员埃伦收到亲人的来信，一直不敢拆开。他同意借会所原有的摆坠作为媒介，只谈此刻对读信的担忧；信件始终由他保管，内容没有向你开放。',facts:['原信封握在他本人手中，仍未拆开。','他愿意交流眼下的一小段念头，不同意搜索过去记忆。'],method:'COMMUNICATE' as const,result:'埃伦亲自核实你理解的担忧，选择在可信朋友陪伴时自行读信。信件和决定都仍归本人。'},
];
export const PSYCHOLOGIST_ENVIRONMENT='会所提供安静谈话间与原摆坠，成年当事人自行前来、自行离开。安抚可能失败，谈话和精神影响不能净化污染、复活或保证治愈；所有成本与成长数值为G。';
export const isPsychologistActivity=(c:PsychologistCommand):c is PsychologistActivityCommand=>['OBSERVE','SUPPORT','DISCUSS','REFER','WITHDRAW','REFLECT','OBSERVE_ENCOUNTER','ENCOUNTER_TALK','ENCOUNTER_FIGHT'].includes(c.type);
function blocked(s:SliceState,c:PsychologistActivityCommand):string|null{
 if(s.status!=='ACTIVE')return '当前周目已结束。';if(s.progression.pathwayId!=='audience'||(s.progression.sequence!==7&&s.progression.sequence!==6))return '先成为心理医生。';if(s.combat||s.activeEvent)return '先处理当前事件或战斗。';
 const row='caseId'in c?s.psychologist.cases[c.caseId]:null;
 if('caseId'in c&&!row)return '未知当事人。';
 if(c.type==='WITHDRAW')return row!.consent&&row!.status!=='RESOLVED'?null:'当前没有待结束的同意。';
 if(s.world.city!=='BACKLUND')return '需本人返回贝克兰德。';if(s.health<=0||s.mind<=0)return '先休养恢复身体与精神。';if(s.actionsRemaining<1)return '需要1行动。';
 if(row){if(row.status==='RESOLVED')return '原谈话已有结果，不重复发放成长。';
  if(c.type==='OBSERVE')return row.consent?'已有本次有限同意，可实践或结束。':null;
  if(!row.consent)return '先当面倾听，取得本人本次有限同意。';
  if(c.type==='SUPPORT')return row.status==='SUPPORTED'?'本次实践已成，先由本人核实。':row.attemptWeek===s.week?'本周已尝试，休整后下周再来。':CASES.find(x=>x.id===c.caseId)!.method!==c.method?'本人未同意这种方式。':s.spirituality<3?'需要3点灵性。':null;
  if(c.type==='DISCUSS')return row.status!=='SUPPORTED'?'先完成本人同意的有限实践，或选择转介。':row.attemptWeek===s.week?'本周已尝试，下一周再核实。':null;
  return null;
 }
 const e=s.psychologist.encounter;
 if(c.type==='REFLECT')return s.psychologist.reflected?'已完成反思。':Object.values(s.psychologist.cases).some(r=>r.status!=='RESOLVED')?'先完成三位当事人的原谈话。':null;
 if(e.status!=='AVAILABLE')return '原威胁已有结果，不重新刷取。';
 if(c.type==='OBSERVE_ENCOUNTER')return e.observed?'已亲见当前威胁与公开出口。':null;
 if(!e.observed)return '先亲自查看门厅威胁。';
 return c.type==='ENCOUNTER_TALK'&&e.attemptWeek===s.week?'本周交涉未成，下周再试或承担介入风险。':null;
}
export function applyPsychologistSocial(s:SliceState,c:PsychologistActivityCommand,ctx:SeerContext,award:Award):void{
 const reason=blocked(s,c);if(reason)throw new Error(reason);const m=s.psychologist;
 if(c.type==='WITHDRAW'){m.cases[c.caseId]!.consent=false;ctx.note('结束本次谈话','你停止精神影响并把会所媒介放回原处，当事人自行离开。既有记录、费用和灵性消耗保留；以后重新当面询问同意。');return;}
 s.actionsRemaining--;
 if('caseId'in c){const r=m.cases[c.caseId]!,p=CASES.find(x=>x.id===c.caseId)!;
  if(c.type==='OBSERVE'){r.consent=true;if(r.status==='AVAILABLE')r.status='OBSERVED';ctx.note(p.title,p.story+' '+p.facts.join(' '));return;}
  if(c.type==='SUPPORT'){s.spirituality-=3;r.attemptWeek=s.week;const check=ctx.check(c.method==='COMMUNICATE'?'perception':'will',14);if(check.tier==='SUCCESS'||check.tier==='GREAT_SUCCESS'){r.status='SUPPORTED';r.method=c.method;r.supportWeek=s.week;if(c.method==='SOOTHE')r.mind=Math.min(100,r.mind+15);if(c.method==='COMMUNICATE')r.readSummary='经本人同意，本次交流到的浅层片段：担心无法回应亲人的期待；信内文字和过去记忆仍未知。';ctx.note('有限实践完成',c.method==='SOOTHE'?'伊凡的紧张暂时缓和（G精神状态+15），仍需本人后续核实；没有恢复健康或清除污染。':c.method==='SUGGEST'?'罗莎接受了事先约定的一句提示，仍可自主拒绝演出；没有删去她的决定。':'你借原摆坠完成本次有限交流，随后收回术式、放回摆坠；只记录本人允许的当前片段。');}else ctx.note('本次没有奏效','你停止施术，向本人说明未成。已花1行动与3灵性，无成长或新思想记录；下周可再试，也可结束或转介。');return;}
  if(c.type==='DISCUSS'){r.attemptWeek=s.week;const check=ctx.check('knowledge',12);if(check.tier!=='SUCCESS'&&check.tier!=='GREAT_SUCCESS'){ctx.note('还需要继续谈','本人认为你的理解还不准确，没有被强迫接受。保留已知记录，下周再核实或转介。');return;}}
  if(c.type==='REFER')r.method='REFER';r.status='RESOLVED';r.consent=false;s.progression.acting=Math.min(100,s.progression.acting+25);award(`psychologist-case:${p.id}`,8);ctx.note(p.title,c.type==='REFER'?'本人接受你提供的会所指导者介绍，自行前往继续面谈。没有自动痊愈或透露信件、过去记忆。扮演+25，已知能力单项掌握+8。':p.result+' 扮演+25，已知能力单项掌握+8。');return;
 }
 if(c.type==='REFLECT'){m.reflected=true;s.seer.completedSources.push('psychologist-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('帮助不是替人作决定','你对照三人的不同选择，承认精神影响的限度，也把自己与扮演角色区分开。扮演+25；不需要战斗即可完成本阶段消化。');return;}
 const e=m.encounter;
 if(c.type==='OBSERVE_ENCOUNTER'){e.observed=true;ctx.note('门厅里的威胁','成年布莱斯持普通短棍威胁会所管理员。你亲见他清醒、愤怒，没有眼前可辨认的超凡精神防护；这不是全知鉴定。旁人已自行避到侧室，公开普通出口可走。可以交涉或自行承担战斗风险。');return;}
 e.attemptWeek=s.week;
 if(c.type==='ENCOUNTER_TALK'){const check=ctx.check('will',14);if(check.tier==='SUCCESS'||check.tier==='GREAT_SUCCESS'){e.status='RESOLVED';award('psychologist-dispute',8);ctx.note('布莱斯接受对账','你提出由管理员当面核对账单。布莱斯自行收起短棍，没有被无条件控制；不计额外扮演。');}else ctx.note('交涉未成','布莱斯仍拒绝对账。你未改变他的记忆，也未取得他的物品；可以离开，下周再谈或承担战斗风险。');return;}
 e.status='FIGHTING';e.startHistoryIndex=s.combatHistory.length;s.combat={encounterId:'PSYCHOLOGIST_DISPUTE',round:1,enemyHealth:100,enemyMind:100,enemyInjuries:[],enemyRisk:0,enemyStatus:'RESISTING',lastRound:null};ctx.note('门厅介入','你走入原门厅制止持棍威胁。精神影响可能被抵抗，普通打击仍可致伤或死亡；原公开出口可尝试撤离，旁人不自动同行。');
}
export function psychologistActions(s:SliceState):PsychologistAction[]{if(s.progression.pathwayId!=='audience'||(s.progression.sequence!==7&&s.progression.sequence!==6))return [];const out:PsychologistAction[]=[];const add=(id:string,label:string,cost:string,command:PsychologistActivityCommand)=>{const reason=blocked(s,command);out.push({id,label,cost,command,reason,enabled:reason===null});};
 for(const p of CASES){const r=s.psychologist.cases[p.id]!;if(r.status==='RESOLVED')continue;if(!r.consent)add(`${p.id}-observe`,'当面倾听并询问同意','1行动',{type:'OBSERVE',caseId:p.id});else{if(r.status!=='SUPPORTED')add(`${p.id}-support`,p.method==='SOOTHE'?'按本人同意进行安抚':p.method==='SUGGEST'?'给出约定的一句提示':'借原媒介交流当前担忧','1行动 · 3灵性 · 难度14',{type:'SUPPORT',caseId:p.id,method:p.method});else add(`${p.id}-discuss`,'请本人核实并决定下一步','1行动 · 知识难度12',{type:'DISCUSS',caseId:p.id});add(`${p.id}-refer`,'经本人同意转介指导者','1行动 · 不保证治愈',{type:'REFER',caseId:p.id});add(`${p.id}-withdraw`,'结束本次谈话','0行动 · 原消耗保留',{type:'WITHDRAW',caseId:p.id});}}
 if(!s.psychologist.reflected)add('psych-reflect','整理三次帮助的边界','1行动 · 三人谈话完成后',{type:'REFLECT'});
 if(s.psychologist.encounter.status==='AVAILABLE'){if(!s.psychologist.encounter.observed)add('psych-observe-encounter','查看门厅的持棍威胁','1行动',{type:'OBSERVE_ENCOUNTER'});else{add('psych-talk','请当事人当面对账','1行动 · 意志难度14',{type:'ENCOUNTER_TALK'});add('psych-fight','介入门厅威胁','1行动 · 真实战斗风险',{type:'ENCOUNTER_FIGHT'});}}return out;
}
export function psychologistScenes(s:SliceState):PsychologistProjection['scenes']{if(s.progression.pathwayId!=='audience'||(s.progression.sequence!==7&&s.progression.sequence!==6&&s.progression.sequence!==5&&s.progression.sequence!==4&&s.progression.sequence!==3&&(s.progression.sequence!==2&&s.progression.sequence!==1)))return [];return [...CASES.map(p=>{const r=s.psychologist.cases[p.id]!;return{id:p.id,title:p.title,story:p.story,observations:r.status==='AVAILABLE'?[]:[...p.facts],impression:r.readSummary,status:r.status,consent:r.consent};}),{id:'psychologist-dispute',title:'门厅里的持棍威胁',story:'布莱斯与管理员争执。可先观察后交涉，也可退出或承担介入风险；三位自愿当事人的成长不要求此战。',observations:s.psychologist.encounter.observed?['布莱斯清醒持棍，旁人避开；原公开出口可走。']:[],impression:null,status:s.psychologist.encounter.status,consent:false}];}
export function settlePsychologistEncounter(s:SliceState,outcome:string,ctx:SeerContext,award:Award){if(outcome==='CONTINUE')return;const e=s.psychologist.encounter;e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';if(e.status==='RESOLVED'&&s.combatHistory.slice(e.startHistoryIndex??s.combatHistory.length).some(r=>r.retreat==='NONE'&&r.moves.some(m=>m.actor==='PLAYER'&&(m.selfGain>0||m.enemyReduction>0))))award('psychologist-dispute',25);ctx.note('门厅威胁的结果',e.status==='RESOLVED'?'布莱斯的抵抗结束。原物仍由原人保管，精神伤害不自动变成死亡或肉体损伤。有效战斗按原规则给予一次已知能力成长。':e.status==='RETREATED'?'你沿公开出口离开，没有自动带走旁人或物品，原威胁未记为解决。':'你已死亡，原威胁未记为解决，也没有成长奖励。');s.combat=null;}
export function validatePsychologistSocial(s:SliceState):boolean{const m=s.psychologist;if(!m?.cases||!m.encounter)return false;for(const p of CASES){const r=m.cases[p.id];if(!r)return false;if((r.status==='RESOLVED')!==s.seer.completedSources.includes(`psychologist-case:${p.id}`))return false;if(r.status==='RESOLVED'&&r.consent)return false;if(r.status==='SUPPORTED'&&(r.supportWeek===null||r.method!==p.method))return false;if(r.readSummary!==null&&(p.method!=='COMMUNICATE'||r.supportWeek===null||r.readSummary!=='经本人同意，本次交流到的浅层片段：担心无法回应亲人的期待；信内文字和过去记忆仍未知。'))return false;if(r.mind!==(p.id==='night-watch'?40+(r.supportWeek===null?0:15):p.id==='stage-fright'?55:50))return false;}
 if(m.reflected!==s.seer.completedSources.includes('psychologist-reflection')||m.reflected&&Object.values(m.cases).some(r=>r.status!=='RESOLVED'))return false;const e=m.encounter;if((e.status==='FIGHTING')!==(s.combat?.encounterId==='PSYCHOLOGIST_DISPUTE'))return false;if(e.status!=='AVAILABLE'&&(!e.observed||e.attemptWeek===null))return false;if(e.startHistoryIndex!==null&&e.startHistoryIndex>s.combatHistory.length)return false;return true;}
