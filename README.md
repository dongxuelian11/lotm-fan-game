# 诡秘之主同人游戏 · 0.190.0 阶段版

基于《诡秘之主》设定的原创角色单机RPG，使用React、TypeScript、Vite和Electron/SQLite。按周工作、学习、调查与休养，取得魔药并在有限故事与战斗中成长。

当前22条途径均包含9→2有限可玩切片。占卜家、猎人、观众、通识者与月亮已有有限序列1基础；其余17条序列1及全部序列0尚未完成；这不是完整1.0。门、银骑士部分高阶验证使用定向起点，不代表全部路线自然通关。正在继续完成后续阶段；每阶段保留原有失败记录并进行相关回归。

## 安装和启动

需要Node.js24.15–24.x、npm及图形桌面。npm ci会安装锁定依赖；Electron44在首次启动时按需下载桌面运行时，因此首次启动也需要网络。可提前执行 `npx --no-install install-electron` 准备运行时。当前云环境没有进行可见窗口验证；Windows GitHub Actions 执行严格类型、烟测和存档回归，桌面实机体验尚未验证。

```sh
npm ci
npm run build
npm start
```

浏览器开发界面可运行 `npm run dev:renderer`。Electron桌面开发使用 `npm run dev`。浏览器内存试玩不是正式持久存档；桌面版通过SQLite保存。Windows桌面和可见Electron窗口尚未实机验证，GitHub Actions 自动检查不代替桌面试玩。

## 测试输入

所有测试源码和原始输入均保留。为避开GitHub单文件限制，历史输入以完整文件tar.gz包保存在test-inputs；包数、体积和原文件总数以当前manifest.json清单为准，清单列每包和每个原文件的SHA256。三个短烟测原输入已直接随源码提供。

```sh
npm run typecheck
npm run test:smoke
npm run test:fixture-restore
```

运行全部历史测试前恢复完整输入（需另预留清单所列原文件的展开空间）：

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

鲜血大公专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix blatherer-v01560 --only-prefix blood-duke-v01800
npx vitest run tests/domain/blood-duke-acquisition.test.ts tests/domain/blood-duke-life.test.ts tests/domain/blood-duke-combat.test.ts tests/domain/blood-duke-inheritance.test.ts tests/domain/blood-duke-shared.test.ts tests/renderer/blood-duke-panel.test.tsx tests/renderer/blood-duke-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/blood-duke-save.mjs --expected-boundaries 64
```

古代邪物专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix silent-disciple-v01570 --only-prefix ancient-evil-v01810
npx vitest run tests/domain/ancient-evil-acquisition.test.ts tests/domain/ancient-evil-life.test.ts tests/domain/ancient-evil-combat.test.ts tests/domain/ancient-evil-inheritance.test.ts tests/domain/ancient-evil-shared.test.ts tests/renderer/ancient-evil-panel.test.tsx tests/renderer/ancient-evil-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/ancient-evil-save.mjs --expected-boundaries 65
```

