import { useEffect, useId, useRef } from "react";
import type { SliceRecord } from "../domain/slice/types";
import { seerFeedbackText } from "./seer-feedback";

/** An engraved, decorative bottle. It never represents a roll or remaining doses. */
export function SeerPotionVial({ empty = false }: { empty?: boolean }) {
  const clip = useId();
  return <svg className="seer-potion-vial" viewBox="0 0 150 180" aria-hidden="true" focusable="false">
    <defs><clipPath id={clip}><path d="M60 39H90V66C90 79 115 88 115 111V145Q115 158 102 158H48Q35 158 35 145V111C35 88 60 79 60 66Z" /></clipPath></defs>
    <circle className="seer-vial-halo" cx="75" cy="98" r="66" />
    <path className="seer-vial-etch" d="M75 18V8M75 178V168M5 98H15M135 98H145M27 50L34 57M116 139L123 146M27 146L34 139M116 57L123 50" />
    <g clipPath={`url(#${clip})`}>
      <path className={`seer-vial-liquid${empty ? " is-empty" : ""}`} d="M25 106Q50 94 75 105T125 106V170H25Z" />
      <path className="seer-vial-glint" d="M46 108V140Q46 147 53 147M102 116V138" />
    </g>
    <path className="seer-vial-glass" d="M60 39H90V66C90 79 115 88 115 111V145Q115 158 102 158H48Q35 158 35 145V111C35 88 60 79 60 66Z" />
    <path className="seer-vial-cork" d="M57 25H93L90 40H60Z" />
    <path className="seer-vial-etch" d="M57 48H93M62 29L64 36M70 29V36M79 29V36M87 29L85 36" />
    <path className="seer-vial-eye" d="M53 126Q75 105 97 126Q75 147 53 126ZM75 119A7 7 0 1 0 75 133A7 7 0 1 0 75 119" />
  </svg>;
}

export function SeerActionFeedback({ record, firstCaseResolved, milestones, fast }: {
  record: Pick<SliceRecord, "title" | "text">;
  firstCaseResolved: boolean;
  milestones: boolean;
  fast: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const consumed = record.text.startsWith("原瓶seer-batch-");
  const tone = !milestones ? null
    : record.title === "一瓶占卜家魔药" && /^第\d+批七项材料/.test(record.text) ? "prepared"
    : consumed && record.title === "成为占卜家" ? "success"
    : consumed && (record.title === "魔药发生排异" || record.title === "指导者中断了晋升") ? "failure"
    : null;
  const text = seerFeedbackText(record, firstCaseResolved);
  useEffect(() => {
    if (tone) heading.current?.focus();
  }, [record, tone]);
  if (!tone) return <p><strong>{record.title}</strong> {text}</p>;
  return <article className={`seer-potion-moment ${tone}${fast ? "" : " animate"}`} aria-label="魔药里程碑">
    <SeerPotionVial empty={tone !== "prepared"} />
    <div>
      <span className="seer-potion-caption">{tone === "prepared" ? "调配完成 · 原瓶待服" : tone === "success" ? "晋升已成 · 仍须谨慎" : "未能晋升 · 原瓶已耗尽"}</span>
      <h3 ref={heading} tabIndex={-1}>{record.title}</h3>
      <p>{text}</p>
    </div>
  </article>;
}
