import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {MindreaderAction,MindreaderCommand} from './types.js';
const CASES=[
 {id:'lost-key',title:'阅览室的最后一把钥匙',story:'成年档案员索菲愿意配合一次练习。她焦急地寻找自己保管的阅览室钥匙，允许你询问她刚做过什么；所有柜子仍锁着。',facts:['她的视线在桌沿与袖口之间移动。','她停在原地，没有把任何物件交给你。'],thought:'你直接感到急切的情绪，并读到转瞬的“红绳……别弄断”。这只是她现在想到的片段，不是钥匙位置或记忆录像。',ask:'请她讲述红绳或刚才动作，允许她自行检查',verify:'请她按自己认可的顺序检查桌边和随身物',result:'索菲自己检查后在袖口内侧找到仍系在红绳上的钥匙，说明刚才为免遗失把它系在那里。她亲自收好，钥匙和柜子都没有转移给你。'},
 {id:'curtain-call',title:'登台前的停顿',story:'剧场成年演员莉达邀请你帮她分辨登台前的紧张。她同意你作有限的浅层读心练习，具体演出决定仍由她自己作。',facts:['她的呼吸加快，却能稳定地拿住台词页。','她反复把第一页翻到背面，又翻回来。'],thought:'你感受到紧张中夹着期待，读到“第一句……不要漏掉”。没有取得她全部人生、秘密或未来表现。',ask:'谈谈第一句的担忧，听她愿意说明多少',verify:'请她自选是否做一次普通台词排练',result:'莉达自己选了从第一句开始排练，实际读完一段后决定登台。她仍感到紧张，你没有治疗、暗示或强迫她，也没有保证演出成功。'},
 {id:'harbor-message',title:'码头的未签收信件',story:'成年信使埃利斯带着封好的公函到码头登记台。他愿意配合核对本次交付，但信封未授权拆阅，收件人尚需亲自签字。',facts:['埃利斯说“已经送到”，手指却停在回执空白处。','他反复看向登记台旁的门，没有离开现场。'],thought:'你读到浅层的“还没签……别算丢了”，并感到疲倦。它提示他担心交付记录，不证明信内内容或收件人的真实意图。',ask:'请他区分送到与签收，并亲口说明下一步',verify:'当面核对未拆原函和公开回执的签字栏',result:'埃利斯确认原函已到登记台但尚未签收，登记员写下待签而非丢失。他留下原函依普通手续等收件人，私信内容和收件人的想法仍未知。'},
] as const;
function blocked(s:SliceState,c:MindreaderCommand):string|null{
 if(s.status!=='ACTIVE')return '当前周目已经结束。';
 if(s.progression.pathwayId!=='audience'||s.progression.sequence!==8)return '成为读心者后才能开始这些实践。';
 if(s.world.city!=='BACKLUND')return '需要本人返回贝克兰德。';
 if(s.activeEvent||s.combat)return '先处理当前事件或战斗。';
 if(s.health<=0||s.mind<=0)return '先休养恢复身体与精神。';
 if(s.actionsRemaining<1)return '需要1行动。';
 if(c.type==='REFLECT')return s.mindreader.reflected?'已经整理过这段经历。':CASES.some(x=>s.mindreader.cases[x.id]?.status!=='RESOLVED')?'先完成三段当面核实。':null;
 if(c.type!=='OBSERVE'&&c.type!=='READ'&&c.type!=='DISCUSS')return '未知的当面实践。';
 const r=s.mindreader.cases[c.caseId];if(!CASES.some(x=>x.id===c.caseId)||!r)return '未知的实际对象。';
 if(r.status==='RESOLVED')return '该情境已有结果，不重复成长。';
 if(c.type==='OBSERVE')return r.status==='AVAILABLE'?null:'已到场并看清普通细节。';
 if(r.status!=='OBSERVED')return '先到场观察，不能远程读心。';
 if(c.type==='READ')return r.readSucceeded?'已经记下本次浅层片段，不重复读取。':r.readWeek===s.week?'本周读取没有成功，休养或交谈后再来。':s.spirituality<2?'读取需要2灵性。':null;
 return r.attemptWeek===s.week?'本周交涉尚未取得共同确认，下周再来。':null;
}
export function mindreaderScenes(s:SliceState){return s.progression.pathwayId==='audience'&&(s.progression.sequence===8||s.progression.sequence===7||s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?CASES.map(c=>{const r=s.mindreader.cases[c.id]!;return{id:c.id,title:c.title,story:c.story,...(r.status==='RESOLVED'?{dialogue:c.result}:{}),observations:r.status==='AVAILABLE'?[]:[...c.facts],impression:r.readSucceeded?`第${r.readWeek}周留下的读取记录：${c.thought}`:'尚未读到本次浅层想法；普通观察和当面询问仍可进行。',status:r.status};}):[];}
export function mindreaderSocialActions(s:SliceState):MindreaderAction[]{
 if(s.progression.pathwayId!=='audience'||s.progression.sequence!==8)return [];
 const a:MindreaderAction[]=[];const add=(id:string,label:string,cost:string,command:MindreaderCommand)=>{const reason=blocked(s,command);a.push({id,label,cost,command,enabled:reason===null,reason});};
 for(const c of CASES){const r=s.mindreader.cases[c.id]!;if(r.status==='RESOLVED')continue;
 if(r.status==='AVAILABLE')add(`observe-${c.id}`,`到场：${c.title}`,'1行动 · 普通可见信息与当事人配合',{type:'OBSERVE',caseId:c.id});
 else {if(!r.readSucceeded)add(`read-${c.id}`,'读取当前浅层想法','1行动 · 2灵性 · 感知难度12 · 不搜索记忆，不控制精神',{type:'READ',caseId:c.id});add(`ask-${c.id}`,c.id==='lost-key'&&!r.readSucceeded?'请她讲述刚才的动作，由她自己检查':c.ask,'1行动 · 感知难度12 · 由本人决定和说明',{type:'DISCUSS',caseId:c.id,approach:'ASK'});add(`verify-${c.id}`,c.verify,'1行动 · 知识难度12 · 普通核实，不拆私信或夺原物',{type:'DISCUSS',caseId:c.id,approach:'VERIFY'});}
 }
 if(!s.mindreader.reflected)add('mindreader-reflect','整理念头、事实与自我的界限','1行动 · 三段核实后扮演+25，仅一次',{type:'REFLECT'});return a;
}
export function applyMindreaderSocial(s:SliceState,c:MindreaderCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void){
 const reason=blocked(s,c);if(reason)throw new Error(reason);s.actionsRemaining--;
 if(c.type==='REFLECT'){s.mindreader.reflected=true;s.seer.completedSources.push('mindreader-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('读到的念头不等于全部的一个人','你把浅层片段和实际核实的结果分开：情绪会变化，念头未必成为行动，别人的想法也不是自己的意志。扮演+25。');return;}
 if(c.type!=='OBSERVE'&&c.type!=='READ'&&c.type!=='DISCUSS')throw new Error('未知实践。');
 const entry=CASES.find(x=>x.id===c.caseId)!,r=s.mindreader.cases[c.caseId]!;
 if(c.type==='OBSERVE'){r.status='OBSERVED';ctx.note(entry.title,entry.story+' '+entry.facts.join(' '));return;}
 if(c.type==='READ'){r.readWeek=s.week;s.spirituality-=2;const result=ctx.check('perception',12);r.readSucceeded=result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS';if(r.readSucceeded){award(`mindreader-reading:${c.caseId}`,5);ctx.note('浅层片段',entry.thought+' 本次单项掌握+5。');}else ctx.note('没有读清','情绪与短暂念头交叠，这次没有取得可用片段。2灵性已消耗，没有用猜测补出内容；仍可普通交谈。');return;}
 r.attemptWeek=s.week;r.approach=c.approach;const result=ctx.check(c.approach==='ASK'?'perception':'knowledge',12);
 if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){r.status='RESOLVED';s.progression.acting=Math.min(100,s.progression.acting+25);award(`mindreader-case:${c.caseId}`,8);ctx.note(entry.title,entry.result+' 扮演+25、单项掌握+8。');}else ctx.note(entry.title,'这次没有取得共同确认。已读到的历史片段保留，但不代表对方现在仍在想同一件事；原物与本人决定没有变化，下周可再谈。');
}
export function validateMindreaderSocial(s:SliceState){
 const m=s.mindreader;
 for(const c of CASES){const r=m.cases[c.id];if(!r)return false;
 if(r.readSucceeded&&r.readWeek===null||r.status==='AVAILABLE'&&(r.readWeek!==null||r.attemptWeek!==null)||r.approach!==null&&!['ASK','VERIFY'].includes(r.approach)||(r.approach===null)!==(r.attemptWeek===null))return false;
 if(r.readSucceeded!==s.seer.completedSources.includes(`mindreader-reading:${c.id}`)||(r.status==='RESOLVED')!==s.seer.completedSources.includes(`mindreader-case:${c.id}`))return false;
 }
 if(m.reflected!==s.seer.completedSources.includes('mindreader-reflection')||m.reflected&&CASES.some(c=>m.cases[c.id]?.status!=='RESOLVED'))return false;
 if((s.progression.pathwayId!=='audience'||(s.progression.sequence!==8&&s.progression.sequence!==7&&s.progression.sequence!==6&&s.progression.sequence!==5&&s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==2))&&(m.reflected||Object.values(m.cases).some(r=>r.status!=='AVAILABLE')))return false;
 return true;
}
