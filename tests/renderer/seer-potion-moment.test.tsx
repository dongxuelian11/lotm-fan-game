/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SeerActionFeedback } from "../../src/renderer/SeerPotionMoment";

afterEach(cleanup);
describe("saved potion milestone presentation", () => {
  it.each([
    ["一瓶占卜家魔药", "第1批七项材料已全部投入调配，花费1行动、60便士。", "prepared", "调配完成 · 原瓶待服"],
    ["成为占卜家", "原瓶seer-batch-1:bottle已耗尽。精神100→90。", "success", "晋升已成 · 仍须谨慎"],
    ["魔药发生排异", "原瓶seer-batch-1:bottle已耗尽。健康100→90；排异0→25。", "failure", "未能晋升 · 原瓶已耗尽"],
    ["指导者中断了晋升", "原瓶seer-batch-1:bottle已耗尽。健康100→80；排异0→50。", "failure", "未能晋升 · 原瓶已耗尽"],
  ])("uses only the saved %s outcome", (title, text, tone, caption) => {
    const record = Object.freeze({ title, text });
    const before = JSON.stringify(record);
    render(<SeerActionFeedback record={record} firstCaseResolved milestones fast={false} />);
    const moment = screen.getByRole("article", { name: "魔药里程碑" });
    expect(moment.classList.contains(tone)).toBe(true);
    expect(moment.classList.contains("animate")).toBe(true);
    expect(screen.getByText(caption)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: title }));
    expect(moment.textContent).toContain(text.replace("原瓶seer-batch-1:bottle", "第1批原瓶"));
    expect(Boolean(moment.querySelector(".is-empty"))).toBe(tone !== "prepared");
    expect(JSON.stringify(record)).toBe(before);
  });
  it("keeps the result without motion in fast mode and leaves history or unrelated text plain", () => {
    const record = { title: "成为占卜家", text: "原瓶seer-batch-1:bottle已耗尽。" };
    const view = render(<SeerActionFeedback record={record} firstCaseResolved milestones fast />);
    expect(screen.getByRole("article").classList.contains("animate")).toBe(false);
    view.rerender(<SeerActionFeedback record={record} firstCaseResolved milestones={false} fast={false} />);
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByText(record.title)).toBeTruthy();
    view.rerender(<SeerActionFeedback record={{ title: "成为占卜家", text: "其他卷宗文字" }} firstCaseResolved milestones fast={false} />);
    expect(screen.queryByRole("article")).toBeNull();
    const css = readFileSync("src/renderer/seer-styles.css", "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.seer-potion-moment\.animate \.seer-potion-vial \* \{ animation: none;/);
  });
});
