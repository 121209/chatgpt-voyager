# REGRESSION_LOG.md

## 用途

本文件用于记录项目中已经修复的问题，帮助后续修改时避免重复引入相同或相关回归。

## 记录格式

每次修复问题后，按以下格式追加记录：

```markdown
## YYYY-MM-DD - 问题标题

- 问题现象：
- 影响范围：
- 修复方式：
- 回归测试：
- 验证结果：
- 相关文件：
```

## 已修复问题

## 2026-05-26 - 防回归记录未生效

- 问题现象：项目已经创建 `AGENTS.md` 和 `REGRESSION_LOG.md`，但 `REGRESSION_LOG.md` 仍为空，两个文件也未纳入 Git 跟踪；后续修复没有可查询的已修复问题记录，导致同类问题仍可能重复出现。
- 影响范围：所有后续问题修复流程；尤其是需要避免重复回归的 UI、内容脚本、导出、目录跳转等改动。
- 修复方式：在 `AGENTS.md` 中补充必须执行的修复流程，要求修复前读取回归记录、修改前后检查 diff、修复后追加 `REGRESSION_LOG.md`；同时在本文件写入首条失效原因和修复记录。
- 回归测试：本次为文档流程修复，无业务代码变更；通过检查 `git diff`、确认只改动 `AGENTS.md` 和 `REGRESSION_LOG.md` 进行验证。
- 验证结果：已检查新增文件 diff，确认本次只更新 `AGENTS.md` 和 `REGRESSION_LOG.md`，未修改业务代码。
- 相关文件：`AGENTS.md`、`REGRESSION_LOG.md`

## 2026-05-26 - 本地修复缺少强制记录检查

- 问题现象：项目修复可能只停留在本地工作区，不上传 GitHub，也不一定提交；仅靠人工阅读 `AGENTS.md` 不能强制每次本地代码改动都更新 `REGRESSION_LOG.md`。
- 影响范围：所有本地问题修复；当 Codex 解决新问题时，如果没有本地修复记录，容易重复引入已经修过的旧问题。
- 修复方式：新增 `scripts/check-regression-log.js`，检查工作区、暂存区和未跟踪文件；只要发现 `src/`、`scripts/`、`assets/`、`manifest.json`、`package*.json` 或 `.github/` 等代码相关改动，就要求 `REGRESSION_LOG.md` 同步更新。新增 `npm run check:regression-log`，并接入 `npm run check`。
- 回归测试：运行 `npm run check:regression-log`；运行 `npm run check`。
- 验证结果：`npm run check:regression-log` 通过；`npm run check` 通过。
- 相关文件：`scripts/check-regression-log.js`、`package.json`、`AGENTS.md`、`REGRESSION_LOG.md`

## 2026-05-26 - 新问题修复前缺少本地文件检查意识

- 问题现象：即使要求更新 `REGRESSION_LOG.md`，如果解决新问题时没有主动检查相关本地文件、相似逻辑和历史修复记录，仍可能只做局部修复并重新引出旧问题。
- 影响范围：所有本地问题修复；尤其是同一功能存在多个入口、多个选择器、多个滚动或缓存路径的情况。
- 修复方式：在 `AGENTS.md` 中新增“本地文件检查要求”，强制修复前检索并阅读相关本地文件、相邻实现和历史修复记录；要求交付或日志中说明已检查哪些本地文件、是否命中历史记录。
- 回归测试：运行 `npm run check:regression-log`；运行 `npm run check`。
- 验证结果：`npm run check:regression-log` 通过；`npm run check` 通过。
- 相关文件：`AGENTS.md`、`REGRESSION_LOG.md`

## 2026-05-27 - 滑轨滚轮向下滚动回弹

- 问题现象：鼠标放在右侧问题滑轨上滚动时，ChatGPT 页面和滑轨圆点会一起滑动；滑轨越往后滚越像有阻尼，圆点向下滚动后又回弹，无法稳定从第一个圆点滚到最后一个圆点。
- 影响范围：右侧滑轨独立滚动；长对话中大量问题圆点浏览；滑轨点击定位前的圆点选择。
- 修复方式：参考 `Nagi-ovo/gemini-voyager` 的时间轴结构，将滑轨改成外层固定条、内部滚动 track、内容层和绝对定位圆点；wheel 事件在 rail/document capture 中按鼠标坐标截获，只滚动内部 track，不把滚轮事件泄露给 ChatGPT 页面；圆点 active/hover 视觉变化不再参与列表流式布局。
- 回归测试：运行 `npm run build`。
- 验证结果：`npm run build` 通过；Chrome 中仍需人工确认滑轨滚轮从首个圆点到末尾圆点不会回弹，且页面不随滑轨滚动。
- 相关文件：`src/content/content.js`、`src/content/content.css`

## 2026-05-29 - 三横线目录只显示部分问题

- 问题现象：点击右侧三横线打开插件目录时，只能显示当前对话中的一部分问题；混合 DOM 结构下，页面只要存在部分 `conversation-turn-*` 节点，就会跳过直接扫描 `[data-message-author-role="user"]` 的消息；同时目录会过滤掉已记录但暂时缺少可靠锚点的问题。
- 影响范围：悬浮目录面板的问题识别和展示；长对话、ChatGPT DOM 结构不一致或缓存中存在待重新采集问题时，目录数量少于实际已记录问题。右侧滑轨仍只展示可跳转问题，避免影响 2026-05-27 的滑轨滚动修复。
- 修复方式：`getUserMessages()` 改为同时采集 turn 结构和直接 user-role 节点，再交给现有去重逻辑合并；`getDirectoryQuestions()` 不再用 `hasDirectoryOrderEvidence` 隐藏已记录问题，保留“需重新采集”状态提示；新增 `scripts/check-question-directory-regression.js` 防止以后重新把直接 user-role 扫描绑定到 turn 扫描结果，或把目录问题再次按可跳转证据过滤。
- 回归测试：运行 `npm run check:regression-log`；运行 `npm run check`；新增静态回归检查 `node scripts/check-question-directory-regression.js`。
- 验证结果：已检查 `AGENTS.md`、`REGRESSION_LOG.md`、`src/content/content.js`、`src/content/content.css`、`package.json` 和 `scripts/check-regression-log.js`；命中历史修复记录 `2026-05-27 - 滑轨滚轮向下滚动回弹`，本次未放宽 `getRailQuestions()` 的可跳转过滤，避免重新引入滑轨显示/滚动问题。测试结果见交付说明。
- 相关文件：`src/content/content.js`、`scripts/check-question-directory-regression.js`、`package.json`、`REGRESSION_LOG.md`

## 2026-06-02 - 插件面板缺少 GPT 回复总结入口

- 问题现象：用户希望对 GPT 回复用户问题后的输出做总结，但悬浮插件面板只有“目录”和“导出”入口；默认提示词库中虽有 `Summarize`，页面内没有可直接使用的总结入口。
- 影响范围：悬浮插件面板的信息整理流程；当前页面已加载的 assistant 回复选择、总结提示词生成、复制和填入 ChatGPT 输入框。需避免影响 `2026-05-27 - 滑轨滚轮向下滚动回弹` 和 `2026-05-29 - 三横线目录只显示部分问题` 两个历史修复。
- 修复方式：在悬浮面板中新增“总结”标签页，放在“目录”和“导出”之间；该页只列出 `[data-message-author-role="assistant"]` 回复，独立维护总结选择状态，支持全选、清空、生成总结提示词、复制提示词和填入 ChatGPT 输入框；新增 `scripts/check-summary-panel-regression.js` 防止总结入口被移除、顺序错误或误包含用户消息。
- 回归测试：运行 `npm run check:regression-log`；运行 `npm run check`；新增静态回归检查 `node scripts/check-summary-panel-regression.js`。
- 验证结果：`npm run check:regression-log` 通过；`npm run check` 通过；已检查 `AGENTS.md`、`REGRESSION_LOG.md`、`src/content/content.js`、`src/content/content.css`、`src/shared/storage.js`、`README.md`、`package.json` 和现有回归检查脚本；命中历史修复记录 `2026-05-27 - 滑轨滚轮向下滚动回弹`、`2026-05-29 - 三横线目录只显示部分问题`，本次未修改滑轨滚轮逻辑、`getRailQuestions()` 和目录问题采集过滤。
- 相关文件：`src/content/content.js`、`src/content/content.css`、`scripts/check-summary-panel-regression.js`、`package.json`、`README.md`、`REGRESSION_LOG.md`

## 2026-06-02 - 目录项下方缺少 GPT 回复摘要

- 问题现象：上一条 `2026-06-02 - 插件面板缺少 GPT 回复总结入口` 将需求实现成独立“总结”标签页和总结提示词工具，但用户实际更想在插件目录里像看问题一样，直接看到每个问题下面 GPT 回答的摘要或总结内容。
- 影响范围：悬浮目录面板的问题列表展示、搜索过滤和已加载 assistant 回复配对；需继续避免影响 `2026-05-27 - 滑轨滚轮向下滚动回弹`、`2026-05-29 - 三横线目录只显示部分问题` 和上一条独立总结工具入口。
- 修复方式：目录页渲染前按当前 DOM 顺序将 user 消息与后续 assistant 消息配对，对已加载 GPT 回复生成本地提取式短摘要，并在每个问题项标题下方显示 `GPT摘要`；未加载或未识别到回复时显示明确占位说明；搜索同时匹配问题文本和摘要文本；扩展 `scripts/check-summary-panel-regression.js` 检查目录内联摘要配对、渲染和样式，避免以后只保留单独总结页。
- 回归测试：运行 `npm run check:regression-log`；运行 `npm run check`；静态回归检查 `node scripts/check-summary-panel-regression.js`。
- 验证结果：`npm run check:regression-log` 通过；`npm run check` 通过；已检查 `AGENTS.md`、`REGRESSION_LOG.md`、`src/content/content.js`、`src/content/content.css`、`README.md`、`package.json` 和 `scripts/check-summary-panel-regression.js`；本次未修改滑轨滚轮逻辑、`getRailQuestions()` 和目录问题采集过滤。
- 相关文件：`src/content/content.js`、`src/content/content.css`、`scripts/check-summary-panel-regression.js`、`README.md`、`REGRESSION_LOG.md`

