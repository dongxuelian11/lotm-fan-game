# 诡秘之主同人游戏 · 0.209.0 阶段版

基于《诡秘之主》设定的原创角色单机RPG，使用React、TypeScript、Vite和Electron/SQLite。按周工作、学习、调查与休养，取得魔药并在有限故事与战斗中成长。

当前22条途径均包含9→2有限可玩切片，并已有有限序列1基础；目前补入占卜家愚者和猎人红祭司两条有限序列0路线。其余20条序列0和完整1.0仍未完成。门、银骑士部分高阶验证使用定向起点，不代表全部路线自然通关。每阶段保留原有失败记录，并分别记录玩法结果、保存验证与桌面体验验收。

## 安装和启动

请先用Git检出本阶段PR分支，保留仓库声明的行尾属性；历史输入与源码的严格字节校验以该检出结果为准。需要Node.js24.15–24.x、npm及图形桌面。npm ci会安装锁定依赖；Electron44在首次启动时按需下载桌面运行时，因此首次启动也需要网络。可提前执行 `npx --no-install install-electron` 准备运行时。当前云环境没有进行可见窗口验证；Windows GitHub Actions 执行严格类型、烟测和存档回归，桌面实机体验尚未验证。

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

195增量：死神新增有限序列1苍白皇帝。原815条当代活档真实劳动筹措诊疗与休养，原种子续至1038条，前两瓶失败、第三瓶晋升。三次生活施术均失败，手工完成原容器处理，两项新掌握仍为零；独立可选战12轮对手死亡，玩家保留一重两轻伤，沿16米原路退出后真实劳动。原六十年经历、旧人物与器具履历保持。224个唯一SQLite转换全覆盖，9个新增测试文件135项、39个同链文件733项及共享界面12项通过；最终严格类型、构建和32项恢复/CI工具通过，五包238个新输入独立恢复核验。本阶段未重跑全部历史测试，详见[苍白皇帝阶段记录](docs/PALE_EMPEROR_PLAYABLE_STAGE.md)。

199增量：魔女新增有限序列1末日魔女。原585条活档同种子续至854条，前五瓶失败后真实补货、第六瓶晋升。脉冲收束和镜面缓冲生活各实际应用一次；可选遭遇四轮对手投降，本人带两处轻伤沿原路退出再工作。原消耗、撤回与独立实体连续性详见[末日魔女阶段记录](docs/APOCALYPSE_DEMONESS_PLAYABLE_STAGE.md)。

194增量：太阳新增有限序列1纯白天使。原729条活档实际诊疗休养后同种子续至853条，首瓶晋升；净光一次实际清除原残留，温光未应用的零掌握如实保留。独立可选战一轮对手投降，玩家无伤沿原路退出再工作。127个命名保存边界、125种不同转换已完整通过SQLite专项。原物耗损、失效窗口及验证范围详见[纯白天使阶段记录](docs/PURE_WHITE_ANGEL_PLAYABLE_STAGE.md)。

193增量：水手新增有限序列1雷神。原599条和平活档继续，三次药败后真实补货、第四瓶晋升，原小湾引导与护持各有一次实际应用。可选战10轮玩家死亡，原602条死亡分支保留。旧原物、正常收束与真实代价详见[雷神阶段记录](docs/THUNDER_GOD_PLAYABLE_STAGE.md)。

191增量：黑夜新增有限序列1厄难骑士。沿原518条和平活档继续，第三瓶成功晋升；同一原盒接取与校准轻触中，两项新技巧各实际应用一次，撤回许可后仍可普通收束。可选新敌交战九轮后玩家死亡，保留实际伤势、资源和死亡终档。详见[厄难骑士阶段记录](docs/MISFORTUNE_KNIGHT_PLAYABLE_STAGE.md)。

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

### 厄难骑士阶段专项恢复与检查

```sh
npm run fixtures:restore -- --only-prefix concealment-servant-v01690 --only-prefix misfortune-knight-v01910
npx vitest run tests/domain/misfortune-knight-acquisition.test.ts tests/domain/misfortune-knight-life.test.ts tests/domain/misfortune-knight-combat.test.ts tests/domain/misfortune-knight-inheritance.test.ts tests/domain/misfortune-knight-shared.test.ts tests/domain/misfortune-knight-natural.test.ts tests/renderer/misfortune-knight-panel.test.tsx tests/renderer/misfortune-knight-source.test.tsx tests/renderer/misfortune-knight-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/misfortune-knight-save.mjs --expected-boundaries 80
```

