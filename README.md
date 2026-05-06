# ChatGPT Voyager

![ChatGPT Voyager promotional hero](assets/chatgpt-voyager-hero.png)

ChatGPT Voyager 是一个面向 ChatGPT 网页端的 Manifest V3 浏览器插件。项目参考了 [Nagi-ovo/gemini-voyager](https://github.com/Nagi-ovo/gemini-voyager) 的产品方向，但当前代码是针对 ChatGPT DOM 重新实现的独立版本。

插件目标是提升 ChatGPT 长对话的阅读、定位、整理、导出和公式复用效率。

## 已实现功能

### 1. ChatGPT 对话问题导航

- 自动扫描 ChatGPT 页面中 `data-message-author-role="user"` 的用户消息。
- 在页面右侧生成竖向问题导航点。
- 点击导航点可快速滚动到对应用户问题。
- 鼠标悬停导航点时显示问题摘要。
- 根据滚动位置自动高亮当前问题。
- 使用 `MutationObserver` 监听 ChatGPT 页面变化，自动刷新目录。

### 2. 悬浮目录面板

- 在页面中提供可展开的 Voyager 目录面板。
- 支持“目录”和“导出”两个标签页。
- 目录页列出当前已加载的用户问题。
- 支持搜索过滤问题文本。
- 点击目录项可跳转到对应问题位置。
- 目录面板支持拖动调整尺寸，包含上下左右和四角 resize handle。
- 面板和导航 UI 会排除自身节点，避免被错误识别为 ChatGPT 消息。

### 3. 对话导出

当前导出能力集中在内容脚本 `src/content/content.js` 中。

- 支持选择要导出的消息。
- 支持全选和清空选择。
- 支持复制 Markdown 到剪贴板。
- 支持下载 Markdown 文件。
- 支持导出 PDF：
  - 生成打印预览 HTML。
  - 保留用户/助手角色分组。
  - 保留代码块结构。
  - 尽量保留公式为 MathML 或公式文本。
  - 通过浏览器打印能力保存为 PDF。
- 支持导出 PNG 图片：
  - 克隆已选择消息。
  - 清理按钮、复制控件、推理/思考折叠控件等无关 UI。
  - 通过 `chrome.tabs.captureVisibleTab` 分段截图并绘制到 Canvas。
  - 对过高图片做保护，提示减少选择消息数量。

### 4. 公式复制

公式复制模块位于 `src/content/formulaCopy/`，当前由三部分组成：

- `extractFormulaData.js`：识别公式节点并提取公式数据。
- `clipboard.js`：负责不同目标格式的转换和剪贴板写入。
- `FormulaCopyManager.js`：负责悬浮复制工具条和用户交互。

已实现能力：

- 识别 ChatGPT 页面中的 KaTeX / MathML 公式节点：
  - `.katex-display`
  - `.katex`
  - `.katex-mathml`
  - `math`
  - `annotation[encoding="application/x-tex"]`
- 优先从 KaTeX MathML annotation 中提取可靠 LaTeX：
  - `annotation[encoding="application/x-tex"]`
- 支持从父级 KaTeX 节点、`data-math`、`aria-label` 和用户选区中兜底提取。
- 区分行内公式和块级公式。
- 鼠标悬停或选中疑似公式文本时显示“复制公式”工具条。
- 支持以下复制格式：
  - Word UnicodeMath 推荐：面向 Microsoft Word 公式编辑器，适合 `Alt+=` 后粘贴。
  - WPS LaTeX：对求和、乘积等结构做 WPS 兼容处理。
  - Markdown LaTeX：行内使用 `\( ... \)`，块级使用 `\[ ... \]`。
  - 原始 LaTeX：去除外围 `$`、`$$`、`\(`、`\[` 等分隔符后复制。
- 包含一套面向 Word UnicodeMath 的 LaTeX 归一化逻辑：
  - 希腊字母转换，如 `\theta` -> `θ`。
  - 常见运算符转换，如 `\sum` -> `∑`。
  - 分数、根号、上下标、范数、反三角函数等结构的格式化。
  - 对 K-means、判别函数、相关系数、交叉熵等复杂公式提供调试测试函数。
- 保留 Word MathML 复制能力：
  - 可将现有 MathML 清理为 Word 友好的 MathML。
  - 可包装为带 `StartFragment` / `EndFragment` 的 HTML。
  - 当前主工具条默认优先暴露 Word UnicodeMath，因为它在 Word 中更可控。

### 5. 公式导出兼容

导出 PDF 时会复用公式提取模块：

- 遍历消息 DOM 时识别公式节点。
- 对公式片段保留 `latex`、`mathml`、`display` 等信息。
- 如果存在 MathML，PDF 预览 HTML 中优先使用 MathML 渲染。
- 如果没有可靠 MathML，则回退为公式文本。

### 6. Popup 文件夹管理

插件 popup 位于 `src/popup/`。

已实现：

- 显示本地文件夹列表。
- 新建文件夹。
- 删除文件夹。
- 保存当前 ChatGPT 会话到指定文件夹。
- 自动识别当前活动标签页的 ChatGPT 会话 ID、标题和 URL。
- 支持基础设置：
  - 面板默认打开。
  - 自动刷新。
  - 默认导出格式。

### 7. Options 提示词库

插件 options 页面位于 `src/options/`。

已实现：

- 显示本地提示词列表。
- 新增提示词。
- 删除提示词。
- 默认内置三个提示词：
  - Summarize
  - Debug Partner
  - Rewrite Clearly

### 8. 本地存储

共享存储模块位于 `src/shared/storage.js`。

使用 `chrome.storage.local` 保存：

- `settings`：插件设置。
- `folders`：文件夹和已保存会话。
- `prompts`：提示词库。
- `chatMeta`：预留的会话元数据。

首次运行时会自动写入默认数据。

### 9. 后台能力

后台脚本位于 `src/background.js`。

已实现消息类型：

- `capture-visible-tab`：用于 PNG 图片导出时截取当前可见标签页。
- `download-markdown`：下载 Markdown 导出文件。
- `download-data-url`：下载 data URL 文件。

## 安装方式

### 从源码目录加载

1. 打开 Chrome、Edge 或其他 Chromium 内核浏览器。
2. 进入 `chrome://extensions`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本项目目录。
6. 打开或刷新 `https://chatgpt.com/` 中的对话页面。

### 从 Release zip 加载

1. 下载 release 附件中的 zip 文件。
2. 解压到本地固定目录。
3. 打开 `chrome://extensions/`。
4. 开启“开发者模式”。
5. 点击“加载已解压的扩展程序”。
6. 选择解压后的插件目录，而不是 zip 文件本身。
7. 打开或刷新 `https://chatgpt.com/`。

## 使用方法

### 问题导航

打开 ChatGPT 对话页后，插件会自动在页面右侧显示一列圆点。每个圆点对应一个用户提问。

- 点击圆点：跳转到对应用户问题。
- 鼠标悬停圆点：查看问题摘要。
- 页面滚动时：当前所在问题会自动高亮。
- 如果对话内容继续生成或加载更多历史消息，目录会自动刷新。

### 悬浮目录面板

右侧导航旁会出现目录入口。打开后可使用完整目录面板。

- 在“目录”标签页查看当前对话中的全部用户问题。
- 使用搜索框按关键词过滤问题。
- 点击任意目录项跳转到对应位置。
- 拖动面板边缘或四角可调整目录面板尺寸。

### 对话导出

打开目录面板后切换到“导出”标签页。

1. 勾选需要导出的消息。
2. 使用“全选”或“清空”快速调整选择范围。
3. 选择导出方式：
   - “复制 Markdown”：复制所选消息为 Markdown。
   - “导出 Markdown”：下载 `.md` 文件。
   - “导出 PDF”：打开打印预览页，可通过浏览器保存为 PDF。
   - “导出图片”：生成 PNG 图片并下载。

说明：

- PDF 导出会尽量保留文本、代码块和公式结构。
- PNG 导出依赖浏览器截图权限，过长内容建议分批选择后导出。
- 导出内容来自当前页面已加载的消息；未滚动加载出来的历史消息不会被导出。

### 公式复制

当 ChatGPT 回复中包含数学公式时，将鼠标移动到公式附近，或选中一段疑似公式文本，页面会显示“复制公式”工具条。

点击“复制公式”后可选择：

- `Word UnicodeMath 推荐`：适合 Microsoft Word。建议在 Word 中按 `Alt+=` 打开公式编辑器后粘贴。
- `WPS LaTeX`：适合 WPS 公式编辑，包含部分求和、乘积等结构兼容处理。
- `Markdown LaTeX`：适合 Markdown、Obsidian、Notion 等文本工作流。
- `原始 LaTeX`：复制去除外围分隔符后的 LaTeX 内容。

注意：

- 公式复制优先读取 ChatGPT 页面中 KaTeX / MathML 保留的原始 LaTeX。
- 如果页面没有保留可靠 LaTeX，插件会提示无法生成 Word UnicodeMath，或回退到可见文本。
- Word MathML 相关能力保留在代码中，但当前主交互优先推荐 Word UnicodeMath。

### Popup 文件夹

点击浏览器工具栏中的 ChatGPT Voyager 插件图标可打开 popup。

- 创建本地文件夹。
- 删除文件夹。
- 将当前 ChatGPT 会话保存到指定文件夹。
- 调整基础设置，例如面板默认打开、自动刷新和默认导出格式。

文件夹数据仅保存在当前浏览器的 `chrome.storage.local` 中，不会上传到服务器。

### Options 提示词库

在 popup 中点击 `Options` 可打开提示词库管理页面。

- 新增提示词标题和正文。
- 删除不需要的提示词。
- 查看默认内置提示词。

当前提示词库主要提供本地管理能力，后续可继续扩展为页面内一键插入。

## 开发与检查

本项目目前没有构建打包流程，主要是原生 MV3 插件结构。可执行语法检查：

```bash
npm run build
```

该命令会对主要 JavaScript 文件运行 `node --check`。

## 项目结构

```text
manifest.json
package.json
NOTICE.md
README.md
src/
  background.js
  shared/
    storage.js
  content/
    content.js
    content.css
    formulaCopy/
      FormulaCopyManager.js
      clipboard.js
      extractFormulaData.js
      formulaCopy.css
  popup/
    popup.html
    popup.css
    popup.js
  options/
    options.html
    options.css
    options.js
```

## 关键实现说明

### ChatGPT DOM 适配

ChatGPT 网页端 DOM 可能频繁变化，因此内容脚本没有依赖单一复杂 class，而是优先使用较稳定的属性：

```text
[data-message-author-role="user"]
[data-message-author-role]
```

如果 ChatGPT 后续调整消息节点结构，应优先检查 `src/content/content.js` 中的消息选择逻辑。

### 公式复制策略

公式复制不会从视觉渲染结果直接反推公式。优先级如下：

1. KaTeX / MathML annotation 中的原始 LaTeX。
2. 父级 KaTeX 节点中的 annotation。
3. `data-math`。
4. 可靠的 `aria-label`。
5. 用户选区中的 LaTeX。
6. 可见文本兜底。

只有来源被判定为可靠 LaTeX 时，才生成 Word UnicodeMath 或 Word MathML。否则会提示“未识别到可靠 LaTeX 源码”。

### Word 兼容策略

当前主推 Word UnicodeMath。原因：

- Word 对剪贴板 MathML 的支持受浏览器、剪贴板 MIME、Word 版本影响较大。
- UnicodeMath 在 Word 的公式编辑器中更稳定，用户可以在 Word 中按 `Alt+=` 后粘贴。
- 复杂公式会经过自定义归一化，提升求和、分数、根号、上下标等结构的可编辑性。

代码中仍保留 MathML 清理和 HTML 包装能力，后续可以在 UI 中重新暴露“Word MathML”选项。

## 当前限制

- 仅匹配 `https://chatgpt.com/*` 内容脚本。README 中提到的 `chat.openai.com` 兼容需要在 `manifest.json` 中补充匹配规则后才会实际生效。
- PNG 导出依赖 `chrome.tabs.captureVisibleTab`，需要当前活动标签页权限，过长对话可能需要分批导出。
- PDF 导出依赖浏览器打印能力，本质是生成打印预览页后保存为 PDF。
- Word UnicodeMath 是启发式转换，不是完整 LaTeX 解析器；极复杂宏、环境或自定义命令可能需要手动调整。
- 公式复制效果依赖 ChatGPT 页面是否保留 KaTeX annotation 或可靠 MathML。

## 许可证与来源说明

本项目是 ChatGPT 方向的独立实现，功能设计参考 `gemini-voyager` 的公开产品概念。详情见 `NOTICE.md`。
