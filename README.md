# paperx

A Chrome browser extension for visual code editing and design review, built on top of [visBug](https://github.com/GoogleChromeLabs/ProjectVisBug). It captures DOM/CSS edits made in the browser and emits structured JSON prompts that can be pasted into Claude Code (or similar AI coding tools) to regenerate the corresponding React component source — closing the loop between design review and code.

## Stack

- **Runtime / build**: Bun + TypeScript
- **State**: MobX
- **DI**: InversifyJS
- **UI**: React + shadcn/ui
- **Foundation**: visBug (forked / extended)

## Core capabilities (target)

- Floating, hoverable toolbar; toggle the extension on/off over any page.
- Modes: Design / Ruler / Comment / Layout.
- Design mode: edit element CSS (size, typography, spacing, layout) with a Figma-aligned panel; switch between hierarchy / code / CSS / Tailwind views.
- Bottom change-log: list, filter, locate, and reset every visual edit.
- Export: generate a JSON AI prompt that includes the DOM element's React component metadata (e.g. `data-uid`), so Claude Code can resolve the component source and apply the requested style changes (CSS or Tailwind).

## Status

Bootstrap. Architecture and scaffolding planned via `/ultraplan`.