### 雷神阶段专项恢复与检查

```sh
npm run fixtures:restore -- --only-prefix catastrophe-v01710 --only-prefix thunder-god-v01930
npx vitest run tests/domain/thunder-god-acquisition.test.ts tests/domain/thunder-god-life.test.ts tests/domain/thunder-god-combat.test.ts tests/domain/thunder-god-inheritance.test.ts tests/domain/thunder-god-shared.test.ts tests/domain/thunder-god-natural.test.ts tests/renderer/thunder-god-panel.test.tsx tests/renderer/thunder-god-source.test.tsx tests/renderer/thunder-god-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/thunder-god-save.mjs --expected-boundaries 222
```

这些输入保留原599条活分支、原602条死亡记录以及本次820条独立死亡分支。可选战斗失败仍为终档；输入恢复只用于验证，不改变玩家存档。

纯白天使专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix light-seeker-v01720 --only-prefix pure-white-angel-v01940
npm run typecheck
npx vitest run tests/domain/pure-white-angel-acquisition.test.ts tests/domain/pure-white-angel-life.test.ts tests/domain/pure-white-angel-combat.test.ts tests/domain/pure-white-angel-inheritance.test.ts tests/domain/pure-white-angel-shared.test.ts tests/domain/pure-white-angel-natural.test.ts tests/domain/pure-white-angel-save.test.ts tests/renderer/pure-white-angel-panel.test.tsx tests/renderer/pure-white-angel-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/pure-white-angel-save.mjs --expected-boundaries 127
```

苍白皇帝专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix death-consul-v01730 --only-prefix pale-emperor-v01950
npm run typecheck
npx vitest run tests/domain/pale-emperor-acquisition.test.ts tests/domain/pale-emperor-life.test.ts tests/domain/pale-emperor-combat.test.ts tests/domain/pale-emperor-inheritance.test.ts tests/domain/pale-emperor-shared.test.ts tests/domain/pale-emperor-natural.test.ts tests/domain/pale-emperor-save.test.ts tests/renderer/pale-emperor-panel.test.tsx tests/renderer/pale-emperor-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/pale-emperor-save.mjs --expected-boundaries 224
```

完整专项逐一检验224个命名边界。Vitest 保留全输入完整性校验与关键事务代表测试，二者验证范围分别记录。恢复输入保留原当代人物、六十年经历、实际失败和新伤，不改变玩家存档。

时之虫专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix fate-trojan-v01750 --only-prefix deceit-mentor-v01510 --only-prefix time-worm-v01970
npm run build:main
node --expose-gc scripts/play/time-worm-save.mjs --expected-boundaries 110
```

该专项包含110个命名边界、106个唯一转换和4个原字节相同的别名。原551条活档继续至656条，639条公开按钮遗漏修复后从原活终态接续，首瓶及此前随机结果保持；旧456条死亡分支独立封存。详见[时之虫阶段记录](docs/TIME_WORM_PLAYABLE_STAGE.md)。

星之匙专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix planeswalker-v01740 --only-prefix wanderer-v01500 --only-prefix star-key-v01960
npm run typecheck
npx vitest run tests/domain/star-key-acquisition.test.ts tests/domain/star-key-life.test.ts tests/domain/star-key-combat.test.ts tests/domain/star-key-inheritance.test.ts tests/domain/star-key-shared.test.ts tests/domain/star-key-natural.test.ts tests/domain/star-key-save.test.ts tests/renderer/star-key-panel.test.tsx tests/renderer/star-key-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc scripts/play/star-key-save.mjs --expected-boundaries 126
```

专项核验126个命名边界，其中3个名称与另一名称记录同一实际转换，按原字节核对并分别计数为123个唯一转换。输入保留原707条与209条死亡分支、813命令首次校验拒绝与修复后完全相同的结算。当前活分支沿原701和平截点继续至823条；旧死亡档不会因此复起。门路线早期序列4起点有定向验证背景，不能当作普通人9→1完整自然通关。详见[星之匙阶段记录](docs/STAR_KEY_PLAYABLE_STAGE.md)。

