/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.body.classList.remove("slice-modal-open");
});

it("locks only the background and keeps dossier content scrollable", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync("src/renderer/slice-styles.css", "utf8");
  document.head.append(style);
  document.body.innerHTML = '<div class="slice-overlay"><div class="slice-dialog">卷宗正文</div></div>';
  const dialog = document.querySelector(".slice-dialog")!;
  expect(getComputedStyle(document.body).overflow).toBe("auto");
  document.body.classList.add("slice-modal-open");
  expect(getComputedStyle(document.body).overflow).toBe("hidden");
  expect(getComputedStyle(dialog).overflow).toBe("auto");
  expect(getComputedStyle(dialog).getPropertyValue("overscroll-behavior")).toBe("contain");
  document.body.classList.remove("slice-modal-open");
  expect(getComputedStyle(document.body).overflow).toBe("auto");
});
