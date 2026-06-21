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
