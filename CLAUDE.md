# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout (bun monorepo, Mirror sprint)

Two workspaces under `apps/`:

- `apps/paperx/` — the MV3 browser extension (everything that used to live at repo root: `src/`, `tests/`, `manifest.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `playwright.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `package.json`). All `src/...` paths in this doc are now inside `apps/paperx/`.
- `apps/paperx-cli/` — Mirror-sprint skeleton (`src/index.ts` prints hello, `package.json` version `0.0.1`, not released). Business logic deferred.

Shared infra at root: `tsconfig.base.json` (extended by both packages), root `package.json` with `workspaces: ["apps/*", "packages/*"]` and `--filter`-forwarding scripts, `scripts/release.ts` (bumps `apps/paperx/package.json` — extension is the released artifact; root has no `version`), `CHANGELOG.md`, `docs/`. `packages/` is reserved for future shared libs and is currently empty.

Root scripts forward via Bun's filter (Bun 1.3+ syntax — **filter goes AFTER `run`**): `bun run build` → `bun run --filter paperx build`, `bun run typecheck` → `bun run --filter './apps/*' typecheck` (all packages), `bun run cli` → `bun run --filter paperx-cli start`. You can also `cd apps/paperx && bun run <script>` directly. `bun --filter X run Y` (filter before `run`) silently returns "No packages matched" in 1.3.6 — don't write scripts that way.

## Commands

```bash
bun install                  # bun 1.3+ required; hoists all workspace deps to root node_modules
bun run typecheck            # tsc --noEmit, fan-out across both workspaces via --filter
bun run build                # vite build → apps/paperx/dist/  (MV3 unpacked extension)
bun run dev                  # vite + CRXJS HMR (content-script edits hot-reload)
bun run test:e2e             # Playwright sanity (real headed Chromium)
bun run test:e2e -- --grep <substr>   # run a single test by title substring
bun run cli                  # paperx-cli skeleton — prints hello / --help / --version
bunx playwright install chromium      # one-time, Playwright's own Chromium
```

`test:e2e` always loads from `apps/paperx/dist/`. **Run `bun run build` whenever source changes** — the e2e harness does not auto-rebuild. macOS / desktop Linux only (MV3 needs headed Chromium).

Loading the extension manually: `chrome://extensions` → Developer mode → Load unpacked → pick `apps/paperx/dist/`.

## Architecture (the parts you need to understand before changing anything)

### Shadow-DOM injection contract

`src/content/index.tsx` is the only entry point that touches the host page. It mounts a single `<paperx-root>` custom element under `<html>` (not `<body>` — survives SPA `<body>` re-renders) and creates **two sibling divs inside the shadow root**:

- `#paperx-react-root` — React renders the toolbar / panels here.
- `#paperx-portal-layer` — sibling, fixed `inset:0`, `pointer-events:none`, `z-index:int32-max`. This is the container that `<PortalProvider>` exposes via `usePortalContainer()`.

**Any Radix overlay (Dialog / Popover / Tooltip / DropdownMenu) MUST be wrapped in `<X.Portal container={usePortalContainer()}>`.** Without it, Radix portals into `document.body`, escapes the shadow tree, and the host page CSS bleeds in. `src/shared/ui/ColorPicker.tsx` is the reference implementation.

### State / DI / single-writer for style edits

- **MobX stores** (`src/shared/stores/`): `UIStore` (visible + active mode), `SelectionStore` (hovered/selected DOM with `observable.ref` — never deep-observe HTMLElements), `ChangeLogUIStore` (drawer open + filters), `CommentStore`.
- **DI tokens** (`src/shared/di/tokens.ts`) are `Symbol.for('paperx.X')` — never strings. Bindings live in `container.ts`. New stores/services register here.
- **`StyleEditService.apply(target, prop, value)` is the ONLY writer** of inline styles in the project. Panels never set `element.style.X` directly. The service:
  1. Reads `before` from inline-or-computed style.
  2. Calls `target.style.setProperty(prop, value)`.
  3. `changeLogService.append(...)` + `changeLogService.attachTarget(id, target)` (WeakRef Map back-reference).
  This is what makes the ChangeLog drawer's *Locate* / *Undo* buttons work and what feeds `JsonPromptExporter`.

### data-uid: paperx is a pure consumer

The user's project tooling injects `data-uid="<stable-id>"` on host-page DOM elements. paperx **never writes that attribute** — no babel plugin, no Fiber fallback, no `data-paperx-` prefix. Helper is `readDataUid(el)` in `src/shared/types/changes.ts`. JSON Prompt aggregation keys on `dataUid ?? selector`; null `dataUid` falls back to `selector` + `tagName`.

### Mode → panel mapping

`UIStore.mode` is one of `design | ruler | comment | transition`. The `<ElementPicker />` activates whenever `UIStore.visible` is true (every mode needs to point at an element). Each mode has its own right-side panel under `src/content/panels/<mode>/`, mutually exclusive on `mode === '<x>' && SelectionStore.selected != null`. Design / transition panels write through `StyleEditService`; ruler is read-only; comment writes to `CommentStore` (in-memory, keyed like the JSON Prompt aggregator). v0.14.5 hid the `transition` toolbar entry + ChangeLog filter chip behind `HIDDEN_TOOL_MODES` in `modes.ts` — the mode + panel + records still work, just no UI entry; clear that Set to restore.

### JSON Prompt v1 wire format

`PaperxPromptV1` (in `src/shared/types/prompt.ts`) is the single output contract. `JsonPromptExporter.exportToClipboard()` writes pure JSON (no markdown fence, no preamble). The interface is intentionally just `build()` + `exportToClipboard()` — there used to be legacy `buildPrompt` / `buildPromptText` / `copyToClipboard` shims but they've been removed.

## Conventions worth knowing before opening a PR

- **Hooks order is sacred.** Call every `useState` / `useEffect` BEFORE any `if (!visible) return null;`. The right-side panels follow this pattern (target may be null when hooks run, hooks accept a `'0px'` default). Violating this caused a real bug; the e2e suite guards it.
- **`data-testid` for stable e2e selectors.** Toolbar / mode buttons / history / close / panels / submit buttons all carry `data-testid="paperx-..."`. Add a testid when you add a button or panel that the e2e suite needs to reach. Button components forward `data-*` via `{...props}`.
- **Conventional Commits** (`feat:` / `fix:` / `chore:` / `refactor:` / `test:` / `docs:`). Multi-commit PRs are preferred over one giant commit; keep each commit typecheck-clean so `git bisect` works.
- **Branch policy (pre-MVP):** `dev` is the **integration** branch — never commit directly to it. All work happens on `feature/<short-name>` branches cut from `dev`. After the work is done, run the release flow (below), then ff-merge the feature back into `dev`. `main` is the stable line; it stays untouched until an MVP cut.
- **Release flow.** Work on `feature/<name>`. When the feature is complete and tests are green, run `bun run release patch|minor|major|x.y.z` on the feature branch — the script bumps `apps/paperx/package.json.version` (extension is the released artifact; root `package.json` is private and unversioned), regenerates root `CHANGELOG.md`, runs typecheck + build, and emits a `chore(release): vX.Y.Z` commit. Then `git checkout dev && git merge --ff-only feature/<name> && git tag -a vX.Y.Z -m 'Release vX.Y.Z'`. Push only when the user explicitly asks. Direct edits-on-dev or commit-without-release are both 3.25 violations — close the loop properly.
- **Don't add new top-level deps casually.** Check whether the existing primitives (`Button`, `Card`, `Input`, `Label`, `Select`) cover the case before reaching for a new Radix package. If you do add one (e.g. another overlay component), pre-install the dep in a single `chore(deps):` commit before the feature commit so parallel agents don't race on `package.json`.
- **No mocks in e2e.** Tests load the real built extension into real Chromium and read the real clipboard. Adding a test means it must pass against `apps/paperx/dist/`.
- **Don't reintroduce a babel plugin or a Fiber fallback for source-side data injection.** This was explicitly cut: paperx reads `data-uid` and that's it. Source-side tooling is the user project's responsibility.

## Common gotchas observed from prior sprints

- **Sharing the working tree across parallel agents corrupts state.** When spawning ≥ 2 agents, use `isolation: "worktree"` so each gets its own clone. Single-agent tasks can stay in-tree.
- **`@/...` path alias** (configured in `apps/paperx/vite.config.ts` + `apps/paperx/tsconfig.json`) maps to `apps/paperx/src/...`. Always use it for cross-module imports inside the extension; don't write relative `../../shared/...` paths.
- **Tailwind preflight is OFF** (see `apps/paperx/tailwind.config.ts`). Don't rely on `@tailwind base` — write explicit reset rules in `apps/paperx/src/shared/styles/preflight.css` if needed.
- **CSS into shadow root** is done via `import tailwindCss from '@/shared/styles/tailwind.css?inline'` — Vite's `?inline` query is the official channel. Don't try to read the CSS file at runtime.
- **Picker click capture** uses `composedPath()` to skip events that originate inside `<paperx-root>`, so paperx's own UI clicks never trigger element selection. If you add a new interactive panel and clicks feel unresponsive, check that the host element has `onMouseDown` / `onClick` `stopPropagation` like the toolbar pill does.

### Monorepo gotchas (Mirror sprint, v0.14.6)

- **Bun `--filter` order.** `bun run --filter <name|glob> <script>` works; `bun --filter <name> run <script>` (filter before `run`) silently fails with "No packages matched" in Bun 1.3.6. Always write filter **after** `run` in package scripts.
- **paperx-cli ships its own `typescript` + `@types/node` devDeps.** They're hoisted at root, but if you only declare them in `apps/paperx`, bunx falls back to a fresh side-install in the CLI workspace that doesn't see hoisted `@types/node` → "Cannot find type definition file for 'node'". Keep both packages' direct devDeps explicit.
- **`scripts/release.ts` uses `conventional-changelog-cli` (CLI package), not `conventional-changelog` (lib package).** The lib doesn't bundle the angular preset; bunx-fetched fresh installs of the lib will fail with "Unable to load the 'angular' preset". The script also passes `-k apps/paperx/package.json` so the CLI reads the bumped version from the extension package — without `-k`, conventional-changelog reads from cwd's (root) `package.json` which has no `version` field and emits an empty `# []` CHANGELOG header.
- **`tsconfig.base.json` at root holds the shared compilerOptions.** Each package's `tsconfig.json` `extends ../../tsconfig.base.json` and adds package-specific bits (DOM lib + jsx + decorators + `@/*` paths for paperx; `types: ["node"]` for paperx-cli). Don't duplicate the shared options.
- **`packages/` glob matches nothing right now.** That's fine — Bun tolerates empty workspace globs. The dir is reserved for the first shared lib (e.g. extracting `PaperxPromptV1` types when CLI consumes them).

## Architecture documents

`docs/architecture.md` is the long-form record of the three foundational decisions (R1 Shadow-DOM isolation, R2 data-uid consumer model, R3 visBug deferred). Keep it in sync when a decision changes — it's the source of truth for "why this way".

`RELEASING.md` documents the release flow end-to-end (Conventional Commits → angular CHANGELOG, single-source-of-truth version table, recovery for malformed releases). Read it before changing `scripts/release.ts`.
