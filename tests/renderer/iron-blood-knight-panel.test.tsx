/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IronBloodKnightAction, IronBloodKnightCommand, IronBloodKnightProjection } from "../../src/domain/iron-blood-knight/types";
import { createIronBloodTeamState, IRON_BLOOD_COHORT_IDS } from "../../src/domain/iron-blood-knight/team";
import { IRON_BLOOD_KNIGHT_BODY_CHANGE, IRON_BLOOD_KNIGHT_CONSUMPTION_RISK } from "../../src/domain/iron-blood-knight/content";
import type { ReaperProjection } from "../../src/domain/reaper/types";
import { IronBloodKnightPanel, IronBloodReaperHistory } from "../../src/renderer/IronBloodKnightPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 120, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: IronBloodKnightCommand, label = "执行当前公开行动", enabled = true, cost = "当前公开成本"): IronBloodKnightAction {
  return { id: JSON.stringify(command), label, command, enabled, cost, reason: enabled ? null : "当前实际条件尚未满足。" };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取铁血骑士成品指导", true, "1行动 · 500便士");
function team(): IronBloodKnightProjection["team"] {
  const originals = createIronBloodTeamState();
  return {
    title: "原三十人互助队伍", source: "原著仪式；六组与数值为本作G。", environment: "原石院仍为空，三十位原成员均在家。",
    firstJoinedWeek: null, elapsedWeeks: 0, qualified: false, qualification: "尚未加入，不能购买名单代替共同成长。", restRequestedWeek: null,
    cohorts: IRON_BLOOD_COHORT_IDS.map((id, index) => ({ id, title: `第${index + 1}组`, joined: false,
      members: originals.members.filter((member) => member.cohortId === id), successfulActivities: [], activityWeeks: [], lastAttemptWeek: null })),
    exerciseWeeks: [], rite: null, riteHistory: [],
  };
}
function life(): IronBloodKnightProjection["life"] {
  return {
    title: "自身形态与原成员实践", source: "三案原物、可控成本与地面距离为本作G。", environment: "同一原梁、原箱与净空地面通道。", insideCase: false, reflected: false,
    practice: { activeCase: null, form: "HUMAN", ownerNode: "NEAR", linkedMemberIds: [],
      beam: { id: "IB4-BEAM-1", source: "原院12千克训练梁", massKg: 12, holder: "CRADLE" },
      crate: { id: "IB4-CRATE-1", source: "原院14千克训练箱", massKg: 14, holder: "CRADLE" },
      clothes: { id: "IB4-OWNED-CLOTHES", holder: "OWNER" }, route: { id: "IB4-CLEAR-GROUND-ROUTE", distanceMetres: 3, clear: true } },
    cases: ([
      { id: "steel-load", title: "原梁与钢铁承压", story: "12千克原梁仍在托架，本人钢铁姿态仍会受伤。" },
      { id: "linked-carry", title: "两位原战友与原箱", story: "艾达与本尼特须当前愿意并实际到场；准备不是到场。" },
      { id: "flame-clearance", title: "原地面三米去回", story: "沿已知净空地面路径去回，普通步行也可返回。" },
    ] as const).map((entry) => ({ ...entry, observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: false, returned: false, closes: 0 })),
  };
}
function encounter(): IronBloodKnightProjection["encounter"] {
  return {
    title: "可选石院冲突", story: "加里克持自己的原短棍，净空原出口已知。", status: "AVAILABLE", inside: false,
    enemy: { id: "IB4-GARRICK", name: "加里克", age: 38, source: "ORIGINAL_YARD_KEEPER", health: 100, mind: 100,
      status: "RESISTING", weaponId: "IB4-GARRICK-CLUB", weaponLocation: "HAND" }, companions: [], linkedMemberIds: [], actions: [],
  };
}
function projection(patch: Partial<IronBloodKnightProjection> = {}): IronBloodKnightProjection {
  return {
    title: "铁血骑士晋升", discovered: true, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [],
    supplies: "三瓶独立G成品；每瓶原价6200便士，五次实际劳务抵5400，余800。", story: "原著战友情谊仪式与本作原创G实践分别记录。",
    actions: [learn], bottles: [], abilities: [], acting: 0, digestion: "收割者扮演100，已过12/12真实周。", pollution: 3,
    risk: IRON_BLOOD_KNIGHT_CONSUMPTION_RISK, bodyChange: IRON_BLOOD_KNIGHT_BODY_CHANGE,
    originalGender: null, currentGender: "FEMALE", team: team(), life: life(), encounter: encounter(), insideCase: false, environment: "原石院", ...patch,
  };
}
const consume = action({ type: "CONSUME", bottleId: "iron-blood-knight-potion-2", confirmed: true, acceptBodyChange: true }, "核对并服用第二原瓶", true, "0行动 · 原瓶与当前集合必耗用");
const leave = action({ type: "LEAVE_RITE" }, "让三十位原成员实际回家", true, "0行动 · 原费用不退");
function gathered(): IronBloodKnightProjection {
  const value = projection({ actions: [consume, leave], guidanceKnown: true, insideCase: true });
  value.team.firstJoinedWeek = 70; value.team.elapsedWeeks = 8; value.team.qualified = true;
  value.team.qualification = "三十位原成员各自完成三种跨周实践与两次全队演练，当前身体与意愿均达标。";
  value.team.exerciseWeeks = [76, 77];
  for (const cohort of value.team.cohorts) {
    cohort.joined = true; cohort.successfulActivities = ["RESCUE", "WATCH", "SIGNALS"]; cohort.activityWeeks = [71, 72, 73]; cohort.lastAttemptWeek = 73;
    for (const member of cohort.members) {
      member.joined = true; member.joinedWeek = 70; member.present = true; member.location = "YARD"; member.experience = 5;
      member.cohortActivities = [{ activity: "RESCUE", week: 71 }, { activity: "WATCH", week: 72 }, { activity: "SIGNALS", week: 73 }];
      member.exerciseWeeks = [76, 77];
    }
  }
  value.team.rite = { id: "IB4-RITE-2", participantIds: value.team.cohorts.flatMap((cohort) => cohort.members.map((member) => member.id)), arrivedWeek: 78 };
  value.bottles = [{ id: "iron-blood-knight-potion-2", title: "第二瓶铁血骑士魔药", source: "第78周按原独立交接记录取得第二原瓶", status: "已取得，尚未耗用", chance: 43, command: consume.command }];
  return value;
}
function opened(caseId: "steel-load" | "linked-carry" | "flame-clearance"): IronBloodKnightProjection {
  const value = projection({ promoted: true, currentGender: "MALE", originalGender: "FEMALE", insideCase: true, actions: [] });
  value.life.insideCase = true; value.life.practice.activeCase = caseId;
  value.life.cases = value.life.cases.map((entry) => entry.id === caseId ? { ...entry, status: "ACTIVE", contactOpen: true,
    observations: ["原现场已核对。", "原失败保留，已付3灵性且本人健康实际损失2。"], preparation: "只准备这次实际方法，仍须归还原物。", result: "本次真实成本已保存，不自动治疗。" } : entry);
  return value;
}
function panel(value: IronBloodKnightProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<IronBloodKnightPanel ironBloodKnight={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
async function openGroup(number = 1) {
  const detail = screen.getByLabelText(`第${number}组成员与经历`);
  await userEvent.click(within(detail).getByText(new RegExp(`^第${number}组 ·`)));
  return within(detail);
}
async function openBottle() { await userEvent.click(screen.getByRole("button", { name: /^核对并服用第二原瓶/ })); }
const consentLabel = "我已了解并接受本次成功晋升的角色身体变化";
afterEach(cleanup);

describe("Iron Blood Knight actual team, bodily consent and original-object UI", () => {
  it("keeps the full recipe unknown while explaining the real thirty-person ritual and independent supply", () => {
    const value = projection({ formula: [{ name: "未经核实的材料", quantity: 12, unit: "份" }] }); panel(value);
    const summary = screen.getByRole("region", { name: "铁血骑士成长下一步" });
    expect(summary.textContent).toContain("收割者5 → 铁血骑士4");
    expect(summary.textContent).toContain("完整配方与完整仪式布置尚未掌握");
    expect(summary.textContent).toContain("成品供给不取消仪式");
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.queryByText("未经核实的材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /购买名单|直接晋升|一键训练/ })).toBeNull();
  });

  it("shows six collapsed cohorts of five named adult originals without claiming membership or arrival", async () => {
    const join = action({ type: "JOIN_COHORT", cohortId: "G1" }, "当面结识第一组五人", true, "1行动 · 实际见面后各自回家");
    const { onCommand } = panel(projection({ actions: [join] }));
    for (let i = 1; i <= 6; i++) expect((screen.getByLabelText(`第${i}组成员与经历`) as HTMLDetailsElement).open).toBe(false);
    const summary = screen.getByRole("region", { name: "三十名原成员与共同成长" });
    expect(summary.textContent).toContain("实际加入0 / 30 人"); expect(summary.textContent).toContain("实际在院0 人");
    const group = await openGroup();
    expect(group.getAllByRole("listitem")).toHaveLength(5);
    for (const member of createIronBloodTeamState().members.slice(0, 5)) {
      expect(group.getByText(member.name)).toBeTruthy(); expect(group.getByText(new RegExp(`${member.age}岁 · ${member.id}`))).toBeTruthy();
    }
    await userEvent.click(group.getByRole("button", { name: /^当面结识/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(join.command);
    expect(summary.textContent).toContain("实际加入0 / 30 人"); expect(summary.textContent).toContain("实际在院0 人");
  });

  it("keeps completed common history separate from present unwillingness, wounds and six-week qualification", async () => {
    const value = gathered(); value.actions = []; value.team.rite = null;
    value.team.cohorts[0]!.members[0]!.health = 79; value.team.cohorts[0]!.members[0]!.willing = false;
    for (const cohort of value.team.cohorts) for (const member of cohort.members) { member.present = false; member.location = "HOME"; }
    value.team.qualification = "共同经历保留；艾达当前未同意且健康79，不可集合。";
    panel(value);
    expect(screen.getByLabelText("当前仪式资格").textContent).toContain(value.team.qualification);
    expect(screen.getByRole("region", { name: "三十名原成员与共同成长" }).textContent).toContain("当前身体与意愿达标29 / 30 人");
    const group = await openGroup();
    expect(group.getByText(/健康 79 \/ 100/).textContent).toContain("当前未同意合作");
    expect(group.getByText(/已成功共同经历/).textContent).toContain("合力救援、共同守夜、眼神与动作协作");
    expect(group.getAllByText("原经历 5 · 小组经历 3 · 整队演练 2")).toHaveLength(5);
    expect(group.getAllByText("合力救援（第71周）、共同守夜（第72周）、眼神与动作协作（第73周）")).toHaveLength(5);
  });

  it("forwards distinct cohort stories and the actual whole-exercise command with their own gates", async () => {
    const commands: IronBloodKnightCommand[] = [
      { type: "TEAM_ACTIVITY", cohortId: "G1", activity: "RESCUE" }, { type: "TEAM_ACTIVITY", cohortId: "G1", activity: "WATCH" },
      { type: "TEAM_ACTIVITY", cohortId: "G1", activity: "SIGNALS" }, { type: "FULL_EXERCISE" },
    ];
    const labels = ["共同扶正原救援车", "沿原巷口轮换夜哨", "用眼神配合原退路", "三十人共同整队演练"];
    const actions = commands.map((command, index) => action(command, labels[index]!, index === 0, index === 3 ? "1行动 · 60便士" : "1行动 · 20便士"));
    actions[1]!.reason = "本组这周已尝试，须下一真实周。";
    const { onCommand } = panel(projection({ actions })); await openGroup();
    await userEvent.click(screen.getByRole("button", { name: /^共同扶正/ }));
    for (const label of labels.slice(1)) expect((screen.getByRole("button", { name: new RegExp(`^${label}`) }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("本组这周已尝试，须下一真实周。")).toBeTruthy();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[0]);
    expect(screen.getByRole("region", { name: "三十名原成员与共同成长" }).textContent).toContain("已过真实周数0 / 6 周");
  });

  it("shows actual thirty arrivals and zero-action leave without assuming potion use or restoring costs", async () => {
    const value = gathered(); const { onCommand } = panel(value);
    const rite = screen.getByRole("region", { name: "当前实际仪式集合" });
    expect(rite.textContent).toContain("IB4-RITE-2 · 第78周 · 登记 30 位原成员");
    for (const member of createIronBloodTeamState().members) expect(rite.textContent).toContain(member.name);
    await userEvent.click(screen.getByRole("button", { name: /^让三十位原成员/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command);
    expect(rite.textContent).toContain("登记 30 位原成员"); expect(screen.getByText("已取得，尚未耗用")).toBeTruthy();
  });

  it.each(["FEMALE", "MALE"])("requires independent unchecked body-change acceptance for a %s character", async (gender) => {
    const value = gathered(); value.currentGender = gender;
    const { onCommand } = panel(value); await openBottle();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第二瓶铁血骑士魔药" }));
    const checkbox = screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement;
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶铁血骑士魔药」" }) as HTMLButtonElement;
    expect(checkbox.checked).toBe(false); expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    expect(screen.getByRole("region", { name: "角色身体变化的独立确认" }).textContent).toContain("女性角色仅在实际晋升成功后身体变为男性；原本男性角色保持男性。服药失败不改变身体性别。");
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(checkbox); expect(confirm.disabled).toBe(false);
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^核对并服用第二原瓶/ }));
    await openBottle(); expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).checked).toBe(false);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("discloses the exact original bottle, real gathering, resources and all risk tiers before one confirmed intent", async () => {
    const value = gathered(); const { onCommand } = panel(value); await openBottle();
    expect(screen.getByText("iron-blood-knight-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText(`来源：${value.bottles[0]!.source}`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "本次实际三十人仪式" }).textContent).toContain("实际在院 30 人 · 本次仪式登记 30 人");
    expect(screen.getByRole("region", { name: "铁血骑士服用风险与四档结果" }).textContent).toContain(IRON_BLOOD_KNIGHT_CONSUMPTION_RISK);
    const before = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 120", "3", resources.cash, "0"]) expect(before.getByText(text)).toBeTruthy();
    await userEvent.click(screen.getByRole("checkbox", { name: consentLabel }));
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶铁血骑士魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume.command); expect(onCommand.mock.calls[0]![0]).toBe(consume.command);
    expect(onCommand.mock.calls[0]![0]).toEqual({ type: "CONSUME", bottleId: "iron-blood-knight-potion-2", confirmed: true, acceptBodyChange: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("retains accepted body consent and the original intent through save failure, blocking cancellation and duplicate submission", async () => {
    const value = gathered(); const { onCommand, rerender } = panel(value); await openBottle();
    await userEvent.click(screen.getByRole("checkbox", { name: consentLabel }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第二瓶铁血骑士魔药」" }));
    const error = { message: "原服药操作保存失败", retryable: true };
    rerender(<IronBloodKnightPanel ironBloodKnight={{ ...value, actions: [] }} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用，返回当前集合" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(screen.getByRole("button", { name: "确认服用「第二瓶铁血骑士魔药」" }));
    expect(screen.getByText("iron-blood-knight-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<IronBloodKnightPanel ironBloodKnight={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第二瓶铁血骑士魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    const failed = structuredClone(value); failed.actions = []; failed.originalGender = "FEMALE";
    failed.team.rite = null; failed.bottles[0]!.status = "已耗用，原失败保留";
    rerender(<IronBloodKnightPanel ironBloodKnight={failed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶铁血骑士魔药的服用确认" })).toBeNull();
    expect(screen.getByText("已耗用，原失败保留")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("forwards original per-bottle work, payment and real next-week supply commands without optimistic inventory", async () => {
    const commands: IronBloodKnightCommand[] = [{ type: "POTION_WORK", bottleId: "iron-blood-knight-potion-2" },
      { type: "BUY_POTION", bottleId: "iron-blood-knight-potion-2" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["完成第二瓶第五步劳务", "付第二瓶800便士余款", "申请下一批成品", "登记下一真实周原到货"];
    const { onCommand } = panel(projection({ actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
  });

  it("selects the actually open steel case and offers explicit original-tool and form cleanup at zero actions", async () => {
    const value = opened("steel-load"); value.life.practice.form = "STEEL"; value.life.practice.beam.holder = "OWNER";
    const returnTool = action({ type: "RETURN_TOOL" }, "将同一原梁放回托架", true, "0行动 · 0灵性");
    const exitForm = action({ type: "EXIT_FORM" }, "明确退出钢铁形态", true, "0行动 · 0灵性");
    const close = action({ type: "CLOSE", caseId: "steel-load" }, "收束原梁现场", false);
    value.actions = [returnTool, exitForm, close]; const { onCommand } = panel(value);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("steel-load"); expect(selector.disabled).toBe(true);
    const objects = screen.getByRole("region", { name: "铁血骑士当前身体与原物" });
    expect(objects.textContent).toContain("自身钢铁形态"); expect(objects.textContent).toContain("IB4-BEAM-1 · 本人承持");
    expect(screen.getByText("原失败保留，已付3灵性且本人健康实际损失2。")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^将同一原梁/ })); await userEvent.click(screen.getByRole("button", { name: /^明确退出/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([returnTool.command, exitForm.command]);
    expect(objects.textContent).toContain("IB4-BEAM-1 · 本人承持");
    expect((screen.getByRole("button", { name: /^收束原梁现场/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows two real linked originals, their persistent costs and explicit unlink before actual crate return", async () => {
    const value = opened("linked-carry"); value.life.practice.linkedMemberIds = ["IB4-01", "IB4-02"]; value.life.practice.crate.holder = "OWNER";
    for (const member of value.team.cohorts[0]!.members.slice(0, 2)) { member.present = true; member.location = "YARD"; member.health = 99; member.energy = 17; }
    const pulse = action({ type: "LOAD_PULSE" }, "原箱实际传递一次负担", true, "0行动 · 本人2健康 · 每位原战友1健康");
    const stop = action({ type: "STOP_LINK" }, "解除联系并让原两人回家", true, "0行动 · 既有伤势保留");
    value.actions = [pulse, stop]; const { onCommand } = panel(value);
    const objects = screen.getByRole("region", { name: "铁血骑士当前身体与原物" });
    expect(objects.textContent).toContain("已连结原成员艾达、本尼特");
    expect(within(objects).getByText(/艾达 · IB4-01/).textContent).toContain("健康 99 · 精力 17");
    expect(within(objects).getByText(/本尼特 · IB4-02/).textContent).toContain("实际在院");
    await userEvent.click(screen.getByRole("button", { name: /^原箱实际传递/ })); await userEvent.click(screen.getByRole("button", { name: /^解除联系并让/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([pulse.command, stop.command]);
    expect(objects.textContent).toContain("IB4-CRATE-1 · 本人承持");
    expect(within(objects).getByText(/艾达 · IB4-01/).textContent).toContain("健康 99");
  });

  it("retains a distant flame body and same clothes while allowing the zero-spirituality ordinary route", async () => {
    const value = opened("flame-clearance"); value.life.practice.form = "FLAME"; value.life.practice.ownerNode = "FAR";
    const back = action({ type: "FLAME_BACK" }, "另付3灵性火焰返程", false, "0行动 · 3灵性");
    const ordinary = action({ type: "RETURN_ORDINARY" }, "沿同一原地面通路走回", true, "0行动 · 0灵性");
    value.actions = [back, ordinary]; const { onCommand } = panel(value);
    const objects = screen.getByRole("region", { name: "铁血骑士当前身体与原物" });
    expect(objects.textContent).toContain("自身火焰形态"); expect(objects.textContent).toContain("实际位置原远端");
    expect(objects.textContent).toContain("IB4-OWNED-CLOTHES · 仍归本人"); expect(objects.textContent).toContain("IB4-CLEAR-GROUND-ROUTE · 3米");
    expect((screen.getByRole("button", { name: /^另付3灵性/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^沿同一原地面/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(objects.textContent).toContain("实际位置原远端");
  });

  it("preserves optional real combat invitations, solo play and peaceful exit without summoning the ritual team", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "与原看守实际交谈", false, "1行动");
    const call = action({ type: "CALL_COMPANIONS" }, "邀请原01与02到场", true, "1行动");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "按当前在场者真实迎战", true, "1行动");
    const exit = action({ type: "LEAVE_ENCOUNTER" }, "沿原出口和平离开", true, "0行动");
    const value = projection({ promoted: true, actions: [talk, call, fight, exit] });
    value.encounter.status = "READY"; value.encounter.inside = true;
    value.encounter.companions = [{ id: "IB4-01", name: "艾达", health: 92, energy: 14, present: false, eligible: true }, { id: "IB4-02", name: "本尼特", health: 88, energy: 12, present: false, eligible: true }];
    const { onCommand } = panel(value); const scene = screen.getByRole("region", { name: "铁血骑士可选冲突" });
    expect(scene.textContent).toContain("IB4-GARRICK-CLUB");
    expect(within(scene).getByText(/艾达 · IB4-01/).textContent).toContain("健康 92 · 精力 14 · 当前不在场");
    await userEvent.click(within(scene).getByRole("button", { name: /^邀请原01/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(call.command);
    expect(within(scene).getByText(/艾达 · IB4-01/).textContent).toContain("当前不在场");
    expect(within(scene).getByRole("button", { name: /^按当前在场者/ })).toBeTruthy();
    await userEvent.click(within(scene).getByRole("button", { name: /^沿原出口和平/ }));
    expect(onCommand).toHaveBeenLastCalledWith(exit.command);
  });

  it.each(["busy", "blocked", "error", "readOnly"] as const)("locks every public action while %s without altering committed state", async (mode) => {
    const value = projection(); const onCommand = vi.fn();
    render(<IronBloodKnightPanel ironBloodKnight={value} resources={resources} busy={mode === "busy"} blocked={mode === "blocked"}
      readOnly={mode === "readOnly"} error={mode === "error" ? "保存失败" : null} onCommand={onCommand} />);
    const button = screen.getByRole("button", { name: /^听取铁血骑士/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByText(value.supplies)).toBeTruthy();
  });

  it("renders Reaper history as read-only with original failed windows, objects, bottles and mastery", async () => {
    const reaper: ReaperProjection = {
      title: "旧收割者经历", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [], supplies: "旧第五原瓶已实际耗尽。",
      actions: [{ id: "dangerous-old-action", label: "不得重开旧窗口", cost: "0行动", enabled: true, reason: null, command: { type: "SIGNAL", caseId: "moving-shutter" } }],
      bottles: [{ id: "reaper-potion-5", title: "原第五瓶收割者魔药", source: "原第71周供货", status: "原第五瓶已耗用成功", chance: 62, command: { type: "CONSUME", bottleId: "reaper-potion-5", confirmed: true } }],
      abilities: [{ id: "hunter.s5.precision-strike", label: "原精确打击", mastery: 12, description: "原实际掌握未重写。" }], acting: 100, digestion: "原和平100", pollution: 0, risk: "原风险", insideCase: false, environment: "原石院旧场景",
      cases: [{ id: "moving-shutter", title: "原挡片窗口", story: "同一原挡片。", observations: ["原火靶两次失败后成功。"], preparation: "原准备",
        result: "原有限报告已完成。", status: "RESOLVED", contactOpen: "原接触已结束", closes: 3, windowOpen: "原窗口已消耗", practice: "原信号一次，原窗口一次使用。" }],
    };
    render(<IronBloodReaperHistory reaper={reaper} />);
    expect(screen.queryByRole("button", { hidden: true })).toBeNull(); expect(screen.queryByRole("checkbox", { hidden: true })).toBeNull();
    for (const summary of ["原挡片窗口 · 已报告", "收割者原瓶 · 来源与去向", "收割者时期能力记录"]) await userEvent.click(screen.getByText(summary));
    for (const text of ["原火靶两次失败后成功。", "原窗口已消耗", "原信号一次，原窗口一次使用。", "原第五瓶已耗用成功", "原精确打击 · 掌握 12：原实际掌握未重写。"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("不得重开旧窗口")).toBeNull();
  });
});