## 2026-06-15 - 删除无效且冗余的总结提示词流程

- 问题现象：独立“总结”标签页仅把 GPT 回复拼成提示词，让用户复制或填入 ChatGPT 输入框，并没有直接生成可靠总结；目录中的 `GPT摘要` 实际也是回复开头截取，命名会让用户误以为已经完成语义总结。该问题是对 `2026-06-02 - 插件面板缺少 GPT 回复总结入口` 和 `2026-06-02 - 目录项下方缺少 GPT 回复摘要` 的再次修正，之前防线只检查功能存在，没有检查功能是否真正完成用户目标。
- 影响范围：悬浮面板标签、目录回答辅助信息、内容脚本中的提示词/输入框写入逻辑、相关样式和回归检查；需继续避免影响目录问题展示、跳转和滑轨滚动历史修复。
- 修复方式：删除独立“总结”标签页、回复选择状态、总结提示词生成、复制提示词、填入 ChatGPT 输入框和对应样式；面板恢复为“目录 / 导出”两个标签。保留问题与回答配对能力，但将 `GPT摘要` 明确改名为 `回答预览`，避免把本地截取冒充真正总结；将回归脚本改为 `scripts/check-answer-preview-regression.js`，检查回答预览存在，并禁止提示词式总结流程回归。
- 回归测试：运行 `npm run check:regression-log`；运行 `npm run check`；静态回归检查 `node scripts/check-answer-preview-regression.js`。
- 验证结果：`npm run check:regression-log` 通过；`npm run check` 通过；已检查用户截图、`AGENTS.md`、`REGRESSION_LOG.md`、`src/content/content.js`、`src/content/content.css`、`README.md`、`package.json` 和相关回归检查脚本；本次未修改滑轨滚轮逻辑、`getRailQuestions()` 和目录问题采集过滤。未在真实 ChatGPT 页面人工验证，需重新加载扩展后确认面板仅显示“目录 / 导出”，目录第二行显示“回答预览”。
- 相关文件：`src/content/content.js`、`src/content/content.css`、`scripts/check-answer-preview-regression.js`、`package.json`、`README.md`、`REGRESSION_LOG.md`

## 2026-06-15 - 回答预览只截取开头，无法覆盖前后内容

- 问题现象：`回答预览` 固定截取 GPT 回复前两句，容易保留寒暄、确认语或开场判断，不能用一句话说明回答主体和最终结论；这是对 `2026-06-15 - 删除无效且冗余的总结提示词流程` 的继续改进。
- 影响范围：悬浮目录中每个问题下方的回答辅助文本、回答文本搜索和对应回归检查；不影响问题采集、目录跳转、滑轨滚动或导出。
- 修复方式：将回答文本升级为 `一句话概览`；对整段 GPT 回复切句并评分，降低寒暄和低信息收尾权重，提高包含结论、原因、建议、最终判断等句子的权重；分别从回答前半段和后半段选择核心内容，压缩成“回答先说明……，并最终指出……”的一句话，避免只看回答开头。将回归脚本更新为 `scripts/check-answer-overview-regression.js`，要求保留全文评分和前后内容合并逻辑。
- 回归测试：运行 `npm run check:regression-log`；运行 `npm run check`；静态回归检查 `node scripts/check-answer-overview-regression.js`。
- 验证结果：`npm run check:regression-log` 通过；`npm run check` 通过，`[answer-overview-regression] ok`；已检查 `AGENTS.md`、`REGRESSION_LOG.md`、`src/content/content.js`、`src/content/content.css`、`README.md`、`package.json` 和回答概览回归检查；命中前述总结/预览历史记录，本次未修改滑轨滚轮逻辑、`getRailQuestions()` 和目录问题采集过滤。额外的本地示例动态抽样因沙箱报告“磁盘空间不足”未能运行，仍需在真实 ChatGPT 页面重新加载扩展后人工确认概览质量。
- 相关文件：`src/content/content.js`、`src/content/content.css`、`scripts/check-answer-overview-regression.js`、`package.json`、`README.md`、`REGRESSION_LOG.md`

## 2026-06-15 - 相同或长前缀相同的问题被目录和滑轨合并

- 问题现象：不同 ChatGPT turn 中出现完全相同的问题文本，或问题前 300 字相同但结尾不同，目录和滑轨会把它们合并；异步点击定位期间 UI 重新渲染时，还会因继续访问失效的 `event.currentTarget` 抛出运行时错误。该问题与 `2026-05-29 - 三横线目录只显示部分问题` 直接相关：之前防线只检查混合 DOM 扫描和目录过滤，没有覆盖重复文本身份、DOM 替换和异步点击。
- 影响范围：问题识别、目录和滑轨数量、问题排序、缓存序列化、深度采集顺序、重复问题点击定位、DOM 重渲染后的交互稳定性；需继续保护 `2026-05-27 - 滑轨滚轮向下滚动回弹`。
- 修复方式：问题身份优先使用 ChatGPT turn number，其次使用稳定 id 或 element key，仅在没有结构身份且全文哈希唯一时才回退到全文哈希；已知 turn 不允许回退匹配另一个已知 turn 的 element key；合并、插入排序、深度采集顺序和缓存键统一使用稳定身份，不再使用截断文本哈希合并不同 turn；异步点击处理在 `await` 前保存触发元素。深度采集保留 10% 视口重叠，将每步从 0.7 个视口提高到 0.9 个视口，并缩短后续 DOM 稳定检查前的重复固定等待。新增真实加载 `src/content/content.js` 的本地导航夹具，覆盖重复/相似问题、DOM 替换、实时新增、点击定位、滑轨滚动、虚拟化重复问题和缓存恢复。
- 回归测试：运行 `npm run check:regression-log`；运行 `npm run check`；运行 `git diff --check`；在真实 Chrome 中运行 `tests/navigation-core-fixture.html?scenario=basic&fixtureRun=<unique>`。
- 验证结果：已检查 `AGENTS.md`、`REGRESSION_LOG.md`、`src/content/content.js`、`src/content/content.css`、`scripts/check-question-directory-regression.js`、`tests/navigation-core-fixture.js` 和当前工作区 diff；命中 `2026-05-27 - 滑轨滚轮向下滚动回弹` 与 `2026-05-29 - 三横线目录只显示部分问题`。`npm run check` 和 `git diff --check` 通过；真实 Chrome 基础夹具 7 项、虚拟化夹具 4 项、缓存恢复夹具 3 项全部通过，覆盖重复/相似问题、点击定位、DOM 替换、实时新增、滑轨首尾独立滚动、空闲不持续重建、从中间进入、向上加载、深度采集和缓存恢复；虚拟化与恢复场景均确认两个相同文本问题保持为两条记录，深度采集在 45 秒验收窗内完成。真实 ChatGPT 页面的自动化读取和截图会在 30 秒后超时并重置 Chrome 自动化内核，Windows 桌面通道又因 `@oai/sky` 子路径导出错误无法启动，因此仍需按 `docs/MANUAL_TEST_CHECKLIST.md` 人工验证真实扩展页面。
- 相关文件：`src/content/content.js`、`scripts/check-question-directory-regression.js`、`scripts/check-navigation-core-fixture.js`、`scripts/serve-navigation-fixture.js`、`tests/navigation-core-fixture.html`、`tests/navigation-core-fixture.js`、`package.json`、`REGRESSION_LOG.md`

## 2026-06-16 - 右侧横线导航不能只换外观

- 问题现象：用户希望学习 ChatGPT 网页端官方右侧横线问题导航的效果，而不是把既有圆点滑轨简单换成横线外观；旧实现右侧导航偏向只展示已有强锚点或当前可加载的问题，弱锚点历史问题主要依赖目录和深度采集，点击体验无法达到“识别完整并快速跳转”的目标。
- 影响范围：右侧问题导航渲染、点击定位、重复问题身份解析、缓存/弱锚点历史问题定位、目录状态文案、导航夹具和手工验收文档。该问题直接关联 `2026-05-27 - 滑轨滚轮向下滚动回弹`、`2026-05-29 - 三横线目录只显示部分问题` 和 `2026-06-15 - 相同或长前缀相同的问题被目录和滑轨合并`。
- 修复方式：将右侧导航改为官方风格的横线 marker，并保留 `.cqr-dot` 兼容选择器；新增 `canAttemptQuestionLocate()`，让右侧横线导航展示所有已记录且可尝试定位的问题，而不是只展示强锚点问题；点击时按 question id、turn number、序号加全文 hash 重新解析最新问题，避免重复文本误跳；新增 `locateQuestionByVerifiedPositions()`，在长搜之前先逐个尝试已验证 DOM、缓存锚点、相邻锚点和索引估算位置，每次滚动后都验证目标问题；无强锚点问题也会进入 turn number、索引定位和 `directedDeepLocateQuestion()` 深度回退。更新静态检查，防止以后退回圆点视觉、只换外观或移除深度定位兜底。
- 回归测试：运行 `node scripts/check-official-line-navigation-regression.js`；运行 `node scripts/check-navigation-core-fixture.js`；运行 `node --check tests/navigation-core-fixture.js`；运行 `npm run check:regression-log`；运行 `npm run check`；运行 `git diff --check`。
- 验证结果：已检查 `AGENTS.md`、`REGRESSION_LOG.md`、`src/content/content.js`、`src/content/content.css`、`scripts/check-question-directory-regression.js`、`scripts/check-navigation-core-fixture.js`、`tests/navigation-core-fixture.js`、`README.md`、`docs/MANUAL_TEST_CHECKLIST.md`、`docs/VOYAGER_MVP_SPEC.md` 和 `docs/GOAL_STATUS.md`；命中上述三条历史修复记录。本次通过增强定位能力后才放宽右侧导航展示范围，仍保留滚轮隔离、稳定身份和异步点击 trigger 保存防线。`npm run check:regression-log`、`npm run check` 和 `git diff --check` 通过；内置浏览器尝试打开本地夹具 `127.0.0.1:4173` 时被安全策略拒绝，未能执行真实浏览器夹具，仍需按 `docs/MANUAL_TEST_CHECKLIST.md` 或允许的本地浏览器环境人工验证真实点击效果。
- 相关文件：`src/content/content.js`、`src/content/content.css`、`scripts/check-official-line-navigation-regression.js`、`scripts/check-navigation-core-fixture.js`、`tests/navigation-core-fixture.js`、`package.json`、`README.md`、`docs/MANUAL_TEST_CHECKLIST.md`、`docs/VOYAGER_MVP_SPEC.md`、`docs/GOAL_STATUS.md`、`REGRESSION_LOG.md`

