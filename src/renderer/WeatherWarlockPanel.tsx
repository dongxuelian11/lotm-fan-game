import {useEffect,useRef,useState} from 'react';
import type {WeatherWarlockProjection,WeatherWarlockAction,WeatherWarlockCommand} from '../domain/weather-warlock/types';
import './seer-styles.css';
export interface WeatherWarlockPanelProps {value:WeatherWarlockProjection;busy:boolean;blocked?:boolean;error?:string|null;onCommand:(command:WeatherWarlockCommand)=>void;onClose?:()=>void}
const ACQ=new Set(['LEARN_GUIDANCE','REQUEST_SUPPLY','RECEIVE_SUPPLY','PREPARE_PROMOTION','LEAVE_PREPARATION','PREPARE_TASK','POTION_WORK','BUY_POTION','CONSUME']);
const NODE={NEAR:'原近端',WORK:'四米外工位'};
export function WeatherWarlockPanel({value,busy,blocked=false,error=null,onCommand,onClose}:WeatherWarlockPanelProps){
 const [selected,setSelected]=useState<string|null>(null),[bottleId,setBottleId]=useState<string|null>(null);
 const [confirmation,setConfirmation]=useState<{action:WeatherWarlockAction;facts:string}|null>(null),[submitted,setSubmitted]=useState(false);
 const submittedRef=useRef(false),submittedFacts=useRef<string|null>(null),heading=useRef<HTMLHeadingElement>(null),dialog=useRef<HTMLDialogElement>(null),confirmButton=useRef<HTMLButtonElement>(null),returnButton=useRef<HTMLButtonElement|null>(null);
 const facts=JSON.stringify(value),locked=busy||blocked||error!==null||submitted;
 const p=value.life.practice,e=value.encounter;
 const current=value.life.cases.find(c=>c.id===p.activeCase)||value.life.cases.find(c=>c.status==='PREPARED')||value.life.cases.find(c=>c.id===selected)||value.life.cases.find(c=>c.status!=='RESOLVED')||value.life.cases[0];
 const bottle=value.bottles.find(b=>b.id===bottleId)||value.bottles.find(b=>b.status.includes('已交付'))||value.bottles.find(b=>b.status.includes('供应方'))||value.bottles[0];
 const currentActions=value.actions.filter(a=>e.inside?e.actions.some(x=>x.id===a.id):!value.promoted?ACQ.has(a.command.type)&&(!('bottleId'in a.command)||a.command.bottleId===bottle?.id):!ACQ.has(a.command.type)&&!e.actions.some(x=>x.id===a.id)&&(!('caseId'in a.command)||a.command.caseId===current?.id));
 const confirmed=confirmation&&confirmation.facts===facts?value.actions.find(a=>a.id===confirmation.action.id&&a.enabled):undefined;
 useEffect(()=>{heading.current?.focus();},[]);
 useEffect(()=>{if(!busy&&!error&&submittedFacts.current!==null&&submittedFacts.current!==facts){submittedRef.current=false;submittedFacts.current=null;setSubmitted(false);setConfirmation(null);heading.current?.focus();}else if(confirmation&&!submittedRef.current&&confirmation.facts!==facts)setConfirmation(null);},[facts,busy,error,confirmation]);
 useEffect(()=>{if(confirmation){if(dialog.current?.showModal&&!dialog.current.open)dialog.current.showModal();confirmButton.current?.focus();}else{returnButton.current?.focus();}},[confirmation]);
 function submit(a:WeatherWarlockAction){if(locked||submittedRef.current||!a.enabled)return;submittedRef.current=true;submittedFacts.current=facts;setSubmitted(true);setConfirmation(null);onCommand(a.command);}
 function choose(a:WeatherWarlockAction,node:HTMLButtonElement){if(locked||!a.enabled)return;if(a.command.type==='CONSUME'){returnButton.current=node;setConfirmation({action:a,facts});}else submit(a);}
 function actions(list:WeatherWarlockAction[],label:string){return <div role="group" aria-label={label}>{list.map(a=><div className="seer-action" key={a.id}><button className="slice-choice" disabled={locked||!!confirmation||!a.enabled} aria-describedby={a.reason?`ww-reason-${a.id}`:undefined} onClick={ev=>choose(a,ev.currentTarget)}><strong>{a.label}</strong><span>{a.cost}</span></button>{a.reason&&<p id={`ww-reason-${a.id}`}>{a.reason}</p>}</div>)}</div>}
 return <section className="seer-panel" aria-label="天气术士" aria-busy={busy||submitted}>
 <h3 ref={heading} tabIndex={-1}>{value.title}</h3><p>{value.promoted?'天气术士2 · 原队与有限天气':'战争主教3 → 天气术士2'}</p><p>{value.digestion}</p>
 {value.resources&&<p>健康{value.resources.health}/100 · 精神{value.resources.mind}/100 · 灵性{value.resources.spirituality}/120 · 现金{value.resources.cash} · 行动{value.resources.actionsRemaining} · 排异{value.pollution}</p>}
 {error&&<p role="alert">{error}。保留原提交，使用上方同次重试；没有回退或再次付费。</p>}{submitted&&<p role="status">等待本次保存回执，暂不接受重复行动。</p>}
 {!value.promoted&&bottle&&<label>选择独立原瓶<select aria-label="选择天气术士原瓶" value={bottle.id} disabled={locked||!!confirmation} onChange={ev=>setBottleId(ev.target.value)}>{value.bottles.map(b=><option key={b.id} value={b.id}>{b.title} · {b.status}</option>)}</select></label>}
 {value.promoted&&<>
 <label>生活情境<select aria-label="选择天气术士生活情境" value={current?.id||''} disabled={locked||value.insideCase||!!confirmation} onChange={ev=>setSelected(ev.target.value)}>{value.life.cases.map(c=><option key={c.id} value={c.id}>{c.title} · {c.status}</option>)}</select></label>
 {current&&<article><h4>{current.title}</h4><p>{current.story}</p>{current.observations.map((x,i)=><p key={i}>{x}</p>)}<p>{current.preparation}</p><p>{current.result??'尚无本案结果'}</p>{current.attempts.map((a,i)=><p key={i}>第{a.invitedWeek}周：{a.evidence.failed?'能力失败已保留':'本次实际记录'}；{a.evidence.elapsedSeconds}秒、本人步行{a.evidence.ownerWalkedMetres}米，实耗{a.evidence.spiritualitySpent}灵性、本人健康损失{a.evidence.ownerDamage}。原五人总精力支出{a.evidence.memberCosts.reduce((n,m)=>n+m.energySpent,0)}，结果{a.evidence.result}。</p>)}</article>}
 <section aria-label="实际水源与天气现场"><h4>原水和现场后果</h4><p>本人在{NODE[p.ownerNode]}；实际{p.elapsedSeconds}秒，天气{p.weather.effect}余{p.weather.remainingSeconds}秒，能见{p.weather.visibilityMetres}米。</p><p>原水箱{p.reservoir.remainingMl}毫升；同一盘液水{p.tray.liquidMl}、冰{p.tray.iceMl}；原盆{p.basin.waterMl}、空气{p.airborneMl}、地面{p.groundMl}、原挡板沾水{p.fixture.wetMl}毫升。挡板{p.fixture.damaged?'已损坏，停止不修复':'尚完整'}。</p><p>原出口4米；先停止并等余效消退，再沿原路退回、归还和散场。</p>{p.tools.map(t=><p key={t.id}>{t.id}：{t.holder==='RACK'?'原架':t.holder==='WORK'?'原工位':'原近端'}</p>)}</section>
 </>}
 <h4>当前可选行动</h4>{actions(currentActions,'天气术士公开行动')}
 {value.promoted&&<details><summary>原五人的实际资源</summary>{value.life.members.map(m=><p key={m.id}>{m.name} · {m.id} · 健康{m.health}/100、精力{m.energy}/20 · {m.willing?'当前愿意':'未同意'} · {m.present?'实际在院':'在原家'}{m.node?` · ${NODE[m.node]}`:''}</p>)}<p>{value.life.environment}</p></details>}
 <details><summary>独立成品、准备与风险</summary><p>{value.story}</p><p>{value.supplies}</p>{value.preparations.map(x=><p key={x.taskId}>{x.title}：{x.completedWeek===null?'未完成':`第${x.completedWeek}周完成`}</p>)}{value.bottles.map(b=><p key={b.id}>{b.id}：{b.status}。{b.source}</p>)}<p>{value.risk}</p></details>
 <details><summary>继承与能力边界</summary>{value.inheritedHistory.map((x,i)=><p key={i}>{x}</p>)}{value.abilities.map(a=><p key={a.id}>{a.label} · 掌握{a.mastery}：{a.description}</p>)}</details>
 {value.promoted&&<details open={e.inside}><summary>可选真实冲突与普通退出</summary><p>{e.story}</p><p>{e.enemy.name} · H{e.enemy.health}/M{e.enemy.mind}/S{e.enemy.spirituality} · {e.enemy.status}；原棍{e.enemy.weaponId}在{e.enemy.weaponLocation}。</p>{e.facts.map((x,i)=><p key={i}>{x}</p>)}{!e.inside&&actions(e.actions,'天气术士可选遭遇')}</details>}
 {onClose&&<button className="slice-button quiet" disabled={locked||!!confirmation} onClick={onClose}>关闭天气术士页面</button>}
 {confirmation&&<dialog ref={dialog} open={typeof HTMLDialogElement==='undefined'||!HTMLDialogElement.prototype.showModal} aria-labelledby="weather-confirm-title" onCancel={ev=>{ev.preventDefault();if(!locked)setConfirmation(null);}}><h4 id="weather-confirm-title">确认服用天气术士原瓶？</h4><p>{confirmation.action.command.type==='CONSUME'?confirmation.action.command.bottleId:''}</p><p>{value.risk}</p><button disabled={locked} onClick={()=>setConfirmation(null)}>暂不服用，返回准备</button><button ref={confirmButton} disabled={locked||!confirmed} onClick={()=>{if(confirmed)submit(confirmed);}}>确认服用这一原瓶</button></dialog>}
 </section>;
}
