/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { CryptologistAction, CryptologistCommand, CryptologistProjection } from "../../src/domain/cryptologist/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { CryptologistPanel, SwindlerHistory } from "../../src/renderer/CryptologistPanel";
import { MarauderHistory } from "../../src/renderer/MarauderPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 40, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
const caseIds = ["ledger-sequence", "stage-corridor", "marked-rubbing"] as const;
function action(command: CryptologistCommand, enabled = true): CryptologistAction {
  const target = "caseId" in command ? command.caseId : "bottleId" in command ? command.bottleId : "";
  const suffix = command.type === "PREPARE" ? command.method : command.type === "REPORT" ? command.conclusion : "";
  return {
    id: `${command.type}-${target}-${suffix}`, label: `公开操作${command.type}${target}${suffix}`,
    cost: `领域成本${command.type}`, enabled, reason: enabled ? null : "领域原因：本周已尝试，请下周再来。", command,
  };
}
function cases(): CryptologistProjection["cases"] {
  return caseIds.map((id, index) => ({
    id, title: `解密情境${index + 1}`, story: `原记录的公开说明${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE",
  }));
}
function cryptologist(patch: Partial<CryptologistProjection> = {}): CryptologistProjection {
  return {
    title: "解密学者之路", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立成品，每瓶2010便士或实际劳动4次加210便士。完整配方待核。",
    actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "诈骗师消化100/100，成熟时间8/8整周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): CryptologistProjection {
  return cryptologist({ guidanceKnown: true,
    actions: ["cryptologist-potion-1", "cryptologist-potion-2"].map((bottleId) => ({
      ...action({ type: "CONSUME", bottleId, confirmed: true }), cost: "0行动 · 独立确认 · 消耗这瓶魔药",
    })),
    bottles: [
      { id: "cryptologist-potion-1", title: "第一瓶解密学者魔药", source: "艾德温独立封存的第一进阶原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "cryptologist-potion-1", confirmed: true } },
      { id: "cryptologist-potion-2", title: "第二瓶解密学者魔药", source: "四次真实劳务及余款换得的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "cryptologist-potion-2", confirmed: true } },
      { id: "cryptologist-potion-3", title: "第三瓶解密学者魔药", source: "已耗用的第三原瓶", status: "已耗尽 · 排异，未晋升", chance: 43, command: { type: "CONSUME", bottleId: "cryptologist-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: CryptologistProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<CryptologistPanel cryptologist={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | 7 | null = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("cryptologist-renderer-run", sliceDefaultCreationSelection, "cryptologist-renderer-seed");
  raw.week = 14;
  raw.activeEvent = null;
  raw.arc.stage = "ENDED";
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, investigateTargets: [], canAct: true, actionBlockedReason: null,
    marauder: { ...state.marauder, discovered: sequence !== null, promoted: sequence !== null },
    swindler: { ...state.swindler, discovered: sequence === 8 || sequence === 7, promoted: sequence === 8 || sequence === 7 },
    cryptologist: cryptologist({ title: sequence === 7 ? "解密学者 · 序列7" : "解密学者之路", promoted: sequence === 7, actions: sequence === 7 ? [] : [action({ type: "LEARN_GUIDANCE" })] }),
    progression: { pathwayId: sequence === null ? null : "error", sequence, mastery: {}, acting: sequence === 8 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
    ...patch,
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
async function openCryptologist() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "解密学者晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Cryptologist sequence seven dossier", () => {
  it("keeps the twelve ordinary routes and closes without an extra initial pathway", async () => {
    const value = bridge(fixture(null));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const tabs = screen.getByRole("group", { name: "选择成长卷宗" });
    expect(within(tabs).getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路", "偷盗者之路"]) {
      expect(within(tabs).getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /解密学者/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("adds Cryptologist preparation after Swindler and routes the advancement guide to it", async () => {
    const value = bridge(fixture(8));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "诈骗师成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "解密学者晋升" }));
    expect(screen.getByRole("region", { name: "解密学者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "解密学者成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("forwards each acquisition action with backend cost and reason, without fabricating a recipe", async () => {
    const { onCommand, rerender } = panel(cryptologist({ formula: [{ name: "未核配方不得显示", quantity: 9, unit: "份" }] }));
    expect(screen.queryByText("未核配方不得显示")).toBeNull();
    expect(screen.getByText(/新渠道独立成品药/)).toBeTruthy();
    expect(screen.getByText(/每瓶2010便士或实际劳动4次加210便士/)).toBeTruthy();
    const commands: CryptologistCommand[] = [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "cryptologist-potion-1" },
      { type: "BUY_POTION", bottleId: "cryptologist-potion-1" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    ];
    for (const command of commands) {
      const current = { ...action(command), cost: command.type === "LEARN_GUIDANCE" ? "1行动 · 240便士" : `原领域成本${command.type}` };
      rerender(<CryptologistPanel cryptologist={cryptologist({ actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      expect(screen.getByText(current.cost)).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("button", { name: /确认服用|调配|制造/ })).toBeNull();
    }
    const unavailable = action({ type: "BUY_POTION", bottleId: "cryptologist-potion-2" }, false);
    rerender(<CryptologistPanel cryptologist={cryptologist({ actions: [unavailable] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getAllByText(unavailable.reason!, { exact: false }).length).toBeGreaterThan(0);
    const disabled = screen.getByRole("button", { name: new RegExp(`^${unavailable.label}`) });
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(disabled);
    expect(onCommand).toHaveBeenCalledTimes(commands.length);
  });

  it("independently confirms the selected original bottle, cancels for free and guards repeat submission", async () => {
    const { onCommand } = panel(bottled());
    expect(screen.getAllByRole("button", { name: /查看并准备服用/ })).toHaveLength(2);
    expect(screen.getByText("已耗尽 · 排异，未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶解密学者魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶解密学者魔药" }));
    fireEvent.keyDown(screen.getByRole("region", { name: "这瓶解密学者魔药的服用确认" }), { key: "Escape" });
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶解密学者魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶解密学者魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶解密学者魔药」/ }));
    for (const text of ["cryptologist-potion-2", "43%", "来源：四次真实劳务及余款换得的第二原瓶", "0行动 · 独立确认 · 消耗这瓶魔药"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "解密学者服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 40", resources.cash, "3", "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶解密学者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "cryptologist-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops stale confirmation when its bottle action disappears or promotion is committed", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<CryptologistPanel cryptologist={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<CryptologistPanel cryptologist={{ ...value, promoted: true }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows only one of three cases and never invents observations or outcomes", async () => {
    const list = cases();
    list[1]!.observations = ["当事人已说明紧张的原因，旁人仍在场。"];
    const { onCommand } = panel(cryptologist({ promoted: true, cases: list, actions: list.map((scene) => action({ type: "OBSERVE", caseId: scene.id })) }));
    expect(screen.getAllByRole("region", { name: "当前解密情境" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开操作OBSERVE/ })).toHaveLength(1);
    expect(screen.queryByText(list[1]!.observations[0]!)).toBeNull();
    expect(screen.queryByRole("region", { name: "实际解密与核查结果" })).toBeNull();
    for (const [index, scene] of list.entries()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择解密情境" }), scene.id);
      expect(screen.getByText(`原记录的公开说明${index + 1}`)).toBeTruthy();
      expect(screen.getAllByRole("button", { name: /^公开操作OBSERVE/ })).toHaveLength(1);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(caseIds)("forwards observe, preparation, both methods and withdrawal for %s", async (caseId) => {
    const list = cases();
    const commands: CryptologistCommand[] = [
      { type: "OBSERVE", caseId }, { type: "PREPARE", caseId, method: "DECRYPT" }, { type: "PREPARE", caseId, method: "PLAIN" },
      { type: "PERFORM", caseId }, { type: "REPORT", caseId, conclusion: "LIMITED" }, { type: "REPORT", caseId, conclusion: "CERTAIN" }, { type: "WITHDRAW", caseId },
    ];
    const value = cryptologist({ promoted: true, cases: list, actions: commands.map((command) => action(command)) });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择解密情境" }), caseId);
    for (const command of commands) {
      const current = action(command);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("region", { name: "实际解密与核查结果" })).toBeNull();
    }
    const observed = list.map((scene) => scene.id === caseId ? { ...scene, status: "PREPARED", observations: ["原记录已出示，核查范围已说明。"] } : scene);
    rerender(<CryptologistPanel cryptologist={{ ...value, cases: observed }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("原记录已出示，核查范围已说明。")).toBeTruthy();
    expect(screen.getByText("实践状态：已选定方法并完成准备")).toBeTruthy();
    const finished = observed.map((scene) => scene.id === caseId ? { ...scene, status: "RESOLVED", result: "实际结算：原台账顺序已还原，未推断未知身份。" } : scene);
    rerender(<CryptologistPanel cryptologist={{ ...value, cases: finished, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际解密与核查结果" }).textContent).toContain("实际结算：原台账顺序已还原，未推断未知身份。");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["OBSERVED", "PREPARED"])("defaults to the active %s case and allows backend-approved zero-AP withdrawal at incapacity", async (status) => {
    const list = cases();
    list[1]!.status = status;
    const withdraw = { ...action({ type: "WITHDRAW", caseId: "stage-corridor" }), cost: "0行动 · 停止本次实践" };
    const value = cryptologist({ promoted: true, cases: list, actions: [action({ type: "OBSERVE", caseId: "ledger-sequence" }), withdraw] });
    const onCommand = vi.fn();
    render(<CryptologistPanel cryptologist={value} resources={{ ...resources, health: 0, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择解密情境" }) as HTMLSelectElement).value).toBe("stage-corridor");
    expect(screen.getByText(withdraw.cost)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作WITHDRAW/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
  });

  it("obeys backend disabled reasons, save locks and blocking errors without inferring permission from AP", () => {
    const list = cases();
    list[0]!.status = "OBSERVED";
    const value = cryptologist({ promoted: true, cases: list, actions: [action({ type: "PREPARE", caseId: "ledger-sequence", method: "DECRYPT" }, false), action({ type: "WITHDRAW", caseId: "ledger-sequence" })] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^公开操作PREPARE/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("领域原因：本周已尝试，请下周再来。").length).toBeGreaterThan(0);
    for (const lock of [{ busy: true, blocked: false }, { busy: false, blocked: true }]) {
      rerender(<CryptologistPanel cryptologist={value} resources={resources} {...lock} onCommand={onCommand} />);
      const withdraw = screen.getByRole("button", { name: /^公开操作WITHDRAW/ });
      expect((withdraw as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole("combobox", { name: "选择解密情境" }) as HTMLSelectElement).disabled).toBe(true);
      fireEvent.click(withdraw);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("prioritizes an examined case and keeps its submitted report selected after commit", async () => {
    const list = cases();
    list[1] = { ...list[1]!, status: "EXAMINED", preparation: "镜面与普通走道已经核对，已实际执行解密。", result: "普通镜面形成错廊外观，尚未提交有限报告。" };
    const disclose = action({ type: "REPORT", caseId: "stage-corridor", conclusion: "LIMITED" });
    const value = cryptologist({ promoted: true, acting: 0, cases: list, actions: [action({ type: "OBSERVE", caseId: "ledger-sequence" }), disclose] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox", { name: "选择解密情境" }) as HTMLSelectElement).value).toBe("stage-corridor");
    expect(screen.getByRole("region", { name: "实际方法与准备" }).textContent).toContain("镜面与普通走道已经核对");
    expect(screen.getByText(/尚未完成报告与奖励结算/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${disclose.label}`) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(disclose.command);
    expect(screen.getByText(/实践状态：已实际核查，等待提交报告/)).toBeTruthy();
    expect(screen.getByText(/扮演进度 0/)).toBeTruthy();
    const resolved = list.map((scene) => scene.id === "stage-corridor" ? { ...scene, status: "RESOLVED", result: "原镜面与普通走道已核实；本次有限报告已提交。" } : scene);
    rerender(<CryptologistPanel cryptologist={{ ...value, acting: 30, cases: resolved, actions: [action({ type: "OBSERVE", caseId: "ledger-sequence" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择解密情境" }) as HTMLSelectElement).value).toBe("stage-corridor");
    expect(screen.getByRole("region", { name: "实际解密与核查结果" }).textContent).toContain("原镜面与普通走道已核实");
    expect(screen.getByText(/扮演进度 30/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows one new ability, four inherited abilities and simple completed progress without invented actions", () => {
    const abilities = [
      { id: "error.s9.agility", label: "原敏捷", mastery: 11, description: "原敏捷说明" },
      { id: "error.s9.dexterity", label: "原灵巧", mastery: 12, description: "原灵巧说明" },
      { id: "error.s9.theft", label: "原偷取", mastery: 13, description: "原物接触边界" },
      { id: "error.s8.deceit", label: "原骗术", mastery: 14, description: "有限误导边界" },
      { id: "error.s7.decryption", label: "解密", mastery: 17, description: "实际公开能力说明" },
    ];
    panel(cryptologist({ promoted: true, cases: cases(), actions: [], acting: 100, abilities }));
    const ability = screen.getByRole("region", { name: "解密学者能力与消化" });
    for (const text of ["同一项解密能力", "当前情境允许解出的完整谜题", "未定义答案", "未知身份", "高位秘密", "具体场景与数值以当前说明为准", "不提前开放能力偷取"]) expect(ability.textContent).toContain(text);
    expect(within(ability).getByRole("heading", { name: "能力与消化 · 5 项能力" })).toBeTruthy();
    for (const entry of abilities) expect(within(ability).getByText(`${entry.label} · 掌握 ${entry.mastery}`)).toBeTruthy();
    expect((screen.getByRole("progressbar", { name: "解密学者扮演进度" }) as HTMLProgressElement).value).toBe(100);
    expect(screen.getByRole("region", { name: "已知实践环境" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "解密学者成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("retains an unknown rubbing warning and forwards the exact chosen conclusion without inventing its answer", async () => {
    const list = cases();
    list[2] = { ...list[2]!, status: "EXAMINED", observations: ["拓印的深层符号可能带来未知危险；目前不能确认来源。"], preparation: "仅在已有标记范围内核查，未越界解读。", result: "察觉不协调，已停在已知边界；深层内容仍未知。" };
    const report = action({ type: "REPORT", caseId: "marked-rubbing", conclusion: "LIMITED" });
    const { onCommand } = panel(cryptologist({ promoted: true, cases: list, actions: [report] }));
    expect(screen.getByRole("region", { name: "已取得的现场观察" }).textContent).toContain("未知危险");
    expect(screen.getByRole("region", { name: "实际解密与核查结果" }).textContent).toContain("深层内容仍未知");
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${report.label}`) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(report.command);
    expect(screen.getByRole("region", { name: "实际解密与核查结果" }).textContent).toContain("深层内容仍未知");
    expect(screen.getByText(/扮演进度 0/)).toBeTruthy();
  });

  it("forwards an inherited original-tool return only when the public projection offers it", async () => {
    const returning = { ...action({ type: "RETURN_TOOL" }), cost: "0行动 · 交回同一原短棍" };
    const { onCommand, rerender } = panel(cryptologist({ promoted: true, actions: [returning] }));
    await userEvent.click(screen.getByRole("button", { name: /^公开操作RETURN_TOOL/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_TOOL" });
    rerender(<CryptologistPanel cryptologist={cryptologist({ promoted: true, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /^公开操作RETURN_TOOL/ })).toBeNull();
  });

  it("forwards reflection only when supplied and enabled by the backend", async () => {
    const reflection = action({ type: "REFLECT" });
    const value = cryptologist({ promoted: true, cases: cases(), actions: [reflection] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^公开操作REFLECT/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
    rerender(<CryptologistPanel cryptologist={{ ...value, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /^公开操作REFLECT/ })).toBeNull();
  });

  it("opens error seven by default and retains original S9 ownership and dispute history read-only", async () => {
    const state = fixture();
    state.marauder.cases = [{ id: "old-case", title: "旧原信记录", story: "旧原信未改写", observations: ["原观察保留"], preparation: "原准备保留", result: "原报告保留", status: "RESOLVED" }];
    state.marauder.originals = [{ id: "old-letter", label: "旧原信", owner: "原主人安娜", custodian: "登记员保管", location: "原登记柜", sealed: true, version: 3 }];
    state.marauder.dispute = { stage: "RESOLVED", title: "原短棍争端", description: "旧争端事实", weapon: { id: "old-stick", owner: "原主人沃德", custodian: "登记柜保管", location: "原维修院", version: 4 }, attention: 2, outcome: "原对手已投降，尚未领回" };
    state.marauder.bottles = [{ id: "marauder-original", title: "旧偷盗者原瓶", source: "原渠道保留", status: "已耗用", chance: 50, command: { type: "CONSUME", bottleId: "marauder-original", confirmed: true } }];
    state.marauder.abilities = [{ id: "error.s9.dexterous", label: "原灵巧", mastery: 23, description: "原能力说明" }];
    state.marauder.actions = [{ id: "stale-return", label: "不可重做的原物交还", cost: "0行动", enabled: true, reason: null, command: { type: "RETURN_TOOL" } }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`解密学者 · 序列7 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "解密学者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "偷盗者成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "偷盗者经历" }));
    const history = screen.getByRole("region", { name: "偷盗者时期的经历" });
    for (const text of ["旧原信未改写", "原观察保留", "原报告保留", "原渠道保留", "原灵巧", "23", "原主人安娜", "登记员保管", "原主人沃德", "尚未领回"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重做的原物交还")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "解密学者成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps Swindler original observations, methods, report and bottles read-only after S7", async () => {
    const state = fixture();
    state.swindler.cases = [{ id: "old-s8", title: "旧告示骗局", story: "旧公开事实保留", observations: ["旧观察不变"], preparation: "实际采用普通核对", result: "当面出示原告示并澄清", status: "RESOLVED" }];
    state.swindler.bottles = [{ id: "old-s8-potion", title: "旧诈骗师原瓶", source: "旧S8渠道保留", status: "已耗用 · 成功", chance: 55, command: { type: "CONSUME", bottleId: "old-s8-potion", confirmed: true } }];
    state.swindler.abilities = [{ id: "error.s8.deceit", label: "原骗术", mastery: 37, description: "原有限骗术说明" }];
    state.swindler.actions = [{ id: "stale-s8", label: "不可重做的旧澄清", cost: "0行动", enabled: true, reason: null, command: { type: "DISCLOSE", caseId: "old-s8" } }];
    const value = bridge(state);
    await enter(value);
    await openCryptologist();
    await userEvent.click(screen.getByRole("button", { name: "诈骗师经历" }));
    const history = screen.getByRole("region", { name: "诈骗师时期的经历" });
    for (const text of ["已晋升解密学者", "旧公开事实保留", "旧观察不变", "实际采用普通核对", "当面出示原告示并澄清", "旧S8渠道保留", "已耗用 · 成功", "原骗术", "37"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重做的旧澄清")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "解密学者成长" }));
    expect(screen.getByRole("region", { name: "解密学者成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("does not expose S7 preparation to an S9 character even when stale S7 data exists", async () => {
    await enter(bridge(fixture(9)));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "偷盗者成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "诈骗师晋升" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /解密学者/ })).toBeNull();
  });

  it("ignores stale S8 formula and action fields in a standalone history record", () => {
    const state = fixture();
    state.swindler.formula = [{ name: "未核S8配方不得显示", quantity: 1, unit: "份" }];
    state.swindler.actions = [{ id: "stale-s8", label: "不可重做的旧澄清", cost: "0行动", enabled: true, reason: null, command: { type: "DISCLOSE", caseId: "old-s8" } }];
    render(<SwindlerHistory swindler={state.swindler} />);
    expect(screen.queryByText("未核S8配方不得显示")).toBeNull();
    expect(screen.queryByText("不可重做的旧澄清")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("never renders stale S9 commands or mutation handlers in other-route history", () => {
    const state = fixture();
    state.marauder.actions = [{ id: "old-consume", label: "不可重服原瓶", cost: "0行动", enabled: true, reason: null, command: { type: "CONSUME", bottleId: "old-original", confirmed: true } }];
    render(<MarauderHistory marauder={state.marauder} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重服原瓶")).toBeNull();
    expect(screen.getByText(/已选择其它途径/)).toBeTruthy();
  });

  it.each([
    ["diviner", "魔术师成长下一步"], ["hunter", "纵火家成长下一步"],
    ["audience", "心理医生成长下一步"], ["paragon", "鉴定师成长下一步"], ["moon", "吸血鬼成长下一步"],
  ] as const)("preserves the %s S7 default and does not expose Cryptologist", async (pathwayId, heading) => {
    const state = fixture(8, { progression: { pathwayId, sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "解密学者成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /解密学者成长|解密学者晋升/ })).toBeNull();
  });

  it.each(["CONSUME", "PREPARE", "PERFORM", "REPORT", "WITHDRAW"] as const)("retries the identical failed %s envelope without a duplicate action", async (type) => {
    const consuming = type === "CONSUME";
    const cmd: CryptologistCommand = consuming ? { type: "CONSUME", bottleId: "cryptologist-potion-2", confirmed: true }
      : type === "PREPARE" ? { type, caseId: "ledger-sequence", method: "DECRYPT" }
        : type === "REPORT" ? { type, caseId: "ledger-sequence", conclusion: "LIMITED" } : { type, caseId: "ledger-sequence" };
    const list = cases();
    list[0]!.status = type === "REPORT" ? "EXAMINED" : type === "PERFORM" ? "PREPARED" : "OBSERVED";
    const state = fixture(consuming ? 8 : 7, {
      cryptologist: consuming ? bottled() : cryptologist({ promoted: true, cases: list, actions: [action(cmd)] }),
      actionsRemaining: 0, canAct: false, health: type === "WITHDRAW" ? 0 : 76,
      mind: type === "WITHDRAW" ? 0 : 88, actionBlockedReason: "领域当前不可进行主要行动。",
    });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openCryptologist();
    if (consuming) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶解密学者魔药」/ }));
    const name = consuming ? "确认服用「第二瓶解密学者魔药」" : new RegExp(`^${action(cmd).label}`);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "解密学者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("解密学者模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "CRYPTOLOGIST", command: cmd });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
