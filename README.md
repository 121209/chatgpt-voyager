# ChatGPT Voyager

**面向 ChatGPT 网页端的浏览器扩展，主要提供三个功能：问题导航、对话导出、公式复制。**

在长对话中快速找到之前的问题，将需要的问答保存下来，把回答中的数学公式复制到 Word、WPS 或 Markdown 中继续使用。

适用于 Chrome、Edge 等 Chromium 浏览器，目前仅支持 [chatgpt.com](https://chatgpt.com/) 网页端。

![ChatGPT Voyager 宣传图](assets/chatgpt-voyager-hero.png)

## 主要功能

| 核心功能 | 可以做什么 | 使用入口 |
| --- | --- | --- |
| **问题导航** | 按关键词搜索用户问题，点击跳转，查看对应回答的一句话概览 | 页面右侧 Voyager 菜单 → 目录 |
| **对话导出** | 选择需要的用户提问和 ChatGPT 回答，复制或下载 Markdown，也可导出 PDF、PNG | Voyager 面板 → 导出 → 对话 |
| **公式复制** | 将公式复制为 Word UnicodeMath、WPS LaTeX、Markdown LaTeX 或原始 LaTeX | 悬停公式或选中公式文本 → 复制公式 |

另外提供本地会话文件夹、提示词库和基础设置，作为辅助整理工具。

## 安装

1. 从 [Releases](https://github.com/121209/chatgpt-voyager/releases) 下载扩展 ZIP 并解压，也可直接使用克隆或解压后的源码目录。
2. 打开 Chrome 的 `chrome://extensions/` 或 Edge 的 `edge://extensions/`，开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的目录（不是 ZIP 文件）。
4. 确认扩展已启用，打开或刷新 [ChatGPT](https://chatgpt.com/) 中已有问答的对话页，在页面右侧寻找 Voyager 菜单入口。

**安装后必须刷新已经打开的 ChatGPT 页面。** 更新源码或替换扩展文件后，也需要先在扩展管理页点击“重新加载”，再刷新 ChatGPT 页面。

## 使用

### 1. 问题导航

点击或悬停右侧官方问题导航附近的 Voyager 菜单入口，打开“目录”。输入关键词筛选问题，点击条目跳转；拖动面板边缘或四角可调整尺寸。右侧问题横线及其跳转由 ChatGPT 官方导航提供。

长对话中若有问题缺失，可滚动经过历史内容或点击“深度采集”，补充已记录的问题；尚未加载的历史问题可能需要先找回位置才能跳转。

### 2. 对话导出

打开“导出”标签页，**需要同时导出提问和回答时，先切换到“对话”模式**，勾选条目，再点击导出按钮。可用“全选”或“清空”调整范围。

| 模式 | 导出范围 |
| --- | --- |
| 问题（默认） | 目录中已记录的问题清单，不包含 ChatGPT 回答 |
| 对话 | 当前页面已加载的用户和助手消息，不包含尚未加载的历史回复 |

两种模式均可将所选内容复制为 Markdown 或下载为 `.md`。导出问答内容的 PDF、PNG 时，请使用“对话”模式：PDF 通过浏览器打印预览保存，PNG 生成图片并下载。对话 PDF 会尽量保留代码块和公式结构，PNG 需要当前活动标签页的截图权限，内容过长时请分批导出。

### 3. 公式复制

悬停公式或选中公式文本，打开“复制公式”工具条并选择格式：

| 格式 | 用法 |
| --- | --- |
| Word UnicodeMath | 在 Word 中按 `Alt+=` 打开公式编辑器后粘贴 |
| WPS LaTeX | 用于 WPS 的 LaTeX 公式输入 |
| Markdown LaTeX | 复制带行内或块级分隔符的 LaTeX |
| 原始 LaTeX | 复制去除外围分隔符的 LaTeX |

### 辅助功能：文件夹与提示词

点击浏览器工具栏中的插件图标，可新建、删除文件夹，将当前会话链接保存到文件夹，并调整基础设置。点击其中的 `Options` 可新增或删除提示词；提示词库目前仅提供本地管理，暂不支持页面内一键插入。文件夹、提示词和设置保存在当前浏览器本地。

## 安装后网页没有反应？

1. **检查网址和浏览器**：请在安装扩展的同一个 Chrome 或 Edge 中打开 `https://chatgpt.com/`，进入已有问答的对话页。
2. **检查加载目录**：在扩展管理页确认 ChatGPT Voyager 已启用、没有报错，加载的是包含 `manifest.json` 的解压目录。
3. **重新加载并刷新**：在扩展管理页点击“重新加载”，然后回到 ChatGPT 页面刷新；仅下载 ZIP 或打开插件弹窗不会完成页面内功能的加载。
4. **检查网站访问权限**：在扩展详情中确认允许访问 `chatgpt.com`，再到页面右侧寻找 Voyager 菜单；公式工具条在悬停公式或选中公式文本后出现。
5. **入口出现但内容缺失**：先确认当前对话已加载问答，再尝试滚动历史内容或“深度采集”。如果已有问答仍无法识别，可能是 ChatGPT 页面结构兼容性问题，请通过 [Issue](https://github.com/121209/chatgpt-voyager/issues) 提交浏览器版本、插件版本、复现步骤和截图。

## 当前限制

- ChatGPT 页面结构变化可能影响目录、跳转和公式识别。
- 长对话的已记录问题不等于完整对话正文；导出前请确认模式、识别数量和选择范围。
- 公式复制依赖页面保留的 LaTeX 或 MathML。缺少可靠源码时可能提示无法转换或回退为文本；复杂公式在 Word/WPS 中仍可能需要手动调整。

## 开发与检查

在源码仓库中运行（需要 Node.js 和 npm）：

```bash
npm install
npm run check       # 回归检查与 JavaScript 语法检查
npm run build       # 执行检查并生成 dist/
```

加载构建产物时，在扩展管理页选择 `dist/`。仅重新打包可运行 `npm run build:dist`。

开发前请阅读 [AGENTS.md](AGENTS.md)，修复记录写入 [REGRESSION_LOG.md](REGRESSION_LOG.md)。验收步骤见[人工测试清单](https://github.com/121209/chatgpt-voyager/blob/main/docs/MANUAL_TEST_CHECKLIST.md)，开发方向见[项目计划](https://github.com/121209/chatgpt-voyager/blob/main/docs/VOYAGER_PLAN.md)。

## 反馈与来源

遇到问题或有功能建议，请提交 [Issue](https://github.com/121209/chatgpt-voyager/issues)。报告问题时请附浏览器和插件版本、操作步骤、预期与实际结果，以及截图；导航问题请注明点击入口和对话大致轮数。

本项目是针对 ChatGPT 的独立实现，功能设计参考 [Nagi-ovo/gemini-voyager](https://github.com/Nagi-ovo/gemini-voyager)。来源说明见 [NOTICE.md](NOTICE.md)。
