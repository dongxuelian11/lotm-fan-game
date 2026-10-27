/* @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifeActionVignette } from "../../src/renderer/LifeActionVignette";
import { readFileSync } from "node:fs";

afterEach(cleanup);
describe("original everyday action engravings", () => {
  it("has four distinct quiet silhouettes with one shared footprint and no extra accessible control", () => {
    const shapes = ["WORK", "LEARN", "INVESTIGATE", "REST"].map(kind => {
      const view = render(<LifeActionVignette kind={kind} />);
      const svg = view.container.querySelector("svg")!;
      expect(svg.getAttribute("viewBox")).toBe("0 0 80 48");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
      expect(svg.querySelector("image, text, animate, foreignObject")).toBeNull();
      expect(svg.querySelector(".life-vignette-wash")).toBeTruthy();
      const shape = svg.innerHTML;
      view.unmount();
      return shape;
    });
    expect(new Set(shapes).size).toBe(4);
  });
  it("leaves button text, focus, and disabled interaction authoritative", async () => {
    const click = vi.fn();
    const view = render(<button aria-label="工作，1行动，领取一份周薪" className="slice-action" onClick={click}><LifeActionVignette kind="WORK" /><strong>工作</strong><small>1 行动</small></button>);
    const button = screen.getByRole("button", { name: "工作，1行动，领取一份周薪" });
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    expect(within(button).queryByRole("img")).toBeNull();
    expect(click).not.toHaveBeenCalled();
    view.rerender(<button aria-label="工作，1行动，领取一份周薪" className="slice-action" disabled onClick={click}><LifeActionVignette kind="WORK" /><strong>工作</strong><small>1 行动</small></button>);
    await userEvent.click(button);
    expect(click).not.toHaveBeenCalled();
    const css = readFileSync("src/renderer/slice-styles.css", "utf8");
    expect(css).toContain(".slice-action .life-action-vignette");
    expect(css).toContain("width: 64px;");
  });
});
