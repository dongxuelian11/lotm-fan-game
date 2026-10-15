import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { CombatScholarCommand, CombatScholarActivityCommand, CombatScholarAction, CombatScholarProjection } from './types.js';
const CASES = [
 {id:'counter-study',title:'纸上的右步，眼前的左步',story:'成年教员塔文拿出旧训练卡，卡上画着向右跨步。他当面说明本次改向左侧演示，只在软垫标线里行动，请你先看实际示范再选择练习方法。',facts:['旧卡的箭头向右，本次本人实际示范向左。','教员只同意这次无接触标线练习，纸面不能替代眼前变化。'],observed:'按本次已见的左侧示范，在原软垫标线内调整自己的动作，不预测别人未做的选择。',team:'请塔文分段指示，用普通合作方法核对左右次序。',memory:'只照旧卡的右侧箭头练习，忽略本人已说明的变化；当前资料已明确不适用。',result:'原卡与实际示范的差别已经核对；你调整了本次动作，没有获得看透任何敌人招式的能力。',outcome:'CUE_CHECKED',stat:'perception',difficulty:12},
 {id:'changed-passage',title:'箱子改变了通道',story:'训练室原通道中央临时摆了一只固定木箱，外侧标线仍能普通绕过。旧笔记写着直行中央，塔文请你核对现场后把轻木标牌带到另一端；练习在本次动作内往返，标牌仍归训练室。',facts:['原木箱实际挡住中央，外侧普通标线仍连通。','旧笔记的中央路线已经不符合本次现场。'],observed:'依据当前可见通道，在外侧标线内完成一次受监督往返，不穿过箱子或跳过路程。',team:'让教员逐段指路，用普通协作完成同一条外侧往返。',memory:'照旧笔记直走中央；原木箱仍在，不能凭熟练度穿过去。',result:'你沿实际可走的外侧完成了本次有限往返，原轻木牌交回。普通地形和原障碍没有被能力抹去。',outcome:'PASSAGE_CHECKED',stat:'physique',difficulty:12},
 {id:'halted-exercise',title:'听见停止之后',story:'塔文约定只做一小段无接触演练，并把原铃放在桌上。开始后他会实际摇铃要求结束；旧卡上的连贯动作不能成为继续靠近本人的理由。你需要明确停止自己的练习，才能提交结果。',facts:['本人只同意短段无接触练习，并约定铃响即结束。','原铃就在本场；旧卡上的完整连贯动作不是永久同意。'],observed:'观察本次示范并练习一小段，听到实际铃声后准备结束自己的动作。',team:'让本人逐项说明边界，按普通口令做一小段练习。',memory:'机械照旧卡做完整连贯动作；它没有包含本次铃声和本人新边界，不能当可靠做法。',result:'本次短段演练已经核对，原铃要求停止的事实保留；明确停止后才算结束，没有永久接触权或强迫配合。',outcome:'EXERCISE_CHECKED',stat:'will',difficulty:12},
] as const;
export const COMBAT_SCHOLAR_ENVIRONMENT='格斗学者目前只核到原著序列名称，三项训练、属性与数值都是G。实际示范、当前通道和本人边界优先于旧笔记；普通协作也可成长。演练开始后可0行动明确停止，保留已花成本，不授予巫师法术或高阶窥秘之眼。';
export const combatScholarInside=(s:SliceState)=>Object.values(s.combatScholar.cases).some(r=>r.exerciseOpen);
export const isCombatScholarActivity=(c:CombatScholarCommand):c is CombatScholarActivityCommand=>['OBSERVE','PREPARE','PERFORM','STOP','REPORT','WITHDRAW','REFLECT'].includes(c.type);
function blocked(s:SliceState,c:CombatScholarActivityCommand):string|null {
 if(s.status!=='ACTIVE')return'当前周目已结束。';
 if(s.progression.pathwayId!=='hermit'||s.progression.sequence!==8)return'先完成格斗学者晋升。';
 const r='caseId'in c?s.combatScholar.cases[c.caseId]:null;
 if(c.type==='STOP')return r?.exerciseOpen?null:'没有尚待停止的实际演练。';
 if(combatScholarInside(s))return'先0行动明确停止这次演练。';
 if(s.activeEvent||s.combat)return'先处理当前事件或战斗。';
 if(s.world.city!=='BACKLUND')return'需要回到塔文的原训练室。';
 if(c.type==='WITHDRAW')return r?.status==='PREPARED'?null:'没有待取消的准备。';
 if(s.health<=0||s.mind<=0)return'先休养恢复身体与精神。';
 if(s.actionsRemaining<1)return'需要1行动。';
 if(c.type==='REFLECT')return s.combatScholar.reflected?'已经回看本次经历。':CASES.some(p=>s.combatScholar.cases[p.id]?.status!=='RESOLVED')?'先如实完成三项训练报告。':null;
 if(!r)return'未知训练现场。';if(r.status==='RESOLVED')return'这项训练已经结束。';
 if(c.type==='OBSERVE')return r.status==='AVAILABLE'?null:'原观察已经保留。';
 if(c.type==='PREPARE')return r.status!=='OBSERVED'?'先观察当前示范和本人边界。':r.attemptWeek===s.week?'本周未成，下周可重新准备。':null;
 if(c.type==='REPORT')return r.status==='EXAMINED'?null:'先完成实际训练，并结束尚未停止的演练。';
 return r.status==='PREPARED'?null:'先选择本次训练方法。';
}
export function applyCombatScholarActivity(s:SliceState,c:CombatScholarActivityCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void){
 const reason=blocked(s,c);if(reason)throw new Error(reason);const m=s.combatScholar;
 if(c.type==='STOP'){m.cases[c.caseId]!.exerciseOpen=false;ctx.note('实际停止本次演练','你停止自己的动作，退出原软垫练习线；若暂时无力，塔文按事前约定协助结束。0行动、不抽签、不退成本。本人本次同意到此为止，原资料与练习结果仍保留。');return;}
 if(c.type==='WITHDRAW'){const r=m.cases[c.caseId]!;r.status='OBSERVED';r.method=null;r.withdrawals++;ctx.note('取消尚未开始的准备','0行动取消，原观察和已经花费的行动保留；没有发生练习，也没有虚构成功。');return;}
 s.actionsRemaining--;
 if(c.type==='REFLECT'){m.reflected=true;s.seer.completedSources.push('combat-scholar-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('把学习落实在眼前','旧笔记需要同当前事实比较，记住一套动作不等于永远正确。尊重停止和普通障碍，扮演+25。');return;}
 const p=CASES.find(p=>p.id===c.caseId)!,r=m.cases[c.caseId]!;
 if(c.type==='OBSERVE'){r.status='OBSERVED';ctx.note(p.title,p.story+' '+p.facts.join(' '));return;}
 if(c.type==='PREPARE'){r.status='PREPARED';r.method=c.method;ctx.note(p.title,c.method==='OBSERVED'?p.observed:c.method==='TEAM'?p.team:p.memory);return;}
 if(c.type==='REPORT'){r.status='RESOLVED';s.progression.acting=Math.min(100,s.progression.acting+25);award(`combat-scholar-case:${p.id}`,8);ctx.note(p.title,p.result+' 如实报告，扮演+25、已知能力单项掌握+8。');return;}
 r.attemptWeek=s.week;if(p.id==='halted-exercise')r.exerciseOpen=true;
 if(r.method==='MEMORIZED'){r.status='OBSERVED';ctx.note('旧记法与实际条件冲突','本次实际示范、障碍或本人边界已改变，照旧记法不能完成任务。教员在无接触练习范围内叫停，没有移走原箱或强迫本人配合；行动已花，没有随机奖励，下周可改法。'+(r.exerciseOpen?'先0行动明确停止自己的演练。':''));return;}
 const check=ctx.check(r.method==='TEAM'?'knowledge':p.stat,r.method==='TEAM'?10:p.difficulty);
 if(check.tier==='SUCCESS'||check.tier==='GREAT_SUCCESS'){r.status='EXAMINED';r.outcome=p.outcome;ctx.note(p.title,p.result+(r.exerciseOpen?'原铃已实际响起，先明确停止演练，再报告。':'尚需提交报告。'));}
 else{r.status='OBSERVED';if(check.tier==='GREAT_FAILURE')s.mind=Math.max(0,s.mind-5);ctx.note(p.title,'这次练习未能可靠完成，保留已花行动，下周可重新准备。'+(check.tier==='GREAT_FAILURE'?'疲劳使精神损失至多5。':'')+(r.exerciseOpen?'原铃已经响起，先0行动实际停止。':''));}
}
export function combatScholarActions(s:SliceState):CombatScholarAction[]{
 if(s.progression.pathwayId!=='hermit'||s.progression.sequence!==8)return[];const out:CombatScholarAction[]=[];
 const add=(id:string,label:string,cost:string,command:CombatScholarActivityCommand)=>{const reason=blocked(s,command);out.push({id,label,cost,command,enabled:reason===null,reason});};
 for(const p of CASES){const r=s.combatScholar.cases[p.id]!;
  if(r.exerciseOpen)add(p.id+'-stop','明确停止本次演练','0行动 · 不退已花成本',{type:'STOP',caseId:p.id});
  if(r.status==='AVAILABLE')add(p.id+'-observe','观察实际示范与条件','1行动',{type:'OBSERVE',caseId:p.id});
  if(r.status==='OBSERVED'){add(p.id+'-observed','按这次实际观察准备','1行动 · 实练难度12',{type:'PREPARE',caseId:p.id,method:'OBSERVED'});add(p.id+'-team','请教员分段协作','1行动 · 知识10',{type:'PREPARE',caseId:p.id,method:'TEAM'});add(p.id+'-memorized','仍照旧记法准备','1行动 · 已知条件不同，不能保证适用',{type:'PREPARE',caseId:p.id,method:'MEMORIZED'});}
  if(r.status==='PREPARED'){add(p.id+'-perform','实际进行本次有限练习','1行动 · 不耗灵性',{type:'PERFORM',caseId:p.id});add(p.id+'-withdraw','取消本次准备','0行动',{type:'WITHDRAW',caseId:p.id});}
  if(r.status==='EXAMINED')add(p.id+'-report','提交实际练习报告','1行动',{type:'REPORT',caseId:p.id});
 }
 if(!s.combatScholar.reflected)add('combat-scholar-reflect','回看旧知与当前条件','1行动 · 三项报告后',{type:'REFLECT'});return out;
}
export function combatScholarCases(s:SliceState):CombatScholarProjection['cases']{if(s.progression.pathwayId!=='hermit')return[];return CASES.map(p=>{const r=s.combatScholar.cases[p.id]!;return{id:p.id,title:p.title,story:p.story,observations:r.status==='AVAILABLE'?[]:[...p.facts],preparation:r.status==='PREPARED'?(r.method==='OBSERVED'?p.observed:r.method==='TEAM'?p.team:p.memory):null,result:['EXAMINED','RESOLVED'].includes(r.status)?p.result:r.attemptWeek!==null?'此前练习未完成，保留实际差别，下周可以改法。':r.withdrawals?'本次准备已取消。':null,status:r.status,exerciseOpen:r.exerciseOpen?'原铃已响，先明确停止这次演练':'没有尚待停止的演练'};});}
export function validateCombatScholarLife(s:SliceState):boolean{const m=s.combatScholar;if(!m?.cases)return false;for(const p of CASES){const r=m.cases[p.id];if(!r)return false;if((r.status==='RESOLVED')!==s.seer.completedSources.includes(`combat-scholar-case:${p.id}`))return false;if(['EXAMINED','RESOLVED'].includes(r.status)){if(r.attemptWeek===null||r.method===null||r.method==='MEMORIZED'||r.outcome!==p.outcome)return false;}else if(r.outcome!=='NONE')return false;if(r.status==='PREPARED'&&r.method===null)return false;if(r.status==='AVAILABLE'&&(r.method!==null||r.attemptWeek!==null||r.withdrawals))return false;if(r.exerciseOpen&&(p.id!=='halted-exercise'||!['OBSERVED','EXAMINED'].includes(r.status)||r.attemptWeek===null||r.method===null||s.activeEvent!==null||s.combat!==null||s.status!=='ACTIVE'||s.world.city!=='BACKLUND'))return false;}return m.reflected===s.seer.completedSources.includes('combat-scholar-reflection')&&(!m.reflected||CASES.every(p=>m.cases[p.id]?.status==='RESOLVED'));}
