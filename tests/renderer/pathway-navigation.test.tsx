/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

// Name every ordinary route explicitly so a duplicate cannot replace an omitted route.
const ordinaryRoutes = [
  ["seer", "占卜家之路", "成长下一步"],
  ["hunter", "猎人之路", "猎人成长下一步"],
  ["audience", "观众之路", "观众成长下一步"],
  ["savant", "通识者之路", "通识者成长下一步"],
  ["apothecary", "药师之路", "药师成长下一步"],
  ["sleepless", "不眠者之路", "不眠者成长下一步"],
  ["reader", "阅读者之路", "阅读者成长下一步"],
  ["sailor", "水手之路", "水手成长下一步"],
  ["bard", "歌颂者之路", "歌颂者成长下一步"],
  ["corpsecollector", "收尸人之路", "收尸人成长下一步"],
  ["apprentice", "学徒之路", "学徒成长下一步"],
  ["marauder", "偷盗者之路", "偷盗者成长下一步"],
  ["warrior", "战士之路", "战士成长下一步"],
  ["assassin", "刺客之路", "刺客成长下一步"],
  ["pryer", "窥秘人之路", "窥秘人成长下一步"],
  ["secretSupplicant", "秘祈人之路", "秘祈人成长下一步"],
  ["criminal", "罪犯之路", "罪犯成长下一步"],
  ["prisoner", "囚犯之路", "囚犯成长下一步"],
  ["monster", "怪物之路", "怪物成长下一步"],
  ["lawyer", "律师之路", "律师成长下一步"],
  ["arbiter", "仲裁人之路", "仲裁人成长下一步"],
  ["cultivator", "耕种者之路", "耕种者成长下一步"],
] as const;

function ordinaryProjection(week = 6): SliceProjection {
  const raw = createSliceRun("pathway-navigation-run", sliceDefaultCreationSelection, "pathway-navigation-seed");
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  raw.week = week;
  return projectSliceState(raw);
}

function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision,
        updatedAt: "2026-10-12T00:01:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })),
    submitIntent: vi.fn(),
  };
}

function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: {
    intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-12T00:02:00Z", replayed: false, state,
  } };
}

async function enter(api: SliceBridge) {
  window.sliceGame = api;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}

async function openGrowth() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  return within(screen.getByRole("group", { name: "选择成长卷宗" }));
}

const currentStages = [
  {
    key: "interrogator", name: "审讯者", pathway: "justiciar", intent: "INTERROGATOR",
    caseId: "conflicting-delivery",
    previous: [{ key: "arbiter", name: "仲裁人" }, { key: "sheriff", name: "治安官" }],
  },
  {
    key: "harvestpriest", name: "丰收祭司", pathway: "mother", intent: "HARVESTPRIEST",
    caseId: "shared-yield",
    previous: [{ key: "cultivator", name: "耕种者" }, { key: "physician", name: "医师" }],
  },
] as const;
type CurrentStage = typeof currentStages[number];

// Renderer fixtures change only the public projection delivered by the bridge.
function currentProjection(stage: CurrentStage): SliceProjection {
  const state = ordinaryProjection(20);
  state.progression = { pathwayId: stage.pathway, sequence: 7, mastery: {}, acting: 24, promotionWeek: 12 };
  const current = state[stage.key];
  current.title = `${stage.name} · 序列7`;
  current.discovered = true;
  current.guidanceKnown = true;
  current.promoted = true;
  current.acting = 24;
  current.actions = [];
  for (const previous of stage.previous) {
    const history = state[previous.key];
    history.discovered = true;
    history.guidanceKnown = true;
    history.promoted = true;
    history.acting = 100;
    history.actions = [];
  }
  return state;
}

beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Current SliceApp ordinary pathway navigation", () => {
  it("shows the current objective before the collapsible route catalogue", async () => {
    await enter(bridge(ordinaryProjection()));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const current = screen.getByRole("region", { name: "成长下一步" });
    const routes = screen.getByRole("group", { name: "选择成长卷宗" });
    expect(current.compareDocumentPosition(routes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const catalogue = routes.closest("details")!;
    expect(catalogue.open).toBe(false);
    await userEvent.click(within(catalogue).getByText("查看其他途径（22条）"));
    expect(catalogue.open).toBe(true);
    await userEvent.click(within(catalogue).getByText("查看其他途径（22条）"));
    expect(catalogue.open).toBe(false);
    expect(current).toBeTruthy();
  });

  it("contains exactly the 22 unique named S9 routes from the current public projection", async () => {
    const state = ordinaryProjection();
    const api = bridge(state);
    await enter(api);
    const choices = await openGrowth();
    expect(state.progression.pathwayId).toBeNull();
    expect(ordinaryRoutes).toHaveLength(22);
    expect(new Set(ordinaryRoutes.map(([key]) => key)).size).toBe(22);
    expect(new Set(ordinaryRoutes.map(([, name]) => name)).size).toBe(22);
    expect(choices.getAllByRole("button")).toHaveLength(22);
    const entries = ordinaryRoutes.map(([, name]) => choices.getByRole("button", { name }));
    expect(new Set(entries).size).toBe(22);
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each(ordinaryRoutes)("opens the %s panel by clicking %s", async (key, name, region) => {
    const state = ordinaryProjection();
    const api = bridge(state);
    await enter(api);
    const choices = await openGrowth();
    // Seer is the initial page: leave it first so this test proves its click handler too.
    if (key === "seer") await userEvent.click(choices.getByRole("button", { name: "猎人之路" }));
    const entry = choices.getByRole("button", { name });
    expect(entry.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(entry);
    expect(entry.getAttribute("aria-pressed")).toBe("true");
    expect(choices.getAllByRole("button", { pressed: true })).toEqual([entry]);
    const panel = screen.getByRole("region", { name: region });
    expect(within(panel).getByRole("heading", { name: state[key].title })).toBeTruthy();
    expect(screen.queryByRole("region", { name: key === "seer" ? "猎人成长下一步" : "成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });
});

describe("Current pathway navigation at persistence and history boundaries", () => {
  it.each(currentStages)("keeps $name locked at zero resources until its exact CLOSE retry commits", async (stage) => {
    const state = currentProjection(stage);
    state.actionsRemaining = 0;
    state.mind = 0;
    state.spirituality = 0;
    state.canAct = false;
    const current = state[stage.key];
    current.insideCase = true;
    current.cases = [{
      id: stage.caseId, title: "当前已打开的原实践", story: "已保存的原实践仍须实际结束。",
      status: "EXAMINED", contactOpen: "本次实践尚未实际结束", closes: 0,
      observations: ["已保存的有限观察"], preparation: null, result: "此前成本和原结果保留。",
    }];
    current.actions = [{
      id: "close-current-practice", label: `实际结束${stage.name}原实践`,
      cost: "0行动 · 0精神 · 0灵性", enabled: true, reason: null,
      command: { type: "CLOSE", caseId: stage.caseId },
    }];
    const next = structuredClone(state);
    next.revision += 1;
    next[stage.key].insideCase = false;
    next[stage.key].actions = [];
    next[stage.key].cases[0]!.contactOpen = "本次实践已实际结束";
    next[stage.key].cases[0]!.closes = 1;
    const api = bridge(state);
    let finishRetry!: (result: SliceResult<SliceReceipt>) => void;
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "实际结束尚未保存", retryable: true } })
      .mockImplementationOnce(() => new Promise((resolve) => { finishRetry = resolve; }));

    await enter(api);
    await screen.findByRole("region", { name: `${stage.name}成长下一步` });
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    const title = screen.getByRole("button", { name: "返回标题" });
    expect((title as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(title);
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) {
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();

    const close = screen.getByRole("button", { name: new RegExp(`^实际结束${stage.name}原实践`) });
    expect((close as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(close);
    expect(screen.getByRole("alert").textContent).toContain("实际结束尚未保存");
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: stage.intent, command: { type: "CLOSE", caseId: stage.caseId } });
    fireEvent.click(close);
    expect(api.submitIntent).toHaveBeenCalledTimes(2);
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();

    await act(async () => { finishRetry(receipt(next, calls[0]![0])); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("本次实践：本次实践已实际结束")).toBeTruthy();
    expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: "返回标题" }) as HTMLButtonElement).disabled).toBe(false);
    await openGrowth();
    expect(screen.getByRole("button", { name: `${stage.name}成长` }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("本次实践：本次实践已实际结束")).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(2);
  }, 10_000);

  it.each(currentStages)("keeps both earlier stages read-only while navigating $name history", async (stage) => {
    const state = currentProjection(stage);
    for (const previous of stage.previous) {
      const history = state[previous.key];
      history.story = `${previous.name}保存的原阶段经历`;
      history.cases = [{
        id: `${previous.key}-completed`, title: `${previous.name}原实践`, story: "已结束的原实践。",
        status: "RESOLVED", contactOpen: "已实际结束", closes: 2,
        observations: [`${previous.name}原观察`], preparation: null, result: `${previous.name}原结果与已付成本`,
      }];
      history.bottles = [{
        id: `${previous.key}-original`, title: `${previous.name}原瓶`, source: `${previous.name}原渠道`,
        status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: `${previous.key}-original`, confirmed: true },
      }];
      history.actions = [{
        id: "old-reflect", label: "不得执行的旧阶段行动", cost: "1行动", enabled: true, reason: null,
        command: { type: "REFLECT" },
      }];
    }
    const api = bridge(state);
    await enter(api);
    await openGrowth();
    expect(screen.getByRole("region", { name: `${stage.name}成长下一步` })).toBeTruthy();
    for (const previous of stage.previous) {
      const entry = screen.getByRole("button", { name: `${previous.name}经历` });
      await userEvent.click(entry);
      expect(entry.getAttribute("aria-pressed")).toBe("true");
      const history = within(screen.getByRole("region", { name: `${previous.name}时期的经历` }));
      expect(history.getByText(`${previous.name}保存的原阶段经历`)).toBeTruthy();
      expect(history.getByText(`${previous.name}原结果与已付成本`)).toBeTruthy();
      expect(history.getByText(`来源：${previous.name}原渠道`)).toBeTruthy();
      expect(history.getByText("已耗用 · 原失败保留")).toBeTruthy();
      expect(history.queryByRole("button")).toBeNull();
      expect(history.queryByRole("combobox")).toBeNull();
      expect(screen.queryByRole("button", { name: /不得执行的旧阶段行动/ })).toBeNull();
      expect(screen.queryByRole("region", { name: `${stage.name}成长下一步` })).toBeNull();
    }
    await userEvent.click(screen.getByRole("button", { name: `${stage.name}成长` }));
    expect(screen.getByRole("region", { name: `${stage.name}成长下一步` })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });
});