## 2026-06-16 - 插件横线与 ChatGPT 官方问题导航重复

- 问题现象：ChatGPT 网页端已经上线官方右侧横线问题导航和跳转返回按钮后，插件上一条修复新增的右侧横线 marker 与官方横线同时显示，导致右侧出现两套相似横线、菜单入口和官方导航视觉混杂。用户希望保留插件菜单与目录、导出、公式复制等功能，但取消插件自绘问题横线。
- 影响范围：右侧插件 rail/marker 渲染、官方问题导航点击和滚轮区域、Voyager 菜单触发区、目录入口、导航夹具、官方导航集成静态检查、README 和手工验收文档。该问题是对 `2026-06-16 - 右侧横线导航不能只换外观` 的再次修正；之前防线只强调插件要实现横线导航效果，没有纳入 ChatGPT 官方同类能力上线后的重复 UI 风险。
- 修复方式：停止创建 `.cqr-rail-track` 和 `.cqr-dot/.cqr-question-line` marker，旧 `#cgpt-question-rail` 容器保留为隐藏占位但不拦截官方导航；保留 `.cqr-menu-trigger` 和 `.cqr-menu-button`，让用户仍可在官方导航中部附近打开 Voyager 菜单；目录列表、目录项点击定位、导出和公式复制初始化不变。将 `scripts/check-official-line-navigation-regression.js` 改为检查“不得渲染插件自有横线/轨道，但必须保留菜单入口和公式复制初始化”；更新导航夹具，要求无插件 marker 且目录功能仍可用。
- 回归测试：运行 `node scripts/check-official-line-navigation-regression.js`；运行 `node scripts/check-navigation-core-fixture.js`；运行 `node --check tests/navigation-core-fixture.js`；运行 `npm run check:regression-log`；运行 `npm run check`；运行 `git diff --check`。
- 验证结果：已检查用户截图、`AGENTS.md`、`REGRESSION_LOG.md`、`src/content/content.js`、`src/content/content.css`、`scripts/check-official-line-navigation-regression.js`、`scripts/check-navigation-core-fixture.js`、`tests/navigation-core-fixture.js`、`README.md`、`docs/MANUAL_TEST_CHECKLIST.md`、`docs/VOYAGER_MVP_SPEC.md` 和 `docs/GOAL_STATUS.md`；命中 `2026-05-27 - 滑轨滚轮向下滚动回弹`、`2026-05-29 - 三横线目录只显示部分问题`、`2026-06-15 - 相同或长前缀相同的问题被目录和滑轨合并` 和上一条 `2026-06-16 - 右侧横线导航不能只换外观`。本次不再由插件承担右侧横线跳转，避免覆盖官方能力；目录内点击定位仍保留稳定身份和验证式定位防线。测试结果见交付说明。
- 相关文件：`src/content/content.js`、`src/content/content.css`、`scripts/check-official-line-navigation-regression.js`、`scripts/check-navigation-core-fixture.js`、`tests/navigation-core-fixture.js`、`README.md`、`docs/MANUAL_TEST_CHECKLIST.md`、`docs/VOYAGER_MVP_SPEC.md`、`docs/GOAL_STATUS.md`、`REGRESSION_LOG.md`

## 2026-06-16 - WPS LaTeX 公式复制输出断裂命令

- 问题现象：使用插件复制 ChatGPT 公式为 WPS LaTeX 后，在 WPS 的“插入 LaTeX”中粘贴并回车没有转换为公式，而是显示普通文本；截图中可见 `\ frac`、`\ mid`、`\ sum`、`\ operatorname`、`\ left`、`\ sqrt`、`\ det`、`\ qquad`、`\ ne` 等反斜杠命令被空格断开或包含 WPS 易失败命令。
- 影响范围：公式复制工具栏中的 `WPS LaTeX` 菜单项；从 KaTeX 公式、选中文本或浏览器可见公式文本提取出的 LaTeX；不影响右侧官方导航集成、目录、导出和 Word UnicodeMath 主路径。该问题未命中完全相同历史记录，但与 `2026-06-16 - 插件横线与 ChatGPT 官方问题导航重复` 中“保留公式复制初始化”的防线相关，说明之前只保护了入口存在，没有覆盖 WPS 输出内容质量。
- 修复方式：在 WPS LaTeX 格式化前新增断裂命令归一化，将 `\ frac`、`\ sqrt`、`\ det`、`\ ne` 等恢复为合法命令；将 `\operatorname{...}` 和 `\det` 转为更适合 WPS 的 `\mathrm{...}`；将 `\ne` 统一为 `\neq`，移除 `\quad` / `\qquad`，将 `\mid` 转为普通竖线并移除 `\left` / `\right` 定界命令；保留既有求和/乘积嵌套兼容处理。同步增强选区识别，让 `\ frac` 这类浏览器选区文本也能被识别为公式候选。新增 `scripts/check-formula-copy-regression.js` 覆盖截图中的 Bayes/attention、伴随矩阵/行列式断裂命令和 K-means 嵌套求和兼容。
- 回归测试：运行 `node scripts/check-formula-copy-regression.js`；运行 `node --check src/content/formulaCopy/clipboard.js`；运行 `node --check src/content/formulaCopy/extractFormulaData.js`；运行 `node --check src/content/formulaCopy/FormulaCopyManager.js`；运行 `npm run check:regression-log`；运行 `npm run check`；运行 `git diff --check`。
- 验证结果：已检查用户截图、`AGENTS.md`、`REGRESSION_LOG.md`、`src/content/formulaCopy/clipboard.js`、`src/content/formulaCopy/extractFormulaData.js`、`src/content/formulaCopy/FormulaCopyManager.js`、`package.json`、`docs/MANUAL_TEST_CHECKLIST.md` 和 `scripts/check-official-line-navigation-regression.js`；未命中相同 WPS LaTeX 历史修复记录。`node scripts/check-formula-copy-regression.js`、`node --check scripts/check-formula-copy-regression.js` 和公式复制脚本 `node --check` 已通过；完整检查结果见交付说明。仍需在真实 WPS 中重新加载扩展后人工验证“WPS LaTeX”粘贴回车能转成公式。
- 相关文件：`src/content/formulaCopy/clipboard.js`、`src/content/formulaCopy/extractFormulaData.js`、`src/content/formulaCopy/FormulaCopyManager.js`、`scripts/check-formula-copy-regression.js`、`package.json`、`REGRESSION_LOG.md`

## 2026-06-16 - WPS LaTeX 不接受文本样式命令导致整段解析失败

- 问题现象：继续测试 `\mathrm{head}_i = \mathrm{softmax}(\frac{...}{\sqrt{...}})VW_i^V` 时，WPS 的“插入 LaTeX”仍未转换为公式，而是把 `\ mathrm`、`\ frac`、`\ sqrt` 等显示成普通文本。该问题是对 `2026-06-16 - WPS LaTeX 公式复制输出断裂命令` 的再次修正；上一条防线只修复了断裂命令和部分易失败命令，但错误地把 `\operatorname` 转成了 WPS 同样不稳定的 `\mathrm`，也没有强制 WPS 输出为单行基础 LaTeX。
- 影响范围：公式复制工具栏和 content.js fallback 工具栏中的 `WPS LaTeX`；包含函数名、矩阵头、softmax/head/det/adj 等文本函数名的公式；不影响 Word UnicodeMath、Markdown LaTeX 和原始 LaTeX。
- 修复方式：WPS LaTeX 输出不再生成 `\mathrm`、`\text`、`\mbox` 或 `\operatorname`，而是保留纯文本函数名如 `head_i`、`softmax`、`det(A)`、`adj(A)`；继续保留 `\frac`、`\sqrt`、`\sum`、`\neq` 等基础结构；将 WPS 输出压成单行，避免 WPS 对多行 LaTeX 输入解析失败。同步修改 content.js 的公式复制 fallback，让 fallback 的 `WPS LaTeX` 也调用共享的 `formatForWpsLatex()`，而不是只去掉分隔符。扩展 `scripts/check-formula-copy-regression.js`，禁止 WPS 输出包含 `\mathrm` 和换行，并覆盖用户截图中的 `head_i/softmax` 公式。
- 回归测试：运行 `node scripts/check-formula-copy-regression.js`；运行 `node --check scripts/check-formula-copy-regression.js`；运行 `node --check src/content/formulaCopy/clipboard.js`；运行 `node --check src/content/content.js`；运行 `npm run check:regression-log`；运行 `npm run check`；运行 `git diff --check`。
- 验证结果：已检查用户截图、`AGENTS.md`、`REGRESSION_LOG.md`、`src/content/formulaCopy/clipboard.js`、`src/content/content.js`、`src/content/formulaCopy/extractFormulaData.js`、`src/content/formulaCopy/FormulaCopyManager.js`、`scripts/check-formula-copy-regression.js`、`package.json` 和 `docs/MANUAL_TEST_CHECKLIST.md`；命中上一条 `2026-06-16 - WPS LaTeX 公式复制输出断裂命令`，本次补上禁止 `\mathrm`、强制单行和 fallback 入口同步检查。相关本地检查已通过；完整检查结果见交付说明。仍需在真实 WPS 中重新加载扩展后人工验证。
- 相关文件：`src/content/formulaCopy/clipboard.js`、`src/content/content.js`、`scripts/check-formula-copy-regression.js`、`REGRESSION_LOG.md`

## 2026-06-16 - 导出菜单只识别当前已加载的 24 条消息

