# Slides MD — PowerPoint Markdown 渲染插件

> 将 Markdown 内容（含 LaTeX 数学公式）一键渲染为 PowerPoint 幻灯片的 Office Web Add-in。
> An Office Web Add-in that renders Markdown (with LaTeX math) into PowerPoint slides in one click.

## 功能特性 / Features

- **Markdown 全语法支持** — 标题（h1-h6）、粗体、斜体、下划线（`++text++`）、删除线、有序/无序列表、嵌套列表、任务列表、代码块、行内代码、引用块、表格、图片、链接
- **LaTeX 数学公式** — 行内公式 `$E=mc^2$`、块级公式 `$$\frac{a}{b}$$`，块级公式渲染为高清 PNG 图片
- **GitHub 风格提示块** — 支持 `[!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]`、`[!CAUTION]` 五种类型
- **幻灯片分割** — 使用 `---` 分隔多张幻灯片内容
- **中英文双字体** — 自动检测 CJK 字符，分别应用中文字体和英文字体
- **字体管理** — 侧边栏提供中文字体、英文字体、代码字体下拉选择，以及字号和颜色设置
- **功能区集成** — 在 PowerPoint 功能区提供独立的 "SlideMD" 选项卡，包含字体快捷切换和渲染按钮
- **实时预览** — 编辑 Markdown 时右侧即时预览渲染效果
- **设置持久化** — 字体、字号、颜色偏好通过 localStorage 自动保存
- **原生可编辑** — 渲染后的文本内容为 PowerPoint 原生文本框，可直接编辑

## 技术栈 / Tech Stack

| 组件 | 技术 |
|------|------|
| 运行环境 | Office Web Add-in（Shared Runtime） |
| 语言 | TypeScript 5.4 |
| Markdown 解析 | markdown-it 14 + texmath + ins + task-lists 插件 |
| 公式渲染 | KaTeX 0.16 → html2canvas → PNG |
| 幻灯片操作 | Office.js PowerPointApi 1.4+ |
| 构建工具 | Webpack 5 + ts-loader |
| 开发证书 | office-addin-dev-certs |

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

#### 通过共享文件夹加载（Windows 桌面版）

1. 创建一个文件夹（如 `C:\AddinManifests`），将 `manifest.xml` 复制进去
2. 右键文件夹 → 属性 → 共享，设置共享名称并授予读取权限
3. 在 PowerPoint 中：文件 → 选项 → 信任中心 → 信任中心设置 → 受信任的加载项目录，添加共享路径（如 `\\YOUR-PC-NAME\AddinManifests`）
4. 重启 PowerPoint → 插入 → 我的加载项 → 共享文件夹，选择加载

## 使用说明 / Usage

1. 点击功能区 **SlideMD** 选项卡中的 **编辑器** 按钮，打开侧边栏任务窗格
2. 在侧边栏顶部选择中文字体、英文字体、代码字体，调整字号和颜色
3. 在左侧编辑器中输入 Markdown 内容
4. 右侧面板实时预览渲染效果
5. 选中目标幻灯片，点击 **渲染到幻灯片** 按钮
6. 插件会清除当前幻灯片内容，然后将 Markdown 渲染结果写入

> **注意**：渲染操作会替换当前选中幻灯片的全部内容，请确保已选中正确的幻灯片。

### 支持的 Markdown 语法

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

> [!NOTE]
> 这是一条注意提示

> [!WARNING]
> 这是一条警告提示

| 表头1 | 表头2 |
|-------|-------|
| 单元格 | 单元格 |

![图片描述](url)
[链接文字](url)

---
（幻灯片分隔符，以下内容将渲染到下一张幻灯片）
```

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
│   │   ├── math-renderer.ts      # LaTeX 公式渲染（KaTeX + html2canvas）
│   │   ├── image-utils.ts        # 图片获取与 base64 转换
│   │   └── layout-engine.ts      # 幻灯片布局常量
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
  ├─ 标题         → 原生文本框（加粗，按级别设置字号）
  ├─ 段落         → 原生文本框（保留粗体/斜体/下划线/删除线格式）
  ├─ 行内公式     → LaTeX 源码文本（等宽字体，可编辑）
  ├─ 块级公式     → KaTeX → html2canvas → PNG 图片（居中插入）
  ├─ 代码块       → 灰色背景矩形 + 等宽字体文本框
  ├─ 引用块       → 蓝色竖条 + 缩进斜体文本
  ├─ 列表         → 带编号/圆点前缀的文本框（支持嵌套缩进）
  ├─ 任务列表     → ☑/☐ 前缀文本框
  ├─ 表格         → 网格排列的文本框（表头加粗）
  ├─ 图片         → base64 → Common API 插入
  └─ 提示块       → 彩色标题栏 + 左侧强调条 + 内容区
```

## 中英文双字体机制

插件会对每个文本框中的文字逐字符检测是否为 CJK（中日韩）字符：

- CJK 字符 → 应用选定的中文字体（如微软雅黑、宋体等）
- 拉丁字符 → 应用选定的英文字体（如 Calibri、Arial 等）

### 可用字体

| 类别 | 字体 |
|------|------|
| 中文 | 微软雅黑、宋体、黑体、楷体、仿宋、华文中宋、华文楷体、华文宋体 |
| 英文 | Calibri、Arial、Times New Roman、Verdana、Georgia、Tahoma、Segoe UI、Cambria |
| 代码 | Consolas（默认）及系统中检测到的其他等宽字体 |

## 常见问题 / FAQ

**插件加载后看不到 SlideMD 选项卡？**
- 确认使用的是 Microsoft 365 版本的 PowerPoint（不支持 Office 2019 及更早版本）
- 尝试关闭并重新打开 PowerPoint
- 检查开发服务器是否正常运行（`https://localhost:3000` 应可访问）

**渲染后公式显示为文本而非图片？**
行内公式（`$...$`）会以 LaTeX 源码文本形式插入，保持可编辑性。块级公式（`$$...$$`）会渲染为高清 PNG 图片。如需将行内公式也渲染为图片，可将其改写为块级公式。

**渲染后的内容可以编辑吗？**
可以。标题、段落、列表、表格等文本内容均为 PowerPoint 原生文本框，可直接双击编辑。块级公式和外部图片作为图片插入，不可直接编辑文字。

**如何部署到生产环境？**
1. 执行 `npm run build`
2. 将 `dist/` 目录部署到 HTTPS 服务器
3. 修改 `manifest.xml` 中所有 `https://localhost:3000` 为实际服务器地址
4. 通过组织的 Office Add-in 管理中心分发 `manifest.xml`

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

## 许可证 / License

本项目基于 [MIT License](./LICENSE) 开源。

## 联系方式 / Contact

- GitHub Issues: [https://github.com/ayumurephael/Slides_md/issues](https://github.com/ayumurephael/Slides_md/issues)
- GitHub: [@ayumurephael](https://github.com/ayumurephael)
