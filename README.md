# 诡秘之主同人游戏 · 0.179.0 阶段版

基于《诡秘之主》设定的原创角色单机RPG，使用React、TypeScript、Vite和Electron/SQLite。按周工作、学习、调查与休养，取得魔药并在有限故事与战斗中成长。

当前22条途径包含9→3有限可玩切片，16条接至有限序列2。余下6条序列2与全部序列1/0尚未完成；这不是完整1.0。门、银骑士部分高阶验证使用定向起点，不代表全部路线自然通关。正在继续完成后续阶段；每阶段保留原有失败记录并进行相关回归。

## 安装和启动

需要Node.js24.15–24.x、npm及图形桌面。npm ci会安装锁定依赖；Electron44在首次启动时按需下载桌面运行时，因此首次启动也需要网络。可提前执行 `npx --no-install install-electron` 准备运行时。当前云环境没有进行可见窗口或Windows实机验证。

```sh
npm ci
npm run build
npm start
```

浏览器开发界面可运行 `npm run dev:renderer`。Electron桌面开发使用 `npm run dev`。浏览器内存试玩不是正式持久存档；桌面版通过SQLite保存。Windows和可见Electron窗口尚未实机验证，不将Linux构建通过等同Windows运行通过。

## 测试输入

所有测试源码和原始输入均保留。为避开GitHub单文件限制，历史输入以34个完整文件tar.gz包保存在test-inputs，总压缩约566MB；清单列每包和每个原文件的SHA256。三个短烟测原输入已直接随源码提供。

```sh
npm run typecheck
npm run test:smoke
npm run test:fixture-restore
```

运行全部历史测试前恢复完整输入（需额外约4.0GB空间）：

```sh
npm run fixtures:restore
npm test -- --exclude tests/domain/catastrophe-shared.test.ts --exclude tests/domain/wisdom-angel-life.test.ts --maxWorkers=1 --no-file-parallelism
npm run test:catastrophe-isolated
npm run test:wisdom-angel-life-isolated
```

本次云环境运行天灾共享测试、智慧天使生活测试整文件时出现 worker 意外退出；请分别使用 `npm run test:catastrophe-isolated` 和 `npm run test:wisdom-angel-life-isolated`，将原15个和33个案例逐项放在独立进程运行。两命令核对完整案例名单，任何失败、漏项或异常退出都会返回非零状态。其他测试仍可通过 Vitest 的文件参数分批执行。 `npm run check`仍调用默认整文件测试，受同一限制；在此环境请采用上列分步命令。

恢复脚本使用Node标准库，拒绝不安全路径、损坏包和不同内容覆盖，可安全重试。也可仅恢复某个测试目录，例如：

```sh
npm run fixtures:restore -- --only-prefix calamity-demoness-v01770 --only-prefix unaging-demoness-v01530
```

若只复现177验收中的60个历史输入相关测试，必须同时恢复其旧存档和辅助模块依赖；不能只恢复补充输入包。下面的命令与177发布树验证使用的58个目录一致（298个文件，约232MB展开空间）。完整测试仍使用上面的全量恢复命令。

<details>
<summary>60个相关测试的完整输入恢复命令</summary>

