/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { SECRET_SUPPLICANT_ABILITIES, SECRET_SUPPLICANT_CONSUMPTION_RISK } from "../../src/domain/secret-supplicant/content";
import type { SecretSupplicantAction, SecretSupplicantCommand, SecretSupplicantProjection } from "../../src/domain/secret-supplicant/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SecretSupplicantHistory, SecretSupplicantPanel } from "../../src/renderer/SecretSupplicantPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: SecretSupplicantCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): SecretSupplicantAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const discover = action({ type: "DISCOVER" }, "拜访旧物管理员伊森·洛弗");
function secretSupplicant(patch: Partial<SecretSupplicantProjection> = {}): SecretSupplicantProjection {
  return {
    title: "秘祈人之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3,
    risk: SECRET_SUPPLICANT_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): SecretSupplicantProjection {
  return secretSupplicant({
    discovered: true, guidanceKnown: true,
    supplies: "三瓶独立成品，原价660便士；两次实际劳动后60便士，指导120便士。供应方剩余1瓶，持有未服原瓶2瓶。",
    actions: ["secret-supplicant-potion-1", "secret-supplicant-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "secret-supplicant-potion-1", title: "第一瓶秘祈人魔药", source: "伊森·洛弗独立留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "secret-supplicant-potion-1", confirmed: true } },
      { id: "secret-supplicant-potion-2", title: "第二瓶秘祈人魔药", source: "伊森·洛弗独立留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "secret-supplicant-potion-2", confirmed: true } },
      { id: "secret-supplicant-potion-3", title: "第三瓶秘祈人魔药", source: "伊森·洛弗独立留存的第三原瓶", status: "指导者保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "secret-supplicant-potion-3", confirmed: true } },
    ],
  });
}
function cases(): SecretSupplicantProjection["cases"] {
  return [
    { id: "ritual-ledger", title: "旧账上的残缺记录", story: "原目录缺了一行，不能补成已经证实的来历。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "没有尚待结束的主动接触", overclaims: 0 },
    { id: "empty-bowl", title: "没有答复的空碗", story: "原碗本次仍无回应，准备不代表一定得到答复。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "没有尚待结束的主动接触", overclaims: 0 },
    { id: "covered-token", title: "罩下旧物的有限迹象", story: "感知到有限迹象，仍不能确定未知存在的身份与意图。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "没有尚待结束的主动接触", overclaims: 0 },
  ];
}
function contact(failed = false): SecretSupplicantProjection {
  return secretSupplicant({ promoted: true, discovered: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "covered-token" ? {
      ...entry, status: failed ? "OBSERVED" : "EXAMINED", contactOpen: "原罩仍揭开：先实际盖回",
      result: failed ? "此前未成，不能补出未知信息。" : "片段已记录，来源仍未核实。",
    } : entry),
    actions: [action({ type: "COVER", caseId: "covered-token" }, "盖回原罩，结束这次接触", true, "0行动 · 不抹掉未知风险")],
  });
}
function panel(value: SecretSupplicantProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SecretSupplicantPanel secretSupplicant={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("secretSupplicant-renderer-run", sliceDefaultCreationSelection, "secretSupplicant-renderer-seed");
raw.week = 6; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    secretSupplicant: secretSupplicant({
      discovered: promoted, guidanceKnown: promoted, promoted, title: promoted ? "秘祈人 · 序列9" : "秘祈人之路",
      actions: promoted ? [] : [discover], abilities: promoted ? SECRET_SUPPLICANT_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: promoted ? "hanged-man" : null, sequence: promoted ? 9 : null, mastery: {}, acting: 0, promotionWeek: promoted ? 5 : null },
    ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:01:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-12T00:02:00Z", replayed: false, state } };
}
async function enter(api: SliceBridge) {
  window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
async function openSecretSupplicant() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^秘祈人(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("SecretSupplicant sequence-nine public knowledge dossier", () => {
  it("keeps sixteen routes in the explicit chooser and remembers the ordinary selection", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.queryByRole("button", { name: "秘祈人之路" })).toBeNull();
    expect(screen.queryByRole("group", { name: "选择成长卷宗" })).toBeNull();
    await openSecretSupplicant();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "秘祈人之路" }).textContent).toContain("有限神秘感知");
    expect(screen.getByRole("region", { name: "秘祈人成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /倾听者|肉瘤|血肉操控|放牧/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "秘祈人成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("selects the promoted route from the dashboard task button and shows only bounded S9 records", async () => {
    await enter(bridge(fixture(true)));
    expect(screen.getByText("秘祈人 · 序列9 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看秘祈人成长" }));
    const abilities = screen.getByRole("region", { name: "秘祈人能力与消化" });
    expect(abilities.textContent).toContain("3 项训练记录");
    for (const ability of SECRET_SUPPLICANT_ABILITIES) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /直接耳语|肉瘤|血肉操控|放牧/ })).toBeNull();
  });

  it("preserves independent bottle sources and supply terms without displaying an unverified recipe", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "不应显示的未核材料", quantity: 1, unit: "份" }] });
    expect(new Set(value.bottles.map((bottle) => bottle.id)).size).toBe(3);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "秘祈人成品渠道与配方边界" }).textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(screen.getByRole("region", { name: "秘祈人成品渠道与配方边界" }).textContent).toContain("独立成品原瓶，不提供调配");
    expect(screen.getByRole("region", { name: "秘祈人成品渠道与配方边界" }).textContent).not.toContain("完整配方尚未核实");
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("不应显示的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("opens and cancels at zero AP, restores focus and confirms the exact second original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶秘祈人魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("secret-supplicant-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "秘祈人服用风险与四档结果" }).textContent).toContain(SECRET_SUPPLICANT_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶秘祈人魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "secret-supplicant-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "readOnly"] as const)("invalidates an open confirmation when %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<SecretSupplicantPanel secretSupplicant={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public eligibility rather than deriving readiness from visible resources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "需要度过四个完整普通周，第5周起可以服药。";
    rerender(<SecretSupplicantPanel secretSupplicant={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶秘祈人魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy();
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not invent knowledge or switch the chosen case when public actions change", async () => {
    const value = secretSupplicant({ promoted: true, cases: cases(), actions: [] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "empty-bowl");
    rerender(<SecretSupplicantPanel secretSupplicant={{ ...value, actions: [action({ type: "OBSERVE", caseId: "ritual-ledger" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("empty-bowl");
    expect(screen.getByRole("region", { name: "当前秘祈人实践" }).textContent).toContain("原碗本次仍无回应");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("dispatches the two exact preparation methods without optimistic knowledge or preparation", async () => {
    const choices = [action({ type: "PREPARE", caseId: "empty-bowl", method: "MYSTIC" }, "准备有限仪式"), action({ type: "PREPARE", caseId: "empty-bowl", method: "ORDINARY" }, "准备普通核对")];
    const { onCommand } = panel(secretSupplicant({ promoted: true, cases: cases(), actions: choices }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "empty-bowl");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("当前没有待执行的准备记录");
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
  });

  it("passes LIMITED and CERTAIN report claims unchanged and preserves a later correction with its wrong-history count", async () => {
    const limited = action({ type: "REPORT", caseId: "ritual-ledger", claim: "LIMITED" }, "记录有限事实，保留未知");
    const complete = action({ type: "REPORT", caseId: "ritual-ledger", claim: "CERTAIN" }, "声称已经完全证明");
    const value = secretSupplicant({ promoted: true, cases: cases().map((entry) => entry.id === "ritual-ledger" ? { ...entry, status: "EXAMINED", result: "缺行仍然缺失。" } : entry), actions: [limited, complete] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^声称已经完全证明/ }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /^声称已经完全证明/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(complete.command);
    expect(screen.getByText("过度断言记录：0")).toBeTruthy();
    const wrong = { ...value, cases: value.cases.map((entry) => entry.id === "ritual-ledger" ? { ...entry, overclaims: 1 } : entry), actions: [{ ...limited, label: "更正为有限结论，保留未知" }, complete] };
    rerender(<SecretSupplicantPanel secretSupplicant={wrong} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("过度断言记录：1")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^更正为有限结论/ }));
    expect(onCommand.mock.calls[1]![0]).toEqual(limited.command);
    rerender(<SecretSupplicantPanel secretSupplicant={{ ...wrong, actions: [], acting: 20, cases: wrong.cases.map((entry) => entry.id === "ritual-ledger" ? { ...entry, status: "RESOLVED", result: "已更正为有限事实，原错误记录仍保留。" } : entry) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("过度断言记录：1")).toBeTruthy();
    expect(screen.getByRole("region", { name: "实际执行与报告记录" }).textContent).toContain("原错误记录仍保留");
  });

  it.each([false, true])("forces the actual open contact after a failed check=%s, with zero-resource COVER", async (failed) => {
    const { onCommand, rerender } = panel(secretSupplicant({ promoted: true, cases: cases() }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "empty-bowl");
    const value = contact(failed);
    rerender(<SecretSupplicantPanel secretSupplicant={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("covered-token"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("本次接触：原罩仍揭开：先实际盖回")).toBeTruthy();
    expect(screen.getByRole("region", { name: "秘祈人成长下一步" }).textContent).toContain("不能保证免受神秘影响");
    const close = screen.getByRole("button", { name: /^盖回原罩/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "COVER", caseId: "covered-token" });
    expect(screen.getByText("本次接触：原罩仍揭开：先实际盖回")).toBeTruthy();
    rerender(<SecretSupplicantPanel secretSupplicant={{ ...value, insideCase: false, actions: [], cases: value.cases.map((entry) => ({ ...entry, contactOpen: "没有尚待结束的主动接触" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(selector.value).toBe("covered-token"); expect(selector.disabled).toBe(false);
    expect(screen.getByText("本次接触：没有尚待结束的主动接触")).toBeTruthy();
  });

  it("uses public localized contact text verbatim, including an unfamiliar label", () => {
    const list = cases(); list[0] = { ...list[0]!, contactOpen: "原物已盖回，等待管理员核对", overclaims: 2 };
    panel(secretSupplicant({ promoted: true, cases: list, actions: [] }));
    expect(screen.getByText("本次接触：原物已盖回，等待管理员核对")).toBeTruthy();
    expect(screen.getByText("过度断言记录：2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /盖罩/ })).toBeNull();
  });

  it("shows only selected case actions and authoritative blocked reasons", async () => {
    const entries = [action({ type: "OBSERVE", caseId: "ritual-ledger" }, "观察原账册"), action({ type: "PREPARE", caseId: "empty-bowl", method: "MYSTIC" }, "准备有限感知", false)];
    entries[1]!.reason = "先核对当前旧物与现场。";
    const { onCommand } = panel(secretSupplicant({ promoted: true, cases: cases(), actions: entries }));
    expect(screen.getByRole("button", { name: /^观察原账册/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^准备有限感知/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "empty-bowl");
    const button = screen.getByRole("button", { name: /^准备有限感知/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(/先核对当前旧物与现场/).length).toBeGreaterThan(0);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the discovered channel read-only after choosing another route", async () => {
    const state = fixture(false, { secretSupplicant: bottled(), progression: { pathwayId: "diviner", sequence: 9, mastery: {}, acting: 0, promotionWeek: 5 } });
    const api = bridge(state); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "秘祈人经历" }));
    const history = within(screen.getByRole("region", { name: "秘祈人渠道经历" }));
    expect(history.queryByRole("button")).toBeNull();
    expect(history.getByText("来源：伊森·洛弗独立留存的第一原瓶")).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains public contact, incorrect claims and sources in callback-free history", () => {
    render(<SecretSupplicantHistory secretSupplicant={{ ...bottled(), cases: cases().map((entry) => ({ ...entry, overclaims: 1, result: "原错误报告仍保留。" })) }} />);
    expect(screen.getAllByText("原错误报告仍保留。")).toHaveLength(3);
    expect(screen.getAllByText(/过度断言记录：1/)).toHaveLength(3);
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("combobox")).toBeNull();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "COVER", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the exact failed %s envelope without optimistic facts", async (type) => {
    const isLife = !["CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: SecretSupplicantCommand = type === "CONSUME" ? { type, bottleId: "secret-supplicant-potion-2", confirmed: true }
      : type === "REFLECT" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "ritual-ledger", method: "MYSTIC" }
      : type === "REPORT" ? { type, caseId: "ritual-ledger", claim: "CERTAIN" }
      : { type, caseId: "ritual-ledger" };
    const entry = action(command, "执行这次公开行动");
    const zeroAP = ["CONSUME", "WITHDRAW", "RECEIVE_SUPPLY", "COVER"].includes(type);
    const state = fixture(isLife, { secretSupplicant: type === "CONSUME" ? bottled() : secretSupplicant({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, secretSupplicant: { ...state.secretSupplicant, actions: [], bottles: state.secretSupplicant.bottles.map((bottle) => ({ ...bottle, status: "实际消费已记录" })) } }, envelope));
    api.submitIntent = submit; await enter(api); await openSecretSupplicant();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶秘祈人魔药」" : /^执行这次公开行动/;
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "秘祈人模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("秘祈人模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "SECRET_SUPPLICANT", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([false, true])("reloads the actual open contact at zero AP and mind after failed check=%s", async (failed) => {
    const state = fixture(true, { secretSupplicant: contact(failed), seer: { ...base.seer, discovered: true }, mind: 0, spirituality: 0, actionsRemaining: 0, canAct: false });
    const api = bridge(state); await enter(api);
    await screen.findByRole("region", { name: "秘祈人成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先盖回原罩");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect((screen.getByRole("button", { name: /^盖回原罩/ }) as HTMLButtonElement).disabled).toBe(false);
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains an open contact on failed save, retries that exact COVER and unlocks only after the receipt", async () => {
    const state = fixture(true, { secretSupplicant: contact(true), actionsRemaining: 0, mind: 0, spirituality: 0 });
    const next: SliceProjection = { ...state, revision: state.revision + 1, secretSupplicant: { ...contact(true), insideCase: false,
      actions: [], cases: contact(true).cases.map((entry) => ({ ...entry, contactOpen: "没有尚待结束的主动接触" })),
    } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "盖罩尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "秘祈人成长下一步" });
    await userEvent.click(screen.getByRole("button", { name: /^盖回原罩/ }));
    expect(screen.getByRole("alert").textContent).toContain("盖罩尚未保存");
    expect(screen.getByText("本次接触：原罩仍揭开：先实际盖回")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^盖回原罩/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "SECRET_SUPPLICANT", command: { type: "COVER", caseId: "covered-token" } });
    expect(screen.getByText("本次接触：没有尚待结束的主动接触")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("covered-token");
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it.each(["RETURN", "SETTLE", "CLOSE", "STOP", "END"] as const)("preserves the older %s safety exit ahead of a simultaneous SecretSupplicant contact", async (exit) => {
    const state = fixture(true, {
      secretSupplicant: contact(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false,
      progression: { pathwayId: exit === "RETURN" || exit === "SETTLE" ? "demoness" : "hermit", sequence: exit === "RETURN" || exit === "CLOSE" ? 9 : exit === "END" ? 7 : 8, mastery: {}, acting: 0, promotionWeek: 5 },
    });
    if (exit === "RETURN") state.assassin = { ...state.assassin, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "upper-draft", title: "上层原平台", story: "本人仍在原平台。", status: "EXAMINED", position: "上层平台", observations: [], preparation: null, result: "必须实际返回。" }],
      actions: [{ id: "legacy-return", label: "旧实践的普通楼梯返回", cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } }],
    };
    else if (exit === "SETTLE") state.instigator = { ...state.instigator, promoted: true, insideCase: true,
      cases: [{ id: "queue-grievance", title: "旧争执现场", story: "争执仍在升温。", status: "EXAMINED", tension: "仍在激化", observations: [], preparation: null, result: "必须实际停止挑动。" }],
      actions: [{ id: "legacy-settle", label: "旧实践的停止挑动", cost: "0行动", enabled: true, reason: null, command: { type: "SETTLE", caseId: "queue-grievance" } }],
    };
    else if (exit === "CLOSE") state.pryer = { ...state.pryer, discovered: true, promoted: true, insideCase: true,
      cases: [{ id: "intrusive-page", title: "旧原页", story: "原页仍打开。", status: "OBSERVED", readingOpen: "尚未合页", overclaims: 0, observations: [], preparation: null, result: "必须实际合页。" }],
      actions: [{ id: "legacy-close", label: "旧实践的实际合页", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "intrusive-page" } }],
    };
    else if (exit === "STOP") state.combatScholar = { ...state.combatScholar, promoted: true, insideCase: true,
      cases: [{ id: "halted-exercise", title: "旧演练现场", story: "演练仍未结束。", status: "OBSERVED", exerciseOpen: "仍未停止", observations: [], preparation: null, result: "必须实际停止演练。" }],
      actions: [{ id: "legacy-stop", label: "旧实践的实际停止", cost: "0行动", enabled: true, reason: null, command: { type: "STOP", caseId: "halted-exercise" } }],
    };
    else state.wizard = { ...state.wizard, promoted: true, insideCase: true,
      cases: [{ id: "veiled-tag", title: "旧法术现场", story: "本次效果仍未结束。", status: "OBSERVED", effectOpen: "仍未结束", observations: [], preparation: null, result: "必须实际结束效果。" }],
      actions: [{ id: "legacy-end", label: "旧实践的实际结束", cost: "0行动", enabled: true, reason: null, command: { type: "END", caseId: "veiled-tag" } }],
    };
    const api = bridge(state);
    api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const label = exit === "RETURN" ? "旧实践的普通楼梯返回" : exit === "SETTLE" ? "旧实践的停止挑动" : exit === "CLOSE" ? "旧实践的实际合页" : exit === "STOP" ? "旧实践的实际停止" : "旧实践的实际结束";
    const button = await screen.findByRole("button", { name: new RegExp(`^${label}`) });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "秘祈人成长下一步" })).toBeNull();
    await userEvent.click(button);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual(exit === "RETURN"
      ? { type: "ASSASSIN", command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } }
      : exit === "SETTLE" ? { type: "INSTIGATOR", command: { type: "SETTLE", caseId: "queue-grievance" } }
      : exit === "CLOSE" ? { type: "PRYER", command: { type: "CLOSE", caseId: "intrusive-page" } }
      : exit === "STOP" ? { type: "COMBAT_SCHOLAR", command: { type: "STOP", caseId: "halted-exercise" } }
      : { type: "WIZARD", command: { type: "END", caseId: "veiled-tag" } });
  });

  it("only offers COVER while public contact is open, even alongside stale non-exit actions", () => {
    const value = contact(true);
    panel({ ...value, actions: [...value.actions,
      action({ type: "REPORT", caseId: "covered-token", claim: "LIMITED" }, "不能提前报告"),
      action({ type: "WITHDRAW", caseId: "covered-token" }, "不能撤回替代盖罩"),
      action({ type: "REFLECT" }, "不能提前反思"),
    ] });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^盖回原罩/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /不能/ })).toBeNull();
  });

  it("does not infer an open contact from localized prose or EXAMINED status", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "EXAMINED", contactOpen: "原罩尚未盖回：这里只是历史文字" };
    const api = bridge(fixture(true, { secretSupplicant: secretSupplicant({ promoted: true, cases: list, actions: [] }), actionsRemaining: 1 }));
    await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openSecretSupplicant();
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /^盖回原罩/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps a consumed failed bottle gone and opens a different original with updated resources", async () => {
    const state = fixture(false, { secretSupplicant: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      secretSupplicant: { ...state.secretSupplicant,
        bottles: state.secretSupplicant.bottles.map((bottle) => bottle.id === "secret-supplicant-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle),
        actions: state.secretSupplicant.actions.slice(1),
      } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(api); await openSecretSupplicant();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶秘祈人魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("secret-supplicant-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });

});
