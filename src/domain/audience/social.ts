import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {AudienceAction,AudienceCommand} from './types.js';

const CASES=[
 {id:'counter-receipt',title:'被揉皱的收据',story:'小书店的学徒艾文被指收了两次订金。店主允许当面查阅这一笔的公开收据，艾文站在柜台另一侧。',observations:['艾文回答付款日期时停顿，拇指反复摩擦收据折角。','他能立即说出书名，却两次把目光转向柜台上的两本账册。'],interpretation:'紧张可能来自指责，也可能来自记不清。看向账册提示值得核对记录，不能据此断定偷钱。',ask:'请艾文按时间重新讲一遍，并逐笔对照',verify:'征得同意，把原收据与两本账册并排核对',result:'原收据与两本账册表明，同一笔订金被重复誊录，没有第二次收款凭证。店主在两人面前划去重复项并签注；你没有把紧张当成罪证。'},
 {id:'backstage-letter',title:'没有拆开的邀约',story:'剧场后台，成年演员莉达与场务因一封邀约争吵。莉达愿意谈谈自己的选择，但没有允许任何人拆她的信。',observations:['莉达提到巡演时微笑，提到离城日期后压低声音。','原信封封口仍完整，她把信收回自己衣袋，没有递给你。'],interpretation:'欣喜与顾虑可以同时存在。日期或许重要，但信件内容、家庭情况和最终决定尚未知。',ask:'询问她愿意谈的顾虑，允许她拒答',verify:'只核对墙上公开排期，请她确认愿意公开的部分',result:'莉达亲口说明，她想参加巡演，但不愿在本周排练未交接时离开。场务根据公开排期另约交接时间；是否接受邀约仍由她决定，私信没有被拆开。'},
 {id:'boarding-house',title:'楼梯口的两种说法',story:'寄宿屋两名成年住客互指对方深夜搬动箱子。管理员请你协助核实公共走廊的动静，不准进入私人房间。',observations:['一人把“钟响以后”重复了三次，另一人始终说“我刚从夜班回来”。','他们指的是同一段楼梯，却没有给出同一个具体时刻。'],interpretation:'两段记忆可能发生在不同时刻。口气坚定不代表时间准确，也不能据疲惫判定撒谎。',ask:'分别复述双方的时间线，请他们纠正',verify:'请管理员拿出公共夜班进门簿核对时刻',result:'管理员出示的进门簿与双方重新确认的时间相差一小时。两人承认未亲眼看到对方搬箱，撤回指控。箱主和箱内物品仍未核实，任何私人房间都没有被搜查。'},
 {id:'night-deposition',title:'迟来的证词',story:'码头记录员邀请你旁听一次成年工人的事故陈述。记录必须区分亲见、转述与猜测，不要求你替所有人判断真假。',observations:['工人在描述自己站的位置时用手比画，讲到背后的人时改用“他们都说”。','每当记录员念出“亲眼看见”，工人就摇头想纠正，却被下一句打断。'],interpretation:'这提示证词可能混有转述。你还不知道转述本身是否属实，应该让当事人澄清来源。',ask:'请记录员停笔，让工人区分亲见和转述',verify:'逐句读回已经同意记录的证词，标注信息来源',result:'工人逐句确认了自己的站位和亲见范围，把背后发生的事情标成转述。记录员另留待查栏，没有把你的推断写成已证实事实；原证词由当事人核对后签名。'},
] as const;
function common(s:SliceState){return s.status!=='ACTIVE'?'当前周目已经结束。':s.progression.pathwayId!=='audience'||s.progression.sequence!==9?'成为观众后才能进行这些观察实践。':s.world.city!=='BACKLUND'?'需要本人返回贝克兰德。':s.activeEvent||s.combat?'先处理眼前事件或战斗。':s.health<=0||s.mind<=0?'先休养恢复身体与精神。':s.actionsRemaining<1?'需要1行动。':null;}
function blocked(s:SliceState,c:AudienceCommand):string|null{
 const reason=common(s);if(reason)return reason;
 if(c.type==='REFLECT')return s.audience.social.reflected?'已经整理过这些经历。':CASES.some(x=>s.audience.social.cases[x.id]?.status!=='RESOLVED')?'先完成四段观察与核实。':null;
 if(c.type!=='OBSERVE'&&c.type!=='DISCUSS')return '未知的观察实践。';
 const entry=CASES.find(x=>x.id===c.caseId),r=s.audience.social.cases[c.caseId];if(!entry||!r)return '未知的公开情境。';
 if(r.status==='RESOLVED')return '这段交涉已有结果，不重复奖励。';
 if(c.type==='OBSERVE')return r.status==='AVAILABLE'?null:'已记录本次亲见的动作，可以选择怎样核实。';
 if(r.status!=='OBSERVED')return '先到场观察，不能凭空读取他人的想法。';
 if(r.attemptWeek===s.week)return '本周已经交涉过；给当事人一些时间，下周再来。';
 return null;
}
export function audienceSocialScenes(s:SliceState){
 if(s.progression.pathwayId!=='audience')return [];
 return CASES.map(c=>{const r=s.audience.social.cases[c.id]!;return{id:c.id,title:c.title,story:r.status==='RESOLVED'?c.result:c.story,observations:r.status==='AVAILABLE'?[]:[...c.observations],interpretation:r.status==='AVAILABLE'?'尚未到场观察。':c.interpretation,status:r.status};});
}
export function audienceSocialActions(s:SliceState):AudienceAction[]{
 if(s.progression.pathwayId!=='audience'||s.progression.sequence!==9)return [];
 const actions:AudienceAction[]=[];
 const add=(id:string,label:string,cost:string,command:AudienceCommand)=>{const reason=blocked(s,command);actions.push({id,label,cost,command,enabled:reason===null,reason});};
 for(const c of CASES){const r=s.audience.social.cases[c.id]!;if(r.status==='RESOLVED')continue;
  if(r.status==='AVAILABLE')add(`observe-${c.id}`,`到场观察：${c.title}`,'1行动 · 只记录眼前可见动作',{type:'OBSERVE',caseId:c.id});
  else {add(`ask-${c.id}`,c.ask,'1行动 · 感知检定 · 对方仍可能拒绝',{type:'DISCUSS',caseId:c.id,approach:'ASK'});add(`verify-${c.id}`,c.verify,'1行动 · 知识检定 · 只查获准公开的资料',{type:'DISCUSS',caseId:c.id,approach:'VERIFY'});add(`accuse-${c.id}`,'把紧张当成隐瞒，直接指控','1行动 · 没有证据；会损害信任，不算有效核实',{type:'DISCUSS',caseId:c.id,approach:'ACCUSE'});}
 }
 if(!s.audience.social.reflected)add('audience-reflect','整理观察与臆测的界限','1行动 · 四段核实后扮演+20，仅一次',{type:'REFLECT'});
 return actions;
}
export function applyAudienceSocial(s:SliceState,c:AudienceCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void){
 const reason=blocked(s,c);if(reason)throw new Error(reason);s.actionsRemaining--;
 if(c.type==='REFLECT'){s.audience.social.reflected=true;s.seer.completedSources.push('audience-reflection');s.progression.acting=Math.min(100,s.progression.acting+20);ctx.note('保持旁观，也尊重当事人','你把亲见动作、可能解释和后来核实的事实分开记录。观察不是全知，介入也不等于支配。扮演+20。');return;}
 if(c.type!=='OBSERVE'&&c.type!=='DISCUSS')throw new Error('未知的观察实践。');
 const entry=CASES.find(x=>x.id===c.caseId)!,r=s.audience.social.cases[c.caseId]!;
 if(c.type==='OBSERVE'){r.status='OBSERVED';ctx.note(entry.title,entry.observations.join(' ')+' '+entry.interpretation);return;}
 r.attemptWeek=s.week;r.approach=c.approach;
 if(c.approach==='ACCUSE'){s.audience.social.trust=Math.max(-8,s.audience.social.trust-2);ctx.note('指控使交谈中断','对方要求你先拿出证据，拒绝继续这次交谈。信任−2；没有取得新的事实或成长，下周可以换一种方式重新接触。');return;}
 const result=ctx.check(c.approach==='ASK'?'perception':'knowledge',12+(s.audience.social.trust<0?2:0));
 if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){r.status='RESOLVED';r.verified=true;s.audience.social.trust=Math.min(8,s.audience.social.trust+2);s.progression.acting=Math.min(100,s.progression.acting+20);award(`audience-case:${c.caseId}`,8);ctx.note(entry.title,entry.result+' 信任+2，扮演+20，单项掌握+8。');}
 else ctx.note(entry.title,'这次交涉没有取得足够的共同确认。已经观察到的动作保留，猜测仍是猜测；没有改写对方的决定，下周可再试。');
}
export function validateAudienceSocial(s:SliceState){
 const social=s.audience.social;
 if(social.trust < -8 || social.trust > 8)return false;
 if(s.progression.pathwayId!=='audience'&&(social.trust!==0||social.reflected||Object.values(social.cases).some(r=>r.status!=='AVAILABLE')))return false;
 for(const c of CASES){const r=social.cases[c.id];if(!r)return false;
 if((r.approach===null)!==(r.attemptWeek===null)||r.approach!==null&&!['ASK','VERIFY','ACCUSE'].includes(r.approach)||r.status==='AVAILABLE'&&r.approach!==null)return false;
 if((r.status==='RESOLVED')!==r.verified||r.verified&&r.approach==='ACCUSE'||r.verified!==s.seer.completedSources.includes(`audience-case:${c.id}`))return false;
 }
 if(social.reflected!==s.seer.completedSources.includes('audience-reflection')||social.reflected&&CASES.some(x=>!social.cases[x.id]?.verified))return false;
 return true;
}
