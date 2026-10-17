import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { LongChapterCommand, LongChapterProjection } from "../domain/long-chapter/types";
import "./seer-styles.css";

type Action = LongChapterProjection["actions"][number];
type Confirmation = { action: Action; facts: string };

export interface LongChapterPanelProps {
  value: LongChapterProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: LongChapterCommand) => void;
  /** Dismisses the page only. Returning the original book and cancelling remain public commands. */
  onClose?: () => void;
}

function Facts({ title, entries }: { title: string; entries: string[] }) {
  return <section aria-label={title}><h4>{title}</h4>
    {entries.length > 0 ? <ul>{entries.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      : <p className="slice-muted">尚无这一阶段的实际记录。</p>}
  </section>;
}

function confirmationFacts(value: LongChapterProjection, action: Action) {
  return JSON.stringify({ phase: value.phase, dates: value.dates, consequences: value.consequences,
    body: value.body, currentIdentity: value.currentIdentity, people: value.people, objects: value.objects,
    action: { id: action.id, cost: action.cost, command: action.command } });
}

/** The renderer displays committed facts. It never advances a date or marks a memory recovered. */
export function LongChapterPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: LongChapterPanelProps) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const submittedProjection = useRef<LongChapterProjection | null>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const locked = busy || blocked || error !== null || submittedId !== null;
  const liveAction = confirmation ? value.actions.find(action => action.id === confirmation.action.id
    && confirmationFacts(value, action) === confirmation.facts) : undefined;
  const isPayment = confirmation?.action.command.type === "PAY_RESIDENCE";

  useEffect(() => {
    if (!busy && error === null && submittedProjection.current !== null && submittedProjection.current !== value) {
      submitted.current = null; submittedProjection.current = null; setSubmittedId(null);
      setConfirmation(null);
    }
    if (confirmation && !busy && error === null && !liveAction) setConfirmation(null);
  }, [value, busy, error, confirmation, liveAction]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function submit(action: Action) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedProjection.current = value; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: Action) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "PAY_RESIDENCE" || action.command.type === "LIVE_TO_CYCLE") {
      returnActionId.current = action.id;
      setConfirmation({ action, facts: confirmationFacts(value, action) });
    } else submit(action);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。"
      : "请使用保存错误处的重试，继续同一原操作；不要重复付费、推进日期或寻回记忆。"}
  </p>;
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;
  const chronology = <Facts title="真实日期与经过" entries={value.dates} />;
  const originals = <Facts title="同一原物与处置" entries={value.objects} />;
  const people = <Facts title="旧人后果与本时代守护人" entries={value.people} />;

  if (confirmation) return <section className="seer-panel warrior-panel seer-confirmation long-chapter-panel"
    aria-label={isPayment ? "长期供养付费确认" : "不可逆时代推进确认"} aria-busy={busy || submittedId !== null}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{isPayment ? "第一次确认 · 只落实供养" : "第二次确认 · 真实经过与旧时代结束"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{isPayment ? "支付当前余款，落实长期供养？" : "不可逆地生活至首次六十年周年？"}</h3>
    <p>{value.summary}</p><p><strong>本次实际成本：</strong>{liveAction?.cost ?? confirmation.action.cost}</p>
    {isPayment ? <>
      <p>{playerText("供养出资为本作G原创档案会补助后的个人承担，总额960便士；四项不同的实际档案劳动各抵扣200便士。这里只按当前已完成的劳动扣除余款，不把它当作现实六十年市场价。")}</p>
      <p>本次确认只付费并落实居所，不推进六十年。真正跨入后世还需另一项不可逆确认；在那之前可以实际取回原簿、取消安排并返回原时代。已经实际支付的供养款不退款。</p>
    </> : <>
      <p className="slice-notice seer-risk">这是不可逆的世界日期推进。终点沿用原晋升日登记的首次六十年周年，不从今天重算六十年。旧职业、旧委托与原人际现场将成为只读历史；不会累积这些年的工资、补货、旧案奖励或消化。</p>
      <p>{playerText("到达周年后停在同一身体的周期性死亡，需另行等待本作G的7天才复起。7天是本作有限等待规则，原著实际复起时长未知。普通战斗死亡不因此获得复起入口。")}</p>
      <p>复起后丧失大部分记忆。原册外部文字可以查阅，三次有来源的实际寻回只恢复部分核心事实；不等于恢复完整人生，也不增加旧扮演或掌握。</p>
    </>}
    {chronology}<Facts title="本次安排的真实后果" entries={value.consequences} />{people}{originals}
    <p className="slice-muted">{value.boundary}</p>
    {liveAction?.reason && <p className="seer-action-reason" id="long-chapter-confirm-reason">{liveAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>
        {isPayment ? "暂不付费，返回安排" : "暂不推进，返回安排"}
      </button>
      <button className="slice-button" disabled={locked || !liveAction?.enabled}
        aria-describedby={liveAction?.reason ? "long-chapter-confirm-reason" : undefined}
        onClick={() => { if (liveAction) submit(liveAction); }}>
        {isPayment ? "确认支付当前余款，仅落实供养" : "确认不可逆推进至首次周年"}
      </button>
    </div>
    <p className="slice-muted">关闭本确认不会提交行动。提交后等待同一次保存回执，不重复扣款或推进。</p>
    {pendingNotice}{saveNotice}
  </section>;

  return <section className="seer-panel warrior-panel long-chapter-panel" aria-label="长期章节" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="长期章节当前处境">
      <span className="seer-seal">{value.eraClosed ? playerText("本作G原创后世") : "首次六十年周期"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3><p className="seer-next">{value.summary}</p>
      <p>{value.boundary}</p>
      {value.eraClosed && <p className="slice-notice">{playerText("此处是本作G的有限后世接待处，已经跨过原作末日时间线，不代表原著未来。原城市布局、人际与旧职业不保证延续；旧场景只供查阅历史。")}</p>}
    </section>
    {chronology}
    <section className="slice-notice" aria-label="同一身体与当前身份"><h4>同一身体与当前身份</h4>
      <p>{value.body}</p><p>{value.currentIdentity}</p>
      {value.phase === "CYCLE_DEAD" && <p>身体处于周期性死亡。本周目等待专用复起流程，不能执行普通生活、治疗、战斗或旧时代行动。</p>}
    </section>
    <section aria-label="长期章节当前行动"><h4>{value.eraClosed ? "本时代接待处" : "实际安排与退出"}</h4>
      {value.actions.length > 0 ? <div className="warrior-action-list" role="group" aria-label="长期章节公开行动">
        {value.actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
          <button className="slice-choice" disabled={locked || !action.enabled}
            ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
            aria-describedby={action.reason ? `long-chapter-reason-${action.id}` : undefined}
            onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
          {action.reason && <p className="seer-action-reason" id={`long-chapter-reason-${action.id}`}>{action.reason}</p>}
        </div>)}
      </div> : <p className="slice-muted">当前没有可提交的长期章节行动，请查看上方条件与已保存记录。</p>}
      <p className="slice-muted">付费与不可逆推进分别确认。取消安排、原簿放入保管箱和亲手取回都以各自实际行动为准；关闭页面不移动原物、不退款、不推进日期。</p>
    </section>
    <Facts title="本次安排的真实后果" entries={value.consequences} />{people}{originals}
    <section aria-label="外部记录与部分记忆"><h4>外部记录与部分记忆</h4>
      <p className="slice-muted">读到原册或历史文字不等于本人已经想起。下面只显示已保存的记忆状态；寻回仅恢复有限核心事实，其余人生记忆仍可能缺失。</p>
      {value.memory.length > 0 ? <ul>{value.memory.map((entry, index) => <li key={index}>{entry}</li>)}</ul> : <p>尚无实际记忆寻回记录。</p>}
    </section>
    <section aria-label="本时代生活约定"><h4>本时代生活约定</h4><p>{value.occupation}</p></section>
    <details className="seer-fold"><summary>已保存的时代与原物历史</summary><Facts title="只读历史记录" entries={value.history} /></details>
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭长期章节页面</button>}
    {pendingNotice}{saveNotice}
  </section>;
}