神明之手专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix glory-v01760 --only-prefix silver-knight-v01520 --only-prefix preparation-audit-v01630 --only-prefix divine-hand-v01980
npm run build:main
node --expose-gc scripts/play/divine-hand-save.mjs --expected-boundaries 142
```

原158条活档继续至297条；继承的70条银骑士起点为定向验证。第二瓶晋升成功，生活中的两项新技巧均未成功应用；可选遭遇第七轮玩家死亡，敌人存活，护甲合势在实战中实际应用一次。原死亡终档封存。专项覆盖142个命名边界、140个独立转换，详见[神明之手阶段记录](docs/DIVINE_HAND_PLAYABLE_STAGE.md)。

末日魔女专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix unaging-demoness-v01530 --only-prefix calamity-demoness-v01770 --only-prefix apocalypse-demoness-v01990
npm run build:main
node --expose-gc --max-old-space-size=768 scripts/play/apocalypse-demoness-save.mjs --expected-boundaries 277
npx vitest run tests/domain/apocalypse-demoness-natural.test.ts tests/domain/apocalypse-demoness-save.test.ts --maxWorkers=1 --no-file-parallelism
```

本次854条公开命令保留原585及此前487条真实历史，前五药败与跨周补货均未回滚。生活两项新技巧各实际应用一次，可选交战四轮对手投降，本人普通退场后工作并保留两轻伤。专项按277个命名边界、270个唯一转换和7个同字节别名核验，完整进展与最终验证范围见[末日魔女阶段记录](docs/APOCALYPSE_DEMONESS_PLAYABLE_STAGE.md)。

0.199.0阶段验收：50个相关测试文件、1086项全部通过；277个命名保存边界对应270个唯一事务转换。新增6个历史输入包恢复出286个原文件并逐字节核对，严格类型与生产构建通过。远端Windows检查状态见对应PR；完整1.0、剩余序列1和全部序列0仍在开发。

知识皇帝专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix prophecy-master-v01540 --only-prefix sage-v01780 --only-prefix knowledge-emperor-v02000
npm run build:main
node --expose-gc --max-old-space-size=768 scripts/play/knowledge-emperor-save.mjs --expected-boundaries 184
npx vitest run tests/domain/knowledge-emperor-natural.test.ts tests/integration/knowledge-emperor-save.test.ts tests/renderer/knowledge-emperor-combat-save.test.tsx --maxWorkers=1 --no-file-parallelism
```

原651条贤者历史继续至831条，实际诊疗、两瓶失败和第三瓶成功均保留。三案施术全部失败，新技巧掌握保持0；第194周健康100无伤进入可选交战，首轮身体后果骰97导致死亡，终档封存。专项按184个命名边界、181个唯一转换与3个原字节相同别名分别核验，完整范围见[知识皇帝阶段记录](docs/KNOWLEDGE_EMPEROR_PLAYABLE_STAGE.md)。

0.200.0阶段验收：55个相关测试文件、948项全部通过；184个命名保存边界对应181个唯一事务与3个别名。新增4包实际恢复198个原文件并逐字节核验，严格类型和生产构建通过。Windows远端结果见本阶段PR；可见桌面体验与完整1.0仍待完成。


暗天使专项输入与保存复验：

```bash
npm run fixtures:restore -- --only-prefix dark-angel-v02010 --only-prefix elder-v01790 --only-prefix three-headed-templar-v01550 --only-prefix knowledge-emperor-v02000
npm run build:main
node --expose-gc --max-old-space-size=768 scripts/play/dark-angel-save.mjs --expected-boundaries 215
```

201增量：倒吊人新增有限序列1暗天使。原615条活档同种子续至824条，真实诊疗休养、前三瓶失败及付费隔周新供货后第四瓶晋升均保留。生活中引导、护持各实际应用一次，撤回案没有应用或奖励；原双灵灵性实际消耗，无新灵库存。独立可选战三轮后对手投降，本人无伤沿4米原路退出再工作；战中新引导窗口失效、实际增益为0。详见[暗天使阶段记录](docs/DARK_ANGEL_PLAYABLE_STAGE.md)。本阶段51个相关测试文件854项、215个命名保存边界对应210个唯一事务均通过；严格类型与生产构建通过。227个原始输入以完整文件压缩分包交付，采用全成员逐字节核验与代表实解。Windows结果以本阶段PR为准，桌面实机体验与完整1.0仍待验收。


污秽君王专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix blood-duke-v01800 --only-prefix blatherer-v01560 --only-prefix unclean-monarch-v02020
npm run build:main
node --expose-gc --max-old-space-size=768 scripts/play/unclean-monarch-save.mjs --source-directory tests/fixtures/unclean-monarch-v02020 --expected-boundaries 106
npx vitest run tests/domain/unclean-monarch-natural.test.ts tests/renderer/unclean-monarch-combat-save.test.tsx --maxWorkers=1 --no-file-parallelism
```

