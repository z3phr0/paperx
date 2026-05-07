# paperx 架构文档（Phase 1）

> 本文档记录 Phase 1 拍板的关键架构决策（R1/R2/R3）以及后续 Phase 2~4 的演进路线。所有决策都附理由 + 备选方案 + 落地步骤，便于后续维护者读懂 "为什么这么选"。

## 1. 项目定位

paperx 是一个 Chrome 浏览器扩展（Manifest V3）。它让设计师 / 前端工程师在**任意网页**上做可视化 CSS 编辑（尺寸、字体、布局），并把变更打包成结构化 JSON Prompt。

核心闭环：

```
浏览器里改样式 (paperx 工具栏)
        │
        ▼
导出 JSON Prompt (含 data-paperx-uid 等组件元信息)
        │
        ▼
粘贴到 Claude Code
        │
        ▼
AI 定位 React 源码组件 → 自动改 CSS / Tailwind
```

四种工作模式：

| 模式 | 用途 | Phase |
|------|------|-------|
| `design` | 编辑元素的 CSS 属性（W/H/字体/边距/颜色） | Phase 2 |
| `ruler` | 测量元素间距 / 网格对齐 | Phase 2 |
| `comment` | 在元素上加 review 评论 | Phase 3 |
| `layout` | 调整 Flex / Grid 布局 | Phase 3 |

四种 view（在 design 模式下切换）：

- 层级 (hierarchy) — 类似 Figma 的图层面板
- 代码 (code) — 显示原始 HTML
- CSS — 当前计算样式 + 已修改样式
- Tailwind — 把改动反向映射成 Tailwind 类名

底部 change-log：列所有变更，可筛选 / 定位 / 单条 reset。

## 2. 三大架构风险与决策

Phase 1 必须给出明确决策的三个风险点：

### R1. MV3 + React UI 注入隔离

**问题**：content script 注入的 React UI 必须与宿主页面互不污染。Tailwind 的 preflight 会重置 `<button>` 等元素，污染宿主页；反过来宿主页的 CSS 也可能让我们的工具栏样式错乱。

**候选方案**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| (A) Shadow DOM + Tailwind preflight 关闭 + scoped 重置 | 隔离彻底；性能好；DevTools 可查 | Radix portal 默认渲染到 main DOM，需手工绑回 shadow root；`@tailwind base` 不能用 |
| (B) iframe 注入 | 隔离最彻底（连脚本沙箱也隔离） | 跨 iframe 通信复杂；CSP 受限页面会 block；定位/缩放交互困难 |
| (C) CSS Modules + 高 z-index + 不用 Tailwind | 最简单 | 放弃 shadcn 生态；维护成本高 |

**决策（Phase 1 已落地）**：**采用方案 A**。

理由：
1. paperx 工具栏需要频繁 hit-test 宿主 DOM（design / ruler 模式），iframe 隔离会让坐标转换变成噩梦
2. shadcn/ui 是用户硬性要求，方案 C 直接淘汰
3. Shadow DOM + 关 preflight + scoped reset 是社区最成熟的组合，Plasmo 的 CSUI 也是这种思路

**落地证据**：
- `tailwind.config.ts` → `corePlugins.preflight: false`（仓库验证：`grep "preflight" tailwind.config.ts`）
- `src/shared/styles/preflight.css` → `:host { all: initial; ... }` 把宿主页继承全部切断，再重建工具栏需要的字体/颜色继承
- `src/content/index.tsx` → `host.attachShadow({ mode: 'open' })`，CSS 通过 Vite `?inline` import 内联进 content chunk，注入为 shadow root 第一个 `<style>` 元素
- `<paperx-root>` 自定义元素挂在 `<html>` 而不是 `<body>` 下，避免 SPA 重渲染 `<body>` 时把我们的 mount 节点干掉

**已知 Phase 2 待办**（Phase 1 不做）：
- Radix Portal 默认 `document.body`，需要包一个 `PortalContainerProvider` 把所有 `Portal.Root` 的 container 改回 shadow root（shadcn Dialog/Tooltip 才能正确渲染在 shadow 内）
- `mode: 'closed'` 替代 `'open'`，提升对宿主页脚本的防御性
- 测一批"刺头网站"（Twitter/X、Notion、GitHub 自身）的兼容性

### R2. DOM ↔ React 源码桥（让 Claude Code 找到组件）

**问题**：JSON Prompt 必须告诉 Claude Code "这个修改是哪个 React 组件的哪个 JSX 元素"，否则 AI 只能盲改 className。

**候选方案**：

| 方案 | 准确度 | 用户成本 | 备注 |
|------|--------|----------|------|
| (a) Babel plugin 编译期注入 `data-paperx-uid` | 高（精确到行列） | 用户需在自己项目装一个 babel 插件 | uid 可 hash (file:line:col:tag) 保持稳定 |
| (b) 运行时反查 React Fiber 的 `_debugSource` | 中（依赖 dev build 的 source map） | 零成本 | production build 没有 `_debugSource`；React 19 fiber 字段名可能变 |
| (c) 约定用户自己加 `data-component`/`data-source` | 低（依赖人工） | 用户写代码时就要打标 | 适合自有团队规范，对开源项目不可行 |

