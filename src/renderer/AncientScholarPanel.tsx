import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { AncientScholarAction, AncientScholarCommand, AncientScholarProjection } from "../domain/ancient-scholar/types";
import "./seer-styles.css";

type Confirmation = { action: AncientScholarAction; facts: string };
const PREPARATION_TYPES = new Set([
  "LEARN_FORMULA", "MATERIAL_WORK", "BUY_MATERIALS", "BREW", "REQUEST_SUPPLY", "RECEIVE_SUPPLY",
  "OBTAIN_RECORD", "VERIFY_RECORD", "PREPARE_FACILITY", "FACILITY_WORK",
]);
const CONFIRMATION_COPY = {
  PAY_FACILITY: {
    name: "静封设施付费确认", eyebrow: "第一次确认 · 只支付本次维护",
    heading: "支付当前维护余款？", cancel: "暂不付费，返回准备", confirm: "确认支付，仅落实本次维护",
  },
  ENTER_SECLUSION: {
    name: "不可逆三百年隔绝确认", eyebrow: "第二次确认 · 入舱与真实时间",
    heading: "亲自进入封室，开始完全隔绝？", cancel: "暂不入舱，返回准备", confirm: "确认不可逆入舱，开始完全隔绝",
  },
  EXIT_EARLY: {
    name: "提前结束隔绝确认", eyebrow: "提前退出 · 已流逝的年月不会倒退",
    heading: "中断本次连续隔绝并出舱？", cancel: "继续留在封室", confirm: "确认提前出舱，保留已流逝年月",
  },
  CONSUME: {
    name: "古代学者原瓶服用确认", eyebrow: "原瓶晋升 · 风险与消耗",
    heading: "在封室内服用这瓶原魔药？", cancel: "暂不服药，留在当前现场", confirm: "确认服用这一原瓶",
  },
} as const;
type ConfirmationType = keyof typeof CONFIRMATION_COPY;

export interface AncientScholarPanelProps {
  value: AncientScholarProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: AncientScholarCommand) => void;
  /** Closing a page never leaves the chamber, returns an original, or cancels a preparation. */
  onClose?: () => void;
}

