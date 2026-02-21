# Slides MD — 设计规范 v2

本文档描述 Slides MD 插件 UI 的设计系统。

## 1. 色彩方案

### 主色 (Primary)

| Token | 色值 | 用途 |
|-------|------|------|
| `--primary-50` | `#EBF3FE` | 按钮悬停背景、浅高亮 |
| `--primary-100` | `#D0E4FC` | 按钮按下背景 |
| `--primary-200` | `#A1C9F9` | 次要按钮边框 |
| `--primary-300` | `#6BAAF5` | 编辑器闪烁动画 |
| `--primary-400` | `#4A90E2` | 主操作按钮、光标色 |
| `--primary-500` | `#2E74C6` | 主按钮悬停 |
| `--primary-600` | `#1E5CA3` | 主按钮按下 |
| `--primary-700` | `#164680` | 深色强调 |

### 强调色 (Accent — Purple)

| Token | 色值 | 用途 |
|-------|------|------|
| `--accent-50` | `#F3E8F9` | 加载按钮悬停背景 |
| `--accent-100` | `#E1C4F0` | 加载按钮边框 |
| `--accent-400` | `#9C5FBF` | 加载按钮悬停边框 |
| `--accent-500` | `#7B3FA0` | 加载按钮文字 |

### 中性色 (Neutrals)

| Token | 色值 | 用途 |
|-------|------|------|
| `--gray-50` | `#FAFBFC` | 页面背景 |
| `--gray-100` | `#F3F4F6` | 徽章背景 |
| `--gray-200` | `#E5E7EB` | 边框、分割线 |
| `--gray-300` | `#D1D5DB` | 悬停边框、禁用按钮背景 |
| `--gray-400` | `#9CA3AF` | 占位符文字、三级文字 |
| `--gray-500` | `#6B7280` | 二级文字、标签 |
| `--gray-600` | `#4B5563` | — |
| `--gray-700` | `#374151` | — |
| `--gray-800` | `#1F2937` | 主文字 |

### 语义色

| 语义 | 背景 | 文字 |
|------|------|------|
| 成功 | `#ECFDF5` | `#047857` |
| 错误 | `#FEF2F2` | `#B91C1C` |
| 信息 | `#EFF6FF` | `#1D4ED8` |
| 警告 | `#FFFBEB` | `#F59E0B` |

## 2. 字体排版

| Token | 值 | 用途 |
|-------|---|------|
| `--font-sans` | Segoe UI Variable, system-ui, … | UI 文字 |
| `--font-mono` | Cascadia Code, Fira Code, Consolas, … | 编辑器 |
| `--text-xs` | 11px | 标签、徽章 |
| `--text-sm` | 12px | 工具栏控件、状态栏 |
| `--text-base` | 13px | 编辑器正文 |
| `--text-md` | 14px | 标题 |
| `--text-lg` | 16px | 大标题 |

## 3. 间距

基于 4px 的间距系统：`--sp-1` (4px) 到 `--sp-8` (32px)。

## 4. 圆角

| Token | 值 | 用途 |
|-------|---|------|
| `--radius-sm` | 4px | 小按钮、标签 |
| `--radius-md` | 6px | 表单控件、按钮 |
| `--radius-lg` | 8px | 卡片 |
| `--radius-xl` | 12px | 大容器 |

## 5. 阴影

| Token | 用途 |
|-------|------|
| `--shadow-xs` | 按钮默认 |
| `--shadow-sm` | 按钮悬停 |
| `--shadow-md` | 弹出层 |
| `--shadow-inner` | 输入框内阴影 |

## 6. 组件

### 按钮层级

1. 主按钮 (`#render-btn`) — 实心蓝色，用于最重要的操作
2. 次要按钮 (`#new-slide-btn`) — 蓝色描边
3. 三级按钮 (`#load-from-slide-btn`) — 紫色描边

### 表单控件

- 统一 `--radius-md` 圆角
- Focus 状态：蓝色边框 + `--color-ring` 外发光
- 自定义 select 下拉箭头（SVG chevron）

### 图标

- Feather Icons 风格，stroke-based
- 按钮内 14×14px，header 内 18×18px
- `stroke-width: 2`

### 工具栏分隔符

- `.toolbar-divider`：1px 宽、20px 高的竖线，分隔字体/尺寸/按钮区域

### 加载覆盖层

- 半透明白色背景 + `backdrop-filter: blur(2px)`
- 旋转 spinner + 文字提示
- 渲染过程中覆盖编辑器区域

### 状态栏

- 渲染中：左侧脉冲圆点动画 (`.rendering::before`)
- 成功/错误：语义色背景 + 文字

## 7. 动画

| 名称 | 时长 | 用途 |
|------|------|------|
| `slideDown` | 350ms | 通知栏出现 |
| `editorFlash` | 1.2s | 编辑器加载源内容 |
| `spin` | 0.7s | 加载 spinner |
| `pulse` | 1.2s | 状态栏渲染指示 |
| 按钮 hover | 200ms | 所有按钮悬停过渡 |

## 8. 响应式

- `≤320px`：隐藏标签文字，缩小 select 宽度，按钮只显示图标
- `≤260px`：隐藏分隔符，缩小间距

## 9. 渲染质量配置

### 质量预设

| 级别 | Scale | DPI | Quality | 适用场景 |
|------|-------|-----|---------|---------|
| 超高质量 | 10x | 960 | 1.0 (无损) | 专业打印、4K显示 |
| 极高质量 | 8x | 768 | 1.0 (无损) | 高清打印 |
| 高质量 | 6x | 576 | 1.0 (无损) | 打印、高清显示 |
| 中等质量 | 4x | 384 | 1.0 (无损) | 平衡文件大小与清晰度 |
| 标准质量 | 2x | 192 | 1.0 (无损) | 屏幕显示 |

### 默认设置

- 默认使用**超高质量** (10x scale, 960 DPI)
- 用户选择会自动保存到 `localStorage` (`slidemd_render_quality`)
- 所有级别均使用无损PNG格式

### 渲染流程

1. **字体预加载** — 确保KaTeX字体完全加载
2. **HTML渲染** — 使用KaTeX将公式转为HTML
3. **Canvas捕获** — 通过html2canvas以指定scale渲染
4. **PNG导出** — 无损PNG格式输出到PowerPoint

### 相关文件

- `src/core/render-config.ts` — 渲染质量配置
- `src/core/math-renderer.ts` — 数学公式渲染
- `src/core/algorithm-renderer.ts` — 算法伪代码渲染
- `src/core/tikz-renderer.ts` — TikZ图形渲染
- `src/ui/toolbar.ts` — 质量选择器UI
