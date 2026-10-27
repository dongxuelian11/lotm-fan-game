import { useEffect, useRef, useState } from "react";
import type { SeerAction, SeerCommand, SeerProjection } from "../domain/seer/types";
import type { SliceRecord } from "../domain/slice/types";
import { seerReadableText } from "./seer-feedback";
import { SeerBookmark } from "./SeerBookmark";
import { SeerPotionVial } from "./SeerPotionMoment";
import "./seer-styles.css";

export interface SeerResources {
  health: number;
  maxHealth: number;
  mind: number;
  maxMind: number;
  spirituality: number;
  maxSpirituality: number;
  cash: string;
  actionsRemaining: number;
}

interface SeerPanelProps {
  seer: SeerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: SeerCommand) => void;
  recentResult?: SliceRecord | null;
  dailyLife?: { wagePaid: boolean; onReturn: () => void };
}

/** Match only a public commission title; no outcome or reward is reconstructed. */
export function isSeerCommissionResult(record: Pick<SliceRecord, "title">, cases: SeerProjection["practice"]["cases"]) {
  return cases.some((entry) => record.title.startsWith(`${entry.title} · `));
}

function PracticePanel({
  practice,
  recentResult,
  resources,
  dailyLife,
  busy,
  blocked,
  onCommand,
}: Pick<SeerPanelProps, "recentResult" | "resources" | "dailyLife" | "busy" | "blocked" | "onCommand"> & { practice: SeerProjection["practice"] }) {
  const actionableCase = practice.cases.find((entry) => entry.choices.some((choice) => choice.enabled));
  const defaultCase = actionableCase ?? practice.cases.find((entry) => entry.choices.length > 0) ?? practice.cases[0];
  // Keep the chosen case visible after its receipt, so its result is not replaced by the next commission.
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => defaultCase?.id ?? null);
  const caseHeading = useRef<HTMLHeadingElement>(null);
  const selectedCase = practice.cases.find((entry) => entry.id === selectedCaseId)
    ?? defaultCase;
  const nextCase = selectedCase && !selectedCase.choices.some((choice) => choice.enabled) ? actionableCase : undefined;
  const reflection = practice.reflection;
  const result = recentResult && selectedCase && isSeerCommissionResult(recentResult, [selectedCase]) ? recentResult : null;
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (result) resultHeading.current?.focus(); }, [result?.id, selectedCase?.id]);

  return (
    <details className="seer-fold seer-practice" open>
      <summary>{practice.title} · 已完成 {practice.completed} / {practice.total}</summary>
      <p className="slice-muted">{practice.body}</p>
      {selectedCase && (
        <>
          {practice.cases.length > 1 && (
            <label className="seer-case-selector">
              查看委托
              <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
                {practice.cases.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>
                ))}
              </select>
            </label>
          )}
          <section className="seer-current-case" aria-label="当前委托">
            <header className={selectedCase.id === "folded-bookmark" ? "seer-bookmark-heading" : undefined}>
              {selectedCase.id === "folded-bookmark" && <SeerBookmark />}
              <div>
                <h3 ref={caseHeading} tabIndex={-1}>{selectedCase.title}</h3>
                <span className="slice-muted">{selectedCase.status}</span>
              </div>
            </header>
            <p>{selectedCase.body}</p>
            {result && (
              <section className="seer-commission-result" aria-label="这份委托的最近记录">
                <span className="seer-result-date">第 {result.week} 周 · 委托记录</span>
                <h4 ref={resultHeading} tabIndex={-1}>{result.title}</h4>
                <p>{seerReadableText(result.text)}</p>
              </section>
            )}
            {dailyLife && (
              <div className="seer-case-budget" role="group" aria-label="当前委托行动预算">
                <p className="slice-muted">本周剩余 {resources.actionsRemaining} 行动 · 灵性 {resources.spirituality} / {resources.maxSpirituality} · {dailyLife.wagePaid ? "本周工资已领" : "本周工资尚未领取"}</p>
                <button className="slice-button quiet" disabled={busy || blocked} onClick={dailyLife.onReturn}>返回日常行动（不消耗行动）</button>
              </div>
            )}
            {selectedCase.choices.length > 0 && (
              <p className="slice-muted seer-small-note">成功交付的掌握成长会随机分配给一项已知能力，不一定是本次使用的能力。</p>
            )}
            {selectedCase.choices.length > 0 && (
              <div className="seer-actions" role="group" aria-label="委托处理方式">
                {selectedCase.choices.map((choice) => (
                  <div className="seer-action" key={choice.id}>
                    <button
                      className="slice-choice"
                      disabled={busy || blocked || !choice.enabled}
                      onClick={() => onCommand(choice.command)}
                      aria-describedby={choice.reason ? `seer-practice-reason-${selectedCase.id}-${choice.id}` : undefined}
                    >
                      <strong>{choice.label}</strong>
                      <span className="slice-modifiers">{choice.cost}</span>
                    </button>
                    {choice.reason && <p className="seer-action-reason" id={`seer-practice-reason-${selectedCase.id}-${choice.id}`}>{choice.reason}</p>}
                  </div>
                ))}
              </div>
            )}
            {nextCase && (
              <button
                className="slice-button quiet"
                disabled={busy || blocked}
                onClick={() => {
                  setSelectedCaseId(nextCase.id);
                  caseHeading.current?.focus();
                }}
              >查看可处理委托：{nextCase.title}</button>
            )}
          </section>
        </>
      )}
      <div className={`seer-reflection seer-action${reflection.enabled ? "" : " seer-reflection-pending"}`}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !reflection.enabled}
          onClick={() => onCommand(reflection.command)}
          aria-describedby={reflection.reason ? "seer-reflection-reason" : undefined}
        >
          <strong>{reflection.label}</strong>
          <span className="slice-modifiers">{reflection.cost}</span>
        </button>
        {reflection.reason && <p className="seer-action-reason" id="seer-reflection-reason">{reflection.reason}</p>}
      </div>
    </details>
  );
}

