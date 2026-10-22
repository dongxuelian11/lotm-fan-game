/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { HUNTER_ABILITIES } from "../../src/domain/hunter/content";
import type { HunterAction, HunterProjection } from "../../src/domain/hunter/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { HunterPanel } from "../../src/renderer/HunterPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const discover: HunterAction = {
  id: "discover", label: "拜访退役追踪员", cost: "1行动 · 只建立渠道", enabled: true,
  reason: null, command: { type: "DISCOVER" },
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
function hunter(patch: Partial<HunterProjection> = {}): HunterProjection {
  return {
    title: "猎人之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3, risk,
    trapStock: 0, trapHeld: 0, trapDeployed: 0, trapSpent: 0, ...patch,
  };
}
function bottled(): HunterProjection {
  return hunter({
    discovered: true, guidanceKnown: true,
    supplies: "完整配方资料待核，只能取得导师三瓶独立成品；供应方剩余1瓶，你持有未服原瓶2瓶。",
    actions: ["hunter-potion-1", "hunter-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "hunter-potion-1", title: "第一瓶猎人魔药", source: "导师留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "hunter-potion-1", confirmed: true } },
      { id: "hunter-potion-2", title: "第二瓶猎人魔药", source: "导师留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "hunter-potion-2", confirmed: true } },
      { id: "hunter-potion-3", title: "第三瓶猎人魔药", source: "导师留存的第三原瓶", status: "导师保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "hunter-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: HunterProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<HunterPanel hunter={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("hunter-renderer-run", sliceDefaultCreationSelection, "hunter-renderer-seed");
  raw.week = 6;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    hunter: hunter({
      discovered: promoted, guidanceKnown: promoted, promoted,
      title: promoted ? "猎人 · 序列9" : "猎人之路",
      actions: promoted ? [] : [discover],
      abilities: promoted ? HUNTER_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 5 })) : [],
      trapStock: promoted ? 1 : 0, trapHeld: promoted ? 1 : 0, trapDeployed: promoted ? 1 : 0,
    }),
    progression: {
      pathwayId: promoted ? "hunter" : null, sequence: promoted ? 9 : null,
      mastery: promoted ? Object.fromEntries(HUNTER_ABILITIES.map((ability) => [ability.id, 0])) : {},
      acting: 0, promotionWeek: promoted ? 5 : null,
    }, ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision,
        updatedAt: "2026-10-11T00:00:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: {
    intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-11T00:01:00Z", replayed: false, state,
  } };
}
async function enter(value: SliceBridge) {
  window.sliceGame = value;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
async function openHunter() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "猎人之路" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Hunter pathway dossier", () => {
  it("lets an ordinary character inspect either route without blocking ordinary life", async () => {
    const value = bridge(fixture());
    await enter(value);
    expect(screen.queryByRole("dialog")).toBeNull();
    await openHunter();
    expect(screen.getByRole("button", { name: "占卜家之路" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "猎人成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "小丑晋升" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect((screen.getByRole("button", { name: /^工作，/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("shows the three original bottles and supply statement, without inventing a recipe or manufacturing", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "不应展示的未知材料", quantity: 7, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("不应展示的未知材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|制药|制造/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely, returns focus, and confirms only the selected original bottle once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶猎人魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶猎人魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶猎人魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶猎人魔药」/ }));
    expect(screen.getByText("hunter-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：导师留存的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "猎人服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶猎人魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "hunter-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("discards confirmation if the selected bottle is no longer present", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶猎人魔药」/ }));
    rerender(<HunterPanel hunter={{ ...value, bottles: value.bottles.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses public practice, preparation, recovery and cargo actions without changing their costs or commands", async () => {
    const commands: HunterAction["command"][] = [
      { type: "PRACTICE", practiceId: "public-tracking" }, { type: "SET_TRAP", location: "HUNTER_CARGO" },
      { type: "RECOVER_TRAP" }, { type: "CARGO_TALK" }, { type: "CARGO_FIGHT" },
    ];
    const actions: HunterAction[] = commands.map((command, index) => ({
      id: `action-${index}`, label: `公开行动${index}`, cost: `领域成本原文${index}`,
      enabled: true, reason: null, command,
    }));
    actions.push({ id: "sold-out", label: "购买原件", cost: "0行动 · 12便士", enabled: false, reason: "有限原件已售罄。", command: { type: "BUY_TRAP_KIT" } });
    const { onCommand } = panel(hunter({ promoted: true, actions, story: "现场已经公开的货物去向。" }));
    await userEvent.click(screen.getByText("货道争议"));
    expect(screen.getByRole("region", { name: "当前猎人情境" }).textContent).toContain("现场已经公开的货物去向。");
    for (const action of actions.slice(0, 5)) {
      const button = screen.getByRole("button", { name: new RegExp(action.label) });
      expect(screen.getByText(action.cost)).toBeTruthy();
      await userEvent.click(button);
      expect(onCommand).toHaveBeenLastCalledWith(action.command);
    }
    const soldOut = screen.getByRole("button", { name: /购买原件/ }) as HTMLButtonElement;
    expect(soldOut.disabled).toBe(true);
    expect(screen.getByText("有限原件已售罄。")).toBeTruthy();
    fireEvent.click(soldOut);
    expect(onCommand).toHaveBeenCalledTimes(5);
  });

  it("shows one selected practice instead of six buttons, keeps cargo closed, and advances after a completed practice disappears", async () => {
    const practices: HunterAction[] = Array.from({ length: 6 }, (_, index) => ({
      id: `practice-${index}`, label: `未完成实践${index + 1}`, cost: `当前公开情境与成本${index + 1}`,
      enabled: true, reason: null, command: { type: "PRACTICE", practiceId: `practice-${index}` },
    }));
    const buy: HunterAction = { id: "buy", label: "购买实际原件", cost: "12便士", enabled: true, reason: null, command: { type: "BUY_TRAP_KIT" } };
    const cargo: HunterAction = { id: "cargo", label: "公开货运交涉", cost: "1行动", enabled: true, reason: null, command: { type: "CARGO_TALK" } };
    const value = hunter({ promoted: true, actions: [buy, ...practices, cargo] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("button", { name: /^未完成实践/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "未完成实践1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /购买实际原件/ })).toBeTruthy();
    expect((screen.getByText("货道争议").closest("details") as HTMLDetailsElement).open).toBe(false);
    expect(screen.getByRole("region", { name: "猎人成长下一步" }).textContent).toContain("下一步：未完成实践1");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择未完成的实践" }), "practice-1");
    expect(screen.queryByRole("button", { name: "未完成实践1" })).toBeNull();
    expect(screen.getByRole("region", { name: "当前猎人实践" }).textContent).toContain("当前公开情境与成本2");
    await userEvent.click(screen.getByRole("button", { name: "未完成实践2" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(practices[1]!.command);
    rerender(<HunterPanel hunter={{ ...value, actions: [buy, ...practices.slice(2), cargo] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getAllByRole("button", { name: /^未完成实践/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "未完成实践3" })).toBeTruthy();
  });

  it("shows all four acquired abilities and the actual stock, held, deployed and spent quantities", () => {
    panel(hunter({
      promoted: true, actions: [], acting: 24, digestion: "已留下实际追踪经历。",
      abilities: HUNTER_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 5 })),
      trapStock: 0, trapHeld: 1, trapDeployed: 1, trapSpent: 1,
    }));
    const inventory = screen.getByRole("region", { name: "猎人陷阱原件库存" });
    expect(within(inventory).getByText("供应方库存").nextElementSibling?.textContent).toBe("0 套");
    for (const label of ["随身持有", "现场已布置", "累计损耗"]) {
      expect(within(inventory).getByText(label).nextElementSibling?.textContent).toBe("1 套");
    }
    const abilities = screen.getByRole("region", { name: "猎人能力与消化" });
    for (const [index, ability] of HUNTER_ABILITIES.entries()) {
      expect(within(abilities).getByText(`${ability.label} · 掌握 ${index * 5}`)).toBeTruthy();
    }
    expect(abilities.textContent).toContain("扮演进度 24");
  });

  it("calls the promoted character a hunter, defaults to that route, and keeps known seer information read-only", async () => {
    const state = fixture(true);
    state.seer.discovered = true;
    state.seer.formulaKnown = true;
    state.seer.formula = [{ name: "已学占卜家配方材料", quantity: 2, unit: "份" }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`猎人 · 序列9 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("猎人 · 序列9 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "猎人成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "小丑晋升" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    const history = screen.getByRole("region", { name: "已了解的占卜家渠道" });
    expect(history.textContent).toContain("已学占卜家配方材料");
    expect(history.textContent).toContain("不能改服魔药");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "占卜家能力与消化" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps known hunter bottles as history after choosing the seer pathway", async () => {
    const state = fixture(false, {
      hunter: bottled(),
      progression: { pathwayId: "diviner", sequence: 9, acting: 0, mastery: {}, promotionWeek: 5 },
    });
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "猎人经历" }));
    const history = screen.getByRole("region", { name: "已了解的猎人渠道" });
    expect(history.textContent).toContain("第一瓶猎人魔药");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "猎人能力与消化" })).toBeNull();
  });

  it("retries the same failed envelope and original bottle without accepting another click", async () => {
    const state = fixture(false, { hunter: bottled(), actionsRemaining: 0 });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openHunter();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶猎人魔药」/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶猎人魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: /正在结算并保存/ }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "猎人模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("猎人模拟保存失败");
    expect((screen.getByRole("button", { name: "确认服用「第二瓶猎人魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "占卜家之路" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "HUNTER", command: { type: "CONSUME", bottleId: "hunter-potion-2", confirmed: true } });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it("opens the shared combat screen from the public cargo action and shows the actual field trap", async () => {
    const state = fixture(true);
    state.hunter.actions = [{ id: "cargo-fight", label: "介入货物现场冲突", cost: "1行动 · 可能受伤或死亡", enabled: true, reason: null, command: { type: "CARGO_FIGHT" } }];
    const next: SliceProjection = { ...state, revision: state.revision + 1, combat: {
      title: "仓库货物冲突", round: 1, enemyName: "公开的拦路者", enemyHealth: 100,
      enemyStatus: "RESISTING", playerCountWheel: [], enemyCountWheel: [], playerAbilityWheel: [], enemyAbilityWheel: [],
      consequenceWeights: { light: 65, heavy: 30, death: 5 },
      stances: [{ id: "ATTACK", label: "进攻", description: "当前公开姿态说明。" }], lastRound: null,
    } };
    const value = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockImplementation(async (envelope) => receipt(next, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openHunter();
    await userEvent.click(screen.getByText("货道争议"));
    await userEvent.click(screen.getByRole("button", { name: /介入货物现场冲突/ }));
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "HUNTER", command: { type: "CARGO_FIGHT" } });
    const battle = await screen.findByRole("dialog", { name: "仓库货物冲突" });
    expect(within(battle).getByText("陷阱原件：随身 1 套 · 现场 1 套 · 已损耗 0 套")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
