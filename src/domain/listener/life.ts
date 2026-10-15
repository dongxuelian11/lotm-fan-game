import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { ListenerCommand, ListenerActivityCommand, ListenerAction, ListenerProjection } from './types.js';
const CASES=[
 {id:'wall-knock',title:'敲击与那句指认',story:'伊森把一张旧接触记录放在侧室桌上：前次记有“敲击者就在门后”这一未署来源的片段。侧室窗栓松动，窗扇确会碰墙；原门通向有灯的外间，两处均能普通往返。本次可以短暂倾听，也可以只核对旧记录与窗扇。',facts:['前次记录只有一句未核实指认，没有当事人或身份佐证。','原松窗能产生敲击；门后有人的说法尚未证实。'],listen:'在侧室作一次短暂有限倾听，只记实际辨到的片段；结束后沿原门退到外间，再核对窗扇。',ordinary:'用普通方式抄录前次记录，观察原松窗，不主动接入耳语。',result:'你保留了本次有限记录；声音、前次纸面指认与眼前敲击不能自动合成同一来源。',verification:'你和伊森实际检查原窗：窗扇碰墙能重现敲击，没有找到门后人的可靠证据。那句指认仍未证明。',outcome:'KNOCK_CHECKED'},
 {id:'broken-phrase',title:'残句中的空白',story:'管理员保存的接触纸只有“第三盏……之前”几个字，中间被水渍毁掉，原登记者没有留下日期。原抄写桌与外间相连。你可以短暂倾听并记下是否辨到片段，也可以普通比对原纸、编号和收件簿；缺项不能靠愿望补全。',facts:['原句不完整，日期和所指对象均缺失。','原收件簿只记收到残纸，没有登记任何已经兑现的预言。'],listen:'只作一段有限倾听；即使听出“第三盏”等片段，也不补出缺失时刻、对象或答案。',ordinary:'逐项核对原纸与收件簿，保留缺字，不接入新的声音。',result:'你取得可保留的有限片段记录；缺失对象与日期仍未出现，不新增法术或预言。',verification:'原收件簿和残纸互相比对后，仍无法确认“第三盏”的对象和时间。此次没有足以兑现指令的完整信息。',outcome:'FRAGMENT_RETAINED'},
 {id:'room-exit',title:'退到有灯的外间',story:'原铜片仍归伊森，放在侧室罩下。他约定一次短时接触，自己守在通往外间的原门旁。倾听后需要明确离开侧室；普通方法则由他保管铜片，你只核对门口记录。撤出当前接触能结束这段实践，不能保证以后不再受到外在影响。',facts:['原铜片仍由管理员保管，原门实际开放且通向约定外间。','本次只同意短暂接触；离开当前现场不是永久免疫。'],listen:'作一次有限接触并记录辨识程度，然后沿原开放门回到外间，不继续追随未核实指令。',ordinary:'在外间核对管理员留下的接触起止记录，不主动倾听。',result:'本次起止与所得有限迹象已经记下；没有获得能永久关闭所有危险声音的保证。',verification:'你和伊森对照原起止记录，确认本次已停止接触。后续风险仍未知，不能把暂时缓和写成彻底消除。',outcome:'DISTANCE_CHECKED'},
]as const;
export const LISTENER_ENVIRONMENT='倾听者能听见对应隐秘存在的耳语，但本阶段所得片段不自动成为真相或能力。三处接触与普通退路、有限成本和核实规则是G原创；不设五年必死倒计时，不以现实心理症状判断污染。退出本次接触不保证永久免疫。';
export const listenerInside=(s:SliceState)=>Object.values(s.listener.cases).some(r=>r.contactOpen);
export const isListenerActivity=(c:ListenerCommand):c is ListenerActivityCommand=>['OBSERVE','PREPARE','PERFORM','LEAVE','VERIFY','REPORT','WITHDRAW','REFLECT'].includes(c.type);
function blocked(s:SliceState,c:ListenerActivityCommand):string|null{
 if(s.status!=='ACTIVE')return'当前周目已结束。';
 if(s.progression.pathwayId!=='hanged-man'||s.progression.sequence!==8)return'先完成倾听者晋升。';
 const r='caseId'in c?s.listener.cases[c.caseId]:null;
 if(c.type==='LEAVE')return r?.contactOpen?null:'没有尚待退出的本次接触。';
 if(listenerInside(s))return'先0行动沿原门退到外间，结束本次接触。';
 if(s.activeEvent||s.combat)return'先处理当前事件或战斗。';
 if(s.world.city!=='BACKLUND')return'需要回到伊森管理的原旧物间。';
 if(c.type==='WITHDRAW')return r?.status==='PREPARED'?null:'没有待取消的准备。';
 if(s.health<=0||s.mind<=0)return'先休养恢复身体与精神。';
 if(s.actionsRemaining<1)return'需要1行动。';
 if(c.type==='REFLECT')return s.listener.reflected?'已经回看本次经历。':CASES.some(p=>s.listener.cases[p.id]?.status!=='RESOLVED')?'先如实完成三项核实报告。':null;
 if(!r)return'未知接触现场。';if(r.status==='RESOLVED')return'这项核对已经结束。';
 if(c.type==='OBSERVE')return r.status==='AVAILABLE'?null:'原观察已经保留。';
 if(c.type==='PREPARE')return r.status!=='OBSERVED'?'先观察当前原记录与实际退路。':r.attemptWeek===s.week?'本周未成，下周可以重新准备。':null;
 if(c.type==='VERIFY')return r.status!=='EXAMINED'?'先完成本次有限尝试并退出接触。':r.verified?'已经完成这次普通核对。':null;
 if(c.type==='REPORT')return r.status!=='EXAMINED'||!r.verified?'先以原记录或现场事实实际核对，再提交结论。':null;
 if(r.status!=='PREPARED')return'先选择有限倾听或普通方法。';
 if(r.method==='LISTEN'&&s.spirituality<2)return'短暂倾听需要2灵性；可以0行动取消准备，改用普通核对。';
 return null;
}
export function applyListenerActivity(s:SliceState,c:ListenerActivityCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void){
 const reason=blocked(s,c);if(reason)throw new Error(reason);const m=s.listener;
 if(c.type==='LEAVE'){m.cases[c.caseId]!.contactOpen=false;ctx.note('实际退出本次接触','你沿原开放门回到有灯的外间；若暂时无力，守门的伊森按事前约定协助这一段退出。本次接触停止，原铜片与记录留在原处。0行动，不抽签、不退成本、不治疗，不保证永久隔绝外在影响。');return;}
 if(c.type==='WITHDRAW'){const r=m.cases[c.caseId]!;r.status='OBSERVED';r.method=null;r.withdrawals++;ctx.note('取消尚未开始的接触准备','0行动取消，原记录与已花行动保留，没有发生倾听或虚构收获。');return;}
 s.actionsRemaining--;
 if(c.type==='REFLECT'){m.reflected=true;s.seer.completedSources.push('listener-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('让耳语接受核实','辨到声音不等于掌握全部真相。你保留片段、实际核对并知道何时退出，不用填满未知来证明自己。扮演+25。');return;}
 const p=CASES.find(p=>p.id===c.caseId)!,r=m.cases[c.caseId]!;
 if(c.type==='OBSERVE'){r.status='OBSERVED';ctx.note(p.title,p.story+' '+p.facts.join(' '));return;}
 if(c.type==='PREPARE'){r.status='PREPARED';r.method=c.method;ctx.note(p.title,c.method==='LISTEN'?p.listen:p.ordinary);return;}
 if(c.type==='VERIFY'){r.verified=true;ctx.note('用原物和记录核对',p.verification+' 本次普通核实实际耗1行动，不抽额外神秘签。');return;}
 if(c.type==='REPORT'){if(c.claim==='CERTAIN'){r.overclaims++;ctx.note('片段不能证明全部','你把未核实部分写成确定指令；伊森指出缺项依旧存在。这次行动已花，过度结论保留，不奖扮演或掌握，可以如实改正。');return;}r.status='RESOLVED';s.progression.acting=Math.min(100,s.progression.acting+25);award(`listener-case:${p.id}`,8);ctx.note(p.title,p.verification+(r.overclaims?'先前过度结论已更正，原记录保留。':'')+'如实报告，扮演+25、已知能力单项掌握+8。');return;}
 r.attemptWeek=s.week;const listen=r.method==='LISTEN';if(listen){s.spirituality-=2;r.contactOpen=true;}
 const result=ctx.check(listen?'will':'knowledge',listen?12:10);
 if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){r.status='EXAMINED';r.outcome=p.outcome;ctx.note(p.title,p.result+(r.contactOpen?'先沿原门退出本次接触，再作普通核实。':'接下来实际核对原物与记录。'));}
 else{r.status='OBSERVED';if(result.tier==='GREAT_FAILURE')s.mind=Math.max(0,s.mind-5);ctx.note(p.title,'本次没有辨出足够可靠的片段，未知仍保留。'+(result.tier==='GREAT_FAILURE'?(listen?'本场虚构外来干扰造成短时压力，精神损失至多5；不是现实心理诊断。':'核对劳累，精神损失至多5。'):'')+(r.contactOpen?'仍须0行动沿原门退出接触。':'')+'已花成本保留，下周可以重试。');}
}
export function listenerActions(s:SliceState):ListenerAction[]{if(s.progression.pathwayId!=='hanged-man'||s.progression.sequence!==8)return[];const out:ListenerAction[]=[];const add=(id:string,label:string,cost:string,command:ListenerActivityCommand)=>{const reason=blocked(s,command);out.push({id,label,cost,command,enabled:reason===null,reason});};for(const p of CASES){const r=s.listener.cases[p.id]!;if(r.contactOpen)add(p.id+'-leave','沿原门退到外间，结束本次接触','0行动 · 不保证永久免疫',{type:'LEAVE',caseId:p.id});if(r.status==='AVAILABLE')add(p.id+'-observe','核对原记录与普通退路','1行动',{type:'OBSERVE',caseId:p.id});if(r.status==='OBSERVED'){add(p.id+'-listen','准备短暂有限倾听','1行动 · 实际倾听另耗2灵性',{type:'PREPARE',caseId:p.id,method:'LISTEN'});add(p.id+'-ordinary','准备普通核对','1行动 · 实际核对不耗灵性',{type:'PREPARE',caseId:p.id,method:'ORDINARY'});}if(r.status==='PREPARED'){add(p.id+'-perform',r.method==='LISTEN'?'实际倾听有限片段':'实际整理本次记录',r.method==='LISTEN'?'1行动 · 2灵性':'1行动 · 不耗灵性',{type:'PERFORM',caseId:p.id});add(p.id+'-withdraw','取消这次准备','0行动 · 原成本保留',{type:'WITHDRAW',caseId:p.id});}if(r.status==='EXAMINED'){if(!r.verified)add(p.id+'-verify','以原物与原记录实际核实','1行动 · 不把耳语直接当真相',{type:'VERIFY',caseId:p.id});else{add(p.id+'-limited',r.overclaims?'更正为有限结论':'保留未明部分，如实报告','1行动',{type:'REPORT',caseId:p.id,claim:'LIMITED'});add(p.id+'-certain','声称得到完整指令','1行动 · 缺项仍在，不能证明',{type:'REPORT',caseId:p.id,claim:'CERTAIN'});}}}if(!s.listener.reflected)add('listener-reflect','回看倾听与核实的区别','1行动 · 三项报告后',{type:'REFLECT'});return out;}
export function listenerCases(s:SliceState):ListenerProjection['cases']{if(s.progression.pathwayId!=='hanged-man')return[];return CASES.map(p=>{const r=s.listener.cases[p.id]!;return{id:p.id,title:p.title,story:p.story,observations:r.status==='AVAILABLE'?[]:[...p.facts],preparation:r.status==='PREPARED'?(r.method==='LISTEN'?p.listen:p.ordinary):null,result:['EXAMINED','RESOLVED'].includes(r.status)?(r.verified?p.verification:p.result):r.attemptWeek!==null?'此前未成，不补出未知片段。':r.withdrawals?'本次准备已取消。':null,status:r.status,contactOpen:r.contactOpen?'仍在本次接触中：先沿原门退出':'没有尚待退出的接触',verified:r.verified,overclaims:r.overclaims};});}
export function validateListenerLife(s:SliceState):boolean{const m=s.listener;if(!m?.cases)return false;for(const p of CASES){const r=m.cases[p.id];if(!r)return false;if((r.status==='RESOLVED')!==s.seer.completedSources.includes(`listener-case:${p.id}`))return false;if(['EXAMINED','RESOLVED'].includes(r.status)){if(r.attemptWeek===null||r.method===null||r.outcome!==p.outcome)return false;}else if(r.outcome!=='NONE'||r.verified||r.overclaims)return false;if(r.status==='RESOLVED'&&!r.verified)return false;if(r.status==='PREPARED'&&r.method===null)return false;if(r.status==='AVAILABLE'&&(r.method!==null||r.attemptWeek!==null||r.withdrawals))return false;if(r.contactOpen&&(!['OBSERVED','EXAMINED'].includes(r.status)||r.attemptWeek===null||r.method!=='LISTEN'||r.verified||s.activeEvent!==null||s.combat!==null||s.status!=='ACTIVE'||s.world.city!=='BACKLUND'))return false;}return m.reflected===s.seer.completedSources.includes('listener-reflection')&&(!m.reflected||CASES.every(p=>m.cases[p.id]?.status==='RESOLVED'));}
