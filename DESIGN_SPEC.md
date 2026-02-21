# Slide_md 插件设计规范

本文档概述了 `Slide_md` 插件 UI 优化的设计原则和规范。

## 1. 色彩方案 (Color Palette)

我们使用一组 CSS 变量来管理颜色，以确保整个插件的视觉一致性。

| 变量名                      | 色值      | 描述                               |
| --------------------------- | --------- | ---------------------------------- |
| `--primary-color`           | `#4A90E2` | 主色调，用于主要按钮和高亮元素     |
| `--primary-hover-color`     | `#357ABD` | 主色调的悬停状态                   |
| `--primary-disabled-color`  | `#A9A9A9` | 禁用状态的颜色                     |
| `--text-color`              | `#333333` | 主要文本颜色                       |
| `--text-color-secondary`    | `#666666` | 次要文本颜色（如标签）             |
| `--bg-color`                | `#F5F5F5` | 主要背景色                         |
| `--bg-color-light`          | `#FFFFFF` | 较亮的背景色（如工具栏、编辑器）   |
| `--border-color`            | `#DDDDDD` | 边框和分割线颜色                   |
| `--success-color`           | `#2E7D32` | 成功状态的文本颜色                 |
| `--success-bg-color`        | `#E8F5E9` | 成功状态的背景色                   |
| `--error-color`             | `#D32F2F` | 错误状态的文本颜色                 |
| `--error-bg-color`          | `#FCE4EC` | 错误状态的背景色                   |
| `--notification-bg-color`   | `#E3F2FD` | 通知栏背景色                       |
| `--notification-border-color` | `#90CAF9` | 通知栏边框颜色                     |
| `--notification-text-color` | `#1565C0` | 通知栏文本颜色                     |

## 2. 字体排版 (Typography)

| 变量名                 | 值                                                                                   | 描述                           |
| ---------------------- | ------------------------------------------------------------------------------------ | ------------------------------ |
| `--font-family-sans`   | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | UI 的主要无衬线字体            |
| `--font-family-mono`   | `Consolas, "Courier New", monospace`                                               | 代码编辑器的等宽字体           |
| `--font-size-base`     | `14px`                                                                               | 基础字号                       |
| `--font-size-sm`       | `12px`                                                                               | 较小字号（如标签、状态栏）     |
| `--line-height-base`   | `1.5`                                                                                | 基础行高                       |

## 3. 间距 (Spacing)

我们采用基于 8px 的间距系统，以保持布局的节奏和一致性。

*   `--space-1`: `4px`
*   `--space-2`: `8px`
*   `--space-3`: `12px`
*   `--space-4`: `16px`
*   `--space-5`: `20px`
*   `--space-6`: `24px`

## 4. UI 组件 (UI Components)

### 按钮

*   **主按钮 (`#render-btn`)**: 使用 `--primary-color` 作为背景色，用于最重要的操作。
*   **次要按钮 (`#new-slide-btn`, `#load-from-slide-btn`)**: 采用描边样式，与主按钮形成对比。
*   **图标按钮 (`.icon-button`)**: 按钮内包含一个 16x16px 的 SVG 图标和文本，通过 Flexbox 居中对齐。

### 表单控件

*   `select`, `input[type="number"]`, `input[type="color"]` 等表单控件具有统一的边框、圆角和间距。
*   在 `:focus` 状态下，会显示蓝色的外发光轮廓，以提供清晰的交互反馈。

### 图标

*   我们使用了 [Feather Icons](https://feathericons.com/) 图标库，并将 SVG 直接嵌入到代码中，以减少外部依赖和网络请求。
*   图标大小统一为 `16px x 16px`，描边宽度为 `2px`。