先知专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix chaos-walker-v01580 --only-prefix fate-prophet-v01820
npx vitest run tests/domain/fate-prophet-acquisition.test.ts tests/domain/fate-prophet-life.test.ts tests/domain/fate-prophet-combat.test.ts tests/domain/fate-prophet-inheritance.test.ts tests/domain/fate-prophet-shared.test.ts tests/renderer/fate-prophet-panel.test.tsx tests/renderer/fate-prophet-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/fate-prophet-save.mjs --expected-boundaries 64
node --expose-gc scripts/play/fate-prophet-save.mjs --key directed --expected-boundaries 11 --tag finance-directed
```

熵之公爵专项输入、公开续行与保存复验：

```sh
npm run fixtures:restore -- --only-prefix frenzy-mage-v01590 --only-prefix entropy-duke-v01830
npx vitest run tests/domain/entropy-duke-acquisition.test.ts tests/domain/entropy-duke-life.test.ts tests/domain/entropy-duke-combat.test.ts tests/domain/entropy-duke-inheritance.test.ts tests/domain/entropy-duke-shared.test.ts tests/renderer/entropy-duke-panel.test.tsx tests/renderer/entropy-duke-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/entropy-duke-stage.mjs
node --expose-gc scripts/play/entropy-duke-save.mjs --expected-boundaries 84
node --expose-gc scripts/play/entropy-duke-save.mjs --key directed --source-directory tests/fixtures/entropy-duke-v01830/directed --expected-boundaries 5
```

公开续行脚本将新记录写入独立的output/play/entropy-duke-01830-*目录，保留原558条死亡记录；保存命令分别检查已交付的84个自然边界和5个明确标注的定向财务边界，定向输入不计入自然路线。这些命令均不等于可见窗口试玩。

## 当前验证与限制

190增量：月亮新增有限序列1美神。原572条活档同种子继续，七次魔药失败后第八瓶成功；身体变化在晋升前单独说明确认。原流灯亲自完成两米搬运并消耗真实精力，遮挡和撤回会关闭未用窗口；两轮可选战斗后对手投降，玩家无伤沿原路离开并工作。详见[美神阶段记录](docs/BEAUTY_GODDESS_PLAYABLE_STAGE.md)。

188增量：观众新增有限序列1作家。原580条洞察者活档同种子续至667条，首瓶晋升；互知线索实际成功、合理安排失败后普通归还，三项生活事务及反思完成。可选新敌五轮战斗中玩家实际死亡，原终档保留；47个唯一转换已完成SQLite回滚、重开、重试与死亡旁档验证。相关36文件484项、32项恢复/CI工具、完整严格类型与生产构建通过；54个新增原始输入独立恢复核验。详见[作家阶段记录](docs/WRITER_PLAYABLE_STAGE.md)。

187增量：猎人新增有限序列1征服者。沿原658条活分支公开命令继续至795条，前两瓶失败、第三瓶成功；原五位疲劳同伴真实付费跨周恢复，两项新能力分别在生活中实际应用，第三项按撤回的许可普通完成。可选新敌八轮战斗后死亡，玩家保留两处轻伤，普通退出后工作跨周，最终第200周ACTIVE、健康80、精神100、灵性120。48个唯一自然边界全部SQLite验证。详见[征服者阶段记录](docs/CONQUEROR_PLAYABLE_STAGE.md)。

186增量验证：占卜家新增有限序列1诡秘侍者，24原身体、六设施、十二个实际生活周及三位外客形成新灵界区域。沿原1038条公开命令继续，首瓶失败、第二瓶成功，三项原物实践实际应用；可选新敌三轮重伤投降，玩家带一处新轻伤普通退出、跨周后工作。44个自然边界/43唯一状态全部SQLite验证；新增11文件128项、12同链文件299项、48项烟测、16项存档回归、严格类型/构建和32项恢复/CI工具通过。49个新原输入独立恢复，48包2197文件hash全部核验；1053文件枚举无漏重，本阶段未全量重跑。详见[诡秘侍者阶段记录](docs/ATTENDANT_MYSTERIES_PLAYABLE_STAGE.md)。

185增量验证：22条途径现均有有限序列2基础。新增7文件218项、34同链文件642项、旧迁移8项和保存辅助6项通过；90个唯一自然SQLite边界及5个定向财务边界全部通过。完整严格类型、生产构建和32项恢复/CI工具通过。105个新原输入独立恢复，全部46包2148文件hash核验；1042测试文件枚举无漏重，本阶段没有全量重跑。沿原674条活档命令续至851条，真实诊疗休养后三瓶成功晋升，原活植休眠和根垫承冲各实际取得掌握8，新敌两轮重伤投降，玩家普通离场后继续工作；最终第212周ACTIVE/H100/M96/S114。初始失败日志保留，四处旧“序列2尚未开放”断言与真实175迁移测试已按当前阶段更新。详见[荒芜主母阶段记录](docs/BARREN_MATRIARCH_PLAYABLE_STAGE.md)。

184增量验证：新增7文件238项、38相关文件682项、迁移26项与巫师共享17项通过；594条原seed公开续行的76个唯一自然SQLite边界及5个定向财务边界通过。完整严格类型、生产构建、32项恢复/CI工具及6项保存辅助通过。91个新增原始输入独立恢复，全部44包2043输入hash核验；CI枚举1035文件无漏重，不等于全量重跑。首瓶晋升后新敌五轮战斗中玩家受伤撤退，回到普通工作，最终第135周ACTIVE、健康60、精神96、灵性120、现金690、3行动；原轻重伤保留。有限抵御自然仅施术未实际减伤，独立定向测试覆盖其生效窗口。上版Windows三处测试阻点本版窄修并整文件复验，新远端矩阵待实际终值。详见[平衡者阶段记录](docs/BALANCER_PLAYABLE_STAGE.md)。

183增量验证：新增领域及实档共享125项、界面41项，共166项通过；743条公开命令续行的84个唯一自然SQLite边界及另5个定向财务SQLite边界全部通过。同seed的555条活分支继续，原558条死亡分支保留；实际支付60便士诊疗后，前三瓶失败，第四瓶大成功晋升。生活延效与战斗增幅各获得实际掌握8，新对手第三轮投降，玩家普通离场后回到工作，最终第185周ACTIVE、健康100、精神95、灵性94、现金800便士、3行动。37个相关回归文件676项已去重通过；两项旧序列2普通盘断言按当前规则更新，所缺旧输入由原包恢复。新增99个JSON原始输入以3包归档并独立恢复核验，最终41包、1952个输入的全部hash通过。完整main/renderer严格类型和32项恢复/CI工具通过，CI枚举1028个测试文件无漏重，但枚举不等于执行全量测试。生产构建、6项保存辅助及48项烟测最终复验通过，烟测已包含于相关回归，不重复计数；详见[熵之公爵阶段记录](docs/ENTROPY_DUKE_PLAYABLE_STAGE.md)。本阶段未声称重跑全部历史测试或完成1.0。PR6远端CI已确认两项Windows单案例超时：贿赂者完整重放5075ms超过5秒、古代学者工作/休息/跨周导航16022ms超过15秒。本次仅将这两项预算分别调至10秒和25秒，保留全部原断言并完成整文件复验；古代学者7项另计，新远端矩阵仍待实际终值。

182增量验证：新增领域124项、界面44项、64个唯一自然SQLite边界与11个定向财务边界通过。完整551条命运之轮原活档继续至703条，第三瓶晋先知，新对手三轮投降，玩家存活并回到普通工作。修复真实零行动战斗终局与公共账单/还款衔接，保持原费用、随机与伤势；合法欠款和信用提示也有实际保存复验。新增85个输入在独立目录恢复并核验。完整严格类型、生产构建、48烟测、6保存辅助和32恢复/CI工具检查通过。本阶段未重跑整日历史全量验收；相关旧格式断言和Windows CI问题已按受影响范围完成121文件1775项去重复验；新远端矩阵仍以实际终值为准。


177验收时，主工程与干净发布树完整严格类型检查、生产构建均通过。其最终影响范围488个测试文件、8608个断言通过，覆盖全部296个界面文件；其余495个未改测试保留基线通过记录。干净发布树60个历史输入相关文件、466断言，以及48项烟测、17项恢复工具测试通过。全部范围、两项整文件运行限制和未验证内容见[验收报告](docs/RELEASE_ACCEPTANCE.md)。

178增量验证：领域73项、界面53项、旧窥秘链484项、保存工具6项及54个独立SQLite边界通过；完整严格类型、48项烟测、17项恢复工具测试和构建通过。此为相关范围复验，未声称重跑全部992个测试文件。

179增量验证：新增领域82项、界面17项、保存工具6项及53个唯一SQLite边界通过；旧秘祈链24文件441项覆盖后，对失败的过时断言逐项修正并复验。完整严格类型、48项烟测、17项恢复工具、14项CI分片工具与生产构建通过。新增输入包62个文件在独立目录实际恢复并校验。本阶段没有重新运行整个历史测试集。

180增量验证：获取/生活/继承/战斗及实档共享87项、界面30项、64个唯一SQLite边界、共享保存辅助6项通过；旧深渊链25文件508项和相邻4文件126项完成相关复验。完整严格类型、48项烟测、17项恢复工具、14项CI分片工具和构建通过。新增71个原始输入实际独立恢复。原592条死亡记录保留，从同seed583条活分叉续行至724条；第一瓶失败、第二瓶晋升，第三轮真实身体后果死亡。最终冻结代码逐条重放全部724命令与64边界完全一致，详见[鲜血大公阶段记录](docs/BLOOD_DUKE_PLAYABLE_STAGE.md)。

181增量验证：新增领域103项、界面32项、65个唯一SQLite边界通过；旧被缚者链25文件561项及旧界面9文件143项完成相关复验。完整严格类型、48项烟测、6项共享保存工具、32项恢复/CI工具及构建通过，全部74个新增原始输入已在独立目录恢复并核hash。同seed507条原活档续至642条，真实诊疗原重伤、第二瓶晋升、第三生活案两能力实际成功；可选战首轮新敌死亡，玩家普通离场后继续工作。详见[古代邪物阶段记录](docs/ANCIENT_EVIL_PLAYABLE_STAGE.md)。

本版仍有构建大分块警告；可见Electron窗口、Windows实机及全路线自然通关尚未验证。门与银骑士部分高阶使用定向起点。178贤者阶段沿原507条公开命令继续到651条：亲自停止原灾难，第二瓶晋升，两次实际信息通道往返；筛读失败后通过普通核对完成生活事务，战斗第5轮撤退后保留两处重伤并回到生活。阶段记录见[贤者](docs/SAGE_PLAYABLE_STAGE.md)。177阶段原585条公开命令及54命名/50唯一SQLite转换证据见[阶段记录](docs/CALAMITY_DEMONESS_PLAYABLE_STAGE.md)。

187增量验证：新领域69项、新界面32项通过；含旧链、共享保存及烟测的32文件共451项通过，另32项恢复/CI工具通过。48个唯一SQLite边界与56份新增输入独立恢复验证完成，严格类型及生产构建通过。原658条天气术士活分支自然续至795条，第三瓶晋1；五位原队员实际休整和协作后归家，独立战斗8轮对手死亡，玩家保留两处轻伤继续普通生活。详见[征服者阶段记录](docs/CONQUEROR_PLAYABLE_STAGE.md)。

## 来源与许可

仓库不包含上传小说全文、个人存档、凭据、node_modules或生成测试输出。原创代码许可和第三方设定/素材权利分别见LICENSE、NOTICE及public/assets/ART_SOURCES.txt。源码、游戏资源和测试输入通过明确清单交付。

平衡者专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix recovery-v01620 --only-prefix chaos-hunter-v01600 --only-prefix balancer-v01840
npx vitest run tests/domain/balancer-acquisition.test.ts tests/domain/balancer-life.test.ts tests/domain/balancer-combat.test.ts tests/domain/balancer-inheritance.test.ts tests/domain/balancer-shared.test.ts tests/renderer/balancer-panel.test.tsx tests/renderer/balancer-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/balancer-save.mjs --expected-boundaries 76
node --expose-gc scripts/play/balancer-save.mjs --key directed --source-directory tests/fixtures/balancer-v01840/directed --expected-boundaries 5
```

