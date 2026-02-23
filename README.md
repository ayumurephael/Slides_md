# Slides MD — PowerPoint Markdown 渲染插件

> 将 Markdown 内容（含 LaTeX 数学公式、TikZ 图形、伪代码）一键渲染为 PowerPoint 幻灯片的 Office Web Add-in。
> An Office Web Add-in that renders Markdown (with LaTeX math, TikZ diagrams, pseudocode) into PowerPoint slides in one click.

## 目录 / Table of Contents

- [功能特性](#功能特性--features)
- [技术栈](#技术栈--tech-stack)
- [安装指南](#安装指南--installation)
- [使用说明](#使用说明--usage)
- [Markdown 语法支持](#markdown-语法支持)
- [高级功能](#高级功能)
- [渲染管线](#渲染管线--rendering-pipeline)
- [配置选项](#配置选项)
- [项目结构](#项目结构--project-structure)
- [常见问题](#常见问题--faq)
- [版本历史](#版本历史--changelog)
- [贡献指南](#贡献指南--contributing)
- [许可证](#许可证--license)

---

## 功能特性 / Features

### 基础 Markdown 支持

- **Markdown 全语法支持** — 标题（h1-h6）、粗体、斜体、下划线（`++text++`）、删除线、有序/无序列表、嵌套列表、任务列表、代码块、行内代码、引用块、表格、图片、链接
- **幻灯片分割** — 使用 `---` 分隔多张幻灯片内容
- **中英文双字体** — 自动检测 CJK 字符，分别应用中文字体和英文字体
- **字体管理** — 侧边栏提供中文字体、英文字体、代码字体下拉选择，以及字号和颜色设置
- **功能区集成** — 在 PowerPoint 功能区提供独立的 "SlideMD" 选项卡，包含字体快捷切换和渲染按钮
- **实时预览** — 编辑 Markdown 时右侧即时预览渲染效果
- **设置持久化** — 字体、字号、颜色偏好通过 localStorage 自动保存
- **原生可编辑** — 渲染后的文本内容为 PowerPoint 原生文本框，可直接编辑

### 数学公式支持

- **LaTeX 数学公式** — 行内公式 `$E=mc^2$`、块级公式 `$$\frac{a}{b}$$`
- **高清渲染** — 公式渲染为高清 PNG 图片，支持多种质量等级（2x-10x 缩放）
- **自动裁剪** — 智能裁剪图片留白，确保公式紧凑显示
- **复杂公式支持** — 完整支持矩阵、分段函数、大型分隔符等复杂结构

### 高级渲染功能

- **GitHub 风格提示块** — 支持 `[!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]`、`[!CAUTION]` 五种类型
- **TikZ 绘图** — 支持在幻灯片中渲染 TikZ 图形
- **LaTeX 伪代码** — 支持 algorithm/algorithmic 环境的伪代码渲染
- **显式换行控制** — 使用 `[br]` 标记精确控制文本换行位置

---

## 技术栈 / Tech Stack

| 组件 | 技术 |
|------|------|
| 运行环境 | Office Web Add-in（Shared Runtime） |
| 语言 | TypeScript 5.4 |
| Markdown 解析 | markdown-it 14 + texmath + ins + task-lists 插件 |
| 公式渲染 | KaTeX 0.16 → html2canvas → PNG |
| TikZ 渲染 | TikZJax (CDN) → SVG → html2canvas → PNG |
| 幻灯片操作 | Office.js PowerPointApi 1.4+ |
| 构建工具 | Webpack 5 + ts-loader |
| 开发证书 | office-addin-dev-certs |

---

## 安装指南 / Installation

### 环境要求 / Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm 9+（随 Node.js 一起安装）
- Microsoft 365（PowerPoint 桌面版或 Web 版）

### 1. 克隆仓库

```bash
git clone https://github.com/ayumurephael/Slides_md.git
cd Slides_md
```

### 2. 安装依赖

```bash
npm install
```

### 3. 安装开发证书

Office Add-in 要求通过 HTTPS 加载，首次开发需要安装本地证书：

```bash
npm run install-certs
```

该命令会在本机安装一个受信任的自签名证书，仅需执行一次。

### 4. 启动开发服务器

```bash
npm run dev
```

启动后，HTTPS 开发服务器运行在 `https://localhost:3000`。

### 5. 在 PowerPoint 中加载插件

#### 桌面版 PowerPoint（Windows / Mac）

1. 打开 PowerPoint，新建或打开一个演示文稿
2. 点击菜单栏 **插入** → **获取加载项**（或 **我的加载项**）
3. 选择 **上传我的加载项**
4. 浏览并选择项目根目录下的 `manifest.xml` 文件
5. 加载成功后，功能区会出现 **SlideMD** 选项卡

#### PowerPoint Online（Web 版）

1. 打开 [PowerPoint Online](https://www.office.com/launch/powerpoint)
2. 点击 **插入** → **Office 加载项** → **上传我的加载项**
3. 上传 `manifest.xml`

---

## 使用说明 / Usage

### 基本操作流程

1. 点击功能区 **SlideMD** 选项卡中的 **编辑器** 按钮，打开侧边栏任务窗格
2. 在侧边栏顶部选择中文字体、英文字体、代码字体，调整字号和颜色
3. 在左侧编辑器中输入 Markdown 内容
4. 右侧面板实时预览渲染效果
5. 选中目标幻灯片，点击 **渲染到幻灯片** 按钮
6. 插件会清除当前幻灯片内容，然后将 Markdown 渲染结果写入

> **注意**：渲染操作会替换当前选中幻灯片的全部内容，请确保已选中正确的幻灯片。

### 工具栏按钮

| 按钮 | 功能 |
|------|------|
| **新建空白幻灯片** | 在编辑器光标位置插入幻灯片分隔符 `\n\n---\n\n`，光标自动定位到新幻灯片区域 |
| **渲染到幻灯片** | 将当前 Markdown 内容渲染到选中的幻灯片 |
| **同步全部幻灯片** | 将 Markdown 中所有幻灯片内容同步到对应的 PPT 幻灯片 |

---

## Markdown 语法支持

### 基础语法

```markdown
# 一级标题
## 二级标题
### 三级标题

**粗体** *斜体* ++下划线++ ~~删除线~~

行内公式：$E=mc^2$

块级公式：
$$
\frac{-b \pm \sqrt{b^2-4ac}}{2a}
$$

`行内代码`

​```python
print("代码块")
​```

- 无序列表
  - 嵌套项
1. 有序列表

- [ ] 未完成任务
- [x] 已完成任务

> 引用块

| 表头1 | 表头2 |
|-------|-------|
| 单元格 | 单元格 |

![图片描述](url)
[链接文字](url)

---
（幻灯片分隔符，以下内容将渲染到下一张幻灯片）
```

### GitHub 风格提示块

```markdown
> [!NOTE]
> 这是一条注意提示

> [!TIP]
> 这是一条建议提示

> [!IMPORTANT]
> 这是一条重要提示

> [!WARNING]
> 这是一条警告提示

> [!CAUTION]
> 这是一条注意警告
```

### 显式换行符

使用 `[br]` 标记强制换行，精确控制文本排版：

```markdown
## 产品特性
轻量化设计[br]高性能处理[br]易于集成

## 技术规格
处理器：Intel i7[br]内存：16GB[br]存储：512GB SSD

## 公式说明
计算 $E = mc^2$[br]其中 $m$ 是质量，$c$ 是光速
```

**重要：自动换行已禁用**

从 v1.2.0 版本开始，插件禁用了所有自动换行行为。文本仅在遇到 `[br]` 标记时才会换行。

**特点：**
- **仅显式换行** — 文本仅在遇到 `[br]` 标记时换行，不会根据容器宽度自动换行
- **精确控制** — 用户可以完全控制每行的内容和长度
- **可预测排版** — 避免因自动换行导致的意外排版问题
- 可以连续使用多个 `[br]` 创建空行
- 支持在标题、段落、列表、引用块、表格等所有文本元素中使用
- 大小写不敏感，`[BR]`、`[Br]` 等写法均可

### TikZ 绘图

使用 `tikz` 代码围栏标记 TikZ 代码块：

```markdown
​```tikz
\begin{tikzpicture}
  \draw (0,0) circle (1cm);
  \draw (0,0) -- (1,1);
  \draw[red, thick] (0,0) rectangle (2,1);
  \node at (1,0.5) {Hello TikZ};
\end{tikzpicture}
​```
```

**说明：**
- 如果 TikZ 代码没有 `\begin{tikzpicture}` 包裹，会自动补全
- 渲染失败时会降级为橙色背景的代码块，显示 `[TikZ 渲染失败]` 标签和源码
- TikZ 图形通过 TikZJax (CDN) 编译，需要网络连接

### LaTeX 伪代码

支持两种输入语法：

**方式一：使用 algorithm 或 pseudocode 代码围栏**

```markdown
​```algorithm
\begin{algorithm}
\caption{快速排序}
\begin{algorithmic}
\Require 数组 $A$，起始索引 $lo$，结束索引 $hi$
\Ensure 排序后的数组
\If{$lo < hi$}
    \State $p \gets$ \texttt{Partition}$(A, lo, hi)$
    \State \texttt{QuickSort}$(A, lo, p-1)$
    \State \texttt{QuickSort}$(A, p+1, hi)$
\EndIf
\end{algorithmic}
\end{algorithm}
​```
```

**方式二：在数学块中**

```markdown
$$
\begin{algorithm}
\begin{algorithmic}
\State $x \gets 0$
\For{$i \gets 1$ \textbf{to} $n$}
    \State $x \gets x + i$
\EndFor
\Return $x$
\end{algorithmic}
\end{algorithm}
$$
```

**支持的命令：**

| 命令 | 说明 |
|------|------|
| `\State` | 普通语句 |
| `\If{cond}` / `\ElsIf{cond}` / `\Else` / `\EndIf` | 条件分支 |
| `\For{cond}` / `\ForAll{cond}` / `\EndFor` | 循环 |
| `\While{cond}` / `\EndWhile` | While 循环 |
| `\Repeat` / `\Until{cond}` | Repeat-Until 循环 |
| `\Function{name}{params}` / `\EndFunction` | 函数定义 |
| `\Procedure{name}{params}` / `\EndProcedure` | 过程定义 |
| `\Return` | 返回语句 |
| `\Require` / `\Ensure` | 前置/后置条件 |
| `\Comment{text}` | 注释（显示为 ▷ text） |
| `\caption{text}` | 算法标题 |

**特性：**
- 自动缩进和行号
- 关键字高亮（蓝色）、函数名着色（紫色）、注释灰色斜体
- 行内数学公式通过 KaTeX 渲染
- 渲染失败时降级为代码块显示

---

## 高级功能

### 渲染质量控制

插件支持多种渲染质量等级，可在代码中配置：

| 等级 | 缩放因子 | DPI | 说明 |
|------|----------|-----|------|
| `low` | 2x | 192 | 标准质量，适合屏幕显示 |
| `medium` | 4x | 384 | 中等质量，平衡文件大小和清晰度 |
| `high` | 6x | 576 | 高质量，适合打印和高清显示 |
| `very_high` | 8x | 768 | 极高质量，适合高清打印 |
| `ultra` | 10x | 960 | 超高质量，适合专业打印和4K显示 |

### 图片自动裁剪

插件会自动裁剪生成的图片留白：
- 智能检测内容边界
- 保留 2px 最小边距
- 确保公式和文本紧凑显示

### 中英文双字体机制

插件会对每个文本框中的文字逐字符检测是否为 CJK（中日韩）字符：

- CJK 字符 → 应用选定的中文字体（如微软雅黑、宋体等）
- 拉丁字符 → 应用选定的英文字体（如 Calibri、Arial 等）

**可用字体：**

| 类别 | 字体 |
|------|------|
| 中文 | 微软雅黑、宋体、黑体、楷体、仿宋、华文中宋、华文楷体、华文宋体 |
| 英文 | Calibri、Arial、Times New Roman、Verdana、Georgia、Tahoma、Segoe UI、Cambria |
| 代码 | Consolas（默认）及系统中检测到的其他等宽字体 |

---

## 渲染管线 / Rendering Pipeline

```
Markdown 文本
  │
  ▼
markdown-it 解析（含 texmath / ins / task-lists 插件）
  │
  ▼
Token 流 → ast-transformer → SlideIR[] 中间表示（按 --- 分割为多张幻灯片）
  │
  ▼
slide-builder 逐元素渲染到 PowerPoint：
  ├─ 标题         → 原生文本框（加粗，按级别设置字号）或 PNG 图片（含公式/换行时）
  ├─ 段落         → 原生文本框或 PNG 图片（含公式/代码/显式换行时）
  ├─ 块级公式     → KaTeX → html2canvas → 自动裁剪 → PNG 图片（居中插入）
  ├─ 代码块       → 灰色背景矩形 + 等宽字体文本框
  ├─ 引用块       → 蓝色竖条 + 缩进斜体文本
  ├─ 列表         → 带编号/圆点前缀的文本框（支持嵌套缩进）
  ├─ 任务列表     → ☑/☐ 前缀文本框
  ├─ 表格         → 网格排列的文本框（表头加粗）
  ├─ 图片         → base64 → Common API 插入
  ├─ 提示块       → 彩色标题栏 + 左侧强调条 + 内容区
  ├─ TikZ 图形    → TikZJax → SVG → html2canvas → 自动裁剪 → PNG 图片
  └─ 伪代码       → 内置解析器 → HTML → html2canvas → 自动裁剪 → PNG 图片
```

---

## 配置选项

### npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 HTTPS 开发服务器（端口 3000） |
| `npm run build` | 生产模式构建到 `dist/` |
| `npm run install-certs` | 安装本地开发 HTTPS 证书 |
| `npm run sideload` | 通过 office-toolbox 旁加载插件到 PowerPoint |

### 生产构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。部署时将 `dist/` 目录的内容托管到 HTTPS 服务器，并将 `manifest.xml` 中的 `localhost:3000` 替换为实际的服务器地址即可。

---

## 项目结构 / Project Structure

```
Slides_md/
├── manifest.xml                  # Office Add-in 清单文件
├── package.json                  # 项目依赖与脚本
├── webpack.config.js             # Webpack 构建配置
├── tsconfig.json                 # TypeScript 编译配置
├── assets/                       # 插件图标资源
│   ├── icon-16.png
│   ├── icon-32.png
│   └── icon-80.png
├── src/
│   ├── taskpane/                 # 入口与样式
│   │   ├── taskpane.html         # 任务窗格 HTML 模板
│   │   ├── taskpane.ts           # 主入口，初始化与事件绑定
│   │   └── taskpane.css          # 全局样式
│   ├── core/                     # 核心渲染逻辑
│   │   ├── markdown-parser.ts    # Markdown 解析（markdown-it + 插件）
│   │   ├── ast-transformer.ts    # Token 流 → SlideIR 中间表示
│   │   ├── slide-builder.ts      # SlideIR → PowerPoint 幻灯片
│   │   ├── slide-sync.ts         # 多幻灯片同步逻辑
│   │   ├── math-renderer.ts      # LaTeX 公式渲染（KaTeX + html2canvas）
│   │   ├── tikz-renderer.ts      # TikZ 图形渲染
│   │   ├── algorithm-renderer.ts # 伪代码渲染
│   │   ├── render-config.ts      # 渲染配置与自动裁剪
│   │   ├── image-utils.ts        # 图片获取与 base64 转换
│   │   ├── layout-engine.ts      # 幻灯片布局常量
│   │   └── diff-engine.ts        # 增量渲染差异计算
│   ├── fonts/                    # 字体管理
│   │   ├── font-manager.ts       # 字体状态管理与持久化
│   │   ├── font-catalog.ts       # 系统字体枚举与分类
│   │   └── font-detector.ts      # 字体可用性检测
│   ├── ui/                       # UI 组件
│   │   ├── toolbar.ts            # 工具栏（字体选择、字号、颜色、渲染按钮）
│   │   ├── editor.ts             # Markdown 编辑器
│   │   ├── preview.ts            # 实时预览面板
│   │   └── font-selector.ts      # 字体下拉选择器组件
│   ├── commands/                 # 功能区命令
│   │   └── ribbon-commands.ts    # SlideMD 选项卡按钮的命令处理
│   └── types/                    # TypeScript 类型定义
│       ├── ir.ts                 # 中间表示（SlideIR）类型
│       └── modules.d.ts          # 第三方模块声明
└── dist/                         # 构建输出（不纳入版本控制）
```

---

## 常见问题 / FAQ

### 插件加载问题

**插件加载后看不到 SlideMD 选项卡？**
- 确认使用的是 Microsoft 365 版本的 PowerPoint（不支持 Office 2019 及更早版本）
- 尝试关闭并重新打开 PowerPoint
- 检查开发服务器是否正常运行（`https://localhost:3000` 应可访问）

**证书错误怎么办？**
- 确保已运行 `npm run install-certs` 安装本地证书
- 如果仍有问题，尝试清除浏览器缓存并重新安装证书

### 渲染问题

**渲染后公式显示为文本而非图片？**
- 行内公式（`$...$`）会以 LaTeX 源码文本形式插入，保持可编辑性
- 块级公式（`$$...$$`）会渲染为高清 PNG 图片
- 如需将行内公式也渲染为图片，可将其改写为块级公式，或在段落中混合使用其他需要图片渲染的元素（如行内代码、显式换行符）

**TikZ 图形渲染失败？**
- TikZ 渲染需要网络连接（从 CDN 加载 TikZJax）
- 检查 TikZ 语法是否正确
- 渲染失败时会显示橙色背景的代码块，可查看源码排查问题

**图片留白太多？**
- 插件已内置自动裁剪功能，会智能去除图片四周的空白
- 如果仍有问题，可检查渲染质量设置

### 编辑问题

**渲染后的内容可以编辑吗？**
- 可以。标题、段落、列表、表格等文本内容均为 PowerPoint 原生文本框，可直接双击编辑
- 块级公式、TikZ 图形、伪代码和外部图片作为图片插入，不可直接编辑文字
- 如需修改公式，建议修改 Markdown 源码后重新渲染

**如何精确控制换行？**
- 使用 `[br]` 标记强制换行
- 例如：`第一行[br]第二行[br]第三行`

### 部署问题

**如何部署到生产环境？**
1. 执行 `npm run build`
2. 将 `dist/` 目录部署到 HTTPS 服务器
3. 修改 `manifest.xml` 中所有 `https://localhost:3000` 为实际服务器地址
4. 通过组织的 Office Add-in 管理中心分发 `manifest.xml`

---

## 版本历史 / Changelog

### v1.2.0 (当前版本)

**新增功能：**
- ✨ **显式换行符支持** — 使用 `[br]` 标记精确控制文本换行位置
- ✨ **图片自动裁剪** — 智能裁剪公式、TikZ 图形、伪代码图片的留白
- ✨ **新建空白幻灯片按钮** — 快速插入幻灯片分隔符

**重要变更：**
- ⚠️ **禁用自动换行** — 文本不再根据容器宽度自动换行，仅在遇到 `[br]` 标记时换行
- 这一变更确保用户可以完全控制文本排版，避免意外的自动换行问题

**改进：**
- 🎨 优化行内公式和行内代码的渲染效果
- 🎨 减少生成图片的留白，使内容更紧凑
- 🐛 修复复杂公式（如大型矩阵、分段函数）的渲染问题

### v1.1.0

**新增功能：**
- ✨ **TikZ 绘图支持** — 在幻灯片中渲染 TikZ 图形
- ✨ **LaTeX 伪代码渲染** — 支持 algorithm/algorithmic 环境
- ✨ **多幻灯片同步** — 一键同步所有 Markdown 幻灯片到 PPT

**改进：**
- 🎨 增强 KaTeX 公式渲染稳定性
- 🐛 修复 SVG 分隔符溢出问题

### v1.0.0

**初始版本：**
- ✨ Markdown 全语法支持
- ✨ LaTeX 数学公式渲染
- ✨ 中英文双字体支持
- ✨ GitHub 风格提示块
- ✨ 实时预览
- ✨ 字体管理

---

## 贡献指南 / Contributing

欢迎贡献代码！请遵循以下流程：

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature-name`
3. 提交更改：`git commit -m "feat: add your feature description"`
4. 推送分支：`git push origin feature/your-feature-name`
5. 创建 Pull Request

### 提交消息规范

请使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

- `feat:` 新功能
- `fix:` 修复 Bug
- `docs:` 文档更新
- `refactor:` 代码重构
- `style:` 代码格式调整（不影响逻辑）
- `test:` 测试相关

### 开发注意事项

- 确保代码通过 TypeScript 编译（`npm run build` 无报错）
- 新增功能请在 PR 描述中说明使用方式
- 保持代码风格与现有代码一致

---

## 许可证 / License

本项目基于 [MIT License](./LICENSE) 开源。

---

## 联系方式 / Contact

- GitHub Issues: [https://github.com/ayumurephael/Slides_md/issues](https://github.com/ayumurephael/Slides_md/issues)
- GitHub: [@ayumurephael](https://github.com/ayumurephael)