202增量：深渊新增有限序列1污秽君王。原718条和平活截点同种子续至821条，首瓶晋升，两项新技巧各在生活中实际应用并报告一次，第三案失败后普通归还。新邻院对手两轮死亡，玩家无伤步行退出后劳动；战中冲动收束实际应用一次，定向扰动未应用。原724条及更早592条死亡分支各自保留，原十六项掌握与负荷均不重置。详细费用、实际结果和本阶段最终验证范围见[污秽君王阶段记录](docs/UNCLEAN_MONARCH_PLAYABLE_STAGE.md)。

0.202.0阶段验收：49个相关测试文件888项、106个命名保存边界对应104个唯一事务全部通过，严格类型和生产构建通过。119个历史输入分3包交付，并完成全成员字节核对与4个代表文件实际恢复。Windows检查以本阶段PR为准；剩余5条序列1、全部序列0和完整1.0验收继续推进。


神孽专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix silent-disciple-v01570 --only-prefix ancient-evil-v01810 --only-prefix abomination-v02030
npm run build:main
node --expose-gc --max-old-space-size=768 scripts/play/abomination-save.mjs --source-directory tests/fixtures/abomination-v02030 --expected-boundaries 140
```

203增量：被缚者新增有限序列1神孽。原642条完整活档同种子续至778条，第一瓶失败、第二瓶第169周成功；生活束障实际把一次精神压力45减至15并报告，新短声尝试失败。可选遭遇四轮对手投降，玩家无伤普通步行退出后劳动；战中两项新能力均没有实际应用。旧蕾娜死亡、卡尔德投降及原人物衣包保持。详见[神孽阶段记录](docs/ABOMINATION_PLAYABLE_STAGE.md)。

204增量：怪物新增有限序列1水银之蛇。原703条活档同种子续至841条，第一瓶失败、第二瓶第196周晋升。生活中原车与同一封包实际重启一次；可选遭遇第二轮回到本次记录位置并抵去25点未结算身体冲量，随后对手投降，本人普通步行退出并完成实际周结，保留一处新轻伤。片刻维系虽施放成功但没有实际应用，掌握仍为0。日期、费用、原物、原投降者和死亡历史均不回滚。详见[水银之蛇阶段记录](docs/MERCURY_SNAKE_PLAYABLE_STAGE.md)。


205增量：黑皇帝新增有限序列1弑序亲王。原743条完整活档同种子续至924条，前两瓶失败、第三瓶第216周晋升。原球在新旁侧承接区中实际投掷、维持飞行与撤回后普通归还，两项新技巧各在生活中应用一次。独立可选遭遇六轮后对手投降，定向放大实际应用一次，延效被抵抗；本人沿四米原路退出，保留两处新轻伤。原十五份贿赂物使用唯一有效账本，已赠物与旧投降者没有重置。真实结果、有限范围与验收状态见[弑序亲王阶段记录](docs/PRINCE_OF_ABOLITION_PLAYABLE_STAGE.md)。


206增量：仲裁人新增有限序列1秩序之手。原594条完整活档同种子续至801条，真实诊治休养后前三瓶失败，付费调查隔周新供货后第四瓶在第179周晋升。原封包在相邻区完成真实交接、撤回和普通归还，划分实际应用一次，余波失败后普通支撑磨损原护板。可选新遭遇三轮后玩家死亡，死亡结局保留；战中两项新技巧没有实际应用。有限范围、原人物物品连续性及最终验证结果见[秩序之手阶段记录](docs/HAND_OF_ORDER_PLAYABLE_STAGE.md)。本地58个测试文件1161项、7项冻结负例、完整208个唯一SQLite转换、修后代表与界面回归通过，严格类型检查和构建通过；远端Windows矩阵以本次PR实际状态为准。

秩序之手专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix chaos-hunter-v01600 --only-prefix recovery-v01620 --only-prefix balancer-v01840 --only-prefix hand-of-order-v02060
npx vitest run tests/domain/hand-of-order-acquisition.test.ts tests/domain/hand-of-order-life.test.ts tests/domain/hand-of-order-combat.test.ts tests/domain/hand-of-order-inheritance.test.ts tests/renderer/hand-of-order-panel.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc --max-old-space-size=768 scripts/play/hand-of-order-save.mjs --expected-boundaries 283
```