- 问题现象：用户截图中长对话实际问题数量远超 24 个，但插件“导出”页只列出当前 DOM 中的 User/Assistant 消息，停在 `User 23`、`Assistant 24` 一类可见窗口；这与目录已经能通过缓存和深度采集记录更多问题的能力脱节，导致问题导出不完整。
- 影响范围：悬浮面板“导出”标签页的问题识别、Markdown 问题清单整理、长对话虚拟滚动场景、目录问题缓存复用；需继续避免破坏 `2026-05-29 - 三横线目录只显示部分问题`、`2026-06-15 - 相同或长前缀相同的问题被目录和滑轨合并` 和 `2026-06-16 - 插件横线与 ChatGPT 官方问题导航重复`。
- 修复方式：将导出页拆成“问题 / 对话”两个模式，默认进入“问题”模式；问题模式使用 `getDirectoryQuestions()` 和稳定问题 key 生成选择列表与 Markdown，不再依赖当前页面可见的 `[data-message-author-role]` 消息节点，因此可导出缓存和深度采集得到的全部已记录问题；原有 User/Assistant 消息导出保留为“对话”模式，PDF 和图片仍只对已加载 DOM 消息开放。导出页新增当前识别数量和“深度采集”入口；新增 `scripts/check-export-question-regression.js`，并扩展真实内容脚本夹具，覆盖普通对话、深度采集后的虚拟滚动对话和缓存恢复后的问题导出数量。
- 回归测试：运行 `node scripts/check-export-question-regression.js`；运行 `node scripts/check-navigation-core-fixture.js`；运行 `node --check src/content/content.js`；运行 `node --check tests/navigation-core-fixture.js`；运行 `node --check scripts/check-export-question-regression.js`；运行 `npm run check:regression-log`；运行 `npm run check`；运行 `git diff --check`。
- 验证结果：已检查用户截图、`AGENTS.md`、`REGRESSION_LOG.md`、`src/content/content.js`、`src/content/content.css`、`tests/navigation-core-fixture.js`、`scripts/check-navigation-core-fixture.js`、`README.md`、`package.json` 和相关回归检查脚本；命中 `2026-05-29 - 三横线目录只显示部分问题`、`2026-06-15 - 相同或长前缀相同的问题被目录和滑轨合并` 与 `2026-06-16 - 插件横线与 ChatGPT 官方问题导航重复`。本次只取消导出页对当前 DOM 消息的默认依赖，不恢复插件自绘右侧横线；重复问题仍按稳定身份导出。`node scripts/check-export-question-regression.js`、`node scripts/check-navigation-core-fixture.js`、`npm run check:regression-log`、`npm run check` 和 `git diff --check` 已通过；内置浏览器拒绝访问 `http://127.0.0.1:4173` 本地夹具目标，未能执行真实浏览器动态夹具，需按交付说明人工验证。
- 相关文件：`src/content/content.js`、`src/content/content.css`、`tests/navigation-core-fixture.js`、`scripts/check-export-question-regression.js`、`scripts/check-navigation-core-fixture.js`、`package.json`、`README.md`、`REGRESSION_LOG.md`

## 2026-06-21 - 发布版本号与标签语义未对齐

- 问题现象：当前功能改动准备发布到 GitHub 时，`manifest.json` 和 `package.json` 仍显示 `0.1.0`，但仓库已有 `v0.2` 和 `v0.3` 标签指向发布前提交；如果继续发布，会导致扩展详情、issue 反馈模板和 GitHub release/tag 版本语义不一致。
- 影响范围：Chrome 扩展版本显示、GitHub release 标签、发布说明、问题反馈中的版本定位；不影响内容脚本的目录、导出、官方导航集成和公式复制运行逻辑。
- 修复方式：将 `manifest.json` 和 `package.json` 版本提升为 `0.3.0`，同步更新 issue 模板版本示例和 `docs/GOAL_STATUS.md` 的发布状态；由于旧 `v0.3` 已存在，本次使用 `v0.3.0` 作为发布标签；本地辅助文件 `.workbuddy/` 和空文件 `代码.txt` 不纳入发布提交。
- 回归测试：运行 `npm run check:regression-log`；运行 `npm run check`；运行 `npm run build`；运行 `git diff --check`。
- 验证结果：已检查 `AGENTS.md`、`REGRESSION_LOG.md`、`manifest.json`、`package.json`、`.github/ISSUE_TEMPLATE/bug_report.yml`、`docs/GOAL_STATUS.md`、README、发布/打包脚本和当前 Git 标签；命中 `2026-06-16 - 导出菜单只识别当前已加载的 24 条消息` 等发布候选相关记录，本次只做版本与发布状态对齐，不修改已验证的功能逻辑。
- 相关文件：`manifest.json`、`package.json`、`.github/ISSUE_TEMPLATE/bug_report.yml`、`docs/GOAL_STATUS.md`、`REGRESSION_LOG.md`

## 2026-06-21 - GitHub Release 缺少可执行发布通道

- 问题现象：本机没有 `gh` CLI，GitHub App 连接器也没有 release 创建接口；仅推送 `v0.3.0` 标签不会自动生成 GitHub Release 页面和扩展 zip 资产，无法满足“发布 release 版本”的交付要求。
- 影响范围：GitHub Release 页面、发布资产下载、后续用户按 release 安装扩展；不影响已推送到 `main` 的功能代码和 `v0.3.0` 标签。
- 修复方式：新增一次性 GitHub Actions 发布工作流 `.github/workflows/release-v0.3.0.yml`，在该 workflow 文件推送到 `main` 时，从 `v0.3.0` 标签 checkout，运行 `npm run build`，压缩 `dist/` 为 `chatgpt-voyager-v0.3.0.zip`，并用仓库 `GITHUB_TOKEN` 创建或更新 `v0.3.0` GitHub Release。
- 回归测试：运行 `npm run check:regression-log`；运行 `npm run check`；运行 `git diff --check`；推送后检查 GitHub Actions 和 Release 页面。
- 验证结果：已检查 `AGENTS.md`、`REGRESSION_LOG.md`、`.github/ISSUE_TEMPLATE/*`、发布标签、打包脚本和本机 GitHub 工具可用性；本次只新增 release 发布通道，不修改扩展运行逻辑。
- 相关文件：`.github/workflows/release-v0.3.0.yml`、`REGRESSION_LOG.md`

## 2026-06-21 - 导出问题索引未复用官方可读导航条目

- 问题现象：插件导出页的问题清单仍主要依赖 Voyager 自己通过当前 DOM、滚动和深度采集建立的问题索引；当 ChatGPT 网页端官方右侧横线导航已经识别到问题，但页面虚拟滚动尚未加载历史段落时，导出页不能主动利用官方导航中可读的问题标题。
- 影响范围：导出页“问题”模式的问题数量、长对话未滚动历史段落的 Markdown 问题清单、导出状态提示；需继续避免破坏官方右侧横线不重复、目录完整性、重复问题身份和对话/PDF/图片只导出已加载消息的既有防线。
- 修复方式：新增官方导航可读条目导入逻辑，只从非 Voyager 的右侧导航按钮/链接中读取 `aria-label`、`title`、可见文本等可复制标题，并过滤导航容器标签和不可读横线；导出页渲染前自动同步这些官方可读条目到问题索引和缓存，状态栏显示官方导航同步结果。官方导航不暴露正文时仍提示滚动或深度采集，不把不可读 marker 伪造成问题正文。扩展导出回归检查和真实内容脚本夹具，覆盖官方导航 `aria-label` 可读条目补入导出清单，同时继续检查不恢复插件自绘横线。
- 回归测试：运行 `node --check src/content/content.js`；运行 `node --check tests/navigation-core-fixture.js`；运行 `node --check scripts/check-export-question-regression.js`；运行 `node --check scripts/check-navigation-core-fixture.js`；运行 `node scripts/check-export-question-regression.js`；运行 `node scripts/check-navigation-core-fixture.js`；运行 `node scripts/check-official-line-navigation-regression.js`；运行 `npm run check:regression-log`；运行 `npm run check`；运行 `git diff --check`。
- 验证结果：已检查用户截图、`AGENTS.md`、`REGRESSION_LOG.md`、`src/content/content.js`、`src/content/content.css`、`tests/navigation-core-fixture.js`、`scripts/check-export-question-regression.js`、`scripts/check-navigation-core-fixture.js`、`scripts/check-official-line-navigation-regression.js`、`README.md` 和 `docs/MANUAL_TEST_CHECKLIST.md`；命中 `2026-05-29 - 三横线目录只显示部分问题`、`2026-06-15 - 相同或长前缀相同的问题被目录和滑轨合并`、`2026-06-16 - 插件横线与 ChatGPT 官方问题导航重复` 和 `2026-06-16 - 导出菜单只识别当前已加载的 24 条消息`。本次只读取官方导航可复制文本，不接管官方点击/滚轮，不恢复插件横线；重复文本仍按出现顺序和稳定键合并。真实 ChatGPT 页面仍需重新加载扩展后人工确认官方导航是否实际暴露可读标题。
- 相关文件：`src/content/content.js`、`src/content/content.css`、`tests/navigation-core-fixture.js`、`scripts/check-export-question-regression.js`、`scripts/check-navigation-core-fixture.js`、`README.md`、`docs/MANUAL_TEST_CHECKLIST.md`、`REGRESSION_LOG.md`

## 2026-06-22 - 问题模式下 PDF 和图片导出按钮不可点击

