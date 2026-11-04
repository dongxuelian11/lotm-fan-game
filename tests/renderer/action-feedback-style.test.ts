/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => { document.head.innerHTML = ""; document.body.innerHTML = ""; });

describe("action result text size", () => {
  it("enlarges only large-text feedback without changing normal feedback or buttons", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync("src/renderer/clown-styles.css", "utf8") + "\n" + readFileSync("src/renderer/slice-styles.css", "utf8");
    document.head.append(style);
    const host = document.createElement("div");
    host.innerHTML = '<section class="slice-action-feedback" role="status"><p>扮演+25。已实际释放，原人存活；行动点2→1。</p></section><button class="slice-button">关闭</button>';
    document.body.append(host);
    const feedback = host.querySelector("section")!;
    const button = host.querySelector("button")!;
    const original = feedback.textContent;
    const buttonSize = getComputedStyle(button).fontSize;
    expect(getComputedStyle(feedback).fontSize).toBe("16px");
    feedback.classList.add("clown-action-feedback");
    const clownSize = getComputedStyle(feedback).fontSize;
    expect(getComputedStyle(feedback).lineHeight).toBe("1.55");
    feedback.classList.remove("clown-action-feedback");
    host.className = "slice-large-text";
    expect(getComputedStyle(feedback).fontSize).toBe("22px");
    expect(getComputedStyle(feedback).lineHeight).toBe("1.5");
    expect(getComputedStyle(button).fontSize).toBe(buttonSize);
    expect(feedback.textContent).toBe(original);
    feedback.classList.add("clown-action-feedback");
    expect(getComputedStyle(feedback).fontSize).toBe(clownSize);
    expect(getComputedStyle(feedback).lineHeight).toBe("1.55");
    feedback.classList.remove("clown-action-feedback");
    host.className = "";
    expect(getComputedStyle(feedback).fontSize).toBe("16px");
  });
});