/** Presentation only: availability, costs and chances come from the public projection. */
export function SeerPanel({
  seer,
  resources,
  dailyLife,
  recentResult,
  busy,
  blocked,
  onCommand,
}: SeerPanelProps) {
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const selectedBottle = seer.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = seer.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const actions = seer.actions.filter(
    (action) => action.command.type !== "CONSUME" && (seer.discovered || action.command.type === "DISCOVER"),
  );
  const nextAction = seer.actions.find((action) => action.enabled && action.command.type === "CONSUME")
    ?? seer.actions.find((action) => action.enabled)
    ?? (seer.promoted ? seer.practice?.cases.flatMap((entry) => entry.choices).find((choice) => choice.enabled) : undefined)
    ?? (seer.promoted && seer.practice?.reflection.enabled ? seer.practice.reflection : undefined)
    ?? seer.actions[0];

  const nextStepLabel = nextAction?.command.type === "PRACTICE" && nextAction.command.approachId.startsWith("report-")
    ? "回应书签主人的追问，决定怎样解释观察所得"
    : nextAction?.label;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || seer.promoted)) setSelectedBottleId(null);
  }, [selectedBottleId, selectedBottle, seer.promoted]);
  useEffect(() => {
    if (selectedBottleId) confirmationHeading.current?.focus();
  }, [selectedBottleId]);

  function openBottle(action: SeerAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    setSelectedBottleId(action.command.bottleId);
  }

  const archiveBottles = seer.promoted && seer.bottles.length > 0
    && seer.bottles.every((bottle) => bottle.status.startsWith("已耗尽"));
  const bottles = seer.discovered && seer.bottles.length > 0 && (
        <section className="seer-bottles" aria-label="已调配的魔药">
          <h3>已调配的魔药</h3>
          {seer.bottles.map((bottle) => {
            const action = seer.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={`seer-bottle${action ? " seer-bottle-ready" : " seer-bottle-spent"}`} key={bottle.id}>
                <SeerPotionVial empty={!action} />
                <div>
                  <h4>{bottle.title}</h4>
                  <p>来源：{seerReadableText(bottle.source)}</p>
                  <small>{bottle.status}</small>
                </div>
                {action && (
                  <div>
                    <button className="slice-button" disabled={busy || blocked || !action.enabled} onClick={() => openBottle(action)}>
                      查看并准备服用「{bottle.title}」
                    </button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason">{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </section>
  );

  if (selectedBottle && selectedAction?.command.type === "CONSUME") {
    return (
      <section className="seer-panel seer-confirmation" aria-label="这瓶魔药的服用确认" key={selectedBottle.id}>
        <header className="seer-potion-heading">
          <SeerPotionVial />
          <div>
            <div className="slice-eyebrow">服用前，请再确认一次</div>
            <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
            <p className="seer-bottle-source">来源：{seerReadableText(selectedBottle.source)}</p>
          </div>
        </header>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.title}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <div className="slice-notice seer-risk">
          <strong>服用风险</strong>
          <p>{seer.risk}</p>
        </div>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{seer.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button
            className="slice-button quiet"
            disabled={busy || blocked}
            onClick={() => setSelectedBottleId(null)}
          >暂不服用</button>
          <button
            className="slice-button"
            disabled={busy || blocked || !selectedAction.enabled}
            onClick={() => onCommand(selectedAction.command)}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这瓶魔药。暂不服用不消耗行动或材料。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="成长下一步">
        <span className="seer-seal">{seer.promoted ? "序列 9" : "成长卷宗"}</span>
        <h3>{seer.title}</h3>
        {nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextStepLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : (
          <p className="seer-next">{seer.promoted ? "运用已掌握的能力，继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>
        )}
        {!seer.promoted && <p className="slice-muted">首次晋升需先完成四整周生活。准备期间仍可工作、调查或休养。</p>}
      </section>

      {!seer.promoted && bottles}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="成长行动">
          {actions.map((action) => (
            <div className="seer-action" key={action.id}>
              <button
                className="slice-choice"
                disabled={busy || blocked || !action.enabled}
                onClick={() => onCommand(action.command)}
                aria-describedby={action.reason ? `seer-reason-${action.id}` : undefined}
              >
                <strong>{action.label}</strong>
                <span className="slice-modifiers">{action.cost}</span>
              </button>
              {action.reason && <p className="seer-action-reason" id={`seer-reason-${action.id}`}>{action.reason}</p>}
            </div>
          ))}
        </div>
      )}

      {seer.promoted && seer.practice && <PracticePanel practice={seer.practice} {...(recentResult ? { recentResult } : {})} resources={resources} {...(dailyLife ? { dailyLife } : {})} busy={busy} blocked={blocked} onCommand={onCommand} />}



      {seer.promoted && (archiveBottles ? (
        <details className="seer-fold seer-bottle-history">
          <summary>查看已耗尽魔药记录 · {seer.bottles.length} 瓶</summary>
          {bottles}
        </details>
      ) : bottles)}

      {seer.discovered && seer.formulaKnown && seer.formula.length > 0 && (
        <details className="seer-fold">
          <summary>查看已知配方 · {seer.formula.length} 种材料</summary>
          <ul className="seer-formula">
            {seer.formula.map((material) => (
              <li key={material.name}><span>{material.name}</span><strong>{material.quantity} {material.unit}</strong></li>
            ))}
          </ul>
          <p className="slice-muted">以上是配方用量。材料是否备齐，以可执行的调配行动为准。</p>
        </details>
      )}

      {seer.promoted && (
        <section className="seer-abilities" aria-label="占卜家能力与消化">
          <h3>能力与消化</h3>
          <p>扮演进度 {seer.acting} · 消化：{seer.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {seer.pollution}</p>
          {seer.abilities.map((ability) => (
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