- 问题现象：导出页默认处于“问题”模式时，“导出 PDF”和“导出图片”按钮显示为灰色不可点击；用户会误以为导出功能失效。该问题直接来自 `2026-06-16 - 导出菜单只识别当前已加载的 24 条消息` 中“问题模式仅支持 Markdown”的防线，该防线只考虑了历史助手 DOM 不完整，没有覆盖“问题清单本身也应能生成 PDF/图片”的使用场景。
- 影响范围：导出页问题模式、问题清单 PDF 打印预览、问题清单 PNG 图片导出、导出按钮可用性和手工验收说明；需继续保留对话模式只导出当前已加载消息，避免声称导出未加载的历史回复。
- 修复方式：将选中问题转换为独立的 `Question` 打印项，复用现有 PDF 预览/打印流程导出问题清单；新增问题清单图片渲染文档，复用原有分段截图到 Canvas 的 PNG 导出流程；移除问题模式下 PDF/图片按钮禁用逻辑，改为根据当前模式设置明确 tooltip。更新导出回归脚本和真实内容脚本夹具，要求问题模式下 PDF/图片按钮保持可点击，并禁止恢复旧的 Markdown-only 限制。
- 回归测试：运行 `node --check src/content/content.js`；运行 `node --check tests/navigation-core-fixture.js`；运行 `node --check scripts/check-export-question-regression.js`；运行 `node scripts/check-export-question-regression.js`；运行 `node scripts/check-navigation-core-fixture.js`；运行 `node scripts/check-official-line-navigation-regression.js`；运行 `npm run check:regression-log`；运行 `npm run check`；运行 `git diff --check`。
- 验证结果：已检查用户截图、`AGENTS.md`、`REGRESSION_LOG.md`、`src/content/content.js`、`scripts/check-export-question-regression.js`、`scripts/check-navigation-core-fixture.js`、`tests/navigation-core-fixture.js`、`README.md` 和 `docs/MANUAL_TEST_CHECKLIST.md`；命中 `2026-06-16 - 导出菜单只识别当前已加载的 24 条消息` 和 `2026-06-21 - 导出问题索引未复用官方可读导航条目`。本次不改变对话模式的 DOM 消息导出边界，只让问题模式导出已记录问题清单。真实 ChatGPT 页面仍需重新加载扩展后人工确认问题模式下 PDF/图片按钮不再灰掉，并能打开打印预览或下载 PNG。
- 相关文件：`src/content/content.js`、`scripts/check-export-question-regression.js`、`scripts/check-navigation-core-fixture.js`、`tests/navigation-core-fixture.js`、`README.md`、`docs/MANUAL_TEST_CHECKLIST.md`、`REGRESSION_LOG.md`

## 2026-07-19 - Goal 状态基准落后于当前工作区

- 问题现象：`docs/GOAL_STATUS.md` 仍以 2026-06-15 和 `e1e3e66` 为基准，盘点内容也来自更早的工作区；继续沿用会把当前官方导航条目同步、问题模式 PDF/PNG 和路线文档改动遗漏或错误归类为已验收。
- 影响范围：后续开发交接、阶段判断、未提交改动保护和验收顺序；不影响扩展运行逻辑。
- 修复方式：以 2026-07-19、当前 HEAD `9f55741` 和实际 `git diff --numstat` 重建状态文档，分别列出已完成、待验收和阻塞项，并明确仍处于阶段 0、不得提前开发下一阶段。本次不修改任何业务代码，也不清理用途未知的未跟踪文件。
- 回归测试：本次为状态文档修复，没有新增业务测试；复用现有 `npm run check:regression-log`、`npm run check`、`npm run build` 和 `git diff --check`，并人工核对 `git status`、`git diff --stat`、`git diff --numstat`、HEAD 和状态文档表格。
- 验证结果：已检查 `AGENTS.md`、`docs/VOYAGER_PLAN.md`、`docs/VOYAGER_MVP_SPEC.md`、旧 `docs/GOAL_STATUS.md`、`REGRESSION_LOG.md`、全部 10 个已跟踪改动文件、`.workbuddy/` 和 `代码.txt`；命中 2026-05-29 目录缺项、2026-06-15 重复问题合并、2026-06-16 官方导航重复与导出不完整、2026-06-21 官方可读导航未复用、2026-06-22 问题模式 PDF/PNG 禁用记录。`npm run check:regression-log`、`npm run check`、`npm run build` 和 `git diff --check` 均通过；仅有 LF/CRLF 转换警告。构建已刷新忽略目录 `dist/`，没有产生新的 Git 跟踪改动。
- 相关文件：`docs/GOAL_STATUS.md`、`REGRESSION_LOG.md`

## 2026-07-19 - 动态导航夹具在高速 Chrome 中过早断言

- 问题现象：首次以本机 headless Chrome 动态运行 `basic` 导航夹具时，菜单入口已经初始化，但夹具立即读取目录和问题导出列表，得到 0 条并报错；补足初始化等待后，10 个功能断言逐项通过，但场景聚合计数仍沿用 9，导致页面最终状态被误报为 FAIL。
- 影响范围：本地浏览器级导航回归证据；会把尚未完成 MutationObserver 防抖采集的正常初始化过程误报为目录/导出回归，但不直接证明真实 ChatGPT 页面存在缺陷。
- 修复方式：在 basic 场景配置初始问题并等待菜单后，继续等待目录问题数达到预期，再进入同步断言，并把 basic 聚合计数与实际 10 个功能断言对齐；新增无第三方依赖的 `scripts/run-navigation-browser-fixture.js`，使用独立临时浏览器配置顺序运行 basic、virtualized、restore，解析页面最终状态，并复用同一配置验证缓存恢复；新增 `npm run check:browser-fixture`，同时把运行器语法检查接入 `npm run check`。
- 回归测试：运行 `npm run check:browser-fixture`；运行 `npm run check:regression-log`；运行 `npm run check`；运行 `npm run build`；运行 `git diff --check`。
- 验证结果：`npm run check:browser-fixture` 通过：basic 10 个功能断言、virtualized 4 个功能断言、restore 3 个功能断言全部 PASS，三个场景各自的“无未捕获运行时错误”检查也通过；`npm run check:regression-log`、`npm run check`、`npm run build` 和 `git diff --check` 均通过，仅有既有 LF/CRLF 转换提示。真实 ChatGPT 页面仍必须按 `docs/MANUAL_TEST_CHECKLIST.md` 人工验收，本地夹具结果不能替代该门槛。
- 相关文件：`tests/navigation-core-fixture.js`、`scripts/run-navigation-browser-fixture.js`、`package.json`、`REGRESSION_LOG.md`

## 2026-07-19 - Word UnicodeMath 复合分数丢失分组且文本函数命令破损

- 问题现象：建立固定公式语料时，`\\frac{a+b}{c-d}` 被转换为有歧义的 `a+b/c-d`，根号内的复合分数也会改变运算分组；`\\mathrm{head}`、`\\mathrm{softmax}` 被通用命令处理破坏为 `\\mathrmhead`、`\\mathrmsoftmax`。
- 影响范围：Word UnicodeMath 复制中的复合分数、根号内分数和科研/工程公式常见文本函数；不改变 WPS LaTeX、Markdown LaTeX、原始 LaTeX、导航或导出逻辑。命中 `2026-06-16 - WPS LaTeX 公式复制输出断裂命令` 和 `2026-06-16 - WPS LaTeX 不接受文本样式命令导致整段解析失败`，说明同类文本命令风险此前只在 WPS 路径被覆盖。
- 修复方式：Word 分数转换分别判断分子、分母是否为原子项，包含加减或复杂结构时保留必要括号；在通用 UnicodeMath 命令替换前，将 `operatorname`、`mathrm`、`text`、`mbox` 包裹的纯文本函数转换为可读函数名，避免拼成未知反斜杠命令。矩阵和分段函数没有借此宣称支持，继续进入真实应用兼容性验收。
- 回归测试：扩展 `scripts/check-formula-copy-regression.js`，精确检查复合分数 `(a+b)/(c-d)`、根号内分数 `√((a+b)/c)` 和 Word 文本函数不含破损命令；运行 `node scripts/check-formula-copy-regression.js`、`npm run check:stage0-acceptance`、`npm run check`、`npm run build` 和 `git diff --check`。
- 验证结果：已检查 `AGENTS.md`、`REGRESSION_LOG.md`、`src/content/formulaCopy/clipboard.js`、`src/content/formulaCopy/extractFormulaData.js`、`src/content/formulaCopy/FormulaCopyManager.js`、`scripts/check-formula-copy-regression.js`、`docs/MANUAL_TEST_CHECKLIST.md` 和 20 个固定公式的转换输出；定向公式回归、`npm run check:browser-fixture`、`npm run check`、`npm run build` 和 `git diff --check` 均通过。最终 `dist/` 与 23 个构建输入逐文件 SHA-256 一致，0 缺失、0 不一致、0 额外文件。真实 Word/WPS 结果仍须写入 `docs/STAGE0_ACCEPTANCE.json`，不能用自动字符串结果替代。
- 相关文件：`src/content/formulaCopy/clipboard.js`、`scripts/check-formula-copy-regression.js`、`docs/STAGE0_ACCEPTANCE.json`、`REGRESSION_LOG.md`

## 2026-07-19 - 阶段 0 人工验收缺少统一可机检证据

- 问题现象：`docs/MANUAL_TEST_CHECKLIST.md` 只描述操作步骤，没有统一结果文件、固定 20 公式语料或发布前完整性检查；即使用户实际测过，也无法自动区分未执行、通过、失败和阻塞，存在把自动检查误当作真实 ChatGPT/Word/WPS 通过的风险。
- 影响范围：S0-03 真实 ChatGPT 验收、S0-04 Word/WPS 公式验收和 v0.3.1 发布准备；不修改扩展运行权限、UI 或数据处理。
- 修复方式：新增 `docs/STAGE0_ACCEPTANCE.json` 作为权威记录，预填构建和浏览器环境、M-01 至 M-12、20 个固定公式及 Word/WPS 自动输出，所有真实状态保持 `NOT RUN`；新增 `scripts/check-stage0-acceptance.js` 校验版本一致性、记录结构、固定语料、WPS 历史防线和当前转换输出，提供公式提示生成及 `--require-complete` 发布门禁；新增说明文档并接入 `npm run check`。
- 回归测试：运行 `node --check scripts/check-stage0-acceptance.js`；运行 `npm run check:stage0-acceptance`；确认 `npm run check:stage0-acceptance -- --require-complete` 在当前 0/12、0/20、0/20 状态下按预期失败；运行 `npm run check:regression-log`、`npm run check`、`npm run build` 和 `git diff --check`。
- 验证结果：已检查 `AGENTS.md`、`REGRESSION_LOG.md`、`docs/MANUAL_TEST_CHECKLIST.md`、`docs/VOYAGER_PLAN.md`、`docs/VOYAGER_MVP_SPEC.md`、`docs/GOAL_STATUS.md`、Manifest/package 版本、公式转换实现和既有公式回归脚本；命中两条 2026-06-16 WPS 历史修复。`npm run check:stage0-acceptance` 通过并报告 ChatGPT 0/12、Word 0/20、WPS 0/20、发布门禁 PENDING；`--require-complete` 按预期失败，公式提示生成器输出 20 个编号；`npm run check:regression-log`、`npm run check`、`npm run build` 和 `git diff --check` 均通过。真实 ChatGPT、Word、WPS 仍未执行，未被误标为通过。
- 相关文件：`docs/STAGE0_ACCEPTANCE.json`、`docs/STAGE0_ACCEPTANCE.md`、`docs/MANUAL_TEST_CHECKLIST.md`、`scripts/check-stage0-acceptance.js`、`package.json`、`docs/GOAL_STATUS.md`、`REGRESSION_LOG.md`

