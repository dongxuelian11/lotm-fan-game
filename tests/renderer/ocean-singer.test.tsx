/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OceanSingerAction, OceanSingerCommand, OceanSingerProjection } from "../../src/domain/ocean-singer/types";
import type { WindBlessedProjection } from "../../src/domain/wind-blessed/types";
import { OceanSingerPanel, OceanSingerWindBlessedHistory } from "../../src/renderer/OceanSingerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const emptyResources = { ...resources, mind: 0, spirituality: 0, actionsRemaining: 0 };
const risk = "本作原创G：意志难度26；风眷者消化100且满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。船组处理本次排异，不随机即死，原瓶不复原，原费用不退；仍须真实撤出返港。";
function action(command: OceanSingerCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): OceanSingerAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
function ritual(patch: Partial<OceanSingerProjection["ritual"]> = {}): OceanSingerProjection["ritual"] {
  return { location: "DOCK", status: "尚未赴近海仪式", source: "原导师与专业船组的本作原创G有限安排，原活体OS5-BEAST-1。",
    summary: "仍在原码头，尚未实际支付船程或进入原腹中。", waterFilm: false, visits: 0, consumptions: 0, ...patch };
}
function practice(patch: Partial<NonNullable<OceanSingerProjection["practice"]>> = {}): NonNullable<OceanSingerProjection["practice"]> {
  return { allyPosition: "米娅在原近处2米", song: "本次歌声尚未开启", affected: "米娅未受歌声影响", history: [], ...patch };
}
function oceanSinger(patch: Partial<OceanSingerProjection> = {}): OceanSingerProjection {
  return { title: "海洋歌者晋升", discovered: true, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [],
    supplies: "", actions: [], bottles: [], abilities: [], acting: 0, digestion: "风眷者扮演100，已度过12/12个完整序列6周。",
    pollution: 3, risk, cases: [], insideCase: false, environment: "", ritual: ritual(), practice: null, ...patch };
}
function cases(): OceanSingerProjection["cases"] {
  return [
    { id: "warned-rehearsal", title: "预先告知的排练", story: "成年米娅在原近处2米，沿原8米普通回路可以走到范围外。" },
    { id: "lightning-target", title: "原湿炭靶浅层雷击", story: "原空置3米试验凹室只有获准的同一固定湿炭靶。" },
    { id: "tidal-observation", title: "跨周潮流观察", story: "保存原码头观察，等到下一真实周再复核。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未接触", closes: 0 }));
}
function bottled(): OceanSingerProjection {
  const originals = [1, 2, 3].map((number) => ({ id: `ocean-singer-potion-${number}`, title: `第${number}瓶海洋歌者魔药`,
    source: `原渠道第${number}瓶独立成品与独立采购记录`, chance: number === 2 ? 43 : 71 }));
  return oceanSinger({ guidanceKnown: true, insideCase: true,
    ritual: ritual({ location: "BELLY", status: "专业船组与原活体在场，本次已进入腹中", summary: "本次已实际支付180便士往返与120便士防护水膜。", waterFilm: true, visits: 1 }),
    supplies: "三瓶独立G成品，原价4800便士，每瓶五步劳务抵4200，再付600；完整配方未知。",
    actions: [...originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 消耗指定原瓶 · 本次仪式至多一瓶")),
      action({ type: "EXIT_RITUAL" }, "请原船员实际撤出原海怪腹中", true, "0行动 · 原水膜结束")],
    bottles: originals.map((bottle): OceanSingerProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
function panel(value: OceanSingerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<OceanSingerPanel oceanSinger={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("Ocean Singer real belly rite, song boundaries and original Wind Blessed history", () => {
  it("shows the public maturity gate, original supplies and actual belly rite without inventing a full recipe", () => {
    const reason = "风眷者100；11/12个完整周，尚需下一真实周。";
    const learn = { ...action({ type: "LEARN_GUIDANCE" }, "听取海洋歌者成品指导", false, "460便士 · 1行动"), reason };
    const supplies = "原导师保管独立成品；本瓶4/5步劳务，尚未交付。";
    const { onCommand } = panel(oceanSinger({ digestion: reason, supplies, actions: [learn], formula: [{ name: "未经核实的材料不可显示", quantity: 5, unit: "份" }] }));
    const summary = screen.getByRole("region", { name: "海洋歌者成长下一步" });
    for (const text of ["风眷者6 → 海洋歌者5", reason, "当前渠道只提供成品魔药", "活体奥布尼斯海怪腹中", "腐蚀危险"]) expect(summary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.queryByText("未经核实的材料不可显示")).toBeNull();
    const button = screen.getByRole("button", { name: /^听取海洋歌者成品指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(button.getAttribute("aria-describedby")).toBe(`ocean-singer-reason-${learn.id}`);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /调配|跳过|免费/ })).toBeNull();
  });

  it("forwards only exact projected acquisition and paid ritual commands, without optimistic travel", async () => {
    const commands: OceanSingerCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "ocean-singer-potion-3" },
      { type: "BUY_POTION", bottleId: "ocean-singer-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
      { type: "REQUEST_RITUAL" }, { type: "GO_RITUAL" }];
    const labels = ["听取成品指导", "第三瓶第五步劳务", "支付第三瓶余款", "申请下一批", "登记真实到货", "预约下一周仪式", "支付原往返船程并抵岸"];
    const costs = ["460便士 · 1行动", "1行动 · 五步累计抵4200便士", "600便士 · 0行动", "1行动 · 下一周", "0行动", "1行动", "180便士 · 1行动 · 预付往返"];
    const value = oceanSinger({ actions: commands.map((command, i) => action(command, labels[i]!, true, costs[i]!)) });
    const { onCommand, rerender } = panel(value);
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    commands.forEach((command, i) => expect(onCommand.mock.calls[i]![0]).toBe(command));
    expect(screen.getByText("原码头")).toBeTruthy(); expect(screen.queryByText("原近海仪式岸边")).toBeNull();
    const enter = action({ type: "ENTER_RITUAL" }, "支付实际水膜并进入原腹中", true, "120便士 · 0行动");
    const coast = { ...value, insideCase: true, ritual: ritual({ location: "COAST", visits: 1, status: "已真实抵岸", summary: "原普通船程往返已预付180便士。" }), actions: [enter] };
    rerender(<OceanSingerPanel oceanSinger={coast} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^支付实际水膜并进入原腹中/ }));
    expect(onCommand.mock.calls.at(-1)![0]).toBe(enter.command);
    expect(screen.getByText("原近海仪式岸边")).toBeTruthy(); expect(screen.getByText("当前未启用")).toBeTruthy();
    const route = screen.getByRole("region", { name: "海洋歌者实际仪式与往返" });
    for (const text of ["180便士", "120便士", "不是玩家操控", "不是航海家的气泡能力", "不能用普通生活、周结或切换卷宗代替返程"]) expect(route.textContent).toContain(text);
  });

  it("opens and cancels each independent original inside BELLY at zero AP, restoring keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["ocean-singer-potion-1", "ocean-singer-potion-2", "ocean-singer-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3"); expect(screen.getByText(id)).toBeTruthy();
      expect(screen.getByRole("region", { name: "服药前实际仪式位置" }).textContent).toContain("原活体奥布尼斯海怪腹中");
      if (id.endsWith("2")) await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
      expect(screen.getByRole("region", { name: "海洋歌者实际仪式与往返" }).textContent).toContain("本次已实际付费启用");
    }
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^请原船员实际撤出/ })).toBeTruthy();
  });

  it("confirms the selected four-tier risk and original once, retaining it through persistence failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("ocean-singer-potion-2"));
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.getByText(`来源：${value.bottles[1]!.source}`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "海洋歌者服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第2瓶海洋歌者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    rerender(<OceanSingerPanel oceanSinger={value} resources={resources} busy={false} error={{ message: "本次服药保存失败。", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("当前仍显示上次已保存的记录");
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByText("ocean-singer-potion-2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<OceanSingerPanel oceanSinger={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第2瓶海洋歌者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "海洋歌者能力与消化" })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("keeps actual zero-AP extraction and prepaid return after committed promotion=%s", async (promoted) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("ocean-singer-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第1瓶海洋歌者魔药」" }));
    const exit = value.actions.at(-1)!;
    const second = { ...value.actions[1]!, enabled: false, reason: "本次赴仪式已服一瓶；须实际返港并另约下一真实周。" };
    const result = promoted ? "已耗用 · 成功晋升，仍在原腹中" : "已耗用 · 原失败与排异保留，仍在原腹中";
    const consumed: OceanSingerProjection = { ...value, promoted, ritual: { ...value.ritual, consumptions: 1 },
      bottles: value.bottles.map((bottle, i) => i === 0 ? { ...bottle, status: result } : bottle), actions: promoted ? [exit] : [second, exit] };
    rerender(<OceanSingerPanel oceanSinger={consumed} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶海洋歌者魔药的服用确认" })).toBeNull(); expect(screen.getByText(result)).toBeTruthy();
    if (!promoted) expect(bottleButton("ocean-singer-potion-2").disabled).toBe(true);
    const exitButton = screen.getByRole("button", { name: /^请原船员实际撤出/ }) as HTMLButtonElement;
    expect(exitButton.disabled).toBe(false); await userEvent.click(exitButton);
    expect(screen.getByText("原活体奥布尼斯海怪腹中")).toBeTruthy(); expect(screen.getByText("本次已实际付费启用")).toBeTruthy();
    const back = action({ type: "RETURN_DOCK" }, "按预付原船程与步行回码头", true, "0行动 · 0灵性 · 不再付船费");
    const coast = { ...consumed, ritual: { ...consumed.ritual, location: "COAST" as const, waterFilm: false, status: "已由原船员实际撤出" }, actions: [back] };
    rerender(<OceanSingerPanel oceanSinger={coast} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("原近海仪式岸边")).toBeTruthy(); expect(screen.getByText("当前未启用")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^请原船员实际撤出/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^按预付原船程/ }));
    expect(screen.getByText("原近海仪式岸边")).toBeTruthy();
    rerender(<OceanSingerPanel oceanSinger={{ ...coast, insideCase: false, ritual: { ...coast.ritual, location: "DOCK", status: "已实际回原码头" }, actions: [] }} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("原码头")).toBeTruthy(); expect(screen.getByText(result)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, exit.command, back.command]);
  });

  it("offers the same actual zero-AP extraction without requiring a bottle to be consumed", async () => {
    const value = bottled(); const exit = value.actions.at(-1)!;
    const { onCommand } = panel({ ...value, actions: [exit], bottles: [] });
    await userEvent.click(screen.getByRole("button", { name: /^请原船员实际撤出/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(exit.command);
    expect(screen.getByText("原活体奥布尼斯海怪腹中")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
  });

  it("keeps song risk visible and separates actual song closure, affected-ally recovery and the report", async () => {
    const perform = action({ type: "PERFORM", caseId: "warned-rehearsal" }, "实际尝试有限歌声", true, "1行动 · 3灵性 · 意志14");
    const move = action({ type: "MOVE_ALLY" }, "请米娅沿原普通回路移位", true, "0行动 · 普通步行8米");
    const value = oceanSinger({ promoted: true, cases: cases(), practice: practice(), actions: [perform, move] });
    const { onCommand, rerender } = panel(value);
    const allyRegion = screen.getByRole("region", { name: "海洋歌者同伴位置与歌声" });
    for (const text of ["近处2米", "范围为5米", "捂耳也不保证免疫", "不自动结束歌声"]) expect(allyRegion.textContent).toContain(text);
    // The projected ability attempt remains a real choice even before asking the ally to move.
    await userEvent.click(screen.getByRole("button", { name: /^实际尝试有限歌声/ }));
    expect(screen.getByText("本次歌声尚未开启")).toBeTruthy();
    const failure = "本次原歌声影响近处米娅，未通过有限排练；已付3灵性与原行动。";
    const affected = "米娅仍因原歌声分神，尚未普通交谈与休息";
    const close = action({ type: "CLOSE", caseId: "warned-rehearsal" }, "实际停止本次原歌声", true, "0行动 · 0灵性");
    const clear = action({ type: "CLEAR_ALLY" }, "普通交谈与休息消除本次分神", false, "0行动");
    const report = { ...action({ type: "REPORT", caseId: "warned-rehearsal" }, "提交本次有限排练记录", false), reason: "先停止歌声、清除同伴影响并实际回位。" };
    const open = { ...value, insideCase: true, practice: practice({ song: "本次原歌声仍开启", affected, history: [failure] }),
      cases: cases().map((entry) => entry.id === "warned-rehearsal" ? { ...entry, result: failure, status: "EXAMINED", contactOpen: "原接触仍开启" } : entry), actions: [close, clear, report] };
    rerender(<OceanSingerPanel oceanSinger={open} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^提交本次有限排练记录/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^普通交谈与休息/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际停止本次原歌声/ }));
    expect(screen.getByText("本次原歌声仍开启")).toBeTruthy(); expect(screen.getByText(affected)).toBeTruthy();
    const closed = { ...open, practice: practice({ song: "本次原歌声已实际停止", affected, history: [failure] }), actions: [{ ...clear, enabled: true, reason: null }, report] };
    rerender(<OceanSingerPanel oceanSinger={closed} resources={emptyResources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^普通交谈与休息/ }));
    expect(screen.getByText(affected)).toBeTruthy(); expect(screen.getByRole("region", { name: "海洋歌者实际结果" }).textContent).toContain(failure);
    rerender(<OceanSingerPanel oceanSinger={{ ...closed, insideCase: false, practice: practice({ song: "本次原歌声已实际停止", history: [failure] }), actions: [] }} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("米娅未受歌声影响")).toBeTruthy(); expect(screen.getByRole("region", { name: "海洋歌者实际结果" }).textContent).toContain(failure);
    expect((screen.getByRole("progressbar", { name: "海洋歌者扮演进度" }) as HTMLProgressElement).value).toBe(0);
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([perform.command, close.command, clear.command]);
  });

  it("does not teleport the ally on a click and leaves her real return available after the last AP", async () => {
    const move = action({ type: "MOVE_ALLY" }, "沿原8米回路移到范围外", true, "0行动");
    const value = oceanSinger({ promoted: true, cases: cases(), practice: practice(), actions: [move] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^沿原8米回路移到范围外/ })); expect(screen.getByText("米娅在原近处2米")).toBeTruthy();
    const back = action({ type: "RETURN_ALLY" }, "让米娅沿原8米回路实际回位", true, "0行动 · 0灵性");
    const shelter = { ...value, insideCase: true, actions: [back], practice: practice({ allyPosition: "米娅在歌声范围外等候", song: "原歌声已停止" }) };
    rerender(<OceanSingerPanel oceanSinger={shelter} resources={emptyResources} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole("button", { name: /^让米娅沿原8米回路实际回位/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false); await userEvent.click(button); expect(screen.getByText("米娅在歌声范围外等候")).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([move.command, back.command]);
  });

  it("shows the later-real-week tide gate and exact ordinary method without imaginary immersion or rewards", async () => {
    const prepare = action({ type: "PREPARE", caseId: "tidal-observation", method: "ORDINARY" }, "准备普通比较原潮流记录", true, "1行动 · 不耗灵性");
    const perform = { ...action({ type: "PERFORM", caseId: "tidal-observation" }, "实际复核原潮流", false, "1行动 · 知识10"), reason: "已观察第52周潮流，须更晚的真实一周才能实际复核。" };
    const value = oceanSinger({ promoted: true, cases: cases(), practice: practice(), actions: [prepare, perform] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("tidal-observation");
    const region = screen.getByRole("region", { name: "当前海洋歌者实践" });
    for (const text of ["更晚的真实一周", "继承的水流感知", "没有发生潜水行程"]) expect(region.textContent).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: /^准备普通比较/ }));
    const unavailable = screen.getByRole("button", { name: /^实际复核原潮流/ }) as HTMLButtonElement;
    expect(unavailable.disabled).toBe(true); expect(screen.getByText(perform.reason)).toBeTruthy(); fireEvent.click(unavailable);
    rerender(<OceanSingerPanel oceanSinger={{ ...value, actions: [{ ...perform, enabled: true, reason: null }] }} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^实际复核原潮流/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([prepare.command, perform.command]);
    expect(screen.queryByRole("region", { name: "海洋歌者实际结果" })).toBeNull();
    expect((screen.getByRole("progressbar", { name: "海洋歌者扮演进度" }) as HTMLProgressElement).value).toBe(0);
  });

  it("never derives an open song or invents actions from historical prose, and locks real submissions on save errors", async () => {
    const history = "原失败：曾在近处分神，歌声后来已经关闭。";
    const value = oceanSinger({ promoted: true, cases: cases(), practice: practice({ history: [history] }) });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox"), "lightning-target");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("lightning-target"); expect(screen.queryByRole("button")).toBeNull();
    const close = action({ type: "CLOSE", caseId: "lightning-target" }, "实际结束原靶接触", true, "0行动");
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<OceanSingerPanel oceanSinger={{ ...value, insideCase: true, actions: [close] }} resources={emptyResources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      const button = screen.getByRole("button", { name: /^实际结束原靶接触/ }) as HTMLButtonElement;
      expect(button.disabled).toBe(true); fireEvent.click(button); expect(screen.getByText(history)).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps optional conflict and known mastery separate from song immunity and high-sequence powers", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "赴原码头工院交涉", true, "1行动");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担布伦原普通棍冲突", true, "1行动 · 真实伤势风险");
    const value = oceanSinger({ promoted: true, cases: cases(), actions: [talk, fight], abilities: [
      { id: "tyrant.s5.sea-song", label: "有限歌声", mastery: 8, description: "同伴也可能受到影响。" },
      { id: "tyrant.s6.short-flight", label: "原短程借风", mastery: 67, description: "原知识与成本保留。" },
    ] });
    const { onCommand } = panel(value);
    const encounter = within(screen.getByRole("region", { name: "海洋歌者有限冲突" }));
    expect(encounter.getByText(/没有米娅或其他同伴/).textContent).toContain("不等于歌声能自动排除友方");
    await userEvent.click(encounter.getByRole("button", { name: /^赴原码头工院交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^承担布伦原普通棍冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.getByText("有限歌声 · 掌握 8")).toBeTruthy(); expect(screen.getByText("原短程借风 · 掌握 67")).toBeTruthy();
    const boundary = screen.getByLabelText("海洋歌者能力边界");
    for (const text of ["捂耳不保证免疫", "不保证命中", "不强制睡眠", "原固定湿炭靶", "不召唤天气", "不代表无限潜水"]) expect(boundary.textContent).toContain(text);
    expect(boundary.textContent).toContain("序列4的雷暴、海啸和大型海怪统御未开放");
    expect(screen.queryByRole("button", { name: /雷暴|海啸|免费|强制|控制海怪/ })).toBeNull();
  });

  it("retains actual S6 flights, failures, closure counts and bottles as read-only history", () => {
    const windBlessed: WindBlessedProjection = {
      title: "风眷者", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [], supplies: "原独立供给记录",
      story: "原三案真实经过", environment: "原维修院", actions: [{ id: "old-return", label: "不应重新执行旧返回", cost: "0行动", enabled: true, reason: null,
        command: { type: "CLOSE", caseId: "low-platform", returnMethod: "FLIGHT" } }],
      cases: [{ id: "low-platform", title: "原低台往返", story: "原楼梯始终可走", status: "RESOLVED", observations: ["原返程失败，实际消耗2灵性并留在原台面。"],
        preparation: "当时准备独立飞行返回", result: "后来实际沿原楼梯返回，失败和成本保留", contactOpen: "已实际结束", closes: 2 }],
      bottles: [{ id: "wind-blessed-potion-1", title: "风眷者原瓶", source: "原独立渠道", status: "原失败与耗用保留", chance: 0,
        command: { type: "CONSUME", bottleId: "wind-blessed-potion-1", confirmed: true } }],
      abilities: [{ id: "tyrant.s6.short-flight", label: "原短程借风", mastery: 67, description: "原知识与失败保留。" }],
      acting: 100, digestion: "已消化", pollution: 3, risk: "原风险", insideCase: false,
      flight: { position: "GROUND", ascents: 4, flightReturns: 1, stairReturns: 3 },
    };
    render(<OceanSingerWindBlessedHistory windBlessed={windBlessed} />);
    const history = within(screen.getByRole("region", { name: "风眷者时期的经历" }));
    expect(history.getByText("原案卷ID：low-platform")).toBeTruthy(); expect(history.getByText(windBlessed.cases[0]!.observations[0]!)).toBeTruthy();
    expect(history.getByText("原瓶ID：wind-blessed-potion-1")).toBeTruthy(); expect(history.getByText("来源：原独立渠道")).toBeTruthy();
    expect(history.getByText("原失败与耗用保留")).toBeTruthy(); expect(history.getByText("原短程借风 · 掌握 67：原知识与失败保留。")).toBeTruthy();
    const journeys = within(history.getByRole("region", { name: "风眷者原低台往返历史" }));
    for (const text of ["原地面", "4 次", "1 次", "3 次"]) expect(journeys.getByText(text)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