function Facts({ title, entries }: { title: string; entries: string[] }) {
  return <section aria-label={title}><h4>{title}</h4>
    {entries.length ? <ul>{entries.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      : <p className="slice-muted">尚无这一阶段的实际记录。</p>}
  </section>;
}

function confirmationType(action: AncientScholarAction): ConfirmationType | null {
  return Object.hasOwn(CONFIRMATION_COPY, action.command.type) ? action.command.type as ConfirmationType : null;
}

function confirmationFacts(value: AncientScholarProjection, action: AncientScholarAction) {
  return JSON.stringify({
    promoted: value.promoted, eraClosed: value.eraClosed, insideIsolation: value.insideIsolation,
    ritual: value.ritual, bottles: value.bottles, risk: value.risk,
    action: { id: action.id, cost: action.cost, command: action.command },
  });
}

/** All dates, qualifications, original objects and outcomes come from committed public state. */
export function AncientScholarPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: AncientScholarPanelProps) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const submittedProjection = useRef<AncientScholarProjection | null>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const locked = busy || blocked || error !== null || submittedId !== null;
  const liveAction = confirmation ? value.actions.find(action => action.id === confirmation.action.id
    && confirmationFacts(value, action) === confirmation.facts) : undefined;
  const kind = confirmation ? confirmationType(confirmation.action) : null;
  const ritual = value.ritual;
  const preparationActions = value.actions.filter(action => PREPARATION_TYPES.has(action.command.type));
  const practiceActions = value.actions.filter(action => action.id.startsWith("AS3-LIFE:"));
  const encounterActions = value.actions.filter(action => action.id.startsWith("AS3-ENCOUNTER:"));
  const currentActions = value.actions.filter(action => !PREPARATION_TYPES.has(action.command.type)
    && !action.id.startsWith("AS3-LIFE:") && !action.id.startsWith("AS3-ENCOUNTER:"));
  const encounter = value.encounter.encounter;
  const currentCase = value.life.cases.find(entry => entry.id === value.life.practice?.activeCase)
    ?? value.life.cases.find(entry => entry.status !== "RESOLVED");
  const currentPracticeActions = practiceActions.filter(action => "caseId" in action.command
    ? action.command.caseId === currentCase?.id : action.command.type !== "REFLECT" || !currentCase);
  const laterPracticeActions = practiceActions.filter(action => !currentPracticeActions.includes(action));

  useEffect(() => {
    if (!busy && error === null && submittedProjection.current !== null && submittedProjection.current !== value) {
      submitted.current = null; submittedProjection.current = null; setSubmittedId(null); setConfirmation(null);
    }
    if (confirmation && !busy && error === null && !liveAction) setConfirmation(null);
  }, [value, busy, error, confirmation, liveAction]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function submit(action: AncientScholarAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedProjection.current = value; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: AncientScholarAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (confirmationType(action)) {
      returnActionId.current = action.id; setConfirmation({ action, facts: confirmationFacts(value, action) });
    } else submit(action);
  }
  function actionList(actions: AncientScholarAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `ancient-scholar-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`ancient-scholar-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }

  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。"
      : "请使用保存错误处的重试，继续同一原操作；不要重复付费、推进日期或消耗原瓶。"}
  </p>;
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;
  const originals = <Facts title="原件保护与旧物去向" entries={ritual.objects} />;
  const chronology = <Facts title="真实日期与连续隔绝" entries={ritual.dates} />;
  const people = <Facts title="旧人与当代保管人" entries={ritual.people} />;

  if (confirmation && kind) {
    const copy = CONFIRMATION_COPY[kind];
    return <section className="seer-panel warrior-panel seer-confirmation ancient-scholar-panel"
      aria-label={copy.name} aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">{copy.eyebrow}</div>
      <h3 ref={confirmationHeading} tabIndex={-1}>{copy.heading}</h3>
      <p>{ritual.summary}</p><p><strong>本次实际成本：</strong>{liveAction?.cost ?? confirmation.action.cost}</p>
      {kind === "PAY_FACILITY" && <>
        <p>{playerText("静封设施为本作G：本次维护360便士，实际维护劳动可减至120便士；以当前已完成劳动和上方余款为准。已经实际支付的费用不会因退出退还。")}</p>
        <p>这里只支付本次维护，不进入封室、不推进年月。真正入舱还需独立确认不可逆的时代变化；你可以选择继续留在序列4。</p>
      </>}
      {kind === "ENTER_SECLUSION" && <>
        <p className="slice-notice seer-risk">这是不可逆的时代选择。首次亲自入舱后旧时代关闭，完整300年由本人依舱内机械钟分两段真实推进150年与150年；旧职业、旧约定和旧人际现场成为只读历史，不补发三百年的工资、补货或消化。</p>
        <p>普通旧人会老去或故去；室外旧耗材会失效。玛拉不会活着等你三百年，后世接待人另有身份；超凡旧人的未知去向不会被假定为仍在原地。</p>
        <p>静封钟只保护已登记的同一身体、原瓶和原史料。它不治疗入舱旧伤、不恢复灵性、不与外界通信，也不能取走或用于战斗。身在舱内看到的是本地独立记录，不是外界实时消息。</p>
        <p>未满300年提前退出，没有本次晋升资格，已流逝的时间与已付费用不会退回。满300年仍须留在舱内核验连续记录，之后才可服用已登记的原瓶。</p>
        <p>{playerText("若本次已有完整300年履历并获重审，按下方本次登记再隔绝14天。这一重筹规则为本作G，不冒称原著细则；过去已流逝的年月始终保留。")}</p>
      </>}
      {kind === "EXIT_EARLY" && <>
        <p className="slice-notice seer-risk">出舱会中断本次连续隔绝。世界已经过去的年月不会倒退，原费用已经耗去；未满300年不会获得古代学者晋升资格，重新尝试须另作准备并经历新的完整300年。</p>
        <p>你可以继续留在序列4，在实际到达的后世生活。这里只执行投影所列的出舱行动，不替你服药或接回旧时代委托。</p>
      </>}
      {kind === "CONSUME" && <>
        <p className="slice-notice seer-risk">{value.risk}</p>
        <p>成功或失败都会实际消耗所选原瓶。药物排异保护不等于无风险，也不能让普通战斗死亡复活；备用原瓶、付费休养和剩余次数以本次已保存登记为准。</p>
        <p>{playerText("可以暂不服药或选择留在序列4。满300年后若出舱，本次室内服药窗口关闭；后续重筹与14天重新隔绝复审是本作G规则，不是原著已确认细则。")}</p>
        <Facts title="所选原瓶与真实来源" entries={value.bottles.filter(bottle => confirmation.action.command.type === "CONSUME"
          && bottle.id === confirmation.action.command.bottleId).map(bottle => `${bottle.id} · ${bottle.source} · ${bottle.status} · 当前成功率${bottle.chance}%`)} />
      </>}
      {chronology}
      <section aria-label="本次资格与同一身体"><h4>本次资格与同一身体</h4><p>{ritual.qualification}</p><p>{ritual.body}</p></section>
      <Facts title="本次隔绝的真实后果" entries={ritual.consequences} />
      {(kind === "ENTER_SECLUSION" || kind === "EXIT_EARLY") && <>{people}{originals}</>}
      <p className="slice-muted">{ritual.boundary}</p>
      {liveAction?.reason && <p className="seer-action-reason" id="ancient-scholar-confirm-reason">{liveAction.reason}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>{copy.cancel}</button>
        <button className="slice-button" disabled={locked || !liveAction?.enabled}
          aria-describedby={liveAction?.reason ? "ancient-scholar-confirm-reason" : undefined}
          onClick={() => { if (liveAction) submit(liveAction); }}>{copy.confirm}</button>
      </div>
      <p className="slice-muted">返回只取消这次未提交的确认。提交后等待同一次保存回执，不重复付费、跳时或饮药。</p>
      {pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel warrior-panel ancient-scholar-panel" aria-label="古代学者" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="古代学者当前处境">
      <span className="seer-seal">{value.eraClosed ? playerText("本作G原创后世") : "三百年完全隔绝"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3><p className="seer-next">{ritual.summary}</p>
      <p>{ritual.qualification}</p>
      {value.promoted && <p>古代学者3 · 扮演 {value.acting} · {value.digestion} · 污染 {value.pollution}</p>}
      {value.eraClosed && <p className="slice-muted">{playerText("旧场景、旧NPC与旧库存仅为历史。当前时代是跨原作末日后的本作G分支，不代表原著未来。")}</p>}
    </section>
    {chronology}
    <section aria-label="古代学者当前行动"><h4>{value.insideIsolation ? "封室内的下一步" : value.promoted ? "本时代生活与古代学者实践" : "实际准备与自己的选择"}</h4>
      {currentActions.length ? actionList(currentActions, "古代学者公开行动")
        : <p className="slice-muted">当前没有可提交的行动。请查看准备条件与已经保存的记录。</p>}
      {!value.promoted && <p className="slice-muted">你可以停留序列4。付费与不可逆入舱分别确认；150年后可选择继续或明确提前退出。</p>}
    </section>
    {preparationActions.length > 0 && <details className="seer-fold"><summary>史料、原瓶与设施准备 · {preparationActions.length} 项公开行动</summary>
      <p>按每项实际来源、费用与条件进行。展开或阅读资料不会自动取得原件、核验真伪或获得资格。</p>
      {actionList(preparationActions, "古代学者筹备行动")}
    </details>}
    {value.promoted && value.life.cases.length > 0 && <section aria-label="古代学者有限实践"><h4>在现在使用真实过去</h4>
      {currentCase ? <article className="seer-current-case" aria-label="当前古代学者实践">
        <h4>{currentCase.title}</h4><p>{currentCase.story}</p>
        {currentCase.preparation && <p>{currentCase.preparation}</p>}
        {currentCase.result && <p className="slice-notice">{currentCase.result}</p>}
        <p>{currentCase.contactOpen} · 实际收束 {currentCase.closes} 次</p>
        {currentCase.observations.length > 0 && <details className="seer-fold"><summary>本项已实际观察的来源与成本</summary>
          <Facts title="本项真实观察" entries={currentCase.observations} />
        </details>}
      </article> : <p>三份不同报告已经留下真实记录。普通方法和能力方法的结果分别保留。</p>}
      {value.life.practice && <section className="slice-notice" aria-label="当下身体与临时效果"><h4>本人、原物与有限效果</h4>
        {value.insideCase && <Facts title="本项实际状态" entries={value.life.practice.facts} />}
        <p>临时储备 {value.life.practice.borrowedReserve} · 还可维持 {value.life.practice.borrowRemainingSeconds} 秒；历史藏身还余 {value.life.practice.shelterRemainingSeconds} 秒；现场实际经过 {value.life.practice.elapsedSeconds} 秒。</p>
        {value.life.practice.image ? <p>唯一影像 {value.life.practice.image.id} · 历史来源 {value.life.practice.image.sourceId} · {value.life.practice.image.massGrams}克 · {value.life.practice.image.position === "NEAR" ? "原近端" : "两米远桌角"} · 本次至多 {value.life.practice.image.remainingSeconds}{playerText(" 秒G。原签仍在原携笼。")}</p>
          : <p>当前没有历史影像。阅读原物记录不会生成影像。</p>}
      </section>}
      {currentPracticeActions.length > 0 && actionList(currentPracticeActions, "当前古代学者实践行动")}
      <details className="seer-fold"><summary>其他实践、真实样本与已完成记录</summary>
        {value.life.practice?.sample && <p>本人真实样本 {value.life.practice.sample.id} · 原身体 {value.life.practice.sample.bodyId} · 第{value.life.practice.sample.week}周实际观察 · 当时健康{value.life.practice.sample.health}、精神{value.life.practice.sample.mind}、灵性{value.life.practice.sample.spirituality}；这不是当前资源补满。</p>}
        {value.life.practice?.fragment && <p>本人已亲历片段 {value.life.practice.fragment.id} · 原身体 {value.life.practice.fragment.bodyId} · 同一接待处安全原垫 {value.life.practice.fragment.place}。</p>}
        {value.life.cases.filter(entry => entry.id !== currentCase?.id).map(entry => <article key={entry.id}><h4>{entry.title}</h4><p>{entry.story}</p><p>{entry.result ?? "尚无本项实际结果。"}</p><p>{entry.contactOpen} · 实际收束 {entry.closes} 次</p></article>)}
        {laterPracticeActions.length > 0 && actionList(laterPracticeActions, "其他古代学者实践行动")}
        <p>{value.life.environment}</p>
      </details>
    </section>}
    {encounter && <details className="seer-fold"><summary>新遭遇与本时代器材（可选）</summary>
      <section aria-label="后世原人遭遇"><h4>{encounter.name}</h4><p>{encounter.story}</p>
        <p>原人 {encounter.targetId} · 健康 {encounter.enemyHealth} · 精神 {encounter.enemyMind} · 灵性 {encounter.enemySpirituality} · {encounter.enemyStatus === "DEAD" ? "已经真实死亡" : encounter.enemyStatus === "SURRENDERED" ? "已停止抵抗" : "本人仍有独立意志"}。</p>
        <p>普通出口：{encounter.originalExit} · 双方相隔 {encounter.distanceMetres} 米。</p>
        <Facts title="本时代原器材与实际资源" entries={encounter.facts} />
        {encounterActions.length > 0 && actionList(encounterActions, "后世可选遭遇行动")}
      </section>
    </details>}
    <details className="seer-fold"><summary>同一身体、静封原件与本地记录</summary>
      <section aria-label="同一身体与固定设施"><h4>同一身体与固定设施</h4><p>{ritual.body}</p><p>{ritual.facility}</p><p>{ritual.boundary}</p></section>
      <Facts title="已保存的连续隔绝记录" entries={ritual.history} />
    </details>
    <details className="seer-fold"><summary>三卷原史料与独立核验副本</summary>
      <section aria-label="原史料与核验"><h4>实际取得与核验记录</h4>
        {ritual.records.map(record => <article key={record.id}><h4>{record.title}</h4><p>{record.id} · {record.status}</p><p>{record.source}</p><p>{record.verification}</p></article>)}
        {ritual.records.length === 0 && <p>尚无实际取得的原史料。</p>}
      </section>
    </details>
    <details className="seer-fold"><summary>独立原瓶、配方来源与服药风险</summary>
      <section aria-label="古代学者独立原瓶"><h4>原瓶来源、状态与真实消耗</h4>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>{bottle.source}</p><p>{bottle.status}</p></article>)}
        {value.bottles.length === 0 && <p>尚未调配出原瓶。</p>}
        <p>{value.supplies}</p><p>{value.risk}</p>
      </section>
      {value.formulaKnown && <section aria-label="已知核心配方"><h4>{playerText("已知核心材料")}</h4><ul>{value.formula.map(item => <li key={item.name}>
        {item.name} · {item.quantity === null ? "用量未记载" : item.quantity}{item.unit}{item.note && `；${item.note}`}
      </li>)}</ul></section>}
      <p>{value.story}</p>
    </details>
    <details className="seer-fold"><summary>旧人、旧物与不可逆时代后果</summary>
      <Facts title="本次隔绝的真实后果" entries={ritual.consequences} />{people}{originals}
    </details>
    <details className="seer-fold"><summary>有限能力与真实历史来源</summary>
      <section aria-label="古代学者能力边界"><h4>只使用真正掌握的过去</h4>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>{playerText("初学普通物历史影像最多30秒G、容量1；影像有独立身份，原物不变，不能出售或永久收入背包，也不能从历史问出自己未知的秘密。")}</p>
        <p>借力须有真实曾拥有的自身样本并支付维持成本，结束不永久疗伤或补满。藏身仅限已研究的真实经历，须回到同一安全现场，不能作为任意无敌退出。</p>
      </section>
    </details>
    {value.eraClosed && <section aria-label="本时代生活约定"><h4>当前接待处</h4><p>{ritual.ordinaryLife}</p></section>}
    <p className="slice-muted">{value.environment}</p>
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭古代学者页面</button>}
    {pendingNotice}{saveNotice}
  </section>;
}
