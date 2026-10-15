import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {ProvokerCommand,ProvokerAction} from './types.js';
const CASES=[
 {id:'invoice-claim',title:'贴在货门上的欠费告示',before:'账房贝丝请你核对一张临时告示。收费员声称这批货没有缴清费用；你可以到公开账台查看原收据与告示的具体日期。',after:'你亲眼核对：收据盖的是昨天的收款章，告示却把同一笔费用列为今天的欠费。收费员当众坚持自己从不记错。这是可核对的矛盾，不说明他的内心或全部账目。',challenge:'当面指出日期矛盾，要求他兑现自己的话',peace:'先把两份日期交给贝丝，请当事人复核'},
 {id:'queue-boast',title:'只认先后的搬运头领',before:'搬运头领威斯在院门分配空车次序。你可花时间查看公开号码单，并听他怎样向等候者说明规则。',after:'你实际听见威斯反复强调“我只认先来后到”，也看到他把熟人的晚号车插到了早号前。他重视自己当众许下的说法，这提供了针对本次行为交涉的依据，不保证他会认错。',challenge:'拿原号码单反问，让他当众说明插队',peace:'请车主按号排开，给威斯留下改正余地'},
 {id:'yard-hound',title:'围栏里的看守犬',before:'院子主人艾达的成年看守犬在搬货声中紧张吠叫。门外有稳固隔栏，旁边空犬舍有可以由艾达关闭的门。先到安全处观察实际位置与通道。',after:'你在隔栏后亲见看守犬能沿院内短道走进空犬舍；艾达已握着原门闩，通道没有别人。它无法理解你的辩论，针对人的言语技巧不适用。憎恶气息只可能引它向你所在方向接近，不是驯服或控制。',challenge:'在安全侧散发憎恶气息，配合主人关门',peace:'不刺激它，等待主人按熟悉的口令引导'},
] as const;
export const PROVOKER_STORY='货栈入口的威斯扣住了本来可以通行的空车，坚持由自己重新安排顺序。贝丝希望你陪车主当面解决，原空车与货物仍由各主人保管。可以依据已经亲见的号码单交涉，也可以承担真实伤亡风险介入；退出保留争议，不会把车或同伴自动带走。';
type Award=(source:string,amount:5|8|25)=>void;
const won=(tier:string)=>tier==='SUCCESS'||tier==='GREAT_SUCCESS';
function common(s:SliceState){return s.status!=='ACTIVE'?'当前周目无法行动。':s.progression.pathwayId!=='hunter'||s.progression.sequence!==8?'成为挑衅者后才能进行这些实践。':s.world.city!=='BACKLUND'?'需要本人返回贝克兰德。':s.activeEvent||s.combat?'先处理当前事件或战斗。':s.health<=0||s.mind<=0?'先休养恢复身体与精神。':s.actionsRemaining<1?'需要1行动。':null;}
function blocked(s:SliceState,c:ProvokerCommand):string|null{
 const reason=common(s);if(reason)return reason;
 if(c.type==='OBSERVE'||c.type==='CHOOSE'){
  const entry=CASES.find(x=>x.id===c.caseId),record=s.provoker.cases[c.caseId];if(!entry||!record)return '未知的公开情境。';
  if(record.status==='COMPLETED')return '这一情境已有结果，不重复发奖。';
  if(c.type==='OBSERVE')return record.status!=='AVAILABLE'?'已经亲自核实本次公开事实。':null;
  if(record.status!=='OBSERVED')return '先亲自观察，不凭空猜测人物弱点或动物位置。';
  if(record.attemptWeek===s.week)return '本周已经试过，留出时间后再来。';
  const choices=entry.id==='yard-hound'?['ATTRACT','WAIT']:['CHALLENGE','DEESCALATE'];if(!choices.includes(c.choice))return '这不是该情境的真实选择。';
  return (c.choice==='CHALLENGE'||c.choice==='ATTRACT')&&s.spirituality<2?'这次能力实践需要2灵性。':null;
 }
 if(c.type==='REFLECT')return s.provoker.reflected?'已经整理过这段经历。':CASES.some(x=>s.provoker.cases[x.id]?.status!=='COMPLETED')||s.provoker.encounter.status!=='RESOLVED'?'先完成三段实践并解决货栈争议。':null;
 if(c.type==='ENCOUNTER_TALK'||c.type==='ENCOUNTER_FIGHT'){
  if(s.provoker.cases['queue-boast']?.status==='AVAILABLE')return '先观察威斯与原号码单，弄清当面争议。';
  if(s.provoker.encounter.status!=='AVAILABLE')return '本次货栈争议已经结算。';
  return c.type==='ENCOUNTER_TALK'&&s.provoker.encounter.attemptWeek===s.week?'本周交涉未成，可另行承担战斗风险或下周再谈。':null;
 }
 return '未知实践。';
}
export function provokerAdventureCases(s:SliceState){return s.progression.pathwayId==='hunter'&&(s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===4||s.progression.sequence===3))?CASES.map(x=>({id:x.id,title:x.title,story:s.provoker.cases[x.id]?.status==='AVAILABLE'?x.before:x.after})):[];}
export function provokerAdventureActions(s:SliceState):ProvokerAction[]{
 if(s.progression.pathwayId!=='hunter'||s.progression.sequence!==8)return [];
 const add=(id:string,label:string,cost:string,command:ProvokerCommand):ProvokerAction=>{const reason=blocked(s,command);return{id,label,cost,command,enabled:!reason,reason};};
 const actions:ProvokerAction[]=[];
 for(const c of CASES){const r=s.provoker.cases[c.id];if(r?.status==='COMPLETED')continue;
  if(r?.status==='AVAILABLE')actions.push(add(`observe-${c.id}`,`亲自核实：${c.title}`,'1行动 · 获得眼前可见的具体事实，不掷骰猜内心',{type:'OBSERVE',caseId:c.id}));
  else {actions.push(add(`challenge-${c.id}`,c.challenge,'1行动 · 2灵性 · 可能被拒绝；人的冲突可能导致推搡受伤',{type:'CHOOSE',caseId:c.id,choice:c.id==='yard-hound'?'ATTRACT':'CHALLENGE'}));actions.push(add(`peace-${c.id}`,c.peace,'1行动 · 0灵性 · 沿真实普通方法解决，不保证成功',{type:'CHOOSE',caseId:c.id,choice:c.id==='yard-hound'?'WAIT':'DEESCALATE'}));}
 }
 if(s.provoker.encounter.status==='AVAILABLE'){actions.push(add('provoker-talk','陪车主当面交涉','1行动 · 意志难度14 · 原物不转移',{type:'ENCOUNTER_TALK'}));actions.push(add('provoker-fight','介入货栈争议','1行动 · 真实战斗，可能受伤或死亡；没有自动战利品',{type:'ENCOUNTER_FIGHT'}));}
 if(!s.provoker.reflected)actions.push(add('provoker-reflect','整理激怒与克制的界限','1行动 · 三实践与争议解决后 · 扮演+20仅一次',{type:'REFLECT'}));
 return actions;
}
export function applyProvokerAdventure(s:SliceState,c:ProvokerCommand,ctx:SeerContext,award:Award){
 const reason=blocked(s,c);if(reason)throw new Error(reason);s.actionsRemaining--;
 if(c.type==='OBSERVE'){const entry=CASES.find(x=>x.id===c.caseId)!;s.provoker.cases[c.caseId]!.status='OBSERVED';ctx.note(entry.title,entry.after);return;}
 if(c.type==='CHOOSE'){
  const entry=CASES.find(x=>x.id===c.caseId)!,r=s.provoker.cases[c.caseId]!;r.attemptWeek=s.week;r.choice=c.choice;
  const ability=c.choice==='CHALLENGE'||c.choice==='ATTRACT';if(ability)s.spirituality-=2;
  const result=ctx.check(c.choice==='CHALLENGE'?'will':c.choice==='DEESCALATE'?'knowledge':'perception',c.choice==='CHALLENGE'||c.choice==='WAIT'?14:12);
  if(won(result.tier)){r.status='COMPLETED';s.progression.acting=Math.min(100,s.progression.acting+20);award(`provoker-case:${c.caseId}`,8);ctx.note(entry.title,entry.id==='yard-hound'?'看守犬实际走进空犬舍，艾达随即关闭原门；犬仍归主人照看，没有被驯服或成为你的能力。扮演+20，单项掌握+8。':`${c.choice==='CHALLENGE'?'对方被具体矛盾激怒后亲自翻看原记录，最终改正这一次安排；仍不喜欢你的做法。':'当事人按原记录重新安排，你没有代替他作出所有决定。'} 本次事实留下记录，扮演+20，单项掌握+8。`);}
  else {if(c.choice==='CHALLENGE'){s.health-=4;s.mind-=5;}else if(c.choice==='ATTRACT')s.mind-=5;ctx.note(entry.title,c.choice==='CHALLENGE'?'对方拒绝认错并推开你；健康−4、精神−5。原争议未解决，本周不重复尝试，可休养后再来。':c.choice==='ATTRACT'?'看守犬没有沿预期方向接近，艾达保持原门开放，你仍在隔栏安全侧；精神−5，未完成安置。':'普通协商暂未奏效；原人物和物品没有被改写，下周可再试。');}
  return;
 }
 if(c.type==='REFLECT'){s.provoker.reflected=true;s.seer.completedSources.push('provoker-reflection');s.progression.acting=Math.min(100,s.progression.acting+20);ctx.note('激怒不等于支配','你整理三段亲见经历和货栈结果：针对性反应依赖实际了解，也会带来敌意；克制或退出同样需要判断。扮演+20，没有追加掌握或抹去旧失败。');return;}
 const e=s.provoker.encounter;e.attemptWeek=s.week;
 if(c.type==='ENCOUNTER_TALK'){const r=ctx.check('will',14);if(won(r.tier)){e.status='RESOLVED';e.enemyStatus='SURRENDERED';s.progression.acting=Math.min(100,s.progression.acting+20);award('provoker-dispute',8);ctx.note('货道重新开放','威斯在当面记录前让开原通路，车主带走自己的空车。扮演+20、单项掌握+8，不取得他人的物品。');}else ctx.note('威斯没有让路','他仍坚持原来的安排，没有被一句话控制。可等下一周再谈，也可自行承担有伤亡风险的介入。');return;}
 e.status='FIGHTING';e.startHistoryIndex=s.combatHistory.length;
 s.combat={encounterId:'PROVOKER_DISPUTE',round:1,enemyHealth:100,enemyMind:100,enemyInjuries:[],enemyRisk:0,enemyStatus:'RESISTING',lastRound:null};ctx.note('货栈入口冲突',PROVOKER_STORY+' 你已实际到场，威斯举起手中的普通短棍。');
}
export function settleProvokerEncounter(s:SliceState,outcome:string,ctx:SeerContext,award:Award){
 if(outcome==='CONTINUE')return;const e=s.provoker.encounter;e.enemyStatus=s.combat!.enemyStatus;
 e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';
 const effective=s.combatHistory.slice(e.startHistoryIndex??s.combatHistory.length).some(r=>r.retreat==='NONE'&&r.moves.some(m=>m.actor==='PLAYER'&&(m.selfGain>0||m.enemyReduction>0)));
 if(outcome!=='PLAYER_DEAD'&&effective)award('provoker-dispute',25);
 if(e.status==='RESOLVED')s.progression.acting=Math.min(100,s.progression.acting+20);
 ctx.note('货栈冲突结果',e.status==='RESOLVED'?'本场抵抗结束，原通路可以使用。各人的空车与物品仍归本人，没有自动夺取。':e.status==='RETREATED'?'你已真实退离。争议与在场他人的后续未解决，不自动带走他们或原物。':'你的死亡已经结算，原物没有进你的库存，本场不发成长。');s.combat=null;
}
export function validateProvokerAdventure(s:SliceState){
 const p=s.provoker;if(Object.keys(p.cases).length!==CASES.length)return false;
 for(const c of CASES){const r=p.cases[c.id];if(!r||!['AVAILABLE','OBSERVED','COMPLETED'].includes(r.status)||r.attemptWeek!==null&&(!Number.isSafeInteger(r.attemptWeek)||r.attemptWeek<1||r.attemptWeek>s.week))return false;
  const choices=c.id==='yard-hound'?['ATTRACT','WAIT']:['CHALLENGE','DEESCALATE'];if(r.choice!==null&&!choices.includes(r.choice))return false;
  if((r.choice===null)!==(r.attemptWeek===null)||r.status==='AVAILABLE'&&r.choice!==null)return false;
  if((r.status==='COMPLETED')!==s.seer.completedSources.includes(`provoker-case:${c.id}`))return false;
 }
 if(p.reflected!==s.seer.completedSources.includes('provoker-reflection')||p.reflected&&(CASES.some(c=>p.cases[c.id]?.status!=='COMPLETED')||p.encounter.status!=='RESOLVED'))return false;
 if((p.encounter.status==='FIGHTING')!==(s.combat?.encounterId==='PROVOKER_DISPUTE'))return false;
 if(p.encounter.status!=='AVAILABLE'&&p.cases['queue-boast']?.status==='AVAILABLE')return false;
 return true;
}
