import type { FacelessAction } from "../domain/faceless/types";
import { FACELESS_LABOUR_TASKS } from "../domain/faceless/content";

/** Visualize only the existing, exact public labour wording. No hidden batch
 * state is read, and unrecognized projections get no inferred progress.
 * Five completed jobs are not acquired ingredients or a prepared potion.
 */
export function FacelessLabourProgress({ batchId, actions }: { batchId: string; actions: readonly FacelessAction[] }) {
  const batch = /^faceless-batch-([1-9]\d{0,14})$/.exec(batchId)?.[1];
  if (!batch || actions.some(action => !("batchId" in action.command) || action.command.batchId !== batchId)) return null;
  const work = actions.filter(action => action.command.type === "MATERIAL_WORK");
  const buys = actions.filter(action => action.command.type === "BUY_MATERIALS");
  if (buys.length !== 1 || buys[0]!.label !== `第${batch}批 · 领取六项材料`) return null;
  let completed: number;
  if (work.length === 1 && actions.length === 2 && buys[0]!.cost === "0行动 · 3240便士（主材3000＋辅材240）") {
    const count = /^1行动 · 劳动([0-4])\/5，完成五次抵3000便士主材费$/.exec(work[0]!.cost)?.[1];
    if (count === undefined || work[0]!.label !== `第${batch}批 · ${FACELESS_LABOUR_TASKS[Number(count)]}`) return null;
    completed = Number(count);
  } else if (work.length === 0 && actions.length === 1 && buys[0]!.cost === "0行动 · 240便士（仅付四项辅材）") {
    completed = 5;
  } else return null;

  return <div className="faceless-labour-progress">
    <p><strong>第{batch}批 · 劳务已完成 {completed}/5</strong><span>材料尚未领取</span></p>
    <div className="faceless-labour-stamps" role="progressbar" aria-label={`第${batch}批备料劳务`}
      aria-valuemin={0} aria-valuemax={5} aria-valuenow={completed}
      aria-valuetext={`已完成${completed}/5次劳动；材料尚未领取，尚未调配。`}>
      {[1, 2, 3, 4, 5].map(step => <span key={step} aria-hidden="true" className={step <= completed ? "is-complete" : undefined}>
        {step <= completed ? "✓ " : ""}{step}
      </span>)}
    </div>
    <p className="slice-muted">{completed === 5
      ? "五次劳务已抵主材费；仍须支付240便士领取材料，再另行调配。"
      : "五次全部完成才抵主材费；领取材料与调配仍是后续操作。"}</p>
  </div>;
}