207增量：大地新增有限序列1自然行者。原851条完整活档同种子续至955条，第一瓶第221周晋升。生机辨应与根系承冲各在生活中实际应用一次；另一次辨应施术成功后许可撤回，改为普通照料，不计能力应用。独立可选遭遇九轮后对手投降，两项新能力战斗实际应用均为0；原根垫与旧护腕继续真实消耗。本人沿四米原路退出后实际工作，第228周仍活着，保留两重两轻伤与累计风险3。有限范围、原人物物品连续性及验证状态见[自然行者阶段记录](docs/NATURE_WALKER_PLAYABLE_STAGE.md)。本地53个测试文件1113项、13项输入冻结/公开边界脚本测试及完整105个唯一SQLite转换通过，严格类型和构建通过。122个输入分4包，全部成员流式字节核对并实际恢复4个代表文件；远端Windows状态以本阶段PR为准。

自然行者专项输入与保存复验：

```sh
npm run fixtures:restore -- --only-prefix coffin-bearer-v01610 --only-prefix barren-matriarch-v01850 --only-prefix nature-walker-v02070
npx vitest run tests/domain/nature-walker-natural.test.ts tests/domain/nature-walker-natural-save.test.ts tests/renderer/nature-walker-combat-save.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build:main
node --expose-gc --max-old-space-size=768 scripts/play/nature-walker-save.mjs --source-directory tests/fixtures/nature-walker-v02070 --expected-boundaries 146
```

208增量：占卜家新增有限序列0愚者。原1868条完整活档按原种子、原策略接续至2083条，首瓶于第2072条命令、第16005周晋升；准备失败、付费重试、原材料与伤亡账本均保留。撤离中的新技巧只尝试片刻盲愚且失败，随后步行检定失败，本人受伤35、两位信使各受伤18，再沿12米普通退路退出；前刻留影未施放，两项新技巧均未实际应用、掌握保持0。最终第16006周仍活着，健康65、精神96、灵性92、现金71便士、2行动。原物、历史迷雾与商运因果的有限范围见[愚者阶段记录](docs/FOOL_PLAYABLE_STAGE.md)。

逐步验证已保留修复前215条命令、216状态的完整严格对照。随后修复旧序列1战斗结果中的内部字段泄漏，修复后216份安全公开投影和隔离审计对照通过，原私态与随机不变；严格复查覆盖起点、首步及终态，没有重跑修复后的完整215条严格对照。公开字段修复版的32个唯一SQLite提交边界（34个命名点）、3项采集检查和1项终态界面测试均已通过。首批相关回归暴露启动读取误走写事务与备份流程。只读事务修复已通过3个后端文件41项，原写事务与领域结果不变；最终65个相关文件1138项串行复验全部通过。原32项完整事务与修复后的定点覆盖分开记录。

最终只读修复版Linux/Node后端实测：构造与启动读取合计53.08秒，显式加载19.19—20.60秒，最后报告动作的实际SQLite热提交3.56秒（含公开投影、事务提交与提交后备份），重复回执约56毫秒。私态、随机及当前安全公开结果完全匹配。这些测量不含Electron窗口、IPC与绘制，较慢的冷启动和加载仍是体验限制。远端Windows CI待实际结果，桌面实机体验尚未验收；新增13份Fool输入已由一个小于20MB的完整文件包交付，公开恢复脚本在干净目录实际恢复并逐字节核验。本阶段不是完整1.0。

愚者复验输入与命令见[阶段记录](docs/FOOL_PLAYABLE_STAGE.md#输入恢复与复验命令)。当前0.208.0清单包含本阶段完整输入与最终版本证明。


209增量：猎人新增有限序列0红祭司。由征服者原795条完整活档出发，保留旧983条撤战和1222条三药失败路线；正常准备验证从真实918条战前活截点以同一种子独立续至1051条。实际五胜覆盖三个战区，第九次停战谈判成功，首瓶完成付费稳定准备后于第341周以68%掷42晋升。战后救援中协同成功、搬运大失败，最终1名原伤员救出、2名仍留原遮蔽站，原分队1死5返；本人活着退出并交接，健康70、1处未处理重伤、欠款94便士，两项新技巧掌握8与0。没有回滚旧失败或为尾声重抽结果。玩法、恢复路径和验收状态见[红祭司阶段记录](docs/RED_PRIEST_PLAYABLE_STAGE.md)。
