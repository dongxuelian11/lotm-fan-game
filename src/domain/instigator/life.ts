import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {InstigatorCommand,InstigatorActivityCommand,InstigatorAction,InstigatorProjection} from './types.js';
const CASES=[
 {id:'queue-grievance',title:'排队的人没有走',story:'成年排字工艾达在原窗口等了很久，发现后来的人先拿到工单。她已经向诺艾拉表达不满，但还没有动手，也不愿伤害旁人。',facts:['艾达当面说她在意先后顺序。','原登记条显示两种业务分列，等待时间仍需要柜员解释。'],incite:'突出她已经表达的不公平感，让她决定是否更强烈地提出异议。不是命令她攻击或交出财物。',plain:'一起读原登记条，问清两个队列的区别，给她自行提出问题的空间。',result:'艾达已经说出自己的异议，柜员答应核对原登记。是否满意仍由她自己决定，没有凭检定改动工单。',outcome:'QUEUE_HEARD'},
 {id:'two-notices',title:'两张不同的告示',story:'成年场务梅里克和送稿人看着原墙上两张时间不同的告示争执。两人都担心白等，你可以放大已有的疑虑，也可以让他们把原告示并排核实。',facts:['两张原告示分别标着旧日期和修订日期。','送稿人担心误事，梅里克担心被指责隐瞒；这些是他们当面说出的顾虑。'],incite:'让双方注意彼此已经说出的矛盾，可能令争论升温。不会创造没发生的承诺或使他们必须相信你。',plain:'请双方核对原日期，请梅里克读出修订说明，不替任何人编造内心或承诺。',result:'两张原告示已被实际比较，旧时间没有变成新事实。双方知道哪里有差异，仍可拒绝接受对方解释。',outcome:'NOTICES_COMPARED'},
 {id:'stage-rivalry',title:'排练里的争胜心',story:'成年演员拉维妮和同伴都想取得开场位置，正在空台上争论。诺艾拉说明只观察谈话，不许为了扮演逼他们进行危险表演。',facts:['拉维妮当面表示想先上场，同伴也表达同样愿望。','原排练单没有决定先后，台边器具不能拿来试探伤人。'],incite:'触动已经表达的争胜心，观察对方选择；出现激烈争执后立即结束自己的挑动，不能强迫继续。',plain:'建议本次先停排练，把顺序交回两人和场务商量，不替他们决定谁必须退让。',result:'这次排练已停止，场务保管原排练单。两人仍要自行谈妥先后，玩家没有夺走他们的选择。',outcome:'REHEARSAL_STOPPED'},
] as const;
export const INSTIGATOR_ENVIRONMENT='三段G原创社会情境：教唆只触动已显露的恶欲或矛盾，不是强制控制。教唆为意志难度12、1灵性；普通核实为知识难度10、不耗灵性。争执升温后先0行动停止挑动并退开，不能把离场当作对方已原谅。';
export const instigatorInside=(s:SliceState)=>Object.values(s.instigator.cases).some(r=>r.tension==='HEATED');
export const isInstigatorActivity=(c:InstigatorCommand):c is InstigatorActivityCommand=>['OBSERVE','PREPARE','PERFORM','SETTLE','REPORT','WITHDRAW','REFLECT'].includes(c.type);
function blocked(s:SliceState,c:InstigatorActivityCommand):string|null{
 if(s.status!=='ACTIVE')return'当前周目已结束。';
 if(s.progression.pathwayId!=='demoness'||s.progression.sequence!==8)return'先成为教唆者。';
 const r='caseId'in c?s.instigator.cases[c.caseId]:null;
 if(c.type==='SETTLE')return r?.tension==='HEATED'?null:'没有尚待结束的激烈谈话。';
 if(instigatorInside(s))return'先0行动停止挑动并退开，结束这次谈话。';
 if(s.activeEvent||s.combat)return'先处理当前事件或战斗。';
 if(s.world.city!=='BACKLUND')return'需要回到原街区。';
 if(c.type==='WITHDRAW')return r?.status==='PREPARED'?null:'没有待取消的准备。';
 if(s.health<=0||s.mind<=0)return'先休养恢复身体与精神。';
 if(s.actionsRemaining<1)return'需要1行动。';
 if(c.type==='REFLECT')return s.instigator.reflected?'已经回看本次经历。':CASES.some(p=>s.instigator.cases[p.id]?.status!=='RESOLVED')?'先结束三段谈话并记录实际后果。':null;
 if(!r)return'未知原现场。';if(r.status==='RESOLVED')return'这一段已经结束。';
 if(c.type==='OBSERVE')return r.status==='AVAILABLE'?null:'原观察已经保留。';
 if(c.type==='PREPARE')return r.status!=='OBSERVED'?'先听清当事人已说出的顾虑。':r.attemptWeek===s.week?'本周未成，下周再准备。':null;
 if(c.type==='REPORT')return r.status==='EXAMINED'?null:'先实际进行并结束本次谈话。';
 if(r.status!=='PREPARED')return'先准备本次方法。';
 return r.method==='INCITE'&&s.spirituality<1?'需要1灵性，或取消后改用普通核实。':null;
}
export function applyInstigatorActivity(s:SliceState,c:InstigatorActivityCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void){
 const reason=blocked(s,c);if(reason)throw new Error(reason);const m=s.instigator;
 if(c.type==='SETTLE'){m.cases[c.caseId]!.tension='SETTLED';ctx.note('停止挑动，给双方留出距离','你结束自己的影响并退到原谈话边缘，诺艾拉接过现场秩序；若你精神不支，她会让双方分开。0行动、不抽签、不返已花灵性。争执事实保留，对方不因此自动冷静、原谅或服从。');return;}
 if(c.type==='WITHDRAW'){const r=m.cases[c.caseId]!;r.status='OBSERVED';r.method=null;r.withdrawals++;ctx.note('取消这次准备','0行动取消，尚未施加影响；原观察与已花行动保留，不生成谈话成果。');return;}
 s.actionsRemaining--;
 if(c.type==='REFLECT'){m.reflected=true;s.seer.completedSources.push('instigator-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('看见影响，也承担后果','你回看三段谈话：触动矛盾可以改变气氛，不能制造事实或接管别人的决定。停止挑动并不抹掉后果。扮演+25。');return;}
 const p=CASES.find(p=>p.id===c.caseId)!,r=m.cases[c.caseId]!;
 if(c.type==='OBSERVE'){r.status='OBSERVED';ctx.note(p.title,p.story+' '+p.facts.join(' '));return;}
 if(c.type==='PREPARE'){r.status='PREPARED';r.method=c.method;ctx.note(p.title,c.method==='INCITE'?p.incite:p.plain);return;}
 if(c.type==='REPORT'){r.status='RESOLVED';s.progression.acting=Math.min(100,s.progression.acting+25);award(`instigator-case:${p.id}`,8);ctx.note(p.title,p.result+'记录本人真正说过的话和本次后果，扮演+25、已知能力单项掌握+8。');return;}
 r.attemptWeek=s.week;const incite=r.method==='INCITE';if(incite)s.spirituality--;
 const result=ctx.check(incite?'will':'knowledge',incite?12:10);
 if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){r.status='EXAMINED';r.outcome=p.outcome;r.tension=incite?'HEATED':'CALM';ctx.note(p.title,p.result+(incite?'争执实际升温，先停止自己的挑动并退开；不会因此获得额外攻击或控制机会。':'这次采用原事实核实，尚需记录实际结果。'));}
 else{r.status='OBSERVED';if(result.tier==='GREAT_FAILURE')s.mind=Math.max(0,s.mind-5);ctx.note(p.title,'对方没有按预期回应，你停止这次尝试，没有取得谈话成果，也没有凭空知道其内心。'+(result.tier==='GREAT_FAILURE'?'精神压力损失至多5精神。':'')+'实际成本保留，下周可以重新准备。');}
}
export function instigatorActions(s:SliceState):InstigatorAction[]{
 if(s.progression.pathwayId!=='demoness'||s.progression.sequence!==8)return[];const out:InstigatorAction[]=[];
 const add=(id:string,label:string,cost:string,command:InstigatorActivityCommand)=>{const reason=blocked(s,command);out.push({id,label,cost,command,enabled:reason===null,reason});};
 for(const p of CASES){const r=s.instigator.cases[p.id]!;
 if(r.tension==='HEATED')add(p.id+'-settle','停止挑动并退开','0行动 · 保留真实后果',{type:'SETTLE',caseId:p.id});
 if(r.status==='AVAILABLE')add(p.id+'-observe','听清已经说出的顾虑','1行动',{type:'OBSERVE',caseId:p.id});
 if(r.status==='OBSERVED'){add(p.id+'-incite','准备触动已有矛盾','1行动 · 实际使用另耗1灵性 · 意志12',{type:'PREPARE',caseId:p.id,method:'INCITE'});add(p.id+'-plain','准备普通事实核实','1行动 · 知识10 · 不耗灵性',{type:'PREPARE',caseId:p.id,method:'PLAIN'});}
 if(r.status==='PREPARED'){add(p.id+'-perform','实际进行这次谈话',r.method==='INCITE'?'1行动 · 1灵性':'1行动 · 不耗灵性',{type:'PERFORM',caseId:p.id});add(p.id+'-withdraw','取消本次准备','0行动 · 不返已花行动',{type:'WITHDRAW',caseId:p.id});}
 if(r.status==='EXAMINED')add(p.id+'-report','记录真实回应与后果','1行动',{type:'REPORT',caseId:p.id});}
 if(!s.instigator.reflected)add('instigator-reflect','回看影响与他人选择的边界','1行动 · 三段结束后',{type:'REFLECT'});return out;
}
export function instigatorCases(s:SliceState):InstigatorProjection['cases']{if(s.instigator.promotionWeek===null)return[];return CASES.map(p=>{const r=s.instigator.cases[p.id]!;return{id:p.id,title:p.title,story:p.story,observations:r.status==='AVAILABLE'?[]:[...p.facts],preparation:r.status==='PREPARED'?(r.method==='INCITE'?p.incite:p.plain):null,result:['EXAMINED','RESOLVED'].includes(r.status)?p.result:r.attemptWeek!==null?'此前未成，实际成本与观察保留。':r.withdrawals?'本次准备已经取消。':null,status:r.status,tension:r.tension==='HEATED'?'谈话激烈：先停止挑动并退开':r.tension==='SETTLED'?'本次影响已结束，后果没有抹去':'没有持续激烈谈话'};});}
export function validateInstigatorLife(s:SliceState):boolean{const m=s.instigator;if(!m?.cases)return false;for(const p of CASES){const r=m.cases[p.id];if(!r)return false;if((r.status==='RESOLVED')!==s.seer.completedSources.includes(`instigator-case:${p.id}`))return false;const done=['EXAMINED','RESOLVED'].includes(r.status);if(done){if(r.attemptWeek===null||r.method===null||r.outcome!==p.outcome)return false;}else if(r.outcome!=='NONE')return false;if(r.status==='PREPARED'&&r.method===null)return false;if(r.status==='AVAILABLE'&&(r.method!==null||r.attemptWeek!==null||r.withdrawals))return false;if(r.method==='INCITE'&&done?r.tension==='CALM':r.tension!=='CALM')return false;if(r.tension==='HEATED'&&(r.status!=='EXAMINED'||s.activeEvent!==null||s.combat!==null||s.status!=='ACTIVE'||s.world.city!=='BACKLUND'))return false;if(r.status==='RESOLVED'&&r.tension==='HEATED')return false;}return m.reflected===s.seer.completedSources.includes('instigator-reflection')&&(!m.reflected||CASES.every(p=>m.cases[p.id]?.status==='RESOLVED'));}