**决策（Phase 1 拍板）**：

- **主选 (a) Babel plugin**：`tools/babel-plugin-paperx-uid/index.js` 已有 stub。Phase 2 完成 visitor + 单测 + 发布到 npm。
- **Fallback (b) Fiber 反查**：当用户没装 babel plugin 时，paperx 运行时尝试从 DOM 节点对应的 fiber 读 `_debugSource`（dev build 才有）和 `type.displayName`。Phase 2 实现。
- (c) 不作为主路径，但 JSON Prompt 格式会保留 `userHints` 字段，允许用户手动写 `data-component` 兜底。

**Phase 1 已落地的证据**：
- `tools/babel-plugin-paperx-uid/index.js`：JSX visitor、`uidFor(file, line, col, tag)` SHA1 截前 10 位、对小写 host 元素插入 `data-paperx-uid` attribute，跳过组件元素（首字母大写的 JSX）
- `tools/babel-plugin-paperx-uid/README.md`：说明 Phase 2 接入方式

**Phase 2 路线**：
1. Babel plugin 单测覆盖（fragment、namespaced JSX、已有 attribute 等 corner case）
2. paperx 运行时：从 DOM 节点 → 找最近祖先含 `data-paperx-uid` → 解析 uid → 在 JSON Prompt 输出 `{ uid, file, line, component }`
3. Fiber fallback：实现 `findFiber(domNode)` 沿 `__reactFiber$xxx` 遍历，读 `_debugSource`

### R3. visBug 集成形态

**问题**：visBug（GoogleChromeLabs/ProjectVisBug）是 Web Components 写的可视化编辑工具，paperx 想复用其 DOM 直接编辑能力。怎么集成？

**候选方案**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| (X) Fork 进 monorepo，深度改造 | 完全可控 | 维护成本高；和上游 diff 越拉越大 |
| (Y) 依赖发布版（npm 或 CDN） | 跟上游升级简单 | visBug 的发布节奏不稳定，且 web component 的事件 API 受限 |
| (Z) Phase 1 不引入，Phase 2 按需以 (Y) 方式接 | 推迟决策点直到真要用 | 工具栏 MVP 需要自己实现简单交互 |

**决策（Phase 1 拍板）**：**采用 (Z)**——Phase 1 暂不引入 visBug。

理由：
1. visBug 是 Web Components（自定义元素），与 React 同 DOM 不冲突，但它的能力和 paperx 的工具栏 UI 是**正交**的：visBug 解决"在元素上拖拽改样式"，paperx 的工具栏解决"模式切换 + change-log 展示"。两者的接口尚未稳定时，过早集成只会污染抽象。
2. Phase 1 我们要先把 Shadow DOM、MobX、JSON Prompt 接口跑通；visBug 可以在 Phase 2 design 模式实现时再以方案 (Y) 接入。
3. visBug 自身把 UI 渲染到 main DOM（不进 shadow root），到时把它放在 paperx Shadow DOM 之外作为兄弟元素，由 ChangeLogService 桥接事件即可。

**Phase 2 路线**：
1. design 模式实现时，先尝试 `import 'web-vis-bug'`（npm 包），如能直接用就用
2. 不行就 fork 一份精简版进 `tools/vis-bug/`
3. 通过自定义事件 `paperx:change` 在 visBug 与 ChangeLogService 之间通信

## 3. 整体目录结构

```
paperx/
├── manifest.json                    # MV3 manifest, action+command+content_scripts
├── package.json                     # bun-managed
├── tsconfig.json                    # strict + decorators (Inversify) + jsx
├── vite.config.ts                   # @crxjs/vite-plugin entry
├── tailwind.config.ts               # preflight: false（关键）
├── postcss.config.js
├── src/
│   ├── background/
│   │   └── index.ts                 # service worker: action onClicked → PAPERX_TOGGLE
│   ├── content/
│   │   ├── index.tsx                # Shadow DOM bootstrap + React mount
│   │   └── FloatingToolbar.tsx      # 顶部悬浮工具栏（4 模式 + 关闭）
│   ├── popup/                       # （Phase 2 才用）
│   ├── shared/
│   │   ├── di/
│   │   │   ├── container.ts         # Inversify Container 单例
│   │   │   └── tokens.ts            # Symbol-based DI tokens
│   │   ├── stores/
│   │   │   └── UIStore.ts           # MobX: visible / mode / toggle / setMode
│   │   ├── services/
│   │   │   └── ChangeLogService.ts  # observable 变更记录（Phase 2 接 export）
│   │   ├── types/
│   │   │   ├── modes.ts             # ToolMode 联合 + 标签
│   │   │   └── messages.ts          # 跨上下文消息 discriminated union
│   │   ├── ui/
│   │   │   ├── utils.ts             # cn() = clsx + tailwind-merge
│   │   │   └── button.tsx           # shadcn-style Button (cva)
│   │   └── styles/
│   │       ├── tokens.css           # HSL 设计变量
│   │       ├── preflight.css        # :host scoped reset
│   │       └── tailwind.css         # @tailwind components/utilities
│   └── assets/
│       └── icon.png                 # 1x1 占位（Phase 2 换正式 icon）
├── tools/
│   └── babel-plugin-paperx-uid/     # R2 编译期注入 stub
│       ├── index.js
│       ├── package.json
│       └── README.md
└── docs/
    └── architecture.md              # 本文件
```

