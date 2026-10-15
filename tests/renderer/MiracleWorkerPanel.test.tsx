/* @vitest-environment jsdom */
import { readObjectEntry } from "../helpers/read-object-entry";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiracleWorkerPanel, type MiracleWorkerPanelProps } from "../../src/renderer/MiracleWorkerPanel";
import { projectMiracleWorker } from "../../src/domain/miracle-worker/index";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { createMiracleWorkerLifeState } from "../../src/domain/miracle-worker/life";
import { createMiracleWorkerEncounterState, MIRACLE_WORKER_SITE } from "../../src/domain/miracle-worker/encounter";
import { MIRACLE_WORKER_REVIVAL_BOUNDARY, MIRACLE_WORKER_REVIVAL_SCOPE, MIRACLE_WORKER_REVIVAL_SOURCE } from "../../src/domain/miracle-worker/revival";
import type { MiracleWorkerAction, MiracleWorkerCommand, MiracleWorkerProjection } from "../../src/domain/miracle-worker/types";

// This original natural file is live S3 after three actual failed bottles. It is
// deliberately NOT treated as natural promotion, life practice or revival evidence.
const natural = migrateSliceState(readObjectEntry<unknown>("tests/fixtures/miracle-worker-v01640/natural.json", "final"));
const naturalProjection = projectMiracleWorker(natural);
const action = (command: MiracleWorkerCommand, label: string, cost = "0行动", extra: Partial<MiracleWorkerAction> = {}): MiracleWorkerAction => ({
  id: `MW2-UI:${command.type}`, command, label, cost, enabled: true, reason: null, ...extra,
});
const consume = () => action({ type: "CONSUME", bottleId: "miracle-worker-batch-4:bottle", confirmed: true }, "饮用所选原瓶", "一次原瓶与本来源600秒药窗");
const passage = () => action({ type: "OPEN_PASSAGE", confirmed: true }, "打开原固定通道", "实际场内时间G");
const revive = () => action({ type: "REVIVE_NEARBY", deathId: "UI:MW2-DEATH:800", confirmed: true }, "在原界石北侧就近复起", "真实消耗1/4全生涯次数 · 30游戏秒G · H30G · 原M/S/伤势不清");
const wait = () => action({ type: "WAIT_REVIVAL", deathId: "UI:MW2-DEATH:800" }, "实际再等30秒", "30游戏秒G · 达到120秒后最终封存");
const forfeit = () => action({ type: "FORFEIT_REVIVAL", deathId: "UI:MW2-DEATH:800", confirmed: true }, "放弃本次复起", "不耗次数 · 周目不可恢复");

/** Directed public renderer fixture only, not a valid save or natural qualification. */
function projection(actions: MiracleWorkerAction[] = [consume()]): MiracleWorkerProjection {
  const value = structuredClone(naturalProjection);
  value.actions = actions;
  value.insideCase = true;
  value.ritual = {
    ...value.ritual, location: "GATE_OUT", insideCase: true, currentSourceId: "MW2-UI-SOURCE", elapsedSeconds: 420,
    summary: "本人同一原身体在GATE_OUT；此来源真实回归已经保存。",
    sources: [{ id: "MW2-UI-SOURCE", name: "定向界面原聚落", facts: ["同一原瓶miracle-worker-batch-4:bottle；本次药窗OPEN，剩180游戏秒G。"],
      residents: ["UI-RESIDENT-1:body在GATE_IN；当前同意ROUND_TRIP。"], originals: ["UI-CENSUS-1同一原件：UI-RESIDENT-1 / ARCHIVE"], history: ["本次原回归已成立，药败不重置居民。"] }],
  };
  return value;
}

