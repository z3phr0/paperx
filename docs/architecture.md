# paperx 架构文档（Phase 1）

> 本文档记录 Phase 1 拍板的关键架构决策（R1/R2/R3）以及后续 Phase 2~4 的演进路线。所有决策都附理由 + 备选方案 + 落地步骤，便于后续维护者读懂 "为什么这么选"。

## 1. 项目定位

paperx 是一个 Chrome 浏览器扩展（Manifest V3）。它让设计师 / 前端工程师在**任意网页**上做可视化 CSS 编辑（尺寸、字体、布局），并把变更打包成结构化 JSON Prompt。

核心闭环：

```
浏览器里改样式 (paperx 工具栏)
        │
        ▼
导出 JSON Prompt (按 data-uid 聚合，含 before / after CSS 变更)
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

### R2. DOM ↔ 源码桥（让 Claude Code 找到组件）

**问题**：JSON Prompt 必须告诉 Claude Code "这个修改是哪个组件的哪个 DOM 元素"，否则 AI 只能盲改 className。

**底层逻辑修订（Phase 2 — 不要过度设计）**：

paperx **不参与** 标签注入。源码工程方（用户的 React/Vue/Svelte/...项目）按自己的工程实践，编译期或开发期给每个目标 DOM 元素打 `data-uid` 属性。paperx 是**纯消费者**：

```
用户工程（他们家的 babel/swc/vite plugin / 框架自带 / 手动）
        │
        ▼ 编译产物中每个 DOM 已含 data-uid="<工程内唯一 id>"
        │
浏览器运行
        │
        ▼ paperx 在 DOM 上读 element.getAttribute('data-uid')
        │
        ▼ 收集变更 → 按 data-uid 聚合 → JSON Prompt
        │
        ▼ 粘到 Claude Code → AI 用 grep 'data-uid="<id>"' 直接定位源码 → 改 CSS
```

**决策（Phase 2 终版）**：

- 属性名固定 `data-uid`（不加 `paperx-` 前缀——避免污染用户 attribute 命名空间，也尊重项目方的既有约定）
- 没有 fallback 机制（不写 Fiber 反查、不写 babel plugin、不约定 userHints）
- 元素无 `data-uid` 时：JSON Prompt 仍输出 `selector + tagName`，AI 自己用 selector 定位（降级路径，不是主路径）
- paperx 自身 zero 编译期工具——任何"为了让 AI 改源码而写的源码工具"都是过度设计

**理由**：
1. 用户原始需求（owner 表态）："我的项目工程会自动给每个 dom 元素标注了 data-uid，浏览器插件的作用是把这些 data-uid 的改动收集起来"——paperx 要做减法，不是加法
2. 项目方有完全自由度选标签注入方案：自家 babel plugin / swc plugin / framework 自带（如 Astro、Solid 都有类似机制）/ 手工标注，paperx 都接得上
3. 不绑死任何打标实现，不与上游工程深度耦合，paperx 维护边界清晰

**落地（Phase 2 完成项）**：
- `src/shared/types/changes.ts` 的 `readDataUid(el)` helper：单行 `el.getAttribute('data-uid')`
- `SelectionStore.selectedDataUid` computed：直接读属性，无 fallback
- JSON Prompt schema：`PaperxPromptTarget.dataUid: string | null`，null 时 AI 走 selector
- 不再保留 `tools/babel-plugin-paperx-uid/` 目录（已 Phase 2 移除）

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

## 3. 整体目录结构（bun monorepo，Mirror sprint v0.14.6）

```
paperx/                              # workspace root, private, no version
├── package.json                     # workspaces: ["apps/*", "packages/*"]
├── tsconfig.base.json               # shared compilerOptions（strict 等）
├── CHANGELOG.md                     # release history（跨包）
├── scripts/release.ts               # 改 apps/paperx/package.json
├── apps/
│   ├── paperx/                      # 浏览器插件（发布物）
│   │   ├── manifest.json            # MV3 manifest, action+command+content_scripts
│   │   ├── package.json             # name: "paperx", versioned
│   │   ├── tsconfig.json            # extends ../../tsconfig.base.json
│   │   ├── vite.config.ts           # @crxjs/vite-plugin entry
│   │   ├── tailwind.config.ts       # preflight: false（关键）
│   │   ├── postcss.config.js
│   │   ├── playwright.config.ts
│   │   ├── tests/e2e/               # Playwright sanity（real headed Chromium）
│   │   └── src/
│   │       ├── background/
│   │       │   └── index.ts         # service worker: action onClicked → PAPERX_TOGGLE
│   │       ├── content/
│   │       │   ├── index.tsx        # Shadow DOM bootstrap + React mount
│   │       │   ├── FloatingToolbar.tsx
│   │       │   ├── panels/          # design / ruler / comment / transition
│   │       │   └── overlays/        # guides / picker / rulers …
│   │       ├── popup/
│   │       ├── shared/
│   │       │   ├── di/              # Inversify Container + Symbol tokens
│   │       │   ├── stores/          # MobX：UIStore / Selection / ChangeLog / Comment / Snap
│   │       │   ├── services/        # StyleEditService（唯一 inline-style writer）
│   │       │   ├── types/           # ToolMode / changes / prompt schemas
│   │       │   ├── ui/              # cn() + shadcn-style primitives
│   │       │   └── styles/          # tokens / preflight / tailwind 入口
│   │       └── assets/
│   │           └── icon.png
│   └── paperx-cli/                  # Mirror skeleton（业务下一期）
│       ├── package.json             # name: "paperx-cli", v0.0.1, private
│       ├── tsconfig.json            # extends ../../tsconfig.base.json
│       └── src/
│           └── index.ts             # hello / --help / --version
├── packages/                        # 预留 shared lib（当前空）
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
3. "加载已解压的扩展程序"，选择仓库下的 `apps/paperx/dist/` 目录
4. 打开任意网页（如 https://example.com）
5. 点击工具栏的 paperx 图标，或按 `Cmd+Shift+P`（macOS）/ `Ctrl+Shift+P`（Win/Linux）
6. 应在右上角看到圆角悬浮工具栏，4 个模式按钮 + 一个关闭按钮
7. 点不同模式按钮，激活态会变化（MobX `setMode` 已生效）
8. 点关闭按钮 / 再次按快捷键，工具栏隐藏

如果上述任意一步失败，先看 `chrome://extensions/` 那块的 Errors，再看页面 DevTools Console（应能看到 `[paperx/content] mounted in shadow DOM, listening for PAPERX_TOGGLE`）。
