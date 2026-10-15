/* @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

// Explicitly synthetic UI fixtures, not natural-command progression evidence.
// The real creator and projector supply the current public model and battle wheels.
function fixture(sequence: 4 | 5, combat = false): SliceProjection {
  const raw = createSliceRun("iron-blood-navigation-run", sliceDefaultCreationSelection, "iron-blood-navigation-seed");
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  raw.week = 90;
  raw.world.city = "BACKLUND";
  raw.progression = { pathwayId: "hunter", sequence, mastery: {}, acting: 100, promotionWeek: sequence === 4 ? 88 : 71 };
  raw.hunter.discovered = true;
  raw.reaper.guidanceKnown = true;
  raw.reaper.promotionWeek = 71;
  raw.ironBloodKnight.guidanceKnown = true;
  if (sequence === 4) {
    raw.ironBloodKnight.promotionWeek = 88;
    raw.ironBloodKnight.reaperActingAtPromotion = 100;
  }
  if (combat) {
    const encounter = raw.ironBloodKnight.encounter;
    encounter.status = "FIGHTING";
    encounter.attemptWeek = raw.week;
    encounter.startHistoryIndex = 0;
    encounter.companionIds = ["IB4-01", "IB4-02"];
    for (const member of raw.ironBloodKnight.team.members) {
      if (!encounter.companionIds.includes(member.id)) continue;
      member.joined = true;
      member.willing = true;
      member.present = true;
      member.location = "YARD";
    }
    raw.combat = {
      encounterId: "IRON_BLOOD_DISPUTE", round: 1,
      enemyHealth: encounter.enemy.health, enemyMind: encounter.enemy.mind,
      enemyInjuries: [], enemyRisk: 0, enemyStatus: "RESISTING", lastRound: null,
    };
  }
  return projectSliceState(raw);
}

function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision,
        updatedAt: "2026-10-12T00:00:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })),
    // Hold the request pending so these tests inspect only the outbound intent.
    submitIntent: vi.fn(() => new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(() => {})),
  };
}

async function enter(state: SliceProjection) {
  const api = bridge(state);
  window.sliceGame = api;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
  expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
  return api;
}

beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

it("opens Hunter S5 to S4 advancement from its dashboard guide without submitting an action", async () => {
  const state = fixture(5);
  const api = await enter(state);
  await userEvent.click(screen.getByRole("button", { name: "查看铁血骑士晋升" }));

  const summary = within(screen.getByRole("region", { name: "铁血骑士成长下一步" }));
  expect(summary.getByRole("heading", { name: state.ironBloodKnight.title })).toBeTruthy();
  expect(summary.getByText(/仪式需要至少30名真正共同成长/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "铁血骑士晋升" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("region", { name: "收割者成长下一步" })).toBeNull();
  expect(api.submitIntent).not.toHaveBeenCalled();
});

it("opens current S4 growth and preserves the prior Reaper case and bottle as read-only history", async () => {
  const state = fixture(4);
  state.reaper.cases = [{
    id: "moving-shutter", title: "原挡片练习", story: "同一原挡片与原场地。",
    status: "RESOLVED", observations: ["原观察仍在"], preparation: "曾准备有限窗口",
    result: "原失败与已付成本保留", contactOpen: "原现场已实际结束", closes: 2,
    windowOpen: "原窗口已关闭", practice: "实际尝试2次，原窗口使用1次",
  }];
  state.reaper.bottles = [{
    id: "reaper-original-bottle", title: "收割者原瓶", source: "原指导者的已交付成品",
    status: "原瓶已耗尽 · 排异失败保留", chance: 0,
    command: { type: "CONSUME", bottleId: "reaper-original-bottle", confirmed: true },
  }];
  state.reaper.actions = [{
    id: "old-reflect", label: "不得重做的收割者反思", cost: "1行动", enabled: true, reason: null,
    command: { type: "REFLECT" },
  }];
  const api = await enter(state);
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  expect(screen.getByRole("region", { name: "铁血骑士成长下一步" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "铁血骑士成长" }).getAttribute("aria-pressed")).toBe("true");

  await userEvent.click(screen.getByRole("button", { name: "收割者经历" }));
  const history = within(screen.getByRole("region", { name: "收割者时期的经历" }));
  await userEvent.click(history.getByText("原挡片练习 · 已报告"));
  expect(history.getByText("原观察仍在")).toBeTruthy();
  expect(history.getByText("原窗口已关闭")).toBeTruthy();
  expect(history.getByText("当时的结果与报告：原失败与已付成本保留")).toBeTruthy();
  expect(history.getByText("原现场已实际结束 · 实际结束 2 次")).toBeTruthy();
  await userEvent.click(history.getByText("收割者原瓶 · 来源与去向"));
  expect(history.getByText("原瓶：reaper-original-bottle")).toBeTruthy();
  expect(history.getByText("来源：原指导者的已交付成品")).toBeTruthy();
  expect(history.getByText("原瓶已耗尽 · 排异失败保留")).toBeTruthy();
  expect(history.queryAllByRole("button", { hidden: true })).toHaveLength(0);
  expect(history.queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
  expect(screen.queryByRole("button", { name: /不得重做的收割者反思/ })).toBeNull();
  expect(screen.queryByRole("region", { name: "铁血骑士成长下一步" })).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "铁血骑士成长" }));
  expect(screen.getByRole("region", { name: "铁血骑士成长下一步" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "收割者时期的经历" })).toBeNull();
  expect(api.submitIntent).not.toHaveBeenCalled();
});

it.each(["HOLD", "SHARE_FIRST"] as const)("sends the exact %s policy only after explicit public battle round confirmation", async (policy) => {
  const state = fixture(4, true);
  const api = await enter(state);
  const battle = within(screen.getByRole("dialog", { name: state.combat!.title! }));
  const hold = battle.getByRole("radio", { name: "本回合不分担" }) as HTMLInputElement;
  const share = battle.getByRole("radio", { name: "首次实际合格伤害由在场队员有限分担" }) as HTMLInputElement;
  expect(hold.checked).toBe(true);
  expect(share.checked).toBe(false);
  expect(state.combat!.ironBlood!.companions.map((member) => member.id)).toEqual(["IB4-01", "IB4-02"]);
  for (const member of state.combat!.ironBlood!.companions) {
    expect(battle.getByText(`${member.name} · 健康${member.health} · 精力${member.energy} · 实际在场`)).toBeTruthy();
  }
  if (policy === "SHARE_FIRST") await userEvent.click(share);
  expect(hold.checked).toBe(policy === "HOLD");
  expect(share.checked).toBe(policy === "SHARE_FIRST");
  expect(api.submitIntent).not.toHaveBeenCalled();

  await userEvent.click(battle.getByRole("button", { name: "确认姿态，结算完整回合" }));
  expect(api.submitIntent).toHaveBeenCalledTimes(1);
  const envelope = vi.mocked(api.submitIntent).mock.calls[0]![0];
  expect(envelope).toEqual({
    intentId: expect.any(String), runId: state.runId, expectedRevision: state.revision,
    payload: { type: "COMBAT_ROUND", stance: state.combat!.stances[0]!.id, ironBloodPolicy: policy },
  });
});