/** Directed REVIVAL_PENDING projection, never claimed to be natural death evidence. */
function pending(actions: MiracleWorkerAction[] = [revive(), wait(), forfeit()]): MiracleWorkerProjection {
  const value = projection(actions);
  value.promoted = true;
  value.ritual.insideCase = false;
  value.ritual.location = "RECEPTION";
  value.ritual.currentSourceId = null;
  value.revival = {
    title: "已真实战死 · 有限复起待决", available: true, pending: true, allowance: 4, used: 1, remaining: 3,
    supportedScope: MIRACLE_WORKER_REVIVAL_SCOPE, source: MIRACLE_WORKER_REVIVAL_SOURCE, boundary: MIRACLE_WORKER_REVIVAL_BOUNDARY,
    current: { deathId: "UI:MW2-DEATH:800", bodyId: "UI:body", deathHistoryIndex: 7, deathRevision: 800,
      deathAt: "旧采石场原界石尸位", rebuildAt: "界石北侧一米的隐蔽空地（同一原场，G）",
      elapsedSeconds: 60, remainingSeconds: 60, reconstructionSeconds: 30, healthAfter: 30,
      mindAfter: 67, spiritualityAfter: 19, existingInjuries: 3, existingRisk: 5, canCompleteInTime: true },
    bodyLocation: MIRACLE_WORKER_SITE,
    history: ["前次复起已经真实消耗1次，本次原PLAYER_DEAD仍永久保留。"],
    facts: ["原敌同一身体H70/M100/S41、原伤与原棍仍在原场，死亡结果不改。",
      "原尸位未耗原纸2张、原油0份；已耗原纸2张和油1份不补。",
      "当代工作台MW2-REPAIR-KIT-1和MW2-OWN-BOX-1不随身体移位。"], actions,
  };
  const practice = createMiracleWorkerLifeState();
  practice.kit.holder = "PLAYER"; practice.kit.location = "RECEPTION_WORKBENCH";
  practice.kit.purchaseWeek = 1; practice.kit.purchaseRevision = 1; practice.kit.pricePaid = 60;
  practice.ownBox.holder = "PLAYER"; practice.ownBox.location = "RECEPTION_WORKBENCH";
  practice.ownBox.purchaseWeek = 1; practice.ownBox.purchaseRevision = 2; practice.ownBox.pricePaid = 24;
  practice.spent = { cash: 84, spirituality: 16, mind: 5 };
  value.life = { insideCase: false, environment: "当代三案的原记录保留。", practice: { ...practice,
    facts: ["真实支出84便士、16灵性、5精神。", "原工具包位置RECEPTION_WORKBENCH，原盒位置RECEPTION_WORKBENCH；不随远处身体转移。"] },
    cases: [{ id: "small-repairs", title: "三件原小器物", story: "三位原主人与三件原物仍有独立记录。", observations: [], preparation: null,
      result: "原现场已经收束。", status: "RESOLVED", contactOpen: "没有未结束现场", closes: 1 }] };
  value.encounter = { encounter: { ...createMiracleWorkerEncounterState(), name: "科文·黑尔", story: "同一原敌，原身体及资源不重置。",
    sequence: 3, age: 46, originalExit: "北侧排水梯 → 公共出口", pursuit: false, distanceMetres: 3, noBystanders: true,
    status: "REVIVAL_PENDING", location: MIRACLE_WORKER_SITE, enemyHealth: 70, enemyMind: 100, enemySpirituality: 41,
    facts: ["原棍MW2-CORVEN-CLUB仍由原敌持有；原纸已耗2张，原油已耗1份。"], abilities: [] } };
  return value;
}
function panel(value = projection(), props: Partial<Omit<MiracleWorkerPanelProps, "value">> = {}) {
  const onCommand = vi.fn(props.onCommand ?? (() => undefined)), onClose = vi.fn(props.onClose ?? (() => undefined));
  const defaults = { value, busy: false, ...props, onCommand, onClose };
  return { ...render(<MiracleWorkerPanel {...defaults} />), defaults, onCommand, onClose };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const open = (label: string) => userEvent.click(screen.getByText(label, { selector: "summary" }));
const dialog = () => screen.getByRole("dialog") as HTMLDialogElement;

// jsdom does not implement browser modal focus/inert behavior. These spies verify
// the native API path and React focus/cancel behavior, not real-browser modality.
const nativeShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const nativeClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
const showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
const closeDialog = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); });
beforeEach(() => {
  showModal.mockClear(); closeDialog.mockClear();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, writable: true, value: showModal },
    close: { configurable: true, writable: true, value: closeDialog },
  });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  if (nativeShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", nativeShow);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (nativeClose) Object.defineProperty(HTMLDialogElement.prototype, "close", nativeClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

const critical = [
  { type: "CONSUME", make: consume, title: "饮用这一瓶奇迹师魔药？", cancel: "暂不饮药，留在当前现场", confirm: "确认饮用这一原瓶", pending: false },
  { type: "OPEN_PASSAGE", make: passage, title: "打开这一来源的永久真实通道？", cancel: "暂不开门，留在原锚", confirm: "确认打开这一原通道", pending: false },
  { type: "REVIVE_NEARBY", make: revive, title: "消耗账本次数，在原场就近复起？", cancel: "暂不复起，返回待决选择", confirm: "确认按上述成本就近复起", pending: true },
  { type: "FORFEIT_REVIVAL", make: forfeit, title: "放弃本次复起并最终封存？", cancel: "保留选择，返回待决页面", confirm: "确认放弃并最终封存", pending: true },
] as const;

describe("MiracleWorkerPanel critical native confirmation and save receipts", () => {
  it.each(critical)("reviews $type separately and cancel returns to the same action without advancing", async entry => {
    const selected = entry.make(), value = entry.pending ? pending([selected]) : projection([selected]);
    const before = structuredClone(value), { onCommand, onClose, container } = panel(value);
    const trigger = button(selected.label); await userEvent.click(trigger);
    const review = dialog();
    expect(review.tagName).toBe("DIALOG"); expect(review.open).toBe(true); expect(showModal).toHaveBeenCalledOnce();
    expect(review.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: entry.title }));
    expect(review.textContent).toContain(selected.cost);
    expect(container.querySelector('.miracle-worker-panel > [aria-hidden="true"]')).not.toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(button(entry.cancel));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it.each(["Escape", "native cancel"] as const)("%s cancels only the unsubmitted local review", async method => {
    const selected = consume(), { onCommand, onClose } = panel(projection([selected]));
    await userEvent.click(button(selected.label));
    if (method === "Escape") await userEvent.keyboard("{Escape}");
    else { const event = new Event("cancel", { bubbles: false, cancelable: true }); fireEvent(dialog(), event); expect(event.defaultPrevented).toBe(true); }
    expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(button(selected.label));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it.each(critical)("confirms the exact projected $type once and cannot cancel an unacknowledged submission", async entry => {
    const selected = entry.make(), value = entry.pending ? pending([selected]) : projection([selected]);
    const before = structuredClone(value), { onCommand, onClose } = panel(value);
    await userEvent.click(button(selected.label)); const confirm = button(entry.confirm);
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(selected.command); expect(onCommand.mock.calls[0]![0]).toBe(selected.command);
    expect(confirm.disabled).toBe(true); expect(button(entry.cancel).disabled).toBe(true);
    fireEvent.keyDown(dialog(), { key: "Escape" }); fireEvent(dialog(), new Event("cancel", { cancelable: true }));
    expect(dialog().open).toBe(true); expect(dialog().getAttribute("aria-busy")).toBe("true");
    expect(within(dialog()).getByRole("status").textContent).toContain("正在结算并保存这一原操作");
    expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it.each(["replaced but equal", "same object changed", "different command", "disabled action"] as const)("invalidates stale review: %s", async mode => {
    const value = projection(), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("饮用所选原瓶")); const oldConfirm = button("确认饮用这一原瓶");
    const changed = mode === "same object changed" ? value : structuredClone(value);
    if (mode === "same object changed") changed.actions[0]!.cost = "已变化的真实费用";
    if (mode === "different command") changed.actions[0]!.command = { type: "CONSUME", bottleId: "miracle-worker-batch-5:bottle", confirmed: true };
    if (mode === "disabled action") { changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "本来源药窗已过。"; }
    rerender(<MiracleWorkerPanel {...defaults} value={changed} />); fireEvent.click(oldConfirm);
    expect(screen.queryByRole("dialog")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("记录已更新，原确认已取消");
    if (mode === "disabled action") {
      expect(button("饮用所选原瓶").disabled).toBe(true);
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: changed.title }));
    }
  });

  it("keeps an ordinary exact intention locked through busy-only and equal-projection rerenders until saved facts change", () => {
    const selected = wait(), value = pending([selected]), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    fireEvent.click(button(selected.label)); fireEvent.click(button(selected.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(selected.command); expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<MiracleWorkerPanel {...defaults} busy />); rerender(<MiracleWorkerPanel {...defaults} />);
    expect(button(selected.label).disabled).toBe(true);
    rerender(<MiracleWorkerPanel {...defaults} value={structuredClone(value)} />); expect(button(selected.label).disabled).toBe(true);
    const saved = structuredClone(value); saved.revival.current!.elapsedSeconds = 90; saved.revival.current!.remainingSeconds = 30;
    rerender(<MiracleWorkerPanel {...defaults} value={saved} />); expect(button(selected.label).disabled).toBe(false);
    fireEvent.click(button(selected.label)); expect(onCommand).toHaveBeenCalledTimes(2);
    expect(onCommand.mock.calls[1]![0]).toBe(saved.actions[0]!.command); expect(value).toEqual(before);
  });

  it("exposes a rejected save without permitting another charge and unlocks only on a changed saved projection", async () => {
    const value = projection(), { defaults, rerender, onCommand } = panel(value, { onCommand: () => Promise.reject(new Error("原瓶提交未写入")) });
    await userEvent.click(button("饮用所选原瓶")); fireEvent.click(button("确认饮用这一原瓶"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("原瓶提交未写入"));
    expect(screen.getByRole("alert").textContent).toContain("同一次原操作");
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    await userEvent.click(button("关闭确认，查看保存错误"));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(button("饮用所选原瓶").disabled).toBe(true);
    rerender(<MiracleWorkerPanel {...defaults} value={structuredClone(value)} error={null} />);
    expect(button("饮用所选原瓶").disabled).toBe(true); expect(onCommand).toHaveBeenCalledOnce();
    const saved = structuredClone(value); saved.supplies = "原瓶已真实耗尽；收到新保存记录。"; saved.actions = [];
    rerender(<MiracleWorkerPanel {...defaults} value={saved} />);
    expect(screen.queryByRole("alert")).toBeNull(); expect(button("关闭奇迹师页面").disabled).toBe(false);
  });

  it.each([{ busy: true }, { blocked: true }, { error: "上次保存失败" }] as const)("respects parent lock %j", props => {
    const { onCommand, onClose } = panel(projection(), props);
    expect(button("饮用所选原瓶").disabled).toBe(true); expect(button("关闭奇迹师页面").disabled).toBe(true);
    fireEvent.click(button("饮用所选原瓶")); fireEvent.click(button("关闭奇迹师页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("physical departure submits the projected original-route command without closing the page locally", () => {
    const leave = action({ type: "LEAVE_RITUAL" }, "沿原普通路段退出", "实际路程 · 原后果保留");
    const value = projection([leave]), before = structuredClone(value), { onCommand, onClose } = panel(value);
    fireEvent.click(button(leave.label)); fireEvent.click(button(leave.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(onCommand.mock.calls[0]![0]).toBe(leave.command);
    expect(onClose).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).toBeNull(); expect(value).toEqual(before);
  });

  it("page back is navigation only and is not a physical ritual exit", () => {
    const value = projection(), before = structuredClone(value), { onCommand, onClose } = panel(value);
    expect(screen.getByText(/关闭本页不会收束现场/)).toBeTruthy(); fireEvent.click(button("关闭奇迹师页面"));
    expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe("MiracleWorkerPanel truthful originals and REVIVAL_PENDING boundaries", () => {
  it("shows the actual natural three-source return and exhausted bottles without claiming promotion", async () => {
    const value = structuredClone(naturalProjection), before = structuredClone(value), { onCommand } = panel(value);
    expect(natural.status).toBe("ACTIVE"); expect(natural.progression.sequence).toBe(3); expect(value.promoted).toBe(false);
    expect(natural.miracleWorker.bottles.map(entry => entry.outcome)).toEqual(["FAILURE", "FAILURE", "FAILURE"]);
    expect(screen.getByRole("heading", { name: "奇迹师之路 · 遗落历史真正回归" })).toBeTruthy();
    await open("真实聚落、现生居民、原物与实际路线");
    for (const source of value.ritual.sources) {
      await open(source.name);
      const facts = screen.getByRole("region", { name: `${source.name}的回归、药窗与原瓶` });
      expect(facts.textContent).toContain("药窗CONSUMED");
      for (const fact of source.originals) expect(screen.getByRole("region", { name: `${source.name}的同一原物去向` }).textContent).toContain(fact);
    }
    await open("完整配方、原瓶与晋升风险"); expect(screen.getAllByText(value.supplies).length).toBeGreaterThan(0);
    expect(value.supplies).toContain("原瓶3，耗尽3"); expect(screen.queryByRole("dialog")).toBeNull();
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("shows actual fifth-bottle natural promotion and paid life resources without claiming natural revival", async () => {
    const state = migrateSliceState(readObjectEntry<unknown>("tests/fixtures/miracle-worker-v01640/continuation.json", "final"));
    const value = projectMiracleWorker(state), before = structuredClone(value), { onCommand } = panel(value);
    expect(state.status).toBe("ACTIVE"); expect(state.progression.sequence).toBe(2);
    expect(state.miracleWorker.bottles.map(entry => entry.outcome)).toEqual(["FAILURE", "FAILURE", "FAILURE", "FAILURE", "SUCCESS"]);
    expect(value.revival.used).toBe(0); expect(value.revival.pending).toBe(false);
    await open("三案记录、同类愿望与反思");
    const saved = screen.getByRole("region", { name: "已保存的愿望与资源" });
    for (const fact of value.life.practice!.facts) expect(saved.textContent).toContain(fact);
    for (const text of ["84便士", "16灵性", "5精神", "RECEPTION_WORKBENCH", "原骰77", "当前剩余0秒G"]) expect(saved.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "有限复起待决选择" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("renders the actual directed death projection with original H0 resources and finite same-body reconstruction", async () => {
    // Only the generator's explicitly directed random.cursor branch supplies this
    // real saved death. The untouched natural continuation above is still alive.
    const state = migrateSliceState(readObjectEntry<unknown>("tests/fixtures/miracle-worker-v01640/directed-revival.json", "pending"));
    const value = projectMiracleWorker(state), before = structuredClone(value), { onCommand } = panel(value);
    expect(state.status).toBe("REVIVAL_PENDING"); expect(state.health).toBe(0);
    expect(state.mind).toBe(100); expect(state.spirituality).toBe(113); expect(value.revival.used).toBe(0);
    await open("原敌与原场结局");
    const originals = screen.getByRole("region", { name: "原敌、原器材与当前去向" });
    for (const text of ["H100/M100/S109", "MW2-CORVEN-CLUB", "纸余3/4", "耗纸1", "油余0", "原棍留原尸位", "PLAYER_DEAD"]) expect(originals.textContent).toContain(text);
    const selected = value.actions.find(entry => entry.command.type === "REVIVE_NEARBY")!;
    expect(selected.enabled).toBe(true); await userEvent.click(button(selected.label));
    for (const text of ["seer-rebuild-natural:body", "累计已用 0/4 · 剩余 4", "已过 0 游戏秒", "窗口剩余 120 游戏秒", "健康 30", "精神 100", "灵性 113", "原伤 2 项", "累计风险 1", "当代工作台工具/原盒", "原尸位未耗物"]) expect(dialog().textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("shows only projected pending choices while preserving read-only life and original-enemy evidence", async () => {
    const ordinary = action({ type: "WORK" }, "普通工作不得出现");
    const materials = action({ type: "BUY_MATERIALS", batchId: "UI:BATCH" }, "原材料购买不得出现");
    const life = action({ type: "BUY_REPAIR_KIT" }, "生活购买不得出现", "60便士", { id: "MW2-LIFE:BUY_REPAIR_KIT" });
    const leave = action({ type: "ENCOUNTER_LEAVE" }, "现场离开不得出现", "普通步行", { id: "MW2-ENCOUNTER:ENCOUNTER_LEAVE" });
    const value = pending([revive(), wait(), forfeit(), ordinary, materials, life, leave]);
    const before = structuredClone(value), { onCommand, onClose } = panel(value);
    const choices = screen.getByRole("region", { name: "有限复起待决选择" });
    expect(within(choices).getAllByRole("button")).toHaveLength(3);
    expect(choices.textContent).toContain("总额度 4 · 已实际使用 1 · 剩余 3");
    expect(within(screen.getByRole("region", { name: "奇迹师当前处境" })).getByRole("heading", { name: "已真实战死 · 有限复起待决" })).toBeTruthy();
    for (const label of [ordinary.label, materials.label, life.label, leave.label]) expect(screen.queryByRole("button", { name: name => name.startsWith(label) })).toBeNull();
    await open("三项生活案与已经保存的进度"); await open("三案记录、同类愿望与反思");
    expect(screen.getByRole("region", { name: "已保存的愿望与资源" }).textContent).toContain("RECEPTION_WORKBENCH");
    await open("原敌与原场结局"); const enemy = screen.getByRole("region", { name: "当代同一原人遭遇" });
    for (const text of ["MW2-CORVEN-HALE", "健康 70", "精神 100", "灵性 41", "原纸已耗2张", "原油已耗1份"]) expect(enemy.textContent).toContain(text);
    expect(within(enemy).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("关闭奇迹师页面")); expect(onClose).toHaveBeenCalledOnce(); expect(value).toEqual(before);
  });

  it("describes the same body, actual retained resources, finite clock and original custody before revival", async () => {
    const value = pending(), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button("在原界石北侧就近复起")); const review = dialog();
    for (const text of ["UI:MW2-DEATH:800", "UI:body", "累计已用 1/4 · 剩余 3", "旧采石场原界石尸位", "界石北侧一米", "已过 60 游戏秒", "窗口剩余 60 游戏秒", "需 30 游戏秒", "健康 30", "精神 67", "灵性 19", "原伤 3 项", "累计风险 5", "精神/灵性不补", "MW2-REPAIR-KIT-1", "MW2-OWN-BOX-1"]) expect(review.textContent).toContain(text);
    expect(review.textContent).toContain("原尸位未耗原纸2张、原油0份");
    expect(onCommand).not.toHaveBeenCalled(); expect(value.revival.used).toBe(1); expect(value).toEqual(before);
  });

  it("forfeiting has a separate irreversible review and never masquerades as the revive cost", async () => {
    const value = pending(), { onCommand } = panel(value); await userEvent.click(button("放弃本次复起"));
    expect(dialog().textContent).toContain("不耗次数 · 周目不可恢复");
    expect(dialog().textContent).toContain("最终封存本周目"); expect(dialog().textContent).toContain("UI:MW2-DEATH:800");
    expect(screen.queryByRole("button", { name: "确认按上述成本就近复起" })).toBeNull();
    await userEvent.click(button("保留选择，返回待决页面")); expect(onCommand).not.toHaveBeenCalled();
    expect(value.revival.pending).toBe(true); expect(value.revival.used).toBe(1);
  });

  it("retains an insufficient-window reason without calculating a fresh window or reviving locally", () => {
    const disabled = { ...revive(), enabled: false, reason: "剩余游戏时间不足完成本场30秒G重组。" };
    const value = pending([disabled, wait(), forfeit()]); Object.assign(value.revival.current!, { elapsedSeconds: 100, remainingSeconds: 20, canCompleteInTime: false });
    const before = structuredClone(value), { onCommand } = panel(value), control = button(disabled.label);
    expect(control.disabled).toBe(true); expect(control.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(control.getAttribute("aria-describedby")!)?.textContent).toBe(disabled.reason);
    expect(screen.getByText("当前投影确认：已不能在本次窗口内完成重组。")).toBeTruthy();
    fireEvent.click(control); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).toBeNull(); expect(value).toEqual(before);
  });

  it("does not manufacture pending commands from a nonempty allowance or a death description", () => {
    const value = pending([]), { onCommand } = panel(value);
    expect(within(screen.getByRole("group", { name: "复起、等待或最终封存" })).queryByRole("button")).toBeNull();
    expect(screen.getByText("当前已保存投影没有可提交的待决命令，请查看主界面状态。")).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not offer revival solely because an ordinary projection contains a revival-shaped action", () => {
    const value = projection([revive()]); value.revival.available = true;
    const { onCommand } = panel(value);
    expect(value.revival.pending).toBe(false); expect(screen.queryByRole("button", { name: /在原界石北侧就近复起/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "有限复起待决选择" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });
});
