const { chromium } = require("/opt/codex/cua_node/lib/node_modules/playwright");
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
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:5180");
  await page.getByRole("button", { name: /新建角色/ }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "output/slice-ui/title-1600.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /新建角色/ }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "output/slice-ui/creation-1600.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: "output/slice-ui/creation-1280.png", fullPage: true });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.getByRole("button", { name: /6\s*确认/ }).click();
  await page.getByRole("button", { name: "确认，开始生活" }).click();
  await page.getByRole("heading", { name: "人物卷宗" }).waitFor();
  if (await page.getByRole("dialog").count()) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: "output/slice-ui/origin-event-1600.png",
      fullPage: true,
    });
    await page.getByRole("dialog").getByRole("button").first().click();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "output/slice-ui/dashboard-1600.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /工作，1行动/ }).click();
  await page.getByRole("button", { name: /调查，1行动/ }).click();
  await page.getByRole("button", { name: /核对夜班工钱告示/ }).click();
  await page.getByRole("dialog", { name: "消失的夜班" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "output/slice-ui/case-event-1600.png",
    fullPage: true,
  });
  const measure = () => ({
    bodyWidth: document.body.scrollWidth,
    viewWidth: innerWidth,
    bodyHeight: document.body.scrollHeight,
    viewHeight: innerHeight,
    dialog: (() => {
      const n = document.querySelector(".slice-dialog");
      return n
        ? {
            width: n.clientWidth,
            scrollWidth: n.scrollWidth,
            height: n.clientHeight,
            scrollHeight: n.scrollHeight,
          }
        : null;
    })(),
  });
  console.log("1600event", await page.evaluate(measure));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "output/slice-ui/case-event-1280.png",
    fullPage: true,
  });
  console.log("1280event", await page.evaluate(measure));
  await page.getByRole("button", { name: /核对工资与排班账/ }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "output/slice-ui/dashboard-1280.png",
    fullPage: true,
  });
  console.log("1280dashboard", await page.evaluate(measure));
  await page.getByLabel("放大文字").check();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "output/slice-ui/dashboard-large-1280.png",
    fullPage: true,
  });
  console.log("1280large", await page.evaluate(measure));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "output/slice-ui/dashboard-mobile.png",
    fullPage: true,
  });
  console.log("mobile", await page.evaluate(measure));
  await page.getByRole("button", { name: /完整纪事/ }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "output/slice-ui/chronicle-mobile.png",
    fullPage: true,
  });
  console.log("mobileChronicle", await page.evaluate(measure));
  console.log("errors", errors);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
