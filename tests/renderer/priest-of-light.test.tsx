/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotaryProjection } from "../../src/domain/notary/types";
import type { PriestOfLightAction, PriestOfLightCommand, PriestOfLightProjection } from "../../src/domain/priest-of-light/types";
import { PriestOfLightNotaryHistory, PriestOfLightPanel } from "../../src/renderer/PriestOfLightPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const emptyResources = { ...resources, mind: 0, spirituality: 0, actionsRemaining: 0 };
const risk = "本作原创G：意志难度26；公证人消化100且满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。原协助者处理本次排异，不随机即死，原瓶不复原，原费用不退；仍须真实解埋返程。";
function action(command: PriestOfLightCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): PriestOfLightAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
function ritual(patch: Partial<PriestOfLightProjection["ritual"]> = {}): PriestOfLightProjection["ritual"] {
  return { location: "GUIDE", status: "尚未赴原地窖仪式", source: "原导师与协助者的本作原创G有限安排，原不化坚冰PL5-ICE-1。",
    summary: "仍在原导师处，尚未实际支付往返或埋入原冰。", darkness: false, nonMeltingIce: false, helperPresent: false,
    visits: 0, consumptions: 0, ...patch };
}
function practice(patch: Partial<NonNullable<PriestOfLightProjection["practice"]>> = {}): NonNullable<PriestOfLightProjection["practice"]> {
  return { lanternPosition: "主人与原灯中的栖灯在原近处2米", aura: "本次净化光环尚未开启", distressed: "栖灯当前未受光环影响", history: [], ...patch };
}
function priestOfLight(patch: Partial<PriestOfLightProjection> = {}): PriestOfLightProjection {
  return { title: "光之祭司晋升", discovered: true, promoted: false, formulaKnown: false, formula: [],
    supplies: "", actions: [], bottles: [], abilities: [], acting: 0, digestion: "公证人扮演100，已度过12/12个完整序列6周。",
    pollution: 3, risk, cases: [], insideCase: false, environment: "", ritual: ritual(), practice: null, ...patch };
}
function formula(): PriestOfLightProjection["formula"] {
  return [
    { name: "黎明雄鸡之王的红冠", quantity: null, unit: "", note: "原著未给出确切用量；G供货一份原批，不补编克重。" },
    { name: "纯白光辉石", quantity: 1, unit: "块" }, { name: "迷迭香", quantity: 5, unit: "g" },
    { name: "金手柑汁", quantity: 7, unit: "滴" }, { name: "岩水", quantity: 10, unit: "mL" },
    { name: "黎明雄鸡之王血", quantity: 60, unit: "mL" },
  ];
}
function cases(): PriestOfLightProjection["cases"] {
  return [
    { id: "darkened-walk", title: "原暗工作间照明", story: "原3米暗工作间与同一原普通小灯。" },
    { id: "bounded-cleansing", title: "同一原石板有限残留", story: "空置原石板上有限的旧死亡残留。" },
    { id: "mixed-company", title: "友好小灵体与原灯", story: "原主人、原灯和友好灵体栖灯在近处2米，普通路线8米。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未接触", closes: 0 }));
}
function bottled(): PriestOfLightProjection {
  const originals = [1, 2, 3].map((number) => ({ id: `priest-of-light-potion-${number}`, title: `第${number}瓶光之祭司魔药`,
    source: `第${number}批六件原材料实际耗用后调配的独立原瓶`, chance: number === 2 ? 43 : 71 }));
  return priestOfLight({ formulaKnown: true, formula: formula(), insideCase: true,
    ritual: ritual({ location: "ICE", status: "原协助者在场，原身体已埋入原冰", summary: "本次已实际支付180便士往返与120便士原协助。",
      darkness: true, nonMeltingIce: true, helperPresent: true, visits: 1 }),
    supplies: "三批实际六料；每批五步劳务抵4200便士，另付600便士辅料款，100便士调配费。",
    actions: [...originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 消耗指定原瓶 · 本次仪式至多一瓶")),
      action({ type: "END_RITUAL" }, "请原协助者实际解埋原身体", true, "0行动 · 结束本次埋冰与遮光")],
    bottles: originals.map((bottle): PriestOfLightProjection["bottles"][number] => ({ ...bottle, status: "同批六料已调配，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
function panel(value: PriestOfLightProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<PriestOfLightPanel priestOfLight={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("Priest of Light real materials, ice rite, original spirit and Notary history", () => {
  it("shows the public maturity gate and independent batches without exposing an unlearned recipe", () => {
    const reason = "公证人100；11/12个完整周，尚需下一真实周。";
    const learn = { ...action({ type: "LEARN_FORMULA" }, "学习光之祭司完整配方", false, "460便士 · 1行动"), reason };
    const supplies = "原第二批4/5步劳务，六件原材料尚未交付，没有原瓶。";
    const { onCommand } = panel(priestOfLight({ digestion: reason, supplies, actions: [learn], formula: formula() }));
    const summary = screen.getByRole("region", { name: "光之祭司成长下一步" });
    for (const text of ["公证人6 → 光之祭司5", reason, "取得实际六料", "调配独立原瓶", "纯粹的外部黑暗", "身体实际埋入"]) expect(summary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.queryByText("纯白光辉石")).toBeNull();
    const button = screen.getByRole("button", { name: /^学习光之祭司完整配方/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(button.getAttribute("aria-describedby")).toBe(`priest-of-light-reason-${learn.id}`);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /服用|跳过|免费/ })).toBeNull();
  });

  it("shows all six learned materials with the unknown red crown amount and explicit G process", () => {
    panel(priestOfLight({ formulaKnown: true, formula: formula() }));
    const recipe = within(screen.getByLabelText("光之祭司已知配方"));
    for (const ingredient of formula()) expect(recipe.getByText(ingredient.name)).toBeTruthy();
    for (const text of ["原著未给量", "1 块", "5 g", "7 滴", "10 mL", "60 mL"]) expect(recipe.getByText(text)).toBeTruthy();
    const text = screen.getByLabelText("光之祭司已知配方").textContent;
    for (const boundary of ["不补编克重", "不另加纯水", "调配顺序未完整核实", "六件原材料耗用后才产生对应独立原瓶"]) expect(text).toContain(boundary);
    expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
  });

  it("forwards exact public acquisition and paid ritual commands without manufacturing a bottle or travel", async () => {
    const commands: PriestOfLightCommand[] = [{ type: "LEARN_FORMULA" }, { type: "MATERIAL_WORK", batchId: "priest-of-light-batch-3" },
      { type: "BUY_MATERIALS", batchId: "priest-of-light-batch-3" }, { type: "BREW", batchId: "priest-of-light-batch-3" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }, { type: "REQUEST_RITUAL" }, { type: "GO_RITUAL" }];
    const labels = ["学习配方", "第三批第五步劳务", "取得第三批六件原材料", "实际调配第三批原瓶", "申请下一批", "登记真实到货", "预约下一周仪式", "支付原往返路线并到地窖"];
    const costs = ["460便士 · 1行动", "1行动 · 五步累计抵4200便士", "600便士 · 0行动", "100便士 · 1行动", "1行动 · 下一周", "0行动", "1行动", "180便士 · 1行动 · 预付往返"];
    const value = priestOfLight({ actions: commands.map((command, i) => action(command, labels[i]!, true, costs[i]!)) });
    const { onCommand, rerender } = panel(value);
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    commands.forEach((command, i) => expect(onCommand.mock.calls[i]![0]).toBe(command));
    expect(screen.getByText("原导师处")).toBeTruthy(); expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
    const begin = action({ type: "BEGIN_RITUAL" }, "付原协助费用并实际埋入原冰", true, "120便士 · 0行动");
    const chamber = { ...value, insideCase: true, ritual: ritual({ location: "CHAMBER", visits: 1, status: "原身体已实际抵达地窖", helperPresent: true }), actions: [begin] };
    rerender(<PriestOfLightPanel priestOfLight={chamber} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^付原协助费用并实际埋入/ }));
    expect(onCommand.mock.calls.at(-1)![0]).toBe(begin.command); expect(screen.getByText("原遮光地窖外间")).toBeTruthy();
    expect(screen.getByText("身体当前未埋入原不化坚冰")).toBeTruthy();
    const route = screen.getByRole("region", { name: "光之祭司实际仪式与往返" });
    for (const text of ["180便士", "120便士", "PL5-ICE-1", "普通冰不能替代", "普通遮光", "狭窄仪式通道", "供冰来源、通道与协助安排是抽象", "不能用普通生活、周结或切换卷宗代替返程"]) expect(route.textContent).toContain(text);
  });

  it("opens and cancels each independent original inside ICE at zero AP, restoring keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["priest-of-light-potion-1", "priest-of-light-potion-2", "priest-of-light-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3"); expect(screen.getByText(id)).toBeTruthy();
      expect(screen.getByRole("region", { name: "服药前实际仪式位置" }).textContent).toContain("原不化坚冰中，身体实际被埋入");
      if (id.endsWith("2")) await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
      expect(screen.getByRole("region", { name: "光之祭司实际仪式与往返" }).textContent).toContain("已实际完成普通遮光，无外部光照");
    }
    expect(onCommand).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: /^请原协助者实际解埋/ })).toBeTruthy();
  });

  it("confirms one original with its full four-tier risk and holds the same submission through save failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("priest-of-light-potion-2"));
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.getByText(`来源：${value.bottles[1]!.source}`)).toBeTruthy();
    const riskRegion = screen.getByRole("region", { name: "光之祭司服用风险与四档结果" });
    expect(riskRegion.textContent).toContain(risk);
    for (const tier of ["大成功", "成功", "失败", "灾难"]) expect(riskRegion.textContent).toContain(tier);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第2瓶光之祭司魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    rerender(<PriestOfLightPanel priestOfLight={value} resources={resources} busy={false} error={{ message: "本次服药保存失败。", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("当前仍显示上次已保存的记录");
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByText("priest-of-light-potion-2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<PriestOfLightPanel priestOfLight={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第2瓶光之祭司魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "光之祭司能力与消化" })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it.each(["大成功", "成功", "失败", "灾难"])("keeps actual zero-AP unburial and prepaid return after committed %s", async (tier) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("priest-of-light-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第1瓶光之祭司魔药」" }));
    const exit = value.actions.at(-1)!; const promoted = tier === "大成功" || tier === "成功";
    const second = { ...value.actions[1]!, enabled: false, reason: "本次赴仪式已服一瓶；须实际返程并另约下一真实周。" };
    const result = `已耗用 · ${tier}，仍须由原协助者实际解埋`;
    const consumed: PriestOfLightProjection = { ...value, promoted, ritual: { ...value.ritual, consumptions: 1 },
      bottles: value.bottles.map((bottle, i) => i === 0 ? { ...bottle, status: result } : bottle), actions: promoted ? [exit] : [second, exit] };
    rerender(<PriestOfLightPanel priestOfLight={consumed} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶光之祭司魔药的服用确认" })).toBeNull(); expect(screen.getByText(result)).toBeTruthy();
    if (!promoted) expect(bottleButton("priest-of-light-potion-2").disabled).toBe(true);
    const exitButton = screen.getByRole("button", { name: /^请原协助者实际解埋/ }) as HTMLButtonElement;
    expect(exitButton.disabled).toBe(false); await userEvent.click(exitButton);
    expect(screen.getByText("原不化坚冰中，身体实际被埋入")).toBeTruthy(); expect(screen.getByText("身体已实际埋入同一原不化坚冰")).toBeTruthy();
    const back = action({ type: "RETURN_GUIDE" }, "沿预付原普通路线回导师处", true, "0行动 · 0灵性 · 不再付往返费");
    const chamber = { ...consumed, ritual: { ...consumed.ritual, location: "CHAMBER" as const, darkness: false, nonMeltingIce: false, status: "已由原协助者实际解埋" }, actions: [back] };
    rerender(<PriestOfLightPanel priestOfLight={chamber} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("原遮光地窖外间")).toBeTruthy(); expect(screen.getByText("当前未处于完整遮光中")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^请原协助者实际解埋/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^沿预付原普通路线/ })); expect(screen.getByText("原遮光地窖外间")).toBeTruthy();
    rerender(<PriestOfLightPanel priestOfLight={{ ...chamber, insideCase: false, ritual: { ...chamber.ritual, location: "GUIDE", helperPresent: false, status: "已实际回原导师处" }, actions: [] }} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("原导师处")).toBeTruthy(); expect(screen.getByText(result)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, exit.command, back.command]);
  });

  it("offers actual zero-AP unburial before consuming any bottle", async () => {
    const value = bottled(); const exit = value.actions.at(-1)!;
    const { onCommand } = panel({ ...value, actions: [exit], bottles: [] });
    await userEvent.click(screen.getByRole("button", { name: /^请原协助者实际解埋/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(exit.command); expect(screen.getByText("原不化坚冰中，身体实际被埋入")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
  });

  it("never opens an ICE confirmation when the public ritual location changes to the chamber", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("priest-of-light-potion-2"));
    const chamber = { ...value, ritual: ritual({ location: "CHAMBER", visits: 1, helperPresent: true }) };
    rerender(<PriestOfLightPanel priestOfLight={chamber} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶光之祭司魔药的服用确认" })).toBeNull();
    await userEvent.click(bottleButton("priest-of-light-potion-2"));
    expect(screen.queryByRole("region", { name: "这瓶光之祭司魔药的服用确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("separates actual aura closure, original-owner care and reporting without erasing spirit distress", async () => {
    const perform = action({ type: "PERFORM", caseId: "mixed-company" }, "实际尝试有限净化光环", true, "1行动 · 3灵性 · 意志14");
    const move = action({ type: "MOVE_LANTERN" }, "请原主人带原灯实际移位", true, "0行动 · 普通路线8米");
    const value = priestOfLight({ promoted: true, cases: cases(), practice: practice(), actions: [perform, move] });
    const { onCommand, rerender } = panel(value);
    const lanternRegion = screen.getByRole("region", { name: "光之祭司原灯与净化光环" });
    for (const text of ["近处2米", "范围为5米", "影响友方灵体", "没有因此死亡或被净化消失", "三步分别执行"]) expect(lanternRegion.textContent).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: /^实际尝试有限净化光环/ }));
    expect(screen.getByText("本次净化光环尚未开启")).toBeTruthy();
    const failure = "本次原光环使近处栖灯短暂不适，未完成安全实践；原行动与3灵性已经耗用。";
    const distressed = "栖灯仍因本次原光环不适，尚未由原主人照料";
    const close = action({ type: "CLOSE", caseId: "mixed-company" }, "实际停止本次原净化光环", true, "0行动 · 0灵性");
    const clear = action({ type: "CLEAR_SPIRIT" }, "请原主人普通照料栖灯", false, "0行动");
    const report = { ...action({ type: "REPORT", caseId: "mixed-company" }, "提交本次友好同行实践记录", false), reason: "先停止光环、处理栖灯不适并实际带回原灯。" };
    const open = { ...value, insideCase: true, practice: practice({ aura: "本次原净化光环仍开启", distressed, history: [failure] }),
      cases: cases().map((entry) => entry.id === "mixed-company" ? { ...entry, result: failure, status: "EXAMINED", contactOpen: "本次原接触仍开启" } : entry), actions: [close, clear, report] };
    rerender(<PriestOfLightPanel priestOfLight={open} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^提交本次友好同行/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^请原主人普通照料/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际停止本次原净化光环/ }));
    expect(screen.getByText("本次原净化光环仍开启")).toBeTruthy(); expect(screen.getByText(distressed)).toBeTruthy();
    const closed = { ...open, practice: practice({ aura: "本次原净化光环已停止", distressed, history: [failure] }), actions: [{ ...clear, enabled: true, reason: null }, report] };
    rerender(<PriestOfLightPanel priestOfLight={closed} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "光之祭司成长下一步" }).textContent).toContain(clear.label);
    await userEvent.click(screen.getByRole("button", { name: /^请原主人普通照料/ })); expect(screen.getByText(distressed)).toBeTruthy();
    expect(screen.getByRole("region", { name: "光之祭司实际结果" }).textContent).toContain(failure);
    rerender(<PriestOfLightPanel priestOfLight={{ ...closed, insideCase: false, practice: practice({ aura: "本次原净化光环已停止", history: [failure] }), actions: [] }} resources={emptyResources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("栖灯当前未受光环影响")).toBeTruthy(); expect(screen.getByRole("region", { name: "光之祭司实际结果" }).textContent).toContain(failure);
    expect((screen.getByRole("progressbar", { name: "光之祭司扮演进度" }) as HTMLProgressElement).value).toBe(0);
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([perform.command, close.command, clear.command]);
  });

  it("does not teleport the owner, original lantern or spirit and keeps their actual zero-AP return", async () => {
    const move = action({ type: "MOVE_LANTERN" }, "沿原8米路线移出光环范围", true, "0行动");
    const value = priestOfLight({ promoted: true, cases: cases(), practice: practice(), actions: [move] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^沿原8米路线移出/ })); expect(screen.getByText("主人与原灯中的栖灯在原近处2米")).toBeTruthy();
    const back = action({ type: "RETURN_LANTERN" }, "请主人携原灯与栖灯沿原8米路线回来", true, "0行动 · 0灵性");
    const shelter = { ...value, insideCase: true, actions: [back], practice: practice({ lanternPosition: "原灯与栖灯由主人带到范围外", aura: "本次原光环已停止" }) };
    rerender(<PriestOfLightPanel priestOfLight={shelter} resources={emptyResources} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole("button", { name: /^请主人携原灯与栖灯/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false); await userEvent.click(button); expect(screen.getByText("原灯与栖灯由主人带到范围外")).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("mixed-company");
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([move.command, back.command]);
  });

  it("keeps ordinary slate removal distinct from supernatural cleansing and never regenerates the original trace", async () => {
    const prepare = action({ type: "PREPARE", caseId: "bounded-cleansing", method: "ORDINARY" }, "准备原普通密封容器", true, "1行动 · 不耗灵性");
    const perform = action({ type: "PERFORM", caseId: "bounded-cleansing" }, "请导师实际移走原石板", true, "1行动 · 普通知识核对");
    const trace = "同一原石板的旧死亡残留已被原普通容器封存，未被能力净化。";
    const value = priestOfLight({ promoted: true, cases: cases(), practice: practice(), actions: [prepare, perform] });
    const { onCommand, rerender } = panel(value);
    const current = screen.getByRole("region", { name: "当前光之祭司实践" });
    for (const text of ["不是活人或任意污染", "原普通密封容器", "不冒充能力净化", "不重造残留"]) expect(current.textContent).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: /^准备原普通密封容器/ }));
    await userEvent.click(screen.getByRole("button", { name: /^请导师实际移走原石板/ }));
    expect(screen.queryByRole("region", { name: "光之祭司实际结果" })).toBeNull();
    rerender(<PriestOfLightPanel priestOfLight={{ ...value, actions: [], practice: practice({ history: [trace] }),
      cases: cases().map((entry) => entry.id === "bounded-cleansing" ? { ...entry, result: trace, status: "EXAMINED" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "光之祭司实际结果" }).textContent).toContain(trace);
    await userEvent.selectOptions(screen.getByRole("combobox"), "darkened-walk");
    expect(screen.getByRole("region", { name: "当前光之祭司实践" }).textContent).toContain("原3米暗工作间");
    expect(screen.getByRole("region", { name: "光之祭司原灯与净化光环" }).textContent).toContain(trace);
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([prepare.command, perform.command]);
  });

  it("retains zero-AP withdrawal for preparation without inventing active aura or locking ordinary life", async () => {
    const withdraw = action({ type: "WITHDRAW", caseId: "darkened-walk" }, "撤回原照明准备", true, "0行动");
    const value = priestOfLight({ promoted: true, cases: cases().map((entry) => entry.id === "darkened-walk" ? { ...entry, status: "PREPARED", preparation: "已准备原普通小灯，尚未实际摆放" } : entry), practice: practice(), actions: [withdraw] });
    const { onCommand } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByText("本次净化光环尚未开启")).toBeTruthy(); await userEvent.click(screen.getByRole("button", { name: /^撤回原照明准备/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
  });

  it("never derives open effects or actions from historical prose and blocks mutations on save errors", async () => {
    const history = "原失败：栖灯曾受光环影响，后来原主人已处理本次不适。";
    const value = priestOfLight({ promoted: true, cases: cases(), practice: practice({ history: [history] }) });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox"), "bounded-cleansing");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("bounded-cleansing"); expect(screen.queryByRole("button")).toBeNull();
    const close = action({ type: "CLOSE", caseId: "bounded-cleansing" }, "实际结束原石板接触", true, "0行动");
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<PriestOfLightPanel priestOfLight={{ ...value, insideCase: true, actions: [close] }} resources={emptyResources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      const button = screen.getByRole("button", { name: /^实际结束原石板接触/ }) as HTMLButtonElement;
      expect(button.disabled).toBe(true); fireEvent.click(button); expect(screen.getByText(history)).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps optional human conflict and inherited mastery separate from invented evil tags or higher-sequence powers", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "赴原私家庭院交涉", true, "1行动");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担凯恩原普通棍冲突", true, "1行动 · 真实伤势风险");
    const value = priestOfLight({ promoted: true, cases: cases(), actions: [talk, fight], abilities: [
      { id: "sun.s5.holy-light", label: "有限圣光", mastery: 8, description: "仅作用于当前有限原目标。" },
      { id: "sun.s5.purification-aura", label: "净化光环", mastery: 4, description: "友好灵体也会受到影响。" },
      { id: "sun.s9.praise", label: "原短赞歌", mastery: 67, description: "原知识、掌握与成本保留。" },
    ] });
    const { onCommand } = panel(value);
    const encounter = within(screen.getByRole("region", { name: "光之祭司有限冲突" }));
    expect(encounter.getByText(/凯恩是普通人/).textContent).toContain("不贴“邪恶”标签");
    expect(encounter.getByText(/继承短赞歌仍实际耗费灵性/).textContent).toContain("不创造自我回充");
    await userEvent.click(encounter.getByRole("button", { name: /^赴原私家庭院交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^承担凯恩原普通棍冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    for (const text of ["有限圣光 · 掌握 8", "净化光环 · 掌握 4", "原短赞歌 · 掌握 67"]) expect(screen.getByText(text)).toBeTruthy();
    const boundary = screen.getByLabelText("光之祭司能力边界");
    for (const text of ["不是治疗、复活", "友好灵体", "不是玩家宠物", "序列4无暗领域与非凡特性净化未开放", "不创造不化坚冰"]) expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /无暗领域|复活|免费|创造坚冰/ })).toBeNull();
  });

  it("retains original Notary contracts, tools, rejection, failures, bottles and abilities as read-only history", () => {
    const notary: NotaryProjection = {
      title: "公证人", discovered: true, promoted: true, formulaKnown: true, formula: [{ name: "原已知配方材料", quantity: 5, unit: "克" }], supplies: "原独立材料供给记录",
      story: "原三案真实经过", environment: "原工作间",
      actions: [{ id: "old-sign", label: "不应再次执行原签名", cost: "0行动", enabled: true, reason: null, command: { type: "SIGN", caseId: "signed-tool" } }],
      cases: [{ id: "signed-tool", title: "原工具短契约", story: "本人签名的同一原短契约", status: "RESOLVED", observations: ["原宽泛条款曾被本人拒绝。"],
        preparation: "当时准备本人签名认可的有限归还义务", result: "后来实际归还同一原测量工具，失败和成本保留", contactOpen: "已实际结束", closes: 2 }],
      bottles: [{ id: "notary-potion-1", title: "公证人原瓶", source: "原独立六料批次", status: "原失败与耗用保留", chance: 0,
        command: { type: "CONSUME", bottleId: "notary-potion-1", confirmed: true } }],
      abilities: [{ id: "sun.s6.signed-contract", label: "原本人签名契约", mastery: 67, description: "原签名条件与有限义务保留。" }],
      acting: 100, digestion: "已消化", pollution: 3, risk: "原风险", insideCase: false,
      contract: { signed: true, active: false, tool: "TABLE", fulfilled: true },
    };
    render(<PriestOfLightNotaryHistory notary={notary} />);
    const history = within(screen.getByRole("region", { name: "公证人时期的经历" }));
    expect(history.getByText("原案卷ID：signed-tool")).toBeTruthy(); expect(history.getByText(notary.cases[0]!.observations[0]!)).toBeTruthy();
    expect(history.getByText("原瓶ID：notary-potion-1")).toBeTruthy(); expect(history.getByText("来源：原独立六料批次")).toBeTruthy();
    expect(history.getByText("原失败与耗用保留")).toBeTruthy(); expect(history.getByText("原本人签名契约 · 掌握 67：原签名条件与有限义务保留。")).toBeTruthy();
    const contract = within(history.getByRole("region", { name: "公证人原契约与原工具状态" }));
    for (const text of ["已明确签名认可原短契约", "当前没有生效中的契约义务", "原工作间桌上", "已经实际归还并履行原承诺"]) expect(contract.getByText(text)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByRole("checkbox")).toBeNull();
  });
});
