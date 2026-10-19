import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { WitchAction, WitchCommand, WitchProjection } from "../domain/witch/types";
import type { AssassinProjection } from "../domain/assassin/types";
import type { InstigatorProjection } from "../domain/instigator/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场",
  PREPARED: "已选定方式并完成准备",
  EXAMINED: "已实际尝试，等待报告",
  RESOLVED: "已核对实际结果并提交报告",
};

/** The inherited S9 dossier is a read-only record, including the same original draft. */
export function WitchAssassinHistory({ assassin, currentTitle = "女巫" }: { assassin: AssassinProjection; currentTitle?: "女巫" | "欢愉魔女" | "痛苦魔女" | "绝望魔女" }) {
  const status: Record<string, string> = {
    AVAILABLE: "尚未观察", OBSERVED: "已观察现场与能力边界", PREPARED: "已选定方法并完成准备",
    EXAMINED: "已实际检验，请核对结果与原位置", RESOLVED: "已提交本次实践报告",
  };
  return <section className="seer-panel warrior-panel" aria-label="刺客时期的经历">
    <h3>刺客时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留刺客时期的原观察、实际方法、往返与原稿记录、原瓶来源和能力掌握；当前实践请回到{currentTitle}卷宗。</p>
    <p>刺客扮演进度 {assassin.acting} · {assassin.digestion}</p>
    {assassin.story && <p>{assassin.story}</p>}
    {assassin.environment && <p className="slice-muted">{assassin.environment}</p>}
    {assassin.draft && <section className="seer-fold" aria-label="练习原稿的归属与持有">
      <h4>练习原稿 · 当前公开记录</h4>
      <dl className="seer-facts">
        <div><dt>原物编号</dt><dd>{assassin.draft.id}</dd></div>
        <div><dt>原主人</dt><dd>{assassin.draft.owner}</dd></div>
        <div><dt>当前持有／保管</dt><dd>{assassin.draft.custodian}</dd></div>
        <div><dt>已知位置</dt><dd>{assassin.draft.location}</dd></div>
        <div><dt>原物记录版本</dt><dd>{assassin.draft.version}</dd></div>
      </dl>
      <p className="slice-muted">原稿归属与实际保管分别记录；晋升不会自动转移原物或改写原报告。</p>
    </section>}
    {assassin.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {status[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p>记录位置：{entry.position}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {assassin.supplies && <p className="slice-muted">{assassin.supplies}</p>}
    {assassin.bottles.length > 0 && <details className="seer-fold"><summary>刺客原瓶 · 来源与去向</summary>
      {assassin.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {assassin.abilities.length > 0 && <details className="seer-fold"><summary>已继承的刺客能力</summary>
      {assassin.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

/** Inherited S8 observations and consequences are records, never fresh commands. */
export function WitchInstigatorHistory({ instigator, currentTitle = "女巫" }: { instigator: InstigatorProjection; currentTitle?: "女巫" | "欢愉魔女" | "痛苦魔女" | "绝望魔女" }) {
  return <section className="seer-panel witch-panel sunpriest-panel" aria-label="教唆者时期的经历">
    <h3>教唆者时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留教唆者时期的原观察、实际方法、争执后果、报告、原瓶来源和能力掌握；当前实践请回到{currentTitle}卷宗。</p>
    <p>教唆者扮演进度 {instigator.acting} · {instigator.digestion}</p>
    {instigator.story && <p>{instigator.story}</p>}
    {instigator.environment && <p className="slice-muted">{instigator.environment}</p>}
    {instigator.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
      <p>争执状态：{entry.tension}</p>
    </details>)}
    {instigator.supplies && <p>{instigator.supplies}</p>}
    {instigator.bottles.length > 0 && <details className="seer-fold"><summary>教唆者原瓶 · 来源与去向</summary>
      {instigator.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {instigator.abilities.length > 0 && <details className="seer-fold"><summary>已继承的教唆者能力</summary>
      {instigator.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: WitchAction): boolean {
  return "caseId" in action.command;
}

interface WitchPanelProps {
  witch: WitchProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: WitchCommand) => void;
}

/** Facts, preparation and committed outcomes stay separate; projected methods are equal choices. */
export function WitchPanel({ witch, resources, busy, blocked, readOnly = false, onCommand }: WitchPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [bodyChangeAccepted, setBodyChangeAccepted] = useState(false);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = witch.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = witch.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = witch.actions.filter(isCaseAction);
  const selectedCase = witch.cases.find((entry) => entry.id === selectedCaseId)
    ?? witch.cases.find((entry) => entry.status === "EXAMINED")
    ?? witch.cases.find((entry) => entry.status === "PREPARED" || entry.status === "OBSERVED")
    ?? witch.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? witch.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = witch.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = witch.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : witch.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Both methods are public choices; observations never imply a completed preparation or outcome.
  const nextLabel = nextAction?.command.type === "PREPARE"
    ? "对照实际观察，选择有限巫术或普通方法并完成准备。"
    : nextAction?.command.type === "PERFORM"
      ? "核对已选方式与实际准备后执行，也可以退出本次准备。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !witch.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (!selectedCaseId && selectedCase) setSelectedCaseId(selectedCase.id);
  }, [selectedCaseId, selectedCase]);

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || witch.promoted || readOnly)) {
      setSelectedBottleId(null);
      setBodyChangeAccepted(false);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, witch.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: WitchAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setBodyChangeAccepted(false);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || !bodyChangeAccepted || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || witch.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    // The projection can describe an available consume action, but cannot accept this consequence for the player.
    onCommand({ type: "CONSUME", bottleId: selectedBottle.id, confirmed: true, bodyChangeAccepted: true });
  }

  function actionButton(action: WitchAction) {
    return (
      <div className="seer-action witch-compact-action sunpriest-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => {
            if (busy || blocked || readOnly || !action.enabled) return;
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `witch-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`witch-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel witch-panel seer-confirmation sunpriest-panel" aria-label="这瓶女巫魔药的服用确认" aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            event.preventDefault();
            if (!confirmationLocked) { setBodyChangeAccepted(false); setSelectedBottleId(null); }
          }
        }}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="女巫服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{witch.risk}</p>
        </section>
        <section className="slice-notice seer-risk" aria-label="女巫晋升的角色身体变化">
          <h4>成功晋升后的角色身体变化</h4>
          <p>服药成功后，男性角色的身体将变为女性；已经是女性的角色会增强外貌与魅力。这一变化写入并保留在当前角色存档中。</p>
          <p>{witch.bodyChange}</p>
          <p>这描述游戏角色的身体，不代表现实玩家的性别或身份。角色的自称、自我认同与恋爱选择不会自动改写。</p>
          <p>可以暂不服用，继续停留在序列8教唆者并正常生活。</p>
          <label className="slice-settings" htmlFor="witch-body-change-consent">
            <input id="witch-body-change-consent" type="checkbox" checked={bodyChangeAccepted}
              disabled={confirmationLocked} onChange={(event) => setBodyChangeAccepted(event.target.checked)} />
            我已了解并接受这瓶魔药成功晋升后的角色身体变化
          </label>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{witch.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="witch-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => { setBodyChangeAccepted(false); setSelectedBottleId(null); }}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !bodyChangeAccepted || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "witch-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel witch-panel sunpriest-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="女巫成长下一步">
        <span className="seer-seal">{witch.promoted ? "序列 7" : "女巫晋升卷宗"}</span>
        <h3>{witch.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份女巫卷宗只供回看。</p>
        ) : witch.promoted && witch.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的巫术实践。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{witch.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{witch.digestion}</p>
        {!witch.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成教唆者消化与成熟准备，再取得实际材料、调配成瓶，并单独确认服用。可用行动、成本与缺少的条件以本卷宗记录为准。</p>}
        <p className="slice-muted">{playerText("本阶段具体场景、材料渠道与数值属于游戏设定（G）。已核配方不代表具体调配顺序已经核实；取得渠道或晋升不会自动加入组织。")}</p>
      </section>

      <section className="slice-notice" aria-label="女巫角色身体变化记录">
        <h4>{witch.promoted ? "已保存的角色身体变化" : "晋升前需知：角色身体变化"}</h4>
        <p>{witch.bodyChange}</p>
        {!witch.promoted && <p>成功晋升会使男性角色的身体变为女性；已经是女性的角色增强外貌与魅力。身体变化写入角色存档，与现实玩家身份无关；可以停留在序列8。</p>}
        {witch.previousGender !== null && <p>晋升前角色身体记录：{witch.previousGender === "MALE" ? "男性" : witch.previousGender === "FEMALE" ? "女性" : witch.previousGender}</p>}
      </section>

      {witch.promoted && <section className="slice-notice" aria-label="女巫实际工具与战前准备">
        <h4>真实粉末与镜片</h4>
        <p>{witch.tools}</p>
        <p className="slice-muted">工具补给每周至多一次，花费1行动与60便士取得3份隐身粉末、1份镜片。战前预备镜片不消耗行动，必须持有真实镜片；库存与是否已预备以保存记录为准。隐身只用于本次实践，不提供永久开关。</p>
      </section>}

      {witch.promoted && <section className="slice-notice witch-environment sunpriest-environment" aria-label="已知现场与处理边界">
        <h4>已知现场与处理边界</h4>
        <p>{witch.environment || "现场对象、光照条件与可处理范围尚未确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="女巫实践">
          <h3>现场事实、实际准备与有限作业</h3>
          <label className="seer-case-selector">
            选择巫术实践
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {witch.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case witch-case sunpriest-case" aria-label="当前巫术实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">作业状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="witch-observations sunpriest-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得本处现场观察，不能确认未提供的事实。</p>}
            </section>
            <section className="witch-preparation sunpriest-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p>{selectedCase.preparation || "尚无本次准备记录。已观察现场，不等于已选择方式或布置好物件。"}</p>
            </section>
            <section className="slice-notice witch-boundaries sunpriest-boundaries" aria-label="本次实践目标与边界">
              <h4>本次实践目标与边界</h4>
              <p>只处理已经观察到的现场对象。巫术方法与普通方法都须先准备，再实际尝试并报告；退出准备不消耗行动，已经支付的行动与物资不会退回。</p>
              <p className="slice-muted">隐身需要真实隐身粉末，仍可能被声响、足迹与接触发现；镜替消耗实际镜片，不能无限替死。冰霜、黑焰、黑魔法与占卜干扰都只形成有限结果，不把未知写成已经查明。</p>
            </section>
            {selectedCase.result && <section className="witch-result sunpriest-result" aria-label="实际作业结果">
              <h4>实际作业结果</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="witch-action-list sunpriest-action-list" role="group" aria-label="当前巫术实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="witch-action-list sunpriest-action-list" role="group" aria-label="女巫成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {witch.story && <p className="slice-muted">{witch.story}</p>}

      {witch.discovered && witch.supplies && <section className="slice-notice witch-supplies sunpriest-supplies" aria-label="女巫实际物资"><h4>实际材料与批次来源</h4><p>{witch.supplies}</p></section>}
      {witch.discovered && witch.bottles.length > 0 && (
        <details className="seer-fold witch-bottles sunpriest-bottles" open={!witch.promoted}>
          <summary>女巫独立调配原瓶 · 来源与去向</summary>
          {witch.bottles.map((bottle) => {
            const action = witch.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !witch.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !witch.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `witch-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`witch-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {witch.discovered && !witch.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{witch.risk}</p></details>}
      {witch.discovered && witch.formulaKnown && witch.formula.length > 0 && <details className="seer-fold" aria-label="女巫已知配方">
        <summary>查看已知女巫配方 · {witch.formula.length} 种材料</summary>
        <ul className="seer-formula">{witch.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity === null ? "数量未注明" : `${material.quantity} ${material.unit}`}</strong>{material.note && <small>{material.note}</small>}</li>)}</ul>
        <p className="slice-muted">这里只列已知材料与用量，不把列表顺序当作调配顺序。取得材料、调配成瓶与确认服用是三个独立步骤。</p>
      </details>}
      {witch.promoted && (
        <section className="witch-abilities sunpriest-abilities" aria-label="女巫能力与消化">
          <h3>能力与消化 · {witch.abilities.length} 项能力</h3>
          <p className="slice-muted">继承刺客与教唆者能力，并获得有限隐身、镜替、冰霜、黑焰、黑魔法与占卜干扰。隐身不是绝对不可发现，镜替不复活；不包含序列6欢愉的蛛丝或序列5疾病。普通核对与协作同样可完成实践，不要求诱惑、伤害或亲密关系。</p>
          <p>扮演进度 {witch.acting} · 消化：{witch.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {witch.pollution}</p>
          {witch.abilities.map((ability) => (
            <details className="seer-fold" key={ability.id}>
              <summary>{ability.label} · 掌握 {ability.mastery}</summary>
              <p>{ability.description}</p>
            </details>
          ))}
        </section>
      )}
      {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    </div>
  );
}
