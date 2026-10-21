/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { SAILOR_ABILITIES, SAILOR_CONSUMPTION_RISK } from "../../src/domain/sailor/content";
import type { SailorAction, SailorCommand, SailorProjection } from "../../src/domain/sailor/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SailorPanel } from "../../src/renderer/SailorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const discover: SailorAction = {
  id: "discover", label: "拜访码头导师", cost: "1行动 · 只建立渠道", enabled: true,
  reason: null, command: { type: "DISCOVER" },
};
const risk = SAILOR_CONSUMPTION_RISK;
function sailor(patch: Partial<SailorProjection> = {}): SailorProjection {
  return {
    title: "水手之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): SailorProjection {
  return sailor({
    discovered: true, guidanceKnown: true,
    supplies: "完整配方资料待核；三瓶独立成品各660便士，完成两次劳动抵600便士后付60便士，指导120便士。供应方剩余1瓶，你持有未服原瓶2瓶。",
    actions: ["sailor-potion-1", "sailor-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "sailor-potion-1", title: "第一瓶水手魔药", source: "导师留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "sailor-potion-1", confirmed: true } },
      { id: "sailor-potion-2", title: "第二瓶水手魔药", source: "导师留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "sailor-potion-2", confirmed: true } },
      { id: "sailor-potion-3", title: "第三瓶水手魔药", source: "导师留存的第三原瓶", status: "导师保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "sailor-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: SailorProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SailorPanel sailor={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("sailor-renderer-run", sliceDefaultCreationSelection, "sailor-renderer-seed");
  raw.week = 6;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    sailor: sailor({
      discovered: promoted, guidanceKnown: promoted, promoted,
      title: promoted ? "水手 · 序列9" : "水手之路",
      actions: promoted ? [] : [discover],
      abilities: promoted ? SAILOR_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 5 })) : [],
    }),
    progression: {
      pathwayId: promoted ? "tyrant" : null, sequence: promoted ? 9 : null,
      mastery: promoted ? Object.fromEntries(SAILOR_ABILITIES.map((ability) => [ability.id, 0])) : {},
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
async function openSailor() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "水手之路" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

function cases(): SailorProjection["cases"] {
  return [
    ["moored-barrel", "岸边系泊木桶", "由货主保管的木桶仍系在岸边。"],
    ["wet-gangway", "湿滑栈桥搬运", "在许可范围内搬动栈桥原货物。"],
    ["rescue-drill", "自愿救援演练", "参与者同意在岸边进行有限演练。"],
  ].map(([id, title, story]) => ({ id: id!, title: title!, story: story!, observations: [], equipment: [], result: null, status: "AVAILABLE" }));
}
function action(command: SailorCommand, label = "勘察本处水域与岸边", enabled = true, cost = "1行动 · 本次公开成本"): SailorAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "先检查原绳具与岸边退路。", command };
}

describe("Sailor sequence nine dossier", () => {
  it("adds the eighth compact ordinary route, opens only its dossier, and spends nothing on navigation", async () => {
    const value = bridge(fixture());
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    await openSailor();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路", "阅读者之路", "水手之路"]) expect(choices.getByRole("button", { name })).toBeTruthy();
    expect(choices.getByRole("button", { name: "水手之路" }).textContent).toContain("水边作业与岸边退路");
    expect(screen.getByRole("region", { name: "水手成长下一步" }).textContent).toContain("不会自动加入教会");
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /暴怒之民|航海家|守知者|推理学员/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "水手成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("shows three sourced finished originals, exact public acquisition costs and no invented recipe", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "不应渲染的未知原料", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("不应渲染的未知原料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely with restored focus, then independently confirms one selected original once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶水手魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶水手魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶水手魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶水手魔药」/ }));
    expect(screen.getByText("sailor-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：导师留存的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "水手服用风险与四档结果" }).textContent).toContain(risk);
    expect(screen.getByText("0行动 · 独立确认 · 消耗这瓶魔药")).toBeTruthy();
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶水手魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "sailor-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops stale bottle confirmation when the action disappears or the route becomes read-only", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶水手魔药」/ }));
    rerender(<SailorPanel sailor={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶水手魔药」/ }));
    rerender(<SailorPanel sailor={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses backend timing, guidance and labour decisions instead of calculating eligibility from AP or cash", () => {
    const value = bottled();
    const reason = "尚未完成四个完整周，第5周起才能服药。";
    const actions: SailorAction[] = value.actions.map((entry) => ({ ...entry, enabled: false, reason }));
    actions.push(action({ type: "BUY_POTION", bottleId: "sailor-potion-3" }, "取得导师原瓶", false, "660便士，或实际劳动2/2后60便士"));
    actions.push(action({ type: "LEARN_GUIDANCE" }, "学习服用指导", true, "1行动 · 120便士"));
    const { onCommand } = panel({ ...value, actions });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("660便士，或实际劳动2/2后60便士")).toBeTruthy();
    expect(screen.getByText("1行动 · 120便士")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^取得导师原瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("selects one of three actual jobs and displays only its publicly confirmed observations and equipment", async () => {
    const list = cases();
    list[1]!.observations = ["原栈桥的湿滑处已经当面勘察。", "岸边协作者仍在原位。"];
    list[1]!.equipment = ["货主的原绳具已系在本处固定点，所有权仍属货主。"];
    const value = sailor({ promoted: true, cases: list, actions: list.map((entry) => action({ type: "SURVEY", caseId: entry.id })) });
    const { onCommand } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前水边作业" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^勘察本处/ })).toHaveLength(1);
    expect(screen.getByText("尚未勘察本处水域，水情与退路不能凭空确认。")).toBeTruthy();
    expect(screen.queryByText(list[1]!.observations[0]!)).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择水边作业" }), "wet-gangway");
    expect(screen.getByText(list[1]!.story)).toBeTruthy();
    expect(screen.queryByText(list[0]!.story)).toBeNull();
    for (const observation of list[1]!.observations) expect(within(screen.getByRole("region", { name: "实际勘察记录" })).getByText(observation)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "原绳具与物件归属" })).getByText(list[1]!.equipment[0]!)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^勘察本处/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "SURVEY", caseId: "wet-gangway" });
  });

  it("waits for committed survey and preparation, forwards either method, and only displays committed shore results", async () => {
    const list = cases();
    const value = sailor({ promoted: true, cases: list, actions: [action({ type: "SURVEY", caseId: "moored-barrel" })] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^勘察本处/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "SURVEY", caseId: "moored-barrel" });
    expect(screen.getByText("尚未勘察本处水域，水情与退路不能凭空确认。")).toBeTruthy();
    list[0] = { ...list[0]!, status: "SURVEYED", observations: ["系泊木桶与上岸点已经当面确认。"] };
    rerender(<SailorPanel sailor={{ ...value, cases: list, actions: [action({ type: "PREPARE", caseId: "moored-barrel" }, "准备原绳具与协作者")] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^准备原绳具/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "PREPARE", caseId: "moored-barrel" });
    expect(screen.getByText("尚无已确认的绳具准备记录；现场物件不会自动归入你的背包。")).toBeTruthy();
    list[0] = { ...list[0]!, status: "PREPARED", equipment: ["原绳具已固定，归属货主，协作者在岸边。"] };
    const ability = action({ type: "PERFORM", caseId: "moored-barrel", method: "ABILITY" }, "运用水生亲和完成本次作业");
    const team = action({ type: "PERFORM", caseId: "moored-barrel", method: "TEAM" }, "与岸边协作者普通协作");
    rerender(<SailorPanel sailor={{ ...value, cases: list, actions: [ability, team] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "原绳具与物件归属" }).textContent).toContain(list[0]!.equipment[0]);
    expect(screen.getByRole("region", { name: "水手成长下一步" }).textContent).not.toContain(ability.label);
    await userEvent.click(screen.getByRole("button", { name: /^运用水生亲和/ }));
    expect(onCommand).toHaveBeenLastCalledWith(ability.command);
    await userEvent.click(screen.getByRole("button", { name: /^与岸边协作者/ }));
    expect(onCommand).toHaveBeenLastCalledWith(team.command);
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    list[0] = { ...list[0]!, status: "RESOLVED", result: "木桶交回原货主，原绳具归还，你与协作者都回到岸边。" };
    rerender(<SailorPanel sailor={{ ...value, cases: list, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain(list[0]!.result);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps withdrawal available at zero AP and never turns it into a successful rescue", async () => {
    const list = cases();
    list[2] = { ...list[2]!, status: "PREPARED", equipment: ["导师原绳已固定，所有权不变。"] };
    const withdraw = action({ type: "WITHDRAW", caseId: "rescue-drill" }, "撤回岸边并归还原绳具", true, "0行动 · 保留尚未完成的演练");
    const value = sailor({ promoted: true, cases: list, actions: [withdraw] });
    const { onCommand, rerender } = panel(value);
    const shore = screen.getByRole("region", { name: "岸边退路与作业边界" });
    expect(shore.textContent).toContain("成功或失败都在岸边结算");
    expect(shore.textContent).toContain("没有跨行动的水中停留");
    expect((screen.getByRole("button", { name: /^撤回岸边/ }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /^撤回岸边/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    list[2] = { ...list[2]!, status: "SURVEYED", equipment: ["原绳已归还导师，本次演练尚未完成。"], result: "你选择停止准备并留在岸边，没有结算救援成功。" };
    rerender(<SailorPanel sailor={{ ...value, cases: list, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择水边作业" }), "rescue-drill");
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain("没有结算救援成功");
  });

  it("keeps failed return-to-shore outcomes and original ownership visible without manufacturing a rescue", () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "SURVEYED", observations: ["原上岸点仍可用。"], equipment: ["原绳已归还，木桶仍属于货主。"], result: "本次失败后回到岸边，木桶未取回，实际健康损失保留。" };
    panel(sailor({ promoted: true, cases: list, actions: [action({ type: "PREPARE", caseId: "moored-barrel" }, "下次重新准备", false)] }));
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain(list[0]!.result);
    expect(screen.getByRole("region", { name: "原绳具与物件归属" }).textContent).toContain("木桶仍属于货主");
    expect((screen.getByRole("button", { name: /^下次重新准备/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps unknown water and gear unknown instead of inventing safety or extra combat actions", () => {
    panel(sailor({ promoted: true, cases: cases(), actions: [], environment: "" }));
    expect(screen.getByRole("region", { name: "已知水域与岸边环境" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "原绳具与物件归属" }).textContent).toContain("尚无已确认");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
  });

  it("obeys disabled reasons, busy and blocked states without a blanket zero-AP lock", async () => {
    const value = sailor({ promoted: true, cases: cases(), actions: [action({ type: "PERFORM", caseId: "moored-barrel", method: "ABILITY" }, "使用本次能力", false), action({ type: "REFLECT" }, "反思实际作业与退路", true, "0行动")] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^使用本次能力/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("先检查原绳具与岸边退路。")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^反思实际作业/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
    rerender(<SailorPanel sailor={value} resources={resources} busy blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^反思实际作业/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择水边作业" }) as HTMLSelectElement).disabled).toBe(true);
    rerender(<SailorPanel sailor={value} resources={resources} busy={false} blocked onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^反思实际作业/ }));
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("displays human-readable S9 abilities and fictional breathing limits without raw IDs or higher-sequence actions", () => {
    panel(sailor({ promoted: true, actions: [], acting: 100, digestion: "实际水边作业已消化。", environment: "仅开放三处经许可的岸边作业。", abilities: SAILOR_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 7 })) }));
    const abilities = screen.getByRole("region", { name: "水手能力与消化" });
    expect(abilities.textContent).toContain("至少十分钟");
    expect(abilities.textContent).toContain("不是现实潜水建议");
    expect(abilities.textContent).toContain("不代表无限呼吸");
    expect(abilities.textContent).toContain("暴怒与水系法术属于后续序列");
    for (const [index, entry] of SAILOR_ABILITIES.entries()) {
      expect(within(abilities).getByText(`${entry.label} · 掌握 ${index * 7}`)).toBeTruthy();
      expect(screen.queryByText(entry.id)).toBeNull();
    }
    expect(screen.getByRole("region", { name: "水手成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens the promoted Sailor route by default while preserving previously discovered channels as history", async () => {
    const state = fixture(true);
    state.seer.discovered = true;
    state.seer.formulaKnown = true;
    state.seer.formula = [{ name: "先前已知的占卜家材料", quantity: 1, unit: "份" }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`水手 · 序列9 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("水手 · 序列9 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "水手成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    const history = screen.getByRole("region", { name: "已了解的占卜家渠道" });
    expect(history.textContent).toContain("先前已知的占卜家材料");
    expect(within(history).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "水手之路" }));
    expect(screen.getByRole("region", { name: "水手成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("makes a discovered Sailor channel read-only after another route is selected", async () => {
    const value = bottled();
    value.actions[0] = { ...value.actions[0]!, enabled: false, reason: "已踏入占卜家途径，不可改换为水手。" };
    const state = fixture(false, { sailor: value, progression: { pathwayId: "diviner", sequence: 9, acting: 0, mastery: {}, promotionWeek: 5 } });
    const api = bridge(state);
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "水手经历" }));
    expect(screen.getByText("已选择其它途径，这份水手渠道只供回看。")).toBeTruthy();
    expect(screen.getByText("已踏入占卜家途径，不可改换为水手。")).toBeTruthy();
    for (const button of screen.getAllByRole("button", { name: /查看并准备服用/ })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each([
    ["diviner", "魔术师成长下一步"], ["hunter", "纵火家成长下一步"],
    ["audience", "心理医生成长下一步"], ["paragon", "鉴定师成长下一步"],
    ["moon", "吸血鬼成长下一步"], ["darkness", "梦魇成长下一步"], ["white-tower", "守知者成长下一步"],
  ] as const)("keeps the existing %s S7 route as the default instead of the eighth channel", async (pathwayId, heading) => {
    const state = fixture(false, { progression: { pathwayId, sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    state.sailor.discovered = true;
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "水手成长下一步" })).toBeNull();
  });

  it.each(["CONSUME", "SURVEY", "PREPARE", "PERFORM", "WITHDRAW", "REFLECT"] as const)("locks and retries the identical failed %s envelope without double spending or invented result", async (type) => {
    const isCase = type !== "CONSUME";
    const command: SailorCommand = type === "CONSUME" ? { type, bottleId: "sailor-potion-2", confirmed: true }
      : type === "REFLECT" ? { type } : type === "PERFORM" ? { type, caseId: "moored-barrel", method: "TEAM" } : { type, caseId: "moored-barrel" };
    const entry = action(command, `执行本次${type}`);
    const zeroAP = type === "CONSUME" || type === "WITHDRAW" || type === "REFLECT";
    const state = fixture(isCase, { sailor: isCase ? sailor({ promoted: true, cases: cases(), actions: [entry] }) : bottled(), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openSailor();
    if (!isCase) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶水手魔药」/ }));
    const name = isCase ? new RegExp(`^${entry.label}`) : "确认服用「第二瓶水手魔药」";
    const confirm = screen.getByRole("button", { name });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "水手模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("水手模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "SAILOR", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
