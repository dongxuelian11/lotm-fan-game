import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { ShadowAsceticCommand, ShadowAsceticActivityCommand, ShadowAsceticAction, ShadowAsceticProjection } from './types.js';
const CASES=[
 {id:'lamp-shift',title:'灯移了，影子也变了',story:'伊森在原练习间点起一盏有罩灯，墙边有一小段遮蔽阴影。他事先说明：本次练习开始后会把灯沿桌面移动，原阴影随之消失；玩家需要保留这个变化，不把曾经藏好当成永远不可见。原明处到墙边沿地面只隔两步。',facts:['原罩灯与墙面构成当下可用的小段阴影。','伊森会按已说明的次序移动原灯，原藏身点随后被照亮。'],shadow:'沿原地面到墙边作一次短暂藏匿；灯移之后如实承认自己重新可见，最后沿原路回到明处。',ordinary:'不施用能力，只从原标线观察灯光移动和影子消失，再核对现场。',result:'原灯确实移动，原藏身点变亮。你记录了实际变化；成功识别条件失效并不等于继续隐形。',outcome:'LIGHT_CHECKED'},
 {id:'blocked-alcove',title:'影子后面仍是一只箱子',story:'原壁龛中央被木箱挡住，地面外侧留有可正常步行的通道；沿墙另一段阴影可由这条通道抵达。旧草图画着穿过中央的短线，但箱子已经摆在那里，阴影不能使身体穿过实物。',facts:['原木箱真实挡住中央短线，未被能力移开。','外侧普通地面路连通入口与墙边暗处，往返都可走。'],shadow:'沿外侧实际通道走到墙边阴影，在该处短暂藏匿，再沿原路返回；不穿箱、不跳过移动。',ordinary:'走同一外侧普通通道核对壁龛，不用藏匿能力。',result:'你沿外侧原通道完成了实际往返所需的核对，木箱和原障碍保留。阴影只是可用环境，不是传送通道。',outcome:'ROUTE_CHECKED'},
 {id:'agreed-watch',title:'知道藏身点的人',story:'伊森事先同意一次有限观察练习：你可走到原幕布旁的暗处，管理员会从门口看一眼，再等你回到明处。他已经知道练习区域，不能把这次较难辨认当成抹掉他的记忆、隔绝一切感知或取得永久躲藏权。',facts:['原幕布旁有阴影，从门口沿普通地面可以到达和返回。','管理员知道练习区域，只同意这一段观察；未登记超凡侦测对抗试验。'],shadow:'在已约定的暗处短暂藏匿，不攻击或接触本人，随后主动解除并走回明处。',ordinary:'用普通站位与幕布遮挡比较可见性，再回到本人面前说明结果。',result:'本次约定观察已经结束。暗处较难辨认不能证明对所有感知免疫，管理员对场地与本人身份的知识没有消失。',outcome:'WATCH_CHECKED'},
]as const;
export const SHADOW_ASCETIC_ENVIRONMENT='隐修士阴影躲藏有原文依据，也存在被发现和被攻击的实例。三处短时练习、有限空间与成本是G：身体沿普通路线真实往返，原障碍不消失；灯光改变可使藏匿失效。藏匿不授伤害免疫、任意影遁、血肉魔法或放牧。';
export const shadowAsceticInside=(s:SliceState)=>Object.values(s.shadowAscetic.cases).some(r=>r.shadowOpen);
export const isShadowAsceticActivity=(c:ShadowAsceticCommand):c is ShadowAsceticActivityCommand=>['OBSERVE','PREPARE','PERFORM','REVEAL','REPORT','WITHDRAW','REFLECT'].includes(c.type);
function blocked(s:SliceState,c:ShadowAsceticActivityCommand):string|null{
 if(s.status!=='ACTIVE')return'当前周目已结束。';if(s.progression.pathwayId!=='hanged-man'||s.progression.sequence!==7)return'先完成隐修士晋升。';
 const r='caseId'in c?s.shadowAscetic.cases[c.caseId]:null;
 if(c.type==='REVEAL')return r?.shadowOpen?null:'没有尚待结束的藏匿练习。';
 if(shadowAsceticInside(s))return'先0行动解除本次藏匿，沿原普通退路回到明处。';
 if(s.activeEvent||s.combat)return'先处理当前事件或战斗。';if(s.world.city!=='BACKLUND')return'需要回到伊森的原练习间。';
 if(c.type==='WITHDRAW')return r?.status==='PREPARED'?null:'没有尚待取消的准备。';
 if(s.health<=0||s.mind<=0)return'先休养恢复身体与精神。';if(s.actionsRemaining<1)return'需要1行动。';
 if(c.type==='REFLECT')return s.shadowAscetic.reflected?'已经回看本次经历。':CASES.some(p=>s.shadowAscetic.cases[p.id]?.status!=='RESOLVED')?'先如实完成三项实践。':null;
 if(!r)return'未知原练习间。';if(r.status==='RESOLVED')return'这项实践已经完成。';if(c.type==='OBSERVE')return r.status==='AVAILABLE'?null:'原现场观察已经保留。';
 if(c.type==='PREPARE'){if(c.method==='BLOCKED_ROUTE'&&c.caseId!=='blocked-alcove')return'这处没有那张中央旧路线。';return r.status!=='OBSERVED'?'先看当前灯光、障碍与本人同意。':r.attemptWeek===s.week?'本周未成，下周可以重新准备。':null;}
 if(c.type==='REPORT')return r.status==='EXAMINED'?null:'先完成实际实践并回到明处。';
 if(r.status!=='PREPARED')return'先选择本次方法。';if(r.method==='SHADOW'&&s.spirituality<2)return'短时藏匿需要2灵性；可以0行动取消，改用普通方法。';return null;
}
export function applyShadowAsceticActivity(s:SliceState,c:ShadowAsceticActivityCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void){
 const reason=blocked(s,c);if(reason)throw new Error(reason);const m=s.shadowAscetic;
 if(c.type==='REVEAL'){const r=m.cases[c.caseId]!;r.shadowOpen=false;r.hidden=false;ctx.note('主动解除，沿原路回到明处','你结束本次能力，沿已经核实的原普通地面回到伊森面前；若暂时无力，按事前约定由他在原练习区域协助退出。灯、幕布与箱子保留原物。0行动、不抽签、不返成本、不治疗，没有瞬移或带人穿影。');return;}
 if(c.type==='WITHDRAW'){const r=m.cases[c.caseId]!;r.status='OBSERVED';r.method=null;r.withdrawals++;ctx.note('取消尚未开始的藏匿准备','0行动取消，已花成本与原观察保留；身体尚未进入练习点。');return;}
 s.actionsRemaining--;
 if(c.type==='REFLECT'){m.reflected=true;s.seer.completedSources.push('shadow-ascetic-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('隐藏并没有离开世界','你把灯光、原路径和别人仍有的知识都留在记录里。知道什么时候现身，与短暂隐去身形同样重要。扮演+25。');return;}
 const p=CASES.find(p=>p.id===c.caseId)!,r=m.cases[c.caseId]!;
 if(c.type==='OBSERVE'){r.status='OBSERVED';ctx.note(p.title,p.story+' '+p.facts.join(' '));return;}
 if(c.type==='PREPARE'){r.status='PREPARED';r.method=c.method;ctx.note(p.title,c.method==='SHADOW'?p.shadow:c.method==='ORDINARY'?p.ordinary:'照旧草图尝试中央短线；原箱仍挡路，此方法实际不可通行。');return;}
 if(c.type==='REPORT'){r.status='RESOLVED';s.progression.acting=Math.min(100,s.progression.acting+25);award(`shadow-ascetic-case:${p.id}`,8);ctx.note(p.title,p.result+' 如实提交本次结果，扮演+25、已知能力单项掌握+8。');return;}
 r.attemptWeek=s.week;if(r.method==='BLOCKED_ROUTE'){r.status='OBSERVED';ctx.note('原箱仍在，不存在穿影捷径','实际查看旧短线后仍无法穿过木箱；你停在原安全入口，没有位移到箱后，没有消耗灵性或抽签，没有成长奖励。行动已花，下周可以重选可走的外侧通道。');return;}
 const shadow=r.method==='SHADOW';if(shadow){s.spirituality-=2;r.shadowOpen=true;}
 const result=ctx.check(shadow?'perception':'knowledge',shadow?15:10);
 if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){r.status='EXAMINED';r.outcome=p.outcome;r.hidden=shadow&&p.id!=='lamp-shift';ctx.note(p.title,p.result+(r.shadowOpen?'本次练习仍未结束，先明确解除并沿原路回到明处。':'普通核对已经返回，仍需报告。'));}
 else{r.status='OBSERVED';r.hidden=false;if(result.tier==='GREAT_FAILURE')s.mind=Math.max(0,s.mind-5);ctx.note(p.title,'本次未能稳定完成观察或藏匿，不将失败记成不可见。'+(result.tier==='GREAT_FAILURE'?'练习疲劳，精神损失至多5。':'')+(r.shadowOpen?'仍须0行动结束尝试并沿原退路回到明处。':'')+'已花成本保留，下周可以重新准备。');}
}
export function shadowAsceticActions(s:SliceState):ShadowAsceticAction[]{if(s.progression.pathwayId!=='hanged-man'||s.progression.sequence!==7)return[];const out:ShadowAsceticAction[]=[];const add=(id:string,label:string,cost:string,command:ShadowAsceticActivityCommand)=>{const reason=blocked(s,command);out.push({id,label,cost,command,enabled:reason===null,reason});};for(const p of CASES){const r=s.shadowAscetic.cases[p.id]!;if(r.shadowOpen)add(p.id+'-reveal','结束藏匿，沿原路回到明处','0行动 · 不返成本',{type:'REVEAL',caseId:p.id});if(r.status==='AVAILABLE')add(p.id+'-observe','查看原灯光、通路与约定','1行动',{type:'OBSERVE',caseId:p.id});if(r.status==='OBSERVED'){add(p.id+'-shadow','准备短时藏匿与实际往返','1行动 · 施用另耗2灵性',{type:'PREPARE',caseId:p.id,method:'SHADOW'});add(p.id+'-ordinary','准备普通观察和绕行','1行动 · 不耗灵性',{type:'PREPARE',caseId:p.id,method:'ORDINARY'});if(p.id==='blocked-alcove')add(p.id+'-blocked','照旧图走被箱子挡住的短线','1行动 · 原路已堵',{type:'PREPARE',caseId:p.id,method:'BLOCKED_ROUTE'});}if(r.status==='PREPARED'){add(p.id+'-perform','实际完成本次有限练习',r.method==='SHADOW'?'1行动 · 2灵性':'1行动 · 不耗灵性',{type:'PERFORM',caseId:p.id});add(p.id+'-withdraw','取消这次准备','0行动',{type:'WITHDRAW',caseId:p.id});}if(r.status==='EXAMINED')add(p.id+'-report','如实记录条件与局限','1行动',{type:'REPORT',caseId:p.id});}if(!s.shadowAscetic.reflected)add('shadow-ascetic-reflect','回看何时隐藏、何时现身','1行动 · 三项实践后',{type:'REFLECT'});return out;}
export function shadowAsceticCases(s:SliceState):ShadowAsceticProjection['cases']{if(s.progression.pathwayId!=='hanged-man')return[];return CASES.map(p=>{const r=s.shadowAscetic.cases[p.id]!;return{id:p.id,title:p.title,story:p.story,observations:r.status==='AVAILABLE'?[]:[...p.facts],preparation:r.status==='PREPARED'?(r.method==='SHADOW'?p.shadow:r.method==='ORDINARY'?p.ordinary:'旧短线仍被原木箱挡住。'):null,result:['EXAMINED','RESOLVED'].includes(r.status)?p.result:r.attemptWeek!==null?'此前未成，实际条件与原障碍保留。':r.withdrawals?'准备已取消。':null,status:r.status,shadowOpen:r.shadowOpen?'本次练习尚未结束：先实际退出':'已在明处，没有未结束的练习',hidden:r.hidden};});}
export function validateShadowAsceticLife(s:SliceState):boolean{const m=s.shadowAscetic;if(!m?.cases)return false;for(const p of CASES){const r=m.cases[p.id];if(!r)return false;if((r.status==='RESOLVED')!==s.seer.completedSources.includes(`shadow-ascetic-case:${p.id}`))return false;if(['EXAMINED','RESOLVED'].includes(r.status)){if(r.attemptWeek===null||r.method===null||r.method==='BLOCKED_ROUTE'||r.outcome!==p.outcome)return false;}else if(r.outcome!=='NONE')return false;if(r.status==='PREPARED'&&r.method===null)return false;if(r.method==='BLOCKED_ROUTE'&&p.id!=='blocked-alcove')return false;if(r.status==='AVAILABLE'&&(r.method!==null||r.attemptWeek!==null||r.withdrawals))return false;if(r.hidden&&(!r.shadowOpen||r.status!=='EXAMINED'||p.id==='lamp-shift'))return false;if(r.shadowOpen&&(!['OBSERVED','EXAMINED'].includes(r.status)||r.attemptWeek===null||r.method!=='SHADOW'||s.activeEvent!==null||s.combat!==null||s.status!=='ACTIVE'||s.world.city!=='BACKLUND'))return false;}return m.reflected===s.seer.completedSources.includes('shadow-ascetic-reflection')&&(!m.reflected||CASES.every(p=>m.cases[p.id]?.status==='RESOLVED'));}