## 2026-09-11 - README 内容重复且实现细节挤占使用说明

- 问题现象：README 共 379 行，功能清单与使用方法重复，混入 DOM 选择器、后台消息、文件树和转换实现；安装步骤重复，支持域名说明包含无效的自引用。
- 影响范围：项目首页和随扩展分发的 README；仅调整文档，不改运行逻辑。保留工作区已有的官方可读导航同步及问题模式 PDF/PNG 说明。
- 修复方式：合并为功能、安装、使用、限制、开发及反馈来源；用表格明确导出范围和四种公式格式，保留源码/ZIP 安装、官方导航、深度采集、本地存储、兼容限制和来源说明，删除重复实现清单。
- 历史关联：命中 `2026-06-16 - 插件横线与 ChatGPT 官方问题导航重复`、`2026-06-16 - 导出菜单只识别当前已加载的 24 条消息`、`2026-06-21 - 导出问题索引未复用官方可读导航条目` 及 2026-06-22 问题模式 PDF/PNG 修复记录；本次保留这些行为边界，属于文档精简而非功能再次失效。
- 已检查本地文件：`AGENTS.md`、`REGRESSION_LOG.md`、`README.md` 及其已有 diff、`manifest.json`、`package.json`、`NOTICE.md`、`src/content/content.js`、`src/popup/popup.js`、`src/options/options.js`、`src/shared/storage.js`、`scripts/build-dist.js`、`scripts/check-regression-log.js`；同时对照 GitHub 项目首页。
- 回归测试：纯文案调整不新增业务测试；运行 `npm run check:regression-log`、`npm run check`、`git diff --check`，检查 README 本地链接。人工验证步骤：预览 README，确认图片、表格、代码块正常，按安装章节核对扩展目录选择，再确认两种导出范围和公式格式说明完整。
- 验证结果：README 从 379 行压缩为 81 行；`npm run check:regression-log`、`npm run check`、`git diff --check` 及 4 个本地图片/文档链接检查均通过，只有既有 LF/CRLF 提示。自动检查仍报告真实应用发布验收 PENDING，本次未执行浏览器及 Word/WPS 人工验收，因为仅修改文档；人工步骤见上项。
- 相关文件：`README.md`、`REGRESSION_LOG.md`。

## 2026-10-21 - 课程开发回顾语料的证据与状态核对

- 问题现象：课程汇报需要复用插件开发过程中的提示词、图片、代码与 Goal 思路；若只按记忆复述，容易将官方界面、AI 宣传图、自动转换文本或历史候选状态误写为插件最新实测结果。
- 影响范围：新增课程回顾资料 `output/course-retrospective-2026-10-21/`；不改产品代码、不改变既有未提交工作。用户明确只要充足语料，不制作 PPT。
- 整理方式：从本地历史对话只读恢复原始提示词与仍存在的用户截图，分别标注原文、节选、整理说明和演示；用当前源码实际执行公式转换，对比 HEAD 中的复合分数转换输出；独立保存原图和可复制文本。历史提示词中已废弃的截断哈希去重、自绘滑轨要求单独说明，不作为当前实现建议。
- 历史关联：引用 2026-05-29 目录缺项、2026-06-15 重复问题合并与总结流程纠偏、2026-06-16 官方导航重复及两次 WPS 失败、2026-07-19 Word 分数组合与人工验收证据记录；本次是证据整理，不声称再次修复产品缺陷。
- 已检查本地文件：`AGENTS.md`、`REGRESSION_LOG.md`、`README.md`、`NOTICE.md`、`manifest.json`、`package.json`、`docs/` 中全部 Markdown、`docs/STAGE0_ACCEPTANCE.json`、导航内容脚本及样式、公式复制模块、导航夹具和相关检查脚本、当前 Git diff，以及仅与本项目相关的历史对话记录。
- 回归测试：资料整理不新增业务测试；运行 `npm run check:regression-log`、`npm run check`、`npm run check:browser-fixture`、`git diff --check`，检查图片和文本来源、文档链接、可复制内容、页面排版，并对比任务开始时已有 12 个修改文件的 SHA-256 以确认未覆盖原有改动。
- 验证结果：`npm run check`、`npm run check:regression-log`、`git diff --check` 通过；浏览器夹具先因沙箱内 Chrome/Edge 缓存/GPU 子进程启动问题失败，在获准使用的沙箱外隔离环境重跑后，basic 10、virtualized 4、restore 3 功能断言及三个运行时错误检查全部 PASS。额外保存 basic 场景真实浏览器截图 D01，明确它是本地夹具而非 ChatGPT 实站。HTML 主文档浏览器核验无脚本异常、无缺图，复制内容与原文一致，桌面和 720px 窄屏均无横向溢出；27 条原文、27 张 PNG、3 段代码与本地链接核对通过。任务开始时已有 12 个修改文件的 SHA-256 全部不变。已恢复早期 Word 结构改善的真实前后图，但没有找到当前 WPS 注意力公式成功实拍；转换输出展示不冒充目标软件实测，真实应用完整验收仍按现有记录保留为未完成。
- 相关文件：`output/course-retrospective-2026-10-21/`、`output/.retrospective-work/`、`REGRESSION_LOG.md`。

## 2026-10-21 - 课程语料单文件分享与代码案例补充

- 问题现象：初版主 HTML 虽已嵌入正文图片，但完整提示词与部分素材仍链接到相邻文件；原有 3 段短代码不足以突出“大模型生成代码”的课程主题。
- 影响范围：仅更新课程资料与生成/验证辅助脚本；保护全部既有插件和测试代码，未制作 PPT。
- 历史关联：引用上一条“课程开发回顾语料的证据与状态核对”。初版验证的是素材包内链接存在，没有覆盖用户只转发一个 HTML 的阅读路径；本次增加移出素材目录的隔离验证。
- 修复方式：补充 5 组提示词到代码的案例，含 7 个代码/补丁块共 124 行；首次滑轨与目录修复恢复历史模型实际输出，公式案例对照真实旧版与当前源码。将 27 条完整原文、27 张图片内嵌，附件入口改为文内跳转或 data 下载；保留原始图片、代码出处与验收边界。
- 已检查本地文件：`AGENTS.md`、`REGRESSION_LOG.md`、原语料 HTML/Markdown、生成与验证脚本、原文索引、`src/content/content.js`、公式转换模块、公式回归检查，以及对应历史 fileChange 记录和当前 Git diff。
- 验证方式：将单个 HTML 复制到没有附件的隔离目录，用 Chrome 检查缺图、相对依赖、提示词展开、复制内容、图片下载及宽窄屏；校对历史代码片段与源码，运行回归日志检查及 diff 检查。纯资料修改不重跑浏览器业务夹具，复用上一条同一业务文件哈希下的 PASS 结果。
- 验证结果：隔离目录中的单文件 Chrome 验证通过，无本地附件依赖、缺图或脚本异常；27 条完整提示词、27 张图片、5 组代码案例均存在，文内原文展开、代码及提示词复制、图片下载逐字节比对通过，桌面及 720px 窄屏无横向溢出。剪贴板比较归一化 Windows CRLF 后文本一致。新增 JavaScript 摘录语法检查、`npm run check:regression-log` 与 `git diff --check` 通过；原有 12 个修改文件哈希不变。本轮未修改业务代码，未重复运行业务夹具；既有真实 ChatGPT/Word/WPS 未完成验收边界保持不变。
- 相关文件：`output/course-retrospective-2026-10-21/01_开发回顾与展示语料.html`、`07_代码生成案例补充.md`、`code/E*`、`00_阅读说明.md` 及 `output/.retrospective-work/`。

## 2026-10-25 - 对话目录与导出消息识别失效

- 问题现象：用户报告目录不能识别问题、对话导出无法采集用户问题和 ChatGPT 回答。新增浏览器夹具在修复前复现 5 项失败：混合结构目录缺项、对话仅识别 1/6 条、回复文本更新不刷新、延迟角色属性不触发采集，以及包含 ChatGPT 的正常提问被过滤。
- 原因及影响范围：`getLoadedMessages()` 仅扫描旧的 `data-message-author-role`，没有覆盖 `data-turn` 和消息 test-id；目录的正文过滤会将包含 ChatGPT/复制代码等词语的整句误判为生成内容；MutationObserver 未观察文本节点和角色属性，UI 渲染签名只包含问题位置，不包含回答变化。影响目录、回答概览、对话模式列表及 Markdown/PDF/图片共用的消息入口。当前实站 DOM 未能读取，根因描述限于已复现的本地代码缺陷。
- 历史关联：引用 `2026-05-29 - 三横线目录只显示部分问题`、`2026-06-15 - 相同或长前缀相同的问题被目录和滑轨合并`、`2026-06-16 - 导出菜单只识别当前已加载的 24 条消息` 和 `2026-06-21 - 导出问题索引未复用官方可读导航条目`。之前防线覆盖旧 role DOM、问题数量和入口存在性，没有执行新旧角色标记混用、正文更新及实际导出内容的断言，因此未能阻止本次失效。
- 修复方式：目录与导出采用共同的 user/assistant 角色选择器，兼容旧 role 属性、新 `data-turn` 和消息 test-id，优先消息正文并消除嵌套 wrapper 重复；回合标记回退时排除按钮、隐藏标签和思考区域，排除输入框/插件内容；将常见 UI 词过滤收窄到完整标签，保留正常提问；对话选择 key 优先稳定 turn；观察角色属性和 characterData，面板打开时将回答正文哈希纳入渲染签名。保留问题/对话分离、官方导航和已加载消息的导出边界。
- 已检查本地文件：`AGENTS.md`、本日志、`src/content/content.js`、`src/content/content.css`、`manifest.json`、`package.json`、`src/shared/storage.js`、`tests/navigation-core-fixture.html`、`tests/navigation-core-fixture.js`、目录/导出/回答概览/官方导航回归脚本、浏览器夹具服务及运行器、构建和日志检查脚本；检查修改前完整 Git diff，并对照本轮修改前的文件副本检查新增差异，保留原有未提交修改。
- 回归测试：新增 compatibility 浏览器场景 7 项，覆盖混合结构与重复问题、6 条 user/assistant 正文及顺序、草稿/思考/按钮排除、流式回答文本更新、勾选后的实际 Markdown 下载请求、PDF 预览正文、角色属性延迟出现及包含 ChatGPT 的正常提问。修正夹具在 Chromium 自带空 chrome 对象时未提供 runtime stub 的问题。默认浏览器测试接入该场景，同时保留 basic/virtualized/restore。
- 验证结果：修复前 compatibility 的 5 个识别/刷新断言全部 FAIL；修复后 compatibility 7 项及运行时错误检查 PASS。最终完整浏览器运行 basic 10、virtualized 4、restore 3、compatibility 7，共 24 项功能断言和 4 项运行时错误检查全部 PASS；`npm run build`（包含完整 `npm run check`、`npm run check:regression-log` 和 dist 构建）、`git diff --check` 通过。沙箱内首次启动 Chrome 因 GPU 子进程退出失败，获准在沙箱外以独立临时配置运行同一本地夹具后通过。真实 ChatGPT 页面经用户授权尝试验证，但浏览器连接先报告 Debugger unattached，随后电脑控制因无法可靠确认当前 URL 而终止；停止 UI 操作，没有将本地夹具结果标为实站通过；实站、Word/WPS 等既有发布验收仍保持 PENDING。
- 人工验证步骤：在 chrome://extensions 重新加载现有扩展（或加载本项目 dist 文件夹），刷新 ChatGPT 对话页；展开目录核对已加载问题，切换“导出 → 对话”核对交替的 User/Assistant 正文，分别导出 Markdown 和 PDF；新增回复时观察列表自动更新；长对话滚动经过历史段落后再核对。未加载的历史回答仍不承诺全量导出。
- 相关文件：`src/content/content.js`、`tests/navigation-core-fixture.js`、`scripts/run-navigation-browser-fixture.js`、`scripts/check-navigation-core-fixture.js`、`REGRESSION_LOG.md`。