平衡者记录与本阶段验证见 [阶段说明](docs/BALANCER_PLAYABLE_STAGE.md)。旧死亡记录保留；本次完整续行原483条实际生还分支，诊疗后晋升并在新战斗受伤撤离。

荒芜主母专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix coffin-bearer-v01610 --only-prefix balancer-v01840 --only-prefix barren-matriarch-v01850
npx vitest run tests/domain/barren-matriarch-acquisition.test.ts tests/domain/barren-matriarch-inheritance.test.ts tests/domain/barren-matriarch-life.test.ts tests/domain/barren-matriarch-combat.test.ts tests/domain/barren-matriarch-shared.test.ts tests/renderer/barren-matriarch-panel.test.tsx tests/renderer/barren-matriarch-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/barren-matriarch-save.mjs --expected-boundaries 90
node --expose-gc scripts/play/barren-matriarch-save.mjs --key directed --source-directory tests/fixtures/barren-matriarch-v01850/directed --expected-boundaries 5
```

新增两包保存105份原始输入；90边界重放分为六组15条，保留同一851条命令与全部断言。阶段范围与真实结果见[荒芜主母阶段记录](docs/BARREN_MATRIARCH_PLAYABLE_STAGE.md)。

作家专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix discerner-v01660 --only-prefix writer-v01880
npx vitest run tests/domain/writer-acquisition.test.ts tests/domain/writer-life.test.ts tests/domain/writer-combat.test.ts tests/domain/writer-inheritance.test.ts tests/domain/writer-shared.test.ts tests/domain/writer-natural.test.ts tests/renderer/writer-panel.test.tsx tests/renderer/writer-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/writer-save.mjs --expected-boundaries 47
```

