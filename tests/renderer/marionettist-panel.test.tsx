/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FacelessCommand, FacelessProjection } from "../../src/domain/faceless/types";
import { MARIONETTIST_ABILITIES, MARIONETTIST_CONSUMPTION_RISK, MARIONETTIST_FORMULA, MARIONETTIST_RITUAL_SOURCE } from "../../src/domain/marionettist/content";
import type { MarionettistAction, MarionettistCommand, MarionettistProjection } from "../../src/domain/marionettist/types";
import { MarionettistFacelessHistory, MarionettistPanel, type MarionettistPanelProps } from "../../src/renderer/MarionettistPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100, spirituality: 12, maxSpirituality: 100,
  cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: MarionettistCommand, label: string, enabled = true, cost = "本次公开成本"): MarionettistAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件未满足。", command };
}
function projection(patch: Partial<MarionettistProjection> = {}): MarionettistProjection {
  return {
    title: "秘偶大师之路", discovered: true, formulaKnown: false, promoted: false, formula: [], supplies: "",
    actions: [], bottles: [], abilities: [], acting: 0, digestion: "无面人扮演100，晋升后12/12整周。",
    pollution: 3, risk: MARIONETTIST_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "原院子与有限原物。",
    ritual: { location: "CLUB", status: "尚未预约海岸会面", summary: "未出行，未歌唱，未服药。", source: MARIONETTIST_RITUAL_SOURCE, singing: false, visits: 0, consumptions: 0 },
    puppet: { title: "同一原身体与真实控制", source: "新晋容量1，完整秘偶操控100米；两次抗拒判定为G。", status: "没有秘偶或已结算的原身体",
      summary: "只有本场战败且仍活着的多恩可尝试。", elapsedSeconds: 0, active: false, alive: null, targetId: null,
      body: "没有复制身体。", equipment: "没有新造装备。", distance: "没有可操控原身体。", note: "原信MM5-NOTE仍在原信台，交付0次。",
      irreversibleWarning: "完整转化成功意味着多恩本人真正死亡，无法撤销或复活；解除控制与超距只会留下死物。", canCompleteCapture: false },
    ...patch,
  };
}
const consume = action({ type: "CONSUME", bottleId: "marionettist-batch-2:bottle", confirmed: true }, "服用第二批原瓶", true, "0行动 · 耗用这瓶原药");
function bottled(): MarionettistProjection {
  const value = projection();
  return { ...value, formulaKnown: true, formula: [...MARIONETTIST_FORMULA], actions: [consume],
    bottles: [{ id: "marionettist-batch-2:bottle", title: "第二批秘偶大师魔药", source: "第52周，第二批六件原料独立调配", status: "已调配，尚未服用", chance: 43, command: consume.command }],
    ritual: { ...value.ritual, location: "COAST", status: "成年自愿美人鱼涟正在现场歌唱", summary: "第53周实际到访；这一现场尚未服药。", singing: true, visits: 1 },
  };
}
const complete = action({ type: "COMPLETE_CAPTURE", confirmedDeath: true }, "继续约280秒，完整转化多恩", true, "1行动 · 主人8灵性 · 死亡不可逆");
const release = action({ type: "RELEASE_CONTROL" }, "停止控制并释放活着的多恩", true, "0行动 · 0精神 · 0灵性");
function captured(): MarionettistProjection {
  const value = projection({ promoted: true, actions: [complete, release] });
  return { ...value, puppet: { ...value.puppet, status: "约20秒初控，原人仍活着", summary: "同一身体MM5-DORN仍活着；约20秒初控并非完整秘偶。",
    elapsedSeconds: 20, alive: true, targetId: "MM5-DORN", body: "原身体完整度60/100，原伤势1项，自身灵性15/15。",
    equipment: "原棍MM5-DORN-CLUB在原院地面，未进入主人库存。", distance: "主人与原身体2米。", canCompleteCapture: true } };
}
function cases(): MarionettistProjection["cases"] {
  return (["living-lines", "controlled-release", "break-contact"] as const).map((id) => ({
    id, title: `和平实践${id}`, story: "成年志愿者同意有限实践，并能撤回原同意。", status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始接触", closes: 0,
  }));
}
function panel(value: MarionettistProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<MarionettistPanel marionettist={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Marionettist real originals, ritual and explicit irreversible capture", () => {
  it("distinguishes the three unknown canonical amounts from G supplied portions in exactly six ingredients", () => {
    const { onCommand } = panel(projection({ formulaKnown: true, formula: [...MARIONETTIST_FORMULA], supplies: "第二批六料仍在原供应者处，劳务4/5，尚未取得。" }));
    const formula = within(screen.getByLabelText("秘偶大师已知配方"));
    expect(formula.getAllByRole("listitem", { hidden: true })).toHaveLength(6);
    expect(formula.getAllByText("原著未给量")).toHaveLength(3);
    expect(formula.getAllByText("原著未给明确用量；本作G每批供货1份。")).toHaveLength(3);
    for (const amount of ["80 mL", "10 g", "1 对"]) expect(formula.getByText(amount)).toBeTruthy();
    for (const material of MARIONETTIST_FORMULA) expect(formula.getByText(material.name)).toBeTruthy();
    expect(screen.getByText("第二批六料仍在原供应者处，劳务4/5，尚未取得。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /服用|秘偶化/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards each original batch command without inventing a ready bottle or changing supply locally", async () => {
    const commands: MarionettistCommand[] = [{ type: "LEARN_FORMULA" }, { type: "MATERIAL_WORK", batchId: "marionettist-batch-2" },
      { type: "BUY_MATERIALS", batchId: "marionettist-batch-2" }, { type: "BREW", batchId: "marionettist-batch-2" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["学习配方", "完成本批劳务", "取得本批六料", "调配本批原瓶", "请求新批次", "确认新批次到货"];
    const { onCommand } = panel(projection({ actions: commands.map((command, index) => action(command, labels[index]!)), supplies: "尚未取得材料。" }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByText("尚未取得材料。")).toBeTruthy(); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("waits for a real later-week projection after booking rather than inventing a WAIT shortcut or travel", async () => {
    const book = action({ type: "REQUEST_RITUAL" }, "预约成年自愿美人鱼涟", true, "1行动 · 最早下一真实周");
    const value = projection({ formulaKnown: true, actions: [book] }); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^预约成年自愿/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(book.command);
    const go = { ...action({ type: "GO_RITUAL" }, "按预约实际出行", false, "1行动 · 80便士"), reason: "第52周预约，最早第53周才能实际出发。" };
    const waiting = { ...value, actions: [go], ritual: { ...value.ritual, status: "第52周已预约，正在等下一真实周", summary: "仍在俱乐部，没有提前取得现场歌声。" } };
    rerender(<MarionettistPanel marionettist={waiting} resources={resources} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole("button", { name: /^按预约实际出行/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.getByText("占卜俱乐部")).toBeTruthy(); expect(screen.getByText("当前没有现场歌声")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /WAIT|直接过周|跳过/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<MarionettistPanel marionettist={{ ...waiting, actions: [{ ...go, enabled: true, reason: null }] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(onCommand).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /^按预约实际出行/ }));
    expect(onCommand).toHaveBeenLastCalledWith(go.command);
    expect(screen.getByText(MARIONETTIST_RITUAL_SOURCE)).toBeTruthy();
  });

  it("shows the exact original bottle, live song, four-tier risk and resources before confirmation; cancel spends nothing", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二批秘偶大师魔药」" }));
    expect(screen.getByText("marionettist-batch-2:bottle")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：第52周，第二批六件原料独立调配")).toBeTruthy();
    expect(screen.getByRole("region", { name: "秘偶大师服用风险与四档结果" }).textContent).toContain(MARIONETTIST_CONSUMPTION_RISK);
    expect(screen.getByRole("region", { name: "服药现场歌声" }).textContent).toContain("成年自愿美人鱼涟正在现场歌唱");
    const before = within(screen.getByRole("region", { name: "确认前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 100", resources.cash, "0"]) expect(before.getByText(text)).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled(); await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第二批秘偶大师魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("submits one exact bottle command and preserves it under pending save failure without a second confirmation or cancel", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第二批秘偶大师魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume.command);
    const error = { message: "保存失败，重试原操作。", retryable: true };
    rerender(<MarionettistPanel marionettist={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第二批秘偶大师魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("marionettist-batch-2:bottle")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    const failed = { ...value, actions: [], bottles: value.bottles.map((bottle) => ({ ...bottle, status: "原瓶已耗尽，严重排异未晋升。" })) };
    rerender(<MarionettistPanel marionettist={failed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶秘偶大师魔药的服用确认" })).toBeNull();
    expect(screen.getByText("原瓶已耗尽，严重排异未晋升。")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("keeps 0-AP song stopping and actual return available with exhausted resources after consumption", async () => {
    const stop = action({ type: "END_SONG" }, "实际停止现场歌唱", true, "0行动 · 0精神 · 0灵性");
    const back = action({ type: "RETURN_CLUB" }, "按已付原路返回俱乐部", true, "0行动 · 0精神 · 0灵性");
    const value = bottled(); const current = { ...value, promoted: true, actions: [stop, back], ritual: { ...value.ritual, consumptions: 1 } };
    const onCommand = vi.fn(); render(<MarionettistPanel marionettist={current} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^实际停止现场歌唱/ }));
    await userEvent.click(screen.getByRole("button", { name: /^按已付原路返回/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([stop.command, back.command]);
    expect(screen.getByText("海岸水湾现场")).toBeTruthy(); expect(screen.getByText("正在现场歌唱")).toBeTruthy();
  });

  it.each(["living-lines", "controlled-release", "break-contact"] as const)("uses the actual public 0-AP release for %s, preserving failure and locking the active scene", async (caseId) => {
    const close = action({ type: "CLOSE", caseId }, "实际释放并结束本次接触", true, "0行动 · 0精神 · 0灵性");
    const value = projection({ promoted: true, insideCase: true, cases: cases().map((entry) => entry.id === caseId
      ? { ...entry, status: "EXAMINED", result: "本次控制失败，灵性已付，尚待实际释放。", contactOpen: "本次接触尚未结束" } : entry), actions: [close] });
    const onCommand = vi.fn(); render(<MarionettistPanel marionettist={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe(caseId); expect(selector.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际释放并结束/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command); expect(screen.getByText("本次控制失败，灵性已付，尚待实际释放。")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "同一原身体与秘偶状态" })).toBeNull();
  });

  it("does not manufacture a puppet from a successful peaceful practice", async () => {
    const perform = action({ type: "PERFORM", caseId: "controlled-release" }, "实际尝试有限初控");
    const value = projection({ promoted: true, cases: cases().filter((entry) => entry.id === "controlled-release"), actions: [perform] });
    const { onCommand, rerender } = panel(value); await userEvent.click(screen.getByRole("button", { name: /^实际尝试/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(perform.command);
    expect(screen.queryByRole("region", { name: "秘偶大师实际实践结果" })).toBeNull();
    rerender(<MarionettistPanel marionettist={{ ...value, actions: [], cases: value.cases.map((entry) => ({ ...entry, result: "有限初控成功；原志愿者仍然活着，尚未释放。" })) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("有限初控成功；原志愿者仍然活着，尚未释放。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /完整转化|递信/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "同一原身体与秘偶状态" })).toBeNull();
  });

  it("starts only the published resisted 20-second attempt and never adds a completion action before its committed result", async () => {
    const begin = action({ type: "BEGIN_CAPTURE" }, "对投降且活着的多恩尝试20秒初控", true, "1行动 · 3灵性 · 可被抗拒");
    const value = captured(); const initial = { ...value, actions: [begin, release], puppet: { ...value.puppet, elapsedSeconds: 0, canCompleteCapture: false } };
    const { onCommand } = panel(initial); await userEvent.click(screen.getByRole("button", { name: /^对投降且活着/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(begin.command);
    expect(screen.queryByRole("button", { name: /完整转化/ })).toBeNull();
    expect(screen.getByText("0 秒")).toBeTruthy(); expect(screen.getByText("仍然活着")).toBeTruthy();
  });

  it("requires a separate focused irreversible-death confirmation and lets cancellation return to a real 0-AP living release", async () => {
    const value = captured(); const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^继续约280秒/ }));
    const heading = screen.getByRole("heading", { name: "此人将真正死亡且不可逆" }); expect(document.activeElement).toBe(heading);
    expect(screen.getByRole("region", { name: "原人不可逆死亡风险" }).textContent).toContain("不等于本人同意");
    expect(screen.queryByRole("checkbox")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "取消，暂不完整转化" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^继续约280秒/ }));
    expect(screen.getByText("20 秒")).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^停止控制并释放/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(release.command);
    expect(screen.getByText("仍然活着")).toBeTruthy();
  });

  it("submits the exact confirmed death intent once and keeps the same pending confirmation locked through save failure", async () => {
    const value = captured(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^继续约280秒/ }));
    const confirm = screen.getByRole("button", { name: "确认不可逆死亡并尝试完整转化" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "COMPLETE_CAPTURE", confirmedDeath: true });
    const error = { message: "保存失败，原操作待重试。", retryable: true };
    rerender(<MarionettistPanel marionettist={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "取消，暂不完整转化" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(screen.getByRole("button", { name: "确认不可逆死亡并尝试完整转化" }));
    expect(screen.getByText(value.puppet.summary)).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    const committed = { ...value, actions: [], puppet: { ...value.puppet, alive: false, active: true, elapsedSeconds: 300, canCompleteCapture: false,
      status: "原人已死，同一身体受控", summary: "MM5-DORN本人真正死亡且不可逆，同一身体仍在原院子。" } };
    rerender(<MarionettistPanel marionettist={committed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "完整秘偶化的不可逆死亡确认" })).toBeNull();
    expect(screen.getByText("真正死亡，不可逆")).toBeTruthy(); expect(screen.getByText("300 秒")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it.each(["真实战死，不能秘偶化", "活着自行离开，不能重试", "原人已死，身体已失控成死物"])("does not invent capture actions for %s", (status) => {
    const value = captured(); const { onCommand } = panel({ ...value, actions: [], puppet: { ...value.puppet, status,
      alive: status.startsWith("活着"), canCompleteCapture: false } });
    expect(screen.getByText(status)).toBeTruthy(); expect(screen.queryByRole("button", { name: /初控|完整转化|释放|递信/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves the same body, original club and delivered original note when range loss leaves an inert body", async () => {
    const deliver = action({ type: "PUPPET_DELIVER" }, "用原身体递送同一原信", true, "0行动 · 主人2灵性 · 原身体1灵性 · 原转化事项唯一短检验");
    const dismiss = action({ type: "DISMISS_PUPPET" }, "解除完整秘偶控制", true, "0行动 · 不复活");
    const leave = action({ type: "MOVE_BEYOND_RANGE" }, "沿原路步行120米离开", true, "1行动 · 原身体留原位");
    const value = captured(); const controlled = { ...value, actions: [deliver, dismiss, leave], puppet: { ...value.puppet, elapsedSeconds: 300, active: true, alive: false,
      status: "原人已死，同一身体受控", summary: "MM5-DORN本人已死，唯一原身体受控。", canCompleteCapture: false } };
    const { onCommand, rerender } = panel(controlled);
    for (const text of [controlled.puppet.body, controlled.puppet.equipment, controlled.puppet.note]) expect(screen.getByText(text)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^用原身体递送/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(deliver.command); expect(screen.getByText(controlled.puppet.note)).toBeTruthy();
    const inert = { ...controlled, actions: [], puppet: { ...controlled.puppet, active: false, status: "原人已死，身体已失控成死物",
      distance: "主人距原身体122米，超过100米已失控。", note: "同一MM5-NOTE已实际交到原收件台，交付1次；身体沿8米原路返回，未复制信。" } };
    rerender(<MarionettistPanel marionettist={inert} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(inert.puppet.note)).toBeTruthy(); expect(screen.getByText(inert.puppet.equipment)).toBeTruthy(); expect(screen.getByText(inert.puppet.body)).toBeTruthy();
    expect(screen.getByText("真正死亡，不可逆")).toBeTruthy(); expect(screen.queryByRole("button", { name: /递送|控制|离开/ })).toBeNull();
  });

  it("locks public actions on busy, blocked, save error and read-only states without independently requiring AP", () => {
    const value = captured(); const { onCommand, rerender } = panel(value);
    const locks: Pick<MarionettistPanelProps, "busy" | "blocked" | "error" | "readOnly">[] = [
      { busy: true }, { busy: false, blocked: true }, { busy: false, error: "等待原存档重试" }, { busy: false, readOnly: true },
    ];
    for (const props of locks) {
      rerender(<MarionettistPanel marionettist={value} resources={resources} onCommand={onCommand} {...props} />);
      const button = screen.getByRole("button", { name: /^停止控制并释放/ }) as HTMLButtonElement;
      expect(button.disabled).toBe(true); fireEvent.click(button);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps every inherited ability and two new mastery records without fabricating ability buttons", () => {
    const abilities = [{ id: "diviner.s9.spirit-vision", label: "原灵视", mastery: 95, description: "原占卜家实际掌握保留。" },
      { id: "diviner.s8.balance", label: "原平衡", mastery: 120, description: "原小丑实际掌握保留。" },
      { id: "diviner.s7.illusion", label: "原幻术", mastery: 55, description: "原魔术师实际掌握保留。" },
      { id: "diviner.s6.appearance-change", label: "原外貌重塑", mastery: 77, description: "原无面人实际掌握保留。" },
      ...MARIONETTIST_ABILITIES.map((ability) => ({ ...ability, mastery: 0 }))];
    panel(projection({ promoted: true, abilities }));
    const region = within(screen.getByRole("region", { name: "秘偶大师能力与消化" }));
    for (const ability of abilities) expect(region.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(region.queryAllByRole("button")).toHaveLength(0);
  });

  it("keeps faceless history and actual identity/outfit facts, allowing only the three published inherited controls", async () => {
    const commands: FacelessCommand[] = [{ type: "RESTORE_SELF" }, { type: "CHANGE_APPEARANCE", templateId: "STAGE_DOUBLE" }, { type: "RETURN_OUTFIT" }, { type: "REFLECT" }];
    const labels = ["明确恢复原貌", "采用原成年模板", "实际归还同一原衣", "不可重做的旧反思"];
    const faceless: FacelessProjection = { title: "无面人旧卷宗", discovered: true, promoted: true, formulaKnown: false, formula: [], supplies: "原材料均已消耗。",
      bottles: [{ id: "old-bottle", title: "无面人原瓶", source: "原六料同批调配", status: "已耗尽，旧失败保留", chance: 43, command: { type: "CONSUME", bottleId: "old-bottle", confirmed: true } }],
      actions: commands.map((command, index) => ({ id: `old-${index}`, command, label: labels[index]!, cost: "0行动 · 真实成本", enabled: true, reason: null })),
      abilities: [{ id: "diviner.s6.appearance-change", label: "原外貌重塑", mastery: 77, description: "持续变化仍存在。" }],
      acting: 100, digestion: "原无面人消化100。", pollution: 3, risk: "原风险", cases: [{ id: "remember-self", title: "记住本人", story: "原本人身份没有变化。",
        observations: ["当时的原观察。"], preparation: null, result: "原失败仍保留。", status: "RESOLVED", contactOpen: "原接触已结束", closes: 2 }], insideCase: false, environment: "",
      appearance: { templateId: "STAGE_DOUBLE", label: "成年排练替身", voice: "原成年模板声音", summary: "外貌声线仍持续，本人经历未变。", source: "已获同意的原成年模板", heightOffsetCm: 5, persistent: true },
      outfit: { id: "FC6-PROP-COAT-1", label: "原排练道具服", location: "本人持有", summary: "同一原衣借出1次，归还0次。" } };
    const onCommand = vi.fn(); const { rerender } = render(<MarionettistFacelessHistory faceless={faceless} onCommand={onCommand} />);
    for (const text of [faceless.appearance.voice, faceless.appearance.summary, faceless.outfit.id, faceless.outfit.summary, "已耗尽，旧失败保留"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /旧反思|服用/ })).toBeNull();
    for (const label of labels.slice(0, 3)) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands.slice(0, 3));
    rerender(<MarionettistFacelessHistory faceless={faceless} blocked onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^明确恢复原貌/ })); expect(onCommand).toHaveBeenCalledTimes(3);
    expect(screen.getByText(faceless.appearance.summary)).toBeTruthy(); expect(screen.getByText(faceless.outfit.summary)).toBeTruthy();
  });
});