## 2026-10-25 - 目录已识别问题但无法配对 GPT 回答（二次修复）

- 问题现象：用户在上一条修复后截图仍显示“当前未识别到这个问题下面的 GPT 回复”，即目录已记录问题，但回答概览未建立。再次反馈要求优先彻底修复此链路。
- 历史关联及防线失效原因：引用上一条 `2026-10-25 - 对话目录与导出消息识别失效`，以及 2026-06-02 回答配对、2026-06-15 重复问题身份与回答概览记录。上一轮虽然扩充了导出 role 选择器，但没有真正复用目录已有的无角色问题气泡回退，测试也未断言目录中的概览正文；因此目录和配对仍然可能各用一套问题节点。原有 `pairs.find()` 文本匹配还会把相同提问错误配到第一次的回答。
- 已复现原因与影响范围：在上一版代码运行新 answer-pairing 场景，目录问题存在但概览缺失、对话导出缺 2 条、重复问题配错回答、共用回合结构漏采，4 项全部 FAIL。影响问题与回答的采集、配对、目录概览及共用消息入口的导出。实站 DOM 尚无法读取，不能据此声称已经穷尽用户页面的实际结构。
- 修复方式：`getLoadedMessages()` 直接复用 `getUserMessages()` 的规范问题节点，确保目录与回答配对的问题正文及来源一致；只在对话回合中回退采集无 role 的 Markdown/Prose 回答，排除用户正文、插件、编辑区及思考区域；按实际 DOM 顺序合并，保留原节点、turnNumber 和独立的分段选择 key；配对优先稳定回合身份，只有唯一文本匹配时才回退；兼容同一回合同时包含用户与 assistant 正文，避免整段回答又被当成用户问题。
- 已检查本地文件：用户截图、`AGENTS.md`、本日志、`src/content/content.js` 的问题识别/目录渲染/回答概览/导出/缓存相邻逻辑、`tests/navigation-core-fixture.js`、`scripts/check-answer-overview-regression.js`、`scripts/check-navigation-core-fixture.js`、`scripts/run-navigation-browser-fixture.js` 及工作区既有 Git diff；另保存二次修复前源码和夹具副本进行增量核对，保留原有修改。
- 回归测试：新增默认运行的 answer-pairing 场景 6 项，实际断言目录概览包含正确回答内容，覆盖无 role 的中文问答、对应对话导出、相同提问各自的回答、同回合问答、附件外层与气泡正文不一致、多段回答合并/独立导出选择及思考排除；在回答概览检查脚本中加入复用目录节点和稳定身份/唯一匹配防线。
- 验证结果：二次修复前新增的前 4 项断言全部 FAIL，修复后 6 项全部 PASS；最终完整浏览器运行 basic 10、virtualized 4、restore 3、compatibility 7、answer-pairing 6、answer-identity 1，共 31 项功能断言和 6 项运行时错误检查全部 PASS；另覆盖非数字回合标识的重复问题，通过实际源节点找到各自回答。`npm run build`（含 check/check:regression-log）和 `git diff --check` 通过。未声称真实页面修复已验证：浏览器连接继续超时；用户提供的 GPU教材每周复习题.html 为服务器启动壳，包含 0 个问题/回答/回合节点，未包含截图中的实际消息，未执行其中任何脚本。已请用户仅复制渲染后的 main 节点到问答DOM.txt，等待该文件核对真实回答结构后继续验证。
- 人工验证步骤：重新加载本项目修复版扩展并刷新同一 ChatGPT 页面；确认该问题下出现包含实际回答内容的概览；切换“导出 → 对话”确认同时有问题和 GPT 正文；重复相同问题时核对每次各自的回答；若仍缺失，使用用户保存的页面结构继续定位，不把“重新采集”当成修复。
- 相关文件：`src/content/content.js`、`tests/navigation-core-fixture.js`、`scripts/check-answer-overview-regression.js`、`scripts/check-navigation-core-fixture.js`、`scripts/run-navigation-browser-fixture.js`、`REGRESSION_LOG.md`。

## 2026-10-25 - README 未突出三个核心功能及安装排查入口

- 问题现象：组员将插件概括为“问题导航、对话导出、公式复制”，同时反馈安装后 ChatGPT 网页没有反应；GitHub README 仍是长篇实现清单，三个核心功能和页面内入口不够明确，本地精简版也尚未同步到 GitHub。
- 原因及影响范围：首页以模块和实现细节组织内容，安装说明没有集中强调刷新现有页面、网站访问权限及入口触发方式；默认“问题”导出模式容易被误认为包含回答。本次只更新 README 和本条修复记录，不发布工作区其他尚未提交的功能改动，也不将文档更新视为实站兼容性修复。
- 历史关联：对照本地 `2026-09-11 - README 内容重复且实现细节挤占使用说明`，该次已精简本地文档，但尚未同步 GitHub，且未突出三项核心能力与安装排查；继续保留 `2026-06-16 - 插件横线与 ChatGPT 官方问题导航重复` 和 `2026-06-16 - 导出菜单只识别当前已加载的 24 条消息` 的行为边界。
- 修复方式：首页首句明确三个核心功能，以表格对应能力和入口，使用章节按同一顺序展开；文件夹和提示词归为辅助功能；新增“安装后网页没有反应”五步排查，强调扩展重新加载后还须刷新页面；明确问题清单与已加载问答的区别，保留四种公式格式、兼容限制和来源说明。核对 GitHub 当前内容脚本，未将仅本地存在的官方标题同步、问题模式 PDF/PNG 能力写成已发布特性。
- 已检查本地文件：`AGENTS.md`、本日志、`README.md`、`manifest.json`、`package.json`、`NOTICE.md`、`src/content/content.js`、`src/content/content.css`、`src/content/formulaCopy/FormulaCopyManager.js`、`src/content/formulaCopy/clipboard.js`、`src/popup/popup.js`、`src/options/options.js`、`scripts/build-dist.js`、`scripts/check-regression-log.js` 及已有 Git diff；另通过 GitHub 连接器读取远端 README、内容脚本和回归日志，区分公开版本与本地开发改动。
- 回归测试：纯文档调整不新增业务测试；运行 `npm run check:regression-log`、`npm run check`、`git diff --check`，检查 README 本地图片/文档链接。人工验证步骤：预览 GitHub README，核对首句、三项功能表、安装步骤、导出范围表和公式格式表；按新增排查步骤确认加载目录、启用状态、访问权限及刷新顺序。
- 验证结果：本地 `npm run check:regression-log`、`npm run check`、`git diff --check` 通过；真实 ChatGPT、Word/WPS 人工验收本次未执行，因为未修改运行逻辑，现有发布验收仍为 PENDING。GitHub 同步仅包含 README 和本条新增记录，保留远端原有日志及本地原有修改。
- 相关文件：`README.md`、`REGRESSION_LOG.md`。

## 2026-10-25 - 真实 ChatGPT 新搜索消息单元导致回答漏采（三次修复）

