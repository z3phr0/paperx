/// <reference types="vite/client" />

/**
 * Build-time constant injected by `vite.config.ts` `define`. Source of
 * truth lives in `package.json.version`; this declaration just teaches
 * TypeScript that the identifier exists at compile time.
 */
declare const __PAPERX_VERSION__: string;