文明启蒙者专项：

```sh
npm run fixtures:restore -- --only-prefix knowledge-mentor-v01670 --only-prefix civilization-enlightener-v01890
npx vitest run tests/domain/civilization-enlightener-acquisition.test.ts tests/domain/civilization-enlightener-life.test.ts tests/domain/civilization-enlightener-combat.test.ts tests/domain/civilization-enlightener-inheritance.test.ts tests/domain/civilization-enlightener-shared.test.ts tests/domain/civilization-enlightener-natural.test.ts tests/renderer/civilization-enlightener-panel.test.tsx tests/renderer/civilization-enlightener-source.test.tsx tests/renderer/civilization-enlightener-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/civilization-enlightener-save.mjs --expected-boundaries 69
```

同一691条通识者原分支自然续行至797条：真实诊治、首瓶晋1、原护架付费修理和失败后的普通操作均保留。可选战斗第四轮撤退，玩家仍活并保留新伤。详见[文明启蒙者阶段](docs/CIVILIZATION_ENLIGHTENER_PLAYABLE_STAGE.md)。

### 美神阶段专项恢复与检查

```sh
npm run fixtures:restore -- --only-prefix life-giver-v01680 --only-prefix beauty-goddess-v01900
npx vitest run tests/domain/beauty-goddess-acquisition.test.ts tests/domain/beauty-goddess-life.test.ts tests/domain/beauty-goddess-combat.test.ts tests/domain/beauty-goddess-inheritance.test.ts tests/domain/beauty-goddess-shared.test.ts tests/domain/beauty-goddess-natural.test.ts tests/renderer/beauty-goddess-panel.test.tsx tests/renderer/beauty-goddess-source.test.tsx tests/renderer/beauty-goddess-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/beauty-goddess-save.mjs --expected-boundaries 102
```
