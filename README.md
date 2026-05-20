# paperx

> 浏览器里改样式 → 导出 JSON Prompt → 粘到 Claude Code → AI 自动改源码。
> 给设计师 / 前端的可视化 CSS 编辑 Chrome 扩展（MV3）。

## 核心闭环

```
[ 网页 ]                                                           [ 编辑器 ]
   │                                                                    ▲
   ▼                                                                    │
[ paperx 工具栏 ] ──→ [ change-log ] ──→ [ JSON Prompt ] ──→ [ Claude Code ]
   │                                                                    │
   └─ 4 模式：design / ruler / comment / layout                         │
   └─ 4 view：层级 / 代码 / CSS / Tailwind                              │
                                                                        ▼
                                                             AI 定位 React 组件
                                                             改 CSS 或 Tailwind
```

## 技术栈

| 层 | 选择 |
|----|------|
| 运行时 / 包管理 | [bun](https://bun.com) 1.3+ |
| 语言 | TypeScript 5（strict） |
| 构建 | Vite 5 + [@crxjs/vite-plugin](https://crxjs.dev) |
| UI | React 18 + 函数组件 |
| 状态 | MobX 6（`makeObservable` 风格） |
| DI | InversifyJS 6（Symbol token） |
| 样式 | Tailwind CSS 3.4（preflight 关闭，scoped 进 Shadow DOM） |
| 组件 | shadcn/ui 风格（手写，进 Shadow DOM） |
| 图标 | lucide-react |
| 扩展形态 | Chrome Manifest V3 |

## 目录结构（bun monorepo，Mirror sprint）

```
paperx/                              # workspace root, private, no version
├── package.json                     # workspaces: ["apps/*", "packages/*"]
├── tsconfig.base.json               # shared compilerOptions
├── CHANGELOG.md                     # release history (cross-package)
├── scripts/release.ts               # bumps apps/paperx/package.json
├── apps/
│   ├── paperx/                      # 浏览器插件（发布物）
│   │   ├── manifest.json            # MV3 manifest
│   │   ├── package.json             # name: "paperx", versioned
│   │   ├── vite.config.ts           # @crxjs/vite-plugin entry
│   │   ├── src/
│   │   │   ├── background/index.ts  # service worker（toggle bridge）
│   │   │   ├── content/             # Shadow DOM 启动 + 悬浮工具栏
│   │   │   └── shared/              # di / stores / services / ui / styles / types
│   │   └── tests/e2e/               # Playwright sanity
│   └── paperx-cli/                  # Mirror skeleton（业务下一期）
│       ├── package.json             # name: "paperx-cli", v0.0.1
│       └── src/index.ts             # hello / --help / --version
├── packages/                        # 预留 shared lib（当前空）
└── docs/architecture.md             # 三大架构决策 + Phase 路线
```

## 开发流程

### 安装

```bash
bun install
```

### 类型检查

```bash
bun run typecheck   # tsc --noEmit
```

### 构建产物

```bash
bun run build
```

产出在 `apps/paperx/dist/`。

### 开发模式（HMR）

```bash
bun run dev
```

Vite + CRXJS 会启动 dev server 并把 manifest 输出到 `apps/paperx/dist/`，content script 改动支持热更（popup/options 改动免重启加载）。

### 加载扩展到 Chrome

1. 打开 `chrome://extensions`
2. 右上角开启 **开发者模式 (Developer mode)**
3. 点击 **加载已解压的扩展程序 (Load unpacked)**
4. 选择仓库下的 `apps/paperx/dist/` 目录
5. 打开任意网页（例如 `https://example.com`）
6. 点击 Chrome 工具栏里的 paperx 图标，或按快捷键 `Cmd+Shift+P`（macOS）/ `Ctrl+Shift+P`（Win/Linux）

页面右上角会出现圆角悬浮工具栏，4 个模式图标按钮（design/ruler/comment/layout）+ 一个关闭按钮。点击模式按钮可切换激活态（MobX 状态生效）；按关闭或再次按快捷键可隐藏工具栏。

> Phase 1 状态：仅做到工具栏 UI 注入 + 模式切换。具体的"改样式 / 导出 JSON Prompt"功能在 Phase 2 完成。

## 架构决策

详见 [`docs/architecture.md`](./docs/architecture.md)。三大风险点：

- **R1** UI 隔离 → Shadow DOM + Tailwind 关 preflight + scoped `:host { all: initial }` 重置
- **R2** DOM ↔ React 源码 → 主选 babel 插件 `data-paperx-uid` 编译期注入；fallback 运行时 Fiber 反查
- **R3** visBug 集成 → Phase 1 不引入；Phase 2 以依赖发布版形式接入 design 模式

## 验收脚本（CI 友好）

```bash
bun install && bun run typecheck && bun run build && ls apps/paperx/dist/manifest.json
```

退出码 0 + `apps/paperx/dist/manifest.json` 存在 = 构建链路 OK。

## License

MIT