```sh
npm run fixtures:restore -- --only-prefix apothecary-v0130 --only-prefix appraiser-v0180 --only-prefix apprentice-v0350 --only-prefix archaeologist-v0120 --only-prefix artisan-v0760 --only-prefix astrologer-v0370 --only-prefix astronomer-v0980 --only-prefix audience-v080 --only-prefix biologist-v0940 --only-prefix bizarro-sorcerer-v01170 --only-prefix clown-v050 --only-prefix conspirator-v0740 --only-prefix corpsecollector-v0320 --only-prefix crimson-scholar-v0990 --only-prefix cryptologist-v0410 --only-prefix dawn-paladin-v0850 --only-prefix demon-v0890 --only-prefix desire-apostle-v01110 --only-prefix dream-stealer-v01060 --only-prefix dreamwalker-v0970 --only-prefix faceless-v0730 --only-prefix fire-thief-v0840 --only-prefix gatekeeper-v01040 --only-prefix gladiator-v0430 --only-prefix gravedigger-v0330 --only-prefix guardian-v01070 --only-prefix harvestpriest-v0710 --only-prefix hunter-v060 --only-prefix hypnotist-v0750 --only-prefix iron-blood-knight-v01180 --only-prefix magician-v0150 --only-prefix manipulator-v01190 --only-prefix marauder-tool-v0390 --only-prefix marauder-v0380 --only-prefix marionettist-v0950 --only-prefix mindreader-v090 --only-prefix notary-v0810 --only-prefix potion-professor-v0770 --only-prefix priest-of-light-v01030 --only-prefix provoker-v070 --only-prefix psychologist-v0170 --only-prefix pyromaniac-v0160 --only-prefix reaper-v0960 --only-prefix recorder-v0830 --only-prefix release-legacy-output-v0177 --only-prefix savant-v0110 --only-prefix seer-v040 --only-prefix spirit-guide-v0820 --only-prefix spiritmedium-v0340 --only-prefix sunpriest-v0310 --only-prefix swindler-v0400 --only-prefix tamer-v0140 --only-prefix town-v0100 --only-prefix traveler-v01050 --only-prefix trickmaster-v0360 --only-prefix vampire-v0190 --only-prefix warrior-v0420 --only-prefix weaponmaster-v0440
```

</details>

`npm run fixtures:check`只流式验证完整输入，不创建展开副本。完整历史测试类型与全量测试的最终验收状态见发布验收报告，不能把专项通过当全量通过。

贤者专项输入与公开续行：

```sh
npm run fixtures:restore -- --only-prefix prophecy-master-v01540 --only-prefix sage-v01780
npx vitest run tests/domain/sage-acquisition.test.ts tests/domain/sage-life.test.ts tests/domain/sage-combat.test.ts tests/domain/sage-inheritance.test.ts tests/renderer/sage-panel.test.tsx tests/renderer/sage-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
```

秽语长老专项输入与公开续行：

```sh
npm run fixtures:restore -- --only-prefix three-headed-templar-v01550 --only-prefix elder-v01790
npx vitest run tests/domain/elder-acquisition.test.ts tests/domain/elder-life.test.ts tests/domain/elder-combat.test.ts tests/domain/elder-inheritance.test.ts tests/domain/elder-shared.test.ts tests/renderer/elder-panel.test.tsx tests/renderer/elder-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/elder-save.mjs --expected-boundaries 53
```

## 当前验证与限制

177验收时，主工程与干净发布树完整严格类型检查、生产构建均通过。其最终影响范围488个测试文件、8608个断言通过，覆盖全部296个界面文件；其余495个未改测试保留基线通过记录。干净发布树60个历史输入相关文件、466断言，以及48项烟测、17项恢复工具测试通过。全部范围、两项整文件运行限制和未验证内容见[验收报告](docs/RELEASE_ACCEPTANCE.md)。

178增量验证：领域73项、界面53项、旧窥秘链484项、保存工具6项及54个独立SQLite边界通过；完整严格类型、48项烟测、17项恢复工具测试和构建通过。此为相关范围复验，未声称重跑全部992个测试文件。

179增量验证：新增领域82项、界面17项、保存工具6项及53个唯一SQLite边界通过；旧秘祈链24文件441项覆盖后，对失败的过时断言逐项修正并复验。完整严格类型、48项烟测、17项恢复工具、14项CI分片工具与生产构建通过。新增输入包62个文件在独立目录实际恢复并校验。本阶段没有重新运行整个历史测试集。

本版仍有构建大分块警告；可见Electron窗口、Windows实机及全路线自然通关尚未验证。门与银骑士部分高阶使用定向起点。178贤者阶段沿原507条公开命令继续到651条：亲自停止原灾难，第二瓶晋升，两次实际信息通道往返；筛读失败后通过普通核对完成生活事务，战斗第5轮撤退后保留两处重伤并回到生活。阶段记录见[贤者](docs/SAGE_PLAYABLE_STAGE.md)。177阶段原585条公开命令及54命名/50唯一SQLite转换证据见[阶段记录](docs/CALAMITY_DEMONESS_PLAYABLE_STAGE.md)。

## 来源与许可

仓库不包含上传小说全文、个人存档、凭据、node_modules或生成测试输出。原创代码许可和第三方设定/素材权利分别见LICENSE、NOTICE及public/assets/ART_SOURCES.txt。源码、游戏资源和测试输入通过明确清单交付。