## 4. 技术栈版本（Phase 1 锁定）

| 层 | 选择 | 版本 | 备注 |
|----|------|------|------|
| 运行时 / 包管理 | bun | 1.3.6 | scripts 全部走 bun |
| 语言 | TypeScript | ^5.7 | strict + experimentalDecorators (Inversify 必需) |
| 构建 | Vite | ^5.4 | 不用 v8 beta（CRXJS 还没追上） |
| 扩展工具链 | @crxjs/vite-plugin | ^2.0.0-beta.32 | MV3 + HMR |
| UI 框架 | React | ^18.3 | 函数组件 + hooks |
| 状态 | MobX + mobx-react-lite | ^6 / ^4 | makeObservable 而非装饰器（避开 useDefineForClassFields 坑） |
| DI | InversifyJS | ^6 | reflect-metadata + Symbol token |
| 样式 | Tailwind CSS | ^3.4 | preflight 关闭；不用 v4（v4 在 shadow DOM 下还有坑） |
| 组件 | shadcn/ui 风格 | 手写 | 不用 CLI，因为我们要进 shadow DOM |
| 图标 | lucide-react | ^0.468 | 体积小 |
| 工具 | clsx, tailwind-merge, class-variance-authority | latest | shadcn 标配 |

## 5. Phase 路线图

### Phase 1 — 脚手架与垂直切片（已完成）
- ✅ MV3 + bun + Vite + CRXJS 工程脚手架
- ✅ MobX UIStore + Inversify Container + ChangeLogService 骨架
- ✅ Shadow DOM 注入 + scoped Tailwind + 悬浮工具栏 MVP
- ✅ R1/R2/R3 三大决策落地（含 babel plugin stub）

### Phase 2 — 核心可视化编辑（design 模式优先）
1. Radix `PortalContainerProvider` 把 shadcn Dialog/Tooltip 渲染到 shadow root
2. design 模式：picker 选中元素 → 右侧面板（W/H/字体/边距/颜色）→ 写回 inline style
3. 4 个 view 切换（hierarchy / code / CSS / Tailwind），先做 hierarchy + CSS
4. 底部 change-log drawer：listing + filter + 单条 reset
5. R2 babel plugin 完成 + npm 发布；运行时 Fiber 反查 fallback
6. JSON Prompt v1 schema + export 到剪贴板

### Phase 3 — comment / layout 模式 + 协作
1. comment 模式：在元素上叠加批注 layer，持久化到 chrome.storage
2. layout 模式：可视化 Flex/Grid 调参
3. visBug 集成（方案 Z 升级到 Y）
4. JSON Prompt v2：含组件树、样式 diff、Tailwind 反映射

### Phase 4 — 生产化
1. dark mode + 多语言
2. popup 配置页（白名单域名、快捷键、JSON 模板）
3. e2e 测试（Playwright + Chrome 启动）
4. CI（GitHub Actions：bun typecheck + build + zip 产物上传）
5. Chrome Web Store 上架

## 6. 关键约束 / 红线

- **永远不污染宿主页**：preflight 不许打开；任何全局选择器（`html`、`body`、`*`）必须在 shadow root 内；不许在 `document` 上写 listener 用于 paperx 自身（事件代理只能注册在 shadow root）
- **service worker 不持久化状态**：MV3 的 background 会被回收。所有共享状态走 chrome.storage.session（每标签页独立）或 content-script 内的 MobX 单例
- **content script 单例化**：`<paperx-root>` 是哨兵节点，重复注入直接 short-circuit
- **bundle 体积**：content chunk 当前 ~90KB gzip，Phase 2 设上限 200KB；超出立即审视 lucide-react / 重型库
- **不引入 next.js / parcel / webpack**：纯 vite + crxjs

## 7. 验收路径（人工）

```bash
bun install
bun run typecheck   # tsc --noEmit, exit 0
bun run build       # vite build, exit 0
```

然后：
1. 打开 Chrome → `chrome://extensions`
2. 右上角打开"开发者模式"
3. "加载已解压的扩展程序"，选择仓库下的 `dist/` 目录
4. 打开任意网页（如 https://example.com）
5. 点击工具栏的 paperx 图标，或按 `Cmd+Shift+P`（macOS）/ `Ctrl+Shift+P`（Win/Linux）
6. 应在右上角看到圆角悬浮工具栏，4 个模式按钮 + 一个关闭按钮
7. 点不同模式按钮，激活态会变化（MobX `setMode` 已生效）
8. 点关闭按钮 / 再次按快捷键，工具栏隐藏

如果上述任意一步失败，先看 `chrome://extensions/` 那块的 Errors，再看页面 DevTools Console（应能看到 `[paperx/content] mounted in shadow DOM, listening for PAPERX_TOGGLE`）。
