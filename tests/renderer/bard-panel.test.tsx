/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { BARD_ABILITIES, BARD_CONSUMPTION_RISK } from "../../src/domain/bard/content";
import type { BardAction, BardCommand, BardProjection } from "../../src/domain/bard/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { BardPanel } from "../../src/renderer/BardPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const discover: BardAction = {
  id: "discover", label: "拜访公共音乐室导师", cost: "1行动 · 只建立渠道", enabled: true,
  reason: null, command: { type: "DISCOVER" },
};
const risk = BARD_CONSUMPTION_RISK;
function bard(patch: Partial<BardProjection> = {}): BardProjection {
  return {
    title: "歌颂者之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): BardProjection {
  return bard({
    discovered: true, guidanceKnown: true,
    supplies: "完整配方资料待核；三瓶独立成品各660便士，完成两次劳动抵600便士后付60便士，指导120便士。供应方剩余1瓶，你持有未服原瓶2瓶。",
    actions: ["bard-potion-1", "bard-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "bard-potion-1", title: "第一瓶歌颂者魔药", source: "导师留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "bard-potion-1", confirmed: true } },
      { id: "bard-potion-2", title: "第二瓶歌颂者魔药", source: "导师留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "bard-potion-2", confirmed: true } },
      { id: "bard-potion-3", title: "第三瓶歌颂者魔药", source: "导师留存的第三原瓶", status: "导师保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "bard-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: BardProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<BardPanel bard={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("bard-renderer-run", sliceDefaultCreationSelection, "bard-renderer-seed");
  raw.week = 6;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    bard: bard({
      discovered: promoted, guidanceKnown: promoted, promoted,
      title: promoted ? "歌颂者 · 序列9" : "歌颂者之路",
      actions: promoted ? [] : [discover],
      abilities: promoted ? BARD_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 5 })) : [],
    }),
    progression: {
      pathwayId: promoted ? "sun" : null, sequence: promoted ? 9 : null,
      mastery: promoted ? Object.fromEntries(BARD_ABILITIES.map((ability) => [ability.id, 0])) : {},
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
async function openBard() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "歌颂者之路" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

function cases(): BardProjection["cases"] {
  return [
    ["newcomer-reading", "新来者的公开朗读", "成年参与者希望能在音乐室开口读完一段短文。"],
    ["troubled-carrier", "搬运者的短暂停步", "成年搬运者停下整理下一段协作的节奏。"],
    ["evening-shift", "晚班前的交谈", "成年夜班人本次只想普通交谈，不接受歌声。"],
  ].map(([id, title, story]) => ({ id: id!, title: title!, story: story!, observations: [], preparation: null, result: null, status: "AVAILABLE" }));
}
function action(command: BardCommand, label = "观察本次当事人与声场", enabled = true, cost = "1行动 · 本次公开成本"): BardAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}

describe("Bard sequence nine dossier", () => {
  it("adds the ninth compact ordinary route, opens only its dossier, and spends nothing on navigation", async () => {
    const value = bridge(fixture());
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    await openBard();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路", "阅读者之路", "水手之路", "歌颂者之路"]) expect(choices.getByRole("button", { name })).toBeTruthy();
    expect(choices.getByRole("button", { name: "歌颂者之路" }).textContent).toContain("自愿歌声与有限鼓舞");
    expect(screen.getByRole("region", { name: "歌颂者成长下一步" }).textContent).toContain("不会自动加入教会");
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /暴怒之民|航海家|守知者|推理学员/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "歌颂者成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("shows three sourced finished originals, exact public acquisition costs and no invented recipe", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "不应渲染的未知原料", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    const recipe = screen.getByRole("region", { name: "歌颂者成品渠道与配方边界" });
    const formulaNotice = within(recipe).getByText("当前渠道只提供有独立来源记录的成品原瓶，不提供完整配方，也不展示未掌握的原料或调配方法；渠道条件、场景与数值以当前公开记录为准。");
    expect(formulaNotice).toBeTruthy();
    expect(formulaNotice.textContent).not.toContain("完整配方资料待核");
    // This deliberately raw supplies fixture is passed through unchanged; only its authored notice is adapted here.
    expect(within(recipe).getByText(value.supplies)).toBeTruthy();
    expect(recipe.textContent?.match(/完整配方资料待核/g)).toHaveLength(1);
    expect(recipe.textContent).not.toContain("属于本作游戏设定");
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("不应渲染的未知原料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely with restored focus, then independently confirms one selected original once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶歌颂者魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶歌颂者魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶歌颂者魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶歌颂者魔药」/ }));
    expect(screen.getByText("bard-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：导师留存的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "歌颂者服用风险与四档结果" }).textContent).toContain(risk);
    expect(screen.getByText("0行动 · 独立确认 · 消耗这瓶魔药")).toBeTruthy();
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶歌颂者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "bard-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops stale bottle confirmation when the action disappears or the route becomes read-only", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶歌颂者魔药」/ }));
    rerender(<BardPanel bard={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶歌颂者魔药」/ }));
    rerender(<BardPanel bard={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses backend timing, guidance and labour decisions instead of calculating eligibility from AP or cash", () => {
    const value = bottled();
    const reason = "尚未完成四个完整周，第5周起才能服药。";
    const actions: BardAction[] = value.actions.map((entry) => ({ ...entry, enabled: false, reason }));
    actions.push(action({ type: "BUY_POTION", bottleId: "bard-potion-3" }, "取得导师原瓶", false, "660便士，或实际劳动2/2后60便士"));
    actions.push(action({ type: "LEARN_GUIDANCE" }, "学习服用指导", true, "1行动 · 120便士"));
    const { onCommand } = panel({ ...value, actions });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("660便士，或实际劳动2/2后60便士")).toBeTruthy();
    expect(screen.getByText("1行动 · 120便士")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^取得导师原瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("supports keyboard bottle opening, Escape cancellation and independent keyboard confirmation", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶歌颂者魔药」/ });
    first.focus();
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶歌颂者魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶歌颂者魔药」/ }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "暂不服用" }));
    await userEvent.tab();
    await userEvent.keyboard("{Enter}{Enter}");
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "bard-potion-1", confirmed: true });
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "这瓶歌颂者魔药的服用确认" })).toBeTruthy();
  });

  it("shows one of three cases and only that participant's committed observations", async () => {
    const list = cases();
    list[1]!.observations = ["搬运者已停下，愿意先谈谈本次困难。", "没有证据可以替他推断隐藏情绪。"];
    list[1]!.preparation = "参与者仅同意本次普通交谈；未同意歌声。";
    const value = bard({ promoted: true, cases: list, actions: list.map((entry) => action({ type: "OBSERVE", caseId: entry.id })) });
    const { onCommand } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前自愿协助" })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("不能推断当事人的意愿");
    expect(screen.queryByText(list[1]!.observations[0]!)).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择自愿协助" }), "troubled-carrier");
    expect(screen.getByText(list[1]!.story)).toBeTruthy();
    expect(screen.queryByText(list[0]!.story)).toBeNull();
    for (const text of list[1]!.observations) expect(within(screen.getByRole("region", { name: "实际观察记录" })).getByText(text)).toBeTruthy();
    expect(screen.getByRole("region", { name: "本次约定与声场准备" }).textContent).toContain(list[1]!.preparation);
    expect(screen.queryByRole("region", { name: "实际协助结果" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^观察本次/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "OBSERVE", caseId: "troubled-carrier" });
  });

  it.each(["SONG", "TALK"] as const)("forwards an explicitly agreed %s mode and waits for committed preparation and result", async (mode) => {
    const list = cases();
    list[0] = { ...list[0]!, status: "OBSERVED", observations: ["参与者已说明本次想试着开口，实际声场已经核实。"] };
    const agreed = action({ type: "AGREE", caseId: "newcomer-reading", mode }, mode === "SONG" ? "约定本次歌声协助" : "约定本次普通交谈");
    const value = bard({ promoted: true, cases: list, actions: [agreed] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${agreed.label}`) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(agreed.command);
    expect(screen.getByRole("region", { name: "本次约定与声场准备" }).textContent).toContain("尚未确认");
    list[0] = { ...list[0]!, status: "AGREED", preparation: `当事人明确同意本次${mode === "SONG" ? "歌声" : "普通交谈"}，随时可以结束。` };
    const perform = action({ type: "PERFORM", caseId: "newcomer-reading" }, "完成已约定的本次协助");
    rerender(<BardPanel bard={{ ...value, cases: list, actions: [perform] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "本次约定与声场准备" }).textContent).toContain(list[0]!.preparation);
    await userEvent.click(screen.getByRole("button", { name: /^完成已约定/ }));
    expect(onCommand).toHaveBeenLastCalledWith(perform.command);
    expect(screen.queryByRole("region", { name: "实际协助结果" })).toBeNull();
    list[0] = { ...list[0]!, status: "RESOLVED", result: mode === "SONG" ? "有限歌声支持了这一段朗读，未改变参与者的意愿。" : "普通交谈帮助参与者整理了节奏；没有使用歌声或产生非凡效果。" };
    rerender(<BardPanel bard={{ ...value, cases: list, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际协助结果" }).textContent).toContain(list[0]!.result);
  });

  it("honors refusal of song while keeping ordinary TALK available and exposes the projected reason", async () => {
    const list = cases();
    list[2] = { ...list[2]!, status: "OBSERVED", observations: ["夜班人明确拒绝本次歌声，只接受普通交谈。"] };
    const song = { ...action({ type: "AGREE", caseId: "evening-shift", mode: "SONG" }, "约定本次歌声协助", false), reason: "当事人已明确拒绝本次歌声协助。" };
    const talk = action({ type: "AGREE", caseId: "evening-shift", mode: "TALK" }, "约定本次普通交谈");
    const { onCommand } = panel(bard({ promoted: true, cases: list, actions: [song, talk] }));
    const songButton = screen.getByRole("button", { name: /^约定本次歌声/ });
    expect((songButton as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById(songButton.getAttribute("aria-describedby")!)?.textContent).toBe(song.reason);
    expect(screen.getByRole("region", { name: "歌颂者成长下一步" }).textContent).not.toContain(song.label);
    fireEvent.click(songButton);
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^约定本次普通交谈/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(talk.command);
  });

  it("keeps zero-AP withdrawal available without pretending the participant was helped", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "AGREED", preparation: "仅同意本次短段歌声，可以随时结束。" };
    const withdraw = action({ type: "WITHDRAW", caseId: "newcomer-reading" }, "退出本次约定", true, "0行动 · 结束本次准备");
    const value = bard({ promoted: true, cases: list, actions: [withdraw] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^退出本次约定/ }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /^退出本次约定/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(screen.queryByRole("region", { name: "实际协助结果" })).toBeNull();
    list[0] = { ...list[0]!, status: "OBSERVED", preparation: null, result: "本次约定已经撤回，没有表演，没有冒记成功。" };
    rerender(<BardPanel bard={{ ...value, cases: list, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际协助结果" }).textContent).toContain("没有冒记成功");
  });

  it("preserves a failed attempt and unknown intentions without inventing agreement or success", () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "OBSERVED", result: "这次协助未能完成，参与者选择停下；失败保留，下次需要重新约定。" };
    panel(bard({ promoted: true, cases: list, actions: [], environment: "" }));
    expect(screen.getByRole("region", { name: "已知音乐室与共同声场" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "本次约定与声场准备" }).textContent).toContain("观察不等于同意");
    expect(screen.getByRole("region", { name: "实际协助结果" }).textContent).toContain(list[0]!.result);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("obeys busy, blocked and read-only states without a blanket zero-AP lock", async () => {
    const value = bard({ promoted: true, cases: cases(), actions: [action({ type: "REFLECT" }, "反思实际协助与参与边界", true, "0行动")] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^反思实际协助/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
    rerender(<BardPanel bard={value} resources={resources} busy blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^反思实际协助/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择自愿协助" }) as HTMLSelectElement).disabled).toBe(true);
    rerender(<BardPanel bard={value} resources={resources} busy={false} blocked onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^反思实际协助/ }));
    rerender(<BardPanel bard={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^反思实际协助/ }));
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("displays only the two public S9 abilities, honest limits and completed digestion", () => {
    panel(bard({ promoted: true, actions: [], acting: 100, digestion: "实际自愿协助已消化。", abilities: BARD_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 7 })) }));
    const abilities = screen.getByRole("region", { name: "歌颂者能力与消化" });
    expect(abilities.textContent).toContain("2 项能力");
    expect(abilities.textContent).toContain("勇气、力量");
    expect(abilities.textContent).toContain("不会凭空产生圣光、治疗伤病或让听众绝对服从");
    for (const [index, entry] of BARD_ABILITIES.entries()) {
      expect(within(abilities).getByText(`${entry.label} · 掌握 ${index * 7}`)).toBeTruthy();
      expect(screen.queryByText(entry.id)).toBeNull();
    }
    expect(screen.getByRole("region", { name: "歌颂者成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens the promoted Bard route by default while preserving previously discovered channels as history", async () => {
    const state = fixture(true);
    state.seer.discovered = true;
    state.seer.formulaKnown = true;
    state.seer.formula = [{ name: "先前已知的占卜家材料", quantity: 1, unit: "份" }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`歌颂者 · 序列9 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("歌颂者 · 序列9 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "歌颂者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    const history = screen.getByRole("region", { name: "已了解的占卜家渠道" });
    expect(history.textContent).toContain("先前已知的占卜家材料");
    expect(within(history).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "歌颂者之路" }));
    expect(screen.getByRole("region", { name: "歌颂者成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("makes a discovered Bard channel read-only after another route is selected", async () => {
    const value = bottled();
    value.actions[0] = { ...value.actions[0]!, enabled: false, reason: "已踏入占卜家途径，不可改换为歌颂者。" };
    const state = fixture(false, { bard: value, progression: { pathwayId: "diviner", sequence: 9, acting: 0, mastery: {}, promotionWeek: 5 } });
    const api = bridge(state);
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "歌颂者经历" }));
    expect(screen.getByText("已选择其它途径，这份歌颂者渠道只供回看。")).toBeTruthy();
    expect(screen.getByText("已踏入占卜家途径，不可改换为歌颂者。")).toBeTruthy();
    for (const button of screen.getAllByRole("button", { name: /查看并准备服用/ })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each([
    ["diviner", "魔术师成长下一步"], ["hunter", "纵火家成长下一步"],
    ["audience", "心理医生成长下一步"], ["paragon", "鉴定师成长下一步"],
    ["moon", "吸血鬼成长下一步"], ["darkness", "梦魇成长下一步"], ["white-tower", "守知者成长下一步"], ["tyrant", "航海家成长下一步"],
  ] as const)("keeps the existing %s S7 route as the default instead of the ninth channel", async (pathwayId, heading) => {
    const state = fixture(false, { progression: { pathwayId, sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    state.bard.discovered = true;
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "歌颂者成长下一步" })).toBeNull();
  });

  it.each(["CONSUME", "OBSERVE", "AGREE", "PERFORM", "WITHDRAW", "REFLECT"] as const)("locks and retries the identical failed %s envelope without double spending or invented result", async (type) => {
    const isCase = type !== "CONSUME";
    const command: BardCommand = type === "CONSUME" ? { type, bottleId: "bard-potion-2", confirmed: true }
      : type === "REFLECT" ? { type } : type === "AGREE" ? { type, caseId: "newcomer-reading", mode: "TALK" } : { type, caseId: "newcomer-reading" };
    const entry = action(command, `执行本次${type}`);
    const zeroAP = type === "CONSUME" || type === "WITHDRAW" || type === "REFLECT";
    const state = fixture(isCase, { bard: isCase ? bard({ promoted: true, cases: cases(), actions: [entry] }) : bottled(), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openBard();
    if (!isCase) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶歌颂者魔药」/ }));
    const name = isCase ? new RegExp(`^${entry.label}`) : "确认服用「第二瓶歌颂者魔药」";
    const confirm = screen.getByRole("button", { name });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "歌颂者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("歌颂者模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际协助结果" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "BARD", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it("keeps ordinary life usable outside an agreed case and leaves the agreement visible on return", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "AGREED", preparation: "本次仅约定普通交谈，不占用之后的日常生活。" };
    const state = fixture(true, { bard: bard({ promoted: true, cases: list, actions: [action({ type: "PERFORM", caseId: "newcomer-reading" }, "进行本次普通交谈")] }), actionsRemaining: 2 });
    const value = bridge(state);
    value.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, actionsRemaining: 1 }, envelope));
    await enter(value);
    await openBard();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    const work = screen.getByRole("button", { name: /工作，1行动/ });
    expect((work as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(work);
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
    await openBard();
    expect(screen.getByRole("region", { name: "本次约定与声场准备" }).textContent).toContain(list[0]!.preparation);
  });

});
