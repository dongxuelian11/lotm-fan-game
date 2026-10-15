/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { LIGHTPRAYER_ABILITIES, LIGHTPRAYER_CONSUMPTION_RISK } from "../../src/domain/lightprayer/content";
import { BARD_ABILITIES } from "../../src/domain/bard/content";
import type { LightprayerAction, LightprayerCommand, LightprayerProjection } from "../../src/domain/lightprayer/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { BardHistory, LightprayerPanel } from "../../src/renderer/LightprayerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const guidance: LightprayerAction = {
  id: "guidance", label: "学习祈光人服用指导", cost: "1行动 · 180便士", enabled: true,
  reason: null, command: { type: "LEARN_GUIDANCE" },
};
const risk = LIGHTPRAYER_CONSUMPTION_RISK;
function lightprayer(patch: Partial<LightprayerProjection> = {}): LightprayerProjection {
  return {
    title: "祈光人晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "歌颂者扮演100，已度过4/4个完整序列9周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): LightprayerProjection {
  return lightprayer({
    guidanceKnown: true,
    supplies: "完整配方待核；新渠道三瓶独立成品，1210便士或完成3次劳动抵1050便士后付160便士；指导180便士。",
    actions: ["lightprayer-potion-1", "lightprayer-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "lightprayer-potion-1", title: "第一瓶祈光人魔药", source: "灯具库房交接的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "lightprayer-potion-1", confirmed: true } },
      { id: "lightprayer-potion-2", title: "第二瓶祈光人魔药", source: "灯具库房交接的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "lightprayer-potion-2", confirmed: true } },
      { id: "lightprayer-potion-3", title: "第三瓶祈光人魔药", source: "灯具库房交接的第三原瓶", status: "导师保管 · 劳动0/3", chance: 43, command: { type: "CONSUME", bottleId: "lightprayer-potion-3", confirmed: true } },
    ],
  });
}
function cases(): LightprayerProjection["cases"] {
  return ["shaded-label", "wick-lighting", "storehouse-echo"].map((id, index) => ({
    id, title: `祈光实践${index + 1}`, story: `原现场对象与范围${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE",
  }));
}
function action(command: LightprayerCommand, label = "观察本处现场", enabled = true): LightprayerAction {
  return {
    id: JSON.stringify(command), label, cost: "1行动 · 本案公开成本", enabled,
    reason: enabled ? null : "本周已尝试，须下周再来。", command,
  };
}
function panel(value: LightprayerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<LightprayerPanel lightprayer={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 = 9, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("lightprayer-renderer-run", sliceDefaultCreationSelection, "lightprayer-renderer-seed");
  raw.week = 20;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    bard: { ...state.bard, discovered: sequence !== null, promoted: sequence !== null, title: "歌颂者 · 序列9", acting: 100, actions: [] },
    lightprayer: lightprayer({
      promoted: sequence === 8, title: sequence === 8 ? "祈光人 · 序列8" : "祈光人晋升",
      actions: sequence === 8 ? [] : [guidance],
    }),
    progression: {
      pathwayId: sequence === null ? null : "sun", sequence,
      mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: sequence === null ? null : 5,
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
async function openLightprayer() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^祈光人(?:晋升|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Lightprayer sequence eight dossier", () => {
  it("keeps exactly eleven ordinary starting routes and hides S8", async () => {
    const api = bridge(fixture(null));
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "歌颂者之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /祈光人/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps Bard as S9 default and opens S8 preparation by tab and dashboard", async () => {
    const api = bridge(fixture(9));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列8晋升");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "歌颂者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "祈光人晋升" }));
    const summary = screen.getByRole("region", { name: "祈光人成长下一步" });
    expect(summary.textContent).toContain("歌颂者100消化与四个完整序列9周");
    expect(summary.textContent).toContain("意志难度12");
    expect(summary.textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(summary.textContent).not.toContain("游戏设定（G）");
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "祈光人成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens Sun S8 Lightprayer and preserves Bard as callback-free history", async () => {
    const state = fixture(8);
    state.seer.discovered = true;
    state.bard.cases = [{ id: "troubled-carrier", title: "旧短歌协助", story: "原当事人的拒歌意愿", observations: ["当事人原本要求普通交谈"], preparation: "原本只约定普通谈话", result: "当事人实际恢复了工作节奏", status: "RESOLVED" }];
    state.bard.actions = [{ id: "stale-bard", label: "不得重做的旧歌颂者协助", cost: "1行动", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "troubled-carrier" } }];
    const api = bridge(state);
    await enter(api);
    expect(screen.getByText(new RegExp(`祈光人 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("祈光人 · 序列8 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await openLightprayer();
    expect(screen.getByRole("button", { name: "祈光人成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("region", { name: "祈光人成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "歌颂者成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "歌颂者经历" }));
    const history = screen.getByRole("region", { name: "歌颂者时期的经历" });
    for (const text of ["原当事人的拒歌意愿", "当事人原本要求普通交谈", "原本只约定普通谈话", "当事人实际恢复了工作节奏"]) expect(within(history).getByText(text)).toBeTruthy();
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText(/不得重做/)).toBeNull();
    expect(history.textContent).toContain("你已晋升祈光人");
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains original Bard bottle provenance, outcome and inherited mastery", () => {
    const state = fixture(8);
    state.bard.bottles = [{ id: "old-bard", title: "原歌颂者瓶", source: "音乐室原交接", status: "已服用 · 失败", chance: 50, command: { type: "CONSUME", bottleId: "old-bard", confirmed: true } }];
    state.bard.abilities = [{ id: "sun.s9.praise", label: "原歌颂", mastery: 37, description: "原共同声场边界" }];
    render(<BardHistory bard={state.bard} />);
    for (const text of ["来源：音乐室原交接", "已服用 · 失败", "原歌颂 · 掌握 37：原共同声场边界"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows independent original bottles and supplied costs without a fabricated recipe", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "未核材料不得显示", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("未核材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels with Escape without spending, restores keyboard focus, and confirms one chosen original once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶祈光人魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶祈光人魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("lightprayer-potion-2")).toBeTruthy();
    expect(screen.getByText("来源：灯具库房交接的第二原瓶")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "祈光人服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶祈光人魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "lightprayer-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "这瓶祈光人魔药的服用确认" })).toBeTruthy();
  });

  it("invalidates a stale bottle confirmation when the public action disappears or becomes history", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<LightprayerPanel lightprayer={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<LightprayerPanel lightprayer={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses the domain's maturity and acquisition reasons without inventing a will threshold", () => {
    const value = bottled();
    const reason = "歌颂者消化不足100，且仅度过3/4完整周。";
    panel({ ...value, actions: [...value.actions.map((entry) => ({ ...entry, enabled: false, reason })), guidance,
      { id: "buy", label: "取得第三原瓶", cost: "1210便士，或实际劳动3/3抵1050便士后付160便士", enabled: false, reason: "现金不足", command: { type: "BUY_POTION", bottleId: "lightprayer-potion-3" } },
    ] });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("1210便士，或实际劳动3/3抵1050便士后付160便士")).toBeTruthy();
    expect(screen.getByText("1行动 · 180便士")).toBeTruthy();
    expect(screen.queryByText(/达到意志12/)).toBeNull();
  });

  it("keeps selected observations, chosen preparations and committed results in separate regions", async () => {
    const list = cases();
    list[1] = { ...list[1]!, observations: ["原灯芯确实干燥且远离纸张。"], preparation: "已选择普通火柴并备好湿布。", status: "PREPARED" };
    const { onCommand, rerender } = panel(lightprayer({ promoted: true, cases: list, actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择祈光实践" }), "wick-lighting");
    const facts = screen.getByRole("region", { name: "实际观察记录" });
    expect(facts.textContent).toContain("原灯芯确实干燥且远离纸张。");
    expect(facts.textContent).not.toContain("已选择普通火柴");
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("已选择普通火柴并备好湿布。");
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    list[1] = { ...list[1]!, result: "原灯芯已由火柴点亮，火焰保持在灯座内。", status: "RESOLVED" };
    rerender(<LightprayerPanel lightprayer={lightprayer({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain(list[1]!.result);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).not.toContain(list[1]!.result);
  });

  it("presents LIGHT and ORDINARY preparation as equal choices and never infers preparation", async () => {
    const list = cases();
    list[0] = { ...list[0]!, observations: ["纸签确实存在，字迹尚未辨明。"], status: "OBSERVED" };
    const choices = [action({ type: "PREPARE", caseId: "shaded-label", method: "LIGHT" }, "准备暗中辨认原纸签"), action({ type: "PREPARE", caseId: "shaded-label", method: "ORDINARY" }, "准备普通灯具核验原纸签")];
    const { onCommand } = panel(lightprayer({ promoted: true, cases: list, actions: choices }));
    const summary = screen.getByRole("region", { name: "祈光人成长下一步" });
    expect(summary.textContent).toContain("选择祈光方式或普通方法");
    for (const entry of choices) {
      expect(summary.textContent).not.toContain(entry.label);
      expect(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }).hasAttribute("aria-pressed")).toBe(false);
    }
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^准备普通灯具核验原纸签/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(choices[1]!.command);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("尚无本次准备记录");
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
  });

  it("keeps absent observations unknown and ordinary referrals distinct from purification", async () => {
    const list = cases();
    const { rerender, onCommand } = panel(lightprayer({ promoted: true, cases: list, actions: [], environment: "" }));
    expect(screen.getByRole("region", { name: "已知现场与处理边界" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("不能确认未提供的事实");
    expect(screen.queryByRole("button")).toBeNull();
    list[2] = { ...list[2]!, status: "RESOLVED", observations: ["库房敲击有记录，来源仍未知。"], preparation: "普通记录与转交方案。", result: "原记录已转交。异常来源仍未确认，未声称已净化。" };
    rerender(<LightprayerPanel lightprayer={lightprayer({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择祈光实践" }), "storehouse-echo");
    const result = screen.getByRole("region", { name: "实际作业结果" });
    expect(result.textContent).toBe(`实际作业结果${list[2]!.result}`);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("来源仍未知");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("supports public zero-AP withdrawal and reflection and respects every lock", async () => {
    const value = lightprayer({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "shaded-label" }, "观察原现场", false), { ...action({ type: "WITHDRAW", caseId: "shaded-label" }, "退出本次准备"), cost: "0行动" }, { ...action({ type: "REFLECT" }, "反思实际祈光实践"), cost: "0行动" }] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^观察原现场/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("本周已尝试，须下周再来。").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /^退出本次准备/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "WITHDRAW", caseId: "shaded-label" });
    await userEvent.click(screen.getByRole("button", { name: /^反思实际祈光实践/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "REFLECT" });
    for (const flags of [{ busy: true, blocked: false }, { busy: false, blocked: true }, { busy: false, blocked: false, readOnly: true }]) {
      rerender(<LightprayerPanel lightprayer={value} resources={resources} {...flags} onCommand={onCommand} />);
      const button = screen.getByRole("button", { name: /^反思实际祈光实践/ });
      expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    }
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it("shows the five supplied abilities and original mastery without inventing a Sun vulnerability bonus", () => {
    const abilities = [...BARD_ABILITIES, ...LIGHTPRAYER_ABILITIES].map((entry, index) => ({ ...entry, mastery: index * 7 }));
    panel(lightprayer({ promoted: true, actions: [], acting: 100, abilities }));
    const region = screen.getByRole("region", { name: "祈光人能力与消化" });
    expect(within(region).getByRole("heading", { name: "能力与消化 · 5 项能力" })).toBeTruthy();
    for (const ability of abilities) {
      expect(within(region).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
      expect(within(region).getByText(ability.description)).toBeTruthy();
      expect(screen.queryByText(ability.id)).toBeNull();
    }
    expect(region.textContent).toContain("普通人的恶意或犯罪不会自动成为太阳能力的克制依据");
    expect(region.textContent).not.toMatch(/克制.*[×+]\s*\d/);
    expect(screen.getByRole("region", { name: "祈光人成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE_LIGHT", "PREPARE_ORDINARY", "PERFORM", "WITHDRAW", "REFLECT"] as const)("retries the original failed %s envelope without speculative state", async (type) => {
    const command: LightprayerCommand = type === "CONSUME" ? { type, bottleId: "lightprayer-potion-2", confirmed: true }
      : type === "REFLECT" ? { type }
      : type === "PREPARE_LIGHT" || type === "PREPARE_ORDINARY" ? { type: "PREPARE", caseId: "shaded-label", method: type === "PREPARE_LIGHT" ? "LIGHT" : "ORDINARY" }
      : { type, caseId: "shaded-label" };
    const entry = action(command, `执行${type}`);
    const state = fixture(type === "CONSUME" ? 9 : 8, { lightprayer: type === "CONSUME" ? bottled() : lightprayer({ promoted: true, cases: cases(), actions: [entry] }) });
    const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit;
    await enter(api); await openLightprayer();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const label = type === "CONSUME" ? "确认服用「第二瓶祈光人魔药」" : new RegExp(`^${entry.label}`);
    const confirm = screen.getByRole("button", { name: label });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "祈光人模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("祈光人模拟保存失败");
    expect((screen.getByRole("button", { name: label }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "LIGHTPRAYER", command });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
