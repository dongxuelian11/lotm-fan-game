/* @vitest-environment jsdom */
import type { SliceBridge } from "../../src/shared/slice-contracts";
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SliceApp } from "../../src/renderer/SliceApp";

type CapturePoint = "guidanceStart" | "practiced" | "combatStart";

// These are untouched public-command captures, including failed mouse control
// and the optional S4 challenge with no ritual audience.
function from(point: CapturePoint): SliceProjection {
  const capture = JSON.parse(readFileSync("tests/fixtures/bizarro-sorcerer-v01170/natural.json", "utf8"));
  return projectSliceState(migrateSliceState(capture[point]));
}

async function enter(state: SliceProjection) {
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({
      ok: true,
      value: {
        mode: "browser",
        activeState: state,
        runs: [{
          runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
          week: state.week, date: state.date, status: state.status, revision: state.revision,
          updatedAt: "2026-10-12T00:00:00Z",
        }],
      },
    })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: state })),
    submitIntent: vi.fn(),
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: new RegExp(state.character.name) }));
  await screen.findByRole("heading", { name: "人物卷宗" });
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) {
    await userEvent.click(within(reveal).getByRole("button", { name: state.combat ? "进入下一回合" : "返回生活" }));
  }
  expect(window.sliceGame!.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
}

beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

it("opens actual S5 to S4 advancement from the dashboard guide without submitting a game action", async () => {
  const state = from("guidanceStart");
  expect(state.progression.sequence).toBe(5);
  await enter(state);
  await userEvent.click(screen.getByRole("button", { name: "查看诡法师晋升" }));

  const next = screen.getByRole("region", { name: "诡法师成长下一步" });
  expect(within(next).getByText(/和平实践不能代替真实谋杀仪式/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "诡法师晋升" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("region", { name: "秘偶大师成长下一步" })).toBeNull();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("loads actual practiced S4 growth with all three saved reports and the released original mouse", async () => {
  const state = from("practiced");
  expect(state.progression.sequence).toBe(4);
  expect(state.bizarroSorcerer!.acting).toBe(100);
  expect(state.combat).toBeNull();
  await enter(state);
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));

  expect(screen.getByRole("region", { name: "诡法师成长下一步" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "诡法师成长" }).getAttribute("aria-pressed")).toBe("true");
  const practice = within(screen.getByRole("region", { name: "诡法师有限实际实践" }));
  expect(state.bizarroSorcerer!.life.cases).toHaveLength(3);
  for (const entry of state.bizarroSorcerer!.life.cases) {
    expect(entry.status).toBe("RESOLVED");
    expect(entry.result).toBeTruthy();
    await userEvent.selectOptions(practice.getByRole("combobox", { name: "选择当前实践" }), entry.id);
    expect(practice.getByRole("region", { name: "诡法师实际实践结果" }).textContent).toContain(entry.result);
  }
  await userEvent.click(screen.getByText(`${state.bizarroSorcerer!.life.title} · 可选原鼠与灵之虫`));
  const mouse = within(screen.getByLabelText("有限原鼠与实际灵之虫"));
  expect(mouse.getByText("已放生同一活鼠，不再捕获")).toBeTruthy();
  expect(mouse.getByText("BR4-MOUSE-1")).toBeTruthy();
  expect(mouse.getByText("仍然活着")).toBeTruthy();
  expect(mouse.getByText("0 / 0 / 0 / 0")).toBeTruthy();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("opens inherited MM5 and Faceless case histories from actual S4 without replaying old actions", async () => {
  const state = from("practiced");
  await enter(state);
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  await userEvent.click(screen.getByRole("button", { name: "秘偶大师经历" }));

  const marionettist = within(screen.getByRole("region", { name: "秘偶大师时期的经历" }));
  await userEvent.click(marionettist.getByText("同一原身体与原物的实际去向"));
  expect(state.marionettist!.puppet.targetId).toBe("MM5-DORN");
  expect(state.marionettist!.puppet.alive).toBe(false);
  expect(marionettist.getByText(/原身体：MM5-DORN/)).toBeTruthy();
  expect(marionettist.getByText("原人真正死亡，不可逆")).toBeTruthy();
  expect(marionettist.queryAllByRole("button", { hidden: true })).toHaveLength(0);

  await userEvent.click(screen.getByRole("button", { name: "无面人经历" }));
  const faceless = within(screen.getByRole("region", { name: "无面人时期的经历" }));
  const appearance = within(faceless.getByRole("region", { name: "保留的持续外貌与原道具服" }));
  expect(appearance.getByText(state.faceless!.appearance.label)).toBeTruthy();
  expect(appearance.getByText(state.faceless!.outfit.id)).toBeTruthy();
  for (const entry of state.faceless!.cases) {
    const summary = faceless.getByText((text, element) => element?.tagName === "SUMMARY" && text.startsWith(`${entry.title} · `));
    await userEvent.click(summary);
    const history = within(summary.closest("details")!);
    expect(entry.result).toBeTruthy();
    expect(history.getByText(`原结果：${entry.result}`)).toBeTruthy();
    expect(history.queryAllByRole("button", { hidden: true })).toHaveLength(0);
  }
  await userEvent.click(screen.getByRole("button", { name: "诡法师成长" }));
  expect(screen.getByRole("region", { name: "诡法师成长下一步" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "无面人时期的经历" })).toBeNull();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("loads the actual optional S4 combat and reveals its original bell, enemy spirituality and zero witnesses", async () => {
  const state = from("combatStart");
  expect(state.progression.sequence).toBe(4);
  expect(state.combat!.bizarro).toMatchObject({
    originalBellId: "seer-rebuild-natural:B4-LEAD-3:BELL",
    enemySpirituality: 40, witnessesPresent: 0, veil: false, mode: "CHALLENGE",
  });
  await enter(state);

  const battle = within(screen.getByRole("dialog", { name: "原钟舞台 · 帷幕兽" }));
  expect(battle.getByRole("heading", { name: state.combat!.enemyName })).toBeTruthy();
  await userEvent.click(battle.getByText("查看公开轮盘与风险"));
  const facts = battle.getByRole("status");
  expect(facts.textContent).toContain("原钟：seer-rebuild-natural:B4-LEAD-3:BELL");
  expect(facts.textContent).toContain("对手灵性40；幻壳无；实际见证0人");
  expect(facts.textContent).toContain("本次是非晋升挑战。");
  expect(battle.getByRole("button", { name: "确认姿态，结算完整回合" })).toBeTruthy();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});
