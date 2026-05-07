# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install                  # bun 1.3+ required
bun run typecheck            # tsc --noEmit (strict)
bun run build                # vite build → dist/  (MV3 unpacked extension)
bun run dev                  # vite + CRXJS HMR (content-script edits hot-reload)
bun run test:e2e             # Playwright sanity (real headed Chromium)
bun run test:e2e -- --grep <substr>   # run a single test by title substring
bunx playwright install chromium      # one-time, Playwright's own Chromium
```

`test:e2e` always loads from `dist/`. **Run `bun run build` whenever source changes** — the e2e harness does not auto-rebuild. macOS / desktop Linux only (MV3 needs headed Chromium).

Loading the extension manually: `chrome://extensions` → Developer mode → Load unpacked → pick `dist/`.

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

`UIStore.mode` is one of `design | ruler | comment | layout`. The `<ElementPicker />` activates whenever `UIStore.visible` is true (every mode needs to point at an element). Each mode has its own right-side panel under `src/content/panels/<mode>/`, mutually exclusive on `mode === '<x>' && SelectionStore.selected != null`. Layout / design mode panels write through `StyleEditService`; ruler is read-only; comment writes to `CommentStore` (in-memory, keyed like the JSON Prompt aggregator).

### JSON Prompt v1 wire format

`PaperxPromptV1` (in `src/shared/types/prompt.ts`) is the single output contract. `JsonPromptExporter.exportToClipboard()` writes pure JSON (no markdown fence, no preamble). The interface is intentionally just `build()` + `exportToClipboard()` — there used to be legacy `buildPrompt` / `buildPromptText` / `copyToClipboard` shims but they've been removed.

## Conventions worth knowing before opening a PR

- **Hooks order is sacred.** Call every `useState` / `useEffect` BEFORE any `if (!visible) return null;`. `LayoutPanel.tsx` has the canonical pattern (target may be null when hooks run, hooks accept a `'0px'` default). Violating this caused a real bug; the layout-mode e2e test now guards it.
- **`data-testid` for stable e2e selectors.** Toolbar / mode buttons / history / close / panels / submit buttons all carry `data-testid="paperx-..."`. Add a testid when you add a button or panel that the e2e suite needs to reach. Button components forward `data-*` via `{...props}`.
- **Conventional Commits** (`feat:` / `fix:` / `chore:` / `refactor:` / `test:` / `docs:`). Multi-commit PRs are preferred over one giant commit; keep each commit typecheck-clean so `git bisect` works.
- **Branch policy:** `dev` is the working branch (push allowed). `main` is untouched — never commit there directly, never force-push.
- **Don't add new top-level deps casually.** Check whether the existing primitives (`Button`, `Card`, `Input`, `Label`, `Select`) cover the case before reaching for a new Radix package. If you do add one (e.g. another overlay component), pre-install the dep in a single `chore(deps):` commit before the feature commit so parallel agents don't race on `package.json`.
- **No mocks in e2e.** Tests load the real built extension into real Chromium and read the real clipboard. Adding a test means it must pass against `dist/`.
- **Don't reintroduce a babel plugin or a Fiber fallback for source-side data injection.** This was explicitly cut: paperx reads `data-uid` and that's it. Source-side tooling is the user project's responsibility.

## Common gotchas observed from prior sprints

- **Sharing the working tree across parallel agents corrupts state.** When spawning ≥ 2 agents, use `isolation: "worktree"` so each gets its own clone. Single-agent tasks can stay in-tree.
- **`@/...` path alias** (configured in `vite.config.ts` + `tsconfig.json`) maps to `src/...`. Always use it for cross-module imports; don't write relative `../../shared/...` paths.
- **Tailwind preflight is OFF** (see `tailwind.config.ts`). Don't rely on `@tailwind base` — write explicit reset rules in `src/shared/styles/preflight.css` if needed.
- **CSS into shadow root** is done via `import tailwindCss from '@/shared/styles/tailwind.css?inline'` — Vite's `?inline` query is the official channel. Don't try to read the CSS file at runtime.
- **Picker click capture** uses `composedPath()` to skip events that originate inside `<paperx-root>`, so paperx's own UI clicks never trigger element selection. If you add a new interactive panel and clicks feel unresponsive, check that the host element has `onMouseDown` / `onClick` `stopPropagation` like the toolbar pill does.

## Architecture documents

`docs/architecture.md` is the long-form record of the three foundational decisions (R1 Shadow-DOM isolation, R2 data-uid consumer model, R3 visBug deferred). Keep it in sync when a decision changes — it's the source of truth for "why this way".
