/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BIZARRO_SORCERER_ABILITIES, BIZARRO_SORCERER_CONSUMPTION_RISK, BIZARRO_SORCERER_FORMULA } from "../../src/domain/bizarro-sorcerer/content";
import type { BizarroSorcererAction, BizarroSorcererCommand, BizarroSorcererProjection } from "../../src/domain/bizarro-sorcerer/types";
import type { MarionettistProjection } from "../../src/domain/marionettist/types";
import { BizarroMarionettistHistory, BizarroSorcererPanel, type BizarroSorcererPanelProps } from "../../src/renderer/BizarroSorcererPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100, spirituality: 12, maxSpirituality: 120, cash: "2镑 3苏勒 4便士", actionsRemaining: 0 };
function action(command: BizarroSorcererCommand, label: string, enabled = true, cost = "本次公开成本"): BizarroSorcererAction {
  return { id: JSON.stringify(command), command, label, enabled, cost, reason: enabled ? null : "当前公开条件未满足。" };
}
function projection(patch: Partial<BizarroSorcererProjection> = {}): BizarroSorcererProjection {
  return {
    title: "诡法师之路", discovered: true, formulaKnown: false, formula: [], promoted: false, supplies: "本批七料仍在原供应方，未取得。",
    actions: [], bottles: [], abilities: [], acting: 0, digestion: "秘偶大师100，晋升后12整周。", pollution: 3,
    risk: BIZARRO_SORCERER_CONSUMPTION_RISK, insideCase: false, environment: "原剧场与原练习点。",
    ritual: { phase: "UNSEEN", mode: "RITUAL", currentTargetId: null, targetName: "尚未勘察", story: "原创G，主要依靠本人谋划与实际能力迎战序列4等价原兽。",
      status: "尚未勘察", source: "原场方登记册的三处原钟院。", equipment: "原灯未点燃，灯油0份、原纸2张、纸人0个；开演需5灵性，纸人替身需原纸人1个及5灵性。",
      witnessesPresent: 0, witnessesExited: 0, viewObstructed: false, unsafe: false, enemySpirituality: 0, veil: false,
      openingComplete: false, killEvidence: null, finaleBottleId: null, attempts: 0, consumedBottleId: null, pendingLead: null, targets: [], actions: [] },
    life: { title: "同一只原鼠与实际灵之虫", source: "容量50，有限原鼠只负载不超过1克原纸签，不生成人形或武器。", environment: "两簇原火相距12米，近远原垫相距6米。", insideCase: false,
      mouse: { id: "BR4-MOUSE-1", status: "唯一原野鼠仍自由活着", alive: true, spirituality: 6, elapsedSeconds: 0, location: "原野地", irreversibleWarning: "完整转化将使同一原鼠真正死亡且不可逆，不会补鼠或复活多恩。" },
      worms: { capacity: 50, split: 0, assigned: 0, recalled: 0, lost: 0, risk: "分出精神−2；召回不退。未召回即解除控制：精神−10、污染+10，实际失虫。" },
      positions: { owner: "近端原垫", mouse: "原野地", tag: "BR4-TAG-1在原携笼", ownerItem: "BR4-CARRIER-1由本人手持" },
      practice: { activeCase: null, ownerAt: "NEAR", tag: { id: "BR4-TAG-1", massGrams: 1, holder: "CARRIER" }, carrier: { id: "BR4-CARRIER-1", holder: "OWNER" }, flamesLit: [false, false], illusionActive: false },
      cases: [] },
    ...patch,
  };
}
function cases(): BizarroSorcererProjection["life"]["cases"] {
  return ["two-flames", "one-way-gift", "paired-positions"].map((id) => ({ id, title: `原物实践${id}`, story: "同一身体与原物必须真实返回，普通比较仍可完成。",
    observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "没有未结束现场", closes: 0 }));
}
const consume = action({ type: "CONSUME_FINALE", bottleId: "bizarro-sorcerer-batch-2:bottle", confirmed: true }, "在当前谢幕服用第二批原瓶", true, "0行动 · 原瓶必耗尽 · 意志28");
const closeRitual = action({ type: "CLOSE_RITUAL" }, "放弃本次饮药，实际收场", true, "0行动 · 保持序列5");
function finale(): BizarroSorcererProjection {
  const value = projection({ formulaKnown: true, formula: [...BIZARRO_SORCERER_FORMULA], actions: [consume, closeRitual] });
  return { ...value, bottles: [{ id: "bizarro-sorcerer-batch-2:bottle", title: "第二批诡法师魔药", source: "第62周由本批七件原料独立调配", status: "已调配，尚未服用", chance: 43, command: consume.command }],
    ritual: { ...value.ritual, phase: "FINALE", currentTargetId: "B4-COPPER-BELL-A", targetName: "铜钟帷幕兽甲", status: "本人真实击杀后的当前谢幕", witnessesPresent: 36,
      openingComplete: true, killEvidence: "B4-COPPER-BELL-A：原身体真实死亡；末轮记录4，本人攻击", finaleBottleId: "bizarro-sorcerer-batch-2:bottle", attempts: 1,
      targets: [{ id: "B4-COPPER-BELL-A", name: "铜钟帷幕兽甲", site: "原甲钟院", status: "真正死亡" }], actions: [closeRitual] } };
}
const complete = action({ type: "COMPLETE_MOUSE_CONTROL", confirmedDeath: true }, "继续12秒完整转化原鼠", true, "0行动 · 主人8灵性 · 死亡不可逆");
const release = action({ type: "RELEASE_MOUSE" }, "实际释放并放生同一活鼠", true, "0行动 · 0灵性");
function captured(): BizarroSorcererProjection {
  const value = projection({ promoted: true, insideCase: true, actions: [complete, release] });
  return { ...value, life: { ...value.life, insideCase: true, mouse: { ...value.life.mouse, status: "3秒初控，原鼠仍然活着", elapsedSeconds: 3, location: "原携笼" } } };
}
function panel(value: BizarroSorcererProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<BizarroSorcererPanel bizarroSorcerer={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
async function openMouse() { await userEvent.click(screen.getByText("同一只原鼠与实际灵之虫 · 可选原鼠与灵之虫")); }
afterEach(cleanup);

describe("BizarroSorcerer public originals, true rite and finite post-promotion practice", () => {
  it("renders exactly seven known ingredients and preserves two unknown canonical quantities", () => {
    const { onCommand } = panel(projection({ formulaKnown: true, formula: [...BIZARRO_SORCERER_FORMULA] }));
    const formula = within(screen.getByLabelText("诡法师已知七料配方"));
    expect(formula.getAllByRole("listitem", { hidden: true })).toHaveLength(7);
    expect(formula.getAllByText("原著未给量")).toHaveLength(2);
    expect(formula.getAllByText("原著未给明确用量；本作G每批供货1份。")).toHaveLength(2);
    for (const text of ["200 mL", "30 g", "10 g", "1 截", "1 个"]) expect(formula.getByText(text)).toBeTruthy();
    for (const material of BIZARRO_SORCERER_FORMULA) expect(formula.getByText(material.name)).toBeTruthy();
    expect(screen.getByText("本批七料仍在原供应方，未取得。")).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not expose unknown formula or undiscovered bottles, and offers no invented ritual completion", () => {
    const value = finale(); panel({ ...value, discovered: false, formulaKnown: false, actions: [], bottles: [], ritual: projection().ritual });
    expect(screen.queryByLabelText("诡法师已知七料配方")).toBeNull();
    expect(screen.queryByRole("button", { name: /服用|完成仪式|跳过战斗/ })).toBeNull();
    expect(screen.getByText(/和平实践不能代替真实谋杀仪式/)).toBeTruthy();
  });

  it("shows one selected original material batch and forwards exact commands without optimistic supplies", async () => {
    const one = action({ type: "MATERIAL_WORK", batchId: "bizarro-sorcerer-batch-1" }, "第一批实际劳务");
    const two = action({ type: "BUY_MATERIALS", batchId: "bizarro-sorcerer-batch-2" }, "第二批实际购入七料");
    const value = projection({ actions: [one, two] }); const { onCommand } = panel(value);
    expect(screen.queryByRole("button", { name: /^第二批/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^第一批/ }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立材料批次" }), "bizarro-sorcerer-batch-2");
    await userEvent.click(screen.getByRole("button", { name: /^第二批/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([one.command, two.command]);
    expect(screen.getByText(value.supplies)).toBeTruthy(); expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
  });

  it("does not count invited adults as arrived or open a prepared bottle before the real finale", async () => {
    const value = finale(); const gather = action({ type: "GATHER_WITNESSES" }, "下一真实周集合原观众", false, "1行动");
    const waiting = { ...value, actions: [{ ...consume, enabled: false, reason: "尚无真实击杀。" }, gather],
      ritual: { ...value.ritual, phase: "PREPARED" as const, status: "第62周已邀请，等待第63周实际到场", witnessesPresent: 0, killEvidence: null, finaleBottleId: null, openingComplete: false, actions: [gather] } };
    const { onCommand, rerender } = panel(waiting);
    const button = screen.getByRole("button", { name: /^下一真实周集合/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.getByText(/实际在场 0 人/)).toBeTruthy(); expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
    const ready = { ...waiting, actions: [{ ...gather, enabled: true, reason: null }], ritual: { ...waiting.ritual, actions: [{ ...gather, enabled: true, reason: null }] } };
    rerender(<BizarroSorcererPanel bizarroSorcerer={ready} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^下一真实周集合/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(gather.command); expect(screen.getByText(/实际在场 0 人/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /等待一键完成|刷新原兽/ })).toBeNull();
  });

  it("shows actual equipment and lethal risk before submitting a distinct confirmed start", async () => {
    const start = action({ type: "START_RITUAL", bottleId: "bizarro-sorcerer-batch-2:bottle", confirmed: true }, "携原瓶开演并迎战", true, "1行动 · 5灵性");
    const value = finale(); const current = { ...value, actions: [start], ritual: { ...value.ritual, phase: "ASSEMBLED" as const, killEvidence: null, finaleBottleId: null, openingComplete: false, actions: [start] } };
    const { onCommand } = panel(current);
    expect(screen.getByLabelText("开战前实际原物与资源").textContent).toContain("纸人0个");
    await userEvent.click(screen.getByRole("button", { name: /^携原瓶开演/ }));
    expect(screen.getByRole("region", { name: "真实战斗死亡风险" }).textContent).toContain("会真实致伤和杀死你");
    expect(onCommand).not.toHaveBeenCalled(); await userEvent.click(screen.getByRole("button", { name: "暂不开战" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^携原瓶开演/ }));
    await userEvent.click(screen.getByRole("button", { name: /^携原瓶开演/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认开演并亲自迎战" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(start.command);
  });

  it("confirms only the exact original finale bottle with real witnesses, kill record, resources and four-tier risk", async () => {
    const value = finale(); const other = action({ type: "CONSUME_FINALE", bottleId: "bizarro-sorcerer-batch-3:bottle", confirmed: true }, "另一瓶不能补喝", false);
    const { onCommand } = panel({ ...value, actions: [...value.actions, other] });
    expect(screen.queryByRole("button", { name: /^另一瓶/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^在当前谢幕服用/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第二批诡法师魔药" }));
    expect(screen.getByText("bizarro-sorcerer-batch-2:bottle")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByRole("region", { name: "同场真实谢幕记录" }).textContent).toContain(value.ritual.killEvidence);
    expect(screen.getByText("36 人")).toBeTruthy();
    expect(screen.getByRole("region", { name: "诡法师服用风险与四档结果" }).textContent).toContain(BIZARRO_SORCERER_CONSUMPTION_RISK);
    const before = within(screen.getByRole("region", { name: "确认前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 120", resources.cash, "0"]) expect(before.getByText(text)).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled(); await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^在当前谢幕服用/ }));
    await userEvent.click(screen.getByRole("button", { name: /^放弃本次饮药/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(closeRitual.command);
  });

  it("submits the same bottle once and preserves its focused confirmation through a retryable save error", async () => {
    const value = finale(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^在当前谢幕服用/ }));
    const confirm = screen.getByRole("button", { name: "确认谢幕服用「第二批诡法师魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume.command);
    rerender(<BizarroSorcererPanel bizarroSorcerer={value} resources={resources} busy={false} error={{ message: "原操作保存失败", retryable: true }} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "暂不服用，返回谢幕" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(confirm); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.getByText("bizarro-sorcerer-batch-2:bottle")).toBeTruthy(); expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    const committed = { ...value, actions: [], bottles: value.bottles.map((bottle) => ({ ...bottle, status: "原瓶已耗尽，排异未晋升" })), ritual: { ...value.ritual, phase: "CLOSED" as const, finaleBottleId: null, consumedBottleId: "bizarro-sorcerer-batch-2:bottle", actions: [] } };
    rerender(<BizarroSorcererPanel bizarroSorcerer={committed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶诡法师魔药的谢幕服用确认" })).toBeNull();
    expect(screen.getByText("原瓶已耗尽，排异未晋升")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("preserves real witness exits and a new unverified lead without manufacturing another kill or opening consumption", async () => {
    const request = action({ type: "REQUEST_NEW_LEAD" }, "请求下一原地点线索", true, "1行动 · 下一真实周领取");
    const receive = action({ type: "RECEIVE_LEAD" }, "领取未核实的新地点线索", false, "0行动");
    const value = projection({ formulaKnown: true });
    const current = { ...value, actions: [request, receive], ritual: { ...value.ritual, phase: "CLOSED" as const, witnessesExited: 36, viewObstructed: true,
      status: "原幕实际遮挡，原观众已经沿石阶退出", pendingLead: "原巡查员提供新地点目击，位格与存活尚待实地核实。", attempts: 3, actions: [request, receive] } };
    const { onCommand } = panel(current); await userEvent.click(screen.getByRole("button", { name: /^请求下一原地点/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(request.command);
    expect(screen.getByText("36 人已沿原退路离开，本场资格失效")).toBeTruthy(); expect(screen.getByText(current.ritual.pendingLead)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^领取未核实/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /服用|复活|刷新原兽/ })).toBeNull();
  });

  it("keeps an optional post-promotion challenge separate from any potion finale", async () => {
    const challenge = action({ type: "START_CHALLENGE", targetId: "B4-COPPER-BELL-B", confirmed: true }, "尝试可选真实实战");
    const value = projection({ promoted: true, actions: [challenge] });
    panel({ ...value, ritual: { ...value.ritual, mode: "CHALLENGE", phase: "SURVEYED", targetName: "铜钟帷幕兽乙", actions: [challenge] } });
    expect(screen.getByRole("heading", { name: "可选实战 · 非晋升仪式" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^尝试可选/ }));
    expect(screen.getByText(/这是晋升后的可选实战/)).toBeTruthy(); expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
  });

  it("keeps optional live capture separate from initial control and irreversible conversion", async () => {
    const capture = action({ type: "CAPTURE_MOUSE" }, "普通活捕唯一原鼠", true, "1行动 · 知识12");
    const value = projection({ promoted: true, actions: [capture] }); const { onCommand } = panel(value); await openMouse();
    await userEvent.click(screen.getByRole("button", { name: /^普通活捕/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(capture.command);
    expect(screen.getByText("仍然活着")).toBeTruthy(); expect(screen.getByText("0 秒")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /初控|完整转化/ })).toBeNull();
    expect(screen.getByText("0 / 0 / 0 / 0")).toBeTruthy(); expect(screen.getByText("50")).toBeTruthy();
  });

  it("focuses separate death confirmation and cancellation returns to the same actual living release", async () => {
    const { onCommand } = panel(captured()); await openMouse(); await userEvent.click(screen.getByRole("button", { name: /^继续12秒/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "这只原鼠将真正死亡且不可逆" }));
    expect(screen.getByRole("region", { name: "原鼠不可逆死亡风险" }).textContent).toContain("已实际控制 3 秒");
    expect(screen.queryByRole("checkbox")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^继续12秒/ }));
    expect((screen.getByLabelText("有限原鼠与实际灵之虫") as HTMLDetailsElement).open).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际释放/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(release.command);
  });

  it("keeps one exact confirmed mouse-death intent locked until its saved result, including save failure", async () => {
    const value = captured(); const { onCommand, rerender } = panel(value); await openMouse();
    await userEvent.click(screen.getByRole("button", { name: /^继续12秒/ }));
    const confirm = screen.getByRole("button", { name: "确认不可逆死亡并尝试完整转化" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "COMPLETE_MOUSE_CONTROL", confirmedDeath: true });
    rerender(<BizarroSorcererPanel bizarroSorcerer={value} resources={resources} busy={false} error="保存失败，原操作待重试" onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "取消，暂不完整转化" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(confirm); expect(onCommand).toHaveBeenCalledTimes(1);
    const committed = { ...value, actions: [], insideCase: false, life: { ...value.life, insideCase: false, mouse: { ...value.life.mouse, alive: false, elapsedSeconds: 15, status: "同一已死原鼠仍受控" } } };
    rerender(<BizarroSorcererPanel bizarroSorcerer={committed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "原鼠完整转化的不可逆死亡确认" })).toBeNull();
    expect(screen.getByText("15 秒")).toBeTruthy(); expect(screen.getByText("真正死亡，不可逆")).toBeTruthy();
  });

  it("shows actual finite worm counts, one-way costs and a separate real-loss confirmation", async () => {
    const dismiss = action({ type: "DISMISS_MOUSE", confirmedLoss: true }, "解除控制并失去尚未召回的虫", true, "0行动 · 精神−10 · 污染+10");
    const value = captured(); const current = { ...value, actions: [dismiss], life: { ...value.life, mouse: { ...value.life.mouse, alive: false, elapsedSeconds: 15 },
      worms: { ...value.life.worms, split: 1, assigned: 1 } } };
    const { onCommand } = panel(current); await openMouse(); expect(screen.getByText("1 / 1 / 0 / 0")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^解除控制并失去/ }));
    expect(screen.getByRole("region", { name: "灵之虫实际损失风险" }).textContent).toContain("精神−10、污染+10");
    expect(onCommand).not.toHaveBeenCalled(); await userEvent.click(screen.getByRole("button", { name: "确认放弃原秘偶并承担实际损失" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(dismiss.command);
  });

  it.each(["two-flames", "paired-positions"] as const)("keeps %s original positions, individual outbound/return commands and 0-AP ordinary return", async (id) => {
    const outbound = action(id === "two-flames" ? { type: "FLAME_OUT" } : { type: "SWAP_OUT" }, "真实去程", false, id === "two-flames" ? "0行动 · 3灵性" : "0行动 · 2灵性");
    const back = action(id === "two-flames" ? { type: "FLAME_BACK" } : { type: "SWAP_BACK" }, "真实能力返程", false, "0行动 · 灵性不足");
    const ordinary = action({ type: "RETURN_ORDINARY" }, "沿原路普通返回并收原物", true, "0行动 · 0灵性");
    const close = action({ type: "CLOSE", caseId: id }, "实际收束本现场", false);
    const value = projection({ promoted: true, insideCase: true, actions: [outbound, back, ordinary, close] });
    const current = { ...value, life: { ...value.life, insideCase: true, cases: cases().map((entry) => entry.id === id ? { ...entry, status: "ACTIVE", result: "去程已经发生，原身体仍在远端。" } : entry),
      positions: { ...value.life.positions, owner: "远端原垫", mouse: "近端原垫", tag: "BR4-TAG-1仍由近端同鼠携带", ownerItem: "BR4-CARRIER-1随本人在远端" }, practice: { ...value.life.practice, activeCase: id, ownerAt: "FAR" as const } } };
    const onCommand = vi.fn(); render(<BizarroSorcererPanel bizarroSorcerer={current} resources={{ ...resources, spirituality: 0, mind: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement; expect(selector.value).toBe(id); expect(selector.disabled).toBe(true);
    expect(screen.getByText("BR4-CARRIER-1随本人在远端")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^沿原路普通返回/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
    expect(screen.getByText("远端原垫")).toBeTruthy(); expect(screen.getByText("去程已经发生，原身体仍在远端。")).toBeTruthy();
  });

  it("keeps actual mouse walking and assigned-worm controls beside the open practice, with no manufactured ordinary mastery", async () => {
    const walk = action({ type: "WALK_MOUSE_FAR" }, "原鼠携签沿地面走到远垫", true, "0行动 · 不施术");
    const assign = action({ type: "ASSIGN_WORM" }, "实际分出一虫沿原线赋入", true, "主人3灵性 · 精神−2");
    const recall = action({ type: "RECALL_WORM" }, "实际召回同一条虫", true, "主人2灵性 · 精神不返还");
    const value = projection({ promoted: true, insideCase: true, actions: [walk, assign, recall] });
    const current = { ...value, life: { ...value.life, cases: cases(), practice: { ...value.life.practice, activeCase: "one-way-gift" as const } } };
    const { onCommand } = panel(current); const region = within(screen.getByRole("group", { name: "当前诡法师实践行动" }));
    for (const label of [/^原鼠携签/, /^实际分出/, /^实际召回/]) await userEvent.click(region.getByRole("button", { name: label }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([walk.command, assign.command, recall.command]);
    expect(screen.getByText(/普通比较不会补记能力施展或掌握/)).toBeTruthy();
  });

  it("locks published actions for busy, blocked, error and read-only states without inventing an AP gate", async () => {
    const value = captured(); const { onCommand, rerender } = panel(value); await openMouse();
    const locks: Pick<BizarroSorcererPanelProps, "busy" | "blocked" | "error" | "readOnly">[] = [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: "等待原存档重试" }, { busy: false, readOnly: true }];
    for (const props of locks) {
      rerender(<BizarroSorcererPanel bizarroSorcerer={value} resources={resources} onCommand={onCommand} {...props} />);
      const button = screen.getByRole("button", { name: /^实际释放/ }) as HTMLButtonElement; expect(button.disabled).toBe(true); fireEvent.click(button);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders every inherited mastery and the two new records without creating new cast buttons", () => {
    const abilities = [{ id: "diviner.s7.flame-jump", label: "原火焰跳跃", mastery: 68, description: "继承原掌握，不新增重复火跳。" },
      { id: "diviner.s5.spirit-threads", label: "原灵体之线", mastery: 40, description: "既有实际掌握保留。" }, ...BIZARRO_SORCERER_ABILITIES.map((entry) => ({ ...entry, mastery: 0 }))];
    panel(projection({ promoted: true, abilities })); const region = within(screen.getByLabelText("诡法师能力与消化"));
    for (const ability of abilities) expect(region.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(region.queryAllByRole("button", { hidden: true })).toHaveLength(0);
  });

  it("keeps the old marionettist body, letter, failed bottle and case histories entirely read-only", () => {
    const old: MarionettistProjection = { title: "旧秘偶大师卷宗", discovered: true, promoted: true, formulaKnown: false, formula: [], supplies: "原六料已消耗。", actions: [{ id: "old", label: "不能重做旧转化", cost: "0行动", enabled: true, reason: null, command: { type: "COMPLETE_CAPTURE", confirmedDeath: true } }],
      bottles: [{ id: "old-bottle", title: "原秘偶大师失败药瓶", source: "原批六料", status: "原瓶耗尽，原失败保留", chance: 42, command: { type: "CONSUME", bottleId: "old-bottle", confirmed: true } }],
      abilities: [{ id: "diviner.s5.spirit-threads", label: "原灵体之线", mastery: 56, description: "实际旧掌握" }], acting: 100, digestion: "原消化完整保留", pollution: 0, risk: "旧风险", cases: [{ id: "living-lines", title: "原灵体之线记录", story: "原志愿者仍活着。", observations: ["真实释放"], preparation: null, result: "已退出并报告", status: "RESOLVED", contactOpen: "原接触已关闭", closes: 1 }], insideCase: false, environment: "原院子",
      ritual: { location: "CLUB", status: "原海岸会面已结束", source: "原成年歌者", summary: "原歌声与往返均保留", singing: false, visits: 2, consumptions: 2 },
      puppet: { title: "多恩原身体", source: "原院子", status: "同一尸体已经失控", summary: "MM5-DORN本人已死，未复活", elapsedSeconds: 300, active: false, alive: false, targetId: "MM5-DORN", body: "原伤势40/100保留", equipment: "原棍仍在原院地面", distance: "原距离122米", note: "MM5-NOTE已交原收件台", irreversibleWarning: "死亡不可逆", canCompleteCapture: false } };
    render(<BizarroMarionettistHistory marionettist={old} />);
    for (const text of [old.puppet.summary, old.puppet.body, old.puppet.equipment, old.puppet.note, "原瓶耗尽，原失败保留", "已退出并报告"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(screen.queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
  });
});
