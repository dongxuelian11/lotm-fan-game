const { chromium } = require("/opt/codex/cua_node/lib/node_modules/playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const click = async (name) => page.getByRole("button", { name }).click();
  async function newRun() {
    await page.goto("http://127.0.0.1:5180/");
    await click(/新建角色/);
    for (let step = 0; step < 5; step++) await click("下一步");
    await click("确认，开始生活");
    await page.getByRole("dialog").waitFor();
    await page.getByRole("dialog").getByRole("button").last().click();
  }
  async function act(action) {
    await click(new RegExp(`${action}，1行动`));
  }
  async function caseA() {
    await act("工作");
    await act("调查");
    await click(/核对夜班工钱告示/);
    await page.getByRole("dialog", { name: "消失的夜班" }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.getByRole("dialog", { name: "消失的夜班" }).count(),
      1,
    );
    await click(/核对工资与排班账/);
    await act("休养");
    await page.getByRole("dialog", { name: "慈善账与工资账" }).waitFor();
    await click(/接受并共享已证实事实/);
    await click("暂不举报");
  }
  async function caseC() {
    await act("调查");
    await click(/调查旧锅炉房/);
    await page.getByRole("dialog", { name: "沉默的锅炉房" }).waitFor();
  }
  await newRun();
  await caseA();
  await caseC();
  await click(/先疏散工人/);
  await page.getByText("本次试玩内容已完成", { exact: true }).waitFor();
  await page.screenshot({
    path: "output/slice-ui/normal-ending-1600.png",
    fullPage: true,
  });
  console.log("BROWSER_NORMAL_ENDING_PASS");
  await newRun();
  await caseA();
  for (let i = 0; i < 6; i++) await act("休养");
  await page.getByRole("dialog", { name: "管理方准备转移" }).waitFor();
  await click(/放弃追查/);
  await page.getByText("本次试玩内容已完成", { exact: true }).waitFor();
  await page.screenshot({
    path: "output/slice-ui/abandoned-ending-1600.png",
    fullPage: true,
  });
  console.log("BROWSER_ABANDONMENT_PASS");
  let death = false,
    rounds = 0,
    injurySeen = false;
  for (let attempt = 0; attempt < 24 && !death; attempt++) {
    await newRun();
    await caseA();
    await caseC();
    await click(/追踪携铃者/);
    for (let round = 0; round < 40; round++) {
      const dialog = page.getByRole("dialog");
      if (
        await page.getByText("最终死亡 · 周目封存", { exact: true }).count()
      ) {
        death = true;
        break;
      }
      if (await page.getByText("本次试玩内容已完成", { exact: true }).count())
        break;
      const proceed = page.getByRole("button", {
        name: /进入下一回合|查看收尾卷宗|返回生活|查看战斗收尾|继续下一回合|继续战斗|查看本回合结果|确认本回合|回到战斗|继续/,
      });
      if (await proceed.count()) {
        await proceed.first().click();
        continue;
      }
      const attack = page.getByRole("button", { name: /^进攻/ });
      if (await attack.count()) await attack.first().click();
      const resolve = page.getByRole("button", {
        name: /开始本回合|结算本回合|开始转盘|确认姿态/,
      });
      if (await resolve.count()) {
        await resolve.first().click();
        rounds++;
        if (rounds === 2)
          await page.screenshot({
            path: "output/slice-ui/combat-round-1600.png",
            fullPage: true,
          });
      } else {
        const body = await page.locator("body").innerText();
        throw new Error(`No round submit: ${body.slice(-6000)}`);
      }
      if ((await page.locator("body").innerText()).includes("累计风险层数"))
        injurySeen = true;
    }
  }
  assert(
    death,
    "Natural player death did not occur within bounded play sample",
  );
  if (await page.getByRole("button", { name: "查看收尾卷宗" }).count())
    await click("查看收尾卷宗");
  await page.screenshot({
    path: "output/slice-ui/death-ending-1600.png",
    fullPage: true,
  });
  console.log(
    "BROWSER_FINAL_DEATH_PASS",
    JSON.stringify({ rounds, injurySeen }),
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "output/slice-ui/browser-play-report.json",
    JSON.stringify(
      { normal: true, abandoned: true, death, rounds, injurySeen, errors },
      null,
      2,
    ),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