- 问题现象：前两轮本地兼容修复后，用户真实页面仍识别不到该问题下的 GPT 回答；用户明确授权直接操作浏览器，要求聚焦核心问答采集。
- 实站根因：通过浏览器读取“GPU教材每周复习题”的真实 DOM，确认旧 `data-message-author-role`、`data-turn`、`conversation-turn` 和 article 消息节点均不存在。真实页面以 `data-chatgpt-search-unit-key` / `data-content-search-unit-key` 的 `:user` / `:assistant` 后缀标记角色，以 `data-chatgpt-search-message-ids` 提供稳定身份，问题气泡使用 `data-user-message-bubble="true"`。旧目录通过 class 中的 user-message 偶然找到提问，但导出/配对没有覆盖新的 assistant 单元，因而出现截图中的缺失。
- 历史关联与防线失效：引用本日“对话目录与导出消息识别失效”和“目录已识别问题但无法配对 GPT 回答（二次修复）”。之前只证明已知旧标记与 Markdown 回合结构通过；虽然明确保留实站未验证状态，但仍没覆盖完全无 article/旧角色属性的新单元。本轮用真实 DOM 在旧代码复现 FAIL，再修复同一 DOM 至 PASS，避免再次用模拟结构替代实站证据。
- 修复方式：扩充公共 user/assistant 选择器与回合容器，识别实际搜索单元角色；规范问题节点优先精确的 data-user-message-bubble；从消息 ID 或搜索单元 key 生成稳定问题身份、去重键与导出 key，保留重复提问；兼容唯一旧位置缓存记录向新身份迁移，避免重新加载后重复索引；MutationObserver 覆盖这些新属性的延迟出现。继续保护旧结构、思考排除、同回合问答、官方导航与滚动行为。
- 已检查本地文件：`AGENTS.md`、本日志、当前 Git status/diff、`src/content/content.js` 的采集/身份/序列化/缓存/配对/导出与观察器、导航夹具及相关回归检查脚本；通过用户授权的浏览器 UI/DOM API 获取实际页面主体。私有主体只保存在 `output/.export-repair-work/real-chat-main.html` 作本机复现，未放入 src、dist、ZIP 或公开测试语料；读取后移除脚本、外部媒体和 iframe 再用于离线测试，未执行保存页面中的脚本。
- 回归测试：新增默认 modern-chat 与 modern-cache 场景，使用脱敏的真实属性结构，覆盖无旧角色/article 的 1 问 2 答、目录概览实际正文、定时生成的后续 assistant、重复问题/DOM 替换的稳定 ID 和旧缓存迁移；本机额外 real-snapshot 场景加载实际 DOM，直接断言原问题的目录概览不为空、对话列表有 3 条及两条 GPT 正文。修复前 modern-chat 与 real-snapshot 均 FAIL；修复后均 PASS。
- 验证结果：最终 basic、virtualized、restore、compatibility、answer-pairing、answer-identity、modern-chat、modern-cache、real-snapshot 共 9 个浏览器场景全部 PASS（36 项功能断言、9 项运行时错误检查）；`npm run build`（含完整 check/check:regression-log）与 `git diff --check` 通过。旧缓存场景的首次断言过早读取了未绑定 DOM 的缓存项，已改为等待问题实际 loaded 后再验证概览，最终完整重跑通过。浏览器已成功读取真实内容并保存主体；重新加载扩展的 UI 操作未完成：Chrome 内部扩展页不支持接管，随后原生窗口控制因无法可靠确认当前 URL 而被工具中止，已停止进一步 UI 操作，没有把“真实 DOM 离线通过”写成“原网页已重载并通过”。用户无需再执行控制台或保存 DOM，只需重新加载修复版扩展并刷新对话页。
- 相关文件：`src/content/content.js`、`tests/navigation-core-fixture.js`、`scripts/run-navigation-browser-fixture.js`、`scripts/check-navigation-core-fixture.js`、`scripts/check-answer-overview-regression.js`、`REGRESSION_LOG.md`。

## 2026-10-25 - 发布 v0.4.0 到 GitHub Release

- 问题现象：本地已完成 2026-10-25 三轮消息识别修复（旧角色标记失效、回答配对失败、真实 ChatGPT 新搜索单元结构漏采），9 个浏览器场景 36 项断言全部 PASS，但这些修复停留在本地工作区未提交；用户要求把修复后的最新版本以 v0.4 版本发布到 GitHub Release。
- 影响范围：`manifest.json`、`package.json`、`docs/STAGE0_ACCEPTANCE.json` 的版本号；新增 `.github/workflows/release-v0.4.0.yml` 发布工作流；本地未提交的 15 个跟踪文件修改与 4 个验收相关未跟踪文件将随发布提交。
- 历史关联：引用本日三条修复记录（对话目录与导出消息识别失效、二次修复、三次修复）以及 `2026-07-19 - 阶段 0 人工验收缺少统一可机检证据`。发布遵循 v0.3.0 既有 GitHub Actions 发布模式；阶段 0 实站/Word/WPS 人工验收仍为 PENDING，本次发布不代表验收门槛已满足，Release 说明中明确标注该限制。
- 修复方式：版本号统一升级为 0.4.0（manifest、package、验收 JSON 的 currentVersion 三处同步）；新建 tag 触发的 release-v0.4.0 工作流，checkout v0.4.0 标签后执行 `npm run build`、打包 dist 为 zip 并创建 GitHub Release；仅提交项目相关文件，不提交 `.workbuddy/`、`代码.txt`、`GPU教材每周复习题.html`、`output/`、` simplify README` 等未确认用途文件。
- 回归测试：版本升级后重跑 `npm run check` 全链（回归日志门禁、6 项静态回归、stage0 验收门禁、语法检查）与 `npm run build`；发布后通过 GitHub API 验证 Release 与 zip 附件存在。
- 验证结果：本地 `npm run check` 全链与 `npm run build` 在 0.4.0 版本下通过；`git push` 经 HTTPS 凭据管理器完成（本机 SSH 密钥未被 GitHub 接受），推送前合并了远端已有的 README 同步提交 788ccc0（回归日志冲突按本地超集解决，README 两边完全一致）。tag `v0.4.0` 推送后 GitHub Actions "Publish v0.4.0 Release" 运行成功；Release 页面 https://github.com/121209/chatgpt-voyager/releases/tag/v0.4.0 已创建（非 draft、非 prerelease），附件 `chatgpt-voyager-v0.4.0.zip` 存在且可下载。阶段 0 实站人工验收与 Word/WPS 公式验收仍为 PENDING，未随本次发布改变。
- 相关文件：`manifest.json`、`package.json`、`docs/STAGE0_ACCEPTANCE.json`、`.github/workflows/release-v0.4.0.yml`、`REGRESSION_LOG.md`

## 2026-10-26 - README 未同步 v0.4.0 发布后的修复与使用方式

- 问题现象：用户已在 2026-10-25 将本地修复版发布为 v0.4.0，但 README 仍沿用发布前文案，没有明确新安装包、旧版更新步骤及本轮已解决问题；导出说明也未体现问题模式现已支持 PDF/PNG。
- 原因及影响范围：`2026-10-25 - README 未突出三个核心功能及安装排查入口` 按当时远端旧代码编写，主动排除了尚未发布能力；随后代码和 Release 已更新，首页缺少版本与修复说明的同步。本次仅修改 README 和本条记录，不修改扩展逻辑、版本、验收状态或既有 Release 资产。
- 历史关联：对照 `2026-09-11 - README 内容重复且实现细节挤占使用说明`，继续保留面向用户的精简结构；关联 2026-10-25 三轮问答识别/回答配对修复及 v0.4.0 发布记录、`2026-06-22 - 问题模式下 PDF 和图片导出按钮不可点击`、`2026-07-19 - Word UnicodeMath 复合分数丢失分组且文本函数命令破损`。前一次 README 防线未失效于运行代码，而是发布后的文档基准发生变化。
- 修复方式：新增 v0.4.0 发布日期、发布页和 ZIP 直链，以用户现象表说明新版消息识别、回答配对、重复问题身份、流式刷新、问题清单 PDF/PNG 和公式转换改进；拆分首次安装与旧版更新，要求核对版本、重新加载扩展并刷新 ChatGPT；补充实时采集、可取消的深度采集、官方可读标题补充及本地概览；明确问题清单与已加载问答均可导出 Markdown/PDF/PNG，问题索引不等于完整回答正文；区分发布前 9 场景证据、默认 8 个公开夹具与尚未完成的真实应用验收。
- 已检查本地文件：`AGENTS.md`、本日志、`README.md`、`manifest.json`、`package.json`、`src/content/content.js`、`src/content/formulaCopy/FormulaCopyManager.js`、`src/content/formulaCopy/clipboard.js`、`src/content/content.css`、`scripts/run-navigation-browser-fixture.js`、`scripts/build-dist.js`、`docs/STAGE0_ACCEPTANCE.json`、`.github/workflows/release-v0.4.0.yml`、原有 Git status/diff 和近期提交；另核对 GitHub main 提交、README/回归日志及最新 Release 的日期、版本、说明和 ZIP 附件。远端 main 与本地 HEAD 同为 `0b70420`，两个文档的 Git blob 均一致，未将过期的 origin/main 跟踪信息当作实时远端状态。
- 回归测试：本次为纯文档更新，不新增业务测试、不重复运行浏览器业务夹具；运行 `npm run check`（含 `npm run check:regression-log`）、`git diff --check`、README 链接/代码围栏/表格检查，并对比开始时 51 个跟踪文件的 SHA-256，确认只有 README 和本日志发生变化。人工验证步骤：预览项目首页；按 ZIP 直链下载、解压、加载包含 manifest 的目录并核对 0.4.0；重载扩展后刷新对话，检查目录概览、问题/对话两种导出范围和公式复制格式。后者是用户可执行的验证步骤，不作为本次已完成的实站验收。
- 验证结果：`npm run check`、`npm run check:regression-log`、`git diff --check` 和 README 结构/链接检查通过；自动验收记录仍报告 ChatGPT 2/12 PASS、Word 0/20、WPS 0/20，发布门禁 PENDING。文档更新不需重新构建安装包，未运行真实 ChatGPT/Word/WPS 人工验收，也未改动既有业务文件及未跟踪资料。
- 相关文件：`README.md`、`REGRESSION_LOG.md`。

## 2026-10-26 - README 收敛为安装和功能用法

- 问题现象：上一条 README 更新加入过多版本、修复、测试和开发说明，用户要求仅保留插件安装及各功能使用方法。
- 历史关联：引用上一条“README 未同步 v0.4.0 发布后的修复与使用方式”和 2026-09-11 文档精简记录；此前未限制首页篇幅，本次删除扩展说明而保留实际操作。
- 修复方式：保留四步安装、更新方式及问题导航、对话导出、四种公式格式、会话文件夹、提示词与设置的简短用法。
- 已检查本地文件：AGENTS.md、REGRESSION_LOG.md、README.md、现有 Git status/diff；沿用本轮已核对的内容脚本、公式工具条和发布附件，未改业务代码或覆盖原有记录。
- 回归测试：纯文案不新增或重复运行业务测试；运行 npm run check:regression-log、git diff --check，检查下载链接与使用入口。人工验证：预览 README，按四步加载插件后逐项操作。
- 验证结果：日志及 diff 检查通过；未执行浏览器人工验证，因为本次仅精简文案。
- 相关文件：README.md、REGRESSION_LOG.md。
