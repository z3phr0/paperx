# babel-plugin-paperx-uid (Phase 1 stub)

Injects a stable `data-paperx-uid` attribute onto every host JSX element
so paperx can map a DOM node back to its source location.

**Status:** Phase 1 stub. Not yet published, not yet wired into any
build pipeline. The visitor logic + UID hashing is here as the seed for
Phase 2's real implementation.

See `docs/architecture.md` (R2) for the full strategy, including the
runtime Fiber-traversal fallback.

## Usage (Phase 2 preview)

```ts
// vite.config.ts in the *user's* React project
import react from '@vitejs/plugin-react';
import paperxUid from 'babel-plugin-paperx-uid';

export default {
  plugins: [
    react({
      babel: { plugins: [paperxUid] },
    }),
  ],
};
```
