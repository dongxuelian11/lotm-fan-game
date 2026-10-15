import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { HarvestpriestAction, HarvestpriestCommand, HarvestpriestProjection } from "../domain/harvestpriest/types";
import type { CultivatorProjection } from "../domain/cultivator/types";
import type { PhysicianProjection } from "../domain/physician/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原植床、现有产物与照护边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际尝试，请核对照护、实际份数与有限结果",
  RESOLVED: "已提交本次实践报告",
};

/** Prior stages stay read-only after promotion; live inherited exits use their original panels. */
function HarvestpriestPriorHistory({ value, name }: { value: CultivatorProjection | PhysicianProjection; name: string }) {
  const title = `${name}时期的经历`;
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">你已晋升丰收祭司。这里保留{name}时期的原观察、菜圃或诊所、实际物资消耗、已交付份数、实际结束、原报告与原瓶来源，只供回看。</p>
    <p>{name}扮演进度 {value.acting} · 消化：{value.digestion}</p>
    {value.story && <p>{value.story}</p>}
    {value.supplies && <p>{value.supplies}</p>}
    {value.environment && <p>{value.environment}</p>}
    {"garden" in value && value.garden && <p>{value.garden}</p>}
    {"clinic" in value && value.clinic && <p>{value.clinic}</p>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {value.bottles.length > 0 && <details className="seer-fold" open>
      <summary>{name}原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {value.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}
export function HarvestpriestCultivatorHistory({ cultivator }: { cultivator: CultivatorProjection }) {
  return <HarvestpriestPriorHistory value={cultivator} name="耕种者" />;
}
export function HarvestpriestPhysicianHistory({ physician }: { physician: PhysicianProjection }) {
  return <HarvestpriestPriorHistory value={physician} name="医师" />;
}

function isCaseAction(action: HarvestpriestAction): boolean {
  return "caseId" in action.command;
}

interface HarvestpriestPanelProps {
  harvestpriest: HarvestpriestProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: HarvestpriestCommand) => void;
}

/** Only committed public facts change care, water stock, original harvest, actual shares, or next-season plans. */
export function HarvestpriestPanel({ harvestpriest, resources, busy, blocked, onCommand }: HarvestpriestPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => harvestpriest.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = harvestpriest.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = harvestpriest.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = harvestpriest.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open practice; prose and old results never create a lock.
  const closeAction = harvestpriest.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? harvestpriest.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (harvestpriest.insideCase ? harvestpriest.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? harvestpriest.cases.find((entry) => entry.id === selectedCaseId)
    ?? harvestpriest.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? harvestpriest.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!harvestpriest.insideCase || action.command.type === "CLOSE")) : [];
  const actions = harvestpriest.insideCase ? [] : harvestpriest.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = harvestpriest.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : harvestpriest.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : harvestpriest.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (harvestpriest.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [harvestpriest.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !harvestpriest.promoted && !harvestpriest.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || harvestpriest.promoted || harvestpriest.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, harvestpriest.promoted, harvestpriest.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: HarvestpriestAction) {
    if (busy || blocked || harvestpriest.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || harvestpriest.promoted || harvestpriest.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: HarvestpriestAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => { if (!busy && !blocked && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `harvestpriest-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`harvestpriest-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶丰收祭司魔药的服用确认" aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (!confirmationLocked) setSelectedBottleId(null);
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
        <section className="slice-notice seer-risk" aria-label="丰收祭司服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{harvestpriest.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{harvestpriest.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="harvestpriest-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "harvestpriest-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="丰收祭司成长下一步">
        <span className="seer-seal">{harvestpriest.promoted ? "序列 7" : "丰收祭司成长卷宗"}</span>
        <h3>{harvestpriest.title}</h3>
        {harvestpriest.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次实践：</strong>{nextLabel || "查看当前公开结束选项"}。结束不消耗行动或灵性，0精神时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原植床、已用水、实际收成、已交付份数与报告继续保留。</p>
        ) : harvestpriest.promoted && harvestpriest.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{harvestpriest.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{harvestpriest.digestion}</p>
        {!harvestpriest.promoted && <p className="slice-muted">需先完成医师100消化与八个完整序列8周。晋升准备和待执行准备期间仍可工作、调查或休养；成功晋升后仍沿母亲途径成长。</p>}
        <p className="slice-muted">{playerText("已认识的成年苗圃照料员伊芙·莫兰仍沿原渠道提供指导；取得成品或晋升不会自动加入大地母神教会或其它组织。原著已核实序列7丰收祭司的名称，完整能力表与配方仍未知；两项新能力、三项具体照护实践与全部数值均为本作原创G。照料原有生命、等待真实收成、如实分享有限产物与为下一季作准备，是本阶段G扮演解释。")}</p>
      </section>

      {harvestpriest.promoted && <section className="slice-notice warrior-environment" aria-label="现场与当前实践">
        <h4>现场与当前实践</h4>
        <p>{harvestpriest.environment || "尚未取得公开记录；原植床、水、实际收成与下一季条件须经实际行动分别确认。"}</p>
      </section>}

      {harvestpriest.promoted && <section className="slice-notice warrior-environment" aria-label="原植床与实际收成">
        <h4>原植床与实际收成</h4>
        <p>{harvestpriest.plot || "尚未取得原植床的公开记录；没有可据此认定的收成或新增粮食。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="丰收祭司有限实践">
          <h3>有限照护、实际分配与下一季</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || harvestpriest.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {harvestpriest.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前丰收祭司实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次实践：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察原记录；植床状况、现有水与收成、下一季条件及本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的观察、实际照护、结束与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="原植床、有限用水与跨周收成边界">
              <h4>原植床、有限用水与跨周收成边界</h4>
              <p>先观察同一块接近采收期的原植床、有限库存与下一季条件，再选择公开的能力方法或普通方法。每次原植床的实际照护尝试都用掉1份水，失败也保留耗水；能力方法另消耗3灵性，普通方法不用这笔灵性。成功照护后至少等到下一周，才可实际收获一次3份有限产物；本周照护不立即变出粮食。用水库存为0时，可按公开条件支付30便士实际补充2份水。实际分配交出2份、保留1份；下一季计划不会新增当前或未来粮食。准备、执行、实际结束、收获与报告分别提交，成本与限制以公开按钮为准。</p>
              <p className="slice-muted">{playerText("本阶段不瞬间制造粮食、不控制天气，不获得弗兰克序列6生物学家的杂交改造；具体照护不是已核实的原著完整法术表。原植床不被复制，实际收获不能重复领取；已交出的份数不会因结束接触而回到库存。实际接触开始后，无论采用能力或普通方法、尝试成功或失败，都须先实际结束，再做其它事务；撤回待执行准备不能代替结束。结束为0行动、0精神、0灵性，不另抽随机、不奖励、不退款、不治疗，原结果与报告继续保留。")}</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="实际照护、有限产物与原报告" aria-live="polite" aria-atomic="true">
              <h4>实际照护、有限产物与原报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前丰收祭司实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="丰收祭司成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {harvestpriest.story && <p className="slice-muted">{harvestpriest.story}</p>}

      {harvestpriest.discovered && <section className="slice-notice warrior-source" aria-label="丰收祭司成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。全部材料名称、主辅分类、数量与投料顺序仍未知，配方列表保持空；不能据此制造，也不补造任何原料。本阶段只使用本作原创G渠道中的三瓶独立成品原瓶，不提供材料采购或调配。指导240便士并用1行动；每瓶原价2010便士，四次实际劳动抵扣1800便士后仍需210便士。服用按意志难度18判定，来源与有限补给条件以以下公开记录为准。")}</p>
        {harvestpriest.supplies && <p>{harvestpriest.supplies}</p>}
      </section>}
      {harvestpriest.discovered && harvestpriest.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!harvestpriest.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {harvestpriest.bottles.map((bottle) => {
            const action = harvestpriest.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !harvestpriest.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !harvestpriest.promoted && !harvestpriest.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `harvestpriest-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`harvestpriest-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {harvestpriest.discovered && !harvestpriest.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{harvestpriest.risk}</p></details>}
      {harvestpriest.promoted && (
        <section className="warrior-abilities" aria-label="丰收祭司能力与消化">
          <h3>能力与消化 · {harvestpriest.abilities.length} 项训练记录</h3>
          <p className="slice-muted">{playerText("序列7继承耕种者的三项能力与医师的两项能力，保留原ID和掌握，新增两项从0开始的G能力，共七项当前能力。原著只核实本序列名称，完整法术表尚未核实；具体照护、跨周收获、分配与下一季计划均为本作原创G。能力不创造水、不瞬间制造粮食、不控制天气，不获得弗兰克序列6生物学家的杂交改造。晋升后灵性上限60，当前灵性不会自动补满。")}</p>
          <p>扮演进度 {harvestpriest.acting} · 消化：{harvestpriest.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {harvestpriest.pollution}</p>
          {harvestpriest.abilities.map((ability) => (
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
